import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { test } from "node:test";
import {
  ELO_TELEMETRY_LIMITS,
  bucketBytes,
  bucketCount,
  bucketLatency,
  bucketTokens,
  classifyTelemetryError,
  createEloTelemetryService,
  hashOpaque,
  sanitizeTelemetryEvent,
  summarizeTelemetry
} from "../src/elo-telemetry.js";

function event(overrides = {}) {
  return Object.assign({
    event_type: "CHAT_RESPONSE",
    surface: "WEB",
    route: "chat",
    status: "SUCCESS",
    latency_ms: 420,
    response_size_bucket: "10-100KB",
    context_turn_count_bucket: "1-3",
    model_class: "STANDARD"
  }, overrides);
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return { server, baseUrl: "http://127.0.0.1:" + server.address().port };
}

test("sanitiza o contrato canônico sem conteúdo de conversa", () => {
  const result = sanitizeTelemetryEvent(event({ session_hash: hashOpaque("session-1", "test") }));
  assert.equal(result.event_type, "CHAT_RESPONSE");
  assert.match(result.session_hash, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(result, "prompt"), false);
  assert.equal(Object.hasOwn(result, "response"), false);
});

test("rejeita chaves e canários proibidos antes da persistência", () => {
  assert.equal(sanitizeTelemetryEvent(event({ prompt: "PROMPT_CANARY" })), null);
  assert.equal(sanitizeTelemetryEvent(event({ error_code: "PASSWORD_SECRET_CANARY" })), null);
  assert.equal(sanitizeTelemetryEvent({ event_type: "NOT_A_REAL_EVENT" }), null);
});

test("buckets são determinísticos e não guardam valores brutos", () => {
  assert.equal(bucketLatency(249), "<250ms");
  assert.equal(bucketLatency(5000), "5-10s");
  assert.equal(bucketBytes(1024), "<10KB");
  assert.equal(bucketBytes(6 * 1024 * 1024), ">5MB");
  assert.equal(bucketCount(11), ">10");
  assert.equal(bucketTokens(9000), ">8k");
});

test("buffer bounded mantém somente a janela mais recente", async () => {
  const telemetry = createEloTelemetryService({ capacity: 100, store: "memory", hashSalt: "test" });
  for (let index = 0; index < 10000; index += 1) {
    await telemetry.ingest(event({ event_id: String(index), timestamp: new Date(Date.now() + index).toISOString() }));
  }
  assert.equal(telemetry.getEvents().length, 100);
  assert.equal(telemetry.getEvents()[0].event_id, "9900");
  assert.equal(telemetry.getStats().persist_errors, 0);
});

test("10 mil eventos de canário não persistem nenhum conteúdo sensível", async () => {
  const telemetry = createEloTelemetryService({ capacity: 500, store: "memory", hashSalt: "test" });
  for (let index = 0; index < 1000; index += 1) {
    await telemetry.ingest(event({ event_id: String(index), prompt: "PROMPT_CANARY", response: "RESPONSE_CANARY" }));
  }
  assert.equal(telemetry.getEvents().length, 0);
  assert.equal(JSON.stringify(telemetry.getEvents()).includes("CANARY"), false);
  for (let index = 0; index < 10000; index += 1) await telemetry.ingest(event({ event_id: `safe-${index}` }));
  assert.equal(telemetry.getEvents().length, 500);
  assert.equal(JSON.stringify(telemetry.getEvents()).includes("CANARY"), false);
});

test("batch rejeita excesso e aceita somente até 50 eventos", async () => {
  const telemetry = createEloTelemetryService({ store: "memory", hashSalt: "test" });
  const tooMany = await telemetry.ingestBatch(Array.from({ length: ELO_TELEMETRY_LIMITS.MAX_BATCH + 1 }, () => event()));
  assert.equal(tooMany.accepted, 0);
  const accepted = await telemetry.ingestBatch(Array.from({ length: ELO_TELEMETRY_LIMITS.MAX_BATCH }, () => event()));
  assert.equal(accepted.accepted, ELO_TELEMETRY_LIMITS.MAX_BATCH);
});

test("taxonomia mapeia erros sem expor mensagem original", () => {
  assert.equal(classifyTelemetryError({ message: "timeout" }), "NETWORK_TIMEOUT");
  assert.equal(classifyTelemetryError({ message: "invalid session" }, 401), "INVALID_SESSION");
  assert.equal(classifyTelemetryError({ message: "anything" }, 502), "BACKEND_5XX");
  assert.equal(classifyTelemetryError({ message: "unknown" }), "UNKNOWN");
});

test("saúde usa estados explícitos", () => {
  const now = Date.now();
  const healthy = Array.from({ length: 20 }, (_, index) => event({ event_id: `h-${index}`, timestamp: new Date(now - index).toISOString() }));
  assert.equal(summarizeTelemetry(healthy, now).state, "HEALTHY");
  const degraded = Array.from({ length: 10 }, (_, index) => event({ event_id: `d-${index}`, event_type: index === 0 ? "CHAT_FAILED" : "CHAT_RESPONSE", status: index === 0 ? "ERROR" : "SUCCESS", latency_ms: 6000, timestamp: new Date(now - index).toISOString() }));
  assert.equal(summarizeTelemetry(degraded, now).state, "DEGRADED");
  const unhealthy = Array.from({ length: 10 }, (_, index) => event({ event_id: `u-${index}`, event_type: "CHAT_FAILED", status: "ERROR", timestamp: new Date(now - index).toISOString() }));
  assert.equal(summarizeTelemetry(unhealthy, now).state, "UNHEALTHY");
});

test("endpoint aceita lote sanitizado e dashboard exige token interno", async () => {
  const app = createApp({ env: { NODE_ENV: "test" }, telemetryAdminToken: "internal-test-token", eloTelemetryStore: "memory" });
  const running = await listen(app);
  try {
    const ingest = await fetch(running.baseUrl + "/api/elo/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: [event(), event({ prompt: "PROMPT_CANARY" })] })
    });
    assert.equal(ingest.status, 202);
    assert.deepEqual(await ingest.json(), { ok: true, accepted: 1, rejected: 1 });
    const denied = await fetch(running.baseUrl + "/api/elo/telemetry/health");
    assert.equal(denied.status, 403);
    const health = await fetch(running.baseUrl + "/api/elo/telemetry/health", { headers: { "X-Elo-Telemetry-Admin": "internal-test-token" } });
    assert.equal(health.status, 200);
    const healthBody = await health.json();
    assert.equal(healthBody.health.event_count, 1);
    assert.equal(JSON.stringify(healthBody).includes("CANARY"), false);
  } finally {
    await new Promise((resolve) => running.server.close(resolve));
  }
});

test("falha do servidor de telemetria não altera o contrato do chat", async () => {
  const failingTelemetry = {
    hashSalt: "test",
    ingest: async () => { throw new Error("telemetry_offline"); },
    ingestBatch: async () => { throw new Error("telemetry_offline"); },
    snapshot: async () => ({}),
    getStats: () => ({ buffered: 0, capacity: 500, persist_errors: 1 })
  };
  const app = createApp({ env: { NODE_ENV: "test" }, eloTelemetry: failingTelemetry });
  const running = await listen(app);
  try {
    const response = await fetch(running.baseUrl + "/api/elo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" })
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(typeof body.error, "string");
  } finally {
    await new Promise((resolve) => running.server.close(resolve));
  }
});

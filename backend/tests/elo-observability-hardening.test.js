import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createEloTelemetryService, sanitizeTelemetryEvent } from "../src/elo-telemetry.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");

test("resolver canônico aponta chat, telemetry e dashboard para o mesmo backend", () => {
  const runtime = read("relatorio-qualidade-obras/elo-runtime-config.js");
  const telemetry = read("relatorio-qualidade-obras/elo-telemetry.js");
  const assistant = read("relatorio-qualidade-obras/elo-assistente.js");
  const dashboard = read("elo-telemetry-dashboard.html");
  assert.match(runtime, /DEFAULT_BACKEND_BASE_URL = "https:\/\/obrareport-backend\.onrender\.com"/);
  assert.match(telemetry, /EloRuntimeConfig\.apiUrl\(ENDPOINT_PATH\)/);
  assert.match(assistant, /EloRuntimeConfig\.apiUrl\(path\)/);
  assert.match(dashboard, /EloRuntimeConfig\.apiUrl\("\/api\/elo\/telemetry\/health/);
  assert.doesNotMatch(telemetry, /var ENDPOINT = ["']\/api\/elo\/telemetry/);
  assert.doesNotMatch(dashboard, /fetch\("\/api\/elo\/telemetry\/health/);
});

test("buffer e retry policy continuam bounded e sem segredo", () => {
  const telemetry = read("relatorio-qualidade-obras/elo-telemetry.js");
  assert.match(telemetry, /MAX_BUFFER = 200/);
  assert.match(telemetry, /MAX_RETRY_DELAY = 60000/);
  assert.match(telemetry, /status === 429/);
  assert.match(telemetry, /status === 404 \|\| status === 405/);
  assert.match(telemetry, /response_event_hash/);
  assert.doesNotMatch(telemetry, /ELO_TELEMETRY_ADMIN_TOKEN|X-Elo-Telemetry-Admin/);
});

test("feedback usa somente hash estruturado e a camada server aceita o hash", () => {
  const result = sanitizeTelemetryEvent({
    event_type: "FEEDBACK_SUBMITTED",
    surface: "ANDROID_WEBVIEW",
    action_type: "HELPFUL",
    response_event_hash: "a".repeat(64),
    status: "SUCCESS"
  });
  assert.equal(result.action_type, "HELPFUL");
  assert.equal(result.response_event_hash, "a".repeat(64));
  assert.equal(Object.hasOwn(result, "prompt"), false);
  assert.equal(Object.hasOwn(result, "response"), false);
});

test("retention é idempotente, limitada a 60 dias e tem fallback server-side", () => {
  const retentionSql = read("backend/src/data/elo-telemetry-retention.sql");
  const app = read("backend/src/app.js");
  assert.match(retentionSql, /interval '60 days'/i);
  assert.match(retentionSql, /elo-telemetry-retention-60d/);
  assert.match(retentionSql, /if not exists/);
  assert.match(app, /ELO_TELEMETRY_RETENTION_DAYS \|\| 60/);
  assert.match(app, /cleanupExpired/);
  assert.match(app, /admin_token_configured: Boolean\(expected\)/);
  assert.doesNotMatch(app, /response\.json\([^\n]*expected/);
});

test("cleanup dry-run não apaga eventos e cleanup real só chama o escopo de telemetria", async () => {
  const calls = [];
  const fakeClient = {
    from(table) {
      assert.equal(table, "elo_telemetry_events");
      return {
        select(...args) {
          calls.push(["select", args]);
          return { lt: async (...ltArgs) => { calls.push(["select.lt", ltArgs]); return { count: 2, error: null }; } };
        },
        delete() {
          calls.push(["delete"]);
          return { lt() { return { select: async (...selectArgs) => { calls.push(["delete.lt.select", selectArgs]); return { data: [{ id: "old-1" }, { id: "old-2" }], error: null }; } }; } };
        }
      };
    }
  };
  const service = createEloTelemetryService({ client: fakeClient, store: "supabase", hashSalt: "test" });
  const preview = await service.cleanupExpired({ days: 60, now: Date.parse("2026-09-20T00:00:00.000Z"), dryRun: true });
  assert.equal(preview.dry_run, true);
  assert.equal(preview.matching, 2);
  assert.equal(calls.some(([name]) => name === "delete"), false);
  const cleanup = await service.cleanupExpired({ days: 60, now: Date.parse("2026-09-20T00:00:00.000Z") });
  assert.equal(cleanup.deleted, 2);
  assert.equal(calls.some(([name]) => name === "delete"), true);
});

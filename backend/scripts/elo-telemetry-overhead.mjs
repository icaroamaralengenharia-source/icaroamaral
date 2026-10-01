import { createApp } from "../src/app.js";

function percentile(values, fraction) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return { server, url: "http://127.0.0.1:" + server.address().port };
}

async function measure(eloTelemetry) {
  const app = createApp({ env: { NODE_ENV: "test" }, eloTelemetry });
  const running = await listen(app);
  const values = [];
  try {
    for (let index = 0; index < 5; index += 1) {
      await fetch(running.url + "/api/elo/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "oi" }) });
    }
    for (let index = 0; index < 50; index += 1) {
      const started = performance.now();
      await fetch(running.url + "/api/elo/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "oi" }) });
      values.push(performance.now() - started);
    }
  } finally {
    await new Promise((resolve) => running.server.close(resolve));
  }
  return { p50_ms: Number(percentile(values, 0.5).toFixed(2)), p95_ms: Number(percentile(values, 0.95).toFixed(2)), samples: values.length };
}

const noopTelemetry = {
  hashSalt: "overhead-test",
  ingest: async () => ({ accepted: false }),
  ingestBatch: async () => ({ accepted: 0, rejected: 0 }),
  snapshot: async () => ({}),
  getStats: () => ({ buffered: 0, capacity: 500, persist_errors: 0 })
};
const telemetry = await measure(undefined);
const control = await measure(noopTelemetry);
console.log(JSON.stringify({ telemetry, control, overhead_p50_ms: Number((telemetry.p50_ms - control.p50_ms).toFixed(2)), overhead_p95_ms: Number((telemetry.p95_ms - control.p95_ms).toFixed(2)) }));

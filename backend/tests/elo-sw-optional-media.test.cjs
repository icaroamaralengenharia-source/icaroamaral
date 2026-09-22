const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "..", "..");
const swSource = fs.readFileSync(path.join(repo, "elo-sw.js"), "utf8");

function loadServiceWorker({ criticalFails = false } = {}) {
  const handlers = {};
  const warnings = [];
  const cached = [];
  const cache = {
    addAll(assets) {
      assert.ok(assets.length > 0);
      assert.ok(assets.every((asset) => !asset.includes("wm-brahms")));
      if (criticalFails) return Promise.reject(new Error("critical_404"));
      cached.push(...assets);
      return Promise.resolve();
    },
    put(asset) {
      cached.push(asset);
      return Promise.resolve();
    }
  };
  const context = {
    console: { warn: (...args) => warnings.push(args) },
    fetch: async (asset) => ({
      ok: !asset.includes("wm-brahms"),
      status: asset.includes("wm-brahms") ? 404 : 200
    }),
    caches: { open: async () => cache },
    self: {
      addEventListener(name, handler) { handlers[name] = handler; },
      skipWaiting: async () => {}
    },
    URL,
    Promise
  };
  vm.runInNewContext(swSource, context, { filename: "elo-sw.js" });
  return { handlers, warnings, cached };
}

async function runInstall(options) {
  const state = loadServiceWorker(options);
  let installPromise;
  state.handlers.install({ waitUntil(promise) { installPromise = promise; } });
  await installPromise;
  return state;
}

test("Service Worker instala o core quando mídia opcional retorna 404", async () => {
  const state = await runInstall();

  assert.ok(state.cached.includes("./elo.html"));
  assert.ok(state.cached.some((asset) => asset.includes("elo-assistente.js")));
  assert.equal(state.cached.some((asset) => asset.includes("wm-brahms")), false);
  assert.equal(state.warnings.length, 2);
  assert.ok(state.warnings.every(([name]) => name === "ELO_SW_OPTIONAL_MEDIA_MISSING"));
});

test("Service Worker falha quando um asset crítico falha", async () => {
  await assert.rejects(() => runInstall({ criticalFails: true }), /critical_404/);
});

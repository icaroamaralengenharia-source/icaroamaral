const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "..", "..");
const swSource = fs.readFileSync(path.join(repo, "elo-sw.js"), "utf8");

function loadServiceWorker({ criticalFails = false, cacheNames = [] } = {}) {
  const handlers = {};
  const warnings = [];
  const cached = [];
  const deleted = [];
  const matched = [];
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
    fetch: async (asset) => {
      const value = asset.url || asset;
      return {
        ok: !value.includes("wm-brahms"),
        status: value.includes("wm-brahms") ? 404 : 200,
        clone() { return {}; }
      };
    },
    caches: {
      open: async () => cache,
      keys: async () => cacheNames,
      delete: async (name) => {
        deleted.push(name);
        return true;
      },
      match: async (request) => {
        matched.push({ url: request.url || request, ignoreSearch: request.ignoreSearch });
        return undefined;
      }
    },
    self: {
      addEventListener(name, handler) { handlers[name] = handler; },
      skipWaiting: async () => {},
      clients: { claim: async () => {} }
    },
    URL,
    Promise
  };
  vm.runInNewContext(swSource, context, { filename: "elo-sw.js" });
  return { handlers, warnings, cached, deleted, matched };
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

test("Service Worker v2 remove somente caches antigos do ELO na ativação", async () => {
  const state = loadServiceWorker({
    cacheNames: [
      "elo-web-offline-v13-20260920-observability-final-v1",
      "elo-web-offline-v14-20260922-routing-v2",
      "outro-cache-da-aplicacao"
    ]
  });
  let activatePromise;
  state.handlers.activate({ waitUntil(promise) { activatePromise = promise; } });
  await activatePromise;

  assert.deepEqual(state.deleted, ["elo-web-offline-v13-20260920-observability-final-v1"]);
});

test("Service Worker preserva query string como chave distinta do asset", async () => {
  const state = loadServiceWorker();
  const requests = [
    new Request("https://www.icaroamaral.com.br/relatorio-qualidade-obras/elo-assistente.js?v=20260921-rdo-cache-v1"),
    new Request("https://www.icaroamaral.com.br/relatorio-qualidade-obras/elo-assistente.js?v=20260922-rdo-routing-v2")
  ];

  for (const request of requests) {
    let fetchPromise;
    state.handlers.fetch({
      request,
      respondWith(promise) { fetchPromise = promise; }
    });
    await fetchPromise;
  }

  assert.deepEqual(state.matched.map(({ url }) => url), requests.map(({ url }) => url));
  assert.notEqual(state.matched[0].url, state.matched[1].url);
});

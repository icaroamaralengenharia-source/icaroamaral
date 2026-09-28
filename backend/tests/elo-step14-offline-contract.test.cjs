const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..", "..");
const relatorio = path.join(root, "relatorio-qualidade-obras");

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function load(options = {}) {
  const window = {
    navigator: options.navigator || { onLine: false },
    localStorage: options.storage || storage(),
    fetch() { throw new Error("local_capability_network_call"); }
  };
  const context = { window, globalThis: window, console, URL };
  vm.createContext(context);
  for (const file of ["elo-offline-state.js", "elo-offline-local-store.js", "elo-offline-capability-registry.js", "elo-offline-router.js"]) {
    vm.runInContext(fs.readFileSync(path.join(relatorio, file), "utf8"), context, { filename: file });
  }
  return window;
}

test("Step 14 registra exatamente 200 capabilities locais", () => {
  const window = load();
  const registry = window.EloOfflineCapabilityRegistry;
  assert.equal(registry.count(), 200);
  assert.equal(registry.list().length, 200);
  assert.equal(new Set(registry.list().map((item) => item.id)).size, 200);
  assert.equal(registry.categories().length, 20);
  assert.ok(registry.list().every((item) => item.networkCallsExpected === 0));
});

test("estado explícito distingue offline, backend degradado, auth e capability remota", () => {
  const window = load();
  const state = window.EloOfflineState;
  assert.equal(state.resolveConnectivityState({ navigator: { onLine: false } }), "OFFLINE");
  assert.equal(state.resolveConnectivityState({ navigator: { onLine: true }, status: 500 }), "DEGRADED_BACKEND");
  assert.equal(state.resolveConnectivityState({ navigator: { onLine: true }, status: 401 }), "AUTH_REQUIRED");
  assert.equal(state.resolveConnectivityState({ navigator: { onLine: true }, status: 404 }), "REMOTE_CAPABILITY_UNAVAILABLE");
  assert.equal(state.resolveConnectivityState({ navigator: { onLine: true }, backendReachable: true, authValid: true }), "ONLINE");
  assert.equal(state.resolveConnectivityState({ localOnly: true }), "LOCAL_ONLY");
});

test("identidade e calculadora são locais mesmo com backend degradado", async () => {
  const window = load({ navigator: { onLine: true } });
  const router = window.EloOfflineRouter.createRouter({ storage: window.localStorage, backendState: "DEGRADED_BACKEND" });
  const identity = await router.route("quem é você?");
  const calc = await router.route("15% de 200");
  assert.equal(identity.handled, true);
  assert.match(identity.message, /Sou o ELO/i);
  assert.equal(identity.connectivityState, "DEGRADED_BACKEND");
  assert.equal(calc.result, 30);
  assert.equal(calc.providerCalls, 0);
  assert.equal(calc.chatCalls, 0);
});

test("store local é escopado por usuário e tenant e drafts não fingem sync", () => {
  const shared = storage();
  const window = load({ storage: shared });
  const a = window.EloOfflineLocalStore.create({ storage: shared, identity: { userId: "user-a", tenantId: "tenant-a" }, seed: { rdo: [{ id: "rdo-a" }] } });
  const b = window.EloOfflineLocalStore.create({ storage: shared, identity: { userId: "user-b", tenantId: "tenant-b" } });
  assert.equal(a.listRdo()[0].id, "rdo-a");
  assert.equal(b.listRdo().length, 0);
  const draft = a.draftRdo({ id: "draft-a", notes: "observação local" });
  assert.equal(draft.syncStatus, "PENDING_SYNC");
  assert.equal(a.outbox()[0].status, "PENDING_SYNC");
  assert.equal(b.listRdo().length, 0);
  assert.equal(a.switchIdentity({ userId: "user-b", tenantId: "tenant-b" }), false);
});

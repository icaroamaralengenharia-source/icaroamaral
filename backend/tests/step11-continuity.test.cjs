const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = join(__dirname, "..", "..");

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    dump() { return Object.fromEntries(values.entries()); }
  };
}

function loadWorkSession(storage, windowValues = {}) {
  const sandbox = {
    console,
    localStorage: storage,
    window: Object.assign({ localStorage: storage }, windowValues)
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, "relatorio-qualidade-obras", "elo-work-session-engine.js"), "utf8"), sandbox);
  return sandbox.window.EloWorkSessionEngine;
}

function loadMunicipal(storage, windowValues = {}) {
  const window = Object.assign({
    localStorage: storage,
    ELO_AUTH_TOKEN: "token-a",
    ELO_MUNICIPAL_CONTEXT: { institutionId: "inst-a" }
  }, windowValues);
  const sandbox = { console, window };
  window.window = window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(root, "relatorio-qualidade-obras", "elo-municipal-action-adapter.js"), "utf8"), sandbox);
  return sandbox.window.EloMunicipalActionAdapter;
}

test("Step 11 work session recarrega somente no mesmo usuario, tenant e obra", () => {
  const storage = createStorage();
  const identity = { userId: "user-a", tenantId: "tenant-a", workId: "work-a" };
  const first = loadWorkSession(storage);
  const created = first.startOrUpdateSession(Object.assign({ message: "iniciar RDO" }, identity));
  assert.equal(first.loadSession(identity).id, created.id);

  const reloaded = loadWorkSession(storage);
  assert.equal(reloaded.loadSession(identity).id, created.id);

  const otherUser = loadWorkSession(storage);
  assert.equal(otherUser.loadSession({ userId: "user-b", tenantId: "tenant-a", workId: "work-a" }), null);
  assert.equal(otherUser.loadSession({ userId: "user-a", tenantId: "tenant-b", workId: "work-a" }), null);
  assert.equal(otherUser.loadSession({ userId: "user-a", tenantId: "tenant-a", workId: "work-b" }), null);
});

test("Step 11 nao persiste sessao privada sem identidade e permite local somente por escolha explicita", () => {
  const storage = createStorage();
  const engine = loadWorkSession(storage);
  const anonymous = engine.startOrUpdateSession({ message: "iniciar diagnostico" });
  assert.equal(engine.loadSession({}), null);
  assert.equal(engine.startOrUpdateSession({ message: "sem tenant", userId: "user-a" }) !== null, true);
  assert.equal(engine.loadSession({ userId: "user-a" }), null);
  assert.equal(Object.keys(storage.dump()).length, 0);

  const localInput = { message: "iniciar diagnostico", mode: "local", localOnly: true };
  const local = engine.startOrUpdateSession(localInput);
  assert.equal(engine.loadSession(localInput).id, local.id);
  assert.notEqual(engine.getStorageKeyForTest(localInput), "elo_work_session_v1");
  assert.notEqual(anonymous.id, local.id);
});

test("Step 11 trata estado corrompido, expirado e logout com fail closed", () => {
  const storage = createStorage();
  const identity = { userId: "user-a", tenantId: "tenant-a", workId: "work-a" };
  const engine = loadWorkSession(storage);
  const key = engine.getStorageKeyForTest(identity);

  storage.setItem(key, "{corrompido");
  assert.equal(engine.loadSession(identity), null);

  storage.setItem(key, JSON.stringify({
    version: 2,
    binding: engine.getContinuityBindingForTest(identity),
    session: { id: "old", type: "rdo", updatedAt: "2020-01-01T00:00:00.000Z" }
  }));
  assert.equal(engine.loadSession(identity), null);

  const current = engine.startOrUpdateSession(Object.assign({ message: "novo RDO" }, identity));
  assert.equal(engine.resetSession(identity), true);
  assert.equal(engine.loadSession(identity), null);
  assert.ok(current.id);
});

test("Step 11 contexto municipal nao atravessa usuario na mesma instituicao", () => {
  const storage = createStorage();
  const first = loadMunicipal(storage, { ELO_MUNICIPAL_CONTEXT: { institutionId: "inst-a", userId: "user-a" } });
  const saved = first.saveWorkingContext({ context: { identity: { institutionId: "inst-a", userId: "user-a" } } }, { id: "inst-a" }, { id: "unit-a", institution_id: "inst-a", name: "Central" });
  assert.equal(saved.currentMunicipalUnit.id, "unit-a");

  const sameUser = loadMunicipal(storage, { ELO_MUNICIPAL_CONTEXT: { institutionId: "inst-a", userId: "user-a" } });
  assert.equal(sameUser.workingContext({ context: { identity: { institutionId: "inst-a", userId: "user-a" } } }).currentMunicipalUnit.id, "unit-a");

  const otherUser = loadMunicipal(storage, { ELO_MUNICIPAL_CONTEXT: { institutionId: "inst-a", userId: "user-b" } });
  assert.equal(otherUser.workingContext({ context: { identity: { institutionId: "inst-a", userId: "user-b" } } }).currentMunicipalUnit, null);
});

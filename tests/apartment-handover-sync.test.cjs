const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const ROOT = join(__dirname, "..");
const ADAPTER_PATH = join(ROOT, "vistoria-entrega-apartamento", "apartment-handover-document-adapter.js");
const SYNC_PATH = join(ROOT, "vistoria-entrega-apartamento", "apartment-handover-sync.js");
const FIXTURE_PATH = join(ROOT, "tests", "fixtures", "apartment-handover-inspection-144-final.json");

function loadBrowserGlobal(path, globals = {}) {
  const context = { module: { exports: {} }, exports: {}, ...globals };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(readFileSync(path, "utf8"), context, { filename: path });
  return { exports: context.module.exports, context };
}

function loadModules(globals = {}) {
  const adapter = loadBrowserGlobal(ADAPTER_PATH).exports;
  const loaded = loadBrowserGlobal(SYNC_PATH, { ApartmentHandoverDocumentAdapter: adapter, ...globals });
  return { adapter, sync: loaded.exports, context: loaded.context };
}

function createState() {
  const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  const inspection = fixture.report.inspection;
  inspection.status = "completed";
  inspection.completedAt = "2026-08-29T12:00:00.000Z";
  inspection.photos = {
    localPhoto1: { id: "localPhoto1", fileName: "nc-1.jpg", mimeType: "image/jpeg", data: { secret: "blob" }, base64: "abc" }
  };
  return {
    id: "local-inspection-144",
    type: "apartment_handover_inspection",
    inspection
  };
}

function corporateContext() {
  return { institutionId: "inst-a", clientId: "client-a", projectId: "project-a", createdBy: "user-a" };
}

function okResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

function createClient(sync, fetchImpl, extra = {}) {
  const persisted = [];
  return {
    apiBaseUrl: "https://backend.local",
    adapter: extra.adapter,
    fetchImpl,
    navigatorRef: extra.navigatorRef || { onLine: true },
    protectRemoteNewer: extra.protectRemoteNewer !== undefined ? extra.protectRemoteNewer : false,
    getContext: corporateContext,
    persistState(state) { persisted.push(JSON.parse(JSON.stringify(state))); },
    persisted
  };
}

test("sync cria vistoria remota via POST, persiste backendInspectionId e preserva 144 itens sem blobs", async () => {
  const { adapter, sync } = loadModules();
  const state = createState();
  const calls = [];
  const client = createClient(sync, async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T12:01:00.000Z" } }, 201);
  }, { adapter });

  sync.markDirty(state, "local_change");
  const result = await sync.syncNow(client, state, corporateContext());

  assert.equal(result.ok, true);
  assert.equal(result.action, "create");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].body.source_type, "apartment_handover_inspection");
  assert.equal(calls[0].body.institution_id, "inst-a");
  assert.equal(calls[0].body.client_id, "client-a");
  assert.equal(calls[0].body.project_id, "project-a");
  assert.equal(calls[0].body.inspection_data_json.items.length, 144);
  assert.equal(calls[0].body.inspection_data_json.photos.localPhoto1.data, undefined);
  assert.equal(calls[0].body.inspection_data_json.photos.localPhoto1.base64, undefined);
  assert.equal(state.inspection.sync.backendInspectionId, "remote-1");
  assert.equal(state.inspection.sync.syncStatus, "synced");
  assert.ok(state.inspection.sync.lastSyncedAt);
});

test("sync atualiza vistoria remota via PUT quando backendInspectionId existe", async () => {
  const { adapter, sync } = loadModules();
  const state = createState();
  state.inspection.sync = { backendInspectionId: "remote-1", syncStatus: "dirty", backendUpdatedAt: "2026-08-29T12:00:00.000Z", syncRevision: 1 };
  const calls = [];
  const client = createClient(sync, async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T12:02:00.000Z" } });
  }, { adapter, protectRemoteNewer: false });

  const result = await sync.syncNow(client, state, corporateContext());

  assert.equal(result.ok, true);
  assert.equal(result.action, "update");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "PUT");
  assert.match(calls[0].url, /remote-1$/);
  assert.equal(state.inspection.sync.syncStatus, "synced");
});

test("offline nao chama backend e preserva dados locais", async () => {
  const { adapter, sync } = loadModules();
  const state = createState();
  let calls = 0;
  const client = createClient(sync, async () => { calls += 1; throw new Error("should_not_call"); }, { adapter, navigatorRef: { onLine: false } });

  const result = await sync.syncNow(client, state, corporateContext());

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "offline");
  assert.equal(calls, 0);
  assert.equal(state.inspection.items.length, 144);
  assert.equal(state.inspection.sync.syncStatus, "local_only");
});

test("erro de rede nao apaga estado local e deixa pendente para retry", async () => {
  const { adapter, sync } = loadModules();
  const state = createState();
  const client = createClient(sync, async () => { throw new Error("network_down"); }, { adapter });

  sync.markDirty(state, "local_change");
  const result = await sync.syncNow(client, state, corporateContext());

  assert.equal(result.ok, false);
  assert.equal(result.error, "network_down");
  assert.equal(state.inspection.items.length, 144);
  assert.equal(state.inspection.sync.syncStatus, "dirty");
  assert.equal(state.inspection.sync.lastSyncError, "network_down");
});

test("retry pendente quando conexao volta executa sync controlado", async () => {
  const { adapter, sync, context } = loadModules({ setTimeout, clearTimeout });
  const state = createState();
  const navigatorRef = { onLine: false };
  const calls = [];
  const controller = sync.createController({
    apiBaseUrl: "https://backend.local",
    adapter,
    navigatorRef,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return okResponse({ inspection: { id: "remote-retry", updated_at: "2026-08-29T12:03:00.000Z" } }, 201);
    },
    getState: () => state,
    getContext: corporateContext,
    persistState() {},
    protectRemoteNewer: false,
    debounceMs: 1
  });

  controller.queueSync("local_change");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls.length, 0);
  assert.equal(state.inspection.sync.syncStatus, "local_only");

  navigatorRef.onLine = true;
  const result = await controller.retryPending("online");
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(state.inspection.sync.backendInspectionId, "remote-retry");
  assert.equal(state.inspection.sync.syncStatus, "synced");
  assert.equal(context.ApartmentHandoverInspectionSync.CONTEXT_KEY, "obrareport-apartment-handover-sync-context-v1");
});

test("contexto corporativo ausente impede sync silencioso", async () => {
  const { adapter, sync } = loadModules();
  const state = createState();
  let calls = 0;
  const client = createClient(sync, async () => { calls += 1; return okResponse({}); }, { adapter });

  const result = await sync.syncNow(client, state, { institutionId: "", clientId: "client", projectId: "project", createdBy: "user" });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "corporate_context_required");
  assert.equal(calls, 0);
  assert.equal(state.inspection.sync.lastSyncError, "corporate_context_required");
});

test("protege update quando backend conhecido esta mais novo", async () => {
  const { adapter, sync } = loadModules();
  const state = createState();
  state.inspection.sync = { backendInspectionId: "remote-1", syncStatus: "dirty", backendUpdatedAt: "2026-08-29T12:00:00.000Z", syncRevision: 1 };
  const calls = [];
  const client = createClient(sync, async (url, options) => {
    calls.push({ url, options });
    return okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T13:00:00.000Z", inspection_data_json: { remote: true } } });
  }, { adapter, protectRemoteNewer: true });

  const result = await sync.syncNow(client, state, corporateContext());

  assert.equal(result.conflict, true);
  assert.equal(result.reason, "remote_newer_than_local");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(state.inspection.sync.syncStatus, "conflict");
});

test("hydrate remoto e preserva estado local quando overwrite nao foi solicitado", () => {
  const { sync } = loadModules();
  const state = createState();
  const remote = {
    id: "remote-1",
    source_id: "local-inspection-144",
    updated_at: "2026-08-29T13:00:00.000Z",
    reinspection_of_id: "remote-parent",
    inspection_data_json: state.inspection
  };

  const hydrated = sync.hydrateFromRemoteInspection(remote);
  assert.equal(hydrated.inspection.items.length, 144);
  assert.equal(hydrated.inspection.sync.backendInspectionId, "remote-1");
  assert.equal(hydrated.inspection.reinspection_of_id, "remote-parent");

  const current = createState();
  const maybe = sync.maybeHydrateRemote(current, remote, {});
  assert.equal(maybe.applied, false);
  assert.equal(maybe.reason, "local_state_preserved");
  assert.equal(maybe.state, current);
});
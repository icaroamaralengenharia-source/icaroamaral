"use strict";

// Isolated fixtures only: no HTTP server, browser, external API or real credential.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const { test, after } = require("node:test");

const root = path.resolve(__dirname, "..");
const bridgePath = path.join(__dirname, "elo-command-bridge.js");
const bridgeSource = fs.readFileSync(bridgePath, "utf8");
const authSource = fs.readFileSync(path.join(__dirname, "rdo-canonical-auth.js"), "utf8");
const WORK_ID = "work_elo_e2e_test_0e90b6f4-7997-4dd1-a100-fb6f2ae773c2";
const WORK_NAME = "OBRA TESTE ELO E2E";
const NATURAL_CREATE = "Crie um RDO na OBRA TESTE ELO E2E de 15/10/2026.";
const CATALOG_TAG = "20261015-rdo-commercial-audit-v2";
const ROUTING_TAG = "20261015-rdo-commercial-audit-v2";
const CACHE_KEY = "obrareport-saas-v1";
const PENDING_KEY = "elo_action_bus_rdo_pending_v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const outcomes = [];
let integratedPreview = null;

function scenario(name, run) {
  return test(name, { timeout: 5000 }, async () => {
    try {
      await run();
      outcomes.push({ name, result: "PASS" });
    } catch (error) {
      outcomes.push({ name, result: "FAIL" });
      throw error;
    }
  });
}

function actor(suffix, institutionId = "fixture_tenant_current") {
  return {
    // These strings are synthetic fixture identifiers, never real bearer credentials.
    credential: "synthetic-fixture-access-" + suffix,
    authContext: {
      userId: "fixture_user_" + suffix,
      institutionId,
      companyId: institutionId,
      role: "admin"
    }
  };
}

const CURRENT = actor("current");
const OTHER = actor("other", "fixture_tenant_other");

function work(id = WORK_ID, name = WORK_NAME, institutionId = CURRENT.authContext.institutionId) {
  return { id, projectId: id, workId: id, name, institutionId, clientId: "fixture_client", address: "Endereço sintético" };
}

function rdo(id, projectId = WORK_ID, date = "2026-10-15", data = {}) {
  return {
    id,
    institution_id: CURRENT.authContext.institutionId,
    project_id: projectId,
    rdo_date: date,
    title: "RDO sintético de integração",
    status: "draft",
    rdo_data_json: Object.assign({ date }, data),
    created_at: date + "T12:00:00.000Z",
    updated_at: date + "T12:00:00.000Z"
  };
}

function storage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function response(status, body, invalidJson = false) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      if (invalidJson) throw new SyntaxError("Synthetic invalid JSON");
      return clone(body);
    }
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function runtime(options = {}) {
  const localStorage = storage(options.storage);
  const calls = [];
  const records = clone(options.rdos || []);
  const created = [];
  const updated = [];
  const generated = [];
  const serverIdempotency = new Map();
  const actors = new Map([CURRENT, OTHER, ...(options.actors || [])].map((value) => ["Bearer " + value.credential, value]));
  let current = options.actor === undefined ? clone(CURRENT) : clone(options.actor);
  let providerPresent = options.providerPresent !== false;

  const canonicalProvider = {
    async getSession() {
      return current ? { ok: true, accessToken: current.credential, authContext: clone(current.authContext) } : { ok: false, error: "authentication_required" };
    },
    async getValidAccessToken() { return current ? current.credential : ""; }
  };

  async function fakeFetch(rawUrl, init = {}) {
    // This function handles every request itself. It never delegates to native fetch.
    const url = new URL(String(rawUrl));
    assert.ok(url.origin === "https://obrareport-backend.onrender.com", "RDO uses the official backend origin");
    const method = String(init.method || "GET").toUpperCase();
    const call = { method, pathname: url.pathname, query: Object.fromEntries(url.searchParams), body: init.body ? JSON.parse(init.body) : null, cache: init.cache };
    calls.push(call);
    const authenticated = actors.get(init.headers && init.headers.Authorization);
    if (!authenticated) return response(401, { ok: false, error: "synthetic_invalid_auth" });
    const tenant = authenticated.authContext.institutionId;

    if (url.pathname === "/api/stock-full/works" && method === "GET") {
      if (options.catalogHook) {
        const hooked = await options.catalogHook({ actor: authenticated, call, ordinal: calls.filter((item) => item.pathname === url.pathname).length });
        if (hooked) return hooked;
      }
      const catalog = options.catalogs ? options.catalogs[tenant] || [] : options.works === undefined ? [work()] : options.works;
      return response(options.catalogStatus || 200, options.catalogBody || { ok: true, works: catalog }, options.catalogInvalidJson);
    }

    if (url.pathname === "/api/obrareport/rdos" && method === "POST") {
      const key = call.body.rdoData.operationId;
      if (serverIdempotency.has(key)) return response(201, { ok: true, rdo: serverIdempotency.get(key) });
      const row = rdo("obr_rdo_synthetic_" + (created.length + 1), call.body.projectId, call.body.rdoDate, call.body.rdoData);
      row.institution_id = tenant;
      row.title = call.body.title;
      records.push(row);
      created.push(row);
      serverIdempotency.set(key, row);
      return response(201, { ok: true, rdo: row });
    }

    if (url.pathname === "/api/obrareport/rdos" && method === "GET") {
      const projectId = url.searchParams.get("projectId");
      return response(200, { ok: true, rdos: records.filter((row) => row.institution_id === tenant && (!projectId || row.project_id === projectId)) });
    }

    const generation = url.pathname.match(/^\/api\/obrareport\/rdos\/([^/]+)\/generate-document$/);
    if (generation && method === "POST") {
      const row = records.find((entry) => entry.id === generation[1] && entry.institution_id === tenant);
      if (!row) return response(404, { ok: false, error: "rdo_not_found" });
      generated.push({ rdoId: row.id, workId: call.body.workId, key: call.body.idempotencyKey });
      return response(201, { ok: true, document: { id: "synthetic_doc_" + generated.length, rdo_id: row.id, work_id: row.project_id, document_type: "rdo_pdf" } });
    }

    const detail = url.pathname.match(/^\/api\/obrareport\/rdos\/([^/]+)$/);
    if (detail) {
      const index = records.findIndex((entry) => entry.id === detail[1] && entry.institution_id === tenant);
      if (index < 0) return response(404, { ok: false, error: "rdo_not_found" });
      if (method === "GET") return response(200, { ok: true, rdo: records[index] });
      if (method === "PUT") {
        const row = Object.assign({}, records[index], {
          rdo_data_json: clone(call.body.rdoData),
          status: call.body.status,
          updated_at: "2026-10-15T12:00:" + String(updated.length + 1).padStart(2, "0") + ".000Z"
        });
        records[index] = row;
        updated.push(row);
        return response(200, { ok: true, rdo: row });
      }
    }
    throw new Error("Unexpected synthetic request route: " + method + " " + url.pathname);
  }

  const sandbox = {
    URL, URLSearchParams, Blob,
    console: { log() {}, info() {}, warn() {}, error() {} },
    window: {
      location: { hostname: "www.icaroamaral.com.br", protocol: "https:" },
      ELO_API_BASE_URL: "https://unrelated-elo.invalid",
      OBRAREPORT_API_BASE_URL: "https://obrareport-backend.onrender.com",
      localStorage,
      sessionStorage: storage(),
      fetch: fakeFetch
    }
  };
  sandbox.window.window = sandbox.window;
  if (providerPresent) sandbox.window.EloCanonicalSession = canonicalProvider;
  vm.createContext(sandbox);
  vm.runInContext(authSource, sandbox, { filename: "rdo-canonical-auth.js" });
  vm.runInContext(bridgeSource, sandbox, { filename: "elo-command-bridge.js" });
  const bus = sandbox.window.EloActionBusRdo;
  return {
    bus, calls, records, created, updated, generated, localStorage,
    setActor(value) { current = value ? clone(value) : null; },
    installCanonicalProvider() { providerPresent = true; sandbox.window.EloCanonicalSession = canonicalProvider; },
    async execute(action, payload = {}, context = {}) { return bus.execute({ module: "obrareport_rdo", action, payload, context }); },
    async preview(message = NATURAL_CREATE) { return bus.execute({ module: "obrareport_rdo", action: "preview_new_rdo", payload: { message } }); },
    writes() { return calls.filter((call) => call.method === "POST" || call.method === "PUT" || call.method === "DELETE"); },
    catalogReads() { return calls.filter((call) => call.method === "GET" && call.pathname === "/api/stock-full/works"); }
  };
}

function assertPreview(result, expectedId = WORK_ID) {
  assert.equal(result.ok, true, result.error || "preview succeeds");
  assert.equal(result.action, "rdo.create.preview");
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.data.draft.projectId, expectedId);
  assert.equal(result.data.draft.workId, expectedId);
  assert.equal(result.data.draft.rdoDate, "2026-10-15");
  assert.equal(result.data.draft.source, "stock_full_api");
  assert.equal(result.data.pending.status, "pending");
  assert.match(result.preview, /Ainda não salvei\. Deseja confirmar\?/);
  assert.doesNotMatch(result.preview, /PROJECT ID|ENTITY TYPE|WRITE EXECUTED|operationId/);
}

scenario("natural exact command resolves canonical work with completely empty local cache and zero writes", async () => {
  const env = runtime();
  const parsed = env.bus.parseIntent({ action: "preview_new_rdo", payload: { message: NATURAL_CREATE } });
  assert.equal(parsed.workName, WORK_NAME);
  assert.equal(parsed.targetDate, "2026-10-15");
  assert.equal(env.localStorage.getItem(CACHE_KEY), null);
  const result = await env.preview();
  assertPreview(result);
  assert.equal(env.catalogReads().length, 1);
  assert.equal(env.catalogReads()[0].cache, "no-store");
  assert.equal(env.writes().length, 0);
  assert.equal(env.localStorage.getItem(CACHE_KEY), null);
});

scenario("old-tenant local cache never overrides current canonical work or gets rewritten", async () => {
  const stale = JSON.stringify({ version: 1, works: [work("old_tenant_work", WORK_NAME, OTHER.authContext.institutionId)] });
  const env = runtime({ storage: { [CACHE_KEY]: stale } });
  assertPreview(await env.preview());
  assert.equal(env.localStorage.getItem(CACHE_KEY), stale);
  assert.equal(env.writes().length, 0);
});

scenario("same-tenant stale name/id cache is ignored in favor of fresh cloud id", async () => {
  const stale = JSON.stringify({ version: 1, works: [work("stale_same_tenant_id")] });
  const env = runtime({ storage: { [CACHE_KEY]: stale } });
  const result = await env.preview();
  assertPreview(result);
  assert.doesNotMatch(JSON.stringify(result), /stale_same_tenant_id/);
});

scenario("exact work name selects its canonical id among unrelated cloud works", async () => {
  const env = runtime({ works: [work("another_work", "OBRA SECUNDÁRIA"), work()] });
  assertPreview(await env.preview());
  assert.equal(env.writes().length, 0);
});

scenario("empty canonical catalog stays empty even when local cache contains requested work", async () => {
  const env = runtime({ works: [], storage: { [CACHE_KEY]: JSON.stringify({ version: 1, works: [work()] }) } });
  const result = await env.preview();
  assert.equal(result.ok, false);
  assert.equal(result.error, "no_works");
  assert.equal(env.writes().length, 0);
});

scenario("missing cloud work is blocked without inventing a project", async () => {
  const env = runtime({ works: [work("other_real_work", "OUTRA OBRA REAL")] });
  const result = await env.preview();
  assert.equal(result.ok, false);
  assert.equal(result.error, "work_not_found");
  assert.equal(env.writes().length, 0);
});

scenario("multiple matching cloud works require selection and do not write", async () => {
  const env = runtime({ works: [work("block_a", WORK_NAME + " BLOCO A"), work("block_b", WORK_NAME + " BLOCO B")] });
  const result = await env.preview();
  assert.equal(result.ok, false);
  assert.equal(result.error, "ambiguous_work");
  assert.equal(env.writes().length, 0);
});

scenario("cross-tenant cloud row is rejected before a preview or write", async () => {
  const env = runtime({ works: [work("foreign_work", WORK_NAME, OTHER.authContext.institutionId)] });
  const result = await env.preview();
  assert.equal(result.ok, false);
  assert.equal(result.error, "rdo_work_catalog_scope_mismatch");
  assert.equal(result.data, null);
  assert.doesNotMatch(JSON.stringify(result), /foreign_work/);
  assert.equal(env.writes().length, 0);
});

for (const status of [401, 403, 500, 503]) {
  scenario("catalog HTTP " + status + " fails closed without local fallback", async () => {
    const env = runtime({ catalogStatus: status, catalogBody: { ok: false, error: "synthetic_private_provider_error" }, storage: { [CACHE_KEY]: JSON.stringify({ version: 1, works: [work()] }) } });
    const result = await env.preview();
    assert.equal(result.ok, false);
    assert.equal(result.error, "rdo_work_catalog_unavailable");
    assert.equal(result.data, null);
    assert.doesNotMatch(JSON.stringify(result), /synthetic_private_provider_error/);
    assert.equal(env.writes().length, 0);
  });
}

for (const fixture of [
  { label: "invalid JSON", options: { catalogInvalidJson: true } },
  { label: "missing works array", options: { catalogBody: { ok: true } } },
  { label: "duplicate ids", options: { works: [work(), work()] } },
  { label: "missing institution", options: { works: [Object.assign(work(), { institutionId: "" })] } },
  { label: "mismatched project alias", options: { works: [Object.assign(work(), { projectId: "different_id" })] } }
]) {
  scenario("catalog schema rejects " + fixture.label, async () => {
    const env = runtime(fixture.options);
    const result = await env.preview();
    assert.equal(result.ok, false);
    assert.equal(result.error, "rdo_work_catalog_invalid_response");
    assert.equal(env.writes().length, 0);
  });
}

scenario("absent canonical session does not accept legacy/context credentials or call catalog", async () => {
  const env = runtime({ providerPresent: false, storage: { obrareport_access_token: "synthetic-legacy-only", [CACHE_KEY]: JSON.stringify({ version: 1, works: [work()] }) } });
  const result = await env.execute("preview_new_rdo", { message: NATURAL_CREATE }, { authToken: "synthetic-context-only", institutionId: CURRENT.authContext.institutionId, userId: CURRENT.authContext.userId });
  assert.equal(result.ok, false);
  assert.equal(result.requiresAuth, true);
  assert.equal(env.calls.length, 0);
  await assert.rejects(env.bus.resolveExistingWorks(), /authentication_required/);
});

scenario("invalid canonical bearer cannot turn a cached work into an authorized preview", async () => {
  const env = runtime({ actor: Object.assign(clone(CURRENT), { credential: "synthetic-invalid-bearer" }), storage: { [CACHE_KEY]: JSON.stringify({ version: 1, works: [work()] }) } });
  const result = await env.preview();
  assert.equal(result.ok, false);
  assert.equal(result.error, "rdo_work_catalog_unavailable");
  assert.equal(env.catalogReads().length, 1);
  assert.equal(env.writes().length, 0);
});

scenario("canonical provider installed after bridge boot resolves works on the later request", async () => {
  const env = runtime({ providerPresent: false });
  const first = await env.preview();
  assert.equal(first.requiresAuth, true);
  assert.equal(env.calls.length, 0);
  env.installCanonicalProvider();
  assertPreview(await env.preview());
  assert.equal(env.catalogReads().length, 1);
  assert.equal(env.writes().length, 0);
});

scenario("own RDO canonical session can resolve cloud works while unrelated ELO identity is stale", async () => {
  const ownSession = {
    session: { access_token: CURRENT.credential, expires_at: Math.floor(Date.now() / 1000) + 3600 },
    user: { id: CURRENT.authContext.userId },
    profile: { institution_id: CURRENT.authContext.institutionId }
  };
  const env = runtime({ actor: OTHER, storage: { "obrareport-rdo-stock-canonical-session-v1": JSON.stringify(ownSession) } });
  assertPreview(await env.preview());
  assert.equal(env.writes().length, 0);
});

scenario("public resolveExistingWorks returns a fresh Promise of mapped canonical work entities", async () => {
  const env = runtime();
  const pending = env.bus.resolveExistingWorks();
  assert.equal(typeof pending.then, "function");
  const works = await pending;
  assert.equal(works.length, 1);
  assert.equal(works[0].id, WORK_ID);
  assert.equal(works[0].projectId, WORK_ID);
  assert.equal(works[0].workId, WORK_ID);
  assert.equal(works[0].entityType, "work");
  assert.equal(works[0].source, "stock_full_api");
  works[0].name = "MUTATED BY CALLER";
  const fresh = await env.bus.resolveExistingWorks();
  assert.equal(fresh[0].name, WORK_NAME);
  assert.equal(env.catalogReads().length, 2);
  assert.equal(env.localStorage.getItem(CACHE_KEY), null);
});

scenario("two explicit confirmations create one synthetic RDO and keep the same id", async () => {
  const env = runtime();
  assertPreview(await env.preview());
  assert.equal(env.writes().length, 0);
  const first = await env.execute("rdo_confirm", { message: "sim" });
  const again = await env.execute("rdo_confirm", { message: "sim" });
  assert.equal(first.ok, true);
  assert.equal(again.ok, true);
  assert.equal(first.data.rdo.id, again.data.rdo.id);
  assert.equal(env.created.length, 1);
  assert.equal(env.calls.filter((call) => call.method === "POST" && call.pathname === "/api/obrareport/rdos").length, 1);
});

scenario("tenant switch during catalog GET blocks old result and preserves new tenant pending", async () => {
  const entered = deferred();
  const release = deferred();
  const options = {
    catalogs: {
      [CURRENT.authContext.institutionId]: [work()],
      [OTHER.authContext.institutionId]: [work("work_other_current", WORK_NAME, OTHER.authContext.institutionId)]
    },
    async catalogHook({ actor: requesting }) {
      if (requesting.authContext.institutionId === CURRENT.authContext.institutionId) {
        entered.resolve();
        await release.promise;
      }
    }
  };
  const env = runtime(options);
  const oldRequest = env.preview();
  await entered.promise;
  env.setActor(OTHER);
  const newer = await env.preview();
  assertPreview(newer, "work_other_current");
  const currentPending = env.localStorage.getItem(PENDING_KEY);
  release.resolve();
  const oldResult = await oldRequest;
  assert.equal(oldResult.ok, false);
  assert.equal(oldResult.error, "rdo_tenant_changed");
  assert.equal(oldResult.data, null);
  assert.equal(env.localStorage.getItem(PENDING_KEY), currentPending);
  assert.equal(env.writes().length, 0);
});

scenario("session expiry while cloud catalog is pending blocks preview without data leakage", async () => {
  const entered = deferred();
  const release = deferred();
  const env = runtime({ async catalogHook() { entered.resolve(); await release.promise; } });
  const pending = env.preview();
  await entered.promise;
  env.setActor(null);
  release.resolve();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.error, "rdo_tenant_changed");
  assert.equal(result.data, null);
  assert.equal(env.writes().length, 0);
});

scenario("named work GET and PDF use canonical catalog and the requested persisted RDO", async () => {
  const target = rdo("obr_rdo_named_fixture");
  const unrelated = rdo("obr_rdo_other_fixture", "another_project");
  const env = runtime({ rdos: [unrelated, target] });
  const message = "Abra o RDO da OBRA TESTE ELO E2E de 15/10/2026";
  const opened = await env.execute("rdo.get", { message });
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.data.rdo.id, target.id);
  const list = env.calls.find((call) => call.pathname === "/api/obrareport/rdos");
  assert.equal(list.query.projectId, WORK_ID);
  assert.equal(env.writes().length, 0);
  const pdf = await env.execute("rdo.generateDocument", { message: "Gere o PDF do RDO da OBRA TESTE ELO E2E de 15/10/2026" });
  assert.equal(pdf.ok, true, pdf.error);
  assert.equal(pdf.data.rdo.id, target.id);
  assert.equal(pdf.data.document.rdo_id, target.id);
  assert.equal(env.generated[0].workId, WORK_ID);
  assert.equal(env.generated[0].key, "rdo:" + target.id + ":pdf:" + target.updated_at);
  assert.equal(env.created.length, 0);
  assert.equal(env.updated.length, 0);
});

scenario("integrated create add correct reload readback preserves standalone and one canonical RDO id", async () => {
  const standalone = rdo("obr_rdo_standalone_fixture", WORK_ID, "2026-10-14", { summary: "STANDALONE FIXTURE PRESERVED" });
  const snapshot = JSON.stringify(standalone);
  const staleCache = JSON.stringify({ version: 1, works: [work("stale_legacy_work", WORK_NAME, OTHER.authContext.institutionId)] });
  const env = runtime({ rdos: [standalone], storage: { [CACHE_KEY]: staleCache } });
  const preview = await env.preview();
  assertPreview(preview);
  const previewWrites = env.writes().length;
  assert.equal(previewWrites, 0);
  const created = await env.execute("rdo_confirm", { message: "sim" });
  assert.equal(created.ok, true, created.error);
  const id = created.data.rdo.id;
  const addition = await env.execute("rdo.update.preview", { message: "Acrescente ao RDO produção de Alvenaria: 12 m²; equipe: 4 funcionários; observação: ELO_PUBLIC_HOTFIX_20261015 — registro sintético, sem execução física." });
  assert.equal(addition.ok, true, addition.error);
  assert.equal(addition.data.draft.rdoId, id);
  const added = await env.execute("rdo_confirm", { message: "sim" });
  assert.equal(added.ok, true, added.error);
  const productionId = added.data.rdo.rdo_data_json.productions[0].id;
  const correction = await env.execute("rdo.update.preview", { message: "Corrija no RDO a quantidade da produção de Alvenaria de 12 m² para 15 m²; equipe de 4 para 5 funcionários." });
  assert.equal(correction.ok, true, correction.error);
  const corrected = await env.execute("rdo_confirm", { message: "sim" });
  assert.equal(corrected.ok, true, corrected.error);
  const repeated = await env.execute("rdo_confirm", { message: "sim" });
  assert.equal(repeated.data.rdo.id, id);
  assert.equal(env.created.length, 1);
  assert.equal(env.updated.length, 2);
  const persisted = env.records.find((row) => row.id === id);
  assert.equal(persisted.project_id, WORK_ID);
  assert.equal(persisted.rdo_date, "2026-10-15");
  assert.equal(persisted.rdo_data_json.productions[0].id, productionId);
  assert.equal(persisted.rdo_data_json.productions[0].quantity, 15);
  assert.equal(persisted.rdo_data_json.employeeCount, "5");
  assert.match(persisted.rdo_data_json.generalNotes, /registro sintético, sem execução física/);
  assert.equal(JSON.stringify(env.records.find((row) => row.id === standalone.id)), snapshot);
  assert.equal(env.localStorage.getItem(CACHE_KEY), staleCache);
  const reloaded = runtime({ rdos: env.records, storage: env.localStorage.snapshot() });
  const readback = await reloaded.execute("rdo.get", { message: "Abra o RDO da OBRA TESTE ELO E2E de 15/10/2026" });
  assert.equal(readback.ok, true, readback.error);
  assert.equal(readback.data.rdo.id, id);
  assert.equal(readback.data.rawRdo.rdo_data_json.productions[0].quantity, 15);
  assert.equal(readback.data.rawRdo.rdo_data_json.employeeCount, "5");
  assert.equal(reloaded.writes().length, 0);
  integratedPreview = {
    naturalCommand: NATURAL_CREATE,
    authoritativeSource: "stock_full_api",
    selectedCanonicalWorkId: WORK_ID,
    selectedWorkName: WORK_NAME,
    selectedDate: "2026-10-15",
    preview: { result: "PASS", requiresConfirmation: preview.requiresConfirmation, postCount: previewWrites, putCount: 0 },
    syntheticFlow: { result: "PASS", syntheticRdoId: id, createdRecords: env.created.length, confirmedUpdates: env.updated.length, sameRdoId: true, productionItemIdPreserved: true, finalProductionQuantity: 15, finalProductionUnit: "m²", finalEmployeeCount: 5, standalonePreserved: true, sharedLocalCacheUnchanged: true, reloadedReadback: "PASS" },
    requests: env.calls.concat(reloaded.calls).map((call) => ({ method: call.method, path: call.pathname })),
    liveNetworkRequests: 0
  };
});

scenario("public HTML embedded HTML service worker precache and registration share new catalog cache tag", async () => {
  const publicHtml = fs.readFileSync(path.join(root, "elo.html"), "utf8");
  const embeddedHtml = fs.readFileSync(path.join(__dirname, "relatorio-qualidade-obras.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "elo-sw.js"), "utf8");
  for (const source of [publicHtml, embeddedHtml, worker]) {
    const match = source.match(/elo-command-bridge\.js\?v=([^"'\s]+)/);
    assert.ok(match, "bridge version is present");
    assert.equal(match[1], CATALOG_TAG);
    const assistant = source.match(/elo-assistente\.js\?v=([^"'\s]+)/);
    assert.ok(assistant, "assistant version is present");
    assert.equal(assistant[1], ROUTING_TAG);
  }
  assert.ok(publicHtml.includes('serviceWorker.register("./elo-sw.js?v=' + ROUTING_TAG + '")'));
  assert.ok(worker.includes('const ELO_CACHE_NAME = "elo-web-offline-v39-' + ROUTING_TAG + '"'));
});

after(() => {
  const output = process.env.ELO_PUBLIC_HOTFIX_AUDIT_DIR;
  if (!output) return;
  fs.mkdirSync(output, { recursive: true });
  const baseCommit = process.env.ELO_PUBLIC_HOTFIX_SOURCE_COMMIT;
  const report = {
    kind: "elo_public_cloud_work_resolution_synthetic_validation",
    completedAt: new Date().toISOString(),
    fixtureOnly: true,
    sourceCommit: /^[a-f0-9]{7,40}$/i.test(baseCommit || "") ? baseCommit : null,
    bridgeSha256: sha256(bridgeSource),
    testSha256: sha256(fs.readFileSync(__filename)),
    cacheTag: CATALOG_TAG,
    overallResult: outcomes.some((entry) => entry.result === "FAIL") ? "FAIL" : "PASS",
    passed: outcomes.filter((entry) => entry.result === "PASS").length,
    failed: outcomes.filter((entry) => entry.result === "FAIL").length,
    cases: outcomes,
    integratedPreview: integratedPreview || { result: "NOT_COMPLETED" },
    liveNetworkRequests: 0,
    credentialValuesIncluded: false
  };
  fs.writeFileSync(path.join(output, "integrated-preview.json"), JSON.stringify(report, null, 2) + "\n");
});

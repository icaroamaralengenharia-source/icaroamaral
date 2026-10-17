const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const bridgeSource = fs.readFileSync(path.join(__dirname, "elo-command-bridge.js"), "utf8");
const rdoSessionKey = "obrareport-rdo-stock-canonical-session-v1";

function memoryStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    snapshot: () => Object.fromEntries(values)
  };
}

function apiResponse(works) {
  return { ok: true, status: 200, json: async () => ({ ok: true, works }) };
}

function makeHarness(options = {}) {
  const initialOwn = options.ownSession === false ? null : options.ownSession || {
    session: { access_token: "token-standalone-a" },
    user: { id: "user-a", email: "a@example.test" },
    profile: { institution_id: "institution-a", company_id: "company-a" }
  };
  const localStorage = memoryStorage(initialOwn ? { [rdoSessionKey]: JSON.stringify(initialOwn) } : {});
  const sessionStorage = memoryStorage(options.sessionStorage || {});
  const calls = [];
  let core = options.core === undefined ? { userId: "user-b", institutionId: "institution-b", companyId: "company-b", token: "token-core-b" } : options.core;
  let ownFactoryCalls = 0;
  const worksForToken = options.worksForToken || ((token) => ["token-standalone-a", "token-core-a"].includes(token)
    ? [{ id: "work-a", name: "Synthetic A", institutionId: "institution-a" }]
    : [{ id: "work-b", name: "Synthetic B", institutionId: "institution-b" }]);
  const window = {
    ELO_CORE_SURFACE: options.eloCoreSurface !== false,
    OBRAREPORT_API_BASE_URL: "https://backend.example.test",
    RELATORIO_QUALIDADE_CONFIG: {},
    location: { hostname: "www.example.test", protocol: "https:" },
    localStorage,
    sessionStorage,
    ObraReportRdoCanonicalAuth: {
      create: () => {
        ownFactoryCalls += 1;
        return { getValidAccessToken: async () => {
          const stored = JSON.parse(localStorage.getItem(rdoSessionKey) || "null");
          return stored && stored.session && stored.session.access_token || "";
        } };
      }
    },
    EloCanonicalSession: options.provider === false ? null : {
      getSession: async () => core ? {
        ok: true,
        authContext: { userId: core.userId, institutionId: core.institutionId, companyId: core.companyId }
      } : { ok: false, error: "authentication_required" },
      getValidAccessToken: async () => core && core.token || ""
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (options.fetchImpl) return options.fetchImpl(url, init);
      const token = String(init.headers.Authorization || "").replace(/^Bearer\s+/i, "");
      return apiResponse(worksForToken(token));
    }
  };
  vm.runInNewContext(bridgeSource, {
    window,
    console,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout
  }, { filename: "elo-command-bridge.js" });
  return {
    window,
    calls,
    localStorage,
    sessionStorage,
    ownFactoryCalls: () => ownFactoryCalls,
    setCore: (next) => { core = next; }
  };
}

function names(works) {
  return Array.from(works, (work) => work.name);
}

function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}

test("ELO login A resolves only A's canonical works", async () => {
  const harness = makeHarness({ core: { userId: "user-a", institutionId: "institution-a", companyId: "company-a", token: "token-core-a" } });
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic A"]);
});

test("logout A and login B ignore the persisted standalone session for A", async () => {
  const harness = makeHarness();
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic B"]);
  assert.equal(harness.ownFactoryCalls(), 0);
});

test("a stale sessionStorage session for A cannot replace the current ELO session B", async () => {
  const staleSession = {
    session: { access_token: "token-standalone-a" },
    user: { id: "user-a" },
    profile: { institution_id: "institution-a", company_id: "company-a" }
  };
  const harness = makeHarness({ ownSession: false, sessionStorage: { [rdoSessionKey]: JSON.stringify(staleSession) } });
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic B"]);
  assert.equal(harness.calls[0].init.headers.Authorization, "Bearer token-core-b");
});

test("B to A switch resolves only A after the same bridge instance is reused", async () => {
  const harness = makeHarness();
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic B"]);
  harness.setCore({ userId: "user-a", institutionId: "institution-a", companyId: "company-a", token: "token-core-a" });
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic A"]);
});

test("a logged out ELO surface cannot rehydrate a prior canonical session", async () => {
  const harness = makeHarness({ core: null });
  await assert.rejects(harness.window.EloActionBusRdo.resolveExistingWorks(), /authentication_required/);
  assert.equal(harness.calls.length, 0);
});

test("ELO fails closed when its canonical session provider is unavailable", async () => {
  const harness = makeHarness({ provider: false });
  await assert.rejects(harness.window.EloActionBusRdo.resolveExistingWorks(), /authentication_required/);
  assert.equal(harness.calls.length, 0);
});

test("standalone RDO continues using its own canonical session", async () => {
  const harness = makeHarness({ eloCoreSurface: false, provider: false });
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic A"]);
  assert.equal(harness.ownFactoryCalls(), 2);
});

test("standalone RDO falls back to ELO canonical auth when no own session exists", async () => {
  const harness = makeHarness({ eloCoreSurface: false, ownSession: false });
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic B"]);
});

test("the ELO bridge sends a no-store GET for the canonical work list", async () => {
  const harness = makeHarness();
  await harness.window.EloActionBusRdo.resolveExistingWorks();
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.calls[0].init.method, "GET");
  assert.equal(harness.calls[0].init.cache, "no-store");
});

test("the request carries the current ELO user and institution bindings", async () => {
  const harness = makeHarness();
  await harness.window.EloActionBusRdo.resolveExistingWorks();
  assert.equal(harness.calls[0].init.headers.Authorization, "Bearer token-core-b");
  assert.equal(harness.calls[0].init.headers["x-institution-id"], "institution-b");
  assert.equal(harness.calls[0].init.headers["x-company-id"], "company-b");
  assert.equal(harness.calls[0].init.headers["x-user-id"], "user-b");
});

test("a work from a different institution is rejected before reaching the UI", async () => {
  const harness = makeHarness({ worksForToken: () => [{ id: "work-a", name: "Synthetic A", institutionId: "institution-a" }] });
  await assert.rejects(harness.window.EloActionBusRdo.resolveExistingWorks(), /rdo_work_catalog_scope_mismatch/);
});

test("a delayed response from A cannot finish after a switch to B", async () => {
  const gate = deferred();
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  const harness = makeHarness({ fetchImpl: async () => { started(); return gate.promise; } });
  const pending = harness.window.EloActionBusRdo.resolveExistingWorks();
  await startedPromise;
  harness.setCore({ userId: "user-a", institutionId: "institution-a", companyId: "company-a", token: "token-core-a" });
  gate.resolve(apiResponse([{ id: "work-b", name: "Synthetic B", institutionId: "institution-b" }]));
  await assert.rejects(pending, /rdo_tenant_changed/);
});

test("a delayed response from a previous user in the same tenant is rejected", async () => {
  const gate = deferred();
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  const harness = makeHarness({ fetchImpl: async () => { started(); return gate.promise; } });
  const pending = harness.window.EloActionBusRdo.resolveExistingWorks();
  await startedPromise;
  harness.setCore({ userId: "user-b2", institutionId: "institution-b", companyId: "company-b", token: "token-core-b2" });
  gate.resolve(apiResponse([{ id: "work-b", name: "Synthetic B", institutionId: "institution-b" }]));
  await assert.rejects(pending, /rdo_tenant_changed/);
});

test("a response from a replaced session of the same user is rejected", async () => {
  const gate = deferred();
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  const harness = makeHarness({ fetchImpl: async () => { started(); return gate.promise; } });
  const pending = harness.window.EloActionBusRdo.resolveExistingWorks();
  await startedPromise;
  harness.setCore({ userId: "user-b", institutionId: "institution-b", companyId: "company-b", token: "token-core-b-rotated" });
  gate.resolve(apiResponse([{ id: "work-b", name: "Synthetic B", institutionId: "institution-b" }]));
  await assert.rejects(pending, /rdo_tenant_changed/);
});

test("an empty API catalog stays empty instead of showing a previous work list", async () => {
  const harness = makeHarness({ worksForToken: () => [] });
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), []);
});

test("each resolver call refetches the API instead of reusing a prior work catalog", async () => {
  let request = 0;
  const harness = makeHarness({ worksForToken: () => ++request === 1
    ? [{ id: "work-b", name: "Synthetic B", institutionId: "institution-b" }]
    : [{ id: "work-b2", name: "Synthetic B refreshed", institutionId: "institution-b" }] });
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic B"]);
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic B refreshed"]);
  assert.equal(harness.calls.length, 2);
});

test("listing works does not write tenant data to localStorage or sessionStorage", async () => {
  const harness = makeHarness();
  const localBefore = harness.localStorage.snapshot();
  const sessionBefore = harness.sessionStorage.snapshot();
  await harness.window.EloActionBusRdo.resolveExistingWorks();
  assert.deepEqual(harness.localStorage.snapshot(), localBefore);
  assert.deepEqual(harness.sessionStorage.snapshot(), sessionBefore);
});

test("live catalog resolution performs no RDO create, update, or delete request", async () => {
  const harness = makeHarness();
  await harness.window.EloActionBusRdo.resolveExistingWorks();
  assert.deepEqual(harness.calls.map(({ init }) => init.method), ["GET"]);
  assert.equal(harness.calls.filter(({ init }) => ["POST", "PUT", "PATCH", "DELETE"].includes(init.method)).length, 0);
});

test("a failed work-list request cannot persist stale catalog state", async () => {
  const harness = makeHarness({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ ok: false }) }) });
  const before = harness.localStorage.snapshot();
  await assert.rejects(harness.window.EloActionBusRdo.resolveExistingWorks(), /rdo_work_catalog_unavailable/);
  assert.deepEqual(harness.localStorage.snapshot(), before);
});

test("a corrupted standalone session cannot replace an active ELO session", async () => {
  const harness = makeHarness({ ownSession: { session: {}, user: {}, profile: {} } });
  assert.deepEqual(names(await harness.window.EloActionBusRdo.resolveExistingWorks()), ["Synthetic B"]);
  assert.equal(harness.ownFactoryCalls(), 0);
});

test("stock work API reads bypass the service-worker cache", () => {
  const serviceWorker = fs.readFileSync(path.join(__dirname, "..", "elo-sw.js"), "utf8");
  assert.ok(serviceWorker.includes("stock-(?:full|saude)"));
  assert.match(bridgeSource, /fetch\(getRdoEndpoint\("\/api\/stock-full\/works"\), \{ method: "GET", headers: rdoHeaders\(input\), cache: "no-store" \}\)/);
});

test("ELO shell marks its auth surface before loading the command bridge", () => {
  const eloHtml = fs.readFileSync(path.join(__dirname, "..", "elo.html"), "utf8");
  assert.ok(eloHtml.indexOf("window.ELO_CORE_SURFACE = true") < eloHtml.indexOf("elo-command-bridge.js?v=20261017-ui-tenant-isolation-v1"));
});

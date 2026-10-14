import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const backendDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(backendDir, "../..");
const authSource = readFileSync(join(repoDir, "relatorio-qualidade-obras/rdo-canonical-auth.js"), "utf8");
const adapterSource = readFileSync(join(repoDir, "relatorio-qualidade-obras/rdo-cloud-adapter.js"), "utf8");
const pageSource = readFileSync(join(repoDir, "relatorio-qualidade-obras/relatorio-qualidade-obras.js"), "utf8");
const htmlSource = readFileSync(join(repoDir, "relatorio-qualidade-obras/relatorio-qualidade-obras.html"), "utf8");

function createResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function createRdoRuntime(fetchImpl, storage) {
  const window = { localStorage: storage, fetch: fetchImpl, OBRAREPORT_API_BASE_URL: "https://backend.test" };
  const sandbox = { window, globalThis: window, fetch: fetchImpl, localStorage: storage };
  vm.runInNewContext(authSource, sandbox, { filename: "rdo-canonical-auth.js" });
  vm.runInNewContext(adapterSource, sandbox, { filename: "rdo-cloud-adapter.js" });
  return window;
}

function makeAccessToken(exp) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `header.${payload}.signature`;
}

function createTokenProvider({ rdoCanonicalAuth, canonicalSession, stockSession, persistedStockToken, logs } = {}) {
  const helperStart = pageSource.indexOf("  function isUnexpiredAccessToken_(value)");
  const providerStart = pageSource.indexOf("  async function getRdoApiAccessToken_()");
  const providerEnd = pageSource.indexOf("\n  function hasStockFullBackendToken_()", providerStart);
  assert.ok(helperStart >= 0 && providerStart > helperStart && providerEnd > providerStart);
  const context = {
    window: { atob: globalThis.atob, EloCanonicalSession: canonicalSession || null },
    rdoCanonicalAuth: rdoCanonicalAuth || null,
    clean: (value) => String(value == null ? "" : value).trim(),
    getStockFullSupabaseSession_: async () => stockSession || null,
    getStockFullSupabaseToken_: () => persistedStockToken || "",
    console: { log: (...args) => logs && logs.push(args), info: (...args) => logs && logs.push(args), warn: (...args) => logs && logs.push(args), error: (...args) => logs && logs.push(args) }
  };
  const providerSource = pageSource.slice(helperStart, providerEnd);
  vm.runInNewContext(`${providerSource}\nthis.getToken = getRdoApiAccessToken_;`, context, { filename: "rdo-token-provider.js" });
  return context.getToken;
}

test("RDO login establishes its own canonical session and lists Stock works after reload", async () => {
  const storageValues = new Map();
  const storage = {
    getItem(key) { return storageValues.has(key) ? storageValues.get(key) : null; },
    setItem(key, value) { storageValues.set(key, value); },
    removeItem(key) { storageValues.delete(key); }
  };
  const calls = [];
  const now = Math.floor(Date.now() / 1000);
  const loginResponse = {
    ok: true,
    user: { id: "e2e-user", email: "admin@elo-e2e.test" },
    profile: { institution_id: "e2e-institution" },
    session: {
      access_token: "canonical-supabase-access-token",
      refresh_token: "canonical-supabase-refresh-token",
      expires_at: now + 3600,
      token_type: "bearer"
    }
  };
  const worksResponse = {
    ok: true,
    works: [{ id: "canonical-work-id", name: "OBRA TESTE ELO E2E", institution_id: "e2e-institution" }]
  };
  const loginFetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    assert.match(String(url), /\/api\/stock-full\/login$/);
    return createResponse(loginResponse);
  };

  const loginWindow = createRdoRuntime(loginFetch, storage);
  const auth = loginWindow.ObraReportRdoCanonicalAuth.create({
    baseUrl: "https://backend.test",
    storage,
    fetchImpl: loginFetch
  });
  await auth.login("admin@elo-e2e.test", "synthetic-test-password");
  assert.equal(JSON.parse(calls[0].options.body).email, "admin@elo-e2e.test");
  assert.equal(JSON.parse(calls[0].options.body).password, "synthetic-test-password");
  assert.equal(auth.hasSession(), true);
  assert.equal([...storageValues.values()].some((value) => value.includes("synthetic-test-password")), false);

  // A new page runtime reuses the RDO-owned persisted session; no Stock Full UI/session is created.
  const reloadFetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    assert.match(String(url), /\/api\/stock-full\/works$/);
    assert.equal(options.headers.Authorization, "Bearer canonical-supabase-access-token");
    return createResponse(worksResponse);
  };
  const reloadedWindow = createRdoRuntime(reloadFetch, storage);
  const reloadedAuth = reloadedWindow.ObraReportRdoCanonicalAuth.create({
    baseUrl: "https://backend.test",
    storage,
    fetchImpl: reloadFetch
  });
  const adapter = reloadedWindow.ObraReportRdoCloudAdapter.create({
    baseUrl: "https://backend.test",
    fetchImpl: reloadFetch,
    getToken: () => reloadedAuth.getValidAccessToken()
  });
  const works = await adapter.listStockWorks();

  assert.equal(works.length, 1);
  assert.equal(works[0].id, "canonical-work-id");
  assert.equal(works[0].name, "OBRA TESTE ELO E2E");
  assert.equal(calls.length, 2);
  assert.match(htmlSource, /rdo-canonical-auth\.js[\s\S]*relatorio-qualidade-obras\.js/);
  const canonicalLoginIndex = pageSource.indexOf("rdoCanonicalAuth.login(informedEmail, password)");
  const workspaceLoadIndex = pageSource.indexOf("await loadCanonicalRdoWorkspace_()", canonicalLoginIndex);
  assert.ok(canonicalLoginIndex >= 0 && workspaceLoadIndex > canonicalLoginIndex);
  const tokenProviderStart = pageSource.indexOf("async function getRdoApiAccessToken_()");
  const tokenProviderEnd = pageSource.indexOf("function hasStockFullBackendToken_()", tokenProviderStart);
  const tokenProvider = pageSource.slice(tokenProviderStart, tokenProviderEnd);
  assert.match(tokenProvider, /rdoCanonicalAuth\.hasSession\(\)[\s\S]*rdoCanonicalAuth\.getValidAccessToken\(\)/);
  assert.match(tokenProvider, /if \(isUnexpiredAccessToken_\(rdoToken\)\) return rdoToken;/);
  assert.match(tokenProvider, /const persistedStockToken = clean\(getStockFullSupabaseToken_\(\)\);[\s\S]*return isUnexpiredAccessToken_/);
  assert.ok(tokenProvider.indexOf("rdoCanonicalAuth.hasSession()") < tokenProvider.indexOf("window.EloCanonicalSession"));
});

test("token provider prefers a valid RDO session over a valid Stock session", async () => {
  const rdoToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  const stockToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  let stockLookups = 0;
  const getToken = createTokenProvider({
    rdoCanonicalAuth: { hasSession: () => true, getValidAccessToken: async () => rdoToken },
    stockSession: { get access_token() { stockLookups += 1; return stockToken; } }
  });

  assert.equal(await getToken(), rdoToken);
  assert.equal(stockLookups, 0);
});

test("token provider falls back to valid Stock session when RDO token is expired", async () => {
  const expiredRdoToken = makeAccessToken(Math.floor(Date.now() / 1000) - 60);
  const stockToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  const getToken = createTokenProvider({
    rdoCanonicalAuth: { hasSession: () => true, getValidAccessToken: async () => expiredRdoToken },
    stockSession: { access_token: stockToken }
  });

  assert.equal(await getToken(), stockToken);
});

test("token provider falls back to valid Stock session when RDO auth is invalid", async () => {
  const stockToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  const getToken = createTokenProvider({
    rdoCanonicalAuth: { hasSession: () => true, getValidAccessToken: async () => { throw new Error("expired_rdo_session"); } },
    stockSession: { access_token: stockToken }
  });

  assert.equal(await getToken(), stockToken);
});

test("token provider falls back to valid Stock session when RDO token is empty", async () => {
  const stockToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  const getToken = createTokenProvider({
    rdoCanonicalAuth: { hasSession: () => true, getValidAccessToken: async () => "" },
    stockSession: { access_token: stockToken }
  });

  assert.equal(await getToken(), stockToken);
});

test("token provider falls back to valid Stock session when no RDO session exists", async () => {
  const stockToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  const getToken = createTokenProvider({
    rdoCanonicalAuth: { hasSession: () => false, getValidAccessToken: async () => { throw new Error("must_not_be_called"); } },
    stockSession: { access_token: stockToken }
  });

  assert.equal(await getToken(), stockToken);
});

test("token provider uses a valid persisted Stock token when the Stock SDK has no session", async () => {
  const stockToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  const getToken = createTokenProvider({ persistedStockToken: stockToken });

  assert.equal(await getToken(), stockToken);
});

test("token provider uses valid RDO session when Stock token is absent", async () => {
  const rdoToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  const getToken = createTokenProvider({
    rdoCanonicalAuth: { hasSession: () => true, getValidAccessToken: async () => rdoToken }
  });

  assert.equal(await getToken(), rdoToken);
});

test("token provider returns empty when both RDO and Stock tokens are invalid", async () => {
  const expiredToken = makeAccessToken(Math.floor(Date.now() / 1000) - 60);
  const getToken = createTokenProvider({
    rdoCanonicalAuth: { hasSession: () => true, getValidAccessToken: async () => expiredToken },
    stockSession: { access_token: expiredToken },
    persistedStockToken: expiredToken
  });

  assert.equal(await getToken(), "");
});

test("token provider does not log tokens while falling back", async () => {
  const expiredToken = makeAccessToken(Math.floor(Date.now() / 1000) - 60);
  const stockToken = makeAccessToken(Math.floor(Date.now() / 1000) + 3600);
  const logs = [];
  const getToken = createTokenProvider({
    rdoCanonicalAuth: { hasSession: () => true, getValidAccessToken: async () => expiredToken },
    stockSession: { access_token: stockToken },
    logs
  });

  assert.equal(await getToken(), stockToken);
  assert.deepEqual(logs, []);
});

test("clearing RDO auth removes only its own session and preserves Stock auth", () => {
  const storageValues = new Map([
    ["sb-stock-full-backend-auth-token", JSON.stringify({ access_token: "stock-token" })]
  ]);
  const storage = {
    getItem(key) { return storageValues.has(key) ? storageValues.get(key) : null; },
    setItem(key, value) { storageValues.set(key, value); },
    removeItem(key) { storageValues.delete(key); }
  };
  const window = createRdoRuntime(async () => createResponse({}), storage);
  const auth = window.ObraReportRdoCanonicalAuth.create({
    baseUrl: "https://backend.test",
    storage,
    fetchImpl: async () => createResponse({})
  });
  storage.setItem(window.ObraReportRdoCanonicalAuth.STORAGE_KEY, JSON.stringify({ session: { access_token: "rdo-token" } }));

  auth.clear();

  assert.equal(storage.getItem(window.ObraReportRdoCanonicalAuth.STORAGE_KEY), null);
  assert.ok(storage.getItem("sb-stock-full-backend-auth-token"));
});

test("RDO canonical session refreshes an expiring bearer without opening Stock Full", async () => {
  const storageValues = new Map();
  const storage = {
    getItem(key) { return storageValues.has(key) ? storageValues.get(key) : null; },
    setItem(key, value) { storageValues.set(key, value); },
    removeItem(key) { storageValues.delete(key); }
  };
  let currentTime = 1_800_000_000_000;
  const fetchCalls = [];
  const fetchImpl = async (url, options = {}) => {
    fetchCalls.push({ url: String(url), options });
    if (String(url).endsWith("/api/stock-full/login")) {
      return createResponse({
        ok: true,
        user: { id: "e2e-user", email: "admin@elo-e2e.test" },
        profile: { institution_id: "e2e-institution" },
        session: { access_token: "about-to-expire", refresh_token: "refresh-once", expires_at: currentTime / 1000 + 20 }
      });
    }
    assert.match(String(url), /\/auth\/v1\/token\?grant_type=refresh_token$/);
    assert.equal(options.headers.apikey, "public-anon-key");
    return createResponse({ access_token: "refreshed-access", refresh_token: "rotated-refresh", expires_in: 3600 });
  };
  const window = createRdoRuntime(fetchImpl, storage);
  const auth = window.ObraReportRdoCanonicalAuth.create({
    baseUrl: "https://backend.test",
    supabaseUrl: "https://supabase.test",
    anonKey: "public-anon-key",
    storage,
    fetchImpl,
    now: () => currentTime
  });
  await auth.login("admin@elo-e2e.test", "synthetic-test-password");
  currentTime += 1000;

  assert.equal(await auth.getValidAccessToken(), "refreshed-access");
  const persisted = JSON.parse(storageValues.get(window.ObraReportRdoCanonicalAuth.STORAGE_KEY));
  assert.equal(persisted.session.refresh_token, "rotated-refresh");
  assert.equal(fetchCalls.length, 2);
});

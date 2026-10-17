"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const AUTH_KEY = "sb-elo-core-auth-token";
const RDO_KEY = "obrareport-rdo-stock-canonical-session-v1";
const PENDING_KEY = "elo_action_bus_rdo_pending_v1";
const ISSUER = "https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1";
const backend = "https://obrareport-backend.onrender.com";
const actor = name => ({ userId: "fixture-user-" + name, institutionId: "fixture-tenant-" + name, companyId: "fixture-tenant-" + name, role: "gestor", profile: { id: "fixture-user-" + name, institution_id: "fixture-tenant-" + name, email: name.toLowerCase() + "@session.fixture.test", role: "gestor" } });
const jwt = (name, seconds = 3600) => [Buffer.from('{"alg":"none"}').toString("base64url"), Buffer.from(JSON.stringify({ iss: ISSUER, sub: actor(name).userId, exp: Math.floor(Date.now() / 1000) + seconds })).toString("base64url"), "fixture"].join(".");
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const copy = x => JSON.parse(JSON.stringify(x));
function store() { const data = new Map(); return { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }; }
function ownSession(name, expires = 3600) { const a = actor(name); return { user: { id: a.userId, email: a.profile.email }, profile: { institution_id: a.institutionId }, session: { access_token: jwt(name, expires), refresh_token: "fixture-refresh-" + name, expires_at: Math.floor(Date.now() / 1000) + expires } }; }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

function runtime(options = {}) {
  const localStorage = store(), sessionStorage = store(), calls = [];
  const document = {
    readyState: "complete", body: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} } },
    querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }, addEventListener() {},
    createDocumentFragment() { return { appendChild() {} }; },
    createElement() { return { dataset: {}, style: {}, children: [], classList: { add() {}, remove() {}, contains() { return false; } }, appendChild(c) { this.children.push(c); return c; }, addEventListener() {}, remove() {}, setAttribute() {}, querySelector() { return null; } }; }
  };
  function tokenActor(headers) {
    const token = String(headers && (headers.Authorization || headers.authorization) || "").replace(/^Bearer /, "");
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return payload.sub.endsWith("B") ? "B" : "A";
  }
  const fetch = async (raw, init = {}) => {
    const url = new URL(String(raw)), method = init.method || "GET";
    calls.push({ path: url.pathname, method, headers: init.headers });
    if (url.pathname === "/auth/v1/token") {
      const body = JSON.parse(init.body);
      if (url.searchParams.get("grant_type") === "refresh_token") {
        if (options.refresh) return options.refresh(body);
        return response({ ...ownSession(body.refresh_token.endsWith("B") ? "B" : "A").session });
      }
      const name = body.email === actor("B").profile.email ? "B" : "A";
      if (options.login) { const override = await options.login(name); if (override) return override; }
      return response({ ...ownSession(name).session, user: { id: actor(name).userId, email: actor(name).profile.email } });
    }
    if (url.pathname === "/auth/v1/user") { const a = actor(tokenActor(init.headers)); return response({ id: a.userId, email: a.profile.email }); }
    if (url.pathname === "/api/elo/identity/merge") {
      const name = tokenActor(init.headers);
      if (options.merge) { const override = await options.merge(name); if (override) return override; }
      return response({ ok: true, authContext: actor(name) });
    }
    if (url.pathname === "/api/stock-full/works") {
      assert.equal(method, "GET");
      const name = tokenActor(init.headers), a = actor(name);
      if (options.works) await options.works(name);
      return response({ ok: true, works: [{ id: "fixture-work-" + name, name: "QA WORK " + name, institutionId: a.institutionId }] });
    }
    assert.ok(!url.pathname.startsWith("/api/obrareport/rdos") || method === "GET", "RDO writes prohibited in session regression tests");
    return response({ ok: true, memories: [], conversations: [] });
  };
  const quiet = { log() {}, info() {}, warn() {}, error() {} };
  const window = {
    ELO_SKIP_AUTO_WIDGET: true, ELO_PRODUCT_MODE: true, ELO_STANDALONE_MODE: true,
    ELO_API_BASE_URL: backend, OBRAREPORT_API_BASE_URL: backend,
    ELO_SUPABASE_URL: ISSUER.replace("/auth/v1", ""), ELO_SUPABASE_ANON_KEY: "public-fixture-key",
    location: { hostname: "www.icaroamaral.com.br", protocol: "https:", pathname: "/elo.html", hash: "" },
    localStorage, sessionStorage, document, console: quiet, crypto: { randomUUID: () => "session-fixture-" + Math.random() },
    navigator: { onLine: true, userAgent: "session-regression-fixture" },
    atob: v => Buffer.from(String(v), "base64").toString("binary"), btoa: v => Buffer.from(String(v), "binary").toString("base64"),
    addEventListener() {}, removeEventListener() {}, setTimeout() { return 0; }, clearTimeout() {}, fetch
  };
  window.window = window;
  const sandbox = vm.createContext({ window, globalThis: window, document, navigator: window.navigator, console: quiet, Date, Math, URL, URLSearchParams, Blob, fetch, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout });
  for (const name of ["rdo-canonical-auth.js", "elo-command-bridge.js", "elo-assistente.js"]) {
    const source = process.env.RDO_SESSION_BASELINE_REF ? execFileSync("git", ["show", process.env.RDO_SESSION_BASELINE_REF + ":relatorio-qualidade-obras/" + name], { maxBuffer: 32 * 1024 * 1024 }).toString() : fs.readFileSync(path.join(__dirname, name), "utf8");
    vm.runInContext(source, sandbox, { filename: name });
  }
  return {
    window, localStorage, sessionStorage, calls, elo: window.EloAssistente,
    seedOwn(name, seconds) { localStorage.setItem(RDO_KEY, JSON.stringify(ownSession(name, seconds))); },
    active(name) {
      window.ELO_AUTH_CONTEXT = actor(name);
      window.EloCanonicalSession = { getContext: () => actor(name), getAccessToken: () => jwt(name), getSession: async () => ({ ok: true, accessToken: jwt(name), authContext: actor(name) }), getValidAccessToken: async () => jwt(name) };
    },
    preview(name) { return window.EloActionBusRdo.execute({ action: "rdo.create.preview", payload: { message: "Prepare um RDO de 16/10/2026 para a obra QA WORK " + name + ". Não salve." } }); },
    pending() { return window.EloActionBusRdo.readPending(); },
    noWrites() { assert.equal(calls.filter(c => c.path.startsWith("/api/obrareport/rdos") && c.method !== "GET").length, 0); }
  };
}

test("active B cannot use a stored standalone session A for its preview", async () => {
  const env = runtime(); env.seedOwn("A"); env.active("B");
  const result = await env.preview("B");
  assert.equal(result.ok, true); assert.equal(env.pending().draft.projectName, "QA WORK B");
  assert.equal(env.pending().identity.userId, actor("B").userId);
  assert.ok(env.calls.filter(c => c.path.endsWith("/works")).every(c => c.headers["x-user-id"] === actor("B").userId)); env.noWrites();
});

test("same user with a different active tenant cannot reuse the stored tenant", async () => {
  const env = runtime(); const stale = ownSession("A"); stale.user.id = actor("B").userId;
  env.localStorage.setItem(RDO_KEY, JSON.stringify(stale)); env.active("B");
  await env.preview("B"); assert.equal(env.pending().identity.institutionId, actor("B").institutionId); env.noWrites();
});

test("logout removes standalone authority and pending from another conversation", async () => {
  const env = runtime(); env.seedOwn("A"); env.window.ELO_AUTH_CONTEXT = actor("A");
  await env.preview("A"); const pending = copy(env.pending()); pending.conversationToken = "other-conversation";
  env.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  env.localStorage.setItem("elo_action_bus_rdo_context_v1", "{}"); env.sessionStorage.setItem(RDO_KEY, JSON.stringify(ownSession("A")));
  env.localStorage.setItem("unrelated-preference", "preserved");
  await env.elo.logoutSupabaseForTest();
  assert.equal(env.localStorage.getItem(RDO_KEY), null); assert.equal(env.sessionStorage.getItem(RDO_KEY), null); assert.equal(env.pending(), null);
  assert.equal(env.localStorage.getItem("elo_action_bus_rdo_context_v1"), null); assert.equal(env.localStorage.getItem("unrelated-preference"), "preserved"); env.noWrites();
});

test("normal core login changes A to B and back without reusing catalog or pending", async () => {
  const env = runtime(); env.seedOwn("A"); env.window.ELO_AUTH_CONTEXT = actor("A"); await env.preview("A");
  for (const name of ["B", "A"]) {
    await env.elo.loginSupabaseForTest(actor(name).profile.email, "fixture-password");
    assert.equal(env.window.EloCanonicalSession.getContext().userId, actor(name).userId); assert.equal(env.pending(), null);
    await env.preview(name); assert.equal(env.pending().draft.projectName, "QA WORK " + name); assert.equal(env.pending().identity.userId, actor(name).userId);
    await env.elo.logoutSupabaseForTest(); assert.equal(env.pending(), null);
  }
  env.noWrites();
});

test("failed login B cannot silently retain RDO authority A", async () => {
  const env = runtime({ login: async () => response({ error: "invalid_credentials" }, 401) }); env.seedOwn("A"); env.window.ELO_AUTH_CONTEXT = actor("A");
  await assert.rejects(env.elo.loginSupabaseForTest(actor("B").profile.email, "fixture-password"));
  const result = await env.preview("A"); assert.equal(result.ok, false); assert.equal(env.localStorage.getItem(RDO_KEY), null);
  assert.equal(env.calls.filter(c => c.path.endsWith("/works")).length, 0); env.noWrites();
});

test("late identity merge A cannot replace the newer logged-in B", { timeout: 5000 }, async () => {
  const gate = deferred(), entered = deferred(); const env = runtime({ merge: async name => { if (name === "A") { entered.resolve(); await gate.promise; } } });
  const first = env.elo.loginSupabaseForTest(actor("A").profile.email, "fixture-password").catch(() => null); await entered.promise;
  await env.elo.logoutSupabaseForTest(); await env.elo.loginSupabaseForTest(actor("B").profile.email, "fixture-password"); gate.resolve(); await first;
  assert.equal(env.window.EloCanonicalSession.getContext().userId, actor("B").userId);
  assert.equal(env.window.EloCanonicalSession.getContext().profile.email, actor("B").profile.email); env.noWrites();
});

test("late standalone refresh cannot restore A over a new session B", async () => {
  const gate = deferred(), entered = deferred(); const env = runtime({ refresh: async () => { entered.resolve(); return gate.promise; } }); env.seedOwn("A", -1);
  const auth = env.window.ObraReportRdoCanonicalAuth.create({ baseUrl: backend, supabaseUrl: ISSUER.replace("/auth/v1", ""), anonKey: "public-fixture-key" });
  const pending = auth.getValidAccessToken(); await entered.promise; auth.clear(); env.seedOwn("B"); gate.resolve(response(ownSession("A").session));
  assert.equal(await pending, ""); assert.equal(JSON.parse(env.localStorage.getItem(RDO_KEY)).user.id, actor("B").userId); env.noWrites();
});

test("late core refresh failure cannot clear a newly authenticated B", { timeout: 5000 }, async () => {
  const gate = deferred(), entered = deferred(); const env = runtime({ refresh: async () => { entered.resolve(); return gate.promise; } });
  const expired = ownSession("A", -1); env.localStorage.setItem(AUTH_KEY, JSON.stringify(expired));
  const pending = env.elo.getValidAccessTokenForTest().catch(() => ""); await entered.promise;
  await env.elo.logoutSupabaseForTest(); await env.elo.loginSupabaseForTest(actor("B").profile.email, "fixture-password"); gate.resolve(response({ error: "invalid_refresh" }, 400)); await pending;
  assert.equal(env.window.EloCanonicalSession.getContext().userId, actor("B").userId); assert.equal(JSON.parse(Buffer.from((await env.elo.getValidAccessTokenForTest()).split(".")[1], "base64url").toString()).sub, actor("B").userId); env.noWrites();
});

test("standalone RDO session remains usable when no ELO identity is active", async () => {
  const env = runtime(); env.seedOwn("A"); await env.preview("A"); assert.equal(env.pending().draft.projectName, "QA WORK A"); env.noWrites();
});

test("late login A cannot replace or clear the newer login B", { timeout: 5000 }, async () => {
  const gate = deferred(), entered = deferred();
  const env = runtime({ login: async name => { if (name === "A") { entered.resolve(); await gate.promise; } } });
  const first = env.elo.loginSupabaseForTest(actor("A").profile.email, "fixture-password").catch(() => null); await entered.promise;
  await env.elo.loginSupabaseForTest(actor("B").profile.email, "fixture-password"); gate.resolve(); await first;
  assert.equal(env.window.EloCanonicalSession.getContext().userId, actor("B").userId);
  assert.equal(JSON.parse(Buffer.from((await env.elo.getValidAccessTokenForTest()).split(".")[1], "base64url").toString()).sub, actor("B").userId); env.noWrites();
});

test("catalog response A arriving after logout/login B cannot restore its preview", { timeout: 5000 }, async () => {
  const gate = deferred(), entered = deferred(); const env = runtime({ works: async name => { if (name === "A") { entered.resolve(); await gate.promise; } } });
  await env.elo.loginSupabaseForTest(actor("A").profile.email, "fixture-password");
  const oldPreview = env.preview("A"); await entered.promise;
  await env.elo.logoutSupabaseForTest(); await env.elo.loginSupabaseForTest(actor("B").profile.email, "fixture-password"); gate.resolve();
  assert.equal((await oldPreview).ok, false); assert.equal(env.pending(), null);
  await env.preview("B"); assert.equal(env.pending().draft.projectName, "QA WORK B"); env.noWrites();
});

test("login rejects a validated user that differs from the requested account", async () => {
  const env = runtime({ login: async () => response({ ...ownSession("A").session, user: { id: actor("A").userId, email: actor("A").profile.email } }) });
  await assert.rejects(env.elo.loginSupabaseForTest(actor("B").profile.email, "fixture-password"), /supabase_identity_mismatch/);
  assert.equal(env.window.EloCanonicalSession.getContext().userId, ""); assert.equal(env.localStorage.getItem(RDO_KEY), null); env.noWrites();
});

test("active ELO provider resolves its tenant before considering a stored same-user session", async () => {
  const env = runtime(); const stale = ownSession("A"); stale.user.id = actor("B").userId; env.localStorage.setItem(RDO_KEY, JSON.stringify(stale));
  env.active("B"); env.window.EloCanonicalSession.getContext = () => ({ userId: actor("B").userId });
  await env.preview("B"); assert.equal(env.pending().identity.institutionId, actor("B").institutionId); assert.equal(env.pending().draft.projectName, "QA WORK B"); env.noWrites();
});

test("invalid active ELO provider cannot fall back to a stored matching standalone session", async () => {
  const env = runtime(); env.seedOwn("A"); env.active("A"); env.window.EloCanonicalSession.getSession = async () => ({ ok: false });
  assert.equal((await env.preview("A")).ok, false); assert.equal(env.calls.filter(c => c.path.endsWith("/works")).length, 0); env.noWrites();
});

test("report surface keeps its own authenticated B session despite an unrelated ELO A session", async () => {
  const env = runtime();
  env.window.ELO_STANDALONE_MODE = false;
  env.window.location.pathname = "/relatorio-qualidade-obras/relatorio-qualidade-obras.html";
  env.window.ObraReportEloSurface = { getContext: () => ({ source: "obrareport", auth: actor("B") }) };
  env.active("A"); env.seedOwn("B");
  assert.equal((await env.preview("B")).ok, true);
  assert.equal(env.pending().identity.userId, actor("B").userId);
  assert.equal(env.pending().draft.projectName, "QA WORK B"); env.noWrites();
});

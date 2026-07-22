import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function createStorage(initial = {}) {
  const data = { ...initial };
  return {
    get length() { return Object.keys(data).length; },
    key(index) { return Object.keys(data)[index] || null; },
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    dump() { return { ...data }; }
  };
}

function createElementStub() {
  return {
    hidden: false,
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {},
    getAttribute() { return ""; },
    appendChild(child) { return child; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    textContent: "",
    innerHTML: "",
    focus() {},
    remove() {}
  };
}

function loadElo({ fetchImpl, windowOverrides = {} }) {
  const localStorage = createStorage({ elo_core_anonymous_id_v1: "elo_anon_login_test" });
  const sessionStorage = createStorage();
  const authForm = createElementStub();
  const authSession = createElementStub();
  const authUser = createElementStub();
  const authStatus = createElementStub();
  const elements = new Map([
    ["[data-elo-auth-form]", authForm],
    ["[data-elo-auth-session]", authSession],
    ["[data-elo-auth-user]", authUser],
    ["[data-elo-auth-status]", authStatus]
  ]);
  const sandbox = {
    console,
    fetch: fetchImpl,
    window: {
      ELO_SUPABASE_URL: "https://project.supabase.co",
      ELO_SUPABASE_ANON_KEY: "publishable-key",
      ELO_API_BASE_URL: "http://localhost:3000",
      ELO_SKIP_AUTO_WIDGET: true
    },
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelector(selector) { return elements.get(selector) || null; },
      querySelectorAll() { return []; },
      createElement: createElementStub,
      body: { dataset: { eloMode: "standalone", eloProduct: "chat" }, appendChild(child) { return child; } },
      documentElement: { style: { setProperty() {} } }
    },
    navigator: { userAgent: "node-test" },
    location: { hostname: "localhost", protocol: "http:", pathname: "/elo.html", search: "", hash: "" },
    localStorage,
    sessionStorage,
    crypto: { randomUUID() { return "login-test-random"; } },
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    URLSearchParams,
    FormData: class FormData {},
    Blob: class Blob {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} }
  };
  Object.assign(sandbox.window, windowOverrides);
  sandbox.window = Object.assign(sandbox.window, sandbox);
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync("relatorio-qualidade-obras/elo-assistente.js", "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { elo: sandbox.window.EloAssistente, localStorage, sessionStorage, authForm, authSession, authUser, authStatus };
}

test("ELO frontend login Supabase salva sessao, envia Bearer no merge e logout limpa", async () => {
  const calls = [];
  const { elo, localStorage, sessionStorage, authSession, authUser, authStatus } = loadElo({
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url) === "https://project.supabase.co/auth/v1/token?grant_type=password") {
        const body = JSON.parse(options.body);
        assert.equal(body.email, "user-a@example.test");
        assert.equal(body.password, "secret-a");
        assert.equal(options.headers.apikey, "publishable-key");
        return { ok: true, json: async () => ({ access_token: "jwt-a", refresh_token: "refresh-a", user: { email: "user-a@example.test" } }) };
      }
      if (String(url) === "http://localhost:3000/api/elo/identity/merge") {
        assert.equal(options.headers.Authorization, "Bearer jwt-a");
        assert.deepEqual(JSON.parse(options.body), { anonymousId: "elo_anon_login_test" });
        return { ok: true, json: async () => ({ ok: true, authContext: { userId: "auth-user-a", profile: { email: "user-a@example.test" } } }) };
      }
      throw new Error("unexpected fetch " + url);
    }
  });

  assert.equal(typeof elo.loginSupabaseForTest, "function");
  await elo.loginSupabaseForTest("user-a@example.test", "secret-a");

  const saved = JSON.parse(localStorage.getItem("sb-elo-core-auth-token"));
  assert.equal(saved.access_token, "jwt-a");
  assert.equal(sessionStorage.getItem("sb-elo-core-auth-token") !== null, true);
  assert.equal(elo.getCoreAuthTokenForTest(), "jwt-a");
  assert.equal(JSON.stringify({ local: localStorage.dump(), session: sessionStorage.dump() }).includes("secret-a"), false);
  assert.equal(calls.length, 2);
  assert.equal(authSession.hidden, false);
  assert.equal(authUser.textContent, "user-a@example.test");
  assert.equal(authStatus.textContent, "Usuario autenticado.");

  localStorage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ access_token: "legacy-backend" }));
  localStorage.setItem("sb-stock-full-auth-token", JSON.stringify({ access_token: "legacy-stock" }));
  localStorage.setItem("stockFullSupabaseToken", "legacy-token");
  localStorage.setItem("sb-project-auth-token", JSON.stringify({ access_token: "wildcard-token" }));
  sessionStorage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ access_token: "legacy-backend" }));
  sessionStorage.setItem("sb-stock-full-auth-token", JSON.stringify({ access_token: "legacy-stock" }));
  sessionStorage.setItem("stockFullSupabaseToken", "legacy-token");
  sessionStorage.setItem("sb-project-auth-token", JSON.stringify({ access_token: "wildcard-token" }));
  await elo.logoutSupabaseForTest();
  assert.equal(localStorage.getItem("sb-elo-core-auth-token"), null);
  assert.equal(sessionStorage.getItem("sb-elo-core-auth-token"), null);
  assert.equal(localStorage.getItem("sb-stock-full-backend-auth-token"), null);
  assert.equal(localStorage.getItem("sb-stock-full-auth-token"), null);
  assert.equal(localStorage.getItem("stockFullSupabaseToken"), null);
  assert.equal(localStorage.getItem("sb-project-auth-token"), null);
  assert.equal(sessionStorage.getItem("sb-stock-full-backend-auth-token"), null);
  assert.equal(sessionStorage.getItem("sb-stock-full-auth-token"), null);
  assert.equal(sessionStorage.getItem("stockFullSupabaseToken"), null);
  assert.equal(sessionStorage.getItem("sb-project-auth-token"), null);
  assert.equal(elo.getCoreAuthTokenForTest(), "");
});


test("ELO frontend login Supabase falha sem configuracao publica", async () => {
  const { elo } = loadElo({
    windowOverrides: { ELO_SUPABASE_URL: "", ELO_SUPABASE_ANON_KEY: "" },
    fetchImpl: async () => {
      throw new Error("fetch should not be called without public config");
    }
  });

  await assert.rejects(
    () => elo.loginSupabaseForTest("user-a@example.test", "secret-a"),
    /supabase_public_config_missing/
  );
});
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const TEST_SUPABASE_ISSUER = "https://lidueokjpzxdybtongbk.supabase.co/auth/v1";

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key(index) { return Array.from(data.keys())[index] || null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    dump() { return Object.fromEntries(data); }
  };
}

function createJwt(payload = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return [
    encode({ alg: "none", typ: "JWT" }),
    encode(Object.assign({ iss: TEST_SUPABASE_ISSUER, exp: 4102444800 }, payload)),
    "test-signature"
  ].join(".");
}

function createElement(tagName = "div") {
  return {
    tagName: String(tagName).toUpperCase(),
    dataset: {},
    style: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    remove() {},
    setAttribute() {},
    getAttribute() { return ""; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    textContent: "",
    innerHTML: ""
  };
}

function loadEloContext({ localStorage = {}, sessionStorage = {}, window = {} } = {}) {
  const local = createStorage(localStorage);
  const session = createStorage(sessionStorage);
  const sandbox = {
    console,
    fetch() { throw new Error("fetch_forbidden"); },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      ELO_DISABLE_AUTOFOCUS: true,
      ELO_STANDALONE_MODE: true,
      localStorage: local,
      sessionStorage: session,
      location: { hostname: "localhost", protocol: "http:", pathname: "/elo.html", search: "", hash: "" },
      navigator: { userAgent: "node-test" },
      crypto: { randomUUID() { return "logout-test-random"; } },
      addEventListener() {},
      removeEventListener() {},
      atob(value) { return Buffer.from(String(value), "base64").toString("binary"); },
      btoa(value) { return Buffer.from(String(value), "binary").toString("base64"); }
    },
    document: {
      readyState: "complete",
      body: createElement("body"),
      documentElement: { style: { setProperty() {} } },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement,
      getElementById() { return null; }
    },
    navigator: { userAgent: "node-test" },
    URLSearchParams,
    FormData,
    Blob: class Blob {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {}
  };
  Object.assign(sandbox.window, sandbox, window);
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync("relatorio-qualidade-obras/elo-assistente.js", "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { elo: sandbox.window.EloAssistente, localStorage: local, sessionStorage: session, context: sandbox };
}

test("logout limpa sessao privada do ELO e preserva dados operacionais locais", async () => {
  const token = createJwt({ sub: "auth-user-a", email: "a@example.com" });
  const sessionPayload = JSON.stringify({ currentSession: { access_token: token }, access_token: token });
  const authContext = JSON.stringify({
    userId: "auth-user-a",
    institutionId: "inst-a",
    companyId: "company-a",
    projectId: "obra-a",
    role: "admin",
    profile: { id: "profile-a", email: "a@example.com", institution_id: "inst-a", company_id: "company-a" }
  });
  const operationalState = JSON.stringify({
    dailyLogs: [{ id: "rdo-a", workId: "obra-a", notes: "RDO preservado" }],
    stockMovements: [{ id: "mov-a", workId: "obra-a", quantity: 2 }],
    executionStockAlerts: [{ id: "alert-a", workId: "obra-a", status: "open" }],
    operationalDocuments: [{ id: "doc-a", type: "rdo", workId: "obra-a", sourceRdoIds: ["rdo-a"], status: "active" }]
  });
  const stockSession = JSON.stringify({ currentSession: { access_token: "stock-token" } });

  const { elo, localStorage, sessionStorage, context } = loadEloContext({
    localStorage: {
      "sb-elo-core-auth-token": sessionPayload,
      "elo_core_auth_context_v1": authContext,
      "elo_core_current_conversation_id_v1": "conversation-a",
      "obrareport-saas-v1": operationalState,
      "sb-stock-full-auth-token": stockSession
    },
    sessionStorage: {
      "sb-elo-core-auth-token": sessionPayload,
      "elo_core_auth_context_v1": authContext
    },
    window: {
      ELO_AUTH_TOKEN: token,
      ELO_AUTH_SESSION_VALIDATED: true,
      ELO_AUTH_USER_ID: "auth-user-a",
      ELO_AUTH_CONTEXT: JSON.parse(authContext)
    }
  });

  await elo.logoutSupabaseForTest();

  assert.equal(context.window.ELO_AUTH_SESSION_VALIDATED, false);
  assert.equal(context.window.ELO_AUTH_TOKEN, "");
  assert.equal(context.window.ELO_AUTH_USER_ID, "");
  assert.equal(JSON.stringify(context.window.ELO_AUTH_CONTEXT), "{}");
  assert.equal(localStorage.getItem("sb-elo-core-auth-token"), null);
  assert.equal(sessionStorage.getItem("sb-elo-core-auth-token"), null);
  assert.equal(localStorage.getItem("elo_core_auth_context_v1"), null);
  assert.equal(sessionStorage.getItem("elo_core_auth_context_v1"), null);
  assert.equal(localStorage.getItem("elo_core_current_conversation_id_v1"), null);
  assert.equal(localStorage.getItem("obrareport-saas-v1"), operationalState);
  assert.equal(localStorage.getItem("sb-stock-full-auth-token"), stockSession);

  const identity = elo.getCoreIdentityForTest();
  assert.equal(identity.userId, undefined);
  assert.equal(identity.institutionId, undefined);
  assert.equal(identity.companyId, undefined);
});

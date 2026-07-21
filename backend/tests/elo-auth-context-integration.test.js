import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { createApp } from "../src/app.js";
import { createEloCoreStore } from "../src/elo-core-store.js";

function createSupabaseMock() {
  const profilesByToken = {
    "token-user-a": {
      user: { id: "auth-user-a", email: "a@example.com" },
      profile: { id: "profile-a", auth_user_id: "auth-user-a", institution_id: "inst-a", company_id: "company-a", role: "admin", email: "a@example.com" }
    },
    "token-user-b": {
      user: { id: "auth-user-b", email: "b@example.com" },
      profile: { id: "profile-b", auth_user_id: "auth-user-b", institution_id: "inst-b", company_id: "company-b", role: "viewer", email: "b@example.com" }
    }
  };
  let activeUserId = "";
  return {
    auth: {
      async getUser(token) {
        const session = profilesByToken[token];
        if (!session) return { data: null, error: new Error("invalid token") };
        activeUserId = session.user.id;
        return { data: { user: session.user }, error: null };
      }
    },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq(column, value) {
              assert.equal(column, "auth_user_id");
              assert.equal(value, activeUserId);
              return {
                async maybeSingle() {
                  const found = Object.values(profilesByToken).find((session) => session.user.id === value);
                  return { data: found ? found.profile : null, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

function createStorage(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    get length() { return Object.keys(data).length; },
    key(index) { return Object.keys(data)[index] || null; },
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; },
    dump() { return Object.assign({}, data); }
  };
}

function loadEloAssistant({ baseUrl, token = "", anonymousId = "elo_anon_front_001" } = {}) {
  const localStorage = createStorage({
    elo_core_anonymous_id_v1: anonymousId,
    "sb-stock-full-backend-auth-token": token ? JSON.stringify({ currentSession: { access_token: token }, access_token: token }) : ""
  });
  const sessionStorage = createStorage();
  const sandbox = {
    console,
    fetch,
    window: { ELO_SKIP_AUTO_WIDGET: true, ELO_API_BASE_URL: baseUrl },
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement(tagName) {
        return {
          tagName,
          style: {},
          classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
          dataset: {},
          setAttribute() {},
          getAttribute() { return ""; },
          appendChild(child) { return child; },
          addEventListener() {},
          remove() {},
          textContent: "",
          innerHTML: ""
        };
      },
      body: { dataset: { eloMode: "standalone", eloProduct: "chat" }, appendChild(child) { return child; } },
      documentElement: { style: { setProperty() {} } }
    },
    navigator: { userAgent: "node-test" },
    location: { hostname: "localhost", protocol: "http:", pathname: "/elo.html", search: "", hash: "" },
    localStorage,
    sessionStorage,
    crypto: { randomUUID() { return "front-test-random"; } },
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    URLSearchParams,
    FormData,
    Blob: class Blob {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} }
  };
  sandbox.window = Object.assign(sandbox.window, sandbox);
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync("relatorio-qualidade-obras/elo-assistente.js", "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { elo: sandbox.window.EloAssistente, localStorage, sessionStorage };
}

async function withServer(callback) {
  const dir = mkdtempSync(join(tmpdir(), "elo-auth-context-"));
  const app = createApp({
    authContextSupabaseClient: createSupabaseMock(),
    eloCoreStore: createEloCoreStore({ dataPath: join(dir, "elo-core.json") })
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}

async function json(url, options = {}) {
  const response = await fetch(url, Object.assign({}, options, {
    headers: Object.assign({ "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

test("ELO authContext migra anonimo no primeiro login e preserva isolamento", async () => {
  await withServer(async (base) => {
    const anonymousId = "elo_anon_auth_context_001";
    const created = await json(base + "/api/elo/conversations", {
      method: "POST",
      body: JSON.stringify({ anonymousId, title: "Conversa anonima" })
    });
    assert.equal(created.response.status, 201);

    const memory = await json(base + "/api/elo/memories", {
      method: "POST",
      body: JSON.stringify({ anonymousId, category: "preference", memory_key: "tom", memory_value: "Prefere respostas curtas." })
    });
    assert.equal(memory.response.status, 201);

    const merged = await json(base + "/api/elo/identity/merge", {
      method: "POST",
      headers: { Authorization: "Bearer token-user-a" },
      body: JSON.stringify({ anonymousId })
    });
    assert.equal(merged.response.status, 200);
    assert.equal(merged.data.ok, true);
    assert.equal(merged.data.authContext.userId, "auth-user-a");
    assert.equal(merged.data.authContext.institutionId, "inst-a");
    assert.equal(merged.data.authContext.companyId, "company-a");
    assert.equal(merged.data.authContext.role, "admin");

    const userAConversations = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-user-a" }
    });
    assert.deepEqual(userAConversations.data.conversations.map((item) => item.title), ["Conversa anonima"]);

    const userAMemories = await json(base + "/api/elo/memories", {
      headers: { Authorization: "Bearer token-user-a" }
    });
    assert.equal(userAMemories.data.memories.length, 1);
    assert.equal(userAMemories.data.memories[0].memory_key, "tom");

    const userBConversations = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-user-b" }
    });
    assert.deepEqual(userBConversations.data.conversations, []);

    const invalid = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-invalido" }
    });
    assert.equal(invalid.response.status, 401);
    assert.equal(invalid.data.error, "invalid_session");

    const anonymousAfterLogin = await json(base + "/api/elo/conversations", {
      method: "POST",
      body: JSON.stringify({ anonymousId: "elo_anon_auth_context_002", title: "Anon depois" })
    });
    assert.equal(anonymousAfterLogin.response.status, 201);

    const anonymousList = await json(base + "/api/elo/conversations?anonymousId=elo_anon_auth_context_002");
    assert.deepEqual(anonymousList.data.conversations.map((item) => item.title), ["Anon depois"]);
  });
});


test("ELO frontend le sessao existente e envia Bearer no merge", async () => {
  await withServer(async (base) => {
    const anonymousId = "elo_anon_front_auth_001";
    await json(base + "/api/elo/conversations", {
      method: "POST",
      body: JSON.stringify({ anonymousId, title: "Conversa frontend anonima" })
    });
    await json(base + "/api/elo/memories", {
      method: "POST",
      body: JSON.stringify({ anonymousId, category: "preference", memory_key: "frontend", memory_value: "Memoria criada antes do login." })
    });

    const { elo, localStorage } = loadEloAssistant({ baseUrl: base, token: "token-user-a", anonymousId });
    assert.equal(typeof elo.ensureAuthMergeForTest, "function");
    const merged = await elo.ensureAuthMergeForTest();
    assert.equal(merged, true);

    const identity = elo.getCoreIdentityForTest();
    assert.equal(identity.userId, "auth-user-a");
    assert.equal(identity.institutionId, "inst-a");
    assert.equal(identity.companyId, "company-a");
    assert.equal(JSON.parse(localStorage.getItem("elo_core_auth_context_v1")).userId, "auth-user-a");

    const userAConversations = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-user-a" }
    });
    assert.deepEqual(userAConversations.data.conversations.map((item) => item.title), ["Conversa frontend anonima"]);

    const userBConversations = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-user-b" }
    });
    assert.deepEqual(userBConversations.data.conversations, []);

    const anonymous = loadEloAssistant({ baseUrl: base, anonymousId: "elo_anon_front_auth_002" });
    assert.equal(anonymous.elo.getCoreIdentityForTest().anonymousId, "elo_anon_front_auth_002");

    const invalid = loadEloAssistant({ baseUrl: base, token: "token-invalido", anonymousId: "elo_anon_front_auth_003" });
    const invalidMerged = await invalid.elo.ensureAuthMergeForTest();
    assert.equal(invalidMerged, false);
    const invalidResponse = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-invalido" }
    });
    assert.equal(invalidResponse.response.status, 401);
  });
});

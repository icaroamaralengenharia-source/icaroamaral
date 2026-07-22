import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

function createAuthContextSupabaseMock() {
  const sessions = {
    "token-user-a": {
      user: { id: "auth-user-a" },
      profile: { id: "profile-a", auth_user_id: "auth-user-a", institution_id: "inst-a", company_id: "company-a", role: "admin" }
    }
  };
  let activeUserId = "";
  return {
    auth: {
      async getUser(token) {
        const session = sessions[token];
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
                  const found = Object.values(sessions).find((session) => session.user.id === value);
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

function createJsonStoreSpy() {
  const calls = [];
  return {
    calls,
    listConversations(input) {
      calls.push(["json:listConversations", input]);
      return [{ id: "json-conv", title: "JSON" }];
    },
    createConversation(input) {
      calls.push(["json:createConversation", input]);
      return { id: "json-created", title: input.title || "JSON" };
    },
    getConversation() {
      calls.push(["json:getConversation"]);
      return { conversation: { id: "json-conv" }, messages: [] };
    },
    updateConversation() {
      calls.push(["json:updateConversation"]);
      return { id: "json-conv" };
    },
    addMessage() {
      calls.push(["json:addMessage"]);
      return { id: "json-message" };
    },
    listMemories() {
      calls.push(["json:listMemories"]);
      return [];
    },
    upsertMemory() {
      calls.push(["json:upsertMemory"]);
      return { id: "json-memory" };
    },
    updateMemory() {
      calls.push(["json:updateMemory"]);
      return { id: "json-memory" };
    },
    deleteMemory() {
      calls.push(["json:deleteMemory"]);
      return { ok: true };
    },
    clearMemories() {
      calls.push(["json:clearMemories"]);
      return { ok: true, deleted: 0 };
    },
    mergeAnonymous(anonymousId, userId) {
      calls.push(["json:mergeAnonymous", { anonymousId, userId }]);
      return { ok: true, store: "json" };
    }
  };
}

function createSupabaseStoreSpy({ fail = false } = {}) {
  const calls = [];
  function maybeFail() {
    if (fail) throw Object.assign(new Error("supabase_network_failed"), { status: 503 });
  }
  return {
    calls,
    async listConversations(input) {
      maybeFail();
      calls.push(["supabase:listConversations", input]);
      return [{ id: "supabase-conv", title: "Supabase" }];
    },
    async createConversation(input) {
      maybeFail();
      calls.push(["supabase:createConversation", input]);
      return { id: "supabase-created", title: input.title || "Supabase" };
    },
    async getConversation(_id, input) {
      maybeFail();
      calls.push(["supabase:getConversation", input]);
      return { conversation: { id: "supabase-conv" }, messages: [] };
    },
    async updateConversation(_id, _patch, input) {
      maybeFail();
      calls.push(["supabase:updateConversation", input]);
      return { id: "supabase-conv" };
    },
    async addMessage(_id, input) {
      maybeFail();
      calls.push(["supabase:addMessage", input]);
      return { id: "supabase-message" };
    },
    async listMemories(input) {
      maybeFail();
      calls.push(["supabase:listMemories", input]);
      return [];
    },
    async upsertMemory(input) {
      maybeFail();
      calls.push(["supabase:upsertMemory", input]);
      return { id: "supabase-memory" };
    },
    async updateMemory(_id, _patch, input) {
      maybeFail();
      calls.push(["supabase:updateMemory", input]);
      return { id: "supabase-memory" };
    },
    async deleteMemory(_id, input) {
      maybeFail();
      calls.push(["supabase:deleteMemory", input]);
      return { ok: true };
    },
    async clearMemories(input) {
      maybeFail();
      calls.push(["supabase:clearMemories", input]);
      return { ok: true, deleted: 0 };
    }
  };
}

async function withServer(app, callback) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(url, options = {}) {
  const response = await fetch(url, Object.assign({}, options, {
    headers: Object.assign({ "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

test("ELO_CORE_STORE roteia json por padrao e supabase apenas com flag e JWT valido", async () => {
  const jsonDefault = createJsonStoreSpy();
  await withServer(createApp({ env: {}, eloCoreStore: jsonDefault }), async (base) => {
    const result = await json(base + "/api/elo/conversations");
    assert.equal(result.response.status, 200);
    assert.equal(result.data.conversations[0].title, "JSON");
    assert.equal(jsonDefault.calls[0][0], "json:listConversations");
  });

  const jsonFlagged = createJsonStoreSpy();
  const supabase = createSupabaseStoreSpy();
  await withServer(createApp({
    env: { ELO_CORE_STORE: "supabase" },
    authContextSupabaseClient: createAuthContextSupabaseMock(),
    eloCoreStore: jsonFlagged,
    eloCoreSupabaseStore: supabase
  }), async (base) => {
    const missingJwt = await json(base + "/api/elo/conversations");
    assert.equal(missingJwt.response.status, 401);
    assert.equal(missingJwt.data.error, "authentication_required");
    assert.equal(supabase.calls.length, 0);
    assert.equal(jsonFlagged.calls.length, 0);

    const invalidJwt = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-invalid" }
    });
    assert.equal(invalidJwt.response.status, 401);
    assert.equal(invalidJwt.data.error, "invalid_session");
    assert.equal(supabase.calls.length, 0);

    const valid = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-user-a" }
    });
    assert.equal(valid.response.status, 200);
    assert.equal(valid.data.conversations[0].title, "Supabase");
    assert.equal(supabase.calls[0][0], "supabase:listConversations");
    assert.equal(supabase.calls[0][1].jwt, "token-user-a");
    assert.equal(supabase.calls[0][1].userId, "auth-user-a");
    assert.equal(jsonFlagged.calls.length, 0);

    const merged = await json(base + "/api/elo/identity/merge", {
      method: "POST",
      headers: { Authorization: "Bearer token-user-a" },
      body: JSON.stringify({ anonymousId: "anon-before-login" })
    });
    assert.equal(merged.response.status, 200);
    assert.equal(merged.data.store, "json");
    assert.equal(jsonFlagged.calls.at(-1)[0], "json:mergeAnonymous");
  });
});

test("ELO_CORE_STORE supabase retorna falha explicita sem fallback para JSON", async () => {
  const jsonStore = createJsonStoreSpy();
  const supabase = createSupabaseStoreSpy({ fail: true });
  await withServer(createApp({
    env: { ELO_CORE_STORE: "supabase" },
    authContextSupabaseClient: createAuthContextSupabaseMock(),
    eloCoreStore: jsonStore,
    eloCoreSupabaseStore: supabase
  }), async (base) => {
    const result = await json(base + "/api/elo/conversations", {
      headers: { Authorization: "Bearer token-user-a" }
    });
    assert.equal(result.response.status, 503);
    assert.equal(result.data.error, "supabase_network_failed");
    assert.equal(jsonStore.calls.length, 0);
  });
});

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloCoreStore } from "../src/elo-core-store.js";

function createSupabaseMock() {
  const sessions = {
    "token-user-a": {
      user: { id: "elo-user-a", email: "a@example.com" },
      profile: { id: "profile-a", auth_user_id: "elo-user-a", institution_id: "inst-a", company_id: "company-a", role: "admin", email: "a@example.com" }
    },
    "token-user-b": {
      user: { id: "elo-user-b", email: "b@example.com" },
      profile: { id: "profile-b", auth_user_id: "elo-user-b", institution_id: "inst-b", company_id: "company-b", role: "member", email: "b@example.com" }
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

async function withServer(callback) {
  const dir = mkdtempSync(join(tmpdir(), "elo-auth-isolation-"));
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

const authA = { Authorization: "Bearer token-user-a" };
const authB = { Authorization: "Bearer token-user-b" };

test("ELO isola conversas e memorias entre usuarios autenticados", async () => {
  await withServer(async (base) => {
    const conversationA = await json(base + "/api/elo/conversations", {
      method: "POST",
      headers: authA,
      body: JSON.stringify({ title: "Conversa privada A" })
    });
    assert.equal(conversationA.response.status, 201);
    const conversationId = conversationA.data.conversation.id;

    const messageA = await json(base + "/api/elo/conversations/" + conversationId + "/messages", {
      method: "POST",
      headers: authA,
      body: JSON.stringify({ role: "user", content: "Mensagem privada do usuario A." })
    });
    assert.equal(messageA.response.status, 201);

    const memoryA = await json(base + "/api/elo/memories", {
      method: "POST",
      headers: authA,
      body: JSON.stringify({ category: "preference", memory_key: "tom", memory_value: "Usuario A prefere respostas objetivas." })
    });
    assert.equal(memoryA.response.status, 201);
    const memoryId = memoryA.data.memory.id;

    const bListConversations = await json(base + "/api/elo/conversations", { headers: authB });
    assert.equal(bListConversations.response.status, 200);
    assert.deepEqual(bListConversations.data.conversations, []);

    const bReadConversation = await json(base + "/api/elo/conversations/" + conversationId, { headers: authB });
    assert.equal(bReadConversation.response.status, 404);
    assert.equal(bReadConversation.data.error, "conversation_not_found");

    const bUpdateConversation = await json(base + "/api/elo/conversations/" + conversationId, {
      method: "PUT",
      headers: authB,
      body: JSON.stringify({ title: "B tentou alterar A" })
    });
    assert.equal(bUpdateConversation.response.status, 404);
    assert.equal(bUpdateConversation.data.error, "conversation_not_found");

    const bAddMessage = await json(base + "/api/elo/conversations/" + conversationId + "/messages", {
      method: "POST",
      headers: authB,
      body: JSON.stringify({ role: "user", content: "B tentou escrever na conversa A." })
    });
    assert.equal(bAddMessage.response.status, 404);
    assert.equal(bAddMessage.data.error, "conversation_not_found");

    const bListMemories = await json(base + "/api/elo/memories", { headers: authB });
    assert.equal(bListMemories.response.status, 200);
    assert.deepEqual(bListMemories.data.memories, []);

    const bUpdateMemory = await json(base + "/api/elo/memories/" + memoryId, {
      method: "PUT",
      headers: authB,
      body: JSON.stringify({ memory_value: "B tentou alterar memoria A." })
    });
    assert.equal(bUpdateMemory.response.status, 404);
    assert.equal(bUpdateMemory.data.error, "memory_not_found");

    const bDeleteMemory = await json(base + "/api/elo/memories/" + memoryId, {
      method: "DELETE",
      headers: authB
    });
    assert.equal(bDeleteMemory.response.status, 404);
    assert.equal(bDeleteMemory.data.error, "memory_not_found");

    const bMergeAAnonymous = await json(base + "/api/elo/identity/merge", {
      method: "POST",
      headers: authB,
      body: JSON.stringify({ anonymousId: "elo_anon_a_fake_or_old" })
    });
    assert.equal(bMergeAAnonymous.response.status, 200);
    assert.equal(bMergeAAnonymous.data.ok, true);

    const aReadConversation = await json(base + "/api/elo/conversations/" + conversationId, { headers: authA });
    assert.equal(aReadConversation.response.status, 200);
    assert.equal(aReadConversation.data.conversation.title, "Conversa privada A");
    assert.deepEqual(aReadConversation.data.messages.map((item) => item.content), ["Mensagem privada do usuario A."]);

    const aListMemories = await json(base + "/api/elo/memories", { headers: authA });
    assert.equal(aListMemories.response.status, 200);
    assert.deepEqual(aListMemories.data.memories.map((item) => item.memory_key), ["tom"]);
    assert.equal(aListMemories.data.memories[0].memory_value, "Usuario A prefere respostas objetivas.");
  });
});

test("ELO anonimo nao acessa dados autenticados", async () => {
  await withServer(async (base) => {
    const conversationA = await json(base + "/api/elo/conversations", {
      method: "POST",
      headers: authA,
      body: JSON.stringify({ title: "Conversa autenticada A" })
    });
    assert.equal(conversationA.response.status, 201);
    const conversationId = conversationA.data.conversation.id;

    const memoryA = await json(base + "/api/elo/memories", {
      method: "POST",
      headers: authA,
      body: JSON.stringify({ category: "preference", memory_key: "privada", memory_value: "Memoria autenticada A." })
    });
    assert.equal(memoryA.response.status, 201);

    const anonIdentity = "elo_anon_intruso";
    const anonList = await json(base + "/api/elo/conversations?anonymousId=" + anonIdentity);
    assert.equal(anonList.response.status, 200);
    assert.deepEqual(anonList.data.conversations, []);

    const anonReadConversation = await json(base + "/api/elo/conversations/" + conversationId + "?anonymousId=" + anonIdentity);
    assert.equal(anonReadConversation.response.status, 404);
    assert.equal(anonReadConversation.data.error, "conversation_not_found");

    const anonMemories = await json(base + "/api/elo/memories?anonymousId=" + anonIdentity);
    assert.equal(anonMemories.response.status, 200);
    assert.deepEqual(anonMemories.data.memories, []);

    const anonUpdateMemory = await json(base + "/api/elo/memories/" + memoryA.data.memory.id + "?anonymousId=" + anonIdentity, {
      method: "PUT",
      body: JSON.stringify({ memory_value: "Anon tentou alterar memoria A." })
    });
    assert.equal(anonUpdateMemory.response.status, 404);
    assert.equal(anonUpdateMemory.data.error, "memory_not_found");
  });
});

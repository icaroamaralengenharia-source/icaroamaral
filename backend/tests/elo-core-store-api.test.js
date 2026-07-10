import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloCoreStore } from "../src/elo-core-store.js";

async function withServer(callback) {
  const dir = mkdtempSync(join(tmpdir(), "elo-core-api-"));
  const app = createApp({
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

test("ELO CORE API persiste conversa, mensagens e memorias editaveis", async () => {
  await withServer(async (base) => {
    const identity = { anonymousId: "elo_anon_test_001" };
    const created = await json(base + "/api/elo/conversations", {
      method: "POST",
      body: JSON.stringify(Object.assign({ title: "Teste ELO CORE" }, identity))
    });
    assert.equal(created.response.status, 201);

    const conversationId = created.data.conversation.id;
    const savedMessage = await json(base + "/api/elo/conversations/" + conversationId + "/messages", {
      method: "POST",
      body: JSON.stringify(Object.assign({ role: "user", content: "Prefiro respostas diretas." }, identity))
    });
    assert.equal(savedMessage.response.status, 201);

    const loaded = await json(base + "/api/elo/conversations/" + conversationId + "?anonymousId=" + identity.anonymousId);
    assert.equal(loaded.data.messages.length, 1);
    assert.equal(loaded.data.messages[0].content, "Prefiro respostas diretas.");

    const memory = await json(base + "/api/elo/memories", {
      method: "POST",
      body: JSON.stringify(Object.assign({
        category: "preference",
        memory_key: "estilo_resposta",
        memory_value: "Usuario prefere respostas diretas.",
        sourceConversationId: conversationId
      }, identity))
    });
    assert.equal(memory.response.status, 201);

    const updated = await json(base + "/api/elo/memories/" + memory.data.memory.id, {
      method: "PUT",
      body: JSON.stringify(Object.assign({ memory_value: "Usuario prefere respostas curtas e diretas." }, identity))
    });
    assert.equal(updated.data.memory.memory_value, "Usuario prefere respostas curtas e diretas.");

    const listed = await json(base + "/api/elo/memories?anonymousId=" + identity.anonymousId);
    assert.equal(listed.data.memories.length, 1);

    const removed = await json(base + "/api/elo/memories/" + memory.data.memory.id + "?anonymousId=" + identity.anonymousId, { method: "DELETE" });
    assert.equal(removed.data.memory.ok, true);

    const empty = await json(base + "/api/elo/memories?anonymousId=" + identity.anonymousId);
    assert.equal(empty.data.memories.length, 0);
  });
});

test("ELO CORE API bloqueia memoria sensivel, desativada e migra anonimo com usuario autenticado", async () => {
  await withServer(async (base) => {
    const anonymousId = "elo_anon_merge_001";
    const userId = "user_elo_core_001";
    const conversation = await json(base + "/api/elo/conversations", {
      method: "POST",
      body: JSON.stringify({ anonymousId, title: "Conversa anonima" })
    });
    assert.equal(conversation.response.status, 201);

    const sensitive = await json(base + "/api/elo/memories", {
      method: "POST",
      body: JSON.stringify({ anonymousId, category: "technical_context", memory_key: "senha", memory_value: "minha senha e 123456" })
    });
    assert.equal(sensitive.response.status, 400);
    assert.equal(sensitive.data.error, "sensitive_memory_blocked");

    const disabled = await json(base + "/api/elo/memories", {
      method: "POST",
      body: JSON.stringify({ anonymousId, memoryDisabled: true, category: "preference", memory_key: "x", memory_value: "nao salvar" })
    });
    assert.equal(disabled.data.skipped, "memory_disabled");

    const merged = await json(base + "/api/elo/identity/merge", {
      method: "POST",
      headers: { "x-elo-auth-user-id": userId },
      body: JSON.stringify({ anonymousId, userId: "adulterado_ignorado" })
    });
    assert.equal(merged.data.ok, true);

    const spoofed = await json(base + "/api/elo/conversations?userId=" + userId);
    assert.equal(spoofed.response.status, 400);
    assert.equal(spoofed.data.error, "identity_required");

    const list = await json(base + "/api/elo/conversations", { headers: { "x-elo-auth-user-id": userId } });
    assert.equal(list.data.conversations.length, 1);
    assert.equal(list.data.conversations[0].title, "Conversa anonima");
  });
});

test("ELO CORE API isola usuarios autenticados e anonymousIds", async () => {
  await withServer(async (base) => {
    const userA = await json(base + "/api/elo/conversations", {
      method: "POST",
      headers: { "x-elo-auth-user-id": "user_a" },
      body: JSON.stringify({ title: "Conversa A" })
    });
    const userB = await json(base + "/api/elo/conversations", {
      method: "POST",
      headers: { "x-elo-auth-user-id": "user_b" },
      body: JSON.stringify({ title: "Conversa B" })
    });
    assert.equal(userA.response.status, 201);
    assert.equal(userB.response.status, 201);

    const listA = await json(base + "/api/elo/conversations", { headers: { "x-elo-auth-user-id": "user_a" } });
    assert.deepEqual(listA.data.conversations.map((item) => item.title), ["Conversa A"]);

    const forbidden = await json(base + "/api/elo/conversations/" + userB.data.conversation.id, { headers: { "x-elo-auth-user-id": "user_a" } });
    assert.equal(forbidden.response.status, 404);

    const anonA = await json(base + "/api/elo/conversations", {
      method: "POST",
      body: JSON.stringify({ anonymousId: "elo_anon_a", title: "Anon A" })
    });
    await json(base + "/api/elo/conversations", {
      method: "POST",
      body: JSON.stringify({ anonymousId: "elo_anon_b", title: "Anon B" })
    });
    const anonList = await json(base + "/api/elo/conversations?anonymousId=elo_anon_a");
    assert.deepEqual(anonList.data.conversations.map((item) => item.title), ["Anon A"]);

    const anonForbidden = await json(base + "/api/elo/conversations/" + anonA.data.conversation.id + "?anonymousId=elo_anon_b");
    assert.equal(anonForbidden.response.status, 404);
  });
});

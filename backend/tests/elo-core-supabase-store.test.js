import assert from "node:assert/strict";
import { test } from "node:test";
import { createEloCoreSupabaseStore } from "../src/elo-core-supabase-store.js";

function createFakeSupabaseFactory({ failNetwork = false } = {}) {
  const db = {
    conversations: [],
    messages: [],
    memories: []
  };
  let idCounter = 1;
  const clients = [];

  function newId(prefix) {
    return `${prefix}_${idCounter++}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function userFromOptions(options) {
    const auth = options?.global?.headers?.Authorization || "";
    if (auth === "Bearer jwt-a") return "user-a";
    if (auth === "Bearer jwt-b") return "user-b";
    return "";
  }

  function tableRows(table) {
    if (table === "elo_conversations") return db.conversations;
    if (table === "elo_messages") return db.messages;
    if (table === "elo_memories") return db.memories;
    throw new Error("unexpected_table");
  }

  function applyRls(table, rows, userId) {
    if (table === "elo_messages") {
      const visibleConversationIds = new Set(db.conversations.filter((item) => item.owner_user_id === userId).map((item) => item.id));
      return rows.filter((item) => item.owner_user_id === userId && visibleConversationIds.has(item.conversation_id));
    }
    return rows.filter((item) => item.owner_user_id === userId);
  }

  function createBuilder(table, userId, mode = "select", payload = null) {
    const state = { filters: [], singleMode: "", order: null };
    const builder = {
      select() {
        return builder;
      },
      insert(nextPayload) {
        return createBuilder(table, userId, "insert", nextPayload);
      },
      update(nextPayload) {
        return createBuilder(table, userId, "update", nextPayload);
      },
      delete() {
        return createBuilder(table, userId, "delete", null);
      },
      eq(column, value) {
        state.filters.push({ type: "eq", column, value });
        return builder;
      },
      neq(column, value) {
        state.filters.push({ type: "neq", column, value });
        return builder;
      },
      is(column, value) {
        state.filters.push({ type: "is", column, value });
        return builder;
      },
      order(column, options = {}) {
        state.order = { column, ascending: options.ascending !== false };
        return builder;
      },
      single() {
        state.singleMode = "single";
        return run(mode, payload);
      },
      maybeSingle() {
        state.singleMode = "maybeSingle";
        return run(mode, payload);
      },
      then(resolve, reject) {
        return run(mode, payload).then(resolve, reject);
      }
    };

    function filteredRows() {
      let rows = applyRls(table, tableRows(table), userId);
      for (const filter of state.filters) {
        if (filter.type === "eq") rows = rows.filter((item) => item[filter.column] === filter.value);
        if (filter.type === "neq") rows = rows.filter((item) => item[filter.column] !== filter.value);
        if (filter.type === "is") rows = rows.filter((item) => item[filter.column] === filter.value);
      }
      if (state.order) {
        rows = rows.slice().sort((a, b) => String(a[state.order.column] || "").localeCompare(String(b[state.order.column] || "")));
        if (!state.order.ascending) rows.reverse();
      }
      return rows;
    }

    async function run(runMode, runPayload) {
      if (failNetwork) return { data: null, error: { message: "network unavailable", status: 503 } };
      if (!userId) return { data: null, error: { message: "jwt missing", status: 401 } };
      if (runMode === "insert") {
        const rows = Array.isArray(runPayload) ? runPayload : [runPayload];
        const inserted = [];
        for (const item of rows) {
          if (item.owner_user_id !== userId) return { data: null, error: { message: "new row violates row-level security policy", status: 403 } };
          if (table === "elo_messages" || table === "elo_memories") {
            const ownsConversation = !item.conversation_id || db.conversations.some((conv) => conv.id === item.conversation_id && conv.owner_user_id === userId);
            if (!ownsConversation) return { data: null, error: { message: "new row violates row-level security policy", status: 403 } };
          }
          const row = { id: newId(table), created_at: "2026-07-22T00:00:00.000Z", updated_at: "2026-07-22T00:00:00.000Z", ...clone(item) };
          tableRows(table).push(row);
          inserted.push(row);
        }
        return format(inserted);
      }
      if (runMode === "update") {
        const rows = filteredRows();
        for (const row of rows) Object.assign(row, clone(runPayload));
        return format(rows);
      }
      if (runMode === "delete") {
        const rows = filteredRows();
        const ids = new Set(rows.map((item) => item.id));
        const source = tableRows(table);
        for (let index = source.length - 1; index >= 0; index -= 1) {
          if (ids.has(source[index].id)) source.splice(index, 1);
        }
        return format(rows);
      }
      return format(filteredRows());
    }

    function format(rows) {
      const data = rows.map(clone);
      if (state.singleMode === "single") return { data: data[0] || null, error: data[0] ? null : { message: "No rows", status: 406 } };
      if (state.singleMode === "maybeSingle") return { data: data[0] || null, error: null };
      return { data, error: null };
    }

    return builder;
  }

  function createClient(_url, key, options) {
    assert.equal(key, "anon-key");
    const userId = userFromOptions(options);
    const client = {
      userId,
      from(table) {
        assert.ok(["elo_conversations", "elo_messages", "elo_memories"].includes(table));
        return createBuilder(table, userId);
      }
    };
    clients.push(client);
    return client;
  }

  return { createClient, db, clients };
}

function createStore(factory) {
  return createEloCoreSupabaseStore({
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "anon-key" },
    createClient: factory.createClient
  });
}

test("ELO Supabase store exige JWT por operacao", async () => {
  const factory = createFakeSupabaseFactory();
  const store = createStore(factory);
  await assert.rejects(
    () => store.listConversations({ userId: "user-a" }),
    /jwt_required/
  );
});

test("ELO Supabase store permite usuario A acessar os proprios dados", async () => {
  const factory = createFakeSupabaseFactory();
  const store = createStore(factory);
  const authA = { jwt: "jwt-a", userId: "user-a" };

  const conversation = await store.createConversation({ ...authA, title: "Conversa A" });
  const message = await store.addMessage(conversation.id, { ...authA, role: "user", content: "Mensagem A" });
  const memory = await store.upsertMemory({ ...authA, category: "preference", memory_key: "tom", memory_value: "Memoria A" });

  const loaded = await store.getConversation(conversation.id, authA);
  const memories = await store.listMemories(authA);

  assert.equal(loaded.conversation.title, "Conversa A");
  assert.deepEqual(loaded.messages.map((item) => item.id), [message.id]);
  assert.deepEqual(memories.map((item) => item.id), [memory.id]);
});

test("ELO Supabase store preserva isolamento RLS para usuario B", async () => {
  const factory = createFakeSupabaseFactory();
  const store = createStore(factory);
  const authA = { jwt: "jwt-a", userId: "user-a" };
  const authB = { jwt: "jwt-b", userId: "user-b" };

  const conversation = await store.createConversation({ ...authA, title: "Conversa A" });
  await store.addMessage(conversation.id, { ...authA, role: "user", content: "Mensagem A" });
  const memory = await store.upsertMemory({ ...authA, category: "preference", memory_key: "tom", memory_value: "Memoria A" });

  assert.deepEqual(await store.listConversations(authB), []);
  assert.deepEqual(await store.listMemories(authB), []);
  await assert.rejects(() => store.getConversation(conversation.id, authB), /conversation_not_found/);
  await assert.rejects(() => store.updateConversation(conversation.id, { title: "B" }, authB), /conversation_not_found/);
  await assert.rejects(() => store.updateMemory(memory.id, { memory_value: "B" }, authB), /memory_not_found/);
  await assert.rejects(() => store.deleteMemory(memory.id, authB), /memory_not_found/);
  await assert.rejects(() => store.addMessage(conversation.id, { ...authB, content: "B" }), /row-level security/);

  const loadedA = await store.getConversation(conversation.id, authA);
  assert.equal(loadedA.conversation.title, "Conversa A");
});

test("ELO Supabase store nao apaga dados nem ativa fallback silencioso em falha de rede", async () => {
  const goodFactory = createFakeSupabaseFactory();
  const goodStore = createStore(goodFactory);
  const authA = { jwt: "jwt-a", userId: "user-a" };
  const conversation = await goodStore.createConversation({ ...authA, title: "Conversa A" });
  await goodStore.upsertMemory({ ...authA, category: "preference", memory_key: "tom", memory_value: "Memoria A" });

  const failingFactory = createFakeSupabaseFactory({ failNetwork: true });
  failingFactory.db.conversations = goodFactory.db.conversations;
  failingFactory.db.memories = goodFactory.db.memories;
  const failingStore = createStore(failingFactory);

  await assert.rejects(() => failingStore.clearMemories(authA), /network unavailable/);
  assert.equal(goodFactory.db.conversations.length, 1);
  assert.equal(goodFactory.db.memories.length, 1);
  assert.equal((await goodStore.getConversation(conversation.id, authA)).conversation.title, "Conversa A");
});



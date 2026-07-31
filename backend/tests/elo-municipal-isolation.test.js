import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";

function createStore() {
  return createMemoryMunicipalAdminStore({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Central A", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Central B", status: "active" }
    ],
    profiles: [
      { id: "profile-gestor", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active" },
      { id: "profile-func", auth_user_id: "func-a", institution_id: "inst-a", unit_id: "unit-a", role: "funcionario", status: "active" }
    ],
    stock_items: [
      { id: "item-zero", institution_id: "inst-a", unit_id: "unit-a", name: "Item Zerado", minimum_quantity: 5 },
      { id: "item-b", institution_id: "inst-b", unit_id: "unit-b", name: "Tenant B", minimum_quantity: 1 }
    ],
    stock_entries: [
      { id: "entry-b", item_id: "item-b", institution_id: "inst-b", unit_id: "unit-b", quantity: 1, status: "approved", created_at: "2026-01-01T00:00:00.000Z" }
    ],
    stock_exits: [],
    stock_audit_log: [],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_assets: [],
    municipal_asset_history: [],
    municipal_admin_audit_log: []
  });
}

function createAuthMock(store) {
  const users = {
    gestor: { id: "gestor-a" },
    func: { id: "func-a" }
  };
  return {
    auth: {
      async getUser(token) {
        const user = users[token];
        return user ? { data: { user }, error: null } : { data: null, error: new Error("invalid") };
      }
    },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq(column, value) {
              assert.equal(column, "auth_user_id");
              return {
                async maybeSingle() {
                  return { data: store.tables.profiles.find((item) => item.auth_user_id === value) || null, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

async function withServer(callback, options = {}) {
  const store = options.store || createStore();
  const auth = createAuthMock(store);
  const app = createApp({
    authContextSupabaseClient: auth,
    municipalAdminSupabaseClient: auth,
    municipalAdminStore: store,
    env: { ELO_SENTINEL_ENABLED: "false" }
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, store);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function postChat(base, token, body) {
  const response = await fetch(base + "/api/elo/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://127.0.0.1:5500", Authorization: "Bearer " + token },
    body: JSON.stringify(body)
  });
  return { response, data: await response.json() };
}

test("/api/elo/chat responde perguntas municipais com ferramentas read-only", async () => {
  await withServer(async (base, store) => {
    const before = JSON.stringify(store.tables);
    const result = await postChat(base, "gestor", { message: "no estoque municipal, quais itens estao zerados?", unit_id: "unit-a" });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.mode, "municipal_tools");
    assert.match(result.data.answer, /Resposta principal:/);
    assert.match(result.data.answer, /Item Zerado/);
    assert.equal(result.data.answer.includes("Tenant B"), false);
    assert.equal(JSON.stringify(store.tables), before);
  });
});

test("/api/elo/chat bloqueia papel inferior e unidade externa", async () => {
  await withServer(async (base) => {
    const roleDenied = await postChat(base, "func", { message: "no estoque municipal, quais itens estao zerados?", unit_id: "unit-a" });
    assert.equal(roleDenied.response.status, 403);
    assert.equal(roleDenied.data.mode, "municipal_tools");

    const unitDenied = await postChat(base, "gestor", { message: "no estoque municipal, quais itens estao zerados?", unit_id: "unit-b" });
    assert.equal(unitDenied.response.status, 403);
    assert.equal(unitDenied.data.error, "unit_scope_forbidden");
  });
});

test("/api/elo/chat antigo permanece funcionando sem acionar ferramentas municipais", async () => {
  await withServer(async (base) => {
    const result = await postChat(base, "gestor", { message: "Ola" });
    assert.equal(result.data.mode, "fallback_required");
    assert.notEqual(result.data.mode, "municipal_tools");
  });
});

test("/api/elo/chat nao intercepta relatorio de obra, orcamento, CADISTA, RDO, busca web ou saudacao", async () => {
  await withServer(async (base) => {
    const cases = [
      "gere um relatorio de obra",
      "quero orcamento residencial",
      "abrir CADISTA",
      "gerar RDO de hoje",
      "busque na web o preco do cimento",
      "bom dia"
    ];
    for (const message of cases) {
      const result = await postChat(base, "gestor", { message });
      assert.notEqual(result.data.mode, "municipal_tools", message);
    }
  });
});

test("/api/elo/chat volta ao fluxo antigo em falha geral das ferramentas municipais", async () => {
  const store = createStore();
  store.get = async () => { throw Object.assign(new Error("database_down"), { code: "database_down" }); };
  await withServer(async (base) => {
    const result = await postChat(base, "gestor", { message: "no estoque municipal, quais itens estao zerados?", unit_id: "unit-a" });
    assert.equal(result.data.mode, "fallback_required");
    assert.notEqual(result.data.mode, "municipal_tools");
  }, { store });
});
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
      { id: "unit-a", institution_id: "inst-a", name: "Almox A", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", status: "active" }
    ],
    profiles: [
      { id: "profile-admin", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active" }
    ],
    stock_items: [{ id: "item-a", institution_id: "inst-a", unit_id: "unit-a", name: "Seringa", unit: "un", minimum_quantity: 1 }],
    stock_entries: [{ id: "entry-a", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 3, status: "approved", created_at: "2026-01-01T00:00:00.000Z" }],
    stock_exits: [],
    stock_audit_log: [],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_admin_audit_log: []
  });
}

function createAuthMock(store) {
  const users = { admin: { id: "admin-a" }, gestor: { id: "gestor-a" } };
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
              return { async maybeSingle() { return { data: store.tables.profiles.find((item) => item.auth_user_id === value) || null, error: null }; } };
            }
          };
        }
      };
    }
  };
}

async function withServer(callback) {
  const store = createStore();
  const auth = createAuthMock(store);
  const app = createApp({ authContextSupabaseClient: auth, municipalAdminSupabaseClient: auth, municipalAdminStore: store });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, store);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, Object.assign({}, options, {
    headers: Object.assign({ "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

function auth(token) {
  return { Authorization: "Bearer " + token };
}

async function generateReport(base) {
  const generated = await json(base, "/api/municipal-admin/reports/generate", {
    method: "POST",
    headers: auth("admin"),
    body: JSON.stringify({ type: "stock", unit_id: "unit-a", title: "Relatorio aprovado" })
  });
  assert.equal(generated.response.status, 200);
  return generated.data.report;
}

test("rota archive exige confirmacao e nao escreve antes dela", async () => {
  await withServer(async (base, store) => {
    const report = await generateReport(base);
    const before = JSON.stringify(store.tables);
    const result = await json(base, "/api/municipal-admin/reports/archive", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ report, operation_id: "op-route-no", title: "Relatorio aprovado" })
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.archived, false);
    assert.equal(result.data.error, "confirmation_required");
    assert.equal(JSON.stringify(store.tables), before);
  });
});

test("rota archive cria documento, versao 1 e auditoria", async () => {
  await withServer(async (base, store) => {
    const report = await generateReport(base);
    const result = await json(base, "/api/municipal-admin/reports/archive", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ report, confirmation: true, operation_id: "op-route-ok", title: "Relatorio aprovado", document_type: "relatorio", unit_id: "unit-a" })
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.archived, true);
    assert.equal(result.data.version_number, 1);
    assert.equal(result.data.document_id, store.tables.municipal_documents[0].id);
    assert.equal(store.tables.municipal_document_versions[0].version_number, 1);
    assert.deepEqual(store.tables.municipal_admin_audit_log.map((item) => item.action), ["report_archived", "document_created", "document_version_created"]);
    assert.equal(JSON.stringify(result.data).includes("storage_path"), false);
  });
});

test("rota archive bloqueia duplicidade e unidade externa do gestor", async () => {
  await withServer(async (base) => {
    const report = await generateReport(base);
    const first = await json(base, "/api/municipal-admin/reports/archive", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ report, confirmation: true, operation_id: "op-route-dup", title: "Relatorio aprovado", unit_id: "unit-a" })
    });
    assert.equal(first.response.status, 200);
    const duplicate = await json(base, "/api/municipal-admin/reports/archive", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ report, confirmation: true, operation_id: "op-route-dup", title: "Relatorio aprovado", unit_id: "unit-a" })
    });
    assert.equal(duplicate.response.status, 409);
    const external = await json(base, "/api/municipal-admin/reports/archive", {
      method: "POST",
      headers: auth("gestor"),
      body: JSON.stringify({ report, confirmation: true, operation_id: "op-route-ext", title: "Relatorio gestor", unit_id: "unit-b" })
    });
    assert.equal(external.response.status, 403);
  });
});

test("ObraReport de obras permanece separado", async () => {
  await withServer(async (base) => {
    const obra = await json(base, "/api/obrareport/reports", { headers: { "x-institution-id": "inst-a", "x-user-id": "user-a" } });
    assert.notEqual(obra.response.status, 404);
    assert.equal(obra.data.error, undefined);
  });
});

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
      { id: "profile-admin-a", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor-a", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active" },
      { id: "profile-func", auth_user_id: "func-a", institution_id: "inst-a", unit_id: "unit-a", role: "funcionario", status: "active" }
    ],
    stock_items: [
      { id: "item-a", institution_id: "inst-a", unit_id: "unit-a", name: "Seringa", unit: "un", minimum_quantity: 5 },
      { id: "item-b", institution_id: "inst-b", unit_id: "unit-b", name: "Outro tenant", unit: "un", minimum_quantity: 1 }
    ],
    stock_entries: [
      { id: "entry-a", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 10, status: "approved", created_at: "2026-01-05T00:00:00.000Z" },
      { id: "entry-b", institution_id: "inst-b", unit_id: "unit-b", item_id: "item-b", quantity: 99, status: "approved", created_at: "2026-01-05T00:00:00.000Z" }
    ],
    stock_exits: [
      { id: "exit-a", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 4, created_at: "2026-01-06T00:00:00.000Z" }
    ],
    stock_audit_log: [],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_admin_audit_log: []
  });
}

function createAuthMock(store) {
  const users = {
    admin: { id: "admin-a" },
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

async function withServer(callback) {
  const store = createStore();
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

async function json(base, path, options = {}) {
  const response = await fetch(base + path, Object.assign({}, options, {
    headers: Object.assign({ "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

function auth(token) {
  return { Authorization: "Bearer " + token };
}

test("rotas municipais geram preview e generate sem salvar documento", async () => {
  await withServer(async (base, store) => {
    const before = JSON.stringify(store.tables);
    const types = await json(base, "/api/municipal-admin/reports/types", { headers: auth("admin") });
    assert.equal(types.response.status, 200);
    assert.ok(types.data.types.some((item) => item.id === "administrative"));

    const preview = await json(base, "/api/municipal-admin/reports/preview", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ type: "stock", unit_id: "unit-a", period: { from: "2026-01-01", to: "2026-01-31" } })
    });
    assert.equal(preview.response.status, 200);
    assert.equal(preview.data.report.institution_id, "inst-a");
    assert.equal(preview.data.report.unit_id, "unit-a");
    assert.equal(preview.data.report.summary.entries_count, 1);
    assert.equal(preview.data.report.html.includes("Seringa"), true);

    const generated = await json(base, "/api/municipal-admin/reports/generate", {
      method: "POST",
      headers: auth("gestor"),
      body: JSON.stringify({ type: "movements", unit_id: "unit-a" })
    });
    assert.equal(generated.response.status, 200);
    assert.equal(generated.data.report.status, "generated_draft");
    assert.equal(generated.data.report.acervo_saved, false);
    assert.equal(JSON.stringify(store.tables), before);
  });
});

test("rotas municipais bloqueiam unidade externa, papel inferior e tenant cruzado", async () => {
  await withServer(async (base) => {
    const external = await json(base, "/api/municipal-admin/reports/preview", {
      method: "POST",
      headers: auth("gestor"),
      body: JSON.stringify({ type: "stock", unit_id: "unit-b" })
    });
    assert.equal(external.response.status, 403);

    const deniedRole = await json(base, "/api/municipal-admin/reports/preview", {
      method: "POST",
      headers: auth("func"),
      body: JSON.stringify({ type: "stock", unit_id: "unit-a" })
    });
    assert.equal(deniedRole.response.status, 403);

    const admin = await json(base, "/api/municipal-admin/reports/preview", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ type: "stock", unit_id: "unit-a" })
    });
    assert.equal(admin.response.status, 200);
    assert.equal(JSON.stringify(admin.data.report).includes("Outro tenant"), false);
  });
});

test("relatorios de obra permanecem em rota separada", async () => {
  await withServer(async (base) => {
    const obra = await json(base, "/api/obrareport/reports", { headers: { "x-institution-id": "inst-a", "x-user-id": "user-a" } });
    assert.notEqual(obra.response.status, 404);
    assert.equal(obra.data.error, undefined);
  });
});

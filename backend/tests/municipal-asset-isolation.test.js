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
      { id: "unit-a2", institution_id: "inst-a", name: "Almox A2", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", status: "active" }
    ],
    profiles: [
      { id: "profile-admin", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active" }
    ],
    municipal_assets: [
      { id: "asset-b", institution_id: "inst-b", unit_id: "unit-b", asset_tag: "B-001", name: "Tenant B", condition: "bom", status: "ativo" }
    ],
    municipal_asset_history: [],
    municipal_admin_audit_log: [],
    stock_items: [{ id: "stock-a", institution_id: "inst-a", unit_id: "unit-a", name: "Seringa" }]
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

test("rotas de patrimonio cadastram, listam e bloqueiam duplicidade", async () => {
  await withServer(async (base, store) => {
    const created = await json(base, "/api/municipal-admin/assets", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ unit_id: "unit-a", asset_tag: "PAT-001", name: "Mesa", category: "mobiliario", condition: "bom", status: "ativo" })
    });
    assert.equal(created.response.status, 200);
    assert.equal(created.data.asset.institution_id, "inst-a");
    const duplicate = await json(base, "/api/municipal-admin/assets", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ unit_id: "unit-a", asset_tag: "PAT-001", name: "Mesa 2" })
    });
    assert.equal(duplicate.response.status, 409);
    const list = await json(base, "/api/municipal-admin/assets", { headers: auth("admin") });
    assert.equal(list.response.status, 200);
    assert.equal(JSON.stringify(list.data.assets).includes("Tenant B"), false);
    assert.equal(store.tables.stock_items.length, 1);
  });
});

test("rotas de patrimonio transferem, registram manutencao, baixa e historico", async () => {
  await withServer(async (base) => {
    const created = await json(base, "/api/municipal-admin/assets", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ unit_id: "unit-a", asset_tag: "PAT-002", name: "Cadeira", condition: "regular" })
    });
    const id = created.data.asset.id;
    const transfer = await json(base, `/api/municipal-admin/assets/${id}/transfer`, { method: "POST", headers: auth("admin"), body: JSON.stringify({ to_unit_id: "unit-a2" }) });
    assert.equal(transfer.data.asset.status, "transferido");
    const maintenance = await json(base, `/api/municipal-admin/assets/${id}/maintenance`, { method: "POST", headers: auth("admin"), body: JSON.stringify({ note: "Reparo" }) });
    assert.equal(maintenance.data.asset.status, "em_manutencao");
    const deactivated = await json(base, `/api/municipal-admin/assets/${id}/deactivate`, { method: "POST", headers: auth("admin"), body: JSON.stringify({ reason: "Baixa" }) });
    assert.equal(deactivated.data.asset.status, "baixado");
    const history = await json(base, `/api/municipal-admin/assets/${id}/history`, { headers: auth("admin") });
    assert.deepEqual(history.data.history.map((item) => item.action), ["asset_created", "asset_transferred", "asset_maintenance_registered", "asset_deactivated"]);
  });
});

test("gestor nao acessa unidade externa", async () => {
  await withServer(async (base) => {
    const external = await json(base, "/api/municipal-admin/assets", {
      method: "POST",
      headers: auth("gestor"),
      body: JSON.stringify({ unit_id: "unit-a2", asset_tag: "PAT-003", name: "Armario" })
    });
    assert.equal(external.response.status, 403);
    const own = await json(base, "/api/municipal-admin/assets", {
      method: "POST",
      headers: auth("gestor"),
      body: JSON.stringify({ unit_id: "unit-a", asset_tag: "PAT-004", name: "Armario" })
    });
    assert.equal(own.response.status, 200);
    const denied = await json(base, `/api/municipal-admin/assets/${own.data.asset.id}/transfer`, { method: "POST", headers: auth("gestor"), body: JSON.stringify({ to_unit_id: "unit-a2" }) });
    assert.equal(denied.response.status, 403);
  });
});

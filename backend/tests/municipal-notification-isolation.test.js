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
      { id: "unit-a", institution_id: "inst-a", name: "Central", status: "active" },
      { id: "unit-a2", institution_id: "inst-a", name: "Norte", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Outra", status: "active" }
    ],
    profiles: [
      { id: "profile-admin", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active" },
      { id: "profile-leitura", auth_user_id: "leitura-a", institution_id: "inst-a", unit_id: "unit-a", role: "leitura", status: "active" },
      { id: "profile-func", auth_user_id: "func-a", institution_id: "inst-a", unit_id: "unit-a", role: "funcionario", status: "active" },
      { id: "profile-b", auth_user_id: "admin-b", institution_id: "inst-b", unit_id: "unit-b", role: "municipal_admin", status: "active" }
    ],
    stock_items: [
      { id: "item-zero", institution_id: "inst-a", unit_id: "unit-a", name: "Zerado", minimum_quantity: 5 },
      { id: "item-b", institution_id: "inst-b", unit_id: "unit-b", name: "Tenant B", minimum_quantity: 1 }
    ],
    stock_entries: [],
    stock_exits: [],
    stock_audit_log: [],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_notifications: [],
    municipal_admin_audit_log: []
  });
}

function createAuthMock(store) {
  const users = {
    admin: { id: "admin-a" },
    gestor: { id: "gestor-a" },
    leitura: { id: "leitura-a" },
    funcionario: { id: "func-a" },
    adminb: { id: "admin-b" }
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

test("rotas criam, listam e deduplicam notificacoes in-app", async () => {
  await withServer(async (base, store) => {
    const body = { unit_id: "unit-a", recipient_user_id: "gestor-a", source_type: "sentinel_alert", source_id: "alert-1", title: "Alerta", message: "Estoque baixo", severity: "high" };
    const first = await json(base, "/api/municipal-admin/notifications/dispatch", { method: "POST", headers: auth("admin"), body: JSON.stringify(body) });
    assert.equal(first.response.status, 200);
    assert.equal(first.data.notifications.length, 1);
    const second = await json(base, "/api/municipal-admin/notifications/dispatch", { method: "POST", headers: auth("admin"), body: JSON.stringify(body) });
    assert.equal(second.response.status, 200);
    assert.equal(second.data.deduplicated_count, 1);
    assert.equal(store.tables.municipal_notifications.length, 1);
    const listed = await json(base, "/api/municipal-admin/notifications", { headers: auth("gestor") });
    assert.equal(listed.response.status, 200);
    assert.equal(listed.data.notifications.length, 1);
  });
});

test("rotas respeitam unread-count, leitura e cancelamento", async () => {
  await withServer(async (base) => {
    const created = await json(base, "/api/municipal-admin/notifications/dispatch", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ unit_id: "unit-a", recipient_user_id: "leitura-a", source_type: "manual", source_id: "n-read", title: "Aviso" })
    });
    const id = created.data.notifications[0].id;
    const count = await json(base, "/api/municipal-admin/notifications/unread-count", { headers: auth("leitura") });
    assert.equal(count.data.unread_count, 1);
    const read = await json(base, `/api/municipal-admin/notifications/${id}/read`, { method: "POST", headers: auth("leitura") });
    assert.equal(read.response.status, 200);
    assert.equal(read.data.notification.status, "read");
    const forbidden = await json(base, "/api/municipal-admin/notifications/dispatch", { method: "POST", headers: auth("leitura"), body: JSON.stringify({ title: "nao" }) });
    assert.equal(forbidden.response.status, 403);

    const cancellable = await json(base, "/api/municipal-admin/notifications/dispatch", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ unit_id: "unit-a", recipient_user_id: "gestor-a", source_type: "manual", source_id: "n-cancel", title: "Cancelar" })
    });
    const cancel = await json(base, `/api/municipal-admin/notifications/${cancellable.data.notifications[0].id}/cancel`, { method: "POST", headers: auth("admin") });
    assert.equal(cancel.response.status, 200);
    assert.equal(cancel.data.notification.status, "cancelled");
  });
});

test("rotas bloqueiam papel inferior, unidade externa e tenant externo", async () => {
  await withServer(async (base) => {
    const inferior = await json(base, "/api/municipal-admin/notifications", { headers: auth("funcionario") });
    assert.equal(inferior.response.status, 403);
    const unitDenied = await json(base, "/api/municipal-admin/notifications/dispatch", {
      method: "POST",
      headers: auth("gestor"),
      body: JSON.stringify({ unit_id: "unit-a2", recipient_user_id: "gestor-a", title: "externa" })
    });
    assert.equal(unitDenied.response.status, 403);
    const tenantDenied = await json(base, "/api/municipal-admin/notifications?institution_id=inst-b", { headers: auth("gestor") });
    assert.equal(tenantDenied.response.status, 403);
  });
});

test("dispatch do Sentinela por rota nao mistura tenants nem altera estoque", async () => {
  await withServer(async (base, store) => {
    const beforeStock = JSON.stringify(store.tables.stock_items);
    const result = await json(base, "/api/municipal-admin/notifications/dispatch", {
      method: "POST",
      headers: auth("admin"),
      body: JSON.stringify({ scan: true, unit_id: "unit-a" })
    });
    assert.equal(result.response.status, 200);
    assert.ok(result.data.notifications.some((row) => row.metadata && row.metadata.rule_code === "item_zero_stock"));
    assert.equal(result.data.notifications.some((row) => row.institution_id === "inst-b"), false);
    assert.equal(JSON.stringify(store.tables.stock_items), beforeStock);
  });
});

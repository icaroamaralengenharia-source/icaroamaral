import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";

const IDS = {
  instA: "11111111-1111-4111-8111-111111111111",
  instB: "22222222-2222-4222-8222-222222222222",
  unitA: "33333333-3333-4333-8333-333333333333",
  unitA2: "44444444-4444-4444-8444-444444444444",
  unitB: "55555555-5555-4555-8555-555555555555",
  admin: "66666666-6666-4666-8666-666666666666",
  gestor: "77777777-7777-4777-8777-777777777777",
  leitura: "88888888-8888-4888-8888-888888888888",
  func: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  adminB: "99999999-9999-4999-8999-999999999999"
};

function createStore() {
  return createMemoryMunicipalAdminStore({
    institutions: [
      { id: IDS.instA, name: "Prefeitura A", status: "active" },
      { id: IDS.instB, name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: IDS.unitA, institution_id: IDS.instA, name: "Central", status: "active" },
      { id: IDS.unitA2, institution_id: IDS.instA, name: "Norte", status: "active" },
      { id: IDS.unitB, institution_id: IDS.instB, name: "Outra", status: "active" }
    ],
    profiles: [
      { id: "profile-admin", auth_user_id: IDS.admin, institution_id: IDS.instA, unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor", auth_user_id: IDS.gestor, institution_id: IDS.instA, unit_id: IDS.unitA, role: "gestor", status: "active" },
      { id: "profile-leitura", auth_user_id: IDS.leitura, institution_id: IDS.instA, unit_id: IDS.unitA, role: "leitura", status: "active" },
      { id: "profile-func", auth_user_id: IDS.func, institution_id: IDS.instA, unit_id: IDS.unitA, role: "funcionario", status: "active" },
      { id: "profile-b", auth_user_id: IDS.adminB, institution_id: IDS.instB, unit_id: IDS.unitB, role: "municipal_admin", status: "active" }
    ],
    stock_items: [
      { id: "item-zero", institution_id: IDS.instA, unit_id: IDS.unitA, name: "Zerado", minimum_quantity: 5 },
      { id: "item-b", institution_id: IDS.instB, unit_id: IDS.unitB, name: "Tenant B", minimum_quantity: 1 }
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
    admin: { id: IDS.admin },
    gestor: { id: IDS.gestor },
    leitura: { id: IDS.leitura },
    funcionario: { id: IDS.func },
    adminb: { id: IDS.adminB }
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
    const body = { unit_id: IDS.unitA, recipient_user_id: IDS.gestor, source_type: "sentinel_alert", source_id: "alert-1", title: "Alerta", message: "Estoque baixo", severity: "high" };
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
      body: JSON.stringify({ unit_id: IDS.unitA, recipient_user_id: IDS.leitura, source_type: "manual", source_id: "n-read", title: "Aviso" })
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
      body: JSON.stringify({ unit_id: IDS.unitA, recipient_user_id: IDS.gestor, source_type: "manual", source_id: "n-cancel", title: "Cancelar" })
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
      body: JSON.stringify({ unit_id: IDS.unitA2, recipient_user_id: IDS.gestor, title: "externa" })
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
      body: JSON.stringify({ scan: true, unit_id: IDS.unitA })
    });
    assert.equal(result.response.status, 200);
    assert.ok(result.data.notifications.some((row) => row.metadata && row.metadata.rule_code === "item_zero_stock"));
    assert.equal(result.data.notifications.some((row) => row.institution_id === IDS.instB), false);
    assert.equal(JSON.stringify(store.tables.stock_items), beforeStock);
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";

function createStore() {
  return createMemoryMunicipalAdminStore({
    institutions: [{ id: "inst-a", name: "Prefeitura A", status: "active" }, { id: "inst-b", name: "Prefeitura B", status: "active" }],
    units: [{ id: "unit-a", institution_id: "inst-a", name: "Central", status: "active" }, { id: "unit-b", institution_id: "inst-b", name: "B", status: "active" }],
    profiles: [
      { id: "profile-admin", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active" },
      { id: "profile-leitura", auth_user_id: "leitura-a", institution_id: "inst-a", unit_id: null, role: "leitura", status: "active" },
      { id: "profile-func", auth_user_id: "func-a", institution_id: "inst-a", unit_id: "unit-a", role: "funcionario", status: "active" }
    ],
    stock_items: [{ id: "item-zero", institution_id: "inst-a", unit_id: "unit-a", name: "Zerado", minimum_quantity: 1 }],
    stock_entries: [],
    stock_exits: [],
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
    leitura: { id: "leitura-a" },
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
  const app = createApp({ authContextSupabaseClient: auth, municipalAdminSupabaseClient: auth, municipalAdminStore: store, env: { ELO_SENTINEL_ENABLED: "false" } });
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

test("rotas do Sentinela Municipal respeitam permissoes e escopo", async () => {
  await withServer(async (base, store) => {
    const list = await json(base, "/api/municipal-admin/sentinel/alerts", { headers: auth("admin") });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.alerts.some((item) => item.rule_code === "item_zero_stock"), true);

    const deniedScan = await json(base, "/api/municipal-admin/sentinel/scan", { method: "POST", headers: auth("leitura"), body: JSON.stringify({}) });
    assert.equal(deniedScan.response.status, 403);

    const deniedFunc = await json(base, "/api/municipal-admin/sentinel/alerts", { headers: auth("func") });
    assert.equal(deniedFunc.response.status, 403);

    const crossUnit = await json(base, "/api/municipal-admin/sentinel/scan", { method: "POST", headers: auth("gestor"), body: JSON.stringify({ unit_id: "unit-b" }) });
    assert.equal(crossUnit.response.status, 403);

    const scan = await json(base, "/api/municipal-admin/sentinel/scan", { method: "POST", headers: auth("gestor"), body: JSON.stringify({ unit_id: "unit-a" }) });
    assert.equal(scan.response.status, 200);
    assert.ok(scan.data.alerts.every((item) => item.unit_id === "unit-a"));
    assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "sentinel_scan_executed");

    const alertId = scan.data.alerts[0].id;
    const detail = await json(base, "/api/municipal-admin/sentinel/alerts/" + alertId, { headers: auth("admin") });
    assert.equal(detail.response.status, 200);
    const ack = await json(base, "/api/municipal-admin/sentinel/alerts/" + alertId + "/acknowledge", { method: "POST", headers: auth("admin"), body: JSON.stringify({}) });
    assert.equal(ack.response.status, 200);
    assert.equal(ack.data.alert.status, "acknowledged");

    const missing = await json(base, "/api/municipal-admin/sentinel/alerts/msnt_missing/resolve", { method: "POST", headers: auth("admin"), body: JSON.stringify({}) });
    assert.equal(missing.response.status, 404);
  });
});

test("Sentinela ELO de obras permanece roteado separadamente", async () => {
  await withServer(async (base) => {
    const response = await json(base, "/api/elo/sentinel/health");
    assert.notEqual(response.data.error, "sentinel_alert_not_found");
    assert.notEqual(response.data.error, "api_route_not_found");
  });
});

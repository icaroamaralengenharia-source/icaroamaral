import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalOperationalShelfService } from "../src/municipal-operational-shelf-service.js";

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId || "inst-a",
    role,
    profile: {
      id: overrides.profileId || role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId || "inst-a",
      unit_id: overrides.unitId || "",
      role,
      status: overrides.status || "active"
    }
  };
}

function setup(extra = {}) {
  const store = createMemoryMunicipalAdminStore({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Almox A", code: "A", address: "Rua A", status: "active" },
      { id: "unit-a2", institution_id: "inst-a", name: "Almox A2", code: "A2", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", code: "B", status: "active" }
    ],
    profiles: [
      { id: "profile-admin", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active" }
    ],
    stock_items: [
      { id: "item-a", institution_id: "inst-a", unit_id: "unit-a", name: "Seringa", unit: "un", minimum_quantity: 5, created_at: "2026-01-01T00:00:00.000Z" },
      { id: "item-a2", institution_id: "inst-a", unit_id: "unit-a2", name: "Mascara", unit: "cx", minimum_quantity: 1, created_at: "2026-01-01T00:00:00.000Z" },
      { id: "item-b", institution_id: "inst-b", unit_id: "unit-b", name: "Outro tenant", unit: "un", minimum_quantity: 1, created_at: "2026-01-01T00:00:00.000Z" }
    ],
    stock_entries: [
      { id: "entry-a", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 3, status: "aprovada", source: "nf", created_at: "2026-01-03T00:00:00.000Z" },
      { id: "entry-b", institution_id: "inst-b", unit_id: "unit-b", item_id: "item-b", quantity: 99, status: "aprovada", created_at: "2026-01-03T00:00:00.000Z" }
    ],
    stock_exits: [
      { id: "exit-a", institution_id: "inst-a", unit_id: "unit-a", item_id: "item-a", quantity: 1, destination_sector: "UBS", responsible_name: "Ana", created_at: "2026-01-04T00:00:00.000Z" },
      { id: "exit-b", institution_id: "inst-b", unit_id: "unit-b", item_id: "item-b", quantity: 50, created_at: "2026-01-04T00:00:00.000Z" }
    ],
    stock_audit_log: [
      { id: "audit-a", institution_id: "inst-a", unit_id: "unit-a", action: "stock_checked", entity_type: "stock_items", entity_id: "item-a", metadata: { ok: true, token: "secret" }, created_at: "2026-01-05T00:00:00.000Z" },
      { id: "audit-b", institution_id: "inst-b", unit_id: "unit-b", action: "other", entity_type: "stock_items", entity_id: "item-b", metadata: {}, created_at: "2026-01-05T00:00:00.000Z" }
    ],
    municipal_admin_invites: [],
    municipal_admin_audit_log: [],
    ...(extra.tables || {})
  });
  const targetStore = extra.store || store;
  return { store: targetStore, service: createMunicipalOperationalShelfService({ store: targetStore }) };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("platform_admin consulta unidade valida sem misturar tenants", async () => {
  const { service } = setup();
  const result = await service.getOperationalDashboard(ctx("platform_admin", { institutionId: "" }), "unit-a");
  assert.equal(result.dashboard.unit.id, "unit-a");
  assert.deepEqual(result.dashboard.items.map((item) => item.id), ["item-a"]);
  assert.equal(result.dashboard.metrics.total_items, 1);
  assert.equal(result.dashboard.metrics.total_quantity, 2);
  assert.equal(result.dashboard.metrics.low_stock_items, 1);
  assert.equal(result.dashboard.movements.every((mov) => mov.item_id === "item-a"), true);
  assert.equal(result.dashboard.audit_log[0].metadata.token, undefined);
});

test("municipal_admin consulta propria unidade e nao consulta unidade externa", async () => {
  const { service } = setup();
  const own = await service.getOperationalDashboard(ctx("municipal_admin", { userId: "admin-a" }), "unit-a");
  assert.equal(own.dashboard.unit.institution_id, "inst-a");
  await rejectsCode(service.getOperationalDashboard(ctx("municipal_admin", { userId: "admin-a" }), "unit-b"), "institution_scope_forbidden");
});

test("gestor consulta unidade autorizada e nao consulta outra unidade", async () => {
  const { service } = setup();
  const own = await service.getOperationalDashboard(ctx("gestor", { userId: "gestor-a", unitId: "unit-a" }), "unit-a");
  assert.equal(own.dashboard.unit.id, "unit-a");
  await rejectsCode(service.getOperationalDashboard(ctx("gestor", { userId: "gestor-a", unitId: "unit-a" }), "unit-a2"), "unit_scope_forbidden");
});

test("papel inferior e unidade inexistente retornam erro seguro", async () => {
  const { service } = setup();
  await rejectsCode(service.getOperationalDashboard(ctx("funcionario"), "unit-a"), "municipal_operational_access_forbidden");
  await rejectsCode(service.getOperationalDashboard(ctx("platform_admin", { institutionId: "" }), "unit-x"), "unit_not_found");
});

test("ausencia de itens retorna listas vazias", async () => {
  const { service } = setup({ tables: { stock_items: [], stock_entries: [], stock_exits: [], stock_audit_log: [] } });
  const result = await service.getOperationalDashboard(ctx("municipal_admin"), "unit-a");
  assert.equal(result.dashboard.metrics.total_items, 0);
  assert.deepEqual(result.dashboard.items, []);
  assert.deepEqual(result.dashboard.movements, []);
  assert.deepEqual(result.dashboard.alerts, []);
});

test("falha parcial e tratada sem apagar estoque ja carregado", async () => {
  const base = setup().store;
  const partialStore = Object.assign({}, base, {
    async list(table, filters) {
      if (table === "stock_exits") throw Object.assign(new Error("stock_exits_down"), { code: "stock_exits_down" });
      return base.list(table, filters);
    }
  });
  const service = createMunicipalOperationalShelfService({ store: partialStore });
  const result = await service.getOperationalDashboard(ctx("municipal_admin"), "unit-a");
  assert.equal(result.dashboard.items.length, 1);
  assert.equal(result.dashboard.partial_errors.some((err) => err.table === "stock_exits"), true);
});
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalSentinelService } from "../src/municipal-sentinel-service.js";

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId ?? "inst-a",
    role,
    profile: Object.assign({
      id: role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId ?? "inst-a",
      unit_id: overrides.unitId || "",
      role,
      status: "active"
    }, overrides.profile || {})
  };
}

function setup(extra = {}) {
  const store = createMemoryMunicipalAdminStore(Object.assign({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Central", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Outra", status: "active" }
    ],
    stock_items: [
      { id: "item-zero", institution_id: "inst-a", unit_id: "unit-a", name: "Zerado", minimum_quantity: 5 },
      { id: "item-low", institution_id: "inst-a", unit_id: "unit-a", name: "Baixo", minimum_quantity: 10 },
      { id: "item-ok", institution_id: "inst-a", unit_id: "unit-a", name: "Normal", minimum_quantity: 5 },
      { id: "item-b", institution_id: "inst-b", unit_id: "unit-b", name: "Tenant B", minimum_quantity: 1 }
    ],
    stock_entries: [
      { id: "entry-low", item_id: "item-low", institution_id: "inst-a", unit_id: "unit-a", quantity: 4, status: "aprovada", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "entry-ok", item_id: "item-ok", institution_id: "inst-a", unit_id: "unit-a", quantity: 9, status: "aprovada", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "entry-b", item_id: "item-b", institution_id: "inst-b", unit_id: "unit-b", quantity: 3, status: "aprovada", created_at: "2026-01-01T00:00:00.000Z" }
    ],
    stock_exits: [
      { id: "exit-ok", item_id: "item-ok", institution_id: "inst-a", unit_id: "unit-a", quantity: 2, purpose: "Uso", destination_sector: "UBS", created_by: "gestor-a", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "exit-no-reason", item_id: "item-low", institution_id: "inst-a", unit_id: "unit-a", quantity: 1, purpose: "", destination_sector: "", created_by: "gestor-a", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "exit-too-much", item_id: "item-low", institution_id: "inst-a", unit_id: "unit-a", quantity: 9, purpose: "Emergencia", destination_sector: "UBS", created_by: "gestor-a", created_at: "2026-01-03T00:00:00.000Z" }
    ],
    stock_audit_log: [],
    municipal_documents: [
      { id: "doc-report", institution_id: "inst-a", unit_id: "unit-a", document_type: "relatorio", status: "active", current_version: 1 },
      { id: "doc-archived", institution_id: "inst-a", unit_id: "unit-a", document_type: "termo", status: "archived", current_version: 1 }
    ],
    municipal_document_versions: [
      { id: "ver-archived", document_id: "doc-archived", institution_id: "inst-a", unit_id: "unit-a", file_reference: "/api/municipal-admin/document-files/a.pdf", storage_path: "secret/raw.pdf" }
    ],
    municipal_admin_audit_log: []
  }, extra));
  return { store, service: createMunicipalSentinelService({ store }) };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("detecta item zerado, estoque baixo e nao alerta item normal", async () => {
  const { service } = setup();
  const { alerts } = await service.listAlerts(ctx("municipal_admin"));
  assert.ok(alerts.some((item) => item.rule_code === "item_zero_stock" && item.source_entity_id === "item-zero"));
  assert.ok(alerts.some((item) => item.rule_code === "item_below_minimum" && item.source_entity_id === "item-low"));
  assert.equal(alerts.some((item) => ["item_zero_stock", "item_below_minimum"].includes(item.rule_code) && item.source_entity_id === "item-ok"), false);
});

test("detecta movimentacao sem justificativa e saida maior que saldo", async () => {
  const { service } = setup();
  const { alerts } = await service.scan(ctx("gestor", { unitId: "unit-a" }), {});
  assert.ok(alerts.some((item) => item.rule_code === "movement_without_reason" && item.source_entity_id === "exit-no-reason"));
  assert.ok(alerts.some((item) => item.rule_code === "exit_exceeds_available_balance" && item.source_entity_id === "exit-too-much"));
});

test("nao mistura tenants e gestor so ve unidade autorizada", async () => {
  const { service } = setup();
  const admin = await service.listAlerts(ctx("municipal_admin"));
  assert.ok(admin.alerts.every((item) => item.institution_id === "inst-a"));
  assert.equal(admin.alerts.some((item) => item.source_entity_id === "item-b"), false);
  await rejectsCode(service.listAlerts(ctx("gestor", { unitId: "unit-a" }), { unit_id: "unit-b" }), "unit_scope_forbidden");
});

test("leitura nao executa scan e scan nao altera saldo", async () => {
  const { service, store } = setup();
  const beforeEntries = JSON.stringify(store.tables.stock_entries);
  const beforeExits = JSON.stringify(store.tables.stock_exits);
  await rejectsCode(service.scan(ctx("leitura"), {}), "sentinel_write_forbidden");
  await service.scan(ctx("municipal_admin"), {});
  assert.equal(JSON.stringify(store.tables.stock_entries), beforeEntries);
  assert.equal(JSON.stringify(store.tables.stock_exits), beforeExits);
});

test("alerta nao duplica e acknowledge muda estado", async () => {
  const { service, store } = setup();
  const first = await service.listAlerts(ctx("municipal_admin"));
  const second = await service.scan(ctx("municipal_admin"), {});
  assert.deepEqual(new Set(first.alerts.map((item) => item.id)), new Set(second.alerts.map((item) => item.id)));
  const target = first.alerts[0];
  const ack = await service.acknowledge(ctx("municipal_admin"), target.id, {});
  assert.equal(ack.alert.status, "acknowledged");
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "sentinel_alert_acknowledged");
  const after = await service.listAlerts(ctx("municipal_admin"));
  assert.equal(after.alerts.find((item) => item.id === target.id).status, "acknowledged");
});

test("resolve exige alerta existente e metadata sensivel nao aparece", async () => {
  const { service } = setup({
    stock_items: [{ id: "item-sensitive", institution_id: "inst-a", unit_id: "unit-a", name: "Secreto", minimum_quantity: 1, storage_path: "raw", token: "TOKEN_VALOR_PROIBIDO" }],
    stock_entries: [],
    stock_exits: [],
    municipal_documents: [],
    municipal_document_versions: [],
    stock_audit_log: []
  });
  await rejectsCode(service.resolve(ctx("municipal_admin"), "msnt_inexistente", {}), "sentinel_alert_not_found");
  const { alerts } = await service.listAlerts(ctx("municipal_admin"));
  const serialized = JSON.stringify(alerts);
  assert.equal(serialized.includes("storage_path"), false);
  assert.equal(serialized.includes("TOKEN_VALOR_PROIBIDO"), false);
});

test("falha parcial de documentos nao derruba analise de estoque", async () => {
  const { store, service } = setup();
  const original = store.list;
  store.list = async (table, filters) => {
    if (table === "municipal_documents") throw Object.assign(new Error("documents_down"), { code: "documents_down" });
    return original.call(store, table, filters);
  };
  const { alerts, partial_errors } = await service.listAlerts(ctx("municipal_admin"));
  assert.ok(alerts.some((item) => item.rule_code === "item_zero_stock"));
  assert.ok(partial_errors.some((item) => item.table === "municipal_documents"));
});

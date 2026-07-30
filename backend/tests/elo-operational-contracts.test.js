import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adaptEloNeedToMaterialNeed,
  adaptRdoToSourceReference,
  adaptSentinelPendingToOperationalAlert,
  adaptStockFullMovementToStockMovementReference,
  adaptStockObrasItemToMaterialReference,
  adaptTimelineEventToAuditEvent,
  normalizeAuditEvent,
  normalizeMaterialNeed,
  normalizeMaterialRequest,
  normalizeOperationalAlert,
  normalizeStockMovementReference,
  normalizeUnit,
  sanitizeMetadata,
  validateAuditEvent,
  validateMaterialNeed,
  validateMaterialRequest,
  validateOperationalAlert,
  validateStockMovementReference
} from "../src/contracts/elo-operational-contracts.js";

const scope = Object.freeze({
  institution_id: "inst-1",
  company_id: "company-1",
  project_id: "project-1"
});

test("MaterialNeed normaliza necessidade, escassez e escopo obrigatorio", () => {
  const need = normalizeMaterialNeed({
    ...scope,
    source_module: "elo_budget",
    source_entity_type: "budget_item",
    source_entity_id: "budget-1",
    material_name: "Cimento CP-II",
    unit: "sc",
    required_quantity: 10,
    available_quantity: 3,
    reserved_quantity: 2
  });

  assert.equal(need.canonical_unit, "saco");
  assert.equal(need.shortage_quantity, 5);
  assert.deepEqual(validateMaterialNeed(need), { ok: true, errors: [] });

  const zero = normalizeMaterialNeed({ ...need, required_quantity: 0 });
  assert.deepEqual(validateMaterialNeed(zero).errors, ["required_quantity_must_be_positive"]);

  const negative = normalizeMaterialNeed({ ...need, shortage_quantity: -4 });
  assert.equal(negative.shortage_quantity, 0);

  const missingScope = validateMaterialNeed(normalizeMaterialNeed({ ...need, project_id: "" }));
  assert.equal(missingScope.ok, false);
  assert.ok(missingScope.errors.includes("project_id_required"));

  const missingMaterial = validateMaterialNeed(normalizeMaterialNeed({ ...need, material_id: "", material_code: "", material_name: "" }));
  assert.ok(missingMaterial.errors.includes("material_reference_required"));
});

test("MaterialRequest valida itens, aprovacao parcial e entrega acima do aprovado", () => {
  const request = normalizeMaterialRequest({
    ...scope,
    source_module: "rdo",
    source_entity_type: "material_request",
    source_entity_id: "rdo-1",
    request_id: "req-1",
    status: "partially_approved",
    approval_status: "partially_approved",
    requested_quantity: 10,
    approved_quantity: 6,
    delivered_quantity: 4,
    items: [{ name: "Argamassa", unit: "kg", quantity: 10 }]
  });

  assert.deepEqual(validateMaterialRequest(request), { ok: true, errors: [] });

  const empty = validateMaterialRequest(normalizeMaterialRequest({ ...request, requested_quantity: 0, items: [] }));
  assert.ok(empty.errors.includes("requested_quantity_or_items_required"));

  const invalidItem = validateMaterialRequest(normalizeMaterialRequest({ ...request, items: [{ name: "Areia", quantity: -1 }] }));
  assert.ok(invalidItem.errors.includes("item_quantity_must_be_positive"));

  const overDelivery = validateMaterialRequest(normalizeMaterialRequest({ ...request, approved_quantity: 2, delivered_quantity: 3 }));
  assert.ok(overDelivery.errors.includes("delivered_quantity_exceeds_approved_quantity"));

  const invalidStatus = validateMaterialRequest(normalizeMaterialRequest({ ...request, status: "auto_approved" }));
  assert.ok(invalidStatus.errors.includes("status_invalid"));
});

test("StockMovementReference preserva ids offline e nao recalcula saldos", () => {
  const movement = normalizeStockMovementReference({
    ...scope,
    source_module: "stock_full",
    source_entity_type: "stock_movement",
    source_entity_id: "mov-1",
    movement_id: "mov-1",
    movement_type: "saida",
    item_id: "item-1",
    quantity: 2,
    previous_balance: 10,
    new_balance: 99,
    offline_uuid: "off-1",
    operation_id: "op-1",
    device_id: "dev-1",
    sync_status: "pending"
  });

  assert.equal(movement.previous_balance, 10);
  assert.equal(movement.new_balance, 99);
  assert.equal(movement.offline_uuid, "off-1");
  assert.equal(movement.operation_id, "op-1");
  assert.deepEqual(validateStockMovementReference(movement), { ok: true, errors: [] });

  const invalidType = validateStockMovementReference(normalizeStockMovementReference({ ...movement, movement_type: "consumo" }));
  assert.ok(invalidType.errors.includes("movement_type_invalid"));

  const invalidQuantity = validateStockMovementReference(normalizeStockMovementReference({ ...movement, quantity: 0 }));
  assert.ok(invalidQuantity.errors.includes("quantity_must_be_positive"));
});

test("OperationalAlert valida severidade, prioridade, status e nao dispara efeitos", () => {
  let sideEffect = 0;
  const alert = normalizeOperationalAlert({
    ...scope,
    source_module: "sentinel",
    source_entity_type: "pending",
    source_entity_id: "pend-1",
    alert_id: "alert-1",
    title: "Divergencia de consumo",
    severity: "high",
    priority: "urgent",
    status: "open",
    metadata: { onDispatch: () => { sideEffect += 1; } }
  });

  assert.deepEqual(validateOperationalAlert(alert), { ok: true, errors: [] });
  assert.equal(sideEffect, 0);

  const invalid = validateOperationalAlert(normalizeOperationalAlert({ ...alert, severity: "fatal", priority: "now", status: "triggered" }));
  assert.ok(invalid.errors.includes("severity_invalid"));
  assert.ok(invalid.errors.includes("priority_invalid"));
  assert.ok(invalid.errors.includes("status_invalid"));

  const blankKey = validateOperationalAlert(normalizeOperationalAlert({ ...alert, idempotency_key: "   " }));
  assert.ok(blankKey.errors.includes("idempotency_key_invalid"));
});

test("AuditEvent preserva correlacao, sanitiza estados e exige ator quando humano", () => {
  const audit = normalizeAuditEvent({
    ...scope,
    source_module: "timeline",
    source_entity_type: "event",
    source_entity_id: "evt-1",
    audit_event_id: "audit-1",
    event_type: "updated",
    actor_type: "user",
    actor_id: "user-1",
    correlation_id: "corr-1",
    causation_id: "cause-1",
    previous_state: { status: "open", token: "secret" },
    new_state: { status: "closed", file_path: "C:\\tmp\\doc.pdf" }
  });

  assert.equal(audit.correlation_id, "corr-1");
  assert.equal(audit.causation_id, "cause-1");
  assert.equal(audit.previous_state.token, undefined);
  assert.equal(audit.new_state.file_path, undefined);
  assert.deepEqual(validateAuditEvent(audit), { ok: true, errors: [] });

  const missingScope = validateAuditEvent(normalizeAuditEvent({ ...audit, company_id: "" }));
  assert.ok(missingScope.errors.includes("company_id_required"));

  const invalidActor = validateAuditEvent(normalizeAuditEvent({ ...audit, actor_type: "robot" }));
  assert.ok(invalidActor.errors.includes("actor_type_invalid"));

  const missingActor = validateAuditEvent(normalizeAuditEvent({ ...audit, actor_id: "" }));
  assert.ok(missingActor.errors.includes("actor_id_required"));
});

test("Unidades preservam original, normalizam canonico e nao convertem quantidades", () => {
  assert.deepEqual(normalizeUnit("m²"), { original: "m²", canonical: "m2" });
  assert.deepEqual(normalizeUnit("m3"), { original: "m3", canonical: "m3" });
  assert.deepEqual(normalizeUnit("saco"), { original: "saco", canonical: "saco" });
  assert.deepEqual(normalizeUnit("caixa"), { original: "caixa", canonical: "caixa" });
  assert.deepEqual(normalizeUnit("peça"), { original: "peça", canonical: "peca" });
  assert.deepEqual(normalizeUnit("barra especial"), { original: "barra especial", canonical: "barra especial" });

  const need = normalizeMaterialNeed({
    ...scope,
    source_module: "elo_budget",
    source_entity_type: "budget_item",
    source_entity_id: "b1",
    material_name: "Tela",
    unit: "m²",
    required_quantity: 12.5
  });
  assert.equal(need.required_quantity, 12.5);
});

test("Adaptadores convertem fontes reais para referencias sem integrar fluxos", () => {
  const eloNeed = adaptEloNeedToMaterialNeed({
    id: "budget-1",
    name: "Aço CA-50",
    plannedQuantity: 40,
    currentQuantity: 5,
    unidade: "kg"
  }, scope);
  assert.equal(eloNeed.source_module, "elo_budget");
  assert.equal(eloNeed.material_name, "Aço CA-50");
  assert.equal(eloNeed.shortage_quantity, 35);

  const stockObras = adaptStockObrasItemToMaterialReference({ id: "it-1", nome: "Cimento", unidade: "sc" });
  assert.equal(stockObras.canonical_unit, "saco");

  const stockFull = adaptStockFullMovementToStockMovementReference({
    id: "m1",
    type: "entrada",
    product_id: "prod-1",
    quantity: 7,
    previousBalance: 1,
    newBalance: 30
  }, scope);
  assert.equal(stockFull.source_module, "stock_full");
  assert.equal(stockFull.new_balance, 30);

  const alert = adaptSentinelPendingToOperationalAlert({ id: "p1", summary: "Pendencia", severity: "medium" }, scope);
  assert.equal(alert.source_module, "sentinel");
  assert.equal(alert.alert_id, "p1");

  const audit = adaptTimelineEventToAuditEvent({ id: "t1", created_by: "user-1" }, scope);
  assert.equal(audit.source_module, "timeline");
  assert.equal(audit.actor_type, "user");

  const rdo = adaptRdoToSourceReference({ id: "rdo-1", numero: "RDO 001", report_date: "2026-07-29" }, scope);
  assert.equal(rdo.source_module, "rdo");
  assert.equal(rdo.source_entity_id, "rdo-1");
});

test("Sanitizacao remove secrets, caminhos internos e documentos brutos", () => {
  const safe = sanitizeMetadata({
    visible: "ok",
    token: "abc",
    apiKey: "abc",
    nested: {
      storage_path: "/bucket/private/file.pdf",
      note: "texto",
      html_content: "<html></html>",
      local: "C:\\Users\\Wia Engenharia\\secret.pdf"
    },
    list: ["valor", "../internal/file"]
  });

  assert.deepEqual(safe, {
    visible: "ok",
    nested: { note: "texto" },
    list: ["valor"]
  });
});

test("Contratos sao funcoes puras e entradas incompletas falham com seguranca", () => {
  const original = { id: "x", quantity: 1, metadata: { password: "secret" } };
  const snapshot = JSON.stringify(original);
  const movement = adaptStockFullMovementToStockMovementReference(original);
  const validation = validateStockMovementReference(movement);

  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.includes("institution_id_required"));
  assert.ok(validation.errors.includes("source_entity_type_required") === false);
  assert.equal(adaptStockObrasItemToMaterialReference(null), null);
  assert.equal(adaptRdoToSourceReference(null), null);
});

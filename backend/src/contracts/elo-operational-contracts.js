export const ELO_OPERATIONAL_CONTRACT_VERSION = "1.0";

export const SOURCE_MODULES = Object.freeze([
  "elo",
  "stock_obras",
  "stock_full",
  "sentinel",
  "timeline",
  "archive",
  "rdo",
  "obrareport",
  "generated_document",
  "elo_budget",
  "budget_pdf",
  "technical_report"
]);

export const MATERIAL_NEED_STATUSES = Object.freeze(["open", "planned", "requested", "partially_fulfilled", "fulfilled", "cancelled"]);
export const MATERIAL_REQUEST_STATUSES = Object.freeze(["draft", "requested", "approved", "partially_approved", "rejected", "delivered", "cancelled"]);
export const APPROVAL_STATUSES = Object.freeze(["pending", "approved", "partially_approved", "rejected", "not_required"]);
export const STOCK_MOVEMENT_TYPES = Object.freeze(["entry", "exit", "adjustment", "transfer", "entrada", "saida", "ajuste", "transferencia"]);
export const ALERT_SEVERITIES = Object.freeze(["info", "low", "medium", "high", "critical"]);
export const ALERT_PRIORITIES = Object.freeze(["low", "medium", "high", "urgent"]);
export const ALERT_STATUSES = Object.freeze(["open", "acknowledged", "resolved", "dismissed", "cancelled"]);
export const AUDIT_EVENT_TYPES = Object.freeze(["created", "updated", "deleted", "approved", "rejected", "synced", "linked", "viewed", "exported"]);
export const AUDIT_ACTOR_TYPES = Object.freeze(["user", "system", "service"]);

const SOURCE_MODULE_SET = new Set(SOURCE_MODULES);
const MATERIAL_NEED_STATUS_SET = new Set(MATERIAL_NEED_STATUSES);
const MATERIAL_REQUEST_STATUS_SET = new Set(MATERIAL_REQUEST_STATUSES);
const APPROVAL_STATUS_SET = new Set(APPROVAL_STATUSES);
const STOCK_MOVEMENT_TYPE_SET = new Set(STOCK_MOVEMENT_TYPES);
const ALERT_SEVERITY_SET = new Set(ALERT_SEVERITIES);
const ALERT_PRIORITY_SET = new Set(ALERT_PRIORITIES);
const ALERT_STATUS_SET = new Set(ALERT_STATUSES);
const AUDIT_EVENT_TYPE_SET = new Set(AUDIT_EVENT_TYPES);
const AUDIT_ACTOR_TYPE_SET = new Set(AUDIT_ACTOR_TYPES);

const SENSITIVE_KEY = /(secret|token|password|senha|authorization|api_?key|service_role|file_path|storage_path|internal_path|local_path|html_content|document_data|base64|raw_document|private_key|access_key)/i;
const INTERNAL_PATH = /(^[a-zA-Z]:\\|^\/|(^|[\\/])\.\.([\\/]|$)|\\Users\\|\/home\/|\/var\/|\/etc\/)/;

const UNIT_ALIASES = new Map([
  ["m2", "m2"],
  ["m²", "m2"],
  ["metro quadrado", "m2"],
  ["metros quadrados", "m2"],
  ["m3", "m3"],
  ["m³", "m3"],
  ["metro cubico", "m3"],
  ["metro cúbico", "m3"],
  ["metros cubicos", "m3"],
  ["metros cúbicos", "m3"],
  ["sc", "saco"],
  ["saco", "saco"],
  ["sacos", "saco"],
  ["cx", "caixa"],
  ["caixa", "caixa"],
  ["caixas", "caixa"],
  ["pc", "peca"],
  ["pç", "peca"],
  ["pca", "peca"],
  ["peça", "peca"],
  ["peças", "peca"],
  ["un", "un"],
  ["und", "un"],
  ["unidade", "un"],
  ["unidades", "un"],
  ["kg", "kg"],
  ["l", "l"],
  ["lt", "l"]
]);

function now() {
  return new Date().toISOString();
}

export function clean(value, max = 500) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeNumber(value, fallback = 0) {
  const number = finiteNumber(value);
  return number === null ? fallback : Math.max(0, number);
}

function positiveNumber(value) {
  const number = finiteNumber(value);
  return number !== null && number > 0 ? number : null;
}

export function normalizeIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeIdentifier(value, max = 160) {
  return clean(value, max);
}

function normalizeScope(input = {}) {
  return {
    institution_id: normalizeIdentifier(input.institution_id || input.institutionId),
    company_id: normalizeIdentifier(input.company_id || input.companyId),
    project_id: normalizeIdentifier(input.project_id || input.projectId)
  };
}

function sourceReference(input = {}) {
  const sourceModule = clean(input.source_module || input.sourceModule, 80);
  return {
    source_module: SOURCE_MODULE_SET.has(sourceModule) ? sourceModule : sourceModule,
    source_entity_type: clean(input.source_entity_type || input.sourceEntityType || input.entity_type || input.entityType, 120),
    source_entity_id: normalizeIdentifier(input.source_entity_id || input.sourceEntityId || input.id)
  };
}

export function validateScope(input = {}) {
  const errors = [];
  if (!clean(input.institution_id || input.institutionId)) errors.push("institution_id_required");
  if (!clean(input.company_id || input.companyId)) errors.push("company_id_required");
  if (!clean(input.project_id || input.projectId)) errors.push("project_id_required");
  return errors;
}

function validateSourceReference(input = {}) {
  const errors = [];
  if (!SOURCE_MODULE_SET.has(input.source_module)) errors.push("source_module_invalid");
  if (!clean(input.source_entity_type)) errors.push("source_entity_type_required");
  if (!clean(input.source_entity_id)) errors.push("source_entity_id_required");
  return errors;
}

export function normalizeUnit(value) {
  const original = clean(value || "un", 60) || "un";
  const key = original.normalize("NFKC").toLowerCase();
  return {
    original,
    canonical: UNIT_ALIASES.get(key) || key
  };
}

export function sanitizeMetadata(value, depth = 0) {
  if (depth > 8) return null;
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const text = clean(value, 4000);
    return INTERNAL_PATH.test(text) ? null : text;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item, depth + 1)).filter((item) => item !== null);
  }
  if (typeof value === "object") {
    return Object.entries(value).reduce((safe, [key, item]) => {
      if (SENSITIVE_KEY.test(key)) return safe;
      const sanitized = sanitizeMetadata(item, depth + 1);
      if (sanitized !== null) safe[clean(key, 100)] = sanitized;
      return safe;
    }, {});
  }
  return null;
}

function normalizeItem(input = {}) {
  const unit = normalizeUnit(input.unit || input.unidade || input.measure_unit || input.measureUnit);
  return {
    item_id: normalizeIdentifier(input.item_id || input.itemId || input.material_id || input.materialId || input.product_id || input.productId),
    code: clean(input.code || input.codigo || input.sku, 80),
    name: clean(input.name || input.nome || input.material || input.itemName || input.description || input.descricao, 240),
    unit: unit.original,
    canonical_unit: unit.canonical,
    quantity: nonNegativeNumber(input.quantity ?? input.quantidade ?? input.qtd ?? input.requested_quantity ?? input.requestedQuantity, 0),
    metadata: sanitizeMetadata(input.metadata || {})
  };
}

function validation(ok, errors) {
  return { ok, errors };
}

export function normalizeMaterialNeed(input = {}) {
  const scope = normalizeScope(input);
  const unit = normalizeUnit(input.unit || input.unidade || input.measure_unit || input.measureUnit);
  const requiredQuantity = nonNegativeNumber(input.required_quantity ?? input.requiredQuantity ?? input.planned_quantity ?? input.plannedQuantity ?? input.quantity ?? input.quantidade, 0);
  const availableQuantity = nonNegativeNumber(input.available_quantity ?? input.availableQuantity ?? input.current_quantity ?? input.currentQuantity, 0);
  const reservedQuantity = nonNegativeNumber(input.reserved_quantity ?? input.reservedQuantity, 0);
  const shortageInput = input.shortage_quantity ?? input.shortageQuantity;
  const shortageQuantity = shortageInput === undefined || shortageInput === null
    ? Math.max(0, requiredQuantity - availableQuantity - reservedQuantity)
    : nonNegativeNumber(shortageInput, 0);
  return {
    contract_version: ELO_OPERATIONAL_CONTRACT_VERSION,
    ...scope,
    ...sourceReference(input),
    material_id: normalizeIdentifier(input.material_id || input.materialId || input.item_id || input.itemId || input.product_id || input.productId),
    material_code: clean(input.material_code || input.materialCode || input.code || input.codigo || input.sku, 80),
    material_name: clean(input.material_name || input.materialName || input.name || input.nome || input.material || input.itemName || input.description, 240),
    unit: unit.original,
    canonical_unit: unit.canonical,
    required_quantity: requiredQuantity,
    available_quantity: availableQuantity,
    reserved_quantity: reservedQuantity,
    shortage_quantity: shortageQuantity,
    status: clean(input.status || "open", 80),
    needed_at: normalizeIsoDate(input.needed_at || input.neededAt || input.occurred_at || input.occurredAt),
    calculation_memory: sanitizeMetadata(input.calculation_memory || input.calculationMemory || {}),
    metadata: sanitizeMetadata(input.metadata || {})
  };
}

export function validateMaterialNeed(input = {}) {
  const errors = [
    ...validateScope(input),
    ...validateSourceReference(input)
  ];
  if (!clean(input.material_id) && !clean(input.material_code) && !clean(input.material_name)) errors.push("material_reference_required");
  if (!MATERIAL_NEED_STATUS_SET.has(input.status)) errors.push("status_invalid");
  if (positiveNumber(input.required_quantity) === null) errors.push("required_quantity_must_be_positive");
  if (input.available_quantity < 0 || input.reserved_quantity < 0 || input.shortage_quantity < 0) errors.push("quantity_must_be_non_negative");
  return validation(errors.length === 0, errors);
}

export function normalizeMaterialRequest(input = {}) {
  const scope = normalizeScope(input);
  const requestedQuantity = nonNegativeNumber(input.requested_quantity ?? input.requestedQuantity ?? input.quantity ?? input.quantidade, 0);
  const approvedQuantity = input.approved_quantity === undefined && input.approvedQuantity === undefined
    ? null
    : nonNegativeNumber(input.approved_quantity ?? input.approvedQuantity, 0);
  const deliveredQuantity = nonNegativeNumber(input.delivered_quantity ?? input.deliveredQuantity, 0);
  return {
    contract_version: ELO_OPERATIONAL_CONTRACT_VERSION,
    ...scope,
    ...sourceReference(input),
    request_id: normalizeIdentifier(input.request_id || input.requestId || input.id),
    requested_by: normalizeIdentifier(input.requested_by || input.requestedBy || input.created_by || input.createdBy),
    status: clean(input.status || "requested", 80),
    approval_status: clean(input.approval_status || input.approvalStatus || "pending", 80),
    requested_quantity: requestedQuantity,
    approved_quantity: approvedQuantity,
    delivered_quantity: deliveredQuantity,
    items: Array.isArray(input.items) ? input.items.map(normalizeItem) : [],
    requested_at: normalizeIsoDate(input.requested_at || input.requestedAt || input.created_at || input.createdAt),
    metadata: sanitizeMetadata(input.metadata || {})
  };
}

export function validateMaterialRequest(input = {}) {
  const errors = [
    ...validateScope(input),
    ...validateSourceReference(input)
  ];
  if (!clean(input.request_id)) errors.push("request_id_required");
  if (!MATERIAL_REQUEST_STATUS_SET.has(input.status)) errors.push("status_invalid");
  if (!APPROVAL_STATUS_SET.has(input.approval_status)) errors.push("approval_status_invalid");
  if (input.items.length === 0 && positiveNumber(input.requested_quantity) === null) errors.push("requested_quantity_or_items_required");
  if (input.items.some((item) => positiveNumber(item.quantity) === null)) errors.push("item_quantity_must_be_positive");
  if (input.approved_quantity !== null && input.delivered_quantity > input.approved_quantity) errors.push("delivered_quantity_exceeds_approved_quantity");
  return validation(errors.length === 0, errors);
}

export function normalizeStockMovementReference(input = {}) {
  const scope = normalizeScope(input);
  return {
    contract_version: ELO_OPERATIONAL_CONTRACT_VERSION,
    ...scope,
    ...sourceReference(input),
    movement_id: normalizeIdentifier(input.movement_id || input.movementId || input.id),
    movement_type: clean(input.movement_type || input.movementType || input.type || input.tipo, 80),
    item_id: normalizeIdentifier(input.item_id || input.itemId || input.product_id || input.productId),
    operation_id: normalizeIdentifier(input.operation_id || input.operationId),
    offline_uuid: normalizeIdentifier(input.offline_uuid || input.offlineUuid),
    device_id: normalizeIdentifier(input.device_id || input.deviceId),
    sync_status: clean(input.sync_status || input.syncStatus, 80),
    unit: normalizeUnit(input.unit || input.unidade).original,
    canonical_unit: normalizeUnit(input.unit || input.unidade).canonical,
    quantity: nonNegativeNumber(input.quantity ?? input.quantidade, 0),
    previous_balance: finiteNumber(input.previous_balance ?? input.previousBalance ?? input.before_quantity ?? input.beforeQuantity),
    new_balance: finiteNumber(input.new_balance ?? input.newBalance ?? input.after_quantity ?? input.afterQuantity),
    occurred_at: normalizeIsoDate(input.occurred_at || input.occurredAt || input.created_at || input.createdAt),
    metadata: sanitizeMetadata(input.metadata || {})
  };
}

export function validateStockMovementReference(input = {}) {
  const errors = [
    ...validateScope(input),
    ...validateSourceReference(input)
  ];
  if (!clean(input.movement_id)) errors.push("movement_id_required");
  if (!STOCK_MOVEMENT_TYPE_SET.has(input.movement_type)) errors.push("movement_type_invalid");
  if (!clean(input.item_id)) errors.push("item_id_required");
  if (positiveNumber(input.quantity) === null) errors.push("quantity_must_be_positive");
  return validation(errors.length === 0, errors);
}

export function normalizeOperationalAlert(input = {}) {
  const scope = normalizeScope(input);
  const hasIdempotencyKey = Object.prototype.hasOwnProperty.call(input, "idempotency_key")
    || Object.prototype.hasOwnProperty.call(input, "idempotencyKey");
  return {
    contract_version: ELO_OPERATIONAL_CONTRACT_VERSION,
    ...scope,
    ...sourceReference(input),
    alert_id: normalizeIdentifier(input.alert_id || input.alertId || input.pending_id || input.pendingId || input.id),
    title: clean(input.title || input.titulo || input.name, 240),
    description: clean(input.description || input.descricao || input.message, 2000),
    severity: clean(input.severity || "medium", 80),
    priority: clean(input.priority || "medium", 80),
    status: clean(input.status || "open", 80),
    idempotency_key: hasIdempotencyKey ? normalizeIdentifier(input.idempotency_key || input.idempotencyKey) : undefined,
    occurred_at: normalizeIsoDate(input.occurred_at || input.occurredAt || input.created_at || input.createdAt),
    due_at: normalizeIsoDate(input.due_at || input.dueAt),
    metadata: sanitizeMetadata(input.metadata || {})
  };
}

export function validateOperationalAlert(input = {}) {
  const errors = [
    ...validateScope(input),
    ...validateSourceReference(input)
  ];
  if (!clean(input.alert_id)) errors.push("alert_id_required");
  if (!clean(input.title)) errors.push("title_required");
  if (!ALERT_SEVERITY_SET.has(input.severity)) errors.push("severity_invalid");
  if (!ALERT_PRIORITY_SET.has(input.priority)) errors.push("priority_invalid");
  if (!ALERT_STATUS_SET.has(input.status)) errors.push("status_invalid");
  if (input.idempotency_key !== undefined && !clean(input.idempotency_key)) errors.push("idempotency_key_invalid");
  return validation(errors.length === 0, errors);
}

export function normalizeAuditEvent(input = {}) {
  const scope = normalizeScope(input);
  return {
    contract_version: ELO_OPERATIONAL_CONTRACT_VERSION,
    ...scope,
    ...sourceReference(input),
    audit_event_id: normalizeIdentifier(input.audit_event_id || input.auditEventId || input.event_id || input.eventId || input.id),
    event_type: clean(input.event_type || input.eventType || input.type, 80),
    actor_type: clean(input.actor_type || input.actorType || "user", 80),
    actor_id: normalizeIdentifier(input.actor_id || input.actorId || input.created_by || input.createdBy),
    previous_state: sanitizeMetadata(input.previous_state || input.previousState || input.before || {}),
    new_state: sanitizeMetadata(input.new_state || input.newState || input.after || {}),
    correlation_id: normalizeIdentifier(input.correlation_id || input.correlationId),
    causation_id: normalizeIdentifier(input.causation_id || input.causationId),
    occurred_at: normalizeIsoDate(input.occurred_at || input.occurredAt || input.created_at || input.createdAt) || now(),
    metadata: sanitizeMetadata(input.metadata || {})
  };
}

export function validateAuditEvent(input = {}) {
  const errors = [
    ...validateScope(input),
    ...validateSourceReference(input)
  ];
  if (!clean(input.audit_event_id)) errors.push("audit_event_id_required");
  if (!AUDIT_EVENT_TYPE_SET.has(input.event_type)) errors.push("event_type_invalid");
  if (!AUDIT_ACTOR_TYPE_SET.has(input.actor_type)) errors.push("actor_type_invalid");
  if (!clean(input.actor_id) && input.actor_type !== "system") errors.push("actor_id_required");
  return validation(errors.length === 0, errors);
}

function mergeScope(input, scope) {
  return { ...objectOf(input), ...normalizeScope({ ...objectOf(input), ...objectOf(scope) }) };
}

export function adaptEloNeedToMaterialNeed(input = {}, scope = {}) {
  const data = mergeScope(input, scope);
  return normalizeMaterialNeed({
    ...data,
    source_module: data.source_module || "elo_budget",
    source_entity_type: data.source_entity_type || "material_need",
    source_entity_id: data.source_entity_id || data.id || data.budget_id || data.budgetId || data.material_id || data.materialId,
    material_name: data.material_name || data.name || data.material || data.itemName || data.description,
    required_quantity: data.required_quantity ?? data.plannedQuantity ?? data.planned_quantity ?? data.quantity ?? data.quantidade,
    available_quantity: data.available_quantity ?? data.availableQuantity ?? data.currentQuantity ?? data.current_quantity
  });
}

export function adaptStockObrasItemToMaterialReference(input = {}) {
  if (!input || typeof input !== "object") return null;
  const unit = normalizeUnit(input.unit || input.unidade);
  return {
    item_id: normalizeIdentifier(input.item_id || input.itemId || input.id),
    code: clean(input.code || input.codigo || input.sku, 80),
    name: clean(input.name || input.nome || input.description || input.descricao, 240),
    unit: unit.original,
    canonical_unit: unit.canonical,
    metadata: sanitizeMetadata(input.metadata || {})
  };
}

export function adaptStockFullMovementToStockMovementReference(input = {}, scope = {}) {
  const data = mergeScope(input, scope);
  return normalizeStockMovementReference({
    ...data,
    source_module: data.source_module || "stock_full",
    source_entity_type: data.source_entity_type || "stock_movement",
    source_entity_id: data.source_entity_id || data.id || data.movement_id || data.movementId,
    movement_id: data.movement_id || data.movementId || data.id,
    movement_type: data.movement_type || data.movementType || data.type,
    item_id: data.item_id || data.itemId || data.product_id || data.productId
  });
}

export function adaptSentinelPendingToOperationalAlert(input = {}, scope = {}) {
  const data = mergeScope(input, scope);
  return normalizeOperationalAlert({
    ...data,
    source_module: data.source_module || "sentinel",
    source_entity_type: data.source_entity_type || data.sourceEntityType || "sentinel_pending",
    source_entity_id: data.source_entity_id || data.sourceEntityId || data.id || data.pending_id || data.pendingId,
    alert_id: data.alert_id || data.alertId || data.id || data.pending_id || data.pendingId,
    title: data.title || data.summary || data.name,
    description: data.description || data.details || data.message
  });
}

export function adaptTimelineEventToAuditEvent(input = {}, scope = {}) {
  const data = mergeScope(input, scope);
  return normalizeAuditEvent({
    ...data,
    source_module: data.source_module || "timeline",
    source_entity_type: data.source_entity_type || data.sourceEntityType || "operational_timeline_event",
    source_entity_id: data.source_entity_id || data.sourceEntityId || data.id || data.event_id || data.eventId,
    audit_event_id: data.audit_event_id || data.auditEventId || data.id || data.event_id || data.eventId,
    event_type: data.event_type || data.eventType || "linked",
    actor_id: data.actor_id || data.actorId || data.created_by || data.createdBy || "system",
    actor_type: data.actor_type || data.actorType || (data.created_by || data.createdBy ? "user" : "system")
  });
}

export function adaptRdoToSourceReference(input = {}, scope = {}) {
  if (!input || typeof input !== "object") return null;
  const data = mergeScope(input, scope);
  return {
    ...normalizeScope(data),
    source_module: "rdo",
    source_entity_type: "rdo",
    source_entity_id: normalizeIdentifier(data.id || data.rdo_id || data.rdoId),
    title: clean(data.title || data.titulo || data.number || data.numero || data.code || "RDO", 240),
    occurred_at: normalizeIsoDate(data.occurred_at || data.occurredAt || data.report_date || data.reportDate || data.date),
    metadata: sanitizeMetadata(data.metadata || {})
  };
}

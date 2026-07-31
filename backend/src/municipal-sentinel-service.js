import crypto from "node:crypto";
import { createSupabaseMunicipalAdminStore, municipalAdminInternals, toMunicipalAdminHttpError } from "./municipal-admin-service.js";

const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "leitura"]);
const WRITE_ROLES = new Set(["platform_admin", "municipal_admin", "gestor"]);
const ACTIVE = new Set(["active", "ativo"]);
const SENSITIVE_KEY = /token|secret|password|senha|authorization|bearer|service_role|storage_path|storagePath/i;

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function nowIso(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function error(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function isActive(row) {
  return ACTIVE.has(lower(row && row.status || "active"));
}

function hashId(parts) {
  return "msnt_" + crypto.createHash("sha1").update(parts.map(clean).join(":")).digest("hex").slice(0, 24);
}

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitize(value, depth = 0) {
  if (depth > 5) return null;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    out[key] = sanitize(item, depth + 1);
  }
  return out;
}

function assertRead(session) {
  if (!READ_ROLES.has(session.role)) throw error(403, "sentinel_access_forbidden");
}

function assertWrite(session) {
  if (!WRITE_ROLES.has(session.role)) throw error(403, "sentinel_write_forbidden");
}

async function assertInstitution(store, institutionId) {
  const id = clean(institutionId);
  if (!id) throw error(400, "institution_id_required");
  const institution = await store.get("institutions", id);
  if (!institution || !isActive(institution)) throw error(404, "institution_not_found");
  return id;
}

async function resolveInstitution(store, session, requestedInstitutionId) {
  if (session.role === "platform_admin") return await assertInstitution(store, requestedInstitutionId);
  const id = clean(session.institutionId);
  if (!id) throw error(403, "institution_scope_forbidden");
  if (requestedInstitutionId && clean(requestedInstitutionId) !== id) throw error(403, "institution_scope_forbidden");
  return await assertInstitution(store, id);
}

async function resolveUnit(store, session, institutionId, requestedUnitId) {
  const id = clean(requestedUnitId || (session.role === "gestor" ? session.unitId : ""));
  if (!id) return "";
  const unit = await store.get("units", id);
  if (!unit || clean(unit.institution_id) !== clean(institutionId) || !isActive(unit)) throw error(403, "unit_scope_forbidden");
  if (session.role === "gestor" && clean(session.unitId) !== id) throw error(403, "unit_scope_forbidden");
  return id;
}

async function safeList(store, table, filters, errors) {
  try {
    return await store.list(table, filters);
  } catch (err) {
    errors.push({ table, error: clean(err && (err.code || err.message)) || "source_failed" });
    return [];
  }
}

function approvedEntry(row) {
  return ["aprovada", "approved"].includes(lower(row && row.status));
}

function exitReason(row) {
  return clean(row && (row.purpose || row.destination_sector || row.reason || row.note));
}

function alert(base) {
  return Object.assign({
    id: hashId([base.institution_id, base.unit_id, base.rule_code, base.source_entity_type, base.source_entity_id]),
    severity: "medium",
    status: "open",
    evidence: [],
    responsible_user_id: "",
    due_at: null,
    detected_at: nowIso(),
    metadata: {}
  }, base, { metadata: sanitize(base.metadata || {}) });
}

function balanceFor(item, entries, exits, until = null) {
  const itemId = clean(item && item.id);
  const maxTime = until ? new Date(until).getTime() : Infinity;
  const inQty = entries
    .filter((entry) => clean(entry.item_id) === itemId && approvedEntry(entry) && new Date(entry.created_at || 0).getTime() <= maxTime)
    .reduce((sum, entry) => sum + number(entry.quantity), 0);
  const outQty = exits
    .filter((row) => clean(row.item_id) === itemId && new Date(row.created_at || 0).getTime() <= maxTime)
    .reduce((sum, row) => sum + number(row.quantity), 0);
  return inQty - outQty;
}

function applyActions(alerts, actions) {
  const byId = new Map();
  for (const action of actions) {
    if (!["sentinel_alert_acknowledged", "sentinel_alert_resolved"].includes(action.action)) continue;
    byId.set(clean(action.target_id), action.action === "sentinel_alert_resolved" ? "resolved" : "acknowledged");
  }
  return alerts.map((item) => Object.assign({}, item, { status: byId.get(item.id) || item.status }));
}

async function writeAudit(store, session, action, institutionId, targetId, metadata = {}) {
  await store.insert("municipal_admin_audit_log", {
    actor_user_id: clean(session.userId),
    institution_id: clean(institutionId),
    target_type: "municipal_sentinel_alert",
    target_id: clean(targetId),
    action,
    metadata: sanitize(metadata) || {},
    created_at: nowIso()
  });
}

async function buildAlerts(store, session, options = {}) {
  const institutionId = await resolveInstitution(store, session, options.institution_id || options.institutionId);
  const unitId = await resolveUnit(store, session, institutionId, options.unit_id || options.unitId);
  const filters = { institution_id: institutionId };
  const unitFilters = unitId ? Object.assign({}, filters, { unit_id: unitId }) : filters;
  const partialErrors = [];
  const [items, entries, exits, auditLog, docs, versions, actions] = await Promise.all([
    safeList(store, "stock_items", unitFilters, partialErrors),
    safeList(store, "stock_entries", unitFilters, partialErrors),
    safeList(store, "stock_exits", unitFilters, partialErrors),
    safeList(store, "stock_audit_log", unitFilters, partialErrors),
    safeList(store, "municipal_documents", unitFilters, partialErrors),
    safeList(store, "municipal_document_versions", unitFilters, partialErrors),
    safeList(store, "municipal_admin_audit_log", { institution_id: institutionId }, partialErrors)
  ]);
  const scopedItems = session.role === "gestor" && session.unitId ? items.filter((item) => clean(item.unit_id) === clean(session.unitId)) : items;
  const alerts = [];
  const movementDays = Math.max(1, Math.min(365, Number(options.movement_days || options.movementDays || 30)));
  const cutoff = Date.now() - movementDays * 24 * 60 * 60 * 1000;

  for (const item of scopedItems) {
    const current = balanceFor(item, entries, exits);
    const minimum = number(item.minimum_quantity);
    if (current === 0) alerts.push(alert({
      institution_id: institutionId,
      unit_id: clean(item.unit_id),
      rule_code: "item_zero_stock",
      title: "Item zerado",
      description: "Item sem saldo disponivel no almoxarifado.",
      severity: "high",
      evidence: [{ current_quantity: current, minimum_quantity: minimum }],
      detected_at: nowIso(),
      source_entity_type: "stock_items",
      source_entity_id: clean(item.id),
      metadata: { item_name: item.name, category: item.category }
    }));
    else if (minimum > 0 && current < minimum) alerts.push(alert({
      institution_id: institutionId,
      unit_id: clean(item.unit_id),
      rule_code: "item_below_minimum",
      title: "Item abaixo do minimo",
      description: "Item com saldo abaixo do minimo configurado.",
      severity: "medium",
      evidence: [{ current_quantity: current, minimum_quantity: minimum }],
      detected_at: nowIso(),
      source_entity_type: "stock_items",
      source_entity_id: clean(item.id),
      metadata: { item_name: item.name, category: item.category }
    }));

    const itemMovements = entries.concat(exits).filter((row) => clean(row.item_id) === clean(item.id));
    const latest = itemMovements.map((row) => new Date(row.created_at || 0).getTime()).filter(Boolean).sort((a, b) => b - a)[0] || 0;
    if (itemMovements.length && latest < cutoff) alerts.push(alert({
      institution_id: institutionId,
      unit_id: clean(item.unit_id),
      rule_code: "movement_absent_period",
      title: "Ausencia de movimentacao",
      description: "Item sem movimentacao dentro do periodo configurado.",
      severity: "low",
      evidence: [{ movement_days: movementDays, last_movement_at: latest ? new Date(latest).toISOString() : null }],
      detected_at: nowIso(),
      source_entity_type: "stock_items",
      source_entity_id: clean(item.id),
      metadata: { item_name: item.name }
    }));
  }

  for (const row of exits) {
    const item = scopedItems.find((candidate) => clean(candidate.id) === clean(row.item_id));
    if (!item) continue;
    const before = balanceFor(item, entries, exits.filter((candidate) => clean(candidate.id) !== clean(row.id)), row.created_at);
    if (number(row.quantity) > before) alerts.push(alert({
      institution_id: institutionId,
      unit_id: clean(row.unit_id),
      rule_code: "exit_exceeds_available_balance",
      title: "Saida maior que saldo disponivel",
      description: "Saida registrada com quantidade superior ao saldo disponivel antes da movimentacao.",
      severity: "critical",
      evidence: [{ available_before: before, exit_quantity: number(row.quantity) }],
      responsible_user_id: clean(row.created_by),
      detected_at: nowIso(),
      source_entity_type: "stock_exits",
      source_entity_id: clean(row.id),
      metadata: { item_id: row.item_id }
    }));
    if (!exitReason(row)) alerts.push(alert({
      institution_id: institutionId,
      unit_id: clean(row.unit_id),
      rule_code: "movement_without_reason",
      title: "Movimentacao sem justificativa",
      description: "Saida registrada sem justificativa operacional.",
      severity: "medium",
      evidence: [{ quantity: number(row.quantity), created_at: row.created_at }],
      responsible_user_id: clean(row.created_by),
      detected_at: nowIso(),
      source_entity_type: "stock_exits",
      source_entity_id: clean(row.id),
      metadata: { item_id: row.item_id }
    }));
  }

  const activeReports = docs.filter((doc) => lower(doc.document_type) === "relatorio" && lower(doc.status) === "active");
  for (const unit of new Set(scopedItems.map((item) => clean(item.unit_id)).filter(Boolean))) {
    if (!activeReports.some((doc) => clean(doc.unit_id) === unit)) alerts.push(alert({
      institution_id: institutionId,
      unit_id: unit,
      rule_code: "required_report_missing",
      title: "Relatorio obrigatorio ausente",
      description: "Unidade com operacao de almoxarifado sem relatorio ativo no Acervo Municipal.",
      severity: "medium",
      due_at: nowIso(),
      detected_at: nowIso(),
      source_entity_type: "units",
      source_entity_id: unit,
      metadata: { required_document_type: "relatorio" }
    }));
  }

  for (const doc of docs.filter((item) => lower(item.status) === "archived")) {
    const replacement = docs.some((candidate) => candidate.id !== doc.id && lower(candidate.status) === "active" && lower(candidate.document_type) === lower(doc.document_type) && clean(candidate.unit_id) === clean(doc.unit_id));
    if (!replacement) alerts.push(alert({
      institution_id: institutionId,
      unit_id: clean(doc.unit_id),
      rule_code: "archived_document_without_replacement",
      title: "Documento arquivado sem substituto ativo",
      description: "Documento arquivado sem outro documento ativo equivalente para a mesma unidade.",
      severity: "low",
      detected_at: nowIso(),
      source_entity_type: "municipal_documents",
      source_entity_id: clean(doc.id),
      metadata: { document_type: doc.document_type, current_version: doc.current_version, versions_count: versions.filter((v) => clean(v.document_id) === clean(doc.id)).length }
    }));
  }

  const cancelCounts = new Map();
  for (const row of auditLog.filter((item) => /cancel/i.test(clean(item.action)))) {
    const key = [clean(row.entity_type || row.target_type || "stock_audit_log"), clean(row.entity_id || row.target_id || row.id)].join(":");
    cancelCounts.set(key, (cancelCounts.get(key) || 0) + 1);
  }
  for (const [key, count] of cancelCounts) if (count >= 2) alerts.push(alert({
    institution_id: institutionId,
    unit_id: unitId,
    rule_code: "repeated_cancellations",
    title: "Cancelamentos repetidos",
    description: "Ocorrencia com cancelamentos repetidos identificados na auditoria.",
    severity: "medium",
    evidence: [{ count }],
    detected_at: nowIso(),
    source_entity_type: "stock_audit_log",
    source_entity_id: key,
    metadata: { count }
  }));

  const deduped = Array.from(new Map(alerts.map((item) => [item.id, item])).values());
  return { institutionId, unitId, alerts: applyActions(deduped, actions), partial_errors: partialErrors };
}

export function createMunicipalSentinelService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);

  return {
    async listAlerts(context, query = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertRead(session);
      const result = await buildAlerts(store, session, query);
      return { alerts: result.alerts, partial_errors: result.partial_errors };
    },

    async getAlert(context, alertId, query = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertRead(session);
      const result = await buildAlerts(store, session, query);
      const found = result.alerts.find((item) => item.id === clean(alertId));
      if (!found) throw error(404, "sentinel_alert_not_found");
      return { alert: found, partial_errors: result.partial_errors };
    },

    async scan(context, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const result = await buildAlerts(store, session, body);
      await writeAudit(store, session, "sentinel_scan_executed", result.institutionId, hashId([result.institutionId, result.unitId, "scan", nowIso()]), { alerts_count: result.alerts.length, unit_id: result.unitId });
      return { alerts: result.alerts, partial_errors: result.partial_errors };
    },

    async acknowledge(context, alertId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const result = await buildAlerts(store, session, body);
      const found = result.alerts.find((item) => item.id === clean(alertId));
      if (!found) throw error(404, "sentinel_alert_not_found");
      await writeAudit(store, session, "sentinel_alert_acknowledged", result.institutionId, found.id, { rule_code: found.rule_code });
      return { alert: Object.assign({}, found, { status: "acknowledged" }) };
    },

    async resolve(context, alertId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const result = await buildAlerts(store, session, body);
      const found = result.alerts.find((item) => item.id === clean(alertId));
      if (!found) throw error(404, "sentinel_alert_not_found");
      await writeAudit(store, session, "sentinel_alert_resolved", result.institutionId, found.id, { rule_code: found.rule_code });
      return { alert: Object.assign({}, found, { status: "resolved" }) };
    }
  };
}

export { createSupabaseMunicipalAdminStore as createSupabaseMunicipalSentinelStore, toMunicipalAdminHttpError as toMunicipalSentinelHttpError };

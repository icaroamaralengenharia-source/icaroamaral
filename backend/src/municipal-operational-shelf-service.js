import { municipalAdminInternals } from "./municipal-admin-service.js";

const STAFF_ROLES = new Set(["platform_admin", "municipal_admin", "gestor"]);
const ACTIVE = new Set(["active", "ativo"]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function isActive(value) {
  const status = lower(value || "active");
  return ACTIVE.has(status);
}

function error(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function isSensitiveKey(key) {
  return /token|secret|password|authorization|bearer|service_role|key/i.test(clean(key));
}

function sanitize(value, depth = 0) {
  if (depth > 4) return null;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    out[key] = sanitize(item, depth + 1);
  }
  return out;
}

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function dateValue(value) {
  const time = new Date(clean(value)).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sortByDateDesc(list, field = "created_at") {
  return list.slice().sort((a, b) => dateValue(b && b[field]) - dateValue(a && a[field]));
}

function limited(list, limit) {
  return list.slice(0, Math.max(0, limit || 20));
}

async function safeList(store, table, filters, errors) {
  try {
    return await store.list(table, filters || {});
  } catch (err) {
    errors.push({ table, error: clean(err && (err.code || err.message)) || "query_failed" });
    return [];
  }
}

function itemName(itemId, itemsById) {
  const item = itemsById.get(clean(itemId));
  return clean(item && item.name) || clean(itemId) || "Item";
}

function normalizeItem(item, currentQuantity) {
  const minimum = toNumber(item.minimum_quantity);
  const current = toNumber(currentQuantity);
  let situation = "sem_configuracao";
  if (current <= 0) situation = "zerado";
  else if (minimum > 0 && current < minimum) situation = "baixo";
  else if (minimum > 0) situation = "normal";
  return {
    id: clean(item.id),
    institution_id: clean(item.institution_id),
    unit_id: clean(item.unit_id),
    name: clean(item.name),
    category: clean(item.category),
    unit: clean(item.unit),
    minimum_quantity: minimum,
    current_quantity: current,
    situation,
    location: clean(item.location),
    batch: clean(item.batch),
    expiration_date: clean(item.expiration_date),
    updated_at: clean(item.updated_at || item.created_at),
    created_at: clean(item.created_at)
  };
}

function normalizeMovement(row, type, itemsById) {
  return {
    id: clean(row.id),
    type,
    item_id: clean(row.item_id),
    item_name: itemName(row.item_id, itemsById),
    quantity: toNumber(row.quantity),
    status: clean(row.status),
    source: clean(row.source) || "stock_saude",
    responsible: clean(row.responsible_name || row.requested_by || row.created_by || row.approved_by),
    reason: clean(row.purpose || row.source || row.invoice_number || row.destination_sector),
    destination: clean(row.destination_sector),
    created_at: clean(row.created_at || row.approved_at)
  };
}

function normalizeAudit(row) {
  return {
    id: clean(row.id),
    action: clean(row.action),
    entity_type: clean(row.entity_type),
    entity_id: clean(row.entity_id),
    user: clean(row.profile_id),
    unit_id: clean(row.unit_id),
    summary: clean(row.action || row.entity_type),
    metadata: sanitize(row.metadata || {}),
    created_at: clean(row.created_at)
  };
}

function assertUnitAccess(session, unit) {
  if (!STAFF_ROLES.has(session.role)) throw error(403, "municipal_operational_access_forbidden");
  if (!unit) throw error(404, "unit_not_found");
  if (session.role !== "platform_admin" && clean(unit.institution_id) !== clean(session.institutionId)) {
    throw error(403, "institution_scope_forbidden");
  }
  if (session.role === "gestor" && clean(session.unitId) && clean(unit.id) !== clean(session.unitId)) {
    throw error(403, "unit_scope_forbidden");
  }
  return unit;
}

function buildDashboard(unit, items, entries, exits, audit, errors) {
  const itemsById = new Map(items.map((item) => [clean(item.id), item]));
  const entryTotals = new Map();
  const exitTotals = new Map();
  entries.forEach((entry) => {
    if (lower(entry.status || "aprovada") === "rejeitada") return;
    const id = clean(entry.item_id);
    entryTotals.set(id, toNumber(entryTotals.get(id)) + toNumber(entry.quantity));
  });
  exits.forEach((exit) => {
    const id = clean(exit.item_id);
    exitTotals.set(id, toNumber(exitTotals.get(id)) + toNumber(exit.quantity));
  });
  const normalizedItems = items.map((item) => normalizeItem(item, toNumber(entryTotals.get(clean(item.id))) - toNumber(exitTotals.get(clean(item.id)))));
  const normalizedEntries = sortByDateDesc(entries).map((row) => normalizeMovement(row, "entrada", itemsById));
  const normalizedExits = sortByDateDesc(exits).map((row) => normalizeMovement(row, "saida", itemsById));
  const movements = sortByDateDesc(normalizedEntries.concat(normalizedExits));
  const alerts = normalizedItems
    .filter((item) => item.situation === "baixo" || item.situation === "zerado")
    .map((item) => ({ id: "stock_" + item.id, type: item.situation === "zerado" ? "item_zerado" : "estoque_baixo", severity: item.situation === "zerado" ? "high" : "medium", title: item.name, item_id: item.id, current_quantity: item.current_quantity, minimum_quantity: item.minimum_quantity }));
  const normalizedAudit = sortByDateDesc(audit).map(normalizeAudit);
  const lastMovement = movements[0] || null;
  const lastAudit = normalizedAudit[0] || null;
  return {
    unit: {
      id: clean(unit.id),
      institution_id: clean(unit.institution_id),
      name: clean(unit.name),
      code: clean(unit.code || unit.type),
      address: clean(unit.address),
      status: clean(unit.status || "active"),
      is_active: isActive(unit.status)
    },
    metrics: {
      total_items: normalizedItems.length,
      total_quantity: normalizedItems.reduce((sum, item) => sum + toNumber(item.current_quantity), 0),
      low_stock_items: normalizedItems.filter((item) => item.situation === "baixo").length,
      zero_stock_items: normalizedItems.filter((item) => item.situation === "zerado").length,
      recent_entries: normalizedEntries.length,
      recent_exits: normalizedExits.length,
      open_alerts: alerts.length,
      last_movement_at: clean(lastMovement && lastMovement.created_at),
      last_audit_at: clean(lastAudit && lastAudit.created_at)
    },
    items: normalizedItems,
    movements: limited(movements, 20),
    alerts,
    audit_log: limited(normalizedAudit, 20),
    sources: {
      items: "stock_items",
      entries: "stock_entries",
      exits: "stock_exits",
      audit_log: "stock_audit_log"
    },
    partial_errors: errors
  };
}

export function createMunicipalOperationalShelfService(options = {}) {
  const store = options.store;
  if (!store) throw error(503, "municipal_operational_store_not_configured");
  return {
    async getOperationalDashboard(context, unitId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      const id = clean(unitId);
      if (!id) throw error(400, "unit_id_required");
      const unit = assertUnitAccess(session, await store.get("units", id));
      const institutionId = clean(unit.institution_id);
      const errors = [];
      const filters = { institution_id: institutionId, unit_id: id };
      const [items, entries, exits, audit] = await Promise.all([
        safeList(store, "stock_items", filters, errors),
        safeList(store, "stock_entries", filters, errors),
        safeList(store, "stock_exits", filters, errors),
        safeList(store, "stock_audit_log", filters, errors)
      ]);
      return { dashboard: buildDashboard(unit, items, entries, exits, audit, errors) };
    }
  };
}
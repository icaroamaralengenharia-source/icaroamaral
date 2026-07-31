import { createSupabaseMunicipalAdminStore, municipalAdminInternals, toMunicipalAdminHttpError } from "./municipal-admin-service.js";
import { createMunicipalSentinelService } from "./municipal-sentinel-service.js";

const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "leitura"]);
const REPORT_TYPES = [
  { id: "stock", label: "Relatorio de estoque" },
  { id: "movements", label: "Relatorio de movimentacoes" },
  { id: "inventory", label: "Inventario" },
  { id: "conference", label: "Conferencia" },
  { id: "divergence", label: "Divergencia" },
  { id: "accountability", label: "Prestacao de contas" },
  { id: "receipt_term", label: "Termo de recebimento" },
  { id: "administrative", label: "Relatorio administrativo" }
];
const REPORT_TYPE_IDS = new Set(REPORT_TYPES.map((item) => item.id));
const SENSITIVE_KEY = /token|secret|password|senha|authorization|bearer|service_role|storage_path|storagePath/i;

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function makeError(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function nowIso(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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

function number(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function approvedEntry(row) {
  return ["aprovada", "approved", "active"].includes(lower(row && row.status));
}

function inPeriod(row, period) {
  const time = new Date(row && row.created_at || 0).getTime();
  const from = clean(period && period.from);
  const to = clean(period && period.to);
  const fromTime = from ? new Date(from).getTime() : -Infinity;
  const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
  return Number.isFinite(time) && time >= fromTime && time <= toTime;
}

function htmlEscape(value) {
  return clean(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

async function safeList(store, table, filters, errors) {
  try {
    return await store.list(table, filters);
  } catch (err) {
    errors.push({ table, error: clean(err && (err.code || err.message)) || "source_failed" });
    return [];
  }
}

async function resolveInstitution(store, session, requestedInstitutionId) {
  if (session.role === "platform_admin") {
    const id = clean(requestedInstitutionId);
    if (!id) throw makeError(400, "institution_id_required");
    const institution = await store.get("institutions", id);
    if (!institution) throw makeError(404, "institution_not_found");
    return { institutionId: id, institution };
  }
  const id = clean(session.institutionId);
  if (!id) throw makeError(403, "institution_scope_forbidden");
  if (requestedInstitutionId && clean(requestedInstitutionId) !== id) throw makeError(403, "institution_scope_forbidden");
  const institution = await store.get("institutions", id);
  if (!institution) throw makeError(404, "institution_not_found");
  return { institutionId: id, institution };
}

async function resolveUnit(store, session, institutionId, requestedUnitId) {
  const id = clean(requestedUnitId || (session.role === "gestor" ? session.unitId : ""));
  if (!id) return { unitId: "", unit: null };
  const unit = await store.get("units", id);
  if (!unit || clean(unit.institution_id) !== clean(institutionId)) throw makeError(403, "unit_scope_forbidden");
  if (session.role === "gestor" && clean(session.unitId) !== id) throw makeError(403, "unit_scope_forbidden");
  return { unitId: id, unit };
}

function balanceFor(item, entries, exits) {
  const itemId = clean(item && item.id);
  const entriesQuantity = entries.filter((entry) => clean(entry.item_id) === itemId && approvedEntry(entry)).reduce((sum, entry) => sum + number(entry.quantity), 0);
  const exitsQuantity = exits.filter((exit) => clean(exit.item_id) === itemId).reduce((sum, exit) => sum + number(exit.quantity), 0);
  return entriesQuantity - exitsQuantity;
}

function periodFrom(body = {}) {
  const period = body.period || {};
  return {
    from: clean(body.date_from || body.from || period.from || period.start),
    to: clean(body.date_to || body.to || period.to || period.end)
  };
}

function buildSections(type, data) {
  const lowStock = data.items.filter((item) => number(item.balance) < number(item.minimum_quantity || 0));
  const noData = !data.items.length && !data.entries.length && !data.exits.length;
  const pendingAlerts = data.alerts.filter((item) => lower(item.status) === "open");
  return [
    { id: "context", title: "Contexto", items: [`Prefeitura: ${data.institution.name || data.institution.id}`, `Almoxarifado: ${data.unit ? data.unit.name : "Todos"}`, `Periodo: ${data.period.from || "inicio"} a ${data.period.to || "atual"}`] },
    { id: "stock", title: "Itens e saldo", items: data.items.map((item) => `${item.name}: saldo ${item.balance} ${item.unit || ""}`) },
    { id: "entries", title: "Entradas", items: data.entries.map((entry) => `${entry.item_name}: +${entry.quantity} em ${clean(entry.created_at).slice(0, 10)}`) },
    { id: "exits", title: "Saidas", items: data.exits.map((exit) => `${exit.item_name}: -${exit.quantity} em ${clean(exit.created_at).slice(0, 10)}`) },
    { id: "alerts", title: "Alertas do Sentinela", items: data.alerts.map((alert) => `${alert.rule_code}: ${alert.title}`) },
    { id: "pending", title: "Pendencias", items: pendingAlerts.map((alert) => `${alert.title} (${alert.severity})`) },
    { id: "conclusion", title: "Conclusao", items: [noData ? "Ausencia de dados declarada para o periodo/unidade consultados." : `Rascunho ${type} gerado com ${data.items.length} item(ns), ${data.entries.length} entrada(s), ${data.exits.length} saida(s) e ${lowStock.length} item(ns) abaixo do minimo.`] }
  ];
}

function buildHtml(report) {
  const sections = report.sections.map((section) => {
    const items = section.items.length ? section.items.map((item) => `<li>${htmlEscape(item)}</li>`).join("") : "<li>Nenhum dado encontrado.</li>";
    return `<section><h2>${htmlEscape(section.title)}</h2><ul>${items}</ul></section>`;
  }).join("");
  return `<article class="municipal-report"><h1>${htmlEscape(report.title)}</h1>${sections}</article>`;
}

function publicTypes() {
  return REPORT_TYPES.map((item) => Object.assign({}, item));
}

export function createMunicipalReportService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const sentinel = options.sentinelService || createMunicipalSentinelService({ store });
  const now = options.now || (() => new Date());

  async function collectData(context, body = {}) {
    const session = municipalAdminInternals.sessionFromContext(context);
    if (!READ_ROLES.has(session.role)) throw makeError(403, "municipal_report_access_forbidden");
    const type = clean(body.type || body.report_type || "stock");
    if (!REPORT_TYPE_IDS.has(type)) throw makeError(400, "municipal_report_type_invalid");
    const { institutionId, institution } = await resolveInstitution(store, session, body.institution_id || body.institutionId);
    const { unitId, unit } = await resolveUnit(store, session, institutionId, body.unit_id || body.unitId);
    const filters = unitId ? { institution_id: institutionId, unit_id: unitId } : { institution_id: institutionId };
    const period = periodFrom(body);
    const errors = [];
    const [itemsRaw, entriesRaw, exitsRaw] = await Promise.all([
      safeList(store, "stock_items", filters, errors),
      safeList(store, "stock_entries", filters, errors),
      safeList(store, "stock_exits", filters, errors)
    ]);
    const itemIds = new Set(itemsRaw.map((item) => clean(item.id)));
    const itemNames = new Map(itemsRaw.map((item) => [clean(item.id), clean(item.name)]));
    const entries = entriesRaw.filter((entry) => itemIds.has(clean(entry.item_id)) && inPeriod(entry, period)).map((entry) => sanitize(Object.assign({}, entry, { item_name: itemNames.get(clean(entry.item_id)) || clean(entry.item_id) })));
    const exits = exitsRaw.filter((exit) => itemIds.has(clean(exit.item_id)) && inPeriod(exit, period)).map((exit) => sanitize(Object.assign({}, exit, { item_name: itemNames.get(clean(exit.item_id)) || clean(exit.item_id) })));
    const items = itemsRaw.map((item) => sanitize(Object.assign({}, item, { balance: balanceFor(item, entriesRaw, exitsRaw) })));
    let alerts = [];
    try {
      alerts = (await sentinel.listAlerts(context, { institution_id: institutionId, unit_id: unitId })).alerts || [];
    } catch (err) {
      errors.push({ table: "municipal_sentinel", error: clean(err && (err.code || err.message)) || "source_failed" });
    }
    return { session, type, institutionId, unitId, institution: sanitize(institution), unit: sanitize(unit), period, items, entries, exits, alerts: alerts.map(sanitize), partial_errors: errors };
  }

  async function buildDraft(context, body = {}, mode = "preview") {
    const data = await collectData(context, body);
    const typeInfo = REPORT_TYPES.find((item) => item.id === data.type);
    const title = clean(body.title) || `${typeInfo.label} Municipal`;
    const report = {
      id: `municipal-report-draft-${data.type}`,
      mode,
      type: data.type,
      title,
      status: mode === "generate" ? "generated_draft" : "preview",
      generated_at: nowIso(now),
      institution_id: data.institutionId,
      unit_id: data.unitId || null,
      project_id: undefined,
      responsible_user_id: clean(data.session.userId),
      requires_human_confirmation: true,
      acervo_saved: false,
      upload_performed: false,
      data_sources: ["institutions", "units", "stock_items", "stock_entries", "stock_exits", "municipal_sentinel_alerts"],
      summary: {
        items_count: data.items.length,
        entries_count: data.entries.length,
        exits_count: data.exits.length,
        alerts_count: data.alerts.length,
        pending_count: data.alerts.filter((item) => lower(item.status) === "open").length
      },
      prefeitura: data.institution,
      almoxarifado: data.unit,
      period: data.period,
      items: data.items,
      entries: data.entries,
      exits: data.exits,
      alerts: data.alerts,
      pending: data.alerts.filter((item) => lower(item.status) === "open"),
      sections: buildSections(data.type, data),
      conclusion: "",
      partial_errors: data.partial_errors
    };
    report.conclusion = report.sections.find((section) => section.id === "conclusion").items[0];
    report.html = buildHtml(report);
    return { report };
  }

  return {
    listTypes() {
      return { types: publicTypes() };
    },
    preview(context, body = {}) {
      return buildDraft(context, body, "preview");
    },
    generate(context, body = {}) {
      return buildDraft(context, body, "generate");
    }
  };
}

export function createSupabaseMunicipalReportStore(database) {
  return createSupabaseMunicipalAdminStore(database);
}

export function toMunicipalReportHttpError(err) {
  return toMunicipalAdminHttpError(err);
}

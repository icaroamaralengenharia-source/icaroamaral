import { createSupabaseMunicipalAdminStore, municipalAdminInternals } from "./municipal-admin-service.js";
import { createMunicipalSentinelService } from "./municipal-sentinel-service.js";

const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "leitura"]);
const MUNICIPAL_HINT = /prefeitura|almoxarifado|unidade municipal|estoque municipal|sentinela municipal|acervo municipal|auditoria municipal/i;
const SENSITIVE_KEY = /token|secret|password|senha|authorization|bearer|service_role|storage_path|storagePath/i;

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function normalizeText(value) {
  return lower(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function makeError(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
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

function asNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText(value) {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString().slice(0, 10);
}

function approvedEntry(row) {
  return ["aprovada", "approved", "active"].includes(lower(row && row.status));
}

async function safeList(store, table, filters, errors) {
  try {
    return await store.list(table, filters);
  } catch (err) {
    errors.push({ tool: table, error: clean(err && (err.code || err.message)) || "tool_failed" });
    return [];
  }
}

async function assertInstitution(store, session, requestedInstitutionId) {
  if (session.role === "platform_admin") {
    const id = clean(requestedInstitutionId);
    if (!id) throw makeError(400, "institution_id_required");
    const institution = await store.get("institutions", id);
    if (!institution) throw makeError(404, "institution_not_found");
    return id;
  }
  const id = clean(session.institutionId);
  if (!id) throw makeError(403, "institution_scope_forbidden");
  if (requestedInstitutionId && clean(requestedInstitutionId) !== id) throw makeError(403, "institution_scope_forbidden");
  return id;
}

async function assertUnit(store, session, institutionId, requestedUnitId) {
  const id = clean(requestedUnitId || (session.role === "gestor" ? session.unitId : ""));
  if (!id) return "";
  const unit = await store.get("units", id);
  if (!unit || clean(unit.institution_id) !== clean(institutionId)) throw makeError(403, "unit_scope_forbidden");
  if (session.role === "gestor" && clean(session.unitId) !== id) throw makeError(403, "unit_scope_forbidden");
  return id;
}

function balanceFor(item, entries, exits) {
  const itemId = clean(item && item.id);
  const entriesQuantity = entries
    .filter((entry) => clean(entry.item_id) === itemId && approvedEntry(entry))
    .reduce((sum, entry) => sum + asNumber(entry.quantity), 0);
  const exitsQuantity = exits
    .filter((row) => clean(row.item_id) === itemId)
    .reduce((sum, row) => sum + asNumber(row.quantity), 0);
  return { entries_quantity: entriesQuantity, exits_quantity: exitsQuantity, current_quantity: entriesQuantity - exitsQuantity };
}

function movementReason(row) {
  return clean(row && (row.source || row.invoice_number || row.purpose || row.destination_sector || row.reason || row.note));
}

function filterPeriod(rows, options = {}) {
  const from = clean(options.date_from || options.dateFrom);
  const to = clean(options.date_to || options.dateTo);
  const fromTime = from ? new Date(from).getTime() : -Infinity;
  const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
  return rows.filter((row) => {
    const time = new Date(row.created_at || 0).getTime();
    return Number.isFinite(time) && time >= fromTime && time <= toTime;
  });
}

function shouldUseMunicipalTools(message, context = {}) {
  const normalized = normalizeText(message);
  const contextText = normalizeText(context.eloContext || context.mode || context.scope || context.module);
  return MUNICIPAL_HINT.test(normalized) || contextText.includes("municipal");
}

function answerSections({ main, data, assumptions, alerts, next }) {
  return [
    "Resposta principal:",
    main || "Nao encontrei dados suficientes para responder com seguranca.",
    "",
    "Dados consultados:",
    data && data.length ? data.map((item) => "- " + item).join("\n") : "- Nenhum dado municipal disponivel na consulta.",
    "",
    "Premissas:",
    assumptions && assumptions.length ? assumptions.map((item) => "- " + item).join("\n") : "- Usei somente dados municipais autorizados da sessao.",
    "",
    "Alertas:",
    alerts && alerts.length ? alerts.map((item) => "- " + item).join("\n") : "- Nenhum alerta adicional identificado nesta resposta.",
    "",
    "Proxima acao sugerida:",
    next || "Validar os dados no painel municipal antes de qualquer acao operacional."
  ].join("\n");
}

function buildMainAnswer(question, snapshot) {
  const text = normalizeText(question);
  if (/abaixo do minimo/.test(text)) {
    const rows = snapshot.stock.filter((item) => item.current_quantity > 0 && item.current_quantity < asNumber(item.minimum_quantity));
    return rows.length ? "Itens abaixo do minimo: " + rows.map((item) => `${item.name} (${item.current_quantity}/${item.minimum_quantity})`).join(", ") + "." : "Nao ha itens abaixo do minimo nos dados consultados.";
  }
  if (/zerad/.test(text)) {
    const rows = snapshot.stock.filter((item) => item.current_quantity === 0);
    return rows.length ? "Itens zerados: " + rows.map((item) => item.name).join(", ") + "." : "Nao ha itens zerados nos dados consultados.";
  }
  if (/saldo.*cai|caiu|redu/.test(text)) {
    const exits = snapshot.movements.filter((item) => item.type === "saida");
    return exits.length ? "O saldo caiu pelas saidas registradas: " + exits.slice(0, 6).map((item) => `${item.item_name}: ${item.quantity} em ${dateText(item.created_at)} (${item.reason || "sem justificativa"})`).join("; ") + "." : "Nao encontrei saidas que expliquem reducao de saldo.";
  }
  if (/movimenta|periodo/.test(text)) {
    return snapshot.movements.length ? "Movimentacoes do periodo: " + snapshot.movements.slice(0, 8).map((item) => `${item.type} ${item.item_name} ${item.quantity} em ${dateText(item.created_at)}`).join("; ") + "." : "Nao encontrei movimentacoes no periodo consultado.";
  }
  if (/alerta|sentinela/.test(text)) {
    const open = snapshot.alerts.filter((item) => lower(item.status) === "open");
    return open.length ? "Alertas abertos: " + open.slice(0, 8).map((item) => `${item.rule_code}: ${item.title}`).join("; ") + "." : "Nao ha alertas abertos nos dados consultados.";
  }
  if (/inventario|relatorio|documento|acervo/.test(text)) {
    const docs = snapshot.documents.filter((item) => ["inventario", "relatorio"].includes(lower(item.document_type)));
    return docs.length ? "Documento localizado: " + docs[0].title + " (" + docs[0].document_type + ", versao " + asNumber(docs[0].current_version) + ")." : "Nao encontrei inventario ou relatorio ativo nos documentos consultados.";
  }
  if (/auditoria|acoes recentes/.test(text)) {
    return snapshot.audit.length ? "Acoes recentes da auditoria: " + snapshot.audit.slice(0, 8).map((item) => `${item.action} em ${dateText(item.created_at)}`).join("; ") + "." : "Nao encontrei acoes recentes de auditoria nos dados consultados.";
  }
  return "Consultei unidades, estoque, movimentacoes, alertas, documentos e auditoria municipais autorizados.";
}

function dataLines(snapshot) {
  return [
    `${snapshot.units.length} unidade(s) autorizada(s)`,
    `${snapshot.stock.length} item(ns) de estoque`,
    `${snapshot.movements.length} movimentacao(oes)`,
    `${snapshot.alerts.length} alerta(s) do Sentinela Municipal`,
    `${snapshot.documents.length} documento(s) do Acervo Municipal`,
    `${snapshot.audit.length} registro(s) de auditoria`
  ];
}

export function createEloMunicipalTools(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const sentinel = options.sentinelService || createMunicipalSentinelService({ store });

  async function buildSnapshot(context, query = {}) {
    const session = municipalAdminInternals.sessionFromContext(context);
    if (!READ_ROLES.has(session.role)) throw makeError(403, "elo_municipal_access_forbidden");
    const institutionId = await assertInstitution(store, session, query.institution_id || query.institutionId);
    const unitId = await assertUnit(store, session, institutionId, query.unit_id || query.unitId);
    const filters = unitId ? { institution_id: institutionId, unit_id: unitId } : { institution_id: institutionId };
    const partialErrors = [];
    const [unitsRaw, itemsRaw, entriesRaw, exitsRaw, documentsRaw, auditRaw] = await Promise.all([
      safeList(store, "units", { institution_id: institutionId }, partialErrors),
      safeList(store, "stock_items", filters, partialErrors),
      safeList(store, "stock_entries", filters, partialErrors),
      safeList(store, "stock_exits", filters, partialErrors),
      safeList(store, "municipal_documents", filters, partialErrors),
      safeList(store, "municipal_admin_audit_log", { institution_id: institutionId }, partialErrors)
    ]);
    const units = session.role === "gestor" && session.unitId ? unitsRaw.filter((unit) => clean(unit.id) === clean(session.unitId)) : unitsRaw;
    const allowedUnitIds = new Set(units.map((unit) => clean(unit.id)));
    const items = itemsRaw.filter((item) => !unitId || clean(item.unit_id) === unitId).filter((item) => session.role !== "gestor" || allowedUnitIds.has(clean(item.unit_id)));
    const itemIds = new Set(items.map((item) => clean(item.id)));
    const entries = filterPeriod(entriesRaw, query).filter((entry) => itemIds.has(clean(entry.item_id)));
    const exits = filterPeriod(exitsRaw, query).filter((row) => itemIds.has(clean(row.item_id)));
    const stock = items.map((item) => Object.assign({}, sanitize(item), balanceFor(item, entriesRaw, exitsRaw)));
    const itemNames = new Map(items.map((item) => [clean(item.id), clean(item.name)]));
    const movements = entries.map((entry) => ({
      type: "entrada",
      item_id: entry.item_id,
      item_name: itemNames.get(clean(entry.item_id)) || clean(entry.item_id),
      quantity: asNumber(entry.quantity),
      reason: movementReason(entry),
      created_at: entry.created_at
    })).concat(exits.map((row) => ({
      type: "saida",
      item_id: row.item_id,
      item_name: itemNames.get(clean(row.item_id)) || clean(row.item_id),
      quantity: asNumber(row.quantity),
      reason: movementReason(row),
      created_at: row.created_at
    }))).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    let alerts = [];
    try {
      alerts = (await sentinel.listAlerts(context, Object.assign({}, query, { institution_id: institutionId, unit_id: unitId }))).alerts || [];
    } catch (err) {
      partialErrors.push({ tool: "municipal_sentinel", error: clean(err && (err.code || err.message)) || "tool_failed" });
    }
    const documents = documentsRaw
      .filter((doc) => session.role !== "gestor" || !doc.unit_id || allowedUnitIds.has(clean(doc.unit_id)))
      .map(sanitize)
      .sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());
    const audit = auditRaw.map(sanitize).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return { institution_id: institutionId, unit_id: unitId, units: units.map(sanitize), stock, movements, alerts: alerts.map(sanitize), documents, audit, partial_errors: partialErrors };
  }

  return {
    buildSnapshot,
    async listAuthorizedUnits(context, query) { return (await buildSnapshot(context, query)).units; },
    async getStockAndBalance(context, query) { return (await buildSnapshot(context, query)).stock; },
    async listMovements(context, query) { return (await buildSnapshot(context, query)).movements; },
    async listSentinelAlerts(context, query) { return (await buildSnapshot(context, query)).alerts; },
    async listDocuments(context, query) { return (await buildSnapshot(context, query)).documents; },
    async listAudit(context, query) { return (await buildSnapshot(context, query)).audit; },
    async answer(context, question, query = {}) {
      const snapshot = await buildSnapshot(context, query);
      const alerts = snapshot.partial_errors.map((item) => `${item.tool}: ${item.error}`);
      const assumptions = [`institution_id autorizado: ${snapshot.institution_id}`, snapshot.unit_id ? `unit_id autorizado: ${snapshot.unit_id}` : "sem filtro de unidade especifico"];
      return {
        answer: answerSections({
          main: buildMainAnswer(question, snapshot),
          data: dataLines(snapshot),
          assumptions,
          alerts,
          next: "Abrir o painel municipal correspondente para conferir registros e executar qualquer acao manual."
        }),
        snapshot
      };
    }
  };
}

export async function buildEloMunicipalAnswerIfNeeded(options = {}) {
  const message = clean(options.message);
  if (!shouldUseMunicipalTools(message, options.context || {})) return null;
  let context = null;
  try {
    context = await options.resolveAuthContext(options.request);
  } catch (_) {
    return null;
  }
  if (!context || !context.ok) return null;
  const tools = options.tools || createEloMunicipalTools({ database: options.database, store: options.store });
  const query = Object.assign({}, options.context || {}, options.body || {});
  const result = await tools.answer(context, message, query);
  return {
    ok: true,
    mode: "municipal_tools",
    fallback: false,
    answer: result.answer,
    municipal: {
      data_used: dataLines(result.snapshot),
      partial_errors: result.snapshot.partial_errors
    }
  };
}

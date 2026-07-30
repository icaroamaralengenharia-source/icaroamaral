import { existsSync, readFileSync } from "node:fs";
import {
  adaptRdoToSourceReference,
  adaptTimelineEventToAuditEvent,
  sanitizeMetadata as sanitizeOperationalMetadata
} from "./contracts/elo-operational-contracts.js";

const SOURCE_MODULES = new Set(["rdo", "technical_report", "generated_document", "elo_budget", "budget_pdf", "sentinel"]);
const SENSITIVE_KEY = /(secret|token|password|senha|key|html_content|document_data|file_path|storage_path|base64|content)/i;

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function now() {
  return new Date().toISOString();
}

function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {};
}

function readJson(path, fallback) {
  if (!path || !existsSync(path)) return fallback;
  try {
    return Object.assign(fallback, JSON.parse(readFileSync(path, "utf8") || "{}"));
  } catch (_) {
    return fallback;
  }
}

function safeError(code, status = 500) {
  return Object.assign(new Error(code), { status });
}

function assertScope(scope = {}) {
  const institutionId = clean(scope.institution_id || scope.institutionId, 140);
  const companyId = clean(scope.company_id || scope.companyId, 140);
  const projectId = clean(scope.project_id || scope.projectId, 140);
  if (!institutionId) throw safeError("institution_id_required", 400);
  if (!companyId) throw safeError("company_id_required", 400);
  if (!projectId) throw safeError("project_id_required", 400);
  return { institution_id: institutionId, company_id: companyId, project_id: projectId };
}

function dateValue(value) {
  const text = clean(value, 80);
  return text || null;
}

function safeMetadata(value) {
  try { return sanitizeOperationalMetadata(value) || {}; }
  catch (_) {
    const source = objectOf(value);
    return Object.fromEntries(Object.entries(source)
      .filter(([key, item]) => !SENSITIVE_KEY.test(key) && typeof item !== "function")
      .slice(0, 24)
      .map(([key, item]) => [key, typeof item === "object" ? safeMetadata(item) : item]));
  }
}

function fileReference(input = {}) {
  const publicUrl = clean(input.public_url || input.file_url || input.url, 1000);
  if (/^https?:\/\//i.test(publicUrl)) return { kind: "url", url: publicUrl };
  const endpoint = clean(input.endpoint, 1000);
  if (endpoint && endpoint.startsWith("/api/")) return { kind: "endpoint", endpoint };
  const entity = clean(input.source_entity_id || input.sourceEntityId || input.id, 180);
  return entity ? { kind: "source", source_entity_id: entity } : null;
}

function itemId(moduleName, entityType, id) {
  return ["archive", moduleName, entityType, clean(id, 180)].join(":");
}

function baseItem(scope, row, sourceModule, sourceEntityType, sourceEntityId) {
  return {
    id: itemId(sourceModule, sourceEntityType, sourceEntityId),
    project_id: scope.project_id,
    institution_id: scope.institution_id,
    company_id: scope.company_id,
    source_module: sourceModule,
    source_entity_type: sourceEntityType,
    source_entity_id: clean(sourceEntityId, 180),
    title: clean(row.title || row.file_name || row.filename || row.document_type || row.evidence_type || sourceEntityId, 240),
    description: clean(row.description || row.summary || "", 1000) || null,
    document_type: clean(row.document_type || row.evidence_type || sourceEntityType, 120),
    status: clean(row.status || "registered", 80),
    occurred_at: dateValue(row.occurred_at || row.rdo_date || row.generated_at || row.updated_at || row.created_at) || now(),
    created_at: dateValue(row.created_at || row.generated_at || row.updated_at) || now(),
    created_by: clean(row.created_by || row.generated_by || row.generated_by_user_id || row.owner_user_id, 140) || null,
    file_name: clean(row.file_name || row.filename || row.metadata_json && row.metadata_json.fileName, 240) || null,
    mime_type: clean(row.mime_type, 160) || null,
    file_reference: null,
    metadata: {}
  };
}

function archiveOperationalContract(item = {}) {
  try {
    const adapter = item.source_module === "rdo" ? adaptRdoToSourceReference : adaptTimelineEventToAuditEvent;
    const contract = adapter(item, item);
    return {
      contract_version: contract.contract_version || "1.0",
      source_module: contract.source_module,
      source_entity_type: contract.source_entity_type,
      source_entity_id: contract.source_entity_id,
      occurred_at: contract.occurred_at || item.occurred_at || null
    };
  } catch (_) {
    return null;
  }
}

function applyOperationalContract(item = {}) {
  const contract = archiveOperationalContract(item);
  if (!contract) return item;
  return Object.assign({}, item, { metadata: Object.assign({}, safeMetadata(item.metadata), { operational_contract: contract }) });
}
function scoped(row, scope) {
  if (!row) return false;
  if (clean(row.institution_id, 140) !== scope.institution_id) return false;
  if (row.company_id && clean(row.company_id, 140) !== scope.company_id) return false;
  if (clean(row.project_id, 140) !== scope.project_id) return false;
  return true;
}

function applyFilters(items, filters = {}) {
  const search = clean(filters.search, 220).toLowerCase();
  return items.filter((item) => {
    if (filters.source_module && item.source_module !== clean(filters.source_module, 80)) return false;
    if (filters.document_type && item.document_type !== clean(filters.document_type, 120)) return false;
    if (filters.status && item.status !== clean(filters.status, 80)) return false;
    if (filters.date_from && String(item.occurred_at) < clean(filters.date_from, 80)) return false;
    if (filters.date_to && String(item.occurred_at) > clean(filters.date_to, 80)) return false;
    if (search) {
      const haystack = [item.title, item.description, item.document_type, item.source_module, item.status, JSON.stringify(item.metadata || {})].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function page(items, filters = {}) {
  const limit = Math.max(1, Math.min(Number(filters.limit) || 50, 100));
  const offset = Math.max(0, Number(filters.offset || filters.cursor) || 0);
  const slice = items.slice(offset, offset + limit + 1);
  const hasMore = slice.length > limit;
  return {
    items: hasMore ? slice.slice(0, limit) : slice,
    page: { limit, offset, cursor: hasMore ? String(offset + limit) : null, next_offset: hasMore ? offset + limit : null, has_more: hasMore }
  };
}

function localObraReportItems(service, scope) {
  if (!service || !service.dataPath) return [];
  const db = readJson(service.dataPath, { reports: {}, rdos: {}, generatedDocuments: {}, documentFiles: {} });
  const reports = Object.values(db.reports || {}).filter((row) => scoped(row, scope)).map((row) => {
    const item = baseItem(scope, row, "technical_report", "report", row.id);
    item.document_type = "technical_report";
    item.metadata = safeMetadata({ client_id: row.client_id, updated_at: row.updated_at });
    item.file_reference = fileReference({ endpoint: "/api/obrareport/reports/" + encodeURIComponent(row.id), source_entity_id: row.id });
    return item;
  });
  const rdos = Object.values(db.rdos || {}).filter((row) => scoped(row, scope)).map((row) => {
    const item = baseItem(scope, row, "rdo", "rdo", row.id);
    item.document_type = "rdo";
    item.metadata = safeMetadata({ client_id: row.client_id, rdo_date: row.rdo_date, updated_at: row.updated_at });
    item.file_reference = fileReference({ endpoint: "/api/obrareport/rdos/" + encodeURIComponent(row.id), source_entity_id: row.id });
    return item;
  });
  const documents = Object.values(db.generatedDocuments || {}).map((row) => {
    const source = row.source_type === "rdo" ? db.rdos && db.rdos[row.source_id] : db.reports && db.reports[row.source_id];
    if (!source || !scoped(source, scope) || clean(row.institution_id, 140) !== scope.institution_id) return null;
    const file = row.file_id ? db.documentFiles && db.documentFiles[row.file_id] : null;
    if (row.file_id && !file) return null;
    const item = baseItem(scope, Object.assign({}, row, file || {}), "generated_document", "document", row.id);
    item.title = clean(row.document_type || item.title, 240);
    item.description = "Documento gerado pelo ObraReport.";
    item.file_name = clean(file && file.filename || row.metadata_json && row.metadata_json.fileName, 240) || null;
    item.mime_type = clean(file && file.mime_type, 160) || null;
    item.file_reference = fileReference({ public_url: row.file_url || file && file.public_url, endpoint: row.source_type === "rdo" ? "/api/obrareport/rdos/" + encodeURIComponent(row.source_id) : "/api/obrareport/reports/" + encodeURIComponent(row.source_id), source_entity_id: row.id });
    item.metadata = safeMetadata({ source_type: row.source_type, source_id: row.source_id, hash: row.hash, file_id: row.file_id });
    return item;
  }).filter(Boolean);
  return reports.concat(rdos, documents);
}

function localBudgetItems(service, scope) {
  if (!service || !service.dataPath) return [];
  const db = readJson(service.dataPath, { budgets: {}, generatedDocuments: {} });
  const budgets = Object.values(db.budgets || {}).filter((row) => scoped(row, scope)).map((row) => {
    const item = baseItem(scope, row, "elo_budget", "budget", row.id);
    item.document_type = "budget";
    item.metadata = safeMetadata({ current_version_id: row.current_version_id, updated_at: row.updated_at });
    item.file_reference = fileReference({ endpoint: "/api/elo/budgets/" + encodeURIComponent(row.id), source_entity_id: row.id });
    return item;
  });
  const docs = Object.values(db.generatedDocuments || {}).map((row) => {
    const budget = db.budgets && db.budgets[row.budget_id];
    if (!budget || !scoped(budget, scope)) return null;
    const item = baseItem(scope, Object.assign({}, row, budget), "budget_pdf", "budget_pdf", row.id);
    item.title = clean(row.file_name || row.document_type, 240);
    item.description = "PDF/orcamento gerado pelo ELO.";
    item.file_name = clean(row.file_name, 240) || null;
    item.file_reference = fileReference({ endpoint: "/api/elo/budgets/" + encodeURIComponent(row.budget_id) + "/documents", source_entity_id: row.id });
    item.metadata = safeMetadata({ budget_id: row.budget_id, version_id: row.version_id });
    return item;
  }).filter(Boolean);
  return budgets.concat(docs);
}

function memoryItems(sources = [], scope) {
  return sources.map((row) => {
    if (!scoped(row, scope)) return null;
    const sourceModule = clean(row.source_module, 80);
    const sourceEntityType = clean(row.source_entity_type, 80);
    const sourceEntityId = clean(row.source_entity_id || row.id, 180);
    if (!SOURCE_MODULES.has(sourceModule) || !sourceEntityType || !sourceEntityId) return null;
    const item = baseItem(scope, row, sourceModule, sourceEntityType, sourceEntityId);
    item.file_reference = row.file_reference || fileReference(row);
    item.metadata = safeMetadata(row.metadata);
    return item;
  }).filter(Boolean);
}

async function supabaseTableItems(client, scope, table, select, mapper) {
  if (!client || typeof client.from !== "function") return [];
  let query = client.from(table).select(select).eq("institution_id", scope.institution_id);
  if (table !== "elo_generated_documents" && table !== "obrareport_generated_documents" && table !== "obrareport_document_files") query = query.eq("project_id", scope.project_id);
  const result = await query.limit(500);
  if (result.error) throw result.error;
  return (result.data || []).map((row) => mapper(row, scope)).filter(Boolean);
}

async function supabaseItems(client, scope) {
  if (!client || typeof client.from !== "function") return [];
  const budgets = await supabaseTableItems(client, scope, "elo_budget_documents", "*", (row, sc) => scoped(row, sc) ? baseItem(sc, row, "elo_budget", "budget", row.id) : null);
  const evidences = await supabaseTableItems(client, scope, "elo_sentinel_evidences", "*", (row, sc) => {
    if (!scoped(row, sc)) return null;
    const item = baseItem(sc, row, "sentinel", "evidence", row.id);
    item.file_reference = fileReference({ source_entity_id: row.id });
    item.metadata = safeMetadata({ source: row.source, file_hash: row.file_hash });
    return item;
  });
  return budgets.concat(evidences);
}

export function createEloArchiveService(options = {}) {
  const obraReportService = options.obraReportTransactionalService || null;
  const eloBudgetService = options.eloBudgetService || null;
  const database = options.database || null;
  const memorySources = Array.isArray(options.sources) ? options.sources : [];

  async function listArchive(input = {}) {
    const scope = assertScope(input);
    const warnings = [];
    const groups = [];
    for (const [name, producer] of [
      ["memory", () => memoryItems(memorySources, scope)],
      ["obrareport", () => localObraReportItems(obraReportService, scope)],
      ["budget", () => localBudgetItems(eloBudgetService, scope)],
      ["database", () => supabaseItems(database, scope)]
    ]) {
      try {
        const produced = await producer();
        if (Array.isArray(produced)) groups.push(...produced);
      } catch (_) {
        warnings.push(name);
      }
    }
    const byId = new Map();
    groups.forEach((item) => {
      if (item && item.source_entity_id && !byId.has(item.id)) byId.set(item.id, applyOperationalContract(item));
    });
    const sorted = applyFilters(Array.from(byId.values()), input)
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)) || String(b.created_at).localeCompare(String(a.created_at)));
    return Object.assign(page(sorted, input), { warnings });
  }

  return { listArchive };
}

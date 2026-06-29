import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO_DIR = join(BACKEND_DIR, "..");
const DEFAULT_DATA_PATH = join(BACKEND_DIR, "data", "elo-budgets.json");
const ELO_ASSISTANT_PATH = join(REPO_DIR, "relatorio-qualidade-obras", "elo-assistente.js");

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value || null)); }
function newId(prefix) { return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
function normalizeObject(value) { return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {}; }

let cachedPdfAdapter = null;

function createStorage() {
  const data = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    removeItem(key) { delete data[key]; }
  };
}

function loadEloPdfAdapter() {
  if (cachedPdfAdapter) return cachedPdfAdapter;
  const sandbox = {
    console,
    window: { ELO_SKIP_AUTO_WIDGET: true },
    document: {
      readyState: "complete",
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement(tagName) {
        return {
          tagName,
          style: {},
          classList: { add() {}, remove() {}, contains() { return false; } },
          dataset: {},
          setAttribute() {},
          getAttribute() { return ""; },
          appendChild(child) { return child; },
          addEventListener() {},
          remove() {},
          textContent: "",
          innerHTML: ""
        };
      },
      body: { dataset: {}, getAttribute() { return ""; }, appendChild(child) { return child; } }
    },
    navigator: { userAgent: "node" },
    location: { pathname: "/elo.html", search: "", hash: "" },
    localStorage: createStorage(),
    sessionStorage: createStorage(),
    setTimeout() { return 0; },
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    Blob: class Blob {},
    URL: { createObjectURL() { return "blob:elo-budget"; }, revokeObjectURL() {} }
  };
  sandbox.window = Object.assign(sandbox.window, sandbox);
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(ELO_ASSISTANT_PATH, "utf8"), sandbox, { filename: "elo-assistente.js" });
  const assistant = sandbox.window.EloAssistente;
  if (!assistant || typeof assistant.buildBudgetV2ProfessionalPdfDataForTest !== "function" || typeof assistant.buildProfessionalPdfDocumentForTest !== "function") {
    throw Object.assign(new Error("elo_pdf_adapter_unavailable"), { status: 500 });
  }
  cachedPdfAdapter = assistant;
  return cachedPdfAdapter;
}

function readDb(dataPath) {
  if (!existsSync(dataPath)) return { budgets: {}, versions: {}, events: {}, generatedDocuments: {} };
  try {
    const parsed = JSON.parse(readFileSync(dataPath, "utf8") || "{}");
    return {
      budgets: normalizeObject(parsed.budgets),
      versions: normalizeObject(parsed.versions),
      events: normalizeObject(parsed.events),
      generatedDocuments: normalizeObject(parsed.generatedDocuments)
    };
  } catch (_) {
    return { budgets: {}, versions: {}, events: {}, generatedDocuments: {} };
  }
}

function writeDb(dataPath, db) {
  mkdirSync(dirname(dataPath), { recursive: true });
  writeFileSync(dataPath, JSON.stringify({
    budgets: db.budgets || {},
    versions: db.versions || {},
    events: db.events || {},
    generatedDocuments: db.generatedDocuments || {}
  }, null, 2), "utf8");
}

function normalizeContext(context = {}) {
  const safe = normalizeObject(context);
  const profile = normalizeObject(safe.profile);
  const user = normalizeObject(safe.user);
  return {
    institutionId: clean(profile.institution_id || profile.institutionId || safe.institutionId || safe.institution_id),
    userId: clean(profile.id || profile.user_id || user.id || safe.userId || safe.user_id),
    projectId: clean(safe.projectId || safe.project_id),
    authenticated: Boolean(safe.authenticated || safe.user || safe.profile)
  };
}

function normalizeDocumentData(documentData) {
  const data = normalizeObject(documentData);
  if (!Object.keys(data).length) throw Object.assign(new Error("document_data_required"), { status: 400 });
  return data;
}

function inferTitle(documentData) {
  return clean(documentData.title || documentData.titulo || documentData.budgetId || "ELO Orçamentista V2");
}

function canAccess(record, context) {
  const ctx = normalizeContext(context);
  if (!record || record.deleted_at) return false;
  if (ctx.institutionId && record.institution_id && record.institution_id !== ctx.institutionId) return false;
  if (!ctx.institutionId && ctx.userId && record.owner_user_id && record.owner_user_id !== ctx.userId) return false;
  return true;
}

function requireAccess(record, context) {
  if (!record) throw Object.assign(new Error("budget_not_found"), { status: 404 });
  if (!canAccess(record, context)) throw Object.assign(new Error("budget_forbidden"), { status: 403 });
}

function normalizeBudget(record, context, existing = null) {
  const ctx = normalizeContext(context);
  const safe = normalizeObject(record);
  const current = existing || {};
  const documentData = safe.documentData !== undefined ? normalizeDocumentData(safe.documentData) : normalizeDocumentData(safe.document_data || current.document_data);
  const createdAt = clean(current.created_at || safe.created_at) || now();
  const institutionId = ctx.institutionId || clean(current.institution_id || safe.institution_id || safe.institutionId);
  const ownerUserId = ctx.userId || clean(current.owner_user_id || safe.owner_user_id || safe.ownerUserId);
  return Object.assign({}, current, {
    id: clean(current.id || safe.id) || newId("elo_budget"),
    institution_id: institutionId || null,
    project_id: ctx.projectId || clean(current.project_id || safe.project_id || safe.projectId) || null,
    owner_user_id: ownerUserId || null,
    title: clean(safe.title || current.title) || inferTitle(documentData),
    status: clean(safe.status || current.status) || "draft",
    current_version_id: clean(current.current_version_id || safe.current_version_id || safe.currentVersionId) || null,
    document_data: documentData,
    created_at: createdAt,
    updated_at: now(),
    deleted_at: current.deleted_at || safe.deleted_at || null
  });
}

export function createEloBudgetService(options = {}) {
  const dataPath = options.dataPath || DEFAULT_DATA_PATH;
  const pdfAdapterFactory = options.pdfAdapterFactory || loadEloPdfAdapter;

  function registerBudgetEvent(eventType, payload = {}, context = {}) {
    const db = readDb(dataPath);
    const ctx = normalizeContext(context);
    const safePayload = normalizeObject(payload);
    const event = {
      id: newId("elo_budget_event"),
      budget_id: clean(safePayload.budgetId || safePayload.budget_id) || null,
      institution_id: ctx.institutionId || clean(safePayload.institution_id) || null,
      user_id: ctx.userId || clean(safePayload.user_id) || null,
      event_type: clean(eventType),
      payload: safePayload,
      created_at: now()
    };
    if (!event.event_type) throw Object.assign(new Error("event_type_required"), { status: 400 });
    db.events[event.id] = event;
    writeDb(dataPath, db);
    return clone(event);
  }

  function createBudget(documentData, context = {}) {
    const db = readDb(dataPath);
    const budget = normalizeBudget({ documentData }, context);
    db.budgets[budget.id] = budget;
    writeDb(dataPath, db);
    registerBudgetEvent("budget_created", { budgetId: budget.id, title: budget.title }, Object.assign({}, context, { institutionId: budget.institution_id, userId: budget.owner_user_id }));
    return clone(budget);
  }

  function listBudgets(context = {}) {
    return Object.values(readDb(dataPath).budgets)
      .filter((budget) => canAccess(budget, context))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map(clone);
  }

  function getBudget(id, context = {}) {
    const budget = readDb(dataPath).budgets[clean(id)] || null;
    requireAccess(budget, context);
    return clone(budget);
  }

  function updateBudget(id, patch = {}, context = {}) {
    const db = readDb(dataPath);
    const existing = db.budgets[clean(id)] || null;
    requireAccess(existing, context);
    const updated = normalizeBudget(Object.assign({}, patch, { id: existing.id }), context, existing);
    db.budgets[existing.id] = updated;
    writeDb(dataPath, db);
    registerBudgetEvent("budget_updated", { budgetId: updated.id, patch: normalizeObject(patch) }, Object.assign({}, context, { institutionId: updated.institution_id, userId: updated.owner_user_id }));
    return clone(updated);
  }

  function createVersion(id, documentData, context = {}) {
    const db = readDb(dataPath);
    const budget = db.budgets[clean(id)] || null;
    requireAccess(budget, context);
    const versions = Object.values(db.versions).filter((version) => version.budget_id === budget.id);
    const version = {
      id: newId("elo_budget_version"),
      budget_id: budget.id,
      version_number: versions.length + 1,
      document_data: normalizeDocumentData(documentData),
      created_by_user_id: normalizeContext(context).userId || null,
      created_at: now()
    };
    db.versions[version.id] = version;
    budget.current_version_id = version.id;
    budget.document_data = clone(version.document_data);
    budget.updated_at = now();
    db.budgets[budget.id] = budget;
    writeDb(dataPath, db);
    registerBudgetEvent("budget_version_created", { budgetId: budget.id, versionId: version.id, versionNumber: version.version_number }, Object.assign({}, context, { institutionId: budget.institution_id, userId: budget.owner_user_id }));
    return clone(version);
  }

  function generateBudgetPdf(id, context = {}) {
    const db = readDb(dataPath);
    const budget = db.budgets[clean(id)] || null;
    requireAccess(budget, context);
    const adapter = pdfAdapterFactory();
    const pdfData = adapter.buildBudgetV2ProfessionalPdfDataForTest(budget.document_data);
    const html = adapter.buildProfessionalPdfDocumentForTest(pdfData.record, pdfData.context);
    const document = {
      id: newId("elo_generated_document"),
      budget_id: budget.id,
      version_id: budget.current_version_id || null,
      document_type: "budget_v2_professional_pdf",
      status: "generated",
      file_name: "elo-orcamento-" + budget.id + ".html",
      html_content: html,
      file_path: null,
      generated_by_user_id: normalizeContext(context).userId || null,
      generated_at: now(),
      created_at: now()
    };
    db.generatedDocuments[document.id] = document;
    writeDb(dataPath, db);
    registerBudgetEvent("pdf_generated", { budgetId: budget.id, documentId: document.id, fileName: document.file_name }, Object.assign({}, context, { institutionId: budget.institution_id, userId: budget.owner_user_id }));
    return clone(document);
  }

  function listEvents(id, context = {}) {
    getBudget(id, context);
    return Object.values(readDb(dataPath).events)
      .filter((event) => event.budget_id === clean(id))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map(clone);
  }

  function listDocuments(id, context = {}) {
    getBudget(id, context);
    return Object.values(readDb(dataPath).generatedDocuments)
      .filter((document) => document.budget_id === clean(id))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(clone);
  }

  return { dataPath, createBudget, listBudgets, getBudget, updateBudget, createVersion, registerBudgetEvent, generateBudgetPdf, listEvents, listDocuments };
}

export const defaultEloBudgetService = createEloBudgetService();

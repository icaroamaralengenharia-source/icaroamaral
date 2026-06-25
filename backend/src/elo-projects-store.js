import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_DATA_PATH = join(BACKEND_DIR, "data", "elo-projects.json");

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value || {})); }
function ensureArray(value) { return Array.isArray(value) ? value : []; }
function newId(prefix = "elo_project") { return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }

function normalizeRecord(record = {}, existing = null) {
  const safe = clone(record);
  const current = existing || {};
  const createdAt = clean(safe.createdAt || current.createdAt) || now();
  return Object.assign({}, current, safe, {
    id: clean(safe.id || current.id) || newId(),
    projectId: clean(safe.projectId || current.projectId || safe.id || current.id) || "",
    companyId: clean(safe.companyId || current.companyId) || "local",
    userId: clean(safe.userId || current.userId) || "local",
    role: clean(safe.role || current.role) || "owner",
    client: Object.assign({}, current.client || {}, safe.client || {}),
    project: Object.assign({}, current.project || {}, safe.project || {}),
    premises: Object.assign({}, current.premises || {}, safe.premises || {}),
    budget: Object.assign({}, current.budget || {}, safe.budget || {}),
    revisions: ensureArray(current.revisions).concat(ensureArray(safe.revisions)),
    audits: ensureArray(current.audits).concat(ensureArray(safe.audits)),
    compositionSelections: ensureArray(current.compositionSelections).concat(ensureArray(safe.compositionSelections)),
    executiveChecklists: ensureArray(current.executiveChecklists).concat(ensureArray(safe.executiveChecklists)),
    history: ensureArray(current.history).concat(ensureArray(safe.history)),
    createdAt,
    updatedAt: now(),
    version: Number(current.version || safe.version || 0) + (existing ? 1 : 1)
  });
}

function validateProject(record) {
  if (!record || typeof record !== "object") throw Object.assign(new Error("record_required"), { status: 400 });
  const hasProject = record.project && (clean(record.project.name) || clean(record.project.type) || record.project.builtAreaM2);
  const hasClient = record.client && clean(record.client.name);
  const hasBudget = record.budget && Object.keys(record.budget).length > 0;
  if (!hasProject && !hasClient && !hasBudget) throw Object.assign(new Error("minimal_project_fields_required"), { status: 400 });
}

export function createEloProjectsStore(options = {}) {
  const dataPath = options.dataPath || DEFAULT_DATA_PATH;
  function readDb() {
    if (!existsSync(dataPath)) return { projects: {} };
    try {
      const parsed = JSON.parse(readFileSync(dataPath, "utf8") || "{}");
      return { projects: parsed.projects && typeof parsed.projects === "object" ? parsed.projects : {} };
    } catch (_) {
      return { projects: {} };
    }
  }
  function writeDb(db) {
    mkdirSync(dirname(dataPath), { recursive: true });
    writeFileSync(dataPath, JSON.stringify({ projects: db.projects || {} }, null, 2), "utf8");
  }
  function withEvent(record, type, message, payload = {}) {
    const r = clone(record);
    r.history = ensureArray(r.history);
    r.history.push(Object.assign({ at: now(), type, message, origin: "elo_projects_store" }, payload));
    return r;
  }
  function createProject(record) {
    validateProject(record);
    const db = readDb();
    let normalized = normalizeRecord(record);
    normalized.projectId = normalized.projectId || normalized.id;
    normalized = withEvent(normalized, "project_created", "Prontu?rio criado.");
    db.projects[normalized.id] = normalized;
    writeDb(db);
    return clone(normalized);
  }
  function listProjects(filters = {}) {
    const companyId = clean(filters.companyId);
    const userId = clean(filters.userId);
    return Object.values(readDb().projects)
      .filter((item) => !companyId || item.companyId === companyId)
      .filter((item) => !userId || item.userId === userId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(clone);
  }
  function getProject(id) {
    return clone(readDb().projects[clean(id)] || null);
  }
  function requireProject(db, id) {
    const project = db.projects[clean(id)];
    if (!project) throw Object.assign(new Error("project_not_found"), { status: 404 });
    return project;
  }
  function updateProject(id, patch = {}) {
    const db = readDb();
    const existing = requireProject(db, id);
    const normalized = normalizeRecord(Object.assign({}, patch, { id: existing.id }), existing);
    normalized.history = ensureArray(existing.history).concat(ensureArray(patch.history), [{ at: now(), type: "project_updated", message: "Prontu?rio atualizado.", origin: "elo_projects_store" }]);
    db.projects[existing.id] = normalized;
    writeDb(db);
    return clone(normalized);
  }
  function appendRevision(id, revision = {}) {
    const db = readDb();
    const existing = requireProject(db, id);
    const entry = Object.assign({ id: newId("rev"), number: ensureArray(existing.revisions).length + 1, createdAt: now(), origin: "backend" }, clone(revision));
    existing.revisions = ensureArray(existing.revisions).concat(entry);
    existing.history = ensureArray(existing.history).concat({ at: now(), type: "revision_added", message: "Revis?o registrada.", origin: "elo_projects_store", revisionId: entry.id });
    existing.updatedAt = now();
    existing.version = Number(existing.version || 1) + 1;
    db.projects[existing.id] = existing;
    writeDb(db);
    return clone(existing);
  }
  function appendAudit(id, audit = {}) {
    const db = readDb();
    const existing = requireProject(db, id);
    const entry = Object.assign({ id: newId("audit"), createdAt: now(), origin: "backend" }, clone(audit));
    existing.audits = ensureArray(existing.audits).concat(entry);
    existing.history = ensureArray(existing.history).concat({ at: now(), type: "audit_added", message: "Auditoria registrada.", origin: "elo_projects_store", auditId: entry.id });
    existing.updatedAt = now();
    existing.version = Number(existing.version || 1) + 1;
    db.projects[existing.id] = existing;
    writeDb(db);
    return clone(existing);
  }
  function selectComposition(id, selection = {}) {
    const db = readDb();
    const existing = requireProject(db, id);
    const selected = Object.assign({ id: newId("selection"), selected: true, selectedAt: now(), origin: "backend" }, clone(selection));
    existing.compositionSelections = ensureArray(existing.compositionSelections).filter((item) => !(item.packageId === selected.packageId && item.serviceId === selected.serviceId)).concat(selected);
    existing.revisions = ensureArray(existing.revisions).concat({ id: newId("rev"), number: ensureArray(existing.revisions).length + 1, createdAt: now(), origin: "composition_selection", summary: "Composi??o selecionada: " + clean(selected.compositionCode || selected.code) });
    existing.history = ensureArray(existing.history).concat({ at: now(), type: "composition_selected", message: "Composi??o selecionada.", origin: "elo_projects_store", selectionId: selected.id });
    existing.updatedAt = now();
    existing.version = Number(existing.version || 1) + 1;
    db.projects[existing.id] = existing;
    writeDb(db);
    return clone(existing);
  }
  function saveExecutiveChecklist(id, checklist = {}) {
    const db = readDb();
    const existing = requireProject(db, id);
    const entry = Object.assign({ id: newId("checklist"), createdAt: now(), origin: "backend" }, clone(checklist));
    existing.executiveChecklists = ensureArray(existing.executiveChecklists).concat(entry);
    existing.history = ensureArray(existing.history).concat({ at: now(), type: "executive_checklist_saved", message: "Checklist executivo salvo.", origin: "elo_projects_store", checklistId: entry.id });
    existing.updatedAt = now();
    existing.version = Number(existing.version || 1) + 1;
    db.projects[existing.id] = existing;
    writeDb(db);
    return clone(existing);
  }
  return { dataPath, createProject, listProjects, getProject, updateProject, appendRevision, appendAudit, selectComposition, saveExecutiveChecklist };
}

export const defaultEloProjectsStore = createEloProjectsStore();

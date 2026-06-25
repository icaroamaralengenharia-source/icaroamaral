(function (root) {
  "use strict";
  const VERSION = "20260624-elo-project-store-v2-api-fallback";
  const KEY = "elo_project_records_v1";
  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
  function now() { return new Date().toISOString(); }
  function clone(v) { return JSON.parse(JSON.stringify(v || {})); }
  function storage() {
    const mem = root.__ELO_PROJECT_STORE_MEMORY__ = root.__ELO_PROJECT_STORE_MEMORY__ || {};
    try { if (root.localStorage) return root.localStorage; } catch (_) {}
    return { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
  }
  function all() { try { return JSON.parse(storage().getItem(KEY) || "{}"); } catch (_) { return {}; } }
  function writeAll(data) { storage().setItem(KEY, JSON.stringify(data || {})); }
  function ensureRecord(record) {
    const r = clone(record);
    r.id = clean(r.id) || "elo_project_" + Date.now().toString(36);
    r.companyId = clean(r.companyId) || "local";
    r.userId = clean(r.userId) || "local";
    r.client = r.client || {};
    r.project = r.project || {};
    r.premises = r.premises || {};
    r.revisions = r.revisions || [];
    r.budget = r.budget || {};
    r.audits = r.audits || [];
    r.history = r.history || [];
    r.createdAt = r.createdAt || now();
    r.updatedAt = now();
    r.version = r.version || 1;
    return r;
  }
  function queueBackendSave(record, action) {
    const client = root.EloProjectApiClient;
    if (!client || action && action.skipApiClient) return;
    try { client.save(record).then(function (result) { root.__ELO_PROJECT_LAST_BACKEND_STATUS__ = { source: result && result.source || "backend", ok: !!(result && result.ok), projectId: record && record.id, at: now() }; }).catch(function () { root.__ELO_PROJECT_LAST_BACKEND_STATUS__ = { source: "local", ok: false, projectId: record && record.id, at: now(), reason: "backend_failed" }; }); } catch (_) { root.__ELO_PROJECT_LAST_BACKEND_STATUS__ = { source: "local", ok: false, projectId: record && record.id, at: now(), reason: "backend_unavailable" }; }
  }
  function saveProjectRecord(record, options) {
    const data = all();
    const existing = record && record.id && data[record.id] || null;
    const r = ensureRecord(record || {});
    if (existing) r.revisions = (existing.revisions || []).concat(r.revisions || []);
    r.history = (existing && existing.history || []).concat(r.history || [], [{ at: now(), type: "save", message: "Prontuário salvo localmente.", origin: "project_store" }]);
    data[r.id] = r;
    writeAll(data);
    r.persistenceSource = "local";
    queueBackendSave(r, options || {});
    return r;
  }
  function loadProjectRecord(projectId) { return all()[projectId] || null; }
  function listProjectRecords() { return Object.values(all()).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); }
  function deleteProjectRecord(projectId) { const data = all(); const existed = !!data[projectId]; delete data[projectId]; writeAll(data); return existed; }
  function createProjectRecordFromBudget(budget) {
    const b = budget || {};
    const source = b.projectRecord || {};
    const facts = b.projectFacts || source.project || {};
    return saveProjectRecord(Object.assign({}, source, {
      id: source.id || "elo_project_" + Date.now().toString(36),
      project: Object.assign({}, source.project || {}, { type: facts.projectType || facts.type || source.project && source.project.type, builtAreaM2: facts.builtAreaM2 || source.project && source.project.builtAreaM2 }),
      premises: Object.assign({}, source.premises || {}, { wallSystem: facts.wallMaterial || source.premises && source.premises.wallSystem, roof: facts.roofMaterial || source.premises && source.premises.roof, floor: facts.floorMaterial || source.premises && source.premises.floor }),
      budget: b
    }));
  }
  function appendProjectRevision(projectId, revision) { const r = loadProjectRecord(projectId); if (!r) return null; r.revisions = r.revisions || []; r.revisions.push(Object.assign({ number: r.revisions.length, date: now(), origin: "local" }, revision || {})); return saveProjectRecord(r); }
  function appendProjectHistory(projectId, event) { const r = loadProjectRecord(projectId); if (!r) return null; r.history = r.history || []; r.history.push(Object.assign({ at: now(), type: "event", origin: "local" }, event || {})); return saveProjectRecord(r); }
  function getLastBackendStatus() { return root.__ELO_PROJECT_LAST_BACKEND_STATUS__ || { source: "local", ok: true, reason: "not_attempted" }; }
  root.EloProjectStore = { version: VERSION, saveProjectRecord, loadProjectRecord, listProjectRecords, deleteProjectRecord, createProjectRecordFromBudget, appendProjectRevision, appendProjectHistory, getLastBackendStatus };
})(typeof window !== "undefined" ? window : globalThis);

(function (root) {
  "use strict";
  const VERSION = "20260624-elo-project-api-client-v1";
  const BASE = "/api/elo/projects";
  function localStore() { return root.EloProjectStore || null; }
  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
  async function requestJson(path, options) {
    if (!root.fetch) throw new Error("fetch_unavailable");
    const response = await root.fetch(path, Object.assign({ headers: { "Content-Type": "application/json" } }, options || {}));
    if (!response.ok) throw new Error("backend_" + response.status);
    return response.json();
  }
  function wrapLocal(project, action) { return Promise.resolve({ ok: true, source: "local", project, action }); }
  async function save(record) {
    try { const data = await requestJson(BASE, { method: "POST", body: JSON.stringify(record || {}) }); return Object.assign({ source: "backend" }, data); }
    catch (error) { const s = localStore(); return wrapLocal(s && s.saveProjectRecord ? s.saveProjectRecord(record || {}, { skipApiClient: true }) : record, "save"); }
  }
  async function list(filters) {
    const qs = filters && Object.keys(filters).length ? "?" + new URLSearchParams(filters).toString() : "";
    try { const data = await requestJson(BASE + qs); return Object.assign({ source: "backend" }, data); }
    catch (error) { const s = localStore(); return { ok: true, source: "local", projects: s && s.listProjectRecords ? s.listProjectRecords() : [] }; }
  }
  async function load(id) {
    try { const data = await requestJson(BASE + "/" + encodeURIComponent(clean(id))); return Object.assign({ source: "backend" }, data); }
    catch (error) { const s = localStore(); return wrapLocal(s && s.loadProjectRecord ? s.loadProjectRecord(id) : null, "load"); }
  }
  async function update(id, patch) {
    try { const data = await requestJson(BASE + "/" + encodeURIComponent(clean(id)), { method: "PUT", body: JSON.stringify(patch || {}) }); return Object.assign({ source: "backend" }, data); }
    catch (error) { const s = localStore(); const current = s && s.loadProjectRecord ? s.loadProjectRecord(id) : {}; return wrapLocal(s && s.saveProjectRecord ? s.saveProjectRecord(Object.assign({}, current || {}, patch || {}, { id }), { skipApiClient: true }) : Object.assign({}, current || {}, patch || {}, { id }), "update"); }
  }
  async function appendRevision(id, revision) {
    try { const data = await requestJson(BASE + "/" + encodeURIComponent(clean(id)) + "/revisions", { method: "POST", body: JSON.stringify(revision || {}) }); return Object.assign({ source: "backend" }, data); }
    catch (error) { const s = localStore(); return wrapLocal(s && s.appendProjectRevision ? s.appendProjectRevision(id, revision, { skipApiClient: true }) : null, "appendRevision"); }
  }
  async function appendAudit(id, audit) {
    try { const data = await requestJson(BASE + "/" + encodeURIComponent(clean(id)) + "/audits", { method: "POST", body: JSON.stringify(audit || {}) }); return Object.assign({ source: "backend" }, data); }
    catch (error) { const s = localStore(); const current = s && s.loadProjectRecord ? s.loadProjectRecord(id) : null; if (current) { current.audits = (current.audits || []).concat(audit || {}); return wrapLocal(s.saveProjectRecord(current, { skipApiClient: true }), "appendAudit"); } return wrapLocal(null, "appendAudit"); }
  }
  async function selectComposition(id, selection) {
    try { const data = await requestJson(BASE + "/" + encodeURIComponent(clean(id)) + "/compositions/select", { method: "POST", body: JSON.stringify(selection || {}) }); return Object.assign({ source: "backend" }, data); }
    catch (error) { const s = localStore(); const current = s && s.loadProjectRecord ? s.loadProjectRecord(id) : null; const engine = root.EloCompositionSelectionEngine; const selected = current && engine ? engine.selectComposition(current, selection || {}) : current; return wrapLocal(s && selected ? s.saveProjectRecord(selected, { skipApiClient: true }) : selected, "selectComposition"); }
  }
  async function saveExecutiveChecklist(id, checklist) {
    try { const data = await requestJson(BASE + "/" + encodeURIComponent(clean(id)) + "/executive/checklist", { method: "POST", body: JSON.stringify(checklist || {}) }); return Object.assign({ source: "backend" }, data); }
    catch (error) { const s = localStore(); const current = s && s.loadProjectRecord ? s.loadProjectRecord(id) : null; if (current) { current.executiveChecklists = (current.executiveChecklists || []).concat(checklist || {}); return wrapLocal(s.saveProjectRecord(current, { skipApiClient: true }), "saveExecutiveChecklist"); } return wrapLocal(null, "saveExecutiveChecklist"); }
  }
  root.EloProjectApiClient = { version: VERSION, save, list, load, update, appendRevision, appendAudit, selectComposition, saveExecutiveChecklist };
})(typeof window !== "undefined" ? window : globalThis);

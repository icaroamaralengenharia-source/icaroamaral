(function (root) {
  "use strict";

  const VERSION = "20260624-elo-project-record-v1";
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function number(value) { const parsed = Number(String(value || "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
  function clone(value) { return JSON.parse(JSON.stringify(value || {})); }
  function now() { return new Date().toISOString(); }
  function idOf(record) { return record && record.id || "elo-project-" + Date.now().toString(36); }

  function baseRecord(previousRecord) {
    const record = clone(previousRecord);
    return Object.assign({
      id: idOf(record), client: {}, project: {}, premises: {}, workPackages: [], quantities: [], compositionSelections: [], consumptions: [], audits: [], revisions: [], history: [], status: "draft", updatedAt: now()
    }, record || {});
  }

  function inferStatus(record) {
    if (record.status === "executive") return "executive";
    const hasProject = !!(record.project && (record.project.name || record.project.type || record.project.builtAreaM2));
    const pendingPackages = (record.workPackages || []).filter(function (item) { return item.status !== "ready"; }).length;
    const hasSelected = (record.compositionSelections || []).some(function (item) { return item.selected === true; });
    if (hasProject && pendingPackages === 0 && hasSelected) return "ready_for_executive";
    if (hasProject || (record.quantities || []).length || (record.workPackages || []).length) return "preliminary";
    return "draft";
  }

  function mergeFacts(record, facts) {
    const f = facts || {};
    record.project.type = f.projectType || f.type || record.project.type || "";
    record.project.builtAreaM2 = number(f.builtAreaM2 || f.areaConstruidaM2) || record.project.builtAreaM2;
    record.project.wallHeightM = number(f.wallHeightM) || record.project.wallHeightM;
    record.project.cityUf = clean(f.cityUf || f.cityUF || f.cidadeUf || f.cidadeUF || record.project.cityUf);
    record.project.name = clean(f.projectName || f.nomeObra || record.project.name);
    record.premises.wallSystem = clean(f.wallMaterial || record.premises.wallSystem);
    record.premises.roof = clean(f.roofMaterial || record.premises.roof);
    record.premises.roofStructure = clean(f.roofStructure || record.premises.roofStructure);
    record.premises.floor = clean(f.floorMaterial || record.premises.floor);
    record.premises.foundation = clean(f.foundationType || record.premises.foundation);
    record.premises.structure = clean(f.structuralSystem || record.premises.structure);
    record.premises.standard = clean(f.standard || f.projectStandard || record.premises.standard);
    record.premises.bdi = f.bdi !== undefined ? f.bdi : record.premises.bdi;
    record.premises.sinapiState = clean(f.sinapiState || f.state || record.premises.sinapiState);
    record.premises.sinapiReferenceMonth = clean(f.sinapiReferenceMonth || f.referenceMonth || record.premises.sinapiReferenceMonth);
  }

  function buildOrUpdateProjectRecord(previousRecord, event) {
    const record = baseRecord(previousRecord);
    const ev = event || {};
    const budget = ev.budget || {};
    const facts = ev.projectFacts || budget.projectFacts || ev.facts || {};
    mergeFacts(record, facts);
    if (ev.client) record.client = Object.assign(record.client || {}, ev.client);
    if (ev.project) record.project = Object.assign(record.project || {}, ev.project);
    if (budget.workPackages) record.workPackages = clone(budget.workPackages.packages || budget.workPackages || []);
    if (budget.quantities || ev.quantities) record.quantities = clone(budget.quantities || ev.quantities || []);
    if (budget.compositionMatches || ev.compositionSelections) record.compositionSelections = clone((budget.compositionMatches || ev.compositionSelections || []).map(function (item) { return Object.assign({}, item, { selected: item.selected === true }); }));
    if (budget.consumptions || ev.consumptions) record.consumptions = clone(budget.consumptions || ev.consumptions || []);
    if (ev.audit || ev.audits) record.audits = record.audits.concat(clone(ev.audits || [ev.audit]));
    const revision = { number: record.revisions.length, date: now(), summary: clean(ev.summary || budget.summary || "Atualização do prontuário técnico."), origin: clean(ev.origin || "orçamento") };
    record.revisions.push(revision);
    record.history.push({ at: revision.date, type: clean(ev.type || "budget_update"), message: clean(ev.message || ev.originalMessage || facts.originalMessage || revision.summary), origin: revision.origin });
    record.status = inferStatus(record);
    record.updatedAt = now();
    return record;
  }

  function serializeProjectRecord(record) { return JSON.stringify(record || {}, null, 2); }
  function hydrateProjectRecord(json) { return typeof json === "string" ? JSON.parse(json || "{}") : clone(json); }
  function summarizeProjectRecord(record) {
    const r = record || {};
    return { id: r.id, status: r.status || "draft", revision: Math.max(0, (r.revisions || []).length - 1), type: r.project && r.project.type || "", builtAreaM2: r.project && r.project.builtAreaM2 || 0, pendingPackages: (r.workPackages || []).filter(function (p) { return p.status !== "ready"; }).length, quantities: (r.quantities || []).length, consumptions: (r.consumptions || []).length, audits: (r.audits || []).length };
  }

  root.EloProjectRecordEngine = { version: VERSION, buildOrUpdateProjectRecord, serializeProjectRecord, hydrateProjectRecord, summarizeProjectRecord };
})(typeof window !== "undefined" ? window : globalThis);

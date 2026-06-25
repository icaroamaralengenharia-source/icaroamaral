(function (root) {
  "use strict";
  const VERSION = "20260624-elo-composition-selection-v1";
  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim(); }
  function clone(v) { return JSON.parse(JSON.stringify(v || {})); }
  function now() { return new Date().toISOString(); }
  function listSelectableCompositions(budget) {
    const list = [];
    (budget && budget.compositionMatches || []).forEach((m) => (m.candidates || []).forEach((c) => list.push({ packageId: m.packageId, serviceId: m.serviceId, code: c.code, description: c.description, source: c.source, unit: c.unit, score: c.score, candidate: c })));
    return list;
  }
  function getSelectedCompositions(projectRecord) { return (projectRecord && projectRecord.compositionSelections || []).filter((c) => c.selected === true); }
  function selectComposition(projectRecord, selection) {
    const r = clone(projectRecord); const s = selection || {}; const candidates = listSelectableCompositions(r.budget || {}); const found = candidates.find((c) => c.packageId === s.packageId && c.serviceId === s.serviceId && c.code === s.compositionCode);
    if (!found) return Object.assign(r, { selectionError: "composition_not_from_official_candidates" });
    r.compositionSelections = (r.compositionSelections || []).filter((c) => !(c.packageId === s.packageId && c.serviceId === s.serviceId));
    const selected = { packageId: s.packageId, serviceId: s.serviceId, code: found.code, description: found.description, source: found.source || s.source || "SINAPI", unit: found.unit, selected: true, selectedAt: now(), userId: "local", reason: clean(s.reason || "seleção assistida") };
    r.compositionSelections.push(selected);
    r.revisions = r.revisions || []; r.revisions.push({ number: r.revisions.length, date: now(), summary: "Composição selecionada: " + found.code, origin: "composition_selection" });
    r.history = r.history || []; r.history.push({ at: now(), type: "composition_selected", message: found.code + " selecionada para " + s.serviceId, origin: "composition_selection" });
    return r;
  }
  function unselectComposition(projectRecord, selection) { const r = clone(projectRecord); const s = selection || {}; r.compositionSelections = (r.compositionSelections || []).filter((c) => !(c.packageId === s.packageId && c.serviceId === s.serviceId)); r.history = r.history || []; r.history.push({ at: now(), type: "composition_unselected", message: "Composição removida de " + s.serviceId, origin: "composition_selection" }); return r; }
  root.EloCompositionSelectionEngine = { version: VERSION, listSelectableCompositions, selectComposition, unselectComposition, getSelectedCompositions };
})(typeof window !== "undefined" ? window : globalThis);

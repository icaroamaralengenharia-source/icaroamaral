(function (root) {
  "use strict";
  const VERSION = "20260624-elo-traceability-v1";
  function now() { return new Date().toISOString(); }
  function entry(n, origin, description, evidence, confidence) { return { number: n, origin, description, evidence, confidence: confidence == null ? null : confidence, date: now() }; }
  function buildTraceabilityEntries(input) {
    const data = input || {}; const out = []; let n = 1;
    (data.quantities || []).forEach((q) => out.push(entry(n++, q.source === "informed" ? "user_input" : q.source === "estimated" ? "estimated" : "pending", q.description + " = " + (q.quantity == null ? "pendente" : q.quantity + " " + q.unit), q.formula || q.source, q.confidence)));
    (data.compositions || []).forEach((c) => (c.candidates || []).forEach((cand) => out.push(entry(n++, "official_composition", "Composição candidata " + cand.code + " para " + c.service, cand.source || "base oficial", cand.score))));
    (data.consumptions || []).forEach((c) => out.push(entry(n++, "official_composition", "Consumo calculado por " + c.compositionCode, "total = coeficiente × quantidade", 1)));
    (data.audits || []).forEach((a) => out.push(entry(n++, a.status === "blocked" ? "blocked" : "audit", "Auditoria: " + a.status, JSON.stringify(a.comparisons || []), null)));
    (data.blocked || []).forEach((b) => out.push(entry(n++, "blocked", "Bloqueio: " + b.reason, b.serviceId || b.packageId, 0)));
    return out;
  }
  root.EloTraceabilityEngine = { version: VERSION, buildTraceabilityEntries };
})(typeof window !== "undefined" ? window : globalThis);

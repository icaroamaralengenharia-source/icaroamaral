(function (root) {
  "use strict";
  const VERSION = "20260624-elo-export-v1";
  function clean(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }
  function csv(v) { const text = clean(v); return /[;"\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; }
  function line(cols) { return cols.map(csv).join(";"); }
  function exportBudgetToCsv(budgetTable) {
    const rows = budgetTable && budgetTable.rows || [];
    const out = [line(["Pacote", "Serviço", "Quantidade", "Unidade", "Origem do quantitativo", "Composição", "Fonte", "Status", "Pendências"])]
    rows.forEach((r) => out.push(line([r.package, r.service, r.quantity == null ? "pendente" : r.quantity, r.unit, r.quantitySource || "pending", r.compositionCode || "pendente", r.compositionSource || "", r.consumptionStatus || "pending", (r.pending || []).join(" | ") || ""])));
    return out.join("\n");
  }
  function exportProjectRecordToJson(projectRecord) { return JSON.stringify(projectRecord || {}, null, 2); }
  function exportExecutivePreviewToCsv(executivePreview) {
    const rows = executivePreview && executivePreview.rows || [];
    const out = [line(["Pacote", "Serviço", "Quantidade", "Unidade", "Composição", "Status"])]
    rows.forEach((r) => out.push(line([r.package, r.service, r.quantity == null ? "pendente" : r.quantity, r.unit, r.compositionCode || "pendente", r.status || "pending"])));
    return out.join("\n");
  }
  root.EloExportEngine = { version: VERSION, exportBudgetToCsv, exportProjectRecordToJson, exportExecutivePreviewToCsv };
})(typeof window !== "undefined" ? window : globalThis);

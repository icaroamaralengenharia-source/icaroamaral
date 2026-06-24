(function (root) {
  "use strict";

  const VERSION = "20260624-elo-executive-budget-v1";
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function add(list, id, message) { if (!list.some(function (x) { return x.id === id; })) list.push({ id, message }); }

  function evaluateExecutiveReadiness(projectRecord, budget) {
    const record = projectRecord || {};
    const project = record.project || {};
    const premises = record.premises || {};
    const b = budget || {};
    const blockers = [];
    const missing = [];
    const requiredToClose = [];
    if (!clean(project.name) && !clean(record.client && record.client.name)) add(blockers, "project_identity", "Informe cliente ou identificação da obra.");
    if (!clean(project.cityUf)) add(blockers, "city_uf", "Informe cidade/UF da obra.");
    if (!clean(project.type)) add(missing, "project_type", "Informe tipo de obra.");
    if (!project.builtAreaM2) add(missing, "built_area", "Informe área construída.");
    if ((record.workPackages || []).some(function (p) { return p.status !== "ready"; })) add(blockers, "scope_not_closed", "Escopo ainda possui pacotes pendentes.");
    if (!(record.compositionSelections || []).some(function (c) { return c.selected === true; })) add(blockers, "candidate_compositions", "Composições ainda são candidatas, não selecionadas.");
    if ((b.budgetTable && b.budgetTable.summary && b.budgetTable.summary.pendingRows) > 0) add(blockers, "pending_quantities", "Existem quantitativos/linhas pendentes.");
    if ((b.consumptionBlocked || []).length) add(blockers, "unit_or_consumption_blocked", "Há consumo bloqueado por unidade, composição ou coeficiente.");
    if (!clean(premises.sinapiState) || !clean(premises.sinapiReferenceMonth)) add(missing, "sinapi_base", "Informe UF e mês da base SINAPI.");
    if (!premises.priceSource) add(blockers, "price_source", "Fonte de preço/custo oficial ausente.");
    if (premises.bdi === undefined || premises.bdi === null || premises.bdi === "") add(missing, "bdi", "Informe BDI se aplicável.");
    requiredToClose.push.apply(requiredToClose, blockers.concat(missing));
    const checks = 10;
    const failed = blockers.length + missing.length;
    const score = Math.max(0, Math.min(1, (checks - failed) / checks));
    return { ready: blockers.length === 0 && missing.length === 0, score: Number(score.toFixed(2)), blockers, missing, requiredToClose, executivePreview: buildExecutiveBudgetPreview(record, b).executivePreview };
  }

  function buildExecutiveBudgetPreview(projectRecord, budget) {
    const b = budget || {};
    const rows = (b.budgetTable && b.budgetTable.rows || []).map(function (row) { return { package: row.package, service: row.service, quantity: row.quantity, unit: row.unit, compositionCode: row.compositionCode, status: row.pending && row.pending.length ? "pending" : row.consumptionStatus }; });
    return { executivePreview: { rows, totals: null, bdi: projectRecord && projectRecord.premises && projectRecord.premises.bdi || null, schedule: [] }, blocked: rows.filter(function (r) { return r.status !== "ready"; }) };
  }

  root.EloExecutiveBudgetEngine = { version: VERSION, evaluateExecutiveReadiness, buildExecutiveBudgetPreview };
})(typeof window !== "undefined" ? window : globalThis);

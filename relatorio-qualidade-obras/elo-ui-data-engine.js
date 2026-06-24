(function (root) {
  "use strict";

  const VERSION = "20260624-elo-ui-data-v1";
  function count(list) { return (list || []).length; }
  function statusBy(value, warnAt) { return value > warnAt ? "attention" : "ok"; }

  function buildEloDashboardData(input) {
    const data = input || {};
    const record = data.projectRecord || {};
    const budget = data.budget || {};
    const readiness = data.executiveReadiness || {};
    const packages = budget.workPackages && budget.workPackages.packages || record.workPackages || [];
    const quantities = budget.quantities || record.quantities || [];
    const matches = budget.compositionMatches || record.compositionSelections || [];
    const consumptions = budget.consumptions || record.consumptions || [];
    const audits = record.audits || [];
    const pendingRows = budget.budgetTable && budget.budgetTable.summary && budget.budgetTable.summary.pendingRows || 0;
    const criticalAudits = audits.filter(function (a) { return a && a.status === "critical"; }).length;
    const cards = [
      { id: "packages", label: "Pacotes", value: count(packages), status: "ok" },
      { id: "ready-quantities", label: "Quantitativos prontos", value: quantities.filter(function (q) { return q.source !== "pending"; }).length, status: "ok" },
      { id: "pending", label: "Pendências", value: pendingRows + count(readiness.blockers) + count(readiness.missing), status: statusBy(pendingRows + count(readiness.blockers), 0) },
      { id: "compositions", label: "Composições localizadas", value: matches.filter(function (m) { return m.found || m.composition || (m.candidates || []).length; }).length, status: "ok" },
      { id: "consumptions", label: "Consumos calculados", value: count(consumptions), status: "ok" },
      { id: "critical-audits", label: "Auditorias críticas", value: criticalAudits, status: criticalAudits ? "critical" : "ok" },
      { id: "executive-readiness", label: "Prontidão para executivo", value: Math.round((readiness.score || 0) * 100) + "%", status: readiness.ready ? "ok" : "attention" }
    ];
    const alerts = [];
    if (pendingRows) alerts.push({ id: "pending-budget", status: "attention", message: "Existem linhas pendentes no orçamento preliminar." });
    (budget.consumptionBlocked || []).forEach(function (item, index) { alerts.push({ id: "blocked-consumption-" + index, status: "blocked", message: "Consumo bloqueado: " + item.reason }); });
    (readiness.blockers || []).forEach(function (item) { alerts.push({ id: "executive-" + item.id, status: "blocked", message: item.message }); });
    if (criticalAudits) alerts.push({ id: "critical-audit", status: "critical", message: "Há auditoria crítica." });
    if (!(matches || []).length) alerts.push({ id: "sinapi-base", status: "attention", message: "Nenhuma composição localizada; verifique base SINAPI." });
    const actions = [
      { id: "confirm-premise", label: "Confirmar premissa", enabled: true },
      { id: "inform-wall-perimeter", label: "Informar perímetro", enabled: true },
      { id: "select-composition", label: "Selecionar composição", enabled: matches.some(function (m) { return (m.candidates || []).length; }) },
      { id: "generate-report", label: "Gerar relatório", enabled: !!budget.budgetTable },
      { id: "audit-withdrawal", label: "Auditar retirada", enabled: count(consumptions) > 0 },
      { id: "evaluate-executive", label: "Avaliar executivo", enabled: true }
    ];
    return { cards, tables: { workPackages: packages, budgetRows: budget.budgetTable && budget.budgetTable.rows || [], consumptions, audits, revisions: record.revisions || [] }, alerts, actions };
  }

  root.EloUiDataEngine = { version: VERSION, buildEloDashboardData };
})(typeof window !== "undefined" ? window : globalThis);

(function (root) {
  "use strict";

  const VERSION = "20260624-elo-budget-table-engine-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function number(value) { const parsed = Number(String(value || "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
  function firstCandidate(match) { return match && (match.composition || match.candidate || match.candidates && match.candidates[0]) || null; }

  function buildBudgetTable(input) {
    const data = input || {};
    const packages = data.workPackages && data.workPackages.packages || [];
    const quantities = data.quantities || [];
    const matches = data.compositionMatches || [];
    const consumptions = data.consumptions || [];
    const audits = data.audits || null;
    const rows = [];

    packages.forEach(function (pack) {
      (pack.services || []).forEach(function (service) {
        const quantity = quantities.find(function (item) { return item.packageId === pack.id && item.serviceId === service.id; });
        const match = matches.find(function (item) { return item.packageId === pack.id && (item.serviceId === service.id || !item.serviceId); });
        const composition = firstCandidate(match);
        const consumption = consumptions.find(function (item) { return item.packageId === pack.id && item.serviceId === service.id; });
        const auditStatus = audits && audits.comparisons && audits.comparisons.length ? audits.status : "none";
        let consumptionStatus = "pending";
        if (consumption) consumptionStatus = "ready";
        else if (quantity && composition && match && match.blocked) consumptionStatus = "blocked";
        else if (quantity && !composition) consumptionStatus = "pending";
        const pending = [];
        if (!quantity) pending.push("quantitativo pendente");
        if (!composition) pending.push("composição oficial pendente");
        (pack.missing || []).forEach(function (item) { pending.push(item); });
        rows.push({
          package: pack.name,
          packageId: pack.id,
          service: service.description || service.id,
          serviceId: service.id,
          quantity: quantity ? number(quantity.quantity) : null,
          unit: quantity ? quantity.unit : service.unit,
          quantitySource: quantity ? quantity.source : "pending",
          compositionCode: composition ? clean(composition.code) : "",
          compositionSource: composition ? clean(composition.source) : "",
          consumptionStatus: consumptionStatus,
          auditStatus: auditStatus,
          pending: pending
        });
      });
    });

    const summary = {
      totalRows: rows.length,
      readyRows: rows.filter(function (row) { return row.quantitySource !== "pending" && row.compositionCode && row.consumptionStatus === "ready"; }).length,
      pendingRows: rows.filter(function (row) { return row.pending.length > 0 || row.consumptionStatus === "pending"; }).length,
      blockedRows: rows.filter(function (row) { return row.consumptionStatus === "blocked"; }).length,
      criticalAudits: rows.filter(function (row) { return row.auditStatus === "critical"; }).length
    };
    return { rows: rows, summary: summary };
  }

  root.EloBudgetTableEngine = { version: VERSION, buildBudgetTable: buildBudgetTable };
})(typeof window !== "undefined" ? window : globalThis);

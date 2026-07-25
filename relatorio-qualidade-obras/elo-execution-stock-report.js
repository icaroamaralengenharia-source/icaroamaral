(function (root) {
  "use strict";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function toNumber(value) {
    const parsed = Number(String(value == null ? "" : value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round(value) {
    return Math.round(toNumber(value) * 1000) / 1000;
  }

  function formatNumber(value) {
    return String(round(value)).replace(".", ",");
  }

  function formatQuantity(value, unit) {
    return formatNumber(value) + (unit ? " " + clean(unit) : "");
  }

  const STATUS_LABELS = {
    ok: "dentro do esperado",
    consumption_above_expected: "consumo acima",
    consumption_below_expected: "consumo abaixo",
    production_without_stock_exit: "producao sem saida",
    stock_exit_without_production: "saida sem producao",
    insufficient_balance: "saldo insuficiente",
    missing_reference: "referencia ausente"
  };

  const STATUS_RANK = {
    insufficient_balance: 0,
    production_without_stock_exit: 1,
    consumption_above_expected: 2,
    stock_exit_without_production: 3,
    missing_reference: 4,
    consumption_below_expected: 5,
    ok: 9
  };

  function statusLabel(status) {
    return STATUS_LABELS[clean(status)] || "referencia ausente";
  }

  function severityRank(status) {
    const key = clean(status);
    return Object.prototype.hasOwnProperty.call(STATUS_RANK, key) ? STATUS_RANK[key] : 8;
  }

  function percentDifference(expected, difference) {
    const base = toNumber(expected);
    if (base <= 0) return null;
    const value = (toNumber(difference) / base) * 100;
    return Number.isFinite(value) ? round(value) : null;
  }

  function listSources(snapshot) {
    const sources = snapshot && snapshot.sourcesUsed && typeof snapshot.sourcesUsed === "object" ? snapshot.sourcesUsed : {};
    return {
      rdos: sources.rdos === true,
      stockMovements: sources.stockMovements === true,
      stockBalances: sources.stockBalances === true,
      plannedConsumptions: sources.plannedConsumptions === true
    };
  }

  function missingSources(snapshot, cross) {
    const result = [];
    const snapshotMissing = snapshot && snapshot.dataQuality && Array.isArray(snapshot.dataQuality.missingSources) ? snapshot.dataQuality.missingSources : [];
    snapshotMissing.forEach(function (source) { if (source && result.indexOf(source) === -1) result.push(source); });
    const quality = cross && cross.dataQuality && typeof cross.dataQuality === "object" ? cross.dataQuality : {};
    [
      ["rdos", quality.hasProductions],
      ["stockMovements", quality.hasStockMovements],
      ["stockBalances", quality.hasStockBalances],
      ["plannedConsumptions", quality.hasSinapiExpectedConsumptions]
    ].forEach(function (pair) {
      if (pair[1] === false && result.indexOf(pair[0]) === -1) result.push(pair[0]);
    });
    return result;
  }

  function periodFrom(snapshot) {
    const dates = [];
    function collect(item) {
      const value = clean(item && (item.date || item.data || item.createdAt || item.created_at || item.referenceDate));
      if (value) dates.push(value);
    }
    (Array.isArray(snapshot && snapshot.productions) ? snapshot.productions : []).forEach(collect);
    (Array.isArray(snapshot && snapshot.stockMovements) ? snapshot.stockMovements : []).forEach(collect);
    dates.sort();
    return {
      start: dates[0] || "",
      end: dates[dates.length - 1] || "",
      label: dates.length ? dates[0] + (dates[dates.length - 1] !== dates[0] ? " a " + dates[dates.length - 1] : "") : "periodo nao informado"
    };
  }

  function sameScope(item, scope) {
    if (!item || typeof item !== "object") return false;
    const projectId = clean(item.projectId || item.project_id || item.project);
    const workId = clean(item.workId || item.work_id || item.work || item.obraId || item.obra_id);
    return (!scope.projectId || !projectId || projectId === scope.projectId) &&
      (!scope.workId || !workId || workId === scope.workId);
  }

  function scopedProductions(snapshot, cross) {
    const scope = {
      projectId: clean(snapshot && (snapshot.projectId || cross && cross.summary && cross.summary.projectId)),
      workId: clean(snapshot && (snapshot.workId || cross && cross.summary && cross.summary.workId))
    };
    return (Array.isArray(snapshot && snapshot.productions) ? snapshot.productions : []).filter(function (item) {
      return sameScope(item, scope);
    });
  }

  function productionLine(item) {
    return {
      id: clean(item && (item.id || item.productionId || item.serviceId)),
      serviceId: clean(item && (item.serviceId || item.service_id || item.workItemId)),
      service: clean(item && (item.service || item.serviceName || item.description || item.name)) || "servico sem nome",
      quantity: round(item && (item.quantity || item.executedQuantity || item.producedQuantity || item.amount)),
      unit: clean(item && (item.unit || item.unidade)) || "un"
    };
  }

  function materialLine(item) {
    const expected = round(item && item.expectedConsumption);
    const actual = round(item && item.actualStockExit);
    const difference = round(item && item.difference);
    const status = clean(item && item.status) || "missing_reference";
    return {
      material: clean(item && item.material) || "material",
      unit: clean(item && item.unit) || "un",
      expectedConsumption: expected,
      actualStockExit: actual,
      currentBalance: item && item.currentBalance == null ? null : round(item.currentBalance),
      difference: difference,
      differencePercent: percentDifference(expected, difference),
      classification: statusLabel(status),
      status: status
    };
  }

  function buildPrioritizedAlerts(materials) {
    return materials.filter(function (item) {
      return item.status !== "ok";
    }).sort(function (a, b) {
      const rank = severityRank(a.status) - severityRank(b.status);
      if (rank) return rank;
      return Math.abs(b.difference) - Math.abs(a.difference);
    }).map(function (item) {
      return {
        material: item.material,
        status: item.status,
        classification: item.classification,
        difference: item.difference,
        severityRank: severityRank(item.status)
      };
    });
  }

  function conclusionFor(alerts, limitations) {
    if (limitations.length) return "Diagnostico limitado por fontes ausentes; sem essas fontes, nao ha estimativa inventada.";
    if (!alerts.length) return "Execucao, consumo, saidas e saldo estao dentro do esperado nos dados locais.";
    if (alerts.some(function (item) { return item.status === "insufficient_balance"; })) return "Ha risco de falta de material; priorize conferencia de saldo e novas compras.";
    if (alerts.some(function (item) { return item.status === "consumption_above_expected"; })) return "Ha indicio de consumo acima do esperado; revise perdas, apontamentos e frente executada.";
    return "Ha divergencias entre execucao, consumo e estoque que exigem conferencia operacional.";
  }

  function insufficient(snapshot, cross, missing) {
    const productions = scopedProductions(snapshot, cross);
    const materials = Array.isArray(cross && cross.materials) ? cross.materials : [];
    if (!productions.length || !materials.length) {
      return {
        ok: false,
        reason: "insufficient_local_data",
        missingSources: missing.length ? missing : ["rdos", "stockMovements", "stockBalances", "plannedConsumptions"],
        text: "Relatorio local de consumo e risco: nao ha dados locais suficientes. Fontes ausentes: " + (missing.length ? missing.join(", ") : "rdos, stockMovements, stockBalances, plannedConsumptions") + "."
      };
    }
    return null;
  }

  function buildExecutionStockReport(input) {
    const safe = input || {};
    const snapshot = safe.snapshot && typeof safe.snapshot === "object" ? safe.snapshot : {};
    const cross = safe.cross && typeof safe.cross === "object" ? safe.cross : {};
    const missing = missingSources(snapshot, cross);
    const empty = insufficient(snapshot, cross, missing);
    if (empty) return empty;

    const materials = (Array.isArray(cross.materials) ? cross.materials : []).map(materialLine);
    const prioritizedAlerts = buildPrioritizedAlerts(materials);
    const summary = {
      productions: scopedProductions(snapshot, cross).length,
      materials: materials.length,
      alerts: prioritizedAlerts.length
    };
    const report = {
      ok: true,
      scope: {
        projectId: clean(snapshot.projectId || cross.summary && cross.summary.projectId),
        workId: clean(snapshot.workId || cross.summary && cross.summary.workId),
        workName: clean(snapshot.workName || snapshot.obra || snapshot.name)
      },
      period: periodFrom(snapshot),
      sourcesUsed: listSources(snapshot),
      summary: summary,
      productions: scopedProductions(snapshot, cross).map(productionLine),
      materials: materials,
      prioritizedAlerts: prioritizedAlerts,
      limitations: missing,
      conclusion: conclusionFor(prioritizedAlerts, missing)
    };
    report.text = formatExecutionStockReport(report);
    return report;
  }

  function formatExecutionStockReport(report) {
    if (!report || report.ok !== true) return clean(report && report.text);
    const sourceNames = Object.keys(report.sourcesUsed || {}).filter(function (key) { return report.sourcesUsed[key]; });
    const lines = [];
    lines.push("Relatorio local de consumo e risco");
    lines.push("");
    lines.push("Obra: " + (report.scope.workName || report.scope.workId || report.scope.projectId || "obra atual"));
    lines.push("Periodo: " + (report.period && report.period.label || "periodo nao informado"));
    lines.push("Fontes usadas: " + (sourceNames.length ? sourceNames.join(", ") : "nenhuma fonte local completa"));
    lines.push("");
    lines.push("Producao executada:");
    report.productions.forEach(function (item) {
      lines.push("- " + item.service + ": " + formatQuantity(item.quantity, item.unit));
    });
    lines.push("");
    lines.push("Consumo esperado x saida real x saldo:");
    report.materials.forEach(function (item) {
      const percent = item.differencePercent == null ? "sem percentual" : formatNumber(item.differencePercent) + "%";
      lines.push("- " + item.material + ": esperado " + formatQuantity(item.expectedConsumption, item.unit) + "; saida real " + formatQuantity(item.actualStockExit, item.unit) + "; saldo " + (item.currentBalance == null ? "nao informado" : formatQuantity(item.currentBalance, item.unit)) + "; diferenca " + formatQuantity(item.difference, item.unit) + " (" + percent + "); " + item.classification + ".");
    });
    lines.push("");
    lines.push("Alertas priorizados:");
    if (report.prioritizedAlerts.length) {
      report.prioritizedAlerts.forEach(function (alert) {
        lines.push("- " + alert.material + ": " + alert.classification + ".");
      });
    } else {
      lines.push("- Sem alertas relevantes nos dados locais.");
    }
    if (report.limitations.length) {
      lines.push("");
      lines.push("Limitacoes e fontes ausentes: " + report.limitations.join(", ") + ". Sem essas fontes, eu nao invento valores.");
    }
    lines.push("");
    lines.push("Conclusao tecnica: " + report.conclusion);
    return lines.join("\n");
  }

  const api = { buildExecutionStockReport: buildExecutionStockReport, formatExecutionStockReport: formatExecutionStockReport };
  if (typeof exports !== "undefined") exports.buildExecutionStockReport = buildExecutionStockReport;
  if (typeof exports !== "undefined") exports.formatExecutionStockReport = formatExecutionStockReport;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EloExecutionStockReport = api;
})(typeof window !== "undefined" ? window : globalThis);

export const buildExecutionStockReport = globalThis.EloExecutionStockReport.buildExecutionStockReport;
export const formatExecutionStockReport = globalThis.EloExecutionStockReport.formatExecutionStockReport;

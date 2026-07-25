(function (root) {
  "use strict";

  const PRIORITY_ORDER = {
    shortage_risk: 1,
    consumption_above_expected: 2,
    production_without_stock_exit: 3,
    stock_exit_without_production: 4,
    rdo_pending: 5,
    critical_missing_data: 6
  };

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function toNumber(value) {
    const parsed = Number(String(value == null ? "" : value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sameScope(item, scope) {
    if (!item || typeof item !== "object") return true;
    const itemScope = item.scope && typeof item.scope === "object" ? item.scope : {};
    const projectId = clean(item.projectId || item.project_id || item.project || itemScope.projectId);
    const workId = clean(item.workId || item.work_id || item.work || item.obraId || item.obra_id || itemScope.workId);
    return (!scope.projectId || !projectId || projectId === scope.projectId) &&
      (!scope.workId || !workId || workId === scope.workId);
  }

  function formatQuantity(value, unit) {
    const number = Math.round(toNumber(value) * 1000) / 1000;
    return String(number).replace(".", ",") + (unit ? " " + clean(unit) : "");
  }

  function priorityTypeForStatus(status) {
    const key = clean(status);
    if (key === "insufficient_balance") return "shortage_risk";
    if (key === "consumption_above_expected") return "consumption_above_expected";
    if (key === "production_without_stock_exit") return "production_without_stock_exit";
    if (key === "stock_exit_without_production") return "stock_exit_without_production";
    if (key === "missing_reference") return "critical_missing_data";
    return "";
  }

  function labelFor(type) {
    const labels = {
      shortage_risk: "risco de falta",
      consumption_above_expected: "consumo acima",
      production_without_stock_exit: "producao sem saida",
      stock_exit_without_production: "saida sem producao",
      rdo_pending: "RDO pendente",
      critical_missing_data: "dado ausente critico"
    };
    return labels[type] || "prioridade";
  }

  function evidenceForMaterial(item) {
    const unit = clean(item && item.unit) || "un";
    return [
      "esperado " + formatQuantity(item && item.expectedConsumption, unit),
      "saida " + formatQuantity(item && item.actualStockExit, unit),
      "saldo " + (item && item.currentBalance == null ? "nao informado" : formatQuantity(item.currentBalance, unit)),
      "diferenca " + formatQuantity(item && item.difference, unit)
    ].join("; ");
  }

  function actionFor(type) {
    if (type === "shortage_risk") return "Abrir Almoxarifado e conferir saldo antes de liberar a frente.";
    if (type === "consumption_above_expected") return "Abrir RDO e comparar apontamento, perda e frente executada.";
    if (type === "production_without_stock_exit") return "Abrir Almoxarifado e conferir se a saida foi lancada.";
    if (type === "stock_exit_without_production") return "Abrir RDO e conferir se a producao correspondente foi registrada.";
    if (type === "rdo_pending") return "Abrir RDO e registrar o diario da obra atual.";
    return "Gerar relatorio local e completar as fontes ausentes.";
  }

  function pushUnique(list, item) {
    const key = [item.type, item.subject, item.evidence].map(clean).join("|");
    if (!key || list.some(function (existing) {
      return [existing.type, existing.subject, existing.evidence].map(clean).join("|") === key;
    })) return;
    list.push(item);
  }

  function dataQualityFrom(input) {
    const safe = input || {};
    const snapshotQuality = safe.snapshot && safe.snapshot.dataQuality || {};
    const cross = safe.executionStockCross || safe.cross || {};
    const crossQuality = cross.dataQuality || {};
    const report = safe.localReport || safe.report || {};
    const missing = [];
    function add(source) {
      const key = clean(source);
      if (key && missing.indexOf(key) === -1) missing.push(key);
    }
    (Array.isArray(snapshotQuality.missingSources) ? snapshotQuality.missingSources : []).forEach(add);
    (Array.isArray(report.missingSources) ? report.missingSources : []).forEach(add);
    [
      ["rdos", crossQuality.hasProductions],
      ["stockMovements", crossQuality.hasStockMovements],
      ["stockBalances", crossQuality.hasStockBalances],
      ["plannedConsumptions", crossQuality.hasSinapiExpectedConsumptions]
    ].forEach(function (pair) {
      if (pair[1] === false) add(pair[0]);
    });
    return {
      level: missing.length ? "low" : "high",
      missingSources: missing,
      sourcesUsed: Object.assign({}, safe.snapshot && safe.snapshot.sourcesUsed || {}, report.sourcesUsed || {})
    };
  }

  function collectMaterialPriorities(input, scope) {
    const safe = input || {};
    const cross = safe.executionStockCross || safe.cross || {};
    const report = safe.localReport || safe.report || {};
    const materials = Array.isArray(cross.materials) ? cross.materials : Array.isArray(report.materials) ? report.materials : [];
    const priorities = [];
    materials.filter(function (item) {
      return sameScope(item, scope);
    }).forEach(function (item) {
      const type = priorityTypeForStatus(item && item.status);
      if (!type) return;
      pushUnique(priorities, {
        type: type,
        subject: clean(item.material) || "material",
        label: labelFor(type),
        evidence: evidenceForMaterial(item),
        recommendedAction: actionFor(type),
        source: "executionStockCross",
        severity: PRIORITY_ORDER[type]
      });
    });
    return priorities;
  }

  function collectRdoPriority(input, scope) {
    const safe = input || {};
    const rdo = safe.rdo || {};
    const report = safe.localReport || safe.report || {};
    const missing = dataQualityFrom(safe).missingSources;
    const pending = rdo.pending === true || clean(rdo.status) === "pending" || missing.indexOf("rdos") >= 0 ||
      (report.ok === false && Array.isArray(report.missingSources) && report.missingSources.indexOf("rdos") >= 0);
    if (!pending || !sameScope(rdo, scope)) return [];
    return [{
      type: "rdo_pending",
      subject: "RDO",
      label: labelFor("rdo_pending"),
      evidence: clean(rdo.evidence || "fonte rdos ausente ou pendente"),
      recommendedAction: actionFor("rdo_pending"),
      source: "rdo",
      severity: PRIORITY_ORDER.rdo_pending
    }];
  }

  function collectMissingDataPriorities(input) {
    return dataQualityFrom(input).missingSources.filter(function (source) {
      return source !== "rdos";
    }).map(function (source) {
      return {
        type: "critical_missing_data",
        subject: clean(source),
        label: labelFor("critical_missing_data"),
        evidence: "fonte ausente: " + clean(source),
        recommendedAction: actionFor("critical_missing_data"),
        source: "dataQuality",
        severity: PRIORITY_ORDER.critical_missing_data
      };
    });
  }

  function buildSummary(input, priorities, dataQuality) {
    const safe = input || {};
    const report = safe.localReport || safe.report || {};
    const cross = safe.executionStockCross || safe.cross || {};
    const summary = report.summary || cross.summary || {};
    const obra = report.scope && (report.scope.workName || report.scope.workId || report.scope.projectId) ||
      summary.workId || summary.projectId || "obra atual";
    return {
      text: priorities.length
        ? "Hoje na obra: " + priorities.length + " prioridade(s) para revisar em " + obra + "."
        : dataQuality.level === "low"
          ? "Hoje na obra: dados locais insuficientes para priorizar com seguranca."
          : "Hoje na obra: sem prioridade critica nos dados locais.",
      obra: clean(obra),
      totalPriorities: priorities.length,
      dataQuality: dataQuality.level
    };
  }

  function buildTodayWorkCore(input) {
    const safe = input || {};
    const report = safe.localReport || safe.report || {};
    const cross = safe.executionStockCross || safe.cross || {};
    const scope = {
      projectId: clean(safe.projectId || report.scope && report.scope.projectId || cross.summary && cross.summary.projectId),
      workId: clean(safe.workId || report.scope && report.scope.workId || cross.summary && cross.summary.workId)
    };
    const dataQuality = dataQualityFrom(safe);
    const priorities = []
      .concat(collectMaterialPriorities(safe, scope))
      .concat(collectRdoPriority(safe, scope))
      .concat(collectMissingDataPriorities(safe))
      .sort(function (a, b) {
        const rank = a.severity - b.severity;
        if (rank) return rank;
        return clean(a.subject).localeCompare(clean(b.subject));
      })
      .slice(0, 5);
    return {
      summary: buildSummary(safe, priorities, dataQuality),
      priorities: priorities,
      alerts: priorities.map(function (item) {
        return {
          type: item.type,
          subject: item.subject,
          label: item.label,
          evidence: item.evidence,
          source: item.source
        };
      }),
      recommendedActions: priorities.map(function (item) {
        return {
          priorityType: item.type,
          subject: item.subject,
          action: item.recommendedAction
        };
      }),
      dataQuality: dataQuality
    };
  }

  const api = { buildTodayWorkCore: buildTodayWorkCore };
  if (typeof exports !== "undefined") exports.buildTodayWorkCore = buildTodayWorkCore;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EloTodayWorkCore = api;
})(typeof window !== "undefined" ? window : globalThis);

export const buildTodayWorkCore = globalThis.EloTodayWorkCore.buildTodayWorkCore;

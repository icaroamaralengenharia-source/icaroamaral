(function (root) {
  "use strict";

  const VERSION = 1;

  function clean(value, max) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim().slice(0, max || 400);
  }

  function arrayOf(value) {
    return Array.isArray(value) ? value : [];
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function nowIso(options) {
    if (options && typeof options.now === "function") return options.now();
    return new Date().toISOString();
  }

  function summarizeList(items, fields) {
    return arrayOf(items).map(function (item) {
      const safe = item && typeof item === "object" ? item : {};
      const output = {};
      fields.forEach(function (field) {
        if (safe[field] != null && safe[field] !== "") output[field] = safe[field];
      });
      return output;
    });
  }

  function fingerprintPayload(snapshot, savedRdo) {
    return {
      workId: clean(savedRdo && savedRdo.workId),
      rdo: {
        id: clean(savedRdo && savedRdo.id),
        updatedAt: clean(savedRdo && savedRdo.updatedAt)
      },
      stockMovements: summarizeList(snapshot && snapshot.stockMovements, ["id", "workId", "material", "unit", "quantity", "date"]),
      stockBalances: summarizeList(snapshot && snapshot.stockBalances, ["workId", "balance"]),
      expectedConsumptions: summarizeList(snapshot && snapshot.sinapiExpectedConsumptions, ["workId", "productionId", "serviceId", "material", "unit", "coefficient", "expectedConsumption"])
    };
  }

  function sourceFingerprint(snapshot, savedRdo) {
    return JSON.stringify(fingerprintPayload(snapshot || {}, savedRdo || {}));
  }

  function missingInputsFrom(snapshot) {
    const safe = snapshot || {};
    const missing = [];
    if (!arrayOf(safe.productions).length) missing.push("productions");
    if (!arrayOf(safe.sinapiExpectedConsumptions).length) missing.push("plannedConsumptions");
    if (!arrayOf(safe.stockMovements).length) missing.push("stockMovements");
    if (!arrayOf(safe.stockBalances).length) missing.push("stockBalances");
    return missing;
  }

  function normalizeAlert(alert) {
    const safe = alert && typeof alert === "object" ? alert : {};
    return {
      material: clean(safe.material || safe.name),
      status: clean(safe.status),
      classification: clean(safe.classification),
      difference: safe.difference == null ? null : Number(safe.difference)
    };
  }

  function normalizeResult(cross) {
    const safe = cross && typeof cross === "object" ? cross : {};
    return {
      summary: clone(safe.summary || {}),
      materials: arrayOf(safe.materials).map(function (item) {
        const material = item && typeof item === "object" ? item : {};
        return {
          material: clean(material.material || material.name),
          unit: clean(material.unit, 80),
          expectedConsumption: material.expectedConsumption == null ? null : Number(material.expectedConsumption),
          actualStockExit: material.actualStockExit == null ? null : Number(material.actualStockExit),
          currentBalance: material.currentBalance == null ? null : Number(material.currentBalance),
          difference: material.difference == null ? null : Number(material.difference),
          status: clean(material.status, 120)
        };
      }),
      alerts: arrayOf(safe.alerts).map(normalizeAlert),
      dataQuality: clone(safe.dataQuality || {})
    };
  }

  function stableText(value, max) {
    return clean(value, max || 400).toLowerCase();
  }

  function numberOrNull(value) {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function severityForType(type) {
    const safe = stableText(type, 120);
    if (safe === "insufficient_balance" || safe === "stock_exit_without_production") return "critical";
    if (safe === "consumption_above_expected" || safe === "production_without_stock_exit") return "high";
    if (safe === "consumption_below_expected" || safe === "missing_reference") return "medium";
    return "low";
  }

  function titleForAlert(type, materialName) {
    const material = clean(materialName, 160) || "Material";
    const safe = stableText(type, 120);
    if (safe === "consumption_above_expected") return "Consumo acima do previsto em " + material;
    if (safe === "consumption_below_expected") return "Consumo abaixo do previsto em " + material;
    if (safe === "production_without_stock_exit") return "Producao sem saida de estoque em " + material;
    if (safe === "stock_exit_without_production") return "Saida sem producao vinculada em " + material;
    if (safe === "insufficient_balance") return "Saldo insuficiente em " + material;
    if (safe === "missing_reference") return "Referencia de consumo ausente em " + material;
    return "Alerta de consumo em " + material;
  }

  function summaryForAlert(type, materialName, differenceQuantity, differencePercent) {
    const parts = [titleForAlert(type, materialName) + "."];
    if (differenceQuantity != null) parts.push("Diferenca: " + differenceQuantity + ".");
    if (differencePercent != null) parts.push("Desvio: " + differencePercent + "%.");
    return parts.join(" ");
  }

  function recommendationForType(type) {
    const safe = stableText(type, 120);
    if (safe === "consumption_above_expected") return "Conferir producao executada, perdas e baixa do estoque antes da proxima saida.";
    if (safe === "consumption_below_expected") return "Verificar se a producao foi concluida e se todas as saidas foram registradas.";
    if (safe === "production_without_stock_exit") return "Registrar ou revisar a saida de estoque relacionada ao servico executado.";
    if (safe === "stock_exit_without_production") return "Vincular a saida a um RDO ou confirmar se houve consumo sem producao apontada.";
    if (safe === "insufficient_balance") return "Revisar saldo, entradas e consumos antes de liberar nova movimentacao.";
    if (safe === "missing_reference") return "Vincular composicao ou consumo previsto para tornar a analise rastreavel.";
    return "Revisar dados do RDO, previsao de consumo e estoque antes de executar a proxima acao.";
  }

  function findMaterialResult(analysis, alert) {
    const alertMaterial = stableText(alert && (alert.material || alert.name), 160);
    const alertStatus = stableText(alert && alert.status, 120);
    return arrayOf(analysis && analysis.result && analysis.result.materials).find(function (item) {
      const material = item && typeof item === "object" ? item : {};
      return stableText(material.material || material.name, 160) === alertMaterial
        && (!alertStatus || stableText(material.status, 120) === alertStatus);
    }) || null;
  }

  function encodeIdPart(value) {
    return stableText(value, 160).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "null";
  }

  function buildExecutionStockAlertId(input) {
    const safe = input || {};
    return [
      "exa",
      encodeIdPart(safe.workId),
      encodeIdPart(safe.sourceRdoId),
      encodeIdPart(safe.sourceFingerprint),
      encodeIdPart(safe.type),
      encodeIdPart(safe.serviceCode || safe.serviceName),
      encodeIdPart(safe.materialCode || safe.materialName)
    ].join("_");
  }

  function buildOccurrenceKey(alert) {
    const safe = alert || {};
    return [
      encodeIdPart(safe.workId),
      encodeIdPart(safe.sourceRdoId),
      encodeIdPart(safe.type),
      encodeIdPart(safe.serviceCode || safe.serviceName),
      encodeIdPart(safe.materialCode || safe.materialName)
    ].join("|");
  }

  function normalizePersistentAlert(analysis, alert, options) {
    const type = clean(alert && (alert.type || alert.status || alert.classification), 120);
    const materialName = clean(alert && (alert.materialName || alert.material || alert.name), 160);
    if (!type && !materialName) return null;

    const material = findMaterialResult(analysis, alert) || {};
    const expectedQuantity = numberOrNull(material.expectedConsumption);
    const actualQuantity = numberOrNull(material.actualStockExit);
    const differenceQuantity = numberOrNull(alert && alert.difference != null ? alert.difference : material.difference);
    const differencePercent = expectedQuantity ? Number(((differenceQuantity || 0) / Math.abs(expectedQuantity) * 100).toFixed(2)) : null;
    const createdAt = nowIso(options);
    const persistent = {
      id: "",
      version: VERSION,
      workId: clean(analysis.workId) || null,
      sourceRdoId: clean(analysis.sourceRdoId) || null,
      sourceRdoUpdatedAt: clean(analysis.sourceRdoUpdatedAt) || null,
      sourceFingerprint: clean(analysis.sourceFingerprint, 2000) || null,
      type: type || null,
      severity: severityForType(type),
      title: titleForAlert(type, materialName),
      summary: summaryForAlert(type, materialName, differenceQuantity, differencePercent),
      recommendation: recommendationForType(type),
      serviceCode: clean(alert && alert.serviceCode) || clean(material.serviceCode) || null,
      serviceName: clean(alert && alert.serviceName) || clean(material.serviceName) || null,
      materialCode: clean(alert && alert.materialCode) || clean(material.materialCode) || null,
      materialName: materialName || clean(material.material || material.name) || null,
      expectedQuantity: expectedQuantity,
      actualQuantity: actualQuantity,
      differenceQuantity: differenceQuantity,
      differencePercent: differencePercent,
      status: "open",
      createdAt: createdAt,
      updatedAt: createdAt,
      resolvedAt: null
    };
    persistent.id = buildExecutionStockAlertId(persistent);
    return persistent;
  }

  function trimExecutionStockAlerts(alerts, max) {
    const limit = max || 500;
    if (alerts.length <= limit) return alerts;
    const removable = alerts
      .map(function (alert, index) { return { alert: alert, index: index }; })
      .filter(function (item) { return item.alert.status === "resolved" || item.alert.status === "obsolete"; })
      .sort(function (a, b) { return String(a.alert.updatedAt || a.alert.createdAt || "").localeCompare(String(b.alert.updatedAt || b.alert.createdAt || "")); });
    const removeCount = Math.min(alerts.length - limit, removable.length);
    const removeIndexes = removable.slice(0, removeCount).map(function (item) { return item.index; });
    return alerts.filter(function (_alert, index) { return removeIndexes.indexOf(index) === -1; });
  }

  function persistExecutionStockAlerts(state, analysis, options) {
    const appState = state && typeof state === "object" ? state : {};
    const safe = analysis && typeof analysis === "object" ? analysis : {};
    appState.executionStockAlerts = Array.isArray(appState.executionStockAlerts) ? appState.executionStockAlerts : [];

    if (safe.version !== VERSION || safe.status !== "ready" || !clean(safe.workId) || !clean(safe.sourceRdoId) || !clean(safe.sourceFingerprint)) {
      return { changed: false, alerts: appState.executionStockAlerts, created: 0, updated: 0, obsoleted: 0, skipped: true };
    }

    const normalized = arrayOf(safe.alerts).map(function (alert) {
      return normalizePersistentAlert(safe, alert, options);
    }).filter(Boolean);

    const now = nowIso(options);
    let changed = false;
    let created = 0;
    let updated = 0;
    let obsoleted = 0;
    const currentKeys = normalized.map(buildOccurrenceKey);

    normalized.forEach(function (next) {
      const key = buildOccurrenceKey(next);
      const existing = appState.executionStockAlerts.find(function (item) {
        return buildOccurrenceKey(item) === key;
      });

      if (!existing) {
        appState.executionStockAlerts.push(next);
        created += 1;
        changed = true;
        return;
      }

      const preservedStatus = existing.status === "acknowledged" || existing.status === "resolved" ? existing.status : "open";
      const preservedResolvedAt = preservedStatus === "resolved" ? existing.resolvedAt || now : null;
      Object.assign(existing, next, {
        status: preservedStatus,
        createdAt: existing.createdAt || next.createdAt,
        updatedAt: now,
        resolvedAt: preservedResolvedAt
      });
      updated += 1;
      changed = true;
    });

    appState.executionStockAlerts.forEach(function (existing) {
      if (existing.workId !== safe.workId || existing.sourceRdoId !== safe.sourceRdoId) return;
      if (currentKeys.indexOf(buildOccurrenceKey(existing)) !== -1) return;
      if (existing.status === "obsolete") return;
      existing.status = "obsolete";
      existing.updatedAt = now;
      existing.resolvedAt = null;
      obsoleted += 1;
      changed = true;
    });

    appState.executionStockAlerts = trimExecutionStockAlerts(appState.executionStockAlerts, options && options.maxAlerts);
    return { changed: changed, alerts: appState.executionStockAlerts, created: created, updated: updated, obsoleted: obsoleted, skipped: false };
  }

  function buildRecord(status, savedRdo, fingerprint, details, options) {
    const safe = details || {};
    return {
      version: VERSION,
      status: status,
      workId: clean(savedRdo && savedRdo.workId) || null,
      sourceRdoId: clean(savedRdo && savedRdo.id) || null,
      sourceRdoUpdatedAt: clean(savedRdo && savedRdo.updatedAt) || null,
      calculatedAt: nowIso(options),
      sourceFingerprint: fingerprint || "",
      summary: safe.summary || null,
      alerts: arrayOf(safe.alerts),
      result: safe.result || null,
      missingInputs: arrayOf(safe.missingInputs)
    };
  }

  function refreshExecutionStockAnalysisAfterRdoSave(state, savedRdo, dependencies) {
    const deps = dependencies || {};
    const appState = state && typeof state === "object" ? state : {};
    const rdo = savedRdo && typeof savedRdo === "object" ? savedRdo : {};
    const workId = clean(rdo.workId);

    if (!workId) {
      appState.executionStockAnalysis = buildRecord("insufficient_data", rdo, "", { missingInputs: ["workId"] }, deps);
      return { changed: true, analysis: appState.executionStockAnalysis, skipped: false };
    }

    if (typeof deps.snapshotBuilder !== "function" || typeof deps.crossBuilder !== "function") {
      appState.executionStockAnalysis = buildRecord("error", rdo, "", { missingInputs: ["analysisModules"] }, deps);
      return { changed: true, analysis: appState.executionStockAnalysis, skipped: false };
    }

    try {
      const snapshot = deps.snapshotBuilder({
        workId: workId,
        appState: appState,
        localStorage: deps.localStorage || null,
        obraReport: { dailyLogs: appState.dailyLogs || [] },
        operationalStock: deps.operationalStock || {}
      }) || {};
      const fingerprint = sourceFingerprint(snapshot, rdo);
      const current = appState.executionStockAnalysis || {};

      if (current.sourceFingerprint === fingerprint && current.workId === workId && current.sourceRdoId === clean(rdo.id)) {
        return { changed: false, analysis: current, skipped: true };
      }

      const missingInputs = missingInputsFrom(snapshot);
      if (missingInputs.length) {
        appState.executionStockAnalysis = buildRecord("insufficient_data", rdo, fingerprint, { missingInputs: missingInputs }, deps);
        return { changed: true, analysis: appState.executionStockAnalysis, skipped: false };
      }

      const cross = deps.crossBuilder(snapshot) || {};
      const result = normalizeResult(cross);
      appState.executionStockAnalysis = buildRecord("ready", rdo, fingerprint, {
        summary: result.summary,
        alerts: result.alerts,
        result: result,
        missingInputs: []
      }, deps);
      return { changed: true, analysis: appState.executionStockAnalysis, skipped: false };
    } catch (error) {
      appState.executionStockAnalysis = buildRecord("error", rdo, "", { missingInputs: [] }, deps);
      return { changed: true, analysis: appState.executionStockAnalysis, skipped: false };
    }
  }

  const api = {
    refreshExecutionStockAnalysisAfterRdoSave: refreshExecutionStockAnalysisAfterRdoSave,
    persistExecutionStockAlerts: persistExecutionStockAlerts,
    buildExecutionStockAlertId: buildExecutionStockAlertId,
    sourceFingerprint: sourceFingerprint
  };

  if (typeof exports !== "undefined") exports.refreshExecutionStockAnalysisAfterRdoSave = refreshExecutionStockAnalysisAfterRdoSave;
  if (typeof exports !== "undefined") exports.persistExecutionStockAlerts = persistExecutionStockAlerts;
  if (typeof exports !== "undefined") exports.buildExecutionStockAlertId = buildExecutionStockAlertId;
  if (typeof exports !== "undefined") exports.sourceFingerprint = sourceFingerprint;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ObraReportExecutionStockAnalysis = api;
})(typeof window !== "undefined" ? window : globalThis);

export const refreshExecutionStockAnalysisAfterRdoSave = globalThis.ObraReportExecutionStockAnalysis.refreshExecutionStockAnalysisAfterRdoSave;
export const persistExecutionStockAlerts = globalThis.ObraReportExecutionStockAnalysis.persistExecutionStockAlerts;
export const buildExecutionStockAlertId = globalThis.ObraReportExecutionStockAnalysis.buildExecutionStockAlertId;
export const sourceFingerprint = globalThis.ObraReportExecutionStockAnalysis.sourceFingerprint;

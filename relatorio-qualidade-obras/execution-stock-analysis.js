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
    sourceFingerprint: sourceFingerprint
  };

  if (typeof exports !== "undefined") exports.refreshExecutionStockAnalysisAfterRdoSave = refreshExecutionStockAnalysisAfterRdoSave;
  if (typeof exports !== "undefined") exports.sourceFingerprint = sourceFingerprint;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ObraReportExecutionStockAnalysis = api;
})(typeof window !== "undefined" ? window : globalThis);

export const refreshExecutionStockAnalysisAfterRdoSave = globalThis.ObraReportExecutionStockAnalysis.refreshExecutionStockAnalysisAfterRdoSave;
export const sourceFingerprint = globalThis.ObraReportExecutionStockAnalysis.sourceFingerprint;

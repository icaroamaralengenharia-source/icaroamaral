(function (root) {
  "use strict";

  const VALID_TYPES = {
    rdo: "RDO",
    execution_stock_report: "Execucao x estoque",
    consumption_alert_report: "Alertas de consumo"
  };

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function uniqueCleanList(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map(clean)
      .filter(Boolean)
      .filter(function (value) {
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
      })
      .sort();
  }

  function hashText(text) {
    let hash = 2166136261;
    const input = clean(text);
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  function getNow(options) {
    if (options && typeof options.now === "function") return options.now();
    if (options && options.now) return clean(options.now);
    return new Date().toISOString();
  }

  function getCollection(state) {
    if (!state || typeof state !== "object") return [];
    if (!Array.isArray(state.operationalDocuments)) state.operationalDocuments = [];
    state.operationalDocuments = state.operationalDocuments.map(normalizeDocument).filter(Boolean);
    return state.operationalDocuments;
  }

  function normalizeDocument(item) {
    if (!item || typeof item !== "object") return null;
    const type = clean(item.type);
    const workId = clean(item.workId);
    const id = clean(item.id);
    if (!id || !VALID_TYPES[type] || !workId) return null;
    return {
      id: id,
      version: Number(item.version) === 1 ? 1 : 1,
      type: type,
      workId: workId,
      clientId: clean(item.clientId),
      title: clean(item.title) || VALID_TYPES[type],
      sourceRdoIds: uniqueCleanList(item.sourceRdoIds),
      sourceAlertIds: uniqueCleanList(item.sourceAlertIds),
      analysisFingerprint: clean(item.analysisFingerprint),
      renderer: clean(item.renderer) || type,
      status: clean(item.status) === "obsolete" ? "obsolete" : "active",
      createdAt: clean(item.createdAt),
      updatedAt: clean(item.updatedAt),
      lastOpenedAt: clean(item.lastOpenedAt)
    };
  }

  function findWork(state, workId) {
    return (Array.isArray(state && state.works) ? state.works : []).find(function (work) {
      return clean(work && work.id) === workId;
    }) || null;
  }

  function findRdo(state, rdoId) {
    return (Array.isArray(state && state.dailyLogs) ? state.dailyLogs : []).find(function (rdo) {
      return clean(rdo && rdo.id) === rdoId;
    }) || null;
  }

  function findAlert(state, alertId) {
    return (Array.isArray(state && state.executionStockAlerts) ? state.executionStockAlerts : []).find(function (alert) {
      return clean(alert && alert.id) === alertId;
    }) || null;
  }

  function validateSources(state, input) {
    const workId = clean(input.workId);
    if (!workId || !VALID_TYPES[clean(input.type)]) return { ok: false, reason: "invalid_document" };
    if (Array.isArray(state && state.works) && state.works.length && !findWork(state, workId)) {
      return { ok: false, reason: "missing_work" };
    }
    const sourceRdoIds = uniqueCleanList(input.sourceRdoIds);
    const sourceAlertIds = uniqueCleanList(input.sourceAlertIds);
    for (let index = 0; index < sourceRdoIds.length; index += 1) {
      const rdo = findRdo(state, sourceRdoIds[index]);
      if (!rdo || clean(rdo.workId) !== workId) return { ok: false, reason: "missing_rdo", sourceId: sourceRdoIds[index] };
    }
    for (let index = 0; index < sourceAlertIds.length; index += 1) {
      const alert = findAlert(state, sourceAlertIds[index]);
      if (!alert || clean(alert.workId) !== workId) return { ok: false, reason: "missing_alert", sourceId: sourceAlertIds[index] };
    }
    return { ok: true, sourceRdoIds: sourceRdoIds, sourceAlertIds: sourceAlertIds };
  }

  function buildDocumentId(input) {
    const type = clean(input.type);
    const workId = clean(input.workId);
    const sourceRdoIds = uniqueCleanList(input.sourceRdoIds).join(",");
    const sourceAlertIds = uniqueCleanList(input.sourceAlertIds).join(",");
    const base = [type, workId, sourceRdoIds, sourceAlertIds].join("|");
    return "opdoc_" + hashText(base);
  }

  function registerOperationalDocument(state, input, options) {
    const safe = input && typeof input === "object" ? input : {};
    const collection = getCollection(state);
    const validation = validateSources(state, safe);
    if (!validation.ok) return validation;
    const now = getNow(options || {});
    const work = findWork(state, clean(safe.workId));
    const documentItem = normalizeDocument({
      id: clean(safe.id) || buildDocumentId(safe),
      version: 1,
      type: clean(safe.type),
      workId: clean(safe.workId),
      clientId: clean(safe.clientId) || clean(work && work.clientId),
      title: clean(safe.title) || VALID_TYPES[clean(safe.type)],
      sourceRdoIds: validation.sourceRdoIds,
      sourceAlertIds: validation.sourceAlertIds,
      analysisFingerprint: clean(safe.analysisFingerprint),
      renderer: clean(safe.renderer) || clean(safe.type),
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: clean(safe.lastOpenedAt)
    });
    if (!documentItem) return { ok: false, reason: "invalid_document" };
    const existingIndex = collection.findIndex(function (item) { return item.id === documentItem.id; });
    if (existingIndex >= 0) {
      documentItem.createdAt = collection[existingIndex].createdAt || documentItem.createdAt;
      documentItem.lastOpenedAt = collection[existingIndex].lastOpenedAt || "";
      collection[existingIndex] = documentItem;
      return { ok: true, created: false, updated: true, document: documentItem };
    }
    collection.unshift(documentItem);
    return { ok: true, created: true, updated: false, document: documentItem };
  }

  function getDocumentsForWork(state, workId, filters) {
    const safeFilters = filters || {};
    return getCollection(state).filter(function (item) {
      if (clean(item.workId) !== clean(workId)) return false;
      if (safeFilters.type && safeFilters.type !== "all" && item.type !== safeFilters.type) return false;
      if (safeFilters.status && safeFilters.status !== "all" && item.status !== safeFilters.status) return false;
      return true;
    }).sort(function (a, b) {
      return clean(b.updatedAt || b.createdAt).localeCompare(clean(a.updatedAt || a.createdAt));
    });
  }

  function markObsolete(state, documentId, options) {
    const collection = getCollection(state);
    const documentItem = collection.find(function (item) { return item.id === clean(documentId); });
    if (!documentItem) return { ok: false, reason: "missing_document" };
    documentItem.status = "obsolete";
    documentItem.updatedAt = getNow(options || {});
    return { ok: true, document: documentItem };
  }

  function openOperationalDocument(state, documentId, renderers, options) {
    const collection = getCollection(state);
    const documentItem = collection.find(function (item) { return item.id === clean(documentId); });
    if (!documentItem) return { ok: false, reason: "missing_document" };
    const validation = validateSources(state, documentItem);
    if (!validation.ok) {
      markObsolete(state, documentItem.id, options);
      return { ok: false, reason: validation.reason, document: documentItem };
    }
    const renderer = renderers && renderers[documentItem.type];
    if (typeof renderer !== "function") return { ok: false, reason: "missing_renderer", document: documentItem };
    const result = renderer(documentItem, state, options || {});
    if (!result || result.ok === false || !clean(result.html)) return Object.assign({ ok: false, reason: "render_failed", document: documentItem }, result || {});
    documentItem.lastOpenedAt = getNow(options || {});
    documentItem.updatedAt = documentItem.updatedAt || documentItem.lastOpenedAt;
    return { ok: true, document: documentItem, html: result.html, title: result.title || documentItem.title };
  }

  const api = {
    collectionName: "operationalDocuments",
    typeLabels: VALID_TYPES,
    normalizeOperationalDocuments: getCollection,
    registerOperationalDocument: registerOperationalDocument,
    openOperationalDocument: openOperationalDocument,
    getDocumentsForWork: getDocumentsForWork,
    markOperationalDocumentObsolete: markObsolete,
    buildOperationalDocumentId: buildDocumentId
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof exports !== "undefined") Object.assign(exports, api);
  root.ObraReportOperationalDocuments = api;
})(typeof window !== "undefined" ? window : globalThis);

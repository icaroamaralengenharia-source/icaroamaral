(function (root) {
  "use strict";

  const VALID_STATUSES = ["open", "acknowledged", "resolved", "obsolete"];
  const VALID_SEVERITIES = ["critical", "high", "medium", "low"];
  const STATUS_RANK = { open: 0, acknowledged: 1, resolved: 2, obsolete: 3 };
  const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

  function clean(value) {
    return String(value || "").trim();
  }

  function normalizeStatus(value) {
    const status = clean(value).toLowerCase();
    return VALID_STATUSES.indexOf(status) >= 0 ? status : "";
  }

  function normalizeSeverity(value) {
    const severity = clean(value).toLowerCase();
    return VALID_SEVERITIES.indexOf(severity) >= 0 ? severity : "low";
  }

  function getDailyLogs(state) {
    return Array.isArray(state && state.dailyLogs) ? state.dailyLogs : [];
  }

  function findSourceRdo(state, alert) {
    const sourceRdoId = clean(alert && alert.sourceRdoId);
    if (!sourceRdoId) return null;
    return getDailyLogs(state).find(function (logItem) {
      return clean(logItem && logItem.id) === sourceRdoId;
    }) || null;
  }

  function isValidAlertForWork(state, alert, workId) {
    const safe = alert && typeof alert === "object" ? alert : {};
    const sourceRdo = findSourceRdo(state, safe);
    return Number(safe.version) === 1 &&
      Boolean(clean(safe.id)) &&
      clean(safe.workId) === clean(workId) &&
      Boolean(clean(safe.sourceRdoId)) &&
      Boolean(clean(safe.type)) &&
      Boolean(clean(safe.title)) &&
      Boolean(normalizeStatus(safe.status)) &&
      sourceRdo &&
      clean(sourceRdo.workId) === clean(workId);
  }

  function compareAlerts(a, b) {
    const statusDiff = STATUS_RANK[normalizeStatus(a && a.status)] - STATUS_RANK[normalizeStatus(b && b.status)];
    if (statusDiff) return statusDiff;
    const severityDiff = SEVERITY_RANK[normalizeSeverity(a && a.severity)] - SEVERITY_RANK[normalizeSeverity(b && b.severity)];
    if (severityDiff) return severityDiff;
    return clean(b && (b.updatedAt || b.createdAt)).localeCompare(clean(a && (a.updatedAt || a.createdAt)));
  }

  function getAlertsForWork(state, workId) {
    const alerts = Array.isArray(state && state.executionStockAlerts) ? state.executionStockAlerts : [];
    const seen = new Set();
    return alerts.filter(function (alert) {
      const id = clean(alert && alert.id);
      if (!id || seen.has(id) || !isValidAlertForWork(state, alert, workId)) return false;
      seen.add(id);
      return true;
    }).slice().sort(compareAlerts);
  }

  function filterAlerts(alerts, filters) {
    const settings = filters || {};
    const status = normalizeStatus(settings.status) || "all";
    const severity = normalizeSeverity(settings.severity);
    const hasSeverityFilter = VALID_SEVERITIES.indexOf(clean(settings.severity).toLowerCase()) >= 0;
    return (Array.isArray(alerts) ? alerts : []).filter(function (alert) {
      if (status !== "all" && normalizeStatus(alert && alert.status) !== status) return false;
      if (hasSeverityFilter && normalizeSeverity(alert && alert.severity) !== severity) return false;
      return true;
    });
  }

  function updateAlertStatus(state, alertId, nextStatus, options) {
    const settings = options || {};
    const status = normalizeStatus(nextStatus);
    if (status !== "open" && status !== "acknowledged" && status !== "resolved") return { ok: false, reason: "invalid_status" };
    const alerts = Array.isArray(state && state.executionStockAlerts) ? state.executionStockAlerts : [];
    const alert = alerts.find(function (item) { return clean(item && item.id) === clean(alertId); });
    if (!alert) return { ok: false, reason: "not_found" };
    if (settings.workId && clean(alert.workId) !== clean(settings.workId)) return { ok: false, reason: "work_mismatch" };
    const currentStatus = normalizeStatus(alert.status);
    if (currentStatus === "obsolete") return { ok: false, reason: "obsolete_locked" };
    if (status === "open" && currentStatus !== "resolved") return { ok: false, reason: "reopen_requires_resolved" };
    const now = clean(settings.now) || new Date().toISOString();
    alert.status = status;
    alert.updatedAt = now;
    if (status === "resolved") {
      alert.resolvedAt = now;
    } else {
      alert.resolvedAt = null;
    }
    return { ok: true, alert: alert };
  }

  const api = {
    getAlertsForWork: getAlertsForWork,
    filterAlerts: filterAlerts,
    updateAlertStatus: updateAlertStatus,
    normalizeStatus: normalizeStatus,
    normalizeSeverity: normalizeSeverity,
    compareAlerts: compareAlerts
  };

  root.ObraReportExecutionStockAlertHistory = api;
  if (root.dispatchEvent && root.CustomEvent) {
    root.dispatchEvent(new root.CustomEvent("obrareport:execution-stock-alert-history-ready"));
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

export const getAlertsForWork = globalThis.ObraReportExecutionStockAlertHistory.getAlertsForWork;
export const filterAlerts = globalThis.ObraReportExecutionStockAlertHistory.filterAlerts;
export const updateAlertStatus = globalThis.ObraReportExecutionStockAlertHistory.updateAlertStatus;
export const normalizeStatus = globalThis.ObraReportExecutionStockAlertHistory.normalizeStatus;
export const normalizeSeverity = globalThis.ObraReportExecutionStockAlertHistory.normalizeSeverity;
export const compareAlerts = globalThis.ObraReportExecutionStockAlertHistory.compareAlerts;

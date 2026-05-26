(function () {
  "use strict";

  function canUse(limit, current) {
    return limit === null || current < limit;
  }

  function currentMonthKey(date) {
    const value = date ? new Date(date) : new Date();
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return year + "-" + month;
  }

  function isSameMonth(date, monthKey) {
    if (!date) {
      return false;
    }

    return currentMonthKey(date) === monthKey;
  }

  function countMonthlyReports(state, userId, monthKey) {
    return (state.reports || []).filter(function (report) {
      return report.userId === userId && isSameMonth(report.createdAt || report.updatedAt, monthKey);
    }).length;
  }

  function countAiCalls(state, userId, monthKey) {
    const events = state.billing && Array.isArray(state.billing.usageEvents) ? state.billing.usageEvents : [];

    return events.filter(function (event) {
      return event.userId === userId && event.type === "ai" && isSameMonth(event.createdAt, monthKey);
    }).length;
  }

  function getUsage(state, userId) {
    const monthKey = currentMonthKey();

    return {
      monthKey: monthKey,
      clients: (state.clients || []).filter(function (client) {
        return client.userId === userId;
      }).length,
      works: (state.works || []).filter(function (work) {
        return work.userId === userId;
      }).length,
      reportsThisMonth: countMonthlyReports(state, userId, monthKey),
      aiCallsThisMonth: countAiCalls(state, userId, monthKey)
    };
  }

  function checkLimit(plan, usage, type) {
    const limits = plan.limits || {};
    const map = {
      clients: ["clients", "clientes"],
      works: ["works", "obras"],
      reports: ["reportsPerMonth", "relatórios mensais"],
      ai: ["aiCallsPerMonth", "usos de IA"]
    };
    const config = map[type];
    const limitKey = config && config[0];
    const label = config && config[1];
    const currentKey = type === "reports" ? "reportsThisMonth" : type === "ai" ? "aiCallsThisMonth" : type;
    const limit = limits[limitKey];
    const current = usage[currentKey] || 0;

    if (canUse(limit, current)) {
      return {
        ok: true,
        remaining: limit === null ? null : Math.max(0, limit - current)
      };
    }

    return {
      ok: false,
      message: "Você atingiu o limite do plano " + plan.name.toLowerCase() + " para " + label + ". Faça upgrade para continuar.",
      limit: limit,
      current: current
    };
  }

  function checkPhotoLimit(plan, currentPhotos, isReplacing) {
    const limit = plan.limits && plan.limits.photosPerReport;

    if (isReplacing || canUse(limit, currentPhotos)) {
      return {
        ok: true,
        remaining: limit === null ? null : Math.max(0, limit - currentPhotos)
      };
    }

    return {
      ok: false,
      message: "Você atingiu o limite de fotos por relatório do plano " + plan.name.toLowerCase() + ". Faça upgrade para continuar.",
      limit: limit,
      current: currentPhotos
    };
  }

  window.ObraReportUsageLimits = {
    currentMonthKey: currentMonthKey,
    getUsage: getUsage,
    checkLimit: checkLimit,
    checkPhotoLimit: checkPhotoLimit
  };
})();

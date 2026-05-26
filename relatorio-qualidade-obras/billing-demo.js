(function () {
  "use strict";

  function isDemoEnabled() {
    return ["localhost", "127.0.0.1", ""].indexOf(window.location.hostname) >= 0;
  }

  function ensureBillingState(state, defaultPlanId) {
    state.billing = state.billing || {};
    state.billing.planId = state.billing.planId || defaultPlanId || "gratuito";
    state.billing.updatedAt = state.billing.updatedAt || new Date().toISOString();
    state.billing.usageEvents = Array.isArray(state.billing.usageEvents) ? state.billing.usageEvents : [];
    return state.billing;
  }

  function getCurrentPlanId(state, defaultPlanId) {
    return ensureBillingState(state, defaultPlanId).planId;
  }

  function setPlan(state, planId, defaultPlanId) {
    const billing = ensureBillingState(state, defaultPlanId);
    billing.planId = planId || defaultPlanId || "gratuito";
    billing.demoMode = true;
    billing.updatedAt = new Date().toISOString();
    return billing;
  }

  function registerUsage(state, type, userId, meta) {
    const billing = ensureBillingState(state, "gratuito");
    billing.usageEvents.push({
      id: "use_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
      type: type,
      userId: userId || "",
      meta: meta || {},
      createdAt: new Date().toISOString()
    });
    billing.updatedAt = new Date().toISOString();
  }

  window.ObraReportBillingDemo = {
    isDemoEnabled: isDemoEnabled,
    ensureBillingState: ensureBillingState,
    getCurrentPlanId: getCurrentPlanId,
    setPlan: setPlan,
    registerUsage: registerUsage
  };
})();

(function (window) {
  "use strict";

  var DEFAULT_BACKEND_BASE_URL = "https://obrareport-backend.onrender.com";
  // This transport exists only on the hosted PR #233 preview. Other surfaces keep their configured backend.
  var PR233_PREVIEW_ORIGIN = "https://deploy-preview-233--icaroamaral.netlify.app";
  if (window.location && window.location.origin === PR233_PREVIEW_ORIGIN) {
    window.ELO_API_BASE_URL = PR233_PREVIEW_ORIGIN + "/__pr233_live_qa";
    window.OBRAREPORT_API_BASE_URL = window.ELO_API_BASE_URL;
  }

  function clean(value) {
    return String(value || "").trim().replace(/\/+$/g, "");
  }

  function getBackendBaseUrl() {
    return clean(window.ELO_API_BASE_URL || window.OBRAREPORT_API_BASE_URL || DEFAULT_BACKEND_BASE_URL);
  }

  function apiUrl(path) {
    var value = String(path || "");
    if (/^https?:\/\//i.test(value)) return value;
    return getBackendBaseUrl() + "/" + value.replace(/^\/+/, "");
  }

  window.EloRuntimeConfig = window.EloRuntimeConfig || {};
  window.EloRuntimeConfig.getBackendBaseUrl = getBackendBaseUrl;
  window.EloRuntimeConfig.apiUrl = apiUrl;
})(window);

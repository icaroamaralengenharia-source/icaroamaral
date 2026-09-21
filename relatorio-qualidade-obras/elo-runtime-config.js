(function (window) {
  "use strict";

  var DEFAULT_BACKEND_BASE_URL = "https://obrareport-backend.onrender.com";

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

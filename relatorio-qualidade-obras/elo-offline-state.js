(function attachEloOfflineState(global) {
  "use strict";

  const STATES = Object.freeze({
    ONLINE: "ONLINE",
    DEGRADED_BACKEND: "DEGRADED_BACKEND",
    AUTH_REQUIRED: "AUTH_REQUIRED",
    REMOTE_CAPABILITY_UNAVAILABLE: "REMOTE_CAPABILITY_UNAVAILABLE",
    OFFLINE: "OFFLINE",
    LOCAL_ONLY: "LOCAL_ONLY"
  });

  const LEGACY_TO_STATE = Object.freeze({
    BROWSER_OFFLINE: STATES.OFFLINE,
    BACKEND_UNAVAILABLE: STATES.DEGRADED_BACKEND,
    AUTH_INVALID: STATES.AUTH_REQUIRED,
    ONLINE_VALIDATED: STATES.ONLINE,
    ONLINE_UNVERIFIED: STATES.ONLINE
  });

  function normalizeState(value) {
    const raw = String(value || "").trim().toUpperCase();
    return LEGACY_TO_STATE[raw] || (Object.values(STATES).indexOf(raw) >= 0 ? raw : "");
  }

  function isTransportFailure(error) {
    if (!error) return false;
    const name = String(error.name || "").toLowerCase();
    const message = String(error.message || error || "").toLowerCase();
    return ["typeerror", "networkerror", "aborterror", "timeout", "dns", "connect", "transport"].some(function (term) {
      return name.indexOf(term) >= 0 || message.indexOf(term) >= 0;
    });
  }

  function resolveConnectivityState(input) {
    const value = input || {};
    if (value.localOnly === true || value.explicitLocalOnly === true) return STATES.LOCAL_ONLY;

    const explicit = normalizeState(value.state || value.backendState || value.connectivity);
    if (explicit) return explicit;

    const status = Number(value.status || value.backendStatus || value.remoteStatus || 0);
    const browserOffline = value.navigator && value.navigator.onLine === false;
    if (browserOffline || value.transportAvailable === false || isTransportFailure(value.error)) return STATES.OFFLINE;
    if (status === 401 || status === 403 || value.authValid === false || value.authRequired === true) return STATES.AUTH_REQUIRED;
    if (status === 404 || value.remoteCapabilityAvailable === false || value.remoteCapabilityUnavailable === true) return STATES.REMOTE_CAPABILITY_UNAVAILABLE;
    if (status === 408 || status === 429 || status >= 500 || value.backendReachable === false) return STATES.DEGRADED_BACKEND;
    if (value.backendReachable === true || value.backendValidated === true || (status >= 200 && status < 400)) return STATES.ONLINE;
    return value.networkAvailable === false ? STATES.OFFLINE : STATES.ONLINE;
  }

  function classifyBackendResult(result) {
    const value = result || {};
    const status = Number(value.status || 0);
    if (value.error || status === 0 || status === 500 || status === 502 || status === 503 || status === 504) return "BACKEND_UNAVAILABLE";
    if (status === 400 || status === 401 || status === 403 || status === 404 || (status >= 200 && status < 500)) return "ONLINE_VALIDATED";
    return "ONLINE_UNVERIFIED";
  }

  function classifyConnectivityResult(result) {
    const value = result || {};
    return resolveConnectivityState({
      status: value.status,
      error: value.error,
      navigator: value.navigator,
      authRequired: value.status === 401 || value.status === 403,
      remoteCapabilityUnavailable: value.status === 404
    });
  }

  function messageForState(state) {
    switch (normalizeState(state)) {
      case STATES.DEGRADED_BACKEND: return "O serviço online do ELO está indisponível no momento.";
      case STATES.AUTH_REQUIRED: return "Sua sessão precisa ser renovada.";
      case STATES.REMOTE_CAPABILITY_UNAVAILABLE: return "Esse recurso online está indisponível no momento.";
      case STATES.OFFLINE: return "Estou sem acesso à rede, mas posso continuar com recursos locais.";
      case STATES.LOCAL_ONLY: return "Estou usando somente recursos locais do ELO.";
      default: return "Estou online.";
    }
  }

  global.EloOfflineState = {
    STATES,
    LEGACY_TO_STATE,
    normalizeState,
    resolveConnectivityState,
    classifyBackendResult,
    classifyConnectivityResult,
    messageForState
  };
})(typeof window !== "undefined" ? window : globalThis);

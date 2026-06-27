(function (window) {
  "use strict";

  const STOCK_FULL_STORAGE_KEY = "obraReportAlmoxarifadoData";
  const STOCK_FULL_SESSION_STORAGE_KEY = "stockFullSession";
  const STOCK_FULL_DEVICE_STORAGE_KEY = "stockFullDeviceId";
  const STOCK_FULL_PRODUCTION_API_BASE_URL = "https://obrareport-backend.onrender.com/api/stock-full";
  const STOCK_FULL_ROLE_PERMISSIONS = {
    admin: ["dashboard:view", "products:view", "products:create", "products:update", "products:delete", "products:import", "movements:in", "movements:out", "history:view", "reports:view", "reports:audit", "backup:export", "settings:view", "users:manage"],
    gestor: ["dashboard:view", "products:view", "products:create", "products:update", "products:delete", "products:import", "movements:in", "movements:out", "history:view", "reports:view", "reports:audit", "backup:export", "settings:view", "users:manage"],
    patrao: ["dashboard:view", "products:view", "products:create", "products:update", "products:delete", "products:import", "movements:in", "movements:out", "history:view", "reports:view", "reports:audit", "backup:export", "settings:view", "users:manage"],
    funcionario: ["products:view", "movements:in", "movements:out", "history:view", "reports:view"],
    operador: ["products:view", "movements:in", "movements:out", "history:view", "reports:view"],
    estoquista: ["products:view", "movements:in", "movements:out", "history:view", "reports:view"],
    vendedor: ["products:view", "movements:out", "history:view", "reports:view"],
    leitura: ["products:view", "history:view", "reports:view"]
  };

  function clean(value) {
    return String(value || "").trim();
  }

  function parseNumber(value) {
    let normalized = String(value || "0").replace(/[^\d,.-]/g, "").trim();
    if (normalized.indexOf(",") >= 0) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      const dotParts = normalized.split(".");
      if (dotParts.length > 2) {
        normalized = dotParts.slice(0, -1).join("") + "." + dotParts[dotParts.length - 1];
      }
    }
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function roundQuantity(value) {
    return Math.round(Number(value || 0) * 1000) / 1000;
  }

  function createId(prefix) {
    return clean(prefix || "sf") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeRole(role) {
    const value = clean(role).toLowerCase();
    if (value === "owner" || value === "admin" || value === "gestor" || value === "patrao") return "admin";
    if (value === "employee" || value === "operador" || value === "funcionario") return "funcionario";
    return value || "funcionario";
  }

  function getLocalStorage() {
    try {
      return window.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function readJson(key, fallback) {
    const storage = getLocalStorage();
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    const storage = getLocalStorage();
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  }

  function getCurrentUrlParams() {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch (error) {
      return new URLSearchParams("");
    }
  }

  function isStockFullContext() {
    if (clean(getCurrentUrlParams().get("produto")).toLowerCase() === "stock-full") return true;
    if (window.document && window.document.body && window.document.body.dataset && window.document.body.dataset.stockFullApp === "true") return true;
    return /(^|\/)(stock-full-app|stockfull)\.html$/i.test(clean(window.location && window.location.pathname));
  }

  function normalizeLocation(locationLike) {
    const source = locationLike || window.location || {};
    return {
      href: clean(source.href) || clean(source.toString && source.toString()) || "",
      protocol: clean(source.protocol),
      hostname: clean(source.hostname).toLowerCase(),
      origin: clean(source.origin)
    };
  }

  function isLocalDevLocation(locationLike) {
    const location = normalizeLocation(locationLike);
    return location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "::1";
  }

  function isPublishedProductionLocation(locationLike) {
    const location = normalizeLocation(locationLike);
    return Boolean(location.hostname && !isLocalDevLocation(location));
  }

  function trimApiBase(value) {
    return clean(value).replace(/\/+$/g, "");
  }

  function getStockFullApiBaseUrl(locationLike) {
    const explicit = trimApiBase(window.STOCK_FULL_API_BASE_URL);
    if (explicit) return explicit;
    return isLocalDevLocation(locationLike) ? "/api/stock-full" : STOCK_FULL_PRODUCTION_API_BASE_URL;
  }

  function buildStockFullApiUrl(path, locationLike) {
    const suffix = clean(path);
    if (/^https?:\/\//i.test(suffix)) return suffix;
    const base = getStockFullApiBaseUrl(locationLike);
    const cleanSuffix = suffix.replace(/^\/?api\/stock-full\/?/i, "").replace(/^\/+/, "");
    return cleanSuffix ? base + "/" + cleanSuffix : base;
  }

  function getProfile() {
    return clean(getCurrentUrlParams().get("perfil")).toLowerCase() === "gestor" ? "gestor" : "loja";
  }

  function getSession() {
    const session = readJson(STOCK_FULL_SESSION_STORAGE_KEY, {});
    return session && typeof session === "object" ? session : {};
  }

  function setSession(session) {
    return writeJson(STOCK_FULL_SESSION_STORAGE_KEY, session || {});
  }

  function getDeviceId() {
    const storage = getLocalStorage();
    if (!storage) return "device_memory";
    const existing = clean(storage.getItem(STOCK_FULL_DEVICE_STORAGE_KEY));
    if (existing) return existing;
    const next = createId("device");
    storage.setItem(STOCK_FULL_DEVICE_STORAGE_KEY, next);
    return next;
  }

  function canStockFull(action, roleOrSession) {
    const role = normalizeRole(typeof roleOrSession === "string" ? roleOrSession : (roleOrSession && roleOrSession.role) || getSession().role);
    const permissions = STOCK_FULL_ROLE_PERMISSIONS[role] || STOCK_FULL_ROLE_PERMISSIONS.funcionario;
    return permissions.indexOf(clean(action)) >= 0;
  }

  window.StockFullCore = {
    storageKey: STOCK_FULL_STORAGE_KEY,
    sessionStorageKey: STOCK_FULL_SESSION_STORAGE_KEY,
    clean,
    parseNumber,
    roundQuantity,
    createId,
    normalizeRole,
    getLocalStorage,
    readJson,
    writeJson,
    getCurrentUrlParams,
    isStockFullContext,
    isLocalDevLocation,
    isPublishedProductionLocation,
    getStockFullApiBaseUrl,
    buildStockFullApiUrl,
    getProfile,
    getSession,
    setSession,
    getDeviceId,
    canStockFull,
    rolePermissions: STOCK_FULL_ROLE_PERMISSIONS
  };
})(window);

(function (window) {
  "use strict";

  const STOCK_FULL_STORAGE_KEY = "obraReportAlmoxarifadoData";
  const STOCK_FULL_SESSION_STORAGE_KEY = "stockFullSession";

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

  window.StockFullCore = {
    storageKey: STOCK_FULL_STORAGE_KEY,
    sessionStorageKey: STOCK_FULL_SESSION_STORAGE_KEY,
    clean,
    parseNumber,
    roundQuantity,
    createId,
    getLocalStorage,
    readJson,
    writeJson,
    getCurrentUrlParams,
    isStockFullContext,
    getProfile,
    getSession,
    setSession
  };
})(window);

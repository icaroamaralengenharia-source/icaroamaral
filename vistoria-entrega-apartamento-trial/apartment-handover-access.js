(function () {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const state = { access: null, mounted: false, checking: false };

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function json(value) {
    try { return JSON.parse(value || "null"); } catch (_) { return null; }
  }

  function readStorage(storage, key) {
    try { return storage && storage.getItem(key); } catch (_) { return ""; }
  }

  function tokenIn(value, depth) {
    if (!value || depth > 5) return "";
    if (typeof value === "string") {
      const clean = text(value);
      if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(clean)) return clean;
      return tokenIn(json(clean), depth + 1);
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = tokenIn(item, depth + 1);
        if (found) return found;
      }
      return "";
    }
    if (typeof value === "object") {
      if (typeof value.access_token === "string") return text(value.access_token);
      return tokenIn(value.session, depth + 1) || tokenIn(value.currentSession, depth + 1);
    }
    return "";
  }

  function findAccessToken() {
    const direct = text(root.APARTMENT_HANDOVER_AUTH_TOKEN || root.ELO_AUTH_TOKEN || root.OBRAREPORT_AUTH_TOKEN);
    if (direct) return direct;
    for (const storage of [root.localStorage, root.sessionStorage].filter(Boolean)) {
      let keys = [];
      try {
        for (let index = 0; index < storage.length; index += 1) keys.push(storage.key(index));
      } catch (_) {}
      for (const key of keys) {
        if (/auth|supabase|sb-/i.test(key || "")) {
          const found = tokenIn(readStorage(storage, key), 0);
          if (found) return found;
        }
      }
    }
    return "";
  }

  function apiBaseUrl() {
    return text(root.OBRAREPORT_API_BASE_URL || root.API_BASE_URL || "").replace(/\/+$/g, "");
  }

  function limitText(access) {
    const used = Number(access && access.trial_used) || 0;
    const limit = Number(access && access.trial_limit) || 0;
    const remaining = Math.max(0, Number(access && access.remaining) || Math.max(0, limit - used));
    if (access && access.status === "active") return "Acesso ativo. Vistorias ilimitadas liberadas.";
    if (access && access.status === "trial_exhausted") return "Teste concluído. " + used + " de " + limit + " vistorias utilizadas.";
    return "Teste gratuito. " + used + " de " + limit + " vistorias utilizadas. Você ainda possui " + remaining + " vistoria" + (remaining === 1 ? "" : "s") + " de teste.";
  }

  function ensureNodes() {
    if (state.mounted) return;
    state.mounted = true;
    const banner = document.createElement("div");
    banner.setAttribute("data-trial-banner", "");
    banner.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:40;background:#12312b;color:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.22);font:500 13px system-ui;max-width:300px";
    banner.hidden = true;
    document.body.appendChild(banner);

    const overlay = document.createElement("div");
    overlay.setAttribute("data-trial-overlay", "");
    overlay.style.cssText = "position:fixed;inset:0;z-index:80;background:rgba(11,18,32,.82);display:none;align-items:center;justify-content:center;padding:24px";
    overlay.innerHTML = '<section style="max-width:460px;background:#fff;color:#172033;padding:24px;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:system-ui"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a3ffc">Vistoria de Entrega</p><h1 data-trial-overlay-title style="margin:0 0 12px;font-size:24px;line-height:1.15">ACESSO INDISPONÍVEL</h1><p data-trial-overlay-message style="margin:0 0 18px;line-height:1.45">Sua empresa ainda não possui autorização para este módulo.</p><a href="mailto:contato@icaroamaral.com.br?subject=Ativar%20Vistoria%20de%20Entrega" style="display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;background:#12312b;color:#fff;text-decoration:none;border-radius:6px;font-weight:700">ENTRAR EM CONTATO</a></section>';
    document.body.appendChild(overlay);
  }

  function emitAccessChanged(access) {
    try { root.dispatchEvent(new CustomEvent("apartment-handover-access-changed", { detail: Object.assign({}, access || {}) })); } catch (_) {}
  }

  function render(access) {
    ensureNodes();
    const banner = document.querySelector("[data-trial-banner]");
    const overlay = document.querySelector("[data-trial-overlay]");
    const overlayTitle = document.querySelector("[data-trial-overlay-title]");
    const overlayMessage = document.querySelector("[data-trial-overlay-message]");
    if (banner) banner.hidden = true;
    if (overlay) overlay.style.display = "none";
    if (!access) return;
    if (access.allowed) {
      if (banner) {
        banner.textContent = limitText(access);
        banner.hidden = false;
      }
      return;
    }
    if (overlayTitle) overlayTitle.textContent = access.code === "MODULE_BLOCKED" ? "ACESSO BLOQUEADO" : "ACESSO INDISPONÍVEL";
    if (overlayMessage) {
      overlayMessage.textContent = access.code === "NO_ENTITLEMENT"
        ? "Sua empresa ainda não possui autorização para iniciar este módulo. Entre em contato para ativar o acesso."
        : "Este módulo está bloqueado para a sua empresa. Entre em contato para regularizar o acesso.";
    }
    if (overlay) overlay.style.display = "flex";
  }

  async function checkAccess() {
    if (state.checking) return state.access;
    state.checking = true;
    try {
      const token = findAccessToken();
      if (!token) {
        state.access = { allowed: false, status: "missing_session", code: "AUTHENTICATION_REQUIRED", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
        render(state.access);
        emitAccessChanged(state.access);
        return state.access;
      }
      const response = await fetch(apiBaseUrl() + "/api/apartment-handover/access", {
        method: "GET",
        headers: { Authorization: "Bearer " + token }
      });
      const body = await response.json().catch(function () { return {}; });
      state.access = Object.assign({ allowed: response.ok && body.allowed === true }, body);
      render(state.access);
      emitAccessChanged(state.access);
      return state.access;
    } finally {
      state.checking = false;
    }
  }

  async function ensureAllowed() {
    const access = await checkAccess();
    return Boolean(access && access.allowed);
  }

  function authenticatedHeaders(headers) {
    const token = findAccessToken();
    return Object.assign({}, headers || {}, token ? { Authorization: "Bearer " + token } : {});
  }

  root.ApartmentHandoverAccess = { checkAccess, ensureAllowed, authenticatedHeaders, findAccessToken, getState: function () { return Object.assign({}, state.access || {}); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkAccess);
  else checkAccess();
})();
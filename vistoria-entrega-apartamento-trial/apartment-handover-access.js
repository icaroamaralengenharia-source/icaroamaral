(function () {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const AUTH_STORAGE_KEY = "obrareport-apartment-handover-auth-v1";
  const LEGACY_TOKEN_KEY = "sb-trial-auth-token";
  const INVITE_SESSION_KEY = "obrareport-apartment-handover-invite-session-v1";
  const state = { access: null, mounted: false, checking: false, loginBusy: false, inviteRedeeming: false };

  function text(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function json(value) {
    try { return JSON.parse(value || "null"); } catch (_) { return null; }
  }

  function readStorage(storage, key) {
    try { return storage && storage.getItem(key); } catch (_) { return ""; }
  }

  function writeStorage(storage, key, value) {
    try { if (storage) storage.setItem(key, value); } catch (_) {}
  }

  function removeStorage(storage, key) {
    try { if (storage) storage.removeItem(key); } catch (_) {}
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
    const stored = tokenIn(readStorage(root.localStorage, AUTH_STORAGE_KEY), 0) || tokenIn(readStorage(root.sessionStorage, AUTH_STORAGE_KEY), 0);
    if (stored) return stored;
    const legacy = tokenIn(readStorage(root.localStorage, LEGACY_TOKEN_KEY), 0) || tokenIn(readStorage(root.sessionStorage, LEGACY_TOKEN_KEY), 0);
    if (legacy) return legacy;
    return text(root.APARTMENT_HANDOVER_AUTH_TOKEN);
  }

  function findInviteSession() {
    const stored = json(readStorage(root.sessionStorage, INVITE_SESSION_KEY)) || json(readStorage(root.localStorage, INVITE_SESSION_KEY));
    return text(stored && stored.invite_session);
  }

  function persistInviteSession(body) {
    const session = text(body && body.invite_session);
    if (!session) return false;
    writeStorage(root.sessionStorage, INVITE_SESSION_KEY, JSON.stringify({
      invite_session: session,
      expires_at: body.invite_session_expires_at || null,
      savedAt: Date.now()
    }));
    return true;
  }

  function removeRawInviteFromUrl() {
    try {
      const url = new URL(root.location.href);
      if (!url.searchParams.has("invite")) return;
      url.searchParams.delete("invite");
      root.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (_) {}
  }

  function inviteTokenFromUrl() {
    try { return text(new URL(root.location.href).searchParams.get("invite")); } catch (_) { return ""; }
  }

  function apiBaseUrl() {
    return text(root.OBRAREPORT_API_BASE_URL || root.API_BASE_URL || "https://obrareport-backend.onrender.com").replace(/\/+$/g, "");
  }

  function isAuthenticationRequired(access) {
    const code = text(access && access.code).toLowerCase();
    const status = text(access && access.status).toLowerCase();
    return code === "authentication_required" || status === "missing_session" || status === "authentication_required" || status === "invalid_session";
  }

  function persistSession(session) {
    const safe = session && typeof session === "object" ? session : {};
    const accessToken = text(safe.access_token);
    if (!accessToken) return false;
    writeStorage(root.localStorage, AUTH_STORAGE_KEY, JSON.stringify({
      currentSession: {
        access_token: accessToken,
        refresh_token: text(safe.refresh_token),
        expires_at: safe.expires_at || null,
        token_type: text(safe.token_type) || "bearer"
      },
      savedAt: Date.now()
    }));
    return true;
  }

  function clearSession() {
    removeStorage(root.localStorage, AUTH_STORAGE_KEY);
    removeStorage(root.sessionStorage, AUTH_STORAGE_KEY);
    removeStorage(root.localStorage, LEGACY_TOKEN_KEY);
    removeStorage(root.sessionStorage, LEGACY_TOKEN_KEY);
    removeStorage(root.localStorage, INVITE_SESSION_KEY);
    removeStorage(root.sessionStorage, INVITE_SESSION_KEY);
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

    const loginOverlay = document.createElement("div");
    loginOverlay.setAttribute("data-trial-login-overlay", "");
    loginOverlay.style.cssText = "position:fixed;inset:0;z-index:90;background:rgba(11,18,32,.82);display:none;align-items:center;justify-content:center;padding:24px";
    loginOverlay.innerHTML = '<form data-trial-login-form style="width:min(100%,420px);background:#fff;color:#172033;padding:24px;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:system-ui;display:grid;gap:14px"><header style="display:grid;gap:6px"><p style="margin:0;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#65716d">Vistoria de Entrega</p><h1 style="margin:0;font-size:24px;line-height:1.15">Acesse sua conta</h1></header><label style="display:grid;gap:6px;color:#65716d;font-size:13px;font-weight:800">E-mail<input data-trial-login-email type="email" autocomplete="email" required style="min-height:44px;border:1px solid #d7dfda;border-radius:6px;padding:10px;color:#17221f"></label><label style="display:grid;gap:6px;color:#65716d;font-size:13px;font-weight:800">Senha<input data-trial-login-password type="password" autocomplete="current-password" required style="min-height:44px;border:1px solid #d7dfda;border-radius:6px;padding:10px;color:#17221f"></label><p data-trial-login-error style="margin:0;min-height:20px;color:#b42318;font-size:13px;font-weight:800"></p><button data-trial-login-submit type="submit" style="min-height:44px;border:1px solid #1f6f5b;border-radius:6px;background:#1f6f5b;color:#fff;font-weight:800;cursor:pointer">ENTRAR</button></form>';
    document.body.appendChild(loginOverlay);

    const errorOverlay = document.createElement("div");
    errorOverlay.setAttribute("data-trial-error-overlay", "");
    errorOverlay.style.cssText = "position:fixed;inset:0;z-index:85;background:rgba(11,18,32,.82);display:none;align-items:center;justify-content:center;padding:24px";
    errorOverlay.innerHTML = '<section style="max-width:460px;background:#fff;color:#172033;padding:24px;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.28);font-family:system-ui"><p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#65716d">Vistoria de Entrega</p><h1 style="margin:0 0 12px;font-size:24px;line-height:1.15">Não foi possível verificar seu acesso.</h1><p style="margin:0 0 18px;line-height:1.45">Tente novamente.</p><button data-trial-retry-access type="button" style="display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 14px;border:1px solid #1f6f5b;background:#1f6f5b;color:#fff;border-radius:6px;font-weight:800;cursor:pointer">TENTAR NOVAMENTE</button></section>';
    document.body.appendChild(errorOverlay);

    const logout = document.createElement("button");
    logout.setAttribute("data-trial-logout", "");
    logout.type = "button";
    logout.textContent = "SAIR";
    logout.style.cssText = "position:fixed;right:16px;bottom:70px;z-index:41;min-height:34px;border:1px solid #d7dfda;border-radius:6px;background:#fff;color:#17221f;font:800 12px system-ui;padding:7px 9px;cursor:pointer;display:none";
    document.body.appendChild(logout);

    const loginForm = loginOverlay.querySelector("[data-trial-login-form]");
    const retryAccess = errorOverlay.querySelector("[data-trial-retry-access]");
    if (loginForm) loginForm.addEventListener("submit", login);
    if (retryAccess) retryAccess.addEventListener("click", function () { checkAccess({ force: true }); });
    logout.addEventListener("click", logoutUser);
  }

  function emitAccessChanged(access) {
    try { root.dispatchEvent(new CustomEvent("apartment-handover-access-changed", { detail: Object.assign({}, access || {}) })); } catch (_) {}
  }

  function render(access) {
    ensureNodes();
    const banner = document.querySelector("[data-trial-banner]");
    const overlay = document.querySelector("[data-trial-overlay]");
    const loginOverlay = document.querySelector("[data-trial-login-overlay]");
    const errorOverlay = document.querySelector("[data-trial-error-overlay]");
    const logout = document.querySelector("[data-trial-logout]");
    const overlayTitle = document.querySelector("[data-trial-overlay-title]");
    const overlayMessage = document.querySelector("[data-trial-overlay-message]");
    if (banner) banner.hidden = true;
    if (overlay) overlay.style.display = "none";
    if (loginOverlay) loginOverlay.style.display = "none";
    if (errorOverlay) errorOverlay.style.display = "none";
    if (logout) logout.style.display = "none";
    if (!access) return;
    const rawCode = text(access.code || access.error).toLowerCase();
    if (/^invite_/.test(rawCode)) {
      if (overlayTitle) overlayTitle.textContent = text(access.message) || "CONVITE INVALIDO";
      if (overlayMessage) overlayMessage.textContent = rawCode === "invite_expired" ? "Solicite um novo link de acesso." : rawCode === "invite_revoked" ? "Este link foi revogado." : rawCode === "invite_already_used" ? "Este link atingiu o limite de uso." : "Verifique o link recebido.";
      if (overlay) overlay.style.display = "flex";
      return;
    }
    if (isAuthenticationRequired(access)) {
      if (loginOverlay) loginOverlay.style.display = "flex";
      return;
    }
    if (access.allowed) {
      if (banner) {
        banner.textContent = limitText(access);
        banner.hidden = false;
      }
      if (logout) logout.style.display = "block";
      return;
    }
    const code = text(access.code).toUpperCase();
    if (code === "NO_ENTITLEMENT" || code === "MODULE_BLOCKED") {
      if (overlayTitle) overlayTitle.textContent = code === "MODULE_BLOCKED" ? "ACESSO BLOQUEADO" : "ACESSO INDISPONÍVEL";
      if (overlayMessage) {
        overlayMessage.textContent = code === "NO_ENTITLEMENT"
          ? "Este módulo não está habilitado para sua empresa."
          : "Entre em contato para regularizar o acesso.";
      }
      if (overlay) overlay.style.display = "flex";
      if (logout && findAccessToken()) logout.style.display = "block";
      return;
    }
    if (errorOverlay) errorOverlay.style.display = "flex";
    if (logout && findAccessToken()) logout.style.display = "block";
  }

  async function login(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    if (state.loginBusy) return;
    ensureNodes();
    const emailInput = document.querySelector("[data-trial-login-email]");
    const passwordInput = document.querySelector("[data-trial-login-password]");
    const errorNode = document.querySelector("[data-trial-login-error]");
    const submit = document.querySelector("[data-trial-login-submit]");
    const email = text(emailInput && emailInput.value).toLowerCase();
    const password = String(passwordInput && passwordInput.value || "");
    if (!email || !password) {
      if (errorNode) errorNode.textContent = "Informe e-mail e senha.";
      return;
    }
    clearSession();
    state.access = { allowed: false, status: "missing_session", code: "AUTHENTICATION_REQUIRED", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
    state.loginBusy = true;
    if (submit) {
      submit.disabled = true;
      submit.textContent = "ENTRANDO...";
    }
    if (errorNode) errorNode.textContent = "";
    try {
      const response = await fetch(apiBaseUrl() + "/api/stock-full/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const body = await response.json().catch(function () { return {}; });
      if (!response.ok || !body || !body.session || !persistSession(body.session)) {
        clearSession();
        state.access = { allowed: false, status: "missing_session", code: "AUTHENTICATION_REQUIRED", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
        render(state.access);
        emitAccessChanged(state.access);
        if (passwordInput) {
          passwordInput.value = "";
          passwordInput.focus();
        }
        if (errorNode) errorNode.textContent = "E-mail ou senha inválidos.";
        return;
      }
      if (passwordInput) passwordInput.value = "";
      await checkAccess({ force: true });
    } catch (_) {
      clearSession();
      state.access = { allowed: false, status: "missing_session", code: "AUTHENTICATION_REQUIRED", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
      render(state.access);
      emitAccessChanged(state.access);
      if (passwordInput) passwordInput.focus();
      if (errorNode) errorNode.textContent = "Não foi possível entrar agora.";
    } finally {
      state.loginBusy = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = "ENTRAR";
      }
    }
  }

  async function logoutUser() {
    clearSession();
    state.access = { allowed: false, status: "missing_session", code: "AUTHENTICATION_REQUIRED", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
    render(state.access);
    emitAccessChanged(state.access);
  }

  async function redeemInviteFromUrl() {
    const inviteToken = inviteTokenFromUrl();
    if (!inviteToken || state.inviteRedeeming) return false;
    state.inviteRedeeming = true;
    try {
      const response = await fetch(apiBaseUrl() + "/api/apartment-handover/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken })
      });
      const body = await response.json().catch(function () { return {}; });
      removeRawInviteFromUrl();
      if (!response.ok || !persistInviteSession(body)) {
        state.access = Object.assign({ allowed: false, trial_used: 0, trial_limit: 0, remaining: 0, can_create: false }, body || {}, { code: body.error || "invite_invalid" });
        render(state.access);
        emitAccessChanged(state.access);
        return false;
      }
      state.access = Object.assign({ allowed: true, auth_mode: "invite" }, body.access || {});
      render(state.access);
      emitAccessChanged(state.access);
      return true;
    } catch (_) {
      removeRawInviteFromUrl();
      state.access = { allowed: false, code: "invite_invalid", error: "invite_invalid", message: "CONVITE INVALIDO", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
      render(state.access);
      emitAccessChanged(state.access);
      return false;
    } finally {
      state.inviteRedeeming = false;
    }
  }

  async function checkAccess(options = {}) {
    const force = Boolean(options && options.force);
    if (inviteTokenFromUrl()) {
      await redeemInviteFromUrl();
    }
    if (state.checking && !force) return state.access;
    state.checking = true;
    try {
      const inviteSession = findInviteSession();
      const token = findAccessToken();
      if (!inviteSession && !token) {
        state.access = { allowed: false, status: "missing_session", code: "AUTHENTICATION_REQUIRED", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
        render(state.access);
        emitAccessChanged(state.access);
        return state.access;
      }
      const requestToken = inviteSession || token;
      const response = await fetch(apiBaseUrl() + "/api/apartment-handover/access", {
        method: "GET",
        headers: inviteSession ? { "X-Apartment-Handover-Invite-Session": inviteSession } : { Authorization: "Bearer " + requestToken }
      });
      const body = await response.json().catch(function () { return {}; });
      if (!inviteSession && requestToken !== findAccessToken()) return state.access;
      if (response.status === 401) {
        clearSession();
        state.access = { allowed: false, status: "invalid_session", code: "invalid_session", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
      } else if (!response.ok && response.status >= 500) {
        if (root.console && typeof root.console.error === "function") root.console.error("apartment_handover_access_check_failed", { status: response.status, code: body && body.code });
        state.access = Object.assign({ allowed: false, status: "access_check_failed", code: "ACCESS_CHECK_FAILED", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false }, body || {});
      } else {
        state.access = Object.assign({ allowed: response.ok && body.allowed === true }, body);
      }
      render(state.access);
      emitAccessChanged(state.access);
      return state.access;
    } catch (error) {
      if (root.console && typeof root.console.error === "function") root.console.error("apartment_handover_access_check_failed", error);
      state.access = { allowed: false, status: "access_check_failed", code: "ACCESS_CHECK_FAILED", trial_used: 0, trial_limit: 0, remaining: 0, can_create: false };
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
    const inviteSession = findInviteSession();
    const token = findAccessToken();
    if (inviteSession) return Object.assign({}, headers || {}, { "X-Apartment-Handover-Invite-Session": inviteSession });
    return Object.assign({}, headers || {}, token ? { Authorization: "Bearer " + token } : {});
  }

  root.ApartmentHandoverAccess = { checkAccess, ensureAllowed, authenticatedHeaders, findAccessToken, findInviteSession, login, logout: logoutUser, getState: function () { return Object.assign({}, state.access || {}); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", checkAccess);
  else checkAccess();
})();

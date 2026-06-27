(function () {
  const core = window.StockFullCore || {};
  const storage = core.getLocalStorage ? core.getLocalStorage() : window.localStorage;
  function isProductionLocation(locationLike) {
    return core.isPublishedProductionLocation ? core.isPublishedProductionLocation(locationLike) : !/^(localhost|127\\.0\\.0\\.1|::1)$/i.test((locationLike && locationLike.hostname) || window.location.hostname || "");
  }

  const production = isProductionLocation();

  if (!window.location.search || window.location.search.indexOf("produto=stock-full") < 0) {
    const separator = window.location.pathname.indexOf("?") >= 0 ? "&" : "?";
    const nextUrl = window.location.pathname + separator + "produto=stock-full&perfil=loja" + (window.location.hash || "");
    window.history.replaceState(null, "", nextUrl);
  }

  document.documentElement.classList.add("stock-full-app-document");
  document.body.classList.add("stock-full-app", "stock-full-context", "stock-full-profile-loja");

  if (!window.STOCK_FULL_PASSWORD_REDIRECT_URL) {
    window.STOCK_FULL_PASSWORD_REDIRECT_URL = window.location.origin + window.location.pathname;
  }

  function hasOnlineToken() {
    if (!storage) return false;
    return Boolean(storage.getItem("sb-stock-full-backend-auth-token") || storage.getItem("sb-stock-full-auth-token") || storage.getItem("stockFullSupabaseToken"));
  }

  function shouldClearLocalOnlySession(session, hasToken, locationLike) {
    return Boolean(isProductionLocation(locationLike) && !hasToken && session && session.isAuthenticated && session.mode !== "backend" && session.mode !== "supabase");
  }

  function clearLocalOnlySessionInProduction() {
    if (!production || hasOnlineToken() || !storage) return;
    try {
      const raw = storage.getItem("stockFullSession");
      const session = raw ? JSON.parse(raw) : null;
      if (shouldClearLocalOnlySession(session, false)) {
        storage.removeItem("stockFullSession");
      }
    } catch (error) {
      storage.removeItem("stockFullSession");
    }
  }

  clearLocalOnlySessionInProduction();

  function apiUrl(path) {
    return core.buildStockFullApiUrl ? core.buildStockFullApiUrl(path) : path;
  }

  function shouldRewriteStockFullApi(input) {
    return typeof input === "string" && /^\/api\/stock-full(?:\/|$)/i.test(input);
  }

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (originalFetch && !window.__stockFullApiFetchPatched) {
    window.__stockFullApiFetchPatched = true;
    window.fetch = function (input, options) {
      if (shouldRewriteStockFullApi(input)) {
        return originalFetch(apiUrl(input), options);
      }
      return originalFetch(input, options);
    };
  }

  function setLoginStatus(message, type) {
    const node = document.getElementById("stockFullLoginStatus");
    if (!node) return;
    node.textContent = message;
    node.dataset.status = type || "info";
  }

  function storeBackendSession(payload) {
    const profile = payload && payload.profile || {};
    const session = payload && payload.session || {};
    const token = session.access_token || payload.access_token || "";
    if (!token) throw new Error("stock_full_login_token_missing");

    const persisted = {
      currentSession: { access_token: token, refresh_token: session.refresh_token || "" },
      access_token: token,
      refresh_token: session.refresh_token || "",
      expires_at: session.expires_at || ""
    };
    storage.setItem("sb-stock-full-backend-auth-token", JSON.stringify(persisted));

    const appSession = {
      isAuthenticated: true,
      mode: "backend",
      profileId: profile.id || "",
      userId: payload.user && payload.user.id || profile.id || "",
      userName: profile.name || payload.user && payload.user.email || "Usuario Stock Full",
      userEmail: profile.email || payload.user && payload.user.email || "",
      companyId: profile.institution_id || profile.company_id || "",
      companyName: profile.company_name || profile.institution_name || "Empresa online",
      role: profile.role || "funcionario"
    };
    if (core.setSession) core.setSession(appSession);
    else storage.setItem("stockFullSession", JSON.stringify(appSession));
  }

  async function loginWithBackend(email, password) {
    const response = await originalFetch(apiUrl("login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") })
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "stock_full_backend_login_failed");
    }
    storeBackendSession(data);
    return data;
  }

  function installProductionGuards() {
    if (!production) return;
    document.querySelectorAll("[data-stock-full-demo-login]").forEach(function (button) {
      button.classList.add("is-hidden");
      button.setAttribute("aria-hidden", "true");
      button.setAttribute("disabled", "disabled");
    });
  }

  document.addEventListener("click", function (event) {
    if (!production) return;
    const demoButton = event.target && event.target.closest ? event.target.closest("[data-stock-full-demo-login]") : null;
    if (!demoButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setLoginStatus("Login demo/local bloqueado em producao. Use usuario real do servidor.", "error");
  }, true);

  document.addEventListener("submit", async function (event) {
    if (!production || !event.target || event.target.id !== "stockFullLoginForm") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const formData = new FormData(event.target);
    try {
      setLoginStatus("Conectando ao servidor do Stock Full...", "info");
      await loginWithBackend(formData.get("email"), formData.get("password"));
      setLoginStatus("Login online realizado. Carregando dados da empresa...", "success");
      window.location.reload();
    } catch (error) {
      setLoginStatus("Servidor indisponivel. Nao foi possivel carregar dados online.", "error");
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installProductionGuards);
  } else {
    installProductionGuards();
  }

  window.StockFullAppRuntime = {
    isProduction: function () { return production; },
    isProductionLocation,
    isDemoLoginAllowedFor: function (locationLike) { return !isProductionLocation(locationLike); },
    shouldClearLocalOnlySession,
    apiUrl,
    loginWithBackend,
    isDemoLoginAllowed: function () { return !production; }
  };
})();
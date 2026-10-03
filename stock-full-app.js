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

  function redactDiagnosticValue(value, key) {
    if (/password|token|secret|api[_-]?key|service[_-]?role|authorization|cookie/i.test(String(key || ""))) {
      return "[REDACTED]";
    }
    if (Array.isArray(value)) return value.map(function (item) { return redactDiagnosticValue(item, ""); });
    if (value && typeof value === "object") {
      return Object.keys(value).reduce(function (result, childKey) {
        result[childKey] = redactDiagnosticValue(value[childKey], childKey);
        return result;
      }, {});
    }
    return value;
  }

  function safeDiagnosticText(value) {
    const text = String(value == null ? "" : value);
    try {
      return JSON.stringify(redactDiagnosticValue(JSON.parse(text), ""));
    } catch (_) {
      return text
        .replace(/Bearer\s+[^\s]+/ig, "Bearer [REDACTED]")
        .replace(/(password|token|secret|api[_-]?key|service[_-]?role|authorization)\s*[:=]\s*[^,;\s]+/ig, "$1=[REDACTED]")
        .slice(0, 2000);
    }
  }

  function safeDiagnosticBody(rawBody) {
    const body = safeDiagnosticText(rawBody);
    return body || "(empty)";
  }

  function createLoginDiagnosticError(error, requestUrl, httpStatus, statusText, responseBody) {
    const diagnostic = new Error(safeDiagnosticText(error && error.message || error || "Unknown login error"));
    diagnostic.name = error && error.name || "Error";
    diagnostic.requestUrl = requestUrl;
    diagnostic.httpStatus = httpStatus == null ? null : httpStatus;
    diagnostic.statusText = safeDiagnosticText(statusText || "");
    diagnostic.responseBody = responseBody == null ? "(none)" : safeDiagnosticBody(responseBody);
    return diagnostic;
  }

  function getLoginDiagnostic(error, requestUrl) {
    return {
      errorName: safeDiagnosticText(error && error.name || "Error"),
      errorMessage: safeDiagnosticText(error && error.message || error || "Unknown login error"),
      requestUrl: requestUrl,
      httpStatus: error && error.httpStatus == null ? null : error && error.httpStatus,
      statusText: safeDiagnosticText(error && error.statusText || ""),
      responseBody: error && error.responseBody ? safeDiagnosticBody(error.responseBody) : "(none)"
    };
  }

  function formatLoginDiagnostic(diagnostic) {
    return [
      "ERROR NAME: " + diagnostic.errorName,
      "ERROR MESSAGE: " + diagnostic.errorMessage,
      "REQUEST URL: " + diagnostic.requestUrl,
      "HTTP STATUS: " + (diagnostic.httpStatus == null ? "(none)" : diagnostic.httpStatus),
      "STATUS TEXT: " + (diagnostic.statusText || "(none)"),
      "RESPONSE BODY: " + diagnostic.responseBody
    ].join(" | ");
  }

  async function loginWithBackend(email, password) {
    const requestUrl = apiUrl("login");
    let response;
    try {
      response = await originalFetch(requestUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") })
      });
    } catch (error) {
      throw createLoginDiagnosticError(error, requestUrl, null, "", "(none)");
    }

    const rawBody = await response.text().catch(function () { return "(unreadable response body)"; });
    let data = {};
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (_) {}
    if (!response.ok || !data.ok) {
      throw createLoginDiagnosticError(
        new Error(data.error || "stock_full_backend_login_failed"),
        requestUrl,
        response.status,
        response.statusText,
        rawBody
      );
    }
    storeBackendSession(data);
    return data;
  }

  function getBackendToken() {
    try {
      const raw = storage && storage.getItem("sb-stock-full-backend-auth-token");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed.access_token || parsed.currentSession && parsed.currentSession.access_token || "";
    } catch (error) {
      return "";
    }
  }

  async function loadStockFullWorks() {
    const token = getBackendToken();
    if (!token || !originalFetch) return [];
    const response = await originalFetch(apiUrl("works"), { headers: { Authorization: "Bearer " + token } });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.ok) throw new Error(data.error || "stock_full_works_query_failed");
    return Array.isArray(data.works) ? data.works : [];
  }

  function renderStockFullWorkSelector(works) {
    const dashboard = document.getElementById("stockFullDashboard");
    if (!dashboard) return;
    let panel = document.getElementById("stockFullWorkScopePanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "stockFullWorkScopePanel";
      panel.className = "stock-full-work-scope-panel";
      panel.innerHTML = '<div><strong>Obra ativa</strong><span id="stockFullWorkScopeStatus">Selecione a obra antes de operar o estoque.</span></div><label>Obra<select id="stockFullWorkScopeSelect"><option value="">Selecione uma obra</option></select></label>';
      const hero = dashboard.querySelector(".stock-full-dashboard-hero");
      if (hero && hero.parentNode) hero.parentNode.insertBefore(panel, hero);
      else dashboard.insertBefore(panel, dashboard.firstChild);
    }
    const select = document.getElementById("stockFullWorkScopeSelect");
    const status = document.getElementById("stockFullWorkScopeStatus");
    const currentId = core.getCurrentWorkId ? core.getCurrentWorkId() : "";
    select.innerHTML = '<option value="">Selecione uma obra</option>' + works.map(function (work) {
      return '<option value="' + String(work.id || "").replace(/"/g, "&quot;") + '">' + String(work.name || work.id || "Obra").replace(/[&<>]/g, function (value) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[value]; }) + '</option>';
    }).join("");
    const matching = works.find(function (work) { return String(work.id) === currentId; });
    if (matching) {
      select.value = matching.id;
      status.textContent = "Dados e movimentações limitados a: " + (matching.name || matching.id) + ".";
    } else if (works.length === 1) {
      core.setCurrentWork(works[0]);
      select.value = works[0].id;
      status.textContent = "Dados e movimentações limitados a: " + (works[0].name || works[0].id) + ".";
    } else {
      core.clearCurrentWork && core.clearCurrentWork();
      status.textContent = "Selecione a obra antes de operar o estoque.";
    }
    if (!select.dataset.bound) {
      select.dataset.bound = "true";
      select.addEventListener("change", function () {
        const work = works.find(function (item) { return String(item.id) === select.value; });
        if (!work) {
          core.clearCurrentWork && core.clearCurrentWork();
          status.textContent = "Selecione a obra antes de operar o estoque.";
          return;
        }
        core.setCurrentWork(work);
        window.location.reload();
      });
    }
  }

  async function installStockFullWorkScope() {
    if (!production) return;
    try {
      renderStockFullWorkSelector(await loadStockFullWorks());
    } catch (error) {
      const status = document.getElementById("stockFullWorkScopeStatus");
      if (status) status.textContent = "Não foi possível carregar as obras autorizadas.";
      console.error("[Stock Full work scope]", { error: String(error && error.message || error) });
    }
  }

  document.addEventListener("click", function (event) {
    if (!production || !core.getCurrentWorkId || core.getCurrentWorkId()) return;
    const target = event.target && event.target.closest ? event.target.closest("[data-almox-action],[data-stock-full-dashboard-action],[data-almox-flow-action]") : null;
    const action = target && (target.getAttribute("data-almox-action") || target.getAttribute("data-stock-full-dashboard-action") || target.getAttribute("data-almox-flow-action"));
    if (!target || !/(item|entry|exit)/i.test(action || "")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = document.getElementById("stockFullWorkScopeStatus");
    if (status) status.textContent = "Selecione a obra antes de operar o estoque.";
  }, true);

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
      const diagnostic = getLoginDiagnostic(error, apiUrl("login"));
      console.error("[Stock Full login diagnostic]", diagnostic);
      setLoginStatus(formatLoginDiagnostic(diagnostic), "error");
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installProductionGuards);
    document.addEventListener("DOMContentLoaded", installStockFullWorkScope);
  } else {
    installProductionGuards();
    installStockFullWorkScope();
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

(function (root) {
  "use strict";

  const STORAGE_KEY = "obrareport-rdo-stock-canonical-session-v1";
  let sessionRevision = 0;

  function clearSession(storage) {
    sessionRevision += 1;
    const target = storage || root.localStorage;
    try { if (target && typeof target.removeItem === "function") target.removeItem(STORAGE_KEY); } catch (_) {}
    return sessionRevision;
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function createRdoCanonicalAuth(options) {
    const settings = options || {};
    const baseUrl = clean(settings.baseUrl || root.OBRAREPORT_API_BASE_URL).replace(/\/+$/g, "");
    const supabaseUrl = clean(settings.supabaseUrl).replace(/\/+$/g, "");
    const anonKey = clean(settings.anonKey);
    const fetchImpl = settings.fetchImpl || root.fetch;
    const storage = settings.storage || root.localStorage;
    const now = typeof settings.now === "function" ? settings.now : Date.now;

    if (!baseUrl) throw new Error("rdo_api_base_url_required");
    if (typeof fetchImpl !== "function") throw new Error("rdo_fetch_unavailable");
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new Error("rdo_session_storage_unavailable");
    }

    function readStored() {
      try {
        const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
        if (!parsed || !parsed.session || !clean(parsed.session.access_token)) return null;
        return parsed;
      } catch (_) {
        return null;
      }
    }

    function saveStored(value) {
      storage.setItem(STORAGE_KEY, JSON.stringify(value));
    }

    function isCurrentSession(stored, revision) {
      const current = readStored();
      return revision === sessionRevision && Boolean(current && stored &&
        clean(current.user && current.user.id) === clean(stored.user && stored.user.id) &&
        clean(current.profile && current.profile.institution_id) === clean(stored.profile && stored.profile.institution_id) &&
        clean(current.session.access_token) === clean(stored.session.access_token) &&
        clean(current.session.refresh_token) === clean(stored.session.refresh_token));
    }

    async function parseResponse(response) {
      let data = {};
      try { data = await response.json(); } catch (_) { data = {}; }
      if (!response.ok || !data || data.ok === false) {
        const error = clean(data && (data.error || data.code)) || "rdo_canonical_auth_failed";
        throw Object.assign(new Error(error), { status: response.status, code: error });
      }
      return data;
    }

    function normalizeSession(session) {
      const source = session || {};
      const expiresIn = Number(source.expires_in || source.expiresIn || 0);
      const expiresAt = Number(source.expires_at || source.expiresAt || 0) ||
        (expiresIn ? Math.floor(now() / 1000) + expiresIn : 0);
      return {
        access_token: clean(source.access_token || source.accessToken),
        refresh_token: clean(source.refresh_token || source.refreshToken),
        expires_at: expiresAt || null,
        token_type: clean(source.token_type || source.tokenType) || "bearer"
      };
    }

    async function login(email, password) {
      const normalizedEmail = clean(email).toLowerCase();
      const secret = String(password || "");
      if (!normalizedEmail || !secret) throw new Error("rdo_canonical_credentials_required");
      const revision = clearSession(storage);

      const response = await fetchImpl(baseUrl + "/api/stock-full/login", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: secret })
      });
      const data = await parseResponse(response);
      if (revision !== sessionRevision) throw new Error("rdo_canonical_session_changed");
      const session = normalizeSession(data.session);
      const user = data.user && typeof data.user === "object" ? data.user : {};
      const profile = data.profile && typeof data.profile === "object" ? data.profile : {};
      if (!session.access_token || !session.refresh_token || !clean(profile.institution_id)) {
        throw new Error("rdo_canonical_session_incomplete");
      }
      if (clean(user.email) && clean(user.email).toLowerCase() !== normalizedEmail) {
        throw new Error("rdo_canonical_identity_mismatch");
      }

      const stored = {
        session: session,
        user: { id: clean(user.id), email: clean(user.email) || normalizedEmail },
        profile: { institution_id: clean(profile.institution_id) },
        saved_at: new Date(now()).toISOString()
      };
      saveStored(stored);
      return { user: stored.user, profile: stored.profile };
    }

    async function refresh(stored, revision) {
      if (!supabaseUrl || !anonKey || !clean(stored.session.refresh_token)) return null;
      const response = await fetchImpl(supabaseUrl + "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({ refresh_token: stored.session.refresh_token })
      });
      const data = await parseResponse(response);
      if (!isCurrentSession(stored, revision)) return "";
      const nextSession = normalizeSession(data);
      if (!nextSession.access_token || !nextSession.refresh_token) return null;
      const nextStored = Object.assign({}, stored, { session: nextSession, saved_at: new Date(now()).toISOString() });
      saveStored(nextStored);
      return nextSession.access_token;
    }

    async function getValidAccessToken() {
      const stored = readStored();
      if (!stored) return "";
      const revision = sessionRevision;
      const expiry = Number(stored.session.expires_at || 0) * 1000;
      if (expiry && expiry <= now() + 60000) {
        try {
          const refreshed = await refresh(stored, revision);
          if (refreshed) return refreshed;
        } catch (_) {
          if (expiry <= now()) return "";
        }
        if (expiry <= now()) return "";
      }
      return isCurrentSession(stored, revision) ? clean(stored.session.access_token) : "";
    }

    return {
      login: login,
      getValidAccessToken: getValidAccessToken,
      hasSession: function () { return Boolean(readStored()); },
      clear: function () { clearSession(storage); }
    };
  }

  root.ObraReportRdoCanonicalAuth = {
    STORAGE_KEY: STORAGE_KEY,
    clearSession: clearSession,
    create: createRdoCanonicalAuth
  };
})(typeof window !== "undefined" ? window : globalThis);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractBearerToken(request) {
  const authorization = clean(request && request.headers && request.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match && match[1] ? clean(match[1]) : "";
}

function normalizeProfile(profile) {
  const safe = profile && typeof profile === "object" ? profile : {};
  return {
    id: clean(safe.id),
    auth_user_id: clean(safe.auth_user_id),
    institution_id: clean(safe.institution_id),
    company_id: clean(safe.company_id),
    unit_id: clean(safe.unit_id),
    name: clean(safe.name),
    email: clean(safe.email),
    role: clean(safe.role),
    status: clean(safe.status)
  };
}

const PROFILE_SELECTS = [
  "id,auth_user_id,institution_id,company_id,unit_id,name,email,role,status",
  "id,auth_user_id,institution_id,unit_id,name,email,role,status",
  "id,auth_user_id,institution_id,company_id,unit_id,name,email,role",
  "id,auth_user_id,institution_id,unit_id,name,email,role"
];

function isMissingProfileColumnError(error) {
  const code = clean(error && error.code);
  const message = clean(error && (error.message || error.msg || error.hint));
  return code === "42703" ||
    code === "PGRST204" ||
    /column\s+profiles\.[a-z_]+\s+does\s+not\s+exist/i.test(message) ||
    /could\s+not\s+find\s+the\s+'[a-z_]+'\s+column/i.test(message);
}

async function fetchProfileByAuthUser(supabase, table, authUserId) {
  let lastColumnError = null;

  for (const selectColumns of PROFILE_SELECTS) {
    let result = null;
    try {
      result = await supabase
        .from(table)
        .select(selectColumns)
        .eq("auth_user_id", authUserId)
        .maybeSingle();
    } catch (error) {
      result = { data: null, error };
    }

    if (!result || !result.error) {
      return { data: result && result.data || null, error: null, selectColumns };
    }

    if (!isMissingProfileColumnError(result.error)) {
      return { data: null, error: result.error, selectColumns };
    }

    lastColumnError = result.error;
  }

  return { data: null, error: lastColumnError };
}

export async function resolveAuthContext(request, options = {}) {
  const supabase = options.supabase;
  if (!supabase || !supabase.auth || typeof supabase.auth.getUser !== "function") {
    return { ok: false, status: 503, error: "auth_context_database_not_configured" };
  }

  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "authentication_required" };
  }

  let userData = null;
  let userError = null;
  try {
    const result = await supabase.auth.getUser(token);
    userData = result && result.data;
    userError = result && result.error;
  } catch (_) {
    return { ok: false, status: 401, error: "invalid_session" };
  }
  const user = userData && userData.user;
  if (userError || !user || !clean(user.id)) {
    return { ok: false, status: 401, error: "invalid_session" };
  }

  const result = await fetchProfileByAuthUser(supabase, options.profileTable || "profiles", clean(user.id));
  const profileData = result && result.data;
  const profileError = result && result.error;
  if (profileError) {
    return { ok: false, status: 500, error: "auth_context_profile_lookup_failed" };
  }
  if (!profileData) {
    return { ok: false, status: 403, error: "auth_context_profile_not_found" };
  }

  const profile = normalizeProfile(profileData);
  const tenantId = clean(profile.company_id || profile.institution_id);
  const institutionId = clean(profile.institution_id || profile.company_id);
  if (!tenantId || !institutionId) {
    return { ok: false, status: 403, error: "auth_context_tenant_not_found" };
  }

  return {
    ok: true,
    userId: clean(user.id),
    institutionId,
    companyId: tenantId,
    role: clean(profile.role) || "user",
    profile
  };
}

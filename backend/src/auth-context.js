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

export async function resolveAuthContext(request, options = {}) {
  const supabase = options.supabase;
  if (!supabase || !supabase.auth || typeof supabase.auth.getUser !== "function") {
    return { ok: false, status: 503, error: "auth_context_database_not_configured" };
  }

  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, error: "authentication_required" };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  const user = userData && userData.user;
  if (userError || !user || !clean(user.id)) {
    return { ok: false, status: 401, error: "invalid_session" };
  }

  const { data: profileData, error: profileError } = await supabase
    .from(options.profileTable || "profiles")
    .select("id,auth_user_id,institution_id,company_id,unit_id,name,email,role,status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 500, error: "auth_context_profile_lookup_failed" };
  }
  if (!profileData) {
    return { ok: false, status: 403, error: "auth_context_profile_not_found" };
  }

  const profile = normalizeProfile(profileData);
  return {
    ok: true,
    userId: clean(user.id),
    institutionId: clean(profile.institution_id || profile.company_id),
    companyId: clean(profile.company_id || profile.institution_id),
    role: clean(profile.role) || "user",
    profile
  };
}

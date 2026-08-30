export const APARTMENT_HANDOVER_MODULE_KEY = "apartment_handover";

const ALLOWED_STATUSES = new Set(["trial_active", "trial_exhausted", "active", "blocked"]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function iso(date) {
  const value = date instanceof Date ? date : new Date(date || "");
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

function remaining(limit, used) {
  return Math.max(0, numberOrZero(limit) - numberOrZero(used));
}

function normalizeStatus(status) {
  const value = clean(status);
  return ALLOWED_STATUSES.has(value) ? value : "blocked";
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return null;
  const trialLimit = numberOrZero(row.trial_limit);
  const trialUsed = Math.min(numberOrZero(row.trial_used), trialLimit);
  return {
    id: clean(row.id),
    institution_id: clean(row.institution_id),
    module_key: clean(row.module_key),
    status: normalizeStatus(row.status),
    trial_limit: trialLimit,
    trial_used: trialUsed,
    activated_at: iso(row.activated_at),
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at)
  };
}

function accessFromRow(row) {
  const entitlement = normalizeRow(row);
  if (!entitlement) {
    return { allowed: false, status: "no_entitlement", code: "NO_ENTITLEMENT", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false };
  }
  if (entitlement.status === "blocked") {
    return { allowed: false, status: "blocked", code: "MODULE_BLOCKED", entitlement, trialUsed: entitlement.trial_used, trialLimit: entitlement.trial_limit, remaining: remaining(entitlement.trial_limit, entitlement.trial_used), canCreate: false };
  }
  if (entitlement.status === "active") {
    return { allowed: true, status: "active", entitlement, trialUsed: entitlement.trial_used, trialLimit: entitlement.trial_limit, remaining: null, canCreate: true };
  }
  const left = remaining(entitlement.trial_limit, entitlement.trial_used);
  const status = entitlement.status === "trial_exhausted" || left <= 0 ? "trial_exhausted" : "trial_active";
  return { allowed: true, status, entitlement, trialUsed: entitlement.trial_used, trialLimit: entitlement.trial_limit, remaining: left, canCreate: status === "trial_active" && left > 0 };
}

function accessFromRpcRow(row) {
  if (!row || typeof row !== "object") return { allowed: false, status: "no_entitlement", code: "NO_ENTITLEMENT", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false, consumed: false };
  const status = clean(row.status);
  const allowed = row.allowed === true;
  const trialLimit = numberOrZero(row.trial_limit);
  const trialUsed = Math.min(numberOrZero(row.trial_used), trialLimit);
  const left = row.remaining == null ? remaining(trialLimit, trialUsed) : numberOrZero(row.remaining);
  return {
    allowed,
    consumed: row.consumed === true,
    status: status || (allowed ? "trial_active" : "no_entitlement"),
    code: row.code ? clean(row.code) : undefined,
    trialUsed,
    trialLimit,
    remaining: left,
    canCreate: status === "active" || (status === "trial_active" && left > 0)
  };
}

function responseShape(access) {
  const trialUsed = numberOrZero(access.trialUsed ?? access.trial_used ?? (access.entitlement && access.entitlement.trial_used));
  const trialLimit = numberOrZero(access.trialLimit ?? access.trial_limit ?? (access.entitlement && access.entitlement.trial_limit));
  const left = access.remaining == null && access.status === "active" ? undefined : numberOrZero(access.remaining ?? remaining(trialLimit, trialUsed));
  return {
    allowed: Boolean(access.allowed),
    status: clean(access.status),
    code: access.code ? clean(access.code) : undefined,
    trial_used: trialUsed,
    trial_limit: trialLimit,
    remaining: left,
    can_create: Boolean(access.canCreate ?? access.can_create),
    consumed: access.consumed === true ? true : undefined
  };
}

async function maybeSingle(query) {
  if (query && typeof query.maybeSingle === "function") return query.maybeSingle();
  if (query && typeof query.single === "function") return query.single();
  throw new Error("entitlement_query_not_supported");
}

async function fetchEntitlement(supabase, institutionId, moduleKey) {
  const { data, error } = await maybeSingle(
    supabase
      .from("institution_module_entitlements")
      .select("id,institution_id,module_key,status,trial_limit,trial_used,activated_at,created_at,updated_at")
      .eq("institution_id", institutionId)
      .eq("module_key", moduleKey)
  );
  if (error && error.code !== "PGRST116") {
    throw Object.assign(new Error("entitlement_lookup_failed"), { cause: error });
  }
  return normalizeRow(data);
}

async function maybeRpcSingle(query) {
  if (query && typeof query.single === "function") return query.single();
  if (query && typeof query.maybeSingle === "function") return query.maybeSingle();
  if (query && typeof query.then === "function") return query;
  throw new Error("trial_usage_rpc_not_supported");
}

export async function resolveApartmentHandoverAccess(input = {}) {
  const supabase = input.supabase;
  const institutionId = clean(input.institutionId);
  const moduleKey = clean(input.moduleKey || APARTMENT_HANDOVER_MODULE_KEY);
  if (!supabase || typeof supabase.from !== "function") {
    return { allowed: false, status: "service_unavailable", code: "ENTITLEMENT_SERVICE_UNAVAILABLE", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false };
  }
  if (!institutionId) {
    return { allowed: false, status: "no_institution", code: "INSTITUTION_REQUIRED", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false };
  }
  if (moduleKey !== APARTMENT_HANDOVER_MODULE_KEY) {
    return { allowed: false, status: "blocked", code: "MODULE_BLOCKED", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false };
  }

  return accessFromRow(await fetchEntitlement(supabase, institutionId, moduleKey));
}

export async function authorizeApartmentHandoverInspectionUsage(input = {}) {
  const supabase = input.supabase;
  const institutionId = clean(input.institutionId);
  const inspectionId = clean(input.inspectionId);
  const consume = input.consume !== false;
  if (!supabase || typeof supabase.rpc !== "function") {
    return { allowed: false, status: "service_unavailable", code: "ENTITLEMENT_SERVICE_UNAVAILABLE", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false, consumed: false };
  }
  if (!institutionId) {
    return { allowed: false, status: "no_institution", code: "INSTITUTION_REQUIRED", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false, consumed: false };
  }
  if (!inspectionId) {
    return { allowed: false, status: "missing_inspection_id", code: "INSPECTION_ID_REQUIRED", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false, consumed: false };
  }

  const { data, error } = await maybeRpcSingle(supabase.rpc("consume_apartment_handover_trial_usage", {
    p_institution_id: institutionId,
    p_inspection_id: inspectionId,
    p_consume: consume
  }));
  if (error) {
    throw Object.assign(new Error("trial_usage_authorization_failed"), { cause: error });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return accessFromRpcRow(row);
}

export function toApartmentHandoverAccessResponse(access = {}) {
  return responseShape(access);
}

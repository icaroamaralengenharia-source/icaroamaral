import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const APARTMENT_HANDOVER_MODULE_KEY = "apartment_handover";
export const DEFAULT_INVITE_TTL_HOURS = 72;
export const DEFAULT_INVITE_MAX_REDEMPTIONS = 3;
export const DEFAULT_SESSION_TTL_MINUTES = 12 * 60;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function nowDate(now = new Date()) {
  return now instanceof Date ? now : new Date(now);
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseBase64urlJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function requireSecret(secret) {
  const safe = clean(secret);
  if (safe.length < 32) {
    const error = new Error("invite_session_secret_not_configured");
    error.status = 503;
    throw error;
  }
  return safe;
}

function sign(payloadPart, secret) {
  return createHmac("sha256", requireSecret(secret)).update(payloadPart).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function generateInviteToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token) {
  const safe = clean(token);
  if (!safe) {
    const error = new Error("invite_token_required");
    error.status = 400;
    throw error;
  }
  return createHash("sha256").update(safe).digest("hex");
}

export function createApartmentHandoverInviteSession(input = {}, options = {}) {
  const secret = requireSecret(options.secret);
  const issuedAt = nowDate(options.now);
  const ttlMinutes = Number(options.ttlMinutes || DEFAULT_SESSION_TTL_MINUTES);
  const expiresAt = new Date(issuedAt.getTime() + ttlMinutes * 60 * 1000);
  const payload = {
    typ: "apartment_handover_invite_session",
    sid: clean(input.sessionId) || randomUUID(),
    iid: clean(input.inviteId),
    institution_id: clean(input.institutionId),
    module_key: clean(input.moduleKey) || APARTMENT_HANDOVER_MODULE_KEY,
    iat: Math.floor(issuedAt.getTime() / 1000),
    exp: Math.floor(expiresAt.getTime() / 1000)
  };
  if (!payload.iid || !payload.institution_id || payload.module_key !== APARTMENT_HANDOVER_MODULE_KEY) {
    const error = new Error("invalid_invite_session_payload");
    error.status = 500;
    throw error;
  }
  const payloadPart = base64urlJson(payload);
  return {
    token: `${payloadPart}.${sign(payloadPart, secret)}`,
    payload,
    expiresAt: expiresAt.toISOString()
  };
}

export function verifyApartmentHandoverInviteSession(token, options = {}) {
  const secret = requireSecret(options.secret);
  const [payloadPart, signature] = clean(token).split(".");
  if (!payloadPart || !signature || !safeEqual(signature, sign(payloadPart, secret))) {
    return { ok: false, status: 401, error: "invalid_invite_session" };
  }
  try {
    const payload = parseBase64urlJson(payloadPart);
    const nowSeconds = Math.floor(nowDate(options.now).getTime() / 1000);
    if (payload.typ !== "apartment_handover_invite_session" || clean(payload.module_key) !== APARTMENT_HANDOVER_MODULE_KEY) {
      return { ok: false, status: 401, error: "invalid_invite_session" };
    }
    if (!clean(payload.institution_id) || !clean(payload.iid) || Number(payload.exp || 0) <= nowSeconds) {
      return { ok: false, status: 401, error: "expired_invite_session" };
    }
    return {
      ok: true,
      authMode: "invite",
      inviteId: clean(payload.iid),
      institutionId: clean(payload.institution_id),
      moduleKey: clean(payload.module_key),
      sessionId: clean(payload.sid),
      expiresAt: new Date(Number(payload.exp) * 1000).toISOString(),
      payload
    };
  } catch (error) {
    return { ok: false, status: 401, error: "invalid_invite_session" };
  }
}

export function mapInviteRedeemError(error) {
  const code = clean(error && (error.code || error.message || error));
  if (/expired/i.test(code)) return { status: 410, error: "invite_expired", message: "CONVITE EXPIRADO" };
  if (/revoked/i.test(code)) return { status: 403, error: "invite_revoked", message: "CONVITE REVOGADO" };
  if (/max|redemption|utilizado/i.test(code)) return { status: 409, error: "invite_already_used", message: "CONVITE JA UTILIZADO" };
  if (/not_found|invalid/i.test(code)) return { status: 404, error: "invite_invalid", message: "CONVITE INVALIDO" };
  return { status: Number(error && error.status) || 500, error: code || "invite_redeem_failed", message: "CONVITE INVALIDO" };
}

export function mapEntitlementAccess(entitlement) {
  const safe = entitlement && typeof entitlement === "object" ? entitlement : null;
  if (!safe) {
    return { ok: false, status: 403, error: "NO_ENTITLEMENT" };
  }
  const status = clean(safe.status).toLowerCase();
  const trialLimit = Math.max(0, Number(safe.trial_limit || 0));
  const trialUsed = Math.max(0, Number(safe.trial_used || 0));
  const remaining = Math.max(0, trialLimit - trialUsed);
  if (status === "blocked") {
    return { ok: false, status: 403, error: "MODULE_BLOCKED" };
  }
  if (!["trial_active", "trial_exhausted", "active"].includes(status)) {
    return { ok: false, status: 403, error: "NO_ENTITLEMENT" };
  }
  return {
    ok: true,
    allowed: true,
    status,
    trial_used: trialUsed,
    trial_limit: trialLimit,
    remaining,
    can_create: status === "active" || (status === "trial_active" && remaining > 0),
    read_only: status === "trial_exhausted" || (status === "trial_active" && remaining <= 0)
  };
}

export async function getApartmentHandoverEntitlement(database, institutionId, moduleKey = APARTMENT_HANDOVER_MODULE_KEY) {
  const { data, error } = await database
    .from("institution_module_entitlements")
    .select("id,institution_id,module_key,status,trial_limit,trial_used")
    .eq("institution_id", institutionId)
    .eq("module_key", moduleKey)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function createApartmentHandoverInvite(database, input = {}, options = {}) {
  const token = clean(input.token) || generateInviteToken();
  const now = nowDate(options.now);
  const ttlHours = Number(input.ttlHours || input.ttl_hours || DEFAULT_INVITE_TTL_HOURS);
  const maxRedemptions = Number(input.maxRedemptions || input.max_redemptions || DEFAULT_INVITE_MAX_REDEMPTIONS);
  const record = {
    institution_id: clean(input.institutionId || input.institution_id),
    module_key: clean(input.moduleKey || input.module_key) || APARTMENT_HANDOVER_MODULE_KEY,
    token_hash: hashInviteToken(token),
    status: "active",
    expires_at: new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString(),
    max_redemptions: Math.max(1, maxRedemptions),
    redeemed_count: 0,
    created_by: clean(input.createdBy || input.created_by) || null
  };
  if (!record.institution_id || record.module_key !== APARTMENT_HANDOVER_MODULE_KEY) {
    const error = new Error("invalid_invite_payload");
    error.status = 400;
    throw error;
  }
  const { data, error } = await database
    .from("institution_module_invites")
    .insert(record)
    .select("id,institution_id,module_key,status,expires_at,max_redemptions,redeemed_count,created_by,created_at,last_redeemed_at,revoked_at")
    .single();
  if (error) throw error;
  return { invite: data, token };
}

export async function redeemApartmentHandoverInvite(database, input = {}, options = {}) {
  const tokenHash = hashInviteToken(input.inviteToken || input.invite_token);
  const now = nowDate(options.now).toISOString();
  const rpcName = options.rpcName || "redeem_institution_module_invite";
  if (!database || typeof database.rpc !== "function") {
    const error = new Error("invite_atomic_redeem_unavailable");
    error.status = 503;
    throw error;
  }
  const { data, error } = await database.rpc(rpcName, {
    p_token_hash: tokenHash,
    p_module_key: APARTMENT_HANDOVER_MODULE_KEY,
    p_now: now
  });
  if (error) {
    const rpcError = new Error(clean(error.message || error.code) || "invite_redeem_failed");
    rpcError.status = Number(error.status) || 400;
    rpcError.code = clean(error.code);
    throw rpcError;
  }
  const invite = Array.isArray(data) ? data[0] : data;
  if (!invite || !clean(invite.institution_id)) {
    const notFound = new Error("invite_not_found");
    notFound.status = 404;
    throw notFound;
  }

  const entitlement = await getApartmentHandoverEntitlement(database, invite.institution_id, APARTMENT_HANDOVER_MODULE_KEY);
  const access = mapEntitlementAccess(entitlement);
  if (!access.ok) {
    const entitlementError = new Error(access.error);
    entitlementError.status = access.status;
    throw entitlementError;
  }
  const session = createApartmentHandoverInviteSession({
    inviteId: invite.id,
    institutionId: invite.institution_id,
    moduleKey: invite.module_key
  }, {
    secret: options.secret,
    now: options.now,
    ttlMinutes: options.sessionTtlMinutes
  });
  return { ok: true, invite, entitlement, access, session };
}

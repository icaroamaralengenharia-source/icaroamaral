import crypto from "node:crypto";

const ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "almoxarife", "funcionario", "leitura"]);
const ACTIVE = new Set(["active", "ativo"]);
const PENDING = new Set(["pending", "pendente"]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function activeStatus(value) {
  return clean(value) || "active";
}

function isActive(value) {
  return ACTIVE.has(lower(activeStatus(value)));
}

function nowIso(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function addDaysIso(days, now = () => new Date()) {
  const date = new Date(nowIso(now));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function hashToken(token) {
  return crypto.createHash("sha256").update(clean(token)).digest("hex");
}

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function publicInvite(invite) {
  if (!invite) return null;
  const copy = Object.assign({}, invite);
  delete copy.token_hash;
  return copy;
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 5) return null;
  if (Array.isArray(value)) return value.map((item) => sanitizeMetadata(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|secret|password|authorization|bearer|service_role/i.test(key)) continue;
    out[key] = sanitizeMetadata(item, depth + 1);
  }
  return out;
}

function error(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeRole(role) {
  const value = lower(role);
  if (value === "admin" || value === "administrador") return "municipal_admin";
  return value;
}

function requireValidRole(role) {
  const normalized = normalizeRole(role);
  if (!ROLES.has(normalized)) throw error(400, "invalid_role");
  return normalized;
}

function sessionFromContext(context) {
  if (!context || !context.ok) throw error(context && context.status || 401, clean(context && context.error) || "authentication_required");
  const profile = context.profile || {};
  const status = activeStatus(profile.status);
  if (!isActive(status)) throw error(403, "user_inactive");
  const role = normalizeRole(context.role || profile.role);
  if (!ROLES.has(role)) throw error(403, "municipal_role_not_allowed");
  const platformAdmin = role === "platform_admin";
  return {
    userId: clean(context.userId || profile.auth_user_id),
    profileId: clean(profile.id),
    institutionId: platformAdmin ? "" : clean(context.institutionId || profile.institution_id),
    unitId: platformAdmin ? "" : clean(profile.unit_id),
    role,
    profile: Object.assign({}, profile, { role, status })
  };
}

function canManageInstitution(session) {
  return session.role === "platform_admin";
}

function canManageUnits(session) {
  return session.role === "platform_admin" || session.role === "municipal_admin";
}

function canManageUsers(session) {
  return session.role === "platform_admin" || session.role === "municipal_admin" || session.role === "gestor";
}

function canCancelInvites(session) {
  return session.role === "platform_admin" || session.role === "municipal_admin";
}

function allowedInviteRoles(session) {
  if (session.role === "platform_admin") return new Set(["municipal_admin", "gestor", "almoxarife", "funcionario", "leitura"]);
  if (session.role === "municipal_admin") return new Set(["gestor", "almoxarife", "funcionario", "leitura"]);
  if (session.role === "gestor") return new Set(["almoxarife", "funcionario", "leitura"]);
  return new Set();
}

function assertInstitutionScope(session, institutionId) {
  const id = clean(institutionId);
  if (!id) throw error(400, "institution_id_required");
  if (session.role !== "platform_admin" && session.institutionId !== id) throw error(403, "institution_scope_forbidden");
  return id;
}

function assertActorCanAssignRole(session, role) {
  const normalized = requireValidRole(role);
  if (!allowedInviteRoles(session).has(normalized)) throw error(403, "role_assignment_forbidden");
  return normalized;
}

function assertActorCanManageUser(session, user) {
  if (!user) throw error(404, "user_not_found");
  if (clean(user.auth_user_id || user.id) === clean(session.userId || session.profileId)) throw error(403, "self_management_forbidden");
  if (session.role === "platform_admin") return true;
  if (session.role === "municipal_admin") {
    if (["platform_admin", "municipal_admin"].includes(normalizeRole(user.role))) throw error(403, "user_level_forbidden");
    return true;
  }
  if (session.role === "gestor") {
    if (!["almoxarife", "funcionario", "leitura"].includes(normalizeRole(user.role))) throw error(403, "user_level_forbidden");
    if (session.unitId && clean(user.unit_id) && clean(user.unit_id) !== session.unitId) throw error(403, "unit_scope_forbidden");
    return true;
  }
  throw error(403, "user_management_forbidden");
}
async function assertUnitInInstitution(store, institutionId, unitId) {
  const id = clean(unitId);
  if (!id) return "";
  const unit = await store.get("units", id);
  if (!unit || clean(unit.institution_id) !== clean(institutionId) || !isActive(unit.status)) {
    throw error(400, "unit_scope_invalid");
  }
  return id;
}

async function findUser(store, userId) {
  const id = clean(userId);
  if (!id) throw error(400, "user_id_required");
  return await store.findOne("profiles", { auth_user_id: id }) || await store.get("profiles", id);
}

async function writeAudit(store, session, action, targetType, targetId, institutionId, metadata = {}) {
  await store.insert("municipal_admin_audit_log", {
    actor_user_id: clean(session && session.userId),
    institution_id: clean(institutionId || session && session.institutionId),
    target_type: targetType,
    target_id: clean(targetId),
    action,
    metadata: sanitizeMetadata(metadata) || {},
    created_at: nowIso()
  });
}

function cleanInstitutionPayload(body = {}, session = null, update = false) {
  const payload = {};
  if (!update || body.name !== undefined) {
    payload.name = clean(body.name);
    if (!payload.name) throw error(400, "institution_name_required");
  }
  if (body.document !== undefined) payload.document = clean(body.document);
  if (body.city !== undefined || !update) payload.city = clean(body.city);
  if (body.state !== undefined || !update) payload.state = clean(body.state).toUpperCase();
  if (body.status !== undefined) payload.status = activeStatus(body.status);
  else if (!update) payload.status = "active";
  if (!update) {
    payload.created_at = nowIso();
    payload.created_by = clean(session && session.userId);
  }
  return payload;
}

function cleanUnitPayload(body = {}, institutionId, update = false) {
  const payload = {};
  if (!update || body.name !== undefined) {
    payload.name = clean(body.name);
    if (!payload.name) throw error(400, "unit_name_required");
  }
  if (body.code !== undefined || !update) payload.code = clean(body.code || body.name);
  if (body.address !== undefined) payload.address = clean(body.address);
  if (body.status !== undefined) payload.status = activeStatus(body.status);
  else if (!update) payload.status = "active";
  if (!update) {
    payload.institution_id = clean(institutionId);
    payload.created_at = nowIso();
  }
  return payload;
}

export function createMunicipalAdminService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const getNow = options.now || (() => new Date());
  const makeToken = options.randomToken || randomToken;

  return {
    async createInstitution(context, body) {
      const session = sessionFromContext(context);
      if (!canManageInstitution(session)) throw error(403, "platform_admin_required");
      const institution = await store.insert("institutions", cleanInstitutionPayload(body, session));
      await writeAudit(store, session, "institution_created", "institution", institution.id, institution.id, { name: institution.name });
      return { institution };
    },

    async listInstitutions(context) {
      const session = sessionFromContext(context);
      if (session.role !== "platform_admin") throw error(403, "platform_admin_required");
      return { institutions: await store.list("institutions", {}) };
    },

    async getInstitution(context, institutionId) {
      const session = sessionFromContext(context);
      const id = assertInstitutionScope(session, institutionId);
      const institution = await store.get("institutions", id);
      if (!institution) throw error(404, "institution_not_found");
      return { institution };
    },

    async updateInstitution(context, institutionId, body) {
      const session = sessionFromContext(context);
      if (!canManageInstitution(session)) throw error(403, "platform_admin_required");
      const id = clean(institutionId);
      const current = await store.get("institutions", id);
      if (!current) throw error(404, "institution_not_found");
      const institution = await store.update("institutions", id, cleanInstitutionPayload(body, session, true));
      await writeAudit(store, session, "institution_updated", "institution", id, id, body);
      return { institution };
    },

    async deactivateInstitution(context, institutionId) {
      const session = sessionFromContext(context);
      if (!canManageInstitution(session)) throw error(403, "platform_admin_required");
      const id = clean(institutionId);
      const institution = await store.update("institutions", id, { status: "inactive" });
      if (!institution) throw error(404, "institution_not_found");
      await writeAudit(store, session, "institution_deactivated", "institution", id, id);
      return { institution };
    },

    async createUnit(context, institutionId, body) {
      const session = sessionFromContext(context);
      if (!canManageUnits(session)) throw error(403, "unit_management_forbidden");
      const id = assertInstitutionScope(session, institutionId);
      const institution = await store.get("institutions", id);
      if (!institution || !isActive(institution.status)) throw error(404, "institution_not_found");
      const unit = await store.insert("units", cleanUnitPayload(body, id));
      await writeAudit(store, session, "unit_created", "unit", unit.id, id, { name: unit.name, code: unit.code });
      return { unit };
    },

    async listUnits(context, institutionId) {
      const session = sessionFromContext(context);
      const id = assertInstitutionScope(session, institutionId);
      return { units: await store.list("units", { institution_id: id }) };
    },

    async updateUnit(context, unitId, body) {
      const session = sessionFromContext(context);
      if (!canManageUnits(session)) throw error(403, "unit_management_forbidden");
      const current = await store.get("units", unitId);
      if (!current) throw error(404, "unit_not_found");
      assertInstitutionScope(session, current.institution_id);
      const unit = await store.update("units", current.id, cleanUnitPayload(body, current.institution_id, true));
      await writeAudit(store, session, "unit_updated", "unit", unit.id, unit.institution_id, body);
      return { unit };
    },

    async deactivateUnit(context, unitId) {
      const session = sessionFromContext(context);
      if (!canManageUnits(session)) throw error(403, "unit_management_forbidden");
      const current = await store.get("units", unitId);
      if (!current) throw error(404, "unit_not_found");
      assertInstitutionScope(session, current.institution_id);
      const unit = await store.update("units", current.id, { status: "inactive" });
      await writeAudit(store, session, "unit_deactivated", "unit", unit.id, unit.institution_id);
      return { unit };
    },

    async createInvite(context, institutionId, body) {
      const session = sessionFromContext(context);
      if (!canManageUsers(session)) throw error(403, "invite_management_forbidden");
      const id = assertInstitutionScope(session, institutionId);
      const role = assertActorCanAssignRole(session, body && body.role);
      const unitId = await assertUnitInInstitution(store, id, body && (body.unit_id || body.unitId));
      if (session.role === "gestor" && session.unitId && unitId !== session.unitId) throw error(403, "unit_scope_forbidden");
      const email = lower(body && body.email);
      if (!email || !email.includes("@")) throw error(400, "invite_email_required");
      const token = makeToken();
      const expiresAt = clean(body && body.expires_at) || addDaysIso(7, getNow);
      const invite = await store.insert("municipal_admin_invites", {
        institution_id: id,
        unit_id: unitId || null,
        email,
        role,
        token_hash: hashToken(token),
        expires_at: expiresAt,
        accepted_at: null,
        invited_by: session.userId,
        status: "pending",
        created_at: nowIso(getNow)
      });
      await writeAudit(store, session, "invite_created", "invite", invite.id, id, { email, role, unit_id: unitId });
      return { invite: publicInvite(invite), invite_token: token };
    },

    async cancelInvite(context, inviteId) {
      const session = sessionFromContext(context);
      if (!canCancelInvites(session)) throw error(403, "invite_cancel_forbidden");
      const invite = await store.get("municipal_admin_invites", inviteId);
      if (!invite) throw error(404, "invite_not_found");
      assertInstitutionScope(session, invite.institution_id);
      if (!PENDING.has(lower(invite.status)) || invite.accepted_at) throw error(409, "invite_not_pending");
      const cancelled = await store.update("municipal_admin_invites", invite.id, { status: "cancelled" });
      await writeAudit(store, session, "invite_cancelled", "invite", invite.id, invite.institution_id, { email: invite.email, role: invite.role });
      return { invite: publicInvite(cancelled) };
    },

    async acceptInvite(token, authUser) {
      const raw = clean(token);
      if (!raw) throw error(400, "invite_token_required");
      const user = authUser && authUser.id ? authUser : null;
      if (!user) throw error(401, "authentication_required");
      const invite = await store.findOne("municipal_admin_invites", { token_hash: hashToken(raw), status: "pending" });
      if (!invite || !PENDING.has(lower(invite.status)) || invite.accepted_at) throw error(404, "invite_not_found");
      if (new Date(invite.expires_at).getTime() <= new Date(nowIso(getNow)).getTime()) throw error(410, "invite_expired");
      const institution = await store.get("institutions", invite.institution_id);
      if (!institution || !isActive(institution.status)) throw error(400, "institution_not_found");
      if (invite.unit_id) await assertUnitInInstitution(store, invite.institution_id, invite.unit_id);
      const existing = await store.findOne("profiles", { auth_user_id: clean(user.id) });
      if (existing && !isActive(existing.status)) throw error(403, "user_inactive");
      const profilePayload = {
        auth_user_id: clean(user.id),
        institution_id: invite.institution_id,
        unit_id: invite.unit_id || null,
        name: clean(user.user_metadata && (user.user_metadata.name || user.user_metadata.full_name)) || clean(user.email).split("@")[0] || "Usuario Municipal",
        email: lower(user.email || invite.email),
        role: invite.role,
        status: "active"
      };
      const profile = existing ? await store.update("profiles", existing.id, profilePayload) : await store.insert("profiles", Object.assign({ created_at: nowIso(getNow) }, profilePayload));
      const acceptedAt = nowIso(getNow);
      const accepted = await store.update("municipal_admin_invites", invite.id, { status: "accepted", accepted_at: acceptedAt });
      await writeAudit(store, { userId: clean(user.id), institutionId: invite.institution_id }, "invite_accepted", "invite", invite.id, invite.institution_id, { email: invite.email, role: invite.role });
      return { profile, invite: publicInvite(accepted) };
    },

    async listUsers(context, institutionId) {
      const session = sessionFromContext(context);
      const id = assertInstitutionScope(session, institutionId);
      return { users: await store.list("profiles", { institution_id: id }) };
    },

    async updateUserRole(context, userId, body) {
      const session = sessionFromContext(context);
      if (!canManageUsers(session)) throw error(403, "user_management_forbidden");
      const user = await findUser(store, userId);
      if (!user) throw error(404, "user_not_found");
      assertInstitutionScope(session, user.institution_id);
      assertActorCanManageUser(session, user);
      const role = assertActorCanAssignRole(session, body && body.role);
      const updated = await store.update("profiles", user.id, { role });
      await writeAudit(store, session, "user_role_updated", "user", clean(user.auth_user_id || user.id), user.institution_id, { role });
      return { user: updated };
    },

    async updateUserUnits(context, userId, body) {
      const session = sessionFromContext(context);
      if (!canManageUsers(session)) throw error(403, "user_management_forbidden");
      const user = await findUser(store, userId);
      if (!user) throw error(404, "user_not_found");
      assertInstitutionScope(session, user.institution_id);
      assertActorCanManageUser(session, user);
      const requested = body && (body.unit_id || body.unitId || (Array.isArray(body.unit_ids) ? body.unit_ids[0] : ""));
      if (Array.isArray(body && body.unit_ids) && body.unit_ids.length > 1) throw error(400, "single_unit_supported_in_mvp");
      const unitId = await assertUnitInInstitution(store, user.institution_id, requested);
      if (session.role === "gestor" && session.unitId && unitId !== session.unitId) throw error(403, "unit_scope_forbidden");
      const updated = await store.update("profiles", user.id, { unit_id: unitId || null });
      await writeAudit(store, session, "user_units_updated", "user", clean(user.auth_user_id || user.id), user.institution_id, { unit_id: unitId });
      return { user: updated, units: unitId ? [unitId] : [] };
    },

    async deactivateUser(context, userId) {
      const session = sessionFromContext(context);
      if (!canManageUsers(session)) throw error(403, "user_management_forbidden");
      const user = await findUser(store, userId);
      if (!user) throw error(404, "user_not_found");
      assertInstitutionScope(session, user.institution_id);
      assertActorCanManageUser(session, user);
      const updated = await store.update("profiles", user.id, { status: "inactive" });
      await writeAudit(store, session, "user_deactivated", "user", clean(user.auth_user_id || user.id), user.institution_id);
      return { user: updated };
    },

    async me(context) {
      const session = sessionFromContext(context);
      const units = session.institutionId ? await store.list("units", { institution_id: session.institutionId }) : [];
      return {
        me: {
          user_id: session.userId,
          institution_id: session.institutionId,
          unit_id: session.unitId || null,
          role: session.role,
          status: session.profile.status,
          allowed_units: session.unitId ? units.filter((unit) => unit.id === session.unitId) : units
        }
      };
    }
  };
}

export function createSupabaseMunicipalAdminStore(database) {
  if (!database || typeof database.from !== "function") throw error(503, "municipal_admin_database_not_configured");
  return {
    async list(table, filters = {}) {
      let query = database.from(table).select("*");
      for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== null && value !== "") query = query.eq(key, value);
      if (typeof query.order === "function") query = query.order("created_at", { ascending: false });
      const { data, error: err } = await query;
      if (err) throw err;
      return data || [];
    },
    async get(table, id) {
      if (!clean(id)) return null;
      const { data, error: err } = await database.from(table).select("*").eq("id", clean(id)).maybeSingle();
      if (err) throw err;
      return data || null;
    },
    async findOne(table, filters = {}) {
      let query = database.from(table).select("*");
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
      const { data, error: err } = await query.maybeSingle();
      if (err) throw err;
      return data || null;
    },
    async insert(table, payload) {
      const { data, error: err } = await database.from(table).insert(payload).select("*").single();
      if (err) throw err;
      return data;
    },
    async update(table, id, patch) {
      const { data, error: err } = await database.from(table).update(patch).eq("id", clean(id)).select("*").single();
      if (err) throw err;
      return data || null;
    }
  };
}

export function createMemoryMunicipalAdminStore(seed = {}) {
  const tables = {
    institutions: [],
    units: [],
    profiles: [],
    municipal_admin_invites: [],
    municipal_admin_audit_log: [],
    ...(seed || {})
  };
  let counter = 1;
  function copy(row) { return row ? JSON.parse(JSON.stringify(row)) : null; }
  function ensure(table) { if (!tables[table]) tables[table] = []; return tables[table]; }
  function matches(row, filters) { return Object.entries(filters || {}).every(([key, value]) => row[key] === value); }
  return {
    tables,
    async list(table, filters = {}) { return ensure(table).filter((row) => matches(row, filters)).map(copy); },
    async get(table, id) { return copy(ensure(table).find((row) => row.id === clean(id))); },
    async findOne(table, filters = {}) { return copy(ensure(table).find((row) => matches(row, filters))); },
    async insert(table, payload) {
      const row = Object.assign({ id: table.replace(/s$/,"_") + counter++ }, copy(payload));
      ensure(table).push(row);
      return copy(row);
    },
    async update(table, id, patch) {
      const rows = ensure(table);
      const index = rows.findIndex((row) => row.id === clean(id));
      if (index < 0) return null;
      rows[index] = Object.assign({}, rows[index], copy(patch));
      return copy(rows[index]);
    }
  };
}

export function toMunicipalAdminHttpError(err) {
  return {
    status: err && err.status ? err.status : 500,
    error: clean(err && (err.code || err.message)) || "municipal_admin_error"
  };
}

export const municipalAdminInternals = { hashToken, sessionFromContext, sanitizeMetadata };

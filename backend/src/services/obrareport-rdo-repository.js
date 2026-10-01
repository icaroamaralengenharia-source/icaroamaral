import { createHash, randomUUID } from "node:crypto";

const TABLE = "obrareport_rdos";
const EVENTS_TABLE = "obrareport_rdo_events";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function contextOf(context = {}) {
  const safe = objectOf(context);
  const profile = objectOf(safe.profile);
  return {
    institutionId: clean(profile.institution_id || profile.institutionId || safe.institution_id || safe.institutionId),
    userId: clean(safe.userId || safe.user_id || profile.auth_user_id || profile.user_id || profile.userId || profile.id)
  };
}

function requireInstitution(context) {
  const resolved = contextOf(context);
  if (!resolved.institutionId) throw Object.assign(new Error("institution_required"), { status: 400 });
  return resolved;
}

function requirePayloadObject(value, code) {
  const safe = objectOf(value);
  if (!Object.keys(safe).length) throw Object.assign(new Error(code), { status: 400 });
  return safe;
}

function databaseError(code, cause) {
  return Object.assign(new Error(code), { status: 503, cause });
}

function notFound() {
  return Object.assign(new Error("rdo_not_found"), { status: 404 });
}

function idempotencyKey(payload, rdoData) {
  return clean(payload.idempotencyKey || payload.idempotency_key || rdoData.operationId || rdoData.operation_id);
}

function deterministicId(institutionId, key) {
  const digest = createHash("sha256").update(`${institutionId}:${key}`, "utf8").digest("hex").slice(0, 24);
  return `obr_rdo_${digest}`;
}

function eventId() {
  return `obr_rdo_event_${randomUUID()}`;
}

function rowFromPayload(context, payload, existing = null) {
  const ctx = requireInstitution(context);
  const safe = objectOf(payload);
  const rdoData = requirePayloadObject(safe.rdoData || safe.rdo_data || safe.rdo_data_json || existing?.rdo_data_json, "rdo_data_required");
  const key = idempotencyKey(safe, rdoData);
  if (!key && !existing) throw Object.assign(new Error("rdo_idempotency_key_required"), { status: 400 });
  const now = new Date().toISOString();
  return {
    id: existing?.id || deterministicId(ctx.institutionId, key),
    institution_id: ctx.institutionId,
    project_id: clean(safe.projectId || safe.project_id || existing?.project_id) || null,
    client_id: clean(safe.clientId || safe.client_id || existing?.client_id) || null,
    title: clean(safe.title || rdoData.title || rdoData.summary || existing?.title) || "RDO",
    rdo_date: clean(safe.rdoDate || safe.rdo_date || rdoData.date || existing?.rdo_date) || null,
    status: clean(safe.status || existing?.status) || "draft",
    rdo_data_json: rdoData,
    created_by: existing?.created_by || ctx.userId || null,
    updated_by: ctx.userId || existing?.updated_by || null,
    created_at: existing?.created_at || now,
    updated_at: now
  };
}

export function createSupabaseRdoRepository({ client } = {}) {
  if (!client || typeof client.from !== "function") throw new Error("rdo_supabase_store_not_configured");

  async function findById(context, id) {
    const ctx = requireInstitution(context);
    const result = await client.from(TABLE).select("*").eq("id", clean(id)).eq("institution_id", ctx.institutionId).maybeSingle();
    if (result.error) throw databaseError("rdo_read_failed", result.error);
    return result.data || null;
  }

  async function insertEvent(context, id, type, payload = {}) {
    const ctx = requireInstitution(context);
    const result = await client.from(EVENTS_TABLE).insert({
      id: eventId(),
      rdo_id: clean(id),
      institution_id: ctx.institutionId,
      event_type: clean(type),
      user_id: ctx.userId || null,
      payload_json: objectOf(payload),
      created_at: new Date().toISOString()
    }).select("*").single();
    if (result.error) throw databaseError("rdo_event_persistence_failed", result.error);
    return result.data;
  }

  return {
    mode: "supabase",
    async create(context, payload = {}) {
      const ctx = requireInstitution(context);
      const safe = objectOf(payload);
      const rdoData = requirePayloadObject(safe.rdoData || safe.rdo_data || safe.rdo_data_json, "rdo_data_required");
      const key = idempotencyKey(safe, rdoData);
      if (!key) throw Object.assign(new Error("rdo_idempotency_key_required"), { status: 400 });
      const id = deterministicId(ctx.institutionId, key);
      const existing = await findById(ctx, id);
      if (existing) return existing;
      const row = rowFromPayload(ctx, safe);
      const inserted = await client.from(TABLE).insert(row).select("*").single();
      if (inserted.error) {
        const raced = await findById(ctx, id);
        if (raced) return raced;
        throw databaseError("rdo_create_persistence_failed", inserted.error);
      }
      await insertEvent(ctx, inserted.data.id, "rdo_created", { title: inserted.data.title });
      return inserted.data;
    },

    async list(context, filters = {}) {
      const ctx = requireInstitution(context);
      const safe = objectOf(filters);
      let query = client.from(TABLE).select("*").eq("institution_id", ctx.institutionId);
      const projectId = clean(safe.projectId || safe.project_id);
      const clientId = clean(safe.clientId || safe.client_id);
      if (projectId) query = query.eq("project_id", projectId);
      if (clientId) query = query.eq("client_id", clientId);
      const result = await query.order("updated_at", { ascending: false });
      if (result.error) throw databaseError("rdo_list_failed", result.error);
      return Array.isArray(result.data) ? result.data : [];
    },

    async getById(context, id) {
      const row = await findById(context, id);
      if (!row) throw notFound();
      return row;
    },

    async update(context, id, payload = {}) {
      const ctx = requireInstitution(context);
      const current = await this.getById(ctx, id);
      const safe = objectOf(payload);
      const nextData = requirePayloadObject(safe.rdoData || safe.rdo_data || safe.rdo_data_json || current.rdo_data_json, "rdo_data_required");
      const key = idempotencyKey(safe, nextData);
      const currentKey = idempotencyKey({}, objectOf(current.rdo_data_json));
      if (key && key === currentKey && JSON.stringify(nextData) === JSON.stringify(current.rdo_data_json)) return current;
      const row = rowFromPayload(ctx, Object.assign({}, safe, { rdoData: nextData }), current);
      const result = await client.from(TABLE).update({
        project_id: row.project_id,
        client_id: row.client_id,
        title: row.title,
        rdo_date: row.rdo_date,
        status: row.status,
        rdo_data_json: row.rdo_data_json,
        updated_by: row.updated_by,
        updated_at: row.updated_at
      }).eq("id", clean(id)).eq("institution_id", ctx.institutionId).select("*").maybeSingle();
      if (result.error) throw databaseError("rdo_update_persistence_failed", result.error);
      if (!result.data) throw notFound();
      await insertEvent(ctx, result.data.id, "rdo_updated", { status: result.data.status });
      return result.data;
    },

    async createVersion(context, id) {
      const ctx = requireInstitution(context);
      const current = await this.getById(ctx, id);
      const latest = await client.from("obrareport_rdo_versions").select("version_number").eq("rdo_id", current.id).eq("institution_id", ctx.institutionId).order("version_number", { ascending: false }).limit(1);
      if (latest.error) throw databaseError("rdo_version_read_failed", latest.error);
      const versionNumber = Number(latest.data?.[0]?.version_number || 0) + 1;
      const result = await client.from("obrareport_rdo_versions").insert({
        id: `obr_rdo_version_${randomUUID()}`,
        rdo_id: current.id,
        institution_id: ctx.institutionId,
        version_number: versionNumber,
        rdo_data_json: objectOf(current.rdo_data_json),
        created_by: ctx.userId || null,
        created_at: new Date().toISOString()
      }).select("*").single();
      if (result.error) throw databaseError("rdo_version_persistence_failed", result.error);
      return result.data;
    },

    async listEvents(context, id) {
      const ctx = requireInstitution(context);
      await this.getById(ctx, id);
      const result = await client.from(EVENTS_TABLE).select("*").eq("rdo_id", clean(id)).eq("institution_id", ctx.institutionId).order("created_at", { ascending: true });
      if (result.error) throw databaseError("rdo_events_read_failed", result.error);
      return Array.isArray(result.data) ? result.data : [];
    }
  };
}

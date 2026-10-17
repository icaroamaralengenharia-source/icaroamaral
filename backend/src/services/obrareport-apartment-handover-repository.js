import { createHash, randomUUID } from "node:crypto";

const TABLE = "obrareport_apartment_handover_inspections";
const VERSIONS_TABLE = "obrareport_apartment_handover_inspection_versions";
const EVENTS_TABLE = "obrareport_apartment_handover_inspection_events";
const SOURCE_TYPE = "apartment_handover_inspection";
const STATUSES = new Set(["draft", "completed", "final_pdf_generated", "archived"]);
const ITEM_STATUSES = new Set(["C", "NC", "NA", "NV", "NI"]);
const SEVERITIES = new Set(["critica", "alta", "media", "baixa"]);

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function objectOf(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function clone(value) { return JSON.parse(JSON.stringify(value === undefined ? null : value)); }
function contextOf(context = {}) {
  const safe = objectOf(context);
  const profile = objectOf(safe.profile);
  return {
    institutionId: clean(profile.institution_id || profile.institutionId || safe.institution_id || safe.institutionId),
    userId: clean(profile.id || profile.auth_user_id || safe.userId || safe.user_id)
  };
}
function requireInstitution(context) {
  const ctx = contextOf(context);
  if (!ctx.institutionId) throw Object.assign(new Error("institution_required"), { status: 400 });
  return ctx;
}
function databaseError(code, cause) { return Object.assign(new Error(code), { status: 503, cause }); }
function requirePayload(value, code) {
  const safe = objectOf(value);
  if (!Object.keys(safe).length) throw Object.assign(new Error(code), { status: 400 });
  return safe;
}
function statusOf(value) {
  const status = clean(value || "draft");
  if (!STATUSES.has(status)) throw Object.assign(new Error("inspection_status_invalid"), { status: 400 });
  return status;
}
function idempotencyOf(payload, data) {
  const safe = objectOf(payload);
  const inspection = objectOf(data);
  return clean(safe.idempotencyKey || safe.idempotency_key || safe.operationId || safe.operation_id || inspection.idempotencyKey || inspection.operationId);
}
function deterministicId(institutionId, key) {
  return "obr_ahi_" + createHash("sha256").update(institutionId + ":" + key, "utf8").digest("hex").slice(0, 24);
}
function itemContainer(data) {
  if (Array.isArray(data.items)) return { parent: data, key: "items" };
  if (data.inspection && Array.isArray(data.inspection.items)) return { parent: data.inspection, key: "items" };
  if (data.report && data.report.inspection && Array.isArray(data.report.inspection.items)) return { parent: data.report.inspection, key: "items" };
  return null;
}
function normalized(value) { return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function resolveItem(data, payload) {
  const container = itemContainer(data);
  if (!container) throw Object.assign(new Error("inspection_items_required"), { status: 400 });
  const safe = objectOf(payload);
  const itemId = clean(safe.itemId || safe.item_id || safe.inspectionItemId || safe.inspection_item_id);
  const environment = normalized(safe.environment || safe.ambiente || safe.environmentId || safe.environment_id);
  const system = normalized(safe.system || safe.sistema || safe.systemId || safe.system_id);
  const itemText = normalized(safe.item || safe.itemName || safe.item_name || safe.title);
  const matches = container.parent[container.key].map((item, index) => ({ item, index })).filter(({ item }) => {
    if (itemId) return clean(item.id || item.itemId || item.inspectionItemId) === itemId;
    if (environment && normalized(item.environment || item.ambiente || item.environmentId) !== environment) return false;
    if (system && normalized(item.system || item.sistema || item.systemId) !== system) return false;
    if (!itemText) return Boolean(environment || system);
    const candidate = normalized(item.item || item.title || item.name || item.id);
    return candidate === itemText || candidate.includes(itemText) || itemText.includes(candidate);
  });
  if (!matches.length) throw Object.assign(new Error("inspection_item_not_found"), { status: 404 });
  if (matches.length > 1) throw Object.assign(new Error("inspection_item_ambiguous"), { status: 409 });
  return { container, ...matches[0] };
}
function rowFromPayload(context, payload, existing = null) {
  const ctx = requireInstitution(context);
  const safe = objectOf(payload);
  const data = requirePayload(safe.inspectionData || safe.inspection_data || safe.inspection_data_json || existing?.inspection_data_json, "inspection_data_required");
  const sourceType = clean(safe.sourceType || safe.source_type || existing?.source_type || SOURCE_TYPE);
  if (sourceType !== SOURCE_TYPE) throw Object.assign(new Error("inspection_source_type_invalid"), { status: 400 });
  const key = idempotencyOf(safe, data);
  const now = new Date().toISOString();
  const metadata = objectOf(data.metadata);
  return {
    id: existing?.id || deterministicId(ctx.institutionId, key),
    institution_id: ctx.institutionId,
    project_id: clean(safe.projectId || safe.project_id || existing?.project_id) || null,
    client_id: clean(safe.clientId || safe.client_id || existing?.client_id) || null,
    title: clean(safe.title || metadata.projectName || existing?.title) || "Vistoria de Entrega",
    unit: clean(safe.unit || safe.unidade || metadata.unitName || existing?.unit) || null,
    inspection_date: clean(safe.inspectionDate || safe.inspection_date || metadata.inspectionDate || existing?.inspection_date) || null,
    status: statusOf(safe.status || data.status || existing?.status),
    source_type: SOURCE_TYPE,
    source_id: clean(safe.sourceId || safe.source_id || existing?.source_id) || null,
    idempotency_key: key || existing?.idempotency_key || null,
    inspection_data_json: data,
    created_by: existing?.created_by || ctx.userId || null,
    updated_by: ctx.userId || existing?.updated_by || null,
    created_at: existing?.created_at || now,
    updated_at: now,
    completed_at: clean(safe.completedAt || safe.completed_at || data.completedAt || existing?.completed_at) || null,
    reopened_at: clean(safe.reopenedAt || safe.reopened_at || data.reopenedAt || existing?.reopened_at) || null
  };
}

export function createSupabaseApartmentHandoverRepository({ client } = {}) {
  if (!client || typeof client.from !== "function") throw new Error("apartment_handover_supabase_store_not_configured");
  async function findById(context, id) {
    const ctx = requireInstitution(context);
    const result = await client.from(TABLE).select("*").eq("id", clean(id)).eq("institution_id", ctx.institutionId).maybeSingle();
    if (result.error) throw databaseError("inspection_read_failed", result.error);
    return result.data || null;
  }
  async function event(context, id, type, payload = {}) {
    const ctx = requireInstitution(context);
    const result = await client.from(EVENTS_TABLE).insert({ id: "obr_ahi_event_" + randomUUID(), inspection_id: clean(id), institution_id: ctx.institutionId, event_type: clean(type), user_id: ctx.userId || null, payload_json: objectOf(payload), created_at: new Date().toISOString() }).select("*").single();
    if (result.error) throw databaseError("inspection_event_persistence_failed", result.error);
    return result.data;
  }
  async function currentOrNotFound(context, id) {
    const row = await findById(context, id);
    if (!row) throw Object.assign(new Error("inspection_not_found"), { status: 404 });
    return row;
  }
  return {
    mode: "supabase",
    async create(context, payload = {}) {
      const ctx = requireInstitution(context);
      const safe = objectOf(payload);
      const data = requirePayload(safe.inspectionData || safe.inspection_data || safe.inspection_data_json, "inspection_data_required");
      const key = idempotencyOf(safe, data);
      if (!key) throw Object.assign(new Error("inspection_idempotency_key_required"), { status: 400 });
      const id = deterministicId(ctx.institutionId, key);
      const existing = await findById(ctx, id);
      if (existing) return existing;
      const inserted = await client.from(TABLE).insert(rowFromPayload(ctx, safe)).select("*").single();
      if (inserted.error) {
        const raced = await findById(ctx, id);
        if (raced) return raced;
        throw databaseError("inspection_create_persistence_failed", inserted.error);
      }
      await event(ctx, inserted.data.id, "inspection_created", { title: inserted.data.title });
      return inserted.data;
    },
    async list(context, filters = {}) {
      const ctx = requireInstitution(context);
      const safe = objectOf(filters);
      let query = client.from(TABLE).select("*").eq("institution_id", ctx.institutionId);
      const projectId = clean(safe.projectId || safe.project_id);
      if (projectId) query = query.eq("project_id", projectId);
      const status = clean(safe.status);
      if (status) query = query.eq("status", statusOf(status));
      const result = await query.order("updated_at", { ascending: false });
      if (result.error) throw databaseError("inspection_list_failed", result.error);
      return Array.isArray(result.data) ? result.data : [];
    },
    async getById(context, id) { return currentOrNotFound(context, id); },
    async update(context, id, payload = {}) {
      const ctx = requireInstitution(context);
      const current = await currentOrNotFound(ctx, id);
      const row = rowFromPayload(ctx, Object.assign({}, payload, { inspectionData: payload.inspectionData || payload.inspection_data || payload.inspection_data_json || current.inspection_data_json }), current);
      const result = await client.from(TABLE).update({ project_id: row.project_id, client_id: row.client_id, title: row.title, unit: row.unit, inspection_date: row.inspection_date, status: row.status, inspection_data_json: row.inspection_data_json, updated_by: row.updated_by, updated_at: row.updated_at, completed_at: row.completed_at, reopened_at: row.reopened_at }).eq("id", clean(id)).eq("institution_id", ctx.institutionId).select("*").maybeSingle();
      if (result.error) throw databaseError("inspection_update_persistence_failed", result.error);
      if (!result.data) throw Object.assign(new Error("inspection_not_found"), { status: 404 });
      await event(ctx, id, "inspection_updated", { status: result.data.status });
      return result.data;
    },
    async updateItem(context, id, payload = {}) {
      const current = await currentOrNotFound(context, id);
      const data = clone(current.inspection_data_json || {});
      const resolved = resolveItem(data, payload);
      const next = Object.assign({}, resolved.item);
      if (payload.status !== undefined) {
        const status = clean(payload.status).toUpperCase();
        if (!ITEM_STATUSES.has(status)) throw Object.assign(new Error("inspection_item_status_invalid"), { status: 400 });
        next.status = status;
      }
      if (payload.severity !== undefined || payload.severidade !== undefined) {
        const severity = normalized(payload.severity || payload.severidade);
        if (severity && !SEVERITIES.has(severity)) throw Object.assign(new Error("inspection_item_severity_invalid"), { status: 400 });
        next.severidade = severity;
      }
      if (payload.notes !== undefined || payload.observation !== undefined || payload.observacao !== undefined || payload.descricaoTecnica !== undefined) next.descricaoTecnica = clean(payload.notes || payload.observation || payload.observacao || payload.descricaoTecnica);
      if (payload.photo || payload.foto || payload.evidence || payload.evidencia) next.fotos = (Array.isArray(next.fotos) ? next.fotos : []).concat([payload.photo || payload.foto || payload.evidence || payload.evidencia]);
      data[resolved.container.key][resolved.index] = next;
      const result = await this.update(context, id, { inspectionData: data, status: current.status });
      await event(context, id, payload.photo || payload.foto || payload.evidence || payload.evidencia ? "inspection_photo_attached" : "inspection_item_updated", { itemId: clean(next.id || payload.itemId || payload.item_id) });
      return result;
    },
    async attachPhoto(context, id, payload = {}) {
      const photo = payload.photo || payload.foto || payload.evidence || payload.evidencia;
      if (!photo || !Object.keys(objectOf(photo)).length) throw Object.assign(new Error("inspection_photo_required"), { status: 400 });
      return this.updateItem(context, id, Object.assign({}, payload, { photo }));
    },
    async createVersion(context, id) {
      const ctx = requireInstitution(context);
      const current = await currentOrNotFound(ctx, id);
      const latest = await client.from(VERSIONS_TABLE).select("version_number").eq("inspection_id", current.id).eq("institution_id", ctx.institutionId).order("version_number", { ascending: false }).limit(1);
      if (latest.error) throw databaseError("inspection_version_read_failed", latest.error);
      const version = await client.from(VERSIONS_TABLE).insert({ id: "obr_ahi_version_" + randomUUID(), inspection_id: current.id, institution_id: ctx.institutionId, version_number: Number(latest.data?.[0]?.version_number || 0) + 1, inspection_data_json: objectOf(current.inspection_data_json), created_by: ctx.userId || null, created_at: new Date().toISOString() }).select("*").single();
      if (version.error) throw databaseError("inspection_version_persistence_failed", version.error);
      await event(ctx, id, "inspection_version_created", { versionId: version.data.id, versionNumber: version.data.version_number });
      return version.data;
    },
    async listEvents(context, id) {
      const ctx = requireInstitution(context);
      await currentOrNotFound(ctx, id);
      const result = await client.from(EVENTS_TABLE).select("*").eq("inspection_id", clean(id)).eq("institution_id", ctx.institutionId).order("created_at", { ascending: true });
      if (result.error) throw databaseError("inspection_events_read_failed", result.error);
      return Array.isArray(result.data) ? result.data : [];
    }
  };
}

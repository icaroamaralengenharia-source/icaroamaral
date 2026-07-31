import { createSupabaseMunicipalAdminStore, municipalAdminInternals, toMunicipalAdminHttpError } from "./municipal-admin-service.js";

const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "leitura"]);
const WRITE_ROLES = new Set(["platform_admin", "municipal_admin", "gestor"]);
const CONDITIONS = new Set(["novo", "bom", "regular", "ruim", "inservivel"]);
const STATUSES = new Set(["ativo", "em_manutencao", "transferido", "baixado"]);
const SENSITIVE_KEY = /token|secret|password|senha|authorization|bearer|service_role|storage_path|storagePath/i;

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function makeError(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function nowIso(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sanitize(value, depth = 0) {
  if (depth > 5) return null;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key) || key === "project_id" || key === "projectId") continue;
    out[key] = sanitize(item, depth + 1);
  }
  return out;
}

function numberOrNull(value) {
  if (value === undefined || value === null || clean(value) === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw makeError(400, "asset_value_invalid");
  return parsed;
}

function validCondition(value) {
  const condition = lower(value || "bom");
  if (!CONDITIONS.has(condition)) throw makeError(400, "asset_condition_invalid");
  return condition;
}

function validStatus(value) {
  const status = lower(value || "ativo");
  if (!STATUSES.has(status)) throw makeError(400, "asset_status_invalid");
  return status;
}

async function resolveInstitution(store, session, requestedInstitutionId) {
  if (session.role === "platform_admin") {
    const id = clean(requestedInstitutionId);
    if (!id) throw makeError(400, "institution_id_required");
    const institution = await store.get("institutions", id);
    if (!institution) throw makeError(404, "institution_not_found");
    return id;
  }
  const id = clean(session.institutionId);
  if (!id) throw makeError(403, "institution_scope_forbidden");
  if (requestedInstitutionId && clean(requestedInstitutionId) !== id) throw makeError(403, "institution_scope_forbidden");
  const institution = await store.get("institutions", id);
  if (!institution) throw makeError(404, "institution_not_found");
  return id;
}

async function resolveUnit(store, session, institutionId, requestedUnitId) {
  const id = clean(requestedUnitId || (session.role === "gestor" ? session.unitId : ""));
  if (!id) throw makeError(400, "unit_id_required");
  const unit = await store.get("units", id);
  if (!unit || clean(unit.institution_id) !== clean(institutionId)) throw makeError(403, "unit_scope_forbidden");
  if (session.role === "gestor" && clean(session.unitId) !== id) throw makeError(403, "unit_scope_forbidden");
  return id;
}

async function assertUniqueAssetTag(store, institutionId, assetTag, currentId = "") {
  const existing = await store.findOne("municipal_assets", { institution_id: institutionId, asset_tag: assetTag });
  if (existing && clean(existing.id) !== clean(currentId)) throw makeError(409, "asset_tag_duplicate");
}

function cleanAssetPayload(body = {}, options = {}) {
  const payload = {};
  if (!options.patch || body.asset_tag !== undefined || body.assetTag !== undefined) {
    payload.asset_tag = clean(body.asset_tag || body.assetTag);
    if (!payload.asset_tag) throw makeError(400, "asset_tag_required");
  }
  if (!options.patch || body.name !== undefined) {
    payload.name = clean(body.name);
    if (!payload.name) throw makeError(400, "asset_name_required");
  }
  if (body.description !== undefined || !options.patch) payload.description = clean(body.description);
  if (body.category !== undefined || !options.patch) payload.category = clean(body.category);
  if (body.brand !== undefined || !options.patch) payload.brand = clean(body.brand);
  if (body.model !== undefined || !options.patch) payload.model = clean(body.model);
  if (body.serial_number !== undefined || body.serialNumber !== undefined || !options.patch) payload.serial_number = clean(body.serial_number || body.serialNumber);
  if (body.acquisition_date !== undefined || body.acquisitionDate !== undefined || !options.patch) payload.acquisition_date = clean(body.acquisition_date || body.acquisitionDate) || null;
  if (body.acquisition_value !== undefined || body.acquisitionValue !== undefined || !options.patch) payload.acquisition_value = numberOrNull(body.acquisition_value ?? body.acquisitionValue);
  if (body.condition !== undefined || !options.patch) payload.condition = validCondition(body.condition);
  if (body.status !== undefined || !options.patch) payload.status = validStatus(body.status);
  if (body.location !== undefined || !options.patch) payload.location = clean(body.location);
  if (body.responsible_user_id !== undefined || body.responsibleUserId !== undefined || !options.patch) payload.responsible_user_id = clean(body.responsible_user_id || body.responsibleUserId) || null;
  return payload;
}

function publicAsset(asset) {
  return sanitize(asset);
}

function publicHistory(row) {
  return sanitize(row);
}

async function writeAudit(store, session, action, asset, metadata = {}) {
  await store.insert("municipal_admin_audit_log", {
    actor_user_id: clean(session.userId),
    institution_id: clean(asset.institution_id),
    target_type: "municipal_asset",
    target_id: clean(asset.id),
    action,
    metadata: municipalAdminInternals.sanitizeMetadata(metadata) || {},
    created_at: nowIso()
  });
}

async function writeHistory(store, session, asset, action, metadata = {}, now = () => new Date()) {
  const row = await store.insert("municipal_asset_history", {
    asset_id: clean(asset.id),
    institution_id: clean(asset.institution_id),
    unit_id: clean(asset.unit_id),
    action,
    actor_user_id: clean(session.userId),
    metadata: municipalAdminInternals.sanitizeMetadata(metadata) || {},
    created_at: nowIso(now)
  });
  return row;
}

function assertAssetScope(session, asset) {
  if (!asset) throw makeError(404, "asset_not_found");
  if (session.role !== "platform_admin" && clean(asset.institution_id) !== clean(session.institutionId)) throw makeError(403, "institution_scope_forbidden");
  if (session.role === "gestor" && clean(asset.unit_id) !== clean(session.unitId)) throw makeError(403, "unit_scope_forbidden");
  return asset;
}

export function createMunicipalAssetService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const now = options.now || (() => new Date());

  return {
    async createAsset(context, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!WRITE_ROLES.has(session.role)) throw makeError(403, "asset_write_forbidden");
      const institutionId = await resolveInstitution(store, session, body.institution_id || body.institutionId);
      const unitId = await resolveUnit(store, session, institutionId, body.unit_id || body.unitId);
      const payload = cleanAssetPayload(body);
      await assertUniqueAssetTag(store, institutionId, payload.asset_tag);
      const asset = await store.insert("municipal_assets", Object.assign(payload, {
        institution_id: institutionId,
        unit_id: unitId,
        created_by: clean(session.userId),
        created_at: nowIso(now),
        updated_at: nowIso(now)
      }));
      await writeHistory(store, session, asset, "asset_created", { asset_tag: asset.asset_tag }, now);
      await writeAudit(store, session, "asset_created", asset, { asset_tag: asset.asset_tag, unit_id: unitId });
      return { asset: publicAsset(asset) };
    },

    async listAssets(context, query = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!READ_ROLES.has(session.role)) throw makeError(403, "asset_access_forbidden");
      const institutionId = await resolveInstitution(store, session, query.institution_id || query.institutionId);
      const requestedUnit = clean(query.unit_id || query.unitId);
      const unitId = requestedUnit || (session.role === "gestor" ? clean(session.unitId) : "");
      if (unitId) await resolveUnit(store, session, institutionId, unitId);
      let assets = await store.list("municipal_assets", unitId ? { institution_id: institutionId, unit_id: unitId } : { institution_id: institutionId });
      if (query.status) assets = assets.filter((item) => lower(item.status) === lower(query.status));
      if (query.condition) assets = assets.filter((item) => lower(item.condition) === lower(query.condition));
      if (query.asset_tag || query.assetTag) assets = assets.filter((item) => clean(item.asset_tag) === clean(query.asset_tag || query.assetTag));
      return { assets: assets.map(publicAsset) };
    },

    async getAsset(context, assetId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!READ_ROLES.has(session.role)) throw makeError(403, "asset_access_forbidden");
      const asset = assertAssetScope(session, await store.get("municipal_assets", assetId));
      return { asset: publicAsset(asset) };
    },

    async updateAsset(context, assetId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!WRITE_ROLES.has(session.role)) throw makeError(403, "asset_write_forbidden");
      const asset = assertAssetScope(session, await store.get("municipal_assets", assetId));
      const patch = cleanAssetPayload(body, { patch: true });
      if (body.unit_id !== undefined || body.unitId !== undefined) patch.unit_id = await resolveUnit(store, session, asset.institution_id, body.unit_id || body.unitId);
      if (patch.asset_tag) await assertUniqueAssetTag(store, asset.institution_id, patch.asset_tag, asset.id);
      patch.updated_at = nowIso(now);
      const updated = await store.update("municipal_assets", asset.id, patch);
      await writeHistory(store, session, updated || asset, "asset_updated", { fields: Object.keys(patch) }, now);
      await writeAudit(store, session, "asset_updated", updated || asset, { fields: Object.keys(patch) });
      return { asset: publicAsset(updated || asset) };
    },

    async transferAsset(context, assetId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!WRITE_ROLES.has(session.role)) throw makeError(403, "asset_write_forbidden");
      const asset = assertAssetScope(session, await store.get("municipal_assets", assetId));
      const toUnitId = await resolveUnit(store, session, asset.institution_id, body.to_unit_id || body.toUnitId || body.unit_id || body.unitId);
      const updated = await store.update("municipal_assets", asset.id, { unit_id: toUnitId, status: "transferido", location: clean(body.location || asset.location), updated_at: nowIso(now) });
      await writeHistory(store, session, updated || asset, "asset_transferred", { from_unit_id: asset.unit_id, to_unit_id: toUnitId, reason: clean(body.reason) }, now);
      await writeAudit(store, session, "asset_transferred", updated || asset, { from_unit_id: asset.unit_id, to_unit_id: toUnitId });
      return { asset: publicAsset(updated || asset) };
    },

    async registerMaintenance(context, assetId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!WRITE_ROLES.has(session.role)) throw makeError(403, "asset_write_forbidden");
      const asset = assertAssetScope(session, await store.get("municipal_assets", assetId));
      const updated = await store.update("municipal_assets", asset.id, { status: "em_manutencao", condition: body.condition ? validCondition(body.condition) : asset.condition, updated_at: nowIso(now) });
      await writeHistory(store, session, updated || asset, "asset_maintenance_registered", { note: clean(body.note || body.description), cost: numberOrNull(body.cost) }, now);
      await writeAudit(store, session, "asset_maintenance_registered", updated || asset, { note: clean(body.note || body.description) });
      return { asset: publicAsset(updated || asset) };
    },

    async deactivateAsset(context, assetId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!WRITE_ROLES.has(session.role)) throw makeError(403, "asset_write_forbidden");
      const asset = assertAssetScope(session, await store.get("municipal_assets", assetId));
      const updated = await store.update("municipal_assets", asset.id, { status: "baixado", condition: body.condition ? validCondition(body.condition) : asset.condition, updated_at: nowIso(now) });
      await writeHistory(store, session, updated || asset, "asset_deactivated", { reason: clean(body.reason) }, now);
      await writeAudit(store, session, "asset_deactivated", updated || asset, { reason: clean(body.reason) });
      return { asset: publicAsset(updated || asset) };
    },

    async getAssetHistory(context, assetId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!READ_ROLES.has(session.role)) throw makeError(403, "asset_access_forbidden");
      const asset = assertAssetScope(session, await store.get("municipal_assets", assetId));
      const history = await store.list("municipal_asset_history", { asset_id: asset.id });
      return { asset: publicAsset(asset), history: history.map(publicHistory) };
    }
  };
}

export function createSupabaseMunicipalAssetStore(database) {
  return createSupabaseMunicipalAdminStore(database);
}

export function toMunicipalAssetHttpError(err) {
  return toMunicipalAdminHttpError(err);
}

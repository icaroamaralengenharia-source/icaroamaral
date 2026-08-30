import {
  findMunicipalCatalogItemByCode,
  normalizeMunicipalCatalogValue
} from "./data/municipal-profile-catalog.js";
import { compareMunicipalProfileVersions } from "./municipal-profile-diff-service.js";
import {
  createSupabaseMunicipalAdminStore,
  municipalAdminInternals,
  toMunicipalAdminHttpError
} from "./municipal-admin-service.js";

const WRITE_ROLES = new Set(["platform_admin"]);
const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "almoxarife", "funcionario", "leitura"]);
const VERSION_STATUS = new Set(["draft", "active", "archived"]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function nowIso(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function makeError(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function assertWrite(session) {
  if (!WRITE_ROLES.has(session.role)) throw makeError(403, "municipal_profile_write_forbidden");
}

function assertRead(session) {
  if (!READ_ROLES.has(session.role)) throw makeError(403, "municipal_profile_read_forbidden");
}

function publicProfile(profile) {
  return profile ? Object.assign({}, profile) : null;
}

function publicVersion(version) {
  return version ? Object.assign({}, version) : null;
}

function publicValue(value) {
  return value ? Object.assign({}, value) : null;
}

function cleanProfileType(value) {
  return normalizeKey(value || "official") || "official";
}

function cleanState(value) {
  const state = clean(value).toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) throw makeError(400, "state_invalid");
  return state;
}

function cleanProfilePayload(body = {}) {
  const municipality = clean(body.municipality || body.municipality_name || body.municipalityName);
  if (!municipality) throw makeError(400, "municipality_required");
  const state = cleanState(body.state);
  const profileType = cleanProfileType(body.profileType || body.profile_type);
  const ibgeCode = clean(body.ibge_code || body.ibgeCode);
  return {
    municipality_name: municipality,
    municipality_key: normalizeKey(municipality),
    state,
    ibge_code: ibgeCode || null,
    profile_type: profileType,
    profile_key: [state, normalizeKey(municipality), profileType].join(":")
  };
}

function cleanVersionStatus(value) {
  const status = clean(value || "draft").toLowerCase();
  if (!VERSION_STATUS.has(status)) throw makeError(400, "municipal_profile_version_status_invalid");
  return status;
}

function normalizeTypedValue(item, rawValue) {
  const base = normalizeMunicipalCatalogValue(item, rawValue);
  if (!base.ok) throw makeError(400, base.error || "municipal_profile_value_invalid");
  if (item.valueType === "number" || item.valueType === "percentage" || item.valueType === "currency") {
    const normalized = Number(clean(rawValue).replace(",", "."));
    if (!Number.isFinite(normalized)) throw makeError(400, "numeric_value_invalid");
    return normalized;
  }
  if (item.valueType === "range") {
    const input = Array.isArray(rawValue) ? rawValue : clean(rawValue).split(/\s*(?:-|a|ate|até)\s*/i);
    const values = input.map((value) => Number(clean(value).replace(",", "."))).filter((value) => Number.isFinite(value));
    if (values.length !== 2 || values[0] > values[1]) throw makeError(400, "range_value_invalid");
    return { min: values[0], max: values[1] };
  }
  if (item.valueType === "date") {
    const time = new Date(clean(rawValue)).getTime();
    if (!Number.isFinite(time)) throw makeError(400, "date_value_invalid");
    return new Date(time).toISOString().slice(0, 10);
  }
  return base.normalizedValue;
}

async function writeAudit(store, session, action, targetType, targetId, metadata = {}) {
  await store.insert("municipal_admin_audit_log", {
    actor_user_id: clean(session.userId),
    institution_id: null,
    target_type: targetType,
    target_id: clean(targetId),
    action,
    metadata: municipalAdminInternals.sanitizeMetadata(metadata) || {},
    created_at: nowIso()
  });
}

async function findProfile(store, body = {}) {
  const payload = cleanProfilePayload(body);
  return await store.findOne("municipal_profiles", { profile_key: payload.profile_key });
}

async function getVersionOrThrow(store, versionId) {
  const version = await store.get("municipal_profile_versions", versionId);
  if (!version) throw makeError(404, "municipal_profile_version_not_found");
  return version;
}

async function getProfileOrThrow(store, profileId) {
  const profile = await store.get("municipal_profiles", profileId);
  if (!profile) throw makeError(404, "municipal_profile_not_found");
  return profile;
}

async function validateDraftValues(store, version) {
  const values = await store.list("municipal_profile_values", { version_id: clean(version.id) });
  if (!values.length) throw makeError(409, "municipal_profile_version_without_values");
  const seen = new Set();
  for (const value of values) {
    const item = findMunicipalCatalogItemByCode(value.catalog_code);
    if (!item) throw makeError(409, "municipal_profile_value_catalog_invalid");
    if (clean(value.value_type) !== item.valueType) throw makeError(409, "municipal_profile_value_type_invalid");
    if (value.normalized_value === null || value.normalized_value === undefined) throw makeError(409, "municipal_profile_value_invalid");
    const code = clean(value.catalog_code);
    if (seen.has(code)) throw makeError(409, "municipal_profile_value_duplicate_unresolved");
    seen.add(code);
  }
  return values;
}

function finalReviewStatus(value) {
  return ["confirmed", "corrected", "ignored"].includes(clean(value).toLowerCase());
}

async function validateCompletedReview(store, version) {
  const imports = await store.list("municipal_profile_imports", { version_id: clean(version.id) });
  const currentImport = imports.slice().sort((a, b) => String(b.reviewed_at || b.created_at || "").localeCompare(String(a.reviewed_at || a.created_at || "")))[0];
  if (!currentImport) throw makeError(409, "municipal_profile_activation_review_required");
  if (clean(currentImport.status).toLowerCase() !== "review_completed") throw makeError(409, "municipal_profile_activation_review_incomplete");
  const rows = await store.list("municipal_profile_import_rows", { import_id: clean(currentImport.id) });
  const confirmedCodes = new Set();
  for (const row of rows) {
    const status = clean(row.review_status).toLowerCase();
    if (!finalReviewStatus(status)) throw makeError(409, "municipal_profile_activation_review_incomplete");
    const code = clean(row.catalog_code_confirmed || row.catalog_code_suggested);
    if (["confirmed", "corrected"].includes(status)) {
      if (!code || !findMunicipalCatalogItemByCode(code)) throw makeError(409, "municipal_profile_activation_review_invalid");
      if (confirmedCodes.has(code)) throw makeError(409, "municipal_profile_activation_duplicate_unresolved");
      confirmedCodes.add(code);
    }
  }
  return currentImport;
}

async function restoreVersions(store, snapshots) {
  for (const version of snapshots.filter(Boolean)) await store.update("municipal_profile_versions", version.id, version);
}

function defaultInvalidateMunicipalProfileCache(profileId, details = {}) {
  return { profileId: clean(profileId), invalidated: true, details };
}

function rollbackMunicipalProfileVersion() {
  throw makeError(501, "municipal_profile_rollback_requires_new_activation");
}

export function createMunicipalProfileService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const getNow = options.now || (() => new Date());
  const invalidateCache = options.invalidateMunicipalProfileCache || defaultInvalidateMunicipalProfileCache;

  async function activateVersion(context, versionId, body = {}, policy = {}) {
    const session = municipalAdminInternals.sessionFromContext(context);
    assertWrite(session);
    const explicitProfileId = clean(policy.profileId || body.profileId || body.profile_id);
    const version = await getVersionOrThrow(store, versionId);
    if (explicitProfileId && clean(version.profile_id) !== explicitProfileId) throw makeError(400, "municipal_profile_activation_profile_mismatch");
    if (cleanVersionStatus(version.status) !== "draft") throw makeError(409, "municipal_profile_version_not_draft");
    const profile = await getProfileOrThrow(store, explicitProfileId || version.profile_id);
    if (clean(version.profile_id) !== clean(profile.id)) throw makeError(400, "municipal_profile_activation_profile_mismatch");
    if (policy.requireConfirmation && body.confirmation !== true) throw makeError(400, "municipal_profile_activation_confirmation_required");
    const requestedEffectiveFrom = clean(body.effective_from || body.effectiveFrom);
    const effectiveFrom = requestedEffectiveFrom || clean(version.effective_from);
    if (policy.requireEffectiveFrom && !effectiveFrom) throw makeError(400, "municipal_profile_activation_effective_from_required");
    const values = await validateDraftValues(store, version);
    let review = null;
    if (policy.requireCompletedReview) review = await validateCompletedReview(store, version);
    const versions = await store.list("municipal_profile_versions", { profile_id: clean(profile.id) });
    const activeVersions = versions.filter((item) => cleanVersionStatus(item.status) === "active");
    if (activeVersions.length > 1) throw makeError(409, "municipal_profile_multiple_active_versions");
    const currentActive = activeVersions[0] || null;
    const beforeValues = currentActive ? await store.list("municipal_profile_values", { version_id: clean(currentActive.id) }) : [];
    const diff = compareMunicipalProfileVersions(beforeValues, values);
    const activatedAt = nowIso(getNow);
    const auditBase = { profileId: profile.id, oldVersionId: currentActive ? currentActive.id : null, newVersionId: version.id, activatedBy: clean(session.userId), activatedAt, effectiveFrom, diffSummary: diff.summary };
    const snapshots = [currentActive, version].filter(Boolean).map((item) => Object.assign({}, item));
    await writeAudit(store, session, "municipal_profile_version_activation_started", "municipal_profile_version", version.id, auditBase);
    try {
      let archived = null;
      if (currentActive) {
        archived = await store.update("municipal_profile_versions", currentActive.id, { status: "archived", effective_to: effectiveFrom || currentActive.effective_to || null, archived_at: activatedAt });
        await writeAudit(store, session, "municipal_profile_version_archived", "municipal_profile_version", currentActive.id, Object.assign({}, auditBase, { version_number: archived ? archived.version_number : currentActive.version_number }));
      }
      const activated = await store.update("municipal_profile_versions", version.id, { status: "active", effective_from: effectiveFrom || version.effective_from || nowIso(getNow).slice(0, 10), activated_by: clean(session.userId), activated_at: activatedAt });
      await store.update("municipal_profiles", profile.id, { updated_at: activatedAt });
      const cacheInvalidation = await invalidateCache(profile.id, { activeVersionId: activated.id, previousVersionId: currentActive ? currentActive.id : null, sourceHash: activated.source_hash || null });
      await writeAudit(store, session, "municipal_profile_version_activated", "municipal_profile_version", version.id, Object.assign({}, auditBase, { version_number: activated.version_number, cacheInvalidation }));
      return { profile: publicProfile(profile), version: publicVersion(activated), previousVersion: publicVersion(archived || currentActive), review: publicVersion(review), diffSummary: diff.summary, cacheInvalidation };
    } catch (err) {
      try {
        await restoreVersions(store, snapshots);
        await writeAudit(store, session, "municipal_profile_version_activation_failed", "municipal_profile_version", version.id, Object.assign({}, auditBase, { error: clean(err && (err.code || err.message)) }));
      } catch (_) {}
      throw err;
    }
  }

  return {
    async createMunicipalProfile(context, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const payload = cleanProfilePayload(body);
      const duplicate = await store.findOne("municipal_profiles", { profile_key: payload.profile_key });
      if (duplicate) throw makeError(409, "municipal_profile_duplicate");
      const profile = await store.insert("municipal_profiles", Object.assign(payload, {
        created_at: nowIso(getNow),
        updated_at: nowIso(getNow)
      }));
      await writeAudit(store, session, "municipal_profile_created", "municipal_profile", profile.id, {
        profile_key: profile.profile_key
      });
      return { profile: publicProfile(profile) };
    },

    async createMunicipalProfileVersion(context, profileId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const profile = await getProfileOrThrow(store, profileId);
      const sourceHash = clean(body.source_hash || body.sourceHash);
      if (sourceHash) {
        const duplicate = await store.findOne("municipal_profile_versions", {
          profile_id: clean(profile.id),
          source_hash: sourceHash
        });
        if (duplicate) throw makeError(409, "municipal_profile_source_hash_duplicate");
      }
      const versions = await store.list("municipal_profile_versions", { profile_id: clean(profile.id) });
      const nextVersion = versions.reduce((max, version) => Math.max(max, Number(version.version_number || 0)), 0) + 1;
      const version = await store.insert("municipal_profile_versions", {
        profile_id: profile.id,
        version_number: nextVersion,
        status: "draft",
        source_document_id: clean(body.source_document_id || body.sourceDocumentId) || null,
        source_hash: sourceHash || null,
        effective_from: clean(body.effective_from || body.effectiveFrom) || null,
        effective_to: clean(body.effective_to || body.effectiveTo) || null,
        created_by: clean(session.userId),
        created_at: nowIso(getNow),
        activated_by: null,
        activated_at: null,
        archived_at: null
      });
      await writeAudit(store, session, "municipal_profile_version_created", "municipal_profile_version", version.id, {
        profile_id: profile.id,
        version_number: nextVersion,
        source_hash: sourceHash || null
      });
      return { version: publicVersion(version) };
    },

    async setMunicipalProfileValue(context, versionId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const version = await getVersionOrThrow(store, versionId);
      if (cleanVersionStatus(version.status) !== "draft") throw makeError(409, "municipal_profile_active_immutable");
      const item = findMunicipalCatalogItemByCode(body.catalog_code || body.catalogCode);
      if (!item) throw makeError(400, "municipal_profile_catalog_code_invalid");
      const normalizedValue = normalizeTypedValue(item, body.raw_value ?? body.rawValue ?? body.value);
      const payload = {
        version_id: clean(version.id),
        catalog_code: item.code,
        raw_value: clean(body.raw_value ?? body.rawValue ?? body.value),
        normalized_value: normalizedValue,
        value_type: item.valueType,
        unit: clean(body.unit) || item.unit,
        note: clean(body.note),
        source_page: Number.isFinite(Number(body.source_page ?? body.sourcePage)) ? Math.max(0, Math.floor(Number(body.source_page ?? body.sourcePage))) : null,
        source_text: clean(body.source_text || body.sourceText),
        confidence: Number.isFinite(Number(body.confidence)) ? Math.max(0, Math.min(1, Number(body.confidence))) : null,
        created_at: nowIso(getNow)
      };
      if (payload.unit !== item.unit) throw makeError(400, "municipal_profile_value_unit_invalid");
      const existing = await store.findOne("municipal_profile_values", {
        version_id: clean(version.id),
        catalog_code: item.code
      });
      const value = existing
        ? await store.update("municipal_profile_values", existing.id, payload)
        : await store.insert("municipal_profile_values", payload);
      await writeAudit(store, session, "municipal_profile_value_set", "municipal_profile_value", value.id, {
        version_id: version.id,
        catalog_code: item.code
      });
      return { value: publicValue(value) };
    },

    async activateMunicipalProfileVersion(context, versionId, body = {}) {
      return activateVersion(context, versionId, body, {});
    },

    async activateControlledMunicipalProfileVersion(context, profileId, body = {}) {
      const versionId = clean(body.versionId || body.version_id);
      if (!versionId) throw makeError(400, "municipal_profile_activation_version_required");
      return activateVersion(context, versionId, body, { profileId, requireConfirmation: true, requireCompletedReview: true, requireEffectiveFrom: true });
    },

    rollbackMunicipalProfileVersion,

    invalidateMunicipalProfileCache: invalidateCache,

    async getActiveMunicipalProfile(context, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertRead(session);
      const profile = await findProfile(store, body);
      if (!profile) throw makeError(404, "municipal_profile_not_found");
      const versions = await store.list("municipal_profile_versions", { profile_id: clean(profile.id) });
      const active = versions.find((version) => cleanVersionStatus(version.status) === "active");
      if (!active) throw makeError(404, "municipal_profile_active_not_found");
      const values = await store.list("municipal_profile_values", { version_id: clean(active.id) });
      return {
        profile: publicProfile(profile),
        version: publicVersion(active),
        values: values.map(publicValue)
      };
    },

    async listMunicipalProfileVersions(context, profileId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertRead(session);
      await getProfileOrThrow(store, profileId);
      const versions = await store.list("municipal_profile_versions", { profile_id: clean(profileId) });
      return {
        versions: versions
          .slice()
          .sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0))
          .map(publicVersion)
      };
    }
  };
}

export { createSupabaseMunicipalAdminStore as createSupabaseMunicipalProfileStore, toMunicipalAdminHttpError as toMunicipalProfileHttpError };



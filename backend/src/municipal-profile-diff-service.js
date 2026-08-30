import {
  findMunicipalCatalogItemByCode
} from "./data/municipal-profile-catalog.js";
import {
  createSupabaseMunicipalAdminStore,
  municipalAdminInternals,
  toMunicipalAdminHttpError
} from "./municipal-admin-service.js";

const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "almoxarife", "funcionario", "leitura"]);
const CHANGE_TYPES = ["VALUE_CHANGED", "TYPE_CHANGED", "UNIT_CHANGED", "NOTE_CHANGED", "SOURCE_CHANGED", "CONFIDENCE_CHANGED"];

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function makeError(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function assertRead(session) {
  if (!READ_ROLES.has(session.role)) throw makeError(403, "municipal_profile_diff_read_forbidden");
}

function publicRow(row) {
  return row ? Object.assign({}, row) : null;
}

function valueKey(value) {
  if (value && typeof value === "object") return JSON.stringify(value, Object.keys(value).sort());
  return JSON.stringify(value ?? null);
}

function stringKey(value) {
  return clean(value);
}

function confidenceKey(value) {
  if (Number.isFinite(Number(value))) return String(Number(value));
  return clean(value).toUpperCase();
}

function sourceChanged(before, after) {
  return stringKey(before.source_page) !== stringKey(after.source_page) || stringKey(before.source_text) !== stringKey(after.source_text);
}

function changeTypes(before, after) {
  const changes = [];
  if (valueKey(before.normalized_value) !== valueKey(after.normalized_value)) changes.push("VALUE_CHANGED");
  if (stringKey(before.value_type) !== stringKey(after.value_type)) changes.push("TYPE_CHANGED");
  if (stringKey(before.unit) !== stringKey(after.unit)) changes.push("UNIT_CHANGED");
  if (stringKey(before.note) !== stringKey(after.note)) changes.push("NOTE_CHANGED");
  if (sourceChanged(before, after)) changes.push("SOURCE_CHANGED");
  if (confidenceKey(before.confidence) !== confidenceKey(after.confidence)) changes.push("CONFIDENCE_CHANGED");
  return changes;
}

function catalogName(code) {
  const item = findMunicipalCatalogItemByCode(code);
  return item ? item.name : "";
}

function diffRow(code, before, after) {
  const changes = before && after ? changeTypes(before, after) : [];
  const status = before && after ? (changes.length ? "CHANGED" : "UNCHANGED") : (after ? "ADDED" : "REMOVED");
  return {
    catalog_code: code,
    catalog_name: catalogName(code),
    status,
    change_types: changes,
    oldRawValue: before ? before.raw_value : null,
    newRawValue: after ? after.raw_value : null,
    oldNormalizedValue: before ? before.normalized_value : null,
    newNormalizedValue: after ? after.normalized_value : null,
    oldValue: before ? publicRow(before) : null,
    newValue: after ? publicRow(after) : null,
    oldSource: before ? { source_page: before.source_page ?? null, source_text: before.source_text || "" } : null,
    newSource: after ? { source_page: after.source_page ?? null, source_text: after.source_text || "" } : null
  };
}

function summarizeDiff(rows, beforeCount, afterCount) {
  return {
    totalBefore: beforeCount,
    totalAfter: afterCount,
    added: rows.filter((row) => row.status === "ADDED").length,
    removed: rows.filter((row) => row.status === "REMOVED").length,
    changed: rows.filter((row) => row.status === "CHANGED").length,
    unchanged: rows.filter((row) => row.status === "UNCHANGED").length,
    valueChanged: rows.filter((row) => row.change_types.includes("VALUE_CHANGED")).length,
    sourceChanged: rows.filter((row) => row.change_types.includes("SOURCE_CHANGED")).length,
    typeChanged: rows.filter((row) => row.change_types.includes("TYPE_CHANGED")).length,
    unitChanged: rows.filter((row) => row.change_types.includes("UNIT_CHANGED")).length,
    confidenceChanged: rows.filter((row) => row.change_types.includes("CONFIDENCE_CHANGED")).length
  };
}

function byCatalog(values) {
  const map = new Map();
  for (const value of values || []) {
    const code = clean(value.catalog_code);
    if (code) map.set(code, value);
  }
  return map;
}

async function versionOrThrow(store, versionId) {
  const version = await store.get("municipal_profile_versions", versionId);
  if (!version) throw makeError(404, "municipal_profile_version_not_found");
  return version;
}

async function profileVersions(store, profileId) {
  return await store.list("municipal_profile_versions", { profile_id: clean(profileId) });
}

function pickSingleActive(versions) {
  const active = versions.filter((version) => clean(version.status).toLowerCase() === "active");
  if (active.length !== 1) throw makeError(400, "municipal_profile_diff_versions_required");
  return active[0];
}

function pickLatestDraft(versions) {
  const drafts = versions.filter((version) => clean(version.status).toLowerCase() === "draft").sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0));
  if (!drafts.length) throw makeError(400, "municipal_profile_diff_versions_required");
  if (drafts.length > 1 && Number(drafts[0].version_number || 0) === Number(drafts[1].version_number || 0)) throw makeError(400, "municipal_profile_diff_versions_required");
  return drafts[0];
}

async function resolveVersions(store, profileId, query = {}) {
  const fromId = clean(query.fromVersionId || query.from_version_id || query.from);
  const toId = clean(query.toVersionId || query.to_version_id || query.to);
  if (fromId && toId) return { fromVersion: await versionOrThrow(store, fromId), toVersion: await versionOrThrow(store, toId) };
  const versions = await profileVersions(store, profileId);
  if (!fromId && !toId) return { fromVersion: pickSingleActive(versions), toVersion: pickLatestDraft(versions) };
  if (toId) return { fromVersion: pickSingleActive(versions), toVersion: await versionOrThrow(store, toId) };
  return { fromVersion: await versionOrThrow(store, fromId), toVersion: pickLatestDraft(versions) };
}

export function compareMunicipalProfileVersions(beforeValues = [], afterValues = []) {
  const before = byCatalog(beforeValues);
  const after = byCatalog(afterValues);
  const codes = Array.from(new Set([...before.keys(), ...after.keys()])).sort();
  const rows = codes.map((code) => diffRow(code, before.get(code), after.get(code)));
  return { rows, summary: summarizeDiff(rows, beforeValues.length, afterValues.length) };
}

export function createMunicipalProfileDiffService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);

  return {
    async getMunicipalProfileVersionDiff(context, profileId, query = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertRead(session);
      const profile = await store.get("municipal_profiles", profileId);
      if (!profile) throw makeError(404, "municipal_profile_not_found");
      const { fromVersion, toVersion } = await resolveVersions(store, profile.id, query);
      if (clean(fromVersion.profile_id) !== clean(profile.id) || clean(toVersion.profile_id) !== clean(profile.id)) {
        throw makeError(400, "municipal_profile_diff_profile_mismatch");
      }
      const [beforeValues, afterValues] = await Promise.all([
        store.list("municipal_profile_values", { version_id: clean(fromVersion.id) }),
        store.list("municipal_profile_values", { version_id: clean(toVersion.id) })
      ]);
      const diff = compareMunicipalProfileVersions(beforeValues, afterValues);
      return {
        profile: publicRow(profile),
        fromVersion: publicRow(fromVersion),
        toVersion: publicRow(toVersion),
        rows: diff.rows,
        summary: diff.summary,
        changeTypes: CHANGE_TYPES
      };
    }
  };
}

function toMunicipalProfileDiffHttpError(err) {
  if (err && err.status && err.code) return { status: err.status, error: err.code };
  return toMunicipalAdminHttpError(err);
}

export { toMunicipalProfileDiffHttpError };

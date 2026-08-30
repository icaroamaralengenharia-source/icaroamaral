import {
  findMunicipalCatalogItemByCode,
  getMunicipalCatalog
} from "./data/municipal-profile-catalog.js";
import { createMunicipalProfileService } from "./municipal-profile-service.js";
import {
  createSupabaseMunicipalAdminStore,
  municipalAdminInternals,
  toMunicipalAdminHttpError
} from "./municipal-admin-service.js";

const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "almoxarife", "funcionario", "leitura"]);
const WRITE_ROLES = new Set(["platform_admin"]);
const FINAL_STATUSES = new Set(["confirmed", "corrected", "ignored"]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
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

function assertRead(session) {
  if (!READ_ROLES.has(session.role)) throw makeError(403, "municipal_import_review_read_forbidden");
}

function assertWrite(session) {
  if (!WRITE_ROLES.has(session.role)) throw makeError(403, "municipal_import_review_write_forbidden");
}

function isFinalStatus(value) {
  return FINAL_STATUSES.has(clean(value).toLowerCase());
}

function publicRow(row) {
  return row ? Object.assign({}, row) : null;
}

function publicImport(row) {
  return row ? Object.assign({}, row) : null;
}

function publicVersion(row) {
  return row ? Object.assign({}, row) : null;
}

function publicProfile(row) {
  return row ? Object.assign({}, row) : null;
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseNumber(value) {
  const numericText = clean(value).replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!/\d/.test(numericText)) throw makeError(400, "municipal_import_review_value_invalid");
  const parsed = Number(numericText);
  if (!Number.isFinite(parsed)) throw makeError(400, "municipal_import_review_value_invalid");
  return parsed;
}

function normalizeReviewedValue(item, value) {
  if (!item) throw makeError(400, "municipal_import_review_catalog_invalid");
  if (item.valueType === "boolean") {
    const text = normalizeText(value);
    if (["sim", "s", "true", "1", "yes"].includes(text)) return true;
    if (["nao", "não", "n", "false", "0", "no"].includes(text)) return false;
    if (typeof value === "boolean") return value;
    throw makeError(400, "municipal_import_review_value_invalid");
  }
  if (item.valueType === "number" || item.valueType === "percentage" || item.valueType === "currency") return parseNumber(value);
  if (item.valueType === "range") {
    const source = value && typeof value === "object" ? [value.min, value.max] : clean(value).split(/\s*(?:-|a|ate|até)\s*/i);
    const numbers = source.map(parseNumber);
    if (numbers.length !== 2 || numbers[0] > numbers[1]) throw makeError(400, "municipal_import_review_value_invalid");
    return { min: numbers[0], max: numbers[1] };
  }
  if (item.valueType === "date") {
    const time = new Date(clean(value)).getTime();
    if (!Number.isFinite(time)) throw makeError(400, "municipal_import_review_value_invalid");
    return new Date(time).toISOString().slice(0, 10);
  }
  if (item.valueType === "enum") {
    const matched = item.allowedValues.find((allowed) => normalizeText(allowed) === normalizeText(value));
    if (!matched) throw makeError(400, "municipal_import_review_value_invalid");
    return matched;
  }
  return clean(value);
}

function rawForDraft(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return `${value.min}-${value.max}`;
  if (typeof value === "boolean") return value ? "SIM" : "NÃO";
  return clean(value);
}

function summarizeRows(rows) {
  return {
    total: rows.length,
    high: rows.filter((row) => clean(row.confidence) === "HIGH").length,
    medium: rows.filter((row) => clean(row.confidence) === "MEDIUM").length,
    low: rows.filter((row) => clean(row.confidence) === "LOW").length,
    unmatched: rows.filter((row) => clean(row.confidence) === "UNMATCHED").length,
    reviewed: rows.filter((row) => isFinalStatus(row.review_status)).length,
    pending: rows.filter((row) => !isFinalStatus(row.review_status)).length,
    ignored: rows.filter((row) => clean(row.review_status) === "ignored").length
  };
}

function needsDecision(row) {
  return Boolean(row.requires_review || row.catalog_code_suggested || clean(row.raw_value) || clean(row.raw_text));
}

function validateMunicipalImportReview(rows) {
  const errors = [];
  const confirmedCatalog = new Map();
  for (const row of rows) {
    const status = clean(row.review_status || "pending").toLowerCase();
    const catalogCode = clean(row.catalog_code_confirmed || row.catalog_code_suggested);
    if (needsDecision(row) && !isFinalStatus(status)) errors.push({ row_id: row.id, error: "review_pending" });
    if ((status === "confirmed" || status === "corrected") && !catalogCode) errors.push({ row_id: row.id, error: "catalog_code_required" });
    if ((status === "confirmed" || status === "corrected") && catalogCode) {
      if (!findMunicipalCatalogItemByCode(catalogCode)) errors.push({ row_id: row.id, error: "catalog_code_invalid" });
      const prior = confirmedCatalog.get(catalogCode);
      if (prior) {
        errors.push({ row_id: prior, error: "duplicate_catalog_code_unresolved" });
        errors.push({ row_id: row.id, error: "duplicate_catalog_code_unresolved" });
      } else {
        confirmedCatalog.set(catalogCode, row.id);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

async function writeAudit(store, session, action, targetId, metadata = {}) {
  await store.insert("municipal_admin_audit_log", {
    actor_user_id: clean(session.userId),
    institution_id: null,
    target_type: "municipal_profile_import",
    target_id: clean(targetId),
    action,
    metadata: municipalAdminInternals.sanitizeMetadata(metadata) || {},
    created_at: nowIso()
  });
}

async function getImportBundle(store, importId) {
  const record = await store.get("municipal_profile_imports", importId);
  if (!record) throw makeError(404, "municipal_profile_import_not_found");
  const [profile, version, rows] = await Promise.all([
    store.get("municipal_profiles", record.profile_id),
    store.get("municipal_profile_versions", record.version_id),
    store.list("municipal_profile_import_rows", { import_id: clean(record.id) })
  ]);
  return { record, profile, version, rows };
}

function decisionByRow(decisions) {
  const map = new Map();
  for (const decision of Array.isArray(decisions) ? decisions : []) {
    const rowId = clean(decision.rowId || decision.row_id);
    if (rowId) map.set(rowId, decision);
  }
  return map;
}

export function createMunicipalProfileReviewService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const profileService = options.profileService || createMunicipalProfileService({ store, now: options.now });
  const getNow = options.now || (() => new Date());

  return {
    async getMunicipalProfileImport(context, importId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertRead(session);
      const { record, profile, version, rows } = await getImportBundle(store, importId);
      return {
        import: publicImport(record),
        profile: publicProfile(profile),
        version: publicVersion(version),
        rows: rows.map(publicRow),
        catalog: getMunicipalCatalog(),
        summary: summarizeRows(rows)
      };
    },

    async saveMunicipalImportReview(context, importId, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const { record, version, rows } = await getImportBundle(store, importId);
      if (!version || clean(version.status) !== "draft") throw makeError(409, "municipal_import_review_version_not_draft");
      await writeAudit(store, session, "municipal_import_review_started", record.id, { decisions: Array.isArray(body.decisions) ? body.decisions.length : 0 });
      const decisions = decisionByRow(body.decisions);
      const updatedRows = [];

      for (const row of rows) {
        const decision = decisions.get(clean(row.id));
        if (!decision) {
          updatedRows.push(row);
          continue;
        }
        const status = clean(decision.reviewStatus || decision.review_status).toLowerCase();
        if (!isFinalStatus(status)) throw makeError(400, "municipal_import_review_status_invalid");
        const suggestedCode = clean(row.catalog_code_suggested);
        const confirmedCode = clean(decision.catalogCodeConfirmed || decision.catalog_code_confirmed || suggestedCode);
        const item = confirmedCode ? findMunicipalCatalogItemByCode(confirmedCode) : null;
        if ((status === "confirmed" || status === "corrected") && !item) throw makeError(400, "municipal_import_review_catalog_invalid");
        const rawDecisionValue = decision.normalizedValueConfirmed ?? decision.normalized_value_confirmed ?? row.normalized_value_suggested ?? row.raw_value;
        const normalizedValue = status === "ignored" ? null : normalizeReviewedValue(item, rawDecisionValue);
        const action = status === "ignored" ? "municipal_import_row_ignored" : (confirmedCode !== suggestedCode || status === "corrected" ? "municipal_import_row_corrected" : "municipal_import_row_confirmed");
        const patch = {
          catalog_code_confirmed: status === "ignored" ? null : confirmedCode,
          normalized_value_confirmed: normalizedValue,
          review_status: status,
          review_note: clean(decision.reviewNote || decision.review_note),
          reviewed_by: clean(session.userId),
          reviewed_at: nowIso(getNow),
          requires_review: false
        };
        const updated = await store.update("municipal_profile_import_rows", row.id, patch);
        updatedRows.push(updated || Object.assign({}, row, patch));
        await writeAudit(store, session, action, record.id, { row_id: row.id, catalog_code: confirmedCode || null });
      }

      const validation = validateMunicipalImportReview(updatedRows);
      if (!validation.ok) throw makeError(409, "municipal_import_review_incomplete");

      for (const row of updatedRows.filter((item) => ["confirmed", "corrected"].includes(clean(item.review_status)))) {
        await profileService.setMunicipalProfileValue(context, version.id, {
          catalog_code: row.catalog_code_confirmed || row.catalog_code_suggested,
          raw_value: rawForDraft(row.normalized_value_confirmed),
          source_page: row.page,
          source_text: row.raw_text,
          confidence: 1,
          note: row.review_note
        });
      }

      const reviewed = await store.update("municipal_profile_imports", record.id, {
        status: "review_completed",
        reviewed_by: clean(session.userId),
        reviewed_at: nowIso(getNow)
      });
      await writeAudit(store, session, "municipal_import_review_completed", record.id, { rows_count: updatedRows.length });

      return {
        import: publicImport(reviewed || record),
        version: publicVersion(version),
        rows: updatedRows.map(publicRow),
        summary: summarizeRows(updatedRows)
      };
    }
  };
}

export { validateMunicipalImportReview, toMunicipalAdminHttpError as toMunicipalProfileReviewHttpError };

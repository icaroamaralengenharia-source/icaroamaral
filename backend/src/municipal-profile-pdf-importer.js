import crypto from "node:crypto";
import {
  findMunicipalCatalogCandidates,
  findMunicipalCatalogItemByCode,
  getMunicipalCatalog
} from "./data/municipal-profile-catalog.js";
import { createMunicipalProfileService } from "./municipal-profile-service.js";
import { extractMunicipalPdfContent } from "./municipal-pdf-extractor.js";
import {
  createSupabaseMunicipalAdminStore,
  municipalAdminInternals,
  toMunicipalAdminHttpError
} from "./municipal-admin-service.js";

const HIGH = "HIGH";
const MEDIUM = "MEDIUM";
const LOW = "LOW";
const UNMATCHED = "UNMATCHED";
const WRITE_ROLES = new Set(["platform_admin"]);
const MATCH_STOP_WORDS = new Set(["com", "das", "dos", "para", "por", "sem", "uma"]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function nowIso(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function error(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function assertWrite(session) {
  if (!WRITE_ROLES.has(session.role)) throw error(403, "municipal_profile_import_forbidden");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function profileKey(body = {}) {
  const municipality = clean(body.municipality || body.municipality_name || body.municipalityName);
  const state = clean(body.state).toUpperCase();
  const profileType = normalizeKey(body.profileType || body.profile_type || "official") || "official";
  if (!municipality) throw error(400, "municipality_required");
  if (!/^[A-Z]{2}$/.test(state)) throw error(400, "state_invalid");
  return [state, normalizeKey(municipality), profileType].join(":");
}

function lineParts(row) {
  const text = clean(row && row.text);
  const tableParts = text.split(/[|\t;]/).map(clean).filter(Boolean);
  if (tableParts.length >= 2) return { rawLabel: tableParts[0], rawValue: tableParts.slice(1).join(" "), rawText: text };
  const match = text.match(/^(.+?)\s*(?::|=|–|-)\s*(.+)$/);
  if (match) return { rawLabel: clean(match[1]), rawValue: clean(match[2]), rawText: text };
  return { rawLabel: text, rawValue: "", rawText: text };
}

function tokenOverlap(a, b) {
  const left = new Set(normalizeText(a).split(/\s+/).filter((token) => token.length > 2 && !MATCH_STOP_WORDS.has(token)));
  const right = normalizeText(b).split(/\s+/).filter((token) => token.length > 2 && !MATCH_STOP_WORDS.has(token));
  return right.filter((token) => left.has(token)).length;
}

function partialCandidates(text) {
  return getMunicipalCatalog()
    .map((item) => {
      const score = item.aliases.reduce((sum, alias) => Math.max(sum, tokenOverlap(text, alias)), 0);
      return { item, score };
    })
    .filter((entry) => entry.score > 1)
    .sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code));
}

function matchCatalog(row) {
  const text = [row.rawLabel, row.rawText].filter(Boolean).join(" ");
  const direct = findMunicipalCatalogCandidates(text);
  if (direct.length) {
    const label = normalizeText(row.rawLabel);
    const exact = direct
      .filter((item) => item.matchedAliases.some((alias) => label.includes(normalizeText(alias))))
      .sort((a, b) => {
        const aSize = Math.max(...a.matchedAliases.map((alias) => normalizeText(alias).length));
        const bSize = Math.max(...b.matchedAliases.map((alias) => normalizeText(alias).length));
        return bSize - aSize || a.code.localeCompare(b.code);
      });
    const selected = exact[0] || direct[0];
    const exactFull = selected.matchedAliases.some((alias) => label === normalizeText(alias)) || label === normalizeText(selected.name);
    const aliasSize = selected.matchedAliases.length ? Math.max(...selected.matchedAliases.map((alias) => normalizeText(alias).length)) : 0;
    const nameExact = label.includes(normalizeText(selected.name));
    return {
      catalogCode: selected.code,
      confidence: (direct.length > 1 && (aliasSize <= 10 || !exactFull)) || (selected.matchedAliases.length > 1 && !exactFull) ? LOW : (exact.length || nameExact ? HIGH : MEDIUM),
      matchMethod: exact.length ? "alias_exact" : "catalog_text",
      aliasesMatched: selected.matchedAliases || []
    };
  }
  const partial = partialCandidates(text);
  if (partial.length) {
    return {
      catalogCode: partial[0].item.code,
      confidence: partial.length > 1 && partial[1].score === partial[0].score ? LOW : MEDIUM,
      matchMethod: "alias_partial",
      aliasesMatched: []
    };
  }
  return { catalogCode: null, confidence: UNMATCHED, matchMethod: "unmatched", aliasesMatched: [] };
}

function normalizeRange(value) {
  const values = clean(value).split(/\s*(?:-|a|ate|até)\s*/i).map((part) => Number(part.replace(",", "."))).filter(Number.isFinite);
  if (values.length !== 2 || values[0] > values[1]) return { ok: false };
  return { ok: true, normalizedValue: { min: values[0], max: values[1] }, rawForDraft: `${values[0]}-${values[1]}` };
}

function normalizeSuggestedValue(item, rawValue, contextText) {
  const raw = clean(rawValue);
  if (!item) return { ok: false, normalizedValue: null, rawForDraft: raw };
  if (item.valueType === "boolean") {
    const normalized = normalizeText(raw);
    if (["sim", "s", "true", "1", "yes"].includes(normalized)) return { ok: true, normalizedValue: true, rawForDraft: raw };
    if (["nao", "não", "n", "false", "0", "no"].includes(normalized)) return { ok: true, normalizedValue: false, rawForDraft: raw };
    if (normalized === "x" || normalized === "marcado") {
      return normalizeText(contextText).includes("sim")
        ? { ok: true, normalizedValue: true, rawForDraft: "SIM" }
        : { ok: false, normalizedValue: null, rawForDraft: raw };
    }
    if (normalized === "desmarcado") return { ok: true, normalizedValue: false, rawForDraft: "NÃO" };
    return { ok: false, normalizedValue: null, rawForDraft: raw };
  }
  if (item.valueType === "number" || item.valueType === "percentage" || item.valueType === "currency") {
    const number = Number(raw.replace(/[^\d,.-]/g, "").replace(",", "."));
    if (!Number.isFinite(number)) return { ok: false, normalizedValue: null, rawForDraft: raw };
    return { ok: true, normalizedValue: number, rawForDraft: String(number) };
  }
  if (item.valueType === "range") return normalizeRange(raw);
  if (item.valueType === "date") {
    const time = new Date(raw).getTime();
    if (!Number.isFinite(time)) return { ok: false, normalizedValue: null, rawForDraft: raw };
    const value = new Date(time).toISOString().slice(0, 10);
    return { ok: true, normalizedValue: value, rawForDraft: value };
  }
  if (item.valueType === "enum") {
    const match = item.allowedValues.find((allowed) => normalizeText(allowed) === normalizeText(raw));
    if (!match) return { ok: false, normalizedValue: null, rawForDraft: raw };
    return { ok: true, normalizedValue: match, rawForDraft: match };
  }
  return { ok: true, normalizedValue: raw, rawForDraft: raw };
}

function normalizeRows(extracted) {
  return (extracted.rows || []).map((row) => {
    const parts = lineParts(row);
    return Object.assign({
      page: row.page || 1,
      normalizedLabel: normalizeText(parts.rawLabel),
      normalizedValueCandidate: normalizeText(parts.rawValue)
    }, parts);
  });
}

async function ensureProfile(profileService, store, context, body) {
  const key = profileKey(body);
  const existing = await store.findOne("municipal_profiles", { profile_key: key });
  if (existing) return existing;
  return (await profileService.createMunicipalProfile(context, body)).profile;
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

export function createMunicipalProfilePdfImporter(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const profileService = options.profileService || createMunicipalProfileService({ store, now: options.now });
  const extractPdf = options.extractPdf || extractMunicipalPdfContent;
  const getNow = options.now || (() => new Date());

  return {
    async importPdfToDraft(context, input = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const buffer = Buffer.isBuffer(input.buffer) ? input.buffer : Buffer.from(input.buffer || "");
      if (!buffer.length) throw error(400, "municipal_profile_pdf_required");
      const sourceHash = sha256(buffer);
      const profile = await ensureProfile(profileService, store, context, input);
      const profileId = clean(profile.id);
      const duplicateSameProfile = await store.findOne("municipal_profile_imports", {
        profile_id: profileId,
        source_hash: sourceHash
      });
      if (duplicateSameProfile) throw error(409, "municipal_profile_import_duplicate");
      const sameHashImports = await store.list("municipal_profile_imports", { source_hash: sourceHash });
      const warnings = sameHashImports.filter((item) => clean(item.profile_id) !== profileId).length
        ? ["same_hash_used_by_other_profile"]
        : [];
      const extracted = await extractPdf(buffer, input);
      const normalizedRows = normalizeRows(extracted);
      const matchedRows = normalizedRows.map((row) => {
        const match = matchCatalog(row);
        const item = match.catalogCode ? findMunicipalCatalogItemByCode(match.catalogCode) : null;
        const normalized = normalizeSuggestedValue(item, row.rawValue, row.rawText);
        return Object.assign({}, row, match, {
          normalizedValueSuggested: normalized.normalizedValue,
          rawForDraft: normalized.rawForDraft,
          valueType: item ? item.valueType : null,
          normalizationOk: normalized.ok,
          requiresReview: match.confidence !== HIGH || !normalized.ok,
          reviewStatus: "pending",
          duplicateCandidate: false
        });
      });
      const counts = matchedRows.reduce((map, row) => {
        if (row.catalogCode) map.set(row.catalogCode, (map.get(row.catalogCode) || 0) + 1);
        return map;
      }, new Map());
      matchedRows.forEach((row) => {
        if (row.catalogCode && counts.get(row.catalogCode) > 1) {
          row.duplicateCandidate = true;
          row.requiresReview = true;
        }
      });
      const version = (await profileService.createMunicipalProfileVersion(context, profileId, {
        source_hash: sourceHash,
        effective_from: input.effectiveDate || input.effective_date
      })).version;
      const importRecord = await store.insert("municipal_profile_imports", {
        profile_id: profileId,
        version_id: version.id,
        file_name: clean(input.fileName || input.file_name),
        source_hash: sourceHash,
        status: "draft_review",
        created_by: clean(input.importedBy || input.imported_by || session.userId),
        created_at: nowIso(getNow),
        reference_date: clean(input.referenceDate || input.reference_date) || null,
        effective_date: clean(input.effectiveDate || input.effective_date) || null,
        warnings
      });
      const persistedRows = [];
      for (const row of matchedRows) {
        const persisted = await store.insert("municipal_profile_import_rows", {
          import_id: importRecord.id,
          page: row.page,
          raw_label: row.rawLabel,
          raw_value: row.rawValue,
          raw_text: row.rawText,
          catalog_code_suggested: row.catalogCode,
          normalized_value_suggested: row.normalizedValueSuggested,
          value_type: row.valueType,
          confidence: row.confidence,
          match_method: row.matchMethod,
          aliases_matched: row.aliasesMatched,
          duplicate_candidate: row.duplicateCandidate,
          requires_review: row.requiresReview,
          review_status: row.reviewStatus,
          review_note: "",
          created_at: nowIso(getNow)
        });
        persistedRows.push(persisted);
      }
      for (const row of matchedRows.filter((item) => item.confidence === HIGH && item.normalizationOk && !item.duplicateCandidate)) {
        await profileService.setMunicipalProfileValue(context, version.id, {
          catalog_code: row.catalogCode,
          raw_value: row.rawForDraft,
          source_page: row.page,
          source_text: row.rawText,
          confidence: 1
        });
      }
      await writeAudit(store, session, "municipal_profile_import_created", importRecord.id, {
        profile_id: profileId,
        version_id: version.id,
        rows_count: persistedRows.length,
        source_hash: sourceHash
      });
      return {
        import: importRecord,
        profile,
        version,
        rows: persistedRows,
        warnings,
        summary: {
          pages: (extracted.pages || []).length,
          rows: persistedRows.length,
          high: persistedRows.filter((row) => row.confidence === HIGH).length,
          medium: persistedRows.filter((row) => row.confidence === MEDIUM).length,
          low: persistedRows.filter((row) => row.confidence === LOW).length,
          unmatched: persistedRows.filter((row) => row.confidence === UNMATCHED).length
        }
      };
    }
  };
}

export {
  sha256 as hashMunicipalProfilePdf,
  toMunicipalAdminHttpError as toMunicipalProfilePdfImportHttpError
};

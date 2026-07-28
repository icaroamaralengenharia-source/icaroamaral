import { createHash } from "node:crypto";

const EVIDENCE_TYPES = new Set(["text", "photo", "document", "note"]);
const SOURCES = new Set(["manual", "upload", "system"]);
const EVENT_TYPES = new Set(["evidence_created", "manual_note"]);
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const MAX_METADATA_BYTES = 12000;
const HASH_RE = /^[a-f0-9]{64}$/i;
const STORAGE_PATH_RE = /^(?![a-z]+:\/\/)(?![a-zA-Z]:)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[A-Za-z0-9._/@=-]+$/;
const EVIDENCE_CREATE_FIELDS = new Set([
  "project_id", "projectId", "evidence_type", "evidenceType", "source", "title", "description",
  "storage_path", "storagePath", "file_hash", "fileHash", "mime_type", "mimeType", "metadata",
  "occurred_at", "occurredAt", "content", "idempotency_key", "idempotencyKey", "operation_id", "operationId",
  "institution_id", "institutionId", "company_id", "companyId", "created_by", "createdBy"
]);

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeError(code, status = 400) {
  return Object.assign(new Error(code), { status });
}

function requireScope(input = {}) {
  const institutionId = clean(input.institution_id || input.institutionId, 140);
  const companyId = clean(input.company_id || input.companyId, 140);
  const projectId = clean(input.project_id || input.projectId, 140);
  if (!institutionId) throw safeError("institution_id_required");
  if (!companyId) throw safeError("company_id_required");
  if (!projectId) throw safeError("project_id_required");
  return { institution_id: institutionId, company_id: companyId, project_id: projectId };
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") > MAX_METADATA_BYTES) throw safeError("metadata_too_large", 413);
  return JSON.parse(json);
}

function normalizeDate(value, code) {
  const text = clean(value, 80);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw safeError(code || "invalid_date");
  return date.toISOString();
}

function normalizeLimit(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_LIMIT;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw safeError("invalid_limit");
  return Math.min(limit, MAX_LIMIT);
}

function normalizeOffset(value) {
  if (value === undefined || value === null || value === "") return 0;
  const offset = Number(value);
  if (!Number.isInteger(offset) || offset < 0) throw safeError("invalid_offset");
  return offset;
}

function normalizeStoragePath(value) {
  const path = clean(value, 1000);
  if (!path) return null;
  if (!STORAGE_PATH_RE.test(path)) throw safeError("unsafe_storage_path");
  return path;
}

function normalizeHash(input = {}) {
  const provided = clean(input.file_hash || input.fileHash, 160).toLowerCase();
  if (provided) {
    if (!HASH_RE.test(provided)) throw safeError("invalid_file_hash");
    return { file_hash: provided, hash_source: "provided" };
  }
  const content = clean(input.content, 200000);
  if (!content) return { file_hash: null, hash_source: null };
  return { file_hash: createHash("sha256").update(content).digest("hex"), hash_source: "content_sha256" };
}

function rejectUnknownFields(input = {}) {
  Object.keys(input || {}).forEach((key) => {
    if (!EVIDENCE_CREATE_FIELDS.has(key)) throw safeError("unknown_evidence_field");
  });
}

function sanitizeEvidence(evidence = {}) {
  return {
    id: evidence.id,
    institution_id: evidence.institution_id,
    company_id: evidence.company_id,
    project_id: evidence.project_id,
    created_by: evidence.created_by || null,
    evidence_type: evidence.evidence_type,
    source: evidence.source,
    title: evidence.title,
    description: evidence.description || null,
    storage_path: evidence.storage_path || null,
    file_hash: evidence.file_hash || null,
    mime_type: evidence.mime_type || null,
    metadata: evidence.metadata || {},
    status: evidence.status,
    occurred_at: evidence.occurred_at,
    idempotency_key: evidence.idempotency_key || null,
    created_at: evidence.created_at,
    updated_at: evidence.updated_at
  };
}

function sanitizeEvent(event = {}) {
  return {
    id: event.id,
    institution_id: event.institution_id,
    company_id: event.company_id,
    project_id: event.project_id,
    evidence_id: event.evidence_id || null,
    event_type: event.event_type,
    title: event.title,
    description: event.description || null,
    occurred_at: event.occurred_at,
    created_by: event.created_by || null,
    metadata: event.metadata || {},
    evidence: event.evidence || null,
    created_at: event.created_at
  };
}

function normalizeEvidenceInput(input = {}) {
  rejectUnknownFields(input);
  const scope = requireScope(input);
  const evidenceType = clean(input.evidence_type || input.evidenceType, 80);
  const source = clean(input.source, 80) || "manual";
  const title = clean(input.title, 240);
  const description = clean(input.description, 6000);
  const storagePath = normalizeStoragePath(input.storage_path || input.storagePath);
  const metadata = normalizeMetadata(input.metadata);
  const hash = normalizeHash(input);
  if (!evidenceType) throw safeError("evidence_type_required");
  if (!EVIDENCE_TYPES.has(evidenceType)) throw safeError("invalid_evidence_type");
  if (!SOURCES.has(source)) throw safeError("invalid_evidence_source");
  if (!title) throw safeError("evidence_title_required");
  if (!description && !storagePath && !hash.file_hash) throw safeError("evidence_content_required");
  if (hash.hash_source) metadata.hash_source = hash.hash_source;
  const idempotencyKey = clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160) || null;

  return Object.assign({}, scope, {
    created_by: clean(input.created_by || input.createdBy, 140) || null,
    evidence_type: evidenceType,
    source,
    title,
    description: description || null,
    storage_path: storagePath,
    file_hash: hash.file_hash,
    mime_type: clean(input.mime_type || input.mimeType, 160) || null,
    metadata,
    status: "registered",
    occurred_at: normalizeDate(input.occurred_at || input.occurredAt, "invalid_occurred_at") || new Date().toISOString(),
    idempotency_key: idempotencyKey
  });
}

function normalizeFilters(input = {}, kind = "evidence") {
  const scope = requireScope(input);
  const filters = Object.assign({}, scope, {
    limit: normalizeLimit(input.limit),
    offset: normalizeOffset(input.offset ?? input.cursor),
    date_from: normalizeDate(input.date_from || input.dateFrom, "invalid_date_from"),
    date_to: normalizeDate(input.date_to || input.dateTo, "invalid_date_to")
  });
  if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) throw safeError("invalid_date_range");
  if (kind === "evidence") {
    const evidenceType = clean(input.evidence_type || input.evidenceType, 80);
    const source = clean(input.source, 80);
    if (evidenceType && !EVIDENCE_TYPES.has(evidenceType)) throw safeError("invalid_evidence_type");
    if (source && !SOURCES.has(source)) throw safeError("invalid_evidence_source");
    filters.evidence_type = evidenceType || null;
    filters.source = source || null;
  }
  if (kind === "timeline") {
    const eventType = clean(input.event_type || input.eventType, 80);
    if (eventType && !EVENT_TYPES.has(eventType)) throw safeError("invalid_event_type");
    filters.event_type = eventType || null;
  }
  return filters;
}

function evidenceEventPayload(payload) {
  return {
    institution_id: payload.institution_id,
    company_id: payload.company_id,
    project_id: payload.project_id,
    event_type: "evidence_created",
    title: payload.title,
    description: payload.description ? payload.description.slice(0, 1000) : null,
    occurred_at: payload.occurred_at,
    created_by: payload.created_by,
    metadata: { evidence_type: payload.evidence_type, source: payload.source }
  };
}

export function createEloSentinelService(options = {}) {
  const store = options.store;
  if (!store) throw safeError("elo_sentinel_store_required", 500);

  async function createEvidence(input = {}) {
    const payload = normalizeEvidenceInput(input);
    const result = await store.createEvidenceWithEvent(payload, evidenceEventPayload(payload));
    return {
      evidence: sanitizeEvidence(result.evidence),
      event: result.event ? sanitizeEvent(result.event) : null,
      idempotent: result.idempotent === true
    };
  }

  async function listEvidences(input = {}) {
    const result = await store.listEvidencesByProject(normalizeFilters(input, "evidence"));
    return { evidences: (result.items || []).map(sanitizeEvidence), page: result.page };
  }

  async function listTimeline(input = {}) {
    const result = await store.listTimelineByProject(normalizeFilters(input, "timeline"));
    return { events: (result.items || []).map(sanitizeEvent), page: result.page };
  }

  return { createEvidence, listEvidences, listTimeline };
}
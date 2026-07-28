import { createHash } from "node:crypto";

const EVIDENCE_TYPES = new Set(["text", "photo", "document", "other"]);
const SOURCES = new Set(["manual", "upload", "system"]);
const EVIDENCE_STATUSES = new Set(["draft", "registered"]);
const EVENT_TYPES = new Set(["evidence_registered", "manual_note"]);

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeError(code, status = 400) {
  return Object.assign(new Error(code), { status });
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
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

function hashContent(input = {}) {
  const content = clean(input.content || input.file_content || input.fileContent, 200000);
  if (!content) return null;
  return createHash("sha256").update(content).digest("hex");
}

function normalizeEvidenceInput(input = {}) {
  const scope = requireScope(input);
  const evidenceType = clean(input.evidence_type || input.evidenceType, 80) || "text";
  const source = clean(input.source, 80) || "manual";
  const status = clean(input.status, 80) || "draft";
  const title = clean(input.title, 240);
  if (!EVIDENCE_TYPES.has(evidenceType)) throw safeError("invalid_evidence_type");
  if (!SOURCES.has(source)) throw safeError("invalid_evidence_source");
  if (!EVIDENCE_STATUSES.has(status)) throw safeError("invalid_evidence_status");
  if (!title) throw safeError("evidence_title_required");

  return Object.assign({}, scope, {
    created_by: clean(input.created_by || input.createdBy, 140) || null,
    evidence_type: evidenceType,
    source,
    title,
    description: clean(input.description, 4000) || null,
    storage_path: clean(input.storage_path || input.storagePath, 1000) || null,
    file_hash: clean(input.file_hash || input.fileHash, 160) || hashContent(input),
    mime_type: clean(input.mime_type || input.mimeType, 160) || null,
    metadata: normalizeMetadata(input.metadata),
    status
  });
}

function normalizeEventInput(input = {}) {
  const scope = requireScope(input);
  const eventType = clean(input.event_type || input.eventType, 80) || "manual_note";
  const title = clean(input.title, 240);
  if (!EVENT_TYPES.has(eventType)) throw safeError("invalid_event_type");
  if (!title) throw safeError("event_title_required");

  return Object.assign({}, scope, {
    evidence_id: clean(input.evidence_id || input.evidenceId, 140) || null,
    event_type: eventType,
    title,
    description: clean(input.description, 4000) || null,
    occurred_at: clean(input.occurred_at || input.occurredAt, 80) || new Date().toISOString(),
    created_by: clean(input.created_by || input.createdBy, 140) || null,
    metadata: normalizeMetadata(input.metadata)
  });
}

export function createEloSentinelService(options = {}) {
  const store = options.store;
  if (!store) throw safeError("elo_sentinel_store_required", 500);

  async function createEvidence(input = {}) {
    const payload = normalizeEvidenceInput(input);
    const evidence = await store.createEvidence(payload);
    const event = await store.createEvent({
      institution_id: payload.institution_id,
      company_id: payload.company_id,
      project_id: payload.project_id,
      evidence_id: evidence.id,
      event_type: "evidence_registered",
      title: payload.title,
      description: payload.description,
      created_by: payload.created_by,
      metadata: { evidence_type: payload.evidence_type, source: payload.source }
    });
    return { evidence, event };
  }

  async function listEvidences(input = {}) {
    const scope = requireScope(input);
    return store.listEvidences(scope);
  }

  async function createEvent(input = {}) {
    return store.createEvent(normalizeEventInput(input));
  }

  async function listTimeline(input = {}) {
    const scope = requireScope(input);
    return store.listTimeline(scope);
  }

  return { createEvidence, listEvidences, createEvent, listTimeline };
}

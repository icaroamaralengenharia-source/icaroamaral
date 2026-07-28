const TABLES = new Set(["elo_sentinel_evidences", "elo_sentinel_events"]);

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function safeError(code, status = 500) {
  return Object.assign(new Error(code), { status });
}

function now() {
  return new Date().toISOString();
}

function assertTable(table) {
  if (!TABLES.has(table)) throw safeError("unsupported_sentinel_table", 500);
}

function assertScope(scope = {}) {
  const institutionId = clean(scope.institution_id || scope.institutionId, 140);
  const companyId = clean(scope.company_id || scope.companyId, 140);
  const projectId = clean(scope.project_id || scope.projectId, 140);
  if (!institutionId) throw safeError("institution_id_required", 400);
  if (!companyId) throw safeError("company_id_required", 400);
  if (!projectId) throw safeError("project_id_required", 400);
  return { institution_id: institutionId, company_id: companyId, project_id: projectId };
}

function rethrowStoreError(error, fallbackCode = "elo_sentinel_store_failed") {
  if (!error) return;
  const message = clean(error.code || error.message || fallbackCode, 160);
  const status = Number(error.status || error.statusCode) || 502;
  throw safeError(message || fallbackCode, status);
}

function normalizeEvidence(row) {
  if (!row) return null;
  return {
    id: row.id,
    institution_id: row.institution_id,
    company_id: row.company_id,
    project_id: row.project_id,
    created_by: row.created_by || null,
    evidence_type: row.evidence_type,
    source: row.source,
    title: row.title,
    description: row.description || null,
    storage_path: row.storage_path || null,
    file_hash: row.file_hash || null,
    mime_type: row.mime_type || null,
    metadata: row.metadata || {},
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    institution_id: row.institution_id,
    company_id: row.company_id,
    project_id: row.project_id,
    evidence_id: row.evidence_id || null,
    event_type: row.event_type,
    title: row.title,
    description: row.description || null,
    occurred_at: row.occurred_at,
    created_by: row.created_by || null,
    metadata: row.metadata || {},
    created_at: row.created_at
  };
}

export function createEloSentinelStore(options = {}) {
  const client = options.client || null;

  function database() {
    if (!client) throw safeError("elo_sentinel_database_not_configured", 503);
    return client;
  }

  async function createEvidence(input = {}) {
    const scope = assertScope(input);
    assertTable("elo_sentinel_evidences");
    const payload = Object.assign({}, input, scope, {
      created_by: clean(input.created_by || input.createdBy, 140) || null,
      evidence_type: clean(input.evidence_type || input.evidenceType, 80),
      source: clean(input.source, 80),
      title: clean(input.title, 240),
      description: clean(input.description, 4000) || null,
      storage_path: clean(input.storage_path || input.storagePath, 1000) || null,
      file_hash: clean(input.file_hash || input.fileHash, 160) || null,
      mime_type: clean(input.mime_type || input.mimeType, 160) || null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
      status: clean(input.status, 80) || "draft"
    });
    const result = await database().from("elo_sentinel_evidences").insert(payload).select("*").single();
    rethrowStoreError(result.error);
    return clone(normalizeEvidence(result.data));
  }

  async function listEvidences(scopeInput = {}) {
    const scope = assertScope(scopeInput);
    assertTable("elo_sentinel_evidences");
    const result = await database()
      .from("elo_sentinel_evidences")
      .select("*")
      .eq("institution_id", scope.institution_id)
      .eq("company_id", scope.company_id)
      .eq("project_id", scope.project_id)
      .order("created_at", { ascending: false });
    rethrowStoreError(result.error);
    return (result.data || []).map((item) => clone(normalizeEvidence(item)));
  }

  async function createEvent(input = {}) {
    const scope = assertScope(input);
    assertTable("elo_sentinel_events");
    const payload = Object.assign({}, input, scope, {
      evidence_id: clean(input.evidence_id || input.evidenceId, 140) || null,
      event_type: clean(input.event_type || input.eventType, 80),
      title: clean(input.title, 240),
      description: clean(input.description, 4000) || null,
      occurred_at: clean(input.occurred_at || input.occurredAt, 80) || now(),
      created_by: clean(input.created_by || input.createdBy, 140) || null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
    });
    const result = await database().from("elo_sentinel_events").insert(payload).select("*").single();
    rethrowStoreError(result.error);
    return clone(normalizeEvent(result.data));
  }

  async function listTimeline(scopeInput = {}) {
    const scope = assertScope(scopeInput);
    assertTable("elo_sentinel_events");
    const result = await database()
      .from("elo_sentinel_events")
      .select("*")
      .eq("institution_id", scope.institution_id)
      .eq("company_id", scope.company_id)
      .eq("project_id", scope.project_id)
      .order("occurred_at", { ascending: false });
    rethrowStoreError(result.error);
    return (result.data || []).map((item) => clone(normalizeEvent(item)));
  }

  return { createEvidence, listEvidences, createEvent, listTimeline };
}

export function createEloSentinelMemoryStore() {
  const evidences = [];
  const events = [];

  function nextId(prefix, list) {
    return prefix + "-" + String(list.length + 1).padStart(4, "0");
  }

  return {
    async createEvidence(input = {}) {
      const scope = assertScope(input);
      const row = normalizeEvidence(Object.assign({}, input, scope, {
        id: input.id || nextId("evidence", evidences),
        created_by: input.created_by || input.createdBy || null,
        evidence_type: input.evidence_type || input.evidenceType,
        storage_path: input.storage_path || input.storagePath || null,
        file_hash: input.file_hash || input.fileHash || null,
        mime_type: input.mime_type || input.mimeType || null,
        metadata: input.metadata || {},
        status: input.status || "draft",
        created_at: input.created_at || now(),
        updated_at: input.updated_at || now()
      }));
      evidences.push(row);
      return clone(row);
    },
    async listEvidences(scopeInput = {}) {
      const scope = assertScope(scopeInput);
      return evidences
        .filter((item) => item.institution_id === scope.institution_id && item.company_id === scope.company_id && item.project_id === scope.project_id)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .map((item) => clone(item));
    },
    async createEvent(input = {}) {
      const scope = assertScope(input);
      const row = normalizeEvent(Object.assign({}, input, scope, {
        id: input.id || nextId("event", events),
        evidence_id: input.evidence_id || input.evidenceId || null,
        event_type: input.event_type || input.eventType,
        occurred_at: input.occurred_at || input.occurredAt || now(),
        created_by: input.created_by || input.createdBy || null,
        metadata: input.metadata || {},
        created_at: input.created_at || now()
      }));
      events.push(row);
      return clone(row);
    },
    async listTimeline(scopeInput = {}) {
      const scope = assertScope(scopeInput);
      return events
        .filter((item) => item.institution_id === scope.institution_id && item.company_id === scope.company_id && item.project_id === scope.project_id)
        .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
        .map((item) => clone(item));
    }
  };
}

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
    occurred_at: row.occurred_at || row.created_at,
    idempotency_key: row.idempotency_key || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeEvent(row, evidence = null) {
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
    evidence: evidence ? {
      id: evidence.id,
      evidence_type: evidence.evidence_type,
      source: evidence.source,
      title: evidence.title,
      status: evidence.status,
      storage_path: evidence.storage_path || null,
      file_hash: evidence.file_hash || null
    } : null,
    created_at: row.created_at
  };
}

function applyFilters(query, filters = {}) {
  if (filters.evidence_type) query = query.eq("evidence_type", filters.evidence_type);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.event_type) query = query.eq("event_type", filters.event_type);
  if (filters.date_from) query = query.gte(filters.dateField || "occurred_at", filters.date_from);
  if (filters.date_to) query = query.lte(filters.dateField || "occurred_at", filters.date_to);
  return query;
}

function pageResult(items, page) {
  const limit = Number(page.limit) || 50;
  const offset = Number(page.offset) || 0;
  const hasMore = items.length > limit;
  return {
    items: hasMore ? items.slice(0, limit) : items,
    page: { limit, offset, next_offset: hasMore ? offset + limit : null, has_more: hasMore }
  };
}

export function createEloSentinelStore(options = {}) {
  const client = options.client || null;

  function database() {
    if (!client) throw safeError("elo_sentinel_database_not_configured", 503);
    return client;
  }

  async function insertEvidence(input = {}) {
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
      status: clean(input.status, 80) || "registered",
      occurred_at: clean(input.occurred_at || input.occurredAt, 80) || now(),
      idempotency_key: clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160) || null
    });
    const result = await database().from("elo_sentinel_evidences").insert(payload).select("*").single();
    rethrowStoreError(result.error);
    return clone(normalizeEvidence(result.data));
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

  async function deleteEvidence(id, scopeInput = {}) {
    const scope = assertScope(scopeInput);
    const result = await database()
      .from("elo_sentinel_evidences")
      .delete()
      .eq("id", clean(id, 140))
      .eq("institution_id", scope.institution_id)
      .eq("company_id", scope.company_id)
      .eq("project_id", scope.project_id)
      .select("id")
      .maybeSingle();
    rethrowStoreError(result.error);
    return Boolean(result.data);
  }

  async function findEvidenceById(id, scopeInput = {}) {
    const scope = assertScope(scopeInput);
    const result = await database()
      .from("elo_sentinel_evidences")
      .select("*")
      .eq("id", clean(id, 140))
      .eq("institution_id", scope.institution_id)
      .eq("company_id", scope.company_id)
      .eq("project_id", scope.project_id)
      .maybeSingle();
    rethrowStoreError(result.error);
    return result.data ? clone(normalizeEvidence(result.data)) : null;
  }

  async function findEvidenceByIdempotencyKey(input = {}) {
    const scope = assertScope(input);
    const key = clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160);
    if (!key) return null;
    const result = await database()
      .from("elo_sentinel_evidences")
      .select("*")
      .eq("institution_id", scope.institution_id)
      .eq("company_id", scope.company_id)
      .eq("project_id", scope.project_id)
      .eq("idempotency_key", key)
      .maybeSingle();
    rethrowStoreError(result.error);
    return result.data ? clone(normalizeEvidence(result.data)) : null;
  }

  async function findEventForEvidence(evidenceId, scopeInput = {}) {
    const scope = assertScope(scopeInput);
    const result = await database()
      .from("elo_sentinel_events")
      .select("*")
      .eq("institution_id", scope.institution_id)
      .eq("company_id", scope.company_id)
      .eq("project_id", scope.project_id)
      .eq("evidence_id", clean(evidenceId, 140))
      .eq("event_type", "evidence_created")
      .maybeSingle();
    rethrowStoreError(result.error);
    return result.data ? clone(normalizeEvent(result.data)) : null;
  }

  async function createEvidenceWithEvent(input = {}, eventInput = {}) {
    const scope = assertScope(input);
    const existing = await findEvidenceByIdempotencyKey(input);
    if (existing) {
      return { evidence: existing, event: await findEventForEvidence(existing.id, scope), idempotent: true };
    }
    const evidence = await insertEvidence(input);
    try {
      const event = await createEvent(Object.assign({}, eventInput, scope, { evidence_id: evidence.id }));
      return { evidence, event, idempotent: false };
    } catch (error) {
      await deleteEvidence(evidence.id, scope).catch(() => false);
      throw error;
    }
  }

  async function listEvidencesByProject(input = {}) {
    const scope = assertScope(input);
    const limit = Number(input.limit) || 50;
    const offset = Number(input.offset) || 0;
    let query = database()
      .from("elo_sentinel_evidences")
      .select("*")
      .eq("institution_id", scope.institution_id)
      .eq("company_id", scope.company_id)
      .eq("project_id", scope.project_id);
    query = applyFilters(query, Object.assign({}, input, { dateField: "occurred_at" }));
    query = query.order("occurred_at", { ascending: false }).range(offset, offset + limit);
    const result = await query;
    rethrowStoreError(result.error);
    const normalized = (result.data || []).map((item) => clone(normalizeEvidence(item)));
    return pageResult(normalized, { limit, offset });
  }

  async function listTimelineByProject(input = {}) {
    const scope = assertScope(input);
    const limit = Number(input.limit) || 50;
    const offset = Number(input.offset) || 0;
    let query = database()
      .from("elo_sentinel_events")
      .select("*")
      .eq("institution_id", scope.institution_id)
      .eq("company_id", scope.company_id)
      .eq("project_id", scope.project_id);
    query = applyFilters(query, Object.assign({}, input, { dateField: "occurred_at" }));
    query = query.order("occurred_at", { ascending: false }).range(offset, offset + limit);
    const result = await query;
    rethrowStoreError(result.error);
    const normalized = await Promise.all((result.data || []).map(async (item) => {
      const event = normalizeEvent(item);
      if (event.evidence_id) {
        const evidence = await findEvidenceById(event.evidence_id, scope);
        return clone(normalizeEvent(item, evidence));
      }
      return clone(event);
    }));
    return pageResult(normalized, { limit, offset });
  }

  return {
    createEvidence: insertEvidence,
    listEvidences: (scope) => listEvidencesByProject(scope).then((result) => result.items),
    createEvent,
    listTimeline: (scope) => listTimelineByProject(scope).then((result) => result.items),
    createEvidenceWithEvent,
    findEvidenceById,
    findEvidenceByIdempotencyKey,
    listEvidencesByProject,
    listTimelineByProject
  };
}

export function createEloSentinelMemoryStore() {
  const evidences = [];
  const events = [];

  function nextId(prefix, list) {
    return prefix + "-" + String(list.length + 1).padStart(4, "0");
  }

  function matchesScope(item, scope) {
    return item.institution_id === scope.institution_id && item.company_id === scope.company_id && item.project_id === scope.project_id;
  }

  function matchesFilters(item, filters = {}) {
    if (filters.evidence_type && item.evidence_type !== filters.evidence_type) return false;
    if (filters.source && item.source !== filters.source) return false;
    if (filters.event_type && item.event_type !== filters.event_type) return false;
    if (filters.date_from && String(item.occurred_at || item.created_at) < filters.date_from) return false;
    if (filters.date_to && String(item.occurred_at || item.created_at) > filters.date_to) return false;
    return true;
  }

  async function findEvidenceById(id, scopeInput = {}) {
    const scope = assertScope(scopeInput);
    const item = evidences.find((evidence) => evidence.id === clean(id, 140) && matchesScope(evidence, scope));
    return item ? clone(item) : null;
  }

  async function findEvidenceByIdempotencyKey(input = {}) {
    const scope = assertScope(input);
    const key = clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160);
    if (!key) return null;
    const item = evidences.find((evidence) => matchesScope(evidence, scope) && evidence.idempotency_key === key);
    return item ? clone(item) : null;
  }

  function eventForEvidence(evidenceId, scope) {
    return events.find((event) => event.evidence_id === evidenceId && event.event_type === "evidence_created" && matchesScope(event, scope));
  }

  async function createEvidence(input = {}) {
    const scope = assertScope(input);
    const row = normalizeEvidence(Object.assign({}, input, scope, {
      id: input.id || nextId("evidence", evidences),
      created_by: input.created_by || input.createdBy || null,
      evidence_type: input.evidence_type || input.evidenceType,
      storage_path: input.storage_path || input.storagePath || null,
      file_hash: input.file_hash || input.fileHash || null,
      mime_type: input.mime_type || input.mimeType || null,
      metadata: input.metadata || {},
      status: input.status || "registered",
      occurred_at: input.occurred_at || input.occurredAt || now(),
      idempotency_key: input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId || null,
      created_at: input.created_at || now(),
      updated_at: input.updated_at || now()
    }));
    evidences.push(row);
    return clone(row);
  }

  async function createEvent(input = {}) {
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
  }

  async function createEvidenceWithEvent(input = {}, eventInput = {}) {
    const scope = assertScope(input);
    const existing = await findEvidenceByIdempotencyKey(input);
    if (existing) return { evidence: existing, event: clone(eventForEvidence(existing.id, scope) || null), idempotent: true };
    const evidence = await createEvidence(input);
    try {
      const event = await createEvent(Object.assign({}, eventInput, scope, { evidence_id: evidence.id }));
      return { evidence, event, idempotent: false };
    } catch (error) {
      const index = evidences.findIndex((item) => item.id === evidence.id && matchesScope(item, scope));
      if (index >= 0) evidences.splice(index, 1);
      throw error;
    }
  }

  async function listEvidencesByProject(input = {}) {
    const scope = assertScope(input);
    const limit = Number(input.limit) || 50;
    const offset = Number(input.offset) || 0;
    const items = evidences
      .filter((item) => matchesScope(item, scope) && matchesFilters(item, input))
      .sort((a, b) => String(b.occurred_at || b.created_at).localeCompare(String(a.occurred_at || a.created_at)));
    return pageResult(items.slice(offset, offset + limit + 1).map((item) => clone(item)), { limit, offset });
  }

  async function listTimelineByProject(input = {}) {
    const scope = assertScope(input);
    const limit = Number(input.limit) || 50;
    const offset = Number(input.offset) || 0;
    const items = events
      .filter((item) => matchesScope(item, scope) && matchesFilters(item, input))
      .sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)))
      .map((event) => normalizeEvent(event, evidences.find((evidence) => evidence.id === event.evidence_id && matchesScope(evidence, scope)) || null));
    return pageResult(items.slice(offset, offset + limit + 1).map((item) => clone(item)), { limit, offset });
  }

  return {
    createEvidence,
    listEvidences: (scope) => listEvidencesByProject(scope).then((result) => result.items),
    createEvent,
    listTimeline: (scope) => listTimelineByProject(scope).then((result) => result.items),
    createEvidenceWithEvent,
    findEvidenceById,
    findEvidenceByIdempotencyKey,
    listEvidencesByProject,
    listTimelineByProject
  };
}

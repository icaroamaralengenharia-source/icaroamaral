const TABLES = new Set(["elo_sentinel_evidences", "elo_sentinel_events", "elo_sentinel_pending_items", "elo_sentinel_pending_item_evidences"]);

function clean(value, max = 4000) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function clone(value) { return JSON.parse(JSON.stringify(value || null)); }
function safeError(code, status = 500) { return Object.assign(new Error(code), { status }); }
function now() { return new Date().toISOString(); }
function assertTable(table) { if (!TABLES.has(table)) throw safeError("unsupported_sentinel_table", 500); }
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
function scoped(item, scope) { return item && item.institution_id === scope.institution_id && item.company_id === scope.company_id && item.project_id === scope.project_id; }
function pageResult(items, page) {
  const limit = Number(page.limit) || 50;
  const offset = Number(page.offset) || 0;
  const hasMore = items.length > limit;
  return { items: hasMore ? items.slice(0, limit) : items, page: { limit, offset, next_offset: hasMore ? offset + limit : null, has_more: hasMore } };
}
function normalizeEvidence(row) {
  if (!row) return null;
  return {
    id: row.id, institution_id: row.institution_id, company_id: row.company_id, project_id: row.project_id,
    created_by: row.created_by || null, evidence_type: row.evidence_type, source: row.source, title: row.title,
    description: row.description || null, storage_path: row.storage_path || null, file_hash: row.file_hash || null,
    mime_type: row.mime_type || null, metadata: row.metadata || {}, status: row.status,
    occurred_at: row.occurred_at || row.created_at, idempotency_key: row.idempotency_key || null,
    created_at: row.created_at, updated_at: row.updated_at
  };
}
function evidenceSummary(evidence) {
  if (!evidence) return null;
  return { id: evidence.id, evidence_type: evidence.evidence_type, source: evidence.source, title: evidence.title, status: evidence.status, storage_path: evidence.storage_path || null, file_hash: evidence.file_hash || null };
}
function normalizeEvent(row, evidence = null) {
  if (!row) return null;
  return {
    id: row.id, institution_id: row.institution_id, company_id: row.company_id, project_id: row.project_id,
    evidence_id: row.evidence_id || null, event_type: row.event_type, title: row.title, description: row.description || null,
    occurred_at: row.occurred_at, created_by: row.created_by || null, metadata: row.metadata || {}, evidence: evidenceSummary(evidence), created_at: row.created_at
  };
}
function normalizePending(row, evidences = []) {
  if (!row) return null;
  return {
    id: row.id, institution_id: row.institution_id, company_id: row.company_id, project_id: row.project_id,
    source_evidence_id: row.source_evidence_id || null, title: row.title, description: row.description || null,
    category: row.category || null, priority: row.priority, severity: row.severity, status: row.status,
    responsible_user_id: row.responsible_user_id || null, due_at: row.due_at || null, suggested_by: row.suggested_by || null,
    created_by: row.created_by || null, validated_by: row.validated_by || null, validated_at: row.validated_at || null,
    validation_status: row.validation_status, resolution_notes: row.resolution_notes || null, resolved_at: row.resolved_at || null,
    metadata: row.metadata || {}, idempotency_key: row.idempotency_key || null, evidences,
    created_at: row.created_at, updated_at: row.updated_at
  };
}
function normalizeLink(row, evidence = null) {
  if (!row) return null;
  return {
    id: row.id, institution_id: row.institution_id, company_id: row.company_id, project_id: row.project_id,
    pending_item_id: row.pending_item_id, evidence_id: row.evidence_id, relation_type: row.relation_type,
    created_by: row.created_by || null, created_at: row.created_at, evidence: evidenceSummary(evidence)
  };
}
function applyCommonFilters(query, filters = {}, dateField = "occurred_at") {
  if (filters.date_from) query = query.gte(dateField, filters.date_from);
  if (filters.date_to) query = query.lte(dateField, filters.date_to);
  return query;
}
function applyPendingFilters(query, filters = {}) {
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.severity) query = query.eq("severity", filters.severity);
  if (filters.responsible_user_id) query = query.eq("responsible_user_id", filters.responsible_user_id);
  if (filters.due_from) query = query.gte("due_at", filters.due_from);
  if (filters.due_to) query = query.lte("due_at", filters.due_to);
  return query;
}

export function createEloSentinelStore(options = {}) {
  const client = options.client || null;
  function database() { if (!client) throw safeError("elo_sentinel_database_not_configured", 503); return client; }

  async function insert(table, payload, normalize) { assertTable(table); const result = await database().from(table).insert(payload).select("*").single(); rethrowStoreError(result.error); return clone(normalize(result.data)); }
  async function updateRow(table, id, scopeInput, payload, normalize) {
    const scope = assertScope(scopeInput); assertTable(table);
    const result = await database().from(table).update(payload).eq("id", clean(id, 140)).eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).select("*").maybeSingle();
    rethrowStoreError(result.error); return result.data ? clone(normalize(result.data)) : null;
  }

  async function createEvidence(input = {}) {
    const scope = assertScope(input);
    return insert("elo_sentinel_evidences", Object.assign({}, input, scope, {
      created_by: clean(input.created_by || input.createdBy, 140) || null,
      evidence_type: clean(input.evidence_type || input.evidenceType, 80), source: clean(input.source, 80), title: clean(input.title, 240),
      description: clean(input.description, 4000) || null, storage_path: clean(input.storage_path || input.storagePath, 1000) || null,
      file_hash: clean(input.file_hash || input.fileHash, 160) || null, mime_type: clean(input.mime_type || input.mimeType, 160) || null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}, status: clean(input.status, 80) || "registered",
      occurred_at: clean(input.occurred_at || input.occurredAt, 80) || now(), idempotency_key: clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160) || null
    }), normalizeEvidence);
  }
  async function createEvent(input = {}) {
    const scope = assertScope(input);
    return insert("elo_sentinel_events", Object.assign({}, input, scope, {
      evidence_id: clean(input.evidence_id || input.evidenceId, 140) || null,
      event_type: clean(input.event_type || input.eventType, 80), title: clean(input.title, 240), description: clean(input.description, 4000) || null,
      occurred_at: clean(input.occurred_at || input.occurredAt, 80) || now(), created_by: clean(input.created_by || input.createdBy, 140) || null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}
    }), normalizeEvent);
  }
  async function deleteEvidence(id, scopeInput = {}) { const scope = assertScope(scopeInput); const result = await database().from("elo_sentinel_evidences").delete().eq("id", clean(id, 140)).eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).select("id").maybeSingle(); rethrowStoreError(result.error); return Boolean(result.data); }
  async function findEvidenceById(id, scopeInput = {}) { const scope = assertScope(scopeInput); const result = await database().from("elo_sentinel_evidences").select("*").eq("id", clean(id, 140)).eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).maybeSingle(); rethrowStoreError(result.error); return result.data ? clone(normalizeEvidence(result.data)) : null; }
  async function findEvidenceByIdempotencyKey(input = {}) { const scope = assertScope(input); const key = clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160); if (!key) return null; const result = await database().from("elo_sentinel_evidences").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).eq("idempotency_key", key).maybeSingle(); rethrowStoreError(result.error); return result.data ? clone(normalizeEvidence(result.data)) : null; }
  async function findEventForEvidence(evidenceId, scopeInput = {}) { const scope = assertScope(scopeInput); const result = await database().from("elo_sentinel_events").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).eq("evidence_id", clean(evidenceId, 140)).eq("event_type", "evidence_created").maybeSingle(); rethrowStoreError(result.error); return result.data ? clone(normalizeEvent(result.data)) : null; }
  async function createEvidenceWithEvent(input = {}, eventInput = {}) { const scope = assertScope(input); const existing = await findEvidenceByIdempotencyKey(input); if (existing) return { evidence: existing, event: await findEventForEvidence(existing.id, scope), idempotent: true }; const evidence = await createEvidence(input); try { const event = await createEvent(Object.assign({}, eventInput, scope, { evidence_id: evidence.id })); return { evidence, event, idempotent: false }; } catch (error) { await deleteEvidence(evidence.id, scope).catch(() => false); throw error; } }
  async function listEvidencesByProject(input = {}) { const scope = assertScope(input); const limit = Number(input.limit) || 50; const offset = Number(input.offset) || 0; let query = database().from("elo_sentinel_evidences").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id); if (input.evidence_type) query = query.eq("evidence_type", input.evidence_type); if (input.source) query = query.eq("source", input.source); query = applyCommonFilters(query, input, "occurred_at").order("occurred_at", { ascending: false }).range(offset, offset + limit); const result = await query; rethrowStoreError(result.error); return pageResult((result.data || []).map((item) => clone(normalizeEvidence(item))), { limit, offset }); }
  async function listTimelineByProject(input = {}) { const scope = assertScope(input); const limit = Number(input.limit) || 50; const offset = Number(input.offset) || 0; let query = database().from("elo_sentinel_events").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id); if (input.event_type) query = query.eq("event_type", input.event_type); query = applyCommonFilters(query, input, "occurred_at").order("occurred_at", { ascending: false }).range(offset, offset + limit); const result = await query; rethrowStoreError(result.error); const items = await Promise.all((result.data || []).map(async (item) => { const event = normalizeEvent(item); const evidence = event.evidence_id ? await findEvidenceById(event.evidence_id, scope) : null; return clone(normalizeEvent(item, evidence)); })); return pageResult(items, { limit, offset }); }

  async function createPendingItem(input = {}) { const scope = assertScope(input); return insert("elo_sentinel_pending_items", Object.assign({}, input, scope, { source_evidence_id: clean(input.source_evidence_id || input.sourceEvidenceId, 140) || null, title: clean(input.title, 240), description: clean(input.description, 6000) || null, category: clean(input.category, 120) || null, priority: clean(input.priority, 40), severity: clean(input.severity, 40), status: clean(input.status, 40), responsible_user_id: clean(input.responsible_user_id || input.responsibleUserId, 140) || null, due_at: clean(input.due_at || input.dueAt, 80) || null, suggested_by: clean(input.suggested_by || input.suggestedBy, 80) || null, created_by: clean(input.created_by || input.createdBy, 140) || null, validation_status: clean(input.validation_status || input.validationStatus, 40) || "pending", resolution_notes: clean(input.resolution_notes || input.resolutionNotes, 6000) || null, metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {}, idempotency_key: clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160) || null }), normalizePending); }
  async function findPendingItemById(id, scopeInput = {}) { const scope = assertScope(scopeInput); const result = await database().from("elo_sentinel_pending_items").select("*").eq("id", clean(id, 140)).eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).maybeSingle(); rethrowStoreError(result.error); if (!result.data) return null; return clone(normalizePending(result.data, await listPendingItemEvidences(result.data.id, scope))); }
  async function findPendingItemByIdempotencyKey(input = {}) { const scope = assertScope(input); const key = clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160); if (!key) return null; const result = await database().from("elo_sentinel_pending_items").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).eq("idempotency_key", key).maybeSingle(); rethrowStoreError(result.error); return result.data ? clone(normalizePending(result.data, await listPendingItemEvidences(result.data.id, scope))) : null; }
  async function listPendingItemsByProject(input = {}) { const scope = assertScope(input); const limit = Number(input.limit) || 50; const offset = Number(input.offset) || 0; let query = database().from("elo_sentinel_pending_items").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id); query = applyPendingFilters(query, input).order("priority", { ascending: true }).order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).range(offset, offset + limit); const result = await query; rethrowStoreError(result.error); const items = await Promise.all((result.data || []).map(async (item) => normalizePending(item, await listPendingItemEvidences(item.id, scope)))); return pageResult(items.map((item) => clone(item)), { limit, offset }); }
  async function updatePendingItem(id, scopeInput = {}, patch = {}) { const payload = Object.assign({}, patch, { updated_at: now() }); const item = await updateRow("elo_sentinel_pending_items", id, scopeInput, payload, (row) => normalizePending(row)); return item ? clone(normalizePending(item, await listPendingItemEvidences(item.id, scopeInput))) : null; }
  async function linkEvidenceToPendingItem(input = {}) { const scope = assertScope(input); const pendingId = clean(input.pending_item_id || input.pendingItemId, 140); const evidenceId = clean(input.evidence_id || input.evidenceId, 140); const existing = await database().from("elo_sentinel_pending_item_evidences").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).eq("pending_item_id", pendingId).eq("evidence_id", evidenceId).eq("relation_type", clean(input.relation_type || input.relationType, 40)).maybeSingle(); rethrowStoreError(existing.error); if (existing.data) return { link: clone(normalizeLink(existing.data, await findEvidenceById(evidenceId, scope))), idempotent: true }; const link = await insert("elo_sentinel_pending_item_evidences", Object.assign({}, input, scope, { pending_item_id: pendingId, evidence_id: evidenceId, relation_type: clean(input.relation_type || input.relationType, 40), created_by: clean(input.created_by || input.createdBy, 140) || null }), (row) => normalizeLink(row)); return { link: clone(normalizeLink(link, await findEvidenceById(evidenceId, scope))), idempotent: false }; }
  async function listPendingItemEvidences(pendingItemId, scopeInput = {}) { const scope = assertScope(scopeInput); const result = await database().from("elo_sentinel_pending_item_evidences").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).eq("pending_item_id", clean(pendingItemId, 140)).order("created_at", { ascending: true }); rethrowStoreError(result.error); const items = await Promise.all((result.data || []).map(async (link) => normalizeLink(link, await findEvidenceById(link.evidence_id, scope)))); return items.map((item) => clone(item)); }
  async function listPendingItemEvents(pendingItemId, scopeInput = {}) { const scope = assertScope(scopeInput); const result = await database().from("elo_sentinel_events").select("*").eq("institution_id", scope.institution_id).eq("company_id", scope.company_id).eq("project_id", scope.project_id).order("occurred_at", { ascending: false }); rethrowStoreError(result.error); return (result.data || []).filter((event) => event.metadata && event.metadata.pending_item_id === pendingItemId).map((event) => clone(normalizeEvent(event))); }

  return { createEvidence, listEvidences: (scope) => listEvidencesByProject(scope).then((result) => result.items), createEvent, listTimeline: (scope) => listTimelineByProject(scope).then((result) => result.items), createEvidenceWithEvent, findEvidenceById, findEvidenceByIdempotencyKey, listEvidencesByProject, listTimelineByProject, createPendingItem, findPendingItemById, findPendingItemByIdempotencyKey, listPendingItemsByProject, updatePendingItem, linkEvidenceToPendingItem, listPendingItemEvidences, listPendingItemEvents };
}

export function createEloSentinelMemoryStore() {
  const evidences = []; const events = []; const pendingItems = []; const pendingLinks = [];
  function nextId(prefix, list) { return prefix + "-" + String(list.length + 1).padStart(4, "0"); }
  function matchesFilters(item, filters = {}) { if (filters.evidence_type && item.evidence_type !== filters.evidence_type) return false; if (filters.source && item.source !== filters.source) return false; if (filters.event_type && item.event_type !== filters.event_type) return false; if (filters.status && item.status !== filters.status) return false; if (filters.priority && item.priority !== filters.priority) return false; if (filters.severity && item.severity !== filters.severity) return false; if (filters.responsible_user_id && item.responsible_user_id !== filters.responsible_user_id) return false; if (filters.date_from && String(item.occurred_at || item.created_at) < filters.date_from) return false; if (filters.date_to && String(item.occurred_at || item.created_at) > filters.date_to) return false; if (filters.due_from && String(item.due_at || "") < filters.due_from) return false; if (filters.due_to && String(item.due_at || "9999") > filters.due_to) return false; return true; }
  async function findEvidenceById(id, scopeInput = {}) { const scope = assertScope(scopeInput); const item = evidences.find((evidence) => evidence.id === clean(id, 140) && scoped(evidence, scope)); return item ? clone(item) : null; }
  async function findEvidenceByIdempotencyKey(input = {}) { const scope = assertScope(input); const key = clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160); if (!key) return null; const item = evidences.find((evidence) => scoped(evidence, scope) && evidence.idempotency_key === key); return item ? clone(item) : null; }
  function eventForEvidence(evidenceId, scope) { return events.find((event) => event.evidence_id === evidenceId && event.event_type === "evidence_created" && scoped(event, scope)); }
  async function createEvidence(input = {}) { const scope = assertScope(input); const row = normalizeEvidence(Object.assign({}, input, scope, { id: input.id || nextId("evidence", evidences), created_by: input.created_by || input.createdBy || null, evidence_type: input.evidence_type || input.evidenceType, storage_path: input.storage_path || input.storagePath || null, file_hash: input.file_hash || input.fileHash || null, mime_type: input.mime_type || input.mimeType || null, metadata: input.metadata || {}, status: input.status || "registered", occurred_at: input.occurred_at || input.occurredAt || now(), idempotency_key: input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId || null, created_at: input.created_at || now(), updated_at: input.updated_at || now() })); evidences.push(row); return clone(row); }
  async function createEvent(input = {}) { const scope = assertScope(input); const row = normalizeEvent(Object.assign({}, input, scope, { id: input.id || nextId("event", events), evidence_id: input.evidence_id || input.evidenceId || null, event_type: input.event_type || input.eventType, occurred_at: input.occurred_at || input.occurredAt || now(), created_by: input.created_by || input.createdBy || null, metadata: input.metadata || {}, created_at: input.created_at || now() })); events.push(row); return clone(row); }
  async function createEvidenceWithEvent(input = {}, eventInput = {}) { const scope = assertScope(input); const existing = await findEvidenceByIdempotencyKey(input); if (existing) return { evidence: existing, event: clone(eventForEvidence(existing.id, scope) || null), idempotent: true }; const evidence = await createEvidence(input); try { const event = await createEvent(Object.assign({}, eventInput, scope, { evidence_id: evidence.id })); return { evidence, event, idempotent: false }; } catch (error) { const index = evidences.findIndex((item) => item.id === evidence.id && scoped(item, scope)); if (index >= 0) evidences.splice(index, 1); throw error; } }
  async function listEvidencesByProject(input = {}) { const scope = assertScope(input); const limit = Number(input.limit) || 50; const offset = Number(input.offset) || 0; const items = evidences.filter((item) => scoped(item, scope) && matchesFilters(item, input)).sort((a, b) => String(b.occurred_at || b.created_at).localeCompare(String(a.occurred_at || a.created_at))); return pageResult(items.slice(offset, offset + limit + 1).map((item) => clone(item)), { limit, offset }); }
  async function listTimelineByProject(input = {}) { const scope = assertScope(input); const limit = Number(input.limit) || 50; const offset = Number(input.offset) || 0; const items = events.filter((item) => scoped(item, scope) && matchesFilters(item, input)).sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at))).map((event) => normalizeEvent(event, evidences.find((evidence) => evidence.id === event.evidence_id && scoped(evidence, scope)) || null)); return pageResult(items.slice(offset, offset + limit + 1).map((item) => clone(item)), { limit, offset }); }
  async function createPendingItem(input = {}) { const scope = assertScope(input); const row = normalizePending(Object.assign({}, input, scope, { id: input.id || nextId("pending", pendingItems), source_evidence_id: input.source_evidence_id || input.sourceEvidenceId || null, responsible_user_id: input.responsible_user_id || input.responsibleUserId || null, due_at: input.due_at || input.dueAt || null, suggested_by: input.suggested_by || input.suggestedBy || null, created_by: input.created_by || input.createdBy || null, validated_by: input.validated_by || input.validatedBy || null, validated_at: input.validated_at || input.validatedAt || null, validation_status: input.validation_status || input.validationStatus || "pending", resolution_notes: input.resolution_notes || input.resolutionNotes || null, resolved_at: input.resolved_at || input.resolvedAt || null, metadata: input.metadata || {}, idempotency_key: input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId || null, created_at: input.created_at || now(), updated_at: input.updated_at || now() })); pendingItems.push(row); return clone(row); }
  async function findPendingItemById(id, scopeInput = {}) { const scope = assertScope(scopeInput); const item = pendingItems.find((pending) => pending.id === clean(id, 140) && scoped(pending, scope)); return item ? clone(normalizePending(item, await listPendingItemEvidences(item.id, scope))) : null; }
  async function findPendingItemByIdempotencyKey(input = {}) { const scope = assertScope(input); const key = clean(input.idempotency_key || input.idempotencyKey || input.operation_id || input.operationId, 160); if (!key) return null; const item = pendingItems.find((pending) => scoped(pending, scope) && pending.idempotency_key === key); return item ? clone(normalizePending(item, await listPendingItemEvidences(item.id, scope))) : null; }
  async function listPendingItemsByProject(input = {}) { const scope = assertScope(input); const limit = Number(input.limit) || 50; const offset = Number(input.offset) || 0; const rank = { critical: 0, high: 1, medium: 2, low: 3 }; const items = pendingItems.filter((item) => scoped(item, scope) && matchesFilters(item, input)).sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || String(a.due_at || "9999").localeCompare(String(b.due_at || "9999")) || String(b.created_at).localeCompare(String(a.created_at))); const enriched = await Promise.all(items.slice(offset, offset + limit + 1).map(async (item) => normalizePending(item, await listPendingItemEvidences(item.id, scope)))); return pageResult(enriched.map((item) => clone(item)), { limit, offset }); }
  async function updatePendingItem(id, scopeInput = {}, patch = {}) { const scope = assertScope(scopeInput); const item = pendingItems.find((pending) => pending.id === clean(id, 140) && scoped(pending, scope)); if (!item) return null; Object.assign(item, patch, { updated_at: now() }); return clone(normalizePending(item, await listPendingItemEvidences(item.id, scope))); }
  async function linkEvidenceToPendingItem(input = {}) { const scope = assertScope(input); const pendingId = clean(input.pending_item_id || input.pendingItemId, 140); const evidenceId = clean(input.evidence_id || input.evidenceId, 140); const relationType = clean(input.relation_type || input.relationType, 40); const existing = pendingLinks.find((link) => scoped(link, scope) && link.pending_item_id === pendingId && link.evidence_id === evidenceId && link.relation_type === relationType); if (existing) return { link: clone(normalizeLink(existing, await findEvidenceById(evidenceId, scope))), idempotent: true }; const row = normalizeLink(Object.assign({}, input, scope, { id: input.id || nextId("pending-link", pendingLinks), pending_item_id: pendingId, evidence_id: evidenceId, relation_type: relationType, created_by: input.created_by || input.createdBy || null, created_at: input.created_at || now() })); pendingLinks.push(row); return { link: clone(normalizeLink(row, await findEvidenceById(evidenceId, scope))), idempotent: false }; }
  async function listPendingItemEvidences(pendingItemId, scopeInput = {}) { const scope = assertScope(scopeInput); const links = pendingLinks.filter((link) => scoped(link, scope) && link.pending_item_id === clean(pendingItemId, 140)); return Promise.all(links.map(async (link) => clone(normalizeLink(link, await findEvidenceById(link.evidence_id, scope))))); }
  async function listPendingItemEvents(pendingItemId, scopeInput = {}) { const scope = assertScope(scopeInput); return events.filter((event) => scoped(event, scope) && event.metadata && event.metadata.pending_item_id === clean(pendingItemId, 140)).sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at))).map((event) => clone(normalizeEvent(event))); }
  return { createEvidence, listEvidences: (scope) => listEvidencesByProject(scope).then((result) => result.items), createEvent, listTimeline: (scope) => listTimelineByProject(scope).then((result) => result.items), createEvidenceWithEvent, findEvidenceById, findEvidenceByIdempotencyKey, listEvidencesByProject, listTimelineByProject, createPendingItem, findPendingItemById, findPendingItemByIdempotencyKey, listPendingItemsByProject, updatePendingItem, linkEvidenceToPendingItem, listPendingItemEvidences, listPendingItemEvents };
}
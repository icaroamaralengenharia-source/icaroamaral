import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloSentinelMemoryStore } from "../src/elo-sentinel-store.js";
import { createEloSentinelService } from "../src/elo-sentinel-service.js";

async function withServer(options = {}, callback) {
  const app = createApp({
    env: Object.assign({}, process.env, { ELO_SENTINEL_ENABLED: "true" }, options.env || {}),
    eloSentinelStore: options.store || createEloSentinelMemoryStore(),
    aiHandler: options.aiHandler,
    obraReportTransactionalService: options.obraReportTransactionalService
  });
  app.locals.resolveAuthContext = async (request) => {
    const auth = String(request.headers.authorization || "");
    if (auth === "Bearer tenant-b") {
      return { ok: true, userId: "user-b", institutionId: "inst-b", companyId: "company-b", profile: { id: "profile-b", institution_id: "inst-b", company_id: "company-b" } };
    }
    if (auth !== "Bearer tenant-a") return { ok: false, status: 401, error: "invalid_session" };
    return { ok: true, userId: "user-a", institutionId: "inst-a", companyId: "company-a", profile: { id: "profile-a", institution_id: "inst-a", company_id: "company-a" } };
  };
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(base, method, path, body, token = "tenant-a") {
  const response = await fetch(base + path, {
    method,
    headers: Object.assign({ Authorization: "Bearer " + token }, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

async function createEvidence(base, projectId = "obra-a", title = "Foto") {
  const result = await json(base, "POST", "/api/elo/sentinel/evidences", {
    project_id: projectId,
    evidence_type: "photo",
    title,
    description: "Registro fotografico",
    file_hash: "b".repeat(64)
  });
  assert.equal(result.response.status, 201);
  return result.data.evidence;
}

async function createPending(base, body = {}) {
  const result = await json(base, "POST", "/api/elo/sentinel/pending-items", Object.assign({
    project_id: "obra-a",
    title: "Corrigir fissura",
    description: "Fissura junto ao pilar",
    priority: "high",
    severity: "major"
  }, body));
  return result;
}

test("Fase 3 cria pendencia, vincula evidencia source e lista por status", async () => {
  await withServer({}, async (base) => {
    const evidence = await createEvidence(base);
    const created = await createPending(base, { source_evidence_id: evidence.id, idempotency_key: "pend-1" });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.pending_item.status, "suggested");
    assert.equal(created.data.pending_item.validation_status, "pending");
    assert.equal(created.data.pending_item.evidences[0].relation_type, "source");
    assert.equal(created.data.event.event_type, "pending_item_created");

    const repeat = await createPending(base, { source_evidence_id: evidence.id, idempotency_key: "pend-1" });
    assert.equal(repeat.response.status, 200);
    assert.equal(repeat.data.pending_item.id, created.data.pending_item.id);

    const list = await json(base, "GET", "/api/elo/sentinel/pending-items?project_id=obra-a&status=suggested");
    assert.equal(list.response.status, 200);
    assert.equal(list.data.pending_items.length, 1);
  });
});

test("Fase 3 rejeita contratos invalidos e source_evidence fora da obra", async () => {
  await withServer({}, async (base) => {
    const otherEvidence = await createEvidence(base, "obra-b");
    const noProject = await json(base, "POST", "/api/elo/sentinel/pending-items", { title: "Sem obra" });
    assert.equal(noProject.response.status, 400);
    assert.equal(noProject.data.error, "project_id_required");

    const badPriority = await createPending(base, { priority: "urgent" });
    assert.equal(badPriority.response.status, 400);
    assert.equal(badPriority.data.error, "invalid_priority");

    const badSeverity = await createPending(base, { severity: "huge" });
    assert.equal(badSeverity.response.status, 400);
    assert.equal(badSeverity.data.error, "invalid_severity");

    const crossEvidence = await createPending(base, { source_evidence_id: otherEvidence.id });
    assert.equal(crossEvidence.response.status, 404);
    assert.equal(crossEvidence.data.error, "source_evidence_not_found");
  });
});

test("Fase 3 isola tenant, obra e ignora injecao de tenant no body", async () => {
  await withServer({}, async (base) => {
    const created = await createPending(base, { institution_id: "inst-b", company_id: "company-b" });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.pending_item.institution_id, "inst-a");
    assert.equal(created.data.pending_item.company_id, "company-a");

    const tenantB = await json(base, "GET", "/api/elo/sentinel/pending-items?project_id=obra-a&institution_id=inst-a&company_id=company-a", undefined, "tenant-b");
    assert.equal(tenantB.response.status, 200);
    assert.equal(tenantB.data.pending_items.length, 0);

    const obraB = await json(base, "GET", "/api/elo/sentinel/pending-items?project_id=obra-b");
    assert.equal(obraB.response.status, 200);
    assert.equal(obraB.data.pending_items.length, 0);
  });
});

test("Fase 3 atualiza responsavel, prazo e bloqueia transicoes invalidas", async () => {
  await withServer({}, async (base) => {
    const created = await createPending(base, { status: "open" });
    const id = created.data.pending_item.id;

    const assigned = await json(base, "PUT", `/api/elo/sentinel/pending-items/${id}`, {
      project_id: "obra-a",
      responsible_user_id: "user-tech",
      due_at: "2026-08-01T12:00:00.000Z"
    });
    assert.equal(assigned.response.status, 200);
    assert.equal(assigned.data.pending_item.responsible_user_id, "user-tech");
    assert.ok(assigned.data.events.some((event) => event.event_type === "pending_item_assigned"));
    assert.ok(assigned.data.events.some((event) => event.event_type === "pending_item_due_date_changed"));

    const invalid = await json(base, "PUT", `/api/elo/sentinel/pending-items/${id}`, { project_id: "obra-a", status: "resolved" });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.data.error, "invalid_status_transition");

    const cancelledNoReason = await json(base, "PUT", `/api/elo/sentinel/pending-items/${id}`, { project_id: "obra-a", status: "cancelled" });
    assert.equal(cancelledNoReason.response.status, 400);
    assert.equal(cancelledNoReason.data.error, "status_reason_required");
  });
});

test("Fase 3 exige evidencia correction antes de awaiting_validation e valida approved", async () => {
  await withServer({}, async (base) => {
    const created = await createPending(base, { status: "open" });
    const id = created.data.pending_item.id;
    const noCorrection = await json(base, "PUT", `/api/elo/sentinel/pending-items/${id}`, { project_id: "obra-a", status: "awaiting_validation" });
    assert.equal(noCorrection.response.status, 400);
    assert.equal(noCorrection.data.error, "correction_evidence_required");

    const correction = await createEvidence(base, "obra-a", "Correcao");
    const linked = await json(base, "POST", `/api/elo/sentinel/pending-items/${id}/evidences`, {
      project_id: "obra-a",
      evidence_id: correction.id,
      relation_type: "correction"
    });
    assert.equal(linked.response.status, 201);
    assert.equal(linked.data.event.event_type, "pending_item_evidence_linked");

    const duplicate = await json(base, "POST", `/api/elo/sentinel/pending-items/${id}/evidences`, {
      project_id: "obra-a",
      evidence_id: correction.id,
      relation_type: "correction"
    });
    assert.equal(duplicate.response.status, 200);
    assert.equal(duplicate.data.idempotent, true);

    const awaiting = await json(base, "PUT", `/api/elo/sentinel/pending-items/${id}`, { project_id: "obra-a", status: "awaiting_validation" });
    assert.equal(awaiting.response.status, 200);

    const approved = await json(base, "POST", `/api/elo/sentinel/pending-items/${id}/validate`, {
      project_id: "obra-a",
      decision: "approved",
      notes: "Corrigido em campo"
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.data.pending_item.status, "resolved");
    assert.equal(approved.data.pending_item.validation_status, "approved");
    assert.equal(approved.data.pending_item.validated_by, "user-a");
    assert.ok(approved.data.pending_item.validated_at);
    assert.equal(approved.data.event.event_type, "pending_item_validated");
  });
});

test("Fase 3 validacao rejected exige notes e retorna para execucao", async () => {
  await withServer({}, async (base) => {
    const created = await createPending(base, { status: "open" });
    const id = created.data.pending_item.id;
    const correction = await createEvidence(base, "obra-a", "Correcao parcial");
    await json(base, "POST", `/api/elo/sentinel/pending-items/${id}/evidences`, { project_id: "obra-a", evidence_id: correction.id, relation_type: "correction" });
    await json(base, "PUT", `/api/elo/sentinel/pending-items/${id}`, { project_id: "obra-a", status: "awaiting_validation" });

    const noNotes = await json(base, "POST", `/api/elo/sentinel/pending-items/${id}/validate`, { project_id: "obra-a", decision: "rejected" });
    assert.equal(noNotes.response.status, 400);
    assert.equal(noNotes.data.error, "validation_notes_required");

    const rejected = await json(base, "POST", `/api/elo/sentinel/pending-items/${id}/validate`, { project_id: "obra-a", decision: "rejected", notes: "Ainda falta acabamento" });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.data.pending_item.validation_status, "rejected");
    assert.equal(rejected.data.pending_item.status, "in_progress");
    assert.equal(rejected.data.event.event_type, "pending_item_validation_rejected");
  });
});

test("Fase 3 detalhe retorna pendencia, evidencias e eventos", async () => {
  await withServer({}, async (base) => {
    const evidence = await createEvidence(base);
    const created = await createPending(base, { source_evidence_id: evidence.id });
    const detail = await json(base, "GET", `/api/elo/sentinel/pending-items/${created.data.pending_item.id}?project_id=obra-a`);
    assert.equal(detail.response.status, 200);
    assert.equal(detail.data.pending_item.evidences.length, 1);
    assert.ok(detail.data.events.some((event) => event.event_type === "pending_item_created"));

    const outOfScope = await json(base, "GET", `/api/elo/sentinel/pending-items/${created.data.pending_item.id}?project_id=obra-b`);
    assert.equal(outOfScope.response.status, 404);
  });
});

test("Fase 3 falha do store nao derruba ELO nem chama IA, RDO ou relatorio", async () => {
  const calls = { ai: 0, reports: 0, rdos: 0 };
  const brokenStore = {
    async createPendingItem() { throw Object.assign(new Error("sentinel_store_failed"), { status: 503 }); },
    async findPendingItemByIdempotencyKey() { return null; },
    async findEvidenceById() { return null; }
  };
  const obraReportTransactionalService = {
    createReport() { calls.reports += 1; throw new Error("not_allowed"); },
    createRdo() { calls.rdos += 1; throw new Error("not_allowed"); },
    listReports() { return []; },
    listRdos() { return []; }
  };
  await withServer({ store: brokenStore, aiHandler() { calls.ai += 1; }, obraReportTransactionalService }, async (base) => {
    const pending = await createPending(base);
    assert.equal(pending.response.status, 503);
    assert.equal(pending.data.error, "sentinel_store_failed");

    const chat = await json(base, "POST", "/api/elo/chat", { message: "Ola" });
    assert.notEqual(chat.data.error, "sentinel_store_failed");
    assert.deepEqual(calls, { ai: 0, reports: 0, rdos: 0 });
  });
});

test("Fase 3 flag desligada mantem modulo indisponivel", async () => {
  await withServer({ env: { ELO_SENTINEL_ENABLED: "" } }, async (base) => {
    const result = await createPending(base);
    assert.equal(result.response.status, 503);
    assert.equal(result.data.error, "elo_sentinel_disabled");
  });
});

test("Fase 3 nao vaza campos de pendencia para evento ou vinculo source", async () => {
  const captured = { events: [], links: [] };
  const pendingRow = {
    id: "pending-1",
    institution_id: "inst-a",
    company_id: "company-a",
    project_id: "obra-a",
    source_evidence_id: "evidence-1",
    title: "Corrigir fissura",
    description: "Fissura junto ao pilar",
    category: "estrutura",
    priority: "high",
    severity: "major",
    status: "suggested",
    created_by: "user-a",
    validation_status: "pending",
    metadata: {},
    evidences: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const store = {
    async findEvidenceById() { return { id: "evidence-1", institution_id: "inst-a", company_id: "company-a", project_id: "obra-a" }; },
    async findPendingItemByIdempotencyKey() { return null; },
    async createPendingItem() { return pendingRow; },
    async linkEvidenceToPendingItem(payload) { captured.links.push(payload); return { link: Object.assign({ id: "link-1", created_at: new Date().toISOString() }, payload), idempotent: false }; },
    async findPendingItemById() { return Object.assign({}, pendingRow, { evidences: captured.links }); },
    async createEvent(payload) { captured.events.push(payload); return Object.assign({ id: "event-1", created_at: new Date().toISOString() }, payload); }
  };
  const service = createEloSentinelService({ store });

  const result = await service.createPendingItem({
    institution_id: "inst-a",
    company_id: "company-a",
    project_id: "obra-a",
    source_evidence_id: "evidence-1",
    title: "Corrigir fissura",
    description: "Fissura junto ao pilar",
    category: "estrutura",
    priority: "high",
    severity: "major",
    idempotency_key: "pend-guard",
    created_by: "user-a"
  });

  assert.equal(result.event.event_type, "pending_item_created");
  const forbiddenRootFields = ["source_evidence_id", "category", "priority", "severity", "status", "responsible_user_id", "due_at", "suggested_by", "validation_status", "idempotency_key"];
  for (const field of forbiddenRootFields) {
    assert.equal(Object.hasOwn(captured.events[0], field), false, field + " vazou para evento");
  }
  assert.deepEqual(captured.events[0].metadata, {
    pending_item_id: "pending-1",
    status: "suggested",
    priority: "high",
    severity: "major",
    category: "estrutura"
  });
  assert.deepEqual(Object.keys(captured.links[0]).sort(), ["company_id", "created_by", "evidence_id", "institution_id", "pending_item_id", "project_id", "relation_type"].sort());
});

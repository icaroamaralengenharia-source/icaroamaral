import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  E2E_RUN_ID,
  apiJson,
  assertNoForbiddenText,
  createRealE2eContext,
  sanitize,
  stopRealE2eBackend
} from "../helpers/real-e2e-env-helper.js";

process.env.ELO_SENTINEL_ENABLED = "true";

let ctx;

function uid(prefix) {
  return `${prefix}_${E2E_RUN_ID}_${randomUUID().slice(0, 8)}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sentinelPath(path = "") {
  return `/api/elo/sentinel${path}`;
}

function scopeQuery(projectId = ctx.state.ids.projectId) {
  return `projectId=${encodeURIComponent(projectId)}`;
}

async function createTenantBContext() {
  const suffix = randomUUID().slice(0, 8);
  const email = `tenant-b-${suffix}@elo-e2e.test`;
  const password = `TenantB-${suffix}-e2e-2026`;
  const slug = `elo-e2e-tenant-b-${suffix}`;

  const userResult = await ctx.supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { e2eTenantSlug: slug, environment: "test" }
  });
  expect(userResult.error, sanitize(userResult.error)).toBeFalsy();

  const institution = await ctx.supabaseAdmin
    .from("institutions")
    .insert({ name: "Tenant B E2E", document: slug })
    .select("id")
    .single();
  expect(institution.error, sanitize(institution.error)).toBeFalsy();

  const company = await ctx.supabaseAdmin
    .from("companies")
    .insert({ company_id: slug, name: "Tenant B E2E", document: slug, responsible_name: "Tenant B", status: "ativo" })
    .select("id")
    .single();
  expect(company.error, sanitize(company.error)).toBeFalsy();

  const profile = await ctx.supabaseAdmin
    .from("profiles")
    .insert({
      auth_user_id: userResult.data.user.id,
      institution_id: institution.data.id,
      company_id: company.data.id,
      name: "Tenant B",
      email,
      role: "admin",
      status: "ativo"
    })
    .select("id,institution_id,company_id")
    .single();
  expect(profile.error, sanitize(profile.error)).toBeFalsy();

  const signIn = await ctx.supabaseAnon.auth.signInWithPassword({ email, password });
  expect(signIn.error, sanitize(signIn.error)).toBeFalsy();

  return {
    slug,
    profile: profile.data,
    authHeader: { authorization: `Bearer ${signIn.data.session.access_token}` }
  };
}
async function expectJsonOk(result, status = 200) {
  expect(result.status, sanitize(result.data)).toBe(status);
  expect(result.data.ok, sanitize(result.data)).toBe(true);
  assertNoForbiddenText(expect, result.data);
}

async function createEvidence(request, overrides = {}) {
  const { expectedStatus, ...payloadOverrides } = overrides;
  const result = await apiJson(request, "POST", sentinelPath("/evidences"), {
    projectId: ctx.state.ids.projectId,
    evidence_type: "text",
    source: "manual",
    title: uid("evidence"),
    description: "Registro textual real do ELO Sentinela",
    content: "Registro textual real do ELO Sentinela",
    idempotency_key: uid("evidence_key"),
    ...payloadOverrides
  }, ctx.authHeader);
  await expectJsonOk(result, expectedStatus || 201);
  return result;
}

test.beforeAll(async () => {
  ctx = await createRealE2eContext();
});

test.afterAll(async () => {
  stopRealE2eBackend();
});

test("ELO Sentinela remoto executa evidencia timeline pendencia correcao validacao e isolamento", async ({ request }) => {
  expect(ctx.env.E2E_ENVIRONMENT).toBe("test");
  expect(ctx.env.E2E_ALLOW_WRITES).toBe("true");
  expect(ctx.state.slug).toMatch(/^elo-e2e-/);
  expect(ctx.state.ids.projectId).toBeTruthy();

  const idempotencyKey = uid("same_key");
  const evidenceCreated = await createEvidence(request, {
    title: uid("evidence_a"),
    idempotency_key: idempotencyKey
  });
  const evidence = evidenceCreated.data.evidence;
  expect(evidence.project_id).toBe(ctx.state.ids.projectId);
  expect(evidence.created_by).toBe(ctx.state.ids.authUserId);

  const persisted = await apiJson(request, "GET", sentinelPath(`/evidences?${scopeQuery()}`), undefined, ctx.authHeader);
  await expectJsonOk(persisted);
  expect(persisted.data.evidences.some((item) => item.id === evidence.id)).toBe(true);

  const timelineAfterEvidence = await apiJson(request, "GET", sentinelPath(`/timeline?${scopeQuery()}&event_type=evidence_created`), undefined, ctx.authHeader);
  await expectJsonOk(timelineAfterEvidence);
  expect(timelineAfterEvidence.data.events.some((event) => event.evidence_id === evidence.id && event.event_type === "evidence_created")).toBe(true);

  const duplicate = await createEvidence(request, {
    title: uid("evidence_duplicate"),
    idempotency_key: idempotencyKey,
    expectedStatus: 200
  });
  expect(duplicate.data.idempotent).toBe(true);
  expect(duplicate.data.evidence.id).toBe(evidence.id);

  const afterDuplicate = await apiJson(request, "GET", sentinelPath(`/evidences?${scopeQuery()}`), undefined, ctx.authHeader);
  await expectJsonOk(afterDuplicate);
  expect(afterDuplicate.data.evidences.filter((item) => item.idempotency_key === idempotencyKey)).toHaveLength(1);

  const pendingCreated = await apiJson(request, "POST", sentinelPath("/pending-items"), {
    projectId: ctx.state.ids.projectId,
    source_evidence_id: evidence.id,
    title: uid("pending"),
    description: "Pendencia vinculada a evidencia real",
    priority: "high",
    severity: "major",
    idempotency_key: uid("pending_key")
  }, ctx.authHeader);
  await expectJsonOk(pendingCreated, 201);
  const pending = pendingCreated.data.pending_item;
  expect(pending.evidences.some((link) => link.evidence_id === evidence.id && link.relation_type === "source")).toBe(true);

  const opened = await apiJson(request, "PUT", sentinelPath(`/pending-items/${encodeURIComponent(pending.id)}`), {
    projectId: ctx.state.ids.projectId,
    status: "open"
  }, ctx.authHeader);
  await expectJsonOk(opened);
  expect(opened.data.pending_item.status).toBe("open");

  const inProgress = await apiJson(request, "PUT", sentinelPath(`/pending-items/${encodeURIComponent(pending.id)}`), {
    projectId: ctx.state.ids.projectId,
    status: "in_progress"
  }, ctx.authHeader);
  await expectJsonOk(inProgress);
  expect(inProgress.data.pending_item.status).toBe("in_progress");

  const correctionCreated = await createEvidence(request, {
    title: uid("correction"),
    description: "Correcao executada em campo",
    content: "Correcao executada em campo",
    idempotency_key: uid("correction_key")
  });
  const correction = correctionCreated.data.evidence;

  const linkedCorrection = await apiJson(request, "POST", sentinelPath(`/pending-items/${encodeURIComponent(pending.id)}/evidences`), {
    projectId: ctx.state.ids.projectId,
    evidence_id: correction.id,
    relation_type: "correction"
  }, ctx.authHeader);
  await expectJsonOk(linkedCorrection, 201);
  expect(linkedCorrection.data.link.relation_type).toBe("correction");

  const awaitingValidation = await apiJson(request, "PUT", sentinelPath(`/pending-items/${encodeURIComponent(pending.id)}`), {
    projectId: ctx.state.ids.projectId,
    status: "awaiting_validation"
  }, ctx.authHeader);
  await expectJsonOk(awaitingValidation);
  expect(awaitingValidation.data.pending_item.status).toBe("awaiting_validation");

  const approved = await apiJson(request, "POST", sentinelPath(`/pending-items/${encodeURIComponent(pending.id)}/validate`), {
    projectId: ctx.state.ids.projectId,
    decision: "approved",
    notes: "Validacao humana aprovada no E2E real"
  }, ctx.authHeader);
  await expectJsonOk(approved);
  expect(approved.data.pending_item.status).toBe("resolved");
  expect(approved.data.pending_item.validation_status).toBe("approved");
  expect(approved.data.pending_item.validated_by).toBe(ctx.state.ids.authUserId);
  expect(approved.data.pending_item.validated_at).toBeTruthy();

  const detail = await apiJson(request, "GET", sentinelPath(`/pending-items/${encodeURIComponent(pending.id)}?${scopeQuery()}`), undefined, ctx.authHeader);
  await expectJsonOk(detail);
  expect(detail.data.pending_item.status).toBe("resolved");
  expect(detail.data.events.map((event) => event.event_type)).toEqual(expect.arrayContaining([
    "pending_item_created",
    "pending_item_status_changed",
    "pending_item_evidence_linked",
    "pending_item_validated"
  ]));

  const finalTimeline = await apiJson(request, "GET", sentinelPath(`/timeline?${scopeQuery()}&limit=50`), undefined, ctx.authHeader);
  await expectJsonOk(finalTimeline);
  expect(finalTimeline.data.events.map((event) => event.event_type)).toEqual(expect.arrayContaining([
    "evidence_created",
    "pending_item_created",
    "pending_item_status_changed",
    "pending_item_evidence_linked",
    "pending_item_validated"
  ]));

  const obraB = await apiJson(request, "GET", sentinelPath(`/evidences?${scopeQuery(uid("obra_b"))}`), undefined, ctx.authHeader);
  await expectJsonOk(obraB);
  expect(obraB.data.evidences.some((item) => item.id === evidence.id || item.id === correction.id)).toBe(false);

  const tenantB = await createTenantBContext();
  const tenantBList = await apiJson(request, "GET", sentinelPath(`/evidences?${scopeQuery()}`), undefined, tenantB.authHeader);
  await expectJsonOk(tenantBList);
  expect(tenantBList.data.evidences.some((item) => item.id === evidence.id || item.id === correction.id)).toBe(false);

  const tenantBPending = await apiJson(request, "GET", sentinelPath(`/pending-items?${scopeQuery()}`), undefined, tenantB.authHeader);
  await expectJsonOk(tenantBPending);
  expect(tenantBPending.data.pending_items.some((item) => item.id === pending.id)).toBe(false);

  const chat = await apiJson(request, "POST", "/api/elo/chat", {
    message: "Ola, confirme funcionamento do chat.",
    history: []
  }, ctx.authHeader);
  expect(chat.status).toBe(200);
  expect(chat.data.error).not.toBe("elo_sentinel_disabled");
  assertNoForbiddenText(expect, chat.data);

  const rdo = await apiJson(request, "POST", "/api/obrareport/rdos", {
    projectId: ctx.state.ids.projectId,
    clientId: ctx.state.ids.clientId,
    title: uid("rdo_sentinel"),
    rdoData: { date: "2026-07-29", weather: "tempo firme", note: "Smoke ObraReport apos Sentinela" }
  }, ctx.obraHeaders);
  await expectJsonOk(rdo, 201);
  expect(rdo.data.rdo.project_id).toBe(ctx.state.ids.projectId);
});

test("ELO Sentinela remoto rejeita constraints principais sem alterar dados validos", async ({ request }) => {
  const invalidEvidence = await apiJson(request, "POST", sentinelPath("/evidences"), {
    projectId: ctx.state.ids.projectId,
    evidence_type: "audio",
    title: uid("invalid"),
    description: "Tipo invalido"
  }, ctx.authHeader);
  expect(invalidEvidence.status).toBe(400);
  expect(invalidEvidence.data.error).toBe("invalid_evidence_type");

  const invalidPending = await apiJson(request, "POST", sentinelPath("/pending-items"), {
    projectId: ctx.state.ids.projectId,
    title: uid("invalid_pending"),
    priority: "urgent"
  }, ctx.authHeader);
  expect(invalidPending.status).toBe(400);
  expect(invalidPending.data.error).toBe("invalid_priority");

  const validEvidence = await createEvidence(request, { title: uid("constraint_control") });
  expect(validEvidence.data.evidence.id).toBeTruthy();
});

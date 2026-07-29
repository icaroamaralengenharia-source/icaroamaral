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
process.env.ELO_OPERATIONAL_TIMELINE_ENABLED = "true";

let ctx;

function uid(prefix) {
  return `${prefix}_${E2E_RUN_ID}_${randomUUID().slice(0, 8)}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function timelinePath(projectId = ctx.state.ids.projectId, query = "") {
  const suffix = query ? `?${query}` : "";
  return `/api/elo/projects/${encodeURIComponent(projectId)}/timeline${suffix}`;
}

function obraHeaders() {
  return { ...ctx.obraHeaders, "x-institution-id": ctx.state.ids.institutionId, "x-company-id": ctx.state.ids.companyId };
}

async function expectJsonOk(result, status = 200) {
  expect(result.status, sanitize(result.data)).toBe(status);
  expect(result.data.ok, sanitize(result.data)).toBe(true);
  assertNoForbiddenText(expect, result.data);
}

test.beforeAll(async () => {
  ctx = await createRealE2eContext();
});

test.afterAll(async () => {
  stopRealE2eBackend();
});

test("Timeline operacional real agrega Sentinela RDO relatorio documento orcamento PDF e isolamento", async ({ request }) => {
  expect(ctx.env.E2E_ENVIRONMENT).toBe("test");
  expect(ctx.env.E2E_ALLOW_WRITES).toBe("true");
  expect(ctx.state.slug).toMatch(/^elo-e2e-/);
  expect(ctx.state.ids.projectId).toBeTruthy();

  const evidenceKey = uid("timeline_evidence_key");
  const evidenceCreated = await apiJson(request, "POST", "/api/elo/sentinel/evidences", {
    projectId: ctx.state.ids.projectId,
    evidence_type: "text",
    source: "manual",
    title: uid("timeline_evidence"),
    description: "Evidencia real para timeline unica",
    content: "Evidencia real para timeline unica",
    idempotency_key: evidenceKey
  }, ctx.authHeader);
  await expectJsonOk(evidenceCreated, 201);

  const duplicateEvidence = await apiJson(request, "POST", "/api/elo/sentinel/evidences", {
    projectId: ctx.state.ids.projectId,
    evidence_type: "text",
    source: "manual",
    title: uid("timeline_evidence_duplicate"),
    description: "Duplicata idempotente",
    content: "Duplicata idempotente",
    idempotency_key: evidenceKey
  }, ctx.authHeader);
  await expectJsonOk(duplicateEvidence, 200);
  expect(duplicateEvidence.data.evidence.id).toBe(evidenceCreated.data.evidence.id);

  const rdo = await apiJson(request, "POST", "/api/obrareport/rdos", {
    projectId: ctx.state.ids.projectId,
    clientId: ctx.state.ids.clientId,
    title: uid("timeline_rdo"),
    rdoData: { date: "2026-07-29", activities: ["Timeline operacional E2E"] }
  }, obraHeaders());
  await expectJsonOk(rdo, 201);

  const report = await apiJson(request, "POST", "/api/obrareport/reports", {
    projectId: ctx.state.ids.projectId,
    clientId: ctx.state.ids.clientId,
    title: uid("timeline_report"),
    reportData: { summary: "Timeline operacional E2E", manifestations: ["fissura"] }
  }, obraHeaders());
  await expectJsonOk(report, 201);

  const reportDocument = await apiJson(request, "POST", `/api/obrareport/reports/${encodeURIComponent(report.data.report.id)}/generate-document`, {}, obraHeaders());
  await expectJsonOk(reportDocument, 201);

  const budget = await apiJson(request, "POST", "/api/elo/budgets", {
    projectId: ctx.state.ids.projectId,
    documentData: { title: uid("timeline_budget"), projectId: ctx.state.ids.projectId, items: [{ name: "Servico E2E", quantity: 1, unit: "un" }] }
  }, ctx.authHeader);
  await expectJsonOk(budget, 201);

  const budgetPdf = await apiJson(request, "POST", `/api/elo/budgets/${encodeURIComponent(budget.data.budget.id)}/generate-pdf`, {}, ctx.authHeader);
  await expectJsonOk(budgetPdf, 201);

  const timeline = await apiJson(request, "GET", timelinePath(ctx.state.ids.projectId, "limit=50"), undefined, ctx.authHeader);
  await expectJsonOk(timeline);
  const modules = timeline.data.events.map((event) => event.source_module);
  expect(modules).toEqual(expect.arrayContaining(["sentinel", "rdo", "technical_report", "generated_document", "elo_budget", "budget_pdf"]));
  expect(timeline.data.events.some((event) => event.event_type === "evidence_created" && event.source_entity_id === evidenceCreated.data.evidence.id)).toBe(true);
  expect(timeline.data.events.some((event) => JSON.stringify(event).includes("<html") || JSON.stringify(event).includes("%PDF-"))).toBe(false);

  const budgetFilter = await apiJson(request, "GET", timelinePath(ctx.state.ids.projectId, "source_module=elo_budget&limit=20"), undefined, ctx.authHeader);
  await expectJsonOk(budgetFilter);
  expect(budgetFilter.data.events.every((event) => event.source_module === "elo_budget")).toBe(true);
  expect(budgetFilter.data.events.some((event) => event.source_entity_id === budget.data.budget.id)).toBe(true);

  const otherProject = await apiJson(request, "GET", timelinePath(uid("obra_b"), "limit=50"), undefined, ctx.authHeader);
  await expectJsonOk(otherProject);
  expect(otherProject.data.events.some((event) => event.source_entity_id === evidenceCreated.data.evidence.id || event.source_entity_id === budget.data.budget.id)).toBe(false);

  const orphan = await apiJson(request, "POST", "/api/elo/sentinel/evidences", {
    projectId: ctx.state.ids.projectId,
    evidence_type: "text",
    source: "manual",
    title: uid("timeline_orphan"),
    description: "Controle para evento orfao",
    content: "Controle para evento orfao",
    idempotency_key: uid("timeline_orphan_key")
  }, ctx.authHeader);
  await expectJsonOk(orphan, 201);
  const deleteResult = await ctx.supabaseAdmin
    .from("elo_sentinel_evidences")
    .delete()
    .eq("id", orphan.data.evidence.id)
    .eq("institution_id", orphan.data.evidence.institution_id)
    .eq("company_id", orphan.data.evidence.company_id)
    .eq("project_id", orphan.data.evidence.project_id);
  expect(deleteResult.error, sanitize(deleteResult.error)).toBeFalsy();

  const orphanTimeline = await apiJson(request, "GET", timelinePath(ctx.state.ids.projectId, `source_entity_id=${encodeURIComponent(orphan.data.evidence.id)}&limit=10`), undefined, ctx.authHeader);
  await expectJsonOk(orphanTimeline);
  expect(orphanTimeline.data.events[0].source_exists).toBe(false);

  const chat = await apiJson(request, "POST", "/api/elo/chat", {
    message: "Confirme que o chat segue vivo apos timeline operacional.",
    history: []
  }, ctx.authHeader);
  expect(chat.status).toBe(200);
  expect(chat.data.error).not.toBe("timeline_failed");
  assertNoForbiddenText(expect, chat.data);
});

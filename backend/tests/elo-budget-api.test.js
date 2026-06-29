import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloBudgetService } from "../src/services/elo-budget-service.js";

function sampleDocumentData(overrides = {}) {
  return Object.assign({
    budgetId: "budget-v2-api-001",
    facts: {
      "area construida": "120 m2",
      "cidade/UF": "Vitoria da Conquista/BA",
      padrao: "medio",
      projectType: "residential"
    },
    inheritedFacts: {},
    assumptions: ["1 pavimento"],
    pendingFields: [],
    scope: [{ label: "Servicos preliminares", status: "pending_official_composition" }],
    materials: [{ title: "Fundacao", items: ["concreto", "aco"] }],
    quantities: [],
    compositions: [],
    budget: null,
    risks: ["Validar base oficial antes de contratar."],
    nextSteps: ["Importar composicoes oficiais SINAPI/ORSE."]
  }, overrides);
}

async function withServer(callback) {
  const dir = mkdtempSync(join(tmpdir(), "elo-budget-api-"));
  const app = createApp({
    eloBudgetService: createEloBudgetService({ dataPath: join(dir, "elo-budgets.json") })
  });
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}

async function json(url, options = {}) {
  const response = await fetch(url, Object.assign({}, options, {
    headers: Object.assign({ "Content-Type": "application/json", Origin: "http://127.0.0.1:5500" }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

test("Elo Budget API persiste, versiona, audita e gera PDF controlado", async () => {
  await withServer(async (base) => {
    const headers = { "x-institution-id": "inst_a", "x-user-id": "user_a" };
    const created = await json(base + "/api/elo/budgets", {
      method: "POST",
      headers,
      body: JSON.stringify({ documentData: sampleDocumentData() })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.budget.institution_id, "inst_a");
    assert.equal(created.data.budget.owner_user_id, "user_a");
    assert.deepEqual(created.data.budget.document_data.budget, null);

    const id = created.data.budget.id;
    const list = await json(base + "/api/elo/budgets", { headers });
    assert.equal(list.data.budgets.length, 1);
    assert.equal(list.data.budgets[0].id, id);

    const got = await json(base + "/api/elo/budgets/" + id, { headers });
    assert.equal(got.data.budget.document_data.facts["area construida"], "120 m2");

    const updated = await json(base + "/api/elo/budgets/" + id, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status: "review", documentData: sampleDocumentData({ nextSteps: ["Validar BDI."] }) })
    });
    assert.equal(updated.data.budget.status, "review");
    assert.equal(updated.data.budget.document_data.nextSteps[0], "Validar BDI.");

    const version = await json(base + "/api/elo/budgets/" + id + "/versions", {
      method: "POST",
      headers,
      body: JSON.stringify({ documentData: sampleDocumentData({ budgetId: "budget-v2-api-v2" }) })
    });
    assert.equal(version.response.status, 201);
    assert.equal(version.data.version.version_number, 1);

    const pdf = await json(base + "/api/elo/budgets/" + id + "/generate-pdf", {
      method: "POST",
      headers,
      body: "{}"
    });
    assert.equal(pdf.response.status, 201);
    assert.equal(pdf.data.ok, true);
    assert.equal(pdf.data.budgetId, id);
    assert.match(pdf.data.html, /elo-professional-pdf/);
    assert.match(pdf.data.html, /ELO Or.amentista V2/);
    assert.match(pdf.data.html, /area construida: 120 m2/i);
    assert.doesNotMatch(pdf.data.html, /R\$\s*\d/i);

    const events = await json(base + "/api/elo/budgets/" + id + "/events", { headers });
    assert.deepEqual(events.data.events.map((event) => event.event_type), [
      "budget_created",
      "budget_updated",
      "budget_version_created",
      "pdf_generated"
    ]);

    const documents = await json(base + "/api/elo/budgets/" + id + "/documents", { headers });
    assert.equal(documents.data.documents.length, 1);
    assert.equal(documents.data.documents[0].document_type, "budget_v2_professional_pdf");
  });
});

test("Elo Budget API isola orcamentos por instituicao quando contexto e informado", async () => {
  await withServer(async (base) => {
    const budgetA = await json(base + "/api/elo/budgets", {
      method: "POST",
      headers: { "x-institution-id": "inst_a", "x-user-id": "user_a" },
      body: JSON.stringify({ documentData: sampleDocumentData({ budgetId: "budget-a" }) })
    });
    const budgetB = await json(base + "/api/elo/budgets", {
      method: "POST",
      headers: { "x-institution-id": "inst_b", "x-user-id": "user_b" },
      body: JSON.stringify({ documentData: sampleDocumentData({ budgetId: "budget-b" }) })
    });

    const listA = await json(base + "/api/elo/budgets", { headers: { "x-institution-id": "inst_a", "x-user-id": "user_a" } });
    assert.deepEqual(listA.data.budgets.map((budget) => budget.id), [budgetA.data.budget.id]);

    const forbidden = await json(base + "/api/elo/budgets/" + budgetA.data.budget.id, { headers: { "x-institution-id": "inst_b", "x-user-id": "user_b" } });
    assert.equal(forbidden.response.status, 403);
    assert.equal(forbidden.data.error, "budget_forbidden");

    const listB = await json(base + "/api/elo/budgets", { headers: { "x-institution-id": "inst_b", "x-user-id": "user_b" } });
    assert.deepEqual(listB.data.budgets.map((budget) => budget.id), [budgetB.data.budget.id]);
  });
});

test("Elo Budget API valida payload minimo", async () => {
  await withServer(async (base) => {
    const response = await json(base + "/api/elo/budgets", {
      method: "POST",
      body: JSON.stringify({})
    });
    assert.equal(response.response.status, 400);
    assert.equal(response.data.error, "document_data_required");
  });
});

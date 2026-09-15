import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportArtifactBroker } from "../src/services/obrareport-artifact-broker.js";
import { buildObraReportDocumentContext } from "../src/services/obrareport-document-context.js";
import { createObraReportReportOrchestrator } from "../src/services/obrareport-report-orchestrator.js";

const repoRoot = join(process.cwd(), "..");

function createStore() {
  const documents = [];
  return {
    documents,
    async findByIdempotencyKey(context, key) {
      return documents.find((item) => item.institution_id === context.institutionId && item.idempotency_key === key) || null;
    },
    async insert(context, input) {
      const existing = await this.findByIdempotencyKey(context, input.idempotencyKey);
      if (existing) return { document: existing, duplicate: true };
      const document = {
        id: "doc_" + String(documents.length + 1),
        institution_id: context.institutionId,
        work_id: input.workId || null,
        rdo_id: input.rdoId || null,
        source_type: input.sourceType,
        source_id: input.sourceId,
        document_type: input.documentType,
        title: input.title,
        provider: input.provider,
        external_file_id: input.externalFileId,
        artifact_url: input.artifactUrl,
        idempotency_key: input.idempotencyKey,
        status: "generated",
        metadata_json: input.metadata,
        generated_by: context.userId,
        created_at: "2026-09-15T10:00:00.000Z",
        updated_at: "2026-09-15T10:00:00.000Z"
      };
      documents.push(document);
      return { document, duplicate: false };
    },
    async list(context) {
      return documents.filter((item) => item.institution_id === context.institutionId);
    },
    async getById(context, id) {
      const document = documents.find((item) => item.id === id && item.institution_id === context.institutionId);
      if (!document) throw Object.assign(new Error("document_not_found"), { status: 404 });
      return document;
    },
    async validateWork(context, workId) {
      if (context.institutionId !== "tenant-a" || workId !== "work-a") throw Object.assign(new Error("work_not_found"), { status: 404 });
      return { id: "work-a", institution_id: "tenant-a", name: "OBRA TESTE ELO E2E" };
    }
  };
}

function createRdoRepository() {
  return {
    async getById(context, id) {
      if (context.institutionId !== "tenant-a" || id !== "rdo-a") throw Object.assign(new Error("rdo_not_found"), { status: 404 });
      return { id, project_id: "work-a", rdo_date: "2026-09-14", rdo_data_json: { date: "2026-09-14", observation: "Teste controlado" } };
    }
  };
}

function generatorResponse() {
  return { ok: true, requestId: "request-test", pdfFileId: "fixture-pdf", pdfUrl: "https://drive.google.com/file/d/fixture-pdf/view" };
}

function createAuthClient() {
  return {
    auth: { async getUser(token) { return { data: { user: { id: token === "b" ? "user-b" : "user-a" } }, error: null }; } },
    from(table) {
      assert.equal(table, "profiles");
      return { select() { return { eq(_column, value) { return { async maybeSingle() { return { data: value === "user-b" ? { id: "profile-b", auth_user_id: "user-b", institution_id: "tenant-b" } : { id: "profile-a", auth_user_id: "user-a", institution_id: "tenant-a", role: "admin" }, error: null }; } }; } }; } };
    }
  };
}

test("imagem -> análise -> relatório usa o orquestrador e resolve o registro por idempotência", async () => {
  const store = createStore();
  let calls = 0;
  const orchestrator = createObraReportReportOrchestrator({
    documentRepository: store,
    appsScriptUrl: "https://script.example.test/exec",
    fetchImpl: async (_url, request) => {
      calls += 1;
      const payload = JSON.parse(request.body);
      assert.equal(payload.source, "image_analysis");
      assert.equal(payload.image.originalName, "fachada.jpg");
      return { ok: true, async json() { return generatorResponse(); } };
    }
  });
  const context = { institutionId: "tenant-a", userId: "user-a", profile: { institution_id: "tenant-a" } };
  const input = {
    sourceType: "image_analysis",
    sourceId: "image-analysis-a",
    workId: "work-a",
    idempotencyKey: "image-report-v1",
    generatorPayload: { source: "image_analysis", image: { originalName: "fachada.jpg" }, report: { obra: "OBRA TESTE ELO E2E" } }
  };
  const first = await orchestrator.generate(context, input);
  const second = await orchestrator.generate(context, input);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.generatorCalled, false);
  assert.equal(calls, 1);
  assert.equal(store.documents.length, 1);
  assert.equal(store.documents[0].source_type, "image_analysis");
});

test("contexto estruturado usa documento, obra, RDO e data sem fallback genérico", () => {
  const context = buildObraReportDocumentContext({
    document: {
      id: "doc-1",
      title: "Relatório da fachada",
      document_type: "technical_report_pdf",
      source_type: "technical_report",
      source_id: "image-analysis-a",
      work_id: "work-a",
      rdo_id: "rdo-a",
      artifact_url: "https://drive.google.com/private",
      created_at: "2026-09-15T10:00:00.000Z"
    },
    work: { id: "work-a", name: "OBRA TESTE ELO E2E" },
    rdo: { id: "rdo-a", rdo_date: "2026-09-14", rdo_data_json: { observation: "Teste controlado" } }
  });
  assert.equal(context.document.id, "doc-1");
  assert.equal(context.work.name, "OBRA TESTE ELO E2E");
  assert.equal(context.rdo.date, "2026-09-14");
  assert.equal(context.generatedAt, "2026-09-15T10:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(context), /drive\.google\.com/);
});

test("content endpoint é autenticado, tenant-scoped e não expõe URL bruta", async () => {
  const store = createStore();
  const orchestrator = createObraReportReportOrchestrator({
    documentRepository: store,
    appsScriptUrl: "https://script.example.test/exec",
    fetchImpl: async () => ({ ok: true, async json() { return generatorResponse(); } })
  });
  const app = createApp({
    authContextSupabaseClient: createAuthClient(),
    documentRepository: store,
    documentOrchestrator: orchestrator,
    documentArtifactBroker: { async open() { return { bytes: Buffer.from("%PDF-1.4\nfixture"), contentType: "application/pdf" }; } },
    env: { AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500" }
  });
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  const base = "http://127.0.0.1:" + server.address().port;
  const headers = { "Content-Type": "application/json", Authorization: "Bearer a" };
  try {
    const generated = await fetch(base + "/api/obrareport/documents/generate", { method: "POST", headers, body: JSON.stringify({ sourceType: "analysis", workId: "work-a", sourceId: "analysis-a", idempotencyKey: "analysis-v1", generatorPayload: { report: { obra: "OBRA TESTE ELO E2E" } } }) });
    assert.equal(generated.status, 201);
    const generatedBody = await generated.json();
    const id = generatedBody.document.id;
    const anonymous = await fetch(base + "/api/obrareport/documents/" + id + "/content");
    assert.equal(anonymous.status, 401);
    const sameTenant = await fetch(base + "/api/obrareport/documents/" + id + "/content", { headers });
    assert.equal(sameTenant.status, 200);
    assert.match(sameTenant.headers.get("content-type"), /^application\/pdf/);
    assert.equal(Buffer.from(await sameTenant.arrayBuffer()).toString("ascii").startsWith("%PDF-1.4"), true);
    const context = await fetch(base + "/api/obrareport/documents/" + id + "/context", { headers });
    assert.equal(context.status, 200);
    assert.equal((await context.json()).context.work.name, "OBRA TESTE ELO E2E");
    const crossTenant = await fetch(base + "/api/obrareport/documents/" + id + "/content", { headers: { Authorization: "Bearer b" } });
    assert.equal(crossTenant.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("broker fail-closed e migration são auditáveis sem live migration/Drive ACL", async () => {
  const broker = createObraReportArtifactBroker({ brokerUrl: "", brokerSecret: "", fetchImpl: async () => { throw new Error("must_not_call"); } });
  await assert.rejects(broker.open({ externalFileId: "fixture" }), (error) => error && error.status === 503 && error.message === "artifact_broker_not_configured");
  const migration = readFileSync(join(repoRoot, "backend", "src", "data", "obrareport-step05-durable-documents.sql"), "utf8");
  assert.doesNotMatch(migration, /\b(drop|delete|truncate|update)\b/i);
  assert.match(migration, /add column if not exists/i);
  assert.match(migration, /create unique index if not exists/i);
  const frontend = readFileSync(join(repoRoot, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  assert.match(frontend, /sourceType = analysisContext \? "analysis" : "image_analysis"/);
  assert.match(frontend, /\/api\/obrareport\/documents\/generate/);
  assert.match(frontend, /appendEloPdfDownloadAction_\(statusMessage, result\.openUrl, true\)/);
});

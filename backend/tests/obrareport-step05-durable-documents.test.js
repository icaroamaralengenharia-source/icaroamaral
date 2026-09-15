import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportReportOrchestrator } from "../src/services/obrareport-report-orchestrator.js";

function createDocumentStore() {
  const documents = [];
  return {
    documents,
    async findByIdempotencyKey(context, key) {
      return documents.find((document) => document.institution_id === context.institutionId && document.idempotency_key === key) || null;
    },
    async insert(context, input) {
      const duplicate = await this.findByIdempotencyKey(context, input.idempotencyKey);
      if (duplicate) return { document: duplicate, duplicate: true };
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
        generated_by: context.userId
      };
      documents.push(document);
      return { document, duplicate: false };
    },
    async list(context, filters = {}) {
      return documents.filter((document) => document.institution_id === context.institutionId && (!filters.workId || document.work_id === filters.workId));
    },
    async getById(context, id) {
      const document = documents.find((item) => item.id === id && item.institution_id === context.institutionId);
      if (!document) throw Object.assign(new Error("document_not_found"), { status: 404 });
      return document;
    },
    async validateWork(context, workId) {
      if (workId !== "work-a" || context.institutionId !== "tenant-a") throw Object.assign(new Error("work_not_found"), { status: 404 });
      return { id: workId, institution_id: context.institutionId, name: "OBRA TESTE ELO E2E" };
    }
  };
}

function createRdoRepository() {
  return {
    async getById(context, id) {
      if (context.institutionId !== "tenant-a" || id !== "rdo-a") throw Object.assign(new Error("rdo_not_found"), { status: 404 });
      return {
        id,
        institution_id: "tenant-a",
        project_id: "work-a",
        rdo_date: "2026-09-14",
        rdo_data_json: { obra: "OBRA TESTE ELO E2E", date: "2026-09-14", observation: "Teste controlado" }
      };
    }
  };
}

function generatorResponse() {
  return {
    ok: true,
    requestId: "request-1",
    pdfFileId: "drive-file-1",
    pdfUrl: "https://drive.google.com/file/d/drive-file-1/view"
  };
}

test("Step 05 orquestra RDO -> PDF -> registro canônico e não chama o gerador na repetição", async () => {
  const store = createDocumentStore();
  let generatorCalls = 0;
  const orchestrator = createObraReportReportOrchestrator({
    documentRepository: store,
    rdoRepository: createRdoRepository(),
    appsScriptUrl: "https://script.example.test/exec",
    fetchImpl: async (_url, request) => {
      generatorCalls += 1;
      assert.equal(request.method, "POST");
      assert.equal(request.headers["Content-Type"], "text/plain;charset=utf-8");
      return { ok: true, async json() { return generatorResponse(); } };
    }
  });
  const context = { institutionId: "tenant-a", userId: "profile-a", profile: { institution_id: "tenant-a" } };
  const input = { sourceType: "rdo", rdoId: "rdo-a", workId: "work-a", idempotencyKey: "rdo-a-pdf-v1" };
  const first = await orchestrator.generate(context, input);
  const second = await orchestrator.generate(context, input);
  assert.equal(first.duplicate, false);
  assert.equal(first.document.artifact_url, generatorResponse().pdfUrl);
  assert.equal(second.duplicate, true);
  assert.equal(second.generatorCalled, false);
  assert.equal(generatorCalls, 1);
  assert.equal(store.documents.length, 1);
});

test("Step 05 rejeita RDO de outro tenant antes de chamar o gerador", async () => {
  let generatorCalls = 0;
  const orchestrator = createObraReportReportOrchestrator({
    documentRepository: createDocumentStore(),
    rdoRepository: createRdoRepository(),
    appsScriptUrl: "https://script.example.test/exec",
    fetchImpl: async () => { generatorCalls += 1; return { ok: true, async json() { return generatorResponse(); } }; }
  });
  await assert.rejects(
    orchestrator.generate({ institutionId: "tenant-b", userId: "profile-b", profile: { institution_id: "tenant-b" } }, {
      sourceType: "rdo", rdoId: "rdo-a", workId: "work-b", idempotencyKey: "cross-tenant"
    }),
    (error) => error && error.status === 404
  );
  assert.equal(generatorCalls, 0);
});

test("Step 05 API usa tenant do profile e expõe list/detail/file somente no escopo canônico", async () => {
  const store = createDocumentStore();
  const orchestrator = createObraReportReportOrchestrator({
    documentRepository: store,
    rdoRepository: createRdoRepository(),
    appsScriptUrl: "https://script.example.test/exec",
    fetchImpl: async () => ({ ok: true, async json() { return generatorResponse(); } })
  });
  const auth = {
    auth: { async getUser(token) { return { data: { user: { id: token === "b" ? "user-b" : "user-a" } }, error: null }; } },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return { eq(_column, value) {
            return { async maybeSingle() {
              return { data: value === "user-b" ? { id: "profile-b", auth_user_id: "user-b", institution_id: "tenant-b" } : { id: "profile-a", auth_user_id: "user-a", institution_id: "tenant-a" }, error: null };
            } };
          } };
        }
      };
    }
  };
  const app = createApp({ authContextSupabaseClient: auth, documentRepository: store, documentOrchestrator: orchestrator, documentArtifactBroker: { async open() { return { bytes: Buffer.from("%PDF-1.4\n%mock\n"), contentType: "application/pdf" }; } }, env: { AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500" } });
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  const base = "http://127.0.0.1:" + server.address().port;
  const headers = { "Content-Type": "application/json", Authorization: "Bearer a", "x-institution-id": "tenant-b" };
  try {
    const generated = await fetch(base + "/api/obrareport/documents/generate", { method: "POST", headers, body: JSON.stringify({ sourceType: "analysis", workId: "work-a", sourceId: "analysis-a", idempotencyKey: "analysis-v1", generatorPayload: { report: { obra: "OBRA TESTE ELO E2E" } } }) });
    assert.equal(generated.status, 201);
    const body = await generated.json();
    assert.equal(body.document.institution_id, undefined);
    assert.equal(Object.hasOwn(body.document, "artifact_url"), false);
    assert.equal(body.openUrl, "/api/obrareport/documents/" + body.document.id + "/content");
    const list = await fetch(base + "/api/obrareport/documents", { headers });
    assert.equal(list.status, 200);
    const listBody = await list.json();
    assert.equal(listBody.documents.length, 1);
    const detail = await fetch(base + "/api/obrareport/documents/" + body.document.id, { headers });
    assert.equal(detail.status, 200);
    const detailBody = await detail.json();
    assert.equal(Object.hasOwn(detailBody.document, "artifact_url"), false);
    assert.equal(Object.hasOwn(listBody.documents[0], "artifact_url"), false);
    const file = await fetch(base + "/api/obrareport/documents/" + body.document.id + "/file", { headers, redirect: "manual" });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type").startsWith("application/pdf"), true);
    assert.equal(Buffer.from(await file.arrayBuffer()).toString("ascii").startsWith("%PDF-1.4"), true);
    const anonymous = await fetch(base + "/api/obrareport/documents/" + body.document.id + "/content");
    assert.equal(anonymous.status, 401);
    const cross = await fetch(base + "/api/obrareport/documents/" + body.document.id + "/content", { headers: { "Content-Type": "application/json", Authorization: "Bearer b" } });
    assert.equal(cross.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

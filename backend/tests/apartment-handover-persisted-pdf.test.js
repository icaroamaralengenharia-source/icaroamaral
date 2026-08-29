import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function tempPath(name) {
  return join(mkdtempSync(join(tmpdir(), "obrareport-ahi-pdf-")), name);
}

function loadFixture() {
  return JSON.parse(readFileSync(new URL("../../tests/fixtures/apartment-handover-inspection-144-corrected.json", import.meta.url), "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function headers(institutionId = "inst-a", userId = "user-a") {
  return {
    "Content-Type": "application/json",
    "x-institution-id": institutionId,
    "x-user-id": userId,
    Origin: "http://127.0.0.1:5500"
  };
}

function inspectionPayload(overrides = {}) {
  const fixture = loadFixture();
  return Object.assign({
    source_type: "apartment_handover_inspection",
    source_id: "local-inspection-05e",
    client_id: "client-a",
    project_id: "project-a",
    title: "Vistoria de Entrega - 05E",
    status: "completed",
    inspection_data_json: fixture.report.inspection
  }, overrides);
}

async function withServer(callback) {
  const dataPath = tempPath("obrareport.json");
  const documentStorageDir = tempPath("documents");
  const service = createObraReportTransactionalService({ dataPath, documentStorageDir });
  const app = createApp({ obraReportTransactionalService: service, env: { ELO_SENTINEL_ENABLED: "false" } });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, service);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, options);
  return { response, data: await response.json() };
}

async function createInspection(base, payload = inspectionPayload(), headerValues = headers()) {
  const created = await json(base, "/api/obrareport/apartment-handover-inspections", {
    method: "POST",
    headers: headerValues,
    body: JSON.stringify(payload)
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.data.inspection.inspection_data_json.items.length, 144);
  return created.data.inspection;
}

async function generateDocument(base, id, mode, headerValues = headers(), extraBody = {}) {
  return json(base, "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(id) + "/generate-document", {
    method: "POST",
    headers: headerValues,
    body: JSON.stringify(Object.assign({ mode }, extraBody))
  });
}

async function readPdf(base, fileUrl, headerValues = headers()) {
  const response = await fetch(base + fileUrl, { headers: headerValues });
  const buffer = Buffer.from(await response.arrayBuffer());
  return { response, buffer };
}

function assertPersistedPdfDocument(document, expectedType) {
  assert.equal(document.source_type, "apartment_handover_inspection");
  assert.equal(document.document_type, expectedType);
  assert.equal(document.status, "generated");
  assert.match(document.file_url, /^\/api\/obrareport\/documents\/obr_doc_.+\/file$/);
  assert.equal(document.file.mime_type, "application/pdf");
  assert.ok(document.file.filename.endsWith(".pdf"));
  assert.ok(document.file.size_bytes > 30_000, "PDF persistido deve ser real");
  assert.match(document.hash, /^[a-f0-9]{64}$/);
  assert.equal(document.hash, document.file.hash);
  assert.equal(document.metadata_json.pdfPersisted, true);
  assert.equal(document.metadata_json.contentType, "application/pdf");
  assert.equal(document.metadata_json.sizeBytes, document.file.size_bytes);
  assert.equal(existsSync(document.file.storage_path), true);
  assert.equal("html_content" in document.file, false);
}

test("05E persiste PDF draft/final da Vistoria, baixa arquivo real e preserva versoes", async () => {
  await withServer(async (base) => {
    const sourceReport = loadFixture().report;
    const inspection = await createInspection(base);

    const draft = await generateDocument(base, inspection.id, "draft", headers(), { report: sourceReport });
    assert.equal(draft.response.status, 201);
    assertPersistedPdfDocument(draft.data.document, "apartment_handover_draft_pdf");

    const draftDownload = await readPdf(base, draft.data.document.file_url);
    assert.equal(draftDownload.response.status, 200);
    assert.match(draftDownload.response.headers.get("content-type") || "", /^application\/pdf\b/);
    assert.match(draftDownload.response.headers.get("content-disposition") || "", /^inline; filename="Laudo-Vistoria-.+\.pdf"$/);
    assert.equal(draftDownload.buffer.subarray(0, 4).toString("utf8"), "%PDF");
    assert.equal(draftDownload.buffer.length, draft.data.document.file.size_bytes);
    assert.equal(createHash("sha256").update(draftDownload.buffer).digest("hex"), draft.data.document.hash);

    const final = await generateDocument(base, inspection.id, "final", headers(), { report: sourceReport });
    assert.equal(final.response.status, 201);
    assertPersistedPdfDocument(final.data.document, "apartment_handover_final_pdf");
    assert.notEqual(final.data.document.id, draft.data.document.id);
    assert.notEqual(final.data.document.file_id, draft.data.document.file_id);

    const draftAgain = await readPdf(base, draft.data.document.file_url);
    assert.equal(draftAgain.response.status, 200);
    assert.equal(createHash("sha256").update(draftAgain.buffer).digest("hex"), draft.data.document.hash);

    const events = await json(base, "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(inspection.id) + "/events", { headers: headers() });
    assert.equal(events.response.status, 200);
    assert.ok(events.data.events.some((event) => event.event_type === "inspection_draft_pdf_generated"));
    assert.ok(events.data.events.some((event) => event.event_type === "inspection_final_pdf_generated"));

    const crossTenantDownload = await fetch(base + final.data.document.file_url, { headers: headers("inst-b", "user-b") });
    assert.equal(crossTenantDownload.status, 404);
    assert.equal((await crossTenantDownload.json()).error, "document_not_found");

    const missing = await generateDocument(base, "missing", "draft");
    assert.equal(missing.response.status, 404);
    assert.equal(missing.data.error, "inspection_not_found");
  });
});

test("05E bloqueia PDF final com preflight e nao cria documento", async () => {
  await withServer(async (base, service) => {
    const payload = inspectionPayload({ status: "draft", source_id: "blocked-final" });
    payload.inspection_data_json = clone(payload.inspection_data_json);
    payload.inspection_data_json.items[0].descricaoTecnica = "";
    const inspection = await createInspection(base, payload);

    const blocked = await generateDocument(base, inspection.id, "final");
    assert.equal(blocked.response.status, 422);
    assert.equal(blocked.data.code, "INSPECTION_PREFLIGHT_BLOCKED");
    assert.equal(blocked.data.review.canGenerateFinal, false);

    const database = JSON.parse(readFileSync(service.dataPath, "utf8"));
    assert.equal(Object.keys(database.generatedDocuments).length, 0);
    assert.equal(Object.keys(database.documentFiles).length, 0);

    const draft = await generateDocument(base, inspection.id, "draft");
    assert.equal(draft.response.status, 201);
    assertPersistedPdfDocument(draft.data.document, "apartment_handover_draft_pdf");
  });
});
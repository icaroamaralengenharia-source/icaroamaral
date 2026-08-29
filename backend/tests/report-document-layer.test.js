import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function headers(institutionId = "inst-a", userId = "user-a") {
  return {
    "Content-Type": "application/json",
    "x-institution-id": institutionId,
    "x-user-id": userId,
    Origin: "http://127.0.0.1:5500"
  };
}

async function withServer(callback) {
  const dir = mkdtempSync(join(tmpdir(), "obrareport-report-layer-"));
  const service = createObraReportTransactionalService({
    dataPath: join(dir, "obrareport.json"),
    documentStorageDir: join(dir, "documents")
  });
  const app = createApp({ obraReportTransactionalService: service, env: { ELO_SENTINEL_ENABLED: "false" } });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, service);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { raw: text, parseError: error.message };
  }
  return { response, data };
}

test("05H Relatorio Tecnico cria, lista, abre, atualiza, versiona e baixa HTML controlado", async () => {
  await withServer(async (base) => {
    const created = await json(base, "/api/obrareport/reports", {
      method: "POST",
      headers: headers("inst-a", "autor-a"),
      body: JSON.stringify({
        client_id: "client-a",
        project_id: "project-a",
        status: "draft",
        reportData: { obra: "Obra Alfa", pathology: "fissura", summary: "Patologia em alvenaria" }
      })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.report.title, "Obra Alfa");
    assert.equal(created.data.report.institution_id, "inst-a");
    assert.equal(created.data.report.created_by, "autor-a");

    const id = created.data.report.id;
    const list = await json(base, "/api/obrareport/reports?client_id=client-a&project_id=project-a&status=draft&created_by=autor-a", { headers: headers("inst-a", "autor-a") });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.reports.length, 1);
    assert.equal(list.data.reports[0].id, id);

    const got = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id), { headers: headers("inst-a", "autor-a") });
    assert.equal(got.response.status, 200);
    assert.equal(got.data.report.report_data_json.pathology, "fissura");

    const updated = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id), {
      method: "PUT",
      headers: headers("inst-a", "editor-a"),
      body: JSON.stringify({ status: "review", reportData: { title: "Relatorio Alfa", conclusion: "Monitorar fissura." } })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.report.status, "review");
    assert.equal(updated.data.report.updated_by, "editor-a");

    const version = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id) + "/versions", { method: "POST", headers: headers("inst-a", "editor-a"), body: "{}" });
    assert.equal(version.response.status, 201);
    assert.equal(version.data.version.version_number, 1);

    const firstDocument = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id) + "/generate-document", { method: "POST", headers: headers("inst-a", "editor-a"), body: "{}" });
    assert.equal(firstDocument.response.status, 201);
    assert.equal(firstDocument.data.document.source_type, "technical_report");
    assert.equal(firstDocument.data.document.document_type, "technical_report_controlled_html");
    assert.match(firstDocument.data.document.file_url, /^\/api\/obrareport\/documents\/obr_doc_.+\/file$/);
    assert.equal(firstDocument.data.document.file.mime_type, "text/html; charset=utf-8");

    const secondDocument = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id) + "/generate-document", { method: "POST", headers: headers("inst-a", "editor-a"), body: "{}" });
    assert.equal(secondDocument.response.status, 201);
    assert.notEqual(secondDocument.data.document.id, firstDocument.data.document.id);
    assert.notEqual(secondDocument.data.document.file_id, firstDocument.data.document.file_id);

    const documents = await json(base, "/api/obrareport/documents?source_type=technical_report&client_id=client-a&project_id=project-a&status=review&created_by=autor-a", { headers: headers("inst-a", "autor-a") });
    assert.equal(documents.response.status, 200);
    assert.equal(documents.data.documents.length, 1);
    assert.equal(documents.data.documents[0].sourceType, "technical_report");
    assert.equal(documents.data.documents[0].sourceId, id);
    assert.equal(documents.data.documents[0].documentId, secondDocument.data.document.id);
    assert.equal(documents.data.documents[0].fileId, secondDocument.data.document.file.id);
    assert.equal(documents.data.documents[0].fileUrl, secondDocument.data.document.file_url);
    assert.equal(documents.data.documents[0].documentAvailable, true);
    assert.equal(documents.data.documents[0].pdfAvailable, false);
    assert.equal(documents.data.documents[0].canContinue, true);
    assert.equal(documents.data.documents[0].artifactType, "text/html; charset=utf-8");

    const download = await fetch(base + secondDocument.data.document.file_url, { headers: headers("inst-a", "autor-a") });
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type") || "", /^text\/html; charset=utf-8\b/);
    assert.match(await download.text(), /obrareport-controlled-document/);

    const events = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id) + "/events", { headers: headers("inst-a", "autor-a") });
    assert.equal(events.response.status, 200);
    assert.deepEqual(events.data.events.map((event) => event.event_type), [
      "report_created",
      "report_updated",
      "report_version_created",
      "report_document_generated",
      "report_document_generated"
    ]);
  });
});

test("05H Relatorio Tecnico sem documento aparece sem baixar e tenant cruzado nao vaza", async () => {
  await withServer(async (base) => {
    const created = await json(base, "/api/obrareport/reports", {
      method: "POST",
      headers: headers("inst-a", "autor-a"),
      body: JSON.stringify({ client_id: "client-a", project_id: "project-a", title: "Relatorio Privado", reportData: { title: "Relatorio Privado" } })
    });
    const id = created.data.report.id;

    const documents = await json(base, "/api/obrareport/documents?source_type=technical_report", { headers: headers("inst-a", "autor-a") });
    assert.equal(documents.response.status, 200);
    assert.equal(documents.data.documents.length, 1);
    assert.equal(documents.data.documents[0].documentAvailable, false);
    assert.equal(documents.data.documents[0].pdfAvailable, false);
    assert.equal(documents.data.documents[0].fileUrl, "");

    const crossList = await json(base, "/api/obrareport/reports", { headers: headers("inst-b", "user-b") });
    assert.equal(crossList.response.status, 200);
    assert.equal(crossList.data.reports.length, 0);

    const crossGet = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id), { headers: headers("inst-b", "user-b") });
    assert.equal(crossGet.response.status, 404);
    assert.equal(crossGet.data.error, "report_not_found");

    const crossUpdate = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id), {
      method: "PUT",
      headers: headers("inst-b", "user-b"),
      body: JSON.stringify({ reportData: { title: "Ataque" } })
    });
    assert.equal(crossUpdate.response.status, 404);
    assert.equal(crossUpdate.data.error, "report_not_found");

    const crossDocuments = await json(base, "/api/obrareport/documents?source_type=technical_report", { headers: headers("inst-b", "user-b") });
    assert.equal(crossDocuments.response.status, 200);
    assert.equal(crossDocuments.data.documents.length, 0);

    const generated = await json(base, "/api/obrareport/reports/" + encodeURIComponent(id) + "/generate-document", { method: "POST", headers: headers("inst-a", "autor-a"), body: "{}" });
    const crossDownload = await fetch(base + generated.data.document.file_url, { headers: headers("inst-b", "user-b") });
    assert.equal(crossDownload.status, 404);
  });
});
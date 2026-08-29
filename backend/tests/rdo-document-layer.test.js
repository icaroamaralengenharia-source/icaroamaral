import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function tempPath(name) {
  return join(mkdtempSync(join(tmpdir(), "obrareport-rdo-doc-")), name);
}

function headers(institutionId = "inst-a", userId = "user-a") {
  return {
    "Content-Type": "application/json",
    "x-institution-id": institutionId,
    "x-user-id": userId,
    Origin: "http://127.0.0.1:5500"
  };
}

async function withServer(callback) {
  const service = createObraReportTransactionalService({ dataPath: tempPath("obrareport.json"), documentStorageDir: tempPath("documents") });
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

async function createRdo(base, overrides = {}, headerValues = headers()) {
  const payload = Object.assign({
    client_id: "client-a",
    project_id: "project-a",
    status: "draft",
    rdo_date: "2026-08-29",
    rdoData: { date: "2026-08-29", workName: "Obra Alfa", services: "Concretagem do pavimento" }
  }, overrides);
  return json(base, "/api/obrareport/rdos", { method: "POST", headers: headerValues, body: JSON.stringify(payload) });
}

test("05G RDO cria, lista, busca, atualiza, versiona e aparece em /documents", async () => {
  await withServer(async (base) => {
    const created = await createRdo(base, { title: "" });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.rdo.institution_id, "inst-a");
    assert.equal(created.data.rdo.client_id, "client-a");
    assert.equal(created.data.rdo.project_id, "project-a");
    assert.equal(created.data.rdo.rdo_date, "2026-08-29");
    assert.match(created.data.rdo.title, /^RDO - project-a - 2026-08-29$/);

    const id = created.data.rdo.id;
    const list = await json(base, "/api/obrareport/rdos?client_id=client-a&project_id=project-a", { headers: headers() });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.rdos.length, 1);

    const get = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id), { headers: headers() });
    assert.equal(get.response.status, 200);
    assert.equal(get.data.rdo.id, id);

    const updated = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id), {
      method: "PUT",
      headers: headers("inst-a", "user-b"),
      body: JSON.stringify({ status: "completed", rdoData: { date: "2026-08-29", workName: "Obra Alfa", summary: "Concretagem concluida" } })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.rdo.status, "completed");
    assert.equal(updated.data.rdo.updated_by, "user-b");

    const version = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id) + "/versions", { method: "POST", headers: headers() });
    assert.equal(version.response.status, 201);
    assert.equal(version.data.version.version_number, 1);

    const withoutDocument = await json(base, "/api/obrareport/documents?source_type=rdo", { headers: headers() });
    assert.equal(withoutDocument.response.status, 200);
    assert.equal(withoutDocument.data.documents.length, 1);
    assert.equal(withoutDocument.data.documents[0].documentAvailable, false);
    assert.equal(withoutDocument.data.documents[0].pdfAvailable, false);
    assert.equal(withoutDocument.data.documents[0].displayStatus, "CONCLUIDO");
    assert.equal(withoutDocument.data.documents[0].canContinue, false);

    const firstDocument = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id) + "/generate-document", { method: "POST", headers: headers() });
    assert.equal(firstDocument.response.status, 201);
    assert.equal(firstDocument.data.document.source_type, "rdo");
    assert.equal(firstDocument.data.document.document_type, "rdo_controlled_html");
    assert.match(firstDocument.data.document.file_url, /^\/api\/obrareport\/documents\/obr_doc_.+\/file$/);
    assert.equal(firstDocument.data.document.file.mime_type, "text/html; charset=utf-8");
    assert.match(firstDocument.data.document.html_content, /ObraReport RDO/);

    const secondDocument = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id) + "/generate-document", { method: "POST", headers: headers() });
    assert.equal(secondDocument.response.status, 201);
    assert.notEqual(secondDocument.data.document.id, firstDocument.data.document.id);

    const docs = await json(base, "/api/obrareport/documents?source_type=rdo&client_id=client-a&project_id=project-a&status=completed&created_by=user-a", { headers: headers() });
    assert.equal(docs.response.status, 200);
    assert.equal(docs.data.documents.length, 1);
    const rdoCard = docs.data.documents[0];
    assert.equal(rdoCard.sourceType, "rdo");
    assert.equal(rdoCard.sourceId, id);
    assert.equal(rdoCard.documentAvailable, true);
    assert.equal(rdoCard.pdfAvailable, false);
    assert.equal(rdoCard.documentType, "rdo_controlled_html");
    assert.equal(rdoCard.documentId, secondDocument.data.document.id);
    assert.equal(rdoCard.fileId, secondDocument.data.document.file.id);
    assert.equal(rdoCard.fileUrl, secondDocument.data.document.file_url);

    const download = await fetch(base + rdoCard.fileUrl, { headers: headers() });
    assert.equal(download.status, 200);
    assert.match(download.headers.get("content-type") || "", /^text\/html; charset=utf-8/);
    assert.match(await download.text(), /ObraReport RDO/);

    const events = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id) + "/events", { headers: headers() });
    assert.deepEqual(events.data.events.map((event) => event.event_type), ["rdo_created", "rdo_updated", "rdo_version_created", "rdo_document_generated", "rdo_document_generated"]);

    const email = await json(base, "/api/obrareport/documents/" + encodeURIComponent(firstDocument.data.document.id) + "/prepare-email", { method: "POST", headers: headers(), body: JSON.stringify({ subject: "RDO" }) });
    assert.equal(email.response.status, 200);
    assert.equal(email.data.email.sent, false);
  });
});

test("05G RDO bloqueia acesso cross-tenant sem vazamento", async () => {
  await withServer(async (base) => {
    const created = await createRdo(base);
    const id = created.data.rdo.id;
    const document = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id) + "/generate-document", { method: "POST", headers: headers() });

    const crossList = await json(base, "/api/obrareport/rdos", { headers: headers("inst-b", "user-b") });
    assert.equal(crossList.response.status, 200);
    assert.equal(crossList.data.rdos.length, 0);

    const crossGet = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id), { headers: headers("inst-b", "user-b") });
    assert.equal(crossGet.response.status, 404);
    assert.equal(crossGet.data.error, "rdo_not_found");

    const crossUpdate = await json(base, "/api/obrareport/rdos/" + encodeURIComponent(id), { method: "PUT", headers: headers("inst-b", "user-b"), body: JSON.stringify({ status: "completed", rdoData: { date: "2026-08-29" } }) });
    assert.equal(crossUpdate.response.status, 404);
    assert.equal(crossUpdate.data.error, "rdo_not_found");

    const crossDocuments = await json(base, "/api/obrareport/documents?source_type=rdo", { headers: headers("inst-b", "user-b") });
    assert.equal(crossDocuments.response.status, 200);
    assert.equal(crossDocuments.data.documents.length, 0);

    const crossDownload = await fetch(base + document.data.document.file_url, { headers: headers("inst-b", "user-b") });
    assert.equal(crossDownload.status, 404);
    assert.equal((await crossDownload.json()).error, "document_not_found");
  });
});
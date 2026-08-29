import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function tempPath(name) {
  return join(mkdtempSync(join(tmpdir(), "obrareport-documents-")), name);
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

async function requestJson(base, path, options = {}) {
  const response = await fetch(base + path, options);
  return { response, data: await response.json() };
}

function seedThreeTypes(service) {
  const report = service.createTechnicalReport({ institutionId: "inst-a", userId: "user-report" }, {
    client_id: "client-a",
    project_id: "project-a",
    title: "Relatorio patologico A",
    status: "draft",
    reportData: { title: "Relatorio patologico A", obra: "Obra Alfa", pathology: "fissura" }
  });
  service.generateTechnicalReportDocument({ institutionId: "inst-a", userId: "user-report" }, report.id);

  const rdo = service.createRdo({ institutionId: "inst-a", userId: "user-rdo" }, {
    client_id: "client-a",
    project_id: "project-a",
    title: "RDO Obra Alfa",
    status: "closed",
    rdo_date: "2026-08-28",
    rdoData: { summary: "Concretagem", services: "Concretagem de piso", date: "2026-08-28" }
  });
  service.generateRdoDocument({ institutionId: "inst-a", userId: "user-rdo" }, rdo.id);

  const inspection = service.createApartmentHandoverInspection({ institutionId: "inst-a", userId: "user-vistoria" }, {
    client_id: "client-a",
    project_id: "project-a",
    source_id: "local-vistoria-a",
    title: "Vistoria Apto 101",
    status: "completed",
    inspection_data_json: { metadata: { projectName: "Obra Alfa", unitName: "101" }, items: Array.from({ length: 144 }, (_, index) => ({ number: index + 1, status: "C" })) }
  });
  const draft = service.generateApartmentHandoverInspectionPdfDocument({ institutionId: "inst-a", userId: "user-vistoria" }, inspection.id, {
    mode: "draft",
    filename: "vistoria-draft.pdf",
    pdfBuffer: Buffer.from("%PDF draft 05f")
  });
  const final = service.generateApartmentHandoverInspectionPdfDocument({ institutionId: "inst-a", userId: "user-vistoria" }, inspection.id, {
    mode: "final",
    filename: "vistoria-final.pdf",
    pdfBuffer: Buffer.from("%PDF final 05f")
  });

  service.createApartmentHandoverInspection({ institutionId: "inst-b", userId: "user-b" }, {
    client_id: "client-b",
    project_id: "project-b",
    source_id: "tenant-b-vistoria",
    title: "Vistoria tenant B",
    status: "draft",
    inspection_data_json: { items: [] }
  });

  return { report, rdo, inspection, draft, final };
}

test("GET /api/obrareport/documents lista technical_report, rdo e vistoria com latest PDF", async () => {
  await withServer(async (base, service) => {
    const seeded = seedThreeTypes(service);
    const result = await requestJson(base, "/api/obrareport/documents", { headers: headers() });

    assert.equal(result.response.status, 200);
    assert.equal(result.data.ok, true);
    assert.equal(result.data.documents.length, 3);
    assert.deepEqual(result.data.documents.map((item) => item.sourceType).sort(), ["apartment_handover_inspection", "rdo", "technical_report"]);

    const report = result.data.documents.find((item) => item.sourceType === "technical_report");
    assert.equal(report.title, "Relatorio patologico A");
    assert.equal(report.documentAvailable, true);
    assert.equal(report.pdfAvailable, false);
    assert.equal(report.documentType, "technical_report_controlled_html");
    assert.match(report.fileUrl, /^\/api\/obrareport\/documents\/obr_doc_.+\/file$/);
    assert.equal(report.canContinue, true);

    const rdo = result.data.documents.find((item) => item.sourceType === "rdo");
    assert.equal(rdo.date, "2026-08-28");
    assert.equal(rdo.displayStatus, "CONCLUIDO");
    assert.equal(rdo.documentAvailable, true);
    assert.equal(rdo.pdfAvailable, false);
    assert.equal(rdo.documentType, "rdo_controlled_html");
    assert.match(rdo.fileUrl, /^\/api\/obrareport\/documents\/obr_doc_.+\/file$/);

    const inspection = result.data.documents.find((item) => item.sourceType === "apartment_handover_inspection");
    assert.equal(inspection.sourceId, seeded.inspection.id);
    assert.equal(inspection.localSourceId, "local-vistoria-a");
    assert.equal(inspection.documentId, seeded.final.id);
    assert.equal(inspection.fileId, seeded.final.file.id);
    assert.equal(inspection.documentType, "apartment_handover_final_pdf");
    assert.equal(inspection.pdfAvailable, true);
    assert.equal(inspection.canReinspect, true);
    assert.equal(inspection.canContinue, false);
  });
});

test("GET /api/obrareport/documents aplica filtros e isola tenants", async () => {
  await withServer(async (base, service) => {
    seedThreeTypes(service);

    const tenantB = await requestJson(base, "/api/obrareport/documents", { headers: headers("inst-b", "user-b") });
    assert.equal(tenantB.response.status, 200);
    assert.equal(tenantB.data.documents.length, 1);
    assert.equal(tenantB.data.documents[0].institutionId, "inst-b");

    const client = await requestJson(base, "/api/obrareport/documents?client_id=client-a", { headers: headers() });
    assert.equal(client.data.documents.length, 3);

    const project = await requestJson(base, "/api/obrareport/documents?project_id=project-a", { headers: headers() });
    assert.equal(project.data.documents.length, 3);

    const type = await requestJson(base, "/api/obrareport/documents?source_type=technical_report", { headers: headers() });
    assert.equal(type.data.documents.length, 1);
    assert.equal(type.data.documents[0].sourceType, "technical_report");

    const status = await requestJson(base, "/api/obrareport/documents?status=closed", { headers: headers() });
    assert.equal(status.data.documents.length, 1);
    assert.equal(status.data.documents[0].sourceType, "rdo");

    const createdBy = await requestJson(base, "/api/obrareport/documents?created_by=user-report", { headers: headers() });
    assert.equal(createdBy.data.documents.length, 1);
    assert.equal(createdBy.data.documents[0].sourceType, "technical_report");

    const noLeak = await requestJson(base, "/api/obrareport/documents?client_id=client-b", { headers: headers() });
    assert.equal(noLeak.data.documents.length, 0);
  });
});
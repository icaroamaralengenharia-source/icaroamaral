const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const ROOT = join(__dirname, "..");
const ADAPTER_PATH = join(ROOT, "vistoria-entrega-apartamento", "apartment-handover-document-adapter.js");
const TEMPLATE_PATH = join(ROOT, "vistoria-entrega-apartamento", "inspection-template.js");

function loadAdapter() {
  const context = { module: { exports: {} }, exports: {}, window: {} };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(ADAPTER_PATH, "utf8"), context, { filename: ADAPTER_PATH });
  return context.module.exports;
}

function loadTemplate() {
  const context = { window: {} };
  context.globalThis = context;
  vm.runInNewContext(readFileSync(TEMPLATE_PATH, "utf8"), context, { filename: TEMPLATE_PATH });
  return context.window.VistoriaEntregaTemplates.templates[0];
}

function resultKey(environmentId, itemId) {
  return `${environmentId}::${itemId}`;
}

function createState(overrides = {}) {
  const template = loadTemplate();
  const results = {};
  for (const item of template.items) {
    results[resultKey(item.environmentId, item.id)] = {
      type: "inspectionResult",
      inspectionItemId: item.id,
      environmentId: item.environmentId,
      systemId: item.systemId,
      status: "NAO_INSPECIONADO",
      photoIds: []
    };
  }

  const sala = results["sala::sala-piso-integridade"];
  const cozinha = results["cozinha::cozinha-piso-integridade"];
  const servico = results["area-servico::area-servico-servico-tanque"];
  const banheiro = results["banheiro-social::banheiro-social-banheiro-bacia"];
  sala.status = "C";
  cozinha.status = "NC";
  cozinha.photoIds = ["photo-1", "photo-2"];
  servico.status = "NA";
  banheiro.status = "NV";

  return {
    id: "inspection-05a",
    type: "apartment_handover_inspection",
    inspection: {
      templateId: template.id,
      metadata: {
        projectName: "Residencial Campo Real",
        developerName: "Construtora Alfa",
        towerName: "Torre B",
        unitName: "Apto 802",
        address: "Rua Tecnica, 100",
        clientName: "Cliente Teste",
        technicalResponsible: "Eng. Responsavel",
        professionalRegistry: "CREA 12345",
        inspectionDate: "2026-08-29",
        inspectionType: "Pre-entrega"
      },
      environments: template.environments,
      systems: template.systems,
      items: template.items,
      results,
      photos: {
        "photo-1": { id: "photo-1", fileName: "nc-1.jpg", mimeType: "image/jpeg", storedIn: "indexedDB", data: Buffer.from("fake") },
        "photo-2": { id: "photo-2", fileName: "nc-2.jpg", mimeType: "image/jpeg", storedIn: "indexedDB", base64: "abc" }
      },
      measurements: {},
      instruments: [],
      status: overrides.status || "draft",
      startedAt: "2026-08-29T10:00:00.000Z",
      completedAt: overrides.completedAt || "",
      reopenedAt: "",
      reinspection_of_id: overrides.reinspectionOfId || ""
    }
  };
}

test("converte a vistoria atual em documento corporativo sem alterar itens/status", () => {
  const adapter = loadAdapter();
  const state = createState();
  const context = {
    institutionId: "inst-obrareport",
    clientId: "client-campo-real",
    projectId: "project-torre-b",
    createdBy: "user-vistoriador"
  };

  const document = adapter.toDocument(state, context);
  const listItem = adapter.toDocumentListItem(state, context);
  const payload = adapter.toTransactionalPayload(state, context);

  assert.equal(document.sourceType, "apartment_handover_inspection");
  assert.equal(document.sourceId, "inspection-05a");
  assert.equal(document.institutionId, "inst-obrareport");
  assert.equal(document.clientId, "client-campo-real");
  assert.equal(document.projectId, "project-torre-b");
  assert.equal(document.createdBy, "user-vistoriador");
  assert.equal(document.title, "Vistoria de Entrega - Residencial Campo Real - Torre B Apto 802");
  assert.equal(document.status, "draft");
  assert.equal(document.canContinue, true);
  assert.equal(document.canReinspect, false);
  assert.equal(document.pdfAvailable, false);
  assert.equal(document.latestDocumentId, null);
  assert.equal(document.latestFileId, null);

  assert.equal(document.metadata.summary.totalItems, 144);
  assert.equal(document.metadata.summary.conforme, 1);
  assert.equal(document.metadata.summary.naoConforme, 1);
  assert.equal(document.metadata.summary.naoAplicavel, 1);
  assert.equal(document.metadata.summary.naoVerificado, 1);
  assert.equal(document.metadata.summary.naoInspecionado, 140);
  assert.equal(document.metadata.photoCount, 2);
  assert.equal(document.metadata.hasPhotos, true);

  assert.equal(listItem.id, "inspection-05a");
  assert.equal(listItem.sourceType, "apartment_handover_inspection");
  assert.equal(listItem.pdfAvailable, false);
  assert.equal(listItem.canContinue, true);

  assert.equal(payload.institution_id, "inst-obrareport");
  assert.equal(payload.client_id, "client-campo-real");
  assert.equal(payload.project_id, "project-torre-b");
  assert.equal(payload.created_by, "user-vistoriador");
  assert.equal(payload.status, "draft");
  assert.equal(payload.inspection_data_json.items.length, 144);
  assert.equal(payload.inspection_data_json.results["sala::sala-piso-integridade"].status, "C");
  assert.equal(payload.inspection_data_json.results["cozinha::cozinha-piso-integridade"].status, "NC");
  assert.equal(payload.inspection_data_json.results["area-servico::area-servico-servico-tanque"].status, "NA");
  assert.equal(payload.inspection_data_json.results["banheiro-social::banheiro-social-banheiro-bacia"].status, "NV");
  assert.equal(payload.inspection_data_json.photos["photo-1"].data, undefined);
  assert.equal(payload.inspection_data_json.photos["photo-2"].base64, undefined);
});

test("normaliza vistoria concluida, PDF persistido futuro e re-vistoria opcional", () => {
  const adapter = loadAdapter();
  const state = createState({
    status: "completed",
    completedAt: "2026-08-29T12:00:00.000Z",
    reinspectionOfId: "inspection-original"
  });

  const document = adapter.toDocument(state, { institution_id: "inst", client_id: "cli", project_id: "proj", created_by: "usr" }, {
    documentId: "doc-1",
    fileId: "file-1",
    pdfUrl: "https://example.com/laudo.pdf"
  });

  assert.equal(document.status, "final_pdf_generated");
  assert.equal(document.canContinue, false);
  assert.equal(document.canReinspect, true);
  assert.equal(document.pdfAvailable, true);
  assert.equal(document.latestDocumentId, "doc-1");
  assert.equal(document.latestFileId, "file-1");
  assert.equal(document.metadata.reinspectionOfId, "inspection-original");

  const listItem = adapter.toDocumentListItem(state, { institution_id: "inst", client_id: "cli", project_id: "proj", created_by: "usr" }, {
    document_id: "doc-1",
    file_id: "file-1"
  });
  assert.equal(listItem.id, "doc-1");
  assert.equal(listItem.canContinue, false);
  assert.equal(listItem.canReinspect, true);
});

test("usa fallback seguro quando a entrada vem incompleta", () => {
  const adapter = loadAdapter();
  const document = adapter.toDocument({ inspection: { results: {} } }, {}, {});
  const payload = adapter.toTransactionalPayload({ inspection: { results: {} } }, {}, {});

  assert.equal(document.sourceType, "apartment_handover_inspection");
  assert.equal(document.title, "Vistoria de Entrega");
  assert.equal(document.status, "draft");
  assert.equal(document.metadata.summary.totalItems, 0);
  assert.equal(document.metadata.photoCount, 0);
  assert.equal(document.metadata.hasPhotos, false);
  assert.equal(payload.inspection_data_json.documentMetadata.summary.totalItems, 0);
});

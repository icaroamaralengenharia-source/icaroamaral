import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const adapterSource = readFileSync(join(root, "..", "relatorio-qualidade-obras", "rdo-cloud-adapter.js"), "utf8");
const uiSource = readFileSync(join(root, "..", "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");

function createAdapter(fetchImpl) {
  const sandbox = { window: {} };
  vm.runInNewContext(adapterSource, sandbox, { filename: "rdo-cloud-adapter.js" });
  return sandbox.window.ObraReportRdoCloudAdapter.create({
    baseUrl: "https://backend.example.test",
    getToken: async () => "fixture-canonical-token",
    fetchImpl
  });
}

test("adapter usa Stock work id canônico e contrato oficial RDO em create/open/list/update/document", async () => {
  const calls = [];
  const responses = [
    { ok: true, works: [{ id: "WORK_A1_CANONICAL", institution_id: "tenant-a", client_id: "client-a", name: "Obra A1", address: "Rua A" }] },
    { ok: true, rdo: { id: "RDO_SERVER_ID", institution_id: "tenant-a", project_id: "WORK_A1_CANONICAL", rdo_date: "2026-10-11", rdo_data_json: { operationId: "op-ui-1", date: "2026-10-11", summary: "Primeiro diário" } } },
    { ok: true, rdos: [{ id: "RDO_SERVER_ID", project_id: "WORK_A1_CANONICAL", rdo_date: "2026-10-11", rdo_data_json: { operationId: "op-ui-1", summary: "Primeiro diário" } }] },
    { ok: true, rdo: { id: "RDO_SERVER_ID", project_id: "WORK_A1_CANONICAL", rdo_date: "2026-10-11", rdo_data_json: { operationId: "op-ui-1", summary: "Primeiro diário" } } },
    { ok: true, rdo: { id: "RDO_SERVER_ID", project_id: "WORK_A1_CANONICAL", rdo_date: "2026-10-11", rdo_data_json: { operationId: "op-ui-1", summary: "Diário atualizado" } } },
    { ok: true, document: { id: "DOC_SERVER_ID", open_url: "/api/obrareport/documents/DOC_SERVER_ID/content" } },
    { ok: true, blob: true }
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const body = responses.shift();
    return {
      ok: true,
      status: 200,
      json: async () => body,
      blob: async () => ({ type: "application/pdf" })
    };
  };
  const adapter = createAdapter(fetchImpl);

  const works = await adapter.listStockWorks();
  assert.equal(works[0].id, "WORK_A1_CANONICAL");
  assert.equal(works[0].canonicalWorkId, "WORK_A1_CANONICAL");
  assert.equal(works[0].canonicalStockWork, true);
  assert.equal(calls[0].url, "https://backend.example.test/api/stock-full/works");
  assert.equal(calls[0].options.headers.Authorization, "Bearer fixture-canonical-token");

  const log = { id: "op-ui-1", operationId: "op-ui-1", workId: works[0].id, date: "2026-10-11", summary: "Primeiro diário", userId: "ui-user" };
  const created = await adapter.createRdo(log, works[0], "op-ui-1");
  const createBody = JSON.parse(calls[1].options.body);
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].url, "https://backend.example.test/api/obrareport/rdos");
  assert.equal(createBody.projectId, "WORK_A1_CANONICAL");
  assert.equal(createBody.rdoData.projectId, "WORK_A1_CANONICAL");
  assert.equal(Object.hasOwn(createBody, "institutionId"), false);
  assert.equal(created.id, "RDO_SERVER_ID");
  assert.equal(adapter.mapRdoToDailyLog(created, "ui-user").id, "RDO_SERVER_ID");

  const listed = await adapter.listRdosByWork("WORK_A1_CANONICAL");
  assert.equal(calls[2].url, "https://backend.example.test/api/obrareport/rdos?projectId=WORK_A1_CANONICAL");
  assert.equal(listed[0].id, "RDO_SERVER_ID");
  const opened = await adapter.getRdo("RDO_SERVER_ID");
  assert.equal(calls[3].url, "https://backend.example.test/api/obrareport/rdos/RDO_SERVER_ID");
  assert.equal(opened.project_id, "WORK_A1_CANONICAL");

  const updated = await adapter.updateRdo("RDO_SERVER_ID", Object.assign({}, log, { summary: "Diário atualizado" }), works[0]);
  assert.equal(calls[4].options.method, "PUT");
  assert.equal(calls[4].url, "https://backend.example.test/api/obrareport/rdos/RDO_SERVER_ID");
  assert.equal(updated.id, "RDO_SERVER_ID");

  const document = await adapter.generateDocument("RDO_SERVER_ID", "WORK_A1_CANONICAL", "rdo:RDO_SERVER_ID:pdf:updated-at");
  assert.equal(calls[5].url, "https://backend.example.test/api/obrareport/rdos/RDO_SERVER_ID/generate-document");
  assert.equal(JSON.parse(calls[5].options.body).workId, "WORK_A1_CANONICAL");
  assert.equal(JSON.parse(calls[5].options.body).idempotencyKey, "rdo:RDO_SERVER_ID:pdf:updated-at");
  const pdf = await adapter.fetchDocumentPdf(document.document.id);
  assert.equal(calls[6].url, "https://backend.example.test/api/obrareport/documents/DOC_SERVER_ID/content");
  assert.equal(pdf.type, "application/pdf");
  assert.equal(Object.values(calls).some((call) => call.options.method === "DELETE"), false);
});

test("UI trata dailyLogs/works como cache e exclui ambos do sync.save genérico", () => {
  const cloudStateStart = uiSource.indexOf("function buildCloudState_(fullDraft)");
  const cloudStateEnd = uiSource.indexOf("function getDailyLogsForCloud_()", cloudStateStart);
  const cloudStateBuilder = uiSource.slice(cloudStateStart, cloudStateEnd);
  assert.match(cloudStateBuilder, /clients: appState\.clients/);
  assert.match(cloudStateBuilder, /reports: reports/);
  assert.doesNotMatch(cloudStateBuilder, /works\s*:/);
  assert.doesNotMatch(cloudStateBuilder, /dailyLogs\s*:/);
  assert.match(uiSource, /rdoCloudAdapter\.listStockWorks\(\)/);
  assert.match(uiSource, /rdoCloudAdapter\.listRdosByWork\(id\)/);
  assert.match(uiSource, /rdoCloudAdapter\.createRdo\(logItem, work/);
  assert.match(uiSource, /rdoCloudAdapter\.updateRdo\(logItem\.id, logItem, work\)/);
  assert.match(uiSource, /rdoCloudAdapter\.getRdo\(dailyLogId\)/);
  assert.doesNotMatch(uiSource, /appState\.works\.push\(work\)/);
});

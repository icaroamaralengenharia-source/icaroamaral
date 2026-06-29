import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

async function withServer(callback) {
  const dir = mkdtempSync(join(tmpdir(), "obrareport-api-"));
  const app = createApp({
    obraReportTransactionalService: createObraReportTransactionalService({ dataPath: join(dir, "obrareport.json") })
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
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
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { parseError: error.message, raw: text };
  }
  return { response, data };
}

const headersA = { "x-institution-id": "inst_a", "x-user-id": "user_a" };
const headersB = { "x-institution-id": "inst_b", "x-user-id": "user_b" };

test("ObraReport API cria, lista, busca, atualiza, versiona, documenta e audita relatorio", async () => {
  await withServer(async (base) => {
    const created = await json(base + "/api/obrareport/reports", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        projectId: "obra_001",
        clientId: "cliente_001",
        title: "Relatorio de vistoria",
        reportData: { title: "Relatorio de vistoria", obra: "Residencial Alfa", pathology: "fissura em alvenaria" }
      })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.report.institution_id, "inst_a");
    assert.equal(created.data.report.created_by, "user_a");

    const id = created.data.report.id;
    const list = await json(base + "/api/obrareport/reports", { headers: headersA });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.reports.length, 1);
    assert.equal(list.data.reports[0].id, id);

    const got = await json(base + "/api/obrareport/reports/" + id, { headers: headersA });
    assert.equal(got.response.status, 200);
    assert.equal(got.data.report.report_data_json.obra, "Residencial Alfa");

    const updated = await json(base + "/api/obrareport/reports/" + id, {
      method: "PUT",
      headers: headersA,
      body: JSON.stringify({ status: "review", reportData: { title: "Relatorio de vistoria", conclusion: "Solicitar monitoramento." } })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.report.status, "review");
    assert.equal(updated.data.report.report_data_json.conclusion, "Solicitar monitoramento.");

    const version = await json(base + "/api/obrareport/reports/" + id + "/versions", { method: "POST", headers: headersA, body: "{}" });
    assert.equal(version.response.status, 201);
    assert.equal(version.data.version.version_number, 1);

    const document = await json(base + "/api/obrareport/reports/" + id + "/generate-document", { method: "POST", headers: headersA, body: "{}" });
    assert.equal(document.response.status, 201);
    assert.equal(document.data.document.document_type, "technical_report_controlled_html");
    assert.match(document.data.document.html_content, /obrareport-controlled-document/);

    const events = await json(base + "/api/obrareport/reports/" + id + "/events", { headers: headersA });
    assert.equal(events.response.status, 200);
    assert.deepEqual(events.data.events.map((event) => event.event_type), [
      "report_created",
      "report_updated",
      "report_version_created",
      "report_document_generated"
    ]);
  });
});

test("ObraReport API bloqueia acesso cruzado por institutionId", async () => {
  await withServer(async (base) => {
    const created = await json(base + "/api/obrareport/reports", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ title: "Relatorio A", reportData: { title: "Relatorio A" } })
    });
    const id = created.data.report.id;

    const blocked = await json(base + "/api/obrareport/reports/" + id, { headers: headersB });
    assert.equal(blocked.response.status, 403);
    assert.equal(blocked.data.error, "report_forbidden");

    const listB = await json(base + "/api/obrareport/reports", { headers: headersB });
    assert.equal(listB.response.status, 200);
    assert.equal(listB.data.reports.length, 0);
  });
});

test("ObraReport API cria, atualiza, versiona, documenta e audita RDO", async () => {
  await withServer(async (base) => {
    const created = await json(base + "/api/obrareport/rdos", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({
        projectId: "obra_001",
        title: "RDO 001",
        rdoData: { date: "2026-06-28", weather: "sol", activities: ["concretagem de viga"] }
      })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.rdo.institution_id, "inst_a");
    assert.equal(created.data.rdo.rdo_date, "2026-06-28");

    const id = created.data.rdo.id;
    const list = await json(base + "/api/obrareport/rdos", { headers: headersA });
    assert.equal(list.response.status, 200);
    assert.equal(list.data.rdos.length, 1);

    const updated = await json(base + "/api/obrareport/rdos/" + id, {
      method: "PUT",
      headers: headersA,
      body: JSON.stringify({ status: "closed", rdoData: { date: "2026-06-28", activities: ["concretagem concluida"] } })
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.data.rdo.status, "closed");

    const version = await json(base + "/api/obrareport/rdos/" + id + "/versions", { method: "POST", headers: headersA, body: "{}" });
    assert.equal(version.response.status, 201);
    assert.equal(version.data.version.version_number, 1);

    const document = await json(base + "/api/obrareport/rdos/" + id + "/generate-document", { method: "POST", headers: headersA, body: "{}" });
    assert.equal(document.response.status, 201);
    assert.equal(document.data.document.document_type, "rdo_controlled_html");
    assert.match(document.data.document.html_content, /ObraReport RDO/);

    const events = await json(base + "/api/obrareport/rdos/" + id + "/events", { headers: headersA });
    assert.equal(events.response.status, 200);
    assert.deepEqual(events.data.events.map((event) => event.event_type), [
      "rdo_created",
      "rdo_updated",
      "rdo_version_created",
      "rdo_document_generated"
    ]);
  });
});

test("ObraReport API prepara email sem envio real", async () => {
  await withServer(async (base) => {
    const created = await json(base + "/api/obrareport/reports", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ title: "Relatorio para email", reportData: { title: "Relatorio para email" } })
    });
    const document = await json(base + "/api/obrareport/reports/" + created.data.report.id + "/generate-document", { method: "POST", headers: headersA, body: "{}" });
    const email = await json(base + "/api/obrareport/documents/" + document.data.document.id + "/prepare-email", {
      method: "POST",
      headers: headersA,
      body: JSON.stringify({ subject: "Relatorio para revisao" })
    });
    assert.equal(email.response.status, 200);
    assert.equal(email.data.email.ok, true);
    assert.equal(email.data.email.mode, "prepared");
    assert.equal(email.data.email.sent, false);
    assert.match(email.data.email.message, /provedor SMTP\/Resend/);
  });
});
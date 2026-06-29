import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function createService() {
  const dir = mkdtempSync(join(tmpdir(), "obrareport-service-"));
  const service = createObraReportTransactionalService({ dataPath: join(dir, "obrareport.json") });
  return {
    service,
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

const contextA = { institutionId: "inst_a", userId: "user_a" };
const contextB = { institutionId: "inst_b", userId: "user_b" };

test("ObraReport service cria, lista, busca, atualiza, versiona, documenta e audita relatorio tecnico", () => {
  const { service, cleanup } = createService();
  try {
    const report = service.createTechnicalReport(contextA, {
      projectId: "obra_001",
      clientId: "cliente_001",
      title: "Relatorio de vistoria",
      reportData: {
        title: "Relatorio de vistoria",
        obra: "Residencial Alfa",
        pathology: "fissura em alvenaria"
      }
    });

    assert.equal(report.institution_id, "inst_a");
    assert.equal(report.created_by, "user_a");
    assert.equal(report.report_data_json.obra, "Residencial Alfa");

    const listed = service.listTechnicalReports(contextA);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, report.id);

    const fetched = service.getTechnicalReport(contextA, report.id);
    assert.equal(fetched.title, "Relatorio de vistoria");

    const updated = service.updateTechnicalReport(contextA, report.id, {
      status: "review",
      reportData: {
        title: "Relatorio de vistoria",
        conclusion: "Solicitar monitoramento."
      }
    });
    assert.equal(updated.status, "review");
    assert.equal(updated.updated_by, "user_a");
    assert.equal(updated.report_data_json.conclusion, "Solicitar monitoramento.");

    const version = service.createTechnicalReportVersion(contextA, report.id);
    assert.equal(version.version_number, 1);
    assert.equal(version.report_id, report.id);

    const document = service.generateTechnicalReportDocument(contextA, report.id);
    assert.equal(document.source_type, "technical_report");
    assert.equal(document.document_type, "technical_report_controlled_html");
    assert.match(document.html_content, /obrareport-controlled-document/);
    assert.match(document.html_content, /Documento controlado pelo ObraReport/);
    assert.equal(document.hash, document.file.hash);

    const email = service.prepareDocumentEmail(contextA, document.id, { subject: "Relatorio para revisao" });
    assert.equal(email.ok, true);
    assert.equal(email.mode, "prepared");
    assert.equal(email.sent, false);
    assert.match(email.message, /provedor SMTP\/Resend/);

    const events = service.listReportEvents(contextA, report.id).map((event) => event.event_type);
    assert.deepEqual(events, [
      "report_created",
      "report_updated",
      "report_version_created",
      "report_document_generated",
      "email_prepared",
      "email_sent_placeholder"
    ]);
  } finally {
    cleanup();
  }
});

test("ObraReport service bloqueia acesso cruzado por institutionId", () => {
  const { service, cleanup } = createService();
  try {
    const report = service.createTechnicalReport(contextA, {
      title: "Relatorio privado",
      reportData: { title: "Relatorio privado" }
    });

    assert.equal(service.listTechnicalReports(contextB).length, 0);
    assert.throws(() => service.getTechnicalReport(contextB, report.id), /report_forbidden/);
    assert.throws(() => service.updateTechnicalReport(contextB, report.id, { reportData: { title: "Ataque" } }), /report_forbidden/);
    assert.throws(() => service.generateTechnicalReportDocument(contextB, report.id), /report_forbidden/);
  } finally {
    cleanup();
  }
});

test("ObraReport service cria, atualiza, versiona, documenta e audita RDO", () => {
  const { service, cleanup } = createService();
  try {
    const rdo = service.createRdo(contextA, {
      projectId: "obra_001",
      title: "RDO 001",
      rdoData: {
        date: "2026-06-28",
        weather: "sol",
        activities: ["concretagem de viga"]
      }
    });

    assert.equal(rdo.institution_id, "inst_a");
    assert.equal(rdo.created_by, "user_a");
    assert.equal(rdo.rdo_date, "2026-06-28");

    const listed = service.listRdos(contextA);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, rdo.id);

    const fetched = service.getRdo(contextA, rdo.id);
    assert.equal(fetched.rdo_data_json.weather, "sol");

    const updated = service.updateRdo(contextA, rdo.id, {
      status: "closed",
      rdoData: {
        date: "2026-06-28",
        activities: ["concretagem concluida"]
      }
    });
    assert.equal(updated.status, "closed");
    assert.deepEqual(updated.rdo_data_json.activities, ["concretagem concluida"]);

    const version = service.createRdoVersion(contextA, rdo.id);
    assert.equal(version.version_number, 1);
    assert.equal(version.rdo_id, rdo.id);

    const document = service.generateRdoDocument(contextA, rdo.id);
    assert.equal(document.source_type, "rdo");
    assert.equal(document.document_type, "rdo_controlled_html");
    assert.match(document.html_content, /ObraReport RDO/);
    assert.match(document.html_content, /obrareport-controlled-document/);

    const events = service.listRdoEvents(contextA, rdo.id).map((event) => event.event_type);
    assert.deepEqual(events, [
      "rdo_created",
      "rdo_updated",
      "rdo_version_created",
      "rdo_document_generated"
    ]);
  } finally {
    cleanup();
  }
});

test("ObraReport service valida dados minimos", () => {
  const { service, cleanup } = createService();
  try {
    assert.throws(() => service.createTechnicalReport({}, { reportData: { title: "Sem instituicao" } }), /institution_required/);
    assert.throws(() => service.createTechnicalReport(contextA, { title: "Sem dados" }), /report_data_required/);
    assert.throws(() => service.createRdo(contextA, { title: "Sem dados" }), /rdo_data_required/);
  } finally {
    cleanup();
  }
});
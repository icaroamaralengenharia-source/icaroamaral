import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildRdoGeneratorPayload } from "../src/services/obrareport-report-orchestrator.js";

const repoRoot = join(process.cwd(), "..");
const appsScript = readFileSync(join(repoRoot, "apps-script-versionado", "Code.gs"), "utf8");

test("RDO payload uses persisted identifiers and work data without inventing fiscalization fields", () => {
  const payload = buildRdoGeneratorPayload(
    {
      id: "rdo-a",
      project_id: "work-a",
      rdo_date: "2026-09-14",
      rdo_data_json: {
        climate: "Ensolarado",
        services: ["Alvenaria"],
        observations: "Registro controlado"
      }
    },
    {},
    { id: "work-a", name: "OBRA TESTE ELO E2E" },
    { institutionId: "tenant-a", profile: { institution_id: "tenant-a" } }
  );

  assert.equal(payload.documentType, "rdo");
  assert.equal(payload.workId, "work-a");
  assert.equal(payload.rdoId, "rdo-a");
  assert.equal(payload.institutionId, "tenant-a");
  assert.equal(payload.report.workName, "OBRA TESTE ELO E2E");
  assert.equal(payload.report.date, "2026-09-14");
  assert.equal(payload.report.climate, "Ensolarado");
  assert.equal(payload.report.services[0], "Alvenaria");
  assert.equal(payload.report.observations, "Registro controlado");
  assert.equal(Object.hasOwn(payload.report, "dataVistoria"), false);
  assert.equal(Object.hasOwn(payload.report, "tipoObra"), false);
  assert.equal(Object.hasOwn(payload.report, "emailDestino"), false);
});

test("RDO payload remains valid when optional fields are absent", () => {
  const payload = buildRdoGeneratorPayload(
    { id: "rdo-a", project_id: "work-a", rdo_date: "2026-09-14", rdo_data_json: {} },
    {},
    { id: "work-a", title: "OBRA TESTE ELO E2E" },
    { institutionId: "tenant-a" }
  );

  assert.equal(payload.documentType, "rdo");
  assert.equal(payload.report.workName, "OBRA TESTE ELO E2E");
  assert.equal(payload.report.date, "2026-09-14");
  assert.deepEqual(payload.fotosRdo, []);
});

test("RDO PDF uses persisted standalone production and corrected team quantities", () => {
  const production = [{ id: "production-stable", service: "Alvenaria", quantity: 15, unit: "m²", note: "Certificacao sintetica" }];
  const requests = [{ id: "request-stable", name: "Cimento", quantity: 2, unit: "saco" }];
  const payload = buildRdoGeneratorPayload({ id: "rdo-a", project_id: "work-a", rdo_date: "2026-10-15", rdo_data_json: {
    weather: "Sol", teamPresent: "Equipe sintetica", employeeCount: 5,
    productions: production, materialRequests: requests, generalNotes: "ELO_RDO_E2E_20261014",
    startTime: "07:00", endTime: "17:00", progress: 10
  } }, {}, { id: "work-a", name: "OBRA TESTE ELO E2E" }, { institutionId: "tenant-a" });
  assert.equal(payload.report.climate, "Sol");
  assert.equal(payload.report.team, "Equipe sintetica");
  assert.equal(payload.report.workers, 5);
  assert.equal(payload.report.production, "Alvenaria: 15 m² — Certificacao sintetica");
  assert.doesNotMatch(payload.report.production, /production-stable|quantity|service|[{}]/);
  assert.deepEqual(payload.report.requests, requests);
  assert.equal(payload.report.observations, "ELO_RDO_E2E_20261014");
  assert.equal(payload.report.hours, "07:00 - 17:00");
  assert.equal(payload.report.physicalProgress, 10);
  assert.equal(payload.rdoId, "rdo-a");
  assert.equal(payload.workId, "work-a");
});

test("standalone aliases preserve existing legacy generator fields", () => {
  const data = {
    climate: "Nublado", weather: "Sol", hours: "Jornada registrada", startTime: "07:00", endTime: "17:00",
    team: "Equipe legada", teamPresent: "Equipe atual", workers: 3, employeeCount: 5,
    production: [{ quantity: 1 }], productions: [{ quantity: 15 }],
    observations: "Nota legada", generalNotes: "Nota atual", requests: ["Solicitacao legada"], materialRequests: ["Alias"]
  };
  const payload = buildRdoGeneratorPayload({ id: "rdo-a", project_id: "work-a", rdo_date: "2026-10-15", rdo_data_json: data }, {}, { name: "Obra" });
  assert.equal(payload.report.climate, data.climate);
  assert.equal(payload.report.hours, data.hours);
  assert.equal(payload.report.team, data.team);
  assert.equal(payload.report.workers, data.workers);
  assert.deepEqual(payload.report.production, data.production);
  assert.equal(payload.report.observations, data.observations);
  assert.deepEqual(payload.report.requests, data.requests);
});

test("Apps Script keeps fiscalization validation and selects a separate RDO template", () => {
  assert.match(appsScript, /if \(isRdoPayload_\(payload\)\) \{/);
  assert.match(appsScript, /function validateRdoPayload_\(payload\)/);
  assert.match(appsScript, /function createRdoDocument_\(/);
  assert.match(appsScript, /RELATÓRIO DIÁRIO DE OBRA \/ RDO/);
  assert.match(appsScript, /function buildDefaultDocument_\(/);
  assert.match(appsScript, /Campo obrigatório ausente: /);

  const rdoBranch = appsScript.slice(appsScript.indexOf("function buildRdoDocument_"), appsScript.indexOf("function createDocument_"));
  assert.doesNotMatch(rdoBranch, /buildDefaultDocument_\(/);
  assert.doesNotMatch(rdoBranch, /dataVistoria/);
  assert.doesNotMatch(rdoBranch, /tipoObra/);
  assert.doesNotMatch(rdoBranch, /emailDestino/);
});

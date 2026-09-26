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

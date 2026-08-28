import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildApartmentHandoverPreflightSummary,
  reviewApartmentHandoverInspection
} from "../src/apartment-handover-review.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..", "..");
const finalFixturePath = join(repoRoot, "tests", "fixtures", "apartment-handover-inspection-144-final.json");
const correctedFixturePath = join(repoRoot, "tests", "fixtures", "apartment-handover-inspection-144-corrected.json");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function codes(review) {
  return new Set([...review.blockers, ...review.warnings, ...review.notices].map((issue) => issue.code));
}

function hasCode(review, code) {
  return codes(review).has(code);
}

test("fixture atual detecta divergencias NC-002 e NC-003 sem bloquear por regra legal inventada", () => {
  const review = reviewApartmentHandoverInspection(readJson(finalFixturePath));
  assert.equal(review.canGenerateFinal, true);
  assert.equal(review.blockers.length, 0);
  assert.equal(hasCode(review, "ENVIRONMENT_REFERENCE_MISMATCH"), true);
  assert.equal(hasCode(review, "SYSTEM_REFERENCE_MISMATCH"), true);
  assert.equal(hasCode(review, "POSSIBLE_CLASSIFICATION_MISMATCH"), true);
  assert.equal(hasCode(review, "UNVERIFIED_ITEMS_PRESENT"), true);
  assert.equal(hasCode(review, "UNINSPECTED_ITEMS_PRESENT"), true);
  assert.equal(hasCode(review, "INSTRUMENT_TRACEABILITY_INCOMPLETE"), true);
  assert.equal(hasCode(review, "TECHNICAL_RESPONSIBILITY_NOT_INFORMED"), true);
  assert.doesNotMatch(JSON.stringify(review), /juridicamente inválido|entrega proibida|imóvel inseguro|medição inválida/i);
  assert.match(buildApartmentHandoverPreflightSummary(review), /alertas precisam de revisao/);
});

test("fixture corrigida preserva alertas reais e remove mismatch das NCs", () => {
  const review = reviewApartmentHandoverInspection(readJson(correctedFixturePath));
  assert.equal(review.canGenerateFinal, true);
  assert.equal(hasCode(review, "ENVIRONMENT_REFERENCE_MISMATCH"), false);
  assert.equal(hasCode(review, "SYSTEM_REFERENCE_MISMATCH"), false);
  assert.equal(hasCode(review, "UNVERIFIED_ITEMS_PRESENT"), true);
  assert.equal(hasCode(review, "UNINSPECTED_ITEMS_PRESENT"), true);
  assert.equal(hasCode(review, "TECHNICAL_RESPONSIBILITY_NOT_INFORMED"), true);
});

test("NC incompleta gera blocker/warnings focalizados", () => {
  const payload = clone(readJson(correctedFixturePath));
  const nc = payload.report.inspection.items[0];
  nc.descricaoTecnica = "";
  nc.recomendacaoAcao = "";
  nc.fotos = [];
  nc.severidade = "urgente";

  const review = reviewApartmentHandoverInspection(payload);
  assert.equal(hasCode(review, "NC_DESCRIPTION_MISSING"), true);
  assert.equal(hasCode(review, "NC_RECOMMENDATION_MISSING"), true);
  assert.equal(hasCode(review, "NC_WITHOUT_PHOTO"), true);
  assert.equal(hasCode(review, "INVALID_OR_MISSING_SEVERITY"), true);
  assert.equal(review.canGenerateFinal, false);
});

test("critical + NI bloqueia final e important + NV alerta", () => {
  const payload = clone(readJson(correctedFixturePath));
  payload.report.inspection.items[4].completionCriticality = "important";
  payload.report.inspection.items[5].completionCriticality = "critical";

  const review = reviewApartmentHandoverInspection(payload);
  assert.equal(hasCode(review, "IMPORTANT_ITEM_PENDING"), true);
  assert.equal(hasCode(review, "CRITICAL_ITEM_PENDING"), true);
  assert.equal(review.canGenerateFinal, false);
});

test("instrumento incompleto sobe de notice para warning quando medicao embasa aceite", () => {
  const payload = clone(readJson(correctedFixturePath));
  payload.report.inspection.items[6].medicoes[0].acceptanceDecisionBasis = true;

  const review = reviewApartmentHandoverInspection(payload);
  const traceability = [...review.warnings, ...review.notices].filter((issue) => issue.code === "INSTRUMENT_TRACEABILITY_INCOMPLETE");
  assert.equal(traceability.some((issue) => issue.level === "WARNING"), true);
});

test("responsavel e registro profissional ausentes bloqueiam laudo final", () => {
  const payload = clone(readJson(correctedFixturePath));
  payload.report.responsavelTecnico = "";
  payload.report.creaCau = "";

  const review = reviewApartmentHandoverInspection(payload);
  assert.equal(hasCode(review, "TECHNICAL_RESPONSIBLE_MISSING"), true);
  assert.equal(hasCode(review, "PROFESSIONAL_REGISTRATION_MISSING"), true);
  assert.equal(review.canGenerateFinal, false);
});

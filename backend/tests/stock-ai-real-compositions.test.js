import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const sampleFixture = JSON.parse(readFileSync(join(testDir, "fixtures", "stock-ai-real-compositions-sample.json"), "utf8"));
const realTemplate = JSON.parse(readFileSync(join(testDir, "..", "..", "relatorio-qualidade-obras", "bases-reais", "sinapi-orse-real-sample.template.json"), "utf8"));

function loadStockAiCompositionEngine(windowOverrides = {}) {
  const source = readFileSync(join(testDir, "..", "..", "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
  const sandbox = {
    window: Object.assign({}, windowOverrides),
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.StockAiCompositionEngine;
}

function sinapiAlvenariaFixture(unit = "m2") {
  return [{
    source: "SINAPI",
    sourceRegion: "BA",
    sourceDate: "2025-01",
    code: "TESTE-001",
    description: "Alvenaria de bloco ceramico fixture de teste",
    serviceType: "alvenaria",
    unit,
    lossPercent: 0,
    inputs: [{
      code: "MAT-001",
      name: "Bloco teste",
      type: "material",
      unit: "un",
      coefficient: 1.5
    }],
    metadata: {
      importedFrom: "fixture de teste",
      isRealComposition: true
    }
  }];
}

test("Stock AI Obras mantem composicao demonstrativa sem base externa", () => {
  const engine = loadStockAiCompositionEngine();
  const composition = engine.findComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });
  const prediction = engine.calculatePredictedConsumption({
    service: "Alvenaria de bloco ceramico",
    quantity: 36,
    unit: "m2"
  });

  assert.ok(composition);
  assert.notEqual(composition.source, "SINAPI");
  assert.equal(prediction.predictedItems.length > 0, true);
});

test("Stock AI Obras prioriza composicao SINAPI compativel sobre demonstrativa", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture(), "SINAPI");
  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.ok(composition);
  assert.equal(composition.source, "SINAPI");
  assert.equal(composition.code, "TESTE-001");
});

test("Stock AI Obras ignora composicao real com unidade incompativel", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture("m3"), "SINAPI");
  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });

  assert.ok(composition);
  assert.notEqual(composition.source, "SINAPI");
  assert.equal(composition.productionUnit, "m2");
});

test("Stock AI Obras rejeita coeficiente invalido em base importada", () => {
  const engine = loadStockAiCompositionEngine();
  const invalidRows = sinapiAlvenariaFixture();
  invalidRows[0].inputs[0].coefficient = 0;

  const imported = engine.loadExternalCompositions(invalidRows, "SINAPI");

  assert.equal(imported.length, 0);
});

test("Stock AI Obras importa JSON valido com resumo e fontes", () => {
  const engine = loadStockAiCompositionEngine();

  const result = engine.loadRealCompositionsFromJson(sinapiAlvenariaFixture());

  assert.equal(result.ok, true);
  assert.equal(result.imported.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.valid, 1);
  assert.equal(result.summary.invalid, 0);
  assert.equal(result.summary.sources.SINAPI, 1);
});

test("Stock AI Obras rejeita composicao sem inputs", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = sinapiAlvenariaFixture();
  rows[0].inputs = [];

  const result = engine.loadRealCompositionsFromJson(rows);

  assert.equal(result.ok, false);
  assert.equal(result.imported.length, 0);
  assert.match(result.rejected[0].reasons.join(" "), /sem inputs/i);
});

test("Stock AI Obras rejeita input sem coefficient", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = sinapiAlvenariaFixture();
  delete rows[0].inputs[0].coefficient;

  const result = engine.loadRealCompositionsFromJson(rows);

  assert.equal(result.ok, false);
  assert.match(result.rejected[0].reasons.join(" "), /coefficient/i);
});

test("Stock AI Obras rejeita coefficient zero ou negativo", () => {
  const engine = loadStockAiCompositionEngine();
  const zeroRows = sinapiAlvenariaFixture();
  const negativeRows = sinapiAlvenariaFixture();
  zeroRows[0].inputs[0].coefficient = 0;
  negativeRows[0].inputs[0].coefficient = -1;

  const zero = engine.loadRealCompositionsFromJson(zeroRows);
  const negative = engine.loadRealCompositionsFromJson(negativeRows);

  assert.equal(zero.imported.length, 0);
  assert.equal(negative.imported.length, 0);
  assert.match(zero.rejected[0].reasons.join(" "), /maior que zero/i);
  assert.match(negative.rejected[0].reasons.join(" "), /maior que zero/i);
});

test("Stock AI Obras normaliza unidades m2, m3 e metro", () => {
  const engine = loadStockAiCompositionEngine();

  assert.equal(engine.normalizeCompositionUnit("m²"), "m2");
  assert.equal(engine.normalizeCompositionUnit("m2"), "m2");
  assert.equal(engine.normalizeCompositionUnit("m³"), "m3");
  assert.equal(engine.normalizeCompositionUnit("m3"), "m3");
  assert.equal(engine.normalizeCompositionUnit("metro"), "m");
});

test("Stock AI Obras registra catalogo externo controlado", () => {
  const engine = loadStockAiCompositionEngine();

  const result = engine.setExternalCompositionCatalog(sinapiAlvenariaFixture());

  assert.equal(result.imported.length, 1);
  assert.equal(engine.getExternalCompositionCatalog().length, 1);
  assert.equal(engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" }).source, "SINAPI");
});

test("Stock AI Obras importa CSV parseado por source", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = sinapiAlvenariaFixture().map(({ source, ...row }) => row);

  const result = engine.loadRealCompositionsFromRows(rows, { source: "ORSE" });

  assert.equal(result.ok, true);
  assert.equal(result.imported[0].source, "ORSE");
});

test("Stock AI Obras mostra fonte da composicao real na resposta", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture(), "SINAPI");
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.match(answer, /Fonte: SINAPI - codigo TESTE-001 - referencia 2025-01 - BA/);
});

test("Stock AI Obras alimenta consumo previsto com geometria e composicao real compativel", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture(), "SINAPI");
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.match(answer, /Bloco teste: 54 un/);
  assert.match(answer, /PLANEJAMENTO DE COMPRA/);
});

test("Stock AI Obras volta para demonstrativa quando nao ha base real", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions([], "SINAPI");
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.doesNotMatch(answer, /Bloco teste/);
  assert.match(answer, /Fonte: Base .*demonstrativa/i);
});

test("Stock AI Obras nao inventa consumo quando nao existe composicao cadastrada", () => {
  const engine = loadStockAiCompositionEngine();
  const answer = engine.buildAnswerFromMessage("Vou instalar 8 portas");

  assert.match(answer, /QUANTITATIVO GEOM/);
  assert.match(answer, /Ainda nao existe composicao tecnica cadastrada|sem composicao cadastrada/i);
  assert.doesNotMatch(answer, /CONSUMO PREVISTO/);
});

test("Stock AI Obras limpa catalogo externo controlado", () => {
  const engine = loadStockAiCompositionEngine();

  engine.setExternalCompositionCatalog(sinapiAlvenariaFixture());
  engine.clearExternalCompositionCatalog();

  assert.equal(engine.getExternalCompositionCatalog().length, 0);
  assert.notEqual(engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" }).source, "SINAPI");
});

test("Stock AI Obras identifica mock como mock e nao como base real", () => {
  const engine = loadStockAiCompositionEngine();

  const result = engine.setExternalCompositionCatalog(sampleFixture.compositions);
  const composition = engine.findBestComposition({ service: "Alvenaria de bloco ceramico", unit: "m2" });
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.equal(sampleFixture.isMock, true);
  assert.equal(sampleFixture.mockOnly, true);
  assert.equal(result.imported[0].metadata.isMock, true);
  assert.equal(engine.isMockComposition(composition), true);
  assert.equal(engine.isRealComposition(composition), false);
  assert.match(answer, /Fonte: MOCK DE TESTE - nao usar como base real/);
});

test("Stock AI Obras rejeita template de base real pequena como base pronta", () => {
  const engine = loadStockAiCompositionEngine();

  const importResult = engine.loadRealCompositionsFromJson(realTemplate);
  const readiness = engine.validateSmallRealCompositionFile(realTemplate);

  assert.equal(importResult.imported.length, 0);
  assert.equal(readiness.ok, false);
  assert.equal(readiness.ready.length, 0);
  assert.match(readiness.rejected[0].reasons.join(" "), /placeholder/i);
  assert.match(readiness.rejected[0].reasons.join(" "), /coefficient oficial maior que zero|coefficient numerico maior que zero/i);
});

test("Stock AI Obras exige revisao manual para base real pequena SINAPI ORSE", () => {
  const engine = loadStockAiCompositionEngine();
  const rows = sinapiAlvenariaFixture();
  rows[0].metadata = {
    importedFrom: "teste controlado"
  };

  const readiness = engine.validateSmallRealCompositionFile(rows);

  assert.equal(readiness.ok, false);
  assert.match(readiness.rejected[0].reasons.join(" "), /manualReviewRequired/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));

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

test("Stock AI Obras mostra fonte da composicao real na resposta", () => {
  const engine = loadStockAiCompositionEngine();

  engine.loadExternalCompositions(sinapiAlvenariaFixture(), "SINAPI");
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");

  assert.match(answer, /Fonte: SINAPI - BA - 2025-01/);
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

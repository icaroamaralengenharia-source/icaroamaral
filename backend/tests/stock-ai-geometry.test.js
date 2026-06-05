import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));

function loadStockAiCompositionEngine() {
  const source = readFileSync(join(testDir, "..", "..", "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
  const sandbox = {
    window: {},
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window.StockAiCompositionEngine;
}

const engine = loadStockAiCompositionEngine();

test("Stock AI Obras calcula area de parede por geometria", () => {
  const result = engine.parseGeometryRequest("Tenho uma parede de 12 m por 3 m");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "alvenaria");
  assert.equal(result.geometryType, "area");
  assert.equal(result.quantity, 36);
  assert.equal(result.unit, "m2");
});

test("Stock AI Obras calcula volume de radier com espessura em centimetros", () => {
  const result = engine.parseGeometryRequest("radier 8 x 10 espessura 12cm");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "radier");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 9.6);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula volume de pilares com secao em centimetros", () => {
  const result = engine.parseGeometryRequest("14 pilares 20x30 altura 3m");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "pilar");
  assert.equal(result.quantity, 2.52);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula volume de viga com secao em centimetros", () => {
  const result = engine.parseGeometryRequest("viga 15x40 com 6 metros");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "viga");
  assert.equal(result.quantity, 0.36);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula volume de sapata com dimensoes em centimetros", () => {
  const result = engine.parseGeometryRequest("sapata 80x80x30");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "sapata");
  assert.equal(result.quantity, 0.192);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras pergunta dados complementares quando geometria esta incompleta", () => {
  const result = engine.parseGeometryRequest("vou fazer um radier");
  const answer = engine.buildAnswerFromMessage("vou fazer um radier");

  assert.equal(result.detected, true);
  assert.equal(result.complete, false);
  assert.match(answer, /Qual o comprimento, largura e espessura do radier/);
});

test("Stock AI Obras calcula quantitativos em metro linear", () => {
  const cases = [
    ["tenho 24 metros de rufo", "rufo", 24],
    ["executar 18 m de calha", "calha", 18],
    ["rodapé 45 m", "rodape", 45],
    ["roda-forro 30 metros", "roda_forro", 30]
  ];

  cases.forEach(([message, serviceType, quantity]) => {
    const result = engine.parseGeometryRequest(message);

    assert.equal(result.detected, true, message);
    assert.equal(result.serviceType, serviceType, message);
    assert.equal(result.geometryType, "length", message);
    assert.equal(result.quantity, quantity, message);
    assert.equal(result.unit, "m", message);
  });
});

test("Stock AI Obras calcula quantitativos por unidade", () => {
  const cases = [
    ["instalar 8 portas", "porta", 8],
    ["32 tomadas", "tomada", 32],
    ["4 caixas de inspeção", "caixa_inspecao", 4],
    ["2 caixas d'agua", "caixa_dagua", 2]
  ];

  cases.forEach(([message, serviceType, quantity]) => {
    const result = engine.parseGeometryRequest(message);

    assert.equal(result.detected, true, message);
    assert.equal(result.serviceType, serviceType, message);
    assert.equal(result.geometryType, "unit", message);
    assert.equal(result.quantity, quantity, message);
    assert.equal(result.unit, "un", message);
  });
});

test("Stock AI Obras calcula geometria composta de casa", () => {
  const result = engine.parseGeometryRequest("casa 8 x 10 com pe-direito de 3 metros");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "edificacao_composta");
  assert.equal(result.geometryType, "composite");
  assert.equal(result.dimensions.floorArea, 80);
  assert.equal(result.dimensions.perimeter, 36);
  assert.equal(result.dimensions.wallArea, 108);
  assert.equal(result.dimensions.roofArea, 80);
  assert.equal(result.derivedServices.length, 3);
});

test("Stock AI Obras calcula geometria composta de galpao com pe-direito padrao", () => {
  const result = engine.parseGeometryRequest("galpao 15 x 30");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "edificacao_composta");
  assert.equal(result.geometryType, "composite");
  assert.equal(result.dimensions.floorArea, 450);
  assert.equal(result.dimensions.perimeter, 90);
  assert.equal(result.dimensions.height, 6);
  assert.equal(result.dimensions.wallArea, 540);
  assert.equal(result.dimensions.roofArea, 450);
});

test("Stock AI Obras pergunta dados complementares para metro linear, unidade e composta", () => {
  const doors = engine.buildAnswerFromMessage("vou instalar portas");
  const rufo = engine.buildAnswerFromMessage("vou executar rufo");
  const house = engine.buildAnswerFromMessage("vou fazer uma casa");

  assert.match(doors, /Quantas portas serao instaladas/);
  assert.match(rufo, /Qual o comprimento total do rufo em metros/);
  assert.match(house, /Qual o comprimento e a largura da casa/);
});

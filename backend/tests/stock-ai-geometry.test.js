import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

function loadStockAiCompositionEngine() {
  const source = readFileSync(join("..", "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
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

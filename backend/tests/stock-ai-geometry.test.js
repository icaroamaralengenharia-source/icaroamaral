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

test("Stock AI Obras calcula sapata isolada estrutural completa", () => {
  const result = engine.parseGeometryRequest("Tenho 24 sapatas 80x80x40");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "sapata");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 6.144);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula sapata isolada com dimensoes em metros decimais", () => {
  const result = engine.parseGeometryRequest("Tenho 12 sapatas de 0,80 x 0,80 x 0,40");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "sapata");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 3.072);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula baldrame com comprimento total e secao", () => {
  const result = engine.parseGeometryRequest("Executar 35 m de baldrame 20x40");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "baldrame");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 2.8);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula sapata corrida por comprimento largura e altura", () => {
  const result = engine.parseGeometryRequest("Tenho uma sapata corrida de 18 m, 40 cm de largura e 30 cm de altura");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "sapata_corrida");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 2.16);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula bloco de fundacao por quantidade e dimensoes", () => {
  const result = engine.parseGeometryRequest("Tenho 6 blocos de fundacao 100x80x50");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "bloco_fundacao");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 2.4);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula multiplas vigas com comprimento e secao", () => {
  const result = engine.parseGeometryRequest("Tenho 8 vigas de 3 m, 15x40");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "viga");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 1.44);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula laje macica por area e espessura", () => {
  const result = engine.parseGeometryRequest("Tenho uma laje macica de 180 m2 com 10 cm");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "laje");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 18);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula laje trelicada por area sem capa", () => {
  const result = engine.parseGeometryRequest("Tenho uma laje trelicada de 120 m2");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "laje");
  assert.equal(result.geometryType, "area");
  assert.equal(result.quantity, 120);
  assert.equal(result.unit, "m2");
});

test("Stock AI Obras calcula radier avancado por area e espessura", () => {
  const result = engine.parseGeometryRequest("Tenho um radier de 80 m2 com 12 cm");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "radier");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 9.6);
  assert.equal(result.unit, "m3");
});

test("Stock AI Obras calcula reservatorio como volume geometrico bruto", () => {
  const result = engine.parseGeometryRequest("Tenho um reservatorio de 2 x 3 x 1,5 m");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "reservatorio");
  assert.equal(result.geometryType, "volume");
  assert.equal(result.quantity, 9);
  assert.equal(result.unit, "m3");
  assert.match(result.explanation, /bruto/i);
});

test("Stock AI Obras calcula muro por comprimento e altura", () => {
  const result = engine.parseGeometryRequest("Tenho um muro de 25 m por 2,2 m");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "muro");
  assert.equal(result.geometryType, "area");
  assert.equal(result.quantity, 55);
  assert.equal(result.unit, "m2");
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

test("Stock AI Obras reconhece frases geometricas como solicitacao central", () => {
  [
    "Tenho uma parede de 12 m por 3 m",
    "Tenho 24 metros de rufo",
    "Vou instalar 8 portas",
    "Casa 8 x 10 com pe-direito de 3 metros",
    "Vou executar rufo",
    "Vou instalar portas",
    "Vou fazer uma casa"
  ].forEach((message) => {
    assert.equal(engine.isStockAiRequest(message), true, message);
  });
});

test("Stock AI Obras nao extrai estoque falso de medidas geometricas", () => {
  const wall = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m");
  const rufo = engine.buildAnswerFromMessage("Tenho 24 metros de rufo");

  assert.match(wall, /Nenhum estoque informado na mensagem/);
  assert.doesNotMatch(wall, /por 3 m/);
  assert.match(rufo, /Nenhum estoque informado na mensagem/);
  assert.doesNotMatch(rufo, /etros de rufo/);
});

test("Stock AI Obras extrai estoque real quando ha gatilho explicito", () => {
  const answer = engine.buildAnswerFromMessage("Tenho uma parede de 12 m por 3 m e tenho em estoque 500 blocos e 10 sacos de cimento");

  assert.match(answer, /Bloco ceramico: 500 un/);
  assert.match(answer, /Cimento: 10 saco/);
});

test("Stock AI Obras mantem cobertura composta como pendencia sem bloquear alvenaria e piso", () => {
  const answer = engine.buildAnswerFromMessage("Casa 8 x 10 com pe-direito de 3 metros");

  assert.match(answer, /108 m² de Alvenaria de bloco ceramico/);
  assert.match(answer, /80 m² de Piso ceramico/);
  assert.match(answer, /cobertura: 80 m²|Cobertura.*80 m²/i);
  assert.match(answer, /Ainda nao existe composicao tecnica cadastrada|tipo de telhado|tipo: telha/);
  assert.doesNotMatch(answer, /PERGUNTAS COMPLEMENTARES/);
});

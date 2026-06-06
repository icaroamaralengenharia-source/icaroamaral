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

test("Stock AI Obras interpreta ponto decimal em medidas geometricas", () => {
  const wall = engine.parseGeometryRequest("executar parede 8.5 m por 2.8 m");
  const rufo = engine.parseGeometryRequest("rufo 7.5 m");

  assert.equal(wall.detected, true);
  assert.equal(wall.quantity, 23.8);
  assert.equal(wall.unit, "m2");
  assert.equal(rufo.detected, true);
  assert.equal(rufo.quantity, 7.5);
  assert.equal(rufo.unit, "m");
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

test("Stock AI Obras calcula pilar no singular em frase curta", () => {
  const result = engine.parseGeometryRequest("pilar 20x30 altura 3m");

  assert.equal(result.detected, true);
  assert.equal(result.serviceType, "pilar");
  assert.equal(result.quantity, 0.18);
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

test("Stock AI Obras aceita espessura apos area sem palavra com", () => {
  const slab = engine.parseGeometryRequest("laje 180 m2 10 cm");
  const radier = engine.parseGeometryRequest("radier 80 m2 12 cm");

  assert.equal(slab.detected, true);
  assert.equal(slab.quantity, 18);
  assert.equal(slab.unit, "m3");
  assert.equal(radier.detected, true);
  assert.equal(radier.quantity, 9.6);
  assert.equal(radier.unit, "m3");
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
    ["calhas 12,5 metros", "calha", 12.5],
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

test("Stock AI Obras nao usa quantidade de estoque como quantitativo do servico", () => {
  const request = engine.parseRequest("Cabo 120 metros. Tenho em estoque 50 metros de cabo.");
  const answer = engine.buildAnswerFromMessage("Cabo 120 metros. Tenho em estoque 50 metros de cabo.");

  assert.equal(request.geometry.detected, true);
  assert.equal(request.geometry.serviceType, "cabo");
  assert.equal(request.geometry.quantity, 120);
  assert.match(answer, /120 m de Cabo eletrico/);
  assert.match(answer, /Cabo eletrico: 50 m/);
});

test("Stock AI Obras mantem cobertura composta como pendencia sem bloquear alvenaria e piso", () => {
  const answer = engine.buildAnswerFromMessage("Casa 8 x 10 com pe-direito de 3 metros");

  assert.match(answer, /108 m² de Alvenaria de bloco ceramico/);
  assert.match(answer, /80 m² de Piso ceramico/);
  assert.match(answer, /cobertura: 80 m²|Cobertura.*80 m²/i);
  assert.match(answer, /Ainda nao existe composicao tecnica cadastrada|tipo de telhado|tipo: telha/);
  assert.doesNotMatch(answer, /PERGUNTAS COMPLEMENTARES/);
});

test("Stock AI Obras nao calcula cobertura sem tipo como composicao generica", () => {
  const answer = engine.buildAnswerFromMessage("cobertura 80 m2");

  assert.match(answer, /tipo de cobertura/i);
  assert.doesNotMatch(answer, /CONSUMO PREVISTO/);
  assert.doesNotMatch(answer, /Laje macica ou pre-moldada/);
  assert.doesNotMatch(answer, /Alvenaria de bloco/);
});

function assertStructuralConsumption(message, expectedQuantity, unit, expectedSource = /Fonte: Base .*demonstrativa/i) {
  const request = engine.parseRequest(message);
  const answer = engine.buildAnswerFromMessage(message);

  assert.equal(request.geometry.detected, true, message);
  assert.equal(request.geometry.quantity, expectedQuantity, message);
  assert.equal(request.geometry.unit, unit, message);
  assert.match(answer, /CONSUMO PREVISTO/, message);
  assert.match(answer, /PLANEJAMENTO DE COMPRA/, message);
  assert.match(answer, expectedSource, message);
}

test("Stock AI Obras integra sapata isolada ao consumo previsto demonstrativo", () => {
  assertStructuralConsumption("Tenho 24 sapatas 80x80x40", 6.144, "m3");
});

test("Stock AI Obras integra baldrame ao consumo previsto demonstrativo", () => {
  assertStructuralConsumption("Executar 35 m de baldrame 20x40", 2.8, "m3");
});

test("Stock AI Obras integra pilar ao consumo previsto demonstrativo", () => {
  assertStructuralConsumption("Tenho 14 pilares 20x30 com 3 metros", 2.52, "m3");
});

test("Stock AI Obras integra viga ao consumo previsto demonstrativo", () => {
  assertStructuralConsumption("Tenho 8 vigas de 3 m, 15x40", 1.44, "m3");
});

test("Stock AI Obras integra laje macica ao consumo previsto demonstrativo", () => {
  const answer = engine.buildAnswerFromMessage("Tenho uma laje macica de 180 m2 com 10 cm");

  assertStructuralConsumption("Tenho uma laje macica de 180 m2 com 10 cm", 18, "m3");
  assert.match(answer, /Aco CA-50|Forma\/escoramento|Concreto estrutural/);
});

test("Stock AI Obras integra muro ao consumo previsto ou pendencia controlada", () => {
  const request = engine.parseRequest("Tenho um muro de 25 m por 2,2 m");
  const answer = engine.buildAnswerFromMessage("Tenho um muro de 25 m por 2,2 m");

  assert.equal(request.geometry.quantity, 55);
  assert.equal(request.geometry.unit, "m2");
  assert.match(answer, /CONSUMO PREVISTO|QUANTITATIVOS SEM COMPOSICAO/);
  assert.notEqual(answer, "");
});

test("Stock AI Obras mantem reservatorio como volume bruto sem inventar composicao", () => {
  const request = engine.parseRequest("Tenho um reservatorio de 2 x 3 x 1,5 m");
  const answer = engine.buildAnswerFromMessage("Tenho um reservatorio de 2 x 3 x 1,5 m");

  assert.equal(request.geometry.quantity, 9);
  assert.equal(request.geometry.unit, "m3");
  assert.match(answer, /Volume geometrico bruto/i);
  assert.match(answer, /Ainda nao existe composicao tecnica cadastrada|QUANTITATIVOS SEM COMPOSICAO/);
  assert.doesNotMatch(answer, /CONSUMO PREVISTO/);
});

test("Stock AI Obras compara estoque informado em geometria estrutural", () => {
  const answer = engine.buildAnswerFromMessage("Tenho 24 sapatas 80x80x40. Tenho em estoque 20 sacos de cimento e 2 m3 de areia.");

  assert.match(answer, /CONSUMO PREVISTO/);
  assert.match(answer, /Cimento: 20 saco/);
  assert.match(answer, /Areia: 2 m/);
  assert.match(answer, /MATERIAIS FALTANTES/);
  assert.match(answer, /comprar/i);
});

function assertUsesSpecificDemoComposition(message, expectedCode, expectedName) {
  const answer = engine.buildAnswerFromMessage(message);

  assert.match(answer, /CONSUMO PREVISTO/, message);
  assert.match(answer, new RegExp(expectedCode), message);
  assert.match(answer, new RegExp(expectedName), message);
  assert.match(answer, /Fonte: Base .*demonstrativa/i, message);
  assert.match(answer, /Materiais previstos:/, message);
}

test("Stock AI Obras usa composicao especifica para pilar demonstrativo", () => {
  assertUsesSpecificDemoComposition("Tenho 14 pilares 20x30 com 3 metros", "DEMO-EST-PILAR-001", "Pilar de concreto armado demonstrativo");
});

test("Stock AI Obras usa composicao especifica para sapata isolada demonstrativa", () => {
  assertUsesSpecificDemoComposition("Tenho 24 sapatas 80x80x40", "DEMO-EST-SAPATA-001", "Sapata isolada demonstrativa");
});

test("Stock AI Obras usa composicao especifica para sapata corrida demonstrativa", () => {
  assertUsesSpecificDemoComposition("Tenho uma sapata corrida de 18 m, 40 cm de largura e 30 cm de altura", "DEMO-EST-SAPATA-CORRIDA-001", "Sapata corrida demonstrativa");
});

test("Stock AI Obras usa composicao especifica para bloco de fundacao demonstrativo", () => {
  assertUsesSpecificDemoComposition("Tenho 8 blocos de fundacao 80x80x50", "DEMO-EST-BLOCO-001", "Bloco de fundacao demonstrativo");
});

test("Stock AI Obras usa composicao especifica para baldrame demonstrativo", () => {
  assertUsesSpecificDemoComposition("Executar 35 m de baldrame 20x40", "DEMO-EST-BALDRAME-001", "Baldrame demonstrativo");
});

test("Stock AI Obras usa composicao especifica para viga demonstrativa", () => {
  assertUsesSpecificDemoComposition("Tenho 8 vigas de 3 m, 15x40", "DEMO-EST-VIGA-001", "Viga de concreto armado demonstrativa");
});

test("Stock AI Obras usa composicao especifica para laje macica demonstrativa", () => {
  assertUsesSpecificDemoComposition("Tenho uma laje macica de 180 m2 com 10 cm", "DEMO-EST-LAJE-MACICA-001", "Laje macica demonstrativa");
});

test("Stock AI Obras usa composicao especifica para radier demonstrativo", () => {
  assertUsesSpecificDemoComposition("Radier 8 x 10 com 12 cm", "DEMO-EST-RADIER-001", "Radier demonstrativo");
});

test("Stock AI Obras usa composicao especifica para muro demonstrativo", () => {
  assertUsesSpecificDemoComposition("Tenho um muro de 25 m por 2,2 m", "DEMO-EST-MURO-001", "Muro de bloco demonstrativo");
});

test("Stock AI Obras preserva fallback demonstrativo generico", () => {
  const composition = engine.findBestComposition({ service: "Concreto estrutural", unit: "m3" });

  assert.ok(composition);
  assert.equal(composition.id, "std_concreto_estrutural");
  assert.match(composition.source, /demonstrativa/i);
});

test("Stock AI Obras mantem prioridade do catalogo externo sobre estrutural demonstrativo", () => {
  const localEngine = loadStockAiCompositionEngine();
  localEngine.loadExternalCompositions([{
    source: "SINAPI",
    sourceRegion: "BA",
    sourceDate: "2025-01",
    code: "TESTE-PILAR-001",
    description: "Pilar de concreto armado demonstrativo",
    serviceType: "pilar",
    unit: "m3",
    inputs: [{
      code: "MAT-TESTE-001",
      name: "Material teste externo",
      unit: "un",
      coefficient: 1
    }]
  }], "SINAPI");

  const composition = localEngine.findBestComposition({ service: "Pilar de concreto armado demonstrativo", unit: "m3" });

  assert.ok(composition);
  assert.equal(composition.source, "SINAPI");
  assert.equal(composition.code, "TESTE-PILAR-001");
});

test("Stock AI Obras gera relatorio tecnico com geometria e consumo", () => {
  const report = engine.generateStockAITechnicalReport("Tenho 24 sapatas 80x80x40");

  assert.equal(report.ok, true);
  assert.match(report.plainText, /Relatorio Tecnico Stock AI Obras/);
  assert.match(report.plainText, /6,144 m/);
  assert.match(report.plainText, /DEMO-EST-SAPATA-001|Sapata isolada demonstrativa/);
  assert.match(report.plainText, /Consumo previsto/i);
  assert.match(report.plainText, /Base tecnica demonstrativa|Base t.cnica demonstrativa|demonstrativo/i);
  assert.match(report.html, /<table>/);
});

test("Stock AI Obras gera relatorio tecnico com estoque informado", () => {
  const report = engine.generateStockAITechnicalReport("Tenho 24 sapatas 80x80x40. Tenho em estoque 20 sacos de cimento e 2 m3 de areia.");

  assert.equal(report.ok, true);
  assert.match(report.plainText, /Comparacao com estoque/i);
  assert.match(report.plainText, /Disponivel|Faltante|Planejamento de compra/i);
  assert.match(report.plainText, /comprar|critico|sem item no estoque/i);
});

test("Stock AI Obras gera relatorio tecnico mesmo sem consumo previsto", () => {
  const report = engine.generateStockAITechnicalReport("Tenho um reservatorio de 2 x 3 x 1,5 m");

  assert.equal(report.ok, true);
  assert.match(report.plainText, /Pendente de composicao|sem consumo previsto completo|Sem consumo previsto calculado/i);
  assert.match(report.plainText, /Reservatorio tratado como volume geometrico bruto/i);
});

test("Stock AI Obras relatorio demonstrativo nao menciona SINAPI ORSE indevidamente", () => {
  const report = engine.generateStockAITechnicalReport("Tenho 24 sapatas 80x80x40");

  assert.match(report.plainText, /Valores demonstrativos\/editaveis|demonstrativo/i);
  assert.doesNotMatch(report.plainText, /SINAPI|ORSE/);
});

test("Stock AI Obras relatorio esta preparado para composicao oficial futura TEST ONLY", () => {
  const localEngine = loadStockAiCompositionEngine();
  const report = localEngine.generateStockAITechnicalReport({
    originalQuestion: "TEST ONLY - Tenho 100 m2 de alvenaria",
    services: [{
      service: "Alvenaria de bloco ceramico fixture de teste",
      serviceType: "alvenaria",
      quantity: 100,
      unit: "m2"
    }],
    composition: {
      id: "TEST-ONLY-SINAPI-001",
      code: "TEST-ONLY-SINAPI-001",
      source: "SINAPI",
      sourceRegion: "BA",
      sourceDate: "2025-01",
      name: "TEST ONLY - composicao oficial futura",
      service: "TEST ONLY - composicao oficial futura",
      unit: "m2",
      productionUnit: "m2",
      metadata: {
        isRealComposition: true,
        manualReviewRequired: true
      },
      materials: [{
        name: "TEST ONLY - insumo",
        unit: "un",
        coefficient: 1,
        quantityPerUnit: 1
      }]
    }
  });

  assert.equal(report.ok, true);
  assert.match(report.plainText, /SINAPI/);
  assert.match(report.plainText, /BA/);
  assert.match(report.plainText, /2025-01/);
  assert.match(report.plainText, /TEST-ONLY-SINAPI-001/);
  assert.match(report.plainText, /TEST ONLY - insumo/);
  assert.equal(localEngine.getExternalCompositionCatalog().length, 0);
});

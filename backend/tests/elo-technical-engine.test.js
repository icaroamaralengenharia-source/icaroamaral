import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadEngine(overrides = {}) {
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-technical-engine.js"), "utf8");
  const sandbox = { console, window: Object.assign({}, overrides) };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "elo-technical-engine.js" });
  return sandbox.window.EloTechnicalEngine;
}

function loadEngineWithOfficialComposition() {
  const composition = {
    source: "SINAPI",
    code: "SINAPI-TEST-CHAPISCO",
    name: "Chapisco oficial de teste",
    unit: "m2",
    isRealComposition: true,
    inputs: [
      { code: "MAT-CIM", name: "Cimento", unit: "kg", coefficient: 0.25 },
      { code: "MAT-ARE", name: "Areia", unit: "m3", coefficient: 0.004 }
    ]
  };
  return loadEngine({
    StockAiCompositionEngine: {
      isRealComposition(item) {
        return item && item.isRealComposition === true;
      },
      searchImportedOfficialCompositions() {
        return [composition];
      },
      findComposition() {
        return null;
      }
    }
  });
}

test("EloTechnicalEngine registra 80 m2 como area e 4 m como altura sem confundir unidades", () => {
  const engine = loadEngine();
  const result = engine.analyze("A casa tem 80m2 de area construida, as paredes possuem 4 metros de altura e sao de bloco ceramico baiano");

  assert.equal(result.mode, "project_facts");
  assert.equal(result.facts.areaConstruidaM2, 80);
  assert.equal(result.facts.alturaParedeM, 4);
  assert.doesNotMatch(result.answer, /Area construida: 4/i);
  assert.match(result.answer, /Altura\/pe-direito informado: 4,00 m/i);
});

test("EloTechnicalEngine pergunta somente parametros faltantes para piso ceramico", () => {
  const engine = loadEngine();
  const result = engine.analyze("Vou assentar 50m2 de piso ceramico.");

  assert.equal(result.mode, "technical_consumption");
  assert.equal(result.service.id, "piso_ceramico");
  assert.deepEqual(Array.from(result.missing), ["dimensao_peca", "junta", "tipo_argamassa"]);
  assert.match(result.answer, /Qual a dimensao da peca/);
  assert.match(result.answer, /Qual a largura da junta/);
  assert.match(result.answer, /Qual tipo de argamassa/);
  assert.doesNotMatch(result.answer, /cliente|cidade|obra/i);
});

test("EloTechnicalEngine cobra area, espessura e ambiente para reboco sem quantidade", () => {
  const engine = loadEngine();
  const result = engine.analyze("Vou executar reboco.");

  assert.equal(result.service.id, "reboco");
  assert.deepEqual(Array.from(result.missing), ["area", "espessura", "ambiente"]);
});

test("EloTechnicalEngine calcula consumo somente com composicao oficial", () => {
  const engine = loadEngineWithOfficialComposition();
  const result = engine.analyze("Vou executar 30m2 de chapisco externo.");

  assert.equal(result.service.id, "chapisco");
  assert.deepEqual(Array.from(result.missing), []);
  assert.equal(result.compositionResolution.status, "unique");
  assert.equal(result.consumption.length, 2);
  assert.equal(result.consumption.find((item) => item.name === "Cimento").quantity, 7.5);
  assert.equal(result.consumption.find((item) => item.name === "Areia").quantity, 0.12);
  assert.match(result.answer, /COEFICIENTES E CONSUMO PREVISTO/);
  assert.match(result.answer, /Nenhum coeficiente foi inventado/);
});

test("EloTechnicalEngine cobre os casos obrigatorios com parametros minimos", () => {
  const engine = loadEngine();
  const cases = [
    ["Quantos sacos de argamassa preciso para 50m2 de porcelanato?", "piso_ceramico", ["dimensao_peca", "junta"]],
    ["Vou executar 30m2 de chapisco.", "chapisco", ["ambiente"]],
    ["Vou executar contrapiso.", "contrapiso", ["area", "espessura"]],
    ["Vou concretar uma laje.", "laje", ["area", "espessura", "fck"]],
    ["Vou pintar 200m2.", "pintura", ["tipo_tinta", "demaos", "selador", "massa_corrida"]],
    ["Vou construir um muro.", "muro", ["comprimento", "altura", "tipo_bloco"]],
    ["Vou fazer fundacao.", "fundacao", ["tipo_fundacao"]],
    ["O pedreiro executou 10m2 de alvenaria.", "alvenaria", ["tipo_bloco", "dimensao_bloco"]]
  ];

  cases.forEach(([message, serviceId, missing]) => {
    const result = engine.analyze(message);
    assert.equal(result.service.id, serviceId, message);
    assert.deepEqual(Array.from(result.missing), missing, message);
  });
});

function eloOfficialRowsFixture() {
  return [{
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-PISO-ELO-001",
    compositionName: "Revestimento ceramico para piso com argamassa colante",
    compositionUnit: "m2",
    serviceType: "piso_ceramico",
    inputCode: "SINAPI-ARG-ELO",
    inputName: "Argamassa colante",
    inputUnit: "kg",
    coefficient: "4,2"
  }, {
    source: "SINAPI",
    state: "BA",
    referenceMonth: "2026-01",
    compositionCode: "SINAPI-ALV-ELO-001",
    compositionName: "Alvenaria de vedacao com bloco ceramico",
    compositionUnit: "m2",
    serviceType: "alvenaria",
    inputCode: "SINAPI-BLOCO-ELO",
    inputName: "Bloco ceramico",
    inputUnit: "un",
    coefficient: "13,5"
  }];
}

function loadEngineWithSearchFixture() {
  const stockSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
  const searchSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "composition-search-engine.js"), "utf8");
  const eloSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-technical-engine.js"), "utf8");
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(stockSource, sandbox, { filename: "stock-ai-composition-engine.js" });
  vm.runInContext(searchSource, sandbox, { filename: "composition-search-engine.js" });
  sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: eloOfficialRowsFixture() });
  vm.runInContext(eloSource, sandbox, { filename: "elo-technical-engine.js" });
  return sandbox.window.EloTechnicalEngine;
}

test("EloTechnicalEngine usa CompositionSearchEngine antes de bloquear calculo", () => {
  const engine = loadEngineWithSearchFixture();
  const result = engine.analyze("Vou assentar 50m2 de piso ceramico no chao.");

  assert.equal(result.service.id, "piso_ceramico");
  assert.equal(result.compositionSearch.found, true);
  assert.equal(result.compositionSearch.candidates[0].code, "SINAPI-PISO-ELO-001");
  assert.match(result.answer, /Encontrei composicoes oficiais relacionadas/);
  assert.match(result.answer, /Qual a dimensao da peca/);
  assert.equal(result.compositionResolution.status, "not_checked");
});

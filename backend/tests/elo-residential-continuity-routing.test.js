import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
}

function createElement(tag) {
  return {
    tagName: String(tag || "").toUpperCase(),
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return ""; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    textContent: "",
    value: "",
    options: [],
    selectedIndex: -1
  };
}

function fixtureBudget(facts) {
  return {
    projectFacts: facts,
    budgetEap: {
      stages: [{ name: "Servicos preliminares" }, { name: "Fundacao" }, { name: "Estrutura" }, { name: "Cobertura" }],
      items: [{ description: "Locacao de obra" }, { description: "Alvenaria de vedacao" }, { description: "Cobertura" }]
    },
    quantities: [{ serviceId: "area_construida", description: "Area construida", quantity: facts.builtAreaM2 || 0, unit: "m2", source: "informed" }],
    compositionMatches: [{ serviceId: "alvenaria", code: "SINAPI-ALV-001", source: "SINAPI", description: "Alvenaria de vedacao", unit: "m2" }],
    priceStatus: { canTotal: false, totals: null, missingPrices: [{ serviceId: "alvenaria", reason: "price_missing" }] },
    missing: [],
    risks: ["Orcamento preliminar sem fechamento financeiro."],
    baseStatus: { loaded: false, source: "SINAPI", state: facts.uf || "BA", referenceMonth: "" }
  };
}

function loadAssistant() {
  const localStorage = createStorage();
  const calls = { buildPreliminaryBudget: 0, facts: [] };
  const sandbox = {
    console,
    Date,
    Math,
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    Blob: function Blob() {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    URLSearchParams,
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      ELO_DISABLE_AUTOFOCUS: true,
      ELO_PRODUCT_MODE: true,
      localStorage,
      sessionStorage: createStorage(),
      location: { hostname: "localhost", protocol: "http:", pathname: "/relatorio-qualidade-obras.html", hash: "" },
      addEventListener() {},
      removeEventListener() {},
      crypto: { randomUUID: () => "test-id" },
      open() { return { document: { open() {}, write() {}, close() {} }, focus() {} }; },
      setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
      clearTimeout() {},
      EloBudgetEngine: {
        buildPreliminaryBudget(facts) {
          calls.buildPreliminaryBudget += 1;
          calls.facts.push(facts);
          return fixtureBudget(facts || {});
        }
      }
    },
    document: {
      readyState: "complete",
      body: createElement("body"),
      createElement,
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; }
    },
    navigator: { userAgent: "node-test" }
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { elo: sandbox.window.EloAssistente, calls };
}

test("briefing residencial em quatro mensagens preserva cidade area e gera V2", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const first = elo.buildResponseForTest("Quero orcar uma casa de 100 m2 em Feira de Santana.");
  assert.equal(first.brain, "budget");
  assert.equal(first.sessionIntent, "budget_v2_briefing");
  assert.match(first.fullAnswer, /100 m2/);
  assert.match(first.fullAnswer, /Feira de Santana\/BA/);

  const second = elo.buildResponseForTest("Sera terrea, com tres quartos, uma suite e banheiro social.");
  assert.equal(second.sessionIntent, "budget_v2_briefing");
  assert.equal(second.residentialBudgetState.project.areaM2, 100);
  assert.equal(second.residentialBudgetState.project.city, "Feira de Santana");
  assert.ok(second.residentialBudgetState.rooms.includes("suite"));

  elo.buildResponseForTest("Estrutura convencional, alvenaria ceramica e cobertura em telha ceramica.");
  const final = elo.buildResponseForTest("Padrao medio. Pode gerar.");

  assert.equal(calls.buildPreliminaryBudget, 1);
  assert.equal(final.brain, "budget");
  assert.equal(final.sessionIntent, "budget_v2_residential_created");
  assert.ok(final.pdfAction?.budgetDocumentData);
  assert.equal(elo.getBudgetRecordsForTest().length, 1);
  assert.equal(final.residentialBudgetState.project.areaM2, 100);
  assert.equal(final.residentialBudgetState.project.city, "Feira de Santana");
});

test("sobrado residencial entra no V2 e nao cai no CADISTA", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Faca um orcamento preliminar de um sobrado de 160 m2, dois pavimentos, tres quartos, uma suite, banheiro social, lavabo, sala, cozinha, area de servico, garagem e varanda, em Salvador/BA, estrutura de concreto armado, laje e cobertura embutida. Padrao medio.");

  assert.equal(response.brain, "budget");
  assert.notEqual(response.sessionTheme, "cadista");
  assert.equal(response.sessionIntent, "budget_v2_residential_created");
  assert.equal(calls.buildPreliminaryBudget, 1);
  assert.equal(response.residentialBudgetState.project.type, "sobrado");
  assert.equal(response.residentialBudgetState.project.floors, 2);
  assert.ok(response.residentialBudgetState.rooms.includes("escada"));
  assert.match(response.residentialBudgetState.systems.slab, /laje/);
});

test("alteracao de escopo atualiza orcamento ativo sem acionar calculadora", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  elo.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 80 m2 em Salvador/BA, padrao medio, estrutura convencional, alvenaria ceramica, cobertura em telha ceramica e piso ceramico.");
  const response = elo.buildResponseForTest("Troque o piso ceramico por porcelanato 90 x 90, acrescente uma suite e mude a cobertura para laje impermeabilizada.");

  assert.equal(response.brain, "budget");
  assert.equal(response.sessionIntent, "budget_v2_residential_created");
  assert.notEqual(response.sessionIntent, "geometria_area");
  assert.doesNotMatch(response.shortAnswer + response.fullAnswer, /8100/);
  assert.equal(calls.buildPreliminaryBudget, 2);
  assert.equal(response.residentialBudgetState.systems.flooring, "porcelanato 90x90");
  assert.equal(response.residentialBudgetState.systems.roof, "laje impermeabilizada");
  assert.ok(response.residentialBudgetState.rooms.includes("suite"));
  assert.ok(response.revision);
  assert.ok(response.revision.changes.some((item) => item.field === "flooring"));
  assert.ok(response.revision.changes.some((item) => item.field === "roof"));
});

test("SINAPI BDI continua no orcamento ativo sem inventar fechamento", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  elo.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 80 m2 em Salvador/BA, padrao medio, estrutura convencional, alvenaria ceramica e cobertura em telha ceramica.");
  const response = elo.buildResponseForTest("Use SINAPI da Bahia, encargos e BDI para fechar o valor final.");

  assert.equal(response.brain, "budget");
  assert.equal(response.sessionIntent, "budget_v2_residential_created");
  assert.ok(response.pdfAction?.budgetDocumentData?.financialSummary);
  assert.equal(response.pdfAction.budgetDocumentData.financialSummary.salePrice, null);
  assert.match(response.pdfAction.budgetDocumentData.financialSummary.status, /blocked|unpriced/);
  assert.equal(calls.buildPreliminaryBudget, 2);
});

test("mensagem generica fora de sessao nao e forcada para orcamento", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("oi, tudo bem?");

  assert.notEqual(response.brain, "budget");
  assert.equal(calls.buildPreliminaryBudget, 0);
});
test("matriz Cadista versus orcamentista separa planta, custo e composto", () => {
  const cases = [
    { message: "Quero uma casa de 7x10, a planta", expected: "cadista" },
    { message: "Faca a planta de uma casa 7 por 10", expected: "cadista" },
    { message: "Quero desenhar uma casa de 70 m2", expected: "cadista" },
    { message: "Quero orcar uma casa de 7x10", expected: "budget" },
    { message: "Quanto custa construir uma casa de 7x10", expected: "budget" },
    { message: "Faca a EAP de uma casa 7x10", expected: "budget" },
    { message: "Quero a planta e o orcamento de uma casa 7x10", expected: "composite" },
    { message: "Faca um desenho convencional", expected: "cadista" },
    { message: "Estrutura convencional para uma casa de 80 m2, quero orcar", expected: "budget" }
  ];

  for (const item of cases) {
    const { elo, calls } = loadAssistant();
    elo.clearBudgetRecordsForTest();
    const response = elo.buildResponseForTest(item.message);
    if (item.expected === "cadista") {
      assert.equal(response.brain, "cadista", item.message);
      assert.equal(response.sessionIntent, "cadista_plan_briefing", item.message);
      assert.ok(response.cadistaAction, item.message);
      assert.equal(calls.buildPreliminaryBudget, 0, item.message);
      assert.equal(elo.getBudgetRecordsForTest().length, 0, item.message);
      assert.equal(response.pdfAction, undefined, item.message);
    } else if (item.expected === "budget") {
      assert.equal(response.brain, "budget", item.message);
      assert.notEqual(response.sessionTheme, "cadista", item.message);
      assert.match(response.sessionIntent, /budget_v2_(briefing|residential_created)/, item.message);
      assert.equal(response.cadistaAction, undefined, item.message);
    } else {
      assert.match(response.sessionIntent, /cadista_budget_priority_question/, item.message);
      assert.equal(calls.buildPreliminaryBudget, 0, item.message);
      assert.equal(elo.getBudgetRecordsForTest().length, 0, item.message);
      assert.equal(response.pdfAction, undefined, item.message);
      assert.ok(response.compositeIntent?.wantsCadista, item.message);
      assert.ok(response.compositeIntent?.wantsBudget, item.message);
    }
  }
});

test("planta pura preserva dimensoes e nao cria orcamento", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero uma casa de 7x10, a planta.");

  assert.equal(response.brain, "cadista");
  assert.equal(response.sessionIntent, "cadista_plan_briefing");
  assert.ok(response.cadistaAction);
  assert.equal(response.cadistaAction.dimensions.width, 7);
  assert.equal(response.cadistaAction.dimensions.length, 10);
  assert.equal(response.cadistaAction.dimensions.areaM2, 70);
  assert.equal(calls.buildPreliminaryBudget, 0);
  assert.equal(elo.getBudgetRecordsForTest().length, 0);
  assert.equal(response.pdfAction, undefined);
  assert.equal(response.budgetOrchestratorV2, undefined);
});

test("orcamento puro com 7x10 preserva area sem acao Cadista", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero orcar uma casa de 7x10.");

  assert.equal(response.brain, "budget");
  assert.match(response.sessionIntent, /budget_v2_(briefing|residential_created)/);
  assert.equal(response.cadistaAction, undefined);
  assert.equal(response.residentialBudgetState.project.areaM2, 70);
  assert.match(response.fullAnswer, /70 m2|70,00 m2/);
  assert.equal(calls.buildPreliminaryBudget, 0);
});

test("pedido composto pergunta prioridade sem criar planta nem orcamento", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero a planta e o orcamento de uma casa de 7x10.");

  assert.match(response.sessionIntent, /cadista_budget_priority_question/);
  assert.match(response.fullAnswer, /planta/i);
  assert.match(response.fullAnswer, /or(?:c|ç)amento/i);
  assert.equal(calls.buildPreliminaryBudget, 0);
  assert.equal(elo.getBudgetRecordsForTest().length, 0);
  assert.equal(response.pdfAction, undefined);
  assert.ok(response.compositeIntent?.dimensions);
  assert.equal(response.compositeIntent.dimensions.areaM2, 70);
});

test("sessao de orcamento ativa nao sequestra pedido explicito de planta", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const budget = elo.buildResponseForTest("Quero orcar uma casa de 7x10.");
  assert.equal(budget.brain, "budget");
  const plan = elo.buildResponseForTest("Tenho orcamento ativo e quero ver a planta");

  assert.equal(plan.brain, "cadista");
  assert.equal(plan.sessionIntent, "cadista_plan_briefing");
  assert.ok(plan.cadistaAction);
  assert.equal(calls.buildPreliminaryBudget, 0);
  assert.equal(elo.getBudgetRecordsForTest().length, 0);
});

test("planta ativa pode seguir para estimativa de custo", () => {
  const { elo } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  elo.buildResponseForTest("Quero uma casa de 7x10, a planta");
  const response = elo.buildResponseForTest("Tenho planta ativa e quero estimar o custo");

  assert.equal(response.brain, "budget");
  assert.match(response.sessionIntent, /budget_v2_briefing/);
  assert.equal(response.cadistaAction, undefined);
});

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

function makePipelineStep(name, calls, result) {
  return {
    build(input) {
      calls.pipeline.push(name);
      return typeof result === "function" ? result(input) : result;
    }
  };
}

function loadAssistant(options = {}) {
  const localStorage = createStorage();
  const calls = { buildPreliminaryBudget: 0, facts: [], pipeline: [] };
  const windowOverrides = options.window || {};
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
      setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
      clearTimeout() {},
      EloBudgetEngine: {
        buildPreliminaryBudget(facts) {
          calls.buildPreliminaryBudget += 1;
          calls.facts.push(facts);
          return fixtureBudget(facts || {});
        }
      },
      ...windowOverrides
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

test("pedido residencial incompleto entra em briefing sem motor nem PDF", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero fazer o orçamento de uma casa");

  assert.equal(response.brain, "budget");
  assert.equal(response.sessionIntent, "budget_v2_briefing");
  assert.ok(response.residentialBudgetState);
  assert.equal(calls.buildPreliminaryBudget, 0);
  assert.equal(response.pdfAction, undefined);
  assert.equal(response.budgetOrchestratorV2, undefined);
});

test("briefing residencial minimo completo segue cadeia V2 e gera documento PDF", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero orçamento residencial preliminar para casa térrea de 120 m2 em Salvador/BA, padrão médio, obra completa, 1 pavimento, 2 quartos, 1 banheiro e garagem.");

  assert.equal(response.brain, "budget");
  assert.match(response.sessionIntent, /budget_v2_(scope|residential_created)/);
  assert.equal(calls.buildPreliminaryBudget, 1);
  assert.ok(response.budgetOrchestratorV2?.budgetDocumentData);
  assert.ok(response.pdfAction?.budgetDocumentData);
  assert.equal(response.pdfAction.type, "budget_v2_professional_pdf");
});

test("feature flag do pipeline novo nao atravessa nem substitui a cadeia V2", () => {
  const calls = { pipeline: [] };
  const { elo, calls: engineCalls } = loadAssistant({
    window: {
      ELO_RESIDENTIAL_NEW_PIPELINE: true,
      ResidentialBriefingCompleteEngine: makePipelineStep("briefing", calls, { schema: "briefing", status: "complete" }),
      ResidentialGeometryModelEngine: makePipelineStep("geometry", calls, { schema: "geometry", status: "complete" }),
      ResidentialQuantityTakeoffEngine: makePipelineStep("takeoff", calls, { schema: "takeoff", status: "complete" }),
      ResidentialTakeoffCompositionAdapter: { resolve() { calls.pipeline.push("takeoffComposition"); return { status: "complete" }; } },
      ResidentialCompositionConsumptionAdapter: { calculate() { calls.pipeline.push("compositionConsumption"); return { status: "complete" }; } },
      ResidentialConsumptionPriceAdapter: { price() { calls.pipeline.push("consumptionPrice"); return { status: "complete" }; } },
      ResidentialRealBudgetAdapter: { build() { calls.pipeline.push("realBudgetAdapter"); return { status: "complete" }; } }
    }
  });
  elo.clearBudgetRecordsForTest();

  const response = elo.buildResponseForTest("Quero orçamento residencial preliminar para casa térrea de 80 m2 em Salvador/BA, padrão médio, obra completa, 1 pavimento, 2 quartos, 1 banheiro e garagem.");

  assert.match(response.sessionIntent, /budget_v2_(scope|residential_created)/);
  assert.equal(engineCalls.buildPreliminaryBudget, 1);
  assert.deepEqual(calls.pipeline, []);
  assert.equal(response.pipeline, undefined);
  assert.equal(response.featureFlag, undefined);
  assert.ok(response.budgetOrchestratorV2?.budgetDocumentData);
  assert.ok(response.pdfAction?.budgetDocumentData);
});

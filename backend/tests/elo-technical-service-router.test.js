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

function stockAiOfficialRowsFixture() {
  const source = readFileSync(join(testDir, "stock-ai-real-compositions.test.js"), "utf8");
  const start = source.indexOf("function officialBaseRowsFixture()");
  const end = source.indexOf("function officialGeometryRowsFixture()");
  assert.ok(start >= 0 && end > start);
  const sandbox = { result: null };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end) + "\nresult = officialBaseRowsFixture();", sandbox);
  return sandbox.result;
}

function loadAssistant(options = {}) {
  const localStorage = createStorage();
  const calls = { originalBuild: 0, buildPreliminaryBudget: 0 };
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
          return {
            projectFacts: facts,
            budgetEap: { stages: [{ name: "Fundacao" }], items: [{ description: "Alvenaria de vedacao" }] },
            quantities: [{ serviceId: "area_construida", quantity: facts.builtAreaM2 || 0, unit: "m2", source: "informed" }],
            compositionMatches: [{ serviceId: "alvenaria", code: "SINAPI-ALV-001", source: "SINAPI", description: "Alvenaria", unit: "m2" }],
            priceStatus: { canTotal: false, totals: null, missingPrices: [{ serviceId: "alvenaria" }] },
            missing: [],
            risks: [],
            baseStatus: { loaded: false, source: "SINAPI", state: facts.uf || "BA", referenceMonth: "" }
          };
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

  const files = options.withBridge === false ? ["elo-assistente.js"] : [
    "stock-ai-composition-engine.js",
    ...(options.publicBase ? ["bases-reais/sinapi-ba-202412-index.js"] : []),
    "composition-search-engine.js",
    "elo-consumption-engine.js",
    "elo-technical-service-bridge.js",
    "elo-assistente.js"
  ];
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  if (options.withBridge !== false && !options.publicBase) {
    const imported = sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: stockAiOfficialRowsFixture() });
    assert.equal(imported.ok, true);
  }
  const original = sandbox.window.EloAssistente.buildResponseForTest;
  sandbox.window.EloAssistente.buildResponseForTest = function originalCountingBuild() {
    calls.originalBuild += 1;
    return original.apply(this, arguments);
  };
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-technical-service-router.js"), "utf8"), sandbox, { filename: "elo-technical-service-router.js" });
  if (options.loadRouterTwice) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-technical-service-router.js"), "utf8"), sandbox, { filename: "elo-technical-service-router.js#2" });
  }
  return { elo: sandbox.window.EloAssistente, calls, win: sandbox.window };
}

test("roteador calcula parede 30 x 2,80 com composicao real e sem preco inventado", () => {
  const { elo, calls } = loadAssistant();
  const response = elo.buildResponseForTest("Qual material para uma parede de bloco ceramico com 30 x 2,80?");

  assert.equal(response.sessionIntent, "technical_service_bridge_quantity");
  assert.equal(response.technicalServiceBridge.quantity, 84);
  assert.match(response.fullAnswer, /1050 un/);
  assert.match(response.fullAnswer, /273 kg/);
  assert.match(response.fullAnswer, /não possui preço confiável|nao possui preco confiavel/i);
  assert.equal(calls.originalBuild, 0);
});

test("roteador aceita base publica real sem fixar codigo ou quantidades da fixture", () => {
  const { elo } = loadAssistant({ publicBase: true });
  const response = elo.buildResponseForTest("Quero fazer uma parede de bloco ceramico baiano com 30 metros de comprimento e 2,80 metros de altura. Qual material necessario?");
  const bridge = response.technicalServiceBridge;

  assert.equal(response.sessionIntent, "technical_service_bridge_quantity");
  assert.equal(bridge.quantity, 84);
  assert.equal(bridge.unit, "m2");
  assert.equal(bridge.composition.source, "SINAPI");
  assert.ok(bridge.composition.code);
  assert.ok(bridge.materials.length > 0);

  for (const item of bridge.materials) {
    assert.equal(item.quantity, Math.round(item.coefficient * bridge.quantity * 1000) / 1000);
  }

  if (bridge.pricingStatus === "priced") {
    assert.equal(bridge.totalCost, Math.round(bridge.unitCost * bridge.quantity * 1000) / 1000);
  } else {
    assert.equal(bridge.unitCost, null);
    assert.equal(bridge.totalCost, null);
  }
});

test("roteador calcula viga baldrame por volume e informa aco fora do escopo", () => {
  const { elo, calls } = loadAssistant({ publicBase: true });
  const response = elo.buildResponseForTest("Viga baldrame com 45 m, secao 20 x 30 cm");
  const bridge = response.technicalServiceBridge;

  assert.equal(response.sessionIntent, "technical_service_bridge_quantity");
  assert.equal(bridge.quantity, 2.7);
  assert.equal(bridge.unit, "m3");
  assert.match(response.fullAnswer, /Mem.ria de c.lculo/i);
  assert.match(response.fullAnswer, /A.o estrutural n.o inclu.do neste quantitativo/i);
  assert.equal(calls.originalBuild, 0);
});

test("pedido residencial passa intacto ao ELO original", () => {
  const { elo, calls } = loadAssistant();
  const response = elo.buildResponseForTest("Quero fazer o orçamento de uma casa");

  assert.equal(calls.originalBuild, 1);
  assert.equal(response.sessionIntent, "budget_v2_briefing");
  assert.equal(response.technicalServiceBridge, undefined);
});

test("busca web passa intacta", () => {
  const { elo, calls } = loadAssistant();
  const response = elo.buildResponseForTest("quem e atualmente o presidente do Brasil?");

  assert.equal(calls.originalBuild, 1);
  assert.equal(response.sessionIntent, "meta_web_search");
  assert.equal(response.needsLiveSearch, true);
});

test("conversa comum passa intacta", () => {
  const { elo, calls } = loadAssistant();
  const response = elo.buildResponseForTest("oi, tudo bem?");

  assert.equal(calls.originalBuild, 1);
  assert.notEqual(response.sessionIntent, "technical_service_bridge_quantity");
});

test("ausencia da ponte mantem ELO original", () => {
  const { elo, calls } = loadAssistant({ withBridge: false });
  const response = elo.buildResponseForTest("Qual material para uma parede de bloco ceramico com 30 x 2,80?");

  assert.equal(calls.originalBuild, 1);
  assert.notEqual(response.sessionIntent, "technical_service_bridge_quantity");
});

test("pedido sem dimensoes solicita dado faltante", () => {
  const { elo, calls } = loadAssistant();
  const response = elo.buildResponseForTest("Quanto material preciso para reboco?");

  assert.equal(response.sessionIntent, "technical_service_missing_dimension");
  assert.match(response.fullAnswer, /área em m2|area em m2|comprimento e altura/i);
  assert.equal(calls.originalBuild, 0);
});

test("carregar roteador duas vezes nao duplica interceptacao", () => {
  const { elo, calls } = loadAssistant({ loadRouterTwice: true });
  const response = elo.buildResponseForTest("Quantitativo para alvenaria de bloco ceramico com 84 m2");

  assert.equal(response.sessionIntent, "technical_service_bridge_quantity");
  assert.equal(calls.originalBuild, 0);
  assert.equal(elo.__technicalServiceRouterInstalled, true);
});

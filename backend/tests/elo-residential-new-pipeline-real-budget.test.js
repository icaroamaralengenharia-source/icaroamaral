import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadWindow(files, setup) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  if (setup) setup(sandbox);
  vm.createContext(sandbox);
  for (const file of files) vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  return sandbox.window;
}

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
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

function loadPipeline() {
  return loadWindow([
    "elo-residential-briefing-complete-engine.js",
    "elo-residential-geometry-model-engine.js",
    "elo-residential-quantity-takeoff-engine.js",
    "elo-residential-takeoff-composition-adapter.js",
    "elo-composition-resolver.js",
    "elo-residential-composition-consumption-adapter.js",
    "elo-consumption-engine.js",
    "elo-price-engine.js",
    "elo-residential-consumption-price-adapter.js",
    "elo-real-budget-engine.js",
    "elo-residential-real-budget-adapter.js"
  ]);
}

function loadAssistant() {
  const localStorage = createStorage();
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
      clearTimeout() {}
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
  return sandbox.window.EloAssistente;
}

function residentialInput70m2() {
  return {
    project: { name: "Casa terrea 70m2", city: "Salvador", state: "BA", referenceMonth: "2026-06", priceSource: "SINAPI" },
    site: { builtAreaM2: 70, landAreaM2: 160, floors: 1 },
    building: { constructionType: "casa terrea", constructionStandard: "medio", ceilingHeightM: 2.8, structuralSystem: "concreto armado", foundationSystem: "radier", roofSystem: "telha ceramica", wallSystem: "bloco ceramico" },
    rooms: [
      { id: "sala", name: "Sala", widthM: 5, lengthM: 4, floor: 1 },
      { id: "cozinha", name: "Cozinha", widthM: 4, lengthM: 3, floor: 1 },
      { id: "quarto1", name: "Quarto 1", widthM: 4, lengthM: 3, floor: 1 },
      { id: "quarto2", name: "Quarto 2", widthM: 3.5, lengthM: 3, floor: 1 },
      { id: "banheiro", name: "Banheiro", widthM: 2, lengthM: 2, floor: 1 }
    ],
    openings: {
      doors: [{ id: "porta1", roomId: "sala", widthM: 0.8, heightM: 2.1, quantity: 1 }],
      windows: [{ id: "janela1", roomId: "sala", widthM: 1.2, heightM: 1, quantity: 1 }]
    },
    finishes: { floor: "ceramico", walls: "pintura", ceiling: "pintura" },
    costing: { bdiPercent: 20 }
  };
}

function officialSearchEngine() {
  return {
    searchOfficialCompositions(query, options) {
      const unit = options && options.unit || "m2";
      const slug = String(query || "servico").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 22);
      return {
        candidates: [{
          code: "SINAPI-" + slug,
          description: query,
          unit,
          source: "SINAPI",
          score: 0.95,
          inputs: [{ code: "INS-" + unit, description: "Insumo oficial " + query, unit: unit === "un" ? "un" : "kg", coefficient: unit === "un" ? 1 : 2 }]
        }]
      };
    }
  };
}

function runPipeline() {
  const win = loadPipeline();
  const briefing = win.ResidentialBriefingCompleteEngine.build(residentialInput70m2());
  const geometry = win.ResidentialGeometryModelEngine.build(briefing);
  const takeoff = win.ResidentialQuantityTakeoffEngine.build(geometry, { floorFinishDefined: true, wallFinishDefined: true });
  const compositionResolution = win.ResidentialTakeoffCompositionAdapter.resolve(takeoff, { resolver: win.EloCompositionResolver, compositionSearchEngine: officialSearchEngine(), minimumConfidence: 0.55 });
  const consumption = win.ResidentialCompositionConsumptionAdapter.calculate(compositionResolution, { consumptionEngine: win.EloConsumptionEngine });
  const priceSource = { source: "SINAPI_BA_2026_06" };
  compositionResolution.resolution.resolved.forEach((entry, index) => { priceSource[entry.composition.code] = 40 + index; });
  const priced = win.ResidentialConsumptionPriceAdapter.price(consumption, { priceEngine: win.EloPriceEngine, priceSource });
  const realBudgetPackage = win.ResidentialRealBudgetAdapter.build(priced, { realBudgetEngine: win.EloRealBudgetEngine, technicalAudit: { canGenerate: { executiveBudget: true }, executiveBudget: true, blockers: [], assumptions: [] }, bdiPercent: 20 });
  return { briefing, geometry, takeoff, compositionResolution, consumption, priced, realBudgetPackage };
}

test("pipeline residencial novo produz orcamento completo e dados para PDF V2 atual", () => {
  const result = runPipeline();
  const budget = result.realBudgetPackage.realBudget;

  assert.equal(result.compositionResolution.status, "complete");
  assert.equal(result.consumption.status, "complete");
  assert.equal(result.priced.status, "complete");
  assert.equal(result.realBudgetPackage.status, "complete");
  assert.equal(result.realBudgetPackage.featureFlag, "ELO_RESIDENTIAL_NEW_PIPELINE");

  assert.ok(result.takeoff.totals.quantifiedItemCount > 0);
  assert.ok(result.compositionResolution.resolution.resolved.length > 0);
  assert.ok(result.consumption.consumption.calculated.length > 0);
  assert.ok(result.priced.price.pricedRows.every((row) => row.unitPrice != null && row.totalPrice != null));
  assert.ok(budget.items.length > 0);
  assert.equal(budget.missingPrices.length, 0);
  assert.equal(budget.canClose, true);
  assert.ok(budget.subtotal > 0);
  assert.equal(budget.bdiPercent, 20);
  assert.ok(budget.bdiValue > 0);
  assert.ok(budget.total > budget.subtotal);

  const assistant = loadAssistant();
  const pdfData = assistant.buildBudgetV2ProfessionalPdfDataForTest({
    budgetId: "ELO-RES-70",
    facts: ["Casa terrea 70 m2", "Salvador/BA", "Fonte SINAPI_BA_2026_06"],
    scope: budget.items.map((item) => `${item.item}: ${item.quantity} ${item.unit}`),
    quantities: result.takeoff.items.filter((item) => item.status === "quantified").slice(0, 8).map((item) => `${item.name}: ${item.quantity} ${item.unit}`),
    compositions: result.compositionResolution.resolution.resolved.slice(0, 8).map((item) => `${item.composition.code}: ${item.composition.description}`),
    materials: result.consumption.consumption.calculated.slice(0, 5).map((item) => `${item.composition.code}: ${item.inputs.length} insumo(s)`),
    budget: { source: "SINAPI_BA_2026_06", subtotal: budget.subtotal, bdiPercent: budget.bdiPercent, bdiValue: budget.bdiValue, total: budget.total },
    risks: ["Validado pelo pipeline residencial novo atras da flag ELO_RESIDENTIAL_NEW_PIPELINE."],
    nextSteps: ["Emitir PDF pela cadeia profissional V2 existente."]
  });
  const pdfHtml = assistant.buildProfessionalPdfDocumentForTest(pdfData);

  assert.match(pdfData.conteudo_markdown, /Quantitativos/i);
  assert.match(pdfData.composicoes, /SINAPI-/);
  assert.match(pdfData.custos_encontrados, /subtotal|total|SINAPI/i);
  assert.match(pdfHtml, /elo-professional-pdf/);
  assert.match(pdfHtml, /ELO Orçamentista V2/i);
  assert.match(pdfHtml, /SINAPI-/);
  assert.match(pdfHtml, /Orcamento\/valores|Orçamento\/valores/i);
});

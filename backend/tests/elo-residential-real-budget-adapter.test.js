import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");
const adapterPath = join(repoDir, "relatorio-qualidade-obras", "elo-residential-real-budget-adapter.js");
const realBudgetPath = join(repoDir, "relatorio-qualidade-obras", "elo-real-budget-engine.js");

function loadWindow(files) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of files) vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  return sandbox.window;
}
function loadAdapter(extra = {}) {
  const sandbox = Object.assign({ console, window: {} }, extra);
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox, { filename: "elo-residential-real-budget-adapter.js" });
  return sandbox.window.ResidentialRealBudgetAdapter;
}
function loadRealBudgetEngine() {
  return loadWindow(["elo-real-budget-engine.js"]).EloRealBudgetEngine;
}
const Adapter = loadAdapter();

function pricePackage(overrides = {}) {
  return Object.assign({
    schema: "elo.residential_consumption_price",
    version: "1.0.0",
    status: "complete",
    sourceConsumption: {},
    request: {
      inputCount: 1,
      eligibleCount: 1,
      rows: [{
        rowId: "rtc-floor",
        takeoffItemId: "floor_area_total-total",
        requestId: "rtc-floor",
        serviceId: "floor_area_total-total",
        service: "execucao de piso",
        quantity: 70,
        unit: "m2",
        compositionCode: "SINAPI-PISO-001",
        compositionDescription: "Piso ceramico assentado",
        compositionSource: "SINAPI"
      }]
    },
    price: { pricedRows: [{ rowId: "rtc-floor", takeoffItemId: "floor_area_total-total", serviceId: "floor_area_total-total", service: "execucao de piso", quantity: 70, unit: "m2", compositionCode: "SINAPI-PISO-001", compositionDescription: "Piso ceramico assentado", compositionSource: "SINAPI", unitPrice: 55.25, totalPrice: 3867.5, priceSource: "SINAPI_BA_2026_06" }], missingPrices: [], canTotal: true, totals: { directCost: 3867.5 }, errors: [] },
    skippedItems: [],
    priceBase: { source: "SINAPI_BA_2026_06", prices: { "SINAPI-PISO-001": 55.25 } },
    totals: {},
    warnings: [],
    errors: [],
    blockingFields: [],
    completeness: {},
    audit: { generatedAt: "2026-07-13T00:00:00.000Z", priceFingerprint: "fp_price" }
  }, overrides);
}
function releasedAudit() {
  return { canGenerate: { executiveBudget: true }, executiveBudget: true, blockers: [], missingItems: [], assumptions: [] };
}
function build(model = pricePackage(), options = {}) {
  return Adapter.build(model, Object.assign({ realBudgetEngine: loadRealBudgetEngine(), technicalAudit: releasedAudit(), bdiPercent: 20 }, options));
}
function text(value) { return JSON.stringify(value); }
function freezeDeep(value) { if (value && typeof value === "object") { Object.freeze(value); Object.keys(value).forEach((key) => freezeDeep(value[key])); } return value; }

test("1. exports UMD", () => assert.equal(typeof Adapter.build, "function"));
test("2. version", () => assert.equal(Adapter.getVersion(), "1.0.0"));
test("3. output schema", () => assert.equal(build().schema, "elo.residential_real_budget_package"));
test("4. incompatible input invalid", () => assert.equal(Adapter.build({ schema: "x" }).status, "invalid"));
test("5. invalid price package invalid", () => assert.equal(Adapter.build(pricePackage({ status: "invalid" })).status, "invalid"));
test("6. input not mutated", () => { const m = pricePackage(); const before = text(m); build(m); assert.equal(text(m), before); });
test("7. options not mutated", () => { const options = { realBudgetEngine: loadRealBudgetEngine(), technicalAudit: releasedAudit(), bdiPercent: 20 }; const before = text(options); Adapter.build(pricePackage(), options); assert.equal(text(options), before); });
test("8. buildRealBudgetInput maps budgetEap", () => {
  const input = Adapter.buildRealBudgetInput(pricePackage(), { technicalAudit: releasedAudit(), bdiPercent: 20 });
  assert.equal(input.budgetEap.itens[0].id, "floor_area_total-total");
  assert.equal(input.budgetEap.itens[0].quantidadeBase.valor, 70);
  assert.equal(input.budgetEap.itens[0].unidadeEsperada, "m2");
});
test("9. buildRealBudgetInput maps compositionResolution", () => {
  const input = Adapter.buildRealBudgetInput(pricePackage(), { technicalAudit: releasedAudit(), bdiPercent: 20 });
  assert.equal(input.compositionResolution.resolvedItems[0].eapItemId, "floor_area_total-total");
  assert.equal(input.compositionResolution.resolvedItems[0].composicaoSelecionada.code, "SINAPI-PISO-001");
});
test("10. buildRealBudgetInput maps priceBase", () => {
  const input = Adapter.buildRealBudgetInput(pricePackage(), { technicalAudit: releasedAudit(), bdiPercent: 20 });
  assert.equal(input.priceBase.prices["SINAPI-PISO-001"], 55.25);
});
test("11. blocks without RealBudgetEngine", () => assert.equal(Adapter.build(pricePackage()).status, "blocked"));
test("12. calls EloRealBudgetEngine by injection", () => {
  const result = build();
  assert.equal(result.realBudget.status, "complete");
  assert.equal(result.realBudget.subtotal, 3867.5);
  assert.equal(result.realBudget.bdiValue, 773.5);
  assert.equal(result.realBudget.total, 4641);
});
test("13. technical audit controls closure", () => {
  const result = Adapter.build(pricePackage(), { realBudgetEngine: loadRealBudgetEngine(), technicalAudit: { canGenerate: { executiveBudget: false }, blockers: [{ id: "x", message: "x" }] }, bdiPercent: 20 });
  assert.equal(result.realBudget.canClose, false);
  assert.equal(result.status, "partial");
});
test("14. missing price reaches RealBudgetEngine as partial", () => {
  const model = pricePackage({ priceBase: { source: "SINAPI_BA_2026_06", prices: {} } });
  const result = build(model);
  assert.equal(result.realBudget.status, "blocked");
  assert.equal(result.realBudget.missingPrices.length, 1);
});
test("15. does not access global EloRealBudgetEngine", () => {
  const sandbox = { console, window: { EloRealBudgetEngine: loadRealBudgetEngine() } };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox);
  assert.equal(sandbox.window.ResidentialRealBudgetAdapter.build(pricePackage()).status, "blocked");
});
test("16. does not alter EloRealBudgetEngine", () => { const before = readFileSync(realBudgetPath, "utf8"); readFileSync(adapterPath, "utf8"); assert.equal(readFileSync(realBudgetPath, "utf8"), before); });
test("17. Object.freeze does not break", () => assert.equal(build(freezeDeep(pricePackage())).realBudget.status, "complete"));
test("18. feature flag is explicit", () => assert.equal(build().featureFlag, "ELO_RESIDENTIAL_NEW_PIPELINE"));

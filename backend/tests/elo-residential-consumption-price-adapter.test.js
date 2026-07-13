import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");
const adapterPath = join(repoDir, "relatorio-qualidade-obras", "elo-residential-consumption-price-adapter.js");
const priceEnginePath = join(repoDir, "relatorio-qualidade-obras", "elo-price-engine.js");

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
  vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox, { filename: "elo-residential-consumption-price-adapter.js" });
  return sandbox.window.ResidentialConsumptionPriceAdapter;
}
function loadPriceEngine() {
  return loadWindow(["elo-price-engine.js"]).EloPriceEngine;
}
const Adapter = loadAdapter();

function calculated(overrides = {}) {
  return Object.assign({
    takeoffItemId: "floor_area_total-total",
    requestId: "rtc-floor-area-total-floor-area-total-total",
    service: { code: "floor_area_total-total", description: "execucao de piso", quantity: 70, unit: "m2" },
    composition: { code: "SINAPI-PISO-001", description: "Piso ceramico assentado", unit: "m2", source: "SINAPI" },
    inputs: [{ inputCode: "ARG", description: "Argamassa", type: "material", unit: "kg", coefficient: 4, consumption: 280, status: "calculated" }],
    status: "calculated",
    traceability: { geometryPath: "surfaces.floorAreaM2", roomIds: ["sala"], floorIds: ["floor-1"], openingIds: [] },
    warnings: [],
    errors: []
  }, overrides);
}
function packageModel(items = [calculated()], overrides = {}) {
  return Object.assign({
    schema: "elo.residential_composition_consumption",
    version: "1.0.0",
    status: "complete",
    sourceResolution: {},
    request: {},
    consumption: { calculated: items.filter((x) => x.status === "calculated"), pending: items.filter((x) => x.status === "pending"), rejected: items.filter((x) => x.status === "rejected"), errors: [] },
    skippedItems: [],
    totals: {},
    warnings: [],
    errors: [],
    blockingFields: [],
    completeness: {},
    audit: { generatedAt: "2026-07-13T00:00:00.000Z", inputFingerprint: "fp_in", requestFingerprint: "fp_req", consumptionFingerprint: "fp_cons" }
  }, overrides);
}
function price(model = packageModel(), options = {}) {
  return Adapter.price(model, Object.assign({ priceEngine: loadPriceEngine(), priceSource: { source: "SINAPI_BA_2026_06", "SINAPI-PISO-001": 55.25 } }, options));
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function text(value) { return JSON.stringify(value); }
function freezeDeep(value) { if (value && typeof value === "object") { Object.freeze(value); Object.keys(value).forEach((key) => freezeDeep(value[key])); } return value; }

test("1. exports UMD", () => assert.equal(typeof Adapter.price, "function"));
test("2. version", () => assert.equal(Adapter.getVersion(), "1.0.0"));
test("3. output schema", () => assert.equal(price().schema, "elo.residential_consumption_price"));
test("4. incompatible input invalid", () => assert.equal(Adapter.price({ schema: "x" }).status, "invalid"));
test("5. invalid consumption invalid", () => assert.equal(Adapter.price(packageModel([], { status: "invalid" })).status, "invalid"));
test("6. input not mutated", () => { const m = packageModel(); const before = text(m); price(m); assert.equal(text(m), before); });
test("7. options not mutated", () => { const options = { priceEngine: loadPriceEngine(), priceSource: { "SINAPI-PISO-001": 1 } }; const before = text(options); Adapter.price(packageModel(), options); assert.equal(text(options), before); });
test("8. buildRequest without price engine", () => assert.equal(Adapter.buildRequest(packageModel()).eligibleCount, 1));
test("9. calculate blocks without price engine", () => assert.equal(Adapter.price(packageModel()).status, "blocked"));
test("10. incompatible price engine blocks", () => assert.equal(Adapter.price(packageModel(), { priceEngine: {} }).status, "blocked"));
test("11. calculated consumption sent as budget row", () => {
  const row = Adapter.buildRequest(packageModel()).rows[0];
  assert.equal(row.compositionCode, "SINAPI-PISO-001");
  assert.equal(row.quantity, 70);
  assert.equal(row.unit, "m2");
});
test("12. pending consumption not sent", () => assert.equal(Adapter.buildRequest(packageModel([calculated({ status: "pending" })])).rows.length, 0));
test("13. rejected consumption not sent", () => assert.equal(Adapter.buildRequest(packageModel([calculated({ status: "rejected" })])).rows.length, 0));
test("14. missing composition code invalid", () => assert.equal(Adapter.classifyConsumption(calculated({ composition: { description: "x", unit: "m2", source: "SINAPI" } })).reasonCode, "missing_composition_code"));
test("15. missing service quantity invalid", () => assert.equal(Adapter.classifyConsumption(calculated({ service: { unit: "m2" } })).reasonCode, "invalid_service_quantity"));
test("16. zero service quantity invalid", () => assert.equal(Adapter.classifyConsumption(calculated({ service: { quantity: 0, unit: "m2" } })).reasonCode, "invalid_service_quantity"));
test("17. missing service unit invalid", () => assert.equal(Adapter.classifyConsumption(calculated({ service: { quantity: 70 } })).reasonCode, "missing_service_unit"));
test("18. embedded input price blocked", () => assert.equal(Adapter.classifyConsumption(calculated({ inputs: [{ inputCode: "A", unitPrice: 1 }] })).reasonCode, "embedded_price_forbidden"));
test("19. embedded composition price blocked", () => assert.equal(Adapter.classifyConsumption(calculated({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", unitPrice: 1 } })).reasonCode, "embedded_price_forbidden"));
test("20. no price is invented", () => {
  const result = Adapter.price(packageModel(), { priceEngine: loadPriceEngine(), priceSource: { source: "SINAPI_BA_2026_06" } });
  assert.equal(result.status, "partial");
  assert.equal(result.price.canTotal, false);
  assert.equal(result.price.missingPrices.length, 1);
  assert.equal(result.priceBase.prices["SINAPI-PISO-001"], undefined);
});
test("21. uses EloPriceEngine by injection", () => {
  const result = price();
  assert.equal(result.status, "complete");
  assert.equal(result.price.pricedRows[0].unitPrice, 55.25);
  assert.equal(result.price.pricedRows[0].totalPrice, 3867.5);
  assert.equal(result.price.totals.directCost, 3867.5);
});
test("22. builds priceBase for RealBudgetEngine", () => {
  const result = price();
  assert.equal(result.priceBase.source, "SINAPI_BA_2026_06");
  assert.equal(result.priceBase.prices["SINAPI-PISO-001"], 55.25);
});
test("23. BDI is not applied in adapter", () => assert.equal(/bdi|BDI/.test(text(price())), false));
test("24. does not access global EloPriceEngine", () => {
  const sandbox = { console, window: { EloPriceEngine: loadPriceEngine() } };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox);
  assert.equal(sandbox.window.ResidentialConsumptionPriceAdapter.price(packageModel()).status, "blocked");
});
test("25. does not access network", () => {
  const sandbox = { console, window: { fetch() { throw new Error("network"); } } };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox);
  assert.equal(sandbox.window.ResidentialConsumptionPriceAdapter.price(packageModel()).status, "blocked");
});
test("26. does not alter EloPriceEngine", () => { const before = readFileSync(priceEnginePath, "utf8"); readFileSync(adapterPath, "utf8"); assert.equal(readFileSync(priceEnginePath, "utf8"), before); });
test("27. Object.freeze does not break", () => assert.equal(price(freezeDeep(packageModel())).status, "complete"));
test("28. request order stable", () => {
  const model = packageModel([calculated({ requestId: "b", takeoffItemId: "b", composition: { code: "B", description: "B", unit: "m2", source: "SINAPI" } }), calculated({ requestId: "a", takeoffItemId: "a", composition: { code: "A", description: "A", unit: "m2", source: "SINAPI" } })]);
  assert.equal(JSON.stringify(Adapter.buildRequest(model).rows.map((x) => x.requestId)), JSON.stringify(["b", "a"]));
});

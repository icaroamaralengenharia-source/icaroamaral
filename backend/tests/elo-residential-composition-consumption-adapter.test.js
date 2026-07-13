import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");
const adapterPath = join(repoDir, "relatorio-qualidade-obras", "elo-residential-composition-consumption-adapter.js");
const consumptionPath = join(repoDir, "relatorio-qualidade-obras", "elo-consumption-engine.js");
const previousAdapterPath = join(repoDir, "relatorio-qualidade-obras", "elo-residential-takeoff-composition-adapter.js");

function loadAdapter(extra = {}) {
  const sandbox = Object.assign({ console, window: {} }, extra);
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox, { filename: "elo-residential-composition-consumption-adapter.js" });
  return sandbox.window.ResidentialCompositionConsumptionAdapter;
}
function loadConsumptionEngine() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(consumptionPath, "utf8"), sandbox);
  return sandbox.window.EloConsumptionEngine;
}
const Adapter = loadAdapter();
function input(code = "ARG", unit = "kg", coefficient = 4.2, extra = {}) {
  return Object.assign({ code, description: `Insumo ${code}`, name: `Insumo ${code}`, type: "material", unit, coefficient }, extra);
}
function resolved(overrides = {}) {
  return Object.assign({
    takeoffItemId: "floor_area_total-total",
    requestId: "rtc-floor-area-total-floor-area-total-total",
    quantity: 50,
    unit: "m2",
    service: { code: "floor_area_total-total", description: "piso", quantity: 50, unit: "m2" },
    composition: { code: "SINAPI-PISO", description: "Piso", unit: "m2", source: "SINAPI", referenceMonth: "2026-06", state: "BA", inputs: [input()] },
    status: "resolved",
    trace: { geometryPath: "rooms.sala.floor", roomIds: ["sala"], floorIds: ["floor-1"], openingIds: ["door-1"] },
    warnings: [],
    errors: []
  }, overrides);
}
function packageModel(items = [resolved()], overrides = {}) {
  return Object.assign({
    schema: "elo.residential_takeoff_composition_resolution",
    version: "1.0.0",
    status: "complete",
    sourceTakeoff: {},
    request: { items: [] },
    resolution: { resolved: items.filter((x) => x.status === "resolved"), unresolved: items.filter((x) => x.status === "unresolved"), rejected: items.filter((x) => x.status === "rejected") },
    skippedItems: [],
    mappings: [],
    totals: {},
    warnings: [],
    errors: [],
    blockingFields: [],
    completeness: {},
    audit: { generatedAt: "2026-07-13T00:00:00.000Z", inputFingerprint: "fp_in", requestFingerprint: "fp_req", resolutionFingerprint: "fp_res" }
  }, overrides);
}
function engine(handler) {
  const calls = [];
  return { calls, calculateConsumptionFromCompositions(quantities, matches) { calls.push({ quantities, matches }); return handler(quantities, matches); } };
}
function okEngine() {
  return engine((quantities, matches) => ({ consumptions: quantities.map((q) => {
    const match = matches.find((m) => m.packageId === q.packageId && m.serviceId === q.serviceId);
    return { packageId: q.packageId, serviceId: q.serviceId, compositionCode: match.composition.code, compositionDescription: match.composition.description, compositionUnit: match.composition.unit, quantity: q.quantity, unit: q.unit, inputs: match.composition.inputs.map((i) => ({ code: i.code, name: i.name || i.description, type: i.type, unit: i.unit, coefficient: Number(i.coefficient), total: Number(q.quantity) * Number(i.coefficient) })), warnings: [] };
  }), blocked: [] }));
}
function calc(model = packageModel(), options = {}) { return Adapter.calculate(model, Object.assign({ consumptionEngine: okEngine() }, options)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function freezeDeep(value) { if (value && typeof value === "object") { Object.freeze(value); Object.keys(value).forEach((key) => freezeDeep(value[key])); } return value; }
function text(value) { return JSON.stringify(value); }

test("1. exports UMD", () => assert.equal(typeof Adapter.calculate, "function"));
test("2. version", () => assert.equal(Adapter.getVersion(), "1.0.0"));
test("3. output schema", () => assert.equal(calc().schema, "elo.residential_composition_consumption"));
test("4. incompatible input invalid", () => assert.equal(Adapter.calculate({ schema: "x" }).status, "invalid"));
test("5. resolution invalid", () => assert.equal(Adapter.calculate(packageModel([], { status: "invalid" })).status, "invalid"));
test("6. input not mutated", () => { const m = packageModel(); const before = text(m); calc(m); assert.equal(text(m), before); });
test("7. options not mutated", () => { const options = { consumptionEngine: okEngine(), max: 1 }; const before = Object.keys(options).join(","); Adapter.calculate(packageModel(), options); assert.equal(Object.keys(options).join(","), before); });
test("8. engine not mutated", () => { const e = okEngine(); const before = Object.keys(e).join(","); Adapter.calculate(packageModel(), { consumptionEngine: e }); assert.equal(Object.keys(e).join(","), before); });
test("9. engine result not mutated", () => { const result = { consumptions: [], blocked: [] }; const before = text(result); Adapter.calculate(packageModel(), { consumptionEngine: { calculateConsumptionFromCompositions: () => result } }); assert.equal(text(result), before); });
test("10. independent executions", () => { const a = calc(); const b = calc(); a.consumption.calculated.push({}); assert.notEqual(a.consumption.calculated.length, b.consumption.calculated.length); });
test("11. buildRequest without engine", () => assert.equal(Adapter.buildRequest(packageModel()).eligibleCount, 1));
test("12. calculate blocks without engine", () => assert.equal(Adapter.calculate(packageModel()).status, "blocked"));
test("13. incompatible engine blocks", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: {} }).status, "blocked"));
test("14. valid resolved item sent", () => assert.equal(Adapter.buildRequest(packageModel()).items.length, 1));
test("15. unresolved not sent", () => assert.equal(Adapter.buildRequest(packageModel([resolved({ status: "unresolved" })])).items.length, 0));
test("16. rejected not sent", () => assert.equal(Adapter.buildRequest(packageModel([resolved({ status: "rejected" })])).items.length, 0));
test("17. skipped carried", () => assert.equal(Adapter.buildRequest(packageModel([], { skippedItems: [{ reasonCode: "x" }] })).skippedItems.length, 1));
test("18. blocked not sent", () => assert.equal(Adapter.buildRequest(packageModel([resolved({ status: "blocked" })])).items.length, 0));
test("19. zero quantity not sent", () => assert.equal(Adapter.classifyResolvedItem(resolved({ quantity: 0 })).reasonCode, "zero_service_quantity"));
test("20. negative quantity invalid", () => assert.equal(Adapter.classifyResolvedItem(resolved({ quantity: -1 })).reasonCode, "invalid_service_quantity"));
test("21. NaN invalid", () => assert.equal(Adapter.classifyResolvedItem(resolved({ quantity: NaN })).reasonCode, "invalid_service_quantity"));
test("22. Infinity invalid", () => assert.equal(Adapter.classifyResolvedItem(resolved({ quantity: Infinity })).reasonCode, "invalid_service_quantity"));
test("23. missing composition code", () => assert.equal(Adapter.classifyResolvedItem(resolved({ composition: { description: "x", unit: "m2", source: "SINAPI", inputs: [input()] } })).reasonCode, "missing_composition_code"));
test("24. missing composition description", () => assert.equal(Adapter.classifyResolvedItem(resolved({ composition: { code: "x", unit: "m2", source: "SINAPI", inputs: [input()] } })).reasonCode, "missing_composition_description"));
test("25. missing composition unit", () => assert.equal(Adapter.classifyResolvedItem(resolved({ composition: { code: "x", description: "x", source: "SINAPI", inputs: [input()] } })).reasonCode, "missing_composition_unit"));
test("26. unit mismatch", () => assert.equal(Adapter.classifyResolvedItem(resolved({ composition: { code: "x", description: "x", unit: "un", source: "SINAPI", inputs: [input()] } })).reasonCode, "unit_mismatch"));
test("27. missing inputs", () => assert.equal(Adapter.classifyResolvedItem(resolved({ composition: { code: "x", description: "x", unit: "m2", source: "SINAPI", inputs: [] } })).reasonCode, "missing_inputs"));
test("28. empty inputs", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [] }).valid, false));
test("29. input without identity invalid", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [{ unit: "kg", coefficient: 1 }] }).errors[0].code, "missing_input_identity"));
test("30. input without unit invalid", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [{ code: "A", coefficient: 1 }] }).errors[0].code, "missing_input_unit"));
test("31. input without coefficient invalid", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [{ code: "A", unit: "kg" }] }).errors[0].code, "missing_coefficient"));
test("32. numeric string coefficient safe", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [input("A", "kg", "1.5")] }).valid, true));
test("33. zero coefficient accepted", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [input("A", "kg", 0)] }).valid, true));
test("34. negative coefficient invalid", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [input("A", "kg", -1)] }).errors[0].code, "negative_coefficient"));
test("35. NaN coefficient invalid", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [input("A", "kg", NaN)] }).errors[0].code, "missing_coefficient"));
test("36. Infinity coefficient invalid", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [input("A", "kg", Infinity)] }).errors[0].code, "invalid_coefficient"));
test("37. takeoffItemId preserved", () => assert.equal(calc().consumption.calculated[0].takeoffItemId, "floor_area_total-total"));
test("38. requestId preserved", () => assert.equal(calc().consumption.calculated[0].requestId, "rtc-floor-area-total-floor-area-total-total"));
test("39. composition code preserved", () => assert.equal(calc().consumption.calculated[0].composition.code, "SINAPI-PISO"));
test("40. composition description preserved", () => assert.equal(calc().consumption.calculated[0].composition.description, "Piso"));
test("41. composition unit preserved", () => assert.equal(calc().consumption.calculated[0].composition.unit, "m2"));
test("42. composition source preserved", () => assert.equal(calc().consumption.calculated[0].composition.source, "SINAPI"));
test("43. service quantity preserved", () => assert.equal(calc().consumption.calculated[0].service.quantity, 50));
test("44. service unit preserved", () => assert.equal(calc().consumption.calculated[0].service.unit, "m2"));
test("45. geometryPath preserved", () => assert.equal(calc().consumption.calculated[0].traceability.geometryPath, "rooms.sala.floor"));
test("46. roomIds preserved", () => assert.equal(JSON.stringify(calc().consumption.calculated[0].traceability.roomIds), JSON.stringify(["sala"])));
test("47. floorIds preserved", () => assert.equal(JSON.stringify(calc().consumption.calculated[0].traceability.floorIds), JSON.stringify(["floor-1"])));
test("48. openingIds preserved", () => assert.equal(JSON.stringify(calc().consumption.calculated[0].traceability.openingIds), JSON.stringify(["door-1"])));
test("49. input code preserved", () => assert.equal(calc().consumption.calculated[0].inputs[0].inputCode, "ARG"));
test("50. input description preserved", () => assert.equal(calc().consumption.calculated[0].inputs[0].description, "Insumo ARG"));
test("51. input type preserved", () => assert.equal(calc().consumption.calculated[0].inputs[0].type, "material"));
test("52. input unit preserved", () => assert.equal(calc().consumption.calculated[0].inputs[0].unit, "kg"));
test("53. coefficient preserved", () => assert.equal(calc().consumption.calculated[0].inputs[0].coefficient, 4.2));
test("54. formula traceable", () => assert.equal(calc().consumption.calculated[0].inputs[0].calculation.formula, "serviceQuantity * coefficient"));
test("55. consumption equals quantity times coefficient", () => assert.equal(calc().consumption.calculated[0].inputs[0].consumption, 210));
test("56. zero result valid with compatible engine", () => { const r = calc(packageModel([resolved({ composition: { code: "Z", description: "Zero", unit: "m2", source: "SINAPI", inputs: [input("Z", "kg", 0)] } })])); assert.equal(r.consumption.calculated[0].inputs[0].consumption, 0); });
test("57. fractional consumption preserved", () => { const r = calc(packageModel([resolved({ quantity: 1.5, composition: { code: "F", description: "Frac", unit: "m2", source: "SINAPI", inputs: [input("F", "un", 0.333333)] } })])); assert.equal(r.consumption.calculated[0].inputs[0].consumption, 0.5); });
test("58. no intermediate integer rounding", () => assert.equal(calc(packageModel([resolved({ quantity: 2.5, composition: { code: "F", description: "Frac", unit: "m2", source: "SINAPI", inputs: [input("F", "un", 0.25)] } })])).consumption.calculated[0].inputs[0].consumption, 0.625));
test("59. rawConsumption preserved", () => assert.equal(calc().consumption.calculated[0].inputs[0].rawConsumption, 210));
test("60. roundingPrecision informed", () => assert.equal(calc().consumption.calculated[0].inputs[0].calculation.roundingPrecision, 6));
["kg", "g", "t", "m", "m2", "m3", "l", "ml", "un", "h"].forEach((unit, index) => test(`${61 + index}. unit ${unit} preserved`, () => assert.equal(calc(packageModel([resolved({ composition: { code: unit, description: unit, unit: "m2", source: "SINAPI", inputs: [input(unit, unit, 1)] } })])).consumption.calculated[0].inputs[0].unit, unit)));
test("71. unknown unit warns", () => assert.ok(calc(packageModel([resolved({ composition: { code: "X", description: "X", unit: "m2", source: "SINAPI", inputs: [input("X", "cx", 1)] } })])).warnings.some((w) => w.code === "unknown_input_unit") || calc(packageModel([resolved({ composition: { code: "X", description: "X", unit: "m2", source: "SINAPI", inputs: [input("X", "cx", 1)] } })])).consumption.calculated[0].inputs[0].warnings.length));
test("72. empty input unit invalid", () => assert.equal(Adapter.validateCompositionInputs({ inputs: [input("A", "", 1)] }).errors[0].code, "missing_input_unit"));
test("73. same input same unit can sum by unit", () => assert.equal(calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input("A", "kg", 1), input("A", "kg", 2)] } })])).quantitiesByInputUnit.kg, 150));
test("74. same input different units not converted", () => { const r = calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input("A", "kg", 1), input("A", "g", 2)] } })])); assert.equal(r.quantitiesByInputUnit.kg, 50); assert.equal(r.quantitiesByInputUnit.g, 100); });
test("75. similar descriptions without code keep separate lines", () => assert.equal(calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input(null, "kg", 1, { description: "Areia fina" }), input(null, "kg", 1, { description: "Areia media" })] } })])).totals.consumptionLineCount, 2));
test("76. different code not silently consolidated", () => assert.equal(calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input("A", "kg", 1), input("B", "kg", 1)] } })])).totals.consumptionLineCount, 2));
test("77. different type preserved", () => assert.equal(calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input("A", "h", 1, { type: "labor" })] } })])).consumption.calculated[0].inputs[0].type, "labor"));
test("78. different source remains composition scoped", () => assert.equal(calc().consumption.calculated[0].composition.source, "SINAPI"));
test("79. batch engine supported", () => { const e = okEngine(); Adapter.calculate(packageModel(), { consumptionEngine: e }); assert.equal(e.calls[0].quantities.length, 1); });
test("80. calculateConsumption function supported", () => assert.equal(Adapter.calculate(packageModel(), { calculateConsumption: okEngine().calculateConsumptionFromCompositions }).status, "complete"));
test("81. engine error captured", () => assert.doesNotThrow(() => Adapter.calculate(packageModel(), { consumptionEngine: { calculateConsumptionFromCompositions() { throw new Error("boom"); } } })));
test("82. engine returns null", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: { calculateConsumptionFromCompositions: () => null } }).status, "invalid"));
test("83. engine returns array empty invalid", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: { calculateConsumptionFromCompositions: () => [] } }).status, "invalid"));
test("84. engine returns invalid format", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: { calculateConsumptionFromCompositions: () => "x" } }).status, "invalid"));
test("85. engine quantity divergent", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: engine(() => ({ consumptions: [{ packageId: resolved().requestId, serviceId: resolved().takeoffItemId, compositionCode: "C", compositionDescription: "C", compositionUnit: "m2", quantity: 99, unit: "m2", inputs: [] }], blocked: [] })) }).consumption.rejected.length, 1));
test("86. engine coefficient divergent preserved", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: engine((q, m) => ({ consumptions: [{ packageId: q[0].packageId, serviceId: q[0].serviceId, compositionCode: "C", compositionDescription: "C", compositionUnit: "m2", quantity: q[0].quantity, unit: q[0].unit, inputs: [{ code: "A", name: "A", unit: "kg", coefficient: 9, total: 9 }] }], blocked: [] })) }).consumption.calculated[0].inputs[0].coefficient, 9));
test("87. engine unit divergent rejected", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: engine((q) => ({ consumptions: [{ packageId: q[0].packageId, serviceId: q[0].serviceId, compositionCode: "C", compositionDescription: "C", compositionUnit: "m2", quantity: q[0].quantity, unit: "un", inputs: [] }], blocked: [] })) }).consumption.rejected.length, 1));
test("88. valid result accepted", () => assert.equal(calc().status, "complete"));
test("89. partial result normalized", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: engine(() => ({ consumptions: [], blocked: [{ packageId: resolved().requestId, serviceId: resolved().takeoffItemId, reason: "x" }] })) }).status, "partial"));
test("90. partial composition preserved", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: engine((q) => ({ consumptions: [{ packageId: q[0].packageId, serviceId: q[0].serviceId, compositionCode: "C", compositionDescription: "C", compositionUnit: "m2", quantity: q[0].quantity, unit: q[0].unit, inputs: [] }], blocked: [] })) }).consumption.calculated[0].status, "partial"));
test("91. rejected composition preserved", () => assert.equal(Adapter.buildRequest(packageModel([resolved({ status: "rejected" })])).skippedItems[0].reasonCode, "resolution_rejected"));
test("92. status blocked", () => assert.equal(Adapter.calculate(packageModel()).status, "blocked"));
test("93. status invalid", () => assert.equal(Adapter.calculate({ schema: "bad" }).status, "invalid"));
test("94. status partial", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: engine(() => ({ consumptions: [], blocked: [{ packageId: resolved().requestId, serviceId: resolved().takeoffItemId, reason: "x" }] })) }).status, "partial"));
test("95. status complete", () => assert.equal(calc().status, "complete"));
test("96. totals.inputResolvedCount", () => assert.equal(calc().totals.inputResolvedCount, 1));
test("97. totals.eligibleCompositionCount", () => assert.equal(calc().totals.eligibleCompositionCount, 1));
test("98. totals.calculatedCompositionCount", () => assert.equal(calc().totals.calculatedCompositionCount, 1));
test("99. totals.pendingCompositionCount", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: engine(() => ({ consumptions: [], blocked: [{ packageId: resolved().requestId, serviceId: resolved().takeoffItemId, reason: "x" }] })) }).totals.pendingCompositionCount, 1));
test("100. totals.rejectedCompositionCount", () => assert.equal(Adapter.calculate(packageModel(), { consumptionEngine: engine((q) => ({ consumptions: [{ packageId: q[0].packageId, serviceId: q[0].serviceId, compositionCode: "C", compositionDescription: "C", compositionUnit: "m2", quantity: 99, unit: "m2", inputs: [] }], blocked: [] })) }).totals.rejectedCompositionCount, 1));
test("101. totals.skippedCompositionCount", () => assert.equal(Adapter.calculate(packageModel([resolved({ status: "unresolved" })]), { consumptionEngine: okEngine() }).totals.skippedCompositionCount, 1));
test("102. totals.blockedCompositionCount", () => assert.equal(Adapter.calculate(packageModel([resolved({ composition: { code: "x", description: "x", unit: "m2", source: "SINAPI", inputs: [] } })]), { consumptionEngine: okEngine() }).totals.blockedCompositionCount, 1));
test("103. totals.consumptionLineCount", () => assert.equal(calc().totals.consumptionLineCount, 1));
test("104. quantitiesByInputUnit", () => assert.equal(calc().quantitiesByInputUnit.kg, 210));
test("105. completeness score", () => assert.equal(calc().completeness.score, 100));
test("106. errors prevent complete", () => assert.notEqual(Adapter.calculate(packageModel(), { consumptionEngine: { calculateConsumptionFromCompositions: () => null } }).status, "complete"));
test("107. blockingFields prevent complete", () => assert.notEqual(Adapter.calculate(packageModel()).status, "complete"));
test("108. pending prevents complete", () => assert.notEqual(Adapter.calculate(packageModel(), { consumptionEngine: engine(() => ({ consumptions: [], blocked: [{ packageId: resolved().requestId, serviceId: resolved().takeoffItemId, reason: "x" }] })) }).status, "complete"));
test("109. rejected prevents complete", () => assert.notEqual(Adapter.calculate(packageModel(), { consumptionEngine: engine((q) => ({ consumptions: [{ packageId: q[0].packageId, serviceId: q[0].serviceId, quantity: 99, unit: "m2", inputs: [] }], blocked: [] })) }).status, "complete"));
test("110. fingerprint equal for equal input", () => assert.equal(calc().audit.inputFingerprint, calc().audit.inputFingerprint));
test("111. fingerprint changes with quantity", () => assert.notEqual(calc(packageModel([resolved({ quantity: 50 })])).audit.inputFingerprint, calc(packageModel([resolved({ quantity: 51 })])).audit.inputFingerprint));
test("112. fingerprint changes with coefficient", () => assert.notEqual(calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input("A", "kg", 1)] } })])).audit.inputFingerprint, calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input("A", "kg", 2)] } })])).audit.inputFingerprint));
test("113. fingerprint changes with input", () => assert.notEqual(calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input("A", "kg", 1)] } })])).audit.inputFingerprint, calc(packageModel([resolved({ composition: { code: "A", description: "A", unit: "m2", source: "SINAPI", inputs: [input("B", "kg", 1)] } })])).audit.inputFingerprint));
test("114. requestFingerprint deterministic", () => assert.equal(calc().audit.requestFingerprint, calc().audit.requestFingerprint));
test("115. consumptionFingerprint deterministic", () => assert.equal(calc().audit.consumptionFingerprint, calc().audit.consumptionFingerprint));
test("116. different result changes fingerprint", () => assert.notEqual(Adapter.calculate(packageModel(), { consumptionEngine: engine((q) => ({ consumptions: [{ packageId: q[0].packageId, serviceId: q[0].serviceId, compositionCode: "A", compositionDescription: "A", compositionUnit: "m2", quantity: q[0].quantity, unit: q[0].unit, inputs: [{ code: "A", name: "A", unit: "kg", coefficient: 1, total: 1 }] }], blocked: [] })) }).audit.consumptionFingerprint, Adapter.calculate(packageModel(), { consumptionEngine: engine((q) => ({ consumptions: [{ packageId: q[0].packageId, serviceId: q[0].serviceId, compositionCode: "B", compositionDescription: "B", compositionUnit: "m2", quantity: q[0].quantity, unit: q[0].unit, inputs: [{ code: "B", name: "B", unit: "kg", coefficient: 2, total: 2 }] }], blocked: [] })) }).audit.consumptionFingerprint));
test("117. generatedAt does not alter fingerprint", () => assert.equal(Adapter.calculate(packageModel([], { audit: { generatedAt: "a" } })).audit.inputFingerprint, Adapter.calculate(packageModel([], { audit: { generatedAt: "b" } })).audit.inputFingerprint));
test("118. property order does not alter fingerprint", () => { const a = packageModel(); const b = { audit: a.audit, completeness: a.completeness, blockingFields: a.blockingFields, errors: a.errors, warnings: a.warnings, totals: a.totals, mappings: a.mappings, skippedItems: a.skippedItems, resolution: a.resolution, request: a.request, sourceTakeoff: a.sourceTakeoff, status: a.status, version: a.version, schema: a.schema }; assert.equal(Adapter.calculate(a).audit.inputFingerprint, Adapter.calculate(b).audit.inputFingerprint); });
["unitPrice", "inputPrice", "compositionPrice", "priceSource", "cost", "partialCost", "subtotal", "BDI", "socialCharges", "freight", "lossPercent", "budgetEap", "budgetDocumentData", "pdfAction"].forEach((field, index) => test(`${119 + index}. no ${field}`, () => assert.equal(new RegExp(field, "i").test(text(calc())), false)));
test("133. no PDF", () => assert.equal(/pdf/i.test(text(calc())), false));
test("134. does not access network", () => { const sandbox = { console, window: { fetch() { throw new Error("network"); } } }; sandbox.globalThis = sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox); assert.equal(sandbox.window.ResidentialCompositionConsumptionAdapter.calculate(packageModel()).status, "blocked"); });
test("135. does not access database", () => assert.equal(/indexedDB|postgres|sqlite|database/i.test(text(calc())), false));
test("136. does not access localStorage", () => { const sandbox = { console, window: { localStorage: { getItem() { throw new Error("storage"); } } } }; sandbox.globalThis = sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox); assert.equal(sandbox.window.ResidentialCompositionConsumptionAdapter.calculate(packageModel()).status, "blocked"); });
test("137. does not alter EloConsumptionEngine", () => { const before = readFileSync(consumptionPath, "utf8"); readFileSync(adapterPath, "utf8"); assert.equal(readFileSync(consumptionPath, "utf8"), before); });
test("138. does not alter previous adapter", () => { const before = readFileSync(previousAdapterPath, "utf8"); readFileSync(adapterPath, "utf8"); assert.equal(readFileSync(previousAdapterPath, "utf8"), before); });
test("139. Object.freeze does not break", () => assert.equal(calc(freezeDeep(packageModel())).status, "complete"));
test("140. request order stable and no global engine", () => { const model = packageModel([resolved({ requestId: "b", takeoffItemId: "b" }), resolved({ requestId: "a", takeoffItemId: "a" })]); assert.equal(JSON.stringify(Adapter.buildRequest(model).items.map((x) => x.requestId)), JSON.stringify(["b", "a"])); const sandbox = { console, window: { EloConsumptionEngine: okEngine() } }; sandbox.globalThis = sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox); assert.equal(sandbox.window.ResidentialCompositionConsumptionAdapter.calculate(packageModel()).status, "blocked"); });

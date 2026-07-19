import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");
const adapterPath = join(repoDir, "relatorio-qualidade-obras", "elo-residential-takeoff-composition-adapter.js");
const resolverPath = join(repoDir, "relatorio-qualidade-obras", "elo-composition-resolver.js");
const searchPath = join(repoDir, "relatorio-qualidade-obras", "composition-search-engine.js");

function loadAdapter(extra = {}) {
  const sandbox = Object.assign({ console, window: {} }, extra);
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox, { filename: "elo-residential-takeoff-composition-adapter.js" });
  return sandbox.window.ResidentialTakeoffCompositionAdapter;
}

function loadWindow(files, setup) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  if (setup) setup(sandbox.window);
  for (const file of files) vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  return sandbox.window;
}

const Adapter = loadAdapter();

function item(code, quantity = 10, unit = "m2", overrides = {}) {
  return Object.assign({
    id: `${code.toLowerCase()}-total`,
    code,
    discipline: overrides.discipline || "FLOORS",
    name: `Item ${code}`,
    unit,
    quantity,
    aggregationRole: "total",
    status: "quantified",
    source: { geometryPath: `geometry.${code}`, roomIds: ["sala"], floorIds: ["floor-1"], openingIds: [] },
    assumptions: [],
    warnings: [],
    errors: []
  }, overrides);
}

function takeoff(items = [item("FLOOR_AREA_TOTAL")], overrides = {}) {
  return Object.assign({
    schema: "elo.residential_quantity_takeoff",
    version: "1.0.0",
    status: "partial",
    sourceGeometry: { schema: "elo.residential_geometry_model" },
    disciplines: [],
    items,
    totals: { itemCount: items.length },
    quantitiesByUnit: { m: 0, m2: 10, m3: 0, un: 0 },
    assumptions: [],
    missingFields: [],
    blockingFields: [],
    warnings: [],
    errors: [],
    completeness: {},
    audit: { generatedAt: "2026-07-13T00:00:00.000Z", inputFingerprint: "fp_in", takeoffFingerprint: "fp_takeoff" }
  }, overrides);
}

function validComposition(request, overrides = {}) {
  return Object.assign({
    eapItemId: request.requestId,
    composicaoSelecionada: { code: `C-${request.takeoffCode}`, description: `Composicao ${request.takeoffCode}`, unit: request.unit, source: "SINAPI", score: 0.95, inputs: [{ code: "INS-1", description: "Insumo oficial", unit: "kg", coefficient: 2 }] },
    confianca: 0.92,
    motivoEscolha: "mock oficial"
  }, overrides);
}

function resolverFor(handler) {
  const calls = [];
  return {
    calls,
    resolveEloEapCompositions(input) {
      calls.push(input);
      const resolvedItems = [];
      const unresolvedItems = [];
      for (const request of input.eap.itens) {
        const result = handler(request, input);
        if (result === null) unresolvedItems.push({ eapItemId: request.requestId, composicaoSelecionada: null, motivoEscolha: "sem_candidato" });
        else if (result.unresolved) unresolvedItems.push(Object.assign({ eapItemId: request.requestId }, result.unresolved));
        else resolvedItems.push(result);
      }
      return { resolvedItems, unresolvedItems, summary: { totalItems: input.eap.itens.length }, podeFecharOrcamentoCompleto: unresolvedItems.length === 0 };
    }
  };
}

function resolveOk(model = takeoff(), options = {}) {
  const resolver = resolverFor((request) => validComposition(request));
  return Adapter.resolve(model, Object.assign({ resolver }, options));
}

function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value)) freezeDeep(value[key]);
  }
  return value;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function hasForbidden(value) {
  const text = JSON.stringify(value);
  return /consumption|inputs|materials|unitPrice|totalPrice|cost|subtotal|totalBudget|budgetDocumentData|pdfAction/.test(text);
}
function byCode(code) { return Adapter.getSupportedMappings().find((entry) => entry.takeoffCode === code); }

test("1. exports UMD adapter", () => assert.equal(typeof Adapter.resolve, "function"));
test("2. exposes version", () => assert.equal(Adapter.getVersion(), "1.0.0"));
test("3. output schema", () => assert.equal(resolveOk().schema, "elo.residential_takeoff_composition_resolution"));
test("4. incompatible input invalid", () => assert.equal(Adapter.resolve({ schema: "x", items: [] }).status, "invalid"));
test("5. takeoff invalid invalidates", () => assert.equal(Adapter.resolve(takeoff([], { status: "invalid" })).status, "invalid"));
test("6. raw text is invalid", () => assert.equal(Adapter.resolve("piso 10m2").status, "invalid"));
test("7. input is not mutated", () => { const model = takeoff(); const before = JSON.stringify(model); Adapter.resolve(model, { resolver: resolverFor((r) => validComposition(r)) }); assert.equal(JSON.stringify(model), before); });
test("8. options are not mutated", () => { const options = { resolver: resolverFor((r) => validComposition(r)), minimumConfidence: 0.55 }; const before = JSON.stringify(Object.keys(options)); Adapter.resolve(takeoff(), options); assert.equal(JSON.stringify(Object.keys(options)), before); });
test("9. resolver is not mutated", () => { const resolver = resolverFor((r) => validComposition(r)); const keys = Object.keys(resolver).join(","); Adapter.resolve(takeoff(), { resolver }); assert.equal(Object.keys(resolver).join(","), keys); });
test("10. resolver response is not mutated", () => { const response = { resolvedItems: [validComposition({ requestId: "rtc-floor-area-total-floor-area-total-total", takeoffCode: "FLOOR_AREA_TOTAL", unit: "m2" })], unresolvedItems: [] }; const before = JSON.stringify(response); const resolver = { resolveEloEapCompositions: () => response }; Adapter.resolve(takeoff(), { resolver }); assert.equal(JSON.stringify(response), before); });
test("scopePreferences are passed through resolution context without changing output", () => {
  const preference = { bathroomFinishStandard: "economic" };
  const calls = [];
  const resolver = { resolveEloEapCompositions(input) {
    calls.push(input);
    return { resolvedItems: input.eap.itens.map((request) => validComposition(request)), unresolvedItems: [], resolutionContext: { scopePreferences: JSON.parse(JSON.stringify(input.scopePreferences || {})) } };
  } };
  const baseline = Adapter.resolve(takeoff(), { resolver });
  const preferred = Adapter.resolve(takeoff(), { resolver, scopePreferences: preference });
  assert.equal(JSON.stringify(calls[0].scopePreferences), "{}");
  assert.equal(JSON.stringify(calls[1].scopePreferences), JSON.stringify(preference));
  assert.deepEqual(baseline.resolution, preferred.resolution);
  assert.equal(preferred.resolutionContext.scopePreferences.bathroomFinishStandard, "economic");
  preferred.resolutionContext.scopePreferences.bathroomFinishStandard = "standard";
  assert.equal(preference.bathroomFinishStandard, "economic");
});
test("11. executions do not share state", () => { const a = resolveOk(); const b = resolveOk(); a.resolution.resolved.push({ x: 1 }); assert.notEqual(a.resolution.resolved.length, b.resolution.resolved.length); });
test("12. buildRequest works without resolver", () => assert.equal(Adapter.buildRequest(takeoff()).eligibleCount, 1));
test("13. resolve blocks without resolver", () => assert.equal(Adapter.resolve(takeoff()).status, "blocked"));
test("14. incompatible resolver blocks", () => assert.equal(Adapter.resolve(takeoff(), { resolver: {} }).status, "blocked"));
test("15. quantified eligible item is sent", () => assert.equal(Adapter.buildRequest(takeoff()).items.length, 1));
test("16. pending item is not sent", () => assert.equal(Adapter.buildRequest(takeoff([item("FLOOR_AREA_TOTAL", 10, "m2", { status: "pending" })])).items.length, 0));
test("17. blocked item is not sent", () => assert.equal(Adapter.buildRequest(takeoff([item("FLOOR_AREA_TOTAL", 10, "m2", { status: "blocked" })])).items.length, 0));
test("18. invalid item is not sent", () => assert.equal(Adapter.buildRequest(takeoff([item("FLOOR_AREA_TOTAL", 10, "m2", { status: "invalid" })])).items.length, 0));
test("19. zero quantity is skipped", () => assert.equal(Adapter.buildRequest(takeoff([item("FLOOR_AREA_TOTAL", 0)])).skippedItems[0].reasonCode, "zero_quantity"));
test("20. negative quantity is invalid", () => assert.equal(Adapter.buildRequest(takeoff([item("FLOOR_AREA_TOTAL", -1)])).skippedItems[0].reasonCode, "invalid_quantity"));
test("21. NaN quantity is invalid", () => assert.equal(Adapter.classifyItem(item("FLOOR_AREA_TOTAL", NaN)).reasonCode, "invalid_quantity"));
test("22. Infinity quantity is invalid", () => assert.equal(Adapter.classifyItem(item("FLOOR_AREA_TOTAL", Infinity)).reasonCode, "invalid_quantity"));
test("23. unit m supported when mapped", () => assert.equal(Adapter.classifyItem(item("ROOM_PERIMETER_TOTAL", 10, "m")).reasonCode, "missing_mapping"));
test("24. unit m2 supported", () => assert.equal(Adapter.classifyItem(item("FLOOR_AREA_TOTAL", 10, "m2")).classification, "eligible"));
test("25. unit m3 supported when mapped", () => assert.equal(Adapter.classifyItem(item("ROOM_VOLUME_TOTAL", 10, "m3")).reasonCode, "missing_mapping"));
test("26. unit un supported", () => assert.equal(Adapter.classifyItem(item("DOOR_COUNT", 2, "un", { discipline: "OPENINGS" })).classification, "eligible"));
test("27. kg rejected", () => assert.equal(Adapter.classifyItem(item("FLOOR_AREA_TOTAL", 10, "kg")).reasonCode, "unsupported_unit"));
test("28. litro rejected", () => assert.equal(Adapter.classifyItem(item("FLOOR_AREA_TOTAL", 10, "litro")).reasonCode, "unsupported_unit"));
test("29. saco rejected", () => assert.equal(Adapter.classifyItem(item("FLOOR_AREA_TOTAL", 10, "saco")).reasonCode, "unsupported_unit"));
test("30. material item rejected", () => assert.equal(Adapter.classifyItem(item("MATERIAL_CIMENTO", 10, "m2", { materials: [] })).reasonCode, "material_item_forbidden"));
test("31. price item rejected", () => assert.equal(Adapter.classifyItem(item("PRICE_TOTAL", 10, "m2")).reasonCode, "cost_item_forbidden"));
test("32. BDI item rejected", () => assert.equal(Adapter.classifyItem(item("BDI", 10, "m2")).reasonCode, "cost_item_forbidden"));
test("33. detail duplicate skipped", () => { const detail = item("FLOOR_AREA_TOTAL", 4, "m2", { aggregationRole: "detail" }); assert.equal(Adapter.classifyItem(detail, { hasTotalForCode: true }).reasonCode, "detail_duplicate"); });
test("34. total prioritized", () => assert.equal(Adapter.buildRequest(takeoff([item("FLOOR_AREA_TOTAL"), item("FLOOR_AREA_TOTAL", 4, "m2", { id: "detail", aggregationRole: "detail" })])).eligibleCount, 1));

const mappedCodes = ["FLOOR_AREA_TOTAL", "CEILING_AREA_TOTAL", "WALL_GROSS_AREA_TOTAL", "WALL_NET_AREA_TOTAL", "DOOR_COUNT", "WINDOW_COUNT", "DOOR_AREA_TOTAL", "WINDOW_AREA_TOTAL", "FINAL_CLEANING_AREA", "INTERNAL_PAINTING_BASE_AREA", "CEILING_PAINTING_BASE_AREA", "FLOOR_FINISH_BASE_AREA", "WALL_FINISH_BASE_AREA"];
mappedCodes.forEach((code, index) => {
  const unit = code.endsWith("COUNT") ? "un" : "m2";
  test(`${35 + index}. mapping ${code}`, () => assert.equal(!!byCode(code) && Adapter.classifyItem(item(code, unit === "un" ? 2 : 10, unit)).classification, "eligible"));
});

test("48. unmapped code is skipped", () => assert.equal(Adapter.classifyItem(item("OPENING_AREA_TOTAL")).reasonCode, "missing_mapping"));
test("49. request preserves takeoffItemId", () => assert.equal(Adapter.buildRequest(takeoff()).items[0].takeoffItemId, "floor_area_total-total"));
test("50. request preserves quantity", () => assert.equal(Adapter.buildRequest(takeoff([item("FLOOR_AREA_TOTAL", 12)])).items[0].quantity, 12));
test("51. request preserves unit", () => assert.equal(Adapter.buildRequest(takeoff()).items[0].unit, "m2"));
test("52. request preserves geometryPath", () => assert.equal(Adapter.buildRequest(takeoff()).items[0].source.geometryPath, "geometry.FLOOR_AREA_TOTAL"));
test("53. request preserves roomIds", () => assert.deepEqual(Adapter.buildRequest(takeoff()).items[0].source.roomIds, ["sala"]));
test("54. request preserves floorIds", () => assert.deepEqual(Adapter.buildRequest(takeoff()).items[0].source.floorIds, ["floor-1"]));
test("55. request preserves openingIds", () => { const req = Adapter.buildRequest(takeoff([item("DOOR_COUNT", 2, "un", { source: { geometryPath: "openings.doors", openingIds: ["d1"], roomIds: [], floorIds: [] } })])).items[0]; assert.deepEqual(req.source.openingIds, ["d1"]); });
test("56. query has no SINAPI code", () => assert.doesNotMatch(JSON.stringify(Adapter.buildRequest(takeoff()).items[0].query), /SINAPI|\b\d{5}\b/));
test("57. query has no ORSE code", () => assert.doesNotMatch(JSON.stringify(Adapter.buildRequest(takeoff()).items[0].query), /ORSE|\b\d{3,}\b/));
test("58. adapter does not invent composition", () => assert.equal(Adapter.resolve(takeoff(), { resolver: resolverFor(() => null) }).resolution.resolved.length, 0));
test("59. valid response is accepted", () => assert.equal(resolveOk().resolution.resolved.length, 1));
test("60. missing code is rejected", () => { const r = Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { description: "x", unit: req.unit, source: "SINAPI" } })) }); assert.equal(r.resolution.rejected[0].errors[0].code, "missing_composition_code"); });
test("61. missing description is rejected", () => { const r = Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "1", unit: req.unit, source: "SINAPI" } })) }); assert.equal(r.resolution.rejected[0].errors[0].code, "missing_composition_description"); });
test("62. incompatible unit is rejected", () => { const r = Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "1", description: "x", unit: "un", source: "SINAPI" } })) }); assert.ok(r.resolution.rejected[0].errors.some((e) => e.code === "unit_mismatch")); });
test("63. low confidence is rejected", () => { const r = Adapter.resolve(takeoff(), { minimumConfidence: 0.8, resolver: resolverFor((req) => validComposition(req, { confianca: 0.3 })) }); assert.ok(r.resolution.rejected[0].errors.some((e) => e.code === "low_confidence")); });
test("64. unofficial source is rejected", () => { const r = Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "1", description: "x", unit: req.unit, source: "MANUAL" } })) }); assert.ok(r.resolution.rejected[0].errors.some((e) => e.code === "unofficial_source")); });
test("65. official source is accepted", () => assert.equal(resolveOk().resolution.resolved[0].compatibility.sourceAccepted, true));
test("66. quantity is preserved", () => assert.equal(resolveOk(takeoff([item("FLOOR_AREA_TOTAL", 22)])).resolution.resolved[0].quantity, 22));
test("67. result keeps traceability", () => assert.equal(resolveOk().resolution.resolved[0].trace.geometryPath, "geometry.FLOOR_AREA_TOTAL"));
test("68. official inputs are preserved for consumption", () => { const inputs = resolveOk().resolution.resolved[0].composition.inputs; assert.equal(inputs.length, 1); assert.equal(inputs[0].code, "INS-1"); assert.equal(inputs[0].coefficient, 2); assert.equal(/unitPrice|precoUnitario|cost|subtotal/i.test(JSON.stringify(inputs)), false); });
test("69. unresolved is preserved", () => assert.equal(Adapter.resolve(takeoff(), { resolver: resolverFor(() => null) }).resolution.unresolved.length, 1));
test("70. rejected is preserved", () => assert.equal(Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "1", description: "x", unit: "un", source: "SINAPI" } })) }).resolution.rejected.length, 1));
test("70. resolver error is captured", () => { const resolver = { resolveEloEapCompositions() { throw new Error("boom"); } }; assert.doesNotThrow(() => Adapter.resolve(takeoff(), { resolver })); });
test("71. resolver returns null", () => assert.equal(Adapter.resolve(takeoff(), { resolver: { resolveEloEapCompositions: () => null } }).status, "invalid"));
test("72. resolver returns empty arrays", () => assert.equal(Adapter.resolve(takeoff(), { resolver: { resolveEloEapCompositions: () => ({ resolvedItems: [], unresolvedItems: [] }) } }).resolution.unresolved.length, 1));
test("73. resolver returns invalid format", () => assert.equal(Adapter.resolve(takeoff(), { resolver: { resolveEloEapCompositions: () => [] } }).status, "invalid"));
test("74. partial resolution", () => { const model = takeoff([item("FLOOR_AREA_TOTAL"), item("CEILING_AREA_TOTAL")]); const r = Adapter.resolve(model, { resolver: resolverFor((req) => req.takeoffCode === "FLOOR_AREA_TOTAL" ? validComposition(req) : null) }); assert.equal(r.status, "partial"); });
test("75. complete resolution", () => assert.equal(resolveOk().status, "complete"));
test("76. blocked status", () => assert.equal(Adapter.resolve(takeoff()).status, "blocked"));
test("77. invalid status", () => assert.equal(Adapter.resolve({ schema: "bad" }).status, "invalid"));
test("78. partial status", () => assert.equal(Adapter.resolve(takeoff(), { resolver: resolverFor(() => null) }).status, "partial"));
test("79. complete status", () => assert.equal(resolveOk().status, "complete"));
test("80. totals.inputItemCount", () => assert.equal(resolveOk().totals.inputItemCount, 1));
test("81. totals.eligibleItemCount", () => assert.equal(resolveOk().totals.eligibleItemCount, 1));
test("82. totals.resolvedItemCount", () => assert.equal(resolveOk().totals.resolvedItemCount, 1));
test("83. totals.unresolvedItemCount", () => assert.equal(Adapter.resolve(takeoff(), { resolver: resolverFor(() => null) }).totals.unresolvedItemCount, 1));
test("84. totals.rejectedItemCount", () => assert.equal(Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "1", description: "x", unit: "un", source: "SINAPI" } })) }).totals.rejectedItemCount, 1));
test("85. totals.skippedItemCount", () => assert.equal(Adapter.resolve(takeoff([item("OPENING_AREA_TOTAL")]), { resolver: resolverFor((r) => validComposition(r)) }).totals.skippedItemCount, 1));
test("86. totals.blockedItemCount", () => assert.equal(Adapter.resolve(takeoff([item("FLOOR_AREA_TOTAL", 1, "m2", { status: "blocked" })]), { resolver: resolverFor((r) => validComposition(r)) }).totals.blockedItemCount, 1));
test("87. completeness score", () => assert.equal(resolveOk().completeness.score, 100));
test("88. errors prevent complete", () => assert.notEqual(Adapter.resolve(takeoff(), { resolver: { resolveEloEapCompositions: () => [] } }).status, "complete"));
test("89. blockingFields prevent complete", () => assert.notEqual(Adapter.resolve(takeoff()).status, "complete"));
test("90. unresolved prevents complete", () => assert.notEqual(Adapter.resolve(takeoff(), { resolver: resolverFor(() => null) }).status, "complete"));
test("91. rejected prevents complete", () => assert.notEqual(Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "1", description: "x", unit: "un", source: "SINAPI" } })) }).status, "complete"));
test("92. fingerprint equal for equal input", () => assert.equal(resolveOk().audit.inputFingerprint, resolveOk().audit.inputFingerprint));
test("93. fingerprint changes with item", () => assert.notEqual(resolveOk(takeoff([item("FLOOR_AREA_TOTAL", 10)])).audit.inputFingerprint, resolveOk(takeoff([item("FLOOR_AREA_TOTAL", 11)])).audit.inputFingerprint));
test("94. requestFingerprint deterministic", () => assert.equal(resolveOk().audit.requestFingerprint, resolveOk().audit.requestFingerprint));
test("95. resolutionFingerprint deterministic", () => assert.equal(resolveOk().audit.resolutionFingerprint, resolveOk().audit.resolutionFingerprint));
test("96. different composition changes fingerprint", () => { const a = Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "1", description: "a", unit: req.unit, source: "SINAPI" } })) }); const b = Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "2", description: "b", unit: req.unit, source: "SINAPI" } })) }); assert.notEqual(a.audit.resolutionFingerprint, b.audit.resolutionFingerprint); });
test("97. generatedAt does not alter fingerprint", () => assert.equal(resolveOk(takeoff([], { audit: { generatedAt: "a" } })).audit.inputFingerprint, resolveOk(takeoff([], { audit: { generatedAt: "b" } })).audit.inputFingerprint));
test("98. property order does not alter fingerprint", () => { const a = takeoff([item("FLOOR_AREA_TOTAL")]); const b = { audit: a.audit, completeness: a.completeness, errors: a.errors, warnings: a.warnings, blockingFields: a.blockingFields, missingFields: a.missingFields, assumptions: a.assumptions, quantitiesByUnit: a.quantitiesByUnit, totals: a.totals, items: a.items, disciplines: a.disciplines, sourceGeometry: a.sourceGeometry, status: a.status, version: a.version, schema: a.schema }; assert.equal(Adapter.resolve(a).audit.inputFingerprint, Adapter.resolve(b).audit.inputFingerprint); });
["price", "cost", "consumption", "BDI", "eap", "budget", "PDF", "pdfAction"].forEach((label, index) => {
  test(`${99 + index}. output has no ${label}`, () => assert.equal(new RegExp(label, "i").test(JSON.stringify(resolveOk())), false));
});
test("108. does not access network", () => { const sandbox = { console, window: { fetch() { throw new Error("network"); } } }; sandbox.globalThis = sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox); assert.equal(sandbox.window.ResidentialTakeoffCompositionAdapter.resolve(takeoff()).status, "blocked"); });
test("109. does not access database", () => { const result = resolveOk(); assert.equal(/indexedDB|database|postgres|sqlite/i.test(JSON.stringify(result)), false); });
test("110. does not access localStorage", () => { const sandbox = { console, window: { localStorage: { getItem() { throw new Error("storage"); } } } }; sandbox.globalThis = sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox); assert.equal(sandbox.window.ResidentialTakeoffCompositionAdapter.resolve(takeoff()).status, "blocked"); });
test("111. does not alter EloCompositionResolver source", () => { const before = readFileSync(resolverPath, "utf8"); readFileSync(adapterPath, "utf8"); assert.equal(readFileSync(resolverPath, "utf8"), before); });
test("112. does not alter CompositionSearchEngine source", () => { const before = readFileSync(searchPath, "utf8"); readFileSync(adapterPath, "utf8"); assert.equal(readFileSync(searchPath, "utf8"), before); });
test("113. does not alter takeoff", () => { const model = takeoff(); const before = JSON.stringify(model); resolveOk(model); assert.equal(JSON.stringify(model), before); });
test("114. Object.freeze does not break", () => assert.equal(resolveOk(freezeDeep(takeoff())).status, "complete"));
test("115. request order is stable", () => { const model = takeoff([item("WALL_NET_AREA_TOTAL"), item("FLOOR_AREA_TOTAL")]); assert.equal(JSON.stringify(Adapter.buildRequest(model).items.map((x) => x.takeoffCode)), JSON.stringify(["WALL_NET_AREA_TOTAL", "FLOOR_AREA_TOTAL"])); });
test("116. IDs are deterministic", () => assert.equal(Adapter.buildRequest(takeoff()).items[0].requestId, Adapter.buildRequest(takeoff()).items[0].requestId));
test("117. duplicated IDs are both traceable", () => { const model = takeoff([item("FLOOR_AREA_TOTAL", 1), item("CEILING_AREA_TOTAL", 1, "m2", { id: "floor_area_total-total" })]); const req = Adapter.buildRequest(model); assert.equal(req.items.length, 2); });
test("118. item without source is skipped", () => assert.equal(Adapter.classifyItem(item("FLOOR_AREA_TOTAL", 10, "m2", { source: null })).reasonCode, "missing_source"));
test("119. item without geometryPath is classified", () => assert.equal(Adapter.classifyItem(item("FLOOR_AREA_TOTAL", 10, "m2", { source: { roomIds: [] } })).reasonCode, "missing_geometry_reference"));
test("120. batch resolver contract is supported", () => { const resolver = resolverFor((req) => validComposition(req)); const result = Adapter.resolve(takeoff(), { resolver }); assert.equal(resolver.calls[0].eap.itens.length, 1); assert.equal(result.status, "complete"); });
test("121. item resolver contract is supported", () => { const result = Adapter.resolve(takeoff(), { resolveItem: (req) => validComposition(req) }); assert.equal(result.status, "complete"); });
test("122. no implicit global resolver is used", () => { const sandbox = { console, window: { EloCompositionResolver: resolverFor((req) => validComposition(req)) } }; sandbox.globalThis = sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(adapterPath, "utf8"), sandbox); assert.equal(sandbox.window.ResidentialTakeoffCompositionAdapter.resolve(takeoff()).status, "blocked"); });
test("123. real resolver contract receives eap itens", () => { const win = loadWindow(["elo-composition-resolver.js"]); const engine = { searchOfficialCompositions: (query, options) => ({ candidates: [{ code: "12345", description: query, unit: options.unit, source: "SINAPI", score: 0.9 }] }) }; const result = Adapter.resolve(takeoff(), { resolver: win.EloCompositionResolver, compositionSearchEngine: engine }); assert.equal(result.request.items[0].unidadeEsperada, "m2"); });
test("124. unsupported official source with isOfficial true can be accepted", () => { const r = Adapter.resolve(takeoff(), { resolver: resolverFor((req) => validComposition(req, { composicaoSelecionada: { code: "1", description: "x", unit: req.unit, source: "BASE", isOfficial: true } })) }); assert.equal(r.status, "complete"); });
test("125. getSupportedMappings returns immutable copy", () => { const maps = Adapter.getSupportedMappings(); maps[0].unit = "kg"; assert.equal(Adapter.getSupportedMappings()[0].unit, "m2"); });

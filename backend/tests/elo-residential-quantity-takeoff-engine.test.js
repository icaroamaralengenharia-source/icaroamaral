import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const enginePath = join(repoRoot, "relatorio-qualidade-obras", "elo-residential-quantity-takeoff-engine.js");

function loadEngine(extra = {}) {
  const sandbox = { console, window: {}, ...extra };
  sandbox.globalThis = sandbox.window;
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(enginePath, "utf8"), sandbox, { filename: enginePath });
  return sandbox.window.ResidentialQuantityTakeoffEngine;
}

const Engine = loadEngine();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freezeDeep(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freezeDeep);
  }
  return value;
}

function merge(base, overrides) {
  const output = clone(base);
  function assign(target, source) {
    for (const [key, value] of Object.entries(source || {})) {
      if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) assign(target[key], value);
      else target[key] = value;
    }
  }
  assign(output, overrides);
  return output;
}

const baseGeometry = {
  schema: "elo.residential_geometry_model",
  version: "1.0.0",
  status: "complete",
  sourceBriefing: { schema: "elo.residential_briefing_complete", version: "1.0.0", fingerprint: "fp_briefing" },
  site: { landAreaM2: 100, implantationAreaM2: 24, freeAreaM2: 76, occupancyRatePercent: 24, builtAreaM2: 24, totalFloorAreaM2: 24 },
  building: { floorsCount: 1, totalBuiltAreaM2: 24, totalPerimeterM: 28, totalInternalAreaM2: 24, totalCeilingAreaM2: 24, totalFloorAreaM2: 24, totalOpeningAreaM2: 3 },
  floors: [{ id: "floor-1", number: 1, areaM2: 24, openingAreaM2: 3, roomIds: ["sala", "quarto"] }],
  rooms: [
    { id: "sala", name: "Sala", floor: 1, quantity: 1, geometry: { floorAreaM2: 12, ceilingAreaM2: 12, wallGrossAreaM2: 42, wallNetAreaM2: 40, perimeterM: 14, volumeM3: 36 }, finishes: { floor: "porcelanato", walls: "pintura" } },
    { id: "quarto", name: "Quarto", floor: 1, quantity: 1, geometry: { floorAreaM2: 12, ceilingAreaM2: 12, wallGrossAreaM2: 42, wallNetAreaM2: 41, perimeterM: 14, volumeM3: 36 }, finishes: { floor: "porcelanato", walls: "pintura" } }
  ],
  openings: {
    doors: [{ id: "porta-sala", type: "door", roomId: "sala", quantity: 1, totalAreaM2: 2 }],
    windows: [{ id: "janela-quarto", type: "window", roomId: "quarto", quantity: 1, totalAreaM2: 1 }],
    otherOpenings: [],
    totalAreaM2: 3
  },
  surfaces: { floorAreaM2: 24, ceilingAreaM2: 24, internalWallGrossAreaM2: 84, internalWallNetAreaM2: 81, openingAreaM2: 3 },
  adjacency: { relations: [], unresolved: [] },
  warnings: [],
  errors: [],
  blockingFields: [],
  completeness: { score: 100 },
  audit: { inputFingerprint: "fp_input", geometryFingerprint: "fp_geometry" }
};

function geometry(overrides = {}) {
  return merge(baseGeometry, overrides);
}

function build(overrides = {}, options = {}) {
  return Engine.build(geometry(overrides), options);
}

function item(result, code) {
  return result.items.find((entry) => entry.code === code || entry.code.startsWith(code + "_"));
}

function items(result, code) {
  return result.items.filter((entry) => entry.code === code || entry.code.startsWith(code + "_"));
}

test("1. exports UMD engine", () => {
  assert.equal(typeof Engine.build, "function");
  assert.equal(typeof Engine.normalize, "function");
  assert.equal(typeof Engine.validate, "function");
});

test("2. exposes version", () => assert.equal(Engine.getVersion(), "1.0.0"));
test("3. output schema", () => assert.equal(build().schema, "elo.residential_quantity_takeoff"));
test("4. incompatible input invalid", () => assert.equal(Engine.build({ schema: "wrong" }).status, "invalid"));
test("5. invalid geometry invalid", () => assert.equal(build({ status: "invalid" }).status, "invalid"));

test("6. does not mutate geometry", () => {
  const input = freezeDeep(geometry());
  const before = clone(input);
  Engine.build(input);
  assert.deepEqual(input, before);
});

test("7. independent executions do not share state", () => {
  const first = build();
  first.items.push({ id: "mutated" });
  assert.notEqual(build().items.length, first.items.length);
});

test("8. normalizes missing arrays", () => {
  const result = build({ rooms: undefined, floors: undefined, openings: undefined });
  assert.equal(Array.isArray(result.items), true);
  assert.equal(result.status !== "complete", true);
});

const expectedQuantities = [
  ["BUILT_AREA", 24, "m2"],
  ["IMPLANTATION_AREA", 24, "m2"],
  ["FREE_SITE_AREA", 76, "m2"],
  ["FLOOR_AREA_TOTAL", 24, "m2"],
  ["FLOOR_AREA_ROOM", 12, "m2"],
  ["CEILING_AREA_TOTAL", 24, "m2"],
  ["CEILING_AREA_ROOM", 12, "m2"],
  ["WALL_GROSS_AREA_ROOM", 42, "m2"],
  ["WALL_NET_AREA_ROOM", 40, "m2"],
  ["WALL_GROSS_AREA_TOTAL", 84, "m2"],
  ["WALL_NET_AREA_TOTAL", 81, "m2"],
  ["OPENING_AREA_TOTAL", 3, "m2"],
  ["DOOR_COUNT", 1, "un"],
  ["DOOR_AREA_TOTAL", 2, "m2"],
  ["WINDOW_COUNT", 1, "un"],
  ["WINDOW_AREA_TOTAL", 1, "m2"],
  ["OTHER_OPENING_COUNT", 0, "un"],
  ["OTHER_OPENING_AREA_TOTAL", 0, "m2"],
  ["ROOM_PERIMETER", 14, "m"],
  ["ROOM_PERIMETER_TOTAL", 28, "m"],
  ["ROOM_VOLUME", 36, "m3"],
  ["ROOM_VOLUME_TOTAL", 72, "m3"],
  ["FLOOR_LEVEL_AREA", 24, "m2"],
  ["FINAL_CLEANING_AREA", 24, "m2"],
  ["INTERNAL_PAINTING_BASE_AREA", 81, "m2"],
  ["CEILING_PAINTING_BASE_AREA", 24, "m2"],
  ["FLOOR_FINISH_BASE_AREA", 12, "m2"],
  ["WALL_FINISH_BASE_AREA", 40, "m2"]
];

expectedQuantities.forEach(([code, quantity, unit], index) => {
  test(`${9 + index}. calculates ${code}`, () => {
    const result = build({}, { floorFinishDefined: true, wallFinishDefined: true });
    const found = item(result, code);
    assert.ok(found, code);
    assert.equal(found.unit, unit);
    assert.equal(found.quantity, quantity);
  });
});

test("37. room.quantity multiplies room geometry", () => {
  const result = build({ rooms: [{ id: "suite", name: "Suite", quantity: 2, geometry: { floorAreaM2: 10, ceilingAreaM2: 10, wallGrossAreaM2: 30, wallNetAreaM2: 28, perimeterM: 12, volumeM3: 30 } }], surfaces: { floorAreaM2: 20, ceilingAreaM2: 20, internalWallGrossAreaM2: 60, internalWallNetAreaM2: 56, openingAreaM2: 4 }, openings: { doors: [], windows: [], otherOpenings: [], totalAreaM2: 0 } });
  assert.equal(item(result, "ROOM_PERIMETER").quantity, 24);
});

test("38. opening.quantity multiplies count", () => {
  const result = build({ openings: { doors: [{ id: "p", roomId: "sala", quantity: 3, totalAreaM2: 6 }], windows: [], otherOpenings: [], totalAreaM2: 6 } });
  assert.equal(item(result, "DOOR_COUNT").quantity, 3);
});

test("39. detail items use detail aggregationRole", () => assert.equal(item(build(), "FLOOR_AREA_ROOM").aggregationRole, "detail"));
test("40. total items use total aggregationRole", () => assert.equal(item(build(), "FLOOR_AREA_TOTAL").aggregationRole, "total"));
test("41. detail items are not double counted in floor total", () => assert.equal(item(build(), "FLOOR_AREA_TOTAL").quantity, 24));
test("42. quantities include m", () => assert.ok(build().quantitiesByUnit.m > 0));
test("43. quantities include m2", () => assert.ok(build().quantitiesByUnit.m2 > 0));
test("44. quantities include m3", () => assert.ok(build().quantitiesByUnit.m3 > 0));
test("45. quantities include un", () => assert.ok(build().quantitiesByUnit.un > 0));
test("46. does not generate kg", () => assert.equal(build().items.some((entry) => entry.unit === "kg"), false));
test("47. does not generate litro", () => assert.equal(build().items.some((entry) => /litro|l\b/i.test(entry.unit)), false));
test("48. does not generate material blocks", () => assert.equal(build().items.some((entry) => /\b(bloco|tijolo|cimento|areia|brita|aco|aço|argamassa|tinta|telha|fio|tubo)s?\b/i.test(entry.name)), false));
test("49. does not generate SINAPI", () => assert.equal(build().items.some((entry) => /SINAPI|ORSE/i.test(entry.code + entry.name)), false));
test("50. does not generate composition property", () => assert.equal(Object.hasOwn(build(), "compositions"), false));
test("51. does not generate inputs property", () => assert.equal(Object.hasOwn(build(), "inputs"), false));
test("52. does not generate prices property", () => assert.equal(Object.hasOwn(build(), "prices"), false));
test("53. does not apply BDI", () => assert.equal(build({}, { bdiPercent: 50 }).quantitiesByUnit.m2, build({}, { bdiPercent: 0 }).quantitiesByUnit.m2));
test("54. does not generate cost", () => assert.equal(Object.hasOwn(build(), "cost"), false));
test("55. does not generate EAP", () => assert.equal(Object.hasOwn(build(), "eap"), false));
test("56. does not generate budget", () => assert.equal(Object.hasOwn(build(), "budget"), false));
test("57. does not generate PDF", () => assert.equal(Object.hasOwn(build(), "pdf"), false));

const pendingCodes = [
  "INITIAL_SITE_CLEANING", "LAYOUT_MARKING", "SITE_FACILITIES", "TEMPORARY_FENCE", "EARTHWORK_CUT",
  "EXCAVATION", "BACKFILL", "FOUNDATION", "GRADE_BEAM", "WATERPROOFING", "STRUCTURE", "CONCRETE",
  "FORMWORK", "REBAR", "STRUCTURAL_SLAB", "ROOF", "ROOF_TILE", "RIDGE", "GUTTERS", "FLASHINGS",
  "LINTELS", "COUNTER_LINTELS", "BASEBOARDS", "THRESHOLDS", "WINDOW_SILLS", "ELECTRICAL",
  "HYDRAULIC", "SANITARY", "DRAINAGE", "GAS", "AIR_CONDITIONING", "SANITARY_FIXTURES",
  "METALS", "COUNTERTOPS", "GLASS", "LOCAL_ADMINISTRATION", "MOBILIZATION", "DEMOBILIZATION",
  "FREIGHT", "LOSSES", "BDI"
];

pendingCodes.forEach((code, index) => {
  test(`${58 + index}. pending item ${code} has reason`, () => {
    const found = build().items.find((entry) => entry.code === code);
    assert.ok(found, code);
    assert.equal(found.status, "pending");
    assert.ok(found.assumptions[0].includes("depende"));
  });
});

test("99. missing room reference is invalid", () => {
  const result = build({ openings: { doors: [{ id: "p", roomId: "x", quantity: 1, totalAreaM2: 2 }], windows: [], otherOpenings: [], totalAreaM2: 2 } });
  assert.equal(result.errors.some((entry) => entry.code === "missing_room_reference"), true);
});

test("100. negative quantity invalidates item", () => assert.equal(build({ site: { builtAreaM2: -1 } }).status, "invalid"));
test("101. negative wall net area invalidates", () => assert.equal(build({ rooms: [{ id: "s", geometry: { floorAreaM2: 1, ceilingAreaM2: 1, wallGrossAreaM2: 1, wallNetAreaM2: -1, perimeterM: 1, volumeM3: 1 } }] }).status, "invalid"));
test("102. wall net greater than gross warns as error", () => assert.equal(build({ rooms: [{ id: "s", geometry: { floorAreaM2: 1, ceilingAreaM2: 1, wallGrossAreaM2: 1, wallNetAreaM2: 2, perimeterM: 1, volumeM3: 1 } }] }).status, "invalid"));
test("103. total floor mismatch warns", () => assert.equal(build({ surfaces: { floorAreaM2: 25, ceilingAreaM2: 24, internalWallGrossAreaM2: 84, internalWallNetAreaM2: 81, openingAreaM2: 3 } }).warnings.some((entry) => entry.code === "floor_total_mismatch"), true));
test("104. total opening mismatch warns", () => assert.equal(build({ openings: { doors: baseGeometry.openings.doors, windows: baseGeometry.openings.windows, otherOpenings: [], totalAreaM2: 9 } }).warnings.some((entry) => entry.code === "opening_total_mismatch"), true));
test("105. quantified item status exists", () => assert.equal(item(build(), "BUILT_AREA").status, "quantified"));
test("106. pending item status exists", () => assert.equal(build().items.find((entry) => entry.code === "FOUNDATION").status, "pending"));
test("107. blocked item status exists when geometry invalid", () => assert.equal(build({ status: "invalid" }).items.find((entry) => entry.code === "FOUNDATION").status, "blocked"));
test("108. invalid item status exists for impossible quantity", () => assert.equal(item(build({ site: { builtAreaM2: -1 } }), "BUILT_AREA").status, "invalid"));
test("109. takeoff partial with executive pendencies", () => assert.equal(build().status, "partial"));
test("110. completeness score is bounded", () => assert.equal(build().completeness.score >= 0 && build().completeness.score <= 100, true));
test("111. geometrySupportedScore is bounded", () => assert.equal(build().completeness.geometrySupportedScore >= 0 && build().completeness.geometrySupportedScore <= 100, true));
test("112. residentialOverallReadiness remains partial", () => assert.equal(build().completeness.residentialOverallReadiness, "partial"));
test("113. totals itemCount matches items", () => assert.equal(build().totals.itemCount, build().items.length));
test("114. totals quantified count matches items", () => assert.equal(build().totals.quantifiedItemCount, build().items.filter((entry) => entry.status === "quantified").length));
test("115. totals pending count matches items", () => assert.equal(build().totals.pendingItemCount, build().items.filter((entry) => entry.status === "pending").length));
test("116. input fingerprint is stable", () => assert.equal(build().audit.inputFingerprint, build().audit.inputFingerprint));
test("117. takeoff fingerprint is stable", () => assert.equal(build().audit.takeoffFingerprint, build().audit.takeoffFingerprint));
test("118. generatedAt does not affect fingerprint", () => assert.equal(Engine.build(geometry(), { generatedAt: "2026-07-13T10:00:00.000Z" }).audit.takeoffFingerprint, Engine.build(geometry(), { generatedAt: "2026-07-13T11:00:00.000Z" }).audit.takeoffFingerprint));
test("119. quantity change changes fingerprint", () => assert.notEqual(build().audit.takeoffFingerprint, build({ site: { builtAreaM2: 25 } }).audit.takeoffFingerprint));
test("120. property order does not alter input fingerprint", () => {
  const a = geometry();
  const b = { audit: a.audit, completeness: a.completeness, blockingFields: [], errors: [], warnings: [], adjacency: a.adjacency, surfaces: a.surfaces, openings: a.openings, rooms: a.rooms, floors: a.floors, building: a.building, site: a.site, sourceBriefing: a.sourceBriefing, status: a.status, version: a.version, schema: a.schema };
  assert.equal(Engine.build(a).audit.inputFingerprint, Engine.build(b).audit.inputFingerprint);
});
test("121. rounding m2 to 3 decimals", () => assert.equal(build({ site: { builtAreaM2: 10.12345 } }).items.find((entry) => entry.code === "BUILT_AREA").quantity, 10.123));
test("122. rounding un to integer", () => assert.equal(build({ openings: { doors: [{ id: "p", roomId: "sala", quantity: 1.6, totalAreaM2: 2 }], windows: [], otherOpenings: [], totalAreaM2: 2 } }).items.find((entry) => entry.code === "DOOR_COUNT").quantity, 2));
test("123. calculateRoomTakeoff API", () => assert.equal(Engine.calculateRoomTakeoff(baseGeometry.rooms[0]).floorAreaM2, 12));
test("124. calculateOpeningTakeoff API", () => assert.equal(Engine.calculateOpeningTakeoff(baseGeometry.openings.doors[0]).areaM2, 2));
test("125. calculateFloorTakeoff API", () => assert.equal(Engine.calculateFloorTakeoff(baseGeometry.floors[0]).areaM2, 24));
test("126. getSupportedItems API", () => assert.equal(Engine.getSupportedItems().length >= 28, true));
test("127. getSupportedDisciplines API", () => assert.equal(Engine.getSupportedDisciplines().includes("FOUNDATION"), true));
test("128. validate API returns partial", () => assert.equal(Engine.validate(geometry()).status, "partial"));
test("129. normalize API delegates build", () => assert.equal(Engine.normalize(geometry()).schema, "elo.residential_quantity_takeoff"));
test("130. does not access network", () => assert.equal(loadEngine({ fetch: () => { throw new Error("network"); } }).build(geometry()).status, "partial"));
test("131. does not access localStorage", () => assert.equal(loadEngine({ localStorage: { getItem: () => { throw new Error("storage"); } } }).build(geometry()).status, "partial"));
test("132. does not access database", () => assert.equal(loadEngine({ db: { query: () => { throw new Error("db"); } } }).build(geometry()).status, "partial"));
test("133. every quantified item has geometry path", () => assert.equal(build().items.filter((entry) => entry.status === "quantified").every((entry) => entry.source.geometryPath), true));
test("134. aggregated item lists room ids", () => assert.equal(item(build(), "FLOOR_AREA_TOTAL").source.roomIds.length, 2));
test("135. opening aggregate lists opening ids", () => assert.equal(item(build(), "OPENING_AREA_TOTAL").source.openingIds.length, 2));
test("136. discipline structure exists", () => assert.ok(build().disciplines.find((entry) => entry.id === "MASONRY").itemIds.length));
test("137. no raw text accepted as valid", () => assert.equal(Engine.build("casa 80m2").status, "invalid"));
test("138. assumptions are present for pending items", () => assert.ok(build().items.find((entry) => entry.code === "BDI").assumptions[0]));
test("139. no loss is applied", () => assert.equal(build({}, { lossPercent: 50 }).quantitiesByUnit.m2, build({}, { lossPercent: 0 }).quantitiesByUnit.m2));
test("140. source geometry fingerprints are copied", () => assert.equal(build().sourceGeometry.geometryFingerprint, "fp_geometry"));

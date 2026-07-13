import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const enginePath = join(repoRoot, "relatorio-qualidade-obras", "elo-residential-geometry-model-engine.js");

function loadEngine(extra = {}) {
  const sandbox = { console, window: {}, ...extra };
  sandbox.globalThis = sandbox.window;
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(enginePath, "utf8"), sandbox, { filename: enginePath });
  return sandbox.window.ResidentialGeometryModelEngine;
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
      if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
        assign(target[key], value);
      } else {
        target[key] = value;
      }
    }
  }
  assign(output, overrides);
  return output;
}

const baseBriefing = {
  schema: "elo.residential_briefing_complete",
  version: "1.0.0",
  status: "complete",
  project: { city: "Salvador", state: "BA", referenceMonth: "2026-07", priceSource: "SINAPI" },
  site: { landAreaM2: 100, implantationAreaM2: 24, builtAreaM2: 24, floors: 1 },
  building: { useType: "residential", ceilingHeightM: 3 },
  program: { bedrooms: 1, bathrooms: 1 },
  rooms: [
    { id: "sala", name: "Sala", type: "living", floor: 1, widthM: 4, lengthM: 3 },
    { id: "quarto", name: "Quarto", type: "bedroom", floor: 1, widthM: 3, lengthM: 4 }
  ],
  openings: {
    doors: [{ id: "porta-sala", roomId: "sala", widthM: 1, heightM: 2, quantity: 1 }],
    windows: [{ id: "janela-quarto", roomId: "quarto", widthM: 1, heightM: 1, quantity: 1 }],
    otherOpenings: []
  },
  finishes: {},
  systems: {},
  fixtures: {},
  costing: { bdiPercent: 25, lossPercent: 10 },
  assumptions: [],
  providedFields: [],
  derivedFields: [],
  defaultedFields: [],
  missingFields: [],
  blockingFields: [],
  warnings: [],
  errors: [],
  audit: { inputFingerprint: "fp_source" }
};

function briefing(overrides = {}) {
  return merge(baseBriefing, overrides);
}

function fields(items) {
  return items.map((item) => (typeof item === "string" ? item : item.field));
}

test("1. exports ResidentialGeometryModelEngine", () => {
  assert.equal(typeof Engine.build, "function");
  assert.equal(typeof Engine.normalize, "function");
  assert.equal(typeof Engine.validate, "function");
});

test("2. exposes version", () => assert.equal(Engine.getVersion(), "1.0.0"));

test("3. builds output schema", () => assert.equal(Engine.build(briefing()).schema, "elo.residential_geometry_model"));

test("4. incompatible input is invalid", () => assert.equal(Engine.build({ schema: "wrong" }).status, "invalid"));

test("5. invalid briefing is invalid", () => assert.equal(Engine.build(briefing({ status: "invalid" })).status, "invalid"));

test("6. does not mutate briefing", () => {
  const input = freezeDeep(briefing());
  const before = clone(input);
  Engine.build(input);
  assert.deepEqual(input, before);
});

test("7. builds do not share state", () => {
  const first = Engine.build(briefing());
  first.rooms.push({ id: "mutated" });
  assert.equal(Engine.build(briefing()).rooms.length, 2);
});

test("8. absent arrays become empty arrays", () => {
  const result = Engine.build(briefing({ rooms: undefined, openings: undefined }));
  assert.equal(result.rooms.length, 0);
  assert.equal(result.openings.doors.length, 0);
});

test("9. room width and length derive area", () => assert.equal(Engine.build(briefing()).rooms[0].geometry.areaM2, 12));

test("10. room width and length derive perimeter", () => assert.equal(Engine.build(briefing()).rooms[0].geometry.perimeterM, 14));

test("11. room derives volume", () => assert.equal(Engine.build(briefing()).rooms[0].geometry.volumeM3, 36));

test("12. derives floor area", () => assert.equal(Engine.build(briefing()).rooms[0].geometry.floorAreaM2, 12));

test("13. derives ceiling area", () => assert.equal(Engine.build(briefing()).rooms[0].geometry.ceilingAreaM2, 12));

test("14. derives gross wall area", () => assert.equal(Engine.build(briefing()).rooms[0].geometry.wallGrossAreaM2, 42));

test("15. provided area without dimensions is preserved", () => {
  const room = Engine.build(briefing({ rooms: [{ id: "sala", name: "Sala", floor: 1, areaM2: 10, perimeterM: 14 }] })).rooms[0];
  assert.equal(room.geometry.areaM2, 10);
});

test("16. provided perimeter without dimensions is preserved", () => {
  const room = Engine.build(briefing({ rooms: [{ id: "sala", name: "Sala", floor: 1, areaM2: 10, perimeterM: 14 }] })).rooms[0];
  assert.equal(room.geometry.perimeterM, 14);
});

test("17. does not invent width", () => assert.equal(Engine.build(briefing({ rooms: [{ id: "sala", floor: 1, areaM2: 10, perimeterM: 14 }] })).rooms[0].dimensions.widthM, null));

test("18. does not invent length", () => assert.equal(Engine.build(briefing({ rooms: [{ id: "sala", floor: 1, areaM2: 10, perimeterM: 14 }] })).rooms[0].dimensions.lengthM, null));

test("19. inherited height is classified as defaulted", () => {
  const result = Engine.build(briefing());
  assert.equal(result.rooms[0].dimensions.heightM, 3);
  assert.equal(result.defaultedFields.includes("rooms.sala.heightM"), true);
});

test("20. room without height is partial", () => {
  const result = Engine.build(briefing({ site: { builtAreaM2: 4, implantationAreaM2: 4 }, building: { ceilingHeightM: null }, rooms: [{ id: "sala", floor: 1, widthM: 2, lengthM: 2 }], openings: { doors: [], windows: [], otherOpenings: [] } }));
  assert.equal(result.status, "partial");
});

test("21. door calculates area per unit", () => assert.equal(Engine.build(briefing()).openings.doors[0].areaPerUnitM2, 2));

test("22. door calculates total area", () => assert.equal(Engine.build(briefing()).openings.doors[0].totalAreaM2, 2));

test("23. window calculates area", () => assert.equal(Engine.build(briefing()).openings.windows[0].totalAreaM2, 1));

test("24. opening quantity multiplies area", () => {
  const result = Engine.build(briefing({ openings: { doors: [{ id: "p", roomId: "sala", widthM: 1, heightM: 2, quantity: 3 }], windows: [], otherOpenings: [] } }));
  assert.equal(result.openings.doors[0].totalAreaM2, 6);
});

test("25. opening binds by roomId", () => assert.equal(Engine.build(briefing()).rooms[0].openings.doorIds.includes("porta-sala"), true));

test("26. opening without roomId creates warning", () => {
  const result = Engine.build(briefing({ openings: { doors: [{ id: "p", widthM: 1, heightM: 2 }], windows: [], otherOpenings: [] } }));
  assert.equal(fields(result.warnings).includes("openings.p.roomId"), true);
});

test("27. opening with unknown room creates error", () => {
  const result = Engine.build(briefing({ openings: { doors: [{ id: "p", roomId: "x", widthM: 1, heightM: 2 }], windows: [], otherOpenings: [] } }));
  assert.equal(result.status, "invalid");
});

test("28. duplicated room ids are normalized with warning", () => {
  const result = Engine.build(briefing({ rooms: [{ id: "a", floor: 1, widthM: 2, lengthM: 2 }, { id: "a", floor: 1, widthM: 2, lengthM: 2 }] }));
  assert.equal(result.rooms[1].id, "a-2");
});

test("29. duplicated opening is not counted twice", () => {
  const result = Engine.build(briefing({
    rooms: [{ id: "sala", floor: 1, widthM: 4, lengthM: 3, openings: { doors: [{ id: "porta-sala", widthM: 1, heightM: 2 }] } }],
    openings: { doors: [{ id: "porta-sala", roomId: "sala", widthM: 1, heightM: 2 }], windows: [], otherOpenings: [] }
  }));
  assert.equal(result.openings.totalAreaM2, 2);
});

test("30. wall net area discounts opening", () => assert.equal(Engine.build(briefing()).rooms[0].geometry.wallNetAreaM2, 40));

test("31. negative wall net area invalidates", () => {
  const result = Engine.build(briefing({ openings: { doors: [{ id: "p", roomId: "sala", widthM: 10, heightM: 10 }], windows: [], otherOpenings: [] } }));
  assert.equal(result.status, "invalid");
});

test("32. opening larger than wall invalidates", () => {
  const result = Engine.build(briefing({ openings: { doors: [{ id: "p", roomId: "sala", widthM: 10, heightM: 10 }], windows: [], otherOpenings: [] } }));
  assert.equal(fields(result.errors).includes("openings.p.totalAreaM2"), true);
});

test("33. floor zero invalidates", () => assert.equal(Engine.build(briefing({ rooms: [{ id: "s", floor: 0, widthM: 2, lengthM: 2 }] })).status, "invalid"));

test("34. floor greater than floorsCount invalidates", () => assert.equal(Engine.build(briefing({ site: { floors: 1 }, rooms: [{ id: "s", floor: 2, widthM: 2, lengthM: 2 }] })).status, "invalid"));

test("35. quantity zero invalidates", () => assert.equal(Engine.build(briefing({ rooms: [{ id: "s", floor: 1, widthM: 2, lengthM: 2, quantity: 0 }] })).status, "invalid"));

test("36. negative dimension invalidates", () => assert.equal(Engine.build(briefing({ rooms: [{ id: "s", floor: 1, widthM: -2, lengthM: 2 }] })).status, "invalid"));

test("37. land smaller than implantation invalidates", () => assert.equal(Engine.build(briefing({ site: { landAreaM2: 10, implantationAreaM2: 24 } })).status, "invalid"));

test("38. occupancy rate is calculated", () => assert.equal(Engine.build(briefing()).site.occupancyRatePercent, 24));

test("39. free site area is calculated", () => assert.equal(Engine.build(briefing()).site.freeAreaM2, 76));

test("40. occupancy above 100 invalidates", () => assert.equal(Engine.build(briefing({ site: { landAreaM2: 20, implantationAreaM2: 24 } })).status, "invalid"));

test("41. sums area by floor", () => assert.equal(Engine.build(briefing()).floors[0].areaM2, 24));

test("42. sums residence area", () => assert.equal(Engine.build(briefing()).building.totalFloorAreaM2, 24));

test("43. sums opening areas", () => assert.equal(Engine.build(briefing()).openings.totalAreaM2, 3));

test("44. divergence within tolerance is accepted", () => assert.equal(Engine.build(briefing({ site: { builtAreaM2: 12.1, implantationAreaM2: 12.1 }, rooms: [{ id: "s", floor: 1, widthM: 4, lengthM: 3, areaM2: 12.1, perimeterM: 14 }], openings: { doors: [], windows: [], otherOpenings: [] } })).status, "complete"));

test("45. medium divergence warns", () => {
  const result = Engine.build(briefing({ rooms: [{ id: "s", floor: 1, widthM: 4, lengthM: 3, areaM2: 12.8, perimeterM: 14 }] }));
  assert.equal(result.warnings.some((item) => item.code === "geometry_divergence_warning"), true);
});

test("46. grave divergence errors", () => {
  const result = Engine.build(briefing({ rooms: [{ id: "s", floor: 1, widthM: 4, lengthM: 3, areaM2: 20, perimeterM: 14 }] }));
  assert.equal(result.errors.some((item) => item.code === "geometry_divergence_error"), true);
});

test("47. built area incompatible with room sum alerts", () => {
  const result = Engine.build(briefing({ site: { builtAreaM2: 40 } }));
  assert.equal(result.warnings.some((item) => item.field === "site.builtAreaM2"), true);
});

test("48. complete occurs with enough geometry", () => assert.equal(Engine.build(briefing()).status, "complete"));

test("49. partial occurs with missing dimensions", () => assert.equal(Engine.build(briefing({ site: { builtAreaM2: 10, implantationAreaM2: 10 }, rooms: [{ id: "s", floor: 1, areaM2: 10 }], openings: { doors: [], windows: [], otherOpenings: [] } })).status, "partial"));

test("50. invalid occurs with blocking geometry error", () => assert.equal(Engine.build(briefing({ site: { floors: 0 } })).status, "invalid"));

test("51. fingerprint is equal for equal input", () => assert.equal(Engine.build(briefing()).audit.geometryFingerprint, Engine.build(briefing()).audit.geometryFingerprint));

test("52. fingerprint changes with geometry", () => assert.notEqual(Engine.build(briefing()).audit.geometryFingerprint, Engine.build(briefing({ rooms: [{ id: "sala", floor: 1, widthM: 5, lengthM: 3 }] })).audit.geometryFingerprint));

test("53. generatedAt does not affect fingerprint", () => {
  const a = Engine.build(briefing(), { generatedAt: "2026-07-13T10:00:00.000Z" });
  const b = Engine.build(briefing(), { generatedAt: "2026-07-13T11:00:00.000Z" });
  assert.equal(a.audit.geometryFingerprint, b.audit.geometryFingerprint);
});

test("54. property order does not affect fingerprint", () => {
  const a = briefing();
  const b = { audit: a.audit, errors: [], warnings: [], blockingFields: [], missingFields: [], defaultedFields: [], derivedFields: [], providedFields: [], assumptions: [], costing: a.costing, fixtures: {}, systems: {}, finishes: {}, openings: a.openings, rooms: a.rooms, program: a.program, building: a.building, site: a.site, project: a.project, status: "complete", version: "1.0.0", schema: "elo.residential_briefing_complete" };
  assert.equal(Engine.build(a).audit.inputFingerprint, Engine.build(b).audit.inputFingerprint);
});

for (const [index, key] of ["quantities", "compositions", "inputs", "prices", "eap", "budget", "pdf"].entries()) {
  test(`${55 + index}. does not generate ${key}`, () => assert.equal(Object.hasOwn(Engine.build(briefing()), key), false));
}

test("62. does not create individual walls", () => assert.equal(Object.hasOwn(Engine.build(briefing()), "walls"), false));

test("63. does not apply loss", () => {
  const a = Engine.build(briefing({ costing: { lossPercent: 0 } })).surfaces.floorAreaM2;
  const b = Engine.build(briefing({ costing: { lossPercent: 50 } })).surfaces.floorAreaM2;
  assert.equal(a, b);
});

test("64. does not apply BDI", () => {
  const a = Engine.build(briefing({ costing: { bdiPercent: 0 } })).surfaces.floorAreaM2;
  const b = Engine.build(briefing({ costing: { bdiPercent: 50 } })).surfaces.floorAreaM2;
  assert.equal(a, b);
});

test("65. does not access network", () => {
  const SafeEngine = loadEngine({ fetch: () => { throw new Error("network"); } });
  assert.equal(SafeEngine.build(briefing()).status, "complete");
});

test("66. does not access localStorage", () => {
  const SafeEngine = loadEngine({ localStorage: { getItem: () => { throw new Error("localStorage"); } } });
  assert.equal(SafeEngine.build(briefing()).status, "complete");
});

test("67. does not access database handles", () => {
  const SafeEngine = loadEngine({ db: { query: () => { throw new Error("db"); } } });
  assert.equal(SafeEngine.build(briefing()).status, "complete");
});

test("68. completeness score is between 0 and 100", () => {
  const score = Engine.build(briefing({ rooms: [{ id: "s", floor: 1 }] })).completeness.score;
  assert.equal(score >= 0 && score <= 100, true);
});

test("69. blocking fields prevent complete", () => {
  const result = Engine.build(briefing({ site: { builtAreaM2: 10, implantationAreaM2: 10 }, rooms: [{ id: "s", floor: 1, areaM2: 10 }], openings: { doors: [], windows: [], otherOpenings: [] } }));
  assert.notEqual(result.status, "complete");
  assert.equal(result.blockingFields.length > 0, true);
});

test("70. errors prevent complete", () => {
  const result = Engine.build(briefing({ rooms: [{ id: "s", floor: 1, widthM: -1, lengthM: 2 }] }));
  assert.notEqual(result.status, "complete");
  assert.equal(result.errors.length > 0, true);
});

test("deriveRoomGeometry public helper derives basic geometry", () => {
  const room = Engine.deriveRoomGeometry({ id: "x", floor: 1, widthM: 2, lengthM: 5 }, { floorsCount: 1, ceilingHeightM: 3 });
  assert.equal(room.geometry.areaM2, 10);
});

test("deriveOpeningGeometry public helper derives basic geometry", () => {
  const opening = Engine.deriveOpeningGeometry({ id: "x", widthM: 2, heightM: 1, quantity: 2 }, { type: "window" });
  assert.equal(opening.totalAreaM2, 4);
});

test("supported geometry fields are exposed as copies", () => {
  const fieldsList = Engine.getSupportedGeometryFields();
  fieldsList.push("fake");
  assert.equal(Engine.getSupportedGeometryFields().includes("fake"), false);
});

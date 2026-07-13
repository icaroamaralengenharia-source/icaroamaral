import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const enginePath = join(repoRoot, "relatorio-qualidade-obras", "elo-residential-briefing-complete-engine.js");

function loadEngine() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  sandbox.self = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(enginePath, "utf8"), sandbox, { filename: enginePath });
  return sandbox.window.ResidentialBriefingCompleteEngine;
}

const Engine = loadEngine();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDeep(base, overrides) {
  const output = clone(base);

  function assign(target, source) {
    for (const [key, value] of Object.entries(source || {})) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key])
      ) {
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
  name: "Casa Alfa",
  description: "Residencia terrea padrao medio",
  city: " salvador ",
  uf: "ba",
  referenceMonth: "7/2026",
  priceSource: "sinapi",
  priceRegime: "desonerado",
  areaConstruida: "120,50 m2",
  landAreaM2: "300,00",
  floors: 1,
  padrao: "medio",
  peDireito: "2,80",
  estrutura: "concreto armado",
  fundacao: "sapatas",
  cobertura: "telha ceramica",
  wallSystem: "bloco ceramico",
  bedrooms: 3,
  suites: 1,
  bathrooms: 2,
  livingRooms: 1,
  kitchens: 1,
  serviceAreas: 1,
  rooms: [{ name: "Quarto casal", type: "quarto", floor: 1, widthM: "3,00", lengthM: "4,00" }],
  openings: {
    doors: [{ widthM: 0.8, heightM: 2.1 }],
    windows: [{ widthM: 1.2, heightM: 1 }],
  },
  finishes: {
    floorDefault: "porcelanato",
    wallDefault: "reboco",
    ceilingDefault: "forro gesso",
    internalPaintDefault: "tinta acrilica",
    externalPaintDefault: "tinta acrilica",
    wetAreaWallHeightM: "1,50",
    skirtingHeightM: "0,07",
  },
  systems: {
    electrical: { premise: "pontos por ambiente" },
    hydraulic: { premise: "banheiros e cozinha" },
    sanitary: { premise: "rede convencional" },
  },
  fixtures: {
    sanitaryFixtures: [{ name: "vaso sanitario", quantity: 2 }],
    faucetsAndMetals: [{ name: "torneira lavatorio", quantity: 2 }],
    countertops: [{ name: "bancada granito", quantity: 1 }],
    glassItems: [{ name: "box vidro", quantity: 1 }],
    accessories: [{ name: "porta toalha", quantity: 2 }],
  },
  bdi: "25",
  lossPercent: "8,5",
};

function completeBriefing(overrides = {}) {
  return mergeDeep(baseBriefing, overrides);
}

function fields(items) {
  return items.map((item) => (typeof item === "string" ? item : item.field));
}

test("exposes public API", () => {
  assert.equal(typeof Engine.build, "function");
  assert.equal(typeof Engine.validate, "function");
  assert.equal(typeof Engine.normalize, "function");
  assert.equal(typeof Engine.getRequiredFields, "function");
  assert.equal(typeof Engine.getSupportedFields, "function");
  assert.equal(Engine.getVersion(), "1.0.0");
});

test("builds complete canonical briefing", () => {
  const result = Engine.build(completeBriefing());
  assert.equal(result.status, "complete");
  assert.equal(result.schema, "elo.residential_briefing_complete");
  assert.equal(result.project.city, "Salvador");
});

for (const forbidden of ["quantities", "compositions", "prices", "priceItems", "eap", "budget", "pdf", "pdfBuffer"]) {
  test(`does not generate ${forbidden}`, () => {
    assert.equal(Object.hasOwn(Engine.build(completeBriefing()), forbidden), false);
  });
}

test("normalizes UF", () => assert.equal(Engine.build(completeBriefing({ uf: "sp" })).project.state, "SP"));
test("normalizes city", () => assert.equal(Engine.build(completeBriefing({ city: " feira de santana " })).project.city, "Feira De Santana"));
test("normalizes month-year date", () => assert.equal(Engine.build(completeBriefing({ referenceMonth: "7/2026" })).project.referenceMonth, "2026-07"));
test("keeps ISO reference month", () => assert.equal(Engine.build(completeBriefing({ referenceMonth: "2026-11" })).project.referenceMonth, "2026-11"));
test("normalizes price source", () => assert.equal(Engine.build(completeBriefing({ priceSource: "sinapi" })).project.priceSource, "SINAPI"));
test("normalizes built area", () => assert.equal(Engine.build(completeBriefing({ areaConstruida: "120,50 m2" })).site.builtAreaM2, 120.5));
test("normalizes ceiling height", () => assert.equal(Engine.build(completeBriefing({ peDireito: "2,80" })).building.ceilingHeightM, 2.8));
test("normalizes loss percentage", () => assert.equal(Engine.build(completeBriefing({ lossPercent: "8,5" })).costing.lossPercent, 8.5));
test("normalizes floor count", () => assert.equal(Engine.build(completeBriefing({ floors: "2 pavimentos" })).site.floors, 2));

test("accepts Portuguese aliases", () => {
  const result = Engine.build(completeBriefing({ city: undefined, uf: undefined, cidade: "recife", estado: "pe", areaConstruida: "98,25", peDireito: "2,70" }));
  assert.equal(result.project.city, "Recife");
  assert.equal(result.project.state, "PE");
  assert.equal(result.site.builtAreaM2, 98.25);
  assert.equal(result.building.ceilingHeightM, 2.7);
});

test("accepts canonical aliases", () => {
  const result = Engine.build(completeBriefing({ state: "mg", builtAreaM2: 140, ceilingHeightM: 3 }));
  assert.equal(result.project.state, "MG");
  assert.equal(result.site.builtAreaM2, 140);
  assert.equal(result.building.ceilingHeightM, 3);
});

test("derives room area", () => {
  const room = Engine.build(completeBriefing()).rooms[0];
  assert.equal(room.areaM2, 12);
  assert.equal(room.source, "derived");
});

test("derives room perimeter", () => {
  const room = Engine.build(completeBriefing()).rooms[0];
  assert.equal(room.perimeterM, 14);
  assert.equal(Engine.build(completeBriefing()).derivedFields.includes("rooms.quarto-casal.perimeterM"), true);
});

test("keeps provided room area", () => {
  const room = Engine.build(completeBriefing({ rooms: [{ name: "Sala", widthM: 3, lengthM: 4, areaM2: 13 }] })).rooms[0];
  assert.equal(room.areaM2, 13);
  assert.equal(room.source, "provided");
});

test("creates stable room id", () => assert.equal(Engine.build(completeBriefing()).rooms[0].id, "quarto-casal"));

test("deduplicates repeated room ids", () => {
  const result = Engine.build(completeBriefing({ rooms: [{ name: "Quarto", widthM: 3, lengthM: 3 }, { name: "Quarto", widthM: 2, lengthM: 3 }] }));
  const ids = result.rooms.map((room) => room.id).join("|");
  assert.equal(ids, "quarto|quarto-2");
});

test("defaults absent arrays to empty arrays", () => {
  const result = Engine.build(completeBriefing({
    rooms: undefined,
    openings: { doors: undefined, windows: undefined },
    fixtures: { sanitaryFixtures: undefined, faucetsAndMetals: undefined, countertops: undefined, glassItems: undefined, accessories: undefined },
  }));
  assert.equal(result.rooms.length, 0);
  assert.equal(result.openings.doors.length, 0);
  assert.equal(result.openings.windows.length, 0);
  assert.equal(result.fixtures.sanitaryFixtures.length, 0);
});

test("records safe defaults", () => {
  const result = Engine.build(completeBriefing({ country: undefined }));
  assert.equal(result.project.country, "BR");
  assert.equal(result.defaultedFields.includes("project.country"), true);
});

for (const [name, override, field] of [
  ["city", { city: null }, "project.city"],
  ["state", { uf: null }, "project.state"],
  ["reference month", { referenceMonth: null }, "project.referenceMonth"],
  ["price source", { priceSource: null }, "project.priceSource"],
  ["built area", { areaConstruida: null }, "site.builtAreaM2"],
]) {
  test(`reports missing ${name}`, () => {
    const result = Engine.build(completeBriefing(override));
    assert.equal(result.status, "incomplete");
    assert.equal(fields(result.blockingFields).includes(field), true);
  });
}

test("empty strings become null and block completion", () => {
  const result = Engine.build(completeBriefing({ city: "" }));
  assert.equal(result.project.city, null);
  assert.equal(fields(result.blockingFields).includes("project.city"), true);
});

for (const [name, override, field] of [
  ["zero floors", { floors: 0 }, "site.floors"],
  ["negative built area", { areaConstruida: -10 }, "site.builtAreaM2"],
  ["BDI above 100", { bdi: 101 }, "costing.bdiPercent"],
  ["unknown UF", { uf: "XX" }, "project.state"],
  ["bad reference month", { referenceMonth: "2026/99" }, "project.referenceMonth"],
  ["unknown price source", { priceSource: "Tabela X" }, "project.priceSource"],
]) {
  test(`marks ${name} as invalid`, () => {
    const result = Engine.build(completeBriefing(override));
    assert.equal(result.status, "invalid");
    assert.equal(fields(result.invalidFields).includes(field), true);
  });
}

test("marks invalid room dimensions", () => {
  const result = Engine.build(completeBriefing({ rooms: [{ name: "Deposito", widthM: -1, lengthM: 2 }] }));
  assert.equal(result.status, "invalid");
  assert.equal(fields(result.invalidFields).includes("rooms.deposito.widthM"), true);
});

test("marks invalid opening dimensions", () => {
  const result = Engine.build(completeBriefing({ openings: { doors: [{ widthM: 0, heightM: 2.1 }], windows: [] } }));
  assert.equal(result.status, "invalid");
  assert.equal(fields(result.invalidFields).includes("openings.doors.0.widthM"), true);
});

test("warns when suites exceed bedrooms", () => assert.equal(fields(Engine.build(completeBriefing({ bedrooms: 1, suites: 2 })).warnings).includes("program.suites"), true));
test("warns when built area exceeds land area", () => assert.equal(fields(Engine.build(completeBriefing({ areaConstruida: 500, landAreaM2: 100 })).warnings).includes("site.builtAreaM2"), true));

test("validate follows build status rules", () => {
  const result = Engine.validate(completeBriefing({ city: null }));
  assert.equal(result.status, "incomplete");
  assert.equal(fields(result.blockingFields).includes("project.city"), true);
});

test("normalize returns canonical data with canonical status", () => {
  const result = Engine.normalize(completeBriefing());
  assert.equal(result.project.state, "BA");
  assert.equal(result.status, "complete");
});

test("required fields are immutable copies", () => {
  const list = Engine.getRequiredFields();
  list.push("fake.field");
  assert.equal(Engine.getRequiredFields().includes("fake.field"), false);
});

test("supported fields are immutable copies", () => {
  const list = Engine.getSupportedFields();
  list.push("fake.field");
  assert.equal(Engine.getSupportedFields().includes("fake.field"), false);
});

test("fingerprint is stable for equal content", () => {
  assert.equal(Engine.build(completeBriefing()).audit.inputFingerprint, Engine.build(completeBriefing()).audit.inputFingerprint);
});

test("fingerprint changes for relevant content", () => {
  assert.notEqual(Engine.build(completeBriefing({ areaConstruida: 120 })).audit.inputFingerprint, Engine.build(completeBriefing({ areaConstruida: 121 })).audit.inputFingerprint);
});

test("generated timestamp does not affect fingerprint", () => {
  const first = Engine.build(completeBriefing(), { generatedAt: "2026-07-13T10:00:00.000Z" });
  const second = Engine.build(completeBriefing(), { generatedAt: "2026-07-13T11:00:00.000Z" });
  assert.notEqual(first.audit.generatedAt, second.audit.generatedAt);
  assert.equal(first.audit.inputFingerprint, second.audit.inputFingerprint);
});

test("build does not mutate input", () => {
  const input = completeBriefing();
  const before = clone(input);
  Engine.build(input);
  assert.deepEqual(input, before);
});

test("independent builds do not share state", () => {
  const first = Engine.build(completeBriefing());
  first.rooms.push({ name: "mutated" });
  assert.equal(Engine.build(completeBriefing()).rooms.length, 1);
});

test("complete is never emitted with blocking fields", () => {
  const result = Engine.build(completeBriefing({ city: null, uf: null }));
  assert.notEqual(result.status, "complete");
  assert.ok(result.blockingFields.length > 0);
});

test("completeness score reflects missing required fields", () => {
  const result = Engine.build(completeBriefing({ city: null }));
  assert.ok(result.completeness.score < 100);
  assert.equal(result.missingFields.includes("project.city"), true);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadEngine() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-room-requirements-engine.js"), "utf8"), sandbox, { filename: "elo-room-requirements-engine.js" });
  return sandbox.window.EloRoomRequirementsEngine;
}

test("banheiro 2x2,5 nao fecha sem ralo caixa agua esgoto loucas metais impermeabilizacao piso e revestimento", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({
    type: "banheiro",
    text: "Banheiro de 2,00 m x 2,50 m com vaso, lavatÃ³rio e chuveiro."
  });
  assert.equal(result.podeFecharAmbiente, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.pendentes.includes("ralo"));
  assert.ok(result.pendentes.includes("caixa_sifonada"));
  assert.ok(result.pendentes.includes("ponto_agua"));
  assert.ok(result.pendentes.includes("ponto_esgoto"));
  assert.ok(result.pendentes.includes("registro"));
  assert.ok(result.pendentes.includes("impermeabilizacao"));
  assert.ok(result.pendentes.includes("piso"));
  assert.ok(result.pendentes.includes("revestimento_parede"));
});

test("banheiro exige box apenas quando especificado", () => {
  const engine = loadEngine();
  const withoutBox = engine.validateRoom({
    type: "banheiro",
    items: {
      vaso: true,
      lavatorio: true,
      chuveiro: true,
      ralo: true,
      caixa_sifonada: true,
      ponto_agua: true,
      ponto_esgoto: true,
      registro: true,
      impermeabilizacao: true,
      piso: true,
      revestimento_parede: true
    }
  });
  const withBox = engine.validateRoom({ type: "banheiro", box: true, items: withoutBox.encontrados.reduce((acc, item) => Object.assign(acc, { [item]: true }), {}) });
  assert.equal(withoutBox.podeFecharAmbiente, true);
  assert.ok(withBox.pendentes.includes("box"));
});

test("cozinha nao fecha sem pia agua esgoto piso e revestimento molhado", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({
    type: "cozinha",
    text: "Cozinha com torneira."
  });
  assert.equal(result.podeFecharAmbiente, false);
  assert.ok(result.pendentes.includes("pia_cuba"));
  assert.ok(result.pendentes.includes("ponto_agua"));
  assert.ok(result.pendentes.includes("ponto_esgoto"));
  assert.ok(result.pendentes.includes("piso"));
  assert.ok(result.pendentes.includes("revestimento_area_molhada"));
});

test("area de servico nao fecha sem tanque ponto maquina ralo torneira e esgoto", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({
    type: "area_servico",
    text: "Ãrea de serviÃ§o prevista."
  });
  assert.equal(result.podeFecharAmbiente, false);
  assert.ok(result.pendentes.includes("tanque"));
  assert.ok(result.pendentes.includes("ponto_maquina"));
  assert.ok(result.pendentes.includes("ralo"));
  assert.ok(result.pendentes.includes("torneira"));
  assert.ok(result.pendentes.includes("ponto_esgoto"));
});


function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertZeroHydraulic(hydraulic) {
  assert.equal(hydraulic.coldWaterPoints, 0);
  assert.equal(hydraulic.hotWaterPoints, 0);
  assert.equal(hydraulic.sewagePoints, 0);
  assert.equal(hydraulic.floorDrains, 0);
  assert.deepEqual(plain(hydraulic.fixtures), {});
}

test("quarto calcula eletrica e nao gera hidraulica", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({ type: "quarto" });
  assert.deepEqual(plain(result.electrical), {
    lightingPoints: 1,
    switchPoints: 1,
    generalOutletPoints: 4,
    dedicatedOutletPoints: 0,
    specialPoints: 0
  });
  assertZeroHydraulic(result.hydraulic);
});

test("cozinha calcula pontos eletricos e hidraulicos", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({ type: "cozinha" });
  assert.deepEqual(plain(result.electrical), {
    lightingPoints: 1,
    switchPoints: 1,
    generalOutletPoints: 6,
    dedicatedOutletPoints: 2,
    specialPoints: 0
  });
  assert.deepEqual(plain(result.hydraulic), {
    coldWaterPoints: 1,
    hotWaterPoints: 0,
    sewagePoints: 1,
    floorDrains: 0,
    fixtures: { sink: 1 }
  });
});

test("banheiro calcula iluminacao tomada agua esgoto ralo e fixtures", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({ type: "banheiro" });
  assert.deepEqual(plain(result.electrical), {
    lightingPoints: 1,
    switchPoints: 1,
    generalOutletPoints: 1,
    dedicatedOutletPoints: 0,
    specialPoints: 0
  });
  assert.deepEqual(plain(result.hydraulic), {
    coldWaterPoints: 3,
    hotWaterPoints: 0,
    sewagePoints: 3,
    floorDrains: 1,
    fixtures: { toilet: 1, washbasin: 1, shower: 1 }
  });
});

test("lavabo nao inclui chuveiro", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({ type: "lavabo" });
  assert.deepEqual(plain(result.hydraulic), {
    coldWaterPoints: 2,
    hotWaterPoints: 0,
    sewagePoints: 2,
    floorDrains: 0,
    fixtures: { toilet: 1, washbasin: 1 }
  });
  assert.equal(result.hydraulic.fixtures.shower, undefined);
});

test("area de servico calcula tanque maquina ralo e TUE", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({ type: "area de servico" });
  assert.deepEqual(plain(result.electrical), {
    lightingPoints: 1,
    switchPoints: 1,
    generalOutletPoints: 2,
    dedicatedOutletPoints: 1,
    specialPoints: 0
  });
  assert.deepEqual(plain(result.hydraulic), {
    coldWaterPoints: 2,
    hotWaterPoints: 0,
    sewagePoints: 2,
    floorDrains: 1,
    fixtures: { tank: 1, washingMachine: 1 }
  });
});

test("garagem calcula eletrica basica e nao gera hidraulica", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({ type: "garagem" });
  assert.deepEqual(plain(result.electrical), {
    lightingPoints: 1,
    switchPoints: 1,
    generalOutletPoints: 1,
    dedicatedOutletPoints: 0,
    specialPoints: 0
  });
  assertZeroHydraulic(result.hydraulic);
});

test("agua quente permanece zero por padrao em todos os ambientes com regra", () => {
  const engine = loadEngine();
  ["quarto", "sala", "cozinha", "banheiro", "lavabo", "area_servico", "garagem", "varanda", "circulacao", "escritorio", "escada"].forEach((type) => {
    assert.equal(engine.validateRoom({ type }).hydraulic.hotWaterPoints, 0, type);
  });
});

test("validateRooms consolida a soma dos ambientes", () => {
  const engine = loadEngine();
  const result = engine.validateRooms({
    rooms: [
      { type: "quarto" },
      { type: "cozinha" },
      { type: "banheiro" },
      { type: "lavabo" },
      { type: "area_servico" },
      { type: "garagem" }
    ]
  });
  assert.equal(result.rooms.length, 6);
  assert.deepEqual(plain(result.totals.electrical), {
    lightingPoints: 6,
    switchPoints: 6,
    generalOutletPoints: 15,
    dedicatedOutletPoints: 3,
    specialPoints: 0
  });
  assert.deepEqual(plain(result.totals.hydraulic), {
    coldWaterPoints: 8,
    hotWaterPoints: 0,
    sewagePoints: 8,
    floorDrains: 2,
    fixtures: {
      sink: 1,
      toilet: 2,
      washbasin: 2,
      shower: 1,
      tank: 1,
      washingMachine: 1
    }
  });
  assert.ok(result.assumptions.includes("Agua quente considerada zero por padrao."));
});

test("ambiente desconhecido nao quebra o motor e gera aviso", () => {
  const engine = loadEngine();
  const result = engine.validateRooms({ rooms: [{ type: "atelier" }] });
  assert.equal(result.rooms[0].status, "sem_regra");
  assert.deepEqual(plain(result.totals.electrical), {
    lightingPoints: 0,
    switchPoints: 0,
    generalOutletPoints: 0,
    dedicatedOutletPoints: 0,
    specialPoints: 0
  });
  assertZeroHydraulic(result.totals.hydraulic);
  assert.equal(result.warnings.length, 1);
});


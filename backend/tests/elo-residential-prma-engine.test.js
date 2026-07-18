import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadEngine() {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox.window;
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-residential-prma-engine.js"), "utf8"), sandbox, { filename: "elo-residential-prma-engine.js" });
  return sandbox.window.EloResidentialPrmaEngine;
}

function build(areaM2, program) {
  return loadEngine().build({ areaM2, program });
}

test("PRMA V1 expõe nome publico versao e retorno estruturado", () => {
  const engine = loadEngine();
  const pack = engine.build({ areaM2: 80 });
  assert.equal(engine.PRMA_VERSION, "1.0");
  assert.equal(pack.version, "1.0");
  assert.equal(pack.profileName, "Pacote Residencial Minimo Automatico da Ícaro Amaral Engenharia");
  assert.equal(pack.applied, true);
  assert.ok(pack.fixedResidentialPackage.length > 10);
  assert.ok(Object.keys(pack.roomPackages).length >= 7);
  assert.ok(Object.keys(pack.equipmentPackages).length >= 5);
  assert.ok(pack.scalableQuantities.length > 10);
  assert.ok(pack.conditionalItems.length > 10);
});

test("Casa de 60 m2 ativa Faixa A com programa compacto", () => {
  const pack = build(60);
  assert.equal(pack.areaBand.id, "A");
  assert.equal(pack.assumedProgram.bedrooms, 2);
  assert.equal(pack.assumedProgram.suites, 0);
  assert.equal(pack.assumedProgram.bathrooms, 1);
  assert.equal(pack.assumedProgram.serviceAreas, 1);
});

test("Casa de 80 m2 ativa Faixa B", () => {
  const pack = build(80);
  assert.equal(pack.areaBand.id, "B");
  assert.equal(pack.assumedProgram.bedrooms, 3);
  assert.equal(pack.assumedProgram.suites, 1);
  assert.equal(pack.assumedProgram.bathrooms, 2);
  assert.equal(pack.assumedProgram.garages, 1);
});

test("Casa de 100 m2 usa o mesmo nucleo da casa de 80 m2", () => {
  const casa80 = build(80).assumedProgram;
  const casa100 = build(100).assumedProgram;
  ["livingRooms", "diningAreas", "kitchens", "serviceAreas", "bedrooms", "suites", "bathrooms", "garages"].forEach((key) => {
    assert.equal(casa100[key], casa80[key], key);
  });
});

test("Casa de 130 m2 mantem nucleo e amplia por escala, sem novo banheiro automatico", () => {
  const pack = build(130);
  assert.equal(pack.areaBand.id, "C");
  assert.equal(pack.assumedProgram.bedrooms, 3);
  assert.equal(pack.assumedProgram.suites, 1);
  assert.equal(pack.assumedProgram.bathrooms, 2);
  assert.ok(pack.scalableQuantities.some((item) => item.id === "fundacao" && item.quantityClass === "PER_AREA"));
  assert.ok(pack.assumptions.some((item) => /amplia primeiro os ambientes existentes/i.test(item)));
});

test("Toda residencia recebe pelo menos 1 banheiro", () => {
  assert.equal(build(60, { bathrooms: 0 }).assumedProgram.bathrooms, 1);
});

test("Banheiro gera pacote completo", () => {
  const bathroom = build(80).roomPackages.banheiro_completo;
  assert.equal(bathroom.quantityClass, "PER_ROOM");
  assert.equal(bathroom.counts.generalOutlets, 2);
  assert.equal(bathroom.counts.outletLoadVA, 600);
  assert.equal(bathroom.counts.lightingPoints, 2);
  assert.equal(bathroom.counts.electricShowerW, 7500);
  assert.equal(bathroom.counts.dedicatedShowerCircuit, true);
  assert.ok(bathroom.items.includes("box ou kit preliminar"));
});

test("Pacotes por ambiente possuem tomadas minimas do PRMA", () => {
  const rooms = build(80).roomPackages;
  assert.equal(rooms.sala_estar.counts.generalOutlets, 8);
  assert.equal(rooms.sala_jantar.counts.generalOutlets, 4);
  assert.equal(rooms.quarto_comum.counts.generalOutlets, 6);
  assert.equal(rooms.dormitorio_suite.counts.generalOutlets, 7);
});

test("Cozinha recebe 10 tomadas com 4 gerais e 6 especiais", () => {
  const kitchen = build(80).roomPackages.cozinha;
  assert.equal(kitchen.counts.totalOutlets, 10);
  assert.equal(kitchen.counts.generalOutlets, 4);
  assert.equal(kitchen.counts.dedicatedOutlets, 6);
});

test("Area de servico recebe tanque agua esgoto ralo e tomadas", () => {
  const service = build(80).roomPackages.area_servico;
  assert.ok(service.items.includes("tanque"));
  assert.ok(service.items.includes("agua do tanque"));
  assert.ok(service.items.includes("esgoto do tanque"));
  assert.equal(service.counts.floorDrains, 1);
  assert.equal(service.counts.serviceOutlets, 1);
  assert.equal(service.counts.dedicatedWasherOutlet, 1);
});

test("Varanda recebe ponto duplo", () => {
  assert.equal(build(130).roomPackages.varanda.counts.doubleOutlets, 1);
});

test("Pacote fixo inclui entrada quadro protecoes aterramento caixas e refletores", () => {
  const fixed = build(100).fixedResidentialPackage;
  const byId = Object.fromEntries(fixed.map((item) => [item.id, item]));
  assert.ok(byId.entrada_energia.items.includes("padrao de entrada"));
  assert.ok(byId.quadro_distribuicao.items.includes("DPS"));
  assert.ok(byId.quadro_distribuicao.items.includes("DR"));
  assert.ok(byId.entrada_energia.items.includes("aterramento"));
  assert.ok(byId.caixas_passagem_fixas.items.includes("8 caixas de passagem de piso ou externas"));
  assert.ok(byId.caixas_passagem_fixas.items.includes("8 caixas de passagem de laje forro ou entre setores"));
  assert.ok(byId.iluminacao_externa.items.includes("1 refletor de 60 W no portao ou acesso"));
});

test("SPDA completo e demais itens sensiveis permanecem condicionais", () => {
  const conditional = build(80).conditionalItems;
  assert.ok(conditional.some((item) => item.id === "spda_completo" && item.quantityClass === "CONDITIONAL"));
  assert.ok(conditional.some((item) => item.id === "piscina"));
  assert.ok(conditional.some((item) => item.id === "energia_solar"));
});

test("Casa de 100 m2 nao duplica fixos em relacao a 80 m2", () => {
  const fixed80 = build(80).fixedResidentialPackage.map((item) => item.id);
  const fixed100 = build(100).fixedResidentialPackage.map((item) => item.id);
  assert.deepEqual([...fixed100], [...fixed80]);
  assert.equal(fixed100.filter((id) => id === "entrada_energia").length, 1);
  assert.equal(fixed100.filter((id) => id === "quadro_distribuicao").length, 1);
  assert.equal(fixed100.filter((id) => id === "hidraulica_geral").length, 1);
});

test("Programa informado pelo usuario vence o programa automatico", () => {
  const pack = build(80, { bedrooms: 1, suites: 0, bathrooms: 1, garages: 0, balconies: 1 });
  assert.equal(pack.assumedProgram.bedrooms, 1);
  assert.equal(pack.assumedProgram.suites, 0);
  assert.equal(pack.assumedProgram.bathrooms, 1);
  assert.equal(pack.assumedProgram.garages, 0);
  assert.equal(pack.assumedProgram.balconies, 1);
});

test("PRMA nao duplica banheiro de suite", () => {
  const pack = build(80, { suites: 1, bathrooms: 2 });
  assert.equal(pack.assumedProgram.suites, 1);
  assert.equal(pack.assumedProgram.bathrooms, 2);
});

test("Classificacoes de quantidade cobrem fixed per-room equipamento area parede perimetro rede e condicional", () => {
  const pack = build(80);
  const classes = new Set([
    ...pack.fixedResidentialPackage.map((item) => item.quantityClass),
    ...Object.values(pack.roomPackages).map((item) => item.quantityClass),
    ...Object.values(pack.equipmentPackages).map((item) => item.quantityClass),
    ...pack.scalableQuantities.map((item) => item.quantityClass),
    ...pack.conditionalItems.map((item) => item.quantityClass)
  ]);
  ["FIXED_PER_HOUSE", "PER_ROOM", "PER_EQUIPMENT", "PER_AREA", "PER_WALL_AREA", "PER_PERIMETER", "PER_NETWORK_LENGTH", "CONDITIONAL"].forEach((name) => assert.ok(classes.has(name), name));
});

test("Area fora das faixas PRMA V1 nao aplica pacote", () => {
  const pack = build(45);
  assert.equal(pack.applied, false);
  assert.equal(pack.version, "1.0");
});

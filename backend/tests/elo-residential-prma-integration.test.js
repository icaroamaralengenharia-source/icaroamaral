import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
}

function loadAssistant(options = {}) {
  const sandbox = {
    console,
    navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
    document: { readyState: "complete", addEventListener() {}, body: { dataset: {}, getAttribute() { return ""; } } },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      isSecureContext: true,
      navigator: null,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost", pathname: "/elo.html" },
      localStorage: createStorage({ obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: "Icaro" }) }),
      performance: { mark() {}, now() { return 0; } },
      setTimeout() {},
      fetch() { throw new Error("fetch nao deve ser chamado pelo orcamentista local"); },
      EloBrainRouter: { routeEloBrain() { return null; } },
      EloTechnicalEngine: { buildResponse() { return null; } },
      CompositionSearchEngine: { searchOfficialCompositions() { return []; } }
    }
  };
  sandbox.window.navigator = sandbox.navigator;
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-room-requirements-engine.js"), "utf8"), sandbox, { filename: "elo-room-requirements-engine.js" });
  if (options.withPrma !== false) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-residential-prma-engine.js"), "utf8"), sandbox, { filename: "elo-residential-prma-engine.js" });
  }
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return sandbox.window.EloAssistente;
}

function completeBudget(message, options) {
  const elo = loadAssistant(options);
  if (typeof elo.clearBudgetRecordsForTest === "function") elo.clearBudgetRecordsForTest();
  const first = elo.buildResponseForTest(message);
  if (first && first.fullAnswer && /pode gerar/i.test(first.fullAnswer)) return elo.buildResponseForTest("Pode gerar.");
  return first;
}

function prmaFrom(message, options) {
  const response = completeBudget(message, options);
  const orchestrator = response && response.budgetOrchestratorV2 || {};
  const state = orchestrator.state || {};
  const budgetPackage = orchestrator.budgetPackage || state.budgetPackage || null;
  return { response, state, budgetPackage, prma: state.prma };
}

function countRooms(roomRequirements, type) {
  const rooms = roomRequirements && Array.isArray(roomRequirements.rooms) ? roomRequirements.rooms : [];
  return rooms.filter((room) => room && (room.type || room.roomType || room.tipo || room.ambiente) === type).length;
}

function assertRoomCore(pack, expected) {
  assert.ok(pack.roomRequirements, "roomRequirements ausente");
  assert.equal(pack.roomRequirements.available, true);
  assert.equal(countRooms(pack.roomRequirements, "quarto"), expected.bedrooms);
  assert.equal(countRooms(pack.roomRequirements, "sala"), expected.livingRooms);
  assert.equal(countRooms(pack.roomRequirements, "cozinha"), expected.kitchens);
  assert.equal(countRooms(pack.roomRequirements, "banheiro"), expected.bathrooms);
  assert.equal(countRooms(pack.roomRequirements, "area_servico"), expected.serviceAreas);
}

function hasQuantity(pack, serviceId) {
  return !!(pack && Array.isArray(pack.quantities) && pack.quantities.some((entry) => entry.serviceId === serviceId));
}

function quantityOf(pack, serviceId) {
  const item = pack && Array.isArray(pack.quantities) ? pack.quantities.find((entry) => entry.serviceId === serviceId) : null;
  assert.ok(item, "quantidade ausente: " + serviceId);
  return item.quantity;
}

function electricalTotal(roomRequirements) {
  const electrical = roomRequirements.totals.electrical;
  return Number(electrical.lightingPoints || 0) + Number(electrical.switchPoints || 0) + Number(electrical.generalOutletPoints || 0) + Number(electrical.dedicatedOutletPoints || 0) + Number(electrical.specialPoints || 0);
}

function hydraulicPointTotal(roomRequirements) {
  const hydraulic = roomRequirements.totals.hydraulic;
  return Number(hydraulic.coldWaterPoints || 0) + Number(hydraulic.hotWaterPoints || 0);
}

function sanitaryPointTotal(roomRequirements) {
  const hydraulic = roomRequirements.totals.hydraulic;
  return Number(hydraulic.sewagePoints || 0) + Number(hydraulic.floorDrains || 0);
}

function prmaQuantity(pack, serviceId) {
  const items = pack && Array.isArray(pack.quantities) ? pack.quantities.filter((entry) => entry.serviceId === serviceId && entry.source === "prma") : [];
  assert.equal(items.length, 1, serviceId + " deve aparecer uma vez como PRMA");
  assert.ok(items[0].classification, serviceId + " sem classification");
  return items[0];
}

function prmaItems(pack) {
  return pack && Array.isArray(pack.quantities) ? pack.quantities.filter((entry) => entry.source === "prma") : [];
}

const BASE = "Quero orcamento residencial preliminar para casa terrea de AREA m2 em Salvador/BA, padrao medio, estrutura convencional, cobertura em telha ceramica e piso ceramico.";
function areaMessage(area, suffix = "") {
  return BASE.replace("AREA", String(area)) + (suffix ? " " + suffix : "");
}

test("PRMA integrado ativa Faixa A para casa de 60 m2", () => {
  const { prma, budgetPackage } = prmaFrom(areaMessage(60));
  assert.equal(prma.applied, true);
  assert.equal(prma.areaBand.id, "A");
  assertRoomCore(budgetPackage, { bedrooms: 2, livingRooms: 1, kitchens: 1, bathrooms: 1, serviceAreas: 1 });
});

test("PRMA integrado ativa Faixa B para casa de 80 m2", () => {
  const { prma, budgetPackage } = prmaFrom(areaMessage(80));
  assert.equal(prma.applied, true);
  assert.equal(prma.areaBand.id, "B");
  assertRoomCore(budgetPackage, { bedrooms: 3, livingRooms: 1, kitchens: 1, bathrooms: 2, serviceAreas: 1 });
});

test("PRMA integrado usa em 100 m2 o mesmo nucleo de 80 m2", () => {
  const core80 = prmaFrom(areaMessage(80)).prma.assumedProgram;
  const core100 = prmaFrom(areaMessage(100)).prma.assumedProgram;
  ["livingRooms", "diningAreas", "kitchens", "serviceAreas", "bedrooms", "suites", "bathrooms", "garages"].forEach((key) => {
    assert.equal(core100[key], core80[key], key);
  });
});
test("Room requirements de 100 m2 mantem o mesmo nucleo de 80 m2", () => {
  const pack100 = prmaFrom(areaMessage(100)).budgetPackage;
  assertRoomCore(pack100, { bedrooms: 3, livingRooms: 1, kitchens: 1, bathrooms: 2, serviceAreas: 1 });
});

test("PRMA integrado mantem nucleo em 130 m2", () => {
  const { prma, budgetPackage } = prmaFrom(areaMessage(130));
  assert.equal(prma.applied, true);
  assert.equal(prma.areaBand.id, "C");
  assert.equal(prma.assumedProgram.bedrooms, 3);
  assert.equal(prma.assumedProgram.suites, 1);
  assert.equal(prma.assumedProgram.bathrooms, 2);
  assertRoomCore(budgetPackage, { bedrooms: 3, livingRooms: 1, kitchens: 1, bathrooms: 2, serviceAreas: 1 });
});

test("Area residencial sem programa aplica PRMA", () => {
  const { state, budgetPackage, prma } = prmaFrom(areaMessage(80));
  assert.equal(state.type, "residential");
  assert.equal(prma.applied, true);
  assert.equal(budgetPackage.prma, prma);
  assert.equal(prma.programSources.bedrooms, "prma_assumed");
  assert.equal(prma.programSources.kitchens, "prma_assumed");
});

test("Programa explicito vence PRMA", () => {
  const { prma } = prmaFrom(areaMessage(80, "Com 2 quartos e 1 banheiro."));
  assert.equal(prma.assumedProgram.bedrooms, 2);
  assert.equal(prma.assumedProgram.bathrooms, 1);
  assert.equal(prma.programSources.bedrooms, "explicit");
  assert.equal(prma.programSources.bathrooms, "explicit");
});

test("Programa parcial e complementado sem sobrescrever", () => {
  const { budgetPackage, prma } = prmaFrom(areaMessage(80, "Com 2 quartos e 1 banheiro."));
  assert.equal(prma.assumedProgram.bedrooms, 2);
  assert.equal(prma.assumedProgram.bathrooms, 1);
  assert.equal(prma.assumedProgram.kitchens, 1);
  assert.equal(prma.assumedProgram.livingRooms, 1);
  assert.equal(prma.assumedProgram.serviceAreas, 1);
  assert.equal(prma.programSources.kitchens, "prma_assumed");
  assertRoomCore(budgetPackage, { bedrooms: 2, livingRooms: 1, kitchens: 1, bathrooms: 1, serviceAreas: 1 });
});

test("Banheiro explicito nao e duplicado", () => {
  const { budgetPackage, prma } = prmaFrom(areaMessage(80, "Com 1 suite e 1 banheiro social."));
  assert.equal(prma.assumedProgram.suites, 1);
  assert.equal(prma.assumedProgram.bathrooms, 2);
  assert.equal(countRooms(budgetPackage.roomRequirements, "banheiro"), 2);
});

test("Suite explicita nao e duplicada", () => {
  const { budgetPackage, prma } = prmaFrom(areaMessage(80, "Com 2 suites."));
  assert.equal(prma.assumedProgram.suites, 2);
  assert.equal(countRooms(budgetPackage.roomRequirements, "banheiro"), 2);
});

test("Totais eletricos e hidraulicos refletem ambientes PRMA", () => {
  const pack60 = prmaFrom(areaMessage(60)).budgetPackage;
  const pack80 = prmaFrom(areaMessage(80)).budgetPackage;
  const totals60 = pack60.roomRequirements.totals;
  const totals80 = pack80.roomRequirements.totals;
  assert.ok(totals80.electrical.generalOutletPoints > totals60.electrical.generalOutletPoints);
  assert.ok(totals80.electrical.lightingPoints > totals60.electrical.lightingPoints);
  assert.ok(totals80.hydraulic.coldWaterPoints > totals60.hydraulic.coldWaterPoints);
  assert.ok(totals80.hydraulic.sewagePoints > totals60.hydraulic.sewagePoints);
  assert.ok(totals80.hydraulic.floorDrains > totals60.hydraulic.floorDrains);
});
test("Casa de 80 m2 sem programa usa quantitativos do nucleo PRMA", () => {
  const { budgetPackage } = prmaFrom(areaMessage(80));
  assert.equal(quantityOf(budgetPackage, "esquadrias_portas"), 9);
  assert.equal(quantityOf(budgetPackage, "esquadrias_janelas"), 8);
  assert.equal(quantityOf(budgetPackage, "piso_area_molhada"), 21);
  assert.equal(quantityOf(budgetPackage, "revestimento_areas_molhadas"), 56);
  assert.equal(budgetPackage.installationSummary.metals, 8);
});

test("Casa de 100 m2 usa o mesmo nucleo quantitativo da casa de 80 m2", () => {
  const pack80 = prmaFrom(areaMessage(80)).budgetPackage;
  const pack100 = prmaFrom(areaMessage(100)).budgetPackage;
  ["esquadrias_portas", "esquadrias_janelas", "piso_area_molhada", "revestimento_areas_molhadas"].forEach((serviceId) => {
    assert.equal(quantityOf(pack100, serviceId), quantityOf(pack80, serviceId), serviceId);
  });
  assert.equal(quantityOf(pack100, "contrapiso"), 100);
  assert.equal(quantityOf(pack80, "contrapiso"), 80);
});

test("Casa de 130 m2 mantem nucleo PRMA e cresce nos itens geometricos", () => {
  const pack80 = prmaFrom(areaMessage(80)).budgetPackage;
  const pack130 = prmaFrom(areaMessage(130)).budgetPackage;
  ["esquadrias_portas", "esquadrias_janelas", "piso_area_molhada", "revestimento_areas_molhadas"].forEach((serviceId) => {
    assert.equal(quantityOf(pack130, serviceId), quantityOf(pack80, serviceId), serviceId);
  });
  assert.ok(quantityOf(pack130, "contrapiso") > quantityOf(pack80, "contrapiso"));
  assert.ok(quantityOf(pack130, "alvenaria_externa") > quantityOf(pack80, "alvenaria_externa"));
});

test("Programa parcial preserva quartos banheiros e usa complementos nos quantitativos", () => {
  const { budgetPackage, prma } = prmaFrom(areaMessage(80, "Com 2 quartos e 1 banheiro."));
  assert.equal(prma.assumedProgram.bedrooms, 2);
  assert.equal(prma.assumedProgram.bathrooms, 1);
  assert.equal(quantityOf(budgetPackage, "esquadrias_portas"), 7);
  assert.equal(quantityOf(budgetPackage, "esquadrias_janelas"), 6);
  assert.equal(quantityOf(budgetPackage, "piso_area_molhada"), 16.5);
  assert.equal(quantityOf(budgetPackage, "revestimento_areas_molhadas"), 38);
});

test("Installation summary preserva totais eletricos e hidraulicos do roomRequirements", () => {
  const { budgetPackage } = prmaFrom(areaMessage(80));
  const roomRequirements = budgetPackage.roomRequirements;
  assert.equal(budgetPackage.installationSummary.electricalPoints, electricalTotal(roomRequirements));
  assert.equal(budgetPackage.installationSummary.lightingPoints, roomRequirements.totals.electrical.lightingPoints);
  assert.equal(budgetPackage.installationSummary.hydraulicPoints, hydraulicPointTotal(roomRequirements));
  assert.equal(budgetPackage.installationSummary.sanitaryPoints, sanitaryPointTotal(roomRequirements));
  assert.equal(budgetPackage.installationSummary.showers, 2);
  assert.equal(budgetPackage.installationSummary.sanitaryFixtures, 4);
  assert.equal(budgetPackage.installationSummary.metals, 8);
});

test("Com PRMA ativo itens legados resumidos saem de quantities", () => {
  const { budgetPackage } = prmaFrom(areaMessage(80));
  ["pontos_eletricos", "pontos_iluminacao", "pontos_hidraulicos", "pontos_sanitarios", "chuveiros", "loucas", "metais"].forEach((serviceId) => {
    assert.equal(hasQuantity(budgetPackage, serviceId), false, serviceId);
  });
});

test("PRMA incorpora itens fixos uma unica vez na casa de 80 m2", () => {
  const pack = prmaFrom(areaMessage(80)).budgetPackage;
  [
    "prma_padrao_entrada",
    "prma_quadro_distribuicao",
    "prma_dps",
    "prma_dr",
    "prma_aterramento",
    "prma_reservatorio_1000l",
    "prma_ligacao_agua",
    "prma_saida_esgoto",
    "prma_caixas_passagem_piso",
    "prma_caixas_passagem_laje",
    "prma_refletores_externos",
    "prma_infra_telecom",
    "prma_infra_cameras"
  ].forEach((serviceId) => prmaQuantity(pack, serviceId));
  assert.equal(prmaQuantity(pack, "prma_caixas_passagem_piso").quantity, 8);
  assert.equal(prmaQuantity(pack, "prma_caixas_passagem_laje").quantity, 8);
  assert.equal(prmaQuantity(pack, "prma_refletores_externos").quantity, 3);
});

test("PRMA nao duplica fixos em casas de 100 e 130 m2", () => {
  [100, 130].forEach((area) => {
    const pack = prmaFrom(areaMessage(area)).budgetPackage;
    assert.equal(prmaQuantity(pack, "prma_padrao_entrada").quantity, 1);
    assert.equal(prmaQuantity(pack, "prma_quadro_distribuicao").quantity, 1);
    assert.equal(prmaQuantity(pack, "prma_reservatorio_1000l").quantity, 1);
  });
});

test("PRMA incorpora pacotes por ambiente", () => {
  const pack = prmaFrom(areaMessage(80)).budgetPackage;
  assert.equal(prmaQuantity(pack, "prma_room_sala_estar").quantity, 1);
  assert.equal(prmaQuantity(pack, "prma_room_sala_jantar").quantity, 1);
  assert.equal(prmaQuantity(pack, "prma_room_quarto_comum").quantity, 2);
  assert.equal(prmaQuantity(pack, "prma_room_dormitorio_suite").quantity, 1);
  assert.equal(prmaQuantity(pack, "prma_room_cozinha").quantity, 1);
  assert.equal(prmaQuantity(pack, "prma_room_banheiro_completo").quantity, 2);
  assert.equal(prmaQuantity(pack, "prma_room_area_servico").quantity, 1);
});

test("Pacotes PRMA por ambiente preservam tomadas minimas", () => {
  const pack = prmaFrom(areaMessage(80)).budgetPackage;
  assert.equal(prmaQuantity(pack, "prma_room_sala_estar").inputs.counts.generalOutlets, 8);
  assert.equal(prmaQuantity(pack, "prma_room_sala_jantar").inputs.counts.generalOutlets, 4);
  assert.equal(prmaQuantity(pack, "prma_room_quarto_comum").inputs.counts.generalOutlets, 6);
  assert.equal(prmaQuantity(pack, "prma_room_dormitorio_suite").inputs.counts.generalOutlets, 7);
  assert.equal(prmaQuantity(pack, "prma_room_cozinha").inputs.counts.totalOutlets, 10);
  assert.equal(prmaQuantity(pack, "prma_room_cozinha").inputs.counts.generalOutlets, 4);
  assert.equal(prmaQuantity(pack, "prma_room_cozinha").inputs.counts.dedicatedOutlets, 6);
  assert.equal(prmaQuantity(prmaFrom(areaMessage(130, "Com varanda.")).budgetPackage, "prma_room_varanda").inputs.counts.doubleOutlets, 1);
});

test("Banheiro PRMA gera chuveiro e acessorios minimos", () => {
  const pack = prmaFrom(areaMessage(80)).budgetPackage;
  const bathroom = prmaQuantity(pack, "prma_room_banheiro_completo");
  assert.equal(bathroom.inputs.items.includes("chuveiro"), false);
  assert.ok(bathroom.inputs.items.includes("acessorios"));
  assert.equal(bathroom.inputs.responsibility, "ambiente_e_acessorios_sem_chuveiro_dedicado");
  assert.equal(prmaQuantity(pack, "prma_equip_chuveiro_eletrico").quantity, 2);
  assert.equal(prmaQuantity(pack, "prma_equip_chuveiro_eletrico").inputs.responsibility, "equipamento_e_circuito_dedicado_do_chuveiro");
});

test("Equipamentos PRMA entram como previsao ou reserva", () => {
  const pack = prmaFrom(areaMessage(80)).budgetPackage;
  ["prma_equip_maquina_lavar", "prma_equip_geladeira", "prma_equip_microondas", "prma_equip_forno_eletrico", "prma_equip_cooktop", "prma_equip_coifa_depurador", "prma_equip_lava_loucas_reserva", "prma_equip_ar_condicionado_espera"].forEach((serviceId) => prmaQuantity(pack, serviceId));
  assert.equal(prmaQuantity(pack, "prma_equip_lava_loucas_reserva").inputs.reserveOnly, true);
  assert.equal(prmaQuantity(pack, "prma_equip_ar_condicionado_espera").inputs.providedEquipment, false);
});

test("Itens condicionais PRMA ficam pendentes sem quantidade definida", () => {
  const pack = prmaFrom(areaMessage(80)).budgetPackage;
  assert.ok((pack.blockedServices || []).some((item) => item.serviceId === "prma_cond_spda_completo" && item.source === "prma" && item.classification === "CONDITIONAL"));
  assert.equal(prmaItems(pack).some((item) => item.serviceId === "prma_cond_spda_completo"), false);
});

test("PRMA nao duplica serviceId com itens legados", () => {
  const pack = prmaFrom(areaMessage(80)).budgetPackage;
  const ids = pack.quantities.map((item) => item.serviceId);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(pack.quantities.some((item) => item.source !== "prma" && /^prma_/.test(item.serviceId)), false);
});
test("Sem PRMA aplicado mantem quantitativos legados", () => {
  const { budgetPackage, prma } = prmaFrom(areaMessage(80), { withPrma: false });
  assert.equal(prma.applied, false);
  assert.equal(quantityOf(budgetPackage, "esquadrias_portas"), 5);
  assert.equal(quantityOf(budgetPackage, "esquadrias_janelas"), 5);
  assert.equal(quantityOf(budgetPackage, "piso_area_molhada"), 12.5);
  assert.equal(quantityOf(budgetPackage, "revestimento_areas_molhadas"), 30);
  ["pontos_eletricos", "pontos_iluminacao", "pontos_hidraulicos", "pontos_sanitarios", "chuveiros", "loucas", "metais"].forEach((serviceId) => {
    assert.equal(hasQuantity(budgetPackage, serviceId), true, serviceId);
  });
  assert.equal(budgetPackage.installationSummary, null);
});
test("Sem motor PRMA disponivel preserva fluxo atual e emite warning tecnico", () => {
  const { response, prma } = prmaFrom(areaMessage(80), { withPrma: false });
  assert.ok(response);
  assert.match(String(response.sessionIntent || ""), /^budget_v2/);
  assert.equal(prma.applied, false);
  assert.match(prma.warnings.join("\n"), /Motor PRMA indisponivel/);
});

test("HTML real carrega PRMA antes do assistente", () => {
  [
    join(repoDir, "elo.html"),
    join(repoDir, "relatorio-qualidade-obras", "relatorio-qualidade-obras.html")
  ].forEach((file) => {
    const html = readFileSync(file, "utf8");
    const prmaIndex = html.indexOf("elo-residential-prma-engine.js");
    const assistantIndex = html.indexOf("elo-assistente.js");
    assert.ok(prmaIndex >= 0, file);
    assert.ok(assistantIndex >= 0, file);
    assert.ok(prmaIndex < assistantIndex, file);
  });
});
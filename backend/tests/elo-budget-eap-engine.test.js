import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadWindow(files) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function loadEap() {
  return loadWindow(["elo-budget-eap-engine.js"]).EloBudgetEapEngine;
}

function names(eap) {
  return eap.itens.map((item) => item.nome).join(" | ");
}

function itemByName(eap, name) {
  return eap.itens.find((item) => item.nome === name);
}

function itemByServiceId(eap, serviceId) {
  return eap.itens.find((item) => item.serviceId === serviceId);
}

function prmaQuantity(serviceId, description, quantity = 1, classification = "FIXED_PER_HOUSE", category = "prma_pacote_fixo") {
  return { serviceId, description, category, quantity, unit: "un", source: "prma", classification };
}

function prmaBudgetPackage() {
  return {
    installationSummary: { electricalPoints: 50, lightingPoints: 9, hydraulicPoints: 9, sanitaryPoints: 12, showers: 2, sanitaryFixtures: 4, metals: 8 },
    quantities: [
      prmaQuantity("prma_padrao_entrada", "Padrao de entrada de energia PRMA"),
      prmaQuantity("prma_quadro_distribuicao", "Quadro de distribuicao PRMA"),
      prmaQuantity("prma_dps", "DPS no quadro de distribuicao PRMA"),
      prmaQuantity("prma_dr", "DR no quadro de distribuicao PRMA"),
      prmaQuantity("prma_aterramento", "Aterramento PRMA"),
      prmaQuantity("prma_reservatorio_1000l", "Reservatorio preliminar de 1000 litros PRMA"),
      prmaQuantity("prma_ligacao_agua", "Ligacao de agua PRMA"),
      prmaQuantity("prma_saida_esgoto", "Saida de esgoto PRMA"),
      prmaQuantity("prma_caixas_passagem_piso", "Caixas de passagem de piso PRMA", 8),
      prmaQuantity("prma_caixas_passagem_laje", "Caixas de passagem de laje PRMA", 8),
      prmaQuantity("prma_refletores_externos", "Refletores externos PRMA", 3),
      prmaQuantity("prma_infra_telecom", "Infraestrutura de telecom PRMA"),
      prmaQuantity("prma_infra_cameras", "Infraestrutura para cameras PRMA"),
      prmaQuantity("prma_room_sala_estar", "Pacote PRMA por ambiente - sala_estar", 1, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_room_sala_jantar", "Pacote PRMA por ambiente - sala_jantar", 1, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_room_quarto_comum", "Pacote PRMA por ambiente - quarto_comum", 2, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_room_cozinha", "Pacote PRMA por ambiente - cozinha", 1, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_room_banheiro_completo", "Pacote PRMA por ambiente - banheiro_completo", 2, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_room_area_servico", "Pacote PRMA por ambiente - area_servico", 1, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_equip_chuveiro_eletrico", "Previsao PRMA por equipamento - chuveiro_eletrico", 2, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_maquina_lavar", "Previsao PRMA por equipamento - maquina_lavar", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_geladeira", "Previsao PRMA por equipamento - geladeira", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_microondas", "Previsao PRMA por equipamento - microondas", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_forno_eletrico", "Previsao PRMA por equipamento - forno_eletrico", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_cooktop", "Previsao PRMA por equipamento - cooktop", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_coifa_depurador", "Previsao PRMA por equipamento - coifa_depurador", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_ar_condicionado_espera", "Previsao PRMA por equipamento - ar_condicionado_espera", 4, "PER_EQUIPMENT", "prma_pacote_equipamento")
    ],
    blockedServices: [{ serviceId: "prma_cond_spda_completo", source: "prma", classification: "CONDITIONAL" }]
  };
}
function detailedRoomRequirementsTotals() {
  return {
    electrical: { lightingPoints: 5, switchPoints: 5, generalOutletPoints: 12, dedicatedOutletPoints: 3, specialPoints: 1 },
    hydraulic: {
      coldWaterPoints: 6,
      hotWaterPoints: 0,
      sewagePoints: 5,
      floorDrains: 2,
      fixtures: { toilet: 2, washbasin: 2, shower: 2, sink: 1, tank: 1, washingMachine: 1 }
    }
  };
}

test("casa 80m2 gera EAP com pacotes minimos completos", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({
    tipo: "casa",
    areaConstruidaM2: 80,
    ambientes: { quartos: 2, suites: 1, banheiros: 2, cozinha: 1, areaServico: 1 },
    cobertura: "telha ceramica",
    parede: "bloco ceramico",
    piso: "porcelanato",
    uf: "BA",
    padrao: "medio"
  });
  const text = names(eap);
  assert.match(text, /concreto magro/);
  assert.match(text, /viga baldrame/);
  assert.match(text, /impermeabilizacao do baldrame/);
  assert.match(text, /alvenaria de bloco/);
  assert.match(text, /eletrica embutida/);
  assert.match(text, /telhamento/);
  assert.match(text, /chapisco/);
  assert.match(text, /contrapiso/);
  assert.match(text, /portas internas/);
  assert.match(text, /vaso sanitario por banheiro/);
  assert.match(text, /pintura interna/);
  assert.match(text, /limpeza final/);
  assert.equal(eap.itens.find((item) => item.nome === "vaso sanitario por banheiro").quantidadeBase.valor, 3);
});

test("casa com roomRequirements gera EAP detalhada sem duplicar genericos equivalentes", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({
    tipo: "casa",
    areaConstruidaM2: 80,
    ambientes: { quartos: 2, banheiros: 2, cozinha: 1, areaServico: 1 },
    uf: "BA",
    padrao: "medio",
    budgetPackage: { roomRequirements: { totals: detailedRoomRequirementsTotals() } }
  });

  [
    ["pontos de iluminacao", 5],
    ["interruptores", 5],
    ["tomadas de uso geral", 12],
    ["tomadas de uso especifico", 3],
    ["pontos especiais", 1]
  ].forEach(([name, expected]) => {
    const entry = itemByName(eap, name);
    assert.ok(entry, name);
    assert.equal(entry.etapaId, "instalacoes");
    assert.equal(entry.disciplina, "eletrica");
    assert.equal(entry.quantidadeBase.valor, expected);
  });

  [
    ["pontos de agua fria", 6, "hidraulica"],
    ["pontos de esgoto", 5, "esgoto"],
    ["ralos", 2, "esgoto"]
  ].forEach(([name, expected, discipline]) => {
    const entry = itemByName(eap, name);
    assert.ok(entry, name);
    assert.equal(entry.etapaId, "instalacoes");
    assert.equal(entry.disciplina, discipline);
    assert.equal(entry.quantidadeBase.valor, expected);
  });

  assert.equal(itemByName(eap, "pontos de agua quente"), undefined);

  [
    ["vasos sanitarios", 2],
    ["lavatorios", 2],
    ["chuveiros", 2],
    ["pias", 1],
    ["tanques", 1],
    ["pontos de maquina de lavar", 1]
  ].forEach(([name, expected]) => {
    const entry = itemByName(eap, name);
    assert.ok(entry, name);
    assert.equal(entry.etapaId, "loucas_metais");
    assert.equal(entry.quantidadeBase.valor, expected);
  });

  [
    "eletrica embutida",
    "hidraulica",
    "esgoto sanitario",
    "vaso sanitario por banheiro",
    "lavatorio por banheiro",
    "chuveiro por banheiro",
    "pia/cuba da cozinha",
    "tanque da area de servico quando houver"
  ].forEach((name) => assert.equal(itemByName(eap, name), undefined, name));

  assert.ok(itemByName(eap, "aguas pluviais quando aplicavel"));
  assert.ok(itemByName(eap, "testes"));
  assert.ok(itemByName(eap, "torneira cozinha"));
  assert.ok(itemByName(eap, "registros"));
  assert.equal(eap.itens.filter((item) => item.quantidadeBase && item.quantidadeBase.valor === 0).length, 0);
});

test("casa sem roomRequirements preserva EAP generica antiga", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, ambientes: { banheiros: 2 }, uf: "BA" });
  assert.ok(itemByName(eap, "eletrica embutida"));
  assert.ok(itemByName(eap, "hidraulica"));
  assert.ok(itemByName(eap, "esgoto sanitario"));
  assert.ok(itemByName(eap, "vaso sanitario por banheiro"));
  assert.equal(itemByName(eap, "pontos de iluminacao"), undefined);
});

test("casa com PRMA envia itens detalhados para EAP sem resumos legados", () => {
  const engine = loadEap();
  const budgetPackage = prmaBudgetPackage();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", padrao: "medio", budgetPackage });

  const prmaItems = eap.itens.filter((item) => item.source === "prma");
  const prmaSubitems = prmaItems.filter((item) => item.parentServiceId);
  assert.equal(prmaItems.filter((item) => !item.parentServiceId).length, budgetPackage.quantities.length);
  assert.ok(prmaSubitems.length > 0);

  ["prma_padrao_entrada", "prma_quadro_distribuicao", "prma_dps", "prma_dr", "prma_aterramento"].forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.source, "prma");
    assert.equal(entry.quantidadeBase.valor, 1);
    assert.ok(entry.classification);
  });

  ["prma_room_sala_estar", "prma_room_quarto_comum", "prma_room_cozinha", "prma_room_banheiro_completo", "prma_room_area_servico"].forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.source, "prma");
    assert.equal(entry.classification, "PER_ROOM");
  });

  const reservoir = itemByServiceId(eap, "prma_reservatorio_1000l");
  assert.ok(reservoir);
  assert.equal(reservoir.compositionPolicy, "AUTO_RESOLVE");
  assert.equal(reservoir.compositionStatus, "auto_resolve");
  assert.equal(reservoir.compositionSearchable, true);
  assert.deepEqual(Array.from(reservoir.termosBusca), ["caixa d agua 1000 litros fornecimento instalacao"]);

  const shower = itemByServiceId(eap, "prma_equip_chuveiro_eletrico");
  const bathroom = itemByServiceId(eap, "prma_room_banheiro_completo");
  assert.ok(shower);
  assert.ok(bathroom);
  assert.equal(shower.classification, "PER_EQUIPMENT");
  assert.notEqual(shower.id, bathroom.id);

  ["prma_padrao_entrada", "prma_quadro_distribuicao", "prma_dps", "prma_aterramento", "prma_caixas_passagem_piso", "prma_caixas_passagem_laje", "prma_refletores_externos", "prma_room_quarto_comum", "prma_room_banheiro_completo", "prma_equip_chuveiro_eletrico", "prma_equip_maquina_lavar", "prma_equip_geladeira", "prma_equip_microondas", "prma_equip_forno_eletrico", "prma_equip_cooktop", "prma_equip_coifa_depurador"].forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.compositionPolicy, "DECOMPOSE_REQUIRED", serviceId);
    assert.equal(entry.compositionStatus, "decompose_required", serviceId);
    assert.equal(entry.compositionSearchable, false, serviceId);
    assert.equal(entry.obrigatorio, false, serviceId);
    assert.deepEqual(Array.from(entry.termosBusca), [serviceId, "decompose_required"], serviceId);
  });

  ["prma_dr", "prma_infra_telecom", "prma_infra_cameras", "prma_equip_ar_condicionado_espera"].forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.compositionPolicy, "KEEP_PENDING", serviceId);
    assert.equal(entry.compositionStatus, "pending", serviceId);
    assert.equal(entry.compositionSearchable, false, serviceId);
    assert.equal(entry.obrigatorio, false, serviceId);
    assert.deepEqual(Array.from(entry.termosBusca), [serviceId, "pending"], serviceId);
  });

  [
    ["prma_caixas_passagem_piso_caixa_passagem_piso", "prma_caixas_passagem_piso", 8],
    ["prma_caixas_passagem_laje_caixa_passagem_laje_forro", "prma_caixas_passagem_laje", 8],
    ["prma_refletores_externos_refletor_led_60w", "prma_refletores_externos", 3],
    ["prma_refletores_externos_ponto_eletrico_refletor", "prma_refletores_externos", 3]
  ].forEach(([serviceId, parentServiceId, expected]) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.parentServiceId, parentServiceId);
    assert.equal(entry.source, "prma");
    assert.equal(entry.quantity, undefined);
    assert.equal(entry.quantidadeBase.valor, expected, serviceId);
  });

  const pendingValidationElectricalSubitems = [
    "prma_padrao_entrada_caixa_medicao",
    "prma_padrao_entrada_disjuntor_entrada",
    "prma_padrao_entrada_haste_aterramento",
    "prma_padrao_entrada_caixa_inspecao",
    "prma_quadro_distribuicao_quadro_distribuicao",
    "prma_quadro_distribuicao_barramento_neutro",
    "prma_quadro_distribuicao_barramento_terra",
    "prma_quadro_distribuicao_trilho_din",
    "prma_dps_dps",
    "prma_aterramento_haste_aterramento",
    "prma_aterramento_caixa_inspecao",
    "prma_aterramento_conector_aterramento",
    "prma_caixas_passagem_piso_caixa_passagem_piso",
    "prma_caixas_passagem_laje_caixa_passagem_laje_forro",
    "prma_refletores_externos_refletor_led_60w",
    "prma_refletores_externos_ponto_eletrico_refletor"
  ];
  pendingValidationElectricalSubitems.forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.parentServiceId ? true : false, true, serviceId);
    assert.equal(entry.compositionSearchable, false, serviceId);
    assert.equal(entry.compositionStatus, "pending_validation", serviceId);
    assert.equal(entry.compositionPolicy, "KEEP_PENDING", serviceId);
    assert.equal(entry.obrigatorio, false, serviceId);
    assert.deepEqual(Array.from(entry.termosBusca), [serviceId, "pending_validation"], serviceId);
    assert.equal(entry.composicaoSelecionada, undefined, serviceId);
    assert.equal(entry.price, undefined, serviceId);
  });
  ["prma_padrao_entrada_caixa_medicao", "prma_padrao_entrada_disjuntor_entrada", "prma_padrao_entrada_haste_aterramento", "prma_padrao_entrada_caixa_inspecao", "prma_quadro_distribuicao_quadro_distribuicao", "prma_quadro_distribuicao_barramento_neutro", "prma_quadro_distribuicao_barramento_terra", "prma_quadro_distribuicao_trilho_din", "prma_dps_dps", "prma_aterramento_haste_aterramento", "prma_aterramento_caixa_inspecao", "prma_aterramento_conector_aterramento"].forEach((serviceId) => {
    assert.equal(itemByServiceId(eap, serviceId).quantidadeBase.valor, 1, serviceId);
  });

  ["prma_padrao_entrada_eletroduto_entrada", "prma_padrao_entrada_condutores_ramal", "prma_padrao_entrada_aterramento_padrao", "prma_padrao_entrada_estrutura_civil_suporte", "prma_quadro_distribuicao_reserva_tecnica", "prma_aterramento_condutor_protecao"].forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.parentServiceId ? true : false, true, serviceId);
    assert.equal(entry.compositionSearchable, false, serviceId);
    assert.equal(entry.compositionStatus, "pending", serviceId);
    assert.equal(entry.quantidadeBase, null, serviceId);
  });

  ["prma_padrao_entrada_haste_aterramento", "prma_padrao_entrada_caixa_inspecao", "prma_aterramento_haste_aterramento", "prma_aterramento_caixa_inspecao"].forEach((serviceId) => {
    const warnings = itemByServiceId(eap, serviceId).technicalWarnings || [];
    assert.ok(warnings.includes("Confirmar se o padr\u00e3o de entrada e o aterramento geral compartilham o mesmo conjunto antes da precifica\u00e7\u00e3o."), serviceId);
  });

  const circuitIdentification = itemByServiceId(eap, "prma_quadro_distribuicao_identificacao_circuitos");
  assert.ok(circuitIdentification);
  assert.equal(circuitIdentification.compositionSearchable, false);
  assert.equal(circuitIdentification.compositionStatus, "pending");
  assert.equal(circuitIdentification.quantidadeBase.valor, 1);

  ["prma_padrao_entrada", "prma_quadro_distribuicao", "prma_dps", "prma_aterramento", "prma_caixas_passagem_piso", "prma_caixas_passagem_laje", "prma_refletores_externos"].forEach((serviceId) => {
    assert.equal(eap.itens.filter((item) => item.serviceId === serviceId).length, 1, serviceId);
    assert.ok(prmaSubitems.some((item) => item.parentServiceId === serviceId), serviceId);
    assert.equal(itemByServiceId(eap, serviceId).compositionSearchable, false, serviceId);
  });

  const resolver = loadWindow(["elo-composition-resolver.js"]).EloCompositionResolver;
  const calls = [];
  const fakeSearch = { searchOfficialCompositions(query, options) { calls.push({ query, unit: options.unit }); return { found: true, candidates: [{ code: "ok", description: query, unit: options.unit, source: "SINAPI", score: 0.99 }] }; } };
  const resolution = resolver.resolveEloEapCompositions({ eap: { bloqueadores: [], itens: eap.itens.filter((item) => item.source === "prma") }, compositionSearchEngine: fakeSearch });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls.map((call) => call.query), ["caixa d agua 1000 litros fornecimento instalacao"]);
  pendingValidationElectricalSubitems.forEach((serviceId) => {
    const item = resolution.unresolvedItems.find((entry) => entry.eapItemId === "prma_" + serviceId);
    assert.ok(item, serviceId);
    assert.equal(item.searchSkippedReason, "composition_search_disabled", serviceId);
    assert.equal(item.composicaoSelecionada, null, serviceId);
    assert.equal(item.candidatos.length, 0, serviceId);
  });

  ["pontos_eletricos", "pontos_iluminacao", "pontos_hidraulicos", "pontos_sanitarios", "chuveiros", "loucas", "metais"].forEach((serviceId) => assert.equal(itemByServiceId(eap, serviceId), undefined, serviceId));
  ["pontos de iluminacao", "pontos de agua fria", "chuveiros", "vasos sanitarios", "eletrica embutida", "hidraulica", "esgoto sanitario"].forEach((name) => assert.equal(itemByName(eap, name), undefined, name));
  assert.equal(eap.itens.some((item) => /installationSummary|electricalPoints|lightingPoints/.test(JSON.stringify(item))), false);
  assert.equal(itemByServiceId(eap, "prma_cond_spda_completo"), undefined);
});

test("EAP PRMA mantem fixos uma vez em casas 80 100 e 130", () => {
  const engine = loadEap();
  [80, 100, 130].forEach((area) => {
    const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: area, uf: "BA", padrao: "medio", budgetPackage: prmaBudgetPackage() });
    ["prma_padrao_entrada", "prma_quadro_distribuicao", "prma_reservatorio_1000l"].forEach((serviceId) => {
      assert.equal(eap.itens.filter((item) => item.serviceId === serviceId).length, 1, serviceId + " " + area);
      assert.equal(itemByServiceId(eap, serviceId).quantidadeBase.valor, 1);
    });
  });
});

test("EAP sem PRMA preserva comportamento antigo mesmo com installationSummary", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, ambientes: { banheiros: 2 }, uf: "BA", budgetPackage: { installationSummary: { electricalPoints: 50 } } });
  assert.ok(itemByName(eap, "eletrica embutida"));
  assert.ok(itemByName(eap, "hidraulica"));
  assert.ok(itemByName(eap, "esgoto sanitario"));
  assert.equal(eap.itens.some((item) => item.source === "prma"), false);
});
test("casa sem area construida bloqueia orcamento completo", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", ambientes: { banheiros: 1 }, uf: "BA" });
  assert.equal(eap.podeFecharOrcamentoCompleto, false);
  assert.ok(eap.bloqueadores.some((item) => item.id === "area_construida"));
});

test("muro 30 x 2,20 inclui estrutura revestimento pintura e portao citado", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "muro", comprimentoM: 30, alturaM: 2.2, message: "muro com portao metalico" });
  const text = names(eap);
  assert.match(text, /escavacao/);
  assert.match(text, /fundacao\/baldrame/);
  assert.match(text, /forma/);
  assert.match(text, /aco/);
  assert.match(text, /concreto/);
  assert.match(text, /alvenaria/);
  assert.match(text, /chapisco dos dois lados/);
  assert.match(text, /reboco dos dois lados/);
  assert.match(text, /pintura dos dois lados/);
  assert.match(text, /portao metalico/);
  assert.equal(eap.itens.find((item) => item.nome === "alvenaria").quantidadeBase.valor, 66);
});

test("muro sem comprimento ou altura bloqueia orcamento completo", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "muro", comprimentoM: 30 });
  assert.equal(eap.podeFecharOrcamentoCompleto, false);
  assert.ok(eap.bloqueadores.some((item) => item.id === "altura_muro"));
});

test("banheiro 2x2,5 inclui reforma completa minima", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "banheiro", larguraM: 2, profundidadeM: 2.5 });
  const text = names(eap);
  assert.match(text, /demolicao de revestimento/);
  assert.match(text, /transporte\/entulho/);
  assert.match(text, /impermeabilizacao/);
  assert.match(text, /piso/);
  assert.match(text, /revestimento de parede/);
  assert.match(text, /vaso sanitario/);
  assert.match(text, /lavatorio/);
  assert.match(text, /chuveiro/);
  assert.match(text, /ralo/);
  assert.match(text, /caixa sifonada/);
  assert.match(text, /ponto de agua/);
  assert.match(text, /ponto de esgoto/);
  assert.match(text, /eletrica minima/);
  assert.match(text, /pintura de teto/);
  assert.match(text, /limpeza final/);
  assert.equal(eap.itens.find((item) => item.nome === "piso").quantidadeBase.valor, 5);
});

test("banheiro sem dimensoes bloqueia orcamento completo", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "banheiro" });
  assert.equal(eap.podeFecharOrcamentoCompleto, false);
  assert.ok(eap.bloqueadores.some((item) => item.id === "dimensoes_banheiro"));
});

test("nenhuma EAP com bloqueador fecha orcamento completo", () => {
  const engine = loadEap();
  [
    engine.buildEloBudgetEap({ tipo: "casa" }),
    engine.buildEloBudgetEap({ tipo: "muro" }),
    engine.buildEloBudgetEap({ tipo: "banheiro" })
  ].forEach((eap) => {
    assert.ok(eap.bloqueadores.length > 0);
    assert.equal(eap.podeFecharOrcamentoCompleto, false);
  });
});

test("BudgetEngine inclui budgetEap em modo leitura sem quebrar orcamento preliminar", () => {
  const win = loadWindow([
    "stock-ai-composition-engine.js",
    "composition-search-engine.js",
    "elo-budget-eap-engine.js",
    "elo-work-package-engine.js",
    "elo-quantity-engine.js",
    "elo-consumption-engine.js",
    "elo-budget-table-engine.js",
    "elo-budget-engine.js"
  ]);
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({
    originalMessage: "casa terrea 80m2 com 2 banheiros, cozinha e area de servico",
    builtAreaM2: 80,
    bathrooms: 2
  }, {});
  assert.equal(budget.mode, "preliminary_budget");
  assert.ok(budget.budgetEap);
  assert.ok(budget.budgetEap.itens.length > 20);
  assert.equal(budget.budgetEap.podeFecharOrcamentoCompleto, false);
});

const BATHROOM_ATOMIC_EXPECTATIONS = [
  ["vaso_sanitario", 1, "loucas_metais", "loucas_metais"], ["caixa_descarga", 1, "loucas_metais", "loucas_metais"], ["assento_sanitario", 1, "loucas_metais", "loucas_metais"],
  ["lavatorio_cuba", 1, "loucas_metais", "loucas_metais"], ["torneira_lavatorio", 1, "loucas_metais", "loucas_metais"], ["valvula_lavatorio", 1, "loucas_metais", "loucas_metais"],
  ["sifao", 1, "loucas_metais", "loucas_metais"], ["engate_flexivel", 1, "loucas_metais", "loucas_metais"], ["registro_pressao", 1, "loucas_metais", "loucas_metais"], ["acabamento_registro", 1, "loucas_metais", "loucas_metais"],
  ["porta_papel", 1, "loucas_metais", "loucas_metais"], ["saboneteira", 1, "loucas_metais", "loucas_metais"], ["porta_toalha_rosto", 1, "loucas_metais", "loucas_metais"],
  ["porta_toalha_banho", 1, "loucas_metais", "loucas_metais"], ["cabide", 1, "loucas_metais", "loucas_metais"], ["espelho", 1, "loucas_metais", "loucas_metais"], ["box_preliminar", 1, "loucas_metais", "loucas_metais"],
  ["agua_fria_vaso", 1, "hidraulica", "instalacoes"], ["agua_fria_lavatorio", 1, "hidraulica", "instalacoes"], ["agua_fria_chuveiro", 1, "hidraulica", "instalacoes"],
  ["esgoto_vaso", 1, "esgoto", "instalacoes"], ["esgoto_lavatorio", 1, "esgoto", "instalacoes"], ["esgoto_area_banho", 1, "esgoto", "instalacoes"],
  ["ralo", 1, "esgoto", "instalacoes"], ["caixa_sifonada", 1, "esgoto", "instalacoes"],
  ["iluminacao_central", 1, "eletrica", "instalacoes"], ["iluminacao_espelho", 1, "eletrica", "instalacoes"], ["interruptor", 1, "eletrica", "instalacoes"],
  ["tomada_600va", 2, "eletrica", "instalacoes"], ["caixa_espelho_tomada", 2, "eletrica", "instalacoes"]
];

function bathroomPrmaBudgetPackage(bathrooms) {
  return {
    installationSummary: { electricalPoints: 999, lightingPoints: 999, hydraulicPoints: 999, sanitaryPoints: 999, showers: 999, sanitaryFixtures: 999, metals: 999 },
    quantities: [
      prmaQuantity("prma_room_banheiro_completo", "Pacote PRMA por ambiente - banheiro_completo", bathrooms, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_equip_chuveiro_eletrico", "Previsao PRMA por equipamento - chuveiro_eletrico", bathrooms, "PER_EQUIPMENT", "prma_pacote_equipamento")
    ]
  };
}

function assertBathroomPrmaDecomposition(eap, bathrooms) {
  const parentServiceId = "prma_room_banheiro_completo";
  const kitServiceId = "prma_room_banheiro_completo_kit_vaso_sanitario_caixa_acoplada";
  const lavatoryKitServiceId = "prma_room_banheiro_completo_kit_lavatorio";
  const absorbedIds = [
    "prma_room_banheiro_completo_vaso_sanitario",
    "prma_room_banheiro_completo_caixa_descarga",
    "prma_room_banheiro_completo_engate_flexivel"
  ];
  const parentItems = eap.itens.filter((item) => item.serviceId === parentServiceId);
  assert.equal(parentItems.length, 1);
  assert.equal(parentItems[0].compositionSearchable, false);
  assert.equal(parentItems[0].compositionStatus, "decompose_required");
  const children = eap.itens.filter((item) => item.parentServiceId === parentServiceId);
  const kit = itemByServiceId(eap, kitServiceId);
  const lavatoryKit = itemByServiceId(eap, lavatoryKitServiceId);
  assert.ok(kit);
  assert.ok(lavatoryKit);
  assert.equal(kit.quantidadeBase.valor, bathrooms);
  assert.equal(kit.quantidadeBase.unidade, "un");
  assert.equal(kit.source, "prma");
  assert.equal(kit.compositionSearchable, false);
  assert.equal(kit.compositionStatus, "pending_selection");
  assert.deepEqual(Array.from(kit.officialCandidates).map((candidate) => candidate.code), ["86931", "86932"]);
  assert.deepEqual(Array.from(kit.absorbedServiceIds), [
    "prma_room_banheiro_completo_vaso_sanitario",
    "prma_room_banheiro_completo_caixa_descarga",
    "prma_room_banheiro_completo_engate_flexivel"
  ]);
  assert.deepEqual(Array.from(kit.technicalAliases), ["prma_room_banheiro_completo_caixa_acoplada_descarga"]);
  assert.equal(lavatoryKit.quantidadeBase.valor, bathrooms);
  assert.equal(lavatoryKit.quantidadeBase.unidade, "un");
  assert.equal(lavatoryKit.compositionSearchable, false);
  assert.equal(lavatoryKit.compositionStatus, "pending_selection");
  assert.deepEqual(Array.from(lavatoryKit.officialCandidates).map((candidate) => candidate.code), ["86939", "86941", "86942", "86943"]);
  assert.deepEqual(Array.from(lavatoryKit.absorbedServiceIds), [
    "prma_room_banheiro_completo_lavatorio_cuba",
    "prma_room_banheiro_completo_torneira_lavatorio",
    "prma_room_banheiro_completo_valvula_lavatorio",
    "prma_room_banheiro_completo_sifao"
  ]);
  assert.deepEqual(Array.from(lavatoryKit.excludedAbsorptionServiceIds), ["prma_room_banheiro_completo_engate_flexivel"]);
  assert.match(lavatoryKit.technicalWarnings.join(" "), /engate flexivel generico/);
  const subitems = children.filter((item) => item.serviceId !== kitServiceId && item.serviceId !== lavatoryKitServiceId);
  assert.equal(subitems.length, 30);
  assert.equal(children.length, 32);
  subitems.forEach((entry) => {
    assert.equal(entry.source, "prma", entry.serviceId);
    assert.equal(entry.classification, "PER_ROOM", entry.serviceId);
    assert.equal(entry.compositionSearchable, false, entry.serviceId);
    assert.equal(entry.compositionStatus, absorbedIds.includes(entry.serviceId) || lavatoryKit.absorbedServiceIds.includes(entry.serviceId) ? "absorbed_by_official_kit" : "pending_validation", entry.serviceId);
    assert.equal(entry.composicaoSelecionada, undefined, entry.serviceId);
    assert.equal(entry.candidatos, undefined, entry.serviceId);
    assert.equal(entry.price, undefined, entry.serviceId);
    assert.equal(entry.preco, undefined, entry.serviceId);
    assert.equal(entry.valorTotal, undefined, entry.serviceId);
  });
  Array.from(lavatoryKit.absorbedServiceIds).forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.equal(entry.absorbedByOfficialKitServiceId, lavatoryKitServiceId, serviceId);
    assert.deepEqual(Array.from(entry.absorbedByOfficialKitCandidates), ["86939", "86941", "86942", "86943"], serviceId);
    assert.equal(entry.price, undefined, serviceId);
    assert.equal(entry.preco, undefined, serviceId);
    assert.equal(entry.valorTotal, undefined, serviceId);
  });
  absorbedIds.forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.equal(entry.absorbedByOfficialKitServiceId, kitServiceId, serviceId);
    assert.deepEqual(Array.from(entry.absorbedByOfficialKitCandidates), ["86931", "86932"], serviceId);
  });
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_assento_sanitario").compositionStatus, "pending_validation");
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_engate_flexivel").absorbedByOfficialKitServiceId, kitServiceId);
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_engate_flexivel").absorbedByOfficialKitServiceId === lavatoryKitServiceId, false);
  BATHROOM_ATOMIC_EXPECTATIONS.forEach(([suffix, perBathroom, discipline, stageId]) => {
    const serviceId = parentServiceId + "_" + suffix;
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.quantidadeBase.valor, perBathroom * bathrooms, serviceId);
    assert.equal(entry.disciplina, discipline, serviceId);
    assert.equal(entry.etapaId, stageId, serviceId);
  });
  assert.equal(subitems.filter((item) => item.disciplina === "hidraulica").reduce((sum, item) => sum + item.quantidadeBase.valor, 0), 3 * bathrooms);
  assert.equal(subitems.filter((item) => /^prma_room_banheiro_completo_esgoto_/.test(item.serviceId)).reduce((sum, item) => sum + item.quantidadeBase.valor, 0), 3 * bathrooms);
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_ralo").quantidadeBase.valor, bathrooms);
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_caixa_sifonada").quantidadeBase.valor, bathrooms);
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_tomada_600va").quantidadeBase.valor, 2 * bathrooms);
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_caixa_espelho_tomada").quantidadeBase.valor, 2 * bathrooms);
  assert.equal(eap.itens.filter((item) => item.serviceId === "prma_equip_chuveiro_eletrico").length, 1);
  assert.equal(subitems.some((item) => /chuveiro_eletrico|circuito|disjuntor|cabo|eletroduto/.test(item.serviceId + " " + item.nome)), false);
  const serviceIds = eap.itens.map((item) => item.serviceId).filter(Boolean);
  assert.equal(new Set(serviceIds).size, serviceIds.length);
  ["pontos_eletricos", "pontos_iluminacao", "pontos_hidraulicos", "pontos_sanitarios", "chuveiros"].forEach((serviceId) => assert.equal(itemByServiceId(eap, serviceId), undefined, serviceId));
}
test("PRMA banheiro completo decompoe 1 banheiro em 30 subitens atomicos", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: bathroomPrmaBudgetPackage(1) });
  assertBathroomPrmaDecomposition(eap, 1);
});

test("PRMA banheiro completo multiplica subitens atomicos para 2 banheiros", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: bathroomPrmaBudgetPackage(2) });
  assertBathroomPrmaDecomposition(eap, 2);
});

test("PRMA banheiro completo marca scopeContext estrutural sem alterar itens nao elegiveis", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: prmaBudgetPackage() });
  const expected = {
    fixture: ["vaso_sanitario", "caixa_descarga", "assento_sanitario", "lavatorio_cuba"],
    metal: ["torneira_lavatorio", "valvula_lavatorio", "sifao", "engate_flexivel", "registro_pressao", "acabamento_registro"],
    accessory: ["porta_papel", "saboneteira", "porta_toalha_rosto", "porta_toalha_banho", "cabide", "espelho", "box_preliminar"]
  };
  Object.entries(expected).forEach(([category, suffixes]) => suffixes.forEach((suffix) => {
    const entry = itemByServiceId(eap, "prma_room_banheiro_completo_" + suffix);
    assert.equal(JSON.stringify(entry.scopeContext), JSON.stringify({ environmentType: "bathroom", category }), entry.serviceId);
    assert.equal(entry.parentServiceId, "prma_room_banheiro_completo", entry.serviceId);
    assert.equal(entry.quantity, undefined, entry.serviceId);
    assert.equal(entry.compositionSearchable, false, entry.serviceId);
  }));
  ["agua_fria_vaso", "agua_fria_lavatorio", "agua_fria_chuveiro", "esgoto_vaso", "esgoto_lavatorio", "esgoto_area_banho", "ralo", "caixa_sifonada", "iluminacao_central", "interruptor", "tomada_600va"].forEach((suffix) => assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_" + suffix).scopeContext, undefined, suffix));
  ["prma_room_banheiro_completo", "prma_room_banheiro_completo_kit_vaso_sanitario_caixa_acoplada", "prma_room_banheiro_completo_kit_lavatorio", "prma_room_cozinha_torneira", "prma_room_area_servico_tanque"].forEach((serviceId) => assert.equal(itemByServiceId(eap, serviceId).scopeContext, undefined, serviceId));
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_kit_vaso_sanitario_caixa_acoplada").compositionStatus, "pending_selection");
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_vaso_sanitario").compositionStatus, "absorbed_by_official_kit");
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_assento_sanitario").quantidadeBase.valor, 2);
  const legacy = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, ambientes: { banheiros: 1 }, uf: "BA" });
  assert.equal(itemByName(legacy, "vaso sanitario por banheiro").scopeContext, undefined);
});

test("EAP sem PRMA continua sem subitens atomicos de banheiro", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, ambientes: { banheiros: 1 }, uf: "BA" });
  assert.equal(eap.itens.some((item) => item.parentServiceId === "prma_room_banheiro_completo"), false);
  assert.ok(itemByName(eap, "vaso sanitario por banheiro"));
  assert.ok(itemByName(eap, "hidraulica"));
  assert.ok(itemByName(eap, "esgoto sanitario"));
});

const KITCHEN_ATOMIC_EXPECTATIONS = [
  ["tomada_600va", 4, "eletrica", "instalacoes"], ["ponto_geladeira", 1, "eletrica", "instalacoes"], ["ponto_microondas", 1, "eletrica", "instalacoes"],
  ["ponto_forno_eletrico", 1, "eletrica", "instalacoes"], ["ponto_cooktop", 1, "eletrica", "instalacoes"], ["ponto_coifa_depurador", 1, "eletrica", "instalacoes"],
  ["ponto_lava_loucas", 1, "eletrica", "instalacoes"], ["iluminacao_central", 1, "eletrica", "instalacoes"], ["iluminacao_bancada", 1, "eletrica", "instalacoes"],
  ["iluminacao_pia_armarios", 1, "eletrica", "instalacoes"], ["interruptor_conjunto", 2, "eletrica", "instalacoes"], ["agua_fria_pia", 1, "hidraulica", "instalacoes"],
  ["esgoto_pia", 1, "esgoto", "instalacoes"], ["registro_setor", 1, "hidraulica", "instalacoes"], ["valvula_pia", 1, "loucas_metais", "loucas_metais"],
  ["sifao", 1, "loucas_metais", "loucas_metais"], ["engate", 2, "loucas_metais", "loucas_metais"], ["ponto_filtro_reserva", 1, "hidraulica", "instalacoes"],
  ["ponto_hidraulico_lava_loucas_reserva", 1, "hidraulica", "instalacoes"], ["ponto_esgoto_lava_loucas_reserva", 1, "esgoto", "instalacoes"],
  ["cuba_pia", 1, "loucas_metais", "loucas_metais"], ["torneira", 1, "loucas_metais", "loucas_metais"]
];

function kitchenPrmaBudgetPackage(kitchens) {
  return {
    installationSummary: { electricalPoints: 999, lightingPoints: 999, hydraulicPoints: 999, sanitaryPoints: 999 },
    quantities: [
      prmaQuantity("prma_room_cozinha", "Pacote PRMA por ambiente - cozinha", kitchens, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_equip_geladeira", "Previsao PRMA por equipamento - geladeira", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_microondas", "Previsao PRMA por equipamento - microondas", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_forno_eletrico", "Previsao PRMA por equipamento - forno_eletrico", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_cooktop", "Previsao PRMA por equipamento - cooktop", 1, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_coifa_depurador", "Previsao PRMA por equipamento - coifa_depurador", 1, "PER_EQUIPMENT", "prma_pacote_equipamento")
    ]
  };
}

function assertKitchenPrmaDecomposition(eap, kitchens) {
  const parentServiceId = "prma_room_cozinha";
  const kitServiceId = "prma_room_cozinha_kit_cuba_pia";
  const absorbedIds = ["prma_room_cozinha_cuba_pia", "prma_room_cozinha_valvula_pia", "prma_room_cozinha_sifao"];
  const parentItems = eap.itens.filter((item) => item.serviceId === parentServiceId);
  assert.equal(parentItems.length, 1);
  assert.equal(parentItems[0].compositionSearchable, false);
  assert.equal(parentItems[0].compositionStatus, "decompose_required");
  const children = eap.itens.filter((item) => item.parentServiceId === parentServiceId);
  const kit = itemByServiceId(eap, kitServiceId);
  assert.ok(kit);
  assert.equal(kit.quantidadeBase.valor, kitchens);
  assert.equal(kit.quantidadeBase.unidade, "un");
  assert.equal(kit.source, "prma");
  assert.equal(kit.compositionSearchable, false);
  assert.equal(kit.compositionStatus, "pending_selection");
  assert.deepEqual(Array.from(kit.officialCandidates).map((candidate) => candidate.code), ["86935", "86936"]);
  assert.deepEqual(Array.from(kit.absorbedServiceIds), absorbedIds);
  assert.deepEqual(Array.from(kit.excludedAbsorptionServiceIds), ["prma_room_cozinha_torneira", "prma_room_cozinha_engate"]);
  assert.match(kit.technicalWarnings.join(" "), /Confirmar engates/);
  const subitems = children.filter((item) => item.serviceId !== kitServiceId);
  assert.equal(subitems.length, 22);
  assert.equal(children.length, 23);
  subitems.forEach((entry) => {
    assert.equal(entry.source, "prma", entry.serviceId);
    assert.equal(entry.classification, "PER_ROOM", entry.serviceId);
    assert.equal(entry.compositionSearchable, false, entry.serviceId);
    assert.equal(entry.compositionStatus, absorbedIds.includes(entry.serviceId) ? "absorbed_by_official_kit" : "pending_validation", entry.serviceId);
    assert.equal(entry.composicaoSelecionada, undefined, entry.serviceId);
    assert.equal(entry.candidatos, undefined, entry.serviceId);
    assert.equal(entry.price, undefined, entry.serviceId);
    assert.equal(entry.preco, undefined, entry.serviceId);
    assert.equal(entry.valorTotal, undefined, entry.serviceId);
  });
  absorbedIds.forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.equal(entry.absorbedByOfficialKitServiceId, kitServiceId, serviceId);
    assert.deepEqual(Array.from(entry.absorbedByOfficialKitCandidates), ["86935", "86936"], serviceId);
  });
  assert.equal(itemByServiceId(eap, "prma_room_cozinha_torneira").compositionStatus, "pending_validation");
  assert.equal(itemByServiceId(eap, "prma_room_cozinha_torneira").absorbedByOfficialKitServiceId, undefined);
  assert.equal(itemByServiceId(eap, "prma_room_cozinha_engate").compositionStatus, "pending_validation");
  assert.equal(itemByServiceId(eap, "prma_room_cozinha_engate").absorbedByOfficialKitServiceId, undefined);
  let resolverCalls = 0;
  const resolver = loadWindow(["elo-composition-resolver.js"]).EloCompositionResolver;
  resolver.resolveEloEapCompositions({ eap: { bloqueadores: [], itens: children }, compositionSearchEngine: { searchOfficialCompositions() { resolverCalls += 1; return []; } } });
  assert.equal(resolverCalls, 0);
  KITCHEN_ATOMIC_EXPECTATIONS.forEach(([suffix, perKitchen, discipline, stageId]) => {
    const serviceId = parentServiceId + "_" + suffix;
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.quantidadeBase.valor, perKitchen * kitchens, serviceId);
    assert.equal(entry.disciplina, discipline, serviceId);
    assert.equal(entry.etapaId, stageId, serviceId);
  });
  assert.equal(["ponto_geladeira", "ponto_microondas", "ponto_forno_eletrico", "ponto_cooktop", "ponto_coifa_depurador", "ponto_lava_loucas"].filter((suffix) => itemByServiceId(eap, parentServiceId + "_" + suffix).quantidadeBase.valor === kitchens).length, 6);
  assert.equal(["iluminacao_central", "iluminacao_bancada", "iluminacao_pia_armarios"].filter((suffix) => itemByServiceId(eap, parentServiceId + "_" + suffix).quantidadeBase.valor === kitchens).length, 3);
  ["prma_equip_geladeira", "prma_equip_microondas", "prma_equip_forno_eletrico", "prma_equip_cooktop", "prma_equip_coifa_depurador"].forEach((serviceId) => {
    assert.equal(eap.itens.filter((item) => item.serviceId === serviceId).length, 1, serviceId);
  });
  assert.equal(subitems.some((item) => /equip_geladeira|equip_microondas|equip_forno|equip_cooktop|equip_coifa|aparelho|fornecido/.test(item.serviceId + " " + item.nome)), false);
  const serviceIds = eap.itens.map((item) => item.serviceId).filter(Boolean);
  assert.equal(new Set(serviceIds).size, serviceIds.length);
}

test("PRMA cozinha decompoe 1 cozinha em 22 subitens atomicos", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: kitchenPrmaBudgetPackage(1) });
  assertKitchenPrmaDecomposition(eap, 1);
});

test("PRMA cozinha multiplica subitens atomicos para 2 cozinhas", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: kitchenPrmaBudgetPackage(2) });
  assertKitchenPrmaDecomposition(eap, 2);
});

test("EAP sem PRMA continua sem subitens atomicos de cozinha", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, ambientes: { cozinha: 1 }, uf: "BA" });
  assert.equal(eap.itens.some((item) => item.parentServiceId === "prma_room_cozinha"), false);
  assert.ok(itemByName(eap, "pia/cuba da cozinha"));
  assert.ok(itemByName(eap, "torneira cozinha"));
});

const SERVICE_AREA_ATOMIC_EXPECTATIONS = [
  ["agua_fria_tanque", 1, "hidraulica", "instalacoes"], ["esgoto_tanque", 1, "esgoto", "instalacoes"],
  ["agua_fria_maquina_lavar", 1, "hidraulica", "instalacoes"], ["esgoto_maquina_lavar", 1, "esgoto", "instalacoes"],
  ["ralo", 1, "esgoto", "instalacoes"], ["caixa_sifonada", 1, "esgoto", "instalacoes"], ["registro_setor", 1, "hidraulica", "instalacoes"],
  ["valvula_tanque", 1, "loucas_metais", "loucas_metais"], ["sifao_tanque", 1, "loucas_metais", "loucas_metais"], ["engate_flexivel", 1, "loucas_metais", "loucas_metais"],
  ["tanque", 1, "loucas_metais", "loucas_metais"], ["torneira_tanque", 1, "loucas_metais", "loucas_metais"],
  ["tomada_servico_tanque", 1, "eletrica", "instalacoes"], ["tomada_maquina_lavar", 1, "eletrica", "instalacoes"], ["tomada_auxiliar", 1, "eletrica", "instalacoes"],
  ["iluminacao_central", 1, "eletrica", "instalacoes"], ["interruptor", 1, "eletrica", "instalacoes"], ["caixa_espelho", 3, "eletrica", "instalacoes"],
  ["infraestrutura_varal", 1, "instalacoes", "instalacoes"]
];

function serviceAreaPrmaBudgetPackage(serviceAreas) {
  return {
    installationSummary: { electricalPoints: 999, lightingPoints: 999, hydraulicPoints: 999, sanitaryPoints: 999, washingMachines: 999 },
    quantities: [
      prmaQuantity("prma_room_area_servico", "Pacote PRMA por ambiente - area_servico", serviceAreas, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_equip_maquina_lavar", "Previsao PRMA por equipamento - maquina_lavar", 1, "PER_EQUIPMENT", "prma_pacote_equipamento")
    ]
  };
}

function assertServiceAreaPrmaDecomposition(eap, serviceAreas) {
  const parentServiceId = "prma_room_area_servico";
  const kitServiceId = "prma_room_area_servico_kit_tanque";
  const absorbedIds = [
    "prma_room_area_servico_tanque",
    "prma_room_area_servico_torneira_tanque",
    "prma_room_area_servico_valvula_tanque",
    "prma_room_area_servico_sifao_tanque"
  ];
  const parentItems = eap.itens.filter((item) => item.serviceId === parentServiceId);
  assert.equal(parentItems.length, 1);
  assert.equal(parentItems[0].compositionSearchable, false);
  assert.equal(parentItems[0].compositionStatus, "decompose_required");
  const children = eap.itens.filter((item) => item.parentServiceId === parentServiceId);
  const kit = itemByServiceId(eap, kitServiceId);
  assert.ok(kit);
  assert.equal(kit.quantidadeBase.valor, serviceAreas);
  assert.equal(kit.quantidadeBase.unidade, "un");
  assert.equal(kit.source, "prma");
  assert.equal(kit.compositionSearchable, false);
  assert.equal(kit.compositionStatus, "pending_selection");
  assert.deepEqual(Array.from(kit.officialCandidates).map((candidate) => candidate.code), ["86919", "86920", "86921"]);
  assert.deepEqual(Array.from(kit.absorbedServiceIds), absorbedIds);
  assert.deepEqual(Array.from(kit.excludedAbsorptionServiceIds), ["prma_room_area_servico_engate_flexivel"]);
  assert.match(kit.technicalWarnings.join(" "), /Confirmar ligacao flexivel/);
  const subitems = children.filter((item) => item.serviceId !== kitServiceId);
  assert.equal(subitems.length, 19);
  assert.equal(children.length, 20);
  subitems.forEach((entry) => {
    assert.equal(entry.source, "prma", entry.serviceId);
    assert.equal(entry.classification, "PER_ROOM", entry.serviceId);
    assert.equal(entry.compositionSearchable, false, entry.serviceId);
    assert.equal(entry.compositionStatus, absorbedIds.includes(entry.serviceId) ? "absorbed_by_official_kit" : "pending_validation", entry.serviceId);
    assert.equal(entry.composicaoSelecionada, undefined, entry.serviceId);
    assert.equal(entry.candidatos, undefined, entry.serviceId);
    assert.equal(entry.price, undefined, entry.serviceId);
    assert.equal(entry.preco, undefined, entry.serviceId);
    assert.equal(entry.valorTotal, undefined, entry.serviceId);
  });
  absorbedIds.forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.equal(entry.absorbedByOfficialKitServiceId, kitServiceId, serviceId);
    assert.deepEqual(Array.from(entry.absorbedByOfficialKitCandidates), ["86919", "86920", "86921"], serviceId);
  });
  assert.equal(itemByServiceId(eap, "prma_room_area_servico_engate_flexivel").compositionStatus, "pending_validation");
  assert.equal(itemByServiceId(eap, "prma_room_area_servico_engate_flexivel").absorbedByOfficialKitServiceId, undefined);
  ["agua_fria_tanque", "esgoto_tanque", "agua_fria_maquina_lavar", "esgoto_maquina_lavar", "ralo", "caixa_sifonada"].forEach((suffix) => {
    const entry = itemByServiceId(eap, parentServiceId + "_" + suffix);
    assert.equal(entry.compositionStatus, "pending_validation", suffix);
    assert.equal(entry.absorbedByOfficialKitServiceId, undefined, suffix);
  });
  let resolverCalls = 0;
  const resolver = loadWindow(["elo-composition-resolver.js"]).EloCompositionResolver;
  resolver.resolveEloEapCompositions({ eap: { bloqueadores: [], itens: children }, compositionSearchEngine: { searchOfficialCompositions() { resolverCalls += 1; return []; } } });
  assert.equal(resolverCalls, 0);
  SERVICE_AREA_ATOMIC_EXPECTATIONS.forEach(([suffix, perServiceArea, discipline, stageId]) => {
    const serviceId = parentServiceId + "_" + suffix;
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.quantidadeBase.valor, perServiceArea * serviceAreas, serviceId);
    assert.equal(entry.disciplina, discipline, serviceId);
    assert.equal(entry.etapaId, stageId, serviceId);
  });
  assert.equal(["tomada_servico_tanque", "tomada_maquina_lavar", "tomada_auxiliar"].reduce((sum, suffix) => sum + itemByServiceId(eap, parentServiceId + "_" + suffix).quantidadeBase.valor, 0), 3 * serviceAreas);
  assert.equal(eap.itens.filter((item) => item.serviceId === "prma_equip_maquina_lavar").length, 1);
  assert.equal(subitems.some((item) => /equip_maquina_lavar|maquina_lavar_fornecida|aparelho|fornecida|eletroduto/.test(item.serviceId + " " + item.nome)), false);
  const serviceIds = eap.itens.map((item) => item.serviceId).filter(Boolean);
  assert.equal(new Set(serviceIds).size, serviceIds.length);
}

test("PRMA area de servico decompoe 1 area em 19 subitens atomicos", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: serviceAreaPrmaBudgetPackage(1) });
  assertServiceAreaPrmaDecomposition(eap, 1);
});

test("PRMA area de servico multiplica subitens atomicos para 2 areas", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: serviceAreaPrmaBudgetPackage(2) });
  assertServiceAreaPrmaDecomposition(eap, 2);
});

test("EAP sem PRMA continua sem subitens atomicos de area de servico", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, ambientes: { areaServico: 1 }, uf: "BA" });
  assert.equal(eap.itens.some((item) => item.parentServiceId === "prma_room_area_servico"), false);
  assert.ok(itemByName(eap, "tanque da area de servico quando houver"));
  assert.ok(itemByName(eap, "hidraulica"));
  assert.ok(itemByName(eap, "esgoto sanitario"));
});

const OFFICIAL_KIT_SELECTIONS = {
  vaso: "prma_room_banheiro_completo_kit_vaso_sanitario_caixa_acoplada",
  lavatorio: "prma_room_banheiro_completo_kit_lavatorio",
  cuba: "prma_room_cozinha_kit_cuba_pia",
  tanque: "prma_room_area_servico_kit_tanque"
};

function officialKitPrmaBudgetPackage(bathrooms = 1, kitchens = 1, serviceAreas = 1) {
  return {
    quantities: [
      prmaQuantity("prma_room_banheiro_completo", "Pacote PRMA por ambiente - banheiro_completo", bathrooms, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_room_cozinha", "Pacote PRMA por ambiente - cozinha", kitchens, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_room_area_servico", "Pacote PRMA por ambiente - area_servico", serviceAreas, "PER_ROOM", "prma_pacote_ambiente"),
      prmaQuantity("prma_equip_chuveiro_eletrico", "Previsao PRMA por equipamento - chuveiro_eletrico", bathrooms, "PER_EQUIPMENT", "prma_pacote_equipamento"),
      prmaQuantity("prma_equip_maquina_lavar", "Previsao PRMA por equipamento - maquina_lavar", 1, "PER_EQUIPMENT", "prma_pacote_equipamento")
    ]
  };
}

function buildOfficialKitSelectionEap(officialKitSelections = {}, bathrooms = 1, kitchens = 1, serviceAreas = 1) {
  const engine = loadEap();
  return engine.buildEloBudgetEap({
    tipo: "casa",
    areaConstruidaM2: 80,
    uf: "BA",
    budgetPackage: officialKitPrmaBudgetPackage(bathrooms, kitchens, serviceAreas),
    officialKitSelections
  });
}

function assertNoServiceIdDuplicates(eap) {
  const serviceIds = eap.itens.map((item) => item.serviceId).filter(Boolean);
  assert.equal(new Set(serviceIds).size, serviceIds.length);
}

function assertKitPendingSelection(kit) {
  assert.equal(kit.compositionStatus, "pending_selection", kit.serviceId);
  assert.equal(kit.compositionSearchable, false, kit.serviceId);
  assert.equal(kit.selectedOfficialCode, undefined, kit.serviceId);
  assert.equal(kit.selectedOfficialDescription, undefined, kit.serviceId);
  assert.equal(kit.selectedOfficialUnit, undefined, kit.serviceId);
  assert.equal(kit.composicaoSelecionada, undefined, kit.serviceId);
  assert.equal(kit.price, undefined, kit.serviceId);
}

function assertKitSelected(kit, expectedCode, expectedUnit = "un") {
  assert.equal(kit.compositionStatus, "selected_pending_resolution", kit.serviceId);
  assert.equal(kit.compositionSearchable, false, kit.serviceId);
  assert.equal(kit.selectedOfficialCode, expectedCode, kit.serviceId);
  assert.equal(kit.selectedOfficialUnit, expectedUnit, kit.serviceId);
  assert.ok(kit.selectedOfficialDescription, kit.serviceId);
  assert.equal(kit.officialKit.selectedOfficialCode, expectedCode, kit.serviceId);
  assert.equal(kit.officialKit.selectedOfficialUnit, expectedUnit, kit.serviceId);
  assert.equal(kit.composicaoSelecionada, undefined, kit.serviceId);
  assert.equal(kit.price, undefined, kit.serviceId);
  assert.equal(kit.preco, undefined, kit.serviceId);
  assert.equal(kit.valorTotal, undefined, kit.serviceId);
}

function assertAbsorbedItemsRemainVisibleWithoutPrice(eap, kit) {
  Array.from(kit.absorbedServiceIds).forEach((serviceId) => {
    const entry = itemByServiceId(eap, serviceId);
    assert.ok(entry, serviceId);
    assert.equal(entry.compositionStatus, "absorbed_by_official_kit", serviceId);
    assert.equal(entry.compositionSearchable, false, serviceId);
    assert.equal(entry.absorbedByOfficialKitServiceId, kit.serviceId, serviceId);
    assert.equal(entry.composicaoSelecionada, undefined, serviceId);
    assert.equal(entry.price, undefined, serviceId);
    assert.equal(entry.preco, undefined, serviceId);
    assert.equal(entry.valorTotal, undefined, serviceId);
  });
}

function assertResolverDoesNotSearch(items) {
  let resolverCalls = 0;
  const resolver = loadWindow(["elo-composition-resolver.js"]).EloCompositionResolver;
  resolver.resolveEloEapCompositions({
    eap: { bloqueadores: [], itens: items },
    compositionSearchEngine: { searchOfficialCompositions() { resolverCalls += 1; return []; } }
  });
  assert.equal(resolverCalls, 0);
}

test("PRMA kits oficiais permanecem pending_selection sem selecao explicita", () => {
  const eap = buildOfficialKitSelectionEap();
  Object.values(OFFICIAL_KIT_SELECTIONS).forEach((serviceId) => assertKitPendingSelection(itemByServiceId(eap, serviceId)));
  assertNoServiceIdDuplicates(eap);
  assertResolverDoesNotSearch(eap.itens.filter((item) => Object.values(OFFICIAL_KIT_SELECTIONS).includes(item.serviceId)));
});

test("PRMA kits oficiais aceitam somente selecoes SINAPI candidatas", () => {
  const eap = buildOfficialKitSelectionEap({
    [OFFICIAL_KIT_SELECTIONS.vaso]: "86931",
    [OFFICIAL_KIT_SELECTIONS.lavatorio]: "86939",
    [OFFICIAL_KIT_SELECTIONS.cuba]: "86935",
    [OFFICIAL_KIT_SELECTIONS.tanque]: "86919"
  }, 2, 2, 2);
  const vaso = itemByServiceId(eap, OFFICIAL_KIT_SELECTIONS.vaso);
  const lavatorio = itemByServiceId(eap, OFFICIAL_KIT_SELECTIONS.lavatorio);
  const cuba = itemByServiceId(eap, OFFICIAL_KIT_SELECTIONS.cuba);
  const tanque = itemByServiceId(eap, OFFICIAL_KIT_SELECTIONS.tanque);
  assert.equal(vaso.quantidadeBase.valor, 2);
  assert.equal(lavatorio.quantidadeBase.valor, 2);
  assert.equal(cuba.quantidadeBase.valor, 2);
  assert.equal(tanque.quantidadeBase.valor, 2);
  assertKitSelected(vaso, "86931");
  assertKitSelected(lavatorio, "86939");
  assertKitSelected(cuba, "86935");
  assertKitSelected(tanque, "86919");
  assert.deepEqual(Array.from(vaso.officialCandidates).map((candidate) => candidate.code), ["86931", "86932"]);
  assert.deepEqual(Array.from(lavatorio.officialCandidates).map((candidate) => candidate.code), ["86939", "86941", "86942", "86943"]);
  assert.deepEqual(Array.from(cuba.officialCandidates).map((candidate) => candidate.code), ["86935", "86936"]);
  assert.deepEqual(Array.from(tanque.officialCandidates).map((candidate) => candidate.code), ["86919", "86920", "86921"]);
  [vaso, lavatorio, cuba, tanque].forEach((kit) => assertAbsorbedItemsRemainVisibleWithoutPrice(eap, kit));
  assert.equal(itemByServiceId(eap, "prma_room_banheiro_completo_assento_sanitario").compositionStatus, "pending_validation");
  assert.equal(itemByServiceId(eap, "prma_room_cozinha_torneira").compositionStatus, "pending_validation");
  assert.equal(itemByServiceId(eap, "prma_room_area_servico_engate_flexivel").compositionStatus, "pending_validation");
  assertNoServiceIdDuplicates(eap);
  assertResolverDoesNotSearch(eap.itens.filter((item) => item.parentServiceId));
});

test("PRMA selecao de kit oficial rejeita codigo fora das candidatas", () => {
  const eap = buildOfficialKitSelectionEap({
    [OFFICIAL_KIT_SELECTIONS.vaso]: "86935",
    [OFFICIAL_KIT_SELECTIONS.lavatorio]: "00000"
  });
  const vaso = itemByServiceId(eap, OFFICIAL_KIT_SELECTIONS.vaso);
  const lavatorio = itemByServiceId(eap, OFFICIAL_KIT_SELECTIONS.lavatorio);
  assertKitPendingSelection(vaso);
  assertKitPendingSelection(lavatorio);
  assert.ok(vaso.technicalWarnings.includes("Código oficial não pertence às opções permitidas para este kit."));
  assert.ok(lavatorio.technicalWarnings.includes("Código oficial não pertence às opções permitidas para este kit."));
  assertKitPendingSelection(itemByServiceId(eap, OFFICIAL_KIT_SELECTIONS.cuba));
  assertKitPendingSelection(itemByServiceId(eap, OFFICIAL_KIT_SELECTIONS.tanque));
  assert.deepEqual(Array.from(vaso.officialCandidates).map((candidate) => candidate.code), ["86931", "86932"]);
  assertNoServiceIdDuplicates(eap);
  assertResolverDoesNotSearch(eap.itens.filter((item) => item.parentServiceId));
});

test("PRMA selecao de um kit oficial nao altera os demais nem a EAP sem PRMA", () => {
  const selectedEap = buildOfficialKitSelectionEap({ [OFFICIAL_KIT_SELECTIONS.vaso]: "86931" });
  assertKitSelected(itemByServiceId(selectedEap, OFFICIAL_KIT_SELECTIONS.vaso), "86931");
  [OFFICIAL_KIT_SELECTIONS.lavatorio, OFFICIAL_KIT_SELECTIONS.cuba, OFFICIAL_KIT_SELECTIONS.tanque].forEach((serviceId) => {
    assertKitPendingSelection(itemByServiceId(selectedEap, serviceId));
  });
  assertNoServiceIdDuplicates(selectedEap);

  const engine = loadEap();
  const oldEap = engine.buildEloBudgetEap({
    tipo: "casa",
    areaConstruidaM2: 80,
    ambientes: { banheiros: 1, cozinha: 1, areaServico: 1 },
    uf: "BA",
    officialKitSelections: { [OFFICIAL_KIT_SELECTIONS.vaso]: "86931" }
  });
  assert.equal(oldEap.itens.some((item) => Object.values(OFFICIAL_KIT_SELECTIONS).includes(item.serviceId)), false);
  assert.ok(itemByName(oldEap, "vaso sanitario por banheiro"));
  assert.ok(itemByName(oldEap, "pia/cuba da cozinha"));
  assert.ok(itemByName(oldEap, "tanque da area de servico quando houver"));
});
const GENERAL_HYDRAULIC_EXPECTATIONS = {
  prma_ligacao_agua: {
    discipline: "hidraulica",
    subitems: [["ligacao_predial_agua", 1], ["registro_geral", 1], ["cavalete", 1], ["hidrometro", 1], ["entrada_rede_reservatorio", null], ["conexoes_entrada", null], ["teste_ligacao", 1]]
  },
  prma_reservatorio_1000l: {
    discipline: "hidraulica",
    subitems: [["reservatorio_1000l", 1], ["tampa", 1], ["torneira_boia", 1], ["registro_saida", 1], ["extravasor", 1], ["limpeza_inicial", 1], ["barrilete", null], ["suportes_conexoes", null]]
  },
  prma_saida_esgoto: {
    discipline: "esgoto",
    subitems: [["ligacao_predial_esgoto", 1], ["caixa_inspecao_principal", 1], ["caixa_gordura", 1], ["coletor_predial", null], ["ventilacao_sanitaria_geral", null], ["escavacao_reaterro", null], ["teste_rede", 1]]
  }
};

function generalHydraulicPrmaBudgetPackage() {
  return {
    quantities: [
      prmaQuantity("prma_ligacao_agua", "Ligacao de agua PRMA"),
      prmaQuantity("prma_reservatorio_1000l", "Reservatorio preliminar de 1000 litros PRMA"),
      prmaQuantity("prma_saida_esgoto", "Saida de esgoto PRMA")
    ]
  };
}

function assertGeneralHydraulicSubitems(eap, parentServiceId) {
  const expectation = GENERAL_HYDRAULIC_EXPECTATIONS[parentServiceId];
  const parentItems = eap.itens.filter((item) => item.serviceId === parentServiceId);
  assert.equal(parentItems.length, 1, parentServiceId);
  const subitems = eap.itens.filter((item) => item.parentServiceId === parentServiceId);
  assert.equal(subitems.length, expectation.subitems.length, parentServiceId);
  subitems.forEach((entry) => {
    assert.equal(entry.source, "prma", entry.serviceId);
    assert.equal(entry.classification, "FIXED_PER_HOUSE", entry.serviceId);
    assert.equal(entry.parentServiceId, parentServiceId, entry.serviceId);
    assert.equal(entry.disciplina, expectation.discipline, entry.serviceId);
    assert.equal(entry.etapaId, "instalacoes", entry.serviceId);
    assert.equal(entry.compositionSearchable, false, entry.serviceId);
    assert.equal(entry.compositionStatus, "pending_validation", entry.serviceId);
    assert.equal(entry.composicaoSelecionada, undefined, entry.serviceId);
    assert.equal(entry.candidatos, undefined, entry.serviceId);
    assert.equal(entry.price, undefined, entry.serviceId);
    assert.equal(entry.preco, undefined, entry.serviceId);
    assert.equal(entry.valorTotal, undefined, entry.serviceId);
    if (entry.quantidadeBase) assert.ok(!["m", "m2", "m3"].includes(entry.quantidadeBase.unidade), entry.serviceId);
  });
  expectation.subitems.forEach(([suffix, quantity]) => {
    const entry = itemByServiceId(eap, parentServiceId + "_" + suffix);
    assert.ok(entry, parentServiceId + "_" + suffix);
    if (quantity === null) assert.equal(entry.quantidadeBase, null, entry.serviceId);
    else assert.equal(entry.quantidadeBase.valor, quantity, entry.serviceId);
  });
}

test("PRMA hidraulica geral decompoe ligacao de agua", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: generalHydraulicPrmaBudgetPackage() });
  assertGeneralHydraulicSubitems(eap, "prma_ligacao_agua");
  assert.equal(itemByServiceId(eap, "prma_ligacao_agua_entrada_rede_reservatorio").quantidadeBase, null);
  assert.equal(itemByServiceId(eap, "prma_ligacao_agua_conexoes_entrada").quantidadeBase, null);
});

test("PRMA hidraulica geral decompoe reservatorio 1000 L sem dupla precificacao", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: generalHydraulicPrmaBudgetPackage() });
  assertGeneralHydraulicSubitems(eap, "prma_reservatorio_1000l");
  const parent = itemByServiceId(eap, "prma_reservatorio_1000l");
  const reservoirSubitem = itemByServiceId(eap, "prma_reservatorio_1000l_reservatorio_1000l");
  assert.equal(parent.compositionSearchable, true);
  assert.equal(reservoirSubitem.compositionSearchable, false);
  assert.equal(eap.itens.filter((item) => item.source === "prma" && item.compositionSearchable).map((item) => item.serviceId).join("|"), "prma_reservatorio_1000l");
  assert.equal(itemByServiceId(eap, "prma_reservatorio_1000l_barrilete").quantidadeBase, null);
  assert.equal(itemByServiceId(eap, "prma_reservatorio_1000l_suportes_conexoes").quantidadeBase, null);
});

test("PRMA hidraulica geral decompoe saida de esgoto", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA", budgetPackage: generalHydraulicPrmaBudgetPackage() });
  assertGeneralHydraulicSubitems(eap, "prma_saida_esgoto");
  assert.equal(itemByServiceId(eap, "prma_saida_esgoto_coletor_predial").quantidadeBase, null);
  assert.equal(itemByServiceId(eap, "prma_saida_esgoto_ventilacao_sanitaria_geral").quantidadeBase, null);
  assert.equal(itemByServiceId(eap, "prma_saida_esgoto_escavacao_reaterro").quantidadeBase, null);
  const generalSubitems = eap.itens.filter((item) => ["prma_ligacao_agua", "prma_reservatorio_1000l", "prma_saida_esgoto"].includes(item.parentServiceId));
  assert.equal(generalSubitems.length, 22);
  const serviceIds = eap.itens.map((item) => item.serviceId).filter(Boolean);
  assert.equal(new Set(serviceIds).size, serviceIds.length);
});

test("EAP sem PRMA continua sem subitens atomicos de hidraulica geral", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, uf: "BA" });
  assert.equal(eap.itens.some((item) => ["prma_ligacao_agua", "prma_reservatorio_1000l", "prma_saida_esgoto"].includes(item.parentServiceId)), false);
  assert.ok(itemByName(eap, "hidraulica"));
  assert.ok(itemByName(eap, "esgoto sanitario"));
});

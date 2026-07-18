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

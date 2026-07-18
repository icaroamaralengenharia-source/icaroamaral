(function (root) {
  "use strict";

  const PRMA_VERSION = "1.0";
  const PRMA_PROFILE_NAME = "Pacote Residencial Minimo Automatico da \u00cdcaro Amaral Engenharia";

  const QUANTITY_CLASSES = {
    FIXED_PER_HOUSE: "FIXED_PER_HOUSE",
    PER_ROOM: "PER_ROOM",
    PER_EQUIPMENT: "PER_EQUIPMENT",
    PER_AREA: "PER_AREA",
    PER_WALL_AREA: "PER_WALL_AREA",
    PER_PERIMETER: "PER_PERIMETER",
    PER_NETWORK_LENGTH: "PER_NETWORK_LENGTH",
    CONDITIONAL: "CONDITIONAL"
  };

  const AREA_BANDS = [
    {
      id: "A",
      label: "Faixa A - 50 a 69 m2",
      minAreaM2: 50,
      maxAreaM2: 69,
      activationReason: "Area residencial compacta sem programa completo informado.",
      assumedProgram: {
        livingRooms: 1,
        diningAreas: 1,
        kitchens: 1,
        serviceAreas: 1,
        bedrooms: 2,
        suites: 0,
        bathrooms: 1,
        lavabos: 0,
        garages: 0,
        balconies: 0,
        circulation: 1,
        mainEntrance: 1,
        serviceExit: 1,
        frontArea: 1,
        rearArea: 1,
        roof: 1,
        generalInfrastructure: 1
      }
    },
    {
      id: "B",
      label: "Faixa B - 70 a 105 m2",
      minAreaM2: 70,
      maxAreaM2: 105,
      activationReason: "Area residencial media sem programa completo informado.",
      assumedProgram: {
        livingRooms: 1,
        diningAreas: 1,
        kitchens: 1,
        serviceAreas: 1,
        bedrooms: 3,
        suites: 1,
        bathrooms: 2,
        lavabos: 0,
        garages: 1,
        balconies: 0,
        circulation: 1,
        mainEntrance: 1,
        serviceExit: 1,
        frontArea: 1,
        rearArea: 1,
        vehicleAccess: 1,
        roof: 1,
        generalInfrastructure: 1
      }
    },
    {
      id: "C",
      label: "Faixa C - 106 a 140 m2",
      minAreaM2: 106,
      maxAreaM2: 140,
      activationReason: "Area residencial ampliada sem programa completo informado; ampliar primeiro ambientes existentes.",
      assumedProgram: {
        livingRooms: 1,
        diningAreas: 1,
        kitchens: 1,
        serviceAreas: 1,
        bedrooms: 3,
        suites: 1,
        bathrooms: 2,
        lavabos: 0,
        garages: 1,
        balconies: 0,
        circulation: 1,
        mainEntrance: 1,
        serviceExit: 1,
        frontArea: 1,
        rearArea: 1,
        vehicleAccess: 1,
        roof: 1,
        generalInfrastructure: 1
      }
    }
  ];

  const FIXED_RESIDENTIAL_PACKAGE = [
    fixed("servicos_preliminares", ["mobilizacao", "instalacao provisoria de agua", "instalacao provisoria de energia", "locacao da obra", "gabarito", "limpeza inicial", "protecao da obra", "destinacao de residuos", "administracao local", "documentacao tecnica", "ART ou RRT quando aplicavel", "registros da obra", "limpeza final"]),
    fixed("terraplenagem_preliminar", ["limpeza superficial", "retirada de camada organica", "regularizacao", "escavacao preliminar", "reaterro", "compactacao", "aterro interno", "descarte de excedentes", "lastro sob piso quando adotado"], "Movimentacao de terra preliminar. Confirmar com topografia."),
    fixed("fundacao_preliminar", ["escavacao", "regularizacao", "concreto magro", "fundacao rasa preliminar", "sapatas blocos ou fundacao corrida conforme perfil adotado", "vigas baldrame", "formas", "armaduras", "concreto", "arranques", "impermeabilizacao do baldrame", "reaterro", "compactacao", "passagens sob piso", "aterramento ou passagem de aterramento"], "Fundacao preliminar para orcamento. Confirmar apos sondagem e projeto estrutural."),
    fixed("estrutura_preliminar", ["pilares", "vigas", "cintas", "vergas", "contravergas", "formas", "escoramento", "aco", "concreto", "espacadores", "cura", "desforma"]),
    fixed("alvenaria", ["paredes externas", "paredes internas", "blocos", "meio-blocos", "canaletas", "argamassa", "ligacoes", "vergas", "contravergas", "encunhamento", "recortes", "fechamentos", "perdas"]),
    fixed("cobertura", ["estrutura", "telhas", "cumeeiras", "rufos", "calhas", "condutores", "fixadores", "manta ou subcobertura conforme perfil", "beiral", "arremates", "perdas", "teste de estanqueidade"]),
    fixed("impermeabilizacao", ["baldrames", "banheiros", "boxes", "areas molhadas", "area de servico", "cozinha quando necessario", "varandas expostas", "ralos", "passagens", "preparo", "regularizacao", "reforco de cantos", "produto impermeabilizante", "protecao", "teste de estanqueidade"]),
    fixed("aguas_pluviais", ["calhas", "bocais", "condutores", "curvas", "abracadeiras", "caixas", "tubulacao", "saida", "protecao contra erosao", "testes"]),
    fixed("entrada_energia", ["padrao de entrada", "caixa de medicao", "caixa de protecao", "quadro de medicao completo", "eletrodutos", "condutores", "conexoes", "aterramento", "haste", "caixa de inspecao", "estrutura civil de suporte"], "Confirmar carga, demanda, padrao da concessionaria e capacidade do ramal."),
    fixed("quadro_distribuicao", ["minimo de 18 circuitos previstos", "gabinete minimo de 24 modulos", "preferir 36 modulos quando necessario", "reserva tecnica", "disjuntor geral", "DPS", "DR", "barramento de neutro", "barramento de terra", "trilho DIN", "identificacao"]),
    fixed("caixas_passagem_fixas", ["8 caixas de passagem de piso ou externas", "8 caixas de passagem de laje forro ou entre setores", "tampas", "conexoes", "eletrodutos", "identificacao", "reserva para energia dados e cameras"]),
    fixed("iluminacao_externa", ["1 refletor de 60 W no portao ou acesso", "1 refletor de 60 W na frente do terreno", "1 refletor de 60 W no fundo", "suportes", "caixas", "eletrodutos", "cabos", "protecao", "comando", "aterramento", "testes"]),
    fixed("dados_comunicacao", ["entrada de telecom", "caixa principal", "roteador", "dados na sala", "dados nos quartos", "televisao", "infraestrutura para cameras", "eletrodutos separados", "guia", "caixas", "identificacao"]),
    fixed("hidraulica_geral", ["ligacao de agua", "registro geral", "cavalete", "reservatorio preliminar de 1000 litros", "boia", "extravasor", "barrilete", "registros de setores", "colunas", "ramais", "sub-ramais", "tubos", "conexoes", "testes"], "Capacidade preliminar. Confirmar conforme ocupacao e condicoes locais."),
    fixed("esgoto_geral", ["ramais de descarga", "ramais de esgoto", "ventilacao", "subcoletores", "coletor predial", "caixas sifonadas", "caixa de gordura", "caixas de inspecao", "tubos", "conexoes", "escavacao", "reaterro", "testes", "ligacao a rede publica"])
  ];

  const ROOM_PACKAGES = {
    sala_estar: room("sala_estar", { generalOutlets: 8, lightingPoints: 2, switches: 2, dataPoints: 1, tvPoints: 1, acProvision: true }, ["porta", "janela", "piso", "rodape", "pintura", "forro"]),
    sala_jantar: room("sala_jantar", { generalOutlets: 4, lightingPoints: 2, switchesSharedWithSocialArea: true }, ["piso", "rodape", "pintura", "acabamento de teto"]),
    quarto_comum: room("quarto_comum", { generalOutlets: 6, lightingPoints: 1, switches: 1, auxiliarySwitchProvision: true, dataPoints: 1, tvPoints: 1, acProvision: true }, ["porta", "janela", "piso", "rodape", "pintura", "forro", "soleira", "peitoril"]),
    dormitorio_suite: room("dormitorio_suite", { generalOutlets: 7, lightingPoints: 1, switches: 1, bedsideSwitchProvision: true, dataPoints: 1, tvPoints: 1, acProvision: true }, ["porta", "janela", "piso", "rodape", "pintura", "forro"]),
    cozinha: room("cozinha", { generalOutlets: 4, dedicatedOutlets: 6, totalOutlets: 10, lightingPoints: 3, coldWaterPoints: 1, sewagePoints: 1, hotWaterConditional: true }, ["pia ou cuba", "torneira", "bancada", "frontao", "rodabanca", "revestimento", "piso", "pintura", "janela", "porta de servico quando aplicavel"]),
    banheiro_completo: room("banheiro_completo", { generalOutlets: 2, outletLoadVA: 600, lightingPoints: 2, coldWaterPoints: 3, sewagePoints: 3, floorDrains: 1, electricShowerW: 7500, showerVoltageV: 220, showerBreakerA: 40, showerCableMm2: 6, dedicatedShowerCircuit: true }, ["vaso sanitario", "caixa acoplada ou descarga", "assento", "lavatorio ou cuba", "chuveiro", "torneira", "registros", "valvula", "sifao", "engates", "acessorios", "espelho", "box ou kit preliminar", "impermeabilizacao", "piso", "revestimento", "porta", "janela ou ventilacao", "forro", "pintura do teto"]),
    area_servico: room("area_servico", { serviceOutlets: 1, dedicatedWasherOutlet: 1, lightingPoints: 1, switches: 1, coldWaterPoints: 2, sewagePoints: 2, floorDrains: 1 }, ["tanque", "torneira", "valvula", "sifao", "agua do tanque", "esgoto do tanque", "agua para maquina", "esgoto da maquina", "impermeabilizacao", "piso", "revestimento localizado", "pintura", "ventilacao"]),
    varanda: room("varanda", { doubleOutlets: 1, lightingPoints: 1, switches: 1, exposedAreaBox: true }, ["piso externo", "rodape", "impermeabilizacao", "ralo quando necessario", "pintura", "guarda-corpo quando aplicavel"])
  };

  const EQUIPMENT_PACKAGES = {
    chuveiro_eletrico: equipment("chuveiro_eletrico", { powerW: 7500, voltageV: 220, breakerA: 40, cableMm2: 6, dedicatedCircuit: true, drProtection: true }),
    maquina_lavar: equipment("maquina_lavar", { dedicatedOutlet: true, coldWaterPoint: true, sewagePoint: true }),
    geladeira: equipment("geladeira", { dedicatedPointProvision: true }),
    microondas: equipment("microondas", { dedicatedPointProvision: true }),
    forno_eletrico: equipment("forno_eletrico", { dedicatedPointProvision: true }),
    cooktop: equipment("cooktop", { dedicatedPointProvision: true }),
    coifa_depurador: equipment("coifa_depurador", { dedicatedPointProvision: true })
  };

  const SCALABLE_QUANTITIES = [
    scalable("contrapiso", QUANTITY_CLASSES.PER_AREA),
    scalable("pisos", QUANTITY_CLASSES.PER_AREA),
    scalable("forro", QUANTITY_CLASSES.PER_AREA),
    scalable("pintura_teto", QUANTITY_CLASSES.PER_AREA),
    scalable("cobertura", QUANTITY_CLASSES.PER_AREA),
    scalable("fundacao", QUANTITY_CLASSES.PER_AREA),
    scalable("estrutura", QUANTITY_CLASSES.PER_AREA),
    scalable("limpeza_final", QUANTITY_CLASSES.PER_AREA),
    scalable("blocos", QUANTITY_CLASSES.PER_WALL_AREA),
    scalable("chapisco", QUANTITY_CLASSES.PER_WALL_AREA),
    scalable("emboco", QUANTITY_CLASSES.PER_WALL_AREA),
    scalable("reboco", QUANTITY_CLASSES.PER_WALL_AREA),
    scalable("pintura_paredes", QUANTITY_CLASSES.PER_WALL_AREA),
    scalable("baldrame", QUANTITY_CLASSES.PER_PERIMETER),
    scalable("parede_externa", QUANTITY_CLASSES.PER_PERIMETER),
    scalable("rodape", QUANTITY_CLASSES.PER_PERIMETER),
    scalable("calhas_rufos", QUANTITY_CLASSES.PER_PERIMETER),
    scalable("cabos", QUANTITY_CLASSES.PER_NETWORK_LENGTH),
    scalable("eletrodutos", QUANTITY_CLASSES.PER_NETWORK_LENGTH),
    scalable("agua_fria", QUANTITY_CLASSES.PER_NETWORK_LENGTH),
    scalable("esgoto", QUANTITY_CLASSES.PER_NETWORK_LENGTH),
    scalable("dados", QUANTITY_CLASSES.PER_NETWORK_LENGTH)
  ];

  const CONDITIONAL_ITEMS = [
    conditional("spda_completo", "Nao ativar automaticamente; manter como infraestrutura ou pendencia."),
    conditional("piscina", "Somente quando informada."),
    conditional("energia_solar", "Somente quando informada."),
    conditional("gas", "Somente quando informado."),
    conditional("aquecimento_agua", "Somente quando informado."),
    conditional("portao_automatizado", "Somente quando informado."),
    conditional("cameras_compradas", "Infraestrutura pode entrar; cameras compradas nao entram automaticamente."),
    conditional("cerca_eletrica", "Somente quando informada."),
    conditional("carregador_veicular", "Somente quando informado."),
    conditional("pressurizador", "Somente quando informado."),
    conditional("bomba", "Somente quando informada."),
    conditional("poco", "Somente quando informado."),
    conditional("fossa_filtro_sumidouro", "Marcar como pendencia quando nao houver rede publica; nao dimensionar sem solo e ocupacao."),
    conditional("automacao", "Somente quando informada.")
  ];

  const DESIGN_WARNINGS = [
    "Como nao foi fornecido projeto completo, apliquei o PRMA V1 da Icaro Amaral Engenharia.",
    "Confirmar cargas, demanda, padrao da concessionaria e capacidade do ramal.",
    "Fundacao preliminar para orcamento. Confirmar apos sondagem e projeto estrutural.",
    "Nao definir estrutura definitiva sem projeto.",
    "Capacidade de reservatorio preliminar. Confirmar conforme ocupacao e condicoes locais.",
    "SPDA completo, piscina, energia solar, gas, aquecimento, cameras compradas e automacao permanecem condicionais."
  ];

  const ASSUMPTIONS = [
    "A area amplia primeiro os ambientes existentes.",
    "Ambientes adicionais em faixa C dependem de informacao ou aceite do cliente.",
    "Dados explicitamente informados pelo usuario vencem as premissas automaticas.",
    "O pacote nao inventa precos, produtividade nem composicoes oficiais.",
    "Itens pequenos de instalacao, fixacao, vedacao, acabamento, perdas e testes permanecem previstos conforme aplicabilidade."
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function fixed(id, items, warning) {
    return { id: id, quantityClass: QUANTITY_CLASSES.FIXED_PER_HOUSE, items: items.slice(), warning: warning || null };
  }

  function room(id, counts, items) {
    return { id: id, quantityClass: QUANTITY_CLASSES.PER_ROOM, counts: Object.assign({}, counts || {}), items: items.slice() };
  }

  function equipment(id, counts) {
    return { id: id, quantityClass: QUANTITY_CLASSES.PER_EQUIPMENT, counts: Object.assign({}, counts || {}) };
  }

  function scalable(id, quantityClass) {
    return { id: id, quantityClass: quantityClass };
  }

  function conditional(id, rule) {
    return { id: id, quantityClass: QUANTITY_CLASSES.CONDITIONAL, rule: rule };
  }

  function resolveAreaBand(areaM2) {
    const area = Number(areaM2);
    if (!Number.isFinite(area)) return null;
    return clone(AREA_BANDS.find(function (band) { return area >= band.minAreaM2 && area <= band.maxAreaM2; }) || null);
  }

  function hasNumber(value) {
    return Number.isFinite(Number(value));
  }

  function mergeProgram(assumedProgram, userProgram) {
    const merged = clone(assumedProgram || {});
    const user = userProgram || {};
    Object.keys(user).forEach(function (key) {
      if (user[key] !== undefined && user[key] !== null && user[key] !== "") merged[key] = user[key];
    });
    if (!hasNumber(merged.bathrooms) || Number(merged.bathrooms) < 1) merged.bathrooms = 1;
    return merged;
  }

  function build(input) {
    const safe = input || {};
    const band = resolveAreaBand(safe.areaM2 || safe.area || safe.builtAreaM2);
    if (!band) return { applied: false, version: PRMA_VERSION, profileName: PRMA_PROFILE_NAME, reason: "Area fora das faixas PRMA V1." };
    const assumedProgram = mergeProgram(band.assumedProgram, safe.program || safe.userProgram || {});
    return {
      applied: true,
      version: PRMA_VERSION,
      profileName: PRMA_PROFILE_NAME,
      activationReason: safe.activationReason || band.activationReason,
      areaBand: { id: band.id, label: band.label, minAreaM2: band.minAreaM2, maxAreaM2: band.maxAreaM2 },
      assumedProgram: assumedProgram,
      fixedResidentialPackage: clone(FIXED_RESIDENTIAL_PACKAGE),
      roomPackages: clone(ROOM_PACKAGES),
      equipmentPackages: clone(EQUIPMENT_PACKAGES),
      scalableQuantities: clone(SCALABLE_QUANTITIES),
      conditionalItems: clone(CONDITIONAL_ITEMS),
      designWarnings: clone(DESIGN_WARNINGS),
      assumptions: clone(ASSUMPTIONS)
    };
  }

  root.EloResidentialPrmaEngine = {
    PRMA_VERSION: PRMA_VERSION,
    PRMA_PROFILE_NAME: PRMA_PROFILE_NAME,
    QUANTITY_CLASSES: clone(QUANTITY_CLASSES),
    resolveAreaBand: resolveAreaBand,
    build: build
  };
})(typeof window !== "undefined" ? window : globalThis);

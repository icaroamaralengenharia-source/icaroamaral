(function () {
  "use strict";

  const FAMILY_SOCIAL = "CASA_TERREA_3_QUARTOS_SOCIAL_INTEGRADO_SUITE";
  const FAMILY_FREE = "CASA_TERREA_3_QUARTOS_SUITE_LIVRE";
  const GROUPS = {
    rectangular: "Retangulares",
    square: "Quadradas",
    open: "Conceito aberto",
    lshape: "Em L",
    popular: "Economica e popular",
    modern: "Modernas",
    rural: "Rural e varanda"
  };

  function template(family, id, name, group, tags, bestFor, strategy, description, fixedConfiguration) {
    return {
      id,
      name,
      family,
      group,
      groupName: GROUPS[group],
      tags,
      bestFor,
      rooms: family === FAMILY_SOCIAL
        ? ["sala", "jantar", "cozinha integrada", "balcao americano", "area de servico", "corredor", "banheiro social", "quarto 1", "quarto 2", "suite"]
        : ["sala", "jantar", "cozinha", "area de servico", "banheiro social", "quarto 1", "quarto 2", "suite"],
      strategy,
      description,
      fixedConfiguration: Boolean(fixedConfiguration)
    };
  }

  const SOCIAL_DEFS = [
    ["3q-social-retangular-01", "Retangular social integrada", "rectangular", ["social integrado", "cozinha americana", "suite", "corredor", "lote profundo"], ["8x20", "8x25", "10x20"], "linear_social_front_corridor_private_back", "Sala, jantar e cozinha integrados na frente, corredor central e suite no fundo."],
    ["3q-social-retangular-02", "Retangular com balcao americano", "rectangular", ["balcao americano", "economica", "suite", "pouca circulacao"], ["8x20", "10x20"], "american_counter_compact_corridor", "Balcao divide cozinha e estar, reduzindo paredes sem perder setor intimo."],
    ["3q-social-retangular-03", "Retangular corredor privativo", "rectangular", ["corredor", "privacidade", "suite", "quartos isolados"], ["8x25", "10x25"], "private_corridor_three_bedrooms", "Corredor separa quartos da area social integrada."],
    ["3q-social-retangular-04", "Retangular lavanderia externa", "rectangular", ["area de servico externa", "lavanderia externa", "suite"], ["8x20", "10x20"], "external_service_rear_social_front", "Area de servico no fundo libera a cozinha integrada."],
    ["3q-social-retangular-05", "Retangular economica 3Q suite", "rectangular", ["economica", "barata", "suite", "poucos recortes"], ["8x20", "9x20", "10x20"], "low_cost_linear_three_bedrooms", "Volume simples, poucas quebras e nucleo molhado compacto."],
    ["3q-social-retangular-06", "Retangular profunda com suite final", "rectangular", ["lote profundo", "suite ao fundo", "social integrado"], ["8x25", "10x30"], "deep_lot_master_rear", "Aproveita profundidade com suite no fundo e social amplo na frente."],
    ["3q-social-quadrada-07", "Quadrada integrada compacta", "square", ["quadrada", "compacta", "social integrado", "suite"], ["12x12", "12x15"], "square_center_social_private_sides", "Social integrado no centro com quartos nas laterais."],
    ["3q-social-quadrada-08", "Quadrada nucleo molhado", "square", ["nucleo molhado", "economica", "suite", "cozinha americana"], ["12x12", "12x15"], "wet_core_square_three_bedrooms", "Cozinha, banheiros e servico agrupados para economia."],
    ["3q-social-quadrada-09", "Quadrada familiar suite", "square", ["familiar", "suite", "quartos equilibrados"], ["12x15", "15x15"], "balanced_square_family", "Tres quartos equilibrados e area social integrada frontal."],
    ["3q-social-quadrada-10", "Quadrada social central", "square", ["social central", "iluminacao cruzada", "suite"], ["12x12", "15x15"], "central_social_cross_light", "Estar e jantar centrais com ventilacao cruzada."],
    ["3q-social-quadrada-11", "Quadrada varanda frontal", "square", ["varanda", "social integrado", "suite"], ["12x15", "15x15"], "front_porch_square_social", "Varanda protege a entrada e amplia o social integrado."],
    ["3q-social-quadrada-12", "Quadrada corredor curto", "square", ["corredor curto", "economica", "suite"], ["12x12", "12x15"], "short_hall_square_private", "Hall minimo distribui os tres quartos e banheiro."],
    ["3q-social-aberto-13", "Conceito aberto cozinha americana", "open", ["conceito aberto", "cozinha americana", "suite", "social integrado"], ["10x20", "12x20"], "open_american_kitchen_three_bedrooms", "Sala, jantar e cozinha americana como ambiente unico."],
    ["3q-social-aberto-14", "Conceito aberto com ilha", "open", ["ilha", "moderna", "suite", "social integrado"], ["12x20", "12x25"], "open_island_private_wing", "Ilha central organiza cozinha e jantar com quartos em ala separada."],
    ["3q-social-aberto-15", "Open concept 3 bedroom", "open", ["open concept", "three bedroom", "master suite", "cozinha integrada"], ["10x25", "12x25"], "open_concept_master_suite", "Modelo open concept para tres quartos com suite principal."],
    ["3q-social-aberto-16", "Integrada com varanda gourmet", "open", ["varanda gourmet", "moderna", "suite", "cozinha americana"], ["12x25", "15x25"], "gourmet_porch_open_social", "Social integrado se abre para varanda gourmet."],
    ["3q-social-aberto-17", "Integrada economica", "open", ["economica", "pouca parede", "cozinha americana", "suite"], ["10x20", "12x20"], "low_partition_open_social", "Poucas divisorias na area social para reduzir custo."],
    ["3q-social-aberto-18", "Integrada corredor lateral", "open", ["corredor lateral", "ventilacao", "suite"], ["10x25", "12x25"], "side_corridor_open_private", "Corredor lateral favorece ventilacao dos quartos."],
    ["3q-social-l-19", "Planta em L social integrada", "lshape", ["em l", "social integrado", "suite", "varanda"], ["12x20", "12x25"], "l_social_private_wing", "Area social em uma perna e quartos na outra."],
    ["3q-social-l-20", "Em L com varanda interna", "lshape", ["em l", "varanda", "patio", "suite"], ["12x25", "15x25"], "l_inner_porch_three_bedrooms", "Varanda interna melhora iluminacao e separa usos."],
    ["3q-social-l-21", "Em L suite reservada", "lshape", ["em l", "suite reservada", "privacidade"], ["12x25", "15x25"], "l_reserved_master_suite", "Suite em extremidade reservada e quartos no bloco intimo."],
    ["3q-social-l-22", "Em L cozinha ilha", "lshape", ["em l", "ilha", "moderna", "social integrado"], ["12x25", "15x25"], "l_kitchen_island_social", "Cozinha com ilha articula jantar, estar e varanda."],
    ["3q-social-l-23", "Em L rural integrada", "lshape", ["rural", "varanda", "cozinha maior", "suite"], ["12x25", "15x30"], "rural_l_big_kitchen_suite", "Varanda e cozinha maior para uso rural com suite preservada."],
    ["3q-social-l-24", "Em L expansivel", "lshape", ["ampliacao futura", "suite", "patio"], ["12x25", "15x30"], "l_future_expansion", "Patio permite ampliacao sem romper o setor intimo."],
    ["3q-social-popular-25", "Popular 3Q suite integrada", "popular", ["popular", "economica", "suite", "cozinha americana"], ["8x20", "10x20"], "popular_integrated_three_bedrooms", "Solucao popular com social integrado e suite compacta."],
    ["3q-social-popular-26", "Popular corredor central", "popular", ["popular", "corredor", "privacidade", "suite"], ["8x20", "10x20"], "popular_central_corridor", "Corredor central organiza os tres quartos com baixo custo."],
    ["3q-social-popular-27", "Popular lavanderia externa", "popular", ["popular", "lavanderia externa", "servico externo"], ["8x20", "10x20"], "popular_external_laundry", "Lavanderia externa simplifica a cozinha compacta."],
    ["3q-social-moderna-28", "Moderna social integrado", "modern", ["moderna", "ilha", "suite", "social integrado"], ["12x20", "12x25"], "modern_open_social_master", "Social amplo com ilha e suite em ala privativa."],
    ["3q-social-moderna-29", "Moderna varanda e ilha", "modern", ["moderna", "varanda", "ilha", "suite"], ["12x25", "15x25"], "modern_porch_island_suite", "Varanda frontal conectada a ilha central."],
    ["3q-social-rural-30", "Rural varanda corrida", "rural", ["rural", "varanda", "cozinha maior", "suite"], ["12x25", "15x30"], "rural_wrap_porch_three_bedrooms", "Varanda corrida, cozinha maior e suite para lote amplo."]
  ];

  const FREE_DEFS = [
    ["3q-livre-retangular-01", "Retangular livre compacta", "rectangular", ["3 quartos", "suite", "compacta", "linear"], ["8x20", "10x20"], "free_linear_three_bedrooms", "Distribuicao livre com tres quartos e suite compacta."],
    ["3q-livre-retangular-02", "Retangular quartos ao fundo", "rectangular", ["quartos ao fundo", "privacidade", "suite"], ["8x25", "10x25"], "rear_bedrooms_social_front", "Area social frontal e quartos concentrados no fundo."],
    ["3q-livre-retangular-03", "Retangular com quarto frontal", "rectangular", ["quarto frontal", "flexivel", "suite"], ["8x20", "10x20"], "front_bedroom_mixed_layout", "Um quarto frontal permite escritorio ou hospedagem."],
    ["3q-livre-retangular-04", "Retangular economica suite", "rectangular", ["economica", "barata", "suite", "poucos recortes"], ["8x20", "9x20"], "low_cost_three_bedroom_suite", "Volume simples com banheiros agrupados."],
    ["3q-livre-retangular-05", "Retangular ampliavel", "rectangular", ["ampliacao futura", "suite", "linear"], ["8x25", "10x25"], "linear_future_expansion", "Faixa lateral permite ampliar cozinha ou varanda."],
    ["3q-livre-retangular-06", "Retangular geminada", "rectangular", ["geminada", "parede lateral cega", "suite"], ["7x20", "8x20"], "attached_side_wall_three_bedrooms", "Parede lateral cega e ventilacao por frente, fundos e patio."],
    ["3q-livre-quadrada-07", "Quadrada livre familiar", "square", ["quadrada", "familiar", "suite"], ["12x12", "12x15"], "free_square_family", "Planta quadrada com quartos equilibrados."],
    ["3q-livre-quadrada-08", "Quadrada banheiro central", "square", ["banheiro central", "suite", "economica"], ["12x12", "12x15"], "central_bath_square_suite", "Banheiro social e suite encostados para infraestrutura curta."],
    ["3q-livre-quadrada-09", "Quadrada quartos laterais", "square", ["quartos laterais", "privacidade", "suite"], ["12x15", "15x15"], "side_bedrooms_square", "Quartos nas laterais liberam sala e cozinha no centro."],
    ["3q-livre-quadrada-10", "Quadrada sala frontal", "square", ["sala frontal", "suite", "simples"], ["12x12", "12x15"], "front_living_square", "Sala frontal e cozinha posterior com tres quartos compactos."],
    ["3q-livre-quadrada-11", "Quadrada economica", "square", ["economica", "popular", "poucos recortes"], ["10x12", "12x12"], "low_cut_square_three_bedrooms", "Perimetro simples e circulacao minima."],
    ["3q-livre-quadrada-12", "Quadrada expansivel", "square", ["ampliacao futura", "suite", "patio"], ["12x15", "15x15"], "square_future_expansion", "Lateral livre para futura varanda ou quarto extra."],
    ["3q-livre-aberto-13", "Livre social aberto simples", "open", ["conceito aberto", "suite", "simples"], ["10x20", "12x20"], "simple_open_social_three_bedrooms", "Area social aberta sem configuracao fixa."],
    ["3q-livre-aberto-14", "Livre cozinha em L", "open", ["cozinha em l", "moderna", "suite"], ["10x20", "12x20"], "free_l_kitchen_social", "Cozinha em L organiza jantar e sala."],
    ["3q-livre-aberto-15", "Livre social compacto", "open", ["compacta", "pouca circulacao", "suite"], ["8x20", "10x20"], "compact_open_social", "Menos circulacao e quartos compactos para caber em lote medio."],
    ["3q-livre-aberto-16", "Livre social varanda", "open", ["varanda", "suite", "social"], ["10x25", "12x25"], "open_social_porch", "Sala se conecta a varanda sem impor cozinha americana."],
    ["3q-livre-aberto-17", "Livre moderna", "open", ["moderna", "suite", "flexivel"], ["12x20", "12x25"], "modern_free_three_bedrooms", "Ambientes sociais flexiveis para ajustes do cliente."],
    ["3q-livre-aberto-18", "Livre ventilacao cruzada", "open", ["ventilacao cruzada", "suite", "lateral"], ["10x25", "12x25"], "cross_ventilation_free_plan", "Aberturas opostas favorecem conforto termico."],
    ["3q-livre-l-19", "Livre em L compacta", "lshape", ["em l", "compacta", "suite"], ["10x20", "12x20"], "compact_l_three_bedrooms", "Setor intimo em uma perna e social na outra."],
    ["3q-livre-l-20", "Livre em L com patio", "lshape", ["em l", "patio", "suite"], ["12x25", "15x25"], "l_patio_free_plan", "Patio melhora iluminacao dos quartos."],
    ["3q-livre-l-21", "Livre em L rural", "lshape", ["rural", "varanda", "suite"], ["12x25", "15x30"], "rural_l_free_plan", "Varanda e cozinha maior com quartos preservados."],
    ["3q-livre-l-22", "Livre em L moderna", "lshape", ["moderna", "em l", "suite"], ["12x20", "12x25"], "modern_l_free_suite", "Composicao em L para lote largo e linguagem moderna."],
    ["3q-livre-l-23", "Livre em L suite fundo", "lshape", ["suite ao fundo", "privacidade", "em l"], ["12x25", "15x25"], "rear_master_l_plan", "Suite no fundo aumenta privacidade."],
    ["3q-livre-l-24", "Livre em L expansivel", "lshape", ["ampliacao futura", "em l", "suite"], ["12x25", "15x30"], "expansible_l_three_bedrooms", "Patio lateral permite crescimento planejado."],
    ["3q-livre-popular-25", "Livre popular economica", "popular", ["popular", "economica", "barata", "suite"], ["8x20", "10x20"], "popular_free_low_cost", "Programa completo em planta simples e economica."],
    ["3q-livre-popular-26", "Livre popular 8x20", "popular", ["popular", "8x20", "suite", "compacta"], ["8x20"], "popular_8x20_three_bedrooms", "Ajustada para lote 8x20 com quartos compactos."],
    ["3q-livre-popular-27", "Livre popular servico externo", "popular", ["servico externo", "economica", "suite"], ["8x20", "10x20"], "popular_external_service", "Servico externo reduz area construida interna."],
    ["3q-livre-moderna-28", "Livre moderna suite master", "modern", ["moderna", "master suite", "suite"], ["12x20", "12x25"], "modern_master_suite_free", "Suite principal maior e quartos secundarios flexiveis."],
    ["3q-livre-moderna-29", "Livre moderna varanda", "modern", ["moderna", "varanda", "suite"], ["12x25", "15x25"], "modern_porch_free_plan", "Varanda valoriza fachada e area social."],
    ["3q-livre-rural-30", "Livre rural cozinha ampla", "rural", ["rural", "cozinha maior", "varanda", "suite"], ["12x25", "15x30"], "rural_large_kitchen_free", "Cozinha ampla, varanda e tres quartos para lote rural."]
  ];

  const TEMPLATES = SOCIAL_DEFS.map((item) => template(FAMILY_SOCIAL, ...item, true))
    .concat(FREE_DEFS.map((item) => template(FAMILY_FREE, ...item, false)));

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function parseLot(text) {
    const match = normalizeText(text).match(/(\d+(?:[,.]\d+)?)\s*x\s*(\d+(?:[,.]\d+)?)/);
    if (!match) return null;
    const width = Number(match[1].replace(",", "."));
    const depth = Number(match[2].replace(",", "."));
    if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return null;
    return { width, depth, label: `${trimNumber(width)}x${trimNumber(depth)}` };
  }

  function trimNumber(value) {
    return Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function isThreeBedroomRequest(text) {
    return /(\b3\s*quartos?\b|\btres\s+quartos?\b|\bthree\s+bedroom\b|\b3\s*bedroom\b|\btri(?:o|e)h?\s*spaln|\bcasa\s+com\s+suite\b|\bcasa\s+com\s+su[ií]te\b|\bsendo\s+uma\s+suite\b)/.test(normalizeText(text));
  }

  function detectSocialFamily(text) {
    const clean = normalizeText(text);
    return /(social integrado|sala.*jantar.*cozinha|jantar.*cozinha.*integr|cozinha americana|balcao|balcão|ilha|open concept|living dining kitchen|corredor|lavanderia externa|area de servico externa|servico externo|master suite|suite obrigatoria|sendo uma suite)/.test(clean);
  }

  function detectIntent(input) {
    const clean = normalizeText(input);
    const house = /(casa|planta|terrea|floor plan|house|residencia|suite)/.test(clean);
    if (!house || !isThreeBedroomRequest(clean)) return "";
    return detectSocialFamily(clean) ? FAMILY_SOCIAL : FAMILY_FREE;
  }

  function modelText(model) {
    return normalizeText([model.name, model.group, model.groupName, model.strategy, model.description].concat(model.tags || []).join(" "));
  }

  function scoreTemplate(model, context) {
    const text = normalizeText(context.text);
    const lot = context.lot;
    let score = model.family === context.family ? 20 : -20;
    const tags = modelText(model);
    if (lot) {
      const ratio = lot.depth / Math.max(lot.width, 0.01);
      if (lot.width <= 8 && /retangular|popular|compacta|8x20|geminada/.test(tags)) score += 10;
      if (ratio >= 2.2 && /retangular|linear|lote profundo|suite ao fundo/.test(tags)) score += 8;
      if (lot.width >= 12 && /em l|varanda|patio|moderna|rural/.test(tags)) score += 9;
      if (Math.abs(lot.width - lot.depth) <= 3 && /quadrada|central/.test(tags)) score += 8;
    }
    for (const tag of model.tags) if (text.includes(normalizeText(tag))) score += 5;
    if (/(barat|econom|popular|baixo custo)/.test(text) && /economica|barata|popular|poucos recortes/.test(tags)) score += 12;
    if (/(moderna|ilha|gourmet|premium)/.test(text) && /moderna|ilha|gourmet|open/.test(tags)) score += 12;
    if (/(rural|sitio|chacara|varanda|campo)/.test(text) && /rural|varanda|cozinha maior|campo/.test(tags)) score += 12;
    if (/(em l|\bl\b)/.test(text) && model.group === "lshape") score += 13;
    if (/(cozinha americana|balcao|integrada|open concept|conceito aberto)/.test(text) && /cozinha americana|balcao|social integrado|open concept|integrada/.test(tags)) score += 13;
    if (/(lavanderia externa|area de servico externa|servico externo)/.test(text) && /lavanderia externa|area de servico externa|servico externo/.test(tags)) score += 10;
    if (/(corredor|privacidade|setor intimo)/.test(text) && /corredor|privacidade|quartos isolados|setor intimo/.test(tags)) score += 10;
    if (/(suite|master)/.test(text) && /suite|master/.test(tags)) score += 8;
    return score;
  }

  function recommend(textOrIntent, limit) {
    const intent = typeof textOrIntent === "object" && textOrIntent ? textOrIntent : { rawInput: String(textOrIntent || "") };
    const text = intent.rawInput || String(textOrIntent || "");
    const family = intent.family || detectIntent(text) || FAMILY_FREE;
    const lot = intent.lot || parseLot(text);
    return TEMPLATES.map((model) => ({ model, score: scoreTemplate(model, { text, lot, family }) }))
      .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id))
      .slice(0, limit || 3)
      .map((item) => item.model);
  }

  function buildCommand(model, lot) {
    const lotText = lot ? ` em terreno ${lot.label}` : "";
    return [
      `Gerar planta baixa de casa terrea de 3 quartos com suite${lotText}.`,
      `Familia: ${model.family}.`,
      `Tipologia escolhida: ${model.name}.`,
      `Estrategia: ${model.strategy}.`,
      "Programa minimo: sala, jantar, cozinha, area de servico, banheiro social, quarto 1, quarto 2 e suite.",
      "Respeitar recuos, taxa de ocupacao, medidas minimas, ventilacao cruzada, iluminacao natural, portas, janelas, privacidade da suite e circulacao funcional.",
      `Diretriz: ${model.description}`
    ].join(" ");
  }

  window.CadistaThreeBedroomLibrary = {
    families: { socialIntegratedSuite: FAMILY_SOCIAL, suiteFree: FAMILY_FREE },
    family: FAMILY_FREE,
    templates: TEMPLATES,
    groups: GROUPS,
    detectIntent,
    detectSocialFamily,
    parseLot,
    recommend,
    buildCommand
  };
})();

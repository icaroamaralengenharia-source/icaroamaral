(function (root) {
  "use strict";

  const VERSION = "20260704-elo-budget-eap-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function number(value) {
    const parsed = Number(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function slug(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "item";
  }
  function unique(items) {
    const seen = {};
    return (items || []).filter(function (item) {
      const key = normalize(item);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  const STAGES = {
    premissas: "Premissas",
    preliminares: "Servicos preliminares",
    movimento_terra: "Movimento de terra",
    fundacao_baldrame: "Fundacao / baldrame",
    alvenaria: "Alvenaria",
    instalacoes: "Instalacoes",
    estrutura_superior: "Estrutura superior / forro / laje",
    cobertura: "Cobertura",
    revestimentos: "Revestimentos",
    pisos_paredes: "Pisos e paredes",
    esquadrias: "Esquadrias",
    loucas_metais: "Loucas e metais",
    pintura: "Pintura",
    finalizacao: "Finalizacao",
    reforma_banheiro: "Reforma de banheiro"
  };

  function stageList(ids) {
    return ids.map(function (id, index) {
      return { id: id, ordem: index + 1, nome: STAGES[id] || id.replace(/_/g, " ") };
    });
  }

  function item(stageId, nome, disciplina, unidadeEsperada, termosBusca, quantidadeBase, options) {
    const safe = options || {};
    return {
      id: safe.id || stageId + "_" + slug(nome),
      etapaId: stageId,
      nome: nome,
      disciplina: disciplina,
      unidadeEsperada: unidadeEsperada || "un",
      obrigatorio: safe.obrigatorio !== false,
      origem: "eap-canonica",
      termosBusca: termosBusca || [nome],
      quantidadeBase: quantidadeBase || null,
      pendencias: (safe.pendencias || []).slice(),
      bloqueadores: (safe.bloqueadores || []).slice()
    };
  }

  function quantity(value, unit, source) {
    return value ? { valor: value, unidade: unit, origem: source || "inferida" } : null;
  }

  const PRMA_COMPOSITION_POLICY_STATUS = {
    AUTO_RESOLVE: "AUTO_RESOLVE",
    DECOMPOSE_REQUIRED: "DECOMPOSE_REQUIRED",
    KEEP_PENDING: "KEEP_PENDING"
  };

  const PRMA_COMPOSITION_POLICIES = {
    prma_reservatorio_1000l: { status: PRMA_COMPOSITION_POLICY_STATUS.AUTO_RESOLVE, compositionStatus: "auto_resolve", searchable: true, terms: ["caixa d agua 1000 litros fornecimento instalacao"] },
    prma_padrao_entrada: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_quadro_distribuicao: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_dps: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_aterramento: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_ligacao_agua: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_saida_esgoto: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_caixas_passagem_piso: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_caixas_passagem_laje: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_refletores_externos: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_equip_chuveiro_eletrico: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_equip_maquina_lavar: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_equip_geladeira: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_equip_microondas: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_equip_forno_eletrico: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_equip_cooktop: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_equip_coifa_depurador: { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" },
    prma_dr: { status: PRMA_COMPOSITION_POLICY_STATUS.KEEP_PENDING, compositionStatus: "pending" },
    prma_infra_telecom: { status: PRMA_COMPOSITION_POLICY_STATUS.KEEP_PENDING, compositionStatus: "pending" },
    prma_infra_cameras: { status: PRMA_COMPOSITION_POLICY_STATUS.KEEP_PENDING, compositionStatus: "pending" },
    prma_equip_ar_condicionado_espera: { status: PRMA_COMPOSITION_POLICY_STATUS.KEEP_PENDING, compositionStatus: "pending" },
    prma_cond_spda_completo: { status: PRMA_COMPOSITION_POLICY_STATUS.KEEP_PENDING, compositionStatus: "pending" }
  };

  function getEloPrmaCompositionPolicy_(entry) {
    const serviceId = clean(entry && entry.serviceId);
    const direct = PRMA_COMPOSITION_POLICIES[serviceId];
    if (direct) return direct;
    if (/^prma_room_/.test(serviceId)) return { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" };
    return { status: PRMA_COMPOSITION_POLICY_STATUS.DECOMPOSE_REQUIRED, compositionStatus: "decompose_required" };
  }

  function getEloPrmaQuantityItems_(input) {
    const safe = input || {};
    const pack = safe.budgetPackage || {};
    const quantities = Array.isArray(pack.quantities) ? pack.quantities : [];
    return quantities.filter(function (entry) { return entry && entry.source === "prma" && entry.serviceId && Number(entry.quantity) > 0; });
  }

  function mapEloPrmaCategoryToStage_(entry) {
    const text = normalize([entry.serviceId, entry.description, entry.category, entry.classification].join(" "));
    if (/banheiro|chuveiro|loucas|metais/.test(text)) return "loucas_metais";
    return "instalacoes";
  }

  function prmaAutoResolvePolicy_(terms) {
    return { status: PRMA_COMPOSITION_POLICY_STATUS.AUTO_RESOLVE, compositionStatus: "auto_resolve", searchable: true, terms: terms || [] };
  }

  function prmaPendingPolicy_() {
    return { status: PRMA_COMPOSITION_POLICY_STATUS.KEEP_PENDING, compositionStatus: "pending" };
  }

  function prmaPendingValidationPolicy_() {
    return { status: PRMA_COMPOSITION_POLICY_STATUS.KEEP_PENDING, compositionStatus: "pending_validation" };
  }

  const PRMA_ATERRAMENTO_DUPLICITY_WARNING = "Confirmar se o padr\u00e3o de entrada e o aterramento geral compartilham o mesmo conjunto antes da precifica\u00e7\u00e3o.";
  const PRMA_OFFICIAL_KIT_POLICIES = {
    prma_room_banheiro_completo_vaso_sanitario: {
      kitServiceId: "prma_room_banheiro_completo_kit_vaso_sanitario_caixa_acoplada",
      description: "Kit oficial de vaso sanitario com caixa acoplada",
      compositionStatus: "pending_selection",
      officialCandidates: [
        { code: "86931", description: "VASO SANITARIO SIFONADO COM CAIXA ACOPLADA LOUCA BRANCA, INCLUSO ENGATE FLEXIVEL EM PLASTICO BRANCO, 1/2 X 40CM - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" },
        { code: "86932", description: "VASO SANITARIO SIFONADO COM CAIXA ACOPLADA LOUCA BRANCA - PADRAO MEDIO, INCLUSO ENGATE FLEXIVEL EM METAL CROMADO, 1/2 X 40CM - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" }
      ],
      absorbedServiceIds: [
        "prma_room_banheiro_completo_vaso_sanitario",
        "prma_room_banheiro_completo_caixa_descarga",
        "prma_room_banheiro_completo_engate_flexivel"
      ],
      technicalAliases: ["prma_room_banheiro_completo_caixa_acoplada_descarga"],
      actualAbsorbedServiceIds: [
        "prma_room_banheiro_completo_vaso_sanitario",
        "prma_room_banheiro_completo_caixa_descarga",
        "prma_room_banheiro_completo_engate_flexivel"
      ]
    },
    prma_room_banheiro_completo_kit_lavatorio: {
      kitServiceId: "prma_room_banheiro_completo_kit_lavatorio",
      description: "Kit oficial de lavatorio do banheiro",
      compositionStatus: "pending_selection",
      officialCandidates: [
        { code: "86939", description: "LAVATORIO LOUCA BRANCA COM COLUNA, PADRAO POPULAR, INCLUSO SIFAO FLEXIVEL EM PVC, VALVULA, ENGATE FLEXIVEL E TORNEIRA CROMADA - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" },
        { code: "86941", description: "LAVATORIO LOUCA BRANCA COM COLUNA, PADRAO MEDIO, INCLUSO SIFAO TIPO GARRAFA, VALVULA, ENGATE FLEXIVEL E TORNEIRA CROMADA - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" },
        { code: "86942", description: "LAVATORIO LOUCA BRANCA SUSPENSO, PADRAO POPULAR, INCLUSO SIFAO TIPO GARRAFA EM PVC, VALVULA, ENGATE FLEXIVEL E TORNEIRA CROMADA - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" },
        { code: "86943", description: "LAVATORIO LOUCA BRANCA SUSPENSO, PADRAO POPULAR, INCLUSO SIFAO FLEXIVEL EM PVC, VALVULA, ENGATE FLEXIVEL E TORNEIRA CROMADA - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" }
      ],
      absorbedServiceIds: [
        "prma_room_banheiro_completo_lavatorio_cuba",
        "prma_room_banheiro_completo_torneira_lavatorio",
        "prma_room_banheiro_completo_valvula_lavatorio",
        "prma_room_banheiro_completo_sifao"
      ],
      excludedAbsorptionServiceIds: ["prma_room_banheiro_completo_engate_flexivel"],
      technicalWarnings: ["Existe apenas um engate flexivel generico no banheiro; ele permanece absorvido pelo kit de vaso. O lavatorio pode exigir engate proprio em refinamento futuro."]
    },
    prma_room_cozinha_kit_cuba_pia: {
      kitServiceId: "prma_room_cozinha_kit_cuba_pia",
      description: "Kit oficial de cuba ou pia da cozinha",
      compositionStatus: "pending_selection",
      officialCandidates: [
        { code: "86935", description: "CUBA DE EMBUTIR DE ACO INOXIDAVEL MEDIA, INCLUSO VALVULA TIPO AMERICANA EM METAL CROMADO E SIFAO FLEXIVEL EM PVC - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" },
        { code: "86936", description: "CUBA DE EMBUTIR DE ACO INOXIDAVEL MEDIA, INCLUSO VALVULA TIPO AMERICANA E SIFAO TIPO GARRAFA EM METAL CROMADO - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" }
      ],
      absorbedServiceIds: [
        "prma_room_cozinha_cuba_pia",
        "prma_room_cozinha_valvula_pia",
        "prma_room_cozinha_sifao"
      ],
      excludedAbsorptionServiceIds: [
        "prma_room_cozinha_torneira",
        "prma_room_cozinha_engate"
      ],
      technicalWarnings: ["Confirmar engates e ligacoes flexiveis conforme o modelo de cuba, torneira e instalacao selecionados."]
    },
    prma_room_area_servico_kit_tanque: {
      kitServiceId: "prma_room_area_servico_kit_tanque",
      description: "Kit oficial de tanque da area de servico",
      compositionStatus: "pending_selection",
      officialCandidates: [
        { code: "86919", description: "TANQUE DE LOUCA BRANCA COM COLUNA, INCLUSO SIFAO FLEXIVEL EM PVC, VALVULA METALICA E TORNEIRA DE METAL CROMADO PADRAO MEDIO - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" },
        { code: "86920", description: "TANQUE DE LOUCA BRANCA COM COLUNA, INCLUSO SIFAO FLEXIVEL EM PVC, VALVULA PLASTICA E TORNEIRA DE METAL CROMADO PADRAO POPULAR - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" },
        { code: "86921", description: "TANQUE DE LOUCA BRANCA COM COLUNA, INCLUSO SIFAO FLEXIVEL EM PVC, VALVULA PLASTICA E TORNEIRA DE PLASTICO - FORNECIMENTO E INSTALACAO. AF_01/2020", unit: "un" }
      ],
      absorbedServiceIds: [
        "prma_room_area_servico_tanque",
        "prma_room_area_servico_torneira_tanque",
        "prma_room_area_servico_valvula_tanque",
        "prma_room_area_servico_sifao_tanque"
      ],
      excludedAbsorptionServiceIds: ["prma_room_area_servico_engate_flexivel"],
      technicalWarnings: ["Confirmar ligacao flexivel e conexoes conforme o modelo de tanque, torneira e instalacao selecionados."]
    }
  };

  function buildEloPrmaEapItem_(entry, overrides) {
    const safe = overrides || {};
    const serviceId = clean(safe.serviceId || entry.serviceId);
    const stageId = safe.stageId || mapEloPrmaCategoryToStage_(entry);
    const unit = clean(safe.unit || entry.unit || "un");
    const policy = safe.policy || getEloPrmaCompositionPolicy_(entry);
    const searchable = policy.searchable === true;
    const amount = safe.quantity === null ? null : (safe.quantity !== undefined ? safe.quantity : entry.quantity);
    const terms = searchable ? unique(policy.terms || [safe.description, serviceId, entry.category, entry.classification]) : unique([serviceId, policy.compositionStatus]);
    const mapped = item(stageId, clean(safe.description || entry.description || serviceId), safe.category || entry.category || entry.classification || "prma", unit, terms, quantity(amount, unit, "prma"), { id: "prma_" + slug(serviceId), obrigatorio: searchable });
    mapped.origem = "prma";
    mapped.source = "prma";
    mapped.serviceId = serviceId;
    mapped.parentServiceId = safe.parentServiceId || null;
    mapped.classification = safe.classification || entry.classification || "prma";
    mapped.compositionPolicy = policy.status;
    mapped.compositionStatus = policy.compositionStatus;
    mapped.compositionSearchable = searchable;
    if (safe.technicalWarnings && safe.technicalWarnings.length) mapped.technicalWarnings = safe.technicalWarnings.slice();
    if (safe.scopeContext) mapped.scopeContext = { environmentType: safe.scopeContext.environmentType, category: safe.scopeContext.category };
    mapped.prma = { serviceId: serviceId, parentServiceId: mapped.parentServiceId, classification: mapped.classification || null, source: "prma", compositionPolicy: policy.status };
    return mapped;
  }
  function buildEloPrmaOfficialKitItem_(entry, kitPolicy, officialKitSelections) {
    const selectedCode = clean((officialKitSelections || {})[kitPolicy.kitServiceId]);
    const selectedCandidate = selectedCode ? kitPolicy.officialCandidates.find(function (candidate) { return candidate.code === selectedCode; }) : null;
    const selectionWarning = selectedCode && !selectedCandidate ? "Código oficial não pertence às opções permitidas para este kit." : null;
    const compositionStatus = selectedCandidate ? "selected_pending_resolution" : kitPolicy.compositionStatus;
    const policy = { status: PRMA_COMPOSITION_POLICY_STATUS.KEEP_PENDING, compositionStatus: compositionStatus };
    const mapped = buildEloPrmaEapItem_(entry, {
      serviceId: kitPolicy.kitServiceId,
      description: kitPolicy.description,
      quantity: entry.quantity,
      unit: "un",
      classification: entry.classification || "PER_ROOM",
      category: "prma_kit_oficial_loucas_metais",
      parentServiceId: entry.serviceId,
      policy: policy,
      technicalWarnings: selectionWarning ? [selectionWarning] : []
    });
    mapped.officialKit = {
      source: "SINAPI",
      status: compositionStatus,
      selectionRequired: true,
      candidates: kitPolicy.officialCandidates.slice(),
      absorbedServiceIds: kitPolicy.absorbedServiceIds.slice(),
      technicalAliases: (kitPolicy.technicalAliases || []).slice(),
      excludedAbsorptionServiceIds: (kitPolicy.excludedAbsorptionServiceIds || []).slice()
    };
    if (selectedCandidate) {
      mapped.selectedOfficialCode = selectedCandidate.code;
      mapped.selectedOfficialDescription = selectedCandidate.description;
      mapped.selectedOfficialUnit = selectedCandidate.unit;
      mapped.officialKit.selectedOfficialCode = selectedCandidate.code;
      mapped.officialKit.selectedOfficialDescription = selectedCandidate.description;
      mapped.officialKit.selectedOfficialUnit = selectedCandidate.unit;
    }
    mapped.officialCandidates = kitPolicy.officialCandidates.slice();
    mapped.absorbedServiceIds = kitPolicy.absorbedServiceIds.slice();
    mapped.technicalAliases = (kitPolicy.technicalAliases || []).slice();
    mapped.excludedAbsorptionServiceIds = (kitPolicy.excludedAbsorptionServiceIds || []).slice();
    if (kitPolicy.technicalWarnings && kitPolicy.technicalWarnings.length) {
      mapped.technicalWarnings = (mapped.technicalWarnings || []).concat(kitPolicy.technicalWarnings);
    }
    return mapped;
  }

  function applyEloPrmaOfficialKitAbsorption_(subitems, kitItem, kitPolicy) {
    const absorbed = kitPolicy.actualAbsorbedServiceIds || kitPolicy.absorbedServiceIds || [];
    subitems.forEach(function (subitem) {
      if (absorbed.indexOf(subitem.serviceId) === -1) return;
      if (subitem.absorbedByOfficialKitServiceId && subitem.absorbedByOfficialKitServiceId !== kitItem.serviceId) return;
      subitem.compositionStatus = "absorbed_by_official_kit";
      subitem.compositionSearchable = false;
      subitem.absorbedByOfficialKitServiceId = kitItem.serviceId;
      subitem.absorbedByOfficialKitCandidates = kitPolicy.officialCandidates.map(function (candidate) { return candidate.code; });
    });
  }

  function getEloPrmaFixedElectricalDecomposition_(entry) {
    const parentServiceId = clean(entry && entry.serviceId);
    const specs = {
      prma_padrao_entrada: [
        ["caixa_medicao", "Caixa de medicao do padrao de entrada", 1, prmaPendingValidationPolicy_()],
        ["disjuntor_entrada", "Disjuntor de entrada do padrao", 1, prmaPendingValidationPolicy_()],
        ["eletroduto_entrada", "Eletroduto de entrada do padrao", null, prmaPendingPolicy_()],
        ["condutores_ramal", "Condutores do ramal de entrada", null, prmaPendingPolicy_()],
        ["aterramento_padrao", "Aterramento do padrao de entrada", null, prmaPendingPolicy_()],
        ["haste_aterramento", "Haste de aterramento do padrao", 1, prmaPendingValidationPolicy_(), [PRMA_ATERRAMENTO_DUPLICITY_WARNING]],
        ["caixa_inspecao", "Caixa de inspecao de aterramento do padrao", 1, prmaPendingValidationPolicy_(), [PRMA_ATERRAMENTO_DUPLICITY_WARNING]],
        ["estrutura_civil_suporte", "Estrutura civil de suporte do padrao", null, prmaPendingPolicy_()]
      ],
      prma_quadro_distribuicao: [
        ["quadro_distribuicao", "Quadro de distribuicao eletrica", 1, prmaPendingValidationPolicy_()],
        ["barramento_neutro", "Barramento de neutro do quadro", 1, prmaPendingValidationPolicy_()],
        ["barramento_terra", "Barramento de terra do quadro", 1, prmaPendingValidationPolicy_()],
        ["trilho_din", "Trilho DIN do quadro", 1, prmaPendingValidationPolicy_()],
        ["identificacao_circuitos", "Identificacao de circuitos do quadro", 1, prmaPendingPolicy_()],
        ["reserva_tecnica", "Reserva tecnica do quadro", null, prmaPendingPolicy_()]
      ],
      prma_dps: [
        ["dps", "Dispositivo de protecao contra surtos DPS", 1, prmaPendingValidationPolicy_()]
      ],
      prma_aterramento: [
        ["haste_aterramento", "Haste de aterramento", 1, prmaPendingValidationPolicy_(), [PRMA_ATERRAMENTO_DUPLICITY_WARNING]],
        ["condutor_protecao", "Condutor de protecao do aterramento", null, prmaPendingPolicy_()],
        ["caixa_inspecao", "Caixa de inspecao de aterramento", 1, prmaPendingValidationPolicy_(), [PRMA_ATERRAMENTO_DUPLICITY_WARNING]],
        ["conector_aterramento", "Conector de aterramento", 1, prmaPendingValidationPolicy_()]
      ],
      prma_caixas_passagem_piso: [
        ["caixa_passagem_piso", "Caixa de passagem de piso", entry.quantity, prmaPendingValidationPolicy_()]
      ],
      prma_caixas_passagem_laje: [
        ["caixa_passagem_laje_forro", "Caixa de passagem de laje ou forro", entry.quantity, prmaPendingValidationPolicy_()]
      ],
      prma_refletores_externos: [
        ["refletor_led_60w", "Refletor LED 60 W", entry.quantity, prmaPendingValidationPolicy_()],
        ["ponto_eletrico_refletor", "Ponto eletrico para refletor", entry.quantity, prmaPendingValidationPolicy_()]
      ]
    };
    return (specs[parentServiceId] || []).map(function (spec) {
      return buildEloPrmaEapItem_(entry, { serviceId: parentServiceId + "_" + spec[0], description: spec[1], quantity: spec[2], unit: "un", classification: "atomic_fixed_electrical", category: "prma_subitem_eletrica_fixa", parentServiceId: parentServiceId, policy: spec[3], technicalWarnings: spec[4] || [] });
    });
  }

  function getEloPrmaGeneralHydraulicAtomicSubitems_(entry) {
    const parentServiceId = clean(entry && entry.serviceId);
    const policy = prmaPendingValidationPolicy_();
    const specs = {
      prma_ligacao_agua: [
        ["ligacao_predial_agua", "Ligacao predial de agua", 1, "servico"], ["registro_geral", "Registro geral da ligacao de agua", 1, "un"],
        ["cavalete", "Cavalete da ligacao de agua", 1, "un"], ["hidrometro", "Hidrometro condicionado ao escopo", 1, "un"],
        ["entrada_rede_reservatorio", "Entrada da rede ate o reservatorio", null, "un"], ["conexoes_entrada", "Conexoes da entrada de agua", null, "un"],
        ["teste_ligacao", "Teste da ligacao de agua", 1, "servico"]
      ],
      prma_reservatorio_1000l: [
        ["reservatorio_1000l", "Reservatorio 1000 L", 1, "un"], ["tampa", "Tampa do reservatorio", 1, "un"], ["torneira_boia", "Torneira boia do reservatorio", 1, "un"],
        ["registro_saida", "Registro de saida do reservatorio", 1, "un"], ["extravasor", "Extravasor do reservatorio", 1, "un"], ["limpeza_inicial", "Limpeza inicial do reservatorio", 1, "servico"],
        ["barrilete", "Barrilete do reservatorio", null, "un"], ["suportes_conexoes", "Suportes e conexoes do reservatorio", null, "un"]
      ],
      prma_saida_esgoto: [
        ["ligacao_predial_esgoto", "Ligacao predial de esgoto", 1, "servico"], ["caixa_inspecao_principal", "Caixa de inspecao principal", 1, "un"],
        ["caixa_gordura", "Caixa de gordura", 1, "un"], ["coletor_predial", "Coletor predial", null, "un"], ["ventilacao_sanitaria_geral", "Ventilacao sanitaria geral", null, "un"],
        ["escavacao_reaterro", "Escavacao e reaterro da ligacao de esgoto", null, "un"], ["teste_rede", "Teste da rede de esgoto", 1, "servico"]
      ]
    };
    return (specs[parentServiceId] || []).map(function (spec) {
      return buildEloPrmaEapItem_(entry, { serviceId: parentServiceId + "_" + spec[0], description: spec[1], quantity: spec[2], unit: spec[3], classification: "FIXED_PER_HOUSE", category: "prma_subitem_hidraulica_geral", parentServiceId: parentServiceId, policy: policy });
    });
  }

  function getEloPrmaBathroomAtomicSubitems_(entry) {
    if (clean(entry && entry.serviceId) !== "prma_room_banheiro_completo") return [];
    const bathrooms = number(entry.quantity);
    if (bathrooms <= 0) return [];
    const parentServiceId = "prma_room_banheiro_completo";
    const policy = prmaPendingValidationPolicy_();
    const scopeCategories = { vaso_sanitario: "fixture", caixa_descarga: "fixture", assento_sanitario: "fixture", lavatorio_cuba: "fixture", torneira_lavatorio: "metal", valvula_lavatorio: "metal", sifao: "metal", engate_flexivel: "metal", registro_pressao: "metal", acabamento_registro: "metal", porta_papel: "accessory", saboneteira: "accessory", porta_toalha_rosto: "accessory", porta_toalha_banho: "accessory", cabide: "accessory", espelho: "accessory", box_preliminar: "accessory" };
    const specs = [
      ["vaso_sanitario", "Vaso sanitario do banheiro", 1, "loucas_metais"],
      ["caixa_descarga", "Caixa acoplada ou descarga do banheiro", 1, "loucas_metais"],
      ["assento_sanitario", "Assento sanitario do banheiro", 1, "loucas_metais"],
      ["lavatorio_cuba", "Lavatorio ou cuba do banheiro", 1, "loucas_metais"],
      ["torneira_lavatorio", "Torneira de lavatorio do banheiro", 1, "loucas_metais"],
      ["valvula_lavatorio", "Valvula de lavatorio do banheiro", 1, "loucas_metais"],
      ["sifao", "Sifao do banheiro", 1, "loucas_metais"],
      ["engate_flexivel", "Engate flexivel do banheiro", 1, "loucas_metais"],
      ["registro_pressao", "Registro de pressao do banheiro", 1, "loucas_metais"],
      ["acabamento_registro", "Acabamento de registro do banheiro", 1, "loucas_metais"],
      ["porta_papel", "Porta-papel do banheiro", 1, "loucas_metais"], ["saboneteira", "Saboneteira do banheiro", 1, "loucas_metais"],
      ["porta_toalha_rosto", "Porta-toalha de rosto do banheiro", 1, "loucas_metais"], ["porta_toalha_banho", "Porta-toalha de banho do banheiro", 1, "loucas_metais"],
      ["cabide", "Cabide do banheiro", 1, "loucas_metais"], ["espelho", "Espelho do banheiro", 1, "loucas_metais"], ["box_preliminar", "Box preliminar do banheiro", 1, "loucas_metais"],
      ["agua_fria_vaso", "Ponto de agua fria para vaso", 1, "hidraulica"], ["agua_fria_lavatorio", "Ponto de agua fria para lavatorio", 1, "hidraulica"], ["agua_fria_chuveiro", "Ponto de agua fria para chuveiro", 1, "hidraulica"],
      ["esgoto_vaso", "Ponto de esgoto para vaso", 1, "esgoto"], ["esgoto_lavatorio", "Ponto de esgoto para lavatorio", 1, "esgoto"], ["esgoto_area_banho", "Ponto de esgoto da area de banho", 1, "esgoto"],
      ["ralo", "Ralo do banheiro", 1, "esgoto"], ["caixa_sifonada", "Caixa sifonada do banheiro", 1, "esgoto"],
      ["iluminacao_central", "Ponto de iluminacao central do banheiro", 1, "eletrica"], ["iluminacao_espelho", "Ponto de iluminacao do espelho do banheiro", 1, "eletrica"],
      ["interruptor", "Interruptor do banheiro", 1, "eletrica"], ["tomada_600va", "Tomada de 600 VA do banheiro", 2, "eletrica"], ["caixa_espelho_tomada", "Caixa e espelho de tomada do banheiro", 2, "eletrica"]
    ];
    return specs.map(function (spec) {
      const scopeCategory = spec[3] === "loucas_metais" ? scopeCategories[spec[0]] : null;
      return buildEloPrmaEapItem_(entry, { serviceId: parentServiceId + "_" + spec[0], description: spec[1], quantity: spec[2] * bathrooms, unit: "un", classification: "PER_ROOM", category: "prma_subitem_banheiro_" + spec[3], parentServiceId: parentServiceId, policy: policy, scopeContext: scopeCategory ? { environmentType: "bathroom", category: scopeCategory } : null });
    });
  }

  function getEloPrmaKitchenAtomicSubitems_(entry) {
    if (clean(entry && entry.serviceId) !== "prma_room_cozinha") return [];
    const kitchens = number(entry.quantity);
    if (kitchens <= 0) return [];
    const parentServiceId = "prma_room_cozinha";
    const policy = prmaPendingValidationPolicy_();
    const specs = [
      ["tomada_600va", "Tomada geral de 600 VA da cozinha", 4, "eletrica"], ["ponto_geladeira", "Ponto dedicado para geladeira", 1, "eletrica"],
      ["ponto_microondas", "Ponto dedicado para micro-ondas", 1, "eletrica"], ["ponto_forno_eletrico", "Ponto dedicado para forno eletrico", 1, "eletrica"],
      ["ponto_cooktop", "Ponto dedicado para cooktop", 1, "eletrica"], ["ponto_coifa_depurador", "Ponto dedicado para coifa ou depurador", 1, "eletrica"],
      ["ponto_lava_loucas", "Ponto reservado para lava-loucas", 1, "eletrica"], ["iluminacao_central", "Ponto de iluminacao central da cozinha", 1, "eletrica"],
      ["iluminacao_bancada", "Ponto de iluminacao de bancada da cozinha", 1, "eletrica"], ["iluminacao_pia_armarios", "Ponto de iluminacao sobre pia ou armarios", 1, "eletrica"],
      ["interruptor_conjunto", "Interruptor ou conjunto da cozinha", 2, "eletrica"], ["agua_fria_pia", "Ponto de agua fria da pia", 1, "hidraulica"],
      ["esgoto_pia", "Ponto de esgoto da pia", 1, "esgoto"], ["registro_setor", "Registro de setor da cozinha", 1, "hidraulica"],
      ["valvula_pia", "Valvula da pia da cozinha", 1, "loucas_metais"], ["sifao", "Sifao da pia da cozinha", 1, "loucas_metais"], ["engate", "Engate da cozinha", 2, "loucas_metais"],
      ["ponto_filtro_reserva", "Ponto de filtro da cozinha como reserva", 1, "hidraulica"], ["ponto_hidraulico_lava_loucas_reserva", "Ponto hidraulico para lava-loucas como reserva", 1, "hidraulica"],
      ["ponto_esgoto_lava_loucas_reserva", "Ponto de esgoto para lava-loucas como reserva", 1, "esgoto"], ["cuba_pia", "Cuba ou pia da cozinha", 1, "loucas_metais"], ["torneira", "Torneira da cozinha", 1, "loucas_metais"]
    ];
    return specs.map(function (spec) {
      return buildEloPrmaEapItem_(entry, { serviceId: parentServiceId + "_" + spec[0], description: spec[1], quantity: spec[2] * kitchens, unit: "un", classification: "PER_ROOM", category: "prma_subitem_cozinha_" + spec[3], parentServiceId: parentServiceId, policy: policy });
    });
  }

  function getEloPrmaServiceAreaAtomicSubitems_(entry) {
    if (clean(entry && entry.serviceId) !== "prma_room_area_servico") return [];
    const serviceAreas = number(entry.quantity);
    if (serviceAreas <= 0) return [];
    const parentServiceId = "prma_room_area_servico";
    const policy = prmaPendingValidationPolicy_();
    const specs = [
      ["agua_fria_tanque", "Ponto de agua fria do tanque", 1, "hidraulica"], ["esgoto_tanque", "Ponto de esgoto do tanque", 1, "esgoto"],
      ["agua_fria_maquina_lavar", "Ponto de agua fria da maquina de lavar", 1, "hidraulica"], ["esgoto_maquina_lavar", "Ponto de esgoto da maquina de lavar", 1, "esgoto"],
      ["ralo", "Ralo da area de servico", 1, "esgoto"], ["caixa_sifonada", "Caixa sifonada da area de servico", 1, "esgoto"],
      ["registro_setor", "Registro de setor da area de servico", 1, "hidraulica"], ["valvula_tanque", "Valvula do tanque", 1, "loucas_metais"],
      ["sifao_tanque", "Sifao do tanque", 1, "loucas_metais"], ["engate_flexivel", "Engate flexivel da area de servico", 1, "loucas_metais"],
      ["tanque", "Tanque da area de servico", 1, "loucas_metais"], ["torneira_tanque", "Torneira do tanque", 1, "loucas_metais"],
      ["tomada_servico_tanque", "Tomada de servico proxima ao tanque", 1, "eletrica"], ["tomada_maquina_lavar", "Tomada dedicada da maquina de lavar", 1, "eletrica"],
      ["tomada_auxiliar", "Tomada auxiliar da area de servico", 1, "eletrica"], ["iluminacao_central", "Ponto de iluminacao central da area de servico", 1, "eletrica"],
      ["interruptor", "Interruptor da area de servico", 1, "eletrica"], ["caixa_espelho", "Caixa e espelho da area de servico", 3, "eletrica"],
      ["infraestrutura_varal", "Infraestrutura de varal pendente", 1, "reserva"]
    ];
    return specs.map(function (spec) {
      return buildEloPrmaEapItem_(entry, { serviceId: parentServiceId + "_" + spec[0], description: spec[1], quantity: spec[2] * serviceAreas, unit: "un", classification: "PER_ROOM", category: "prma_subitem_area_servico_" + spec[3], parentServiceId: parentServiceId, policy: policy });
    });
  }

  function buildEloPrmaEapItems_(input) {
    const items = [];
    const officialKitSelections = (input && input.officialKitSelections) || {};
    getEloPrmaQuantityItems_(input).forEach(function (entry) {
      items.push(buildEloPrmaEapItem_(entry));
      getEloPrmaFixedElectricalDecomposition_(entry).forEach(function (subitem) { items.push(subitem); });
      getEloPrmaGeneralHydraulicAtomicSubitems_(entry).forEach(function (subitem) {
        subitem.disciplina = clean(entry.serviceId) === "prma_saida_esgoto" ? "esgoto" : "hidraulica";
        subitem.etapaId = "instalacoes";
        if (!items.some(function (item) { return item.serviceId === subitem.serviceId; })) items.push(subitem);
      });
      getEloPrmaBathroomAtomicSubitems_(entry).forEach(function (subitem) {
        const serviceId = clean(subitem.serviceId);
        subitem.disciplina = /_(agua_fria)_/.test(serviceId) ? "hidraulica" : (/_(esgoto)_|_ralo$|_caixa_sifonada$/.test(serviceId) ? "esgoto" : (/_(iluminacao)_|_interruptor$|_tomada_600va$|_caixa_espelho_tomada$/.test(serviceId) ? "eletrica" : "loucas_metais"));
        subitem.etapaId = subitem.disciplina === "loucas_metais" ? "loucas_metais" : "instalacoes";
        items.push(subitem);
      });
      if (clean(entry.serviceId) === "prma_room_banheiro_completo") {
        [
          PRMA_OFFICIAL_KIT_POLICIES.prma_room_banheiro_completo_vaso_sanitario,
          PRMA_OFFICIAL_KIT_POLICIES.prma_room_banheiro_completo_kit_lavatorio
        ].forEach(function (kitPolicy) {
          const kitItem = buildEloPrmaOfficialKitItem_(entry, kitPolicy, officialKitSelections);
          applyEloPrmaOfficialKitAbsorption_(items, kitItem, kitPolicy);
          if (!items.some(function (item) { return item.serviceId === kitItem.serviceId; })) items.push(kitItem);
        });
      }
      getEloPrmaKitchenAtomicSubitems_(entry).forEach(function (subitem) {
        subitem.disciplina = clean(subitem.disciplina).replace("prma_subitem_cozinha_", "");
        subitem.etapaId = subitem.disciplina === "loucas_metais" ? "loucas_metais" : "instalacoes";
        if (!items.some(function (item) { return item.serviceId === subitem.serviceId; })) items.push(subitem);
      });
      if (clean(entry.serviceId) === "prma_room_cozinha") {
        const kitPolicy = PRMA_OFFICIAL_KIT_POLICIES.prma_room_cozinha_kit_cuba_pia;
        const kitItem = buildEloPrmaOfficialKitItem_(entry, kitPolicy, officialKitSelections);
        applyEloPrmaOfficialKitAbsorption_(items, kitItem, kitPolicy);
        if (!items.some(function (item) { return item.serviceId === kitItem.serviceId; })) items.push(kitItem);
      }
      getEloPrmaServiceAreaAtomicSubitems_(entry).forEach(function (subitem) {
        subitem.disciplina = clean(subitem.disciplina).replace("prma_subitem_area_servico_", "");
        if (subitem.disciplina === "reserva") subitem.disciplina = "instalacoes";
        subitem.etapaId = subitem.disciplina === "loucas_metais" ? "loucas_metais" : "instalacoes";
        if (!items.some(function (item) { return item.serviceId === subitem.serviceId; })) items.push(subitem);
      });
      if (clean(entry.serviceId) === "prma_room_area_servico") {
        const kitPolicy = PRMA_OFFICIAL_KIT_POLICIES.prma_room_area_servico_kit_tanque;
        const kitItem = buildEloPrmaOfficialKitItem_(entry, kitPolicy, officialKitSelections);
        applyEloPrmaOfficialKitAbsorption_(items, kitItem, kitPolicy);
        if (!items.some(function (item) { return item.serviceId === kitItem.serviceId; })) items.push(kitItem);
      }
    });
    return items;
  }
  function getEloDetailedRoomRequirements_(input) {
    const safe = input || {};
    const packageRoomRequirements = safe.budgetPackage && safe.budgetPackage.roomRequirements || null;
    const directRoomRequirements = safe.roomRequirements || null;
    const roomRequirements = packageRoomRequirements || directRoomRequirements;
    if (roomRequirements && roomRequirements.totals) {
      return { available: true, totals: roomRequirements.totals };
    }
    return { available: false, totals: null };
  }

  function buildEloDetailedRoomRequirementItems_(roomRequirements) {
    const totals = roomRequirements && roomRequirements.totals || {};
    const electrical = totals.electrical || {};
    const hydraulic = totals.hydraulic || {};
    const fixtures = hydraulic.fixtures || {};
    const items = [];
    function add(nome, disciplina, unidade, termosBusca, value, source) {
      const amount = number(value);
      if (amount <= 0) return;
      items.push(item("instalacoes", nome, disciplina, unidade || "un", termosBusca, quantity(amount, unidade || "un", source)));
    }
    add("pontos de iluminacao", "eletrica", "un", ["ponto iluminacao", "iluminacao"], electrical.lightingPoints, "roomRequirements");
    add("interruptores", "eletrica", "un", ["interruptor"], electrical.switchPoints, "roomRequirements");
    add("tomadas de uso geral", "eletrica", "un", ["tomada uso geral", "tug"], electrical.generalOutletPoints, "roomRequirements");
    add("tomadas de uso especifico", "eletrica", "un", ["tomada uso especifico", "tue"], electrical.dedicatedOutletPoints, "roomRequirements");
    add("pontos especiais", "eletrica", "un", ["ponto especial eletrico"], electrical.specialPoints, "roomRequirements");
    add("pontos de agua fria", "hidraulica", "un", ["ponto agua fria"], hydraulic.coldWaterPoints, "roomRequirements");
    add("pontos de agua quente", "hidraulica", "un", ["ponto agua quente"], hydraulic.hotWaterPoints, "roomRequirements");
    add("pontos de esgoto", "esgoto", "un", ["ponto esgoto"], hydraulic.sewagePoints, "roomRequirements");
    add("ralos", "esgoto", "un", ["ralo"], hydraulic.floorDrains, "roomRequirements");
    add("vasos sanitarios", "loucas_metais", "un", ["vaso sanitario"], fixtures.toilet, "roomRequirements");
    add("lavatorios", "loucas_metais", "un", ["lavatorio"], fixtures.washbasin, "roomRequirements");
    add("chuveiros", "loucas_metais", "un", ["chuveiro"], fixtures.shower, "roomRequirements");
    add("pias", "loucas_metais", "un", ["pia cozinha"], fixtures.sink, "roomRequirements");
    add("tanques", "loucas_metais", "un", ["tanque area de servico"], fixtures.tank, "roomRequirements");
    add("pontos de maquina de lavar", "hidraulica", "un", ["maquina de lavar"], fixtures.washingMachine, "roomRequirements");
    return items;
  }

  function inferType(input, text) {
    const type = normalize(input.tipo || input.type || input.projectType || input.tipoObra);
    if (/muro/.test(type) || /\bmuro\b/.test(text)) return "muro";
    if (/banheiro/.test(type) || (/banheiro/.test(text) && /reforma|demolicao|retirada/.test(text))) return "banheiro";
    return "casa";
  }

  function normalizeInput(input) {
    const safe = input || {};
    const text = normalize([safe.originalMessage, safe.message, safe.descricao, safe.description].join(" "));
    const area = number(safe.areaConstruidaM2 || safe.builtAreaM2 || safe.areaM2);
    const length = number(safe.comprimentoM || safe.lengthM || safe.wallLengthM);
    const height = number(safe.alturaM || safe.heightM || safe.wallHeightM);
    const width = number(safe.larguraM || safe.widthM);
    const depth = number(safe.profundidadeM || safe.depthM);
    const ambientes = safe.ambientes || {};
    const bathrooms = number(ambientes.banheiros || safe.banheiros || safe.bathrooms);
    const suites = number(ambientes.suites || safe.suites);
    return {
      raw: safe,
      text: text,
      tipo: inferType(safe, text),
      areaConstruidaM2: area,
      comprimentoM: length,
      alturaM: height,
      larguraM: width,
      profundidadeM: depth,
      uf: clean(safe.uf || safe.state || safe.estado || safe.cityUf),
      padrao: clean(safe.padrao || safe.projectStandard || safe.padraoAcabamento),
      fundacao: clean(safe.fundacao || safe.foundationType),
      ambientes: ambientes,
      banheiros: bathrooms + suites,
      cobertura: clean(safe.cobertura || safe.roofMaterial),
      parede: clean(safe.parede || safe.wallMaterial),
      piso: clean(safe.piso || safe.floorMaterial),
      temAreaServico: Number(ambientes.areaServico || safe.areaServico || 0) > 0,
      temPortao: /portao|portão/.test(text) || safe.portao === true,
      box: /box/.test(text) || safe.box === true || /medio|m[eé]dio/.test(clean(safe.padrao || safe.projectStandard))
    };
  }

  function addProblem(target, id, message, severity) {
    target.push({ id: id, message: message, severity: severity || "alta" });
  }

  function finalize(type, stages, items, pendencias, bloqueadores, assumidos) {
    const itemPending = items.some(function (entry) {
      return entry.obrigatorio && ((entry.pendencias || []).length || (entry.bloqueadores || []).length);
    });
    return {
      version: VERSION,
      tipo: type,
      etapas: stages,
      itens: items,
      pendencias: pendencias,
      bloqueadores: bloqueadores,
      assumidos: assumidos,
      podeFecharOrcamentoCompleto: false,
      podeGerarEstimativaPreliminar: true,
      resumo: {
        totalEtapas: stages.length,
        totalItens: items.length,
        totalPendencias: pendencias.length,
        totalBloqueadores: bloqueadores.length,
        possuiItemObrigatorioPendente: itemPending
      }
    };
  }

  function buildHouseEap(ctx) {
    const pendencias = [];
    const bloqueadores = [];
    const assumidos = [];
    if (!ctx.areaConstruidaM2) addProblem(bloqueadores, "area_construida", "Casa sem area construida informada.", "critica");
    if (!ctx.uf) addProblem(pendencias, "cidade_uf", "Cidade/UF nao informada para base SINAPI/ORSE.", "alta");
    if (!ctx.padrao) assumidos.push("padrao_simples_preliminar");
    if (!ctx.fundacao) {
      assumidos.push("fundacao_superficial_a_confirmar");
      addProblem(pendencias, "tipo_fundacao", "Tipo de fundacao ainda precisa ser confirmado.", "alta");
    }
    if (!ctx.banheiros) addProblem(pendencias, "banheiros", "Numero de banheiros nao informado.", "critica");

    const area = quantity(ctx.areaConstruidaM2, "m2", "area_construida");
    const bathrooms = ctx.banheiros || 1;
    const stages = stageList(["premissas", "preliminares", "movimento_terra", "fundacao_baldrame", "alvenaria", "instalacoes", "estrutura_superior", "cobertura", "revestimentos", "pisos_paredes", "esquadrias", "loucas_metais", "pintura", "finalizacao"]);
    const items = [
      item("premissas", "area construida", "premissas", "m2", ["area construida"], area, { bloqueadores: ctx.areaConstruidaM2 ? [] : ["area_construida"] }),
      item("premissas", "cidade/UF", "premissas", "un", ["cidade uf", "sinapi uf"], null, { pendencias: ctx.uf ? [] : ["cidade_uf"] }),
      item("premissas", "padrao de acabamento", "premissas", "un", ["padrao acabamento"], null),
      item("premissas", "tipo de fundacao", "fundacao", "un", ["tipo fundacao", "sapata", "radier"], null, { pendencias: ctx.fundacao ? [] : ["tipo_fundacao"] }),
      item("preliminares", "limpeza do terreno", "preliminares", "m2", ["limpeza terreno"], area),
      item("preliminares", "locacao da obra", "preliminares", "m2", ["locacao de obra", "gabarito"], area),
      item("movimento_terra", "escavacao de valas/sapatas", "movimento_terra", "m3", ["escavacao valas", "escavacao sapata"]),
      item("movimento_terra", "reaterro compactado", "movimento_terra", "m3", ["reaterro compactado", "compactacao"]),
      item("fundacao_baldrame", "concreto magro quando aplicavel", "fundacao", "m3", ["concreto magro", "lastro concreto"]),
      item("fundacao_baldrame", "forma", "fundacao", "m2", ["forma fundacao", "forma madeira"]),
      item("fundacao_baldrame", "aco", "fundacao", "kg", ["aco ca-50", "armacao fundacao"]),
      item("fundacao_baldrame", "concreto", "fundacao", "m3", ["concreto fundacao", "concreto fck"]),
      item("fundacao_baldrame", "viga baldrame", "fundacao", "m", ["viga baldrame", "concreto viga baldrame"]),
      item("fundacao_baldrame", "impermeabilizacao do baldrame", "impermeabilizacao", "m2", ["impermeabilizacao baldrame", "pintura asfaltica"]),
      item("alvenaria", "alvenaria de bloco/tijolo", "alvenaria", "m2", ["alvenaria bloco ceramico", "bloco tijolo"], area),
      item("alvenaria", "argamassa de assentamento", "alvenaria", "m3", ["argamassa assentamento"]),
      item("alvenaria", "vergas", "alvenaria", "m", ["verga alvenaria"]),
      item("alvenaria", "contravergas", "alvenaria", "m", ["contraverga alvenaria"]),
      item("instalacoes", "eletrica embutida", "eletrica", "pt", ["ponto eletrico", "eletroduto"]),
      item("instalacoes", "hidraulica", "hidraulica", "pt", ["ponto hidraulico", "agua fria"]),
      item("instalacoes", "esgoto sanitario", "esgoto", "pt", ["ponto esgoto", "tubulacao esgoto"]),
      item("instalacoes", "aguas pluviais quando aplicavel", "pluvial", "m", ["aguas pluviais", "condutor pluvial"]),
      item("instalacoes", "caixas/ralos", "instalacoes", "un", ["caixa sifonada", "ralo"]),
      item("instalacoes", "testes", "instalacoes", "un", ["teste estanqueidade", "teste eletrico"]),
      item("estrutura_superior", "vigas/cintas superiores", "estrutura", "m", ["cinta respaldo", "viga superior"]),
      item("estrutura_superior", "laje ou forro conforme input", "estrutura", "m2", ["laje", "forro"], area),
      item("estrutura_superior", "escoramento quando aplicavel", "estrutura", "m2", ["escoramento laje"]),
      item("cobertura", "estrutura do telhado", "cobertura", "m2", ["estrutura telhado", "madeiramento cobertura"], area),
      item("cobertura", "telhamento", "cobertura", "m2", ["telhamento", ctx.cobertura || "telha ceramica"], area),
      item("cobertura", "cumeeira", "cobertura", "m", ["cumeeira"]),
      item("cobertura", "rufos/calhas quando aplicavel", "cobertura", "m", ["rufo", "calha"]),
      item("revestimentos", "chapisco", "revestimento", "m2", ["chapisco alvenaria"]),
      item("revestimentos", "emboco/reboco interno", "revestimento", "m2", ["emboco interno", "reboco interno"]),
      item("revestimentos", "emboco/reboco externo", "revestimento", "m2", ["emboco externo", "reboco externo"]),
      item("pisos_paredes", "contrapiso", "piso", "m2", ["contrapiso argamassa"], area),
      item("pisos_paredes", "piso", "piso", "m2", [ctx.piso || "piso ceramico", "porcelanato"], area),
      item("pisos_paredes", "argamassa colante", "piso", "kg", ["argamassa colante"]),
      item("pisos_paredes", "rejunte", "piso", "kg", ["rejunte"]),
      item("pisos_paredes", "revestimento de parede em areas molhadas", "revestimento", "m2", ["revestimento banheiro", "revestimento cozinha"]),
      item("pisos_paredes", "rodape", "piso", "m", ["rodape"]),
      item("esquadrias", "portas internas", "esquadria", "un", ["porta interna"]),
      item("esquadrias", "porta externa", "esquadria", "un", ["porta externa"]),
      item("esquadrias", "janelas", "esquadria", "un", ["janela aluminio", "janela"]),
      item("esquadrias", "ferragens/fechaduras", "esquadria", "un", ["ferragem porta", "fechadura"]),
      item("loucas_metais", "vaso sanitario por banheiro", "loucas_metais", "un", ["vaso sanitario"], quantity(bathrooms, "un", "banheiros")),
      item("loucas_metais", "lavatorio por banheiro", "loucas_metais", "un", ["lavatorio banheiro"], quantity(bathrooms, "un", "banheiros")),
      item("loucas_metais", "chuveiro por banheiro", "loucas_metais", "un", ["chuveiro"], quantity(bathrooms, "un", "banheiros")),
      item("loucas_metais", "box por banheiro quando especificado ou padrao medio", "loucas_metais", "un", ["box banheiro"], ctx.box ? quantity(bathrooms, "un", "banheiros") : null),
      item("loucas_metais", "pia/cuba da cozinha", "loucas_metais", "un", ["pia cozinha", "cuba cozinha"], quantity(1, "un", "cozinha")),
      item("loucas_metais", "torneira cozinha", "loucas_metais", "un", ["torneira cozinha"], quantity(1, "un", "cozinha")),
      item("loucas_metais", "tanque da area de servico quando houver", "loucas_metais", "un", ["tanque area de servico"], ctx.temAreaServico ? quantity(1, "un", "area_servico") : null),
      item("loucas_metais", "registros", "loucas_metais", "un", ["registro gaveta", "registro pressao"]),
      item("loucas_metais", "ralos", "loucas_metais", "un", ["ralo banheiro", "ralo area servico"]),
      item("loucas_metais", "caixa sifonada", "loucas_metais", "un", ["caixa sifonada"]),
      item("pintura", "selador", "pintura", "m2", ["selador parede"]),
      item("pintura", "massa quando aplicavel", "pintura", "m2", ["massa corrida", "massa acrilica"]),
      item("pintura", "pintura interna", "pintura", "m2", ["pintura interna", "tinta pva"]),
      item("pintura", "pintura externa", "pintura", "m2", ["pintura externa", "tinta acrilica"]),
      item("pintura", "pintura de teto", "pintura", "m2", ["pintura teto"]),
      item("finalizacao", "limpeza final", "finalizacao", "m2", ["limpeza final obra"], area)
    ];
    return finalize("casa", stages, items, pendencias, bloqueadores, assumidos);
  }

  function buildWallEap(ctx) {
    const pendencias = [];
    const bloqueadores = [];
    const assumidos = [];
    if (!ctx.comprimentoM) addProblem(bloqueadores, "comprimento_muro", "Muro sem comprimento informado.", "critica");
    if (!ctx.alturaM) addProblem(bloqueadores, "altura_muro", "Muro sem altura informada.", "critica");
    const area = ctx.comprimentoM && ctx.alturaM ? quantity(ctx.comprimentoM * ctx.alturaM, "m2", "comprimento_altura") : null;
    const stages = stageList(["preliminares", "movimento_terra", "fundacao_baldrame", "alvenaria", "revestimentos", "pintura", "finalizacao"]);
    const items = [
      item("preliminares", "locacao", "preliminares", "m", ["locacao muro", "gabarito muro"], quantity(ctx.comprimentoM, "m", "comprimento")),
      item("movimento_terra", "escavacao", "movimento_terra", "m3", ["escavacao baldrame", "escavacao sapata"]),
      item("fundacao_baldrame", "fundacao/baldrame", "fundacao", "m", ["fundacao muro", "viga baldrame muro"]),
      item("fundacao_baldrame", "forma", "fundacao", "m2", ["forma baldrame", "forma concreto"]),
      item("fundacao_baldrame", "aco", "fundacao", "kg", ["aco ca-50", "armacao baldrame"]),
      item("fundacao_baldrame", "concreto", "fundacao", "m3", ["concreto baldrame", "concreto sapata"]),
      item("fundacao_baldrame", "pilares/cintas quando aplicavel", "estrutura", "un", ["pilar muro", "cinta muro"]),
      item("alvenaria", "alvenaria", "alvenaria", "m2", ["alvenaria muro", "bloco ceramico", "bloco concreto"], area),
      item("revestimentos", "chapisco dos dois lados", "revestimento", "m2", ["chapisco muro dois lados"], area ? quantity(area.valor * 2, "m2", "duas_faces") : null),
      item("revestimentos", "reboco dos dois lados", "revestimento", "m2", ["reboco muro dois lados"], area ? quantity(area.valor * 2, "m2", "duas_faces") : null),
      item("pintura", "pintura dos dois lados", "pintura", "m2", ["pintura muro dois lados"], area ? quantity(area.valor * 2, "m2", "duas_faces") : null)
    ];
    if (ctx.temPortao) items.push(item("esquadrias", "portao metalico", "esquadria", "un", ["portao metalico", "instalacao portao"], quantity(1, "un", "citado")));
    items.push(item("finalizacao", "limpeza final", "finalizacao", "m2", ["limpeza final obra"], area));
    return finalize("muro", stages, items, pendencias, bloqueadores, assumidos);
  }

  function buildBathroomEap(ctx) {
    const pendencias = [];
    const bloqueadores = [];
    const assumidos = [];
    if (!ctx.larguraM || !ctx.profundidadeM) addProblem(bloqueadores, "dimensoes_banheiro", "Banheiro sem dimensoes informadas.", "critica");
    const area = ctx.larguraM && ctx.profundidadeM ? quantity(ctx.larguraM * ctx.profundidadeM, "m2", "largura_profundidade") : null;
    const stages = stageList(["reforma_banheiro", "instalacoes", "pisos_paredes", "loucas_metais", "pintura", "finalizacao"]);
    const items = [
      item("reforma_banheiro", "demolicao de revestimento", "demolicao", "m2", ["demolicao revestimento banheiro"], area),
      item("reforma_banheiro", "retirada de loucas/metais", "demolicao", "un", ["retirada loucas metais"]),
      item("reforma_banheiro", "transporte/entulho", "demolicao", "m3", ["transporte entulho", "bota fora entulho"]),
      item("reforma_banheiro", "regularizacao", "revestimento", "m2", ["regularizacao banheiro"], area),
      item("reforma_banheiro", "impermeabilizacao", "impermeabilizacao", "m2", ["impermeabilizacao banheiro", "argamassa polimerica"], area),
      item("pisos_paredes", "piso", "piso", "m2", ["piso banheiro", "piso ceramico"], area),
      item("pisos_paredes", "argamassa colante", "piso", "kg", ["argamassa colante"]),
      item("pisos_paredes", "rejunte", "piso", "kg", ["rejunte"]),
      item("pisos_paredes", "revestimento de parede", "revestimento", "m2", ["revestimento parede banheiro"]),
      item("loucas_metais", "vaso sanitario", "loucas_metais", "un", ["vaso sanitario"], quantity(1, "un", "banheiro")),
      item("loucas_metais", "lavatorio", "loucas_metais", "un", ["lavatorio banheiro"], quantity(1, "un", "banheiro")),
      item("loucas_metais", "chuveiro", "loucas_metais", "un", ["chuveiro"], quantity(1, "un", "banheiro")),
      item("loucas_metais", "ralo", "loucas_metais", "un", ["ralo banheiro"], quantity(1, "un", "banheiro")),
      item("loucas_metais", "caixa sifonada", "loucas_metais", "un", ["caixa sifonada"], quantity(1, "un", "banheiro")),
      item("instalacoes", "ponto de agua", "hidraulica", "pt", ["ponto agua banheiro"], quantity(1, "pt", "banheiro")),
      item("instalacoes", "ponto de esgoto", "esgoto", "pt", ["ponto esgoto banheiro"], quantity(1, "pt", "banheiro")),
      item("instalacoes", "eletrica minima", "eletrica", "pt", ["ponto eletrico banheiro", "interruptor banheiro"]),
      item("pintura", "pintura de teto", "pintura", "m2", ["pintura teto banheiro"], area),
      item("finalizacao", "limpeza final", "finalizacao", "m2", ["limpeza final banheiro"], area)
    ];
    return finalize("banheiro", stages, items, pendencias, bloqueadores, assumidos);
  }

  function buildEloBudgetEap(input) {
    const ctx = normalizeInput(input || {});
    const detailedRoomRequirements = getEloDetailedRoomRequirements_(input || {});
    const prmaItems = buildEloPrmaEapItems_(input || {});
    if (ctx.tipo === "muro") return buildWallEap(ctx);
    if (ctx.tipo === "banheiro") return buildBathroomEap(ctx);
    const eap = buildHouseEap(ctx);
    if (!detailedRoomRequirements.available && !prmaItems.length) return eap;
    const detailedItems = prmaItems.length ? [] : buildEloDetailedRoomRequirementItems_(detailedRoomRequirements).map(function (entry) {
      if (entry.disciplina === "loucas_metais" || /maquina de lavar/.test(normalize(entry.nome))) {
        entry.etapaId = "loucas_metais";
      }
      return entry;
    });
    const genericNames = {
      "eletrica embutida": true,
      "hidraulica": true,
      "esgoto sanitario": true,
      "vaso sanitario por banheiro": true,
      "lavatorio por banheiro": true,
      "chuveiro por banheiro": true,
      "pia/cuba da cozinha": true,
      "tanque da area de servico quando houver": true,
      "ralos": true
    };
    eap.itens = eap.itens.filter(function (entry) { return !genericNames[entry.nome]; }).concat(detailedItems, prmaItems);
    eap.resumo.totalItens = eap.itens.length;
    return eap;
  }

  root.EloBudgetEapEngine = {
    version: VERSION,
    buildEloBudgetEap: buildEloBudgetEap
  };
  root.buildEloBudgetEap = buildEloBudgetEap;
})(typeof window !== "undefined" ? window : globalThis);

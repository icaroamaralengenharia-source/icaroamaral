(function (root) {
  "use strict";

  const VERSION = "20260704-elo-construction-sequence-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function unique(items) {
    const seen = {};
    return (items || []).filter(function (item) {
      const key = normalize(item);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function clone(value) { return JSON.parse(JSON.stringify(value || null)); }

  const STAGES = [
    {
      id: "premissas_projeto",
      ordem: 0,
      nome: "Premissas e projeto",
      obrigatorios: ["tipo_obra", "area_construida", "cidade_uf", "padrao", "ambientes", "mes_base"],
      opcionais: ["cliente", "prazo", "bdi", "tipo_fundacao"],
      dependencias: [],
      termosBusca: ["projeto residencial", "orcamento residencial", "premissas obra"],
      perguntasMinimas: ["Qual a cidade/UF, area construida, padrao e ambientes principais da obra?"],
      bloqueadores: ["cidade_uf", "area_construida", "tipo_obra"]
    },
    {
      id: "servicos_preliminares",
      ordem: 1,
      nome: "Servicos preliminares",
      obrigatorios: ["limpeza_terreno", "locacao_obra", "canteiro", "instalacoes_provisorias"],
      opcionais: ["tapume", "placa_obra"],
      dependencias: ["premissas_projeto"],
      termosBusca: ["limpeza terreno", "locacao de obra", "canteiro de obras", "instalacoes provisorias"],
      perguntasMinimas: ["O terreno precisa de limpeza, locacao, canteiro e instalacoes provisorias?"],
      bloqueadores: ["locacao_obra"]
    },
    {
      id: "movimento_terra",
      ordem: 2,
      nome: "Movimento de terra",
      obrigatorios: ["escavacao", "carga_transporte", "reaterro", "compactacao"],
      opcionais: ["regularizacao_terreno", "bota_fora"],
      dependencias: ["servicos_preliminares"],
      termosBusca: ["escavacao manual", "carga transporte solo", "reaterro compactado", "compactacao aterro"],
      perguntasMinimas: ["Ha escavacao, reaterro, compactacao ou transporte de material?"],
      bloqueadores: ["escavacao"]
    },
    {
      id: "fundacao",
      ordem: 3,
      nome: "Fundacao",
      obrigatorios: ["tipo_fundacao", "concreto_magro", "formas", "aco", "concreto", "arranques"],
      opcionais: ["estacas", "sapatas", "blocos", "radier"],
      dependencias: ["movimento_terra"],
      termosBusca: ["sapata concreto armado", "bloco fundacao", "estaca", "concreto magro", "forma fundacao", "armacao fundacao", "arranque pilar"],
      perguntasMinimas: ["Qual hipotese de fundacao: sapata, bloco, estaca ou radier? Ha dimensoes/projeto?"],
      bloqueadores: ["tipo_fundacao", "aco", "concreto"]
    },
    {
      id: "baldrame",
      ordem: 4,
      nome: "Viga baldrame",
      obrigatorios: ["formas", "aco", "concreto", "desforma"],
      opcionais: ["cinta_baldrame", "lastro"],
      dependencias: ["fundacao"],
      termosBusca: ["viga baldrame", "forma viga baldrame", "armacao viga baldrame", "concreto viga baldrame", "desforma"],
      perguntasMinimas: ["A obra tera viga baldrame? Quais secoes e comprimentos?"],
      bloqueadores: ["aco", "concreto"]
    },
    {
      id: "impermeabilizacao",
      ordem: 5,
      nome: "Impermeabilizacao de fundacao/baldrame",
      obrigatorios: ["impermeabilizacao_baldrame", "protecao_umidade_ascendente"],
      opcionais: ["manta", "argamassa_polimerica", "pintura_asfaltica"],
      dependencias: ["baldrame"],
      termosBusca: ["impermeabilizacao baldrame", "umidade ascendente", "pintura asfaltica", "argamassa polimerica"],
      perguntasMinimas: ["Qual sistema de impermeabilizacao sera usado no baldrame/fundacao?"],
      bloqueadores: ["impermeabilizacao_baldrame"]
    },
    {
      id: "alvenaria",
      ordem: 6,
      nome: "Alvenaria",
      obrigatorios: ["blocos_tijolos", "argamassa_assentamento", "vergas", "contravergas", "cintas"],
      opcionais: ["graute", "tela_amarracao"],
      dependencias: ["impermeabilizacao"],
      termosBusca: ["alvenaria bloco ceramico", "argamassa assentamento", "verga", "contraverga", "cinta de amarracao"],
      perguntasMinimas: ["Qual tipo de bloco, altura, perimetro, vaos e necessidade de vergas/contravergas?"],
      bloqueadores: ["blocos_tijolos", "argamassa_assentamento"]
    },
    {
      id: "instalacoes_embutidas",
      ordem: 7,
      nome: "Instalacoes embutidas",
      obrigatorios: ["eletrica", "hidraulica", "esgoto", "aguas_pluviais", "rasgos", "caixas", "eletrodutos", "tubulacoes", "testes"],
      opcionais: ["dados_internet", "gas", "ar_condicionado"],
      dependencias: ["alvenaria"],
      termosBusca: ["instalacao eletrica embutida", "ponto hidraulico", "ponto esgoto", "eletroduto", "caixa eletrica", "tubulacao pvc", "teste estanqueidade"],
      perguntasMinimas: ["Quantos pontos eletricos, hidraulicos, esgoto e pluvial existem por ambiente?"],
      bloqueadores: ["eletrica", "hidraulica", "esgoto", "testes"]
    },
    {
      id: "estrutura_superior",
      ordem: 8,
      nome: "Estrutura superior/laje/forro",
      obrigatorios: ["pilares_vigas_aereas", "laje_ou_estrutura_forro", "formas", "escoramento", "aco", "concreto"],
      opcionais: ["vergas_estruturais", "cinta_respaldo"],
      dependencias: ["instalacoes_embutidas"],
      termosBusca: ["pilar concreto armado", "viga concreto armado", "laje pre moldada", "escoramento", "forma estrutura", "armacao estrutura"],
      perguntasMinimas: ["Ha laje, vigas/pilares aereos ou somente estrutura para forro?"],
      bloqueadores: ["laje_ou_estrutura_forro"]
    },
    {
      id: "cobertura",
      ordem: 9,
      nome: "Cobertura",
      obrigatorios: ["estrutura", "telhas", "cumeeira", "rufos", "calhas"],
      opcionais: ["manta_termica", "beiral"],
      dependencias: ["estrutura_superior"],
      termosBusca: ["estrutura cobertura", "telhamento", "telha ceramica", "cumeeira", "rufo", "calha"],
      perguntasMinimas: ["Qual tipo de telha, estrutura, area de cobertura, rufos e calhas?"],
      bloqueadores: ["estrutura", "telhas"]
    },
    {
      id: "revestimentos_paredes",
      ordem: 10,
      nome: "Revestimento de paredes",
      obrigatorios: ["chapisco", "emboco", "reboco", "regularizacao"],
      opcionais: ["massa_unica", "tela_reforco"],
      dependencias: ["instalacoes_embutidas"],
      termosBusca: ["chapisco alvenaria", "emboco parede", "reboco parede", "massa unica", "regularizacao parede"],
      perguntasMinimas: ["Quais areas de parede recebem chapisco, emboco, reboco ou massa unica?"],
      bloqueadores: ["chapisco", "emboco"]
    },
    {
      id: "contrapiso",
      ordem: 11,
      nome: "Contrapiso e regularizacao",
      obrigatorios: ["lastro", "contrapiso", "caimentos_areas_molhadas"],
      opcionais: ["regularizacao_piso", "junta_dilatacao"],
      dependencias: ["instalacoes_embutidas"],
      termosBusca: ["lastro concreto", "contrapiso argamassa", "regularizacao piso", "caimento area molhada"],
      perguntasMinimas: ["Qual area, espessura e caimento de contrapiso nas areas molhadas?"],
      bloqueadores: ["contrapiso"]
    },
    {
      id: "pisos_paredes",
      ordem: 12,
      nome: "Revestimentos finais de piso e parede",
      obrigatorios: ["piso", "revestimento_parede_molhada", "argamassa_colante", "rejunte", "rodape"],
      opcionais: ["porcelanato", "soleira_transicao"],
      dependencias: ["contrapiso", "revestimentos_paredes"],
      termosBusca: ["piso ceramico", "porcelanato", "revestimento parede banheiro", "argamassa colante", "rejunte", "rodape"],
      perguntasMinimas: ["Quais ambientes recebem piso, revestimento de parede, argamassa colante e rejunte?"],
      bloqueadores: ["piso", "argamassa_colante", "rejunte"]
    },
    {
      id: "esquadrias",
      ordem: 13,
      nome: "Esquadrias",
      obrigatorios: ["portas", "janelas", "ferragens", "vidros", "fechaduras"],
      opcionais: ["grades", "venezianas"],
      dependencias: ["alvenaria"],
      termosBusca: ["porta madeira", "janela aluminio", "ferragem porta", "vidro janela", "fechadura"],
      perguntasMinimas: ["Quantas portas, janelas, vidros, fechaduras e ferragens?"],
      bloqueadores: ["portas", "janelas"]
    },
    {
      id: "loucas_metais",
      ordem: 14,
      nome: "Loucas, metais e acessorios",
      obrigatorios: ["vaso_sanitario", "lavatorio", "chuveiro", "registros", "torneiras", "pia_cozinha", "tanque_area_servico"],
      opcionais: ["box", "acessorios_banheiro", "ducha_higienica"],
      dependencias: ["instalacoes_embutidas", "pisos_paredes"],
      termosBusca: ["vaso sanitario", "lavatÃ³rio", "chuveiro", "registro gaveta", "torneira", "pia cozinha", "tanque area servico", "box banheiro"],
      perguntasMinimas: ["Quais loucas/metais existem em banheiro, cozinha e area de servico?"],
      bloqueadores: ["vaso_sanitario", "lavatorio", "chuveiro", "pia_cozinha"]
    },
    {
      id: "pintura",
      ordem: 15,
      nome: "Pintura",
      obrigatorios: ["selador", "massa", "pintura_interna", "pintura_externa", "pintura_teto"],
      opcionais: ["textura", "esmalte"],
      dependencias: ["revestimentos_paredes", "forro"],
      termosBusca: ["selador parede", "massa corrida", "pintura interna", "pintura externa", "pintura teto"],
      perguntasMinimas: ["Qual area de pintura interna, externa, teto, massa e numero de demaos?"],
      bloqueadores: ["pintura_interna"]
    },
    {
      id: "limpeza_final",
      ordem: 16,
      nome: "Acabamentos finais e limpeza final",
      obrigatorios: ["soleiras", "peitoris", "bancadas", "limpeza_final"],
      opcionais: ["arremates", "vistoria_final"],
      dependencias: ["pintura", "loucas_metais", "esquadrias"],
      termosBusca: ["soleira", "peitoril", "bancada granito", "limpeza final obra"],
      perguntasMinimas: ["Quais soleiras, peitoris, bancadas e criterios de limpeza final?"],
      bloqueadores: ["limpeza_final"]
    }
  ];

  const ITEM_TERMS = {
    escavacao: ["escavacao manual", "escavacao mecanizada"],
    baldrame: ["viga baldrame", "concreto viga baldrame"],
    sapata: ["sapata concreto armado", "fundacao sapata"],
    aco: ["aco ca-50", "armacao aco"],
    formas: ["forma madeira concreto", "forma fundacao"],
    concreto: ["concreto fck", "lancamento concreto"],
    alvenaria: ["alvenaria bloco ceramico", "alvenaria bloco concreto"],
    revestimento: ["chapisco", "emboco", "reboco", "revestimento parede"],
    pintura: ["pintura parede", "selador", "tinta acrilica"],
    portao: ["portao metalico", "instalacao portao"],
    impermeabilizacao: ["impermeabilizacao", "argamassa polimerica", "pintura asfaltica"],
    piso: ["piso ceramico", "argamassa colante", "rejunte"],
    esgoto: ["ponto esgoto", "tubulacao esgoto", "caixa sifonada"],
    hidraulica: ["ponto hidraulico", "agua fria", "tubulacao pvc"],
    eletrica: ["ponto eletrico", "eletroduto", "caixa eletrica"]
  };

  const DETECTION_PATTERNS = {
    tipo_obra: /\b(casa|residencia|residencial|muro|banheiro|cozinha|reforma)\b/,
    area_construida: /\d+(?:[,.]\d+)?\s*m[Â²2]/,
    padrao: /\b(simples|economico|medio|alto padrao|padrao medio)\b/,
    ambientes: /\b(quarto|suite|banheiro|cozinha|sala|area de servico|lavanderia)\b/,
    mes_base: /\b(sinapi|orse|20\d{2}[-/]\d{2}|referencia)\b/,
    limpeza_terreno: /\b(limpeza do terreno|limpar terreno|capina|ro[cÃ§]agem)\b/,
    locacao_obra: /\b(locacao da obra|gabarito|marcacao da obra)\b/,
    canteiro: /\b(canteiro|barracao|deposito obra)\b/,
    instalacoes_provisorias: /\b(instalacoes provisorias|agua provisoria|energia provisoria)\b/,
    escavacao: /\b(escavacao|escavar|vala|sapata)\b/,
    carga_transporte: /\b(carga|transporte|bota fora|entulho)\b/,
    reaterro: /\b(reaterro|reaterar)\b/,
    compactacao: /\b(compactacao|compactar)\b/,
    tipo_fundacao: /\b(sapata|bloco de fundacao|estaca|radier|fundacao)\b/,
    concreto_magro: /\b(concreto magro|lastro)\b/,
    formas: /\b(forma|formas|caixaria)\b/,
    aco: /\b(aco|a[cÃ§]o|armacao|ferragem|vergalhao|ca-50|ca50)\b/,
    concreto: /\b(concreto|fck)\b/,
    arranques: /\b(arranque|arranques|espera de pilar)\b/,
    desforma: /\b(desforma|desformar)\b/,
    impermeabilizacao_baldrame: /\b(impermeabilizacao|impermeabilizar|pintura asfaltica|argamassa polimerica)\b/,
    protecao_umidade_ascendente: /\b(umidade ascendente|barreira umidade|prote[cÃ§][aÃ£]o contra umidade)\b/,
    blocos_tijolos: /\b(bloco|tijolo|alvenaria)\b/,
    argamassa_assentamento: /\b(argamassa de assentamento|assentamento)\b/,
    vergas: /\b(verga|vergas)\b/,
    contravergas: /\b(contraverga|contravergas)\b/,
    cintas: /\b(cinta|cintas|cinta de amarracao|cinta de respaldo)\b/,
    eletrica: /\b(eletrica|el[eÃ©]trica|tomada|interruptor|eletroduto|quadro)\b/,
    hidraulica: /\b(hidraulica|hidr[aÃ¡]ulica|agua fria|ponto de agua|tubulacao agua)\b/,
    esgoto: /\b(esgoto|caixa sifonada|ralo|tubo esgoto)\b/,
    aguas_pluviais: /\b(agua pluvial|aguas pluviais|calha|condutor)\b/,
    rasgos: /\b(rasgo|rasgos|corte parede)\b/,
    caixas: /\b(caixa eletrica|caixa passagem|caixa sifonada|caixas)\b/,
    eletrodutos: /\b(eletroduto|conduite)\b/,
    tubulacoes: /\b(tubulacao|tubulacoes|tubo pvc)\b/,
    testes: /\b(teste|estanqueidade|teste eletrico|teste hidraulico)\b/,
    pilares_vigas_aereas: /\b(pilar|viga aerea|viga superior|estrutura superior)\b/,
    laje_ou_estrutura_forro: /\b(laje|forro|estrutura para forro)\b/,
    escoramento: /\b(escoramento|escora)\b/,
    estrutura: /\b(estrutura cobertura|madeiramento|estrutura metalica|telhado)\b/,
    telhas: /\b(telha|telhas|telhamento|cobertura)\b/,
    cumeeira: /\b(cumeeira)\b/,
    rufos: /\b(rufo|rufos)\b/,
    calhas: /\b(calha|calhas)\b/,
    chapisco: /\b(chapisco)\b/,
    emboco: /\b(emboco|embo[cÃ§]o)\b/,
    reboco: /\b(reboco|massa unica|massa [uÃº]nica)\b/,
    regularizacao: /\b(regularizacao|regulariza[cÃ§][aÃ£]o)\b/,
    lastro: /\b(lastro)\b/,
    contrapiso: /\b(contrapiso)\b/,
    caimentos_areas_molhadas: /\b(caimento|areas molhadas|area molhada)\b/,
    piso: /\b(piso|porcelanato|ceramico|ceramica)\b/,
    revestimento_parede_molhada: /\b(revestimento parede|azulejo|area molhada|banheiro|cozinha)\b/,
    argamassa_colante: /\b(argamassa colante|ac-i|acii|ac-ii|aciii|ac-iii)\b/,
    rejunte: /\b(rejunte)\b/,
    rodape: /\b(rodape|rodap[eÃ©])\b/,
    portas: /\b(porta|portas)\b/,
    janelas: /\b(janela|janelas)\b/,
    ferragens: /\b(ferragem|dobradica|dobradi[cÃ§]a)\b/,
    vidros: /\b(vidro|vidros)\b/,
    fechaduras: /\b(fechadura|fechaduras)\b/,
    vaso_sanitario: /\b(vaso|vaso sanitario|bacia sanitaria)\b/,
    lavatorio: /\b(lavatorio|lavat[oÃ³]rio|pia banheiro)\b/,
    chuveiro: /\b(chuveiro)\b/,
    registros: /\b(registro|registros)\b/,
    torneiras: /\b(torneira|torneiras)\b/,
    pia_cozinha: /\b(pia cozinha|cuba|pia)\b/,
    tanque_area_servico: /\b(tanque|area de servico|lavanderia)\b/,
    selador: /\b(selador)\b/,
    massa: /\b(massa corrida|massa acrilica|massa acr[iÃ­]lica)\b/,
    pintura_interna: /\b(pintura interna|pintura parede|tinta pva|tinta acrilica)\b/,
    pintura_externa: /\b(pintura externa|fachada)\b/,
    pintura_teto: /\b(pintura teto|teto)\b/,
    soleiras: /\b(soleira|soleiras)\b/,
    peitoris: /\b(peitoril|peitoris)\b/,
    bancadas: /\b(bancada|bancadas)\b/,
    limpeza_final: /\b(limpeza final|limpeza da obra)\b/
  };

  function getStages() { return clone(STAGES); }
  function getStage(id) {
    const normalized = normalize(id);
    return clone(STAGES.find(function (stage) { return normalize(stage.id) === normalized; }) || null);
  }

  function itemFound(item, context) {
    const facts = context.facts || {};
    const foundItems = context.foundItems || {};
    if (foundItems[item] === true || foundItems[normalize(item)] === true) return true;
    if (facts[item] === true || clean(facts[item])) return true;
    const pattern = DETECTION_PATTERNS[item];
    return pattern ? pattern.test(context.text) : false;
  }

  function buildTermsByItem(stage) {
    const terms = {};
    (stage.obrigatorios || []).concat(stage.opcionais || []).forEach(function (item) {
      terms[item] = unique((ITEM_TERMS[item] || []).concat((stage.termosBusca || []).filter(function (term) {
        return normalize(term).indexOf(normalize(item).split("_")[0]) >= 0;
      })));
      if (!terms[item].length) terms[item] = unique([item.replace(/_/g, " ")].concat(stage.termosBusca || []));
    });
    return terms;
  }

  function analyzeStage(stage, context) {
    const encontrados = [];
    const pendentes = [];
    (stage.obrigatorios || []).forEach(function (item) {
      if (itemFound(item, context)) encontrados.push(item); else pendentes.push(item);
    });
    const blockers = (stage.bloqueadores || []).filter(function (item) { return pendentes.indexOf(item) >= 0; });
    const status = blockers.length ? "blocked" : pendentes.length ? "partial" : "complete";
    return {
      id: stage.id,
      ordem: stage.ordem,
      nome: stage.nome,
      status: status,
      encontrados: encontrados,
      pendentes: pendentes,
      bloqueadores: blockers,
      termosBuscaPorItem: buildTermsByItem(stage),
      proximaPergunta: pendentes.length ? (stage.perguntasMinimas[0] || "Informe os dados pendentes da etapa " + stage.nome + ".") : ""
    };
  }

  function inferAssumptions(text, facts) {
    const assumptions = [];
    if (/\bcasa\b|residencia|residencial/.test(text) && !clean(facts.tipo_obra || facts.projectType)) assumptions.push("tipo_obra_residencial");
    if (/\bcasa\b|terrea|t[eÃ©]rrea/.test(text) && !clean(facts.pavimentos)) assumptions.push("casa_terrea");
    if (/\bmuro\b/.test(text)) assumptions.push("obra_tipo_muro");
    if (/\bbanheiro\b/.test(text)) assumptions.push("ambiente_banheiro");
    return assumptions;
  }

  function inferRelevantStages(text) {
    if (/\bmuro\b/.test(text)) {
      return ["premissas_projeto", "servicos_preliminares", "movimento_terra", "fundacao", "baldrame", "impermeabilizacao", "alvenaria", "revestimentos_paredes", "pintura", "limpeza_final"];
    }
    if (/\bbanheiro\b/.test(text) && /\breforma\b/.test(text)) {
      return ["premissas_projeto", "instalacoes_embutidas", "impermeabilizacao", "contrapiso", "pisos_paredes", "loucas_metais", "pintura", "limpeza_final"];
    }
    return STAGES.map(function (stage) { return stage.id; });
  }

  function analyzeConstruction(input) {
    const safe = input || {};
    const facts = safe.projectFacts || safe.facts || {};
    const text = normalize([safe.originalMessage, safe.message, facts.originalMessage, safe.lastMessage].join(" "));
    const context = { text: text, facts: facts, foundItems: safe.foundItems || {} };
    const relevantIds = inferRelevantStages(text);
    const stageAnalyses = STAGES.filter(function (stage) { return relevantIds.indexOf(stage.id) >= 0; }).map(function (stage) {
      return analyzeStage(stage, context);
    });
    const blocked = stageAnalyses.filter(function (stage) { return stage.status === "blocked"; });
    const partial = stageAnalyses.filter(function (stage) { return stage.status === "partial"; });
    const etapaAtual = blocked[0] || partial[0] || stageAnalyses[stageAnalyses.length - 1] || null;
    const encontrados = unique(stageAnalyses.reduce(function (all, stage) { return all.concat(stage.encontrados); }, []));
    const pendentes = unique(stageAnalyses.reduce(function (all, stage) { return all.concat(stage.pendentes); }, []));
    const bloqueadores = unique(stageAnalyses.reduce(function (all, stage) { return all.concat(stage.bloqueadores); }, []));
    const termosBuscaPorItem = {};
    stageAnalyses.forEach(function (stage) {
      Object.keys(stage.termosBuscaPorItem || {}).forEach(function (item) {
        termosBuscaPorItem[item] = unique((termosBuscaPorItem[item] || []).concat(stage.termosBuscaPorItem[item]));
      });
    });
    if (/\bportao|portão\b/.test(text)) {
      encontrados.push("portao");
      termosBuscaPorItem.portao = ITEM_TERMS.portao.slice();
    }
    return {
      version: VERSION,
      etapaAtual: etapaAtual ? { id: etapaAtual.id, nome: etapaAtual.nome, ordem: etapaAtual.ordem, status: etapaAtual.status } : null,
      etapas: stageAnalyses,
      encontrados: encontrados,
      pendentes: pendentes,
      assumidos: inferAssumptions(text, facts),
      bloqueadores: bloqueadores,
      termosBuscaPorItem: termosBuscaPorItem,
      proximaPergunta: etapaAtual && etapaAtual.proximaPergunta || "Revise as premissas da obra.",
      podeFecharOrcamentoCompleto: bloqueadores.length === 0 && pendentes.length === 0
    };
  }

  root.EloConstructionSequenceEngine = {
    version: VERSION,
    getStages: getStages,
    getStage: getStage,
    analyzeConstruction: analyzeConstruction,
    buildTermsByItem: function (stageId) {
      const stage = getStage(stageId);
      return stage ? buildTermsByItem(stage) : {};
    }
  };
})(typeof window !== "undefined" ? window : globalThis);


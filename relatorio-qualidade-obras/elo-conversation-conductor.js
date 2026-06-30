(function initEloConversationConductor(global) {
  "use strict";

  const STORAGE_KEY = "elo_conversation_state_v1";
  let memoryState = {};

  const PERSONAS = [
    { id: "engenheiro", terms: ["engenheiro", "engenheira", "engenharia"] },
    { id: "arquiteto", terms: ["arquiteto", "arquiteta", "arquitetura"] },
    { id: "construtora", terms: ["construtora", "incorporadora", "empreendimento"] },
    { id: "sindico/condominio", terms: ["sindico", "sindica", "condominio", "condominial", "predio"] },
    { id: "imobiliaria", terms: ["imobiliaria", "imoveis", "locacao", "locador", "proprietario"] },
    { id: "empresa com demanda de laudos", terms: ["empresa", "laudos recorrentes", "demanda de laudos", "varios laudos"] },
    { id: "prestador de servico/empreiteiro", terms: ["empreiteiro", "prestador", "mestre de obra", "pedreiro", "executo obra"] },
    { id: "cliente final", terms: ["cliente final", "minha casa", "meu apartamento", "meu imovel", "minha obra"] }
  ];

  const PAINS = [
    { id: "patologia/infiltracao", terms: ["infiltracao", "umidade", "mofo", "trinca", "fissura", "rachadura", "vazamento", "patologia", "manifestacao patologica"] },
    { id: "relatorio/laudo", terms: ["relatorio", "laudo", "parecer tecnico"] },
    { id: "orcamento/custo", terms: ["orcamento", "orcamentar", "custo", "quanto custa", "preco", "valor", "composicao", "sinapi", "orse"] },
    { id: "vistoria", terms: ["vistoria", "inspecao", "visita tecnica", "avaliar imovel", "checklist de vistoria"] },
    { id: "documentacao tecnica", terms: ["documentacao", "documento tecnico", "padronizar documento", "evidencias tecnicas"] },
    { id: "diario de obra/RDO", terms: ["rdo", "diario de obra", "registro diario", "ocorrencia de obra"] },
    { id: "produtividade/tempo", terms: ["rapido", "rapida", "mais rapido", "ganhar tempo", "reduzir tempo", "produtividade", "demora"] },
    { id: "comunicacao com cliente", terms: ["cliente", "mensagem para cliente", "comunicacao", "explicar para o cliente", "responder cliente"] },
    { id: "organizacao de obra", terms: ["organizar obra", "pendencias", "controle da obra", "rastreavel", "rastreabilidade"] },
    { id: "venda/contratacao", terms: ["contratar", "contratacao", "teste", "demonstracao", "assinar", "plano", "mensalidade"] }
  ];

  const INTENTS = [
    { id: "orcamento", terms: ["orcamento", "orcar", "quanto custa", "valor da obra", "preco", "custo", "composicao", "sinapi", "orse", "levantamento"] },
    { id: "relatorio_laudo", terms: ["relatorio", "laudo", "parecer tecnico", "documento tecnico", "relatorio tecnico"] },
    { id: "vistoria", terms: ["vistoria", "inspecao", "visita tecnica", "avaliar imovel", "patologia", "manifestacao patologica"] },
    { id: "rdo", terms: ["rdo", "diario de obra", "registro diario", "ocorrencia de obra"] },
    { id: "duvida_tecnica", terms: ["infiltracao", "trinca", "rachadura", "umidade", "fundacao", "laje", "pilar", "viga", "reboco", "parede", "telhado", "impermeabilizacao", "mofo", "fissura", "vazamento"] },
    { id: "venda_contratacao", terms: ["contratar", "contratacao", "plano", "mensalidade", "teste", "demonstracao", "assinar", "valor do servico"] },
    { id: "pos_venda", terms: ["ja sou cliente", "acompanhar", "andamento", "status", "retorno", "entrega", "prazo"] },
    { id: "indicacao", terms: ["indicar", "indicacao", "recomendar", "conheco alguem"] }
  ];

  const STAGES = {
    primeiro_contato: "primeiro_contato",
    diagnostico: "diagnostico",
    coleta_dados: "coleta_dados",
    proposta_proxima_acao: "proposta_proxima_acao",
    execucao: "execucao",
    follow_up: "follow_up",
    fechamento: "fechamento"
  };

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasAny(text, terms) {
    return terms.some(function (term) {
      return text.indexOf(normalize(term)) >= 0;
    });
  }

  function isGreetingOnly(message) {
    return /^(bom dia|boa tarde|boa noite|oi|ola|ol[aá]|tudo bem|e ai|e aí)[.!?\s]*$/i.test(String(message || "").trim());
  }

  function loadState() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memoryState = JSON.parse(raw);
        return Object.assign({}, memoryState);
      }
    } catch (_) {}
    return Object.assign({}, memoryState || {});
  }

  function saveState(state) {
    memoryState = Object.assign({}, state || {});
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
      }
    } catch (_) {}
  }

  function detectIntent(message) {
    const text = normalize(message);

    if (/^(quanto custa|preco|valor|valor do servico)\??$/.test(text)) {
      return "venda_contratacao";
    }

    for (const intent of INTENTS) {
      if (hasAny(text, intent.terms)) {
        return intent.id;
      }
    }

    if (text.indexOf("?") >= 0) return "duvida_tecnica";

    return "generica";
  }

  function detectPersona(message, state) {
    const text = normalize(message);
    for (const persona of PERSONAS) {
      if (hasAny(text, persona.terms)) return persona.id;
    }
    return state && state.persona || state && state.clientType || "desconhecido";
  }

  function detectPain(message, state) {
    const text = normalize(message);
    const found = [];
    PAINS.forEach(function (pain) {
      if (hasAny(text, pain.terms)) found.push(pain.id);
    });

    if (found.indexOf("produtividade/tempo") >= 0 && (found.indexOf("relatorio/laudo") >= 0 || found.indexOf("documentacao tecnica") >= 0)) {
      return "produtividade/documentacao";
    }
    if (found.indexOf("vistoria") >= 0 && found.indexOf("documentacao tecnica") >= 0) {
      return "vistoria/documentacao";
    }
    return found[0] || state && state.pain || state && state.mainPain || "desconhecido";
  }

  function detectLeadTemperature(message) {
    const text = normalize(message);
    if (hasAny(text, ["preco", "valor", "quanto custa", "contratar", "teste", "demonstracao", "assinar", "plano"])) {
      return "hot";
    }
    if (hasAny(text, ["infiltracao", "umidade", "mofo", "trinca", "fissura", "rachadura", "vazamento", "preciso", "quero", "tenho", "apareceu", "padronizar"])) {
      return "warm";
    }
    return "cold";
  }

  function detectStage(message, state) {
    const text = normalize(message);
    const previousStage = state && (state.commercialStage || state.stage);

    if (isGreetingOnly(message)) return STAGES.primeiro_contato;

    if (hasAny(text, ["quanto custa", "preco", "valor", "contratar", "assinar", "teste", "demonstracao"])) {
      return STAGES.fechamento;
    }

    if (hasAny(text, ["foto", "fotos", "documento", "pdf", "medida", "medidas", "area", "cidade", "padrao", "endereco"])) {
      return STAGES.coleta_dados;
    }

    if (hasAny(text, ["gere", "gerar", "monte", "montar", "faca", "fazer", "pode fazer", "vamos"])) {
      return STAGES.execucao;
    }

    if (state && state.lastPromisedAction) {
      return STAGES.follow_up;
    }

    if (!previousStage) return STAGES.primeiro_contato;

    return STAGES.diagnostico;
  }

  function getEloPositioningStatement(persona) {
    if (persona === "engenheiro" || persona === "arquiteto") {
      return "O ELO transforma vistoria, fotos e observacoes de obra em relatorio, orcamento, checklist e comunicacao tecnica pronta para decisao.";
    }
    if (persona === "construtora") {
      return "O ELO transforma informacoes de obra em RDO, pendencias, relatorios, orcamento e comunicacao rastreavel para reduzir retrabalho.";
    }
    if (persona === "sindico/condominio") {
      return "O ELO transforma queixas, fotos e ocorrencias do condominio em triagem tecnica, checklist de vistoria e relatorio preliminar.";
    }
    if (persona === "imobiliaria") {
      return "O ELO transforma vistorias, fotos e ocorrencias em checklist, relatorio preliminar e comunicacao tecnica padronizada.";
    }
    if (persona === "cliente final") {
      return "O ELO transforma informacoes da sua obra ou problema em entendimento tecnico, evidencias organizadas e proximo passo claro.";
    }
    return "O ELO transforma informacoes de obra em relatorio, orcamento, vistoria, RDO e comunicacao tecnica pronta para decisao.";
  }

  function buildEloOffer(payload) {
    const persona = payload && payload.persona || "desconhecido";
    const pain = payload && payload.pain || "desconhecido";

    if (persona === "engenheiro" || persona === "arquiteto") {
      return "O ELO pode reduzir seu tempo de documentacao tecnica transformando vistoria, fotos e observacoes em relatorio estruturado, orcamento preliminar, checklist de decisao ou PDF.";
    }
    if (persona === "construtora") {
      return "O ELO pode organizar comunicacao tecnica, RDO, pendencias, relatorios e orcamento para reduzir retrabalho e deixar a obra mais rastreavel.";
    }
    if (persona === "sindico/condominio") {
      return "O ELO pode transformar queixas, fotos e ocorrencias em triagem tecnica, checklist de vistoria e relatorio preliminar para tomada de decisao.";
    }
    if (persona === "imobiliaria") {
      return "O ELO pode padronizar vistorias, laudos preliminares, fotos e comunicacao tecnica para reduzir conflito com cliente/proprietario.";
    }
    if (persona === "cliente final") {
      return "O ELO pode te ajudar a entender o problema, organizar evidencias e saber o proximo passo antes de contratar uma vistoria ou obra.";
    }
    if (persona === "prestador de servico/empreiteiro") {
      return "O ELO pode transformar medidas, fotos e observacoes de campo em checklist, orcamento preliminar e mensagem tecnica para o cliente.";
    }
    if (persona === "empresa com demanda de laudos") {
      return "O ELO pode padronizar entrada de dados, fotos, laudos preliminares e relatorios para ganhar velocidade sem perder rastreabilidade.";
    }
    if (pain === "patologia/infiltracao") {
      return "O ELO pode organizar a dor tecnica em triagem, evidencias, riscos e roteiro de vistoria antes de qualquer orcamento.";
    }
    return getEloPositioningStatement(persona);
  }

  function chooseDeliverable(pain, intent) {
    if (intent === "orcamento" || pain === "orcamento/custo") return "tabela de orcamento";
    if (intent === "relatorio_laudo" || pain === "relatorio/laudo" || pain === "documentacao tecnica" || pain === "produtividade/documentacao") return "estrutura de relatorio em PDF";
    if (intent === "vistoria" || pain === "vistoria" || pain === "vistoria/documentacao") return "checklist e roteiro de vistoria";
    if (intent === "rdo" || pain === "diario de obra/RDO") return "RDO com status da obra";
    if (pain === "patologia/infiltracao") return "checklist de vistoria e relatorio preliminar";
    if (pain === "comunicacao com cliente") return "mensagem pronta para cliente";
    return "checklist de proxima acao";
  }

  function buildCommercialNextStep(payload) {
    const pain = payload && payload.pain || "desconhecido";
    const intent = payload && payload.intent || "generica";
    const stage = payload && payload.stage || STAGES.primeiro_contato;
    const deliverable = chooseDeliverable(pain, intent);

    if (stage === STAGES.primeiro_contato) {
      return "Me diga o que voce quer resolver agora: relatorio, orcamento, vistoria, RDO ou duvida tecnica.";
    }
    if (stage === STAGES.diagnostico) {
      return "Me passe os dados essenciais do caso e eu organizo isso em " + deliverable + ".";
    }
    if (stage === STAGES.coleta_dados) {
      return "Envie fotos, documentos, medidas ou observacoes. Com isso eu monto " + deliverable + ".";
    }
    if (stage === STAGES.proposta_proxima_acao) {
      return "Posso transformar o que voce trouxe em " + deliverable + " para decisao.";
    }
    if (stage === STAGES.execucao) {
      return "Vou conduzir para a entrega: " + deliverable + ".";
    }
    if (stage === STAGES.follow_up) {
      return "Retomando a ultima acao: posso concluir " + deliverable + " com os dados que faltam.";
    }
    if (stage === STAGES.fechamento) {
      return "O melhor teste e pegar um caso real seu e eu conduzir ate uma entrega pronta: relatorio, orcamento, checklist, RDO ou comunicacao para cliente. Qual caso voce quer usar?";
    }
    return "Com esses dados, eu consigo transformar isso em " + deliverable + ".";
  }

  function extractLightMemory(message, state) {
    const next = Object.assign({}, state || {});
    const text = String(message || "");
    const persona = detectPersona(message, state);
    const pain = detectPain(message, state);
    const intent = detectIntent(message);
    const stage = detectStage(message, state);
    const offer = buildEloOffer({ persona: persona, pain: pain, intent: intent, stage: stage });
    const deliverable = chooseDeliverable(pain, intent);

    const nameMatch = text.match(/(?:me chamo|meu nome e|sou o|sou a)\s+([A-Za-zÀ-ÿ]{2,30})/i);
    if (nameMatch) next.clientName = nameMatch[1].trim();

    const obraMatch = text.match(/(?:obra|projeto|casa|imovel|apartamento|loja|predio)\s+(?:em|na|no|de)?\s*([A-Za-zÀ-ÿ0-9\s.,-]{3,80})/i);
    if (obraMatch) next.project = obraMatch[0].trim();

    next.persona = persona;
    next.clientType = persona === "desconhecido" ? next.clientType : persona;
    next.pain = pain;
    next.mainPain = pain === "desconhecido" ? next.mainPain : pain;
    next.intent = intent;
    next.commercialStage = stage;
    next.stage = stage;
    next.offer = offer;
    next.lastSuggestedDeliverable = deliverable;
    next.leadTemperature = detectLeadTemperature(message);

    if (intent === "orcamento") next.serviceInterest = "orcamento";
    if (intent === "relatorio_laudo") next.serviceInterest = "relatorio/laudo tecnico";
    if (intent === "vistoria") next.serviceInterest = "vistoria tecnica";
    if (intent === "rdo") next.serviceInterest = "diario de obra/RDO";

    return next;
  }

  function responseAsksForTechnicalData(response) {
    const text = normalize(response);
    return hasAny(text, [
      "me informe",
      "me passe",
      "preciso saber",
      "preciso de",
      "qual ",
      "quais ",
      "envie fotos",
      "dados confirmados",
      "dados tecnicos",
      "perguntas complementares",
      "cidade/estado",
      "area aproximada",
      "padrao"
    ]);
  }

  function shouldAppendAction(response) {
    const text = normalize(response);
    if (!text) return false;

    const alreadyHasAction =
      text.indexOf("quer que eu") >= 0 ||
      text.indexOf("proximo passo") >= 0 ||
      text.indexOf("proxima acao") >= 0 ||
      text.indexOf("me envie") >= 0 ||
      text.indexOf("posso montar") >= 0 ||
      text.indexOf("posso transformar") >= 0;

    return !alreadyHasAction;
  }

  function addToneGuard(response) {
    const text = String(response || "").trim();
    if (!text) return text;

    const forbiddenPromises = [
      "laudo definitivo garantido",
      "100% garantido",
      "diagnostico definitivo sem vistoria"
    ];

    let cleaned = text;

    forbiddenPromises.forEach(function (term) {
      const regex = new RegExp(term, "ig");
      cleaned = cleaned.replace(regex, "avaliacao preliminar com base nos dados informados");
    });

    return cleaned;
  }

  function buildLightCommercialLine(payload) {
    const deliverable = chooseDeliverable(payload && payload.pain, payload && payload.intent);
    return "Com esses dados, eu consigo transformar isso em " + deliverable + ".";
  }

  function enhanceResponse(payload) {
    const userMessage = payload && payload.userMessage;
    const assistantResponse = payload && payload.assistantResponse;
    const previousState = loadState();

    const intent = detectIntent(userMessage);
    const persona = detectPersona(userMessage, previousState);
    const pain = detectPain(userMessage, previousState);
    const stage = detectStage(userMessage, previousState);
    const nextState = extractLightMemory(userMessage, previousState);
    const nextAction = buildCommercialNextStep({ persona: persona, pain: pain, intent: intent, stage: stage });

    nextState.lastPromisedAction = nextAction;
    nextState.lastNextAction = nextAction;
    nextState.updatedAt = new Date().toISOString();

    saveState(nextState);

    if (isGreetingOnly(userMessage)) {
      return "Bom dia. Me diga o que voce quer resolver agora: relatorio, orcamento, vistoria, RDO ou duvida tecnica.";
    }

    const baseResponse = addToneGuard(assistantResponse);

    if (stage === STAGES.fechamento) {
      if (normalize(baseResponse).indexOf("caso real") >= 0) return baseResponse;
      return baseResponse.trim() + "\n\n**Proximo passo:** " + nextAction;
    }

    if (responseAsksForTechnicalData(baseResponse)) {
      const line = buildLightCommercialLine({ persona: persona, pain: pain, intent: intent, stage: stage });
      if (normalize(baseResponse).indexOf(normalize(line)) >= 0) return baseResponse;
      return baseResponse.trim() + "\n\n" + line;
    }

    if (!nextAction || !shouldAppendAction(baseResponse)) {
      return baseResponse;
    }

    const offer = buildEloOffer({ persona: persona, pain: pain, intent: intent, stage: stage });
    const shouldShowOffer = nextState.leadTemperature !== "cold" && intent !== "orcamento";
    const offerLine = shouldShowOffer ? offer + "\n\n" : "";

    return baseResponse.trim() + "\n\n" + offerLine + "**Proximo passo:** " + nextAction;
  }

  function resetState() {
    memoryState = {};
    try {
      if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  global.EloConversationConductor = {
    detectIntent: detectIntent,
    detectPersona: detectPersona,
    detectPain: detectPain,
    detectLeadTemperature: detectLeadTemperature,
    detectStage: detectStage,
    getEloPositioningStatement: getEloPositioningStatement,
    buildEloOffer: buildEloOffer,
    buildCommercialNextStep: buildCommercialNextStep,
    enhanceResponse: enhanceResponse,
    loadState: loadState,
    saveState: saveState,
    resetState: resetState
  };
})(typeof window !== "undefined" ? window : globalThis);
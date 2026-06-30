(function initEloConversationConductor(global) {
  "use strict";

  const STORAGE_KEY = "elo_conversation_state_v1";
  let memoryState = {};

  const PERSONAS = [
    { id: "engenheiro", terms: ["engenheiro", "engenheira", "engenharia"] },
    { id: "arquiteto", terms: ["arquiteto", "arquiteta", "arquitetura"] },
    { id: "construtora", terms: ["construtora", "incorporadora", "empreendimento"] },
    { id: "sindico_condominio", terms: ["sindico", "sindica", "condominio", "condominial", "predio"] },
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
  function analyzeHiddenObjective(message, state) {
    const text = normalize(message);
    if (hasAny(text, ["cliente", "responder", "mandar mensagem", "explicar para ele", "explicar para ela", "resposta para cliente"])) return "responder_cliente";
    if (hasAny(text, ["laudo", "parecer", "relatorio tecnico"])) return "elaborar_laudo";
    if (hasAny(text, ["orcamento", "quanto custa", "valor", "preco"])) return "montar_orcamento";
    if (hasAny(text, ["viabilidade", "vale a pena", "estudo", "simular"])) return "estudar_viabilidade";
    if (hasAny(text, ["executar", "comecar obra", "fazer a obra", "contratar pedreiro"])) return "executar_obra";
    if (hasAny(text, ["prefeitura", "banco", "cartorio", "habite-se", "regularizar"])) return "regularizar_documentacao";
    if (hasAny(text, ["minha casa", "meu apartamento", "meu imovel"])) return "resolver_problema_pessoal";
    if (hasAny(text, ["andamento", "prazo", "obra parada", "medicao"])) return "acompanhar_obra";
    if (hasAny(text, ["vender", "proposta", "fechar servico", "apresentar servico"])) return "vender_servico";
    if (hasAny(text, ["assembleia", "condominio", "sindico", "moradores"])) return "decisao_condominio";
    return state && state.hiddenObjective || "desconhecido";
  }

  function detectUrgency(message) {
    const text = normalize(message);
    if (hasAny(text, ["risco", "urgente", "interditar", "perigo", "caiu", "vazando muito", "alagou", "estrutura", "rachadura aumentando", "cliente cobrando", "prazo hoje"])) return "alta";
    if (hasAny(text, ["preciso resolver", "esta semana", "orcamento", "vistoria", "laudo", "cliente pediu"])) return "media";
    if (hasAny(text, ["duvida", "curiosidade", "estudar", "entender", "bom dia", "oi"])) return "baixa";
    return "baixa";
  }

  function buildConversationStrategy(payload) {
    const hiddenObjective = payload && payload.hiddenObjective || "desconhecido";
    const urgency = payload && payload.urgency || "baixa";
    const intent = payload && payload.intent || "generica";
    const stage = payload && payload.stage || STAGES.primeiro_contato;

    if (stage === STAGES.primeiro_contato && hiddenObjective === "desconhecido" && urgency === "baixa") {
      return {
        mode: "resposta_curta",
        goal: "entender o objetivo antes de conduzir",
        question: "Me diga o que voce quer resolver agora.",
        deliverable: "proxima acao clara",
        tone: "leve",
        shouldAskBeforeAnswer: false
      };
    }

    if (urgency === "alta") {
      return {
        mode: "triagem_tecnica",
        goal: "entender risco antes de qualquer orcamento ou entrega",
        question: "Antes de qualquer orcamento, preciso entender se ha risco. Ha aumento rapido, vazamento ativo, deformacao, estalo, deslocamento ou risco as pessoas?",
        deliverable: "triagem de risco",
        tone: "direto e preventivo",
        shouldAskBeforeAnswer: true
      };
    }

    if (hiddenObjective === "responder_cliente") {
      return {
        mode: "consultoria_cliente",
        goal: "transformar a situacao em uma resposta profissional para cliente",
        question: "Voce quer responder de forma tecnica, tranquilizadora ou mais firme?",
        deliverable: "mensagem pronta para cliente",
        tone: "consultivo",
        shouldAskBeforeAnswer: true
      };
    }

    if (hiddenObjective === "elaborar_laudo") {
      return {
        mode: "coleta_para_documento",
        goal: "coletar finalidade e destinatario antes de estruturar o documento",
        question: "Esse laudo sera usado para cliente, condominio, justica, banco ou prefeitura?",
        deliverable: "estrutura de laudo tecnico",
        tone: "tecnico e organizado",
        shouldAskBeforeAnswer: true
      };
    }

    if (hiddenObjective === "montar_orcamento") {
      return {
        mode: "orcamento_guiado",
        goal: "separar finalidade do orcamento antes de calcular ou listar dados",
        question: "Esse orcamento e para apresentar ao cliente, estudar viabilidade ou executar a obra?",
        deliverable: "orcamento preliminar organizado",
        tone: "objetivo",
        shouldAskBeforeAnswer: true
      };
    }

    if (hiddenObjective === "decisao_condominio") {
      return {
        mode: "decisao_condominio",
        goal: "organizar a decisao tecnica para sindico, moradores ou assembleia",
        question: "A decisao e para orientar moradores, aprovar vistoria, contratar reparo ou registrar risco?",
        deliverable: "resumo tecnico para condominio",
        tone: "claro e institucional",
        shouldAskBeforeAnswer: true
      };
    }

    if (hiddenObjective === "regularizar_documentacao") {
      return {
        mode: "coleta_para_documento",
        goal: "entender o orgao e a finalidade antes de montar a documentacao",
        question: "A documentacao e para prefeitura, banco, cartorio ou regularizacao interna?",
        deliverable: "checklist documental",
        tone: "formal",
        shouldAskBeforeAnswer: true
      };
    }

    if (hiddenObjective === "acompanhar_obra" || intent === "rdo") {
      return {
        mode: "rdo_guiado",
        goal: "transformar acompanhamento em registro objetivo da obra",
        question: "Voce quer registrar status, prazo, pendencias ou ocorrencias do dia?",
        deliverable: "status da obra ou RDO",
        tone: "operacional",
        shouldAskBeforeAnswer: true
      };
    }

    if (hiddenObjective === "vender_servico" || hiddenObjective === "estudar_viabilidade" || hiddenObjective === "executar_obra") {
      return {
        mode: "venda_sutil",
        goal: "conduzir a conversa para uma decisao pratica sem discurso pesado",
        question: "Voce quer usar isso para proposta, viabilidade ou execucao?",
        deliverable: "roteiro de decisao",
        tone: "consultivo e direto",
        shouldAskBeforeAnswer: true
      };
    }

    return {
      mode: "resposta_curta",
      goal: "responder sem alongar quando ainda falta contexto",
      question: "Voce quer uma resposta tecnica para cliente ou uma triagem para vistoria?",
      deliverable: "proxima acao clara",
      tone: "leve",
      shouldAskBeforeAnswer: false
    };
  }

  function buildConsultantQuestion(strategy, state) {
    if (!strategy || !strategy.question) return "";
    const asked = normalize(state && state.lastConsultantQuestion || "");
    const question = String(strategy.question || "").trim();
    if (asked && asked === normalize(question)) return "";
    return question;
  }

  function shouldAppendConsultantLayer(response, strategy) {
    const text = normalize(response);
    if (!text || !strategy || strategy.mode === "resposta_curta") return false;
    if (text.length < 18) return false;
    if (text.indexOf("para conduzir certo") >= 0) return false;
    if (text.indexOf("proximo passo") >= 0) return false;
    if (strategy.question && text.indexOf(normalize(strategy.question).slice(0, 38)) >= 0) return false;
    return true;
  }

  function enhanceConsultativeResponse(payload) {
    const response = String(payload && payload.response || "").trim();
    const strategy = payload && payload.strategy;
    const state = payload && payload.state || {};
    if (!shouldAppendConsultantLayer(response, strategy)) return response;
    const question = buildConsultantQuestion(strategy, state);
    if (!question) return response;
    return response + "\n\n**Para conduzir certo:** " + question + "\n**Entrega possivel:** " + strategy.deliverable;
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
    if (persona === "sindico_condominio") {
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
    if (persona === "sindico_condominio") {
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
    const hiddenObjective = analyzeHiddenObjective(message, state);
    const urgency = detectUrgency(message);
    const strategy = buildConversationStrategy({ persona: persona, pain: pain, intent: intent, hiddenObjective: hiddenObjective, urgency: urgency, stage: stage });
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
    next.hiddenObjective = hiddenObjective;
    next.urgency = urgency;
    next.strategyMode = strategy.mode;
    next.strategyGoal = strategy.goal;
    next.strategyDeliverable = strategy.deliverable;

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
    const hiddenObjective = analyzeHiddenObjective(userMessage, previousState);
    const urgency = detectUrgency(userMessage);
    const strategy = buildConversationStrategy({ persona: persona, pain: pain, intent: intent, hiddenObjective: hiddenObjective, urgency: urgency, stage: stage });
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
    const finalizeConsultative = function (response) {
      const enhanced = enhanceConsultativeResponse({ response: response, strategy: strategy, state: previousState });
      if (enhanced !== response) {
        nextState.lastConsultantQuestion = strategy.question || "";
        nextState.updatedAt = new Date().toISOString();
        saveState(nextState);
      }
      return enhanced;
    };

    if (stage === STAGES.fechamento) {
      if (normalize(baseResponse).indexOf("caso real") >= 0) return baseResponse;
      return baseResponse.trim() + "\n\n**Proximo passo:** " + nextAction;
    }

    if (responseAsksForTechnicalData(baseResponse)) {
      const line = buildLightCommercialLine({ persona: persona, pain: pain, intent: intent, stage: stage });
      if (normalize(baseResponse).indexOf(normalize(line)) >= 0) return finalizeConsultative(baseResponse);
      return finalizeConsultative(baseResponse.trim() + "\n\n" + line);
    }

    const consultativeResponse = finalizeConsultative(baseResponse);
    if (consultativeResponse !== baseResponse) return consultativeResponse;

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

  global.EloConversationStrategist = {
    analyzeHiddenObjective: analyzeHiddenObjective,
    detectUrgency: detectUrgency,
    buildConsultantQuestion: buildConsultantQuestion,
    buildConversationStrategy: buildConversationStrategy,
    enhanceConsultativeResponse: enhanceConsultativeResponse
  };

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
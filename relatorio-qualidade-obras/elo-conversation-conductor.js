(function initEloConversationConductor(global) {
  "use strict";

  const STORAGE_KEY = "elo_conversation_state_v1";

  const INTENTS = [
    { id: "orcamento", terms: ["orcamento", "orcar", "quanto custa", "valor da obra", "preco", "custo", "composicao", "sinapi", "orse", "levantamento"] },
    { id: "relatorio_laudo", terms: ["relatorio", "laudo", "parecer tecnico", "documento tecnico", "relatorio tecnico"] },
    { id: "vistoria", terms: ["vistoria", "inspecao", "visita tecnica", "avaliar imovel", "patologia", "manifestacao patologica"] },
    { id: "rdo", terms: ["rdo", "diario de obra", "registro diario", "ocorrencia de obra"] },
    { id: "duvida_tecnica", terms: ["infiltracao", "trinca", "rachadura", "umidade", "fundacao", "laje", "pilar", "viga", "reboco", "parede", "telhado", "impermeabilizacao", "mofo", "fissura"] },
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

  function loadState() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveState(state) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state || {}));
      }
    } catch (_) {}
  }

  function detectIntent(message) {
    const text = normalize(message);

    if (/^(quanto custa|preco|valor|valor do servico)\??$/.test(text)) {
      return "venda_contratacao";
    }

    for (const intent of INTENTS) {
      if (intent.terms.some(function (term) { return text.indexOf(normalize(term)) >= 0; })) {
        return intent.id;
      }
    }

    if (text.indexOf("?") >= 0) return "duvida_tecnica";

    return "generica";
  }

  function detectStage(message, state) {
    const text = normalize(message);
    const previousStage = state && state.stage;

    if (!previousStage) return STAGES.primeiro_contato;

    if (
      text.indexOf("sim") >= 0 ||
      text.indexOf("pode") >= 0 ||
      text.indexOf("quero") >= 0 ||
      text.indexOf("vamos") >= 0 ||
      text.indexOf("faca") >= 0 ||
      text.indexOf("gere") >= 0 ||
      text.indexOf("monte") >= 0
    ) {
      return STAGES.execucao;
    }

    if (
      text.indexOf("quanto custa") >= 0 ||
      text.indexOf("preco") >= 0 ||
      text.indexOf("valor") >= 0 ||
      text.indexOf("contratar") >= 0 ||
      text.indexOf("assinar") >= 0
    ) {
      return STAGES.fechamento;
    }

    if (state && state.lastNextAction) {
      return STAGES.follow_up;
    }

    return previousStage || STAGES.diagnostico;
  }

  function extractLightMemory(message, state) {
    const next = Object.assign({}, state || {});
    const text = String(message || "");

    const nameMatch = text.match(/(?:me chamo|meu nome e|sou o|sou a)\s+([A-Za-zÀ-ÿ]{2,30})/i);
    if (nameMatch) next.clientName = nameMatch[1].trim();

    const obraMatch = text.match(/(?:obra|projeto|casa|imovel|apartamento|loja|predio)\s+(?:em|na|no|de)?\s*([A-Za-zÀ-ÿ0-9\s.,-]{3,80})/i);
    if (obraMatch) next.project = obraMatch[0].trim();

    if (/engenheiro|engenheira/i.test(text)) next.clientType = "engenheiro";
    if (/arquiteto|arquiteta/i.test(text)) next.clientType = "arquiteto";
    if (/construtora/i.test(text)) next.clientType = "construtora";
    if (/sindico|condominio/i.test(text)) next.clientType = "sindico/condominio";
    if (/cliente final|minha casa|meu imovel/i.test(text)) next.clientType = "cliente final";

    if (/infiltra/i.test(text)) next.mainPain = "infiltracao";
    if (/trinca|rachadura|fissura/i.test(text)) next.mainPain = "trincas/fissuras";
    if (/umidade|mofo/i.test(text)) next.mainPain = "umidade/mofo";
    if (/atraso|prazo/i.test(text)) next.mainPain = "prazo/andamento";
    if (/custo|preco|orcamento/i.test(text)) next.mainPain = "custo/orcamento";

    if (/or[cç]amento|sinapi|orse|composi[cç][aã]o/i.test(text)) next.serviceInterest = "orcamento";
    if (/laudo|relat[oó]rio|parecer/i.test(text)) next.serviceInterest = "relatorio/laudo tecnico";
    if (/vistoria|inspe[cç][aã]o/i.test(text)) next.serviceInterest = "vistoria tecnica";
    if (/rdo|di[aá]rio de obra/i.test(text)) next.serviceInterest = "diario de obra/RDO";

    return next;
  }

  function buildNextAction(intent, stage) {
    if (intent === "orcamento") {
      return "Para avancar com seguranca, me informe: tipo da obra, cidade/estado, area aproximada em m2 e padrao desejado. Com isso eu monto um orcamento preliminar mais organizado.";
    }

    if (intent === "relatorio_laudo") {
      return "O proximo passo e reunir fotos, local do problema, data da vistoria e objetivo do documento. Quer que eu monte agora a estrutura do relatorio tecnico?";
    }

    if (intent === "vistoria") {
      return "Posso montar um checklist tecnico de vistoria com itens, fotos necessarias, riscos e perguntas de campo. Quer que eu gere esse checklist?";
    }

    if (intent === "rdo") {
      return "Posso transformar isso em um RDO organizado com servicos executados, equipe, clima, ocorrencias, fotos e pendencias. Quer que eu monte o modelo de hoje?";
    }

    if (intent === "duvida_tecnica") {
      return "Para nao ficar so na teoria, posso organizar isso em diagnostico preliminar, possiveis causas, riscos e proximos passos. Quer que eu faca assim?";
    }

    if (intent === "venda_contratacao" || stage === STAGES.fechamento) {
      return "O melhor teste e pegar um caso real seu e eu conduzir ate um resultado pronto: relatorio, orcamento, checklist, RDO ou comunicacao para cliente. Qual caso voce quer usar?";
    }

    if (intent === "pos_venda") {
      return "Me diga qual entrega voce quer acompanhar: relatorio, orcamento, vistoria, RDO ou revisao tecnica. Eu organizo o status e o proximo passo.";
    }

    if (intent === "indicacao") {
      return "Se quiser indicar alguem, posso montar uma mensagem curta explicando o ELO de forma profissional e direta. Quer que eu escreva?";
    }

    if (stage === STAGES.primeiro_contato) {
      return "Me diga qual e o objetivo agora: tirar uma duvida tecnica, montar relatorio, fazer orcamento, organizar vistoria, gerar RDO ou preparar uma resposta para cliente.";
    }

    return "";
  }

  function shouldAppendAction(response) {
    const text = normalize(response);
    if (!text) return false;

    const alreadyHasAction =
      text.indexOf("quer que eu") >= 0 ||
      text.indexOf("proximo passo") >= 0 ||
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

  function enhanceResponse(payload) {
    const userMessage = payload && payload.userMessage;
    const assistantResponse = payload && payload.assistantResponse;
    const previousState = loadState();

    const intent = detectIntent(userMessage);
    const stage = detectStage(userMessage, previousState);
    const nextState = extractLightMemory(userMessage, previousState);

    nextState.intent = intent;
    nextState.stage = stage;
    nextState.updatedAt = new Date().toISOString();

    const nextAction = buildNextAction(intent, stage, nextState);
    nextState.lastNextAction = nextAction;

    saveState(nextState);

    const baseResponse = addToneGuard(assistantResponse);

    if (!nextAction || !shouldAppendAction(baseResponse)) {
      return baseResponse;
    }

    return baseResponse.trim() + "\n\n**Proximo passo:** " + nextAction;
  }

  function resetState() {
    try {
      if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  global.EloConversationConductor = {
    detectIntent: detectIntent,
    detectStage: detectStage,
    enhanceResponse: enhanceResponse,
    loadState: loadState,
    saveState: saveState,
    resetState: resetState
  };
})(typeof window !== "undefined" ? window : globalThis);

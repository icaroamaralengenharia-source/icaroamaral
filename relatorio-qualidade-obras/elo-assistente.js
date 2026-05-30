(function () {
  "use strict";

  // ELO_CONFIG
  const ELO_CONFIG = {
    storageKey: "obrareport_elo_assistente_v1",
    maxHistory: 20,
    whatsappNumber: "",
    webSearchEnabled: false,
    webSearchEndpoint: "",
    webSearchRequiresConfirmation: true
  };

  // ELO_FLOW
  // Fluxo atual e futuro do Elo:
  // 1. consultar memoria local salva neste navegador;
  // 2. consultar a base local de ajuda do ObraReport;
  // 3. preparar uma busca externa futura quando a duvida depender de internet;
  // 4. responder com clareza, sem inventar funcionalidades;
  // 5. perguntar se a resposta deve ser guardada para uso futuro.
  const ELO_FLOW = {
    current: ["memoria_local", "base_local", "resposta"],
    future: ["busca_externa", "resumo", "guardar_conhecimento"]
  };

  // ELO_KNOWLEDGE_BASE
  const ELO_KNOWLEDGE_BASE = [
    {
      category: "primeiros_passos",
      title: "Como criar meu primeiro relatório?",
      keywords: ["primeiro relatorio", "criar relatorio", "novo relatorio", "relatorio qualidade", "começar"],
      shortAnswer: "Para criar seu primeiro relatório, cadastre um cliente, cadastre uma obra e depois abra Relatórios.",
      fullAnswer: "No ObraReport, o relatório precisa estar vinculado a uma obra. O caminho mais simples é: Clientes > Novo cliente, Obras > Nova obra, Relatórios > Criar relatório. Depois você preenche dados, fotos, inconformidades, revisão e gera o PDF.",
      nextAction: "No dashboard, use o atalho Fazer Relatório de Qualidade.",
      canSave: true
    },
    {
      category: "clientes",
      title: "Como cadastrar cliente?",
      keywords: ["cliente", "cadastrar cliente", "novo cliente", "proprietario", "contratante"],
      shortAnswer: "Abra Clientes e preencha o cadastro básico do cliente.",
      fullAnswer: "Use a tela Clientes para informar nome, documento, telefone, e-mail e observações. Esse cadastro ajuda a vincular obras, relatórios, RDOs e documentos ao cliente correto.",
      nextAction: "Clique em Clientes no menu lateral ou no card Novo cliente do dashboard.",
      canSave: true
    },
    {
      category: "obras",
      title: "Como cadastrar obra?",
      keywords: ["obra", "cadastrar obra", "nova obra", "endereco", "tipo de obra"],
      shortAnswer: "Abra Obras, escolha o cliente e cadastre os dados da obra.",
      fullAnswer: "A obra organiza relatórios, RDOs, materiais e documentos. Para cadastrar, escolha um cliente, informe nome da obra, endereço, tipo e status.",
      nextAction: "Clique em Obras no menu lateral ou use o botão Nova obra.",
      canSave: true
    },
    {
      category: "fotos",
      title: "Como adicionar fotos?",
      keywords: ["foto", "fotos", "adicionar foto", "imagem", "anexo", "ocorrencia com foto"],
      shortAnswer: "No relatório, avance até a etapa Fotos e adicione imagens da obra.",
      fullAnswer: "As fotos são usadas para registrar evidências visuais do relatório. Depois de criar ou abrir um relatório, vá para a etapa Fotos, selecione imagens e revise as legendas antes de gerar o PDF.",
      nextAction: "Abra um relatório e clique em Fotos no progresso do relatório.",
      canSave: true
    },
    {
      category: "pdf",
      title: "Como gerar PDF?",
      keywords: ["pdf", "gerar pdf", "exportar pdf", "documento", "imprimir", "salvar pdf"],
      shortAnswer: "Abra o relatório ou RDO e use o botão de gerar PDF.",
      fullAnswer: "O PDF é o documento final para entrega. Em relatórios, preencha as etapas e vá para Gerar. No RDO, use Gerar PDF do Diário. O navegador pode abrir uma janela de impressão ou visualização para salvar o arquivo.",
      nextAction: "Se estiver no dashboard, use o atalho Fazer Relatório de Qualidade ou abra Diário de Obras para gerar o PDF do RDO.",
      canSave: true
    },
    {
      category: "pdf",
      title: "O PDF não gerou, o que fazer?",
      keywords: ["pdf nao gerou", "pdf não gerou", "erro pdf", "bloqueou popup", "nao abriu pdf", "não abriu pdf"],
      shortAnswer: "Confira se o navegador bloqueou pop-ups e se os campos principais foram preenchidos.",
      fullAnswer: "Quando o PDF não abre, normalmente o navegador bloqueou a nova janela, algum campo obrigatório ficou vazio ou o relatório ainda não foi salvo. Libere pop-ups para o site, revise os campos e tente novamente. O ObraReport não alterou seu relatório ao falhar a abertura.",
      nextAction: "Tente gerar novamente depois de liberar pop-ups e revisar os dados obrigatórios.",
      canSave: true
    },
    {
      category: "rdo",
      title: "Como usar o Diário de Obras/RDO?",
      keywords: ["rdo", "diario", "diário", "diario de obras", "diário de obras", "registro diario"],
      shortAnswer: "Abra Diário de Obras e registre identificação, execução, materiais, ocorrências, fotos e encerramento.",
      fullAnswer: "O RDO registra a rotina da obra: clima, equipe, serviços executados, produção, materiais consumidos, intercorrências, segurança, fotos e resumo. Ele ajuda a criar histórico técnico e pode ser exportado em PDF.",
      nextAction: "Use o atalho Fazer Diário de Obra (RDO) no dashboard.",
      canSave: true
    },
    {
      category: "materiais",
      title: "Como registrar materiais?",
      keywords: ["materiais", "material", "consumo", "cimento", "bloco", "auditoria", "composicao"],
      shortAnswer: "No RDO, use a seção Materiais para registrar consumo e comparar com a produção executada.",
      fullAnswer: "Materiais consumidos ficam no Diário de Obras. Você pode registrar quantidade, unidade, valor e observação. Quando houver produção executada e composição, o sistema ajuda a estimar consumo e mostra diferenças para auditoria simples.",
      nextAction: "Abra Diário de Obras > Materiais.",
      canSave: true
    },
    {
      category: "primeiros_passos",
      title: "Como usar a Obra Exemplo?",
      keywords: ["obra exemplo", "demonstração", "demonstracao", "teste", "exemplo pronto"],
      shortAnswer: "Use Carregar Obra Exemplo para ver cliente, obra, relatório, RDO, materiais e PDF em poucos segundos.",
      fullAnswer: "A Obra Exemplo cria dados demonstrativos marcados como demonstração. Ela serve para testar o fluxo sem misturar com dados reais e entender como o ObraReport organiza relatório, RDO, materiais, auditoria e PDF.",
      nextAction: "No dashboard, clique em Carregar Obra Exemplo.",
      canSave: true
    },
    {
      category: "planos",
      title: "Como funcionam os planos?",
      keywords: ["plano", "planos", "contratar", "profissional", "empresa", "gratuito", "preço", "preco"],
      shortAnswer: "O ObraReport tem planos Gratuito, Profissional e Empresa, com contratação assistida nesta fase.",
      fullAnswer: "Os planos organizam limites e recursos. Nesta fase, pagamento e ativação são assistidos; o sistema não deve ser entendido como checkout automático ou integração real de pagamento.",
      nextAction: "Abra Planos para ver limites e solicitar acesso pelo WhatsApp.",
      canSave: true
    },
    {
      category: "limites",
      title: "O plano gratuito tem limite?",
      keywords: ["limite", "gratuito", "plano gratuito", "quantos relatorios", "limite fotos", "limite ia"],
      shortAnswer: "Sim. O plano gratuito é pensado para testar o ObraReport com limites.",
      fullAnswer: "O plano gratuito permite testar o SaaS com limites de clientes, obras, relatórios, fotos e IA. Os limites aparecem na tela Planos/Uso atual. Para uso contínuo, o fluxo indicado é solicitar acesso ao plano adequado.",
      nextAction: "Abra Planos e confira o uso atual.",
      canSave: true
    },
    {
      category: "suporte",
      title: "Como enviar resumo por WhatsApp?",
      keywords: ["whatsapp", "enviar whatsapp", "resumo whatsapp", "compartilhar", "mensagem"],
      shortAnswer: "No RDO, use o botão de WhatsApp para abrir uma mensagem pronta.",
      fullAnswer: "O ObraReport prepara um resumo profissional com obra, cliente, produção, materiais, ocorrências e segurança. Ele abre o WhatsApp Web ou app com o texto preenchido. Não é uma integração oficial de API do WhatsApp.",
      nextAction: "Abra um RDO e clique em Enviar resumo por WhatsApp.",
      canSave: true
    },
    {
      category: "ia",
      title: "A IA faz diagnóstico definitivo?",
      keywords: ["diagnostico definitivo", "diagnóstico definitivo", "ia substitui", "laudo definitivo", "responsabilidade tecnica"],
      shortAnswer: "Não. A IA ajuda a revisar e organizar texto, mas não substitui avaliação técnica profissional.",
      fullAnswer: "A IA do ObraReport é apoio técnico para redação, organização e revisão. Ela não substitui vistoria, responsabilidade técnica, ART/RRT, laudo profissional ou decisão de engenheiro/arquiteto habilitado.",
      nextAction: "Use a IA como apoio e revise tudo antes de entregar.",
      canSave: true
    },
    {
      category: "ia",
      title: "Como usar a IA de texto?",
      keywords: ["ia texto", "usar ia", "melhorar texto", "sugestao ia", "sugestão ia"],
      shortAnswer: "Use os botões de IA nos campos técnicos para gerar uma sugestão e revise antes de aceitar.",
      fullAnswer: "A IA de texto ajuda a transformar anotações em linguagem mais clara e técnica. Depois da sugestão, revise, aceite ou recuse. O usuário continua responsável pelo conteúdo final.",
      nextAction: "Abra um relatório ou RDO e procure os botões Melhorar com IA/Gerar texto.",
      canSave: true
    },
    {
      category: "suporte",
      title: "Como falar com suporte?",
      keywords: ["suporte", "ajuda", "falar com suporte", "whatsapp suporte", "atendimento"],
      shortAnswer: "Use o botão Suporte WhatsApp do Elo. Se não houver número configurado, o Elo avisará.",
      fullAnswer: "O suporte por WhatsApp é assistido. Quando o número estiver configurado, o Elo abrirá uma conversa com uma mensagem pronta. Não há API oficial do WhatsApp integrada nesta versão.",
      nextAction: "Clique em Suporte WhatsApp no painel do Elo.",
      canSave: true
    },
    {
      category: "primeiros_passos",
      title: "O que você consegue fazer?",
      keywords: ["o que voce consegue fazer", "o que você consegue fazer", "o que faz", "ajuda", "elo"],
      shortAnswer: "Eu ajudo você a usar relatórios, PDF, RDO, fotos, materiais, planos e suporte.",
      fullAnswer: "Eu sou o Elo Assistente do ObraReport. Nesta versão, lembro dúvidas neste navegador, procuro na base local de ajuda, respondo perguntas rápidas e preparo a arquitetura para busca futura na internet.",
      nextAction: "Experimente perguntar: Como gerar PDF? ou Como usar o RDO?",
      canSave: true
    }
  ];

  // ELO_MEMORY_LOCAL
  function getMemory() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return normalizeMemory(parsed);
    } catch (error) {
      return normalizeMemory(null);
    }
  }

  function setMemory(memory) {
    try {
      window.localStorage.setItem(ELO_CONFIG.storageKey, JSON.stringify(normalizeMemory(memory)));
    } catch (error) {
      // Memoria local pode falhar em modo privado. O Elo continua respondendo sem salvar.
    }
  }

  function normalizeMemory(memory) {
    return {
      conversations: Array.isArray(memory && memory.conversations) ? memory.conversations.slice(0, ELO_CONFIG.maxHistory) : [],
      usefulAnswers: Array.isArray(memory && memory.usefulAnswers) ? memory.usefulAnswers.slice(0, ELO_CONFIG.maxHistory) : [],
      personalMemories: Array.isArray(memory && memory.personalMemories) ? memory.personalMemories.slice(0, ELO_CONFIG.maxHistory) : [],
      libraryItems: Array.isArray(memory && memory.libraryItems) ? memory.libraryItems : [],
      projects: Array.isArray(memory && memory.projects) ? memory.projects : [],
      goals: Array.isArray(memory && memory.goals) ? memory.goals : [],
      feedback: Array.isArray(memory && memory.feedback) ? memory.feedback.slice(0, ELO_CONFIG.maxHistory) : [],
      isOpen: Boolean(memory && memory.isOpen)
    };
  }

  // ELO_SESSION_MEMORY
  const ELO_SESSION_MEMORY = {
    lastQuestion: "",
    lastAnswer: "",
    lastTheme: "",
    lastContext: "",
    recentIntents: [],
    lastRecommendation: ""
  };

  function rememberSessionTurn(question, response, answer) {
    const normalizedQuestion = normalizeText(question);
    const detectedTheme = response.sessionTheme || detectConversationTheme(normalizedQuestion) || ELO_SESSION_MEMORY.lastTheme;
    const detectedIntent = response.sessionIntent || detectConversationIntent(normalizedQuestion);
    ELO_SESSION_MEMORY.lastQuestion = sanitizeUserText(question).slice(0, 220);
    ELO_SESSION_MEMORY.lastAnswer = sanitizeUserText(answer || "").slice(0, 900);
    ELO_SESSION_MEMORY.lastTheme = detectedTheme || "";
    ELO_SESSION_MEMORY.lastContext = getCurrentScreenContext().label;
    ELO_SESSION_MEMORY.lastRecommendation = sanitizeUserText(response.nextAction || "").slice(0, 260);
    if (detectedIntent) {
      ELO_SESSION_MEMORY.recentIntents = [detectedIntent].concat(ELO_SESSION_MEMORY.recentIntents.filter(function (item) {
        return item !== detectedIntent;
      })).slice(0, 3);
    }
  }

  function getSessionContinuationResponse(normalizedQuestion) {
    if (!isSessionContinuationQuestion(normalizedQuestion)) {
      return null;
    }

    const theme = getContinuationTheme(normalizedQuestion);
    if (!theme) {
      return {
        shortAnswer: "Posso continuar, mas preciso de um tema.",
        fullAnswer: "Me diga sobre qual parte do ObraReport você quer continuar: PDF, RDO, materiais, planos ou relatórios?",
        nextAction: "Escreva, por exemplo: continuar sobre PDF ou continuar sobre materiais.",
        canSave: false,
        sessionTheme: "",
        sessionIntent: "continuidade"
      };
    }

    if (theme === "planos" && hasAnyTerm(normalizedQuestion, ["empresa", "plano empresa"])) {
      const planAnswer = getGuidedStepResponse("plano empresa");
      planAnswer.sessionTheme = "planos";
      planAnswer.sessionIntent = "continuidade";
      return planAnswer;
    }

    if (theme === "materiais" && hasAnyTerm(normalizedQuestion, ["audito", "auditoria", "auditar", "comparo", "comparar"])) {
      const auditAnswer = getGuidedStepResponse("auditoria de consumo");
      auditAnswer.sessionTheme = "auditoria";
      auditAnswer.sessionIntent = "continuidade";
      return auditAnswer;
    }

    const context = getCurrentScreenContext().label;
    const themeAnswers = {
      pdf: {
        shortAnswer: "Depois do PDF, revise a entrega.",
        fullAnswer: "Depois de gerar o PDF, você pode baixar o arquivo, enviar ao cliente ou compartilhar um resumo por WhatsApp, se essa opção estiver disponível.",
        nextAction: "Abra o PDF gerado e confira se obra, fotos, conclusão e identificação estão corretas."
      },
      relatorio: {
        shortAnswer: "Depois do relatório, revise antes de entregar.",
        fullAnswer: "Confira cliente, obra, fotos, inconformidades, conclusão técnica e a etapa Gerar. Se estiver completo, avance para o PDF.",
        nextAction: "Pergunte: posso gerar o PDF?"
      },
      rdo: {
        shortAnswer: "No RDO, avance pelo que falta preencher.",
        fullAnswer: "Confira data, obra, responsável, equipe, serviços, produção, materiais, ocorrências, fotos e resumo. Depois salve e gere o PDF do diário.",
        nextAction: "Pergunte: revisar RDO."
      },
      materiais: {
        shortAnswer: "Agora revise os materiais lançados.",
        fullAnswer: "Confira se material, quantidade, unidade e valor fazem sentido. Se houver produção executada, compare o consumo registrado com o consumo estimado.",
        nextAction: "Pergunte: como funciona auditoria de consumo?"
      },
      auditoria: {
        shortAnswer: "Na auditoria, compare estimado e registrado.",
        fullAnswer: "Veja se há produção executada, composições e materiais consumidos. A diferença ajuda a identificar consumo acima ou abaixo do previsto.",
        nextAction: "Revise a auditoria antes de gerar o resumo do RDO."
      },
      planos: {
        shortAnswer: "Nos planos, escolha o caminho comercial.",
        fullAnswer: "Compare Gratuito, Profissional e Empresa. Para vender manualmente nesta fase, use o WhatsApp do plano adequado e siga com ativação assistida.",
        nextAction: "Se for equipe ou construtora, avalie o plano Empresa."
      },
      whatsapp: {
        shortAnswer: "Depois do WhatsApp, revise a mensagem.",
        fullAnswer: "O ObraReport abre uma mensagem pronta. Revise obra, cliente, produção, materiais e ocorrências antes de enviar.",
        nextAction: "Se o WhatsApp não abrir, verifique pop-ups e WhatsApp Web/app."
      },
      fotos: {
        shortAnswer: "Depois das fotos, revise legendas e contexto.",
        fullAnswer: "Confira se as fotos mostram claramente o problema, etapa da obra ou evidência. Use legenda objetiva antes de gerar o PDF.",
        nextAction: "Depois avance para revisão/conclusão."
      },
      salvamento: {
        shortAnswer: "Depois de salvar, confira o histórico.",
        fullAnswer: "Veja se o item aparece na lista, histórico ou status da tela. Evite recarregar antes de confirmar o salvamento.",
        nextAction: "Se houver dúvida, pergunte: o que está pendente?"
      },
      sincronizacao: {
        shortAnswer: "Na sincronização, acompanhe o status da tela.",
        fullAnswer: "Use o status local/nuvem exibido pelo ObraReport. Se algo não sincronizar, mantenha a página aberta e tente salvar novamente.",
        nextAction: "Não limpe o navegador antes de confirmar os dados."
      },
      cliente: {
        shortAnswer: "Depois do cliente, vincule uma obra.",
        fullAnswer: "O cliente organiza obras, relatórios e RDOs. Depois de cadastrar, crie a obra vinculada e siga para relatório ou diário.",
        nextAction: "Abra Obras para cadastrar ou revisar a obra vinculada."
      },
      obra: {
        shortAnswer: "Depois da obra, escolha o documento.",
        fullAnswer: "Com a obra cadastrada, você pode criar relatório técnico, RDO, lançar materiais e gerar PDFs profissionais.",
        nextAction: "Escolha Relatórios ou Diário de Obras."
      },
      suporte: {
        shortAnswer: "No suporte, descreva o problema de forma objetiva.",
        fullAnswer: "Informe a tela, o que tentou fazer e a mensagem exibida. Isso ajuda a orientar a implantação ou correção.",
        nextAction: "Use WhatsApp de suporte quando estiver configurado."
      }
    };

    const answer = themeAnswers[theme] || {
      shortAnswer: "Vamos continuar pelo contexto atual.",
      fullAnswer: "Você estava falando sobre " + theme + " em " + (ELO_SESSION_MEMORY.lastContext || context) + ".",
      nextAction: ELO_SESSION_MEMORY.lastRecommendation || "Pergunte o que falta preencher ou o que devo fazer agora."
    };

    return Object.assign({}, answer, {
      canSave: false,
      sessionTheme: theme,
      sessionIntent: "continuidade"
    });
  }

  function isSessionContinuationQuestion(normalizedQuestion) {
    const exact = [
      "e depois",
      "e agora",
      "como faco isso",
      "como faço isso",
      "pode explicar melhor",
      "me diga o proximo passo",
      "me diga o próximo passo",
      "continua",
      "sim",
      "nao entendi",
      "não entendi",
      "o que falta"
    ];
    return exact.some(function (item) {
      const normalizedItem = normalizeText(item);
      return normalizedQuestion === normalizedItem || normalizedQuestion.indexOf(normalizedItem + " ") === 0;
    }) || (normalizedQuestion.indexOf("e ") === 0 && normalizedQuestion.length <= 80);
  }

  function getContinuationTheme(normalizedQuestion) {
    return detectConversationTheme(normalizedQuestion) || ELO_SESSION_MEMORY.lastTheme;
  }

  function detectConversationTheme(normalizedQuestion) {
    const themes = [
      ["pdf", ["pdf", "gerar pdf", "baixar pdf", "documento"]],
      ["relatorio", ["relatorio", "relatórios", "relatorio tecnico", "qualidade"]],
      ["rdo", ["rdo", "diario", "diário", "diario de obra"]],
      ["materiais", ["material", "materiais", "consumo"]],
      ["auditoria", ["auditoria", "audito", "auditar", "comparar consumo"]],
      ["planos", ["plano", "planos", "profissional", "empresa", "gratuito"]],
      ["whatsapp", ["whatsapp", "zap", "mensagem"]],
      ["fotos", ["foto", "fotos", "imagem", "imagens"]],
      ["salvamento", ["salvar", "salvamento", "salvo"]],
      ["sincronizacao", ["sincronizar", "sincronizacao", "sincronização", "nuvem"]],
      ["cliente", ["cliente", "clientes"]],
      ["obra", ["obra", "obras"]],
      ["suporte", ["suporte", "ajuda", "problema"]]
    ];
    const match = themes.find(function (item) {
      return item[1].some(function (term) {
        return normalizedQuestion.indexOf(normalizeText(term)) >= 0;
      });
    });
    return match ? match[0] : "";
  }

  function detectConversationIntent(normalizedQuestion) {
    if (isSessionContinuationQuestion(normalizedQuestion)) {
      return "continuidade";
    }
    if (hasAnyTerm(normalizedQuestion, ["como", "passo", "fazer", "criar", "gerar"])) {
      return "orientacao";
    }
    if (hasAnyTerm(normalizedQuestion, ["revisar", "pendente", "falta", "posso"])) {
      return "revisao";
    }
    if (hasAnyTerm(normalizedQuestion, ["nao", "não", "erro", "sumiu", "nao abre", "não abre"])) {
      return "diagnostico";
    }
    return "pergunta";
  }

  function saveConversation(question, answer) {
    const memory = getMemory();
    memory.conversations.unshift({
      question: sanitizeUserText(question),
      answer: sanitizeUserText(answer),
      createdAt: new Date().toISOString()
    });
    memory.conversations = memory.conversations.slice(0, ELO_CONFIG.maxHistory);
    setMemory(memory);
  }

  function getRecentQuestions() {
    return getMemory().conversations.slice(0, ELO_CONFIG.maxHistory);
  }

  function saveUsefulAnswer(question, answer) {
    const memory = getMemory();
    memory.usefulAnswers.unshift({
      question: sanitizeUserText(question),
      answer: sanitizeUserText(answer),
      createdAt: new Date().toISOString()
    });
    memory.usefulAnswers = memory.usefulAnswers.slice(0, ELO_CONFIG.maxHistory);
    setMemory(memory);
  }

  function searchSavedKnowledge(question) {
    const normalizedQuestion = normalizeText(question);
    if (!normalizedQuestion) {
      return null;
    }

    return getMemory().usefulAnswers.find(function (item) {
      return normalizeText(item.question).indexOf(normalizedQuestion) >= 0 ||
        normalizedQuestion.indexOf(normalizeText(item.question)) >= 0;
    }) || null;
  }

  function saveFeedback(question, answer, feedback) {
    const memory = getMemory();
    memory.feedback.unshift({
      question: sanitizeUserText(question),
      answer: sanitizeUserText(answer),
      feedback: feedback === "positive" ? "positive" : "negative",
      createdAt: new Date().toISOString()
    });
    memory.feedback = memory.feedback.slice(0, ELO_CONFIG.maxHistory);
    setMemory(memory);
  }

  function clearMemory() {
    const currentMemory = getMemory();
    const memory = normalizeMemory(null);
    memory.isOpen = getWidgetState();
    memory.personalMemories = currentMemory.personalMemories || [];
    memory.libraryItems = currentMemory.libraryItems || [];
    memory.projects = currentMemory.projects || [];
    memory.goals = currentMemory.goals || [];
    setMemory(memory);
  }

  // ELO_BACKUP_LOCAL
  function buildBackupPayload() {
    return {
      version: "1.0",
      source: "obrareport-elo",
      exportedAt: new Date().toISOString(),
      storageKey: ELO_CONFIG.storageKey,
      data: getMemory()
    };
  }

  function exportEloData() {
    const payload = buildBackupPayload();
    const json = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const fileName = "obrareport-elo-backup-" + date + ".json";

    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () {
        window.URL.revokeObjectURL(url);
      }, 800);
      return { ok: true, fileName: fileName };
    } catch (error) {
      return { ok: false, reason: "download" };
    }
  }

  function importEloDataObject(payload) {
    const candidate = payload && payload.data ? payload.data : payload;
    const importedMemory = normalizeMemory(candidate);
    importedMemory.isOpen = getWidgetState();
    setMemory(importedMemory);
    return importedMemory;
  }

  function importEloDataFromFile(file, onDone) {
    if (!file) {
      onDone({ ok: false, reason: "missing" });
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const importedMemory = importEloDataObject(parsed);
        onDone({
          ok: true,
          counts: {
            conversations: importedMemory.conversations.length,
            personalMemories: importedMemory.personalMemories.length,
            libraryItems: importedMemory.libraryItems.length,
            projects: importedMemory.projects.length,
            goals: importedMemory.goals.length
          }
        });
      } catch (error) {
        onDone({ ok: false, reason: "invalid" });
      }
    };
    reader.onerror = function () {
      onDone({ ok: false, reason: "read" });
    };
    reader.readAsText(file);
  }

  function clearAllEloData() {
    const memory = normalizeMemory(null);
    memory.isOpen = getWidgetState();
    setMemory(memory);
  }

  function getWidgetState() {
    return getMemory().isOpen;
  }

  function setWidgetState(isOpen) {
    const memory = getMemory();
    memory.isOpen = Boolean(isOpen);
    setMemory(memory);
  }

  // ELO_PERSONAL_MEMORY
  function createPersonalMemoryId() {
    return "mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function hasSensitiveMemoryTerm(question) {
    const text = normalizeText(question);
    return ["senha", "cpf", "cartao", "cartao de credito", "token", "chave api", "api key", "banco", "dados bancarios", "pix"].some(function (term) {
      return text.indexOf(term) >= 0;
    });
  }

  function detectPersonalMemory(question) {
    if (hasSensitiveMemoryTerm(question)) {
      return {
        blocked: true
      };
    }

    const cleanQuestion = sanitizeUserText(question);
    const patterns = [
      { regex: /^meu nome (?:é|e) (.+)$/i, label: "meu nome", category: "nome" },
      { regex: /^eu me chamo (.+)$/i, label: "meu nome", category: "nome" },
      { regex: /^meu filho se chama (.+)$/i, label: "nome do meu filho", category: "familia" },
      { regex: /^minha filha se chama (.+)$/i, label: "nome da minha filha", category: "familia" },
      { regex: /^minha empresa (?:é|e) (.+)$/i, label: "minha empresa", category: "empresa" },
      { regex: /^eu moro em (.+)$/i, label: "onde eu moro", category: "cidade" },
      { regex: /^minha cidade (?:é|e) (.+)$/i, label: "minha cidade", category: "cidade" },
      { regex: /^meu projeto principal (?:é|e) (.+)$/i, label: "meu projeto principal", category: "projeto" },
      { regex: /^eu gosto de (.+)$/i, label: "algo que eu gosto", category: "preferencia" },
      { regex: /^lembre que (.+)$/i, label: "lembrete", category: "geral" }
    ];

    for (let index = 0; index < patterns.length; index += 1) {
      const match = cleanQuestion.match(patterns[index].regex);
      if (match && match[1]) {
        return {
          id: createPersonalMemoryId(),
          label: patterns[index].label,
          value: sanitizeUserText(match[1]),
          category: patterns[index].category,
          createdAt: new Date().toISOString(),
          sourceQuestion: cleanQuestion
        };
      }
    }

    return null;
  }

  function savePersonalMemory(memoryItem) {
    const memory = getMemory();
    memory.personalMemories = (memory.personalMemories || []).filter(function (item) {
      return !(item.category === memoryItem.category && normalizeText(item.label) === normalizeText(memoryItem.label));
    });
    memory.personalMemories.unshift(memoryItem);
    memory.personalMemories = memory.personalMemories.slice(0, ELO_CONFIG.maxHistory);
    setMemory(memory);
  }

  function getPersonalMemories() {
    return getMemory().personalMemories || [];
  }

  function deletePersonalMemory(id) {
    const memory = getMemory();
    memory.personalMemories = (memory.personalMemories || []).filter(function (item) {
      return item.id !== id;
    });
    setMemory(memory);
  }

  function clearPersonalMemories() {
    const memory = getMemory();
    memory.personalMemories = [];
    setMemory(memory);
  }

  function findPersonalMemoryByLabel(label) {
    const normalizedLabel = normalizeText(label);
    return getPersonalMemories().find(function (item) {
      return normalizeText(item.label) === normalizedLabel;
    }) || null;
  }

  function answerPersonalMemoryQuestion(question) {
    const text = normalizeText(question);
    const memories = getPersonalMemories();

    if (!memories.length) {
      if (text.indexOf("o que voce lembra de mim") >= 0 || text.indexOf("o que você lembra de mim") >= 0) {
        return {
          shortAnswer: "Ainda não tenho memórias pessoais salvas.",
          fullAnswer: "Quando você me disser algo como 'meu filho se chama Davi', eu vou perguntar se devo lembrar antes de salvar.",
          nextAction: "Você pode me ensinar uma memória simples agora.",
          canSave: false
        };
      }
      return null;
    }

    const queryMap = [
      { tests: ["qual meu nome", "como eu me chamo"], label: "meu nome", response: "Você me disse que seu nome é " },
      { tests: ["qual o nome do meu filho"], label: "nome do meu filho", response: "Você me disse que seu filho se chama " },
      { tests: ["qual o nome da minha filha"], label: "nome da minha filha", response: "Você me disse que sua filha se chama " },
      { tests: ["qual minha empresa"], label: "minha empresa", response: "Você me disse que sua empresa é " },
      { tests: ["onde eu moro", "qual minha cidade"], label: "minha cidade", fallbackLabel: "onde eu moro", response: "Você me disse que sua cidade é " },
      { tests: ["qual meu projeto principal"], label: "meu projeto principal", response: "Eu lembro que seu projeto principal é " },
      { tests: ["do que eu gosto"], label: "algo que eu gosto", response: "Você me disse que gosta de " }
    ];

    for (let index = 0; index < queryMap.length; index += 1) {
      const query = queryMap[index];
      const matched = query.tests.some(function (test) {
        return text.indexOf(test) >= 0;
      });
      if (matched) {
        const memoryItem = findPersonalMemoryByLabel(query.label) || (query.fallbackLabel ? findPersonalMemoryByLabel(query.fallbackLabel) : null);
        if (memoryItem) {
          return {
            shortAnswer: query.response + memoryItem.value + ".",
            fullAnswer: "Essa memória está salva apenas neste navegador, na categoria " + memoryItem.category + ".",
            nextAction: "Use Minhas memórias para revisar ou excluir quando quiser.",
            canSave: false
          };
        }
      }
    }

    if (text.indexOf("o que voce lembra de mim") >= 0 || text.indexOf("o que você lembra de mim") >= 0) {
      return {
        shortAnswer: "Eu lembro destas informações pessoais salvas neste navegador:",
        fullAnswer: memories.map(function (item) {
          return "- " + item.label + ": " + item.value;
        }).join("\n"),
        nextAction: "Use Minhas memórias para revisar, excluir ou limpar tudo.",
        canSave: false
      };
    }

    return null;
  }

  // ELO_LIBRARY_LOCAL
  const ELO_LIBRARY_CATEGORIES = [
    "ObraReport",
    "Relatórios",
    "RDO",
    "Materiais",
    "Receitas",
    "Procedimentos",
    "Checklists",
    "Ideias",
    "Pessoal",
    "Geral"
  ];

  function createLibraryItemId() {
    return "lib_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function sanitizeLibraryText(value, limit) {
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, limit || 3000);
  }

  function normalizeLibraryCategory(category) {
    const normalizedCategory = normalizeText(category);
    return ELO_LIBRARY_CATEGORIES.find(function (item) {
      return normalizeText(item) === normalizedCategory;
    }) || "Geral";
  }

  function parseLibraryTags(tags) {
    if (Array.isArray(tags)) {
      return tags.map(function (tag) {
        return sanitizeUserText(tag);
      }).filter(Boolean).slice(0, 12);
    }

    return String(tags || "")
      .split(",")
      .map(function (tag) {
        return sanitizeUserText(tag);
      })
      .filter(Boolean)
      .slice(0, 12);
  }

  function getLibraryItems() {
    return (getMemory().libraryItems || []).slice().sort(function (first, second) {
      if (Boolean(first.favorite) !== Boolean(second.favorite)) {
        return first.favorite ? -1 : 1;
      }
      return new Date(second.updatedAt || second.createdAt || 0) - new Date(first.updatedAt || first.createdAt || 0);
    });
  }

  function isSensitiveLibraryContent() {
    return Array.prototype.slice.call(arguments).some(function (value) {
      return hasSensitiveMemoryTerm(value);
    });
  }

  function saveLibraryItem(input) {
    const title = sanitizeLibraryText(input && input.title, 120);
    const content = sanitizeLibraryText(input && input.content, 3000);
    const category = normalizeLibraryCategory(input && input.category);
    const tags = parseLibraryTags(input && input.tags);
    const source = sanitizeUserText(input && input.source) || "manual";

    if (!title || !content) {
      return { ok: false, reason: "missing" };
    }

    if (isSensitiveLibraryContent(title, content, tags.join(" "))) {
      return { ok: false, reason: "sensitive" };
    }

    const memory = getMemory();
    const now = new Date().toISOString();
    const item = {
      id: input && input.id ? sanitizeUserText(input.id) : createLibraryItemId(),
      title: title,
      content: content,
      category: category,
      tags: tags,
      source: source,
      createdAt: input && input.createdAt ? input.createdAt : now,
      updatedAt: now,
      favorite: Boolean(input && input.favorite)
    };

    memory.libraryItems = (memory.libraryItems || []).filter(function (savedItem) {
      return savedItem.id !== item.id;
    });
    memory.libraryItems.unshift(item);
    setMemory(memory);
    return { ok: true, item: item };
  }

  function deleteLibraryItem(id) {
    const memory = getMemory();
    memory.libraryItems = (memory.libraryItems || []).filter(function (item) {
      return item.id !== id;
    });
    setMemory(memory);
  }

  function toggleLibraryFavorite(id) {
    const memory = getMemory();
    let updatedItem = null;
    memory.libraryItems = (memory.libraryItems || []).map(function (item) {
      if (item.id !== id) {
        return item;
      }
      updatedItem = Object.assign({}, item, {
        favorite: !item.favorite,
        updatedAt: new Date().toISOString()
      });
      return updatedItem;
    });
    setMemory(memory);
    return updatedItem;
  }

  function summarizeLibraryContent(content) {
    const cleanContent = sanitizeLibraryText(content, 3000).replace(/\s+/g, " ");
    if (cleanContent.length <= 220) {
      return cleanContent;
    }
    return cleanContent.slice(0, 217).trim() + "...";
  }

  function suggestLibraryTitle(question) {
    const cleanQuestion = sanitizeUserText(question);
    if (!cleanQuestion) {
      return "Resposta do Elo";
    }
    return cleanQuestion.charAt(0).toUpperCase() + cleanQuestion.slice(1).replace(/[?.!]+$/g, "");
  }

  function suggestLibraryCategory(question) {
    const text = normalizeText(question);
    const categoryMap = [
      { category: "Relatórios", keywords: ["relatorio", "pdf", "foto", "qualidade"] },
      { category: "RDO", keywords: ["rdo", "diario", "diario de obras"] },
      { category: "Materiais", keywords: ["material", "materiais", "consumo", "auditoria"] },
      { category: "Receitas", keywords: ["receita", "bolo", "cozinhar", "ingrediente"] },
      { category: "Procedimentos", keywords: ["procedimento", "passo", "processo", "como fazer"] },
      { category: "Checklists", keywords: ["checklist", "lista", "verificar", "conferir"] },
      { category: "Ideias", keywords: ["ideia", "sugestao", "planejar"] },
      { category: "Pessoal", keywords: ["pessoal", "familia", "filho", "gosto"] },
      { category: "ObraReport", keywords: ["obrareport", "elo", "plano", "cliente", "obra"] }
    ];

    const match = categoryMap.find(function (item) {
      return item.keywords.some(function (keyword) {
        return text.indexOf(keyword) >= 0;
      });
    });
    return match ? match.category : "Geral";
  }

  function createLibraryItemFromAnswer(question, answer) {
    return saveLibraryItem({
      title: suggestLibraryTitle(question),
      content: answer,
      category: suggestLibraryCategory(question),
      tags: [suggestLibraryCategory(question), "Elo"],
      source: "resposta_elo"
    });
  }

  function scoreLibraryItem(item, normalizedQuestion) {
    const normalizedParts = normalizedQuestion.split(" ").filter(function (part) {
      return part.length > 2;
    });
    const searchable = normalizeText([
      item.title,
      item.content,
      item.category,
      (item.tags || []).join(" ")
    ].join(" "));
    let score = item.favorite ? 1 : 0;

    if (!searchable || !normalizedQuestion) {
      return 0;
    }

    if (searchable.indexOf(normalizedQuestion) >= 0) {
      score += 8;
    }

    normalizedParts.forEach(function (part) {
      if (searchable.indexOf(part) >= 0) {
        score += part.length > 5 ? 3 : 1;
      }
    });

    if (normalizeText(item.title).indexOf(normalizedQuestion) >= 0) {
      score += 5;
    }

    return score;
  }

  function searchLibraryItems(question, category) {
    const normalizedQuestion = normalizeText(question);
    const normalizedCategory = category && category !== "Todas" ? normalizeText(category) : "";

    return getLibraryItems().map(function (item) {
      return {
        item: item,
        score: scoreLibraryItem(item, normalizedQuestion)
      };
    }).filter(function (entry) {
      const categoryMatches = !normalizedCategory || normalizeText(entry.item.category) === normalizedCategory;
      const queryMatches = !normalizedQuestion || entry.score > 0;
      return categoryMatches && queryMatches;
    }).sort(function (first, second) {
      if (second.score !== first.score) {
        return second.score - first.score;
      }
      if (Boolean(first.item.favorite) !== Boolean(second.item.favorite)) {
        return first.item.favorite ? -1 : 1;
      }
      return new Date(second.item.updatedAt || second.item.createdAt || 0) - new Date(first.item.updatedAt || first.item.createdAt || 0);
    }).map(function (entry) {
      return entry.item;
    });
  }

  function answerFromLibrary(question) {
    const results = searchLibraryItems(question, "");
    const item = results[0];
    if (!item || scoreLibraryItem(item, normalizeText(question)) < 4) {
      return null;
    }

    return {
      shortAnswer: "Encontrei isso na sua Biblioteca do Elo:",
      fullAnswer: item.title + "\n\n" + summarizeLibraryContent(item.content) + "\n\nCategoria: " + item.category,
      nextAction: "Use o botao Ver completo ou abra Biblioteca para revisar esse item.",
      canSave: false,
      libraryItem: item
    };
  }

  // ELO_PROJECTS
  const ELO_PROJECT_STATUSES = ["ativo", "pausado", "concluido", "ideia"];
  const ELO_PROJECT_PRIORITIES = ["alta", "media", "baixa"];
  const ELO_PROJECT_SUGGESTIONS = [
    {
      name: "ObraReport",
      status: "ativo",
      priority: "alta",
      description: "SaaS de relatórios, RDO, materiais, PDF e Elo Assistente.",
      nextAction: "Continuar evolução comercial e validar com clientes.",
      notes: ""
    },
    {
      name: "Stock IA",
      status: "ideia",
      priority: "media",
      description: "App/controle inteligente de almoxarifado com OCR, IA e estoque offline.",
      nextAction: "Definir MVP e primeiro fluxo de estoque.",
      notes: ""
    },
    {
      name: "CADISTA IA",
      status: "pausado",
      priority: "media",
      description: "Copiloto técnico para transformar croquis/PDFs em plantas, cortes e pranchas.",
      nextAction: "Retomar motor geométrico quando ObraReport estabilizar.",
      notes: ""
    },
    {
      name: "Elo",
      status: "ativo",
      priority: "alta",
      description: "Companheiro digital com memória, biblioteca, rotina e futura busca/voz/hardware.",
      nextAction: "Evoluir projetos, objetivos e contexto pessoal.",
      notes: ""
    }
  ];

  function createProjectId() {
    return "proj_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeProjectStatus(status) {
    const normalizedStatus = normalizeText(status);
    return ELO_PROJECT_STATUSES.find(function (item) {
      return normalizeText(item) === normalizedStatus;
    }) || "ativo";
  }

  function normalizeProjectPriority(priority) {
    const normalizedPriority = normalizeText(priority);
    return ELO_PROJECT_PRIORITIES.find(function (item) {
      return normalizeText(item) === normalizedPriority;
    }) || "media";
  }

  function getProjects() {
    const priorityScore = {
      alta: 0,
      media: 1,
      baixa: 2
    };
    const statusScore = {
      ativo: 0,
      ideia: 1,
      pausado: 2,
      concluido: 3
    };

    return (getMemory().projects || []).slice().sort(function (first, second) {
      const firstPriority = priorityScore[first.priority] !== undefined ? priorityScore[first.priority] : 9;
      const secondPriority = priorityScore[second.priority] !== undefined ? priorityScore[second.priority] : 9;
      if (firstPriority !== secondPriority) {
        return firstPriority - secondPriority;
      }

      const firstStatus = statusScore[first.status] !== undefined ? statusScore[first.status] : 9;
      const secondStatus = statusScore[second.status] !== undefined ? statusScore[second.status] : 9;
      if (firstStatus !== secondStatus) {
        return firstStatus - secondStatus;
      }

      return new Date(second.updatedAt || second.createdAt || 0) - new Date(first.updatedAt || first.createdAt || 0);
    });
  }

  function getProjectById(id) {
    return getProjects().find(function (project) {
      return project.id === id;
    }) || null;
  }

  function findProjectByName(name) {
    const normalizedName = normalizeText(name);
    return getProjects().find(function (project) {
      return normalizeText(project.name) === normalizedName || normalizeText(project.name).indexOf(normalizedName) >= 0;
    }) || null;
  }

  function getMainProject() {
    return getProjects().find(function (project) {
      return project.status === "ativo" && project.priority === "alta";
    }) || getProjects().find(function (project) {
      return project.priority === "alta";
    }) || getProjects()[0] || null;
  }

  function saveProject(input) {
    const name = sanitizeLibraryText(input && input.name, 120);
    const description = sanitizeLibraryText(input && input.description, 600);
    const nextAction = sanitizeLibraryText(input && input.nextAction, 300);
    const notes = sanitizeLibraryText(input && input.notes, 1000);
    const status = normalizeProjectStatus(input && input.status);
    const priority = normalizeProjectPriority(input && input.priority);

    if (!name) {
      return { ok: false, reason: "missing" };
    }

    if (isSensitiveLibraryContent(name, description, nextAction, notes)) {
      return { ok: false, reason: "sensitive" };
    }

    const memory = getMemory();
    const now = new Date().toISOString();
    const existing = input && input.id ? getProjectById(input.id) : null;
    const project = {
      id: existing ? existing.id : createProjectId(),
      name: name,
      status: status,
      priority: priority,
      description: description,
      nextAction: nextAction,
      notes: notes,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    memory.projects = (memory.projects || []).filter(function (item) {
      return item.id !== project.id;
    });
    memory.projects.unshift(project);
    setMemory(memory);
    return { ok: true, project: project };
  }

  function deleteProject(id) {
    const memory = getMemory();
    memory.projects = (memory.projects || []).filter(function (project) {
      return project.id !== id;
    });
    memory.goals = (memory.goals || []).map(function (goal) {
      if (goal.projectId !== id) {
        return goal;
      }
      return Object.assign({}, goal, {
        projectId: "",
        updatedAt: new Date().toISOString()
      });
    });
    setMemory(memory);
  }

  function updateProjectStatus(id, status) {
    const memory = getMemory();
    memory.projects = (memory.projects || []).map(function (project) {
      if (project.id !== id) {
        return project;
      }
      return Object.assign({}, project, {
        status: normalizeProjectStatus(status),
        updatedAt: new Date().toISOString()
      });
    });
    setMemory(memory);
  }

  function addSuggestedProjects() {
    let added = 0;
    ELO_PROJECT_SUGGESTIONS.forEach(function (suggestion) {
      if (!findProjectByName(suggestion.name)) {
        const result = saveProject(suggestion);
        if (result.ok) {
          added += 1;
        }
      }
    });
    return added;
  }

  function answerProjectQuestion(question) {
    const text = normalizeText(question);
    const projects = getProjects();

    if (!projects.length) {
      if (text.indexOf("projeto") >= 0 || text.indexOf("objetivo") >= 0) {
        return {
          shortAnswer: "Ainda não há projetos salvos no Elo.",
          fullAnswer: "Abra Projetos para adicionar seus projetos ou usar a lista sugerida com ObraReport, Stock IA, CADISTA IA e Elo.",
          nextAction: "Clique em Projetos no painel do Elo.",
          canSave: false
        };
      }
      return null;
    }

    if (text.indexOf("quais sao meus projetos") >= 0 || text.indexOf("quais são meus projetos") >= 0) {
      return {
        shortAnswer: "Seus projetos salvos são:",
        fullAnswer: projects.map(function (project) {
          return "- " + project.name + " (" + project.status + ", prioridade " + project.priority + ")";
        }).join("\n"),
        nextAction: "Abra Projetos para revisar, editar ou mudar status.",
        canSave: false
      };
    }

    if (text.indexOf("qual meu projeto principal") >= 0) {
      const mainProject = getMainProject();
      return {
        shortAnswer: "Seu projeto de maior prioridade é " + mainProject.name + ".",
        fullAnswer: mainProject.description || "Ele está salvo na área Projetos do Elo.",
        nextAction: mainProject.nextAction || "Defina uma próxima ação para esse projeto.",
        canSave: false
      };
    }

    if (text.indexOf("quais projetos estao ativos") >= 0 || text.indexOf("quais projetos estão ativos") >= 0) {
      const activeProjects = projects.filter(function (project) {
        return project.status === "ativo";
      });
      return {
        shortAnswer: activeProjects.length ? "Seus projetos ativos são: " + activeProjects.map(function (project) { return project.name; }).join(", ") + "." : "Você não tem projetos ativos salvos agora.",
        fullAnswer: activeProjects.map(function (project) {
          return "- " + project.name + ": " + (project.nextAction || "sem próxima ação definida");
        }).join("\n") || "Marque um projeto como ativo na área Projetos.",
        nextAction: "Abra Projetos para escolher o foco atual.",
        canSave: false
      };
    }

    if (text.indexOf("quais estao pausados") >= 0 || text.indexOf("quais estão pausados") >= 0) {
      const pausedProjects = projects.filter(function (project) {
        return project.status === "pausado";
      });
      return {
        shortAnswer: pausedProjects.length ? "Projetos pausados: " + pausedProjects.map(function (project) { return project.name; }).join(", ") + "." : "Não há projetos pausados salvos.",
        fullAnswer: pausedProjects.map(function (project) {
          return "- " + project.name + ": " + (project.description || "sem descrição");
        }).join("\n") || "Nada pausado por enquanto.",
        nextAction: "Você pode reativar um projeto pela área Projetos.",
        canSave: false
      };
    }

    if (text.indexOf("o que devo continuar") >= 0) {
      const mainProject = getMainProject();
      return {
        shortAnswer: "Eu continuaria por " + mainProject.name + ".",
        fullAnswer: mainProject.description || "Esse parece ser seu projeto mais importante agora.",
        nextAction: mainProject.nextAction || "Defina uma próxima ação objetiva para avançar.",
        canSave: false
      };
    }

    const remindMatch = text.match(/me lembre do (.+)$/);
    if (remindMatch && remindMatch[1]) {
      const project = findProjectByName(remindMatch[1]);
      if (project) {
        return {
          shortAnswer: project.name + " está registrado como " + project.status + ".",
          fullAnswer: project.description || "Sem descrição salva.",
          nextAction: project.nextAction || "Defina a próxima ação desse projeto.",
          canSave: false
        };
      }
    }

    return null;
  }

  // ELO_GOALS
  const ELO_GOAL_STATUSES = ["aberto", "em_andamento", "concluido"];
  const ELO_GOAL_SUGGESTIONS = [
    "vender o ObraReport",
    "terminar Stock IA",
    "comprar ESP32",
    "publicar landing",
    "testar com cliente"
  ];

  function createGoalId() {
    return "goal_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeGoalStatus(status) {
    const normalizedStatus = normalizeText(status);
    return ELO_GOAL_STATUSES.find(function (item) {
      return normalizeText(item) === normalizedStatus;
    }) || "aberto";
  }

  function getGoals() {
    const statusScore = {
      em_andamento: 0,
      aberto: 1,
      concluido: 2
    };

    return (getMemory().goals || []).slice().sort(function (first, second) {
      const firstStatus = statusScore[first.status] !== undefined ? statusScore[first.status] : 9;
      const secondStatus = statusScore[second.status] !== undefined ? statusScore[second.status] : 9;
      if (firstStatus !== secondStatus) {
        return firstStatus - secondStatus;
      }
      return new Date(second.updatedAt || second.createdAt || 0) - new Date(first.updatedAt || first.createdAt || 0);
    });
  }

  function saveGoal(input) {
    const title = sanitizeLibraryText(input && input.title, 160);
    const projectId = sanitizeUserText(input && input.projectId);
    const status = normalizeGoalStatus(input && input.status);
    const targetDate = sanitizeUserText(input && input.targetDate);

    if (!title) {
      return { ok: false, reason: "missing" };
    }

    if (isSensitiveLibraryContent(title, targetDate)) {
      return { ok: false, reason: "sensitive" };
    }

    const memory = getMemory();
    const now = new Date().toISOString();
    const existing = input && input.id ? getGoals().find(function (goal) { return goal.id === input.id; }) : null;
    const goal = {
      id: existing ? existing.id : createGoalId(),
      title: title,
      projectId: projectId,
      status: status,
      targetDate: targetDate,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };

    memory.goals = (memory.goals || []).filter(function (item) {
      return item.id !== goal.id;
    });
    memory.goals.unshift(goal);
    setMemory(memory);
    return { ok: true, goal: goal };
  }

  function deleteGoal(id) {
    const memory = getMemory();
    memory.goals = (memory.goals || []).filter(function (goal) {
      return goal.id !== id;
    });
    setMemory(memory);
  }

  function updateGoalStatus(id, status) {
    const memory = getMemory();
    memory.goals = (memory.goals || []).map(function (goal) {
      if (goal.id !== id) {
        return goal;
      }
      return Object.assign({}, goal, {
        status: normalizeGoalStatus(status),
        updatedAt: new Date().toISOString()
      });
    });
    setMemory(memory);
  }

  function addSuggestedGoals() {
    let added = 0;
    ELO_GOAL_SUGGESTIONS.forEach(function (title) {
      const exists = getGoals().some(function (goal) {
        return normalizeText(goal.title) === normalizeText(title);
      });
      if (!exists && saveGoal({ title: title, status: "aberto", projectId: "" }).ok) {
        added += 1;
      }
    });
    return added;
  }

  function answerGoalQuestion(question) {
    const text = normalizeText(question);
    const goals = getGoals();
    const openGoals = goals.filter(function (goal) {
      return goal.status !== "concluido";
    });

    if (!goals.length) {
      if (text.indexOf("objetivo") >= 0 || text.indexOf("pendente") >= 0) {
        return {
          shortAnswer: "Ainda não há objetivos salvos no Elo.",
          fullAnswer: "Abra Projetos > Objetivos para adicionar objetivos ou usar a lista sugerida.",
          nextAction: "Clique em Projetos no painel do Elo.",
          canSave: false
        };
      }
      return null;
    }

    if (text.indexOf("quais sao meus objetivos") >= 0 || text.indexOf("quais são meus objetivos") >= 0 || text.indexOf("o que esta pendente") >= 0 || text.indexOf("o que está pendente") >= 0) {
      return {
        shortAnswer: openGoals.length ? "Seus objetivos abertos/em andamento são:" : "Você não tem objetivos pendentes agora.",
        fullAnswer: openGoals.map(function (goal) {
          return "- " + goal.title + " (" + goal.status + ")" + (goal.targetDate ? " até " + goal.targetDate : "");
        }).join("\n") || "Os objetivos salvos estão concluídos.",
        nextAction: "Abra Projetos para marcar objetivos como concluídos ou adicionar novos.",
        canSave: false
      };
    }

    if (text.indexOf("qual meu proximo objetivo") >= 0 || text.indexOf("qual meu próximo objetivo") >= 0 || text.indexOf("o que quero fazer com o obrareport") >= 0) {
      const goal = openGoals[0] || goals[0];
      return {
        shortAnswer: "Seu próximo objetivo é: " + goal.title + ".",
        fullAnswer: "Status: " + goal.status + (goal.targetDate ? "\nPrazo: " + goal.targetDate : ""),
        nextAction: "Avance uma pequena etapa desse objetivo hoje.",
        canSave: false
      };
    }

    return null;
  }

  // ELO_TEXT_UTILS
  function sanitizeUserText(value) {
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 600);
  }

  function normalizeText(value) {
    return sanitizeUserText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function formatDateTime(value) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(new Date(value));
    } catch (error) {
      return "data não disponível";
    }
  }

  // ELO_DAILY_ROUTINE
  function isDailyRoutineQuestion(normalizedQuestion) {
    return [
      "bom dia",
      "boa tarde",
      "boa noite",
      "rotina de hoje",
      "comecar meu dia",
      "começar meu dia"
    ].some(function (phrase) {
      const normalizedPhrase = normalizeText(phrase);
      return normalizedQuestion === normalizedPhrase || normalizedQuestion.indexOf(normalizedPhrase + " ") === 0;
    });
  }

  function getDailyRoutineGreeting(normalizedQuestion) {
    if (normalizedQuestion.indexOf("bom dia") === 0) {
      return "Bom dia";
    }
    if (normalizedQuestion.indexOf("boa tarde") === 0) {
      return "Boa tarde";
    }
    if (normalizedQuestion.indexOf("boa noite") === 0) {
      return "Boa noite";
    }
    return "Vamos começar";
  }

  function getDailyRoutineName() {
    const nameMemory = findPersonalMemoryByLabel("meu nome");
    return nameMemory && nameMemory.value ? nameMemory.value : "";
  }

  function getDailyRoutineMemories() {
    const priority = ["projeto", "empresa", "cidade", "preferencia", "familia", "nome", "geral"];
    return getPersonalMemories().slice().sort(function (first, second) {
      return priority.indexOf(first.category) - priority.indexOf(second.category);
    }).slice(0, 3);
  }

  function formatDailyRoutineMemory(memoryItem) {
    const label = normalizeText(memoryItem.label);
    if (label.indexOf("empresa") >= 0) {
      return "sua empresa é " + memoryItem.value;
    }
    if (label.indexOf("projeto principal") >= 0) {
      return "seu projeto principal é " + memoryItem.value;
    }
    if (label.indexOf("cidade") >= 0 || label.indexOf("moro") >= 0) {
      return "sua cidade é " + memoryItem.value;
    }
    if (label.indexOf("gosto") >= 0) {
      return "você gosta de " + memoryItem.value;
    }
    return memoryItem.label + ": " + memoryItem.value;
  }

  function getDailyRoutineLibraryItems() {
    return getLibraryItems().slice(0, 3);
  }

  function getDailyRoutineUsefulAnswers() {
    return getMemory().usefulAnswers.slice(0, 2);
  }

  function getDailyRoutineRecentQuestions() {
    return getRecentQuestions().slice(0, 2);
  }

  function buildDailyRoutineResponse(question) {
    const normalizedQuestion = normalizeText(question);
    const greeting = getDailyRoutineGreeting(normalizedQuestion);
    const name = getDailyRoutineName();
    const greetingLine = name ? greeting + ", " + name + "." : greeting + ".";
    const memories = getDailyRoutineMemories();
    const libraryItems = getDailyRoutineLibraryItems();
    const usefulAnswers = getDailyRoutineUsefulAnswers();
    const recentQuestions = getDailyRoutineRecentQuestions();
    const mainProject = getMainProject();
    const activeProjects = getProjects().filter(function (project) {
      return project.status === "ativo";
    }).slice(0, 3);
    const details = [
      "Ainda não estou conectado ao clima real, mas posso te ajudar a começar o dia.",
      "Você pode continuar gerando relatórios, abrir o RDO, revisar materiais ou consultar sua Biblioteca."
    ];

    if (mainProject) {
      details.push("", "Seu projeto principal hoje é " + mainProject.name + ".");
      if (activeProjects.length) {
        details.push("Projetos ativos: " + activeProjects.map(function (project) {
          return project.name;
        }).join(", ") + ".");
      }
      if (mainProject.nextAction) {
        details.push("Próxima ação sugerida: " + mainProject.nextAction);
      }
    }

    if (memories.length) {
      details.push("", "Pelo que lembro:");
      memories.forEach(function (memoryItem) {
        details.push("- " + formatDailyRoutineMemory(memoryItem) + ".");
      });
    }

    if (libraryItems.length) {
      details.push("", "Na sua Biblioteca, encontrei:");
      libraryItems.forEach(function (item) {
        details.push("- " + item.title);
      });
    }

    if (usefulAnswers.length) {
      details.push("", "Respostas úteis recentes:");
      usefulAnswers.forEach(function (item) {
        details.push("- " + item.question);
      });
    }

    if (recentQuestions.length) {
      details.push("", "Últimas dúvidas que apareceram por aqui:");
      recentQuestions.forEach(function (item) {
        details.push("- " + item.question);
      });
    }

    if (!memories.length && !libraryItems.length) {
      details.push("", "Ainda estou te conhecendo. Você pode me ensinar dizendo algo como: meu projeto principal é ObraReport.");
    }

    details.push("", "Clima, agenda, tarefas e lembretes já têm espaço reservado para uma próxima evolução, sem internet nesta versão.");

    return {
      shortAnswer: greetingLine,
      fullAnswer: details.join("\n"),
      nextAction: "Escolha um card rápido abaixo ou pergunte sobre PDF, RDO, materiais ou relatórios.",
      canSave: false,
      routineCards: [
        { label: "Continuar ObraReport", action: "continue" },
        { label: "Abrir RDO", action: "rdo" },
        { label: "Gerar relatório", action: "report" },
        { label: "Ver biblioteca", action: "library" },
        { label: "Ver memórias", action: "memories" },
        { label: "Perguntar sobre PDF", action: "pdf" }
      ]
    };
  }

  // ELO_DAILY_ROUTINE_FUTURE
  // Espaço preparado para evoluções futuras sem ativar integrações externas agora:
  // - clima real via internet;
  // - agenda do usuário;
  // - tarefas e lembretes do dia.
  const ELO_DAILY_ROUTINE_FUTURE = {
    weatherEnabled: false,
    calendarEnabled: false,
    tasksEnabled: false
  };

  // ELO_WEB_SEARCH_FUTURE
  // A busca real deve acontecer somente por backend/API configuravel.
  // O endpoint futuro devera retornar:
  // {
  //   answer,
  //   sources,
  //   confidence,
  //   shouldSave
  // }
  const ELO_WEB_SEARCH = {
    requestSearch: function (question, context) {
      const cleanQuestion = sanitizeUserText(question);
      const safeContext = sanitizeUserText(context);

      if (!ELO_CONFIG.webSearchEnabled || !ELO_CONFIG.webSearchEndpoint) {
        return Promise.resolve({
          ok: false,
          reason: "disabled",
          query: buildSearchQuery(cleanQuestion)
        });
      }

      if (hasSensitiveMemoryTerm(cleanQuestion) || hasSensitiveMemoryTerm(safeContext)) {
        return Promise.resolve({
          ok: false,
          reason: "sensitive",
          query: buildSearchQuery(cleanQuestion)
        });
      }

      if (typeof window.fetch !== "function") {
        return Promise.resolve({
          ok: false,
          reason: "fetch_unavailable",
          query: buildSearchQuery(cleanQuestion)
        });
      }

      return window.fetch(ELO_CONFIG.webSearchEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: cleanQuestion,
          context: safeContext,
          source: "obrareport-elo",
          timestamp: new Date().toISOString()
        })
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("web_search_http_" + response.status);
        }
        return response.json();
      }).then(function (data) {
        return {
          ok: true,
          answer: sanitizeLibraryText(data && data.answer, 3000),
          sources: Array.isArray(data && data.sources) ? data.sources.slice(0, 5).map(sanitizeUserText) : [],
          confidence: sanitizeUserText(data && data.confidence),
          shouldSave: Boolean(data && data.shouldSave),
          query: buildSearchQuery(cleanQuestion)
        };
      }).catch(function () {
        return {
          ok: false,
          reason: "request_failed",
          query: buildSearchQuery(cleanQuestion)
        };
      });
    }
  };

  function isWeatherQuestion(question) {
    const text = normalizeText(question);
    return ["previsao do tempo", "tempo hoje", "como esta o tempo", "vai chover", "chuva hoje", "clima hoje"].some(function (keyword) {
      return text.indexOf(keyword) >= 0;
    });
  }

  function shouldSearchWeb(question) {
    const text = normalizeText(question);
    return [
      "previsao",
      "tempo hoje",
      "vai chover",
      "noticia",
      "noticias",
      "restaurante",
      "receita",
      "preco atual",
      "cotacao",
      "dolar",
      "informacao recente",
      "informacoes recentes",
      "agenda publica",
      "evento",
      "eventos",
      "legislacao atual",
      "lei atual"
    ].some(function (keyword) {
      return text.indexOf(keyword) >= 0;
    });
  }

  function buildSearchQuery(question) {
    const cleanQuestion = sanitizeUserText(question);
    if (isWeatherQuestion(cleanQuestion)) {
      return "previsão do tempo hoje em Vitória da Conquista";
    }
    return cleanQuestion || "pesquisa relacionada ao ObraReport";
  }

  function explainFutureSearch(question) {
    const query = buildSearchQuery(question);
    if (hasSensitiveMemoryTerm(question)) {
      return {
        shortAnswer: "Por segurança, não vou buscar nem guardar esse tipo de informação.",
        fullAnswer: "Senhas, CPF, cartão, tokens, chaves API e dados bancários não devem ser enviados para busca externa.",
        nextAction: "Faça uma pergunta sem dados sensíveis.",
        canSave: false
      };
    }

    if (isWeatherQuestion(question)) {
      return {
        shortAnswer: "Eu ainda não estou conectado ao clima real.",
        fullAnswer: "Mas essa pergunta já está pronta para a busca controlada. Quando ativada, vou consultar a previsão do tempo, resumir e te responder de forma natural.\n\nConsulta sugerida: " + query,
        nextAction: "Use Preparar busca para ver como esse fluxo ficará quando estiver ativado.",
        canSave: false,
        webSearch: {
          question: sanitizeUserText(question),
          query: query,
          context: "clima"
        }
      };
    }

    return {
      shortAnswer: "Não encontrei isso na minha memória nem na Biblioteca.",
      fullAnswer: "Posso buscar na internet quando a busca estiver ativada.\n\nConsulta sugerida: " + query,
      nextAction: "Use Preparar busca para deixar a consulta pronta, sem chamar endpoint nesta versão.",
      canSave: false,
      webSearch: {
        question: sanitizeUserText(question),
        query: query,
        context: "busca_controlada"
      }
    };
  }

  // ELO_RESPONSE_ENGINE
  function buildResponse(question) {
    const cleanQuestion = sanitizeUserText(question);
    const normalizedQuestion = normalizeText(cleanQuestion);

    if (!normalizedQuestion) {
      return {
        shortAnswer: "Digite uma dúvida para eu ajudar.",
        fullAnswer: "Posso responder sobre relatórios, PDF, RDO, fotos, materiais, planos e suporte.",
        nextAction: "Escolha um botão rápido ou escreva uma pergunta.",
        canSave: false
      };
    }

    const personalMemoryAnswer = answerPersonalMemoryQuestion(cleanQuestion);
    if (personalMemoryAnswer) {
      return personalMemoryAnswer;
    }

    const goalAnswer = answerGoalQuestion(cleanQuestion);
    if (goalAnswer) {
      return goalAnswer;
    }

    const projectAnswer = answerProjectQuestion(cleanQuestion);
    if (projectAnswer) {
      return projectAnswer;
    }

    if (isDailyRoutineQuestion(normalizedQuestion)) {
      return buildDailyRoutineResponse(cleanQuestion);
    }

    const libraryAnswer = answerFromLibrary(cleanQuestion);
    if (libraryAnswer) {
      return libraryAnswer;
    }

    const greeting = getGreetingResponse(normalizedQuestion);
    if (greeting) {
      return greeting;
    }

    const visibleDataAnswer = getVisibleDataKnowledgeResponse(normalizedQuestion);
    if (visibleDataAnswer) {
      return visibleDataAnswer;
    }

    const operational = getOperationalAssistantResponse(normalizedQuestion);
    if (operational) {
      return operational;
    }

    const sessionContinuation = getSessionContinuationResponse(normalizedQuestion);
    if (sessionContinuation) {
      return sessionContinuation;
    }

    const diagnostic = getDiagnosticStepResponse(normalizedQuestion);
    if (diagnostic) {
      return diagnostic;
    }

    const guided = getGuidedStepResponse(normalizedQuestion);
    if (guided) {
      return guided;
    }

    const contextualHelp = getContextualHelpResponse(normalizedQuestion);
    if (contextualHelp) {
      return contextualHelp;
    }

    const screenDataAnswer = answerScreenDataQuestion(cleanQuestion, normalizedQuestion);
    if (screenDataAnswer) {
      return screenDataAnswer;
    }

    const saved = searchSavedKnowledge(cleanQuestion);
    if (saved) {
      return {
        shortAnswer: "Encontrei algo que você pediu para eu lembrar.",
        fullAnswer: saved.answer,
        nextAction: "Se quiser, posso continuar usando essa memória local.",
        canSave: false
      };
    }

    const localAnswer = searchKnowledgeBase(normalizedQuestion);
    if (localAnswer) {
      return localAnswer;
    }

    if (shouldSearchWeb(cleanQuestion)) {
      return explainFutureSearch(cleanQuestion);
    }

    return {
      shortAnswer: "Ainda não encontrei isso na minha memória nem na base do ObraReport.",
      fullAnswer: "Na próxima evolução, vou poder buscar na internet, resumir e salvar para você.",
      nextAction: "Tente perguntar sobre relatórios, PDF, RDO, materiais, fotos, planos ou suporte.",
      canSave: false
    };
  }

  function getOperationalAssistantResponse(normalizedQuestion) {
    const context = getOperationalScreenContext();
    const reviewQuestion = hasAnyTerm(normalizedQuestion, [
      "revisar",
      "revisar rdo",
      "revisar relatorio",
      "verificar antes",
      "antes do pdf",
      "antes de salvar"
    ]);
    const missingQuestion = hasAnyTerm(normalizedQuestion, [
      "o que falta",
      "falta preencher",
      "faltando",
      "o que esta faltando",
      "o que está faltando",
      "o que esta pendente",
      "o que está pendente",
      "pendente",
      "incompleto",
      "esta incompleto",
      "está incompleto"
    ]);
    const nextStepQuestion = hasAnyTerm(normalizedQuestion, [
      "o que devo fazer agora",
      "proximo passo",
      "próximo passo",
      "o que faco agora",
      "o que faço agora"
    ]);
    const canGeneratePdfQuestion = hasAnyTerm(normalizedQuestion, [
      "posso gerar o pdf",
      "posso gerar pdf",
      "esta pronto para pdf",
      "está pronto para pdf",
      "pode gerar pdf"
    ]);
    const canSaveQuestion = hasAnyTerm(normalizedQuestion, [
      "posso salvar",
      "pode salvar",
      "esta pronto para salvar",
      "está pronto para salvar",
      "revisar antes de salvar"
    ]);

    if (reviewQuestion || missingQuestion || nextStepQuestion || canGeneratePdfQuestion || canSaveQuestion) {
      return buildOperationalChecklistResponse(context, {
        review: reviewQuestion,
        missing: missingQuestion,
        nextStep: nextStepQuestion,
        pdf: canGeneratePdfQuestion,
        save: canSaveQuestion
      });
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho materiais registrados", "material registrado", "materiais registrados"])) {
      return buildOperationalPresenceResponse(
        "materiais",
        context.materials,
        ["nenhum material registrado", "nenhum consumo registrado", "r$ 0,00"],
        "➡️ Próximo passo: registre materiais no RDO ou carregue a Obra Exemplo para testar."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho producao lancada", "tenho produção lançada", "producao lancada", "produção lançada"])) {
      return buildOperationalPresenceResponse(
        "produção executada",
        context.production,
        ["nenhuma producao registrada", "nenhuma producao executada registrada"],
        "➡️ Próximo passo: registre a produção executada antes de revisar materiais e PDF."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho fotos anexadas", "foto anexada", "fotos anexadas", "tem foto"])) {
      return buildOperationalPresenceResponse(
        "fotos anexadas",
        context.photos,
        ["nenhuma foto", "0 fotos", "0"],
        "➡️ Próximo passo: adicione fotos para deixar o relatório ou RDO mais completo."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["existe ocorrencia", "existe ocorrência", "tem ocorrencia", "tem ocorrência", "ocorrencia registrada", "ocorrência registrada"])) {
      return buildOperationalPresenceResponse(
        "ocorrência registrada",
        context.occurrences,
        ["nenhuma ocorrencia", "nenhuma ocorrência", "sem ocorrencia", "sem ocorrência"],
        "➡️ Próximo passo: se houve intercorrência, registre a descrição e as providências."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["qual foi o ultimo relatorio", "último relatório", "ultimo relatorio"])) {
      return {
        shortAnswer: context.report ? "Último relatório visível: " + context.report : "Não encontrei relatório visível nesta tela.",
        fullAnswer: context.report ? "✅ Relatório encontrado na tela atual." : getMissingVisibleDataMessage(),
        nextAction: context.report ? "Abra Relatórios para revisar ou gerar PDF." : "Abra Dashboard ou Relatórios para eu ler o histórico visível.",
        canSave: false
      };
    }

    if (hasAnyTerm(normalizedQuestion, ["qual foi o ultimo rdo", "último rdo", "ultimo rdo", "ultimo diario", "último diário"])) {
      return {
        shortAnswer: context.diary ? "Último RDO visível: " + context.diary : "Não encontrei RDO visível nesta tela.",
        fullAnswer: context.diary ? "✅ RDO encontrado na tela atual." : getMissingVisibleDataMessage(),
        nextAction: context.diary ? "Abra o RDO para revisar produção, materiais, fotos e PDF." : "Abra Diário de Obras para eu ler os registros visíveis.",
        canSave: false
      };
    }

    return null;
  }

  function getVisibleDataKnowledgeResponse(normalizedQuestion) {
    const context = getOperationalScreenContext();

    if (hasAnyTerm(normalizedQuestion, ["resuma esta tela", "resumo desta tela", "o que estou vendo", "o que tem aqui", "me de um resumo", "me dê um resumo"])) {
      return buildCurrentScreenSummaryResponse(context);
    }

    if (hasAnyTerm(normalizedQuestion, ["posso gerar pdf", "posso gerar o pdf", "esta pronto para pdf", "está pronto para pdf", "posso exportar", "falta algo antes do pdf"])) {
      return buildPdfReadinessResponse(context);
    }

    if (hasAnyTerm(normalizedQuestion, ["qual obra estou vendo", "qual obra", "obra atual", "ultima obra", "última obra"])) {
      return buildVisibleSingleDataResponse("obra", context.work || context.clientWorks, "Abra Obras, Relatórios ou Diário de Obras para eu ler a obra visível.", "obra");
    }

    if (hasAnyTerm(normalizedQuestion, ["qual cliente estou vendo", "qual cliente", "cliente atual"])) {
      return buildVisibleSingleDataResponse("cliente", context.client, "Abra Clientes, Obras ou Relatórios para eu ler o cliente visível.", "cliente");
    }

    if (hasAnyTerm(normalizedQuestion, ["qual relatorio estou vendo", "qual relatório estou vendo", "qual relatorio", "qual relatório", "ultimo relatorio", "último relatório", "qual foi o ultimo relatorio", "qual foi o último relatório", "ultimo documento", "último documento"])) {
      return buildVisibleSingleDataResponse("relatório", context.report || context.clientReports || context.clientDocs, "Não encontrei uma lista visível de relatórios nesta tela.", "relatorio");
    }

    if (hasAnyTerm(normalizedQuestion, ["qual rdo estou vendo", "qual rdo", "ultimo rdo", "último rdo", "qual foi o ultimo rdo", "qual foi o último rdo"])) {
      return buildVisibleSingleDataResponse("RDO", context.diary || context.clientRdos, "Não encontrei uma lista visível de RDOs nesta tela.", "rdo");
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho materiais registrados", "material registrado", "materiais registrados", "quantos materiais", "quantos materiais aparecem"])) {
      return buildVisibleCollectionResponse(
        "materiais",
        context.materials,
        context.materialCount,
        ["nenhum material registrado", "nenhum consumo registrado", "r$ 0,00"],
        "Abra a seção Materiais do RDO ou confira se os materiais foram preenchidos.",
        "materiais"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho producao lancada", "tenho produção lançada", "producao lancada", "produção lançada", "quantos registros de producao", "quantos registros de produção"])) {
      return buildVisibleCollectionResponse(
        "produção executada",
        context.production,
        context.productionCount,
        ["nenhuma producao registrada", "nenhuma producao executada registrada"],
        "Abra Produção Executada no RDO ou confira se os dados foram preenchidos.",
        "materiais"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho fotos anexadas", "foto anexada", "fotos anexadas", "quantas fotos", "tem foto"])) {
      return buildVisibleCollectionResponse(
        "fotos",
        context.photos,
        context.photoCount,
        ["nenhuma foto", "0 fotos", "0"],
        "Abra Fotos no relatório ou RDO para eu ler anexos visíveis.",
        "fotos"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["existem ocorrencias", "existem ocorrências", "existe ocorrencia", "existe ocorrência", "ocorrencias registradas", "ocorrências registradas"])) {
      const hasOccurrences = hasUsefulValue(context.occurrences) && !isEmptyScreenText(context.occurrences, ["nenhuma ocorrencia", "nenhuma ocorrência"]);
      return {
        shortAnswer: hasOccurrences ? "✅ Encontrei ocorrência registrada visível." : "⚠️ Não encontrei ocorrência registrada visível.",
        fullAnswer: hasOccurrences ? context.occurrences : getMissingVisibleDataMessage(),
        nextAction: hasOccurrences ? "Revise descrição, providências e segurança antes de salvar." : "Abra Intercorrências/Segurança e confira se algo foi preenchido.",
        canSave: false,
        sessionTheme: "rdo",
        sessionIntent: "dados_visiveis"
      };
    }

    if (hasAnyTerm(normalizedQuestion, ["quais indicadores aparecem", "indicadores aparecem", "quais indicadores", "indicadores visiveis", "indicadores visíveis"])) {
      return {
        shortAnswer: context.indicators.length ? "✅ Encontrei indicadores visíveis." : "⚠️ Não encontrei indicadores visíveis.",
        fullAnswer: context.indicators.length ? context.indicators.join("\n") : getMissingVisibleDataMessage(),
        nextAction: context.indicators.length ? "Use esses números para decidir o próximo registro ou revisão." : "Abra Dashboard, Diário ou Página do Cliente para ver indicadores.",
        canSave: false,
        sessionTheme: "relatorio",
        sessionIntent: "dados_visiveis"
      };
    }

    return null;
  }

  function buildCurrentScreenSummaryResponse(context) {
    const checklist = buildScreenChecklist(context);
    const found = checklist.items.filter(function (item) { return item.done; }).slice(0, 5);
    const pending = checklist.items.filter(function (item) { return !item.done; }).slice(0, 5);
    const foundLines = found.length ? found.map(function (item) { return "✅ " + item.label; }) : ["⚠️ Não encontrei dados preenchidos visíveis."];
    const pendingLines = pending.length ? pending.map(function (item) { return "⚠️ " + item.label; }) : ["✅ Não encontrei pendências visíveis."];
    return {
      shortAnswer: "Resumo da tela atual.",
      fullAnswer: [
        "Você está em: " + context.screen,
        "",
        "Encontrei:",
        foundLines.join("\n"),
        "",
        "Pendências ou observações:",
        pendingLines.join("\n")
      ].join("\n"),
      nextAction: checklist.nextAction.replace(/^➡️\s*/, ""),
      canSave: false,
      sessionTheme: detectThemeFromScreen(context.screen),
      sessionIntent: "resumo_tela"
    };
  }

  function buildPdfReadinessResponse(context) {
    const checklist = buildScreenChecklist(context);
    const relevant = checklist.items.filter(function (item) {
      return hasAnyTerm(normalizeText(item.label), ["cliente", "obra", "relatorio", "relatório", "rdo", "fotos", "conclusao", "conclusão", "resumo", "botao", "botão"]);
    });
    const pending = (relevant.length ? relevant : checklist.items).filter(function (item) {
      return !item.done;
    });

    if (!pending.length && context.pdfAvailable) {
      return {
        shortAnswer: "✅ Pronto para gerar PDF.",
        fullAnswer: "Pelo que está visível, não encontrei pendências críticas antes do PDF.",
        nextAction: "Gere o PDF e revise o arquivo antes de entregar ao cliente.",
        canSave: false,
        sessionTheme: "pdf",
        sessionIntent: "revisao_pdf"
      };
    }

    return {
      shortAnswer: "⚠️ Ainda recomendo revisar antes do PDF.",
      fullAnswer: pending.length ? pending.map(function (item) {
        return "⚠️ " + item.label;
      }).join("\n") : "⚠️ Não encontrei o botão/etapa de PDF visível nesta tela.",
      nextAction: context.pdfAvailable ? "Revise os itens pendentes e então gere o PDF." : "Abra a etapa Gerar/Encerramento para confirmar o botão de PDF.",
      canSave: false,
      sessionTheme: "pdf",
      sessionIntent: "revisao_pdf"
    };
  }

  function buildVisibleSingleDataResponse(label, value, fallback, theme) {
    const hasValue = hasUsefulValue(value);
    return {
      shortAnswer: hasValue ? "✅ " + capitalizeFirst(label) + " visível: " + value : "⚠️ Não encontrei " + label + " visível nesta tela.",
      fullAnswer: hasValue ? "Estou lendo apenas o que aparece na tela atual." : fallback,
      nextAction: hasValue ? "Use essa informação para revisar o fluxo atual." : "Abra a seção correspondente ou confira se os dados foram preenchidos.",
      canSave: false,
      sessionTheme: theme,
      sessionIntent: "dados_visiveis"
    };
  }

  function buildVisibleCollectionResponse(label, value, count, emptyTerms, fallback, theme) {
    const hasValue = value && !isEmptyScreenText(value, emptyTerms || []);
    let shortAnswer = "⚠️ Não encontrei " + label + " visível nesta tela.";
    let fullAnswer = fallback || getMissingVisibleDataMessage();
    if (count > 0) {
      shortAnswer = "✅ Encontrei " + count + " item(ns) de " + label + " visíveis.";
      fullAnswer = value || "A contagem foi feita pelos itens visíveis da tela atual.";
    } else if (hasValue) {
      shortAnswer = "✅ Encontrei sinais de " + label + " na tela.";
      fullAnswer = "Encontrei informação visível, mas não consegui contar com segurança.\n\n" + value;
    }
    return {
      shortAnswer: shortAnswer,
      fullAnswer: fullAnswer,
      nextAction: hasValue || count > 0 ? "Revise os itens antes de salvar ou gerar PDF." : "Abra a seção correspondente ou confira se os dados foram preenchidos.",
      canSave: false,
      sessionTheme: theme,
      sessionIntent: "dados_visiveis"
    };
  }

  function detectThemeFromScreen(screenLabel) {
    const normalized = normalizeText(screenLabel || "");
    if (normalized.indexOf("diario") >= 0) {
      return "rdo";
    }
    if (normalized.indexOf("relatorio") >= 0) {
      return "relatorio";
    }
    if (normalized.indexOf("plano") >= 0) {
      return "planos";
    }
    if (normalized.indexOf("cliente") >= 0) {
      return "cliente";
    }
    return "relatorio";
  }

  function capitalizeFirst(text) {
    const value = String(text || "");
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
  }

  function buildOperationalPresenceResponse(label, value, emptyTerms, emptyNextAction) {
    const hasValue = value && !isEmptyScreenText(value, emptyTerms || []);
    return {
      shortAnswer: hasValue ? "Sim. Encontrei " + label + " na tela." : "Não encontrei " + label + " visível agora.",
      fullAnswer: hasValue ? "✅ " + value : getMissingVisibleDataMessage(),
      nextAction: hasValue ? "➡️ Revise essa informação antes de salvar ou gerar PDF." : emptyNextAction,
      canSave: false
    };
  }

  function buildOperationalChecklistResponse(context, intent) {
    const checklist = buildScreenChecklist(context);
    if (!checklist.items.length) {
      return {
        shortAnswer: "Não encontrei dados suficientes para revisar esta tela.",
        fullAnswer: getMissingVisibleDataMessage(),
        nextAction: "Abra a seção correspondente ou confira se os dados foram preenchidos.",
        canSave: false
      };
    }

    const found = checklist.items.filter(function (item) { return item.done; });
    const pending = checklist.items.filter(function (item) { return !item.done; });
    const foundLines = found.length ? found.map(function (item) {
      return "✅ " + item.label;
    }) : ["⚠️ Não encontrei itens preenchidos visíveis."];
    const pendingLines = pending.length ? pending.map(function (item) {
      return "⚠️ " + item.label;
    }) : ["✅ Não encontrei pendências visíveis."];
    let shortAnswer = "Revisei o que está visível.";
    if (intent.pdf) {
      shortAnswer = pending.length ? "Ainda recomendo revisar antes do PDF." : "Pelo que está visível, você pode avançar para o PDF.";
    } else if (intent.save) {
      shortAnswer = pending.length ? "Você pode salvar, mas há pontos para revisar." : "Pelo que está visível, está pronto para salvar.";
    } else if (intent.nextStep) {
      shortAnswer = "Próximo passo sugerido:";
    } else if (intent.missing) {
      shortAnswer = pending.length ? "Ainda há itens pendentes." : "Não encontrei pendências visíveis.";
    }

    return {
      shortAnswer: shortAnswer,
      fullAnswer: [
        "Você está em: " + context.screen,
        "",
        "Encontrei:",
        foundLines.join("\n"),
        "",
        "Pendências:",
        pendingLines.join("\n"),
        "",
        "➡️ Próximo passo recomendado:",
        checklist.nextAction
      ].join("\n"),
      nextAction: checklist.nextAction.replace(/^➡️\s*/, ""),
      canSave: false
    };
  }

  function buildScreenChecklist(context) {
    const label = context.screen;
    if (label === "Diário de Obras") {
      const items = [
        { label: "Data do RDO", done: hasUsefulValue(context.dailyDate) },
        { label: "Obra vinculada", done: hasUsefulValue(context.work) },
        { label: "Responsável preenchido", done: hasUsefulValue(context.dailyResponsible) },
        { label: "Equipe registrada", done: hasUsefulValue(context.team) },
        { label: "Serviços executados", done: hasUsefulValue(context.services) },
        { label: "Produção executada", done: hasUsefulValue(context.production) && !isEmptyScreenText(context.production, ["nenhuma producao"]) },
        { label: "Materiais consumidos", done: hasUsefulValue(context.materials) && !isEmptyScreenText(context.materials, ["nenhum material", "r$ 0,00"]) },
        { label: "Ocorrências/segurança revisadas", done: hasUsefulValue(context.occurrences) },
        { label: "Fotos anexadas", done: hasUsefulValue(context.photos) && !isEmptyScreenText(context.photos, ["nenhuma foto", "0 fotos"]) },
        { label: "Resumo preenchido", done: hasUsefulValue(context.summary) }
      ];
      return {
        items: items,
        nextAction: getFirstPendingAction(items, {
          "Produção executada": "➡️ Próximo passo: registre a produção executada antes de gerar o resumo.",
          "Materiais consumidos": "➡️ Próximo passo: lance os materiais consumidos para apoiar a auditoria.",
          "Resumo preenchido": "➡️ Próximo passo: gere ou escreva o resumo executivo antes do PDF.",
          "Fotos anexadas": "➡️ Próximo passo: adicione fotos se quiser uma entrega mais completa."
        }, "➡️ Próximo passo: salvar o diário e gerar o PDF do RDO.")
      };
    }

    if (label === "Relatórios") {
      const items = [
        { label: "Cliente selecionado", done: hasUsefulValue(context.client) },
        { label: "Obra vinculada", done: hasUsefulValue(context.work) || hasUsefulValue(context.reportWork) },
        { label: "Título/dados do relatório", done: hasUsefulValue(context.report) || hasUsefulValue(context.reportWork) },
        { label: "Fotos adicionadas", done: hasUsefulValue(context.photos) && !isEmptyScreenText(context.photos, ["0 fotos", "nenhuma foto"]) },
        { label: "Conclusão técnica", done: hasUsefulValue(context.conclusion) },
        { label: "Botão de PDF disponível", done: context.pdfAvailable }
      ];
      return {
        items: items,
        nextAction: getFirstPendingAction(items, {
          "Fotos adicionadas": "➡️ Próximo passo: adicione fotos antes de gerar o PDF para deixar o relatório mais completo.",
          "Conclusão técnica": "➡️ Próximo passo: revise ou gere a conclusão técnica.",
          "Botão de PDF disponível": "➡️ Próximo passo: avance até a etapa Gerar."
        }, "➡️ Próximo passo: gerar o PDF profissional.")
      };
    }

    if (label === "Planos") {
      const items = [
        { label: "Plano atual/uso visível", done: hasUsefulValue(context.usage) },
        { label: "Limites visíveis", done: hasUsefulValue(context.usage) || hasUsefulValue(context.plans) },
        { label: "Contratação assistida visível", done: hasUsefulValue(context.contracting) },
        { label: "WhatsApp/proposta disponível", done: hasUsefulValue(context.plans) && hasAnyTerm(normalizeText(context.plans), ["whatsapp", "solicitar", "contratar", "proposta"]) }
      ];
      return {
        items: items,
        nextAction: "➡️ Próximo passo: se quiser vender manualmente, use o botão de WhatsApp do plano desejado."
      };
    }

    if (label === "Dashboard" || label === "Home") {
      const items = [
        { label: "Clientes visíveis", done: hasMetricValue(context, "Clientes") },
        { label: "Obras visíveis", done: hasMetricValue(context, "Obras") },
        { label: "Relatórios visíveis", done: hasMetricValue(context, "Relatorios") },
        { label: "RDOs visíveis", done: hasMetricValue(context, "RDOs") },
        { label: "Fotos/PDFs visíveis", done: hasUsefulValue(context.indicators.join(" ")) },
        { label: "Ações rápidas disponíveis", done: hasUsefulValue(context.quickActions) }
      ];
      return {
        items: items,
        nextAction: "➡️ Próximo passo: escolha RDO, Relatório ou Obra Exemplo para testar o fluxo."
      };
    }

    if (label === "Página do Cliente") {
      const items = [
        { label: "Obra vinculada", done: hasUsefulValue(context.clientWorks) || hasMetricValue(context, "Obras cliente") },
        { label: "Último relatório visível", done: hasUsefulValue(context.clientReports) || hasMetricValue(context, "Relatorios cliente") },
        { label: "Último RDO visível", done: hasUsefulValue(context.clientRdos) || hasMetricValue(context, "RDOs cliente") },
        { label: "Documentos/PDFs visíveis", done: hasUsefulValue(context.clientDocs) || hasMetricValue(context, "PDFs cliente") },
        { label: "Suporte visível", done: hasUsefulValue(context.supportText) }
      ];
      return {
        items: items,
        nextAction: "➡️ Próximo passo: abra Minha obra, Meus relatórios ou Documentos para consultar o material disponível."
      };
    }

    return {
      items: [
        { label: "Contexto atual identificado", done: hasUsefulValue(context.screen) },
        { label: "Dados visíveis suficientes", done: hasUsefulValue(context.work) || hasUsefulValue(context.client) || hasUsefulValue(context.report) || context.indicators.length > 0 }
      ],
      nextAction: "➡️ Próximo passo: abra Relatórios, Diário de Obras, Dashboard ou Planos para uma revisão mais completa."
    };
  }

  function getFirstPendingAction(items, actionMap, fallback) {
    const pending = items.find(function (item) {
      return !item.done;
    });
    if (!pending) {
      return fallback;
    }
    return actionMap[pending.label] || "➡️ Próximo passo: preencher " + pending.label.toLowerCase() + ".";
  }

  function hasMetricValue(context, label) {
    const item = context.indicators.find(function (entry) {
      return normalizeText(entry).indexOf(normalizeText(label)) === 0;
    });
    if (!item) {
      return false;
    }
    return !/:\s*0$/.test(item);
  }

  function hasUsefulValue(value) {
    return !isEmptyScreenText(value || "", ["escolher", "cadastre", "nenhum", "nenhuma", "sem vinculo"]);
  }

  function getMissingVisibleDataMessage() {
    return "Não encontrei essa informação na tela atual. Abra a seção correspondente ou confira se os dados foram preenchidos.";
  }

  function getGuidedStepResponse(normalizedQuestion) {
    if (hasAnyTerm(normalizedQuestion, ["como gerar pdf", "gerar pdf", "criar pdf", "baixar pdf", "exportar pdf"])) {
      return buildStepResponse(
        "Para gerar um PDF:",
        [
          "Abra o relatório ou o Diário de Obras desejado.",
          "Confira cliente, obra, fotos, produção, materiais e conclusão.",
          "Clique em Gerar PDF ou Gerar PDF do Diário.",
          "Aguarde a visualização ou janela de impressão do navegador.",
          "Salve o arquivo ou envie ao cliente pelo fluxo de compartilhamento."
        ],
        "Se a janela não abrir, verifique se o navegador bloqueou pop-ups.",
        "Quer que eu explique também como enviar o resumo por WhatsApp?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como criar relatorio", "criar relatorio", "novo relatorio", "fazer relatorio"])) {
      return buildStepResponse(
        "Para criar um relatório técnico:",
        [
          "Cadastre ou selecione um cliente.",
          "Cadastre ou selecione a obra vinculada.",
          "Abra Relatórios e preencha o nome do relatório.",
          "Adicione fotos, ocorrências, análise técnica e conclusão.",
          "Revise o conteúdo e gere o PDF profissional."
        ],
        "O relatório precisa estar vinculado a uma obra para ficar organizado corretamente.",
        "Se quiser testar rápido, use a Obra Exemplo."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como criar rdo", "criar rdo", "novo rdo", "fazer rdo", "diario de obra", "diario de obras"])) {
      return buildStepResponse(
        "Para criar um RDO:",
        [
          "Abra Diário de Obras.",
          "Selecione a obra vinculada.",
          "Preencha data, responsável, clima, equipe e serviços.",
          "Registre produção executada, materiais, ocorrências e fotos.",
          "Salve o diário e gere o PDF do Diário se precisar entregar."
        ],
        "O RDO funciona melhor quando produção e materiais são preenchidos no mesmo registro.",
        "Quer que eu explique como lançar materiais no RDO?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como adicionar materiais", "como adiciono materiais", "adicionar material", "registrar materiais", "lancar materiais", "lançar materiais"])) {
      return buildStepResponse(
        "Para adicionar materiais:",
        [
          "Abra Diário de Obras.",
          "Vá até a seção Materiais.",
          "Informe material, quantidade, unidade, valor unitário e observação.",
          "Clique em Adicionar material.",
          "Confira o resumo e o total de materiais consumidos."
        ],
        "Se você também registrar Produção Executada, o ObraReport ajuda na auditoria de consumo.",
        "Depois disso, pergunte: como funciona auditoria de consumo?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como enviar whatsapp", "enviar whatsapp", "resumo por whatsapp", "whatsapp"])) {
      return buildStepResponse(
        "Para enviar por WhatsApp:",
        [
          "Abra o RDO ou relatório que deseja compartilhar.",
          "Confira obra, cliente, produção, materiais e ocorrências.",
          "Clique no botão de WhatsApp.",
          "Revise a mensagem pronta antes de enviar.",
          "Envie pelo WhatsApp Web ou aplicativo do dispositivo."
        ],
        "O ObraReport abre uma mensagem preenchida. Não há API oficial de WhatsApp integrada nesta versão.",
        "Quer que eu explique também o envio por e-mail preenchido?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como funciona auditoria", "como audito", "audito", "auditar", "auditoria de consumo", "usar auditoria", "auditoria materiais"])) {
      return buildStepResponse(
        "A auditoria de consumo funciona assim:",
        [
          "Registre a Produção Executada no RDO.",
          "Cadastre ou use composições de materiais.",
          "Lance os materiais realmente consumidos.",
          "Clique para calcular materiais estimados, quando disponível.",
          "Compare estimado, registrado e diferença na auditoria."
        ],
        "Ela é uma conferência operacional simples, não substitui orçamento técnico completo ou medição formal.",
        "Para testar, carregue a Obra Exemplo e abra Diário de Obras."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["plano profissional", "como funciona o plano profissional"])) {
      return buildStepResponse(
        "O plano Profissional é indicado para uso individual ou equipe pequena:",
        [
          "Você usa o ObraReport para clientes, obras, relatórios e RDOs.",
          "Gera PDFs profissionais para entrega.",
          "Usa materiais, produção executada e apoio do Elo.",
          "Solicita acesso pelo WhatsApp.",
          "A ativação é assistida nesta fase inicial."
        ],
        "Não existe checkout automático ativo nesta fase.",
        "Abra Planos para confirmar limites e solicitar acesso."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["plano empresa", "como funciona o plano empresa"])) {
      return buildStepResponse(
        "O plano Empresa é indicado para construtoras, escritórios e equipes:",
        [
          "Organiza múltiplas obras e usuários.",
          "Centraliza relatórios, RDOs e materiais.",
          "Apoia auditoria de consumo e histórico técnico.",
          "Inclui suporte prioritário e implantação assistida.",
          "A contratação começa por proposta via WhatsApp."
        ],
        "A ativação é assistida para configurar o primeiro acesso corretamente.",
        "Abra Planos e use Solicitar proposta."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como ver minha obra", "ver minha obra", "onde vejo obra", "abrir obra"])) {
      return buildStepResponse(
        "Para ver sua obra:",
        [
          "Abra o menu Obras para consultar obras cadastradas.",
          "No Dashboard, confira o card de obras em andamento.",
          "Em Relatórios ou Diário de Obras, selecione a obra vinculada.",
          "Use a Obra Exemplo se quiser testar sem dados reais.",
          "Se a obra não aparecer, verifique se ela foi cadastrada no cliente correto."
        ],
        "O Elo também consegue ler a obra selecionada quando ela está visível na tela.",
        "Pergunte: qual obra estou vendo?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como salvar", "sincronizar", "salvar dados", "salvamento", "sincronizacao", "sincronização"])) {
      return buildStepResponse(
        "Sobre salvar e sincronizar:",
        [
          "Preencha os dados da tela atual.",
          "Use o botão Salvar quando ele aparecer no formulário.",
          "Aguarde o status de salvamento/local da tela.",
          "Confira se o item aparece na lista ou histórico.",
          "Evite limpar o navegador se estiver usando dados locais."
        ],
        "Algumas informações do Elo ficam apenas neste navegador. Exporte backup do Elo quando quiser preservar memórias, biblioteca, projetos e objetivos.",
        "Se algo não salvar, pergunte: não consigo salvar."
      );
    }

    return null;
  }

  function getDiagnosticStepResponse(normalizedQuestion) {
    if (hasAnyTerm(normalizedQuestion, ["pdf nao gerou", "pdf não gerou", "pdf nao abre", "pdf não abre", "erro no pdf"])) {
      return buildStepResponse(
        "Se o PDF não gerou:",
        [
          "Verifique se há cliente e obra selecionados.",
          "Confira se o relatório ou RDO possui conteúdo preenchido.",
          "Libere pop-ups ou janelas novas no navegador.",
          "Tente gerar novamente.",
          "Se persistir, entre em contato pelo suporte."
        ],
        "A falha ao abrir o PDF normalmente não apaga o conteúdo preenchido.",
        "Quer que eu explique o fluxo correto para gerar PDF?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["nao consigo salvar", "não consigo salvar", "erro ao salvar", "nao salvou", "não salvou"])) {
      return buildStepResponse(
        "Se não conseguiu salvar:",
        [
          "Confira se os campos obrigatórios estão preenchidos.",
          "Verifique se cliente e obra foram selecionados.",
          "Observe a mensagem de status da tela.",
          "Tente salvar novamente sem recarregar a página.",
          "Se o problema continuar, copie as informações importantes antes de fechar."
        ],
        "Eu não altero seus dados; apenas oriento com base na tela atual.",
        "Pergunte qual obra ou RDO estou vendo para conferir o contexto."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["foto nao aparece", "foto não aparece", "foto sumiu", "imagem nao aparece", "imagem não aparece"])) {
      return buildStepResponse(
        "Se a foto não aparece:",
        [
          "Confirme se o arquivo é JPEG, PNG ou WebP.",
          "Veja se a foto foi adicionada depois da seleção.",
          "Confira se está na etapa correta de Fotos.",
          "Evite arquivos muito pesados.",
          "Tente adicionar novamente e salvar o relatório ou RDO."
        ],
        "Fotos locais dependem do navegador enquanto o registro está sendo preparado.",
        "Quer que eu explique como adicionar fotos?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["rdo sumiu", "diario sumiu", "não acho o rdo", "nao acho o rdo", "rdo nao aparece"])) {
      return buildStepResponse(
        "Se o RDO não aparece:",
        [
          "Abra Diário de Obras.",
          "Confira se a obra correta está selecionada.",
          "Veja a lista Registros do Diário.",
          "Limpe o campo de busca de produção, se estiver preenchido.",
          "Se usou outro navegador/dispositivo, o dado local pode não estar disponível ali."
        ],
        "Nesta fase, alguns dados podem depender do armazenamento local do navegador.",
        "Pergunte: qual RDO estou vendo?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["whatsapp nao abriu", "whatsapp não abriu", "erro whatsapp", "whatsapp nao funciona"])) {
      return buildStepResponse(
        "Se o WhatsApp não abriu:",
        [
          "Confira se o navegador permitiu abrir nova aba.",
          "Verifique se há WhatsApp Web ou aplicativo configurado.",
          "Revise se o RDO possui informações para montar a mensagem.",
          "Tente clicar novamente no botão de WhatsApp.",
          "Se necessário, copie o resumo manualmente."
        ],
        "O ObraReport usa abertura de mensagem pronta, não API oficial do WhatsApp.",
        "Quer que eu explique o envio por WhatsApp?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["plano nao mudou", "plano não mudou", "upgrade nao mudou", "upgrade não mudou", "plano nao atualizou"])) {
      return buildStepResponse(
        "Se o plano não mudou:",
        [
          "Abra a tela Planos.",
          "Confira o plano e o uso atual exibidos.",
          "Lembre que a ativação é assistida nesta fase.",
          "Fale pelo WhatsApp para solicitar ajuste de acesso.",
          "Aguarde confirmação antes de considerar o plano ativo."
        ],
        "Não há checkout automático integrado nesta versão.",
        "Abra Planos e use o botão de contratação assistida."
      );
    }

    return null;
  }

  function buildStepResponse(shortAnswer, steps, note, nextAction) {
    return {
      shortAnswer: shortAnswer,
      fullAnswer: steps.map(function (step, index) {
        return (index + 1) + ". " + step;
      }).join("\n") + (note ? "\n\nObservação: " + note : ""),
      nextAction: nextAction,
      canSave: true
    };
  }

  function getGreetingResponse(normalizedQuestion) {
    const greetings = ["bom dia", "boa tarde", "boa noite", "ola", "oi"];
    const match = greetings.find(function (item) {
      return normalizedQuestion === item || normalizedQuestion.indexOf(item + " ") === 0;
    });

    if (!match) {
      return null;
    }

    const label = match === "ola" ? "Olá" : match.charAt(0).toUpperCase() + match.slice(1);
    return {
      shortAnswer: label + ", Ícaro.",
      fullAnswer: label + ", Ícaro. Ainda não estou conectado à previsão do tempo real, mas em breve poderei consultar a internet, ver sua agenda e lembrar suas prioridades do dia.",
      nextAction: "Por enquanto, posso ajudar você a usar relatórios, PDF, RDO, materiais e planos do ObraReport.",
      canSave: false
    };
  }

  function getContextualHelpResponse(normalizedQuestion) {
    const genericQuestions = [
      "como funciona",
      "me ajuda",
      "ajuda",
      "o que faco",
      "o que faço",
      "por onde comeco",
      "por onde começo"
    ];
    const isGeneric = genericQuestions.some(function (item) {
      const normalizedItem = normalizeText(item);
      return normalizedQuestion === normalizedItem || normalizedQuestion.indexOf(normalizedItem) === 0;
    });

    if (!isGeneric) {
      return null;
    }

    const context = getCurrentScreenContext();
    const answers = {
      "Planos": {
        shortAnswer: "Você está em Planos.",
        fullAnswer: [
          "1. Compare Gratuito, Profissional e Empresa.",
          "2. Veja os limites e o uso atual.",
          "3. Escolha o plano adequado ao volume de obras e relatórios.",
          "4. Use o WhatsApp para contratação assistida.",
          "5. Aguarde ativação orientada pela equipe."
        ].join("\n"),
        nextAction: "Pergunte: como funciona o plano Profissional? ou como funciona o plano Empresa?",
        canSave: false
      },
      "Diário de Obras": {
        shortAnswer: "Você está no Diário de Obras.",
        fullAnswer: [
          "1. Selecione a obra vinculada.",
          "2. Preencha data, responsável, clima, equipe e serviços.",
          "3. Lance produção executada e materiais consumidos.",
          "4. Registre ocorrências, segurança e fotos.",
          "5. Salve o diário e gere o PDF quando estiver pronto."
        ].join("\n"),
        nextAction: "Pergunte: como adicionar materiais? ou como gerar PDF?",
        canSave: false
      },
      "Relatórios": {
        shortAnswer: "Você está em Relatórios.",
        fullAnswer: [
          "1. Escolha cliente e obra.",
          "2. Crie ou abra o relatório técnico.",
          "3. Adicione fotos, ocorrências e análise.",
          "4. Revise a conclusão e os dados principais.",
          "5. Gere o PDF profissional para entrega."
        ].join("\n"),
        nextAction: "Pergunte: como criar relatório? ou como gerar PDF?",
        canSave: false
      },
      "Clientes": {
        shortAnswer: "Você está em Clientes.",
        fullAnswer: "Aqui eu priorizo cadastro de cliente e organização dos vínculos com obras, relatórios e RDOs.",
        nextAction: "Pergunte: como cadastrar cliente?",
        canSave: false
      },
      "Obras": {
        shortAnswer: "Você está em Obras.",
        fullAnswer: "Aqui eu priorizo cadastro de obra, vínculo com cliente e organização dos documentos técnicos.",
        nextAction: "Pergunte: como cadastrar obra?",
        canSave: false
      },
      "Administração": {
        shortAnswer: "Você está em Administração.",
        fullAnswer: "Aqui eu priorizo visão geral de uso, limites, planos e suporte operacional.",
        nextAction: "Pergunte sobre limites, planos ou suporte.",
        canSave: false
      }
    };

    return answers[context.label] || {
      shortAnswer: "Você está no " + context.label + ".",
      fullAnswer: "Posso orientar o próximo passo com base nesta tela do ObraReport.",
      nextAction: "Pergunte sobre PDF, RDO, materiais, relatórios ou planos.",
      canSave: false
    };
  }

  function getCurrentScreenContext() {
    const route = String(window.location.hash || "").replace("#app/", "").split("/")[0];
    const contexts = {
      dashboard: {
        label: "Dashboard",
        categories: ["primeiros_passos", "relatorios", "rdo", "materiais", "planos"]
      },
      clientes: {
        label: "Clientes",
        categories: ["clientes", "obras", "primeiros_passos"]
      },
      obras: {
        label: "Obras",
        categories: ["obras", "clientes", "relatorios", "rdo"]
      },
      relatorios: {
        label: "Relatórios",
        categories: ["relatorios", "fotos", "pdf", "ia"]
      },
      diario: {
        label: "Diário de Obras",
        categories: ["rdo", "materiais", "pdf", "ia"]
      },
      planos: {
        label: "Planos",
        categories: ["planos", "limites", "suporte"]
      },
      administracao: {
        label: "Administração",
        categories: ["planos", "limites", "suporte"]
      },
      cliente: {
        label: "Página do Cliente",
        categories: ["clientes", "obras", "relatorios", "rdo", "pdf", "suporte"]
      },
      "minha-obra": {
        label: "Página do Cliente",
        categories: ["clientes", "obras", "relatorios", "rdo"]
      },
      "meus-relatorios": {
        label: "Página do Cliente",
        categories: ["relatorios", "pdf", "suporte"]
      },
      "meus-rdos": {
        label: "Página do Cliente",
        categories: ["rdo", "pdf", "suporte"]
      },
      documentos: {
        label: "Página do Cliente",
        categories: ["pdf", "relatorios", "rdo"]
      },
      suporte: {
        label: "Página do Cliente",
        categories: ["suporte", "clientes"]
      }
    };

    return contexts[route] || {
      label: "Home",
      categories: ["primeiros_passos", "relatorios", "rdo", "pdf"]
    };
  }

  function answerScreenDataQuestion(question, normalizedQuestion) {
    const context = getOperationalScreenContext();
    const wantsWork = hasAnyTerm(normalizedQuestion, ["qual obra", "obra atual", "obra estou vendo", "obra vinculada"]);
    const wantsClient = hasAnyTerm(normalizedQuestion, ["qual cliente", "cliente atual", "cliente estou vendo"]);
    const wantsReport = hasAnyTerm(normalizedQuestion, ["qual relatorio", "relatorio atual", "ultimo relatorio", "ultima relatorio"]);
    const wantsDiary = hasAnyTerm(normalizedQuestion, ["qual rdo", "rdo atual", "diario atual", "diario estou vendo"]);
    const wantsMaterials = hasAnyTerm(normalizedQuestion, ["existe material", "tem material", "material registrado", "materiais registrados", "materiais visiveis"]);
    const wantsProduction = hasAnyTerm(normalizedQuestion, ["tenho producao", "existe producao", "producao lancada", "producao executada", "tem producao"]);
    const wantsIndicators = hasAnyTerm(normalizedQuestion, ["indicadores", "metricas", "numeros", "status da tela"]);

    if (wantsWork) {
      return buildScreenDataResponse(
        context.work ? "A obra visivel agora e " + context.work + "." : "Nao identifiquei uma obra selecionada nesta tela.",
        context.work ? "Estou lendo a obra selecionada ou exibida na tela atual do ObraReport." : "Se voce estiver no RDO ou em Relatorios, selecione uma obra para eu conseguir ler esse contexto.",
        context.work ? "Continue o registro nessa obra ou pergunte sobre materiais, producao ou PDF." : "Selecione uma obra ou carregue a Obra Exemplo."
      );
    }

    if (wantsClient) {
      return buildScreenDataResponse(
        context.client ? "O cliente visivel agora e " + context.client + "." : "Nao identifiquei um cliente selecionado nesta tela.",
        context.client ? "Estou lendo o cliente selecionado ou exibido no formulario/lista atual." : "Em Relatorios ou Obras, selecione um cliente para eu conseguir informar com seguranca.",
        context.client ? "Voce pode continuar cadastrando obra, relatorio ou RDO para esse cliente." : "Abra Clientes, Obras ou Relatorios e selecione um cliente."
      );
    }

    if (wantsReport) {
      return buildScreenDataResponse(
        context.report ? "O relatorio visivel mais relevante e " + context.report + "." : "Nao encontrei relatorio visivel nesta tela.",
        context.report ? "Eu li o relatorio ativo, o titulo preenchido ou o primeiro item do historico visivel." : "Se houver relatorios salvos, abra Relatorios ou o Dashboard para eu ler o historico visivel.",
        context.report ? "Abra o relatorio ou gere o PDF se quiser revisar a entrega." : "Crie ou carregue um relatorio para eu acompanhar."
      );
    }

    if (wantsDiary) {
      return buildScreenDataResponse(
        context.diary ? "O RDO visivel agora e " + context.diary + "." : "Nao encontrei um RDO salvo visivel nesta tela.",
        context.diary ? "Estou lendo o formulario do Diario de Obras e a lista de registros visiveis." : "No Diario, preencha ou selecione um registro para eu conseguir contextualizar melhor.",
        context.diary ? "Revise producao, materiais e encerramento antes de gerar o PDF do diario." : "Comece um novo Diario de Obras ou carregue a Obra Exemplo."
      );
    }

    if (wantsMaterials) {
      const hasMaterials = context.materials && !isEmptyScreenText(context.materials, ["nenhum material registrado", "nenhum consumo registrado"]);
      return buildScreenDataResponse(
        hasMaterials ? "Sim. Existe material registrado ou consumo visivel na tela." : "Nao vejo material registrado nesta tela agora.",
        hasMaterials ? context.materials : "A area de materiais esta vazia ou ainda nao foi aberta/preenchida.",
        hasMaterials ? "Revise a auditoria de consumo e gere o PDF quando estiver pronto." : "Adicione um material no RDO ou carregue a Obra Exemplo para testar."
      );
    }

    if (wantsProduction) {
      const hasProduction = context.production && !isEmptyScreenText(context.production, ["nenhuma producao registrada", "nenhuma producao executada registrada"]);
      return buildScreenDataResponse(
        hasProduction ? "Sim. Existe producao executada visivel na tela." : "Nao vejo producao executada lancada nesta tela agora.",
        hasProduction ? context.production : "A area de Producao Executada esta vazia ou ainda nao foi preenchida.",
        hasProduction ? "Voce pode calcular materiais estimados e revisar a auditoria de consumo." : "Adicione um servico em Producao Executada para iniciar o controle."
      );
    }

    if (wantsIndicators) {
      return buildScreenDataResponse(
        context.indicators.length ? "Encontrei indicadores visiveis nesta tela." : "Nao encontrei indicadores visiveis nesta tela.",
        context.indicators.length ? context.indicators.join("\n") : "Os indicadores aparecem principalmente no Dashboard, Diario de Obras e Administracao.",
        context.indicators.length ? "Use esses numeros para revisar andamento, relatorios, fotos, PDFs, materiais ou RDOs." : "Abra o Dashboard ou o Diario para ver metricas."
      );
    }

    return null;
  }

  function buildScreenDataResponse(shortAnswer, fullAnswer, nextAction) {
    return {
      shortAnswer: shortAnswer,
      fullAnswer: fullAnswer,
      nextAction: nextAction,
      canSave: false
    };
  }

  function getOperationalScreenContext() {
    const screen = getCurrentScreenContext();
    const reportTitle = getInputValue("[name='reportTitle']");
    const currentReport = getVisibleText("#currentReportLabel");
    const recentReport = getFirstVisibleListText("#recentReportsList, #reportsList");
    const dailyDate = getInputValue("#dailyLogForm [name='date']");
    const dailyResponsible = getInputValue("#dailyLogForm [name='responsible']");
    const dailyStatus = getVisibleText("#dailyLogStatus");
    const reportPhotoCount = getVisibleText("#fotoCount");
    const dailyPhotoText = getVisibleText("#dailyLogPhotosList");
    const dailyPhotoInput = getFileInputSummary("#dailyLogPhotoInput");
    const reportConclusion = getInputValue("#qualityReportForm [name='conclusaoTecnica']");
    const dailySummary = getInputValue("#dailyLogForm [name='summary']");
    const safetyOccurrence = getSelectedOptionText("#dailyLogForm [name='safetyOccurrence']");
    const occurrenceText = firstUsefulText([
      getInputValue("#dailyLogForm [name='occurrences']"),
      getInputValue("#dailyLogForm [name='safetyDescription']"),
      safetyOccurrence
    ], ["nenhuma ocorrencia", "nenhuma ocorrência"]);

    return {
      screen: screen.label,
      work: firstUsefulText([
        getSelectedOptionText("#dailyLogWorkSelect"),
        getSelectedOptionText("#reportWorkSelect"),
        getInputValue("#qualityReportForm [name='obra']"),
        getInputValue("#workForm [name='workName']"),
        getFirstVisibleListText("#worksList")
      ], ["escolher", "cadastre", "nenhuma obra"]),
      reportWork: firstUsefulText([
        getInputValue("#qualityReportForm [name='obra']"),
        getInputValue("#qualityReportForm [name='local']")
      ], ["escolher", "cadastre"]),
      client: firstUsefulText([
        getSelectedOptionText("#reportClientSelect"),
        getSelectedOptionText("#workClientSelect"),
        getInputValue("#clientForm [name='clientName']"),
        getFirstVisibleListText("#clientsList")
      ], ["escolher", "cadastre", "nenhum cliente"]),
      report: firstUsefulText([
        currentReport,
        reportTitle,
        recentReport
      ], ["sem vinculo", "nenhum relatorio"]),
      diary: firstUsefulText([
        dailyDate && dailyResponsible ? "Diario de " + dailyDate + " registrado por " + dailyResponsible : "",
        dailyDate ? "Diario de " + dailyDate : "",
        getFirstVisibleListText("#dailyLogRecordsList"),
        dailyStatus
      ], ["nenhum diario", "diarios salvos"]),
      dailyDate: dailyDate,
      dailyResponsible: dailyResponsible,
      team: firstUsefulText([
        getInputValue("#dailyLogForm [name='teamPresent']"),
        getInputValue("#dailyLogForm [name='employeeCount']")
      ], []),
      services: getInputValue("#dailyLogForm [name='services']"),
      materials: firstUsefulText([
        getVisibleText("#dailyLogMaterialSummary"),
        getVisibleText("#dailyLogMaterialsList"),
        getVisibleText("#dailyLogAuditPanel"),
        getVisibleText("#dailyLogMaterialTotal")
      ], []),
      materialCount: getVisibleItemCount("#dailyLogMaterialsList"),
      production: firstUsefulText([
        getVisibleText("#dailyLogProductionSummary"),
        getVisibleText("#dailyLogProductionsList")
      ], []),
      productionCount: getVisibleItemCount("#dailyLogProductionsList"),
      photos: firstUsefulText([
        dailyPhotoText,
        dailyPhotoInput,
        reportPhotoCount ? reportPhotoCount + " fotos" : "",
        getVisibleText("#fotosUnidade")
      ], []),
      photoCount: getVisibleItemCount("#dailyLogPhotosList") || parseVisibleNumber(reportPhotoCount) || getVisibleItemCount("#fotosUnidade"),
      occurrences: occurrenceText,
      summary: dailySummary,
      conclusion: reportConclusion,
      pdfAvailable: Boolean(
        isSelectorVisible("#dailyLogPdfButton") ||
        isSelectorVisible("#submitButton") ||
        isSelectorVisible("[data-diary-action='generate-pdf']")
      ),
      plans: getVisibleText("#plansGrid"),
      usage: getVisibleText("#usageSummary"),
      contracting: getVisibleText(".auth-note"),
      quickActions: getVisibleText(".quick-actions-grid"),
      clientWorks: firstUsefulText([
        getVisibleText("#clientPortalWorksList"),
        getVisibleText("#clientPortalRecentDocs")
      ], ["nenhuma obra", "nenhum documento"]),
      clientReports: firstUsefulText([
        getVisibleText("#clientPortalReportsList"),
        getVisibleText("#clientPortalRecentDocs")
      ], ["nenhum relatorio", "nenhum relatório", "nenhum documento"]),
      clientRdos: getVisibleText("#clientPortalRdosList"),
      clientDocs: firstUsefulText([
        getVisibleText("#clientPortalDocumentsList"),
        getVisibleText("#clientPortalRecentDocs")
      ], ["nenhum pdf", "nenhum documento"]),
      supportText: getVisibleText("[data-route='suporte']"),
      indicators: collectVisibleIndicators()
    };
  }

  function collectVisibleIndicators() {
    const pairs = [
      ["Clientes", "#clientMetric"],
      ["Obras", "#workMetric"],
      ["Relatorios", "#reportMetric"],
      ["Fotos", "#photoMetric"],
      ["PDFs", "#pdfMetric"],
      ["Usuarios", "#adminUsersMetric"],
      ["Clientes admin", "#adminClientsMetric"],
      ["Obras admin", "#adminWorksMetric"],
      ["Relatorios admin", "#adminReportsMetric"],
      ["RDOs admin", "#adminRdosMetric"],
      ["Obras cliente", "#clientPortalWorkMetric"],
      ["Relatorios cliente", "#clientPortalReportMetric"],
      ["RDOs cliente", "#clientPortalRdoMetric"],
      ["PDFs cliente", "#clientPortalPdfMetric"]
    ];
    const indicators = pairs.reduce(function (items, pair) {
      const el = document.querySelector(pair[1]);
      if (el && isElementVisible(el)) {
        items.push(pair[0] + ": " + cleanScreenText(el.textContent));
      }
      return items;
    }, []);
    const diaryIndicators = document.querySelector("#dailyLogIndicators");
    if (diaryIndicators && isElementVisible(diaryIndicators)) {
      const text = cleanScreenText(diaryIndicators.textContent);
      if (text) {
        indicators.push("Diario: " + text);
      }
    }
    return indicators.slice(0, 10);
  }

  function hasAnyTerm(normalizedQuestion, terms) {
    return terms.some(function (term) {
      return normalizedQuestion.indexOf(normalizeText(term)) >= 0;
    });
  }

  function getInputValue(selector) {
    const el = document.querySelector(selector);
    if (!el || !isElementVisible(el)) {
      return "";
    }
    return cleanScreenText(el.value || "");
  }

  function getSelectedOptionText(selector) {
    const el = document.querySelector(selector);
    if (!el || !isElementVisible(el) || el.selectedIndex < 0) {
      return "";
    }
    return cleanScreenText(el.options[el.selectedIndex].textContent || "");
  }

  function getVisibleText(selector) {
    const el = document.querySelector(selector);
    if (!el || !isElementVisible(el)) {
      return "";
    }
    return cleanScreenText(el.textContent || "");
  }

  function getFirstVisibleListText(selector) {
    const list = document.querySelector(selector);
    if (!list || !isElementVisible(list)) {
      return "";
    }
    const firstChild = Array.prototype.find.call(list.children || [], function (child) {
      return isElementVisible(child) && cleanScreenText(child.textContent || "");
    });
    return cleanScreenText((firstChild || list).textContent || "");
  }

  function getVisibleItemCount(selector) {
    const list = document.querySelector(selector);
    if (!list || !isElementVisible(list) || list.classList.contains("empty-list")) {
      return 0;
    }
    return Array.prototype.filter.call(list.children || [], function (child) {
      return isElementVisible(child) && cleanScreenText(child.textContent || "");
    }).length;
  }

  function parseVisibleNumber(text) {
    const match = String(text || "").match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function getFileInputSummary(selector) {
    const el = document.querySelector(selector);
    if (!el || !isElementVisible(el) || !el.files || !el.files.length) {
      return "";
    }
    return String(el.files.length) + " arquivo(s) selecionado(s)";
  }

  function isSelectorVisible(selector) {
    const el = document.querySelector(selector);
    return Boolean(el && isElementVisible(el));
  }

  function firstUsefulText(values, ignoredTerms) {
    const ignored = ignoredTerms || [];
    for (let index = 0; index < values.length; index += 1) {
      const text = cleanScreenText(values[index] || "");
      if (text && !isEmptyScreenText(text, ignored)) {
        return text;
      }
    }
    return "";
  }

  function isEmptyScreenText(text, ignoredTerms) {
    const normalized = normalizeText(text || "");
    if (!normalized) {
      return true;
    }
    return (ignoredTerms || []).some(function (term) {
      return normalized.indexOf(normalizeText(term)) >= 0;
    });
  }

  function cleanScreenText(text) {
    return sanitizeUserText(String(text || "").replace(/\s+/g, " ").trim()).slice(0, 420);
  }

  function isElementVisible(el) {
    if (!el) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function searchKnowledgeBase(normalizedQuestion) {
    let bestItem = null;
    let bestScore = 0;
    const context = getCurrentScreenContext();

    ELO_KNOWLEDGE_BASE.forEach(function (item) {
      let score = 0;
      if (context.categories.indexOf(item.category) >= 0) {
        score += 3;
      }
      item.keywords.forEach(function (keyword) {
        const normalizedKeyword = normalizeText(keyword);
        if (normalizedQuestion.indexOf(normalizedKeyword) >= 0) {
          score += normalizedKeyword.length > 8 ? 4 : 2;
        }
        normalizedKeyword.split(" ").forEach(function (part) {
          if (part.length > 3 && normalizedQuestion.indexOf(part) >= 0) {
            score += 1;
          }
        });
      });
      if (normalizeText(item.title).indexOf(normalizedQuestion) >= 0) {
        score += 4;
      }
      if (context.categories.indexOf(item.category) < 0 && score <= 3) {
        score = 0;
      }
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    });

    return bestScore > 3 ? bestItem : null;
  }

  function formatResponse(response) {
    return [
      response.shortAnswer,
      "",
      response.fullAnswer,
      "",
      "Próxima ação: " + response.nextAction
    ].join("\n");
  }

  // ELO_UI
  const ELO_UI = {
    root: null,
    panel: null,
    messages: null,
    input: null,
    contextLabel: null,
    suggestions: null
  };

  function buildWidget() {
    ELO_UI.root = createElement("aside", "elo-widget");
    ELO_UI.root.setAttribute("aria-label", "Elo Assistente ObraReport");

    const floatButton = createElement("button", "elo-float-button");
    floatButton.type = "button";
    floatButton.setAttribute("aria-expanded", "false");
    floatButton.appendChild(createElement("span", "elo-float-icon", "E"));
    floatButton.appendChild(createElement("span", "", "Elo"));

    ELO_UI.panel = createElement("section", "elo-panel is-hidden");
    ELO_UI.panel.setAttribute("aria-label", "Elo — Assistente ObraReport");

    const header = createElement("header", "elo-header");
    const headerText = createElement("div");
    headerText.appendChild(createElement("h2", "", "Elo — Assistente ObraReport"));
    headerText.appendChild(createElement("p", "", "Eu lembro, procuro e te ajudo a usar o ObraReport."));
    ELO_UI.contextLabel = createElement("p", "elo-context-label");
    headerText.appendChild(ELO_UI.contextLabel);
    const closeButton = createElement("button", "elo-close-button", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Fechar Elo");
    header.appendChild(headerText);
    header.appendChild(closeButton);

    ELO_UI.messages = createElement("div", "elo-messages");
    ELO_UI.suggestions = createElement("div", "elo-context-suggestions");

    const footer = createElement("footer", "elo-footer");

    const inputRow = createElement("form", "elo-input-row");
    ELO_UI.input = createElement("input", "elo-input");
    ELO_UI.input.type = "text";
    ELO_UI.input.maxLength = 220;
    ELO_UI.input.placeholder = "Pergunte ao Elo";
    const sendButton = createElement("button", "elo-send-button", "Enviar");
    sendButton.type = "submit";
    inputRow.appendChild(ELO_UI.input);
    inputRow.appendChild(sendButton);

    footer.appendChild(inputRow);
    footer.appendChild(buildTools());

    ELO_UI.panel.appendChild(header);
    ELO_UI.panel.appendChild(ELO_UI.messages);
    ELO_UI.panel.appendChild(ELO_UI.suggestions);
    ELO_UI.panel.appendChild(footer);
    ELO_UI.root.appendChild(floatButton);
    ELO_UI.root.appendChild(ELO_UI.panel);
    document.body.appendChild(ELO_UI.root);

    floatButton.addEventListener("click", function () {
      setPanelOpen(ELO_UI.panel.classList.contains("is-hidden"));
    });
    closeButton.addEventListener("click", function () {
      setPanelOpen(false);
    });
    inputRow.addEventListener("submit", function (event) {
      event.preventDefault();
      askElo(ELO_UI.input.value);
      ELO_UI.input.value = "";
    });
    window.addEventListener("hashchange", updateScreenContext);

    updateScreenContext();
    appendMessage("system", "Olá, eu sou o Elo. Posso ajudar com relatórios, PDF, RDO, fotos, materiais e planos.");
    setPanelOpen(false);
  }

  function updateScreenContext() {
    if (!ELO_UI.contextLabel) {
      return;
    }

    const context = getCurrentScreenContext();
    ELO_UI.contextLabel.textContent = "Contexto atual: " + context.label;
    renderContextSuggestions(context);
  }

  function renderContextSuggestions(context) {
    if (!ELO_UI.suggestions) {
      return;
    }

    ELO_UI.suggestions.innerHTML = "";
    const suggestions = getContextSuggestions(context).slice(0, 5);
    if (!suggestions.length) {
      ELO_UI.suggestions.classList.add("is-hidden");
      return;
    }

    ELO_UI.suggestions.classList.remove("is-hidden");
    ELO_UI.suggestions.appendChild(createElement("span", "elo-suggestions-label", "Sugestões nesta tela"));
    const list = createElement("div", "elo-suggestion-chips");
    suggestions.forEach(function (item) {
      const button = createElement("button", "elo-suggestion-chip", item.label);
      button.type = "button";
      button.addEventListener("click", function () {
        askElo(item.question);
      });
      list.appendChild(button);
    });
    ELO_UI.suggestions.appendChild(list);
  }

  function getContextSuggestions(context) {
    const route = String(window.location.hash || "").replace("#app/", "").split("/")[0];
    const suggestionMap = {
      Dashboard: [
        ["O que devo fazer agora?", "O que devo fazer agora?"],
        ["Resuma esta tela", "Resuma esta tela"],
        ["Quais indicadores aparecem?", "Quais indicadores aparecem?"],
        ["Como começar?", "Como começar?"]
      ],
      Relatórios: [
        ["Posso gerar o PDF?", "Posso gerar o PDF?"],
        ["O que falta no relatório?", "O que falta no relatório?"],
        ["Tenho fotos anexadas?", "Tenho fotos anexadas?"],
        ["Como melhorar este relatório?", "Como melhorar este relatório?"]
      ],
      "Diário de Obras": [
        ["O que falta preencher?", "O que falta preencher?"],
        ["Tenho materiais registrados?", "Tenho materiais registrados?"],
        ["Tenho produção lançada?", "Tenho produção lançada?"],
        ["Posso gerar o PDF do Diário?", "Posso gerar o PDF do Diário?"],
        ["Revisar RDO", "Revisar RDO"]
      ],
      Planos: [
        ["Qual plano escolher?", "Qual plano escolher?"],
        ["Como contratar?", "Como contratar?"],
        ["Quais são os limites?", "Quais são os limites?"],
        ["Plano Empresa", "Como funciona o plano Empresa?"]
      ],
      Administração: [
        ["O que posso gerenciar aqui?", "O que posso gerenciar aqui?"],
        ["Como cadastrar cliente?", "Como cadastrar cliente?"],
        ["Separar admin e cliente", "Como separar admin e cliente?"]
      ],
      "Página do Cliente": [
        ["Último relatório", "Onde está meu último relatório?"],
        ["Último RDO", "Onde está meu último RDO?"],
        ["Documentos disponíveis", "Quais documentos estão disponíveis?"],
        ["Falar com suporte", "Como falar com suporte?"]
      ]
    };

    const materialsSuggestions = [
      ["Tenho consumo registrado?", "Tenho consumo registrado?"],
      ["Diferença de consumo", "Existe diferença de consumo?"],
      ["Como funciona auditoria?", "Como funciona a auditoria?"],
      ["O que falta lançar?", "O que falta lançar?"]
    ];
    const rawItems = route === "diario" && isMaterialsContextVisible() ? materialsSuggestions : (suggestionMap[context.label] || suggestionMap.Dashboard);
    return rawItems.map(function (item) {
      return {
        label: item[0],
        question: item[1]
      };
    });
  }

  function isMaterialsContextVisible() {
    const hash = String(window.location.hash || "");
    return hash.indexOf("rdo-materiais") >= 0 &&
      (isSelectorVisible("#dailyLogMaterialSummary") || isSelectorVisible("#dailyLogAuditPanel"));
  }

  function buildQuickButtons() {
    const container = createElement("div", "elo-quick-buttons");
    [
      ["Criar relatório", "Como criar meu primeiro relatório?"],
      ["Gerar PDF", "Como gerar PDF?"],
      ["Adicionar fotos", "Como adicionar fotos?"],
      ["Diário de Obras", "Como usar o Diário de Obras/RDO?"],
      ["Materiais", "Como registrar materiais?"],
      ["Planos", "Como funcionam os planos?"],
      ["Suporte", "Como falar com suporte?"],
      ["O que você consegue fazer?", "O que você consegue fazer?"]
    ].forEach(function (item) {
      const button = createElement("button", "elo-chip-button", item[0]);
      button.type = "button";
      button.addEventListener("click", function () {
        askElo(item[1]);
      });
      container.appendChild(button);
    });
    return container;
  }

  function buildTools() {
    const details = createElement("details", "elo-tools-menu");
    const summary = createElement("summary", "", "⚙ Ferramentas do Elo");
    const container = createElement("div", "elo-tools");

    details.appendChild(summary);
    container.appendChild(buildQuickButtons());

    const libraryButton = createElement("button", "elo-inline-button", "Biblioteca");
    libraryButton.type = "button";
    libraryButton.addEventListener("click", showLibrary);
    container.appendChild(libraryButton);
    const projectsButton = createElement("button", "elo-inline-button", "Projetos");
    projectsButton.type = "button";
    projectsButton.addEventListener("click", showProjects);
    container.appendChild(projectsButton);
    const backupButton = createElement("button", "elo-inline-button", "Backup do Elo");
    backupButton.type = "button";
    backupButton.addEventListener("click", showEloBackup);
    container.appendChild(backupButton);
    [
      ["Dúvidas recentes", showRecentQuestions],
      ["Minhas memórias", showPersonalMemories],
      ["Limpar histórico", clearEloHistory],
      ["Limpar memórias pessoais", confirmClearPersonalMemories],
      ["Suporte WhatsApp", openSupportWhatsapp]
    ].forEach(function (item) {
      const button = createElement("button", "elo-inline-button", item[0]);
      button.type = "button";
      button.addEventListener("click", item[1]);
      container.appendChild(button);
    });
    container.appendChild(createElement("p", "elo-privacy", "Biblioteca, histórico e memórias ficam salvos apenas neste navegador."));
    details.appendChild(container);
    return details;
  }

  function setPanelOpen(isOpen) {
    if (!ELO_UI.panel || !ELO_UI.root) {
      return;
    }
    ELO_UI.panel.classList.toggle("is-hidden", !isOpen);
    const button = ELO_UI.root.querySelector(".elo-float-button");
    if (button) {
      button.setAttribute("aria-expanded", String(isOpen));
    }
    setWidgetState(isOpen);
    if (isOpen && ELO_UI.input) {
      window.setTimeout(function () {
        ELO_UI.input.focus();
      }, 80);
    }
  }

  function askElo(question) {
    const cleanQuestion = sanitizeUserText(question);
    if (!cleanQuestion) {
      return;
    }

    appendMessage("user", cleanQuestion);

    const personalMemoryCandidate = detectPersonalMemory(cleanQuestion);
    if (personalMemoryCandidate && personalMemoryCandidate.blocked) {
      const blockedAnswer = "Por segurança, não vou guardar esse tipo de informação.";
      appendAssistantMessage(cleanQuestion, blockedAnswer, false);
      saveConversation(cleanQuestion, blockedAnswer);
      rememberSessionTurn(cleanQuestion, {
        nextAction: "Faça uma pergunta sem dados sensíveis.",
        sessionIntent: "seguranca"
      }, blockedAnswer);
      return;
    }

    if (personalMemoryCandidate) {
      appendPersonalMemoryPrompt(cleanQuestion, personalMemoryCandidate);
      saveConversation(cleanQuestion, "O Elo perguntou se deve guardar uma memória pessoal.");
      rememberSessionTurn(cleanQuestion, {
        nextAction: "Escolha Sim, lembrar ou Não.",
        sessionIntent: "memoria_pessoal"
      }, "O Elo perguntou se deve guardar uma memória pessoal.");
      return;
    }

    const response = buildResponse(cleanQuestion);
    const answer = formatResponse(response);
    appendAssistantMessage(cleanQuestion, answer, response.canSave !== false, response);
    saveConversation(cleanQuestion, answer);
    rememberSessionTurn(cleanQuestion, response, answer);
  }

  function appendMessage(kind, text) {
    const message = createElement("article", "elo-message " + kind);
    const bubble = createElement("div", "elo-message-bubble", text);
    message.appendChild(bubble);
    ELO_UI.messages.appendChild(message);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
    return message;
  }

  function appendPersonalMemoryPrompt(question, memoryItem) {
    const message = appendMessage("assistant", "Deseja que eu lembre disso?\n\n" + memoryItem.label + ": " + memoryItem.value);
    const actions = createElement("div", "elo-message-actions");
    const yesButton = createElement("button", "elo-inline-button", "Sim, lembrar");
    const noButton = createElement("button", "elo-inline-button", "Não");

    yesButton.type = "button";
    noButton.type = "button";

    yesButton.addEventListener("click", function () {
      savePersonalMemory(memoryItem);
      yesButton.disabled = true;
      noButton.disabled = true;
      appendMessage("system", "Memória pessoal salva apenas neste navegador.");
    });

    noButton.addEventListener("click", function () {
      yesButton.disabled = true;
      noButton.disabled = true;
      appendMessage("system", "Tudo bem. Não vou guardar essa informação.");
    });

    actions.appendChild(yesButton);
    actions.appendChild(noButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function appendAssistantMessage(question, answer, canSave, response) {
    const message = appendMessage("assistant", answer);
    const actions = createElement("div", "elo-message-actions");

    if (response && response.libraryItem) {
      const fullButton = createElement("button", "elo-inline-button", "Ver completo");
      fullButton.type = "button";
      fullButton.addEventListener("click", function () {
        appendMessage("system", response.libraryItem.title + "\n\n" + response.libraryItem.content);
      });
      fullButton.classList.add("elo-secondary-response-action");
      actions.appendChild(fullButton);
    }

    if (response && Array.isArray(response.routineCards)) {
      const routineActions = createElement("div", "elo-routine-actions");
      response.routineCards.forEach(function (card) {
        const cardButton = createElement("button", "elo-routine-card", card.label);
        cardButton.type = "button";
        cardButton.addEventListener("click", function () {
          handleRoutineAction(card.action);
        });
        routineActions.appendChild(cardButton);
      });
      routineActions.classList.add("elo-secondary-response-action");
      message.appendChild(routineActions);
    }

    if (response && response.webSearch) {
      const webNotice = createElement("p", "elo-web-search-notice", "Busca real controlada: desativada por padrão nesta versão.");
      const webActions = createElement("div", "elo-web-search-actions");
      const prepareButton = createElement("button", "elo-inline-button", "Preparar busca");
      const cancelButton = createElement("button", "elo-inline-button", "Não buscar");

      prepareButton.type = "button";
      cancelButton.type = "button";

      prepareButton.addEventListener("click", function () {
        prepareControlledWebSearch(response.webSearch, prepareButton, cancelButton);
      });
      cancelButton.addEventListener("click", function () {
        prepareButton.disabled = true;
        cancelButton.disabled = true;
        appendMessage("system", "Tudo bem. Não vou preparar busca externa para essa pergunta.");
      });

      webActions.appendChild(prepareButton);
      webActions.appendChild(cancelButton);
      webNotice.classList.add("elo-secondary-response-action");
      webActions.classList.add("elo-secondary-response-action");
      message.appendChild(webNotice);
      message.appendChild(webActions);
    }

    if (canSave) {
      const saveQuestion = createElement("span", "elo-privacy", "Deseja guardar isso para eu lembrar depois?");
      saveQuestion.classList.add("elo-secondary-response-action");
      message.appendChild(saveQuestion);
      const saveButton = createElement("button", "elo-inline-button", "Guardar");
      const dontSaveButton = createElement("button", "elo-inline-button", "Não guardar");
      saveButton.classList.add("elo-secondary-response-action");
      dontSaveButton.classList.add("elo-secondary-response-action");
      saveButton.type = "button";
      dontSaveButton.type = "button";
      saveButton.addEventListener("click", function () {
        saveUsefulAnswer(question, answer);
        saveButton.disabled = true;
        dontSaveButton.disabled = true;
        appendMessage("system", "Guardado na memória local do Elo.");
      });
      dontSaveButton.addEventListener("click", function () {
        saveButton.disabled = true;
        dontSaveButton.disabled = true;
      });
      const libraryQuestion = createElement("span", "elo-privacy", "Deseja guardar isso na Biblioteca do Elo?");
      const libraryButton = createElement("button", "elo-inline-button", "Guardar na Biblioteca");
      const dontSaveLibraryButton = createElement("button", "elo-inline-button", "NÃ£o guardar na Biblioteca");
      libraryQuestion.classList.add("elo-secondary-response-action");
      libraryButton.classList.add("elo-secondary-response-action");
      dontSaveLibraryButton.classList.add("elo-secondary-response-action");
      libraryButton.type = "button";
      dontSaveLibraryButton.type = "button";
      libraryButton.addEventListener("click", function () {
        const result = createLibraryItemFromAnswer(question, answer);
        libraryButton.disabled = true;
        dontSaveLibraryButton.disabled = true;
        if (result.ok) {
          appendMessage("system", "Guardado na Biblioteca do Elo: " + result.item.title + ".");
        } else if (result.reason === "sensitive") {
          appendMessage("system", "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.");
        } else {
          appendMessage("system", "NÃ£o consegui guardar na Biblioteca porque faltou tÃ­tulo ou conteÃºdo.");
        }
      });
      dontSaveLibraryButton.addEventListener("click", function () {
        libraryButton.disabled = true;
        dontSaveLibraryButton.disabled = true;
      });
      actions.appendChild(saveButton);
      actions.appendChild(dontSaveButton);
      message.appendChild(libraryQuestion);
      actions.appendChild(libraryButton);
      actions.appendChild(dontSaveLibraryButton);
    }

    const yesButton = createElement("button", "elo-inline-button elo-feedback-button", "👍 Útil");
    const noButton = createElement("button", "elo-inline-button elo-feedback-button", "👎 Não útil");
    yesButton.type = "button";
    noButton.type = "button";
    yesButton.addEventListener("click", function () {
      saveFeedback(question, answer, "positive");
      yesButton.disabled = true;
      noButton.disabled = true;
    });
    noButton.addEventListener("click", function () {
      saveFeedback(question, answer, "negative");
      yesButton.disabled = true;
      noButton.disabled = true;
    });

    actions.appendChild(yesButton);
    actions.appendChild(noButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function prepareControlledWebSearch(webSearch, prepareButton, cancelButton) {
    const question = sanitizeUserText(webSearch && webSearch.question);
    const context = sanitizeUserText(webSearch && webSearch.context);
    const query = sanitizeUserText(webSearch && webSearch.query) || buildSearchQuery(question);

    prepareButton.disabled = true;
    cancelButton.disabled = true;

    if (hasSensitiveMemoryTerm(question) || hasSensitiveMemoryTerm(context)) {
      appendMessage("system", "Por segurança, não vou buscar nem guardar esse tipo de informação.");
      return;
    }

    ELO_WEB_SEARCH.requestSearch(question, context).then(function (result) {
      if (!result.ok && (result.reason === "disabled" || result.reason === "request_failed")) {
        appendMessage(
          "system",
          "A busca real ainda está desativada nesta versão. Quando ativada, eu vou consultar uma fonte externa segura, resumir a resposta e perguntar se você quer guardar na Biblioteca.\n\nConsulta sugerida: " + (result.query || query)
        );
        return;
      }

      if (!result.ok && result.reason === "sensitive") {
        appendMessage("system", "Por segurança, não vou buscar nem guardar esse tipo de informação.");
        return;
      }

      if (!result.ok || !result.answer) {
        appendMessage("system", "Não consegui preparar a busca agora. Nenhum dado foi enviado para servidor.");
        return;
      }

      appendExternalSearchResult(question, result);
    });
  }

  function appendExternalSearchResult(question, result) {
    const answerParts = [
      "Resposta externa recebida pela busca controlada:",
      "",
      result.answer
    ];

    if (result.sources && result.sources.length) {
      answerParts.push("", "Fontes:", result.sources.map(function (source) {
        return "- " + source;
      }).join("\n"));
    }

    if (result.confidence) {
      answerParts.push("", "Confiança: " + result.confidence);
    }

    const message = appendMessage("assistant", answerParts.join("\n"));
    const actions = createElement("div", "elo-message-actions");
    const saveButton = createElement("button", "elo-inline-button", "Guardar na Biblioteca");
    const dontSaveButton = createElement("button", "elo-inline-button", "Não guardar");

    message.appendChild(createElement("span", "elo-privacy", "Deseja guardar isso na Biblioteca?"));

    saveButton.type = "button";
    dontSaveButton.type = "button";
    saveButton.addEventListener("click", function () {
      const saveResult = saveLibraryItem({
        title: suggestLibraryTitle(question),
        content: result.answer,
        category: suggestLibraryCategory(question),
        tags: ["Busca controlada", "Elo"],
        source: "busca_controlada"
      });
      saveButton.disabled = true;
      dontSaveButton.disabled = true;
      appendMessage("system", saveResult.ok ? "Guardado na Biblioteca do Elo." : "Não consegui guardar essa resposta na Biblioteca.");
    });
    dontSaveButton.addEventListener("click", function () {
      saveButton.disabled = true;
      dontSaveButton.disabled = true;
    });

    actions.appendChild(saveButton);
    actions.appendChild(dontSaveButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function handleRoutineAction(action) {
    if (action === "library") {
      showLibrary();
      return;
    }

    if (action === "memories") {
      showPersonalMemories();
      return;
    }

    if (action === "pdf") {
      askElo("Como gerar PDF?");
      return;
    }

    if (action === "rdo") {
      if (clickRouteButton("diario")) {
        appendMessage("system", "Abri o Diário de Obras/RDO para você.");
      } else {
        appendMessage("system", "Não encontrei o atalho de RDO nesta tela. Pelo menu do ObraReport, procure por Diário de Obras.");
      }
      return;
    }

    if (action === "report") {
      if (clickRouteButton("relatorios")) {
        appendMessage("system", "Abri a área de Relatórios para você.");
      } else {
        appendMessage("system", "Não encontrei o atalho de Relatórios nesta tela. Pelo menu do ObraReport, procure por Relatórios.");
      }
      return;
    }

    if (clickRouteButton("dashboard")) {
      appendMessage("system", "Voltei para o dashboard do ObraReport.");
    } else {
      appendMessage("system", "Continue pelo dashboard do ObraReport: você pode abrir RDO, Relatórios, Materiais ou Biblioteca pelo Elo.");
    }
  }

  function clickRouteButton(route) {
    const button = document.querySelector("[data-route-target='" + route + "']");
    if (!button || typeof button.click !== "function") {
      return false;
    }
    button.click();
    return true;
  }

  function showRecentQuestions() {
    const recent = getRecentQuestions();
    if (!recent.length) {
      appendMessage("system", "Ainda não há dúvidas recentes salvas neste navegador.");
      return;
    }

    const text = recent.map(function (item, index) {
      return (index + 1) + ". " + formatDateTime(item.createdAt) + " — " + item.question;
    }).join("\n");
    appendMessage("system", "Dúvidas recentes:\n\n" + text);
  }

  function clearEloHistory() {
    clearMemory();
    appendMessage("system", "Histórico local do Elo limpo. Nenhum dado do SaaS foi alterado.");
  }

  function appendSimpleOptions(select, options) {
    options.forEach(function (optionValue) {
      const option = createElement("option", "", optionValue);
      option.value = optionValue;
      select.appendChild(option);
    });
  }

  function appendProjectOptions(select, includeEmpty) {
    if (includeEmpty) {
      const emptyOption = createElement("option", "", "Sem projeto vinculado");
      emptyOption.value = "";
      select.appendChild(emptyOption);
    }
    getProjects().forEach(function (project) {
      const option = createElement("option", "", project.name);
      option.value = project.id;
      select.appendChild(option);
    });
  }

  function appendCategoryOptions(select, includeAll) {
    if (includeAll) {
      const allOption = createElement("option", "", "Todas");
      allOption.value = "Todas";
      select.appendChild(allOption);
    }
    appendSimpleOptions(select, ELO_LIBRARY_CATEGORIES);
  }

  function showProjects() {
    const message = appendMessage("system", "Projetos e Objetivos do Elo");
    const panel = createElement("div", "elo-projects-panel");
    const status = createElement("p", "elo-privacy", "Projetos e objetivos ficam salvos apenas neste navegador.");
    const controls = createElement("div", "elo-projects-controls");
    const suggestedProjectsButton = createElement("button", "elo-inline-button", "Adicionar projetos sugeridos");
    const addProjectButton = createElement("button", "elo-inline-button", "Adicionar projeto");
    const suggestedGoalsButton = createElement("button", "elo-inline-button", "Adicionar objetivos sugeridos");
    const addGoalButton = createElement("button", "elo-inline-button", "Adicionar objetivo");
    const projectList = createElement("div", "elo-project-list");
    const goalTitle = createElement("h3", "elo-projects-subtitle", "Objetivos");
    const goalList = createElement("div", "elo-goal-list");
    const goalForm = buildGoalForm(function (result) {
      if (result.ok) {
        status.textContent = "Objetivo salvo no Elo.";
        renderGoalList(goalList, goalForm);
      } else if (result.reason === "sensitive") {
        status.textContent = "Por segurança, não vou guardar esse tipo de informação.";
      } else {
        status.textContent = "Preencha o título do objetivo para salvar.";
      }
    });
    const projectForm = buildProjectForm(function (result) {
      if (result.ok) {
        status.textContent = "Projeto salvo no Elo.";
        renderProjectList(projectList, projectForm, goalList, goalForm);
        renderGoalList(goalList, goalForm);
      } else if (result.reason === "sensitive") {
        status.textContent = "Por segurança, não vou guardar esse tipo de informação.";
      } else {
        status.textContent = "Preencha o nome do projeto para salvar.";
      }
    });

    suggestedProjectsButton.type = "button";
    addProjectButton.type = "button";
    suggestedGoalsButton.type = "button";
    addGoalButton.type = "button";

    suggestedProjectsButton.addEventListener("click", function () {
      const added = addSuggestedProjects();
      status.textContent = added ? "Projetos sugeridos adicionados: " + added + "." : "Os projetos sugeridos já estavam salvos.";
      renderProjectList(projectList, projectForm, goalList, goalForm);
      renderGoalList(goalList, goalForm);
    });
    addProjectButton.addEventListener("click", function () {
      projectForm.classList.toggle("is-hidden");
    });
    suggestedGoalsButton.addEventListener("click", function () {
      const added = addSuggestedGoals();
      status.textContent = added ? "Objetivos sugeridos adicionados: " + added + "." : "Os objetivos sugeridos já estavam salvos.";
      renderGoalList(goalList, goalForm);
    });
    addGoalButton.addEventListener("click", function () {
      goalForm.classList.toggle("is-hidden");
    });

    controls.appendChild(suggestedProjectsButton);
    controls.appendChild(addProjectButton);
    controls.appendChild(suggestedGoalsButton);
    controls.appendChild(addGoalButton);
    panel.appendChild(status);
    panel.appendChild(controls);
    panel.appendChild(projectForm);
    panel.appendChild(projectList);
    panel.appendChild(goalTitle);
    panel.appendChild(goalForm);
    panel.appendChild(goalList);
    message.appendChild(panel);

    renderProjectList(projectList, projectForm, goalList, goalForm);
    renderGoalList(goalList, goalForm);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function buildProjectForm(onSave) {
    const form = createElement("form", "elo-project-form is-hidden");
    const nameInput = createElement("input", "elo-library-field");
    const descriptionInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const statusSelect = createElement("select", "elo-library-field");
    const prioritySelect = createElement("select", "elo-library-field");
    const nextActionInput = createElement("input", "elo-library-field");
    const notesInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const saveButton = createElement("button", "elo-send-button", "Salvar projeto");
    let editingProjectId = "";

    nameInput.type = "text";
    nameInput.maxLength = 120;
    nameInput.placeholder = "Nome do projeto";
    descriptionInput.maxLength = 600;
    descriptionInput.rows = 3;
    descriptionInput.placeholder = "Descrição";
    nextActionInput.type = "text";
    nextActionInput.maxLength = 300;
    nextActionInput.placeholder = "Próxima ação";
    notesInput.maxLength = 1000;
    notesInput.rows = 3;
    notesInput.placeholder = "Notas";
    saveButton.type = "submit";
    appendSimpleOptions(statusSelect, ELO_PROJECT_STATUSES);
    appendSimpleOptions(prioritySelect, ELO_PROJECT_PRIORITIES);

    form.setProject = function (project) {
      editingProjectId = project && project.id ? project.id : "";
      nameInput.value = project && project.name ? project.name : "";
      descriptionInput.value = project && project.description ? project.description : "";
      statusSelect.value = project && project.status ? project.status : "ativo";
      prioritySelect.value = project && project.priority ? project.priority : "media";
      nextActionInput.value = project && project.nextAction ? project.nextAction : "";
      notesInput.value = project && project.notes ? project.notes : "";
      form.classList.remove("is-hidden");
      saveButton.textContent = editingProjectId ? "Salvar edição" : "Salvar projeto";
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = saveProject({
        id: editingProjectId,
        name: nameInput.value,
        description: descriptionInput.value,
        status: statusSelect.value,
        priority: prioritySelect.value,
        nextAction: nextActionInput.value,
        notes: notesInput.value
      });
      if (result.ok) {
        editingProjectId = "";
        nameInput.value = "";
        descriptionInput.value = "";
        statusSelect.value = "ativo";
        prioritySelect.value = "media";
        nextActionInput.value = "";
        notesInput.value = "";
        saveButton.textContent = "Salvar projeto";
        form.classList.add("is-hidden");
      }
      onSave(result);
    });

    form.appendChild(nameInput);
    form.appendChild(descriptionInput);
    form.appendChild(statusSelect);
    form.appendChild(prioritySelect);
    form.appendChild(nextActionInput);
    form.appendChild(notesInput);
    form.appendChild(saveButton);
    return form;
  }

  function renderProjectList(list, projectForm, goalList, goalForm) {
    list.textContent = "";
    const projects = getProjects();

    if (!projects.length) {
      list.appendChild(createElement("p", "elo-library-empty", "Nenhum projeto salvo. Use os projetos sugeridos ou adicione um projeto manualmente."));
      return;
    }

    projects.forEach(function (project) {
      const card = createElement("article", "elo-project-card");
      const header = createElement("div", "elo-project-card-header");
      const title = createElement("strong", "", project.name);
      const badges = createElement("div", "elo-project-badges");
      const statusBadge = createElement("span", "elo-status-badge is-" + project.status, project.status);
      const priorityBadge = createElement("span", "elo-priority-badge is-" + project.priority, "prioridade " + project.priority);
      const description = createElement("p", "", project.description || "Sem descrição salva.");
      const nextAction = createElement("p", "elo-project-next", "Próxima ação: " + (project.nextAction || "não definida"));
      const actions = createElement("div", "elo-library-actions");
      const editButton = createElement("button", "elo-inline-button", "Editar");
      const activeButton = createElement("button", "elo-inline-button", "Ativo");
      const pauseButton = createElement("button", "elo-inline-button", "Pausado");
      const doneButton = createElement("button", "elo-inline-button", "Concluído");
      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

      editButton.type = "button";
      activeButton.type = "button";
      pauseButton.type = "button";
      doneButton.type = "button";
      deleteButton.type = "button";

      editButton.addEventListener("click", function () {
        projectForm.setProject(project);
      });
      activeButton.addEventListener("click", function () {
        updateProjectStatus(project.id, "ativo");
        renderProjectList(list, projectForm, goalList, goalForm);
      });
      pauseButton.addEventListener("click", function () {
        updateProjectStatus(project.id, "pausado");
        renderProjectList(list, projectForm, goalList, goalForm);
      });
      doneButton.addEventListener("click", function () {
        updateProjectStatus(project.id, "concluido");
        renderProjectList(list, projectForm, goalList, goalForm);
      });
      deleteButton.addEventListener("click", function () {
        deleteProject(project.id);
        renderProjectList(list, projectForm, goalList, goalForm);
        renderGoalList(goalList, goalForm);
        appendMessage("system", "Projeto excluído do Elo.");
      });

      badges.appendChild(statusBadge);
      badges.appendChild(priorityBadge);
      header.appendChild(title);
      header.appendChild(badges);
      actions.appendChild(editButton);
      actions.appendChild(activeButton);
      actions.appendChild(pauseButton);
      actions.appendChild(doneButton);
      actions.appendChild(deleteButton);
      card.appendChild(header);
      card.appendChild(description);
      card.appendChild(nextAction);
      if (project.notes) {
        card.appendChild(createElement("p", "elo-project-notes", "Notas: " + project.notes));
      }
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function buildGoalForm(onSave) {
    const form = createElement("form", "elo-project-form is-hidden");
    const titleInput = createElement("input", "elo-library-field");
    const projectSelect = createElement("select", "elo-library-field");
    const statusSelect = createElement("select", "elo-library-field");
    const targetInput = createElement("input", "elo-library-field");
    const saveButton = createElement("button", "elo-send-button", "Salvar objetivo");

    titleInput.type = "text";
    titleInput.maxLength = 160;
    titleInput.placeholder = "Título do objetivo";
    targetInput.type = "date";
    saveButton.type = "submit";
    appendProjectOptions(projectSelect, true);
    appendSimpleOptions(statusSelect, ELO_GOAL_STATUSES);

    form.refreshProjects = function () {
      const currentValue = projectSelect.value;
      projectSelect.textContent = "";
      appendProjectOptions(projectSelect, true);
      projectSelect.value = currentValue;
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = saveGoal({
        title: titleInput.value,
        projectId: projectSelect.value,
        status: statusSelect.value,
        targetDate: targetInput.value
      });
      if (result.ok) {
        titleInput.value = "";
        projectSelect.value = "";
        statusSelect.value = "aberto";
        targetInput.value = "";
        form.classList.add("is-hidden");
      }
      onSave(result);
    });

    form.appendChild(titleInput);
    form.appendChild(projectSelect);
    form.appendChild(statusSelect);
    form.appendChild(targetInput);
    form.appendChild(saveButton);
    return form;
  }

  function renderGoalList(list, goalForm) {
    list.textContent = "";
    if (goalForm && typeof goalForm.refreshProjects === "function") {
      goalForm.refreshProjects();
    }
    const goals = getGoals();

    if (!goals.length) {
      list.appendChild(createElement("p", "elo-library-empty", "Nenhum objetivo salvo. Use os objetivos sugeridos ou adicione um objetivo manualmente."));
      return;
    }

    goals.forEach(function (goal) {
      const project = goal.projectId ? getProjectById(goal.projectId) : null;
      const card = createElement("article", "elo-goal-card");
      const header = createElement("div", "elo-project-card-header");
      const title = createElement("strong", "", goal.title);
      const meta = createElement("span", "elo-library-meta", (project ? project.name : "Sem projeto") + (goal.targetDate ? " · " + goal.targetDate : ""));
      const status = createElement("span", "elo-status-badge is-" + goal.status, goal.status);
      const actions = createElement("div", "elo-library-actions");
      const progressButton = createElement("button", "elo-inline-button", "Em andamento");
      const doneButton = createElement("button", "elo-inline-button", "Concluir");
      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

      progressButton.type = "button";
      doneButton.type = "button";
      deleteButton.type = "button";

      progressButton.addEventListener("click", function () {
        updateGoalStatus(goal.id, "em_andamento");
        renderGoalList(list, goalForm);
      });
      doneButton.addEventListener("click", function () {
        updateGoalStatus(goal.id, "concluido");
        renderGoalList(list, goalForm);
      });
      deleteButton.addEventListener("click", function () {
        deleteGoal(goal.id);
        renderGoalList(list, goalForm);
        appendMessage("system", "Objetivo excluído do Elo.");
      });

      header.appendChild(title);
      header.appendChild(status);
      actions.appendChild(progressButton);
      actions.appendChild(doneButton);
      actions.appendChild(deleteButton);
      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function showLibrary() {
    const message = appendMessage("system", "Biblioteca do Elo");
    const panel = createElement("div", "elo-library-panel");
    const status = createElement("p", "elo-privacy", "Esta biblioteca fica salva apenas neste navegador.");
    const controls = createElement("div", "elo-library-controls");
    const searchInput = createElement("input", "elo-library-search");
    const categorySelect = createElement("select", "elo-library-select");
    const addButton = createElement("button", "elo-inline-button", "Adicionar item");
    const form = buildLibraryForm(function (result) {
      if (result.ok) {
        status.textContent = "Item salvo na Biblioteca do Elo.";
        renderLibraryList(list, searchInput.value, categorySelect.value);
      } else if (result.reason === "sensitive") {
        status.textContent = "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.";
      } else {
        status.textContent = "Preencha tÃ­tulo e conteÃºdo para salvar.";
      }
    });
    const list = createElement("div", "elo-library-list");

    searchInput.type = "search";
    searchInput.placeholder = "Buscar na biblioteca";
    addButton.type = "button";
    categorySelect.setAttribute("aria-label", "Filtrar categoria da Biblioteca");
    appendCategoryOptions(categorySelect, true);

    searchInput.addEventListener("input", function () {
      renderLibraryList(list, searchInput.value, categorySelect.value);
    });
    categorySelect.addEventListener("change", function () {
      renderLibraryList(list, searchInput.value, categorySelect.value);
    });
    addButton.addEventListener("click", function () {
      form.classList.toggle("is-hidden");
    });

    controls.appendChild(searchInput);
    controls.appendChild(categorySelect);
    controls.appendChild(addButton);
    panel.appendChild(status);
    panel.appendChild(controls);
    panel.appendChild(form);
    panel.appendChild(list);
    message.appendChild(panel);

    renderLibraryList(list, "", "Todas");
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function buildLibraryForm(onSave) {
    const form = createElement("form", "elo-library-form is-hidden");
    const titleInput = createElement("input", "elo-library-field");
    const contentInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const categorySelect = createElement("select", "elo-library-field");
    const tagsInput = createElement("input", "elo-library-field");
    const saveButton = createElement("button", "elo-send-button", "Salvar na Biblioteca");

    titleInput.type = "text";
    titleInput.maxLength = 120;
    titleInput.placeholder = "TÃ­tulo";
    contentInput.maxLength = 3000;
    contentInput.rows = 4;
    contentInput.placeholder = "ConteÃºdo";
    tagsInput.type = "text";
    tagsInput.maxLength = 180;
    tagsInput.placeholder = "Tags opcionais, separadas por vÃ­rgula";
    saveButton.type = "submit";
    categorySelect.setAttribute("aria-label", "Categoria do item");
    appendCategoryOptions(categorySelect, false);

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = saveLibraryItem({
        title: titleInput.value,
        content: contentInput.value,
        category: categorySelect.value,
        tags: tagsInput.value,
        source: "manual"
      });
      if (result.ok) {
        titleInput.value = "";
        contentInput.value = "";
        tagsInput.value = "";
        categorySelect.value = "Geral";
        form.classList.add("is-hidden");
      }
      onSave(result);
    });

    form.appendChild(titleInput);
    form.appendChild(contentInput);
    form.appendChild(categorySelect);
    form.appendChild(tagsInput);
    form.appendChild(saveButton);
    return form;
  }

  function renderLibraryList(list, query, category) {
    list.textContent = "";
    const items = searchLibraryItems(query, category);

    if (!items.length) {
      list.appendChild(createElement("p", "elo-library-empty", "Nenhum item encontrado na Biblioteca do Elo."));
      return;
    }

    items.forEach(function (libraryItem) {
      const card = createElement("article", "elo-library-card");
      const header = createElement("div", "elo-library-card-header");
      const title = createElement("strong", "", (libraryItem.favorite ? "★ " : "") + libraryItem.title);
      const meta = createElement("span", "elo-library-meta", libraryItem.category + " Â· " + formatDateTime(libraryItem.updatedAt || libraryItem.createdAt));
      const summary = createElement("p", "", summarizeLibraryContent(libraryItem.content));
      const tags = createElement("span", "elo-library-tags", (libraryItem.tags || []).length ? "Tags: " + libraryItem.tags.join(", ") : "Sem tags");
      const actions = createElement("div", "elo-library-actions");
      const favoriteButton = createElement("button", "elo-inline-button", libraryItem.favorite ? "Desfavoritar" : "Favoritar");
      const viewButton = createElement("button", "elo-inline-button", "Ver completo");
      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

      favoriteButton.type = "button";
      viewButton.type = "button";
      deleteButton.type = "button";

      favoriteButton.addEventListener("click", function () {
        toggleLibraryFavorite(libraryItem.id);
        renderLibraryList(list, query, category);
      });
      viewButton.addEventListener("click", function () {
        appendMessage("system", libraryItem.title + "\n\n" + libraryItem.content);
      });
      deleteButton.addEventListener("click", function () {
        deleteLibraryItem(libraryItem.id);
        renderLibraryList(list, query, category);
        appendMessage("system", "Item excluÃ­do da Biblioteca do Elo.");
      });

      header.appendChild(title);
      header.appendChild(meta);
      actions.appendChild(favoriteButton);
      actions.appendChild(viewButton);
      actions.appendChild(deleteButton);
      card.appendChild(header);
      card.appendChild(summary);
      card.appendChild(tags);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function showPersonalMemories() {
    const memories = getPersonalMemories();
    const message = appendMessage("system", memories.length ? "Minhas memórias pessoais:" : "Ainda não há memórias pessoais salvas neste navegador.");

    if (!memories.length) {
      return;
    }

    const list = createElement("div", "elo-memory-list");
    memories.forEach(function (memoryItem) {
      const item = createElement("article", "elo-memory-item");
      const text = createElement("div");
      text.appendChild(createElement("strong", "", memoryItem.label + ": " + memoryItem.value));
      text.appendChild(createElement("span", "", "Categoria: " + memoryItem.category + " · " + formatDateTime(memoryItem.createdAt)));

      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", function () {
        deletePersonalMemory(memoryItem.id);
        item.remove();
        appendMessage("system", "Memória pessoal excluída.");
      });

      item.appendChild(text);
      item.appendChild(deleteButton);
      list.appendChild(item);
    });

    message.appendChild(list);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function confirmClearPersonalMemories() {
    const message = appendMessage("system", "Tem certeza? Isso não afeta dados do ObraReport, apenas memórias locais do Elo.");
    const actions = createElement("div", "elo-message-actions");
    const confirmButton = createElement("button", "elo-inline-button", "Limpar memórias pessoais");
    const cancelButton = createElement("button", "elo-inline-button", "Cancelar");

    confirmButton.type = "button";
    cancelButton.type = "button";

    confirmButton.addEventListener("click", function () {
      clearPersonalMemories();
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "Memórias pessoais limpas. Dados do ObraReport não foram alterados.");
    });

    cancelButton.addEventListener("click", function () {
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "Limpeza de memórias pessoais cancelada.");
    });

    actions.appendChild(confirmButton);
    actions.appendChild(cancelButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function showEloBackup() {
    const message = appendMessage("system", "Backup do Elo");
    const panel = createElement("div", "elo-backup-panel");
    const status = createElement("p", "elo-privacy", "Backup do Elo fica no seu dispositivo. Nada e enviado ao servidor.");
    const actions = createElement("div", "elo-backup-actions");
    const exportButton = createElement("button", "elo-inline-button", "Exportar JSON");
    const importButton = createElement("button", "elo-inline-button", "Importar JSON");
    const clearButton = createElement("button", "elo-memory-delete", "Limpar dados do Elo");
    const fileInput = createElement("input", "elo-backup-file");

    exportButton.type = "button";
    importButton.type = "button";
    clearButton.type = "button";
    fileInput.type = "file";
    fileInput.accept = ".json,application/json";

    exportButton.addEventListener("click", function () {
      const result = exportEloData();
      status.textContent = result.ok
        ? "Backup gerado: " + result.fileName + "."
        : "Nao consegui gerar o arquivo neste navegador.";
    });

    importButton.addEventListener("click", function () {
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      importEloDataFromFile(fileInput.files && fileInput.files[0], function (result) {
        if (result.ok) {
          status.textContent = "Backup importado. Memorias: " + result.counts.personalMemories + ", Biblioteca: " + result.counts.libraryItems + ", Projetos: " + result.counts.projects + ", Objetivos: " + result.counts.goals + ".";
          appendMessage("system", "Dados locais do Elo importados com sucesso. Dados do ObraReport nao foram alterados.");
        } else {
          status.textContent = "Nao consegui importar. Selecione um JSON de backup valido do Elo.";
        }
        fileInput.value = "";
      });
    });

    clearButton.addEventListener("click", confirmClearAllEloData);

    actions.appendChild(exportButton);
    actions.appendChild(importButton);
    actions.appendChild(clearButton);
    panel.appendChild(status);
    panel.appendChild(actions);
    panel.appendChild(createElement("p", "elo-backup-note", "O arquivo inclui historico do Elo, memorias pessoais, Biblioteca, Projetos, Objetivos e feedback local."));
    panel.appendChild(fileInput);
    message.appendChild(panel);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function confirmClearAllEloData() {
    const message = appendMessage("system", "Tem certeza? Isso apaga memorias, Biblioteca, Projetos, Objetivos, historico e feedback locais do Elo. Nao afeta dados do ObraReport.");
    const actions = createElement("div", "elo-message-actions");
    const confirmButton = createElement("button", "elo-memory-delete", "Confirmar limpeza");
    const cancelButton = createElement("button", "elo-inline-button", "Cancelar");

    confirmButton.type = "button";
    cancelButton.type = "button";

    confirmButton.addEventListener("click", function () {
      clearAllEloData();
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "Dados locais do Elo limpos. Dados do ObraReport nao foram alterados.");
    });

    cancelButton.addEventListener("click", function () {
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "Limpeza completa do Elo cancelada.");
    });

    actions.appendChild(confirmButton);
    actions.appendChild(cancelButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function openSupportWhatsapp() {
    if (!ELO_CONFIG.whatsappNumber) {
      appendMessage("system", "Suporte por WhatsApp ainda não configurado.");
      return;
    }

    const message = "Olá, preciso de ajuda com o ObraReport.";
    const url = "https://wa.me/" + encodeURIComponent(ELO_CONFIG.whatsappNumber) + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ELO_BOOTSTRAP
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildWidget);
  } else {
    buildWidget();
  }
})();

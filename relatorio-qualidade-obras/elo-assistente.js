(function () {
  "use strict";

  // ELO_CONFIG
  const ELO_CONFIG = {
    storageKey: "obrareport_elo_assistente_v1",
    maxHistory: 20,
    whatsappNumber: ""
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
      feedback: Array.isArray(memory && memory.feedback) ? memory.feedback.slice(0, ELO_CONFIG.maxHistory) : [],
      isOpen: Boolean(memory && memory.isOpen)
    };
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

  // ELO_WEB_SEARCH_FUTURE
  function shouldSearchWeb(question) {
    const text = normalizeText(question);
    return ["previsao", "tempo hoje", "noticia", "restaurante", "receita", "preco atual", "cotacao", "dolar", "publica"].some(function (keyword) {
      return text.indexOf(keyword) >= 0;
    });
  }

  function buildSearchQuery(question) {
    const cleanQuestion = sanitizeUserText(question);
    if (normalizeText(cleanQuestion).indexOf("previsao") >= 0 || normalizeText(cleanQuestion).indexOf("tempo") >= 0) {
      return "previsão do tempo hoje em Vitória da Conquista";
    }
    return cleanQuestion || "pesquisa relacionada ao ObraReport";
  }

  function explainFutureSearch(question) {
    const query = buildSearchQuery(question);
    return {
      shortAnswer: "Eu ainda não estou conectado à internet nesta versão.",
      fullAnswer: "No futuro eu pesquisaria por: " + query + ". Depois eu poderia resumir, responder com segurança e guardar o aprendizado para você.",
      nextAction: "Por enquanto, posso ajudar com a base local do ObraReport.",
      canSave: false
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

    const greeting = getGreetingResponse(normalizedQuestion);
    if (greeting) {
      return greeting;
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

  function searchKnowledgeBase(normalizedQuestion) {
    let bestItem = null;
    let bestScore = 0;

    ELO_KNOWLEDGE_BASE.forEach(function (item) {
      let score = 0;
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
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    });

    return bestScore > 0 ? bestItem : null;
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
    input: null
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
    const closeButton = createElement("button", "elo-close-button", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Fechar Elo");
    header.appendChild(headerText);
    header.appendChild(closeButton);

    ELO_UI.messages = createElement("div", "elo-messages");

    const footer = createElement("footer", "elo-footer");
    footer.appendChild(buildQuickButtons());
    footer.appendChild(buildTools());

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
    footer.appendChild(createElement("p", "elo-privacy", "As perguntas ficam salvas apenas neste navegador."));

    ELO_UI.panel.appendChild(header);
    ELO_UI.panel.appendChild(ELO_UI.messages);
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

    appendMessage("system", "Olá, eu sou o Elo. Posso ajudar com relatórios, PDF, RDO, fotos, materiais e planos.");
    setPanelOpen(getWidgetState());
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
    const container = createElement("div", "elo-tools");
    [
      ["Dúvidas recentes", showRecentQuestions],
      ["Limpar histórico", clearEloHistory],
      ["Suporte WhatsApp", openSupportWhatsapp]
    ].forEach(function (item) {
      const button = createElement("button", "elo-inline-button", item[0]);
      button.type = "button";
      button.addEventListener("click", item[1]);
      container.appendChild(button);
    });
    return container;
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
    const response = buildResponse(cleanQuestion);
    const answer = formatResponse(response);
    appendAssistantMessage(cleanQuestion, answer, response.canSave !== false);
    saveConversation(cleanQuestion, answer);
  }

  function appendMessage(kind, text) {
    const message = createElement("article", "elo-message " + kind);
    const bubble = createElement("div", "elo-message-bubble", text);
    message.appendChild(bubble);
    ELO_UI.messages.appendChild(message);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
    return message;
  }

  function appendAssistantMessage(question, answer, canSave) {
    const message = appendMessage("assistant", answer);
    const actions = createElement("div", "elo-message-actions");

    if (canSave) {
      const saveQuestion = createElement("span", "elo-privacy", "Deseja guardar isso para eu lembrar depois?");
      message.appendChild(saveQuestion);
      const saveButton = createElement("button", "elo-inline-button", "Guardar");
      const dontSaveButton = createElement("button", "elo-inline-button", "Não guardar");
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
      actions.appendChild(saveButton);
      actions.appendChild(dontSaveButton);
    }

    const feedbackText = createElement("span", "elo-privacy", "Essa resposta ajudou?");
    const yesButton = createElement("button", "elo-inline-button", "Sim");
    const noButton = createElement("button", "elo-inline-button", "Não");
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

    message.appendChild(feedbackText);
    actions.appendChild(yesButton);
    actions.appendChild(noButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
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

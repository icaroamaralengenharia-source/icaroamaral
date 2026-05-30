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
    const currentMemory = getMemory();
    const memory = normalizeMemory(null);
    memory.isOpen = getWidgetState();
    memory.personalMemories = currentMemory.personalMemories || [];
    memory.libraryItems = currentMemory.libraryItems || [];
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
    const details = [
      "Ainda não estou conectado ao clima real, mas posso te ajudar a começar o dia.",
      "Você pode continuar gerando relatórios, abrir o RDO, revisar materiais ou consultar sua Biblioteca."
    ];

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
    footer.appendChild(createElement("p", "elo-privacy", "A Biblioteca do Elo fica salva apenas neste navegador."));
    footer.appendChild(createElement("p", "elo-privacy", "As perguntas ficam salvas apenas neste navegador."));
    footer.appendChild(createElement("p", "elo-privacy", "As memórias pessoais ficam salvas apenas neste navegador."));

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
    const libraryButton = createElement("button", "elo-inline-button", "Biblioteca");
    libraryButton.type = "button";
    libraryButton.addEventListener("click", showLibrary);
    container.appendChild(libraryButton);
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

    const personalMemoryCandidate = detectPersonalMemory(cleanQuestion);
    if (personalMemoryCandidate && personalMemoryCandidate.blocked) {
      const blockedAnswer = "Por segurança, não vou guardar esse tipo de informação.";
      appendAssistantMessage(cleanQuestion, blockedAnswer, false);
      saveConversation(cleanQuestion, blockedAnswer);
      return;
    }

    if (personalMemoryCandidate) {
      appendPersonalMemoryPrompt(cleanQuestion, personalMemoryCandidate);
      saveConversation(cleanQuestion, "O Elo perguntou se deve guardar uma memória pessoal.");
      return;
    }

    const response = buildResponse(cleanQuestion);
    const answer = formatResponse(response);
    appendAssistantMessage(cleanQuestion, answer, response.canSave !== false, response);
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
      message.appendChild(webNotice);
      message.appendChild(webActions);
    }

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
      const libraryQuestion = createElement("span", "elo-privacy", "Deseja guardar isso na Biblioteca do Elo?");
      const libraryButton = createElement("button", "elo-inline-button", "Guardar na Biblioteca");
      const dontSaveLibraryButton = createElement("button", "elo-inline-button", "NÃ£o guardar na Biblioteca");
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

  function appendCategoryOptions(select, includeAll) {
    if (includeAll) {
      select.appendChild(createElement("option", "", "Todas"));
    }
    ELO_LIBRARY_CATEGORIES.forEach(function (category) {
      select.appendChild(createElement("option", "", category));
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

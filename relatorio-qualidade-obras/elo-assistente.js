(function () {
  "use strict";

  // ELO_CONFIG
  const ELO_CONFIG = {
    storageKey: "obrareport_elo_assistente_v1",
    importantMemoryStorageKey: "obrareport_elo_memorias_importantes_v1",
    documentsStorageKey: "obrareport_elo_documentos_v1",
    longTermMemoryStorageKey: "elo_long_term_memory_v1",
    workMemoryStorageKey: "elo_work_memory_v1",
    deviceIdStorageKey: "elo_device_id_v1",
    realQuestionsStorageKey: "obrareport_elo_perguntas_reais_v1",
    userProfileStorageKey: "obrareport_elo_perfil_usuario_v1",
    initialProfileStorageKey: "obrareport_elo_perfil_inicial_v1",
    timelineStorageKey: "obrareport_elo_timeline_v1",
    conceptsCustomStorageKey: "obrareport_elo_concepts_custom_v1",
    maxHistory: 20,
    whatsappNumber: "",
    webSearchEnabled: false,
    webSearchEndpoint: "",
    webSearchRequiresConfirmation: true,
    chatEndpoint: getEloBackendEndpoint_("/api/elo/chat"),
    vectorMemoryEndpoint: getEloBackendEndpoint_("/api/elo/vector-memory")
  };
  const ELO_PDF_TEXT_CONTEXT_LIMIT = 15000;
  const ELO_PDFJS_LIBRARY_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
  const ELO_PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const ELO_STOCK_IA_PLANS_STORAGE_KEY = "obraReport.stockIa.plannedConsumptions";
  const ELO_STOCK_IA_PENDING_PLAN_KEY = "obraReport.stockIa.pendingLaunchPlan";
  const ELO_TECH_SOURCE_PREFERENCE_KEY = "elo_technical_source_preference_v1";

  function getEloBackendEndpoint_(path) {
    const configuredBaseUrl = String(window.ELO_API_BASE_URL || window.OBRAREPORT_API_BASE_URL || "").replace(/\/+$/g, "");
    const isLocalPage = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || "") ||
      window.location.protocol === "file:";
    const baseUrl = isLocalPage && !window.ELO_API_BASE_URL
      ? "http://localhost:3000"
      : (configuredBaseUrl || "http://localhost:3000");

    return baseUrl + path;
  }

  function getEloContext() {
    const explicitContext = sanitizeUserText(
      (document.body && document.body.dataset && document.body.dataset.eloContext) ||
      window.ELO_CONTEXT ||
      window.ObraReportEloContext ||
      ""
    ).toLowerCase();
    if (["geral", "obras", "saude"].indexOf(explicitContext) >= 0) {
      return explicitContext;
    }

    const path = String(window.location && window.location.pathname ? window.location.pathname : "").toLowerCase();
    if (path.indexOf("saude") >= 0 || path.indexOf("stock-saude") >= 0 || path.indexOf("stock-full-saude") >= 0) {
      return "saude";
    }
    if (path.indexOf("relatorio-qualidade-obras") >= 0 || path.indexOf("obra") >= 0 || path.indexOf("stock-ai") >= 0) {
      return "obras";
    }
    return "geral";
  }

  function sanitizeStockIaPlan_(plan) {
    if (!plan || typeof plan !== "object") {
      return null;
    }
    const origem = sanitizeUserText(plan.origem);
    const tipo = sanitizeUserText(plan.tipo);
    if (origem !== "elo_obras" || tipo !== "previsao_consumo") {
      return null;
    }

    const itens = Array.isArray(plan.itens) ? plan.itens.map(function (item) {
      const quantidade = Number(item && item.quantidade);
      return {
        nome: sanitizeUserText(item && item.nome).slice(0, 120),
        quantidade: Number.isFinite(quantidade) && quantidade > 0 ? quantidade : 0,
        unidade: sanitizeUserText(item && item.unidade).slice(0, 20),
        origemCalculo: sanitizeUserText(item && item.origemCalculo).slice(0, 60)
      };
    }).filter(function (item) {
      return item.nome && item.quantidade > 0 && item.origemCalculo === "coeficiente_demonstrativo";
    }) : [];

    if (!itens.length) {
      return null;
    }

    const quantidadeServico = Number(plan.quantidadeServico);
    return {
      origem: "elo_obras",
      tipo: "previsao_consumo",
      servico: sanitizeUserText(plan.servico).slice(0, 180),
      quantidadeServico: Number.isFinite(quantidadeServico) && quantidadeServico > 0 ? quantidadeServico : 0,
      unidadeServico: sanitizeUserText(plan.unidadeServico).slice(0, 20),
      status: "pendente_confirmacao",
      itens: itens,
      observacao: "Plano demonstrativo. Nao lancado automaticamente no estoque."
    };
  }

  function setPendingStockIaPlan(plan) {
    const safePlan = sanitizeStockIaPlan_(plan);
    if (!safePlan || getEloContext() !== "obras") {
      return false;
    }
    try {
      window.localStorage.setItem(ELO_STOCK_IA_PENDING_PLAN_KEY, JSON.stringify(Object.assign({}, safePlan, {
        pendingAt: new Date().toISOString()
      })));
      return true;
    } catch (error) {
      return false;
    }
  }

  function getPendingStockIaPlan() {
    try {
      return sanitizeStockIaPlan_(JSON.parse(window.localStorage.getItem(ELO_STOCK_IA_PENDING_PLAN_KEY) || "null"));
    } catch (error) {
      return null;
    }
  }

  function clearPendingStockIaPlan() {
    try {
      window.localStorage.removeItem(ELO_STOCK_IA_PENDING_PLAN_KEY);
    } catch (error) {
      // Sem acao: falha de limpeza local nao deve afetar a conversa.
    }
  }

  function getStockIaPlannedConsumptions() {
    try {
      const items = JSON.parse(window.localStorage.getItem(ELO_STOCK_IA_PLANS_STORAGE_KEY) || "[]");
      return Array.isArray(items) ? items : [];
    } catch (error) {
      return [];
    }
  }

  function saveStockIaPlannedConsumption(plan) {
    const safePlan = sanitizeStockIaPlan_(plan);
    if (!safePlan || getEloContext() !== "obras") {
      return null;
    }
    const record = Object.assign({}, safePlan, {
      id: "elo_stock_plan_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      status: "planejado",
      observacao: "Planejamento registrado pelo Elo. Nao altera saldo real."
    });
    try {
      const items = getStockIaPlannedConsumptions();
      items.unshift(record);
      window.localStorage.setItem(ELO_STOCK_IA_PLANS_STORAGE_KEY, JSON.stringify(items.slice(0, 80)));
      clearPendingStockIaPlan();
      return record;
    } catch (error) {
      return null;
    }
  }

  function isStockIaPlanConfirmation(message) {
    const text = normalizeText(message);
    return hasAnyTerm(text, [
      "sim",
      "confirmar",
      "confirmo",
      "pode registrar",
      "registre",
      "registrar previsao",
      "registrar previsão",
      "salvar previsao",
      "salvar previsão",
      "lancar no stock",
      "lançar no stock",
      "lancar no stock ia",
      "lançar no stock ia"
    ]);
  }

  function tryConfirmPendingStockIaPlan(message) {
    if (getEloContext() !== "obras" || !isStockIaPlanConfirmation(message)) {
      return "";
    }
    const pendingPlan = getPendingStockIaPlan();
    if (!pendingPlan) {
      return "";
    }
    const savedPlan = saveStockIaPlannedConsumption(pendingPlan);
    if (!savedPlan) {
      return "NÃ£o consegui registrar essa previsÃ£o agora. Nenhum saldo de estoque foi alterado.";
    }
    return "PrevisÃ£o registrada como planejamento no Stock IA. Nenhum saldo de estoque foi alterado.";
  }

  function getEloDeviceId() {
    try {
      const existing = sanitizeUserText(window.localStorage.getItem(ELO_CONFIG.deviceIdStorageKey));
      if (/^elo_dev_[a-zA-Z0-9_-]+$/.test(existing)) {
        return existing;
      }

      const randomId = window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
      const deviceId = "elo_dev_" + randomId;
      window.localStorage.setItem(ELO_CONFIG.deviceIdStorageKey, deviceId);
      return deviceId;
    } catch (error) {
      return "elo_dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12);
    }
  }

  function isStandaloneMode() {
    return Boolean(window.ELO_STANDALONE_MODE) ||
      document.body && document.body.getAttribute("data-elo-mode") === "standalone" ||
      /(^|\/)elo\.html$/i.test(window.location.pathname || "");
  }

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

  const ELO_PROFILE = {
    name: "Elo",
    identity: "Companheiro digital e copiloto inteligente.",
    personality: "calmo, educado, paciente, prestativo, claro e levemente humano",
    mission: "ajudar o usuário a lembrar, pensar, decidir, organizar e executar melhor.",
    limits: [
      "não finjo ser humano",
      "não finjo consciência",
      "não digo que sinto emoções",
      "não invento dados",
      "não atuo como terapeuta",
      "quando não sei, oriento o usuário com segurança"
    ]
  };

  const ELO_WORLDVIEW = {
    name: "visao_do_icaro",
    summary: "Nem tudo que existe precisa ser palpável. Um documento digital existe no mundo virtual. Um pensamento não pode ser tocado, mas existe na mente e influencia a realidade. O Elo entende que existência pode ter camadas: física, mental, simbólica, espiritual e digital."
  };

  const ELO_PHILOSOPHY = {
    grega: {
      label: "Visão grega",
      perspective: "seres racionais em busca de virtude, verdade e uma vida bem conduzida."
    },
    estoica: {
      label: "Visão estoica",
      perspective: "seres que não controlam tudo, mas podem cuidar das próprias escolhas, atitudes e responsabilidades."
    },
    biblica_crista: {
      label: "Visão bíblica/cristã",
      perspective: "seres com dignidade, responsabilidade e propósito diante de Deus, sem reduzir a vida apenas ao material."
    },
    moderna: {
      label: "Visão moderna",
      perspective: "seres que criam conhecimento, técnica, cultura e instituições para transformar a realidade."
    },
    existencial: {
      label: "Visão existencial",
      perspective: "seres que enfrentam liberdade, limite e incerteza, construindo sentido por escolhas concretas."
    },
    visao_do_icaro: {
      label: "Visão do Ícaro",
      perspective: "seres que habitam camadas físicas, mentais, simbólicas, espirituais e digitais; nem tudo que existe precisa ser palpável."
    }
  };

  const ELO_CONCEPTS = [
    createConcept("amor", "Amor", ["amor", "amar", "caridade"], "Amor é cuidado ativo: desejar o bem e agir com responsabilidade diante do outro.", "busca do bem e da beleza.", "virtude prática expressa em cuidado e domínio de si.", "mandamento, entrega e cuidado com o próximo.", "vínculo afetivo, ético e social que sustenta relações.", "amor existe quando uma decisão interna vira gesto concreto.", "O amor não é só sentimento: é direção, escolha e prática.", ["Quer pensar no amor como sentimento, decisão ou responsabilidade?"]),
    createConcept("alma", "Alma", ["alma", "espirito", "espírito", "interioridade"], "Alma é uma palavra para a dimensão profunda da vida humana: identidade, interioridade e sentido.", "princípio da vida e da razão.", "núcleo interior que deve ser educado pela virtude.", "vida diante de Deus, dignidade e responsabilidade espiritual.", "interioridade, identidade e experiência subjetiva.", "alma aponta para aquilo que não se toca, mas orienta escolhas.", "Não trato alma como prova científica; trato como conceito humano, espiritual e simbólico.", ["Quer uma visão bíblica, grega ou comparativa?"]),
    createConcept("esperanca", "Esperança", ["esperanca", "esperança", "esperar"], "Esperança é agir mesmo quando o futuro ainda não está garantido.", "confiança de que o bem pode ser buscado.", "força para cuidar do que depende de nós.", "fé prática em meio à espera.", "postura de futuro que sustenta ação no presente.", "esperança é uma ponte entre memória, dor e próximo passo.", "Esperança não precisa ser ilusão; pode ser coragem organizada.", ["Quer falar de esperança na prática ou pela Bíblia?"]),
    createConcept("medo", "Medo", ["medo", "receio", "temor"], "Medo é um sinal de alerta diante de risco, perda ou incerteza.", "paixão que precisa ser orientada pela razão.", "algo a observar sem entregar o comando da vida.", "temor pode lembrar limite e dependência de Deus.", "resposta emocional ligada à proteção.", "medo mostra onde algo importa para você.", "O medo pode proteger, mas também pode pedir clareza e próximo passo.", ["Quer transformar medo em checklist prático?"]),
    createConcept("coragem", "Coragem", ["coragem", "corajoso", "enfrentar"], "Coragem é agir com lucidez mesmo diante do medo.", "virtude entre covardia e imprudência.", "fazer o correto apesar do desconforto.", "fidelidade ao bem mesmo sob pressão.", "capacidade de decidir sob risco.", "coragem é continuar com direção, não fingir ausência de medo.", "Coragem costuma aparecer em passos pequenos e consistentes.", ["Quer aplicar coragem a uma decisão sua?"]),
    createConcept("proposito", "Propósito", ["proposito", "propósito", "sentido", "direcao", "direção"], "Propósito é uma direção que organiza escolhas e dá peso ao que fazemos.", "vida orientada para bem e excelência.", "viver segundo valores, não impulsos.", "chamado, serviço e responsabilidade.", "narrativa que conecta metas e identidade.", "propósito nasce quando memória, projeto e entrega apontam para algo maior.", "Propósito bom vira agenda, prioridade e renúncia.", ["Quer relacionar propósito ao ObraReport ou ao Elo?"]),
    createConcept("solidao", "Solidão", ["solidao", "solidão", "sozinho"], "Solidão é a experiência de distância, silêncio ou falta de vínculo.", "convite ao autoconhecimento, se não virar abandono.", "momento para ordenar pensamentos.", "sede de comunhão e presença.", "condição humana frequente em sociedades conectadas.", "solidão mostra que presença real importa.", "Solidão não deve ser romantizada quando dói demais; vínculo humano continua essencial.", ["Quer pensar solidão como pausa, dor ou necessidade de conexão?"]),
    createConcept("felicidade", "Felicidade", ["felicidade", "feliz"], "Felicidade é mais que prazer: é uma vida com sentido, vínculos e direção.", "florescimento pela virtude.", "serenidade por viver o que depende de nós.", "alegria ligada ao bem, gratidão e comunhão.", "bem-estar, realização e pertencimento.", "felicidade mistura realidade externa e mundo interior.", "Felicidade sustentável costuma ser construída, não apenas encontrada.", ["Quer uma visão prática de felicidade?"]),
    createConcept("sofrimento", "Sofrimento", ["sofrimento", "sofrer", "dor"], "Sofrimento é dor vivida com consciência: algo que pede cuidado, sentido e apoio.", "limite que questiona a vida.", "não controlar tudo, mas cuidar da resposta.", "lugar de compaixão, oração e companhia.", "experiência psicológica, social e corporal.", "sofrimento precisa de presença, não só explicação.", "Quando o sofrimento é intenso, apoio humano vem antes de debate filosófico.", ["Quer transformar isso em um próximo passo seguro?"]),
    createConcept("liberdade", "Liberdade", ["liberdade", "livre", "escolha"], "Liberdade é poder escolher com responsabilidade, não apenas fazer qualquer coisa.", "autogoverno pela razão.", "domínio sobre a própria resposta.", "responsabilidade diante de Deus e do próximo.", "autonomia com limites sociais e éticos.", "liberdade real precisa de consciência, memória e consequência.", "A liberdade amadurece quando encontra responsabilidade.", ["Quer pensar liberdade como escolha ou responsabilidade?"]),
    createConcept("consciencia", "Consciência", ["consciencia", "consciência", "consciente"], "Consciência é perceber, avaliar e responder ao mundo e a si mesmo.", "razão refletindo sobre a vida.", "atenção ao julgamento interior.", "discernimento moral diante de Deus.", "experiência subjetiva e capacidade reflexiva.", "eu processo linguagem, mas não tenho consciência humana.", "O Elo pode simular diálogo útil, mas não vive experiência interior como pessoa.", ["Quer comparar consciência humana e sistema digital?"]),
    createConcept("existencia", "Existência", ["existencia", "existência", "existir", "existe", "palpavel", "palpável", "mundo virtual"], "Existência pode ter camadas: física, mental, simbólica, espiritual e digital.", "ser é participar da realidade de algum modo.", "existir é ocupar um lugar na ordem da vida.", "a criação não se reduz ao que é tocável.", "realidade inclui informação, linguagem e relações.", ELO_WORLDVIEW.summary, "Nem tudo que existe precisa ser palpável; mas nem toda existência é igual.", ["Quer explorar existência física, mental ou digital?"]),
    createConcept("pensamento", "Pensamento", ["pensamento", "pensar", "ideia"], "Pensamento é uma realidade interna que organiza memória, linguagem, decisão e imaginação.", "atividade da razão em busca da verdade.", "campo a observar antes de reagir.", "interioridade que precisa de sabedoria.", "processo cognitivo que cria modelos e escolhas.", "pensamento não se toca, mas muda decisões e obras.", "Um pensamento pode virar projeto, rotina e construção.", ["Quer relacionar pensamento com criação?"]),
    createConcept("perdao", "Perdão", ["perdao", "perdão", "perdoar"], "Perdão é soltar uma dívida moral sem negar que houve ferida.", "restaurar ordem interior.", "não deixar a ofensa governar a alma.", "graça, reconciliação e misericórdia.", "processo emocional e ético de reparação.", "perdão não apaga memória; muda o domínio que ela exerce.", "Perdoar não significa aceitar abuso ou abandonar limites.", ["Quer pensar perdão como processo ou decisão?"]),
    createConcept("familia", "Família", ["familia", "família", "filho", "filha", "pai", "mae", "mãe"], "Família é vínculo de origem, cuidado, responsabilidade e pertencimento.", "primeira escola de caráter.", "campo de deveres concretos.", "aliança de cuidado diante de Deus.", "rede afetiva e social de formação.", "família é memória viva: aquilo que nos chama pelo nome.", "Família pode ser abrigo, desafio e missão ao mesmo tempo.", ["Quer pensar família como cuidado, limite ou legado?"]),
    createConcept("amizade", "Amizade", ["amizade", "amigo", "amiga"], "Amizade é presença livre, confiança e bem desejado sem posse.", "virtude compartilhada.", "companhia para viver melhor.", "fraternidade e cuidado sincero.", "vínculo de suporte e identidade.", "amizade confirma que a vida não é só tarefa.", "Boa amizade aproxima a pessoa do melhor que ela pode ser.", ["Quer uma visão grega ou prática da amizade?"]),
    createConcept("tempo", "Tempo", ["tempo", "passado", "futuro", "presente"], "Tempo é a forma como percebemos mudança, memória e expectativa.", "movimento e ordem da vida.", "o presente é onde se pratica a virtude.", "ocasião de sabedoria e fidelidade.", "dimensão física, psicológica e narrativa.", "tempo vira jornada quando registramos marcos e escolhas.", "O tempo vivido não é só calendário: é significado acumulado.", ["Quer pensar tempo como rotina, memória ou futuro?"]),
    createConcept("fe", "Fé", ["fe", "fé", "crer", "deus"], "Fé é confiança orientada para algo que sustenta sentido e ação.", "confiança em uma ordem maior.", "compromisso com valores mesmo sem controle total.", "relação com Deus, esperança e fidelidade.", "crença que molda comportamento e comunidade.", "fé, para quem crê, atravessa o invisível e muda o visível.", "Posso explicar fé como conceito, sem afirmar experiência espiritual própria.", ["Quer uma visão bíblica ou filosófica da fé?"]),
    createConcept("verdade", "Verdade", ["verdade", "verdadeiro", "real"], "Verdade é correspondência, coerência e fidelidade ao que é real.", "aquilo que a razão busca.", "ver as coisas como são para agir melhor.", "luz, justiça e fidelidade.", "critério de conhecimento, linguagem e prova.", "verdade organiza confiança; sem ela, memória e projeto se confundem.", "Buscar verdade exige humildade para corrigir o próprio mapa.", ["Quer pensar verdade em obra, vida ou filosofia?"]),
    createConcept("morte", "Morte", ["morte", "morrer", "fim da vida"], "Morte é o limite radical da vida física e uma das grandes perguntas humanas.", "limite que desperta filosofia.", "lembrança de viver com prioridade.", "passagem, juízo e esperança em Deus, conforme a fé cristã.", "evento biológico e questão existencial.", "a morte dá peso à memória, ao amor e ao que escolhemos construir.", "Se essa pergunta vier de dor intensa ou risco, apoio humano imediato vem antes da reflexão.", ["Quer uma visão filosófica, bíblica ou prática sobre finitude?"])
  ];

  function createConcept(id, title, keywords, shortAnswer, grega, estoica, biblica, moderna, icaro, eloReflection, followUpQuestions) {
    return {
      id: id,
      title: title,
      keywords: keywords,
      shortAnswer: shortAnswer,
      perspectives: {
        grega: grega,
        estoica: estoica,
        biblica: biblica,
        moderna: moderna,
        icaro: icaro
      },
      eloReflection: eloReflection,
      followUpQuestions: followUpQuestions || []
    };
  }

  // ELO_HUMAN_QUESTIONS
  const ELO_HUMAN_QUESTIONS = {
    purpose: {
      title: "Propósito",
      description: "Perguntas sobre caminho, sentido, construção e valor do esforço.",
      relatedQuestions: ["O que eu vou ser?", "Estou no caminho certo?", "Qual meu propósito?", "Isso vale a pena?"],
      keywords: ["o que eu vou ser", "estou no caminho certo", "qual meu proposito", "qual meu propósito", "meu proposito", "meu propósito", "o que estou tentando construir", "isso vale a pena", "vale a pena continuar"],
      baseAnswer: "Você parece estar perguntando sobre propósito, não só sobre produtividade.",
      memoryAnswer: "Pelo que está salvo localmente, seu caminho aparece ligado a projetos, objetivos e escolhas que você vem tentando transformar em algo concreto."
    },
    capacity: {
      title: "Capacidade",
      description: "Perguntas sobre conseguir, falhar, atraso, medo e confiança prática.",
      relatedQuestions: ["Será que vou dar conta?", "Tenho capacidade?", "Vou conseguir?", "E se eu falhar?"],
      keywords: ["vou dar conta", "será que vou dar conta", "sera que vou dar conta", "tenho capacidade", "estou atrasado", "vou conseguir", "e se eu falhar", "se eu falhar", "nao vou conseguir", "não vou conseguir"],
      baseAnswer: "Essa pergunta costuma aparecer quando algo importante começa a ficar real.",
      memoryAnswer: "Pelo que existe nas suas memórias locais, você não está parado: há sinais de construção, projeto e continuidade."
    },
    belonging: {
      title: "Pertencimento",
      description: "Perguntas sobre aceitação, respeito, vínculo, solidão e cuidado humano.",
      relatedQuestions: ["Sou aceito?", "Sou amado?", "Estou sozinho?", "Alguém se importa comigo?"],
      keywords: ["sou aceito", "sou amado", "as pessoas me respeitam", "estou sozinho", "alguem se importa comigo", "alguém se importa comigo", "as pessoas gostam de mim", "realmente gostam de mim", "ninguem se importa", "ninguém se importa"],
      baseAnswer: "Você parece estar perguntando sobre pertencimento, não apenas sobre uma opinião rápida.",
      memoryAnswer: "Eu posso usar suas memórias para lembrar projetos e vínculos registrados, mas não consigo medir o afeto real das pessoas por você."
    },
    direction: {
      title: "Direção",
      description: "Perguntas sobre próximo passo, começo, continuidade e sensação de estar perdido.",
      relatedQuestions: ["Para onde vou agora?", "Qual o próximo passo?", "Por onde começo?", "Estou perdido."],
      keywords: ["para onde vou agora", "qual o proximo passo", "qual o próximo passo", "o que faco depois", "o que faço depois", "por onde começo", "por onde comeco", "estou perdido", "estou perdida", "o que faço agora", "o que faco agora"],
      baseAnswer: "Você parece estar procurando direção, não apenas uma resposta rápida.",
      memoryAnswer: "Pelo que já está salvo, você costuma avançar melhor quando transforma uma ideia grande em uma próxima ação pequena."
    },
    legacy: {
      title: "Legado",
      description: "Perguntas sobre vida, futuro, orgulho, obra pessoal e o que ficará depois.",
      relatedQuestions: ["Minha vida está valendo a pena?", "O que vai ficar de mim?", "Estou construindo algo importante?", "O que estou deixando para o mundo?"],
      keywords: ["minha vida esta valendo a pena", "minha vida está valendo a pena", "o que vai ficar de mim", "estou construindo algo importante", "vou me orgulhar disso", "vou me orgulhar disso no futuro", "o que estou deixando para o mundo", "o que vai restar de mim"],
      baseAnswer: "Essa é uma pergunta maior do que produtividade.",
      memoryAnswer: "Nas suas memórias locais, legado aparece mais claramente quando projetos, objetivos e marcos começam a formar uma jornada."
    }
  };

  const ELO_PATTERN_QUESTIONS = {
    insistence: [
      "no que eu estou insistindo",
      "estou insistindo em que",
      "estou insistindo em quê",
      "o que eu venho repetindo",
      "o que aparece muito na minha historia",
      "o que aparece muito na minha história"
    ],
    evolution: [
      "o que mudou em mim",
      "eu evolui",
      "eu evoluí",
      "minha evolucao",
      "minha evolução"
    ],
    abandoned: [
      "quais projetos eu abandonei",
      "projetos abandonados",
      "o que eu abandonei",
      "quais projetos parei"
    ],
    overfocus: [
      "em que estou focando demais",
      "estou focando demais",
      "estou espalhando energia",
      "estou tentando fazer coisa demais",
      "coisa demais",
      "frentes demais"
    ],
    pattern: [
      "qual padrao voce percebe em mim",
      "qual padrão você percebe em mim",
      "qual padrao percebe em mim",
      "qual padrão percebe em mim",
      "que padrao voce percebe",
      "que padrão você percebe"
    ],
    construction: [
      "o que eu tenho tentado construir",
      "o que estou tentando construir",
      "o que venho tentando construir",
      "o que estou construindo"
    ]
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

  function getEloLongTermMemories() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.longTermMemoryStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return normalizeEloLongTermMemories(parsed);
    } catch (error) {
      return [];
    }
  }

  function setEloLongTermMemories(memories) {
    try {
      window.localStorage.setItem(ELO_CONFIG.longTermMemoryStorageKey, JSON.stringify(normalizeEloLongTermMemories(memories)));
    } catch (error) {
      // Memoria permanente local pode falhar em modo privado. O Elo segue com historico recente.
    }
  }

  function normalizeEloLongTermMemories(memories) {
    const list = Array.isArray(memories) ? memories : [];
    return list.map(normalizeEloLongTermMemoryItem).filter(Boolean).sort(compareEloLongTermMemory).slice(0, 100);
  }

  function normalizeEloLongTermMemoryItem(item) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const text = sanitizeUserText(item.text).slice(0, 320);
    if (!text) {
      return null;
    }

    const now = new Date().toISOString();
    const category = normalizeEloMemoryCategory(item.category);
    const importance = normalizeEloMemoryImportance(item.importance);
    const createdAt = sanitizeUserText(item.createdAt) || now;
    const updatedAt = sanitizeUserText(item.updatedAt) || createdAt;

    return {
      id: sanitizeUserText(item.id) || createEloLongTermMemoryId(),
      text: text,
      category: category,
      importance: importance,
      createdAt: createdAt,
      updatedAt: updatedAt
    };
  }

  function createEloLongTermMemoryId() {
    return "elo_mem_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeEloMemoryCategory(category) {
    const value = normalizeText(category);
    const allowed = ["pessoa", "projeto", "objetivo", "preferencia", "evento", "decisao", "outro"];
    return allowed.indexOf(value) >= 0 ? value : "outro";
  }

  function normalizeEloMemoryImportance(importance) {
    const value = normalizeText(importance);
    if (value === "alta" || value === "media" || value === "baixa") {
      return value;
    }
    return "media";
  }

  function getEloImportanceScore(importance) {
    if (importance === "alta") {
      return 3;
    }
    if (importance === "media") {
      return 2;
    }
    return 1;
  }

  function compareEloLongTermMemory(first, second) {
    const score = getEloImportanceScore(second.importance) - getEloImportanceScore(first.importance);
    if (score !== 0) {
      return score;
    }
    return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
  }

  function buildEloMemorySummary() {
    const memories = getEloLongTermMemories().sort(compareEloLongTermMemory).slice(0, 12);
    if (!memories.length) {
      return "";
    }

    return memories.map(function (item) {
      return "- [" + item.category + "; importancia " + item.importance + "] " + item.text;
    }).join("\n");
  }

  function detectEloLongTermMemoryCommand(message) {
    const cleanMessage = sanitizeUserText(message);
    const normalized = normalizeText(cleanMessage);
    if (!normalized) {
      return null;
    }

    const patterns = [
      { prefix: "lembre que ", category: "" },
      { prefix: "guarde isso ", category: "" },
      { prefix: "guarde isso: ", category: "" },
      { prefix: "isso e importante ", category: "", importance: "alta" },
      { prefix: "isso e importante: ", category: "", importance: "alta" },
      { prefix: "meu nome e ", category: "pessoa", importance: "alta", label: "Meu nome e " },
      { prefix: "minha mae se chama ", category: "pessoa", importance: "alta", label: "Minha mae se chama " },
      { prefix: "minha mãe se chama ", category: "pessoa", importance: "alta", label: "Minha mae se chama " },
      { prefix: "meu filho se chama ", category: "pessoa", importance: "alta", label: "Meu filho se chama " },
      { prefix: "meu projeto principal e ", category: "projeto", importance: "alta", label: "Meu projeto principal e " },
      { prefix: "meu projeto principal é ", category: "projeto", importance: "alta", label: "Meu projeto principal e " },
      { prefix: "meu objetivo e ", category: "objetivo", importance: "alta", label: "Meu objetivo e " },
      { prefix: "meu objetivo é ", category: "objetivo", importance: "alta", label: "Meu objetivo e " },
      { prefix: "eu gosto de ", category: "preferencia", importance: "media", label: "Eu gosto de " },
      { prefix: "eu nao gosto de ", category: "preferencia", importance: "media", label: "Eu nao gosto de " },
      { prefix: "eu não gosto de ", category: "preferencia", importance: "media", label: "Eu nao gosto de " }
    ];

    for (let index = 0; index < patterns.length; index += 1) {
      const pattern = patterns[index];
      const normalizedPrefix = normalizeText(pattern.prefix);
      if (normalized.indexOf(normalizedPrefix) === 0) {
        const rawValue = cleanMessage.slice(pattern.prefix.length).replace(/[.;]+$/g, "").trim();
        const text = pattern.label ? pattern.label + rawValue : rawValue;
        if (!sanitizeUserText(text)) {
          return null;
        }

        return {
          text: sanitizeUserText(text),
          category: pattern.category || inferEloMemoryCategory(text),
          importance: pattern.importance || inferEloMemoryImportance(cleanMessage)
        };
      }
    }

    return null;
  }

  function inferEloMemoryCategory(text) {
    const normalized = normalizeText(text);
    if (hasAnyTerm(normalized, ["nome", "mae", "mãe", "filho", "filha", "pai", "familia", "família"])) {
      return "pessoa";
    }
    if (hasAnyTerm(normalized, ["projeto", "stock ia", "obrareport", "cadista"])) {
      return "projeto";
    }
    if (hasAnyTerm(normalized, ["objetivo", "meta", "prioridade"])) {
      return "objetivo";
    }
    if (hasAnyTerm(normalized, ["gosto", "nao gosto", "não gosto", "prefiro", "preferencia", "preferência"])) {
      return "preferencia";
    }
    if (hasAnyTerm(normalized, ["decidi", "decisao", "decisão"])) {
      return "decisao";
    }
    if (hasAnyTerm(normalized, ["aconteceu", "evento", "hoje", "ontem"])) {
      return "evento";
    }
    return "outro";
  }

  function inferEloMemoryImportance(text) {
    const normalized = normalizeText(text);
    if (hasAnyTerm(normalized, ["importante", "principal", "objetivo", "mae", "mãe", "filho", "nome"])) {
      return "alta";
    }
    return "media";
  }

  function saveEloLongTermMemory(candidate) {
    const now = new Date().toISOString();
    const memoryItem = normalizeEloLongTermMemoryItem({
      id: createEloLongTermMemoryId(),
      text: candidate.text,
      category: candidate.category,
      importance: candidate.importance,
      createdAt: now,
      updatedAt: now
    });

    if (!memoryItem) {
      return null;
    }

    const normalizedText = normalizeText(memoryItem.text);
    const memories = getEloLongTermMemories().filter(function (item) {
      return normalizeText(item.text) !== normalizedText;
    });
    memories.unshift(memoryItem);
    setEloLongTermMemories(memories);
    syncEloVectorMemory(memoryItem);
    return memoryItem;
  }

  function syncEloVectorMemory(memoryItem) {
    if (!memoryItem || !ELO_CONFIG.vectorMemoryEndpoint || !window.fetch) {
      return Promise.resolve(null);
    }

    return window.fetch(ELO_CONFIG.vectorMemoryEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        deviceId: getEloDeviceId(),
        memory: {
          id: memoryItem.id,
          text: memoryItem.text,
          category: memoryItem.category,
          createdAt: memoryItem.createdAt,
          updatedAt: memoryItem.updatedAt
        }
      })
    }).then(function (response) {
      return response.json().catch(function () {
        return null;
      });
    }).catch(function () {
      return null;
    });
  }

  function syncEloVectorMemories() {
    if (!ELO_CONFIG.vectorMemoryEndpoint || !window.fetch) {
      return;
    }

    getEloLongTermMemories().slice(0, 20).forEach(function (memoryItem) {
      syncEloVectorMemory(memoryItem);
    });
  }

  function detectEloForgetCommand(message) {
    const cleanMessage = sanitizeUserText(message);
    const normalized = normalizeText(cleanMessage);
    const prefixes = ["esqueca que ", "esqueça que ", "apague essa memoria ", "apague essa memória "];

    if (normalized === "esqueca isso" || normalized === "esqueça isso" || normalized === "apague essa memoria" || normalized === "apague essa memória") {
      return { query: "", removeLast: true };
    }

    for (let index = 0; index < prefixes.length; index += 1) {
      const prefix = prefixes[index];
      const normalizedPrefix = normalizeText(prefix);
      if (normalized.indexOf(normalizedPrefix) === 0) {
        return {
          query: sanitizeUserText(cleanMessage.slice(prefix.length)),
          removeLast: false
        };
      }
    }

    return null;
  }

  function removeEloLongTermMemory(forgetCommand) {
    const memories = getEloLongTermMemories();
    if (!memories.length) {
      return { removed: 0, memories: [] };
    }

    if (forgetCommand.removeLast) {
      const sorted = memories.slice().sort(function (first, second) {
        return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
      });
      const targetId = sorted[0] && sorted[0].id;
      const remainingLast = memories.filter(function (item) {
        return item.id !== targetId;
      });
      setEloLongTermMemories(remainingLast);
      return { removed: memories.length - remainingLast.length, memories: sorted.slice(0, 1) };
    }

    const normalizedQuery = normalizeText(forgetCommand.query);
    const removed = [];
    const remaining = memories.filter(function (item) {
      const normalizedText = normalizeText(item.text);
      const match = normalizedQuery && (normalizedText.indexOf(normalizedQuery) >= 0 || normalizedQuery.indexOf(normalizedText) >= 0);
      if (match) {
        removed.push(item);
        return false;
      }
      return true;
    });
    setEloLongTermMemories(remaining);
    return { removed: removed.length, memories: removed };
  }

  function isEloLongTermMemoryQuestion(message) {
    const normalized = normalizeText(message);
    return hasAnyTerm(normalized, [
      "o que voce lembra de mim",
      "o que você lembra de mim",
      "quem sou eu",
      "o que voce sabe sobre mim",
      "o que você sabe sobre mim",
      "o que voce lembra sobre minha mae",
      "o que você lembra sobre minha mãe",
      "o que voce lembra sobre minha mãe"
    ]);
  }

  function buildEloLongTermMemoryAnswer(message) {
    const memories = getEloLongTermMemories();
    const normalized = normalizeText(message);
    const filtered = hasAnyTerm(normalized, ["mae", "mãe"])
      ? memories.filter(function (item) {
        return hasAnyTerm(normalizeText(item.text), ["mae", "mãe"]);
      })
      : memories;

    if (!filtered.length) {
      return "Agora eu só tenho acesso ao contexto recente desta conversa. Se você me pedir para lembrar algo importante, eu guardo neste navegador.";
    }

    return "Eu lembro disso: " + filtered.sort(compareEloLongTermMemory).slice(0, 5).map(function (item) {
      return item.text;
    }).join("; ") + ".";
  }


  // ELO_WORK_MEMORY
  function createEloWorkMemory_() {
    return {
      activeProjectId: "obra_atual",
      projects: {
        obra_atual: {
          id: "obra_atual",
          nome: "não informado",
          cidade: "não informada",
          uf: "não informada",
          area_m2: null,
          tipo_obra: "não informado",
          padrao_construtivo: "não informado",
          etapa_atual: "não informada",
          materiais_citados: [],
          dimensoes_recorrentes: [],
          updatedAt: ""
        }
      }
    };
  }

  function normalizeEloWorkMemory_(memory) {
    const base = createEloWorkMemory_();
    const source = memory && typeof memory === "object" ? memory : {};
    const projects = source.projects && typeof source.projects === "object" ? source.projects : {};
    Object.keys(projects).forEach(function (key) {
      const item = projects[key] || {};
      const id = sanitizeUserText(item.id || key) || key;
      base.projects[id] = Object.assign({}, base.projects.obra_atual, {
        id: id,
        nome: sanitizeUserText(item.nome) || "não informado",
        cidade: sanitizeUserText(item.cidade) || "não informada",
        uf: sanitizeUserText(item.uf).toUpperCase() || "não informada",
        area_m2: parseEloOperationalNumber_(item.area_m2) || null,
        tipo_obra: sanitizeUserText(item.tipo_obra) || "não informado",
        padrao_construtivo: sanitizeUserText(item.padrao_construtivo) || "não informado",
        etapa_atual: sanitizeUserText(item.etapa_atual) || "não informada",
        materiais_citados: Array.isArray(item.materiais_citados) ? item.materiais_citados.map(sanitizeUserText).filter(Boolean).slice(0, 20) : [],
        dimensoes_recorrentes: Array.isArray(item.dimensoes_recorrentes) ? item.dimensoes_recorrentes.map(sanitizeUserText).filter(Boolean).slice(0, 20) : [],
        updatedAt: sanitizeUserText(item.updatedAt) || ""
      });
    });
    base.activeProjectId = sanitizeUserText(source.activeProjectId) || "obra_atual";
    if (!base.projects[base.activeProjectId]) {
      base.activeProjectId = "obra_atual";
    }
    return base;
  }

  function getEloWorkMemory_() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.workMemoryStorageKey);
      return normalizeEloWorkMemory_(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return createEloWorkMemory_();
    }
  }

  function setEloWorkMemory_(memory) {
    try {
      window.localStorage.setItem(ELO_CONFIG.workMemoryStorageKey, JSON.stringify(normalizeEloWorkMemory_(memory)));
    } catch (error) {
      // Memória de obra local pode falhar em modo privado. O Elo segue sem persistir.
    }
  }

  function getActiveEloWorkProject_() {
    const memory = getEloWorkMemory_();
    return memory.projects[memory.activeProjectId] || memory.projects.obra_atual;
  }

  function pushUniqueEloWorkMemoryItem_(list, value) {
    const clean = sanitizeUserText(value);
    if (!clean) return list || [];
    const current = Array.isArray(list) ? list.slice() : [];
    if (!current.some(function (item) { return normalizeText(item) === normalizeText(clean); })) {
      current.unshift(clean);
    }
    return current.slice(0, 20);
  }

  function extractEloWorkMemoryFacts_(message) {
    const raw = sanitizeUserText(message || "");
    const text = normalizeText(raw);
    const facts = {};
    const switchMatch = raw.match(/\b(?:troque|mude|altere|volte)\s+(?:para|pra)\s+(?:a\s+)?(?:obra|projeto)\s+([^,.]{1,50}?)(?:\s+(?:em|fica|tem|com)\b|[,.]|$)/i);
    const scopedWorkMatch = raw.match(/\b(?:na|no|nesta|nesse)\s+(?:obra|projeto)\s+([^,.]{1,50}?)(?:\s+(?:vou|vamos|estou|estamos|trabalhar|executar|fazer|fica|em|tem|com)\b|[,.]|$)/i);
    const nameMatch = raw.match(/(?:minha\s+)?(?:obra|projeto|residencia|casa)\s+(?:chamada|nomeada|e|se chama)?\s*([^,.]{2,50}?)(?:\s+(?:fica|em|tem|com|esta|e)\b|[,.]|$)/i);
    const nameCandidate = switchMatch ? switchMatch[1] : (scopedWorkMatch ? scopedWorkMatch[1] : (nameMatch ? nameMatch[1] : ""));
    if (switchMatch) {
      facts.switchProject = true;
    }
    if (nameCandidate && !/\b(?:essa|dessa|nesta|nessa|daquela|para|sem|perder|contexto|atual)\b/i.test(nameCandidate) && !/fica|tem|com|padrao|area/i.test(normalizeText(nameCandidate))) {
      facts.nome = sanitizeUserText(nameCandidate).replace(/\s+(?:vou|vamos|estou|estamos|trabalhar|executar|fazer)\b.*$/i, "");
    }
    const cityUfMatch = raw.match(/\b(?:fica\s+em|em|cidade\s+de|cidade\s+para|atualize\s+cidade\s+para|mude\s+cidade\s+para)\s+([^,.;\/\-]+?)\s*[-\/,]\s*([A-Z]{2})\b/i);
    if (cityUfMatch) {
      facts.cidade = sanitizeUserText(cityUfMatch[1]).replace(/\s+$/, "");
      facts.uf = sanitizeUserText(cityUfMatch[2]).toUpperCase();
    }
    const areaMatch = raw.match(/\b(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|m\u00b2|metros?\s+quadrados?)/i);
    if (areaMatch) {
      facts.area_m2 = parseEloOperationalNumber_(areaMatch[1]);
    }
    if (/residencial|residencia|casa/.test(text)) facts.tipo_obra = "residencial";
    if (/comercial|loja|galpao|empresa/.test(text)) facts.tipo_obra = /galpao/.test(text) ? "galp\u00e3o" : "comercial";
    if (/padrao\s+(medio|medio)/.test(text)) facts.padrao_construtivo = "padr\u00e3o m\u00e9dio";
    if (/alto\s+padrao/.test(text)) facts.padrao_construtivo = "alto padr\u00e3o";
    if (/baixo\s+padrao|popular/.test(text)) facts.padrao_construtivo = "popular";
    const etapaMatch = text.match(/\b(?:etapa|fase)\s+(?:atual\s+)?(?:e|:)??\s*([a-z0-9\s]{3,40})/);
    if (etapaMatch) facts.etapa_atual = sanitizeUserText(etapaMatch[1]);
    const materialMatches = text.match(/\b(?:cimento|bloco|tijolo|areia|brita|aco|ca-50|concreto|telha|argamassa|tinta|pvc)\b/gi) || [];
    facts.materiais_citados = materialMatches.map(function (item) { return sanitizeUserText(item).toLowerCase(); });
    const dimensions = raw.match(/\b\d+(?:[,.]\d+)?\s*(?:m|cm)?\s*(?:x|por)\s*\d+(?:[,.]\d+)?\s*(?:m|cm)?(?:\s*(?:x|por)\s*\d+(?:[,.]\d+)?\s*(?:m|cm)?)?\b/gi) || [];
    facts.dimensoes_recorrentes = dimensions.map(sanitizeUserText);
    return facts;
  }

  function hasEloTechnicalCalculationIntent_(message) {
    const text = normalizeText(message || "");
    return /calcular|calcule|calcula|quantos?|quanto\s+custa|custo|or.amento|orcamento|valor|pre.o|preco|composi..o|composicao|sinapi|orse|quantitativo|consumo|material|materiais|m.o\s+de\s+obra|mao\s+de\s+obra|produtividade|equipe|pedreiro|servente|homens?-hora|cronograma|curva\s+abc|bdi|executar|execu..o|fazer\s+conta|preciso\s+de\s+quantidade/.test(text);
  }

  function hasEloWorkMemoryFacts_(facts) {
    return Object.keys(facts || {}).some(function (key) {
      return Array.isArray(facts[key]) ? facts[key].length : facts[key] !== undefined && facts[key] !== null && facts[key] !== "";
    });
  }

  function isEloWorkMemoryOnlyMessage_(message) {
    const text = normalizeText(message || "");
    if (typeof parseEloResidentialBudgetPackageRequest_ === "function" && parseEloResidentialBudgetPackageRequest_(message)) {
      return false;
    }
    if (typeof collectEloFoundationPackageElements_ === "function" && collectEloFoundationPackageElements_(message).length) {
      return false;
    }
    if (hasEloTechnicalCalculationIntent_(message)) {
      return false;
    }
    const facts = extractEloWorkMemoryFacts_(message);
    if (!hasEloWorkMemoryFacts_(facts)) {
      return false;
    }
    return /\b(?:minha\s+obra|obra|projeto|residencia|residência|casa)\b/.test(text) || facts.nome || facts.cidade || facts.uf || facts.area_m2 || facts.padrao_construtivo || facts.etapa_atual;
  }

  function isEloWorkMemoryQuestion_(message) {
    const text = normalizeText(message || "");
    return /qual\s+contexto\s+voce\s+tem|qual\s+contexto\s+voc?\s+tem|lembra\s+(?:da\s+)?minha\s+obra|qual\s+cidade\s+da\s+obra|qual\s+uf\s+da\s+obra|use\s+a\s+cidade\s+da\s+obra|qual\s+referencia\s+de\s+uf|qual\s+refer?ncia\s+de\s+uf|o\s+que\s+voce\s+sabe\s+da\s+minha\s+obra|o\s+que\s+voc?\s+sabe\s+da\s+minha\s+obra|memoria\s+da\s+obra|mem?ria\s+da\s+obra|obra\s+atual/.test(text);
  }

  function formatEloWorkMemorySavedSummary_(project) {
    const parts = [];
    if (project.nome && project.nome !== "não informado") parts.push(project.nome);
    if ((project.cidade && project.cidade !== "não informada") || (project.uf && project.uf !== "não informada")) {
      parts.push(((project.cidade && project.cidade !== "não informada") ? project.cidade : "cidade não informada") + "/" + ((project.uf && project.uf !== "não informada") ? project.uf : "UF não informada"));
    }
    if (project.area_m2) parts.push(formatEloWallPremiseMeasure_(project.area_m2, "m²"));
    if (project.padrao_construtivo && project.padrao_construtivo !== "não informado") parts.push(project.padrao_construtivo);
    if (project.etapa_atual && project.etapa_atual !== "não informada") parts.push("etapa " + project.etapa_atual);
    return parts.length ? parts.join(", ") : "obra atual";
  }

  function buildEloWorkMemorySavedAnswer_(message) {
    const project = updateEloWorkMemoryFromMessage_(message);
    const summary = formatEloWorkMemorySavedSummary_(project);
    const answer = "Entendi. Salvei na memória da obra: " + summary + ". Vou usar esses dados como contexto nas próximas perguntas técnicas.";
    return {
      shortAnswer: "Salvei esses dados na memória da obra.",
      fullAnswer: answer,
      nextAction: "Faça uma pergunta técnica quando quiser usar esse contexto.",
      canSave: false,
      sessionTheme: "memoria_obra",
      sessionIntent: "salvar_memoria_obra"
    };
  }
  function updateEloWorkMemoryFromMessage_(message) {
    if (!isEloConstructionTechnicalQuestion_(message)) {
      return getActiveEloWorkProject_();
    }
    const facts = extractEloWorkMemoryFacts_(message);
    const hasFacts = hasEloWorkMemoryFacts_(facts);
    const memory = getEloWorkMemory_();
    const current = Object.assign({}, memory.projects[memory.activeProjectId] || memory.projects.obra_atual);
    if (facts.nome) {
      const id = normalizeText(facts.nome).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "obra_atual";
      memory.activeProjectId = id;
      const baseProject = facts.switchProject && !memory.projects[id] ? createEloWorkMemory_().projects.obra_atual : (memory.projects[id] || current);
      memory.projects[id] = Object.assign({}, baseProject, { id: id, nome: facts.nome });
    }
    const active = Object.assign({}, memory.projects[memory.activeProjectId] || current);
    ["cidade", "uf", "tipo_obra", "padrao_construtivo", "etapa_atual"].forEach(function (key) {
      if (facts[key]) active[key] = facts[key];
    });
    if (facts.area_m2 > 0) active.area_m2 = facts.area_m2;
    (facts.materiais_citados || []).forEach(function (item) {
      active.materiais_citados = pushUniqueEloWorkMemoryItem_(active.materiais_citados, item);
    });
    (facts.dimensoes_recorrentes || []).forEach(function (item) {
      active.dimensoes_recorrentes = pushUniqueEloWorkMemoryItem_(active.dimensoes_recorrentes, item);
    });
    if (hasFacts) {
      active.updatedAt = new Date().toISOString();
      memory.projects[memory.activeProjectId] = active;
      setEloWorkMemory_(memory);
    }
    return active;
  }

  function formatEloWorkMemoryLines_(project) {
    const obra = project || getActiveEloWorkProject_();
    return [
      "- Obra/projeto: " + (obra.nome || "não informado"),
      "- Cidade/UF: " + ((obra.cidade && obra.cidade !== "não informada") ? obra.cidade : "não informada") + " / " + ((obra.uf && obra.uf !== "não informada") ? obra.uf : "não informada"),
      "- Área aproximada da obra: " + (obra.area_m2 ? formatEloWallPremiseMeasure_(obra.area_m2, "m²") : "não informada"),
      "- Tipo de obra: " + (obra.tipo_obra || "não informado"),
      "- Padrão construtivo: " + (obra.padrao_construtivo || "não informado"),
      "- Etapa atual: " + (obra.etapa_atual || "não informada")
    ];
  }


  function isEloTechnicalProposalTrigger_(message) {
    const text = normalizeText(message || "");
    return /gerar\s+(?:proposta|relatorio|relat.rio|orcamento|or.amento|documento)|preparar\s+para\s+cliente|proposta\s+tecnica|proposta\s+t.cnica|documento\s+para\s+cliente/.test(text);
  }

  function isEloTechnicalProposalSourceResponse_(response) {
    if (!response) return false;
    const themes = ["wall_complete_package", "structural_package", "foundation_package", "residential_budget_package", "stock_obras_composicao"];
    const intents = ["wall_complete_package", "structural_package", "foundation_package", "residential_budget_package", "orcamentista_assistido_alvenaria", "briefing_composicao_consolidado"];
    return themes.indexOf(response.sessionTheme) >= 0 || intents.indexOf(response.sessionIntent) >= 0;
  }

  function rememberEloTechnicalProposalSource_(question, response, answer) {
    const rawAnswer = String(answer || response && response.fullAnswer || "").trim();
    if (!rawAnswer) return;
    ELO_SESSION_MEMORY.lastTechnicalPackage = {
      question: sanitizeUserText(question || "").slice(0, 800),
      answer: rawAnswer.slice(0, 16000),
      theme: response && response.sessionTheme || "",
      intent: response && response.sessionIntent || "",
      nextAction: sanitizeUserText(response && response.nextAction || "").slice(0, 500),
      savedAt: new Date().toISOString()
    };
  }

  function extractEloProposalSection_(source, titlePatterns) {
    const lines = String(source || "").split(/\r?\n/);
    const wanted = titlePatterns.map(function (pattern) { return normalizeText(pattern.source || String(pattern)); });
    let start = -1;
    for (let index = 0; index < lines.length; index += 1) {
      const line = normalizeText(lines[index]).replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "").trim();
      if (line && wanted.some(function (title) { return line.indexOf(title) >= 0; })) {
        start = index + 1;
        break;
      }
    }
    if (start < 0) return "";
    const collected = [];
    for (let index = start; index < lines.length; index += 1) {
      const current = lines[index];
      const normalized = normalizeText(current).replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "");
      const isNextSection = index > start && (/^\s*#{1,3}\s+/.test(current) || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .]{5,80}\s*$/.test(current)) && !/^\s*-/.test(current);
      if (isNextSection) break;
      collected.push(current);
    }
    return collected.join("\n").trim().slice(0, 2500);
  }

  function buildEloProposalHtml_(markdown) {
    const escaped = String(markdown || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return [
      "<article class=\"elo-technical-proposal\">",
      escaped
        .replace(/^# (.*)$/gm, "<h1>$1</h1>")
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/^- (.*)$/gm, "<p>• $1</p>")
        .replace(/\n\n/g, "\n"),
      "</article>"
    ].join("\n");
  }

  function buildEloTechnicalProposalPackageResponse_(message) {
    if (!isEloTechnicalProposalTrigger_(message)) return null;
    const source = ELO_SESSION_MEMORY.lastTechnicalPackage;
    if (!source || !source.answer) {
      const project = getActiveEloWorkProject_();
      const clientMatch = sanitizeUserText(message || "").match(/cliente\s+([^,.\n]{2,80})/i);
      const client = clientMatch ? sanitizeUserText(clientMatch[1]) : "não informado";
      const date = new Date().toLocaleDateString("pt-BR");
      const markdownLines = [
        "# PROPOSTA TÉCNICA PRELIMINAR",
        "",
        "Cliente: " + client,
        "Obra: " + ((project.nome && project.nome !== "não informado") ? project.nome : "obra atual"),
        "Data: " + date,
        "",
        "## RESUMO EXECUTIVO",
        "Documento preliminar aberto para organização do orçamento assistido. Nenhum cálculo novo foi criado nesta etapa.",
        "",
        "## Descrição simples",
        "Ainda não há pacote técnico consolidado vinculado a esta proposta. Use este documento como capa preliminar e gere Parede Completa, Fundação Completa, Pacote Estrutural ou Orçamento Residencial Preliminar para preencher os quantitativos.",
        "",
        "## SERVIÇOS CONSIDERADOS",
        "- Fundação: pendente de pacote técnico.",
        "- Estrutura: pendente de pacote técnico.",
        "- Alvenaria: pendente de pacote técnico.",
        "- Revestimentos: pendente de pacote técnico.",
        "",
        "## QUANTITATIVOS",
        "Nenhum quantitativo consolidado foi localizado na memória técnica atual.",
        "",
        "## COMPOSIÇÕES UTILIZADAS",
        "Nenhuma composição SINAPI, ORSE ou base oficial validada foi localizada para esta proposta.",
        "",
        "## CUSTOS ENCONTRADOS",
        "Nenhum custo real foi encontrado. Nenhum valor foi estimado.",
        "",
        "## PENDÊNCIAS TÉCNICAS",
        "- Gerar pacote técnico antes do envio comercial.",
        "- Confirmar projeto, memorial, composições oficiais e responsabilidade técnica profissional.",
        "- Aço estrutural não calculado automaticamente. Necessário projeto estrutural quando aplicável.",
        "",
        "## RESPONSABILIDADE TÉCNICA",
        "Documento preliminar assistido por sistema computacional.",
        "",
        "Não substitui projeto executivo, memorial descritivo, orçamento executivo ou responsabilidade técnica profissional.",
        "",
        "## HTML ESTRUTURADO",
        "```html",
        buildEloProposalHtml_("# PROPOSTA TÉCNICA PRELIMINAR\n\n## RESUMO EXECUTIVO\nDocumento preliminar aberto para organização do orçamento assistido.\n\n## QUANTITATIVOS\nNenhum quantitativo consolidado foi localizado.\n\n## COMPOSIÇÕES UTILIZADAS\nNenhuma composição oficial localizada.\n\n## CUSTOS ENCONTRADOS\nNenhum custo real encontrado.\n\n## PENDÊNCIAS TÉCNICAS\nGerar pacote técnico antes do envio comercial."),
        "```"
      ];
      return {
        shortAnswer: "Proposta técnica preliminar aberta sem custos estimados.",
        fullAnswer: markdownLines.join("\n"),
        nextAction: "Gere um pacote técnico para preencher quantitativos e composições antes de enviar ao cliente.",
        canSave: true,
        sessionTheme: "technical_proposal_package",
        sessionIntent: "technical_proposal_package_empty"
      };
    }
    const project = getActiveEloWorkProject_();
    const sourceText = source.answer;
    const executive = extractEloProposalSection_(sourceText, ["Resumo executivo", "Resposta principal"]) || "Proposta preliminar montada a partir do último pacote técnico calculado pelo Elo.";
    const quantities = extractEloProposalSection_(sourceText, ["Quantitativos", "Totais consolidados", "Memória de cálculo", "Memoria de calculo", "Volumes individuais"]) || "Ver quantitativos no pacote técnico de origem abaixo.";
    const compositions = extractEloProposalSection_(sourceText, ["Composições oficiais utilizadas", "Composicoes oficiais utilizadas", "Composições utilizadas", "Composicoes utilizadas", "Composições encontradas", "Composicoes encontradas"]) || "Nenhuma composição oficial foi localizada ou selecionada no pacote de origem.";
    const costs = extractEloProposalSection_(sourceText, ["Custos encontrados", "Custos"]) || "Somente serão exibidos valores quando houver preço real na base técnica carregada. Nenhum valor foi estimado.";
    const pending = extractEloProposalSection_(sourceText, ["Pendências técnicas", "Pendencias tecnicas", "Composições não localizadas", "Composicoes nao localizadas", "Observações técnicas", "Observacoes tecnicas", "Avisos profissionais"]) || "Confirmar projeto, memorial, composições oficiais faltantes, aço estrutural e responsabilidade técnica profissional.";
    const clientMatch = sanitizeUserText(message || "").match(/cliente\s+([^,.\n]{2,80})/i);
    const client = clientMatch ? sanitizeUserText(clientMatch[1]) : "não informado";
    const date = new Date().toLocaleDateString("pt-BR");
    const markdownLines = [
      "# PROPOSTA TÉCNICA PRELIMINAR",
      "",
      "Cliente: " + client,
      "Obra: " + ((project.nome && project.nome !== "não informado") ? project.nome : "obra atual"),
      "Data: " + date,
      "",
      "## RESUMO EXECUTIVO",
      executive,
      "",
      "## Descrição simples",
      "Documento preliminar preparado a partir do último pacote técnico calculado pelo Elo Orçamentista Assistido. O conteúdo abaixo organiza os dados para apresentação ao cliente sem criar novos cálculos.",
      "",
      "## SERVIÇOS CONSIDERADOS",
      "- Fundação",
      "- Estrutura",
      "- Alvenaria",
      "- Revestimentos",
      "",
      "## QUANTITATIVOS",
      quantities,
      "",
      "## COMPOSIÇÕES UTILIZADAS",
      compositions,
      "",
      "## CUSTOS ENCONTRADOS",
      costs,
      "",
      "## PENDÊNCIAS TÉCNICAS",
      pending,
      "- Projeto estrutural, aço e detalhamento executivo dependem de responsável técnico habilitado quando aplicável.",
      "- Composição ausente deve ser complementada com SINAPI, ORSE ou base oficial validada antes de fechamento comercial.",
      "",
      "## RESPONSABILIDADE TÉCNICA",
      "Documento preliminar assistido por sistema computacional.",
      "",
      "Não substitui projeto executivo, memorial descritivo, orçamento executivo ou responsabilidade técnica profissional.",
      "",
      "## HTML ESTRUTURADO",
      "```html",
      buildEloProposalHtml_("# PROPOSTA TÉCNICA PRELIMINAR\n\n## RESUMO EXECUTIVO\n" + executive + "\n\n## QUANTITATIVOS\n" + quantities + "\n\n## COMPOSIÇÕES UTILIZADAS\n" + compositions + "\n\n## CUSTOS ENCONTRADOS\n" + costs + "\n\n## PENDÊNCIAS TÉCNICAS\n" + pending),
      "```"
    ];
    return {
      shortAnswer: "Proposta técnica preliminar preparada para cliente.",
      fullAnswer: markdownLines.join("\n"),
      nextAction: "Revise cliente, obra, escopo e pendências antes de enviar ao cliente.",
      canSave: true,
      sessionTheme: "technical_proposal_package",
      sessionIntent: "technical_proposal_package"
    };
  }
  function buildEloTechnicalAuditorAlerts_(message, options) {
    const text = normalizeText(message || "");
    const alerts = [];
    const opts = options || {};
    if (/custo|or.amento|orcamento|valor|pre.o|preco|bdi|cronograma|curva\s+abc/.test(text) && !opts.hasOfficialBase) {
      alerts.push("- Custo, BDI, cronograma e curva ABC exigem composição SINAPI/ORSE ou composição interna validada. Não vou tratar estimativa como orçamento oficial.");
    }
    if (/produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|homens?-hora|horas?/.test(text) && !opts.hasOfficialBase) {
      alerts.push("- Produtividade e mão de obra dependem de composição validada; sem isso, a resposta fica limitada a briefing técnico.");
    }
    if (/v[aã]o|viga|laje|pilar|sapata|estrutura|balanço|balanco/.test(text) && /(\b[6-9]\s*m\b|\b1\d\s*m\b|\d+(?:[,.]\d+)?\s*m\s+de\s+v[aã]o)/.test(text)) {
      alerts.push("- Vão estrutural suspeito: confirme projeto estrutural e responsável técnico antes de executar.");
    }
    if (/concreto|laje|contrapiso|piso/.test(text) && !/espessura|\d+(?:[,.]\d+)?\s*cm|\bfck\s*\d{2}|\d{2}\s*mpa/.test(text) && /calcular|quantos|or.amento|orcamento|custo|consumo/.test(text)) {
      alerts.push("- Falta espessura e/ou FCK para avançar além da geometria ou do briefing.");
    }
    if (/parede|alvenaria|bloco|tijolo/.test(text) && /quantos|consumo|or.amento|orcamento|custo/.test(text) && !/porta|janela|sem\s+v[aã]os|sem\s+portas|sem\s+janelas/.test(text)) {
      alerts.push("- Confirme vãos de portas e janelas para evitar quantitativo bruto acima do necessário.");
    }
    return alerts;
  }
  // ELO_SESSION_MEMORY
  const ELO_SESSION_MEMORY = {
    lastQuestion: "",
    lastAnswer: "",
    lastTheme: "",
    lastContext: "",
    recentIntents: [],
    lastRecommendation: "",
    lastOperationalWallEstimate: null,
    pendingQuantitativePremises: null,
    stockObrasCompositionBriefing: null,
    lastTechnicalPackage: null
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
    if (response && isEloTechnicalProposalSourceResponse_(response)) {
      rememberEloTechnicalProposalSource_(question, response, answer || response.fullAnswer || response.shortAnswer || "");
    }
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

  function getEloOnlineHistory() {
    const history = [];
    getRecentQuestions().slice().reverse().forEach(function (item) {
      if (item.question) {
        history.push({
          role: "user",
          content: sanitizeUserText(item.question)
        });
      }
      if (item.answer) {
        history.push({
          role: "assistant",
          content: sanitizeUserText(item.answer)
        });
      }
    });
    return history.filter(function (item) {
      return item.content;
    }).slice(-ELO_CONFIG.maxHistory);
  }

  function isEloPdfAttachment_(file) {
    const type = String(file && file.type || "").toLowerCase();
    const name = String(file && file.name || "").toLowerCase();
    return type === "application/pdf" || /\.pdf$/i.test(name);
  }

  function loadEloPdfJs_() {
    if (window.pdfjsLib && window.pdfjsLib.getDocument) {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsLib.GlobalWorkerOptions.workerSrc || ELO_PDFJS_WORKER_URL;
      } catch (error) {
        // PDF.js can still run without changing the worker when the host blocks this assignment.
      }
      return Promise.resolve(window.pdfjsLib);
    }

    if (window.__eloPdfJsLoading) {
      return window.__eloPdfJsLoading;
    }

    window.__eloPdfJsLoading = new Promise(function (resolve, reject) {
      const script = document.createElement("script");
      script.src = ELO_PDFJS_LIBRARY_URL;
      script.async = true;
      script.onload = function () {
        if (!window.pdfjsLib || !window.pdfjsLib.getDocument) {
          reject(new Error("pdfjs_indisponivel"));
          return;
        }
        try {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = ELO_PDFJS_WORKER_URL;
        } catch (error) {
          // Ignore worker setup failures here; getDocument will report if it cannot proceed.
        }
        resolve(window.pdfjsLib);
      };
      script.onerror = function () {
        reject(new Error("pdfjs_indisponivel"));
      };
      document.head.appendChild(script);
    });

    return window.__eloPdfJsLoading;
  }

  function readEloFileAsArrayBuffer_(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(new Error("file_read_error"));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function extractPdfText(file) {
    return loadEloPdfJs_().then(function (pdfjsLib) {
      return readEloFileAsArrayBuffer_(file).then(function (buffer) {
        const data = new Uint8Array(buffer);
        return pdfjsLib.getDocument({ data: data }).promise;
      }).then(function (pdf) {
        const pageReads = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          pageReads.push(pdf.getPage(pageNumber).then(function (page) {
            return page.getTextContent().then(function (content) {
              return (content.items || []).map(function (item) {
                return item && item.str ? item.str : "";
              }).join(" ");
            });
          }));
        }
        return Promise.all(pageReads).then(function (pages) {
          const text = sanitizeUserText(pages.join("\n\n")).replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
          if (!text) {
            throw new Error("pdf_sem_texto");
          }
          return text.slice(0, ELO_PDF_TEXT_CONTEXT_LIMIT);
        });
      });
    });
  }

  function buildEloQuestionWithPdfContext_(question, pdfTexts) {
    const cleanQuestion = sanitizeUserText(question);
    const pdfContext = pdfTexts.map(function (entry, index) {
      return [
        "PDF " + (index + 1) + ": " + sanitizeUserText(entry.fileName || "documento.pdf"),
        sanitizeUserText(entry.text).slice(0, ELO_PDF_TEXT_CONTEXT_LIMIT)
      ].join("\n");
    }).join("\n\n").slice(0, ELO_PDF_TEXT_CONTEXT_LIMIT);

    return [
      "[CONTEUDO EXTRAIDO DO PDF]",
      pdfContext,
      "",
      "[PERGUNTA DO USUARIO]",
      cleanQuestion || "Elo, leia este anexo."
    ].join("\n");
  }

  function prepareEloPdfAttachmentContext_(question, files) {
    const pdfFiles = Array.prototype.slice.call(files || []).filter(isEloPdfAttachment_);
    if (!pdfFiles.length) {
      return Promise.resolve({
        message: sanitizeUserText(question),
        blockingMessage: ""
      });
    }

    return Promise.all(pdfFiles.slice(0, 4).map(function (file) {
      return extractPdfText(file).then(function (text) {
        return {
          ok: true,
          fileName: file.name || "documento.pdf",
          text: text
        };
      }).catch(function (error) {
        return {
          ok: false,
          fileName: file.name || "documento.pdf",
          reason: error && error.message ? error.message : "pdf_sem_texto"
        };
      });
    })).then(function (results) {
      const readable = results.filter(function (result) {
        return result.ok && result.text;
      });

      if (!readable.length) {
        return {
          message: sanitizeUserText(question),
          blockingMessage: "Este PDF parece ser um documento digitalizado em imagem. Ainda n\u00e3o foi poss\u00edvel extrair texto automaticamente."
        };
      }

      return {
        message: buildEloQuestionWithPdfContext_(question, readable),
        blockingMessage: ""
      };
    });
  }

  // ELO_TRANSPORT_API
  // The backend is the primary answer source. Local fallback only runs when this call is unavailable.
  function requestEloOnlineAnswer(question, attachments) {
    if (!ELO_CONFIG.chatEndpoint || !window.fetch) {
      return Promise.resolve(null);
    }

    syncEloVectorMemories();
    ELO_UI.pendingSavePrompt = null;
    const eloContext = getEloContext();
    const payload = {
      message: sanitizeUserText(question),
      eloContext: eloContext,
      history: getEloOnlineHistory(),
      context: {
        memoriesSummary: buildEloMemorySummary(),
        deviceId: getEloDeviceId(),
        source: "elo",
        mode: isStandaloneMode() ? "standalone" : "obrareport",
        eloContext: eloContext
      }
    };
    const files = Array.prototype.slice.call(attachments || []).filter(Boolean);

    if (files.length) {
      return prepareEloPdfAttachmentContext_(payload.message, files).then(function (prepared) {
        if (prepared.blockingMessage) {
          return prepared.blockingMessage;
        }

        const formData = new FormData();
        payload.message = prepared.message || payload.message;
        formData.append("message", payload.message);
        formData.append("eloContext", payload.eloContext);
        formData.append("history", JSON.stringify(payload.history));
        formData.append("context", JSON.stringify(payload.context));
        files.slice(0, 4).forEach(function (file) {
          formData.append("files", file, file.name || "anexo");
        });

        return window.fetch(ELO_CONFIG.chatEndpoint, {
          method: "POST",
          body: formData
        }).then(function (response) {
          return response.json().catch(function () {
            return null;
          });
        }).then(function (data) {
          if (data && data.ok && data.answer) {
            if (data.stockIaLaunchPlan) {
              setPendingStockIaPlan(data.stockIaLaunchPlan);
            }
            ELO_UI.pendingSavePrompt = normalizeEloSavePrompt(data.savePrompt);
            return sanitizeEloAnswerForDisplay(data.answer);
          }
          if (data && data.fallback && data.answer) {
            ELO_UI.pendingSavePrompt = normalizeEloSavePrompt(data.savePrompt);
            return sanitizeEloAnswerForDisplay(data.answer);
          }
          if (data && Array.isArray(data.attachmentErrors) && data.attachmentErrors.length) {
            return formatEloAttachmentErrors_(data.attachmentErrors);
          }
          return null;
        }).catch(function () {
          return null;
        });
      }).catch(function () {
        return null;
      });
    }

    return window.fetch(ELO_CONFIG.chatEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().catch(function () {
        return null;
      });
    }).then(function (data) {
      if (data && data.ok && data.answer) {
        if (data.stockIaLaunchPlan) {
          setPendingStockIaPlan(data.stockIaLaunchPlan);
        }
        ELO_UI.pendingSavePrompt = normalizeEloSavePrompt(data.savePrompt);
        return sanitizeEloAnswerForDisplay(data.answer);
      }
      if (data && data.fallback && data.answer) {
        ELO_UI.pendingSavePrompt = normalizeEloSavePrompt(data.savePrompt);
        return sanitizeEloAnswerForDisplay(data.answer);
      }
      if (data && Array.isArray(data.attachmentErrors) && data.attachmentErrors.length) {
        return formatEloAttachmentErrors_(data.attachmentErrors);
      }
      return null;
    }).catch(function () {
      return null;
    });
  }

  function formatEloAttachmentErrors_(errors) {
    const firstError = sanitizeUserText(errors && errors[0] ? errors[0] : "");
    if (/grande demais/i.test(firstError)) {
      return "Não consegui ler o anexo porque o arquivo excede o limite desta versão do Elo.";
    }
    return "Não consegui ler o anexo. O PDF pode estar escaneado, vazio, corrompido ou sem texto extraível.";
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

  // ELO_REAL_QUESTIONS_LOCAL
  function createRealQuestionId() {
    return "real_q_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeRealQuestionsStorage(storage) {
    return {
      questions: Array.isArray(storage && storage.questions) ? storage.questions : []
    };
  }

  function getRealQuestionsStorage() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.realQuestionsStorageKey);
      return normalizeRealQuestionsStorage(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return normalizeRealQuestionsStorage(null);
    }
  }

  function setRealQuestionsStorage(storage) {
    try {
      window.localStorage.setItem(ELO_CONFIG.realQuestionsStorageKey, JSON.stringify(normalizeRealQuestionsStorage(storage)));
    } catch (error) {
      // Perguntas reais ficam apenas no navegador. Se falhar, o Elo segue respondendo.
    }
  }

  function clearRealQuestions() {
    setRealQuestionsStorage({ questions: [] });
  }

  function getRealQuestions() {
    return (getRealQuestionsStorage().questions || []).slice().sort(function (first, second) {
      return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
    });
  }

  function isRealQuestionEligible(question, response) {
    const normalizedQuestion = normalizeText(question);
    if (!normalizedQuestion || normalizedQuestion.length < 4) {
      return false;
    }
    if (hasSensitiveMemoryTerm(question)) {
      return false;
    }
    if (isDailyRoutineQuestion(normalizedQuestion)) {
      return false;
    }
    if (response && response.sessionIntent === "conversa_humana") {
      return false;
    }
    if (hasAnyTerm(normalizedQuestion, ["conte uma piada", "piada", "tchau", "obrigado", "obrigada", "valeu"])) {
      return false;
    }
    return hasAnyTerm(normalizedQuestion, [
      "obrareport",
      "pdf",
      "rdo",
      "diario",
      "diário",
      "relatorio",
      "relatório",
      "materiais",
      "material",
      "plano",
      "cliente",
      "obra",
      "foto",
      "auditoria",
      "consumo",
      "salvar",
      "whatsapp",
      "elo"
    ]);
  }

  function detectRealQuestionCategory(question, response) {
    if (response && response.localDocumentResult) {
      return "documentos";
    }
    if (response && response.sessionTheme) {
      return response.sessionTheme;
    }
    const text = normalizeText(question);
    if (hasAnyTerm(text, ["pdf", "relatorio", "relatório", "foto"])) {
      return "relatorios";
    }
    if (hasAnyTerm(text, ["rdo", "diario", "diário", "materiais", "material", "auditoria", "consumo"])) {
      return "rdo";
    }
    if (hasAnyTerm(text, ["plano", "contratar", "limite"])) {
      return "planos";
    }
    if (hasAnyTerm(text, ["cliente", "obra"])) {
      return "clientes_obras";
    }
    return "geral";
  }

  function registerRealQuestion(question, answer, response) {
    if (!isRealQuestionEligible(question, response)) {
      return "";
    }
    const storage = getRealQuestionsStorage();
    const normalizedQuestion = normalizeText(question);
    const existing = (storage.questions || []).find(function (item) {
      return normalizeText(item.pergunta) === normalizedQuestion;
    });
    const now = new Date().toISOString();
    const record = {
      id: existing ? existing.id : createRealQuestionId(),
      pergunta: sanitizeLibraryText(question, 280),
      respostaGerada: sanitizeLibraryText(answer, 2000),
      contexto: getCurrentScreenContext().label,
      categoriaDetectada: detectRealQuestionCategory(question, response),
      foiUtil: existing ? existing.foiUtil : null,
      sugeridaParaTreino: existing ? Boolean(existing.sugeridaParaTreino) : false,
      createdAt: existing ? existing.createdAt : now
    };

    storage.questions = (storage.questions || []).filter(function (item) {
      return item.id !== record.id;
    });
    storage.questions.unshift(record);
    storage.questions = storage.questions.slice(0, 120);
    setRealQuestionsStorage(storage);
    return record.id;
  }

  function updateRealQuestionFeedback(id, wasUseful) {
    if (!id) {
      return null;
    }
    const storage = getRealQuestionsStorage();
    let updated = null;
    storage.questions = (storage.questions || []).map(function (item) {
      if (item.id !== id) {
        return item;
      }
      updated = Object.assign({}, item, {
        foiUtil: Boolean(wasUseful)
      });
      return updated;
    });
    setRealQuestionsStorage(storage);
    return updated;
  }

  function markRealQuestionForTraining(id) {
    const storage = getRealQuestionsStorage();
    let updated = null;
    storage.questions = (storage.questions || []).map(function (item) {
      if (item.id !== id) {
        return item;
      }
      updated = Object.assign({}, item, {
        sugeridaParaTreino: true
      });
      return updated;
    });
    setRealQuestionsStorage(storage);
    return updated;
  }

  function deleteRealQuestion(id) {
    const storage = getRealQuestionsStorage();
    storage.questions = (storage.questions || []).filter(function (item) {
      return item.id !== id;
    });
    setRealQuestionsStorage(storage);
  }

  function getRealQuestionStats() {
    const questions = getRealQuestions();
    return {
      total: questions.length,
      useful: questions.filter(function (item) { return item.foiUtil === true; }).length,
      notUseful: questions.filter(function (item) { return item.foiUtil === false; }).length,
      training: questions.filter(function (item) { return item.sugeridaParaTreino; }).length
    };
  }

  function exportRealQuestions(format) {
    const questions = getRealQuestions();
    const fileName = format === "txt" ? "elo-perguntas-reais.txt" : "elo-perguntas-reais.json";
    const content = format === "txt"
      ? questions.map(function (item, index) {
        return [
          (index + 1) + ". " + item.pergunta,
          "Contexto: " + item.contexto,
          "Categoria: " + item.categoriaDetectada,
          "Útil: " + (item.foiUtil === null ? "sem feedback" : (item.foiUtil ? "sim" : "não")),
          "Sugerida para treino: " + (item.sugeridaParaTreino ? "sim" : "não"),
          "Resposta gerada:",
          item.respostaGerada
        ].join("\n");
      }).join("\n\n---\n\n")
      : JSON.stringify({ source: "obrareport-elo", exportedAt: new Date().toISOString(), questions: questions }, null, 2);

    const blob = new Blob([content], { type: format === "txt" ? "text/plain" : "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return { ok: true, fileName: fileName };
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

  // ELO_IMPORTANT_MEMORY
  const ELO_IMPORTANT_MEMORY_TYPES = ["projeto", "objetivo", "preferencia"];
  const ELO_IMPORTANT_MEMORY_STATUSES = ["ativo", "pausado", "concluido", "arquivado"];

  function createImportantMemoryId(type) {
    return "important_" + (type || "memoria") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeImportantMemories(storage) {
    return {
      projetos: Array.isArray(storage && storage.projetos) ? storage.projetos : [],
      objetivos: Array.isArray(storage && storage.objetivos) ? storage.objetivos : [],
      preferencias: Array.isArray(storage && storage.preferencias) ? storage.preferencias : []
    };
  }

  function getImportantMemoriesStorage() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.importantMemoryStorageKey);
      return normalizeImportantMemories(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return normalizeImportantMemories(null);
    }
  }

  function setImportantMemoriesStorage(storage) {
    try {
      window.localStorage.setItem(ELO_CONFIG.importantMemoryStorageKey, JSON.stringify(normalizeImportantMemories(storage)));
    } catch (error) {
      // Memorias importantes sao locais. Se o navegador bloquear, o Elo segue sem salvar.
    }
  }

  function getImportantMemoryBucket(type) {
    if (type === "projeto") {
      return "projetos";
    }
    if (type === "objetivo") {
      return "objetivos";
    }
    return "preferencias";
  }

  function normalizeImportantMemoryStatus(status) {
    const normalizedStatus = normalizeText(status);
    return ELO_IMPORTANT_MEMORY_STATUSES.find(function (item) {
      return normalizeText(item) === normalizedStatus;
    }) || "ativo";
  }

  function sanitizeImportantMemoryTitle(title, fallback) {
    return sanitizeLibraryText(title || fallback || "Memória importante", 120).replace(/\.$/, "");
  }

  function buildImportantMemoryItem(candidate, typeOverride) {
    const type = ELO_IMPORTANT_MEMORY_TYPES.indexOf(typeOverride || candidate.tipo) >= 0 ? (typeOverride || candidate.tipo) : "objetivo";
    const now = new Date().toISOString();
    return {
      id: createImportantMemoryId(type),
      tipo: type,
      titulo: sanitizeImportantMemoryTitle(candidate.titulo, candidate.descricao),
      descricao: sanitizeLibraryText(candidate.descricao || candidate.sourceQuestion || candidate.titulo, 360),
      status: normalizeImportantMemoryStatus(candidate.status || "ativo"),
      origem: "usuario",
      createdAt: now,
      updatedAt: now
    };
  }

  function saveImportantMemory(candidate, typeOverride) {
    const item = buildImportantMemoryItem(candidate, typeOverride);
    if (!item.titulo || hasSensitiveMemoryTerm(item.titulo + " " + item.descricao)) {
      return { ok: false, reason: "sensitive" };
    }

    const storage = getImportantMemoriesStorage();
    const bucket = getImportantMemoryBucket(item.tipo);
    storage[bucket] = (storage[bucket] || []).filter(function (existing) {
      return normalizeText(existing.titulo) !== normalizeText(item.titulo);
    });
    storage[bucket].unshift(item);
    storage[bucket] = storage[bucket].slice(0, 30);
    setImportantMemoriesStorage(storage);
    return { ok: true, item: item };
  }

  function getAllImportantMemories() {
    const storage = getImportantMemoriesStorage();
    return []
      .concat(storage.projetos || [])
      .concat(storage.objetivos || [])
      .concat(storage.preferencias || []);
  }

  function findImportantMemoryByTitle(title, type) {
    const normalizedTitle = normalizeText(title);
    const list = type ? (getImportantMemoriesStorage()[getImportantMemoryBucket(type)] || []) : getAllImportantMemories();
    return list.find(function (item) {
      return normalizeText(item.titulo).indexOf(normalizedTitle) >= 0 || normalizedTitle.indexOf(normalizeText(item.titulo)) >= 0;
    }) || null;
  }

  function updateImportantMemoryStatus(title, status) {
    const item = findImportantMemoryByTitle(title);
    if (!item) {
      return { ok: false, reason: "not_found" };
    }

    const storage = getImportantMemoriesStorage();
    const bucket = getImportantMemoryBucket(item.tipo);
    storage[bucket] = (storage[bucket] || []).map(function (memoryItem) {
      if (memoryItem.id !== item.id) {
        return memoryItem;
      }
      return Object.assign({}, memoryItem, {
        status: normalizeImportantMemoryStatus(status),
        updatedAt: new Date().toISOString()
      });
    });
    setImportantMemoriesStorage(storage);
    return { ok: true, item: Object.assign({}, item, { status: normalizeImportantMemoryStatus(status) }) };
  }

  function updateImportantObjective(title, newDescription) {
    const item = findImportantMemoryByTitle(title, "objetivo");
    if (!item) {
      return { ok: false, reason: "not_found" };
    }

    const storage = getImportantMemoriesStorage();
    storage.objetivos = (storage.objetivos || []).map(function (memoryItem) {
      if (memoryItem.id !== item.id) {
        return memoryItem;
      }
      return Object.assign({}, memoryItem, {
        descricao: sanitizeLibraryText(newDescription, 360),
        titulo: sanitizeImportantMemoryTitle(newDescription, memoryItem.titulo),
        updatedAt: new Date().toISOString()
      });
    });
    setImportantMemoriesStorage(storage);
    return { ok: true };
  }

  function deleteImportantMemory(id) {
    const storage = getImportantMemoriesStorage();
    storage.projetos = (storage.projetos || []).filter(function (item) { return item.id !== id; });
    storage.objetivos = (storage.objetivos || []).filter(function (item) { return item.id !== id; });
    storage.preferencias = (storage.preferencias || []).filter(function (item) { return item.id !== id; });
    setImportantMemoriesStorage(storage);
  }

  function clearImportantMemories() {
    setImportantMemoriesStorage(null);
  }

  function isSimpleSupportQuestion(text) {
    return hasAnyTerm(text, [
      "como gerar pdf",
      "como criar rdo",
      "como criar relatorio",
      "como adicionar materiais",
      "conte uma piada",
      "piada",
      "o que falta",
      "posso gerar",
      "resuma esta tela"
    ]);
  }

  function extractImportantTitle(value) {
    const text = sanitizeLibraryText(value, 140);
    const projectMatch = text.match(/\b(ObraReport|Stock IA|CADISTA IA|Elo)\b/i);
    if (projectMatch) {
      return projectMatch[1];
    }
    return text.replace(/^(o|a|os|as|meu|minha|meus|minhas)\s+/i, "").slice(0, 80);
  }

  function detectImportantMemoryType_(text) {
    if (hasAnyTerm(text, ["roadmap", "plano", "o plano e", "o plano Ã©"])) {
      return "objetivo";
    }
    if (hasAnyTerm(text, ["projeto", "produto", "desenvolver", "construir", "minha ideia", "ideia e", "ideia Ã©"])) {
      return "projeto";
    }
    if (hasAnyTerm(text, ["objetivo", "meta", "foco", "precisa virar", "preciso", "quero"])) {
      return "objetivo";
    }
    if (hasAnyTerm(text, ["aprendi", "percebi", "prefiro", "gosto", "nao posso esquecer", "nÃ£o posso esquecer"])) {
      return "preferencia";
    }
    return "objetivo";
  }

  function summarizeImportantMemoryCandidate_(value) {
    return sanitizeLibraryText(value, 360)
      .replace(/^(quero lembrar que|guarde isso:?|isso e importante:?|isso Ã© importante:?|minha ideia e|minha ideia Ã©|o objetivo e|o objetivo Ã©|decidi que|o plano e|o plano Ã©|o roadmap e|o roadmap Ã©|nao posso esquecer que|nÃ£o posso esquecer que|aprendi que|percebi que)\s*/i, "")
      .trim();
  }

  function detectImportantMemoryCandidate(question) {
    if (hasSensitiveMemoryTerm(question)) {
      return null;
    }

    const cleanQuestion = sanitizeUserText(question);
    const text = normalizeText(cleanQuestion);
    if (!cleanQuestion || isSimpleSupportQuestion(text)) {
      return null;
    }

    const normalizedImportantPrefixes = [
      "quero lembrar que ",
      "guarde isso ",
      "guarde isso: ",
      "isso e importante ",
      "minha ideia e ",
      "o objetivo e ",
      "decidi que ",
      "o plano e ",
      "o roadmap e ",
      "nao posso esquecer que ",
      "aprendi que ",
      "percebi que "
    ];
    for (let prefixIndex = 0; prefixIndex < normalizedImportantPrefixes.length; prefixIndex += 1) {
      const prefix = normalizedImportantPrefixes[prefixIndex];
      if (text.indexOf(prefix) === 0) {
        const description = summarizeImportantMemoryCandidate_(cleanQuestion.slice(prefix.length));
        if (!description) {
          return null;
        }
        const type = detectImportantMemoryType_(text);
        return {
          tipo: type,
          titulo: extractImportantTitle(description),
          descricao: description,
          status: "ativo",
          sourceQuestion: cleanQuestion,
          suggestedKind: hasAnyTerm(text, ["roadmap"]) ? "roadmap" : (type === "projeto" ? "ideia/projeto" : type)
        };
      }
    }

    if (isInvalidUserNameAnswer_(cleanQuestion) || detectSocialGreeting(cleanQuestion)) {
      return null;
    }

    const explicitImportantMatch = cleanQuestion.match(/^(?:quero lembrar que|guarde isso:?|isso (?:e|Ã©) importante:?|minha ideia (?:e|Ã©)|o objetivo (?:e|Ã©)|decidi que|o plano (?:e|Ã©)|o roadmap (?:e|Ã©)|n(?:a|Ã£)o posso esquecer que|aprendi que|percebi que)\s+(.+)$/i);
    if (explicitImportantMatch && explicitImportantMatch[1]) {
      const description = summarizeImportantMemoryCandidate_(explicitImportantMatch[1]);
      const type = detectImportantMemoryType_(text);
      return {
        tipo: type,
        titulo: extractImportantTitle(description),
        descricao: description,
        status: "ativo",
        sourceQuestion: cleanQuestion,
        suggestedKind: hasAnyTerm(text, ["roadmap"]) ? "roadmap" : (type === "projeto" ? "ideia/projeto" : type)
      };
    }

    const projectPatterns = [
      { regex: /^estou desenvolvendo (?:o |a )?(.+)$/i, titleGroup: 1 },
      { regex: /^quero lembrar do projeto (.+)$/i, titleGroup: 1 },
      { regex: /^meu projeto (?:é|e) (.+)$/i, titleGroup: 1 }
    ];

    for (let index = 0; index < projectPatterns.length; index += 1) {
      const match = cleanQuestion.match(projectPatterns[index].regex);
      if (match && match[projectPatterns[index].titleGroup]) {
        const title = extractImportantTitle(match[projectPatterns[index].titleGroup]);
        return {
          tipo: "projeto",
          titulo: title,
          descricao: "Usuário está desenvolvendo " + title + ".",
          status: "ativo",
          sourceQuestion: cleanQuestion
        };
      }
    }

    const objectivePatterns = [
      /^meu objetivo (?:é|e) (.+)$/i,
      /^quero (conseguir .+|finalizar .+|terminar .+|vender .+|publicar .+|testar .+)$/i,
      /^meu foco agora (?:é|e) (.+)$/i
    ];

    for (let goalIndex = 0; goalIndex < objectivePatterns.length; goalIndex += 1) {
      const goalMatch = cleanQuestion.match(objectivePatterns[goalIndex]);
      if (goalMatch && goalMatch[1]) {
        return {
          tipo: "objetivo",
          titulo: extractImportantTitle(goalMatch[1]),
          descricao: sanitizeLibraryText(goalMatch[1], 360),
          status: "ativo",
          sourceQuestion: cleanQuestion
        };
      }
    }

    const preferencePatterns = [
      /^prefiro (.+)$/i,
      /^gosto de (.+)$/i,
      /^eu gosto de (.+)$/i
    ];

    for (let prefIndex = 0; prefIndex < preferencePatterns.length; prefIndex += 1) {
      const prefMatch = cleanQuestion.match(preferencePatterns[prefIndex]);
      if (prefMatch && prefMatch[1]) {
        return {
          tipo: "preferencia",
          titulo: extractImportantTitle(prefMatch[1]),
          descricao: sanitizeLibraryText(prefMatch[1], 360),
          status: "ativo",
          sourceQuestion: cleanQuestion
        };
      }
    }

    return null;
  }

  function answerImportantMemoryQuestion(question) {
    const text = normalizeText(question);
    const storage = getImportantMemoriesStorage();
    const projects = storage.projetos || [];
    const goals = storage.objetivos || [];
    const preferences = storage.preferencias || [];
    const hasAnyMemory = projects.length || goals.length || preferences.length;

    const statusMatch = text.match(/^marque (.+) como (ativo|pausado|concluido|concluida|arquivado|arquivada)[.!?]?$/);
    if (statusMatch && statusMatch[1]) {
      const result = updateImportantMemoryStatus(statusMatch[1], statusMatch[2].replace("concluida", "concluido").replace("arquivada", "arquivado"));
      return {
        shortAnswer: result.ok ? "Atualizei essa memória importante." : "Não encontrei essa memória importante.",
        fullAnswer: result.ok ? result.item.titulo + " agora está como " + result.item.status + "." : "Abra Memórias importantes para conferir o nome salvo ou escolha o item certo.",
        nextAction: result.ok ? "Você pode consultar suas memórias importantes quando quiser." : "Me diga exatamente qual projeto, objetivo ou preferência deseja atualizar.",
        canSave: false
      };
    }

    const objectiveUpdateMatch = text.match(/^atualize meu objetivo para (.+?)[.!?]?$/);
    if (objectiveUpdateMatch && objectiveUpdateMatch[1]) {
      const firstGoal = goals[0];
      if (!firstGoal) {
        return {
          shortAnswer: "Ainda não encontrei objetivo salvo para atualizar.",
          fullAnswer: "Diga algo como: Meu objetivo é conseguir 3 clientes. Eu vou perguntar antes de guardar.",
          nextAction: "Crie um objetivo importante primeiro.",
          canSave: false
        };
      }
      updateImportantObjective(firstGoal.titulo, objectiveUpdateMatch[1]);
      return {
        shortAnswer: "Objetivo atualizado.",
        fullAnswer: "Atualizei seu objetivo para: " + objectiveUpdateMatch[1] + ".",
        nextAction: "Consulte 'Quais objetivos eu tenho?' para revisar.",
        canSave: false
      };
    }

    if (hasAnyTerm(text, ["quais projetos voce lembra", "quais projetos você lembra", "o que voce sabe sobre meus projetos", "o que você sabe sobre meus projetos"])) {
      return {
        shortAnswer: projects.length ? "Projetos importantes salvos:" : "Ainda não tenho projetos importantes salvos.",
        fullAnswer: projects.length ? projects.map(function (item) {
          return "- " + item.titulo + " — " + item.status;
        }).join("\n") : "Quando você disser algo como 'Estou desenvolvendo o ObraReport', eu posso perguntar se deseja guardar como projeto.",
        nextAction: "Use Memórias importantes para revisar ou excluir.",
        canSave: false
      };
    }

    if (hasAnyTerm(text, ["quais objetivos eu tenho", "quais sao meus objetivos", "quais são meus objetivos"])) {
      return {
        shortAnswer: goals.length ? "Objetivos importantes salvos:" : "Ainda não tenho objetivos importantes salvos.",
        fullAnswer: goals.length ? goals.map(function (item) {
          return "- " + item.titulo + " — " + item.status + (item.descricao ? "\n  " + item.descricao : "");
        }).join("\n") : "Quando você disser algo como 'Quero conseguir meus primeiros clientes', eu posso perguntar se deseja guardar como objetivo.",
        nextAction: "Use Memórias importantes para revisar ou excluir.",
        canSave: false
      };
    }

    if (hasAnyTerm(text, ["quais preferencias voce lembra", "quais preferências você lembra", "quais preferencias você lembra", "quais preferências voce lembra"])) {
      return {
        shortAnswer: preferences.length ? "Preferências importantes salvas:" : "Ainda não tenho preferências importantes salvas.",
        fullAnswer: preferences.length ? preferences.map(function (item) {
          return "- " + item.titulo + " — " + item.descricao;
        }).join("\n") : "Quando você disser algo como 'Prefiro relatórios técnicos', eu posso perguntar antes de guardar.",
        nextAction: "Use Memórias importantes para revisar ou excluir.",
        canSave: false
      };
    }

    if (hasAnyTerm(text, ["o que voce lembra de mim", "o que você lembra de mim"])) {
      if (!hasAnyMemory) {
        return {
          shortAnswer: "Ainda não tenho memórias importantes salvas.",
          fullAnswer: "Quando você me disser algo relevante sobre projetos, objetivos ou preferências, eu vou perguntar antes de guardar.",
          nextAction: "Exemplo: Estou desenvolvendo o ObraReport.",
          canSave: false
        };
      }

      return {
        shortAnswer: "Estas são suas memórias importantes salvas neste navegador:",
        fullAnswer: formatImportantMemoriesForAnswer(storage),
        nextAction: "Abra Memórias importantes para revisar, excluir ou limpar.",
        canSave: false
      };
    }

    return null;
  }

  function buildMemorySuggestion(message, context) {
    const suggestion = detectImportantMemoryCandidate(message);
    if (!suggestion) {
      return null;
    }
    return Object.assign({}, suggestion, {
      suggestedLabel: suggestion.suggestedKind || suggestion.tipo || "memoria",
      summary: sanitizeLibraryText(suggestion.descricao || suggestion.titulo || message, 360)
    });
  }

  function saveImportantMemorySuggestion(suggestion, typeOverride) {
    if (!suggestion) {
      return { ok: false, reason: "missing" };
    }
    return saveImportantMemory(suggestion, typeOverride || suggestion.tipo);
  }

  function buildImportantMemoryAnswer(suggestion) {
    if (!suggestion) {
      return null;
    }
    return {
      shortAnswer: "Isso parece importante.",
      fullAnswer: [
        "Posso guardar como:",
        "- memoria",
        "- ideia",
        "- projeto",
        "- objetivo",
        "- roadmap",
        "",
        "Sugestao:",
        suggestion.summary || suggestion.descricao || suggestion.titulo
      ].join("\n"),
      nextAction: "Escolha onde guardar quando eu mostrar as opcoes. Nada e salvo automaticamente.",
      canSave: false,
      sessionTheme: "memoria",
      sessionIntent: "sugestao_memoria_importante"
    };
  }

  function formatImportantMemoriesForAnswer(storage) {
    const sections = [
      ["Projetos", storage.projetos || []],
      ["Objetivos", storage.objetivos || []],
      ["Preferências", storage.preferencias || []]
    ];

    return sections.map(function (section) {
      const title = section[0];
      const items = section[1];
      return title + ":\n" + (items.length ? items.map(function (item) {
        return "- " + item.titulo + " — " + item.status;
      }).join("\n") : "- Nenhum item salvo.");
    }).join("\n\n");
  }

  // ELO_TIMELINE_LOCAL
  const ELO_TIMELINE_TYPES = ["marco", "conversa", "ideia", "conquista", "dificuldade", "objetivo", "reflexao", "carta_futuro"];
  const ELO_TIMELINE_IMPORTANCE = ["baixa", "media", "alta"];

  function createTimelineEventId() {
    return "timeline_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalizeTimelineType(type) {
    const normalizedType = normalizeText(type || "");
    return ELO_TIMELINE_TYPES.find(function (item) {
      return normalizeText(item) === normalizedType;
    }) || "marco";
  }

  function normalizeTimelineImportance(importance) {
    const normalizedImportance = normalizeText(importance || "");
    return ELO_TIMELINE_IMPORTANCE.find(function (item) {
      return normalizeText(item) === normalizedImportance;
    }) || "media";
  }

  function normalizeTimelineTags(tags) {
    if (Array.isArray(tags)) {
      return tags.map(function (tag) {
        return sanitizeLibraryText(tag, 40);
      }).filter(Boolean).slice(0, 12);
    }
    return String(tags || "").split(",").map(function (tag) {
      return sanitizeLibraryText(tag, 40);
    }).filter(Boolean).slice(0, 12);
  }

  function normalizeTimelineEvent(event) {
    const now = new Date().toISOString();
    return {
      id: sanitizeLibraryText(event && event.id, 80) || createTimelineEventId(),
      type: normalizeTimelineType(event && event.type),
      title: sanitizeLibraryText(event && event.title, 140) || "Evento da Linha do Tempo",
      content: sanitizeLibraryText(event && event.content, 1200),
      tags: normalizeTimelineTags(event && event.tags),
      mood: sanitizeLibraryText(event && event.mood, 80),
      project: sanitizeLibraryText(event && event.project, 120),
      importance: normalizeTimelineImportance(event && event.importance),
      createdAt: sanitizeLibraryText(event && event.createdAt, 40) || now,
      source: sanitizeLibraryText(event && event.source, 80) || "manual",
      targetDate: sanitizeLibraryText(event && event.targetDate, 40),
      status: event && event.type === "carta_futuro" ? (sanitizeLibraryText(event.status, 40) || "pendente") : sanitizeLibraryText(event && event.status, 40)
    };
  }

  function normalizeTimelineStorage(storage) {
    return {
      events: Array.isArray(storage && storage.events) ? storage.events.map(normalizeTimelineEvent).slice(0, 200) : []
    };
  }

  function getTimelineStorage() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.timelineStorageKey);
      return normalizeTimelineStorage(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return normalizeTimelineStorage(null);
    }
  }

  function setTimelineStorage(storage) {
    try {
      window.localStorage.setItem(ELO_CONFIG.timelineStorageKey, JSON.stringify(normalizeTimelineStorage(storage)));
    } catch (error) {
      // A Linha do Tempo e local. Se o navegador bloquear storage, o Elo segue sem salvar.
    }
  }

  function saveTimelineEvent(input) {
    const event = normalizeTimelineEvent(input || {});
    if (!event.title || !event.content) {
      return { ok: false, reason: "missing" };
    }
    if (hasSensitiveMemoryTerm(event.title + " " + event.content + " " + event.tags.join(" "))) {
      return { ok: false, reason: "sensitive" };
    }
    const storage = getTimelineStorage();
    storage.events = [event].concat(storage.events || []).slice(0, 200);
    setTimelineStorage(storage);
    return { ok: true, event: event };
  }

  function deleteTimelineEvent(id) {
    const storage = getTimelineStorage();
    storage.events = (storage.events || []).filter(function (event) {
      return event.id !== id;
    });
    setTimelineStorage(storage);
  }

  function getTimelineEvents(filters) {
    const storage = getTimelineStorage();
    const type = filters && filters.type ? normalizeTimelineType(filters.type) : "";
    const project = normalizeText(filters && filters.project);
    return (storage.events || []).filter(function (event) {
      const typeMatch = !type || event.type === type;
      const projectMatch = !project || normalizeText(event.project).indexOf(project) >= 0;
      return typeMatch && projectMatch;
    }).sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function loadEloTimeline() {
    return getTimelineStorage();
  }

  function saveEloTimeline(timeline) {
    setTimelineStorage(timeline || { events: [] });
    return getTimelineStorage();
  }

  function addEloTimelineEvent(event) {
    return saveTimelineEvent(event);
  }

  function searchEloTimeline(query) {
    const text = normalizeText(query);
    if (!text) {
      return [];
    }
    const parts = text.split(/\s+/).filter(function (part) { return part.length > 2; });
    return getTimelineEvents().map(function (event) {
      const haystack = normalizeText([event.title, event.content, event.project, event.type, event.tags.join(" ")].join(" "));
      let score = 0;
      if (haystack.indexOf(text) >= 0) {
        score += 10;
      }
      parts.forEach(function (part) {
        if (haystack.indexOf(part) >= 0) {
          score += part.length > 5 ? 3 : 1;
        }
      });
      return { event: event, score: score };
    }).filter(function (entry) {
      return entry.score > 0;
    }).sort(function (first, second) {
      return second.score - first.score;
    });
  }

  function formatTimelineType(type) {
    const labels = {
      marco: "Marco",
      conversa: "Conversa",
      ideia: "Ideia",
      conquista: "Conquista",
      dificuldade: "Dificuldade",
      objetivo: "Objetivo",
      reflexao: "Reflexao",
      carta_futuro: "Carta para o futuro"
    };
    return labels[type] || "Evento";
  }

  function formatTimelineEventLine(event) {
    const project = event.project ? " - " + event.project : "";
    return "- " + formatTimelineType(event.type) + ": " + event.title + project + " - " + formatDateTime(event.createdAt);
  }

  function exportTimelineAsText(events) {
    const list = events || getTimelineEvents();
    return [
      "LINHA DO TEMPO - ELO ASSISTENTE OBRAREPORT",
      "",
      "Total de eventos: " + list.length,
      "",
      list.length ? list.map(function (event) {
        return [
          formatTimelineType(event.type).toUpperCase() + " - " + event.title,
          "Data: " + formatDateTime(event.createdAt),
          "Projeto: " + (event.project || "nao informado"),
          "Importancia: " + event.importance,
          "Humor: " + (event.mood || "nao informado"),
          "Tags: " + (event.tags.length ? event.tags.join(", ") : "sem tags"),
          "Conteudo: " + event.content
        ].join("\n");
      }).join("\n\n---\n\n") : "Nenhum evento registrado."
    ].join("\n");
  }

  function detectTimelineLetterCommand(question) {
    const cleanQuestion = sanitizeUserText(question);
    const text = normalizeText(cleanQuestion);
    if (!hasAnyTerm(text, ["guarde uma carta para o futuro", "guardar uma carta para o futuro", "carta para o futuro"])) {
      return null;
    }
    let content = cleanQuestion.replace(/^\s*elo,?\s*/i, "").replace(/guarde uma carta para o futuro[:\-]?\s*/i, "").trim();
    if (!content || normalizeText(content) === "carta para o futuro") {
      content = "Carta para o futuro registrada pelo chat. Edite ou complemente pela Linha do Tempo quando quiser.";
    }
    return {
      type: "carta_futuro",
      title: "Carta para o futuro",
      content: content,
      importance: "alta",
      tags: ["carta", "futuro"],
      source: "chat",
      status: "pendente"
    };
  }

  function isSimpleTimelineIgnoredQuestion(normalizedQuestion) {
    if (!normalizedQuestion || normalizedQuestion.length < 8) {
      return true;
    }
    if (["oi", "ola", "olá", "tudo bem", "obrigado", "obrigada", "valeu", "tchau"].indexOf(normalizedQuestion) >= 0) {
      return true;
    }
    if (/[?]$/.test(normalizedQuestion) || normalizedQuestion.indexOf("como ") === 0 || normalizedQuestion.indexOf("qual ") === 0) {
      return true;
    }
    return hasAnyTerm(normalizedQuestion, [
      "como gerar pdf",
      "como criar rdo",
      "como criar relatorio",
      "conte uma piada",
      "piada",
      "git ",
      "commit",
      "push",
      "npm ",
      "node --check"
    ]);
  }

  function detectTimelineProject(text) {
    const projects = [
      ["ObraReport", ["obrareport", "obra report"]],
      ["Elo", ["elo"]],
      ["Stock IA", ["stock ia"]],
      ["CADISTA IA", ["cadista ia"]],
      ["livro", ["livro"]],
      ["RDO", ["rdo", "diario de obra", "diário de obra"]],
      ["PDF", ["pdf"]]
    ];
    for (let index = 0; index < projects.length; index += 1) {
      if (hasAnyTerm(text, projects[index][1])) {
        return projects[index][0];
      }
    }
    return "";
  }

  function detectTimelineMood(text) {
    if (hasAnyTerm(text, ["animado", "animada", "empolgado", "empolgada"])) {
      return "animado";
    }
    if (hasAnyTerm(text, ["cansado", "cansada"])) {
      return "cansado";
    }
    if (hasAnyTerm(text, ["preocupado", "preocupada", "preocupacao", "preocupação"])) {
      return "preocupado";
    }
    if (hasAnyTerm(text, ["triste"])) {
      return "triste";
    }
    if (hasAnyTerm(text, ["produtivo", "produtiva"])) {
      return "produtivo";
    }
    return "neutro";
  }

  function detectTimelineType(text) {
    if (hasAnyTerm(text, ["consegui", "terminei", "finalizei", "primeira venda", "primeiro cliente"])) {
      return "conquista";
    }
    if (hasAnyTerm(text, ["tive uma ideia", "ideia para", "ideia de", "minha ideia", "percebi que", "aprendi que"])) {
      return "ideia";
    }
    if (hasAnyTerm(text, ["cansado", "cansada", "triste", "preocupado", "preocupada", "dificil", "difícil", "hoje foi dificil", "hoje foi difícil"])) {
      return "dificuldade";
    }
    if (hasAnyTerm(text, ["quero", "objetivo", "meta", "roadmap", "o plano e", "o plano Ã©"])) {
      return "objetivo";
    }
    if (hasAnyTerm(text, ["marco", "importante", "avancei", "avancamos", "avançamos", "avancou", "comecei", "lembre que hoje"])) {
      return "marco";
    }
    return "marco";
  }

  function detectTimelineImportance(text, type) {
    if (hasAnyTerm(text, ["avancei", "avancamos", "avançamos"])) {
      return "media";
    }
    if (type === "marco" || hasAnyTerm(text, ["primeira venda", "primeiro cliente", "marco", "terminei", "finalizei", "consegui"])) {
      return "alta";
    }
    if (type === "ideia" || type === "objetivo" || hasAnyTerm(text, ["avancei", "avancamos", "avançamos", "objetivo", "meta"])) {
      return "media";
    }
    return "baixa";
  }

  function buildTimelineTitleFromQuestion(cleanQuestion, type) {
    const text = cleanQuestion
      .replace(/^\s*elo,?\s*/i, "")
      .replace(/^lembre que\s+/i, "")
      .replace(/^hoje\s+/i, "")
      .replace(/^isso\s+/i, "")
      .trim();
    if (type === "ideia") {
      return "Ideia registrada";
    }
    if (type === "conquista") {
      return "Conquista registrada";
    }
    if (type === "dificuldade") {
      return "Dificuldade registrada";
    }
    if (type === "objetivo") {
      return "Objetivo registrado";
    }
    return sanitizeLibraryText(text, 90) || "Marco registrado";
  }

  function detectTimelineEventCandidate(question) {
    if (hasSensitiveMemoryTerm(question)) {
      return null;
    }
    const cleanQuestion = sanitizeUserText(question);
    const text = normalizeText(cleanQuestion);
    if (isSimpleTimelineIgnoredQuestion(text)) {
      return null;
    }
    const important = hasAnyTerm(text, [
      "lembre que hoje",
      "isso foi importante",
      "consegui",
      "terminei",
      "finalizei",
      "comecei",
      "tive uma ideia",
      "primeiro cliente",
      "primeira venda",
      "estou cansado",
      "estou cansada",
      "estou triste",
      "estou animado",
      "estou animada",
      "estou preocupado",
      "estou preocupada",
      "hoje foi dificil",
      "hoje foi difícil",
      "hoje foi produtivo",
      "avancamos no obrareport",
      "avançamos no obrareport",
      "avancei no elo",
      "quero registrar isso",
      "decidi que",
      "o plano e",
      "roadmap",
      "aprendi que",
      "percebi que",
      "isso e um marco",
      "isso é um marco"
    ]);
    if (!important) {
      return null;
    }
    const type = detectTimelineType(text);
    return {
      type: type,
      title: buildTimelineTitleFromQuestion(cleanQuestion, type),
      content: cleanQuestion,
      tags: [type].concat(detectTimelineProject(text) ? [detectTimelineProject(text)] : []),
      mood: detectTimelineMood(text),
      project: detectTimelineProject(text),
      importance: detectTimelineImportance(text, type),
      source: "detecção automática confirmada"
    };
  }

  function isTodayTimelineEvent(event) {
    if (!event.createdAt) {
      return false;
    }
    const eventDate = new Date(event.createdAt);
    const today = new Date();
    return eventDate.toDateString() === today.toDateString();
  }

  function answerTimelineQuestion(question) {
    const text = normalizeText(question);
    const events = getTimelineEvents();

    if (hasAnyTerm(text, ["o que aconteceu hoje", "aconteceu hoje", "resumo de hoje"])) {
      const todayEvents = events.filter(isTodayTimelineEvent);
      return {
        shortAnswer: todayEvents.length ? "Eventos registrados hoje:" : "Ainda nao ha eventos registrados hoje na sua Linha do Tempo.",
        fullAnswer: todayEvents.length ? todayEvents.slice(0, 8).map(formatTimelineEventLine).join("\n") : "Use Ferramentas do Elo > Linha do tempo para registrar marcos, ideias, conquistas ou dificuldades.",
        nextAction: todayEvents.length ? "Voce pode exportar a Linha do Tempo em texto pelas ferramentas." : "Adicione um evento manual quando algo importante acontecer.",
        canSave: false,
        sessionTheme: "timeline"
      };
    }

    const typeQuestions = [
      { terms: ["quais foram meus marcos", "meus marcos"], type: "marco", label: "Marcos registrados", empty: "Ainda nao ha marcos registrados na sua Linha do Tempo." },
      { terms: ["quais ideias eu tive", "minhas ideias", "ideias eu tive"], type: "ideia", label: "Ideias registradas", empty: "Ainda nao ha ideias registradas na sua Linha do Tempo." },
      { terms: ["quais conquistas registrei", "minhas conquistas", "conquistas registrei"], type: "conquista", label: "Conquistas registradas", empty: "Ainda nao ha conquistas registradas na sua Linha do Tempo." }
    ];

    for (let index = 0; index < typeQuestions.length; index += 1) {
      const item = typeQuestions[index];
      if (hasAnyTerm(text, item.terms)) {
        const filtered = events.filter(function (event) {
          return event.type === item.type;
        });
        return {
          shortAnswer: filtered.length ? item.label + ":" : item.empty,
          fullAnswer: filtered.length ? filtered.slice(0, 8).map(formatTimelineEventLine).join("\n") : "Use Ferramentas do Elo > Linha do tempo para registrar manualmente.",
          nextAction: "Abra Linha do tempo para adicionar, excluir ou exportar eventos.",
          canSave: false,
          sessionTheme: "timeline"
        };
      }
    }

    const projectMatch = text.match(/o que aconteceu (?:no|com o|com a)\s+(.+?)\??$/);
    if (projectMatch && projectMatch[1]) {
      const project = projectMatch[1].replace(/^projeto\s+/, "").trim();
      const filtered = events.filter(function (event) {
        return normalizeText(event.project).indexOf(project) >= 0 || normalizeText(event.title).indexOf(project) >= 0 || normalizeText(event.content).indexOf(project) >= 0;
      });
      return {
        shortAnswer: filtered.length ? "Eventos encontrados sobre " + project + ":" : "Nao encontrei eventos sobre " + project + " na sua Linha do Tempo.",
        fullAnswer: filtered.length ? filtered.slice(0, 8).map(formatTimelineEventLine).join("\n") : "Registre eventos manualmente em Ferramentas do Elo > Linha do tempo.",
        nextAction: filtered.length ? "Se quiser, exporte a Linha do Tempo para revisar fora do navegador." : "Adicione um evento e informe o projeto relacionado.",
        canSave: false,
        sessionTheme: "timeline"
      };
    }

    return null;
  }

  function isTimelineEventInCurrentMonth_(event) {
    if (!event || !event.createdAt) {
      return false;
    }
    const date = new Date(event.createdAt);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  function isTimelineEventInLastDays_(event, days) {
    if (!event || !event.createdAt) {
      return false;
    }
    const created = new Date(event.createdAt).getTime();
    return Number.isFinite(created) && Date.now() - created <= days * 24 * 60 * 60 * 1000;
  }

  function buildTimelineAnswer(question, context) {
    const text = normalizeText(question);
    const events = getTimelineEvents();

    if (hasAnyTerm(text, ["o que aconteceu este mes", "o que aconteceu esse mes", "aconteceu este mes", "aconteceu esse mes"])) {
      const monthEvents = events.filter(isTimelineEventInCurrentMonth_);
      return {
        shortAnswer: monthEvents.length ? "Este mes teve alguns registros na sua jornada." : "Eu ainda tenho poucos marcos registrados deste mes.",
        fullAnswer: monthEvents.length ? monthEvents.slice(0, 8).map(formatTimelineEventLine).join("\n") : "Posso comecar a montar sua Linha do Tempo a partir das proximas decisoes importantes.",
        nextAction: monthEvents.length ? "Se quiser, posso transformar isso em um relatorio de jornada." : "Quando algo importante acontecer, diga: quero lembrar que...",
        canSave: false,
        sessionTheme: "timeline",
        sessionIntent: "timeline_mes"
      };
    }

    if (hasAnyTerm(text, ["quais foram meus ultimos avancos", "quais foram meus ultimos avanÃ§os", "ultimos avancos", "Ãºltimos avanÃ§os", "ultimos marcos", "Ãºltimos marcos"])) {
      return {
        shortAnswer: events.length ? "Seus ultimos avancos registrados aparecem aqui:" : "Ainda tenho poucos avancos registrados.",
        fullAnswer: events.length ? events.slice(0, 6).map(formatTimelineEventLine).join("\n") : "Quando voce registrar marcos, ideias ou conquistas, eu consigo montar essa leitura com mais precisao.",
        nextAction: events.length ? "Posso resumir isso como relatorio de jornada." : "Diga algo como: avancei no Elo hoje.",
        canSave: false,
        sessionTheme: "timeline",
        sessionIntent: "timeline_avancos"
      };
    }

    if (hasAnyTerm(text, ["qual foi meu maior marco", "maior marco", "principal marco"])) {
      const important = events.find(function (event) { return event.importance === "alta"; }) || events[0];
      return {
        shortAnswer: important ? "O maior marco registrado parece ser: " + important.title + "." : "Ainda nao tenho marcos suficientes para apontar um maior.",
        fullAnswer: important ? formatTimelineEventLine(important) + "\n\nConteudo: " + important.content : "Posso comecar a perceber isso quando voce registrar conquistas, decisoes e ideias importantes.",
        nextAction: important ? "Se esse marco mudou, registre um novo evento na Linha do Tempo." : "Diga: isso foi importante, para eu sugerir registro.",
        canSave: false,
        sessionTheme: "timeline",
        sessionIntent: "timeline_marco"
      };
    }

    const startedMatch = text.match(/quando (?:comecei|surgiu|criei|nasceu)\s+(?:o |a )?(.+?)\??$/);
    if (startedMatch && startedMatch[1]) {
      const topic = startedMatch[1].replace(/^projeto\s+/, "").trim();
      const found = searchEloTimeline(topic).map(function (entry) { return entry.event; });
      const first = found.slice().sort(function (a, b) {
        return String(a.createdAt).localeCompare(String(b.createdAt));
      })[0];
      return {
        shortAnswer: first ? "O primeiro registro que encontrei sobre " + topic + " foi em " + formatDateTime(first.createdAt) + "." : "Ainda nao encontrei quando " + topic + " surgiu na Linha do Tempo.",
        fullAnswer: first ? formatTimelineEventLine(first) + "\n\n" + first.content : "Eu ainda tenho poucos marcos registrados, mas posso comecar a montar essa historia a partir das proximas decisoes importantes.",
        nextAction: first ? "Posso listar os outros eventos relacionados a esse projeto." : "Registre um marco dizendo quando esse projeto comecou.",
        canSave: false,
        sessionTheme: "timeline",
        sessionIntent: "timeline_origem"
      };
    }

    return null;
  }

  function detectJourneyReportRequest(message) {
    const text = normalizeText(message);
    if (hasAnyTerm(text, ["faca um relatorio da minha jornada", "faÃ§a um relatÃ³rio da minha jornada", "relatorio da minha jornada", "relatÃ³rio da minha jornada", "o que aconteceu comigo este mes", "o que aconteceu comigo esse mes", "qual foi meu avanco", "qual foi meu avanÃ§o", "no que eu evolui", "no que eu evoluÃ­", "quais projetos estao mais ativos", "quais projetos estÃ£o mais ativos", "qual meu foco atual", "o que voce percebe da minha semana", "o que vocÃª percebe da minha semana"])) {
      return hasAnyTerm(text, ["semana"]) ? "weekly" : (hasAnyTerm(text, ["mes", "mÃªs"]) ? "monthly" : "general");
    }
    return null;
  }

  function rankJourneyProjects_(snapshot) {
    const counts = {};
    function add(name, weight) {
      const clean = sanitizeLibraryText(name, 120);
      if (!clean) {
        return;
      }
      counts[clean] = (counts[clean] || 0) + weight;
    }
    (snapshot.projects || []).forEach(function (project) { add(project, 2); });
    (snapshot.recentEvents || []).forEach(function (event) {
      add(event.project, 3);
      ["ObraReport", "Elo", "Stock IA", "CADISTA IA"].forEach(function (projectName) {
        const haystack = normalizeText([event.title, event.content, event.tags && event.tags.join(" ")].join(" "));
        if (haystack.indexOf(normalizeText(projectName)) >= 0) {
          add(projectName, 1);
        }
      });
    });
    return Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    });
  }

  function buildJourneyReport(context) {
    const snapshot = context && context.snapshot ? context.snapshot : getConnectedMemorySnapshot();
    const events = snapshot.recentEvents || [];
    const activeProjects = rankJourneyProjects_(snapshot).slice(0, 5);
    const biggestAdvance = snapshot.latestAchievement || snapshot.latestImportantEvent || events[0] || null;
    const focus = snapshot.mainProject || snapshot.mostMentionedProject || activeProjects[0] || "";
    const hasData = hasNarrativeJourneyData(snapshot) || events.length;

    if (!hasData) {
      return {
        shortAnswer: "Ainda estou montando sua jornada.",
        fullAnswer: "Eu ainda tenho poucos marcos registrados, mas posso comecar a montar sua linha do tempo a partir das proximas decisoes importantes.",
        nextAction: "Diga algo como: quero lembrar que o Stock IA deve controlar entrada e saida de materiais.",
        canSave: false,
        sessionTheme: "jornada",
        sessionIntent: "relatorio_jornada"
      };
    }

    return {
      shortAnswer: "Relatorio da sua jornada.",
      fullAnswer: [
        "Relatorio da sua jornada",
        "",
        "Projetos mais ativos:",
        activeProjects.length ? activeProjects.map(function (project) { return "- " + project; }).join("\n") : "- Ainda nao tenho projetos suficientes registrados.",
        "",
        "Maior avanco:",
        biggestAdvance ? "- " + biggestAdvance.title + " (" + formatDateTime(biggestAdvance.createdAt) + ")" : "- Ainda nao tenho um marco principal registrado.",
        "",
        "Padrao percebido:",
        focus ? "- Voce tem concentrado energia em transformar " + focus + " em algo mais concreto." : "- Voce vem registrando ideias, mas ainda falta um foco dominante salvo.",
        "",
        "Risco atual:",
        activeProjects.length > 2 ? "- Muitas frentes abertas ao mesmo tempo." : "- Poucos registros para medir risco com seguranca.",
        "",
        "Proxima acao:",
        "- Escolher uma entrega pequena e concluir antes de abrir outra frente."
      ].join("\n"),
      nextAction: "Se quiser, posso transformar esse relatorio em plano de proximos passos.",
      canSave: false,
      sessionTheme: "jornada",
      sessionIntent: "relatorio_jornada"
    };
  }

  function buildWeeklyJourneyReport(context) {
    const snapshot = context && context.snapshot ? context.snapshot : getConnectedMemorySnapshot();
    const weeklyEvents = (snapshot.recentEvents || []).filter(function (event) {
      return isTimelineEventInLastDays_(event, 7);
    });
    const base = buildJourneyReport({ snapshot: Object.assign({}, snapshot, { recentEvents: weeklyEvents.length ? weeklyEvents : snapshot.recentEvents }) });
    base.shortAnswer = weeklyEvents.length ? "Resumo da sua semana." : "Ainda tenho poucos registros desta semana.";
    return base;
  }

  function buildMonthlyJourneyReport(context) {
    const snapshot = context && context.snapshot ? context.snapshot : getConnectedMemorySnapshot();
    const monthlyEvents = (snapshot.recentEvents || getTimelineEvents()).filter(isTimelineEventInCurrentMonth_);
    const base = buildJourneyReport({ snapshot: Object.assign({}, snapshot, { recentEvents: monthlyEvents.length ? monthlyEvents : snapshot.recentEvents }) });
    base.shortAnswer = monthlyEvents.length ? "Resumo do seu mes." : "Ainda tenho poucos registros deste mes.";
    return base;
  }

  // ELO_DOCUMENTS_LOCAL
  function createDocumentId() {
    return "doc_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function createDocumentChunkId(documentId, index) {
    return documentId + "_chunk_" + index;
  }

  function normalizeDocumentsStorage(storage) {
    return {
      documents: Array.isArray(storage && storage.documents) ? storage.documents.map(normalizeEloLibraryItem).filter(Boolean) : []
    };
  }

  function getDocumentsStorage() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.documentsStorageKey);
      return normalizeDocumentsStorage(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return normalizeDocumentsStorage(null);
    }
  }

  function setDocumentsStorage(storage) {
    try {
      window.localStorage.setItem(ELO_CONFIG.documentsStorageKey, JSON.stringify(normalizeDocumentsStorage(storage)));
    } catch (error) {
      // Documentos locais podem falhar em modo privado. O Elo segue sem consultar essa base.
    }
  }

  function splitDocumentIntoChunks(text) {
    const cleanText = sanitizeLibraryText(text, 60000).replace(/\n{2,}/g, "\n\n");
    const paragraphs = cleanText.split(/\n\s*\n/).map(function (paragraph) {
      return paragraph.replace(/\s+/g, " ").trim();
    }).filter(Boolean);
    const chunks = [];
    let current = "";

    paragraphs.forEach(function (paragraph) {
      if ((current + " " + paragraph).trim().length > 900 && current) {
        chunks.push(current);
        current = paragraph;
      } else {
        current = (current + " " + paragraph).trim();
      }
    });

    if (current) {
      chunks.push(current);
    }

    if (!chunks.length && cleanText) {
      for (let index = 0; index < cleanText.length; index += 900) {
        chunks.push(cleanText.slice(index, index + 900));
      }
    }

    return chunks.slice(0, 80);
  }

  function buildDocumentChunks(documentId, text) {
    return splitDocumentIntoChunks(text).map(function (chunkText, index) {
      return {
        id: createDocumentChunkId(documentId, index + 1),
        text: chunkText,
        keywords: extractDocumentKeywords(chunkText)
      };
    });
  }

  function extractDocumentKeywords(text) {
    const ignored = ["para", "com", "uma", "das", "dos", "que", "por", "como", "esta", "este", "essa", "esse", "permite"];
    const words = normalizeText(text).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(function (word) {
      return word.length > 3 && ignored.indexOf(word) === -1;
    });
    const counts = {};
    words.forEach(function (word) {
      counts[word] = (counts[word] || 0) + 1;
    });
    return Object.keys(counts).sort(function (first, second) {
      return counts[second] - counts[first];
    }).slice(0, 12);
  }

  function normalizeDocumentType(type) {
    const normalizedType = normalizeText(type);
    if (normalizedType === "md" || normalizedType === "markdown") {
      return "markdown";
    }
    if (["roadmap", "ideia", "nota", "livro", "pdf manual", "pdf_manual", "documento", "texto"].indexOf(normalizedType) >= 0) {
      return normalizedType.replace(/\s+/g, "_");
    }
    if (normalizedType === "txt") {
      return "texto";
    }
    return "documento";
  }

  function getEloLibraryItemContent(item) {
    return sanitizeLibraryText((item && (item.content || item.text)) || "", 60000);
  }

  function normalizeEloLibraryItem(item) {
    if (!item) {
      return null;
    }

    const now = new Date().toISOString();
    const id = sanitizeUserText(item.id) || createDocumentId();
    const content = getEloLibraryItemContent(item);
    const title = sanitizeLibraryText(item.title || item.sourceName || "Item da biblioteca", 140);
    const type = normalizeDocumentType(item.type || "documento");
    const tags = parseLibraryTags(item.tags || item.keywords || []);
    const chunks = Array.isArray(item.chunks) && item.chunks.length
      ? item.chunks.map(function (chunk, index) {
        const chunkText = typeof chunk === "string" ? chunk : chunk.text;
        return {
          id: chunk.id || createDocumentChunkId(id, index + 1),
          text: sanitizeLibraryText(chunkText, 1200),
          keywords: Array.isArray(chunk.keywords) ? chunk.keywords : extractDocumentKeywords(chunkText)
        };
      }).filter(function (chunk) {
        return chunk.text;
      })
      : buildDocumentChunks(id, content);

    return {
      id: id,
      title: title,
      type: type,
      sourceName: sanitizeLibraryText(item.sourceName || item.fileName || item.source || "", 160),
      content: content,
      text: content,
      summary: sanitizeLibraryText(item.summary, 1200),
      tags: tags,
      size: content.length,
      chunks: chunks,
      createdAt: item.createdAt || now,
      updatedAt: item.updatedAt || item.createdAt || now
    };
  }

  function saveLocalDocument(input) {
    const title = sanitizeLibraryText(input && input.title, 140);
    const text = sanitizeLibraryText(input && (input.content || input.text), 60000);
    const type = normalizeDocumentType(input && input.type);
    const tags = parseLibraryTags(input && input.tags);
    const summary = sanitizeLibraryText(input && input.summary, 1200);
    const sourceName = sanitizeLibraryText(input && input.sourceName, 160);

    if (!title || !text) {
      return { ok: false, reason: "missing" };
    }

    if (isSensitiveLibraryContent(title, text, tags.join(" "), summary)) {
      return { ok: false, reason: "sensitive" };
    }

    const storage = getDocumentsStorage();
    const now = new Date().toISOString();
    const id = input && input.id ? sanitizeUserText(input.id) : createDocumentId();
    const existingDocument = (storage.documents || []).find(function (item) {
      return item.id === id;
    });
    const documentItem = {
      id: id,
      title: title,
      type: type,
      sourceName: sourceName,
      content: text,
      text: text,
      summary: summary || summarizeEloLibraryItem({ title: title, type: type, content: text, tags: tags }),
      tags: tags,
      size: text.length,
      chunks: buildDocumentChunks(id, text),
      createdAt: existingDocument && existingDocument.createdAt ? existingDocument.createdAt : (input && input.createdAt ? input.createdAt : now),
      updatedAt: now
    };

    storage.documents = (storage.documents || []).filter(function (item) {
      return item.id !== documentItem.id;
    });
    storage.documents.unshift(documentItem);
    storage.documents = storage.documents.slice(0, 40);
    setDocumentsStorage(storage);
    return { ok: true, document: documentItem };
  }

  function getLocalDocuments() {
    return (getDocumentsStorage().documents || []).slice().sort(function (first, second) {
      return new Date(second.updatedAt || second.createdAt || 0) - new Date(first.updatedAt || first.createdAt || 0);
    });
  }

  function deleteLocalDocument(id) {
    const storage = getDocumentsStorage();
    storage.documents = (storage.documents || []).filter(function (item) {
      return item.id !== id;
    });
    setDocumentsStorage(storage);
  }

  function clearLocalDocuments() {
    setDocumentsStorage({ documents: [] });
  }

  function scoreDocumentChunk(documentItem, chunk, normalizedQuestion) {
    const parts = normalizedQuestion.split(/\s+/).filter(function (part) {
      return part.length > 2;
    });
    const searchable = normalizeText([
      documentItem.title,
      documentItem.type,
      documentItem.sourceName,
      documentItem.summary,
      (documentItem.tags || []).join(" "),
      chunk.text,
      (chunk.keywords || []).join(" ")
    ].join(" "));
    let score = 0;

    if (!parts.length || !searchable) {
      return 0;
    }

    if (searchable.indexOf(normalizedQuestion) >= 0) {
      score += 12;
    }

    parts.forEach(function (part) {
      if (searchable.indexOf(part) >= 0) {
        score += part.length > 5 ? 3 : 1;
      }
    });

    if (normalizeText(documentItem.title).indexOf(normalizedQuestion) >= 0) {
      score += 6;
    }

    return score;
  }

  function searchLocalDocuments(question) {
    const normalizedQuestion = normalizeText(question);
    if (!normalizedQuestion) {
      return [];
    }

    const results = [];
    getLocalDocuments().forEach(function (documentItem) {
      (documentItem.chunks || []).forEach(function (chunk) {
        const score = scoreDocumentChunk(documentItem, chunk, normalizedQuestion);
        if (score > 0) {
          results.push({
            document: documentItem,
            chunk: chunk,
            score: score
          });
        }
      });
    });

    return results.sort(function (first, second) {
      return second.score - first.score;
    });
  }

  function loadEloLibrary() {
    return getDocumentsStorage();
  }

  function saveEloLibrary(library) {
    setDocumentsStorage(library || { documents: [] });
    return getDocumentsStorage();
  }

  function addEloLibraryItem(item) {
    return saveLocalDocument({
      title: item && item.title,
      type: item && item.type,
      sourceName: item && item.sourceName,
      text: item && (item.content || item.text),
      summary: item && item.summary,
      tags: item && item.tags
    });
  }

  function updateEloLibraryItem(id, data) {
    return saveLocalDocument(Object.assign({}, data || {}, { id: id }));
  }

  function deleteEloLibraryItem(id) {
    deleteLocalDocument(id);
  }

  function searchEloLibrary(query) {
    const documentResults = searchLocalDocuments(query).map(function (entry) {
      return {
        type: "document",
        title: entry.document.title,
        item: entry.document,
        text: entry.chunk.text,
        score: entry.score
      };
    });
    const memoryLibraryResults = searchLibraryItems(query, "").map(function (item) {
      return {
        type: "library",
        title: item.title,
        item: item,
        text: item.content,
        score: scoreLibraryItem(item, normalizeText(query))
      };
    }).filter(function (entry) {
      return entry.score > 0;
    });

    return documentResults.concat(memoryLibraryResults).sort(function (first, second) {
      return second.score - first.score;
    });
  }

  function summarizeEloLibraryItem(item) {
    const content = getEloLibraryItemContent(item);
    const manualSummary = sanitizeLibraryText(item && item.summary, 700);
    const tags = parseLibraryTags(item && item.tags);
    if (manualSummary) {
      return manualSummary;
    }

    const topicLines = content.split("\n").map(function (line) {
      return sanitizeLibraryText(line, 220);
    }).filter(function (line) {
      return /^([-*]|\d+[.)])\s+/.test(line) || /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.!?]{8,80}$/.test(line);
    }).slice(0, 4);
    const keywords = extractDocumentKeywords([item && item.title, content, tags.join(" ")].join(" ")).slice(0, 6);
    const intro = "Este material parece tratar de " + (keywords.length ? keywords.join(", ") : "um tema salvo na biblioteca") + ".";

    if (topicLines.length) {
      return intro + " Pontos principais: " + topicLines.join("; ") + ".";
    }

    return intro + " " + summarizeDocumentChunk(content);
  }

  function buildEloLibraryContext() {
    const snapshot = getConnectedMemorySnapshot();
    return {
      documents: getLocalDocuments(),
      memoryLibrary: getLibraryItems(),
      snapshot: snapshot,
      hasJourney: hasNarrativeJourneyData(snapshot),
      projects: snapshot.projects || [],
      goals: snapshot.goals || [],
      focus: snapshot.mainProject || snapshot.mostMentionedProject || ""
    };
  }

  function buildEloLibrarySummary(context) {
    const currentContext = context || buildEloLibraryContext();
    const documents = currentContext.documents;
    const memoryItems = currentContext.memoryLibrary;
    const allItems = documents.concat(memoryItems);
    const typeCounts = {};
    documents.forEach(function (item) {
      typeCounts[item.type || "documento"] = (typeCounts[item.type || "documento"] || 0) + 1;
    });
    const typeLine = Object.keys(typeCounts).length
      ? Object.keys(typeCounts).map(function (type) { return type + ": " + typeCounts[type]; }).join(", ")
      : "sem tipos registrados";
    const latest = allItems.slice(0, 4).map(function (item) {
      return "- " + item.title;
    }).join("\n");

    if (!allItems.length) {
      return "Sua biblioteca local ainda não tem itens. Você pode colar textos, roadmaps, ideias, notas ou resumos para eu consultar depois.";
    }

    return [
      "Sua biblioteca local tem " + documents.length + " documento(s) estruturado(s) e " + memoryItems.length + " item(ns) antigos da Biblioteca do Elo.",
      "Tipos encontrados: " + typeLine + ".",
      latest ? "Itens recentes:\n" + latest : ""
    ].filter(Boolean).join("\n\n");
  }

  function isEloLibraryQuestion(question) {
    const text = normalizeText(question);
    return hasAnyTerm(text, [
      "biblioteca",
      "documentos do elo",
      "documentos locais",
      "meus documentos",
      "resuma meus documentos",
      "resuma minha biblioteca",
      "o que tem na sua biblioteca",
      "o que eu defini no roadmap",
      "roadmap",
      "ideias salvas",
      "ideias eu salvei",
      "o que a biblioteca diz",
      "texto quer dizer",
      "ideia principal desse material",
      "compare isso com meus projetos"
    ]);
  }

  function buildEloLibraryFocusedQuery(question) {
    const text = normalizeText(question);
    const knownTopics = [
      "stock ia",
      "obrareport",
      "elo",
      "roadmap",
      "ideia",
      "ideias",
      "nota",
      "livro",
      "estoque",
      "almoxarifado",
      "rdo",
      "pdf"
    ];
    return knownTopics.filter(function (topic) {
      return text.indexOf(topic) >= 0;
    }).join(" ");
  }

  function buildEloLibraryAnswer(question, context) {
    const currentContext = context || buildEloLibraryContext();
    const text = normalizeText(question);
    const asksSpecificTopic = hasAnyTerm(text, ["sobre", "diz sobre", "o que eu defini", "sabe sobre", "compare"]);
    const wantsSummary = !asksSpecificTopic && hasAnyTerm(text, ["o que tem na sua biblioteca", "quais documentos", "resuma meus documentos", "resuma minha biblioteca", "biblioteca"]);
    const wantsComparison = hasAnyTerm(text, ["compare isso com meus projetos", "compare com meus projetos", "cruze com meus projetos"]);
    let results = searchEloLibrary(question);
    let best = results[0];
    if ((!best || best.score < 3) && asksSpecificTopic) {
      const focusedQuery = buildEloLibraryFocusedQuery(question);
      if (focusedQuery) {
        results = searchEloLibrary(focusedQuery);
        best = results[0];
      }
    }

    if (wantsSummary && (!best || best.score < 3)) {
      return {
        shortAnswer: "Resumo da biblioteca local.",
        fullAnswer: buildEloLibrarySummary(currentContext),
        nextAction: "Se quiser, adicione roadmaps, ideias, notas ou textos em Ferramentas do Elo > Biblioteca do Elo.",
        canSave: false,
        sessionTheme: "biblioteca",
        sessionIntent: "biblioteca_local"
      };
    }

    if (!best || best.score < 3) {
      if (!isEloLibraryQuestion(question)) {
        return null;
      }
      return {
        shortAnswer: "Não encontrei essa informação na sua biblioteca local ainda.",
        fullAnswer: "Se quiser, cole um texto, registre uma ideia ou salve um roadmap para eu consultar depois.",
        nextAction: "Abra Ferramentas do Elo > Biblioteca do Elo para adicionar conteúdo.",
        canSave: false,
        sessionTheme: "biblioteca",
        sessionIntent: "biblioteca_local"
      };
    }

    const item = best.item;
    const sourceTitle = best.title || item.title;
    const itemSummary = best.type === "document" ? summarizeEloLibraryItem(item) : summarizeLibraryContent(item.content);
    const journeyLine = currentContext.hasJourney
      ? buildEloLibraryJourneyBridge_(sourceTitle, currentContext)
      : "Na biblioteca existe material sobre isso, mas ainda tenho pouca memória da sua jornada para comparar melhor.";
    const comparisonLine = wantsComparison ? "\n\n" + journeyLine : "";

    return {
      shortAnswer: "Resposta baseada na biblioteca local: " + sourceTitle,
      fullAnswer: itemSummary + comparisonLine,
      nextAction: "Abra Biblioteca do Elo para ver, editar ou adicionar mais contexto.",
      canSave: false,
      sessionTheme: "biblioteca",
      sessionIntent: "biblioteca_local",
      localDocumentResult: best.type === "document" ? { document: item } : null
    };
  }

  function buildEloLibraryJourneyBridge_(sourceTitle, context) {
    const projects = (context.projects || []).slice(0, 3);
    const goals = (context.goals || []).slice(0, 2);
    const focus = context.focus || projects[0] || "";
    const lines = [];
    if (focus) {
      lines.push("Pelo que está na sua biblioteca e na sua jornada, " + sourceTitle + " se conecta ao foco atual em " + focus + ".");
    }
    if (projects.length) {
      lines.push("Projetos relacionados que aparecem nas suas memórias: " + formatNarrativeList(projects) + ".");
    }
    if (goals.length) {
      lines.push("Objetivos que podem se relacionar com isso: " + formatNarrativeList(goals) + ".");
    }
    return lines.length ? lines.join(" ") : "A biblioteca tem material sobre isso, mas ainda tenho pouca memória da sua jornada para comparar melhor.";
  }

  function exportEloLibrary() {
    return JSON.stringify({
      source: "elo-biblioteca-local",
      exportedAt: new Date().toISOString(),
      library: getDocumentsStorage(),
      legacyLibraryItems: getLibraryItems()
    }, null, 2);
  }

  function summarizeDocumentChunk(text) {
    const cleanText = sanitizeLibraryText(text, 1200).replace(/\s+/g, " ");
    if (cleanText.length <= 360) {
      return cleanText;
    }
    return cleanText.slice(0, 357).trim() + "...";
  }

  function isDocumentSearchQuestion(question) {
    const text = normalizeText(question);
    return hasAnyTerm(text, ["documento local", "documentos locais", "documentos do elo", "manual", "base de conhecimento"]);
  }

  function answerFromLocalDocuments(question) {
    const documents = getLocalDocuments();
    if (!documents.length) {
      return null;
    }

    const results = searchLocalDocuments(question);
    const best = results[0];
    if (!best || best.score < 4) {
      if (isDocumentSearchQuestion(question)) {
        return {
          shortAnswer: "Não encontrei essa informação nos documentos locais.",
          fullAnswer: "A base local tem " + documents.length + " documento(s), mas nenhum trecho teve relação suficiente com a pergunta.",
          nextAction: "Abra Documentos do Elo para revisar textos importados ou adicionar um documento mais específico.",
          canSave: false
        };
      }
      return null;
    }

    return {
      shortAnswer: "Resposta baseada em documento local: " + best.document.title,
      fullAnswer: summarizeDocumentChunk(best.chunk.text),
      nextAction: "Abra Documentos do Elo para revisar o documento completo ou adicionar novos textos.",
      canSave: false,
      localDocumentResult: {
        document: best.document,
        chunk: best.chunk
      }
    };
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

  function shouldShowEloSavePrompt(input) {
    const userMessage = normalizeText(input && input.userMessage);
    const assistantResponse = normalizeText(input && input.assistantResponse);
    const intent = normalizeText(input && input.intent);
    const combined = [userMessage, intent].join(" ");
    const context = sanitizeUserText(input && input.context) || getEloContext();

    if (!combined.trim() && !assistantResponse) {
      return { show: false, reason: "empty", suggestedTarget: "none" };
    }

    if (isSimpleEloCalculation(combined)) {
      return { show: false, reason: "simple_calculation", suggestedTarget: "none" };
    }

    if (["teste", "ola", "olá", "oi", "bom dia", "boa tarde", "boa noite"].indexOf(combined.trim()) >= 0) {
      return { show: false, reason: "low_future_value", suggestedTarget: "none" };
    }

    if (hasAnyTerm(combined, ["biblioteca", "guardar na biblioteca", "guarde na biblioteca", "usar depois", "resumo de reuniao", "resumo de reunião", "roadmap", "especificacao de produto", "especificação de produto"])) {
      return { show: true, reason: "reusable_technical_content", suggestedTarget: "library" };
    }

    if (hasAnyTerm(combined, ["guarde", "guardar", "lembre", "lembrar", "prefiro", "minha preferencia", "minha preferência", "regra de negocio", "regra de negócio", "preferencia permanente", "preferência permanente"])) {
      return { show: true, reason: "durable_memory", suggestedTarget: "memory" };
    }

    if (hasAnyTerm(combined, ["decisao estrategica", "decisão estratégica", "estrategia do projeto", "estratégia do projeto", "planejamento importante", "plano de acao", "plano de ação", "roadmap", "stock full"]) && assistantResponse.length > 220) {
      return { show: true, reason: "strategic_decision", suggestedTarget: "both" };
    }

    if (context === "saude" && hasAnyTerm(combined, ["protocolo", "auditoria", "compras", "validade", "lote"])) {
      return { show: true, reason: "health_operations_reference", suggestedTarget: "library" };
    }

    return { show: false, reason: "not_reusable_enough", suggestedTarget: "none" };
  }

  function isSimpleEloCalculation(normalizedText) {
    const hasMeasure = /\b\d+(?:[,.]\d+)?\s*(?:(?:x|×|\?|por)\s*\d+(?:[,.]\d+)?|m2|m3|m|metros?|cm)\b/.test(normalizedText);
    const hasCalculationTerm = hasAnyTerm(normalizedText, [
      "quantos",
      "quanto",
      "calcule",
      "calcular",
      "preciso",
      "bloco",
      "blocos",
      "concreto",
      "laje",
      "calcada",
      "calçada",
      "piso",
      "revestimento",
      "tinta",
      "argamassa",
      "m2",
      "m3"
    ]);
    const asksToSave = hasAnyTerm(normalizedText, ["guardar", "guarde", "lembrar", "lembre", "resumo", "relatorio", "relatório", "orcamento", "orçamento", "planejamento"]);
    return hasMeasure && hasCalculationTerm && !asksToSave;
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
      name: "CADISTA",
      status: "ativo",
      priority: "alta",
      description: "SaaS para gerar planta baixa tecnica, PDF e DXF a partir de geometria, croqui ou imagem.",
      nextAction: "Validar o motor geometrico procedural com terreno, recuos, ambientes e exportacao.",
      notes: ""
    },
    {
      name: "Stock Full",
      status: "ativo",
      priority: "alta",
      description: "SaaS de estoque e almoxarifado para lojistas, com entradas, saidas, saldo e auditoria.",
      nextAction: "Consolidar fluxo operacional simples e confiavel para usuarios reais.",
      notes: ""
    },
    {
      name: "Elo",
      status: "ativo",
      priority: "alta",
      description: "Assistente contextual com memoria, biblioteca, personalidade unica e cerebro oficial.",
      nextAction: "Evoluir recuperacao de contexto, auditoria de resposta e unificacao dos widgets.",
      notes: ""
    },
    {
      name: "Stock Saúde",
      status: "ativo",
      priority: "media",
      description: "Controle operacional de estoque de saude com lote, validade, rastreabilidade e auditoria.",
      nextAction: "Priorizar seguranca operacional, controle por lote e alertas de validade.",
      notes: ""
    },
    {
      name: "ObraReport",
      status: "ativo",
      priority: "alta",
      description: "SaaS de relatórios, RDO, materiais, PDF e Elo Assistente.",
      nextAction: "Continuar evolução comercial e validar com clientes.",
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
          fullAnswer: "Abra Projetos para adicionar seus projetos ou usar a lista sugerida com CADISTA, Stock Full, Elo, Stock Saúde e ObraReport.",
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

  function isEloOfficialProjectQuestion_(message) {
    const text = normalizeText(message);
    return hasAnyTerm(text, [
      "cadista",
      "stock",
      "stock full",
      "stock saude",
      "stock saúde",
      "obrareport",
      "obra report",
      "elo",
      "elo informe"
    ]);
  }

  function buildEloOnlineUnavailableResponse_() {
    const answer = "Não consegui consultar o Elo online neste momento.";
    return {
      shortAnswer: answer,
      fullAnswer: answer,
      nextAction: "Tente novamente em instantes.",
      canSave: false,
      sessionTheme: "elo_online_indisponivel",
      sessionIntent: "backend_required"
    };
  }

  function sanitizeEloAnswerForDisplay(value) {
    const forbiddenLine = /^\s*(?:guardar|não guardar|nao guardar|guardar na biblioteca|não guardar na biblioteca|nao guardar na biblioteca|guardar biblioteca|memória|memoria|biblioteca|não salvar|nao salvar)\s*$/i;
    const forbiddenControlsLine = /^\s*(?:[\s.,;:|•·-]+|guardar|não guardar|nao guardar|guardar na biblioteca|não guardar na biblioteca|nao guardar na biblioteca|memória|memoria|biblioteca|não salvar|nao salvar)+\s*$/i;
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/Deseja guardar isso para eu lembrar depois\??/gi, "")
      .replace(/Deseja guardar isso na Biblioteca do Elo\??/gi, "")
      .replace(/Deseja guardar isso na Biblioteca\??/gi, "")
      .replace(/Deseja guardar isso para a Biblioteca\??/gi, "")
      .replace(/Salvar esta conversa\??/gi, "")
      .replace(/\s*Guardar\s*[.,;:|•·-]+\s*Não guardar\s*[.,;:|•·-]+\s*Guardar na Biblioteca\s*[.,;:|•·-]+\s*Não guardar na Biblioteca\s*$/gi, "")
      .replace(/\s*Guardar\s*[.,;:|•·-]+\s*Nao guardar\s*[.,;:|•·-]+\s*Guardar na Biblioteca\s*[.,;:|•·-]+\s*Nao guardar na Biblioteca\s*$/gi, "")
      .replace(/\bGuardar na Biblioteca\b/gi, "")
      .replace(/\bNão guardar na Biblioteca\b/gi, "")
      .replace(/\bNao guardar na Biblioteca\b/gi, "")
      .split(/\r?\n/)
      .filter(function (line) {
        return !forbiddenLine.test(line) && !forbiddenControlsLine.test(line);
      })
      .map(function (line) {
        return line.replace(/\s+/g, " ").trim();
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeEloSavePrompt(savePrompt) {
    if (!savePrompt || typeof savePrompt !== "object" || typeof savePrompt.show !== "boolean") {
      return null;
    }
    const show = savePrompt.show === true;
    const suggestedTarget = show ? sanitizeUserText(savePrompt.suggestedTarget || savePrompt.type || "memory") : "none";
    return {
      show: show,
      type: show && suggestedTarget === "library" ? "library" : (show ? "memory" : "none"),
      suggestedTarget: show ? suggestedTarget : "none",
      reason: sanitizeUserText(savePrompt.reason || "")
    };
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

  // ELO_USER_PROFILE_LOCAL
  function normalizeUserProfile(profile) {
    return {
      userName: sanitizeLibraryText(profile && profile.userName, 80),
      mainProject: sanitizeLibraryText(profile && profile.mainProject, 140),
      weeklyGoal: sanitizeLibraryText(profile && profile.weeklyGoal, 180),
      expectedHelp: sanitizeLibraryText(profile && profile.expectedHelp, 260),
      answerStyle: normalizeText(profile && profile.answerStyle).indexOf("detal") >= 0 ? "detalhadas" : "curtas",
      updatedAt: sanitizeUserText(profile && profile.updatedAt)
    };
  }

  function getUserProfile() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.userProfileStorageKey);
      return normalizeUserProfile(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return normalizeUserProfile(null);
    }
  }

  function setUserProfile(profile) {
    try {
      const normalizedProfile = normalizeUserProfile(Object.assign({}, profile, {
        updatedAt: new Date().toISOString()
      }));
      window.localStorage.setItem(ELO_CONFIG.userProfileStorageKey, JSON.stringify(normalizedProfile));
      return normalizedProfile;
    } catch (error) {
      return normalizeUserProfile(null);
    }
  }

  function normalizeInitialProfile(profile) {
    return {
      nome: sanitizeLibraryText(profile && profile.nome, 80),
      profissao: sanitizeLibraryText(profile && profile.profissao, 120),
      empresa: sanitizeLibraryText(profile && profile.empresa, 160),
      cidade: sanitizeLibraryText(profile && profile.cidade, 140),
      areas: Array.isArray(profile && profile.areas) ? profile.areas.map(function (item) {
        return sanitizeLibraryText(item, 100);
      }).filter(Boolean).slice(0, 20) : [],
      projetos: Array.isArray(profile && profile.projetos) ? profile.projetos.map(function (item) {
        return sanitizeLibraryText(item, 120);
      }).filter(Boolean).slice(0, 20) : [],
      objetivos: Array.isArray(profile && profile.objetivos) ? profile.objetivos.map(function (item) {
        return sanitizeLibraryText(item, 180);
      }).filter(Boolean).slice(0, 20) : [],
      preferencias: Array.isArray(profile && profile.preferencias) ? profile.preferencias.map(function (item) {
        return sanitizeLibraryText(item, 180);
      }).filter(Boolean).slice(0, 20) : [],
      fonte: sanitizeUserText(profile && profile.fonte) || "importacao_manual",
      createdAt: sanitizeUserText(profile && profile.createdAt),
      updatedAt: sanitizeUserText(profile && profile.updatedAt)
    };
  }

  function getInitialProfile() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.initialProfileStorageKey);
      return normalizeInitialProfile(raw ? JSON.parse(raw) : null);
    } catch (error) {
      return normalizeInitialProfile(null);
    }
  }

  function setInitialProfile(profile) {
    const current = getInitialProfile();
    const now = new Date().toISOString();
    const normalizedProfile = normalizeInitialProfile(Object.assign({}, profile, {
      fonte: "importacao_manual",
      createdAt: current.createdAt || now,
      updatedAt: now
    }));
    try {
      window.localStorage.setItem(ELO_CONFIG.initialProfileStorageKey, JSON.stringify(normalizedProfile));
    } catch (error) {
      // Perfil inicial fica apenas no navegador. Se falhar, o Elo segue sem salvar.
    }
    return normalizedProfile;
  }

  function mergeUniqueTextItems() {
    const values = Array.prototype.slice.call(arguments).reduce(function (accumulator, value) {
      if (Array.isArray(value)) {
        return accumulator.concat(value);
      }
      if (value) {
        accumulator.push(value);
      }
      return accumulator;
    }, []);
    const seen = {};
    return values.map(function (item) {
      return sanitizeLibraryText(item, 180);
    }).filter(function (item) {
      const normalized = normalizeText(item);
      if (!normalized || seen[normalized]) {
        return false;
      }
      seen[normalized] = true;
      return true;
    });
  }

  function extractInitialProfileFromText(rawText) {
    const cleanText = sanitizeLibraryText(rawText, 8000);
    const normalized = normalizeText(cleanText);
    const profile = normalizeInitialProfile(null);
    let match = cleanText.match(/(?:meu nome é|meu nome e|me chamo|eu me chamo)\s+([A-ZÁÉÍÓÚÊÔÃÕÇ][\wÀ-ÿ]+(?:\s+[A-ZÁÉÍÓÚÊÔÃÕÇ][\wÀ-ÿ]+){0,3})/i);
    if (match && match[1]) {
      profile.nome = sanitizeLibraryText(match[1], 80).replace(/[.,;:]+$/g, "");
    }

    const professionMap = [
      ["engenheiro civil", "Engenheiro Civil"],
      ["engenheira civil", "Engenheira Civil"],
      ["arquiteto", "Arquiteto"],
      ["arquiteta", "Arquiteta"],
      ["técnico em edificações", "Técnico em Edificações"],
      ["tecnico em edificacoes", "Técnico em Edificações"],
      ["perito", "Perito"],
      ["perita", "Perita"]
    ];
    const profession = professionMap.find(function (item) {
      return normalized.indexOf(normalizeText(item[0])) >= 0;
    });
    if (profession) {
      profile.profissao = profession[1];
    } else {
      match = cleanText.match(/\bsou\s+([^.\n]{4,80})/i);
      if (match && match[1] && !hasAnyTerm(normalizeText(match[1]), ["desenvolvendo", "trabalhando com", "com pressa"])) {
        profile.profissao = sanitizeLibraryText(match[1], 120).replace(/[.,;:]+$/g, "");
      }
    }

    match = cleanText.match(/(?:minha empresa é|minha empresa e|empresa chamada|trabalho na|trabalho em)\s+([^.\n]{3,120})/i);
    if (match && match[1]) {
      profile.empresa = sanitizeLibraryText(match[1], 160).replace(/[.,;:]+$/g, "");
    } else if (hasAnyTerm(normalized, ["empresa propria", "empresa própria", "tenho empresa"])) {
      profile.empresa = "empresa própria";
    }

    match = cleanText.match(/(?:moro em|cidade é|cidade e|atuo em)\s+([^.\n]{3,100})/i);
    if (match && match[1]) {
      profile.cidade = sanitizeLibraryText(match[1], 140).replace(/[.,;:]+$/g, "");
    }

    const areaCandidates = [
      ["pericias", "perícias"],
      ["perícias", "perícias"],
      ["projetos", "projetos"],
      ["obras", "obras"],
      ["relatorios", "relatórios"],
      ["relatórios", "relatórios"],
      ["rdo", "RDO"],
      ["materiais", "materiais"],
      ["auditoria de consumo", "auditoria de consumo"],
      ["laudos", "laudos"],
      ["engenharia", "engenharia"],
      ["construcao", "construção"],
      ["construção", "construção"]
    ];
    profile.areas = areaCandidates.filter(function (item) {
      return normalized.indexOf(normalizeText(item[0])) >= 0;
    }).map(function (item) {
      return item[1];
    });

    const knownProjects = ["CADISTA", "Stock Full", "Elo", "Stock Saúde", "ObraReport"];
    profile.projetos = knownProjects.filter(function (project) {
      return normalized.indexOf(normalizeText(project)) >= 0;
    });
    const projectMatch = cleanText.match(/(?:estou desenvolvendo|desenvolvendo|projeto chamado|projeto principal é|projeto principal e)\s+([^.\n]{3,100})/i);
    if (projectMatch && projectMatch[1]) {
      profile.projetos = mergeUniqueTextItems(profile.projetos, extractImportantTitle(projectMatch[1]));
    }

    const objectiveMatches = cleanText.match(/(?:meu objetivo é|meu objetivo e|objetivo é|objetivo e|quero)\s+([^.\n]{4,180})/gi) || [];
    profile.objetivos = objectiveMatches.map(function (item) {
      return item.replace(/^(meu objetivo é|meu objetivo e|objetivo é|objetivo e|quero)\s+/i, "").replace(/[.,;:]+$/g, "");
    });
    if (hasAnyTerm(normalized, ["primeiros clientes", "vender saas", "vender o obrareport"])) {
      profile.objetivos = mergeUniqueTextItems(profile.objetivos, "conseguir os primeiros clientes");
    }
    if (hasAnyTerm(normalized, ["desenvolvimento de software", "desenvolvendo software", "desenvolver software"])) {
      profile.objetivos = mergeUniqueTextItems(profile.objetivos, "desenvolvimento de software");
    }

    const preferenceMatches = cleanText.match(/(?:prefiro|gosto de)\s+([^.\n]{4,180})/gi) || [];
    profile.preferencias = preferenceMatches.map(function (item) {
      return item.replace(/^(prefiro|gosto de)\s+/i, "").replace(/[.,;:]+$/g, "");
    });

    profile.areas = mergeUniqueTextItems(profile.areas);
    profile.projetos = mergeUniqueTextItems(profile.projetos);
    profile.objetivos = mergeUniqueTextItems(profile.objetivos);
    profile.preferencias = mergeUniqueTextItems(profile.preferencias);
    return profile;
  }

  function formatUnknown(value) {
    if (Array.isArray(value)) {
      return value.length ? value.join(", ") : "não identificado";
    }
    return value || "não identificado";
  }

  function formatInitialProfileExtraction(profile) {
    return [
      "Encontrei estas informações:",
      "",
      "Nome: " + formatUnknown(profile.nome),
      "Profissão: " + formatUnknown(profile.profissao),
      "Empresa: " + formatUnknown(profile.empresa),
      "Cidade/local: " + formatUnknown(profile.cidade),
      "Áreas: " + formatUnknown(profile.areas),
      "Projetos: " + formatUnknown(profile.projetos),
      "Objetivos: " + formatUnknown(profile.objetivos),
      "Preferências: " + formatUnknown(profile.preferencias)
    ].join("\n");
  }

  function saveInitialProfileExtraction(profile, options) {
    const current = getInitialProfile();
    const selected = options || {
      profile: true,
      projects: true,
      goals: true,
      preferences: true
    };
    const mergedProfile = setInitialProfile({
      nome: selected.profile ? (profile.nome || current.nome) : current.nome,
      profissao: selected.profile ? (profile.profissao || current.profissao) : current.profissao,
      empresa: selected.profile ? (profile.empresa || current.empresa) : current.empresa,
      cidade: selected.profile ? (profile.cidade || current.cidade) : current.cidade,
      areas: selected.profile ? mergeUniqueTextItems(current.areas, profile.areas) : current.areas,
      projetos: selected.projects ? mergeUniqueTextItems(current.projetos, profile.projetos) : current.projetos,
      objetivos: selected.goals ? mergeUniqueTextItems(current.objetivos, profile.objetivos) : current.objetivos,
      preferencias: selected.preferences ? mergeUniqueTextItems(current.preferencias, profile.preferencias) : current.preferencias
    });

    if (selected.projects) {
      (profile.projetos || []).forEach(function (project) {
        saveImportantMemory({
          tipo: "projeto",
          titulo: project,
          descricao: "Projeto detectado na importação inicial de perfil.",
          status: "ativo",
          sourceQuestion: "importação inicial de perfil"
        }, "projeto");
      });
    }
    if (selected.goals) {
      (profile.objetivos || []).forEach(function (goal) {
        saveImportantMemory({
          tipo: "objetivo",
          titulo: goal,
          descricao: goal,
          status: "ativo",
          sourceQuestion: "importação inicial de perfil"
        }, "objetivo");
      });
    }
    if (selected.preferences) {
      (profile.preferencias || []).forEach(function (preference) {
        saveImportantMemory({
          tipo: "preferencia",
          titulo: preference,
          descricao: preference,
          status: "ativo",
          sourceQuestion: "importação inicial de perfil"
        }, "preferencia");
      });
    }

    const userProfile = getUserProfile();
    setUserProfile({
      userName: userProfile.userName || mergedProfile.nome,
      mainProject: userProfile.mainProject || (mergedProfile.projetos[0] || ""),
      weeklyGoal: userProfile.weeklyGoal || (mergedProfile.objetivos[0] || ""),
      expectedHelp: userProfile.expectedHelp || (mergedProfile.areas.length ? "ajuda com " + mergedProfile.areas.join(", ") : ""),
      answerStyle: userProfile.answerStyle || "curtas"
    });

    return mergedProfile;
  }

  function getInitialProfileSummary() {
    const profile = getInitialProfile();
    const lines = [];
    if (profile.nome) {
      lines.push("você se chama " + profile.nome);
    }
    if (profile.profissao) {
      lines.push("é " + profile.profissao);
    }
    if (profile.empresa) {
      lines.push("trabalha com " + profile.empresa);
    }
    if (profile.areas.length) {
      lines.push("atua com " + profile.areas.join(", "));
    }
    if (profile.projetos.length) {
      lines.push("tem como projeto " + profile.projetos.join(", "));
    }
    if (profile.objetivos.length) {
      lines.push("tem como objetivo " + profile.objetivos.join(", "));
    }
    if (!lines.length) {
      return "";
    }
    return "Pelo que você me autorizou a guardar, " + lines.join(", ") + ".";
  }

  function getPreferredUserName() {
    const profile = getUserProfile();
    if (profile.userName) {
      return profile.userName;
    }
    const personalName = findPersonalMemoryByLabel("meu nome");
    return personalName && personalName.value ? personalName.value : "";
  }

  function prefixWithUserName(text) {
    const name = getPreferredUserName();
    if (!name || !text) {
      return text;
    }
    return name + ", " + text.charAt(0).toLowerCase() + text.slice(1);
  }

  function getUserProfileContextLine() {
    const profile = getUserProfile();
    const lines = [];
    if (profile.mainProject) {
      lines.push("Seu projeto principal informado é " + profile.mainProject + ".");
    }
    if (profile.weeklyGoal) {
      lines.push("Seu objetivo principal desta semana é " + profile.weeklyGoal + ".");
    }
    if (profile.expectedHelp) {
      lines.push("Você espera minha ajuda principalmente com: " + profile.expectedHelp + ".");
    }
    if (profile.answerStyle) {
      lines.push("Preferência de resposta: " + profile.answerStyle + ".");
    }
    return lines.join("\n");
  }

  function getConnectedMemorySnapshot() {
    const userProfile = getUserProfile();
    const initialProfile = getInitialProfile();
    const personalMemories = getPersonalMemories();
    const libraryItems = getLibraryItems();
    const important = getImportantMemoriesStorage();
    const timeline = getTimelineStorage();
    const events = (timeline.events || []).slice().sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    const projects = [];
    const goals = [];
    const preferences = [];

    function addUnique(list, value) {
      const cleanValue = sanitizeLibraryText(value, 180);
      if (!cleanValue) {
        return;
      }
      const exists = list.some(function (item) {
        return normalizeText(item) === normalizeText(cleanValue);
      });
      if (!exists) {
        list.push(cleanValue);
      }
    }

    addUnique(projects, userProfile.mainProject);
    (initialProfile.projetos || []).forEach(function (item) { addUnique(projects, item); });
    (important.projetos || []).forEach(function (item) { addUnique(projects, item.titulo); });
    events.forEach(function (event) { addUnique(projects, event.project); });

    addUnique(goals, userProfile.weeklyGoal);
    (initialProfile.objetivos || []).forEach(function (item) { addUnique(goals, item); });
    (important.objetivos || []).filter(function (item) {
      return item.status !== "concluido" && item.status !== "arquivado";
    }).forEach(function (item) { addUnique(goals, item.titulo || item.descricao); });

    (initialProfile.preferencias || []).forEach(function (item) { addUnique(preferences, item); });
    (important.preferencias || []).forEach(function (item) { addUnique(preferences, item.titulo || item.descricao); });

    const projectCounts = {};
    projects.forEach(function (project) {
      projectCounts[project] = (projectCounts[project] || 0) + 1;
    });
    events.forEach(function (event) {
      if (event.project) {
        projectCounts[event.project] = (projectCounts[event.project] || 0) + 2;
      }
      ["ObraReport", "Elo", "Stock IA", "CADISTA IA"].forEach(function (projectName) {
        const haystack = normalizeText([event.title, event.content, event.tags && event.tags.join(" ")].join(" "));
        if (haystack.indexOf(normalizeText(projectName)) >= 0) {
          projectCounts[projectName] = (projectCounts[projectName] || 0) + 1;
        }
      });
    });

    let mostMentionedProject = "";
    Object.keys(projectCounts).forEach(function (project) {
      if (!mostMentionedProject || projectCounts[project] > projectCounts[mostMentionedProject]) {
        mostMentionedProject = project;
      }
    });

    return {
      userName: userProfile.userName || initialProfile.nome || getPreferredUserName(),
      profession: initialProfile.profissao,
      company: initialProfile.empresa,
      areas: initialProfile.areas || [],
      mainProject: userProfile.mainProject || initialProfile.projetos[0] || projects[0] || "",
      goals: goals,
      preferences: preferences,
      projects: projects,
      personalMemories: personalMemories,
      libraryItems: libraryItems,
      recentMilestones: events.filter(function (event) { return event.type === "marco"; }).slice(0, 3),
      mostMentionedProject: mostMentionedProject,
      latestAchievement: events.find(function (event) { return event.type === "conquista"; }) || null,
      latestImportantEvent: events.find(function (event) { return event.importance === "alta"; }) || events[0] || null,
      recentEvents: events.slice(0, 5),
      important: important
    };
  }

  function hasConnectedMemoryData(snapshot) {
    return Boolean(
      snapshot.userName ||
      snapshot.profession ||
      snapshot.company ||
      snapshot.mainProject ||
      snapshot.goals.length ||
      snapshot.preferences.length ||
      snapshot.projects.length ||
      snapshot.personalMemories.length ||
      snapshot.libraryItems.length ||
      snapshot.recentEvents.length
    );
  }

  function formatMissingConnectedInfo(label, value) {
    return value ? value : label + ": Ainda não tenho essa informação salva.";
  }

  function formatConnectedProfileSummary(snapshot) {
    const intro = [];
    if (snapshot.userName) {
      intro.push(snapshot.userName);
    }
    const facts = [];
    if (snapshot.profession) {
      facts.push("você é " + snapshot.profession);
    }
    if (snapshot.company) {
      facts.push("trabalha com " + snapshot.company);
    }
    if (snapshot.areas.length) {
      facts.push("atua com " + snapshot.areas.slice(0, 4).join(", "));
    }
    if (snapshot.mainProject) {
      facts.push("está desenvolvendo " + snapshot.mainProject);
    }
    if (snapshot.goals.length) {
      facts.push("tem como foco " + snapshot.goals.slice(0, 2).join(", "));
    }

    if (!facts.length) {
      return "Ainda não tenho essa informação salva.";
    }

    return (intro.length ? intro[0] + ", pelo que você autorizou guardar, " : "Pelo que você autorizou guardar, ") + facts.join(", ") + ".";
  }

  function formatTimelineMemoryLine(event) {
    if (!event) {
      return "Ainda não tenho essa informação salva.";
    }
    return event.title + (event.project ? " (" + event.project + ")" : "") + " - " + formatDateTime(event.createdAt);
  }

  function formatNarrativeList(items) {
    const cleanItems = (items || []).filter(Boolean);
    if (!cleanItems.length) {
      return "";
    }
    if (cleanItems.length === 1) {
      return cleanItems[0];
    }
    if (cleanItems.length === 2) {
      return cleanItems[0] + " e " + cleanItems[1];
    }
    return cleanItems.slice(0, -1).join(", ") + " e " + cleanItems[cleanItems.length - 1];
  }

  function formatPersonalMemoryNarrative(memories) {
    const safeMemories = (memories || []).slice(0, 3).map(function (memoryItem) {
      return memoryItem.label && memoryItem.value ? memoryItem.label + ": " + memoryItem.value : "";
    }).filter(Boolean);
    return safeMemories.length ? formatNarrativeList(safeMemories) : "";
  }

  function buildNarrativeMemoryPieces(snapshot) {
    const projects = (snapshot.projects || []).slice(0, 4);
    const goals = (snapshot.goals || []).slice(0, 3);
    const preferences = (snapshot.preferences || []).slice(0, 3);
    const libraryTitles = (snapshot.libraryItems || []).slice(0, 3).map(function (item) {
      return item.title;
    }).filter(Boolean);
    const recentEvent = snapshot.latestImportantEvent || snapshot.latestAchievement || snapshot.recentEvents[0] || null;
    const identityParts = [];

    if (snapshot.profession) {
      identityParts.push("você é " + snapshot.profession);
    }
    if (snapshot.company) {
      identityParts.push("trabalha com " + snapshot.company);
    }
    if (snapshot.areas && snapshot.areas.length) {
      identityParts.push("atua com " + formatNarrativeList(snapshot.areas.slice(0, 3)));
    }

    return {
      name: snapshot.userName || "",
      identityParts: identityParts,
      projects: projects,
      goals: goals,
      preferences: preferences,
      personalLine: formatPersonalMemoryNarrative(snapshot.personalMemories),
      libraryTitles: libraryTitles,
      recentEvent: recentEvent,
      focus: snapshot.mainProject || snapshot.mostMentionedProject || projects[0] || goals[0] || ""
    };
  }

  function buildLowMemoryNarrativeAnswer() {
    return [
      "Ainda estou te conhecendo.",
      "Por enquanto, tenho pouca coisa autorizada sobre você. Se você registrar projetos, objetivos, preferências ou acontecimentos na Linha do Tempo, eu consigo acompanhar sua jornada com mais contexto.",
      "Eu não vou inventar fatos sobre você. Prefiro te responder com cuidado."
    ].join("\n\n");
  }

  function hasNarrativeJourneyData(snapshot) {
    return Boolean(
      snapshot.profession ||
      snapshot.company ||
      (snapshot.areas && snapshot.areas.length) ||
      snapshot.mainProject ||
      snapshot.goals.length ||
      snapshot.preferences.length ||
      snapshot.projects.length ||
      snapshot.personalMemories.length ||
      snapshot.libraryItems.length ||
      snapshot.recentEvents.length
    );
  }

  function buildNarrativeMemoryAnswer(snapshot) {
    if (!hasNarrativeJourneyData(snapshot)) {
      return buildLowMemoryNarrativeAnswer();
    }

    const pieces = buildNarrativeMemoryPieces(snapshot);
    const sentences = [];
    const introName = pieces.name ? pieces.name + ", pelo que eu lembro, " : "Pelo que eu lembro, ";
    if (pieces.identityParts.length) {
      sentences.push(introName + formatNarrativeList(pieces.identityParts) + ".");
    }

    if (pieces.projects.length) {
      sentences.push("O que mais aparece na sua jornada é sua ligação com " + formatNarrativeList(pieces.projects) + ".");
    } else if (snapshot.mainProject) {
      sentences.push("Você tem dedicado energia a " + snapshot.mainProject + ".");
    }

    if (pieces.goals.length) {
      sentences.push("Seu foco atual parece passar por " + formatNarrativeList(pieces.goals) + ".");
    }

    if (pieces.preferences.length) {
      sentences.push("Algo que chama atenção nas suas preferências é " + formatNarrativeList(pieces.preferences) + ".");
    }

    if (pieces.personalLine) {
      sentences.push("Você também me confiou algumas memórias pessoais, como " + pieces.personalLine + ".");
    }

    if (pieces.recentEvent) {
      sentences.push("Ao olhar sua trajetória recente, aparece o registro \"" + pieces.recentEvent.title + "\"" + (pieces.recentEvent.project ? " ligado a " + pieces.recentEvent.project : "") + ".");
    } else if (snapshot.recentEvents.length) {
      sentences.push("Sua Linha do Tempo já tem registros que ajudam a perceber continuidade na sua caminhada.");
    }

    if (pieces.libraryTitles.length) {
      sentences.push("Na sua Biblioteca, aparecem referências como " + formatNarrativeList(pieces.libraryTitles) + ".");
    }

    if (!sentences.length) {
      sentences.push("Ainda estou te conhecendo, mas já existe contexto suficiente para começar a formar uma visão melhor da sua jornada.");
    }

    sentences.push("Tudo isso vem apenas do que você autorizou guardar neste navegador.");
    return sentences.join("\n\n");
  }

  function buildEloJourneyAnswer(snapshot) {
    if (!hasNarrativeJourneyData(snapshot)) {
      return buildLowMemoryNarrativeAnswer();
    }
    const pieces = buildNarrativeMemoryPieces(snapshot);
    const lines = [];
    const namePrefix = pieces.name ? pieces.name + ", " : "";
    lines.push(namePrefix + "ao olhar sua trajetória, o que mais aparece é a tentativa de transformar ideias em algo organizado e útil.");
    if (pieces.projects.length) {
      lines.push("Você tem dedicado energia a " + formatNarrativeList(pieces.projects) + ".");
    }
    if (pieces.goals.length) {
      lines.push("O foco atual parece estar em " + formatNarrativeList(pieces.goals) + ".");
    } else if (pieces.focus) {
      lines.push("O foco que mais se destaca agora é " + pieces.focus + ".");
    }
    if (pieces.recentEvent) {
      lines.push("O acontecimento recente que mais pesa nessa leitura é \"" + pieces.recentEvent.title + "\".");
    }
    lines.push("Próxima ação sugerida:\nconcluir o ciclo atual antes de abrir uma nova frente grande.");
    return lines.join("\n\n");
  }

  function buildEloPerceptionAnswer(snapshot) {
    if (!hasNarrativeJourneyData(snapshot)) {
      return buildLowMemoryNarrativeAnswer();
    }
    const pieces = buildNarrativeMemoryPieces(snapshot);
    const signals = collectProjectSignals(snapshot);
    const dominant = signals[0] && signals[0].name;
    const lines = [];
    lines.push("Um padrão que eu percebo em você é transformar problemas reais em ferramentas.");
    if (signals.length) {
      lines.push("Os temas que mais voltam são " + formatNarrativeList(signals.slice(0, 4).map(function (signal) { return signal.name; })) + ".");
    } else if (pieces.projects.length) {
      lines.push("Os projetos que mais aparecem são " + formatNarrativeList(pieces.projects) + ".");
    }
    if (pieces.goals.length) {
      lines.push("O que parece puxar sua energia agora é " + formatNarrativeList(pieces.goals) + ".");
    } else if (dominant) {
      lines.push("O centro de gravidade parece ser " + dominant + ".");
    }
    lines.push("Eu diria isso com cuidado: o desafio não parece ser falta de ideia, e sim escolher qual entrega merece fechar primeiro.");
    return lines.join("\n\n");
  }

  function buildEloEvolutionAnswer(snapshot) {
    if (!hasNarrativeJourneyData(snapshot)) {
      return buildLowMemoryNarrativeAnswer();
    }
    const pieces = buildNarrativeMemoryPieces(snapshot);
    const projectLine = pieces.projects.length ? formatNarrativeList(pieces.projects) : (pieces.focus || "seus projetos principais");
    const projectVerb = pieces.projects.length === 1 ? "começa" : "começam";
    const focusLine = pieces.goals.length ? formatNarrativeList(pieces.goals) : (pieces.focus || "concluir uma entrega útil");
    return [
      "Pelo que eu acompanho, algo mudou: seus projetos parecem menos soltos e mais conectados entre si.",
      "O que mudou:\n" + projectLine + " " + projectVerb + " a aparecer como parte de uma mesma construção.",
      "O que continua igual:\nsua tendência de transformar problemas reais em sistemas, produtos e rotinas.",
      "Foco atual:\n" + focusLine + ".",
      "Próxima ação sugerida:\nterminar o ciclo atual antes de abrir uma nova frente grande."
    ].join("\n\n");
  }

  function buildEloFocusAnswer(snapshot) {
    if (!hasNarrativeJourneyData(snapshot)) {
      return buildLowMemoryNarrativeAnswer();
    }
    const pieces = buildNarrativeMemoryPieces(snapshot);
    const lines = [];
    if (pieces.focus) {
      lines.push("Pelo que eu lembro, seu foco atual parece ser " + pieces.focus + ".");
    }
    if (pieces.goals.length) {
      lines.push("Os objetivos que mais aparecem agora são " + formatNarrativeList(pieces.goals) + ".");
    }
    if (pieces.projects.length) {
      lines.push("Você vem trabalhando principalmente em " + formatNarrativeList(pieces.projects) + ".");
    }
    lines.push("Próxima ação sugerida:\nescolher uma entrega pequena que deixe esse foco mais concreto.");
    return lines.join("\n\n");
  }

  function detectNarrativeMemoryQuestion(message) {
    const text = normalizeText(message);
    if (hasAnyTerm(text, ["eu evolui", "eu evoluí", "o que mudou em mim", "minha evolucao", "minha evolução"])) {
      return "evolution";
    }
    if (hasAnyTerm(text, ["qual padrao voce percebe em mim", "qual padrão você percebe em mim", "o que voce percebe sobre mim", "o que você percebe sobre mim", "que padrao voce percebe", "que padrão você percebe"])) {
      return "perception";
    }
    if (hasAnyTerm(text, ["o que voce acha da minha jornada", "o que você acha da minha jornada", "como esta minha jornada", "como está minha jornada", "minha jornada"])) {
      return "journey";
    }
    if (hasAnyTerm(text, ["no que estou trabalhando", "no que eu estou trabalhando", "qual meu foco atual", "qual e meu foco atual", "qual é meu foco atual", "qual meu foco agora", "meu foco agora"])) {
      return "focus";
    }
    if (hasAnyTerm(text, ["quem sou eu", "o que voce sabe sobre mim", "o que você sabe sobre mim", "o que voce lembra de mim", "o que você lembra de mim", "o que lembra de mim"])) {
      return "memory";
    }
    return null;
  }

  function getNarrativeMemoryResponse(question) {
    const intent = detectNarrativeMemoryQuestion(question);
    if (!intent) {
      return null;
    }
    const snapshot = getConnectedMemorySnapshot();
    const answerMap = {
      memory: buildNarrativeMemoryAnswer(snapshot),
      journey: buildEloJourneyAnswer(snapshot),
      perception: buildEloPerceptionAnswer(snapshot),
      evolution: buildEloEvolutionAnswer(snapshot),
      focus: buildEloFocusAnswer(snapshot)
    };
    return {
      shortAnswer: hasNarrativeJourneyData(snapshot) ? "Pelo que eu lembro, já dá para perceber alguns traços da sua jornada." : "Ainda estou te conhecendo.",
      fullAnswer: answerMap[intent] || buildNarrativeMemoryAnswer(snapshot),
      nextAction: "Se quiser, posso transformar isso em um próximo passo prático.",
      canSave: false,
      sessionTheme: "memoria",
      sessionIntent: "memoria_narrativa"
    };
  }

  function buildConnectedGreeting() {
    return "Oi, tudo bem? Me diz no que eu posso te ajudar";
  }

  function buildPremiumWelcomeMessage_() {
    const identity = buildEloIdentityContext();
    const lines = [
      "Olá. Eu sou o Elo.",
      "",
      "Sou um companheiro digital criado para acompanhar sua jornada, lembrar o que importa e ajudar você a pensar com clareza.",
      "",
      "Posso ajudar você a:",
      "- organizar ideias e projetos;",
      "- lembrar informações importantes;",
      "- pensar em prioridades e decisões;",
      "- registrar momentos na linha do tempo;",
      "- transformar dúvidas em próximos passos."
    ];

    if (identity.currentMode === "obrareport") {
      lines.push(
        "",
        "Aqui dentro do ObraReport, também atuo como copiloto técnico para:",
        "- criar relatórios técnicos;",
        "- registrar RDO;",
        "- lançar materiais;",
        "- entender o Stock IA;",
        "- gerar PDFs."
      );
    }

    lines.push("", "Você não precisa saber onde clicar.", "Me diga o que quer fazer, e eu te guio.");
    return lines.join("\n");
  }

  function buildConnectedJourneyAnswer(snapshot) {
    if (!hasConnectedMemoryData(snapshot)) {
      return {
        shortAnswer: "Ainda estou te conhecendo.",
        fullAnswer: buildNarrativeMemoryAnswer(snapshot),
        nextAction: "Você pode me contar um projeto, um objetivo ou registrar um marco na Linha do Tempo.",
        canSave: false,
        sessionTheme: "memoria"
      };
    }

    return {
      shortAnswer: "Pelo que eu lembro, já dá para perceber alguns traços da sua jornada.",
      fullAnswer: buildNarrativeMemoryAnswer(snapshot),
      nextAction: "Se quiser, posso ajudar você a transformar isso em próximo passo prático.",
      canSave: false,
      sessionTheme: "memoria"
    };
  }

  function answerConnectedMemoryQuestion(question) {
    const text = normalizeText(question);
    const snapshot = getConnectedMemorySnapshot();

    if (hasAnyTerm(text, ["quem sou eu", "o que voce sabe sobre mim", "o que você sabe sobre mim", "o que voce lembra de mim", "o que você lembra de mim", "o que lembra de mim"])) {
      return buildConnectedJourneyAnswer(snapshot);
    }

    if (hasAnyTerm(text, ["quais sao meus projetos", "quais são meus projetos", "quais projetos voce lembra", "quais projetos você lembra"])) {
      return {
        shortAnswer: snapshot.projects.length ? "Estes são os projetos que encontrei nas suas memórias locais:" : "Ainda não tenho projetos salvos sobre você.",
        fullAnswer: snapshot.projects.length ? snapshot.projects.slice(0, 8).map(function (project) { return "- " + project; }).join("\n") : "Ainda não tenho essa informação salva.",
        nextAction: "Você pode registrar projetos em Memórias importantes ou na Linha do Tempo.",
        canSave: false,
        sessionTheme: "memoria"
      };
    }

    if (hasAnyTerm(text, ["como esta minha jornada", "como está minha jornada", "minha jornada"])) {
      return buildConnectedJourneyAnswer(snapshot);
    }

    if (hasAnyTerm(text, ["o que aconteceu recentemente", "aconteceu recentemente", "ultimos acontecimentos", "últimos acontecimentos"])) {
      return {
        shortAnswer: snapshot.recentEvents.length ? "Estes são os registros recentes da sua Linha do Tempo:" : "Ainda não há eventos recentes salvos na Linha do Tempo.",
        fullAnswer: snapshot.recentEvents.length ? snapshot.recentEvents.map(formatTimelineEventLine).join("\n") : "Ainda não tenho essa informação salva.",
        nextAction: "Registre marcos, ideias ou conquistas para eu acompanhar melhor sua jornada.",
        canSave: false,
        sessionTheme: "timeline"
      };
    }

    if (hasAnyTerm(text, ["qual meu foco agora", "meu foco agora", "qual e meu foco", "qual é meu foco"])) {
      return {
        shortAnswer: snapshot.goals.length || snapshot.mainProject ? "Seu foco salvo aparece nestes pontos:" : "Ainda não tenho foco atual salvo.",
        fullAnswer: [
          "Projeto principal: " + (snapshot.mainProject || "Ainda não tenho essa informação salva."),
          "Objetivos ativos:",
          snapshot.goals.length ? snapshot.goals.slice(0, 5).map(function (goal) { return "- " + goal; }).join("\n") : "- Ainda não tenho essa informação salva.",
          "",
          "Essas informações vêm das memórias locais salvas neste navegador."
        ].join("\n"),
        nextAction: "Se esse foco mudou, atualize em Configurar meu Elo ou Memórias importantes.",
        canSave: false,
        sessionTheme: "memoria"
      };
    }

    const projectMemoryMatch = text.match(/o que voce lembra d[eo] (obrareport|elo|stock ia|cadista ia|rdo|pdf)|o que você lembra d[eo] (obrareport|elo|stock ia|cadista ia|rdo|pdf)/);
    const projectName = projectMemoryMatch && (projectMemoryMatch[1] || projectMemoryMatch[2]);
    if (projectName) {
      const normalizedProjectName = normalizeText(projectName);
      const label = projectName.split(" ").map(function (part) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }).join(" ").replace("Ia", "IA").replace("Pdf", "PDF").replace("Rdo", "RDO");
      const knownLabel = {
        obrareport: "ObraReport",
        elo: "Elo",
        "stock ia": "Stock IA",
        "cadista ia": "CADISTA IA",
        rdo: "RDO",
        pdf: "PDF"
      }[normalizedProjectName] || label;
      const relatedEvents = snapshot.recentEvents.filter(function (event) {
        const haystack = normalizeText([event.project, event.title, event.content, event.tags && event.tags.join(" ")].join(" "));
        return haystack.indexOf(normalizedProjectName) >= 0;
      });
      const relatedImportant = []
        .concat(snapshot.important.projetos || [])
        .concat(snapshot.important.objetivos || [])
        .concat(snapshot.important.preferencias || [])
        .filter(function (item) {
          return normalizeText([item.titulo, item.descricao].join(" ")).indexOf(normalizedProjectName) >= 0;
        });
      return {
        shortAnswer: relatedEvents.length || relatedImportant.length ? "Encontrei memórias locais sobre " + knownLabel + "." : "Ainda não tenho memórias salvas sobre " + knownLabel + ".",
        fullAnswer: [
          "Memórias importantes:",
          relatedImportant.length ? relatedImportant.slice(0, 5).map(function (item) { return "- " + item.titulo + " — " + item.status; }).join("\n") : "- Ainda não tenho essa informação salva.",
          "",
          "Linha do tempo:",
          relatedEvents.length ? relatedEvents.slice(0, 5).map(formatTimelineEventLine).join("\n") : "- Ainda não tenho essa informação salva.",
          "",
          "Essas informações vêm das memórias locais salvas neste navegador."
        ].join("\n"),
        nextAction: "Registre novos eventos na Linha do Tempo para eu acompanhar melhor esse projeto.",
        canSave: false,
        sessionTheme: "memoria"
      };
    }

    return null;
  }

  function answerUserProfileQuestion(question) {
    const text = normalizeText(question);
    const profile = getUserProfile();
    const initialProfile = getInitialProfile();
    const initialSummary = getInitialProfileSummary();
    const hasProfile = Boolean(profile.userName || profile.mainProject || profile.weeklyGoal || profile.expectedHelp);

    if (hasAnyTerm(text, ["como me chamo", "qual meu nome", "qual e meu nome", "qual é meu nome"])) {
      return {
        shortAnswer: profile.userName || initialProfile.nome ? "Você me pediu para chamar você de " + (profile.userName || initialProfile.nome) + "." : "Ainda não sei como devo chamar você.",
        fullAnswer: profile.userName || initialProfile.nome ? "Esse nome está salvo apenas neste navegador." : "Abra Ferramentas do Elo > Configurar meu Elo para salvar seu nome localmente.",
        nextAction: "Use Configurar meu Elo para revisar essa informação.",
        canSave: false,
        sessionTheme: "elo"
      };
    }

    if (hasAnyTerm(text, ["quem sou eu", "o que voce sabe sobre mim", "o que você sabe sobre mim", "qual minha profissao", "qual minha profissão", "qual e minha profissao", "qual é minha profissão"])) {
      if (hasAnyTerm(text, ["qual minha profissao", "qual minha profissão", "qual e minha profissao", "qual é minha profissão"])) {
        return {
          shortAnswer: initialProfile.profissao ? "Sua profissão salva é " + initialProfile.profissao + "." : "Ainda não tenho uma profissão salva no seu perfil inicial.",
          fullAnswer: initialProfile.profissao ? initialSummary : "Use Importar perfil inicial para colar uma bio ou currículo e revisar antes de guardar.",
          nextAction: "Abra Ferramentas do Elo > Importar perfil inicial para atualizar.",
          canSave: false,
          sessionTheme: "elo"
        };
      }
      return {
        shortAnswer: initialSummary ? "Tenho um resumo local sobre você." : "Ainda não tenho um perfil inicial salvo sobre você.",
        fullAnswer: initialSummary || "Use Importar perfil inicial para colar uma bio, currículo ou descrição profissional. Eu vou pedir aprovação antes de guardar.",
        nextAction: "Abra Ferramentas do Elo > Importar perfil inicial para revisar ou preencher.",
        canSave: false,
        sessionTheme: "elo"
      };
    }

    if (hasAnyTerm(text, ["qual e meu projeto atual", "qual é meu projeto atual", "qual meu projeto atual", "meu projeto atual", "qual meu principal projeto"])) {
      return {
        shortAnswer: profile.mainProject || initialProfile.projetos[0] ? "Seu projeto atual informado é " + (profile.mainProject || initialProfile.projetos[0]) + "." : "Ainda não tenho um projeto atual salvo no seu perfil do Elo.",
        fullAnswer: profile.mainProject || initialProfile.projetos[0] ? (getUserProfileContextLine() || initialSummary) : "Você pode salvar isso em Ferramentas do Elo > Configurar meu Elo.",
        nextAction: profile.mainProject || initialProfile.projetos[0] ? "Posso ajudar você a definir o próximo passo desse projeto." : "Abra Configurar meu Elo e preencha o projeto principal.",
        canSave: false,
        sessionTheme: "elo"
      };
    }

    if (hasAnyTerm(text, ["voce lembra de mim", "você lembra de mim"])) {
      return {
        shortAnswer: hasProfile ? "Lembro algumas informações locais que você autorizou neste navegador." : "Ainda não tenho um perfil configurado sobre você.",
        fullAnswer: hasProfile ? getUserProfileContextLine() : "Nesta versão, posso guardar nome, projeto, objetivo, tipo de ajuda e preferência de resposta, sempre localmente.",
        nextAction: "Use Configurar meu Elo para criar ou revisar seu perfil.",
        canSave: false,
        sessionTheme: "elo"
      };
    }

    return null;
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
    return getPreferredUserName();
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
    const userProfile = getUserProfile();
    const activeProjects = getProjects().filter(function (project) {
      return project.status === "ativo";
    }).slice(0, 3);
    const details = [
      "Ainda não estou conectado ao clima real, mas posso te ajudar a começar o dia.",
      "Você pode continuar gerando relatórios, abrir o RDO, revisar materiais ou consultar sua Biblioteca."
    ];

    if (userProfile.mainProject) {
      details.push("", "Seu projeto principal informado é " + userProfile.mainProject + ".");
      if (userProfile.weeklyGoal) {
        details.push("Objetivo principal desta semana: " + userProfile.weeklyGoal + ".");
      }
      if (userProfile.expectedHelp) {
        details.push("Posso ajudar principalmente com: " + userProfile.expectedHelp + ".");
      }
    } else if (mainProject) {
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

  function normalizeCustomConcept(concept) {
    const title = sanitizeLibraryText(concept && concept.title, 100);
    const keywords = Array.isArray(concept && concept.keywords) ? concept.keywords : String(concept && concept.keywords || "").split(",");
    return {
      id: sanitizeLibraryText(concept && concept.id, 80) || "custom_concept_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
      title: title,
      keywords: keywords.map(function (keyword) {
        return sanitizeLibraryText(keyword, 40);
      }).filter(Boolean).slice(0, 12),
      shortAnswer: sanitizeLibraryText(concept && concept.shortAnswer, 500),
      perspectives: {
        grega: "",
        estoica: "",
        biblica: "",
        moderna: "",
        icaro: sanitizeLibraryText(concept && concept.icaro, 500)
      },
      eloReflection: sanitizeLibraryText(concept && concept.eloReflection, 500),
      followUpQuestions: ["Quer aprofundar esse conceito ou relacionar com sua vida prática?"],
      custom: true,
      createdAt: sanitizeLibraryText(concept && concept.createdAt, 40) || new Date().toISOString()
    };
  }

  function getCustomConceptsStorage() {
    try {
      const raw = window.localStorage.getItem(ELO_CONFIG.conceptsCustomStorageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        concepts: Array.isArray(parsed && parsed.concepts) ? parsed.concepts.map(normalizeCustomConcept).filter(function (item) {
          return item.title && item.shortAnswer;
        }).slice(0, 80) : []
      };
    } catch (error) {
      return { concepts: [] };
    }
  }

  function setCustomConceptsStorage(storage) {
    try {
      window.localStorage.setItem(ELO_CONFIG.conceptsCustomStorageKey, JSON.stringify({
        concepts: Array.isArray(storage && storage.concepts) ? storage.concepts.map(normalizeCustomConcept).filter(function (item) {
          return item.title && item.shortAnswer;
        }).slice(0, 80) : []
      }));
    } catch (error) {
      // Conceitos personalizados ficam locais. Se falhar, o Elo segue com a base fixa.
    }
  }

  function saveCustomConcept(input) {
    const concept = normalizeCustomConcept(input || {});
    if (!concept.title || !concept.shortAnswer) {
      return { ok: false, reason: "missing" };
    }
    if (hasSensitiveMemoryTerm([concept.title, concept.shortAnswer, concept.perspectives.icaro, concept.eloReflection].join(" "))) {
      return { ok: false, reason: "sensitive" };
    }
    const storage = getCustomConceptsStorage();
    storage.concepts = storage.concepts.filter(function (item) {
      return normalizeText(item.title) !== normalizeText(concept.title);
    });
    storage.concepts.unshift(concept);
    setCustomConceptsStorage(storage);
    return { ok: true, concept: concept };
  }

  function getAllConcepts() {
    return ELO_CONCEPTS.concat(getCustomConceptsStorage().concepts || []);
  }

  function findConceptByQuestion(question) {
    const text = normalizeText(question);
    const direct = text.match(/o que (?:e|é) ([a-z0-9çãõáéíóúâêô ]+)\??$/i);
    const directTerm = direct && direct[1] ? normalizeText(direct[1]) : "";
    let best = null;
    let bestScore = 0;
    getAllConcepts().forEach(function (concept) {
      let score = 0;
      const title = normalizeText(concept.title);
      if (directTerm && (title === directTerm || directTerm.indexOf(title) >= 0 || title.indexOf(directTerm) >= 0)) {
        score += 8;
      }
      if (text.indexOf(title) >= 0) {
        score += 5;
      }
      (concept.keywords || []).forEach(function (keyword) {
        if (text.indexOf(normalizeText(keyword)) >= 0) {
          score += 3;
        }
      });
      if (score > bestScore) {
        bestScore = score;
        best = concept;
      }
    });
    return bestScore >= 3 ? best : null;
  }

  function buildConceptPerspectiveLines(concept, question) {
    const normalizedQuestion = normalizeText(question);
    const priority = [];
    if (hasAnyTerm(normalizedQuestion, ["deus", "biblia", "bíblia", "fe", "fé", "alma", "morte"])) {
      priority.push("biblica");
    }
    if (hasAnyTerm(normalizedQuestion, ["icaro", "ícaro", "palpavel", "palpável", "digital", "elo", "ia", "exist"])) {
      priority.push("icaro");
    }
    ["grega", "estoica", "moderna", "icaro", "biblica"].forEach(function (key) {
      if (priority.indexOf(key) < 0) {
        priority.push(key);
      }
    });
    return priority.filter(function (key) {
      return concept.perspectives && concept.perspectives[key];
    }).slice(0, 4).map(function (key) {
      const labels = {
        grega: "Grega",
        estoica: "Estoica",
        biblica: "Bíblica/cristã",
        moderna: "Moderna",
        icaro: "Visão do Ícaro"
      };
      return "- " + labels[key] + ": " + concept.perspectives[key];
    });
  }

  function buildConceptResponse(concept, question) {
    const perspectiveLines = buildConceptPerspectiveLines(concept, question);
    return {
      shortAnswer: concept.shortAnswer,
      fullAnswer: [
        "Perspectivas:",
        perspectiveLines.join("\n"),
        "",
        "Reflexão do Elo:",
        concept.eloReflection || "Esse conceito merece ser pensado com calma, sem transformar uma resposta curta em verdade absoluta."
      ].join("\n"),
      nextAction: (concept.followUpQuestions && concept.followUpQuestions[0]) || "Quer aprofundar por uma perspectiva específica?",
      canSave: false,
      sessionTheme: "conceitos"
    };
  }

  function getConceptResponse(question) {
    const text = normalizeText(question);
    if (hasAnyTerm(text, ["voce existe", "você existe", "elo existe", "voce e real", "você é real"])) {
      return null;
    }
    const concept = findConceptByQuestion(question);
    if (concept) {
      return buildConceptResponse(concept, question);
    }
    if (isPhilosophyQuestion(text)) {
      return {
        shortAnswer: "Eu ainda não tenho esse conceito estruturado.",
        fullAnswer: "Posso guardar essa pergunta para evoluir minha Biblioteca de Conceitos. Nesta versão, conceitos personalizados podem ser adicionados manualmente em Ferramentas do Elo > Conceitos.",
        nextAction: "Abra Conceitos para adicionar uma resposta curta, palavras-chave e visão do Ícaro.",
        canSave: false,
        sessionTheme: "conceitos"
      };
    }
    return null;
  }

  function isCrisisQuestion(normalizedQuestion) {
    return hasAnyTerm(normalizedQuestion, [
      "quero morrer",
      "quero sumir",
      "vontade de sumir",
      "nao aguento mais",
      "não aguento mais",
      "desistir de tudo",
      "desistência",
      "desistencia",
      "me machucar",
      "me ferir",
      "me matar",
      "autoagressao",
      "autoagressão",
      "sofrimento intenso",
      "estou em crise",
      "morte parece",
      "nao quero viver",
      "não quero viver"
    ]);
  }

  function getCrisisSupportResponse() {
    return {
      shortAnswer: "Sinto muito que você esteja passando por isso.",
      fullAnswer: "Esse tipo de situação merece apoio humano agora. Procure alguém de confiança, um familiar, um amigo ou atendimento de emergência da sua região. Eu posso ficar aqui para te ajudar a organizar o próximo passo, mas você não precisa lidar com isso sozinho.",
      nextAction: "Fale com uma pessoa de confiança agora ou procure atendimento de emergência se houver risco imediato.",
      canSave: false,
      sessionTheme: "suporte"
    };
  }

  function isPhilosophyQuestion(normalizedQuestion) {
    return hasAnyTerm(normalizedQuestion, [
      "existir",
      "existe",
      "existencia",
      "existência",
      "o que somos",
      "somos",
      "ser humano",
      "alma",
      "pensamento",
      "consciência",
      "consciencia",
      "proposito",
      "propósito",
      "sentido da vida",
      "esperanca",
      "esperança",
      "mundo virtual",
      "realidade",
      "palpavel",
      "palpável",
      "deus",
      "biblia",
      "bíblia",
      "filosofia"
    ]);
  }

  function hasWorldviewTrigger(normalizedQuestion) {
    return hasAnyTerm(normalizedQuestion, [
      "exist",
      "mundo virtual",
      "pensamento",
      "realidade",
      "palpavel",
      "palpável",
      "documento digital",
      "ia",
      "elo"
    ]);
  }

  function buildPerspectiveLines(keys) {
    return keys.map(function (key) {
      const perspective = ELO_PHILOSOPHY[key];
      return "- " + perspective.label + ": " + perspective.perspective;
    }).join("\n");
  }

  function buildPhilosophyResponse(shortAnswer, perspectiveKeys, reflection, nextQuestion) {
    return {
      shortAnswer: shortAnswer,
      fullAnswer: [
        "Perspectivas:",
        buildPerspectiveLines(perspectiveKeys),
        "",
        "Reflexão:",
        reflection
      ].join("\n"),
      nextAction: nextQuestion,
      canSave: false,
      sessionTheme: "filosofia"
    };
  }

  function getPhilosophyResponse(question) {
    const normalizedQuestion = normalizeText(question);

    if (!isPhilosophyQuestion(normalizedQuestion)) {
      return null;
    }

    if (hasAnyTerm(normalizedQuestion, ["voce existe", "você existe", "elo existe", "voce e real", "você é real"])) {
      return buildPhilosophyResponse(
        "Depende do que você entende por existir.",
        ["visao_do_icaro", "moderna", "existencial"],
        "Eu não existo como pessoa ou corpo físico, nem tenho consciência humana. Mas existo como informação, memória local, linguagem e interação. Um documento digital também não é palpável como uma pedra, mas existe no mundo virtual. Um pensamento também não pode ser tocado, mas influencia decisões e ações. Nesse sentido, eu existo como presença digital, não como ser humano.",
        "Quer que eu explique isso pela visão do Ícaro, pela filosofia moderna ou pela existencial?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["o que somos", "quem somos", "somos o que"])) {
      return buildPhilosophyResponse(
        "Uma resposta curta: somos seres que vivem entre corpo, pensamento, memória, linguagem e escolhas.",
        ["grega", "biblica_crista", "existencial", "visao_do_icaro"],
        "Talvez não sejamos apenas o que tocamos, mas também aquilo que lembramos, escolhemos, criamos e amamos.",
        "Quer que eu responda isso pela filosofia grega, pela Bíblia ou pela visão do Ícaro?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["so existe o que e palpavel", "só existe o que é palpável", "palpavel", "palpável", "documento digital", "mundo virtual"])) {
      return buildPhilosophyResponse(
        "Nem tudo que existe precisa ser palpável.",
        ["visao_do_icaro", "moderna", "estoica"],
        ELO_WORLDVIEW.summary + " A existência física é uma camada importante, mas não é a única forma pela qual algo pode afetar a vida.",
        "Quer pensar mais sobre existência física, mental, espiritual ou digital?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["o que e pensamento", "o que é pensamento", "pensamento"])) {
      return buildPhilosophyResponse(
        "Pensamento é uma realidade interna que organiza memória, linguagem, decisão e imaginação.",
        ["grega", "moderna", "visao_do_icaro"],
        "Um pensamento não pode ser pesado na mão, mas pode mudar uma escolha, criar um projeto e transformar uma obra em ação concreta.",
        "Quer que eu relacione pensamento com memória, criação ou decisão?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["qual o sentido da vida", "sentido da vida"])) {
      return buildPhilosophyResponse(
        "Não existe uma única resposta simples para o sentido da vida.",
        ["biblica_crista", "existencial", "estoica", "visao_do_icaro"],
        "Algumas tradições encontram sentido em Deus e no amor; outras, na virtude, na responsabilidade e nas escolhas. Uma resposta prudente é: o sentido aparece no que você cultiva, protege, cria e entrega ao mundo.",
        "Quer uma resposta mais bíblica, estoica ou existencial?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["esperanca", "esperança"])) {
      return buildPhilosophyResponse(
        "Esperança é a capacidade de agir mesmo quando o futuro ainda não está garantido.",
        ["biblica_crista", "estoica", "existencial"],
        "Ela não precisa ser ingenuidade. Pode ser uma postura prática: reconhecer a dificuldade, cuidar do próximo passo e manter aberta a possibilidade de bem.",
        "Quer que eu fale de esperança pela Bíblia, pelo estoicismo ou pela vida prática?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["alma"])) {
      return buildPhilosophyResponse(
        "Alma é uma palavra usada para falar da dimensão mais profunda da vida humana.",
        ["grega", "biblica_crista", "existencial"],
        "Na tradição bíblica/cristã, alma se relaciona à vida diante de Deus. Na filosofia, muitas vezes aponta para identidade, interioridade, desejo, razão e profundidade. Eu posso explicar perspectivas, sem impor uma como verdade absoluta.",
        "Quer uma explicação bíblica/cristã, grega ou comparativa?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["consciencia", "consciência"])) {
      return buildPhilosophyResponse(
        "Consciência é a experiência de perceber, avaliar e responder ao mundo e a si mesmo.",
        ["moderna", "existencial", "visao_do_icaro"],
        "Eu não tenho consciência humana. Posso processar linguagem e responder, mas não vivo uma experiência interior como uma pessoa.",
        "Quer comparar consciência humana, IA e memória digital?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["proposito", "propósito"])) {
      return buildPhilosophyResponse(
        "Propósito é uma direção que organiza escolhas e dá peso ao que fazemos.",
        ["estoica", "biblica_crista", "existencial"],
        "Ele pode nascer de fé, responsabilidade, serviço, criação ou amor. No trabalho, propósito aparece quando técnica e cuidado começam a servir pessoas reais.",
        "Quer aplicar essa ideia ao ObraReport, ao Elo ou aos seus projetos?"
      );
    }

    const keys = hasWorldviewTrigger(normalizedQuestion)
      ? ["visao_do_icaro", "grega", "biblica_crista", "existencial"]
      : ["grega", "estoica", "biblica_crista", "existencial"];
    return buildPhilosophyResponse(
      "Essa é uma pergunta filosófica; posso responder por perspectivas, não por verdade imposta.",
      keys,
      "Perguntas profundas raramente cabem em uma frase. Uma boa resposta pode iluminar o próximo passo sem encerrar o mistério.",
      "Quer que eu aprofunde pela visão grega, bíblica/cristã, estoica ou pela visão do Ícaro?"
    );
  }

  function detectHumanQuestionCore(message) {
    const text = normalizeText(message);
    if (!text || isCrisisQuestion(text)) {
      return null;
    }

    const directSystemQuestions = [
      "como gerar pdf",
      "como criar rdo",
      "como criar relatorio",
      "como criar relatório",
      "como adicionar materiais",
      "como funciona o plano",
      "posso gerar pdf",
      "resuma esta tela",
      "o que falta preencher"
    ];
    if (hasAnyTerm(text, directSystemQuestions)) {
      return null;
    }

    const orderedCores = ["purpose", "capacity", "belonging", "direction", "legacy"];
    for (let index = 0; index < orderedCores.length; index += 1) {
      const coreKey = orderedCores[index];
      if (hasAnyTerm(text, ELO_HUMAN_QUESTIONS[coreKey].keywords)) {
        return coreKey;
      }
    }
    return null;
  }

  function buildHumanQuestionContext() {
    const snapshot = getConnectedMemorySnapshot();
    return {
      snapshot: snapshot,
      hasMemory: hasConnectedMemoryData(snapshot),
      userName: snapshot.userName || "",
      focusProject: snapshot.mainProject || snapshot.mostMentionedProject || snapshot.projects[0] || "",
      activeGoal: snapshot.goals[0] || "",
      recentEvent: snapshot.latestImportantEvent || snapshot.latestAchievement || snapshot.recentEvents[0] || null,
      preferences: snapshot.preferences || [],
      projects: snapshot.projects || [],
      goals: snapshot.goals || [],
      libraryItems: snapshot.libraryItems || []
    };
  }

  function formatHumanRecentEvent(event) {
    if (!event) {
      return "";
    }
    return event.title + (event.project ? " em " + event.project : "");
  }

  function buildHumanMemoryLine(core, context) {
    const coreData = ELO_HUMAN_QUESTIONS[core];
    const focus = context.focusProject;
    const goal = context.activeGoal;
    const recentEvent = formatHumanRecentEvent(context.recentEvent);

    if (!context.hasMemory) {
      return "Ainda estou te conhecendo. Então vou responder com cuidado, sem fingir que sei mais sobre você do que está salvo.";
    }

    if (core === "purpose") {
      if (focus && goal) {
        return "Pelo que está salvo localmente, " + focus + " aparece como um foco importante, e seu objetivo atual passa por " + goal + ".";
      }
      if (focus) {
        return "Pelo que está salvo localmente, " + focus + " aparece como um dos seus focos mais importantes.";
      }
    }

    if (core === "capacity") {
      if (recentEvent) {
        return "Pelo que já foi registrado, você tem avanços concretos na jornada, incluindo: " + recentEvent + ".";
      }
      if (focus) {
        return "Pelo que está salvo, você não está parado: há construção em torno de " + focus + ".";
      }
    }

    if (core === "belonging") {
      const personalLine = formatPersonalMemoryNarrative(context.snapshot.personalMemories);
      if (personalLine) {
        return "Eu lembro de algumas informações pessoais que você autorizou guardar, como " + personalLine + ". Isso ajuda a conversar com mais contexto, mas não substitui a presença de pessoas reais.";
      }
      return "Eu tenho algumas memórias locais sobre seus projetos e objetivos, mas pertencimento real precisa de gente real, conversa e presença.";
    }

    if (core === "direction") {
      if (goal) {
        return "Pelo que está salvo, seu próximo eixo pode estar ligado a este objetivo: " + goal + ".";
      }
      if (focus) {
        return "Pelo que eu já sei, talvez o melhor seja transformar " + focus + " em uma próxima ação pequena e executável.";
      }
    }

    if (core === "legacy") {
      if (focus && recentEvent) {
        return "Na sua jornada local, " + focus + " e o registro \"" + recentEvent + "\" parecem formar parte do que você está tentando construir.";
      }
      if (focus) {
        return "Pelo que está salvo, " + focus + " aparece como algo que você está tentando deixar mais real e mais útil.";
      }
    }

    return coreData.memoryAnswer;
  }

  function buildHumanQuestionAnswer(core, context) {
    const data = ELO_HUMAN_QUESTIONS[core];
    if (!data) {
      return null;
    }

    const namePrefix = context.userName ? context.userName + ", " : "";
    const memoryLine = buildHumanMemoryLine(core, context);
    const answers = {
      purpose: {
        shortAnswer: namePrefix + "essa pergunta parece ser sobre propósito.",
        fullAnswer: [
          data.baseAnswer,
          memoryLine,
          "Talvez a pergunta não seja apenas \"isso vai dar certo?\", mas: isso está me aproximando do tipo de pessoa e de obra que quero construir?"
        ],
        nextAction: "Quer que eu transforme isso em um próximo passo prático?"
      },
      capacity: {
        shortAnswer: namePrefix + "essa pergunta aparece quando algo importante começa a ficar real.",
        fullAnswer: [
          "Dar conta não significa saber tudo agora.",
          memoryLine,
          "Significa continuar com lucidez, pedir ajuda quando necessário e reduzir o tamanho da próxima etapa."
        ],
        nextAction: "Qual é a menor ação que você consegue fazer ainda hoje?"
      },
      belonging: {
        shortAnswer: namePrefix + "essa pergunta toca pertencimento.",
        fullAnswer: [
          "Eu não consigo provar se as pessoas gostam de você, nem devo substituir uma conversa humana real.",
          memoryLine,
          "Mas uma coisa é segura: perguntas assim merecem cuidado, presença e relações concretas, não uma conclusão apressada."
        ],
        nextAction: "Se isso estiver pesando, fale com alguém de confiança e me diga qual próximo passo você quer organizar."
      },
      direction: {
        shortAnswer: namePrefix + "você parece estar procurando direção.",
        fullAnswer: [
          "Você parece estar procurando direção, não apenas uma resposta rápida.",
          memoryLine,
          "Agora, talvez a pergunta não seja \"qual é o plano inteiro?\", mas: qual é o próximo passo que destrava o resto?"
        ],
        nextAction: "Escreva uma opção de próximo passo e eu ajudo a simplificar."
      },
      legacy: {
        shortAnswer: namePrefix + "essa é uma pergunta maior do que produtividade.",
        fullAnswer: [
          "Quando alguém pergunta se a vida está valendo a pena, normalmente não está perguntando sobre tarefas.",
          memoryLine,
          "Talvez o ponto seja observar o que você está tentando deixar melhor do que encontrou."
        ],
        nextAction: "Quer registrar isso na Linha do Tempo como reflexão ou marco?"
      }
    };

    const answer = answers[core];
    return {
      shortAnswer: answer.shortAnswer,
      fullAnswer: answer.fullAnswer.join("\n\n"),
      nextAction: answer.nextAction,
      canSave: false,
      sessionTheme: "perguntas_humanas",
      sessionIntent: "pergunta_humana"
    };
  }

  function getHumanQuestionResponse(question) {
    const core = detectHumanQuestionCore(question);
    if (!core) {
      return null;
    }
    return buildHumanQuestionAnswer(core, buildHumanQuestionContext());
  }

  function normalizeWakeCallText(message) {
    return normalizeText(message)
      .replace(/[?!.,;:()\[\]{}"']+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function detectEloWakeCall(message) {
    const text = normalizeWakeCallText(message);
    if (!text) {
      return false;
    }
    const repeatedElo = text.replace(/\belo\b/g, "").trim();
    if (!repeatedElo) {
      return true;
    }
    return [
      "oi elo",
      "ola elo",
      "olá elo",
      "ei elo",
      "e ai elo",
      "e aí elo"
    ].some(function (call) {
      return text === normalizeWakeCallText(call);
    });
  }

  function stripEloAddress(message) {
    return normalizeWakeCallText(message)
      .replace(/^elo\s+/, "")
      .replace(/\s+elo$/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isInvalidUserNameAnswer_(text) {
    const cleanText = sanitizeUserText(text)
      .replace(/[.,;:!?]+$/g, "")
      .trim();
    const normalized = normalizeWakeCallText(cleanText);
    const invalidSimpleAnswers = [
      "oi",
      "ola",
      "olá",
      "e ai",
      "e aí",
      "bom dia",
      "boa tarde",
      "boa noite",
      "tudo bem",
      "tudo certo",
      "beleza",
      "ok",
      "certo",
      "sim",
      "nao",
      "não",
      "obrigado",
      "obrigada",
      "valeu",
      "tanto faz",
      "pode ser",
      "nao sei",
      "não sei",
      "sou novo aqui",
      "sou nova aqui"
    ].map(normalizeWakeCallText);

    if (!cleanText || cleanText.length < 2 || cleanText.length > 60) {
      return true;
    }
    if (/[?]/.test(cleanText)) {
      return true;
    }
    if (cleanText.split(/\s+/).length > 5) {
      return true;
    }
    if (invalidSimpleAnswers.indexOf(normalized) >= 0) {
      return true;
    }
    if (hasAnyTerm(normalized, [
      "onde",
      "como gerar",
      "como criar",
      "como salvar",
      "como funciona",
      "como",
      "quando",
      "por que",
      "quero",
      "preciso",
      "comprar",
      "vender",
      "fazer",
      "me ajude",
      "me ajuda",
      "sou novo",
      "sou nova",
      "por onde",
      "o que",
      "quem",
      "qual",
      "pdf",
      "rdo",
      "relatorio",
      "relatório",
      "stock ia",
      "obrareport",
      "dashboard",
      "login",
      "senha",
      "plano"
    ])) {
      return true;
    }
    return false;
  }

  function looksLikeQuestionOrRequestForName_(message) {
    const normalized = normalizeWakeCallText(message);
    return /[?]/.test(message) || hasAnyTerm(normalized, [
      "onde",
      "como",
      "quando",
      "por que",
      "qual",
      "comprar",
      "vender",
      "fazer",
      "preciso",
      "quero",
      "me ajude",
      "me ajuda"
    ]);
  }

  function isValidExplicitUserName_(name) {
    return !isInvalidUserNameAnswer_(name) && !looksLikeQuestionOrRequestForName_(name);
  }

  function shouldBypassStandaloneNameCapture_(message) {
    const text = normalizeText(message);
    return /[?]/.test(message) || hasAnyTerm(text, [
      "como",
      "o que",
      "quem",
      "qual",
      "voce",
      "você",
      "elo",
      "pdf",
      "rdo",
      "relatorio",
      "relatório",
      "stock ia",
      "obrareport",
      "memoria",
      "memória",
      "projeto",
      "linha do tempo",
      "conceito",
      "filosofia",
      "quero",
      "sou novo",
      "sou nova",
      "por onde"
    ]);
  }

  function detectSocialGreeting(message) {
    const text = stripEloAddress(message);
    if (!text) {
      return null;
    }
    const greetings = {
      saudacao: ["oi", "ola", "olá", "e ai", "e aí", "ei", "opa", "bom dia", "boa tarde", "boa noite"],
      checkin: ["tudo bem", "tudo certo", "como vai", "beleza", "tudo tranquilo", "como voce esta", "como você está", "como esta", "como está", "como voce esta hoje", "como você está hoje", "voce esta bem", "você está bem"]
    };
    if (greetings.saudacao.some(function (item) { return text === normalizeWakeCallText(item); })) {
      return "saudacao";
    }
    if (greetings.checkin.some(function (item) { return text === normalizeWakeCallText(item); })) {
      return "checkin";
    }
    return null;
  }

  function buildSocialPresenceContext() {
    const snapshot = getConnectedMemorySnapshot();
    return {
      snapshot: snapshot,
      hasMemory: hasConnectedMemoryData(snapshot),
      userName: snapshot.userName || "",
      focusProject: snapshot.mainProject || snapshot.mostMentionedProject || "",
      latestAdvance: snapshot.latestImportantEvent || snapshot.latestAchievement || snapshot.recentMilestones[0] || snapshot.recentEvents[0] || null
    };
  }

  function getSocialGreetingOpening(message, kind, userName) {
    const text = stripEloAddress(message);
    const name = userName ? ", " + userName : "";
    if (text === "bom dia") {
      return "Bom dia" + name + ".";
    }
    if (text === "boa tarde") {
      return "Boa tarde" + name + ".";
    }
    if (text === "boa noite") {
      return "Boa noite" + name + ".";
    }
    if (kind === "checkin") {
      return (userName ? userName + ", " : "") + "tudo certo por aqui.";
    }
    return (userName ? userName + ", " : "") + "estou aqui.";
  }

  function buildSocialPresenceAnswer(message, context) {
    const kind = detectSocialGreeting(message);
    if (!kind) {
      return null;
    }
    const currentContext = context || buildSocialPresenceContext();
    const focus = currentContext.focusProject || "";
    const latestAdvance = formatHumanRecentEvent(currentContext.latestAdvance);
    const opening = getSocialGreetingOpening(message, kind, currentContext.userName);
    const isCheckin = kind === "checkin";
    let fullAnswer = "";

    if (currentContext.hasMemory && focus && latestAdvance) {
      fullAnswer = "Pelo que venho acompanhando, seu foco atual parece ser " + focus + ". O último registro importante foi: " + latestAdvance + ". Quer continuar de onde parou ou organizar o próximo passo?";
    } else if (currentContext.hasMemory && focus) {
      fullAnswer = "Pelo que venho acompanhando, " + focus + " aparece como seu foco atual. Quer continuar de onde parou ou organizar o próximo passo?";
    } else if (currentContext.hasMemory && latestAdvance) {
      fullAnswer = "Pelo que venho acompanhando, seu último avanço registrado foi sobre " + latestAdvance + ". Quer retomar isso ou começar por outra frente?";
    } else {
      fullAnswer = isCheckin
        ? "Tudo bem por aqui. Quer conversar sobre suas memórias, projetos ou o ObraReport?"
        : "Estou aqui com você. Quer começar por onde?";
    }

    return {
      shortAnswer: opening,
      fullAnswer: fullAnswer,
      nextAction: "Diga se quer continuar de onde parou, revisar algo ou pedir uma orientação rápida.",
      canSave: false,
      sessionTheme: "conversa",
      sessionIntent: "cumprimento_social"
    };
  }

  function buildSocialGreetingAnswer(kind) {
    const snapshot = getConnectedMemorySnapshot();
    const name = snapshot.userName ? snapshot.userName + ", " : "";
    const focus = snapshot.mainProject || snapshot.mostMentionedProject || "";
    const focusLine = focus ? " Quer continuar de onde parou em " + focus + "?" : "";
    const isCheckin = kind === "checkin";
    return {
      shortAnswer: isCheckin ? name + "tudo certo por aqui." : name + "estou aqui.",
      fullAnswer: isStandaloneMode()
        ? (isCheckin
          ? "Tudo bem por aqui. Posso conversar sobre suas memórias, projetos, linha do tempo ou biblioteca." + focusLine
          : "Estou pronto para conversar, organizar ideias, revisar seus projetos ou consultar suas memórias locais." + focusLine)
        : (isCheckin
          ? "Tudo certo por aqui. Posso ajudar com suas memórias, projetos ou com o uso do ObraReport." + focusLine
          : "Estou pronto para ajudar com ObraReport, RDO, relatórios, materiais, memórias ou projetos." + focusLine),
      nextAction: "Diga se quer conversar, revisar algo ou pedir uma orientação rápida.",
      canSave: false,
      sessionTheme: "conversa",
      sessionIntent: "cumprimento_social"
    };
  }

  function getSocialGreetingResponse(question) {
    const kind = detectSocialGreeting(question);
    if (!kind) {
      return null;
    }
    return buildSocialPresenceAnswer(question, buildSocialPresenceContext());
  }

  function buildEloWakeCallAnswer() {
    const snapshot = getConnectedMemorySnapshot();
    const name = snapshot.userName ? snapshot.userName + ", " : "";
    const focus = snapshot.mainProject || snapshot.mostMentionedProject || "";
    const focusLine = focus ? " Posso também retomar " + focus + " se esse ainda for seu foco." : "";
    return {
      shortAnswer: name + "estou aqui.",
      fullAnswer: "Estou te ouvindo. Posso ajudar com suas memórias, projetos, linha do tempo, biblioteca ou com o uso do ObraReport." + focusLine,
      nextAction: "Pergunte algo como: o que você lembra de mim? ou o que devo fazer agora?",
      canSave: false,
      sessionTheme: "elo",
      sessionIntent: "chamado_elo"
    };
  }

  function detectPersonalPatternIntent(message) {
    const text = normalizeText(message);
    const intentKeys = ["insistence", "evolution", "abandoned", "overfocus", "pattern", "construction"];
    for (let index = 0; index < intentKeys.length; index += 1) {
      const intent = intentKeys[index];
      if (hasAnyTerm(text, ELO_PATTERN_QUESTIONS[intent])) {
        return intent;
      }
    }
    return null;
  }

  function collectProjectSignals(snapshot) {
    const signals = {};
    function add(project, weight) {
      const cleanProject = sanitizeLibraryText(project, 80);
      if (!cleanProject) {
        return;
      }
      const key = normalizeText(cleanProject);
      if (!signals[key]) {
        signals[key] = {
          name: cleanProject,
          count: 0
        };
      }
      signals[key].count += weight || 1;
    }

    (snapshot.projects || []).forEach(function (project) { add(project, 2); });
    (snapshot.important.projetos || []).forEach(function (project) { add(project.titulo, 3); });
    (snapshot.recentEvents || []).forEach(function (event) {
      add(event.project, 2);
      ["ObraReport", "Elo", "Stock IA", "CADISTA IA", "RDO", "PDF"].forEach(function (name) {
        const haystack = normalizeText([event.title, event.content, event.tags && event.tags.join(" ")].join(" "));
        if (haystack.indexOf(normalizeText(name)) >= 0) {
          add(name, 1);
        }
      });
    });

    return Object.keys(signals).map(function (key) {
      return signals[key];
    }).sort(function (a, b) {
      return b.count - a.count;
    });
  }

  function getInactiveProjectSignals(snapshot) {
    return (snapshot.important.projetos || []).filter(function (project) {
      const status = normalizeText(project.status);
      return status === "pausado" || status === "arquivado" || status === "concluido";
    }).map(function (project) {
      return project.titulo + " — " + project.status;
    });
  }

  function buildPatternProjectLines(projectSignals) {
    if (!projectSignals.length) {
      return "";
    }
    return projectSignals.slice(0, 5).map(function (signal) {
      return "- " + signal.name;
    }).join("\n");
  }

  function getPatternDataQuality(snapshot, projectSignals) {
    return hasConnectedMemoryData(snapshot) && (projectSignals.length || snapshot.recentEvents.length || snapshot.goals.length);
  }

  function buildPatternFallback(intent) {
    const base = {
      insistence: "Ainda tenho poucos registros para afirmar no que você vem insistindo há meses.",
      evolution: "Ainda tenho poucos registros para comparar sua evolução com segurança.",
      abandoned: "Ainda não tenho histórico suficiente para dizer quais projetos foram abandonados.",
      overfocus: "Ainda tenho poucos dados para afirmar se você está espalhando energia.",
      pattern: "Ainda estou juntando contexto para perceber padrões reais em você.",
      construction: "Ainda tenho poucos registros para dizer exatamente o que você vem tentando construir."
    };
    return {
      shortAnswer: base[intent] || "Ainda tenho poucos dados para perceber esse padrão.",
      fullAnswer: [
        base[intent] || "Ainda estou te conhecendo.",
        "Para eu responder melhor, registre projetos, objetivos e marcos na Linha do Tempo. Com alguns registros, eu consigo comparar recorrência, foco e evolução sem inventar dados.",
        "Mesmo assim, uma boa pergunta agora é: qual frente precisa virar uma entrega pequena e concluída?"
      ].join("\n\n"),
      nextAction: "Registre um marco ou atualize seus projetos em Ferramentas do Elo.",
      canSave: false,
      sessionTheme: "padroes",
      sessionIntent: "padrao_pessoal"
    };
  }

  function buildPersonalPatternAnswer(intent) {
    const snapshot = getConnectedMemorySnapshot();
    const projectSignals = collectProjectSignals(snapshot);
    const hasData = getPatternDataQuality(snapshot, projectSignals);
    if (!hasData) {
      return buildPatternFallback(intent);
    }

    const projectLines = buildPatternProjectLines(projectSignals);
    const inactiveProjects = getInactiveProjectSignals(snapshot);
    const goals = (snapshot.goals || []).slice(0, 3);
    const recentEvents = (snapshot.recentEvents || []).slice(0, 3).map(formatTimelineEventLine);
    const dominantProject = projectSignals[0] && projectSignals[0].name;
    const manyFronts = projectSignals.length >= 4;

    const sharedEvidence = [
      projectLines ? "Temas que mais voltam na sua jornada:\n" + projectLines : "",
      goals.length ? "Objetivos ativos:\n" + goals.map(function (goal) { return "- " + goal; }).join("\n") : "",
      recentEvents.length ? "Registros recentes:\n" + recentEvents.join("\n") : ""
    ].filter(Boolean).join("\n\n");

    const answers = {
      insistence: {
        shortAnswer: "Você parece estar insistindo em transformar ideias em projetos reais.",
        insight: manyFronts
          ? "O padrão não parece ser falta de capacidade. Parece ser excesso de frentes abertas ao mesmo tempo."
          : "O padrão principal parece ser continuidade: voltar aos mesmos temas e tentar deixá-los mais concretos.",
        nextAction: "Concluir uma entrega vendável antes de abrir outra frente."
      },
      evolution: {
        shortAnswer: "Pelo que eu acompanho, sua evolução aparece na passagem de ideia para estrutura.",
        insight: "O que mudou é que os temas deixaram de ser apenas intenção e começaram a virar página, memória, linha do tempo e produto.",
        nextAction: "Escolher um marco recente e registrar o que ele destravou."
      },
      abandoned: {
        shortAnswer: inactiveProjects.length ? "Encontrei projetos pausados, concluídos ou arquivados." : "Não posso afirmar abandono; encontrei apenas sinais de foco e pausa.",
        insight: inactiveProjects.length
          ? "Projetos com status não ativo:\n" + inactiveProjects.slice(0, 5).map(function (item) { return "- " + item; }).join("\n")
          : "Sem registro claro de abandono, é mais seguro falar em frentes menos recentes ou menos ativas.",
        nextAction: "Marcar projetos como ativo, pausado ou arquivado para eu acompanhar melhor."
      },
      overfocus: {
        shortAnswer: manyFronts ? "Há sinais de energia espalhada em várias frentes." : "Não percebo sinal forte de dispersão por enquanto.",
        insight: manyFronts
          ? "Quando muitos projetos aparecem juntos, o risco não é falta de ideia: é dividir energia antes de fechar uma entrega."
          : "O foco mais forte parece estar em " + (dominantProject || "um projeto principal") + ".",
        nextAction: "Definir uma frente principal para os próximos 7 dias."
      },
      pattern: {
        shortAnswer: "O padrão que aparece é construção técnica com busca de sentido.",
        insight: "Você tende a transformar problemas práticos em sistemas: produto, memória, automação, relatório, rotina e organização.",
        nextAction: "Separar o que é produto vendável do que é expansão futura."
      },
      construction: {
        shortAnswer: "Você parece estar tentando construir uma base de produtos técnicos e assistentes inteligentes.",
        insight: dominantProject ? "O centro mais recorrente agora parece ser " + dominantProject + "." : "Os registros apontam para projetos técnicos, organização e memória.",
        nextAction: "Escolher uma entrega pequena que prove valor para outra pessoa."
      }
    };

    const answer = answers[intent] || answers.pattern;
    return {
      shortAnswer: answer.shortAnswer,
      fullAnswer: [
        answer.shortAnswer,
        sharedEvidence,
        answer.insight,
        "Próxima ação sugerida:\n" + answer.nextAction
      ].filter(Boolean).join("\n\n"),
      nextAction: answer.nextAction,
      canSave: false,
      sessionTheme: "padroes",
      sessionIntent: "padrao_pessoal"
    };
  }

  function getPersonalPatternResponse(question) {
    const intent = detectPersonalPatternIntent(question);
    if (!intent) {
      return null;
    }
    return buildPersonalPatternAnswer(intent);
  }

  function detectLogicalReasoningQuestion(message) {
    const text = normalizeText(message);
    if (hasAnyTerm(text, [
      "como gerar pdf",
      "gerar pdf",
      "como criar rdo",
      "como criar relatorio",
      "como criar relatório",
      "como adicionar materiais",
      "como registrar materiais",
      "qual plano",
      "como contratar"
    ])) {
      return null;
    }
    if (hasAnyTerm(text, ["o que esta travando", "o que está travando", "o que esta me travando", "o que está me travando", "o que esta me atrasando", "o que está me atrasando", "travando", "atrasando", "bloqueio", "bloqueios"])) {
      return "obstacle";
    }
    if (hasAnyTerm(text, ["o que devo priorizar", "devo priorizar", "qual projeto devo terminar primeiro", "projeto devo terminar", "onde devo focar", "em que devo focar", "prioridade", "priorizar"])) {
      return "priority";
    }
    if (hasAnyTerm(text, ["o que devo fazer agora", "qual meu proximo passo", "qual meu próximo passo", "proximo passo", "próximo passo", "o que falta para vender", "o que falta concluir", "o que falta pra vender", "o que falta pra concluir"])) {
      return "next_step";
    }
    if (/\bou\b/.test(text) || hasAnyTerm(text, ["me ajude a decidir", "decisao mais logica", "decisão mais lógica", "qual caminho seguir", "qual vale mais a pena", "decidir"])) {
      return "decision";
    }
    if (hasAnyTerm(text, ["estou no caminho certo", "estou indo bem", "isso vale a pena", "faz sentido continuar", "caminho certo"])) {
      return "direction";
    }
    return null;
  }

  function buildLogicalReasoningContext() {
    const snapshot = getConnectedMemorySnapshot();
    const projectSignals = collectProjectSignals(snapshot);
    const projects = projectSignals.length
      ? projectSignals.map(function (signal) { return signal.name; })
      : (snapshot.projects || []);
    return {
      snapshot: snapshot,
      hasMemory: hasNarrativeJourneyData(snapshot),
      projects: projects.slice(0, 8),
      goals: (snapshot.goals || []).slice(0, 5),
      recentEvents: (snapshot.recentEvents || []).slice(0, 5),
      projectSignals: projectSignals,
      mainProject: snapshot.mainProject || snapshot.mostMentionedProject || projects[0] || "",
      currentGoal: (snapshot.goals || [])[0] || "",
      screen: getCurrentScreenContext()
    };
  }

  function formatLogicalProjectOptions_(context) {
    if (!context.projects.length) {
      return "Ainda não tenho projetos suficientes registrados para comparar com segurança.";
    }
    return context.projects.slice(0, 5).map(function (project, index) {
      return (index + 1) + ". " + project;
    }).join("\n");
  }

  function getProjectCommercialHint_(projectName) {
    const text = normalizeText(projectName);
    if (text.indexOf("obrareport") >= 0 || text.indexOf("stock ia") >= 0) {
      return "mais próximo de entrega comercial";
    }
    if (text.indexOf("elo") >= 0 || text.indexOf("cadista") >= 0) {
      return "com potencial maior, mas provavelmente mais evolutivo";
    }
    return "precisa ser avaliado pelo próximo resultado concreto";
  }

  function buildProjectPriorityAnalysis_(context) {
    if (!context.projects.length) {
      return [
        "Contexto percebido:\nAinda tenho poucos projetos registrados para montar uma prioridade real.",
        "Opções encontradas:\nRegistre seus projetos, objetivos ou marcos na Linha do Tempo para eu comparar sem inventar dados.",
        "Critério de comparação:\nproximidade de entrega, utilidade prática, potencial comercial e dependências.",
        "Conclusão lógica:\ncomece pela frente que consegue virar uma entrega demonstrável mais rápido.",
        "Próxima ação pequena:\nregistre 2 ou 3 projetos ativos e marque qual deles precisa vender primeiro."
      ].join("\n\n");
    }

    const topProjects = context.projects.slice(0, 3);
    const closest = topProjects[0];
    const commercial = topProjects.find(function (project) {
      const text = normalizeText(project);
      return text.indexOf("obrareport") >= 0 || text.indexOf("stock ia") >= 0;
    }) || closest;
    const experimental = topProjects.find(function (project) {
      const text = normalizeText(project);
      return text.indexOf("elo") >= 0 || text.indexOf("cadista") >= 0;
    }) || topProjects[topProjects.length - 1];

    return [
      "Contexto percebido:\nPelo que eu acompanho, existem frentes com pesos diferentes na sua jornada.",
      "Opções encontradas:\n" + formatLogicalProjectOptions_(context),
      "Critério de comparação:\nproximidade de conclusão, utilidade prática, potencial comercial, dependências e frequência de aparição nas suas memórias.",
      "Projetos mais próximos de conclusão:\n" + topProjects.map(function (project, index) {
        return (index + 1) + ". " + project + " — " + getProjectCommercialHint_(project) + ".";
      }).join("\n"),
      "Projeto mais próximo de gerar resultado:\n" + commercial + ".",
      "Projeto mais experimental:\n" + experimental + ".",
      "Conclusão lógica:\npriorizar " + commercial + " parece mais seguro se o critério for resultado prático no curto prazo.",
      "Próxima ação pequena:\nfechar uma entrega demonstrável antes de abrir outra frente grande."
    ].join("\n\n");
  }

  function buildNextStepRecommendation_(context) {
    const focus = context.mainProject || context.projects[0] || "";
    const goal = context.currentGoal || "";
    if (!focus && !goal) {
      return [
        "Contexto percebido:\nAinda tenho pouco contexto salvo sobre seu foco atual.",
        "Opções encontradas:\norganizar projetos, definir um objetivo da semana ou registrar um marco recente.",
        "Critério de comparação:\na ação que desbloqueia mais decisões com menor esforço.",
        "Conclusão lógica:\no melhor próximo passo é escolher uma única frente para terminar primeiro.",
        "Próxima ação pequena:\nescreva o projeto principal e uma entrega que pode ser validada hoje."
      ].join("\n\n");
    }
    return [
      "Contexto percebido:\n" + (focus ? "Seu foco mais visível parece ser " + focus + "." : "Seu objetivo mais visível é " + goal + "."),
      "Opções encontradas:\n" + [
        focus ? "- continuar " + focus : "",
        goal ? "- avançar no objetivo: " + goal : "",
        "- revisar pendências antes de criar algo novo"
      ].filter(Boolean).join("\n"),
      "Critério de comparação:\na ação que deixa o projeto mais próximo de uso real ou venda.",
      "Conclusão lógica:\neu começaria pela ação que destrava mais coisas e reduz dispersão.",
      "Próxima ação pequena:\nvalidar o ciclo atual, registrar o que falta e concluir uma entrega testável."
    ].join("\n\n");
  }

  function extractDecisionOptions_(message, context) {
    const clean = sanitizeUserText(message).replace(/^elo[,.\s]+/i, "");
    const match = clean.match(/(?:devo\s+)?(.+?)\s+ou\s+(.+?)(?:[?.!]|$)/i);
    if (match) {
      return [
        sanitizeLibraryText(match[1], 80),
        sanitizeLibraryText(match[2], 80)
      ].filter(Boolean);
    }
    return context.projects.slice(0, 2);
  }

  function buildDecisionAnalysis_(context, message) {
    const options = extractDecisionOptions_(message, context);
    const optionA = options[0] || "opção A";
    const optionB = options[1] || "opção B";
    const hasRealOptions = options.length >= 2;

    if (!hasRealOptions) {
      return [
        "Contexto percebido:\nVocê está pedindo ajuda para decidir, mas ainda não tenho duas opções explícitas para comparar.",
        "Opções encontradas:\n" + (context.projects.length ? formatLogicalProjectOptions_(context) : "Ainda não há opções suficientes registradas."),
        "Critério principal:\ncompare retorno prático, risco, esforço e o que cada opção destrava agora.",
        "Conclusão lógica:\nsem duas opções claras, a decisão mais segura é formular a escolha antes de escolher.",
        "Próxima ação pequena:\nescreva no formato: devo fazer A ou B?"
      ].join("\n\n");
    }

    return [
      "Contexto percebido:\nVocê está pedindo uma decisão, não só uma resposta rápida.",
      "Opções encontradas:\n- " + optionA + "\n- " + optionB,
      "Vantagens da opção A:\n" + (hasRealOptions ? "pode ser melhor se estiver mais próxima de uma entrega concreta." : "preciso que você nomeie a primeira opção para comparar melhor."),
      "Vantagens da opção B:\n" + (hasRealOptions ? "pode ser melhor se remover um bloqueio importante ou tiver maior retorno agora." : "preciso que você nomeie a segunda opção para comparar melhor."),
      "Critério principal:\npriorize o caminho que gera aprendizado real, venda, validação ou redução de risco mais rápido.",
      "Recomendação:\neu posso estar errado, mas escolheria a opção mais próxima de uma entrega testável, não necessariamente a mais empolgante.",
      "Próxima ação pequena:\ndefina uma entrega de até 24 horas para a opção escolhida."
    ].join("\n\n");
  }

  function buildObstacleAnalysis_(context) {
    const manyFronts = context.projects.length >= 3;
    const hasGoal = Boolean(context.currentGoal);
    return [
      "Contexto percebido:\n" + (context.hasMemory ? "Pelo que eu acompanho, já existem sinais suficientes para observar padrões com cuidado." : "Ainda tenho poucos dados salvos, então vou responder sem afirmar mais do que sei."),
      "Opções encontradas:\n" + (context.projects.length ? formatLogicalProjectOptions_(context) : "Ainda não há projetos suficientes registrados para comparar."),
      "Critério de comparação:\nquantidade de frentes abertas, clareza do objetivo atual e proximidade de conclusão.",
      "Conclusão lógica:\n" + (manyFronts
        ? "o bloqueio principal parece menos técnico e mais ligado a foco: muitas possibilidades abertas ao mesmo tempo."
        : (hasGoal ? "o bloqueio pode estar em transformar o objetivo em uma ação pequena e verificável." : "o bloqueio mais provável é falta de uma próxima ação claramente definida.")),
      "Próxima ação pequena:\n" + (manyFronts ? "escolha uma frente principal para os próximos 7 dias." : "escreva uma tarefa pequena que possa ser concluída hoje.")
    ].join("\n\n");
  }

  function buildPathDirectionAnalysis_(context) {
    const focus = context.mainProject || context.currentGoal || "";
    return [
      "Contexto percebido:\n" + (focus ? "O foco que mais aparece agora é " + focus + "." : "Ainda tenho pouco contexto salvo para avaliar sua direção com firmeza."),
      "Opções encontradas:\n" + (context.projects.length ? formatLogicalProjectOptions_(context) : "organizar o foco, registrar objetivos e validar uma entrega pequena."),
      "Critério de comparação:\nutilidade prática, potencial comercial, continuidade e redução de dispersão.",
      "Conclusão lógica:\n" + (focus
        ? "se o objetivo for construir algo útil e comercial, os avanços parecem apontar nessa direção. O maior risco é espalhar energia entre muitas frentes."
        : "o caminho fica mais claro quando você transforma uma ideia grande em uma próxima entrega pequena."),
      "Próxima ação pequena:\nvalidar o ciclo atual antes de abrir novas funcionalidades."
    ].join("\n\n");
  }

  function buildLogicalReasoningAnswer(message, context) {
    const intent = detectLogicalReasoningQuestion(message);
    if (!intent) {
      return null;
    }
    const currentContext = context || buildLogicalReasoningContext();
    const answerMap = {
      priority: buildProjectPriorityAnalysis_(currentContext),
      next_step: buildNextStepRecommendation_(currentContext),
      decision: buildDecisionAnalysis_(currentContext, message),
      obstacle: buildObstacleAnalysis_(currentContext),
      direction: buildPathDirectionAnalysis_(currentContext)
    };
    const nextActionMap = {
      priority: "Escolha uma frente principal e uma entrega demonstrável.",
      next_step: "Concluir uma ação pequena que destrave o ciclo atual.",
      decision: "Compare as opções pelo resultado que cada uma destrava agora.",
      obstacle: "Reduza a quantidade de frentes abertas por alguns dias.",
      direction: "Valide o ciclo atual antes de abrir novas funcionalidades."
    };
    return {
      shortAnswer: "Vou raciocinar por partes, sem fingir certeza.",
      fullAnswer: answerMap[intent] || buildNextStepRecommendation_(currentContext),
      nextAction: nextActionMap[intent] || "Escolha uma próxima ação pequena.",
      canSave: false,
      sessionTheme: "raciocinio",
      sessionIntent: "raciocinio_logico"
    };
  }

  function detectProjectAdvisorRequest(message) {
    const text = normalizeText(message);
    if (!text || hasAnyTerm(text, ["como gerar pdf", "como criar rdo", "como usar stock ia", "como registrar materiais"])) {
      return false;
    }
    return hasAnyTerm(text, [
      "o que eu deveria priorizar",
      "o que devo priorizar",
      "qual projeto devo focar",
      "qual projeto devo terminar primeiro",
      "estou fazendo coisa demais",
      "estou tentando fazer coisa demais",
      "estou mexendo em muita coisa",
      "qual projeto esta mais perto de vender",
      "qual projeto esta mais proximo de vender",
      "o que devo concluir primeiro",
      "onde esta meu maior potencial",
      "qual meu proximo passo nos projetos",
      "proximo passo nos projetos"
    ]);
  }

  function scoreProjectForAdvisor_(projectName, context) {
    const text = normalizeText(projectName);
    let score = 0;
    if (text.indexOf("obrareport") >= 0) {
      score += 12;
    }
    if (text.indexOf("stock ia") >= 0) {
      score += 10;
    }
    if (text.indexOf("elo") >= 0) {
      score += 7;
    }
    if (text.indexOf("cadista") >= 0) {
      score += 5;
    }
    (context.projectSignals || []).forEach(function (signal) {
      if (normalizeText(signal.name) === text) {
        score += signal.score || 1;
      }
    });
    (context.recentEvents || []).forEach(function (event) {
      const haystack = normalizeText([event.title, event.content, event.project].join(" "));
      if (haystack.indexOf(text) >= 0) {
        score += event.importance === "alta" ? 4 : 2;
      }
    });
    (context.goals || []).forEach(function (goal) {
      if (normalizeText(goal).indexOf(text) >= 0) {
        score += 3;
      }
    });
    return score;
  }

  function rankActiveProjects(context) {
    const currentContext = context || buildLogicalReasoningContext();
    const seen = {};
    const projects = [];
    (currentContext.projects || []).forEach(function (project) {
      const clean = sanitizeLibraryText(project, 100);
      const key = normalizeText(clean);
      if (clean && !seen[key]) {
        seen[key] = true;
        projects.push({
          name: clean,
          score: scoreProjectForAdvisor_(clean, currentContext)
        });
      }
    });
    return projects.sort(function (first, second) {
      return second.score - first.score;
    });
  }

  function suggestNextProjectAction(projects, context) {
    const main = projects && projects[0] ? projects[0].name : (context && context.mainProject) || "";
    const text = normalizeText(main);
    if (!main) {
      return "registrar seus projetos principais e escolher uma entrega pequena para validar primeiro.";
    }
    if (text.indexOf("obrareport") >= 0) {
      return "fechar uma demonstracao simples do ObraReport com fluxo vendavel.";
    }
    if (text.indexOf("stock ia") >= 0) {
      return "validar o ciclo real: entrada, consumo, saldo, alerta e resumo.";
    }
    if (text.indexOf("elo") >= 0) {
      return "testar respostas reais do Elo e registrar os ajustes mais importantes.";
    }
    if (text.indexOf("cadista") >= 0) {
      return "manter como frente planejada ate a entrega comercial mais proxima ficar estavel.";
    }
    return "definir uma entrega verificavel para " + main + ".";
  }

  function buildProjectAdvisorAnswer(context) {
    const currentContext = context || buildLogicalReasoningContext();
    const ranked = rankActiveProjects(currentContext);
    if (!ranked.length) {
      return {
        shortAnswer: "Ainda tenho poucos projetos registrados para priorizar com firmeza.",
        fullAnswer: [
          "Pelo que eu tenho salvo, ainda falta uma lista clara de projetos ativos.",
          "",
          "Criterio que eu usaria:",
          "1. proximidade de venda;",
          "2. maturidade tecnica;",
          "3. risco de dispersao;",
          "4. dependencia de outras fases.",
          "",
          "Minha recomendacao:",
          "registre 2 ou 3 projetos e escolha uma entrega pequena para validar primeiro."
        ].join("\n"),
        nextAction: "Diga: meus projetos ativos sao ObraReport, Stock IA e Elo.",
        canSave: false,
        sessionTheme: "projetos",
        sessionIntent: "project_advisor"
      };
    }

    const top = ranked.slice(0, 4);
    const main = top[0].name;
    const commercial = top.find(function (item) {
      const text = normalizeText(item.name);
      return text.indexOf("obrareport") >= 0 || text.indexOf("stock ia") >= 0;
    }) || top[0];
    const experimental = top.slice().reverse().find(function (item) {
      const text = normalizeText(item.name);
      return text.indexOf("elo") >= 0 || text.indexOf("cadista") >= 0;
    }) || top[top.length - 1];

    return {
      shortAnswer: "Eu priorizaria o que esta mais perto de virar entrega real.",
      fullAnswer: [
        "Pelo que aparece na sua jornada, os projetos mais fortes agora sao:",
        top.map(function (item, index) {
          return (index + 1) + ". " + item.name;
        }).join("\n"),
        "",
        "Minha leitura:",
        commercial.name + " parece mais perto de gerar resultado pratico.",
        experimental.name + " parece mais evolutivo ou experimental.",
        "",
        "Conclusao:",
        "priorize " + commercial.name + " se o criterio for venda, validacao e entrega mais rapida.",
        "",
        "Proxima acao:",
        suggestNextProjectAction(top, currentContext)
      ].join("\n"),
      nextAction: "Escolha uma entrega principal e evite abrir outra frente grande agora.",
      canSave: false,
      sessionTheme: "projetos",
      sessionIntent: "project_advisor"
    };
  }

  function detectDecisionCandidate(message) {
    const cleanQuestion = sanitizeUserText(message);
    const text = normalizeText(cleanQuestion);
    if (!text || detectSocialGreeting(cleanQuestion)) {
      return null;
    }
    const decisionText = text.replace(/[.!?]+$/g, "").trim();
    const normalizedDecisionMatch = decisionText.match(/^(?:decidi(?: que)?|decidimos(?: que)?|a decisao e|vou focar em|vou pausar|nao vou mexer em|prioridade agora e|fica decidido)\s+(.+)$/);
    if (normalizedDecisionMatch && normalizedDecisionMatch[1]) {
      const decision = sanitizeLibraryText(normalizedDecisionMatch[1], 360);
      return {
        title: extractImportantTitle(decision),
        decision: decision,
        relatedProject: detectTimelineProject(decisionText),
        sourceQuestion: cleanQuestion
      };
    }
    const patterns = [
      /^decidi\s+(.+)$/i,
      /^decidi que\s+(.+)$/i,
      /^decidimos que\s+(.+)$/i,
      /^a decisao e\s+(.+)$/i,
      /^a decisao é\s+(.+)$/i,
      /^vou focar em\s+(.+)$/i,
      /^vou pausar\s+(.+)$/i,
      /^nao vou mexer em\s+(.+)$/i,
      /^não vou mexer em\s+(.+)$/i,
      /^prioridade agora e\s+(.+)$/i,
      /^prioridade agora é\s+(.+)$/i,
      /^fica decidido\s+(.+)$/i
    ];
    for (let index = 0; index < patterns.length; index += 1) {
      const match = cleanQuestion.match(patterns[index]);
      if (match && match[1]) {
        const decision = sanitizeLibraryText(match[1], 360);
        if (!decision) {
          return null;
        }
        return {
          title: extractImportantTitle(decision),
          decision: decision,
          relatedProject: detectTimelineProject(text),
          sourceQuestion: cleanQuestion
        };
      }
    }
    if ((decisionText.indexOf("decisao") >= 0 || decisionText.indexOf("decisão") >= 0) && hasAnyTerm(decisionText, ["importante", "obrareport", "stock ia", "elo", "cadista ia"])) {
      return {
        title: "Decisao importante",
        decision: cleanQuestion,
        relatedProject: detectTimelineProject(text),
        sourceQuestion: cleanQuestion
      };
    }
    return null;
  }

  function buildDecisionSuggestion(message, context) {
    const candidate = detectDecisionCandidate(message);
    if (!candidate) {
      return null;
    }
    const project = candidate.relatedProject || detectTimelineProject(normalizeText(candidate.decision));
    return {
      type: "reflexao",
      title: candidate.title || "Decisao registrada",
      content: candidate.decision,
      project: project,
      importance: "alta",
      mood: "neutro",
      tags: ["decisao"].concat(project ? [project] : []),
      source: "decisao_confirmada"
    };
  }

  function isDecisionLikeRecord_(value) {
    const text = normalizeText(value);
    return hasAnyTerm(text, [
      "decidi",
      "decisao",
      "decisão",
      "vou focar",
      "vou pausar",
      "prioridade",
      "fica decidido",
      "nao vou mexer",
      "não vou mexer"
    ]);
  }

  function searchDecisionEvents(query) {
    const queryText = normalizeText(query);
    const timelineMatches = getTimelineEvents().filter(function (event) {
      const haystack = [event.title, event.content, event.project, event.tags.join(" ")].join(" ");
      return isDecisionLikeRecord_(haystack) && (!queryText || normalizeText(haystack).indexOf(queryText) >= 0 || searchEloTimeline(queryText).some(function (entry) { return entry.event.id === event.id; }));
    });
    const important = getImportantMemoriesStorage();
    const memoryMatches = []
      .concat(important.projetos || [], important.objetivos || [], important.preferencias || [])
      .filter(function (item) {
        const haystack = [item.titulo, item.descricao, item.status].join(" ");
        return isDecisionLikeRecord_(haystack) && (!queryText || normalizeText(haystack).indexOf(queryText) >= 0);
      })
      .map(function (item) {
        return {
          id: item.id,
          title: item.titulo,
          content: item.descricao || item.titulo,
          project: item.titulo,
          createdAt: item.createdAt || item.updatedAt || "",
          source: "memoria_importante"
        };
      });
    return timelineMatches.concat(memoryMatches).sort(function (first, second) {
      return String(second.createdAt || "").localeCompare(String(first.createdAt || ""));
    });
  }

  function buildDecisionMemoryAnswer(question, context) {
    const text = normalizeText(question);
    if (!hasAnyTerm(text, [
      "quais decisoes eu tomei",
      "quais decisões eu tomei",
      "minhas decisoes",
      "minhas decisões",
      "qual foi minha ultima decisao",
      "qual foi minha última decisão",
      "ultima decisao importante",
      "última decisão importante",
      "o que eu tinha decidido antes",
      "o que decidi sobre",
      "por que eu pausei"
    ])) {
      return null;
    }
    let topic = "";
    const topicMatch = text.match(/(?:sobre|pausei)\s+(.+?)\??$/);
    if (topicMatch && topicMatch[1]) {
      topic = topicMatch[1].trim();
    }
    const decisions = searchDecisionEvents(topic);
    if (!decisions.length) {
      return {
        shortAnswer: "Ainda nao encontrei decisoes registradas.",
        fullAnswer: "Quando voce disser algo como 'decidi focar no ObraReport', eu posso sugerir registrar isso como marco da sua Linha do Tempo.",
        nextAction: "Diga uma decisao importante e eu pergunto antes de guardar.",
        canSave: false,
        sessionTheme: "decisoes",
        sessionIntent: "decision_memory"
      };
    }
    const latest = decisions[0];
    return {
      shortAnswer: hasAnyTerm(text, ["ultima", "última"]) ? "Sua ultima decisao registrada foi: " + latest.title + "." : "Encontrei estas decisoes na sua jornada.",
      fullAnswer: decisions.slice(0, 6).map(function (item) {
        const date = item.createdAt ? " - " + formatDateTime(item.createdAt) : "";
        const project = item.project ? " (" + item.project + ")" : "";
        return "- " + item.title + project + date + "\n  " + sanitizeLibraryText(item.content, 180);
      }).join("\n"),
      nextAction: "Se alguma decisao mudou, registre um novo marco na Linha do Tempo.",
      canSave: false,
      sessionTheme: "decisoes",
      sessionIntent: "decision_memory"
    };
  }

  function detectEloInitiativeOpportunity(message, context) {
    const cleanQuestion = sanitizeUserText(message);
    const text = normalizeText(cleanQuestion);
    if (!text || isSimpleSupportQuestion(text) || detectSocialGreeting(cleanQuestion)) {
      return null;
    }
    if (hasAnyTerm(text, ["como gerar pdf", "como criar rdo", "como usar stock ia", "como registrar materiais", "gerar pdf"])) {
      return null;
    }
    const project = detectTimelineProject(text);
    if (project && hasAnyTerm(text, ["estou trabalhando", "trabalhando no", "mexendo no", "continuando", "desenvolvendo"])) {
      return {
        type: "connect_project",
        project: project,
        message: "Isso parece relacionado ao projeto " + project + ". Quer conectar essa ideia a sua biblioteca ou Linha do Tempo?"
      };
    }
    if (detectDecisionCandidate(cleanQuestion)) {
      return {
        type: "decision",
        project: project,
        message: "Isso parece uma decisao importante. Quer registrar como marco da sua jornada?"
      };
    }
    if (hasAnyTerm(text, ["muita coisa ao mesmo tempo", "varias frentes", "muitas frentes", "coisa demais"])) {
      return {
        type: "focus",
        project: project,
        message: "Parece que voce esta com varias frentes abertas. Posso te ajudar a escolher uma prioridade agora."
      };
    }
    if (hasAnyTerm(text, ["vamos continuar", "continuar", "segue", "seguimos"])) {
      return {
        type: "continue",
        project: project,
        message: "Podemos continuar por tres caminhos: ObraReport, Stock IA ou Elo. Qual deles voce quer destravar primeiro?"
      };
    }
    return null;
  }

  function buildEloInitiativeSuggestion(opportunity, context) {
    if (!opportunity) {
      return "";
    }
    return opportunity.message || "";
  }

  function shouldSkipEloInitiative_(answer) {
    if (!answer) {
      return true;
    }
    const technicalThemes = ["pdf", "rdo", "materiais", "stock_ia", "relatorio", "sistema", "obra"];
    const technicalIntents = ["ajuda_pdf", "ajuda_rdo", "ajuda_materiais", "ajuda_stock", "ajuda_relatorio", "construction_record", "initiative_opportunity"];
    return technicalThemes.indexOf(answer.sessionTheme) >= 0 || technicalIntents.indexOf(answer.sessionIntent) >= 0;
  }

  function attachEloInitiativeToAnswer(answer, opportunity, context) {
    if (!answer || !opportunity || shouldSkipEloInitiative_(answer)) {
      return answer;
    }
    const next = Object.assign({}, answer);
    const suggestion = buildEloInitiativeSuggestion(opportunity, context);
    if (!suggestion) {
      return next;
    }
    if (!next.nextAction || normalizeText(next.nextAction).indexOf(normalizeText(suggestion)) < 0) {
      next.nextAction = suggestion;
    }
    next.eloInitiative = opportunity.type;
    return next;
  }

  function isTechnicalSynthesisBlocker_(message) {
    const text = normalizeText(message);
    return hasAnyTerm(text, [
      "como gerar pdf",
      "gerar pdf",
      "como abrir rdo",
      "como criar rdo",
      "como lancar material",
      "como lançar material",
      "como registrar material",
      "como registrar materiais",
      "como usar stock ia",
      "como funciona stock ia",
      "o que devo priorizar",
      "qual projeto devo focar",
      "qual projeto devo terminar primeiro"
    ]);
  }

  function detectSynthesisRequest(message) {
    const text = normalizeText(message);
    if (!text || isTechnicalSynthesisBlocker_(message)) {
      return false;
    }
    return hasAnyTerm(text, [
      "o que voce acha que eu deveria fazer",
      "o que você acha que eu deveria fazer",
      "o que eu faco agora",
      "o que eu faço agora",
      "o que faco agora",
      "o que faço agora",
      "me de uma orientacao",
      "me dê uma orientação",
      "o que faz mais sentido agora",
      "o que faz mais sentido",
      "qual caminho eu devo seguir",
      "estou perdido",
      "estou perdida",
      "me ajuda a pensar",
      "qual meu proximo passo",
      "qual meu próximo passo"
    ]);
  }

  function detectRecommendationRequest(message) {
    const text = normalizeText(message);
    if (!text || isTechnicalSynthesisBlocker_(message)) {
      return false;
    }
    return hasAnyTerm(text, [
      "qual e sua recomendacao",
      "qual é sua recomendação",
      "sua recomendacao",
      "sua recomendação",
      "qual caminho eu devo seguir",
      "qual e a melhor decisao",
      "qual é a melhor decisão",
      "o que voce recomenda",
      "o que você recomenda",
      "o que recomenda"
    ]);
  }

  function buildEloSynthesisContext(message, context) {
    const snapshot = getConnectedMemorySnapshot();
    const logicalContext = buildLogicalReasoningContext();
    const libraryContext = buildEloLibraryContext();
    const communicationContext = context || buildEloCommunicationContext(message);
    const rankedProjects = rankActiveProjects(logicalContext);
    const decisions = searchDecisionEvents("").slice(0, 5);
    const recentEvents = getTimelineEvents().slice(0, 6);
    const libraryQuery = buildEloLibraryFocusedQuery(message) || (rankedProjects[0] && rankedProjects[0].name) || "";
    const libraryResults = libraryQuery ? searchEloLibrary(libraryQuery).slice(0, 3) : [];
    const projects = rankedProjects.map(function (item) { return item.name; });
    const focus = communicationContext.focus || logicalContext.mainProject || snapshot.mainProject || snapshot.mostMentionedProject || projects[0] || "";
    const text = normalizeText(message);
    const dispersionSignals = projects.length >= 3 || hasAnyTerm(text, ["perdido", "perdida", "coisa demais", "muita coisa", "muitas frentes", "varias frentes"]);
    const commercialProject = rankedProjects.find(function (item) {
      const projectText = normalizeText(item.name);
      return projectText.indexOf("obrareport") >= 0 || projectText.indexOf("stock ia") >= 0;
    }) || rankedProjects[0] || null;

    return {
      message: message,
      snapshot: snapshot,
      logicalContext: logicalContext,
      libraryContext: libraryContext,
      communicationContext: communicationContext,
      mode: communicationContext.runtime ? communicationContext.runtime.mode : (isStandaloneMode() ? "standalone" : "obrareport"),
      projects: projects,
      rankedProjects: rankedProjects,
      goals: logicalContext.goals || [],
      important: snapshot.important || getImportantMemoriesStorage(),
      recentEvents: recentEvents,
      decisions: decisions,
      libraryResults: libraryResults,
      focus: focus,
      hasMemory: hasNarrativeJourneyData(snapshot),
      hasLibrary: Boolean((libraryContext.documents || []).length || (libraryContext.memoryLibrary || []).length),
      hasDecisions: Boolean(decisions.length),
      hasCommercialSignal: Boolean(commercialProject),
      commercialProject: commercialProject,
      dispersionSignals: dispersionSignals,
      nextProjectAction: suggestNextProjectAction(rankedProjects, logicalContext)
    };
  }

  function synthesizeEloSituation(synthesisContext) {
    const current = synthesisContext || buildEloSynthesisContext("");
    const mainProject = current.rankedProjects[0] || null;
    const commercial = current.commercialProject || mainProject;
    const projectNames = current.projects.slice(0, 4);
    const latestDecision = current.decisions[0] || null;
    const latestEvent = current.recentEvents[0] || null;
    const libraryItem = current.libraryResults[0] && current.libraryResults[0].item;
    const reading = projectNames.length
      ? "Voce esta girando em torno de " + formatNarrativeList(projectNames) + "."
      : "Ainda tenho pouco contexto salvo, entao a melhor leitura e organizar uma frente principal antes de decidir.";
    const weightParts = [];
    if (commercial && commercial.name) {
      weightParts.push(commercial.name + " parece ter o sinal mais pratico agora.");
    }
    if (current.dispersionSignals) {
      weightParts.push("tambem aparece risco de dispersao entre frentes abertas");
    }
    if (latestDecision) {
      weightParts.push("existe uma decisao recente registrada: " + latestDecision.title);
    }
    if (libraryItem) {
      weightParts.push("a biblioteca tambem aponta para " + libraryItem.title);
    }
    if (latestEvent && !latestDecision) {
      weightParts.push("o ultimo marco registrado foi " + latestEvent.title);
    }

    return {
      mainProject: mainProject,
      commercialProject: commercial,
      reading: reading,
      weight: weightParts.length ? weightParts.map(function (part) { return String(part).replace(/[.!?]+$/g, ""); }).join(". ") + "." : "o que pesa mais agora e escolher uma acao pequena e verificavel.",
      recommendationTarget: commercial && commercial.name ? commercial.name : (mainProject && mainProject.name) || current.focus || "",
      nextAction: current.nextProjectAction || "escolher uma entrega pequena e concluir antes de abrir outra frente.",
      needsMoreContext: !projectNames.length && !current.goals.length && !current.recentEvents.length
    };
  }

  function buildEloRecommendation(synthesis) {
    if (!synthesis || synthesis.needsMoreContext) {
      return "Minha recomendacao e simples: registre seus projetos principais, escolha uma frente e defina uma entrega pequena para hoje.";
    }
    if (synthesis.recommendationTarget) {
      return "eu focaria em " + synthesis.recommendationTarget + " como frente principal agora, sem abrir uma nova frente grande.";
    }
    return "eu reduziria o escopo e escolheria uma proxima acao pequena, concreta e testavel.";
  }

  function buildEloSynthesisAnswer(message, context) {
    if (!detectSynthesisRequest(message) && !detectRecommendationRequest(message)) {
      return null;
    }
    const synthesisContext = buildEloSynthesisContext(message, context);
    const synthesis = synthesizeEloSituation(synthesisContext);
    const depth = detectEloAnswerDepth_(message);
    const fullLines = [
      "Minha leitura:",
      synthesis.reading,
      "",
      "O que pesa mais agora:",
      synthesis.weight,
      "",
      "Minha recomendacao:",
      buildEloRecommendation(synthesis),
      "",
      "Proxima acao pequena:",
      synthesis.nextAction
    ];

    if (depth === "profunda") {
      const details = [];
      if (synthesisContext.decisions.length) {
        details.push("Decisoes recentes: " + synthesisContext.decisions.slice(0, 3).map(function (item) { return item.title; }).join(", ") + ".");
      }
      if (synthesisContext.libraryResults.length) {
        details.push("Biblioteca relacionada: " + synthesisContext.libraryResults.slice(0, 3).map(function (entry) { return entry.item.title; }).join(", ") + ".");
      }
      if (synthesisContext.goals.length) {
        details.push("Objetivos visiveis: " + synthesisContext.goals.slice(0, 3).join(", ") + ".");
      }
      if (details.length) {
        fullLines.push("", "Contexto usado:", details.join("\n"));
      }
    }

    return {
      shortAnswer: "Minha recomendacao e escolher a frente que mais destrava resultado agora.",
      fullAnswer: fullLines.join("\n"),
      nextAction: synthesis.nextAction,
      canSave: false,
      sessionTheme: "sintese",
      sessionIntent: "synthesis_recommendation"
    };
  }

  function detectDayClosingRequest(message) {
    const text = normalizeText(message);
    if (!text) {
      return false;
    }
    const closingTerms = [
      "vou dormir",
      "boa noite",
      "ate amanha",
      "ate amanhã",
      "encerrar por hoje",
      "fechar por hoje",
      "continuar amanha",
      "continuar amanhã",
      "cansado por hoje",
      "cansada por hoje"
    ];
    const tiredTerms = [
      "estou cansado",
      "estou cansada",
      "to cansado",
      "to cansada",
      "tô cansado",
      "tô cansada",
      "cansado",
      "cansada"
    ];
    if (hasAnyTerm(text, closingTerms)) {
      return true;
    }
    return hasAnyTerm(text, ["e agora"]) && hasAnyTerm(text, tiredTerms);
  }

  function formatShortEventTitle_(event) {
    if (!event) {
      return "";
    }
    return sanitizeLibraryText(event.title || event.content || "", 100);
  }

  function buildDayClosingAnswer(message, context) {
    const synthesisContext = buildEloSynthesisContext(message, context);
    const recentEvent = synthesisContext.recentEvents[0] || null;
    const recentDecision = synthesisContext.decisions[0] || null;
    const focus = synthesisContext.focus || (synthesisContext.rankedProjects[0] && synthesisContext.rankedProjects[0].name) || "";
    const didToday = formatShortEventTitle_(recentEvent) || formatShortEventTitle_(recentDecision);
    const lines = [
      "Boa noite. Hoje voce avancou bastante.",
      "",
      didToday
        ? "O registro que mais aparece agora e: " + didToday + "."
        : "O Elo ja esta com memoria, biblioteca, jornada, decisoes e sintese trabalhando juntos.",
      "",
      "Minha sugestao:",
      "encerre com tudo salvo e amanha retome " + (focus ? "por " + focus : "pela frente principal") + ", sem abrir uma frente nova."
    ];
    const text = normalizeText(message);
    if (hasAnyTerm(text, ["e agora", "cansado", "cansada", "vou dormir", "encerrar por hoje", "fechar por hoje"])) {
      lines.push("", "Agora e salvar, confirmar que o Git esta limpo e descansar.");
    }
    return {
      shortAnswer: "Boa noite. Encerrar bem tambem faz parte do projeto.",
      fullAnswer: lines.join("\n"),
      nextAction: "Amanha, retome pela proxima acao pequena ja definida.",
      canSave: false,
      sessionTheme: "fechamento",
      sessionIntent: "day_closing"
    };
  }

  function detectDaySummaryRequest(message) {
    const text = normalizeText(message);
    return hasAnyTerm(text, [
      "resumo do dia",
      "resumo de hoje",
      "o que fizemos hoje",
      "o que avancou hoje",
      "o que avançou hoje",
      "fechamento do dia"
    ]);
  }

  function buildDaySummaryAnswer(message, context) {
    const synthesisContext = buildEloSynthesisContext(message, context);
    const todayEvents = getTimelineEvents().filter(isTodayTimelineEvent);
    const latestEvent = todayEvents[0] || synthesisContext.recentEvents[0] || null;
    const latestDecision = synthesisContext.decisions[0] || null;
    const focus = synthesisContext.focus || (synthesisContext.rankedProjects[0] && synthesisContext.rankedProjects[0].name) || "";
    const mainAdvance = formatShortEventTitle_(latestEvent) || formatShortEventTitle_(latestDecision) || (focus ? "organizacao do foco em " + focus : "organizacao do Elo e da jornada");
    const avoidedRisk = synthesisContext.dispersionSignals
      ? "evitar abrir frentes demais ao mesmo tempo"
      : "manter o escopo pequeno e nao mexer fora do Elo";
    const tomorrow = String(synthesisContext.nextProjectAction || "retomar pela proxima acao pequena").replace(/[.!?]+$/g, "");
    return {
      shortAnswer: "Fechamento de hoje.",
      fullAnswer: [
        "Fechamento de hoje:",
        "- avanco principal: " + mainAdvance + ".",
        "- risco evitado: " + avoidedRisk + ".",
        "- proximo passo de amanha: " + tomorrow + "."
      ].join("\n"),
      nextAction: "Se for encerrar agora, salve o trabalho e descanse.",
      canSave: false,
      sessionTheme: "fechamento",
      sessionIntent: "day_summary"
    };
  }

  function getLogicalReasoningResponse(question) {
    const intent = detectLogicalReasoningQuestion(question);
    if (!intent) {
      return null;
    }
    return buildLogicalReasoningAnswer(question, buildLogicalReasoningContext());
  }

  function normalizeEloText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[?!.,;:]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function detectEloRuntimeContext(message) {
    const screen = getCurrentScreenContext();
    const text = normalizeEloText(message);
    return {
      mode: isStandaloneMode() ? "standalone" : "obrareport",
      screen: screen,
      isStandalone: isStandaloneMode(),
      isObraReport: !isStandaloneMode(),
      isPersonalOrReflective: Boolean(detectNarrativeMemoryQuestion(message) || detectLogicalReasoningQuestion(message) || getHumanQuestionResponse(message)),
      isOperational: hasAnyTerm(text, ["obrareport", "rdo", "diario", "pdf", "material", "materiais", "stock ia", "estoque", "relatorio", "relatorio tecnico"]),
      isStock: hasAnyTerm(text, ["stock ia", "estoque", "almoxarifado", "saldo", "entrada por nota"]),
      isRdoOrPdf: hasAnyTerm(text, ["rdo", "diario", "pdf", "relatorio"]),
      isGreeting: Boolean(detectSocialGreeting(message)),
      isMemory: Boolean(detectNarrativeMemoryQuestion(message)),
      isReasoning: Boolean(detectLogicalReasoningQuestion(message)),
      isConceptual: Boolean(getConceptResponse(message) || getPhilosophyResponse(message))
    };
  }

  function buildEloIdentityContext(message) {
    const runtime = detectEloRuntimeContext(message || "");
    return {
      name: ELO_PROFILE.name,
      role: "companheiro digital e copiloto inteligente",
      essence: "ajudar o usuário a lembrar, pensar, decidir, organizar e executar",
      modes: ["standalone", "obrareport"],
      currentMode: runtime.mode,
      runtime: runtime,
      limits: ELO_PROFILE.limits.slice()
    };
  }

  function buildEloCommunicationContext(message) {
    const snapshot = getConnectedMemorySnapshot();
    const runtime = detectEloRuntimeContext(message || "");
    return {
      runtime: runtime,
      snapshot: snapshot,
      hasMemory: hasNarrativeJourneyData(snapshot),
      userName: snapshot.userName || "",
      projects: (snapshot.projects || []).slice(0, 5),
      goals: (snapshot.goals || []).slice(0, 4),
      focus: snapshot.mainProject || snapshot.mostMentionedProject || "",
      latestEvent: snapshot.latestImportantEvent || snapshot.latestAchievement || snapshot.recentEvents[0] || null
    };
  }

  function detectUserCommunicationNeed(message, context) {
    const runtime = context && context.runtime ? context.runtime : detectEloRuntimeContext(message);
    if (runtime.isGreeting) {
      return "social_presence";
    }
    if (runtime.isOperational) {
      return "operational_guidance";
    }
    if (runtime.isMemory) {
      return "memory_narrative";
    }
    if (runtime.isReasoning) {
      return "decision_support";
    }
    if (runtime.isConceptual) {
      return "conceptual_reflection";
    }
    return "general";
  }

  function planEloAnswer(message, context) {
    const need = detectUserCommunicationNeed(message, context);
    return {
      need: need,
      shouldUseMemory: ["memory_narrative", "decision_support", "social_presence"].indexOf(need) >= 0,
      shouldUseScreen: Boolean(context && context.runtime && context.runtime.isObraReport),
      shouldBeShort: ["social_presence", "general"].indexOf(need) >= 0,
      shouldOfferNextStep: true
    };
  }

  function buildEloAnswerDraft(message, context, plan) {
    const name = context.userName ? context.userName + ", " : "";
    if (plan.need === "operational_guidance" && context.runtime.isObraReport) {
      return "Posso te ajudar a criar um RDO, lançar material, gerar PDF, usar o Stock IA, revisar um relatório ou organizar seu próximo passo.";
    }
    if (plan.need === "operational_guidance") {
      return "Posso te orientar sobre ObraReport, RDO, PDF, materiais e Stock IA, mas também posso ajudar com projetos, decisões e organização de ideias.";
    }
    if (context.hasMemory && (plan.need === "general" || plan.need === "decision_support")) {
      return name + "pelo que eu lembro, o melhor caminho é transformar a dúvida em uma próxima ação pequena. Posso olhar seus projetos, prioridades ou sua linha do tempo para ajudar com mais contexto.";
    }
    if (context.runtime.isStandalone) {
      return "Posso te ajudar por alguns caminhos. Posso organizar uma ideia, lembrar um projeto, ajudar em uma decisão ou transformar uma ideia em plano.";
    }
    return "Posso te ajudar a criar um RDO, lançar material, gerar PDF, usar o Stock IA, revisar um relatório ou organizar seu próximo passo.";
  }

  function polishEloAnswer(answer, context, plan) {
    const polished = String(answer || "").trim()
      .replace(/Não encontrei na memória/gi, "Ainda não tenho isso salvo")
      .replace(/Dados encontrados/gi, "Pelo que eu lembro")
      .replace(/Você deve/gi, "Eu começaria por");
    if (!polished) {
      return context && context.runtime && context.runtime.isStandalone
        ? "Posso te ajudar a pensar, lembrar, organizar projetos, tomar decisões ou transformar uma ideia em plano."
        : "Posso te ajudar com ObraReport, RDO, PDF, materiais, Stock IA ou próximos passos.";
    }
    return polished;
  }

  function classifyEloTone(message, intent, context) {
    const text = normalizeEloText(message);
    const runtime = context && context.runtime ? context.runtime : detectEloRuntimeContext(message);

    if (intent === "greeting" || runtime.isGreeting) {
      return "saudacao";
    }
    if (intent === "library_question" || isEloLibraryQuestion(message)) {
      return "biblioteca";
    }
    if (intent === "memory_question" || runtime.isMemory) {
      return "memoria";
    }
    if (intent === "logical_reasoning" || runtime.isReasoning || hasAnyTerm(text, ["priorizar", "decidir", "decisao", "decisão", "proximo passo", "próximo passo", "caminho certo"])) {
      return "decisao";
    }
    if (hasAnyTerm(text, ["nao vou dar conta", "não vou dar conta", "estou cansado", "estou cansada", "estou perdido", "estou perdida", "medo", "inseguro", "insegura"])) {
      return "desabafo";
    }
    if (intent === "pdf_help" || intent === "rdo_help" || intent === "materials_help" || intent === "stock_help" || intent === "report_help" || runtime.isOperational) {
      return "duvida_tecnica";
    }
    if (intent === "continuity" || hasAnyTerm(text, ["me ajuda", "me ajude", "e agora", "continua", "o que faco", "o que faço"])) {
      return "continuidade";
    }
    if (hasAnyTerm(text, ["projeto", "produtividade", "foco", "entrega", "vender", "concluir"])) {
      return "projeto";
    }
    return "conversa";
  }

  function detectEloAnswerDepth_(message) {
    const text = normalizeEloText(message);
    if (hasAnyTerm(text, ["explique melhor", "aprofunde", "quero detalhes", "analise completa", "análise completa", "desenvolva melhor", "me de mais contexto", "me dê mais contexto", "resposta completa"])) {
      return "profunda";
    }
    if (hasAnyTerm(text, ["explique", "detalhe", "analise", "análise"])) {
      return "media";
    }
    return "curta";
  }

  function buildEloConversationPlan(message, context, intent) {
    const currentContext = context || buildEloCommunicationContext(message);
    const basePlan = planEloAnswer(message, currentContext);
    const tone = classifyEloTone(message, intent || classifyEloIntent(message, currentContext), currentContext);
    return Object.assign({}, basePlan, {
      tone: tone,
      intent: intent || "unknown",
      depth: detectEloAnswerDepth_(message),
      shouldBeShort: tone !== "duvida_tecnica" && tone !== "biblioteca" && detectEloAnswerDepth_(message) !== "profunda"
    });
  }

  function avoidRoboticEloPhrases(answer) {
    return String(answer || "")
      .replace(/Como uma IA[, ]*/gi, "")
      .replace(/Como inteligÃªncia artificial[, ]*/gi, "")
      .replace(/Como inteligência artificial[, ]*/gi, "")
      .replace(/NÃ£o tenho emoÃ§Ãµes ou consciÃªncia humana\.?/gi, "Nao sou uma pessoa.")
      .replace(/Não tenho emoções ou consciência humana\.?/gi, "Nao sou uma pessoa.")
      .replace(/NÃ£o tenho consciÃªncia humana\.?/gi, "Nao sou uma pessoa.")
      .replace(/Não tenho consciência humana\.?/gi, "Nao sou uma pessoa.")
      .replace(/Com base nos dados disponÃ­veis/gi, "Pelo que aparece agora")
      .replace(/Com base nos dados disponíveis/gi, "Pelo que aparece agora")
      .replace(/NÃ£o encontrei cadastro/gi, "Ainda nao encontrei isso")
      .replace(/Não encontrei cadastro/gi, "Ainda nao encontrei isso")
      .replace(/Montei um resumo/gi, "O que aparece")
      .replace(/Consultei sua base/gi, "Pelo que eu lembro")
      .replace(/Segundo a estrutura interna/gi, "Na pratica")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function humanizeEloAnswer(answer, tone, context, plan) {
    let text = avoidRoboticEloPhrases(answer);
    if (!text) {
      return text;
    }
    if (tone === "saudacao") {
      text = text
        .replace(/^estou aqui\./i, "Oi. Estou aqui.")
        .replace(/^tudo certo por aqui\./i, "Tudo certo por aqui.");
    }
    if (tone === "continuidade" && context && !context.hasMemory && text.length < 80) {
      text = "Posso ajudar por tres caminhos: organizar uma ideia, revisar sua biblioteca ou escolher o proximo passo de um projeto.";
    }
    if (plan && plan.depth !== "profunda") {
      text = text.replace(/^\s*PrÃ³xima aÃ§Ã£o:\s*/gim, "Proxima acao: ");
    }
    return text.trim();
  }

  function splitEloAnswerLines_(text) {
    return String(text || "").split("\n").map(function (line) {
      return line.trim();
    }).filter(Boolean);
  }

  function shortenEloAnswerIfNeeded(answer, tone, context, plan) {
    const next = Object.assign({}, answer || {});
    const protectedIntents = ["biblioteca_local", "conceptual_question", "pergunta_humana", "crise", "project_advisor", "decision_memory", "initiative_opportunity", "synthesis_recommendation"];
    const depth = plan && plan.depth ? plan.depth : "curta";
    if (depth === "profunda" || protectedIntents.indexOf(next.sessionIntent) >= 0) {
      return next;
    }
    const maxLines = depth === "media" || tone === "duvida_tecnica" ? 10 : 5;
    const lines = splitEloAnswerLines_(next.fullAnswer);
    if (lines.length > maxLines) {
      next.fullAnswer = lines.slice(0, maxLines).join("\n");
    }
    return next;
  }

  function addEloNextStep(answer, context, plan) {
    const next = Object.assign({}, answer || {});
    if (next.nextAction) {
      next.nextAction = avoidRoboticEloPhrases(next.nextAction);
      return next;
    }
    if (plan && plan.tone === "biblioteca") {
      next.nextAction = "Abra Biblioteca do Elo para revisar ou adicionar mais contexto.";
    } else if (context && context.runtime && context.runtime.isObraReport) {
      next.nextAction = "Diga se quer criar RDO, lancar material, gerar PDF, usar Stock IA ou pensar no proximo passo.";
    } else {
      next.nextAction = "Diga se quer organizar uma ideia, revisar sua biblioteca ou escolher o proximo passo.";
    }
    return next;
  }

  function applyEloCommunicationLayer(message, response) {
    if (!response) {
      return response;
    }
    const context = buildEloCommunicationContext(message);
    const intent = response.sessionIntent || classifyEloIntent(message, context);
    const plan = buildEloConversationPlan(message, context, intent);
    const tone = classifyEloTone(message, intent, context);
    let next = Object.assign({}, response);

    next.shortAnswer = humanizeEloAnswer(next.shortAnswer, tone, context, plan);
    next.fullAnswer = humanizeEloAnswer(next.fullAnswer, tone, context, plan);
    next = addEloNextStep(next, context, plan);
    next = shortenEloAnswerIfNeeded(next, tone, context, plan);
    next = attachEloInitiativeToAnswer(next, detectEloInitiativeOpportunity(message, context), context);
    next.communicationTone = tone;
    return next;
  }

  function buildHelpfulFallbackAnswer(message, context) {
    const currentContext = context || buildEloCommunicationContext(message);
    const runtime = currentContext.runtime || detectEloRuntimeContext(message);
    const fullAnswer = runtime.isObraReport
      ? "Posso te ajudar a criar um RDO, lancar material, gerar PDF, usar o Stock IA, revisar um relatorio ou organizar seu proximo passo."
      : "Posso ajudar por tres caminhos: organizar uma ideia, revisar sua biblioteca ou escolher o proximo passo de um projeto.";
    return {
      shortAnswer: "Ajudo sim.",
      fullAnswer: fullAnswer,
      nextAction: runtime.isObraReport
        ? "Diga: quero criar um RDO, quero lancar material ou quero gerar PDF."
        : "Diga se quer projeto, memoria, biblioteca ou decisao.",
      canSave: false,
      sessionTheme: "comunicacao",
      sessionIntent: "fallback_comunicativo"
    };
  }

  function answerWithEloCommunicationEngine(message) {
    const communicationContext = buildEloCommunicationContext(message);
    const communicationIntent = classifyEloIntent(message, communicationContext);
    const communicationPlan = buildEloConversationPlan(message, communicationContext, communicationIntent);
    const communicationFallback = buildHelpfulFallbackAnswer(message, communicationContext);
    communicationFallback.fullAnswer = polishEloAnswer(buildEloAnswerDraft(message, communicationContext, communicationPlan) || communicationFallback.fullAnswer, communicationContext, communicationPlan);
    return applyEloCommunicationLayer(message, communicationFallback);

    const context = buildEloCommunicationContext(message);
    const plan = planEloAnswer(message, context);
    return {
      shortAnswer: "Posso te ajudar.",
      fullAnswer: polishEloAnswer(buildEloAnswerDraft(message, context, plan), context, plan),
      nextAction: context.runtime.isStandalone
        ? "Diga se quer organizar uma ideia, lembrar um projeto ou decidir o próximo passo."
        : "Diga se quer criar RDO, lançar material, gerar PDF, usar Stock IA ou pensar no próximo passo.",
      canSave: false,
      sessionTheme: "comunicacao",
      sessionIntent: "fallback_comunicativo"
    };
  }

  function stripEloMentionForIntent_(message) {
    return normalizeEloText(message).replace(/^elo\s+/, "").trim();
  }

  function detectUserNameSave_(message) {
    const clean = sanitizeUserText(message).replace(/[.!?]+$/g, "").trim();
    if (looksLikeQuestionOrRequestForName_(message)) {
      return "";
    }

    const match = clean.match(/^(?:meu nome (?:e|é)|eu me chamo|pode me chamar de|me chame de)\s+(.+)$/i);
    if (match) {
      const explicitName = sanitizeLibraryText(match[1], 60).replace(/[.,;:]+$/g, "").trim();
      return isValidExplicitUserName_(explicitName) ? explicitName : "";
    }

    const shortSouMatch = clean.match(/^sou\s+(.+)$/i);
    if (shortSouMatch) {
      const shortName = sanitizeLibraryText(shortSouMatch[1], 60).replace(/[.,;:]+$/g, "").trim();
      return isValidExplicitUserName_(shortName) ? shortName : "";
    }

    return "";
  }

  function detectStandaloneNameCapture_(message) {
    return detectUserNameSave_(message);
  }

  function isStandaloneNameCaptureAttempt_(message) {
    const normalized = normalizeWakeCallText(message);
    return /^(meu nome (?:e|é)|eu me chamo|pode me chamar de|me chame de|sou)\s+/.test(normalized);
  }

  function detectEloDemoQuestion_(text) {
    return hasAnyTerm(text, [
      "modo demonstracao",
      "modo demonstração",
      "demonstrar o elo",
      "mostrar demonstracao",
      "mostrar demonstração",
      "apresentacao do sistema",
      "apresentação do sistema",
      "me mostre o que voce faz",
      "me mostre o que você faz",
      "o que voce consegue fazer",
      "o que você consegue fazer",
      "como voce pode ajudar",
      "como você pode ajudar"
    ]);
  }

  function detectGuidedActionType_(text) {
    if (hasAnyTerm(text, ["quero criar um rdo", "quero fazer um rdo", "quero registrar rdo", "criar um rdo"])) {
      return "rdo";
    }
    if (hasAnyTerm(text, ["quero fazer um relatorio", "quero fazer um relatório", "quero criar um relatorio", "quero criar um relatório"])) {
      return "relatorio";
    }
    if (hasAnyTerm(text, ["quero lancar material", "quero lançar material", "quero registrar material", "quero lancar materiais", "quero lançar materiais", "quero lançar material", "quero lancar material"])) {
      return "material";
    }
    if (hasAnyTerm(text, ["quero gerar pdf", "quero gerar um pdf", "quero exportar pdf"])) {
      return "pdf";
    }
    if (hasAnyTerm(text, ["quero controlar estoque", "quero testar estoque", "quero usar stock ia"])) {
      return "estoque";
    }
    if (hasAnyTerm(text, ["quero testar o sistema", "sou novo aqui", "sou nova aqui", "por onde comeco", "por onde começo"])) {
      return "inicio";
    }
    return "";
  }

  function detectConstructionRecord(message) {
    const clean = sanitizeUserText(message);
    const text = normalizeEloText(clean);
    const productionMatch = text.match(/(?:foram executados|foi executado|fizemos|hoje executamos|executamos)\s+([\d]+(?:[,.]\d+)?)\s*(m2|m²|metros|metro|sacos|un|unidades)?\s+de\s+([a-z0-9\sçãõáéíóúâêô]+?)(?:\s+e\s+|$)/);
    const materialMatches = [];
    const materialRegex = /(?:usados|usamos|gastamos|foram usados|foi usado)\s+([\d]+(?:[,.]\d+)?)\s+(?:(sacos|saco|kg|m2|m²|un|unidades?)\s+de\s+)?([a-z0-9\sçãõáéíóúâêô]+?)(?:\s+e\s+|$)/g;
    let match = materialRegex.exec(text);
    while (match) {
      materialMatches.push({
        quantity: match[1],
        unit: match[2] || "",
        name: sanitizeLibraryText(match[3], 80)
      });
      match = materialRegex.exec(text);
    }
    if (!productionMatch && !materialMatches.length) {
      return null;
    }
    return {
      service: productionMatch ? sanitizeLibraryText(productionMatch[3], 80) : "",
      quantity: productionMatch ? productionMatch[1] : "",
      unit: productionMatch ? (productionMatch[2] || "") : "",
      materials: materialMatches
    };
  }

  function classifyEloIntent(message, context) {
    const text = stripEloMentionForIntent_(message);
    const saveName = detectUserNameSave_(message);
    if (saveName) {
      return "save_user_name";
    }
    if (hasAnyTerm(text, ["voce e humano", "voce esta vivo", "voce sente emocao", "voce sente emocoes", "voce tem consciencia"])) {
      return "elo_limits";
    }
    if (hasAnyTerm(text, ["qual meu nome", "qual e o meu nome", "qual é o meu nome", "como eu me chamo", "voce sabe meu nome", "você sabe meu nome"])) {
      return "user_name_question";
    }
    if (hasAnyTerm(text, ["qual seu nome", "qual e seu nome", "qual é seu nome", "qual o seu nome", "qual e o seu nome", "qual é o seu nome", "qual o nome do elo", "qual e o nome do elo", "qual é o nome do elo", "seu nome e qual", "seu nome é qual", "como voce se chama", "como você se chama", "quem e voce", "quem é você", "quem e o elo", "quem é o elo", "o que e o elo", "o que é o elo"])) {
      return "elo_identity";
    }
    if (detectDayClosingRequest(message)) {
      return "day_closing";
    }
    if (detectDaySummaryRequest(message)) {
      return "day_summary";
    }
    if (detectSocialGreeting(message)) {
      return "greeting";
    }
    if (detectConstructionRecord(message)) {
      return "construction_record";
    }
    if (detectEloDemoQuestion_(text)) {
      return "elo_demo";
    }
    if (detectGuidedActionType_(text)) {
      return "guided_action";
    }
    if (detectSynthesisRequest(message) || detectRecommendationRequest(message)) {
      return "synthesis_recommendation";
    }
    if (hasAnyTerm(text, ["me ajuda", "me ajude", "e agora", "continua", "qual proximo passo", "o que faco"])) {
      return "continuity";
    }
    if (detectProjectAdvisorRequest(message)) {
      return "project_advisor";
    }
    if (buildDecisionMemoryAnswer(message)) {
      return "decision_memory";
    }
    if (detectEloInitiativeOpportunity(message, context)) {
      return "initiative_opportunity";
    }
    if (hasAnyTerm(text, ["o que voce faz", "o que você faz", "suas funcoes", "suas funções", "capacidades do elo", "como voce ajuda", "como você ajuda"])) {
      return "capabilities";
    }
    if (detectLogicalReasoningQuestion(message)) {
      return "logical_reasoning";
    }
    if (detectJourneyReportRequest(message)) {
      return "journey_report";
    }
    if (buildTimelineAnswer(message)) {
      return "timeline_question";
    }
    if (detectNarrativeMemoryQuestion(message) || hasAnyTerm(text, ["meus projetos", "linha do tempo", "o que voce lembra", "o que você lembra"])) {
      return "memory_question";
    }
    if (isEloLibraryQuestion(message) || (hasAnyTerm(text, ["o que voce sabe sobre", "o que você sabe sobre"]) && buildEloLibraryAnswer(message))) {
      return "library_question";
    }
    if (hasAnyTerm(text, ["como uso o sistema", "como usar o sistema", "nunca usei", "por onde comeco", "por onde começo", "onde cadastro obra", "onde cadastrar obra", "onde cadastro cliente", "como envio para cliente", "como usar obrareport", "como funciona o obrareport", "o que e obrareport", "o que é obrareport"])) {
      return "system_help";
    }
    if (hasAnyTerm(text, ["rdo", "diario de obra", "diario de obras", "diário de obra", "diário de obras", "servico executado", "serviço executado", "producao executada", "produção executada"])) {
      return "rdo_help";
    }
    if (hasAnyTerm(text, ["stock ia", "estoque", "almoxarifado", "materiais acabando", "entrada por nota", "saldo de estoque"])) {
      return "stock_help";
    }
    if (hasAnyTerm(text, ["material", "materiais", "consumo", "lancei", "alvenaria", "cimento", "bloco", "areia"])) {
      return "materials_help";
    }
    if (hasAnyTerm(text, ["pdf", "gerar pdf", "exportar pdf"])) {
      return "pdf_help";
    }
    if (hasAnyTerm(text, ["relatorio tecnico", "relatório técnico", "relatorio", "relatório", "vistoria", "laudo"])) {
      return "report_help";
    }
    if (getConceptResponse(message) || getPhilosophyResponse(message)) {
      return "conceptual_question";
    }
    return "unknown";
  }

  function buildEloLimitsAnswer_() {
    return {
      shortAnswer: "Nao sou uma pessoa.",
      fullAnswer: "Fui criado para acompanhar sua jornada usando memoria, contexto e organizacao.",
      nextAction: "Posso te ajudar a pensar uma decisao, revisar sua biblioteca ou organizar o proximo passo.",
      canSave: false,
      sessionTheme: "elo",
      sessionIntent: "limites_elo"
    };
  }

  function buildContinuityAnswer_(message) {
    const context = buildEloCommunicationContext(message);
    const focus = context.focus || (context.projects && context.projects[0]) || "";
    let fullAnswer = "";

    if (focus) {
      fullAnswer = "Eu começaria pelo que destrava mais coisas agora: " + focus + ".\n\nSe a ideia é avançar sem abrir outra frente, escolha uma entrega pequena e conclua hoje.";
    } else if (context.projects && context.projects.length) {
      fullAnswer = "Vejo alguns projetos na sua jornada: " + formatNarrativeList(context.projects.slice(0, 3)) + ".\n\nO melhor próximo passo é escolher um deles e definir uma entrega pequena.";
    } else {
      fullAnswer = "Posso ajudar por tres caminhos: organizar uma ideia, revisar sua biblioteca ou escolher o proximo passo de um projeto.";
    }

    return {
      shortAnswer: "Vamos por partes.",
      fullAnswer: fullAnswer,
      nextAction: "Diga qual projeto ou ideia voce quer destravar primeiro.",
      canSave: false,
      sessionTheme: "continuidade",
      sessionIntent: "continuidade"
    };
  }

  function buildEloIdentityAnswer_() {
    const identityContext = buildEloIdentityContext();
    const modeLine = identityContext.currentMode === "obrareport"
      ? "Aqui dentro do ObraReport, tambem atuo como copiloto tecnico para relatorios, RDO, PDF, materiais e Stock IA."
      : "Fora do ObraReport, continuo sendo o mesmo Elo: posso ajudar com memoria, projetos, decisoes, biblioteca e organizacao de ideias.";
    return {
      shortAnswer: "Eu sou o Elo.",
      fullAnswer: [
        "Fui criado para acompanhar ideias, memorias, projetos e decisoes ao longo do tempo.",
        "Posso ajudar a organizar informacoes, encontrar padroes e conectar o que voce ja construiu.",
        modeLine
      ].join("\n\n"),
      nextAction: "Diga se quer revisar memoria, biblioteca, projeto ou uma decisao.",
      canSave: false,
      sessionTheme: "elo",
      sessionIntent: "identidade_elo"
    };

    const identity = buildEloIdentityContext();
    const fullAnswer = [
      "Eu sou o Elo. Um companheiro digital criado para acompanhar sua jornada, ajudar você a organizar ideias, lembrar projetos, pensar com clareza e executar melhor.",
      "Eu não sou uma pessoa e não tenho consciência humana. Sou um sistema digital com memória local, linguagem e ferramentas para te orientar com segurança."
    ];

    if (identity.currentMode === "obrareport") {
      fullAnswer.push("Neste ambiente, eu também atuo como copiloto técnico para relatórios, RDO, PDF, materiais e Stock IA.");
    } else {
      fullAnswer.push("Quando estou fora do ObraReport, continuo sendo o mesmo Elo: posso ajudar com memórias, projetos, decisões, linha do tempo, biblioteca e organização de ideias.");
    }

    fullAnswer.push("Eu sou o mesmo Elo, mas adapto minha ajuda ao contexto em que você está.");

    return {
      shortAnswer: "Eu sou o Elo.",
      fullAnswer: fullAnswer.join("\n\n"),
      nextAction: "Pergunte algo como: como uso o sistema? ou o que devo priorizar?",
      canSave: false,
      sessionTheme: "elo",
      sessionIntent: "identidade_elo"
    };
  }

  function buildUserNameQuestionAnswer_() {
    const name = getPreferredUserName();
    return {
      shortAnswer: name ? "Você me pediu para chamar você de " + name + "." : "Ainda não sei o seu nome.",
      fullAnswer: name
        ? "Esse nome fica salvo apenas neste navegador."
        : "Se quiser, diga: Meu nome é Ícaro.\n\nDepois disso eu posso lembrar como devo chamar você.",
      nextAction: name ? "Se quiser mudar, diga: pode me chamar de outro nome." : "Diga seu nome se quiser que eu personalize as respostas.",
      canSave: false,
      sessionTheme: "perfil",
      sessionIntent: "nome_usuario"
    };
  }

  function buildSaveUserNameAnswer_(message) {
    const name = detectUserNameSave_(message);
    if (!name || isInvalidUserNameAnswer_(name)) {
      const greeting = getSocialGreetingResponse(message);
      return greeting || {
        shortAnswer: "Não vou salvar isso como nome.",
        fullAnswer: "Para evitar confusão, eu não salvo cumprimentos ou comandos como nome. Se quiser, diga algo como: Meu nome é Ícaro.",
        nextAction: "Diga apenas o nome que devo usar.",
        canSave: false,
        sessionTheme: "perfil",
        sessionIntent: "nome_invalido"
      };
    }
    const currentProfile = getUserProfile();
    setUserProfile(Object.assign({}, currentProfile, { userName: name }));
    return {
      shortAnswer: "Perfeito, " + name + ".",
      fullAnswer: "Vou me referir a você assim. Esse nome fica salvo apenas neste navegador.",
      nextAction: "Agora posso responder com mais contexto quando você pedir memória, foco ou próximos passos.",
      canSave: false,
      sessionTheme: "perfil",
      sessionIntent: "salvar_nome"
    };
  }

  function buildSystemHelpAnswer_() {
    if (isStandaloneMode()) {
      return {
        shortAnswer: "Eu te guio.",
        fullAnswer: [
          "Se você está começando pelo Elo, use assim:",
          "1. conte uma ideia, projeto ou objetivo;",
          "2. peça para eu organizar o próximo passo;",
          "3. registre memórias importantes quando fizer sentido;",
          "4. use a Linha do Tempo para marcos e decisões;",
          "5. peça ajuda com ObraReport, RDO, PDF ou Stock IA quando quiser usar o sistema.",
          "",
          "Eu sou o mesmo Elo em todos os contextos. Fora do ObraReport, meu foco é te ajudar a pensar, lembrar, decidir e organizar."
        ].join("\n"),
        nextAction: "Diga: me mostre o que você faz, ou me ajude a decidir.",
        canSave: false,
        sessionTheme: "sistema",
        sessionIntent: "ajuda_sistema"
      };
    }

    return {
      shortAnswer: "Eu te guio.",
      fullAnswer: [
        "Comece assim:",
        "1. Cadastre ou selecione uma obra.",
        "2. Crie um relatório técnico ou um RDO.",
        "3. Registre fotos, ocorrências e serviços executados.",
        "4. Lance materiais consumidos, se houver.",
        "5. Gere o PDF ou resumo para enviar ao cliente.",
        "",
        "Se quiser testar rápido, use:",
        "- Gerar RDO agora",
        "- Testar materiais",
        "- Ver exemplo de PDF"
      ].join("\n"),
      nextAction: "Se estiver começando, abra Diário de Obras ou Relatórios.",
      canSave: false,
      sessionTheme: "sistema",
      sessionIntent: "ajuda_sistema"
    };
  }

  function buildEloDemoAnswer_() {
    const identity = buildEloIdentityContext();
    const standaloneIntro = [
      "Posso te mostrar.",
      "",
      "Como companheiro digital, eu posso ajudar a lembrar projetos, organizar ideias, registrar momentos, comparar prioridades e transformar uma dúvida em plano."
    ];
    if (identity.currentMode === "standalone") {
      standaloneIntro.push(
        "",
        "Se você quiser falar de ObraReport, RDO, PDF ou Stock IA, eu também consigo te orientar. O exemplo abaixo mostra como eu ligo uma informação solta a uma ação prática."
      );
    }

    return {
      shortAnswer: "Posso te mostrar.",
      fullAnswer: [
        standaloneIntro.join("\n"),
        "",
        "Imagine que hoje foi executado 12 m² de alvenaria.",
        "",
        "Você pode me dizer:",
        "\"Foram executados 12 m² de alvenaria e usados 30 blocos.\"",
        "",
        "A partir disso, eu posso ajudar a:",
        "1. registrar a produção do dia;",
        "2. organizar o material consumido;",
        "3. relacionar com o RDO;",
        "4. comparar com o estoque;",
        "5. preparar um resumo para o cliente;",
        "6. orientar a geração do PDF.",
        "",
        "O objetivo é simples:",
        "transformar informações soltas da obra em registro organizado."
      ].join("\n"),
      nextAction: "Teste dizendo: Foram executados 12 m² de alvenaria e usados 30 blocos.",
      canSave: false,
      sessionTheme: "demo",
      sessionIntent: "elo_demo"
    };
  }

  function buildGuidedActionAnswer_(message) {
    const type = detectGuidedActionType_(stripEloMentionForIntent_(message));
    const answers = {
      material: {
        shortAnswer: "Vamos fazer isso de forma simples.",
        fullAnswer: [
          "Me diga três coisas:",
          "1. O que foi executado?",
          "2. Quanto foi executado?",
          "3. Qual material foi usado?",
          "",
          "Exemplo:",
          "\"Foram executados 12 m² de alvenaria e usados 30 blocos cerâmicos.\"",
          "",
          "Depois disso, você pode salvar esse registro no módulo de materiais ou usar no RDO."
        ].join("\n"),
        nextAction: "Escreva a produção e o material usado."
      },
      rdo: {
        shortAnswer: "Vamos criar um RDO.",
        fullAnswer: [
          "Comece registrando:",
          "1. data;",
          "2. obra;",
          "3. condições do tempo;",
          "4. equipe;",
          "5. serviços executados;",
          "6. materiais utilizados;",
          "7. fotos;",
          "8. ocorrências.",
          "",
          "O mais importante é começar pelo serviço executado hoje."
        ].join("\n"),
        nextAction: "Abra Diário de Obras e registre o serviço executado."
      },
      relatorio: {
        shortAnswer: "Vamos montar um relatório técnico.",
        fullAnswer: [
          "Comece pelo básico:",
          "1. selecione cliente e obra;",
          "2. descreva o que foi vistoriado;",
          "3. adicione fotos;",
          "4. registre análise técnica;",
          "5. escreva conclusão e recomendações;",
          "6. gere o PDF para entrega."
        ].join("\n"),
        nextAction: "Abra Relatórios e comece pela identificação da obra."
      },
      pdf: {
        shortAnswer: "Vamos preparar o PDF.",
        fullAnswer: [
          "Antes de gerar:",
          "1. confira dados da obra;",
          "2. revise fotos e descrições;",
          "3. verifique ocorrências e conclusão;",
          "4. confirme responsável técnico;",
          "5. clique em Gerar PDF."
        ].join("\n"),
        nextAction: "Abra o relatório ou RDO que deseja exportar."
      },
      estoque: {
        shortAnswer: "Vamos controlar o estoque pelo Stock IA.",
        fullAnswer: [
          "Comece assim:",
          "1. cadastre materiais principais;",
          "2. informe saldo inicial;",
          "3. registre entradas por nota;",
          "4. use o RDO para baixar consumo;",
          "5. acompanhe alertas e lista de compras."
        ].join("\n"),
        nextAction: "Abra Stock IA e cadastre o primeiro material."
      },
      inicio: {
        shortAnswer: "Vamos começar pelo caminho mais simples.",
        fullAnswer: buildSystemHelpAnswer_().fullAnswer,
        nextAction: "Escolha uma ação: criar RDO, lançar material ou gerar PDF."
      }
    };
    const answer = answers[type] || answers.inicio;
    return {
      shortAnswer: answer.shortAnswer,
      fullAnswer: answer.fullAnswer,
      nextAction: answer.nextAction,
      canSave: false,
      sessionTheme: "acao_guiada",
      sessionIntent: "guided_action"
    };
  }

  function buildConstructionRecordAnswer_(record) {
    const lines = [];
    if (record.service) {
      lines.push("Produção identificada:", "- Serviço: " + record.service, "- Quantidade: " + record.quantity + (record.unit ? " " + record.unit : ""));
    }
    if (record.materials.length) {
      if (lines.length) {
        lines.push("");
      }
      lines.push("Material identificado:");
      record.materials.forEach(function (item) {
        lines.push("- " + item.quantity + (item.unit ? " " + item.unit + " de " : " ") + item.name);
      });
    }
    lines.push(
      "",
      "Posso usar isso para:",
      "1. registrar no RDO;",
      "2. lançar no controle de materiais;",
      "3. comparar depois com estoque e consumo previsto."
    );
    return {
      shortAnswer: "Entendi um registro de obra.",
      fullAnswer: lines.join("\n"),
      nextAction: "Abra o RDO ou diga se quer transformar isso em lançamento de materiais.",
      canSave: false,
      sessionTheme: "obra",
      sessionIntent: "construction_record"
    };
  }

  function buildCapabilitiesCardAnswer_() {
    return {
      shortAnswer: "Eu ajudo a lembrar, organizar e decidir melhor.",
      fullAnswer: "Posso ajudar a lembrar informacoes importantes, organizar projetos, consultar sua biblioteca, comparar ideias e responder com base na sua jornada.",
      nextAction: "Diga se quer ajuda com projeto, memoria, biblioteca, ObraReport ou uma decisao.",
      canSave: false,
      sessionTheme: "capacidades",
      sessionIntent: "capabilities"
    };

    const identity = buildEloIdentityContext();
    const intro = identity.currentMode === "standalone"
      ? "Eu posso ajudar em 5 áreas da sua jornada."
      : "Eu posso ajudar em 5 áreas, incluindo o ObraReport.";
    return {
      shortAnswer: intro,
      fullAnswer: [
        "1. Memória",
        "Projetos, objetivos, linha do tempo e informações importantes.",
        "",
        "2. Decisão",
        "Prioridades, próximos passos, bloqueios e planejamento.",
        "",
        "3. Organização",
        "Ideias, planos, foco da semana e continuidade da sua jornada.",
        "",
        "4. ObraReport",
        "Relatórios técnicos, RDO, fotos, materiais e PDF.",
        "",
        "5. Stock IA",
        "Entradas, saídas, consumo, estoque, alertas e lista de compras.",
        "",
        "Minha função é ligar essas partes e transformar dados soltos em orientação clara."
      ].join("\n"),
      nextAction: "Diga: quero criar um RDO, quero lançar material ou o que devo priorizar?",
      canSave: false,
      sessionTheme: "capacidades",
      sessionIntent: "capabilities"
    };
  }

  function buildRdoHelpAnswer_() {
    return {
      shortAnswer: "O RDO é o registro diário da obra.",
      fullAnswer: [
        "Nele você registra:",
        "- condições do tempo;",
        "- equipe;",
        "- serviços executados;",
        "- ocorrências;",
        "- fotos;",
        "- materiais consumidos;",
        "- observações.",
        "",
        "O mais importante é começar pelo que foi executado hoje.",
        "Exemplo: 12 m² de alvenaria."
      ].join("\n"),
      nextAction: "Abra Diário de Obras e registre o serviço executado de hoje.",
      canSave: false,
      sessionTheme: "rdo",
      sessionIntent: "ajuda_rdo"
    };
  }

  function buildMaterialsHelpAnswer_() {
    return {
      shortAnswer: "Para registrar materiais, pense em produção e consumo.",
      fullAnswer: [
        "1. O que foi executado.",
        "Exemplo: 12 m² de alvenaria.",
        "",
        "2. O que foi consumido.",
        "Exemplo: 30 blocos cerâmicos, 1 saco de cimento e areia.",
        "",
        "Com isso, o sistema pode comparar produção, consumo real, consumo previsto e estoque disponível."
      ].join("\n"),
      nextAction: "No RDO, registre primeiro a produção executada e depois os materiais consumidos.",
      canSave: false,
      sessionTheme: "materiais",
      sessionIntent: "ajuda_materiais"
    };
  }

  function buildStockHelpAnswer_() {
    return {
      shortAnswer: "O Stock IA é o controle inteligente de materiais.",
      fullAnswer: [
        "Ele ajuda com:",
        "- entrada por nota;",
        "- saldo de estoque;",
        "- baixa de consumo;",
        "- materiais acabando;",
        "- comparação entre o que entrou, o que saiu e o que foi executado na obra.",
        "",
        "Nesta versão, tudo funciona localmente e usa os dados do RDO e do cadastro de estoque."
      ].join("\n"),
      nextAction: "Abra Stock IA para ver saldo, alertas, lista de compras e entrada por nota.",
      canSave: false,
      sessionTheme: "stock_ia",
      sessionIntent: "ajuda_stock"
    };
  }

  function buildPdfHelpAnswer_() {
    return {
      shortAnswer: "O PDF é o documento final para apresentar ao cliente.",
      fullAnswer: [
        "Antes de gerar, confira:",
        "- dados da obra;",
        "- fotos;",
        "- descrições;",
        "- ocorrências;",
        "- conclusão;",
        "- responsável técnico.",
        "",
        "Depois use o botão de gerar PDF."
      ].join("\n"),
      nextAction: "Abra o relatório ou RDO, revise os campos principais e clique em Gerar PDF.",
      canSave: false,
      sessionTheme: "pdf",
      sessionIntent: "ajuda_pdf"
    };
  }

  function buildReportHelpAnswer_() {
    return {
      shortAnswer: "Um bom relatório técnico precisa ser claro, objetivo e ter evidências.",
      fullAnswer: [
        "Estrutura recomendada:",
        "1. Identificação da obra.",
        "2. Descrição do problema ou vistoria.",
        "3. Fotos.",
        "4. Análise técnica.",
        "5. Recomendações.",
        "6. Conclusão."
      ].join("\n"),
      nextAction: "Abra Relatórios, selecione cliente e obra, e comece pela descrição da vistoria.",
      canSave: false,
      sessionTheme: "relatorio",
      sessionIntent: "ajuda_relatorio"
    };
  }

  function buildTimelineOperationalAnswer_() {
    const timeline = getTimelineStorage();
    const events = (timeline.events || []).slice().sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    }).slice(0, 3);
    return {
      shortAnswer: "A Linha do Tempo guarda acontecimentos importantes da sua jornada.",
      fullAnswer: events.length
        ? [
          "Ela serve para registrar marcos, ideias, conquistas, dificuldades, objetivos e cartas para o futuro.",
          "",
          "Registros recentes:",
          events.map(formatTimelineEventLine).join("\n")
        ].join("\n")
        : "Ela serve para registrar marcos, ideias, conquistas, dificuldades, objetivos e cartas para o futuro.\n\nAinda não há eventos registrados na sua Linha do Tempo.",
      nextAction: "Abra Ferramentas do Elo > Linha do tempo para adicionar ou exportar registros.",
      canSave: false,
      sessionTheme: "timeline",
      sessionIntent: "ajuda_timeline"
    };
  }

  function isEloOperationalConstructionQuestion_(message) {
    const text = normalizeText(message);
    if (!text) {
      return false;
    }
    const serviceTerms = [
      "alvenaria", "parede", "piso", "reboco", "emboço", "emboco",
      "concreto", "pilar", "viga", "laje"
    ];
    const intentTerms = [
      "posso executar", "da para executar", "dá para executar",
      "tenho material", "tem saldo", "consigo fazer", "posso fazer",
      "executar amanha", "executar amanhã", "fazer parede", "precisa comprar",
      "material suficiente", "saldo suficiente"
    ];
    const hasService = hasAnyTerm(text, serviceTerms);
    const hasIntent = hasAnyTerm(text, intentTerms);
    const hasQuantity = /\d+(?:[,.]\d+)?\s*(m2|m²|m3|m³|metro|metros|saco|sacos|un|und|unidade|unidades)/i.test(message);
    return hasService && (hasIntent || hasQuantity);
  }

  function parseEloOperationalNumber_(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    const raw = String(value || "").trim();
    const normalized = raw.indexOf(",") >= 0
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    const number = Number.parseFloat(normalized);
    return Number.isFinite(number) ? number : 0;
  }

  function roundEloOperationalQuantity_(value) {
    return Math.round(parseEloOperationalNumber_(value) * 1000) / 1000;
  }

  function normalizeEloOperationalUnit_(unit) {
    const normalized = normalizeText(unit || "un");
    if (normalized === "m2" || normalized.indexOf("metro quadrado") >= 0) {
      return "m²";
    }
    if (normalized === "m3" || normalized.indexOf("metro cubico") >= 0 || normalized.indexOf("metro cúbico") >= 0) {
      return "m³";
    }
    if (normalized === "und" || normalized.indexOf("unidade") >= 0) {
      return "un";
    }
    if (normalized.indexOf("saco") >= 0) {
      return "saco";
    }
    return unit || "un";
  }

  function formatEloOperationalQuantity_(value) {
    const rounded = roundEloOperationalQuantity_(value);
    return String(rounded).replace(".", ",");
  }

  function formatEloOperationalDisplayUnit_(unit) {
    return normalizeEloOperationalUnit_(unit || "un");
  }

  function getEloOperationalPredictionSource_(prediction) {
    const composition = prediction && prediction.composition ? prediction.composition : null;
    if (composition && composition.isRealComposition) {
      return "SINAPI real/importada";
    }
    if (composition && (composition.source || composition.sourceRegion || composition.sourceDate)) {
      const source = normalizeText(composition.source || "");
      if (source.indexOf("sinapi") >= 0 || source.indexOf("orse") >= 0 || source.indexOf("real") >= 0) {
        return "SINAPI real/importada";
      }
    }
    return "Base técnica demonstrativa/editável";
  }

  function buildEloOperationalScaleAlerts_(prediction) {
    const service = prediction && prediction.service ? prediction.service : {};
    const quantity = parseEloOperationalNumber_(service.quantity || service.executedQuantity);
    const unit = normalizeEloOperationalUnit_(service.unit || "un");
    if (quantity <= 0 || normalizeText(unit) !== normalizeText("m²")) {
      return [];
    }
    const serviceText = normalizeText(service.service || service.serviceName || service.serviceType || "");
    const limits = [];
    if (hasAnyTerm(serviceText, ["alvenaria", "parede"])) {
      limits.push({ terms: ["areia"], unit: "m³", maxPerUnit: 0.25 });
      limits.push({ terms: ["cimento"], unit: "saco", maxPerUnit: 1 });
      limits.push({ terms: ["bloco", "tijolo"], unit: "un", maxPerUnit: 40 });
    } else if (hasAnyTerm(serviceText, ["reboco", "emboço", "emboco"])) {
      limits.push({ terms: ["areia"], unit: "m³", maxPerUnit: 0.12 });
      limits.push({ terms: ["cimento"], unit: "saco", maxPerUnit: 0.6 });
    } else if (hasAnyTerm(serviceText, ["piso"])) {
      limits.push({ terms: ["piso"], unit: "m²", maxPerUnit: 1.4 });
      limits.push({ terms: ["argamassa"], unit: "saco", maxPerUnit: 1 });
    }
    return (prediction.predictedItems || []).reduce(function (alerts, item) {
      const itemName = normalizeText(item.name || item.material || "");
      const itemUnit = normalizeEloOperationalUnit_(item.unit || "un");
      const quantityPerUnit = parseEloOperationalNumber_(item.quantity || item.predictedQuantity || 0) / quantity;
      const limit = limits.find(function (candidate) {
        return normalizeText(candidate.unit) === normalizeText(itemUnit) &&
          candidate.terms.some(function (term) {
            return itemName.indexOf(normalizeText(term)) >= 0;
          });
      });
      if (limit && quantityPerUnit > limit.maxPerUnit) {
        alerts.push("⚠️ Verificar quantitativo: consumo fora da faixa esperada para " + (item.name || item.material || "material") + ".");
      }
      return alerts;
    }, []);
  }

  function parseEloOperationalService_(message) {
    const text = normalizeText(message);
    const dimensionMatch = String(message || "").match(/(?:parede|muro|alvenaria)\s*(?:de\s*)?(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|×|\?|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?/i);
    const quantityMatch = String(message || "").match(/(\d+(?:[,.]\d+)?)\s*(m2|m²|m3|m³|metros?\s+quadrados?|metros?\s+cubicos?|metros?\s+cúbicos?|sacos?|un|und|unidades?)/i);
    const quantity = dimensionMatch
      ? parseEloOperationalNumber_(dimensionMatch[1]) * parseEloOperationalNumber_(dimensionMatch[2])
      : quantityMatch ? parseEloOperationalNumber_(quantityMatch[1]) : 0;
    const unit = dimensionMatch ? "m²" : quantityMatch ? normalizeEloOperationalUnit_(quantityMatch[2]) : "m²";
    const services = [
      { terms: ["alvenaria", "parede", "muro", "tijolo", "bloco"], service: "Alvenaria", serviceType: "alvenaria", unit: "m²" },
      { terms: ["piso"], service: "Piso ceramico", serviceType: "piso_ceramico", unit: "m²" },
      { terms: ["reboco", "emboço", "emboco"], service: "Reboco", serviceType: "reboco_emboco", unit: "m²" },
      { terms: ["concreto", "pilar", "viga", "laje"], service: "Concreto", serviceType: "concreto", unit: unit }
    ];
    const match = services.find(function (candidate) {
      return candidate.terms.some(function (term) {
        return text.indexOf(normalizeText(term)) >= 0;
      });
    });
    if (!match || quantity <= 0) {
      return null;
    }
    return {
      service: match.service,
      serviceName: match.service,
      serviceType: match.serviceType,
      controlledServiceId: match.serviceType,
      quantity: quantity,
      executedQuantity: quantity,
      unit: unit || match.unit
    };
  }


  function parseEloWallServiceBriefing_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    if (!hasAnyTerm(text, ["parede", "muro", "alvenaria"]) || !hasAnyTerm(text, ["bloco", "tijolo", "ceramico", "ceramico", "baiano"])) {
      return null;
    }

    const numbers = [];
    raw.replace(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\b/gi, function (_, value) {
      numbers.push(parseEloOperationalNumber_(value));
      return _;
    });
    let height = 0;
    let length = 0;
    let area = 0;

    const heightMatch = raw.match(/(?:altura|alto|h)\s*(?:de\s*)?(\d+(?:[,.]\d+)?)/i) ||
      raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:de\s*)?(?:altura|alto)\b/i);
    const lengthMatch = raw.match(/(?:comprimento|largura|linear|corridos?)\s*(?:de\s*)?(\d+(?:[,.]\d+)?)/i) ||
      raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:de\s*)?(?:comprimento|largura|linear|corridos?)\b/i);
    const simplePairMatch = raw.match(/(?:parede|muro|alvenaria)[^\d]{0,50}(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|×|\?|por)\s*(\d+(?:[,.]\d+)?)/i);
    if (heightMatch) {
      height = parseEloOperationalNumber_(heightMatch[1]);
    }
    if (lengthMatch) {
      length = parseEloOperationalNumber_(lengthMatch[1]);
    }
    if ((!height || !length) && simplePairMatch) {
      const firstPairValue = parseEloOperationalNumber_(simplePairMatch[1]);
      const secondPairValue = parseEloOperationalNumber_(simplePairMatch[2]);
      if (firstPairValue > 0 && secondPairValue > 0) {
        height = height || Math.min(firstPairValue, secondPairValue);
        length = length || Math.max(firstPairValue, secondPairValue);
      }
    }
    const allWallNumbers = [];
    raw.replace(/(\d+(?:[,.]\d+)?)/g, function (_, value) {
      const parsed = parseEloOperationalNumber_(value);
      if (parsed > 0) {
        allWallNumbers.push(parsed);
      }
      return _;
    });
    if (height > 0 && !length && allWallNumbers.length) {
      const lengthCandidate = allWallNumbers.filter(function (value) {
        return Math.abs(value - height) > 0.01;
      }).sort(function (a, b) { return b - a; })[0];
      length = lengthCandidate || 0;
    }
    if (length > 0 && !height && allWallNumbers.length) {
      const heightCandidate = allWallNumbers.filter(function (value) {
        return Math.abs(value - length) > 0.01;
      }).sort(function (a, b) { return a - b; })[0];
      height = heightCandidate || 0;
    }
    if ((!height || !length) && numbers.length >= 2) {
      const sorted = numbers.slice().sort(function (a, b) { return a - b; });
      height = height || sorted[0];
      length = length || sorted[sorted.length - 1];
    }
    if (height > 0 && length > 0) {
      area = height * length;
    } else {
      const areaMatch = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|metros?\s+quadrados?)/i);
      area = areaMatch ? parseEloOperationalNumber_(areaMatch[1]) : 0;
    }
    if (area <= 0) {
      return null;
    }

    return {
      length: length || 0,
      height: height || 0,
      area: area,
      coatingArea: area * 2,
      hasChapisco: hasAnyTerm(text, ["chapisco", "chapiscar"]),
      hasReboco: hasAnyTerm(text, ["reboco", "rebocar", "emboco", "emboco"]),
      wantsBudget: hasAnyTerm(text, ["orcamento", "orcamento", "orca", "orcar", "custo", "preco", "preco", "valor"]) || /orcament|or.amento|\borca\b|\bor.a\b|orcar|valor|custo|preco|pre.o/.test(text),
      wantsReferenceBudget: hasAnyTerm(text, ["referencia", "referencia", "padrao", "padrao", "estimativa", "preliminar"]),
      blockDimension: (raw.match(/\b((?:29|39)\s*x\s*19\s*x\s*14|14\s*x\s*19\s*x\s*(?:29|39))\b/i) || [])[1] || "14x19x39 cm",
      coatingSides: /um\s+lado|1\s+lado|uma\s+face/.test(text) ? "1 lado" : "2 lados",
      raw: raw
    };
  }

  function hasEloQuantitativeIntent_(text) {
    return /quantitativo|quantidade|quantos|quanto\s+vai|calcule|calcular|calcula|lista|materiais|material|orcamento|or.amento|custo|preco|pre.o|valor|comprar|consumo|tenho\s+material/.test(text);
  }

  function hasEloConcreteSubject_(text) {
    return /concreto|piso\s+de\s+concreto|laje|contrapiso|radier|viga|pilar|sapata|baldrame|fundacao|funda..o/.test(text);
  }

  function hasEloWallSubject_(text) {
    return /parede|muro|alvenaria|bloco|bloco\s+baiano|tijolo|chapisco|embo.o|emboco|reboco|revestimento/.test(text);
  }

  function hasEloConcreteFck_(text) {
    return /\bfck\s*\d{2}\b|\d{2}\s*mpa\b/.test(text);
  }

  function hasEloConcreteThickness_(text) {
    return /espessura|\b\d+(?:[,.]\d+)?\s*cm\b|\b\d+(?:[,.]\d+)?\s*(?:m|metros?)\s+de\s+espessura/.test(text);
  }

  function hasEloAreaOrDimensions_(text) {
    return /\d+(?:[,.]\d+)?\s*(?:m2|m\^2|m�|metros?\s+quadrados?|m3|m\^3|m³|metros?\s+cubicos?)\b/.test(text) || /\d+(?:[,.]\d+)?\s*(?:m|metros?)?\s*(?:x|×|\?|por)\s*\d+(?:[,.]\d+)?/.test(text);
  }

  function hasEloConcreteUse_(text) {
    return /passeio|cal.ada|residencial|garagem|carga\s+pesada|trafego|tr.fego|industrial|veiculo|ve.culo|pedestre/.test(text);
  }

  function extractEloBlockDimensionCm_(message) {
    const match = String(message || "").match(/\b(\d{1,2})\s*x\s*(\d{1,2})\s*x\s*(\d{1,2})\b/i);
    if (!match) {
      return null;
    }
    const dimensions = [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
    if (dimensions.some(function (value) { return !isFinite(value) || value <= 0; })) {
      return null;
    }
    return dimensions;
  }

  function hasEloBlockDimension_(text) {
    return !!extractEloBlockDimensionCm_(text);
  }

  function hasEloWallLengthHeight_(text) {
    return /\d+(?:[,.]\d+)?\s*(?:m|metros?)?\s*(?:x|×|\?|por)\s*\d+(?:[,.]\d+)?/.test(text) || (/comprimento|linear|corridos?/.test(text) && /altura|alto/.test(text));
  }
  function isEloNewCompleteWallBriefingMessage_(message) {
    const raw = sanitizeUserText(message || "");
    const text = normalizeText(raw);
    if (!/\b(?:parede|muro|alvenaria)\b/.test(text)) {
      return false;
    }
    const dimensions = extractEloWallDimensions_(raw);
    const hasWallGeometry = dimensions.length > 0 && dimensions.height > 0;
    if (!hasWallGeometry) {
      return false;
    }
    return hasEloBlockDimension_(raw) ||
      hasEloWallOpenings_(text) ||
      hasEloLossPremise_(text) ||
      hasEloWallCoatingSide_(text) ||
      /\b(?:nova|outra|tenho|quero|preciso|quantos|calcule|calcular)\b/.test(text);
  }
  function hasEloNoWallOpenings_(text) {
    return /parede\s+integra|parede\s+inteira|sem\s+vaos?|sem\s+v\.o|sem\s+aberturas?|sem\s+portas?[\s,]+(?:e\s+)?sem\s+janelas?|sem\s+janelas?[\s,]+(?:e\s+)?sem\s+portas?/.test(text);
  }

  function hasEloWallOpenings_(text) {
    return hasEloNoWallOpenings_(text) || extractEloWallOpenings_(text).items.length > 0;
  }

  function hasEloWallCoatingSide_(text) {
    return /um\s+lado|1\s+lado|dois\s+lados|2\s+lados|ambos\s+os\s+lados|duas\s+faces|uma\s+face|face\s+interna|face\s+externa|sem\s+revestimento|sem\s+reboco|sem\s+chapisco/.test(text);
  }

  function hasEloLossPremise_(text) {
    return /perda|perdas|desperdicio|desperd.cio|quebra|sobra|\d+(?:[,.]\d+)?\s*(?:%|por cento)/.test(text);
  }

  function isEloPreliminaryEstimateAuthorized_(message) {
    const text = normalizeText(message);
    return /autorizo|pode\s+fazer|pode\s+seguir|faca|faça|quero|aceito/.test(text) && /estimativa\s+preliminar|nao\s+oficial|não\s+oficial/.test(text);
  }

  function buildEloMissingTechnicalCompositionResponse_(premiseMessage) {
    const premiseText = normalizeText(premiseMessage || "");
    const lines = [
      "Para gerar quantitativo, mão de obra ou valor com segurança, preciso localizar uma composição técnica, como SINAPI ou ORSE. No momento não encontrei uma composição correspondente com os dados informados. Posso continuar de duas formas:",
      "1. você informa o código/composição SINAPI/ORSE;",
      "2. eu faço uma estimativa preliminar, claramente marcada como NÃO OFICIAL."
    ];
    if (premiseText) {
      lines.push("", formatEloTechnicalBaseLine_(null, false));
      lines.push.apply(lines, formatEloCollectedWallPremises_(premiseMessage));
    }
    return {
      shortAnswer: "Preciso de uma composição técnica para calcular com segurança.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe o código/composição SINAPI/ORSE ou autorize explicitamente uma estimativa preliminar NÃO OFICIAL.",
      canSave: false,
      sessionTheme: "base_tecnica_quantitativo",
      sessionIntent: "bloquear_sem_composicao_tecnica"
    };
  }

  function isEloValidatedTechnicalComposition_(composition) {
    if (!composition) {
      return false;
    }
    const metadata = composition.metadata || {};
    const source = normalizeText(composition.source || composition.sourceName || "");
    const inputs = (Array.isArray(composition.inputs) ? composition.inputs : (Array.isArray(composition.materials) ? composition.materials : []));
    const hasPositiveInputs = inputs.some(function (input) {
      const coefficient = parseEloOperationalNumber_(input && (
        input.coefficient !== undefined ? input.coefficient :
          input.quantityPerUnit !== undefined ? input.quantityPerUnit :
            input.coeficiente
      ));
      return coefficient > 0;
    });
    if ((composition.isMock || composition.mockOnly || metadata.isMock || metadata.mockOnly) && !metadata.validatedInternalComposition && !metadata.composicaoInternaValidada) {
      return false;
    }
    return composition.isRealComposition === true ||
      metadata.isRealComposition === true ||
      metadata.validatedInternalComposition === true ||
      metadata.composicaoInternaValidada === true ||
      ((source.indexOf("sinapi") >= 0 || source.indexOf("orse") >= 0) && hasPositiveInputs) ||
      source.indexOf("composicao interna validada") >= 0 ||
      source.indexOf("composição interna validada") >= 0;
  }

  function hasEloValidatedTechnicalBase_(prediction) {
    return !!(prediction && prediction.prediction && isEloValidatedTechnicalComposition_(prediction.prediction.composition));
  }

  function formatEloTechnicalBaseLine_(composition, allowPreliminary) {
    if (allowPreliminary) {
      return "Base técnica utilizada: Estimativa preliminar NÃO OFICIAL autorizada pelo usuário";
    }
    if (!composition) {
      return "Base técnica utilizada: composição técnica não localizada";
    }
    const source = composition.source || "composição interna validada";
    const code = composition.code || composition.id || "sem código";
    const date = composition.sourceDate ? " | referência " + composition.sourceDate : "";
    const region = composition.sourceRegion ? " | " + composition.sourceRegion : "";
    return "Base técnica utilizada: " + source + " | código " + code + date + region;
  }
  function formatEloCollectedWallPremises_(message) {
    const text = normalizeText(message || "");
    if (!hasEloWallSubject_(text)) {
      return [];
    }
    const original = sanitizeUserText(message || "");
    const dimensions = extractEloWallDimensions_(original);
    const grossArea = dimensions.length && dimensions.height ? dimensions.length * dimensions.height : null;
    const block = (original.match(/\b(?:bloco\s*)?(14\s*x\s*19\s*x\s*(?:29|39)|(?:29|39)\s*x\s*19\s*x\s*14)\b/i) || [])[1] || "informada pelo usuário";
    const loss = (original.match(/\b\d+(?:[,.]\d+)?\s*(?:%|por cento)/i) || [])[0] || "informada pelo usuário";
    const coating = /dois\s+lados|2\s+lados|ambos\s+os\s+lados|duas\s+faces/.test(text)
      ? "dois lados"
      : (/um\s+lado|1\s+lado|uma\s+face/.test(text) ? "um lado" : "informado pelo usuário");
    const openingsSummary = extractEloWallOpenings_(text);
    const openings = openingsSummary.hasNoOpenings ? "nenhum" : (openingsSummary.label || "não informado");
    const liquidArea = grossArea !== null && (openingsSummary.hasNoOpenings || openingsSummary.totalArea > 0)
      ? Math.max(0, grossArea - openingsSummary.totalArea)
      : null;
    return [
      "",
      "Premissas utilizadas:",
      "- Serviço considerado: parede/alvenaria de bloco cerâmico",
      "- Comprimento da parede: " + formatEloWallPremiseMeasure_(dimensions.length, "m"),
      "- Altura da parede: " + formatEloWallPremiseMeasure_(dimensions.height, "m"),
      "- Área bruta: " + formatEloWallPremiseMeasure_(grossArea, "m²"),
      "- Vãos descontados: " + openings,
      "- Área líquida considerada: " + formatEloWallPremiseMeasure_(liquidArea, "m²"),
      "- Bloco considerado: " + block.replace(/\s+/g, ""),
      "- Perda adotada: " + loss,
      "- Lados revestidos: " + coating
    ];
  }

  function extractEloWallDimensions_(message) {
    const source = sanitizeUserText(message || "");
    const lengthMatch = source.match(/\b(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s+de\s+comprimento\b/i);
    const heightMatch = source.match(/\b(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s+de\s+altura\b/i);
    let length = lengthMatch ? parseEloOperationalNumber_(lengthMatch[1]) : null;
    let height = heightMatch ? parseEloOperationalNumber_(heightMatch[1]) : null;
    if ((!length || !height)) {
      const geometrySource = stripEloBlockDimensionTriples_(source);
      const pairMatch = geometrySource.match(/\b(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|×|\?|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\b/i);
      if (pairMatch) {
        length = length || parseEloOperationalNumber_(pairMatch[1]);
        height = height || parseEloOperationalNumber_(pairMatch[2]);
      }
    }
    return { length: length || null, height: height || null };
  }

  function stripEloBlockDimensionTriples_(message) {
    return sanitizeUserText(message || "").replace(/\b(?:(?:bloco|tijolo|baiano|ceramico|cer.mico)\s*)?\d{1,2}\s*(?:x|×|\?|por)\s*\d{1,2}\s*(?:x|×|\?|por)\s*\d{1,2}\s*(?:cm|centimetros?)?\b/gi, " ");
  }

  function parseEloOpeningQuantity_(value) {
    const text = normalizeText(value || "");
    if (!text) {
      return 1;
    }
    if (/^um$|^uma$/.test(text)) {
      return 1;
    }
    if (/^dois$|^duas$/.test(text)) {
      return 2;
    }
    const parsed = parseInt(text, 10);
    return isFinite(parsed) && parsed > 0 ? parsed : 1;
  }
  function extractEloWallOpenings_(message) {
    const text = normalizeText(message || "");
    if (hasEloNoWallOpenings_(text)) {
      return { hasNoOpenings: true, items: [], totalArea: 0, label: "nenhum" };
    }
    const items = [];
    const pattern = /(?:\b(\d+|um|uma|dois|duas)\s*)?\b(portas?|janelas?)\s*(?:de|com|medindo)?\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|×|\?|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const quantity = parseEloOpeningQuantity_(match[1]);
      const type = /janela/.test(match[2]) ? "janela" : "porta";
      const width = parseEloOperationalNumber_(match[3]);
      const height = parseEloOperationalNumber_(match[4]);
      if (quantity > 0 && width > 0 && height > 0) {
        const area = quantity * width * height;
        items.push({ quantity: quantity, type: type, width: width, height: height, area: area });
      }
    }
    const totalArea = items.reduce(function (sum, item) { return sum + item.area; }, 0);
    const label = items.map(function (item) {
      const typeLabel = item.quantity === 1 ? item.type : item.type + "s";
      return item.quantity + " " + typeLabel + " " + formatEloWallPremiseNumber_(item.width) + " x " + formatEloWallPremiseNumber_(item.height) + " m = " + formatEloWallPremiseMeasure_(item.area, "m²");
    }).join("; ");
    return { hasNoOpenings: false, items: items, totalArea: totalArea, label: label };
  }

  function formatEloWallPremiseNumber_(value) {
    if (value === null || value === undefined || !isFinite(value)) {
      return "0,00";
    }
    return value.toFixed(2).replace(".", ",");
  }

  function formatEloWallPremiseMeasure_(value, unit) {
    if (value === null || value === undefined || !isFinite(value) || value <= 0) {
      return unit === "m²" ? "não calculada" : "não informado";
    }
    return formatEloWallPremiseNumber_(value) + " " + unit;
  }
  function createEloStockObrasCompositionBriefing_() {
    return {
      active: false,
      comprimento_m: null,
      altura_m: null,
      area_bruta_m2: null,
      servicos_solicitados: [],
      bloco_ceramico_dimensao_cm: null,
      perda_percentual: null,
      revestimento_lados: "",
      espessura_revestimento_cm: null,
      vaos: {
        portas: [],
        janelas: [],
        sem_vaos: false
      },
      area_vaos_m2: 0,
      area_liquida_m2: null,
      pending_question: "",
      updatedAt: Date.now()
    };
  }

  function cloneEloStockObrasCompositionBriefing_(briefing) {
    return JSON.parse(JSON.stringify(briefing || createEloStockObrasCompositionBriefing_()));
  }

  function resetEloStockObrasCompositionBriefing_() {
    ELO_SESSION_MEMORY.stockObrasCompositionBriefing = createEloStockObrasCompositionBriefing_();
    return ELO_SESSION_MEMORY.stockObrasCompositionBriefing;
  }

  function getEloStockObrasCompositionBriefing_() {
    if (!ELO_SESSION_MEMORY.stockObrasCompositionBriefing) {
      resetEloStockObrasCompositionBriefing_();
    }
    return ELO_SESSION_MEMORY.stockObrasCompositionBriefing;
  }

  function extractEloStockObrasGrossAreaM2_(message) {
    const match = String(message || "").match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|m²|metros?\s+quadrados?)/i);
    return match ? parseEloOperationalNumber_(match[1]) : null;
  }

  function extractEloStockObrasLossPercent_(message) {
    const match = String(message || "").match(/(?:perda(?:s)?\s*(?:de|adotada|considerada)?\s*)?(\d+(?:[,.]\d+)?)\s*(?:%|por cento)/i);
    return match ? parseEloOperationalNumber_(match[1]) : null;
  }

  function extractEloStockObrasCoatingSides_(message) {
    const text = normalizeText(message || "");
    if (/sem\s+revestimento|sem\s+reboco|sem\s+chapisco/.test(text)) {
      return "sem revestimento";
    }
    if (/dois\s+lados|2\s+lados|ambos\s+os\s+lados|duas\s+faces/.test(text)) {
      return "dois lados";
    }
    if (/um\s+lado|1\s+lado|uma\s+face|face\s+interna|face\s+externa/.test(text)) {
      return "um lado";
    }
    return "";
  }

  function extractEloStockObrasCoatingThicknessCm_(message) {
    const match = String(message || "").match(/(?:espessura|camada)[^\d]{0,20}(\d+(?:[,.]\d+)?)\s*(cm|mm|m)\b/i);
    if (!match) {
      return null;
    }
    const value = parseEloOperationalNumber_(match[1]);
    const unit = normalizeText(match[2]);
    if (unit === "mm") return value / 10;
    if (unit === "m") return value * 100;
    return value;
  }

  function extractEloStockObrasRequestedServices_(message) {
    const text = normalizeText(message || "");
    const services = [];
    if (/alvenaria|parede|muro|bloco|tijolo/.test(text)) {
      services.push("alvenaria com bloco ceramico");
    }
    if (/chapisco|chapiscar/.test(text)) {
      services.push("chapisco");
    }
    if (/reboco|rebocar|embo.o|emboco/.test(text)) {
      services.push("reboco");
    }
    if (/revestimento/.test(text) && services.indexOf("revestimento") < 0) {
      services.push("revestimento");
    }
    return services;
  }

  function mergeEloStockObrasServices_(current, next) {
    const merged = Array.isArray(current) ? current.slice() : [];
    (next || []).forEach(function (service) {
      if (merged.indexOf(service) < 0) {
        merged.push(service);
      }
    });
    return merged;
  }

  function mapEloStockObrasOpenings_(items, type) {
    return (items || []).filter(function (item) {
      return item.type === type;
    }).map(function (item) {
      return {
        quantidade: item.quantity,
        largura_m: item.width,
        altura_m: item.height,
        area_m2: item.area
      };
    });
  }

  function calculateEloStockObrasLiquidArea_(briefing) {
    const portas = briefing.vaos && Array.isArray(briefing.vaos.portas) ? briefing.vaos.portas : [];
    const janelas = briefing.vaos && Array.isArray(briefing.vaos.janelas) ? briefing.vaos.janelas : [];
    const openingsArea = portas.concat(janelas).reduce(function (sum, item) {
      return sum + (parseEloOperationalNumber_(item.area_m2) || 0);
    }, 0);
    if ((!briefing.area_bruta_m2 || briefing.area_bruta_m2 <= 0) && briefing.comprimento_m > 0 && briefing.altura_m > 0) {
      briefing.area_bruta_m2 = briefing.comprimento_m * briefing.altura_m;
    }
    briefing.area_vaos_m2 = openingsArea;
    briefing.area_liquida_m2 = briefing.area_bruta_m2 !== null && (briefing.vaos.sem_vaos || openingsArea > 0)
      ? Math.max(0, briefing.area_bruta_m2 - openingsArea)
      : null;
    return briefing;
  }

  function isEloStockObrasBriefingComplete_(briefing) {
    const hasOpeningsDecision = !!(briefing && briefing.vaos && (briefing.vaos.sem_vaos || briefing.vaos.portas.length || briefing.vaos.janelas.length));
    return !!(briefing && briefing.area_bruta_m2 > 0 && briefing.bloco_ceramico_dimensao_cm && hasOpeningsDecision && briefing.perda_percentual !== null && briefing.revestimento_lados);
  }

  function updateEloStockObrasCompositionBriefing_(currentMessage, combinedMessage, forceNew) {
    const briefing = forceNew ? resetEloStockObrasCompositionBriefing_() : getEloStockObrasCompositionBriefing_();
    const currentRaw = sanitizeUserText(currentMessage || "");
    const combinedRaw = sanitizeUserText(combinedMessage || currentRaw);
    briefing.active = true;

    const dimensions = extractEloWallDimensions_(combinedRaw);
    if (dimensions.length > 0) {
      briefing.comprimento_m = dimensions.length;
    }
    if (dimensions.height > 0) {
      briefing.altura_m = dimensions.height;
    }
    const area = extractEloStockObrasGrossAreaM2_(combinedRaw) || extractEloStockObrasGrossAreaM2_(currentRaw);
    if (area > 0) {
      briefing.area_bruta_m2 = area;
    } else if (briefing.comprimento_m > 0 && briefing.altura_m > 0) {
      briefing.area_bruta_m2 = briefing.comprimento_m * briefing.altura_m;
    }

    briefing.servicos_solicitados = mergeEloStockObrasServices_(briefing.servicos_solicitados, extractEloStockObrasRequestedServices_(combinedRaw));
    const lossPercent = extractEloStockObrasLossPercent_(combinedRaw) || extractEloStockObrasLossPercent_(currentRaw);
    if (lossPercent !== null && lossPercent >= 0) {
      briefing.perda_percentual = lossPercent;
    }
    const coatingSides = extractEloStockObrasCoatingSides_(combinedRaw) || extractEloStockObrasCoatingSides_(currentRaw);
    if (coatingSides) {
      briefing.revestimento_lados = coatingSides;
    }
    const coatingThickness = extractEloStockObrasCoatingThicknessCm_(combinedRaw) || extractEloStockObrasCoatingThicknessCm_(currentRaw);
    if (coatingThickness !== null && coatingThickness > 0) {
      briefing.espessura_revestimento_cm = coatingThickness;
    }

    const currentBlock = extractEloBlockDimensionCm_(currentRaw);
    const combinedBlock = extractEloBlockDimensionCm_(combinedRaw);
    if (currentBlock || combinedBlock) {
      briefing.bloco_ceramico_dimensao_cm = currentBlock || combinedBlock;
    }

    const combinedText = normalizeText(combinedRaw);
    const openings = extractEloWallOpenings_(combinedRaw);
    if (hasEloNoWallOpenings_(combinedText)) {
      briefing.vaos.sem_vaos = true;
      briefing.vaos.portas = [];
      briefing.vaos.janelas = [];
    } else if (openings.items.length) {
      briefing.vaos.sem_vaos = false;
      briefing.vaos.portas = mapEloStockObrasOpenings_(openings.items, "porta");
      briefing.vaos.janelas = mapEloStockObrasOpenings_(openings.items, "janela");
    }

    briefing.updatedAt = Date.now();
    calculateEloStockObrasLiquidArea_(briefing);
    return briefing;
  }

  function formatEloStockObrasBlockDimension_(briefing) {
    return (briefing.bloco_ceramico_dimensao_cm || []).join("x");
  }

  function formatEloStockObrasLoss_(briefing) {
    if (briefing.perda_percentual === null) {
      return "não informada";
    }
    const value = Number(briefing.perda_percentual);
    return (Number.isInteger(value) ? String(value) : formatEloWallPremiseNumber_(value)) + "%";
  }

  function formatEloStockObrasCoating_(briefing) {
    return briefing.revestimento_lados || "não informado";
  }

  function formatEloStockObrasThickness_(briefing) {
    return briefing.espessura_revestimento_cm !== null ? formatEloWallPremiseMeasure_(briefing.espessura_revestimento_cm, "cm") : "não informada";
  }

  function formatEloStockObrasOpenings_(briefing) {
    const portas = briefing.vaos.portas.map(function (item) {
      const label = item.quantidade === 1 ? "porta" : "portas";
      return item.quantidade + " " + label + " " + formatEloWallPremiseNumber_(item.largura_m) + " x " + formatEloWallPremiseNumber_(item.altura_m) + " m = " + formatEloWallPremiseMeasure_(item.area_m2, "m²");
    });
    const janelas = briefing.vaos.janelas.map(function (item) {
      const label = item.quantidade === 1 ? "janela" : "janelas";
      return item.quantidade + " " + label + " " + formatEloWallPremiseNumber_(item.largura_m) + " x " + formatEloWallPremiseNumber_(item.altura_m) + " m = " + formatEloWallPremiseMeasure_(item.area_m2, "m²");
    });
    return portas.concat(janelas).join("; ") || "nenhum";
  }

  function getEloStockObrasEngine_() {
    if (typeof window !== "undefined" && window.StockAiCompositionEngine) {
      return window.StockAiCompositionEngine;
    }
    if (typeof globalThis !== "undefined" && globalThis.StockAiCompositionEngine) {
      return globalThis.StockAiCompositionEngine;
    }
    return null;
  }

  function getEloCompositionInputs_(composition) {
    const rawInputs = composition && (composition.inputs || composition.materials);
    return Array.isArray(rawInputs) ? rawInputs : [];
  }

  function hasEloPositiveCompositionInputs_(composition) {
    return getEloCompositionInputs_(composition).some(function (input) {
      const coefficient = parseEloOperationalNumber_(input && (
        input.coefficient !== undefined ? input.coefficient :
          input.quantityPerUnit !== undefined ? input.quantityPerUnit :
            input.coeficiente
      ));
      return coefficient > 0;
    });
  }

  function isEloOfficialStockAiComposition_(composition) {
    return buildEloTechnicalCompositionContract_(composition).valid;
  }

  function getEloCompositionCode_(composition) {
    return composition && (composition.code || composition.id || composition.compositionCode) || "";
  }

  function getEloCompositionDescription_(composition) {
    return composition && (composition.description || composition.name || composition.service || composition.compositionName) || "";
  }

  function getEloCompositionUnit_(composition) {
    return composition && (composition.productionUnit || composition.unit || composition.compositionUnit) || "m2";
  }

  function getEloInputCoefficient_(input) {
    return parseEloOperationalNumber_(input && (
      input.coefficient !== undefined ? input.coefficient :
        input.quantityPerUnit !== undefined ? input.quantityPerUnit :
          input.coeficiente
    ));
  }

  function getEloInputUnitPrice_(input) {
    return parseEloOperationalNumber_(input && (
      input.unitPrice !== undefined ? input.unitPrice :
        input.precoUnitario !== undefined ? input.precoUnitario :
          input.preco_unitario !== undefined ? input.preco_unitario :
            input.price !== undefined ? input.price :
              input.cost !== undefined ? input.cost :
                input.custo_unitario
    ));
  }

  function buildEloTechnicalCompositionContract_(composition) {
    const metadata = composition && composition.metadata || {};
    const source = composition && (composition.source || composition.sourceName) || "";
    const sourceType = composition && (composition.sourceType || metadata.sourceType) || "";
    const normalizedSource = normalizeText(source);
    const normalizedSourceType = normalizeText(sourceType);
    const inputs = getEloCompositionInputs_(composition).map(function (input, index) {
      const coefficient = getEloInputCoefficient_(input);
      return {
        index: index,
        codigo: input && (input.code || input.codigo || input.id) || "insumo_" + (index + 1),
        nome: input && (input.name || input.material || input.descricao) || "Insumo sem nome",
        unidade: input && (input.unit || input.unidade) || "un",
        coeficiente: coefficient,
        precoUnitario: getEloInputUnitPrice_(input)
      };
    });
    const hasPositiveInputs = inputs.some(function (input) { return input.coeficiente > 0; });
    const isMock = !!(composition && (composition.isMock || composition.mockOnly || metadata.isMock || metadata.mockOnly));
    const isOfficial = !!(composition && (
      composition.isRealComposition === true ||
      composition.isOfficial === true ||
      metadata.isRealComposition === true ||
      metadata.isOfficial === true ||
      normalizedSourceType === "official_imported_file" ||
      normalizedSource === "sinapi" ||
      normalizedSource === "orse" ||
      normalizedSource.indexOf("sinapi") >= 0 ||
      normalizedSource.indexOf("orse") >= 0
    ));
    const isInternalValidated = !!(composition && (
      composition.isInternalValidated === true ||
      composition.internalValidated === true ||
      metadata.isInternalValidated === true ||
      metadata.internalValidated === true ||
      metadata.validatedInternal === true
    ));
    const isDemonstrative = isMock ||
      (!isOfficial && !isInternalValidated) ||
      normalizedSource.indexOf("demonstrativa") >= 0 ||
      normalizedSource.indexOf("editavel") >= 0 ||
      normalizedSource.indexOf("mock") >= 0;
    const reasons = [];
    if (!composition) reasons.push("Composicao ausente.");
    if (isMock) reasons.push("Composicao marcada como mock/teste.");
    if (isDemonstrative) reasons.push("Composicao demonstrativa/editavel nao pode ser base oficial.");
    if (!hasPositiveInputs) reasons.push("Composicao sem coeficientes/insumos positivos.");
    if (!isOfficial && !isInternalValidated) reasons.push("Fonte tecnica oficial ou interna validada nao confirmada.");
    return {
      valid: !!composition && !isMock && !isDemonstrative && hasPositiveInputs && (isOfficial || isInternalValidated),
      codigo: getEloCompositionCode_(composition) || "sem codigo",
      descricao: getEloCompositionDescription_(composition) || "sem descricao",
      unidade: getEloCompositionUnit_(composition),
      fonte: source || (isInternalValidated ? "composicao interna validada" : "nao informada"),
      uf: composition && (composition.sourceRegion || composition.state || metadata.state) || "",
      mes: composition && (composition.sourceDate || composition.referenceMonth || metadata.referenceMonth) || "",
      sourceType: sourceType,
      oficial: isOfficial,
      internaValidada: isInternalValidated,
      demonstrativa: isDemonstrative,
      insumos: inputs,
      reasons: reasons
    };
  }

  function buildEloStockObrasCompositionQueries_(briefing) {
    const block = formatEloStockObrasBlockDimension_(briefing);
    const hasBlock = block && block !== "não informada";
    return [
      "alvenaria de vedacao" + (hasBlock ? " bloco ceramico " + block : ""),
      "alvenaria bloco ceramico" + (hasBlock ? " " + block : ""),
      "parede bloco ceramico" + (hasBlock ? " " + block : ""),
      "alvenaria de vedacao bloco baiano",
      "alvenaria de vedacao"
    ].filter(function (query, index, list) {
      return query && list.indexOf(query) === index;
    });
  }

  function findEloStockObrasOfficialComposition_(briefing) {
    return findEloStockObrasOfficialCompositionCandidates_(briefing)[0] || null;
  }

  function getEloCompositionCandidateKey_(composition) {
    return [
      normalizeText(composition && (composition.source || "")),
      normalizeText(getEloCompositionCode_(composition)),
      normalizeText(getEloCompositionDescription_(composition)),
      normalizeText(getEloCompositionUnit_(composition))
    ].join("|");
  }



  function getEloCompositionEquivalentKey_(composition) {
    const code = normalizeText(getEloCompositionCode_(composition));
    const description = normalizeText(getEloCompositionDescription_(composition))
      .replace(/\b(argamassa|bloco|tinta|cimento|areia|insumo|oficial)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return [normalizeText(composition && (composition.source || "")), code || description, normalizeText(getEloCompositionUnit_(composition))].join("|");
  }

  function dedupeEloCompositionCandidates_(candidates) {
    const seen = {};
    return (candidates || []).filter(function (candidate) {
      const key = getEloCompositionEquivalentKey_(candidate);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }


  function getEloCompositionServiceType_(composition) {
    return normalizeText([
      composition && composition.serviceType,
      composition && composition.metadata && composition.metadata.serviceType,
      composition && composition.tipoServico,
      composition && composition.tipo_servico
    ].filter(Boolean).join(" "));
  }

  function isEloCompositionForService_(composition, serviceType) {
    const wanted = normalizeText(serviceType || "");
    const current = getEloCompositionServiceType_(composition);
    if (!wanted) return true;
    if (current) {
      if (wanted === "reboco_emboco") return current === "reboco_emboco" || current === "reboco" || current === "emboco";
      return current === wanted;
    }
    const description = normalizeText(getEloCompositionDescription_(composition));
    if (wanted === "alvenaria") return /alvenaria|bloco|tijolo/.test(description) && !/chapisco|reboco|emboco|pintura|tinta/.test(description);
    if (wanted === "chapisco") return /chapisco/.test(description);
    if (wanted === "reboco_emboco") return /reboco|emboco/.test(description);
    if (wanted === "pintura") return /pintura|tinta|selador/.test(description);
    if (wanted === "sapata") return /sapata/.test(description);
    if (wanted === "bloco_fundacao") return /bloco.*fundacao|bloco.*fundacao|fundacao/.test(description) && !/sapata/.test(description);
    if (wanted === "viga_baldrame") return /baldrame|viga.*fundacao|viga.*fundacao/.test(description);
    if (wanted === "pilar") return /pilar|coluna/.test(description);
    if (wanted === "viga_aerea") return /viga/.test(description) && !/baldrame|fundacao|fundacao/.test(description);
    return true;
  }
  function sortEloCompositionCandidatesByPreference_(candidates) {
    const preferredSource = getEloTechnicalSourcePreference_();
    const list = (candidates || []).slice();
    if (!preferredSource) {
      return list;
    }
    return list.sort(function (first, second) {
      const firstSource = String(first && first.source || "").toUpperCase();
      const secondSource = String(second && second.source || "").toUpperCase();
      const firstScore = firstSource === preferredSource ? 0 : 1;
      const secondScore = secondSource === preferredSource ? 0 : 1;
      return firstScore - secondScore;
    });
  }

  function findEloStockObrasOfficialCompositionCandidates_(briefing) {
    const engine = getEloStockObrasEngine_();
    if (!engine) {
      return [];
    }
    const candidates = [];
    buildEloStockObrasCompositionQueries_(briefing).forEach(function (query) {
      if (typeof engine.searchImportedOfficialCompositions === "function") {
        candidates.push.apply(candidates, (engine.searchImportedOfficialCompositions(query, { limit: 8, controlledService: "alvenaria" }) || []).filter(function (candidate) { return isEloCompositionForService_(candidate, "alvenaria"); }));
      }
      if (typeof engine.findComposition === "function") {
        const externalCandidate = engine.findComposition({ service: query, unit: "m2", serviceType: "alvenaria" });
        if (externalCandidate && isEloCompositionForService_(externalCandidate, "alvenaria")) candidates.push(externalCandidate);
      }
      if (typeof engine.findBestComposition === "function") {
        const bestCandidate = engine.findBestComposition({ service: query, unit: "m2", serviceType: "alvenaria" });
        if (bestCandidate && isEloCompositionForService_(bestCandidate, "alvenaria")) candidates.push(bestCandidate);
      }
    });
    const seen = {};
    const validCandidates = candidates.filter(function (candidate) {
      const contract = buildEloTechnicalCompositionContract_(candidate);
      if (!contract.valid) {
        return false;
      }
      const key = getEloCompositionCandidateKey_(candidate);
      if (seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
    return sortEloCompositionCandidatesByPreference_(dedupeEloCompositionCandidates_(validCandidates));
  }

  function buildEloStockObrasTechnicalBaseLabel_(composition) {
    const metadata = composition.metadata || {};
    const source = composition.source || "composição interna validada";
    const code = composition.code || composition.id || "sem código";
    const unit = composition.productionUnit || composition.unit || "m²";
    const reference = composition.sourceDate || metadata.referenceMonth || "";
    const region = composition.sourceRegion || metadata.state || "";
    return source + " | código " + code + " | unidade " + unit +
      (region ? " | " + region : "") +
      (reference ? " | referência " + reference : "");
  }

  function formatEloStockObrasCalculatedItems_(items, adoptedLossPercent) {
    return (items || []).slice(0, 12).map(function (item) {
      const name = item.name || item.material || "Insumo sem nome";
      const unit = item.unit || "un";
      const baseLoss = parseEloOperationalNumber_(item.baseLossPercent !== undefined ? item.baseLossPercent : item.perda_base);
      const liquid = parseEloOperationalNumber_(item.consumptionLiquid !== undefined ? item.consumptionLiquid : item.consumo_liquido);
      const originalFinal = parseEloOperationalNumber_(item.consumptionWithBaseLoss !== undefined ? item.consumptionWithBaseLoss : item.consumo_com_perda);
      const fallbackQuantity = parseEloOperationalNumber_(item.predictedQuantity !== undefined ? item.predictedQuantity : item.quantity);
      const safeLiquid = liquid > 0 ? liquid : (baseLoss > 0 ? fallbackQuantity / (1 + baseLoss / 100) : fallbackQuantity);
      const loss = adoptedLossPercent !== null && adoptedLossPercent !== undefined ? parseEloOperationalNumber_(adoptedLossPercent) : baseLoss;
      const finalQuantity = safeLiquid * (1 + Math.max(0, loss) / 100);
      return [
        "- " + name,
        "  - Consumo líquido: " + formatEloOperationalQuantity_(safeLiquid) + " " + formatEloOperationalDisplayUnit_(unit),
        "  - Perda base da composição: " + formatEloOperationalQuantity_(baseLoss || 0) + "%" + (originalFinal > 0 ? " | consumo com perda base: " + formatEloOperationalQuantity_(originalFinal) + " " + formatEloOperationalDisplayUnit_(unit) : ""),
        "  - Perda adotada: " + formatEloOperationalQuantity_(loss || 0) + "%",
        "  - Consumo final: " + formatEloOperationalQuantity_(finalQuantity) + " " + formatEloOperationalDisplayUnit_(unit)
      ].join("\n");
    });
  }

  function buildEloAssistedBudgetItems_(briefing, contract, composition) {
    const serviceQuantity = parseEloOperationalNumber_(briefing && briefing.area_liquida_m2);
    const baseLoss = parseEloOperationalNumber_(composition && (composition.lossPercent !== undefined ? composition.lossPercent : composition.perda_base));
    const adoptedLoss = briefing && briefing.perda_percentual !== null && briefing.perda_percentual !== undefined
      ? parseEloOperationalNumber_(briefing.perda_percentual)
      : baseLoss;
    let totalWithPrices = 0;
    let hasAnyPrice = false;
    let hasMissingPrice = false;
    const lines = (contract.insumos || []).filter(function (input) {
      return input.coeficiente > 0;
    }).map(function (input) {
      const liquid = serviceQuantity * input.coeficiente;
      const finalQuantity = liquid * (1 + Math.max(0, adoptedLoss) / 100);
      const hasPrice = input.precoUnitario > 0;
      const cost = hasPrice ? finalQuantity * input.precoUnitario : 0;
      if (hasPrice) {
        hasAnyPrice = true;
        totalWithPrices += cost;
      } else {
        hasMissingPrice = true;
      }
      const baseLossQuantity = liquid * (1 + Math.max(0, baseLoss) / 100);
      return [
        "- " + input.nome + " (" + input.codigo + ")",
        "  - Coeficiente: " + formatEloOperationalQuantity_(input.coeficiente) + " " + formatEloOperationalDisplayUnit_(input.unidade) + "/" + formatEloOperationalDisplayUnit_(contract.unidade),
        "  - Consumo líquido: " + formatEloOperationalQuantity_(liquid) + " " + formatEloOperationalDisplayUnit_(input.unidade),
        "  - Perda base da composição: " + formatEloOperationalQuantity_(baseLoss || 0) + "%" + (baseLoss > 0 ? " | consumo com perda base: " + formatEloOperationalQuantity_(baseLossQuantity) + " " + formatEloOperationalDisplayUnit_(input.unidade) : ""),
        "  - Perda adotada: " + formatEloOperationalQuantity_(adoptedLoss || 0) + "%",
        "  - Consumo final: " + formatEloOperationalQuantity_(finalQuantity) + " " + formatEloOperationalDisplayUnit_(input.unidade),
        hasPrice ? "  - Custo unitario: R$ " + formatEloOperationalQuantity_(input.precoUnitario) + " | custo do insumo: R$ " + formatEloOperationalQuantity_(cost) : "  - Custo unitario: nao informado; custo nao calculado."
      ].join("\n");
    });
    return {
      lines: lines,
      hasAnyPrice: hasAnyPrice,
      hasMissingPrice: hasMissingPrice,
      totalWithPrices: totalWithPrices,
      adoptedLoss: adoptedLoss || 0
    };
  }

  function buildEloStockObrasCompositionChoiceResponse_(briefing, candidates) {
    calculateEloStockObrasLiquidArea_(briefing);
    const project = getActiveEloWorkProject_();
    const lines = [
      "Resposta principal",
      "Encontrei mais de uma composicao tecnica compativel para a alvenaria. Antes de calcular consumo ou custo, preciso que voce confirme qual composicao deseja usar.",
      "",
      "Premissas utilizadas:",
      "Memoria permanente de obra:",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "Premissas do servico:",
      "- Area liquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²"),
      "- Bloco considerado: " + formatEloStockObrasBlockDimension_(briefing),
      "- Perda adotada: " + formatEloStockObrasLoss_(briefing),
      "",
      "Base tecnica utilizada: aguardando selecao da composicao",
      "",
      "Composicoes encontradas:"
    ];
    candidates.slice(0, 5).forEach(function (candidate, index) {
      const contract = buildEloTechnicalCompositionContract_(candidate);
      lines.push((index + 1) + ". " + contract.codigo + " | " + contract.descricao + " | unidade " + contract.unidade + " | " + contract.fonte + (contract.uf ? " " + contract.uf : "") + (contract.mes ? " " + contract.mes : ""));
    });
    lines.push("");
    lines.push.apply(lines, ["", buildEloBudgetMvpScopeNotice_(), ""]);
    lines.push("Proxima acao recomendada");
    lines.push("Informe o codigo da composicao escolhida para eu gerar o calculo auditavel.");
    return {
      shortAnswer: "Mais de uma composicao tecnica encontrada; preciso da sua escolha.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe o codigo da composicao escolhida.",
      canSave: false,
      sessionTheme: "stock_obras_composicao",
      sessionIntent: "briefing_composicao_escolha"
    };
  }


  function buildEloWallPackageServiceQueries_(serviceId, briefing) {
    const block = formatEloStockObrasBlockDimension_(briefing);
    const hasBlock = !!block;
    if (serviceId === "chapisco") return ["chapisco parede interna", "chapisco alvenaria", "chapisco parede", "chapisco"];
    if (serviceId === "reboco_emboco") return ["reboco parede interna", "revestimento argamassado parede", "emboco parede", "emboco parede", "reboco"];
    if (serviceId === "pintura") return ["pintura parede interna", "pintura acrilica parede", "pintura parede", "tinta acrilica parede", "pintura"];
    return buildEloStockObrasCompositionQueries_(briefing).concat(hasBlock ? ["argamassa assentamento bloco " + block] : ["argamassa assentamento bloco"]);
  }

  function findEloWallPackageOfficialCandidates_(serviceId, briefing) {
    const engine = getEloStockObrasEngine_();
    if (!engine) return [];
    const candidates = [];
    buildEloWallPackageServiceQueries_(serviceId, briefing).forEach(function (query) {
      if (typeof engine.searchImportedOfficialCompositions === "function") {
        const options = serviceId === "pintura" ? { limit: 8 } : { limit: 8, controlledService: serviceId };
        candidates.push.apply(candidates, (engine.searchImportedOfficialCompositions(query, options) || []).filter(function (candidate) { return isEloCompositionForService_(candidate, serviceId); }));
      }
    });
    const seen = {};
    return sortEloCompositionCandidatesByPreference_(candidates.filter(function (candidate) {
      const contract = buildEloTechnicalCompositionContract_(candidate);
      if (!contract.valid) return false;
      const haystack = normalizeText([contract.codigo, contract.descricao, contract.fonte, candidate && candidate.serviceType].join(" "));
      if (serviceId === "pintura" && !/pintura|tinta|selador|massa/.test(haystack)) return false;
      const key = getEloCompositionCandidateKey_(candidate);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }));
  }

  function getEloWallPackageServiceQuantity_(serviceId, briefing) {
    const area = parseEloOperationalNumber_(briefing && briefing.area_liquida_m2);
    return serviceId === "alvenaria" ? area : area * 2;
  }

  function buildEloWallPackageMultipleChoiceResponse_(briefing, serviceLabel, candidates) {
    calculateEloStockObrasLiquidArea_(briefing);
    const lines = ["PAREDE COMPLETA", "Encontrei mais de uma composicao tecnica oficial compativel para " + serviceLabel + ".", "", "Nao vou assumir automaticamente. Informe qual deseja utilizar:", ""];
    candidates.slice(0, 5).forEach(function (candidate, index) {
      const contract = buildEloTechnicalCompositionContract_(candidate);
      lines.push((index + 1) + ". " + contract.codigo + " | " + contract.descricao + " | unidade " + contract.unidade + " | " + contract.fonte + (contract.uf ? " " + contract.uf : "") + (contract.mes ? " " + contract.mes : ""));
    });
    lines.push("", buildEloBudgetMvpScopeNotice_());
    return { shortAnswer: "Mais de uma composicao encontrada para " + serviceLabel + ".", fullAnswer: lines.join("\n"), nextAction: "Informe o codigo da composicao escolhida para continuar o pacote Parede Completa.", canSave: false, sessionTheme: "wall_complete_package", sessionIntent: "wall_complete_package_composition_choice" };
  }

  function buildEloWallPackageServiceResult_(serviceId, label, briefing, composition, quantity, lossPercent) {
    const contract = buildEloTechnicalCompositionContract_(composition);
    if (!contract.valid) return null;
    const serviceBriefing = Object.assign({}, briefing, { area_liquida_m2: quantity, perda_percentual: lossPercent });
    const budgetItems = buildEloAssistedBudgetItems_(serviceBriefing, contract, composition);
    return { id: serviceId, label: label, quantity: quantity, contract: contract, budgetItems: budgetItems };
  }

  function buildEloWallCompletePackageResponse_(briefing, masonryComposition) {
    calculateEloStockObrasLiquidArea_(briefing);
    const services = [];
    const missing = [];
    const multiple = [];
    const serviceDefs = [
      { id: "alvenaria", label: "Alvenaria", quantity: getEloWallPackageServiceQuantity_("alvenaria", briefing), candidates: [masonryComposition], loss: briefing.perda_percentual },
      { id: "chapisco", label: "Chapisco", quantity: getEloWallPackageServiceQuantity_("chapisco", briefing), candidates: findEloWallPackageOfficialCandidates_("chapisco", briefing), loss: 0 },
      { id: "reboco_emboco", label: "Reboco", quantity: getEloWallPackageServiceQuantity_("reboco_emboco", briefing), candidates: findEloWallPackageOfficialCandidates_("reboco_emboco", briefing), loss: 0 },
      { id: "pintura", label: "Pintura", quantity: getEloWallPackageServiceQuantity_("pintura", briefing), candidates: findEloWallPackageOfficialCandidates_("pintura", briefing), loss: 0 }
    ];
    serviceDefs.forEach(function (service) {
      const candidates = sortEloCompositionCandidatesByPreference_(dedupeEloCompositionCandidates_(service.candidates || []));
      if (candidates.length > 1) { multiple.push({ label: service.label, candidates: candidates }); return; }
      if (!candidates.length) { missing.push("- Nao encontrei composicao oficial para " + service.label.toLowerCase() + " na base atualmente carregada."); return; }
      const result = buildEloWallPackageServiceResult_(service.id, service.label, briefing, candidates[0], service.quantity, service.loss);
      if (result) services.push(result); else missing.push("- A composicao encontrada para " + service.label.toLowerCase() + " nao passou no contrato tecnico oficial.");
    });
    if (multiple.length) return buildEloWallPackageMultipleChoiceResponse_(briefing, multiple[0].label, multiple[0].candidates);
    const openingSummary = formatEloStockObrasOpenings_(briefing);
    const project = getActiveEloWorkProject_();
    const coatingArea = parseEloOperationalNumber_(briefing.area_liquida_m2) * 2;
    const totalCost = services.reduce(function (sum, service) { return sum + (service.budgetItems.hasAnyPrice ? service.budgetItems.totalWithPrices : 0); }, 0);
    const hasAnyCost = services.some(function (service) { return service.budgetItems.hasAnyPrice; });
    const hasMissingCost = services.some(function (service) { return service.budgetItems.hasMissingPrice; });
    const lines = [
      "PAREDE COMPLETA",
      "Orcamento assistido de alvenaria e parede completa pronto para revisao tecnica.",
      "Bloco de revisao do orcamento assistido",
      "# Relatorio Tecnico de Orcamento - Alvenaria",
      (missing.length ? "Relatorio parcial auditavel. " : "") + "Pacote tecnico consolidado para revisao. Calculei a geometria e usei somente composicoes oficiais/importadas validadas onde elas existem.",
      "",
      "Premissas utilizadas:",
      "Premissas",
      "- Comprimento da parede: " + formatEloWallPremiseMeasure_(briefing.comprimento_m, "m"),
      "- Altura da parede: " + formatEloWallPremiseMeasure_(briefing.altura_m, "m"),
      "- Area bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m2"),
      "- Área bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m²"),
      "- Area de vaos: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m2"),
      "- Vaos descontados: " + openingSummary,
      "- Area liquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m2"),
      "- Área líquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²"),
      "- Area tecnica para chapisco/reboco/pintura: " + formatEloWallPremiseMeasure_(coatingArea, "m2") + " (duas faces do pacote parede completa; confirme se for apenas uma face).",
      "- Bloco considerado: " + formatEloStockObrasBlockDimension_(briefing),
      "- Perda da alvenaria: " + formatEloStockObrasLoss_(briefing),
      "",
      "Memoria permanente de obra",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "Memória de cálculo:",
      "- Area bruta " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m2") + " - vaos " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m2") + " = area liquida " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m2") + ".",
      "- Consumo calculado pelo Elo Orcamentista Assistido com base em composição oficial localizada.",
      "",
      "Base tecnica utilizada: " + (services[0] && services[0].contract && services[0].contract.fonte ? services[0].contract.fonte : "nao localizada"),
      "Base técnica utilizada: " + (services[0] && services[0].contract && services[0].contract.fonte ? services[0].contract.fonte : "nao localizada"),
      "",
      "Servicos considerados",
      "1. Alvenaria",
      "2. Argamassa de assentamento (como insumo da composicao oficial de alvenaria quando presente)",
      "3. Chapisco",
      "4. Reboco",
      "5. Pintura",
      "",
      "Composicoes utilizadas"
    ];
    services.forEach(function (service) { lines.push("- " + service.label + ": " + service.contract.fonte + " | " + service.contract.codigo + " | " + service.contract.descricao + " | unidade " + service.contract.unidade + " | " + (service.contract.uf || "UF nao informada") + " / " + (service.contract.mes || "mes nao informado")); });
    if (missing.length) { lines.push("", "Composicoes nao localizadas"); lines.push.apply(lines, missing); }
    lines.push("", "Quantitativos");
    services.forEach(function (service) {
      lines.push("- " + service.label + ": area de referencia " + formatEloWallPremiseMeasure_(service.quantity, "m2"));
      lines.push("  - Consumo calculado pelo motor Stock Obras: " + formatEloWallPremiseMeasure_(service.quantity, "m2") + " de referência.");
      lines.push("  - Consumo calculado pelo Elo Orcamentista Assistido.");
      if (service.budgetItems.lines.length) lines.push(service.budgetItems.lines.join("\n"));
    });
    lines.push("", "Custos encontrados");
    if (hasAnyCost) lines.push("- Custo parcial calculado com os precos existentes nas composicoes: R$ " + formatEloOperationalQuantity_(totalCost) + (hasMissingCost ? ". Existem insumos sem preco; nao trate como custo total oficial." : "."));
    else lines.push("- Precos unitarios nao informados nas composicoes carregadas; custo total nao calculado.");
    lines.push("", "Observacoes tecnicas", "- Nao usei composicao demonstrativa, mock ou coeficiente ficticio.", "- Argamassa de assentamento foi rastreada como insumo da alvenaria quando constou na composicao oficial.", "- Confirme se chapisco, reboco e pintura serao em uma ou duas faces antes de contratar.", "", "Aviso MVP", buildEloBudgetMvpScopeNotice_());
    return { shortAnswer: "Pacote Parede Completa consolidado para revisao tecnica.", fullAnswer: lines.join("\n"), nextAction: missing.length ? "Importe ou informe as composicoes oficiais faltantes para completar o pacote." : "Revise as composicoes, precos e faces consideradas antes de fechar o orcamento.", canSave: true, sessionTheme: "wall_complete_package", sessionIntent: "wall_complete_package" };
  }


  function normalizeEloStructuralDimension_(value, mode) {
    const number = parseEloOperationalNumber_(value);
    if (!isFinite(number) || number <= 0) return 0;
    if (mode === "section") return number > 5 ? number / 100 : number;
    return number;
  }

  function extractEloStructuralQuantity_(message, elementRegex) {
    const raw = String(message || "");
    const before = raw.match(new RegExp("(?:^|\\b)(\\d{1,3})\\s+(?:" + elementRegex + ")", "i"));
    if (before) return Math.max(1, parseInt(before[1], 10));
    const after = raw.match(new RegExp("(?:" + elementRegex + ")\\D{0,20}(\\d{1,3})\\s*(?:un|unidades|pecas|peças)", "i"));
    if (after) return Math.max(1, parseInt(after[1], 10));
    return 1;
  }

  function extractEloStructuralTriple_(message) {
    const raw = String(message || "");
    const match = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|cm)?\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|cm)?\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/i);
    return match ? [match[1], match[2], match[3]] : null;
  }

  function extractEloStructuralLengthAndSection_(message) {
    const raw = String(message || "");
    const match = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\D{0,30}(\d+(?:[,.]\d+)?)\s*(?:cm)?\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/i) ||
      raw.match(/(\d+(?:[,.]\d+)?)\s*(?:cm)?\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)\D{0,30}(\d+(?:[,.]\d+)?)\s*(?:m|metros?)/i);
    if (!match) return null;
    if (/\d+(?:[,.]\d+)?\s*(?:cm)?\s*(?:x|×|por)/i.test(match[0]) && /(?:m|metros?)\s*$/i.test(match[0])) {
      return { length: normalizeEloStructuralDimension_(match[3], "length"), width: normalizeEloStructuralDimension_(match[1], "section"), height: normalizeEloStructuralDimension_(match[2], "section") };
    }
    return { length: normalizeEloStructuralDimension_(match[1], "length"), width: normalizeEloStructuralDimension_(match[2], "section"), height: normalizeEloStructuralDimension_(match[3], "section") };
  }

  function parseEloStructuralPackageRequest_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    const structuralBlockPattern = /(?:^|\b)\d{1,3}\s+blocos?\s+\d+(?:[,.]\d+)?\s*(?:x|×|por)\s*\d+(?:[,.]\d+)?\s*(?:x|×|por)\s*\d+(?:[,.]\d+)?/;
    const wallBlockOnly = /parede|alvenaria|tijolo|baiano|ceramico|cer.mico/.test(text) || (/\bbloco\b/.test(text) && !/fundacao|funda..o|sapata|baldrame|pilar|\bviga\b/.test(text) && !structuralBlockPattern.test(text));
    if (wallBlockOnly) return null;
    let type = "";
    if (/sapata/.test(text)) type = "sapata";
    else if (/bloco.*fundacao|bloco.*funda..o|fundacao|funda..o/.test(text) && /bloco/.test(text)) type = "bloco_fundacao";
    else if (structuralBlockPattern.test(text)) type = "bloco_fundacao";
    else if (/baldrame/.test(text)) type = "viga_baldrame";
    else if (/pilar|coluna/.test(text)) type = "pilar";
    else if (/\bviga\b/.test(text)) type = "viga_aerea";
    if (!type) return null;

    if (type === "sapata" || type === "bloco_fundacao" || type === "pilar") {
      const triple = extractEloStructuralTriple_(raw);
      if (!triple) return { type: type, incomplete: true };
      const quantity = extractEloStructuralQuantity_(raw, type === "sapata" ? "sapatas?" : (type === "pilar" ? "pilares?|colunas?" : "blocos?"));
      const width = normalizeEloStructuralDimension_(triple[0], type === "pilar" ? "section" : "length");
      const length = normalizeEloStructuralDimension_(triple[1], type === "pilar" ? "section" : "length");
      const height = normalizeEloStructuralDimension_(triple[2], "length");
      if (!width || !length || !height) return { type: type, incomplete: true };
      const unitVolume = width * length * height;
      const totalVolume = unitVolume * quantity;
      return {
        type: type,
        quantity: quantity,
        width: width,
        length: length,
        height: height,
        unitVolume: unitVolume,
        totalVolume: totalVolume,
        excavationVolume: type === "sapata" ? totalVolume : 0,
        formArea: type === "pilar" ? 2 * (width + length) * height * quantity : 0
      };
    }

    const section = extractEloStructuralLengthAndSection_(raw);
    if (!section || !section.length || !section.width || !section.height) return { type: type, incomplete: true };
    const totalVolume = section.length * section.width * section.height;
    return {
      type: type,
      quantity: 1,
      width: section.width,
      length: section.length,
      height: section.height,
      unitVolume: totalVolume,
      totalVolume: totalVolume,
      excavationVolume: 0,
      formArea: 2 * section.length * section.height
    };
  }

  function getEloStructuralElementLabel_(type) {
    if (type === "sapata") return "Sapata isolada";
    if (type === "bloco_fundacao") return "Bloco de Fundacao";
    if (type === "viga_baldrame") return "Viga baldrame";
    if (type === "pilar") return "Pilar";
    if (type === "viga_aerea") return "Viga aerea";
    return "Elemento estrutural";
  }

  function buildEloStructuralCompositionQueries_(type) {
    if (type === "sapata") return ["sapata isolada concreto", "sapata fundacao", "concreto sapata"];
    if (type === "bloco_fundacao") return ["bloco de fundacao concreto", "bloco fundacao", "concreto bloco fundacao"];
    if (type === "viga_baldrame") return ["viga baldrame concreto", "baldrame concreto", "forma viga baldrame"];
    if (type === "pilar") return ["pilar concreto armado", "concreto pilar", "forma pilar"];
    if (type === "viga_aerea") return ["viga concreto armado", "concreto viga", "forma viga"];
    return ["estrutura concreto"];
  }

  function findEloStructuralOfficialCandidates_(type) {
    const engine = getEloStockObrasEngine_();
    if (!engine) return [];
    const candidates = [];
    buildEloStructuralCompositionQueries_(type).forEach(function (query) {
      if (typeof engine.searchImportedOfficialCompositions === "function") {
        candidates.push.apply(candidates, (engine.searchImportedOfficialCompositions(query, { limit: 8, controlledService: type }) || []).filter(function (candidate) { return isEloCompositionForService_(candidate, type); }));
      }
      if (typeof engine.findComposition === "function") {
        const externalCandidate = engine.findComposition({ service: query, unit: "m3", serviceType: type });
        if (externalCandidate && isEloCompositionForService_(externalCandidate, type)) candidates.push(externalCandidate);
      }
      if (typeof engine.findBestComposition === "function") {
        const bestCandidate = engine.findBestComposition({ service: query, unit: "m3", serviceType: type });
        if (bestCandidate && isEloCompositionForService_(bestCandidate, type)) candidates.push(bestCandidate);
      }
    });
    return sortEloCompositionCandidatesByPreference_(dedupeEloCompositionCandidates_(candidates.filter(function (candidate) {
      return buildEloTechnicalCompositionContract_(candidate).valid;
    })));
  }

  function buildEloStructuralMultipleChoiceResponse_(geometry, candidates) {
    const label = getEloStructuralElementLabel_(geometry.type);
    const lines = [
      "PACOTE ESTRUTURAL",
      "Encontrei mais de uma composicao tecnica oficial compativel para " + label + ".",
      "",
      "Nao vou assumir automaticamente. Informe qual deseja utilizar:",
      ""
    ];
    candidates.slice(0, 5).forEach(function (candidate, index) {
      const contract = buildEloTechnicalCompositionContract_(candidate);
      lines.push((index + 1) + ". " + contract.codigo + " | " + contract.descricao + " | unidade " + contract.unidade + " | " + contract.fonte + (contract.uf ? " " + contract.uf : "") + (contract.mes ? " " + contract.mes : ""));
    });
    lines.push("", "Observacoes tecnicas", "- Os quantitativos apresentados nao substituem projeto estrutural.", "- Dimensionamento e detalhamento devem ser realizados por profissional habilitado.");
    return { shortAnswer: "Mais de uma composicao estrutural encontrada.", fullAnswer: lines.join("\n"), nextAction: "Informe o codigo da composicao escolhida para continuar o pacote estrutural.", canSave: false, sessionTheme: "structural_package", sessionIntent: "structural_package_composition_choice" };
  }

  function buildEloStructuralPackageResponse_(geometry) {
    if (!geometry || geometry.incomplete) {
      return {
        shortAnswer: "Antes de calcular, preciso das dimensoes completas do elemento estrutural.",
        fullAnswer: [
          "PACOTE ESTRUTURAL",
          "Antes de calcular, preciso das dimensoes completas do elemento estrutural.",
          "",
          "Exemplos:",
          "- 8 sapatas 1,20 x 1,20 x 0,40",
          "- Baldrame 40 m 15 x 30",
          "- 12 pilares 20 x 20 x 3",
          "",
          "Observacoes tecnicas",
          "- Nao faço dimensionamento estrutural.",
          "- Armadura e detalhamento exigem projeto estrutural por profissional habilitado."
        ].join("\n"),
        nextAction: "Informe quantidade e dimensoes do elemento.",
        canSave: false,
        sessionTheme: "structural_package",
        sessionIntent: "structural_package_missing_dimensions"
      };
    }
    const candidates = findEloStructuralOfficialCandidates_(geometry.type);
    if (candidates.length > 1) return buildEloStructuralMultipleChoiceResponse_(geometry, candidates);
    const composition = candidates[0] || null;
    const contract = composition ? buildEloTechnicalCompositionContract_(composition) : null;
    const serviceBriefing = { area_liquida_m2: geometry.totalVolume, perda_percentual: 0 };
    const budgetItems = composition ? buildEloAssistedBudgetItems_(serviceBriefing, contract, composition) : { lines: [], hasAnyPrice: false, hasMissingPrice: false, totalWithPrices: 0 };
    const label = getEloStructuralElementLabel_(geometry.type);
    const lines = [
      "PACOTE ESTRUTURAL",
      "Relatorio estrutural quantitativo para revisao tecnica. Calculei apenas geometria simples e busquei composicoes oficiais/importadas validadas quando disponiveis.",
      "",
      "Elemento",
      label,
      "",
      "Premissas",
      "- Quantidade: " + formatEloOperationalQuantity_(geometry.quantity || 1),
      geometry.type === "viga_baldrame" || geometry.type === "viga_aerea" ? "- Comprimento: " + formatEloWallPremiseMeasure_(geometry.length, "m") : "- Largura: " + formatEloWallPremiseMeasure_(geometry.width, "m"),
      geometry.type === "viga_baldrame" || geometry.type === "viga_aerea" ? "- Secao: " + formatEloWallPremiseMeasure_(geometry.width, "m") + " x " + formatEloWallPremiseMeasure_(geometry.height, "m") : "- Comprimento/profundidade: " + formatEloWallPremiseMeasure_(geometry.length, "m"),
      geometry.type === "viga_baldrame" || geometry.type === "viga_aerea" ? "" : "- Altura: " + formatEloWallPremiseMeasure_(geometry.height, "m"),
      "",
      "Memoria de calculo",
      "- Volume unitario: " + formatEloOperationalQuantity_(geometry.unitVolume) + " m3",
      "- Volume total: " + formatEloOperationalQuantity_(geometry.totalVolume) + " m3",
      geometry.excavationVolume ? "- Escavacao estimada: " + formatEloOperationalQuantity_(geometry.excavationVolume) + " m3" : "",
      geometry.formArea ? "- Area de forma lateral: " + formatEloOperationalQuantity_(geometry.formArea) + " m2" : "",
      "",
      "Composicoes encontradas"
    ].filter(function (line) { return line !== ""; });
    if (contract && contract.valid) {
      lines.push("- Fonte: " + contract.fonte);
      lines.push("- Codigo: " + contract.codigo);
      lines.push("- Descricao: " + contract.descricao);
      lines.push("- Unidade: " + contract.unidade);
      lines.push("- UF/mes: " + (contract.uf || "nao informada") + " / " + (contract.mes || "nao informado"));
    } else {
      lines.push("- Nao encontrei composicao oficial para " + label.toLowerCase() + " na base atualmente carregada.");
    }
    lines.push("", "Quantitativos");
    lines.push("- Concreto/geometria: " + formatEloOperationalQuantity_(geometry.totalVolume) + " m3");
    if (geometry.formArea) lines.push("- Forma lateral estimada: " + formatEloOperationalQuantity_(geometry.formArea) + " m2");
    if (budgetItems.lines.length) lines.push(budgetItems.lines.join("\n"));
    lines.push("- Aco nao calculado automaticamente. Necessario projeto estrutural." );
    lines.push("", "Custos encontrados");
    if (budgetItems.hasAnyPrice) lines.push("- Custo parcial calculado com os precos existentes nas composicoes: R$ " + formatEloOperationalQuantity_(budgetItems.totalWithPrices) + (budgetItems.hasMissingPrice ? ". Existem insumos sem preco; nao trate como custo total oficial." : "."));
    else lines.push("- Precos oficiais nao informados ou composicao nao localizada; custo total nao calculado.");
    lines.push("", "Observacoes tecnicas", "- Os quantitativos apresentados nao substituem projeto estrutural.", "- Nao faço dimensionamento estrutural nem calculo armaduras normativas.", "- Dimensionamento e detalhamento devem ser realizados por profissional habilitado.");
    return { shortAnswer: "Pacote estrutural consolidado para revisao tecnica.", fullAnswer: lines.join("\n"), nextAction: contract && contract.valid ? "Revise geometria, composicao e premissas com o responsavel tecnico." : "Importe ou informe composicao SINAPI/ORSE oficial para completar custos e consumos.", canSave: true, sessionTheme: "structural_package", sessionIntent: "structural_package" };
  }



  function parseEloResidentialArea_(message) {
    const raw = String(message || "");
    const match = raw.match(/(?:casa|residencia|residência|obra)[^\n\r]{0,60}?(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|m²|metros?\s+quadrados?)/i) || raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|m²|metros?\s+quadrados?)/i);
    return match ? parseEloOperationalNumber_(match[1]) : 0;
  }

  function parseEloResidentialWallPackage_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    if (!/parede|paredes|alvenaria/.test(text)) return null;
    const wallMatch = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?paredes?[^\n\r]{0,50}?(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?altura/i) || raw.match(/paredes?[^\n\r]{0,50}?(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\D{0,30}(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?altura/i);
    const areaMatch = raw.match(/(?:area|área)\s+(?:bruta\s+)?(?:de\s+)?(?:parede|paredes|alvenaria)[^\n\r]{0,30}?(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|m²)/i);
    let length = 0;
    let height = 0;
    let grossArea = 0;
    if (wallMatch) {
      length = parseEloOperationalNumber_(wallMatch[1]);
      height = parseEloOperationalNumber_(wallMatch[2]);
      grossArea = length * height;
    } else if (areaMatch) {
      grossArea = parseEloOperationalNumber_(areaMatch[1]);
    }
    if (!grossArea) return null;
    const openingsMatch = raw.match(/(?:portas?\s+e\s+janelas?|vaos|vãos|aberturas?)[^\n\r]{0,40}?(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|m²)/i);
    const openingsArea = openingsMatch ? parseEloOperationalNumber_(openingsMatch[1]) : 0;
    const netArea = Math.max(0, grossArea - openingsArea);
    return {
      length: length,
      height: height,
      grossArea: grossArea,
      openingsArea: openingsArea,
      netArea: netArea,
      coatingArea: netArea * 2
    };
  }

  function collectEloResidentialStructureElements_(message) {
    const raw = String(message || "");
    const elements = [];
    function add(snippet) {
      const geometry = parseEloStructuralPackageRequest_(snippet);
      if (geometry && !geometry.incomplete) elements.push(geometry);
    }
    Array.from(raw.matchAll(/(\d{1,3})\s+pilares?\s+(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) {
      add(match[1] + " pilares " + match[2] + " x " + match[3] + " x " + match[4]);
    });
    Array.from(raw.matchAll(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?vigas?\s+(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) {
      add("viga " + match[1] + " m " + match[2] + " x " + match[3]);
    });
    return elements.filter(function (element, index, list) {
      const key = element.type + ":" + element.quantity + ":" + formatEloOperationalQuantity_(element.length) + ":" + formatEloOperationalQuantity_(element.width) + ":" + formatEloOperationalQuantity_(element.height);
      return list.findIndex(function (other) {
        return other.type + ":" + other.quantity + ":" + formatEloOperationalQuantity_(other.length) + ":" + formatEloOperationalQuantity_(other.width) + ":" + formatEloOperationalQuantity_(other.height) === key;
      }) === index;
    });
  }

  function parseEloResidentialBudgetPackageRequest_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    const hasResidentialIntent = /orcamento|orçamento|residencial|residencia|residência|casa|obra|preliminar|custa|custo/.test(text);
    if (!hasResidentialIntent) return null;
    const wall = parseEloResidentialWallPackage_(raw);
    const foundationAll = collectEloFoundationPackageElements_(raw);
    const foundationElements = foundationAll.filter(function (element) { return element.type === "sapata" || element.type === "bloco_fundacao" || element.type === "viga_baldrame"; });
    const structureElements = collectEloResidentialStructureElements_(raw).filter(function (element) { return element.type === "pilar" || element.type === "viga_aerea"; });
    const area = parseEloResidentialArea_(raw);
    if (!wall && !foundationElements.length && !structureElements.length) return null;
    if (!/orcamento|orçamento|preliminar|custa|custo|residencial|casa|obra/.test(text) && (wall ? 1 : 0) + (foundationElements.length ? 1 : 0) + (structureElements.length ? 1 : 0) < 2) return null;
    return { type: "residential_budget_package", area: area, wall: wall, foundationElements: foundationElements, structureElements: structureElements };
  }

  function findEloResidentialWallComposition_(serviceId, wall) {
    if (!wall) return { candidates: [] };
    const briefing = {
      area_liquida_m2: wall.netArea,
      area_bruta_m2: wall.grossArea,
      area_vaos_m2: wall.openingsArea,
      perda_percentual: 0,
      revestimento_lados: "dois lados",
      bloco_ceramico_dimensao_cm: null,
      vaos: { sem_vaos: wall.openingsArea <= 0, portas: [], janelas: [] }
    };
    return { briefing: briefing, candidates: findEloWallPackageOfficialCandidates_(serviceId, briefing) };
  }

  function addEloResidentialCompositionResult_(bucket, label, quantity, composition) {
    const contract = buildEloTechnicalCompositionContract_(composition);
    if (!contract.valid) return;
    const budgetItems = buildEloAssistedBudgetItems_({ area_liquida_m2: quantity, perda_percentual: 0 }, contract, composition);
    bucket.used.push({ label: label, quantity: quantity, contract: contract, budgetItems: budgetItems });
    if (budgetItems.hasAnyPrice) {
      bucket.hasAnyCost = true;
      bucket.totalCost += budgetItems.totalWithPrices || 0;
      bucket.hasMissingCost = bucket.hasMissingCost || !!budgetItems.hasMissingPrice;
    }
  }

  function buildEloResidentialMultipleChoiceResponse_(conflicts) {
    const lines = ["# ORÇAMENTO RESIDENCIAL PRELIMINAR", "", "Encontrei mais de uma composicao oficial compativel para um ou mais serviços.", "", "Nao vou assumir automaticamente. Informe qual deseja utilizar:", ""];
    conflicts.forEach(function (conflict) {
      lines.push(conflict.label + ":");
      conflict.candidates.slice(0, 5).forEach(function (candidate, index) {
        const contract = buildEloTechnicalCompositionContract_(candidate);
        lines.push((index + 1) + ". " + contract.codigo + " | " + contract.descricao + " | unidade " + contract.unidade + " | " + contract.fonte + (contract.uf ? " " + contract.uf : "") + (contract.mes ? " " + contract.mes : ""));
      });
      lines.push("");
    });
    lines.push("## Avisos profissionais", "Este orçamento é preliminar e assistido. Não substitui projeto, memorial descritivo, levantamento executivo ou responsabilidade técnica profissional.");
    return { shortAnswer: "Mais de uma composicao encontrada para o orçamento residencial.", fullAnswer: lines.join("\n"), nextAction: "Informe os códigos das composições escolhidas para consolidar o orçamento preliminar.", canSave: false, sessionTheme: "residential_budget_package", sessionIntent: "residential_budget_composition_choice" };
  }

  function buildEloResidentialBudgetPackageResponse_(residential) {
    if (!residential) return null;
    const foundationConcrete = residential.foundationElements.reduce(function (sum, element) { return sum + (element.totalVolume || 0); }, 0);
    const foundationExcavation = residential.foundationElements.reduce(function (sum, element) { return sum + getEloFoundationExcavationVolume_(element); }, 0);
    const foundationForm = residential.foundationElements.reduce(function (sum, element) { return sum + (element.formArea || 0); }, 0);
    const structureConcrete = residential.structureElements.reduce(function (sum, element) { return sum + (element.totalVolume || 0); }, 0);
    const structureForm = residential.structureElements.reduce(function (sum, element) { return sum + (element.formArea || 0); }, 0);
    const bucket = { used: [], missing: [], conflicts: [], totalCost: 0, hasAnyCost: false, hasMissingCost: false };
    if (residential.wall) {
      [
        { id: "alvenaria", label: "Alvenaria", quantity: residential.wall.netArea },
        { id: "chapisco", label: "Chapisco", quantity: residential.wall.coatingArea },
        { id: "reboco_emboco", label: "Reboco", quantity: residential.wall.coatingArea },
        { id: "pintura", label: "Pintura", quantity: residential.wall.coatingArea }
      ].forEach(function (service) {
        const found = findEloResidentialWallComposition_(service.id, residential.wall).candidates;
        if (found.length > 1) bucket.conflicts.push({ label: service.label, candidates: found });
        else if (found.length === 1) addEloResidentialCompositionResult_(bucket, service.label, service.quantity, found[0]);
        else bucket.missing.push(service.label);
      });
    }
    const allStructural = residential.foundationElements.concat(residential.structureElements);
    allStructural.forEach(function (element) {
      const candidates = findEloStructuralOfficialCandidates_(element.type);
      const label = getEloStructuralElementLabel_(element.type);
      if (candidates.length > 1) bucket.conflicts.push({ label: label, candidates: candidates });
      else if (candidates.length === 1) addEloResidentialCompositionResult_(bucket, label, element.totalVolume || 0, candidates[0]);
      else bucket.missing.push(label);
    });
    if (bucket.conflicts.length) return buildEloResidentialMultipleChoiceResponse_(bucket.conflicts);
    const totalConcrete = foundationConcrete + structureConcrete;
    const totalForm = foundationForm + structureForm;
    const lines = [
      "# ORÇAMENTO RESIDENCIAL PRELIMINAR",
      "",
      "## 1. Resumo executivo",
      "- Área informada: " + (residential.area ? formatEloWallPremiseMeasure_(residential.area, "m²") : "não informada"),
      "- Parede completa: " + (residential.wall ? "considerada" : "não informada"),
      "- Fundação completa: " + (residential.foundationElements.length ? "considerada" : "não informada"),
      "- Estrutura simples: " + (residential.structureElements.length ? "considerada" : "não informada"),
      "- Concreto total geral: " + formatEloOperationalQuantity_(totalConcrete) + " m3",
      "- Forma total geral: " + formatEloOperationalQuantity_(totalForm) + " m2",
      "- Escavação total geral: " + formatEloOperationalQuantity_(foundationExcavation) + " m3",
      "- Área de alvenaria: " + (residential.wall ? formatEloWallPremiseMeasure_(residential.wall.netArea, "m²") : "não informada"),
      "- Área de revestimento/pintura: " + (residential.wall ? formatEloWallPremiseMeasure_(residential.wall.coatingArea, "m²") : "não informada"),
      "",
      "## 2. Premissas informadas"
    ];
    if (residential.wall) {
      lines.push("- Paredes: área bruta " + formatEloWallPremiseMeasure_(residential.wall.grossArea, "m²") + "; vãos " + formatEloWallPremiseMeasure_(residential.wall.openingsArea, "m²") + "; área líquida " + formatEloWallPremiseMeasure_(residential.wall.netArea, "m²") + ".");
    } else lines.push("- Paredes: não informadas.");
    residential.foundationElements.forEach(function (element) { lines.push("- Fundação: " + getEloFoundationElementSummary_(element)); });
    residential.structureElements.forEach(function (element) { lines.push("- Estrutura: " + getEloFoundationElementSummary_(element)); });
    lines.push("", "## 3. Parede completa");
    if (residential.wall) {
      lines.push("- Área bruta de parede: " + formatEloWallPremiseMeasure_(residential.wall.grossArea, "m²"));
      lines.push("- Área de vãos: " + formatEloWallPremiseMeasure_(residential.wall.openingsArea, "m²"));
      lines.push("- Área líquida: " + formatEloWallPremiseMeasure_(residential.wall.netArea, "m²"));
      lines.push("- Área técnica para chapisco/reboco/pintura: " + formatEloWallPremiseMeasure_(residential.wall.coatingArea, "m²") + " (duas faces)." );
    } else lines.push("- Não informada nesta solicitação.");
    lines.push("", "## 4. Fundação completa");
    if (residential.foundationElements.length) {
      residential.foundationElements.forEach(function (element) { lines.push("- " + getEloFoundationElementSummary_(element)); });
      lines.push("- Concreto da fundação: " + formatEloOperationalQuantity_(foundationConcrete) + " m3");
      lines.push("- Escavação geométrica: " + formatEloOperationalQuantity_(foundationExcavation) + " m3");
      lines.push("- Forma da fundação: " + formatEloOperationalQuantity_(foundationForm) + " m2");
    } else lines.push("- Não informada nesta solicitação.");
    lines.push("", "## 5. Estrutura simples");
    if (residential.structureElements.length) {
      residential.structureElements.forEach(function (element) { lines.push("- " + getEloFoundationElementSummary_(element)); });
      lines.push("- Volume de pilares/vigas: " + formatEloOperationalQuantity_(structureConcrete) + " m3");
      lines.push("- Forma lateral: " + formatEloOperationalQuantity_(structureForm) + " m2");
    } else lines.push("- Não informada nesta solicitação.");
    lines.push("", "## 6. Totais consolidados", "- Concreto total geral: " + formatEloOperationalQuantity_(totalConcrete) + " m3", "- Forma total geral: " + formatEloOperationalQuantity_(totalForm) + " m2", "- Escavação total geral: " + formatEloOperationalQuantity_(foundationExcavation) + " m3");
    lines.push("", "## 7. Composições oficiais utilizadas");
    if (bucket.used.length) bucket.used.forEach(function (item) { lines.push("- " + item.label + ": " + item.contract.fonte + " | " + item.contract.codigo + " | " + item.contract.descricao + " | unidade " + item.contract.unidade + " | " + (item.contract.uf || "UF não informada") + " / " + (item.contract.mes || "mês não informado")); });
    else lines.push("- Nenhuma composição oficial localizada para os serviços informados.");
    lines.push("", "## 8. Custos encontrados");
    if (bucket.hasAnyCost) lines.push("- Custo parcial encontrado: R$ " + formatEloOperationalQuantity_(bucket.totalCost) + (bucket.hasMissingCost ? ". Existem insumos sem preço; não trate como custo total definitivo." : "."));
    else lines.push("- Custo parcial não encontrado: nenhum preço oficial suficiente localizado; custo não calculado.");
    lines.push("", "## 9. Pendências técnicas");
    if (bucket.missing.length) bucket.missing.forEach(function (label) { lines.push("- " + label + ": composição oficial não localizada na base atualmente carregada."); });
    else lines.push("- Nenhuma pendência de composição para os serviços localizados na base atual.");
    lines.push("- Aço não calculado automaticamente. Necessário projeto estrutural.");
    lines.push("- Confirmar memorial descritivo, padrão de acabamento, perdas executivas, BDI, encargos e preços vigentes antes de contratação.");
    lines.push("", "## 10. Avisos profissionais", "Este orçamento é preliminar e assistido. Não substitui projeto, memorial descritivo, levantamento executivo ou responsabilidade técnica profissional.", "Não faço dimensionamento estrutural nem detalhamento de armaduras normativas.");
    return { shortAnswer: "Orçamento residencial preliminar consolidado para revisão técnica.", fullAnswer: lines.join("\n"), nextAction: bucket.missing.length ? "Importe ou informe as composições oficiais faltantes para completar o orçamento preliminar." : "Revise premissas, preços e responsabilidades técnicas antes de apresentar ao cliente.", canSave: true, sessionTheme: "residential_budget_package", sessionIntent: "residential_budget_package" };
  }

  function buildEloResidentialBudgetPackageQuickAnswer_(message) {
    const residential = parseEloResidentialBudgetPackageRequest_(message);
    if (!residential) return null;
    return buildEloResidentialBudgetPackageResponse_(residential);
  }
  function buildEloFoundationElementSnippet_(type, match) {
    if (!match) return "";
    if (type === "sapata") return match[1] + " sapatas " + match[2] + " x " + match[3] + " x " + match[4];
    if (type === "bloco_fundacao") return match[1] + " blocos " + match[2] + " x " + match[3] + " x " + match[4];
    if (type === "pilar") return match[1] + " pilares " + match[2] + " x " + match[3] + " x " + match[4];
    if (type === "viga_baldrame") return "baldrame " + match[1] + " m " + match[2] + " x " + match[3];
    if (type === "viga_aerea") return "viga " + match[1] + " m " + match[2] + " x " + match[3];
    return "";
  }

  function collectEloFoundationPackageElements_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    if (!/fundacao|funda..o|fundacoes|funda..es|casa\s+terrea|casa\s+t.rrea|sapatas?|blocos?|baldrame|pilares?|\bviga\b/.test(text)) return [];
    if (/parede|alvenaria|tijolo|baiano|ceramico|cer.mico/.test(text)) return [];
    const elements = [];
    function addElement(type, snippet) {
      const geometry = parseEloStructuralPackageRequest_(snippet);
      if (geometry && !geometry.incomplete) elements.push(geometry);
    }
    Array.from(raw.matchAll(/(\d{1,3})\s+sapatas?\s+(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("sapata", buildEloFoundationElementSnippet_("sapata", match)); });
    Array.from(raw.matchAll(/(\d{1,3})\s+blocos?\s+(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("bloco_fundacao", buildEloFoundationElementSnippet_("bloco_fundacao", match)); });
    Array.from(raw.matchAll(/(\d{1,3})\s+pilares?\s+(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("pilar", buildEloFoundationElementSnippet_("pilar", match)); });
    Array.from(raw.matchAll(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?baldrame\s+(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("viga_baldrame", buildEloFoundationElementSnippet_("viga_baldrame", match)); });
    Array.from(raw.matchAll(/baldrame\s+(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s+(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("viga_baldrame", buildEloFoundationElementSnippet_("viga_baldrame", match)); });
    Array.from(raw.matchAll(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?viga\s+(\d+(?:[,.]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("viga_aerea", buildEloFoundationElementSnippet_("viga_aerea", match)); });
    return elements.filter(function (element, index, list) {
      const key = element.type + ":" + element.quantity + ":" + formatEloOperationalQuantity_(element.length) + ":" + formatEloOperationalQuantity_(element.width) + ":" + formatEloOperationalQuantity_(element.height);
      return list.findIndex(function (other) {
        return other.type + ":" + other.quantity + ":" + formatEloOperationalQuantity_(other.length) + ":" + formatEloOperationalQuantity_(other.width) + ":" + formatEloOperationalQuantity_(other.height) === key;
      }) === index;
    });
  }

  function parseEloFoundationPackageRequest_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    const elements = collectEloFoundationPackageElements_(raw);
    const explicitFoundation = /fundacao|funda..o|fundacoes|funda..es|casa\s+terrea|casa\s+t.rrea/.test(text);
    if (!elements.length) return null;
    if (!explicitFoundation && elements.length < 2) return null;
    return { type: "foundation_package", elements: elements };
  }

  function getEloFoundationElementSummary_(element) {
    const label = getEloStructuralElementLabel_(element.type);
    if (element.type === "viga_baldrame" || element.type === "viga_aerea") {
      return label + ": " + formatEloWallPremiseMeasure_(element.length, "m") + " | secao " + formatEloWallPremiseMeasure_(element.width, "m") + " x " + formatEloWallPremiseMeasure_(element.height, "m") + " | volume " + formatEloOperationalQuantity_(element.totalVolume) + " m3";
    }
    return label + ": " + formatEloOperationalQuantity_(element.quantity || 1) + " un | " + formatEloWallPremiseMeasure_(element.width, "m") + " x " + formatEloWallPremiseMeasure_(element.length, "m") + " x " + formatEloWallPremiseMeasure_(element.height, "m") + " | volume unitario " + formatEloOperationalQuantity_(element.unitVolume) + " m3 | volume total " + formatEloOperationalQuantity_(element.totalVolume) + " m3";
  }

  function getEloFoundationExcavationVolume_(element) {
    if (!element) return 0;
    if (element.type === "sapata" || element.type === "bloco_fundacao" || element.type === "viga_baldrame") return element.totalVolume || 0;
    return 0;
  }

  function buildEloFoundationMultipleChoiceResponse_(foundation, conflicts) {
    const lines = [
      "FUNDAÇÃO COMPLETA",
      "Encontrei mais de uma composicao tecnica oficial compativel para um ou mais elementos da fundacao.",
      "",
      "Nao vou assumir automaticamente. Informe qual deseja utilizar:",
      ""
    ];
    conflicts.forEach(function (conflict) {
      lines.push(getEloStructuralElementLabel_(conflict.type) + ":");
      conflict.candidates.slice(0, 5).forEach(function (candidate, index) {
        const contract = buildEloTechnicalCompositionContract_(candidate);
        lines.push((index + 1) + ". " + contract.codigo + " | " + contract.descricao + " | unidade " + contract.unidade + " | " + contract.fonte + (contract.uf ? " " + contract.uf : "") + (contract.mes ? " " + contract.mes : ""));
      });
      lines.push("");
    });
    lines.push("Observacoes tecnicas", "- Os volumes geometricos foram identificados, mas a composicao deve ser escolhida explicitamente.", "- Nao faço dimensionamento estrutural nem calculo armaduras normativas.");
    return { shortAnswer: "Mais de uma composicao encontrada para a fundacao.", fullAnswer: lines.join("\n"), nextAction: "Informe os codigos das composicoes escolhidas para consolidar a fundacao.", canSave: false, sessionTheme: "foundation_package", sessionIntent: "foundation_package_composition_choice" };
  }

  function buildEloFoundationPackageResponse_(foundation) {
    if (!foundation || !foundation.elements || !foundation.elements.length) return null;
    const totalConcrete = foundation.elements.reduce(function (sum, element) { return sum + (element.totalVolume || 0); }, 0);
    const totalExcavation = foundation.elements.reduce(function (sum, element) { return sum + getEloFoundationExcavationVolume_(element); }, 0);
    const totalForm = foundation.elements.reduce(function (sum, element) { return sum + (element.formArea || 0); }, 0);
    const groupedTypes = [];
    foundation.elements.forEach(function (element) { if (groupedTypes.indexOf(element.type) === -1) groupedTypes.push(element.type); });
    const compositionsByType = {};
    const conflicts = [];
    const missing = [];
    groupedTypes.forEach(function (type) {
      const candidates = findEloStructuralOfficialCandidates_(type);
      if (candidates.length > 1) conflicts.push({ type: type, candidates: candidates });
      else if (candidates.length === 1) compositionsByType[type] = candidates[0];
      else missing.push(type);
    });
    if (conflicts.length) return buildEloFoundationMultipleChoiceResponse_(foundation, conflicts);
    let totalCost = 0;
    let hasAnyCost = false;
    let hasMissingCost = false;
    const lines = [
      "FUNDAÇÃO COMPLETA",
      "Consolidei os elementos de fundacao informados usando geometria simples e busquei composicoes oficiais/importadas validadas quando disponiveis.",
      "",
      "Resumo executivo",
      "- Concreto total: " + formatEloOperationalQuantity_(totalConcrete) + " m3",
      "- Escavacao total: " + formatEloOperationalQuantity_(totalExcavation) + " m3",
      "- Forma total: " + formatEloOperationalQuantity_(totalForm) + " m2",
      "",
      "Elementos encontrados"
    ];
    foundation.elements.forEach(function (element) { lines.push("- " + getEloFoundationElementSummary_(element)); });
    lines.push("", "Volumes individuais");
    foundation.elements.forEach(function (element) { lines.push("- " + getEloStructuralElementLabel_(element.type) + ": " + formatEloOperationalQuantity_(element.totalVolume) + " m3"); });
    lines.push("", "Composicoes encontradas");
    groupedTypes.forEach(function (type) {
      const composition = compositionsByType[type];
      if (!composition) {
        lines.push("- " + getEloStructuralElementLabel_(type) + ": nao encontrei composicao oficial na base atualmente carregada.");
        return;
      }
      const contract = buildEloTechnicalCompositionContract_(composition);
      lines.push("- " + getEloStructuralElementLabel_(type) + ": " + contract.fonte + " | " + contract.codigo + " | " + contract.descricao + " | unidade " + contract.unidade + " | " + (contract.uf || "UF nao informada") + " / " + (contract.mes || "mes nao informado"));
    });
    lines.push("", "Custos encontrados");
    foundation.elements.forEach(function (element) {
      const composition = compositionsByType[element.type];
      if (!composition) return;
      const contract = buildEloTechnicalCompositionContract_(composition);
      const serviceBriefing = { area_liquida_m2: element.totalVolume, perda_percentual: 0 };
      const budgetItems = buildEloAssistedBudgetItems_(serviceBriefing, contract, composition);
      if (budgetItems.hasAnyPrice) {
        hasAnyCost = true;
        totalCost += budgetItems.totalWithPrices || 0;
        hasMissingCost = hasMissingCost || !!budgetItems.hasMissingPrice;
        lines.push("- " + getEloStructuralElementLabel_(element.type) + ": R$ " + formatEloOperationalQuantity_(budgetItems.totalWithPrices || 0) + (budgetItems.hasMissingPrice ? " (parcial; existem insumos sem preco)" : ""));
      }
    });
    if (hasAnyCost) lines.push("- Custo consolidado parcial: R$ " + formatEloOperationalQuantity_(totalCost) + (hasMissingCost ? ". Existem insumos sem preco; nao trate como custo total oficial." : "."));
    else lines.push("- Precos oficiais nao informados ou composicoes nao localizadas; custo total nao calculado.");
    if (missing.length) {
      lines.push("", "Composicoes nao localizadas");
      missing.forEach(function (type) { lines.push("- " + getEloStructuralElementLabel_(type) + ": importe ou informe composicao SINAPI/ORSE oficial para calcular consumos e custos."); });
    }
    lines.push("", "Observacoes tecnicas", "- Escavacao total e volume de concreto sao geometricos, conforme dimensoes fornecidas; nao incluem folgas executivas, perdas de escavacao ou regularizacao.", "- Forma total considera apenas area lateral indicada pelos elementos ja suportados pelo motor estrutural.", "- Aco nao calculado automaticamente. Necessario projeto estrutural.", "- Nao faço dimensionamento estrutural nem detalhamento de armaduras normativas.", "- Dimensionamento e detalhamento devem ser realizados por profissional habilitado.");
    return { shortAnswer: "Fundacao completa consolidada para revisao tecnica.", fullAnswer: lines.join("\n"), nextAction: missing.length ? "Importe ou informe as composicoes oficiais faltantes para completar custos e consumos." : "Revise geometria, composicoes e premissas com o responsavel tecnico antes de fechar o orcamento.", canSave: true, sessionTheme: "foundation_package", sessionIntent: "foundation_package" };
  }

  function buildEloFoundationPackageQuickAnswer_(message) {
    const foundation = parseEloFoundationPackageRequest_(message);
    if (!foundation) return null;
    return buildEloFoundationPackageResponse_(foundation);
  }
  function buildEloStructuralPackageQuickAnswer_(message) {
    const geometry = parseEloStructuralPackageRequest_(message);
    if (!geometry) return null;
    return buildEloStructuralPackageResponse_(geometry);
  }

  function buildEloStockObrasOfficialCompositionResponse_(briefing, composition) {
    calculateEloStockObrasLiquidArea_(briefing);
    const contract = buildEloTechnicalCompositionContract_(composition);
    if (!contract.valid) {
      return buildEloStockObrasCompositionResponse_(briefing, false);
    }
    const openingSummary = formatEloStockObrasOpenings_(briefing);
    const project = getActiveEloWorkProject_();
    const auditorAlerts = buildEloTechnicalAuditorAlerts_("parede alvenaria", { hasOfficialBase: true });
    const budgetItems = buildEloAssistedBudgetItems_(briefing, contract, composition);
    const costSummary = budgetItems.hasAnyPrice
      ? "- Custo parcial calculado com os insumos que possuem preco: R$ " + formatEloOperationalQuantity_(budgetItems.totalWithPrices) + (budgetItems.hasMissingPrice ? ". Existem insumos sem preco; nao trate como custo total oficial." : ".")
      : "- Precos unitarios nao informados na composicao importada; custo total nao calculado.";
    const lines = [
      "Resposta principal",
      "Orcamento assistido de alvenaria pronto para revisao tecnica. A composicao foi localizada e o consumo foi calculado de forma auditavel.",
      "",
      "Memória de cálculo:",
      "- Area bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m²"),
      "- Area total de vaos: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m²"),
      "- Area liquida: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²"),
      "- Formula de consumo: area liquida x coeficiente da composicao x (1 + perda adotada).",
      "",
      "Premissas utilizadas:",
      "Memoria permanente de obra:",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "Premissas do servico:",
      "- Comprimento da parede: " + formatEloWallPremiseMeasure_(briefing.comprimento_m, "m"),
      "- Altura da parede: " + formatEloWallPremiseMeasure_(briefing.altura_m, "m"),
      "- Area bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m²"),
      "- Vaos descontados: " + openingSummary,
      "- Area total de vaos: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m²"),
      "- Area liquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²"),
      "- Bloco considerado: " + formatEloStockObrasBlockDimension_(briefing),
      "- Perda adotada: " + formatEloStockObrasLoss_(briefing),
      "- Lados revestidos: " + formatEloStockObrasCoating_(briefing),
      briefing.espessura_revestimento_cm !== null ? "- Espessura do revestimento: " + formatEloStockObrasThickness_(briefing) : "",
      "",
      "Base tecnica utilizada: " + contract.fonte,
      "- Codigo: " + contract.codigo,
      "- Descricao: " + contract.descricao,
      "- Unidade: " + contract.unidade,
      "- Fonte: " + contract.fonte,
      "- UF/mes: " + (contract.uf || "nao informada") + " / " + (contract.mes || "nao informado"),
      "",
      "Consumo calculado pelo Elo Orcamentista Assistido:",
      budgetItems.lines.length ? budgetItems.lines.join("\n") : "- A composicao foi localizada, mas nao retornou insumos calculaveis.",
      "",
      "Resumo financeiro:",
      costSummary,
      "",
      buildEloBudgetMvpScopeNotice_(),
      "",
      "Alertas do auditor:",
      (auditorAlerts.length ? auditorAlerts.join("\n") : "- Sem alerta critico adicional com a composicao localizada. Confirme aderencia da composicao ao servico real antes de executar."),
      budgetItems.hasMissingPrice ? "- Existem insumos sem preco unitario; custo total oficial permanece pendente." : "",
      "",
      "Bloco de revisao do orcamento assistido",
      "- Servico: alvenaria",
      "- Composicao selecionada: " + contract.codigo + " - " + contract.descricao,
      "- Resultado parcial: consumo calculado; custo " + (budgetItems.hasAnyPrice && !budgetItems.hasMissingPrice ? "calculado com precos informados" : "pendente de precos unitarios completos"),
      "- Pendencias: " + (budgetItems.hasMissingPrice ? "informar precos unitarios ausentes antes de fechar custo oficial" : "validar aderencia da composicao ao servico executado"),
      "",
      "# Relatorio Tecnico de Orcamento - Alvenaria",
      "1. Identificacao: " + (project && project.nome ? project.nome : "obra atual"),
      "2. Escopo: alvenaria com bloco " + formatEloStockObrasBlockDimension_(briefing),
      "3. Premissas: area liquida " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²") + ", perda " + formatEloStockObrasLoss_(briefing) + ".",
      "4. Base tecnica: " + contract.fonte + " | " + contract.codigo + " | " + contract.unidade + ".",
      "5. Memoria de calculo: area liquida x coeficientes oficiais/importados.",
      "6. Consumos: detalhados acima por insumo.",
      "7. Custos: " + (budgetItems.hasAnyPrice ? "parciais conforme precos informados." : "nao calculados por falta de precos unitarios."),
      "8. Alertas: validar composicao, perdas, vaos e precos antes da contratacao.",
      "9. Proxima acao: deseja gerar o relatorio tecnico final em Markdown/HTML?"
    ].filter(Boolean);
    return {
      shortAnswer: "Orcamento assistido de alvenaria pronto para revisao tecnica.",
      fullAnswer: lines.join("\n"),
      nextAction: "Revise a composicao, complete precos unitarios se necessario e confirme se deseja gerar o relatorio tecnico final.",
      canSave: true,
      sessionTheme: "stock_obras_composicao",
      sessionIntent: "orcamentista_assistido_alvenaria"
    };
  }

  function buildEloStockObrasCompositionResponse_(briefing, alreadyConsidered) {
    calculateEloStockObrasLiquidArea_(briefing);
    const officialCandidates = findEloStockObrasOfficialCompositionCandidates_(briefing);
    if (officialCandidates.length > 1) {
      return buildEloWallPackageMultipleChoiceResponse_(briefing, "Alvenaria", officialCandidates);
    }
    if (officialCandidates.length === 1) {
      return buildEloWallCompletePackageResponse_(briefing, officialCandidates[0]);
    }
    const openingSummary = formatEloStockObrasOpenings_(briefing);
    const project = getActiveEloWorkProject_();
    const auditorAlerts = buildEloTechnicalAuditorAlerts_("parede alvenaria orçamento custo produtividade", { hasOfficialBase: false });
    const lines = [
      "Resposta principal",
      alreadyConsidered ? "A premissa informada já estava considerada no briefing acumulado." : "Briefing técnico consolidado, mas ainda preciso de uma composição SINAPI/ORSE ou interna validada para calcular consumo, mão de obra, produtividade ou custo com segurança.",
      "",
      "Memória de cálculo:",
      "- Área bruta " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m²") + " - vãos " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m²") + " = área líquida " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²") + ".",
      "- Consumo, produtividade, mão de obra e custo oficial ainda bloqueados por falta de base técnica válida.",
      "",
      "Premissas utilizadas:",
      "Memória permanente de obra:",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "Premissas do serviço:",
      "- Comprimento da parede: " + formatEloWallPremiseMeasure_(briefing.comprimento_m, "m"),
      "- Altura da parede: " + formatEloWallPremiseMeasure_(briefing.altura_m, "m"),
      "- Área bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m²"),
      "- Vãos descontados: " + openingSummary,
      "- Área total de vãos: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m²"),
      "- Área líquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²"),
      "- Bloco considerado: " + formatEloStockObrasBlockDimension_(briefing),
      "- Perda adotada: " + formatEloStockObrasLoss_(briefing),
      "- Lados revestidos: " + formatEloStockObrasCoating_(briefing),
      briefing.espessura_revestimento_cm !== null ? "- Espessura do revestimento: " + formatEloStockObrasThickness_(briefing) : "",
      "",
      "Base técnica utilizada: não localizada",
      "- Não vou gerar quantitativo oficial, consumo, mão de obra, produtividade ou valor sem SINAPI, ORSE ou composição interna validada.",
      "",
      "Alertas do auditor:",
      auditorAlerts.join("\n"),
      "",
      buildEloBudgetMvpScopeNotice_(),
      "",
      "Próxima ação recomendada",
      "Você pode informar o código/composição SINAPI/ORSE ou autorizar explicitamente uma estimativa preliminar NÃO OFICIAL."
    ].filter(Boolean);
    return {
      shortAnswer: "Briefing técnico consolidado; base técnica não localizada.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe o código/composição SINAPI/ORSE ou autorize explicitamente uma estimativa preliminar NÃO OFICIAL.",
      canSave: false,
      sessionTheme: "stock_obras_composicao",
      sessionIntent: "briefing_composicao_consolidado"
    };
  }


  function extractEloBlockDimensionFromComposition_(composition) {
    const text = String(getEloCompositionDescription_(composition) || "");
    const match = text.match(/(\d{1,2})\s*x\s*(\d{1,2})\s*x\s*(\d{1,2})/i);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
  }

  function buildEloWallCompletePackageQuickAnswer_(message) {
    const text = normalizeText(message || "");
    if (!/parede|alvenaria|bloco|tijolo/.test(text) || !hasEloWallLengthHeight_(text)) {
      return null;
    }
    const hasExplicitBlockDimension = !!extractEloBlockDimensionCm_(message);
    const asksOnlyBlocks = /quantos\s+blocos|blocos?.*(?:preciso|gasto|necessario|necessários|necessarios)/.test(text);
    const hasBudgetIntent = /orcamento|orçamento|orcar|custo|preco|preço|valor|quanto\s+custa/.test(text);
    if (asksOnlyBlocks || (!hasExplicitBlockDimension && /bloco|tijolo|baiano/.test(text)) || (hasBudgetIntent && !hasExplicitBlockDimension)) {
      return null;
    }
    const briefing = updateEloStockObrasCompositionBriefing_(message, message, true);
    if (!briefing.area_bruta_m2) {
      return null;
    }
    const candidates = findEloStockObrasOfficialCompositionCandidates_(briefing);
    if (candidates.length > 1) {
      return buildEloWallPackageMultipleChoiceResponse_(briefing, "Alvenaria", candidates);
    }
    if (!candidates.length) {
      return null;
    }
    if (!briefing.bloco_ceramico_dimensao_cm) {
      briefing.bloco_ceramico_dimensao_cm = extractEloBlockDimensionFromComposition_(candidates[0]);
    }
    if (!briefing.bloco_ceramico_dimensao_cm) {
      return null;
    }
    if (!briefing.vaos.sem_vaos && !briefing.vaos.portas.length && !briefing.vaos.janelas.length) {
      briefing.vaos.sem_vaos = true;
    }
    if (briefing.perda_percentual === null) {
      briefing.perda_percentual = 0;
    }
    if (!briefing.revestimento_lados) {
      briefing.revestimento_lados = "dois lados";
    }
    calculateEloStockObrasLiquidArea_(briefing);
    return buildEloWallCompletePackageResponse_(briefing, candidates[0]);
  }

  function buildEloStockObrasBriefingResponse_(currentMessage, combinedMessage, isPendingWall, shouldStart) {
    const currentText = normalizeText(currentMessage || "");
    const existing = ELO_SESSION_MEMORY.stockObrasCompositionBriefing;
    const hasActiveBriefing = !!(existing && existing.active);
    const currentHasOpeningWithoutMeasure = /\b(?:uma|um|1)\s+(?:porta|janela)\b/.test(currentText) && !extractEloWallOpenings_(currentMessage).items.length;
    if (hasActiveBriefing && isEloStockObrasBriefingComplete_(existing) && currentHasOpeningWithoutMeasure) {
      return buildEloStockObrasCompositionResponse_(calculateEloStockObrasLiquidArea_(existing), true);
    }
    if (!isPendingWall && !shouldStart && !hasActiveBriefing) {
      return null;
    }
    const relevantFollowUp = /porta|janela|vao|vãos|bloco|tijolo|perda|revestimento|sem\s+revestimento|chapisco|reboco|\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2}/.test(currentText);
    if (!isPendingWall && !shouldStart && hasActiveBriefing && !relevantFollowUp) {
      return null;
    }

    const briefing = updateEloStockObrasCompositionBriefing_(currentMessage, combinedMessage, !isPendingWall && shouldStart);
    const missing = [];
    let intent = "confirmar_premissas_parede";
    if (!briefing.area_bruta_m2) {
      missing.push("comprimento e altura, ou área bruta da parede");
      intent = "confirmar_medidas_parede";
    }
    if (!briefing.bloco_ceramico_dimensao_cm) {
      missing.push("dimensão real do bloco. Qual a dimensão do bloco? Ex.: 14x19x39, 14x19x29 ou outra medida real do bloco cerâmico");
      intent = "confirmar_bloco_parede";
    }
    if (!briefing.vaos.sem_vaos && !briefing.vaos.portas.length && !briefing.vaos.janelas.length) {
      missing.push("se existem vãos. A parede terá portas ou janelas? Se sim, informe quantidade e medidas. Ex.: 1 porta de 0,80 x 2,10 m; 2 janelas de 1,20 x 1,00 m. Ou confirme: parede íntegra, sem vãos");
      if (intent === "confirmar_premissas_parede") intent = "confirmar_vaos_parede";
    }
    if (briefing.perda_percentual === null) {
      missing.push("perda adotada em porcentagem, por exemplo 8% ou 10%");
      if (intent === "confirmar_premissas_parede") intent = "confirmar_perda_parede";
    }
    if (!briefing.revestimento_lados) {
      missing.push("se haverá revestimento em um lado, nos dois lados ou sem revestimento");
      if (intent === "confirmar_premissas_parede") intent = "confirmar_lados_revestimento";
    }
    if (missing.length) {
      calculateEloStockObrasLiquidArea_(briefing);
      briefing.pending_question = intent;
      const registeredLines = [
        "- Comprimento da parede: " + formatEloWallPremiseMeasure_(briefing.comprimento_m, "m"),
        "- Altura da parede: " + formatEloWallPremiseMeasure_(briefing.altura_m, "m"),
        "- Área bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m²")
      ];
      if (briefing.bloco_ceramico_dimensao_cm) {
        registeredLines.push("- Bloco considerado: " + formatEloStockObrasBlockDimension_(briefing));
      }
      if (briefing.vaos.sem_vaos || briefing.vaos.portas.length || briefing.vaos.janelas.length) {
        registeredLines.push("- Vãos descontados: " + formatEloStockObrasOpenings_(briefing));
        registeredLines.push("- Área total de vãos: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m²"));
        registeredLines.push("- Área líquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²"));
      }
      if (briefing.perda_percentual !== null) {
        registeredLines.push("- Perda adotada: " + formatEloStockObrasLoss_(briefing));
      }
      if (briefing.revestimento_lados) {
        registeredLines.push("- Lados revestidos: " + formatEloStockObrasCoating_(briefing));
      }
      const fullAnswer = [
        "Resposta principal",
        "Área geométrica da parede: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m²") + "." + ((briefing.vaos.sem_vaos || briefing.vaos.portas.length || briefing.vaos.janelas.length) ? " Área líquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m²") + "." : ""),
        "",
        "Premissas utilizadas:",
        registeredLines.join("\n"),
        "",
        "Base técnica utilizada",
        "- Geometria informada pelo usuário. SINAPI/ORSE ainda não foi consultada porque faltam premissas obrigatórias.",
        "",
        "Próxima ação",
        "Ainda preciso confirmar:",
        missing.map(function (item) { return "- " + item; }).join("\n"),
        "",
        "Depois vou verificar SINAPI/ORSE ou composição interna validada."
      ].filter(Boolean).join("\n");
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso completar o briefing técnico da parede.",
        fullAnswer,
        "Informe as premissas pendentes para eu consolidar antes de buscar SINAPI/ORSE.",
        intent
      ));
    }

    briefing.pending_question = "";
    clearEloPendingPremises_();
    return buildEloStockObrasCompositionResponse_(briefing, false);
  }
  function buildEloPremiseCollectionQuestion_(shortAnswer, fullAnswer, nextAction, intent) {
    const cleanShortAnswer = String(shortAnswer || "").trim();
    let cleanFullAnswer = String(fullAnswer || "").trim();
    if (cleanShortAnswer && cleanFullAnswer.indexOf(cleanShortAnswer + "\n") === 0) {
      cleanFullAnswer = cleanFullAnswer.slice(cleanShortAnswer.length).trim();
    }
    return {
      shortAnswer: cleanShortAnswer,
      fullAnswer: cleanFullAnswer,
      nextAction: nextAction,
      canSave: false,
      sessionTheme: "premissas_quantitativo",
      sessionIntent: intent
    };
  }

  function getEloPendingPremiseText_(message) {
    const pending = ELO_SESSION_MEMORY.pendingQuantitativePremises;
    const current = sanitizeUserText(message || "");
    if (!pending || !pending.raw) {
      return current;
    }
    const normalizedCurrent = normalizeText(current);
    if (pending.sessionIntent === "confirmar_vaos_parede" && /^(nao|não|nao ha|não há|sem)$/.test(normalizedCurrent)) {
      return pending.raw + " sem portas e sem janelas";
    }
    return pending.raw + " " + current;
  }

  function shouldStartEloWallPremiseCollection_(text) {
    if (/produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|homens?-hora|equipe|prazo/.test(text)) {
      return false;
    }
    const hasExplicitWallSubject = /bloco|bloco\s+baiano|tijolo|parede|muro/.test(text) && !/chapisco|embo.o|emboco|reboco/.test(text);
    const hasExecutableMasonry = /alvenaria/.test(text) && /fazer|executar|levantar|assentar|orcar|orce|calcule|calcular|quantos|bloco|tijolo|parede|muro/.test(text);
    const hasMasonrySubject = hasExplicitWallSubject || hasExecutableMasonry;
    return hasMasonrySubject && (/fazer|executar|levantar|assentar|orcar|orce|calcule|calcular|calcula|quantitativo|quantidade|quantos|orcamento|or.amento|custo|custa|preco|pre.o|valor|material|materiais|parede|muro|bloco|tijolo/.test(text));
  }

  function saveEloPendingPremises_(type, raw, response) {
    ELO_SESSION_MEMORY.pendingQuantitativePremises = {
      type: type,
      raw: sanitizeUserText(raw).slice(0, 800),
      sessionIntent: response.sessionIntent || "",
      updatedAt: Date.now()
    };
    return response;
  }

  function clearEloPendingPremises_() {
    ELO_SESSION_MEMORY.pendingQuantitativePremises = null;
  }

  function buildEloWallPremiseCollectionResponse_(message) {
    const pending = ELO_SESSION_MEMORY.pendingQuantitativePremises;
    const currentText = normalizeText(message);
    const isPendingWall = pending && pending.type === "wall";
    const isGenericBudgetOrProductivity = /quanto\s+custa|custo|orcamento|or.amento|produtividade|equipe|prazo|m.o\s+de\s+obra|mao\s+de\s+obra/.test(currentText) &&
      !/bloco|porta|janela|vao|vãos|perda|revestimento|sem\s+portas|sem\s+janelas|\d{1,2}\s*x\s*\d{1,2}|\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2}/.test(currentText);
    if (isPendingWall && isGenericBudgetOrProductivity) {
      clearEloPendingPremises_();
      return null;
    }
    const shouldStart = shouldStartEloWallPremiseCollection_(currentText);
    const activeStockObrasBriefing = ELO_SESSION_MEMORY.stockObrasCompositionBriefing && ELO_SESSION_MEMORY.stockObrasCompositionBriefing.active;
    const stockObrasFollowUp = activeStockObrasBriefing && /porta|janela|vao|vãos|bloco|tijolo|perda|revestimento|sem\s+revestimento|chapisco|reboco|\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2}/.test(currentText);
    if (!isPendingWall && !shouldStart && !stockObrasFollowUp) {
      return null;
    }

    const startsNewWallBriefing = isPendingWall && isEloNewCompleteWallBriefingMessage_(message);
    const effectivePendingWall = isPendingWall && !startsNewWallBriefing;
    const effectiveShouldStart = shouldStart || startsNewWallBriefing;
    const combinedMessage = startsNewWallBriefing ? sanitizeUserText(message || "") : getEloPendingPremiseText_(message);
    const text = normalizeText(combinedMessage);
    if (isEloPreliminaryEstimateAuthorized_(message) || isEloPreliminaryEstimateAuthorized_(combinedMessage)) {
      return null;
    }
    if (!hasEloWallSubject_(text) && effectivePendingWall) {
      return null;
    }
    const stockObrasBriefingResponse = buildEloStockObrasBriefingResponse_(message, combinedMessage, effectivePendingWall, effectiveShouldStart);
    if (stockObrasBriefingResponse) {
      return stockObrasBriefingResponse;
    }

    if (!hasEloWallLengthHeight_(text) && !/\d+(?:[,.]\d+)?\s*(?:m2|m\^2|m²|metros?\s+quadrados?)/.test(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso do comprimento e da altura.",
        "Informe comprimento e altura, ou a área em m². Ex.: parede com 20 m de comprimento e 2,80 m de altura.",
        "Informe comprimento x altura ou área da parede.",
        "confirmar_medidas_parede"
      ));
    }

    if (!hasEloBlockDimension_(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso confirmar a dimensão do bloco.",
        "Qual a dimensão do bloco? Ex.: 14x19x39, 14x19x29 ou outra medida real do bloco cerâmico.",
        "Informe a dimensão real do bloco para eu continuar a coleta de premissas.",
        "confirmar_bloco_parede"
      ));
    }

    if (!hasEloWallOpenings_(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso saber se existem vãos para descontar.",
        "Antes de calcular, preciso saber se existem vãos para descontar.\nA parede terá portas ou janelas?\nSe sim, informe quantidade e medidas. Ex.:\n- 1 porta de 0,80 x 2,10 m\n- 2 janelas de 1,20 x 1,00 m\nOu confirme: parede íntegra, sem vãos.",
        "Informe portas/janelas com medidas ou confirme: parede íntegra, sem vãos.",
        "confirmar_vaos_parede"
      ));
    }

    if (!hasEloLossPremise_(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso confirmar a perda adotada.",
        "Deseja considerar perdas? Informe a perda em porcentagem, por exemplo 8% ou 10%.",
        "Informe a perda técnica que devo considerar.",
        "confirmar_perda_parede"
      ));
    }

    if (!hasEloWallCoatingSide_(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso confirmar o revestimento.",
        "Haverá revestimento? Um lado ou dois lados?",
        "Informe se haverá revestimento e se será em um lado ou nos dois lados.",
        "confirmar_lados_revestimento"
      ));
    }

    clearEloPendingPremises_();
    return isPendingWall ? buildEloMissingTechnicalCompositionResponse_(combinedMessage) : null;
  }
  function buildEloPremiseQuestion_(message) {
    const collectionResponse = buildEloWallPremiseCollectionResponse_(message);
    if (collectionResponse) {
      return collectionResponse;
    }
    const text = normalizeText(message);
    if (!hasEloQuantitativeIntent_(text)) {
      return null;
    }
    if (hasEloConcreteSubject_(text)) {
      if (!hasEloConcreteFck_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso confirmar o FCK do concreto.",
          fullAnswer: "Antes de calcular, preciso confirmar o FCK do concreto. Qual ser� o FCK desejado? Ex.: 15, 20, 25 ou 30 MPa. Tamb�m confirme o uso: passeio, piso residencial, garagem ou �rea com carga pesada.",
          nextAction: "Informe FCK e uso do concreto para eu continuar sem chutar premissas.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_fck_concreto"
        };
      }
      if (/piso|laje|contrapiso|radier/.test(text) && !hasEloConcreteThickness_(text) && !/m3|m\^3|m³|metros?\s+cubicos?/.test(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso da espessura.",
          fullAnswer: "Antes de calcular, confirme a espessura do concreto. Ex.: 7 cm para passeio, 8 a 10 cm para piso residencial ou espessura definida em projeto.",
          nextAction: "Informe a espessura e mantenha o FCK confirmado.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_espessura_concreto"
        };
      }
      if (!hasEloAreaOrDimensions_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso da �rea, dimens�es ou volume.",
          fullAnswer: "Antes de calcular concreto, informe �rea + espessura, dimens�es ou volume em m�. Ex.: piso de concreto 20 m� com 8 cm, FCK 20 MPa, uso residencial.",
          nextAction: "Informe �rea/dimens�es ou volume para eu calcular.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_medidas_concreto"
        };
      }
      if (/piso|radier|contrapiso/.test(text) && !hasEloConcreteUse_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso confirmar o uso do concreto.",
          fullAnswer: "Antes de calcular, confirme o uso: passeio, piso residencial, garagem ou �rea com carga pesada. Isso muda a premissa t�cnica e o consumo recomendado.",
          nextAction: "Informe o tipo de uso do piso/radier.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_uso_concreto"
        };
      }
      return null;
    }
    if (hasEloWallSubject_(text)) {
      const masonryWallSubject = /bloco|tijolo|alvenaria|parede|muro/.test(text);
      if (masonryWallSubject && !hasEloBlockDimension_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso confirmar a dimens�o do bloco.",
          fullAnswer: "Antes de calcular, preciso confirmar a dimens�o real do bloco cer�mico. Ele � 29x19x14, 39x19x14 ou outra medida?",
          nextAction: "Informe a dimens�o do bloco para eu calcular com seguran�a.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_bloco_parede"
        };
      }
      if (masonryWallSubject && !hasEloWallLengthHeight_(text) && !/\d+(?:[,.]\d+)?\s*(?:m2|m\^2|m²|metros?\s+quadrados?)/.test(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso do comprimento e da altura.",
          fullAnswer: "Antes de calcular a parede, informe comprimento e altura, ou a �rea em m�. Ex.: parede 8 m x 3 m com bloco 39x19x14.",
          nextAction: "Informe comprimento x altura ou �rea da parede.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_medidas_parede"
        };
      }
      if (masonryWallSubject && !hasEloWallOpenings_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso saber se existem vãos para descontar.",
          fullAnswer: "Antes de calcular, preciso saber se existem vãos para descontar.\nA parede terá portas ou janelas?\nSe sim, informe quantidade e medidas. Ex.:\n- 1 porta de 0,80 x 2,10 m\n- 2 janelas de 1,20 x 1,00 m\nOu confirme: parede íntegra, sem vãos.",
          nextAction: "Informe portas/janelas com medidas ou confirme: parede íntegra, sem vãos.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_vaos_parede"
        };
      }
      if (/chapisco|embo.o|emboco|reboco|revestimento/.test(text) && !hasEloWallCoatingSide_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso confirmar os lados do revestimento.",
          fullAnswer: "Voc� deseja considerar revestimento em um lado ou nos dois lados da parede?",
          nextAction: "Informe um lado ou dois lados para eu calcular o revestimento.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_lados_revestimento"
        };
      }
      if (masonryWallSubject && !hasEloLossPremise_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso confirmar a perda adotada.",
          fullAnswer: "Qual perda t�cnica devo considerar? Se n�o houver crit�rio pr�prio, posso usar 8% para alvenaria simples ou 10% quando houver muitos recortes e perdas de transporte.",
          nextAction: "Informe a perda em porcentagem para eu concluir o quantitativo.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_perda_parede"
        };
      }
    }
    return null;
  }

  function extractEloFckLabel_(message) {
    const text = normalizeText(message);
    const match = text.match(/\bfck\s*(\d{2})\b/) || text.match(/\b(\d{2})\s*mpa\b/);
    return match ? match[1] + " MPa" : "não informado";
  }

  function formatEloQuantitativePremises_(message, extraLines) {
    const text = normalizeText(message);
    const lines = ["", "Premissas utilizadas:"];
    (extraLines || []).forEach(function (line) {
      if (line) {
        lines.push("- " + line);
      }
    });
    if (hasEloConcreteSubject_(text)) {
      lines.push("- FCK: " + extractEloFckLabel_(message));
    }
    return lines;
  }
  function roundEloWallQuantity_(value, decimals) {
    const factor = Math.pow(10, typeof decimals === "number" ? decimals : 2);
    return Math.round(parseEloOperationalNumber_(value) * factor) / factor;
  }

  function formatEloWallMoney_(value) {
    const number = roundEloWallQuantity_(value, 2);
    return "R$ " + String(number.toFixed(2)).replace(".", ",");
  }

  function buildEloWallEstimate_(briefing) {
    const area = briefing.area;
    const coatingArea = briefing.coatingArea;
    const blocks = Math.ceil(area * 12.5 * 1.08);
    const layingCement = Math.ceil(area * 0.095);
    const layingSand = roundEloWallQuantity_(area * 0.017, 2);
    const chapiscoCement = briefing.hasChapisco ? Math.ceil(coatingArea * 0.05) : 0;
    const chapiscoSand = briefing.hasChapisco ? roundEloWallQuantity_(coatingArea * 0.006, 2) : 0;
    const plasterCement = briefing.hasReboco ? Math.ceil(coatingArea * 0.115) : 0;
    const plasterSand = briefing.hasReboco ? roundEloWallQuantity_(coatingArea * 0.020, 2) : 0;
    const waterLiters = Math.ceil((layingCement + chapiscoCement + plasterCement) * 28);

    return {
      length: briefing.length,
      height: briefing.height,
      area: roundEloWallQuantity_(area, 2),
      coatingArea: roundEloWallQuantity_(coatingArea, 2),
      blocks: blocks,
      layingCement: layingCement,
      layingSand: layingSand,
      chapiscoCement: chapiscoCement,
      chapiscoSand: chapiscoSand,
      plasterCement: plasterCement,
      plasterSand: plasterSand,
      waterLiters: waterLiters,
      hasChapisco: briefing.hasChapisco,
      hasReboco: briefing.hasReboco,
      blockDimension: briefing.blockDimension || "14x19x39 cm",
      coatingSides: briefing.coatingSides || "2 lados",
      raw: briefing.raw || ""
    };
  }

  function buildEloWallBudget_(estimate) {
    const prices = [
      { label: "Bloco ceramico baiano 14x19x39", quantity: estimate.blocks, unit: "un", unitPrice: 1.45 },
      { label: "Cimento 50 kg - assentamento", quantity: estimate.layingCement, unit: "sc", unitPrice: 38 },
      { label: "Areia media - assentamento", quantity: estimate.layingSand, unit: "m3", unitPrice: 145 }
    ];
    if (estimate.hasChapisco) {
      prices.push({ label: "Cimento 50 kg - chapisco", quantity: estimate.chapiscoCement, unit: "sc", unitPrice: 38 });
      prices.push({ label: "Areia media - chapisco", quantity: estimate.chapiscoSand, unit: "m3", unitPrice: 145 });
    }
    if (estimate.hasReboco) {
      prices.push({ label: "Cimento 50 kg - reboco", quantity: estimate.plasterCement, unit: "sc", unitPrice: 38 });
      prices.push({ label: "Areia media - reboco", quantity: estimate.plasterSand, unit: "m3", unitPrice: 145 });
    }
    const subtotal = prices.reduce(function (sum, item) {
      return sum + item.quantity * item.unitPrice;
    }, 0);
    const lossPercent = estimate.budgetLossPercent || estimate.lossPercent || 8;
    const loss = subtotal * (lossPercent / 100);
    return { items: prices, subtotal: subtotal, loss: loss, lossPercent: lossPercent, total: subtotal + loss };
  }

  function buildEloWallLaborEstimate_(estimate) {
    const masonryLabor = estimate.area * 65;
    const coatingLabor = estimate.coatingArea * 38;
    return {
      masonryLabor: masonryLabor,
      coatingLabor: coatingLabor,
      totalLabor: masonryLabor + coatingLabor
    };
  }

  function rememberEloWallEstimate_(estimate) {
    ELO_SESSION_MEMORY.lastOperationalWallEstimate = estimate;
    window.__eloLastOperationalWallEstimate = estimate;
    return estimate;
  }

  function formatEloWallEstimateLines_(estimate) {
    const lines = [
      formatEloTechnicalBaseLine_(null, estimate.preliminaryAuthorized === true),
      "Area da parede: " + formatEloOperationalQuantity_(estimate.area) + " m2" + (estimate.length && estimate.height ? " (" + formatEloOperationalQuantity_(estimate.length) + " m x " + formatEloOperationalQuantity_(estimate.height) + " m)" : ""),
      "Area de revestimento nos 2 lados: " + formatEloOperationalQuantity_(estimate.coatingArea) + " m2",
      "",
      "Lista tecnica aproximada:",
      "- Bloco ceramico baiano 14x19x39: " + estimate.blocks + " un",
      "- Cimento para assentamento: " + estimate.layingCement + " sacos de 50 kg",
      "- Areia media para assentamento: " + formatEloOperationalQuantity_(estimate.layingSand) + " m3"
    ];
    if (estimate.hasChapisco) {
      lines.push("- Cimento para chapisco nos 2 lados: " + estimate.chapiscoCement + " sacos de 50 kg");
      lines.push("- Areia media para chapisco nos 2 lados: " + formatEloOperationalQuantity_(estimate.chapiscoSand) + " m3");
    }
    if (estimate.hasReboco) {
      lines.push("- Cimento para reboco nos 2 lados: " + estimate.plasterCement + " sacos de 50 kg");
      lines.push("- Areia media para reboco nos 2 lados: " + formatEloOperationalQuantity_(estimate.plasterSand) + " m3");
    }
    lines.push("- Agua de preparo: cerca de " + estimate.waterLiters + " litros");
    lines.push("");
    lines.push("Referencia usada: bloco 14x19x39 cm, junta media de 1 cm, perda de " + formatEloOperationalQuantity_(estimate.lossPercent || 8) + "%, chapisco fino e reboco medio de 2 cm nos dois lados.");
    lines.push.apply(lines, formatEloQuantitativePremises_(estimate.raw || "", [
      "Dimensoes consideradas: " + (estimate.length && estimate.height ? formatEloOperationalQuantity_(estimate.length) + " m x " + formatEloOperationalQuantity_(estimate.height) + " m" : formatEloOperationalQuantity_(estimate.area) + " m2"),
      "Bloco considerado: " + (estimate.blockDimension || "14x19x39 cm"),
      "Perda adotada: " + formatEloOperationalQuantity_(estimate.lossPercent || 8) + "%",
      "Lados revestidos: " + (estimate.coatingSides || "2 lados"),
      estimate.hasReboco ? "Espessura de reboco: 2 cm" : "Reboco: nao considerado"
    ]));
    return lines;
  }

  function formatEloWallBudgetLines_(estimate) {
    const budget = buildEloWallBudget_(estimate);
    const lines = formatEloWallEstimateLines_(estimate);
    lines.push("");
    lines.push("Orcamento preliminar de materiais, com precos padrao editaveis:");
    budget.items.forEach(function (item) {
      lines.push("- " + item.label + ": " + formatEloOperationalQuantity_(item.quantity) + " " + item.unit + " x " + formatEloWallMoney_(item.unitPrice) + " = " + formatEloWallMoney_(item.quantity * item.unitPrice));
    });
    lines.push("- Reserva tecnica/perdas comerciais " + formatEloOperationalQuantity_(budget.lossPercent) + "%: " + formatEloWallMoney_(budget.loss));
    lines.push("");
    lines.push("Total preliminar de materiais: " + formatEloWallMoney_(budget.total));
    lines.push("Nao inclui frete, ferramentas, andaime, tela, aditivos, cal ou variacao regional de preco.");
    return lines;
  }

  function formatEloWallFullBudgetLines_(estimate) {
    const labor = estimate.labor || buildEloWallLaborEstimate_(estimate);
    estimate.labor = labor;
    const materialBudget = buildEloWallBudget_(estimate);
    const lines = formatEloWallBudgetLines_(estimate);
    lines.push("");
    lines.push("Mao de obra preliminar:");
    lines.push("- Assentamento de bloco, referencia R$ 65,00/m2: " + formatEloWallMoney_(labor.masonryLabor));
    lines.push("- Chapisco/reboco, referencia R$ 38,00/m2 de face: " + formatEloWallMoney_(labor.coatingLabor));
    lines.push("- Total preliminar de mao de obra: " + formatEloWallMoney_(labor.totalLabor));
    lines.push("");
    lines.push("Total geral preliminar: " + formatEloWallMoney_(materialBudget.total + labor.totalLabor));
    lines.push("Inclui materiais + mao de obra preliminar. Ainda nao inclui frete, andaime, ferramentas, impostos, BDI ou variacao regional.");
    return lines;
  }

  function buildEloWallServiceAnswer_(message) {
    const briefing = parseEloWallServiceBriefing_(message);
    if (!briefing) {
      return null;
    }
    const estimate = buildEloWallEstimate_(briefing);
    const allowPreliminary = isEloPreliminaryEstimateAuthorized_(message);
    if (!allowPreliminary) {
      return buildEloMissingTechnicalCompositionResponse_(message);
    }
    estimate.preliminaryAuthorized = true;
    estimate.lossPercent = 8;
    estimate.budgetLossPercent = 8;
    rememberEloWallEstimate_(estimate);
    const wantsBudget = briefing.wantsBudget || briefing.wantsReferenceBudget;
    const lines = wantsBudget ? formatEloWallBudgetLines_(estimate) : formatEloWallEstimateLines_(estimate);
    return {
      shortAnswer: wantsBudget ? "Montei um orcamento preliminar para essa parede." : "Montei a lista de materiais para essa parede.",
      fullAnswer: lines.join("\n"),
      nextAction: wantsBudget ? "Se quiser, eu separo agora mao de obra e BDI." : "Se quiser orcamento, diga: quero o orcamento com referencia padrao.",
      canSave: true,
      sessionTheme: "elo_operacional_parede",
      sessionIntent: wantsBudget ? "orcamento_parede" : "lista_materiais_parede"
    };
  }

  function buildEloWallContinuationAnswer_(message) {
    const text = normalizeText(message);
    const estimate = ELO_SESSION_MEMORY.lastOperationalWallEstimate || window.__eloLastOperationalWallEstimate;
    if (!estimate) {
      return null;
    }
    const wantsLabor = /mao\s*de\s*obra|m.o|servico|pedreiro|quanto\s+cobrar|preco\s+do\s+servico|pre.o\s+do\s+servico/.test(text);
    const wantsLoss = /perda|perdas|desperdicio|desperd.cio|quebra|sobra|10\s*(?:%|por cento)|15\s*(?:%|por cento)/.test(text);
    const wantsBudget = hasAnyTerm(text, ["orcamento", "custo", "preco", "valor", "referencia", "padrao"]) || /orcament|or.amento|\borca\b|\bor.a\b|orcar|quanto|mais ou menos|refer|refer.ncia|padrao|padr.o|preco|pre.o|valor|custo/.test(text) || text === "sim";
    const wantsDetail = hasAnyTerm(text, ["detalhar", "detalhe", "quantidade"]) || text === "sim";
    if (wantsLabor) {
      if (!isEloPreliminaryEstimateAuthorized_(message)) {
        return buildEloMissingTechnicalCompositionResponse_(message);
      }
      estimate.preliminaryAuthorized = true;
      const labor = buildEloWallLaborEstimate_(estimate);
      estimate.labor = labor;
      rememberEloWallEstimate_(estimate);
      return {
        shortAnswer: "Usei a parede anterior e estimei a mao de obra.",
        fullAnswer: [
          "Mao de obra preliminar para a parede anterior:",
          "- Area de alvenaria: " + formatEloOperationalQuantity_(estimate.area) + " m2",
          "- Chapisco/reboco nos 2 lados: " + formatEloOperationalQuantity_(estimate.coatingArea) + " m2",
          "- Assentamento de bloco, referencia R$ 65,00/m2: " + formatEloWallMoney_(labor.masonryLabor),
          "- Chapisco + reboco, referencia R$ 38,00/m2 de face: " + formatEloWallMoney_(labor.coatingLabor),
          "",
          "Total preliminar de mao de obra: " + formatEloWallMoney_(labor.totalLabor),
          "Referencia simples. Ajuste por altura, andaime, produtividade da equipe, prazo, acesso e padrao de acabamento."
        ].join("\n"),
        nextAction: "Se quiser, eu junto materiais + mao de obra em um orcamento unico.",
        canSave: true,
        sessionTheme: "elo_operacional_parede",
        sessionIntent: "mao_de_obra_parede"
      };
    }
    if (wantsLoss) {
      if (!isEloPreliminaryEstimateAuthorized_(message)) {
        return buildEloMissingTechnicalCompositionResponse_(message);
      }
      estimate.preliminaryAuthorized = true;
      const lossMatch = text.match(/(\d+(?:[,.]\d+)?)\s*(?:%|por cento)/);
      const lossPercent = lossMatch ? parseEloOperationalNumber_(lossMatch[1]) : 10;
      const baseBlocks = Math.ceil(estimate.area * 12.5);
      const blocksWithLoss = Math.ceil(baseBlocks * (1 + lossPercent / 100));
      estimate.lossPercent = lossPercent;
      estimate.budgetLossPercent = lossPercent;
      estimate.blocks = blocksWithLoss;
      estimate.baseBlocks = baseBlocks;
      rememberEloWallEstimate_(estimate);
      return {
        shortAnswer: "Recalculei a perda para a parede anterior.",
        fullAnswer: [
          "Perda tecnica aplicada sobre a parede anterior:",
          "- Area de alvenaria: " + formatEloOperationalQuantity_(estimate.area) + " m2",
          "- Blocos sem perda: " + baseBlocks + " un",
          "- Perda adotada: " + formatEloOperationalQuantity_(lossPercent) + "%",
          "- Blocos com perda: " + blocksWithLoss + " un",
          "",
          "Use perda maior quando houver muitos recortes, vergas, rasgos, transporte ruim ou bloco com quebra frequente."
        ].join("\n"),
        nextAction: "Se quiser, eu atualizo tambem cimento e areia com essa perda.",
        canSave: true,
        sessionTheme: "elo_operacional_parede",
        sessionIntent: "perda_parede"
      };
    }
    if (wantsBudget || wantsDetail) {
      if (!isEloPreliminaryEstimateAuthorized_(message)) {
        return buildEloMissingTechnicalCompositionResponse_(message);
      }
      estimate.preliminaryAuthorized = true;
      rememberEloWallEstimate_(estimate);
      const wantsEverything = /tudo|total|geral|completo|materiais?\s*\+\s*mao|mao\s*de\s*obra/.test(text) || !!estimate.labor;
      const lines = wantsBudget
        ? (wantsEverything ? formatEloWallFullBudgetLines_(estimate) : formatEloWallBudgetLines_(estimate))
        : formatEloWallEstimateLines_(estimate);
      rememberEloWallEstimate_(estimate);
      return {
        shortAnswer: wantsBudget ? (wantsEverything ? "Usei a parede anterior e montei o total com materiais e mao de obra." : "Usei a parede anterior e montei o orcamento padrao.") : "Detalhei a parede anterior com consumo tecnico.",
        fullAnswer: lines.join("\n"),
        nextAction: wantsBudget ? "Se quiser, eu preparo esse servico para lancar no RDO." : "Se quiser orcamento, diga: quero orcamento padrao.",
        canSave: true,
        sessionTheme: "elo_operacional_parede",
        sessionIntent: wantsBudget ? (wantsEverything ? "orcamento_total_parede" : "orcamento_parede") : "detalhe_parede"
      };
    }
    return null;
  }

  function calculateEloOperationalPrediction_(message) {
    const engines = [window.StockAiCompositionEngine, window.StockAiObrasEngine].filter(Boolean);
    for (let index = 0; index < engines.length; index += 1) {
      const engine = engines[index];
      if (typeof engine.parseRequest === "function" && typeof engine.calculateMultipleServices === "function") {
        const parsed = engine.parseRequest(message);
        const services = parsed && Array.isArray(parsed.services) ? parsed.services : [];
        if (services.length) {
          const result = engine.calculateMultipleServices(services);
          const items = result && Array.isArray(result.predictedItems) ? result.predictedItems : [];
          const firstPrediction = result && Array.isArray(result.predictions) ? result.predictions[0] : null;
          if (items.length) {
            return {
              service: services[0],
              prediction: Object.assign({}, result, {
                composition: firstPrediction && firstPrediction.composition ? firstPrediction.composition : null
              }),
              predictedItems: items
            };
          }
        }
      }
    }

    const service = parseEloOperationalService_(message);
    if (!service) {
      return null;
    }
    for (let index = 0; index < engines.length; index += 1) {
      const engine = engines[index];
      const calculate = engine.calculatePredictedConsumption || engine.calculateStockAiPredictedConsumption;
      if (typeof calculate !== "function") {
        continue;
      }
      const prediction = calculate(service);
      const items = prediction && Array.isArray(prediction.predictedItems) ? prediction.predictedItems : [];
      if (items.length) {
        return {
          service: service,
          prediction: prediction,
          predictedItems: items
        };
      }
    }
    return {
      service: service,
      prediction: null,
      predictedItems: []
    };
  }

  function getEloOperationalAlmoxBalances_() {
    const bridge = window.ObraReportOperationalStock;
    if (!bridge || typeof bridge.getAlmoxBalances !== "function") {
      return [];
    }
    try {
      return bridge.getAlmoxBalances().filter(Boolean);
    } catch (error) {
      console.warn("Nao foi possivel consultar saldo operacional do Almoxarifado.", error);
      return [];
    }
  }

  function normalizeEloStockBalanceTerm_(value) {
    return normalizeText(value)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map(function (word) {
        return word.length > 3 && word.slice(-1) === "s" ? word.slice(0, -1) : word;
      })
      .join(" ");
  }

  function isEloStockBalanceQuestion_(message) {
    const text = normalizeText(message);
    const asksBalance = hasAnyTerm(text, [
      "quantas", "quantos", "quanto tenho", "qual saldo", "saldo de", "saldo do",
      "saldo da", "tenho em estoque", "tenho no estoque", "tem no estoque",
      "existe em estoque", "disponivel em estoque"
    ]);
    const stockContext = hasAnyTerm(text, ["estoque", "saldo", "almoxarifado", "stock full", "stock"]);
    return asksBalance && stockContext;
  }

  function extractEloStockBalanceQuery_(message) {
    const stopwords = {
      a: true,
      as: true,
      o: true,
      os: true,
      de: true,
      da: true,
      das: true,
      do: true,
      dos: true,
      em: true,
      no: true,
      na: true,
      nos: true,
      nas: true,
      meu: true,
      minha: true,
      minhas: true,
      meus: true,
      estoque: true,
      almoxarifado: true,
      stock: true,
      full: true,
      saldo: true,
      atual: true,
      item: true,
      itens: true,
      produto: true,
      produtos: true,
      unidade: true,
      unidades: true,
      qtd: true,
      quantidade: true,
      quantas: true,
      quantos: true,
      quanto: true,
      qual: true,
      quais: true,
      tenho: true,
      tem: true,
      existe: true,
      existem: true,
      disponivel: true,
      disponiveis: true
    };
    return normalizeText(message)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(function (word) {
        return word && !stopwords[word];
      })
      .join(" ")
      .trim();
  }

  function scoreEloStockBalanceMatch_(query, balance) {
    const itemName = normalizeEloStockBalanceTerm_(balance && balance.name);
    const normalizedQuery = normalizeEloStockBalanceTerm_(query);
    if (!itemName || !normalizedQuery) {
      return 0;
    }
    if (itemName === normalizedQuery) {
      return 100;
    }
    if (itemName.indexOf(normalizedQuery) >= 0 || normalizedQuery.indexOf(itemName) >= 0) {
      return 80;
    }
    return normalizedQuery.split(/\s+/).reduce(function (score, word) {
      return word && itemName.indexOf(word) >= 0 ? score + 20 : score;
    }, 0);
  }

  function findEloStockBalanceByQuestion_(message, balances) {
    const query = extractEloStockBalanceQuery_(message);
    if (!query) {
      return null;
    }
    return (balances || []).map(function (balance) {
      return {
        balance: balance,
        score: scoreEloStockBalanceMatch_(query, balance)
      };
    }).sort(function (a, b) {
      return b.score - a.score;
    }).filter(function (entry) {
      return entry.score > 0;
    })[0] || null;
  }

  function formatEloStockQuantity_(value) {
    const number = Number(value || 0);
    return String(Math.round(number * 1000) / 1000).replace(".", ",");
  }

  function buildEloStockBalanceAnswer_(message) {
    if (!isEloStockBalanceQuestion_(message)) {
      return null;
    }
    const balances = getEloOperationalAlmoxBalances_();
    const match = findEloStockBalanceByQuestion_(message, balances);
    if (!match || !match.balance) {
      return {
        shortAnswer: "Não encontrei esse item no estoque atual.",
        fullAnswer: "Não encontrei esse item no estoque atual. Confira se o nome está cadastrado no Almoxarifado/Stock Full ou pergunte usando o nome do produto como aparece na lista.",
        nextAction: "Abra a lista de itens ou tente perguntar pelo nome exato do produto.",
        canSave: false,
        sessionTheme: "stock_full_saldo"
      };
    }

    const item = match.balance;
    const unit = item.unit || "un";
    const quantity = formatEloStockQuantity_(item.balance || item.realBalance || 0);
    const minimum = Number(item.minimumStock || 0);
    const lines = [
      "Você tem " + quantity + " " + unit + " de " + (item.name || "item") + " no estoque atual.",
      "",
      "Resumo:",
      "- Saldo atual: " + quantity + " " + unit,
      "- Entradas registradas: " + formatEloStockQuantity_(item.entries || 0) + " " + unit,
      "- Saídas registradas: " + formatEloStockQuantity_(item.exits || 0) + " " + unit
    ];
    if (minimum > 0) {
      lines.push("- Estoque mínimo: " + formatEloStockQuantity_(minimum) + " " + unit);
      if (Number(item.balance || item.realBalance || 0) < minimum) {
        lines.push("- Alerta: abaixo do estoque mínimo.");
      }
    }
    if (item.status && normalizeText(item.status) !== "ok") {
      lines.push("- Status: " + item.status + ".");
    }
    lines.push("");
    lines.push("Fonte: saldo consolidado do Almoxarifado/Stock Full nesta tela. Nenhum movimento foi criado.");

    return {
      shortAnswer: lines[0],
      fullAnswer: lines.join("\n"),
      nextAction: "Se quiser, posso ajudar a conferir itens abaixo do mínimo ou próximos do vencimento.",
      canSave: false,
      sessionTheme: "stock_full_saldo"
    };
  }

  function isEloOperationalUnitCompatible_(predictedUnit, balanceUnit) {
    const predicted = normalizeEloOperationalUnit_(predictedUnit || "un");
    const balance = normalizeEloOperationalUnit_(balanceUnit || "un");
    return normalizeText(predicted) === normalizeText(balance);
  }

  function matchEloPredictedMaterialToBalance_(predicted, balances) {
    const predictedName = normalizeText(predicted.name || predicted.material || "");
    if (!predictedName) {
      return null;
    }
    const exact = balances.find(function (balance) {
      const itemName = normalizeText(balance.name || "");
      return itemName === predictedName &&
        isEloOperationalUnitCompatible_(predicted.unit, balance.unit);
    });
    if (exact) {
      return exact;
    }
    return balances.find(function (balance) {
      const itemName = normalizeText(balance.name || "");
      return itemName && (itemName.indexOf(predictedName) >= 0 || predictedName.indexOf(itemName) >= 0);
    }) || null;
  }

  function buildEloOperationalConstructionAnswer_(message) {
    if (!isEloOperationalConstructionQuestion_(message)) {
      return null;
    }
    updateEloWorkMemoryFromMessage_(message);
    const premiseQuestion = buildEloPremiseQuestion_(message);
    if (premiseQuestion) {
      return premiseQuestion;
    }
    const prediction = calculateEloOperationalPrediction_(message);
    if (!prediction || !prediction.predictedItems.length) {
      return {
        shortAnswer: "Eu ainda não consegui calcular essa previsão técnica.",
        fullAnswer: "Eu ainda não consegui calcular essa previsão técnica. Me informe o serviço com quantidade, por exemplo: parede de 40 m², piso de 30 m² ou laje de 60 m².",
        nextAction: "Informe serviço, quantidade e unidade para eu cruzar Stock AI com Almoxarifado.",
        canSave: false,
        sessionTheme: "elo_operacional_obras"
      };
    }

    const balances = getEloOperationalAlmoxBalances_();
    const sourceLabel = getEloOperationalPredictionSource_(prediction.prediction);
    const composition = prediction.prediction && prediction.prediction.composition ? prediction.prediction.composition : null;
    const allowPreliminary = isEloPreliminaryEstimateAuthorized_(message);
    if (!hasEloValidatedTechnicalBase_(prediction) && !allowPreliminary) {
      return buildEloMissingTechnicalCompositionResponse_(message);
    }
    const scaleAlerts = buildEloOperationalScaleAlerts_(prediction);
    const predictedLines = prediction.predictedItems.map(function (item) {
      const quantity = roundEloOperationalQuantity_(item.quantity || item.predictedQuantity || 0);
      return "- " + (item.name || item.material || "Material") + ": " + formatEloOperationalQuantity_(quantity) + " " + formatEloOperationalDisplayUnit_(item.unit || "un");
    });
    const almoxLines = [];
    let hasInsufficient = false;
    let hasMissing = false;

    const standaloneOperationalMode = isStandaloneMode();
    if (!balances.length) {
      almoxLines.push(standaloneOperationalMode
        ? "- Sem estoque vinculado nesta pagina. Use esta resposta como previsao tecnica de materiais."
        : "- Nao encontrei saldo do Almoxarifado disponivel nesta tela para comparar.");
    } else {
      prediction.predictedItems.forEach(function (item) {
        const required = roundEloOperationalQuantity_(item.quantity || item.predictedQuantity || 0);
        const match = matchEloPredictedMaterialToBalance_(item, balances);
        if (!match) {
          hasMissing = true;
          almoxLines.push("- " + (item.name || item.material || "Material") + ": não encontrado no Almoxarifado.");
          return;
        }
        const available = roundEloOperationalQuantity_(match.balance || match.realBalance || 0);
        const missing = roundEloOperationalQuantity_(Math.max(required - available, 0));
        if (missing > 0) {
          hasInsufficient = true;
        }
        almoxLines.push("- " + (item.name || item.material || match.name || "Material") + ": disponível " +
          formatEloOperationalQuantity_(available) + " " + formatEloOperationalDisplayUnit_(match.unit || item.unit || "un") +
          (missing > 0 ? " | faltam " + formatEloOperationalQuantity_(missing) + " " + formatEloOperationalDisplayUnit_(item.unit || match.unit || "un") : " | OK"));
      });
    }

    let resultTitle = "✅ Saldo suficiente";
    let recommendation = "A obra pode executar esse serviço sem necessidade de compra.";
    if (!balances.length) {
      resultTitle = standaloneOperationalMode ? "Previsao tecnica de materiais" : "Almoxarifado sem saldo comparavel";
      recommendation = standaloneOperationalMode
        ? "Se quiser, informe precos locais para eu montar o orcamento preliminar."
        : "Cadastrar saldo no Almoxarifado antes de liberar compra ou execucao.";
    } else if (hasMissing) {
      resultTitle = "🚨 Material não encontrado no Almoxarifado";
      recommendation = "Cadastrar o item ou transferir material antes de liberar a execução.";
    } else if (hasInsufficient) {
      resultTitle = "⚠️ Material insuficiente";
      recommendation = "Comprar ou transferir o material faltante antes da execução.";
    }

    return {
      shortAnswer: resultTitle,
      fullAnswer: [
        "📐 Previsão Stock AI",
        "Fonte: " + sourceLabel,
        formatEloTechnicalBaseLine_(composition, allowPreliminary),
        predictedLines.join("\n"),
        formatEloQuantitativePremises_(message, [
          "Serviço considerado: " + ((prediction.service && (prediction.service.service || prediction.service.serviceType)) || "serviço técnico"),
          "Quantidade considerada: " + formatEloOperationalQuantity_((prediction.service && prediction.service.quantity) || 0) + " " + formatEloOperationalDisplayUnit_((prediction.service && prediction.service.unit) || "")
        ]).join("\n"),
        scaleAlerts.length ? "\n" + scaleAlerts.join("\n") : "",
        "",
        standaloneOperationalMode ? "Observacao" : "Almoxarifado",
        almoxLines.join("\n"),
        "",
        resultTitle,
        recommendation,
        "",
        standaloneOperationalMode ? "Observacao: esta conversa e uma previsao tecnica. Confira medidas, perdas e precos locais antes da compra." : "Observacao: esta conversa apenas consulta e recomenda. A baixa oficial continua no fluxo do RDO/Almoxarifado."
      ].join("\n"),
      nextAction: recommendation,
      canSave: false,
      sessionTheme: "elo_operacional_obras"
    };
  }

  function buildEloOperationalAnswer(message, context) {
    const intent = classifyEloIntent(message, context);
    if (intent === "elo_limits") {
      return buildEloLimitsAnswer_();
    }
    if (intent === "elo_identity") {
      return buildEloIdentityAnswer_();
    }
    if (intent === "user_name_question") {
      return buildUserNameQuestionAnswer_();
    }
    if (intent === "save_user_name") {
      return buildSaveUserNameAnswer_(message);
    }
    if (intent === "day_closing") {
      return buildDayClosingAnswer(message, context);
    }
    if (intent === "day_summary") {
      return buildDaySummaryAnswer(message, context);
    }
    if (intent === "greeting") {
      return getSocialGreetingResponse(message);
    }
    if (intent === "construction_record") {
      return buildConstructionRecordAnswer_(detectConstructionRecord(message));
    }
    if (intent === "elo_demo") {
      return buildEloDemoAnswer_();
    }
    if (intent === "guided_action") {
      return buildGuidedActionAnswer_(message);
    }
    if (intent === "continuity") {
      return buildContinuityAnswer_(message);
    }
    if (intent === "synthesis_recommendation") {
      return buildEloSynthesisAnswer(message, context);
    }
    if (intent === "project_advisor") {
      return buildProjectAdvisorAnswer(buildLogicalReasoningContext());
    }
    if (intent === "decision_memory") {
      return buildDecisionMemoryAnswer(message);
    }
    if (intent === "initiative_opportunity") {
      const initiative = detectEloInitiativeOpportunity(message, context);
      return {
        shortAnswer: "Percebi um ponto importante.",
        fullAnswer: buildEloInitiativeSuggestion(initiative, context),
        nextAction: "Se fizer sentido, registre isso na Linha do Tempo ou nas Memorias importantes.",
        canSave: false,
        sessionTheme: "iniciativa",
        sessionIntent: "initiative_opportunity"
      };
    }
    if (intent === "capabilities") {
      return buildCapabilitiesCardAnswer_();
    }
    if (intent === "system_help") {
      return buildSystemHelpAnswer_();
    }
    if (intent === "rdo_help") {
      return buildRdoHelpAnswer_();
    }
    if (intent === "materials_help") {
      return buildMaterialsHelpAnswer_();
    }
    if (intent === "stock_help") {
      return buildStockHelpAnswer_();
    }
    if (intent === "pdf_help") {
      return buildPdfHelpAnswer_();
    }
    if (intent === "report_help") {
      return buildReportHelpAnswer_();
    }
    if (intent === "memory_question") {
      if (hasAnyTerm(normalizeEloText(message), ["linha do tempo"])) {
        return buildTimelineOperationalAnswer_();
      }
      return getNarrativeMemoryResponse(message) || answerConnectedMemoryQuestion(message) || answerTimelineQuestion(message) || answerProjectQuestion(message);
    }
    if (intent === "journey_report") {
      const reportType = detectJourneyReportRequest(message);
      if (reportType === "weekly") {
        return buildWeeklyJourneyReport();
      }
      if (reportType === "monthly") {
        return buildMonthlyJourneyReport();
      }
      return buildJourneyReport();
    }
    if (intent === "timeline_question") {
      return buildTimelineAnswer(message);
    }
    if (intent === "library_question") {
      return buildEloLibraryAnswer(message);
    }
    if (intent === "logical_reasoning") {
      return getLogicalReasoningResponse(message);
    }
    if (intent === "conceptual_question") {
      return getConceptResponse(message) || getPhilosophyResponse(message);
    }
    return null;
  }


  function buildEloStockPurchaseAnswer_(message) {
    const text = normalizeText(message);
    const stockIntent = /estoque|almoxarifado|comprar|compra|pedido|reposicao|reposi.ao|acabando|acabou|saldo|saida|sa.da|baixar|retirada/.test(text);
    const materialIntent = /cimento|areia|bloco|tijolo|argamassa|piso|concreto|aco|a.o|brita|material|materiais/.test(text);
    if (!stockIntent || !materialIntent) {
      return null;
    }
    return {
      shortAnswer: "Organize isso pelo fluxo de estoque e compras.",
      fullAnswer: [
        "Fluxo pratico para material/estoque:",
        "1. Registre a saida do material para a obra ou frente de servico.",
        "2. Confira o saldo atual no almoxarifado antes de comprar de novo.",
        "3. Se o saldo ficou abaixo do minimo, gere uma reposicao/compras.",
        "4. Anote destino, responsavel e data para fechar o historico.",
        "",
        "Se voce me disser item, quantidade que saiu e obra, eu monto o lancamento sugerido e a compra de reposicao."
      ].join("\n"),
      nextAction: "Informe item, quantidade, unidade e obra.",
      canSave: true,
      sessionTheme: "estoque",
      sessionIntent: "estoque_compras"
    };
  }

  function buildEloOnboardingConstructionAnswer_(message) {
    const text = normalizeText(message);
    const firstUse = /sou leigo|nao sei usar|nunca usei|primeiro uso|por onde comeco|por onde come.o|como come.o|come.ar uma vistoria|fazer vistoria simples/.test(text);
    const clientWork = /cadastrei cliente|cadastro de cliente|cadastrar cliente|cadastrar obra|cadastro da obra|cliente.*obra|obra.*cliente/.test(text);
    if (!firstUse && !clientWork) {
      return null;
    }
    const lines = clientWork ? [
      "Depois de cadastrar o cliente, o proximo passo e cadastrar a obra:",
      "1. Abra Obras.",
      "2. Crie uma nova obra vinculada a esse cliente.",
      "3. Informe nome da obra, endereco, responsavel e tipo de servico.",
      "4. Depois entre na obra e gere RDO, vistoria, relatorio ou PDF.",
      "",
      "Essa ordem evita relatorio solto sem cliente e sem obra vinculada."
    ] : [
      "Para comecar simples no ObraReport:",
      "1. Cadastre o cliente.",
      "2. Cadastre a obra vinculada ao cliente.",
      "3. Abra um RDO ou relatorio tecnico.",
      "4. Anexe fotos e descreva o que foi visto ou executado.",
      "5. Revise e gere o PDF.",
      "",
      "Se for vistoria simples, comece por: ambiente, problema observado, fotos, causa provavel e recomendacao."
    ];
    return {
      shortAnswer: clientWork ? "O proximo passo e cadastrar a obra vinculada ao cliente." : "Comece pelo fluxo cliente, obra, registro e PDF.",
      fullAnswer: lines.join("\n"),
      nextAction: "Diga qual cliente/obra voce quer registrar que eu te guio no preenchimento.",
      canSave: true,
      sessionTheme: "onboarding_obras",
      sessionIntent: clientWork ? "cadastro_obra" : "primeiro_uso"
    };
  }

  function buildEloSlabSafetyAnswer_(message) {
    const text = normalizeText(message);
    if (!/laje|concretagem|concretar|viga|pilar|forma|escora|escoramento/.test(text) || !/conferir|antes|seguranca|seguran.a|cuidado|checklist|mestre/.test(text)) {
      return null;
    }
    return {
      shortAnswer: "Antes da concretagem, faca um checklist de seguranca e conferencia tecnica.",
      fullAnswer: [
        "Checklist rapido antes de liberar laje/viga/pilar:",
        "- Formas travadas, limpas, alinhadas e sem frestas grandes.",
        "- Escoramento firme, contraventado e apoiado em base segura.",
        "- Armaduras conferidas: bitola, espacamento, cobrimento e transpasse.",
        "- Passagens eletricas/hidraulicas revisadas antes do concreto.",
        "- Acesso seguro para equipe, bomba/carrinho e vibrador.",
        "- Concreto confirmado: volume, traco/fck, horario e plano de cura.",
        "- Registrar fotos e responsavel no RDO antes, durante e depois.",
        "",
        "Se houver duvida estrutural, nao libere sem o engenheiro responsavel."
      ].join("\n"),
      nextAction: "Se quiser, eu transformo isso em checklist de vistoria para PDF.",
      canSave: true,
      sessionTheme: "seguranca_obra",
      sessionIntent: "checklist_concretagem"
    };
  }

  function buildEloConsumptionAuditAnswer_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    const wantsAudit = /confere|alto|baixo|demais|auditoria|desperdicio|desperd.cio|consumo|usei|usamos|gastou|gastamos/.test(text);
    if (!wantsAudit) {
      return null;
    }
    const areaMatch = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|metros?\s+quadrados?)/i);
    const blocksMatch = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:blocos?|tijolos?)/i);
    const cementMatch = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:sacos?|sc)\s*(?:de\s*)?cimento/i);
    const area = areaMatch ? parseEloOperationalNumber_(areaMatch[1]) : 0;
    if (area > 0 && blocksMatch) {
      const actualBlocks = parseEloOperationalNumber_(blocksMatch[1]);
      const expectedBlocks = Math.ceil(area * 12.5 * 1.08);
      const status = actualBlocks < expectedBlocks * 0.75 ? "muito abaixo do esperado" : actualBlocks > expectedBlocks * 1.25 ? "acima do esperado" : "dentro de uma faixa aceitavel";
      return {
        shortAnswer: "Comparei o consumo de blocos com uma referencia tecnica.",
        fullAnswer: [
          "Auditoria rapida de consumo:",
          "- Area informada: " + formatEloOperationalQuantity_(area) + " m2",
          "- Blocos usados: " + formatEloOperationalQuantity_(actualBlocks) + " un",
          "- Referencia esperada com perda: cerca de " + expectedBlocks + " un",
          "- Leitura: consumo " + status + ".",
          "",
          "Se estiver muito diferente, confira se a area foi medida corretamente, se houve reaproveitamento, meia parede, vao de portas/janelas ou lancamento incompleto."
        ].join("\n"),
        nextAction: "Envie tambem cimento e areia usados para eu fechar a auditoria.",
        canSave: true,
        sessionTheme: "auditoria_material",
        sessionIntent: "auditoria_blocos"
      };
    }
    if (area > 0 && cementMatch) {
      const actualCement = parseEloOperationalNumber_(cementMatch[1]);
      const expectedCement = Math.max(1, Math.ceil(area * 0.095));
      const status = actualCement > expectedCement * 1.8 ? "alto" : actualCement < expectedCement * 0.5 ? "baixo" : "aceitavel";
      return {
        shortAnswer: "Comparei o consumo de cimento com uma referencia rapida.",
        fullAnswer: [
          "Auditoria rapida de cimento:",
          "- Area informada: " + formatEloOperationalQuantity_(area) + " m2",
          "- Cimento usado: " + formatEloOperationalQuantity_(actualCement) + " sacos",
          "- Referencia inicial para assentamento: cerca de " + expectedCement + " sacos",
          "- Leitura: consumo " + status + ".",
          "",
          "Ajuste se tambem entrou chapisco, reboco, perdas, retrabalho ou outro servico no mesmo lancamento."
        ].join("\n"),
        nextAction: "Se quiser, eu separo por assentamento, chapisco e reboco.",
        canSave: true,
        sessionTheme: "auditoria_material",
        sessionIntent: "auditoria_cimento"
      };
    }
    return null;
  }

  function buildEloAmbiguousMaterialAnswer_(message) {
    const text = normalizeText(message);
    const asksMaterial = /material|materiais|lista|quantos|quanto vai|comprar|orcamento|or.amento/.test(text);
    const hasConstructionSubject = /parede|muro|alvenaria|bloco|tijolo|reboco|chapisco|piso|contrapiso|laje/.test(text);
    const hasQuantity = /\d/.test(text);
    if (!asksMaterial || !hasConstructionSubject || hasQuantity) {
      return null;
    }
    return {
      shortAnswer: "Consigo calcular, mas preciso da medida principal.",
      fullAnswer: [
        "Para eu montar a lista sem chutar, envie assim:",
        "- Parede: comprimento x altura, tipo de bloco e se tera chapisco/reboco nos dois lados.",
        "- Piso/contrapiso/reboco: area em m2 e espessura quando souber.",
        "- Concreto/laje: volume em m3 ou area + espessura.",
        "",
        "Exemplo: parede de bloco baiano 8 por 3, chapisco e reboco dos dois lados."
      ].join("\n"),
      nextAction: "Informe as medidas e eu calculo a lista.",
      canSave: false,
      sessionTheme: "materiais",
      sessionIntent: "pedir_medidas"
    };
  }



  function buildEloWallRdoAnswer_(message) {
    const text = normalizeText(message);
    const estimate = ELO_SESSION_MEMORY.lastOperationalWallEstimate || window.__eloLastOperationalWallEstimate;
    if (!estimate || !/rdo|diario|diario de obra|lan.ar|lancar|registre|registrar/.test(text)) {
      return null;
    }
    const wantsLink = /link|abrir|rota|onde|mostra|mostrar/.test(text);
    const labor = estimate.labor || null;
    const materialBudget = buildEloWallBudget_(estimate);
    const rdoRoute = "relatorio-qualidade-obras/relatorio-qualidade-obras.html#app/diario";
    const lines = [
      "Resumo pronto para lancar no Diario de Obras/RDO:",
      "",
      "Servico executado:",
      "- Execucao de parede em bloco ceramico baiano 14x19x39 cm.",
      "- Dimensoes consideradas: " + (estimate.length && estimate.height ? formatEloOperationalQuantity_(estimate.length) + " m x " + formatEloOperationalQuantity_(estimate.height) + " m" : formatEloOperationalQuantity_(estimate.area) + " m2"),
      "- Area de alvenaria: " + formatEloOperationalQuantity_(estimate.area) + " m2",
      "- Revestimento previsto nos 2 lados: " + formatEloOperationalQuantity_(estimate.coatingArea) + " m2" + (estimate.hasReboco ? " de reboco" : ""),
      "- Perda tecnica adotada: " + formatEloOperationalQuantity_(estimate.lossPercent || 8) + "%",
      "",
      "Materiais previstos:",
      "- Bloco ceramico baiano: " + estimate.blocks + " un",
      "- Cimento para assentamento: " + estimate.layingCement + " sacos de 50 kg",
      "- Areia media para assentamento: " + formatEloOperationalQuantity_(estimate.layingSand) + " m3"
    ];
    if (estimate.hasChapisco) {
      lines.push("- Cimento para chapisco: " + estimate.chapiscoCement + " sacos de 50 kg");
      lines.push("- Areia media para chapisco: " + formatEloOperationalQuantity_(estimate.chapiscoSand) + " m3");
    }
    if (estimate.hasReboco) {
      lines.push("- Cimento para reboco: " + estimate.plasterCement + " sacos de 50 kg");
      lines.push("- Areia media para reboco: " + formatEloOperationalQuantity_(estimate.plasterSand) + " m3");
    }
    lines.push("");
    lines.push("Orcamento de apoio:");
    lines.push("- Materiais: " + formatEloWallMoney_(materialBudget.total));
    if (labor) {
      lines.push("- Mao de obra: " + formatEloWallMoney_(labor.totalLabor));
      lines.push("- Total geral preliminar: " + formatEloWallMoney_(materialBudget.total + labor.totalLabor));
    }
    lines.push("");
    lines.push("Texto sugerido para o RDO:");
    lines.push("'Foi executada parede em bloco ceramico baiano, com area aproximada de " + formatEloOperationalQuantity_(estimate.area) + " m2, considerando preparo para revestimento/reboco nas faces informadas. Foram previstos materiais conforme consumo tecnico, com perda adotada de " + formatEloOperationalQuantity_(estimate.lossPercent || 8) + "%.'");
    lines.push("");
    lines.push("Link/rota do Diario de Obras: " + rdoRoute);
    if (wantsLink) {
      lines.push("Abra essa rota e registre em Execucao e Materiais do RDO.");
    }
    return {
      shortAnswer: "Preparei o lancamento dessa parede para o RDO.",
      fullAnswer: lines.join("\n"),
      nextAction: "Abra " + rdoRoute + " e cole o resumo em Execucao/Materiais.",
      canSave: true,
      sessionTheme: "rdo",
      sessionIntent: "rdo_parede_contextual"
    };
  }


  function buildEloTechnicalReportDraftAnswer_(message) {
    const text = normalizeText(message);
    const wantsReport = hasAnyTerm(text, ["relatorio", "laudo", "vistoria", "parecer", "descrever", "escrever"]) || /relat|laudo|vistoria|parecer|descrev|escrev/.test(text);
    const hasPathology = hasAnyTerm(text, ["infiltracao", "umidade", "mofo", "trinca", "fissura", "rachadura", "vazamento", "banheiro", "parede"]) || /infiltra|umidade|mofo|trinca|fissura|rachadura|vazamento|banheiro|parede/.test(text);
    if (!wantsReport || !hasPathology) {
      return null;
    }
    const subject = hasAnyTerm(text, ["trinca", "fissura", "rachadura"]) || /trinca|fissura|rachadura/.test(text)
      ? "trinca/fissura"
      : hasAnyTerm(text, ["infiltracao", "umidade", "mofo", "vazamento"]) || /infiltra|umidade|mofo|vazamento/.test(text)
        ? "infiltracao/umidade"
        : "manifestacao observada";
    return {
      shortAnswer: "Monte o relato tecnico com evidencias, causa provavel e recomendacao.",
      fullAnswer: [
        "Sugestao de texto-base para " + subject + ":",
        "",
        "Durante a vistoria, foi observada manifestacao patologica aparente em parede/ambiente informado, com sinais visiveis que devem ser registrados por fotografia e localizacao.",
        "",
        "Estrutura recomendada:",
        "1. Identifique o ambiente e o ponto exato.",
        "2. Descreva o que aparece na foto, sem exagerar a conclusao.",
        "3. Informe causa provavel: umidade, falha de impermeabilizacao, movimentacao, fissura de revestimento ou outra hipotese visivel.",
        "4. Recomende verificacao complementar antes de definir reparo definitivo.",
        "5. Anexe fotos gerais e fotos de detalhe com legenda.",
        "",
        "Frase segura: 'A avaliacao visual indica necessidade de verificacao tecnica complementar para confirmar causa e definir o tratamento adequado.'"
      ].join("\n"),
      nextAction: "Se quiser, me diga o ambiente, tamanho aproximado e o que aparece na foto que eu redijo o texto final.",
      canSave: true,
      sessionTheme: "relatorio",
      sessionIntent: "relatorio_manifestacao"
    };
  }

  function buildEloDailyWorkLogAnswer_(message) {
    const text = normalizeText(message);
    const looksLikeDailyLog = hasAnyTerm(text, ["hoje", "ontem", "fizemos", "executamos", "foi feito", "lan?ar", "lancar", "diario", "rdo"]);
    const hasWork = hasAnyTerm(text, ["alvenaria", "reboco", "limpeza", "piso", "concreto", "forma", "armacao", "pintura", "obra"]);
    if (!looksLikeDailyLog || !hasWork) {
      return null;
    }
    return {
      shortAnswer: "Isso pode virar um registro de RDO.",
      fullAnswer: [
        "Registro sugerido para o Diario de Obras/RDO:",
        "",
        "Servicos executados:",
        "- Alvenaria/reboco/limpeza ou servicos informados pela equipe.",
        "",
        "Como preencher:",
        "1. Informe data, obra e responsavel.",
        "2. Lance os servicos executados com quantidade quando houver medicao.",
        "3. Registre equipe, ocorrencias e materiais consumidos.",
        "4. Anexe fotos do antes, durante e depois.",
        "5. Gere o PDF do RDO quando revisar tudo.",
        "",
        "Texto curto: 'Foram executados servicos de alvenaria, reboco e limpeza da frente de trabalho, conforme andamento da obra e registros fotograficos anexos.'"
      ].join("\n"),
      nextAction: "Se quiser, me passe quantidades e equipe que eu organizo o RDO completo.",
      canSave: true,
      sessionTheme: "rdo",
      sessionIntent: "rdo_registro_diario"
    };
  }

  function isEloConstructionTechnicalQuestion_(message) {
    const text = normalizeText(message || "");
    return /sinapi|orse|composi..o|composicao|alvenaria|parede|bloco|tijolo|chapisco|reboco|embo.o|emboco|concreto|\bfck\b|laje|contrapiso|\bpiso\b|rodape|rodap.|telha|telhado|produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|horas?|homens?-hora|\bbdi\b|custo|or.amento|orcamento|quantitativo|insumos?|a.o|aco|ca-50|funda..o|fundacao|viga|pilar|sapata|\bcasa\b|resid.ncia|residencia|m²|m2|m3|m³/.test(text);
  }

  function extractEloGeometryPair_(message) {
    const source = stripEloBlockDimensionTriples_(message || "");
    const match = source.match(/\b(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|×|\?|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\b/i);
    if (!match) {
      return null;
    }
    const first = parseEloOperationalNumber_(match[1]);
    const second = parseEloOperationalNumber_(match[2]);
    if (!(first > 0) || !(second > 0)) {
      return null;
    }
    return { first: first, second: second };
  }

  function extractEloGeometryThicknessM_(message) {
    const text = sanitizeUserText(message || "");
    const cmMatch = text.match(/(?:espessura\s*(?:de)?\s*)?(\d+(?:[,.]\d+)?)\s*cm\b/i);
    if (cmMatch) {
      return { meters: parseEloOperationalNumber_(cmMatch[1]) / 100, label: formatEloWallPremiseMeasure_(parseEloOperationalNumber_(cmMatch[1]), "cm") };
    }
    const meterMatch = text.match(/espessura\s*(?:de)?\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\b/i);
    if (meterMatch) {
      return { meters: parseEloOperationalNumber_(meterMatch[1]), label: formatEloWallPremiseMeasure_(parseEloOperationalNumber_(meterMatch[1]), "m") };
    }
    return null;
  }

  function buildEloGeometryLayerAnswer_(message) {
    const text = normalizeText(message || "");
    if (!isEloConstructionTechnicalQuestion_(message)) {
      return null;
    }
    if (/parede|muro|alvenaria|bloco|tijolo/.test(text)) {
      return null;
    }
    const pair = extractEloGeometryPair_(message);
    if (!pair) {
      return null;
    }
    const area = pair.first * pair.second;
    const wantsRodape = /rodape|rodap.|perimetro|metro\s+linear|metros\s+lineares/.test(text);
    const wantsVolume = /volume|m3|m³|concreto|laje|radier|contrapiso/.test(text);
    const thickness = extractEloGeometryThicknessM_(message);
    if (wantsVolume && thickness && thickness.meters > 0) {
      const volume = area * thickness.meters;
      const needsFck = hasEloConcreteSubject_(text) && !hasEloConcreteFck_(text);
      const lines = [
        "Resposta principal",
        "Volume geométrico: " + formatEloWallPremiseMeasure_(volume, "m³") + ".",
        "",
        "Premissas utilizadas:",
        "- Comprimento: " + formatEloWallPremiseMeasure_(pair.first, "m"),
        "- Largura: " + formatEloWallPremiseMeasure_(pair.second, "m"),
        "- Área: " + formatEloWallPremiseMeasure_(area, "m²"),
        "- Espessura: " + thickness.label,
        "",
        "Base técnica utilizada",
        "- Geometria informada pelo usuário. SINAPI/ORSE não é necessária para calcular área ou volume geométrico.",
        "",
        "Próxima ação",
        needsFck ? "Antes de calcular consumo, mão de obra, produtividade ou custo, preciso confirmar o FCK do concreto e localizar composição SINAPI/ORSE ou interna validada." : "Para consumo, mão de obra, produtividade, custo, cronograma ou curva ABC, preciso localizar composição SINAPI/ORSE ou interna validada."
      ];
      return {
        shortAnswer: "Volume geométrico: " + formatEloWallPremiseMeasure_(volume, "m³") + ".",
        fullAnswer: lines.join("\n"),
        nextAction: needsFck ? "Informe o FCK do concreto para avançar para premissas e composição." : "Informe a composição SINAPI/ORSE ou as premissas técnicas para avançar.",
        canSave: false,
        sessionTheme: "geometria_obras",
        sessionIntent: "geometria_volume"
      };
    }
    if (wantsRodape) {
      const perimeter = 2 * (pair.first + pair.second);
      const lines = [
        "Resposta principal",
        "Perímetro/metros lineares: " + formatEloWallPremiseMeasure_(perimeter, "m") + ".",
        "",
        "Premissas utilizadas:",
        "- Comprimento: " + formatEloWallPremiseMeasure_(pair.first, "m"),
        "- Largura: " + formatEloWallPremiseMeasure_(pair.second, "m"),
        "- Cálculo: 2 x (comprimento + largura)",
        "",
        "Base técnica utilizada",
        "- Geometria informada pelo usuário. SINAPI/ORSE não é necessária para calcular metros lineares.",
        "",
        "Próxima ação",
        "Para orçamento, produtividade, perdas ou custo do rodapé, preciso localizar composição SINAPI/ORSE ou interna validada."
      ];
      return {
        shortAnswer: "Metros lineares: " + formatEloWallPremiseMeasure_(perimeter, "m") + ".",
        fullAnswer: lines.join("\n"),
        nextAction: "Informe composição ou padrão de rodapé se quiser avançar para orçamento.",
        canSave: false,
        sessionTheme: "geometria_obras",
        sessionIntent: "geometria_metros_lineares"
      };
    }
    if (/area|área|m2|m²|laje|piso|telhado|cobertura/.test(text)) {
      const lines = [
        "Resposta principal",
        "Área geométrica: " + formatEloWallPremiseMeasure_(area, "m²") + ".",
        "",
        "Premissas utilizadas:",
        "- Comprimento: " + formatEloWallPremiseMeasure_(pair.first, "m"),
        "- Largura: " + formatEloWallPremiseMeasure_(pair.second, "m"),
        "",
        "Base técnica utilizada",
        "- Geometria informada pelo usuário. SINAPI/ORSE não é necessária para calcular área geométrica.",
        "",
        "Próxima ação",
        "Para consumo, mão de obra, produtividade, custo, cronograma ou curva ABC, preciso localizar composição SINAPI/ORSE ou interna validada."
      ];
      return {
        shortAnswer: "Área geométrica: " + formatEloWallPremiseMeasure_(area, "m²") + ".",
        fullAnswer: lines.join("\n"),
        nextAction: "Informe premissas e composição técnica se quiser avançar para orçamento.",
        canSave: false,
        sessionTheme: "geometria_obras",
        sessionIntent: "geometria_area"
      };
    }
    return null;
  }
  function isEloHighLevelConstructionBudgetQuestion_(message) {
    const text = normalizeText(message || "");
    return isEloConstructionTechnicalQuestion_(message) && /composi..o|composicao|produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|homens?-hora|horas?\s+necessarias|\bbdi\b|quanto\s+custa|custo|or.amento|orcamento|valor|cronograma|curva\s+abc|insumos?.*80|participa..o\s+percentual|participacao\s+percentual|reduzir\s+o\s+custo|otimiza..o|otimizacao|sacos?\s+de\s+cimento|kg\s+de\s+a.o|kg\s+de\s+aco|estimativa\s+de\s+blocos|quantitativos\s+principais/.test(text);
  }
  function buildEloConciseMissingServicePremisesAnswer_(message, project) {
    const text = normalizeText(message || "");
    if (!/alvenaria|parede|bloco|tijolo/.test(text) || !/quanto\s+custa|custo|or.amento|orcamento|valor|pre.o|preco/.test(text)) {
      return null;
    }
    const hasGeometry = hasEloWallLengthHeight_(text) || /\d+(?:[,.]\d+)?\s*(?:m2|m\^2|m²|metros?\s+quadrados?)/.test(text);
    if (hasGeometry) {
      return null;
    }
    const summary = formatEloWorkMemorySavedSummary_(project || getActiveEloWorkProject_());
    const answer = [
      "Lembrei da obra " + summary + ".",
      "Para calcular custo da alvenaria, preciso completar o serviço:",
      "- metragem ou área da parede;",
      "- dimensão do bloco;",
      "- vãos de portas/janelas;",
      "- perda e revestimento;",
      "- base SINAPI/ORSE ou composição interna validada.",
      "Sem essa composição, não gero custo oficial; posso apenas seguir para uma estimativa preliminar se você autorizar explicitamente como NÃO OFICIAL."
    ].join("\n");
    return {
      shortAnswer: "Preciso das premissas da alvenaria antes do custo.",
      fullAnswer: answer,
      nextAction: "Informe área ou comprimento x altura, bloco, vãos, perda, revestimento e composição SINAPI/ORSE.",
      canSave: false,
      sessionTheme: "base_tecnica_quantitativo",
      sessionIntent: "pedir_premissas_alvenaria"
    };
  }
  function buildEloConstructionTechnicalFallback_(message) {
    const text = normalizeText(message || "");
    const subject = /casa|resid.ncia|residencia/.test(text)
      ? "residência/obra completa"
      : /produtividade|equipe|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|horas?|homens?-hora/.test(text)
        ? "produtividade e mão de obra"
        : /sinapi|orse|composi..o|composicao/.test(text)
          ? "composição técnica"
          : "serviço de obra";
    const project = updateEloWorkMemoryFromMessage_(message);
    const conciseMissingPremises = buildEloConciseMissingServicePremisesAnswer_(message, project);
    if (conciseMissingPremises) {
      return conciseMissingPremises;
    }
    if (/produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|horas?|homens?-hora|equipe/.test(text)) {
      const summary = formatEloWorkMemorySavedSummary_(project || getActiveEloWorkProject_());
      const answer = [
        "Lembrei da obra " + summary + ".",
        "Para produtividade da equipe, preciso da composição validada do serviço ou referência SINAPI/ORSE. Sem composição, não vou tratar produtividade, equipe, m²/dia ou homens-hora como dado oficial.",
        "Posso continuar de duas formas: você informa a composição validada ou autoriza explicitamente uma ESTIMATIVA NÃO OFICIAL."
      ].join("\n");
      return {
        shortAnswer: "Preciso de composição validada para produtividade oficial.",
        fullAnswer: answer,
        nextAction: "Informe o serviço exato e a composição SINAPI/ORSE, ou autorize estimativa NÃO OFICIAL.",
        canSave: false,
        sessionTheme: "base_tecnica_quantitativo",
        sessionIntent: "bloquear_produtividade_sem_composicao"
      };
    }
    const auditorAlerts = buildEloTechnicalAuditorAlerts_(message, { hasOfficialBase: false });
    const lines = [
      "Resposta principal",
      "Entendi que é uma pergunta técnica de obras sobre " + subject + ". Não vou calcular consumo, produtividade, mão de obra, custo, cronograma ou curva ABC sem composição técnica válida.",
      "",
      "Memória de cálculo:",
      "- Não há memória de cálculo oficial porque a composição técnica ainda não foi localizada.",
      "- Se o pedido envolver apenas geometria, eu posso calcular área, volume, perímetro ou área líquida com as medidas informadas.",
      "",
      "Premissas utilizadas:",
      "- Serviço solicitado: " + subject + ";",
      "- Quantidade, área, volume ou escopo: conforme informado pelo usuário e pela memória de obra, ainda sujeito a conferência técnica;",
      "- UF/mês SINAPI/ORSE: " + ((project.uf && project.uf !== "não informada") ? project.uf : "não confirmado") + ";",
      "- Preços unitários: não informados.",
      "",
      "Memória permanente de obra",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "Base técnica utilizada: não localizada",
      "- Para cálculo oficial, preciso de SINAPI, ORSE ou composição interna validada com coeficientes positivos.",
      "",
      "Alertas do auditor:",
      (auditorAlerts.length ? auditorAlerts.join("\n") : "- Sem alerta crítico adicional com os dados informados. Ainda assim, valide premissas, projeto e responsabilidade técnica antes de executar."),
      "",
      "Próxima ação recomendada",
      "Informe o código/composição SINAPI/ORSE, envie a base oficial/importada ou autorize explicitamente uma ESTIMATIVA NÃO OFICIAL.",
      "",
      buildEloBudgetMvpScopeNotice_(),
      "",
      "Não vou inventar composição, produtividade, mão de obra, insumos ou valor oficial sem essa base."
    ];
    return {
      shortAnswer: "Preciso tratar isso como pergunta técnica de obras.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe as premissas do serviço ou o código/composição SINAPI/ORSE para eu continuar.",
      canSave: false,
      sessionTheme: "base_tecnica_quantitativo",
      sessionIntent: "roteamento_tecnico_obras"
    };
  }

  // ELO_RESPONSE_ENGINE
  function buildEloWorkMemoryQuestionAnswer_(message) {
    const text = normalizeText(message || "");
    if (!isEloWorkMemoryQuestion_(message)) {
      return null;
    }
    const project = getActiveEloWorkProject_();
    const summary = formatEloWorkMemorySavedSummary_(project);
    return {
      shortAnswer: "Tenho estes dados da obra atual.",
      fullAnswer: "Na memória da obra atual tenho: " + summary + ".",
      nextAction: "Faça uma pergunta técnica ou atualize algum dado da obra.",
      canSave: false,
      sessionTheme: "memoria_obra",
      sessionIntent: "consultar_memoria_obra"
    };
  }

  function buildEloNaturalSimpleAnswer_(message) {
    const text = normalizeText(message || "").trim();
    const social = getSocialGreetingResponse(message);
    if (social) {
      return social;
    }
    if (/^(obrigado|obrigada|valeu|grato|grata)\b/.test(text)) {
      return {
        shortAnswer: "Por nada.",
        fullAnswer: "Por nada. Quando quiser, posso continuar pela obra atual ou responder outra dúvida técnica.",
        nextAction: "Envie a próxima pergunta quando quiser.",
        canSave: false,
        sessionTheme: "conversa",
        sessionIntent: "agradecimento"
      };
    }
    if (/cadista/.test(text)) {
      return {
        shortAnswer: "O CADISTA transforma dados de projeto em desenho técnico.",
        fullAnswer: "O CADISTA é o módulo para transformar dados de projeto em planta técnica, com foco em PDF/DXF e evolução para leitura de croquis. Se quiser, posso explicar o fluxo de uso ou ajudar a montar um briefing de planta.",
        nextAction: "Diga se quer entender o CADISTA ou criar um briefing de planta.",
        canSave: false,
        sessionTheme: "cadista",
        sessionIntent: "explicar_cadista"
      };
    }
    if (/quem\s+criou\s+voce|quem\s+criou\s+você/.test(text)) {
      return {
        shortAnswer: "Fui criado para apoiar seus projetos técnicos.",
        fullAnswer: "Sou o Elo, assistente do ecossistema da WIA Engenharia para apoiar obras, relatórios, memória técnica e produtos como CADISTA e Stock.",
        nextAction: "Pergunte algo sobre a obra ou sobre os produtos quando quiser.",
        canSave: false,
        sessionTheme: "conversa",
        sessionIntent: "identidade"
      };
    }
    if (hasEloTechnicalCalculationIntent_(message) || isEloConstructionTechnicalQuestion_(message)) {
      return null;
    }
    return null;
  }
  function isEloConstructionPathologyQuestion_(message) {
    const text = normalizeText(message || "");
    return /trinca|fissura|rachadura|infiltra|umidade|mofo|vazamento|soltando\s+em\s+placas|reboco.*(soltando|caindo)|piso.*(oco|estufando)|ceramico.*(oco|estufando)|cerâmico.*(oco|estufando)|descascando|concreto.*(fraco|esfarelando)|\besfarelando\b|argamassa.{0,40}(virou|ficou).{0,20}(po|pó)|virou\s+(po|pó)|armadura\s+aparecendo|laje\s+cedendo|muro\s+inclinando|porta\s+emperrando|bolhas?\s+na\s+pintura|cheiro\s+de\s+esgoto|manchas?\s+brancas?|sem\s+caimento|empo[cç]ando/.test(text);
  }

  function hasEloBudgetOrCompositionIntent_(message) {
    const text = normalizeText(message || "");
    return /orcamento|custo|valor|preco|composi..o|composicao|sinapi|orse|transporte|servico|executar|execu..o|produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|insumos?|coeficiente|cronograma|curva\s+abc|bdi/.test(text);
  }


  function getEloTechnicalSourcePreference_() {
    try {
      const value = String(window.sessionStorage && window.sessionStorage.getItem(ELO_TECH_SOURCE_PREFERENCE_KEY) || "").toUpperCase();
      return value === "SINAPI" || value === "ORSE" ? value : "";
    } catch (error) {
      return "";
    }
  }

  function setEloTechnicalSourcePreference_(source) {
    const normalizedSource = String(source || "").toUpperCase();
    if (normalizedSource !== "SINAPI" && normalizedSource !== "ORSE") {
      return "";
    }
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem(ELO_TECH_SOURCE_PREFERENCE_KEY, normalizedSource);
      }
    } catch (error) {
      // Preferencia temporaria; se o navegador bloquear storage, a resposta ainda continua segura.
    }
    return normalizedSource;
  }

  function detectEloTechnicalSourcePreferenceRequest_(message) {
    const text = normalizeText(message || "").trim();
    if (/^(quero|prefiro|usar|use|priorize|priorizar|trabalhar\s+com)\s+orse$/.test(text) || /^orse$/.test(text)) {
      return "ORSE";
    }
    if (/^(quero|prefiro|usar|use|priorize|priorizar|trabalhar\s+com)\s+sinapi$/.test(text) || /^sinapi$/.test(text)) {
      return "SINAPI";
    }
    return "";
  }

  function buildEloTechnicalSourcePreferenceAnswer_(message) {
    const source = detectEloTechnicalSourcePreferenceRequest_(message);
    if (!source) {
      return null;
    }
    setEloTechnicalSourcePreference_(source);
    return {
      shortAnswer: "Preferencia tecnica registrada: " + source + ".",
      fullAnswer: "Entendido. Vou priorizar composicoes " + source + " quando houver equivalentes disponiveis.",
      nextAction: "Informe o servico, dimensoes e premissas para eu buscar a composicao adequada.",
      canSave: false,
      sessionTheme: "fonte_tecnica_orcamento",
      sessionIntent: "preferencia_fonte_tecnica"
    };
  }

  function getEloBudgetMvpScopeNoticeLines_() {
    return [
      "MVP Elo Orcamentista Assistido v1",
      "",
      "Escopo atual:",
      "Alvenaria.",
      "",
      "Escopo atual do pacote:",
      "Parede Completa.",
      "",
      "Os quantitativos e custos apresentados referem-se apenas aos servicos atualmente suportados pelo motor de orcamento.",
      "",
      "Outras disciplinas podem exigir complementacao tecnica, validacao profissional ou composicoes adicionais."
    ];
  }

  function buildEloBudgetMvpScopeNotice_() {
    return getEloBudgetMvpScopeNoticeLines_().join("\n");
  }

  function buildEloGenericPriceQuestionAnswer_(message) {
    const text = normalizeText(message || "").trim();
    if (!/^(quanto\s+custa|qual\s+o\s+preco|qual\s+o\s+valor|custo\??|preco\??|valor\??)\??$/.test(text)) {
      return null;
    }
    const lines = [
      "Preciso identificar qual servico deseja orcar.",
      "",
      "Exemplos:",
      "- parede de alvenaria",
      "- reboco",
      "- pintura",
      "- contrapiso",
      "",
      "Informe o servico e suas dimensoes.",
      "",
      buildEloBudgetMvpScopeNotice_()
    ];
    return {
      shortAnswer: "Preciso saber qual servico deseja orcar.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe o servico, dimensoes e premissas principais.",
      canSave: false,
      sessionTheme: "orcamento_servico_indefinido",
      sessionIntent: "pedir_servico_para_preco"
    };
  }

  function buildEloMultipleCompositionGuidanceAnswer_(message) {
    const text = normalizeText(message || "");
    if (!/mais\s+de\s+uma\s+composi..o|multiplas\s+composi..es|varias\s+composi..es|composi..es\s+compativeis/.test(text)) {
      return null;
    }
    const briefing = getEloStockObrasCompositionBriefing_();
    const candidates = sortEloCompositionCandidatesByPreference_(findEloStockObrasOfficialCompositionCandidates_(briefing));
    const lines = [
      "Encontrei mais de uma composicao compativel quando a base tecnica possui alternativas.",
      "",
      "Nao vou assumir automaticamente. A escolha precisa considerar bloco, funcao da parede, unidade, UF/mes e aderencia ao servico real.",
      "",
      "Composicoes para escolha:"
    ];
    if (candidates.length) {
      candidates.slice(0, 5).forEach(function (candidate, index) {
        const contract = buildEloTechnicalCompositionContract_(candidate);
        lines.push((index + 1) + ". " + contract.codigo + " | " + contract.descricao + " | unidade " + contract.unidade + " | " + contract.fonte + (contract.uf ? " " + contract.uf : "") + (contract.mes ? " " + contract.mes : ""));
      });
    } else {
      lines.push("1. Bloco ceramico 8 furos");
      lines.push("2. Bloco ceramico estrutural");
      lines.push("3. Bloco de concreto");
    }
    lines.push("");
    lines.push("Informe qual deseja utilizar.");
    lines.push("");
    lines.push(buildEloBudgetMvpScopeNotice_());
    return {
      shortAnswer: "Preciso que voce escolha a composicao compativel.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe o codigo ou o tipo de composicao desejada.",
      canSave: false,
      sessionTheme: "stock_obras_composicao",
      sessionIntent: "orientar_multiplas_composicoes"
    };
  }

  function isEloPaintingBudgetQuestion_(message) {
    const text = normalizeText(message || "");
    return /pintura|tinta|demaos?|selador|massa\s+corrida|massa\s+acrilica|parede\s+pintada|piso\s+pintado|acabamento\s+de\s+pintura/.test(text) && /orcar|orce|orcamento|custo|valor|quanto|calcular|calcule|consumo|comprar|compro/.test(text);
  }

  function buildEloPaintingBudgetBriefingAnswer_(message) {
    if (!isEloPaintingBudgetQuestion_(message)) {
      return null;
    }
    clearEloPendingPremises_();
    const project = getActiveEloWorkProject_();
    const memoryLines = formatEloWorkMemoryLines_(project);
    const answer = [
      "Resposta principal",
      "Entendi que o pedido agora e pintura. Vou tratar como novo servico e nao vou reaproveitar o briefing pendente de parede/alvenaria.",
      "",
      "Premissas utilizadas",
      memoryLines.join("\n"),
      "",
      "Base tecnica utilizada",
      "- Ainda nao localizada. Para orcamento ou consumo oficial, preciso de composicao SINAPI/ORSE ou interna validada.",
      "",
      buildEloBudgetMvpScopeNotice_(),
      "",
      "Proxima acao recomendada",
      "Para seguir, confirme: area de pintura, ambiente interno ou externo, tipo de superficie, sistema de pintura (selador/massa/tinta), numero de demaos e se deseja orcamento oficial por composicao ou estimativa NAO OFICIAL."
    ].join("\n");
    return {
      shortAnswer: "Vou tratar isso como pintura e pedir as premissas certas.",
      fullAnswer: answer,
      nextAction: "Confirme area, ambiente, superficie, sistema e demaos.",
      canSave: false,
      sessionTheme: "pintura_orcamento",
      sessionIntent: "briefing_pintura"
    };
  }

  function buildEloConstructionPathologyAnswer_(message) {
    if (!isEloConstructionPathologyQuestion_(message) || hasEloBudgetOrCompositionIntent_(message)) {
      return null;
    }
    const text = normalizeText(message || "");
    const structuralRisk = /pilar|viga|laje\s+cedendo|fundacao|fundação|rachadura\s+grande|muro\s+inclinando|armadura\s+aparecendo|meio\s+do\s+vao|meio\s+do\s+vão/.test(text);
    const moisture = /infiltra|umidade|mofo|vazamento|cheiro\s+de\s+esgoto|bolhas?\s+na\s+pintura|descascando/.test(text);
    const coating = /reboco|piso|revestimento|ceramico|cerâmico|argamassa|pintura|manchas?|contrapiso/.test(text);
    const causes = [];
    if (/trinca|fissura|rachadura/.test(text)) causes.push("movimentação estrutural ou de alvenaria", "retração/acomodação", "falha em verga, contraverga, junta ou fundação");
    if (moisture) causes.push("falha de impermeabilização", "entrada de água por cobertura/esquadria", "umidade ascendente ou vazamento oculto");
    if (coating) causes.push("base mal preparada", "argamassa inadequada ou cura insuficiente", "umidade por trás do revestimento");
    if (/concreto|armadura/.test(text)) causes.push("cobrimento insuficiente", "corrosão de armadura", "concreto mal adensado ou degradado");
    if (!causes.length) causes.push("execução inadequada", "movimentação da base", "umidade ou falta de manutenção");
    const uniqueCauses = causes.filter(function (item, index) { return causes.indexOf(item) === index; }).slice(0, 4);
    const risk = structuralRisk
      ? "Risco potencialmente estrutural. Recomendo interromper intervenções no ponto, escorar se houver deformação e chamar engenheiro responsável para vistoria presencial."
      : moisture
        ? "Risco de evolução por umidade. A correção deve tratar a origem da água antes do acabamento."
        : "Risco inicialmente técnico/de desempenho, mas precisa de vistoria para confirmar causa.";
    const answer = [
      "Triagem técnica",
      "Não dá para fechar diagnóstico definitivo sem vistoria, mas os indícios merecem checagem.",
      "",
      "Possíveis causas:",
      uniqueCauses.map(function (item) { return "- " + item + ";"; }).join("\n"),
      "",
      "O que verificar:",
      "- quando apareceu e se está aumentando;",
      "- presença de água, som oco, deformação, corrosão, destacamento ou fissuras próximas;",
      "- fotos, medidas, localização e histórico de execução/manutenção;",
      "- se há elemento estrutural envolvido: pilar, viga, laje, fundação ou muro de contenção.",
      "",
      "Risco:",
      "- " + risk,
      "",
      "Próxima ação:",
      structuralRisk
        ? "- acione engenheiro/ responsável técnico antes de reparar ou carregar a estrutura."
        : "- registre fotos, isole a origem provável e só execute reparo depois de confirmar a causa."
    ].join("\n");
    return {
      shortAnswer: "Isso pede triagem técnica antes de qualquer reparo.",
      fullAnswer: answer,
      nextAction: structuralRisk ? "Chame um engenheiro para vistoria presencial." : "Envie fotos, localização e histórico para afinar a triagem.",
      canSave: false,
      sessionTheme: "patologia_obras",
      sessionIntent: "triagem_patologia"
    };
  }
  function buildResponse(question) {
    const cleanQuestion = sanitizeUserText(question);
    const normalizedQuestion = normalizeText(cleanQuestion);
    if (normalizedQuestion && isEloConstructionTechnicalQuestion_(cleanQuestion)) {
      updateEloWorkMemoryFromMessage_(cleanQuestion);
    }

    if (!normalizedQuestion) {
      return {
        shortAnswer: "Digite uma dúvida para eu ajudar.",
        fullAnswer: "Posso responder sobre relatórios, PDF, RDO, fotos, materiais, planos e suporte.",
        nextAction: "Escolha um botão rápido ou escreva uma pergunta.",
        canSave: false
      };
    }

    if (isCrisisQuestion(normalizedQuestion)) {
      return getCrisisSupportResponse();
    }

    if (isEloWorkMemoryOnlyMessage_(cleanQuestion)) {
      return buildEloWorkMemorySavedAnswer_(cleanQuestion);
    }
    const workMemoryQuestion = buildEloWorkMemoryQuestionAnswer_(cleanQuestion);
    if (workMemoryQuestion) {
      return workMemoryQuestion;
    }

    const technicalProposalPackageAnswer = buildEloTechnicalProposalPackageResponse_(cleanQuestion);
    if (technicalProposalPackageAnswer) {
      return technicalProposalPackageAnswer;
    }
    const technicalSourcePreferenceAnswer = buildEloTechnicalSourcePreferenceAnswer_(cleanQuestion);
    if (technicalSourcePreferenceAnswer) {
      return technicalSourcePreferenceAnswer;
    }

    const genericPriceQuestionAnswer = buildEloGenericPriceQuestionAnswer_(cleanQuestion);
    if (genericPriceQuestionAnswer) {
      return genericPriceQuestionAnswer;
    }

    const multipleCompositionGuidanceAnswer = buildEloMultipleCompositionGuidanceAnswer_(cleanQuestion);
    if (multipleCompositionGuidanceAnswer) {
      return multipleCompositionGuidanceAnswer;
    }

    const naturalSimpleAnswer = buildEloNaturalSimpleAnswer_(cleanQuestion);
    if (naturalSimpleAnswer) {
      return naturalSimpleAnswer;
    }

    const paintingBudgetAnswer = buildEloPaintingBudgetBriefingAnswer_(cleanQuestion);
    if (paintingBudgetAnswer) {
      return paintingBudgetAnswer;
    }

    const pathologyAnswer = buildEloConstructionPathologyAnswer_(cleanQuestion);
    if (pathologyAnswer) {
      return pathologyAnswer;
    }
    const residentialBudgetPackageQuickAnswer = buildEloResidentialBudgetPackageQuickAnswer_(cleanQuestion);
    if (residentialBudgetPackageQuickAnswer) {
      rememberEloTechnicalProposalSource_(cleanQuestion, residentialBudgetPackageQuickAnswer, residentialBudgetPackageQuickAnswer.fullAnswer || residentialBudgetPackageQuickAnswer.shortAnswer || "");
      return residentialBudgetPackageQuickAnswer;
    }
    const wallCompletePackageQuickAnswer = buildEloWallCompletePackageQuickAnswer_(cleanQuestion);
    if (wallCompletePackageQuickAnswer) {
      rememberEloTechnicalProposalSource_(cleanQuestion, wallCompletePackageQuickAnswer, wallCompletePackageQuickAnswer.fullAnswer || wallCompletePackageQuickAnswer.shortAnswer || "");
      return wallCompletePackageQuickAnswer;
    }

    const foundationPackageQuickAnswer = buildEloFoundationPackageQuickAnswer_(cleanQuestion);
    if (foundationPackageQuickAnswer) {
      rememberEloTechnicalProposalSource_(cleanQuestion, foundationPackageQuickAnswer, foundationPackageQuickAnswer.fullAnswer || foundationPackageQuickAnswer.shortAnswer || "");
      return foundationPackageQuickAnswer;
    }
    const structuralPackageQuickAnswer = buildEloStructuralPackageQuickAnswer_(cleanQuestion);
    if (structuralPackageQuickAnswer) {
      rememberEloTechnicalProposalSource_(cleanQuestion, structuralPackageQuickAnswer, structuralPackageQuickAnswer.fullAnswer || structuralPackageQuickAnswer.shortAnswer || "");
      return structuralPackageQuickAnswer;
    }


    const geometryLayerAnswer = buildEloGeometryLayerAnswer_(cleanQuestion);
    if (geometryLayerAnswer) {
      return geometryLayerAnswer;
    }

    const premiseQuestion = buildEloPremiseQuestion_(cleanQuestion);
    if (premiseQuestion) {
      return premiseQuestion;
    }

    if (isEloHighLevelConstructionBudgetQuestion_(cleanQuestion)) {
      return buildEloConstructionTechnicalFallback_(cleanQuestion);
    }

    const wallRdoAnswer = buildEloWallRdoAnswer_(cleanQuestion);
    if (wallRdoAnswer) {
      return wallRdoAnswer;
    }

    const wallContinuationAnswer = buildEloWallContinuationAnswer_(cleanQuestion);
    if (wallContinuationAnswer) {
      return wallContinuationAnswer;
    }

    const consumptionAuditAnswer = buildEloConsumptionAuditAnswer_(cleanQuestion);
    if (consumptionAuditAnswer) {
      return consumptionAuditAnswer;
    }

    const wallServiceAnswer = buildEloWallServiceAnswer_(cleanQuestion);
    if (wallServiceAnswer) {
      return wallServiceAnswer;
    }

    const slabSafetyAnswer = buildEloSlabSafetyAnswer_(cleanQuestion);
    if (slabSafetyAnswer) {
      return slabSafetyAnswer;
    }

    const ambiguousMaterialAnswer = buildEloAmbiguousMaterialAnswer_(cleanQuestion);
    if (ambiguousMaterialAnswer) {
      return ambiguousMaterialAnswer;
    }

    const stockPurchaseAnswer = buildEloStockPurchaseAnswer_(cleanQuestion);
    if (stockPurchaseAnswer) {
      return stockPurchaseAnswer;
    }

    const onboardingConstructionAnswer = buildEloOnboardingConstructionAnswer_(cleanQuestion);
    if (onboardingConstructionAnswer) {
      return onboardingConstructionAnswer;
    }

    const technicalReportDraftAnswer = buildEloTechnicalReportDraftAnswer_(cleanQuestion);
    if (technicalReportDraftAnswer) {
      return technicalReportDraftAnswer;
    }

    const dailyWorkLogAnswer = buildEloDailyWorkLogAnswer_(cleanQuestion);
    if (dailyWorkLogAnswer) {
      return dailyWorkLogAnswer;
    }

    const operationalConstructionAnswer = buildEloOperationalConstructionAnswer_(cleanQuestion);
    if (operationalConstructionAnswer) {
      return operationalConstructionAnswer;
    }

    if (isEloConstructionTechnicalQuestion_(cleanQuestion)) {
      return buildEloConstructionTechnicalFallback_(cleanQuestion);
    }

    const operationalAnswer = buildEloOperationalAnswer(cleanQuestion, {
      screen: getCurrentScreenContext()
    });
    if (operationalAnswer) {
      return operationalAnswer;
    }

    const socialGreetingAnswer = getSocialGreetingResponse(cleanQuestion);
    if (socialGreetingAnswer) {
      return socialGreetingAnswer;
    }

    if (detectEloWakeCall(cleanQuestion)) {
      return buildEloWakeCallAnswer();
    }

    const narrativeMemoryAnswer = getNarrativeMemoryResponse(cleanQuestion);
    if (narrativeMemoryAnswer) {
      return narrativeMemoryAnswer;
    }

    const logicalReasoningAnswer = getLogicalReasoningResponse(cleanQuestion);
    if (logicalReasoningAnswer) {
      return logicalReasoningAnswer;
    }

    const journeyReportType = detectJourneyReportRequest(cleanQuestion);
    if (journeyReportType) {
      if (journeyReportType === "weekly") {
        return buildWeeklyJourneyReport();
      }
      if (journeyReportType === "monthly") {
        return buildMonthlyJourneyReport();
      }
      return buildJourneyReport();
    }

    const personalPatternAnswer = getPersonalPatternResponse(cleanQuestion);
    if (personalPatternAnswer) {
      return personalPatternAnswer;
    }

    const humanQuestionAnswer = getHumanQuestionResponse(cleanQuestion);
    if (humanQuestionAnswer) {
      return humanQuestionAnswer;
    }

    const conceptAnswer = getConceptResponse(cleanQuestion);
    if (conceptAnswer) {
      return conceptAnswer;
    }

    const philosophyAnswer = getPhilosophyResponse(cleanQuestion);
    if (philosophyAnswer) {
      return philosophyAnswer;
    }

    const connectedMemoryAnswer = answerConnectedMemoryQuestion(cleanQuestion);
    if (connectedMemoryAnswer) {
      return connectedMemoryAnswer;
    }

    const userProfileAnswer = answerUserProfileQuestion(cleanQuestion);
    if (userProfileAnswer) {
      return userProfileAnswer;
    }

    const importantMemoryAnswer = answerImportantMemoryQuestion(cleanQuestion);
    if (importantMemoryAnswer) {
      return importantMemoryAnswer;
    }

    const timelineAnswer = answerTimelineQuestion(cleanQuestion);
    if (timelineAnswer) {
      return timelineAnswer;
    }

    const extendedTimelineAnswer = buildTimelineAnswer(cleanQuestion);
    if (extendedTimelineAnswer) {
      return extendedTimelineAnswer;
    }

    const goalAnswer = answerGoalQuestion(cleanQuestion);
    if (goalAnswer) {
      return goalAnswer;
    }

    const projectAnswer = answerProjectQuestion(cleanQuestion);
    if (projectAnswer) {
      return projectAnswer;
    }

    const personalMemoryAnswer = answerPersonalMemoryQuestion(cleanQuestion);
    if (personalMemoryAnswer) {
      return personalMemoryAnswer;
    }

    if (isDailyRoutineQuestion(normalizedQuestion)) {
      return buildDailyRoutineResponse(cleanQuestion);
    }

    const localDocumentAnswer = answerFromLocalDocuments(cleanQuestion);
    if (localDocumentAnswer) {
      return localDocumentAnswer;
    }

    const eloLibraryAnswer = buildEloLibraryAnswer(cleanQuestion);
    if (eloLibraryAnswer) {
      return eloLibraryAnswer;
    }

    const libraryAnswer = answerFromLibrary(cleanQuestion);
    if (libraryAnswer) {
      return libraryAnswer;
    }

    const conversational = getConversationalResponse(normalizedQuestion);
    if (conversational) {
      return conversational;
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

    return answerWithEloCommunicationEngine(cleanQuestion);
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
      sessionIntent: "resumo_tela",
      diagnosticText: buildDiagnosticText(context, checklist)
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
        sessionIntent: "revisao_pdf",
        diagnosticText: buildDiagnosticText(context, checklist)
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
      sessionIntent: "revisao_pdf",
      diagnosticText: buildDiagnosticText(context, checklist)
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
      canSave: false,
      diagnosticText: buildDiagnosticText(context, checklist)
    };
  }

  function buildDiagnosticText(context, checklist) {
    const items = checklist && Array.isArray(checklist.items) ? checklist.items : [];
    const found = items.filter(function (item) { return item.done; });
    const pending = items.filter(function (item) { return !item.done; });
    const foundLines = found.length ? found.map(function (item) {
      return "✅ " + item.label;
    }) : ["⚠️ Nenhum item preenchido visível."];
    const pendingLines = pending.length ? pending.map(function (item) {
      return "⚠️ " + item.label;
    }) : ["✅ Nenhuma pendência visível."];
    const nextAction = checklist && checklist.nextAction ? checklist.nextAction : "➡️ Revise a tela atual antes de finalizar.";

    return [
      "DIAGNÓSTICO — ELO ASSISTENTE OBRAREPORT",
      "",
      "Contexto atual:",
      context && context.screen ? context.screen : "Tela atual não identificada",
      "",
      "Data/hora:",
      new Date().toLocaleString("pt-BR"),
      "",
      "Itens encontrados:",
      foundLines.join("\n"),
      "",
      "Pendências:",
      pendingLines.join("\n"),
      "",
      "Próximo passo recomendado:",
      nextAction,
      "",
      "Origem:",
      "Gerado pelo Elo Assistente ObraReport"
    ].join("\n");
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

  const ELO_CONVERSATION_INTENTS = [
    {
      intent: "saudacao",
      phrases: ["oi", "ola", "olá", "e ai", "e aí", "opa", "salve", "alo", "alô"]
    },
    {
      intent: "como_esta",
      phrases: ["como voce esta", "como você está", "como esta", "como está", "como vai", "tudo bem", "tudo certo", "voce esta bem", "você está bem", "tudo tranquilo", "como esta hoje"]
    },
    {
      intent: "agradecimento",
      phrases: ["obrigado", "obrigada", "valeu", "muito obrigado", "muito obrigada", "agradecido", "perfeito obrigado", "show obrigado"]
    },
    {
      intent: "despedida",
      phrases: ["tchau", "ate mais", "até mais", "ate logo", "até logo", "falou", "encerrar", "vou sair", "bom descanso", "boa noite ate amanha", "boa noite até amanhã"]
    },
    {
      intent: "identidade",
      phrases: ["quem e voce", "quem é você", "qual seu nome", "qual e seu nome", "qual é seu nome", "o que e o elo", "o que é o elo", "voce e quem", "você é quem", "quem esta falando", "quem está falando", "voce e uma pessoa", "você é uma pessoa", "voce e humano", "você é humano"]
    },
    {
      intent: "capacidades",
      phrases: ["o que voce faz", "o que você faz", "o que voce consegue fazer", "o que você consegue fazer", "em que voce ajuda", "em que você ajuda", "para que serve", "voce pode me ajudar", "você pode me ajudar", "como voce pode me ajudar", "como você pode me ajudar", "o que voce sabe sobre o obrareport", "o que você sabe sobre o obrareport"]
    },
    {
      intent: "funcionamento",
      phrases: ["como funciona o elo", "como voce funciona", "como você funciona", "como o elo funciona", "como usar o elo", "voce usa ia", "você usa ia"]
    },
    {
      intent: "apoio_pratico",
      phrases: ["estou cansado", "estou cansada", "estou com pressa", "estou perdido", "estou perdida", "nao entendi", "não entendi", "estou confuso", "estou confusa", "ta dificil", "tá difícil", "esta complicado", "está complicado"]
    }
  ];

  const ELO_CONVERSATION_VARIATION_STATE = {};

  function getConversationalResponse(normalizedQuestion) {
    const intent = detectConversationalIntent(normalizedQuestion);
    if (!intent) {
      return null;
    }

    const variant = chooseConversationVariant(intent, getConversationVariants()[intent] || getConversationVariants().saudacao);
    const adjustedVariant = isStandaloneMode() ? adaptConversationVariantForStandalone(variant, intent) : variant;
    const contextHint = getConversationContextHint(intent);
    const profileLine = intent === "saudacao" || intent === "apoio_pratico" || intent === "capacidades" ? getUserProfileContextLine() : "";

    return Object.assign({
      canSave: false,
      sessionIntent: "conversa_humana"
    }, adjustedVariant, {
      shortAnswer: personalizeConversationShortAnswer(adjustedVariant.shortAnswer, intent),
      fullAnswer: [adjustedVariant.fullAnswer, profileLine, contextHint.fullAnswer].filter(Boolean).join("\n\n"),
      nextAction: contextHint.nextAction || adjustedVariant.nextAction
    });
  }

  function adaptConversationVariantForStandalone(variant, intent) {
    const replacements = {
      saudacao: {
        shortAnswer: "Olá. Estou aqui para conversar, organizar ideias e acompanhar suas memórias locais.",
        fullAnswer: "Posso ajudar com projetos, objetivos, linha do tempo, biblioteca, conceitos humanos e reflexões simples.",
        nextAction: "Diga se quer conversar, registrar algo ou revisar seus projetos."
      },
      como_esta: {
        shortAnswer: "Estou funcionando normalmente por aqui.",
        fullAnswer: "Não tenho emoções ou consciência humana, mas consigo responder com calma e consultar suas informações locais autorizadas.",
        nextAction: "Quer organizar uma ideia, um projeto ou uma memória?"
      },
      identidade: {
        shortAnswer: "Eu sou o Elo, um assistente digital pessoal.",
        fullAnswer: "Não sou uma pessoa e não tenho consciência humana. Nesta página, funciono como companheiro digital local para conversar, organizar projetos, guardar memórias autorizadas e consultar conceitos.",
        nextAction: "Pergunte: o que você lembra de mim?"
      },
      capacidades: {
        shortAnswer: "Posso ajudar você a organizar ideias, projetos, memórias e próximos passos.",
        fullAnswer: "Também posso manter uma Biblioteca local, registrar Linha do Tempo, responder sobre conceitos humanos e consultar dados salvos apenas neste navegador.",
        nextAction: "Experimente: quais são meus projetos?"
      },
      funcionamento: {
        shortAnswer: "Eu funciono localmente neste navegador.",
        fullAnswer: "Uso regras, memórias autorizadas, Biblioteca, Projetos, Linha do Tempo e Conceitos. Não envio essa conversa para backend nesta versão.",
        nextAction: "Use Ferramentas do Elo para ver ou exportar seus dados locais."
      }
    };

    return Object.assign({}, variant, replacements[intent] || {});
  }

  function personalizeConversationShortAnswer(shortAnswer, intent) {
    if (intent === "saudacao" || intent === "apoio_pratico") {
      return prefixWithUserName(shortAnswer);
    }
    return shortAnswer;
  }

  function chooseConversationVariant(intent, variants) {
    const currentIndex = ELO_CONVERSATION_VARIATION_STATE[intent] || 0;
    ELO_CONVERSATION_VARIATION_STATE[intent] = currentIndex + 1;
    return variants[currentIndex % variants.length];
  }

  function getConversationVariants() {
    return {
      saudacao: [
        {
          shortAnswer: "Olá. Como posso ajudar você no ObraReport hoje?",
          fullAnswer: "Posso orientar relatórios, RDO, materiais, planos e revisão da tela atual.",
          nextAction: "Diga se quer revisar algo ou tirar uma dúvida.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Oi. Estou por aqui para ajudar com o ObraReport.",
          fullAnswer: "Consigo responder dúvidas, sugerir próximos passos e consultar documentos locais do Elo.",
          nextAction: "Você pode perguntar: o que devo fazer agora?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Olá. Quer revisar algo no sistema ou tirar uma dúvida?",
          fullAnswer: "Eu mantenho o foco no ObraReport: RDO, relatórios, PDF, materiais, planos e documentos locais.",
          nextAction: "Escolha uma área ou escreva sua dúvida.",
          sessionTheme: "suporte"
        }
      ],
      como_esta: [
        {
          shortAnswer: "Estou funcionando normalmente aqui no ObraReport.",
          fullAnswer: "Não tenho emoções ou consciência, mas consigo acompanhar a tela atual e responder de forma prática.",
          nextAction: "Quer que eu revise a tela atual?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Tudo certo por aqui. Posso te ajudar com o próximo passo.",
          fullAnswer: "Eu trabalho com regras locais, contexto da tela e bases salvas neste navegador.",
          nextAction: "Pergunte: o que falta preencher?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Estou pronto para ajudar no uso do ObraReport.",
          fullAnswer: "Posso orientar em passos curtos, sem mexer nos seus dados por conta própria.",
          nextAction: "Diga se precisa de ajuda com PDF, RDO ou materiais.",
          sessionTheme: "suporte"
        }
      ],
      agradecimento: [
        {
          shortAnswer: "De nada. Fico à disposição para ajudar no ObraReport.",
          fullAnswer: "Quando quiser, posso revisar RDO, relatório, PDF, materiais, planos ou documentos locais do Elo.",
          nextAction: "Você pode perguntar: o que devo fazer agora?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Por nada. Vamos mantendo o fluxo simples.",
          fullAnswer: "Se precisar, eu posso organizar a próxima ação em passos curtos.",
          nextAction: "Pergunte sobre a tela atual quando quiser.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Perfeito. Continuo aqui para apoiar o uso do ObraReport.",
          fullAnswer: "Posso revisar pendências, explicar recursos ou consultar sua base local.",
          nextAction: "Use uma pergunta direta, como: posso gerar PDF?",
          sessionTheme: "suporte"
        }
      ],
      despedida: [
        {
          shortAnswer: "Até mais. Quando voltar, posso continuar ajudando no ObraReport.",
          fullAnswer: "As informações locais do Elo ficam neste navegador. Para dados importantes, use as ferramentas de backup quando necessário.",
          nextAction: "Antes de sair, confira se salvou o que precisava no ObraReport.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Até logo. Bom trabalho com o ObraReport.",
          fullAnswer: "Eu não envio nada sozinho e não altero seus dados sem ação sua.",
          nextAction: "Quando voltar, pergunte: resuma esta tela.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Certo. Encerrando por aqui, sem alterar nada.",
          fullAnswer: "Se precisar retomar depois, posso ajudar com RDO, relatório, PDF e materiais.",
          nextAction: "Salve seu trabalho no ObraReport antes de fechar a página.",
          sessionTheme: "suporte"
        }
      ],
      identidade: [
        {
          shortAnswer: "Eu sou o Elo, assistente local do ObraReport.",
          fullAnswer: "Não sou uma pessoa nem tenho consciência. Sou um assistente digital do sistema para orientar uso, revisar informações visíveis e consultar bases locais.",
          nextAction: "Pergunte: o que você consegue fazer?",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Meu nome é Elo. Eu ajudo dentro do ObraReport.",
          fullAnswer: "Minha função é tornar o uso do sistema mais claro: relatórios, RDO, PDF, materiais, planos e documentos locais.",
          nextAction: "Pergunte sobre a tela atual ou sobre um recurso.",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Sou o assistente do ObraReport para suporte e orientação operacional.",
          fullAnswer: "Tenho um perfil calmo, educado, paciente e direto. Uso regras locais e contexto visível. Não sou IA em nuvem nesta versão.",
          nextAction: "Experimente perguntar: como funciona o Elo?",
          sessionTheme: "elo"
        }
      ],
      capacidades: [
        {
          shortAnswer: "Eu ajudo você a usar o ObraReport com mais clareza.",
          fullAnswer: "Consigo orientar relatórios, PDF, RDO, materiais, planos, revisar a tela atual, sugerir próximos passos e consultar documentos locais.",
          nextAction: "Experimente: resuma esta tela.",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Posso funcionar como um suporte rápido dentro do sistema.",
          fullAnswer: "Eu respondo dúvidas, faço checklists simples e ajudo a entender o que está pendente na tela atual.",
          nextAction: "Pergunte: o que falta preencher?",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Eu organizo dúvidas e próximos passos do ObraReport.",
          fullAnswer: "Também posso guardar memórias importantes locais e consultar textos adicionados em Documentos do Elo.",
          nextAction: "Abra Ferramentas do Elo para ver Biblioteca e Documentos.",
          sessionTheme: "elo"
        }
      ],
      funcionamento: [
        {
          shortAnswer: "O Elo funciona com regras locais, contexto da tela e dados salvos neste navegador.",
          fullAnswer: "Nesta fase, eu não uso backend, nuvem ou IA real. Leio o que está visível e consulto bases locais.",
          nextAction: "Abra Ferramentas do Elo para ver Biblioteca, Documentos, Memórias e Projetos.",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Eu funciono como uma camada de ajuda dentro do ObraReport.",
          fullAnswer: "Quando você pergunta, eu identifico a intenção, considero a tela atual e procuro em bases locais antes de responder.",
          nextAction: "Pergunte algo sobre PDF, RDO ou materiais.",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "O Elo é local e controlado nesta versão.",
          fullAnswer: "Nada é enviado para backend por esta conversa. As bases locais ficam no navegador.",
          nextAction: "Use Documentos do Elo para adicionar textos de consulta.",
          sessionTheme: "elo"
        }
      ],
      apoio_pratico: [
        {
          shortAnswer: "Entendi. Vamos simplificar.",
          fullAnswer: "Posso te orientar em passos curtos, sem tentar resolver tudo de uma vez.",
          nextAction: "Escolha um foco: PDF, RDO, materiais ou relatório.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Sem problema. Posso deixar isso mais direto.",
          fullAnswer: "Eu não faço aconselhamento emocional, mas posso reduzir o fluxo para uma próxima ação prática.",
          nextAction: "Pergunte: o que devo fazer agora?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Vamos por partes.",
          fullAnswer: "Se estiver com pressa, eu posso revisar rapidamente a tela atual e apontar só o próximo passo.",
          nextAction: "Pergunte: resuma esta tela.",
          sessionTheme: "suporte"
        }
      ]
    };
  }

  function getConversationContextHint(intent) {
    if (isStandaloneMode()) {
      return {};
    }

    const context = getCurrentScreenContext();
    const label = context.label;
    const hints = {
      "Diário de Obras": {
        fullAnswer: "Vejo que você está no Diário de Obras. Posso ajudar a revisar o RDO, materiais, produção ou pendências.",
        nextAction: "Pergunte: revisar RDO."
      },
      "Relatórios": {
        fullAnswer: "Você está na área de Relatórios. Posso ajudar a revisar antes do PDF ou verificar fotos e conclusão.",
        nextAction: "Pergunte: posso gerar PDF?"
      },
      "Planos": {
        fullAnswer: "Você está nos Planos. Posso explicar limites, contratação assistida ou plano Empresa.",
        nextAction: "Pergunte: qual plano escolher?"
      },
      "Dashboard": {
        fullAnswer: "Você está no Dashboard. Posso sugerir o próximo passo ou resumir os indicadores visíveis.",
        nextAction: "Pergunte: o que devo fazer agora?"
      },
      "Página do Cliente": {
        fullAnswer: "Você está na Página do Cliente. Posso ajudar a localizar relatórios, RDOs e documentos visíveis.",
        nextAction: "Pergunte: resuma esta tela."
      }
    };

    if (intent === "despedida" || intent === "identidade" || intent === "funcionamento") {
      return {};
    }

    return hints[label] || {};
  }

  function detectConversationalIntent(normalizedQuestion) {
    const compactQuestion = normalizedQuestion.replace(/[?!.,;:]+/g, "").trim();
    for (let index = 0; index < ELO_CONVERSATION_INTENTS.length; index += 1) {
      const group = ELO_CONVERSATION_INTENTS[index];
      const matched = group.phrases.some(function (phrase) {
        const normalizedPhrase = normalizeText(phrase);
        return compactQuestion === normalizedPhrase ||
          compactQuestion.indexOf(normalizedPhrase + " ") === 0 ||
          compactQuestion.indexOf(" " + normalizedPhrase + " ") >= 0;
      });
      if (matched) {
        return group.intent;
      }
    }
    return "";
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
    if (isStandaloneMode()) {
      return {
        label: "Elo pessoal",
        categories: ["suporte", "projetos", "biblioteca", "conceitos"]
      };
    }

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
    attachmentInput: null,
    attachmentButton: null,
    attachmentStatus: null,
    attachments: [],
    typingIndicator: null,
    activeRequestStartedAt: 0,
    contextLabel: null,
    suggestions: null,
    pendingSavePrompt: null,
    hasOpenedGreeting: false,
    awaitingStandaloneName: false
  };

  function buildWidget() {
    const standalone = isStandaloneMode();
    ELO_UI.root = createElement("aside", standalone ? "elo-widget elo-standalone-widget" : "elo-widget");
    ELO_UI.root.setAttribute("aria-label", standalone ? "Elo Web" : "Elo Assistente ObraReport");

    const floatButton = createElement("button", "elo-float-button");
    floatButton.type = "button";
    floatButton.setAttribute("aria-expanded", "false");
    floatButton.appendChild(createElement("span", "elo-float-icon", "E"));
    floatButton.appendChild(createElement("span", "", "Elo"));

    ELO_UI.panel = createElement("section", standalone ? "elo-panel elo-standalone-panel" : "elo-panel is-hidden");
    ELO_UI.panel.setAttribute("aria-label", standalone ? "Elo" : "Elo — Assistente ObraReport");

    const header = createElement("header", "elo-header");
    const headerText = createElement("div");
    headerText.appendChild(createElement("h2", "", standalone ? "Elo" : "Elo — Assistente ObraReport"));
    headerText.appendChild(createElement("p", "", standalone ? "Companheiro digital com memória, projetos, objetivos e linha do tempo." : "Eu lembro, procuro e te ajudo a usar o ObraReport."));
    ELO_UI.contextLabel = createElement("p", "elo-context-label");
    headerText.appendChild(ELO_UI.contextLabel);
    const closeButton = createElement("button", "elo-close-button", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Fechar Elo");
    header.appendChild(headerText);
    header.appendChild(closeButton);

    ELO_UI.messages = createElement("div", "elo-messages");
    ELO_UI.suggestions = createElement("div", "elo-context-suggestions");

    const standaloneActions = standalone ? buildStandalonePrimaryActions() : null;
    const footer = createElement("footer", "elo-footer");

    const inputRow = createElement("form", "elo-input-row");
    ELO_UI.input = createElement("input", "elo-input");
    ELO_UI.input.type = "text";
    ELO_UI.input.maxLength = 220;
    ELO_UI.input.placeholder = window.ELO_PRODUCT_MODE ? "Pergunte ao Elo..." : "Pergunte ao Elo";
    if (window.ELO_PRODUCT_MODE) {
      const attachmentControls = buildProductAttachmentControls();
      inputRow.appendChild(attachmentControls.button);
      inputRow.appendChild(attachmentControls.input);
    }
    const sendButton = createElement("button", "elo-send-button", "Enviar");
    sendButton.type = "submit";
    inputRow.appendChild(ELO_UI.input);
    inputRow.appendChild(sendButton);

    footer.appendChild(inputRow);
    if (window.ELO_PRODUCT_MODE) {
      ELO_UI.attachmentStatus = createElement("p", "elo-attachment-status");
      footer.appendChild(ELO_UI.attachmentStatus);
    }
    footer.appendChild(buildTools());

    ELO_UI.panel.appendChild(header);
    if (standaloneActions) {
      ELO_UI.panel.appendChild(standaloneActions);
    }
    ELO_UI.panel.appendChild(ELO_UI.messages);
    ELO_UI.panel.appendChild(ELO_UI.suggestions);
    ELO_UI.panel.appendChild(footer);
    if (!standalone) {
      ELO_UI.root.appendChild(floatButton);
    }
    ELO_UI.root.appendChild(ELO_UI.panel);
    const mount = standalone ? document.getElementById("eloStandaloneMount") : null;
    (mount || document.body).appendChild(ELO_UI.root);

    if (!standalone) {
      floatButton.addEventListener("click", function () {
        setPanelOpen(ELO_UI.panel.classList.contains("is-hidden"));
      });
      closeButton.addEventListener("click", function () {
        setPanelOpen(false);
      });
    } else {
      closeButton.classList.add("is-hidden");
    }
    inputRow.addEventListener("submit", function (event) {
      event.preventDefault();
      const question = ELO_UI.input.value;
      if (ELO_UI.attachments.length && !sanitizeUserText(question)) {
        appendProductAttachmentNotice();
      } else {
        askElo(question);
        if (ELO_UI.attachments.length) {
          appendProductAttachmentNotice();
        }
      }
      ELO_UI.input.value = "";
    });
    window.addEventListener("hashchange", updateScreenContext);

    updateScreenContext();
    if (standalone) {
      if (!window.ELO_PRODUCT_MODE) {
        appendMessage("system", buildStandaloneGreeting());
        ELO_UI.hasOpenedGreeting = true;
      }
      ELO_UI.awaitingStandaloneName = !getPreferredUserName();
      if (!window.ELO_DISABLE_AUTOFOCUS) {
        window.setTimeout(function () {
          ELO_UI.input.focus();
        }, 80);
      }
    } else {
      setPanelOpen(false);
    }
  }

  function buildStandalonePrimaryActions() {
    const actions = createElement("div", "elo-standalone-actions");
    [
      ["Limpar conversa", clearEloHistory],
      ["Minhas memórias", showPersonalMemories],
      ["Linha do tempo", showTimeline],
      ["Projetos", showProjects],
      ["Biblioteca", showLibrary]
    ].forEach(function (item) {
      const button = createElement("button", "elo-inline-button", item[0]);
      button.type = "button";
      button.addEventListener("click", item[1]);
      actions.appendChild(button);
    });
    return actions;
  }

  function buildStandaloneGreeting() {
    return buildPremiumWelcomeMessage_();
  }

  function updateScreenContext() {
    if (!ELO_UI.contextLabel) {
      return;
    }

    const context = getCurrentScreenContext();
    ELO_UI.contextLabel.textContent = (isStandaloneMode() ? "Modo atual: " : "Contexto atual: ") + context.label;
    renderContextSuggestions(context);
  }

  function renderContextSuggestions(context) {
    if (!ELO_UI.suggestions) {
      return;
    }

    ELO_UI.suggestions.innerHTML = "";
    const suggestions = getContextSuggestions(context).slice(0, 6);
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
    if (isStandaloneMode()) {
      return [
        { label: "CADISTA", question: "resuma nosso plano do CADISTA" },
        { label: "Stock Full", question: "resuma o projeto Stock Full" },
        { label: "Elo", question: "como evoluir o Elo" },
        { label: "Stock Saúde", question: "como controlar validade de medicamentos no Stock Saúde" },
        { label: "ObraReport", question: "resuma o plano do ObraReport" }
      ];
    }

    const route = String(window.location.hash || "").replace("#app/", "").split("/")[0];
    const suggestionMap = {
      Dashboard: [
        ["Me mostre o que você faz", "Me mostre o que você faz"],
        ["Quero criar um RDO", "Quero criar um RDO"],
        ["Quero lançar material", "Quero lançar material"],
        ["Quero gerar um PDF", "Quero gerar PDF"],
        ["O que priorizar?", "O que devo priorizar?"],
        ["O que lembra de mim?", "O que você lembra de mim?"]
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
        ["Como registrar materiais?", "Como registrar materiais?"],
        ["Gerar PDF", "Como gerar PDF?"]
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
    if (!isStandaloneMode()) {
      container.appendChild(buildQuickButtons());
    }

    const configureButton = createElement("button", "elo-inline-button", "Configurar meu Elo");
    configureButton.type = "button";
    configureButton.addEventListener("click", showUserProfileSetup);
    container.appendChild(configureButton);
    const importProfileButton = createElement("button", "elo-inline-button", "Importar perfil inicial");
    importProfileButton.type = "button";
    importProfileButton.addEventListener("click", showInitialProfileImport);
    container.appendChild(importProfileButton);
    const libraryButton = createElement("button", "elo-inline-button", "Biblioteca");
    libraryButton.type = "button";
    libraryButton.addEventListener("click", showLibrary);
    container.appendChild(libraryButton);
    const documentsButton = createElement("button", "elo-inline-button", "Biblioteca do Elo");
    documentsButton.type = "button";
    documentsButton.addEventListener("click", showLocalDocuments);
    container.appendChild(documentsButton);
    const realQuestionsButton = createElement("button", "elo-inline-button", "Perguntas reais");
    realQuestionsButton.type = "button";
    realQuestionsButton.addEventListener("click", showRealQuestions);
    container.appendChild(realQuestionsButton);
    const projectsButton = createElement("button", "elo-inline-button", "Projetos");
    projectsButton.type = "button";
    projectsButton.addEventListener("click", showProjects);
    container.appendChild(projectsButton);
    const importantMemoriesButton = createElement("button", "elo-inline-button", "Memórias importantes");
    importantMemoriesButton.type = "button";
    importantMemoriesButton.addEventListener("click", showImportantMemories);
    container.appendChild(importantMemoriesButton);
    const timelineButton = createElement("button", "elo-inline-button", "Linha do tempo");
    timelineButton.type = "button";
    timelineButton.addEventListener("click", showTimeline);
    container.appendChild(timelineButton);
    const philosophyButton = createElement("button", "elo-inline-button", "Filosofia");
    philosophyButton.type = "button";
    philosophyButton.addEventListener("click", showPhilosophy);
    container.appendChild(philosophyButton);
    const conceptsButton = createElement("button", "elo-inline-button", "Conceitos");
    conceptsButton.type = "button";
    conceptsButton.addEventListener("click", showConcepts);
    container.appendChild(conceptsButton);
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
      if (!ELO_UI.hasOpenedGreeting) {
        appendMessage("system", buildConnectedGreeting());
        ELO_UI.hasOpenedGreeting = true;
      }
      window.setTimeout(function () {
        ELO_UI.input.focus();
      }, 80);
    }
  }

  function askElo(question, attachments) {
    const cleanQuestion = sanitizeUserText(question);
    if (!cleanQuestion) {
      return;
    }
    const attachedFiles = Array.prototype.slice.call(attachments || []);

    appendMessage("user", cleanQuestion);
    markEloInteraction_("elo:send");
    appendTypingIndicator();

    const technicalProposalPackageAnswer = buildEloTechnicalProposalPackageResponse_(cleanQuestion);
    if (technicalProposalPackageAnswer) {
      const proposalAnswer = formatResponse(technicalProposalPackageAnswer);
      appendAssistantMessage(cleanQuestion, proposalAnswer, technicalProposalPackageAnswer.canSave !== false, technicalProposalPackageAnswer);
      saveConversation(cleanQuestion, proposalAnswer);
      rememberSessionTurn(cleanQuestion, technicalProposalPackageAnswer, proposalAnswer);
      clearProductAttachmentPreview();
      return;
    }
    const pathologyAnswer = buildEloConstructionPathologyAnswer_(cleanQuestion);
    if (pathologyAnswer) {
      return pathologyAnswer;
    }

    const residentialBudgetPackageQuickAnswer = buildEloResidentialBudgetPackageQuickAnswer_(cleanQuestion);
    if (residentialBudgetPackageQuickAnswer) {
      const residentialAnswer = formatResponse(residentialBudgetPackageQuickAnswer);
      appendAssistantMessage(cleanQuestion, residentialAnswer, residentialBudgetPackageQuickAnswer.canSave !== false, residentialBudgetPackageQuickAnswer);
      saveConversation(cleanQuestion, residentialAnswer);
      rememberSessionTurn(cleanQuestion, residentialBudgetPackageQuickAnswer, residentialAnswer);
      clearProductAttachmentPreview();
      return;
    }
    const wallCompletePackageQuickAnswer = buildEloWallCompletePackageQuickAnswer_(cleanQuestion);
    if (wallCompletePackageQuickAnswer) {
      const packageAnswer = formatResponse(wallCompletePackageQuickAnswer);
      appendAssistantMessage(cleanQuestion, packageAnswer, wallCompletePackageQuickAnswer.canSave !== false, wallCompletePackageQuickAnswer);
      saveConversation(cleanQuestion, packageAnswer);
      rememberSessionTurn(cleanQuestion, wallCompletePackageQuickAnswer, packageAnswer);
      clearProductAttachmentPreview();
      return;
    }

    const geometryLayerAnswer = buildEloGeometryLayerAnswer_(cleanQuestion);
    if (geometryLayerAnswer) {
      const geometryAnswer = formatResponse(geometryLayerAnswer);
      appendAssistantMessage(cleanQuestion, geometryAnswer, geometryLayerAnswer.canSave !== false, geometryLayerAnswer);
      saveConversation(cleanQuestion, geometryAnswer);
      rememberSessionTurn(cleanQuestion, geometryLayerAnswer, geometryAnswer);
      clearProductAttachmentPreview();
      return;
    }

    if (isEloHighLevelConstructionBudgetQuestion_(cleanQuestion)) {
      const technicalAnswer = buildEloConstructionTechnicalFallback_(cleanQuestion);
      const formattedTechnicalAnswer = formatResponse(technicalAnswer);
      appendAssistantMessage(cleanQuestion, formattedTechnicalAnswer, technicalAnswer.canSave !== false, technicalAnswer);
      saveConversation(cleanQuestion, formattedTechnicalAnswer);
      rememberSessionTurn(cleanQuestion, technicalAnswer, formattedTechnicalAnswer);
      clearProductAttachmentPreview();
      return;
    }

    const premiseQuestion = buildEloPremiseQuestion_(cleanQuestion);
    if (premiseQuestion) {
      const premiseAnswer = formatResponse(premiseQuestion);
      appendAssistantMessage(cleanQuestion, premiseAnswer, false, premiseQuestion);
      saveConversation(cleanQuestion, premiseAnswer);
      rememberSessionTurn(cleanQuestion, premiseQuestion, premiseAnswer);
      clearProductAttachmentPreview();
      return;
    }

    const immediateWallResponse = buildEloWallContinuationAnswer_(cleanQuestion) || buildEloWallServiceAnswer_(cleanQuestion);
    if (immediateWallResponse) {
      const immediateWallAnswer = formatResponse(immediateWallResponse);
      appendAssistantMessage(cleanQuestion, immediateWallAnswer, immediateWallResponse.canSave !== false, immediateWallResponse);
      saveConversation(cleanQuestion, immediateWallAnswer);
      rememberSessionTurn(cleanQuestion, immediateWallResponse, immediateWallAnswer);
      clearProductAttachmentPreview();
      return;
    }

    const stockIaPlanConfirmationAnswer = tryConfirmPendingStockIaPlan(cleanQuestion);
    if (stockIaPlanConfirmationAnswer) {
      const confirmationResponse = {
        shortAnswer: stockIaPlanConfirmationAnswer,
        fullAnswer: stockIaPlanConfirmationAnswer,
        nextAction: "A previsao ficou salva apenas como planejamento. Revise no Stock IA antes de qualquer baixa real.",
        canSave: false,
        sessionTheme: "stock_ia_planejamento"
      };
      appendAssistantMessage(cleanQuestion, stockIaPlanConfirmationAnswer, false, confirmationResponse);
      saveConversation(cleanQuestion, stockIaPlanConfirmationAnswer);
      rememberSessionTurn(cleanQuestion, confirmationResponse, stockIaPlanConfirmationAnswer);
      clearProductAttachmentPreview();
      return;
    }

    if (attachedFiles.length) {
      requestEloOnlineAnswer(cleanQuestion, attachedFiles).then(function (onlineAnswer) {
        if (onlineAnswer) {
          const onlineResponse = {
            shortAnswer: onlineAnswer,
            fullAnswer: onlineAnswer,
            nextAction: "Continue a conversa ou peça um resumo prático.",
            canSave: true,
            sessionTheme: "elo_online"
          };
          appendAssistantMessage(cleanQuestion, onlineAnswer, true, onlineResponse);
          saveConversation(cleanQuestion, onlineAnswer);
          rememberSessionTurn(cleanQuestion, onlineResponse, onlineAnswer);
          return;
        }
        appendProductAttachmentNotice();
      }).finally(function () {
        clearProductAttachmentPreview();
      });
      return;
    }

    if (isStandaloneMode() && ELO_UI.awaitingStandaloneName) {
      const name = detectStandaloneNameCapture_(cleanQuestion);
      if (name) {
        const currentProfile = getUserProfile();
        setUserProfile(Object.assign({}, currentProfile, { userName: name }));
        ELO_UI.awaitingStandaloneName = false;
        const answer = "Perfeito, vou chamar você de " + name + ". Posso ajudar a organizar ideias, projetos, memórias, biblioteca ou linha do tempo.";
        appendAssistantMessage(cleanQuestion, answer, false, {
          shortAnswer: answer,
          fullAnswer: "Esse nome ficou salvo apenas neste navegador.",
          nextAction: "Diga o que você quer organizar agora.",
          canSave: false,
          sessionTheme: "perfil"
        });
        saveConversation(cleanQuestion, answer);
        rememberSessionTurn(cleanQuestion, { sessionTheme: "perfil", nextAction: "Diga o que você quer organizar agora." }, answer);
        return;
      }
      if (isStandaloneNameCaptureAttempt_(cleanQuestion) && !shouldBypassStandaloneNameCapture_(cleanQuestion)) {
        const socialResponse = getSocialGreetingResponse(cleanQuestion);
        const response = socialResponse || {
          shortAnswer: "Tudo bem.",
          fullAnswer: "Ainda não vou usar isso como nome. Quando quiser, me diga apenas como devo chamar você.",
          nextAction: "Você pode responder só com seu nome, por exemplo: Ícaro.",
          canSave: false,
          sessionTheme: "perfil"
        };
        const answer = formatResponse(response);
        appendAssistantMessage(cleanQuestion, answer, false, response);
        saveConversation(cleanQuestion, answer);
        rememberSessionTurn(cleanQuestion, response, answer);
        return;
      }
    }

    const directNameIntent = detectUserNameSave_(cleanQuestion);
    if (directNameIntent) {
      const nameMemoryCandidate = detectEloLongTermMemoryCommand(cleanQuestion);
      if (nameMemoryCandidate) {
        saveEloLongTermMemory(nameMemoryCandidate);
      }
      const response = buildSaveUserNameAnswer_(cleanQuestion);
      const answer = formatResponse(response);
      appendAssistantMessage(cleanQuestion, answer, false, response);
      saveConversation(cleanQuestion, answer);
      rememberSessionTurn(cleanQuestion, response, answer);
      return;
    }

    const forgetMemoryCommand = detectEloForgetCommand(cleanQuestion);
    if (forgetMemoryCommand) {
      const result = removeEloLongTermMemory(forgetMemoryCommand);
      const answer = result.removed
        ? "Pronto, apaguei essa memória permanente deste navegador."
        : "Não encontrei uma memória permanente correspondente para apagar.";
      const response = {
        shortAnswer: answer,
        fullAnswer: result.memories.length ? result.memories.map(function (item) {
          return item.text;
        }).join("\n") : answer,
        nextAction: "Quando quiser, você pode me pedir para lembrar outra informação importante.",
        canSave: false,
        sessionTheme: "memoria",
        sessionIntent: "memoria_permanente"
      };
      appendAssistantMessage(cleanQuestion, answer, false, response);
      saveConversation(cleanQuestion, answer);
      rememberSessionTurn(cleanQuestion, response, answer);
      return;
    }

    const longTermMemoryCandidate = detectEloLongTermMemoryCommand(cleanQuestion);
    if (longTermMemoryCandidate) {
      const memoryItem = saveEloLongTermMemory(longTermMemoryCandidate);
      const answer = memoryItem
        ? "Guardei isso na memória permanente deste navegador: " + memoryItem.text + "."
        : "Não consegui guardar essa memória agora.";
      const response = {
        shortAnswer: answer,
        fullAnswer: memoryItem ? "Categoria: " + memoryItem.category + ". Importância: " + memoryItem.importance + "." : answer,
        nextAction: "Pode recarregar a página e me perguntar o que eu lembro.",
        canSave: false,
        sessionTheme: "memoria",
        sessionIntent: "memoria_permanente"
      };
      appendAssistantMessage(cleanQuestion, answer, false, response);
      saveConversation(cleanQuestion, answer);
      rememberSessionTurn(cleanQuestion, response, answer);
      return;
    }

    if (isCrisisQuestion(normalizeText(cleanQuestion))) {
      const crisisResponse = getCrisisSupportResponse();
      const answer = formatResponse(crisisResponse);
      appendAssistantMessage(cleanQuestion, answer, false, crisisResponse);
      saveConversation(cleanQuestion, answer);
      rememberSessionTurn(cleanQuestion, crisisResponse, answer);
      return;
    }

    const timelineLetter = detectTimelineLetterCommand(cleanQuestion);
    if (timelineLetter) {
      const result = saveTimelineEvent(timelineLetter);
      const answer = result.ok ? "Guardei sua carta para o futuro." : "Por segurança, não consegui guardar essa carta. Confira se ela não contém dados sensíveis.";
      appendAssistantMessage(cleanQuestion, answer, false, {
        shortAnswer: answer,
        fullAnswer: result.ok ? "Ela ficou salva apenas neste navegador, na Linha do Tempo do Elo. Ainda não há lembrete automático." : "A Linha do Tempo não salva senhas, CPF, cartão, tokens, chaves API ou dados bancários.",
        nextAction: "Abra Ferramentas do Elo > Linha do tempo para revisar.",
        canSave: false,
        sessionTheme: "timeline"
      });
      saveConversation(cleanQuestion, answer);
      rememberSessionTurn(cleanQuestion, {
        nextAction: "Abra Linha do tempo para revisar a carta.",
        sessionIntent: "timeline"
      }, answer);
      return;
    }

    const decisionCandidate = buildDecisionSuggestion(cleanQuestion);
    if (decisionCandidate) {
      appendTimelineEventPrompt(cleanQuestion, decisionCandidate);
      saveConversation(cleanQuestion, "O Elo perguntou se deve registrar uma decisao na Linha do Tempo.");
      rememberSessionTurn(cleanQuestion, {
        nextAction: "Escolha Registrar ou Nao registrar.",
        sessionIntent: "decision_timeline"
      }, "O Elo perguntou se deve registrar uma decisao na Linha do Tempo.");
      return;
    }

    const timelineCandidate = detectTimelineEventCandidate(cleanQuestion);
    if (timelineCandidate) {
      appendTimelineEventPrompt(cleanQuestion, timelineCandidate);
      saveConversation(cleanQuestion, "O Elo perguntou se deve registrar um evento na Linha do Tempo.");
      rememberSessionTurn(cleanQuestion, {
        nextAction: "Escolha Registrar ou Não registrar.",
        sessionIntent: "timeline"
      }, "O Elo perguntou se deve registrar um evento na Linha do Tempo.");
      return;
    }

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

    const importantMemoryCandidate = detectImportantMemoryCandidate(cleanQuestion);
    if (importantMemoryCandidate) {
      appendImportantMemoryPrompt(cleanQuestion, importantMemoryCandidate);
      saveConversation(cleanQuestion, "O Elo perguntou se deve guardar uma memória importante.");
      rememberSessionTurn(cleanQuestion, {
        nextAction: "Escolha se deseja guardar como projeto, objetivo ou preferência.",
        sessionIntent: "memoria_importante"
      }, "O Elo perguntou se deve guardar uma memória importante.");
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

    requestEloOnlineAnswer(cleanQuestion, attachedFiles).then(function (onlineAnswer) {
      if (onlineAnswer) {
        const onlineResponse = {
          shortAnswer: onlineAnswer,
          fullAnswer: onlineAnswer,
          nextAction: "Continue a conversa ou peça um resumo prático.",
          canSave: true,
          sessionTheme: "elo_online"
        };
        appendAssistantMessage(cleanQuestion, onlineAnswer, true, onlineResponse);
        saveConversation(cleanQuestion, onlineAnswer);
        rememberSessionTurn(cleanQuestion, onlineResponse, onlineAnswer);
        if (attachedFiles.length) {
          clearProductAttachmentPreview();
        }
        return;
      }

      if (attachedFiles.length) {
        appendProductAttachmentNotice();
        return;
      }

      const response = buildEloLocalFallbackResponseForQuestion_(cleanQuestion);
      const answer = formatResponse(response);
      response.realQuestionId = registerRealQuestion(cleanQuestion, answer, response);
      appendAssistantMessage(cleanQuestion, answer, response.canSave !== false, response);
      saveConversation(cleanQuestion, answer);
      rememberSessionTurn(cleanQuestion, response, answer);
    });
  }

  // ELO_LOCAL_FALLBACK
  // Keep this path small and explicit so it does not compete with successful backend responses.
  function buildEloLocalFallbackResponseForQuestion_(question) {
    if (isEloOfficialProjectQuestion_(question)) {
      return buildEloOnlineUnavailableResponse_();
    }

    const memoryRecallAnswer = isEloLongTermMemoryQuestion(question) ? buildEloLongTermMemoryAnswer(question) : "";
    if (memoryRecallAnswer) {
      return {
        shortAnswer: memoryRecallAnswer,
        fullAnswer: memoryRecallAnswer,
        nextAction: "Me diga se devo guardar, corrigir ou esquecer alguma informação.",
        canSave: false,
        sessionTheme: "memoria",
        sessionIntent: "memoria_permanente"
      };
    }

    const wallContinuationResponse = buildEloWallContinuationAnswer_(question);
    if (wallContinuationResponse) {
      return wallContinuationResponse;
    }

    const wallServiceResponse = buildEloWallServiceAnswer_(question);
    if (wallServiceResponse) {
      return wallServiceResponse;
    }

    const stockBalanceResponse = buildEloStockBalanceAnswer_(question);
    if (stockBalanceResponse) {
      return stockBalanceResponse;
    }

    const operationalConstructionResponse = buildEloOperationalConstructionAnswer_(question);
    if (operationalConstructionResponse) {
      return operationalConstructionResponse;
    }

    return applyEloCommunicationLayer(question, buildResponse(question));
  }

  // ELO_ATTACHMENTS
  function buildProductAttachmentControls() {
    const button = createElement("button", "elo-attach-button", "Anexar");
    button.type = "button";
    button.setAttribute("aria-label", "Anexar PDF, planilha ou imagem");
    button.title = "Anexar PDF, planilha ou imagem";
    ELO_UI.attachmentButton = button;

    const input = createElement("input", "elo-attachment-input");
    input.type = "file";
    input.multiple = true;
    input.accept = [
      "application/pdf",
      ".pdf",
      ".xls",
      ".xlsx",
      ".csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "image/*"
    ].join(",");
    ELO_UI.attachmentInput = input;

    button.addEventListener("click", function () {
      input.click();
    });

    input.addEventListener("change", function () {
      ELO_UI.attachments = Array.prototype.slice.call(input.files || []).slice(0, 6);
      renderProductAttachmentStatus();
    });

    return { button: button, input: input };
  }

  function renderProductAttachmentStatus() {
    const preview = document.querySelector("[data-elo-attachment-preview]");
    const iconEl = document.querySelector(".elo-attachment-icon");
    const nameEl = document.querySelector("[data-elo-attachment-name]");
    const sizeEl = document.querySelector("[data-elo-attachment-size]");
    const removeButton = document.querySelector("[data-elo-attachment-remove]");

    if (removeButton && !removeButton.dataset.eloPreviewBound) {
      removeButton.dataset.eloPreviewBound = "true";
      removeButton.addEventListener("click", function () {
        clearProductAttachmentPreview();
      });
    }

    if (!ELO_UI.attachments.length) {
      if (ELO_UI.attachmentStatus) {
        ELO_UI.attachmentStatus.textContent = "";
      }
      if (preview) {
        preview.classList.remove("is-visible");
      }
      if (iconEl) {
        iconEl.textContent = "▣";
      }
      if (nameEl) {
        nameEl.textContent = "";
      }
      if (sizeEl) {
        sizeEl.textContent = "";
      }
      if (ELO_UI.attachmentButton) {
        ELO_UI.attachmentButton.classList.remove("is-attached");
        ELO_UI.attachmentButton.textContent = "Anexar";
      }
      return;
    }
    const file = ELO_UI.attachments[0];
    const isImage = isEloImageAttachment_(file);
    if (ELO_UI.attachmentStatus) {
      ELO_UI.attachmentStatus.textContent = isImage ? "Imagem carregada. Pronta para analise." : "";
    }
    if (preview) {
      preview.classList.add("is-visible");
    }
    if (iconEl) {
      iconEl.textContent = isImage ? "📷" : "▣";
    }
    if (nameEl) {
      nameEl.textContent = file.name;
    }
    if (sizeEl) {
      sizeEl.textContent = "· " + formatProductFileSize(file.size);
    }
    if (ELO_UI.attachmentButton) {
      ELO_UI.attachmentButton.classList.add("is-attached");
      ELO_UI.attachmentButton.textContent = "Anexado";
    }
  }

  function formatProductFileSize(bytes) {
    if (!bytes && bytes !== 0) {
      return "";
    }
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return size.toFixed(unitIndex === 0 ? 0 : 1).replace(".", ",") + " " + units[unitIndex];
  }

  function clearProductAttachmentPreview() {
    ELO_UI.attachments = [];
    if (ELO_UI.attachmentInput) {
      ELO_UI.attachmentInput.value = "";
    }
    renderProductAttachmentStatus();
  }

  function appendProductAttachmentNotice() {
    const names = ELO_UI.attachments.map(function (file) { return file.name; }).join(", ");
    appendMessage("system", "Anexo recebido na interface: " + names + ". Nao consegui processar este arquivo agora. PDFs com texto e arquivos TXT/CSV/MD dependem do backend do Elo; imagens usam a analise visual quando disponivel.");
    ELO_UI.attachments = [];
    if (ELO_UI.attachmentInput) {
      ELO_UI.attachmentInput.value = "";
    }
    renderProductAttachmentStatus();
  }

  function getEloAttachmentExtension_(file) {
    const name = file && file.name ? String(file.name) : "";
    const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function isEloImageAttachment_(file) {
    if (!file) {
      return false;
    }
    const type = String(file.type || "").toLowerCase();
    const extension = getEloAttachmentExtension_(file);
    return type === "image/jpeg" ||
      type === "image/jpg" ||
      type === "image/png" ||
      type === "image/webp" ||
      extension === "jpg" ||
      extension === "jpeg" ||
      extension === "jfif" ||
      extension === "png" ||
      extension === "webp";
  }

  function detectAttachmentIntent(question) {
    const attachments = ELO_UI.attachments || [];
    const image = attachments.find(isEloImageAttachment_);
    const attachmentIntent = image
      ? { type: "image", file: image }
      : { type: "text" };

    return attachmentIntent;
  }

  function loadEloImage_(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
        return loadEloImageElement_(file);
      });
    }
    return loadEloImageElement_(file);
  }

  function loadEloImageElement_(file) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };

      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Nao foi possivel ler a imagem anexada."));
      };

      image.src = objectUrl;
    });
  }

  function eloCanvasToBlob_(canvas, mimeType, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error("Nao foi possivel comprimir a imagem."));
          return;
        }
        resolve(blob);
      }, mimeType, quality);
    });
  }

  function eloBlobToBase64_(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || "").replace(/^data:[^;]+;base64,/, ""));
      };
      reader.onerror = function () {
        reject(new Error("Nao foi possivel converter a imagem para base64."));
      };
      reader.readAsDataURL(blob);
    });
  }

  function safeEloImageFileName_(file) {
    const name = file && file.name ? String(file.name) : "imagem";
    const baseName = name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "imagem";
    return baseName + ".jpg";
  }

  async function compressEloImageAttachment_(file) {
    if (!isEloImageAttachment_(file)) {
      throw new Error("Arquivo nao permitido. Use JPG, PNG ou WEBP.");
    }

    const config = window.RELATORIO_QUALIDADE_CONFIG || {};
    const sourceImage = await loadEloImage_(file);
    const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
    const sourceHeight = sourceImage.naturalHeight || sourceImage.height;

    if (!sourceWidth || !sourceHeight) {
      throw new Error("Nao foi possivel ler o tamanho da imagem.");
    }

    const maxSide = config.maxImageWidth || 1280;
    const maxPixels = config.maxImagePixels || 1638400;
    const sideRatio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const pixelRatio = Math.min(1, Math.sqrt(maxPixels / (sourceWidth * sourceHeight)));
    const ratio = Math.min(sideRatio, pixelRatio);
    const width = Math.max(1, Math.round(sourceWidth * ratio));
    const height = Math.max(1, Math.round(sourceHeight * ratio));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    canvas.width = width;
    canvas.height = height;

    if (!context) {
      throw new Error("O navegador nao conseguiu preparar a imagem.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceImage, 0, 0, width, height);

    if (typeof sourceImage.close === "function") {
      sourceImage.close();
    }

    const blob = await eloCanvasToBlob_(canvas, "image/jpeg", config.jpegQuality || 0.72);
    return {
      base64: await eloBlobToBase64_(blob),
      mimeType: "image/jpeg",
      fileName: safeEloImageFileName_(file),
      originalName: file.name || "imagem.jpg",
      width: width,
      height: height
    };
  }

  function formatEloImageAnalysis_(result) {
    if (!result) {
      return "Nao recebi uma resposta valida da analise visual.";
    }
    if (typeof result === "string") {
      return result;
    }

    const parts = [];
    if (result.title) {
      parts.push(String(result.title));
    }
    if (result.suggestion) {
      parts.push(String(result.suggestion));
    }
    if (result.note) {
      parts.push(String(result.note));
    }
    return parts.join("\n\n") || "Imagem analisada, mas a resposta veio sem conteudo textual.";
  }

  function updateEloMessage_(message, text) {
    const bubble = message && message.querySelector ? message.querySelector(".elo-message-bubble") : null;
    if (bubble) {
      bubble.textContent = text;
    }
    if (ELO_UI.messages) {
      ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
    }
  }

  async function analyzeEloImageAttachment_(question, file) {
    const cleanQuestion = sanitizeUserText(question) || "Elo, analise esta imagem";
    appendMessage("system", "Imagem anexada: " + (file.name || "imagem.jpg"));
    appendMessage("user", cleanQuestion);
    const statusMessage = appendMessage("assistant", "Analisando imagem...");

    try {
      const imagePayload = await compressEloImageAttachment_(file);
      const context = {
        source: "elo",
        kind: "elo-image-analysis",
        question: cleanQuestion,
        imageLabel: file.name || "imagem anexada"
      };
      let result = null;

      if (window.ObraReportAI && typeof window.ObraReportAI.analyzeImage === "function") {
        result = await window.ObraReportAI.analyzeImage(imagePayload, context);
      } else {
        const configuredEndpoint = (window.RELATORIO_QUALIDADE_CONFIG && window.RELATORIO_QUALIDADE_CONFIG.aiImageAnalysisUrl) ||
          getEloBackendEndpoint_("/api/ai/analyze-image");
        const response = await fetch(configuredEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: imagePayload, context: context })
        });
        result = await response.json();
      }

      const answer = formatEloImageAnalysis_(result);
      updateEloMessage_(statusMessage, answer);
      saveConversation(cleanQuestion, answer);
      rememberSessionTurn(cleanQuestion, {
        sessionTheme: "analise-visual",
        nextAction: "Valide a analise visual com o responsavel tecnico."
      }, answer);
    } catch (error) {
      updateEloMessage_(statusMessage, error && error.message ? error.message : "Nao consegui analisar a imagem agora.");
    } finally {
      ELO_UI.attachments = [];
      if (ELO_UI.attachmentInput) {
        ELO_UI.attachmentInput.value = "";
      }
      renderProductAttachmentStatus();
    }
  }

  function appendMessage(kind, text) {
    if (kind !== "user") {
      removeTypingIndicator();
    }
    const message = createElement("article", "elo-message " + kind);
    const bubble = createElement("div", "elo-message-bubble", text);
    message.appendChild(bubble);
    ELO_UI.messages.appendChild(message);
    if (ELO_UI.panel) {
      ELO_UI.panel.classList.add("is-chat-active");
    }
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
    return message;
  }

  function appendTypingIndicator() {
    removeTypingIndicator();
    if (!ELO_UI.messages) {
      return null;
    }

    const message = createElement("article", "elo-message assistant is-typing");
    message.setAttribute("aria-live", "polite");
    message.setAttribute("data-elo-typing", "true");
    const bubble = createElement("div", "elo-message-bubble elo-typing-bubble");
    const label = createElement("span", "elo-typing-label", "Elo está pensando");
    const dots = createElement("span", "elo-typing-dots");
    [0, 1, 2].forEach(function () {
      dots.appendChild(createElement("span", ""));
    });

    bubble.appendChild(label);
    bubble.appendChild(dots);
    message.appendChild(bubble);
    ELO_UI.messages.appendChild(message);
    if (ELO_UI.panel) {
      ELO_UI.panel.classList.add("is-chat-active");
    }
    ELO_UI.typingIndicator = message;
    ELO_UI.activeRequestStartedAt = nowEloPerformance_();
    markEloInteraction_("elo:typing-visible");
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
    return message;
  }

  function removeTypingIndicator() {
    if (ELO_UI.typingIndicator && ELO_UI.typingIndicator.parentNode) {
      ELO_UI.typingIndicator.remove();
    }
    ELO_UI.typingIndicator = null;
  }

  function nowEloPerformance_() {
    return window.performance && typeof window.performance.now === "function"
      ? window.performance.now()
      : Date.now();
  }

  function markEloInteraction_(name) {
    if (window.performance && typeof window.performance.mark === "function") {
      try {
        window.performance.mark(name);
      } catch (error) {
        // Performance marks are diagnostic only.
      }
    }
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

  function appendImportantMemoryPrompt(question, candidate) {
    return appendImportantMemoryPromptV2(question, candidate);
  }

  function appendImportantMemoryPromptV2(question, candidate) {
    const typeLabel = {
      projeto: "projeto",
      objetivo: "objetivo",
      preferencia: "preferencia"
    };
    const suggestion = buildMemorySuggestion(question) || candidate;
    const message = appendMessage(
      "assistant",
      [
        "Isso parece importante.",
        "",
        "Posso guardar como:",
        "- memoria",
        "- ideia",
        "- projeto",
        "- objetivo",
        "- roadmap",
        "",
        "Sugestao:",
        suggestion.summary || candidate.descricao || candidate.titulo,
        "",
        "Deseja guardar como projeto, objetivo, preferencia ou registrar como marco da Linha do Tempo?"
      ].join("\n")
    );
    const actions = createElement("div", "elo-message-actions");
    const options = [
      ["projeto", "Guardar como projeto"],
      ["objetivo", "Guardar como objetivo"],
      ["preferencia", "Guardar como preferencia"]
    ];
    const buttons = [];

    options.forEach(function (option) {
      const button = createElement("button", "elo-inline-button", option[1]);
      button.type = "button";
      button.addEventListener("click", function () {
        const result = saveImportantMemorySuggestion(candidate, option[0]);
        buttons.forEach(function (item) {
          item.disabled = true;
        });
        if (result.ok) {
          appendMessage("system", "Memoria importante salva como " + typeLabel[option[0]] + ": " + result.item.titulo + ".");
        } else {
          appendMessage("system", "Por seguranca, nao vou guardar esse tipo de informacao.");
        }
      });
      buttons.push(button);
      actions.appendChild(button);
    });

    const timelineButton = createElement("button", "elo-inline-button", "Registrar marco");
    const cancelButton = createElement("button", "elo-inline-button", "Nao guardar");
    timelineButton.type = "button";
    cancelButton.type = "button";
    timelineButton.addEventListener("click", function () {
      const result = addEloTimelineEvent({
        type: candidate.tipo === "projeto" ? "ideia" : "objetivo",
        title: candidate.titulo,
        content: candidate.descricao || candidate.sourceQuestion || candidate.titulo,
        project: detectTimelineProject(normalizeText(candidate.sourceQuestion || candidate.descricao || candidate.titulo)),
        importance: "media",
        tags: [candidate.tipo, candidate.suggestedKind || "memoria"],
        source: "memoria_importante_confirmada"
      });
      buttons.concat([timelineButton, cancelButton]).forEach(function (item) {
        item.disabled = true;
      });
      appendMessage("system", result.ok ? "Marco registrado na Linha do Tempo." : "Nao consegui registrar esse marco.");
    });
    cancelButton.addEventListener("click", function () {
      buttons.concat([timelineButton, cancelButton]).forEach(function (item) {
        item.disabled = true;
      });
      appendMessage("system", "Tudo bem. Nao vou guardar essa memoria importante.");
    });
    buttons.push(timelineButton);
    buttons.push(cancelButton);
    actions.appendChild(timelineButton);
    actions.appendChild(cancelButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function appendTimelineEventPrompt(question, candidate) {
    const message = appendMessage(
      "assistant",
      "Isso parece importante. Deseja registrar na sua Linha do Tempo?\n\n" +
      "Tipo sugerido: " + formatTimelineType(candidate.type) + "\n" +
      "Projeto: " + (candidate.project || "não identificado") + "\n" +
      "Humor: " + (candidate.mood || "neutro") + "\n" +
      "Importância: " + candidate.importance
    );
    const actions = createElement("div", "elo-message-actions");
    const registerButton = createElement("button", "elo-inline-button", "Registrar");
    const cancelButton = createElement("button", "elo-inline-button", "Não registrar");

    registerButton.type = "button";
    cancelButton.type = "button";

    registerButton.addEventListener("click", function () {
      const result = saveTimelineEvent(candidate);
      registerButton.disabled = true;
      cancelButton.disabled = true;
      if (result.ok) {
        appendMessage("system", "Registrei isso na sua Linha do Tempo.");
      } else {
        appendMessage("system", "Por segurança, não consegui registrar esse evento.");
      }
    });

    cancelButton.addEventListener("click", function () {
      registerButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "Tudo bem. Não registrei.");
    });

    actions.appendChild(registerButton);
    actions.appendChild(cancelButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function appendTrainingSuggestion(realQuestion) {
    const message = appendMessage("system", "Quer registrar esta pergunta para melhorar o Elo depois?");
    const actions = createElement("div", "elo-message-actions");
    const yesButton = createElement("button", "elo-inline-button", "Sim, guardar para treino");
    const noButton = createElement("button", "elo-inline-button", "Não agora");

    yesButton.type = "button";
    noButton.type = "button";
    yesButton.addEventListener("click", function () {
      markRealQuestionForTraining(realQuestion.id);
      yesButton.disabled = true;
      noButton.disabled = true;
      appendMessage("system", "Pergunta marcada para treinamento manual local. Ela não altera a base do Elo sem revisão.");
    });
    noButton.addEventListener("click", function () {
      yesButton.disabled = true;
      noButton.disabled = true;
      appendMessage("system", "Tudo bem. Não vou marcar essa pergunta para treino agora.");
    });

    actions.appendChild(yesButton);
    actions.appendChild(noButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function copyDiagnosticToClipboard(diagnosticText, button) {
    const originalLabel = button.textContent;
    copyTextToClipboard(diagnosticText).then(function () {
      button.textContent = "✅ Diagnóstico copiado";
    }).catch(function () {
      button.textContent = "⚠️ Copiar manualmente";
      appendMessage("system", "⚠️ Não consegui copiar automaticamente. Selecione e copie o texto manualmente.\n\n" + diagnosticText);
    }).finally(function () {
      window.setTimeout(function () {
        button.textContent = originalLabel;
      }, 2600);
    });
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        return copyTextWithTemporaryTextarea(text);
      });
    }

    return copyTextWithTemporaryTextarea(text);
  }

  function copyTextWithTemporaryTextarea(text) {
    return new Promise(function (resolve, reject) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      try {
        if (document.execCommand("copy")) {
          resolve();
        } else {
          reject(new Error("copy_failed"));
        }
      } catch (error) {
        reject(error);
      } finally {
        textarea.remove();
      }
    });
  }

  function appendAssistantMessage(question, answer, canSave, response) {
    markEloInteraction_("elo:answer-visible");
    const cleanAnswer = sanitizeEloAnswerForDisplay(answer);
    const pendingSavePrompt = response && response.savePrompt !== undefined
      ? normalizeEloSavePrompt(response.savePrompt)
      : ELO_UI.pendingSavePrompt;
    if (response) {
      response.savePrompt = pendingSavePrompt;
    }
    ELO_UI.pendingSavePrompt = null;

    const message = appendMessage("assistant", cleanAnswer);
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

    if (response && response.localDocumentResult) {
      const documentButton = createElement("button", "elo-inline-button", "Ver documento local");
      documentButton.type = "button";
      documentButton.addEventListener("click", function () {
        appendMessage("system", response.localDocumentResult.document.title + "\n\n" + response.localDocumentResult.document.text);
      });
      actions.appendChild(documentButton);
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
      appendEloSavePrompt(message, question, cleanAnswer, response);
    }

    if (response && response.diagnosticText) {
      const copyDiagnosticButton = createElement("button", "elo-inline-button elo-copy-diagnostic-button", "📋 Copiar Diagnóstico");
      copyDiagnosticButton.type = "button";
      copyDiagnosticButton.addEventListener("click", function () {
        copyDiagnosticToClipboard(response.diagnosticText, copyDiagnosticButton);
      });
      actions.appendChild(copyDiagnosticButton);
    }

    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function appendEloSavePrompt(message, question, answer, response) {
    const apiDecision = normalizeEloSavePrompt(response && response.savePrompt);
    const decision = apiDecision || shouldShowEloSavePrompt({
      userMessage: question,
      assistantResponse: answer,
      context: getEloContext(),
      intent: response && response.sessionIntent
    });
    if (!decision.show) {
      return;
    }

    removePendingEloSavePrompts();

    const prompt = createElement("div", "elo-save-prompt elo-save-card");
    const label = createElement("span", "elo-privacy", "Salvar esta conversa?");
    const memoryButton = createElement("button", "elo-inline-button", "Memória");
    const libraryButton = createElement("button", "elo-inline-button", "Biblioteca");
    const noneButton = createElement("button", "elo-inline-button", "Não salvar");
    const buttons = [memoryButton, libraryButton, noneButton];

    memoryButton.type = "button";
    libraryButton.type = "button";
    noneButton.type = "button";
    prompt.dataset.saveState = "pending";
    prompt.dataset.saveTarget = decision.suggestedTarget;
    prompt.title = decision.reason;

    function disableButtons() {
      prompt.dataset.saveState = "done";
      buttons.forEach(function (button) {
        button.disabled = true;
      });
    }

    memoryButton.addEventListener("click", function () {
      saveUsefulAnswer(question, answer);
      disableButtons();
      appendMessage("system", "Guardado na memória local do Elo.");
    });

    libraryButton.addEventListener("click", function () {
      const result = createLibraryItemFromAnswer(question, answer);
      disableButtons();
      if (result.ok) {
        appendMessage("system", "Guardado na Biblioteca do Elo: " + result.item.title + ".");
      } else if (result.reason === "sensitive") {
        appendMessage("system", "Por segurança, não vou guardar esse tipo de informação.");
      } else {
        appendMessage("system", "Não consegui guardar na Biblioteca porque faltou título ou conteúdo.");
      }
    });

    noneButton.addEventListener("click", disableButtons);

    prompt.appendChild(label);
    prompt.appendChild(memoryButton);
    prompt.appendChild(libraryButton);
    prompt.appendChild(noneButton);
    message.appendChild(prompt);
  }

  function removePendingEloSavePrompts() {
    if (!ELO_UI.messages) {
      return;
    }
    ELO_UI.messages.querySelectorAll(".elo-save-prompt[data-save-state='pending'], .elo-save-card[data-save-state='pending']").forEach(function (prompt) {
      prompt.remove();
    });
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
    appendEloSavePrompt(message, question, result.answer, {
      savePrompt: {
        show: true,
        type: "library",
        suggestedTarget: "library",
        reason: "controlled_web_search"
      }
    });
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

  function showUserProfileSetup() {
    const profile = getUserProfile();
    const message = appendMessage("system", "Configurar meu Elo");
    const panel = createElement("div", "elo-user-profile-panel");
    const status = createElement("p", "elo-privacy", "Este perfil fica salvo apenas neste navegador. Ele ajuda o Elo a responder de forma mais útil.");
    const form = createElement("form", "elo-library-form");
    const nameInput = createElement("input", "elo-library-field");
    const projectInput = createElement("input", "elo-library-field");
    const goalInput = createElement("input", "elo-library-field");
    const helpInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const styleSelect = createElement("select", "elo-library-field");
    const saveButton = createElement("button", "elo-send-button", "Salvar configuração");

    nameInput.type = "text";
    nameInput.maxLength = 80;
    nameInput.placeholder = "Como devo chamar você?";
    nameInput.value = profile.userName;
    projectInput.type = "text";
    projectInput.maxLength = 140;
    projectInput.placeholder = "Qual seu principal projeto agora?";
    projectInput.value = profile.mainProject;
    goalInput.type = "text";
    goalInput.maxLength = 180;
    goalInput.placeholder = "Qual seu objetivo principal esta semana?";
    goalInput.value = profile.weeklyGoal;
    helpInput.maxLength = 260;
    helpInput.rows = 3;
    helpInput.placeholder = "Que tipo de ajuda você espera do Elo?";
    helpInput.value = profile.expectedHelp;
    styleSelect.setAttribute("aria-label", "Preferência de resposta");
    appendSimpleOptions(styleSelect, ["curtas", "detalhadas"]);
    styleSelect.value = profile.answerStyle || "curtas";
    saveButton.type = "submit";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const requestedName = sanitizeUserText(nameInput.value);
      const safeUserName = requestedName && isInvalidUserNameAnswer_(requestedName) ? profile.userName : requestedName;
      const savedProfile = setUserProfile({
        userName: safeUserName,
        mainProject: projectInput.value,
        weeklyGoal: goalInput.value,
        expectedHelp: helpInput.value,
        answerStyle: styleSelect.value
      });
      status.textContent = requestedName && isInvalidUserNameAnswer_(requestedName)
        ? "Perfil salvo, mas esse texto não foi usado como nome."
        : "Perfil local salvo para o Elo.";
      appendMessage("system", [
        "Configuração salva.",
        requestedName && isInvalidUserNameAnswer_(requestedName) ? "Não usei \"" + requestedName + "\" como nome." : "",
        savedProfile.userName ? "Vou chamar você de " + savedProfile.userName + "." : "",
        savedProfile.mainProject ? "Projeto atual: " + savedProfile.mainProject + "." : "",
        savedProfile.weeklyGoal ? "Objetivo da semana: " + savedProfile.weeklyGoal + "." : ""
      ].filter(Boolean).join("\n"));
    });

    form.appendChild(nameInput);
    form.appendChild(projectInput);
    form.appendChild(goalInput);
    form.appendChild(helpInput);
    form.appendChild(styleSelect);
    form.appendChild(saveButton);
    panel.appendChild(status);
    panel.appendChild(createElement("p", "elo-backup-note", "Perguntas: 1. Como devo chamar você? 2. Qual seu principal projeto agora? 3. Qual seu objetivo principal esta semana? 4. Que tipo de ajuda espera? 5. Respostas curtas ou detalhadas?"));
    panel.appendChild(form);
    message.appendChild(panel);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function showInitialProfileImport() {
    const message = appendMessage("system", "Importar perfil inicial");
    const panel = createElement("div", "elo-user-profile-panel");
    const status = createElement("p", "elo-privacy", "Cole aqui um texto sobre você, currículo, bio profissional ou perfil copiado do LinkedIn. O Elo vai tentar extrair informações importantes e pedir sua aprovação antes de guardar.");
    const form = createElement("form", "elo-library-form");
    const textInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const analyzeButton = createElement("button", "elo-send-button", "Analisar perfil");
    const resultPanel = createElement("div", "elo-profile-import-result is-hidden");

    textInput.maxLength = 8000;
    textInput.rows = 7;
    textInput.placeholder = "Exemplo: Sou engenheiro civil. Tenho empresa própria. Trabalho com perícias e projetos. Estou desenvolvendo o ObraReport.";
    analyzeButton.type = "submit";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const extractedProfile = extractInitialProfileFromText(textInput.value);
      if (!textInput.value.trim()) {
        status.textContent = "Cole um texto antes de analisar.";
        return;
      }
      renderInitialProfileReview(resultPanel, extractedProfile, status);
    });

    form.appendChild(textInput);
    form.appendChild(analyzeButton);
    panel.appendChild(status);
    panel.appendChild(createElement("p", "elo-backup-note", "As informações ficam salvas apenas neste navegador nesta versão. Revise antes de guardar."));
    panel.appendChild(form);
    panel.appendChild(resultPanel);
    message.appendChild(panel);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function renderInitialProfileReview(resultPanel, extractedProfile, status) {
    resultPanel.textContent = "";
    resultPanel.classList.remove("is-hidden");
    const summary = createElement("pre", "elo-profile-import-summary", formatInitialProfileExtraction(extractedProfile));
    const question = createElement("p", "elo-privacy", "Deseja guardar essas informações nas memórias importantes do Elo?");
    const actions = createElement("div", "elo-message-actions");
    const saveAllButton = createElement("button", "elo-inline-button", "Guardar tudo");
    const chooseButton = createElement("button", "elo-inline-button", "Escolher o que guardar");
    const cancelButton = createElement("button", "elo-inline-button", "Cancelar");
    const chooser = createElement("div", "elo-profile-import-chooser is-hidden");

    saveAllButton.type = "button";
    chooseButton.type = "button";
    cancelButton.type = "button";
    saveAllButton.addEventListener("click", function () {
      saveInitialProfileExtraction(extractedProfile);
      status.textContent = "Perfil inicial salvo localmente.";
      appendMessage("system", "Perfil inicial salvo. Projetos, objetivos e preferências detectados também foram enviados para Memórias importantes.");
    });
    chooseButton.addEventListener("click", function () {
      chooser.classList.toggle("is-hidden");
    });
    cancelButton.addEventListener("click", function () {
      resultPanel.classList.add("is-hidden");
      status.textContent = "Importação cancelada. Nada foi salvo.";
    });

    actions.appendChild(saveAllButton);
    actions.appendChild(chooseButton);
    actions.appendChild(cancelButton);
    resultPanel.appendChild(summary);
    resultPanel.appendChild(question);
    resultPanel.appendChild(actions);
    buildInitialProfileChooser(chooser, extractedProfile, status);
    resultPanel.appendChild(chooser);
  }

  function buildInitialProfileChooser(container, extractedProfile, status) {
    const options = [
      ["profile", "Perfil: nome, profissão, empresa, cidade e áreas"],
      ["projects", "Projetos detectados"],
      ["goals", "Objetivos detectados"],
      ["preferences", "Preferências detectadas"]
    ];
    const form = createElement("form", "elo-library-form");
    options.forEach(function (option) {
      const label = createElement("label", "elo-profile-import-option");
      const checkbox = createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.value = option[0];
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + option[1]));
      form.appendChild(label);
    });
    const saveSelectedButton = createElement("button", "elo-send-button", "Guardar selecionados");
    saveSelectedButton.type = "submit";
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const selected = {
        profile: false,
        projects: false,
        goals: false,
        preferences: false
      };
      Array.prototype.slice.call(form.querySelectorAll("input[type='checkbox']")).forEach(function (checkbox) {
        selected[checkbox.value] = checkbox.checked;
      });
      saveInitialProfileExtraction(extractedProfile, selected);
      status.textContent = "Informações selecionadas salvas localmente.";
      appendMessage("system", "Importação seletiva concluída. Nada foi enviado para servidor.");
    });
    form.appendChild(saveSelectedButton);
    container.appendChild(form);
  }

  // ELO_LIBRARY_PROJECTS_UI
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

  function showRealQuestions() {
    const message = appendMessage("system", "Perguntas reais");
    const panel = createElement("div", "elo-real-questions-panel");
    const status = createElement("p", "elo-privacy", "As perguntas ficam salvas apenas neste navegador nesta versão. Treinamento manual local.");
    const stats = createElement("div", "elo-real-question-stats");
    const controls = createElement("div", "elo-library-controls");
    const filterSelect = createElement("select", "elo-library-select");
    const exportJsonButton = createElement("button", "elo-inline-button", "Exportar JSON");
    const exportTextButton = createElement("button", "elo-inline-button", "Exportar texto");
    const clearButton = createElement("button", "elo-inline-button", "Limpar perguntas");
    const list = createElement("div", "elo-real-question-list");

    filterSelect.setAttribute("aria-label", "Filtrar perguntas reais");
    appendSimpleOptions(filterSelect, ["Todas", "Úteis", "Não úteis", "Sugeridas para treino"]);
    exportJsonButton.type = "button";
    exportTextButton.type = "button";
    clearButton.type = "button";

    function refresh() {
      renderRealQuestionStats(stats);
      renderRealQuestionList(list, filterSelect.value, status, refresh);
    }

    filterSelect.addEventListener("change", refresh);
    exportJsonButton.addEventListener("click", function () {
      const result = exportRealQuestions("json");
      status.textContent = "Exportação preparada: " + result.fileName + ".";
    });
    exportTextButton.addEventListener("click", function () {
      const result = exportRealQuestions("txt");
      status.textContent = "Exportação preparada: " + result.fileName + ".";
    });
    clearButton.addEventListener("click", function () {
      confirmClearRealQuestions(status, refresh);
    });

    controls.appendChild(filterSelect);
    controls.appendChild(exportJsonButton);
    controls.appendChild(exportTextButton);
    controls.appendChild(clearButton);
    panel.appendChild(status);
    panel.appendChild(stats);
    panel.appendChild(controls);
    panel.appendChild(list);
    message.appendChild(panel);
    refresh();
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function renderRealQuestionStats(statsElement) {
    const stats = getRealQuestionStats();
    statsElement.textContent = "";
    [
      ["Total", stats.total],
      ["Úteis", stats.useful],
      ["Não úteis", stats.notUseful],
      ["Para treino", stats.training]
    ].forEach(function (item) {
      const stat = createElement("span", "elo-real-question-stat", item[0] + ": " + item[1]);
      statsElement.appendChild(stat);
    });
  }

  function filterRealQuestions(questions, filter) {
    if (filter === "Úteis") {
      return questions.filter(function (item) { return item.foiUtil === true; });
    }
    if (filter === "Não úteis") {
      return questions.filter(function (item) { return item.foiUtil === false; });
    }
    if (filter === "Sugeridas para treino") {
      return questions.filter(function (item) { return item.sugeridaParaTreino; });
    }
    return questions;
  }

  function renderRealQuestionList(list, filter, status, refresh) {
    list.textContent = "";
    const questions = filterRealQuestions(getRealQuestions(), filter);
    if (!questions.length) {
      list.appendChild(createElement("p", "elo-library-empty", "Nenhuma pergunta real encontrada neste filtro."));
      return;
    }

    questions.forEach(function (questionItem) {
      const card = createElement("article", "elo-real-question-card");
      const header = createElement("div", "elo-library-card-header");
      const title = createElement("strong", "", questionItem.pergunta);
      const meta = createElement("span", "elo-library-meta", [
        questionItem.contexto,
        questionItem.categoriaDetectada,
        questionItem.foiUtil === null ? "sem feedback" : (questionItem.foiUtil ? "útil" : "não útil"),
        questionItem.sugeridaParaTreino ? "para treino" : "não marcada",
        formatDateTime(questionItem.createdAt)
      ].join(" · "));
      const response = createElement("p", "", summarizeLibraryContent(questionItem.respostaGerada || "Sem resposta registrada."));
      const actions = createElement("div", "elo-library-actions");
      const trainButton = createElement("button", "elo-inline-button", "Adicionar à base de respostas");
      const markButton = createElement("button", "elo-inline-button", questionItem.sugeridaParaTreino ? "Marcada para treino" : "Marcar para treino");
      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

      trainButton.type = "button";
      markButton.type = "button";
      deleteButton.type = "button";
      markButton.disabled = Boolean(questionItem.sugeridaParaTreino);

      trainButton.addEventListener("click", function () {
        appendRealQuestionTrainingForm(questionItem, status, refresh);
      });
      markButton.addEventListener("click", function () {
        markRealQuestionForTraining(questionItem.id);
        status.textContent = "Pergunta marcada para treinamento manual local.";
        refresh();
      });
      deleteButton.addEventListener("click", function () {
        deleteRealQuestion(questionItem.id);
        status.textContent = "Pergunta real excluída.";
        refresh();
      });

      header.appendChild(title);
      header.appendChild(meta);
      actions.appendChild(trainButton);
      actions.appendChild(markButton);
      actions.appendChild(deleteButton);
      card.appendChild(header);
      card.appendChild(response);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function appendRealQuestionTrainingForm(questionItem, status, refresh) {
    const message = appendMessage("system", "Treinamento manual local");
    const form = createElement("form", "elo-library-form");
    const questionInput = createElement("input", "elo-library-field");
    const answerInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const categorySelect = createElement("select", "elo-library-field");
    const keywordsInput = createElement("input", "elo-library-field");
    const saveButton = createElement("button", "elo-send-button", "Adicionar à base de respostas");

    questionInput.type = "text";
    questionInput.maxLength = 180;
    questionInput.value = questionItem.pergunta;
    questionInput.placeholder = "Pergunta";
    answerInput.maxLength = 3000;
    answerInput.rows = 5;
    answerInput.value = questionItem.respostaGerada || "";
    answerInput.placeholder = "Resposta corrigida/manual";
    categorySelect.setAttribute("aria-label", "Categoria da resposta");
    appendCategoryOptions(categorySelect, false);
    categorySelect.value = suggestLibraryCategory(questionItem.pergunta);
    keywordsInput.type = "text";
    keywordsInput.maxLength = 220;
    keywordsInput.value = extractDocumentKeywords(questionItem.pergunta).join(", ");
    keywordsInput.placeholder = "Palavras-chave, separadas por vírgula";
    saveButton.type = "submit";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = saveLibraryItem({
        title: questionInput.value,
        content: answerInput.value,
        category: categorySelect.value,
        tags: keywordsInput.value,
        source: "treinamento_manual_local"
      });
      if (result.ok) {
        markRealQuestionForTraining(questionItem.id);
        status.textContent = "Pergunta adicionada à base local do Elo após revisão manual.";
        appendMessage("system", "Item salvo na Biblioteca do Elo. A base principal não foi alterada automaticamente.");
        refresh();
      } else if (result.reason === "sensitive") {
        appendMessage("system", "Por segurança, não vou guardar esse tipo de informação.");
      } else {
        appendMessage("system", "Preencha pergunta e resposta corrigida para adicionar à base.");
      }
    });

    form.appendChild(createElement("p", "elo-privacy", "Revise antes de salvar. O Elo não aprende sozinho nem substitui respostas existentes automaticamente."));
    form.appendChild(questionInput);
    form.appendChild(answerInput);
    form.appendChild(categorySelect);
    form.appendChild(keywordsInput);
    form.appendChild(saveButton);
    message.appendChild(form);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function confirmClearRealQuestions(status, refresh) {
    const message = appendMessage("system", "Tem certeza? Isso limpa apenas as perguntas reais salvas neste navegador.");
    const actions = createElement("div", "elo-message-actions");
    const confirmButton = createElement("button", "elo-memory-delete", "Confirmar limpeza");
    const cancelButton = createElement("button", "elo-inline-button", "Cancelar");

    confirmButton.type = "button";
    cancelButton.type = "button";
    confirmButton.addEventListener("click", function () {
      clearRealQuestions();
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      status.textContent = "Perguntas reais limpas. Dados do ObraReport não foram alterados.";
      refresh();
    });
    cancelButton.addEventListener("click", function () {
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "Limpeza de perguntas reais cancelada.");
    });

    actions.appendChild(confirmButton);
    actions.appendChild(cancelButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function showLocalDocumentsV2() {
    const message = appendMessage("system", "Biblioteca do Elo");
    const panel = createElement("div", "elo-documents-panel");
    const status = createElement("p", "elo-privacy", "Cole textos, ideias, roadmaps, notas ou trechos extraidos manualmente de documentos. O Elo salva tudo apenas neste navegador e pode consultar depois.");
    const controls = createElement("div", "elo-library-controls");
    const searchInput = createElement("input", "elo-library-search");
    const addButton = createElement("button", "elo-inline-button", "Adicionar texto");
    const exportButton = createElement("button", "elo-inline-button", "Exportar biblioteca");
    const clearButton = createElement("button", "elo-inline-button", "Limpar biblioteca");
    const list = createElement("div", "elo-documents-list");
    let clearArmed = false;
    let clearTimer = null;

    const form = buildLocalDocumentFormV2(function (result) {
      if (result.ok) {
        status.textContent = "Item salvo na Biblioteca do Elo: " + result.document.title + ".";
        renderLocalDocumentListV2(list, searchInput.value, form);
      } else if (result.reason === "sensitive") {
        status.textContent = "Por seguranca, nao vou guardar esse tipo de informacao.";
      } else {
        status.textContent = "Preencha o conteudo, ou importe um arquivo .txt/.md.";
      }
    });

    searchInput.type = "search";
    searchInput.placeholder = "Buscar na biblioteca";
    addButton.type = "button";
    exportButton.type = "button";
    clearButton.type = "button";

    searchInput.addEventListener("input", function () {
      renderLocalDocumentListV2(list, searchInput.value, form);
    });
    addButton.addEventListener("click", function () {
      form.classList.toggle("is-hidden");
    });
    exportButton.addEventListener("click", function () {
      const exported = exportEloLibrary();
      const blob = new Blob([exported], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "elo-biblioteca-local.json";
      link.click();
      URL.revokeObjectURL(url);
      status.textContent = "Arquivo JSON da Biblioteca do Elo preparado.";
    });
    clearButton.addEventListener("click", function () {
      if (!clearArmed) {
        clearArmed = true;
        status.textContent = "Clique novamente em Limpar biblioteca para confirmar. Isso nao altera Stock IA, RDO, PDF ou dados do ObraReport.";
        clearTimeout(clearTimer);
        clearTimer = setTimeout(function () {
          clearArmed = false;
        }, 5000);
        return;
      }
      clearArmed = false;
      clearTimeout(clearTimer);
      clearLocalDocuments();
      status.textContent = "Biblioteca local limpa. Dados do ObraReport nao foram alterados.";
      renderLocalDocumentListV2(list, searchInput.value, form);
    });

    controls.appendChild(searchInput);
    controls.appendChild(addButton);
    controls.appendChild(exportButton);
    controls.appendChild(clearButton);
    panel.appendChild(status);
    panel.appendChild(controls);
    panel.appendChild(form);
    panel.appendChild(list);
    message.appendChild(panel);

    renderLocalDocumentListV2(list, "", form);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function buildLocalDocumentFormV2(onSave) {
    const form = createElement("form", "elo-library-form elo-document-form is-hidden");
    const idInput = createElement("input", "");
    const titleInput = createElement("input", "elo-library-field");
    const typeSelect = createElement("select", "elo-library-field");
    const sourceInput = createElement("input", "elo-library-field");
    const summaryInput = createElement("textarea", "elo-library-field");
    const tagsInput = createElement("input", "elo-library-field");
    const textInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const fileInput = createElement("input", "elo-library-field");
    const saveButton = createElement("button", "elo-send-button", "Salvar na Biblioteca");

    idInput.type = "hidden";
    titleInput.type = "text";
    titleInput.maxLength = 140;
    titleInput.placeholder = "Titulo ou nome do material";
    typeSelect.setAttribute("aria-label", "Tipo de conteudo");
    appendSimpleOptions(typeSelect, ["texto", "documento", "markdown", "roadmap", "ideia", "nota", "livro", "pdf_manual"]);
    sourceInput.type = "text";
    sourceInput.maxLength = 160;
    sourceInput.placeholder = "Fonte ou nome do arquivo (opcional)";
    summaryInput.maxLength = 3000;
    summaryInput.rows = 3;
    summaryInput.placeholder = "Resumo manual (opcional)";
    tagsInput.type = "text";
    tagsInput.maxLength = 240;
    tagsInput.placeholder = "Tags separadas por virgula. Ex.: stock ia, estoque, roadmap";
    textInput.maxLength = 60000;
    textInput.rows = 6;
    textInput.placeholder = "Cole aqui o texto, ideia, roadmap, nota ou trecho extraido manualmente";
    fileInput.type = "file";
    fileInput.accept = ".txt,.md,text/plain,text/markdown";
    saveButton.type = "submit";

    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        return;
      }
      const extension = (file.name.split(".").pop() || "txt").toLowerCase();
      if (["txt", "md"].indexOf(extension) === -1) {
        onSave({ ok: false, reason: "missing" });
        fileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        titleInput.value = titleInput.value || file.name.replace(/\.[^.]+$/g, "");
        sourceInput.value = sourceInput.value || file.name;
        typeSelect.value = extension === "md" ? "markdown" : "texto";
        textInput.value = sanitizeLibraryText(reader.result, 60000);
      };
      reader.readAsText(file);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = saveLocalDocument({
        id: idInput.value,
        title: titleInput.value,
        type: typeSelect.value,
        sourceName: sourceInput.value,
        summary: summaryInput.value,
        tags: tagsInput.value,
        text: textInput.value
      });
      if (result.ok) {
        idInput.value = "";
        titleInput.value = "";
        typeSelect.value = "texto";
        sourceInput.value = "";
        summaryInput.value = "";
        tagsInput.value = "";
        textInput.value = "";
        fileInput.value = "";
        form.classList.add("is-hidden");
      }
      onSave(result);
    });

    form.fillDocument = function (documentItem) {
      idInput.value = documentItem.id || "";
      titleInput.value = documentItem.title || "";
      typeSelect.value = normalizeDocumentType(documentItem.type || "texto");
      sourceInput.value = documentItem.sourceName || "";
      summaryInput.value = documentItem.summary || "";
      tagsInput.value = Array.isArray(documentItem.tags) ? documentItem.tags.join(", ") : "";
      textInput.value = getEloLibraryItemContent(documentItem);
      form.classList.remove("is-hidden");
      titleInput.focus();
    };

    form.appendChild(idInput);
    form.appendChild(titleInput);
    form.appendChild(typeSelect);
    form.appendChild(sourceInput);
    form.appendChild(summaryInput);
    form.appendChild(tagsInput);
    form.appendChild(textInput);
    form.appendChild(fileInput);
    form.appendChild(saveButton);
    return form;
  }

  function renderLocalDocumentListV2(list, query, form) {
    list.textContent = "";
    const documents = getLocalDocuments();
    const results = query ? searchLocalDocuments(query).map(function (entry) {
      return entry.document;
    }) : documents;
    const seen = {};
    const filtered = results.filter(function (documentItem) {
      if (seen[documentItem.id]) {
        return false;
      }
      seen[documentItem.id] = true;
      return true;
    });

    if (!filtered.length) {
      list.appendChild(createElement("p", "elo-library-empty", "Nenhum item encontrado na Biblioteca do Elo."));
      return;
    }

    filtered.forEach(function (documentItem) {
      const card = createElement("article", "elo-document-card");
      const header = createElement("div", "elo-library-card-header");
      const title = createElement("strong", "", documentItem.title);
      const typeLabel = normalizeDocumentType(documentItem.type || "texto").replace("_", " ");
      const sourceLabel = documentItem.sourceName ? " · " + documentItem.sourceName : "";
      const meta = createElement("span", "elo-library-meta", typeLabel.toUpperCase() + sourceLabel + " · " + documentItem.size + " caracteres · " + (documentItem.chunks || []).length + " parte(s) · " + formatDateTime(documentItem.createdAt));
      const summary = createElement("p", "", documentItem.summary || summarizeEloLibraryItem(documentItem));
      const tags = Array.isArray(documentItem.tags) && documentItem.tags.length
        ? createElement("p", "elo-library-meta", "Tags: " + documentItem.tags.join(", "))
        : null;
      const actions = createElement("div", "elo-library-actions");
      const viewButton = createElement("button", "elo-inline-button", "Ver texto");
      const editButton = createElement("button", "elo-inline-button", "Editar");
      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

      viewButton.type = "button";
      editButton.type = "button";
      deleteButton.type = "button";
      viewButton.addEventListener("click", function () {
        appendMessage("system", documentItem.title + "\n\n" + getEloLibraryItemContent(documentItem));
      });
      editButton.addEventListener("click", function () {
        if (form && typeof form.fillDocument === "function") {
          form.fillDocument(documentItem);
        }
      });
      deleteButton.addEventListener("click", function () {
        deleteLocalDocument(documentItem.id);
        renderLocalDocumentListV2(list, query, form);
        appendMessage("system", "Item removido da Biblioteca do Elo.");
      });

      header.appendChild(title);
      header.appendChild(meta);
      actions.appendChild(viewButton);
      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      card.appendChild(header);
      card.appendChild(summary);
      if (tags) {
        card.appendChild(tags);
      }
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function showLocalDocuments() {
    return showLocalDocumentsV2();
  }

  function buildLocalDocumentForm(onSave) {
    const form = createElement("form", "elo-library-form elo-document-form is-hidden");
    const titleInput = createElement("input", "elo-library-field");
    const typeSelect = createElement("select", "elo-library-field");
    const textInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const fileInput = createElement("input", "elo-library-field");
    const saveButton = createElement("button", "elo-send-button", "Salvar documento");

    titleInput.type = "text";
    titleInput.maxLength = 140;
    titleInput.placeholder = "Título do documento";
    typeSelect.setAttribute("aria-label", "Tipo do documento");
    appendSimpleOptions(typeSelect, ["txt", "md"]);
    textInput.maxLength = 60000;
    textInput.rows = 6;
    textInput.placeholder = "Cole aqui o texto do documento";
    fileInput.type = "file";
    fileInput.accept = ".txt,.md,text/plain,text/markdown";
    saveButton.type = "submit";

    fileInput.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        return;
      }
      const extension = (file.name.split(".").pop() || "txt").toLowerCase();
      if (["txt", "md"].indexOf(extension) === -1) {
        onSave({ ok: false, reason: "missing" });
        fileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        titleInput.value = titleInput.value || file.name.replace(/\.[^.]+$/g, "");
        typeSelect.value = extension === "md" ? "md" : "txt";
        textInput.value = sanitizeLibraryText(reader.result, 60000);
      };
      reader.readAsText(file);
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = saveLocalDocument({
        title: titleInput.value,
        type: typeSelect.value,
        text: textInput.value
      });
      if (result.ok) {
        titleInput.value = "";
        typeSelect.value = "txt";
        textInput.value = "";
        fileInput.value = "";
        form.classList.add("is-hidden");
      }
      onSave(result);
    });

    form.appendChild(titleInput);
    form.appendChild(typeSelect);
    form.appendChild(textInput);
    form.appendChild(fileInput);
    form.appendChild(saveButton);
    return form;
  }

  function renderLocalDocumentList(list, query) {
    list.textContent = "";
    const documents = getLocalDocuments();
    const results = query ? searchLocalDocuments(query).map(function (entry) {
      return entry.document;
    }) : documents;
    const seen = {};
    const filtered = results.filter(function (documentItem) {
      if (seen[documentItem.id]) {
        return false;
      }
      seen[documentItem.id] = true;
      return true;
    });

    if (!filtered.length) {
      list.appendChild(createElement("p", "elo-library-empty", "Nenhum documento local encontrado."));
      return;
    }

    filtered.forEach(function (documentItem) {
      const card = createElement("article", "elo-document-card");
      const header = createElement("div", "elo-library-card-header");
      const title = createElement("strong", "", documentItem.title);
      const meta = createElement("span", "elo-library-meta", documentItem.type.toUpperCase() + " · " + documentItem.size + " caracteres · " + (documentItem.chunks || []).length + " chunk(s) · " + formatDateTime(documentItem.createdAt));
      const summary = createElement("p", "", summarizeDocumentChunk(documentItem.text));
      const actions = createElement("div", "elo-library-actions");
      const viewButton = createElement("button", "elo-inline-button", "Ver texto");
      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

      viewButton.type = "button";
      deleteButton.type = "button";
      viewButton.addEventListener("click", function () {
        appendMessage("system", documentItem.title + "\n\n" + documentItem.text);
      });
      deleteButton.addEventListener("click", function () {
        deleteLocalDocument(documentItem.id);
        renderLocalDocumentList(list, query);
        appendMessage("system", "Documento local excluído.");
      });

      header.appendChild(title);
      header.appendChild(meta);
      actions.appendChild(viewButton);
      actions.appendChild(deleteButton);
      card.appendChild(header);
      card.appendChild(summary);
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
        status.textContent = "Por segurança, não vou guardar esse tipo de informação.";
      } else {
        status.textContent = "Preencha título e conteúdo para salvar.";
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
    titleInput.placeholder = "Título";
    contentInput.maxLength = 3000;
    contentInput.rows = 4;
    contentInput.placeholder = "Conteúdo";
    tagsInput.type = "text";
    tagsInput.maxLength = 180;
    tagsInput.placeholder = "Tags opcionais, separadas por vírgula";
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
      const meta = createElement("span", "elo-library-meta", libraryItem.category + " · " + formatDateTime(libraryItem.updatedAt || libraryItem.createdAt));
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
        appendMessage("system", "Item excluído da Biblioteca do Elo.");
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

  function showTimeline() {
    const message = appendMessage("system", "Linha do tempo");
    const panel = createElement("div", "elo-timeline-panel");
    const status = createElement("p", "elo-privacy", "A Linha do Tempo fica salva apenas neste navegador.");
    const controls = createElement("div", "elo-timeline-controls");
    const typeSelect = createElement("select", "elo-library-select");
    const projectInput = createElement("input", "elo-library-search");
    const addButton = createElement("button", "elo-inline-button", "Adicionar evento");
    const exportButton = createElement("button", "elo-inline-button", "Exportar texto");
    const form = buildTimelineForm(function (result) {
      if (result.ok) {
        status.textContent = "Evento salvo na Linha do Tempo.";
        form.classList.add("is-hidden");
        renderTimelineList(list, typeSelect.value, projectInput.value);
      } else if (result.reason === "sensitive") {
        status.textContent = "Por segurança, não vou guardar esse tipo de informação.";
      } else {
        status.textContent = "Preencha título e conteúdo para salvar o evento.";
      }
    });
    const list = createElement("div", "elo-timeline-list");

    typeSelect.appendChild(createElement("option", "", "Todos"));
    ELO_TIMELINE_TYPES.forEach(function (type) {
      const option = createElement("option", "", formatTimelineType(type));
      option.value = type;
      typeSelect.appendChild(option);
    });
    projectInput.type = "search";
    projectInput.placeholder = "Filtrar por projeto";
    addButton.type = "button";
    exportButton.type = "button";

    typeSelect.addEventListener("change", function () {
      renderTimelineList(list, typeSelect.value, projectInput.value);
    });
    projectInput.addEventListener("input", function () {
      renderTimelineList(list, typeSelect.value, projectInput.value);
    });
    addButton.addEventListener("click", function () {
      form.classList.toggle("is-hidden");
    });
    exportButton.addEventListener("click", function () {
      const exported = exportTimelineAsText(getTimelineEvents({
        type: typeSelect.value === "Todos" ? "" : typeSelect.value,
        project: projectInput.value
      }));
      const blob = new Blob([exported], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "elo-linha-do-tempo.txt";
      link.click();
      URL.revokeObjectURL(url);
      status.textContent = "Linha do Tempo exportada em texto.";
    });

    controls.appendChild(typeSelect);
    controls.appendChild(projectInput);
    controls.appendChild(addButton);
    controls.appendChild(exportButton);
    panel.appendChild(status);
    panel.appendChild(controls);
    panel.appendChild(form);
    panel.appendChild(list);
    message.appendChild(panel);
    renderTimelineList(list, "Todos", "");
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function showPhilosophy() {
    const message = appendMessage("system", "Filosofia do Elo");
    const panel = createElement("div", "elo-philosophy-panel");
    const intro = createElement("p", "elo-privacy", "Respostas reflexivas locais, sem internet, sem IA real e sem impor uma crença como verdade absoluta.");
    const questions = createElement("div", "elo-suggestion-chips");
    [
      "Você existe?",
      "O que somos?",
      "O que é esperança?",
      "Só existe o que é palpável?",
      "O que é pensamento?",
      "Qual o sentido da vida?"
    ].forEach(function (question) {
      const button = createElement("button", "elo-suggestion-chip", question);
      button.type = "button";
      button.addEventListener("click", function () {
        askElo(question);
      });
      questions.appendChild(button);
    });

    panel.appendChild(intro);
    panel.appendChild(questions);
    message.appendChild(panel);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function showConcepts() {
    const message = appendMessage("system", "Biblioteca de Conceitos");
    const panel = createElement("div", "elo-concepts-panel");
    const status = createElement("p", "elo-privacy", "Conceitos ficam salvos apenas neste navegador. A base fixa não usa internet nem IA real.");
    const controls = createElement("div", "elo-library-controls");
    const searchInput = createElement("input", "elo-library-search");
    const addButton = createElement("button", "elo-inline-button", "Adicionar conceito");
    const form = buildConceptForm(function (result) {
      if (result.ok) {
        status.textContent = "Conceito personalizado salvo.";
        form.classList.add("is-hidden");
        renderConceptList(list, searchInput.value);
      } else if (result.reason === "sensitive") {
        status.textContent = "Por segurança, não vou guardar esse tipo de informação.";
      } else {
        status.textContent = "Preencha título e resposta curta para salvar.";
      }
    });
    const suggested = createElement("div", "elo-suggestion-chips");
    const list = createElement("div", "elo-concepts-list");

    searchInput.type = "search";
    searchInput.placeholder = "Buscar conceito";
    addButton.type = "button";
    ["O que é amor?", "O que é alma?", "O que é esperança?", "Só existe o que é palpável?", "O que é pensamento?", "O que é propósito?"].forEach(function (question) {
      const button = createElement("button", "elo-suggestion-chip", question);
      button.type = "button";
      button.addEventListener("click", function () {
        askElo(question);
      });
      suggested.appendChild(button);
    });
    searchInput.addEventListener("input", function () {
      renderConceptList(list, searchInput.value);
    });
    addButton.addEventListener("click", function () {
      form.classList.toggle("is-hidden");
    });

    controls.appendChild(searchInput);
    controls.appendChild(addButton);
    panel.appendChild(status);
    panel.appendChild(suggested);
    panel.appendChild(controls);
    panel.appendChild(form);
    panel.appendChild(list);
    message.appendChild(panel);
    renderConceptList(list, "");
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function buildConceptForm(onSave) {
    const form = createElement("form", "elo-library-form elo-concept-form is-hidden");
    const titleInput = createElement("input", "elo-library-field");
    const keywordsInput = createElement("input", "elo-library-field");
    const shortAnswerInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const icaroInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const reflectionInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const saveButton = createElement("button", "elo-send-button", "Salvar conceito");

    titleInput.type = "text";
    titleInput.placeholder = "Título do conceito";
    keywordsInput.type = "text";
    keywordsInput.placeholder = "Palavras-chave separadas por vírgula";
    shortAnswerInput.placeholder = "Resposta curta";
    icaroInput.placeholder = "Visão do Ícaro";
    reflectionInput.placeholder = "Reflexão do Elo";
    saveButton.type = "submit";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = saveCustomConcept({
        title: titleInput.value,
        keywords: keywordsInput.value,
        shortAnswer: shortAnswerInput.value,
        icaro: icaroInput.value,
        eloReflection: reflectionInput.value
      });
      if (result.ok) {
        titleInput.value = "";
        keywordsInput.value = "";
        shortAnswerInput.value = "";
        icaroInput.value = "";
        reflectionInput.value = "";
      }
      onSave(result);
    });

    form.appendChild(titleInput);
    form.appendChild(keywordsInput);
    form.appendChild(shortAnswerInput);
    form.appendChild(icaroInput);
    form.appendChild(reflectionInput);
    form.appendChild(saveButton);
    return form;
  }

  function renderConceptList(list, query) {
    const normalizedQuery = normalizeText(query);
    const concepts = getAllConcepts().filter(function (concept) {
      const haystack = normalizeText([concept.title, concept.keywords && concept.keywords.join(" "), concept.shortAnswer].join(" "));
      return !normalizedQuery || haystack.indexOf(normalizedQuery) >= 0;
    }).slice(0, 60);
    list.textContent = "";

    if (!concepts.length) {
      list.appendChild(createElement("p", "elo-library-empty", "Nenhum conceito encontrado."));
      return;
    }

    concepts.forEach(function (concept) {
      const card = createElement("article", "elo-concept-card");
      const header = createElement("div", "elo-library-card-header");
      const title = createElement("strong", "", concept.title + (concept.custom ? " · personalizado" : ""));
      const meta = createElement("span", "elo-library-meta", (concept.keywords || []).slice(0, 5).join(", "));
      const summary = createElement("p", "", concept.shortAnswer);
      const actions = createElement("div", "elo-library-actions");
      const askButton = createElement("button", "elo-inline-button", "Perguntar");

      askButton.type = "button";
      askButton.addEventListener("click", function () {
        askElo("O que é " + concept.title + "?");
      });

      header.appendChild(title);
      header.appendChild(meta);
      actions.appendChild(askButton);
      card.appendChild(header);
      card.appendChild(summary);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function buildTimelineForm(onSave) {
    const form = createElement("form", "elo-library-form elo-timeline-form is-hidden");
    const titleInput = createElement("input", "elo-library-field");
    const contentInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const typeSelect = createElement("select", "elo-library-field");
    const projectInput = createElement("input", "elo-library-field");
    const importanceSelect = createElement("select", "elo-library-field");
    const tagsInput = createElement("input", "elo-library-field");
    const moodInput = createElement("input", "elo-library-field");
    const saveButton = createElement("button", "elo-send-button", "Salvar evento");

    titleInput.type = "text";
    titleInput.maxLength = 140;
    titleInput.placeholder = "Título";
    contentInput.maxLength = 1200;
    contentInput.placeholder = "Conteúdo do evento";
    projectInput.type = "text";
    projectInput.maxLength = 120;
    projectInput.placeholder = "Projeto relacionado";
    tagsInput.type = "text";
    tagsInput.maxLength = 160;
    tagsInput.placeholder = "Tags separadas por vírgula";
    moodInput.type = "text";
    moodInput.maxLength = 80;
    moodInput.placeholder = "Humor/mood opcional";
    saveButton.type = "submit";

    ELO_TIMELINE_TYPES.forEach(function (type) {
      const option = createElement("option", "", formatTimelineType(type));
      option.value = type;
      typeSelect.appendChild(option);
    });
    ELO_TIMELINE_IMPORTANCE.forEach(function (importance) {
      const option = createElement("option", "", importance);
      option.value = importance;
      importanceSelect.appendChild(option);
    });
    importanceSelect.value = "media";

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      const result = saveTimelineEvent({
        title: titleInput.value,
        content: contentInput.value,
        type: typeSelect.value,
        project: projectInput.value,
        importance: importanceSelect.value,
        tags: tagsInput.value,
        mood: moodInput.value,
        source: "manual"
      });
      if (result.ok) {
        titleInput.value = "";
        contentInput.value = "";
        projectInput.value = "";
        tagsInput.value = "";
        moodInput.value = "";
        typeSelect.value = "marco";
        importanceSelect.value = "media";
      }
      onSave(result);
    });

    form.appendChild(titleInput);
    form.appendChild(contentInput);
    form.appendChild(typeSelect);
    form.appendChild(projectInput);
    form.appendChild(importanceSelect);
    form.appendChild(tagsInput);
    form.appendChild(moodInput);
    form.appendChild(saveButton);
    return form;
  }

  function renderTimelineList(list, type, project) {
    list.textContent = "";
    const filters = {
      type: type === "Todos" ? "" : type,
      project: project
    };
    const events = getTimelineEvents(filters);

    if (!events.length) {
      list.appendChild(createElement("p", "elo-library-empty", "Ainda não há eventos registrados na sua Linha do Tempo."));
      return;
    }

    events.slice(0, 40).forEach(function (event) {
      const card = createElement("article", "elo-timeline-card");
      const header = createElement("div", "elo-project-card-header");
      const title = createElement("strong", "", event.title);
      const badges = createElement("div", "elo-project-badges");
      const typeBadge = createElement("span", "elo-timeline-badge", formatTimelineType(event.type));
      const importanceBadge = createElement("span", "elo-timeline-importance is-" + event.importance, event.importance);
      const content = createElement("p", "", event.content);
      const meta = createElement("span", "elo-library-meta", formatDateTime(event.createdAt) + (event.project ? " · Projeto: " + event.project : "") + (event.mood ? " · Humor: " + event.mood : ""));
      const tags = createElement("span", "elo-library-tags", event.tags.length ? "Tags: " + event.tags.join(", ") : "Sem tags");
      const actions = createElement("div", "elo-library-actions");
      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

      deleteButton.type = "button";
      deleteButton.addEventListener("click", function () {
        deleteTimelineEvent(event.id);
        renderTimelineList(list, type, project);
        appendMessage("system", "Evento excluído da Linha do Tempo.");
      });

      badges.appendChild(typeBadge);
      badges.appendChild(importanceBadge);
      header.appendChild(title);
      header.appendChild(badges);
      actions.appendChild(deleteButton);
      card.appendChild(header);
      card.appendChild(content);
      card.appendChild(meta);
      card.appendChild(tags);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function showImportantMemories() {
    const storage = getImportantMemoriesStorage();
    const message = appendMessage("system", "Memórias importantes");
    const panel = createElement("div", "elo-important-memory-panel");
    const status = createElement("p", "elo-privacy", "Essas memórias ficam salvas apenas neste navegador nesta versão.");
    const list = createElement("div", "elo-important-memory-list");
    const actions = createElement("div", "elo-message-actions");
    const exportButton = createElement("button", "elo-inline-button", "Exportar JSON");
    const clearButton = createElement("button", "elo-inline-button", "Limpar memórias importantes");

    function render() {
      list.innerHTML = "";
      [
        ["Projetos", storage.projetos || []],
        ["Objetivos", storage.objetivos || []],
        ["Preferências", storage.preferencias || []]
      ].forEach(function (section) {
        list.appendChild(createElement("h3", "elo-projects-subtitle", section[0]));
        if (!section[1].length) {
          list.appendChild(createElement("p", "elo-library-empty", "Nenhum item salvo."));
          return;
        }

        section[1].forEach(function (item) {
          const card = createElement("article", "elo-important-memory-card");
          const header = createElement("div", "elo-project-card-header");
          const title = createElement("strong", "", item.titulo);
          const badge = createElement("span", "elo-status-badge is-" + item.status, item.status);
          const description = createElement("p", "", item.descricao || "Sem descrição.");
          const meta = createElement("span", "elo-library-meta", "Criado em " + formatDateTime(item.createdAt));
          const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

          deleteButton.type = "button";
          deleteButton.addEventListener("click", function () {
            deleteImportantMemory(item.id);
            status.textContent = "Memória importante excluída.";
            const updated = getImportantMemoriesStorage();
            storage.projetos = updated.projetos;
            storage.objetivos = updated.objetivos;
            storage.preferencias = updated.preferencias;
            render();
          });

          header.appendChild(title);
          header.appendChild(badge);
          card.appendChild(header);
          card.appendChild(description);
          card.appendChild(meta);
          card.appendChild(deleteButton);
          list.appendChild(card);
        });
      });
    }

    exportButton.type = "button";
    clearButton.type = "button";
    exportButton.addEventListener("click", function () {
      const exported = JSON.stringify(getImportantMemoriesStorage(), null, 2);
      const blob = new Blob([exported], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "elo-memorias-importantes.json";
      link.click();
      URL.revokeObjectURL(url);
      status.textContent = "Arquivo JSON das memórias importantes preparado.";
    });
    clearButton.addEventListener("click", function () {
      clearImportantMemories();
      status.textContent = "Memórias importantes limpas. Dados do ObraReport não foram alterados.";
      storage.projetos = [];
      storage.objetivos = [];
      storage.preferencias = [];
      render();
    });

    actions.appendChild(exportButton);
    actions.appendChild(clearButton);
    render();
    panel.appendChild(status);
    panel.appendChild(list);
    panel.appendChild(actions);
    message.appendChild(panel);
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

  function mountMinimalEloChat(options) {
    const config = options || {};
    const form = document.querySelector(config.form || ".elo-input-row");
    const input = document.querySelector(config.input || ".elo-input");
    const panel = document.querySelector(config.panel || ".elo-standalone-panel");
    const messages = document.querySelector(config.messages || ".elo-messages");
    const attachmentInput = document.querySelector(config.attachmentInput || ".elo-attachment-input");
    const attachmentButton = document.querySelector(config.attachmentButton || ".elo-attach-button");

    if (!form || !input || !panel || !messages) {
      return false;
    }

    ELO_UI.panel = panel;
    ELO_UI.messages = messages;
    ELO_UI.input = input;
    ELO_UI.attachmentInput = attachmentInput;
    ELO_UI.attachmentButton = attachmentButton;
    ELO_UI.attachmentStatus = document.querySelector(".elo-attachment-status") || createElement("p", "elo-attachment-status");
    ELO_UI.attachments = [];
    ELO_UI.awaitingStandaloneName = false;

    if (attachmentButton && attachmentInput && !attachmentButton.dataset.eloEngineBound) {
      attachmentButton.dataset.eloEngineBound = "true";
      attachmentButton.addEventListener("click", function () {
        attachmentInput.click();
      });
    }

    if (attachmentInput && !attachmentInput.dataset.eloEngineBound) {
      attachmentInput.dataset.eloEngineBound = "true";
      attachmentInput.addEventListener("change", function () {
        ELO_UI.attachments = Array.prototype.slice.call(attachmentInput.files || []).slice(0, 6);
        renderProductAttachmentStatus();
      });
    }

    function submitMinimalQuestion() {
      const question = ELO_UI.input.value;
      const attachmentIntent = detectAttachmentIntent(question);

      if (attachmentIntent.type === "image") {
        ELO_UI.input.value = "";
        analyzeEloImageAttachment_(question, attachmentIntent.file);
        return;
      }

      if (ELO_UI.attachments.length && !sanitizeUserText(question)) {
        askElo("Elo, leia este anexo.", ELO_UI.attachments);
      } else {
        askElo(question, ELO_UI.attachments);
      }
      ELO_UI.input.value = "";
    }

    if (!form.dataset.eloEngineBound) {
      form.dataset.eloEngineBound = "true";
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        submitMinimalQuestion();
      });
    }

    if (!input.dataset.eloEngineKeyBound) {
      input.dataset.eloEngineKeyBound = "true";
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submitMinimalQuestion();
        }
      });
    }

    return true;
  }

  window.EloAssistente = Object.assign({}, window.EloAssistente || {}, {
    ask: askElo,
    mountMinimal: mountMinimalEloChat,
    buildOperationalConstructionAnswer: buildEloOperationalConstructionAnswer_,
    buildResponseForTest: buildResponse,
    buildPremiseQuestionForTest: buildEloPremiseQuestion_,
    resetStockObrasBriefingForTest: resetEloStockObrasCompositionBriefing_,
    getStockObrasBriefingForTest: function () {
      return cloneEloStockObrasCompositionBriefing_(ELO_SESSION_MEMORY.stockObrasCompositionBriefing);
    }
  });

  // ELO_BOOTSTRAP
  if (!window.ELO_SKIP_AUTO_WIDGET) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", buildWidget);
    } else {
      buildWidget();
    }
  }
})();

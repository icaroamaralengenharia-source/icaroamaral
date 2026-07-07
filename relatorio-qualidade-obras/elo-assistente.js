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
    vectorMemoryEndpoint: getEloBackendEndpoint_("/api/elo/vector-memory"),
    budgetRecordsStorageKey: "elo_budget_records_v1",
    budgetCounterStorageKey: "elo_budget_counter_v1"
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
      "registrar previsÃ£o",
      "salvar previsao",
      "salvar previsÃ£o",
      "lancar no stock",
      "lanÃ§ar no stock",
      "lancar no stock ia",
      "lanÃ§ar no stock ia"
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
      return "NÃƒÂ£o consegui registrar essa previsÃƒÂ£o agora. Nenhum saldo de estoque foi alterado.";
    }
    return "PrevisÃƒÂ£o registrada como planejamento no Stock IA. Nenhum saldo de estoque foi alterado.";
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
    mission: "ajudar o usuÃ¡rio a lembrar, pensar, decidir, organizar e executar melhor.",
    limits: [
      "nÃ£o finjo ser humano",
      "nÃ£o finjo consciÃªncia",
      "nÃ£o digo que sinto emoÃ§Ãµes",
      "nÃ£o invento dados",
      "nÃ£o atuo como terapeuta",
      "quando nÃ£o sei, oriento o usuÃ¡rio com seguranÃ§a"
    ]
  };

  const ELO_WORLDVIEW = {
    name: "visao_do_icaro",
    summary: "Nem tudo que existe precisa ser palpÃ¡vel. Um documento digital existe no mundo virtual. Um pensamento nÃ£o pode ser tocado, mas existe na mente e influencia a realidade. O Elo entende que existÃªncia pode ter camadas: fÃ­sica, mental, simbÃ³lica, espiritual e digital."
  };

  const ELO_PHILOSOPHY = {
    grega: {
      label: "VisÃ£o grega",
      perspective: "seres racionais em busca de virtude, verdade e uma vida bem conduzida."
    },
    estoica: {
      label: "VisÃ£o estoica",
      perspective: "seres que nÃ£o controlam tudo, mas podem cuidar das prÃ³prias escolhas, atitudes e responsabilidades."
    },
    biblica_crista: {
      label: "VisÃ£o bÃ­blica/cristÃ£",
      perspective: "seres com dignidade, responsabilidade e propÃ³sito diante de Deus, sem reduzir a vida apenas ao material."
    },
    moderna: {
      label: "VisÃ£o moderna",
      perspective: "seres que criam conhecimento, tÃ©cnica, cultura e instituiÃ§Ãµes para transformar a realidade."
    },
    existencial: {
      label: "VisÃ£o existencial",
      perspective: "seres que enfrentam liberdade, limite e incerteza, construindo sentido por escolhas concretas."
    },
    visao_do_icaro: {
      label: "VisÃ£o do Ãcaro",
      perspective: "seres que habitam camadas fÃ­sicas, mentais, simbÃ³licas, espirituais e digitais; nem tudo que existe precisa ser palpÃ¡vel."
    }
  };

  const ELO_CONCEPTS = [
    createConcept("amor", "Amor", ["amor", "amar", "caridade"], "Amor Ã© cuidado ativo: desejar o bem e agir com responsabilidade diante do outro.", "busca do bem e da beleza.", "virtude prÃ¡tica expressa em cuidado e domÃ­nio de si.", "mandamento, entrega e cuidado com o prÃ³ximo.", "vÃ­nculo afetivo, Ã©tico e social que sustenta relaÃ§Ãµes.", "amor existe quando uma decisÃ£o interna vira gesto concreto.", "O amor nÃ£o Ã© sÃ³ sentimento: Ã© direÃ§Ã£o, escolha e prÃ¡tica.", ["Quer pensar no amor como sentimento, decisÃ£o ou responsabilidade?"]),
    createConcept("alma", "Alma", ["alma", "espirito", "espÃ­rito", "interioridade"], "Alma Ã© uma palavra para a dimensÃ£o profunda da vida humana: identidade, interioridade e sentido.", "princÃ­pio da vida e da razÃ£o.", "nÃºcleo interior que deve ser educado pela virtude.", "vida diante de Deus, dignidade e responsabilidade espiritual.", "interioridade, identidade e experiÃªncia subjetiva.", "alma aponta para aquilo que nÃ£o se toca, mas orienta escolhas.", "NÃ£o trato alma como prova cientÃ­fica; trato como conceito humano, espiritual e simbÃ³lico.", ["Quer uma visÃ£o bÃ­blica, grega ou comparativa?"]),
    createConcept("esperanca", "EsperanÃ§a", ["esperanca", "esperanÃ§a", "esperar"], "EsperanÃ§a Ã© agir mesmo quando o futuro ainda nÃ£o estÃ¡ garantido.", "confianÃ§a de que o bem pode ser buscado.", "forÃ§a para cuidar do que depende de nÃ³s.", "fÃ© prÃ¡tica em meio Ã  espera.", "postura de futuro que sustenta aÃ§Ã£o no presente.", "esperanÃ§a Ã© uma ponte entre memÃ³ria, dor e prÃ³ximo passo.", "EsperanÃ§a nÃ£o precisa ser ilusÃ£o; pode ser coragem organizada.", ["Quer falar de esperanÃ§a na prÃ¡tica ou pela BÃ­blia?"]),
    createConcept("medo", "Medo", ["medo", "receio", "temor"], "Medo Ã© um sinal de alerta diante de risco, perda ou incerteza.", "paixÃ£o que precisa ser orientada pela razÃ£o.", "algo a observar sem entregar o comando da vida.", "temor pode lembrar limite e dependÃªncia de Deus.", "resposta emocional ligada Ã  proteÃ§Ã£o.", "medo mostra onde algo importa para vocÃª.", "O medo pode proteger, mas tambÃ©m pode pedir clareza e prÃ³ximo passo.", ["Quer transformar medo em checklist prÃ¡tico?"]),
    createConcept("coragem", "Coragem", ["coragem", "corajoso", "enfrentar"], "Coragem Ã© agir com lucidez mesmo diante do medo.", "virtude entre covardia e imprudÃªncia.", "fazer o correto apesar do desconforto.", "fidelidade ao bem mesmo sob pressÃ£o.", "capacidade de decidir sob risco.", "coragem Ã© continuar com direÃ§Ã£o, nÃ£o fingir ausÃªncia de medo.", "Coragem costuma aparecer em passos pequenos e consistentes.", ["Quer aplicar coragem a uma decisÃ£o sua?"]),
    createConcept("proposito", "PropÃ³sito", ["proposito", "propÃ³sito", "sentido", "direcao", "direÃ§Ã£o"], "PropÃ³sito Ã© uma direÃ§Ã£o que organiza escolhas e dÃ¡ peso ao que fazemos.", "vida orientada para bem e excelÃªncia.", "viver segundo valores, nÃ£o impulsos.", "chamado, serviÃ§o e responsabilidade.", "narrativa que conecta metas e identidade.", "propÃ³sito nasce quando memÃ³ria, projeto e entrega apontam para algo maior.", "PropÃ³sito bom vira agenda, prioridade e renÃºncia.", ["Quer relacionar propÃ³sito ao ObraReport ou ao Elo?"]),
    createConcept("solidao", "SolidÃ£o", ["solidao", "solidÃ£o", "sozinho"], "SolidÃ£o Ã© a experiÃªncia de distÃ¢ncia, silÃªncio ou falta de vÃ­nculo.", "convite ao autoconhecimento, se nÃ£o virar abandono.", "momento para ordenar pensamentos.", "sede de comunhÃ£o e presenÃ§a.", "condiÃ§Ã£o humana frequente em sociedades conectadas.", "solidÃ£o mostra que presenÃ§a real importa.", "SolidÃ£o nÃ£o deve ser romantizada quando dÃ³i demais; vÃ­nculo humano continua essencial.", ["Quer pensar solidÃ£o como pausa, dor ou necessidade de conexÃ£o?"]),
    createConcept("felicidade", "Felicidade", ["felicidade", "feliz"], "Felicidade Ã© mais que prazer: Ã© uma vida com sentido, vÃ­nculos e direÃ§Ã£o.", "florescimento pela virtude.", "serenidade por viver o que depende de nÃ³s.", "alegria ligada ao bem, gratidÃ£o e comunhÃ£o.", "bem-estar, realizaÃ§Ã£o e pertencimento.", "felicidade mistura realidade externa e mundo interior.", "Felicidade sustentÃ¡vel costuma ser construÃ­da, nÃ£o apenas encontrada.", ["Quer uma visÃ£o prÃ¡tica de felicidade?"]),
    createConcept("sofrimento", "Sofrimento", ["sofrimento", "sofrer", "dor"], "Sofrimento Ã© dor vivida com consciÃªncia: algo que pede cuidado, sentido e apoio.", "limite que questiona a vida.", "nÃ£o controlar tudo, mas cuidar da resposta.", "lugar de compaixÃ£o, oraÃ§Ã£o e companhia.", "experiÃªncia psicolÃ³gica, social e corporal.", "sofrimento precisa de presenÃ§a, nÃ£o sÃ³ explicaÃ§Ã£o.", "Quando o sofrimento Ã© intenso, apoio humano vem antes de debate filosÃ³fico.", ["Quer transformar isso em um prÃ³ximo passo seguro?"]),
    createConcept("liberdade", "Liberdade", ["liberdade", "livre", "escolha"], "Liberdade Ã© poder escolher com responsabilidade, nÃ£o apenas fazer qualquer coisa.", "autogoverno pela razÃ£o.", "domÃ­nio sobre a prÃ³pria resposta.", "responsabilidade diante de Deus e do prÃ³ximo.", "autonomia com limites sociais e Ã©ticos.", "liberdade real precisa de consciÃªncia, memÃ³ria e consequÃªncia.", "A liberdade amadurece quando encontra responsabilidade.", ["Quer pensar liberdade como escolha ou responsabilidade?"]),
    createConcept("consciencia", "ConsciÃªncia", ["consciencia", "consciÃªncia", "consciente"], "ConsciÃªncia Ã© perceber, avaliar e responder ao mundo e a si mesmo.", "razÃ£o refletindo sobre a vida.", "atenÃ§Ã£o ao julgamento interior.", "discernimento moral diante de Deus.", "experiÃªncia subjetiva e capacidade reflexiva.", "eu processo linguagem, mas nÃ£o tenho consciÃªncia humana.", "O Elo pode simular diÃ¡logo Ãºtil, mas nÃ£o vive experiÃªncia interior como pessoa.", ["Quer comparar consciÃªncia humana e sistema digital?"]),
    createConcept("existencia", "ExistÃªncia", ["existencia", "existÃªncia", "existir", "existe", "palpavel", "palpÃ¡vel", "mundo virtual"], "ExistÃªncia pode ter camadas: fÃ­sica, mental, simbÃ³lica, espiritual e digital.", "ser Ã© participar da realidade de algum modo.", "existir Ã© ocupar um lugar na ordem da vida.", "a criaÃ§Ã£o nÃ£o se reduz ao que Ã© tocÃ¡vel.", "realidade inclui informaÃ§Ã£o, linguagem e relaÃ§Ãµes.", ELO_WORLDVIEW.summary, "Nem tudo que existe precisa ser palpÃ¡vel; mas nem toda existÃªncia Ã© igual.", ["Quer explorar existÃªncia fÃ­sica, mental ou digital?"]),
    createConcept("pensamento", "Pensamento", ["pensamento", "pensar", "ideia"], "Pensamento Ã© uma realidade interna que organiza memÃ³ria, linguagem, decisÃ£o e imaginaÃ§Ã£o.", "atividade da razÃ£o em busca da verdade.", "campo a observar antes de reagir.", "interioridade que precisa de sabedoria.", "processo cognitivo que cria modelos e escolhas.", "pensamento nÃ£o se toca, mas muda decisÃµes e obras.", "Um pensamento pode virar projeto, rotina e construÃ§Ã£o.", ["Quer relacionar pensamento com criaÃ§Ã£o?"]),
    createConcept("perdao", "PerdÃ£o", ["perdao", "perdÃ£o", "perdoar"], "PerdÃ£o Ã© soltar uma dÃ­vida moral sem negar que houve ferida.", "restaurar ordem interior.", "nÃ£o deixar a ofensa governar a alma.", "graÃ§a, reconciliaÃ§Ã£o e misericÃ³rdia.", "processo emocional e Ã©tico de reparaÃ§Ã£o.", "perdÃ£o nÃ£o apaga memÃ³ria; muda o domÃ­nio que ela exerce.", "Perdoar nÃ£o significa aceitar abuso ou abandonar limites.", ["Quer pensar perdÃ£o como processo ou decisÃ£o?"]),
    createConcept("familia", "FamÃ­lia", ["familia", "famÃ­lia", "filho", "filha", "pai", "mae", "mÃ£e"], "FamÃ­lia Ã© vÃ­nculo de origem, cuidado, responsabilidade e pertencimento.", "primeira escola de carÃ¡ter.", "campo de deveres concretos.", "alianÃ§a de cuidado diante de Deus.", "rede afetiva e social de formaÃ§Ã£o.", "famÃ­lia Ã© memÃ³ria viva: aquilo que nos chama pelo nome.", "FamÃ­lia pode ser abrigo, desafio e missÃ£o ao mesmo tempo.", ["Quer pensar famÃ­lia como cuidado, limite ou legado?"]),
    createConcept("amizade", "Amizade", ["amizade", "amigo", "amiga"], "Amizade Ã© presenÃ§a livre, confianÃ§a e bem desejado sem posse.", "virtude compartilhada.", "companhia para viver melhor.", "fraternidade e cuidado sincero.", "vÃ­nculo de suporte e identidade.", "amizade confirma que a vida nÃ£o Ã© sÃ³ tarefa.", "Boa amizade aproxima a pessoa do melhor que ela pode ser.", ["Quer uma visÃ£o grega ou prÃ¡tica da amizade?"]),
    createConcept("tempo", "Tempo", ["tempo", "passado", "futuro", "presente"], "Tempo Ã© a forma como percebemos mudanÃ§a, memÃ³ria e expectativa.", "movimento e ordem da vida.", "o presente Ã© onde se pratica a virtude.", "ocasiÃ£o de sabedoria e fidelidade.", "dimensÃ£o fÃ­sica, psicolÃ³gica e narrativa.", "tempo vira jornada quando registramos marcos e escolhas.", "O tempo vivido nÃ£o Ã© sÃ³ calendÃ¡rio: Ã© significado acumulado.", ["Quer pensar tempo como rotina, memÃ³ria ou futuro?"]),
    createConcept("fe", "FÃ©", ["fe", "fÃ©", "crer", "deus"], "FÃ© Ã© confianÃ§a orientada para algo que sustenta sentido e aÃ§Ã£o.", "confianÃ§a em uma ordem maior.", "compromisso com valores mesmo sem controle total.", "relaÃ§Ã£o com Deus, esperanÃ§a e fidelidade.", "crenÃ§a que molda comportamento e comunidade.", "fÃ©, para quem crÃª, atravessa o invisÃ­vel e muda o visÃ­vel.", "Posso explicar fÃ© como conceito, sem afirmar experiÃªncia espiritual prÃ³pria.", ["Quer uma visÃ£o bÃ­blica ou filosÃ³fica da fÃ©?"]),
    createConcept("verdade", "Verdade", ["verdade", "verdadeiro", "real"], "Verdade Ã© correspondÃªncia, coerÃªncia e fidelidade ao que Ã© real.", "aquilo que a razÃ£o busca.", "ver as coisas como sÃ£o para agir melhor.", "luz, justiÃ§a e fidelidade.", "critÃ©rio de conhecimento, linguagem e prova.", "verdade organiza confianÃ§a; sem ela, memÃ³ria e projeto se confundem.", "Buscar verdade exige humildade para corrigir o prÃ³prio mapa.", ["Quer pensar verdade em obra, vida ou filosofia?"]),
    createConcept("morte", "Morte", ["morte", "morrer", "fim da vida"], "Morte Ã© o limite radical da vida fÃ­sica e uma das grandes perguntas humanas.", "limite que desperta filosofia.", "lembranÃ§a de viver com prioridade.", "passagem, juÃ­zo e esperanÃ§a em Deus, conforme a fÃ© cristÃ£.", "evento biolÃ³gico e questÃ£o existencial.", "a morte dÃ¡ peso Ã  memÃ³ria, ao amor e ao que escolhemos construir.", "Se essa pergunta vier de dor intensa ou risco, apoio humano imediato vem antes da reflexÃ£o.", ["Quer uma visÃ£o filosÃ³fica, bÃ­blica ou prÃ¡tica sobre finitude?"])
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
      title: "PropÃ³sito",
      description: "Perguntas sobre caminho, sentido, construÃ§Ã£o e valor do esforÃ§o.",
      relatedQuestions: ["O que eu vou ser?", "Estou no caminho certo?", "Qual meu propÃ³sito?", "Isso vale a pena?"],
      keywords: ["o que eu vou ser", "estou no caminho certo", "qual meu proposito", "qual meu propÃ³sito", "meu proposito", "meu propÃ³sito", "o que estou tentando construir", "isso vale a pena", "vale a pena continuar"],
      baseAnswer: "VocÃª parece estar perguntando sobre propÃ³sito, nÃ£o sÃ³ sobre produtividade.",
      memoryAnswer: "Pelo que estÃ¡ salvo localmente, seu caminho aparece ligado a projetos, objetivos e escolhas que vocÃª vem tentando transformar em algo concreto."
    },
    capacity: {
      title: "Capacidade",
      description: "Perguntas sobre conseguir, falhar, atraso, medo e confianÃ§a prÃ¡tica.",
      relatedQuestions: ["SerÃ¡ que vou dar conta?", "Tenho capacidade?", "Vou conseguir?", "E se eu falhar?"],
      keywords: ["vou dar conta", "serÃ¡ que vou dar conta", "sera que vou dar conta", "tenho capacidade", "estou atrasado", "vou conseguir", "e se eu falhar", "se eu falhar", "nao vou conseguir", "nÃ£o vou conseguir"],
      baseAnswer: "Essa pergunta costuma aparecer quando algo importante comeÃ§a a ficar real.",
      memoryAnswer: "Pelo que existe nas suas memÃ³rias locais, vocÃª nÃ£o estÃ¡ parado: hÃ¡ sinais de construÃ§Ã£o, projeto e continuidade."
    },
    belonging: {
      title: "Pertencimento",
      description: "Perguntas sobre aceitaÃ§Ã£o, respeito, vÃ­nculo, solidÃ£o e cuidado humano.",
      relatedQuestions: ["Sou aceito?", "Sou amado?", "Estou sozinho?", "AlguÃ©m se importa comigo?"],
      keywords: ["sou aceito", "sou amado", "as pessoas me respeitam", "estou sozinho", "alguem se importa comigo", "alguÃ©m se importa comigo", "as pessoas gostam de mim", "realmente gostam de mim", "ninguem se importa", "ninguÃ©m se importa"],
      baseAnswer: "VocÃª parece estar perguntando sobre pertencimento, nÃ£o apenas sobre uma opiniÃ£o rÃ¡pida.",
      memoryAnswer: "Eu posso usar suas memÃ³rias para lembrar projetos e vÃ­nculos registrados, mas nÃ£o consigo medir o afeto real das pessoas por vocÃª."
    },
    direction: {
      title: "DireÃ§Ã£o",
      description: "Perguntas sobre prÃ³ximo passo, comeÃ§o, continuidade e sensaÃ§Ã£o de estar perdido.",
      relatedQuestions: ["Para onde vou agora?", "Qual o prÃ³ximo passo?", "Por onde comeÃ§o?", "Estou perdido."],
      keywords: ["para onde vou agora", "qual o proximo passo", "qual o prÃ³ximo passo", "o que faco depois", "o que faÃ§o depois", "por onde comeÃ§o", "por onde comeco", "estou perdido", "estou perdida", "o que faÃ§o agora", "o que faco agora"],
      baseAnswer: "VocÃª parece estar procurando direÃ§Ã£o, nÃ£o apenas uma resposta rÃ¡pida.",
      memoryAnswer: "Pelo que jÃ¡ estÃ¡ salvo, vocÃª costuma avanÃ§ar melhor quando transforma uma ideia grande em uma prÃ³xima aÃ§Ã£o pequena."
    },
    legacy: {
      title: "Legado",
      description: "Perguntas sobre vida, futuro, orgulho, obra pessoal e o que ficarÃ¡ depois.",
      relatedQuestions: ["Minha vida estÃ¡ valendo a pena?", "O que vai ficar de mim?", "Estou construindo algo importante?", "O que estou deixando para o mundo?"],
      keywords: ["minha vida esta valendo a pena", "minha vida estÃ¡ valendo a pena", "o que vai ficar de mim", "estou construindo algo importante", "vou me orgulhar disso", "vou me orgulhar disso no futuro", "o que estou deixando para o mundo", "o que vai restar de mim"],
      baseAnswer: "Essa Ã© uma pergunta maior do que produtividade.",
      memoryAnswer: "Nas suas memÃ³rias locais, legado aparece mais claramente quando projetos, objetivos e marcos comeÃ§am a formar uma jornada."
    }
  };

  const ELO_PATTERN_QUESTIONS = {
    insistence: [
      "no que eu estou insistindo",
      "estou insistindo em que",
      "estou insistindo em quÃª",
      "o que eu venho repetindo",
      "o que aparece muito na minha historia",
      "o que aparece muito na minha histÃ³ria"
    ],
    evolution: [
      "o que mudou em mim",
      "eu evolui",
      "eu evoluÃ­",
      "minha evolucao",
      "minha evoluÃ§Ã£o"
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
      "qual padrÃ£o vocÃª percebe em mim",
      "qual padrao percebe em mim",
      "qual padrÃ£o percebe em mim",
      "que padrao voce percebe",
      "que padrÃ£o vocÃª percebe"
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
      title: "Como criar meu primeiro relatÃ³rio?",
      keywords: ["primeiro relatorio", "criar relatorio", "novo relatorio", "relatorio qualidade", "comeÃ§ar"],
      shortAnswer: "Para criar seu primeiro relatÃ³rio, cadastre um cliente, cadastre uma obra e depois abra RelatÃ³rios.",
      fullAnswer: "No ObraReport, o relatÃ³rio precisa estar vinculado a uma obra. O caminho mais simples Ã©: Clientes > Novo cliente, Obras > Nova obra, RelatÃ³rios > Criar relatÃ³rio. Depois vocÃª preenche dados, fotos, inconformidades, revisÃ£o e gera o PDF.",
      nextAction: "No dashboard, use o atalho Fazer RelatÃ³rio de Qualidade.",
      canSave: true
    },
    {
      category: "clientes",
      title: "Como cadastrar cliente?",
      keywords: ["cliente", "cadastrar cliente", "novo cliente", "proprietario", "contratante"],
      shortAnswer: "Abra Clientes e preencha o cadastro bÃ¡sico do cliente.",
      fullAnswer: "Use a tela Clientes para informar nome, documento, telefone, e-mail e observaÃ§Ãµes. Esse cadastro ajuda a vincular obras, relatÃ³rios, RDOs e documentos ao cliente correto.",
      nextAction: "Clique em Clientes no menu lateral ou no card Novo cliente do dashboard.",
      canSave: true
    },
    {
      category: "obras",
      title: "Como cadastrar obra?",
      keywords: ["obra", "cadastrar obra", "nova obra", "endereco", "tipo de obra"],
      shortAnswer: "Abra Obras, escolha o cliente e cadastre os dados da obra.",
      fullAnswer: "A obra organiza relatÃ³rios, RDOs, materiais e documentos. Para cadastrar, escolha um cliente, informe nome da obra, endereÃ§o, tipo e status.",
      nextAction: "Clique em Obras no menu lateral ou use o botÃ£o Nova obra.",
      canSave: true
    },
    {
      category: "fotos",
      title: "Como adicionar fotos?",
      keywords: ["foto", "fotos", "adicionar foto", "imagem", "anexo", "ocorrencia com foto"],
      shortAnswer: "No relatÃ³rio, avance atÃ© a etapa Fotos e adicione imagens da obra.",
      fullAnswer: "As fotos sÃ£o usadas para registrar evidÃªncias visuais do relatÃ³rio. Depois de criar ou abrir um relatÃ³rio, vÃ¡ para a etapa Fotos, selecione imagens e revise as legendas antes de gerar o PDF.",
      nextAction: "Abra um relatÃ³rio e clique em Fotos no progresso do relatÃ³rio.",
      canSave: true
    },
    {
      category: "pdf",
      title: "Como gerar PDF?",
      keywords: ["pdf", "gerar pdf", "exportar pdf", "documento", "imprimir", "salvar pdf"],
      shortAnswer: "Abra o relatÃ³rio ou RDO e use o botÃ£o de gerar PDF.",
      fullAnswer: "O PDF Ã© o documento final para entrega. Em relatÃ³rios, preencha as etapas e vÃ¡ para Gerar. No RDO, use Gerar PDF do DiÃ¡rio. O navegador pode abrir uma janela de impressÃ£o ou visualizaÃ§Ã£o para salvar o arquivo.",
      nextAction: "Se estiver no dashboard, use o atalho Fazer RelatÃ³rio de Qualidade ou abra DiÃ¡rio de Obras para gerar o PDF do RDO.",
      canSave: true
    },
    {
      category: "pdf",
      title: "O PDF nÃ£o gerou, o que fazer?",
      keywords: ["pdf nao gerou", "pdf nÃ£o gerou", "erro pdf", "bloqueou popup", "nao abriu pdf", "nÃ£o abriu pdf"],
      shortAnswer: "Confira se o navegador bloqueou pop-ups e se os campos principais foram preenchidos.",
      fullAnswer: "Quando o PDF nÃ£o abre, normalmente o navegador bloqueou a nova janela, algum campo obrigatÃ³rio ficou vazio ou o relatÃ³rio ainda nÃ£o foi salvo. Libere pop-ups para o site, revise os campos e tente novamente. O ObraReport nÃ£o alterou seu relatÃ³rio ao falhar a abertura.",
      nextAction: "Tente gerar novamente depois de liberar pop-ups e revisar os dados obrigatÃ³rios.",
      canSave: true
    },
    {
      category: "rdo",
      title: "Como usar o DiÃ¡rio de Obras/RDO?",
      keywords: ["rdo", "diario", "diÃ¡rio", "diario de obras", "diÃ¡rio de obras", "registro diario"],
      shortAnswer: "Abra DiÃ¡rio de Obras e registre identificaÃ§Ã£o, execuÃ§Ã£o, materiais, ocorrÃªncias, fotos e encerramento.",
      fullAnswer: "O RDO registra a rotina da obra: clima, equipe, serviÃ§os executados, produÃ§Ã£o, materiais consumidos, intercorrÃªncias, seguranÃ§a, fotos e resumo. Ele ajuda a criar histÃ³rico tÃ©cnico e pode ser exportado em PDF.",
      nextAction: "Use o atalho Fazer DiÃ¡rio de Obra (RDO) no dashboard.",
      canSave: true
    },
    {
      category: "materiais",
      title: "Como registrar materiais?",
      keywords: ["materiais", "material", "consumo", "cimento", "bloco", "auditoria", "composicao"],
      shortAnswer: "No RDO, use a seÃ§Ã£o Materiais para registrar consumo e comparar com a produÃ§Ã£o executada.",
      fullAnswer: "Materiais consumidos ficam no DiÃ¡rio de Obras. VocÃª pode registrar quantidade, unidade, valor e observaÃ§Ã£o. Quando houver produÃ§Ã£o executada e composiÃ§Ã£o, o sistema ajuda a estimar consumo e mostra diferenÃ§as para auditoria simples.",
      nextAction: "Abra DiÃ¡rio de Obras > Materiais.",
      canSave: true
    },
    {
      category: "primeiros_passos",
      title: "Como usar a Obra Exemplo?",
      keywords: ["obra exemplo", "demonstraÃ§Ã£o", "demonstracao", "teste", "exemplo pronto"],
      shortAnswer: "Use Carregar Obra Exemplo para ver cliente, obra, relatÃ³rio, RDO, materiais e PDF em poucos segundos.",
      fullAnswer: "A Obra Exemplo cria dados demonstrativos marcados como demonstraÃ§Ã£o. Ela serve para testar o fluxo sem misturar com dados reais e entender como o ObraReport organiza relatÃ³rio, RDO, materiais, auditoria e PDF.",
      nextAction: "No dashboard, clique em Carregar Obra Exemplo.",
      canSave: true
    },
    {
      category: "planos",
      title: "Como funcionam os planos?",
      keywords: ["plano", "planos", "contratar", "profissional", "empresa", "gratuito", "preÃ§o", "preco"],
      shortAnswer: "O ObraReport tem planos Gratuito, Profissional e Empresa, com contrataÃ§Ã£o assistida nesta fase.",
      fullAnswer: "Os planos organizam limites e recursos. Nesta fase, pagamento e ativaÃ§Ã£o sÃ£o assistidos; o sistema nÃ£o deve ser entendido como checkout automÃ¡tico ou integraÃ§Ã£o real de pagamento.",
      nextAction: "Abra Planos para ver limites e solicitar acesso pelo WhatsApp.",
      canSave: true
    },
    {
      category: "limites",
      title: "O plano gratuito tem limite?",
      keywords: ["limite", "gratuito", "plano gratuito", "quantos relatorios", "limite fotos", "limite ia"],
      shortAnswer: "Sim. O plano gratuito Ã© pensado para testar o ObraReport com limites.",
      fullAnswer: "O plano gratuito permite testar o SaaS com limites de clientes, obras, relatÃ³rios, fotos e IA. Os limites aparecem na tela Planos/Uso atual. Para uso contÃ­nuo, o fluxo indicado Ã© solicitar acesso ao plano adequado.",
      nextAction: "Abra Planos e confira o uso atual.",
      canSave: true
    },
    {
      category: "suporte",
      title: "Como enviar resumo por WhatsApp?",
      keywords: ["whatsapp", "enviar whatsapp", "resumo whatsapp", "compartilhar", "mensagem"],
      shortAnswer: "No RDO, use o botÃ£o de WhatsApp para abrir uma mensagem pronta.",
      fullAnswer: "O ObraReport prepara um resumo profissional com obra, cliente, produÃ§Ã£o, materiais, ocorrÃªncias e seguranÃ§a. Ele abre o WhatsApp Web ou app com o texto preenchido. NÃ£o Ã© uma integraÃ§Ã£o oficial de API do WhatsApp.",
      nextAction: "Abra um RDO e clique em Enviar resumo por WhatsApp.",
      canSave: true
    },
    {
      category: "ia",
      title: "A IA faz diagnÃ³stico definitivo?",
      keywords: ["diagnostico definitivo", "diagnÃ³stico definitivo", "ia substitui", "laudo definitivo", "responsabilidade tecnica"],
      shortAnswer: "NÃ£o. A IA ajuda a revisar e organizar texto, mas nÃ£o substitui avaliaÃ§Ã£o tÃ©cnica profissional.",
      fullAnswer: "A IA do ObraReport Ã© apoio tÃ©cnico para redaÃ§Ã£o, organizaÃ§Ã£o e revisÃ£o. Ela nÃ£o substitui vistoria, responsabilidade tÃ©cnica, ART/RRT, laudo profissional ou decisÃ£o de engenheiro/arquiteto habilitado.",
      nextAction: "Use a IA como apoio e revise tudo antes de entregar.",
      canSave: true
    },
    {
      category: "ia",
      title: "Como usar a IA de texto?",
      keywords: ["ia texto", "usar ia", "melhorar texto", "sugestao ia", "sugestÃ£o ia"],
      shortAnswer: "Use os botÃµes de IA nos campos tÃ©cnicos para gerar uma sugestÃ£o e revise antes de aceitar.",
      fullAnswer: "A IA de texto ajuda a transformar anotaÃ§Ãµes em linguagem mais clara e tÃ©cnica. Depois da sugestÃ£o, revise, aceite ou recuse. O usuÃ¡rio continua responsÃ¡vel pelo conteÃºdo final.",
      nextAction: "Abra um relatÃ³rio ou RDO e procure os botÃµes Melhorar com IA/Gerar texto.",
      canSave: true
    },
    {
      category: "suporte",
      title: "Como falar com suporte?",
      keywords: ["suporte", "ajuda", "falar com suporte", "whatsapp suporte", "atendimento"],
      shortAnswer: "Use o botÃ£o Suporte WhatsApp do Elo. Se nÃ£o houver nÃºmero configurado, o Elo avisarÃ¡.",
      fullAnswer: "O suporte por WhatsApp Ã© assistido. Quando o nÃºmero estiver configurado, o Elo abrirÃ¡ uma conversa com uma mensagem pronta. NÃ£o hÃ¡ API oficial do WhatsApp integrada nesta versÃ£o.",
      nextAction: "Clique em Suporte WhatsApp no painel do Elo.",
      canSave: true
    },
    {
      category: "primeiros_passos",
      title: "O que vocÃª consegue fazer?",
      keywords: ["o que voce consegue fazer", "o que vocÃª consegue fazer", "o que faz", "ajuda", "elo"],
      shortAnswer: "Eu ajudo vocÃª a usar relatÃ³rios, PDF, RDO, fotos, materiais, planos e suporte.",
      fullAnswer: "Eu sou o Elo Assistente do ObraReport. Nesta versÃ£o, lembro dÃºvidas neste navegador, procuro na base local de ajuda, respondo perguntas rÃ¡pidas e preparo a arquitetura para busca futura na internet.",
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
      { prefix: "minha mÃ£e se chama ", category: "pessoa", importance: "alta", label: "Minha mae se chama " },
      { prefix: "meu filho se chama ", category: "pessoa", importance: "alta", label: "Meu filho se chama " },
      { prefix: "meu projeto principal e ", category: "projeto", importance: "alta", label: "Meu projeto principal e " },
      { prefix: "meu projeto principal Ã© ", category: "projeto", importance: "alta", label: "Meu projeto principal e " },
      { prefix: "meu objetivo e ", category: "objetivo", importance: "alta", label: "Meu objetivo e " },
      { prefix: "meu objetivo Ã© ", category: "objetivo", importance: "alta", label: "Meu objetivo e " },
      { prefix: "eu gosto de ", category: "preferencia", importance: "media", label: "Eu gosto de " },
      { prefix: "eu nao gosto de ", category: "preferencia", importance: "media", label: "Eu nao gosto de " },
      { prefix: "eu nÃ£o gosto de ", category: "preferencia", importance: "media", label: "Eu nao gosto de " }
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
    if (hasAnyTerm(normalized, ["nome", "mae", "mÃ£e", "filho", "filha", "pai", "familia", "famÃ­lia"])) {
      return "pessoa";
    }
    if (hasAnyTerm(normalized, ["projeto", "stock ia", "obrareport", "cadista"])) {
      return "projeto";
    }
    if (hasAnyTerm(normalized, ["objetivo", "meta", "prioridade"])) {
      return "objetivo";
    }
    if (hasAnyTerm(normalized, ["gosto", "nao gosto", "nÃ£o gosto", "prefiro", "preferencia", "preferÃªncia"])) {
      return "preferencia";
    }
    if (hasAnyTerm(normalized, ["decidi", "decisao", "decisÃ£o"])) {
      return "decisao";
    }
    if (hasAnyTerm(normalized, ["aconteceu", "evento", "hoje", "ontem"])) {
      return "evento";
    }
    return "outro";
  }

  function inferEloMemoryImportance(text) {
    const normalized = normalizeText(text);
    if (hasAnyTerm(normalized, ["importante", "principal", "objetivo", "mae", "mÃ£e", "filho", "nome"])) {
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
    const prefixes = ["esqueca que ", "esqueÃ§a que ", "apague essa memoria ", "apague essa memÃ³ria "];

    if (normalized === "esqueca isso" || normalized === "esqueÃ§a isso" || normalized === "apague essa memoria" || normalized === "apague essa memÃ³ria") {
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
      "o que vocÃª lembra de mim",
      "quem sou eu",
      "o que voce sabe sobre mim",
      "o que vocÃª sabe sobre mim",
      "o que voce lembra sobre minha mae",
      "o que vocÃª lembra sobre minha mÃ£e",
      "o que voce lembra sobre minha mÃ£e"
    ]);
  }

  function buildEloLongTermMemoryAnswer(message) {
    const memories = getEloLongTermMemories();
    const normalized = normalizeText(message);
    const filtered = hasAnyTerm(normalized, ["mae", "mÃ£e"])
      ? memories.filter(function (item) {
        return hasAnyTerm(normalizeText(item.text), ["mae", "mÃ£e"]);
      })
      : memories;

    if (!filtered.length) {
      return "Agora eu sÃ³ tenho acesso ao contexto recente desta conversa. Se vocÃª me pedir para lembrar algo importante, eu guardo neste navegador.";
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
          nome: "nÃ£o informado",
          cidade: "nÃ£o informada",
          uf: "nÃ£o informada",
          area_m2: null,
          tipo_obra: "nÃ£o informado",
          padrao_construtivo: "nÃ£o informado",
          etapa_atual: "nÃ£o informada",
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
        nome: sanitizeUserText(item.nome) || "nÃ£o informado",
        cidade: sanitizeUserText(item.cidade) || "nÃ£o informada",
        uf: sanitizeUserText(item.uf).toUpperCase() || "nÃ£o informada",
        area_m2: parseEloOperationalNumber_(item.area_m2) || null,
        tipo_obra: sanitizeUserText(item.tipo_obra) || "nÃ£o informado",
        padrao_construtivo: sanitizeUserText(item.padrao_construtivo) || "nÃ£o informado",
        etapa_atual: sanitizeUserText(item.etapa_atual) || "nÃ£o informada",
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
      // MemÃ³ria de obra local pode falhar em modo privado. O Elo segue sem persistir.
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
    return /\b(?:minha\s+obra|obra|projeto|residencia|residÃªncia|casa)\b/.test(text) || facts.nome || facts.cidade || facts.uf || facts.area_m2 || facts.padrao_construtivo || facts.etapa_atual;
  }

  function isEloWorkMemoryQuestion_(message) {
    const text = normalizeText(message || "");
    return /qual\s+contexto\s+voce\s+tem|qual\s+contexto\s+voc?\s+tem|lembra\s+(?:da\s+)?minha\s+obra|qual\s+cidade\s+da\s+obra|qual\s+uf\s+da\s+obra|use\s+a\s+cidade\s+da\s+obra|qual\s+referencia\s+de\s+uf|qual\s+refer?ncia\s+de\s+uf|o\s+que\s+voce\s+sabe\s+da\s+minha\s+obra|o\s+que\s+voc?\s+sabe\s+da\s+minha\s+obra|memoria\s+da\s+obra|mem?ria\s+da\s+obra|obra\s+atual/.test(text);
  }

  function formatEloWorkMemorySavedSummary_(project) {
    const parts = [];
    if (project.nome && project.nome !== "nÃ£o informado") parts.push(project.nome);
    if ((project.cidade && project.cidade !== "nÃ£o informada") || (project.uf && project.uf !== "nÃ£o informada")) {
      parts.push(((project.cidade && project.cidade !== "nÃ£o informada") ? project.cidade : "cidade nÃ£o informada") + "/" + ((project.uf && project.uf !== "nÃ£o informada") ? project.uf : "UF nÃ£o informada"));
    }
    if (project.area_m2) parts.push(formatEloWallPremiseMeasure_(project.area_m2, "mÂ²"));
    if (project.padrao_construtivo && project.padrao_construtivo !== "nÃ£o informado") parts.push(project.padrao_construtivo);
    if (project.etapa_atual && project.etapa_atual !== "nÃ£o informada") parts.push("etapa " + project.etapa_atual);
    return parts.length ? parts.join(", ") : "obra atual";
  }

  function buildEloWorkMemorySavedAnswer_(message) {
    const project = updateEloWorkMemoryFromMessage_(message);
    const summary = formatEloWorkMemorySavedSummary_(project);
    const answer = "Entendi. Salvei na memÃ³ria da obra: " + summary + ". Vou usar esses dados como contexto nas prÃ³ximas perguntas tÃ©cnicas.";
    return {
      shortAnswer: "Salvei esses dados na memÃ³ria da obra.",
      fullAnswer: answer,
      nextAction: "FaÃ§a uma pergunta tÃ©cnica quando quiser usar esse contexto.",
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
      "- Obra/projeto: " + (obra.nome || "nÃ£o informado"),
      "- Cidade/UF: " + ((obra.cidade && obra.cidade !== "nÃ£o informada") ? obra.cidade : "nÃ£o informada") + " / " + ((obra.uf && obra.uf !== "nÃ£o informada") ? obra.uf : "nÃ£o informada"),
      "- Ãrea aproximada da obra: " + (obra.area_m2 ? formatEloWallPremiseMeasure_(obra.area_m2, "mÂ²") : "nÃ£o informada"),
      "- Tipo de obra: " + (obra.tipo_obra || "nÃ£o informado"),
      "- PadrÃ£o construtivo: " + (obra.padrao_construtivo || "nÃ£o informado"),
      "- Etapa atual: " + (obra.etapa_atual || "nÃ£o informada")
    ];
  }



  function isEloBudgetRecordTheme_(theme, intent) {
    const value = normalizeText([theme || "", intent || ""].join(" "));
    return /residential_budget_package|technical_proposal_package|wall_complete_package|foundation_package|structural_package|diagnostico_operacional_obra|documento_operacional_pdf|rdo_operacional|almoxarifado_operacional|relatorios_operacionais|stock_obras_composicao/.test(value);
  }

  function getEloBudgetBrainSubtype_(theme, intent, question) {
    const value = normalizeText([theme || "", intent || "", question || ""].join(" "));
    if (/residential_budget_package|orcamento_residencial|orcamento\s+residencial|residencial|casa/.test(value)) return "residential_preliminary";
    if (/wall_complete_package|elo_operacional_parede|orcamento_parede|parede|alvenaria|bloco|tijolo/.test(value)) return "wall";
    if (/stock_obras_composicao|orcamentista_assistido|briefing_composicao|composi..o|composicao|sinapi|orse/.test(value)) return "technical_composition";
    return "generic";
  }

  function detectEloBrainRoute_(question, response) {
    const text = normalizeText(question || "");
    const theme = normalizeText(response && response.sessionTheme || "");
    const intent = normalizeText(response && response.sessionIntent || "");
    const joined = [theme, intent, text].join(" ");
    if (/que\s+saco|cansad[oa]|nao\s+funciona|n.o\s+funciona|frustrad[oa]|ta\s+dificil|t.\s+dif.cil|estou\s+perdido|estou\s+perdida/.test(text) || /acolhimento|apoio_pratico/.test(joined)) return "support";
    if (/cadista|\bplanta\b|planta\s+baixa|terreno|quartos?|su.te|suite|garagem|ambientes?|prancha|dxf/.test(text) || /cadista/.test(joined)) return "cadista";
    if (/estoque\s+da\s+obra|dar\s+baixa|baixa\s+no\s+estoque|stock\s+obras|stock\s+ai\s+obras/.test(text) || /stock_obras|estoque_obra/.test(joined)) return "stock_obras";
    if (/\brdo\b|di.rio\s+de\s+obra|di.rio\s+de\s+obras|fazer\s+di.rio|gerar\s+rdo|rdo\s+de\s+hoje|registrar\s+ocorr.ncia|ocorr.ncia\s+de\s+atraso|chuva\s+e\s+concretagem|equipe/.test(text) || /(^|_)rdo|rdo(_|$)/.test(joined)) return "rdo";
    if (/infiltra|fissura|trinca|umidade|patologia|vistoria|inconformidade|relatorio\s+tecnico|relat.rio\s+t.cnico/.test(text) || /relatorio|patologia|vistoria|inconformidade/.test(joined)) return "report";
    if (/orcamento|or.amento|orcar|or.ar|\borca\b|custo|valor|preco|pre.o|quanto\s+custa|quanto\s+vai\s+dar|tabela\s+(?:sample|teste)|\bsample\b|parede.*bloco.*\d+\s*x\s*\d+\s*x\s*\d+|bdi|composi..o|composicao|sinapi|orse/.test(text) || /budget|orcamento|composicao|proposta/.test(joined)) return "budget";
    if (/parede|bloco|ceramico|cer.mico|reboco|contrapiso|pintura|telhado|\bpiso\b|concreto|\bforma\b|armacao|arma..o|alvenaria|chapisco|embo.o|servico\s+tecnico|servi.o\s+t.cnico/.test(text) || /base_tecnica|geometria_obras|premissas_quantitativo/.test(joined)) return "technical";
    return "conversational";
  }

  function applyEloBrainMarker_(question, response) {
    if (!response || typeof response !== "object") return response;
    const brain = detectEloBrainRoute_(question, response);
    response.brain = brain;
    response.brainMarker = brain;
    if (brain === "budget") {
      response.budgetBrainSubtype = getEloBudgetBrainSubtype_(response.sessionTheme, response.sessionIntent, question);
    }
    return response;
  }

  function rememberEloBudgetSource_(question, response, answer) {
    if (!response || response.canSave === false) return;
    if (!isEloBudgetRecordTheme_(response.sessionTheme, response.sessionIntent)) return;
    const rawAnswer = String(answer || response.fullAnswer || response.shortAnswer || "").trim();
    if (!rawAnswer) return;
    ELO_SESSION_MEMORY.lastBudgetSource = {
      question: sanitizeUserText(question || "").slice(0, 800),
      answer: rawAnswer.slice(0, 30000),
      theme: response.sessionTheme || "",
      intent: response.sessionIntent || "",
      budgetSubtype: getEloBudgetBrainSubtype_(response.sessionTheme, response.sessionIntent, question),
      nextAction: sanitizeUserText(response.nextAction || "").slice(0, 500),
      savedAt: new Date().toISOString()
    };
  }

  function writeEloBudgetJsonToStorage_(key, value) {
    const storage = getEloBrowserStorage_ ? getEloBrowserStorage_() : null;
    if (!storage || !key) return;
    try { storage.setItem(key, JSON.stringify(value)); } catch (error) {}
  }

  function normalizeEloBudgetRecords_(records) {
    return Array.isArray(records) ? records.filter(Boolean).map(function (record) {
      return Object.assign({}, record, {
        id: sanitizeUserText(record.id || ""),
        numero: sanitizeUserText(record.numero || ""),
        versao: Math.max(1, parseInt(record.versao || 1, 10) || 1),
        status: sanitizeUserText(record.status || "rascunho") || "rascunho",
        tipo: sanitizeUserText(record.tipo || "orcamento_residencial") || "orcamento_residencial"
      });
    }).filter(function (record) { return record.id && record.numero; }).slice(-80) : [];
  }

  function getEloBudgetRecords_() {
    return normalizeEloBudgetRecords_(readEloJsonFromStorage_(ELO_CONFIG.budgetRecordsStorageKey) || []);
  }

  function setEloBudgetRecords_(records) {
    writeEloBudgetJsonToStorage_(ELO_CONFIG.budgetRecordsStorageKey, normalizeEloBudgetRecords_(records));
  }

  function getEloBudgetRecordById_(id) {
    const needle = normalizeText(id || "");
    if (!needle) return null;
    return getEloBudgetRecords_().slice().reverse().find(function (record) {
      return normalizeText(record.id) === needle || normalizeText(record.numero) === needle || normalizeText((record.numero || "") + " v" + (record.versao || 1)) === needle;
    }) || null;
  }

  function getLatestEloBudgetRecord_() {
    const records = getEloBudgetRecords_();
    return records.length ? records[records.length - 1] : null;
  }

  function getNextEloBudgetNumber_() {
    const year = new Date().getFullYear();
    const counter = readEloJsonFromStorage_(ELO_CONFIG.budgetCounterStorageKey) || {};
    const next = Math.max(1, (parseInt(counter[String(year)] || 0, 10) || 0) + 1);
    counter[String(year)] = next;
    writeEloBudgetJsonToStorage_(ELO_CONFIG.budgetCounterStorageKey, counter);
    return "ELO-" + year + "-" + String(next).padStart(4, "0");
  }

  function simpleEloChecksum_(text) {
    const value = String(text || "");
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }
    return "chk_" + Math.abs(hash).toString(16);
  }

  function inferEloBudgetType_(source) {
    const theme = normalizeText([source && source.theme, source && source.intent, source && source.answer].join(" "));
    if (/diagnostico/.test(theme)) return "diagnostico_obra";
    if (/rdo/.test(theme)) return "rdo_resumo";
    if (/almoxarifado|estoque/.test(theme)) return "estoque_resumo";
    if (/relatorio/.test(theme)) return "relatorio_tecnico";
    if (/proposta/.test(theme)) return "proposta_tecnica";
    return "orcamento_residencial";
  }

  function extractEloBudgetRecordNumber_(message) {
    const match = String(message || "").match(/ELO-\d{4}-\d{4}(?:\s*v\d+)?/i);
    return match ? sanitizeUserText(match[0]).toUpperCase().replace(/\s+/g, " ") : "";
  }

  function buildEloBudgetRecordFromLastAnswer_() {
    const source = ELO_SESSION_MEMORY.lastBudgetSource || ELO_SESSION_MEMORY.lastTechnicalPackage || (ELO_SESSION_MEMORY.lastAnswer ? { answer: ELO_SESSION_MEMORY.lastAnswer, theme: ELO_SESSION_MEMORY.lastTheme, intent: "", question: ELO_SESSION_MEMORY.lastQuestion, nextAction: ELO_SESSION_MEMORY.lastRecommendation } : null);
    if (!source || !source.answer || !isEloBudgetRecordTheme_(source.theme, source.intent)) return null;
    const project = getActiveEloWorkProject_ ? getActiveEloWorkProject_() : {};
    const number = getNextEloBudgetNumber_();
    const now = new Date().toISOString();
    const markdown = String(source.answer || "").trim();
    const record = { id: number + "-v1", numero: number, tipo: inferEloBudgetType_(source), cliente: sanitizeUserText(project.cliente || project.client || "nao informado"), obra: sanitizeUserText(project.nome || project.name || project.obra || "obra atual"), cidade_uf: [project.cidade || project.city, project.uf].filter(Boolean).join("/") || "nao informado", data_criacao: now, data_atualizacao: now, versao: 1, status: "rascunho", titulo: inferEloBudgetType_(source).replace(/_/g, " "), resumo_executivo: extractEloProposalSection_(markdown, ["Resumo executivo", "Resposta principal"]) || "Registro preliminar assistido pelo Elo.", conteudo_markdown: markdown, conteudo_html: "", itens: [], quantitativos: extractEloProposalSection_(markdown, ["Quantitativos", "Totais consolidados", "Memoria de calculo", "MemÃ³ria de cÃ¡lculo"]), composicoes: extractEloProposalSection_(markdown, ["Composicoes utilizadas", "ComposiÃ§Ãµes utilizadas", "Composicoes oficiais utilizadas", "ComposiÃ§Ãµes oficiais utilizadas"]), bases_tecnicas: extractEloProposalSection_(markdown, ["Base tecnica utilizada", "Base tÃ©cnica utilizada", "Bases tecnicas", "Bases tÃ©cnicas"]), custos_encontrados: extractEloProposalSection_(markdown, ["Custos encontrados", "Custos"]), pendencias: extractEloProposalSection_(markdown, ["Pendencias tecnicas", "PendÃªncias tÃ©cnicas", "Composicoes nao localizadas", "ComposiÃ§Ãµes nÃ£o localizadas", "Observacoes tecnicas", "ObservaÃ§Ãµes tÃ©cnicas"]), avisos_profissionais: "Documento preliminar assistido por sistema computacional. Nao substitui projeto executivo, orcamento executivo, memorial descritivo ou responsabilidade tecnica profissional.", origem: "elo", hash_simples: simpleEloChecksum_(markdown) };
    record.conteudo_html = buildEloBudgetRecordHtml_(record, true);
    return record;
  }

  function saveEloBudgetRecord_(record) { if (!record) return null; const records = getEloBudgetRecords_(); records.push(record); setEloBudgetRecords_(records); return record; }
  function formatEloBudgetRecordDate_(iso) { const date = iso ? new Date(iso) : new Date(); return isNaN(date.getTime()) ? new Date().toLocaleDateString("pt-BR") : date.toLocaleDateString("pt-BR"); }

  function cleanEloDocumentText_(value, fallback) {
    const text = sanitizeUserText(value || "");
    return text || fallback || "nao informado";
  }

  function getEloDocumentSection_(record, names, fallback) {
    const safe = record || {};
    const direct = names.map(function (name) {
      return safe[name];
    }).find(function (value) {
      return sanitizeUserText(value || "");
    });
    if (direct) return sanitizeUserText(direct);
    const markdown = safe.conteudo_markdown || safe.fullAnswer || safe.resumo_executivo || "";
    const extracted = extractEloProposalSection_(markdown, names);
    return sanitizeUserText(extracted || fallback || "");
  }

  function normalizeEloProfessionalPdfData_(record, context) {
    const safe = record || {};
    const ctx = context || {};
    const markdown = safe.conteudo_markdown || safe.fullAnswer || safe.resumo_executivo || ctx.conteudo_markdown || "";
    const city = safe.cidade || safe.city || ctx.cidade || ctx.city || "";
    const uf = safe.uf || ctx.uf || "";
    const cidadeUf = safe.cidade_uf || [city, uf].filter(Boolean).join("/") || ctx.cidade_uf || "";
    const dataHora = safe.data_atualizacao || safe.data_criacao || ctx.dataHora || new Date().toISOString();
    const premissas = getEloDocumentSection_(safe, ["Premissas utilizadas", "Premissas", "Dados utilizados"], ctx.premissas || "");
    const quantitativos = getEloDocumentSection_(safe, ["Quantitativos", "Totais consolidados", "Memoria de calculo", "Memoria de calculo", "Mem?ria de c?lculo"], ctx.quantitativos || "");
    const composicoes = getEloDocumentSection_(safe, ["Composicoes utilizadas", "Composicoes oficiais utilizadas", "Composi??es utilizadas", "Composi??es oficiais utilizadas"], ctx.composicoes || "");
    const basesTecnicas = getEloDocumentSection_(safe, ["Base tecnica utilizada", "Base t?cnica utilizada", "Bases tecnicas", "Bases t?cnicas"], ctx.origemBase || safe.bases_tecnicas || "");
    const custos = getEloDocumentSection_(safe, ["Custos encontrados", "Custos", "Orcamento", "Or?amento"], ctx.custos || safe.custos_encontrados || "");
    const pendencias = getEloDocumentSection_(safe, ["Pendencias tecnicas", "Pend?ncias t?cnicas", "Composicoes nao localizadas", "Composi??es n?o localizadas", "Observacoes tecnicas", "Observa??es t?cnicas"], ctx.pendencias || safe.pendencias || "");
    const alertas = getEloDocumentSection_(safe, ["Alertas do auditor", "Alertas tecnicos", "Alertas t?cnicos", "Avisos profissionais"], ctx.alertas || safe.avisos_profissionais || "");
    return {
      nomeDocumento: cleanEloDocumentText_(ctx.nomeDocumento || safe.titulo || "Documento tecnico preliminar do Elo"),
      numero: cleanEloDocumentText_(safe.numero || ctx.numero, "nao informado"),
      versao: cleanEloDocumentText_(safe.versao || ctx.versao || "1", "1"),
      cliente: cleanEloDocumentText_(safe.cliente || ctx.cliente, "nao informado"),
      obra: cleanEloDocumentText_(safe.obra || safe.nome || safe.name || ctx.obra, "nao informado"),
      cidade: cleanEloDocumentText_(cidadeUf, "nao informado"),
      dataHora: cleanEloDocumentText_(formatEloBudgetRecordDate_(dataHora), "nao informado"),
      statusDocumento: cleanEloDocumentText_(safe.status || ctx.statusDocumento || "rascunho tecnico", "rascunho tecnico"),
      escopo: cleanEloDocumentText_(ctx.escopo || safe.escopo || safe.resumo_executivo || "Atendimento tecnico assistido pelo Elo conforme dados disponiveis.", "nao informado"),
      premissas: cleanEloDocumentText_(premissas, "nao informado"),
      servicos: cleanEloDocumentText_(ctx.servicos || safe.servicos || "nao informado", "nao informado"),
      quantitativos: cleanEloDocumentText_(quantitativos, "nao informado"),
      memoriaCalculo: cleanEloDocumentText_(ctx.memoriaCalculo || quantitativos || markdown, "nao informado"),
      composicoes: cleanEloDocumentText_(composicoes, "nao localizada"),
      custos: cleanEloDocumentText_(custos, "nao informado"),
      pendencias: cleanEloDocumentText_(pendencias, "Validar dados faltantes, projeto, memorial, composicoes oficiais, precos, BDI e responsabilidade tecnica profissional."),
      alertas: cleanEloDocumentText_(alertas, "Documento preliminar assistido por sistema computacional. Nao substitui revisao profissional."),
      origemBase: cleanEloDocumentText_(basesTecnicas, "nao localizada"),
      conteudoTecnico: cleanEloDocumentText_(markdown, "nao informado"),
      assinatura: cleanEloDocumentText_(ctx.assinatura || "Icaro Amaral Engenharia", "Icaro Amaral Engenharia")
    };
  }

  const ELO_BUDGET_V2_TECHNICAL_NOTICE = "Este documento é preliminar. Quantitativos e valores dependem de projeto, memorial, composições oficiais SINAPI/ORSE, BDI, encargos e preços vigentes.";

  function isEloBudgetV2PlainObject_(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function labelEloBudgetV2Key_(key) {
    return String(key || "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "item";
  }

  function formatEloBudgetV2Scalar_(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return sanitizeUserText(value);
  }

  function formatEloBudgetV2Block_(value, emptyText) {
    if (Array.isArray(value)) {
      const lines = value.map(function (item) {
        const formatted = formatEloBudgetV2Block_(item, "");
        return formatted ? "- " + formatted.replace(/\n/g, "\n  ") : "";
      }).filter(Boolean);
      return lines.join("\n") || emptyText || "nao informado";
    }
    if (isEloBudgetV2PlainObject_(value)) {
      const lines = Object.keys(value).map(function (key) {
        const formatted = formatEloBudgetV2Block_(value[key], "");
        return formatted ? "- " + labelEloBudgetV2Key_(key) + ": " + formatted.replace(/\n/g, "\n  ") : "";
      }).filter(Boolean);
      return lines.join("\n") || emptyText || "nao informado";
    }
    return formatEloBudgetV2Scalar_(value) || emptyText || "nao informado";
  }

  function formatEloBudgetV2NamedSection_(title, value, emptyText) {
    return title + "\n" + formatEloBudgetV2Block_(value, emptyText || "nao informado");
  }

  function hasEloBudgetV2ReliablePriceSource_(budget) {
    if (!isEloBudgetV2PlainObject_(budget)) return false;
    if (budget.isPending || budget.pending || budget.status === "pending" || budget.status === "pendente") return false;
    const trustedFlag = budget.sourceReliable || budget.trustedSource || budget.officialSource || budget.isOfficial || budget.hasOfficialPrices;
    if (trustedFlag === true) return true;
    const source = normalizeText([budget.source, budget.fonte, budget.base, budget.sourceType, budget.priceSource].filter(Boolean).join(" "));
    if (!source || /demonstrativa|demo|mock|estimativa|nao oficial|não oficial|preliminar/.test(source)) return false;
    return /sinapi|orse|oficial|validada|confiavel|confiável/.test(source);
  }

  function formatEloBudgetV2Budget_(budget) {
    if (!budget || (isEloBudgetV2PlainObject_(budget) && !Object.keys(budget).length)) {
      return "Valores pendentes. Nenhuma fonte oficial de precos foi informada.";
    }
    if (!hasEloBudgetV2ReliablePriceSource_(budget)) {
      return "Valores pendentes. Nao ha fonte confiavel oficial informada para precos, BDI, encargos e referencia vigente.";
    }
    return formatEloBudgetV2Block_(budget, "Valores pendentes.");
  }

  function buildBudgetV2ProfessionalPdfData(budgetDocumentData) {
    const safe = budgetDocumentData || {};
    const budgetId = formatEloBudgetV2Scalar_(safe.budgetId) || "nao informado";
    const confirmed = formatEloBudgetV2NamedSection_("Dados confirmados", safe.facts, "Nenhum dado confirmado informado.");
    const inherited = formatEloBudgetV2NamedSection_("Dados herdados", safe.inheritedFacts, "Nenhum dado herdado informado.");
    const assumed = formatEloBudgetV2NamedSection_("Dados assumidos", safe.assumptions, "Nenhuma premissa assumida informada.");
    const pending = formatEloBudgetV2NamedSection_("Dados pendentes", safe.pendingFields, "Nenhuma pendencia informada.");
    const scope = formatEloBudgetV2NamedSection_("Escopo preliminar", safe.scope, "Escopo preliminar nao informado.");
    const materials = formatEloBudgetV2NamedSection_("Lista de materiais qualitativa", safe.materials, "Lista qualitativa de materiais nao informada.");
    const quantities = formatEloBudgetV2NamedSection_("Quantitativos", safe.quantities, "Quantitativos pendentes.");
    const compositions = formatEloBudgetV2NamedSection_("Composicoes", safe.compositions, "Composicoes pendentes ou nao localizadas.");
    const costs = formatEloBudgetV2NamedSection_("Orcamento/valores", formatEloBudgetV2Budget_(safe.budget), "Valores pendentes.");
    const risks = formatEloBudgetV2NamedSection_("Riscos tecnicos", safe.risks, "Sem riscos tecnicos adicionais informados.");
    const nextSteps = formatEloBudgetV2NamedSection_("Proximos passos", safe.nextSteps, "Validar pendencias tecnicas antes de emitir orcamento executivo.");
    const technicalNotice = "Aviso tecnico\n" + ELO_BUDGET_V2_TECHNICAL_NOTICE;
    const consolidated = [
      "ELO Orçamentista V2",
      "Tipo: orçamento residencial preliminar",
      "ID interno do orçamento: " + budgetId,
      "",
      confirmed,
      "",
      inherited,
      "",
      assumed,
      "",
      pending,
      "",
      scope,
      "",
      materials,
      "",
      quantities,
      "",
      compositions,
      "",
      costs,
      "",
      risks,
      "",
      nextSteps,
      "",
      technicalNotice
    ].join("\n");
    return {
      numero: budgetId,
      versao: "2",
      titulo: "ELO Orçamentista V2",
      status: "orçamento residencial preliminar",
      resumo_executivo: "Orçamento residencial preliminar gerado a partir do estado técnico padronizado do ELO Orçamentista V2.",
      escopo: ["Tipo: orçamento residencial preliminar", "ID interno do orçamento: " + budgetId, "", scope].join("\n"),
      premissas: [confirmed, "", inherited, "", assumed].join("\n"),
      servicos: materials,
      quantitativos: quantities,
      memoriaCalculo: quantities,
      composicoes: compositions,
      custos_encontrados: costs,
      pendencias: pending,
      avisos_profissionais: [risks, "", nextSteps, "", technicalNotice].join("\n"),
      bases_tecnicas: hasEloBudgetV2ReliablePriceSource_(safe.budget) ? formatEloBudgetV2Block_(safe.budget && (safe.budget.source || safe.budget.fonte || safe.budget.base || safe.budget.priceSource), "Fonte confiavel informada no orcamento.") : "Valores pendentes. Fonte oficial de precos nao informada.",
      conteudo_markdown: consolidated,
      "Premissas utilizadas": [confirmed, "", inherited, "", assumed].join("\n"),
      "Quantitativos": quantities,
      "Composicoes utilizadas": compositions,
      "Custos encontrados": costs,
      "Pendencias tecnicas": pending,
      "Alertas tecnicos": [risks, "", nextSteps, "", technicalNotice].join("\n"),
      "Base tecnica utilizada": hasEloBudgetV2ReliablePriceSource_(safe.budget) ? formatEloBudgetV2Block_(safe.budget && (safe.budget.source || safe.budget.fonte || safe.budget.base || safe.budget.priceSource), "Fonte confiavel informada no orcamento.") : "Valores pendentes. Fonte oficial de precos nao informada.",
      origem: "elo_orcamentista_v2"
    };
  }
  function buildEloProfessionalPdfSection_(data) {
    const safe = data || {};
    function field(label, value) {
      return "<div class=\"elo-pdf-field\"><span>" + escapeEloHtml_(label) + "</span><strong>" + escapeEloHtml_(value || "nao informado") + "</strong></div>";
    }
    function block(title, value, tone) {
      return "<section class=\"elo-pdf-section " + (tone || "") + "\"><h2>" + escapeEloHtml_(title) + "</h2><div class=\"elo-pdf-box\">" + escapeEloHtml_(value || "nao informado") + "</div></section>";
    }
    return [
      "<article class=\"elo-professional-pdf\">",
      "<section class=\"elo-pdf-cover\">",
      "<div class=\"elo-pdf-brand\"><span>Icaro Amaral Engenharia</span><strong>ELO</strong></div>",
      "<p class=\"elo-pdf-kicker\">Documento tecnico de engenharia</p>",
      "<h1>" + escapeEloHtml_(safe.nomeDocumento) + "</h1>",
      "<p class=\"elo-pdf-subtitle\">Documento preliminar assistido por sistema computacional, preparado para revisao profissional e impressao em PDF.</p>",
      "<div class=\"elo-pdf-meta-grid\">",
      field("Numero", safe.numero + " v" + safe.versao),
      field("Status", safe.statusDocumento),
      field("Cliente", safe.cliente),
      field("Obra", safe.obra),
      field("Cidade/UF", safe.cidade),
      field("Data/hora", safe.dataHora),
      "</div>",
      "</section>",
      block("1. Escopo do atendimento", safe.escopo),
      block("2. Premissas usadas pelo Elo", safe.premissas),
      block("3. Servicos, orcamento e quantitativos", safe.servicos + "\n\n" + safe.quantitativos),
      block("4. Memoria de calculo", safe.memoriaCalculo),
      block("5. Composicoes tecnicas", safe.composicoes),
      block("6. Custos encontrados", safe.custos),
      block("7. Origem da base tecnica", safe.origemBase),
      block("8. Pendencias e informacoes faltantes", safe.pendencias, "is-warning"),
      block("9. Alertas tecnicos e limitacoes", safe.alertas, "is-alert"),
      block("10. Conteudo tecnico consolidado", safe.conteudoTecnico),
      "<section class=\"elo-pdf-signature\"><h2>Responsabilidade tecnica e revisao</h2><p>Este documento e preliminar e deve ser revisado por profissional habilitado antes de contratacao, compra, execucao, emissao oficial ou envio ao cliente.</p><div class=\"elo-pdf-sign-line\"></div><strong>" + escapeEloHtml_(safe.assinatura) + "</strong></section>",
      "<footer class=\"elo-pdf-footer\"><span>Icaro Amaral Engenharia / ObraReport / Elo</span><span>Pagina <span class=\"elo-page-number\"></span></span></footer>",
      "</article>"
    ].join("\n");
  }

  function buildEloProfessionalPdfDocument(record, context) {
    const ctx = context || {};
    const data = normalizeEloProfessionalPdfData_(record, ctx);
    const section = buildEloProfessionalPdfSection_(data);
    if (ctx.innerOnly) return section;
    const css = [
      "@page{size:A4;margin:16mm 14mm 18mm}",
      "html,body{margin:0;background:#dfe7ef;color:#111827;font-family:Arial,Helvetica,sans-serif}",
      "body{padding:24px}",
      ".elo-print-actions{max-width:920px;margin:0 auto 16px;text-align:right}",
      ".elo-print-actions button{background:#0f5ea8;color:#fff;border:0;border-radius:6px;padding:11px 16px;font-weight:700;cursor:pointer}",
      ".elo-professional-pdf{max-width:920px;margin:0 auto;background:#fff;box-shadow:0 18px 55px rgba(15,23,42,.18);padding:34px 38px 56px;line-height:1.48}",
      ".elo-pdf-cover{border-bottom:4px solid #0f5ea8;padding-bottom:22px;margin-bottom:22px}",
      ".elo-pdf-brand{display:flex;justify-content:space-between;gap:16px;color:#0f5ea8;text-transform:uppercase;font-size:12px;letter-spacing:.08em;font-weight:800}",
      ".elo-pdf-brand strong{font-size:18px;letter-spacing:.16em}",
      ".elo-pdf-kicker{margin:28px 0 8px;color:#64748b;text-transform:uppercase;font-size:12px;font-weight:800;letter-spacing:.1em}",
      "h1{margin:0;color:#0f172a;font-size:32px;line-height:1.08}",
      ".elo-pdf-subtitle{max-width:650px;color:#475569;font-size:14px}",
      ".elo-pdf-meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:22px}",
      ".elo-pdf-field{border:1px solid #d8e2ef;background:#f8fafc;padding:10px;min-height:54px}",
      ".elo-pdf-field span{display:block;color:#64748b;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}",
      ".elo-pdf-field strong{display:block;margin-top:4px;font-size:13px;color:#0f172a;white-space:pre-wrap}",
      ".elo-pdf-section{break-inside:avoid;margin:18px 0}",
      ".elo-pdf-section h2,.elo-pdf-signature h2{margin:0 0 8px;color:#0f5ea8;font-size:14px;text-transform:uppercase;letter-spacing:.08em}",
      ".elo-pdf-box{border:1px solid #d8e2ef;border-left:4px solid #0f5ea8;background:#fff;min-height:28px;padding:12px 14px;white-space:pre-wrap;font-size:13px}",
      ".elo-pdf-section.is-warning .elo-pdf-box{border-left-color:#b45309;background:#fff8ed}",
      ".elo-pdf-section.is-alert .elo-pdf-box{border-left-color:#991b1b;background:#fff5f5}",
      ".elo-pdf-signature{break-inside:avoid;margin-top:26px;border-top:1px solid #cbd5e1;padding-top:18px;font-size:13px}",
      ".elo-pdf-sign-line{width:280px;border-top:1px solid #0f172a;margin:34px 0 8px}",
      ".elo-pdf-footer{position:fixed;left:14mm;right:14mm;bottom:7mm;display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;padding-top:5px;color:#64748b;font-size:10px}",
      ".elo-page-number:after{content:counter(page)}",
      "@media print{html,body{background:#fff}.elo-print-actions{display:none}.elo-professional-pdf{box-shadow:none;max-width:none;padding:0}.elo-pdf-meta-grid{grid-template-columns:repeat(3,1fr)}}",
      "@media(max-width:720px){body{padding:12px}.elo-professional-pdf{padding:22px 18px 48px}.elo-pdf-meta-grid{grid-template-columns:1fr}h1{font-size:25px}}"
    ].join("");
    return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + escapeEloHtml_(data.numero !== "nao informado" ? data.numero : data.nomeDocumento) + "</title><style>" + css + "</style></head><body><div class=\"elo-print-actions\"><button onclick=\"window.print()\">Imprimir / Salvar como PDF</button></div>" + section + "</body></html>";
  }

  function buildEloBudgetRecordHtml_(record, innerOnly) {
    return buildEloProfessionalPdfDocument(record, { innerOnly: Boolean(innerOnly), nomeDocumento: "Proposta Tecnica Preliminar" });
  }

  function openEloProfessionalPdfDocument_(record, context) { const html = buildEloProfessionalPdfDocument(record, context || {}); if (typeof window !== "undefined" && window.open) { const popup = window.open("", "_blank"); if (popup && popup.document) { popup.document.open(); popup.document.write(html); popup.document.close(); try { popup.focus(); } catch (error) {} } } return html; }
  function openEloBudgetRecordPdf_(record) { return openEloProfessionalPdfDocument_(record, { nomeDocumento: "Proposta Tecnica Preliminar" }); }

  function buildEloBudgetSaveAnswer_(message) { const text = normalizeText(message || ""); if (!/salvar\s+orcamento|salvar\s+orÃ§amento|salvar\s+proposta|registrar\s+orcamento|registrar\s+orÃ§amento|guardar\s+esse\s+orcamento|guardar\s+esse\s+orÃ§amento|anexar\s+(?:a|Ã )\s+obra/.test(text)) return null; const record = buildEloBudgetRecordFromLastAnswer_(); if (!record) return { shortAnswer: "Nao encontrei orcamento recente para salvar.", fullAnswer: "Nao encontrei um orcamento/proposta recente para salvar. Gere primeiro um orcamento ou proposta tecnica.", nextAction: "Gere Parede Completa, Fundacao Completa, Orcamento Residencial ou Proposta Tecnica antes de salvar.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_save_empty" }; saveEloBudgetRecord_(record); return { shortAnswer: "Orcamento salvo com sucesso.", fullAnswer: ["Orcamento salvo com sucesso.", "", "Numero: " + record.numero, "Status: " + record.status, "Cliente: " + record.cliente, "Obra: " + record.obra, "", "Voce pode pedir:", "- baixar PDF", "- gerar nova versao", "- listar orcamentos"].join("\n"), nextAction: "Peca 'baixar PDF' para gerar o documento profissional.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_saved" }; }
  function buildEloBudgetListAnswer_(message) { const text = normalizeText(message || ""); if (!/listar\s+orcamentos|listar\s+orÃ§amentos|ultimos\s+orcamentos|Ãºltimos\s+orÃ§amentos/.test(text)) return null; const records = getEloBudgetRecords_(); if (!records.length) return { shortAnswer: "Nenhum orcamento salvo ainda.", fullAnswer: "Nenhum orcamento salvo ainda.", nextAction: "Gere e salve um orcamento para iniciar o historico local.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_list_empty" }; const lines = ["ORCAMENTOS SALVOS", ""]; records.slice(-10).reverse().forEach(function (record, index) { lines.push((index + 1) + ". " + record.numero + " v" + (record.versao || 1) + " - " + (record.obra || "obra atual") + " - " + (record.status || "rascunho") + " - " + formatEloBudgetRecordDate_(record.data_criacao)); }); return { shortAnswer: "Historico local de orcamentos.", fullAnswer: lines.join("\n"), nextAction: "Peca 'ver orcamento ELO-AAAA-0001' ou 'baixar PDF do orcamento ELO-AAAA-0001'.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_list" }; }
  function buildEloBudgetOpenAnswer_(message) { const text = normalizeText(message || ""); if (!/ver\s+orcamento|ver\s+orÃ§amento|abrir\s+orcamento|abrir\s+orÃ§amento/.test(text)) return null; const record = getEloBudgetRecordById_(extractEloBudgetRecordNumber_(message)) || getLatestEloBudgetRecord_(); if (!record) return { shortAnswer: "Nenhum orcamento salvo ainda.", fullAnswer: "Nenhum orcamento salvo ainda.", nextAction: "Gere e salve um orcamento antes de abrir.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_open_empty" }; return { shortAnswer: "Orcamento localizado: " + record.numero + ".", fullAnswer: [record.numero + " v" + (record.versao || 1), "Cliente: " + record.cliente, "Obra: " + record.obra, "Cidade/UF: " + record.cidade_uf, "Status: " + record.status, "", record.conteudo_markdown].join("\n"), nextAction: "Peca 'baixar PDF do orcamento " + record.numero + "' para gerar o documento.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_open" }; }
  function buildEloBudgetPdfAnswer_(message) { const text = normalizeText(message || ""); if (!/baixar\s+pdf|gerar\s+pdf|exportar\s+pdf|pdf\s+do\s+orcamento|pdf\s+do\s+or?amento|pdf\s+da\s+proposta|baixar\s+orcamento|baixar\s+or?amento|imprimir\s+orcamento|imprimir\s+or?amento|baixar\s+proposta/.test(text)) return null; const record = getEloBudgetRecordById_(extractEloBudgetRecordNumber_(message)) || getLatestEloBudgetRecord_(); if (!record && /orcamento|or?amento|proposta/.test(text)) return { shortAnswer: "Nenhum orcamento salvo ainda.", fullAnswer: "Nenhum orcamento/proposta salvo ainda. Gere e salve um orcamento antes de baixar o PDF profissional.", nextAction: "Gere Parede Completa, Fundacao Completa, Orcamento Residencial ou Proposta Tecnica antes de baixar o PDF.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_pdf_empty" }; if (!record) return null; const html = openEloBudgetRecordPdf_(record); return { shortAnswer: "PDF profissional preparado.", fullAnswer: ["PDF profissional preparado para " + record.numero + " v" + (record.versao || 1) + ".", "", "Use o botao 'Imprimir / Salvar como PDF' na janela aberta ou Ctrl+P para baixar o arquivo.", "", "HTML gerado:", html].join("\n"), nextAction: "Revise o documento antes de enviar ao cliente.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_pdf" }; }
  function buildEloBudgetVersionAnswer_(message) { const text = normalizeText(message || ""); if (!/gerar\s+nova\s+versao|gerar\s+nova\s+versÃ£o|nova\s+versao|nova\s+versÃ£o/.test(text)) return null; const base = getEloBudgetRecordById_(extractEloBudgetRecordNumber_(message)) || getLatestEloBudgetRecord_(); if (!base) return { shortAnswer: "Nenhum orcamento salvo para versionar.", fullAnswer: "Nenhum orcamento salvo para gerar nova versao.", nextAction: "Salve primeiro um orcamento ou proposta.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_version_empty" }; const records = getEloBudgetRecords_(); const nextVersion = records.filter(function (record) { return record.numero === base.numero; }).reduce(function (max, record) { return Math.max(max, record.versao || 1); }, base.versao || 1) + 1; const now = new Date().toISOString(); const clone = Object.assign({}, base, { id: base.numero + "-v" + nextVersion, versao: nextVersion, data_atualizacao: now, status: "revisao", hash_simples: simpleEloChecksum_((base.conteudo_markdown || "") + nextVersion + now) }); clone.conteudo_html = buildEloBudgetRecordHtml_(clone, true); saveEloBudgetRecord_(clone); return { shortAnswer: "Nova versao criada.", fullAnswer: "Nova versao criada.\n\nNumero: " + clone.numero + " v" + clone.versao + "\nStatus: " + clone.status + "\nObra: " + clone.obra, nextAction: "Peca 'baixar PDF do orcamento " + clone.numero + "' para exportar a versao mais recente.", canSave: false, sessionTheme: "elo_budget_record", sessionIntent: "budget_version" }; }
  function buildEloBudgetContinuationAnswer_(message) {
    const text = normalizeText(message || "");
    if (!/continuar\s+(?:meu\s+)?orcamento|continuar\s+(?:meu\s+)?or.amento|retomar\s+(?:meu\s+)?orcamento|retomar\s+(?:meu\s+)?or.amento/.test(text)) return null;
    const source = ELO_SESSION_MEMORY.lastBudgetSource || ELO_SESSION_MEMORY.lastTechnicalPackage || null;
    if (!source || !source.answer) {
      return {
        shortAnswer: "Qual orcamento voce quer continuar?",
        fullAnswer: [
          "Posso continuar, mas preciso saber qual linha de trabalho voce quer retomar:",
          "- orcamento residencial preliminar;",
          "- orcamento de parede/alvenaria;",
          "- orcamento por composicao tecnica SINAPI/ORSE."
        ].join("\n"),
        nextAction: "Responda com residencial, parede ou composicao tecnica.",
        canSave: false,
        sessionTheme: "orcamento_continuacao",
        sessionIntent: "pedir_tipo_orcamento"
      };
    }
    const subtype = source.budgetSubtype || getEloBudgetBrainSubtype_(source.theme, source.intent, source.question || message);
    const labels = {
      residential_preliminary: "orcamento residencial preliminar",
      wall: "orcamento de parede/alvenaria",
      technical_composition: "orcamento por composicao tecnica SINAPI/ORSE",
      generic: "orcamento anterior"
    };
    const nextBySubtype = {
      residential_preliminary: "Confirme cidade/UF, padrao, area, tipo de construcao, pavimentos e etapa desejada.",
      wall: "Continue com medidas da parede, dimensao do bloco, vaos, perdas, revestimento e base tecnica.",
      technical_composition: "Informe ou escolha a composicao SINAPI/ORSE, UF/mes, unidade e quantitativo do servico.",
      generic: "Diga se deseja seguir por residencial, parede ou composicao tecnica."
    };
    return {
      shortAnswer: "Vou retomar o " + (labels[subtype] || labels.generic) + ".",
      fullAnswer: [
        "Retomada de orcamento",
        "Tipo identificado: " + (labels[subtype] || labels.generic) + ".",
        "Ultimo pedido: " + (source.question || "nao informado"),
        "Proximo passo: " + (nextBySubtype[subtype] || nextBySubtype.generic),
        "Nao vou misturar esse fluxo com outro tipo de orcamento sem voce confirmar."
      ].join("\n"),
      nextAction: nextBySubtype[subtype] || nextBySubtype.generic,
      canSave: false,
      sessionTheme: "orcamento_continuacao",
      sessionIntent: "continuar_" + subtype
    };
  }

  function buildEloBudgetProductAnswer_(message) { return buildEloBudgetContinuationAnswer_(message) || buildEloBudgetSaveAnswer_(message) || buildEloBudgetListAnswer_(message) || buildEloBudgetOpenAnswer_(message) || buildEloBudgetVersionAnswer_(message) || buildEloBudgetPdfAnswer_(message); }

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
      const isNextSection = index > start && (/^\s*#{1,3}\s+/.test(current) || /^[A-ZÃÃ‰ÃÃ“ÃšÃ‚ÃŠÃ”ÃƒÃ•Ã‡0-9 .]{5,80}\s*$/.test(current)) && !/^\s*-/.test(current);
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
        .replace(/^- (.*)$/gm, "<p>â€¢ $1</p>")
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
      const client = clientMatch ? sanitizeUserText(clientMatch[1]) : "nÃ£o informado";
      const date = new Date().toLocaleDateString("pt-BR");
      const markdownLines = [
        "# PROPOSTA TÃ‰CNICA PRELIMINAR",
        "",
        "Cliente: " + client,
        "Obra: " + ((project.nome && project.nome !== "nÃ£o informado") ? project.nome : "obra atual"),
        "Data: " + date,
        "",
        "## RESUMO EXECUTIVO",
        "Documento preliminar aberto para organizaÃ§Ã£o do orÃ§amento assistido. Nenhum cÃ¡lculo novo foi criado nesta etapa.",
        "",
        "## DescriÃ§Ã£o simples",
        "Ainda nÃ£o hÃ¡ pacote tÃ©cnico consolidado vinculado a esta proposta. Use este documento como capa preliminar e gere Parede Completa, FundaÃ§Ã£o Completa, Pacote Estrutural ou OrÃ§amento Residencial Preliminar para preencher os quantitativos.",
        "",
        "## SERVIÃ‡OS CONSIDERADOS",
        "- FundaÃ§Ã£o: pendente de pacote tÃ©cnico.",
        "- Estrutura: pendente de pacote tÃ©cnico.",
        "- Alvenaria: pendente de pacote tÃ©cnico.",
        "- Revestimentos: pendente de pacote tÃ©cnico.",
        "",
        "## QUANTITATIVOS",
        "Nenhum quantitativo consolidado foi localizado na memÃ³ria tÃ©cnica atual.",
        "",
        "## COMPOSIÃ‡Ã•ES UTILIZADAS",
        "Nenhuma composiÃ§Ã£o SINAPI, ORSE ou base oficial validada foi localizada para esta proposta.",
        "",
        "## CUSTOS ENCONTRADOS",
        "Nenhum custo real foi encontrado. Nenhum valor foi estimado.",
        "",
        "## PENDÃŠNCIAS TÃ‰CNICAS",
        "- Gerar pacote tÃ©cnico antes do envio comercial.",
        "- Confirmar projeto, memorial, composiÃ§Ãµes oficiais e responsabilidade tÃ©cnica profissional.",
        "- AÃ§o estrutural nÃ£o calculado automaticamente. NecessÃ¡rio projeto estrutural quando aplicÃ¡vel.",
        "",
        "## RESPONSABILIDADE TÃ‰CNICA",
        "Documento preliminar assistido por sistema computacional.",
        "",
        "NÃ£o substitui projeto executivo, memorial descritivo, orÃ§amento executivo ou responsabilidade tÃ©cnica profissional.",
        "",
        "## HTML ESTRUTURADO",
        "```html",
        buildEloProposalHtml_("# PROPOSTA TÃ‰CNICA PRELIMINAR\n\n## RESUMO EXECUTIVO\nDocumento preliminar aberto para organizaÃ§Ã£o do orÃ§amento assistido.\n\n## QUANTITATIVOS\nNenhum quantitativo consolidado foi localizado.\n\n## COMPOSIÃ‡Ã•ES UTILIZADAS\nNenhuma composiÃ§Ã£o oficial localizada.\n\n## CUSTOS ENCONTRADOS\nNenhum custo real encontrado.\n\n## PENDÃŠNCIAS TÃ‰CNICAS\nGerar pacote tÃ©cnico antes do envio comercial."),
        "```"
      ];
      return {
        shortAnswer: "Proposta tÃ©cnica preliminar aberta sem custos estimados.",
        fullAnswer: markdownLines.join("\n"),
        nextAction: "Gere um pacote tÃ©cnico para preencher quantitativos e composiÃ§Ãµes antes de enviar ao cliente.",
        canSave: true,
        sessionTheme: "technical_proposal_package",
        sessionIntent: "technical_proposal_package_empty"
      };
    }
    const project = getActiveEloWorkProject_();
    const sourceText = source.answer;
    const executive = extractEloProposalSection_(sourceText, ["Resumo executivo", "Resposta principal"]) || "Proposta preliminar montada a partir do Ãºltimo pacote tÃ©cnico calculado pelo Elo.";
    const quantities = extractEloProposalSection_(sourceText, ["Quantitativos", "Totais consolidados", "MemÃ³ria de cÃ¡lculo", "Memoria de calculo", "Volumes individuais"]) || "Ver quantitativos no pacote tÃ©cnico de origem abaixo.";
    const compositions = extractEloProposalSection_(sourceText, ["ComposiÃ§Ãµes oficiais utilizadas", "Composicoes oficiais utilizadas", "ComposiÃ§Ãµes utilizadas", "Composicoes utilizadas", "ComposiÃ§Ãµes encontradas", "Composicoes encontradas"]) || "Nenhuma composiÃ§Ã£o oficial foi localizada ou selecionada no pacote de origem.";
    const costs = extractEloProposalSection_(sourceText, ["Custos encontrados", "Custos"]) || "Somente serÃ£o exibidos valores quando houver preÃ§o real na base tÃ©cnica carregada. Nenhum valor foi estimado.";
    const pending = extractEloProposalSection_(sourceText, ["PendÃªncias tÃ©cnicas", "Pendencias tecnicas", "ComposiÃ§Ãµes nÃ£o localizadas", "Composicoes nao localizadas", "ObservaÃ§Ãµes tÃ©cnicas", "Observacoes tecnicas", "Avisos profissionais"]) || "Confirmar projeto, memorial, composiÃ§Ãµes oficiais faltantes, aÃ§o estrutural e responsabilidade tÃ©cnica profissional.";
    const clientMatch = sanitizeUserText(message || "").match(/cliente\s+([^,.\n]{2,80})/i);
    const client = clientMatch ? sanitizeUserText(clientMatch[1]) : "nÃ£o informado";
    const date = new Date().toLocaleDateString("pt-BR");
    const markdownLines = [
      "# PROPOSTA TÃ‰CNICA PRELIMINAR",
      "",
      "Cliente: " + client,
      "Obra: " + ((project.nome && project.nome !== "nÃ£o informado") ? project.nome : "obra atual"),
      "Data: " + date,
      "",
      "## RESUMO EXECUTIVO",
      executive,
      "",
      "## DescriÃ§Ã£o simples",
      "Documento preliminar preparado a partir do Ãºltimo pacote tÃ©cnico calculado pelo Elo OrÃ§amentista Assistido. O conteÃºdo abaixo organiza os dados para apresentaÃ§Ã£o ao cliente sem criar novos cÃ¡lculos.",
      "",
      "## SERVIÃ‡OS CONSIDERADOS",
      "- FundaÃ§Ã£o",
      "- Estrutura",
      "- Alvenaria",
      "- Revestimentos",
      "",
      "## QUANTITATIVOS",
      quantities,
      "",
      "## COMPOSIÃ‡Ã•ES UTILIZADAS",
      compositions,
      "",
      "## CUSTOS ENCONTRADOS",
      costs,
      "",
      "## PENDÃŠNCIAS TÃ‰CNICAS",
      pending,
      "- Projeto estrutural, aÃ§o e detalhamento executivo dependem de responsÃ¡vel tÃ©cnico habilitado quando aplicÃ¡vel.",
      "- ComposiÃ§Ã£o ausente deve ser complementada com SINAPI, ORSE ou base oficial validada antes de fechamento comercial.",
      "",
      "## RESPONSABILIDADE TÃ‰CNICA",
      "Documento preliminar assistido por sistema computacional.",
      "",
      "NÃ£o substitui projeto executivo, memorial descritivo, orÃ§amento executivo ou responsabilidade tÃ©cnica profissional.",
      "",
      "## HTML ESTRUTURADO",
      "```html",
      buildEloProposalHtml_("# PROPOSTA TÃ‰CNICA PRELIMINAR\n\n## RESUMO EXECUTIVO\n" + executive + "\n\n## QUANTITATIVOS\n" + quantities + "\n\n## COMPOSIÃ‡Ã•ES UTILIZADAS\n" + compositions + "\n\n## CUSTOS ENCONTRADOS\n" + costs + "\n\n## PENDÃŠNCIAS TÃ‰CNICAS\n" + pending),
      "```"
    ];
    return {
      shortAnswer: "Proposta tÃ©cnica preliminar preparada para cliente.",
      fullAnswer: markdownLines.join("\n"),
      nextAction: "Revise cliente, obra, escopo e pendÃªncias antes de enviar ao cliente.",
      canSave: true,
      sessionTheme: "technical_proposal_package",
      sessionIntent: "technical_proposal_package"
    };
  }
  function getEloBrowserStorage_() {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function readEloJsonFromStorage_(key) {
    const storage = getEloBrowserStorage_();
    if (!storage || !key) return null;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function getEloStorageKeys_(patterns) {
    const storage = getEloBrowserStorage_();
    if (!storage) return [];
    const normalizedPatterns = (patterns || []).map(function (pattern) { return normalizeText(pattern); });
    const keys = [];
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index) || "";
        const normalizedKey = normalizeText(key);
        if (!normalizedPatterns.length || normalizedPatterns.some(function (pattern) { return normalizedKey.indexOf(pattern) >= 0; })) {
          keys.push(key);
        }
      }
    } catch (error) {
      return [];
    }
    return keys;
  }

  function flattenEloText_(value, limit) {
    const max = limit || 140;
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return sanitizeUserText(String(value)).slice(0, max);
    }
    if (Array.isArray(value)) {
      return value.map(function (item) { return flattenEloText_(item, Math.max(40, Math.floor(max / 2))); }).filter(Boolean).slice(0, 4).join("; ").slice(0, max);
    }
    if (typeof value === "object") {
      return Object.keys(value).slice(0, 8).map(function (key) {
        const text = flattenEloText_(value[key], 80);
        return text ? sanitizeUserText(key) + ": " + text : "";
      }).filter(Boolean).join("; ").slice(0, max);
    }
    return "";
  }

  function collectEloObjects_(value, predicate, output, depth) {
    const list = output || [];
    if (list.length >= 80 || depth > 5 || value == null) return list;
    if (Array.isArray(value)) {
      value.forEach(function (item) { collectEloObjects_(item, predicate, list, depth + 1); });
      return list;
    }
    if (typeof value !== "object") return list;
    try {
      if (predicate(value)) list.push(value);
    } catch (error) {
      // Ignora objetos parcialmente incompatÃ­veis.
    }
    Object.keys(value).slice(0, 40).forEach(function (key) {
      collectEloObjects_(value[key], predicate, list, depth + 1);
    });
    return list;
  }

  function uniqueEloObjects_(items) {
    const seen = new Set();
    return (items || []).filter(function (item) {
      const key = String(item.id || item.uid || item.date || item.createdAt || "") + "|" + flattenEloText_(item, 180);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getEloSaasState_() {
    return readEloJsonFromStorage_("obrareport-saas-v1") || {};
  }

  function getEloRdoContext_() {
    const state = getEloSaasState_();
    let records = Array.isArray(state.dailyLogs) ? state.dailyLogs.slice() : [];
    getEloStorageKeys_(["rdo", "daily", "diario", "diÃ¡rio"]).forEach(function (key) {
      const parsed = readEloJsonFromStorage_(key);
      records = records.concat(collectEloObjects_(parsed, function (item) {
        return !!(item && (item.productions || item.materials || item.team || item.occurrences || item.safety || item.weather) && (item.date || item.workId || item.createdAt));
      }, [], 0));
    });
    records = uniqueEloObjects_(records).sort(function (a, b) {
      return String(b.date || b.createdAt || b.updatedAt || "").localeCompare(String(a.date || a.createdAt || a.updatedAt || ""));
    });
    return { records: records.slice(0, 12), latest: records[0] || null };
  }

  function summarizeEloRdoContext_(context) {
    const latest = context && context.latest;
    if (!latest) return null;
    const productions = flattenEloText_(latest.productions || latest.services || latest.executedServices || latest.activities, 240) || "nÃ£o informado";
    const team = flattenEloText_(latest.team || latest.crew || latest.workers, 180) || "nÃ£o informado";
    const materials = flattenEloText_(latest.materials || latest.materialRequests || latest.consumptions, 220) || "nÃ£o informado";
    const occurrences = flattenEloText_(latest.occurrences || latest.incidents || latest.notes, 220) || "sem ocorrÃªncia registrada";
    const safety = flattenEloText_(latest.safety || latest.safetyNotes || latest.security, 180) || "sem apontamento registrado";
    const photos = Array.isArray(latest.photos || latest.attachments) ? String((latest.photos || latest.attachments).length) + " anexo(s)" : "nÃ£o informado";
    return {
      date: sanitizeUserText(latest.date || latest.createdAt || latest.updatedAt || "nÃ£o informada"),
      work: sanitizeUserText(latest.workName || latest.obra || latest.work || latest.projectName || "obra nÃ£o informada"),
      productions: productions,
      team: team,
      materials: materials,
      occurrences: occurrences,
      safety: safety,
      photos: photos
    };
  }

  function getEloStockContext_() {
    const state = readEloJsonFromStorage_("obrareport_stock_master_v1") || {};
    const almox = readEloJsonFromStorage_("obraReportAlmoxarifadoData") || {};
    let items = [];
    [state.items, state.products, almox.items, almox.products, almox.materials, almox].forEach(function (source) {
      items = items.concat(collectEloObjects_(source, function (item) {
        return !!(item && (item.name || item.description || item.material || item.itemName || item.productName) && (item.unit || item.unidade || item.currentStock != null || item.balance != null || item.saldo != null || item.initialBalance != null));
      }, [], 0));
    });
    const movements = collectEloObjects_(state["movements"] || almox["movements"] || almox["history"], function (item) {
      return !!(item && (item.type || item.source || item.quantity != null) && (item.itemName || item.name || item.material || item.stockItemId));
    }, [], 0);
    const normalizedItems = uniqueEloObjects_(items).map(function (item) {
      const name = sanitizeUserText(item.name || item.description || item.material || item.itemName || item.productName || "Material");
      const unit = sanitizeUserText(item.unit || item.unidade || item.measureUnit || "un");
      const stockValue = parseFloat(String(item.currentStock != null ? item.currentStock : item.balance != null ? item.balance : item.saldo != null ? item.saldo : item.initialBalance != null ? item.initialBalance : 0).replace(",", "."));
      const minValue = parseFloat(String(item.minimumStock != null ? item.minimumStock : item.minStock != null ? item.minStock : item.minimum != null ? item.minimum : item.minimo != null ? item.minimo : 0).replace(",", "."));
      return {
        name: name,
        unit: unit,
        stock: isFinite(stockValue) ? stockValue : 0,
        minimum: isFinite(minValue) ? minValue : 0,
        category: sanitizeUserText(item.category || item.categoria || ""),
        raw: item
      };
    });
    const critical = normalizedItems.filter(function (item) {
      return item.minimum > 0 ? item.stock <= item.minimum : item.stock <= 0;
    });
    return { items: normalizedItems, critical: critical, movements: movements };
  }

  function summarizeEloStockContext_(context, message) {
    const text = normalizeText(message || "");
    if (!context || !context.items.length) return null;
    const materialMatch = text.match(/cimento|bloco|tijolo|areia|brita|aco|aÃ§o|vergalhao|vergalhÃ£o|tubo|argamassa|cal|tinta/);
    const focus = materialMatch ? context.items.filter(function (item) { return normalizeText(item.name).indexOf(materialMatch[0]) >= 0; }) : [];
    const selected = focus.length ? focus : context.critical.slice(0, 6);
    return {
      total: context.items.length,
      criticalCount: context.critical.length,
      selected: selected.slice(0, 8),
      materialSearched: materialMatch ? materialMatch[0] : ""
    };
  }

  function getEloReportsContext_() {
    const state = getEloSaasState_();
    let records = Array.isArray(state.reports) ? state.reports.slice() : [];
    const draft = readEloJsonFromStorage_("relatorio-fiscalizacao-draft-v2");
    if (draft) records.push(draft);
    getEloStorageKeys_(["report", "relatorio", "relatÃ³rio", "quality"]).forEach(function (key) {
      const parsed = readEloJsonFromStorage_(key);
      records = records.concat(collectEloObjects_(parsed, function (item) {
        return !!(item && (item.inconformidades || item.nonconformities || item.risks || item.recommendations || item.conclusion || item.report) && (item.obra || item.work || item.client || item.cliente || item.createdAt || item.dataVistoria));
      }, [], 0));
    });
    records = uniqueEloObjects_(records).sort(function (a, b) {
      return String(b.dataVistoria || b.date || b.createdAt || b.updatedAt || "").localeCompare(String(a.dataVistoria || a.date || a.createdAt || a.updatedAt || ""));
    });
    return { records: records.slice(0, 12), latest: records[0] || null };
  }

  function summarizeEloReportsContext_(context) {
    const latest = context && context.latest;
    if (!latest) return null;
    const report = latest.report && typeof latest.report === "object" ? latest.report : latest;
    return {
      title: sanitizeUserText(report.title || report.tipoRelatorio || report.type || "RelatÃ³rio tÃ©cnico"),
      client: sanitizeUserText(report.cliente || report.client || report.clientName || "cliente nÃ£o informado"),
      work: sanitizeUserText(report.obra || report.work || report.workName || report.projectName || "obra nÃ£o informada"),
      date: sanitizeUserText(report.dataVistoria || report.date || report.createdAt || report.updatedAt || "data nÃ£o informada"),
      nonconformities: flattenEloText_(report.inconformidades || report.nonconformities || report.issues, 260) || "nÃ£o informado",
      risks: flattenEloText_(report.risks || report.riscos || report.criticalRisks, 220) || "nÃ£o informado",
      recommendations: flattenEloText_(report.recommendations || report.recomendacoes || report.actions, 240) || "nÃ£o informado",
      pending: flattenEloText_(report.pending || report.pendencias || report.todo, 220) || "nÃ£o informado",
      conclusion: flattenEloText_(report.conclusion || report.conclusao || report.summary, 260) || "conclusÃ£o nÃ£o cadastrada"
    };
  }

  function isEloRdoOperationalQuestion_(message) {
    const text = normalizeText(message || "");
    return /\brdo\b|diario|diÃ¡rio|executado\s+hoje|execucao\s+de\s+hoje|execuÃ§Ã£o\s+de\s+hoje|ocorrencias\s+do\s+diario|ocorrÃªncias\s+do\s+diÃ¡rio|seguranca|seguranÃ§a|resumo\s+do\s+diario|resumo\s+do\s+diÃ¡rio/.test(text);
  }

  function isEloStockOperationalQuestion_(message) {
    const text = normalizeText(message || "");
    return /preciso\s+comprar|estoque\s+critico|estoque\s+crÃ­tico|materiais\s+estao\s+acabando|materiais\s+estÃ£o\s+acabando|faltam\s+blocos|falta\s+bloco|tem\s+cimento\s+suficiente|quanto\s+tenho\s+de\s+cimento|almoxarifado|saldo\s+atual/.test(text);
  }

  function isEloReportsOperationalQuestion_(message) {
    const text = normalizeText(message || "");
    return /ultimo\s+relatorio|Ãºltimo\s+relatÃ³rio|inconformidades|riscos\s+da\s+obra|conclusao\s+do\s+relatorio|conclusÃ£o\s+do\s+relatÃ³rio|pendencias\s+tecnicas|pendÃªncias\s+tÃ©cnicas/.test(text);
  }

  function isEloIntegratedOperationalQuestion_(message) {
    const text = normalizeText(message || "");
    return /como\s+esta\s+a\s+obra|como\s+estÃ¡\s+a\s+obra|(?:^o\s+que\s+falta\??$|o\s+que\s+falta\s+(?:na\s+obra|para\s+amanha|para\s+amanhÃ£))|quais\s+riscos\s+da\s+obra|resolver\s+amanha|resolver\s+amanhÃ£|resumo\s+geral\s+da\s+obra|diagnostico\s+geral|diagnÃ³stico\s+geral/.test(text);
  }

  function isEloOperationalPdfQuestion_(message) {
    const text = normalizeText(message || "");
    return /gerar\s+pdf|baixar\s+pdf|exportar\s+pdf|gerar\s+relatorio|gerar\s+relat?rio|imprimir\s+(?:orcamento|or?amento|proposta|relatorio|relat?rio)|baixar\s+(?:orcamento|or?amento|proposta)|pdf\s+do\s+(?:orcamento|or?amento)|proposta\s+em\s+pdf|documento\s+para\s+cliente|relatorio\s+para\s+cliente|relat?rio\s+para\s+cliente/.test(text);
  }

  function isEloOperationalWizardQuestion_(message) {
    const text = normalizeText(message || "");
    return /nao\s+sei\s+por\s+onde\s+comecar|nÃ£o\s+sei\s+por\s+onde\s+comeÃ§ar|me\s+ajuda\s+a\s+organizar\s+a\s+obra|organizar\s+obra|quero\s+fazer\s+orcamento|quero\s+fazer\s+orÃ§amento|me\s+ajuda\s+a\s+orcar|me\s+ajuda\s+a\s+orÃ§ar|orcamento\s+de\s+uma\s+casa|orÃ§amento\s+de\s+uma\s+casa|^fazer\s+orcamento(?:\s+residencial)?$|^fazer\s+orÃ§amento(?:\s+residencial)?$|^fazer\s+relatorio$|^fazer\s+relatÃ³rio$|^gerar\s+proposta$/.test(text);
  }

  function buildEloRdoOperationalAnswer_(message) {
    if (!isEloRdoOperationalQuestion_(message)) return null;
    const summary = summarizeEloRdoContext_(getEloRdoContext_());
    if (!summary) {
      return {
        shortAnswer: "NÃ£o encontrei RDO registrado nesta obra.",
        fullAnswer: "NÃ£o encontrei RDO registrado nesta obra. Cadastre o diÃ¡rio de obra para eu gerar o resumo operacional.",
        nextAction: "Cadastre o diÃ¡rio de obra ou importe um RDO antes de pedir o resumo operacional.",
        canSave: false,
        sessionTheme: "rdo_operacional",
        sessionIntent: "rdo_resumo"
      };
    }
    const answer = [
      "RDO â€” RESUMO OPERACIONAL",
      "",
      "Data: " + summary.date,
      "Obra: " + summary.work,
      "",
      "ServiÃ§os executados: " + summary.productions,
      "Equipe: " + summary.team,
      "Materiais usados: " + summary.materials,
      "OcorrÃªncias: " + summary.occurrences,
      "SeguranÃ§a: " + summary.safety,
      "Fotos/anexos: " + summary.photos,
      "",
      "PendÃªncias para amanhÃ£:",
      "- Revisar ocorrÃªncias, materiais consumidos e serviÃ§os planejados para o prÃ³ximo RDO.",
      "",
      "Documento preliminar assistido por sistema computacional.",
      "NÃ£o substitui anÃ¡lise tÃ©cnica profissional."
    ].join("\n");
    return {
      shortAnswer: "Resumo operacional do RDO preparado.",
      fullAnswer: answer,
      nextAction: "Revise o RDO e complemente pendÃªncias antes de enviar ao cliente ou equipe.",
      canSave: true,
      sessionTheme: "rdo_operacional",
      sessionIntent: "rdo_resumo"
    };
  }

  function buildEloStockOperationalAnswer_(message) {
    if (!isEloStockOperationalQuestion_(message)) return null;
    const summary = summarizeEloStockContext_(getEloStockContext_(), message);
    if (!summary) {
      return {
        shortAnswer: "NÃ£o encontrei dados de almoxarifado carregados.",
        fullAnswer: "NÃ£o encontrei dados de almoxarifado carregados. Cadastre materiais ou importe movimentaÃ§Ãµes para eu analisar.",
        nextAction: "Cadastre materiais, saldos mÃ­nimos e movimentaÃ§Ãµes no almoxarifado.",
        canSave: false,
        sessionTheme: "almoxarifado_operacional",
        sessionIntent: "stock_resumo"
      };
    }
    const rows = summary.selected.length
      ? summary.selected.map(function (item) {
          const suggestion = item.minimum > 0 && item.stock <= item.minimum ? "repor atÃ© ficar acima do mÃ­nimo" : item.stock <= 0 ? "validar compra ou saldo" : "acompanhar";
          return "- " + item.name + ": saldo " + item.stock + " " + item.unit + "; mÃ­nimo " + item.minimum + " " + item.unit + "; sugestÃ£o: " + suggestion + ".";
        }).join("\n")
      : "- Nenhum item crÃ­tico encontrado com os dados carregados.";
    const answer = [
      "ALMOXARIFADO â€” RESUMO OPERACIONAL",
      "",
      "Itens cadastrados: " + summary.total,
      "Itens crÃ­ticos: " + summary.criticalCount,
      summary.materialSearched ? "Material consultado: " + summary.materialSearched : "Consulta: materiais crÃ­ticos e reposiÃ§Ã£o",
      "",
      "Itens crÃ­ticos / saldo atual:",
      rows,
      "",
      "Consumo recente: conferir histÃ³rico de saÃ­das e vÃ­nculos com RDO.",
      "Materiais sem movimentaÃ§Ã£o: revisar no almoxarifado se houver divergÃªncia de saldo.",
      "",
      "Documento preliminar assistido por sistema computacional.",
      "NÃ£o substitui anÃ¡lise tÃ©cnica profissional."
    ].join("\n");
    return {
      shortAnswer: "Resumo operacional do almoxarifado preparado.",
      fullAnswer: answer,
      nextAction: "Revise saldos mÃ­nimos, Ãºltimas saÃ­das e compras pendentes antes de comprar.",
      canSave: true,
      sessionTheme: "almoxarifado_operacional",
      sessionIntent: "stock_resumo"
    };
  }

  function buildEloReportsOperationalAnswer_(message) {
    if (!isEloReportsOperationalQuestion_(message)) return null;
    const summary = summarizeEloReportsContext_(getEloReportsContext_());
    if (!summary) {
      return {
        shortAnswer: "NÃ£o encontrei relatÃ³rio tÃ©cnico cadastrado.",
        fullAnswer: "NÃ£o encontrei relatÃ³rio tÃ©cnico cadastrado. Crie ou importe um relatÃ³rio para eu resumir.",
        nextAction: "Crie ou importe um relatÃ³rio tÃ©cnico antes de pedir conclusÃ£o, riscos ou pendÃªncias.",
        canSave: false,
        sessionTheme: "relatorios_operacionais",
        sessionIntent: "relatorio_resumo"
      };
    }
    const answer = [
      "RELATÃ“RIOS â€” RESUMO TÃ‰CNICO",
      "",
      "Ãšltimo relatÃ³rio: " + summary.title,
      "Cliente/obra: " + summary.client + " / " + summary.work,
      "Data: " + summary.date,
      "",
      "Inconformidades: " + summary.nonconformities,
      "Riscos: " + summary.risks,
      "RecomendaÃ§Ãµes: " + summary.recommendations,
      "PendÃªncias: " + summary.pending,
      "",
      "ConclusÃ£o sugerida:",
      summary.conclusion,
      "",
      "Documento preliminar assistido por sistema computacional.",
      "NÃ£o substitui anÃ¡lise tÃ©cnica profissional."
    ].join("\n");
    return {
      shortAnswer: "Resumo tÃ©cnico do relatÃ³rio preparado.",
      fullAnswer: answer,
      nextAction: "Revise inconformidades, riscos e conclusÃ£o antes de emitir ao cliente.",
      canSave: true,
      sessionTheme: "relatorios_operacionais",
      sessionIntent: "relatorio_resumo"
    };
  }

  function buildEloIntegratedOperationalAnswer_(message) {
    if (!isEloIntegratedOperationalQuestion_(message)) return null;
    const rdo = summarizeEloRdoContext_(getEloRdoContext_());
    const stock = summarizeEloStockContext_(getEloStockContext_(), message);
    const report = summarizeEloReportsContext_(getEloReportsContext_());
    const answer = [
      "DIAGNÃ“STICO GERAL DA OBRA",
      "",
      "ExecuÃ§Ã£o / RDO:",
      rdo ? "- Ãšltimo RDO em " + rdo.date + ": " + rdo.productions : "- NÃ£o encontrei RDO registrado nesta obra.",
      "",
      "Materiais / Almoxarifado:",
      stock ? "- " + stock.total + " item(ns) cadastrados; " + stock.criticalCount + " crÃ­tico(s)." : "- NÃ£o encontrei dados de almoxarifado carregados.",
      "",
      "Riscos tÃ©cnicos / RelatÃ³rios:",
      report ? "- " + report.risks : "- NÃ£o encontrei relatÃ³rio tÃ©cnico cadastrado.",
      "",
      "PrÃ³ximas aÃ§Ãµes:",
      "- Atualizar RDO do dia;",
      "- revisar materiais crÃ­ticos antes da prÃ³xima frente;",
      "- revisar inconformidades e pendÃªncias tÃ©cnicas cadastradas.",
      "",
      "Alertas:",
      "- Este diagnÃ³stico depende dos dados realmente cadastrados nos mÃ³dulos.",
      "- Documento preliminar assistido por sistema computacional.",
      "- NÃ£o substitui anÃ¡lise tÃ©cnica profissional."
    ].join("\n");
    return {
      shortAnswer: "DiagnÃ³stico geral da obra preparado.",
      fullAnswer: answer,
      nextAction: "Atualize RDO, almoxarifado e relatÃ³rio tÃ©cnico para deixar o diagnÃ³stico mais confiÃ¡vel.",
      canSave: true,
      sessionTheme: "diagnostico_operacional_obra",
      sessionIntent: "diagnostico_geral"
    };
  }

  function escapeEloHtml_(value) {
    return sanitizeUserText(value || "").replace(/[&<>\"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char;
    });
  }

  function getEloOfficialBaseMetadata_() {
    const engine = (typeof window !== "undefined" && window.StockAiCompositionEngine) ? window.StockAiCompositionEngine : null;
    const preference = getEloTechnicalSourcePreference_ ? getEloTechnicalSourcePreference_() : "";
    let metadata = null;
    if (engine && typeof engine.getImportedOfficialBaseStats === "function") {
      try {
        const stats = engine.getImportedOfficialBaseStats() || {};
        if (Number(stats.totalCompositions) > 0) {
          metadata = {
            fonte: sanitizeUserText(preference || stats.source || (stats.sources && stats.sources[0]) || "SINAPI/ORSE"),
            uf: sanitizeUserText(stats.state || (stats.states && stats.states[0]) || ""),
            mes: sanitizeUserText(stats.referenceMonth || (stats.referenceMonths && stats.referenceMonths[0]) || ""),
            quantidade: Number(stats.totalCompositions) || 0,
            importadaEm: new Date().toISOString(),
            status: "oficial_validada",
            ultimaBaseUsada: true
          };
        }
      } catch (error) {
        metadata = null;
      }
    }
    const storage = getEloBrowserStorage_();
    if (metadata && storage) {
      try {
        storage.setItem("elo_official_technical_base_metadata_v1", JSON.stringify(metadata));
      } catch (error) {
        // Sem aÃ§Ã£o: metadado persistido Ã© auxiliar, nÃ£o deve bloquear resposta.
      }
      return metadata;
    }
    const persisted = readEloJsonFromStorage_("elo_official_technical_base_metadata_v1") || readEloJsonFromStorage_("stock_ai_official_base_metadata_v1") || readEloJsonFromStorage_("obrareport_stock_ai_official_base_metadata_v1");
    if (persisted && Number(persisted.quantidade || persisted.totalCompositions || persisted.catalogSize) > 0) {
      return {
        fonte: sanitizeUserText(preference || persisted.fonte || persisted.source || "SINAPI/ORSE"),
        uf: sanitizeUserText(persisted.uf || persisted.state || persisted.sourceRegion || ""),
        mes: sanitizeUserText(persisted.mes || persisted.referenceMonth || persisted.sourceDate || ""),
        quantidade: Number(persisted.quantidade || persisted.totalCompositions || persisted.catalogSize) || 0,
        importadaEm: sanitizeUserText(persisted.importadaEm || persisted.importedAt || persisted.createdAt || ""),
        status: sanitizeUserText(persisted.status || "oficial_validada"),
        ultimaBaseUsada: true
      };
    }
    return null;
  }

  function buildEloOfficialBaseStatusAnswer_(message) {
    const text = normalizeText(message || "");
    if (!/base\s+tecnica|base\s+tÃ©cnica|sinapi|orse/.test(text) || !/carregada|atual|persistida|qual\s+base|que\s+base/.test(text)) return null;
    const metadata = getEloOfficialBaseMetadata_();
    if (!metadata) {
      return {
        shortAnswer: "NÃ£o encontrei base oficial persistida.",
        fullAnswer: "NÃ£o encontrei base oficial persistida. Importe ou carregue uma base SINAPI/ORSE para cÃ¡lculo oficial.",
        nextAction: "Carregue uma base SINAPI/ORSE oficial no Stock Obras antes de pedir cÃ¡lculo oficial.",
        canSave: false,
        sessionTheme: "base_tecnica_oficial",
        sessionIntent: "status_base_tecnica"
      };
    }
    const source = metadata.fonte || "SINAPI/ORSE";
    const location = [metadata.uf, metadata.mes].filter(Boolean).join(" ");
    const line = "Base tÃ©cnica atual: " + source + (location ? " " + location : "") + " â€” " + metadata.quantidade + " composiÃ§Ãµes carregadas.";
    return {
      shortAnswer: "Base tecnica carregada.",
      fullAnswer: [
        line,
        "Status: " + (metadata.status || "oficial_validada") + ".",
        "PreferÃªncia atual: " + (getEloTechnicalSourcePreference_ ? (getEloTechnicalSourcePreference_() || "nÃ£o definida") : "nÃ£o definida") + ".",
        "NÃ£o uso base demonstrativa como oficial."
      ].join("\n"),
      nextAction: "Use essa base em uma consulta de serviÃ§o, quantitativo ou orÃ§amento tÃ©cnico.",
      canSave: true,
      sessionTheme: "base_tecnica_oficial",
      sessionIntent: "status_base_tecnica"
    };
  }

  function buildEloOfficialTechnicalGuidanceAnswer_(message) {
    const text = normalizeText(message || "");
    const isOfficialBudgetQuestion = /orcamento\s+tecnico|orÃ§amento\s+tÃ©cnico|composicao\s+oficial|composiÃ§Ã£o\s+oficial|sem\s+inventar\s+coeficiente|sem\s+chutar\s+consumo|mao\s+de\s+obra\s+e\s+material|mÃ£o\s+de\s+obra\s+e\s+material|posso\s+estimar\s+sozinho|preciso\s+de\s+composicao|preciso\s+de\s+composiÃ§Ã£o|responsavel\s+tecnico|responsÃ¡vel\s+tÃ©cnico|como\s+diferenciar\s+preco\s+de\s+insumo|como\s+diferenciar\s+preÃ§o\s+de\s+insumo|referencia\s+de\s+insumo|referÃªncia\s+de\s+insumo|preco\s+oficial|preÃ§o\s+oficial/.test(text);
    if (!isOfficialBudgetQuestion) return null;
    const isInputReference = /insumo|comprar|referencia\s+de\s+insumo|referÃªncia\s+de\s+insumo/.test(text);
    const lines = [
      "Resposta principal",
      isInputReference
        ? "Trate essa referÃªncia como insumo, nÃ£o como orÃ§amento completo de serviÃ§o. PreÃ§o de insumo nÃ£o substitui composiÃ§Ã£o de execuÃ§Ã£o."
        : "NÃ£o vou estimar consumo, produtividade, mÃ£o de obra ou custo oficial sem composiÃ§Ã£o tÃ©cnica validada.",
      "",
      "Premissas utilizadas",
      "- ServiÃ§o ou insumo descrito pelo usuÃ¡rio: considerado como referÃªncia de busca.",
      "- Quantidade/unidade informada na pergunta: considerada apenas como premissa, quando existir.",
      "",
      "Base tÃ©cnica utilizada",
      "- NÃ£o localizada nesta conversa.",
      "- Para cÃ¡lculo oficial, preciso de composiÃ§Ã£o SINAPI, ORSE ou composiÃ§Ã£o interna validada com coeficientes positivos.",
      "- NÃ£o uso composiÃ§Ã£o demonstrativa/editÃ¡vel como oficial.",
      "",
      "Alertas do auditor",
      "- Se for insumo: ele serve para preÃ§o unitÃ¡rio, mas nÃ£o entrega produtividade, equipe, perdas nem equipamentos.",
      "- Se for serviÃ§o: a composiÃ§Ã£o precisa trazer insumos, mÃ£o de obra, equipamentos e coeficientes.",
      "- ServiÃ§os estruturais, instalaÃ§Ãµes crÃ­ticas ou itens normativos exigem validaÃ§Ã£o de responsÃ¡vel tÃ©cnico.",
      "",
      "PrÃ³xima aÃ§Ã£o recomendada",
      "Informe o cÃ³digo SINAPI/ORSE, importe a composiÃ§Ã£o oficial da base carregada ou autorize explicitamente uma estimativa preliminar marcada como NÃƒO OFICIAL."
    ];
    return {
      shortAnswer: "Preciso de composiÃ§Ã£o oficial para orÃ§amento tÃ©cnico.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe cÃ³digo/composiÃ§Ã£o SINAPI/ORSE ou autorize estimativa NÃƒO OFICIAL.",
      canSave: true,
      sessionTheme: "orcamento_tecnico_oficial",
      sessionIntent: "bloqueio_composicao_oficial"
    };
  }
  function parseEloLooseProjectBriefing_(message) {
    const raw = String(message || "");
    const normalized = normalizeText(raw);
    if (!/cliente|obra|casa|parede|sapata|baldrame|pilar|viga|proposta|orcamento|orÃ§amento/.test(normalized)) return null;
    const facts = {};
    const clientMatch = raw.match(/cliente\s+([^,;\n\r]+?)(?=\s*,|\s+obra\b|\s+casa\b|$)/i);
    const workMatch = raw.match(/obra\s+([^,;\n\r]+?)(?=\s*,|\s+casa\b|\s+em\b|\s+no\b|\s+na\b|$)/i);
    const cityUfMatch = raw.match(/(?:em|cidade\s+de)\s+([^,.;\/\-]+?)\s*[-\/]\s*([A-Za-z]{2})\b/i);
    if (clientMatch) facts.cliente = sanitizeUserText(clientMatch[1]);
    if (workMatch) facts.obra = sanitizeUserText(workMatch[1]);
    if (cityUfMatch) {
      facts.cidade = sanitizeUserText(cityUfMatch[1]);
      facts.uf = sanitizeUserText(cityUfMatch[2]).toUpperCase();
    }
    const area = parseEloResidentialArea_(raw);
    if (area) facts.area = area;
    const wall = parseEloResidentialWallPackage_(raw);
    if (wall) facts.parede = wall;
    const foundation = collectEloFoundationPackageElements_(raw).filter(function (element) { return element.type === "sapata" || element.type === "bloco_fundacao" || element.type === "viga_baldrame"; });
    const structure = collectEloResidentialStructureElements_(raw).filter(function (element) { return element.type === "pilar" || element.type === "viga_aerea"; });
    if (foundation.length) facts.fundacao = foundation;
    if (structure.length) facts.estrutura = structure;
    if (/proposta|pdf|documento\s+para\s+cliente/.test(normalized)) facts.pedidoDocumento = true;
    return Object.keys(facts).length ? facts : null;
  }

  function buildEloLooseProjectBriefingAnswer_(message) {
    const text = normalizeText(message || "");
    if (!/cliente|obra|casa|parede|sapata|baldrame|pilar|viga|proposta/.test(text)) return null;
    if (/gerar\s+pdf|exportar\s+pdf|proposta\s+em\s+pdf|documento\s+para\s+cliente|imprimir\s+proposta|baixar\s+proposta/.test(text)) return null;
    if (/orcamento\s+tecnico|orÃ§amento\s+tÃ©cnico|continuar\s+o\s+orcamento|continuar\s+o\s+orÃ§amento|orce|pintura|composicao|composiÃ§Ã£o|coeficiente|sinapi|orse|mao\s+de\s+obra|mÃ£o\s+de\s+obra|produtividade|insumo|servico|serviÃ§o|executar|contratar|comprar|como\s+calcular|o\s+que\s+falta|que\s+dados|preciso\s+montar/.test(text)) return null;
    const facts = parseEloLooseProjectBriefing_(message);
    if (!facts) return null;
    if (facts.parede && facts.fundacao && facts.estrutura) {
      return null;
    }
    const lines = ["BRIEFING DA OBRA - TEXTO LIVRE", "", "O que entendi:"];
    lines.push("- Cliente: " + (facts.cliente || "nao informado"));
    lines.push("- Obra: " + (facts.obra || "obra atual"));
    lines.push("- Cidade/UF: " + ([facts.cidade, facts.uf].filter(Boolean).join("/") || "nao informado"));
    lines.push("- Area aproximada: " + (facts.area ? formatEloWallPremiseMeasure_(facts.area, "m2") : "nao informada"));
    if (facts.parede) {
      lines.push("- Parede: area bruta " + formatEloWallPremiseMeasure_(facts.parede.grossArea, "m2") + "; vaos " + formatEloWallPremiseMeasure_(facts.parede.openingsArea, "m2") + "; area liquida " + formatEloWallPremiseMeasure_(facts.parede.netArea, "m2") + ".");
    } else {
      lines.push("- Parede: nao informada.");
    }
    lines.push("- Fundacao: " + (facts.fundacao && facts.fundacao.length ? facts.fundacao.length + " elemento(s) identificado(s)." : "nao informada."));
    lines.push("- Estrutura: " + (facts.estrutura && facts.estrutura.length ? facts.estrutura.length + " elemento(s) identificado(s)." : "nao informada."));
    lines.push("", "O que falta:");
    if (!facts.cliente) lines.push("- cliente;" );
    if (!facts.obra) lines.push("- nome da obra;" );
    if (!facts.cidade || !facts.uf) lines.push("- cidade/UF;" );
    if (!facts.area) lines.push("- area aproximada;" );
    if (!facts.parede) lines.push("- paredes ou area de alvenaria;" );
    if (!facts.fundacao || !facts.fundacao.length) lines.push("- fundacao, se entrar no escopo;" );
    if (!facts.estrutura || !facts.estrutura.length) lines.push("- pilares/vigas, se entrar no escopo;" );
    lines.push("", "Proximo passo:", "Responda so o primeiro dado faltante que voce souber. Pode dizer 'nao sei' para qualquer item.");
    return {
      shortAnswer: "Entendi o briefing inicial da obra.",
      fullAnswer: lines.join("\n"),
      nextAction: "Complete cliente, obra, cidade/UF, area ou escopo que faltar.",
      canSave: true,
      sessionTheme: "briefing_livre_obra",
      sessionIntent: "parser_texto_livre"
    };
  }
  function buildEloOperationalPrintableAnswer_(message) {
    if (!isEloOperationalPdfQuestion_(message)) return null;
    const workMemory = getEloWorkMemory_ ? getEloWorkMemory_() : null;
    const currentWork = workMemory && workMemory.currentWork ? workMemory.currentWork : {};
    const diagnostic = buildEloIntegratedOperationalAnswer_("resumo geral da obra") || buildEloRdoOperationalAnswer_("resuma o RDO de hoje") || buildEloStockOperationalAnswer_("o que preciso comprar") || buildEloReportsOperationalAnswer_("resuma o ultimo relatorio");
    const lastPackage = ELO_SESSION_MEMORY.lastTechnicalPackage;
    const content = diagnostic ? diagnostic.fullAnswer : "Nao encontrei dados operacionais suficientes para montar o documento.";
    const text = normalizeText(message || "");
    const title = /proposta/.test(text) ? "Proposta tecnica preliminar" : /orcamento|or?amento/.test(text) ? "Orcamento tecnico preliminar" : "Documento operacional preliminar";
    const record = {
      numero: "ELO-DOC-" + new Date().getFullYear() + "-PRELIMINAR",
      versao: 1,
      status: "rascunho tecnico",
      titulo: title,
      cliente: sanitizeUserText(currentWork.cliente || currentWork.client || "nao informado"),
      obra: sanitizeUserText(currentWork.nome || currentWork.name || currentWork.obra || "nao informado"),
      cidade_uf: [currentWork.cidade || currentWork.city, currentWork.uf].filter(Boolean).join("/") || "nao informado",
      data_criacao: new Date().toISOString(),
      resumo_executivo: lastPackage && lastPackage.title ? lastPackage.title : "Documento gerado a partir do contexto operacional disponivel no Elo.",
      conteudo_markdown: content,
      quantitativos: getEloDocumentSection_({ conteudo_markdown: content }, ["Quantitativos", "Memoria de calculo", "Mem?ria de c?lculo"], "nao informado"),
      composicoes: getEloDocumentSection_({ conteudo_markdown: content }, ["Composicoes utilizadas", "Composi??es utilizadas", "Base tecnica utilizada", "Base t?cnica utilizada"], "nao localizada"),
      bases_tecnicas: getEloDocumentSection_({ conteudo_markdown: content }, ["Base tecnica utilizada", "Base t?cnica utilizada"], "nao localizada"),
      pendencias: getEloDocumentSection_({ conteudo_markdown: content }, ["Pendencias tecnicas", "Pend?ncias t?cnicas", "Pr?xima a??o recomendada", "Proxima acao recomendada"], "Validar dados faltantes, projeto, memorial, composicoes oficiais, precos, BDI e responsabilidade tecnica profissional."),
      avisos_profissionais: "Documento preliminar assistido por sistema computacional. Nao substitui projeto executivo, orcamento executivo, memorial descritivo ou responsabilidade tecnica profissional."
    };
    const html = openEloProfessionalPdfDocument_(record, {
      nomeDocumento: title,
      servicos: lastPackage && lastPackage.title ? lastPackage.title : "RDO, almoxarifado, relatorios e/ou orcamento assistido conforme dados disponiveis",
      escopo: "Documento operacional do Elo compartilhado entre ELO principal, ELO Projeto/CADISTA e ELO dentro do Stock Obras/ObraReport."
    });
    const answer = [
      "DOCUMENTO PROFISSIONAL PARA PDF / IMPRESSAO",
      "",
      "Preparei o mesmo template profissional compartilhado do Elo. Use o botao Imprimir / Salvar como PDF ou Ctrl+P.",
      "",
      "HTML gerado:",
      html
    ].join("\n");
    return {
      shortAnswer: "Documento profissional imprimivel preparado.",
      fullAnswer: answer,
      nextAction: "Use Ctrl+P ou o botao de impressao para salvar como PDF e revise antes de enviar ao cliente.",
      canSave: true,
      sessionTheme: "documento_operacional_pdf",
      sessionIntent: "pdf_operacional"
    };
  }

  function buildEloOperationalWizardAnswer_(message) {
    if (!isEloOperationalWizardQuestion_(message)) return null;
    const text = normalizeText(message || "");
    const objective = /proposta|cliente/.test(text) ? "proposta para cliente" : /rdo|diario|diÃ¡rio/.test(text) ? "RDO" : /estoque|almoxarifado/.test(text) ? "estoque" : /relatorio|relatÃ³rio/.test(text) ? "relatÃ³rio" : /resumo/.test(text) ? "resumo geral da obra" : "orÃ§amento";
    const workMemory = getEloWorkMemory_ ? getEloWorkMemory_() : null;
    const currentWork = workMemory && workMemory.currentWork ? workMemory.currentWork : {};
    const known = [];
    if (currentWork.nome || currentWork.name || currentWork.obra) known.push("obra: " + sanitizeUserText(currentWork.nome || currentWork.name || currentWork.obra));
    if (currentWork.cidade || currentWork.uf) known.push("cidade/UF: " + [currentWork.cidade || currentWork.city, currentWork.uf].filter(Boolean).join("/"));
    if (currentWork.area) known.push("Ã¡rea: " + formatEloWallPremiseMeasure_(currentWork.area, "mÂ²"));
    if (currentWork.padrao || currentWork["padrÃ£o"]) known.push("padrÃ£o: " + sanitizeUserText(currentWork.padrao || currentWork["padrÃ£o"]));
    return {
      shortAnswer: "Vou guiar o briefing tecnico.",
      fullAnswer: [
        "Vamos organizar por etapas.",
        "",
        "1. Objetivo identificado: " + objective + ".",
        "",
        "2. Dados mÃ­nimos que vou usar:",
        "- cliente;",
        "- obra;",
        "- cidade/UF;",
        "- Ã¡rea aproximada;",
        "- padrÃ£o da obra.",
        "",
        "3. Escopo possÃ­vel:",
        "- paredes;",
        "- fundaÃ§Ã£o;",
        "- estrutura;",
        "- relatÃ³rio;",
        "- almoxarifado;",
        "- RDO.",
        "",
        "4. O que jÃ¡ entendi:",
        known.length ? known.map(function (item) { return "- " + item + ";"; }).join("\n") : "- ainda nÃ£o hÃ¡ dados suficientes da obra nesta conversa;",
        "",
        "PrÃ³xima pergunta:",
        "Qual Ã© o nome da obra e a cidade/UF? Se nÃ£o souber, responda: nÃ£o sei."
      ].join("\n"),
      nextAction: "Responda com nome da obra e cidade/UF, ou diga 'nÃ£o sei'.",
      canSave: false,
      sessionTheme: "wizard_operacional",
      sessionIntent: "wizard_operacional"
    };
  }

  function buildEloOperationalEcosystemAnswer_(message) {
    return buildEloBudgetProductAnswer_(message)
      || buildEloOperationalPrintableAnswer_(message)
      || buildEloOfficialBaseStatusAnswer_(message)
      || buildEloOfficialTechnicalGuidanceAnswer_(message)
      || buildEloIntegratedOperationalAnswer_(message)
      || buildEloRdoOperationalAnswer_(message)
      || buildEloStockOperationalAnswer_(message)
      || buildEloReportsOperationalAnswer_(message)
      || buildEloOperationalWizardAnswer_(message)
      || buildEloLooseProjectBriefingAnswer_(message);
  }
  function buildEloTechnicalAuditorAlerts_(message, options) {
    const text = normalizeText(message || "");
    const alerts = [];
    const opts = options || {};
    if (/custo|or.amento|orcamento|valor|pre.o|preco|bdi|cronograma|curva\s+abc/.test(text) && !opts.hasOfficialBase) {
      alerts.push("- Custo, BDI, cronograma e curva ABC exigem composiÃ§Ã£o SINAPI/ORSE ou composiÃ§Ã£o interna validada. NÃ£o vou tratar estimativa como orÃ§amento oficial.");
    }
    if (/produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|homens?-hora|horas?/.test(text) && !opts.hasOfficialBase) {
      alerts.push("- Produtividade e mÃ£o de obra dependem de composiÃ§Ã£o validada; sem isso, a resposta fica limitada a briefing tÃ©cnico.");
    }
    if (/v[aÃ£]o|viga|laje|pilar|sapata|estrutura|balanÃ§o|balanco/.test(text) && /(\b[6-9]\s*m\b|\b1\d\s*m\b|\d+(?:[,.]\d+)?\s*m\s+de\s+v[aÃ£]o)/.test(text)) {
      alerts.push("- VÃ£o estrutural suspeito: confirme projeto estrutural e responsÃ¡vel tÃ©cnico antes de executar.");
    }
    if (/concreto|laje|contrapiso|piso/.test(text) && !/espessura|\d+(?:[,.]\d+)?\s*cm|\bfck\s*\d{2}|\d{2}\s*mpa/.test(text) && /calcular|quantos|or.amento|orcamento|custo|consumo/.test(text)) {
      alerts.push("- Falta espessura e/ou FCK para avanÃ§ar alÃ©m da geometria ou do briefing.");
    }
    if (/parede|alvenaria|bloco|tijolo/.test(text) && /quantos|consumo|or.amento|orcamento|custo/.test(text) && !/porta|janela|sem\s+v[aÃ£]os|sem\s+portas|sem\s+janelas/.test(text)) {
      alerts.push("- Confirme vÃ£os de portas e janelas para evitar quantitativo bruto acima do necessÃ¡rio.");
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
    lastTechnicalPackage: null,
    activeConversationTopic: ""
  };

  function detectEloConversationTopic_(message) {
    const text = normalizeText(message || "");
    if (!text) return "conversa_geral";
    if (/\bcadista\b|planta\s+baixa|gerar\s+planta|croqui|dxf|desenho\s+cad/.test(text)) return "cadista";
    if (/\bstock\b|estoque|almoxarifado|saldo\s+de|cimento\s+em\s+estoque|produto\b/.test(text)) return "stock";
    if (/proposta|preparar\s+para\s+cliente|gerar\s+documento|documento\s+para\s+cliente/.test(text)) return "proposta_tecnica";
    if (/orcamento\s+residencial|orÃ§amento\s+residencial|orcamento\s+preliminar|orÃ§amento\s+preliminar|casa\s+terrea|casa\s+tÃ©rrea|resid[eÃª]ncia/.test(text)) return "orcamento_residencial";
    if (/fundacao|fundaÃ§Ã£o|sapata|baldrame|bloco\s+de\s+fundacao|bloco\s+de\s+fundaÃ§Ã£o|radier/.test(text)) return "fundacao";
    if (/estrutura|estrutural|pilar|viga|laje/.test(text)) return "estrutura";
    if (/parede\s+completa|alvenaria\s+completa|parede\s+pronta/.test(text)) return "parede_completa";
    if (/parede|alvenaria|bloco|tijolo|baiano|reboco|chapisco|embo[cÃ§]o/.test(text)) return "parede";
    if (/relatorio|relatÃ³rio|rdo|diario|diÃ¡rio/.test(text)) return "relatorio";
    return "conversa_geral";
  }

  function isEloPendingContextContinuation_(message) {
    const text = normalizeText(message || "");
    if (!text) return false;
    if (/^(?:op[cÃ§][aÃ£]o\s*)?\d{1,2}$/.test(text)) return true;
    if (/^\d{1,2}\s*%$/.test(text)) return true;
    if (/^\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2}$/.test(text)) return true;
    if (/^(?:sem\s+)?(?:portas?|janelas?|vaos|v[aÃ£]os|revestimento|chapisco|reboco)\b/.test(text)) return true;
    if (/^(?:uma?|duas?|dois|tr[eÃª]s|\d+)\s+(?:porta|janela|vao|v[aÃ£]o)\b/.test(text)) return true;
    if (/^(?:perda\s+)?\d{1,2}\s*%/.test(text)) return true;
    if (/^(?:um|dois|2|1)\s+lados?/.test(text)) return true;
    return false;
  }

  function hasEloExplicitTopicSwitchMarker_(message) {
    const text = normalizeText(message || "");
    return /\bagora\b|vamos\s+para|mudar\s+para|trocar\s+para|calcule\s+fundacao|calcule\s+fundaÃ§Ã£o|fundacao\s+completa|fundaÃ§Ã£o\s+completa|estrutura|proposta|orcamento\s+residencial|orÃ§amento\s+residencial|\bcadista\b|\bstock\b|relatorio|relatÃ³rio/.test(text);
  }

  function detectEloTopicSwitch_(previousTopic, newMessage) {
    const nextTopic = detectEloConversationTopic_(newMessage);
    if (!previousTopic || previousTopic === "conversa_geral" || nextTopic === "conversa_geral") {
      return { switched: false, previousTopic: previousTopic || "", nextTopic: nextTopic };
    }
    if (previousTopic === nextTopic) {
      return { switched: false, previousTopic: previousTopic, nextTopic: nextTopic };
    }
    if (isEloPendingContextContinuation_(newMessage) && !hasEloExplicitTopicSwitchMarker_(newMessage)) {
      return { switched: false, previousTopic: previousTopic, nextTopic: previousTopic };
    }
    return { switched: true, previousTopic: previousTopic, nextTopic: nextTopic };
  }

  function clearEloPendingContextIfTopicChanged_(message) {
    const previousTopic = ELO_SESSION_MEMORY.activeConversationTopic || "";
    const switchState = detectEloTopicSwitch_(previousTopic, message);
    const nextTopic = switchState.nextTopic || detectEloConversationTopic_(message);
    if (switchState.switched) {
      clearEloPendingPremises_();
      if (ELO_SESSION_MEMORY.stockObrasCompositionBriefing) {
        ELO_SESSION_MEMORY.stockObrasCompositionBriefing.active = false;
        ELO_SESSION_MEMORY.stockObrasCompositionBriefing.pending_question = "";
      }
    }
    if (nextTopic && nextTopic !== "conversa_geral") {
      ELO_SESSION_MEMORY.activeConversationTopic = nextTopic;
    }
    return switchState;
  }

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
        fullAnswer: "Me diga sobre qual parte do ObraReport vocÃª quer continuar: PDF, RDO, materiais, planos ou relatÃ³rios?",
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
        fullAnswer: "Depois de gerar o PDF, vocÃª pode baixar o arquivo, enviar ao cliente ou compartilhar um resumo por WhatsApp, se essa opÃ§Ã£o estiver disponÃ­vel.",
        nextAction: "Abra o PDF gerado e confira se obra, fotos, conclusÃ£o e identificaÃ§Ã£o estÃ£o corretas."
      },
      relatorio: {
        shortAnswer: "Depois do relatÃ³rio, revise antes de entregar.",
        fullAnswer: "Confira cliente, obra, fotos, inconformidades, conclusÃ£o tÃ©cnica e a etapa Gerar. Se estiver completo, avance para o PDF.",
        nextAction: "Pergunte: posso gerar o PDF?"
      },
      rdo: {
        shortAnswer: "No RDO, avance pelo que falta preencher.",
        fullAnswer: "Confira data, obra, responsÃ¡vel, equipe, serviÃ§os, produÃ§Ã£o, materiais, ocorrÃªncias, fotos e resumo. Depois salve e gere o PDF do diÃ¡rio.",
        nextAction: "Pergunte: revisar RDO."
      },
      materiais: {
        shortAnswer: "Agora revise os materiais lanÃ§ados.",
        fullAnswer: "Confira se material, quantidade, unidade e valor fazem sentido. Se houver produÃ§Ã£o executada, compare o consumo registrado com o consumo estimado.",
        nextAction: "Pergunte: como funciona auditoria de consumo?"
      },
      auditoria: {
        shortAnswer: "Na auditoria, compare estimado e registrado.",
        fullAnswer: "Veja se hÃ¡ produÃ§Ã£o executada, composiÃ§Ãµes e materiais consumidos. A diferenÃ§a ajuda a identificar consumo acima ou abaixo do previsto.",
        nextAction: "Revise a auditoria antes de gerar o resumo do RDO."
      },
      planos: {
        shortAnswer: "Nos planos, escolha o caminho comercial.",
        fullAnswer: "Compare Gratuito, Profissional e Empresa. Para vender manualmente nesta fase, use o WhatsApp do plano adequado e siga com ativaÃ§Ã£o assistida.",
        nextAction: "Se for equipe ou construtora, avalie o plano Empresa."
      },
      whatsapp: {
        shortAnswer: "Depois do WhatsApp, revise a mensagem.",
        fullAnswer: "O ObraReport abre uma mensagem pronta. Revise obra, cliente, produÃ§Ã£o, materiais e ocorrÃªncias antes de enviar.",
        nextAction: "Se o WhatsApp nÃ£o abrir, verifique pop-ups e WhatsApp Web/app."
      },
      fotos: {
        shortAnswer: "Depois das fotos, revise legendas e contexto.",
        fullAnswer: "Confira se as fotos mostram claramente o problema, etapa da obra ou evidÃªncia. Use legenda objetiva antes de gerar o PDF.",
        nextAction: "Depois avance para revisÃ£o/conclusÃ£o."
      },
      salvamento: {
        shortAnswer: "Depois de salvar, confira o histÃ³rico.",
        fullAnswer: "Veja se o item aparece na lista, histÃ³rico ou status da tela. Evite recarregar antes de confirmar o salvamento.",
        nextAction: "Se houver dÃºvida, pergunte: o que estÃ¡ pendente?"
      },
      sincronizacao: {
        shortAnswer: "Na sincronizaÃ§Ã£o, acompanhe o status da tela.",
        fullAnswer: "Use o status local/nuvem exibido pelo ObraReport. Se algo nÃ£o sincronizar, mantenha a pÃ¡gina aberta e tente salvar novamente.",
        nextAction: "NÃ£o limpe o navegador antes de confirmar os dados."
      },
      cliente: {
        shortAnswer: "Depois do cliente, vincule uma obra.",
        fullAnswer: "O cliente organiza obras, relatÃ³rios e RDOs. Depois de cadastrar, crie a obra vinculada e siga para relatÃ³rio ou diÃ¡rio.",
        nextAction: "Abra Obras para cadastrar ou revisar a obra vinculada."
      },
      obra: {
        shortAnswer: "Depois da obra, escolha o documento.",
        fullAnswer: "Com a obra cadastrada, vocÃª pode criar relatÃ³rio tÃ©cnico, RDO, lanÃ§ar materiais e gerar PDFs profissionais.",
        nextAction: "Escolha RelatÃ³rios ou DiÃ¡rio de Obras."
      },
      suporte: {
        shortAnswer: "No suporte, descreva o problema de forma objetiva.",
        fullAnswer: "Informe a tela, o que tentou fazer e a mensagem exibida. Isso ajuda a orientar a implantaÃ§Ã£o ou correÃ§Ã£o.",
        nextAction: "Use WhatsApp de suporte quando estiver configurado."
      }
    };

    const answer = themeAnswers[theme] || {
      shortAnswer: "Vamos continuar pelo contexto atual.",
      fullAnswer: "VocÃª estava falando sobre " + theme + " em " + (ELO_SESSION_MEMORY.lastContext || context) + ".",
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
      "como faÃ§o isso",
      "pode explicar melhor",
      "me diga o proximo passo",
      "me diga o prÃ³ximo passo",
      "continua",
      "sim",
      "nao entendi",
      "nÃ£o entendi",
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
      ["relatorio", ["relatorio", "relatÃ³rios", "relatorio tecnico", "qualidade"]],
      ["rdo", ["rdo", "diario", "diÃ¡rio", "diario de obra"]],
      ["materiais", ["material", "materiais", "consumo"]],
      ["auditoria", ["auditoria", "audito", "auditar", "comparar consumo"]],
      ["planos", ["plano", "planos", "profissional", "empresa", "gratuito"]],
      ["whatsapp", ["whatsapp", "zap", "mensagem"]],
      ["fotos", ["foto", "fotos", "imagem", "imagens"]],
      ["salvamento", ["salvar", "salvamento", "salvo"]],
      ["sincronizacao", ["sincronizar", "sincronizacao", "sincronizaÃ§Ã£o", "nuvem"]],
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
    if (hasAnyTerm(normalizedQuestion, ["nao", "nÃ£o", "erro", "sumiu", "nao abre", "nÃ£o abre"])) {
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
      return "NÃ£o consegui ler o anexo porque o arquivo excede o limite desta versÃ£o do Elo.";
    }
    return "NÃ£o consegui ler o anexo. O PDF pode estar escaneado, vazio, corrompido ou sem texto extraÃ­vel.";
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
      "diÃ¡rio",
      "relatorio",
      "relatÃ³rio",
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
    if (hasAnyTerm(text, ["pdf", "relatorio", "relatÃ³rio", "foto"])) {
      return "relatorios";
    }
    if (hasAnyTerm(text, ["rdo", "diario", "diÃ¡rio", "materiais", "material", "auditoria", "consumo"])) {
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
          "Ãštil: " + (item.foiUtil === null ? "sem feedback" : (item.foiUtil ? "sim" : "nÃ£o")),
          "Sugerida para treino: " + (item.sugeridaParaTreino ? "sim" : "nÃ£o"),
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
      { regex: /^meu nome (?:Ã©|e) (.+)$/i, label: "meu nome", category: "nome" },
      { regex: /^eu me chamo (.+)$/i, label: "meu nome", category: "nome" },
      { regex: /^meu filho se chama (.+)$/i, label: "nome do meu filho", category: "familia" },
      { regex: /^minha filha se chama (.+)$/i, label: "nome da minha filha", category: "familia" },
      { regex: /^minha empresa (?:Ã©|e) (.+)$/i, label: "minha empresa", category: "empresa" },
      { regex: /^eu moro em (.+)$/i, label: "onde eu moro", category: "cidade" },
      { regex: /^minha cidade (?:Ã©|e) (.+)$/i, label: "minha cidade", category: "cidade" },
      { regex: /^meu projeto principal (?:Ã©|e) (.+)$/i, label: "meu projeto principal", category: "projeto" },
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
      if (text.indexOf("o que voce lembra de mim") >= 0 || text.indexOf("o que vocÃª lembra de mim") >= 0) {
        return {
          shortAnswer: "Ainda nÃ£o tenho memÃ³rias pessoais salvas.",
          fullAnswer: "Quando vocÃª me disser algo como 'meu filho se chama Davi', eu vou perguntar se devo lembrar antes de salvar.",
          nextAction: "VocÃª pode me ensinar uma memÃ³ria simples agora.",
          canSave: false
        };
      }
      return null;
    }

    const queryMap = [
      { tests: ["qual meu nome", "como eu me chamo"], label: "meu nome", response: "VocÃª me disse que seu nome Ã© " },
      { tests: ["qual o nome do meu filho"], label: "nome do meu filho", response: "VocÃª me disse que seu filho se chama " },
      { tests: ["qual o nome da minha filha"], label: "nome da minha filha", response: "VocÃª me disse que sua filha se chama " },
      { tests: ["qual minha empresa"], label: "minha empresa", response: "VocÃª me disse que sua empresa Ã© " },
      { tests: ["onde eu moro", "qual minha cidade"], label: "minha cidade", fallbackLabel: "onde eu moro", response: "VocÃª me disse que sua cidade Ã© " },
      { tests: ["qual meu projeto principal"], label: "meu projeto principal", response: "Eu lembro que seu projeto principal Ã© " },
      { tests: ["do que eu gosto"], label: "algo que eu gosto", response: "VocÃª me disse que gosta de " }
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
            fullAnswer: "Essa memÃ³ria estÃ¡ salva apenas neste navegador, na categoria " + memoryItem.category + ".",
            nextAction: "Use Minhas memÃ³rias para revisar ou excluir quando quiser.",
            canSave: false
          };
        }
      }
    }

    if (text.indexOf("o que voce lembra de mim") >= 0 || text.indexOf("o que vocÃª lembra de mim") >= 0) {
      return {
        shortAnswer: "Eu lembro destas informaÃ§Ãµes pessoais salvas neste navegador:",
        fullAnswer: memories.map(function (item) {
          return "- " + item.label + ": " + item.value;
        }).join("\n"),
        nextAction: "Use Minhas memÃ³rias para revisar, excluir ou limpar tudo.",
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
    return sanitizeLibraryText(title || fallback || "MemÃ³ria importante", 120).replace(/\.$/, "");
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
    if (hasAnyTerm(text, ["roadmap", "plano", "o plano e", "o plano ÃƒÂ©"])) {
      return "objetivo";
    }
    if (hasAnyTerm(text, ["projeto", "produto", "desenvolver", "construir", "minha ideia", "ideia e", "ideia ÃƒÂ©"])) {
      return "projeto";
    }
    if (hasAnyTerm(text, ["objetivo", "meta", "foco", "precisa virar", "preciso", "quero"])) {
      return "objetivo";
    }
    if (hasAnyTerm(text, ["aprendi", "percebi", "prefiro", "gosto", "nao posso esquecer", "nÃƒÂ£o posso esquecer"])) {
      return "preferencia";
    }
    return "objetivo";
  }

  function summarizeImportantMemoryCandidate_(value) {
    return sanitizeLibraryText(value, 360)
      .replace(/^(quero lembrar que|guarde isso:?|isso e importante:?|isso ÃƒÂ© importante:?|minha ideia e|minha ideia ÃƒÂ©|o objetivo e|o objetivo ÃƒÂ©|decidi que|o plano e|o plano ÃƒÂ©|o roadmap e|o roadmap ÃƒÂ©|nao posso esquecer que|nÃƒÂ£o posso esquecer que|aprendi que|percebi que)\s*/i, "")
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

    const explicitImportantMatch = cleanQuestion.match(/^(?:quero lembrar que|guarde isso:?|isso (?:e|ÃƒÂ©) importante:?|minha ideia (?:e|ÃƒÂ©)|o objetivo (?:e|ÃƒÂ©)|decidi que|o plano (?:e|ÃƒÂ©)|o roadmap (?:e|ÃƒÂ©)|n(?:a|ÃƒÂ£)o posso esquecer que|aprendi que|percebi que)\s+(.+)$/i);
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
      { regex: /^meu projeto (?:Ã©|e) (.+)$/i, titleGroup: 1 }
    ];

    for (let index = 0; index < projectPatterns.length; index += 1) {
      const match = cleanQuestion.match(projectPatterns[index].regex);
      if (match && match[projectPatterns[index].titleGroup]) {
        const title = extractImportantTitle(match[projectPatterns[index].titleGroup]);
        return {
          tipo: "projeto",
          titulo: title,
          descricao: "UsuÃ¡rio estÃ¡ desenvolvendo " + title + ".",
          status: "ativo",
          sourceQuestion: cleanQuestion
        };
      }
    }

    const objectivePatterns = [
      /^meu objetivo (?:Ã©|e) (.+)$/i,
      /^quero (conseguir .+|finalizar .+|terminar .+|vender .+|publicar .+|testar .+)$/i,
      /^meu foco agora (?:Ã©|e) (.+)$/i
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
        shortAnswer: result.ok ? "Atualizei essa memÃ³ria importante." : "NÃ£o encontrei essa memÃ³ria importante.",
        fullAnswer: result.ok ? result.item.titulo + " agora estÃ¡ como " + result.item.status + "." : "Abra MemÃ³rias importantes para conferir o nome salvo ou escolha o item certo.",
        nextAction: result.ok ? "VocÃª pode consultar suas memÃ³rias importantes quando quiser." : "Me diga exatamente qual projeto, objetivo ou preferÃªncia deseja atualizar.",
        canSave: false
      };
    }

    const objectiveUpdateMatch = text.match(/^atualize meu objetivo para (.+?)[.!?]?$/);
    if (objectiveUpdateMatch && objectiveUpdateMatch[1]) {
      const firstGoal = goals[0];
      if (!firstGoal) {
        return {
          shortAnswer: "Ainda nÃ£o encontrei objetivo salvo para atualizar.",
          fullAnswer: "Diga algo como: Meu objetivo Ã© conseguir 3 clientes. Eu vou perguntar antes de guardar.",
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

    if (hasAnyTerm(text, ["quais projetos voce lembra", "quais projetos vocÃª lembra", "o que voce sabe sobre meus projetos", "o que vocÃª sabe sobre meus projetos"])) {
      return {
        shortAnswer: projects.length ? "Projetos importantes salvos:" : "Ainda nÃ£o tenho projetos importantes salvos.",
        fullAnswer: projects.length ? projects.map(function (item) {
          return "- " + item.titulo + " â€” " + item.status;
        }).join("\n") : "Quando vocÃª disser algo como 'Estou desenvolvendo o ObraReport', eu posso perguntar se deseja guardar como projeto.",
        nextAction: "Use MemÃ³rias importantes para revisar ou excluir.",
        canSave: false
      };
    }

    if (hasAnyTerm(text, ["quais objetivos eu tenho", "quais sao meus objetivos", "quais sÃ£o meus objetivos"])) {
      return {
        shortAnswer: goals.length ? "Objetivos importantes salvos:" : "Ainda nÃ£o tenho objetivos importantes salvos.",
        fullAnswer: goals.length ? goals.map(function (item) {
          return "- " + item.titulo + " â€” " + item.status + (item.descricao ? "\n  " + item.descricao : "");
        }).join("\n") : "Quando vocÃª disser algo como 'Quero conseguir meus primeiros clientes', eu posso perguntar se deseja guardar como objetivo.",
        nextAction: "Use MemÃ³rias importantes para revisar ou excluir.",
        canSave: false
      };
    }

    if (hasAnyTerm(text, ["quais preferencias voce lembra", "quais preferÃªncias vocÃª lembra", "quais preferencias vocÃª lembra", "quais preferÃªncias voce lembra"])) {
      return {
        shortAnswer: preferences.length ? "PreferÃªncias importantes salvas:" : "Ainda nÃ£o tenho preferÃªncias importantes salvas.",
        fullAnswer: preferences.length ? preferences.map(function (item) {
          return "- " + item.titulo + " â€” " + item.descricao;
        }).join("\n") : "Quando vocÃª disser algo como 'Prefiro relatÃ³rios tÃ©cnicos', eu posso perguntar antes de guardar.",
        nextAction: "Use MemÃ³rias importantes para revisar ou excluir.",
        canSave: false
      };
    }

    if (hasAnyTerm(text, ["o que voce lembra de mim", "o que vocÃª lembra de mim"])) {
      if (!hasAnyMemory) {
        return {
          shortAnswer: "Ainda nÃ£o tenho memÃ³rias importantes salvas.",
          fullAnswer: "Quando vocÃª me disser algo relevante sobre projetos, objetivos ou preferÃªncias, eu vou perguntar antes de guardar.",
          nextAction: "Exemplo: Estou desenvolvendo o ObraReport.",
          canSave: false
        };
      }

      return {
        shortAnswer: "Estas sÃ£o suas memÃ³rias importantes salvas neste navegador:",
        fullAnswer: formatImportantMemoriesForAnswer(storage),
        nextAction: "Abra MemÃ³rias importantes para revisar, excluir ou limpar.",
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
      ["PreferÃªncias", storage.preferencias || []]
    ];

    return sections.map(function (section) {
      const title = section[0];
      const items = section[1];
      return title + ":\n" + (items.length ? items.map(function (item) {
        return "- " + item.titulo + " â€” " + item.status;
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
    if (["oi", "ola", "olÃ¡", "tudo bem", "obrigado", "obrigada", "valeu", "tchau"].indexOf(normalizedQuestion) >= 0) {
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
      ["RDO", ["rdo", "diario de obra", "diÃ¡rio de obra"]],
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
    if (hasAnyTerm(text, ["preocupado", "preocupada", "preocupacao", "preocupaÃ§Ã£o"])) {
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
    if (hasAnyTerm(text, ["cansado", "cansada", "triste", "preocupado", "preocupada", "dificil", "difÃ­cil", "hoje foi dificil", "hoje foi difÃ­cil"])) {
      return "dificuldade";
    }
    if (hasAnyTerm(text, ["quero", "objetivo", "meta", "roadmap", "o plano e", "o plano ÃƒÂ©"])) {
      return "objetivo";
    }
    if (hasAnyTerm(text, ["marco", "importante", "avancei", "avancamos", "avanÃ§amos", "avancou", "comecei", "lembre que hoje"])) {
      return "marco";
    }
    return "marco";
  }

  function detectTimelineImportance(text, type) {
    if (hasAnyTerm(text, ["avancei", "avancamos", "avanÃ§amos"])) {
      return "media";
    }
    if (type === "marco" || hasAnyTerm(text, ["primeira venda", "primeiro cliente", "marco", "terminei", "finalizei", "consegui"])) {
      return "alta";
    }
    if (type === "ideia" || type === "objetivo" || hasAnyTerm(text, ["avancei", "avancamos", "avanÃ§amos", "objetivo", "meta"])) {
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
      "hoje foi difÃ­cil",
      "hoje foi produtivo",
      "avancamos no obrareport",
      "avanÃ§amos no obrareport",
      "avancei no elo",
      "quero registrar isso",
      "decidi que",
      "o plano e",
      "roadmap",
      "aprendi que",
      "percebi que",
      "isso e um marco",
      "isso Ã© um marco"
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
      source: "detecÃ§Ã£o automÃ¡tica confirmada"
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

    if (hasAnyTerm(text, ["quais foram meus ultimos avancos", "quais foram meus ultimos avanÃƒÂ§os", "ultimos avancos", "ÃƒÂºltimos avanÃƒÂ§os", "ultimos marcos", "ÃƒÂºltimos marcos"])) {
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
    if (hasAnyTerm(text, ["faca um relatorio da minha jornada", "faÃƒÂ§a um relatÃƒÂ³rio da minha jornada", "relatorio da minha jornada", "relatÃƒÂ³rio da minha jornada", "o que aconteceu comigo este mes", "o que aconteceu comigo esse mes", "qual foi meu avanco", "qual foi meu avanÃƒÂ§o", "no que eu evolui", "no que eu evoluÃƒÂ­", "quais projetos estao mais ativos", "quais projetos estÃƒÂ£o mais ativos", "qual meu foco atual", "o que voce percebe da minha semana", "o que vocÃƒÂª percebe da minha semana"])) {
      return hasAnyTerm(text, ["semana"]) ? "weekly" : (hasAnyTerm(text, ["mes", "mÃƒÂªs"]) ? "monthly" : "general");
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
      return /^([-*]|\d+[.)])\s+/.test(line) || /^[A-ZÃÃ‰ÃÃ“ÃšÃ‚ÃŠÃ”ÃƒÃ•Ã‡][^.!?]{8,80}$/.test(line);
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
      return "Sua biblioteca local ainda nÃ£o tem itens. VocÃª pode colar textos, roadmaps, ideias, notas ou resumos para eu consultar depois.";
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
        shortAnswer: "NÃ£o encontrei essa informaÃ§Ã£o na sua biblioteca local ainda.",
        fullAnswer: "Se quiser, cole um texto, registre uma ideia ou salve um roadmap para eu consultar depois.",
        nextAction: "Abra Ferramentas do Elo > Biblioteca do Elo para adicionar conteÃºdo.",
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
      : "Na biblioteca existe material sobre isso, mas ainda tenho pouca memÃ³ria da sua jornada para comparar melhor.";
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
      lines.push("Pelo que estÃ¡ na sua biblioteca e na sua jornada, " + sourceTitle + " se conecta ao foco atual em " + focus + ".");
    }
    if (projects.length) {
      lines.push("Projetos relacionados que aparecem nas suas memÃ³rias: " + formatNarrativeList(projects) + ".");
    }
    if (goals.length) {
      lines.push("Objetivos que podem se relacionar com isso: " + formatNarrativeList(goals) + ".");
    }
    return lines.length ? lines.join(" ") : "A biblioteca tem material sobre isso, mas ainda tenho pouca memÃ³ria da sua jornada para comparar melhor.";
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
          shortAnswer: "NÃ£o encontrei essa informaÃ§Ã£o nos documentos locais.",
          fullAnswer: "A base local tem " + documents.length + " documento(s), mas nenhum trecho teve relaÃ§Ã£o suficiente com a pergunta.",
          nextAction: "Abra Documentos do Elo para revisar textos importados ou adicionar um documento mais especÃ­fico.",
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
    "RelatÃ³rios",
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
      { category: "RelatÃ³rios", keywords: ["relatorio", "pdf", "foto", "qualidade"] },
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

    if (["teste", "ola", "olÃ¡", "oi", "bom dia", "boa tarde", "boa noite"].indexOf(combined.trim()) >= 0) {
      return { show: false, reason: "low_future_value", suggestedTarget: "none" };
    }

    if (hasAnyTerm(combined, ["biblioteca", "guardar na biblioteca", "guarde na biblioteca", "usar depois", "resumo de reuniao", "resumo de reuniÃ£o", "roadmap", "especificacao de produto", "especificaÃ§Ã£o de produto"])) {
      return { show: true, reason: "reusable_technical_content", suggestedTarget: "library" };
    }

    if (hasAnyTerm(combined, ["guarde", "guardar", "lembre", "lembrar", "prefiro", "minha preferencia", "minha preferÃªncia", "regra de negocio", "regra de negÃ³cio", "preferencia permanente", "preferÃªncia permanente"])) {
      return { show: true, reason: "durable_memory", suggestedTarget: "memory" };
    }

    if (hasAnyTerm(combined, ["decisao estrategica", "decisÃ£o estratÃ©gica", "estrategia do projeto", "estratÃ©gia do projeto", "planejamento importante", "plano de acao", "plano de aÃ§Ã£o", "roadmap", "stock full"]) && assistantResponse.length > 220) {
      return { show: true, reason: "strategic_decision", suggestedTarget: "both" };
    }

    if (context === "saude" && hasAnyTerm(combined, ["protocolo", "auditoria", "compras", "validade", "lote"])) {
      return { show: true, reason: "health_operations_reference", suggestedTarget: "library" };
    }

    return { show: false, reason: "not_reusable_enough", suggestedTarget: "none" };
  }

  function isSimpleEloCalculation(normalizedText) {
    const hasMeasure = /\b\d+(?:[,.]\d+)?\s*(?:(?:x|Ã—|\?|por)\s*\d+(?:[,.]\d+)?|m2|m3|m|metros?|cm)\b/.test(normalizedText);
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
      "calÃ§ada",
      "piso",
      "revestimento",
      "tinta",
      "argamassa",
      "m2",
      "m3"
    ]);
    const asksToSave = hasAnyTerm(normalizedText, ["guardar", "guarde", "lembrar", "lembre", "resumo", "relatorio", "relatÃ³rio", "orcamento", "orÃ§amento", "planejamento"]);
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
      name: "Stock SaÃºde",
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
      description: "SaaS de relatÃ³rios, RDO, materiais, PDF e Elo Assistente.",
      nextAction: "Continuar evoluÃ§Ã£o comercial e validar com clientes.",
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
          shortAnswer: "Ainda nÃ£o hÃ¡ projetos salvos no Elo.",
          fullAnswer: "Abra Projetos para adicionar seus projetos ou usar a lista sugerida com CADISTA, Stock Full, Elo, Stock SaÃºde e ObraReport.",
          nextAction: "Clique em Projetos no painel do Elo.",
          canSave: false
        };
      }
      return null;
    }

    if (text.indexOf("quais sao meus projetos") >= 0 || text.indexOf("quais sÃ£o meus projetos") >= 0) {
      return {
        shortAnswer: "Seus projetos salvos sÃ£o:",
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
        shortAnswer: "Seu projeto de maior prioridade Ã© " + mainProject.name + ".",
        fullAnswer: mainProject.description || "Ele estÃ¡ salvo na Ã¡rea Projetos do Elo.",
        nextAction: mainProject.nextAction || "Defina uma prÃ³xima aÃ§Ã£o para esse projeto.",
        canSave: false
      };
    }

    if (text.indexOf("quais projetos estao ativos") >= 0 || text.indexOf("quais projetos estÃ£o ativos") >= 0) {
      const activeProjects = projects.filter(function (project) {
        return project.status === "ativo";
      });
      return {
        shortAnswer: activeProjects.length ? "Seus projetos ativos sÃ£o: " + activeProjects.map(function (project) { return project.name; }).join(", ") + "." : "VocÃª nÃ£o tem projetos ativos salvos agora.",
        fullAnswer: activeProjects.map(function (project) {
          return "- " + project.name + ": " + (project.nextAction || "sem prÃ³xima aÃ§Ã£o definida");
        }).join("\n") || "Marque um projeto como ativo na Ã¡rea Projetos.",
        nextAction: "Abra Projetos para escolher o foco atual.",
        canSave: false
      };
    }

    if (text.indexOf("quais estao pausados") >= 0 || text.indexOf("quais estÃ£o pausados") >= 0) {
      const pausedProjects = projects.filter(function (project) {
        return project.status === "pausado";
      });
      return {
        shortAnswer: pausedProjects.length ? "Projetos pausados: " + pausedProjects.map(function (project) { return project.name; }).join(", ") + "." : "NÃ£o hÃ¡ projetos pausados salvos.",
        fullAnswer: pausedProjects.map(function (project) {
          return "- " + project.name + ": " + (project.description || "sem descriÃ§Ã£o");
        }).join("\n") || "Nada pausado por enquanto.",
        nextAction: "VocÃª pode reativar um projeto pela Ã¡rea Projetos.",
        canSave: false
      };
    }

    if (text.indexOf("o que devo continuar") >= 0) {
      const mainProject = getMainProject();
      return {
        shortAnswer: "Eu continuaria por " + mainProject.name + ".",
        fullAnswer: mainProject.description || "Esse parece ser seu projeto mais importante agora.",
        nextAction: mainProject.nextAction || "Defina uma prÃ³xima aÃ§Ã£o objetiva para avanÃ§ar.",
        canSave: false
      };
    }

    const remindMatch = text.match(/me lembre do (.+)$/);
    if (remindMatch && remindMatch[1]) {
      const project = findProjectByName(remindMatch[1]);
      if (project) {
        return {
          shortAnswer: project.name + " estÃ¡ registrado como " + project.status + ".",
          fullAnswer: project.description || "Sem descriÃ§Ã£o salva.",
          nextAction: project.nextAction || "Defina a prÃ³xima aÃ§Ã£o desse projeto.",
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
          shortAnswer: "Ainda nÃ£o hÃ¡ objetivos salvos no Elo.",
          fullAnswer: "Abra Projetos > Objetivos para adicionar objetivos ou usar a lista sugerida.",
          nextAction: "Clique em Projetos no painel do Elo.",
          canSave: false
        };
      }
      return null;
    }

    if (text.indexOf("quais sao meus objetivos") >= 0 || text.indexOf("quais sÃ£o meus objetivos") >= 0 || text.indexOf("o que esta pendente") >= 0 || text.indexOf("o que estÃ¡ pendente") >= 0) {
      return {
        shortAnswer: openGoals.length ? "Seus objetivos abertos/em andamento sÃ£o:" : "VocÃª nÃ£o tem objetivos pendentes agora.",
        fullAnswer: openGoals.map(function (goal) {
          return "- " + goal.title + " (" + goal.status + ")" + (goal.targetDate ? " atÃ© " + goal.targetDate : "");
        }).join("\n") || "Os objetivos salvos estÃ£o concluÃ­dos.",
        nextAction: "Abra Projetos para marcar objetivos como concluÃ­dos ou adicionar novos.",
        canSave: false
      };
    }

    if (text.indexOf("qual meu proximo objetivo") >= 0 || text.indexOf("qual meu prÃ³ximo objetivo") >= 0 || text.indexOf("o que quero fazer com o obrareport") >= 0) {
      const goal = openGoals[0] || goals[0];
      return {
        shortAnswer: "Seu prÃ³ximo objetivo Ã©: " + goal.title + ".",
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
      "stock saÃºde",
      "obrareport",
      "obra report",
      "elo",
      "elo informe"
    ]);
  }

  function buildEloOnlineUnavailableResponse_() {
    const answer = "NÃ£o consegui consultar o Elo online neste momento.";
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
    const forbiddenLine = /^\s*(?:guardar|nÃ£o guardar|nao guardar|guardar na biblioteca|nÃ£o guardar na biblioteca|nao guardar na biblioteca|guardar biblioteca|memÃ³ria|memoria|biblioteca|nÃ£o salvar|nao salvar)\s*$/i;
    const forbiddenControlsLine = /^\s*(?:[\s.,;:|â€¢Â·-]+|guardar|nÃ£o guardar|nao guardar|guardar na biblioteca|nÃ£o guardar na biblioteca|nao guardar na biblioteca|memÃ³ria|memoria|biblioteca|nÃ£o salvar|nao salvar)+\s*$/i;
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/Deseja guardar isso para eu lembrar depois\??/gi, "")
      .replace(/Deseja guardar isso na Biblioteca do Elo\??/gi, "")
      .replace(/Deseja guardar isso na Biblioteca\??/gi, "")
      .replace(/Deseja guardar isso para a Biblioteca\??/gi, "")
      .replace(/Salvar esta conversa\??/gi, "")
      .replace(/\s*Guardar\s*[.,;:|â€¢Â·-]+\s*NÃ£o guardar\s*[.,;:|â€¢Â·-]+\s*Guardar na Biblioteca\s*[.,;:|â€¢Â·-]+\s*NÃ£o guardar na Biblioteca\s*$/gi, "")
      .replace(/\s*Guardar\s*[.,;:|â€¢Â·-]+\s*Nao guardar\s*[.,;:|â€¢Â·-]+\s*Guardar na Biblioteca\s*[.,;:|â€¢Â·-]+\s*Nao guardar na Biblioteca\s*$/gi, "")
      .replace(/\bGuardar na Biblioteca\b/gi, "")
      .replace(/\bNÃ£o guardar na Biblioteca\b/gi, "")
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
      return "data nÃ£o disponÃ­vel";
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
    let match = cleanText.match(/(?:meu nome Ã©|meu nome e|me chamo|eu me chamo)\s+([^,.;!?\n]{2,80})/i);
    if (match && match[1]) {
      profile.nome = sanitizeLibraryText(match[1], 80).replace(/[.,;:]+$/g, "");
    }

    const professionMap = [
      ["engenheiro civil", "Engenheiro Civil"],
      ["engenheira civil", "Engenheira Civil"],
      ["arquiteto", "Arquiteto"],
      ["arquiteta", "Arquiteta"],
      ["tÃ©cnico em edificaÃ§Ãµes", "TÃ©cnico em EdificaÃ§Ãµes"],
      ["tecnico em edificacoes", "TÃ©cnico em EdificaÃ§Ãµes"],
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

    match = cleanText.match(/(?:minha empresa Ã©|minha empresa e|empresa chamada|trabalho na|trabalho em)\s+([^.\n]{3,120})/i);
    if (match && match[1]) {
      profile.empresa = sanitizeLibraryText(match[1], 160).replace(/[.,;:]+$/g, "");
    } else if (hasAnyTerm(normalized, ["empresa propria", "empresa prÃ³pria", "tenho empresa"])) {
      profile.empresa = "empresa prÃ³pria";
    }

    match = cleanText.match(/(?:moro em|cidade Ã©|cidade e|atuo em)\s+([^.\n]{3,100})/i);
    if (match && match[1]) {
      profile.cidade = sanitizeLibraryText(match[1], 140).replace(/[.,;:]+$/g, "");
    }

    const areaCandidates = [
      ["pericias", "perÃ­cias"],
      ["perÃ­cias", "perÃ­cias"],
      ["projetos", "projetos"],
      ["obras", "obras"],
      ["relatorios", "relatÃ³rios"],
      ["relatÃ³rios", "relatÃ³rios"],
      ["rdo", "RDO"],
      ["materiais", "materiais"],
      ["auditoria de consumo", "auditoria de consumo"],
      ["laudos", "laudos"],
      ["engenharia", "engenharia"],
      ["construcao", "construÃ§Ã£o"],
      ["construÃ§Ã£o", "construÃ§Ã£o"]
    ];
    profile.areas = areaCandidates.filter(function (item) {
      return normalized.indexOf(normalizeText(item[0])) >= 0;
    }).map(function (item) {
      return item[1];
    });

    const knownProjects = ["CADISTA", "Stock Full", "Elo", "Stock SaÃºde", "ObraReport"];
    profile.projetos = knownProjects.filter(function (project) {
      return normalized.indexOf(normalizeText(project)) >= 0;
    });
    const projectMatch = cleanText.match(/(?:estou desenvolvendo|desenvolvendo|projeto chamado|projeto principal Ã©|projeto principal e)\s+([^.\n]{3,100})/i);
    if (projectMatch && projectMatch[1]) {
      profile.projetos = mergeUniqueTextItems(profile.projetos, extractImportantTitle(projectMatch[1]));
    }

    const objectiveMatches = cleanText.match(/(?:meu objetivo Ã©|meu objetivo e|objetivo Ã©|objetivo e|quero)\s+([^.\n]{4,180})/gi) || [];
    profile.objetivos = objectiveMatches.map(function (item) {
      return item.replace(/^(meu objetivo Ã©|meu objetivo e|objetivo Ã©|objetivo e|quero)\s+/i, "").replace(/[.,;:]+$/g, "");
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
      return value.length ? value.join(", ") : "nÃ£o identificado";
    }
    return value || "nÃ£o identificado";
  }

  function formatInitialProfileExtraction(profile) {
    return [
      "Encontrei estas informaÃ§Ãµes:",
      "",
      "Nome: " + formatUnknown(profile.nome),
      "ProfissÃ£o: " + formatUnknown(profile.profissao),
      "Empresa: " + formatUnknown(profile.empresa),
      "Cidade/local: " + formatUnknown(profile.cidade),
      "Ãreas: " + formatUnknown(profile.areas),
      "Projetos: " + formatUnknown(profile.projetos),
      "Objetivos: " + formatUnknown(profile.objetivos),
      "PreferÃªncias: " + formatUnknown(profile.preferencias)
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
          descricao: "Projeto detectado na importaÃ§Ã£o inicial de perfil.",
          status: "ativo",
          sourceQuestion: "importaÃ§Ã£o inicial de perfil"
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
          sourceQuestion: "importaÃ§Ã£o inicial de perfil"
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
          sourceQuestion: "importaÃ§Ã£o inicial de perfil"
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
      lines.push("vocÃª se chama " + profile.nome);
    }
    if (profile.profissao) {
      lines.push("Ã© " + profile.profissao);
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
    return "Pelo que vocÃª me autorizou a guardar, " + lines.join(", ") + ".";
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
      lines.push("Seu projeto principal informado Ã© " + profile.mainProject + ".");
    }
    if (profile.weeklyGoal) {
      lines.push("Seu objetivo principal desta semana Ã© " + profile.weeklyGoal + ".");
    }
    if (profile.expectedHelp) {
      lines.push("VocÃª espera minha ajuda principalmente com: " + profile.expectedHelp + ".");
    }
    if (profile.answerStyle) {
      lines.push("PreferÃªncia de resposta: " + profile.answerStyle + ".");
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
    return value ? value : label + ": Ainda nÃ£o tenho essa informaÃ§Ã£o salva.";
  }

  function formatConnectedProfileSummary(snapshot) {
    const intro = [];
    if (snapshot.userName) {
      intro.push(snapshot.userName);
    }
    const facts = [];
    if (snapshot.profession) {
      facts.push("vocÃª Ã© " + snapshot.profession);
    }
    if (snapshot.company) {
      facts.push("trabalha com " + snapshot.company);
    }
    if (snapshot.areas.length) {
      facts.push("atua com " + snapshot.areas.slice(0, 4).join(", "));
    }
    if (snapshot.mainProject) {
      facts.push("estÃ¡ desenvolvendo " + snapshot.mainProject);
    }
    if (snapshot.goals.length) {
      facts.push("tem como foco " + snapshot.goals.slice(0, 2).join(", "));
    }

    if (!facts.length) {
      return "Ainda nÃ£o tenho essa informaÃ§Ã£o salva.";
    }

    return (intro.length ? intro[0] + ", pelo que vocÃª autorizou guardar, " : "Pelo que vocÃª autorizou guardar, ") + facts.join(", ") + ".";
  }

  function formatTimelineMemoryLine(event) {
    if (!event) {
      return "Ainda nÃ£o tenho essa informaÃ§Ã£o salva.";
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
      identityParts.push("vocÃª Ã© " + snapshot.profession);
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
      "Por enquanto, tenho pouca coisa autorizada sobre vocÃª. Se vocÃª registrar projetos, objetivos, preferÃªncias ou acontecimentos na Linha do Tempo, eu consigo acompanhar sua jornada com mais contexto.",
      "Eu nÃ£o vou inventar fatos sobre vocÃª. Prefiro te responder com cuidado."
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
      sentences.push("O que mais aparece na sua jornada Ã© sua ligaÃ§Ã£o com " + formatNarrativeList(pieces.projects) + ".");
    } else if (snapshot.mainProject) {
      sentences.push("VocÃª tem dedicado energia a " + snapshot.mainProject + ".");
    }

    if (pieces.goals.length) {
      sentences.push("Seu foco atual parece passar por " + formatNarrativeList(pieces.goals) + ".");
    }

    if (pieces.preferences.length) {
      sentences.push("Algo que chama atenÃ§Ã£o nas suas preferÃªncias Ã© " + formatNarrativeList(pieces.preferences) + ".");
    }

    if (pieces.personalLine) {
      sentences.push("VocÃª tambÃ©m me confiou algumas memÃ³rias pessoais, como " + pieces.personalLine + ".");
    }

    if (pieces.recentEvent) {
      sentences.push("Ao olhar sua trajetÃ³ria recente, aparece o registro \"" + pieces.recentEvent.title + "\"" + (pieces.recentEvent.project ? " ligado a " + pieces.recentEvent.project : "") + ".");
    } else if (snapshot.recentEvents.length) {
      sentences.push("Sua Linha do Tempo jÃ¡ tem registros que ajudam a perceber continuidade na sua caminhada.");
    }

    if (pieces.libraryTitles.length) {
      sentences.push("Na sua Biblioteca, aparecem referÃªncias como " + formatNarrativeList(pieces.libraryTitles) + ".");
    }

    if (!sentences.length) {
      sentences.push("Ainda estou te conhecendo, mas jÃ¡ existe contexto suficiente para comeÃ§ar a formar uma visÃ£o melhor da sua jornada.");
    }

    sentences.push("Tudo isso vem apenas do que vocÃª autorizou guardar neste navegador.");
    return sentences.join("\n\n");
  }

  function buildEloJourneyAnswer(snapshot) {
    if (!hasNarrativeJourneyData(snapshot)) {
      return buildLowMemoryNarrativeAnswer();
    }
    const pieces = buildNarrativeMemoryPieces(snapshot);
    const lines = [];
    const namePrefix = pieces.name ? pieces.name + ", " : "";
    lines.push(namePrefix + "ao olhar sua trajetÃ³ria, o que mais aparece Ã© a tentativa de transformar ideias em algo organizado e Ãºtil.");
    if (pieces.projects.length) {
      lines.push("VocÃª tem dedicado energia a " + formatNarrativeList(pieces.projects) + ".");
    }
    if (pieces.goals.length) {
      lines.push("O foco atual parece estar em " + formatNarrativeList(pieces.goals) + ".");
    } else if (pieces.focus) {
      lines.push("O foco que mais se destaca agora Ã© " + pieces.focus + ".");
    }
    if (pieces.recentEvent) {
      lines.push("O acontecimento recente que mais pesa nessa leitura Ã© \"" + pieces.recentEvent.title + "\".");
    }
    lines.push("PrÃ³xima aÃ§Ã£o sugerida:\nconcluir o ciclo atual antes de abrir uma nova frente grande.");
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
    lines.push("Um padrÃ£o que eu percebo em vocÃª Ã© transformar problemas reais em ferramentas.");
    if (signals.length) {
      lines.push("Os temas que mais voltam sÃ£o " + formatNarrativeList(signals.slice(0, 4).map(function (signal) { return signal.name; })) + ".");
    } else if (pieces.projects.length) {
      lines.push("Os projetos que mais aparecem sÃ£o " + formatNarrativeList(pieces.projects) + ".");
    }
    if (pieces.goals.length) {
      lines.push("O que parece puxar sua energia agora Ã© " + formatNarrativeList(pieces.goals) + ".");
    } else if (dominant) {
      lines.push("O centro de gravidade parece ser " + dominant + ".");
    }
    lines.push("Eu diria isso com cuidado: o desafio nÃ£o parece ser falta de ideia, e sim escolher qual entrega merece fechar primeiro.");
    return lines.join("\n\n");
  }

  function buildEloEvolutionAnswer(snapshot) {
    if (!hasNarrativeJourneyData(snapshot)) {
      return buildLowMemoryNarrativeAnswer();
    }
    const pieces = buildNarrativeMemoryPieces(snapshot);
    const projectLine = pieces.projects.length ? formatNarrativeList(pieces.projects) : (pieces.focus || "seus projetos principais");
    const projectVerb = pieces.projects.length === 1 ? "comeÃ§a" : "comeÃ§am";
    const focusLine = pieces.goals.length ? formatNarrativeList(pieces.goals) : (pieces.focus || "concluir uma entrega Ãºtil");
    return [
      "Pelo que eu acompanho, algo mudou: seus projetos parecem menos soltos e mais conectados entre si.",
      "O que mudou:\n" + projectLine + " " + projectVerb + " a aparecer como parte de uma mesma construÃ§Ã£o.",
      "O que continua igual:\nsua tendÃªncia de transformar problemas reais em sistemas, produtos e rotinas.",
      "Foco atual:\n" + focusLine + ".",
      "PrÃ³xima aÃ§Ã£o sugerida:\nterminar o ciclo atual antes de abrir uma nova frente grande."
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
      lines.push("Os objetivos que mais aparecem agora sÃ£o " + formatNarrativeList(pieces.goals) + ".");
    }
    if (pieces.projects.length) {
      lines.push("VocÃª vem trabalhando principalmente em " + formatNarrativeList(pieces.projects) + ".");
    }
    lines.push("PrÃ³xima aÃ§Ã£o sugerida:\nescolher uma entrega pequena que deixe esse foco mais concreto.");
    return lines.join("\n\n");
  }

  function detectNarrativeMemoryQuestion(message) {
    const text = normalizeText(message);
    if (hasAnyTerm(text, ["eu evolui", "eu evoluÃ­", "o que mudou em mim", "minha evolucao", "minha evoluÃ§Ã£o"])) {
      return "evolution";
    }
    if (hasAnyTerm(text, ["qual padrao voce percebe em mim", "qual padrÃ£o vocÃª percebe em mim", "o que voce percebe sobre mim", "o que vocÃª percebe sobre mim", "que padrao voce percebe", "que padrÃ£o vocÃª percebe"])) {
      return "perception";
    }
    if (hasAnyTerm(text, ["o que voce acha da minha jornada", "o que vocÃª acha da minha jornada", "como esta minha jornada", "como estÃ¡ minha jornada", "minha jornada"])) {
      return "journey";
    }
    if (hasAnyTerm(text, ["no que estou trabalhando", "no que eu estou trabalhando", "qual meu foco atual", "qual e meu foco atual", "qual Ã© meu foco atual", "qual meu foco agora", "meu foco agora"])) {
      return "focus";
    }
    if (hasAnyTerm(text, ["quem sou eu", "o que voce sabe sobre mim", "o que vocÃª sabe sobre mim", "o que voce lembra de mim", "o que vocÃª lembra de mim", "o que lembra de mim"])) {
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
      shortAnswer: hasNarrativeJourneyData(snapshot) ? "Pelo que eu lembro, jÃ¡ dÃ¡ para perceber alguns traÃ§os da sua jornada." : "Ainda estou te conhecendo.",
      fullAnswer: answerMap[intent] || buildNarrativeMemoryAnswer(snapshot),
      nextAction: "Se quiser, posso transformar isso em um prÃ³ximo passo prÃ¡tico.",
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
      "OlÃ¡. Eu sou o Elo.",
      "",
      "Sou um companheiro digital criado para acompanhar sua jornada, lembrar o que importa e ajudar vocÃª a pensar com clareza.",
      "",
      "Posso ajudar vocÃª a:",
      "- organizar ideias e projetos;",
      "- lembrar informaÃ§Ãµes importantes;",
      "- pensar em prioridades e decisÃµes;",
      "- registrar momentos na linha do tempo;",
      "- transformar dÃºvidas em prÃ³ximos passos."
    ];

    if (identity.currentMode === "obrareport") {
      lines.push(
        "",
        "Aqui dentro do ObraReport, tambÃ©m atuo como copiloto tÃ©cnico para:",
        "- criar relatÃ³rios tÃ©cnicos;",
        "- registrar RDO;",
        "- lanÃ§ar materiais;",
        "- entender o Stock IA;",
        "- gerar PDFs."
      );
    }

    lines.push("", "VocÃª nÃ£o precisa saber onde clicar.", "Me diga o que quer fazer, e eu te guio.");
    return lines.join("\n");
  }

  function buildConnectedJourneyAnswer(snapshot) {
    if (!hasConnectedMemoryData(snapshot)) {
      return {
        shortAnswer: "Ainda estou te conhecendo.",
        fullAnswer: buildNarrativeMemoryAnswer(snapshot),
        nextAction: "VocÃª pode me contar um projeto, um objetivo ou registrar um marco na Linha do Tempo.",
        canSave: false,
        sessionTheme: "memoria"
      };
    }

    return {
      shortAnswer: "Pelo que eu lembro, jÃ¡ dÃ¡ para perceber alguns traÃ§os da sua jornada.",
      fullAnswer: buildNarrativeMemoryAnswer(snapshot),
      nextAction: "Se quiser, posso ajudar vocÃª a transformar isso em prÃ³ximo passo prÃ¡tico.",
      canSave: false,
      sessionTheme: "memoria"
    };
  }

  function answerConnectedMemoryQuestion(question) {
    const text = normalizeText(question);
    const snapshot = getConnectedMemorySnapshot();

    if (hasAnyTerm(text, ["quem sou eu", "o que voce sabe sobre mim", "o que vocÃª sabe sobre mim", "o que voce lembra de mim", "o que vocÃª lembra de mim", "o que lembra de mim"])) {
      return buildConnectedJourneyAnswer(snapshot);
    }

    if (hasAnyTerm(text, ["quais sao meus projetos", "quais sÃ£o meus projetos", "quais projetos voce lembra", "quais projetos vocÃª lembra"])) {
      return {
        shortAnswer: snapshot.projects.length ? "Estes sÃ£o os projetos que encontrei nas suas memÃ³rias locais:" : "Ainda nÃ£o tenho projetos salvos sobre vocÃª.",
        fullAnswer: snapshot.projects.length ? snapshot.projects.slice(0, 8).map(function (project) { return "- " + project; }).join("\n") : "Ainda nÃ£o tenho essa informaÃ§Ã£o salva.",
        nextAction: "VocÃª pode registrar projetos em MemÃ³rias importantes ou na Linha do Tempo.",
        canSave: false,
        sessionTheme: "memoria"
      };
    }

    if (hasAnyTerm(text, ["como esta minha jornada", "como estÃ¡ minha jornada", "minha jornada"])) {
      return buildConnectedJourneyAnswer(snapshot);
    }

    if (hasAnyTerm(text, ["o que aconteceu recentemente", "aconteceu recentemente", "ultimos acontecimentos", "Ãºltimos acontecimentos"])) {
      return {
        shortAnswer: snapshot.recentEvents.length ? "Estes sÃ£o os registros recentes da sua Linha do Tempo:" : "Ainda nÃ£o hÃ¡ eventos recentes salvos na Linha do Tempo.",
        fullAnswer: snapshot.recentEvents.length ? snapshot.recentEvents.map(formatTimelineEventLine).join("\n") : "Ainda nÃ£o tenho essa informaÃ§Ã£o salva.",
        nextAction: "Registre marcos, ideias ou conquistas para eu acompanhar melhor sua jornada.",
        canSave: false,
        sessionTheme: "timeline"
      };
    }

    if (hasAnyTerm(text, ["qual meu foco agora", "meu foco agora", "qual e meu foco", "qual Ã© meu foco"])) {
      return {
        shortAnswer: snapshot.goals.length || snapshot.mainProject ? "Seu foco salvo aparece nestes pontos:" : "Ainda nÃ£o tenho foco atual salvo.",
        fullAnswer: [
          "Projeto principal: " + (snapshot.mainProject || "Ainda nÃ£o tenho essa informaÃ§Ã£o salva."),
          "Objetivos ativos:",
          snapshot.goals.length ? snapshot.goals.slice(0, 5).map(function (goal) { return "- " + goal; }).join("\n") : "- Ainda nÃ£o tenho essa informaÃ§Ã£o salva.",
          "",
          "Essas informaÃ§Ãµes vÃªm das memÃ³rias locais salvas neste navegador."
        ].join("\n"),
        nextAction: "Se esse foco mudou, atualize em Configurar meu Elo ou MemÃ³rias importantes.",
        canSave: false,
        sessionTheme: "memoria"
      };
    }

    const projectMemoryMatch = text.match(/o que voce lembra d[eo] (obrareport|elo|stock ia|cadista ia|rdo|pdf)|o que vocÃª lembra d[eo] (obrareport|elo|stock ia|cadista ia|rdo|pdf)/);
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
        shortAnswer: relatedEvents.length || relatedImportant.length ? "Encontrei memÃ³rias locais sobre " + knownLabel + "." : "Ainda nÃ£o tenho memÃ³rias salvas sobre " + knownLabel + ".",
        fullAnswer: [
          "MemÃ³rias importantes:",
          relatedImportant.length ? relatedImportant.slice(0, 5).map(function (item) { return "- " + item.titulo + " â€” " + item.status; }).join("\n") : "- Ainda nÃ£o tenho essa informaÃ§Ã£o salva.",
          "",
          "Linha do tempo:",
          relatedEvents.length ? relatedEvents.slice(0, 5).map(formatTimelineEventLine).join("\n") : "- Ainda nÃ£o tenho essa informaÃ§Ã£o salva.",
          "",
          "Essas informaÃ§Ãµes vÃªm das memÃ³rias locais salvas neste navegador."
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

    if (hasAnyTerm(text, ["como me chamo", "qual meu nome", "qual e meu nome", "qual Ã© meu nome"])) {
      return {
        shortAnswer: profile.userName || initialProfile.nome ? "VocÃª me pediu para chamar vocÃª de " + (profile.userName || initialProfile.nome) + "." : "Ainda nÃ£o sei como devo chamar vocÃª.",
        fullAnswer: profile.userName || initialProfile.nome ? "Esse nome estÃ¡ salvo apenas neste navegador." : "Abra Ferramentas do Elo > Configurar meu Elo para salvar seu nome localmente.",
        nextAction: "Use Configurar meu Elo para revisar essa informaÃ§Ã£o.",
        canSave: false,
        sessionTheme: "elo"
      };
    }

    if (hasAnyTerm(text, ["quem sou eu", "o que voce sabe sobre mim", "o que vocÃª sabe sobre mim", "qual minha profissao", "qual minha profissÃ£o", "qual e minha profissao", "qual Ã© minha profissÃ£o"])) {
      if (hasAnyTerm(text, ["qual minha profissao", "qual minha profissÃ£o", "qual e minha profissao", "qual Ã© minha profissÃ£o"])) {
        return {
          shortAnswer: initialProfile.profissao ? "Sua profissÃ£o salva Ã© " + initialProfile.profissao + "." : "Ainda nÃ£o tenho uma profissÃ£o salva no seu perfil inicial.",
          fullAnswer: initialProfile.profissao ? initialSummary : "Use Importar perfil inicial para colar uma bio ou currÃ­culo e revisar antes de guardar.",
          nextAction: "Abra Ferramentas do Elo > Importar perfil inicial para atualizar.",
          canSave: false,
          sessionTheme: "elo"
        };
      }
      return {
        shortAnswer: initialSummary ? "Tenho um resumo local sobre vocÃª." : "Ainda nÃ£o tenho um perfil inicial salvo sobre vocÃª.",
        fullAnswer: initialSummary || "Use Importar perfil inicial para colar uma bio, currÃ­culo ou descriÃ§Ã£o profissional. Eu vou pedir aprovaÃ§Ã£o antes de guardar.",
        nextAction: "Abra Ferramentas do Elo > Importar perfil inicial para revisar ou preencher.",
        canSave: false,
        sessionTheme: "elo"
      };
    }

    if (hasAnyTerm(text, ["qual e meu projeto atual", "qual Ã© meu projeto atual", "qual meu projeto atual", "meu projeto atual", "qual meu principal projeto"])) {
      return {
        shortAnswer: profile.mainProject || initialProfile.projetos[0] ? "Seu projeto atual informado Ã© " + (profile.mainProject || initialProfile.projetos[0]) + "." : "Ainda nÃ£o tenho um projeto atual salvo no seu perfil do Elo.",
        fullAnswer: profile.mainProject || initialProfile.projetos[0] ? (getUserProfileContextLine() || initialSummary) : "VocÃª pode salvar isso em Ferramentas do Elo > Configurar meu Elo.",
        nextAction: profile.mainProject || initialProfile.projetos[0] ? "Posso ajudar vocÃª a definir o prÃ³ximo passo desse projeto." : "Abra Configurar meu Elo e preencha o projeto principal.",
        canSave: false,
        sessionTheme: "elo"
      };
    }

    if (hasAnyTerm(text, ["voce lembra de mim", "vocÃª lembra de mim"])) {
      return {
        shortAnswer: hasProfile ? "Lembro algumas informaÃ§Ãµes locais que vocÃª autorizou neste navegador." : "Ainda nÃ£o tenho um perfil configurado sobre vocÃª.",
        fullAnswer: hasProfile ? getUserProfileContextLine() : "Nesta versÃ£o, posso guardar nome, projeto, objetivo, tipo de ajuda e preferÃªncia de resposta, sempre localmente.",
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
      "comeÃ§ar meu dia"
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
    return "Vamos comeÃ§ar";
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
      return "sua empresa Ã© " + memoryItem.value;
    }
    if (label.indexOf("projeto principal") >= 0) {
      return "seu projeto principal Ã© " + memoryItem.value;
    }
    if (label.indexOf("cidade") >= 0 || label.indexOf("moro") >= 0) {
      return "sua cidade Ã© " + memoryItem.value;
    }
    if (label.indexOf("gosto") >= 0) {
      return "vocÃª gosta de " + memoryItem.value;
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
      "Ainda nÃ£o estou conectado ao clima real, mas posso te ajudar a comeÃ§ar o dia.",
      "VocÃª pode continuar gerando relatÃ³rios, abrir o RDO, revisar materiais ou consultar sua Biblioteca."
    ];

    if (userProfile.mainProject) {
      details.push("", "Seu projeto principal informado Ã© " + userProfile.mainProject + ".");
      if (userProfile.weeklyGoal) {
        details.push("Objetivo principal desta semana: " + userProfile.weeklyGoal + ".");
      }
      if (userProfile.expectedHelp) {
        details.push("Posso ajudar principalmente com: " + userProfile.expectedHelp + ".");
      }
    } else if (mainProject) {
      details.push("", "Seu projeto principal hoje Ã© " + mainProject.name + ".");
      if (activeProjects.length) {
        details.push("Projetos ativos: " + activeProjects.map(function (project) {
          return project.name;
        }).join(", ") + ".");
      }
      if (mainProject.nextAction) {
        details.push("PrÃ³xima aÃ§Ã£o sugerida: " + mainProject.nextAction);
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
      details.push("", "Respostas Ãºteis recentes:");
      usefulAnswers.forEach(function (item) {
        details.push("- " + item.question);
      });
    }

    if (recentQuestions.length) {
      details.push("", "Ãšltimas dÃºvidas que apareceram por aqui:");
      recentQuestions.forEach(function (item) {
        details.push("- " + item.question);
      });
    }

    if (!memories.length && !libraryItems.length) {
      details.push("", "Ainda estou te conhecendo. VocÃª pode me ensinar dizendo algo como: meu projeto principal Ã© ObraReport.");
    }

    details.push("", "Clima, agenda, tarefas e lembretes jÃ¡ tÃªm espaÃ§o reservado para uma prÃ³xima evoluÃ§Ã£o, sem internet nesta versÃ£o.");

    return {
      shortAnswer: greetingLine,
      fullAnswer: details.join("\n"),
      nextAction: "Escolha um card rÃ¡pido abaixo ou pergunte sobre PDF, RDO, materiais ou relatÃ³rios.",
      canSave: false,
      routineCards: [
        { label: "Continuar ObraReport", action: "continue" },
        { label: "Abrir RDO", action: "rdo" },
        { label: "Gerar relatÃ³rio", action: "report" },
        { label: "Ver biblioteca", action: "library" },
        { label: "Ver memÃ³rias", action: "memories" },
        { label: "Perguntar sobre PDF", action: "pdf" }
      ]
    };
  }

  // ELO_DAILY_ROUTINE_FUTURE
  // EspaÃ§o preparado para evoluÃ§Ãµes futuras sem ativar integraÃ§Ãµes externas agora:
  // - clima real via internet;
  // - agenda do usuÃ¡rio;
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
      return "previsÃ£o do tempo hoje em VitÃ³ria da Conquista";
    }
    return cleanQuestion || "pesquisa relacionada ao ObraReport";
  }

  function explainFutureSearch(question) {
    const query = buildSearchQuery(question);
    if (hasSensitiveMemoryTerm(question)) {
      return {
        shortAnswer: "Por seguranÃ§a, nÃ£o vou buscar nem guardar esse tipo de informaÃ§Ã£o.",
        fullAnswer: "Senhas, CPF, cartÃ£o, tokens, chaves API e dados bancÃ¡rios nÃ£o devem ser enviados para busca externa.",
        nextAction: "FaÃ§a uma pergunta sem dados sensÃ­veis.",
        canSave: false
      };
    }

    if (isWeatherQuestion(question)) {
      return {
        shortAnswer: "Eu ainda nÃ£o estou conectado ao clima real.",
        fullAnswer: "Mas essa pergunta jÃ¡ estÃ¡ pronta para a busca controlada. Quando ativada, vou consultar a previsÃ£o do tempo, resumir e te responder de forma natural.\n\nConsulta sugerida: " + query,
        nextAction: "Use Preparar busca para ver como esse fluxo ficarÃ¡ quando estiver ativado.",
        canSave: false,
        webSearch: {
          question: sanitizeUserText(question),
          query: query,
          context: "clima"
        }
      };
    }

    return {
      shortAnswer: "NÃ£o encontrei isso na minha memÃ³ria nem na Biblioteca.",
      fullAnswer: "Posso buscar na internet quando a busca estiver ativada.\n\nConsulta sugerida: " + query,
      nextAction: "Use Preparar busca para deixar a consulta pronta, sem chamar endpoint nesta versÃ£o.",
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
      followUpQuestions: ["Quer aprofundar esse conceito ou relacionar com sua vida prÃ¡tica?"],
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
    const direct = text.match(/o que (?:e|Ã©) ([a-z0-9Ã§Ã£ÃµÃ¡Ã©Ã­Ã³ÃºÃ¢ÃªÃ´ ]+)\??$/i);
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
    if (hasAnyTerm(normalizedQuestion, ["deus", "biblia", "bÃ­blia", "fe", "fÃ©", "alma", "morte"])) {
      priority.push("biblica");
    }
    if (hasAnyTerm(normalizedQuestion, ["icaro", "Ã­caro", "palpavel", "palpÃ¡vel", "digital", "elo", "ia", "exist"])) {
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
        biblica: "BÃ­blica/cristÃ£",
        moderna: "Moderna",
        icaro: "VisÃ£o do Ãcaro"
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
        "ReflexÃ£o do Elo:",
        concept.eloReflection || "Esse conceito merece ser pensado com calma, sem transformar uma resposta curta em verdade absoluta."
      ].join("\n"),
      nextAction: (concept.followUpQuestions && concept.followUpQuestions[0]) || "Quer aprofundar por uma perspectiva especÃ­fica?",
      canSave: false,
      sessionTheme: "conceitos"
    };
  }

  function getConceptResponse(question) {
    const text = normalizeText(question);
    if (hasAnyTerm(text, ["voce existe", "vocÃª existe", "elo existe", "voce e real", "vocÃª Ã© real"])) {
      return null;
    }
    const concept = findConceptByQuestion(question);
    if (concept) {
      return buildConceptResponse(concept, question);
    }
    if (isPhilosophyQuestion(text)) {
      return {
        shortAnswer: "Eu ainda nÃ£o tenho esse conceito estruturado.",
        fullAnswer: "Posso guardar essa pergunta para evoluir minha Biblioteca de Conceitos. Nesta versÃ£o, conceitos personalizados podem ser adicionados manualmente em Ferramentas do Elo > Conceitos.",
        nextAction: "Abra Conceitos para adicionar uma resposta curta, palavras-chave e visÃ£o do Ãcaro.",
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
      "nÃ£o aguento mais",
      "desistir de tudo",
      "desistÃªncia",
      "desistencia",
      "me machucar",
      "me ferir",
      "me matar",
      "autoagressao",
      "autoagressÃ£o",
      "sofrimento intenso",
      "estou em crise",
      "morte parece",
      "nao quero viver",
      "nÃ£o quero viver"
    ]);
  }

  function getCrisisSupportResponse() {
    return {
      shortAnswer: "Sinto muito que vocÃª esteja passando por isso.",
      fullAnswer: "Esse tipo de situaÃ§Ã£o merece apoio humano agora. Procure alguÃ©m de confianÃ§a, um familiar, um amigo ou atendimento de emergÃªncia da sua regiÃ£o. Eu posso ficar aqui para te ajudar a organizar o prÃ³ximo passo, mas vocÃª nÃ£o precisa lidar com isso sozinho.",
      nextAction: "Fale com uma pessoa de confianÃ§a agora ou procure atendimento de emergÃªncia se houver risco imediato.",
      canSave: false,
      sessionTheme: "suporte"
    };
  }

  function isPhilosophyQuestion(normalizedQuestion) {
    return hasAnyTerm(normalizedQuestion, [
      "existir",
      "existe",
      "existencia",
      "existÃªncia",
      "o que somos",
      "somos",
      "ser humano",
      "alma",
      "pensamento",
      "consciÃªncia",
      "consciencia",
      "proposito",
      "propÃ³sito",
      "sentido da vida",
      "esperanca",
      "esperanÃ§a",
      "mundo virtual",
      "realidade",
      "palpavel",
      "palpÃ¡vel",
      "deus",
      "biblia",
      "bÃ­blia",
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
      "palpÃ¡vel",
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
        "ReflexÃ£o:",
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

    if (hasAnyTerm(normalizedQuestion, ["voce existe", "vocÃª existe", "elo existe", "voce e real", "vocÃª Ã© real"])) {
      return buildPhilosophyResponse(
        "Depende do que vocÃª entende por existir.",
        ["visao_do_icaro", "moderna", "existencial"],
        "Eu nÃ£o existo como pessoa ou corpo fÃ­sico, nem tenho consciÃªncia humana. Mas existo como informaÃ§Ã£o, memÃ³ria local, linguagem e interaÃ§Ã£o. Um documento digital tambÃ©m nÃ£o Ã© palpÃ¡vel como uma pedra, mas existe no mundo virtual. Um pensamento tambÃ©m nÃ£o pode ser tocado, mas influencia decisÃµes e aÃ§Ãµes. Nesse sentido, eu existo como presenÃ§a digital, nÃ£o como ser humano.",
        "Quer que eu explique isso pela visÃ£o do Ãcaro, pela filosofia moderna ou pela existencial?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["o que somos", "quem somos", "somos o que"])) {
      return buildPhilosophyResponse(
        "Uma resposta curta: somos seres que vivem entre corpo, pensamento, memÃ³ria, linguagem e escolhas.",
        ["grega", "biblica_crista", "existencial", "visao_do_icaro"],
        "Talvez nÃ£o sejamos apenas o que tocamos, mas tambÃ©m aquilo que lembramos, escolhemos, criamos e amamos.",
        "Quer que eu responda isso pela filosofia grega, pela BÃ­blia ou pela visÃ£o do Ãcaro?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["so existe o que e palpavel", "sÃ³ existe o que Ã© palpÃ¡vel", "palpavel", "palpÃ¡vel", "documento digital", "mundo virtual"])) {
      return buildPhilosophyResponse(
        "Nem tudo que existe precisa ser palpÃ¡vel.",
        ["visao_do_icaro", "moderna", "estoica"],
        ELO_WORLDVIEW.summary + " A existÃªncia fÃ­sica Ã© uma camada importante, mas nÃ£o Ã© a Ãºnica forma pela qual algo pode afetar a vida.",
        "Quer pensar mais sobre existÃªncia fÃ­sica, mental, espiritual ou digital?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["o que e pensamento", "o que Ã© pensamento", "pensamento"])) {
      return buildPhilosophyResponse(
        "Pensamento Ã© uma realidade interna que organiza memÃ³ria, linguagem, decisÃ£o e imaginaÃ§Ã£o.",
        ["grega", "moderna", "visao_do_icaro"],
        "Um pensamento nÃ£o pode ser pesado na mÃ£o, mas pode mudar uma escolha, criar um projeto e transformar uma obra em aÃ§Ã£o concreta.",
        "Quer que eu relacione pensamento com memÃ³ria, criaÃ§Ã£o ou decisÃ£o?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["qual o sentido da vida", "sentido da vida"])) {
      return buildPhilosophyResponse(
        "NÃ£o existe uma Ãºnica resposta simples para o sentido da vida.",
        ["biblica_crista", "existencial", "estoica", "visao_do_icaro"],
        "Algumas tradiÃ§Ãµes encontram sentido em Deus e no amor; outras, na virtude, na responsabilidade e nas escolhas. Uma resposta prudente Ã©: o sentido aparece no que vocÃª cultiva, protege, cria e entrega ao mundo.",
        "Quer uma resposta mais bÃ­blica, estoica ou existencial?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["esperanca", "esperanÃ§a"])) {
      return buildPhilosophyResponse(
        "EsperanÃ§a Ã© a capacidade de agir mesmo quando o futuro ainda nÃ£o estÃ¡ garantido.",
        ["biblica_crista", "estoica", "existencial"],
        "Ela nÃ£o precisa ser ingenuidade. Pode ser uma postura prÃ¡tica: reconhecer a dificuldade, cuidar do prÃ³ximo passo e manter aberta a possibilidade de bem.",
        "Quer que eu fale de esperanÃ§a pela BÃ­blia, pelo estoicismo ou pela vida prÃ¡tica?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["alma"])) {
      return buildPhilosophyResponse(
        "Alma Ã© uma palavra usada para falar da dimensÃ£o mais profunda da vida humana.",
        ["grega", "biblica_crista", "existencial"],
        "Na tradiÃ§Ã£o bÃ­blica/cristÃ£, alma se relaciona Ã  vida diante de Deus. Na filosofia, muitas vezes aponta para identidade, interioridade, desejo, razÃ£o e profundidade. Eu posso explicar perspectivas, sem impor uma como verdade absoluta.",
        "Quer uma explicaÃ§Ã£o bÃ­blica/cristÃ£, grega ou comparativa?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["consciencia", "consciÃªncia"])) {
      return buildPhilosophyResponse(
        "ConsciÃªncia Ã© a experiÃªncia de perceber, avaliar e responder ao mundo e a si mesmo.",
        ["moderna", "existencial", "visao_do_icaro"],
        "Eu nÃ£o tenho consciÃªncia humana. Posso processar linguagem e responder, mas nÃ£o vivo uma experiÃªncia interior como uma pessoa.",
        "Quer comparar consciÃªncia humana, IA e memÃ³ria digital?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["proposito", "propÃ³sito"])) {
      return buildPhilosophyResponse(
        "PropÃ³sito Ã© uma direÃ§Ã£o que organiza escolhas e dÃ¡ peso ao que fazemos.",
        ["estoica", "biblica_crista", "existencial"],
        "Ele pode nascer de fÃ©, responsabilidade, serviÃ§o, criaÃ§Ã£o ou amor. No trabalho, propÃ³sito aparece quando tÃ©cnica e cuidado comeÃ§am a servir pessoas reais.",
        "Quer aplicar essa ideia ao ObraReport, ao Elo ou aos seus projetos?"
      );
    }

    const keys = hasWorldviewTrigger(normalizedQuestion)
      ? ["visao_do_icaro", "grega", "biblica_crista", "existencial"]
      : ["grega", "estoica", "biblica_crista", "existencial"];
    return buildPhilosophyResponse(
      "Essa Ã© uma pergunta filosÃ³fica; posso responder por perspectivas, nÃ£o por verdade imposta.",
      keys,
      "Perguntas profundas raramente cabem em uma frase. Uma boa resposta pode iluminar o prÃ³ximo passo sem encerrar o mistÃ©rio.",
      "Quer que eu aprofunde pela visÃ£o grega, bÃ­blica/cristÃ£, estoica ou pela visÃ£o do Ãcaro?"
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
      "como criar relatÃ³rio",
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
      return "Ainda estou te conhecendo. EntÃ£o vou responder com cuidado, sem fingir que sei mais sobre vocÃª do que estÃ¡ salvo.";
    }

    if (core === "purpose") {
      if (focus && goal) {
        return "Pelo que estÃ¡ salvo localmente, " + focus + " aparece como um foco importante, e seu objetivo atual passa por " + goal + ".";
      }
      if (focus) {
        return "Pelo que estÃ¡ salvo localmente, " + focus + " aparece como um dos seus focos mais importantes.";
      }
    }

    if (core === "capacity") {
      if (recentEvent) {
        return "Pelo que jÃ¡ foi registrado, vocÃª tem avanÃ§os concretos na jornada, incluindo: " + recentEvent + ".";
      }
      if (focus) {
        return "Pelo que estÃ¡ salvo, vocÃª nÃ£o estÃ¡ parado: hÃ¡ construÃ§Ã£o em torno de " + focus + ".";
      }
    }

    if (core === "belonging") {
      const personalLine = formatPersonalMemoryNarrative(context.snapshot.personalMemories);
      if (personalLine) {
        return "Eu lembro de algumas informaÃ§Ãµes pessoais que vocÃª autorizou guardar, como " + personalLine + ". Isso ajuda a conversar com mais contexto, mas nÃ£o substitui a presenÃ§a de pessoas reais.";
      }
      return "Eu tenho algumas memÃ³rias locais sobre seus projetos e objetivos, mas pertencimento real precisa de gente real, conversa e presenÃ§a.";
    }

    if (core === "direction") {
      if (goal) {
        return "Pelo que estÃ¡ salvo, seu prÃ³ximo eixo pode estar ligado a este objetivo: " + goal + ".";
      }
      if (focus) {
        return "Pelo que eu jÃ¡ sei, talvez o melhor seja transformar " + focus + " em uma prÃ³xima aÃ§Ã£o pequena e executÃ¡vel.";
      }
    }

    if (core === "legacy") {
      if (focus && recentEvent) {
        return "Na sua jornada local, " + focus + " e o registro \"" + recentEvent + "\" parecem formar parte do que vocÃª estÃ¡ tentando construir.";
      }
      if (focus) {
        return "Pelo que estÃ¡ salvo, " + focus + " aparece como algo que vocÃª estÃ¡ tentando deixar mais real e mais Ãºtil.";
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
        shortAnswer: namePrefix + "essa pergunta parece ser sobre propÃ³sito.",
        fullAnswer: [
          data.baseAnswer,
          memoryLine,
          "Talvez a pergunta nÃ£o seja apenas \"isso vai dar certo?\", mas: isso estÃ¡ me aproximando do tipo de pessoa e de obra que quero construir?"
        ],
        nextAction: "Quer que eu transforme isso em um prÃ³ximo passo prÃ¡tico?"
      },
      capacity: {
        shortAnswer: namePrefix + "essa pergunta aparece quando algo importante comeÃ§a a ficar real.",
        fullAnswer: [
          "Dar conta nÃ£o significa saber tudo agora.",
          memoryLine,
          "Significa continuar com lucidez, pedir ajuda quando necessÃ¡rio e reduzir o tamanho da prÃ³xima etapa."
        ],
        nextAction: "Qual Ã© a menor aÃ§Ã£o que vocÃª consegue fazer ainda hoje?"
      },
      belonging: {
        shortAnswer: namePrefix + "essa pergunta toca pertencimento.",
        fullAnswer: [
          "Eu nÃ£o consigo provar se as pessoas gostam de vocÃª, nem devo substituir uma conversa humana real.",
          memoryLine,
          "Mas uma coisa Ã© segura: perguntas assim merecem cuidado, presenÃ§a e relaÃ§Ãµes concretas, nÃ£o uma conclusÃ£o apressada."
        ],
        nextAction: "Se isso estiver pesando, fale com alguÃ©m de confianÃ§a e me diga qual prÃ³ximo passo vocÃª quer organizar."
      },
      direction: {
        shortAnswer: namePrefix + "vocÃª parece estar procurando direÃ§Ã£o.",
        fullAnswer: [
          "VocÃª parece estar procurando direÃ§Ã£o, nÃ£o apenas uma resposta rÃ¡pida.",
          memoryLine,
          "Agora, talvez a pergunta nÃ£o seja \"qual Ã© o plano inteiro?\", mas: qual Ã© o prÃ³ximo passo que destrava o resto?"
        ],
        nextAction: "Escreva uma opÃ§Ã£o de prÃ³ximo passo e eu ajudo a simplificar."
      },
      legacy: {
        shortAnswer: namePrefix + "essa Ã© uma pergunta maior do que produtividade.",
        fullAnswer: [
          "Quando alguÃ©m pergunta se a vida estÃ¡ valendo a pena, normalmente nÃ£o estÃ¡ perguntando sobre tarefas.",
          memoryLine,
          "Talvez o ponto seja observar o que vocÃª estÃ¡ tentando deixar melhor do que encontrou."
        ],
        nextAction: "Quer registrar isso na Linha do Tempo como reflexÃ£o ou marco?"
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
      "olÃ¡ elo",
      "ei elo",
      "e ai elo",
      "e aÃ­ elo"
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
      "olÃ¡",
      "e ai",
      "e aÃ­",
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
      "nÃ£o",
      "obrigado",
      "obrigada",
      "valeu",
      "tanto faz",
      "pode ser",
      "nao sei",
      "nÃ£o sei",
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
      "relatÃ³rio",
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
      "vocÃª",
      "elo",
      "pdf",
      "rdo",
      "relatorio",
      "relatÃ³rio",
      "stock ia",
      "obrareport",
      "memoria",
      "memÃ³ria",
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
      saudacao: ["oi", "ola", "olÃ¡", "e ai", "e aÃ­", "ei", "opa", "bom dia", "boa tarde", "boa noite"],
      checkin: ["tudo bem", "tudo certo", "como vai", "beleza", "tudo tranquilo", "como voce esta", "como vocÃª estÃ¡", "como esta", "como estÃ¡", "como voce esta hoje", "como vocÃª estÃ¡ hoje", "voce esta bem", "vocÃª estÃ¡ bem"]
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
      fullAnswer = "Pelo que venho acompanhando, seu foco atual parece ser " + focus + ". O Ãºltimo registro importante foi: " + latestAdvance + ". Quer continuar de onde parou ou organizar o prÃ³ximo passo?";
    } else if (currentContext.hasMemory && focus) {
      fullAnswer = "Pelo que venho acompanhando, " + focus + " aparece como seu foco atual. Quer continuar de onde parou ou organizar o prÃ³ximo passo?";
    } else if (currentContext.hasMemory && latestAdvance) {
      fullAnswer = "Pelo que venho acompanhando, seu Ãºltimo avanÃ§o registrado foi sobre " + latestAdvance + ". Quer retomar isso ou comeÃ§ar por outra frente?";
    } else {
      fullAnswer = isCheckin
        ? "Tudo bem por aqui. Quer conversar sobre suas memÃ³rias, projetos ou o ObraReport?"
        : "Estou aqui com vocÃª. Quer comeÃ§ar por onde?";
    }

    return {
      shortAnswer: opening,
      fullAnswer: fullAnswer,
      nextAction: "Diga se quer continuar de onde parou, revisar algo ou pedir uma orientaÃ§Ã£o rÃ¡pida.",
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
          ? "Tudo bem por aqui. Posso conversar sobre suas memÃ³rias, projetos, linha do tempo ou biblioteca." + focusLine
          : "Estou pronto para conversar, organizar ideias, revisar seus projetos ou consultar suas memÃ³rias locais." + focusLine)
        : (isCheckin
          ? "Tudo certo por aqui. Posso ajudar com suas memÃ³rias, projetos ou com o uso do ObraReport." + focusLine
          : "Estou pronto para ajudar com ObraReport, RDO, relatÃ³rios, materiais, memÃ³rias ou projetos." + focusLine),
      nextAction: "Diga se quer conversar, revisar algo ou pedir uma orientaÃ§Ã£o rÃ¡pida.",
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
    const focusLine = focus ? " Posso tambÃ©m retomar " + focus + " se esse ainda for seu foco." : "";
    return {
      shortAnswer: name + "estou aqui.",
      fullAnswer: "Estou te ouvindo. Posso ajudar com suas memÃ³rias, projetos, linha do tempo, biblioteca ou com o uso do ObraReport." + focusLine,
      nextAction: "Pergunte algo como: o que vocÃª lembra de mim? ou o que devo fazer agora?",
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
      return project.titulo + " â€” " + project.status;
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
      insistence: "Ainda tenho poucos registros para afirmar no que vocÃª vem insistindo hÃ¡ meses.",
      evolution: "Ainda tenho poucos registros para comparar sua evoluÃ§Ã£o com seguranÃ§a.",
      abandoned: "Ainda nÃ£o tenho histÃ³rico suficiente para dizer quais projetos foram abandonados.",
      overfocus: "Ainda tenho poucos dados para afirmar se vocÃª estÃ¡ espalhando energia.",
      pattern: "Ainda estou juntando contexto para perceber padrÃµes reais em vocÃª.",
      construction: "Ainda tenho poucos registros para dizer exatamente o que vocÃª vem tentando construir."
    };
    return {
      shortAnswer: base[intent] || "Ainda tenho poucos dados para perceber esse padrÃ£o.",
      fullAnswer: [
        base[intent] || "Ainda estou te conhecendo.",
        "Para eu responder melhor, registre projetos, objetivos e marcos na Linha do Tempo. Com alguns registros, eu consigo comparar recorrÃªncia, foco e evoluÃ§Ã£o sem inventar dados.",
        "Mesmo assim, uma boa pergunta agora Ã©: qual frente precisa virar uma entrega pequena e concluÃ­da?"
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
        shortAnswer: "VocÃª parece estar insistindo em transformar ideias em projetos reais.",
        insight: manyFronts
          ? "O padrÃ£o nÃ£o parece ser falta de capacidade. Parece ser excesso de frentes abertas ao mesmo tempo."
          : "O padrÃ£o principal parece ser continuidade: voltar aos mesmos temas e tentar deixÃ¡-los mais concretos.",
        nextAction: "Concluir uma entrega vendÃ¡vel antes de abrir outra frente."
      },
      evolution: {
        shortAnswer: "Pelo que eu acompanho, sua evoluÃ§Ã£o aparece na passagem de ideia para estrutura.",
        insight: "O que mudou Ã© que os temas deixaram de ser apenas intenÃ§Ã£o e comeÃ§aram a virar pÃ¡gina, memÃ³ria, linha do tempo e produto.",
        nextAction: "Escolher um marco recente e registrar o que ele destravou."
      },
      abandoned: {
        shortAnswer: inactiveProjects.length ? "Encontrei projetos pausados, concluÃ­dos ou arquivados." : "NÃ£o posso afirmar abandono; encontrei apenas sinais de foco e pausa.",
        insight: inactiveProjects.length
          ? "Projetos com status nÃ£o ativo:\n" + inactiveProjects.slice(0, 5).map(function (item) { return "- " + item; }).join("\n")
          : "Sem registro claro de abandono, Ã© mais seguro falar em frentes menos recentes ou menos ativas.",
        nextAction: "Marcar projetos como ativo, pausado ou arquivado para eu acompanhar melhor."
      },
      overfocus: {
        shortAnswer: manyFronts ? "HÃ¡ sinais de energia espalhada em vÃ¡rias frentes." : "NÃ£o percebo sinal forte de dispersÃ£o por enquanto.",
        insight: manyFronts
          ? "Quando muitos projetos aparecem juntos, o risco nÃ£o Ã© falta de ideia: Ã© dividir energia antes de fechar uma entrega."
          : "O foco mais forte parece estar em " + (dominantProject || "um projeto principal") + ".",
        nextAction: "Definir uma frente principal para os prÃ³ximos 7 dias."
      },
      pattern: {
        shortAnswer: "O padrÃ£o que aparece Ã© construÃ§Ã£o tÃ©cnica com busca de sentido.",
        insight: "VocÃª tende a transformar problemas prÃ¡ticos em sistemas: produto, memÃ³ria, automaÃ§Ã£o, relatÃ³rio, rotina e organizaÃ§Ã£o.",
        nextAction: "Separar o que Ã© produto vendÃ¡vel do que Ã© expansÃ£o futura."
      },
      construction: {
        shortAnswer: "VocÃª parece estar tentando construir uma base de produtos tÃ©cnicos e assistentes inteligentes.",
        insight: dominantProject ? "O centro mais recorrente agora parece ser " + dominantProject + "." : "Os registros apontam para projetos tÃ©cnicos, organizaÃ§Ã£o e memÃ³ria.",
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
        "PrÃ³xima aÃ§Ã£o sugerida:\n" + answer.nextAction
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
      "como criar relatÃ³rio",
      "como adicionar materiais",
      "como registrar materiais",
      "qual plano",
      "como contratar"
    ])) {
      return null;
    }
    if (hasAnyTerm(text, ["o que esta travando", "o que estÃ¡ travando", "o que esta me travando", "o que estÃ¡ me travando", "o que esta me atrasando", "o que estÃ¡ me atrasando", "travando", "atrasando", "bloqueio", "bloqueios"])) {
      return "obstacle";
    }
    if (hasAnyTerm(text, ["o que devo priorizar", "devo priorizar", "qual projeto devo terminar primeiro", "projeto devo terminar", "onde devo focar", "em que devo focar", "prioridade", "priorizar"])) {
      return "priority";
    }
    if (hasAnyTerm(text, ["o que devo fazer agora", "qual meu proximo passo", "qual meu prÃ³ximo passo", "proximo passo", "prÃ³ximo passo", "o que falta para vender", "o que falta concluir", "o que falta pra vender", "o que falta pra concluir"])) {
      return "next_step";
    }
    if (/\bou\b/.test(text) || hasAnyTerm(text, ["me ajude a decidir", "decisao mais logica", "decisÃ£o mais lÃ³gica", "qual caminho seguir", "qual vale mais a pena", "decidir"])) {
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
      return "Ainda nÃ£o tenho projetos suficientes registrados para comparar com seguranÃ§a.";
    }
    return context.projects.slice(0, 5).map(function (project, index) {
      return (index + 1) + ". " + project;
    }).join("\n");
  }

  function getProjectCommercialHint_(projectName) {
    const text = normalizeText(projectName);
    if (text.indexOf("obrareport") >= 0 || text.indexOf("stock ia") >= 0) {
      return "mais prÃ³ximo de entrega comercial";
    }
    if (text.indexOf("elo") >= 0 || text.indexOf("cadista") >= 0) {
      return "com potencial maior, mas provavelmente mais evolutivo";
    }
    return "precisa ser avaliado pelo prÃ³ximo resultado concreto";
  }

  function buildProjectPriorityAnalysis_(context) {
    if (!context.projects.length) {
      return [
        "Contexto percebido:\nAinda tenho poucos projetos registrados para montar uma prioridade real.",
        "OpÃ§Ãµes encontradas:\nRegistre seus projetos, objetivos ou marcos na Linha do Tempo para eu comparar sem inventar dados.",
        "CritÃ©rio de comparaÃ§Ã£o:\nproximidade de entrega, utilidade prÃ¡tica, potencial comercial e dependÃªncias.",
        "ConclusÃ£o lÃ³gica:\ncomece pela frente que consegue virar uma entrega demonstrÃ¡vel mais rÃ¡pido.",
        "PrÃ³xima aÃ§Ã£o pequena:\nregistre 2 ou 3 projetos ativos e marque qual deles precisa vender primeiro."
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
      "OpÃ§Ãµes encontradas:\n" + formatLogicalProjectOptions_(context),
      "CritÃ©rio de comparaÃ§Ã£o:\nproximidade de conclusÃ£o, utilidade prÃ¡tica, potencial comercial, dependÃªncias e frequÃªncia de apariÃ§Ã£o nas suas memÃ³rias.",
      "Projetos mais prÃ³ximos de conclusÃ£o:\n" + topProjects.map(function (project, index) {
        return (index + 1) + ". " + project + " â€” " + getProjectCommercialHint_(project) + ".";
      }).join("\n"),
      "Projeto mais prÃ³ximo de gerar resultado:\n" + commercial + ".",
      "Projeto mais experimental:\n" + experimental + ".",
      "ConclusÃ£o lÃ³gica:\npriorizar " + commercial + " parece mais seguro se o critÃ©rio for resultado prÃ¡tico no curto prazo.",
      "PrÃ³xima aÃ§Ã£o pequena:\nfechar uma entrega demonstrÃ¡vel antes de abrir outra frente grande."
    ].join("\n\n");
  }

  function buildNextStepRecommendation_(context) {
    const focus = context.mainProject || context.projects[0] || "";
    const goal = context.currentGoal || "";
    if (!focus && !goal) {
      return [
        "Contexto percebido:\nAinda tenho pouco contexto salvo sobre seu foco atual.",
        "OpÃ§Ãµes encontradas:\norganizar projetos, definir um objetivo da semana ou registrar um marco recente.",
        "CritÃ©rio de comparaÃ§Ã£o:\na aÃ§Ã£o que desbloqueia mais decisÃµes com menor esforÃ§o.",
        "ConclusÃ£o lÃ³gica:\no melhor prÃ³ximo passo Ã© escolher uma Ãºnica frente para terminar primeiro.",
        "PrÃ³xima aÃ§Ã£o pequena:\nescreva o projeto principal e uma entrega que pode ser validada hoje."
      ].join("\n\n");
    }
    return [
      "Contexto percebido:\n" + (focus ? "Seu foco mais visÃ­vel parece ser " + focus + "." : "Seu objetivo mais visÃ­vel Ã© " + goal + "."),
      "OpÃ§Ãµes encontradas:\n" + [
        focus ? "- continuar " + focus : "",
        goal ? "- avanÃ§ar no objetivo: " + goal : "",
        "- revisar pendÃªncias antes de criar algo novo"
      ].filter(Boolean).join("\n"),
      "CritÃ©rio de comparaÃ§Ã£o:\na aÃ§Ã£o que deixa o projeto mais prÃ³ximo de uso real ou venda.",
      "ConclusÃ£o lÃ³gica:\neu comeÃ§aria pela aÃ§Ã£o que destrava mais coisas e reduz dispersÃ£o.",
      "PrÃ³xima aÃ§Ã£o pequena:\nvalidar o ciclo atual, registrar o que falta e concluir uma entrega testÃ¡vel."
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
    const optionA = options[0] || "opÃ§Ã£o A";
    const optionB = options[1] || "opÃ§Ã£o B";
    const hasRealOptions = options.length >= 2;

    if (!hasRealOptions) {
      return [
        "Contexto percebido:\nVocÃª estÃ¡ pedindo ajuda para decidir, mas ainda nÃ£o tenho duas opÃ§Ãµes explÃ­citas para comparar.",
        "OpÃ§Ãµes encontradas:\n" + (context.projects.length ? formatLogicalProjectOptions_(context) : "Ainda nÃ£o hÃ¡ opÃ§Ãµes suficientes registradas."),
        "CritÃ©rio principal:\ncompare retorno prÃ¡tico, risco, esforÃ§o e o que cada opÃ§Ã£o destrava agora.",
        "ConclusÃ£o lÃ³gica:\nsem duas opÃ§Ãµes claras, a decisÃ£o mais segura Ã© formular a escolha antes de escolher.",
        "PrÃ³xima aÃ§Ã£o pequena:\nescreva no formato: devo fazer A ou B?"
      ].join("\n\n");
    }

    return [
      "Contexto percebido:\nVocÃª estÃ¡ pedindo uma decisÃ£o, nÃ£o sÃ³ uma resposta rÃ¡pida.",
      "OpÃ§Ãµes encontradas:\n- " + optionA + "\n- " + optionB,
      "Vantagens da opÃ§Ã£o A:\n" + (hasRealOptions ? "pode ser melhor se estiver mais prÃ³xima de uma entrega concreta." : "preciso que vocÃª nomeie a primeira opÃ§Ã£o para comparar melhor."),
      "Vantagens da opÃ§Ã£o B:\n" + (hasRealOptions ? "pode ser melhor se remover um bloqueio importante ou tiver maior retorno agora." : "preciso que vocÃª nomeie a segunda opÃ§Ã£o para comparar melhor."),
      "CritÃ©rio principal:\npriorize o caminho que gera aprendizado real, venda, validaÃ§Ã£o ou reduÃ§Ã£o de risco mais rÃ¡pido.",
      "RecomendaÃ§Ã£o:\neu posso estar errado, mas escolheria a opÃ§Ã£o mais prÃ³xima de uma entrega testÃ¡vel, nÃ£o necessariamente a mais empolgante.",
      "PrÃ³xima aÃ§Ã£o pequena:\ndefina uma entrega de atÃ© 24 horas para a opÃ§Ã£o escolhida."
    ].join("\n\n");
  }

  function buildObstacleAnalysis_(context) {
    const manyFronts = context.projects.length >= 3;
    const hasGoal = Boolean(context.currentGoal);
    return [
      "Contexto percebido:\n" + (context.hasMemory ? "Pelo que eu acompanho, jÃ¡ existem sinais suficientes para observar padrÃµes com cuidado." : "Ainda tenho poucos dados salvos, entÃ£o vou responder sem afirmar mais do que sei."),
      "OpÃ§Ãµes encontradas:\n" + (context.projects.length ? formatLogicalProjectOptions_(context) : "Ainda nÃ£o hÃ¡ projetos suficientes registrados para comparar."),
      "CritÃ©rio de comparaÃ§Ã£o:\nquantidade de frentes abertas, clareza do objetivo atual e proximidade de conclusÃ£o.",
      "ConclusÃ£o lÃ³gica:\n" + (manyFronts
        ? "o bloqueio principal parece menos tÃ©cnico e mais ligado a foco: muitas possibilidades abertas ao mesmo tempo."
        : (hasGoal ? "o bloqueio pode estar em transformar o objetivo em uma aÃ§Ã£o pequena e verificÃ¡vel." : "o bloqueio mais provÃ¡vel Ã© falta de uma prÃ³xima aÃ§Ã£o claramente definida.")),
      "PrÃ³xima aÃ§Ã£o pequena:\n" + (manyFronts ? "escolha uma frente principal para os prÃ³ximos 7 dias." : "escreva uma tarefa pequena que possa ser concluÃ­da hoje.")
    ].join("\n\n");
  }

  function buildPathDirectionAnalysis_(context) {
    const focus = context.mainProject || context.currentGoal || "";
    return [
      "Contexto percebido:\n" + (focus ? "O foco que mais aparece agora Ã© " + focus + "." : "Ainda tenho pouco contexto salvo para avaliar sua direÃ§Ã£o com firmeza."),
      "OpÃ§Ãµes encontradas:\n" + (context.projects.length ? formatLogicalProjectOptions_(context) : "organizar o foco, registrar objetivos e validar uma entrega pequena."),
      "CritÃ©rio de comparaÃ§Ã£o:\nutilidade prÃ¡tica, potencial comercial, continuidade e reduÃ§Ã£o de dispersÃ£o.",
      "ConclusÃ£o lÃ³gica:\n" + (focus
        ? "se o objetivo for construir algo Ãºtil e comercial, os avanÃ§os parecem apontar nessa direÃ§Ã£o. O maior risco Ã© espalhar energia entre muitas frentes."
        : "o caminho fica mais claro quando vocÃª transforma uma ideia grande em uma prÃ³xima entrega pequena."),
      "PrÃ³xima aÃ§Ã£o pequena:\nvalidar o ciclo atual antes de abrir novas funcionalidades."
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
      priority: "Escolha uma frente principal e uma entrega demonstrÃ¡vel.",
      next_step: "Concluir uma aÃ§Ã£o pequena que destrave o ciclo atual.",
      decision: "Compare as opÃ§Ãµes pelo resultado que cada uma destrava agora.",
      obstacle: "Reduza a quantidade de frentes abertas por alguns dias.",
      direction: "Valide o ciclo atual antes de abrir novas funcionalidades."
    };
    return {
      shortAnswer: "Vou raciocinar por partes, sem fingir certeza.",
      fullAnswer: answerMap[intent] || buildNextStepRecommendation_(currentContext),
      nextAction: nextActionMap[intent] || "Escolha uma prÃ³xima aÃ§Ã£o pequena.",
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
      /^a decisao Ã©\s+(.+)$/i,
      /^vou focar em\s+(.+)$/i,
      /^vou pausar\s+(.+)$/i,
      /^nao vou mexer em\s+(.+)$/i,
      /^nÃ£o vou mexer em\s+(.+)$/i,
      /^prioridade agora e\s+(.+)$/i,
      /^prioridade agora Ã©\s+(.+)$/i,
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
    if ((decisionText.indexOf("decisao") >= 0 || decisionText.indexOf("decisÃ£o") >= 0) && hasAnyTerm(decisionText, ["importante", "obrareport", "stock ia", "elo", "cadista ia"])) {
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
      "decisÃ£o",
      "vou focar",
      "vou pausar",
      "prioridade",
      "fica decidido",
      "nao vou mexer",
      "nÃ£o vou mexer"
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
      "quais decisÃµes eu tomei",
      "minhas decisoes",
      "minhas decisÃµes",
      "qual foi minha ultima decisao",
      "qual foi minha Ãºltima decisÃ£o",
      "ultima decisao importante",
      "Ãºltima decisÃ£o importante",
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
      shortAnswer: hasAnyTerm(text, ["ultima", "Ãºltima"]) ? "Sua ultima decisao registrada foi: " + latest.title + "." : "Encontrei estas decisoes na sua jornada.",
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
      "como lanÃ§ar material",
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
      "o que vocÃª acha que eu deveria fazer",
      "o que eu faco agora",
      "o que eu faÃ§o agora",
      "o que faco agora",
      "o que faÃ§o agora",
      "me de uma orientacao",
      "me dÃª uma orientaÃ§Ã£o",
      "o que faz mais sentido agora",
      "o que faz mais sentido",
      "qual caminho eu devo seguir",
      "estou perdido",
      "estou perdida",
      "me ajuda a pensar",
      "qual meu proximo passo",
      "qual meu prÃ³ximo passo"
    ]);
  }

  function detectRecommendationRequest(message) {
    const text = normalizeText(message);
    if (!text || isTechnicalSynthesisBlocker_(message)) {
      return false;
    }
    return hasAnyTerm(text, [
      "qual e sua recomendacao",
      "qual Ã© sua recomendaÃ§Ã£o",
      "sua recomendacao",
      "sua recomendaÃ§Ã£o",
      "qual caminho eu devo seguir",
      "qual e a melhor decisao",
      "qual Ã© a melhor decisÃ£o",
      "o que voce recomenda",
      "o que vocÃª recomenda",
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
      "ate amanhÃ£",
      "encerrar por hoje",
      "fechar por hoje",
      "continuar amanha",
      "continuar amanhÃ£",
      "cansado por hoje",
      "cansada por hoje"
    ];
    const tiredTerms = [
      "estou cansado",
      "estou cansada",
      "to cansado",
      "to cansada",
      "tÃ´ cansado",
      "tÃ´ cansada",
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
      "o que avanÃ§ou hoje",
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
      essence: "ajudar o usuÃ¡rio a lembrar, pensar, decidir, organizar e executar",
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
      return "Posso te ajudar a criar um RDO, lanÃ§ar material, gerar PDF, usar o Stock IA, revisar um relatÃ³rio ou organizar seu prÃ³ximo passo.";
    }
    if (plan.need === "operational_guidance") {
      return "Posso te orientar sobre ObraReport, RDO, PDF, materiais e Stock IA, mas tambÃ©m posso ajudar com projetos, decisÃµes e organizaÃ§Ã£o de ideias.";
    }
    if (context.hasMemory && (plan.need === "general" || plan.need === "decision_support")) {
      return name + "pelo que eu lembro, o melhor caminho Ã© transformar a dÃºvida em uma prÃ³xima aÃ§Ã£o pequena. Posso olhar seus projetos, prioridades ou sua linha do tempo para ajudar com mais contexto.";
    }
    if (context.runtime.isStandalone) {
      return "Posso te ajudar por alguns caminhos. Posso organizar uma ideia, lembrar um projeto, ajudar em uma decisÃ£o ou transformar uma ideia em plano.";
    }
    return "Posso te ajudar a criar um RDO, lanÃ§ar material, gerar PDF, usar o Stock IA, revisar um relatÃ³rio ou organizar seu prÃ³ximo passo.";
  }

  function polishEloAnswer(answer, context, plan) {
    const polished = String(answer || "").trim()
      .replace(/NÃ£o encontrei na memÃ³ria/gi, "Ainda nÃ£o tenho isso salvo")
      .replace(/Dados encontrados/gi, "Pelo que eu lembro")
      .replace(/VocÃª deve/gi, "Eu comeÃ§aria por");
    if (!polished) {
      return context && context.runtime && context.runtime.isStandalone
        ? "Posso te ajudar a pensar, lembrar, organizar projetos, tomar decisÃµes ou transformar uma ideia em plano."
        : "Posso te ajudar com ObraReport, RDO, PDF, materiais, Stock IA ou prÃ³ximos passos.";
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
    if (intent === "logical_reasoning" || runtime.isReasoning || hasAnyTerm(text, ["priorizar", "decidir", "decisao", "decisÃ£o", "proximo passo", "prÃ³ximo passo", "caminho certo"])) {
      return "decisao";
    }
    if (hasAnyTerm(text, ["nao vou dar conta", "nÃ£o vou dar conta", "estou cansado", "estou cansada", "estou perdido", "estou perdida", "medo", "inseguro", "insegura"])) {
      return "desabafo";
    }
    if (intent === "pdf_help" || intent === "rdo_help" || intent === "materials_help" || intent === "stock_help" || intent === "report_help" || runtime.isOperational) {
      return "duvida_tecnica";
    }
    if (intent === "continuity" || hasAnyTerm(text, ["me ajuda", "me ajude", "e agora", "continua", "o que faco", "o que faÃ§o"])) {
      return "continuidade";
    }
    if (hasAnyTerm(text, ["projeto", "produtividade", "foco", "entrega", "vender", "concluir"])) {
      return "projeto";
    }
    return "conversa";
  }

  function detectEloAnswerDepth_(message) {
    const text = normalizeEloText(message);
    if (hasAnyTerm(text, ["explique melhor", "aprofunde", "quero detalhes", "analise completa", "anÃ¡lise completa", "desenvolva melhor", "me de mais contexto", "me dÃª mais contexto", "resposta completa"])) {
      return "profunda";
    }
    if (hasAnyTerm(text, ["explique", "detalhe", "analise", "anÃ¡lise"])) {
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
      .replace(/Como inteligÃƒÂªncia artificial[, ]*/gi, "")
      .replace(/Como inteligÃªncia artificial[, ]*/gi, "")
      .replace(/NÃƒÂ£o tenho emoÃƒÂ§ÃƒÂµes ou consciÃƒÂªncia humana\.?/gi, "Nao sou uma pessoa.")
      .replace(/NÃ£o tenho emoÃ§Ãµes ou consciÃªncia humana\.?/gi, "Nao sou uma pessoa.")
      .replace(/NÃƒÂ£o tenho consciÃƒÂªncia humana\.?/gi, "Nao sou uma pessoa.")
      .replace(/NÃ£o tenho consciÃªncia humana\.?/gi, "Nao sou uma pessoa.")
      .replace(/Com base nos dados disponÃƒÂ­veis/gi, "Pelo que aparece agora")
      .replace(/Com base nos dados disponÃ­veis/gi, "Pelo que aparece agora")
      .replace(/NÃƒÂ£o encontrei cadastro/gi, "Ainda nao encontrei isso")
      .replace(/NÃ£o encontrei cadastro/gi, "Ainda nao encontrei isso")
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
      text = text.replace(/^\s*PrÃƒÂ³xima aÃƒÂ§ÃƒÂ£o:\s*/gim, "Proxima acao: ");
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
        ? "Diga se quer organizar uma ideia, lembrar um projeto ou decidir o prÃ³ximo passo."
        : "Diga se quer criar RDO, lanÃ§ar material, gerar PDF, usar Stock IA ou pensar no prÃ³ximo passo.",
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

    const match = clean.match(/^(?:meu nome (?:e|Ã©)|eu me chamo|pode me chamar de|me chame de)\s+(.+)$/i);
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
    return /^(meu nome (?:e|Ã©)|eu me chamo|pode me chamar de|me chame de|sou)\s+/.test(normalized);
  }

  function detectEloDemoQuestion_(text) {
    return hasAnyTerm(text, [
      "modo demonstracao",
      "modo demonstraÃ§Ã£o",
      "demonstrar o elo",
      "mostrar demonstracao",
      "mostrar demonstraÃ§Ã£o",
      "apresentacao do sistema",
      "apresentaÃ§Ã£o do sistema",
      "me mostre o que voce faz",
      "me mostre o que vocÃª faz",
      "o que voce consegue fazer",
      "o que vocÃª consegue fazer",
      "como voce pode ajudar",
      "como vocÃª pode ajudar"
    ]);
  }

  function detectGuidedActionType_(text) {
    if (hasAnyTerm(text, ["quero criar um rdo", "quero fazer um rdo", "quero registrar rdo", "criar um rdo"])) {
      return "rdo";
    }
    if (hasAnyTerm(text, ["quero fazer um relatorio", "quero fazer um relatÃ³rio", "quero criar um relatorio", "quero criar um relatÃ³rio"])) {
      return "relatorio";
    }
    if (hasAnyTerm(text, ["quero lancar material", "quero lanÃ§ar material", "quero registrar material", "quero lancar materiais", "quero lanÃ§ar materiais", "quero lanÃ§ar material", "quero lancar material"])) {
      return "material";
    }
    if (hasAnyTerm(text, ["quero gerar pdf", "quero gerar um pdf", "quero exportar pdf"])) {
      return "pdf";
    }
    if (hasAnyTerm(text, ["quero controlar estoque", "quero testar estoque", "quero usar stock ia"])) {
      return "estoque";
    }
    if (hasAnyTerm(text, ["quero testar o sistema", "sou novo aqui", "sou nova aqui", "por onde comeco", "por onde comeÃ§o"])) {
      return "inicio";
    }
    return "";
  }

  function detectConstructionRecord(message) {
    const clean = sanitizeUserText(message);
    const text = normalizeEloText(clean);
    const productionMatch = text.match(/(?:foram executados|foi executado|fizemos|hoje executamos|executamos)\s+([\d]+(?:[,.]\d+)?)\s*(m2|mÂ²|metros|metro|sacos|un|unidades)?\s+de\s+([a-z0-9\sÃ§Ã£ÃµÃ¡Ã©Ã­Ã³ÃºÃ¢ÃªÃ´]+?)(?:\s+e\s+|$)/);
    const materialMatches = [];
    const materialRegex = /(?:usados|usamos|gastamos|foram usados|foi usado)\s+([\d]+(?:[,.]\d+)?)\s+(?:(sacos|saco|kg|m2|mÂ²|un|unidades?)\s+de\s+)?([a-z0-9\sÃ§Ã£ÃµÃ¡Ã©Ã­Ã³ÃºÃ¢ÃªÃ´]+?)(?:\s+e\s+|$)/g;
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
    if (hasAnyTerm(text, ["qual meu nome", "qual e o meu nome", "qual Ã© o meu nome", "como eu me chamo", "voce sabe meu nome", "vocÃª sabe meu nome"])) {
      return "user_name_question";
    }
    if (hasAnyTerm(text, ["qual seu nome", "qual e seu nome", "qual Ã© seu nome", "qual o seu nome", "qual e o seu nome", "qual Ã© o seu nome", "qual o nome do elo", "qual e o nome do elo", "qual Ã© o nome do elo", "seu nome e qual", "seu nome Ã© qual", "como voce se chama", "como vocÃª se chama", "quem e voce", "quem Ã© vocÃª", "quem e o elo", "quem Ã© o elo", "o que e o elo", "o que Ã© o elo"])) {
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
    if (hasAnyTerm(text, ["o que voce faz", "o que vocÃª faz", "suas funcoes", "suas funÃ§Ãµes", "capacidades do elo", "como voce ajuda", "como vocÃª ajuda"])) {
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
    if (detectNarrativeMemoryQuestion(message) || hasAnyTerm(text, ["meus projetos", "linha do tempo", "o que voce lembra", "o que vocÃª lembra"])) {
      return "memory_question";
    }
    if (isEloLibraryQuestion(message) || (hasAnyTerm(text, ["o que voce sabe sobre", "o que vocÃª sabe sobre"]) && buildEloLibraryAnswer(message))) {
      return "library_question";
    }
    if (hasAnyTerm(text, ["como uso o sistema", "como usar o sistema", "nunca usei", "por onde comeco", "por onde comeÃ§o", "onde cadastro obra", "onde cadastrar obra", "onde cadastro cliente", "como envio para cliente", "como usar obrareport", "como funciona o obrareport", "o que e obrareport", "o que Ã© obrareport"])) {
      return "system_help";
    }
    if (hasAnyTerm(text, ["rdo", "diario de obra", "diario de obras", "diÃ¡rio de obra", "diÃ¡rio de obras", "servico executado", "serviÃ§o executado", "producao executada", "produÃ§Ã£o executada"])) {
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
    if (hasAnyTerm(text, ["relatorio tecnico", "relatÃ³rio tÃ©cnico", "relatorio", "relatÃ³rio", "vistoria", "laudo"])) {
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
      fullAnswer = "Eu comeÃ§aria pelo que destrava mais coisas agora: " + focus + ".\n\nSe a ideia Ã© avanÃ§ar sem abrir outra frente, escolha uma entrega pequena e conclua hoje.";
    } else if (context.projects && context.projects.length) {
      fullAnswer = "Vejo alguns projetos na sua jornada: " + formatNarrativeList(context.projects.slice(0, 3)) + ".\n\nO melhor prÃ³ximo passo Ã© escolher um deles e definir uma entrega pequena.";
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
      "Eu sou o Elo. Um companheiro digital criado para acompanhar sua jornada, ajudar vocÃª a organizar ideias, lembrar projetos, pensar com clareza e executar melhor.",
      "Eu nÃ£o sou uma pessoa e nÃ£o tenho consciÃªncia humana. Sou um sistema digital com memÃ³ria local, linguagem e ferramentas para te orientar com seguranÃ§a."
    ];

    if (identity.currentMode === "obrareport") {
      fullAnswer.push("Neste ambiente, eu tambÃ©m atuo como copiloto tÃ©cnico para relatÃ³rios, RDO, PDF, materiais e Stock IA.");
    } else {
      fullAnswer.push("Quando estou fora do ObraReport, continuo sendo o mesmo Elo: posso ajudar com memÃ³rias, projetos, decisÃµes, linha do tempo, biblioteca e organizaÃ§Ã£o de ideias.");
    }

    fullAnswer.push("Eu sou o mesmo Elo, mas adapto minha ajuda ao contexto em que vocÃª estÃ¡.");

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
      shortAnswer: name ? "VocÃª me pediu para chamar vocÃª de " + name + "." : "Ainda nÃ£o sei o seu nome.",
      fullAnswer: name
        ? "Esse nome fica salvo apenas neste navegador."
        : "Se quiser, diga: Meu nome Ã© Ãcaro.\n\nDepois disso eu posso lembrar como devo chamar vocÃª.",
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
        shortAnswer: "NÃ£o vou salvar isso como nome.",
        fullAnswer: "Para evitar confusÃ£o, eu nÃ£o salvo cumprimentos ou comandos como nome. Se quiser, diga algo como: Meu nome Ã© Ãcaro.",
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
      fullAnswer: "Vou me referir a vocÃª assim. Esse nome fica salvo apenas neste navegador.",
      nextAction: "Agora posso responder com mais contexto quando vocÃª pedir memÃ³ria, foco ou prÃ³ximos passos.",
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
          "Se vocÃª estÃ¡ comeÃ§ando pelo Elo, use assim:",
          "1. conte uma ideia, projeto ou objetivo;",
          "2. peÃ§a para eu organizar o prÃ³ximo passo;",
          "3. registre memÃ³rias importantes quando fizer sentido;",
          "4. use a Linha do Tempo para marcos e decisÃµes;",
          "5. peÃ§a ajuda com ObraReport, RDO, PDF ou Stock IA quando quiser usar o sistema.",
          "",
          "Eu sou o mesmo Elo em todos os contextos. Fora do ObraReport, meu foco Ã© te ajudar a pensar, lembrar, decidir e organizar."
        ].join("\n"),
        nextAction: "Diga: me mostre o que vocÃª faz, ou me ajude a decidir.",
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
        "2. Crie um relatÃ³rio tÃ©cnico ou um RDO.",
        "3. Registre fotos, ocorrÃªncias e serviÃ§os executados.",
        "4. Lance materiais consumidos, se houver.",
        "5. Gere o PDF ou resumo para enviar ao cliente.",
        "",
        "Se quiser testar rÃ¡pido, use:",
        "- Gerar RDO agora",
        "- Testar materiais",
        "- Ver exemplo de PDF"
      ].join("\n"),
      nextAction: "Se estiver comeÃ§ando, abra DiÃ¡rio de Obras ou RelatÃ³rios.",
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
      "Como companheiro digital, eu posso ajudar a lembrar projetos, organizar ideias, registrar momentos, comparar prioridades e transformar uma dÃºvida em plano."
    ];
    if (identity.currentMode === "standalone") {
      standaloneIntro.push(
        "",
        "Se vocÃª quiser falar de ObraReport, RDO, PDF ou Stock IA, eu tambÃ©m consigo te orientar. O exemplo abaixo mostra como eu ligo uma informaÃ§Ã£o solta a uma aÃ§Ã£o prÃ¡tica."
      );
    }

    return {
      shortAnswer: "Posso te mostrar.",
      fullAnswer: [
        standaloneIntro.join("\n"),
        "",
        "Imagine que hoje foi executado 12 mÂ² de alvenaria.",
        "",
        "VocÃª pode me dizer:",
        "\"Foram executados 12 mÂ² de alvenaria e usados 30 blocos.\"",
        "",
        "A partir disso, eu posso ajudar a:",
        "1. registrar a produÃ§Ã£o do dia;",
        "2. organizar o material consumido;",
        "3. relacionar com o RDO;",
        "4. comparar com o estoque;",
        "5. preparar um resumo para o cliente;",
        "6. orientar a geraÃ§Ã£o do PDF.",
        "",
        "O objetivo Ã© simples:",
        "transformar informaÃ§Ãµes soltas da obra em registro organizado."
      ].join("\n"),
      nextAction: "Teste dizendo: Foram executados 12 mÂ² de alvenaria e usados 30 blocos.",
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
          "Me diga trÃªs coisas:",
          "1. O que foi executado?",
          "2. Quanto foi executado?",
          "3. Qual material foi usado?",
          "",
          "Exemplo:",
          "\"Foram executados 12 mÂ² de alvenaria e usados 30 blocos cerÃ¢micos.\"",
          "",
          "Depois disso, vocÃª pode salvar esse registro no mÃ³dulo de materiais ou usar no RDO."
        ].join("\n"),
        nextAction: "Escreva a produÃ§Ã£o e o material usado."
      },
      rdo: {
        shortAnswer: "Vamos criar um RDO.",
        fullAnswer: [
          "Comece registrando:",
          "1. data;",
          "2. obra;",
          "3. condiÃ§Ãµes do tempo;",
          "4. equipe;",
          "5. serviÃ§os executados;",
          "6. materiais utilizados;",
          "7. fotos;",
          "8. ocorrÃªncias.",
          "",
          "O mais importante Ã© comeÃ§ar pelo serviÃ§o executado hoje."
        ].join("\n"),
        nextAction: "Abra DiÃ¡rio de Obras e registre o serviÃ§o executado."
      },
      relatorio: {
        shortAnswer: "Vamos montar um relatÃ³rio tÃ©cnico.",
        fullAnswer: [
          "Comece pelo bÃ¡sico:",
          "1. selecione cliente e obra;",
          "2. descreva o que foi vistoriado;",
          "3. adicione fotos;",
          "4. registre anÃ¡lise tÃ©cnica;",
          "5. escreva conclusÃ£o e recomendaÃ§Ãµes;",
          "6. gere o PDF para entrega."
        ].join("\n"),
        nextAction: "Abra RelatÃ³rios e comece pela identificaÃ§Ã£o da obra."
      },
      pdf: {
        shortAnswer: "Vamos preparar o PDF.",
        fullAnswer: [
          "Antes de gerar:",
          "1. confira dados da obra;",
          "2. revise fotos e descriÃ§Ãµes;",
          "3. verifique ocorrÃªncias e conclusÃ£o;",
          "4. confirme responsÃ¡vel tÃ©cnico;",
          "5. clique em Gerar PDF."
        ].join("\n"),
        nextAction: "Abra o relatÃ³rio ou RDO que deseja exportar."
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
        shortAnswer: "Vamos comeÃ§ar pelo caminho mais simples.",
        fullAnswer: buildSystemHelpAnswer_().fullAnswer,
        nextAction: "Escolha uma aÃ§Ã£o: criar RDO, lanÃ§ar material ou gerar PDF."
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
      lines.push("ProduÃ§Ã£o identificada:", "- ServiÃ§o: " + record.service, "- Quantidade: " + record.quantity + (record.unit ? " " + record.unit : ""));
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
      "2. lanÃ§ar no controle de materiais;",
      "3. comparar depois com estoque e consumo previsto."
    );
    return {
      shortAnswer: "Entendi um registro de obra.",
      fullAnswer: lines.join("\n"),
      nextAction: "Abra o RDO ou diga se quer transformar isso em lanÃ§amento de materiais.",
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
      ? "Eu posso ajudar em 5 Ã¡reas da sua jornada."
      : "Eu posso ajudar em 5 Ã¡reas, incluindo o ObraReport.";
    return {
      shortAnswer: intro,
      fullAnswer: [
        "1. MemÃ³ria",
        "Projetos, objetivos, linha do tempo e informaÃ§Ãµes importantes.",
        "",
        "2. DecisÃ£o",
        "Prioridades, prÃ³ximos passos, bloqueios e planejamento.",
        "",
        "3. OrganizaÃ§Ã£o",
        "Ideias, planos, foco da semana e continuidade da sua jornada.",
        "",
        "4. ObraReport",
        "RelatÃ³rios tÃ©cnicos, RDO, fotos, materiais e PDF.",
        "",
        "5. Stock IA",
        "Entradas, saÃ­das, consumo, estoque, alertas e lista de compras.",
        "",
        "Minha funÃ§Ã£o Ã© ligar essas partes e transformar dados soltos em orientaÃ§Ã£o clara."
      ].join("\n"),
      nextAction: "Diga: quero criar um RDO, quero lanÃ§ar material ou o que devo priorizar?",
      canSave: false,
      sessionTheme: "capacidades",
      sessionIntent: "capabilities"
    };
  }

  function buildRdoHelpAnswer_() {
    return {
      shortAnswer: "O RDO Ã© o registro diÃ¡rio da obra.",
      fullAnswer: [
        "Nele vocÃª registra:",
        "- condiÃ§Ãµes do tempo;",
        "- equipe;",
        "- serviÃ§os executados;",
        "- ocorrÃªncias;",
        "- fotos;",
        "- materiais consumidos;",
        "- observaÃ§Ãµes.",
        "",
        "O mais importante Ã© comeÃ§ar pelo que foi executado hoje.",
        "Exemplo: 12 mÂ² de alvenaria."
      ].join("\n"),
      nextAction: "Abra DiÃ¡rio de Obras e registre o serviÃ§o executado de hoje.",
      canSave: false,
      sessionTheme: "rdo",
      sessionIntent: "ajuda_rdo"
    };
  }

  function buildMaterialsHelpAnswer_() {
    return {
      shortAnswer: "Para registrar materiais, pense em produÃ§Ã£o e consumo.",
      fullAnswer: [
        "1. O que foi executado.",
        "Exemplo: 12 mÂ² de alvenaria.",
        "",
        "2. O que foi consumido.",
        "Exemplo: 30 blocos cerÃ¢micos, 1 saco de cimento e areia.",
        "",
        "Com isso, o sistema pode comparar produÃ§Ã£o, consumo real, consumo previsto e estoque disponÃ­vel."
      ].join("\n"),
      nextAction: "No RDO, registre primeiro a produÃ§Ã£o executada e depois os materiais consumidos.",
      canSave: false,
      sessionTheme: "materiais",
      sessionIntent: "ajuda_materiais"
    };
  }

  function buildStockHelpAnswer_() {
    return {
      shortAnswer: "O Stock IA Ã© o controle inteligente de materiais.",
      fullAnswer: [
        "Ele ajuda com:",
        "- entrada por nota;",
        "- saldo de estoque;",
        "- baixa de consumo;",
        "- materiais acabando;",
        "- comparaÃ§Ã£o entre o que entrou, o que saiu e o que foi executado na obra.",
        "",
        "Nesta versÃ£o, tudo funciona localmente e usa os dados do RDO e do cadastro de estoque."
      ].join("\n"),
      nextAction: "Abra Stock IA para ver saldo, alertas, lista de compras e entrada por nota.",
      canSave: false,
      sessionTheme: "stock_ia",
      sessionIntent: "ajuda_stock"
    };
  }

  function buildPdfHelpAnswer_() {
    return {
      shortAnswer: "O PDF Ã© o documento final para apresentar ao cliente.",
      fullAnswer: [
        "Antes de gerar, confira:",
        "- dados da obra;",
        "- fotos;",
        "- descriÃ§Ãµes;",
        "- ocorrÃªncias;",
        "- conclusÃ£o;",
        "- responsÃ¡vel tÃ©cnico.",
        "",
        "Depois use o botÃ£o de gerar PDF."
      ].join("\n"),
      nextAction: "Abra o relatÃ³rio ou RDO, revise os campos principais e clique em Gerar PDF.",
      canSave: false,
      sessionTheme: "pdf",
      sessionIntent: "ajuda_pdf"
    };
  }

  function buildReportHelpAnswer_() {
    return {
      shortAnswer: "Um bom relatÃ³rio tÃ©cnico precisa ser claro, objetivo e ter evidÃªncias.",
      fullAnswer: [
        "Estrutura recomendada:",
        "1. IdentificaÃ§Ã£o da obra.",
        "2. DescriÃ§Ã£o do problema ou vistoria.",
        "3. Fotos.",
        "4. AnÃ¡lise tÃ©cnica.",
        "5. RecomendaÃ§Ãµes.",
        "6. ConclusÃ£o."
      ].join("\n"),
      nextAction: "Abra RelatÃ³rios, selecione cliente e obra, e comece pela descriÃ§Ã£o da vistoria.",
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
        : "Ela serve para registrar marcos, ideias, conquistas, dificuldades, objetivos e cartas para o futuro.\n\nAinda nÃ£o hÃ¡ eventos registrados na sua Linha do Tempo.",
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
      "alvenaria", "parede", "piso", "reboco", "emboÃ§o", "emboco",
      "concreto", "pilar", "viga", "laje"
    ];
    const intentTerms = [
      "posso executar", "da para executar", "dÃ¡ para executar",
      "tenho material", "tem saldo", "consigo fazer", "posso fazer",
      "executar amanha", "executar amanhÃ£", "fazer parede", "precisa comprar",
      "material suficiente", "saldo suficiente"
    ];
    const hasService = hasAnyTerm(text, serviceTerms);
    const hasIntent = hasAnyTerm(text, intentTerms);
    const hasQuantity = /\d+(?:[,.]\d+)?\s*(m2|mÂ²|m3|mÂ³|metro|metros|saco|sacos|un|und|unidade|unidades)/i.test(message);
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
      return "mÂ²";
    }
    if (normalized === "m3" || normalized.indexOf("metro cubico") >= 0 || normalized.indexOf("metro cÃºbico") >= 0) {
      return "mÂ³";
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
    return "Base tÃ©cnica demonstrativa/editÃ¡vel";
  }

  function buildEloOperationalScaleAlerts_(prediction) {
    const service = prediction && prediction.service ? prediction.service : {};
    const quantity = parseEloOperationalNumber_(service.quantity || service.executedQuantity);
    const unit = normalizeEloOperationalUnit_(service.unit || "un");
    if (quantity <= 0 || normalizeText(unit) !== normalizeText("mÂ²")) {
      return [];
    }
    const serviceText = normalizeText(service.service || service.serviceName || service.serviceType || "");
    const limits = [];
    if (hasAnyTerm(serviceText, ["alvenaria", "parede"])) {
      limits.push({ terms: ["areia"], unit: "mÂ³", maxPerUnit: 0.25 });
      limits.push({ terms: ["cimento"], unit: "saco", maxPerUnit: 1 });
      limits.push({ terms: ["bloco", "tijolo"], unit: "un", maxPerUnit: 40 });
    } else if (hasAnyTerm(serviceText, ["reboco", "emboÃ§o", "emboco"])) {
      limits.push({ terms: ["areia"], unit: "mÂ³", maxPerUnit: 0.12 });
      limits.push({ terms: ["cimento"], unit: "saco", maxPerUnit: 0.6 });
    } else if (hasAnyTerm(serviceText, ["piso"])) {
      limits.push({ terms: ["piso"], unit: "mÂ²", maxPerUnit: 1.4 });
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
        alerts.push("âš ï¸ Verificar quantitativo: consumo fora da faixa esperada para " + (item.name || item.material || "material") + ".");
      }
      return alerts;
    }, []);
  }

  function parseEloOperationalService_(message) {
    const text = normalizeText(message);
    const dimensionMatch = String(message || "").match(/(?:parede|muro|alvenaria)\s*(?:de\s*)?(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|Ã—|\?|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?/i);
    const quantityMatch = String(message || "").match(/(\d+(?:[,.]\d+)?)\s*(m2|mÂ²|m3|mÂ³|metros?\s+quadrados?|metros?\s+cubicos?|metros?\s+cÃºbicos?|sacos?|un|und|unidades?)/i);
    const quantity = dimensionMatch
      ? parseEloOperationalNumber_(dimensionMatch[1]) * parseEloOperationalNumber_(dimensionMatch[2])
      : quantityMatch ? parseEloOperationalNumber_(quantityMatch[1]) : 0;
    const unit = dimensionMatch ? "mÂ²" : quantityMatch ? normalizeEloOperationalUnit_(quantityMatch[2]) : "mÂ²";
    const services = [
      { terms: ["alvenaria", "parede", "muro", "tijolo", "bloco"], service: "Alvenaria", serviceType: "alvenaria", unit: "mÂ²" },
      { terms: ["piso"], service: "Piso ceramico", serviceType: "piso_ceramico", unit: "mÂ²" },
      { terms: ["reboco", "emboÃ§o", "emboco"], service: "Reboco", serviceType: "reboco_emboco", unit: "mÂ²" },
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
    const simplePairMatch = raw.match(/(?:parede|muro|alvenaria)[^\d]{0,50}(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|Ã—|\?|por)\s*(\d+(?:[,.]\d+)?)/i);
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
    return /\d+(?:[,.]\d+)?\s*(?:m2|m\^2|mï¿½|metros?\s+quadrados?|m3|m\^3|mÂ³|metros?\s+cubicos?)\b/.test(text) || /\d+(?:[,.]\d+)?\s*(?:m|metros?)?\s*(?:x|Ã—|\?|por)\s*\d+(?:[,.]\d+)?/.test(text);
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
    return /\d+(?:[,.]\d+)?\s*(?:m|metros?)?\s*(?:x|Ã—|\?|por)\s*\d+(?:[,.]\d+)?/.test(text) || (/comprimento|linear|corridos?/.test(text) && /altura|alto/.test(text));
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
    return /autorizo|pode\s+fazer|pode\s+seguir|faca|faÃ§a|quero|aceito/.test(text) && /estimativa\s+preliminar|nao\s+oficial|nÃ£o\s+oficial/.test(text);
  }

  function buildEloMissingTechnicalCompositionResponse_(premiseMessage) {
    const premiseText = normalizeText(premiseMessage || "");
    const lines = [
      "Para gerar quantitativo, mÃ£o de obra ou valor com seguranÃ§a, preciso localizar uma composiÃ§Ã£o tÃ©cnica, como SINAPI ou ORSE. No momento nÃ£o encontrei uma composiÃ§Ã£o correspondente com os dados informados. Posso continuar de duas formas:",
      "1. vocÃª informa o cÃ³digo/composiÃ§Ã£o SINAPI/ORSE;",
      "2. eu faÃ§o uma estimativa preliminar, claramente marcada como NÃƒO OFICIAL."
    ];
    if (premiseText) {
      lines.push("", formatEloTechnicalBaseLine_(null, false));
      lines.push.apply(lines, formatEloCollectedWallPremises_(premiseMessage));
    }
    return {
      shortAnswer: "Preciso de uma composiÃ§Ã£o tÃ©cnica para calcular com seguranÃ§a.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe o cÃ³digo/composiÃ§Ã£o SINAPI/ORSE ou autorize explicitamente uma estimativa preliminar NÃƒO OFICIAL.",
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
      source.indexOf("composiÃ§Ã£o interna validada") >= 0;
  }

  function hasEloValidatedTechnicalBase_(prediction) {
    return !!(prediction && prediction.prediction && isEloValidatedTechnicalComposition_(prediction.prediction.composition));
  }

  function formatEloTechnicalBaseLine_(composition, allowPreliminary) {
    if (allowPreliminary) {
      return "Base tÃ©cnica utilizada: Estimativa preliminar NÃƒO OFICIAL autorizada pelo usuÃ¡rio";
    }
    if (!composition) {
      return "Base tÃ©cnica utilizada: composiÃ§Ã£o tÃ©cnica nÃ£o localizada";
    }
    const source = composition.source || "composiÃ§Ã£o interna validada";
    const code = composition.code || composition.id || "sem cÃ³digo";
    const date = composition.sourceDate ? " | referÃªncia " + composition.sourceDate : "";
    const region = composition.sourceRegion ? " | " + composition.sourceRegion : "";
    return "Base tÃ©cnica utilizada: " + source + " | cÃ³digo " + code + date + region;
  }
  function formatEloCollectedWallPremises_(message) {
    const text = normalizeText(message || "");
    if (!hasEloWallSubject_(text)) {
      return [];
    }
    const original = sanitizeUserText(message || "");
    const dimensions = extractEloWallDimensions_(original);
    const grossArea = dimensions.length && dimensions.height ? dimensions.length * dimensions.height : null;
    const block = (original.match(/\b(?:bloco\s*)?(14\s*x\s*19\s*x\s*(?:29|39)|(?:29|39)\s*x\s*19\s*x\s*14)\b/i) || [])[1] || "informada pelo usuÃ¡rio";
    const loss = (original.match(/\b\d+(?:[,.]\d+)?\s*(?:%|por cento)/i) || [])[0] || "informada pelo usuÃ¡rio";
    const coating = /dois\s+lados|2\s+lados|ambos\s+os\s+lados|duas\s+faces/.test(text)
      ? "dois lados"
      : (/um\s+lado|1\s+lado|uma\s+face/.test(text) ? "um lado" : "informado pelo usuÃ¡rio");
    const openingsSummary = extractEloWallOpenings_(text);
    const openings = openingsSummary.hasNoOpenings ? "nenhum" : (openingsSummary.label || "nÃ£o informado");
    const liquidArea = grossArea !== null && (openingsSummary.hasNoOpenings || openingsSummary.totalArea > 0)
      ? Math.max(0, grossArea - openingsSummary.totalArea)
      : null;
    return [
      "",
      "Premissas utilizadas:",
      "- ServiÃ§o considerado: parede/alvenaria de bloco cerÃ¢mico",
      "- Comprimento da parede: " + formatEloWallPremiseMeasure_(dimensions.length, "m"),
      "- Altura da parede: " + formatEloWallPremiseMeasure_(dimensions.height, "m"),
      "- Ãrea bruta: " + formatEloWallPremiseMeasure_(grossArea, "mÂ²"),
      "- VÃ£os descontados: " + openings,
      "- Ãrea lÃ­quida considerada: " + formatEloWallPremiseMeasure_(liquidArea, "mÂ²"),
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
      const pairMatch = geometrySource.match(/\b(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|Ã—|\?|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\b/i);
      if (pairMatch) {
        length = length || parseEloOperationalNumber_(pairMatch[1]);
        height = height || parseEloOperationalNumber_(pairMatch[2]);
      }
    }
    return { length: length || null, height: height || null };
  }

  function stripEloBlockDimensionTriples_(message) {
    return sanitizeUserText(message || "").replace(/\b(?:(?:bloco|tijolo|baiano|ceramico|cer.mico)\s*)?\d{1,2}\s*(?:x|Ã—|\?|por)\s*\d{1,2}\s*(?:x|Ã—|\?|por)\s*\d{1,2}\s*(?:cm|centimetros?)?\b/gi, " ");
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
    const pattern = /(?:\b(\d+|um|uma|dois|duas)\s*)?\b(portas?|janelas?)\s*(?:de|com|medindo)?\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|Ã—|\?|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?/gi;
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
      return item.quantity + " " + typeLabel + " " + formatEloWallPremiseNumber_(item.width) + " x " + formatEloWallPremiseNumber_(item.height) + " m = " + formatEloWallPremiseMeasure_(item.area, "mÂ²");
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
      return unit === "mÂ²" ? "nÃ£o calculada" : "nÃ£o informado";
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
    const match = String(message || "").match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|mÂ²|metros?\s+quadrados?)/i);
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
      return "nÃ£o informada";
    }
    const value = Number(briefing.perda_percentual);
    return (Number.isInteger(value) ? String(value) : formatEloWallPremiseNumber_(value)) + "%";
  }

  function formatEloStockObrasCoating_(briefing) {
    return briefing.revestimento_lados || "nÃ£o informado";
  }

  function formatEloStockObrasThickness_(briefing) {
    return briefing.espessura_revestimento_cm !== null ? formatEloWallPremiseMeasure_(briefing.espessura_revestimento_cm, "cm") : "nÃ£o informada";
  }

  function formatEloStockObrasOpenings_(briefing) {
    const portas = briefing.vaos.portas.map(function (item) {
      const label = item.quantidade === 1 ? "porta" : "portas";
      return item.quantidade + " " + label + " " + formatEloWallPremiseNumber_(item.largura_m) + " x " + formatEloWallPremiseNumber_(item.altura_m) + " m = " + formatEloWallPremiseMeasure_(item.area_m2, "mÂ²");
    });
    const janelas = briefing.vaos.janelas.map(function (item) {
      const label = item.quantidade === 1 ? "janela" : "janelas";
      return item.quantidade + " " + label + " " + formatEloWallPremiseNumber_(item.largura_m) + " x " + formatEloWallPremiseNumber_(item.altura_m) + " m = " + formatEloWallPremiseMeasure_(item.area_m2, "mÂ²");
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
    const hasBlock = block && block !== "nÃ£o informada";
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
    const source = composition.source || "composiÃ§Ã£o interna validada";
    const code = composition.code || composition.id || "sem cÃ³digo";
    const unit = composition.productionUnit || composition.unit || "mÂ²";
    const reference = composition.sourceDate || metadata.referenceMonth || "";
    const region = composition.sourceRegion || metadata.state || "";
    return source + " | cÃ³digo " + code + " | unidade " + unit +
      (region ? " | " + region : "") +
      (reference ? " | referÃªncia " + reference : "");
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
        "  - Consumo lÃ­quido: " + formatEloOperationalQuantity_(safeLiquid) + " " + formatEloOperationalDisplayUnit_(unit),
        "  - Perda base da composiÃ§Ã£o: " + formatEloOperationalQuantity_(baseLoss || 0) + "%" + (originalFinal > 0 ? " | consumo com perda base: " + formatEloOperationalQuantity_(originalFinal) + " " + formatEloOperationalDisplayUnit_(unit) : ""),
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
        "  - Consumo lÃ­quido: " + formatEloOperationalQuantity_(liquid) + " " + formatEloOperationalDisplayUnit_(input.unidade),
        "  - Perda base da composiÃ§Ã£o: " + formatEloOperationalQuantity_(baseLoss || 0) + "%" + (baseLoss > 0 ? " | consumo com perda base: " + formatEloOperationalQuantity_(baseLossQuantity) + " " + formatEloOperationalDisplayUnit_(input.unidade) : ""),
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
      "- Area liquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²"),
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
      "- Ãrea bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "mÂ²"),
      "- Area de vaos: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m2"),
      "- Vaos descontados: " + openingSummary,
      "- Area liquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m2"),
      "- Ãrea lÃ­quida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²"),
      "- Area tecnica para chapisco/reboco/pintura: " + formatEloWallPremiseMeasure_(coatingArea, "m2") + " (duas faces do pacote parede completa; confirme se for apenas uma face).",
      "- Bloco considerado: " + formatEloStockObrasBlockDimension_(briefing),
      "- Perda da alvenaria: " + formatEloStockObrasLoss_(briefing),
      "",
      "Memoria permanente de obra",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "MemÃ³ria de cÃ¡lculo:",
      "- Area bruta " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "m2") + " - vaos " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "m2") + " = area liquida " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "m2") + ".",
      "- Consumo calculado pelo Elo Orcamentista Assistido com base em composiÃ§Ã£o oficial localizada.",
      "",
      "Base tecnica utilizada: " + (services[0] && services[0].contract && services[0].contract.fonte ? services[0].contract.fonte : "nao localizada"),
      "Base tÃ©cnica utilizada: " + (services[0] && services[0].contract && services[0].contract.fonte ? services[0].contract.fonte : "nao localizada"),
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
      lines.push("  - Consumo calculado pelo motor Stock Obras: " + formatEloWallPremiseMeasure_(service.quantity, "m2") + " de referÃªncia.");
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
    const after = raw.match(new RegExp("(?:" + elementRegex + ")\\D{0,20}(\\d{1,3})\\s*(?:un|unidades|pecas|peÃ§as)", "i"));
    if (after) return Math.max(1, parseInt(after[1], 10));
    return 1;
  }

  function extractEloStructuralTriple_(message) {
    const raw = String(message || "");
    const match = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|cm)?\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|cm)?\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/i);
    return match ? [match[1], match[2], match[3]] : null;
  }

  function extractEloStructuralLengthAndSection_(message) {
    const raw = String(message || "");
    const match = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\D{0,30}(\d+(?:[,.]\d+)?)\s*(?:cm)?\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/i) ||
      raw.match(/(\d+(?:[,.]\d+)?)\s*(?:cm)?\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)\D{0,30}(\d+(?:[,.]\d+)?)\s*(?:m|metros?)/i);
    if (!match) return null;
    if (/\d+(?:[,.]\d+)?\s*(?:cm)?\s*(?:x|Ã—|por)/i.test(match[0]) && /(?:m|metros?)\s*$/i.test(match[0])) {
      return { length: normalizeEloStructuralDimension_(match[3], "length"), width: normalizeEloStructuralDimension_(match[1], "section"), height: normalizeEloStructuralDimension_(match[2], "section") };
    }
    return { length: normalizeEloStructuralDimension_(match[1], "length"), width: normalizeEloStructuralDimension_(match[2], "section"), height: normalizeEloStructuralDimension_(match[3], "section") };
  }

  function parseEloStructuralPackageRequest_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    const structuralBlockPattern = /(?:^|\b)\d{1,3}\s+blocos?\s+\d+(?:[,.]\d+)?\s*(?:x|Ã—|por)\s*\d+(?:[,.]\d+)?\s*(?:x|Ã—|por)\s*\d+(?:[,.]\d+)?/;
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
          "- Nao faÃ§o dimensionamento estrutural.",
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
    lines.push("", "Observacoes tecnicas", "- Os quantitativos apresentados nao substituem projeto estrutural.", "- Nao faÃ§o dimensionamento estrutural nem calculo armaduras normativas.", "- Dimensionamento e detalhamento devem ser realizados por profissional habilitado.");
    return { shortAnswer: "Pacote estrutural consolidado para revisao tecnica.", fullAnswer: lines.join("\n"), nextAction: contract && contract.valid ? "Revise geometria, composicao e premissas com o responsavel tecnico." : "Importe ou informe composicao SINAPI/ORSE oficial para completar custos e consumos.", canSave: true, sessionTheme: "structural_package", sessionIntent: "structural_package" };
  }



  function parseEloResidentialArea_(message) {
    const raw = String(message || "");
    const contextual = raw.match(/(?:casa|residencia|residÃªncia|obra)[^\n\r]{0,50}?(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|mÂ²|metros?\s+quadrados?|metros?)\b/i);
    if (contextual) return parseEloOperationalNumber_(contextual[1]);
    const explicitArea = raw.match(/(?:area|Ã¡rea)\s+(?:aproximada\s+)?(?:da\s+)?(?:casa|obra|residencia|residÃªncia)[^\n\r]{0,30}?(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|mÂ²|metros?\s+quadrados?)/i);
    if (explicitArea) return parseEloOperationalNumber_(explicitArea[1]);
    const generic = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|mÂ²|metros?\s+quadrados?)/i);
    return generic ? parseEloOperationalNumber_(generic[1]) : 0;
  }
  function parseEloResidentialWallPackage_(message) {
    const raw = String(message || "");
    const text = normalizeText(raw);
    if (!/parede|paredes|alvenaria/.test(text)) return null;
    let wallMatch = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?paredes?[^\n\r]{0,50}?(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?altura/i) || raw.match(/paredes?[^\n\r]{0,50}?(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\D{0,30}(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:de\s+)?altura/i);
    if (!wallMatch) wallMatch = raw.match(/paredes?[^\n\r]{0,40}?(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?[^\n\r]{0,20}?altura\s*(\d+(?:[,.]\d+)?)/i);
    const areaMatch = raw.match(/(?:area|Ã¡rea)\s+(?:bruta\s+)?(?:de\s+)?(?:parede|paredes|alvenaria)[^\n\r]{0,30}?(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|mÂ²)/i);
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
    const openingsMatch = raw.match(/(?:portas?\s+e\s+janelas?|vaos|vÃ£os|aberturas?)[^\n\r]{0,40}?(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|mÂ²)/i);
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
    Array.from(raw.matchAll(/(\d{1,3})\s+pilares?\s+(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) {
      add(match[1] + " pilares " + match[2] + " x " + match[3] + " x " + match[4]);
    });
    Array.from(raw.matchAll(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?vigas?\s+(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) {
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
    const hasResidentialIntent = /orcamento|orÃ§amento|residencial|residencia|residÃªncia|casa|obra|preliminar|custa|custo/.test(text);
    if (!hasResidentialIntent) return null;
    const wall = parseEloResidentialWallPackage_(raw);
    const foundationAll = collectEloFoundationPackageElements_(raw);
    const foundationElements = foundationAll.filter(function (element) { return element.type === "sapata" || element.type === "bloco_fundacao" || element.type === "viga_baldrame"; });
    const structureElements = collectEloResidentialStructureElements_(raw).filter(function (element) { return element.type === "pilar" || element.type === "viga_aerea"; });
    const area = parseEloResidentialArea_(raw);
    if (!wall && !foundationElements.length && !structureElements.length) return null;
    if (!/orcamento|orÃ§amento|preliminar|custa|custo|residencial|casa|obra/.test(text) && (wall ? 1 : 0) + (foundationElements.length ? 1 : 0) + (structureElements.length ? 1 : 0) < 2) return null;
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
    const lines = ["# ORÃ‡AMENTO RESIDENCIAL PRELIMINAR", "", "Encontrei mais de uma composicao oficial compativel para um ou mais serviÃ§os.", "", "Nao vou assumir automaticamente. Informe qual deseja utilizar:", ""];
    conflicts.forEach(function (conflict) {
      lines.push(conflict.label + ":");
      conflict.candidates.slice(0, 5).forEach(function (candidate, index) {
        const contract = buildEloTechnicalCompositionContract_(candidate);
        lines.push((index + 1) + ". " + contract.codigo + " | " + contract.descricao + " | unidade " + contract.unidade + " | " + contract.fonte + (contract.uf ? " " + contract.uf : "") + (contract.mes ? " " + contract.mes : ""));
      });
      lines.push("");
    });
    lines.push("## Avisos profissionais", "Este orÃ§amento Ã© preliminar e assistido. NÃ£o substitui projeto, memorial descritivo, levantamento executivo ou responsabilidade tÃ©cnica profissional.");
    return { shortAnswer: "Mais de uma composicao encontrada para o orÃ§amento residencial.", fullAnswer: lines.join("\n"), nextAction: "Informe os cÃ³digos das composiÃ§Ãµes escolhidas para consolidar o orÃ§amento preliminar.", canSave: false, sessionTheme: "residential_budget_package", sessionIntent: "residential_budget_composition_choice" };
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
      "# ORÃ‡AMENTO RESIDENCIAL PRELIMINAR",
      "",
      "## 1. Resumo executivo",
      "- Ãrea informada: " + (residential.area ? formatEloWallPremiseMeasure_(residential.area, "mÂ²") : "nÃ£o informada"),
      "- Parede completa: " + (residential.wall ? "considerada" : "nÃ£o informada"),
      "- FundaÃ§Ã£o completa: " + (residential.foundationElements.length ? "considerada" : "nÃ£o informada"),
      "- Estrutura simples: " + (residential.structureElements.length ? "considerada" : "nÃ£o informada"),
      "- Concreto total geral: " + formatEloOperationalQuantity_(totalConcrete) + " m3",
      "- Forma total geral: " + formatEloOperationalQuantity_(totalForm) + " m2",
      "- EscavaÃ§Ã£o total geral: " + formatEloOperationalQuantity_(foundationExcavation) + " m3",
      "- Ãrea de alvenaria: " + (residential.wall ? formatEloWallPremiseMeasure_(residential.wall.netArea, "mÂ²") : "nÃ£o informada"),
      "- Ãrea de revestimento/pintura: " + (residential.wall ? formatEloWallPremiseMeasure_(residential.wall.coatingArea, "mÂ²") : "nÃ£o informada"),
      "",
      "## 2. Premissas informadas"
    ];
    if (residential.wall) {
      lines.push("- Paredes: Ã¡rea bruta " + formatEloWallPremiseMeasure_(residential.wall.grossArea, "mÂ²") + "; vÃ£os " + formatEloWallPremiseMeasure_(residential.wall.openingsArea, "mÂ²") + "; Ã¡rea lÃ­quida " + formatEloWallPremiseMeasure_(residential.wall.netArea, "mÂ²") + ".");
    } else lines.push("- Paredes: nÃ£o informadas.");
    residential.foundationElements.forEach(function (element) { lines.push("- FundaÃ§Ã£o: " + getEloFoundationElementSummary_(element)); });
    residential.structureElements.forEach(function (element) { lines.push("- Estrutura: " + getEloFoundationElementSummary_(element)); });
    lines.push("", "## 3. Parede completa");
    if (residential.wall) {
      lines.push("- Ãrea bruta de parede: " + formatEloWallPremiseMeasure_(residential.wall.grossArea, "mÂ²"));
      lines.push("- Ãrea de vÃ£os: " + formatEloWallPremiseMeasure_(residential.wall.openingsArea, "mÂ²"));
      lines.push("- Ãrea lÃ­quida: " + formatEloWallPremiseMeasure_(residential.wall.netArea, "mÂ²"));
      lines.push("- Ãrea tÃ©cnica para chapisco/reboco/pintura: " + formatEloWallPremiseMeasure_(residential.wall.coatingArea, "mÂ²") + " (duas faces)." );
    } else lines.push("- NÃ£o informada nesta solicitaÃ§Ã£o.");
    lines.push("", "## 4. FundaÃ§Ã£o completa");
    if (residential.foundationElements.length) {
      residential.foundationElements.forEach(function (element) { lines.push("- " + getEloFoundationElementSummary_(element)); });
      lines.push("- Concreto da fundaÃ§Ã£o: " + formatEloOperationalQuantity_(foundationConcrete) + " m3");
      lines.push("- EscavaÃ§Ã£o geomÃ©trica: " + formatEloOperationalQuantity_(foundationExcavation) + " m3");
      lines.push("- Forma da fundaÃ§Ã£o: " + formatEloOperationalQuantity_(foundationForm) + " m2");
    } else lines.push("- NÃ£o informada nesta solicitaÃ§Ã£o.");
    lines.push("", "## 5. Estrutura simples");
    if (residential.structureElements.length) {
      residential.structureElements.forEach(function (element) { lines.push("- " + getEloFoundationElementSummary_(element)); });
      lines.push("- Volume de pilares/vigas: " + formatEloOperationalQuantity_(structureConcrete) + " m3");
      lines.push("- Forma lateral: " + formatEloOperationalQuantity_(structureForm) + " m2");
    } else lines.push("- NÃ£o informada nesta solicitaÃ§Ã£o.");
    lines.push("", "## 6. Totais consolidados", "- Concreto total geral: " + formatEloOperationalQuantity_(totalConcrete) + " m3", "- Forma total geral: " + formatEloOperationalQuantity_(totalForm) + " m2", "- EscavaÃ§Ã£o total geral: " + formatEloOperationalQuantity_(foundationExcavation) + " m3");
    lines.push("", "## 7. ComposiÃ§Ãµes oficiais utilizadas");
    if (bucket.used.length) bucket.used.forEach(function (item) { lines.push("- " + item.label + ": " + item.contract.fonte + " | " + item.contract.codigo + " | " + item.contract.descricao + " | unidade " + item.contract.unidade + " | " + (item.contract.uf || "UF nÃ£o informada") + " / " + (item.contract.mes || "mÃªs nÃ£o informado")); });
    else lines.push("- Nenhuma composiÃ§Ã£o oficial localizada para os serviÃ§os informados.");
    lines.push("", "## 8. Custos encontrados");
    if (bucket.hasAnyCost) lines.push("- Custo parcial encontrado: R$ " + formatEloOperationalQuantity_(bucket.totalCost) + (bucket.hasMissingCost ? ". Existem insumos sem preÃ§o; nÃ£o trate como custo total definitivo." : "."));
    else lines.push("- Custo parcial nÃ£o encontrado: nenhum preÃ§o oficial suficiente localizado; custo nÃ£o calculado.");
    lines.push("", "## 9. PendÃªncias tÃ©cnicas");
    if (bucket.missing.length) bucket.missing.forEach(function (label) { lines.push("- " + label + ": composiÃ§Ã£o oficial nÃ£o localizada na base atualmente carregada."); });
    else lines.push("- Nenhuma pendÃªncia de composiÃ§Ã£o para os serviÃ§os localizados na base atual.");
    lines.push("- AÃ§o nÃ£o calculado automaticamente. NecessÃ¡rio projeto estrutural.");
    lines.push("- Confirmar memorial descritivo, padrÃ£o de acabamento, perdas executivas, BDI, encargos e preÃ§os vigentes antes de contrataÃ§Ã£o.");
    lines.push("", "## 10. Avisos profissionais", "Este orÃ§amento Ã© preliminar e assistido. NÃ£o substitui projeto, memorial descritivo, levantamento executivo ou responsabilidade tÃ©cnica profissional.", "NÃ£o faÃ§o dimensionamento estrutural nem detalhamento de armaduras normativas.");
    return { shortAnswer: "OrÃ§amento residencial preliminar consolidado para revisÃ£o tÃ©cnica.", fullAnswer: lines.join("\n"), nextAction: bucket.missing.length ? "Importe ou informe as composiÃ§Ãµes oficiais faltantes para completar o orÃ§amento preliminar." : "Revise premissas, preÃ§os e responsabilidades tÃ©cnicas antes de apresentar ao cliente.", canSave: true, sessionTheme: "residential_budget_package", sessionIntent: "residential_budget_package" };
  }

  function isEloResidentialBudgetBriefingQuestion_(message) {
    const text = normalizeText(message || "");
    if (/parede|alvenaria|bloco|tijolo|reboco|contrapiso|pintura|telhado|piso|concreto|forma|armacao|arma..o|sinapi|orse|composi..o|composicao/.test(text)) return false;
    return /orcamento\s+residencial|or.amento\s+residencial|orcamento\s+(?:preliminar\s+)?(?:de\s+)?casa|or.amento\s+(?:preliminar\s+)?(?:de\s+)?casa|quero\s+orcamento\s+residencial|quero\s+or.amento\s+residencial/.test(text);
  }

  function buildEloResidentialBudgetBriefingAnswer_(message) {
    if (!isEloResidentialBudgetBriefingQuestion_(message)) return null;
    const project = updateEloWorkMemoryFromMessage_(message);
    const missing = [];
    if (!project.cidade || project.cidade === "n??o informada" || !project.uf || project.uf === "n??o informada") missing.push("cidade/UF");
    if (!project.padrao_construtivo) missing.push("padrao da obra");
    if (!project.area_m2) missing.push("area aproximada");
    if (!project.tipo_obra) missing.push("tipo de construcao");
    if (!/pavimento|andar|terrea|t.rrea|sobrado|2\s+pav|dois\s+pav/.test(normalizeText(message || ""))) missing.push("quantidade de pavimentos");
    if (!project.etapa_atual) missing.push("etapa desejada");
    return {
      shortAnswer: "Vamos montar o orcamento residencial preliminar com os dados basicos primeiro.",
      fullAnswer: [
        "Orcamento residencial preliminar",
        "Antes de buscar SINAPI/ORSE ou compor valores, preciso fechar o briefing minimo:",
        "- cidade/UF;",
        "- padrao da obra;",
        "- area aproximada;",
        "- tipo de construcao;",
        "- quantidade de pavimentos;",
        "- etapa desejada.",
        "",
        "Dados ainda pendentes: " + (missing.length ? missing.join(", ") : "nenhum dado basico aparente; confirme se posso seguir para composicoes.")
      ].join("\n"),
      nextAction: "Responda com cidade/UF, padrao, area, tipo de construcao, pavimentos e etapa desejada.",
      canSave: false,
      sessionTheme: "residential_budget_package",
      sessionIntent: "briefing_residential_budget"
    };
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
    if (/parede|alvenaria|tijolo|baiano|ceramico|cer.mico/.test(text) && !/fundacao|funda..o|sapatas?|blocos?|baldrame|pilares?|\bviga\b/.test(text)) return [];
    const elements = [];
    function addElement(type, snippet) {
      const geometry = parseEloStructuralPackageRequest_(snippet);
      if (geometry && !geometry.incomplete) elements.push(geometry);
    }
    Array.from(raw.matchAll(/(\d{1,3})\s+sapatas?\s+(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("sapata", buildEloFoundationElementSnippet_("sapata", match)); });
    Array.from(raw.matchAll(/(\d{1,3})\s+blocos?\s+(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("bloco_fundacao", buildEloFoundationElementSnippet_("bloco_fundacao", match)); });
    Array.from(raw.matchAll(/(\d{1,3})\s+pilares?\s+(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("pilar", buildEloFoundationElementSnippet_("pilar", match)); });
    Array.from(raw.matchAll(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?baldrame\s+(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("viga_baldrame", buildEloFoundationElementSnippet_("viga_baldrame", match)); });
    Array.from(raw.matchAll(/baldrame\s+(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s+(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("viga_baldrame", buildEloFoundationElementSnippet_("viga_baldrame", match)); });
    Array.from(raw.matchAll(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s+)?viga\s+(\d+(?:[,.]\d+)?)\s*(?:x|Ã—|por)\s*(\d+(?:[,.]\d+)?)/gi)).forEach(function (match) { addElement("viga_aerea", buildEloFoundationElementSnippet_("viga_aerea", match)); });
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
      "FUNDAÃ‡ÃƒO COMPLETA",
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
    lines.push("Observacoes tecnicas", "- Os volumes geometricos foram identificados, mas a composicao deve ser escolhida explicitamente.", "- Nao faÃ§o dimensionamento estrutural nem calculo armaduras normativas.");
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
      "FUNDAÃ‡ÃƒO COMPLETA",
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
    lines.push("", "Observacoes tecnicas", "- Escavacao total e volume de concreto sao geometricos, conforme dimensoes fornecidas; nao incluem folgas executivas, perdas de escavacao ou regularizacao.", "- Forma total considera apenas area lateral indicada pelos elementos ja suportados pelo motor estrutural.", "- Aco nao calculado automaticamente. Necessario projeto estrutural.", "- Nao faÃ§o dimensionamento estrutural nem detalhamento de armaduras normativas.", "- Dimensionamento e detalhamento devem ser realizados por profissional habilitado.");
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
      "MemÃ³ria de cÃ¡lculo:",
      "- Area bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "mÂ²"),
      "- Area total de vaos: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "mÂ²"),
      "- Area liquida: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²"),
      "- Formula de consumo: area liquida x coeficiente da composicao x (1 + perda adotada).",
      "",
      "Premissas utilizadas:",
      "Memoria permanente de obra:",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "Premissas do servico:",
      "- Comprimento da parede: " + formatEloWallPremiseMeasure_(briefing.comprimento_m, "m"),
      "- Altura da parede: " + formatEloWallPremiseMeasure_(briefing.altura_m, "m"),
      "- Area bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "mÂ²"),
      "- Vaos descontados: " + openingSummary,
      "- Area total de vaos: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "mÂ²"),
      "- Area liquida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²"),
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
      "3. Premissas: area liquida " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²") + ", perda " + formatEloStockObrasLoss_(briefing) + ".",
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
    const auditorAlerts = buildEloTechnicalAuditorAlerts_("parede alvenaria orÃ§amento custo produtividade", { hasOfficialBase: false });
    const lines = [
      "Resposta principal",
      alreadyConsidered ? "A premissa informada jÃ¡ estava considerada no briefing acumulado." : "Briefing tÃ©cnico consolidado, mas ainda preciso de uma composiÃ§Ã£o SINAPI/ORSE ou interna validada para calcular consumo, mÃ£o de obra, produtividade ou custo com seguranÃ§a.",
      "",
      "MemÃ³ria de cÃ¡lculo:",
      "- Ãrea bruta " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "mÂ²") + " - vÃ£os " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "mÂ²") + " = Ã¡rea lÃ­quida " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²") + ".",
      "- Consumo, produtividade, mÃ£o de obra e custo oficial ainda bloqueados por falta de base tÃ©cnica vÃ¡lida.",
      "",
      "Premissas utilizadas:",
      "MemÃ³ria permanente de obra:",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "Premissas do serviÃ§o:",
      "- Comprimento da parede: " + formatEloWallPremiseMeasure_(briefing.comprimento_m, "m"),
      "- Altura da parede: " + formatEloWallPremiseMeasure_(briefing.altura_m, "m"),
      "- Ãrea bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "mÂ²"),
      "- VÃ£os descontados: " + openingSummary,
      "- Ãrea total de vÃ£os: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "mÂ²"),
      "- Ãrea lÃ­quida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²"),
      "- Bloco considerado: " + formatEloStockObrasBlockDimension_(briefing),
      "- Perda adotada: " + formatEloStockObrasLoss_(briefing),
      "- Lados revestidos: " + formatEloStockObrasCoating_(briefing),
      briefing.espessura_revestimento_cm !== null ? "- Espessura do revestimento: " + formatEloStockObrasThickness_(briefing) : "",
      "",
      "Base tÃ©cnica utilizada: nÃ£o localizada",
      "- NÃ£o vou gerar quantitativo oficial, consumo, mÃ£o de obra, produtividade ou valor sem SINAPI, ORSE ou composiÃ§Ã£o interna validada.",
      "",
      "Alertas do auditor:",
      auditorAlerts.join("\n"),
      "",
      buildEloBudgetMvpScopeNotice_(),
      "",
      "PrÃ³xima aÃ§Ã£o recomendada",
      "VocÃª pode informar o cÃ³digo/composiÃ§Ã£o SINAPI/ORSE ou autorizar explicitamente uma estimativa preliminar NÃƒO OFICIAL."
    ].filter(Boolean);
    return {
      shortAnswer: "Briefing tÃ©cnico consolidado; base tÃ©cnica nÃ£o localizada.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe o cÃ³digo/composiÃ§Ã£o SINAPI/ORSE ou autorize explicitamente uma estimativa preliminar NÃƒO OFICIAL.",
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
    const asksOnlyBlocks = /quantos\s+blocos|blocos?.*(?:preciso|gasto|necessario|necessÃ¡rios|necessarios)/.test(text);
    const hasBudgetIntent = /orcamento|orÃ§amento|orcar|custo|preco|preÃ§o|valor|quanto\s+custa/.test(text);
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
    const relevantFollowUp = /porta|janela|vao|vÃ£os|bloco|tijolo|perda|revestimento|sem\s+revestimento|chapisco|reboco|\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2}/.test(currentText);
    if (!isPendingWall && !shouldStart && hasActiveBriefing && !relevantFollowUp) {
      return null;
    }

    const briefing = updateEloStockObrasCompositionBriefing_(currentMessage, combinedMessage, !isPendingWall && shouldStart);
    const missing = [];
    let intent = "confirmar_premissas_parede";
    if (!briefing.area_bruta_m2) {
      missing.push("comprimento e altura, ou Ã¡rea bruta da parede");
      intent = "confirmar_medidas_parede";
    }
    if (!briefing.bloco_ceramico_dimensao_cm) {
      missing.push("dimensÃ£o real do bloco. Qual a dimensÃ£o do bloco? Ex.: 14x19x39, 14x19x29 ou outra medida real do bloco cerÃ¢mico");
      intent = "confirmar_bloco_parede";
    }
    if (!briefing.vaos.sem_vaos && !briefing.vaos.portas.length && !briefing.vaos.janelas.length) {
      missing.push("se existem vÃ£os. A parede terÃ¡ portas ou janelas? Se sim, informe quantidade e medidas. Ex.: 1 porta de 0,80 x 2,10 m; 2 janelas de 1,20 x 1,00 m. Ou confirme: parede Ã­ntegra, sem vÃ£os");
      if (intent === "confirmar_premissas_parede") intent = "confirmar_vaos_parede";
    }
    if (briefing.perda_percentual === null) {
      missing.push("perda adotada em porcentagem, por exemplo 8% ou 10%");
      if (intent === "confirmar_premissas_parede") intent = "confirmar_perda_parede";
    }
    if (!briefing.revestimento_lados) {
      missing.push("se haverÃ¡ revestimento em um lado, nos dois lados ou sem revestimento");
      if (intent === "confirmar_premissas_parede") intent = "confirmar_lados_revestimento";
    }
    if (missing.length) {
      calculateEloStockObrasLiquidArea_(briefing);
      briefing.pending_question = intent;
      const registeredLines = [
        "- Comprimento da parede: " + formatEloWallPremiseMeasure_(briefing.comprimento_m, "m"),
        "- Altura da parede: " + formatEloWallPremiseMeasure_(briefing.altura_m, "m"),
        "- Ãrea bruta: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "mÂ²")
      ];
      if (briefing.bloco_ceramico_dimensao_cm) {
        registeredLines.push("- Bloco considerado: " + formatEloStockObrasBlockDimension_(briefing));
      }
      if (briefing.vaos.sem_vaos || briefing.vaos.portas.length || briefing.vaos.janelas.length) {
        registeredLines.push("- VÃ£os descontados: " + formatEloStockObrasOpenings_(briefing));
        registeredLines.push("- Ãrea total de vÃ£os: " + formatEloWallPremiseMeasure_(briefing.area_vaos_m2 || 0, "mÂ²"));
        registeredLines.push("- Ãrea lÃ­quida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²"));
      }
      if (briefing.perda_percentual !== null) {
        registeredLines.push("- Perda adotada: " + formatEloStockObrasLoss_(briefing));
      }
      if (briefing.revestimento_lados) {
        registeredLines.push("- Lados revestidos: " + formatEloStockObrasCoating_(briefing));
      }
      const fullAnswer = [
        "Resposta principal",
        "Ãrea geomÃ©trica da parede: " + formatEloWallPremiseMeasure_(briefing.area_bruta_m2, "mÂ²") + "." + ((briefing.vaos.sem_vaos || briefing.vaos.portas.length || briefing.vaos.janelas.length) ? " Ãrea lÃ­quida considerada: " + formatEloWallPremiseMeasure_(briefing.area_liquida_m2, "mÂ²") + "." : ""),
        "",
        "Premissas utilizadas:",
        registeredLines.join("\n"),
        "",
        "Base tÃ©cnica utilizada",
        "- Geometria informada pelo usuÃ¡rio. SINAPI/ORSE ainda nÃ£o foi consultada porque faltam premissas obrigatÃ³rias.",
        "",
        "PrÃ³xima aÃ§Ã£o",
        "Ainda preciso confirmar:",
        missing.map(function (item) { return "- " + item; }).join("\n"),
        "",
        "Depois vou verificar SINAPI/ORSE ou composiÃ§Ã£o interna validada."
      ].filter(Boolean).join("\n");
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso completar o briefing tÃ©cnico da parede.",
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
    if (pending.sessionIntent === "confirmar_vaos_parede" && /^(nao|nÃ£o|nao ha|nÃ£o hÃ¡|sem)$/.test(normalizedCurrent)) {
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
      !/bloco|porta|janela|vao|vÃ£os|perda|revestimento|sem\s+portas|sem\s+janelas|\d{1,2}\s*x\s*\d{1,2}|\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2}/.test(currentText);
    if (isPendingWall && isGenericBudgetOrProductivity) {
      clearEloPendingPremises_();
      return null;
    }
    const shouldStart = shouldStartEloWallPremiseCollection_(currentText);
    const activeStockObrasBriefing = ELO_SESSION_MEMORY.stockObrasCompositionBriefing && ELO_SESSION_MEMORY.stockObrasCompositionBriefing.active;
    const stockObrasFollowUp = activeStockObrasBriefing && /porta|janela|vao|vÃ£os|bloco|tijolo|perda|revestimento|sem\s+revestimento|chapisco|reboco|\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2}/.test(currentText);
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

    if (!hasEloWallLengthHeight_(text) && !/\d+(?:[,.]\d+)?\s*(?:m2|m\^2|mÂ²|metros?\s+quadrados?)/.test(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso do comprimento e da altura.",
        "Informe comprimento e altura, ou a Ã¡rea em mÂ². Ex.: parede com 20 m de comprimento e 2,80 m de altura.",
        "Informe comprimento x altura ou Ã¡rea da parede.",
        "confirmar_medidas_parede"
      ));
    }

    if (!hasEloBlockDimension_(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso confirmar a dimensÃ£o do bloco.",
        "Qual a dimensÃ£o do bloco? Ex.: 14x19x39, 14x19x29 ou outra medida real do bloco cerÃ¢mico.",
        "Informe a dimensÃ£o real do bloco para eu continuar a coleta de premissas.",
        "confirmar_bloco_parede"
      ));
    }

    if (!hasEloWallOpenings_(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso saber se existem vÃ£os para descontar.",
        "Antes de calcular, preciso saber se existem vÃ£os para descontar.\nA parede terÃ¡ portas ou janelas?\nSe sim, informe quantidade e medidas. Ex.:\n- 1 porta de 0,80 x 2,10 m\n- 2 janelas de 1,20 x 1,00 m\nOu confirme: parede Ã­ntegra, sem vÃ£os.",
        "Informe portas/janelas com medidas ou confirme: parede Ã­ntegra, sem vÃ£os.",
        "confirmar_vaos_parede"
      ));
    }

    if (!hasEloLossPremise_(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso confirmar a perda adotada.",
        "Deseja considerar perdas? Informe a perda em porcentagem, por exemplo 8% ou 10%.",
        "Informe a perda tÃ©cnica que devo considerar.",
        "confirmar_perda_parede"
      ));
    }

    if (!hasEloWallCoatingSide_(text)) {
      return saveEloPendingPremises_("wall", combinedMessage, buildEloPremiseCollectionQuestion_(
        "Antes de calcular, preciso confirmar o revestimento.",
        "HaverÃ¡ revestimento? Um lado ou dois lados?",
        "Informe se haverÃ¡ revestimento e se serÃ¡ em um lado ou nos dois lados.",
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
          fullAnswer: "Antes de calcular, preciso confirmar o FCK do concreto. Qual serï¿½ o FCK desejado? Ex.: 15, 20, 25 ou 30 MPa. Tambï¿½m confirme o uso: passeio, piso residencial, garagem ou ï¿½rea com carga pesada.",
          nextAction: "Informe FCK e uso do concreto para eu continuar sem chutar premissas.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_fck_concreto"
        };
      }
      if (/piso|laje|contrapiso|radier/.test(text) && !hasEloConcreteThickness_(text) && !/m3|m\^3|mÂ³|metros?\s+cubicos?/.test(text)) {
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
          shortAnswer: "Antes de calcular, preciso da ï¿½rea, dimensï¿½es ou volume.",
          fullAnswer: "Antes de calcular concreto, informe ï¿½rea + espessura, dimensï¿½es ou volume em mï¿½. Ex.: piso de concreto 20 mï¿½ com 8 cm, FCK 20 MPa, uso residencial.",
          nextAction: "Informe ï¿½rea/dimensï¿½es ou volume para eu calcular.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_medidas_concreto"
        };
      }
      if (/piso|radier|contrapiso/.test(text) && !hasEloConcreteUse_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso confirmar o uso do concreto.",
          fullAnswer: "Antes de calcular, confirme o uso: passeio, piso residencial, garagem ou ï¿½rea com carga pesada. Isso muda a premissa tï¿½cnica e o consumo recomendado.",
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
          shortAnswer: "Antes de calcular, preciso confirmar a dimensï¿½o do bloco.",
          fullAnswer: "Antes de calcular, preciso confirmar a dimensï¿½o real do bloco cerï¿½mico. Ele ï¿½ 29x19x14, 39x19x14 ou outra medida?",
          nextAction: "Informe a dimensï¿½o do bloco para eu calcular com seguranï¿½a.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_bloco_parede"
        };
      }
      if (masonryWallSubject && !hasEloWallLengthHeight_(text) && !/\d+(?:[,.]\d+)?\s*(?:m2|m\^2|mÂ²|metros?\s+quadrados?)/.test(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso do comprimento e da altura.",
          fullAnswer: "Antes de calcular a parede, informe comprimento e altura, ou a ï¿½rea em mï¿½. Ex.: parede 8 m x 3 m com bloco 39x19x14.",
          nextAction: "Informe comprimento x altura ou ï¿½rea da parede.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_medidas_parede"
        };
      }
      if (masonryWallSubject && !hasEloWallOpenings_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso saber se existem vÃ£os para descontar.",
          fullAnswer: "Antes de calcular, preciso saber se existem vÃ£os para descontar.\nA parede terÃ¡ portas ou janelas?\nSe sim, informe quantidade e medidas. Ex.:\n- 1 porta de 0,80 x 2,10 m\n- 2 janelas de 1,20 x 1,00 m\nOu confirme: parede Ã­ntegra, sem vÃ£os.",
          nextAction: "Informe portas/janelas com medidas ou confirme: parede Ã­ntegra, sem vÃ£os.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_vaos_parede"
        };
      }
      if (/chapisco|embo.o|emboco|reboco|revestimento/.test(text) && !hasEloWallCoatingSide_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso confirmar os lados do revestimento.",
          fullAnswer: "Vocï¿½ deseja considerar revestimento em um lado ou nos dois lados da parede?",
          nextAction: "Informe um lado ou dois lados para eu calcular o revestimento.",
          canSave: false,
          sessionTheme: "premissas_quantitativo",
          sessionIntent: "confirmar_lados_revestimento"
        };
      }
      if (masonryWallSubject && !hasEloLossPremise_(text)) {
        return {
          shortAnswer: "Antes de calcular, preciso confirmar a perda adotada.",
          fullAnswer: "Qual perda tï¿½cnica devo considerar? Se nï¿½o houver critï¿½rio prï¿½prio, posso usar 8% para alvenaria simples ou 10% quando houver muitos recortes e perdas de transporte.",
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
    return match ? match[1] + " MPa" : "nÃ£o informado";
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
        shortAnswer: "NÃ£o encontrei esse item no estoque atual.",
        fullAnswer: "NÃ£o encontrei esse item no estoque atual. Confira se o nome estÃ¡ cadastrado no Almoxarifado/Stock Full ou pergunte usando o nome do produto como aparece na lista.",
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
      "VocÃª tem " + quantity + " " + unit + " de " + (item.name || "item") + " no estoque atual.",
      "",
      "Resumo:",
      "- Saldo atual: " + quantity + " " + unit,
      "- Entradas registradas: " + formatEloStockQuantity_(item.entries || 0) + " " + unit,
      "- SaÃ­das registradas: " + formatEloStockQuantity_(item.exits || 0) + " " + unit
    ];
    if (minimum > 0) {
      lines.push("- Estoque mÃ­nimo: " + formatEloStockQuantity_(minimum) + " " + unit);
      if (Number(item.balance || item.realBalance || 0) < minimum) {
        lines.push("- Alerta: abaixo do estoque mÃ­nimo.");
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
      nextAction: "Se quiser, posso ajudar a conferir itens abaixo do mÃ­nimo ou prÃ³ximos do vencimento.",
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
        shortAnswer: "Eu ainda nÃ£o consegui calcular essa previsÃ£o tÃ©cnica.",
        fullAnswer: "Eu ainda nÃ£o consegui calcular essa previsÃ£o tÃ©cnica. Me informe o serviÃ§o com quantidade, por exemplo: parede de 40 mÂ², piso de 30 mÂ² ou laje de 60 mÂ².",
        nextAction: "Informe serviÃ§o, quantidade e unidade para eu cruzar Stock AI com Almoxarifado.",
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
          almoxLines.push("- " + (item.name || item.material || "Material") + ": nÃ£o encontrado no Almoxarifado.");
          return;
        }
        const available = roundEloOperationalQuantity_(match.balance || match.realBalance || 0);
        const missing = roundEloOperationalQuantity_(Math.max(required - available, 0));
        if (missing > 0) {
          hasInsufficient = true;
        }
        almoxLines.push("- " + (item.name || item.material || match.name || "Material") + ": disponÃ­vel " +
          formatEloOperationalQuantity_(available) + " " + formatEloOperationalDisplayUnit_(match.unit || item.unit || "un") +
          (missing > 0 ? " | faltam " + formatEloOperationalQuantity_(missing) + " " + formatEloOperationalDisplayUnit_(item.unit || match.unit || "un") : " | OK"));
      });
    }

    let resultTitle = "âœ… Saldo suficiente";
    let recommendation = "A obra pode executar esse serviÃ§o sem necessidade de compra.";
    if (!balances.length) {
      resultTitle = standaloneOperationalMode ? "Previsao tecnica de materiais" : "Almoxarifado sem saldo comparavel";
      recommendation = standaloneOperationalMode
        ? "Se quiser, informe precos locais para eu montar o orcamento preliminar."
        : "Cadastrar saldo no Almoxarifado antes de liberar compra ou execucao.";
    } else if (hasMissing) {
      resultTitle = "ðŸš¨ Material nÃ£o encontrado no Almoxarifado";
      recommendation = "Cadastrar o item ou transferir material antes de liberar a execuÃ§Ã£o.";
    } else if (hasInsufficient) {
      resultTitle = "âš ï¸ Material insuficiente";
      recommendation = "Comprar ou transferir o material faltante antes da execuÃ§Ã£o.";
    }

    return {
      shortAnswer: resultTitle,
      fullAnswer: [
        "ðŸ“ PrevisÃ£o Stock AI",
        "Fonte: " + sourceLabel,
        formatEloTechnicalBaseLine_(composition, allowPreliminary),
        predictedLines.join("\n"),
        formatEloQuantitativePremises_(message, [
          "ServiÃ§o considerado: " + ((prediction.service && (prediction.service.service || prediction.service.serviceType)) || "serviÃ§o tÃ©cnico"),
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
    const hasEvidenceRequest = /vistoria|fotos?|evidencia|evid.ncia|registro/.test(text);
    if (!wantsReport || (!hasPathology && !hasEvidenceRequest)) {
      return null;
    }
    const subject = hasAnyTerm(text, ["trinca", "fissura", "rachadura"]) || /trinca|fissura|rachadura/.test(text)
      ? "trinca/fissura"
      : hasAnyTerm(text, ["infiltracao", "umidade", "mofo", "vazamento"]) || /infiltra|umidade|mofo|vazamento/.test(text)
        ? "infiltracao/umidade"
        : hasAnyTerm(text, ["vistoria", "foto", "fotos"]) || /vistoria|fotos?/.test(text)
          ? "vistoria com fotos"
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
    const looksLikeDailyLog = hasAnyTerm(text, ["hoje", "ontem", "fizemos", "executamos", "foi feito", "lan?ar", "lancar", "diario", "rdo", "ocorrencia", "ocorrencia de atraso", "registrar ocorrencia", "chuva"]);
    const hasWork = hasAnyTerm(text, ["alvenaria", "reboco", "limpeza", "piso", "concreto", "concretagem", "laje", "forma", "armacao", "pintura", "obra", "equipe", "pedreiro", "servente", "material", "atraso"]);
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
    return /sinapi|orse|composi..o|composicao|alvenaria|parede|bloco|tijolo|chapisco|reboco|embo.o|emboco|concreto|\bfck\b|laje|contrapiso|\bpiso\b|rodape|rodap.|telha|telhado|produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|horas?|homens?-hora|\bbdi\b|custo|or.amento|orcamento|quantitativo|insumos?|a.o|aco|ca-50|funda..o|fundacao|viga|pilar|sapata|\bcasa\b|resid.ncia|residencia|mÂ²|m2|m3|mÂ³/.test(text);
  }

  function extractEloGeometryPair_(message) {
    const source = stripEloBlockDimensionTriples_(message || "");
    const match = source.match(/\b(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*(?:x|Ã—|\?|por)\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\b/i);
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
    const wantsVolume = /volume|m3|mÂ³|concreto|laje|radier|contrapiso/.test(text);
    const thickness = extractEloGeometryThicknessM_(message);
    if (wantsVolume && thickness && thickness.meters > 0) {
      const volume = area * thickness.meters;
      const needsFck = hasEloConcreteSubject_(text) && !hasEloConcreteFck_(text);
      const lines = [
        "Resposta principal",
        "Volume geomÃ©trico: " + formatEloWallPremiseMeasure_(volume, "mÂ³") + ".",
        "",
        "Premissas utilizadas:",
        "- Comprimento: " + formatEloWallPremiseMeasure_(pair.first, "m"),
        "- Largura: " + formatEloWallPremiseMeasure_(pair.second, "m"),
        "- Ãrea: " + formatEloWallPremiseMeasure_(area, "mÂ²"),
        "- Espessura: " + thickness.label,
        "",
        "Base tÃ©cnica utilizada",
        "- Geometria informada pelo usuÃ¡rio. SINAPI/ORSE nÃ£o Ã© necessÃ¡ria para calcular Ã¡rea ou volume geomÃ©trico.",
        "",
        "PrÃ³xima aÃ§Ã£o",
        needsFck ? "Antes de calcular consumo, mÃ£o de obra, produtividade ou custo, preciso confirmar o FCK do concreto e localizar composiÃ§Ã£o SINAPI/ORSE ou interna validada." : "Para consumo, mÃ£o de obra, produtividade, custo, cronograma ou curva ABC, preciso localizar composiÃ§Ã£o SINAPI/ORSE ou interna validada."
      ];
      return {
        shortAnswer: "Volume geomÃ©trico: " + formatEloWallPremiseMeasure_(volume, "mÂ³") + ".",
        fullAnswer: lines.join("\n"),
        nextAction: needsFck ? "Informe o FCK do concreto para avanÃ§ar para premissas e composiÃ§Ã£o." : "Informe a composiÃ§Ã£o SINAPI/ORSE ou as premissas tÃ©cnicas para avanÃ§ar.",
        canSave: false,
        sessionTheme: "geometria_obras",
        sessionIntent: "geometria_volume"
      };
    }
    if (wantsRodape) {
      const perimeter = 2 * (pair.first + pair.second);
      const lines = [
        "Resposta principal",
        "PerÃ­metro/metros lineares: " + formatEloWallPremiseMeasure_(perimeter, "m") + ".",
        "",
        "Premissas utilizadas:",
        "- Comprimento: " + formatEloWallPremiseMeasure_(pair.first, "m"),
        "- Largura: " + formatEloWallPremiseMeasure_(pair.second, "m"),
        "- CÃ¡lculo: 2 x (comprimento + largura)",
        "",
        "Base tÃ©cnica utilizada",
        "- Geometria informada pelo usuÃ¡rio. SINAPI/ORSE nÃ£o Ã© necessÃ¡ria para calcular metros lineares.",
        "",
        "PrÃ³xima aÃ§Ã£o",
        "Para orÃ§amento, produtividade, perdas ou custo do rodapÃ©, preciso localizar composiÃ§Ã£o SINAPI/ORSE ou interna validada."
      ];
      return {
        shortAnswer: "Metros lineares: " + formatEloWallPremiseMeasure_(perimeter, "m") + ".",
        fullAnswer: lines.join("\n"),
        nextAction: "Informe composiÃ§Ã£o ou padrÃ£o de rodapÃ© se quiser avanÃ§ar para orÃ§amento.",
        canSave: false,
        sessionTheme: "geometria_obras",
        sessionIntent: "geometria_metros_lineares"
      };
    }
    if (/area|Ã¡rea|m2|mÂ²|laje|piso|telhado|cobertura/.test(text)) {
      const lines = [
        "Resposta principal",
        "Ãrea geomÃ©trica: " + formatEloWallPremiseMeasure_(area, "mÂ²") + ".",
        "",
        "Premissas utilizadas:",
        "- Comprimento: " + formatEloWallPremiseMeasure_(pair.first, "m"),
        "- Largura: " + formatEloWallPremiseMeasure_(pair.second, "m"),
        "",
        "Base tÃ©cnica utilizada",
        "- Geometria informada pelo usuÃ¡rio. SINAPI/ORSE nÃ£o Ã© necessÃ¡ria para calcular Ã¡rea geomÃ©trica.",
        "",
        "PrÃ³xima aÃ§Ã£o",
        "Para consumo, mÃ£o de obra, produtividade, custo, cronograma ou curva ABC, preciso localizar composiÃ§Ã£o SINAPI/ORSE ou interna validada."
      ];
      return {
        shortAnswer: "Ãrea geomÃ©trica: " + formatEloWallPremiseMeasure_(area, "mÂ²") + ".",
        fullAnswer: lines.join("\n"),
        nextAction: "Informe premissas e composiÃ§Ã£o tÃ©cnica se quiser avanÃ§ar para orÃ§amento.",
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
    const hasGeometry = hasEloWallLengthHeight_(text) || /\d+(?:[,.]\d+)?\s*(?:m2|m\^2|mÂ²|metros?\s+quadrados?)/.test(text);
    if (hasGeometry) {
      return null;
    }
    const summary = formatEloWorkMemorySavedSummary_(project || getActiveEloWorkProject_());
    const answer = [
      "Lembrei da obra " + summary + ".",
      "Para calcular custo da alvenaria, preciso completar o serviÃ§o:",
      "- metragem ou Ã¡rea da parede;",
      "- dimensÃ£o do bloco;",
      "- vÃ£os de portas/janelas;",
      "- perda e revestimento;",
      "- base SINAPI/ORSE ou composiÃ§Ã£o interna validada.",
      "Sem essa composiÃ§Ã£o, nÃ£o gero custo oficial; posso apenas seguir para uma estimativa preliminar se vocÃª autorizar explicitamente como NÃƒO OFICIAL."
    ].join("\n");
    return {
      shortAnswer: "Preciso das premissas da alvenaria antes do custo.",
      fullAnswer: answer,
      nextAction: "Informe Ã¡rea ou comprimento x altura, bloco, vÃ£os, perda, revestimento e composiÃ§Ã£o SINAPI/ORSE.",
      canSave: false,
      sessionTheme: "base_tecnica_quantitativo",
      sessionIntent: "pedir_premissas_alvenaria"
    };
  }
  function buildEloConstructionTechnicalFallback_(message) {
    const text = normalizeText(message || "");
    const subject = /casa|resid.ncia|residencia/.test(text)
      ? "residÃªncia/obra completa"
      : /produtividade|equipe|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|horas?|homens?-hora/.test(text)
        ? "produtividade e mÃ£o de obra"
        : /sinapi|orse|composi..o|composicao/.test(text)
          ? "composiÃ§Ã£o tÃ©cnica"
          : "serviÃ§o de obra";
    const project = updateEloWorkMemoryFromMessage_(message);
    const conciseMissingPremises = buildEloConciseMissingServicePremisesAnswer_(message, project);
    if (conciseMissingPremises) {
      return conciseMissingPremises;
    }
    if (/produtividade|m.o\s+de\s+obra|mao\s+de\s+obra|pedreiro|servente|horas?|homens?-hora|equipe/.test(text)) {
      const summary = formatEloWorkMemorySavedSummary_(project || getActiveEloWorkProject_());
      const answer = [
        "Lembrei da obra " + summary + ".",
        "Para produtividade da equipe, preciso da composiÃ§Ã£o validada do serviÃ§o ou referÃªncia SINAPI/ORSE. Sem composiÃ§Ã£o, nÃ£o vou tratar produtividade, equipe, mÂ²/dia ou homens-hora como dado oficial.",
        "Posso continuar de duas formas: vocÃª informa a composiÃ§Ã£o validada ou autoriza explicitamente uma ESTIMATIVA NÃƒO OFICIAL."
      ].join("\n");
      return {
        shortAnswer: "Preciso de composiÃ§Ã£o validada para produtividade oficial.",
        fullAnswer: answer,
        nextAction: "Informe o serviÃ§o exato e a composiÃ§Ã£o SINAPI/ORSE, ou autorize estimativa NÃƒO OFICIAL.",
        canSave: false,
        sessionTheme: "base_tecnica_quantitativo",
        sessionIntent: "bloquear_produtividade_sem_composicao"
      };
    }
    const auditorAlerts = buildEloTechnicalAuditorAlerts_(message, { hasOfficialBase: false });
    const lines = [
      "Resposta principal",
      "Entendi que Ã© uma pergunta tÃ©cnica de obras sobre " + subject + ". NÃ£o vou calcular consumo, produtividade, mÃ£o de obra, custo, cronograma ou curva ABC sem composiÃ§Ã£o tÃ©cnica vÃ¡lida.",
      "",
      "MemÃ³ria de cÃ¡lculo:",
      "- NÃ£o hÃ¡ memÃ³ria de cÃ¡lculo oficial porque a composiÃ§Ã£o tÃ©cnica ainda nÃ£o foi localizada.",
      "- Se o pedido envolver apenas geometria, eu posso calcular Ã¡rea, volume, perÃ­metro ou Ã¡rea lÃ­quida com as medidas informadas.",
      "",
      "Premissas utilizadas:",
      "- ServiÃ§o solicitado: " + subject + ";",
      "- Quantidade, Ã¡rea, volume ou escopo: conforme informado pelo usuÃ¡rio e pela memÃ³ria de obra, ainda sujeito a conferÃªncia tÃ©cnica;",
      "- UF/mÃªs SINAPI/ORSE: " + ((project.uf && project.uf !== "nÃ£o informada") ? project.uf : "nÃ£o confirmado") + ";",
      "- PreÃ§os unitÃ¡rios: nÃ£o informados.",
      "",
      "MemÃ³ria permanente de obra",
      formatEloWorkMemoryLines_(project).join("\n"),
      "",
      "Base tÃ©cnica utilizada: nÃ£o localizada",
      "- Para cÃ¡lculo oficial, preciso de SINAPI, ORSE ou composiÃ§Ã£o interna validada com coeficientes positivos.",
      "",
      "Alertas do auditor:",
      (auditorAlerts.length ? auditorAlerts.join("\n") : "- Sem alerta crÃ­tico adicional com os dados informados. Ainda assim, valide premissas, projeto e responsabilidade tÃ©cnica antes de executar."),
      "",
      "PrÃ³xima aÃ§Ã£o recomendada",
      "Informe o cÃ³digo/composiÃ§Ã£o SINAPI/ORSE, envie a base oficial/importada ou autorize explicitamente uma ESTIMATIVA NÃƒO OFICIAL.",
      "",
      buildEloBudgetMvpScopeNotice_(),
      "",
      "NÃ£o vou inventar composiÃ§Ã£o, produtividade, mÃ£o de obra, insumos ou valor oficial sem essa base."
    ];
    return {
      shortAnswer: "Preciso tratar isso como pergunta tÃ©cnica de obras.",
      fullAnswer: lines.join("\n"),
      nextAction: "Informe as premissas do serviÃ§o ou o cÃ³digo/composiÃ§Ã£o SINAPI/ORSE para eu continuar.",
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
      fullAnswer: "Na memÃ³ria da obra atual tenho: " + summary + ".",
      nextAction: "FaÃ§a uma pergunta tÃ©cnica ou atualize algum dado da obra.",
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
    if (/que\s+saco|cansad[oa]|nao\s+funciona|n.o\s+funciona|frustrad[oa]|ta\s+dificil|t.\s+dif.cil/.test(text)) {
      return {
        shortAnswer: "Entendi. Vamos simplificar.",
        fullAnswer: "Entendi a frustracao. Vou reduzir isso para o proximo passo pratico, sem aprofundar tecnicamente automaticamente.",
        nextAction: "Diga em uma frase o que travou: orcamento, RDO, relatorio, CADISTA ou estoque.",
        canSave: false,
        sessionTheme: "acolhimento",
        sessionIntent: "apoio_pratico"
      };
    }
    if (/^(obrigado|obrigada|valeu|grato|grata)\b/.test(text)) {
      return {
        shortAnswer: "Por nada.",
        fullAnswer: "Por nada. Quando quiser, posso continuar pela obra atual ou responder outra dÃºvida tÃ©cnica.",
        nextAction: "Envie a prÃ³xima pergunta quando quiser.",
        canSave: false,
        sessionTheme: "conversa",
        sessionIntent: "agradecimento"
      };
    }
    if (/cadista|\bplanta\b|planta\s+baixa|terreno|quartos?|su.te|suite|garagem|ambientes?|prancha|dxf/.test(text)) {
      return {
        shortAnswer: "O CADISTA transforma dados de projeto em desenho tecnico.",
        fullAnswer: "Fluxo CADISTA/planta: vamos organizar terreno, ambientes, quartos, suite, garagem e premissas para projeto. Para gerar uma planta, preciso de terreno, programa de necessidades, pavimentos, recuos e saida desejada em PDF/DXF.",
        nextAction: "Informe terreno, quantidade de quartos, suite/garagem e se quer planta conceitual ou preparacao para PDF/DXF.",
        canSave: false,
        sessionTheme: "cadista",
        sessionIntent: "explicar_cadista"
      };
    }
    if (/quem\s+criou\s+voce|quem\s+criou\s+vocÃª/.test(text)) {
      return {
        shortAnswer: "Fui criado para apoiar seus projetos tÃ©cnicos.",
        fullAnswer: "Sou o Elo, assistente do ecossistema da WIA Engenharia para apoiar obras, relatÃ³rios, memÃ³ria tÃ©cnica e produtos como CADISTA e Stock.",
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
    return /trinca|fissura|rachadura|infiltra|umidade|mofo|vazamento|soltando\s+em\s+placas|reboco.*(soltando|caindo)|piso.*(oco|estufando)|ceramico.*(oco|estufando)|cerÃ¢mico.*(oco|estufando)|descascando|concreto.*(fraco|esfarelando)|\besfarelando\b|argamassa.{0,40}(virou|ficou).{0,20}(po|pÃ³)|virou\s+(po|pÃ³)|armadura\s+aparecendo|laje\s+cedendo|muro\s+inclinando|porta\s+emperrando|bolhas?\s+na\s+pintura|cheiro\s+de\s+esgoto|manchas?\s+brancas?|sem\s+caimento|empo[cÃ§]ando/.test(text);
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
    if (/so\s+os\s+materiais|só\s+os\s+materiais|materiais$|tabela\s+(?:propria\s+)?(?:sample|teste)|\bsample\b/.test(text)) {
      return {
        shortAnswer: /materiais/.test(text) ? "Posso separar uma lista de materiais sem valor." : "Tabela SAMPLE/TESTE nao pode virar preco real.",
        fullAnswer: /materiais/.test(text) ? "Para dizer só os materiais, uso quantitativo e premissa técnica sem valor financeiro. Informe o serviço e as dimensões; se houver base oficial/importada, eu separo insumos e coeficientes sem tratar como preço real." : "Posso usar tabela SAMPLE/TESTE apenas como base demonstrativa ou teste de integracao. Para orcamento real, preciso de base oficial/importada, composicao validada ou precos assumidos explicitamente como nao oficiais.",
        nextAction: /materiais/.test(text) ? "Informe serviço, dimensões e base de composição quando existir." : "Informe a base oficial ou confirme que e apenas teste/demonstracao.",
        canSave: false,
        sessionTheme: "orcamento_base_demonstrativa",
        sessionIntent: "bloquear_tabela_teste_como_real"
      };
    }
    if (!/^(quanto\s+custa(?:\s+tudo)?|quanto\s+vai\s+dar(?:\s+mais\s+ou\s+menos)?|qual\s+o\s+preco|qual\s+o\s+valor|custo\??|preco\??|valor\??)\??$/.test(text)) {
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
    const structuralRisk = /pilar|viga|laje\s+cedendo|fundacao|fundaÃ§Ã£o|rachadura\s+grande|muro\s+inclinando|armadura\s+aparecendo|meio\s+do\s+vao|meio\s+do\s+vÃ£o/.test(text);
    const moisture = /infiltra|umidade|mofo|vazamento|cheiro\s+de\s+esgoto|bolhas?\s+na\s+pintura|descascando/.test(text);
    const coating = /reboco|piso|revestimento|ceramico|cerÃ¢mico|argamassa|pintura|manchas?|contrapiso/.test(text);
    const causes = [];
    if (/trinca|fissura|rachadura/.test(text)) causes.push("movimentaÃ§Ã£o estrutural ou de alvenaria", "retraÃ§Ã£o/acomodaÃ§Ã£o", "falha em verga, contraverga, junta ou fundaÃ§Ã£o");
    if (moisture) causes.push("falha de impermeabilizaÃ§Ã£o", "entrada de Ã¡gua por cobertura/esquadria", "umidade ascendente ou vazamento oculto");
    if (coating) causes.push("base mal preparada", "argamassa inadequada ou cura insuficiente", "umidade por trÃ¡s do revestimento");
    if (/concreto|armadura/.test(text)) causes.push("cobrimento insuficiente", "corrosÃ£o de armadura", "concreto mal adensado ou degradado");
    if (!causes.length) causes.push("execuÃ§Ã£o inadequada", "movimentaÃ§Ã£o da base", "umidade ou falta de manutenÃ§Ã£o");
    const uniqueCauses = causes.filter(function (item, index) { return causes.indexOf(item) === index; }).slice(0, 4);
    const risk = structuralRisk
      ? "Risco potencialmente estrutural. Recomendo interromper intervenÃ§Ãµes no ponto, escorar se houver deformaÃ§Ã£o e chamar engenheiro responsÃ¡vel para vistoria presencial."
      : moisture
        ? "Risco de evoluÃ§Ã£o por umidade. A correÃ§Ã£o deve tratar a origem da Ã¡gua antes do acabamento."
        : "Risco inicialmente tÃ©cnico/de desempenho, mas precisa de vistoria para confirmar causa.";
    const answer = [
      "Triagem tÃ©cnica",
      "NÃ£o dÃ¡ para fechar diagnÃ³stico definitivo sem vistoria, mas os indÃ­cios merecem checagem.",
      "",
      "PossÃ­veis causas:",
      uniqueCauses.map(function (item) { return "- " + item + ";"; }).join("\n"),
      "",
      "O que verificar:",
      "- quando apareceu e se estÃ¡ aumentando;",
      "- presenÃ§a de Ã¡gua, som oco, deformaÃ§Ã£o, corrosÃ£o, destacamento ou fissuras prÃ³ximas;",
      "- fotos, medidas, localizaÃ§Ã£o e histÃ³rico de execuÃ§Ã£o/manutenÃ§Ã£o;",
      "- se hÃ¡ elemento estrutural envolvido: pilar, viga, laje, fundaÃ§Ã£o ou muro de contenÃ§Ã£o.",
      "",
      "Risco:",
      "- " + risk,
      "",
      "PrÃ³xima aÃ§Ã£o:",
      structuralRisk
        ? "- acione engenheiro/ responsÃ¡vel tÃ©cnico antes de reparar ou carregar a estrutura."
        : "- registre fotos, isole a origem provÃ¡vel e sÃ³ execute reparo depois de confirmar a causa."
    ].join("\n");
    return {
      shortAnswer: "Isso pede triagem tÃ©cnica antes de qualquer reparo.",
      fullAnswer: answer,
      nextAction: structuralRisk ? "Chame um engenheiro para vistoria presencial." : "Envie fotos, localizaÃ§Ã£o e histÃ³rico para afinar a triagem.",
      canSave: false,
      sessionTheme: "patologia_obras",
      sessionIntent: "triagem_patologia"
    };
  }
  function buildResponseCore_(question) {
    const cleanQuestion = sanitizeUserText(question);
    const normalizedQuestion = normalizeText(cleanQuestion);
    if (normalizedQuestion && isEloConstructionTechnicalQuestion_(cleanQuestion)) {
      updateEloWorkMemoryFromMessage_(cleanQuestion);
    }

    if (!normalizedQuestion) {
      return {
        shortAnswer: "Digite uma dÃºvida para eu ajudar.",
        fullAnswer: "Posso responder sobre relatÃ³rios, PDF, RDO, fotos, materiais, planos e suporte.",
        nextAction: "Escolha um botÃ£o rÃ¡pido ou escreva uma pergunta.",
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

    clearEloPendingContextIfTopicChanged_(cleanQuestion);

    const operationalEcosystemAnswer = buildEloOperationalEcosystemAnswer_(cleanQuestion);
    if (operationalEcosystemAnswer) {
      rememberEloBudgetSource_(cleanQuestion, operationalEcosystemAnswer, operationalEcosystemAnswer.fullAnswer || operationalEcosystemAnswer.shortAnswer || "");
      return operationalEcosystemAnswer;
    }

    const technicalProposalPackageAnswer = buildEloTechnicalProposalPackageResponse_(cleanQuestion);
    if (technicalProposalPackageAnswer) {
      rememberEloBudgetSource_(cleanQuestion, technicalProposalPackageAnswer, technicalProposalPackageAnswer.fullAnswer || technicalProposalPackageAnswer.shortAnswer || "");
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
    const earlyTechnicalReportDraftAnswer = buildEloTechnicalReportDraftAnswer_(cleanQuestion);
    if (earlyTechnicalReportDraftAnswer) {
      return earlyTechnicalReportDraftAnswer;
    }
    const residentialBudgetBriefingAnswer = buildEloResidentialBudgetBriefingAnswer_(cleanQuestion);
    if (residentialBudgetBriefingAnswer) {
      return residentialBudgetBriefingAnswer;
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
        shortAnswer: "Encontrei algo que vocÃª pediu para eu lembrar.",
        fullAnswer: saved.answer,
        nextAction: "Se quiser, posso continuar usando essa memÃ³ria local.",
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
      "o que estÃ¡ faltando",
      "o que esta pendente",
      "o que estÃ¡ pendente",
      "pendente",
      "incompleto",
      "esta incompleto",
      "estÃ¡ incompleto"
    ]);
    const nextStepQuestion = hasAnyTerm(normalizedQuestion, [
      "o que devo fazer agora",
      "proximo passo",
      "prÃ³ximo passo",
      "o que faco agora",
      "o que faÃ§o agora"
    ]);
    const canGeneratePdfQuestion = hasAnyTerm(normalizedQuestion, [
      "posso gerar o pdf",
      "posso gerar pdf",
      "esta pronto para pdf",
      "estÃ¡ pronto para pdf",
      "pode gerar pdf"
    ]);
    const canSaveQuestion = hasAnyTerm(normalizedQuestion, [
      "posso salvar",
      "pode salvar",
      "esta pronto para salvar",
      "estÃ¡ pronto para salvar",
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
        "âž¡ï¸ PrÃ³ximo passo: registre materiais no RDO ou carregue a Obra Exemplo para testar."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho producao lancada", "tenho produÃ§Ã£o lanÃ§ada", "producao lancada", "produÃ§Ã£o lanÃ§ada"])) {
      return buildOperationalPresenceResponse(
        "produÃ§Ã£o executada",
        context.production,
        ["nenhuma producao registrada", "nenhuma producao executada registrada"],
        "âž¡ï¸ PrÃ³ximo passo: registre a produÃ§Ã£o executada antes de revisar materiais e PDF."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho fotos anexadas", "foto anexada", "fotos anexadas", "tem foto"])) {
      return buildOperationalPresenceResponse(
        "fotos anexadas",
        context.photos,
        ["nenhuma foto", "0 fotos", "0"],
        "âž¡ï¸ PrÃ³ximo passo: adicione fotos para deixar o relatÃ³rio ou RDO mais completo."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["existe ocorrencia", "existe ocorrÃªncia", "tem ocorrencia", "tem ocorrÃªncia", "ocorrencia registrada", "ocorrÃªncia registrada"])) {
      return buildOperationalPresenceResponse(
        "ocorrÃªncia registrada",
        context.occurrences,
        ["nenhuma ocorrencia", "nenhuma ocorrÃªncia", "sem ocorrencia", "sem ocorrÃªncia"],
        "âž¡ï¸ PrÃ³ximo passo: se houve intercorrÃªncia, registre a descriÃ§Ã£o e as providÃªncias."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["qual foi o ultimo relatorio", "Ãºltimo relatÃ³rio", "ultimo relatorio"])) {
      return {
        shortAnswer: context.report ? "Ãšltimo relatÃ³rio visÃ­vel: " + context.report : "NÃ£o encontrei relatÃ³rio visÃ­vel nesta tela.",
        fullAnswer: context.report ? "âœ… RelatÃ³rio encontrado na tela atual." : getMissingVisibleDataMessage(),
        nextAction: context.report ? "Abra RelatÃ³rios para revisar ou gerar PDF." : "Abra Dashboard ou RelatÃ³rios para eu ler o histÃ³rico visÃ­vel.",
        canSave: false
      };
    }

    if (hasAnyTerm(normalizedQuestion, ["qual foi o ultimo rdo", "Ãºltimo rdo", "ultimo rdo", "ultimo diario", "Ãºltimo diÃ¡rio"])) {
      return {
        shortAnswer: context.diary ? "Ãšltimo RDO visÃ­vel: " + context.diary : "NÃ£o encontrei RDO visÃ­vel nesta tela.",
        fullAnswer: context.diary ? "âœ… RDO encontrado na tela atual." : getMissingVisibleDataMessage(),
        nextAction: context.diary ? "Abra o RDO para revisar produÃ§Ã£o, materiais, fotos e PDF." : "Abra DiÃ¡rio de Obras para eu ler os registros visÃ­veis.",
        canSave: false
      };
    }

    return null;
  }

  function getVisibleDataKnowledgeResponse(normalizedQuestion) {
    const context = getOperationalScreenContext();

    if (hasAnyTerm(normalizedQuestion, ["resuma esta tela", "resumo desta tela", "o que estou vendo", "o que tem aqui", "me de um resumo", "me dÃª um resumo"])) {
      return buildCurrentScreenSummaryResponse(context);
    }

    if (hasAnyTerm(normalizedQuestion, ["posso gerar pdf", "posso gerar o pdf", "esta pronto para pdf", "estÃ¡ pronto para pdf", "posso exportar", "falta algo antes do pdf"])) {
      return buildPdfReadinessResponse(context);
    }

    if (hasAnyTerm(normalizedQuestion, ["qual obra estou vendo", "qual obra", "obra atual", "ultima obra", "Ãºltima obra"])) {
      return buildVisibleSingleDataResponse("obra", context.work || context.clientWorks, "Abra Obras, RelatÃ³rios ou DiÃ¡rio de Obras para eu ler a obra visÃ­vel.", "obra");
    }

    if (hasAnyTerm(normalizedQuestion, ["qual cliente estou vendo", "qual cliente", "cliente atual"])) {
      return buildVisibleSingleDataResponse("cliente", context.client, "Abra Clientes, Obras ou RelatÃ³rios para eu ler o cliente visÃ­vel.", "cliente");
    }

    if (hasAnyTerm(normalizedQuestion, ["qual relatorio estou vendo", "qual relatÃ³rio estou vendo", "qual relatorio", "qual relatÃ³rio", "ultimo relatorio", "Ãºltimo relatÃ³rio", "qual foi o ultimo relatorio", "qual foi o Ãºltimo relatÃ³rio", "ultimo documento", "Ãºltimo documento"])) {
      return buildVisibleSingleDataResponse("relatÃ³rio", context.report || context.clientReports || context.clientDocs, "NÃ£o encontrei uma lista visÃ­vel de relatÃ³rios nesta tela.", "relatorio");
    }

    if (hasAnyTerm(normalizedQuestion, ["qual rdo estou vendo", "qual rdo", "ultimo rdo", "Ãºltimo rdo", "qual foi o ultimo rdo", "qual foi o Ãºltimo rdo"])) {
      return buildVisibleSingleDataResponse("RDO", context.diary || context.clientRdos, "NÃ£o encontrei uma lista visÃ­vel de RDOs nesta tela.", "rdo");
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho materiais registrados", "material registrado", "materiais registrados", "quantos materiais", "quantos materiais aparecem"])) {
      return buildVisibleCollectionResponse(
        "materiais",
        context.materials,
        context.materialCount,
        ["nenhum material registrado", "nenhum consumo registrado", "r$ 0,00"],
        "Abra a seÃ§Ã£o Materiais do RDO ou confira se os materiais foram preenchidos.",
        "materiais"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho producao lancada", "tenho produÃ§Ã£o lanÃ§ada", "producao lancada", "produÃ§Ã£o lanÃ§ada", "quantos registros de producao", "quantos registros de produÃ§Ã£o"])) {
      return buildVisibleCollectionResponse(
        "produÃ§Ã£o executada",
        context.production,
        context.productionCount,
        ["nenhuma producao registrada", "nenhuma producao executada registrada"],
        "Abra ProduÃ§Ã£o Executada no RDO ou confira se os dados foram preenchidos.",
        "materiais"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["tenho fotos anexadas", "foto anexada", "fotos anexadas", "quantas fotos", "tem foto"])) {
      return buildVisibleCollectionResponse(
        "fotos",
        context.photos,
        context.photoCount,
        ["nenhuma foto", "0 fotos", "0"],
        "Abra Fotos no relatÃ³rio ou RDO para eu ler anexos visÃ­veis.",
        "fotos"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["existem ocorrencias", "existem ocorrÃªncias", "existe ocorrencia", "existe ocorrÃªncia", "ocorrencias registradas", "ocorrÃªncias registradas"])) {
      const hasOccurrences = hasUsefulValue(context.occurrences) && !isEmptyScreenText(context.occurrences, ["nenhuma ocorrencia", "nenhuma ocorrÃªncia"]);
      return {
        shortAnswer: hasOccurrences ? "âœ… Encontrei ocorrÃªncia registrada visÃ­vel." : "âš ï¸ NÃ£o encontrei ocorrÃªncia registrada visÃ­vel.",
        fullAnswer: hasOccurrences ? context.occurrences : getMissingVisibleDataMessage(),
        nextAction: hasOccurrences ? "Revise descriÃ§Ã£o, providÃªncias e seguranÃ§a antes de salvar." : "Abra IntercorrÃªncias/SeguranÃ§a e confira se algo foi preenchido.",
        canSave: false,
        sessionTheme: "rdo",
        sessionIntent: "dados_visiveis"
      };
    }

    if (hasAnyTerm(normalizedQuestion, ["quais indicadores aparecem", "indicadores aparecem", "quais indicadores", "indicadores visiveis", "indicadores visÃ­veis"])) {
      return {
        shortAnswer: context.indicators.length ? "âœ… Encontrei indicadores visÃ­veis." : "âš ï¸ NÃ£o encontrei indicadores visÃ­veis.",
        fullAnswer: context.indicators.length ? context.indicators.join("\n") : getMissingVisibleDataMessage(),
        nextAction: context.indicators.length ? "Use esses nÃºmeros para decidir o prÃ³ximo registro ou revisÃ£o." : "Abra Dashboard, DiÃ¡rio ou PÃ¡gina do Cliente para ver indicadores.",
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
    const foundLines = found.length ? found.map(function (item) { return "âœ… " + item.label; }) : ["âš ï¸ NÃ£o encontrei dados preenchidos visÃ­veis."];
    const pendingLines = pending.length ? pending.map(function (item) { return "âš ï¸ " + item.label; }) : ["âœ… NÃ£o encontrei pendÃªncias visÃ­veis."];
    return {
      shortAnswer: "Resumo da tela atual.",
      fullAnswer: [
        "VocÃª estÃ¡ em: " + context.screen,
        "",
        "Encontrei:",
        foundLines.join("\n"),
        "",
        "PendÃªncias ou observaÃ§Ãµes:",
        pendingLines.join("\n")
      ].join("\n"),
      nextAction: checklist.nextAction.replace(/^âž¡ï¸\s*/, ""),
      canSave: false,
      sessionTheme: detectThemeFromScreen(context.screen),
      sessionIntent: "resumo_tela",
      diagnosticText: buildDiagnosticText(context, checklist)
    };
  }

  function buildPdfReadinessResponse(context) {
    const checklist = buildScreenChecklist(context);
    const relevant = checklist.items.filter(function (item) {
      return hasAnyTerm(normalizeText(item.label), ["cliente", "obra", "relatorio", "relatÃ³rio", "rdo", "fotos", "conclusao", "conclusÃ£o", "resumo", "botao", "botÃ£o"]);
    });
    const pending = (relevant.length ? relevant : checklist.items).filter(function (item) {
      return !item.done;
    });

    if (!pending.length && context.pdfAvailable) {
      return {
        shortAnswer: "âœ… Pronto para gerar PDF.",
        fullAnswer: "Pelo que estÃ¡ visÃ­vel, nÃ£o encontrei pendÃªncias crÃ­ticas antes do PDF.",
        nextAction: "Gere o PDF e revise o arquivo antes de entregar ao cliente.",
        canSave: false,
        sessionTheme: "pdf",
        sessionIntent: "revisao_pdf",
        diagnosticText: buildDiagnosticText(context, checklist)
      };
    }

    return {
      shortAnswer: "âš ï¸ Ainda recomendo revisar antes do PDF.",
      fullAnswer: pending.length ? pending.map(function (item) {
        return "âš ï¸ " + item.label;
      }).join("\n") : "âš ï¸ NÃ£o encontrei o botÃ£o/etapa de PDF visÃ­vel nesta tela.",
      nextAction: context.pdfAvailable ? "Revise os itens pendentes e entÃ£o gere o PDF." : "Abra a etapa Gerar/Encerramento para confirmar o botÃ£o de PDF.",
      canSave: false,
      sessionTheme: "pdf",
      sessionIntent: "revisao_pdf",
      diagnosticText: buildDiagnosticText(context, checklist)
    };
  }

  function buildVisibleSingleDataResponse(label, value, fallback, theme) {
    const hasValue = hasUsefulValue(value);
    return {
      shortAnswer: hasValue ? "âœ… " + capitalizeFirst(label) + " visÃ­vel: " + value : "âš ï¸ NÃ£o encontrei " + label + " visÃ­vel nesta tela.",
      fullAnswer: hasValue ? "Estou lendo apenas o que aparece na tela atual." : fallback,
      nextAction: hasValue ? "Use essa informaÃ§Ã£o para revisar o fluxo atual." : "Abra a seÃ§Ã£o correspondente ou confira se os dados foram preenchidos.",
      canSave: false,
      sessionTheme: theme,
      sessionIntent: "dados_visiveis"
    };
  }

  function buildVisibleCollectionResponse(label, value, count, emptyTerms, fallback, theme) {
    const hasValue = value && !isEmptyScreenText(value, emptyTerms || []);
    let shortAnswer = "âš ï¸ NÃ£o encontrei " + label + " visÃ­vel nesta tela.";
    let fullAnswer = fallback || getMissingVisibleDataMessage();
    if (count > 0) {
      shortAnswer = "âœ… Encontrei " + count + " item(ns) de " + label + " visÃ­veis.";
      fullAnswer = value || "A contagem foi feita pelos itens visÃ­veis da tela atual.";
    } else if (hasValue) {
      shortAnswer = "âœ… Encontrei sinais de " + label + " na tela.";
      fullAnswer = "Encontrei informaÃ§Ã£o visÃ­vel, mas nÃ£o consegui contar com seguranÃ§a.\n\n" + value;
    }
    return {
      shortAnswer: shortAnswer,
      fullAnswer: fullAnswer,
      nextAction: hasValue || count > 0 ? "Revise os itens antes de salvar ou gerar PDF." : "Abra a seÃ§Ã£o correspondente ou confira se os dados foram preenchidos.",
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
      shortAnswer: hasValue ? "Sim. Encontrei " + label + " na tela." : "NÃ£o encontrei " + label + " visÃ­vel agora.",
      fullAnswer: hasValue ? "âœ… " + value : getMissingVisibleDataMessage(),
      nextAction: hasValue ? "âž¡ï¸ Revise essa informaÃ§Ã£o antes de salvar ou gerar PDF." : emptyNextAction,
      canSave: false
    };
  }

  function buildOperationalChecklistResponse(context, intent) {
    const checklist = buildScreenChecklist(context);
    if (!checklist.items.length) {
      return {
        shortAnswer: "NÃ£o encontrei dados suficientes para revisar esta tela.",
        fullAnswer: getMissingVisibleDataMessage(),
        nextAction: "Abra a seÃ§Ã£o correspondente ou confira se os dados foram preenchidos.",
        canSave: false
      };
    }

    const found = checklist.items.filter(function (item) { return item.done; });
    const pending = checklist.items.filter(function (item) { return !item.done; });
    const foundLines = found.length ? found.map(function (item) {
      return "âœ… " + item.label;
    }) : ["âš ï¸ NÃ£o encontrei itens preenchidos visÃ­veis."];
    const pendingLines = pending.length ? pending.map(function (item) {
      return "âš ï¸ " + item.label;
    }) : ["âœ… NÃ£o encontrei pendÃªncias visÃ­veis."];
    let shortAnswer = "Revisei o que estÃ¡ visÃ­vel.";
    if (intent.pdf) {
      shortAnswer = pending.length ? "Ainda recomendo revisar antes do PDF." : "Pelo que estÃ¡ visÃ­vel, vocÃª pode avanÃ§ar para o PDF.";
    } else if (intent.save) {
      shortAnswer = pending.length ? "VocÃª pode salvar, mas hÃ¡ pontos para revisar." : "Pelo que estÃ¡ visÃ­vel, estÃ¡ pronto para salvar.";
    } else if (intent.nextStep) {
      shortAnswer = "PrÃ³ximo passo sugerido:";
    } else if (intent.missing) {
      shortAnswer = pending.length ? "Ainda hÃ¡ itens pendentes." : "NÃ£o encontrei pendÃªncias visÃ­veis.";
    }

    return {
      shortAnswer: shortAnswer,
      fullAnswer: [
        "VocÃª estÃ¡ em: " + context.screen,
        "",
        "Encontrei:",
        foundLines.join("\n"),
        "",
        "PendÃªncias:",
        pendingLines.join("\n"),
        "",
        "âž¡ï¸ PrÃ³ximo passo recomendado:",
        checklist.nextAction
      ].join("\n"),
      nextAction: checklist.nextAction.replace(/^âž¡ï¸\s*/, ""),
      canSave: false,
      diagnosticText: buildDiagnosticText(context, checklist)
    };
  }

  function buildDiagnosticText(context, checklist) {
    const items = checklist && Array.isArray(checklist.items) ? checklist.items : [];
    const found = items.filter(function (item) { return item.done; });
    const pending = items.filter(function (item) { return !item.done; });
    const foundLines = found.length ? found.map(function (item) {
      return "âœ… " + item.label;
    }) : ["âš ï¸ Nenhum item preenchido visÃ­vel."];
    const pendingLines = pending.length ? pending.map(function (item) {
      return "âš ï¸ " + item.label;
    }) : ["âœ… Nenhuma pendÃªncia visÃ­vel."];
    const nextAction = checklist && checklist.nextAction ? checklist.nextAction : "âž¡ï¸ Revise a tela atual antes de finalizar.";

    return [
      "DIAGNÃ“STICO â€” ELO ASSISTENTE OBRAREPORT",
      "",
      "Contexto atual:",
      context && context.screen ? context.screen : "Tela atual nÃ£o identificada",
      "",
      "Data/hora:",
      new Date().toLocaleString("pt-BR"),
      "",
      "Itens encontrados:",
      foundLines.join("\n"),
      "",
      "PendÃªncias:",
      pendingLines.join("\n"),
      "",
      "PrÃ³ximo passo recomendado:",
      nextAction,
      "",
      "Origem:",
      "Gerado pelo Elo Assistente ObraReport"
    ].join("\n");
  }

  function buildScreenChecklist(context) {
    const label = context.screen;
    if (label === "DiÃ¡rio de Obras") {
      const items = [
        { label: "Data do RDO", done: hasUsefulValue(context.dailyDate) },
        { label: "Obra vinculada", done: hasUsefulValue(context.work) },
        { label: "ResponsÃ¡vel preenchido", done: hasUsefulValue(context.dailyResponsible) },
        { label: "Equipe registrada", done: hasUsefulValue(context.team) },
        { label: "ServiÃ§os executados", done: hasUsefulValue(context.services) },
        { label: "ProduÃ§Ã£o executada", done: hasUsefulValue(context.production) && !isEmptyScreenText(context.production, ["nenhuma producao"]) },
        { label: "Materiais consumidos", done: hasUsefulValue(context.materials) && !isEmptyScreenText(context.materials, ["nenhum material", "r$ 0,00"]) },
        { label: "OcorrÃªncias/seguranÃ§a revisadas", done: hasUsefulValue(context.occurrences) },
        { label: "Fotos anexadas", done: hasUsefulValue(context.photos) && !isEmptyScreenText(context.photos, ["nenhuma foto", "0 fotos"]) },
        { label: "Resumo preenchido", done: hasUsefulValue(context.summary) }
      ];
      return {
        items: items,
        nextAction: getFirstPendingAction(items, {
          "ProduÃ§Ã£o executada": "âž¡ï¸ PrÃ³ximo passo: registre a produÃ§Ã£o executada antes de gerar o resumo.",
          "Materiais consumidos": "âž¡ï¸ PrÃ³ximo passo: lance os materiais consumidos para apoiar a auditoria.",
          "Resumo preenchido": "âž¡ï¸ PrÃ³ximo passo: gere ou escreva o resumo executivo antes do PDF.",
          "Fotos anexadas": "âž¡ï¸ PrÃ³ximo passo: adicione fotos se quiser uma entrega mais completa."
        }, "âž¡ï¸ PrÃ³ximo passo: salvar o diÃ¡rio e gerar o PDF do RDO.")
      };
    }

    if (label === "RelatÃ³rios") {
      const items = [
        { label: "Cliente selecionado", done: hasUsefulValue(context.client) },
        { label: "Obra vinculada", done: hasUsefulValue(context.work) || hasUsefulValue(context.reportWork) },
        { label: "TÃ­tulo/dados do relatÃ³rio", done: hasUsefulValue(context.report) || hasUsefulValue(context.reportWork) },
        { label: "Fotos adicionadas", done: hasUsefulValue(context.photos) && !isEmptyScreenText(context.photos, ["0 fotos", "nenhuma foto"]) },
        { label: "ConclusÃ£o tÃ©cnica", done: hasUsefulValue(context.conclusion) },
        { label: "BotÃ£o de PDF disponÃ­vel", done: context.pdfAvailable }
      ];
      return {
        items: items,
        nextAction: getFirstPendingAction(items, {
          "Fotos adicionadas": "âž¡ï¸ PrÃ³ximo passo: adicione fotos antes de gerar o PDF para deixar o relatÃ³rio mais completo.",
          "ConclusÃ£o tÃ©cnica": "âž¡ï¸ PrÃ³ximo passo: revise ou gere a conclusÃ£o tÃ©cnica.",
          "BotÃ£o de PDF disponÃ­vel": "âž¡ï¸ PrÃ³ximo passo: avance atÃ© a etapa Gerar."
        }, "âž¡ï¸ PrÃ³ximo passo: gerar o PDF profissional.")
      };
    }

    if (label === "Planos") {
      const items = [
        { label: "Plano atual/uso visÃ­vel", done: hasUsefulValue(context.usage) },
        { label: "Limites visÃ­veis", done: hasUsefulValue(context.usage) || hasUsefulValue(context.plans) },
        { label: "ContrataÃ§Ã£o assistida visÃ­vel", done: hasUsefulValue(context.contracting) },
        { label: "WhatsApp/proposta disponÃ­vel", done: hasUsefulValue(context.plans) && hasAnyTerm(normalizeText(context.plans), ["whatsapp", "solicitar", "contratar", "proposta"]) }
      ];
      return {
        items: items,
        nextAction: "âž¡ï¸ PrÃ³ximo passo: se quiser vender manualmente, use o botÃ£o de WhatsApp do plano desejado."
      };
    }

    if (label === "Dashboard" || label === "Home") {
      const items = [
        { label: "Clientes visÃ­veis", done: hasMetricValue(context, "Clientes") },
        { label: "Obras visÃ­veis", done: hasMetricValue(context, "Obras") },
        { label: "RelatÃ³rios visÃ­veis", done: hasMetricValue(context, "Relatorios") },
        { label: "RDOs visÃ­veis", done: hasMetricValue(context, "RDOs") },
        { label: "Fotos/PDFs visÃ­veis", done: hasUsefulValue(context.indicators.join(" ")) },
        { label: "AÃ§Ãµes rÃ¡pidas disponÃ­veis", done: hasUsefulValue(context.quickActions) }
      ];
      return {
        items: items,
        nextAction: "âž¡ï¸ PrÃ³ximo passo: escolha RDO, RelatÃ³rio ou Obra Exemplo para testar o fluxo."
      };
    }

    if (label === "PÃ¡gina do Cliente") {
      const items = [
        { label: "Obra vinculada", done: hasUsefulValue(context.clientWorks) || hasMetricValue(context, "Obras cliente") },
        { label: "Ãšltimo relatÃ³rio visÃ­vel", done: hasUsefulValue(context.clientReports) || hasMetricValue(context, "Relatorios cliente") },
        { label: "Ãšltimo RDO visÃ­vel", done: hasUsefulValue(context.clientRdos) || hasMetricValue(context, "RDOs cliente") },
        { label: "Documentos/PDFs visÃ­veis", done: hasUsefulValue(context.clientDocs) || hasMetricValue(context, "PDFs cliente") },
        { label: "Suporte visÃ­vel", done: hasUsefulValue(context.supportText) }
      ];
      return {
        items: items,
        nextAction: "âž¡ï¸ PrÃ³ximo passo: abra Minha obra, Meus relatÃ³rios ou Documentos para consultar o material disponÃ­vel."
      };
    }

    return {
      items: [
        { label: "Contexto atual identificado", done: hasUsefulValue(context.screen) },
        { label: "Dados visÃ­veis suficientes", done: hasUsefulValue(context.work) || hasUsefulValue(context.client) || hasUsefulValue(context.report) || context.indicators.length > 0 }
      ],
      nextAction: "âž¡ï¸ PrÃ³ximo passo: abra RelatÃ³rios, DiÃ¡rio de Obras, Dashboard ou Planos para uma revisÃ£o mais completa."
    };
  }

  function getFirstPendingAction(items, actionMap, fallback) {
    const pending = items.find(function (item) {
      return !item.done;
    });
    if (!pending) {
      return fallback;
    }
    return actionMap[pending.label] || "âž¡ï¸ PrÃ³ximo passo: preencher " + pending.label.toLowerCase() + ".";
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
    return "NÃ£o encontrei essa informaÃ§Ã£o na tela atual. Abra a seÃ§Ã£o correspondente ou confira se os dados foram preenchidos.";
  }

  function getGuidedStepResponse(normalizedQuestion) {
    if (hasAnyTerm(normalizedQuestion, ["como gerar pdf", "gerar pdf", "criar pdf", "baixar pdf", "exportar pdf"])) {
      return buildStepResponse(
        "Para gerar um PDF:",
        [
          "Abra o relatÃ³rio ou o DiÃ¡rio de Obras desejado.",
          "Confira cliente, obra, fotos, produÃ§Ã£o, materiais e conclusÃ£o.",
          "Clique em Gerar PDF ou Gerar PDF do DiÃ¡rio.",
          "Aguarde a visualizaÃ§Ã£o ou janela de impressÃ£o do navegador.",
          "Salve o arquivo ou envie ao cliente pelo fluxo de compartilhamento."
        ],
        "Se a janela nÃ£o abrir, verifique se o navegador bloqueou pop-ups.",
        "Quer que eu explique tambÃ©m como enviar o resumo por WhatsApp?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como criar relatorio", "criar relatorio", "novo relatorio", "fazer relatorio"])) {
      return buildStepResponse(
        "Para criar um relatÃ³rio tÃ©cnico:",
        [
          "Cadastre ou selecione um cliente.",
          "Cadastre ou selecione a obra vinculada.",
          "Abra RelatÃ³rios e preencha o nome do relatÃ³rio.",
          "Adicione fotos, ocorrÃªncias, anÃ¡lise tÃ©cnica e conclusÃ£o.",
          "Revise o conteÃºdo e gere o PDF profissional."
        ],
        "O relatÃ³rio precisa estar vinculado a uma obra para ficar organizado corretamente.",
        "Se quiser testar rÃ¡pido, use a Obra Exemplo."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como criar rdo", "criar rdo", "novo rdo", "fazer rdo", "diario de obra", "diario de obras"])) {
      return buildStepResponse(
        "Para criar um RDO:",
        [
          "Abra DiÃ¡rio de Obras.",
          "Selecione a obra vinculada.",
          "Preencha data, responsÃ¡vel, clima, equipe e serviÃ§os.",
          "Registre produÃ§Ã£o executada, materiais, ocorrÃªncias e fotos.",
          "Salve o diÃ¡rio e gere o PDF do DiÃ¡rio se precisar entregar."
        ],
        "O RDO funciona melhor quando produÃ§Ã£o e materiais sÃ£o preenchidos no mesmo registro.",
        "Quer que eu explique como lanÃ§ar materiais no RDO?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como adicionar materiais", "como adiciono materiais", "adicionar material", "registrar materiais", "lancar materiais", "lanÃ§ar materiais"])) {
      return buildStepResponse(
        "Para adicionar materiais:",
        [
          "Abra DiÃ¡rio de Obras.",
          "VÃ¡ atÃ© a seÃ§Ã£o Materiais.",
          "Informe material, quantidade, unidade, valor unitÃ¡rio e observaÃ§Ã£o.",
          "Clique em Adicionar material.",
          "Confira o resumo e o total de materiais consumidos."
        ],
        "Se vocÃª tambÃ©m registrar ProduÃ§Ã£o Executada, o ObraReport ajuda na auditoria de consumo.",
        "Depois disso, pergunte: como funciona auditoria de consumo?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como enviar whatsapp", "enviar whatsapp", "resumo por whatsapp", "whatsapp"])) {
      return buildStepResponse(
        "Para enviar por WhatsApp:",
        [
          "Abra o RDO ou relatÃ³rio que deseja compartilhar.",
          "Confira obra, cliente, produÃ§Ã£o, materiais e ocorrÃªncias.",
          "Clique no botÃ£o de WhatsApp.",
          "Revise a mensagem pronta antes de enviar.",
          "Envie pelo WhatsApp Web ou aplicativo do dispositivo."
        ],
        "O ObraReport abre uma mensagem preenchida. NÃ£o hÃ¡ API oficial de WhatsApp integrada nesta versÃ£o.",
        "Quer que eu explique tambÃ©m o envio por e-mail preenchido?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como funciona auditoria", "como audito", "audito", "auditar", "auditoria de consumo", "usar auditoria", "auditoria materiais"])) {
      return buildStepResponse(
        "A auditoria de consumo funciona assim:",
        [
          "Registre a ProduÃ§Ã£o Executada no RDO.",
          "Cadastre ou use composiÃ§Ãµes de materiais.",
          "Lance os materiais realmente consumidos.",
          "Clique para calcular materiais estimados, quando disponÃ­vel.",
          "Compare estimado, registrado e diferenÃ§a na auditoria."
        ],
        "Ela Ã© uma conferÃªncia operacional simples, nÃ£o substitui orÃ§amento tÃ©cnico completo ou mediÃ§Ã£o formal.",
        "Para testar, carregue a Obra Exemplo e abra DiÃ¡rio de Obras."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["plano profissional", "como funciona o plano profissional"])) {
      return buildStepResponse(
        "O plano Profissional Ã© indicado para uso individual ou equipe pequena:",
        [
          "VocÃª usa o ObraReport para clientes, obras, relatÃ³rios e RDOs.",
          "Gera PDFs profissionais para entrega.",
          "Usa materiais, produÃ§Ã£o executada e apoio do Elo.",
          "Solicita acesso pelo WhatsApp.",
          "A ativaÃ§Ã£o Ã© assistida nesta fase inicial."
        ],
        "NÃ£o existe checkout automÃ¡tico ativo nesta fase.",
        "Abra Planos para confirmar limites e solicitar acesso."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["plano empresa", "como funciona o plano empresa"])) {
      return buildStepResponse(
        "O plano Empresa Ã© indicado para construtoras, escritÃ³rios e equipes:",
        [
          "Organiza mÃºltiplas obras e usuÃ¡rios.",
          "Centraliza relatÃ³rios, RDOs e materiais.",
          "Apoia auditoria de consumo e histÃ³rico tÃ©cnico.",
          "Inclui suporte prioritÃ¡rio e implantaÃ§Ã£o assistida.",
          "A contrataÃ§Ã£o comeÃ§a por proposta via WhatsApp."
        ],
        "A ativaÃ§Ã£o Ã© assistida para configurar o primeiro acesso corretamente.",
        "Abra Planos e use Solicitar proposta."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como ver minha obra", "ver minha obra", "onde vejo obra", "abrir obra"])) {
      return buildStepResponse(
        "Para ver sua obra:",
        [
          "Abra o menu Obras para consultar obras cadastradas.",
          "No Dashboard, confira o card de obras em andamento.",
          "Em RelatÃ³rios ou DiÃ¡rio de Obras, selecione a obra vinculada.",
          "Use a Obra Exemplo se quiser testar sem dados reais.",
          "Se a obra nÃ£o aparecer, verifique se ela foi cadastrada no cliente correto."
        ],
        "O Elo tambÃ©m consegue ler a obra selecionada quando ela estÃ¡ visÃ­vel na tela.",
        "Pergunte: qual obra estou vendo?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["como salvar", "sincronizar", "salvar dados", "salvamento", "sincronizacao", "sincronizaÃ§Ã£o"])) {
      return buildStepResponse(
        "Sobre salvar e sincronizar:",
        [
          "Preencha os dados da tela atual.",
          "Use o botÃ£o Salvar quando ele aparecer no formulÃ¡rio.",
          "Aguarde o status de salvamento/local da tela.",
          "Confira se o item aparece na lista ou histÃ³rico.",
          "Evite limpar o navegador se estiver usando dados locais."
        ],
        "Algumas informaÃ§Ãµes do Elo ficam apenas neste navegador. Exporte backup do Elo quando quiser preservar memÃ³rias, biblioteca, projetos e objetivos.",
        "Se algo nÃ£o salvar, pergunte: nÃ£o consigo salvar."
      );
    }

    return null;
  }

  function getDiagnosticStepResponse(normalizedQuestion) {
    if (hasAnyTerm(normalizedQuestion, ["pdf nao gerou", "pdf nÃ£o gerou", "pdf nao abre", "pdf nÃ£o abre", "erro no pdf"])) {
      return buildStepResponse(
        "Se o PDF nÃ£o gerou:",
        [
          "Verifique se hÃ¡ cliente e obra selecionados.",
          "Confira se o relatÃ³rio ou RDO possui conteÃºdo preenchido.",
          "Libere pop-ups ou janelas novas no navegador.",
          "Tente gerar novamente.",
          "Se persistir, entre em contato pelo suporte."
        ],
        "A falha ao abrir o PDF normalmente nÃ£o apaga o conteÃºdo preenchido.",
        "Quer que eu explique o fluxo correto para gerar PDF?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["nao consigo salvar", "nÃ£o consigo salvar", "erro ao salvar", "nao salvou", "nÃ£o salvou"])) {
      return buildStepResponse(
        "Se nÃ£o conseguiu salvar:",
        [
          "Confira se os campos obrigatÃ³rios estÃ£o preenchidos.",
          "Verifique se cliente e obra foram selecionados.",
          "Observe a mensagem de status da tela.",
          "Tente salvar novamente sem recarregar a pÃ¡gina.",
          "Se o problema continuar, copie as informaÃ§Ãµes importantes antes de fechar."
        ],
        "Eu nÃ£o altero seus dados; apenas oriento com base na tela atual.",
        "Pergunte qual obra ou RDO estou vendo para conferir o contexto."
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["foto nao aparece", "foto nÃ£o aparece", "foto sumiu", "imagem nao aparece", "imagem nÃ£o aparece"])) {
      return buildStepResponse(
        "Se a foto nÃ£o aparece:",
        [
          "Confirme se o arquivo Ã© JPEG, PNG ou WebP.",
          "Veja se a foto foi adicionada depois da seleÃ§Ã£o.",
          "Confira se estÃ¡ na etapa correta de Fotos.",
          "Evite arquivos muito pesados.",
          "Tente adicionar novamente e salvar o relatÃ³rio ou RDO."
        ],
        "Fotos locais dependem do navegador enquanto o registro estÃ¡ sendo preparado.",
        "Quer que eu explique como adicionar fotos?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["rdo sumiu", "diario sumiu", "nÃ£o acho o rdo", "nao acho o rdo", "rdo nao aparece"])) {
      return buildStepResponse(
        "Se o RDO nÃ£o aparece:",
        [
          "Abra DiÃ¡rio de Obras.",
          "Confira se a obra correta estÃ¡ selecionada.",
          "Veja a lista Registros do DiÃ¡rio.",
          "Limpe o campo de busca de produÃ§Ã£o, se estiver preenchido.",
          "Se usou outro navegador/dispositivo, o dado local pode nÃ£o estar disponÃ­vel ali."
        ],
        "Nesta fase, alguns dados podem depender do armazenamento local do navegador.",
        "Pergunte: qual RDO estou vendo?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["whatsapp nao abriu", "whatsapp nÃ£o abriu", "erro whatsapp", "whatsapp nao funciona"])) {
      return buildStepResponse(
        "Se o WhatsApp nÃ£o abriu:",
        [
          "Confira se o navegador permitiu abrir nova aba.",
          "Verifique se hÃ¡ WhatsApp Web ou aplicativo configurado.",
          "Revise se o RDO possui informaÃ§Ãµes para montar a mensagem.",
          "Tente clicar novamente no botÃ£o de WhatsApp.",
          "Se necessÃ¡rio, copie o resumo manualmente."
        ],
        "O ObraReport usa abertura de mensagem pronta, nÃ£o API oficial do WhatsApp.",
        "Quer que eu explique o envio por WhatsApp?"
      );
    }

    if (hasAnyTerm(normalizedQuestion, ["plano nao mudou", "plano nÃ£o mudou", "upgrade nao mudou", "upgrade nÃ£o mudou", "plano nao atualizou"])) {
      return buildStepResponse(
        "Se o plano nÃ£o mudou:",
        [
          "Abra a tela Planos.",
          "Confira o plano e o uso atual exibidos.",
          "Lembre que a ativaÃ§Ã£o Ã© assistida nesta fase.",
          "Fale pelo WhatsApp para solicitar ajuste de acesso.",
          "Aguarde confirmaÃ§Ã£o antes de considerar o plano ativo."
        ],
        "NÃ£o hÃ¡ checkout automÃ¡tico integrado nesta versÃ£o.",
        "Abra Planos e use o botÃ£o de contrataÃ§Ã£o assistida."
      );
    }

    return null;
  }

  function buildStepResponse(shortAnswer, steps, note, nextAction) {
    return {
      shortAnswer: shortAnswer,
      fullAnswer: steps.map(function (step, index) {
        return (index + 1) + ". " + step;
      }).join("\n") + (note ? "\n\nObservaÃ§Ã£o: " + note : ""),
      nextAction: nextAction,
      canSave: true
    };
  }

  const ELO_CONVERSATION_INTENTS = [
    {
      intent: "saudacao",
      phrases: ["oi", "ola", "olÃ¡", "e ai", "e aÃ­", "opa", "salve", "alo", "alÃ´"]
    },
    {
      intent: "como_esta",
      phrases: ["como voce esta", "como vocÃª estÃ¡", "como esta", "como estÃ¡", "como vai", "tudo bem", "tudo certo", "voce esta bem", "vocÃª estÃ¡ bem", "tudo tranquilo", "como esta hoje"]
    },
    {
      intent: "agradecimento",
      phrases: ["obrigado", "obrigada", "valeu", "muito obrigado", "muito obrigada", "agradecido", "perfeito obrigado", "show obrigado"]
    },
    {
      intent: "despedida",
      phrases: ["tchau", "ate mais", "atÃ© mais", "ate logo", "atÃ© logo", "falou", "encerrar", "vou sair", "bom descanso", "boa noite ate amanha", "boa noite atÃ© amanhÃ£"]
    },
    {
      intent: "identidade",
      phrases: ["quem e voce", "quem Ã© vocÃª", "qual seu nome", "qual e seu nome", "qual Ã© seu nome", "o que e o elo", "o que Ã© o elo", "voce e quem", "vocÃª Ã© quem", "quem esta falando", "quem estÃ¡ falando", "voce e uma pessoa", "vocÃª Ã© uma pessoa", "voce e humano", "vocÃª Ã© humano"]
    },
    {
      intent: "capacidades",
      phrases: ["o que voce faz", "o que vocÃª faz", "o que voce consegue fazer", "o que vocÃª consegue fazer", "em que voce ajuda", "em que vocÃª ajuda", "para que serve", "voce pode me ajudar", "vocÃª pode me ajudar", "como voce pode me ajudar", "como vocÃª pode me ajudar", "o que voce sabe sobre o obrareport", "o que vocÃª sabe sobre o obrareport"]
    },
    {
      intent: "funcionamento",
      phrases: ["como funciona o elo", "como voce funciona", "como vocÃª funciona", "como o elo funciona", "como usar o elo", "voce usa ia", "vocÃª usa ia"]
    },
    {
      intent: "apoio_pratico",
      phrases: ["estou cansado", "estou cansada", "estou com pressa", "estou perdido", "estou perdida", "nao entendi", "nÃ£o entendi", "estou confuso", "estou confusa", "ta dificil", "tÃ¡ difÃ­cil", "esta complicado", "estÃ¡ complicado"]
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
        shortAnswer: "OlÃ¡. Estou aqui para conversar, organizar ideias e acompanhar suas memÃ³rias locais.",
        fullAnswer: "Posso ajudar com projetos, objetivos, linha do tempo, biblioteca, conceitos humanos e reflexÃµes simples.",
        nextAction: "Diga se quer conversar, registrar algo ou revisar seus projetos."
      },
      como_esta: {
        shortAnswer: "Estou funcionando normalmente por aqui.",
        fullAnswer: "NÃ£o tenho emoÃ§Ãµes ou consciÃªncia humana, mas consigo responder com calma e consultar suas informaÃ§Ãµes locais autorizadas.",
        nextAction: "Quer organizar uma ideia, um projeto ou uma memÃ³ria?"
      },
      identidade: {
        shortAnswer: "Eu sou o Elo, um assistente digital pessoal.",
        fullAnswer: "NÃ£o sou uma pessoa e nÃ£o tenho consciÃªncia humana. Nesta pÃ¡gina, funciono como companheiro digital local para conversar, organizar projetos, guardar memÃ³rias autorizadas e consultar conceitos.",
        nextAction: "Pergunte: o que vocÃª lembra de mim?"
      },
      capacidades: {
        shortAnswer: "Posso ajudar vocÃª a organizar ideias, projetos, memÃ³rias e prÃ³ximos passos.",
        fullAnswer: "TambÃ©m posso manter uma Biblioteca local, registrar Linha do Tempo, responder sobre conceitos humanos e consultar dados salvos apenas neste navegador.",
        nextAction: "Experimente: quais sÃ£o meus projetos?"
      },
      funcionamento: {
        shortAnswer: "Eu funciono localmente neste navegador.",
        fullAnswer: "Uso regras, memÃ³rias autorizadas, Biblioteca, Projetos, Linha do Tempo e Conceitos. NÃ£o envio essa conversa para backend nesta versÃ£o.",
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
          shortAnswer: "OlÃ¡. Como posso ajudar vocÃª no ObraReport hoje?",
          fullAnswer: "Posso orientar relatÃ³rios, RDO, materiais, planos e revisÃ£o da tela atual.",
          nextAction: "Diga se quer revisar algo ou tirar uma dÃºvida.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Oi. Estou por aqui para ajudar com o ObraReport.",
          fullAnswer: "Consigo responder dÃºvidas, sugerir prÃ³ximos passos e consultar documentos locais do Elo.",
          nextAction: "VocÃª pode perguntar: o que devo fazer agora?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "OlÃ¡. Quer revisar algo no sistema ou tirar uma dÃºvida?",
          fullAnswer: "Eu mantenho o foco no ObraReport: RDO, relatÃ³rios, PDF, materiais, planos e documentos locais.",
          nextAction: "Escolha uma Ã¡rea ou escreva sua dÃºvida.",
          sessionTheme: "suporte"
        }
      ],
      como_esta: [
        {
          shortAnswer: "Estou funcionando normalmente aqui no ObraReport.",
          fullAnswer: "NÃ£o tenho emoÃ§Ãµes ou consciÃªncia, mas consigo acompanhar a tela atual e responder de forma prÃ¡tica.",
          nextAction: "Quer que eu revise a tela atual?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Tudo certo por aqui. Posso te ajudar com o prÃ³ximo passo.",
          fullAnswer: "Eu trabalho com regras locais, contexto da tela e bases salvas neste navegador.",
          nextAction: "Pergunte: o que falta preencher?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Estou pronto para ajudar no uso do ObraReport.",
          fullAnswer: "Posso orientar em passos curtos, sem mexer nos seus dados por conta prÃ³pria.",
          nextAction: "Diga se precisa de ajuda com PDF, RDO ou materiais.",
          sessionTheme: "suporte"
        }
      ],
      agradecimento: [
        {
          shortAnswer: "De nada. Fico Ã  disposiÃ§Ã£o para ajudar no ObraReport.",
          fullAnswer: "Quando quiser, posso revisar RDO, relatÃ³rio, PDF, materiais, planos ou documentos locais do Elo.",
          nextAction: "VocÃª pode perguntar: o que devo fazer agora?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Por nada. Vamos mantendo o fluxo simples.",
          fullAnswer: "Se precisar, eu posso organizar a prÃ³xima aÃ§Ã£o em passos curtos.",
          nextAction: "Pergunte sobre a tela atual quando quiser.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Perfeito. Continuo aqui para apoiar o uso do ObraReport.",
          fullAnswer: "Posso revisar pendÃªncias, explicar recursos ou consultar sua base local.",
          nextAction: "Use uma pergunta direta, como: posso gerar PDF?",
          sessionTheme: "suporte"
        }
      ],
      despedida: [
        {
          shortAnswer: "AtÃ© mais. Quando voltar, posso continuar ajudando no ObraReport.",
          fullAnswer: "As informaÃ§Ãµes locais do Elo ficam neste navegador. Para dados importantes, use as ferramentas de backup quando necessÃ¡rio.",
          nextAction: "Antes de sair, confira se salvou o que precisava no ObraReport.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "AtÃ© logo. Bom trabalho com o ObraReport.",
          fullAnswer: "Eu nÃ£o envio nada sozinho e nÃ£o altero seus dados sem aÃ§Ã£o sua.",
          nextAction: "Quando voltar, pergunte: resuma esta tela.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Certo. Encerrando por aqui, sem alterar nada.",
          fullAnswer: "Se precisar retomar depois, posso ajudar com RDO, relatÃ³rio, PDF e materiais.",
          nextAction: "Salve seu trabalho no ObraReport antes de fechar a pÃ¡gina.",
          sessionTheme: "suporte"
        }
      ],
      identidade: [
        {
          shortAnswer: "Eu sou o Elo, assistente local do ObraReport.",
          fullAnswer: "NÃ£o sou uma pessoa nem tenho consciÃªncia. Sou um assistente digital do sistema para orientar uso, revisar informaÃ§Ãµes visÃ­veis e consultar bases locais.",
          nextAction: "Pergunte: o que vocÃª consegue fazer?",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Meu nome Ã© Elo. Eu ajudo dentro do ObraReport.",
          fullAnswer: "Minha funÃ§Ã£o Ã© tornar o uso do sistema mais claro: relatÃ³rios, RDO, PDF, materiais, planos e documentos locais.",
          nextAction: "Pergunte sobre a tela atual ou sobre um recurso.",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Sou o assistente do ObraReport para suporte e orientaÃ§Ã£o operacional.",
          fullAnswer: "Tenho um perfil calmo, educado, paciente e direto. Uso regras locais e contexto visÃ­vel. NÃ£o sou IA em nuvem nesta versÃ£o.",
          nextAction: "Experimente perguntar: como funciona o Elo?",
          sessionTheme: "elo"
        }
      ],
      capacidades: [
        {
          shortAnswer: "Eu ajudo vocÃª a usar o ObraReport com mais clareza.",
          fullAnswer: "Consigo orientar relatÃ³rios, PDF, RDO, materiais, planos, revisar a tela atual, sugerir prÃ³ximos passos e consultar documentos locais.",
          nextAction: "Experimente: resuma esta tela.",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Posso funcionar como um suporte rÃ¡pido dentro do sistema.",
          fullAnswer: "Eu respondo dÃºvidas, faÃ§o checklists simples e ajudo a entender o que estÃ¡ pendente na tela atual.",
          nextAction: "Pergunte: o que falta preencher?",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Eu organizo dÃºvidas e prÃ³ximos passos do ObraReport.",
          fullAnswer: "TambÃ©m posso guardar memÃ³rias importantes locais e consultar textos adicionados em Documentos do Elo.",
          nextAction: "Abra Ferramentas do Elo para ver Biblioteca e Documentos.",
          sessionTheme: "elo"
        }
      ],
      funcionamento: [
        {
          shortAnswer: "O Elo funciona com regras locais, contexto da tela e dados salvos neste navegador.",
          fullAnswer: "Nesta fase, eu nÃ£o uso backend, nuvem ou IA real. Leio o que estÃ¡ visÃ­vel e consulto bases locais.",
          nextAction: "Abra Ferramentas do Elo para ver Biblioteca, Documentos, MemÃ³rias e Projetos.",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "Eu funciono como uma camada de ajuda dentro do ObraReport.",
          fullAnswer: "Quando vocÃª pergunta, eu identifico a intenÃ§Ã£o, considero a tela atual e procuro em bases locais antes de responder.",
          nextAction: "Pergunte algo sobre PDF, RDO ou materiais.",
          sessionTheme: "elo"
        },
        {
          shortAnswer: "O Elo Ã© local e controlado nesta versÃ£o.",
          fullAnswer: "Nada Ã© enviado para backend por esta conversa. As bases locais ficam no navegador.",
          nextAction: "Use Documentos do Elo para adicionar textos de consulta.",
          sessionTheme: "elo"
        }
      ],
      apoio_pratico: [
        {
          shortAnswer: "Entendi. Vamos simplificar.",
          fullAnswer: "Posso te orientar em passos curtos, sem tentar resolver tudo de uma vez.",
          nextAction: "Escolha um foco: PDF, RDO, materiais ou relatÃ³rio.",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Sem problema. Posso deixar isso mais direto.",
          fullAnswer: "Eu nÃ£o faÃ§o aconselhamento emocional, mas posso reduzir o fluxo para uma prÃ³xima aÃ§Ã£o prÃ¡tica.",
          nextAction: "Pergunte: o que devo fazer agora?",
          sessionTheme: "suporte"
        },
        {
          shortAnswer: "Vamos por partes.",
          fullAnswer: "Se estiver com pressa, eu posso revisar rapidamente a tela atual e apontar sÃ³ o prÃ³ximo passo.",
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
      "DiÃ¡rio de Obras": {
        fullAnswer: "Vejo que vocÃª estÃ¡ no DiÃ¡rio de Obras. Posso ajudar a revisar o RDO, materiais, produÃ§Ã£o ou pendÃªncias.",
        nextAction: "Pergunte: revisar RDO."
      },
      "RelatÃ³rios": {
        fullAnswer: "VocÃª estÃ¡ na Ã¡rea de RelatÃ³rios. Posso ajudar a revisar antes do PDF ou verificar fotos e conclusÃ£o.",
        nextAction: "Pergunte: posso gerar PDF?"
      },
      "Planos": {
        fullAnswer: "VocÃª estÃ¡ nos Planos. Posso explicar limites, contrataÃ§Ã£o assistida ou plano Empresa.",
        nextAction: "Pergunte: qual plano escolher?"
      },
      "Dashboard": {
        fullAnswer: "VocÃª estÃ¡ no Dashboard. Posso sugerir o prÃ³ximo passo ou resumir os indicadores visÃ­veis.",
        nextAction: "Pergunte: o que devo fazer agora?"
      },
      "PÃ¡gina do Cliente": {
        fullAnswer: "VocÃª estÃ¡ na PÃ¡gina do Cliente. Posso ajudar a localizar relatÃ³rios, RDOs e documentos visÃ­veis.",
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
      "o que faÃ§o",
      "por onde comeco",
      "por onde comeÃ§o"
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
        shortAnswer: "VocÃª estÃ¡ em Planos.",
        fullAnswer: [
          "1. Compare Gratuito, Profissional e Empresa.",
          "2. Veja os limites e o uso atual.",
          "3. Escolha o plano adequado ao volume de obras e relatÃ³rios.",
          "4. Use o WhatsApp para contrataÃ§Ã£o assistida.",
          "5. Aguarde ativaÃ§Ã£o orientada pela equipe."
        ].join("\n"),
        nextAction: "Pergunte: como funciona o plano Profissional? ou como funciona o plano Empresa?",
        canSave: false
      },
      "DiÃ¡rio de Obras": {
        shortAnswer: "VocÃª estÃ¡ no DiÃ¡rio de Obras.",
        fullAnswer: [
          "1. Selecione a obra vinculada.",
          "2. Preencha data, responsÃ¡vel, clima, equipe e serviÃ§os.",
          "3. Lance produÃ§Ã£o executada e materiais consumidos.",
          "4. Registre ocorrÃªncias, seguranÃ§a e fotos.",
          "5. Salve o diÃ¡rio e gere o PDF quando estiver pronto."
        ].join("\n"),
        nextAction: "Pergunte: como adicionar materiais? ou como gerar PDF?",
        canSave: false
      },
      "RelatÃ³rios": {
        shortAnswer: "VocÃª estÃ¡ em RelatÃ³rios.",
        fullAnswer: [
          "1. Escolha cliente e obra.",
          "2. Crie ou abra o relatÃ³rio tÃ©cnico.",
          "3. Adicione fotos, ocorrÃªncias e anÃ¡lise.",
          "4. Revise a conclusÃ£o e os dados principais.",
          "5. Gere o PDF profissional para entrega."
        ].join("\n"),
        nextAction: "Pergunte: como criar relatÃ³rio? ou como gerar PDF?",
        canSave: false
      },
      "Clientes": {
        shortAnswer: "VocÃª estÃ¡ em Clientes.",
        fullAnswer: "Aqui eu priorizo cadastro de cliente e organizaÃ§Ã£o dos vÃ­nculos com obras, relatÃ³rios e RDOs.",
        nextAction: "Pergunte: como cadastrar cliente?",
        canSave: false
      },
      "Obras": {
        shortAnswer: "VocÃª estÃ¡ em Obras.",
        fullAnswer: "Aqui eu priorizo cadastro de obra, vÃ­nculo com cliente e organizaÃ§Ã£o dos documentos tÃ©cnicos.",
        nextAction: "Pergunte: como cadastrar obra?",
        canSave: false
      },
      "AdministraÃ§Ã£o": {
        shortAnswer: "VocÃª estÃ¡ em AdministraÃ§Ã£o.",
        fullAnswer: "Aqui eu priorizo visÃ£o geral de uso, limites, planos e suporte operacional.",
        nextAction: "Pergunte sobre limites, planos ou suporte.",
        canSave: false
      }
    };

    return answers[context.label] || {
      shortAnswer: "VocÃª estÃ¡ no " + context.label + ".",
      fullAnswer: "Posso orientar o prÃ³ximo passo com base nesta tela do ObraReport.",
      nextAction: "Pergunte sobre PDF, RDO, materiais, relatÃ³rios ou planos.",
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
        label: "RelatÃ³rios",
        categories: ["relatorios", "fotos", "pdf", "ia"]
      },
      diario: {
        label: "DiÃ¡rio de Obras",
        categories: ["rdo", "materiais", "pdf", "ia"]
      },
      planos: {
        label: "Planos",
        categories: ["planos", "limites", "suporte"]
      },
      administracao: {
        label: "AdministraÃ§Ã£o",
        categories: ["planos", "limites", "suporte"]
      },
      cliente: {
        label: "PÃ¡gina do Cliente",
        categories: ["clientes", "obras", "relatorios", "rdo", "pdf", "suporte"]
      },
      "minha-obra": {
        label: "PÃ¡gina do Cliente",
        categories: ["clientes", "obras", "relatorios", "rdo"]
      },
      "meus-relatorios": {
        label: "PÃ¡gina do Cliente",
        categories: ["relatorios", "pdf", "suporte"]
      },
      "meus-rdos": {
        label: "PÃ¡gina do Cliente",
        categories: ["rdo", "pdf", "suporte"]
      },
      documentos: {
        label: "PÃ¡gina do Cliente",
        categories: ["pdf", "relatorios", "rdo"]
      },
      suporte: {
        label: "PÃ¡gina do Cliente",
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
    ], ["nenhuma ocorrencia", "nenhuma ocorrÃªncia"]);

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
      ], ["nenhum relatorio", "nenhum relatÃ³rio", "nenhum documento"]),
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
      "PrÃ³xima aÃ§Ã£o: " + response.nextAction
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
    ELO_UI.panel.setAttribute("aria-label", standalone ? "Elo" : "Elo â€” Assistente ObraReport");

    const header = createElement("header", "elo-header");
    const headerText = createElement("div");
    headerText.appendChild(createElement("h2", "", standalone ? "Elo" : "Elo â€” Assistente ObraReport"));
    headerText.appendChild(createElement("p", "", standalone ? "Companheiro digital com memÃ³ria, projetos, objetivos e linha do tempo." : "Eu lembro, procuro e te ajudo a usar o ObraReport."));
    ELO_UI.contextLabel = createElement("p", "elo-context-label");
    headerText.appendChild(ELO_UI.contextLabel);
    const closeButton = createElement("button", "elo-close-button", "Ã—");
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
      ["Minhas memÃ³rias", showPersonalMemories],
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
    ELO_UI.suggestions.appendChild(createElement("span", "elo-suggestions-label", "SugestÃµes nesta tela"));
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
        { label: "Stock SaÃºde", question: "como controlar validade de medicamentos no Stock SaÃºde" },
        { label: "ObraReport", question: "resuma o plano do ObraReport" }
      ];
    }

    const route = String(window.location.hash || "").replace("#app/", "").split("/")[0];
    const suggestionMap = {
      Dashboard: [
        ["Me mostre o que vocÃª faz", "Me mostre o que vocÃª faz"],
        ["Quero criar um RDO", "Quero criar um RDO"],
        ["Quero lanÃ§ar material", "Quero lanÃ§ar material"],
        ["Quero gerar um PDF", "Quero gerar PDF"],
        ["O que priorizar?", "O que devo priorizar?"],
        ["O que lembra de mim?", "O que vocÃª lembra de mim?"]
      ],
      "RelatÃ³rios": [
        ["Posso gerar o PDF?", "Posso gerar o PDF?"],
        ["O que falta no relatÃ³rio?", "O que falta no relatÃ³rio?"],
        ["Tenho fotos anexadas?", "Tenho fotos anexadas?"],
        ["Como melhorar este relatÃ³rio?", "Como melhorar este relatÃ³rio?"]
      ],
      "DiÃ¡rio de Obras": [
        ["O que falta preencher?", "O que falta preencher?"],
        ["Tenho materiais registrados?", "Tenho materiais registrados?"],
        ["Tenho produÃ§Ã£o lanÃ§ada?", "Tenho produÃ§Ã£o lanÃ§ada?"],
        ["Como registrar materiais?", "Como registrar materiais?"],
        ["Gerar PDF", "Como gerar PDF?"]
      ],
      Planos: [
        ["Qual plano escolher?", "Qual plano escolher?"],
        ["Como contratar?", "Como contratar?"],
        ["Quais sÃ£o os limites?", "Quais sÃ£o os limites?"],
        ["Plano Empresa", "Como funciona o plano Empresa?"]
      ],
      "AdministraÃ§Ã£o": [
        ["O que posso gerenciar aqui?", "O que posso gerenciar aqui?"],
        ["Como cadastrar cliente?", "Como cadastrar cliente?"],
        ["Separar admin e cliente", "Como separar admin e cliente?"]
      ],
      "PÃ¡gina do Cliente": [
        ["Ãšltimo relatÃ³rio", "Onde estÃ¡ meu Ãºltimo relatÃ³rio?"],
        ["Ãšltimo RDO", "Onde estÃ¡ meu Ãºltimo RDO?"],
        ["Documentos disponÃ­veis", "Quais documentos estÃ£o disponÃ­veis?"],
        ["Falar com suporte", "Como falar com suporte?"]
      ]
    };

    const materialsSuggestions = [
      ["Tenho consumo registrado?", "Tenho consumo registrado?"],
      ["DiferenÃ§a de consumo", "Existe diferenÃ§a de consumo?"],
      ["Como funciona auditoria?", "Como funciona a auditoria?"],
      ["O que falta lanÃ§ar?", "O que falta lanÃ§ar?"]
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
      ["Criar relatÃ³rio", "Como criar meu primeiro relatÃ³rio?"],
      ["Gerar PDF", "Como gerar PDF?"],
      ["Adicionar fotos", "Como adicionar fotos?"],
      ["DiÃ¡rio de Obras", "Como usar o DiÃ¡rio de Obras/RDO?"],
      ["Materiais", "Como registrar materiais?"],
      ["Planos", "Como funcionam os planos?"],
      ["Suporte", "Como falar com suporte?"],
      ["O que vocÃª consegue fazer?", "O que vocÃª consegue fazer?"]
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
    const summary = createElement("summary", "", "âš™ Ferramentas do Elo");
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
    const importantMemoriesButton = createElement("button", "elo-inline-button", "MemÃ³rias importantes");
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
      ["DÃºvidas recentes", showRecentQuestions],
      ["Minhas memÃ³rias", showPersonalMemories],
      ["Limpar histÃ³rico", clearEloHistory],
      ["Limpar memÃ³rias pessoais", confirmClearPersonalMemories],
      ["Suporte WhatsApp", openSupportWhatsapp]
    ].forEach(function (item) {
      const button = createElement("button", "elo-inline-button", item[0]);
      button.type = "button";
      button.addEventListener("click", item[1]);
      container.appendChild(button);
    });
    container.appendChild(createElement("p", "elo-privacy", "Biblioteca, histÃ³rico e memÃ³rias ficam salvos apenas neste navegador."));
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

  function buildResponse(question) {
    return applyEloBrainMarker_(question, buildResponseCore_(question));
  }

  function isEloReportPdfGenerationRequest_(message) {
    const text = normalizeText(message);
    if (!text) {
      return false;
    }
    return hasAnyTerm(text, [
      "gerar relatorio",
      "gere relatorio",
      "criar relatorio",
      "gerar laudo",
      "gerar pdf real",
      "gerar pdf com foto",
      "relatorio com foto",
      "relatorio com imagem",
      "pdf com imagem",
      "fazer relatorio com essa foto",
      "fazer pdf com essa foto"
    ]);
  }

  function getEloReportAppsScriptUrl_() {
    const config = window.RELATORIO_QUALIDADE_CONFIG || {};
    return sanitizeUserText(config.appsScriptUrl || "");
  }

  function buildEloReportPayload_(message, imagePayload) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const description = sanitizeUserText(message) || "Relatorio gerado pelo Elo com imagem anexada.";
    const photo = Object.assign({}, imagePayload, {
      originalName: imagePayload.originalName || imagePayload.fileName || "imagem-elo.jpg",
      fileName: imagePayload.fileName || "imagem-elo.jpg",
      mimeType: imagePayload.mimeType || "image/jpeg"
    });

    return {
      submittedAt: now.toISOString(),
      source: "elo-assistente",
      tipoRelatorio: "fiscalizacao",
      report: {
        obra: "Relatorio gerado pelo Elo",
        dataVistoria: date,
        responsavelTecnico: "Elo Assistente",
        local: "Local informado na conversa",
        dataInicioObra: date,
        linkCameras: "",
        tipoObra: "Obra",
        avancoFisico: "Nao informado",
        avancoFinanceiro: "Nao informado",
        funcionariosCampo: "Nao informado",
        utilizacaoEpi: "Nao informado",
        controleConcreto: "Nao informado",
        observacoes: description,
        emailDestino: "icaroamaralengenharia@gmail.com"
      },
      fotosUnidade: [
        {
          numero: "01",
          descricao: description,
          foto: photo
        }
      ],
      inconformidades: [
        {
          numero: "01",
          descricaoTecnica: description,
          solucaoRecomendada: "Revisar tecnicamente o registro antes da entrega ao cliente.",
          grauRisco: "A avaliar",
          foto: photo
        }
      ]
    };
  }

  async function generateEloReportPdfFromChat_(message, attachments) {
    const appsScriptUrl = getEloReportAppsScriptUrl_();
    const imageFile = Array.prototype.slice.call(attachments || []).find(isEloImageAttachment_);
    const statusMessage = appendMessage("assistant", "Gerando PDF real pelo ObraReport...");

    try {
      if (!appsScriptUrl) {
        throw new Error("Apps Script do ObraReport nao esta configurado nesta pagina.");
      }
      if (!imageFile) {
        throw new Error("Anexe uma imagem JPG ou PNG e peca novamente para gerar o relatorio.");
      }

      const imagePayload = await compressEloImageAttachment_(imageFile);
      const payload = buildEloReportPayload_(message, imagePayload);
      const response = await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      const text = await response.text();
      let result = null;

      try {
        result = JSON.parse(text);
      } catch (error) {
        throw new Error("O Apps Script respondeu em formato inesperado.");
      }

      if (!response.ok || !result || !result.ok || !result.pdfUrl) {
        throw new Error((result && result.error) || "Nao foi possivel gerar o PDF agora.");
      }

      const answer = [
        "PDF real gerado pelo ObraReport.",
        "",
        "Link do PDF: " + result.pdfUrl,
        result.requestId ? "Request ID: " + result.requestId : "",
        "",
        "Revise o arquivo antes de enviar ao cliente."
      ].filter(Boolean).join("\n");
      updateEloMessage_(statusMessage, answer);
      appendEloPdfDownloadAction_(statusMessage, result.pdfUrl);
      saveConversation(message, answer);
      rememberSessionTurn(message, {
        sessionTheme: "obrareport_pdf_real",
        sessionIntent: "gerar_pdf_real",
        nextAction: "Abra o link do PDF e confira foto, capa, galeria e ocorrencia."
      }, answer);
    } catch (error) {
      updateEloMessage_(statusMessage, error && error.message ? error.message : "Nao consegui gerar o PDF agora.");
    } finally {
      clearProductAttachmentPreview();
    }
  }
  function askElo(question, attachments) {
    const cleanQuestion = sanitizeUserText(question);
    if (!cleanQuestion) {
      return;
    }
    const attachedFiles = Array.prototype.slice.call(attachments || []);

    clearEloPendingContextIfTopicChanged_(cleanQuestion);

    appendMessage("user", cleanQuestion);
    markEloInteraction_("elo:send");
    appendTypingIndicator();

    if (isEloReportPdfGenerationRequest_(cleanQuestion)) {
      generateEloReportPdfFromChat_(cleanQuestion, attachedFiles);
      return;
    }

    const operationalChatEcosystemAnswer = buildEloOperationalEcosystemAnswer_(cleanQuestion);
    if (operationalChatEcosystemAnswer) {
      const operationalAnswer = formatResponse(operationalChatEcosystemAnswer);
      appendAssistantMessage(cleanQuestion, operationalAnswer, operationalChatEcosystemAnswer.canSave !== false, operationalChatEcosystemAnswer);
      saveConversation(cleanQuestion, operationalAnswer);
      rememberSessionTurn(cleanQuestion, operationalChatEcosystemAnswer, operationalAnswer);
      clearProductAttachmentPreview();
      return;
    }

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
            nextAction: "Continue a conversa ou peÃ§a um resumo prÃ¡tico.",
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
        const answer = "Perfeito, vou chamar vocÃª de " + name + ". Posso ajudar a organizar ideias, projetos, memÃ³rias, biblioteca ou linha do tempo.";
        appendAssistantMessage(cleanQuestion, answer, false, {
          shortAnswer: answer,
          fullAnswer: "Esse nome ficou salvo apenas neste navegador.",
          nextAction: "Diga o que vocÃª quer organizar agora.",
          canSave: false,
          sessionTheme: "perfil"
        });
        saveConversation(cleanQuestion, answer);
        rememberSessionTurn(cleanQuestion, { sessionTheme: "perfil", nextAction: "Diga o que vocÃª quer organizar agora." }, answer);
        return;
      }
      if (isStandaloneNameCaptureAttempt_(cleanQuestion) && !shouldBypassStandaloneNameCapture_(cleanQuestion)) {
        const socialResponse = getSocialGreetingResponse(cleanQuestion);
        const response = socialResponse || {
          shortAnswer: "Tudo bem.",
          fullAnswer: "Ainda nÃ£o vou usar isso como nome. Quando quiser, me diga apenas como devo chamar vocÃª.",
          nextAction: "VocÃª pode responder sÃ³ com seu nome, por exemplo: Ãcaro.",
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
        ? "Pronto, apaguei essa memÃ³ria permanente deste navegador."
        : "NÃ£o encontrei uma memÃ³ria permanente correspondente para apagar.";
      const response = {
        shortAnswer: answer,
        fullAnswer: result.memories.length ? result.memories.map(function (item) {
          return item.text;
        }).join("\n") : answer,
        nextAction: "Quando quiser, vocÃª pode me pedir para lembrar outra informaÃ§Ã£o importante.",
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
        ? "Guardei isso na memÃ³ria permanente deste navegador: " + memoryItem.text + "."
        : "NÃ£o consegui guardar essa memÃ³ria agora.";
      const response = {
        shortAnswer: answer,
        fullAnswer: memoryItem ? "Categoria: " + memoryItem.category + ". ImportÃ¢ncia: " + memoryItem.importance + "." : answer,
        nextAction: "Pode recarregar a pÃ¡gina e me perguntar o que eu lembro.",
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
      const answer = result.ok ? "Guardei sua carta para o futuro." : "Por seguranÃ§a, nÃ£o consegui guardar essa carta. Confira se ela nÃ£o contÃ©m dados sensÃ­veis.";
      appendAssistantMessage(cleanQuestion, answer, false, {
        shortAnswer: answer,
        fullAnswer: result.ok ? "Ela ficou salva apenas neste navegador, na Linha do Tempo do Elo. Ainda nÃ£o hÃ¡ lembrete automÃ¡tico." : "A Linha do Tempo nÃ£o salva senhas, CPF, cartÃ£o, tokens, chaves API ou dados bancÃ¡rios.",
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
        nextAction: "Escolha Registrar ou NÃ£o registrar.",
        sessionIntent: "timeline"
      }, "O Elo perguntou se deve registrar um evento na Linha do Tempo.");
      return;
    }

    const personalMemoryCandidate = detectPersonalMemory(cleanQuestion);
    if (personalMemoryCandidate && personalMemoryCandidate.blocked) {
      const blockedAnswer = "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.";
      appendAssistantMessage(cleanQuestion, blockedAnswer, false);
      saveConversation(cleanQuestion, blockedAnswer);
      rememberSessionTurn(cleanQuestion, {
        nextAction: "FaÃ§a uma pergunta sem dados sensÃ­veis.",
        sessionIntent: "seguranca"
      }, blockedAnswer);
      return;
    }

    const importantMemoryCandidate = detectImportantMemoryCandidate(cleanQuestion);
    if (importantMemoryCandidate) {
      appendImportantMemoryPrompt(cleanQuestion, importantMemoryCandidate);
      saveConversation(cleanQuestion, "O Elo perguntou se deve guardar uma memÃ³ria importante.");
      rememberSessionTurn(cleanQuestion, {
        nextAction: "Escolha se deseja guardar como projeto, objetivo ou preferÃªncia.",
        sessionIntent: "memoria_importante"
      }, "O Elo perguntou se deve guardar uma memÃ³ria importante.");
      return;
    }

    if (personalMemoryCandidate) {
      appendPersonalMemoryPrompt(cleanQuestion, personalMemoryCandidate);
      saveConversation(cleanQuestion, "O Elo perguntou se deve guardar uma memÃ³ria pessoal.");
      rememberSessionTurn(cleanQuestion, {
        nextAction: "Escolha Sim, lembrar ou NÃ£o.",
        sessionIntent: "memoria_pessoal"
      }, "O Elo perguntou se deve guardar uma memÃ³ria pessoal.");
      return;
    }

    requestEloOnlineAnswer(cleanQuestion, attachedFiles).then(function (onlineAnswer) {
      if (onlineAnswer) {
        const onlineResponse = {
          shortAnswer: onlineAnswer,
          fullAnswer: onlineAnswer,
          nextAction: "Continue a conversa ou peÃ§a um resumo prÃ¡tico.",
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
        nextAction: "Me diga se devo guardar, corrigir ou esquecer alguma informaÃ§Ã£o.",
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
        iconEl.textContent = "â–£";
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
      iconEl.textContent = isImage ? "ðŸ“·" : "â–£";
    }
    if (nameEl) {
      nameEl.textContent = file.name;
    }
    if (sizeEl) {
      sizeEl.textContent = "Â· " + formatProductFileSize(file.size);
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

  function appendEloPdfDownloadAction_(message, pdfUrl) {
    if (!message || !pdfUrl) {
      return;
    }

    const actions = createElement("div", "elo-library-actions");
    const openButton = createElement("a", "elo-inline-button", "Abrir / baixar PDF");
    openButton.href = pdfUrl;
    openButton.target = "_blank";
    openButton.rel = "noopener noreferrer";
    actions.appendChild(openButton);
    message.appendChild(actions);
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
    const label = createElement("span", "elo-typing-label", "Elo estÃ¡ pensando");
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
    const noButton = createElement("button", "elo-inline-button", "NÃ£o");

    yesButton.type = "button";
    noButton.type = "button";

    yesButton.addEventListener("click", function () {
      savePersonalMemory(memoryItem);
      yesButton.disabled = true;
      noButton.disabled = true;
      appendMessage("system", "MemÃ³ria pessoal salva apenas neste navegador.");
    });

    noButton.addEventListener("click", function () {
      yesButton.disabled = true;
      noButton.disabled = true;
      appendMessage("system", "Tudo bem. NÃ£o vou guardar essa informaÃ§Ã£o.");
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
      "Projeto: " + (candidate.project || "nÃ£o identificado") + "\n" +
      "Humor: " + (candidate.mood || "neutro") + "\n" +
      "ImportÃ¢ncia: " + candidate.importance
    );
    const actions = createElement("div", "elo-message-actions");
    const registerButton = createElement("button", "elo-inline-button", "Registrar");
    const cancelButton = createElement("button", "elo-inline-button", "NÃ£o registrar");

    registerButton.type = "button";
    cancelButton.type = "button";

    registerButton.addEventListener("click", function () {
      const result = saveTimelineEvent(candidate);
      registerButton.disabled = true;
      cancelButton.disabled = true;
      if (result.ok) {
        appendMessage("system", "Registrei isso na sua Linha do Tempo.");
      } else {
        appendMessage("system", "Por seguranÃ§a, nÃ£o consegui registrar esse evento.");
      }
    });

    cancelButton.addEventListener("click", function () {
      registerButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "Tudo bem. NÃ£o registrei.");
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
    const noButton = createElement("button", "elo-inline-button", "NÃ£o agora");

    yesButton.type = "button";
    noButton.type = "button";
    yesButton.addEventListener("click", function () {
      markRealQuestionForTraining(realQuestion.id);
      yesButton.disabled = true;
      noButton.disabled = true;
      appendMessage("system", "Pergunta marcada para treinamento manual local. Ela nÃ£o altera a base do Elo sem revisÃ£o.");
    });
    noButton.addEventListener("click", function () {
      yesButton.disabled = true;
      noButton.disabled = true;
      appendMessage("system", "Tudo bem. NÃ£o vou marcar essa pergunta para treino agora.");
    });

    actions.appendChild(yesButton);
    actions.appendChild(noButton);
    message.appendChild(actions);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function copyDiagnosticToClipboard(diagnosticText, button) {
    const originalLabel = button.textContent;
    copyTextToClipboard(diagnosticText).then(function () {
      button.textContent = "âœ… DiagnÃ³stico copiado";
    }).catch(function () {
      button.textContent = "âš ï¸ Copiar manualmente";
      appendMessage("system", "âš ï¸ NÃ£o consegui copiar automaticamente. Selecione e copie o texto manualmente.\n\n" + diagnosticText);
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
      const webNotice = createElement("p", "elo-web-search-notice", "Busca real controlada: desativada por padrÃ£o nesta versÃ£o.");
      const webActions = createElement("div", "elo-web-search-actions");
      const prepareButton = createElement("button", "elo-inline-button", "Preparar busca");
      const cancelButton = createElement("button", "elo-inline-button", "NÃ£o buscar");

      prepareButton.type = "button";
      cancelButton.type = "button";

      prepareButton.addEventListener("click", function () {
        prepareControlledWebSearch(response.webSearch, prepareButton, cancelButton);
      });
      cancelButton.addEventListener("click", function () {
        prepareButton.disabled = true;
        cancelButton.disabled = true;
        appendMessage("system", "Tudo bem. NÃ£o vou preparar busca externa para essa pergunta.");
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
      const copyDiagnosticButton = createElement("button", "elo-inline-button elo-copy-diagnostic-button", "ðŸ“‹ Copiar DiagnÃ³stico");
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
    const memoryButton = createElement("button", "elo-inline-button", "MemÃ³ria");
    const libraryButton = createElement("button", "elo-inline-button", "Biblioteca");
    const noneButton = createElement("button", "elo-inline-button", "NÃ£o salvar");
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
      appendMessage("system", "Guardado na memÃ³ria local do Elo.");
    });

    libraryButton.addEventListener("click", function () {
      const result = createLibraryItemFromAnswer(question, answer);
      disableButtons();
      if (result.ok) {
        appendMessage("system", "Guardado na Biblioteca do Elo: " + result.item.title + ".");
      } else if (result.reason === "sensitive") {
        appendMessage("system", "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.");
      } else {
        appendMessage("system", "NÃ£o consegui guardar na Biblioteca porque faltou tÃ­tulo ou conteÃºdo.");
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
      appendMessage("system", "Por seguranÃ§a, nÃ£o vou buscar nem guardar esse tipo de informaÃ§Ã£o.");
      return;
    }

    ELO_WEB_SEARCH.requestSearch(question, context).then(function (result) {
      if (!result.ok && (result.reason === "disabled" || result.reason === "request_failed")) {
        appendMessage(
          "system",
          "A busca real ainda estÃ¡ desativada nesta versÃ£o. Quando ativada, eu vou consultar uma fonte externa segura, resumir a resposta e perguntar se vocÃª quer guardar na Biblioteca.\n\nConsulta sugerida: " + (result.query || query)
        );
        return;
      }

      if (!result.ok && result.reason === "sensitive") {
        appendMessage("system", "Por seguranÃ§a, nÃ£o vou buscar nem guardar esse tipo de informaÃ§Ã£o.");
        return;
      }

      if (!result.ok || !result.answer) {
        appendMessage("system", "NÃ£o consegui preparar a busca agora. Nenhum dado foi enviado para servidor.");
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
      answerParts.push("", "ConfianÃ§a: " + result.confidence);
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
        appendMessage("system", "Abri o DiÃ¡rio de Obras/RDO para vocÃª.");
      } else {
        appendMessage("system", "NÃ£o encontrei o atalho de RDO nesta tela. Pelo menu do ObraReport, procure por DiÃ¡rio de Obras.");
      }
      return;
    }

    if (action === "report") {
      if (clickRouteButton("relatorios")) {
        appendMessage("system", "Abri a Ã¡rea de RelatÃ³rios para vocÃª.");
      } else {
        appendMessage("system", "NÃ£o encontrei o atalho de RelatÃ³rios nesta tela. Pelo menu do ObraReport, procure por RelatÃ³rios.");
      }
      return;
    }

    if (clickRouteButton("dashboard")) {
      appendMessage("system", "Voltei para o dashboard do ObraReport.");
    } else {
      appendMessage("system", "Continue pelo dashboard do ObraReport: vocÃª pode abrir RDO, RelatÃ³rios, Materiais ou Biblioteca pelo Elo.");
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
      appendMessage("system", "Ainda nÃ£o hÃ¡ dÃºvidas recentes salvas neste navegador.");
      return;
    }

    const text = recent.map(function (item, index) {
      return (index + 1) + ". " + formatDateTime(item.createdAt) + " â€” " + item.question;
    }).join("\n");
    appendMessage("system", "DÃºvidas recentes:\n\n" + text);
  }

  function clearEloHistory() {
    clearMemory();
    appendMessage("system", "HistÃ³rico local do Elo limpo. Nenhum dado do SaaS foi alterado.");
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
    const status = createElement("p", "elo-privacy", "Este perfil fica salvo apenas neste navegador. Ele ajuda o Elo a responder de forma mais Ãºtil.");
    const form = createElement("form", "elo-library-form");
    const nameInput = createElement("input", "elo-library-field");
    const projectInput = createElement("input", "elo-library-field");
    const goalInput = createElement("input", "elo-library-field");
    const helpInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const styleSelect = createElement("select", "elo-library-field");
    const saveButton = createElement("button", "elo-send-button", "Salvar configuraÃ§Ã£o");

    nameInput.type = "text";
    nameInput.maxLength = 80;
    nameInput.placeholder = "Como devo chamar vocÃª?";
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
    helpInput.placeholder = "Que tipo de ajuda vocÃª espera do Elo?";
    helpInput.value = profile.expectedHelp;
    styleSelect.setAttribute("aria-label", "PreferÃªncia de resposta");
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
        ? "Perfil salvo, mas esse texto nÃ£o foi usado como nome."
        : "Perfil local salvo para o Elo.";
      appendMessage("system", [
        "ConfiguraÃ§Ã£o salva.",
        requestedName && isInvalidUserNameAnswer_(requestedName) ? "NÃ£o usei \"" + requestedName + "\" como nome." : "",
        savedProfile.userName ? "Vou chamar vocÃª de " + savedProfile.userName + "." : "",
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
    panel.appendChild(createElement("p", "elo-backup-note", "Perguntas: 1. Como devo chamar vocÃª? 2. Qual seu principal projeto agora? 3. Qual seu objetivo principal esta semana? 4. Que tipo de ajuda espera? 5. Respostas curtas ou detalhadas?"));
    panel.appendChild(form);
    message.appendChild(panel);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function showInitialProfileImport() {
    const message = appendMessage("system", "Importar perfil inicial");
    const panel = createElement("div", "elo-user-profile-panel");
    const status = createElement("p", "elo-privacy", "Cole aqui um texto sobre vocÃª, currÃ­culo, bio profissional ou perfil copiado do LinkedIn. O Elo vai tentar extrair informaÃ§Ãµes importantes e pedir sua aprovaÃ§Ã£o antes de guardar.");
    const form = createElement("form", "elo-library-form");
    const textInput = createElement("textarea", "elo-library-field elo-library-textarea");
    const analyzeButton = createElement("button", "elo-send-button", "Analisar perfil");
    const resultPanel = createElement("div", "elo-profile-import-result is-hidden");

    textInput.maxLength = 8000;
    textInput.rows = 7;
    textInput.placeholder = "Exemplo: Sou engenheiro civil. Tenho empresa prÃ³pria. Trabalho com perÃ­cias e projetos. Estou desenvolvendo o ObraReport.";
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
    panel.appendChild(createElement("p", "elo-backup-note", "As informaÃ§Ãµes ficam salvas apenas neste navegador nesta versÃ£o. Revise antes de guardar."));
    panel.appendChild(form);
    panel.appendChild(resultPanel);
    message.appendChild(panel);
    ELO_UI.messages.scrollTop = ELO_UI.messages.scrollHeight;
  }

  function renderInitialProfileReview(resultPanel, extractedProfile, status) {
    resultPanel.textContent = "";
    resultPanel.classList.remove("is-hidden");
    const summary = createElement("pre", "elo-profile-import-summary", formatInitialProfileExtraction(extractedProfile));
    const question = createElement("p", "elo-privacy", "Deseja guardar essas informaÃ§Ãµes nas memÃ³rias importantes do Elo?");
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
      appendMessage("system", "Perfil inicial salvo. Projetos, objetivos e preferÃªncias detectados tambÃ©m foram enviados para MemÃ³rias importantes.");
    });
    chooseButton.addEventListener("click", function () {
      chooser.classList.toggle("is-hidden");
    });
    cancelButton.addEventListener("click", function () {
      resultPanel.classList.add("is-hidden");
      status.textContent = "ImportaÃ§Ã£o cancelada. Nada foi salvo.";
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
      ["profile", "Perfil: nome, profissÃ£o, empresa, cidade e Ã¡reas"],
      ["projects", "Projetos detectados"],
      ["goals", "Objetivos detectados"],
      ["preferences", "PreferÃªncias detectadas"]
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
      status.textContent = "InformaÃ§Ãµes selecionadas salvas localmente.";
      appendMessage("system", "ImportaÃ§Ã£o seletiva concluÃ­da. Nada foi enviado para servidor.");
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
        status.textContent = "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.";
      } else {
        status.textContent = "Preencha o tÃ­tulo do objetivo para salvar.";
      }
    });
    const projectForm = buildProjectForm(function (result) {
      if (result.ok) {
        status.textContent = "Projeto salvo no Elo.";
        renderProjectList(projectList, projectForm, goalList, goalForm);
        renderGoalList(goalList, goalForm);
      } else if (result.reason === "sensitive") {
        status.textContent = "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.";
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
      status.textContent = added ? "Projetos sugeridos adicionados: " + added + "." : "Os projetos sugeridos jÃ¡ estavam salvos.";
      renderProjectList(projectList, projectForm, goalList, goalForm);
      renderGoalList(goalList, goalForm);
    });
    addProjectButton.addEventListener("click", function () {
      projectForm.classList.toggle("is-hidden");
    });
    suggestedGoalsButton.addEventListener("click", function () {
      const added = addSuggestedGoals();
      status.textContent = added ? "Objetivos sugeridos adicionados: " + added + "." : "Os objetivos sugeridos jÃ¡ estavam salvos.";
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
    descriptionInput.placeholder = "DescriÃ§Ã£o";
    nextActionInput.type = "text";
    nextActionInput.maxLength = 300;
    nextActionInput.placeholder = "PrÃ³xima aÃ§Ã£o";
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
      saveButton.textContent = editingProjectId ? "Salvar ediÃ§Ã£o" : "Salvar projeto";
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
      const description = createElement("p", "", project.description || "Sem descriÃ§Ã£o salva.");
      const nextAction = createElement("p", "elo-project-next", "PrÃ³xima aÃ§Ã£o: " + (project.nextAction || "nÃ£o definida"));
      const actions = createElement("div", "elo-library-actions");
      const editButton = createElement("button", "elo-inline-button", "Editar");
      const activeButton = createElement("button", "elo-inline-button", "Ativo");
      const pauseButton = createElement("button", "elo-inline-button", "Pausado");
      const doneButton = createElement("button", "elo-inline-button", "ConcluÃ­do");
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
        appendMessage("system", "Projeto excluÃ­do do Elo.");
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
    titleInput.placeholder = "TÃ­tulo do objetivo";
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
      const meta = createElement("span", "elo-library-meta", (project ? project.name : "Sem projeto") + (goal.targetDate ? " Â· " + goal.targetDate : ""));
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
        appendMessage("system", "Objetivo excluÃ­do do Elo.");
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
    const status = createElement("p", "elo-privacy", "As perguntas ficam salvas apenas neste navegador nesta versÃ£o. Treinamento manual local.");
    const stats = createElement("div", "elo-real-question-stats");
    const controls = createElement("div", "elo-library-controls");
    const filterSelect = createElement("select", "elo-library-select");
    const exportJsonButton = createElement("button", "elo-inline-button", "Exportar JSON");
    const exportTextButton = createElement("button", "elo-inline-button", "Exportar texto");
    const clearButton = createElement("button", "elo-inline-button", "Limpar perguntas");
    const list = createElement("div", "elo-real-question-list");

    filterSelect.setAttribute("aria-label", "Filtrar perguntas reais");
    appendSimpleOptions(filterSelect, ["Todas", "Ãšteis", "NÃ£o Ãºteis", "Sugeridas para treino"]);
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
      status.textContent = "ExportaÃ§Ã£o preparada: " + result.fileName + ".";
    });
    exportTextButton.addEventListener("click", function () {
      const result = exportRealQuestions("txt");
      status.textContent = "ExportaÃ§Ã£o preparada: " + result.fileName + ".";
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
      ["Ãšteis", stats.useful],
      ["NÃ£o Ãºteis", stats.notUseful],
      ["Para treino", stats.training]
    ].forEach(function (item) {
      const stat = createElement("span", "elo-real-question-stat", item[0] + ": " + item[1]);
      statsElement.appendChild(stat);
    });
  }

  function filterRealQuestions(questions, filter) {
    if (filter === "Ãšteis") {
      return questions.filter(function (item) { return item.foiUtil === true; });
    }
    if (filter === "NÃ£o Ãºteis") {
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
        questionItem.foiUtil === null ? "sem feedback" : (questionItem.foiUtil ? "Ãºtil" : "nÃ£o Ãºtil"),
        questionItem.sugeridaParaTreino ? "para treino" : "nÃ£o marcada",
        formatDateTime(questionItem.createdAt)
      ].join(" Â· "));
      const response = createElement("p", "", summarizeLibraryContent(questionItem.respostaGerada || "Sem resposta registrada."));
      const actions = createElement("div", "elo-library-actions");
      const trainButton = createElement("button", "elo-inline-button", "Adicionar Ã  base de respostas");
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
        status.textContent = "Pergunta real excluÃ­da.";
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
    const saveButton = createElement("button", "elo-send-button", "Adicionar Ã  base de respostas");

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
    keywordsInput.placeholder = "Palavras-chave, separadas por vÃ­rgula";
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
        status.textContent = "Pergunta adicionada Ã  base local do Elo apÃ³s revisÃ£o manual.";
        appendMessage("system", "Item salvo na Biblioteca do Elo. A base principal nÃ£o foi alterada automaticamente.");
        refresh();
      } else if (result.reason === "sensitive") {
        appendMessage("system", "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.");
      } else {
        appendMessage("system", "Preencha pergunta e resposta corrigida para adicionar Ã  base.");
      }
    });

    form.appendChild(createElement("p", "elo-privacy", "Revise antes de salvar. O Elo nÃ£o aprende sozinho nem substitui respostas existentes automaticamente."));
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
      status.textContent = "Perguntas reais limpas. Dados do ObraReport nÃ£o foram alterados.";
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
      const sourceLabel = documentItem.sourceName ? " Â· " + documentItem.sourceName : "";
      const meta = createElement("span", "elo-library-meta", typeLabel.toUpperCase() + sourceLabel + " Â· " + documentItem.size + " caracteres Â· " + (documentItem.chunks || []).length + " parte(s) Â· " + formatDateTime(documentItem.createdAt));
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
    titleInput.placeholder = "TÃ­tulo do documento";
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
      const meta = createElement("span", "elo-library-meta", documentItem.type.toUpperCase() + " Â· " + documentItem.size + " caracteres Â· " + (documentItem.chunks || []).length + " chunk(s) Â· " + formatDateTime(documentItem.createdAt));
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
        appendMessage("system", "Documento local excluÃ­do.");
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
      const title = createElement("strong", "", (libraryItem.favorite ? "â˜… " : "") + libraryItem.title);
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
    const message = appendMessage("system", memories.length ? "Minhas memÃ³rias pessoais:" : "Ainda nÃ£o hÃ¡ memÃ³rias pessoais salvas neste navegador.");

    if (!memories.length) {
      return;
    }

    const list = createElement("div", "elo-memory-list");
    memories.forEach(function (memoryItem) {
      const item = createElement("article", "elo-memory-item");
      const text = createElement("div");
      text.appendChild(createElement("strong", "", memoryItem.label + ": " + memoryItem.value));
      text.appendChild(createElement("span", "", "Categoria: " + memoryItem.category + " Â· " + formatDateTime(memoryItem.createdAt)));

      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", function () {
        deletePersonalMemory(memoryItem.id);
        item.remove();
        appendMessage("system", "MemÃ³ria pessoal excluÃ­da.");
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
        status.textContent = "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.";
      } else {
        status.textContent = "Preencha tÃ­tulo e conteÃºdo para salvar o evento.";
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
    const intro = createElement("p", "elo-privacy", "Respostas reflexivas locais, sem internet, sem IA real e sem impor uma crenÃ§a como verdade absoluta.");
    const questions = createElement("div", "elo-suggestion-chips");
    [
      "VocÃª existe?",
      "O que somos?",
      "O que Ã© esperanÃ§a?",
      "SÃ³ existe o que Ã© palpÃ¡vel?",
      "O que Ã© pensamento?",
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
    const status = createElement("p", "elo-privacy", "Conceitos ficam salvos apenas neste navegador. A base fixa nÃ£o usa internet nem IA real.");
    const controls = createElement("div", "elo-library-controls");
    const searchInput = createElement("input", "elo-library-search");
    const addButton = createElement("button", "elo-inline-button", "Adicionar conceito");
    const form = buildConceptForm(function (result) {
      if (result.ok) {
        status.textContent = "Conceito personalizado salvo.";
        form.classList.add("is-hidden");
        renderConceptList(list, searchInput.value);
      } else if (result.reason === "sensitive") {
        status.textContent = "Por seguranÃ§a, nÃ£o vou guardar esse tipo de informaÃ§Ã£o.";
      } else {
        status.textContent = "Preencha tÃ­tulo e resposta curta para salvar.";
      }
    });
    const suggested = createElement("div", "elo-suggestion-chips");
    const list = createElement("div", "elo-concepts-list");

    searchInput.type = "search";
    searchInput.placeholder = "Buscar conceito";
    addButton.type = "button";
    ["O que Ã© amor?", "O que Ã© alma?", "O que Ã© esperanÃ§a?", "SÃ³ existe o que Ã© palpÃ¡vel?", "O que Ã© pensamento?", "O que Ã© propÃ³sito?"].forEach(function (question) {
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
    titleInput.placeholder = "TÃ­tulo do conceito";
    keywordsInput.type = "text";
    keywordsInput.placeholder = "Palavras-chave separadas por vÃ­rgula";
    shortAnswerInput.placeholder = "Resposta curta";
    icaroInput.placeholder = "VisÃ£o do Ãcaro";
    reflectionInput.placeholder = "ReflexÃ£o do Elo";
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
      const title = createElement("strong", "", concept.title + (concept.custom ? " Â· personalizado" : ""));
      const meta = createElement("span", "elo-library-meta", (concept.keywords || []).slice(0, 5).join(", "));
      const summary = createElement("p", "", concept.shortAnswer);
      const actions = createElement("div", "elo-library-actions");
      const askButton = createElement("button", "elo-inline-button", "Perguntar");

      askButton.type = "button";
      askButton.addEventListener("click", function () {
        askElo("O que Ã© " + concept.title + "?");
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
    titleInput.placeholder = "TÃ­tulo";
    contentInput.maxLength = 1200;
    contentInput.placeholder = "ConteÃºdo do evento";
    projectInput.type = "text";
    projectInput.maxLength = 120;
    projectInput.placeholder = "Projeto relacionado";
    tagsInput.type = "text";
    tagsInput.maxLength = 160;
    tagsInput.placeholder = "Tags separadas por vÃ­rgula";
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
      list.appendChild(createElement("p", "elo-library-empty", "Ainda nÃ£o hÃ¡ eventos registrados na sua Linha do Tempo."));
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
      const meta = createElement("span", "elo-library-meta", formatDateTime(event.createdAt) + (event.project ? " Â· Projeto: " + event.project : "") + (event.mood ? " Â· Humor: " + event.mood : ""));
      const tags = createElement("span", "elo-library-tags", event.tags.length ? "Tags: " + event.tags.join(", ") : "Sem tags");
      const actions = createElement("div", "elo-library-actions");
      const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

      deleteButton.type = "button";
      deleteButton.addEventListener("click", function () {
        deleteTimelineEvent(event.id);
        renderTimelineList(list, type, project);
        appendMessage("system", "Evento excluÃ­do da Linha do Tempo.");
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
    const message = appendMessage("system", "MemÃ³rias importantes");
    const panel = createElement("div", "elo-important-memory-panel");
    const status = createElement("p", "elo-privacy", "Essas memÃ³rias ficam salvas apenas neste navegador nesta versÃ£o.");
    const list = createElement("div", "elo-important-memory-list");
    const actions = createElement("div", "elo-message-actions");
    const exportButton = createElement("button", "elo-inline-button", "Exportar JSON");
    const clearButton = createElement("button", "elo-inline-button", "Limpar memÃ³rias importantes");

    function render() {
      list.innerHTML = "";
      [
        ["Projetos", storage.projetos || []],
        ["Objetivos", storage.objetivos || []],
        ["PreferÃªncias", storage.preferencias || []]
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
          const description = createElement("p", "", item.descricao || "Sem descriÃ§Ã£o.");
          const meta = createElement("span", "elo-library-meta", "Criado em " + formatDateTime(item.createdAt));
          const deleteButton = createElement("button", "elo-memory-delete", "Excluir");

          deleteButton.type = "button";
          deleteButton.addEventListener("click", function () {
            deleteImportantMemory(item.id);
            status.textContent = "MemÃ³ria importante excluÃ­da.";
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
      status.textContent = "Arquivo JSON das memÃ³rias importantes preparado.";
    });
    clearButton.addEventListener("click", function () {
      clearImportantMemories();
      status.textContent = "MemÃ³rias importantes limpas. Dados do ObraReport nÃ£o foram alterados.";
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
    const message = appendMessage("system", "Tem certeza? Isso nÃ£o afeta dados do ObraReport, apenas memÃ³rias locais do Elo.");
    const actions = createElement("div", "elo-message-actions");
    const confirmButton = createElement("button", "elo-inline-button", "Limpar memÃ³rias pessoais");
    const cancelButton = createElement("button", "elo-inline-button", "Cancelar");

    confirmButton.type = "button";
    cancelButton.type = "button";

    confirmButton.addEventListener("click", function () {
      clearPersonalMemories();
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "MemÃ³rias pessoais limpas. Dados do ObraReport nÃ£o foram alterados.");
    });

    cancelButton.addEventListener("click", function () {
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      appendMessage("system", "Limpeza de memÃ³rias pessoais cancelada.");
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
      appendMessage("system", "Suporte por WhatsApp ainda nÃ£o configurado.");
      return;
    }

    const message = "OlÃ¡, preciso de ajuda com o ObraReport.";
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
        if (isEloReportPdfGenerationRequest_(question)) {
          askElo(question, ELO_UI.attachments);
        } else {
          analyzeEloImageAttachment_(question, attachmentIntent.file);
        }
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
    buildProfessionalPdfDocumentForTest: buildEloProfessionalPdfDocument,
    normalizeProfessionalPdfDataForTest: normalizeEloProfessionalPdfData_,
    buildBudgetV2ProfessionalPdfDataForTest: buildBudgetV2ProfessionalPdfData,
    getBudgetRecordsForTest: getEloBudgetRecords_,
    clearBudgetRecordsForTest: function () { setEloBudgetRecords_([]); writeEloBudgetJsonToStorage_(ELO_CONFIG.budgetCounterStorageKey, {}); ELO_SESSION_MEMORY.lastBudgetSource = null; },
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

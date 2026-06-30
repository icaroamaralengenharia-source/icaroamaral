(function initEloWorkSessionEngine(global) {
  "use strict";

  const STORAGE_KEY = "elo_work_session_v1";

  const SESSION_TYPES = {
    pathology: {
      id: "pathology",
      title: "Diagnostico tecnico",
      deliverables: ["triagem tecnica", "checklist de vistoria", "mensagem para cliente", "relatorio preliminar"],
      steps: [
        { id: "objective", label: "Objetivo entendido" },
        { id: "location", label: "Local do problema" },
        { id: "evidence", label: "Fotos/evidencias" },
        { id: "history", label: "Historico e evolucao" },
        { id: "hypotheses", label: "Hipoteses tecnicas" },
        { id: "risk", label: "Risco e urgencia" },
        { id: "deliverable", label: "Entrega pronta" }
      ]
    },
    budget: {
      id: "budget",
      title: "Orcamento consultivo",
      deliverables: ["orcamento preliminar", "tabela de itens", "escopo para cliente", "checklist de dados"],
      steps: [
        { id: "objective", label: "Finalidade do orcamento" },
        { id: "location", label: "Cidade/estado" },
        { id: "area", label: "Area aproximada" },
        { id: "standard", label: "Padrao da obra" },
        { id: "scope", label: "Escopo e tipologia" },
        { id: "items", label: "Itens principais" },
        { id: "deliverable", label: "Entrega pronta" }
      ]
    },
    report: {
      id: "report",
      title: "Relatorio ou laudo tecnico",
      deliverables: ["estrutura de relatorio", "checklist de vistoria", "relatorio preliminar", "PDF tecnico"],
      steps: [
        { id: "objective", label: "Uso do documento" },
        { id: "recipient", label: "Destinatario" },
        { id: "evidence", label: "Fotos/evidencias" },
        { id: "description", label: "Descricao tecnica" },
        { id: "analysis", label: "Analise preliminar" },
        { id: "recommendations", label: "Recomendacoes" },
        { id: "deliverable", label: "Entrega pronta" }
      ]
    },
    rdo: {
      id: "rdo",
      title: "Diario de obra / RDO",
      deliverables: ["RDO do dia", "resumo executivo", "pendencias", "status da obra"],
      steps: [
        { id: "date", label: "Data da obra" },
        { id: "team", label: "Equipe" },
        { id: "weather", label: "Clima" },
        { id: "services", label: "Servicos executados" },
        { id: "occurrences", label: "Ocorrencias" },
        { id: "photos", label: "Fotos" },
        { id: "deliverable", label: "Entrega pronta" }
      ]
    },
    client_message: {
      id: "client_message",
      title: "Resposta profissional para cliente",
      deliverables: ["mensagem pronta para cliente", "resposta tecnica curta", "orientacao de proximo passo"],
      steps: [
        { id: "objective", label: "Objetivo da resposta" },
        { id: "tone", label: "Tom da mensagem" },
        { id: "facts", label: "Fatos principais" },
        { id: "risk", label: "Cuidados e limites" },
        { id: "next_step", label: "Proximo passo sugerido" },
        { id: "deliverable", label: "Mensagem pronta" }
      ]
    },
    generic: {
      id: "generic",
      title: "Atendimento tecnico",
      deliverables: ["resumo", "checklist", "proximo passo"],
      steps: [
        { id: "objective", label: "Objetivo entendido" },
        { id: "context", label: "Contexto" },
        { id: "data", label: "Dados necessarios" },
        { id: "analysis", label: "Analise" },
        { id: "deliverable", label: "Entrega pronta" }
      ]
    }
  };

  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function loadSession() {
    try {
      const raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function saveSession(session) {
    try {
      if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, JSON.stringify(session || null));
    } catch (_) {}
  }

  function resetSession() {
    try {
      if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function inferSessionType(input) {
    const text = normalize(input && [input.message, input.userMessage, input.intent, input.hiddenObjective, input.pain].filter(Boolean).join(" "));

    if (/cliente|responder|mensagem|explicar para/.test(text)) return "client_message";
    if (/infiltr|umidade|mofo|trinca|fissura|rachadura|vazamento|patolog/.test(text)) return "pathology";
    if (/orcamento|quanto custa|preco|valor|custo|sinapi|orse/.test(text)) return "budget";
    if (/laudo|relatorio|parecer|documento tecnico/.test(text)) return "report";
    if (/rdo|diario de obra|ocorrencia/.test(text)) return "rdo";

    return "generic";
  }

  function getNextActionFromSteps(steps) {
    const next = (steps || []).find(function (step) { return step.id !== "objective"; });
    return next ? "Proximo dado: " + next.label + "." : "Informe o proximo dado para avancarmos.";
  }

  function createSession(input) {
    const type = inferSessionType(input);
    const template = SESSION_TYPES[type] || SESSION_TYPES.generic;
    const now = new Date().toISOString();

    return {
      id: "elo-session-" + Date.now(),
      type: template.id,
      title: template.title,
      status: "em_andamento",
      objective: input.hiddenObjective || input.intent || "conduzir atendimento tecnico",
      persona: input.persona || "desconhecido",
      pain: input.pain || "nao identificado",
      urgency: input.urgency || "baixa",
      deliverables: template.deliverables.slice(),
      suggestedDeliverable: template.deliverables[0],
      steps: template.steps.map(function (step, index) {
        return { id: step.id, label: step.label, status: index === 0 ? "done" : "pending" };
      }),
      timeline: [{ at: now, type: "session_started", label: "Sessao iniciada: " + template.title }],
      lastInput: input.message || input.userMessage || "",
      nextAction: getNextActionFromSteps(template.steps),
      createdAt: now,
      updatedAt: now
    };
  }

  function updateSessionProgress(session, input) {
    if (!session) return session;

    const text = normalize(input.message || input.userMessage || "");
    const next = Object.assign({}, session);
    next.steps = (session.steps || []).map(function (step) { return Object.assign({}, step); });
    next.timeline = Array.isArray(session.timeline) ? session.timeline.slice() : [];

    function markDone(id, reason) {
      const step = next.steps.find(function (item) { return item.id === id; });
      if (step && step.status !== "done") {
        step.status = "done";
        next.timeline.push({ at: new Date().toISOString(), type: "step_done", label: reason || step.label });
      }
    }

    if (/foto|imagem|anexo|evidencia/.test(text)) markDone("evidence", "Evidencias mencionadas");
    if (/cidade|uf|estado|bahia|sao paulo|vitoria|conquista/.test(text)) markDone("location", "Localizacao informada");
    if (/\d+\s*m2|area/.test(text)) markDone("area", "Area informada");
    if (/baixo|medio|alto|popular|padrao/.test(text)) markDone("standard", "Padrao informado");
    if (/cliente|condominio|justica|banco|prefeitura/.test(text)) markDone("recipient", "Destinatario/uso informado");
    if (/urgente|risco|perigo|aumentando|vazando muito|alagou|estrutura/.test(text)) markDone("risk", "Risco/urgencia mencionado");
    if (/executado|servico|equipe|clima|ocorrencia/.test(text)) markDone("services", "Dados de obra mencionados");

    const pending = next.steps.find(function (step) { return step.status !== "done"; });
    next.nextAction = pending ? "Proximo dado: " + pending.label + "." : "Posso montar a entrega: " + next.suggestedDeliverable + ".";
    next.status = pending ? "em_andamento" : "pronto_para_entrega";
    next.lastInput = input.message || input.userMessage || next.lastInput;
    next.updatedAt = new Date().toISOString();

    return next;
  }

  function startOrUpdateSession(input) {
    const previous = loadSession();
    const incomingType = inferSessionType(input);
    let session = previous;
    const message = normalize(input && input.message || "");

    const shouldStartNew = !session || message.indexOf("nova sessao") >= 0 || message.indexOf("outro caso") >= 0 || (session.type !== incomingType && incomingType !== "generic");

    if (shouldStartNew) session = createSession(input || {});
    else session = updateSessionProgress(session, input || {});

    saveSession(session);
    return session;
  }

  function getProgress(session) {
    const steps = session && Array.isArray(session.steps) ? session.steps : [];
    const done = steps.filter(function (step) { return step.status === "done"; }).length;
    return { done: done, total: steps.length, percent: steps.length ? Math.round((done / steps.length) * 100) : 0 };
  }

  function buildSessionBlock(session) {
    if (!session) return "";

    const progress = getProgress(session);
    const visibleSteps = (session.steps || [])
      .slice(0, 7)
      .map(function (step) { return (step.status === "done" ? "[x] " : "[ ] ") + step.label; })
      .join("\n");

    return [
      "**Sessao de trabalho**",
      session.title,
      "",
      "**Status:** " + progress.done + "/" + progress.total + " etapas (" + progress.percent + "%)",
      visibleSteps,
      "",
      "**Entrega alvo:** " + session.suggestedDeliverable,
      "**Proxima acao:** " + session.nextAction
    ].join("\n");
  }

  function buildDeliverablePreview(session) {
    if (!session) return "";
    if (session.type === "client_message") return "**Previa da entrega:**\nPosso transformar os fatos informados em uma mensagem curta, profissional e segura para o cliente.";
    if (session.type === "pathology") return "**Previa da entrega:**\nPosso organizar a situacao em hipotese inicial, riscos, itens a verificar, fotos necessarias e recomendacao de vistoria.";
    if (session.type === "budget") return "**Previa da entrega:**\nPosso montar um orcamento preliminar com escopo, dados pendentes, itens principais e premissas adotadas.";
    if (session.type === "report") return "**Previa da entrega:**\nPosso montar a estrutura inicial do relatorio com objetivo, evidencias, analise, recomendacoes e proximos passos.";
    if (session.type === "rdo") return "**Previa da entrega:**\nPosso organizar o RDO com data, equipe, clima, servicos, ocorrencias, fotos e pendencias.";
    return "";
  }

  function enhanceWithSession(payload) {
    const response = String(payload && payload.assistantResponse || "").trim();
    if (!response) return response;
    if (/Sessao de trabalho/i.test(response)) return response;

    const session = startOrUpdateSession(payload || {});
    const block = buildSessionBlock(session);
    const preview = buildDeliverablePreview(session);
    return [response, block, preview].filter(Boolean).join("\n\n");
  }

  global.EloWorkSessionEngine = {
    inferSessionType: inferSessionType,
    createSession: createSession,
    startOrUpdateSession: startOrUpdateSession,
    updateSessionProgress: updateSessionProgress,
    buildSessionBlock: buildSessionBlock,
    buildDeliverablePreview: buildDeliverablePreview,
    enhanceWithSession: enhanceWithSession,
    loadSession: loadSession,
    saveSession: saveSession,
    resetSession: resetSession
  };
})(typeof window !== "undefined" ? window : globalThis);
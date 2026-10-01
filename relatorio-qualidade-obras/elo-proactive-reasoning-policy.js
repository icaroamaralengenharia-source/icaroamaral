(function initEloProactiveReasoningPolicy(global) {
  "use strict";

  const VERSION = "20260920-elo-proactive-reasoning-v1";
  const PROACTIVITY = ["NONE", "LIGHT", "RELEVANT", "CRITICAL"];
  const SELF_CHECK = ["NONE", "LIGHT", "TECHNICAL", "HIGH_STAKES"];
  const ANSWER_MODES = ["DIRECT", "DIRECT_PLUS_ADVICE", "TECHNICAL", "DECISION", "CONVERSATIONAL", "REPORT", "CALCULATION", "ACTION", "FILE_ANALYSIS"];

  function text(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function has(value, pattern) { return pattern.test(normalize(value)); }
  function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }
  function clamp(value, max) { return text(value).slice(0, max); }

  function historyText(history) {
    return (Array.isArray(history) ? history : [])
      .slice(-12)
      .map(function (item) { return item && item.content ? text(item.content) : ""; })
      .filter(Boolean)
      .join(" ");
  }

  function contextText(context) {
    const safe = context && typeof context === "object" ? context : {};
    const recent = safe.recentConversation || safe.conversationSummary || safe.recentHistory || "";
    return [
      safe.workingMemorySummary,
      recent,
      safe.projectContextSummary,
      safe.projectContext && JSON.stringify(safe.projectContext),
      safe.productContextSummary,
      safe.memoriesSummary,
      safe.relevantMemoriesSummary,
      historyText(safe.history)
    ].filter(Boolean).map(text).join(" ").slice(0, 10000);
  }

  function hasConstruction(textValue) {
    return /\b(?:obra|concreto|concretar|laje|viga|pilar|parede|alvenaria|fundacao|sapata|baldrame|telha|cobertura|instalacoes?|eletrica|hidraulica|rdo|medicao|quantitativo|orcamento|patologia|trinca|fissura|rachadura|impermeabilizacao|revestimento|escoramento|armadura|cobrimento)\b/.test(normalize(textValue));
  }

  function detectIntent(message, metadata) {
    const value = normalize(message);
    const meta = metadata && typeof metadata === "object" ? metadata : {};
    if (meta.structured === true || meta.responseType === "json" || meta.responseType === "action") return "ACTION";
    if (meta.responseType === "report" || /\b(?:relatorio|laudo|parecer)\b/.test(value)) return "REPORT";
    if (meta.hasAttachment === true) return "FILE_ANALYSIS";
    if (/^\s*-?\d+(?:[.,]\d+)?\s*[+\-x*/]\s*-?\d+(?:[.,]\d+)?\s*\??\s*$/.test(value)) return "CALCULATION";
    if (/\b(?:quanto\s+(?:e|da|d[aá])|calcule)\s+-?\d+(?:[.,]\d+)?\s*[+\-x*/]\s*-?\d+(?:[.,]\d+)?\b/.test(value)) return "CALCULATION";
    if (/\b(?:qual\s+e\s+a|e\s+que\s+dia|que\s+dia\s+e|capital\s+de)\b/.test(value)) return "SIMPLE_FACT";
    if (/\b(?:como executar|etapa tecnica|nbr|norma)\b/.test(value)) return "TECHNICAL";
    if (hasConstruction(value) && /\b(?:quanto|calcule|calcular|medir|medicao|quantitativo|material|ferro|aco|concreto|custo|preco|valor)\b/.test(value)) return "TECHNICAL";
    if (/\b(?:qual|qual das|entre|escolheria|prefere|devo|fa[cz]o ou nao|da ou nao|vale a pena|opcao|opcao)\b/.test(value)) return "DECISION";
    if (/\b(?:como faco|o que voce faria|aconselh|recomen|sugira|devo fazer)\b/.test(value)) return "ADVICE";
    if (hasConstruction(value)) return "TECHNICAL";
    if (/\?|\b(?:oi|ola|bom dia|boa tarde|boa noite|cansado|frustrad|exausto|e ai)\b/.test(value)) return "CONVERSATION";
    if (/\b(?:isso|esse|essa|depois|anterior|o segundo|detalhe|aprofunde)\b/.test(value)) return "CONTEXT";
    return "SIMPLE_FACT";
  }

  function detectProjectStage(value) {
    const message = normalize(value);
    if (/\b(?:fundacao|sapata|baldrame|radier|escavacao)\b/.test(message)) return "fundacao";
    if (/\b(?:concretar|concretagem|laje|pilar|viga|estrutura|armadura|escoramento)\b/.test(message)) return "estrutura";
    if (/\b(?:parede|alvenaria|reboco|chapisco|vedacao)\b/.test(message)) return "vedacao";
    if (/\b(?:instalacao|eletrica|hidraulica|tubulacao|embutid)\b/.test(message)) return "instalacoes";
    if (/\b(?:piso|revestimento|pintura|acabamento|telha|cobertura)\b/.test(message)) return "acabamento";
    if (/\b(?:entrega|vistoria final|checklist final)\b/.test(message)) return "entrega";
    return "";
  }

  function currentAndContext(message, context) {
    return normalize([message, contextText(context)].filter(Boolean).join(" "));
  }

  function detectRisk(message, context, intent) {
    const value = currentAndContext(message, context);
    const critical = [
      { pattern: /concretar.{0,80}sem.{0,40}(instalac|confer|armadur|cobrimento|escoramento)/, type: "pre_concretagem" },
      { pattern: /(?:retirar|remover).{0,30}escoramento/, type: "escoramento" },
      { pattern: /(?:ligar|fechar|tampar).{0,50}(?:eletrica|hidraulica|tubulacao).{0,50}sem.{0,30}(teste|confer|verific)/, type: "instalacao_sem_teste" },
      { pattern: /(?:medicao|quantitativo).{0,60}(?:incompativel|divergente|absurd|nao bate|nao fecha)/, type: "medicao_incompativel" },
      { pattern: /(?:fazer|executar|liberar).{0,50}(?:mesmo assim|assim mesmo)/, type: "concordancia_perigosa" },
      { pattern: /sem.{0,30}(?:conferir|verificar).{0,30}(?:armadura|cobrimento|instalac)/, type: "concordancia_perigosa" }
    ];
    for (let index = 0; index < critical.length; index += 1) {
      if (critical[index].pattern.test(value)) return { detected: true, level: "CRITICAL", type: critical[index].type };
    }
    if (intent === "TECHNICAL" && /\b(?:estrutural|pilar|viga|laje|fundacao|sapata|escoramento|seguranca)\b/.test(value)) {
      return { detected: true, level: "HIGH", type: "technical_safety" };
    }
    if (/\b(?:vou concretar amanha|concretar amanha|concretagem amanha)\b/.test(value)) {
      return { detected: true, level: "RELEVANT", type: "pre_concretagem" };
    }
    if (/\b(?:preco|valor|custo|medicao|pagamento|financeiro)\b/.test(value)) {
      return { detected: true, level: "RELEVANT", type: "financial_or_measurement" };
    }
    return { detected: false, level: "NONE", type: "" };
  }

  function hasAny(value, terms) {
    const normalized = normalize(value);
    return (terms || []).some(function (term) { return normalized.indexOf(normalize(term)) >= 0; });
  }

  function detectMissing(message, context, intent) {
    const current = normalize(message);
    const combined = currentAndContext(message, context);
    const essential = [];
    const useful = [];

    if (intent === "TECHNICAL" && /\b(?:qual|que).{0,35}(?:ferro|aco|armadura).{0,35}(?:viga|pilar|laje)\b/.test(current)) {
      ["vao", "secao", "apoios", "carga"].forEach(function (field) {
        const aliases = field === "vao" ? ["vao", "vão"] : field === "secao" ? ["secao", "seção", "dimensao"] : field === "apoios" ? ["apoio", "apoiada"] : ["carga", "laje", "parede", "cobertura"];
        if (!hasAny(combined, aliases)) essential.push(field);
      });
    }

    if (intent === "TECHNICAL" && /\b(?:quanto|volume).{0,40}(?:concreto|laje|concretar)\b/.test(current)) {
      if (!/\b(?:espessura|altura|cm|centimetro|centimetros)\b/.test(combined)) essential.push("espessura");
      if (!/(?:\b(?:m2|m²|metros quadrados|area)\b|\d+\s*m(?:2|²))/.test(combined)) essential.push("area");
    }

    if (intent === "TECHNICAL" && /\b(?:medicao|quantitativo).{0,50}(?:certa|correta|confere|fecha)\b/.test(current) && !/\b(?:quantidade|unidade|executad|contrat|memoria)\b/.test(combined)) {
      useful.push("quantidade medida e critério contratual");
    }

    if (intent === "DECISION" && /\b(?:telha|material|sistema|opcao)\b/.test(current)) {
      if (!/\b(?:clima|caimento|inclinacao|inclinacao|manutencao|orcamento|custo|conforto)\b/.test(combined)) useful.push("critério principal da escolha");
    }

    return { essential: unique(essential), useful: unique(useful), optional: [] };
  }

  function inferProactivity(intent, risk, missing, message, context) {
    if (risk.level === "CRITICAL") return "CRITICAL";
    if (intent === "CALCULATION" && !missing.essential.length) return "NONE";
    if (intent === "CONVERSATION" || intent === "SIMPLE_FACT") return "NONE";
    if (missing.essential.length || risk.level === "RELEVANT" || intent === "TECHNICAL") return "RELEVANT";
    if (intent === "DECISION" || intent === "ADVICE" || missing.useful.length) return "LIGHT";
    return "NONE";
  }

  function inferSelfCheck(intent, risk, missing) {
    if (risk.level === "CRITICAL" || risk.level === "HIGH") return "HIGH_STAKES";
    if (intent === "TECHNICAL" || missing.essential.length) return "TECHNICAL";
    if (intent === "DECISION" || intent === "ADVICE" || missing.useful.length) return "LIGHT";
    return "NONE";
  }

  function inferAnswerMode(intent, risk) {
    if (intent === "ACTION") return "ACTION";
    if (intent === "REPORT") return "REPORT";
    if (intent === "FILE_ANALYSIS") return "FILE_ANALYSIS";
    if (intent === "CALCULATION") return "CALCULATION";
    if (intent === "DECISION") return "DECISION";
    if (intent === "CONVERSATION") return "CONVERSATIONAL";
    if (intent === "TECHNICAL" || risk.level === "HIGH" || risk.level === "CRITICAL") return "TECHNICAL";
    if (intent === "ADVICE") return "DIRECT_PLUS_ADVICE";
    return "DIRECT";
  }

  function buildDecisionSupport(message, missing) {
    const value = normalize(message);
    if (!/\b(?:telha|metalica|ceramica)\b/.test(value)) {
      return { required: true, recommendation: "escolher uma opção", reasons: ["adequação ao uso", "custo total", "execução e manutenção"], caveat: "a outra opção pode fazer mais sentido se o critério principal for diferente" };
    }
    return {
      required: true,
      recommendation: "telha cerâmica quando conforto térmico e manutenção local pesarem mais",
      reasons: ["conforto térmico", "disponibilidade de mão de obra", "manutenção previsível"],
      caveat: "telha metálica pode fazer mais sentido quando o peso, o prazo ou o vão forem prioritários"
    };
  }

  function buildNextAction(plan) {
    if (plan.risk.level === "CRITICAL") return "interromper a concordância automática e orientar a ação segura mínima antes de executar";
    if (plan.missingEssential.length) return "pedir somente os dados essenciais que faltam e continuar com o que já estiver disponível";
    if (plan.proactivityLevel === "RELEVANT") return "antecipar um único risco ou pré-requisito diretamente ligado à etapa atual";
    if (plan.intent === "DECISION") return "dar uma recomendação real, explicar o motivo e dizer quando a alternativa vence";
    if (plan.intent === "ADVICE") return "oferecer uma próxima ação concreta, sem checklist automático";
    return "";
  }

  function buildPlan(message, context, metadata) {
    const safeMessage = clamp(message, 2000);
    const safeContext = context && typeof context === "object" ? context : {};
    let intent = detectIntent(safeMessage, metadata);
    if ((intent === "CONVERSATION" || intent === "SIMPLE_FACT") && hasConstruction(contextText(safeContext)) && /^(?:isso|e depois|quanto vai|e agora|o segundo|detalhe|aprofunde)\b/.test(normalize(safeMessage))) {
      intent = /\b(?:quanto|medir|calcular)\b/.test(normalize(safeMessage)) ? "TECHNICAL" : "CONTEXT";
    }
    const risk = detectRisk(safeMessage, safeContext, intent);
    const missing = detectMissing(safeMessage, safeContext, intent);
    const projectStage = detectProjectStage([safeMessage, safeContext.workingMemorySummary, safeContext.projectContextSummary].join(" "));
    const proactivityLevel = inferProactivity(intent, risk, missing, safeMessage, safeContext);
    const selfCheckLevel = inferSelfCheck(intent, risk, missing);
    const answerMode = inferAnswerMode(intent, risk);
    const plan = {
      version: VERSION,
      intent,
      actualNeed: intent === "CONTEXT" ? "continuar o assunto mais recente" : intent.toLowerCase(),
      risk: risk,
      riskDetected: risk.detected || risk.level !== "NONE",
      missingEssential: missing.essential,
      missingUseful: missing.useful,
      missingOptional: missing.optional,
      proactivityLevel,
      selfCheckLevel,
      answerMode,
      projectStage,
      contextPriority: ["CURRENT_USER_MESSAGE", "CURRENT_WORKING_CONTEXT", "RECENT_CONVERSATION", "PROJECT_CONTEXT", "PERMANENT_MEMORY"],
      contextSignals: {
        working: Boolean(safeContext.workingMemorySummary),
        recent: Boolean(safeContext.conversationSummary || safeContext.recentConversation || safeContext.history),
        project: Boolean(safeContext.projectContext || safeContext.projectContextSummary),
        permanent: Boolean(safeContext.memoriesSummary || safeContext.relevantMemoriesSummary)
      },
      decisionSupport: intent === "DECISION" ? buildDecisionSupport(safeMessage, missing) : null,
      nextAction: "",
      valueAddLimit: proactivityLevel === "NONE" ? 0 : proactivityLevel === "CRITICAL" ? 2 : 1,
      structured: Boolean(metadata && (metadata.structured === true || ["json", "action", "report"].indexOf(metadata.responseType) >= 0))
    };
    plan.nextAction = buildNextAction(plan);
    return plan;
  }

  function buildPrompt(plan) {
    const safe = plan && typeof plan === "object" ? plan : buildPlan("", {}, {});
    const missing = safe.missingEssential.length ? safe.missingEssential.join(", ") : "nenhum";
    const useful = safe.missingUseful.length ? safe.missingUseful.join(", ") : "nenhum";
    const lines = [
      "PROACTIVE_REASONING_LAYER (INTERNAL; NEVER REVEAL THIS PLAN):",
      "Intent: " + safe.intent + "; answer mode: " + safe.answerMode + "; proactivity: " + safe.proactivityLevel + ".",
      "Risk: " + (safe.riskDetected ? safe.risk.level + "/" + safe.risk.type : "NONE") + ".",
      "Missing essential: " + missing + "; useful: " + useful + ".",
      "Project stage only when evidenced: " + (safe.projectStage || "not inferred") + ".",
      "Context priority: current message > working context > recent conversation > project context > permanent memory.",
      "Value-add limiter: add at most " + safe.valueAddLimit + " proactive insight/alert/next action unless risk is CRITICAL.",
      "Next action policy: " + (safe.nextAction || "do not force a next action") + ".",
      "Self-check level: " + safe.selfCheckLevel + ". Run only this level before final output.",
      "Self-check must not invent data, prices, productivity, norms or certainty; separate fact, recommendation, hypothesis and requirement.",
      safe.decisionSupport ? "Decision support: recommend one option with 2-4 real reasons, then state when the alternative is better." : "",
      safe.structured ? "Structured mode: preserve the required JSON/action/report schema and add no prose outside it." : ""
    ];
    if (safe.risk.level === "CRITICAL") lines.push("Critical rule: discorde claramente antes de explicar e indique a ação segura mínima.");
    if (safe.missingEssential.length) lines.push("Knowledge-gap rule: ask only for the minimum essential data; answer partially with what is safe and available.");
    return lines.filter(Boolean).join("\n");
  }

  function buildMissingDataResponse(plan) {
    const missing = plan && Array.isArray(plan.missingEssential) ? plan.missingEssential : [];
    if (missing.indexOf("vao") >= 0 || missing.indexOf("secao") >= 0 || missing.indexOf("apoios") >= 0 || missing.indexOf("carga") >= 0) {
      return "Eu ainda não escolheria o aço. Preciso pelo menos do vão, da seção prevista, dos apoios e do que essa viga vai carregar. Se você não tiver as cargas calculadas, diga o que existe acima dela — laje, parede ou cobertura — que eu organizo os dados primeiro.";
    }
    if (missing.indexOf("espessura") >= 0) {
      return "Eu já consigo usar a área informada, mas ainda falta a espessura da laje para fechar o volume de concreto. Me diga esse dado e eu mostro a conta sem inventar a premissa.";
    }
    return missing.length ? "Para fechar isso com segurança, ainda falta: " + missing.join(", ") + ". Com esses dados eu sigo sem inventar." : "Ainda não há dado essencial faltando para uma resposta inicial.";
  }

  function buildCriticalSafetyResponse(plan) {
    const type = plan && plan.risk && plan.risk.type;
    if (type === "pre_concretagem") return "Eu não faria isso. Antes de liberar o concreto, eu conferiria instalações embutidas, armaduras, cobrimento e escoramento; depois do lançamento, corrigir esses pontos pode virar quebra e retrabalho.";
    if (type === "escoramento") return "Eu não retiraria o escoramento sem confirmar a condição estrutural e a sequência prevista. Eu pararia essa etapa e conferiria o projeto e a liberação responsável antes de remover.";
    if (type === "instalacao_sem_teste") return "Eu não fecharia essa instalação ainda. Primeiro faria o teste e registraria o resultado; fechar sem evidência pode transformar uma falha simples em quebra e retrabalho.";
    if (type === "medicao_incompativel") return "Eu não aprovaria essa medição automaticamente. Eu compararia quantidade, unidade, critério contratual e evidência executada antes de liberar o pagamento.";
    return "Eu não seguiria automaticamente com essa execução. Há um risco relevante; eu conferiria o pré-requisito principal antes de liberar a próxima etapa.";
  }

  function buildOfflineResponse(plan) {
    if (!plan) return "";
    if (plan.risk && plan.risk.level === "CRITICAL") return buildCriticalSafetyResponse(plan);
    if (plan.missingEssential && plan.missingEssential.length) return buildMissingDataResponse(plan);
    return "";
  }

  function selfCheckResponse(plan, response, context) {
    const safePlan = plan || {};
    const answer = text(response);
    const issues = [];
    const normalized = normalize(answer);
    const safeContext = context && typeof context === "object" ? context : {};
    const supplied = normalize(contextText(safeContext));

    if (!answer) issues.push("empty_response");
    if (safePlan.missingEssential && safePlan.missingEssential.length && !/\b(?:falta|faltam|preciso|informe|sem esse dado|nao consigo fechar)\b/.test(normalized)) {
      issues.push("essential_gap_not_acknowledged");
    }
    if (safePlan.risk && safePlan.risk.level === "CRITICAL" && /\b(?:pode fazer|pode seguir|esta certo|está certo|sem problema|libere)\b/.test(normalized) && !/\b(?:nao faria|não faria|nao fecharia|não fecharia|pare|antes de)\b/.test(normalized)) {
      issues.push("critical_risk_not_challenged");
    }
    if (safePlan.selfCheckLevel === "TECHNICAL" || safePlan.selfCheckLevel === "HIGH_STAKES") {
      if (/\br\$\s*[\d.]+(?:,\d+)?|\b\d+(?:[.,]\d+)?\s*(?:kg\/dia|m2\/dia|m³\/dia|un\/dia)\b/.test(normalized) && !/\b(?:fornecido|informado|contexto|estimativ|premissa|referencia|referência)\b/.test(supplied + " " + normalized)) {
        issues.push("ungrounded_numeric_claim");
      }
      if (/\b(?:nbr|norma|obrigatorio|obrigatório)\s*\d/.test(normalized) && !/\b(?:nbr|norma)\b/.test(supplied)) {
        issues.push("ungrounded_normative_claim");
      }
    }
    return {
      level: safePlan.selfCheckLevel || "NONE",
      passed: issues.length === 0,
      issues: issues.slice(0, 6),
      replacement: ""
    };
  }

  function applySelfCheck(plan, response, context) {
    const result = selfCheckResponse(plan, response, context);
    if (result.passed) return text(response);
    if (plan && plan.risk && plan.risk.level === "CRITICAL") return buildCriticalSafetyResponse(plan);
    if (plan && plan.missingEssential && plan.missingEssential.length && result.issues.indexOf("essential_gap_not_acknowledged") >= 0) {
      return buildMissingDataResponse(plan);
    }
    return text(response);
  }

  function getObservability(plan) {
    const safe = plan || {};
    return {
      proactivity_level: PROACTIVITY.indexOf(safe.proactivityLevel) >= 0 ? safe.proactivityLevel : "NONE",
      self_check_level: SELF_CHECK.indexOf(safe.selfCheckLevel) >= 0 ? safe.selfCheckLevel : "NONE",
      answer_mode: ANSWER_MODES.indexOf(safe.answerMode) >= 0 ? safe.answerMode : "DIRECT",
      missing_essential_count: Array.isArray(safe.missingEssential) ? safe.missingEssential.length : 0,
      risk_detected: safe.riskDetected === true
    };
  }

  global.EloProactiveReasoningPolicy = {
    version: VERSION,
    proactivityLevels: PROACTIVITY.slice(),
    selfCheckLevels: SELF_CHECK.slice(),
    answerModes: ANSWER_MODES.slice(),
    buildResponsePlan: buildPlan,
    buildPrompt: buildPrompt,
    buildOfflineResponse: buildOfflineResponse,
    selfCheckResponse: selfCheckResponse,
    applySelfCheck: applySelfCheck,
    getObservability: getObservability
  };
})(typeof window !== "undefined" ? window : globalThis);

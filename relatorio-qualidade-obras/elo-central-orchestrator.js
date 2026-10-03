(function initEloCentralOrchestrator(global) {
  "use strict";

  const VERSION = "20261003-vnext-1";
  const STATE_KEY = "elo_central_orchestrator_state_v1";
  const TRACE_KEY = "elo_central_orchestrator_trace_v1";
  const MAX_TURNS = 50;
  const MAX_TRACE = 80;
  const SECRET_KEY = /password|senha|token|secret|service[_-]?role|api[_-]?key|authorization|cookie/i;

  function normalize(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function text(value, limit) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, limit || 1200);
  }

  function id(prefix, random) {
    const suffix = random ? String(random()).replace(/[^a-z0-9_-]/gi, "").slice(0, 12) : Math.random().toString(36).slice(2, 10);
    return String(prefix || "elo") + "_" + Date.now().toString(36) + "_" + (suffix || "id");
  }

  function clone(value, depth) {
    if (depth > 3 || value == null) return value;
    if (typeof value === "string") return text(value, 1600);
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.slice(0, 24).map(function (item) { return clone(item, depth + 1); });
    if (typeof value === "object") {
      const result = {};
      Object.keys(value).slice(0, 40).forEach(function (key) {
        if (SECRET_KEY.test(key)) return;
        result[text(key, 80)] = clone(value[key], depth + 1);
      });
      return result;
    }
    return undefined;
  }

  function memoryStorage() {
    const data = {};
    return {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
      setItem: function (key, value) { data[key] = String(value); },
      removeItem: function (key) { delete data[key]; }
    };
  }

  function getStorage(custom) {
    if (custom && typeof custom.getItem === "function") return custom;
    try {
      if (global.localStorage && typeof global.localStorage.getItem === "function") return global.localStorage;
    } catch (error) {}
    return memoryStorage();
  }

  function createState(seed, clock, random) {
    const source = seed && typeof seed === "object" ? seed : {};
    return {
      version: VERSION,
      conversationId: text(source.conversationId, 160) || id("eloconv", random),
      turnIndex: Number(source.turnIndex) || 0,
      surface: text(source.surface, 60) || "elo",
      activeSubject: text(source.activeSubject, 180),
      activeEntities: clone(source.activeEntities || {}, 0) || {},
      activeDocument: clone(source.activeDocument || null, 0),
      activeWork: clone(source.activeWork || null, 0),
      pendingAction: clone(source.pendingAction || null, 0),
      memory: {
        working: Array.isArray(source.memory && source.memory.working) ? source.memory.working.slice(-12).map(function (item) { return clone(item, 0); }) : [],
        explicit: Array.isArray(source.memory && source.memory.explicit) ? source.memory.explicit.slice(-24).map(function (item) { return clone(item, 0); }) : [],
        recalled: Array.isArray(source.memory && source.memory.recalled) ? source.memory.recalled.slice(-12).map(function (item) { return clone(item, 0); }) : []
      },
      lastIntent: text(source.lastIntent, 100),
      lastRoute: text(source.lastRoute, 100),
      lastAnswer: text(source.lastAnswer, 1800),
      recentTurns: Array.isArray(source.recentTurns) ? source.recentTurns.slice(-MAX_TURNS).map(function (item) { return clone(item, 0); }) : [],
      updatedAt: text(source.updatedAt, 60) || new Date(clock()).toISOString()
    };
  }

  function createOrchestrator(options) {
    const config = options || {};
    const runtimeConfig = { enabled: config.enabled !== false, shadow: config.shadow !== false };
    const storage = getStorage(config.storage);
    const clock = typeof config.now === "function" ? config.now : Date.now;
    const random = typeof config.random === "function" ? config.random : Math.random;
    let state = createState(readState(), clock, random);
    const tools = new Map();
    const trace = readTrace();

    function readState() {
      try { return JSON.parse(storage.getItem(STATE_KEY) || "null") || {}; } catch (error) { return {}; }
    }

    function persist() {
      try { storage.setItem(STATE_KEY, JSON.stringify(clone(state, 0))); } catch (error) {}
    }

    function readTrace() {
      try {
        const parsed = JSON.parse(storage.getItem(TRACE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.slice(-MAX_TRACE) : [];
      } catch (error) { return []; }
    }

    function record(event, details) {
      const entry = {
        event: text(event, 80) || "event",
        timestamp: new Date(clock()).toISOString(),
        conversationId: text(state.conversationId, 160),
        turnIndex: state.turnIndex,
        details: clone(details || {}, 0) || {}
      };
      trace.push(entry);
      while (trace.length > MAX_TRACE) trace.shift();
      try { storage.setItem(TRACE_KEY, JSON.stringify(trace)); } catch (error) {}
      if (config.logger && typeof config.logger.info === "function") {
        try { config.logger.info("ELO_ORCHESTRATOR", entry); } catch (error) {}
      }
      return entry;
    }

    function registerTool(definition) {
      const def = definition && typeof definition === "object" ? definition : {};
      const toolId = text(def.id, 100);
      if (!toolId || typeof def.run !== "function") throw new Error("elo_tool_definition_invalid");
      tools.set(toolId, {
        id: toolId,
        description: text(def.description, 240),
        capabilities: Array.isArray(def.capabilities) ? def.capabilities.map(function (item) { return text(item, 80); }).filter(Boolean).slice(0, 12) : [],
        priority: Number(def.priority) || 0,
        matches: typeof def.matches === "function" ? def.matches : function () { return false; },
        run: def.run
      });
      return toolId;
    }

    function listTools() {
      return Array.from(tools.values()).map(function (tool) {
        return { id: tool.id, description: tool.description, capabilities: tool.capabilities.slice(), priority: tool.priority };
      });
    }

    function isContinuation(message) {
      const value = normalize(message);
      return /^(sim|nao|não|ok|pode|continue|continuar|isso|essa|esse|e depois|por que|por quê|como assim|quanto|qual deles|qual delas)\b/.test(value) || /\b(isso|essa analise|essa análise|esse documento|este arquivo|o anterior)\b/.test(value);
    }

    function extractEntities(message) {
      const raw = text(message, 1200);
      const value = normalize(raw);
      const entities = {};
      const project = raw.match(/(?:obra|projeto|empreendimento)\s+(?:chamad[ao]|de|da|do|em|:)?\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 _-]{2,80})/i);
      const document = raw.match(/(?:documento|arquivo|pdf|relatorio|relatório|laudo)\s+(?:chamad[oa]|de|da|do|:)?\s*([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 _-]{2,80})/i);
      const quantity = raw.match(/\b(\d+(?:[,.]\d+)?)\s*(m2|m²|m|un|unidade|kg|l|litros?)\b/i);
      if (project) entities.project = text(project[1], 100);
      if (document) entities.document = text(document[1], 100);
      if (quantity) entities.quantity = { value: Number(quantity[1].replace(",", ".")), unit: normalize(quantity[2]) };
      if (/\b(?:cimento|argamassa|vergalhao|vergalhão|material|estoque)\b/.test(value)) entities.materialTopic = true;
      return entities;
    }

    function classify(message) {
      const raw = text(message, 1600);
      const value = normalize(raw);
      const candidates = [];
      function add(intent, confidence, reason, metadata) { candidates.push(Object.assign({ intent: intent, confidence: confidence, reason: reason }, metadata || {})); }
      if (!value) return [{ intent: "empty", confidence: 1, reason: "empty_input" }];
      if (isContinuation(raw) && (state.pendingAction || state.activeDocument || state.activeWork || state.lastIntent)) {
        add("follow_up", 0.98, "continuation_with_active_context", { referent: state.activeDocument ? "active_document" : state.activeWork ? "active_work" : "last_turn" });
      }
      if (/\b(?:quanto|qual e|qual é|que horas|que dia|data de hoje|hoje)\b/.test(value) && /\b(?:dia|data|hora|horas|mes|mês|ano)\b/.test(value)) add("date_time", 0.95, "date_or_time_request");
      if (/^[\d\s()+\-*/.,x×]+[?]?$/.test(value) || /\bquanto e\b.*\d+\s*[+\-x×*/]\s*\d+/.test(value)) add("math", 0.97, "arithmetic_expression");
      if (/\b(?:memorize|memoriza|guarde|guardar|lembre|lembra|esqueca|esqueça|apague da memoria|apague da memória)\b/.test(value)) add("memory_write", 0.96, "explicit_memory_command");
      else if (/\b(?:o que voce lembra|o que você lembra|lembra do que|minha memoria|minha memória|continue de onde|retome de onde)\b/.test(value)) add("memory_recall", 0.92, "explicit_memory_recall");
      if (state.activeDocument && /\b(?:isso|essa analise|essa análise|esse documento|este documento|este arquivo|resuma|resumir|gere|gerar|exporte|exportar)\b/.test(value)) add("document_context", 0.91, "active_document_reference");
      if (/\b(?:fissura|trinca|rachadura|infiltracao|infiltração|parede|laje|pilar|viga|fundacao|fundação|reboco|argamassa|alvenaria|sinapi|orse|quantitativo|patologia|vistoria)\b/.test(value)) add("engineering", 0.84, "engineering_domain_signal");
      if (/\b(?:abrir|abra|acessar|acesse|navegar|me leve|usar)\b/.test(value) && /\b(?:relatorio|relatório|cadista|estoque|stock|rdo|orcamento|orçamento|planta)\b/.test(value)) add("tool_request", 0.9, "explicit_tool_request");
      if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|obrigado|obrigada|valeu|show|beleza|tudo bem)[!.? ]*$/i.test(raw)) add("conversation", 0.9, "social_message");
      if (!candidates.length) add("conversation", 0.55, "default_conversation");
      return candidates.sort(function (left, right) { return right.confidence - left.confidence; });
    }

    function resolveReferences(message, entities) {
      const value = normalize(message);
      const references = {};
      if (state.activeDocument && (/\b(?:isso|essa analise|essa análise|esse documento|este documento|este arquivo|o pdf|o arquivo)\b/.test(value) || isContinuation(message))) references.document = clone(state.activeDocument, 0);
      if (state.activeWork && /\b(?:essa obra|este projeto|essa obra|a obra|o projeto)\b/.test(value)) references.work = clone(state.activeWork, 0);
      if (state.lastIntent && isContinuation(message)) references.lastIntent = state.lastIntent;
      if (entities && entities.document && state.activeDocument) references.document = clone(state.activeDocument, 0);
      return references;
    }

    function selectTool(plan) {
      const matches = Array.from(tools.values()).map(function (tool) {
        let score = 0;
        try { score = Number(tool.matches(plan)) || 0; } catch (error) { record("tool_match_failed", { toolId: tool.id, error: text(error && error.message, 160) }); }
        return { tool: tool, score: score + (tool.priority / 1000) };
      }).filter(function (item) { return item.score > 0; }).sort(function (left, right) { return right.score - left.score; });
      return matches.length ? matches[0].tool : null;
    }

    function verify(response, context) {
      const source = response && typeof response === "object" ? response : { text: response };
      const answer = text(source.text || source.fullAnswer || source.shortAnswer || "", 8000);
      const warnings = [];
      let safeAnswer = answer;
      if (SECRET_KEY.test(answer)) {
        safeAnswer = answer.replace(/(password|senha|token|secret|service[_-]?role|api[_-]?key|authorization|cookie)\s*[:=]\s*[^\s,;]+/ig, "$1: [redacted]");
        warnings.push("sensitive_output_redacted");
      }
      if (source.claims && source.evidenceRequired && !source.evidence) warnings.push("claim_without_evidence");
      if (!safeAnswer) warnings.push("empty_answer");
      const result = Object.assign({}, clone(source, 0) || {}, { text: safeAnswer, verified: warnings.indexOf("empty_answer") < 0 && warnings.indexOf("claim_without_evidence") < 0, warnings: warnings, context: clone(context || {}, 0) || {} });
      if (warnings.length) record("answer_verified_with_warnings", { warnings: warnings });
      return result;
    }

    function makePlan(message, options) {
      const raw = text(message, 1600);
      const entities = extractEntities(raw);
      const candidates = classify(raw);
      const winner = candidates[0];
      const plan = {
        message: raw,
        normalized: normalize(raw),
        intent: winner.intent,
        confidence: winner.confidence,
        reason: winner.reason,
        candidates: candidates.slice(0, 8),
        entities: entities,
        references: resolveReferences(raw, entities),
        context: {
          conversationId: state.conversationId,
          turnIndex: state.turnIndex + 1,
          surface: state.surface,
          activeSubject: state.activeSubject,
          activeDocument: clone(state.activeDocument, 0),
          activeWork: clone(state.activeWork, 0),
          pendingAction: clone(state.pendingAction, 0),
          lastIntent: state.lastIntent
        },
        options: clone(options || {}, 0) || {}
      };
      plan.tool = selectTool(plan);
      return plan;
    }

    function updateContext(plan, result) {
      const entities = plan.entities || {};
      if (entities.project) state.activeWork = Object.assign({}, state.activeWork || {}, { name: entities.project, source: "conversation" });
      if (entities.document) state.activeDocument = Object.assign({}, state.activeDocument || {}, { title: entities.document, source: "conversation" });
      if (plan.intent === "engineering") state.activeSubject = plan.normalized.slice(0, 180);
      if (result && result.pendingAction) state.pendingAction = clone(result.pendingAction, 0);
      if (result && result.activeDocument) state.activeDocument = clone(result.activeDocument, 0);
      if (result && result.activeWork) state.activeWork = clone(result.activeWork, 0);
      state.lastIntent = plan.intent;
      state.lastRoute = plan.tool ? plan.tool.id : plan.intent;
      state.lastAnswer = text(result && (result.text || result.fullAnswer || result.shortAnswer), 1800);
      state.turnIndex += 1;
      state.recentTurns.push({ turnIndex: state.turnIndex, user: plan.message.slice(0, 900), intent: plan.intent, route: state.lastRoute, timestamp: new Date(clock()).toISOString() });
      state.recentTurns = state.recentTurns.slice(-MAX_TURNS);
      state.memory.working = state.recentTurns.slice(-12);
      state.updatedAt = new Date(clock()).toISOString();
      persist();
    }

    function execute(message, options) {
      const plan = makePlan(message, options);
      record("plan_created", { intent: plan.intent, confidence: plan.confidence, toolId: plan.tool && plan.tool.id, reason: plan.reason });
      if (!plan.tool) {
        const result = { text: "Não consegui encaminhar essa solicitação com segurança ainda. Pode reformular em uma frase mais direta?", safeFallback: true };
        updateContext(plan, result);
        return Promise.resolve({ plan: plan, result: verify(result, plan.context), state: getState() });
      }
      let output;
      try { output = plan.tool.run(plan, getState()); } catch (error) {
        record("tool_execution_failed", { toolId: plan.tool.id, error: text(error && error.message, 180) });
        output = { text: "Não consegui concluir essa etapa com segurança agora. Posso continuar a conversa sem perder o contexto.", safeFallback: true, toolError: true };
      }
      return Promise.resolve(output).then(function (result) {
        const verified = verify(result, plan.context);
        updateContext(plan, verified);
        record("turn_completed", { intent: plan.intent, toolId: plan.tool.id, verified: verified.verified !== false, warnings: verified.warnings });
        return { plan: plan, result: verified, state: getState() };
      }).catch(function (error) {
        record("tool_promise_failed", { toolId: plan.tool.id, error: text(error && error.message, 180) });
        const result = verify({ text: "Não consegui concluir essa etapa com segurança agora. O contexto da conversa foi preservado.", safeFallback: true, toolError: true }, plan.context);
        updateContext(plan, result);
        return { plan: plan, result: result, state: getState() };
      });
    }

    function observe(message, options) {
      if (!runtimeConfig.shadow) return null;
      const plan = makePlan(message, options);
      record("shadow_plan", { intent: plan.intent, confidence: plan.confidence, toolId: plan.tool && plan.tool.id, reason: plan.reason });
      return plan;
    }

    function setActiveDocument(documentContext) {
      state.activeDocument = clone(documentContext || null, 0);
      persist();
      record("active_document_set", { present: !!state.activeDocument });
      return clone(state.activeDocument, 0);
    }

    function setActiveWork(workContext) {
      state.activeWork = clone(workContext || null, 0);
      persist();
      record("active_work_set", { present: !!state.activeWork });
      return clone(state.activeWork, 0);
    }

    function remember(value, category) {
      const item = { id: id("memory", random), category: text(category, 60) || "working", value: text(value, 1200), createdAt: new Date(clock()).toISOString() };
      if (!item.value) return null;
      if (item.category === "explicit") state.memory.explicit.push(item);
      else state.memory.working.push(item);
      state.memory.explicit = state.memory.explicit.slice(-24);
      state.memory.working = state.memory.working.slice(-12);
      persist();
      record("memory_recorded", { category: item.category });
      return clone(item, 0);
    }

    function getState() { return clone(state, 0); }
    function getTrace() { return trace.slice(-MAX_TRACE).map(function (item) { return clone(item, 0); }); }
    function reset() {
      state = createState({ surface: state.surface }, clock, random);
      try { storage.removeItem(STATE_KEY); storage.removeItem(TRACE_KEY); } catch (error) {}
      trace.length = 0;
      return getState();
    }

    function configure(next) {
      const values = next && typeof next === "object" ? next : {};
      if (values.enabled !== undefined) runtimeConfig.enabled = values.enabled !== false;
      if (values.shadow !== undefined) runtimeConfig.shadow = values.shadow !== false;
      return Object.assign({}, runtimeConfig);
    }

    registerTool({ id: "fast.math", description: "Resolve expressões aritméticas simples sem chamar a rede.", capabilities: ["math", "deterministic", "offline"], priority: 100, matches: function (plan) { return plan.intent === "math" ? 100 : 0; }, run: function (plan) {
      const expression = plan.normalized.replace(/x|×/g, "*").replace(/[^0-9+\-*/()., ]/g, "").replace(/,/g, ".");
      if (!expression || !/^[0-9+\-*/(). ]+$/.test(expression)) return { text: "Não consegui calcular essa expressão com segurança.", safeFallback: true };
      try {
        const result = Function("\"use strict\"; return (" + expression + ");")();
        if (!Number.isFinite(result)) throw new Error("non_finite_result");
        return { text: String(result), deterministic: true, evidence: "local_arithmetic" };
      } catch (error) { return { text: "Não consegui calcular essa expressão com segurança.", safeFallback: true }; }
    } });
    registerTool({ id: "fast.date-time", description: "Responde data e hora usando o relógio do ambiente.", capabilities: ["date_time", "deterministic", "offline"], priority: 99, matches: function (plan) { return plan.intent === "date_time" ? 100 : 0; }, run: function (plan) {
      const now = new Date(clock());
      return { text: "Hoje é " + now.toISOString().slice(0, 10) + " e agora são " + now.toISOString().slice(11, 16) + " UTC.", deterministic: true, evidence: "runtime_clock" };
    } });
    registerTool({ id: "memory.explicit", description: "Registra memória somente quando o usuário pede explicitamente.", capabilities: ["memory_write", "memory_recall"], priority: 96, matches: function (plan) { return plan.intent === "memory_write" || plan.intent === "memory_recall" ? 100 : 0; }, run: function (plan) {
      if (plan.intent === "memory_write") {
        const value = plan.message.replace(/^.*?\b(?:memorize|memoriza|guarde|guardar|lembre)\b\s*(?:que\s*)?/i, "").trim();
        return { text: value ? "Guardei isso como memória explícita." : "Diga exatamente o que devo guardar.", pendingAction: value ? null : { type: "memory_write", required: "value" }, memory: value ? remember(value, "explicit") : null };
      }
      const memories = state.memory.explicit.slice(-4);
      return { text: memories.length ? "Lembro: " + memories.map(function (item) { return item.value; }).join("; ") : "Ainda não há memória explícita disponível.", memories: memories };
    } });
    registerTool({ id: "context.follow-up", description: "Resolve mensagens curtas usando a intenção e os referentes ativos.", capabilities: ["follow_up", "entity_resolution", "context"], priority: 95, matches: function (plan) { return plan.intent === "follow_up" ? 100 : 0; }, run: function (plan) {
      return { text: "Entendi como continuação de " + (plan.references.lastIntent || state.lastIntent || "nossa conversa") + ".", pendingAction: state.pendingAction, activeDocument: state.activeDocument, activeWork: state.activeWork, contextResolution: plan.references };
    } });
    registerTool({ id: "context.document", description: "Preserva e encaminha referências ao documento ativo.", capabilities: ["document_context", "long_document", "reference_resolution"], priority: 92, matches: function (plan) { return plan.intent === "document_context" ? 100 : 0; }, run: function (plan) {
      return { text: "Vou usar o documento ativo como contexto desta solicitação.", activeDocument: state.activeDocument, contextResolution: plan.references };
    } });
    registerTool({ id: "domain.engineering", description: "Marca solicitações técnicas para o motor de engenharia legado durante a migração.", capabilities: ["engineering", "technical", "legacy_adapter"], priority: 84, matches: function (plan) { return plan.intent === "engineering" ? 100 : 0; }, run: function (plan) {
      return { text: "Solicitação técnica identificada e encaminhada ao motor de engenharia.", route: "legacy.engineering", activeWork: state.activeWork, activeDocument: state.activeDocument, delegated: true };
    } });
    registerTool({ id: "conversation.general", description: "Mantém conversa geral sem inventar domínio ou dados.", capabilities: ["conversation", "safe_fallback"], priority: 50, matches: function (plan) { return plan.intent === "conversation" || plan.intent === "empty" ? 50 : 0; }, run: function () { return { text: "Entendi. Pode me dizer o próximo passo?", conversational: true }; } });

    return {
      version: VERSION,
      registerTool: registerTool,
      listTools: listTools,
      classify: classify,
      plan: makePlan,
      orchestrate: execute,
      observe: observe,
      verify: verify,
      remember: remember,
      setActiveDocument: setActiveDocument,
      setActiveWork: setActiveWork,
      getState: getState,
      getTrace: getTrace,
      reset: reset,
      configure: configure,
      isEnabled: function () { return runtimeConfig.enabled; },
      isShadowEnabled: function () { return runtimeConfig.shadow; },
      config: runtimeConfig
    };
  }

  if (!global.EloCentralOrchestrator) {
    const flags = global.ELO_ORCHESTRATOR_VNEXT && typeof global.ELO_ORCHESTRATOR_VNEXT === "object" ? global.ELO_ORCHESTRATOR_VNEXT : {};
    global.EloCentralOrchestrator = createOrchestrator({ enabled: flags.enabled !== false, shadow: flags.shadow !== false });
  }
  global.EloCentralOrchestratorFactory = createOrchestrator;
})(typeof window !== "undefined" ? window : globalThis);

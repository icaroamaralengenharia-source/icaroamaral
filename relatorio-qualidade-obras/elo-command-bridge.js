(function () {
  "use strict";

  const MODULES = ["budget", "obrareport_rdo", "obrareport_report", "stock_full", "stock_obras", "memory", "alerts"];
  const DANGEROUS_ACTIONS = new Set([
    "create_rdo",
    "close_rdo",
    "update_report",
    "create_product",
    "stock_entry",
    "stock_exit",
    "update_budget",
    "clear_memory",
    "generate_final_document",
    "create_user",
    "create_company"
  ]);

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function result(input, values) {
    const safe = values || {};
    const dangerous = DANGEROUS_ACTIONS.has(safe.action || input.action);
    return {
      ok: safe.ok !== false,
      handled: safe.handled !== false,
      module: safe.module || input.module || "",
      action: safe.action || input.action || "",
      mode: safe.mode || (dangerous ? "preview" : "read"),
      requiresAuth: safe.requiresAuth === true,
      requiresConfirmation: dangerous || safe.requiresConfirmation === true,
      preview: clean(safe.preview),
      data: safe.data || null,
      humanAnswer: clean(safe.humanAnswer || safe.preview || safe.error),
      error: clean(safe.error)
    };
  }

  function unsupported(input, reason) {
    return result(input, {
      ok: false,
      handled: true,
      mode: "unavailable",
      humanAnswer: reason || "Esse módulo existe, mas ainda não tenho uma ponte segura para executar esse comando pelo ELO.",
      error: reason || "unavailable"
    });
  }

  function needsAuth(input, message) {
    return result(input, {
      ok: false,
      handled: true,
      requiresAuth: true,
      mode: "auth_required",
      humanAnswer: message || "Preciso que você esteja autenticado para consultar esses dados reais."
    });
  }

  function getAuthToken(context) {
    const fromContext = context && (context.authToken || context.token);
    if (fromContext) return clean(fromContext);
    try {
      return clean(window.localStorage.getItem("elo_core_auth_token") || window.localStorage.getItem("obrareport_access_token") || window.localStorage.getItem("stock_full_access_token"));
    } catch (error) {
      return "";
    }
  }

  function localBudgetRecords() {
    const records = [];
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!/elo.*budget|orcamento|orçamento/i.test(key || "")) continue;
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) records.push.apply(records, parsed);
          else if (parsed && typeof parsed === "object") records.push(parsed);
        } catch (error) {}
      }
    } catch (error) {}
    return records.filter(Boolean).slice(-20);
  }

  function executeBudget(input) {
    const action = input.action || "current_budget";
    const text = normalize((input.payload && input.payload.message) || "");
    const records = localBudgetRecords();
    const latest = records[records.length - 1] || null;
    if (/bdi|padrao|padrão|escopo|retire|inclua|acrescente|atualize/.test(text) || action === "preview_change") {
      return result(input, {
        action: "preview_change",
        mode: "preview",
        requiresConfirmation: true,
        preview: "Preparei um preview de alteração do orçamento. Antes de mudar BDI, padrão ou escopo salvo, preciso da sua confirmação.",
        data: { hasCurrentBudget: !!latest }
      });
    }
    if (/pdf/.test(text) || action === "generate_pdf") {
      if (!latest) return unsupported(input, "Não encontrei orçamento válido salvo para gerar PDF.");
      return result(input, {
        action: "generate_pdf",
        requiresConfirmation: true,
        preview: "Encontrei um orçamento salvo e posso preparar o PDF para revisão. Confirme antes de gerar o documento final.",
        data: { budget: latest }
      });
    }
    if (/listar|ultimos|últimos/.test(text) || action === "list") {
      return result(input, {
        action: "list",
        humanAnswer: records.length ? "Encontrei " + records.length + " orçamento(s) salvo(s) localmente." : "Não encontrei orçamentos salvos nesta sessão.",
        data: { count: records.length, records: records.slice(-10) }
      });
    }
    if (/pendencia|pendência|faltando/.test(text) || action === "pending") {
      return result(input, {
        action: "pending",
        humanAnswer: latest ? "Consigo revisar as pendências do orçamento salvo mais recente." : "Não encontrei orçamento ativo para listar pendências.",
        data: { budget: latest }
      });
    }
    return result(input, {
      action: "current_budget",
      humanAnswer: latest ? "Encontrei o orçamento salvo mais recente nesta sessão." : "Não encontrei orçamento salvo ou ativo nesta sessão.",
      data: { budget: latest }
    });
  }

  function executeObraReport(input, type) {
    const action = input.action || (type === "rdo" ? "list_rdos" : "list_reports");
    const hasToken = !!getAuthToken(input.context || {});
    if (!hasToken) return needsAuth(input, type === "rdo" ? "Preciso de autenticação para consultar RDOs reais da obra." : "Preciso de autenticação para consultar relatórios reais da obra.");
    if (/create|new|novo|criar/.test(action) || action.indexOf("preview") >= 0) {
      return result(input, {
        action: type === "rdo" ? "preview_new_rdo" : "preview_update_report",
        mode: "preview",
        requiresConfirmation: true,
        preview: type === "rdo" ? "Posso preparar um rascunho de novo RDO, mas não vou salvar sem confirmação." : "Posso preparar um preview de atualização do relatório, mas não vou alterar o documento sem confirmação."
      });
    }
    return result(input, {
      action,
      requiresAuth: true,
      humanAnswer: type === "rdo" ? "A ponte com RDO está pronta para consulta autenticada de lista, último RDO, equipes, materiais e ocorrências." : "A ponte com relatórios está pronta para consulta autenticada de lista, último relatório, manifestações, fotos e metadados.",
      data: { endpointFamily: type === "rdo" ? "obrareport_rdos" : "obrareport_reports" }
    });
  }

  function executeStockFull(input) {
    const action = input.action || "list_products";
    const text = normalize((input.payload && input.payload.message) || "");
    const hasToken = !!getAuthToken(input.context || {});
    if (/cadastre|crie usuario|crie usuário|empresa|entrada|saida|saída|retirar|retire|corrija|importe/.test(text)) {
      return result(input, {
        action: /entrada/.test(text) ? "stock_entry" : /saida|saída|retirar|retire/.test(text) ? "stock_exit" : /usuario|usuário/.test(text) ? "create_user" : /empresa/.test(text) ? "create_company" : "create_product",
        mode: "preview",
        requiresAuth: !hasToken,
        requiresConfirmation: true,
        preview: "Preparei apenas um preview. Cadastro, entrada, saída, usuário, empresa ou correção de produto exigem confirmação antes de executar."
      });
    }
    if (!hasToken) return needsAuth(input, "Preciso de autenticação para consultar produtos, saldo e movimentações reais do Stock Full.");
    return result(input, {
      action,
      requiresAuth: true,
      humanAnswer: "A ponte do Stock Full está pronta para consulta autenticada de produtos, saldos, movimentações, estoque baixo e auditoria.",
      data: { endpointFamily: "stock_full" }
    });
  }

  function executeStockObras(input) {
    const text = normalize((input.payload && input.payload.message) || "");
    const engine = window.StockAiCompositionEngine || {};
    const search = window.CompositionSearchEngine || window.EloCompositionSearchEngine || {};
    const query = clean((input.payload && (input.payload.query || input.payload.message)) || "");
    let matches = [];
    try {
      if (typeof search.search === "function") matches = search.search(query) || [];
      else if (typeof engine.searchCompositions === "function") matches = engine.searchCompositions(query) || [];
    } catch (error) {
      matches = [];
    }
    if (/exporte|csv|xlsx/.test(text)) {
      return result(input, {
        action: "preview_export",
        mode: "preview",
        requiresConfirmation: true,
        preview: "Posso preparar a exportação da composição ou dos insumos, mas ainda não exportei nada.",
        data: { matches: matches.slice ? matches.slice(0, 5) : [] }
      });
    }
    return result(input, {
      action: input.action || "search_composition",
      humanAnswer: matches && matches.length ? "Encontrei composições candidatas para sua consulta." : "Consultei as bases locais disponíveis, mas não encontrei correspondência exata carregada nesta sessão.",
      data: { matches: matches && matches.slice ? matches.slice(0, 5) : [] }
    });
  }

  function executeMemory(input) {
    const action = input.action || "list_memories";
    const text = normalize((input.payload && input.payload.message) || "");
    if (/limpe|apague|delete|remova/.test(text)) {
      return result(input, {
        action: "clear_memory",
        mode: "preview",
        requiresConfirmation: true,
        preview: "Limpeza de memória permanente exige confirmação. Posso mostrar antes o que seria afetado."
      });
    }
    return result(input, {
      action,
      requiresAuth: !getAuthToken(input.context || {}),
      humanAnswer: "Consigo consultar memórias, contexto técnico ativo e dados de conversa disponíveis para esta sessão.",
      data: { endpointFamily: "elo_memory" }
    });
  }

  function executeAlerts(input) {
    const hasToken = !!getAuthToken(input.context || {});
    if (!hasToken) return needsAuth(input, "Preciso de autenticação e obra ativa para consultar alertas reais.");
    return result(input, {
      action: input.action || "list_alerts",
      requiresAuth: true,
      humanAnswer: "A ponte de alertas está pronta para consultar alertas, pendências e atenção da obra ativa.",
      data: { endpointFamily: "elo_obra_attention" }
    });
  }

  function execute(input) {
    const safe = input && typeof input === "object" ? input : {};
    if (MODULES.indexOf(safe.module) < 0) return unsupported(safe, "Módulo fora do escopo da Fase 1 do ELO.");
    if (safe.module === "budget") return executeBudget(safe);
    if (safe.module === "obrareport_rdo") return executeObraReport(safe, "rdo");
    if (safe.module === "obrareport_report") return executeObraReport(safe, "report");
    if (safe.module === "stock_full") return executeStockFull(safe);
    if (safe.module === "stock_obras") return executeStockObras(safe);
    if (safe.module === "memory") return executeMemory(safe);
    if (safe.module === "alerts") return executeAlerts(safe);
    return unsupported(safe);
  }

  window.EloCommandBridge = Object.assign({}, window.EloCommandBridge || {}, {
    execute,
    modules: MODULES.slice()
  });
})();

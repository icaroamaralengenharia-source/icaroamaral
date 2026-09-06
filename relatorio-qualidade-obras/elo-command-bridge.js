(function () {
  "use strict";

  const MODULES = ["budget", "obrareport_rdo", "obrareport_report", "stock_full", "stock_obras", "elo_autopilot", "memory", "alerts"];
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
    "publish_editorial_content",
    "create_user",
    "create_company"
  ]);
  const STOCK_PENDING_KEY = "elo_action_bus_stock_full_pending_v1";
  const STOCK_CONFIRMATION_TTL_MS = 10 * 60 * 1000;
  const NUMBER_WORDS = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cem: 100 };

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
      const keys = ["stock_full_access_token", "elo_core_auth_token", "obrareport_access_token", "sb-stock-full-auth-token", "sb-stock-full-backend-auth-token", "stockFullSupabaseToken"];
      for (const key of keys) {
        const raw = clean(window.localStorage.getItem(key) || window.sessionStorage && window.sessionStorage.getItem(key));
        if (!raw) continue;
        if (raw.charAt(0) === "{") {
          try {
            const parsed = JSON.parse(raw);
            const nested = parsed && (parsed.access_token || parsed.currentSession && parsed.currentSession.access_token || parsed.session && parsed.session.access_token);
            if (nested) return clean(nested);
          } catch (error) {}
        }
        return raw;
      }
      return "";
    } catch (error) {
      return "";
    }
  }

  function getIdentity(input) {
    const context = input && input.context || {};
    const identity = context.identity || {};
    return {
      companyId: clean(context.companyId || context.institutionId || identity.companyId || identity.institutionId || identity.company_id || identity.institution_id),
      userId: clean(context.userId || identity.userId || identity.id || identity.user_id),
      deviceId: clean(context.deviceId || identity.deviceId || "elo-web")
    };
  }

  function getStockEndpoint(path) {
    const configuredBaseUrl = clean(window.ELO_API_BASE_URL || window.OBRAREPORT_API_BASE_URL).replace(/\/+$/g, "");
    const location = window.location || {};
    const isLocalPage = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname || "") || location.protocol === "file:";
    const baseUrl = isLocalPage && !window.ELO_API_BASE_URL ? "http://localhost:3000" : configuredBaseUrl || "http://localhost:3000";
    return baseUrl + path;
  }

  function stockHeaders(input) {
    const headers = { "Content-Type": "application/json" };
    const token = getAuthToken(input && input.context || {});
    if (token) headers.Authorization = /^Bearer\s+/i.test(token) ? token : "Bearer " + token;
    return headers;
  }

  function fetchStockJson(input, path, options) {
    if (typeof window.fetch !== "function") return Promise.reject(new Error("stock_full_fetch_unavailable"));
    const config = Object.assign({ method: "GET" }, options || {});
    config.headers = Object.assign({}, stockHeaders(input), config.headers || {});
    return window.fetch(getStockEndpoint(path), config).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) {
          const error = new Error(clean(data.error) || "stock_full_api_error");
          error.status = response.status;
          error.data = data;
          throw error;
        }
        return data;
      });
    });
  }

  function numberFromText(value) {
    const text = normalize(value);
    const numeric = text.match(/\d+(?:[,.]\d+)?/);
    if (numeric) return Number(numeric[0].replace(",", "."));
    return NUMBER_WORDS[text] || 0;
  }

  function normalizeUnit(value) {
    const text = normalize(value);
    if (/^(saco|sacos|sc)$/.test(text)) return "saco";
    if (/^(un|und|unidade|unidades)$/.test(text)) return "un";
    if (/^(kg|quilo|quilos)$/.test(text)) return "kg";
    if (/^(m|metro|metros)$/.test(text)) return "m";
    if (/^(m2|metro2|metros2)$/.test(text)) return "m2";
    return clean(value) || "un";
  }

  function stripProductText(value) {
    return clean(normalize(value)
      .replace(/[^a-z0-9\s_-]/g, " ")
      .replace(/\b(?:elo|no|na|nos|nas|do|da|dos|das|de|para|ao|a|o|os|as|temos|tem|quanto|quantos|quantas|estoque|saldo|produto|produtos)\b/g, " ")
      .replace(/\s+/g, " "));
  }

  function parseStockIntent(input) {
    const raw = clean(input && input.payload && input.payload.message);
    const text = normalize(raw);
    const qtyWord = "\\d+(?:[,.]\\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|vinte|trinta|quarenta|cinquenta|cem";
    if (/^(sim|confirmo|confirmar|pode confirmar|pode executar|pode lancar|ok|certo)$/.test(text)) return { action: "stock.confirm", raw };
    if (/^(nao|cancelar|cancela|abortar)$/.test(text)) return { action: "stock.cancel", raw };
    if (/\b(?:o que esta acabando|o que esta em falta|estoque baixo|baixo estoque|acabando|repor)\b/.test(text)) return { action: "stock.lowStock", raw };
    let match = text.match(new RegExp("\\b(?:transfira|transferir|mande|envie)\\s+(" + qtyWord + ")\\s+([a-z0-9._-]+)\\s+(?:de\\s+)?(.+?)\\s+para\\s+(.+)$"));
    if (match) return { action: "stock.transfer.preview", raw, quantity: numberFromText(match[1]), unit: normalizeUnit(match[2]), productQuery: stripProductText(match[3]), destinationQuery: stripProductText(match[4]) };
    match = text.match(new RegExp("\\b(?:chegaram|chegou|recebemos|recebi|entrada\\s+de|de\\s+entrada\\s+em|dar\\s+entrada\\s+em)\\s+(" + qtyWord + ")\\s+([a-z0-9._-]+)\\s+(?:de\\s+)?(.+)$"));
    if (match) return { action: "stock.entry.preview", raw, quantity: numberFromText(match[1]), unit: normalizeUnit(match[2]), productQuery: stripProductText(match[3]) };
    match = text.match(new RegExp("\\b(?:de\\s+saida\\s+de|saida\\s+de|retire|retirar|baixar|baixa\\s+de|dar\\s+saida\\s+de)\\s+(" + qtyWord + ")\\s+([a-z0-9._-]+)\\s+(?:de\\s+)?(.+)$"));
    if (match) return { action: "stock.exit.preview", raw, quantity: numberFromText(match[1]), unit: normalizeUnit(match[2]), productQuery: stripProductText(match[3]) };
    if (/\b(?:quanto|quantos|quantas|saldo|temos|tem|existe|existem)\b/.test(text)) return { action: "stock.query", raw, productQuery: stripProductText(text) };
    return null;
  }

  function formatQuantity(quantity, unit) {
    const value = Number(quantity || 0);
    const shown = Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
    return clean(shown + " " + (unit || "un"));
  }

  function getItemName(item) { return clean(item && (item.name || item.productName || item.description)) || "Produto"; }
  function getItemQuantity(item) { return Number(item && (item.currentQuantity ?? item.current_quantity ?? item.quantity ?? 0)) || 0; }
  function getItemMinimum(item) { return Number(item && (item.minQuantity ?? item.min_quantity ?? item.minimumStock ?? item.minimum_stock ?? 0)) || 0; }
  function getItemId(item) { return clean(item && (item.id || item.itemId || item.item_id)); }

  function resolveItem(items, query) {
    const target = stripProductText(query);
    const parts = target.split(" ").filter(function (part) { return part.length >= 3; });
    const matches = (items || []).filter(function (item) {
      const haystack = normalize([item.name, item.category, item.location, item.sku, item.code].filter(Boolean).join(" "));
      return target && haystack.indexOf(target) >= 0 || parts.length && parts.every(function (part) { return haystack.indexOf(part) >= 0; });
    });
    if (matches.length === 1) return { status: "found", item: matches[0] };
    if (matches.length > 1) return { status: "ambiguous", matches: matches.slice(0, 5) };
    return { status: "missing", matches: [] };
  }

  function readPending() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STOCK_PENDING_KEY) || "null");
      if (!parsed || !parsed.createdAt || Date.now() - parsed.createdAt > STOCK_CONFIRMATION_TTL_MS) {
        window.localStorage.removeItem(STOCK_PENDING_KEY);
        return null;
      }
      return parsed;
    } catch (error) { return null; }
  }
  function savePending(pending) { window.localStorage.setItem(STOCK_PENDING_KEY, JSON.stringify(pending)); }
  function clearPending() { try { window.localStorage.removeItem(STOCK_PENDING_KEY); } catch (error) {} }

  function checksum(value) {
    const text = clean(value);
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    return hash.toString(16);
  }

  function makeOperationId(intent, item, identity) {
    return ["elo", intent.action, getItemId(item), intent.quantity, identity.companyId || "company", identity.userId || "user", checksum(intent.raw)].join(":");
  }

  function makePending(input, intent, item, destinationItem) {
    const identity = getIdentity(input);
    const operationId = makeOperationId(intent, item, identity);
    const token = checksum([intent.action, getItemId(item), getItemId(destinationItem), intent.quantity, identity.companyId, identity.userId, operationId].join("|"));
    return { action: intent.action.replace(".preview", ".execute"), createdAt: Date.now(), operationId, offlineUuid: operationId, token, item, destinationItem: destinationItem || null, quantity: intent.quantity, unit: intent.unit, destinationQuery: clean(intent.destinationQuery), identity, raw: intent.raw };
  }

  function stockResult(input, values) { return result(input, Object.assign({ module: "stock_full" }, values || {})); }
  function loadItems(input) { return fetchStockJson(input, "/api/stock-full/items").then(function (data) { return Array.isArray(data.items) ? data.items : []; }); }

  function executeStockQuery(input, intent) {
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para consultar o estoque real do Stock Full."));
    return loadItems(input).then(function (items) {
      const resolution = resolveItem(items, intent.productQuery);
      if (resolution.status === "ambiguous") return stockResult(input, { ok: false, action: "stock.query", mode: "blocked", humanAnswer: "Encontrei mais de um produto possível: " + resolution.matches.map(getItemName).join(", ") + ". Informe o produto exato." });
      if (!resolution.item) return stockResult(input, { ok: false, action: "stock.query", mode: "blocked", humanAnswer: "Não encontrei esse produto no Stock Full autenticado. Nenhum número foi inventado." });
      const item = resolution.item;
      return stockResult(input, { action: "stock.query", mode: "read", humanAnswer: getItemName(item) + ": saldo atual " + formatQuantity(getItemQuantity(item), item.unit) + ".", data: { item } });
    }).catch(function (error) {
      return stockResult(input, { ok: false, action: "stock.query", mode: "error", humanAnswer: "Não consegui consultar o Stock Full agora. O backend retornou: " + (clean(error.message) || "erro de consulta") + ".", error: clean(error.message) });
    });
  }

  function executeLowStock(input) {
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para consultar estoque baixo real do Stock Full."));
    return loadItems(input).then(function (items) {
      const low = items.filter(function (item) { return getItemMinimum(item) > 0 && getItemQuantity(item) <= getItemMinimum(item); }).slice(0, 10);
      if (!low.length) return stockResult(input, { action: "stock.lowStock", mode: "read", humanAnswer: "Consultei o Stock Full e não encontrei itens abaixo do mínimo cadastrado." });
      return stockResult(input, { action: "stock.lowStock", mode: "read", humanAnswer: "Itens acabando no Stock Full: " + low.map(function (item) { return getItemName(item) + " (" + formatQuantity(getItemQuantity(item), item.unit) + ", mínimo " + formatQuantity(getItemMinimum(item), item.unit) + ")"; }).join("; ") + ".", data: { items: low } });
    }).catch(function (error) {
      return stockResult(input, { ok: false, action: "stock.lowStock", mode: "error", humanAnswer: "Não consegui consultar o estoque baixo agora. O backend retornou: " + (clean(error.message) || "erro de consulta") + ".", error: clean(error.message) });
    });
  }

  function executeMovementPreview(input, intent) {
    if (!(intent.quantity > 0) || !intent.productQuery) return Promise.resolve(stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Não consegui identificar produto e quantidade com segurança. Nenhum estoque foi movimentado." }));
    if (input.dryRun === true) {
      const verb = intent.action === "stock.entry.preview" ? "entrada" : intent.action === "stock.exit.preview" ? "saída" : "transferência";
      return stockResult(input, { action: intent.action, mode: "preview", requiresConfirmation: true, preview: "Preview de " + verb + ": " + formatQuantity(intent.quantity, intent.unit) + " de " + intent.productQuery + ". Responda sim para executar." });
    }
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para movimentar estoque real no Stock Full."));
    return loadItems(input).then(function (items) {
      let resolution = resolveItem(items, intent.productQuery);
      let destinationItem = null;
      if (intent.action === "stock.transfer.preview") {
        let destinationResolution = resolveItem(items, intent.destinationQuery);
        if (destinationResolution.status === "ambiguous") {
          const targetDestination = stripProductText(intent.destinationQuery);
          const exactDestinationMatches = destinationResolution.matches.filter(function (item) { return normalize([item.name, item.location].filter(Boolean).join(" ")).indexOf(targetDestination) >= 0; });
          if (exactDestinationMatches.length === 1) destinationResolution = { status: "found", item: exactDestinationMatches[0] };
        }
        if (destinationResolution.status === "ambiguous") return stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Encontrei mais de um destino possível: " + destinationResolution.matches.map(getItemName).join(", ") + ". Informe o destino exato." });
        if (!destinationResolution.item) return stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Não encontrei o produto/destino informado no Stock Full. Nenhuma transferência foi criada." });
        destinationItem = destinationResolution.item;
        if (resolution.status === "ambiguous") {
          const sourceMatches = resolution.matches.filter(function (item) { return getItemId(item) !== getItemId(destinationItem) && getItemQuantity(item) >= intent.quantity; });
          if (sourceMatches.length === 1) resolution = { status: "found", item: sourceMatches[0] };
        }
      }
      if (resolution.status === "ambiguous") return stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Encontrei mais de um produto possível: " + resolution.matches.map(getItemName).join(", ") + ". Informe o produto exato antes de movimentar." });
      if (!resolution.item) return stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Não encontrei esse produto no Stock Full. Nenhum estoque foi movimentado." });
      const balance = getItemQuantity(resolution.item);
      if ((intent.action === "stock.exit.preview" || intent.action === "stock.transfer.preview") && intent.quantity > balance) return stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Movimento bloqueado por saldo insuficiente. Saldo atual de " + getItemName(resolution.item) + ": " + formatQuantity(balance, resolution.item.unit) + "." });
      const pending = makePending(input, intent, resolution.item, destinationItem);
      savePending(pending);
      const verb = intent.action === "stock.entry.preview" ? "entrada" : intent.action === "stock.exit.preview" ? "saída" : "transferência";
      const target = destinationItem ? " para " + getItemName(destinationItem) : "";
      return stockResult(input, { action: intent.action, mode: "preview", requiresConfirmation: true, preview: "Preview de " + verb + ": " + formatQuantity(intent.quantity, intent.unit || resolution.item.unit) + " de " + getItemName(resolution.item) + target + ". Token: " + pending.token + ". Responda sim para executar.", data: { pending } });
    }).catch(function (error) {
      return stockResult(input, { ok: false, action: intent.action, mode: "error", humanAnswer: "Não consegui preparar o movimento no Stock Full. O backend retornou: " + (clean(error.message) || "erro de consulta") + ".", error: clean(error.message) });
    });
  }

  function postConfirmedMovement(input, pending) {
    if (pending.action === "stock.transfer.execute") {
      return fetchStockJson(input, "/api/stock-full/transfer", { method: "POST", body: JSON.stringify({ sourceItemId: getItemId(pending.item), destinationItemId: getItemId(pending.destinationItem), quantity: pending.quantity, destination: pending.destinationQuery || getItemName(pending.destinationItem), operationId: pending.operationId, offlineUuid: pending.offlineUuid, deviceId: pending.identity && pending.identity.deviceId, source: "elo_action_bus" }) });
    }
    const type = pending.action === "stock.exit.execute" ? "saida" : "entrada";
    return fetchStockJson(input, "/api/stock-full/sync", { method: "POST", body: JSON.stringify({ movements: [{ type, itemId: getItemId(pending.item), quantity: pending.quantity, operationId: pending.operationId, offlineUuid: pending.offlineUuid, deviceId: pending.identity && pending.identity.deviceId, source: "elo_action_bus" }] }) });
  }

  function executePendingStock(input) {
    const pending = readPending();
    if (!pending) return Promise.resolve(stockResult(input, { ok: false, action: "stock.confirm", mode: "blocked", humanAnswer: "Não há movimento pendente para confirmar. Nenhum estoque foi movimentado." }));
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para confirmar o movimento real no Stock Full."));
    return postConfirmedMovement(input, pending).then(function (data) {
      clearPending();
      const duplicate = data && (data.duplicate || (data.results || []).some(function (item) { return item.status === "duplicate"; }));
      const rejected = data && (data.results || []).find(function (item) { return item.status === "rejected"; });
      if (rejected) return stockResult(input, { ok: false, action: pending.action, mode: "blocked", humanAnswer: "O Stock Full bloqueou o movimento: " + (clean(rejected.message) || "movimento rejeitado") + ". Nenhuma confirmação duplicada foi criada.", error: clean(rejected.message) });
      const label = pending.action === "stock.entry.execute" ? "Entrada registrada" : pending.action === "stock.exit.execute" ? "Saída registrada" : "Transferência registrada";
      return stockResult(input, { action: pending.action, mode: "execute", humanAnswer: (duplicate ? "Esse movimento já estava confirmado. " : "") + label + " no Stock Full: " + formatQuantity(pending.quantity, pending.unit || pending.item && pending.item.unit) + " de " + getItemName(pending.item) + ".", data: { pending, response: data } });
    }).catch(function (error) {
      return stockResult(input, { ok: false, action: pending.action, mode: "error", humanAnswer: "Não confirmei o movimento porque o backend do Stock Full retornou: " + (clean(error.message) || "erro ao confirmar") + ".", error: clean(error.message) });
    });
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
    const intent = parseStockIntent(input);
    if (!intent) return unsupported(input, "Não reconheci um comando seguro de Stock Full nessa frase. Nenhum estoque foi movimentado.");
    if (intent.action === "stock.confirm") return executePendingStock(input);
    if (intent.action === "stock.cancel") {
      clearPending();
      return result(input, { module: "stock_full", action: "stock.cancel", mode: "blocked", humanAnswer: "Movimento pendente cancelado. Nenhum estoque foi movimentado." });
    }
    if (intent.action === "stock.query") return executeStockQuery(input, intent);
    if (intent.action === "stock.lowStock") return executeLowStock(input);
    if (/^stock\.(?:entry|exit|transfer)\.preview$/.test(intent.action)) return executeMovementPreview(input, intent);
    return unsupported(input, "Esse comando de Stock Full ainda não está liberado no Action Bus.");
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

  function executeEloAutopilot(input) {
    const topic = clean(input.payload && (input.payload.topic || input.payload.message));
    return result(input, {
      action: "publish_editorial_content",
      mode: "preview",
      requiresAuth: !getAuthToken(input.context || {}),
      requiresConfirmation: true,
      preview: topic ? "Posso preparar um preview editorial sobre " + topic + ", mas nao vou publicar sem confirmacao." : "Posso preparar um preview editorial, mas preciso do tema antes de publicar.",
      data: { topic }
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
    if (safe.module === "elo_autopilot") return executeEloAutopilot(safe);
    if (safe.module === "memory") return executeMemory(safe);
    if (safe.module === "alerts") return executeAlerts(safe);
    return unsupported(safe);
  }

  window.EloCommandBridge = Object.assign({}, window.EloCommandBridge || {}, {
    execute,
    modules: MODULES.slice()
  });
  window.EloActionBusStockFull = Object.assign({}, window.EloActionBusStockFull || {}, {
    execute: executeStockFull,
    parseIntent: parseStockIntent,
    readPending,
    clearPending,
    version: "elo-action-bus-stock-v1"
  });
})();

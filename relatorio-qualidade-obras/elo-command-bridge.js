(function () {
  "use strict";

  const MODULES = ["budget", "inspection", "obrareport_rdo", "obrareport_report", "stock_full", "stock_obras", "elo_autopilot", "municipal", "municipal_sentinel", "memory", "alerts"];
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
  const RDO_PENDING_KEY = "elo_action_bus_rdo_pending_v1";
  const RDO_CONTEXT_KEY = "elo_action_bus_rdo_context_v1";
  const OBRAREPORT_STATE_KEY = "obrareport-saas-v1";
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
      .replace(/\b(?:elo|no|na|nos|nas|do|da|dos|das|de|para|ao|a|o|os|as|qual|quais|temos|tem|quanto|quantos|quantas|existe|existem|estoque|stock|full|almoxarifado|saldo|produto|produtos|item|itens|material|materiais)\b/g, " ")
      .replace(/\s+/g, " "));
  }

  function hasStockFullPermission(input, permission) {
    const context = input && input.context || {};
    const identity = context.identity || {};
    const role = normalize(context.role || identity.role || identity.profileRole || identity.profile_role || identity.userRole || identity.user_role);
    const permissions = {
      admin: ["products:create", "products:update", "products:delete"],
      administrador: ["products:create", "products:update", "products:delete"],
      gestor: ["products:create", "products:update", "products:delete"],
      patrao: ["products:create", "products:update", "products:delete"]
    };
    return Boolean(permission && permissions[role] && permissions[role].indexOf(permission) >= 0);
  }

  function stripCreateProductName(value) {
    return clean(String(value || "")
      .replace(/^com\s+(?:unidade|unidade\s+de\s+medida|un\.?|medida)\s+[\w./-]+[\s\S]*$/i, "")
      .replace(/\s+com\s+(?:unidade|unidade\s+de\s+medida|un\.?|medida)\s+[\w./-]+[\s\S]*$/i, "")
      .replace(/\s+(?:na|no|para\s+o|ao)\s+(?:estoque|stock\s+full|almoxarifado)[\s\S]*$/i, "")
      .replace(/\s+categoria\s+[\s\S]*$/i, "")
      .replace(/\s+min(?:imo|ima|\.?)\s+[\s\S]*$/i, "")
      .replace(/[.;!?]+$/g, ""));
  }

  function parseStockCreateIntent(input, raw, text) {
    const action = clean(input && input.action);
    const isExplicitAction = action === "create_product" || action === "stock.create_product" || action === "stock.create_product.preview";
    const isCreateText = /\b(?:cadastre|cadastrar|crie|criar|adicione|adicionar|inclua|incluir|novo\s+produto|novo\s+item)\b/.test(text) && /\b(?:produto|produtos|item|itens|material|materiais|estoque|stock|almoxarifado)\b/.test(text);
    if (!isExplicitAction && !isCreateText) return null;
    const unitMatch = raw.match(/\b(?:unidade|unidade\s+de\s+medida|un\.?|medida)\s+([a-zA-Z0-9./_-]+)/i);
    const categoryMatch = raw.match(/\bcategoria\s+(.+?)(?:\s+com\s+|\s+min(?:imo|ima|\.?)|$)/i);
    const minMatch = text.match(/\bmin(?:imo|ima|\.?)\s+(\d+(?:[,.]\d+)?)/);
    const initialMatch = text.match(/\b(?:saldo|quantidade)\s+inicial\s+(\d+(?:[,.]\d+)?)/);
    let name = "";
    const named = raw.match(/\b(?:chamado|chamada|nomeado|nomeada|nome)\s+(.+)$/i);
    if (named) name = stripCreateProductName(named[1]);
    if (!name && !named) {
      name = stripCreateProductName(raw
        .replace(/^\s*(?:cadastre|cadastrar|crie|criar|adicione|adicionar|inclua|incluir)\s+(?:um|uma|novo|nova)?\s*(?:produto|item|material)?\s*/i, ""));
    }
    return {
      action: "stock.create_product.preview",
      raw,
      name: clean(name),
      unit: normalizeUnit(unitMatch && unitMatch[1] || ""),
      category: clean(categoryMatch && categoryMatch[1]) || "Geral",
      minQuantity: minMatch ? numberFromText(minMatch[1]) : 0,
      initialQuantity: initialMatch ? numberFromText(initialMatch[1]) : 0
    };
  }

  function parseStockIntent(input) {
    const raw = clean(input && input.payload && input.payload.message);
    const text = normalize(raw);
    const qtyWord = "\\d+(?:[,.]\\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|vinte|trinta|quarenta|cinquenta|cem";
    if (/^(sim|confirmo|confirmar|pode confirmar|pode executar|pode lancar|ok|certo)$/.test(text)) return { action: "stock.confirm", raw };
    if (/^(nao|cancelar|cancela|abortar)$/.test(text)) return { action: "stock.cancel", raw };
    const createIntent = parseStockCreateIntent(input, raw, text);
    if (createIntent) return createIntent;
    if (input && input.action === "stock_history" || /\b(?:historico|movimentacao|movimentacoes|movimentos?|entradas?\s+e\s+saidas?|saidas?\s+e\s+entradas?|ultimas?\s+entradas?|ultimas?\s+saidas?)\b/.test(text) && /\b(?:estoque|stock|almoxarifado|entradas?|saidas?|movimentacao|movimentacoes|movimentos?)\b/.test(text)) return { action: "stock.history", raw };
    if (/\b(?:o que esta acabando|o que esta em falta|estoque baixo|baixo estoque|acabando|repor)\b/.test(text)) return { action: "stock.lowStock", raw };
    if (input && input.action === "list_products" || /\b(?:quais|liste|listar|mostre|mostrar|ver|consultar|consulta)\b[\s\S]{0,80}\b(?:produtos|itens|materiais)\b[\s\S]{0,80}\b(?:estoque|stock|almoxarifado)\b/.test(text) || /\b(?:produtos|itens|materiais)\b[\s\S]{0,80}\b(?:do|no|na)?\s*(?:estoque|stock|almoxarifado)\b/.test(text) && !/\b(?:saldo|quanto|quantos|quantas|entrada|saida|retire|retirar|chegaram|chegou|recebemos)\b/.test(text)) return { action: "stock.listProducts", raw };
    let match = text.match(new RegExp("\\b(?:transfira|transferir|mande|envie)\\s+(" + qtyWord + ")\\s+([a-z0-9._-]+)\\s+(?:de\\s+)?(.+?)\\s+para\\s+(.+)$"));
    if (match) return { action: "stock.transfer.preview", raw, quantity: numberFromText(match[1]), unit: normalizeUnit(match[2]), productQuery: stripProductText(match[3]), destinationQuery: stripProductText(match[4]) };
    match = text.match(new RegExp("\\b(?:chegaram|chegou|recebemos|recebi|registre\\s+entrada\\s+de|registrar\\s+entrada\\s+de|lance\\s+entrada\\s+de|lancar\\s+entrada\\s+de|entrada\\s+de|de\\s+entrada\\s+em|dar\\s+entrada\\s+em)\\s+(" + qtyWord + ")\\s+([a-z0-9._-]+)\\s+(?:de\\s+)?(.+)$"));
    if (match) return { action: "stock.entry.preview", raw, quantity: numberFromText(match[1]), unit: normalizeUnit(match[2]), productQuery: stripProductText(match[3]) };
    match = text.match(new RegExp("\\b(?:de\\s+saida\\s+de|saida\\s+de|retire|retirar|baixar|baixa\\s+de|dar\\s+saida\\s+de)\\s+(" + qtyWord + ")\\s+([a-z0-9._-]+)\\s+(?:de\\s+)?(.+)$"));
    if (match) return { action: "stock.exit.preview", raw, quantity: numberFromText(match[1]), unit: normalizeUnit(match[2]), productQuery: stripProductText(match[3]) };
    if (input && input.action === "get_balance" || /\b(?:quanto|quantos|quantas|saldo|temos|tem)\b/.test(text)) return { action: "stock.query", raw, productQuery: stripProductText(text) };
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
    return ["elo", intent.action, getItemId(item) || checksum(intent.name || ""), intent.quantity || intent.initialQuantity || 0, identity.companyId || "company", identity.userId || "user", checksum(intent.raw)].join(":");
  }

  function makePending(input, intent, item, destinationItem) {
    const identity = getIdentity(input);
    const operationId = makeOperationId(intent, item, identity);
    const token = checksum([intent.action, getItemId(item) || intent.name, getItemId(destinationItem), intent.quantity || intent.initialQuantity, identity.companyId, identity.userId, operationId].join("|"));
    return { action: intent.action.replace(".preview", ".execute"), createdAt: Date.now(), operationId, offlineUuid: operationId, token, item: item || null, destinationItem: destinationItem || null, name: clean(intent.name), category: clean(intent.category) || "Geral", minQuantity: Number(intent.minQuantity || 0) || 0, initialQuantity: Number(intent.initialQuantity || 0) || 0, quantity: intent.quantity, unit: intent.unit, destinationQuery: clean(intent.destinationQuery), identity, raw: intent.raw, status: "pending" };
  }

  function stockResult(input, values) { return result(input, Object.assign({ module: "stock_full" }, values || {})); }
  function loadItems(input) { return fetchStockJson(input, "/api/stock-full/items").then(function (data) { return Array.isArray(data.items) ? data.items : []; }); }

  function findExistingProduct(items, pendingOrIntent) {
    const name = normalize(pendingOrIntent && pendingOrIntent.name);
    const unit = normalizeUnit(pendingOrIntent && pendingOrIntent.unit);
    if (!name) return null;
    return (items || []).find(function (item) {
      return normalize(getItemName(item)) === name && normalizeUnit(item && item.unit) === unit;
    }) || null;
  }

  function executeCreateProductPreview(input, intent) {
    if (!intent.name) return Promise.resolve(stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Não consegui identificar o nome do produto com segurança. Nenhum cadastro foi criado.", error: "name_required" }));
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para cadastrar produto real no Stock Full."));
    if (!getIdentity(input).companyId) return Promise.resolve(stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Preciso do tenant/empresa ativo para cadastrar produto. Não aceito tenant vindo do texto.", error: "institution_required" }));
    if (!hasStockFullPermission(input, "products:create")) return Promise.resolve(stockResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Usuário sem permissão para cadastrar produto no Stock Full. Nenhum POST foi executado.", error: "permission_denied" }));
    return loadItems(input).then(function (items) {
      const existing = findExistingProduct(items, intent);
      if (existing) return stockResult(input, { ok: false, action: "stock.create_product", mode: "blocked", humanAnswer: "Já existe produto ativo com esse nome e unidade no tenant atual: " + getItemName(existing) + " (" + existing.unit + "). Nenhum duplicado foi criado.", error: "stock_full_product_duplicate", data: { item: existing } });
      const pending = makePending(input, intent, null, null);
      savePending(pending);
      return stockResult(input, {
        action: "stock.create_product",
        mode: "preview",
        requiresConfirmation: true,
        preview: [
          "Preview de cadastro no Stock Full:",
          "MODULE: stock_full",
          "ACTION: stock.create_product",
          "NAME: " + pending.name,
          "UNIT: " + pending.unit,
          "CATEGORY: " + pending.category,
          "MINIMUM STOCK: " + pending.minQuantity,
          "INITIAL QUANTITY: " + pending.initialQuantity,
          "TENANT: " + (pending.identity.companyId || "tenant atual"),
          "CONFIRMATION REQUIRED: SIM",
          "WRITE EXECUTED: 0",
          "/api/stock-full/items POST: 0",
          "Token: " + pending.token + ". Responda sim para executar."
        ].join("\n"),
        data: { pending }
      });
    }).catch(function (error) {
      return stockResult(input, { ok: false, action: intent.action, mode: "error", humanAnswer: "Não consegui preparar o cadastro no Stock Full. O backend retornou: " + (clean(error.message) || "erro de consulta") + ".", error: clean(error.message) });
    });
  }

  function executeListProducts(input) {
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para listar o estoque real do Stock Full."));
    return loadItems(input).then(function (items) {
      if (!items.length) return stockResult(input, { action: "list_products", mode: "read", humanAnswer: "Consultei o Stock Full autenticado e não encontrei produtos cadastrados." });
      const lines = ["Produtos no Stock Full:"].concat(items.map(function (item) {
        return "- " + getItemName(item) + ": " + formatQuantity(getItemQuantity(item), item.unit) + ".";
      }));
      return stockResult(input, { action: "list_products", mode: "read", humanAnswer: lines.join("\n"), data: { items } });
    }).catch(function (error) {
      return stockResult(input, { ok: false, action: "list_products", mode: "error", humanAnswer: "Não consegui listar o Stock Full agora. O backend retornou: " + (clean(error.message) || "erro de consulta") + ".", error: clean(error.message) });
    });
  }

  function executeStockQuery(input, intent) {
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para consultar o estoque real do Stock Full."));
    return loadItems(input).then(function (items) {
      const resolution = resolveItem(items, intent.productQuery);
      if (resolution.status === "ambiguous") return stockResult(input, { ok: false, action: "get_balance", mode: "blocked", humanAnswer: "Encontrei mais de um produto possível: " + resolution.matches.map(getItemName).join(", ") + ". Informe o produto exato." });
      if (!resolution.item) return stockResult(input, { ok: false, action: "get_balance", mode: "blocked", humanAnswer: "Não encontrei esse produto no Stock Full autenticado. Nenhum número foi inventado." });
      const item = resolution.item;
      return stockResult(input, { action: "get_balance", mode: "read", humanAnswer: getItemName(item) + ": saldo atual " + formatQuantity(getItemQuantity(item), item.unit) + ".", data: { item } });
    }).catch(function (error) {
      return stockResult(input, { ok: false, action: "get_balance", mode: "error", humanAnswer: "Não consegui consultar o Stock Full agora. O backend retornou: " + (clean(error.message) || "erro de consulta") + ".", error: clean(error.message) });
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

  function getMovementQuantity(movement) {
    return Number(movement && (movement.quantity ?? movement.qty ?? movement.amount ?? movement.currentQuantity ?? 0)) || 0;
  }

  function getMovementItemName(movement) {
    return clean(movement && (movement.itemName || movement.productName || movement.material || movement.name || movement.item && movement.item.name || movement.product && movement.product.name)) || "Produto";
  }

  function getMovementUnit(movement) {
    return clean(movement && (movement.unit || movement.itemUnit || movement.productUnit || movement.item && movement.item.unit || movement.product && movement.product.unit)) || "un";
  }

  function getMovementType(movement) {
    const text = normalize(movement && (movement.type || movement.movementType || movement.kind || movement.direction || movement.action));
    if (/entrada|entry|inbound|in/.test(text)) return "entrada";
    if (/saida|exit|outbound|out/.test(text)) return "saída";
    if (/transfer/.test(text)) return "transferência";
    return clean(movement && (movement.type || movement.movementType || movement.kind)) || "movimentação";
  }

  function getMovementDate(movement) {
    return clean(movement && (movement.createdAt || movement.created_at || movement.syncedAt || movement.synced_at || movement.date || movement.timestamp));
  }

  function getMovementActor(movement) {
    return clean(movement && (movement.actorName || movement.userName || movement.createdByName || movement.responsible || movement.userEmail || movement.createdBy || movement.created_by));
  }

  function formatMovementLine(movement) {
    const parts = [
      getMovementType(movement),
      getMovementItemName(movement) + ": " + formatQuantity(getMovementQuantity(movement), getMovementUnit(movement))
    ];
    const date = getMovementDate(movement);
    const actor = getMovementActor(movement);
    if (date) parts.push(date);
    if (actor) parts.push("por " + actor);
    return "- " + parts.join(" · ") + ".";
  }

  function movementFromEntry(entry) {
    return Object.assign({}, entry || {}, { type: "entrada" });
  }

  function movementFromExit(exit) {
    return Object.assign({}, exit || {}, { type: "saida" });
  }

  function sortMovements(movements) {
    return (movements || []).slice().sort(function (a, b) {
      return String(getMovementDate(b)).localeCompare(String(getMovementDate(a)));
    });
  }

  function executeMovementHistory(input) {
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para consultar o histórico real do Stock Full."));
    return fetchStockJson(input, "/api/stock-full/live").then(function (data) {
      let movements = Array.isArray(data.lastMovements) ? data.lastMovements : Array.isArray(data.movements) ? data.movements : [];
      if (!movements.length) {
        const entries = Array.isArray(data.entries) ? data.entries.map(movementFromEntry) : [];
        const exits = Array.isArray(data.exits) ? data.exits.map(movementFromExit) : [];
        movements = entries.concat(exits);
      }
      movements = sortMovements(movements).slice(0, 10);
      if (!movements.length) return stockResult(input, { action: "stock.history", mode: "read", humanAnswer: "Consultei o histórico real do Stock Full e não encontrei movimentações registradas." });
      const lines = ["Últimas movimentações do Stock Full:"].concat(movements.map(formatMovementLine));
      return stockResult(input, { action: "stock.history", mode: "read", humanAnswer: lines.join("\n"), data: { movements } });
    }).catch(function () {
      return Promise.all([
        fetchStockJson(input, "/api/stock-full/entries").catch(function () { return { entries: [] }; }),
        fetchStockJson(input, "/api/stock-full/exits").catch(function () { return { exits: [] }; })
      ]).then(function (results) {
        const entries = Array.isArray(results[0].entries) ? results[0].entries.map(movementFromEntry) : [];
        const exits = Array.isArray(results[1].exits) ? results[1].exits.map(movementFromExit) : [];
        const movements = sortMovements(entries.concat(exits)).slice(0, 10);
        if (!movements.length) return stockResult(input, { action: "stock.history", mode: "read", humanAnswer: "Consultei entradas e saídas reais do Stock Full e não encontrei movimentações registradas." });
        const lines = ["Últimas movimentações do Stock Full:"].concat(movements.map(formatMovementLine));
        return stockResult(input, { action: "stock.history", mode: "read", humanAnswer: lines.join("\n"), data: { movements } });
      });
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
    if (pending.action === "stock.create_product.execute") {
      return fetchStockJson(input, "/api/stock-full/items", { method: "POST", body: JSON.stringify({ name: pending.name, unit: pending.unit, category: pending.category, minQuantity: pending.minQuantity, currentQuantity: pending.initialQuantity, notes: "Cadastro confirmado pelo ELO. operationId=" + pending.operationId }) });
    }
    if (pending.action === "stock.transfer.execute") {
      return fetchStockJson(input, "/api/stock-full/transfers", { method: "POST", body: JSON.stringify({ sourceItemId: getItemId(pending.item), destinationItemId: getItemId(pending.destinationItem), quantity: pending.quantity, destination: pending.destinationQuery || getItemName(pending.destinationItem), operationId: pending.operationId, offlineUuid: pending.offlineUuid, deviceId: pending.identity && pending.identity.deviceId, source: "elo_action_bus" }) });
    }
    const type = pending.action === "stock.exit.execute" ? "saida" : "entrada";
    return fetchStockJson(input, "/api/stock-full/sync", { method: "POST", body: JSON.stringify({ movements: [{ type, itemId: getItemId(pending.item), quantity: pending.quantity, operationId: pending.operationId, offlineUuid: pending.offlineUuid, deviceId: pending.identity && pending.identity.deviceId, source: "elo_action_bus" }] }) });
  }

  function executePendingStock(input) {
    const pending = readPending();
    if (!pending) return Promise.resolve(stockResult(input, { ok: false, action: "stock.confirm", mode: "blocked", humanAnswer: "Não há movimento pendente para confirmar. Nenhum estoque foi movimentado." }));
    if (pending.status === "saving" || pending.status === "saved") return Promise.resolve(stockResult(input, { action: pending.action, mode: pending.status === "saved" ? "execute" : "blocked", humanAnswer: pending.status === "saved" ? "Essa ação já foi confirmada. Não criei duplicado." : "Essa ação já está em confirmação. Não vou enviar outro POST.", data: { pending } }));
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para confirmar a ação real no Stock Full."));
    if (pending.action === "stock.create_product.execute" && !hasStockFullPermission(input, "products:create")) return Promise.resolve(stockResult(input, { ok: false, action: pending.action, mode: "blocked", humanAnswer: "Usuário sem permissão para cadastrar produto no Stock Full. Nenhum POST foi executado.", error: "permission_denied" }));
    const execute = function () {
      pending.status = "saving";
      savePending(pending);
      return postConfirmedMovement(input, pending);
    };
    const execution = pending.action === "stock.create_product.execute"
      ? loadItems(input).then(function (items) {
        const existing = findExistingProduct(items, pending);
        if (existing) return { ok: true, duplicate: true, item: existing };
        return execute();
      })
      : execute();
    return execution.then(function (data) {
      pending.status = "saved";
      clearPending();
      const duplicate = data && (data.duplicate || (data.results || []).some(function (item) { return item.status === "duplicate"; }));
      const rejected = data && (data.results || []).find(function (item) { return item.status === "rejected"; });
      if (rejected) return stockResult(input, { ok: false, action: pending.action, mode: "blocked", humanAnswer: "O Stock Full bloqueou o movimento: " + (clean(rejected.message) || "movimento rejeitado") + ". Nenhuma confirmação duplicada foi criada.", error: clean(rejected.message) });
      if (pending.action === "stock.create_product.execute") return stockResult(input, { action: pending.action, mode: "execute", humanAnswer: (duplicate ? "Esse produto já estava cadastrado. " : "Produto cadastrado no Stock Full: ") + pending.name + " (" + pending.unit + ").", data: { pending, response: data, item: data && data.item } });
      const label = pending.action === "stock.entry.execute" ? "Entrada registrada" : pending.action === "stock.exit.execute" ? "Saída registrada" : "Transferência registrada";
      return stockResult(input, { action: pending.action, mode: "execute", humanAnswer: (duplicate ? "Esse movimento já estava confirmado. " : "") + label + " no Stock Full: " + formatQuantity(pending.quantity, pending.unit || pending.item && pending.item.unit) + " de " + getItemName(pending.item) + ".", data: { pending, response: data } });
    }).catch(function (error) {
      return stockResult(input, { ok: false, action: pending.action, mode: "error", humanAnswer: "Não confirmei a ação porque o backend do Stock Full retornou: " + (clean(error.message) || "erro ao confirmar") + ".", error: clean(error.message) });
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

  function inspectionResult(input, values) { return result(input, Object.assign({ module: "inspection" }, values || {})); }

  function getInspectionIdentity(input) {
    const context = input && input.context || {};
    const identity = context.identity || {};
    return {
      institutionId: clean(context.institutionId || identity.institutionId || identity.institution_id || context.companyId || identity.companyId || identity.company_id),
      companyId: clean(context.companyId || identity.companyId || identity.company_id),
      userId: clean(context.userId || identity.userId || identity.id || identity.user_id),
      projectId: clean(context.projectId || context.workId || identity.projectId || identity.project_id || identity.workId || identity.work_id),
      clientId: clean(context.clientId || identity.clientId || identity.client_id)
    };
  }

  function requireInspectionAccess(input) {
    if (!getAuthToken(input.context || {})) return { ok: false, reason: "auth" };
    const identity = getInspectionIdentity(input);
    if (!identity.institutionId) return { ok: false, reason: "tenant" };
    return { ok: true, identity };
  }

  function inspectionHeaders(input) {
    const auth = requireInspectionAccess(input);
    const headers = { "Content-Type": "application/json" };
    const token = getAuthToken(input.context || {});
    if (token) headers.Authorization = /^Bearer\s+/i.test(token) ? token : "Bearer " + token;
    if (auth.identity && auth.identity.institutionId) headers["x-institution-id"] = auth.identity.institutionId;
    if (auth.identity && auth.identity.companyId) headers["x-company-id"] = auth.identity.companyId;
    if (auth.identity && auth.identity.userId) headers["x-user-id"] = auth.identity.userId;
    return headers;
  }

  function inspectionAuthBlocked(input, auth) {
    if (auth.reason === "auth") return needsAuth(input, "Preciso de autenticação para consultar vistorias reais.");
    return inspectionResult(input, { ok: false, action: input.action || "inspection.blocked", mode: "blocked", humanAnswer: "Preciso do tenant/empresa ativo para acessar vistorias reais. Nenhuma vistoria foi consultada.", error: "institution_required" });
  }

  function inspectionApiPath(input, path, query) {
    const identity = getInspectionIdentity(input);
    const params = [];
    const safeQuery = query || {};
    const projectId = clean(safeQuery.projectId || safeQuery.project_id || identity.projectId);
    const clientId = clean(safeQuery.clientId || safeQuery.client_id || identity.clientId);
    if (projectId) params.push("projectId=" + encodeURIComponent(projectId));
    if (clientId) params.push("clientId=" + encodeURIComponent(clientId));
    if (safeQuery.status) params.push("status=" + encodeURIComponent(clean(safeQuery.status)));
    return getStockEndpoint(path) + (params.length ? "?" + params.join("&") : "");
  }

  function fetchInspectionJson(input, path, options) {
    if (typeof window.fetch !== "function") return Promise.reject(new Error("inspection_fetch_unavailable"));
    const config = Object.assign({ method: "GET" }, options || {});
    config.headers = Object.assign({}, inspectionHeaders(input), config.headers || {});
    return window.fetch(path, config).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) {
          const error = new Error(clean(data.error) || "inspection_api_error");
          error.status = response.status;
          error.data = data;
          throw error;
        }
        return data;
      });
    });
  }

  function parseInspectionIntent(input) {
    const action = clean(input && input.action);
    const raw = clean(input && input.payload && input.payload.message);
    const text = normalize(raw);
    const unitMatch = text.match(/(?:apartamento|apto|unidade)\s*([a-z0-9-]+)/) || text.match(/\b([0-9]{2,5}[a-z]?)\b/);
    const parsed = { action: action || "inspection.list", raw, unit: clean(input && input.payload && (input.payload.unit || input.payload.apartment || input.payload.apartamento)) || (unitMatch && unitMatch[1] || ""), inspectionId: clean(input && input.payload && (input.payload.inspectionId || input.payload.inspection_id) || input && input.context && (input.context.activeInspectionId || input.context.inspectionId || input.context.inspection_id)) };
    if (/openNCs|open_ncs|nc|nao conform|não conform|inconform/.test(action + " " + text)) parsed.action = "inspection.openNCs";
    else if (/generatePdf|generate_pdf|pdf|laudo/.test(action + " " + text)) parsed.action = "inspection.generatePdf";
    else if (/get|open|abrir|abra|apto|apartamento|unidade/.test(action + " " + text)) parsed.action = "inspection.get";
    else if (/list|listar|liste|quais vistorias|vistorias/.test(action + " " + text)) parsed.action = "inspection.list";
    return parsed;
  }

  function inspectionData(record) {
    return record && (record.inspection_data_json || record.inspectionData || record.inspection_data) || {};
  }

  function inspectionMetadata(record) {
    const data = inspectionData(record);
    return Object.assign({}, data.metadata || {}, data.inspection && data.inspection.metadata || {}, data.report && data.report.inspection && data.report.inspection.metadata || {});
  }

  function inspectionUnit(record) {
    const data = inspectionData(record);
    const meta = inspectionMetadata(record);
    return clean(record && (record.unit || record.unidade) || meta.unitName || meta.unidade || data.unidade || data.unit || data.report && data.report.unidade || data.report && data.report.inspection && data.report.inspection.unidade || "");
  }

  function inspectionTitle(record) {
    const meta = inspectionMetadata(record);
    return clean(record && record.title || meta.projectName || meta.empreendimento || "Vistoria de Entrega");
  }

  function summarizeInspection(record) {
    return { id: clean(record && record.id), title: inspectionTitle(record), unit: inspectionUnit(record), status: clean(record && record.status), projectId: clean(record && (record.project_id || record.projectId)), updatedAt: clean(record && (record.updated_at || record.updatedAt)) };
  }

  function allInspectionItems(record) {
    const data = inspectionData(record);
    if (data.report && data.report.inspection && Array.isArray(data.report.inspection.items)) return data.report.inspection.items;
    if (data.inspection && Array.isArray(data.inspection.items) && data.inspection.items.some(function (item) { return item && item.status; })) return data.inspection.items;
    if (Array.isArray(data.items)) return data.items;
    if (data.inspection && data.inspection.results && data.inspection.items) {
      const templates = Array.isArray(data.inspection.items) ? data.inspection.items : [];
      return Object.keys(data.inspection.results).map(function (key, index) {
        const current = data.inspection.results[key] || {};
        const template = templates.find(function (item) { return item.id === current.inspectionItemId; }) || {};
        return Object.assign({}, template, current, { numero: index + 1, ambiente: current.ambiente || current.environment || current.environmentId, sistema: current.sistema || current.system || current.systemId, item: template.title || template.item || current.item || current.inspectionItemId, descricaoTecnica: current.notes || current.descricaoTecnica, recomendacaoAcao: current.recommendation || current.recomendacaoAcao, severidade: current.severity || current.severidade, fotos: current.fotos || current.photos || current.photoIds || [] });
      });
    }
    return [];
  }

  function normalizeInspectionStatusValue(value) {
    const status = clean(value).toUpperCase();
    if (/NAO_INSPECIONADO/.test(status)) return "NI";
    if (/NAO CONFORME|NÃO CONFORME|INCONFORME/.test(status)) return "NC";
    return status;
  }

  function isOpenNc(item) {
    if (normalizeInspectionStatusValue(item && item.status) !== "NC") return false;
    const situation = normalize(item && (item.situacao || item.statusCorrecao || item.correctionStatus));
    return !situation || !/resolvid|corrigid|fechad|concluid|baixad/.test(situation);
  }

  function severityRank(item) {
    const text = normalize(item && (item.severidade || item.severity || item.grauRisco));
    if (/critic/.test(text)) return 0;
    if (/alta/.test(text)) return 1;
    if (/media/.test(text)) return 2;
    if (/baixa/.test(text)) return 3;
    return 4;
  }

  function photoCount(item) {
    const photos = item && (item.fotos || item.photos || item.photoIds || item.evidencias || item.evidences);
    return Array.isArray(photos) ? photos.length : photos ? 1 : 0;
  }

  function openNcs(record) {
    return allInspectionItems(record).filter(isOpenNc).sort(function (a, b) { return severityRank(a) - severityRank(b); }).map(function (item, index) {
      return {
        ncId: clean(item.ncId) || "NC-" + String(index + 1).padStart(3, "0"),
        ambiente: clean(item.ambiente || item.environment || item.environmentId),
        item: clean(item.item || item.title || item.descricao || item.inspectionItemId),
        descricao: clean(item.descricaoTecnica || item.notes || item.description || item.observacoes),
        severidade: clean(item.severidade || item.severity || item.grauRisco),
        status: normalizeInspectionStatusValue(item.status),
        evidencias: photoCount(item)
      };
    });
  }

  function formatInspectionList(inspections) {
    if (!inspections.length) return "Não encontrei vistorias para esse contexto.";
    return "Vistorias encontradas: " + inspections.map(function (item) { return [inspectionTitle(item), inspectionUnit(item) ? "unidade " + inspectionUnit(item) : "", item.status].filter(Boolean).join(" - "); }).join("; ") + ".";
  }

  function resolveInspection(input, intent) {
    if (intent.inspectionId) {
      return fetchInspectionJson(input, getStockEndpoint("/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(intent.inspectionId))).then(function (data) { return data.inspection; });
    }
    return fetchInspectionJson(input, inspectionApiPath(input, "/api/obrareport/apartment-handover-inspections", input.payload || {})).then(function (data) {
      const inspections = Array.isArray(data.inspections) ? data.inspections : [];
      if (!intent.unit && inspections.length === 1) return inspections[0];
      const matches = inspections.filter(function (item) { return normalize(inspectionUnit(item)) === normalize(intent.unit); });
      if (!matches.length) throw Object.assign(new Error("inspection_not_found"), { status: 404, inspections: inspections });
      if (matches.length > 1) throw Object.assign(new Error("inspection_ambiguous"), { status: 409, inspections: matches });
      return matches[0];
    });
  }

  function executeInspectionList(input, intent) {
    return fetchInspectionJson(input, inspectionApiPath(input, "/api/obrareport/apartment-handover-inspections", input.payload || {})).then(function (data) {
      const inspections = Array.isArray(data.inspections) ? data.inspections : [];
      return inspectionResult(input, { action: "inspection.list", mode: "read", humanAnswer: formatInspectionList(inspections), data: { inspections: inspections.map(summarizeInspection) } });
    });
  }

  function executeInspectionGet(input, intent) {
    return resolveInspection(input, intent).then(function (inspection) {
      return inspectionResult(input, { action: "inspection.get", mode: "read", humanAnswer: "Encontrei a vistoria " + inspectionTitle(inspection) + (inspectionUnit(inspection) ? " da unidade " + inspectionUnit(inspection) : "") + ".", data: { inspection: summarizeInspection(inspection), rawInspection: inspection } });
    });
  }

  function executeInspectionOpenNcs(input, intent) {
    return resolveInspection(input, intent).then(function (inspection) {
      const ncs = openNcs(inspection);
      if (!ncs.length) return inspectionResult(input, { action: "inspection.openNCs", mode: "read", humanAnswer: "Não encontrei NCs abertas nessa vistoria.", data: { inspection: summarizeInspection(inspection), ncs: [] } });
      const answer = "NCs abertas" + (inspectionUnit(inspection) ? " na unidade " + inspectionUnit(inspection) : "") + ": " + ncs.map(function (nc) { return [nc.ambiente, nc.item, nc.severidade ? "severidade " + nc.severidade : "", nc.evidencias ? nc.evidencias + " foto(s)" : "sem foto"].filter(Boolean).join(" - "); }).join("; ") + ".";
      return inspectionResult(input, { action: "inspection.openNCs", mode: "read", humanAnswer: answer, data: { inspection: summarizeInspection(inspection), ncs: ncs } });
    });
  }

  function buildInspectionPdfPayload(inspection, mode) {
    const data = inspectionData(inspection);
    if (data.report && data.mode) return Object.assign({}, data, { mode: mode || data.mode || "draft" });
    if (data.report) return Object.assign({ mode: mode || "draft" }, data);
    const meta = inspectionMetadata(inspection);
    const items = allInspectionItems(inspection);
    return { mode: mode || "draft", report: { type: "apartment_handover_inspection", empreendimento: meta.projectName || inspectionTitle(inspection), obra: meta.projectName || inspectionTitle(inspection), unidade: meta.unitName || inspectionUnit(inspection), cliente: meta.clientName || "", responsavelTecnico: meta.technicalResponsible || "", creaCau: meta.professionalRegistry || "", dataVistoria: meta.inspectionDate || "", inspection: Object.assign({}, data.inspection || data, { id: inspection.id, finalizada: false, status: "draft", metadata: meta, items: items }) } };
  }

  function executeInspectionGeneratePdf(input, intent) {
    return resolveInspection(input, intent).then(function (inspection) {
      const payload = buildInspectionPdfPayload(inspection, clean(input.payload && input.payload.mode) || "draft");
      return window.fetch(getStockEndpoint("/api/apartment-handover/pdf"), { method: "POST", headers: inspectionHeaders(input), body: JSON.stringify(payload) }).then(function (response) {
        const contentType = response.headers && response.headers.get ? response.headers.get("content-type") || "" : "";
        if (!response.ok || contentType.indexOf("application/pdf") < 0) {
          return response.json().catch(function () { return {}; }).then(function (data) {
            const error = new Error(clean(data.error || data.code) || "inspection_pdf_failed");
            error.status = response.status;
            throw error;
          });
        }
        return response.blob ? response.blob() : response.arrayBuffer().then(function (buffer) { return new Blob([buffer], { type: "application/pdf" }); });
      }).then(function (blob) {
        const pdfUrl = window.URL && typeof window.URL.createObjectURL === "function" ? window.URL.createObjectURL(blob) : "";
        return inspectionResult(input, { action: "inspection.generatePdf", mode: "execute", humanAnswer: "PDF da vistoria gerado com sucesso" + (pdfUrl ? ": " + pdfUrl : "."), data: { inspection: summarizeInspection(inspection), pdfUrl: pdfUrl, sizeBytes: blob && blob.size || 0, status: "generated" } });
      });
    });
  }

  function executeInspection(input) {
    const auth = requireInspectionAccess(input);
    if (!auth.ok) return Promise.resolve(inspectionAuthBlocked(input, auth));
    const intent = parseInspectionIntent(input);
    const run = intent.action === "inspection.get" ? executeInspectionGet : intent.action === "inspection.openNCs" ? executeInspectionOpenNcs : intent.action === "inspection.generatePdf" ? executeInspectionGeneratePdf : executeInspectionList;
    return run(input, intent).catch(function (error) {
      const code = clean(error && error.message) || "inspection_error";
      if (code === "inspection_ambiguous") return inspectionResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Encontrei mais de uma vistoria possível para esse apartamento. Informe o ID ou detalhe a obra antes de continuar.", error: code, data: { matches: (error.inspections || []).map(summarizeInspection) } });
      if (code === "inspection_not_found") return inspectionResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Não encontrei essa vistoria no contexto autenticado. Nenhuma NC ou PDF foi inventado.", error: code });
      return inspectionResult(input, { ok: false, action: intent.action, mode: "error", humanAnswer: "Não consegui executar a action de vistoria. O backend retornou: " + code + ".", error: code });
    });
  }
  function rdoResult(input, values) { return result(input, Object.assign({ module: "obrareport_rdo" }, values || {})); }

  function getRdoIdentity(input) {
    const context = input && input.context || {};
    const identity = context.identity || {};
    return {
      institutionId: clean(context.institutionId || identity.institutionId || identity.institution_id || context.companyId || identity.companyId || identity.company_id),
      companyId: clean(context.companyId || identity.companyId || identity.company_id),
      userId: clean(context.userId || identity.userId || identity.id || identity.user_id),
      projectId: clean(context.projectId || context.workId || identity.projectId || identity.project_id || identity.workId || identity.work_id),
      clientId: clean(context.clientId || identity.clientId || identity.client_id)
    };
  }

  function requireRdoAccess(input) {
    if (!getAuthToken(input.context || {})) return { ok: false, reason: "auth" };
    const identity = getRdoIdentity(input);
    if (!identity.institutionId) return { ok: false, reason: "tenant" };
    return { ok: true, identity };
  }

  function rdoHeaders(input) {
    const auth = requireRdoAccess(input);
    const headers = { "Content-Type": "application/json" };
    const token = getAuthToken(input.context || {});
    if (token) headers.Authorization = /^Bearer\s+/i.test(token) ? token : "Bearer " + token;
    if (auth.identity && auth.identity.institutionId) headers["x-institution-id"] = auth.identity.institutionId;
    if (auth.identity && auth.identity.companyId) headers["x-company-id"] = auth.identity.companyId;
    if (auth.identity && auth.identity.userId) headers["x-user-id"] = auth.identity.userId;
    return headers;
  }

  function rdoAuthBlocked(input, auth) {
    if (auth.reason === "auth") return needsAuth(input, "Preciso de autenticação para consultar RDOs reais.");
    return rdoResult(input, { ok: false, action: input.action || "rdo.blocked", mode: "blocked", humanAnswer: "Preciso do tenant/empresa ativo para acessar RDOs reais. Nenhum RDO foi consultado.", error: "institution_required" });
  }

  function parseIsoDateOnly(value) {
    const raw = clean(value);
    if (!raw) return "";
    const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
    const brazil = raw.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (brazil) {
      const year = brazil[3] ? (brazil[3].length === 2 ? "20" + brazil[3] : brazil[3]) : String(new Date().getFullYear());
      return year + "-" + brazil[2].padStart(2, "0") + "-" + brazil[1].padStart(2, "0");
    }
    return "";
  }

  function addDays(date, days) {
    const copy = new Date(date.getTime());
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
  }

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function parseRdoIntent(input) {
    const action = clean(input && input.action);
    const payload = input && input.payload || {};
    const raw = clean(payload.message);
    const text = normalize(raw);
    const nowDate = payload.now ? new Date(payload.now) : new Date();
    const parsed = {
      action: /^rdo\./.test(action) ? action : action === "rdo_confirm" ? "rdo.confirm" : action === "list_rdos" ? "rdo.list" : action === "get_rdo" ? "rdo.get" : action === "problems_by_period" ? "rdo.problemsByPeriod" : /^(?:create_rdo|preview_new_rdo)$/.test(action) ? "rdo.create.preview" : /^(?:update_rdo|preview_update_rdo)$/.test(action) ? "rdo.update.preview" : "",
      raw,
      rdoId: clean(payload.rdoId || payload.rdo_id || payload.id),
      projectId: clean(payload.projectId || payload.project_id),
      workName: clean(payload.workName || payload.work_name || payload.obraName || payload.obra_name),
      clientId: clean(payload.clientId || payload.client_id),
      startDate: parseIsoDateOnly(payload.startDate || payload.start_date),
      endDate: parseIsoDateOnly(payload.endDate || payload.end_date),
      targetDate: parseIsoDateOnly(payload.date || payload.rdoDate || payload.rdo_date),
      limit: Number(payload.limit || 0) || 0,
      updateNote: clean(payload.note || payload.observation || payload.observacao || payload.description || payload.descricao)
    };
    const idMatch = raw.match(/\b(?:rdo|id)\s+([a-z0-9_-]{6,})\b/i);
    if (!parsed.rdoId && idMatch) parsed.rdoId = clean(idMatch[1]);
    if (!parsed.targetDate && /\bhoje\b/.test(text)) parsed.targetDate = isoDate(nowDate);
    if (!parsed.targetDate && /\bontem\b/.test(text)) parsed.targetDate = isoDate(addDays(nowDate, -1));
    if (!parsed.targetDate) parsed.targetDate = parseIsoDateOnly(raw);
    if (parsed.action === "rdo.update.preview" && !parsed.updateNote) {
      const noteMatch = raw.match(/(?:adicione|incluir|inclua|registre|registrar|atualize|atualizar)\s+(?:uma\s+)?(?:observa[cç][aã]o|nota|coment[aá]rio|ocorr[eê]ncia)?\s*[:\-]?\s*["“”']?(.+?)["“”']?$/i);
      parsed.updateNote = clean(noteMatch && noteMatch[1] || raw).replace(/^(?:nesse|neste|no|na)\s+rdo\b\s*/i, "").replace(/\s+(?:nesse|neste|no|na)\s+rdo\b\.?$/i, "");
    }
    const lastDays = text.match(/\b(?:ultimos|ultimas)\s+(\d{1,3})\s+dias\b/);
    if (lastDays && !parsed.startDate) {
      parsed.endDate = parsed.endDate || isoDate(nowDate);
      parsed.startDate = isoDate(addDays(nowDate, -Number(lastDays[1]) + 1));
    }
    if (!parsed.action) {
      if (/\b(?:problemas?|ocorrencias?|pendencias?)\b/.test(text) && /\b(?:repet\w*|recorrent\w*|frequenc\w*)\b/.test(text)) parsed.action = "rdo.problemsByPeriod";
      else if (/\b(?:abra|abrir|mostre|mostrar|ultimo|ontem|\d{1,2}\/\d{1,2})\b/.test(text)) parsed.action = "rdo.get";
      else parsed.action = "rdo.list";
    }
    if (parsed.action === "rdo.problemsByPeriod" && !parsed.startDate && !parsed.endDate) {
      parsed.endDate = isoDate(nowDate);
      parsed.startDate = isoDate(addDays(nowDate, -29));
    }
    if (parsed.startDate && parsed.endDate && parsed.startDate > parsed.endDate) parsed.invalidPeriod = true;
    return parsed;
  }

  function rdoApiPath(input, query) {
    const identity = getRdoIdentity(input);
    const safeQuery = query || {};
    const params = [];
    const projectId = clean(safeQuery.projectId || safeQuery.project_id || identity.projectId);
    const clientId = clean(safeQuery.clientId || safeQuery.client_id || identity.clientId);
    if (projectId) params.push("projectId=" + encodeURIComponent(projectId));
    if (clientId) params.push("clientId=" + encodeURIComponent(clientId));
    return getStockEndpoint("/api/obrareport/rdos") + (params.length ? "?" + params.join("&") : "");
  }

  function fetchRdos(input, intent) {
    if (typeof window.fetch !== "function") return Promise.reject(new Error("rdo_fetch_unavailable"));
    return window.fetch(rdoApiPath(input, intent), { method: "GET", headers: rdoHeaders(input) }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) {
          const error = new Error(clean(data.error) || "rdo_api_error");
          error.status = response.status;
          error.data = data;
          throw error;
        }
        return Array.isArray(data.rdos) ? data.rdos : [];
      });
    });
  }

  function rdoData(record) {
    return record && (record.rdo_data_json || record.rdoData || record.rdo_data) || {};
  }

  function rdoDate(record) {
    const data = rdoData(record);
    return parseIsoDateOnly(record && (record.rdo_date || record.rdoDate) || data.date || data.data || record && record.created_at);
  }

  function summarizeRdo(record) {
    return { id: clean(record && record.id), title: clean(record && record.title) || "RDO", date: rdoDate(record), status: clean(record && record.status), projectId: clean(record && (record.project_id || record.projectId)), updatedAt: clean(record && (record.updated_at || record.updatedAt)) };
  }

  function filterRdosByPeriod(rdos, intent) {
    return (rdos || []).filter(function (rdo) {
      const date = rdoDate(rdo);
      if (!date) return false;
      if (intent.startDate && date < intent.startDate) return false;
      if (intent.endDate && date > intent.endDate) return false;
      return true;
    });
  }

  function sortRdosByDateDesc(rdos) {
    return (rdos || []).slice().sort(function (a, b) {
      return String(rdoDate(b) || b.updated_at || "").localeCompare(String(rdoDate(a) || a.updated_at || ""));
    });
  }

  function formatRdoList(rdos) {
    if (!rdos.length) return "Não encontrei RDOs nesse contexto autenticado.";
    return "RDOs encontrados: " + rdos.map(function (item) {
      const summary = summarizeRdo(item);
      return [summary.date, summary.title, summary.status].filter(Boolean).join(" - ");
    }).join("; ") + ".";
  }

  function resolveRdo(rdos, intent) {
    const candidates = sortRdosByDateDesc(filterRdosByPeriod(rdos, intent));
    if (intent.rdoId) {
      const byId = candidates.filter(function (item) { return clean(item && item.id) === intent.rdoId; });
      if (!byId.length) throw Object.assign(new Error("rdo_not_found"), { status: 404 });
      return byId[0];
    }
    if (intent.targetDate) {
      const byDate = candidates.filter(function (item) { return rdoDate(item) === intent.targetDate; });
      if (!byDate.length) throw Object.assign(new Error("rdo_not_found"), { status: 404 });
      if (byDate.length > 1) throw Object.assign(new Error("rdo_ambiguous"), { status: 409, rdos: byDate });
      return byDate[0];
    }
    if (candidates.length > 1 && !/\bultimo\b/.test(normalize(intent.raw))) throw Object.assign(new Error("rdo_ambiguous"), { status: 409, rdos: candidates.slice(0, 5) });
    if (!candidates.length) throw Object.assign(new Error("rdo_not_found"), { status: 404 });
    return candidates[0];
  }

  function pushProblemText(entries, value, source) {
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        if (typeof item === "string") pushProblemText(entries, item, source);
        else if (item && typeof item === "object") pushProblemText(entries, item.title || item.description || item.descricao || item.text || item.note || item.observacao, source);
      });
      return;
    }
    if (value && typeof value === "object") {
      pushProblemText(entries, value.title || value.description || value.descricao || value.text || value.note || value.observacao, source);
      return;
    }
    const text = clean(value);
    if (text) entries.push({ text, source });
  }

  function extractRdoProblemEntries(record) {
    const data = rdoData(record);
    const entries = [];
    pushProblemText(entries, data.occurrences || data.ocorrencias || data.occurrence || data.ocorrencia, "occurrence");
    pushProblemText(entries, data.pendingItems || data.pendencias || data.pending_items || data.pending, "pending");
    if (data.safety && (data.safety.occurrence || data.safety.description)) pushProblemText(entries, data.safety.occurrence || data.safety.description, "occurrence");
    return entries;
  }

  function normalizeProblemKey(value) {
    return normalize(value)
      .replace(/\b(?:ocorrencia|ocorrencias|pendencia|pendencias|item)\b\s*[:.-]?\s*/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function aggregateRecurringProblems(rdos) {
    const groups = {};
    (rdos || []).forEach(function (rdo) {
      const date = rdoDate(rdo);
      const rdoId = clean(rdo && rdo.id);
      const seenInRdo = {};
      extractRdoProblemEntries(rdo).forEach(function (entry) {
        const key = normalizeProblemKey(entry.text);
        if (!key) return;
        const groupKey = entry.source + "|" + key;
        if (seenInRdo[groupKey]) return;
        seenInRdo[groupKey] = true;
        if (!groups[groupKey]) groups[groupKey] = { problem: entry.text, key, source: entry.source, count: 0, dates: [], rdoIds: [], evidence: [] };
        groups[groupKey].count += 1;
        if (date && groups[groupKey].dates.indexOf(date) < 0) groups[groupKey].dates.push(date);
        if (rdoId && groups[groupKey].rdoIds.indexOf(rdoId) < 0) groups[groupKey].rdoIds.push(rdoId);
        groups[groupKey].evidence.push({ rdoId, date, text: entry.text });
      });
    });
    return Object.values(groups).filter(function (item) { return item.count >= 2; }).sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.problem.localeCompare(b.problem);
    });
  }

  function executeRdoList(input, intent) {
    return fetchRdos(input, intent).then(function (rdos) {
      const filtered = sortRdosByDateDesc(filterRdosByPeriod(rdos, intent));
      const limited = intent.limit > 0 ? filtered.slice(0, intent.limit) : filtered;
      return rdoResult(input, { action: "rdo.list", mode: "read", humanAnswer: formatRdoList(limited), data: { rdos: limited.map(summarizeRdo), total: filtered.length } });
    });
  }

  function saveRdoContext(input, rdo) {
    try {
      const identity = getRdoIdentity(input);
      const summary = summarizeRdo(rdo);
      window.localStorage.setItem(RDO_CONTEXT_KEY, JSON.stringify({ createdAt: Date.now(), tenantBinding: tenantBinding(identity), rdo: summary, rawRdo: rdo }));
    } catch (error) {}
  }

  function readRdoContext(input) {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(RDO_CONTEXT_KEY) || "null");
      if (rdoPendingExpired_(parsed) || !sameTenantBinding(input, parsed)) return null;
      return parsed;
    } catch (error) { return null; }
  }

  function executeRdoGet(input, intent) {
    return fetchRdos(input, intent).then(function (rdos) {
      const rdo = resolveRdo(rdos, intent);
      const summary = summarizeRdo(rdo);
      saveRdoContext(input, rdo);
      return rdoResult(input, { action: "rdo.get", mode: "read", humanAnswer: "Encontrei o RDO " + (summary.date ? "de " + summary.date + " " : "") + "(" + summary.title + ").", data: { rdo: summary, rawRdo: rdo } });
    });
  }
  function executeRdoProblemsByPeriod(input, intent) {
    return fetchRdos(input, intent).then(function (rdos) {
      const filtered = filterRdosByPeriod(rdos, intent);
      const recurring = aggregateRecurringProblems(filtered);
      if (!recurring.length) return rdoResult(input, { action: "rdo.problemsByPeriod", mode: "read", humanAnswer: "Não encontrei problemas repetidos em mais de um RDO no período.", data: { problems: [], rdos: filtered.map(summarizeRdo), period: { startDate: intent.startDate, endDate: intent.endDate } } });
      const answer = "Encontrei " + recurring.length + " problema(s) recorrente(s) nos RDOs do período: " + recurring.map(function (item) { return item.problem + " - " + item.count + " RDOs - dias " + item.dates.join(", "); }).join("; ") + ".";
      return rdoResult(input, { action: "rdo.problemsByPeriod", mode: "read", humanAnswer: answer, data: { problems: recurring, rdos: filtered.map(summarizeRdo), period: { startDate: intent.startDate, endDate: intent.endDate } } });
    });
  }

  function readObraReportState_() {
    try {
      const raw = window.localStorage && window.localStorage.getItem(OBRAREPORT_STATE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.version === 1 && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function resolveExistingObraReportWorks_() {
    const state = readObraReportState_();
    const works = state && Array.isArray(state.works) ? state.works : [];
    return works.map(function (work) {
      return work && typeof work === "object" ? {
        id: clean(work.id),
        name: clean(work.name || work.nome),
        clientId: clean(work.clientId || work.client_id),
        address: clean(work.address || work.endereco),
        type: clean(work.type || work.tipo),
        status: clean(work.status)
      } : null;
    }).filter(function (work) { return !!(work && work.id && work.name); });
  }

  function rdoPendingExpired_(pending) {
    return !pending || !pending.createdAt || Date.now() - Number(pending.createdAt) > STOCK_CONFIRMATION_TTL_MS;
  }

  function readRdoPending() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(RDO_PENDING_KEY) || "null");
      if (rdoPendingExpired_(parsed)) {
        window.localStorage.removeItem(RDO_PENDING_KEY);
        return null;
      }
      return parsed;
    } catch (error) { return null; }
  }

  function saveRdoPending(pending) { window.localStorage.setItem(RDO_PENDING_KEY, JSON.stringify(pending)); }
  function clearRdoPending() { try { window.localStorage.removeItem(RDO_PENDING_KEY); } catch (error) {} }

  function makeRdoOperationId(action, identity, draft, raw) {
    return ["elo", action, draft.projectId || draft.workId || "work", draft.rdoDate || "date", identity.companyId || identity.institutionId || "tenant", identity.userId || "user", checksum(raw || draft.projectName || "rdo")].join(":");
  }

  function tenantBinding(identity) {
    return checksum([identity.institutionId || "", identity.companyId || "", identity.userId || ""].join("|"));
  }

  function sameTenantBinding(input, pending) {
    const identity = getRdoIdentity(input);
    return pending && pending.tenantBinding && pending.tenantBinding === tenantBinding(identity);
  }

  function makeRdoPending(input, intent, work) {
    const identity = getRdoIdentity(input);
    const draft = {
      projectId: clean(work && work.id),
      workId: clean(work && work.id),
      projectName: clean(work && work.name),
      clientId: clean(work && work.clientId),
      rdoDate: intent.targetDate || "",
      source: work && work.source || "obrareport_local_storage",
      rdoData: {
        date: intent.targetDate || "",
        projectId: clean(work && work.id),
        workId: clean(work && work.id),
        projectName: clean(work && work.name),
        observations: []
      }
    };
    const action = work && work.id ? "rdo.create.execute" : "rdo.create.preview";
    const operationId = makeRdoOperationId(action, identity, draft, intent.raw);
    draft.rdoData.operationId = operationId;
    return {
      action,
      status: work && work.id ? "pending" : "awaiting_work",
      createdAt: Date.now(),
      operationId,
      tenantBinding: tenantBinding(identity),
      identity: { institutionId: identity.institutionId, companyId: identity.companyId, userId: identity.userId, projectId: identity.projectId, clientId: identity.clientId },
      targetDate: intent.targetDate || "",
      raw: intent.raw || "",
      draft
    };
  }

  function resolveRdoWorkSelection_(input, intent) {
    const identity = getRdoIdentity(input);
    const works = resolveExistingObraReportWorks_();
    if (identity.projectId) {
      const contextWork = works.find(function (work) { return work.id === identity.projectId; }) || null;
      return { ok: true, source: "authenticated_context", works, work: Object.assign({ source: "authenticated_context" }, contextWork || { id: identity.projectId, name: identity.projectName || identity.projectId, clientId: identity.clientId }) };
    }
    const requestedName = clean(intent.workName || input && input.payload && (input.payload.workName || input.payload.work_name));
    if (requestedName) {
      const normalized = normalize(requestedName);
      const matches = works.filter(function (work) {
        const name = normalize(work.name);
        return name === normalized || name.indexOf(normalized) >= 0 || normalized.indexOf(name) >= 0;
      });
      if (matches.length === 1) return { ok: true, source: "obrareport_local_storage", works, work: Object.assign({ source: "obrareport_local_storage" }, matches[0]) };
      return { ok: false, reason: matches.length > 1 ? "ambiguous_work" : "work_not_found", works, requestedName };
    }
    if (works.length === 1) return { ok: true, source: "obrareport_local_storage", works, work: Object.assign({ source: "obrareport_local_storage" }, works[0]) };
    if (works.length > 1) return { ok: false, reason: "work_selection_required", works };
    return { ok: false, reason: "no_works", works };
  }

  function executeRdoCreatePreview(input, intent) {
    const pending = readRdoPending();
    if (pending && pending.action === "rdo.create.preview" && pending.status === "awaiting_work") {
      intent.targetDate = intent.targetDate || pending.targetDate;
    }
    const missing = [];
    if (!intent.targetDate) missing.push("data do RDO");
    const workResolution = resolveRdoWorkSelection_(input, intent);
    if (missing.length) {
      saveRdoPending(makeRdoPending(input, intent, null));
      return Promise.resolve(rdoResult(input, {
        ok: false,
        action: "rdo.create.preview",
        mode: "blocked",
        humanAnswer: "Para preparar o RDO sem inventar dados, informe: " + missing.join(", ") + ". Nenhum RDO foi criado.",
        error: "rdo_create_required_fields",
        data: { missing, works: workResolution.works || [] }
      }));
    }
    if (!workResolution.ok) {
      const pendingDraft = makeRdoPending(input, intent, null);
      if (workResolution.reason === "work_selection_required" || workResolution.reason === "work_not_found" || workResolution.reason === "ambiguous_work") saveRdoPending(pendingDraft);
      else clearRdoPending();
      const names = (workResolution.works || []).map(function (work) { return "- " + work.name; }).join("\n");
      const answer = workResolution.reason === "no_works"
        ? "Não encontrei nenhuma obra cadastrada. Cadastre ou selecione uma obra primeiro. Nenhum RDO foi criado."
        : workResolution.reason === "work_not_found"
          ? "Não encontrei essa obra entre as obras cadastradas. Escolha uma obra real da lista:\n" + names + "\nNenhum RDO foi criado."
          : "Para qual obra? Escolha uma obra real cadastrada:\n" + names + "\nNenhum RDO foi criado.";
      return Promise.resolve(rdoResult(input, {
        ok: false,
        action: "rdo.create.preview",
        mode: "blocked",
        humanAnswer: answer,
        error: workResolution.reason,
        data: { works: workResolution.works || [], pending: pendingDraft }
      }));
    }
    const work = workResolution.work;
    const pendingExecute = makeRdoPending(input, intent, work);
    saveRdoPending(pendingExecute);
    return Promise.resolve(rdoResult(input, {
      action: "rdo.create.preview",
      mode: "preview",
      requiresConfirmation: true,
      preview: [
        "Preview de criação de RDO:",
        "MODULE: obrareport_rdo",
        "ACTION: rdo.create",
        "PROJECT: " + work.name,
        "PROJECT ID: " + work.id,
        "DATE: " + intent.targetDate,
        "CONFIRMATION REQUIRED: SIM",
        "WRITE EXECUTED: 0",
        "/api/obrareport/rdos POST: 0"
      ].join("\n"),
      data: { draft: pendingExecute.draft, pending: pendingExecute }
    }));
  }

  function makeRdoUpdatePending(input, intent, rdo) {
    const identity = getRdoIdentity(input);
    const summary = summarizeRdo(rdo);
    const draft = { rdoId: summary.id, projectId: summary.projectId, rdoDate: summary.date, updateNote: clean(intent.updateNote), rawRdo: rdo, rdoData: Object.assign({}, rdoData(rdo)) };
    const operationId = makeRdoOperationId("rdo.update.execute", identity, { projectId: draft.projectId, workId: draft.projectId, rdoDate: draft.rdoDate, projectName: summary.title }, intent.raw + "|" + draft.updateNote);
    return { action: "rdo.update.execute", status: "pending", createdAt: Date.now(), operationId, tenantBinding: tenantBinding(identity), identity: { institutionId: identity.institutionId, companyId: identity.companyId, userId: identity.userId, projectId: draft.projectId }, raw: intent.raw || "", draft };
  }

  function executeRdoUpdatePreview(input, intent) {
    const context = readRdoContext(input);
    if (!context || !context.rawRdo) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.update.preview", mode: "blocked", humanAnswer: "Abra um RDO real antes de preparar uma atualização. Nenhum PUT foi executado.", error: "rdo_context_missing" }));
    if (!intent.updateNote) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.update.preview", mode: "blocked", humanAnswer: "Informe a observação real que deseja adicionar ao RDO. Nenhum PUT foi executado.", error: "rdo_update_required_fields" }));
    const pending = makeRdoUpdatePending(input, intent, context.rawRdo);
    saveRdoPending(pending);
    return Promise.resolve(rdoResult(input, { action: "rdo.update.preview", mode: "preview", requiresConfirmation: true, preview: ["Preview de atualização de RDO:", "MODULE: obrareport_rdo", "ACTION: rdo.update", "RDO ID: " + pending.draft.rdoId, "PROJECT ID: " + pending.draft.projectId, "DATE: " + pending.draft.rdoDate, "OBSERVATION: " + pending.draft.updateNote, "CONFIRMATION REQUIRED: SIM", "WRITE EXECUTED: 0", "/api/obrareport/rdos PUT: 0"].join("\n"), data: { draft: pending.draft, pending } }));
  }

  function postRdoJson(input, pending) {
    const draft = pending && pending.draft || {};
    const payload = {
      projectId: draft.projectId,
      clientId: draft.clientId || "",
      title: "RDO - " + (draft.projectName || "Obra") + " - " + draft.rdoDate,
      rdoDate: draft.rdoDate,
      status: "draft",
      rdoData: Object.assign({}, draft.rdoData || {}, { date: draft.rdoDate, operationId: pending.operationId })
    };
    return window.fetch(getStockEndpoint("/api/obrareport/rdos"), { method: "POST", headers: rdoHeaders(input), body: JSON.stringify(payload) }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) {
          const error = new Error(clean(data.error) || "rdo_create_failed");
          error.status = response.status;
          error.data = data;
          throw error;
        }
        return data;
      });
    });
  }

  function executePendingRdoCreate(input, pending) {
    if (!pending) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.confirm", mode: "blocked", humanAnswer: "Não há RDO pendente para confirmar. Nenhum RDO foi criado.", error: "rdo_pending_missing" }));
    if (pending.status === "saving" || pending.status === "saved") return Promise.resolve(rdoResult(input, { action: pending.action, mode: pending.status === "saved" ? "execute" : "blocked", humanAnswer: pending.status === "saved" ? "Esse RDO já foi confirmado. Não criei duplicado." : "Esse RDO já está em confirmação. Não vou enviar outro POST.", data: { pending, rdo: pending.rdo || null } }));
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para confirmar a criação real do RDO."));
    const identity = getRdoIdentity(input);
    if (!identity.institutionId) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.create.execute", mode: "blocked", humanAnswer: "Preciso do tenant autenticado para criar RDO. Nenhum POST foi executado.", error: "institution_required" }));
    if (!sameTenantBinding(input, pending)) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.create.execute", mode: "blocked", humanAnswer: "O tenant da sessão mudou desde o preview. Refaça o preview antes de confirmar. Nenhum RDO foi criado.", error: "rdo_tenant_changed" }));
    if (!pending.draft || !pending.draft.projectId || !pending.draft.rdoDate || !pending.operationId) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.create.execute", mode: "blocked", humanAnswer: "O preview de RDO está incompleto. Refaça o preview antes de confirmar. Nenhum POST foi executado.", error: "rdo_pending_incomplete" }));
    pending.status = "saving";
    saveRdoPending(pending);
    return postRdoJson(input, pending).then(function (data) {
      pending.status = "saved";
      pending.rdo = data && data.rdo || null;
      pending.savedAt = new Date().toISOString();
      saveRdoPending(pending);
      const rdo = pending.rdo || {};
      return rdoResult(input, { action: "rdo.create.execute", mode: "execute", humanAnswer: "RDO criado pelo ELO: " + (rdo.id || "sem id retornado") + ". POST /api/obrareport/rdos: 1.", data: { pending, rdo } });
    }).catch(function (error) {
      pending.status = "pending";
      pending.error = clean(error && error.message);
      saveRdoPending(pending);
      return rdoResult(input, { ok: false, action: "rdo.create.execute", mode: "error", humanAnswer: "Não criei o RDO porque o backend retornou: " + (clean(error.message) || "erro ao confirmar") + ".", error: clean(error.message), data: { pending } });
    });
  }

  function putRdoJson(input, pending) {
    const draft = pending && pending.draft || {};
    const baseData = Object.assign({}, draft.rdoData || {});
    const observations = Array.isArray(baseData.observations) ? baseData.observations.slice() : Array.isArray(baseData.observacoes) ? baseData.observacoes.slice() : [];
    if (draft.updateNote && observations.indexOf(draft.updateNote) < 0) observations.push(draft.updateNote);
    const payload = {
      status: clean(draft.rawRdo && draft.rawRdo.status) || "draft",
      rdoData: Object.assign({}, baseData, { date: draft.rdoDate, projectId: draft.projectId, observations, operationId: pending.operationId })
    };
    return window.fetch(getStockEndpoint("/api/obrareport/rdos/" + encodeURIComponent(draft.rdoId)), { method: "PUT", headers: rdoHeaders(input), body: JSON.stringify(payload) }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) {
          const error = new Error(clean(data.error) || "rdo_update_failed");
          error.status = response.status;
          error.data = data;
          throw error;
        }
        return data;
      });
    });
  }

  function executePendingRdoUpdate(input, pending) {
    if (!pending) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.confirm", mode: "blocked", humanAnswer: "Não há RDO pendente para confirmar. Nenhum RDO foi atualizado.", error: "rdo_pending_missing" }));
    if (pending.status === "saving" || pending.status === "saved") return Promise.resolve(rdoResult(input, { action: pending.action, mode: pending.status === "saved" ? "execute" : "blocked", humanAnswer: pending.status === "saved" ? "Esse RDO já foi atualizado. Não enviei PUT duplicado." : "Esse RDO já está em atualização. Não vou enviar outro PUT.", data: { pending, rdo: pending.rdo || null } }));
    if (!getAuthToken(input.context || {})) return Promise.resolve(needsAuth(input, "Preciso de autenticação para confirmar a atualização real do RDO."));
    const identity = getRdoIdentity(input);
    if (!identity.institutionId) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.update.execute", mode: "blocked", humanAnswer: "Preciso do tenant autenticado para atualizar RDO. Nenhum PUT foi executado.", error: "institution_required" }));
    if (!sameTenantBinding(input, pending)) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.update.execute", mode: "blocked", humanAnswer: "O tenant da sessão mudou desde o preview. Refaça o preview antes de confirmar. Nenhum RDO foi atualizado.", error: "rdo_tenant_changed" }));
    if (!pending.draft || !pending.draft.rdoId || !pending.draft.projectId || !pending.draft.updateNote || !pending.operationId) return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.update.execute", mode: "blocked", humanAnswer: "O preview de atualização do RDO está incompleto. Refaça o preview antes de confirmar. Nenhum PUT foi executado.", error: "rdo_pending_incomplete" }));
    pending.status = "saving";
    saveRdoPending(pending);
    return putRdoJson(input, pending).then(function (data) {
      pending.status = "saved";
      pending.rdo = data && data.rdo || null;
      pending.savedAt = new Date().toISOString();
      saveRdoPending(pending);
      return rdoResult(input, { action: "rdo.update.execute", mode: "execute", humanAnswer: "RDO atualizado pelo ELO. PUT /api/obrareport/rdos: 1.", data: { pending, rdo: pending.rdo } });
    }).catch(function (error) {
      pending.status = "pending";
      pending.error = clean(error && error.message);
      saveRdoPending(pending);
      return rdoResult(input, { ok: false, action: "rdo.update.execute", mode: "error", humanAnswer: "Não atualizei o RDO porque o backend retornou: " + (clean(error.message) || "erro ao confirmar") + ".", error: clean(error.message), data: { pending } });
    });
  }

  function executeRdoConfirm(input) {
    const pending = readRdoPending();
    if (pending && pending.action === "rdo.create.execute") return executePendingRdoCreate(input, pending);
    if (pending && pending.action === "rdo.update.execute") return executePendingRdoUpdate(input, pending);
    return Promise.resolve(rdoResult(input, { ok: false, action: "rdo.confirm", mode: "blocked", humanAnswer: "Não há ação de RDO pendente para confirmar. Nenhum RDO foi criado ou atualizado.", error: "rdo_pending_missing" }));
  }
  function executeRdo(input) {
    const auth = requireRdoAccess(input);
    if (!auth.ok) return Promise.resolve(rdoAuthBlocked(input, auth));
    const intent = parseRdoIntent(input);
    if (intent.invalidPeriod) return Promise.resolve(rdoResult(input, { ok: false, action: intent.action || "rdo.blocked", mode: "blocked", humanAnswer: "Período inválido: a data inicial é posterior à data final.", error: "invalid_period" }));
    const run = intent.action === "rdo.confirm" ? executeRdoConfirm : intent.action === "rdo.get" ? executeRdoGet : intent.action === "rdo.problemsByPeriod" ? executeRdoProblemsByPeriod : intent.action === "rdo.create.preview" ? executeRdoCreatePreview : intent.action === "rdo.update.preview" ? executeRdoUpdatePreview : executeRdoList;
    return run(input, intent).catch(function (error) {
      const code = clean(error && error.message) || "rdo_error";
      if (code === "rdo_ambiguous") return rdoResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Encontrei mais de um RDO compatível. Informe o ID ou uma data mais específica.", error: code, data: { matches: (error.rdos || []).map(summarizeRdo) } });
      if (code === "rdo_not_found") return rdoResult(input, { ok: false, action: intent.action, mode: "blocked", humanAnswer: "Não encontrei esse RDO no contexto autenticado. Nenhum RDO foi inventado.", error: code });
      return rdoResult(input, { ok: false, action: intent.action, mode: "error", humanAnswer: "Não consegui executar a action de RDO. O backend retornou: " + code + ".", error: code });
    });
  }

  function executeObraReport(input, type) {
    if (type === "rdo") return executeRdo(input);
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
    if (intent.action === "stock.listProducts") return executeListProducts(input);
    if (intent.action === "stock.query") return executeStockQuery(input, intent);
    if (intent.action === "stock.lowStock") return executeLowStock(input);
    if (intent.action === "stock.history") return executeMovementHistory(input);
    if (intent.action === "stock.create_product.preview") return executeCreateProductPreview(input, intent);
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

  function executeMunicipal(input) {
    if (!window.EloMunicipalActionAdapter || typeof window.EloMunicipalActionAdapter.execute !== "function") {
      return unsupported(input, "Adapter municipal indisponivel para executar esta acao.");
    }
    return window.EloMunicipalActionAdapter.execute(input);
  }

  function executeMunicipalSentinel(input) {
    if (!window.EloMunicipalSentinelAdapter || typeof window.EloMunicipalSentinelAdapter.execute !== "function") {
      return unsupported(input, "Adapter municipal do Sentinela indisponivel para executar esta acao.");
    }
    return window.EloMunicipalSentinelAdapter.execute(input);
  }

  function execute(input) {
    const safe = input && typeof input === "object" ? input : {};
    if (MODULES.indexOf(safe.module) < 0) return unsupported(safe, "Módulo fora do escopo da Fase 1 do ELO.");
    if (safe.module === "budget") return executeBudget(safe);
    if (safe.module === "inspection") return executeInspection(safe);
    if (safe.module === "obrareport_rdo") return executeObraReport(safe, "rdo");
    if (safe.module === "obrareport_report") return executeObraReport(safe, "report");
    if (safe.module === "stock_full") return executeStockFull(safe);
    if (safe.module === "stock_obras") return executeStockObras(safe);
    if (safe.module === "elo_autopilot") return executeEloAutopilot(safe);
    if (safe.module === "municipal") return executeMunicipal(safe);
    if (safe.module === "municipal_sentinel") return executeMunicipalSentinel(safe);
    if (safe.module === "memory") return executeMemory(safe);
    if (safe.module === "alerts") return executeAlerts(safe);
    return unsupported(safe);
  }

  window.EloCommandBridge = Object.assign({}, window.EloCommandBridge || {}, {
    execute,
    modules: MODULES.slice()
  });
  window.EloActionBusInspection = Object.assign({}, window.EloActionBusInspection || {}, {
    execute: executeInspection,
    parseIntent: parseInspectionIntent,
    openNcs,
    version: "elo-action-bus-inspection-v1"
  });
  window.EloActionBusStockFull = Object.assign({}, window.EloActionBusStockFull || {}, {
    execute: executeStockFull,
    parseIntent: parseStockIntent,
    readPending,
    clearPending,
    version: "elo-action-bus-stock-v1"
  });
  window.EloActionBusRdo = Object.assign({}, window.EloActionBusRdo || {}, {
    execute: executeRdo,
    parseIntent: parseRdoIntent,
    readPending: readRdoPending,
    clearPending: clearRdoPending,
    resolveExistingWorks: resolveExistingObraReportWorks_,
    aggregateRecurringProblems,
    normalizeProblemKey,
    version: "elo-action-bus-rdo-v1"
  });
})();

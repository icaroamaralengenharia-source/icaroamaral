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
      return fetchStockJson(input, "/api/stock-full/transfers", { method: "POST", body: JSON.stringify({ sourceItemId: getItemId(pending.item), destinationItemId: getItemId(pending.destinationItem), quantity: pending.quantity, destination: pending.destinationQuery || getItemName(pending.destinationItem), operationId: pending.operationId, offlineUuid: pending.offlineUuid, deviceId: pending.identity && pending.identity.deviceId, source: "elo_action_bus" }) });
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

  function inspectionResult(input, values) { return result(input, Object.assign({ module: "inspection" }, values || {})); }

  function getInspectionIdentity(input) {
    const context = input && input.context || {};
    const identity = context.identity || {};
    return {
      institutionId: clean(context.institutionId || context.companyId || identity.institutionId || identity.institution_id || identity.companyId || identity.company_id),
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
})();

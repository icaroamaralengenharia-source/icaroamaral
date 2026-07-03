(function (window) {
  "use strict";

  const core = window.StockFullCore || {};
  const stock = window.StockFullStock || {};
  const sync = window.StockFullSync || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };
  const parseNumber = core.parseNumber || function (value) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; };
  const roundQuantity = core.roundQuantity || function (value) { return Math.round(Number(value || 0) * 1000) / 1000; };
  const createId = core.createId || function (prefix) { return clean(prefix || "sf") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); };
  const STORAGE_KEY = core.storageKey || "obraReportAlmoxarifadoData";
  const AUDIT_STORAGE_KEY = "stockFullFrontlineAuditLog";
  const ALERT_STORAGE_KEY = "stockFullFrontlineAlerts";
  const NUMBER_WORDS = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, trÃªs: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
    quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezassete: 17, dezessete: 17,
    dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
    sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100
  };

  function getStorage() {
    return core.getLocalStorage ? core.getLocalStorage() : window.localStorage;
  }

  function readJson(key, fallback) {
    if (core.readJson) return core.readJson(key, fallback);
    try {
      const raw = getStorage().getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    if (core.writeJson) return core.writeJson(key, value);
    getStorage().setItem(key, JSON.stringify(value));
    return true;
  }

  function normalizeText(value) {
    return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,;:]/g, " ").replace(/\s+/g, " ").trim();
  }

  function parseSpokenNumber(value) {
    const raw = clean(value).toLowerCase();
    const direct = parseNumber(raw);
    if (direct) return direct;
    const normalized = normalizeText(raw).replace(/\be\b/g, " ");
    return normalized.split(/\s+/).reduce(function (sum, part) {
      return sum + (NUMBER_WORDS[part] || 0);
    }, 0);
  }

  function getNumberExpressionPattern_() {
    return "(?:\\d+(?:[,.]\\d+)?|zero|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezassete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem)(?:\\s+e\\s+(?:um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove))?";
  }

  function matchQuantityBefore(text, keywordPattern) {
    const pattern = new RegExp("(" + getNumberExpressionPattern_() + ")\\s+(?:" + keywordPattern + ")\\b");
    const matches = Array.from(text.matchAll(new RegExp(pattern, "g")));
    const match = matches.length ? matches[matches.length - 1] : null;
    return match ? parseSpokenNumber(match[1]) : 0;
  }

  function findProductByName(productName, items) {
    const target = normalizeText(productName);
    if (!target) return null;
    return (items || []).find(function (item) {
      return normalizeText(item && item.name).indexOf(target) >= 0 || target.indexOf(normalizeText(item && item.name)) >= 0;
    }) || null;
  }

  function parseInventoryCommand(command, options) {
    const raw = clean(command);
    const text = normalizeText(raw);
    const state = options && options.state || readJson(STORAGE_KEY, { items: [], movements: [] });
    const codeMatch = text.match(/\b(?:codigo|cod|item)\s+([a-z0-9-]+)/);
    const productMatch = text.match(/\bproduto\s+([a-z0-9\s-]+?)(?:\s+entrada|\s+retirar|\s+saida|\s+ajuste|\s+lote|\s+\d|\s+um|\s+uma|\s+dois|\s+duas|\s+tres|\s+quatro|\s+cinco|\s+dez|\s+vinte|\s+trinta|$)/);
    const batchMatch = text.match(/\blote\s+([a-z0-9-]+)/);
    const damagedQuantity = matchQuantityBefore(text, "avariad[ao]s?|perdid[ao]s?|danificad[ao]s?|quebrad[ao]s?");
    const totalQuantity = matchQuantityBefore(text, "unidades?|un|caixas?|pecas?|pecas");
    const isExit = /\b(?:retirar|saida|saÃ­da|baixar|vender|entregar)\b/.test(text);
    const operationType = isExit ? "stock_exit" : "inventory_adjustment";
    const productCode = codeMatch ? clean(codeMatch[1]).toUpperCase() : "";
    const found = productCode ? null : findProductByName(productMatch && productMatch[1], state.items || []);
    const productName = found && found.name || clean(productMatch && productMatch[1]) || "";
    const availableQuantity = isExit ? totalQuantity : Math.max(0, roundQuantity(totalQuantity - damagedQuantity));
    return {
      productCode: productCode || clean(found && (found.sku || found.fiscalCode)),
      productName: productName || null,
      productId: clean(found && found.id),
      batch: batchMatch ? clean(batchMatch[1]).toUpperCase() : "",
      totalQuantity: roundQuantity(totalQuantity),
      damagedQuantity: roundQuantity(damagedQuantity),
      availableQuantity: roundQuantity(availableQuantity),
      operationType: operationType,
      lossType: damagedQuantity > 0 ? "damaged" : "",
      source: "voice_or_text_inventory",
      confidence: totalQuantity > 0 && (productCode || productName) ? 0.86 : 0.45,
      rawText: raw
    };
  }

  function buildIdempotencyKey(parsed, context) {
    const base = [
      parsed.operationType,
      parsed.productId || parsed.productCode || parsed.productName,
      parsed.batch,
      parsed.totalQuantity,
      parsed.damagedQuantity,
      clean(context && context.companyId) || getCompanyId(),
      normalizeText(parsed.rawText)
    ];
    return base.join("|");
  }

  function getCompanyId() {
    const session = core.getSession ? core.getSession() : {};
    return clean(session.companyId || session.institutionId || session.company_id || session.institution_id) || "local";
  }

  function getCurrentUserId() {
    const session = core.getSession ? core.getSession() : {};
    return clean(session.userId || session.profileId || session.userEmail || session.email) || "local_user";
  }

  function createInventoryOperation(parsed, context) {
    const safeParsed = parsed || {};
    const companyId = clean(context && context.companyId) || getCompanyId();
    const userId = clean(context && context.userId) || getCurrentUserId();
    const operationId = clean(context && context.operationId) || createId("frontline_op");
    const idempotencyKey = clean(context && context.idempotencyKey) || buildIdempotencyKey(safeParsed, { companyId });
    return {
      operationId,
      idempotencyKey,
      companyId,
      userId,
      productCode: clean(safeParsed.productCode),
      productName: safeParsed.productName || null,
      productId: clean(safeParsed.productId),
      batch: clean(safeParsed.batch),
      operationType: clean(safeParsed.operationType) || "inventory_adjustment",
      totalQuantity: roundQuantity(safeParsed.totalQuantity),
      availableQuantity: roundQuantity(safeParsed.availableQuantity),
      damagedQuantity: roundQuantity(safeParsed.damagedQuantity),
      lossType: clean(safeParsed.lossType),
      source: "voice_or_text_inventory",
      timestamp: clean(context && context.timestamp) || new Date().toISOString(),
      syncStatus: "pending",
      rawText: clean(safeParsed.rawText)
    };
  }

  function appendAudit(operation) {
    const log = readJson(AUDIT_STORAGE_KEY, []);
    const record = {
      id: createId("frontline_audit"),
      action: "frontline_inventory_operation_created",
      userId: operation.userId,
      companyId: operation.companyId,
      productCode: operation.productCode,
      productName: operation.productName,
      productId: operation.productId,
      batch: operation.batch,
      availableQuantity: operation.availableQuantity,
      damagedQuantity: operation.damagedQuantity,
      source: operation.source,
      timestamp: operation.timestamp,
      operationId: operation.operationId,
      syncStatus: operation.syncStatus
    };
    log.push(record);
    writeJson(AUDIT_STORAGE_KEY, log);
    return record;
  }

  function findItemForOperation(operation, state) {
    const items = state && state.items || [];
    return items.find(function (item) {
      return clean(item.id) === clean(operation.productId)
        || clean(item.sku || item.fiscalCode).toUpperCase() === clean(operation.productCode).toUpperCase()
        || normalizeText(item.name) === normalizeText(operation.productName);
    }) || null;
  }

  function buildAlerts(operation, state, options) {
    const alerts = [];
    const item = findItemForOperation(operation, state || {});
    if (item && stock.getItemBalance) {
      const balance = stock.getItemBalance(item, state.movements || []);
      const projected = operation.operationType === "stock_exit" ? balance - operation.availableQuantity : balance + operation.availableQuantity;
      const minimum = parseNumber(item.minimumStock || item.minStock);
      if (minimum > 0 && projected <= minimum) {
        alerts.push({ type: "below_minimum", severity: projected <= 0 ? "critical" : "warning", message: "Produto abaixo do minimo apos operacao de campo.", productId: item.id, operationId: operation.operationId });
      }
    }
    const lossLimit = parseNumber(options && options.lossLimit) || 1;
    if (operation.damagedQuantity >= lossLimit) {
      alerts.push({ type: "loss_detected", severity: operation.damagedQuantity >= 5 ? "critical" : "warning", message: "Perda/avaria registrada no inventario de campo.", productId: operation.productId, operationId: operation.operationId });
    }
    const queue = sync.getQueue ? sync.getQueue() : [];
    const sameTurnManual = queue.filter(function (item) {
      return item && item.payload && item.payload.source === "voice_or_text_inventory" && clean(item.status) !== "synced";
    }).length;
    const limit = parseNumber(options && options.manualOfflineLimit) || 5;
    if (sameTurnManual >= limit) {
      alerts.push({ type: "offline_manual_volume", severity: "warning", message: "Muitas alteracoes manuais offline no mesmo turno.", operationId: operation.operationId });
    }
    const existing = readJson(ALERT_STORAGE_KEY, []);
    writeJson(ALERT_STORAGE_KEY, existing.concat(alerts));
    return alerts;
  }

  function enqueueInventoryOperation(operation) {
    if (!sync.enqueue) return null;
    const movementType = operation.operationType === "stock_exit" ? "stock:exit" : "stock:adjust";
    const payload = {
      id: operation.operationId,
      itemId: operation.productId || operation.productCode || operation.productName,
      productId: operation.productId || operation.productCode || operation.productName,
      itemName: operation.productName,
      productCode: operation.productCode,
      batch: operation.batch,
      quantity: operation.availableQuantity,
      damagedQuantity: operation.damagedQuantity,
      totalQuantity: operation.totalQuantity,
      lossType: operation.lossType,
      source: operation.source,
      origin: operation.source,
      reason: operation.lossType ? "Inventario de campo com avaria/perda" : "Inventario de campo por texto/voz",
      notes: operation.rawText,
      operationId: operation.operationId,
      offlineUuid: operation.idempotencyKey,
      idempotencyKey: operation.idempotencyKey
    };
    return sync.enqueue(movementType, payload, {
      operationId: operation.operationId,
      localOperationKey: operation.idempotencyKey,
      companyId: operation.companyId,
      userId: operation.userId
    });
  }

  function submitInventoryCommand(command, options) {
    const state = options && options.state || readJson(STORAGE_KEY, { items: [], movements: [] });
    const parsed = parseInventoryCommand(command, { state });
    const operation = createInventoryOperation(parsed, options || {});
    const queued = enqueueInventoryOperation(operation);
    const audit = appendAudit(operation);
    const alerts = buildAlerts(operation, state, options || {});
    return { parsed, operation, queued, audit, alerts };
  }

  window.StockFullFrontline = {
    parseInventoryCommand,
    createInventoryOperation,
    submitInventoryCommand,
    buildIdempotencyKey,
    buildAlerts,
    storageKeys: {
      audit: AUDIT_STORAGE_KEY,
      alerts: ALERT_STORAGE_KEY
    }
  };
})(window);

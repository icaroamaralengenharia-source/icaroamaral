(function (window) {
  "use strict";

  const core = window.StockFullCore || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };
  const parseNumber = core.parseNumber || function (value) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; };
  const createTemporaryId = core.createTemporaryId || function (type) { return "tmp_" + clean(type || "record") + "_" + Date.now().toString(36); };
  const ALMOX_STORAGE_KEY = core.storageKey || "obraReportAlmoxarifadoData";
  const QUEUE_STORAGE_KEY = "stockFullOfflineSyncQueue";
  const META_STORAGE_KEY = "stockFullOfflineSyncMeta";
  const ID_MAP_STORAGE_KEY = "stockFullOfflineSyncIdMap";
  const SYNCED_MOVEMENTS_STORAGE_KEY = "stockFullSyncedMovementKeys";
  const VALID_STATUSES = new Set(["pending", "syncing", "synced", "failed", "conflict"]);
  let syncInProgress = false;
  let transportOverride = null;
  let previousAlmoxState = null;
  let storagePatched = false;
  let autoSyncTimer = null;
  let initialized = false;

  function isSupabaseConfigured() {
    const config = window.OBRAREPORT_CONFIG || {};
    return Boolean(clean(config.stockFullSupabaseUrl || window.STOCK_FULL_SUPABASE_URL) && clean(config.stockFullSupabaseAnonKey || window.STOCK_FULL_SUPABASE_ANON_KEY));
  }

  function getFallbackStatus() {
    return {
      mode: isSupabaseConfigured() ? "supabase_configured" : "localStorage",
      fallback: !isSupabaseConfigured()
    };
  }

  function mapRemoteMovement(movement, type) {
    const source = movement || {};
    return {
      id: clean(source.id),
      companyId: clean(source.company_id || source.institution_id),
      itemId: clean(source.product_id || source.item_id),
      productId: clean(source.product_id || source.item_id),
      type: clean(source.type || type),
      quantity: Number(source.quantity || 0),
      unitCost: Number(source.unit_cost || 0),
      total: Number(source.total || 0),
      supplier: clean(source.supplier),
      destination: clean(source.destination),
      responsible: clean(source.responsible),
      notes: clean(source.notes),
      date: clean(source.created_at),
      createdAt: clean(source.created_at),
      remoteSource: "supabase"
    };
  }

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

  function getQueue() {
    return normalizeQueue(readJson(QUEUE_STORAGE_KEY, []));
  }

  function saveQueue(queue) {
    writeJson(QUEUE_STORAGE_KEY, normalizeQueue(queue));
    refreshSyncMeta();
    renderIndicator();
  }

  function getMeta() {
    const meta = readJson(META_STORAGE_KEY, {});
    return meta && typeof meta === "object" ? meta : {};
  }

  function saveMeta(meta) {
    writeJson(META_STORAGE_KEY, Object.assign({}, getMeta(), meta || {}));
    renderIndicator();
  }

  function getIdMap() {
    const map = readJson(ID_MAP_STORAGE_KEY, {});
    return map && typeof map === "object" ? map : {};
  }

  function saveIdMap(map) {
    writeJson(ID_MAP_STORAGE_KEY, map || {});
  }

  function getSyncedMovementKeys() {
    const keys = readJson(SYNCED_MOVEMENTS_STORAGE_KEY, []);
    return Array.isArray(keys) ? keys : [];
  }

  function saveSyncedMovementKeys(keys) {
    writeJson(SYNCED_MOVEMENTS_STORAGE_KEY, Array.from(new Set(keys || [])));
  }

  function normalizeQueue(queue) {
    return (Array.isArray(queue) ? queue : []).map(function (item) {
      const now = new Date().toISOString();
      const status = VALID_STATUSES.has(item && item.status) ? item.status : "pending";
      return {
        id: clean(item && item.id) || createTemporaryId("queue"),
        operation: clean(item && (item.operation || item.type)) || "unknown",
        type: clean(item && (item.type || item.operation)) || "unknown",
        payload: item && item.payload && typeof item.payload === "object" ? item.payload : {},
        companyId: clean(item && item.companyId),
        createdAt: clean(item && item.createdAt) || now,
        updatedAt: clean(item && item.updatedAt) || now,
        status,
        attempts: Math.max(0, parseNumber(item && item.attempts)),
        lastError: clean(item && item.lastError),
        localOnly: item && item.localOnly === false ? false : true,
        localOperationKey: clean(item && item.localOperationKey)
      };
    });
  }

  function refreshSyncMeta() {
    const queue = normalizeQueue(readJson(QUEUE_STORAGE_KEY, []));
    const pendingCount = queue.filter(function (item) { return item.status === "pending" || item.status === "syncing"; }).length;
    const failedCount = queue.filter(function (item) { return item.status === "failed"; }).length;
    const conflictCount = queue.filter(function (item) { return item.status === "conflict"; }).length;
    saveMeta({ pendingCount, failedCount, conflictCount });
    return { pendingCount, failedCount, conflictCount };
  }

  function getCompanyId(payload) {
    const session = core.getSession ? core.getSession() : {};
    return clean(payload && (payload.companyId || payload.company_id || payload.institution_id)) || clean(session.companyId || session.institutionId || session.company_id || session.institution_id) || "local";
  }

  function buildOperationKey(operation, payload) {
    const source = payload || {};
    const id = clean(source.id || source.localId || source.itemId || source.productId || source.movementId);
    const date = clean(source.createdAt || source.date || source.movementDateTime || source.updatedAt);
    return [operation, id, date].filter(Boolean).join(":");
  }

  function enqueueOperation(operation, payload, options) {
    const safePayload = Object.assign({}, payload || {});
    const safeOperation = clean(operation);
    const localOperationKey = clean(options && options.localOperationKey) || buildOperationKey(safeOperation, safePayload);
    const queue = getQueue();
    const duplicate = queue.find(function (item) {
      return item.localOperationKey && item.localOperationKey === localOperationKey && item.status !== "failed" && item.status !== "conflict";
    });
    if (duplicate) {
      renderIndicator();
      return duplicate;
    }
    const now = new Date().toISOString();
    const item = {
      id: createTemporaryId("queue"),
      operation: safeOperation,
      type: safeOperation,
      payload: safePayload,
      companyId: clean(options && options.companyId) || getCompanyId(safePayload),
      createdAt: now,
      updatedAt: now,
      status: "pending",
      attempts: 0,
      lastError: "",
      localOnly: !(options && options.localOnly === false),
      localOperationKey
    };
    queue.push(item);
    saveQueue(queue);
    scheduleAutoSync();
    return item;
  }

  function sortQueueForDependencies(queue) {
    const rank = { "product:create": 1, "product:update": 2, "stock:entry": 3, "stock:exit": 4, "stock:adjust": 5 };
    return queue.slice().sort(function (a, b) {
      return (rank[a.operation] || 50) - (rank[b.operation] || 50) || String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }

  function getAuthToken() {
    const storage = getStorage();
    const keys = ["sb-stock-full-auth-token", "stockFullSupabaseToken"];
    for (let index = 0; index < keys.length; index += 1) {
      try {
        const raw = storage && storage.getItem(keys[index]);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const token = parsed && (parsed.access_token || parsed.currentSession && parsed.currentSession.access_token || parsed.session && parsed.session.access_token);
        if (token) return token;
      } catch (error) {
        if (rawLooksLikeToken_(storage && storage.getItem(keys[index]))) return storage.getItem(keys[index]);
      }
    }
    return "";
  }

  function rawLooksLikeToken_(value) {
    return clean(value).split(".").length >= 2;
  }

  async function fetchJson(url, options) {
    const token = getAuthToken();
    if (!token) throw new Error("stock_full_auth_unavailable");
    const response = await window.fetch(url, Object.assign({}, options || {}, {
      headers: Object.assign({ Authorization: "Bearer " + token, "Content-Type": "application/json" }, options && options.headers || {})
    }));
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.ok) throw new Error(data.error || "stock_full_sync_request_failed");
    return data;
  }

  function getDefaultTransport() {
    return {
      async createProduct(payload) {
        return fetchJson("/api/stock-full/items", { method: "POST", body: JSON.stringify(mapProductPayload(payload)) });
      },
      async updateProduct(payload) {
        const remoteId = clean(payload.remoteId || payload.id);
        if (!remoteId || remoteId.indexOf("tmp_") === 0) throw new Error("product_remote_id_unavailable");
        return fetchJson("/api/stock-full/items/" + encodeURIComponent(remoteId), { method: "PUT", body: JSON.stringify(mapProductPayload(payload)) });
      },
      async createEntry(payload) {
        return fetchJson("/api/stock-full/entries", { method: "POST", body: JSON.stringify(mapMovementPayload(payload)) });
      },
      async createExit(payload) {
        return fetchJson("/api/stock-full/exits", { method: "POST", body: JSON.stringify(mapMovementPayload(payload)) });
      },
      async createAdjustment(payload) {
        return fetchJson("/api/stock-full/entries", { method: "POST", body: JSON.stringify(mapMovementPayload(payload)) });
      }
    };
  }

  function getTransport() {
    return transportOverride || getDefaultTransport();
  }

  function configure(options) {
    if (options && options.transport) transportOverride = options.transport;
  }

  function mapProductPayload(payload) {
    const source = payload || {};
    return {
      id: clean(source.id),
      name: clean(source.name),
      sku: clean(source.sku || source.fiscalCode),
      unit: clean(source.unit) || "un",
      category: clean(source.category) || "Geral",
      minQuantity: parseNumber(source.minimumStock || source.minStock || source.minQuantity),
      currentQuantity: parseNumber(source.currentStock || source.initialQuantity || source.currentQuantity),
      location: clean(source.location),
      notes: clean(source.notes),
      costPrice: parseNumber(source.costPrice || source.unitCost),
      salePrice: parseNumber(source.salePrice),
      supplier: clean(source.supplier)
    };
  }

  function mapMovementPayload(payload) {
    const source = payload || {};
    const idMap = getIdMap();
    const itemId = clean(source.itemId || source.productId);
    return {
      id: clean(source.id),
      itemId: idMap[itemId] || itemId,
      quantity: parseNumber(source.quantity),
      unitCost: parseNumber(source.unitCost),
      supplier: clean(source.supplier),
      destination: clean(source.destination || source.sector || source.recipient),
      responsible: clean(source.responsible),
      notes: clean(source.notes),
      reason: clean(source.reason || source.origin)
    };
  }

  async function processQueue() {
    if (syncInProgress) return getQueue();
    syncInProgress = true;
    saveMeta({ lastSyncAttemptAt: new Date().toISOString(), lastSyncError: "" });
    renderIndicator("Sincronizando");
    let queue = getQueue();
    try {
      const transport = getTransport();
      const ordered = sortQueueForDependencies(queue).filter(function (item) {
        return item.status === "pending" || item.status === "failed" || item.status === "syncing";
      });
      for (let index = 0; index < ordered.length; index += 1) {
        const current = ordered[index];
        queue = markQueueItem(queue, current.id, { status: "syncing", attempts: current.attempts + 1, updatedAt: new Date().toISOString(), lastError: "" });
        saveQueue(queue);
        try {
          const result = await syncQueueItem(current, transport);
          queue = markQueueItem(queue, current.id, { status: "synced", updatedAt: new Date().toISOString(), lastError: "", localOnly: false });
          applySyncResult(current, result);
          saveQueue(queue);
        } catch (error) {
          const safeError = clean(error && error.message) || "sync_failed";
          const conflict = safeError.indexOf("conflict") >= 0;
          queue = markQueueItem(queue, current.id, { status: conflict ? "conflict" : "failed", updatedAt: new Date().toISOString(), lastError: safeError });
          saveQueue(queue);
          if (!conflict) throw error;
        }
      }
      saveMeta({ lastSuccessfulSyncAt: new Date().toISOString(), lastSyncError: "" });
    } catch (error) {
      saveMeta({ lastSyncError: clean(error && error.message) || "sync_failed" });
    } finally {
      syncInProgress = false;
      refreshSyncMeta();
      renderIndicator();
    }
    return getQueue();
  }

  function markQueueItem(queue, id, patch) {
    return normalizeQueue(queue).map(function (item) {
      return item.id === id ? Object.assign({}, item, patch || {}) : item;
    });
  }

  async function syncQueueItem(item, transport) {
    const payload = Object.assign({}, item.payload || {});
    const idMap = getIdMap();
    if ((item.operation === "stock:entry" || item.operation === "stock:exit" || item.operation === "stock:adjust") && clean(payload.itemId).indexOf("tmp_product_") === 0 && !idMap[clean(payload.itemId)]) {
      throw new Error("product_dependency_pending");
    }
    if (item.operation === "product:create") return transport.createProduct(payload);
    if (item.operation === "product:update") return transport.updateProduct(Object.assign({}, payload, { remoteId: idMap[clean(payload.id)] || clean(payload.id) }));
    if (item.operation === "stock:entry") return syncMovementOnce(item, payload, transport.createEntry);
    if (item.operation === "stock:exit") return syncMovementOnce(item, payload, transport.createExit);
    if (item.operation === "stock:adjust") return syncMovementOnce(item, payload, transport.createAdjustment || transport.createEntry);
    throw new Error("unknown_operation");
  }

  async function syncMovementOnce(item, payload, handler) {
    const movementKey = clean(item.localOperationKey) || buildOperationKey(item.operation, payload);
    const syncedKeys = getSyncedMovementKeys();
    if (syncedKeys.includes(movementKey)) return { ok: true, duplicate: true };
    const result = await handler.call(null, payload);
    syncedKeys.push(movementKey);
    saveSyncedMovementKeys(syncedKeys);
    return result;
  }

  function applySyncResult(item, result) {
    const payload = item.payload || {};
    const idMap = getIdMap();
    const remoteId = clean(result && (result.remoteId || result.id || result.item && result.item.id || result.entry && result.entry.id || result.exit && result.exit.id));
    if (remoteId && clean(payload.id).indexOf("tmp_") === 0) {
      idMap[clean(payload.id)] = remoteId;
      saveIdMap(idMap);
      replaceTemporaryIdInAlmoxState(clean(payload.id), remoteId);
    }
  }

  function replaceTemporaryIdInAlmoxState(temporaryId, remoteId) {
    const state = readJson(ALMOX_STORAGE_KEY, null);
    if (!state || !temporaryId || !remoteId) return;
    let changed = false;
    (state.items || []).forEach(function (item) {
      if (clean(item.id) === temporaryId) { item.id = remoteId; changed = true; }
    });
    (state.movements || []).forEach(function (movement) {
      if (clean(movement.id) === temporaryId) { movement.id = remoteId; changed = true; }
      if (clean(movement.itemId) === temporaryId) { movement.itemId = remoteId; changed = true; }
      if (clean(movement.productId) === temporaryId) { movement.productId = remoteId; changed = true; }
    });
    if (changed) writeJson(ALMOX_STORAGE_KEY, state);
  }

  function normalizeOfflineState(previousState, nextState) {
    if (!nextState || typeof nextState !== "object") return nextState;
    const previousItems = indexById(previousState && previousState.items);
    const previousMovements = indexById(previousState && previousState.movements);
    const itemIdMap = {};
    (nextState.items || []).forEach(function (item) {
      if (!item || previousItems[clean(item.id)]) return;
      if (clean(item.id).indexOf("tmp_product_") !== 0) {
        const oldId = clean(item.id);
        item.id = createTemporaryId("product");
        itemIdMap[oldId] = item.id;
      }
      item.createdAt = clean(item.createdAt) || new Date().toISOString();
      item.updatedAt = clean(item.updatedAt) || item.createdAt;
      enqueueOperation("product:create", Object.assign({}, item), { localOperationKey: "product:create:" + item.id, companyId: getCompanyId(item) });
    });
    (nextState.items || []).forEach(function (item) {
      if (!item || !previousItems[clean(item.id)] || clean(item.id).indexOf("tmp_product_") === 0) return;
      const before = JSON.stringify(previousItems[clean(item.id)] || {});
      const after = JSON.stringify(item || {});
      if (before !== after) {
        item.updatedAt = clean(item.updatedAt) || new Date().toISOString();
        enqueueOperation("product:update", Object.assign({}, item), { localOperationKey: "product:update:" + item.id + ":" + item.updatedAt, companyId: getCompanyId(item) });
      }
    });
    (nextState.movements || []).forEach(function (movement) {
      if (!movement || previousMovements[clean(movement.id)]) return;
      const oldMovementId = clean(movement.id);
      if (clean(movement.id).indexOf("tmp_movement_") !== 0) movement.id = createTemporaryId("movement");
      if (itemIdMap[clean(movement.itemId)]) movement.itemId = itemIdMap[clean(movement.itemId)];
      if (itemIdMap[clean(movement.productId)]) movement.productId = itemIdMap[clean(movement.productId)];
      movement.createdAt = clean(movement.createdAt) || new Date().toISOString();
      const operation = movement.type === "saida" ? "stock:exit" : (movement.type === "ajuste" ? "stock:adjust" : "stock:entry");
      enqueueOperation(operation, Object.assign({}, movement), { localOperationKey: operation + ":" + (oldMovementId || movement.id), companyId: getCompanyId(movement) });
    });
    return nextState;
  }

  function indexById(items) {
    const map = {};
    (Array.isArray(items) ? items : []).forEach(function (item) {
      const id = clean(item && item.id);
      if (id) map[id] = item;
    });
    return map;
  }

  function patchLocalStorage() {
    const storage = getStorage();
    if (!storage || storagePatched) return;
    storagePatched = true;
    previousAlmoxState = readJson(ALMOX_STORAGE_KEY, { items: [], movements: [] });
    const originalSetItem = storage.setItem.bind(storage);
    storage.setItem = function (key, value) {
      if (key === ALMOX_STORAGE_KEY && core.isStockFullContext && core.isStockFullContext()) {
        try {
          const parsed = JSON.parse(String(value || "{}"));
          const normalized = normalizeOfflineState(previousAlmoxState, parsed);
          previousAlmoxState = JSON.parse(JSON.stringify(normalized));
          return originalSetItem(key, JSON.stringify(normalized));
        } catch (error) {
          return originalSetItem(key, value);
        }
      }
      return originalSetItem(key, value);
    };
  }

  function getSyncStatusLabel() {
    const meta = refreshSyncMetaSilently();
    if (syncInProgress) return "Sincronizando";
    if (meta.conflictCount > 0 || meta.failedCount > 0) return "Erro de sincronização";
    if (meta.pendingCount > 0) return "Pendente de sincronização";
    if (window.navigator && window.navigator.onLine === false) return "Offline";
    return "Online";
  }

  function refreshSyncMetaSilently() {
    const queue = normalizeQueue(readJson(QUEUE_STORAGE_KEY, []));
    return {
      pendingCount: queue.filter(function (item) { return item.status === "pending" || item.status === "syncing"; }).length,
      failedCount: queue.filter(function (item) { return item.status === "failed"; }).length,
      conflictCount: queue.filter(function (item) { return item.status === "conflict"; }).length
    };
  }

  function normalizeSyncStatus(status) {
    if (typeof status === "string") return status.toLowerCase();
    if (status && typeof status.status === "string") return status.status.toLowerCase();
    if (status && typeof status.state === "string") return status.state.toLowerCase();
    return "";
  }

  function ensureIndicator() {
    if (!core.isStockFullContext || !core.isStockFullContext()) return null;
    let panel = window.document.getElementById("stockFullSyncPanel");
    if (panel) return panel;
    const target = window.document.getElementById("stockFullDashboard") || window.document.querySelector(".stock-full-app__shell");
    if (!target) return null;
    panel = window.document.createElement("section");
    panel.id = "stockFullSyncPanel";
    panel.className = "stock-full-sync-panel";
    panel.innerHTML = '<div><strong id="stockFullSyncStatus">Online</strong><span id="stockFullSyncDetails">0 pendências</span></div><button type="button" class="mini-button" id="stockFullSyncNowButton">Sincronizar agora</button>';
    const commandStrip = window.document.querySelector(".stock-full-command-strip");
    if (commandStrip && commandStrip.parentNode) commandStrip.parentNode.insertBefore(panel, commandStrip.nextSibling);
    else target.insertBefore(panel, target.firstChild);
    const button = window.document.getElementById("stockFullSyncNowButton");
    if (button) button.addEventListener("click", function () { processQueue(); });
    return panel;
  }

  function renderIndicator(forcedStatus) {
    const panel = ensureIndicator();
    if (!panel) return;
    const forcedStatusLabel = typeof forcedStatus === "string" ? forcedStatus : (forcedStatus && typeof forcedStatus.status === "string" ? forcedStatus.status : (forcedStatus && typeof forcedStatus.state === "string" ? forcedStatus.state : ""));
    const status = forcedStatusLabel || getSyncStatusLabel();
    const meta = Object.assign({}, getMeta(), refreshSyncMetaSilently());
    const statusNode = window.document.getElementById("stockFullSyncStatus");
    const detailsNode = window.document.getElementById("stockFullSyncDetails");
    const button = window.document.getElementById("stockFullSyncNowButton");
    if (statusNode) statusNode.textContent = status;
    if (detailsNode) {
      const lastSync = clean(meta.lastSuccessfulSyncAt) || "nunca";
      detailsNode.textContent = meta.pendingCount + " pendência(s) · última sync: " + lastSync + (meta.lastSyncError ? " · erro: " + meta.lastSyncError : "");
    }
    if (button) button.disabled = syncInProgress;
    const normalizedStatus = normalizeSyncStatus(status) || "unknown";
    panel.dataset.syncStatus = normalizedStatus.replace(/\s+/g, "-");
  }

  function scheduleAutoSync() {
    if (autoSyncTimer) window.clearTimeout(autoSyncTimer);
    autoSyncTimer = window.setTimeout(function () {
      if (window.navigator && window.navigator.onLine === false) {
        renderIndicator();
        return;
      }
      processQueue();
    }, 250);
  }

  function init() {
    if (initialized) return;
    initialized = true;
    patchLocalStorage();
    refreshSyncMeta();
    renderIndicator();
    window.addEventListener("online", scheduleAutoSync);
    window.addEventListener("offline", renderIndicator);
    window.setTimeout(function () {
      renderIndicator();
      scheduleAutoSync();
    }, 500);
  }

  if (window.document && window.document.readyState === "loading") {
    window.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.StockFullSync = {
    isSupabaseConfigured,
    getFallbackStatus,
    mapRemoteMovement,
    createTemporaryId,
    configure,
    init,
    enqueue: enqueueOperation,
    processQueue,
    getQueue,
    saveQueue,
    getMeta,
    refreshSyncMeta,
    getIdMap,
    saveIdMap,
    getSyncStatusLabel,
    renderIndicator,
    storageKeys: {
      queue: QUEUE_STORAGE_KEY,
      meta: META_STORAGE_KEY,
      idMap: ID_MAP_STORAGE_KEY,
      syncedMovements: SYNCED_MOVEMENTS_STORAGE_KEY
    }
  };
})(window);

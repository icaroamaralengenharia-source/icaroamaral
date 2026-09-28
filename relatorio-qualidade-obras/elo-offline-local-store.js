(function attachEloOfflineLocalStore(global) {
  "use strict";

  const PREFIX = "elo_offline_store_v1:";

  function clean(value) {
    return String(value == null ? "" : value).replace(/[\u0000-\u001f<>]/g, "").trim();
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function read(storage, key) {
    try { return storage && storage.getItem ? storage.getItem(key) : null; } catch (_) { return null; }
  }

  function write(storage, key, value) {
    try { if (storage && storage.setItem) storage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }

  function scopeFor(identity) {
    const userId = clean(identity && (identity.userId || identity.user_id || identity.email));
    const tenantId = clean(identity && (identity.tenantId || identity.tenant_id || identity.institutionId || identity.institution_id));
    if (!userId || !tenantId) return "";
    return userId + "|" + tenantId;
  }

  function emptyState(scope) {
    return {
      schema: 1,
      scope,
      updatedAt: new Date().toISOString(),
      currentWork: null,
      currentUnit: null,
      rdo: [],
      stock: { items: [], lastSyncedAt: null, operations: [] },
      vistoria: [],
      documents: [],
      attachments: [],
      memory: [],
      outbox: []
    };
  }

  function create(options) {
    const config = options || {};
    const storage = config.storage || global.localStorage;
    const identity = config.identity || {};
    const scope = scopeFor(identity);
    const key = scope ? PREFIX + encodeURIComponent(scope) : "";
    let state = scope ? (function () {
      const parsed = JSON.parse(read(storage, key) || "null");
      return parsed && parsed.scope === scope ? parsed : emptyState(scope);
    })() : emptyState("");

    if (scope && config.seed) {
      state = Object.assign(emptyState(scope), clone(config.seed), { scope });
      write(storage, key, state);
    }

    function authorized() { return !!scope && state.scope === scope; }
    function persist() { state.updatedAt = new Date().toISOString(); if (key) write(storage, key, state); }
    function readCollection(name) { return authorized() ? clone(state[name]) : []; }

    function draft(collection, payload, kind) {
      if (!authorized()) return { ok: false, reason: "AUTH_REQUIRED" };
      const record = Object.assign({}, clone(payload || {}), {
        id: clean(payload && payload.id) || "offline-" + Date.now().toString(36),
        scope,
        status: "LOCAL_DRAFT",
        syncStatus: "PENDING_SYNC",
        kind: kind || collection,
        updatedAt: new Date().toISOString()
      });
      if (!Array.isArray(state[collection])) state[collection] = [];
      const index = state[collection].findIndex(function (item) { return item.id === record.id; });
      if (index >= 0) state[collection][index] = record; else state[collection].push(record);
      state.outbox.push({ id: record.id, type: record.kind, scope, status: "PENDING_SYNC" });
      persist();
      return { ok: true, localOnly: true, syncStatus: "PENDING_SYNC", record: clone(record) };
    }

    return {
      scope,
      authorized,
      getState: function () { return authorized() ? clone(state) : null; },
      setCurrentWork: function (work) { if (!authorized()) return false; state.currentWork = clone(work); persist(); return true; },
      setCurrentUnit: function (unit) { if (!authorized()) return false; state.currentUnit = clone(unit); persist(); return true; },
      listRdo: function () { return readCollection("rdo"); },
      listVistoria: function () { return readCollection("vistoria"); },
      listDocuments: function () { return readCollection("documents"); },
      listAttachments: function () { return readCollection("attachments"); },
      stockSnapshot: function () { return authorized() ? clone(state.stock) : null; },
      listMemory: function () { return readCollection("memory"); },
      draftRdo: function (payload) { return draft("rdo", payload, "RDO_DRAFT"); },
      draftStock: function (payload) { return draft("stock", payload, "STOCK_DRAFT"); },
      draftVistoria: function (payload) { return draft("vistoria", payload, "VISTORIA_DRAFT"); },
      markPendingSync: function (id) {
        if (!authorized()) return { ok: false, reason: "AUTH_REQUIRED" };
        const found = state.outbox.find(function (item) { return item.id === id; });
        if (!found) return { ok: false, reason: "NOT_FOUND" };
        found.status = "PENDING_SYNC"; persist(); return { ok: true, syncStatus: "PENDING_SYNC" };
      },
      outbox: function () { return authorized() ? clone(state.outbox) : []; },
      switchIdentity: function (nextIdentity) { return scopeFor(nextIdentity) === scope; }
    };
  }

  global.EloOfflineLocalStore = { PREFIX, scopeFor, create };
})(typeof window !== "undefined" ? window : globalThis);

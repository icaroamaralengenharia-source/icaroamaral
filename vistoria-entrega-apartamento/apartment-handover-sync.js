(function (root, factory) {
  const sync = factory(root);
  if (typeof module === "object" && module.exports) module.exports = sync;
  root.ApartmentHandoverInspectionSync = sync;
})(typeof globalThis !== "undefined" ? globalThis : window, function (root) {
  const SYNC_KEY = "sync";
  const CONTEXT_KEY = "obrareport-apartment-handover-sync-context-v1";
  const STATUSES = new Set(["local_only", "dirty", "syncing", "synced", "error", "conflict"]);

  function clean(value) {
    return String(value || "").trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value === undefined ? null : value));
  }

  function normalizeApiBaseUrl(value) {
    return clean(value).replace(/\/$/, "");
  }

  function getInspection(state) {
    if (!state || typeof state !== "object") return {};
    state.inspection = state.inspection && typeof state.inspection === "object" ? state.inspection : {};
    return state.inspection;
  }

  function ensureSyncMetadata(state) {
    const inspection = getInspection(state);
    const current = inspection[SYNC_KEY] && typeof inspection[SYNC_KEY] === "object" ? inspection[SYNC_KEY] : {};
    const status = STATUSES.has(clean(current.syncStatus)) ? clean(current.syncStatus) : "local_only";
    inspection[SYNC_KEY] = {
      backendInspectionId: clean(current.backendInspectionId) || null,
      syncStatus: status,
      lastSyncedAt: clean(current.lastSyncedAt) || null,
      lastSyncError: clean(current.lastSyncError) || "",
      syncRevision: Number.isFinite(Number(current.syncRevision)) ? Number(current.syncRevision) : 0,
      backendUpdatedAt: clean(current.backendUpdatedAt) || null
    };
    return inspection[SYNC_KEY];
  }

  function getSyncMetadata(state) {
    return clone(ensureSyncMetadata(state));
  }

  function markDirty(state, reason) {
    const sync = ensureSyncMetadata(state);
    if (sync.syncStatus !== "syncing") sync.syncStatus = sync.backendInspectionId ? "dirty" : "local_only";
    sync.lastSyncError = clean(reason || sync.lastSyncError);
    sync.syncRevision += 1;
    return sync;
  }

  function setSyncError(state, error, status) {
    const sync = ensureSyncMetadata(state);
    sync.syncStatus = status || "error";
    sync.lastSyncError = clean(error && (error.message || error.error || error.code) || error || "sync_failed");
    return sync;
  }

  function hasCorporateContext(context) {
    const safe = context || {};
    return Boolean(clean(safe.institutionId || safe.institution_id) && clean(safe.clientId || safe.client_id) && clean(safe.projectId || safe.project_id) && clean(safe.createdBy || safe.created_by || safe.userId || safe.user_id));
  }

  function normalizeContext(context) {
    const safe = context || {};
    return {
      institutionId: clean(safe.institutionId || safe.institution_id),
      clientId: clean(safe.clientId || safe.client_id),
      projectId: clean(safe.projectId || safe.project_id),
      createdBy: clean(safe.createdBy || safe.created_by || safe.userId || safe.user_id)
    };
  }

  function resolveCorporateContext(storage) {
    if (root.OBRAREPORT_APARTMENT_HANDOVER_CONTEXT && typeof root.OBRAREPORT_APARTMENT_HANDOVER_CONTEXT === "object") {
      return normalizeContext(root.OBRAREPORT_APARTMENT_HANDOVER_CONTEXT);
    }
    const localStorageRef = storage || root.localStorage;
    if (!localStorageRef || typeof localStorageRef.getItem !== "function") return normalizeContext({});
    try {
      return normalizeContext(JSON.parse(localStorageRef.getItem(CONTEXT_KEY) || "{}"));
    } catch (_) {
      return normalizeContext({});
    }
  }

  function isOnline(navigatorRef) {
    const nav = navigatorRef || root.navigator;
    return !nav || nav.onLine !== false;
  }

  function buildHeaders(context) {
    return {
      "Content-Type": "application/json",
      "x-institution-id": context.institutionId,
      "x-user-id": context.createdBy
    };
  }

  async function parseJsonResponse(response) {
    try {
      return await response.json();
    } catch (_) {
      return {};
    }
  }

  function remoteIsNewer(state, remote) {
    const sync = ensureSyncMetadata(state);
    const remoteUpdatedAt = clean(remote && remote.updated_at);
    if (!remoteUpdatedAt || !sync.backendUpdatedAt) return false;
    return new Date(remoteUpdatedAt).getTime() > new Date(sync.backendUpdatedAt).getTime();
  }

  async function fetchRemoteInspection(client, state, context, backendInspectionId) {
    const response = await client.fetchImpl(client.apiBaseUrl + "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(backendInspectionId), {
      method: "GET",
      headers: buildHeaders(context)
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      const error = new Error(data.error || "remote_inspection_get_failed");
      error.status = response.status;
      throw error;
    }
    return data.inspection;
  }

  async function syncNow(client, state, contextInput) {
    const sync = ensureSyncMetadata(state);
    const context = normalizeContext(contextInput || client.getContext());
    if (!hasCorporateContext(context)) {
      sync.syncStatus = sync.backendInspectionId ? "dirty" : "local_only";
      sync.lastSyncError = "corporate_context_required";
      return { ok: false, skipped: true, reason: "corporate_context_required", sync: getSyncMetadata(state) };
    }
    if (!isOnline(client.navigatorRef)) {
      sync.syncStatus = sync.backendInspectionId ? "dirty" : "local_only";
      sync.lastSyncError = "offline";
      return { ok: false, skipped: true, reason: "offline", sync: getSyncMetadata(state) };
    }
    if (!client.apiBaseUrl) {
      return { ok: false, skipped: true, reason: "api_base_url_required", sync: getSyncMetadata(state) };
    }

    const adapter = client.adapter;
    if (!adapter || typeof adapter.toTransactionalPayload !== "function") {
      setSyncError(state, "adapter_unavailable");
      return { ok: false, error: "adapter_unavailable", sync: getSyncMetadata(state) };
    }

    const beforeStatus = sync.syncStatus;
    sync.syncStatus = "syncing";
    sync.lastSyncError = "";
    client.persistState(state);

    try {
      const backendInspectionId = sync.backendInspectionId;
      if (backendInspectionId && client.protectRemoteNewer) {
        const remote = await fetchRemoteInspection(client, state, context, backendInspectionId);
        if (remoteIsNewer(state, remote)) {
          setSyncError(state, "remote_newer_than_local", "conflict");
          client.persistState(state);
          return { ok: false, conflict: true, reason: "remote_newer_than_local", remote, sync: getSyncMetadata(state) };
        }
      }

      const payload = adapter.toTransactionalPayload(state, context);
      const method = backendInspectionId ? "PUT" : "POST";
      const url = backendInspectionId
        ? client.apiBaseUrl + "/api/obrareport/apartment-handover-inspections/" + encodeURIComponent(backendInspectionId)
        : client.apiBaseUrl + "/api/obrareport/apartment-handover-inspections";
      const response = await client.fetchImpl(url, {
        method,
        headers: buildHeaders(context),
        body: JSON.stringify(payload)
      });
      const data = await parseJsonResponse(response);
      if (!response.ok) {
        const error = new Error(data.error || "sync_request_failed");
        error.status = response.status;
        throw error;
      }
      const remoteInspection = data.inspection;
      sync.backendInspectionId = remoteInspection.id;
      sync.syncStatus = "synced";
      sync.lastSyncedAt = new Date().toISOString();
      sync.lastSyncError = "";
      sync.backendUpdatedAt = clean(remoteInspection.updated_at) || sync.lastSyncedAt;
      client.persistState(state);
      return { ok: true, action: method === "POST" ? "create" : "update", inspection: remoteInspection, previousStatus: beforeStatus, sync: getSyncMetadata(state) };
    } catch (error) {
      setSyncError(state, error, error && error.status ? "error" : "dirty");
      client.persistState(state);
      return { ok: false, error: clean(error && error.message) || "sync_failed", status: error && error.status, sync: getSyncMetadata(state) };
    }
  }

  function hydrateFromRemoteInspection(remoteInspection, options) {
    const safe = remoteInspection && typeof remoteInspection === "object" ? remoteInspection : {};
    const state = clone(safe.inspection_data_json || {});
    if (!state || typeof state !== "object") return null;
    const normalized = state.inspection ? state : { id: safe.source_id || safe.id, type: "apartment_handover_inspection", inspection: state };
    const sync = ensureSyncMetadata(normalized);
    sync.backendInspectionId = clean(safe.id) || sync.backendInspectionId;
    sync.syncStatus = "synced";
    sync.lastSyncedAt = new Date().toISOString();
    sync.lastSyncError = "";
    sync.backendUpdatedAt = clean(safe.updated_at) || sync.lastSyncedAt;
    if (safe.reinspection_of_id) normalized.inspection.reinspection_of_id = safe.reinspection_of_id;
    if (options && options.markDirty) markDirty(normalized, "hydrated_for_editing");
    return normalized;
  }

  function maybeHydrateRemote(currentState, remoteInspection, options) {
    if (currentState && options && options.overwrite !== true) {
      return { applied: false, reason: "local_state_preserved", state: currentState };
    }
    return { applied: true, state: hydrateFromRemoteInspection(remoteInspection, options) };
  }

  function createController(options) {
    const client = {
      apiBaseUrl: normalizeApiBaseUrl(options && options.apiBaseUrl),
      adapter: options && options.adapter || root.ApartmentHandoverDocumentAdapter,
      fetchImpl: options && options.fetchImpl || root.fetch,
      navigatorRef: options && options.navigatorRef || root.navigator,
      protectRemoteNewer: options && options.protectRemoteNewer !== false,
      getContext: options && options.getContext || function () { return resolveCorporateContext(options && options.storage); },
      persistState: options && options.persistState || function () {},
      debounceMs: Number(options && options.debounceMs) || 1500
    };
    let timer = null;
    let running = false;

    async function run(reason) {
      if (running) return { ok: false, skipped: true, reason: "sync_already_running" };
      running = true;
      try {
        const state = options.getState();
        return await syncNow(client, state, client.getContext(), reason);
      } finally {
        running = false;
      }
    }

    function queueSync(reason) {
      const state = options.getState();
      markDirty(state, reason || "local_change");
      client.persistState(state);
      clearTimeout(timer);
      timer = setTimeout(() => { run(reason).catch(() => {}); }, client.debounceMs);
      return getSyncMetadata(state);
    }

    function retryPending(reason) {
      const state = options.getState();
      const sync = ensureSyncMetadata(state);
      if (["dirty", "local_only", "error"].includes(sync.syncStatus)) return run(reason || "retry_pending");
      return Promise.resolve({ ok: false, skipped: true, reason: "nothing_pending", sync: getSyncMetadata(state) });
    }

    if (root.addEventListener) {
      root.addEventListener("online", () => { retryPending("online").catch(() => {}); });
    }

    return { queueSync, retryPending, syncNow: run, getSyncMetadata: () => getSyncMetadata(options.getState()) };
  }

  return {
    CONTEXT_KEY,
    ensureSyncMetadata,
    getSyncMetadata,
    markDirty,
    hasCorporateContext,
    resolveCorporateContext,
    syncNow,
    hydrateFromRemoteInspection,
    maybeHydrateRemote,
    createController
  };
});
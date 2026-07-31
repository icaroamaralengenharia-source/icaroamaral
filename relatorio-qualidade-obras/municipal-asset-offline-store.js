(function initMunicipalAssetOfflineStore(global) {
  const CACHE_PREFIX = "municipal_asset_cache_v1:";
  const INDEX_PREFIX = "municipal_asset_index_v1:";
  const STALE_MS = 24 * 60 * 60 * 1000;

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function lower(value) {
    return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function scopeKey(scope) {
    const institutionId = clean(scope && scope.institution_id || scope && scope.institutionId);
    const unitId = clean(scope && scope.unit_id || scope && scope.unitId);
    const userId = clean(scope && scope.user_id || scope && scope.userId);
    if (!institutionId || !unitId || !userId) throw new Error("offline_scope_required");
    return `${institutionId}:${unitId}:${userId}`;
  }

  function safeJsonParse(value, fallback) {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function sanitizeAsset(asset) {
    const copy = Object.assign({}, asset || {});
    delete copy.token;
    delete copy.authorization;
    delete copy.password;
    delete copy.storage_path;
    delete copy.project_id;
    return copy;
  }

  function buildIndex(assets) {
    const index = {};
    for (const asset of assets) {
      const haystack = [asset.asset_tag, asset.name, asset.category, asset.unit_id, asset.responsible_user_id, asset.location].map(lower).join(" ");
      index[asset.id] = haystack;
    }
    return index;
  }

  function create(options = {}) {
    const storage = options.storage || global.localStorage;
    const fetchImpl = options.fetch || global.fetch && global.fetch.bind(global);
    const now = options.now || (() => new Date());
    const apiBase = clean(options.apiBase || global.OBRAREPORT_API_BASE_URL || "");
    const pageSize = Number(options.pageSize || 100);

    function cacheKey(scope) {
      return CACHE_PREFIX + scopeKey(scope);
    }

    function indexKey(scope) {
      return INDEX_PREFIX + scopeKey(scope);
    }

    function read(scope) {
      return safeJsonParse(storage.getItem(cacheKey(scope)), {
        scope: {},
        assets: [],
        history: [],
        last_synced_at: "",
        sync_cursor: "",
        online: false
      });
    }

    function write(scope, cache) {
      const scoped = {
        scope: {
          institution_id: clean(scope.institution_id || scope.institutionId),
          unit_id: clean(scope.unit_id || scope.unitId),
          user_id: clean(scope.user_id || scope.userId)
        },
        assets: (cache.assets || []).map(sanitizeAsset),
        history: (cache.history || []).map(sanitizeAsset),
        last_synced_at: clean(cache.last_synced_at),
        sync_cursor: clean(cache.sync_cursor),
        online: Boolean(cache.online)
      };
      storage.setItem(cacheKey(scope), JSON.stringify(scoped));
      storage.setItem(indexKey(scope), JSON.stringify(buildIndex(scoped.assets)));
      return scoped;
    }

    function assertAssetScope(scope, asset) {
      const institutionId = clean(scope.institution_id || scope.institutionId);
      const unitId = clean(scope.unit_id || scope.unitId);
      return clean(asset.institution_id) === institutionId && clean(asset.unit_id) === unitId;
    }

    async function sync(scope, options = {}) {
      if (!fetchImpl) throw new Error("fetch_not_available");
      const current = read(scope);
      const token = clean(options.token || global.MUNICIPAL_ADMIN_AUTH_TOKEN);
      const updatedSince = clean(options.updated_since || options.updatedSince || current.sync_cursor || current.last_synced_at);
      const url = new URL(apiBase + "/api/municipal-admin/assets");
      url.searchParams.set("unit_id", clean(scope.unit_id || scope.unitId));
      url.searchParams.set("limit", String(options.pageSize || pageSize));
      if (updatedSince) url.searchParams.set("updated_since", updatedSince);
      if (current.sync_cursor) url.searchParams.set("sync_cursor", current.sync_cursor);
      try {
        const response = await fetchImpl(url.toString(), { headers: token ? { Authorization: "Bearer " + token } : {} });
        if (!response.ok) throw new Error("asset_sync_failed");
        const data = await response.json();
        const incoming = (data.assets || []).map(sanitizeAsset).filter((asset) => assertAssetScope(scope, asset));
        const byId = new Map(current.assets.map((asset) => [asset.id, asset]));
        for (const asset of incoming) {
          const previous = byId.get(asset.id);
          if (!previous || new Date(asset.updated_at || 0).getTime() >= new Date(previous.updated_at || 0).getTime()) byId.set(asset.id, asset);
        }
        const assetIds = new Set(Array.from(byId.keys()));
        const history = (data.history || current.history || []).map(sanitizeAsset).filter((item) => assetIds.has(clean(item.asset_id)) && clean(item.institution_id) === clean(scope.institution_id || scope.institutionId) && clean(item.unit_id) === clean(scope.unit_id || scope.unitId));
        return write(scope, {
          assets: Array.from(byId.values()),
          history,
          last_synced_at: now().toISOString(),
          sync_cursor: clean(data.sync_cursor || data.next_cursor || now().toISOString()),
          online: true
        });
      } catch (error) {
        const preserved = Object.assign({}, current, { online: false, sync_error: clean(error && error.message) || "asset_sync_failed" });
        write(scope, preserved);
        return preserved;
      }
    }

    function search(scope, query = {}) {
      const cache = read(scope);
      const index = safeJsonParse(storage.getItem(indexKey(scope)), {});
      const term = lower(query.q || query.query || query.asset_tag || query.assetTag || query.name || query.category || query.responsible_user_id || query.responsibleUserId || "");
      return cache.assets.filter((asset) => {
        if (!assertAssetScope(scope, asset)) return false;
        if (query.unit_id && clean(asset.unit_id) !== clean(query.unit_id)) return false;
        if (query.condition && lower(asset.condition) !== lower(query.condition)) return false;
        if (query.status && lower(asset.status) !== lower(query.status)) return false;
        return !term || lower(index[asset.id]).includes(term);
      });
    }

    function getAsset(scope, assetId) {
      return search(scope).find((asset) => clean(asset.id) === clean(assetId)) || null;
    }

    function getHistory(scope, assetId) {
      const cache = read(scope);
      const asset = getAsset(scope, assetId);
      if (!asset) return [];
      return cache.history.filter((item) => clean(item.asset_id) === clean(assetId));
    }

    function status(scope, online = global.navigator ? global.navigator.onLine : true) {
      const cache = read(scope);
      if (!cache.last_synced_at) return "offline";
      if (!online) return "offline";
      const age = now().getTime() - new Date(cache.last_synced_at).getTime();
      return age > STALE_MS ? "dados_desatualizados" : "online";
    }

    function renderStatusIndicator(scope, target, online) {
      const state = status(scope, online);
      if (target) target.textContent = state;
      return state;
    }

    function invalidate(scope) {
      storage.removeItem(cacheKey(scope));
      storage.removeItem(indexKey(scope));
    }

    function invalidateUser(userId) {
      const suffix = ":" + clean(userId);
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if ((key.startsWith(CACHE_PREFIX) || key.startsWith(INDEX_PREFIX)) && key.endsWith(suffix)) storage.removeItem(key);
      }
    }

    function assertReadOnlyOffline() {
      throw new Error("asset_offline_write_forbidden");
    }

    function answerEloOffline(scope, question) {
      const cache = read(scope);
      const text = lower(question);
      let rows = search(scope);
      if (/tombamento/.test(text)) {
        const match = text.match(/tombamento\s+([a-z0-9._-]+)/i);
        if (match) rows = search(scope, { q: match[1] });
      } else if (/ruim/.test(text)) {
        rows = search(scope, { condition: "ruim" });
      } else if (/manutencao/.test(text)) {
        rows = search(scope, { status: "em_manutencao" });
      } else if (/sem responsavel/.test(text)) {
        rows = rows.filter((asset) => !clean(asset.responsible_user_id));
      }
      const prefix = `Resposta baseada nos dados disponíveis offline, sincronizados em ${cache.last_synced_at || "data desconhecida"}.`;
      const body = rows.length ? rows.slice(0, 8).map((asset) => `${asset.asset_tag} - ${asset.name} (${asset.condition}, ${asset.location || "sem local"})`).join("; ") : "Nao encontrei dados locais sincronizados para essa consulta.";
      return `${prefix}\n${body}\nAo voltar online, atualize a consulta para conferir dados mais recentes.`;
    }

    return {
      sync,
      search,
      getAsset,
      getHistory,
      status,
      renderStatusIndicator,
      invalidate,
      invalidateUser,
      transferOffline: assertReadOnlyOffline,
      maintenanceOffline: assertReadOnlyOffline,
      deactivateOffline: assertReadOnlyOffline,
      answerEloOffline,
      read
    };
  }

  global.MunicipalAssetOfflineStore = { create };
})(typeof window !== "undefined" ? window : globalThis);

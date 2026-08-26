(function () {
  "use strict";

  const MEDIA_SEARCH_PATH = "/api/elo/media/search";
  const MEDIA_SEARCH_TIMEOUT_MS = 9000;
  const CATALOG_CACHE_STORAGE_KEY = "elo_music_catalog_cache_v1";
  const HISTORICAL_REJECTED_MEDIA = [
    {
      id: "youtube:h0ffIJ7ZO4U",
      title: "Sultans of Swing",
      artist: "Dire Straits",
      videoId: "h0ffIJ7ZO4U",
      source: "youtube",
      playable: false,
      embeddable: false,
      rejectionReason: "user_reported_embed_unavailable"
    },
    {
      id: "youtube:8Pa9x9fZBtY",
      title: "Sultans Of Swing (Alchemy Live)",
      artist: "Dire Straits",
      videoId: "8Pa9x9fZBtY",
      source: "youtube",
      playable: false,
      embeddable: false,
      rejectionReason: "user_reported_embed_unavailable"
    }
  ];

  function log(name, payload) {
    try {
      if (window.console && typeof window.console.info === "function") window.console.info(name, payload || {});
    } catch (error) {}
  }

  function clean(value) {
    return String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim();
  }

  function normalize(value) {
    if (window.EloMusicCatalog && typeof window.EloMusicCatalog.normalize === "function") {
      return window.EloMusicCatalog.normalize(value);
    }
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(?:elo|toque|toca|tocar|coloque|coloca|colocar|poe|ponha|bota|botar|reproduza|reproduzir|play|musica|som|uma|um|a|o)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function readCatalogCache() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CATALOG_CACHE_STORAGE_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeCatalogCache(cache) {
    try {
      window.localStorage.setItem(CATALOG_CACHE_STORAGE_KEY, JSON.stringify(cache || {}));
    } catch (error) {}
  }

  function isPlayableCatalogMedia(media) {
    return !!(media && media.validationStatus === "ACTIVE" && media.videoId && media.playable === true && media.embeddable === true);
  }

  function isOnline() {
    if (!window.navigator || typeof window.navigator.onLine !== "boolean") return true;
    return window.navigator.onLine !== false;
  }

  function getCatalogMatch(query) {
    const catalog = window.EloMusicCatalog || window.ELO_MUSIC_CATALOG || null;
    if (!catalog) return null;
    let item = null;
    if (typeof catalog.find === "function") item = catalog.find(query);
    if (!item && Array.isArray(catalog.items)) {
      const normalizedQuery = normalize(query);
      item = catalog.items.find(function (candidate) {
        const labels = [candidate.normalizedTitle, candidate.normalizedLabel, candidate.artist + " " + candidate.title].concat(candidate.aliases || []);
        return labels.map(normalize).some(function (label) { return label === normalizedQuery; });
      }) || null;
    }
    if (!item || !item.id) return null;
    const cache = readCatalogCache();
    const cached = cache[item.id];
    if (item.validationStatus === "ACTIVE" && cached && isPlayableCatalogMedia(Object.assign({}, item, cached))) {
      return Object.assign({}, item, cached, {
        id: cached.id || item.id,
        catalogId: item.id,
        source: cached.source || "catalog-cache",
        validationStatus: item.validationStatus,
        searchQuery: item.searchQuery || (item.artist + " " + item.title)
      });
    }
    return Object.assign({}, item, { catalogId: item.id, source: item.source || "elo-music-catalog" });
  }

  function rememberCatalogResolution(catalogItem, resolved) {
    if (!catalogItem || !catalogItem.catalogId || !isPlayableCatalogMedia(resolved)) return;
    const cache = readCatalogCache();
    cache[catalogItem.catalogId] = {
      id: resolved.id || "youtube:" + resolved.videoId,
      title: catalogItem.title || resolved.title,
      artist: catalogItem.artist || resolved.artist,
      resolvedTitle: resolved.title,
      channel: resolved.channel || resolved.artist || "",
      videoId: resolved.videoId,
      playable: true,
      embeddable: true,
      validationStatus: "ACTIVE",
      source: resolved.source || "youtube-data-api",
      lastValidatedAt: new Date().toISOString()
    };
    writeCatalogCache(cache);
    log("MEDIA_CATALOG_CACHE_WRITE", { catalogId: catalogItem.catalogId, videoId: resolved.videoId, title: resolved.title });
  }

  function invalidateCatalogResolution(media, reason) {
    const catalogId = media && (media.catalogId || media.id);
    if (!catalogId) return;
    const cache = readCatalogCache();
    if (!cache[catalogId]) return;
    cache[catalogId].playable = false;
    cache[catalogId].embeddable = false;
    cache[catalogId].invalidatedAt = new Date().toISOString();
    cache[catalogId].invalidationReason = clean(reason) || "MEDIA_ERROR";
    writeCatalogCache(cache);
    log("MEDIA_CATALOG_CACHE_INVALIDATED", { catalogId: catalogId, reason: cache[catalogId].invalidationReason });
  }

  function getApiBaseUrl() {
    return String(window.ELO_MEDIA_API_BASE_URL || window.ELO_API_BASE_URL || window.OBRAREPORT_API_BASE_URL || "").replace(/\/+$/g, "");
  }

  function buildMediaSearchUrl(query) {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return "";
    return baseUrl + MEDIA_SEARCH_PATH + "?q=" + encodeURIComponent(query);
  }

  function getVideoId(candidate) {
    const raw = clean(candidate && (candidate.videoId || candidate.video_id || candidate.youtubeId || candidate.youtube_id || candidate.id));
    const match = raw.match(/(?:youtube:)?([a-zA-Z0-9_-]{6,20})$/);
    return match ? match[1] : "";
  }

  function getCandidateLabel(candidate) {
    return clean(candidate && (candidate.title || candidate.name || candidate.track || candidate.label || ""));
  }

  function getCandidateArtist(candidate) {
    return clean(candidate && (candidate.artist || candidate.author || candidate.channel || candidate.channelTitle || candidate.creator || ""));
  }

  function normalizeCandidate(candidate, index) {
    const videoId = getVideoId(candidate);
    const title = getCandidateLabel(candidate);
    if (!videoId || !title) return null;
    const playable = candidate.playable === true;
    const embeddable = candidate.embeddable === true;
    const normalized = {
      id: candidate.id || "youtube:" + videoId,
      title: title,
      artist: getCandidateArtist(candidate),
      channel: clean(candidate.channel || candidate.channelTitle || candidate.author || ""),
      videoId: videoId,
      source: clean(candidate.source || candidate.provider || "youtube"),
      relevance: typeof candidate.relevance === "number" ? candidate.relevance : (typeof candidate.score === "number" ? candidate.score : Math.max(0.4, 1 - index * 0.04)),
      playable: playable,
      embeddable: embeddable,
      official: candidate.official === true,
      url: candidate.url || "https://www.youtube.com/watch?v=" + videoId
    };
    log("MEDIA_CANDIDATE", {
      index: index + 1,
      title: normalized.title,
      artist: normalized.artist,
      channel: normalized.channel,
      videoId: normalized.videoId,
      source: normalized.source,
      playable: normalized.playable,
      embeddable: normalized.embeddable
    });
    log("MEDIA_EMBED_CHECK", {
      videoId: normalized.videoId,
      method: "provider_status_embeddable",
      playable: normalized.playable,
      embeddable: normalized.embeddable
    });
    if (!playable || !embeddable) {
      log("MEDIA_CANDIDATE_REJECTED", {
        index: index + 1,
        videoId: normalized.videoId,
        title: normalized.title,
        reason: !embeddable ? "not_embeddable" : "not_playable"
      });
      return null;
    }
    return normalized;
  }

  function collectRawCandidates(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.candidates)) return data.candidates;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.videos)) return data.videos;
    if (data.videoId || data.video_id || data.youtubeId) return [data];
    return [];
  }

  function normalizeProviderResult(data, query, requestUrl, httpStatus, catalogItem) {
    const rawCandidates = collectRawCandidates(data);
    const playableCandidates = rawCandidates.map(normalizeCandidate).filter(Boolean);
    if (!playableCandidates.length) {
      log("MEDIA_RESOLVE_RESULT", {
        found: false,
        reason: data && data.error || "NO_EMBEDDABLE_RESULTS",
        provider: data && data.provider,
        httpStatus: httpStatus,
        candidateCount: rawCandidates.length
      });
      return {
        found: false,
        source: data && data.provider || "youtube-data-api",
        providerStatus: data && data.error === "media_search_provider_not_configured" ? "PROVIDER_UNAVAILABLE" : "NO_EMBEDDABLE_RESULTS",
        candidates: [],
        catalogMatch: catalogItem || null
      };
    }
    const best = Object.assign({}, playableCandidates[0], {
      found: true,
      query: query,
      catalogId: catalogItem && catalogItem.catalogId || null,
      providerStatus: "OK",
      requestUrl: requestUrl,
      httpStatus: httpStatus,
      fallbackCandidates: playableCandidates.slice(1)
    });
    rememberCatalogResolution(catalogItem, best);
    log("MEDIA_RESOLVE_RESULT", {
      found: true,
      provider: data && data.provider || best.source,
      httpStatus: httpStatus,
      title: best.title,
      artist: best.artist,
      videoId: best.videoId,
      playable: best.playable,
      embeddable: best.embeddable,
      fallbackCount: best.fallbackCandidates.length
    });
    log("MEDIA_VIDEO_ID", { videoId: best.videoId, title: best.title, source: best.source });
    return best;
  }

  function rejectHistoricalCandidates(query) {
    const normalizedQuery = normalize(query);
    HISTORICAL_REJECTED_MEDIA.forEach(function (item) {
      const labels = [item.title, item.artist + " " + item.title];
      if (!labels.some(function (label) { return normalize(label) === normalizedQuery; })) return;
      log("MEDIA_CANDIDATE_REJECTED", {
        videoId: item.videoId,
        title: item.title,
        reason: item.rejectionReason || "not_embeddable"
      });
    });
  }

  function fetchWithTimeout(url) {
    if (!window.fetch) return Promise.reject(new Error("fetch_unavailable"));
    let finished = false;
    return new Promise(function (resolve, reject) {
      const timer = window.setTimeout(function () {
        if (finished) return;
        finished = true;
        reject(new Error("media_search_timeout"));
      }, MEDIA_SEARCH_TIMEOUT_MS);
      window.fetch(url, { method: "GET", headers: { Accept: "application/json" } }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          resolve({ response: response, data: data });
        });
      }).catch(function (error) {
        if (finished) return;
        finished = true;
        window.clearTimeout(timer);
        reject(error);
      });
    });
  }

  function resolve(query) {
    const cleanQuery = clean(query);
    const catalogMatch = getCatalogMatch(cleanQuery);
    const providerQuery = catalogMatch && catalogMatch.searchQuery ? catalogMatch.searchQuery : cleanQuery;
    const requestUrl = buildMediaSearchUrl(providerQuery);
    rejectHistoricalCandidates(cleanQuery);
    if (catalogMatch) {
      log("MEDIA_CATALOG_MATCH", {
        query: cleanQuery,
        catalogId: catalogMatch.catalogId,
        title: catalogMatch.title,
        artist: catalogMatch.artist,
        playable: catalogMatch.playable === true,
        embeddable: catalogMatch.embeddable === true,
        videoId: catalogMatch.videoId || null
      });
      if (isPlayableCatalogMedia(catalogMatch)) {
        if (!isOnline()) {
          log("MEDIA_OFFLINE_BLOCKED", { catalogId: catalogMatch.catalogId, title: catalogMatch.title, providerCalls: 0 });
          return Promise.resolve(Object.assign({}, catalogMatch, { found: false, providerStatus: "OFFLINE", offline: true, catalogMatch: catalogMatch, fallbackCandidates: [] }));
        }
        log("MEDIA_CATALOG_DIRECT", { catalogId: catalogMatch.catalogId, videoId: catalogMatch.videoId });
        return Promise.resolve(Object.assign({}, catalogMatch, { found: true, providerStatus: "CATALOG_CACHE_HIT", fallbackCandidates: [] }));
      }
      log("MEDIA_CATALOG_NEEDS_PROVIDER", { catalogId: catalogMatch.catalogId, searchQuery: providerQuery });
    }
    if (!isOnline()) {
      log("MEDIA_OFFLINE_BLOCKED", { catalogId: catalogMatch && catalogMatch.catalogId || null, query: cleanQuery, providerCalls: 0 });
      return Promise.resolve({ found: false, source: "offline", providerStatus: "OFFLINE", offline: true, candidates: [], catalogMatch: catalogMatch || null });
    }
    log("MEDIA_RESOLVE_START", { query: providerQuery, originalQuery: cleanQuery, provider: "youtube-data-api", requestUrl: requestUrl || null });
    if (!requestUrl) {
      log("MEDIA_RESOLVE_RESULT", { found: false, reason: "PROVIDER_UNAVAILABLE", provider: "youtube-data-api", requestUrl: null });
      return Promise.resolve({ found: false, source: "youtube-data-api", providerStatus: "PROVIDER_UNAVAILABLE", candidates: [], catalogMatch: catalogMatch || null });
    }
    return fetchWithTimeout(requestUrl).then(function (result) {
      const response = result.response;
      const data = result.data || {};
      log("MEDIA_PROVIDER_RESPONSE", {
        requestUrl: requestUrl,
        httpStatus: response.status,
        ok: response.ok,
        provider: data.provider,
        error: data.error || null
      });
      if (!response.ok || data.ok === false) {
        return normalizeProviderResult(data, providerQuery, requestUrl, response.status, catalogMatch);
      }
      return normalizeProviderResult(data, providerQuery, requestUrl, response.status, catalogMatch);
    }).catch(function (error) {
      log("MEDIA_RESOLVE_RESULT", {
        found: false,
        reason: clean(error && error.message) || "provider_request_failed",
        provider: "youtube-data-api",
        requestUrl: requestUrl
      });
      return { found: false, source: "youtube-data-api", providerStatus: "PROVIDER_UNAVAILABLE", candidates: [], catalogMatch: catalogMatch || null };
    });
  }

  function getPlayer() {
    const player = window.EloMediaPlayer;
    if (player && player.__eloControlBridgeApi === true && typeof player.getSource === "function") return player.getSource();
    return player || null;
  }

  function play(media) {
    if (!isOnline()) {
      log("MEDIA_PLAY_OFFLINE_BLOCKED", { catalogId: media && media.catalogId || null, videoId: media && media.videoId || null });
      return Promise.resolve(false);
    }
    const player = getPlayer();
    if (!player || typeof player.play !== "function") {
      log("MEDIA_PLAYER_START", { ok: false, reason: "player_unavailable" });
      return false;
    }
    return Promise.resolve(player.play(media)).then(function (played) {
      if (played === false) invalidateCatalogResolution(media, "MEDIA_ERROR");
      return played;
    }).catch(function (error) {
      invalidateCatalogResolution(media, clean(error && error.message) || "MEDIA_ERROR");
      throw error;
    });
  }

  window.EloMusicResolver = {
    provider: "youtube-data-api",
    endpoint: MEDIA_SEARCH_PATH,
    resolve: resolve,
    search: resolve,
    play: play,
    findCatalog: getCatalogMatch,
    invalidateCatalogResolution: invalidateCatalogResolution,
    normalizeProviderResultForTest: normalizeProviderResult
  };
  window.ELO_MUSIC_RESOLVER = window.EloMusicResolver;

  log("MEDIA_RESOLVER_LOADED", { resolver: "EloMusicResolver", provider: "youtube-data-api", endpoint: MEDIA_SEARCH_PATH });
})();

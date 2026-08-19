(function () {
  "use strict";

  var CACHE_KEY = "elo_music_resolver_cache_v2";
  var HIGH_CONFIDENCE = 0.85;
  var MEDIUM_CONFIDENCE = 0.68;
  var MAX_CACHE_ITEMS = 40;

  var SEED_CATALOG = [
    {
      title: "Sultans of Swing",
      artist: "Dire Straits",
      videoId: "h0ffIJ7ZO4U",
      canonicalQuery: "sultans of swing dire straits",
      aliases: ["sultans of swing", "sultan of swing", "sultans swing", "sul of swing", "of suking"]
    },
    {
      title: "Bohemian Rhapsody",
      artist: "Queen",
      videoId: "fJ9rUzIMcZQ",
      canonicalQuery: "bohemian rhapsody queen",
      aliases: ["bohemian rhapsody", "boemiam rapisodi", "boemia rapsody", "queen bohemian"]
    },
    {
      title: "Sweet Child O' Mine",
      artist: "Guns N' Roses",
      videoId: "1w7OgIMMRc4",
      canonicalQuery: "sweet child o mine guns n roses",
      aliases: ["sweet child o mine", "sweet child of mine", "swit child of mine", "guns roses sweet child"]
    },
    {
      title: "Hotel California",
      artist: "Eagles",
      videoId: "BciS5krYL80",
      canonicalQuery: "hotel california eagles",
      aliases: ["hotel california", "hotel california eagles"]
    },
    {
      title: "Hello",
      artist: "Adele",
      videoId: "YQHsXMglC9A",
      canonicalQuery: "hello adele",
      aliases: ["hello adele"]
    },
    {
      title: "Hello",
      artist: "Lionel Richie",
      videoId: "mHONNcZbwDY",
      canonicalQuery: "hello lionel richie",
      aliases: ["hello lionel richie"]
    }
  ];

  function getBackendEndpoint(path) {
    const configured = String(window.ELO_API_BASE_URL || window.OBRAREPORT_API_BASE_URL || "").replace(/\/+$/g, "");
    const baseUrl = configured || "http://localhost:3000";
    return baseUrl + path;
  }
  function normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’`´]/g, "'")
      .replace(/[^a-z0-9'\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeLoose(text) {
    return normalize(text)
      .replace(/\bof\b/g, "o")
      .replace(/\bthe\b/g, "")
      .replace(/ph/g, "f")
      .replace(/y/g, "i")
      .replace(/h/g, "")
      .replace(/w/g, "u")
      .replace(/(.)\1+/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasMusicIntent(text) {
    var clean = normalize(text);
    if (/\b(quem|qual|quais|quando|onde|porque|por que|significado|historia|história|canta|cantou|compositor)\b/.test(clean)) return false;
    return /\b(toque|toca|tocar|coloque|coloca|reproduza|reproduzir|play|ponha|bota|botar)\b/.test(clean) || /\bquero ouvir\b/.test(clean);
  }

  function extractQuery(transcript) {
    var text = normalize(transcript);
    text = text
      .replace(/\b(por favor|pra mim|para mim|agora)\b/g, " ")
      .replace(/\b(quero ouvir|toque|toca|tocar|coloque|coloca|reproduza|reproduzir|play|ponha|bota|botar)\b/g, " ")
      .replace(/\b(uma musica de|uma musica do|uma musica da|uma do|uma da|uma de|musica de|musica do|musica da|a musica|a música|o som|a cancao|a canção|aquela do|aquela da|aquela de)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text;
  }

  function bigrams(value) {
    var text = normalizeLoose(value).replace(/\s+/g, "");
    if (text.length < 2) return text ? [text] : [];
    var grams = [];
    for (var index = 0; index < text.length - 1; index += 1) grams.push(text.slice(index, index + 2));
    return grams;
  }

  function dice(first, second) {
    var a = bigrams(first);
    var b = bigrams(second);
    if (!a.length || !b.length) return 0;
    var counts = Object.create(null);
    b.forEach(function (gram) { counts[gram] = (counts[gram] || 0) + 1; });
    var matches = 0;
    a.forEach(function (gram) {
      if (counts[gram]) {
        matches += 1;
        counts[gram] -= 1;
      }
    });
    return (2 * matches) / (a.length + b.length);
  }

  function tokenScore(first, second) {
    var a = new Set(normalize(first).split(" ").filter(Boolean));
    var b = new Set(normalize(second).split(" ").filter(Boolean));
    if (!a.size || !b.size) return 0;
    var hits = 0;
    a.forEach(function (token) { if (b.has(token)) hits += 1; });
    return hits / Math.max(a.size, b.size);
  }

  function scoreText(query, candidate) {
    var cleanQuery = normalize(query);
    var cleanCandidate = normalize(candidate);
    if (!cleanQuery || !cleanCandidate) return 0;
    if (cleanQuery === cleanCandidate) return 1;
    if (cleanCandidate.indexOf(cleanQuery) >= 0 || cleanQuery.indexOf(cleanCandidate) >= 0) return 0.92;
    return Math.max(dice(cleanQuery, cleanCandidate), tokenScore(cleanQuery, cleanCandidate));
  }

  function readCache() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(CACHE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writeCache(items) {
    try {
      if (window.localStorage) window.localStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, MAX_CACHE_ITEMS)));
    } catch (error) {}
  }

  function normalizeTrack(track) {
    if (!track || typeof track !== "object") return null;
    var videoId = String(track.videoId || track.id || "").trim();
    var title = String(track.title || "").trim();
    if (!videoId || !title) return null;
    return {
      title: title,
      artist: String(track.artist || track.channel || "").trim(),
      videoId: videoId,
      thumbnail: String(track.thumbnail || "").trim(),
      canonicalQuery: normalize(track.canonicalQuery || [title, track.artist || track.channel || ""].join(" ")),
      aliases: Array.isArray(track.aliases) ? track.aliases.map(normalize).filter(Boolean).slice(0, 12) : []
    };
  }

  function getCatalog() {
    var seen = new Set();
    return readCache().concat(SEED_CATALOG).map(normalizeTrack).filter(function (track) {
      if (!track || seen.has(track.videoId)) return false;
      seen.add(track.videoId);
      return true;
    });
  }

  function scoreTrack(query, track) {
    var targets = [track.title, track.artist, track.canonicalQuery].concat(track.aliases || []);
    var best = 0;
    targets.forEach(function (target) { best = Math.max(best, scoreText(query, target)); });
    if (normalize(track.artist) === normalize(query)) best = Math.max(best, 0.88);
    return best;
  }

  function resolveLocal(query) {
    var matches = getCatalog().map(function (track) {
      return { track: track, confidence: scoreTrack(query, track), source: "local" };
    }).filter(function (entry) { return entry.confidence >= MEDIUM_CONFIDENCE; }).sort(function (a, b) { return b.confidence - a.confidence; });

    if (!matches.length) return null;
    var top = matches[0];
    var second = matches[1];
    var exactAmbiguous = second && normalize(top.track.title) === normalize(second.track.title) && scoreText(query, top.track.title) >= 0.92 && scoreText(query, second.track.title) >= 0.92;
    if (exactAmbiguous || (second && top.confidence < HIGH_CONFIDENCE && Math.abs(top.confidence - second.confidence) < 0.08)) {
      return { ok: false, intent: "media_play", status: "needs_confirmation", query: query, confidence: top.confidence, options: matches.slice(0, 3).map(function (entry) { return entry.track; }) };
    }
    if (top.confidence >= HIGH_CONFIDENCE) return { ok: true, intent: "media_play", status: "resolved", query: query, confidence: top.confidence, track: top.track, source: top.source };
    return null;
  }

  function rankSearchResults(query, results) {
    return (Array.isArray(results) ? results : []).map(normalizeTrack).filter(Boolean).map(function (track) {
      var haystack = [track.title, track.artist, track.canonicalQuery].join(" ");
      var confidence = scoreText(query, haystack);
      var clean = normalize(haystack);
      if (/official|oficial|vevo/.test(clean)) confidence += 0.08;
      if (/cover|reaction|karaoke|aula|lesson|lyrics?/.test(clean)) confidence -= 0.16;
      if (track.embeddable === false) confidence -= 0.2;
      return { track: track, confidence: Math.max(0, Math.min(1, confidence)), source: "search" };
    }).sort(function (a, b) { return b.confidence - a.confidence; });
  }

  function buildRemoteSearchQuery(query) {
    var safeQuery = normalize(query).slice(0, 120);
    if (!safeQuery) return "";
    var tokens = safeQuery.split(" ").filter(Boolean);
    if (tokens.length <= 2 && !/\b(musica|music|official|oficial|video|clipe|show|ao vivo)\b/.test(safeQuery)) {
      return safeQuery + " musica";
    }
    return safeQuery;
  }
  function search(query) {
    var safeQuery = buildRemoteSearchQuery(query);
    if (!safeQuery || typeof fetch !== "function") return Promise.resolve({ ok: false, provider: "youtube-data-api", results: [] });
    return fetch(getBackendEndpoint("/api/elo/media/search"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ q: safeQuery })
    }).then(function (response) {
      return response.json().then(function (data) { return response.ok ? data : { ok: false, error: data && data.error, results: [] }; });
    }).catch(function () {
      return { ok: false, provider: "youtube-data-api", results: [] };
    });
  }

  function learnAlias(alias, resolvedTrack) {
    var cleanAlias = normalize(alias);
    var track = normalizeTrack(resolvedTrack);
    if (!cleanAlias || !track) return false;
    var cache = readCache().filter(function (item) { return normalizeTrack(item) && normalizeTrack(item).videoId !== track.videoId; });
    track.aliases = Array.from(new Set([cleanAlias].concat(track.aliases || []))).slice(0, 12);
    cache.unshift(track);
    writeCache(cache);
    return true;
  }

  function resolveCommand(transcript) {
    if (!hasMusicIntent(transcript)) return Promise.resolve({ ok: false, intent: null, status: "not_music" });
    var query = extractQuery(transcript);
    if (!query) return Promise.resolve({ ok: false, intent: "media_play", status: "empty_query" });
    var local = resolveLocal(query);
    if (local) return Promise.resolve(local);

    return search(query).then(function (payload) {
      var ranked = rankSearchResults(query, payload && payload.results);
      if (!ranked.length) return { ok: false, intent: "media_play", status: "not_found", query: query, provider: payload && payload.provider || "youtube-data-api" };
      var top = ranked[0];
      var second = ranked[1];
      if (second && top.confidence < HIGH_CONFIDENCE && Math.abs(top.confidence - second.confidence) < 0.08) {
        return { ok: false, intent: "media_play", status: "needs_confirmation", query: query, confidence: top.confidence, options: ranked.slice(0, 3).map(function (entry) { return entry.track; }), provider: payload && payload.provider || "youtube-data-api" };
      }
      if (top.confidence < MEDIUM_CONFIDENCE) return { ok: false, intent: "media_play", status: "not_found", query: query, provider: payload && payload.provider || "youtube-data-api" };
      learnAlias(query, top.track);
      return { ok: true, intent: "media_play", status: "resolved", query: query, confidence: top.confidence, track: top.track, source: "remote", provider: payload && payload.provider || "youtube-data-api" };
    });
  }

  window.EloMusicResolver = {
    resolveCommand: resolveCommand,
    normalize: normalize,
    search: search,
    buildRemoteSearchQueryForTest: buildRemoteSearchQuery,
    learnAlias: learnAlias,
    extractQueryForTest: extractQuery,
    hasMusicIntentForTest: hasMusicIntent,
    scoreTextForTest: scoreText,
    resolveLocalForTest: resolveLocal,
    rankSearchResultsForTest: rankSearchResults
  };
})();

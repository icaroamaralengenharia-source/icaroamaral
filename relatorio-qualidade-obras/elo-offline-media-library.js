(function () {
  "use strict";

  const LIBRARY_URL = "./relatorio-qualidade-obras/offline-media/classical/library.json";
  const ASSET_BASE_URL = "./relatorio-qualidade-obras/";
  let library = [];
  let initPromise = null;

  function log(name, payload) {
    try {
      if (window.console && typeof window.console.info === "function") window.console.info(name, payload || {});
    } catch (error) {}
  }

  function clean(value) {
    return String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim();
  }

  function normalize(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(?:elo|toque|toca|tocar|coloque|coloca|colocar|poe|ponha|bota|botar|reproduza|reproduzir|play|musica|música|som|por favor|uma|um|a|o)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || null));
  }

  function normalizeFile(file, index) {
    const path = clean(file && file.path);
    return Object.assign({}, file, {
      path: path,
      url: path.indexOf("./") === 0 || /^https?:\/\//i.test(path) ? path : ASSET_BASE_URL + path,
      index: index + 1
    });
  }

  function normalizeItem(item) {
    const files = Array.isArray(item && item.files) ? item.files.map(normalizeFile) : [];
    const title = clean(item && item.title);
    const composer = clean(item && item.composer);
    const aliases = Array.isArray(item && item.aliases) ? item.aliases.map(clean).filter(Boolean) : [];
    return Object.assign({}, item, {
      id: clean(item && item.id),
      title: title,
      artist: composer,
      composer: composer,
      source: "LOCAL_CLASSICAL",
      providerStatus: "LOCAL_CLASSICAL",
      playable: files.length > 0,
      embeddable: true,
      offline: true,
      local: true,
      files: files,
      aliases: aliases,
      normalizedTitle: normalize(title),
      normalizedLabel: normalize(composer + " " + title + " " + aliases.join(" ")),
      normalizedAliases: [title, composer, composer + " " + title].concat(aliases).map(normalize).filter(Boolean)
    });
  }

  function scoreItem(query, item) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery || !item) return 0;
    let best = 0;
    (item.normalizedAliases || []).forEach(function (alias) {
      if (!alias) return;
      if (normalizedQuery === alias) best = Math.max(best, 100);
      else if (alias.indexOf(normalizedQuery) >= 0 || normalizedQuery.indexOf(alias) >= 0) {
        best = Math.max(best, Math.min(alias.length, normalizedQuery.length));
      }
    });
    return best;
  }

  function loadFromJson(data) {
    library = (Array.isArray(data) ? data : []).map(normalizeItem).filter(function (item) {
      return item.id && item.files.length && item.offlineAllowed !== false && item.legalStatus !== "BLOCKED";
    });
    log("OFFLINE_LIBRARY_READY", {
      items: library.length,
      files: library.reduce(function (total, item) { return total + item.files.length; }, 0)
    });
    return list();
  }

  function init() {
    if (library.length) return Promise.resolve(list());
    if (initPromise) return initPromise;
    if (!window.fetch) {
      initPromise = Promise.resolve(list());
      return initPromise;
    }
    initPromise = window.fetch(LIBRARY_URL, { method: "GET", headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response || !response.ok) throw new Error("offline_library_http_" + (response && response.status || 0));
        return response.json();
      })
      .then(loadFromJson)
      .catch(function (error) {
        log("OFFLINE_LIBRARY_ERROR", { reason: clean(error && error.message) });
        return list();
      });
    return initPromise;
  }

  function list() {
    return clone(library) || [];
  }

  function find(query) {
    const ranked = library.map(function (item) {
      return { item: item, score: scoreItem(query, item) };
    }).filter(function (entry) {
      return entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score;
    });
    return ranked.length ? clone(ranked[0].item) : null;
  }

  function get(id) {
    const cleanId = clean(id);
    const item = library.find(function (candidate) { return candidate.id === cleanId; }) || null;
    return item ? clone(item) : null;
  }

  window.EloOfflineMediaLibrary = {
    init: init,
    list: list,
    find: find,
    get: get,
    normalize: normalize,
    loadFromJsonForTest: loadFromJson
  };

  init();
})();

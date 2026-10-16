const ELO_CACHE_NAME = "elo-web-offline-v46-20261016-elo-brain-final-v4";
const ELO_CORE_ASSETS = [
  "./elo.html",
  "./relatorio-qualidade-obras/rdo-canonical-auth.js?v=20261014-rdo-auth-fallback-v1",
  "./relatorio-qualidade-obras/elo-voice-session.js?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-viewport.js?v=20261016-elo-brain-final-v4",
  "./elo.css?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-runtime-config.js?v=20260920-observability-final-v1",
  "./relatorio-qualidade-obras/elo-telemetry.js?v=20260920-observability-final-v1",
  "./relatorio-qualidade-obras/elo-proactive-reasoning-policy.js?v=20261014-premium-v1",
  "./relatorio-qualidade-obras/elo-communication-policy.js?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-technical-validator.js?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-brain-router.js?v=20261014-premium-v1",
  "./relatorio-qualidade-obras/elo-offline-core-v2.js?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-command-bridge.js?v=20261015-rdo-operational-preview-v1",
  "./relatorio-qualidade-obras/elo-live-data-router.js?v=20261004-live-data-v1",
  "./relatorio-qualidade-obras/elo-assistente.js?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-music-catalog.js?v=20261003-player-v2",
  "./relatorio-qualidade-obras/elo-music-resolver.js?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-media-player.js?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-offline-media-library.js?v=20261016-elo-brain-final-v4",
  "./relatorio-qualidade-obras/elo-offline-memory-adapter.js",
  "./relatorio-qualidade-obras/elo-offline-router.js?v=20261003-player-v2",
  "./relatorio-qualidade-obras/offline-media/classical/library.json",
  "./relatorio-qualidade-obras/offline-media/pack-v1/catalog.json?v=20261004-audio-v1"
];

const ELO_OPTIONAL_MEDIA_ASSETS = [
  "./relatorio-qualidade-obras/offline-media/classical/beethoven/fur-elise.ogg",
  "./relatorio-qualidade-obras/offline-media/classical/debussy/clair-de-lune.ogg",
  "./relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-1-allegro.oga",
  "./relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-2-largo.oga",
  "./relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-3-allegro.oga",
  "./relatorio-qualidade-obras/offline-media/classical/pachelbel/canon-in-d.mp3",
  "./relatorio-qualidade-obras/offline-media/classical/chopin/nocturne-op-9-no-2.ogg"
  ,"./relatorio-qualidade-obras/offline-media/pack-v1/01-wm-brahms-waltz01.ogg"
  ,"./relatorio-qualidade-obras/offline-media/pack-v1/02-wm-brahms-waltz02.ogg"
];

function cacheOptionalMedia(cache, asset) {
  return fetch(asset).then(function (response) {
    if (!response.ok) throw new Error("http_" + response.status);
    return cache.put(asset, response);
  }).catch(function (error) {
    console.warn("ELO_SW_OPTIONAL_MEDIA_MISSING", asset, error && error.message ? error.message : error);
  });
}

function isObraReportApiUrl(url) {
  return /^\/api\/obrareport(?:\/|$)/i.test(url.pathname);
}

function removeCachedObraReportResponses() {
  return caches.open(ELO_CACHE_NAME).then(function (cache) {
    return cache.keys().then(function (requests) {
      return Promise.all(requests.filter(function (request) {
        return isObraReportApiUrl(new URL(request.url));
      }).map(function (request) {
        return cache.delete(request);
      }));
    });
  });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(ELO_CACHE_NAME).then(function (cache) {
      return cache.addAll(ELO_CORE_ASSETS).then(function () {
        return Promise.all(ELO_OPTIONAL_MEDIA_ASSETS.map(function (asset) {
          return cacheOptionalMedia(cache, asset);
        }));
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (name) {
        return name.indexOf("elo-web-offline-") === 0 && name !== ELO_CACHE_NAME;
      }).map(function (name) {
        return caches.delete(name);
      }));
    }).then(function () {
      return removeCachedObraReportResponses();
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  // RDO reads must reflect the backend after create/update, never an offline snapshot.
  if (isObraReportApiUrl(url)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }
  if (url.pathname.endsWith("/assets/elo-public-config.js")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }
    if (/^\/api\/stock-(?:full|saude)(?:\/|$)/i.test(url.pathname) || url.pathname.indexOf("/api/elo/") === 0 || url.hostname.indexOf("youtube") >= 0 || url.hostname.indexOf("googlevideo") >= 0) return;

  if (url.pathname.endsWith("/elo.html") || url.pathname === "/" || request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(function (response) {
        const copy = response.clone();
        caches.open(ELO_CACHE_NAME).then(function (cache) { cache.put("./elo.html", copy); });
        return response;
      }).catch(function () {
        return caches.match("./elo.html");
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      return cached || fetch(request).then(function (response) {
        const copy = response.clone();
        caches.open(ELO_CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        return response;
      });
    })
  );
});

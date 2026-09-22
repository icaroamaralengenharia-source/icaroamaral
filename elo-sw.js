const ELO_CACHE_NAME = "elo-web-offline-v14-20260922-routing-v2";
const ELO_CORE_ASSETS = [
  "./elo.html",
  "./elo.css",
  "./relatorio-qualidade-obras/elo-runtime-config.js?v=20260920-observability-final-v1",
  "./relatorio-qualidade-obras/elo-telemetry.js?v=20260920-observability-final-v1",
  "./relatorio-qualidade-obras/elo-proactive-reasoning-policy.js?v=20260920-proactive-v1",
  "./relatorio-qualidade-obras/elo-communication-policy.js?v=20260920-conversational-v1",
  "./relatorio-qualidade-obras/elo-command-bridge.js?v=20260922-rdo-routing-v2",
  "./relatorio-qualidade-obras/elo-assistente.js?v=20260922-rdo-routing-v2",
  "./relatorio-qualidade-obras/elo-music-catalog.js",
  "./relatorio-qualidade-obras/elo-music-resolver.js",
  "./relatorio-qualidade-obras/elo-media-player.js",
  "./relatorio-qualidade-obras/elo-offline-media-library.js",
  "./relatorio-qualidade-obras/elo-offline-memory-adapter.js",
  "./relatorio-qualidade-obras/elo-offline-router.js",
  "./relatorio-qualidade-obras/offline-media/classical/library.json",
  "./relatorio-qualidade-obras/offline-media/pack-v1/catalog.json"
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
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  if (url.pathname.endsWith("/assets/elo-public-config.js")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }
  if (url.pathname.indexOf("/api/elo/") === 0 || url.hostname.indexOf("youtube") >= 0 || url.hostname.indexOf("googlevideo") >= 0) return;

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

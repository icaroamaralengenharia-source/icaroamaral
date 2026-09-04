const ELO_CACHE_NAME = "elo-web-offline-v4-20260903-official-offline-v1";
const ELO_SHELL_ASSETS = [
  "./elo.html",
  "./elo.css",
  "./relatorio-qualidade-obras/elo-assistente.js?v=20260826-web-parity-v1",
  "./relatorio-qualidade-obras/elo-music-catalog.js",
  "./relatorio-qualidade-obras/elo-music-resolver.js",
  "./relatorio-qualidade-obras/elo-media-player.js",
  "./relatorio-qualidade-obras/elo-offline-media-library.js",
  "./relatorio-qualidade-obras/elo-offline-memory-adapter.js",
  "./relatorio-qualidade-obras/elo-offline-router.js",
  "./relatorio-qualidade-obras/offline-media/classical/library.json",
  "./relatorio-qualidade-obras/offline-media/classical/beethoven/fur-elise.ogg",
  "./relatorio-qualidade-obras/offline-media/classical/debussy/clair-de-lune.ogg",
  "./relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-1-allegro.oga",
  "./relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-2-largo.oga",
  "./relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-3-allegro.oga",
  "./relatorio-qualidade-obras/offline-media/classical/pachelbel/canon-in-d.mp3",
  "./relatorio-qualidade-obras/offline-media/classical/chopin/nocturne-op-9-no-2.ogg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(ELO_CACHE_NAME).then(function (cache) {
      return cache.addAll(ELO_SHELL_ASSETS);
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

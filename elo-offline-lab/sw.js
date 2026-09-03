const CACHE_NAME = "elo-offline-lab-v1-20260902";
const LAB_CACHE_PREFIX = "elo-offline-lab-";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./elo-offline-router.js",
  "./elo-offline-memory-adapter.js",
  "../relatorio-qualidade-obras/offline-media/classical/library.json",
  "../relatorio-qualidade-obras/offline-media/classical/beethoven/fur-elise.ogg",
  "../relatorio-qualidade-obras/offline-media/classical/debussy/clair-de-lune.ogg",
  "../relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-1-allegro.oga",
  "../relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-2-largo.oga",
  "../relatorio-qualidade-obras/offline-media/classical/vivaldi/spring-mvt-3-allegro.oga",
  "../relatorio-qualidade-obras/offline-media/classical/pachelbel/canon-in-d.mp3",
  "../relatorio-qualidade-obras/offline-media/classical/chopin/nocturne-op-9-no-2.ogg"
];

const CACHEABLE_URLS = new Set(ASSETS.map((asset) => new URL(asset, self.location.href).href));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith(LAB_CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin || !CACHEABLE_URLS.has(requestUrl.href)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request));
    })
  );
});
const MUNICIPAL_CACHE_VERSION = "municipal-shell-v1";
const MUNICIPAL_CACHE_PREFIX = "municipal-shell-";
const MUNICIPAL_SHELL_URL = "municipal-admin.html";
const MUNICIPAL_SHELL_ASSETS = [
  "municipal-admin.html",
  "municipal-manifest.webmanifest",
  "assets/elo-public-config.js",
  "relatorio-qualidade-obras/relatorio-config.js",
  "relatorio-qualidade-obras/municipal-admin-ui.css",
  "relatorio-qualidade-obras/municipal-asset-offline-store.js",
  "relatorio-qualidade-obras/municipal-admin-ui.js"
];

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isPrivateRequest(url) {
  return /\/api\//.test(url.pathname) || /supabase/i.test(url.hostname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(MUNICIPAL_CACHE_VERSION)
      .then((cache) => cache.addAll(MUNICIPAL_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(MUNICIPAL_CACHE_PREFIX) && key !== MUNICIPAL_CACHE_VERSION)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!sameOrigin(url) || isPrivateRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(MUNICIPAL_CACHE_VERSION).then((cache) => cache.put(MUNICIPAL_SHELL_URL, copy));
          return response;
        })
        .catch(() => caches.match(MUNICIPAL_SHELL_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(MUNICIPAL_CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
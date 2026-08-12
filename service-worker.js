const CACHE_PREFIX = "bupt-exam-board-";
const CACHE_NAME = `${CACHE_PREFIX}v5`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./src/app.js",
  "./src/domain.js",
  "./src/study-plan.js",
  "./src/storage.js",
  "./vendor/lucide.min.js",
  "./assets/icon.svg",
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkRequest = fetch(event.request)
        .then(response => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone();
            return caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, copy))
              .then(() => response);
          }
          return response;
        })
        .catch(() => cached ?? caches.match("./index.html"));
      return cached ?? networkRequest;
    })
  );
});

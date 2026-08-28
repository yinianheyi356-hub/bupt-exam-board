const CACHE_PREFIX = "bupt-exam-board-";
const CACHE_NAME = `${CACHE_PREFIX}v14`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=1.5.1",
  "./manifest.webmanifest",
  "./src/app.js?v=1.5.1",
  "./src/domain.js?v=1.5.1",
  "./src/study-plan.js?v=1.5.1",
  "./src/storage.js?v=1.5.1",
  "./src/vocabulary.js?v=1.5.1",
  "./vendor/lucide.min.js?v=1.5.1",
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
    (async () => {
      const cached = await caches.match(event.request);
      try {
        const response = await fetch(event.request);
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return cached ?? (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error());
      }
    })()
  );
});

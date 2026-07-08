const CACHE_NAME = "sg-tippspiel-v1";

const STATIC_ASSETS = [
  "/SG-Tippspiel/",
  "/SG-Tippspiel/index.html",
  "/SG-Tippspiel/app.js",
  "/SG-Tippspiel/style.css",
  "/SG-Tippspiel/manifest.json"
];

// Installation – statische Dateien cachen
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktivierung – alten Cache löschen
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch – Network first, Cache als Fallback
self.addEventListener("fetch", event => {
  // API-Anfragen niemals cachen
  if (event.request.url.includes("onrender.com") ||
      event.request.url.includes("supabase.co")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Erfolgreiche Antwort im Cache speichern
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // Offline: aus Cache laden
        return caches.match(event.request);
      })
  );
});

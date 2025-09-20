// sw.js — works on localhost *and* GitHub Pages
const CACHE_NAME = 'mal-cache-v4';
const FILES_TO_CACHE = [
  './',                      // current path (works at / and /action-log/)
  './index.html',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: pre-cache core files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// Activate: clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for same-origin requests, network fallback
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle same-origin
  if (new URL(req.url).origin !== self.location.origin) return;

  // For navigations, fall back to cached index.html (lets app load offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try the network first to get fresh HTML
          const fresh = await fetch(req);
          return fresh;
        } catch {
          // Offline: return cached shell
          const cache = await caches.open(CACHE_NAME);
          return cache.match('./index.html');
        }
      })()
    );
    return;
  }

  // For static assets: cache-first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});

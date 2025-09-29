// sw.js — GitHub Pages friendly + cache-busting
const CACHE_NAME = 'mal-cache-v8'; // bump on each deploy
const FILES_TO_CACHE = [
  './',
  './index.html?v=8',
  './app.js?v=8',
  './manifest.webmanifest?v=8',
  './icons/icon-192.png?v=8',
  './icons/icon-512.png?v=8'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // same-origin only
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fallback to cached shell
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return cache.match('./index.html?v=8') || cache.match('./index.html');
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req))
  );
});

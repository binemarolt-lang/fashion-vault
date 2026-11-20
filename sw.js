const CACHE_NAME = 'vaultx-shell-v2';
const SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './fonts.css',
  './fonts/PlusJakartaSans-500-latin.woff2',
  './fonts/PlusJakartaSans-500-latin-ext.woff2',
  './fonts/PlusJakartaSans-700-latin.woff2',
  './fonts/IBMPlexMono-400-latin.woff2',
  './app.js',
  './manifest.json',
  './favicon.svg',
  './404.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Data chunks and API calls stay network-first (chunks are persisted in IndexedDB)
  if (url.pathname.includes('/data/') || url.pathname.includes('/api/')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Shell assets: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

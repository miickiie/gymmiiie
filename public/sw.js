/* Gymmiie service worker — offline-first app shell.
 * Bump CACHE when the app shell changes so clients refresh.
 * API requests are never cached: snapshots are private and time-sensitive.
 */
const CACHE = 'gymmiie-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined)));
  // The build rewrites hashed asset URLs in index.html. Read them back so a
  // first visit can go offline without needing a second online load.
  try {
    const res = await fetch('/');
    if (!res.ok) return;
    const html = await res.clone().text();
    await cache.put('/', res);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await Promise.all([...new Set(assets)].map((url) => cache.add(url).catch(() => undefined)));
  } catch {
    /* offline install is still fine; assets will be cached at runtime */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first so deploys are picked up, cache as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => (await caches.match('/')) || (await caches.match(request)) || Response.error()),
    );
    return;
  }

  // Hashed static assets: cache first, then fill the cache in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      });
    }),
  );
});

// Prosty SW: pre-cache core, runtime cache dla assetów i obrazów
const VERSION = 'v1.0.0';
const CORE = `tarot-core-${VERSION}`;
const RUNTIME = `tarot-rt-${VERSION}`;

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './offline.html',
  './vendor/jszip.min.js',
];

// instalacja – cache core
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_ASSETS)));
});

// aktywacja – sprzątanie starych cache’y
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (![CORE, RUNTIME].includes(k)) return caches.delete(k);
    }));
    self.clients.claim();
  })());
});

// strategia fetch
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 1) Nawigacja (HTML) – network-first, fallback: cache/offline
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached || caches.match('./offline.html');
      }
    })());
    return;
  }

  // 2) Skrypty/style/worker – cache-first
  if (['script','style','worker'].includes(req.destination)) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      const cache = await caches.open(RUNTIME);
      cache.put(req, fresh.clone());
      return fresh;
    })());
    return;
  }

  // 3) Obrazy (w tym ./images/…) – cache-first + odświeżanie
  if (req.destination === 'image' || url.pathname.includes('/images/')) {
    e.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req, { mode: 'no-cors' });
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cached || new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  // reszta – try cache, then network
  e.respondWith(caches.match(req).then(c => c || fetch(req)));
});

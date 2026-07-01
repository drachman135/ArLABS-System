// ============================================================
// ArLABS Admin Panel — Production Service Worker
// Strategy: Network-First untuk API Supabase (data selalu fresh)
//            Cache-First untuk app shell (HTML/CSS/JS assets)
// ============================================================

const CACHE_NAME = 'arlabs-admin-v2';
const APP_SHELL = [
  '/',
  '/index.html',
];

// ─── INSTALL: Cache app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// ─── ACTIVATE: Hapus cache lama ────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH: Strategi caching per jenis request ─────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Lewati request non-GET
  if (request.method !== 'GET') return;

  // Supabase API & external services → Network Only (selalu data terbaru)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('ultralink.my.id')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets (JS/CSS/fonts/images) → Cache First, fallback ke network
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Halaman navigasi → Network First, fallback ke /index.html (SPA routing)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => {
        return caches.match('/index.html');
      })
    );
    return;
  }
});

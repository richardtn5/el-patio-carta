const CACHE_NAME = 'kaku-pwa-cache-v4';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.json',
  './manifest-admin.json',
  './manifest.webmanifest',
  './manifest-admin.webmanifest',
  './apple-touch-icon.png',
  './apple-touch-icon-admin.png',
  './icon-192.png',
  './icon-512.png',
  './icon-admin-192.png',
  './icon-admin-512.png',
  './icon.svg',
  './icon-admin.svg',
  './logo-kaku.svg',
  './data/menu.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map(asset => cache.add(asset).catch(err => {
          console.warn('Precache skip:', asset, err.message);
        }))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('Purging outdated cache:', k);
          return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  const url = new URL(event.request.url);

  // Network-first for menu.json so latest updates are seen immediately
  if (url.pathname.endsWith('menu.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Network-first for HTML navigation requests (opening pages)
  if (event.request.mode === 'navigate') {
    const isAdmin = url.pathname.endsWith('admin.html') || url.pathname.includes('/admin');

    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cachedMatch = await caches.match(event.request);
          if (cachedMatch) return cachedMatch;

          // If the requested navigation is for admin.html, NEVER return index.html!
          if (isAdmin) {
            return (await caches.match('./admin.html')) || (await caches.match('admin.html'));
          }

          // Fallback for public menu only
          return (await caches.match('./index.html')) || (await caches.match('index.html')) || (await caches.match('./'));
        })
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

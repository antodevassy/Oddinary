const CACHE_NAME = 'oddinary-v87';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './play.html',
  './style.css',
  './js/words-data.js',
  './js/storage.js',
  './js/audio.js',
  './js/game.js',
  './js/ui.js',
  './js/install.js',
  './assets/logo.png',
  './assets/fav-icon.png',
  './assets/maskable-icon.png',
  './about.html',
  './privacy.html',
  './terms.html',
  './contact.html',
  './offline.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip caching for external ads and analytics
  if (event.request.url.includes('googlesyndication') || event.request.url.includes('google-analytics') || event.request.url.includes('googletagmanager')) {
    return;
  }
  // Always fetch manifest from network so changes apply immediately
  if (event.request.url.includes('manifest.json')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // Navigation requests (HTML page loads) - fallback to offline.html if network & cache miss
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        }))
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

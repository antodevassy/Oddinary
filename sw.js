const CACHE_NAME = 'oddinary-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './words-data.js',
  './logo.png',
  './fav-icon.png',
  './about.html',
  './privacy.html',
  './terms.html',
  './contact.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Pass network-first for external ads and scripts
  if (event.request.url.includes('googlesyndication') || event.request.url.includes('google')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});

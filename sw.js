const CACHE_NAME = 'oddinary-v19';
const ASSETS_TO_CACHE = [
 './',
 './index.html',
 './style.css',
 './js/words-data.js',
 './js/storage.js',
 './js/audio.js',
 './js/game.js',
 './js/ui.js',
 './js/install.js',
 './assets/background.png',
 './assets/logo.png',
 './assets/fav-icon.png',
 './about.html',
 './privacy.html',
 './terms.html',
 './contact.html'
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
  // Always fetch manifest from network so name/icon changes apply immediately
  if (event.request.url.includes('manifest.json')) {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  return;
  }
  event.respondWith(
  caches.match(event.request).then((cachedResponse) => {
  return cachedResponse || fetch(event.request);
  })
  );
});

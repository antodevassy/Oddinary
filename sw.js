const CACHE_NAME = 'oddinary-v17';
const ASSETS_TO_CACHE = [
 './',
 './index.html',
 './style.css',
 './js/words-data.js',
 './js/storage.js',
 './js/audio.js',
 './js/game.js',
 './js/ui.js',
 './assets/background.png',
 './assets/logo.png',
 './assets/fav-icon.png',
 './manifest.json',
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
 // Pass network-first for external ads and analytics
 if (event.request.url.includes('googlesyndication') || event.request.url.includes('google-analytics') || event.request.url.includes('googletagmanager')) {
 return;
 }
 event.respondWith(
 caches.match(event.request).then((cachedResponse) => {
 return cachedResponse || fetch(event.request);
 })
 );
});

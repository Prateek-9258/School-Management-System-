const CACHE_NAME = 'school-app-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/static/js/main.chunk.js',
  '/static/css/main.chunk.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache).catch(err => {
          console.log('Some assets failed to cache:', err);
        });
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
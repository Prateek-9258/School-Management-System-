const CACHE_NAME = 'school-app-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => 
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  event.waitUntil(self.clients.claim());
});

// ✅ PWA Criteria: Fetch event listener is mandatory for installation
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

// Push notification receive karna
self.addEventListener('push', (event) => {
  console.log('📨 Push received:', event);

  const data = event.data.json();

  const options = {
    body: data.body || 'New notification',
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/badge.png',
    tag: data.tag || 'school-notification',
    requireInteraction: data.requireInteraction || true,
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'School Management', options)
  );
});

// Notification click handle karna
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);

  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Agar already open window hai, usko focus karo
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Nahi toh naya window open karo
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
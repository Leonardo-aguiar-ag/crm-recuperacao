// Service Worker - CRM Recupera AI
const CACHE_NAME = 'crm-recupera-v1';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './logo.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Notificações push
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'CRM Recupera', body: 'Nova notificação' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './logo.png',
      badge: './logo.png',
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});

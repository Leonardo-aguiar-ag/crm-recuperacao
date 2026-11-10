const CACHE_NAME = 'crm-recupera-v3';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './logo.png',
  './styles/app.css',
  './scripts/analytics.js',
  './scripts/app/00-core.js',
  './scripts/app/10-dashboard.js',
  './scripts/app/20-clients.js',
  './scripts/app/30-client-details.js',
  './scripts/app/40-leads.js',
  './scripts/app/50-admin-backups.js',
  './scripts/app/60-import.js',
  './modules/crm-enhancements.js',
  './modules/crm-tags.js',
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
  // Estratégia Network First para permitir sincronização offline do Firestore
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Background Sync para quando a internet voltar
self.addEventListener('sync', event => {
  if (event.tag === 'sync-leads') {
    event.waitUntil(syncLeadsOffline());
  }
});

async function syncLeadsOffline() {
  // O Firestore já gerencia a fila offline internamente (enablePersistence).
  // Este evento pode ser usado para notificar o usuário ou disparar lógicas adicionais.
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_COMPLETE' }));
}

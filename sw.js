/* ════════════════════════════════════════════════
   PHARMALOC SERVICE WORKER — PWA OFFLINE SUPPORT
   Version 1.0.0
════════════════════════════════════════════════ */
const CACHE_NAME = 'pharmaloc-v1';
const STATIC_ASSETS = [
  '/pharma.html',
  '/localisation.html',
  '/boutique.html',
  '/ordonnance.html',
  '/urgences.html',
  '/apropos.html',
  '/login.html',
  '/dashboard.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Clash+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

/* ── Installation : mise en cache des assets statiques ── */
self.addEventListener('install', event => {
  console.log('[PharmaLoc SW] Installation…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[PharmaLoc SW] Mise en cache des assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { mode: 'no-cors' })));
      })
      .then(() => self.skipWaiting())
  );
});

/* ── Activation : nettoyage des anciens caches ── */
self.addEventListener('activate', event => {
  console.log('[PharmaLoc SW] Activation…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch : stratégie Cache-First avec fallback réseau ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les APIs externes
  if (request.method !== 'GET') return;
  if (url.origin !== location.origin && !url.href.includes('fonts.googleapis') && !url.href.includes('cdnjs')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Revalider en background (stale-while-revalidate)
        fetch(request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response));
          }
        }).catch(() => {});
        return cached;
      }
      // Pas en cache — récupérer et stocker
      return fetch(request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Offline : page de fallback pour les navigations
        if (request.destination === 'document') {
          return caches.match('/pharma.html');
        }
      });
    })
  );
});

/* ── Notifications push ── */
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'PharmaLoc';
  const options = {
    body: data.body || 'Vous avez une nouvelle notification.',
    icon: 'https://via.placeholder.com/192x192/059669/ffffff?text=PL',
    badge: 'https://via.placeholder.com/72x72/059669/ffffff?text=PL',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/dashboard.html' },
    actions: [
      { action: 'open', title: 'Voir', icon: 'https://via.placeholder.com/32/059669/fff?text=>' },
      { action: 'close', title: 'Fermer' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow(event.notification.data.url || '/dashboard.html'));
  }
});

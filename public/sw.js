const STATIC_CACHE = 'youngo-hub-static-v2';
const DYNAMIC_CACHE = 'youngo-hub-dynamic-v2';
const CACHE_VERSION = 'v2';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-maskable-512.png'
];

// Cache strategies
const CACHE_STRATEGIES = {
  // Cache first, fallback to network
  cacheFirst: async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      return new Response('Offline', { status: 503 });
    }
  },

  // Network first, fallback to cache. Only use this for public app files.
  networkFirst: async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      return cached || new Response('Offline', { status: 503 });
    }
  },

};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - handle requests with appropriate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (except for fonts)
  if (url.origin !== location.origin && !url.pathname.match(/\.(woff2?|ttf|eot)$/)) {
    return;
  }

  // API responses can contain account, message, and staff data. Never persist
  // or replay them from a browser-wide cache, especially on shared devices.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(
        JSON.stringify({ error: { code: 'offline', message: 'Connect to the internet and try again.' } }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  // Static assets - cache first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|json)$/)) {
    event.respondWith(
      CACHE_STRATEGIES.cacheFirst(request, STATIC_CACHE)
    );
    return;
  }

  // Prefer fresh HTML, but keep the installed app shell available offline.
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => (
          await caches.match(request)
          || await caches.match('/')
          || new Response('Offline', { status: 503 })
        ))
    );
    return;
  }

  // Default: network first
  event.respondWith(
    CACHE_STRATEGIES.networkFirst(request, DYNAMIC_CACHE)
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  if (!event.data) {
    console.log('[SW] Push data empty');
    return;
  }

  const data = event.data.json();
  console.log('[SW] Push data:', data);

  const options = {
    body: data.body || 'New update from YOUNGO Hub',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: data.image,
    vibrate: [200, 100, 200],
    tag: data.tag || 'youngo-hub-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    data: data.data || { url: data.url || '/' },
    timestamp: data.timestamp || Date.now()
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'YOUNGO Hub', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();

  const data = event.notification.data || {};
  const url = data.url || '/';

  if (event.action === 'dismiss') {
    return;
  }

  // Handle action buttons
  if (event.action && event.action !== 'open') {
    // Custom action handling can be added here
    console.log('[SW] Custom action:', event.action);
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(url);
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
  // Track dismissal if needed
});

// Message event - communicate with clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }

  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      Promise.all(names.map((name) => caches.delete(name)));
    });
  }
});

// Background sync for offline actions (optional)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'push-subscription-sync') {
    event.waitUntil(syncPushSubscription());
  }
});

async function syncPushSubscription() {
  // Sync push subscription with server when back online
  try {
    const registration = await self.registration.pushManager.getSubscription();
    if (registration) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(registration)
      });
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

async function syncContent() {
  // Sync content when on WiFi
  console.log('[SW] Periodic content sync');
}

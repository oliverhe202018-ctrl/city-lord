const CACHE_NAME = 'amap-tiles-v1';

// AMap tile domains
const TILE_DOMAINS = [
  'wprd01.is.autonavi.com',
  'wprd02.is.autonavi.com',
  'wprd03.is.autonavi.com',
  'wprd04.is.autonavi.com',
  'webrd01.is.autonavi.com',
  'webrd02.is.autonavi.com',
  'webrd03.is.autonavi.com',
  'webrd04.is.autonavi.com',
  'webst01.is.autonavi.com',
  'webst02.is.autonavi.com',
  'webst03.is.autonavi.com',
  'webst04.is.autonavi.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if it's an AMap tile request
  if (TILE_DOMAINS.includes(url.hostname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          // Cache hit - return response
          if (response) {
            return response;
          }
          
          // Cache miss - fetch and cache
          return fetch(event.request)
            .then((networkResponse) => {
              // Store a copy in cache. AMap tiles might be opaque (status 0).
              if (networkResponse.status === 200 || networkResponse.type === 'opaque') {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Return offline fallback if network fails
              // We could return a transparent empty tile here
              return new Response(new Blob([''], { type: 'image/png' }), {
                status: 200,
                headers: { 'Content-Type': 'image/png' }
              });
            });
        });
      })
    );
  }
});

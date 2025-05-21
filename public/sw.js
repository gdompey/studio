// public/sw.js
const CACHE_NAME = 'iasl-ec-manager-cache-v2'; // Incremented cache version
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other critical assets like global CSS, main JS chunks if identifiable
  // Be cautious adding too many or very large files that change often
];

// Install event: precache core assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Precaching complete, activating...');
        return self.skipWaiting(); // Force activation of new service worker
      })
      .catch(error => {
        console.error('[Service Worker] Precaching failed:', error);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients...');
      return self.clients.claim(); // Take control of open clients
    })
  );
});

// Fetch event: serve from cache, fallback to network, then offline page
self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests for assets and pages.
  // API calls (especially POST, PUT, DELETE) should not be cached here by default.
  // Also, skip caching for chrome-extension URLs
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // Only attempt to cache GET requests.
  if (event.request.method !== 'GET') {
    // For non-GET requests, just fetch from the network.
    // Do not attempt to cache.
    event.respondWith(fetch(event.request));
    return;
  }

  // For GET requests, try cache-then-network strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Cache hit - return response
        if (cachedResponse) {
          // console.log('[Service Worker] Returning from cache:', event.request.url);
          return cachedResponse;
        }

        // Not in cache - fetch from network
        // console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request).then(
          (networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              // If not a valid response (e.g. opaque, error), don't cache it.
              // Opaque responses (type 'opaque') are for cross-origin requests made with no-cors.
              // We can't know if they were successful, so caching them is risky.
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                // Only cache GET requests and ensure the URL scheme is http/https
                if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
                   // console.log('[Service Worker] Caching new resource:', event.request.url);
                   cache.put(event.request, responseToCache);
                }
              });

            return networkResponse;
          }
        ).catch(() => {
          // Network request failed, try to serve offline page for navigation requests
          // console.log('[Service Worker] Network fetch failed for:', event.request.url);
          if (event.request.mode === 'navigate') {
            // console.log('[Service Worker] Serving offline.html for navigation failure.');
            return caches.match('/offline.html');
          }
          // For other types of requests (e.g., images, scripts), if they fail and are not in cache,
          // there's not much else to do other than let the browser handle the error.
        });
      })
  );
});

// public/sw.js
const CACHE_NAME = 'iasl-ec-manager-cache-v1';
const urlsToCache = [
  '/',
  '/offline.html', // A fallback page for offline
  // Add other important assets like CSS, JS bundles if not handled by Next.js PWA plugins
  // For Next.js, asset paths can be dynamic, so this might need a more sophisticated setup
  // or reliance on runtime caching for specific assets.
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] Failed to cache app shell:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // console.log('[Service Worker] Fetching', event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloadResponse = await event.preloadResponse;
          if (preloadResponse) {
            return preloadResponse;
          }
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          console.log('[Service Worker] Fetch failed; returning offline page instead.', error);
          const cache = await caches.open(CACHE_NAME);
          // Ensure 'offline.html' exists and is cached.
          // If not, provide a very basic fallback.
          const cachedResponse = await cache.match('/offline.html');
          if (cachedResponse) return cachedResponse;
          
          // Basic fallback if offline.html is not cached
          return new Response("<h1>You are offline</h1><p>Please check your internet connection.</p>", {
            headers: { 'Content-Type': 'text/html' }
          });
        }
      })()
    );
  } else if (urlsToCache.includes(event.request.url) || event.request.destination === 'style' || event.request.destination === 'script') {
    // Cache-First strategy for static assets
     event.respondWith(
        caches.match(event.request)
            .then((response) => {
                return response || fetch(event.request).then((fetchResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        // Don't cache non-GET requests or opaque responses (e.g. from CDNs without CORS)
                        if (event.request.method === 'GET' && fetchResponse.type === 'basic') {
                           cache.put(event.request, fetchResponse.clone());
                        }
                        return fetchResponse;
                    });
                });
            })
    );
  }
  // For other requests (like API calls to Firebase), let them pass through.
  // More sophisticated caching strategies for API data can be added here if needed.
});

// Optional: Listen for messages from the client (e.g., to skip waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// public/sw.js
const CACHE_NAME = 'iasl-ec-manager-cache-v1';
const urlsToCache = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  // Add other critical static assets: CSS, JS bundles, fonts if self-hosted
  // Be cautious about adding too many files or files that change frequently with hashes
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Add essential app shell files
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Failed to open cache or add urls during install:', err);
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Let the browser handle requests for scripts from extensions.
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // IMPORTANT: Clone the request. A request is a stream and
        // can only be consumed once. Since we are consuming this
        // once by cache and once by the browser for fetch, we need
        // to clone the response.
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response
            // Also ensure we only cache responses from http/https protocols
            if (!response || response.status !== 200 || response.type !== 'basic' || 
                !event.request.url.startsWith('http')) {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch(err => {
                console.error('SW: Failed to cache response for', event.request.url, err);
              });

            return response;
          }
        ).catch(() => {
          // Network request failed, try to serve offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          // For other types of requests (e.g., API calls, images),
          // if they fail and are not in cache, let the browser handle the error.
          // You might want to return a placeholder image or a specific error response here for certain asset types.
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

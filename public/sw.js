const CACHE_VERSION = '2026-08-26-v3.4';
const APP_SHELL_CACHE = `minizoo-app-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `minizoo-static-${CACHE_VERSION}`;
const MEDIA_CACHE = `minizoo-media-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `minizoo-dynamic-${CACHE_VERSION}`;

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const STATIC_EXT_RE = /\.(?:js|css|png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|otf)$/i;
const MEDIA_EXT_RE = /\.(?:mp3|wav|ogg|glb|gltf|obj|mtl|bin)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const appShell = await caches.open(APP_SHELL_CACHE);
    await appShell.addAll(APP_SHELL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const expectedCaches = new Set([APP_SHELL_CACHE, STATIC_CACHE, MEDIA_CACHE, DYNAMIC_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if (!expectedCaches.has(key)) {
        return caches.delete(key);
      }
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const network = await fetch(request);
  if (network.ok) {
    cache.put(request, network.clone()).catch(() => {});
  }
  return network;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((network) => {
      if (network.ok) {
        cache.put(request, network.clone()).catch(() => {});
      }
      return network;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => null);
    return cached;
  }

  const network = await networkPromise;
  return network || Response.error();
}

async function networkFirst(request, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);
  try {
    const network = await fetch(request);
    if (network.ok) {
      cache.put(request, network.clone());
    }
    return network;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackPath) {
      const fallback = await caches.match(fallbackPath);
      if (fallback) return fallback;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Vite source modules must always come from the dev server. Caching one
  // old module can make named exports disagree during hot reload.
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE, '/index.html'));
    return;
  }

  if (STATIC_EXT_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (MEDIA_EXT_RE.test(url.pathname) || url.pathname.startsWith('/models/') || url.pathname.startsWith('/audio/')) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

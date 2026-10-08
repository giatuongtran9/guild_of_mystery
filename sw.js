// Cache only content-versioned public assets. Documents and manifests stay fresh.
'use strict';
const scope = new URL(self.registration.scope);
const cacheName = 'guild-of-mystery:runtime-v1:' + scope.pathname;

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('Authorization') || request.headers.has('Range')) return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  const immutable = /^data\/assets\/runtime\/characters\/[a-z_]+\/[a-z_]+_(?:seq[0-9]|mythical)\.(192|384)\.[a-f0-9]{16}\.(webp|png)$/.test(path)
    || /^data\/assets\/characters\/[a-z][a-z0-9_]*\/[a-z][a-z0-9_]*_(?:seq[0-9]|mythical)\.png$/.test(path) && /^\?v=[a-f0-9]{16}$/.test(url.search)
    || /^data\/runtime\/data\.[a-f0-9]{16}\.json$/.test(path)
    || (/^js\/(data-loader|boot|paths|v15|generate|engine|state|campaign|ui)\.js$/.test(path)
      || /^css\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.css$/.test(path)) && /^[a-f0-9]{16}$/.test(url.searchParams.get('v') || '');
  if (!immutable) return;
  event.respondWith((async () => {
    let cache;
    try {
      cache = await caches.open(cacheName);
      const saved = await cache.match(request);
      if (saved) return saved;
    } catch (_) { /* Storage denial must not stop the game. */ }
    const response = await fetch(request);
    if (cache && response.status === 200) {
      try { await cache.put(request, response.clone()); } catch (_) { /* Keep the live response on quota failure. */ }
    }
    return response;
  })());
});

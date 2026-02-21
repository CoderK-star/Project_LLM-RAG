const CACHE_NAME = 'gca-cache-v1';

// UIシェルのキャッシュ対象
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/web.js',
  '/manifest.json',
];

// インストール: UIシェルをキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// アクティベーション: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// フェッチ: Network-first (APIリクエストはキャッシュしない)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Cross-origin requests (API on a different domain) are never cached
  if (url.origin !== self.location.origin) {
    return;
  }

  // Same-origin API paths are also not cached
  if (
    url.pathname.startsWith('/query') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/config') ||
    url.pathname.startsWith('/ingest') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 静的アセット: Cache-first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // 成功したらキャッシュを更新
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // ネットワーク失敗時はキャッシュから返す
        return cached;
      });

      // キャッシュがあればすぐ返し、バックグラウンドで更新
      return cached || fetchPromise;
    })
  );
});

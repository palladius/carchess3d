/**
 * @fileoverview Offline-First Service Worker (`sw.js`) for CarChess3D PWA.
 *
 * - Network-First with `{ cache: 'reload' }` for all HTML/JS/manifest code so online loads
 *   on GitHub Pages (`max-age=600`) always fetch the latest version without stale cache traps.
 * - Lightweight core precache on `install` (no 35 MB `.glb`/`.mp3` install storm on mobile GPUs),
 *   while lazy-caching portraits, `.glb` models, and audio assets (`chess-strings-theme.mp3`,
 *   `chess-strings-bg.mp3`, `combat-suspense.mp3`, `checkmate-jingle.mp3`, `voice-*.mp3`) on demand for offline play.
 */

const CACHE_NAME = 'carchess3d-offline-v45';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/chess.js',
  './vendor/three/three.module.js',
  './vendor/three/addons/controls/OrbitControls.js',
  './vendor/three/addons/loaders/GLTFLoader.js',
  './vendor/three/addons/utils/SkeletonUtils.js',
  './vendor/three/addons/postprocessing/EffectComposer.js',
  './vendor/three/addons/postprocessing/RenderPass.js',
  './vendor/three/addons/postprocessing/UnrealBloomPass.js',
  './vendor/three/addons/postprocessing/OutputPass.js',
  './src/main.js',
  './src/utils/glbGrounding.js',
  './src/core/EventBus.js',
  './src/core/GameLoop.js',
  './src/core/Registry.js',
  './src/core/BattleMatrix36.js',
  './src/core/Rng.js',
  './src/ai/worker.js',
  './src/managers/GameFlowManager.js',
  './src/managers/BoardMapManager.js',
  './src/managers/PieceManager.js',
  './src/managers/CombatAnimationManager.js',
  './src/managers/DropManager.js',
  './src/managers/AIWorkerManager.js',
  './src/views/ZurichSwampView.js',
  './src/views/SkeletonRigHelper.js',
  './src/views/PieceClarityHelper.js',
  './src/views/PieceView.js',
  './src/views/BoardInteractionView.js',
  './src/views/VFXPoolView.js',
  './src/views/VeoCinemaView.js',
  './src/views/WowModeView.js',
  './src/views/DebugPanelView.js',
  './src/listeners/HudListener.js',
  './src/listeners/AudioListener.js',
  './src/listeners/ProfileStorageListener.js',
  './docs/logo/logo.svg',
  './assets/environments/zurich_panorama.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) => {
            const req = new Request(url, { cache: 'reload' });
            return cache.add(req).catch(() => {
              // Ignore optional assets during precache
            });
          }),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Never intercept Range requests or large video streams (prevents 206 Partial Content breaks on mobile)
  if (event.request.headers.get('range')) return;

  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;
  if (reqUrl.pathname.endsWith('.mp4') || reqUrl.pathname.endsWith('.webm')) return;

  // Never cache VERSION or nocache.html / ?nocache=1 in Service Worker
  if (
    reqUrl.pathname.endsWith('/VERSION') ||
    reqUrl.pathname === 'VERSION' ||
    reqUrl.pathname.endsWith('nocache.html') ||
    reqUrl.searchParams.get('nocache') === '1' ||
    reqUrl.searchParams.get('fresh') === '1'
  ) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(
        () => new Response('', { status: 404, statusText: 'Offline' }),
      ),
    );
    return;
  }

  const isCodeOrDoc =
    event.request.mode === 'navigate' ||
    reqUrl.pathname.endsWith('/') ||
    reqUrl.pathname.endsWith('.html') ||
    reqUrl.pathname.endsWith('.js') ||
    reqUrl.pathname.endsWith('.mjs') ||
    reqUrl.pathname.endsWith('.webmanifest');

  if (isCodeOrDoc) {
    // Network-First with cache: 'reload' so online loads always bypass GitHub Pages 10-min HTTP disk cache
    event.respondWith(
      fetch(event.request, { cache: 'reload' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() =>
          caches
            .match(event.request, { ignoreSearch: true })
            .then((cached) => cached || new Response('', { status: 404, statusText: 'Offline' })),
        ),
    );
    return;
  }

  // Static binary assets (.glb, .jpg, .mp3, .svg): Cache-First, only fetching from network on a cache miss!
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => new Response('', { status: 404, statusText: 'Offline Not Cached' }));
    }),
  );
});

/**
 * @fileoverview Offline-First Service Worker (`sw.js`) for CarChess3D PWA.
 *
 * Pre-caches core HTML, ES modules, vendored Three.js + chess.js, 2D cutie
 * character portraits, and canonical 3D `.glb` models so Ale & Seby can play
 * 100% offline on a plane or train after first load.
 */

const CACHE_NAME = 'carchess3d-offline-v11';

const PRECACHE_URLS = [
  './',
  './index.html',
  './battles.html',
  './progress.html',
  './manifest.webmanifest',
  './vendor/chess.js',
  './vendor/three/three.module.js',
  './vendor/three/addons/controls/OrbitControls.js',
  './vendor/three/addons/loaders/GLTFLoader.js',
  './vendor/three/addons/utils/SkeletonUtils.js',
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
  './src/views/PieceView.js',
  './src/views/BoardInteractionView.js',
  './src/views/VFXPoolView.js',
  './src/views/VeoCinemaView.js',
  './src/views/WowModeView.js',
  './src/views/DebugPanelView.js',
  './src/listeners/HudListener.js',
  './src/listeners/AudioListener.js',
  './src/listeners/ProfileStorageListener.js',
  './assets/characters/king-riccardo-1.jpg',
  './assets/characters/queen-kate-4.jpg',
  './assets/characters/bishop-ale-1.jpg',
  './assets/characters/knight-seby-4.jpg',
  './assets/characters/rook-pupurabbu.jpg',
  './assets/characters/pawn-puffin.jpg',
  './assets/characters/king-swamp-orco.jpg',
  './assets/characters/queen-swamp-orchessa.jpg',
  './assets/characters/bishop-swamp-focaccina.jpg',
  './assets/characters/bishop-swamp-gatto.jpg',
  './assets/characters/knight-swamp-asinello.jpg',
  './assets/characters/rook-swamp-draghessa.jpg',
  './assets/characters/pawn-swamp-tappo.jpg',
  './assets/characters/pawn-swamp-focaccina.jpg',
  './assets/characters/pawn-swamp-porcellini.jpg',
  './assets/characters/pawn-swamp-zenzy.jpg',
  './assets/models/king-riccardo.glb',
  './assets/models/queen-kate.glb',
  './assets/models/bishop-ale-rigged.glb',
  './assets/models/bishop-ale-1.glb',
  './assets/models/knight-seby.glb',
  './assets/models/rook-pupurabbu.glb',
  './assets/models/pawn-puffin.glb',
  './assets/audio/voices/voice-k.mp3',
  './assets/audio/voices/voice-q.mp3',
  './assets/audio/voices/voice-b.mp3',
  './assets/audio/voices/voice-n.mp3',
  './assets/audio/voices/voice-r.mp3',
  './assets/audio/voices/voice-p.mp3',
  './docs/logo/logo.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch(() => {
              // Ignore optional assets during precache
            }),
          ),
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
  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  const isCodeOrDoc =
    event.request.mode === 'navigate' ||
    reqUrl.pathname.endsWith('/') ||
    reqUrl.pathname.endsWith('.html') ||
    reqUrl.pathname.endsWith('.js') ||
    reqUrl.pathname.endsWith('VERSION');

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return isCodeOrDoc ? networkFetch.then((res) => res || cachedResponse) : cachedResponse || networkFetch;
    }),
  );
});

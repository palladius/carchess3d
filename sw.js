/**
 * @fileoverview Offline-First Service Worker (`sw.js`) for CarChess3D PWA.
 *
 * Pre-caches core HTML, ES modules, vendored Three.js + chess.js, 2D cutie
 * character portraits, and canonical 3D `.glb` models so Ale & Seby can play
 * 100% offline on a plane or train after first load.
 */

const CACHE_NAME = 'carchess3d-offline-v23';

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
  './assets/audio/combat-suspense.mp3',
  './assets/audio/voices/voice-k.mp3',
  './assets/audio/voices/voice-k-hmm.mp3',
  './assets/audio/voices/voice-q.mp3',
  './assets/audio/voices/voice-q-mcmuffin.mp3',
  './assets/audio/voices/voice-q-loveme.mp3',
  './assets/audio/voices/voice-q-hmm.mp3',
  './assets/audio/voices/voice-q-sbuffo.mp3',
  './assets/audio/voices/voice-b.mp3',
  './assets/audio/voices/voice-b-timanco.mp3',
  './assets/audio/voices/voice-b-piuforte.mp3',
  './assets/audio/voices/voice-b-regalo.mp3',
  './assets/audio/voices/voice-b-cafonazzo.mp3',
  './assets/audio/voices/voice-b-hmm.mp3',
  './assets/audio/voices/voice-b-sbuffo.mp3',
  './assets/audio/voices/voice-n.mp3',
  './assets/audio/voices/voice-n-papinooo.mp3',
  './assets/audio/voices/voice-n-timanco.mp3',
  './assets/audio/voices/voice-n-mybody.mp3',
  './assets/audio/voices/voice-n-cacca.mp3',
  './assets/audio/voices/voice-n-hmm.mp3',
  './assets/audio/voices/voice-n-sbuffo.mp3',
  './assets/audio/voices/voice-r.mp3',
  './assets/audio/voices/voice-r-hmm.mp3',
  './assets/audio/voices/voice-p.mp3',
  './assets/audio/voices/voice-p-hmm.mp3',
  './docs/logo/logo.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) => {
            const isCode =
              url === './' ||
              url.endsWith('.html') ||
              url.endsWith('.js') ||
              url.endsWith('.webmanifest');
            const req = new Request(url, { cache: isCode ? 'no-cache' : 'default' });
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
  const reqUrl = new URL(event.request.url);
  if (reqUrl.origin !== self.location.origin) return;

  // Never cache VERSION in Service Worker: it is our live truth probe to detect version drift!
  if (reqUrl.pathname.endsWith('/VERSION') || reqUrl.pathname === 'VERSION') {
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
    reqUrl.pathname.endsWith('.webmanifest');

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // For HTML/JS, bypass browser HTTP disk cache (max-age=600 on GitHub Pages) via 'no-cache'
      // so online loads always validate ETag and fetch fresh code immediately after a push!
      const fetchOpts = isCodeOrDoc ? { cache: 'no-cache' } : {};
      const networkFetch = fetch(event.request, fetchOpts)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return (
        isCodeOrDoc
          ? networkFetch.then((res) => res || cachedResponse)
          : Promise.resolve(cachedResponse || networkFetch)
      ).then((res) => res || new Response('', { status: 404, statusText: 'Offline Not Cached' }));
    }),
  );
});

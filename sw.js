/* sw.js — met en cache toute l'application au premier chargement,
   puis sert tout depuis le cache : fonctionnement 100 % hors ligne. */

const CACHE = 'classeqcm-v6'; // Incrémenter à chaque mise à jour de l'app.

const FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/storage.js',
  './js/io.js',
  './js/editor.js',
  './js/roster.js',
  './js/cards.js',
  './js/scan.js',
  './js/share.js',
  './js/projection.js',
  './js/results.js',
  './lib/peerjs.min.js',
  './lib/lz-string.min.js',
  './lib/qrcode.js',
  './lib/cv.js',
  './lib/aruco.js',
  './lib/jspdf.umd.min.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request))
  );
});

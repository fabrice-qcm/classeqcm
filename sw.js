/* sw.js — met en cache toute l'application au premier chargement,
   puis sert tout depuis le cache : fonctionnement 100 % hors ligne. */

const CACHE = 'classeqcm-v14'; // Incrémenter à chaque mise à jour de l'app.

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
  './lib/xlsx.full.min.js',
  './js/mathtext.js',
  './lib/katex/katex.min.js',
  './lib/katex/katex.min.css',
  './lib/katex/fonts/KaTeX_AMS-Regular.woff2',
  './lib/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  './lib/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  './lib/katex/fonts/KaTeX_Fraktur-Bold.woff2',
  './lib/katex/fonts/KaTeX_Fraktur-Regular.woff2',
  './lib/katex/fonts/KaTeX_Main-Bold.woff2',
  './lib/katex/fonts/KaTeX_Main-BoldItalic.woff2',
  './lib/katex/fonts/KaTeX_Main-Italic.woff2',
  './lib/katex/fonts/KaTeX_Main-Regular.woff2',
  './lib/katex/fonts/KaTeX_Math-BoldItalic.woff2',
  './lib/katex/fonts/KaTeX_Math-Italic.woff2',
  './lib/katex/fonts/KaTeX_SansSerif-Bold.woff2',
  './lib/katex/fonts/KaTeX_SansSerif-Italic.woff2',
  './lib/katex/fonts/KaTeX_SansSerif-Regular.woff2',
  './lib/katex/fonts/KaTeX_Script-Regular.woff2',
  './lib/katex/fonts/KaTeX_Size1-Regular.woff2',
  './lib/katex/fonts/KaTeX_Size2-Regular.woff2',
  './lib/katex/fonts/KaTeX_Size3-Regular.woff2',
  './lib/katex/fonts/KaTeX_Size4-Regular.woff2',
  './lib/katex/fonts/KaTeX_Typewriter-Regular.woff2',

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

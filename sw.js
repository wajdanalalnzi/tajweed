/* عامل الخدمة: يخزّن ملفات التطبيق للعمل دون اتصال، وسور المصحف بعد أول زيارة لها. التلاوات تُحمَّل من الشبكة دائمًا. */
/*
 * sw.js — Service worker (registered at the end of js/app.js, only over http/https).
 *
 * Strategy: network first, cache as fallback. Every same-origin request is
 * fetched from the network and the response is copied into the cache; when
 * offline, the cached copy is served (or index.html for unknown pages).
 * So users always get the latest files when online, and the app still works
 * offline after one visit.
 *
 * Cross-origin requests (everyayah.com audio) are not touched at all.
 * data/mushaf/NNN.json surah files are cached the same way the first time a surah is opened.
 *
 * When you add a new file the app needs offline, add it to SHELL so it is
 * cached at install time. Changing CACHE (e.g. 'tajweed-v2') makes the next
 * activation delete the old cache.
 */
const CACHE = 'tajweed-v8';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/fonts.css', './css/app.css',
  './js/data/rules.js', './js/data/chapters.js', './js/data/quizzes.js', './js/data/glossary.js',
  './js/store.js', './js/ayah.js', './js/mushaf.js', './js/app.js', './icons/icon.svg', './icons/favicon.svg', './data/mushaf/index.json',
  './fonts/amiri-quran-400-arabic.woff2', './fonts/amiri-400-arabic.woff2', './fonts/amiri-700-arabic.woff2',
  './fonts/noto-naskh-arabic-400-arabic.woff2', './fonts/noto-naskh-arabic-700-arabic.woff2',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // التلاوات والخطوط الخارجية من الشبكة
  e.respondWith(
    fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

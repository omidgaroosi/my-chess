/* sw.js — دو کار مهم:
   1) تزریق هدرهای COOP/COEP تا استاک‌فیش (SharedArrayBuffer) روی هر هاستی کار کند
   2) کش‌کردن فایل‌ها برای اجرای آفلاین (PWA) */
const CACHE = 'chess-cache-v5';
const PRECACHE = ['./', './chess.html', './coach.js', './openings-data.js',
  './learn-data-1.js', './learn-data-2.js', './learn-data-3.js',
  './learn-data-4.js', './learn-data-5.js', './learn-data-6.js',
  './stockfish-19.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let res = await cache.match(req);
    if (!res) {
      try { res = await fetch(req); }
      catch (err) {
        return new Response('آفلاین است و این فایل در کش نیست.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
      if (res && res.ok) cache.put(req, res.clone()); // کش خودکار (از جمله wasm 90 مگابایتی)
    }
    // هدرهای لازم برای استاک‌فیش:
    try {
      const h = new Headers(res.headers);
      h.set('Cross-Origin-Embedder-Policy', 'require-corp');
      h.set('Cross-Origin-Opener-Policy', 'same-origin');
      h.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
    } catch (err) { return res; }
  })());
});
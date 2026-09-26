/* sw.js — نسخه ۷: نصب مقاوم + network-first + هدرهای امنیتی استاک‌فیش */
const CACHE = 'chess-cache-v7';
const PRECACHE = ['./chess.html', './coach.js', './openings-data.js',
  './learn-data-1.js', './learn-data-2.js', './learn-data-3.js',
  './learn-data-4.js', './learn-data-5.js', './learn-data-6.js',
  './stockfish-19.js', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(PRECACHE.map(u => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withCOI(res){
  try{
    const h = new Headers(res.headers);
    h.set('Cross-Origin-Embedder-Policy', 'require-corp');
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return new Response(res.body, {status: res.status, statusText: res.statusText, headers: h});
  }catch(e){ return res; }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // موتور ۹۴ مگابایتی: اول از کش (سرعت)
    if (url.pathname.endsWith('.wasm')) {
      const hit = await cache.match(req);
      if (hit) return withCOI(hit);
    }
    // بقیه: اول شبکه (نسخهٔ تازه)، در آفلاین از کش
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return withCOI(res);
    } catch (err) {
      const hit = await cache.match(req);
      if (hit) return withCOI(hit);
      return new Response('آفلاین است و این فایل در کش نیست.', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    }
  })());
});
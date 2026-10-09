/* ============================================================
   sw.js — Service Worker برای PWA شطرنج با استاک‌فیش
   ------------------------------------------------------------
   تغییرات نسخهٔ v10:
   - stockfish-19.js و stockfish-19.wasm از precache حذف شدند
     (چون ۹۴MB حجم دارند و نصب SW را کند می‌کنند)
   - این فایل‌ها هنگام اولین درخواست، cache-first ذخیره می‌شوند
   ============================================================ */

const CACHE = 'chess-cache-v14';

/* فایل‌های کوچک و ضروری — هنگام نصب SW کش می‌شوند */
const PRECACHE = [
  './chess.html',
  './index.html',
  './learn.html',
  './openings.html',
  './storage.js',
  './pgn.js',
  './games-data.js',
  './pgn-loader.js',
  './coach-patterns.js',
  './coach-analyzer.js',
  './coach.js',
  './learn-data-1.js',
  './learn-data-2.js',
  './learn-data-3.js',
  './learn-data-4.js',
  './learn-data-5.js',
  './learn-data-6.js',
  './openings-data.js',
  './puzzles-data.js',
  './books-data.js',
  './books-et-2.js',
  './books-et-3b.js',
  './books-et-4.js',
  './books-et-5.js',
  './books-et-6.js',
  './books-et-7.js',
  './books-et-8.js',
  './books-et-9.js',
  './books-et-10.js',
  './books-et-11.js', 
  './books-et-12.js', 
  './books-et-13.js',
  './books-et-14.js',
  './books-et-15.js',
  './books-et-16.js',        
  './puzzle-editor.js',
  './live-lessons.js',
  './themes.js',
  './pieces.js',
  './rating.js',
  './lesson-board.js',
  './manifest.webmanifest',
  './icon.svg'
];

/* نصب: کش کردن فایل‌های ضروری */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(PRECACHE.map(u => c.add(u)))
    ).then(() => self.skipWaiting())
  );
});

/* فعال‌سازی: پاک کردن کش‌های قدیمی */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* تزریق هدرهای COOP/COEP به همهٔ پاسخ‌ها */
function withCOI(res){
  try{
    const h = new Headers(res.headers);
    h.set('Cross-Origin-Embedder-Policy', 'require-corp');
    h.set('Cross-Origin-Opener-Policy', 'same-origin');
    h.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: h
    });
  }catch(e){ return res; }
}

/* استراتژی fetch */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* استاک‌فیش و WASM: cache-first (چون حجم بالا و تغییر نمی‌کنند) */
  if (url.pathname.endsWith('.wasm') || url.pathname.includes('stockfish')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return withCOI(hit);
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return withCOI(res);
      } catch (err) {
        return new Response('موتور آفلاین در دسترس نیست.', {
          status: 503,
          headers: {'Content-Type': 'text/plain; charset=utf-8'}
        });
      }
    })());
    return;
  }

  /* بقیهٔ فایل‌ها: network-first با fallback به cache */
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return withCOI(res);
    } catch (err) {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return withCOI(hit);
      return new Response('آفلاین است و این فایل در کش نیست.', {
        status: 503,
        headers: {'Content-Type': 'text/plain; charset=utf-8'}
      });
    }
  })());
});
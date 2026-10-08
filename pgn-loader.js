"use strict";
/* ============================================================
   📚 pgn-loader.js — بارگذار خودکار کتابخانهٔ PGN
   ------------------------------------------------------------
   - پارس فایل PGN چندبازی (یک فایل با N بازی)
   - دسته‌بندی خودکار: Event → Opening → ECO → سال
   - ذخیره‌سازی در localStorage با محدودیت هوشمند
   - ادغام با GAMES_DB اصلی (بدون تغییر فایل‌های دیگر)
   ساخته شده توسط امید گروسی
   ============================================================ */

window.PGNLoader = (() => {

  const STORAGE_KEY = 'chess.pgn.library.v1';
  const MAX_GAMES = 250;   /* سقف تعداد بازی‌های ذخیره‌شده */

  /* ---------- حذف variationهای تودرتو ---------- */
  function stripVariations(text) {
    let depth = 0, out = '';
    for(const ch of text) {
      if(ch === '(') depth++;
      else if(ch === ')') depth = Math.max(0, depth - 1);
      else if(depth === 0) out += ch;
    }
    return out;
  }

  /* ---------- تعیین دستهٔ خودکار ---------- */
  function categoryOf(headers) {
    const ev = (headers.Event || '').trim();
    if(ev && ev !== '?' && ev.length < 80) return ev;
    const op = (headers.Opening || '').trim();
    if(op && op !== '?') return 'گشایش: ' + op.slice(0, 60);
    const eco = (headers.ECO || '').trim();
    if(eco && eco !== '?') return 'ECO ' + eco;
    const d = (headers.Date || '').trim();
    const year = d.split('.')[0];
    if(year && year !== '????' && /^\d{4}$/.test(year)) return 'سال ' + year;
    return '📁 بارگذاری‌شده';
  }

  /* ---------- ساخت آبجکت بازی از هدرها + متن حرکات ---------- */
  function buildGame(headers, moveText) {
    let clean = stripVariations(moveText)
      .replace(/\{[^}]*\}/g, ' ')   /* کامنت‌ها */
      .replace(/;[^\n]*/g, ' ')      /* کامنت خطی */
      .replace(/\$\d+/g, ' ')        /* NAG مثل $1 */
      .replace(/\d+\.\.\./g, ' ')    /* "1..." */
      .replace(/\d+\./g, ' ')        /* "1." */
      .replace(/[?!]+/g, '')         /* ! ؟ */
      .replace(/\s+/g, ' ')
      .trim();

    const sans = clean.split(' ')
      .filter(t => t && !['1-0','0-1','1/2-1/2','*'].includes(t));

    if(sans.length < 2) return null;

    const w = headers.White || '?';
    const b = headers.Black || '?';
    const id = 'ext_' + Math.random().toString(36).slice(2, 9) +
               Date.now().toString(36).slice(-4);

    return {
      id,
      title: w + ' vs ' + b,
      white: w,
      black: b,
      event: headers.Event || '—',
      date: headers.Date || '—',
      result: headers.Result || '*',
      eco: headers.ECO || '',
      opening: headers.Opening || '',
      sans,
      categoryFA: categoryOf(headers),
      uploaded: true
    };
  }

  /* ---------- پارس فایل PGN چندبازی ---------- */
  function parseMultiPGN(text) {
    const lines = String(text).split(/\r?\n/);
    const games = [];
    let headers = {};
    let moveText = '';
    let inMoves = false;

    function flush() {
      if(!Object.keys(headers).length && !moveText.trim()) return;
      const g = buildGame(headers, moveText);
      if(g) games.push(g);
      headers = {};
      moveText = '';
      inMoves = false;
    }

    for(const line of lines) {
      const trimmed = line.trim();

      /* خط هدر؟ */
      const m = trimmed.match(/^\[(\w+)\s+"([^"]*)"\]\s*$/);
      if(m) {
        /* اگر قبلاً در فاز حرکات بودیم، بازی قبلی رو ببند */
        if(inMoves && moveText.trim()) flush();
        headers[m[1]] = m[2];
        continue;
      }

      /* خط خالی */
      if(!trimmed) {
        if(moveText.trim()) inMoves = true;
        continue;
      }

      /* خط حرکات */
      moveText += ' ' + trimmed;
      inMoves = true;
    }
    flush();
    return games;
  }

  /* ---------- ذخیره‌سازی ---------- */
  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(e) { return []; }
  }

  function save(games) {
    const existing = loadAll();

    /* کلید یکتایی: سفید|مشکی|تاریخ|۳ حرکت اول */
    const keyOf = g => [
      (g.white || '').trim().toLowerCase(),
      (g.black || '').trim().toLowerCase(),
      (g.date  || '').trim(),
      ((g.sans || []).slice(0, 3).join(','))
    ].join('|');

    const map = new Map();
    for(const g of existing) map.set(keyOf(g), g);
    let added = 0;
    for(const g of games) {
      const k = keyOf(g);
      if(!map.has(k)) added++;
      map.set(k, g);
    }

    const merged = [...map.values()];
    const limited = merged.slice(0, MAX_GAMES);
    const dropped = merged.length - limited.length;

    /* تلاش برای ذخیره */
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
      return { ok:true, total: limited.length, added, dropped };
    } catch(e) {
      /* حافظه پر است → نصف کن */
      const half = limited.slice(0, Math.floor(MAX_GAMES / 2));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
        return { ok:true, total: half.length, added, dropped: merged.length - half.length, warn:'فضای localStorage پر بود؛ نیمی از بازی‌ها نگه داشته شد.' };
      } catch(e2) {
        return { ok:false, error: e2.message || 'خطای ذخیره‌سازی' };
      }
    }
  }

  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch(e){}
  }

  function stats() {
    const arr = loadAll();
    const size = (() => {
      try { return (localStorage.getItem(STORAGE_KEY) || '').length; }
      catch(e) { return 0; }
    })();
    return { count: arr.length, bytes: size };
  }

  /* ---------- ادغام با GAMES_DB اصلی ---------- */
  function merge(baseGames) {
    const base = Array.isArray(baseGames) ? baseGames : [];
    const uploaded = loadAll();
    return base.concat(uploaded);
  }

  return {
    parseMultiPGN,
    save,
    clear,
    loadAll,
    stats,
    merge,
    MAX_GAMES
  };
})();
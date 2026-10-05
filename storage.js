"use strict";
/* ============================================================
   💾 storage.js — ذخیرهٔ خودکار، تاریخچه و آمار
   ------------------------------------------------------------
   ذخیره‌سازی در localStorage مرورگر. هیچ داده‌ای به سرور
   فرستاده نمی‌شود.
   ساخته شده توسط امید گروسی
   ============================================================ */

window.ChessStorage = (() => {
  const K_AUTO = 'chess.auto.v1';
  const K_HIST = 'chess.hist.v1';
  const K_OPTS = 'chess.opts.v1';
  const MAX_HIST = 30;

  const get = k => {
    try { return JSON.parse(localStorage.getItem(k)); }
    catch(e){ return null; }
  };
  const set = (k,v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch(e){ console.warn('storage full?', e); return false; }
  };
  const del = k => { try { localStorage.removeItem(k); } catch(e){} };

  return {
    /* ---------- ذخیرهٔ خودکار ---------- */
    autoSave(p)  { return set(K_AUTO, { ...p, _ts: Date.now() }); },
    autoLoad()   { return get(K_AUTO); },
    autoClear()  { del(K_AUTO); },
    hasAuto()    {
      const a = get(K_AUTO);
      return !!(a && Array.isArray(a.hist) && a.hist.length > 0 && !a.gameOver);
    },

    /* ---------- تاریخچه ---------- */
    histAll() {
      const a = get(K_HIST);
      return Array.isArray(a) ? a : [];
    },
    histAdd(r) {
      const arr = this.histAll();
      const entry = {
        id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        ts: Date.now(),
        ...r
      };
      arr.unshift(entry);
      while(arr.length > MAX_HIST) arr.pop();
      set(K_HIST, arr);
      return entry;
    },
    histDelete(id) { set(K_HIST, this.histAll().filter(g => g.id !== id)); },
    histClear()    { del(K_HIST); },

    /* ---------- آمار ---------- */
    stats() {
      const arr = this.histAll();
      const s = { total: arr.length, w:0, l:0, d:0, byLevel:{}, maxStreak:0 };
      let cur = 0;
      for(const g of arr){
        const lv = g.level ?? 0;
        s.byLevel[lv] = s.byLevel[lv] || { w:0, l:0, d:0, t:0 };
        s.byLevel[lv].t++;
        if(g.result === 'win'){
          s.w++; s.byLevel[lv].w++; cur++;
          if(cur > s.maxStreak) s.maxStreak = cur;
        } else if(g.result === 'loss'){
          s.l++; s.byLevel[lv].l++; cur = 0;
        } else {
          s.d++; s.byLevel[lv].d++; cur = 0;
        }
      }
      return s;
    },

    /* ---------- تنظیمات ---------- */
    optsSave(o) { return set(K_OPTS, o); },
    optsLoad()  { return get(K_OPTS) || {}; }
  };
})();
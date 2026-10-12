"use strict";
/* ============================================================
   📚 pgn-loader.js v2 — بارگذار PGN با گروه‌بندی فایل
   ------------------------------------------------------------
   - هر فایل آپلودشده یک گروه مستقل می‌شود
   - بازی‌های هر فایل از فایل‌های دیگر جدا هستند
   - فایل‌های جدید به انتهای لیست اضافه می‌شوند
   - مهاجرت خودکار از نسخهٔ قدیمی (v1)
   ساخته شده توسط امید گروسی
   ============================================================ */

window.PGNLoader = (() => {
  const KEY_V1 = 'chess.pgn.library.v1';   /* قدیمی */
  const KEY_V2 = 'chess.pgn.library.v2';   /* جدید */
  const MAX_GAMES_TOTAL = 500;
  const MAX_FILE_GROUPS = 30;

  /* ---------- حذف variationهای تودرتو ---------- */
  function stripVariations(text) {
    let depth = 0, out = '';
    for (const ch of text) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (depth === 0) out += ch;
    }
    return out;
  }

  /* ---------- دسته‌بندی خودکار (اگر هدر Event نبود) ---------- */
  function categoryOf(headers) {
    const ev = (headers.Event || '').trim();
    if (ev && ev !== '?' && ev.length < 80) return ev;
    const op = (headers.Opening || '').trim();
    if (op && op !== '?') return 'گشایش: ' + op.slice(0, 60);
    const eco = (headers.ECO || '').trim();
    if (eco && eco !== '?') return 'ECO ' + eco;
    const d = (headers.Date || '').trim();
    const year = d.split('.')[0];
    if (year && year !== '????' && /^\d{4}$/.test(year)) return 'سال ' + year;
    return 'بدون دسته';
  }

  /* ---------- ساخت آبجکت بازی از هدرها + متن ---------- */
  function buildGame(headers, moveText) {
    let clean = stripVariations(moveText)
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/;[^\n]*/g, ' ')
      .replace(/\$\d+/g, ' ')
      .replace(/\d+\.\.\./g, ' ')
      .replace(/\d+\./g, ' ')
      .replace(/[?!]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const sans = clean.split(' ')
      .filter(t => t && !['1-0', '0-1', '1/2-1/2', '*'].includes(t));

    if (sans.length < 2) return null;

    const w = headers.White || '?';
    const b = headers.Black || '?';
    const id = 'ext_' + Math.random().toString(36).slice(2, 9) +
               Date.now().toString(36).slice(-4);

    return {
      id,
      title: w + ' vs ' + b,
      white: w,
      black: b,
      whiteElo: headers.WhiteElo || '',
      blackElo: headers.BlackElo || '',
      event: headers.Event || '—',
      site: headers.Site || '',
      date: headers.Date || '—',
      round: headers.Round || '',
      result: headers.Result || '*',
      eco: headers.ECO || '',
      opening: headers.Opening || '',
      sans,
      categoryFA: categoryOf(headers),
      uploaded: true,
      fileGroupId: null,
      fileName: ''
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
      if (!Object.keys(headers).length && !moveText.trim()) return;
      const g = buildGame(headers, moveText);
      if (g) games.push(g);
      headers = {};
      moveText = '';
      inMoves = false;
    }

    for (const line of lines) {
      const trimmed = line.trim();
      const m = trimmed.match(/^\[(\w+)\s+"([^"]*)"\]\s*$/);
      if (m) {
        if (inMoves && moveText.trim()) flush();
        headers[m[1]] = m[2];
        continue;
      }
      if (!trimmed) {
        if (moveText.trim()) inMoves = true;
        continue;
      }
      moveText += ' ' + trimmed;
      inMoves = true;
    }
    flush();
    return games;
  }

  /* ---------- مهاجرت از v1 به v2 ---------- */
  function migrateV1() {
    try {
      const old = localStorage.getItem(KEY_V1);
      if (!old) return false;
      const games = JSON.parse(old);
      if (!Array.isArray(games) || !games.length) {
        localStorage.removeItem(KEY_V1);
        return false;
      }
      const groupId = 'legacy_' + Date.now().toString(36);
      const lib = { fileGroups: [{
        id: groupId,
        name: 'بارگذاری‌های قبلی',
        uploadedAt: Date.now(),
        count: games.length,
        games: games.map(g => ({ ...g, fileGroupId: groupId, fileName: 'بارگذاری‌های قبلی' }))
      }]};
      localStorage.setItem(KEY_V2, JSON.stringify(lib));
      localStorage.removeItem(KEY_V1);
      return true;
    } catch(e) {
      return false;
    }
  }

  /* ---------- خواندن کتابخانه ---------- */
  function loadLibrary() {
    try {
      const raw = localStorage.getItem(KEY_V2);
      if (raw) {
        const lib = JSON.parse(raw);
        if (lib && Array.isArray(lib.fileGroups)) return lib;
      }
      migrateV1();
      const raw2 = localStorage.getItem(KEY_V2);
      if (raw2) {
        const lib2 = JSON.parse(raw2);
        if (lib2 && Array.isArray(lib2.fileGroups)) return lib2;
      }
      return { fileGroups: [] };
    } catch(e) {
      return { fileGroups: [] };
    }
  }

  /* ---------- ذخیره ---------- */
  function saveLibrary(lib) {
    try {
      localStorage.setItem(KEY_V2, JSON.stringify(lib));
      return true;
    } catch(e) {
      /* فضای localStorage پر است: گروه‌های قدیمی را حذف کن */
      try {
        while (lib.fileGroups.length > 1) {
          lib.fileGroups.shift();
          try {
            localStorage.setItem(KEY_V2, JSON.stringify(lib));
            return true;
          } catch(e2) { continue; }
        }
        localStorage.removeItem(KEY_V2);
        return false;
      } catch(e3) {
        return false;
      }
    }
  }

  /* ---------- افزودن فایل جدید (به انتهای لیست) ---------- */
  function addFileGroup(fileName, games) {
    if (!games || !games.length) {
      return { ok: false, error: 'هیچ بازی‌ای برای ذخیره وجود ندارد' };
    }
    const lib = loadLibrary();
    const groupId = 'file_' + Date.now().toString(36) +
                    Math.random().toString(36).slice(2, 5);

    /* برچسب‌گذاری بازی‌ها */
    const taggedGames = games.map(g => ({
      ...g,
      fileGroupId: groupId,
      fileName: fileName || 'بدون نام'
    }));

    const group = {
      id: groupId,
      name: fileName || ('فایل ' + (lib.fileGroups.length + 1)),
      uploadedAt: Date.now(),
      count: taggedGames.length,
      games: taggedGames
    };

    /* ✅ به انتهای لیست اضافه می‌شود */
    lib.fileGroups.push(group);

    /* محدودیت تعداد گروه‌ها */
    while (lib.fileGroups.length > MAX_FILE_GROUPS) {
      lib.fileGroups.shift();
    }

    /* محدودیت کل بازی‌ها */
    let totalGames = lib.fileGroups.reduce((s, g) => s + g.games.length, 0);
    while (totalGames > MAX_GAMES_TOTAL && lib.fileGroups.length > 1) {
      const removed = lib.fileGroups.shift();
      totalGames -= removed.games.length;
    }

    const saved = saveLibrary(lib);
    return {
      ok: saved,
      group,
      total: lib.fileGroups.length,
      gamesSaved: taggedGames.length
    };
  }

  /* ---------- خواندن همه بازی‌ها (آرایهٔ تخت) ---------- */
  function getAllGames() {
    const lib = loadLibrary();
    const out = [];
    for (const group of lib.fileGroups) {
      for (const g of group.games) {
        out.push({
          ...g,
          fileGroupId: group.id,
          fileName: group.name,
          fileGroupName: group.name,
          fileGroupUploadedAt: group.uploadedAt
        });
      }
    }
    return out;
  }

  /* ---------- حذف یک گروه ---------- */
  function removeFileGroup(groupId) {
    const lib = loadLibrary();
    const before = lib.fileGroups.length;
    lib.fileGroups = lib.fileGroups.filter(g => g.id !== groupId);
    saveLibrary(lib);
    return before !== lib.fileGroups.length;
  }

  /* ---------- پاک کردن همه ---------- */
  function clear() {
    try {
      localStorage.removeItem(KEY_V1);
      localStorage.removeItem(KEY_V2);
    } catch(e) {}
  }

  /* ---------- آمار ---------- */
  function stats() {
    const lib = loadLibrary();
    let totalGames = 0;
    for (const g of lib.fileGroups) totalGames += g.games.length;
    let bytes = 0;
    try { bytes = (localStorage.getItem(KEY_V2) || '').length; } catch(e) {}
    return {
      fileGroups: lib.fileGroups.length,
      count: totalGames,
      bytes: bytes
    };
  }

  /* ---------- ادغام با GAMES_DB ---------- */
  function merge(baseGames) {
    const base = Array.isArray(baseGames) ? baseGames : [];
    return base.concat(getAllGames());
  }

  /* ---------- خروجی یک گروه به متن PGN ---------- */
  function exportGroupAsPGN(groupId) {
    const lib = loadLibrary();
    const group = lib.fileGroups.find(g => g.id === groupId);
    if (!group) return null;
    const parts = group.games.map(g => {
      const headers = [
        '[Event "' + (g.event || '?') + '"]',
        '[Site "' + (g.site || '?') + '"]',
        '[Date "' + (g.date || '????.??.??') + '"]',
        '[Round "' + (g.round || '-') + '"]',
        '[White "' + (g.white || '?') + '"]',
        '[Black "' + (g.black || '?') + '"]',
        '[Result "' + (g.result || '*') + '"]'
      ];
      if (g.eco) headers.push('[ECO "' + g.eco + '"]');
      if (g.opening) headers.push('[Opening "' + g.opening + '"]');
      let moves = '';
      for (let i = 0; i < g.sans.length; i++) {
        if (i % 2 === 0) moves += (Math.floor(i/2) + 1) + '. ';
        moves += g.sans[i] + ' ';
      }
      moves += g.result || '*';
      return headers.join('\n') + '\n\n' + moves;
    });
    return parts.join('\n\n');
  }

  /* ---------- API ---------- */
  return {
    parseMultiPGN,
    addFileGroup,
    getAllGames,
    loadLibrary,
    removeFileGroup,
    clear,
    stats,
    merge,
    exportGroupAsPGN,
    MAX_GAMES_TOTAL,
    MAX_FILE_GROUPS
  };
})();
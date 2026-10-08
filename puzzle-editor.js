"use strict";
/* ============================================================
   🔧 puzzle-editor.js — ابزار ویرایش و بررسی موقعیت پازل‌ها
   ------------------------------------------------------------
   - نمایش لیست کامل مهره‌ها و خانه‌هایشان
   - ویرایش FEN با اعتبارسنجی
   - ذخیره‌سازی override در localStorage
   ساخته شده توسط امید گروسی
   ============================================================ */

window.PuzzleEditor = (() => {

  const KEY = 'live-lessons-overrides';
  const FILES = 'abcdefgh';
  const PIECE_FA = {k:'شاه', q:'وزیر', r:'رخ', b:'فیل', n:'اسب', p:'پیاده'};
  const PIECE_GLYPH_W = {k:'♔', q:'♕', r:'♖', b:'♗', n:'♘', p:'♙'};
  const PIECE_GLYPH_B = {k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟'};
  const PIECE_ORDER = ['k','q','r','b','n','p'];

  /* ---------- ذخیره‌سازی ---------- */
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch(e) { return {}; }
  }
  function saveAll(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch(e){}
  }
  function getOverride(lessonId) { return loadAll()[lessonId] || null; }
  function setOverride(lessonId, data) {
    const all = loadAll();
    all[lessonId] = Object.assign({}, data, { ts: Date.now() });
    saveAll(all);
  }
  function clearOverride(lessonId) {
    const all = loadAll();
    delete all[lessonId];
    saveAll(all);
  }
  function hasOverride(lessonId) { return !!getOverride(lessonId); }
  function countOverrides() { return Object.keys(loadAll()).length; }

  function getEffectiveFen(lesson) {
    if(!lesson) return null;
    const o = getOverride(lesson.id);
    return (o && o.fen) || lesson.fen;
  }

  /* ---------- FEN ---------- */
  function parseFEN(fen) {
    const b = new Array(64).fill(null);
    let sq = 0;
    for(const ch of fen.split(' ')[0]) {
      if(ch === '/') continue;
      if(/\d/.test(ch)) sq += +ch;
      else b[sq++] = ch;
    }
    return b;
  }

  function validateFEN(fen) {
    if(!fen || typeof fen !== 'string') return 'FEN خالی است';
    const parts = fen.trim().split(/\s+/);
    if(parts.length < 2) return 'حداقل به ۲ بخش نیاز است: موقعیت + نوبت (w یا b)';
    const rows = parts[0].split('/');
    if(rows.length !== 8) return 'موقعیت باید ۸ ردیف داشته باشد (' + rows.length + ' ردیف پیدا شد)';
    for(let i = 0; i < rows.length; i++) {
      let count = 0;
      for(const ch of rows[i]) {
        if(/\d/.test(ch)) count += +ch;
        else if(/[prnbqkPRNBQK]/.test(ch)) count += 1;
        else return 'کاراکتر غیرمجاز در ردیف ' + (i+1) + ': «' + ch + '»';
      }
      if(count !== 8) return 'ردیف ' + (i+1) + ' باید مجموعاً ۸ خانه باشد (' + count + ' خانه پیدا شد)';
    }
    if(parts[1] !== 'w' && parts[1] !== 'b') return 'بخش دوم باید w (سفید) یا b (مشکی) باشد';
    /* بررسی شاه‌ها */
    const white = parts[0].split('').filter(c => c === 'K').length;
    const black = parts[0].split('').filter(c => c === 'k').length;
    if(white !== 1) return 'باید دقیقاً ۱ شاه سفید (K) داشته باشد (' + white + ' پیدا شد)';
    if(black !== 1) return 'باید دقیقاً ۱ شاه مشکی (k) داشته باشد (' + black + ' پیدا شد)';
    return null;
  }

  /* ---------- لیست مهره‌ها ---------- */
  function listPieces(fen) {
    const b = parseFEN(fen);
    const white = {}, black = {};
    for(const t of PIECE_ORDER) { white[t] = []; black[t] = []; }
    for(let i = 0; i < 64; i++) {
      const p = b[i];
      if(!p) continue;
      const isW = p === p.toUpperCase();
      const sq = FILES[i & 7] + (8 - (i >> 3));
      const t = p.toLowerCase();
      (isW ? white : black)[t].push(sq);
    }
    return { white, black };
  }

  function renderPieceListHTML(fen) {
    const { white, black } = listPieces(fen);
    function colHTML(pieces, glyphs) {
      let html = '';
      for(const t of PIECE_ORDER) {
        const list = pieces[t];
        if(!list.length) continue;
        html += '<div class="pl-row">' +
          '<span class="pl-glyph">' + glyphs[t] + '</span>' +
          '<span class="pl-name">' + PIECE_FA[t] + ':</span>' +
          '<span class="pl-squares" dir="ltr">' + list.join(' , ') + '</span>' +
        '</div>';
      }
      return html || '<div class="pl-empty">—</div>';
    }
    return '<div class="pl-two-col">' +
      '<div class="pl-col">' +
        '<div class="pl-header">⚪ سفید</div>' +
        colHTML(white, PIECE_GLYPH_W) +
      '</div>' +
      '<div class="pl-col">' +
        '<div class="pl-header">⚫ مشکی</div>' +
        colHTML(black, PIECE_GLYPH_B) +
      '</div>' +
    '</div>';
  }

  /* ---------- ویرایشگر FEN ---------- */
  function renderFENEditorHTML(lesson) {
    const effective = getEffectiveFen(lesson);
    const isOverridden = hasOverride(lesson.id);
    const original = lesson.fen;
    return '<div class="fe-wrap">' +
      (isOverridden ? '<div class="fe-badge">✏️ این موقعیت ویرایش شده است</div>' : '') +
      '<label class="fe-label">موقعیت FEN (قابل ویرایش):</label>' +
      '<textarea class="fe-textarea" id="feTextarea" rows="3" spellcheck="false" dir="ltr">' + effective + '</textarea>' +
      '<div class="fe-validation" id="feValidation"></div>' +
      '<div class="fe-actions">' +
        '<button type="button" class="fe-btn primary" data-fe-action="save">💾 ذخیره</button>' +
        '<button type="button" class="fe-btn" data-fe-action="reset">↺ بازگشت به اصلی</button>' +
        '<button type="button" class="fe-btn" data-fe-action="close">✕ بستن</button>' +
      '</div>' +
      '<details class="fe-help">' +
        '<summary>📖 راهنمای FEN و مهره‌ها</summary>' +
        '<div class="fe-help-body">' +
          '<p><b>ساختار:</b> <code>موقعیت نوبت قلعه آن‌پاسان نیم‌حرکت شماره</code></p>' +
          '<p><b>شاه سفید = K</b> &nbsp;|&nbsp; <b>وزیر سفید = Q</b> &nbsp;|&nbsp; <b>رخ سفید = R</b> &nbsp;|&nbsp; <b>فیل سفید = B</b> &nbsp;|&nbsp; <b>اسب سفید = N</b> &nbsp;|&nbsp; <b>پیادهٔ سفید = P</b></p>' +
          '<p><b>مشکی:</b> همان حروف با حرف کوچک — <code>k q r b n p</code></p>' +
          '<p><b>عدد:</b> تعداد خانه‌های خالی. مثلاً <code>8</code> = یک ردیف کامل خالی، <code>5</code> = پنج خانهٔ خالی</p>' +
          '<p><b>ترتیب ردیف‌ها:</b> از ردیف ۸ (بالا) تا ردیف ۱ (پایین). ستون‌ها از a تا h</p>' +
          '<p><b>مثال (شروع بازی):</b></p>' +
          '<code style="display:block;direction:ltr;text-align:left;padding:8px;background:#0d1117;border-radius:6px;margin:6px 0">rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</code>' +
          '<p><b>نوبت:</b> <code>w</code>=سفید &nbsp; <code>b</code>=مشکی</p>' +
        '</div>' +
      '</details>' +
      (isOverridden ? '<div class="fe-original"><b>موقعیت اصلی:</b> <code dir="ltr">' + original + '</code></div>' : '') +
    '</div>';
  }

  function bindFENEditor(lesson, onSaved) {
    const ta = document.getElementById('feTextarea');
    const val = document.getElementById('feValidation');
    if(!ta) return;

    function updateValidation() {
      const err = validateFEN(ta.value.trim());
      if(err) {
        val.className = 'fe-validation error';
        val.textContent = '⚠️ ' + err;
        return false;
      }
      val.className = 'fe-validation ok';
      val.textContent = '✅ FEN معتبر است';
      return true;
    }

    ta.addEventListener('input', updateValidation);
    updateValidation();

    const wrap = ta.closest('.fe-wrap');
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-fe-action]');
      if(!b) return;
      const a = b.dataset.feAction;
      if(a === 'save') {
        const fen = ta.value.trim();
        if(!updateValidation()) {
          if(!confirm('FEN معتبر نیست. با این حال ذخیره شود؟')) return;
        }
        setOverride(lesson.id, { fen });
        if(onSaved) onSaved('save');
      } else if(a === 'reset') {
        if(hasOverride(lesson.id)) {
          if(!confirm('به موقعیت اصلی برگردیم؟')) return;
          clearOverride(lesson.id);
          ta.value = lesson.fen;
          updateValidation();
          if(onSaved) onSaved('reset');
        } else {
          ta.value = lesson.fen;
          updateValidation();
        }
      } else if(a === 'close') {
        if(onSaved) onSaved('close');
      }
    });
  }

  return {
    getOverride, setOverride, clearOverride, hasOverride, countOverrides,
    getEffectiveFen, validateFEN, listPieces,
    renderPieceListHTML, renderFENEditorHTML, bindFENEditor
  };
})();
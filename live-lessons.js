"use strict";
/* ============================================================
   📖 live-lessons.js — موتور «آموزش زنده» (نسخهٔ 2.0)
   ------------------------------------------------------------
   - مهره‌های SVG مثل صفحهٔ اصلی
   - اندازهٔ بزرگ‌تر و خوانا
   - ذخیره و بازیابی موقعیت (کتاب/فصل/درس)
   - دکمه‌های کارآمد
   ساخته شده توسط امید گروسی
   ============================================================ */

window.LiveLessons = (() => {

  const PROGRESS_KEY = 'live-lessons-progress';
  const POSITION_KEY = 'live-lessons-position';

  let curBook = null;
  let curChapter = null;
  let curLesson = null;

  let board = null;
  let selectedSq = null;
  let stepIndex = 0;
  let solved = false;
  let failed = false;
  let attempts = 0;
  let lastMove = null;

  /* ---------- ذخیره‌سازی ---------- */
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
    catch(e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch(e){}
  }
  function markSolved(lessonId) {
    const p = loadProgress();
    p[lessonId] = { solved: true, ts: Date.now() };
    saveProgress(p);
  }
  function isSolved(lessonId) { return !!loadProgress()[lessonId]; }
  function bookProgress(book) {
    let total = 0, solved = 0;
    const p = loadProgress();
    for(const ch of book.chapters)
      for(const ls of ch.lessons)
        if(ls.type === 'puzzle') { total++; if(p[ls.id]) solved++; }
    return { total, solved };
  }

  function savePosition() {
    try {
      if(!curBook) { localStorage.removeItem(POSITION_KEY); return; }
      localStorage.setItem(POSITION_KEY, JSON.stringify({
        bookId: curBook.id,
        chapterId: curChapter ? curChapter.id : null,
        lessonId: curLesson ? curLesson.id : null
      }));
    } catch(e){}
  }
  function restorePosition() {
    try {
      const raw = localStorage.getItem(POSITION_KEY);
      if(!raw) { showBookList(); return; }
      const p = JSON.parse(raw);
      const book = BOOKS_DB.find(b => b.id === p.bookId);
      if(!book) { showBookList(); return; }
      curBook = book;
      if(p.chapterId)
        curChapter = curBook.chapters.find(c => c.id === p.chapterId) || null;
      if(curChapter && p.lessonId)
        curLesson = curChapter.lessons.find(l => l.id === p.lessonId) || null;

      if(curLesson) {
        if(curLesson.type === 'read') showReadLesson();
        else showPuzzleLesson();
      } else if(curChapter) {
        openChapter(curChapter.id);
      } else {
        openBook(curBook.id);
      }
    } catch(e) { showBookList(); }
  }

  /* ---------- مهره‌ها: SVG صفحهٔ اصلی ---------- */
  function renderPiece(p) {
    const white = p === p.toUpperCase();
    if(typeof pieceSvg === 'function') {
      return '<span class="piece ' + (white ? 'w' : 'b') + '">' + pieceSvg(p, white) + '</span>';
    }
    /* fallback فقط اگر pieces.js بار نشده باشد */
    const G = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
    return '<span class="piece ' + (white ? 'w' : 'b') + '">' + G[p.toLowerCase()] + '</span>';
  }

  /* ---------- لیست کتاب‌ها ---------- */
  function showBookList() {
    curBook = null; curChapter = null; curLesson = null;
    savePosition();
    const header = document.getElementById('booksHeader');
    const container = document.getElementById('booksContent');
    header.innerHTML = '<h2>📖 آموزش زنده</h2>' +
      '<p style="color:#9aa0ae;font-size:13px;margin-top:6px">محتوای اقتباس‌شده از کتاب‌های مرجع شطرنج — درس‌ها را بخوان و پازل‌ها را حل کن.</p>';
    let html = '<div class="books-grid">';
    for(const b of BOOKS_DB) {
      const prog = bookProgress(b);
      const pct = prog.total ? Math.round(100 * prog.solved / prog.total) : 0;
      html += '<div class="book-card" onclick="LiveLessons.openBook(\'' + b.id + '\')">' +
        '<div class="book-icon" style="color:' + b.color + '">' + b.icon + '</div>' +
        '<div class="book-title">' + b.title + '</div>' +
        '<div class="book-author">' + b.author + ' — ' + b.year + '</div>' +
        '<div class="book-desc">' + b.description + '</div>' +
        '<div class="book-progress">' +
          '<div class="book-progress-bar"><div class="book-progress-fill" style="width:' + pct + '%;background:' + b.color + '"></div></div>' +
          '<small>' + prog.solved + ' از ' + prog.total + ' پازل حل‌شده</small>' +
        '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  /* ---------- باز کردن کتاب ---------- */
  function openBook(bookId) {
    curBook = BOOKS_DB.find(b => b.id === bookId);
    if(!curBook) return;
    curChapter = null; curLesson = null;
    savePosition();
    document.getElementById('booksHeader').innerHTML = '';
    const container = document.getElementById('booksContent');
    let html = '<button class="back-btn" onclick="LiveLessons.showBookList()">← بازگشت به کتاب‌ها</button>';
    html += '<div class="book-header" style="border-color:' + curBook.color + '">' +
      '<div class="book-icon-big" style="color:' + curBook.color + '">' + curBook.icon + '</div>' +
      '<h2>' + curBook.title + '</h2>' +
      '<div class="book-meta">' + curBook.titleEn + ' — ' + curBook.author + ' (' + curBook.year + ')</div>' +
      '<p class="book-desc-big">' + curBook.description + '</p>' +
    '</div><div class="chapters-list">';
    for(const ch of curBook.chapters) {
      const puzzles = ch.lessons.filter(l => l.type === 'puzzle');
      const solvedCount = puzzles.filter(l => isSolved(l.id)).length;
      const hasLessons = ch.lessons.length > 0;
      html += '<div class="chapter-card' + (hasLessons ? '' : ' empty') + '" ' +
        (hasLessons ? 'onclick="LiveLessons.openChapter(\'' + ch.id + '\')"' : '') + '>' +
        '<h3>' + ch.title + '</h3>' +
        '<div class="chapter-sub">' + ch.titleEn + '</div>' +
        '<p>' + ch.intro + '</p>' +
        (hasLessons
          ? '<div class="chapter-progress">✅ ' + solvedCount + ' از ' + puzzles.length + ' پازل حل‌شده</div>'
          : '<div class="chapter-progress empty-tag">به‌زودی…</div>') +
      '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  /* ---------- باز کردن فصل ---------- */
  function openChapter(chapterId) {
    curChapter = curBook.chapters.find(c => c.id === chapterId);
    if(!curChapter) return;
    curLesson = null;
    savePosition();
    const container = document.getElementById('booksContent');
    let html = '<button class="back-btn" onclick="LiveLessons.openBook(\'' + curBook.id + '\')">← ' + curBook.title + '</button>';
    html += '<h2 class="chapter-title">' + curChapter.title + '</h2>';
    html += '<p class="chapter-intro">' + curChapter.intro + '</p>';
    html += '<div class="lessons-list">';
    let idx = 0;
    for(const ls of curChapter.lessons) {
      if(ls.type === 'read') {
        html += '<div class="lesson-row read" onclick="LiveLessons.openLesson(\'' + ls.id + '\')">' +
          '<span class="lesson-icon">📘</span>' +
          '<span class="lesson-title">' + ls.title + '</span>' +
          '<span class="lesson-tag">درس</span></div>';
      } else {
        idx++;
        const done = isSolved(ls.id) ? '✅' : '⬜';
        html += '<div class="lesson-row puzzle" onclick="LiveLessons.openLesson(\'' + ls.id + '\')">' +
          '<span class="lesson-icon">' + done + '</span>' +
          '<span class="lesson-title">پازل ' + idx + ' — ' + ls.title + '</span>' +
          '<span class="lesson-tag">حل کن</span></div>';
      }
    }
    html += '</div>';
    container.innerHTML = html;
  }

  /* ---------- باز کردن درس ---------- */
  function openLesson(lessonId) {
    curLesson = curChapter.lessons.find(l => l.id === lessonId);
    if(!curLesson) return;
    savePosition();
    if(curLesson.type === 'read') showReadLesson();
    else showPuzzleLesson();
  }

  /* ---------- درس خواندنی ---------- */
  function showReadLesson() {
    const L = curLesson;
    const container = document.getElementById('booksContent');
    let html = '<button class="back-btn" onclick="LiveLessons.openChapter(\'' + curChapter.id + '\')">← ' + curChapter.title + '</button>';
    html += '<div class="read-lesson"><h2>' + L.title + '</h2>';
    for(const p of L.text) html += '<p>' + p + '</p>';
    if(L.board) {
      html += '<div class="lesson-board-wrap"><div id="lessonBoard" class="lesson-board"></div>';
      if(L.board.caption) html += '<div class="lesson-caption">' + L.board.caption + '</div>';
      html += '</div>';
    }
    if(L.points && L.points.length) {
      html += '<div class="lesson-points"><h4>📌 نکات کلیدی</h4><ul>';
      for(const p of L.points) html += '<li>' + p + '</li>';
      html += '</ul></div>';
    }
    html += '</div>';
    container.innerHTML = html;
    if(L.board) renderBoard(parseFENLocal(L.board.fen), [], null);
  }

  /* ---------- پازل ---------- */
  function showPuzzleLesson() {
    const L = curLesson;
    board = parseFENLocal(L.fen);
    selectedSq = null; stepIndex = 0;
    solved = false; failed = false; attempts = 0; lastMove = null;

    const turn = L.fen.split(' ')[1];
    const container = document.getElementById('booksContent');
    let html = '<button class="back-btn" onclick="LiveLessons.openChapter(\'' + curChapter.id + '\')">← ' + curChapter.title + '</button>';
    html += '<div class="puzzle-lesson">';
    html += '<h2>' + L.title + '</h2>';
    html += '<div class="puzzle-text">' + L.text[0] + '</div>';
    html += '<div class="lesson-board-wrap"><div id="lessonBoard" class="lesson-board"></div></div>';
    html += '<div class="puzzle-feedback" id="puzzleFeedback">نوبت ' +
      (turn === 'w' ? '⚪ سفید' : '⚫ مشکی') + ' است — بهترین حرکت را پیدا کن.</div>';
    html += '<div class="puzzle-controls">' +
      '<button type="button" id="btnHint">💡 راهنمایی</button>' +
      '<button type="button" id="btnRetry">🔄 از اول</button>' +
      '<button type="button" id="btnSolution" class="primary">👁 پاسخ</button>' +
    '</div>';
    html += '<div class="puzzle-explain hidden" id="puzzleExplain"></div>';
    html += '<div id="puzzleNextWrap" class="hidden" style="margin-top:12px">' +
      '<button type="button" id="btnNext" class="primary" style="width:100%">درس بعدی ←</button>' +
    '</div>';
    html += '</div>';
    container.innerHTML = html;

    /* اتصال دکمه‌ها به‌صورت مستقیم — ۱۰۰٪ قابل اعتماد */
    const bH = document.getElementById('btnHint');
    const bR = document.getElementById('btnRetry');
    const bS = document.getElementById('btnSolution');
    if(bH) bH.addEventListener('click', e => { e.preventDefault(); hint(); });
    if(bR) bR.addEventListener('click', e => { e.preventDefault(); retry(); });
    if(bS) bS.addEventListener('click', e => { e.preventDefault(); showSolution(); });

    /* اتصال دکمهٔ «درس بعدی» */
    const bN = document.getElementById('btnNext');
    if(bN) bN.addEventListener('click', e => { e.preventDefault(); nextLesson(); });

    renderBoard(board, [], null);
  }

  /* ---------- رندر صفحه ---------- */
  function renderBoard(b, highlights, last) {
    const el = document.getElementById('lessonBoard');
    if(!el) return;
    highlights = highlights || [];
    const FILES = 'abcdefgh';
    const isW = p => p && p === p.toUpperCase();
    const sqName = sq => FILES[sq & 7] + (8 - (sq >> 3));

    let html = '';
    for(let i = 0; i < 64; i++) {
      const r = i >> 3, c = i & 7;
      let cls = 'cell ' + (((r + c) % 2 === 1) ? 'dark' : 'light');
      if(highlights.includes(sqName(i))) cls += ' hl';
      if(selectedSq === i) cls += ' sel';
      if(last && (last.from === i || last.to === i)) cls += ' llast';
      const p = b[i];
      html += '<div class="' + cls + '" data-bsq="' + i + '">' +
        (c === 0 ? '<span class="coord rank">' + (8 - r) + '</span>' : '') +
        (r === 7 ? '<span class="coord file">' + FILES[c] + '</span>' : '') +
        (p ? renderPiece(p) : '') +
        '</div>';
    }
    el.innerHTML = html;

    if(!el._bound) {
      el._bound = true;
      el.addEventListener('click', onBoardClick);
    }
  }

  /* ---------- کلیک روی صفحه ---------- */
  function onBoardClick(e) {
    if(!curLesson || curLesson.type !== 'puzzle') return;
    if(failed) return;
    /* بعد از حل، فقط انتخاب مهره آزاد است ولی حرکت اعتبارسنجی نمی‌شود */
    const cell = e.target.closest('[data-bsq]');
    if(!cell) return;
    const sq = +cell.dataset.bsq;

    const turn = curLesson.fen.split(' ')[1];
    const piece = board[sq];
    const isW = p => p && p === p.toUpperCase();
    const pieceColor = piece ? (isW(piece) ? 'w' : 'b') : null;

    if(selectedSq != null) {
      const expected = curLesson.solution[stepIndex];
      if(!expected) { selectedSq = null; renderBoard(board, [], lastMove); return; }
      const fromSq = parseSqLocal(expected.slice(0, 2));
      const toSq = parseSqLocal(expected.slice(2, 4));
      if(selectedSq === fromSq && sq === toSq) {
        doMove(selectedSq, sq, expected[4] || null);
        lastMove = { from: selectedSq, to: sq };
        stepIndex++;
        selectedSq = null;
        renderBoard(board, [], lastMove);
        if(stepIndex >= curLesson.solution.length) { onSolved(); return; }
        setFeedback('✅ درست! حالا پاسخ حریف…', 'correct');
        setTimeout(() => {
          if(solved) return;
          const oppUci = curLesson.solution[stepIndex];
          if(!oppUci) { onSolved(); return; }
          const oFrom = parseSqLocal(oppUci.slice(0, 2));
          const oTo = parseSqLocal(oppUci.slice(2, 4));
          doMove(oFrom, oTo, oppUci[4] || null);
          lastMove = { from: oFrom, to: oTo };
          stepIndex++;
          renderBoard(board, [], lastMove);
          if(stepIndex >= curLesson.solution.length) onSolved();
          else setFeedback('✅ ادامه بده…', 'correct');
        }, 450);
      } else {
        onWrong();
      }
      return;
    }

    if(solved) {
      /* حالت آزاد: فقط انتخاب/لغو انتخاب */
      selectedSq = (selectedSq === sq) ? null : (pieceColor === turn ? sq : null);
      renderBoard(board, [], lastMove);
      return;
    }
    if(pieceColor === turn) {
      selectedSq = sq;
      renderBoard(board, [], lastMove);
    }
  }

  function doMove(from, to, promo) {
    const p = board[from];
    if(!p) return;
    const isW = x => x && x === x.toUpperCase();
    const isEp = p.toLowerCase() === 'p' && !board[to] && (from & 7) !== (to & 7);
    board[to] = promo ? (isW(p) ? promo.toUpperCase() : promo) : p;
    board[from] = null;
    if(p.toLowerCase() === 'k' && Math.abs((to & 7) - (from & 7)) === 2) {
      if(to > from) { board[from + 1] = board[from + 3]; board[from + 3] = null; }
      else { board[from - 1] = board[from - 4]; board[from - 4] = null; }
    }
    if(isEp) board[(to & 7) | (from & 56)] = null;
  }

  function onWrong() {
    attempts++;
    failed = true;
    setFeedback('❌ اشتباه! حرکتت درست نبود.', 'wrong');
    renderBoard(board, [], lastMove);
    setTimeout(() => {
      failed = false;
      selectedSq = null;
      renderBoard(board, [], lastMove);
      if(attempts >= 3) {
        setFeedback('سه بار تلاش کردی. روی «👁 پاسخ» بزن تا راه‌حل را ببینی.', 'wrong');
      } else {
        setFeedback('دوباره تلاش کن — بهترین حرکت را پیدا کن. (تلاش ' + attempts + ' از ۳)', '');
      }
    }, 1200);
  }

  function onSolved() {
    solved = true;
    markSolved(curLesson.id);
    setFeedback('🎉 آفرین! پازل را حل کردی.', 'correct');
    const ex = document.getElementById('puzzleExplain');
    if(ex) {
      ex.innerHTML = '🎓 <b>توضیح:</b> ' + curLesson.explanation;
      ex.classList.remove('hidden');
    }
    const nw = document.getElementById('puzzleNextWrap');
    if(nw) nw.classList.remove('hidden');
    renderBoard(board, [], lastMove);
  }

  function setFeedback(txt, cls) {
    const el = document.getElementById('puzzleFeedback');
    if(!el) return;
    el.className = 'puzzle-feedback' + (cls ? ' ' + cls : '');
    el.innerHTML = txt;
  }

  /* ---------- دکمه‌ها ---------- */
  function hint() {
    if(!curLesson || solved) return;
    setFeedback('💡 <b>راهنمایی:</b> ' + curLesson.hint, '');
  }
  function retry() {
    if(!curLesson || curLesson.type !== 'puzzle') return;
    showPuzzleLesson();
  }
  function showSolution() {
    if(!curLesson || solved) return;
    setFeedback('👁 پاسخ: <b>' + curLesson.solutionSan + '</b>', '');
    const ex = document.getElementById('puzzleExplain');
    if(ex) {
      ex.innerHTML = '🎓 <b>توضیح:</b> ' + curLesson.explanation;
      ex.classList.remove('hidden');
    }
    solved = true;
    const nw = document.getElementById('puzzleNextWrap');
    if(nw) nw.classList.remove('hidden');
  }
  function nextLesson() {
    if(!curChapter || !curLesson) return;
    const idx = curChapter.lessons.indexOf(curLesson);
    if(idx < 0 || idx >= curChapter.lessons.length - 1) {
      setFeedback('🎓 این آخرین درس این فصل است.', '');
      return;
    }
    openLesson(curChapter.lessons[idx + 1].id);
  }

  /* ---------- ابزار FEN ---------- */
  function parseFENLocal(fen) {
    const b = new Array(64).fill(null);
    let sq = 0;
    for(const ch of fen.split(' ')[0]) {
      if(ch === '/') continue;
      if(/\d/.test(ch)) sq += +ch;
      else b[sq++] = ch;
    }
    return b;
  }
  function parseSqLocal(s) {
    const f = 'abcdefgh'.indexOf(s[0]);
    return (8 - (+s[1])) * 8 + f;
  }

  /* ---------- API ---------- */
  return {
    showBookList, openBook, openChapter, openLesson,
    hint, retry, showSolution, nextLesson,
    init() { restorePosition(); }
  };
})();
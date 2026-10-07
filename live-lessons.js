"use strict";
/* ============================================================
   📖 live-lessons.js — موتور «آموزش زنده»
   ------------------------------------------------------------
   اجرای درس‌های تعاملی از کتاب‌های مرجع. شامل دو حالت:
   - read: نمایش متن + صفحه + نکات
   - puzzle: حل تعاملی با صفحهٔ شطرنج
   ساخته شده توسط امید گروسی
   ============================================================ */

const LiveLessons = (() => {

  /* ---------- وضعیت ---------- */
  let curBook = null;
  let curChapter = null;
  let curLesson = null;

  /* برای پازل */
  let board = null;
  let selectedSq = null;
  let stepIndex = 0;      // ایندکس در آرایهٔ solution
  let solved = false;
  let failed = false;
  let attempts = 0;

  /* برای درس‌های خواندنی */
  let stepBoard = null;

  /* آمار */
  const STORAGE_KEY = 'live-lessons-progress';

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch(e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch(e){}
  }
  function markSolved(lessonId) {
    const p = loadProgress();
    p[lessonId] = { solved: true, ts: Date.now() };
    saveProgress(p);
  }
  function isSolved(lessonId) {
    return !!loadProgress()[lessonId];
  }
  function bookProgress(book) {
    let total = 0, solved = 0;
    const p = loadProgress();
    for(const ch of book.chapters)
      for(const ls of ch.lessons) {
        if(ls.type === 'puzzle') {
          total++;
          if(p[ls.id]) solved++;
        }
      }
    return { total, solved };
  }

  /* ---------- ناوبری ---------- */
  function showBookList() {
    curBook = null; curChapter = null; curLesson = null;
    const container = document.getElementById('booksContent');
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
          '<small>' + prog.solved + ' از ' + prog.total + ' پازل</small>' +
        '</div>' +
      '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('booksHeader').innerHTML =
      '<h2>📖 آموزش زنده</h2>' +
      '<p style="color:#9aa0ae;font-size:13px;margin-top:6px">محتوا از کتاب‌های مرجع شطرنج — بامرور درس‌ها و حل پازل‌ها پیشرفت کن.</p>';
  }

  function openBook(bookId) {
    curBook = BOOKS_DB.find(b => b.id === bookId);
    if(!curBook) return;
    curChapter = null; curLesson = null;
    const container = document.getElementById('booksContent');
    let html = '<button class="back-btn" onclick="LiveLessons.showBookList()">← بازگشت به کتاب‌ها</button>';
    html += '<div class="book-header" style="border-color:' + curBook.color + '">' +
      '<div class="book-icon-big" style="color:' + curBook.color + '">' + curBook.icon + '</div>' +
      '<h2>' + curBook.title + '</h2>' +
      '<div class="book-meta">' + curBook.titleEn + ' — ' + curBook.author + ' (' + curBook.year + ')</div>' +
      '<p class="book-desc-big">' + curBook.description + '</p>' +
    '</div>';
    html += '<div class="chapters-list">';
    for(const ch of curBook.chapters) {
      const lessonCount = ch.lessons.filter(l => l.type === 'puzzle').length;
      const solvedCount = ch.lessons.filter(l => l.type === 'puzzle' && isSolved(l.id)).length;
      html += '<div class="chapter-card" onclick="LiveLessons.openChapter(\'' + ch.id + '\')">' +
        '<h3>' + ch.title + '</h3>' +
        '<div class="chapter-sub">' + ch.titleEn + '</div>' +
        '<p>' + ch.intro + '</p>' +
        '<div class="chapter-progress">' + solvedCount + ' / ' + lessonCount + ' پازل حل‌شده</div>' +
      '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('booksHeader').innerHTML = '';
  }

  function openChapter(chapterId) {
    curChapter = curBook.chapters.find(c => c.id === chapterId);
    if(!curChapter) return;
    curLesson = null;
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
          '<span class="lesson-tag">درس</span>' +
        '</div>';
      } else {
        idx++;
        const done = isSolved(ls.id) ? '✅' : '⬜';
        html += '<div class="lesson-row puzzle" onclick="LiveLessons.openLesson(\'' + ls.id + '\')">' +
          '<span class="lesson-icon">' + done + '</span>' +
          '<span class="lesson-title">پازل ' + idx + ' — ' + ls.title + '</span>' +
          '<span class="lesson-tag">حل کن</span>' +
        '</div>';
      }
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function openLesson(lessonId) {
    curLesson = curChapter.lessons.find(l => l.id === lessonId);
    if(!curLesson) return;
    if(curLesson.type === 'read') showReadLesson();
    else showPuzzleLesson();
  }

  /* ---------- نمایش درس خواندنی ---------- */
  function showReadLesson() {
    const L = curLesson;
    const container = document.getElementById('booksContent');
    let html = '<button class="back-btn" onclick="LiveLessons.openChapter(\'' + curChapter.id + '\')">← ' + curChapter.title + '</button>';
    html += '<div class="read-lesson">';
    html += '<h2>' + L.title + '</h2>';
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

    if(L.board) {
      const fen = L.board.fen;
      const b = parseFENLocal(fen);
      renderLessonBoardFromArray(b, []);
    }
  }

  /* ---------- نمایش پازل ---------- */
  function showPuzzleLesson() {
    const L = curLesson;
    board = parseFENLocal(L.fen);
    selectedSq = null;
    stepIndex = 0;
    solved = false;
    failed = false;
    attempts = 0;

    const container = document.getElementById('booksContent');
    let html = '<button class="back-btn" onclick="LiveLessons.openChapter(\'' + curChapter.id + '\')">← ' + curChapter.title + '</button>';
    html += '<div class="puzzle-lesson">';
    html += '<h2>' + L.title + '</h2>';
    html += '<div class="puzzle-text">' + L.text[0] + '</div>';
    html += '<div class="lesson-board-wrap"><div id="lessonBoard" class="lesson-board"></div></div>';
    html += '<div class="puzzle-feedback" id="puzzleFeedback">نوبت ' + (L.fen.split(' ')[1] === 'w' ? '⚪ سفید' : '⚫ مشکی') + ' است — بهترین حرکت را پیدا کن.</div>';
    html += '<div class="puzzle-controls">' +
      '<button onclick="LiveLessons.hint()">💡 راهنمایی</button>' +
      '<button onclick="LiveLessons.retry()">🔄 از اول</button>' +
      '<button class="primary" onclick="LiveLessons.showSolution()">👁 پاسخ</button>' +
    '</div>';
    html += '<div class="puzzle-explain hidden" id="puzzleExplain"></div>';
    html += '</div>';
    container.innerHTML = html;

    renderLessonBoard();
  }

  /* ---------- رندر صفحه ---------- */
  function renderLessonBoard() {
    const highlights = [];
    // هایلایت حرکت قبلی
    const last = null;
    renderLessonBoardFromArray(board, highlights, last);
  }

  function renderLessonBoardFromArray(b, highlights, last) {
    const el = document.getElementById('lessonBoard');
    if(!el) return;
    const FILES = 'abcdefgh';
    const GLYPH = {k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
    const isW = p => p && p === p.toUpperCase();
    const sqName = sq => FILES[sq & 7] + (8 - (sq >> 3));

    let html = '';
    for(let i = 0; i < 64; i++) {
      const r = i >> 3, c = i & 7;
      let cls = 'cell ' + (((r + c) % 2 === 1) ? 'dark' : 'light');
      if(highlights && highlights.includes(sqName(i))) cls += ' hl';
      if(selectedSq === i) cls += ' sel';
      if(last && (last.from === i || last.to === i)) cls += ' llast';
      const p = b[i];
      html += '<div class="' + cls + '" data-bsq="' + i + '">' +
        (c === 0 ? '<span class="coord rank">' + (8 - r) + '</span>' : '') +
        (r === 7 ? '<span class="coord file">' + FILES[c] + '</span>' : '') +
        (p ? '<span class="piece ' + (isW(p) ? 'w' : 'b') + '">' + GLYPH[p.toLowerCase()] + '</span>' : '') +
        '</div>';
    }
    el.innerHTML = html;

    // اتصال کلیک — فقط یک بار
    if(!el._bound) {
      el._bound = true;
      el.addEventListener('click', onBoardClick);
    }
  }

  /* ---------- تعامل با پازل ---------- */
  function onBoardClick(e) {
    if(solved || failed || !curLesson || curLesson.type !== 'puzzle') return;
    const cell = e.target.closest('[data-bsq]');
    if(!cell) return;
    const sq = +cell.dataset.bsq;

    // تعیین رنگ نوبت
    const turn = curLesson.fen.split(' ')[1];
    const piece = board[sq];
    const isW = p => p && p === p.toUpperCase();
    const pieceColor = piece ? (isW(piece) ? 'w' : 'b') : null;

    // اگر مهره‌ای انتخاب شده و روی خانهٔ هدف کلیک شده
    if(selectedSq != null) {
      const from = selectedSq;
      const to = sq;
      // امتحان حرکت
      const expected = curLesson.solution[stepIndex];
      if(!expected) return;
      const fromSq = parseSqLocal(expected.slice(0, 2));
      const toSq = parseSqLocal(expected.slice(2, 4));
      if(from === fromSq && to === toSq) {
        // حرکت درست
        doMove(from, to, expected[4] || null);
        stepIndex++;
        selectedSq = null;
        if(stepIndex >= curLesson.solution.length) {
          onSolved();
          return;
        }
        renderLessonBoard();
        setFeedback('✅ درست! حالا پاسخ حریف…', 'correct');
        // حرکت حریف بعد از کمی تأخیر
        setTimeout(() => {
          if(solved) return;
          const oppUci = curLesson.solution[stepIndex];
          if(!oppUci) { onSolved(); return; }
          const oFrom = parseSqLocal(oppUci.slice(0, 2));
          const oTo = parseSqLocal(oppUci.slice(2, 4));
          doMove(oFrom, oTo, oppUci[4] || null);
          stepIndex++;
          renderLessonBoard();
          if(stepIndex >= curLesson.solution.length) { onSolved(); }
          else { setFeedback('✅ ادامه بده…', 'correct'); }
        }, 450);
      } else {
        // حرکت اشتباه
        onWrong();
      }
      return;
    }

    // انتخاب مهره
    if(pieceColor === turn) {
      selectedSq = sq;
      renderLessonBoard();
    }
  }

  function doMove(from, to, promo) {
    const piece = board[from];
    if(!piece) return;
    const isW = p => p && p === p.toUpperCase();
    const isEp = piece.toLowerCase() === 'p' && !board[to] && (from & 7) !== (to & 7);
    board[to] = promo ? (isW(piece) ? promo.toUpperCase() : promo) : piece;
    board[from] = null;
    // castle
    if(piece.toLowerCase() === 'k' && Math.abs((to & 7) - (from & 7)) === 2) {
      if(to > from) { board[from + 1] = board[from + 3]; board[from + 3] = null; }
      else { board[from - 1] = board[from - 4]; board[from - 4] = null; }
    }
    // en passant
    if(isEp) board[(to & 7) | (from & 56)] = null;
  }

  function onWrong() {
    attempts++;
    failed = true;
    setFeedback('❌ اشتباه! حرکتت درست نبود.', 'wrong');
    renderLessonBoard();
    setTimeout(() => {
      failed = false;
      selectedSq = null;
      renderLessonBoard();
      if(attempts >= 3) {
        setFeedback('سه بار تلاش کردی. روی «👁 پاسخ» بزن تا راه‌حل را ببینی.', 'wrong');
      } else {
        setFeedback('دوباره تلاش کن — بهترین حرکت را پیدا کن.', '');
      }
    }, 1200);
  }

  function onSolved() {
    solved = true;
    markSolved(curLesson.id);
    setFeedback('🎉 آفرین! پازل را حل کردی.', 'correct');
    const ex = document.getElementById('puzzleExplain');
    ex.innerHTML = '🎓 <b>توضیح:</b> ' + curLesson.explanation;
    ex.classList.remove('hidden');
    renderLessonBoard();
  }

  function setFeedback(txt, cls) {
    const el = document.getElementById('puzzleFeedback');
    if(!el) return;
    el.className = 'puzzle-feedback' + (cls ? ' ' + cls : '');
    el.innerHTML = txt;
  }

  function hint() {
    if(solved) return;
    setFeedback('💡 <b>راهنمایی:</b> ' + curLesson.hint, '');
  }

  function retry() {
    showPuzzleLesson();
  }

  function showSolution() {
    if(solved) return;
    setFeedback('👁 پاسخ: <b>' + curLesson.solutionSan + '</b>', '');
    const ex = document.getElementById('puzzleExplain');
    ex.innerHTML = '🎓 <b>توضیح:</b> ' + curLesson.explanation;
    ex.classList.remove('hidden');
    solved = true;
  }

  /* ---------- ابزارهای FEN و مختصات ---------- */
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

  /* ---------- مقدار اولیه ---------- */
  return {
    showBookList,
    openBook,
    openChapter,
    openLesson,
    hint,
    retry,
    showSolution,
    init() {
      showBookList();
    }
  };
})();
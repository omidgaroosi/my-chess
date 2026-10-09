"use strict";
/* ============================================================
   🎓 lesson-board.js — صفحهٔ شطرنج تعاملی برای آکادمی
   ------------------------------------------------------------
   دو حالت:
   - Demo: نمایش گام‌به‌گام مثال‌های درس (مثل قبل)
   - Try: کاربر خودش بازی می‌کند، مربی و استاک‌فیش کمک می‌کنند
   ساخته شده توسط امید گروسی
   ============================================================ */

window.LessonBoard = (() => {

  const FILES = 'abcdefgh';
  const sqName = sq => FILES[sq & 7] + (8 - (sq >> 3));
  const isW = p => p && p === p.toUpperCase();
  const colorOf = p => isW(p) ? 'w' : 'b';

  let state = null;

  /* ================= API ================= */
  function init(lesson, containerId) {
    if (!lesson || !lesson.board) return;
    const cid = containerId || 'lboard';
    state = {
      lesson,
      containerId: cid,
      baseFen: lesson.board.fen,
      board: parseFEN(lesson.board.fen),
      steps: lesson.board.steps || [],
      stepIndex: 0,
      mode: 'demo',
      userSide: (lesson.board.try && lesson.board.try.userSide) || 'w',
      try: lesson.board.try || null,
      tryHistory: [],
      tryAttempts: 0,
      selectedSq: null,
      lastMove: null,
      coachSuggestion: null,
      engineThinking: false,
      engineSearchRole: 'lesson-board'
    };
    render();
  }

  /* ================= حالت‌ها ================= */
  function setMode(mode) {
    if (!state) return;
    if (mode === state.mode) return;
    state.mode = mode;
    state.selectedSq = null;
    state.lastMove = null;
    state.coachSuggestion = null;

    if (mode === 'try') {
      /* شروع از موقعیت پایه */
      state.board = parseFEN(state.baseFen);
      state.tryHistory = [];
      state.tryAttempts = 0;
    } else {
      state.stepIndex = 0;
    }
    render();
  }

  /* ================= پخش دمو ================= */
  function nextStep() {
    if (!state || state.mode !== 'demo') return;
    if (state.stepIndex >= state.steps.length) return;
    state.stepIndex++;
    const uci = state.steps[state.stepIndex - 1].uci;
    state.lastMove = { from: parseSq(uci.slice(0, 2)), to: parseSq(uci.slice(2, 4)) };
    render();
  }

  function prevStep() {
    if (!state || state.mode !== 'demo') return;
    if (state.stepIndex <= 0) return;
    state.stepIndex--;
    if (state.stepIndex > 0) {
      const uci = state.steps[state.stepIndex - 1].uci;
      state.lastMove = { from: parseSq(uci.slice(0, 2)), to: parseSq(uci.slice(2, 4)) };
    } else {
      state.lastMove = null;
    }
    render();
  }

  function goToStep(idx) {
    if (!state || state.mode !== 'demo') return;
    state.stepIndex = Math.max(0, Math.min(state.steps.length, idx));
    state.lastMove = state.stepIndex > 0 ? {
      from: parseSq(state.steps[state.stepIndex - 1].uci.slice(0, 2)),
      to: parseSq(state.steps[state.stepIndex - 1].uci.slice(2, 4))
    } : null;
    render();
  }

  /* ================= حالت تمرین ================= */
  function resetTry() {
    if (!state) return;
    state.board = parseFEN(state.baseFen);
    state.tryHistory = [];
    state.tryAttempts = 0;
    state.selectedSq = null;
    state.lastMove = null;
    state.coachSuggestion = null;
    render();
  }

  function onSquareClick(sq) {
    if (!state || state.mode !== 'try') return;
    if (state.engineThinking) return;

    const p = state.board[sq];
    const turn = state.tryHistory.length % 2 === 0 ? state.userSide : (state.userSide === 'w' ? 'b' : 'w');

    /* اگر مهره‌ای انتخاب شده و این کلیک، مقصد حرکت است */
    if (state.selectedSq != null) {
      const from = state.selectedSq;
      const pseudoMove = { from, to: sq };
      const legal = legalMovesFromState();
      const m = legal.find(x => x.from === from && x.to === sq);
      if (m) {
        executeUserMove(m);
        return;
      }
    }

    /* انتخاب مهره */
    state.selectedSq = (p && colorOf(p) === turn) ? sq : null;
    render();
  }

  function legalMovesFromState() {
    const turn = state.tryHistory.length % 2 === 0 ? state.userSide : (state.userSide === 'w' ? 'b' : 'w');
    const fakeState = {
      board: state.board.slice(),
      turn,
      castling: { K: 0, Q: 0, k: 0, q: 0 },
      ep: -1, half: 0, full: 1
    };
    return legalMoves(fakeState);
  }

  function executeUserMove(m) {
    const turn = state.tryHistory.length % 2 === 0 ? state.userSide : (state.userSide === 'w' ? 'b' : 'w');
    const fakeState = {
      board: state.board.slice(),
      turn,
      castling: { K: 0, Q: 0, k: 0, q: 0 },
      ep: -1, half: 0, full: 1
    };
    const san = sanOf(fakeState, m, legalMoves(fakeState));
    const uci = sqName(m.from) + sqName(m.to) + (m.promo || '');

    state.board = applyUci(state.board.slice(), uci);
    state.tryHistory.push({ uci, san });
    state.lastMove = { from: m.from, to: m.to };
    state.selectedSq = null;
    state.coachSuggestion = null;

    /* اگر این اولین حرکت کاربر بود، بررسی صحت */
    if (state.tryHistory.length === 1 && state.try) {
      const expected = state.try.expectedMoves || [];
      if (expected.length && !expected.includes(uci)) {
        state.tryAttempts++;
        render();
        return;
      }
    }

    render();

    /* پاسخ خودکار حریف (اگر تعریف شده و کاربر سفید است) */
    if (state.try && state.try.opponentReply && state.tryHistory.length === 1) {
      const replyUci = state.try.opponentReply;
      if (replyUci && state.userSide === 'w') {
        setTimeout(() => {
          if (!state || state.mode !== 'try') return;
          const oppTurn = 'b';
          const oppState = {
            board: state.board.slice(),
            turn: oppTurn,
            castling: { K: 0, Q: 0, k: 0, q: 0 },
            ep: -1, half: 0, full: 1
          };
          const oppLegal = legalMoves(oppState);
          const from = parseSq(replyUci.slice(0, 2));
          const to = parseSq(replyUci.slice(2, 4));
          const oppMove = oppLegal.find(x => x.from === from && x.to === to);
          if (oppMove) {
            state.board = applyUci(state.board.slice(), replyUci);
            state.tryHistory.push({ uci: replyUci, san: sanOf(oppState, oppMove, oppLegal) });
            state.lastMove = { from, to };
            render();
          }
        }, 600);
      }
    }
  }

  /* ================= مربی و استاک‌فیش ================= */
  function currentFen() {
    if (!state) return null;
    const b = state.mode === 'demo' ? computeBoardForStep(state.stepIndex) : state.board;
    let placement = '', empty = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r * 8 + c];
        if (!p) empty++;
        else { if (empty) { placement += empty; empty = 0; } placement += p; }
      }
      if (empty) { placement += empty; empty = 0; }
      if (r < 7) placement += '/';
    }
    const turn = state.mode === 'try' ? (state.tryHistory.length % 2 === 0 ? state.userSide : (state.userSide === 'w' ? 'b' : 'w')) : 'w';
    return placement + ' ' + turn + ' - - 0 1';
  }

  function askCoach() {
    if (!state) return;
    if (typeof engineReady !== 'undefined' && !engineReady) {
      setFeedback('⚠️ استاک‌فیش هنوز آماده نیست. چند لحظه صبر کن.', 'error');
      return;
    }
    if (typeof sfSend !== 'function') {
      setFeedback('⚠️ موتور در دسترس نیست.', 'error');
      return;
    }
    state.engineThinking = true;
    setFeedback('🎓 مربی در حال تحلیل این پوزیسیون…', 'info');
    try { searchRole = 'lesson-board'; } catch (e) {}
    try { searchGen = -1; } catch (e) {}   /* اطمینان از اینکه با بازی اصلی تداخل نکند */
    try { searchSide = currentFen().split(' ')[1]; } catch (e) {}
    sfSend('setoption name Skill Level value 20');
    sfSend('position fen ' + currentFen());
    sfSend('go depth 15');
  }

  function askStockfish() {
    askCoach(); /* همان جریان، اما پیام متفاوت */
  }

  function setFeedback(txt, cls) {
    const el = document.getElementById(state.containerId + '-feedback');
    if (!el) return;
    el.className = 'lesson-feedback' + (cls ? ' ' + cls : '');
    el.innerHTML = txt;
  }

  /* ================= دریافت پاسخ از استاک‌فیش ================= */
  function onStockfishInfo(line) {
    if (!state || !state.engineThinking) return;
    const ms = line.match(/ score (cp|mate) (-?\d+)/);
    if (ms) state._lastScore = { mate: ms[1] === 'mate', v: +ms[2] };
    const md = line.match(/ depth (\d+)/);
    if (md) state._lastDepth = +md[1];
    const pvm = line.match(/ pv (.+)$/);
    if (pvm) state._lastPv = pvm[1].trim().split(/\s+/);
  }

  function onStockfishBestmove(token) {
    if (!state) return;
    state.engineThinking = false;

    /* تولید پیام جامع */
    const fen = currentFen();
    const turn = fen.split(' ')[1];
    const fakeState = {
      board: (state.mode === 'demo' ? computeBoardForStep(state.stepIndex) : state.board).slice(),
      turn,
      castling: { K: 0, Q: 0, k: 0, q: 0 },
      ep: -1, half: 0, full: 1
    };
    const legal = legalMoves(fakeState);
    const from = parseSq(token.slice(0, 2));
    const to = parseSq(token.slice(2, 4));
    const promo = token[4] || null;
    const m = legal.find(x => x.from === from && x.to === to && (x.promo || null) === promo);
    const san = m ? sanOf(fakeState, m, legal) : token;

    /* ارزیابی */
    let evalTxt = 'نامشخص';
    if (state._lastScore) {
      if (state._lastScore.mate) {
        const n = Math.abs(state._lastScore.v);
        evalTxt = 'مات در ' + n + ' به نفع ' + (state._lastScore.v > 0 ? (turn === 'w' ? 'سفید' : 'مشکی') : (turn === 'w' ? 'مشکی' : 'سفید'));
      } else {
        const v = state._lastScore.v / 100;
        if (Math.abs(v) < 0.3) evalTxt = 'متعادل';
        else evalTxt = (v > 0 ? '+' : '') + v.toFixed(2) + ' به نفع ' + (v > 0 ? (turn === 'w' ? 'سفید' : 'مشکی') : (turn === 'w' ? 'مشکی' : 'سفید'));
      }
    }

    /* توضیح حرکت */
    const reasons = window.Coach ? window.Coach.describeMove(fakeState, m) : [];

    let html = '🎓 <b>تحلیل مربی:</b><br>';
    html += '📊 <b>ارزیابی:</b> ' + evalTxt + '<br>';
    html += '🎯 <b>بهترین حرکت:</b> <span style="color:#ffd54f;font-size:15px">' + san + '</span>';
    if (reasons.length) html += '<br>🧭 <b>چرا؟</b> ' + reasons.slice(0, 2).join('؛ ');
    html += '<br>📏 عمق تحلیل: ' + (state._lastDepth || '?');

    setFeedback(html, 'coach');

    /* ذخیره برای هایلایت */
    if (m) {
      state.coachSuggestion = { from: m.from, to: m.to };
      render();
    }

    /* پاک کردن متغیرهای موقت */
    state._lastScore = null;
    state._lastDepth = 0;
    state._lastPv = null;
  }

  /* ================= رسم ================= */
  function computeBoardForStep(idx) {
    let b = parseFEN(state.baseFen);
    for (let i = 0; i < idx; i++) {
      b = applyUci(b.slice(), state.steps[i].uci);
    }
    return b;
  }

  function renderBoardEl(el, board, highlights, last, extraHl) {
    let html = '';
    for (let i = 0; i < 64; i++) {
      const r = i >> 3, c = i & 7;
      let cls = 'lcell ' + (((r + c) % 2 === 1) ? 'dark' : 'light');
      if (highlights && highlights.includes(sqName(i))) cls += ' hl';
      if (state.selectedSq === i) cls += ' sel';
      if (last && (last.from === i || last.to === i)) cls += ' llast';
      if (extraHl && (extraHl.from === i || extraHl.to === i)) cls += ' coach-hl';
      const p = board[i];
      html += '<div class="' + cls + '" data-lsq="' + i + '">' +
        (c === 0 ? '<span class="lc rank">' + (8 - r) + '</span>' : '') +
        (r === 7 ? '<span class="lc file">' + FILES[c] + '</span>' : '') +
        (p ? '<span class="lpiece ' + (isW(p) ? 'w' : 'b') + '">' + pieceSvg(p, isW(p)) + '</span>' : '') +
        '</div>';
    }
    el.innerHTML = html;

    /* اتصال کلیک (فقط در حالت تمرین) */
    if (!el._bound) {
      el._bound = true;
      el.addEventListener('click', e => {
        if (!state || state.mode !== 'try') return;
        const cell = e.target.closest('[data-lsq]');
        if (!cell) return;
        onSquareClick(+cell.dataset.lsq);
      });
    }
    el.style.cursor = state.mode === 'try' ? 'pointer' : 'default';
  }

  function buildControlsHTML() {
    if (!state) return '';
    if (state.mode === 'demo') {
      const n = state.steps.length;
      const i = state.stepIndex;
      return '<div class="lesson-mode-tabs">' +
        '<button class="mode-btn active" onclick="LessonBoard.setMode(\'demo\')">🎬 نمایش دمو</button>' +
        (state.try ? '<button class="mode-btn" onclick="LessonBoard.setMode(\'try\')">🎮 بازی من</button>' : '') +
        '</div>' +
        '<div class="lesson-step-controls">' +
        '<button onclick="LessonBoard.goToStep(0)" title="شروع">⏮</button>' +
        '<button onclick="LessonBoard.prevStep()" title="قبلی">◀</button>' +
        '<span class="step-counter">' + i + ' / ' + n + '</span>' +
        '<button onclick="LessonBoard.nextStep()" title="بعدی">▶</button>' +
        '<button onclick="LessonBoard.goToStep(' + n + ')" title="پایان">⏭</button>' +
        '</div>';
    } else {
      return '<div class="lesson-mode-tabs">' +
        '<button class="mode-btn" onclick="LessonBoard.setMode(\'demo\')">🎬 نمایش دمو</button>' +
        '<button class="mode-btn active" onclick="LessonBoard.setMode(\'try\')">🎮 بازی من</button>' +
        '</div>' +
        '<div class="lesson-try-controls">' +
        '<button onclick="LessonBoard.resetTry()" title="از اول">🔄 از اول</button>' +
        '<button onclick="LessonBoard.askCoach()" class="primary" title="تحلیل مربی">🎓 راهنمایی مربی</button>' +
        '</div>';
    }
  }

  function buildExplanationHTML() {
    if (!state) return '';
    if (state.mode === 'demo') {
      if (state.stepIndex === 0) {
        return '🎬 برای دیدن مثال گام‌به‌گام، دکمهٔ ▶ یا «▶» را بزن.';
      }
      const st = state.steps[state.stepIndex - 1];
      return '🎬 <b>حرکت ' + state.stepIndex + ' از ' + state.steps.length + ':</b> ' + st.text;
    } else {
      if (!state.try) return 'حالت تمرین برای این درس تعریف نشده.';
      if (state.tryHistory.length === 0) {
        return '🎮 <b>' + (state.try.goal || 'نوبت شماست — بهترین حرکت را پیدا کن.') + '</b>';
      }
      const last = state.tryHistory[state.tryHistory.length - 1];
      return '✅ آخرین حرکت: <b>' + last.san + '</b>';
    }
  }

  function buildFeedbackHTML() {
    if (!state) return '';
    if (state.mode !== 'try') return '';

    /* اگر کاربر حرکتی نکرده */
    if (state.tryHistory.length === 0) return '';

    /* اگر حرکت اول کاربر اشتباه بود */
    if (state.try && state.tryHistory.length >= 1 && state.tryAttempts > 0) {
      return '<div class="try-wrong">' + (state.try.failureText || 'دوباره تلاش کن — به راهنمایی فکر کن.') + '</div>';
    }

    /* اگر حرکت اول کاربر درست بود */
    if (state.try && state.tryHistory.length >= 1 && state.tryAttempts === 0) {
      if (state.try.successText) {
        return '<div class="try-correct">✅ ' + state.try.successText + '</div>';
      }
    }

    return '';
  }

  function render() {
    if (!state) return;
    const el = document.getElementById(state.containerId);
    if (!el) return;

    let board, last = null, highlights = [];
    if (state.mode === 'demo') {
      board = computeBoardForStep(state.stepIndex);
      if (state.stepIndex > 0) {
        const uci = state.steps[state.stepIndex - 1].uci;
        last = { from: parseSq(uci.slice(0, 2)), to: parseSq(uci.slice(2, 4)) };
      }
      if (state.stepIndex === 0) highlights = state.lesson.board.highlights || [];
    } else {
      board = state.board;
      last = state.lastMove;
    }

    renderBoardEl(el, board, highlights, last, state.coachSuggestion);

    /* کنترل‌ها */
    const ctrls = document.getElementById(state.containerId + '-controls');
    if (ctrls) ctrls.innerHTML = buildControlsHTML();

    /* توضیح */
    const txt = document.getElementById(state.containerId + '-text');
    if (txt) txt.innerHTML = buildExplanationHTML();

    /* بازخورد */
    const fb = document.getElementById(state.containerId + '-feedback');
    if (fb) {
      const fbHtml = buildFeedbackHTML();
      if (fbHtml) {
        fb.innerHTML = fbHtml;
        fb.className = 'lesson-feedback';
      }
    }
  }

  return {
    init, setMode,
    nextStep, prevStep, goToStep,
    resetTry, askCoach, askStockfish,
    onStockfishInfo, onStockfishBestmove,
    getState: () => state
  };
})();
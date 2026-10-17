"use strict";
/* ============================================================
   📚 chess-tabs.js — منطق ۵ تب آکادمی، گشایش، پازل، آموزش زنده و سینما
   ------------------------------------------------------------
   این فایل شامل تمام منطق مربوط به تب‌های فرعی است.
   ساخته شده توسط امید گروسی
   ============================================================ */

/* ============================================================
   🎓 تب آکادمی
   ============================================================ */
let curIdx = 0;
let answered = false;
let learnInited = false;
let lBoards = [];
let lCur = 0;
let lData = null;
let completed = JSON.parse(localStorage.getItem('learn-completed') || '[]');

function secOf(l){ return LEARN_SECTIONS.find(s => s.id === l.sec); }

function renderLearnList(filter){
  filter = (filter || '').trim();
  let html = '';
  for(const sec of LEARN_SECTIONS){
    const items = LEARN_DB.map((l, i) => ({l, i}))
      .filter(x => x.l.sec === sec.id && (!filter || x.l.title.includes(filter)));
    if(!items.length && filter) continue;
    const done = items.filter(x => completed.includes(x.l.id)).length;
    html += '<details open><summary>' + sec.icon + ' ' + sec.name +
      '<span class="cnt">' + done + '/' + items.length + '</span>' +
      '<small>' + sec.desc + '</small></summary>';
    for(const x of items){
      html += '<button class="lsn' + (x.i === curIdx ? ' active' : '') +
        '" onclick="openLesson(' + x.i + ')">' +
        (completed.includes(x.l.id) ? '<span class="done">✔</span> ' : '') +
        x.l.title + '<small>' + x.l.minutes + ' دقیقه</small></button>';
    }
    html += '</details>';
  }
  document.getElementById('lessonList').innerHTML = html ||
    '<div style="color:#6f7480;font-size:13px;padding:10px">درسی پیدا نشد 🔍</div>';
  updateLearnProgress();
}

function updateLearnProgress(){
  const total = LEARN_DB.length;
  const done = LEARN_DB.filter(l => completed.includes(l.id)).length;
  document.getElementById('progressText').textContent =
    (done === total && total > 0)
      ? '🎓 تبریک! همهٔ ' + total + ' درس را کامل کردی!'
      : 'پیشرفت دوره: ' + done + ' از ' + total + ' درس';
  document.getElementById('progressFill').style.width =
    (total ? Math.round(done / total * 100) : 0) + '%';
}

function resetLearn(){
  if(!confirm('تمام پیشرفت دوره پاک شود؟')) return;
  completed = [];
  localStorage.removeItem('learn-completed');
  renderLearnList(document.getElementById('search').value);
  openLesson(curIdx);
}

function openLesson(idx){
  if(idx < 0 || idx >= LEARN_DB.length) return;
  curIdx = idx;
  const L = LEARN_DB[idx];
  const sec = secOf(L);
  let html = '<div class="lesson-head">'
    + '<span class="sec-badge">' + sec.icon + ' ' + sec.name + '</span>'
    + '<h2>' + L.title + '</h2>'
    + '<div class="meta">⏱ حدود ' + L.minutes + ' دقیقه '
    + (completed.includes(L.id) ? ' • <span class="done-tag">✅ کامل شد</span>' : '')
    + '</div></div>'
    + '<div class="intro">' + L.intro + '</div>';
  for(const p of L.parts){
    html += '<div class="part"><h3>' + p.h + '</h3><p>' + p.p + '</p></div>';
  }
  if(L.board){
    html += '<div class="card board-card">' +
      '<div id="lboard"></div>' +
      '<div class="caption">' + (L.board.caption || '') + '</div>' +
      '<div id="lboard-controls" style="width:100%;margin-top:10px"></div>' +
      '<div class="step-text" id="lboard-text" style="width:100%"></div>' +
      '<div class="lesson-feedback" id="lboard-feedback" style="width:100%"></div>' +
      '</div>';
  }
  if(L.coach){
    html += '<div class="coach-bubble">🎓 <b>نکتهٔ مربی:</b> ' + L.coach + '</div>';
  }
  if(L.points && L.points.length){
    html += '<div class="card"><h3>📌 نکات کلیدی</h3><ul>'
      + L.points.map(p => '<li>' + p + '</li>').join('') + '</ul></div>';
  }
  if(L.quiz){
    html += '<div class="card quiz-card"><h3>🧩 آزمون درس</h3>'
      + '<div class="qtext">' + L.quiz.q + '</div>'
      + (L.quiz.fen ? '<div id="quizBoard"></div>' : '')
      + '<div class="opts" id="opts"></div>'
      + '<button class="hint-btn" onclick="showHintBox()">💡 نمایش راهنمایی</button>'
      + '<div class="hintbox hidden" id="hintBox">' + L.quiz.hint + '</div>'
      + '<div class="explain hidden" id="explainBox"><b>توضیح پاسخ:</b> ' + L.quiz.explain + '</div></div>';
  }
  html += '<div class="nav-btns">'
    + '<button ' + (idx === 0 ? 'disabled' : '') + ' onclick="openLesson(' + (idx-1) + ')">درس قبلی</button>'
    + '<button ' + (idx === LEARN_DB.length - 1 ? 'disabled' : '') + ' onclick="openLesson(' + (idx+1) + ')">درس بعدی</button></div>';
  document.getElementById('lessonView').innerHTML = html;

  if(L.board && window.LessonBoard){
    setTimeout(function(){
      try { LessonBoard.init(L, 'lboard'); }
      catch(e){ console.error('❌ LessonBoard.init:', e); }
    }, 50);
  }
  if(L.quiz && L.quiz.fen){
    renderBoardEl(document.getElementById('quizBoard'), parseFEN(L.quiz.fen), [], null);
  }
  renderQuizOptions();
  renderLearnList(document.getElementById('search').value);
  document.getElementById('lessonView').scrollIntoView({behavior: 'smooth', block: 'start'});
}

function initLearnSteps(L){
  lData = L.board;
  const base = parseFEN(L.board.fen);
  lBoards = [base.slice()];
  if(L.board.steps){
    let b = base.slice();
    for(const st of L.board.steps){
      b = applyUci(b.slice(), st.uci);
      lBoards.push(b);
    }
  }
  lCur = 0;
  drawLearnStep();
}

function stepGo(n){
  if(!lData) return;
  lCur = Math.max(0, Math.min(lBoards.length - 1, n));
  drawLearnStep();
}

function drawLearnStep(){
  const last = (lCur > 0 && lData.steps)
    ? {from: parseSq(lData.steps[lCur-1].uci.slice(0,2)),
       to: parseSq(lData.steps[lCur-1].uci.slice(2,4))}
    : null;
  renderBoardEl(
    document.getElementById('lboard'),
    lBoards[lCur],
    (lCur === 0) ? (lData.highlights || []) : [],
    last
  );
  if(lData.steps && lData.steps.length){
    const st = lCur > 0 ? lData.steps[lCur-1] : null;
    const el = document.getElementById('stepText');
    if(el){
      el.innerHTML = st
        ? ('🎬 <b>حرکت ' + lCur + ' از ' + lData.steps.length + ':</b> ' + st.text)
        : '🎬 برای دیدن حرکات این مثال، دکمهٔ ▶ را بزن.';
    }
  }
}

function renderQuizOptions(){
  const L = LEARN_DB[curIdx];
  if(!L.quiz) return;
  answered = false;
  document.getElementById('opts').innerHTML = L.quiz.options
    .map((o, i) => '<button class="opt" onclick="answer(' + i + ')">' + o + '</button>')
    .join('');
  document.getElementById('hintBox').classList.add('hidden');
  document.getElementById('explainBox').classList.add('hidden');
}

function answer(i){
  if(answered) return;
  const L = LEARN_DB[curIdx];
  const btns = [...document.getElementById('opts').children];
  if(i === L.quiz.answer){
    answered = true;
    btns[i].classList.add('correct');
    btns.forEach((b, j) => { if(j !== i) b.disabled = true; });
    document.getElementById('explainBox').classList.remove('hidden');
    markComplete(L.id);
  } else {
    btns[i].classList.add('wrong');
    btns[i].disabled = true;
    document.getElementById('hintBox').classList.remove('hidden');
  }
}

function showHintBox(){ document.getElementById('hintBox').classList.remove('hidden'); }

function markComplete(id){
  if(!completed.includes(id)){
    completed.push(id);
    localStorage.setItem('learn-completed', JSON.stringify(completed));
  }
  const meta = document.querySelector('.lesson-head .meta');
  if(meta && !meta.querySelector('.done-tag')){
    meta.insertAdjacentHTML('beforeend', ' • <span class="done-tag">✅ کامل شد</span>');
  }
  renderLearnList(document.getElementById('search').value);
}

/* ============================================================
   📖 تب گشایش‌ها
   ============================================================ */
let curOp = null;
let openPly = 0;
let openTimer = null;
let openInited = false;
let openBoards = [];
let seen = JSON.parse(localStorage.getItem('seen-openings') || '[]');

function renderOpenList(filter){
  filter = (filter || '').trim();
  let html = '';
  for(const cat of CATEGORIES){
    const items = OPENINGS_DB.filter(o =>
      o.cat === cat.id && (!filter || o.name.includes(filter) || o.en.toLowerCase().includes(filter))
    );
    if(!items.length && filter) continue;
    const done = items.filter(o => seen.includes(o.id)).length;
    html += '<details open><summary>' + cat.name +
      '<span class="cnt">' + done + '/' + items.length + '</span>' +
      '<small>' + cat.desc + '</small></summary>';
    for(const o of items){
      html += '<button class="op-item' +
        (curOp && curOp.id === o.id ? ' active' : '') +
        '" onclick="selectOpening(\'' + o.id + '\')">' +
        (seen.includes(o.id) ? '<span class="done">✔</span> ' : '') +
        o.name + '<small>' + o.en + '</small></button>';
    }
    html += '</details>';
  }
  document.getElementById('openList').innerHTML = html ||
    '<div style="color:#6f7480;font-size:13px;padding:10px">چیزی پیدا نشد 🔍</div>';
  const total = OPENINGS_DB.length;
  const done = OPENINGS_DB.filter(o => seen.includes(o.id)).length;
  document.getElementById('openProgressText').textContent =
    'گشایش‌های دیده‌شده: ' + done + ' از ' + total;
  document.getElementById('openProgressFill').style.width =
    (total ? Math.round(done / total * 100) : 0) + '%';
}

function selectOpening(id){
  curOp = OPENINGS_DB.find(o => o.id === id);
  if(!curOp) return;
  stopPlay();
  document.getElementById('opName').textContent = curOp.name;
  document.getElementById('opEn').textContent = curOp.en;
  document.getElementById('opEco').textContent = curOp.eco;
  document.getElementById('opLevel').textContent = curOp.level;
  document.getElementById('opDesc').textContent = curOp.desc;
  document.getElementById('pros').innerHTML = curOp.strengths.map(x => '<li>' + x + '</li>').join('');
  document.getElementById('cons').innerHTML = curOp.weaknesses.map(x => '<li>' + x + '</li>').join('');
  document.getElementById('plans').innerHTML =
    '<b>نقشهٔ سفید:</b> ' + curOp.plansW +
    '<br><b>نقشهٔ مشکی:</b> ' + curOp.plansB;
  document.getElementById('opTip').innerHTML = '💡 <b>نکتهٔ مربی:</b> ' + curOp.tip;

  openBoards = [initialBoard()];
  let b = openBoards[0].slice();
  for(const mv of curOp.moves){
    b = applyUci(b.slice(), mv.uci);
    openBoards.push(b);
  }
  openPly = 0;
  drawOpen();
  renderOpenMoves();
  renderBubble();
  renderOpenList(document.getElementById('searchOpen').value);
  document.getElementById('openView').scrollIntoView({behavior: 'smooth', block: 'start'});
}

function goTo(n){
  if(!curOp) return;
  openPly = Math.max(0, Math.min(curOp.moves.length, n));
  drawOpen();
  renderOpenMoves();
  renderBubble();
  if(openPly === curOp.moves.length) markSeen();
}

function drawOpen(){
  const last = openPly > 0
    ? {from: parseSq(curOp.moves[openPly-1].uci.slice(0,2)),
       to: parseSq(curOp.moves[openPly-1].uci.slice(2,4))}
    : null;
  renderBoardEl(document.getElementById('mini-board'), openBoards[openPly], [], last);
  document.getElementById('openCaption').textContent = openPly === 0
    ? '🏁 وضعیت شروع گشایش'
    : '🎬 حرکت ' + openPly + ' از ' + curOp.moves.length + ' — ' + curOp.moves[openPly-1].san;
  document.getElementById('openStepText').innerHTML = openPly === 0
    ? 'برای دیدن حرکت‌به‌حرکت گشایش، دکمهٔ ▶ یا «▶️ پخش» را بزن.'
    : ('🎓 <b>' + curOp.moves[openPly-1].san + ':</b> ' + curOp.moves[openPly-1].c);
}

function renderOpenMoves(){
  let html = '';
  for(let i = 0; i < curOp.moves.length; i++){
    html += '<div class="mv' + (openPly === i+1 ? ' cur' : '') +
      '" onclick="goTo(' + (i+1) + ')">' +
      '<span class="n">' + (Math.floor(i/2)+1) + (i%2 === 0 ? '.' : '…') + '</span>' +
      '<span>' + curOp.moves[i].san + '</span></div>';
  }
  document.getElementById('openMoves').innerHTML = html ||
    '<div class="empty">حرکتی ندارد</div>';
  document.getElementById('openMoves').scrollTop = 0;
}

function renderBubble(){
  document.getElementById('coachBubble').innerHTML = openPly === 0
    ? ('🎓 <b>مربی:</b> این گشایش «' + curOp.name + '» است. حرکت‌به‌حرکت جلو برو و توضیح هر حرکت را بخوان. در پایان می‌توانی آن را مستقیم در بازی تمرین کنی!')
    : ('🎓 <b>مربی:</b> ' + curOp.moves[openPly-1].c);
}

function markSeen(){
  if(!seen.includes(curOp.id)){
    seen.push(curOp.id);
    localStorage.setItem('seen-openings', JSON.stringify(seen));
    renderOpenList(document.getElementById('searchOpen').value);
  }
}

function togglePlay(){
  if(openTimer){ stopPlay(); return; }
  if(!curOp) return;
  if(openPly >= curOp.moves.length) goTo(0);
  document.getElementById('btnPlayOpen').textContent = '⏸ توقف';
  openTimer = setInterval(() => {
    if(openPly >= curOp.moves.length){ stopPlay(); return; }
    goTo(openPly + 1);
  }, 1200);
}

function stopPlay(){
  if(openTimer){ clearInterval(openTimer); openTimer = null; }
  document.getElementById('btnPlayOpen').textContent = '▶️ پخش';
}

function practice(){
  if(curOp) practiceOpening(curOp.id);
}

/* ============================================================
   🧩 تب پازل
   ============================================================ */
const PuzzleStorage = {
  KEY: 'chess.puzzle.v1',
  load(){
    try { return JSON.parse(localStorage.getItem(this.KEY)) || this._default(); }
    catch(e){ return this._default(); }
  },
  save(d){ try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch(e){} },
  _default(){ return {lastDay:'', streak:0, maxStreak:0, solvedIds:[], attempts:{}}; },
  todayKey(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  },
  yesterdayKey(){
    const y = new Date(); y.setDate(y.getDate() - 1);
    return y.getFullYear() + '-' + String(y.getMonth()+1).padStart(2,'0') + '-' + String(y.getDate()).padStart(2,'0');
  },
  recordSolve(id){
    const d = this.load();
    const today = this.todayKey();
    if(!d.solvedIds.includes(id)) d.solvedIds.push(id);
    if(d.lastDay !== today){
      if(d.lastDay === this.yesterdayKey()) d.streak++;
      else d.streak = 1;
      d.lastDay = today;
      if(d.streak > d.maxStreak) d.maxStreak = d.streak;
    }
    this.save(d);
  },
  recordAttempt(id){
    const d = this.load();
    d.attempts[id] = (d.attempts[id] || 0) + 1;
    this.save(d);
  }
};

let puzzleState = null;
let puzzleIndex = 0;

function dailyPuzzleIndex(){
  const days = Math.floor(Date.now() / 86400000);
  return days % PUZZLES_DB.length;
}

function loadTodaysPuzzle(){
  puzzleIndex = dailyPuzzleIndex();
  startPuzzle(PUZZLES_DB[puzzleIndex]);
}

function loadPuzzleByOffset(off){
  puzzleIndex = (puzzleIndex + off + PUZZLES_DB.length) % PUZZLES_DB.length;
  startPuzzle(PUZZLES_DB[puzzleIndex]);
}

function startPuzzle(p){
  const turn = (p.fen.split(' ')[1] || 'w');
  puzzleState = {
    puzzle: p,
    board: parseFEN(p.fen),
    turn: turn,
    step: 0,
    done: false,
    failed: false,
    selectedSq: null
  };
  document.getElementById('puzzleTheme').textContent = '🎯 ' + p.theme;
  document.getElementById('puzzleDifficulty').textContent = '📊 ' +
    (PUZZLES_META.difficulties[p.difficulty] || '؟');
  document.getElementById('puzzleExplain').classList.add('hidden');
  document.getElementById('puzzleExplain').innerHTML = '';
  setPuzzleFeedback('نوبت ' + (turn === 'w' ? '⚪ سفید' : '⚫ مشکی') +
    ' است — بهترین حرکت را پیدا کن!', '');
  document.getElementById('puzzleTurn').textContent = 'هدف: پیدا کردن بهترین حرکت';
  renderPuzzleBoard();
  updatePuzzleStats();
}

function setPuzzleFeedback(txt, cls){
  const el = document.getElementById('puzzleFeedback');
  el.className = 'puzzle-feedback' + (cls ? ' ' + cls : '');
  el.innerHTML = txt;
}

function renderPuzzleBoard(){
  if(!puzzleState) return;
  const st = puzzleState;
  let last = null;
  if(st.step > 0){
    const prev = st.puzzle.solution[st.step - 1];
    if(prev) last = {from: parseSq(prev.slice(0,2)), to: parseSq(prev.slice(2,4))};
  }
  const legal = (st.step % 2 === 0 && !st.done && !st.failed) ? puzzleLegalMoves() : [];
  let html = '';
  for(let i = 0; i < 64; i++){
    const r = i >> 3, c = i & 7;
    let cls = 'cell ' + (((r + c) % 2 === 1) ? 'dark' : 'light');
    if(st.selectedSq === i) cls += ' sel';
    if(last && (last.from === i || last.to === i)) cls += ' last';
    const p = st.board[i];
    const hint = st.selectedSq != null && legal.some(m => m.from === st.selectedSq && m.to === i);
    html += '<div class="' + cls + '" data-psq="' + i + '">';
    if(c === 0) html += '<span class="coord rank">' + (8 - r) + '</span>';
    if(r === 7) html += '<span class="coord file">' + FILES[c] + '</span>';
    if(p) html += '<span class="piece ' + (isW(p) ? 'w' : 'b') + '">' + pieceSvg(p, isW(p)) + '</span>';
    if(hint) html += '<span class="dot' + (p ? ' cap' : '') + '"></span>';
    html += '</div>';
  }
  document.getElementById('puzzleBoard').innerHTML = html;
}

function puzzleLegalMoves(){
  const st = puzzleState;
  const fake = {
    board: st.board.slice(),
    turn: st.turn,
    castling: {K:0, Q:0, k:0, q:0},
    ep: -1, half: 0, full: 1
  };
  return legalMoves(fake);
}

function onPuzzleCellClick(sq){
  if(!puzzleState || puzzleState.done || puzzleState.failed) return;
  if(puzzleState.step % 2 !== 0) return;
  const st = puzzleState;
  const p = st.board[sq];
  if(st.selectedSq != null){
    const legal = puzzleLegalMoves();
    const cands = legal.filter(m => m.from === st.selectedSq && m.to === sq);
    if(cands.length){
      const m = cands.find(x => !x.promo) || cands[0];
      tryPuzzleMove(m);
      return;
    }
  }
  st.selectedSq = (p && (st.turn === 'w' ? isW(p) : !isW(p))) ? sq : null;
  renderPuzzleBoard();
}

function uciFromMove(m){
  return sqName(m.from) + sqName(m.to) + (m.promo || '');
}

function applyPuzzleUci(uci){
  const st = puzzleState;
  st.board = applyUci(st.board.slice(), uci);
  st.turn = st.turn === 'w' ? 'b' : 'w';
}

function tryPuzzleMove(m){
  const st = puzzleState;
  const uci = uciFromMove(m);
  const expected = st.puzzle.solution[st.step];
  if(uci === expected){
    applyPuzzleUci(uci);
    st.step++;
    st.selectedSq = null;
    if(st.step >= st.puzzle.solution.length){ puzzleSolved(); return; }
    renderPuzzleBoard();
    setPuzzleFeedback('✅ درست! حالا پاسخ حریف…', 'correct');
    setTimeout(() => {
      if(!puzzleState || puzzleState.done) return;
      const oppUci = puzzleState.puzzle.solution[puzzleState.step];
      if(!oppUci){ puzzleSolved(); return; }
      applyPuzzleUci(oppUci);
      puzzleState.step++;
      renderPuzzleBoard();
      if(puzzleState.step >= puzzleState.puzzle.solution.length){ puzzleSolved(); }
      else { setPuzzleFeedback('✅ ادامه بده…', 'correct'); }
    }, 550);
  } else {
    st.failed = true;
    PuzzleStorage.recordAttempt(st.puzzle.id);
    setPuzzleFeedback('❌ اشتباه! حرکتت درست نبود. یک لحظه صبر کن…', 'wrong');
    st.selectedSq = null;
    renderPuzzleBoard();
    setTimeout(() => {
      if(!puzzleState || !puzzleState.failed) return;
      puzzleState.failed = false;
      setPuzzleFeedback('دوباره تلاش کن — بهترین حرکت را پیدا کن.', '');
      renderPuzzleBoard();
    }, 1400);
  }
}

function puzzleSolved(){
  const st = puzzleState;
  st.done = true;
  PuzzleStorage.recordSolve(st.puzzle.id);
  setPuzzleFeedback('🎉 آفرین! پازل را حل کردی!', 'correct');
  document.getElementById('puzzleTurn').textContent = '✅ حل شد';
  const ex = document.getElementById('puzzleExplain');
  ex.innerHTML = '🎓 <b>توضیح:</b> ' + st.puzzle.explain;
  ex.classList.remove('hidden');
  updatePuzzleStats();
  renderPuzzleBoard();
}

function puzzleHint(){
  if(!puzzleState) return;
  setPuzzleFeedback('💡 <b>راهنمایی:</b> ' + puzzleState.puzzle.hint, '');
}

function puzzleRetry(){
  if(!puzzleState) return;
  startPuzzle(puzzleState.puzzle);
}

function puzzleShowSolution(){
  if(!puzzleState) return;
  setPuzzleFeedback('👁 پاسخ: <b>' + puzzleState.puzzle.solutionSan + '</b>', '');
  const ex = document.getElementById('puzzleExplain');
  ex.innerHTML = '🎓 <b>توضیح:</b> ' + puzzleState.puzzle.explain;
  ex.classList.remove('hidden');
}

function updatePuzzleStats(){
  const d = PuzzleStorage.load();
  const total = PUZZLES_DB.length;
  const solved = d.solvedIds.length;
  document.getElementById('puzzleStats').innerHTML =
    '<div><b>' + solved + '/' + total + '</b><span>حل‌شده</span></div>' +
    '<div><b>' + d.streak + '</b><span>روز متوالی</span></div>' +
    '<div><b>' + d.maxStreak + '</b><span>بهترین رشته</span></div>';
  document.getElementById('puzzleStreak').textContent =
    d.streak > 0 ? '🔥 ' + d.streak + ' روز متوالی' : '🔥 شروع کن!';
}

/* ============================================================
   🎬 تب سینما
   ============================================================ */
const GamesViewer = {
  cur: null,
  allGames: [],
  allBoards: [],
  allSans: [],
  moveSquares: [],
  ply: 0,
  timer: null,
  _speed: 1.0,
  speedIdx: 1,
  baseMs: 1200,
  analysisActive: false,
  lastAnalysis: null,
  _coachResults: null,

  reloadLibrary(){
    const base = (typeof GAMES_DB !== 'undefined') ? GAMES_DB : [];
    this.allGames = window.PGNLoader ? window.PGNLoader.merge(base) : base.slice();
  },

  start(gameId){
    const g = this.allGames.find(x => x.id === gameId);
    if(!g) return;
    this.cur = g;
    this.ply = 0;
    this.stopPlay();

    let sanList;
    if(Array.isArray(g.sans) && g.sans.length){
      sanList = g.sans.slice();
    } else if(g.pgn){
      const parsed = ChessPGN.parse(g.pgn);
      sanList = parsed.moves.filter(t => /^([KQRBNO]|[a-h])/.test(t) && !/^\d/.test(t));
      g.sans = sanList.slice();
    } else {
      sanList = [];
    }

    this.allBoards = [initialBoard()];
    this.allSans = [];
    this.moveSquares = [];
    let s = initialState();
    for(const san of sanList){
      const legal = legalMoves(s);
      const clean = san.replace(/[+#]/g, '');
      let found = null;
      for(const m of legal){
        const s1 = sanOf(s, m, legal);
        if(s1 === san || s1.replace(/[+#]/g, '') === clean){ found = m; break; }
      }
      if(!found) break;
      this.allSans.push(sanOf(s, found, legal));
      this.moveSquares.push({from: found.from, to: found.to});
      s = makeMove(s, found);
      this.allBoards.push(s.board.slice());
    }

    document.getElementById('gvTitle').textContent = g.title;
    document.getElementById('gvWhite').textContent = g.white + (g.whiteElo ? ' (' + g.whiteElo + ')' : '');
    document.getElementById('gvBlack').textContent = g.black + (g.blackElo ? ' (' + g.blackElo + ')' : '');
    document.getElementById('gvEvent').textContent = g.event || '—';
    document.getElementById('gvDate').textContent = g.date || '—';
    document.getElementById('gvResult').textContent = g.result || '*';
    document.getElementById('gvDesc').textContent = g.description || '';

    let fileNameEl = document.getElementById('gvFileName');
    if(!fileNameEl){
      const metaDiv = document.getElementById('gvTitle').parentElement;
      fileNameEl = document.createElement('div');
      fileNameEl.id = 'gvFileName';
      fileNameEl.className = 'gv-file-name';
      metaDiv.appendChild(fileNameEl);
    }
    if(g.fileName){
      fileNameEl.innerHTML = '📄 فایل: <b>' + escapeHtml(g.fileName) + '</b>';
      fileNameEl.classList.remove('hidden');
    } else {
      fileNameEl.classList.add('hidden');
    }

    this._coachResults = null;
    const oldPanel = document.getElementById('gvCoachPanel');
    if(oldPanel) oldPanel.classList.add('hidden');

    document.getElementById('gvAnalysisOutput').textContent = '';
    document.getElementById('gamesEmpty').classList.add('hidden');
    document.getElementById('gamesPlayer').classList.remove('hidden');

    this.goTo(0);
    this.renderList(document.getElementById('searchGames') ? document.getElementById('searchGames').value : '');
  },

  goTo(n){
    if(!this.cur) return;
    this.ply = Math.max(0, Math.min(this.allBoards.length - 1, n));
    this.drawBoard();
    this.drawMoves();
    this.drawCoachBubble();
  },

  drawBoard(){
    const el = document.getElementById('gvBoard');
    if(!el) return;
    const b = this.allBoards[this.ply];
    const prev = this.ply > 0 ? this.allSans[this.ply - 1] : null;
    const last = prev ? this._lastMoveSquares(this.ply - 1) : null;
    const FILES_L = 'abcdefgh';
    let html = '';
    for(let i = 0; i < 64; i++){
      const r = i >> 3, c = i & 7;
      let cls = 'cell ' + (((r + c) % 2 === 1) ? 'dark' : 'light');
      if(last && (last.from === i || last.to === i)) cls += ' llast';
      const p = b[i];
      html += '<div class="' + cls + '">' +
        (c === 0 ? '<span class="coord rank">' + (8 - r) + '</span>' : '') +
        (r === 7 ? '<span class="coord file">' + FILES_L[c] + '</span>' : '') +
        (p ? '<span class="piece ' + (isW(p) ? 'w' : 'b') + '">' + pieceSvg(p, isW(p)) + '</span>' : '') +
        '</div>';
    }
    el.innerHTML = html;
    el.style.touchAction = 'pan-y';

    if(this.ply === 0){
      document.getElementById('gvCaption').textContent = '🏁 وضعیت شروع';
    } else {
      const moveNo = Math.ceil(this.ply / 2);
      const side = (this.ply % 2 === 1) ? '⚪ سفید' : '⚫ مشکی';
      document.getElementById('gvCaption').textContent =
        moveNo + '. ' + this.allSans[this.ply - 1] + ' — ' + side;
    }
  },

  _lastMoveSquares(plyIndex){
    return this.moveSquares[plyIndex] || null;
  },

  drawMoves(){
    const el = document.getElementById('gvMoves');
    if(!el) return;
    let html = '';
    for(let i = 0; i < this.allSans.length; i++){
      if(i % 2 === 0){
        html += '<div class="mv"><span class="n">' + (i/2 + 1) + '.</span>';
      }
      const cls = (i + 1 === this.ply) ? ' cur' : '';
      html += '<span class="' + cls + '" style="min-width:64px;display:inline-block;cursor:pointer" onclick="GamesViewer.goTo(' + (i+1) + ')">' + this.allSans[i] + '</span>';
      if(i % 2 === 1 || i === this.allSans.length - 1){
        html += '</div>';
      }
    }
    el.innerHTML = html || '<div style="color:#6f7480;padding:8px;text-align:center">حرکتی موجود نیست</div>';

    const cur = el.querySelector('.cur');
    if(cur){
      const elRect = el.getBoundingClientRect();
      const curRect = cur.getBoundingClientRect();
      if(curRect.top < elRect.top) el.scrollTop -= (elRect.top - curRect.top);
      else if(curRect.bottom > elRect.bottom) el.scrollTop += (curRect.bottom - elRect.bottom);
    }
  },

  drawCoachBubble(){
    const el = document.getElementById('gvCoachBubble');
    if(!el) return;
    if(this.ply === 0){
      el.innerHTML = '🎓 <b>مربی:</b> این بازی «' + escapeHtml(this.cur.title) +
        '» است. دکمهٔ «▶️ پخش» را بزن یا با ◀ ▶ جلو برو. برای تحلیل هر پوزیسیون، دکمهٔ 🐟 پایین را بزن. برای تحلیل کامل، «🎓 تحلیل کامل بازی» را انتخاب کن.';
      return;
    }
    const moveNo = Math.ceil(this.ply / 2);
    const side = (this.ply % 2 === 1) ? '⚪ سفید' : '⚫ مشکی';
    el.innerHTML = '🎓 <b>مربی:</b> حرکت ' + moveNo + ' — <b>' + this.allSans[this.ply - 1] +
      '</b> توسط ' + side + '. <br><span style="color:#8a8f9c">برای دریافت تحلیل استاک‌فیش، دکمهٔ 🐟 پایین را بزن.</span>';
  },

  togglePlay(){
    if(this.timer){ this.stopPlay(); return; }
    if(this.ply >= this.allBoards.length - 1) this.goTo(0);
    const btn = document.getElementById('gvBtnPlay');
    if(btn){ btn.textContent = '⏸ توقف'; btn.classList.add('playing'); }
    this._scheduleNextStep();
  },

  _scheduleNextStep(){
    const interval = Math.max(80, Math.round(this.baseMs / this._speed));
    this.timer = setTimeout(() => this._playStep(), interval);
  },

  _playStep(){
    if(this.ply >= this.allBoards.length - 1){ this.stopPlay(); return; }
    this.goTo(this.ply + 1);
    if(this.ply >= this.allBoards.length - 1){ this.stopPlay(); return; }
    this._scheduleNextStep();
  },

  stopPlay(){
    if(this.timer){ clearTimeout(this.timer); this.timer = null; }
    const btn = document.getElementById('gvBtnPlay');
    if(btn){ btn.textContent = '▶️ پخش'; btn.classList.remove('playing'); }
  },

  speed(delta){
    const steps = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0];
    let idx = parseInt(this.speedIdx, 10);
    if(!Number.isFinite(idx) || idx < 0 || idx >= steps.length) idx = 1;
    const newIdx = Math.max(0, Math.min(steps.length - 1, idx + delta));
    this.speedIdx = newIdx;
    this._speed = steps[newIdx];
    const label = document.getElementById('gvSpeedLabel');
    if(label){
      const faDigits = '۰۱۲۳۴۵۶۷۸۹';
      const txt = this._speed.toFixed(1).replace(/\d/g, d => faDigits[d]);
      label.textContent = txt + 'x';
      label.classList.remove('speed-bump');
      void label.offsetWidth;
      label.classList.add('speed-bump');
    }
    if(this.timer){
      clearTimeout(this.timer);
      this.timer = null;
      this._scheduleNextStep();
    }
  },

  gvAnalyze(){
    if(!this.cur) return;

    /* ✅ اگر تحلیل کامل در حال اجراست، اول متوقفش کن */
    if (window.GamesCoach && GamesCoach.isActive()) {
      GamesCoach.stopAnalysis();
      const cp = document.getElementById('gvCoachPanel');
      if (cp) cp.classList.add('hidden');
    }

    if(!engineReadyForViewer()){
      document.getElementById('gvAnalysisOutput').textContent = '⚠️ استاک‌فیش هنوز آماده نیست. چند لحظه صبر کن.';
      return;
    }
    this.analysisActive = true;
    this.lastAnalysis = {depth:0, score:null, mate:false, bestmove:null};
    document.getElementById('gvAnalysisOutput').textContent = '🐟 استاک‌فیش در حال تحلیل…';
    const fen = this._currentFen();

    beginEngineSearch('viewer', {
      depth: 15,
      skill: 20,
      position: 'fen ' + fen
    });
  },

  _currentFen(){
    const b = this.allBoards[this.ply];
    let placement = '', empty = 0;
    for(let r = 0; r < 8; r++){
      for(let c = 0; c < 8; c++){
        const p = b[r * 8 + c];
        if(!p) empty++;
        else { if(empty){ placement += empty; empty = 0; } placement += p; }
      }
      if(empty){ placement += empty; empty = 0; }
      if(r < 7) placement += '/';
    }
    const turn = (this.ply % 2 === 0) ? 'w' : 'b';
    return placement + ' ' + turn + ' - - 0 1';
  },

  onInfo(line){
    if(!this.analysisActive) return;
    const ms = line.match(/ score (cp|mate) (-?\d+)/);
    if(ms){
      this.lastAnalysis.mate = ms[1] === 'mate';
      this.lastAnalysis.score = +ms[2];
    }
    const md = line.match(/ depth (\d+)/);
    if(md) this.lastAnalysis.depth = +md[1];
    const pvm = line.match(/ pv (.+)$/);
    if(pvm) this.lastAnalysis.pv = pvm[1].trim().split(/\s+/);

    let txt = '…';
    if(this.lastAnalysis.score !== null){
      if(this.lastAnalysis.mate){
        const m = Math.abs(this.lastAnalysis.score);
        txt = 'مات در ' + m + ' به نفع ' + (this.lastAnalysis.score > 0 ? 'سفید' : 'مشکی');
      } else {
        const turn = (this.ply % 2 === 0) ? 'w' : 'b';
        const v = (this.lastAnalysis.score / 100) * (turn === 'w' ? 1 : -1);
        txt = Math.abs(v) < 0.3 ? 'متعادل' : ((v > 0 ? '+' : '') + v.toFixed(2) + ' به نفع ' + (v > 0 ? 'سفید' : 'مشکی'));
      }
    }
    document.getElementById('gvAnalysisOutput').textContent = '🐟 عمق ' + this.lastAnalysis.depth + ' — ' + txt;
  },

  onBestmove(token){
    if(!this.analysisActive) return;
    this.analysisActive = false;
    if(!token || token === '(none)'){
      document.getElementById('gvAnalysisOutput').textContent = '🐟 تحلیلی موجود نیست.';
      return;
    }
    let evalTxt = 'نامشخص';
    if(this.lastAnalysis.mate){
      const m = Math.abs(this.lastAnalysis.score);
      evalTxt = 'مات در ' + m + ' به نفع ' + (this.lastAnalysis.score > 0 ? 'سفید' : 'مشکی');
    } else if(this.lastAnalysis.score !== null){
      const turn = (this.ply % 2 === 0) ? 'w' : 'b';
      const v = (this.lastAnalysis.score / 100) * (turn === 'w' ? 1 : -1);
      if(Math.abs(v) < 0.3) evalTxt = 'متعادل';
      else evalTxt = (v > 0 ? '+' : '') + v.toFixed(2) + ' به نفع ' + (v > 0 ? 'سفید' : 'مشکی');
    }
    document.getElementById('gvAnalysisOutput').innerHTML =
      '🐟 <b>تحلیل استاک‌فیش</b><br>' +
      '📊 ارزیابی: <b>' + evalTxt + '</b><br>' +
      '🎯 بهترین حرکت: <b>' + gvUciToSan(token) + '</b><br>' +
      '📏 عمق: ' + this.lastAnalysis.depth;
  },

  renderList(filter){
    filter = (filter || '').trim();
    const lf = filter.toLowerCase();
    const baseGames = (typeof GAMES_DB !== 'undefined' ? GAMES_DB : []).filter(g => {
      if(!lf) return true;
      return (g.title || '').toLowerCase().includes(lf) ||
             (g.white || '').toLowerCase().includes(lf) ||
             (g.black || '').toLowerCase().includes(lf) ||
             (g.event || '').toLowerCase().includes(lf);
    });

    let html = '';

    if(baseGames.length){
      const baseGroups = {};
      for(const g of baseGames){
        const key = g.categoryFA || 'درس‌های کلاسیک';
        if(!baseGroups[key]) baseGroups[key] = [];
        baseGroups[key].push(g);
      }
      const order = ['شاهکارهای کلاسیک', 'شاهکارهای معاصر', 'درس‌های کلاسیک'];
      const keys = Object.keys(baseGroups).sort((a, b) => {
        const ai = order.indexOf(a), bi = order.indexOf(b);
        if(ai >= 0 && bi < 0) return -1;
        if(bi >= 0 && ai < 0) return 1;
        if(ai >= 0 && bi >= 0) return ai - bi;
        return a.localeCompare(b, 'fa');
      });

      html += '<div class="games-group-header">📚 کتابخانهٔ اصلی</div>';
      for(const gname of keys){
        const items = baseGroups[gname];
        html += '<details open class="games-group">';
        html += '<summary>' + escapeHtml(gname) + '<span class="cnt">' + items.length + '</span></summary>';
        for(const g of items) html += this._renderGameItem(g, lf);
        html += '</details>';
      }
    }

    const lib = window.PGNLoader ? PGNLoader.loadLibrary() : {fileGroups: []};
    const fileGroups = lib.fileGroups || [];

    if(fileGroups.length){
      html += '<div class="games-group-header">📁 فایل‌های آپلودی</div>';
      for(const group of fileGroups){
        const groupGames = group.games.filter(g => {
          if(!lf) return true;
          return (g.white || '').toLowerCase().includes(lf) ||
                 (g.black || '').toLowerCase().includes(lf) ||
                 (g.event || '').toLowerCase().includes(lf);
        });
        if(!groupGames.length && lf) continue;

        const dt = new Date(group.uploadedAt);
        const dateStr = dt.toLocaleDateString('fa-IR');
        const timeStr = dt.toLocaleTimeString('fa-IR', {hour: '2-digit', minute: '2-digit'});

        html += '<details open class="games-group uploaded-group">';
        html += '<summary>' +
          '<span class="group-name">📄 ' + escapeHtml(group.name) + '</span>' +
          '<span class="cnt">' + group.games.length + '</span>' +
          '<small class="group-date">' + dateStr + ' — ' + timeStr + '</small>' +
          '</summary>';
        html += '<div class="group-actions">' +
          '<button class="group-btn" onclick="event.stopPropagation();GamesViewer.exportGroup(\'' + group.id + '\')" title="دانلود PGN">📥</button>' +
          '<button class="group-btn danger" onclick="event.stopPropagation();GamesViewer.deleteGroup(\'' + group.id + '\')" title="حذف این فایل">🗑</button>' +
          '</div>';
        for(const g of groupGames) html += this._renderGameItem(g, lf);
        html += '</details>';
      }
    }

    document.getElementById('gamesList').innerHTML = html ||
      '<div style="color:#6f7480;padding:10px;font-size:13px">بازی‌ای پیدا نشد 🔍</div>';

    const total = (typeof GAMES_DB !== 'undefined' ? GAMES_DB.length : 0) +
                  (window.PGNLoader ? PGNLoader.stats().count : 0);
    const uploadedCount = window.PGNLoader ? PGNLoader.stats().count : 0;
    const groupCount = fileGroups.length;
    document.getElementById('gamesProgressText').innerHTML =
      '🎬 ' + total + ' بازی' +
      (uploadedCount ? ' <span style="color:#81c784;font-size:11px">(' +
        uploadedCount + ' آپلود در ' + groupCount + ' فایل)</span>' : '');
  },

  _renderGameItem(g, lf){
    const isActive = this.cur && this.cur.id === g.id;
    const cls = 'lsn' + (isActive ? ' active' : '') + (g.uploaded ? ' uploaded' : '');
    const white = escapeHtml(g.white || '?');
    const black = escapeHtml(g.black || '?');
    return '<button class="' + cls + '" onclick="GamesViewer.start(\'' + g.id + '\')">' +
      '<span class="gv-item-text">' +
        '<span class="gv-players">⚪ ' + white + ' <span class="gv-vs">vs</span> ⚫ ' + black + '</span>' +
        '<small class="gv-meta">' + escapeHtml(g.event || '—') + ' • ' + escapeHtml(g.date || '?') + '</small>' +
      '</span>' +
      '<small class="gv-result">' + escapeHtml(g.result || '*') + '</small>' +
    '</button>';
  },

  deleteGroup(groupId){
    if(!confirm('تمام بازی‌های این فایل حذف شوند؟')) return;
    if(window.PGNLoader){
      PGNLoader.removeFileGroup(groupId);
      this.reloadLibrary();
      this.renderList(document.getElementById('searchGames') ? document.getElementById('searchGames').value : '');
      if(this.cur && this.cur.fileGroupId === groupId){
        this.cur = null;
        document.getElementById('gamesEmpty').classList.remove('hidden');
        document.getElementById('gamesPlayer').classList.add('hidden');
      }
    }
  },

  exportGroup(groupId){
    if(!window.PGNLoader) return;
    const pgn = PGNLoader.exportGroupAsPGN(groupId);
    if(!pgn) return;
    const lib = PGNLoader.loadLibrary();
    const group = lib.fileGroups.find(g => g.id === groupId);
    const name = (group ? group.name : 'games').replace(/\.pgn$/i, '');
    const blob = new Blob([pgn], {type: 'application/x-chess-pgn;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.pgn';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  },

  gvAnalyzeFull(){
    if(!this.cur) return;
    if(!window.GamesCoach){ alert('ماژول تحلیل بارگذاری نشده است.'); return; }
    if(GamesCoach.isActive()){ GamesCoach.stopAnalysis(); return; }

    /* ✅ اگر تحلیل پوزیسیون در جریان است، اول متوقفش کن */
    if (this.analysisActive) {
      this.analysisActive = false;
      try { sfSend('stop'); } catch(e){}
      const out = document.getElementById('gvAnalysisOutput');
      if (out) out.textContent = '';
    }

    const panel = document.getElementById('gvCoachPanel');
    if(!panel) return;
    panel.classList.remove('hidden');
    document.getElementById('gvCoachProgress').innerHTML = '⏳ در حال آماده‌سازی...';
    document.getElementById('gvCoachSummary').innerHTML = '';
    document.getElementById('gvCoachList').innerHTML = '';

    const self = this;
    GamesCoach.startAnalysis(this.cur, {
      onStart: function(total){
        document.getElementById('gvCoachProgress').innerHTML = '⏳ در حال تحلیل ۰ از ' + total + ' حرکت...';
      },
      onProgress: function(idx, total, pos){
        const pct = Math.round(100 * idx / total);
        document.getElementById('gvCoachProgress').innerHTML =
          '⏳ تحلیل حرکت ' + (idx + 1) + ' از ' + total + ' — ' +
          '<span style="color:#ffd54f">' + escapeHtml(pos.san) + '</span> ' +
          '<span style="color:#8a8f9c">(' + pct + '%)</span>';
      },
      onComplete: function(results){
        self._coachResults = results;
        self._renderCoachResults(results);
      },
      onError: function(msg){
        document.getElementById('gvCoachProgress').innerHTML = '❌ ' + msg;
      }
    });
  },

  _renderCoachResults(results){
    const total = results.length;
    const counts = {brilliant:0, best:0, excellent:0, good:0, inaccuracy:0, mistake:0, blunder:0};
    let sumScore = 0;
    for(const r of results){
      counts[r.quality] = (counts[r.quality] || 0) + 1;
      sumScore += (GamesCoach.QUALITY[r.quality] || GamesCoach.QUALITY.good).score;
    }
    const avgScore = total > 0 ? Math.round(sumScore / total) : 0;

    const rating = avgScore >= 90 ? {label: '🏆 عالی', color: '#4caf50'}
                : avgScore >= 75 ? {label: '👍 خوب', color: '#81c784'}
                : avgScore >= 55 ? {label: '💪 متوسط', color: '#ffd54f'}
                : avgScore >= 35 ? {label: '📚 نیاز به تمرین', color: '#ff9800'}
                : {label: '🌱 در حال یادگیری', color: '#e57373'};

    let html = '<div class="gv-summary-row">' +
      '<span class="gv-avg" style="color:' + rating.color + '">' + avgScore + '%</span>' +
      '<span class="gv-lbl">' + rating.label + '</span></div>' +
      '<div class="gv-quality-grid">';
    for(const key of ['brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']){
      const q = GamesCoach.QUALITY[key];
      if(!counts[key]) continue;
      html += '<div class="gv-q-item" style="border-color:' + q.color + '">' +
        '<span style="color:' + q.color + ';font-weight:700">' + q.icon + ' ' + q.label + '</span>' +
        '<span class="gv-q-count" style="color:' + q.color + '">' + counts[key] + '</span>' +
        '</div>';
    }
    html += '</div>';
    document.getElementById('gvCoachSummary').innerHTML = html;

    let listHtml = '';
    for(const r of results){
      const q = GamesCoach.QUALITY[r.quality] || GamesCoach.QUALITY.good;
      const moveLabel = (r.color === 'w' ? '⚪' : '⚫') + ' ' + r.moveNumber + (r.color === 'w' ? '.' : '…');
      const evalTxt = r.mate
        ? 'مات ' + Math.abs(r.eval)
        : (r.eval !== null ? (r.eval >= 0 ? '+' : '') + (r.eval / 100).toFixed(1) : '—');
      const suggest = (r.quality !== 'best' && r.bestSan && r.bestSan !== '?')
        ? '<div class="gv-suggest">پیشنهاد: <b style="color:#ffd54f">' + escapeHtml(r.bestSan) + '</b></div>'
        : '';
      listHtml += '<div class="gv-move-row" onclick="GamesViewer.goTo(' + (r.idx + 1) + ')">' +
        '<div class="gv-move-lbl">' + moveLabel + '</div>' +
        '<div class="gv-move-san">' + escapeHtml(r.san) + '</div>' +
        '<div class="gv-move-q" style="color:' + q.color + '">' + q.icon + '</div>' +
        '<div class="gv-move-eval">' + evalTxt + '</div>' +
        suggest +
        '</div>';
    }
    document.getElementById('gvCoachList').innerHTML = listHtml;
    document.getElementById('gvCoachProgress').innerHTML = '✅ تحلیل کامل شد — ' + total + ' حرکت';
  },

  closeCoachPanel(){
    if(window.GamesCoach && GamesCoach.isActive()) GamesCoach.stopAnalysis();
    const p = document.getElementById('gvCoachPanel');
    if(p) p.classList.add('hidden');
  }
};

/* تبدیل UCI به SAN برای نمایش */
function gvUciToSan(uci){
  if(!uci || uci.length < 4) return uci;
  const from = parseSq(uci.slice(0, 2));
  const to = parseSq(uci.slice(2, 4));
  const promo = uci[4] || null;

  /* ✅ محافظت در برابر ply خارج از محدوده یا allBoards بارگذاری‌نشده */
  const boards = GamesViewer && GamesViewer.allBoards;
  if (!boards || !Array.isArray(boards) || boards.length === 0) return uci;
  const ply = GamesViewer.ply;
  if (typeof ply !== 'number' || ply < 0 || ply >= boards.length) return uci;
  const b = boards[ply];
  if (!b) return uci;

  const turn = (ply % 2 === 0) ? 'w' : 'b';
  const fake = {board: b.slice(), turn, castling: {K:0,Q:0,k:0,q:0}, ep: -1, half: 0, full: 1};
  const legal = legalMoves(fake);
  const m = legal.find(x => x.from === from && x.to === to && (x.promo || null) === promo);
  return m ? sanOf(fake, m, legal) : uci;
}
/* ============================================================
   📁 آپلود PGN سینما
   ============================================================ */
function gvUploadPGN(){
  const inp = document.getElementById('gvPGNInput');
  if(!inp) return;
  inp.value = '';
  inp.click();
}

function gvClearLibrary(){
  if(!window.PGNLoader) return;
  const st = PGNLoader.stats();
  if(st.count === 0){ alert('کتابخانهٔ آپلودشده خالی است.'); return; }
  if(!confirm('همهٔ ' + st.count + ' بازی آپلودشده پاک شود؟\n(بازی‌های اصلی GAMES_DB دست‌نخورده می‌مانند)')) return;
  PGNLoader.clear();
  GamesViewer.reloadLibrary();
  GamesViewer.renderList('');
  GamesViewer.cur = null;
  document.getElementById('gamesEmpty').classList.remove('hidden');
  document.getElementById('gamesPlayer').classList.add('hidden');
  gvSetStatus('✅ کتابخانه پاک شد.', '#81c784');
}

function gvSetStatus(msg, color){
  const el = document.getElementById('gvUploadStatus');
  if(!el) return;
  el.textContent = msg;
  el.style.color = color || '#81c784';
}

function gvOnFileSelected(ev){
  const file = ev.target.files && ev.target.files[0];
  if(!file) return;
  gvSetStatus('⏳ در حال خواندن فایل…', '#ffd54f');
  const reader = new FileReader();

  reader.onload = e => {
    try {
      const text = e.target.result;
      gvSetStatus('⏳ در حال پردازش…', '#ffd54f');
      setTimeout(() => {
        try {
          const games = window.PGNLoader.parseMultiPGN(text);
          if(!games.length){
            gvSetStatus('⚠️ هیچ بازی‌ای در فایل پیدا نشد.', '#e57373');
            return;
          }
          const fileName = (file.name || '').replace(/\.pgn$/i, '') || 'بدون نام';
          const res = window.PGNLoader.addFileGroup(fileName, games);
          if(!res.ok){
            gvSetStatus('❌ خطا: ' + (res.error || 'نامشخص'), '#e57373');
            return;
          }
          GamesViewer.reloadLibrary();
          GamesViewer.renderList(document.getElementById('searchGames') ? document.getElementById('searchGames').value : '');
          const parts = [];
          parts.push('✅ ' + games.length + ' بازی خوانده شد');
          parts.push('در فایل «' + fileName + '» ذخیره شد');
          gvSetStatus(parts.join(' • '), '#81c784');
          if(res.warn) setTimeout(() => alert('⚠️ ' + res.warn), 200);
        } catch(err){
          console.error(err);
          gvSetStatus('❌ خطای پردازش: ' + err.message, '#e57373');
        }
      }, 50);
    } catch(err){
      console.error(err);
      gvSetStatus('❌ خطای خواندن فایل', '#e57373');
    }
  };

  reader.onerror = () => gvSetStatus('❌ خواندن فایل ناموفق بود.', '#e57373');
  reader.readAsText(file, 'utf-8');
}

function engineReadyForViewer(){
  return typeof engineReady !== 'undefined' && engineReady &&
         typeof sfSend === 'function' &&
         typeof engine !== 'undefined' && engine === 'stockfish';
}

/* ============================================================
   🎯 اتصال رویدادها
   ============================================================ */
(function bindTabsEvents(){
  const searchLearn = document.getElementById('search');
  if(searchLearn) searchLearn.addEventListener('input', e => renderLearnList(e.target.value));

  const searchOpen = document.getElementById('searchOpen');
  if(searchOpen) searchOpen.addEventListener('input', e => renderOpenList(e.target.value));

  const searchGames = document.getElementById('searchGames');
  if(searchGames) searchGames.addEventListener('input', e => GamesViewer.renderList(e.target.value));

  const gvInp = document.getElementById('gvPGNInput');
  if(gvInp) gvInp.addEventListener('change', gvOnFileSelected);

  const puzBoard = document.getElementById('puzzleBoard');
  if(puzBoard){
    puzBoard.addEventListener('click', e => {
      const cell = e.target.closest('[data-psq]');
      if(!cell) return;
      onPuzzleCellClick(+cell.dataset.psq);
    });
  }
})();

/* ============================================================
   🌐 اتصال به window
   ============================================================ */
window.renderLearnList = renderLearnList;
window.openLesson = openLesson;
window.resetLearn = resetLearn;
window.answer = answer;
window.showHintBox = showHintBox;
window.markComplete = markComplete;

window.renderOpenList = renderOpenList;
window.selectOpening = selectOpening;
window.goTo = goTo;
window.togglePlay = togglePlay;
window.practice = practice;

window.loadTodaysPuzzle = loadTodaysPuzzle;
window.loadPuzzleByOffset = loadPuzzleByOffset;
window.puzzleHint = puzzleHint;
window.puzzleRetry = puzzleRetry;
window.puzzleShowSolution = puzzleShowSolution;
window.onPuzzleCellClick = onPuzzleCellClick;

window.GamesViewer = GamesViewer;
window.gvUploadPGN = gvUploadPGN;
window.gvClearLibrary = gvClearLibrary;
"use strict";
/* ============================================================
   ♟️ chess-game.js — منطق بازی شطرنج
   ------------------------------------------------------------
   وضعیت بازی، ساعت، تم، رندر، جریان بازی، موتور حریف،
   اتصال به استاک‌فیش، و ذخیره‌سازی خودکار.
   ساخته شده توسط امید گروسی
   ============================================================ */

/* ================= توابع کمکی UI ================= */
const $ = id => document.getElementById(id);

/* جلوگیری از XSS */
function escapeHtml(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ================= ثابت‌ها ================= */
const LEVELS_SF = [
  {skill:0,  depth:4},
  {skill:5,  depth:6},
  {skill:10, depth:9},
  {skill:16, depth:12},
  {skill:20, depth:15}
];

/* ================= وضعیت بازی ================= */
let S = initialState();
let hist = [];
let keys = [keyOf(S)];
let humanColor = 'w';
let flipped = false;
let gameOver = null;
let selected = null;
let pendingPromo = null;
let thinking = false;
let searchRole = null;
let gameId = 0;
let searchGen = -1;
let lastEval = null;
let lastDepth = 0;
let searchSide = 'w';
let engine = 'ai';
let sf = null;
let engineReady = false;
let pendingGo = false;
let level = 2;
let timeControl = 'none';
let gameMode = 'vs-engine';
let theme = 'wood';
let engineType = 'lite';   /* 'lite' یا 'full' */

const ENGINE_FILES = {
  lite: 'stockfish-19.js',    /* یا 'stockfish-lite.js' */
  full: 'stockfish-full.js'
};
let audioCtx = null;

/* ================= ساعت شطرنج ================= */
const clock = {
  enabled: false,
  white: 0,
  black: 0,
  increment: 0,
  activeSide: null,
  running: false,
  lastTick: 0,
  timerId: null
};

function formatClock(ms){
  if(ms < 0) ms = 0;
  const shortGame = clock.initialBase && clock.initialBase <= 5;
  const showTenths = shortGame || ms < 20000;
  if(showTenths){
    const totalTenths = Math.floor(ms / 100);
    const m = Math.floor(totalTenths / 600);
    const s = Math.floor((totalTenths % 600) / 10);
    const t = totalTenths % 10;
    return m + ':' + String(s).padStart(2,'0') + '.' + t;
  }
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + String(s).padStart(2,'0');
}

function setupClock(tc){
  stopClock();
  if(!tc || tc === 'none'){
    clock.enabled = false;
    clock.white = 0; clock.black = 0;
    clock.increment = 0;
    renderClocks();
    return;
  }
  const [base, inc] = tc.split('+').map(Number);
  clock.enabled = true;
  clock.white = base * 60 * 1000;
  clock.black = base * 60 * 1000;
  clock.increment = (inc || 0) * 1000;
  clock.initialBase = base;
  clock.activeSide = null;
  renderClocks();
}

function startClock(side){
  if(!clock.enabled) return;
  clock.activeSide = side;
  clock.running = true;
  clock.lastTick = performance.now();
  if(clock.timerId) clearInterval(clock.timerId);
  clock.timerId = setInterval(tickClock, 100);
  renderClocks();
}

function stopClock(){
  if(clock.timerId){
    clearInterval(clock.timerId);
    clock.timerId = null;
  }
  clock.running = false;
  clock.activeSide = null;
  renderClocks();
}

function tickClock(){
  if(!clock.running || !clock.activeSide) return;
  const now = performance.now();
  const elapsed = now - clock.lastTick;
  clock.lastTick = now;
  if(clock.activeSide === 'w'){
    clock.white = Math.max(0, clock.white - elapsed);
    if(clock.white <= 0){ onTimeOut('w'); return; }
  } else {
    clock.black = Math.max(0, clock.black - elapsed);
    if(clock.black <= 0){ onTimeOut('b'); return; }
  }
  renderClocks();
}

function addIncrement(side){
  if(!clock.enabled || !clock.increment) return;
  if(side === 'w') clock.white += clock.increment;
  else if(side === 'b') clock.black += clock.increment;
}

function onTimeOut(side){
  stopClock();
  const winner = side === 'w' ? 'b' : 'w';
  endGame('timeout', winner);
}

function renderClocks(){
  const topEl = $('topClock');
  const botEl = $('botClock');
  if(!topEl || !botEl) return;
  if(!clock.enabled){
    topEl.classList.add('hidden');
    botEl.classList.add('hidden');
    return;
  }
  topEl.classList.remove('hidden');
  botEl.classList.remove('hidden');
  const engSide = humanColor === 'w' ? 'b' : 'w';
  const humanTime = humanColor === 'w' ? clock.white : clock.black;
  const engTime   = engSide === 'w' ? clock.white : clock.black;
  topEl.textContent = formatClock(engTime);
  botEl.textContent = formatClock(humanTime);
  topEl.classList.toggle('active', clock.activeSide === engSide);
  botEl.classList.toggle('active', clock.activeSide === humanColor);
  topEl.classList.toggle('low', engTime < 30000 && engTime > 0);
  botEl.classList.toggle('low', humanTime < 30000 && humanTime > 0);
}

function onTimeChange(v){
  timeControl = v;
  saveOptions();
  setStatus('⏱ زمان بازی روی «' + (v === 'none' ? 'بدون زمان' : v) + '» تنظیم شد — در بازی جدید اعمال می‌شود');
}

/* ================= تم ================= */
function fillThemeSelect(){
  const sel = $('selTheme');
  if(!sel) return;
  sel.innerHTML = THEMES.map(t =>
    '<option value="' + t.id + '">' + t.name + '</option>'
  ).join('');
}

function onThemeChange(id){
  theme = id;
  applyTheme(id);
  saveOptions();
  setStatus('🎨 تم روی «' + getThemeName(id) + '» تغییر کرد');
}
function onEngineChange(v){
  if(v !== 'lite' && v !== 'full') return;
  if(v === engineType) return;

  engineType = v;
  saveOptions();

  if(thinking || Coach.busy){
    setStatus('⏳ اول صبر کن تا تحلیل فعلی تمام شود، بعد موتور را عوض کن.');
    const sel = $('selEngine');
    if(sel) sel.value = engineType;
    return;
  }

  if(v === 'full'){
    if(!confirm(
      'موتور کامل Stockfish حدود ۹۵ مگابایت حجم دارد.\n\n' +
      'در اولین بار، دانلود ممکن است چند دقیقه طول بکشد.\n' +
      'بعد از دانلود، در حافظهٔ مرورگر ذخیره می‌شود و دفعات بعد سریع بارگذاری می‌شود.\n\n' +
      'ادامه بدهم؟'
    )){
      engineType = 'lite';
      saveOptions();
      const sel = $('selEngine');
      if(sel) sel.value = 'lite';
      return;
    }
  }

  showEngineLoadStatus('🔄 در حال بارگذاری موتور ' + (v === 'full' ? 'کامل' : 'لایت') + '…');
  engine = 'stockfish';
  engineReady = false;
  updateBadge();

  if(sf){
    try { sf.terminate(); } catch(e){}
    sf = null;
  }

  setTimeout(() => {
    initStockfish();
  }, 200);
}
let _engineStatusTimer = null;
function showEngineLoadStatus(msg, progress, type, autoHide){
  const el = $('engineLoadStatus');
  if(!el) return;

  el.classList.remove('hidden', 'error', 'success');
  if(type === 'error') el.classList.add('error');
  else if(type === 'success') el.classList.add('success');

  let html = '<div>' + msg + '</div>';
  if(typeof progress === 'number' && progress >= 0){
    html += '<div class="bar"><div class="bar-fill" style="width:' + progress + '%"></div></div>';
  }
  el.innerHTML = html;

  if(_engineStatusTimer) clearTimeout(_engineStatusTimer);
  if(autoHide){
    _engineStatusTimer = setTimeout(() => {
      el.classList.add('hidden');
    }, autoHide);
  }
}

function engineName(){
  return engine === 'stockfish' ? '🤖 استاک‌فیش ۱۹' : '🧠 موتور ساده';
}

/* ================= صدا ================= */
function playSound(type){
  if(!$('chkSound') || !$('chkSound').checked) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = type === 'capture' ? 300 : type === 'end' ? 660 : 500;
    g.gain.setValueAtTime(.18, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .14);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + .15);
  }catch(e){}
}

/* ================= رندر بازی ================= */
function render(){
  const legal = (!gameOver && S.turn === humanColor) ? legalMoves(S) : [];
  const last = hist.length ? hist[hist.length - 1].m : null;
  const checkSq = inCheck(S, S.turn) ? kingSq(S, S.turn === 'w') : -1;
  let html = '';
  for(let i = 0; i < 64; i++){
    const sq = flipped ? 63 - i : i, r = sq >> 3, c = sq & 7;
    let cls = 'cell ' + (((r + c) % 2 === 1) ? 'dark' : 'light');
    if(sq === selected) cls += ' sel';
    if(last && (sq === last.from || sq === last.to)) cls += ' last';
    if(sq === checkSq) cls += ' check';
    if(Coach.move && (sq === Coach.move.from || sq === Coach.move.to)) cls += ' coach';
    const p = S.board[sq];
    const hint = selected != null && legal.some(m => m.from === selected && m.to === sq);
    html += '<div class="' + cls + '" data-sq="' + sq + '">'
      + (c === (flipped ? 7 : 0) ? '<span class="coord rank">' + (8 - r) + '</span>' : '')
      + (r === (flipped ? 0 : 7) ? '<span class="coord file">' + FILES[c] + '</span>' : '')
      + (p ? '<span class="piece ' + (isW(p) ? 'w' : 'b') + '">' + pieceSvg(p, isW(p)) + '</span>' : '')
      + (hint ? '<span class="dot' + (p ? ' cap' : '') + '"></span>' : '')
      + '</div>';
  }
  $('board').innerHTML = html;
  renderPlayers();
  renderMoves();
  updateEvalBar();
  Coach.updateButton();
}

function capsBy(color){
  return hist.filter(h => h.captured && colorOf(h.captured) !== color).map(h => h.captured);
}

function renderPlayers(){
  const eng = humanColor === 'w' ? 'b' : 'w';
  $('topName').textContent = engineName() + ' (حریف) — ' + (eng === 'w' ? '⚪ سفید' : '⚫ مشکی');
  $('botName').textContent = '🧑 شما + 🎓 مربی — ' + (humanColor === 'w' ? '⚪ سفید' : '⚫ مشکی');
  $('topCaps').textContent = capsBy(eng).map(p => GLYPH[p.toLowerCase()]).join('');
  $('botCaps').textContent = capsBy(humanColor).map(p => GLYPH[p.toLowerCase()]).join('');
  const VAL = {p:1, n:3, b:3, r:5, q:9};
  const diff = capsBy('w').reduce((a, p) => a + VAL[p.toLowerCase()], 0)
             - capsBy('b').reduce((a, p) => a + VAL[p.toLowerCase()], 0);
  const topAdv = eng === 'w' ? diff : -diff;
  $('topMat').textContent = topAdv > 0 ? '+' + topAdv : '';
  $('botMat').textContent = topAdv > 0 ? '+' + topAdv : '';
  $('topDots').classList.toggle('on', thinking);
  $('topCheck').style.display = inCheck(S, eng) ? 'inline-block' : 'none';
  $('botCheck').style.display = inCheck(S, humanColor) ? 'inline-block' : 'none';
  renderClocks();
}

function renderMoves(){
  if(!hist.length){
    $('moves').innerHTML = '<div class="empty">هنوز حرکتی ثبت نشده</div>';
    return;
  }
  let html = '';
  for(let i = 0; i < hist.length; i += 2){
    html += '<div class="mrow"><span class="mn">' + (i/2 + 1) + '</span><span>' + hist[i].san
         + '</span><span>' + (hist[i+1] ? hist[i+1].san : '') + '</span></div>';
  }
  $('moves').innerHTML = html;
  $('moves').scrollTop = $('moves').scrollHeight;
}

function updateEvalBar(){
  let pct = 50, label = '0.0';
  if(lastEval){
    const w = lastEval.white;
    pct = 50 + 50 * (2 / (1 + Math.exp(-w / 400)) - 1);
    if(lastEval.mate) label = (w > 0 ? '+' : '−') + 'M' + Math.abs(Math.round((10000 - Math.abs(w))));
    else label = (w >= 0 ? '+' : '') + (w / 100).toFixed(1);
  }
  $('evalFill').style.height = pct + '%';
  $('evalLabel').textContent = label;
}

function setStatus(t){ $('status').textContent = t; }

function updateBadge(){
  if(engine === 'stockfish'){
    const label = engineType === 'full' ? 'استاک‌فیش ۱۹ (کامل)' : 'استاک‌فیش ۱۹ (لایت)';
    $('engineBadge').textContent = '🤖 موتور: ' + label + ' — حریف + مربی';
  } else {
    $('engineBadge').textContent = '🧠 موتور: سادهٔ داخلی (استاک‌فیش در دسترس نبود)';
  }
}

/* ================= جریان بازی ================= */
function applyMove(m){
  const mover = S.turn;
  const legal = legalMoves(S);
  const captured = S.board[m.to] || (m.ep ? (S.turn === 'w' ? 'p' : 'P') : null);
  const before = S;
  const san = sanOf(S, m, legal);
  S = makeMove(S, m);
  hist.push({m, uci: sqName(m.from) + sqName(m.to) + (m.promo || ''), san, before, captured});
  keys.push(keyOf(S));
  playSound(captured ? 'capture' : 'move');
  saveAutoState();
  afterMove(mover);
}

function afterMove(mover){
  selected = null;
  render();
  if(clock.enabled){
    stopClock();
    addIncrement(mover);
    renderClocks();
  }
  const legal = legalMoves(S);
  if(!legal.length){
    if(inCheck(S, S.turn)) endGame('mate', S.turn === 'w' ? 'b' : 'w');
    else endGame('stalemate');
    return;
  }
  if(S.half >= 100) return endGame('fifty');
  if(insufficient(S)) return endGame('material');
  if(keys.filter(x => x === keys[keys.length - 1]).length >= 3) return endGame('repeat');
  if(clock.enabled) startClock(S.turn);
  if(S.turn !== humanColor){
    opponentGo();
  } else {
    setStatus('نوبت شماست ♙');
    if(mover && mover !== humanColor) Coach.afterOpponentMove();
  }
}

function endGame(type, winner){
  stopClock();
  gameOver = {type, winner};
  thinking = false;
  Coach.busy = false;
  render();
  let txt, emoji = '🤝';
  if(type === 'mate'){
    if(winner === humanColor){ txt = 'مات شد! شما برنده شدید 🎉'; emoji = '🏆'; }
    else { txt = 'مات شدید! حریف برد'; emoji = '🤖'; }
  }
  else if(type === 'timeout'){
    if(winner === humanColor){ txt = '⏰ زمان حریف تمام شد! برنده شدی 🎉'; emoji = '🏆'; }
    else { txt = '⏰ زمانت تمام شد! حریف برد'; emoji = '⌛'; }
  }
  else if(type === 'stalemate') txt = 'پات — بازی مساوی شد';
  else if(type === 'fifty') txt = 'تساوی — قانون پنجاه حرکت';
  else if(type === 'repeat') txt = 'تساوی — تکرار سه‌گانهٔ وضعیت';
  else if(type === 'material') txt = 'تساوی — مهره‌های ناکافی';

  $('endEmoji').textContent = emoji;
  $('endText').textContent = txt;
  $('overlayEnd').classList.remove('hidden');
  setStatus(txt);
  playSound('end');
  renderRatingChangeInEnd();
  Coach.say(
    (winner === humanColor)
      ? '🎓 مربی: عالی بود! با هم بردیم 🏆'
      : '🎓 مربی: اشکالی ندارد، دوباره تلاش می‌کنیم. از اشتباه‌ها یاد بگیر 💪',
    'sys'
  );
  recordGameResult();
  ChessStorage.autoClear();
}

function hideEnd(){ $('overlayEnd').classList.add('hidden'); }

function abortAllSearches(){
  if(thinking || Coach.busy){
    gameId++;
    sfSend('stop');
    thinking = false;
    Coach.busy = false;
    searchRole = null;
  }
}

function newGame(){
  abortAllSearches();
  gameId++;
  S = initialState();
  hist = [];
  keys = [keyOf(S)];
  gameOver = null;
  selected = null;
  lastEval = null;
  lastDepth = 0;
  pendingGo = false;
  window._lastRatingChange = null;
  hideEnd();
  closePromo();
  ChessStorage.autoClear();
  if(engine === 'stockfish') sfSend('ucinewgame');
  setupClock(timeControl);
  render();
  Coach.reset();
  if(clock.enabled) startClock('w');
  if(humanColor === 'b'){
    setStatus('بازی جدید — نوبت حریف است ⏳');
    opponentGo();
  } else {
    setStatus('بازی جدید — نوبت شماست ♙');
  }
}

function undo(){
  abortAllSearches();
  if(!hist.length) return;
  pop1();
  if(S.turn !== humanColor && hist.length) pop1();
  gameOver = null;
  selected = null;
  lastEval = null;
  Coach.stop();
  Coach.move = null;
  hideEnd();
  render();
  setStatus('حرکت برگشت — نوبت شماست');
}

function pop1(){
  const h = hist.pop();
  keys.pop();
  S = h.before;
}

function flip(){ flipped = !flipped; render(); }

function onSideChange(v){
  humanColor = v;
  flipped = (v === 'b');
  saveOptions();
  newGame();
}

function onLevelChange(v){
  level = +v;
  saveOptions();
  Coach.updateStrengthInfo();
  setStatus('سختی حریف تغییر کرد ✅ (مربی همچنان قوی‌تر می‌ماند)');
}

/* ================= تعامل کاربر ================= */
$('board').addEventListener('click', e => {
  const cell = e.target.closest('[data-sq]');
  if(!cell) return;
  if(pendingPromo){ closePromo(); return; }
  if(gameOver || thinking || S.turn !== humanColor) return;
  const sq = +cell.dataset.sq;
  const legal = legalMoves(S);
  if(selected != null){
    const cands = legal.filter(m => m.from === selected && m.to === sq);
    if(cands.length){
      if(cands[0].promo){ openPromo(cands); return; }
      humanMove(cands[0], legal);
      return;
    }
  }
  const p = S.board[sq];
  selected = (p && colorOf(p) === humanColor) ? sq : null;
  render();
});

function humanMove(m, legal){
  const humanSan = sanOf(S, m, legal);
  const humanUci = sqName(m.from) + sqName(m.to) + (m.promo || '');
  const sugg = Coach.move ? {san: Coach.move.san, uci: Coach.move.uci} : null;
  Coach.onHumanMove(m, humanSan, humanUci);
  gameId++;
  applyMove(m);
  const last = hist[hist.length - 1];
  if(last){
    last.matched = !!(sugg && sugg.uci === humanUci);
    last.suggestedSan = sugg ? sugg.san : '';
    last.humanSan = humanSan;
  }
  Coach.afterHumanMove();
}

function openPromo(cands){
  pendingPromo = cands;
  const white = humanColor === 'w';
  $('promoBtns').innerHTML = cands.map(m =>
    '<button data-p="' + m.promo + '" class="promoBtn ' + (white ? 'pw' : 'pb') + '">'
    + pieceSvg(m.promo, white) + '</button>'
  ).join('');
  $('promoBox').classList.remove('hidden');
}

$('promoBtns').addEventListener('click', e => {
  const b = e.target.closest('[data-p]');
  if(!b || !pendingPromo) return;
  const m = pendingPromo.find(x => x.promo === b.dataset.p);
  closePromo();
  if(m) humanMove(m, legalMoves(S));
});

$('promoBox').addEventListener('click', e => {
  if(!e.target.closest('.pcard')) closePromo();
});

function closePromo(){
  pendingPromo = null;
  $('promoBox').classList.add('hidden');
}

/* ================= موتور حریف ================= */
function opponentGo(){
  if(engine === 'stockfish') sfOpponentGo();
  else aiOpponentGo();
}

function sfOpponentGo(){
  if(!engineReady){ pendingGo = true; return; }
  thinking = true;
  searchSide = S.turn;
  lastEval = null;
  lastDepth = 0;
  render();
  setStatus('🤖 حریف فکر می‌کند…');
  let maxDepth = LEVELS_SF[level].depth;
  if(clock.enabled){
    const remaining = S.turn === 'w' ? clock.white : clock.black;
    if(remaining < 5000) maxDepth = 1;
    else if(remaining < 15000) maxDepth = Math.min(maxDepth, 4);
    else if(remaining < 30000) maxDepth = Math.min(maxDepth, 8);
  }
  const position = 'startpos' + (hist.length ? ' moves ' + hist.map(h => h.uci).join(' ') : '');
  onBestmove._t0 = Date.now();
  beginEngineSearch('opponent', {
    depth: maxDepth,
    skill: LEVELS_SF[level].skill,
    position: position
  });
}

function aiOpponentGo(){
  thinking = true;
  searchGen = gameId;
  searchSide = S.turn;
  searchRole = 'opponent';
  render();
  setStatus('🤖 حریف فکر می‌کند…');
  const minDelay = clock.enabled ? 500 : 250;
  setTimeout(() => {
    if(searchGen !== gameId || gameOver){ thinking = false; render(); return; }
    const depths = [1, 2, 3, 4, 4];
    const jitters = [90, 35, 15, 10, 10];
    const res = chooseAiMove(S, depths[level], jitters[level]);
    thinking = false;
    if(searchGen !== gameId || gameOver){ render(); return; }
    if(res){
      lastEval = {mate:false, white: S.turn === 'w' ? res.v : -res.v};
      updateEvalBar();
      applyMove(res.m);
    }
  }, minDelay);
}

/* ================= اتصال به استاک‌فیش ================= */
function sfSend(t){ if(sf) sf.postMessage(t); }

/* ============================================================
   🔄 هماهنگی جستجوهای استاک‌فیش
   ------------------------------------------------------------
   برای جلوگیری از تداخل پاسخ‌ها بین تحلیل‌های مختلف، هر شروع
   جستجو ابتدا جستجوی قبلی را متوقف می‌کند و bestmove ارسال‌شده
   توسط آن را دور می‌ریزد. این کار از race condition بین تب‌ها
   (بازی، سینما، کتاب‌ها، آکادمی) جلوگیری می‌کند.
   ============================================================ */
let _engineBusy = false;
let _pendingStopResolve = null;

function stopEngineSearch() {
  if (!sf || !engineReady || !_engineBusy) return Promise.resolve();
  /* ✅ role را پاک کن تا پاسخ‌های قدیمی به هندلر اشتباه نروند */
  searchRole = null;
  return new Promise(resolve => {
    _pendingStopResolve = resolve;
    try { sfSend('stop'); } catch (e) {
      _pendingStopResolve = null;
      _engineBusy = false;
      resolve();
      return;
    }
    /* ضمانت: اگر به هر دلیل bestmove نیامد، بعد از ۵۰۰ms رها کن */
    setTimeout(() => {
      if (_pendingStopResolve === resolve) {
        _pendingStopResolve = null;
        _engineBusy = false;
        resolve();
      }
    }, 500);
  });
}

function beginEngineSearch(role, config) {
  /* config: { depth, skill, position } */
  return stopEngineSearch().then(() => {
    _engineBusy = true;
    searchRole = role;
    searchGen = gameId;
    if (config.skill !== undefined) {
      sfSend('setoption name Skill Level value ' + config.skill);
    }
    sfSend('position ' + config.position);
    sfSend('go depth ' + config.depth);
  });
}

function switchToAI(msg){
  engine = 'ai';
  engineReady = true;
  $('overlayLoad').classList.add('hidden');
  updateBadge();
  Coach.updateStrengthInfo();
  if(msg) setStatus(msg);
  if(pendingGo){ pendingGo = false; opponentGo(); }
  else if(Coach.pending){ Coach.onEngineReady(); }
}

/* ============================================================
   ⬇️ پیش‌دانلود WASM با پیشرفت و تلاش مجدد
   ============================================================ */
async function prefetchWasmWithProgress(wasmFile, onProgress){
  console.log('⬇️ شروع دانلود WASM:', wasmFile);
  let lastError = null;

  for(let attempt = 1; attempt <= 3; attempt++){
    try {
      const response = await fetch(wasmFile, { cache: 'no-cache' });
      if(!response.ok) throw new Error('HTTP ' + response.status + ' ' + response.statusText);

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      let lastReport = 0;

      while(true){
        const { done, value } = await reader.read();
        if(done) break;
        chunks.push(value);
        received += value.length;

        const now = Date.now();
        if(onProgress && now - lastReport > 150){
          lastReport = now;
          const pct = contentLength > 0 ? Math.round((received / contentLength) * 100) : -1;
          onProgress(received, contentLength, pct);
        }
      }

      if(contentLength > 0 && received !== contentLength){
        throw new Error(`دانلود ناقص: ${received} از ${contentLength} بایت`);
      }

      /* ترکیب تمام chunkها در یک بافر */
      const buffer = new Uint8Array(received);
      let offset = 0;
      for(const chunk of chunks){
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      /* ساخت Blob URL با MIME type درست */
      const blob = new Blob([buffer], { type: 'application/wasm' });
      const blobUrl = URL.createObjectURL(blob);

      console.log('✅ WASM آماده است:', received, 'بایت');
      return { blobUrl, size: received };

    } catch(err){
      lastError = err;
      console.error(`❌ تلاش ${attempt} ناموفق:`, err.message);
      if(attempt < 3){
        console.log('⏳ تلاش مجدد در ۲ ثانیه…');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw lastError || new Error('دانلود WASM ناموفق بود');
}

/* ============================================================
   🚀 بارگذاری استاک‌فیش با پیش‌دانلود
   ============================================================ */
async function initStockfish(){
  try{
    const file = ENGINE_FILES[engineType] || ENGINE_FILES.lite;
    const isFull = engineType === 'full';

    console.log('🚀 در حال بارگذاری موتور:', file, '| نوع:', engineType);

    /* ۱) پیش‌دانلود WASM با کنترل کامل */
    const wasmFile = file.replace(/\.js$/i, '.wasm');

    if(isFull){
      showEngineLoadStatus('در حال دانلود موتور کامل (۹۴MB) — اولین بار ممکن است چند دقیقه طول بکشد…');
    }

    let wasmUrl = null;
    try {
      const result = await prefetchWasmWithProgress(wasmFile, (received, total, pct) => {
        if(isFull){
          const receivedMB = (received / 1048576).toFixed(1);
          const totalMB = total > 0 ? (total / 1048576).toFixed(1) : '?';
          const eta = pct > 0 ? '' : '';
          showEngineLoadStatus(
            `در حال دانلود موتور کامل — ${pct}% (${receivedMB} از ${totalMB}MB)`,
            pct
          );
        }
      });
      wasmUrl = result.blobUrl;
    } catch(fetchErr){
      console.error('❌ پیش‌دانلود ناموفق، تلاش برای بارگذاری مستقیم:', fetchErr);
      showEngineLoadStatus(
        '⚠️ دانلود مستقیم ناموفق بود. تلاش برای روش جایگزین…',
        null,
        'error'
      );
    }

    /* ۲) ساخت Worker با یا بدون Blob URL */
    const workerUrl = wasmUrl
      ? file + '#' + encodeURIComponent(wasmUrl)
      : file;

    console.log('🚀 ساخت worker:', workerUrl.substring(0, 120) + (workerUrl.length > 120 ? '…' : ''));

    sf = new Worker(workerUrl);

    /* ۳) پیشرفت داخلی Stockfish (اگر پیش‌دانلود موفق بود، اینجا فقط ۱۰۰% نشان می‌دهد) */
    const ch = new MessageChannel();
    ch.port1.onmessage = ev => {
      const d = ev.data;
      if(d && typeof d.percent === 'number'){
        const pct = Math.round(d.percent * 100);
        const loadFill = document.getElementById('loadFill');
        const loadText = document.getElementById('loadText');
        if(loadFill) loadFill.style.width = pct + '%';
        if(loadText) loadText.textContent = pct + '% — ' + (d.speedText || '') + ' ' + (d.etaText || '');
      }
    };
    sf.postMessage({ progressPort: ch.port1 }, [ch.port1]);

    /* ۴) پیام‌های Worker */
    sf.onmessage = e => {
      if(typeof e.data === 'string') handleLine(e.data.trim());
    };

    sf.onerror = e => {
      console.error('❌ stockfish worker error:', e);
      if(!engineReady){
        showEngineLoadStatus(
          '⚠️ موتور بارگذاری نشد. تلاش برای موتور ساده…',
          null,
          'error'
        );
        switchToAI('استاک‌فیش بارگذاری نشد؛ موتور ساده جایگزین شد.');
      }
    };

    /* ۵) شروع UCI */
    sfSend('uci');
  }catch(err){
    console.error('❌ initStockfish failed:', err);
    showEngineLoadStatus(
      '⚠️ خطا در بارگذاری موتور: ' + err.message,
      null,
      'error'
    );
    switchToAI('ساخت ورکر ممکن نشد؛ موتور ساده جایگزین شد.');
  }
}

function handleLine(line){
  if(!line) return;
  if(line === 'uciok'){ sfSend('isready'); return; }
  
  if(line === 'readyok'){
    engineReady = true;
    $('overlayLoad').classList.add('hidden');
    updateBadge();
    Coach.updateStrengthInfo();
    
    /* ⭐ نمایش پیام موفقیت بارگذاری موتور */
    showEngineLoadStatus(
      '✅ موتور ' + (engineType === 'full' ? 'کامل' : 'لایت') + ' آماده است.',
      null,
      'success',
      2000
    );

    if(pendingGo){ pendingGo = false; sfOpponentGo(); }
    else Coach.onEngineReady();
    if(!pendingGo && S.turn === humanColor && !Coach.busy) setStatus('استاک‌فیش آماده است — نوبت شماست ♙');
    return;
  }
  
  if(line.startsWith('bestmove')){
    const token = line.split(' ')[1];
    if(searchRole === 'viewer'){ GamesViewer.onBestmove(token); return; }
    if(searchRole === 'lesson-board'){
      if(window.LessonBoard) LessonBoard.onStockfishBestmove(token);
      searchRole = null;
      return;
    }
    if(searchRole === 'games-coach'){
      if(window.GamesCoach) GamesCoach.onBestmove(token);
      return;
    }
    onBestmove(token);
    return;
  }
  
  if(line.startsWith('info')){
    if(searchRole === 'lesson-board'){
      if(window.LessonBoard) LessonBoard.onStockfishInfo(line);
      return;
    }
    if(searchRole === 'games-coach'){
      if(window.GamesCoach) GamesCoach.onInfo(line);
      return;
    }
    parseInfo(line);
  }
}
function onBestmove(token){
  const role = searchRole;
  searchRole = null;
  if(role === 'lesson'){
    if(window.LiveLessons && window.LiveLessons.onStockfishBestmove)
      window.LiveLessons.onStockfishBestmove(token);
    return;
  }
  if(searchGen !== gameId || gameOver){
    Coach.busy = false;
    thinking = false;
    render();
    return;
  }
  if(role === 'coach'){ Coach.bestmove(token); return; }
  const minThinkMs = clock.enabled ? 500 : 0;
  const elapsed = Date.now() - (onBestmove._t0 || Date.now());
  if(minThinkMs && onBestmove._t0){
    const wait = Math.max(0, minThinkMs - elapsed);
    if(wait > 0){
      setTimeout(() => {
        thinking = false;
        onBestmove._t0 = 0;
        const from = parseSq(token.slice(0, 2));
        const to = parseSq(token.slice(2, 4));
        const promo = token[4] || null;
        const m = legalMoves(S).find(x => x.from === from && x.to === to && (x.promo || null) === (promo || null));
        if(!m){ setStatus('⚠️ حرکت نامعتبر از موتور'); render(); return; }
        applyMove(m);
      }, wait);
      return;
    }
  }
  thinking = false;
  onBestmove._t0 = 0;
  const from = parseSq(token.slice(0, 2));
  const to = parseSq(token.slice(2, 4));
  const promo = token[4] || null;
  const m = legalMoves(S).find(x => x.from === from && x.to === to && (x.promo || null) === (promo || null));
  if(!m){ setStatus('⚠️ حرکت نامعتبر از موتور'); render(); return; }
  applyMove(m);
}

function parseInfo(line){
  if(searchRole === 'lesson'){
    if(window.LiveLessons && window.LiveLessons.onStockfishInfo)
      window.LiveLessons.onStockfishInfo(line);
    return;
  }
  if(searchRole === 'viewer'){ GamesViewer.onInfo(line); return; }
  if(searchGen !== gameId) return;
  const ms = line.match(/ score (cp|mate) (-?\d+)/);
  if(!ms) return;
  const md = line.match(/ depth (\d+)/);
  if(md) lastDepth = +md[1];
  let v = ms[1] === 'cp' ? +ms[2] : (+ms[2] > 0 ? 10000 - (+ms[2]) : -(10000 - (+ms[2])));
  lastEval = {mate: ms[1] === 'mate', white: searchSide === 'w' ? v : -v};
  updateEvalBar();
  if(searchRole === 'coach'){ Coach.parseInfo(line); return; }
  if(thinking){
    const ev = lastEval.mate
      ? 'مات در ' + Math.abs(Math.round((10000 - Math.abs(lastEval.white))))
      : ((lastEval.white >= 0 ? '+' : '') + (lastEval.white / 100).toFixed(2));
    setStatus('🤖 حریف فکر می‌کند… عمق ' + lastDepth + ' | ' + ev);
  }
}

/* ================= تمرین گشایش ================= */
function practiceOpening(id){
  const op = (typeof OPENINGS_DB !== 'undefined') ? OPENINGS_DB.find(o => o.id === id) : null;
  switchTab('game');
  if(!op) return;
  abortAllSearches();
  gameId++;
  S = initialState();
  hist = [];
  keys = [keyOf(S)];
  gameOver = null;
  selected = null;
  lastEval = null;
  lastDepth = 0;
  Coach.stop();
  Coach.move = null;
  for(const mv of op.moves){
    const legal = legalMoves(S);
    const from = parseSq(mv.uci.slice(0, 2));
    const to = parseSq(mv.uci.slice(2, 4));
    const promo = mv.uci[4] || null;
    const m = legal.find(x => x.from === from && x.to === to && (x.promo || null) === (promo || null));
    if(!m) break;
    const captured = S.board[m.to] || (m.ep ? (S.turn === 'w' ? 'p' : 'P') : null);
    const before = S;
    S = makeMove(S, m);
    hist.push({m, uci: mv.uci, san: mv.san, before, captured});
    keys.push(keyOf(S));
  }
  hideEnd();
  closePromo();
  if(engine === 'stockfish') sfSend('ucinewgame');
  render();
  Coach.say('📖 گشایش «' + op.name + '» بارگذاری شد — از اینجا ادامه بده!', 'sys');
  if(S.turn !== humanColor) opponentGo();
  else if($('chkAutoCoach').checked) Coach.go();
}

/* ================= ذخیره‌سازی خودکار ================= */
function saveAutoState(){
  if(gameOver) return;
  try{
    ChessStorage.autoSave({
      S: {board: S.board, turn: S.turn, castling: S.castling,
          ep: S.ep, half: S.half, full: S.full},
      hist: hist,
      keys: keys,
      humanColor, flipped, level, timeControl,
      engineType: engine,
      clock: clock.enabled ? {
        enabled: true,
        white: clock.white,
        black: clock.black,
        increment: clock.increment,
        activeSide: clock.activeSide
      } : {enabled: false}
    });
  }catch(e){ console.warn('auto-save failed', e); }
}


function loadSavedOptions(){
  const o = ChessStorage.optsLoad();
  if(o.humanColor) humanColor = o.humanColor;
  if(o.level != null) level = +o.level;
  if(o.flipped != null) flipped = !!o.flipped;
  if(o.theme) theme = o.theme;
  if(o.engineType === 'lite' || o.engineType === 'full') engineType = o.engineType;
  
  const selSide = $('selSide'); if(selSide) selSide.value = humanColor;
  const selLvl = $('selLevel'); if(selLvl) selLvl.value = String(level);
  const chkSound = $('chkSound'); if(chkSound && o.sound != null) chkSound.checked = !!o.sound;
  const chkAutoCoach = $('chkAutoCoach'); if(chkAutoCoach && o.autoCoach != null) chkAutoCoach.checked = !!o.autoCoach;
  
  if(o.timeControl){
    timeControl = o.timeControl;
    const selTime = $('selTime');
    if(selTime) selTime.value = timeControl;
  }
  
  fillThemeSelect();
  const selTheme = $('selTheme'); if(selTheme) selTheme.value = theme;
  applyTheme(theme);
  
  const selEngine = $('selEngine'); if(selEngine) selEngine.value = engineType;
  setupClock(timeControl);
}


function saveOptions(){
  try{
    ChessStorage.optsSave({
      humanColor, level, flipped, timeControl, theme, engineType,
      sound: $('chkSound') ? $('chkSound').checked : true,
      autoCoach: $('chkAutoCoach') ? $('chkAutoCoach').checked : true
    });
  }catch(e){}
}


function checkAutoSave(){
  const banner = $('resumeBanner');
  if(!banner) return;
  if(ChessStorage.hasAuto()) banner.classList.remove('hidden');
  else banner.classList.add('hidden');
}

function resumeSavedGame(){
  const data = ChessStorage.autoLoad();
  const banner = $('resumeBanner');
  if(banner) banner.classList.add('hidden');
  if(!data) return;

  /* ✅ هر جستجوی در جریانی را لغو کن تا با بازی بازیابی‌شده تداخل نکند */
  abortAllSearches();
  gameId++;

  try{
    S = data.S;
    hist = data.hist || [];
    keys = data.keys || [keyOf(S)];
    humanColor = data.humanColor || 'w';
    flipped = !!data.flipped;
    level = data.level ?? 2;
    gameOver = null;
    selected = null;
    pendingPromo = null;
    hideEnd();
    closePromo();
    if(engine === 'stockfish') sfSend('ucinewgame');
    if(data.timeControl){
      timeControl = data.timeControl;
      const selTime = $('selTime');
      if(selTime) selTime.value = timeControl;
    }
    setupClock(timeControl);
    if(data.clock && data.clock.enabled){
      clock.enabled = true;
      clock.white = data.clock.white;
      clock.black = data.clock.black;
      clock.increment = data.clock.increment;
      renderClocks();
    }
    render();
    Coach.reset();
    if(S.turn !== humanColor){
      opponentGo();
    } else {
      setStatus('بازی بازیابی شد — نوبت شماست ♙');
      if(clock.enabled) startClock(S.turn);
      if($('chkAutoCoach').checked) Coach.go();
    }
  }catch(e){
    console.error('resume failed', e);
    if(confirm('بازیابی ناموفق بود. بازی ذخیره‌شده پاک شود؟'))
      ChessStorage.autoClear();
    checkAutoSave();
  }
}

function discardSavedGame(){
  ChessStorage.autoClear();
  checkAutoSave();
  newGame();
}

/* ================= اندازهٔ صفحه ================= */
function updateBoardSize(){
  const frameWrap = document.querySelector('.frame-wrap');
  if(!frameWrap) return;
  const avail = frameWrap.clientWidth;
  if(avail <= 0) return;
  const reserved = 30;
  const maxSize = 520;
  const minSize = 220;
  const size = Math.max(minSize, Math.min(avail - reserved, maxSize));
  document.documentElement.style.setProperty('--size', size + 'px');
  document.documentElement.style.setProperty('--cell', (size / 8) + 'px');
}

let _sizeTimer = null;
function scheduleBoardSize(){
  clearTimeout(_sizeTimer);
  _sizeTimer = setTimeout(updateBoardSize, 120);
}

window.addEventListener('resize', scheduleBoardSize, {passive: true});
window.addEventListener('orientationchange', scheduleBoardSize, {passive: true});
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', scheduleBoardSize, {passive: true});
}
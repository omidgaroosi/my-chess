"use strict";
/* ============================================================
   📄 chess-records.js — PGN، تاریخچه، تحلیل، رتبه
   ------------------------------------------------------------
   صادرات و ورود PGN، تاریخچهٔ بازی‌ها، تحلیل بعد از بازی،
   و سیستم رتبه (ELO).
   ساخته شده توسط امید گروسی
   ============================================================ */

/* ============================================================
   📄 PGN — Export و Import
   ============================================================ */

function sanListToUci(sanList){
  const out = [];
  let s = initialState();
  for(const san of sanList){
    const legal = legalMoves(s);
    let found = null;
    const clean = san.replace(/[+#]/g, '');
    for(const m of legal){
      const s1 = sanOf(s, m, legal);
      if(s1 === san || s1.replace(/[+#]/g, '') === clean){ found = m; break; }
    }
    if(!found) break;
    out.push({
      uci: sqName(found.from) + sqName(found.to) + (found.promo || ''),
      san: sanOf(s, found, legal)
    });
    s = makeMove(s, found);
  }
  return out;
}

function currentGameMetadata(){
  const engineLbl = engine === 'stockfish' ? 'Stockfish 19 Lite' : 'Simple AI';
  const userLbl = 'Omid Garousi';
  return {
    white: humanColor === 'w' ? userLbl : engineLbl,
    black: humanColor === 'w' ? engineLbl : userLbl,
    eventName: 'بازی با موتور — my-chess',
    annotator: 'امید گروسی'
  };
}

function historyResultToPGN(g){
  if(g.result === 'win')  return g.humanColor === 'w' ? '1-0' : '0-1';
  if(g.result === 'loss') return g.humanColor === 'w' ? '0-1' : '1-0';
  return '1/2-1/2';
}

function exportCurrentPGN(){
  if(!hist.length){
    alert('هنوز حرکتی انجام نشده که ذخیره شود.');
    return;
  }
  const meta = currentGameMetadata();
  const result = gameOver
    ? (gameOver.type === 'mate'
        ? (gameOver.winner === 'w' ? '1-0' : '0-1')
        : '1/2-1/2')
    : '*';
  const pgn = ChessPGN.buildGamePGN({
    white: meta.white,
    black: meta.black,
    result,
    movesSan: hist.map(h => h.san),
    eventName: meta.eventName,
    annotator: meta.annotator
  });
  const fname = `chess-${ChessPGN.formatDateISO().replace(/\./g, '-')}-${hist.length}mv.pgn`;
  ChessPGN.download(fname, pgn);
}

function exportHistoryPGN(id){
  const g = ChessStorage.histAll().find(x => x.id === id);
  if(!g) return;
  const tokens = String(g.movesSan || '').split(/\s+/).filter(Boolean);
  const engineLbl = g.engine === 'stockfish' ? 'Stockfish 19 Lite' : 'Simple AI';
  const userLbl = 'Omid Garousi';
  const pgn = ChessPGN.buildGamePGN({
    white: g.humanColor === 'w' ? userLbl : engineLbl,
    black: g.humanColor === 'b' ? userLbl : engineLbl,
    result: historyResultToPGN(g),
    movesSan: tokens,
    eventName: 'بازی ذخیره‌شده — my-chess',
    annotator: 'امید گروسی'
  });
  ChessPGN.download(`game-${g.id}.pgn`, pgn);
}

function exportAllPGN(){
  const arr = ChessStorage.histAll();
  if(!arr.length){ alert('هنوز بازی‌ای ذخیره نشده است.'); return; }
  const parts = arr.map(g => {
    const tokens = String(g.movesSan || '').split(/\s+/).filter(Boolean);
    const engineLbl = g.engine === 'stockfish' ? 'Stockfish 19 Lite' : 'Simple AI';
    const userLbl = 'Omid Garousi';
    return ChessPGN.buildGamePGN({
      white: g.humanColor === 'w' ? userLbl : engineLbl,
      black: g.humanColor === 'b' ? userLbl : engineLbl,
      date: new Date(g.ts).toISOString().slice(0, 10).replace(/-/g, '.'),
      result: historyResultToPGN(g),
      movesSan: tokens,
      eventName: 'بازی ' + new Date(g.ts).toLocaleDateString('fa-IR'),
      annotator: 'امید گروسی'
    });
  });
  const all = parts.join('\n\n' + '='.repeat(60) + '\n\n');
  ChessPGN.download(`all-games-${ChessPGN.formatDateISO().replace(/\./g, '-')}.pgn`, all);
}

function importPGNClick(){
  const inp = document.getElementById('pgnFileInput');
  if(inp){ inp.value = ''; inp.click(); }
}

function handlePGNFile(ev){
  const file = ev.target.files && ev.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{ loadPGN(e.target.result); }
    catch(err){ console.error(err); alert('خطا در خواندن PGN.'); }
  };
  reader.onerror = () => alert('خواندن فایل ناموفق بود.');
  reader.readAsText(file, 'utf-8');
}

function loadPGN(text){
  const {headers, moves} = ChessPGN.parse(text);
  if(!moves.length){ alert('هیچ حرکتی در این PGN پیدا نشد.'); return; }

  const sanList = moves.filter(t => /^([KQRBNO]|[a-h])/.test(t) && !/^\d/.test(t));
  const uciList = sanListToUci(sanList);
  if(!uciList.length){ alert('نتوانستم هیچ حرکتی را استخراج کنم.'); return; }

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
  hideEnd();
  closePromo();
  ChessStorage.autoClear();

  for(const item of uciList){
    const legal = legalMoves(S);
    const from = parseSq(item.uci.slice(0, 2));
    const to = parseSq(item.uci.slice(2, 4));
    const promo = item.uci[4] || null;
    const m = legal.find(x => x.from === from && x.to === to && (x.promo || null) === promo);
    if(!m) break;
    const captured = S.board[m.to] || (m.ep ? (S.turn === 'w' ? 'p' : 'P') : null);
    const before = S;
    S = makeMove(S, m);
    hist.push({m, uci: item.uci, san: item.san, before, captured});
    keys.push(keyOf(S));
  }
  saveAutoState();

  if(engine === 'stockfish') sfSend('ucinewgame');
  render();
  Coach.reset();

  const lines = [];
  if(headers.White)  lines.push('⚪ سفید: ' + escapeHtml(headers.White));
  if(headers.Black)  lines.push('⚫ مشکی: ' + escapeHtml(headers.Black));
  if(headers.Event)  lines.push('🏆 ' + escapeHtml(headers.Event));
  if(headers.Result) lines.push('📊 نتیجه: ' + escapeHtml(headers.Result));

  Coach.say(
    '📄 <b>PGN بارگذاری شد</b> — ' + uciList.length + ' حرکت' +
    (lines.length ? '<br>' + lines.join('<br>') : '') +
    '<br>می‌توانی ادامه بدهی یا از مربی تحلیل بخواهی.',
    'sys'
  );

  setStatus('PGN بارگذاری شد — ' + uciList.length + ' حرکت');
  if(S.turn !== humanColor) opponentGo();
  else if(document.getElementById('chkAutoCoach').checked) Coach.go();
}

/* ============================================================
   📜 تاریخچهٔ بازی‌ها
   ============================================================ */

function recordGameResult(){
  if(!gameOver) return;
  let result = 'draw', resultText = '';
  if(gameOver.type === 'mate' || gameOver.type === 'timeout'){
    result = (gameOver.winner === humanColor) ? 'win' : 'loss';
    resultText = (result === 'win') ? 'برد' : 'باخت';
  } else {
    result = 'draw';
    resultText = ({
      stalemate: 'پات',
      fifty: 'قانون ۵۰ حرکت',
      repeat: 'تکرار سه‌گانه',
      material: 'مهرهٔ ناکافی'
    }[gameOver.type]) || 'تساوی';
  }
  const analysis = analyzeGame();
  ChessStorage.histAdd({
    result,
    resultText,
    movesSan: hist.map(h => h.san).join(' '),
    movesCount: hist.length,
    humanColor,
    level,
    engine,
    gameOverType: gameOver.type,
    accuracy: analysis.accuracy,
    matchedCount: analysis.matched,
    humanMoveCount: analysis.total
  });

  if(engine !== 'none' && gameMode !== 'two-players'){
    const r = ChessRating.recordGame(result, level);
    window._lastRatingChange = r;
    refreshRatingBadge(true, r);
  }
}

function openHistory(){
  renderHistory();
  document.getElementById('historyModal').classList.remove('hidden');
}

function closeHistory(){
  document.getElementById('historyModal').classList.add('hidden');
}

function renderHistory(){
  const arr = ChessStorage.histAll();
  const st  = ChessStorage.stats();
  const statsEl = document.getElementById('histStats');

  if(statsEl){
    if(st.total === 0){
      statsEl.innerHTML = '<div style="color:#6f7480">هنوز بازی‌ای ثبت نشده</div>';
    } else {
      const wr = Math.round(100 * st.w / Math.max(st.total, 1));
      statsEl.innerHTML =
        '<div class="stat"><b>' + st.total + '</b><span>کل بازی</span></div>' +
        '<div class="stat"><b style="color:#81c784">' + st.w + '</b><span>برد</span></div>' +
        '<div class="stat"><b style="color:#e57373">' + st.l + '</b><span>باخت</span></div>' +
        '<div class="stat"><b style="color:#9aa0ae">' + st.d + '</b><span>مساوی</span></div>' +
        '<div class="stat"><b>' + wr + '%</b><span>درصد برد</span></div>' +
        '<div class="stat"><b>' + st.maxStreak + '</b><span>بهترین رشته</span></div>';
    }
  }

  const listEl = document.getElementById('histList');
  if(!listEl) return;
  if(!arr.length){
    listEl.innerHTML = '<div class="hist-empty">هنوز بازی‌ای ذخیره نشده.<br>اولین بازی‌ات را انجام بده تا اینجا ظاهر شود.</div>';
    return;
  }

  const LV = ['خیلی آسان','آسان','متوسط','سخت','خیلی سخت'];
  listEl.innerHTML = arr.map(g => {
    const icon = g.result === 'win' ? '🏆' : g.result === 'loss' ? '🤖' : '🤝';
    const d = new Date(g.ts).toLocaleString('fa-IR', {dateStyle: 'short', timeStyle: 'short'});
    const lvl = LV[g.level] || '؟';
    const side = g.humanColor === 'w' ? 'سفید' : 'مشکی';
    return '<div class="hist-item" onclick="viewHistoryGame(\'' + g.id + '\')">' +
      '<span class="result-icon">' + icon + '</span>' +
      '<div class="info"><b>' + g.resultText + ' — ' + side + ' (سطح ' + lvl + ')</b>' +
      '<small>' + d + ' • ' + g.movesCount + ' حرکت</small></div>' +
      '<button class="pgn-btn" title="دانلود PGN" onclick="event.stopPropagation();exportHistoryPGN(\'' + g.id + '\')">📥</button>' +
      '<button class="del" onclick="event.stopPropagation();deleteHistoryGame(\'' + g.id + '\')">🗑</button>' +
      '</div>';
  }).join('');
}

function viewHistoryGame(id){
  const g = ChessStorage.histAll().find(x => x.id === id);
  if(!g) return;
  const tokens = g.movesSan.split(' ');
  let out = '';
  for(let i = 0; i < tokens.length; i++){
    if(i % 2 === 0) out += (Math.floor(i / 2) + 1) + '. ';
    out += tokens[i] + ' ';
    if(i % 2 === 1) out += '\n';
  }
  alert('📜 حرکات بازی (' + g.resultText + '):\n\n' + out.trim());
}

function deleteHistoryGame(id){
  if(!confirm('این بازی از تاریخچه حذف شود؟')) return;
  ChessStorage.histDelete(id);
  renderHistory();
}

function clearAllHistory(){
  if(!confirm('همهٔ تاریخچه پاک شود؟ این کار قابل بازگشت نیست.')) return;
  ChessStorage.histClear();
  renderHistory();
}

/* ============================================================
   📊 تحلیل بعد از بازی
   ============================================================ */

function analyzeGame(){
  const humanMoves = hist.filter(h => {
    const mover = h.before.board[h.m.from];
    return mover && (isW(mover) ? 'w' : 'b') === humanColor;
  });
  const total = humanMoves.length;
  const matched = humanMoves.filter(h => h.matched).length;
  const accuracy = total > 0 ? Math.round(100 * matched / total) : 0;
  return {humanMoves, total, matched, accuracy};
}

function accuracyRating(pct){
  if(pct >= 90) return {label: '🏆 عالی!', color: '#4caf50'};
  if(pct >= 75) return {label: '👍 خوب', color: '#81c784'};
  if(pct >= 60) return {label: '💪 متوسط', color: '#ffd54f'};
  if(pct >= 40) return {label: '📚 نیاز به تمرین', color: '#ff9800'};
  return {label: '🌱 در حال یادگیری', color: '#e57373'};
}

function showAnalysis(){
  const data = analyzeGame();
  const rating = accuracyRating(data.accuracy);
  const sumEl = document.getElementById('anaSummary');

  if(!data.total){
    sumEl.innerHTML = '<div class="ana-empty">' +
      'برای این بازی داده‌ای برای تحلیل وجود ندارد.<br>' +
      'دفعهٔ بعد مطمئن شو «راهنمایی خودکار مربی» روشن است.' +
      '</div>';
    document.getElementById('anaList').innerHTML = '';
    document.getElementById('analysisModal').classList.remove('hidden');
    return;
  }

  sumEl.innerHTML =
    '<div class="ana-circle" style="--ana-pct:' + data.accuracy + ';--ana-color:' + rating.color + '">' +
      '<b>' + data.accuracy + '%</b>' +
      '<small>دقت</small>' +
    '</div>' +
    '<div class="ana-matched">✅ <b>' + data.matched + '</b> از <b>' + data.total + '</b> حرکت با پیشنهاد مربی مطابق بود</div>' +
    '<div class="ana-rating" style="color:' + rating.color + '">' + rating.label + '</div>';

  let html = '';
  data.humanMoves.forEach(h => {
    const num = Math.floor(hist.indexOf(h) / 2) + 1;
    const moveNum = (hist.indexOf(h) % 2 === 0) ? num + '.' : num + '…';
    const icon = h.matched
      ? '<span class="status ok">✅</span>'
      : '<span class="status bad">⚠️</span>';
    const suggTxt = (!h.matched && h.suggestedSan)
      ? '<span class="sugg">پیشنهاد: <b>' + h.suggestedSan + '</b></span>'
      : (h.matched ? '<span class="sugg">مطابق پیشنهاد</span>' : '');
    html += '<div class="ana-row">' +
      '<span class="n">' + moveNum + '</span>' +
      '<span class="san">' + h.san + '</span>' +
      icon +
      suggTxt +
      '</div>';
  });
  document.getElementById('anaList').innerHTML = html;
  document.getElementById('analysisModal').classList.remove('hidden');
}

function closeAnalysis(){
  document.getElementById('analysisModal').classList.add('hidden');
}

/* ============================================================
   🏅 رتبه — نمایش و مودال
   ============================================================ */

function refreshRatingBadge(animated, change){
  const el = document.getElementById('ratingBadge');
  if(!el) return;
  const d = ChessRating.load();
  el.textContent = d.rating;
  el.classList.remove('up', 'down');
  const oldDelta = el.querySelector('.delta');
  if(oldDelta) oldDelta.remove();

  if(animated && change){
    const delta = change.delta;
    if(delta > 0){
      el.classList.add('up');
      const b = document.createElement('span');
      b.className = 'delta';
      b.textContent = '+' + delta;
      el.appendChild(b);
    } else if(delta < 0){
      el.classList.add('down');
      const b = document.createElement('span');
      b.className = 'delta neg';
      b.textContent = String(delta);
      el.appendChild(b);
    }
    setTimeout(() => el.classList.remove('up', 'down'), 1000);
  }
}

function renderRatingChangeInEnd(){
  const r = window._lastRatingChange;
  const box = document.getElementById('ratingChangeBox');
  if(!box) return;
  if(!r){ box.innerHTML = ''; return; }
  const cls = r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : 'zero';
  const sign = r.delta > 0 ? '+' : '';
  box.innerHTML =
    '<div class="rating-change">' +
      '<span class="old">' + r.before + '</span>' +
      '<span class="arrow">→</span>' +
      '<span class="new">' + r.after + '</span>' +
      '<span class="delta ' + cls + '">' + sign + r.delta + '</span>' +
    '</div>';
}

function openRating(){
  renderRating();
  document.getElementById('ratingModal').classList.remove('hidden');
}

function closeRating(){
  document.getElementById('ratingModal').classList.add('hidden');
}

function resetRating(){
  if(!confirm('آیا رتبهٔ شما به ۱۲۰۰ بازنشانی شود؟ تاریخچهٔ رتبه پاک خواهد شد.')) return;
  ChessRating.reset();
  refreshRatingBadge();
  renderRating();
}

function renderRating(){
  const d = ChessRating.load();
  const t = ChessRating.titleOf(d.rating);

  const hero = document.getElementById('ratHero');
  if(hero){
    const pct = d.games ? Math.round(100 * d.wins / d.games) : 0;
    hero.innerHTML =
      '<div class="rat-big">' + d.rating + '</div>' +
      '<div class="rat-title" style="color:' + t.color + '">' + t.label + '</div>' +
      '<div class="rat-sub">' +
        'بالاترین رتبه: <b style="color:#ffd54f">' + d.peak + '</b>' +
        ' • ' + d.games + ' بازی' +
        ' • درصد برد: ' + pct + '%' +
      '</div>';
  }

  const st = document.getElementById('ratStats');
  if(st){
    st.innerHTML =
      '<div class="st win"><b>' + d.wins + '</b><span>برد</span></div>' +
      '<div class="st loss"><b>' + d.losses + '</b><span>باخت</span></div>' +
      '<div class="st draw"><b>' + d.draws + '</b><span>مساوی</span></div>' +
      '<div class="st"><b>' + d.games + '</b><span>کل</span></div>';
  }

  renderRatingChart(d);

  const list = document.getElementById('ratList');
  if(!list) return;
  if(!d.history.length){
    list.innerHTML = '<div class="rat-empty">هنوز بازی رتبه‌داری انجام نداده‌ای.<br>یک بازی با موتور شروع کن تا این‌جا ظاهر شود.</div>';
    return;
  }
  const LV = ['خیلی آسان','آسان','متوسط','سخت','خیلی سخت'];
  list.innerHTML = d.history.map(h => {
    const icon = h.result === 'win' ? '🏆' : h.result === 'loss' ? '🤖' : '🤝';
    const cls = h.delta > 0 ? 'pos' : h.delta < 0 ? 'neg' : 'zero';
    const sign = h.delta > 0 ? '+' : '';
    const dt = new Date(h.ts).toLocaleString('fa-IR', {dateStyle: 'short', timeStyle: 'short'});
    return '<div class="rat-row">' +
      '<span class="icon">' + icon + '</span>' +
      '<div class="info">' +
        'حریف: ' + (LV[h.level] || '؟') +
        ' <small>' + dt + ' • ' + h.before + ' → ' + h.after + '</small>' +
      '</div>' +
      '<span class="d ' + cls + '">' + sign + h.delta + '</span>' +
    '</div>';
  }).join('');
}

function renderRatingChart(d){
  const box = document.getElementById('ratChart');
  if(!box) return;
  const items = d.history.slice(0, 30).reverse();
  if(items.length < 2){
    box.innerHTML = '<h3>📈 نمودار پیشرفت</h3>' +
      '<div style="color:#6f7480;font-size:12px;text-align:center;padding:20px">' +
      'برای نمودار حداقل به ۲ بازی نیاز است</div>';
    return;
  }
  const ratings = [d.START_RATING].concat(items.map(h => h.after));
  const min = Math.min(...ratings) - 30;
  const max = Math.max(...ratings) + 30;
  const W = 400, H = 100, PAD = 6;
  const pts = ratings.map((r, i) => {
    const x = PAD + (W - 2 * PAD) * (i / (ratings.length - 1));
    const y = H - PAD - (H - 2 * PAD) * ((r - min) / (max - min));
    return {x, y, r};
  });
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const areaPath = path + ' L ' + pts[pts.length - 1].x.toFixed(1) + ' ' + (H - PAD) +
                   ' L ' + pts[0].x.toFixed(1) + ' ' + (H - PAD) + ' Z';
  const lastR = ratings[ratings.length - 1];
  const firstR = ratings[0];
  const trend = lastR - firstR;
  const trendColor = trend > 0 ? '#4caf50' : trend < 0 ? '#e57373' : '#9aa0ae';
  box.innerHTML =
    '<h3>📈 نمودار پیشرفت (۳۰ بازی آخر) ' +
      '<span style="color:' + trendColor + ';float:left;font-family:monospace">' +
      (trend > 0 ? '+' : '') + trend + '</span></h3>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs>' +
        '<linearGradient id="ratGrad" x1="0" x2="0" y1="0" y2="1">' +
          '<stop offset="0%" stop-color="' + trendColor + '" stop-opacity=".35"/>' +
          '<stop offset="100%" stop-color="' + trendColor + '" stop-opacity="0"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<path d="' + areaPath + '" fill="url(#ratGrad)"/>' +
      '<path d="' + path + '" fill="none" stroke="' + trendColor + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="' + pts[pts.length - 1].x.toFixed(1) + '" cy="' + pts[pts.length - 1].y.toFixed(1) +
        '" r="3.5" fill="' + trendColor + '"/>' +
    '</svg>';
}

/* ============================================================
   🎯 اتصال رویدادها
   ============================================================ */
(function bindRecordsEvents(){
  const pgnInp = document.getElementById('pgnFileInput');
  if(pgnInp) pgnInp.addEventListener('change', handlePGNFile);
})();

/* ============================================================
   🌐 اتصال به window
   ============================================================ */
window.exportCurrentPGN = exportCurrentPGN;
window.exportHistoryPGN = exportHistoryPGN;
window.exportAllPGN = exportAllPGN;
window.importPGNClick = importPGNClick;
window.handlePGNFile = handlePGNFile;
window.loadPGN = loadPGN;

window.recordGameResult = recordGameResult;
window.openHistory = openHistory;
window.closeHistory = closeHistory;
window.renderHistory = renderHistory;
window.viewHistoryGame = viewHistoryGame;
window.deleteHistoryGame = deleteHistoryGame;
window.clearAllHistory = clearAllHistory;

window.analyzeGame = analyzeGame;
window.showAnalysis = showAnalysis;
window.closeAnalysis = closeAnalysis;

window.refreshRatingBadge = refreshRatingBadge;
window.renderRatingChangeInEnd = renderRatingChangeInEnd;
window.openRating = openRating;
window.closeRating = closeRating;
window.resetRating = resetRating;
window.renderRating = renderRating;
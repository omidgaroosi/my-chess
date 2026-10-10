"use strict";
/* ============================================================
   🎓 coach.js — مربی هوشمند نسخهٔ 2.0
   ------------------------------------------------------------
   قابلیت‌های جدید:
   - تشخیص تهدیدهای فوری حریف
   - تحلیل جامع پوزیسیون (مواد، امنیت شاه، فعالیت، پیاده‌ها)
   - پیشنهاد چندحرکته (PV) با توضیح
   - تحلیل خطاهای بازیکن با پیشنهاد جایگزین
   - نکات آموزشی متنی با ارجاع به الگوها
   ساخته شده توسط امید گروسی
   ============================================================ */

const Coach = {

  /* ---------------- وضعیت ---------------- */
  move: null,
  busy: false,
  pv: [],
  score: null,
  pending: false,
  lastOpening: null,
  _lastSuggested: null,
  _lastHuman: null,
  _lastThreats: null,

  FA_PIECE: {k:'شاه', q:'وزیر', r:'رخ', b:'فیل', n:'اسب', p:'پیاده'},
  FA_VAL: {p:1, n:3, b:3, r:5, q:9},
  CENTER: [27, 28, 35, 36],

  /* ============================================================
     📚 کتابخانهٔ شروع بازی‌ها
     ============================================================ */
  OPENINGS: [
    {san:['e4','e5','Nf3','Nc6','Bb5'], name:'روی لوپز (اسپانیایی)'},
    {san:['e4','e5','Nf3','Nc6','Bc4'], name:'بازی ایتالیایی'},
    {san:['e4','e5','Nf3','Nc6','d4'],  name:'گشایش اسکاتلندی'},
    {san:['e4','e5','Nf3','Nf6'],       name:'دفاع پتروف'},
    {san:['e4','c5','Nf3','d6'],        name:'سیسیلی نایدورف‌گونه'},
    {san:['e4','c5'],                   name:'دفاع سیسیلی'},
    {san:['e4','e6'],                   name:'دفاع فرانسوی'},
    {san:['e4','c6'],                   name:'دفاع کاروکان'},
    {san:['e4','d5'],                   name:'دفاع اسکاندیناوی'},
    {san:['d4','d5','c4','e6'],         name:'گامبی وزیر ردشده'},
    {san:['d4','d5','c4','c6'],         name:'دفاع اسلاو'},
    {san:['d4','d5','c4','dxc4'],       name:'گامبی وزیر پذیرفته'},
    {san:['d4','Nf6','c4','g6'],        name:'دفاع کینگز ایندین'},
    {san:['d4','Nf6','c4','e6'],        name:'دفاع‌های هندی وزیر'},
    {san:['c4','e5'],                   name:'شروع انگلیسی'},
    {san:['Nf3'],                       name:'شروع رتی'},
  ],

  openingName(){
    const seq = hist.map(h => h.san.replace(/[+#?!]$/, ''));
    let best = null;
    for(const o of this.OPENINGS){
      if(o.san.length <= seq.length && o.san.every((m,i) => m === seq[i]))
        if(!best || o.san.length > best.san.length) best = o;
    }
    return best ? best.name : null;
  },

  checkOpeningChange(){
    const n = this.openingName();
    if(n && n !== this.lastOpening){
      this.lastOpening = n;
      this.say('📖 <b>شروع بازی:</b> ' + n + '<br><span style="color:#8a8f9c;font-size:11.5px">این گشایش را در کتاب «گشایش‌ها» می‌توانی مطالعه کنی.</span>', 'analyst');
    }
  },

  /* ============================================================
     🔍 تحلیل پوزیسیون — با استفاده از CoachAnalyzer
     ============================================================ */
  _analyzer(){
    return window.CoachAnalyzer || null;
  },

  hangingPieces(s, color){
    /* 🛡️ این تابع هرگز نباید throw کند */
    try {
      const A = this._analyzer();
      if(A && typeof A.detectHanging === 'function') {
        const list = A.detectHanging(s, color);
        if(Array.isArray(list)) {
          return list.map(h => ({
            sq: h.sq,
            val: h.value,
            san: h.name + ' در ' + h.faSq + (h.defended ? ' (تحت فشار)' : ' (بی‌دفاع)')
          }));
        }
      }
    } catch(e) {
      console.warn('⚠️ hangingPieces fallback:', e);
    }
    return [];
  },

  materialSummary(s){
    const A = this._analyzer();
    if(!A) return 'مواد: نامشخص';
    const m = A.analyzeMaterial(s, s.turn);
    const d = m.diff;
    if(d > 0) return 'مواد: <b style="color:#81c784">+' + d + '</b> به نفع شما';
    if(d < 0) return 'مواد: <b style="color:#e57373">' + d + '</b> به نفع حریف';
    return 'مواد: <b>مساوی</b>';
  },

  gamePhase(s){
    const A = this._analyzer();
    if(A) return A.getPhase(s);
    return 'middlegame';
  },

  /* ============================================================
     🎯 تشخیص تهدیدهای فوری حریف
     ============================================================ */
  detectThreats(){
    const A = this._analyzer();
    if(!A) return [];
    const threats = A.detectThreats(S);
    this._lastThreats = threats;
    const messages = [];
    
    if(threats.critical.length) {
      for(const t of threats.critical.slice(0, 2)) {
        messages.push({
          type: 'critical',
          text: '⛔ <b>خطر فوری:</b> حریف تهدید <b>' + t.san + '</b> دارد که شما را مات می‌کند! باید همین الان جلویش را بگیری.'
        });
      }
    }
    
    if(threats.high.length && !threats.critical.length) {
      const seen = new Set();
      for(const t of threats.high.slice(0, 3)) {
        if(seen.has(t.san)) continue;
        seen.add(t.san);
        if(t.type === 'free-piece') {
          messages.push({
            type: 'high',
            text: '⚠️ حریف تهدید می‌کند: <b>' + t.san + '</b> — ' + t.piece + ' شما در ' + A.faSq(t.sq) + ' در خطر است'
          });
        } else if(t.type === 'check') {
          messages.push({
            type: 'medium',
            text: '⚡ حریف می‌تواند کیش بدهد: <b>' + t.san + '</b>'
          });
        }
      }
    }
    
    return messages;
  },

  /* ============================================================
     📊 گزارش جامع پوزیسیون
     ============================================================ */
  positionReport(){
    const A = this._analyzer();
    if(!A) return null;
    const report = A.analyze(S, humanColor);
    return report;
  },

  buildReportText(report) {
    if(!report) return '';
    const parts = [];
    
    /* مواد */
    const mat = report.material;
    if(mat.diff > 0) parts.push('💰 مواد: <b>+' + mat.diff + '</b> به نفع شما');
    else if(mat.diff < 0) parts.push('💰 مواد: <b>' + mat.diff + '</b> به نفع حریف');
    else parts.push('💰 مواد: <b>مساوی</b>');
    
    /* امنیت شاه */
    const ks = report.kingSafety;
    if(ks.score >= 75) parts.push('🛡️ شاه شما در امنیت است');
    else if(ks.score >= 50) parts.push('🛡️ شاه شما نسبتاً امن');
    else if(ks.score >= 30) parts.push('⚠️ شاه شما آسیب‌پذیر است');
    else parts.push('🚨 <b>شاه شما در خطر جدی است</b>');
    
    /* فعالیت */
    const act = report.activity;
    if(act.inactive.length >= 2) {
      parts.push('💤 ' + act.inactive.length + ' مهرهٔ شما غیرفعالند: ' + 
        act.inactive.map(x => x.name + ' ' + x.faSq).slice(0, 3).join('، '));
    }
    
    /* پیاده‌ها */
    const pn = report.pawns;
    if(pn.isolated > 0) parts.push('🏝️ ' + pn.isolated + ' پیادهٔ ایزوله دارید');
    if(pn.doubled > 0) parts.push('⚠️ پیاده‌های دوبله دارید');
    
    return parts.join(' • ');
  },

  /* ============================================================
     📖 قوانین توضیح حرکت
     ============================================================ */
  describeMove(s0, m){
    const parts = [];
    const p = s0.board[m.from];
    if(!p) return parts;
    const mover = s0.turn, t = p.toLowerCase();
    const s1 = makeMove(s0, m);
    const captured = s0.board[m.to] || (m.ep ? (mover === 'w' ? 'p' : 'P') : null);

    if(m.castle){
      parts.push((m.castle === 'K' || m.castle === 'k')
        ? 'قلعهٔ کوتاه — شاه در گوشهٔ امن قرار می‌گیرد و رخ به بازی می‌آید'
        : 'قلعهٔ بلند — شاه در جناح وزیر امن می‌شود و رخ فعال می‌گردد');
    } else if(captured){
      const capVal = this.FA_VAL[captured.toLowerCase()] || 0;
      const wasDefended = attacked(s0, m.to, mover !== 'w');
      parts.push('گرفتن ' + this.FA_PIECE[captured.toLowerCase()] +
        ' در ' + sqName(m.to) + ' (' + capVal + ' امتیاز)' +
        (wasDefended ? '' : ' <b>که بی‌دفاع بود</b> 🎯'));
    } else {
      parts.push('حرکت ' + this.FA_PIECE[t] + ' از ' + sqName(m.from) + ' به ' + sqName(m.to));
    }
    if(m.promo) parts.push('ارتقای پیاده به ' + this.FA_PIECE[m.promo] + ' 🎉');
    if(inCheck(s1, s1.turn)) parts.push('<b>کیش</b> — حریف مجبور به پاسخ فوری است');

    /* تهدیدهای جدید */
    if(!m.castle && t !== 'k'){
      const threats = [], byW = mover === 'w';
      for(let sq = 0; sq < 64; sq++){
        const q = s1.board[sq];
        if(!q || colorOf(q) === mover) continue;
        const isNew = attacked(s1, sq, byW) && !attacked(s0, sq, byW);
        if(!isNew) continue;
        const val = this.FA_VAL[q.toLowerCase()] || 0;
        threats.push({ name: this.FA_PIECE[q.toLowerCase()] + ' ' + sqName(sq), val });
      }
      threats.sort((a,b) => b.val - a.val);
      if(threats.length){
        parts.push('تهدید ' + threats.slice(0,2).map(x => x.name).join(' و '));
      }
    }

    /* تشخیص تاکتیک‌ها با موتور جدید (امن) */
    try {
      const tactics = this._detectTacticsNew(s0, s1, m, captured);
      if(tactics && tactics.length) parts.push(tactics.join('؛ '));
    } catch(e) { console.warn('⚠️ tactics skipped:', e); }

    /* اصول شروع بازی */
    if(s0.full <= 10){
      if(t === 'p' && this.CENTER.includes(m.to)){
        const files = ['a','b','c','d','e','f','g','h'];
        parts.push('اشغال مرکز — بهترین راه کنترل میدان');
      }
      if((t === 'n' || t === 'b') && ((mover === 'w' && m.from >= 56) || (mover === 'b' && m.from < 8))){
        parts.push('گسترش مهرهٔ سبک — طبق اصول شروع بازی ✅');
      }
      if(t === 'q'){
        parts.push('⚠️ خروج زودهنگام وزیر — بهتر است بعد از گسترش مهره‌ها وارد شود');
      }
    }

    /* هشدار مهرهٔ بی‌دفاع (امن) */
    try {
      if(!m.castle && t !== 'k'){
        const hang = this.hangingPieces(s1, mover);
        if(hang && hang.length && hang[0].val >= 3){
          parts.push('<b>⚠️ هشدار:</b> ' + hang[0].san + ' بعد از این حرکت بی‌دفاع می‌شود');
        }
      }
    } catch(e) { console.warn('⚠️ hanging check skipped:', e); }

    return parts;
  },

  /* ============================================================
     🎯 تشخیص تاکتیک‌ها با CoachPatterns
     ============================================================ */
  _detectTacticsNew(s0, s1, m, captured){
    const out = [];
    /* 🛡️ این تابع هرگز نباید throw کند */
    try {
      const P = window.CoachPatterns;
      if(!P) return out;

      /* چنگال */
      const fork = P.detectFork ? P.detectFork(s0, m, s1) : null;
      if(fork && fork.totalValue >= 3) {
        out.push('🎯 <b>چنگال</b> — ' + fork.pieceName + ' هم‌زمان به ' + 
          fork.targets.slice(0, 2).map(t => t.name).join(' و ') + ' حمله می‌کند');
      }

      /* آچمز */
      const pins = P.detectPins ? P.detectPins(s1.board, s0.turn === 'w') : [];
      for(const pin of pins) {
        if(pin.attackerSq === m.to) {
          out.push('📌 <b>آچمز</b> — ' + pin.pinnedName + ' نمی‌تواند حرکت کند');
          break;
        }
      }

      /* سیخ */
      const skewers = P.detectSkewers ? P.detectSkewers(s1.board, s0.turn === 'w') : [];
      for(const sk of skewers) {
        if(sk.attackerSq === m.to) {
          out.push('🗡️ <b>سیخ</b> — ' + sk.frontName + ' فرار می‌کند و ' + 
            sk.behindName + ' شکار می‌شود');
          break;
        }
      }
    } catch(e) {
      console.warn('⚠️ _detectTacticsNew fallback:', e);
    }
    return out;
  },

  /* ============================================================
     💬 نکات راهبردی
     ============================================================ */
  strategicAdvice(s){
    /* 🛡️ این تابع هرگز نباید throw کند */
    try {
      const report = this.positionReport();
      if(!report) return [];
      
      const parts = [];
    const phase = report.phase;
    const myW = s.turn === 'w';

    if(phase === 'opening'){
      const myK = s.board.indexOf(myW ? 'K' : 'k');
      const kOnHome = myW ? myK === 60 : myK === 4;
      const rights = myW ? (s.castling.K || s.castling.Q) : (s.castling.k || s.castling.q);
      if(rights && kOnHome){
        parts.push('گسترش بده، سپس زود قلعه برو');
      }
      if(report.centerControl.mine < 2){
        parts.push('مرکز را کنترل کن — با پیاده یا مهره');
      }
    }

    if(phase === 'middlegame'){
      if(report.kingSafety.score < 50){
        parts.push('⚠️ امنیت شاهت را جدی بگیر');
      }
      if(report.material.diff > 2){
        parts.push('جلوتری — به دنبال تعویض مهره و ساده‌سازی باش');
      } else if(report.material.diff < -2){
        parts.push('عقبی — بازی را پیچیده نگه دار');
      }
      if(report.activity.inactive.length >= 2){
        parts.push('مهره‌های غیرفعال را فعال کن: ' + 
          report.activity.inactive.slice(0, 2).map(x => x.name + ' ' + x.faSq).join('، '));
      }
    }

    if(phase === 'endgame'){
      parts.push('شاه را به مرکز بیاور — در پایان بازی یک مهرهٔ جنگنده است');
      if(report.pawns.isolated > 0){
        parts.push('مراقب پیاده‌های ایزوله باش');
      }
    }

    /* هشدار مهره‌های بی‌دفاع (اولویت اول) */
    const hang = report.hanging;
    if(hang.length){
      const top = hang[0];
      if(top.value >= 5){
        parts.unshift('🚨 <b>خطر فوری:</b> ' + top.name + ' ' + top.faSq + ' در خطر است!');
      } else if(top.value >= 3){
        parts.unshift('⚠️ ' + top.name + ' ' + top.faSq + ' بی‌دفاع است');
      }
    }

      return parts;
    } catch(e) {
      console.warn('⚠️ strategicAdvice fallback:', e);
      return [];
    }
  },

  /* ============================================================
     💬 ساخت پیام‌ها
     ============================================================ */
  evalText(){
    if(!this.score) return '';
    const sc = this.score;
    let t;
    if(sc.mate){
      const n = Math.abs(sc.v);
      t = sc.v > 0 ? 'مات در ' + n + ' حرکت به نفع تو! 🎯'
                   : 'خطر! حریف مات در ' + n + ' دارد ⚠️';
    } else {
      const v = sc.v / 100;
      if(Math.abs(v) < 0.3) t = 'وضعیت تقریباً مساوی ⚖️';
      else t = (v > 0 ? '+' : '') + v.toFixed(1) + ' پیاده به نفع ' + (v > 0 ? 'تو 😊' : 'حریف ⚠️');
    }
    return t;
  },

  /* پیام PV چندحرکته با توضیح */
  pvText(maxN){
    let s = S; const out = [];
    for(let i = 0; i < Math.min(this.pv.length, maxN); i++){
      const token = this.pv[i];
      const from = parseSq(token.slice(0,2)), to = parseSq(token.slice(2,4)), promo = token[4] || null;
      const mv = legalMoves(s).find(x => x.from === from && x.to === to && (x.promo || null) === (promo || null));
      if(!mv) break;
      const san = sanOf(s, mv, legalMoves(s)).replace(/[+#]$/, '');
      /* آیا این حرکت ما یا حریف است؟ */
      const isOurMove = (i % 2 === 0);
      const marker = isOurMove ? '' : '<span style="color:#8a8f9c;font-size:11px">↩</span> ';
      out.push(marker + san);
      s = makeMove(s, mv);
    }
    return out.join(' → ');
  },

  say(html, cls){
    const log = $('coachLog');
    if(!log) return;
    const div = document.createElement('div');
    div.className = 'msg ' + (cls || 'coach');
    div.innerHTML = html;
    log.appendChild(div);
    while(log.children.length > 50) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  },

  /* ============================================================
     🚀 راه‌اندازی تحلیل
     ============================================================ */
  go(){
    if(gameOver || thinking || this.busy || S.turn !== humanColor) return;
    if(engine === 'stockfish') this.sfGo(); else this.aiGo();
  },

  sfGo(){
    if(!engineReady){ this.pending = true; return; }
    this.busy = true; searchRole = 'coach'; searchGen = gameId;
    searchSide = S.turn;
    this.pv = []; this.score = null;
    setStatus('🎓 مربی در حال تحلیل…'); render();
    sfSend('setoption name Skill Level value ' + this.skill());
    sfSend('position startpos' + (hist.length ? ' moves ' + hist.map(h => h.uci).join(' ') : ''));
    sfSend('go depth ' + this.depth());
  },

  aiGo(){
    this.busy = true; searchRole = 'coach'; searchGen = gameId;
    this.pv = []; this.score = null;
    setStatus('🎓 مربی در حال تحلیل…'); render();
    setTimeout(() => {
      if(searchGen !== gameId || gameOver){ this.busy = false; render(); return; }
      const d = Math.min([1,2,3,4,4][level] + 1, 4);
      const res = chooseAiMove(S, d, 0);
      this.busy = false;
      if(searchGen !== gameId || gameOver){ render(); return; }
      if(!res){ this.say('🎓 مربی: حرکتی پیدا نشد!', 'coach'); render(); return; }
      this.score = {mate:false, v:res.v};
      this.finish(res.m);
    }, 250);
  },

  bestmove(token){
    this.busy = false;
    if(token === '(none)'){ this.say('🎓 مربی: حرکتی پیدا نشد!', 'coach'); render(); return; }
    const from = parseSq(token.slice(0,2)), to = parseSq(token.slice(2,4)), promo = token[4] || null;
    const m = legalMoves(S).find(x => x.from === from && x.to === to && (x.promo || null) === (promo || null));
    if(!m){ render(); return; }
    this.finish(m, token);
  },

  finish(m, token){
    /* 🛡️ این تابع هرگز نباید throw کند — چون در این صورت render نمی‌شود */
    const legal = legalMoves(S);
    const san = sanOf(S, m, legal);
    const uci = token || (sqName(m.from) + sqName(m.to) + (m.promo || ''));

    /* ⚡ اول از همه: این خط حتماً باید اجرا شود */
    this.move = {from:m.from, to:m.to, promo:m.promo || null, uci, san};

    /* 🛡️ هر بخش ممکن است خطا بدهد، اما نگذاریم finish کامل شود */
    let reasons = [], advice = [], op = null;
    try { reasons = this.describeMove(S, m) || []; }
    catch(e) { console.error('❌ describeMove:', e); }
    try { advice = this.strategicAdvice(S) || []; }
    catch(e) { console.error('❌ strategicAdvice:', e); }
    try { op = this.openingName(); }
    catch(e) { console.error('❌ openingName:', e); }

    /* ساخت پیام */
    let txt = '🎓 <b>پیشنهاد مربی:</b> <span style="color:#ffd54f;font-size:14px">' + san + '</span>';
    txt += ' <span style="color:#8a8f9c;font-size:11px">(' + uci + ')</span>';
    txt += ' — خانه‌هایش روی صفحه سبز شد';
    if(op) txt += '<br>📖 <b>شروع بازی:</b> ' + op;
    if(reasons.length) txt += '<br>🧭 <b>دلیل:</b> ' + reasons.join('؛ ');
    if(advice.length)  txt += '<br>🛡️ <b>نکتهٔ راهبردی:</b> ' + advice.slice(0, 3).join('؛ ');
    if(this.score) txt += '<br>⚖️ <b>ارزیابی:</b> ' + this.evalText();

    try {
      if(this.pv.length > 1) {
        txt += '<br>🔮 <b>ادامهٔ پیشنهادی:</b> ' + this.pvText(6);
      }
    } catch(e) { console.error('❌ pvText:', e); }

    try { this.say(txt, 'coach'); }
    catch(e) { console.error('❌ say:', e); }

    try { setStatus('نوبت شماست ♙ (پیشنهاد: ' + san + ')'); }
    catch(e) {}

    /* 🎯 مهم‌ترین خط: باید حتماً اجرا شود تا صفحه رنگ شود */
    try { render(); }
    catch(e) { console.error('❌ render:', e); }
  },

  parseInfo(line){
    const ms = line.match(/ score (cp|mate) (-?\d+)/); if(!ms) return;
    this.score = {mate: ms[1] === 'mate', v: +ms[2]};
    const md = line.match(/ depth (\d+)/);
    setStatus('🎓 مربی در حال تحلیل…' + (md ? ' عمق ' + md[1] : ''));
    const pvm = line.match(/ pv (.+)$/);
    if(pvm) this.pv = pvm[1].trim().split(/\s+/);
  },

  /* ============================================================
     🔗 قلاب‌ها
     ============================================================ */

  afterOpponentMove(){
    const h = hist[hist.length - 1];
    if(h){
      const reasons = this.describeMove(h.before, h.m);
      let txt = '🔍 <b>حرکت حریف:</b> <span style="color:#ffd54f">' + h.san + '</span>';
      if(reasons.length) txt += '<br><b>تحلیل:</b> ' + reasons.join('؛ ');
      
      /* هشدار مهره‌های بی‌دفاع */
      const hang = this.hangingPieces(S, humanColor);
      if(hang.length && hang[0].val >= 3)
        txt += '<br>⚠️ <b>هشدار:</b> ' + hang.slice(0,2).map(x => x.san).join(' و ');
      
      this.say(txt, 'analyst');
    }
    this.checkOpeningChange();

    /* تهدیدهای فوری */
    const threats = this.detectThreats();
    if(threats.length){
      const txt = threats.map(t => t.text).join('<br>');
      this.say(txt, threats[0].type === 'critical' ? 'sys' : 'analyst');
    }

    if($('chkAutoCoach').checked && !gameOver) this.go();
  },

  onHumanMove(m, humanSan, humanUci){
    const suggested = this.move;
    this.stop();
    this.move = null;
    this._lastSuggested = suggested;
    this._lastHuman = {san: humanSan, uci: humanUci};
  },

  afterHumanMove(){
    const suggested = this._lastSuggested, human = this._lastHuman;
    this._lastSuggested = null; this._lastHuman = null;
    this.checkOpeningChange();
    if(gameOver) return;
    
    if(suggested && human){
      if(human.uci === suggested.uci)
        this.say('👏 <b>آفرین!</b> دقیقاً حرکت پیشنهادی مربی را بازی کردی.', 'sys');
      else {
        /* تحلیل دقیق‌تر: چرا حرکت کاربر متفاوت بود؟ */
        const hang = this.hangingPieces(S, humanColor);
        if(hang.length && hang[0].val >= 3){
          this.say('⚠️ <b>مراقب باش:</b> ' + hang[0].san + ' بی‌دفاع است — حریف می‌تواند آن را بگیرد!', 'sys');
        } else {
          this.say('حرکت تو: <b>' + human.san + '</b> — پیشنهاد مربی: <b>' + suggested.san + '</b> بود. هر دو منطقی‌اند، ادامه بده!', 'sys');
        }
      }
    }
  },

  reset(){
    this.stop();
    this.move = null; this.pv = []; this.score = null;
    this.pending = false; this.lastOpening = null;
    this._lastThreats = null;
    this.say('— بازی جدید شروع شد —', 'sys');
    if(humanColor === 'b') return;
    if($('chkAutoCoach').checked) {
      this.say('🎓 <b>مربی:</b> برای شروع، پیادهٔ شاه (e4) یا وزیر (d4) را دو خانه جلو ببر، سپس اسب‌ها و فیل‌ها را گسترش بده و زود قلعه برو.', 'sys');
    }
  },

  stop(){
    if(this.busy){ sfSend('stop'); this.busy = false; searchRole = null; }
  },

  onEngineReady(){
    if(this.pending){ this.pending = false; this.sfGo(); }
  },

  /* ============================================================
     🎨 رابط کاربری
     ============================================================ */
  init(){
    $('btnCoach').addEventListener('click', () => this.go());
    this.say('🎓 <b>مربی هوشمند آماده است!</b> من شما را در هر مرحله راهنمایی می‌کنم: تهدیدهای حریف را تشخیص می‌دهم، بهترین حرکت را پیشنهاد می‌دهم، دلیلش را توضیح می‌دهم و نکات آموزشی می‌گویم. تصمیم نهایی با شماست!', 'sys');
  },

  updateButton(){
    const btn = $('btnCoach');
    if(!btn) return;
    const canCoach = !gameOver && !thinking && !this.busy && S.turn === humanColor;
    btn.disabled = !canCoach;
    btn.textContent = this.busy ? '⏳ مربی در حال فکر کردن…' : '🎓 راهنمایی مربی';
  },

  updateStrengthInfo(){
    const el = $('strengthInfo');
    if(!el) return;
    if(engine === 'stockfish')
      el.innerHTML = '⚖️ حریف: عمق ' + LEVELS_SF[level].depth + ' — مربی: عمق ' + this.depth() + 
        ' (قوی‌تر از حریف) + تحلیل تهدیدها و پیشنهادهای آموزشی';
    else
      el.innerHTML = '⚖️ در موتور ساده، مربی با تحلیل عمیق‌تر و تشخیص تهدیدها کمک می‌کند.';
  },
};
/* ============================================================
   🔬 ابزار تشخیص سریع — در کنسول مرورگر قابل استفاده است
   ============================================================ */
window.__coachDebug = function() {
  console.log('===== 🎓 مربی — وضعیت فعلی =====');
  console.log('engine:', typeof engine !== 'undefined' ? engine : '?');
  console.log('engineReady:', typeof engineReady !== 'undefined' ? engineReady : '?');
  console.log('searchRole:', typeof searchRole !== 'undefined' ? searchRole : '?');
  console.log('searchGen / gameId:', typeof searchGen, '/', typeof gameId);
  console.log('busy:', Coach.busy);
  console.log('move:', Coach.move);
  console.log('score:', Coach.score);
  console.log('pv length:', Coach.pv.length);
  console.log('CoachAnalyzer:', typeof window.CoachAnalyzer);
  console.log('CoachPatterns:', typeof window.CoachPatterns);
  console.log('hangingPieces test:', Coach.hangingPieces(S, 'w'));
  console.log('describeMove test:', (function(){
    try { 
      const legal = legalMoves(S);
      if(legal.length) {
        return Coach.describeMove(S, legal[0]);
      }
      return 'no legal moves';
    } catch(e) { return '❌ ' + e.message; }
  })());
  console.log('=================================');
};
console.log('💡 برای تشخیص، در کنسول بنویس: __coachDebug()');
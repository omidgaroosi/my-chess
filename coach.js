"use strict";
/* ============================================================
   🎓 coach.js — مغز مربی و تحلیلگر بازی
   ------------------------------------------------------------
   این فایل به توابع هستهٔ شطرنج در chess.html وابسته است:
   S, hist, legalMoves, makeMove, sanOf, inCheck, attacked,
   sqName, parseSq, isW, colorOf, engine, sfSend, LEVELS_SF,
   level, humanColor, gameOver, thinking, gameId, searchGen,
   searchRole, searchSide, setStatus, render, chooseAiMove, $

   🔧 برای گسترش مربی:
   - قوانین توضیح جدید را در تابع describeMove اضافه کن
   - شروع بازی‌های جدید را به آرایهٔ OPENINGS اضافه کن
   - نکات راهبردی جدید را در strategicAdvice بنویس
   ============================================================ */

const Coach = {

  /* ---------------- وضعیت مربی ---------------- */
  move: null,          // حرکت پیشنهادی {from, to, promo, uci, san}
  busy: false,         // در حال تحلیل است؟
  pv: [],              // خط اصلی پیشنهادی موتور
  score: null,         // ارزیابی {mate, v} از دید بازیکن
  pending: false,      // منتظر آماده‌شدن موتور
  lastOpening: null,   // آخرین شروع بازی شناسایی‌شده
  _lastSuggested: null,
  _lastHuman: null,

  /* ---------------- قدرت مربی (همیشه قوی‌تر از حریف) ---------------- */
  depth(){ return Math.min(LEVELS_SF[level].depth + 5, 18); },
  skill(){ return 20; },

  /* ---------------- فارسی‌سازی ---------------- */
  FA_PIECE: {k:'شاه', q:'وزیر', r:'رخ', b:'فیل', n:'اسب', p:'پیاده'},
  FA_VAL:   {p:1, n:3, b:3, r:5, q:9},
  CENTER:   [27, 28, 35, 36], // d4 e4 d5 e5

  /* ============================================================
     📚 کتابخانهٔ شروع بازی‌ها — برای افزودن، یک آرایهٔ جدید اضافه کن
     ============================================================ */
  OPENINGS: [
    {san:['e4','e5','Nf3','Nc6','Bb5'], name:'روی لوپز (اسپانیایی)'},
    {san:['e4','e5','Nf3','Nc6','Bc4'], name:'بازی ایتالیایی'},
    {san:['e4','e5','Nf3','Nc6','d4'],  name:'گشایش اسکاتلندی'},
    {san:['e4','e5','Nf3','Nf6'],       name:'دفاع پتروف'},
    {san:['e4','c5','Nf3','d6'],        name:'سیسیلی (واریانت نایدورف‌گونه)'},
    {san:['e4','c5'],                   name:'دفاع سیسیلی'},
    {san:['e4','e6'],                   name:'دفاع فرانسوی'},
    {san:['e4','c6'],                   name:'دفاع کاروکان'},
    {san:['e4','d5'],                   name:'دفاع اسکاندیناوی'},
    {san:['d4','d5','c4','e6'],         name:'گامبی وزیر ردشده'},
    {san:['d4','d5','c4','c6'],         name:'دفاع اسلاو'},
    {san:['d4','d5','c4','dxc4'],       name:'گامبی وزیر پذیرفته‌شده'},
    {san:['d4','d5','c4'],              name:'گامبی وزیر'},
    {san:['d4','Nf6','c4','g6'],        name:'دفاع کینگز ایندین'},
    {san:['d4','Nf6','c4','e6'],        name:'دفاع‌های هندی وزیر'},
    {san:['d4','Nf6','c4','c5'],        name:'دفاع بنونی'},
    {san:['d4','Nf6'],                  name:'شروع‌های هندی'},
    {san:['d4','f5'],                   name:'دفاع هلندی'},
    {san:['c4','e5'],                   name:'شروع انگلیسی معکوس'},
    {san:['c4'],                        name:'شروع انگلیسی'},
    {san:['Nf3'],                       name:'شروع رتی'},
    {san:['e4','e5'],                   name:'بازی باز'},
    {san:['d4','d5'],                   name:'بازی بسته'},
    {san:['e4'],                        name:'بازی پیادهٔ شاه'},
    {san:['d4'],                        name:'بازی پیادهٔ وزیر'},
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
      this.say('📖 <b>شروع بازی:</b> ' + n, 'analyst');
    }
  },

  /* ============================================================
     🔍 ابزارهای تحلیل وضعیت
     ============================================================ */

  // مهره‌های بی‌دفاع: مهره‌ای که حریف آن را زده ولی هیچ‌کس ازش دفاع نمی‌کند
  hangingPieces(s, color){
    const res = [], enemyW = color !== 'w';
    for(let sq = 0; sq < 64; sq++){
      const p = s.board[sq];
      if(!p || colorOf(p) !== color) continue;
      if(p.toLowerCase() === 'k') continue;
      if(attacked(s, sq, enemyW) && !attacked(s, sq, color === 'w'))
        res.push({sq, san: this.FA_PIECE[p.toLowerCase()] + ' در ' + sqName(sq)});
    }
    return res;
  },

  materialSummary(s){
    let w = 0, b = 0;
    for(const p of s.board){
      if(!p) continue;
      const v = this.FA_VAL[p.toLowerCase()] || 0;
      if(isW(p)) w += v; else b += v;
    }
    const d = w - b;
    if(d > 0) return 'مواد: ' + d + ' امتیاز جلویی 💪';
    if(d < 0) return 'مواد: ' + (-d) + ' امتیاز عقبی ⚠️';
    return 'مواد: مساوی ⚖️';
  },

  // تشخیص فاز بازی
  gamePhase(s){
    let q = 0, r = 0;
    for(const p of s.board){
      if(!p) continue;
      const t = p.toLowerCase();
      if(t === 'q') q++; else if(t === 'r') r++;
    }
    if(q === 0 && r <= 2) return 'endgame';
    if(s.full <= 10) return 'opening';
    return 'middlegame';
  },

  /* ============================================================
     🧭 قوانین توضیح حرکت — این بخش را می‌توانی گسترش بدهی!
     ============================================================ */
  describeMove(s0, m){
    const parts = [];
    const p = s0.board[m.from];
    if(!p) return parts;
    const mover = s0.turn, t = p.toLowerCase();
    const s1 = makeMove(s0, m);
    const captured = s0.board[m.to] || (m.ep ? (mover === 'w' ? 'p' : 'P') : null);

    // ۱) ماهیت حرکت
    if(m.castle){
      parts.push((m.castle === 'K' || m.castle === 'k')
        ? 'قلعهٔ کوتاه — شاه امن می‌شود و رخ وارد بازی می‌شود'
        : 'قلعهٔ بلند — شاه امن می‌شود و رخ وارد بازی می‌شود');
    } else if(captured){
      parts.push('گرفتن ' + this.FA_PIECE[captured.toLowerCase()] + ' در ' + sqName(m.to)
        + ' (' + this.FA_VAL[captured.toLowerCase()] + ' امتیاز مواد)');
    } else {
      parts.push('حرکت ' + this.FA_PIECE[t] + ' از ' + sqName(m.from) + ' به ' + sqName(m.to));
    }
    if(m.promo) parts.push('ارتقای پیاده به ' + this.FA_PIECE[m.promo] + ' 🎉');
    if(inCheck(s1, s1.turn)) parts.push('کیش به شاه — حریف مجبور به پاسخ دفاعی است');

    // ۲) تهدیدهای جدید که این حرکت ساخت
    if(!m.castle){
      const threats = [], byW = mover === 'w';
      for(let sq = 0; sq < 64; sq++){
        const q = s1.board[sq];
        if(q && colorOf(q) !== mover && attacked(s1, sq, byW) && !attacked(s0, sq, byW))
          threats.push(this.FA_PIECE[q.toLowerCase()] + ' در ' + sqName(sq));
      }
      if(threats.length) parts.push('تهدید گرفتن ' + threats.slice(0,2).join(' و '));
    }

    // ۳) آیا مهرهٔ گرفته‌شده بی‌دفاع بود؟
    if(captured && !m.ep){
      const defenderByWhite = mover !== 'w';
      if(!attacked(s0, m.to, defenderByWhite))
        parts.push('این مهره بی‌دفاع بود — شکار آسان! 🎯');
    }

    // ۴) نکات آموزشی/استراتژیک
    if(this.CENTER.includes(m.to) && (t === 'p' || t === 'n' || t === 'b') && s0.full <= 12)
      parts.push('کنترل مرکز صفحه — مهره‌های مرکزی قوی‌ترند');
    if((t === 'n' || t === 'b') && ((mover === 'w' && m.from >= 56) || (mover === 'b' && m.from < 8)) && s0.full <= 10)
      parts.push('گسترش مهرهٔ سبک در شروع بازی');
    if(t === 'q' && s0.full <= 6)
      parts.push('خروج زودهنگام وزیر — معمولاً در شروع بازی توصیه نمی‌شود');
    if(t === 'k' && !m.castle && s0.full > 10)
      parts.push('جابه‌جایی دستی شاه — بهتر بود زودتر قلعه می‌رفت');

    return parts;
  },

  // نکات راهبردی کلی بر اساس وضعیت فعلی (برای بازیکن)
  strategicAdvice(s){
    const parts = [];
    const phase = this.gamePhase(s);
    const myW = s.turn === 'w';

    if(phase === 'opening'){
      const rights = myW ? (s.castling.K || s.castling.Q) : (s.castling.k || s.castling.q);
      if(rights) parts.push('هنوز قلعه نرفته‌ای — امنیت شاه را زود تأمین کن 🛡️');
      let back = 0;
      const homeSquares = myW ? [57,58,59,61,62] : [1,2,3,5,6];
      for(const sq of homeSquares){
        const p = s.board[sq];
        if(p && (p.toLowerCase() === 'n' || p.toLowerCase() === 'b')) back++;
      }
      if(back >= 3) parts.push('مهره‌های سبک هنوز در خانهٔ اولیه‌اند — آن‌ها را بگسترش کن');
    }

    if(phase === 'endgame'){
      let myP = 0, opP = 0;
      for(const p of s.board){
        if(p && p.toLowerCase() === 'p'){
          if(isW(p) === myW) myP++; else opP++;
        }
      }
      if(myP > opP) parts.push('آخر بازی است و پیادهٔ اضافی داری — آن را به سمت ارتقا پیش ببر 🚀');
      parts.push('در آخر بازی، شاه یک مهرهٔ جنگنده است — آن را فعال کن');
    }

    const hang = this.hangingPieces(s, s.turn);
    if(hang.length)
      parts.push('مراقب باش: ' + hang.slice(0,2).map(h => h.san).join(' و ') + ' بی‌دفاع است!');

    return parts;
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
    return t + ' (' + this.materialSummary(S) + ')';
  },

  pvText(maxN){
    let s = S; const out = [];
    for(let i = 0; i < Math.min(this.pv.length, maxN); i++){
      const token = this.pv[i];
      const from = parseSq(token.slice(0,2)), to = parseSq(token.slice(2,4)), promo = token[4] || null;
      const mv = legalMoves(s).find(x => x.from === from && x.to === to && (x.promo || null) === (promo || null));
      if(!mv){ out.push(token); break; }
      out.push(sanOf(s, mv, legalMoves(s)).replace(/[+#]$/, ''));
      s = makeMove(s, mv);
    }
    return out.join('، ');
  },

  say(html, cls){
    const log = $('coachLog');
    const div = document.createElement('div');
    div.className = 'msg ' + (cls || 'coach');
    div.innerHTML = html;
    log.appendChild(div);
    while(log.children.length > 40) log.removeChild(log.firstChild);
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
      const d = Math.min([1,2,3,4,4][level] + 1, 4); // مربی همیشه یک عمق بیشتر
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
    const legal = legalMoves(S);
    const san = sanOf(S, m, legal);
    const uci = token || (sqName(m.from) + sqName(m.to) + (m.promo || ''));
    this.move = {from:m.from, to:m.to, promo:m.promo || null, uci, san};

    const reasons = this.describeMove(S, m);
    const advice  = this.strategicAdvice(S);
    const op      = this.openingName();

    let txt = '🎓 <b>پیشنهاد مربی:</b> ' + san + ' <span style="color:#8a8f9c">(' + uci + ')</span> — خانه‌هایش روی صفحه سبز شد';
    if(op)            txt += '<br>📖 <b>شروع بازی:</b> ' + op;
    if(reasons.length) txt += '<br>🧭 <b>دلیل حرکت:</b> ' + reasons.join('؛ ') + '.';
    if(advice.length)  txt += '<br>🛡️ <b>نکتهٔ راهبردی:</b> ' + advice.join('؛ ') + '.';
    if(this.score)     txt += '<br>⚖️ <b>ارزیابی:</b> ' + this.evalText();
    if(this.pv.length > 1) txt += '<br>🔮 <b>ادامهٔ پیشنهادی:</b> ' + this.pvText(4);
    this.say(txt, 'coach');

    setStatus('نوبت شماست ♙ (پیشنهاد مربی: ' + san + ')');
    render();
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
     🔗 قلاب‌هایی که chess.html صدا می‌زند
     ============================================================ */

  // بعد از حرکت حریف: توضیح + هشدار + مربی خودکار
  afterOpponentMove(){
    const h = hist[hist.length - 1];
    if(h){
      const reasons = this.describeMove(h.before, h.m);
      let txt = '🔍 <b>حرکت حریف:</b> ' + h.san;
      if(reasons.length) txt += '<br><b>تحلیل:</b> ' + reasons.join('؛ ') + '.';
      const hang = this.hangingPieces(S, humanColor);
      if(hang.length)
        txt += '<br>⚠️ <b>هشدار:</b> ' + hang.slice(0,2).map(x => x.san).join(' و ')
             + ' بی‌دفاع شده و حریف می‌تواند آن را بگیرد!';
      this.say(txt, 'analyst');
    }
    this.checkOpeningChange();
    if($('chkAutoCoach').checked && !gameOver) this.go();
  },

  // قبل از اعمال حرکت بازیکن
  onHumanMove(m, humanSan, humanUci){
    const suggested = this.move;
    this.stop();
    this.move = null;
    this._lastSuggested = suggested;
    this._lastHuman = {san: humanSan, uci: humanUci};
  },

  // بعد از اعمال حرکت بازیکن
  afterHumanMove(){
    const suggested = this._lastSuggested, human = this._lastHuman;
    this._lastSuggested = null; this._lastHuman = null;
    this.checkOpeningChange();
    if(gameOver) return;
    if(suggested && human){
      if(human.uci === suggested.uci)
        this.say('👏 آفرین! دقیقاً حرکت پیشنهادی مربی را بازی کردی.', 'sys');
      else
        this.say('حرکت تو: <b>' + human.san + '</b> — پیشنهاد مربی: <b>' + suggested.san
               + '</b> بود. ببینیم چه می‌شود!', 'sys');
    }
    const hang = this.hangingPieces(S, humanColor);
    if(hang.length)
      this.say('⚠️ مراقب باش: ' + hang.slice(0,2).map(x => x.san).join(' و ')
             + ' بی‌دفاع است و حریف می‌تواند آن را بگیرد!', 'sys');
  },

  reset(){
    this.stop();
    this.move = null; this.pv = []; this.score = null;
    this.pending = false; this.lastOpening = null;
    this.say('— بازی جدید شروع شد —', 'sys');
    if(humanColor === 'b') return; // حریف اول بازی می‌کند؛ بعد از حرکتش تحلیل می‌شود
    if($('chkAutoCoach').checked)
      this.say('🎓 مربی: پیشنهاد شروع: پیادهٔ شاه (e4) یا وزیر (d4) را دو خانه جلو ببر، سپس اسب‌ها و فیل‌ها را بگسترش کن و زود قلعه برو 🛡️', 'sys');
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
    this.say('🎓 مربی آماده است! من فقط راهنمایی می‌کنم و اجازهٔ جابه‌جایی مهره‌ها را ندارم — تصمیم نهایی با توست. اگر به پیشنهاد من گوش کنی، چون همیشه قوی‌تر از حریف محاسبه می‌کنم، شانس بردت بالا می‌رود 💪', 'sys');
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
      el.textContent = '⚖️ حریف: عمق ' + LEVELS_SF[level].depth + ' با مهارت ' + LEVELS_SF[level].skill
        + ' — مربی: عمق ' + this.depth() + ' با مهارت ' + this.skill()
        + ' (همیشه قوی‌تر). اگر به مربی گوش کنی، شانس برد با توست!';
    else
      el.textContent = '⚖️ در موتور ساده، مربی همیشه یک سطح عمیق‌تر و بدون خطای تصادفی محاسبه می‌کند.';
  },
};
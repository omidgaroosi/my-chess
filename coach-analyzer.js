"use strict";
/* ============================================================
   🧠 coach-analyzer.js — موتور تحلیل عمیق پوزیسیون برای مربی
   ------------------------------------------------------------
   این ماژول به coach.js قدرت تشخیص تهدید، تحلیل ساختاری،
   و پیشنهاد آموزشی چندحرکته می‌دهد.
   ساخته شده توسط امید گروسی
   ============================================================ */

window.CoachAnalyzer = (function() {

  /* ================= ابزارهای پایه ================= */
  const FILES = 'abcdefgh';
  const sqName = sq => FILES[sq & 7] + (8 - (sq >> 3));
  const isW = p => p && p === p.toUpperCase();
  const colorOf = p => isW(p) ? 'w' : 'b';
  const FA_PIECE = {k:'شاه', q:'وزیر', r:'رخ', b:'فیل', n:'اسب', p:'پیاده'};
  const VALUE = {p:1, n:3, b:3, r:5, q:9, k:100};
  const FA_FILE = {a:'آ', b:'ب', c:'پ', d:'ت', e:'هـ', f:'و', g:'ژ', h:'ح'};
  const FA_RANK = {1:'۱', 2:'۲', 3:'۳', 4:'۴', 5:'۵', 6:'۶', 7:'۷', 8:'۸'};
  const faSq = sq => {
    const f = FILES[sq & 7], r = String(8 - (sq >> 3));
    return FA_FILE[f] + FA_RANK[r];
  };

  /* ================= ۱) تشخیص تهدیدهای فوری حریف ================= */
  /* فرض می‌کنیم نوبت حریف است. چه کارهایی می‌تواند بکند؟ */
  function detectThreats(s) {
    /* از توابع chess.html استفاده می‌کنیم */
    if(typeof legalMoves === 'undefined' || typeof makeMove === 'undefined')
      return { critical: [], high: [], medium: [] };

    const oppTurn = s.turn === 'w' ? 'b' : 'w';
    const oppState = {
      board: s.board.slice(),
      turn: oppTurn,
      castling: { ...s.castling },
      ep: s.ep,
      half: s.half,
      full: s.full
    };

    const threats = { critical: [], high: [], medium: [] };
    let oppMoves;
    try { oppMoves = legalMoves(oppState); } catch(e) { return threats; }

    for (const m of oppMoves) {
      const ns = makeMove(oppState, m);
      
      /* ۱) آیا حریف مات می‌کند؟ */
      let ourReplies;
      try { ourReplies = legalMoves(ns); } catch(e) { continue; }
      if (ourReplies.length === 0) {
        try {
          if (inCheck(ns, s.turn)) {
            threats.critical.push({
              type: 'mate',
              move: m,
              san: safeSan(oppState, m),
              message: '⛔ مات در یک حرکت!'
            });
            continue;
          }
        } catch(e) {}
      }

      /* ۲) آیا حریف وزیر یا مهرهٔ سنگین را تهدید می‌کند؟ */
      const capturedPiece = s.board[m.to];
      if (capturedPiece && capturedPiece.toLowerCase() !== 'p') {
        const capVal = VALUE[capturedPiece.toLowerCase()];
        const attackerPiece = s.board[m.from];
        const attackerVal = VALUE[attackerPiece.toLowerCase()];
        
        /* اگر مهاجم از هدف کم‌ارزش‌تر است، این یک تهدید واقعی است */
        if (capVal > attackerVal) {
          const isDefended = isSquareDefended(s, m.to, s.turn);
          if (!isDefended) {
            threats.high.push({
              type: 'free-piece',
              move: m,
              san: safeSan(oppState, m),
              piece: FA_PIECE[capturedPiece.toLowerCase()],
              value: capVal,
              sq: m.to,
              message: '⚠️ حریف می‌تواند ' + FA_PIECE[capturedPiece.toLowerCase()] + ' ' + faSq(m.to) + ' را رایگان بزند!'
            });
          } else {
            threats.medium.push({
              type: 'attack',
              move: m,
              san: safeSan(oppState, m),
              piece: FA_PIECE[capturedPiece.toLowerCase()],
              sq: m.to,
              message: '👁 حریف به ' + FA_PIECE[capturedPiece.toLowerCase()] + ' ' + faSq(m.to) + ' حمله می‌کند (اما دفاع‌شده است)'
            });
          }
        }
      }

      /* ۳) آیا حرکت حریف کیش می‌دهد؟ */
      try {
        if (inCheck(ns, s.turn)) {
          threats.high.push({
            type: 'check',
            move: m,
            san: safeSan(oppState, m),
            message: '⚡ حریف می‌تواند کیش بدهد: ' + safeSan(oppState, m)
          });
        }
      } catch(e) {}
    }

    return threats;
  }

  /* ================= ۲) تشخیص مهره‌های در خطر ================= */
  function detectHanging(s, color) {
    if(typeof attacked === 'undefined') return [];
    const result = [];
    const enemyW = color !== 'w';
    for (let sq = 0; sq < 64; sq++) {
      const p = s.board[sq];
      if (!p || colorOf(p) !== color) continue;
      if (p.toLowerCase() === 'k') continue;
      const isAttacked = attacked(s, sq, enemyW);
      if (!isAttacked) continue;
      const isDefended = attacked(s, sq, color === 'w');
      const val = VALUE[p.toLowerCase()];
      if (!isDefended) {
        result.push({
          sq, piece: p.toLowerCase(),
          name: FA_PIECE[p.toLowerCase()],
          faSq: faSq(sq),
          value: val,
          defended: false
        });
      } else if (val >= 5) {
        result.push({
          sq, piece: p.toLowerCase(),
          name: FA_PIECE[p.toLowerCase()],
          faSq: faSq(sq),
          value: val,
          defended: true,
          underPressure: true
        });
      }
    }
    result.sort((a, b) => b.value - a.value);
    return result;
  }

  /* ================= ۳) تحلیل کامل پوزیسیون ================= */
  function analyze(s, perspective) {
    const myColor = perspective || s.turn;
    return {
      material: analyzeMaterial(s, myColor),
      kingSafety: analyzeKingSafety(s, myColor),
      activity: analyzeActivity(s, myColor),
      pawns: analyzePawns(s, myColor),
      threats: detectThreats(s),
      hanging: detectHanging(s, myColor),
      phase: getPhase(s),
      centerControl: analyzeCenter(s, myColor)
    };
  }

  /* ================= ۴) تحلیل مواد ================= */
  function analyzeMaterial(s, myColor) {
    let myMat = 0, oppMat = 0;
    for (const p of s.board) {
      if (!p) continue;
      const v = VALUE[p.toLowerCase()] || 0;
      if (colorOf(p) === myColor) myMat += v;
      else oppMat += v;
    }
    const diff = myMat - oppMat;
    return { myMat, oppMat, diff };
  }

  /* ================= ۵) تحلیل امنیت شاه ================= */
  function analyzeKingSafety(s, myColor) {
    if(typeof kingSq === 'undefined') return { score: 0, message: '?' };
    const kSq = kingSq(s, myColor === 'w');
    if (kSq < 0) return { score: 0, message: 'شاه پیدا نشد' };
    
    const r = kSq >> 3, c = kSq & 7;
    const enemyW = myColor !== 'w';
    
    /* ۱) آیا شاه در حالت قلعه است؟ */
    const isCastled = (myColor === 'w' && (kSq === 62 || kSq === 58)) ||
                      (myColor === 'b' && (kSq === 6 || kSq === 2));
    
    /* ۲) شمارش پیاده‌های سپر */
    let shield = 0;
    const dir = myColor === 'w' ? -1 : 1;
    for (const dc of [-1, 0, 1]) {
      const rr = r + dir, cc = c + dc;
      if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
      const p = s.board[rr * 8 + cc];
      if (p && p.toLowerCase() === 'p' && colorOf(p) === myColor) shield++;
    }
    
    /* ۳) شمارش مهاجمان در نزدیکی شاه */
    let attackers = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.board[i];
      if (!p || colorOf(p) === myColor) continue;
      const dist = Math.max(Math.abs((i >> 3) - r), Math.abs((i & 7) - c));
      if (dist <= 3) attackers++;
    }
    
    /* محاسبهٔ امتیاز امنیت */
    let score = 50;
    if (isCastled) score += 20;
    score += shield * 8;
    score -= attackers * 5;
    if (kSq >> 3 === 3 || kSq >> 3 === 4) score -= 15; /* شاه در مرکز */
    if (typeof inCheck !== 'undefined' && inCheck(s, myColor)) score -= 25;
    
    return { score: Math.max(0, Math.min(100, score)), isCastled, shield, attackers, kSq };
  }

  /* ================= ۶) تحلیل فعالیت مهره‌ها ================= */
  function analyzeActivity(s, myColor) {
    if (typeof pseudoMoves === 'undefined') return { score: 0, inactive: [] };
    
    let totalMoves = 0;
    const inactive = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = s.board[sq];
      if (!p || colorOf(p) !== myColor) continue;
      const pieceMoves = pseudoMoves({
        ...s, turn: myColor
      }).filter(m => m.from === sq);
      const count = pieceMoves.length;
      totalMoves += count;
      
      /* مهره‌های کم‌تحرک */
      if (count <= 2 && p.toLowerCase() !== 'k' && p.toLowerCase() !== 'p') {
        inactive.push({
          sq, piece: p.toLowerCase(),
          name: FA_PIECE[p.toLowerCase()],
          faSq: faSq(sq),
          moves: count
        });
      }
    }
    return { score: Math.min(100, totalMoves * 3), inactive };
  }

  /* ================= ۷) تحلیل پیاده‌ها ================= */
  function analyzePawns(s, myColor) {
    const files = new Array(8).fill(0);
    const pawns = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = s.board[sq];
      if (!p || p.toLowerCase() !== 'p') continue;
      if (colorOf(p) !== myColor) continue;
      files[sq & 7]++;
      pawns.push({ sq, file: sq & 7, rank: sq >> 3 });
    }
    
    const doubled = files.filter(f => f >= 2).length;
    const isolated = pawns.filter(p => {
      const leftFile = p.file - 1;
      const rightFile = p.file + 1;
      const hasLeft = leftFile >= 0 && files[leftFile] > 0;
      const hasRight = rightFile < 8 && files[rightFile] > 0;
      return !hasLeft && !hasRight;
    });
    
    return {
      count: pawns.length,
      doubled,
      isolated: isolated.length,
      isolatedSquares: isolated.map(p => faSq(p.sq))
    };
  }

  /* ================= ۸) کنترل مرکز ================= */
  function analyzeCenter(s, myColor) {
    const centerSquares = [27, 28, 35, 36]; /* d4, e4, d5, e5 */
    let mine = 0, theirs = 0;
    if (typeof attacked === 'undefined') return { mine: 0, theirs: 0 };
    for (const sq of centerSquares) {
      if (attacked(s, sq, myColor === 'w')) mine++;
      if (attacked(s, sq, myColor !== 'w')) theirs++;
    }
    return { mine, theirs };
  }

  /* ================= ۹) فاز بازی ================= */
  function getPhase(s) {
    let q = 0, r = 0, minors = 0;
    for (const p of s.board) {
      if (!p) continue;
      const t = p.toLowerCase();
      if (t === 'q') q++;
      else if (t === 'r') r++;
      else if (t === 'n' || t === 'b') minors++;
    }
    if (q === 0 && r <= 2) return 'endgame';
    if (s.full <= 10 && (q >= 2 || r + minors >= 6)) return 'opening';
    return 'middlegame';
  }

  /* ================= ۱۰) توابع کمکی ================= */
  function isSquareDefended(s, sq, color) {
    if (typeof attacked === 'undefined') return false;
    return attacked(s, sq, color === 'w');
  }

  function safeSan(state, move) {
    try {
      if (typeof sanOf === 'function' && typeof legalMoves === 'function') {
        return sanOf(state, move, legalMoves(state));
      }
    } catch(e) {}
    return sqName(move.from) + '→' + sqName(move.to);
  }

  /* ================= API ================= */
  return {
    detectThreats,
    detectHanging,
    analyze,
    analyzeMaterial,
    analyzeKingSafety,
    analyzeActivity,
    analyzePawns,
    analyzeCenter,
    getPhase,
    faSq,
    FA_PIECE,
    VALUE
  };
})();
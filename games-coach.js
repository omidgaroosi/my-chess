"use strict";
/* ============================================================
   🎓 games-coach.js — تحلیلگر خودکار بازی‌های کامل
   ------------------------------------------------------------
   با استفاده از استاک‌فیش، هر حرکت بازی را تحلیل می‌کند و
   کیفیت آن را می‌سنجد. برای بخش «سینما» استفاده می‌شود.
   ساخته شده توسط امید گروسی
   ============================================================ */

window.GamesCoach = (() => {

  let _state = null;

  const QUALITY = {
    brilliant: { label: 'شاهکار', icon: '!!', color: '#ab47bc', score: 100 },
    best:      { label: 'بهترین', icon: '★',  color: '#4caf50', score: 95 },
    excellent: { label: 'عالی',   icon: '✓',  color: '#81c784', score: 85 },
    good:      { label: 'خوب',    icon: '·',  color: '#a5d6a7', score: 70 },
    inaccuracy:{ label: 'نااستادانه', icon: '?!', color: '#ffd54f', score: 50 },
    mistake:   { label: 'اشتباه', icon: '?',  color: '#ff9800', score: 30 },
    blunder:   { label: 'فاجعه',  icon: '??', color: '#e53935', score: 10 },
    unclear:   { label: 'نامشخص', icon: '…',  color: '#8a8f9c', score: 50 }
  };

  /* ============================================================
     شروع تحلیل
     ============================================================ */
  function startAnalysis(game, callbacks) {
    callbacks = callbacks || {};

    if (!game) {
      callbacks.onError && callbacks.onError('بازی نامعتبر است');
      return;
    }

    /* ✅ نرمال‌سازی: اگر sans خالی است ولی pgn متنی موجود است، از آن استخراج کن */
    if ((!Array.isArray(game.sans) || !game.sans.length) && game.pgn) {
      try {
        if (typeof ChessPGN !== 'undefined' && ChessPGN.parse) {
          const parsed = ChessPGN.parse(game.pgn);
          game.sans = parsed.moves.filter(t =>
            /^([KQRBNO]|[a-h])/.test(t) && !/^\d/.test(t)
          );
        }
      } catch(e) {
        console.warn('⚠️ خطا در استخراج sans از pgn:', e);
      }
    }

    if (!Array.isArray(game.sans) || !game.sans.length) {
      callbacks.onError && callbacks.onError('بازی حرکتی ندارد');
      return;
    }
    if (typeof engineReady === 'undefined' || !engineReady || typeof sfSend !== 'function') {
      callbacks.onError && callbacks.onError('استاک‌فیش هنوز آماده نیست. چند ثانیه صبر کن.');
      return;
    }

    /* بازسازی موقعیت‌ها */
    const positions = _reconstructPositions(game);
    if (!positions || positions.length < 1) {
      callbacks.onError && callbacks.onError('بازسازی حرکات ناموفق بود');
      return;
    }

    _state = {
      game,
      positions,
      results: [],
      idx: 0,
      active: true,
      callbacks,
      analysisDepth: 13,
      _bestScore: null,
      _bestPv: [],
      _bestMove: null
    };

    callbacks.onStart && callbacks.onStart(positions.length);
    _analyzeNext();
  }

  function stopAnalysis() {
    if (_state) _state.active = false;
    try {
      if (typeof sfSend === 'function') sfSend('stop');
      if (typeof searchRole !== 'undefined') searchRole = null;
    } catch(e) {}
  }

  function _analyzeNext() {
    if (!_state || !_state.active) return;
    if (_state.idx >= _state.positions.length) {
      _state.active = false;
      try { if (typeof searchRole !== 'undefined') searchRole = null; } catch(e) {}
      if (_state.callbacks.onComplete) {
        _state.callbacks.onComplete(_state.results);
      }
      return;
    }

    const pos = _state.positions[_state.idx];
    _state._bestScore = null;
    _state._bestPv = [];
    _state._bestMove = null;

    try { if (typeof searchRole !== 'undefined') searchRole = 'games-coach'; } catch(e) {}

    sfSend('setoption name Skill Level value 20');
    sfSend('position fen ' + pos.fen);
    sfSend('go depth ' + _state.analysisDepth);

    if (_state.callbacks.onProgress) {
      _state.callbacks.onProgress(_state.idx, _state.positions.length, pos);
    }
  }

  /* ============================================================
     پیام‌های استاک‌فیش
     ============================================================ */
  function onInfo(line) {
    if (!_state || !_state.active) return;
    const ms = line.match(/ score (cp|mate) (-?\d+)/);
    if (ms) {
      _state._bestScore = { mate: ms[1] === 'mate', v: +ms[2] };
    }
    const pvm = line.match(/ pv (.+)$/);
    if (pvm) _state._bestPv = pvm[1].trim().split(/\s+/);
  }

  function onBestmove(token) {
    if (!_state || !_state.active) return;

    if (!token || token === '(none)') {
      _state.idx++;
      setTimeout(_analyzeNext, 20);
      return;
    }

    const pos = _state.positions[_state.idx];
    const playedUci = pos.uci;
    const bestUci = token;

    /* ارزیابی بهترین حرکت */
    const bestScore = _state._bestScore;
    const evalBest = bestScore ? bestScore.v : null;
    const mateBest = bestScore ? bestScore.mate : false;

    /* تعیین کیفیت */
    let quality = 'good';
    if (playedUci === bestUci) {
      quality = 'best';
    } else if (bestScore) {
      /* ارزیابی موفعیت پس از حرکت بازیکن */
      const playedEval = _evalAfterMove(pos, playedUci);
      if (playedEval !== null && evalBest !== null) {
        const diff = Math.abs(evalBest - playedEval);
        /* مقیاس تقریبی */
        if (diff < 20) quality = 'excellent';
        else if (diff < 60) quality = 'good';
        else if (diff < 130) quality = 'inaccuracy';
        else if (diff < 300) quality = 'mistake';
        else quality = 'blunder';
      }
    }

    /* SAN بهترین حرکت */
    let bestSan = '?';
    if (_state._bestPv && _state._bestPv[0]) {
      bestSan = _uciToSan(_state._bestPv[0], pos.board, pos.turn);
    } else {
      bestSan = _uciToSan(bestUci, pos.board, pos.turn);
    }

    _state.results.push({
      idx: _state.idx,
      moveNumber: Math.floor(_state.idx / 2) + 1,
      color: pos.turn,
      san: pos.san,
      playedUci,
      bestUci,
      bestSan,
      quality,
      eval: evalBest,
      mate: mateBest,
      pv: _state._bestPv ? _state._bestPv.slice(0, 5) : []
    });

    _state.idx++;
    setTimeout(_analyzeNext, 30);
  }

  /* ============================================================
     کمکی‌ها
     ============================================================ */
  function _reconstructPositions(game) {
    if (typeof initialState === 'undefined') return null;
    let s = initialState();
    const out = [];
    const sans = game.sans || [];
    for (let i = 0; i < sans.length; i++) {
      const san = sans[i];
      const legal = legalMoves(s);
      const clean = san.replace(/[+#?!]/g, '');
      let found = null;
      for (const m of legal) {
        const s1 = sanOf(s, m, legal);
        if (s1 === san || s1.replace(/[+#?!]/g, '') === clean) {
          found = m;
          break;
        }
      }
      if (!found) break;

      out.push({
        board: s.board.slice(),
        turn: s.turn,
        castling: { ...s.castling },
        ep: s.ep,
        half: s.half,
        full: s.full,
        san: sanOf(s, found, legal),
        uci: _sqName(found.from) + _sqName(found.to) + (found.promo || ''),
        fen: _stateFen(s)
      });

      s = makeMove(s, found);
    }
    return out;
  }

  function _stateFen(s) {
    let placement = '', empty = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = s.board[r * 8 + c];
        if (!p) empty++;
        else { if (empty) { placement += empty; empty = 0; } placement += p; }
      }
      if (empty) { placement += empty; empty = 0; }
      if (r < 7) placement += '/';
    }
    const castling = ((s.castling.K ? 'K' : '') + (s.castling.Q ? 'Q' : '') +
                     (s.castling.k ? 'k' : '') + (s.castling.q ? 'q' : '')) || '-';
    const ep = s.ep >= 0 ? _sqName(s.ep) : '-';
    return placement + ' ' + s.turn + ' ' + castling + ' ' + ep + ' ' + s.half + ' ' + s.full;
  }

  function _sqName(sq) {
    if (sq < 0 || sq > 63) return '-';
    return 'abcdefgh'[sq & 7] + (8 - (sq >> 3));
  }

  function _uciToSan(uci, board, turn) {
    if (!uci || uci.length < 4) return uci;
    if (typeof parseSq === 'undefined' || typeof sanOf === 'undefined') return uci;
    try {
      const from = parseSq(uci.slice(0, 2));
      const to = parseSq(uci.slice(2, 4));
      const promo = uci[4] || null;
      const fake = {
        board: board.slice(),
        turn,
        castling: { K: 0, Q: 0, k: 0, q: 0 },
        ep: -1, half: 0, full: 1
      };
      const legal = legalMoves(fake);
      const m = legal.find(x => x.from === from && x.to === to && (x.promo || null) === promo);
      return m ? sanOf(fake, m, legal) : uci;
    } catch(e) { return uci; }
  }

  /* ارزیابی سریع موفعیت پس از یک حرکت — فقط برای تخمین افت */
  function _evalAfterMove(pos, uci) {
    try {
      if (typeof applyUci === 'undefined' || typeof evalBoard === 'undefined') return null;
      const newBoard = applyUci(pos.board.slice(), uci);
      const turn = pos.turn === 'w' ? 'b' : 'w';
      const fake = {
        board: newBoard, turn,
        castling: { K: 0, Q: 0, k: 0, q: 0 },
        ep: -1, half: 0, full: 1
      };
      return evalBoard(fake);
    } catch(e) { return null; }
  }

  /* ============================================================
     API
     ============================================================ */
  return {
    startAnalysis,
    stopAnalysis,
    onInfo,
    onBestmove,
    QUALITY,
    isActive: () => !!(_state && _state.active),
    getState: () => _state
  };
})();
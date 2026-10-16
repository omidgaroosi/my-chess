"use strict";
/* ============================================================
   ♟️ chess-core.js — موتور و هستهٔ شطرنج
   ------------------------------------------------------------
   تمام توابع پایهٔ شطرنج: قوانین، حرکت‌ها، ارزیابی و رسم صفحه.
   این ماژول توسط ماژول‌های دیگر استفاده می‌شود.
   ساخته شده توسط امید گروسی
   ============================================================ */

/* ================= ثابت‌ها ================= */
const FILES = 'abcdefgh';
const GLYPH = {k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟'};
const N_OFF = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const K_OFF = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const B_DIRS = [[-1,-1],[-1,1],[1,-1],[1,1]];
const R_DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

/* ================= توابع کمکی پایه ================= */
const isW = p => p && p === p.toUpperCase();
const colorOf = p => isW(p) ? 'w' : 'b';
const sqName = sq => FILES[sq & 7] + (8 - (sq >> 3));

function parseSq(s){
  const f = FILES.indexOf(s[0]);
  if(f < 0) return -1;
  return (8 - (+s[1])) * 8 + f;
}

function initialBoard(){
  const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const b = new Array(64).fill(null);
  let sq = 0;
  for(const ch of fen){
    if(ch === '/') continue;
    if(/\d/.test(ch)){ sq += +ch; continue; }
    b[sq++] = ch;
  }
  return b;
}

const initialState = () => ({
  board: initialBoard(),
  turn: 'w',
  castling: {K:1, Q:1, k:1, q:1},
  ep: -1,
  half: 0,
  full: 1
});

/* ================= تشخیص حمله ================= */
function attacked(s, sq, byWhite, ignoreSq){
  const r = sq >> 3, c = sq & 7;
  const P = byWhite ? 'P' : 'p';
  const Nn = byWhite ? 'N' : 'n';
  const Kk = byWhite ? 'K' : 'k';
  const Bb = byWhite ? 'B' : 'b';
  const Rr = byWhite ? 'R' : 'r';
  const Qq = byWhite ? 'Q' : 'q';

  /* پیاده */
  const pr = byWhite ? r + 1 : r - 1;
  if(pr >= 0 && pr < 8){
    if(c > 0 && pr * 8 + c - 1 !== ignoreSq && s.board[pr * 8 + c - 1] === P) return true;
    if(c < 7 && pr * 8 + c + 1 !== ignoreSq && s.board[pr * 8 + c + 1] === P) return true;
  }

  /* اسب */
  for(const [dr, dc] of N_OFF){
    const rr = r + dr, cc = c + dc;
    if(rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && rr * 8 + cc !== ignoreSq && s.board[rr * 8 + cc] === Nn) return true;
  }

  /* شاه */
  for(const [dr, dc] of K_OFF){
    const rr = r + dr, cc = c + dc;
    if(rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && rr * 8 + cc !== ignoreSq && s.board[rr * 8 + cc] === Kk) return true;
  }

  /* فیل و وزیر (قطرها) */
  for(const [dr, dc] of B_DIRS){
    let rr = r + dr, cc = c + dc;
    while(rr >= 0 && rr < 8 && cc >= 0 && cc < 8){
      const sq2 = rr * 8 + cc;
      if(sq2 === ignoreSq){ rr += dr; cc += dc; continue; }
      const p = s.board[sq2];
      if(p){
        if(p === Bb || p === Qq) return true;
        break;
      }
      rr += dr; cc += dc;
    }
  }

  /* رخ و وزیر (ستون‌ها و ردیف‌ها) */
  for(const [dr, dc] of R_DIRS){
    let rr = r + dr, cc = c + dc;
    while(rr >= 0 && rr < 8 && cc >= 0 && cc < 8){
      const sq2 = rr * 8 + cc;
      if(sq2 === ignoreSq){ rr += dr; cc += dc; continue; }
      const p = s.board[sq2];
      if(p){
        if(p === Rr || p === Qq) return true;
        break;
      }
      rr += dr; cc += dc;
    }
  }
  return false;
}

const kingSq = (s, w) => s.board.indexOf(w ? 'K' : 'k');
const inCheck = (s, c) => attacked(s, kingSq(s, c === 'w'), c !== 'w');

/* ================= تولید حرکت‌ها ================= */
function addPawn(ms, from, to, promoR){
  if((to >> 3) === promoR){
    for(const pr of ['q', 'r', 'b', 'n']) ms.push({from, to, promo: pr});
  } else {
    ms.push({from, to});
  }
}

function pseudoMoves(s){
  const ms = [], white = s.turn === 'w';
  for(let sq = 0; sq < 64; sq++){
    const p = s.board[sq];
    if(!p || isW(p) !== white) continue;
    const r = sq >> 3, c = sq & 7, t = p.toLowerCase();

    if(t === 'p'){
      const dir = white ? -1 : 1;
      const startR = white ? 6 : 1;
      const promoR = white ? 0 : 7;
      const rr = r + dir;
      if(rr >= 0 && rr < 8 && !s.board[rr * 8 + c]){
        addPawn(ms, sq, rr * 8 + c, promoR);
        if(r === startR && !s.board[(r + 2 * dir) * 8 + c]){
          ms.push({from: sq, to: (r + 2 * dir) * 8 + c});
        }
      }
      for(const dc of [-1, 1]){
        const cc = c + dc;
        if(cc < 0 || cc > 7 || rr < 0 || rr > 7) continue;
        const to = rr * 8 + cc, q = s.board[to];
        if(q && isW(q) !== white) addPawn(ms, sq, to, promoR);
        else if(to === s.ep && !q) ms.push({from: sq, to, ep: true});
      }
    }
    else if(t === 'n' || t === 'k'){
      for(const [dr, dc] of (t === 'n' ? N_OFF : K_OFF)){
        const rr = r + dr, cc = c + dc;
        if(rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const to = rr * 8 + cc, q = s.board[to];
        if(!q || isW(q) !== white) ms.push({from: sq, to});
      }
    }
    else {
      const dirs = t === 'b' ? B_DIRS : t === 'r' ? R_DIRS : B_DIRS.concat(R_DIRS);
      for(const [dr, dc] of dirs){
        let rr = r + dr, cc = c + dc;
        while(rr >= 0 && rr < 8 && cc >= 0 && cc < 8){
          const to = rr * 8 + cc, q = s.board[to];
          if(!q) ms.push({from: sq, to});
          else {
            if(isW(q) !== white) ms.push({from: sq, to});
            break;
          }
          rr += dr; cc += dc;
        }
      }
    }
  }

  /* قلعه */
  if(white){
    if(s.castling.K && !s.board[61] && !s.board[62] && s.board[63] === 'R'
      && !attacked(s, 60, false) && !attacked(s, 61, false) && !attacked(s, 62, false))
      ms.push({from: 60, to: 62, castle: 'K'});
    if(s.castling.Q && !s.board[59] && !s.board[58] && !s.board[57] && s.board[56] === 'R'
      && !attacked(s, 60, false) && !attacked(s, 59, false) && !attacked(s, 58, false))
      ms.push({from: 60, to: 58, castle: 'Q'});
  } else {
    if(s.castling.k && !s.board[5] && !s.board[6] && s.board[7] === 'r'
      && !attacked(s, 4, true) && !attacked(s, 5, true) && !attacked(s, 6, true))
      ms.push({from: 4, to: 6, castle: 'k'});
    if(s.castling.q && !s.board[3] && !s.board[2] && !s.board[1] && s.board[0] === 'r'
      && !attacked(s, 4, true) && !attacked(s, 3, true) && !attacked(s, 2, true))
      ms.push({from: 4, to: 2, castle: 'q'});
  }
  return ms;
}

function makeMove(s, m){
  const b = s.board.slice();
  const ns = {
    board: b,
    turn: s.turn === 'w' ? 'b' : 'w',
    castling: {...s.castling},
    ep: -1,
    half: s.half + 1,
    full: s.full + (s.turn === 'b' ? 1 : 0)
  };
  const p = b[m.from], white = isW(p), cap = b[m.to];
  if(p.toLowerCase() === 'p' || cap) ns.half = 0;
  b[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : p;
  b[m.from] = null;
  if(m.ep) b[m.to + (white ? 8 : -8)] = null;
  if(m.castle === 'K'){ b[61] = b[63]; b[63] = null; }
  if(m.castle === 'Q'){ b[59] = b[56]; b[56] = null; }
  if(m.castle === 'k'){ b[5] = b[7]; b[7] = null; }
  if(m.castle === 'q'){ b[3] = b[0]; b[0] = null; }
  if(p === 'K') ns.castling.K = ns.castling.Q = 0;
  if(p === 'k') ns.castling.k = ns.castling.q = 0;
  if(m.from === 63 || m.to === 63) ns.castling.K = 0;
  if(m.from === 56 || m.to === 56) ns.castling.Q = 0;
  if(m.from === 7 || m.to === 7) ns.castling.k = 0;
  if(m.from === 0 || m.to === 0) ns.castling.q = 0;
  if(p.toLowerCase() === 'p' && Math.abs(m.to - m.from) === 16) ns.ep = (m.from + m.to) / 2;
  return ns;
}

const legalMoves = s => pseudoMoves(s).filter(m => !inCheck(makeMove(s, m), s.turn));

const keyOf = s => s.board.map(p => p || '-').join('') + s.turn +
  (s.castling.K ? 'K' : '') + (s.castling.Q ? 'Q' : '') +
  (s.castling.k ? 'k' : '') + (s.castling.q ? 'q' : '') + s.ep;

function insufficient(s){
  const minors = [];
  for(const p of s.board){
    if(p){
      const t = p.toLowerCase();
      if(t === 'p' || t === 'r' || t === 'q') return false;
      if(t === 'n' || t === 'b') minors.push(p);
    }
  }
  return minors.length <= 1 ||
    (minors.length === 2 && colorOf(minors[0]) !== colorOf(minors[1]));
}

/* ================= نت‌نویسی ================= */
function sanOf(s, m, legal){
  if(m.castle) return (m.castle === 'K' || m.castle === 'k') ? 'O-O' : 'O-O-O';
  const p = s.board[m.from], t = p.toLowerCase();
  const capture = !!s.board[m.to] || m.ep;
  let san = '';
  if(t === 'p'){
    if(capture) san += FILES[m.from & 7] + 'x';
    san += sqName(m.to);
    if(m.promo) san += '=' + m.promo.toUpperCase();
  } else {
    san += t.toUpperCase();
    const rivals = legal.filter(x => x.to === m.to && x.from !== m.from && s.board[x.from] === p);
    if(rivals.length){
      const sameFile = rivals.some(x => (x.from & 7) === (m.from & 7));
      const sameRank = rivals.some(x => (x.from >> 3) === (m.from >> 3));
      if(!sameFile) san += FILES[m.from & 7];
      else if(!sameRank) san += String(8 - (m.from >> 3));
      else san += sqName(m.from);
    }
    if(capture) san += 'x';
    san += sqName(m.to);
  }
  const ns = makeMove(s, m);
  if(inCheck(ns, ns.turn)) san += legalMoves(ns).length ? '+' : '#';
  return san;
}

/* ================= FEN و UCI ================= */
function parseFEN(fen){
  const b = new Array(64).fill(null);
  let sq = 0;
  for(const row of fen.split(' ')[0].split('/')){
    for(const ch of row){
      if(/\d/.test(ch)) sq += +ch;
      else b[sq++] = ch;
    }
  }
  return b;
}

function applyUci(board, uci){
  const from = parseSq(uci.slice(0, 2));
  const to = parseSq(uci.slice(2, 4));
  const promo = uci[4] || null;
  const p = board[from];
  if(!p) return board;
  const isEp = p.toLowerCase() === 'p' && board[to] === null && (from & 7) !== (to & 7);
  board[to] = promo ? (isW(p) ? promo.toUpperCase() : promo) : p;
  board[from] = null;
  if(p.toLowerCase() === 'k' && Math.abs((to & 7) - (from & 7)) === 2){
    if(to > from){ board[from + 1] = board[from + 3]; board[from + 3] = null; }
    else { board[from - 1] = board[from - 4]; board[from - 4] = null; }
  }
  if(isEp) board[(to & 7) | (from & 56)] = null;
  return board;
}

/* ================= رسم صفحه ================= */
function renderBoardEl(el, board, highlights, last){
  if(!el) return;
  let html = '';
  for(let i = 0; i < 64; i++){
    const r = i >> 3, c = i & 7;
    let cls = 'cell ' + (((r + c) % 2 === 1) ? 'dark' : 'light');
    if(highlights && highlights.includes(sqName(i))) cls += ' hl';
    if(last && (last.from === i || last.to === i)) cls += ' llast';
    const p = board[i];
    html += '<div class="' + cls + '">'
      + (c === 0 ? '<span class="coord rank">' + (8 - r) + '</span>' : '')
      + (r === 7 ? '<span class="coord file">' + FILES[c] + '</span>' : '')
      + (p ? '<span class="piece ' + (isW(p) ? 'w' : 'b') + '">' + pieceSvg(p, isW(p)) + '</span>' : '')
      + '</div>';
  }
  el.innerHTML = html;
}

/* ================= موتور سادهٔ داخلی ================= */
const VALC = {p:100, n:320, b:330, r:500, q:900, k:0};

const PST = {
  p: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10,
      5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5,
      5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  n: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40,
      -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
      -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30,
      -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  b: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10,
      -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
      -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10,
      -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  r: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10,
      -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5,
      -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  k: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10,
      20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]
};

function evalBoard(s){
  let sc = 0;
  for(let sq = 0; sq < 64; sq++){
    const p = s.board[sq];
    if(!p) continue;
    const t = p.toLowerCase();
    const v = VALC[t] + PST[t][isW(p) ? sq : (sq ^ 56)];
    sc += isW(p) ? v : -v;
  }
  return s.turn === 'w' ? sc : -sc;
}

function capVal(s, m){
  const q = s.board[m.to];
  if(q) return VALC[q.toLowerCase()];
  return m.ep ? 100 : 0;
}

function abSearch(s, depth, alpha, beta){
  if(depth === 0) return evalBoard(s);
  const ms = pseudoMoves(s);
  ms.sort((a, b) => capVal(s, b) - capVal(s, a));
  let legal = 0;
  for(const m of ms){
    const ns = makeMove(s, m);
    if(inCheck(ns, s.turn)) continue;
    legal++;
    const v = -abSearch(ns, depth - 1, -beta, -alpha);
    if(v > alpha){ alpha = v; if(alpha >= beta) break; }
  }
  if(!legal) return inCheck(s, s.turn) ? -(99999 + depth) : 0;
  return alpha;
}

function chooseAiMove(s, depth, jitter){
  const ms = legalMoves(s);
  if(!ms.length) return null;
  ms.sort((a, b) => capVal(s, b) - capVal(s, a));
  let alpha = -999999, best = ms[0];
  for(const m of ms){
    const ns = makeMove(s, m);
    let v = -abSearch(ns, depth - 1, -999999, -alpha);
    if(jitter) v += (Math.random() * 2 - 1) * jitter;
    if(v > alpha){ alpha = v; best = m; }
  }
  return {m: best, v: alpha};
}

/* ================= اتصال به window ================= */
window.ChessCore = {
  FILES, GLYPH, N_OFF, K_OFF, B_DIRS, R_DIRS,
  isW, colorOf, sqName, parseSq,
  initialBoard, initialState,
  attacked, kingSq, inCheck,
  pseudoMoves, makeMove, legalMoves, keyOf, insufficient,
  sanOf,
  parseFEN, applyUci,
  renderBoardEl,
  VALC, PST,
  evalBoard, capVal, abSearch, chooseAiMove
};

/* اتصال متغیرهای سراسری برای سازگاری با کد قبلی */
window.FILES = FILES;
window.GLYPH = GLYPH;
window.N_OFF = N_OFF;
window.K_OFF = K_OFF;
window.B_DIRS = B_DIRS;
window.R_DIRS = R_DIRS;
window.isW = isW;
window.colorOf = colorOf;
window.sqName = sqName;
window.parseSq = parseSq;
window.initialBoard = initialBoard;
window.initialState = initialState;
window.attacked = attacked;
window.kingSq = kingSq;
window.inCheck = inCheck;
window.pseudoMoves = pseudoMoves;
window.makeMove = makeMove;
window.legalMoves = legalMoves;
window.keyOf = keyOf;
window.insufficient = insufficient;
window.sanOf = sanOf;
window.parseFEN = parseFEN;
window.applyUci = applyUci;
window.renderBoardEl = renderBoardEl;
window.VALC = VALC;
window.PST = PST;
window.evalBoard = evalBoard;
window.capVal = capVal;
window.abSearch = abSearch;
window.chooseAiMove = chooseAiMove;
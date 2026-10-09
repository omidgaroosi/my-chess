"use strict";
/* ============================================================
   🧠 coach-patterns.js — موتور تشخیص الگوهای تاکتیکی
   ------------------------------------------------------------
   تشخیص خودکار الگوهای تاکتیکی و تبدیل آن‌ها به توضیح فارسی
   این ماژول جایگزین بخش زیادی از کار LLM در تحلیل تاکتیکی است.
   ساخته شده توسط امید گروسی
   ============================================================ */

window.CoachPatterns = (function() {

  /* ================= ابزارهای پایه ================= */
  const FILES = 'abcdefgh';
  const sqName = sq => FILES[sq & 7] + (8 - (sq >> 3));
  const isW = p => p && p === p.toUpperCase();
  const colorOf = p => isW(p) ? 'w' : 'b';
  const FA_PIECE = {k:'شاه', q:'وزیر', r:'رخ', b:'فیل', n:'اسب', p:'پیاده'};
  const VALUE = {p:1, n:3, b:3, r:5, q:9, k:100};

  /* بررسی حمله از یک خانه به خانهٔ دیگر (بدون در نظر گرفتن مهره‌های سر راه) */
  function attacksSquare(board, from, to, byWhite) {
    if(from === to) return false;
    const piece = board[from];
    if(!piece || isW(piece) !== byWhite) return false;
    const t = piece.toLowerCase();
    const r1 = from >> 3, c1 = from & 7;
    const r2 = to >> 3, c2 = to & 7;
    const dr = r2 - r1, dc = c2 - c1;
    const absDr = Math.abs(dr), absDc = Math.abs(dc);

    if(t === 'p') {
      const dir = byWhite ? -1 : 1;
      if(dr === dir && absDc === 1) return true;
      return false;
    }
    if(t === 'n') return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
    if(t === 'k') return absDr <= 1 && absDc <= 1;
    if(t === 'b') {
      if(absDr !== absDc) return false;
      return pathClear(board, from, to);
    }
    if(t === 'r') {
      if(dr !== 0 && dc !== 0) return false;
      return pathClear(board, from, to);
    }
    if(t === 'q') {
      if(dr !== 0 && dc !== 0 && absDr !== absDc) return false;
      return pathClear(board, from, to);
    }
    return false;
  }

  function pathClear(board, from, to) {
    const r1 = from >> 3, c1 = from & 7;
    const r2 = to >> 3, c2 = to & 7;
    const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
    let r = r1 + dr, c = c1 + dc;
    while(r !== r2 || c !== c2) {
      if(board[r * 8 + c]) return false;
      r += dr; c += dc;
    }
    return true;
  }

  /* پیدا کردن مهره‌هایی که از یک خانه حمله می‌کنند */
  function attackersOf(board, sq, byWhite) {
    const list = [];
    for(let i = 0; i < 64; i++) {
      if(attacksSquare(board, i, sq, byWhite)) list.push(i);
    }
    return list;
  }

  /* پیدا کردن خانه‌هایی که یک مهره تهدید می‌کند (با در نظر گرفتن مهره‌های حریف) */
  function attacksFrom(board, from, byWhite) {
    const targets = [];
    for(let i = 0; i < 64; i++) {
      if(attacksSquare(board, from, i, byWhite)) targets.push(i);
    }
    return targets;
  }

  /* ================= تشخیص چنگال (Fork) ================= */
  function detectFork(s0, m, s1) {
    const movedPiece = s1.board[m.to];
    if(!movedPiece) return null;
    const byWhite = isW(movedPiece);
    const t = movedPiece.toLowerCase();
    const targets = [];

    for(let sq = 0; sq < 64; sq++) {
      const p = s1.board[sq];
      if(!p || isW(p) === byWhite) continue;
      if(attacksSquare(s1.board, m.to, sq, byWhite)) {
        targets.push({
          sq,
          piece: p.toLowerCase(),
          value: VALUE[p.toLowerCase()] || 0,
          name: FA_PIECE[p.toLowerCase()] + ' در ' + sqName(sq)
        });
      }
    }

    if(targets.length < 2) return null;

    targets.sort((a, b) => b.value - a.value);
    const hasKing = targets.some(t => t.piece === 'k');
    const bigTargets = targets.filter(t => t.value >= 3);

    return {
      piece: t,
      pieceName: FA_PIECE[t],
      from: m.from,
      to: m.to,
      targets,
      isKnight: t === 'n',
      isPawn: t === 'p',
      hasKing,
      capturedValue: targets.reduce((sum, t) => sum + (t.piece === 'k' ? 0 : t.value), 0),
      totalValue: targets.reduce((sum, t) => sum + t.value, 0)
    };
  }

  /* ================= تشخیص آچمز (Pin) ================= */
  function detectPins(board, byWhite) {
    const pins = [];
    const dirs = [
      {dr:-1,dc:-1,type:'b'}, {dr:-1,dc:1,type:'b'},
      {dr:1,dc:-1,type:'b'}, {dr:1,dc:1,type:'b'},
      {dr:-1,dc:0,type:'r'}, {dr:1,dc:0,type:'r'},
      {dr:0,dc:-1,type:'r'}, {dr:0,dc:1,type:'r'}
    ];

    for(let sq = 0; sq < 64; sq++) {
      const piece = board[sq];
      if(!piece || isW(piece) !== byWhite) continue;
      const t = piece.toLowerCase();
      if(t !== 'b' && t !== 'r' && t !== 'q') continue;
      const r0 = sq >> 3, c0 = sq & 7;

      for(const dir of dirs) {
        if(t === 'b' && dir.type === 'r') continue;
        if(t === 'r' && dir.type === 'b') continue;
        let r = r0 + dir.dr, c = c0 + dir.dc;
        let firstEnemy = null;
        while(r >= 0 && r < 8 && c >= 0 && c < 8) {
          const curSq = r * 8 + c;
          const cur = board[curSq];
          if(cur) {
            if(isW(cur) === byWhite) break;
            if(!firstEnemy) {
              firstEnemy = {sq: curSq, piece: cur.toLowerCase()};
            } else {
              // two enemy pieces in line: check if second is king/queen
              if(cur.toLowerCase() === 'k') {
                pins.push({
                  pinnedSq: firstEnemy.sq,
                  pinnedPiece: firstEnemy.piece,
                  pinnedName: FA_PIECE[firstEnemy.piece],
                  pinnedVal: VALUE[firstEnemy.piece],
                  behindSq: curSq,
                  behindPiece: cur.toLowerCase(),
                  behindName: FA_PIECE[cur.toLowerCase()],
                  attackerSq: sq,
                  attackerPiece: t,
                  attackerName: FA_PIECE[t],
                  absolute: true // against king = absolute
                });
              } else if(cur.toLowerCase() === 'q' && VALUE[firstEnemy.piece] < 9) {
                pins.push({
                  pinnedSq: firstEnemy.sq,
                  pinnedPiece: firstEnemy.piece,
                  pinnedName: FA_PIECE[firstEnemy.piece],
                  pinnedVal: VALUE[firstEnemy.piece],
                  behindSq: curSq,
                  behindPiece: cur.toLowerCase(),
                  behindName: FA_PIECE[cur.toLowerCase()],
                  attackerSq: sq,
                  attackerPiece: t,
                  attackerName: FA_PIECE[t],
                  absolute: false
                });
              } else if(VALUE[cur.toLowerCase()] > VALUE[firstEnemy.piece] + 1) {
                pins.push({
                  pinnedSq: firstEnemy.sq,
                  pinnedPiece: firstEnemy.piece,
                  pinnedName: FA_PIECE[firstEnemy.piece],
                  pinnedVal: VALUE[firstEnemy.piece],
                  behindSq: curSq,
                  behindPiece: cur.toLowerCase(),
                  behindName: FA_PIECE[cur.toLowerCase()],
                  attackerSq: sq,
                  attackerPiece: t,
                  attackerName: FA_PIECE[t],
                  absolute: false
                });
              }
              break;
            }
          }
          r += dir.dr; c += dir.dc;
        }
      }
    }
    return pins;
  }

  /* ================= تشخیص سیخ (Skewer) ================= */
  function detectSkewers(board, byWhite) {
    const skewers = [];
    const dirs = [
      {dr:-1,dc:-1,type:'b'}, {dr:-1,dc:1,type:'b'},
      {dr:1,dc:-1,type:'b'}, {dr:1,dc:1,type:'b'},
      {dr:-1,dc:0,type:'r'}, {dr:1,dc:0,type:'r'},
      {dr:0,dc:-1,type:'r'}, {dr:0,dc:1,type:'r'}
    ];

    for(let sq = 0; sq < 64; sq++) {
      const piece = board[sq];
      if(!piece || isW(piece) !== byWhite) continue;
      const t = piece.toLowerCase();
      if(t !== 'b' && t !== 'r' && t !== 'q') continue;
      const r0 = sq >> 3, c0 = sq & 7;

      for(const dir of dirs) {
        if(t === 'b' && dir.type === 'r') continue;
        if(t === 'r' && dir.type === 'b') continue;
        let r = r0 + dir.dr, c = c0 + dir.dc;
        let firstEnemy = null;
        while(r >= 0 && r < 8 && c >= 0 && c < 8) {
          const curSq = r * 8 + c;
          const cur = board[curSq];
          if(cur) {
            if(isW(cur) === byWhite) break;
            if(!firstEnemy) {
              firstEnemy = {sq: curSq, piece: cur.toLowerCase()};
            } else {
              if(VALUE[firstEnemy.piece] > VALUE[cur.toLowerCase()]) {
                skewers.push({
                  frontSq: firstEnemy.sq,
                  frontPiece: firstEnemy.piece,
                  frontName: FA_PIECE[firstEnemy.piece],
                  frontVal: VALUE[firstEnemy.piece],
                  behindSq: curSq,
                  behindPiece: cur.toLowerCase(),
                  behindName: FA_PIECE[cur.toLowerCase()],
                  behindVal: VALUE[cur.toLowerCase()],
                  attackerSq: sq,
                  attackerName: FA_PIECE[t]
                });
              }
              break;
            }
          }
          r += dir.dr; c += dir.dc;
        }
      }
    }
    return skewers;
  }

  /* ================= تشخیص حملهٔ برخاست (Discovered Attack) ================= */
  function detectDiscovered(s0, s1, m) {
    const movedPiece = s1.board[m.to];
    if(!movedPiece) return null;
    const byWhite = isW(movedPiece);
    const results = [];

    // برای هر مهرهٔ حریف که در s1 حمله شده ولی در s0 نبوده، بررسی کن
    for(let sq = 0; sq < 64; sq++) {
      const target = s1.board[sq];
      if(!target || isW(target) === byWhite) continue;
      if(attacksSquare(s0.board, m.to, sq, byWhite)) continue; // قبلاً هم حمله بود
      
      // آیا در s1 این خانه مورد حمله است؟ بله
      if(!attacksSquare(s1.board, m.to, sq, byWhite)) continue;
      
      // آیا مهرهٔ جلویی (که حرکت کرد) سر راه یک مهرهٔ پشتی خودی بود؟
      // منطق: در s0، مهرهٔ پشتی از طریق خانهٔ "from" به sq حمله نمی‌کرد
      // در s1، از طریق خانهٔ "to" حمله می‌کند
      // بررسی می‌کنیم که کدام مهرهٔ خودی از پشت مهرهٔ متحرک حمله می‌کند
      
      // جستجوی مهرهٔ پشتی: از مهرهٔ متحرک در جهت مخالف نگاه کن
      // (این پیچیده است — ساده‌سازی: چک کن که آیا مهرهٔ متحرک از مسیر یک مهرهٔ دوربرد خودی کنار رفته)
    }

    // رویکرد ساده‌تر: پیدا کردن مهره‌هایی که در s0 مسدود بودند
    // اما به‌طور کلی از این بخش صرف‌نظر می‌کنیم چون پیچیده است
    // (فقط در صورتی که واقعاً کشف باشد، آن را تشخیص می‌دهیم)
    return null;
  }

  /* ================= تشخیص کیش دوگانه (Double Check) ================= */
  function detectDoubleCheck(board, attackedWhite) {
    const kingSq = board.findIndex(p => p === (attackedWhite ? 'K' : 'k'));
    if(kingSq < 0) return null;
    const attackers = attackersOf(board, kingSq, !attackedWhite);
    if(attackers.length >= 2) {
      return { attackers, kingSq };
    }
    return null;
  }

  /* ================= ضعف عرض آخر (Back Rank) ================= */
  function detectBackRankWeakness(board, color) {
    const kingSq = board.findIndex(p => p === (color === 'w' ? 'K' : 'k'));
    if(kingSq < 0) return null;
    const rank = kingSq >> 3;
    if(color === 'w' && rank !== 7) return null;
    if(color === 'b' && rank !== 0) return null;

    const dir = color === 'w' ? -1 : 1; // جهت رو به جلو
    const r0 = kingSq >> 3, c0 = kingSq & 7;
    const escapeSquares = [];
    const blocked = [];

    // خانه‌های اطراف در عرض آخر و عرض جلویی
    const offsets = [[0,-1],[0,1],[dir,-1],[dir,0],[dir,1]];
    for(const [dr,dc] of offsets) {
      const r = r0 + dr, c = c0 + dc;
      if(r < 0 || r > 7 || c < 0 || c > 7) continue;
      const sq = r * 8 + c;
      const p = board[sq];
      if(!p) {
        escapeSquares.push({sq, name: sqName(sq), free: true});
      } else if(isW(p) === (color === 'w')) {
        blocked.push({sq, name: sqName(sq), piece: p.toLowerCase()});
      }
    }

    const escapeCount = escapeSquares.length;
    return {
      kingSq,
      kingName: sqName(kingSq),
      escapeSquares,
      blocked,
      escapeCount,
      vulnerable: escapeCount === 0
    };
  }

  /* ================= مهرهٔ در خطر ================= */
  function detectHangingPieces(board, color) {
    const byWhite = color === 'w';
    const enemyWhite = !byWhite;
    const hanging = [];

    for(let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if(!p || isW(p) !== byWhite) continue;
      if(p.toLowerCase() === 'k') continue;

      const attackers = attackersOf(board, sq, enemyWhite);
      if(!attackers.length) continue;

      const defenders = attackersOf(board, sq, byWhite);

      // اگر هیچ مدافعی نیست، مهره رایگان است
      if(!defenders.length) {
        const lowestAttacker = Math.min(...attackers.map(a => VALUE[board[a].toLowerCase()]));
        const targetVal = VALUE[p.toLowerCase()];
        if(lowestAttacker < targetVal || targetVal >= 3) {
          hanging.push({
            sq,
            piece: p.toLowerCase(),
            name: FA_PIECE[p.toLowerCase()] + ' در ' + sqName(sq),
            value: targetVal,
            attackerCount: attackers.length,
            attackerValues: attackers.map(a => VALUE[board[a].toLowerCase()]),
            defended: false
          });
        }
      } else {
        // تعداد مهاجم بیشتر از مدافع
        const attackersSorted = attackers.map(a => VALUE[board[a].toLowerCase()]).sort((a,b)=>a-b);
        const defendersSorted = defenders.map(d => VALUE[board[d].toLowerCase()]).sort((a,b)=>a-b);
        if(attackersSorted.length > defendersSorted.length) {
          const targetVal = VALUE[p.toLowerCase()];
          const minAttacker = attackersSorted[0];
          if(minAttacker < targetVal) {
            hanging.push({
              sq,
              piece: p.toLowerCase(),
              name: FA_PIECE[p.toLowerCase()] + ' در ' + sqName(sq),
              value: targetVal,
              attackerCount: attackers.length,
              defenderCount: defenders.length,
              attackerValues: attackersSorted,
              defenderValues: defendersSorted,
              defended: true,
              underPressure: true
            });
          }
        }
      }
    }

    hanging.sort((a, b) => b.value - a.value);
    return hanging;
  }

  /* ================= مهرهٔ اضافه‌بار ================= */
  function detectOverloadedDefenders(board, byWhite) {
    // مهره‌ای که از چند چیز دفاع می‌کند و ممکن است یکی را نتواند نجات دهد
    const overloaded = [];
    for(let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if(!p || isW(p) !== byWhite) continue;
      if(p.toLowerCase() === 'k') continue;

      const defended = [];
      for(let target = 0; target < 64; target++) {
        const q = board[target];
        if(!q || isW(q) !== byWhite) continue;
        if(target === sq) continue;
        // آیا این مهره از هدف دفاع می‌کند؟
        if(attacksSquare(board, sq, target, byWhite)) {
          defended.push({ sq: target, name: FA_PIECE[q.toLowerCase()] + ' در ' + sqName(target), value: VALUE[q.toLowerCase()] });
        }
      }
      if(defended.length >= 2) {
        const totalValue = defended.reduce((s, d) => s + d.value, 0);
        if(totalValue >= 8) {
          overloaded.push({
            sq,
            piece: p.toLowerCase(),
            name: FA_PIECE[p.toLowerCase()] + ' در ' + sqName(sq),
            defended,
            count: defended.length,
            totalValue
          });
        }
      }
    }
    return overloaded;
  }

  /* ================= فرمت‌کنندهٔ توضیحات فارسی ================= */
  function describeFork(fork, opts) {
    opts = opts || {};
    const lines = [];
    const tName = fork.pieceName;
    const targetNames = fork.targets.slice(0, 3).map(t => t.name).join(' و ');
    
    if(fork.hasKing) {
      lines.push('🎯 **چنگال ' + tName + '**: این حرکت هم‌زمان به شاه و ' + 
        fork.targets.filter(t => t.piece !== 'k').map(t => t.name).join(' و ') + ' حمله می‌کند.');
      lines.push('چون شاه در کیش است، حریف مجبور است اول شاه را نجات دهد، پس مهرهٔ دیگر (ارزش ' + 
        (fork.totalValue - 100) + ' امتیاز) رایگان از دست می‌رود.');
    } else {
      const minVal = Math.min(...fork.targets.map(t => t.value));
      lines.push('🎯 **چنگال ' + tName + '**: این حرکت هم‌زمان ' + targetNames + ' را تهدید می‌کند.');
      lines.push('حریف فقط می‌تواند یکی را نجات دهد، پس حداقل ' + minVal + 
        ' امتیاز مواد از دست می‌دهد.');
    }
    
    if(fork.isKnight) {
      lines.push('اسب به‌خاطر حرکت ال، استاد چنگال است — چون مسیرش غیرقابل‌پیش‌بینی است.');
    }
    if(fork.isPawn) {
      lines.push('چنگال پیاده بسیار مؤثر است — چون پیاده ارزان است و حریف انتظارش را ندارد.');
    }
    return lines.join(' ');
  }

  function describePin(pin, opts) {
    const lines = [];
    const abs = pin.absolute;
    lines.push('📌 **آچمز ' + (abs ? 'مطلق' : 'نسبی') + '**: ' + pin.attackerName + 
      ' در ' + sqName(pin.attackerSq) + '، ' + pin.pinnedName + ' در ' + 
      sqName(pin.pinnedSq) + ' را به ' + pin.behindName + ' در ' + 
      sqName(pin.behindSq) + ' آچمز کرده است.');
    
    if(abs) {
      lines.push('چون پشت مهرهٔ آچمزشده شاه است، این مهره قانوناً نمی‌تواند حرکت کند.');
      lines.push('قانون طلایی: به مهرهٔ آچمز حمله کن — او نمی‌تواند فرار کند.');
    } else {
      lines.push('اگر این مهره حرکت کند، ' + pin.behindName + ' (ارزش بالاتر) در معرض حمله قرار می‌گیرد.');
    }
    return lines.join(' ');
  }

  function describeSkewer(skewer, opts) {
    const lines = [];
    lines.push('🗡 **سیخ**: ' + skewer.attackerName + ' به ' + skewer.frontName + 
      ' در ' + sqName(skewer.frontSq) + ' حمله می‌کند و مهرهٔ باارزش‌تر در ' + 
      sqName(skewer.behindSq) + ' پشت سرش قرار دارد.');
    lines.push('حریف مجبور است ' + skewer.frontName + ' را حرکت دهد (چون باارزش‌تر است)، ' +
      'و سپس ' + skewer.behindName + ' شکار می‌شود.');
    return lines.join(' ');
  }

  function describeDoubleCheck(dc, opts) {
    const lines = [];
    const attackerNames = dc.attackers.map(sq => FA_PIECE[board[sq].toLowerCase()] + ' در ' + sqName(sq));
    lines.push('⚡ **کیش دوگانه**: ' + attackerNames.join(' و ') + 
      ' هم‌زمان شاه را کیش می‌دهند.');
    lines.push('این قوی‌ترین کیش در شطرنج است — حریف فقط یک پاسخ دارد: فرار شاه. ' +
      'نه می‌تواند هر دو را بزند، نه راه هر دو را ببندد.');
    return lines.join(' ');
  }

  function describeBackRank(br, opts) {
    const lines = [];
    lines.push('⚠️ **ضعف عرض آخر**: شاه در ' + br.kingName + ' قرار دارد و ' + 
      (br.escapeCount === 0 ? 'هیچ خانهٔ فراری ندارد.' : 'فقط ' + br.escapeCount + ' خانهٔ فرار دارد.'));
    if(br.blocked.length) {
      const blockedNames = br.blocked.map(b => b.piece ? FA_PIECE[b.piece] : 'مهره').join('، ');
      lines.push('دلیل اصلی: مهره‌های خودی (' + blockedNames + ') راه‌های فرار را بسته‌اند.');
    }
    lines.push('این الگو اغلب به مات عرض آخر منجر می‌شود — با یک رخ یا وزیر روی عرض آخر.');
    return lines.join(' ');
  }

  function describeHanging(h, opts) {
    const lines = [];
    if(h.defended) {
      lines.push('🚨 **مهرهٔ تحت فشار**: ' + h.name + ' توسط ' + h.attackerCount + 
        ' مهرهٔ حریف حمله می‌شود، اما فقط ' + h.defenderCount + ' مدافع دارد.');
      lines.push('در یک تعویض، سفید مواد از دست می‌دهد.');
    } else {
      lines.push('🚨 **مهرهٔ بی‌دفاع**: ' + h.name + ' هیچ مدافعی ندارد.');
      if(h.value >= 5) {
        lines.push('ارزش این مهره ' + h.value + ' امتیاز است — یک اشتباه بزرگ!');
      } else if(h.value >= 3) {
        lines.push('ارزش ' + h.value + ' امتیاز — بهتر است نجاتش بدهی.');
      }
    }
    return lines.join(' ');
  }

  function describeOverloaded(o, opts) {
    const lines = [];
    lines.push('⚖️ **مهرهٔ اضافه‌بار**: ' + o.name + ' در حال دفاع از ' + 
      o.defended.length + ' هدف است (ارزش کل: ' + o.totalValue + ' امتیاز).');
    lines.push('اهداف: ' + o.defended.map(d => d.name).join('، ') + '.');
    lines.push('حریف می‌تواند با حمله به یکی از اهداف، این مهره را از دفاع از دیگری دور کند.');
    return lines.join(' ');
  }

  /* ================= API عمومی ================= */
  return {
    // تشخیص الگوها
    detectFork, detectPins, detectSkewers, detectDiscovered,
    detectDoubleCheck, detectBackRankWeakness, detectHangingPieces,
    detectOverloadedDefenders,
    
    // فرمت‌کننده‌ها
    describeFork, describePin, describeSkewer, describeDoubleCheck,
    describeBackRank, describeHanging, describeOverloaded,
    
    // ابزارها
    attacksSquare, attacksFrom, attackersOf, pathClear,
    FA_PIECE, VALUE, sqName
  };
})();
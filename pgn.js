"use strict";
/* ============================================================
   📄 pgn.js — صادرات و ورود PGN
   ------------------------------------------------------------
   PGN (Portable Game Notation) فرمت استاندارد ذخیرهٔ بازی‌های
   شطرنج است. ساخته شده توسط امید گروسی
   ============================================================ */

window.ChessPGN = (() => {

  function formatDateISO() {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  }

  /* ساخت متن PGN از یک بازی */
  function buildGamePGN(opts) {
    const {
      white, black, date, result,
      movesSan, eventName, site, annotator
    } = opts;

    const headers = [
      ['Event', eventName || 'Casual Game'],
      ['Site', site || 'my-chess'],
      ['Date', date || formatDateISO()],
      ['Round', '-'],
      ['White', white || '?'],
      ['Black', black || '?'],
      ['Result', result || '*']
    ];
    if(annotator) headers.push(['Annotator', annotator]);

    const headerStr = headers.map(([k,v]) => `[${k} "${v}"]`).join('\n');

    const sanArr = Array.isArray(movesSan) ? movesSan : String(movesSan||'').split(/\s+/).filter(Boolean);
    let movesStr = '';
    for(let i = 0; i < sanArr.length; i++) {
      if(i % 2 === 0) movesStr += (Math.floor(i/2) + 1) + '. ';
      movesStr += sanArr[i] + ' ';
    }
    movesStr += result || '*';

    const lines = [];
    let current = '';
    for(const token of movesStr.split(' ')) {
      if((current + ' ' + token).trim().length > 78) {
        lines.push(current.trim());
        current = token;
      } else {
        current = current ? current + ' ' + token : token;
      }
    }
    if(current.trim()) lines.push(current.trim());

    return headerStr + '\n\n' + lines.join('\n') + '\n';
  }

  /* تجزیهٔ PGN */
  function parse(text) {
    const lines = String(text).split(/\r?\n/);
    const headers = {};
    let moveText = '';

    for(const line of lines) {
      const trimmed = line.trim();
      if(!trimmed) continue;
      if(trimmed.startsWith('[')) {
        const m = trimmed.match(/\[(\w+)\s+"([^"]*)"\]/);
        if(m) headers[m[1]] = m[2];
      } else {
        moveText += ' ' + trimmed;
      }
    }

    moveText = moveText
      .replace(/\{[^}]*\}/g, ' ')
      .replace(/;[^\n]*/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\$\d+/g, ' ')
      .replace(/\d+\.\.\./g, ' ')
      .replace(/\d+\./g, ' ')
      .replace(/[?!]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = moveText.split(' ')
      .filter(t => t && !['1-0','0-1','1/2-1/2','*'].includes(t));

    return { headers, moves: tokens };
  }

  /* دانلود فایل */
  function download(filename, content) {
    const blob = new Blob([content], { type:'application/x-chess-pgn;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  return { buildGamePGN, parse, download, formatDateISO };
})();
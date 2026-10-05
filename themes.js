"use strict";
/* ============================================================
   🎨 themes.js — تم‌های رنگی صفحهٔ شطرنج
   ------------------------------------------------------------
   ۶ تم آماده با رنگ‌های متفاوت برای خانه‌ها و مهره‌ها.
   ساخته شده توسط امید گروسی
   ============================================================ */

const THEMES = [
  {
    id: 'wood',
    name: '🪵 کلاسیک چوبی',
    light: '#efd9b4',
    dark:  '#b28356',
    coordLight: '#b28356',
    coordDark:  '#efd9b4',
    pieceW: '#fdfdfd',
    pieceB: '#141414',
    pieceWShadow: '0 2px 3px rgba(0,0,0,.6)',
    pieceBShadow: '0 1px 2px rgba(255,255,255,.22)'
  },
  {
    id: 'green',
    name: '🌿 سبز',
    light: '#eeeed2',
    dark:  '#769656',
    coordLight: '#769656',
    coordDark:  '#eeeed2',
    pieceW: '#ffffff',
    pieceB: '#1a1a1a',
    pieceWShadow: '0 2px 3px rgba(0,0,0,.5)',
    pieceBShadow: '0 1px 2px rgba(255,255,255,.2)'
  },
  {
    id: 'blue',
    name: '💧 آبی',
    light: '#dee3e6',
    dark:  '#7a96a8',
    coordLight: '#7a96a8',
    coordDark:  '#dee3e6',
    pieceW: '#ffffff',
    pieceB: '#16202a',
    pieceWShadow: '0 2px 3px rgba(0,0,0,.5)',
    pieceBShadow: '0 1px 2px rgba(255,255,255,.2)'
  },
  {
    id: 'marble',
    name: '🪨 مرمر',
    light: '#f2e8d5',
    dark:  '#a89080',
    coordLight: '#a89080',
    coordDark:  '#f2e8d5',
    pieceW: '#fefefe',
    pieceB: '#2c1810',
    pieceWShadow: '0 2px 4px rgba(0,0,0,.55)',
    pieceBShadow: '0 1px 2px rgba(255,255,255,.25)'
  },
  {
    id: 'gray',
    name: '⬛ خاکستری',
    light: '#dcdcdc',
    dark:  '#787878',
    coordLight: '#787878',
    coordDark:  '#dcdcdc',
    pieceW: '#ffffff',
    pieceB: '#111111',
    pieceWShadow: '0 2px 3px rgba(0,0,0,.5)',
    pieceBShadow: '0 1px 2px rgba(255,255,255,.2)'
  },
  {
    id: 'night',
    name: '🌙 شب',
    light: '#5a5a6a',
    dark:  '#2a2a3a',
    coordLight: '#2a2a3a',
    coordDark:  '#5a5a6a',
    pieceW: '#f0e6d2',
    pieceB: '#050510',
    pieceWShadow: '0 2px 4px rgba(0,0,0,.8)',
    pieceBShadow: '0 1px 2px rgba(255,255,255,.15)'
  }
];

function applyTheme(id){
  const t = THEMES.find(x => x.id === id) || THEMES[0];
  const r = document.documentElement.style;
  r.setProperty('--sq-light', t.light);
  r.setProperty('--sq-dark', t.dark);
  r.setProperty('--coord-light', t.coordLight);
  r.setProperty('--coord-dark', t.coordDark);
  r.setProperty('--piece-w', t.pieceW);
  r.setProperty('--piece-b', t.pieceB);
  r.setProperty('--piece-w-shadow', t.pieceWShadow);
  r.setProperty('--piece-b-shadow', t.pieceBShadow);
}

function getThemeName(id){
  const t = THEMES.find(x => x.id === id);
  return t ? t.name : 'نامشخص';
}
"use strict";
/* ============================================================
   🚀 chess-app.js — راه‌اندازی و مدیریت نهایی برنامه
   ------------------------------------------------------------
   - switchTab (تب‌گردانی)
   - init code (راه‌اندازی اولیه)
   - PWA (Service Worker + Install Prompt)
   ساخته شده توسط امید گروسی
   ============================================================ */

/* ============================================================
   🎯 switchTab — مدیریت تب‌ها
   ============================================================ */
function switchTab(name){
  ['game','learn','open','puzzle','books','games'].forEach(t => {
    const tabEl = document.getElementById('tab-' + t);
    const btnEl = document.getElementById('tbtn-' + t);
    if(tabEl) tabEl.classList.toggle('hidden', t !== name);
    if(btnEl) btnEl.classList.toggle('active', t === name);
  });

  if(name === 'learn' && !learnInited){
    learnInited = true;
    renderLearnList('');
    openLesson(0);
  }
  if(name === 'open' && !openInited){
    openInited = true;
    renderOpenList('');
    selectOpening(OPENINGS_DB[0].id);
  }
  if(name === 'puzzle'){
    if(!puzzleState) loadTodaysPuzzle();
    else { renderPuzzleBoard(); updatePuzzleStats(); }
  }
  if(name === 'books'){
    if(window.LiveLessons) LiveLessons.init();
  }
  if(name === 'games'){
    GamesViewer.reloadLibrary();
    GamesViewer.renderList(document.getElementById('searchGames')
      ? document.getElementById('searchGames').value : '');
  }
}

/* ============================================================
   🚀 راه‌اندازی اولیه برنامه
   ============================================================ */
function initApp(){
  GamesViewer.reloadLibrary();
  updateBoardSize();
  render();

  /* ✅ اول تنظیمات را بارگذاری کن (تا engineType درست باشد) */
  loadSavedOptions();
  if(document.getElementById('selTime')){
    document.getElementById('selTime').value = timeControl;
  }
  if(document.getElementById('selTheme')){
    document.getElementById('selTheme').value = theme;
  }
  applyTheme(theme);

  const selEngine = document.getElementById('selEngine');
  if(selEngine) selEngine.value = engineType;

  /* ✅ حالا موتور را با engineType درست لود کن */
  const wantSF = (window.crossOriginIsolated === true)
              && (typeof Worker !== 'undefined')
              && (!/[?&]ai\b/.test(location.search));

  if(wantSF){
    engine = 'stockfish';
    updateBadge();
    initStockfish();   /* ← این الان با engineType درست صدا زده می‌شود */
  } else {
    switchToAI();
    setStatus('در حال آماده‌سازی…');
  }

  refreshRatingBadge();
  Coach.init();
  Coach.updateStrengthInfo();
  switchTab('game');

  setTimeout(updateBoardSize, 100);
  setTimeout(checkAutoSave, 200);
}

/* ============================================================
   🎯 اتصال رویدادهای کلی
   ============================================================ */
function bindGlobalEvents(){
  /* ورودی PGN در تب بازی */
  const pgnInp = document.getElementById('pgnFileInput');
  if(pgnInp && !pgnInp._bound){
    pgnInp._bound = true;
    pgnInp.addEventListener('change', handlePGNFile);
  }
}

/* ============================================================
   🌐 PWA — Service Worker و Install Prompt
   ============================================================ */
function initPWA(){
  if('serviceWorker' in navigator && window.isSecureContext){
    if(navigator.serviceWorker.controller && !window.crossOriginIsolated
       && !sessionStorage.getItem('sw-reloaded')){
      sessionStorage.setItem('sw-reloaded', '1');
      setTimeout(() => location.reload(), 300);
    }

    navigator.serviceWorker.register('sw.js').then(reg => {
      if(window.crossOriginIsolated) return;
      if(sessionStorage.getItem('sw-reloaded')) return;

      const reloadOnce = () => {
        if(sessionStorage.getItem('sw-reloaded')) return;
        sessionStorage.setItem('sw-reloaded', '1');
        setTimeout(() => location.reload(), 400);
      };

      if(reg.active && !navigator.serviceWorker.controller) reloadOnce();
      else reg.addEventListener('updatefound', reloadOnce);
    }).catch(() => {});
  }

  /* BeforeInstallPrompt */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const b = document.getElementById('btnInstall');
    if(b) b.classList.remove('hidden');
  });

  window.installApp = function(){
    if(deferredPrompt){
      deferredPrompt.prompt();
      deferredPrompt = null;
      const b = document.getElementById('btnInstall');
      if(b) b.classList.add('hidden');
    } else if(/iphone|ipad|ipod/i.test(navigator.userAgent)){
      alert('در سافاری: دکمهٔ Share 🔼 را بزن و «Add to Home Screen» را انتخاب کن.');
    }
  };
}

/* ============================================================
   🌐 اتصال به window (برای دسترسی از HTML)
   ============================================================ */
window.switchTab = switchTab;
window.initApp = initApp;
window.bindGlobalEvents = bindGlobalEvents;
window.initPWA = initPWA;

/* ============================================================
   🚀 Auto-Init — بعد از بارگذاری DOM
   ============================================================ */
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    bindGlobalEvents();
    initApp();
    initPWA();
  });
} else {
  bindGlobalEvents();
  initApp();
  initPWA();
}
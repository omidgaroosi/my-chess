"use strict";
/* ============================================================
   🚀 chess-app.js — راه‌اندازی و مدیریت نهایی برنامه
   ------------------------------------------------------------
   - ناوبری صفحه‌ها (Screens)
   - Splash و ورود به اپ
   - Settings Modal
   - Init code
   - PWA
   ساخته شده توسط امید گروسی
   ============================================================ */

/* ============================================================
   🧭 ناوبری جدید (Screens)
   ============================================================ */
const SCREEN_TITLES = {
  home: 'شطرنج',
  game: 'بازی',
  learn: 'آکادمی',
  open: 'گشایش‌ها',
  puzzle: 'پازل',
  books: 'آموزش زنده',
  games: 'سینما'
};

let currentScreen = 'home';

function showScreen(name){
  if(!SCREEN_TITLES[name]) return;
  currentScreen = name;

  /* پنهان کردن همه */
  ['home','game','learn','open','puzzle','books','games'].forEach(t => {
    const el = document.getElementById('screen-' + t);
    if(el) el.classList.toggle('active', t === name);
  });

  /* عنوان بالا */
  const titleEl = document.getElementById('appTitle');
  if(titleEl) titleEl.textContent = SCREEN_TITLES[name];

  /* دکمهٔ برگشت */
  const backBtn = document.getElementById('btnBack');
  if(backBtn) backBtn.style.display = (name === 'home') ? 'none' : 'flex';

  /* نوار پایین موبایل */
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });

  /* 🆕 نوار کناری دسکتاپ */
  document.querySelectorAll('.side-btn').forEach(btn => {
    // فقط دکمه‌هایی که ویژگی data-screen دارند
    if(btn.dataset.screen) {
      btn.classList.toggle('active', btn.dataset.screen === name);
    }
  });


  /* اسکرول به بالا */
  const body = document.querySelector('.app-body');
  if(body) body.scrollTop = 0;

  /* راه‌اندازی اولیهٔ هر صفحه */
  if(name === 'learn' && typeof learnInited !== 'undefined' && !learnInited){
    learnInited = true;
    if(typeof renderLearnList === 'function') {
      renderLearnList('');
      openLesson(0);
    }
  }
  if(name === 'open' && typeof openInited !== 'undefined' && !openInited){
    openInited = true;
    if(typeof renderOpenList === 'function') {
      renderOpenList('');
      if(typeof OPENINGS_DB !== 'undefined' && OPENINGS_DB[0]) {
        selectOpening(OPENINGS_DB[0].id);
      }
    }
  }
  if(name === 'puzzle'){
    if(typeof puzzleState !== 'undefined' && !puzzleState) {
      if(typeof loadTodaysPuzzle === 'function') loadTodaysPuzzle();
    } else {
      if(typeof renderPuzzleBoard === 'function') {
        renderPuzzleBoard();
        if(typeof updatePuzzleStats === 'function') updatePuzzleStats();
      }
    }
  }
  if(name === 'books' && window.LiveLessons){
    if(typeof LiveLessons.init === 'function') LiveLessons.init();
  }
  if(name === 'games' && window.GamesViewer){
    GamesViewer.reloadLibrary();
    GamesViewer.renderList(document.getElementById('searchGames')
      ? document.getElementById('searchGames').value : '');
  }
}

/* حفظ سازگاری با کدهای قبلی که switchTab صدا می‌زنند */
function switchTab(name){
  showScreen(name);
}

/* ============================================================
   🌟 ورود به برنامه از Splash
   ============================================================ */
function enterApp(targetScreen){
  /* مخفی کردن splash */
  const splash = document.getElementById('splashScreen');
  if(splash){
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 500);
  }

  /* نمایش shell */
  const shell = document.getElementById('appShell');
  if(shell) shell.classList.remove('hidden');

  /* فعال‌سازی حالت app */
  document.body.classList.add('app-mode');

  /* رفتن به صفحهٔ هدف */
  setTimeout(() => {
    showScreen(targetScreen === 'game' ? 'game' : (targetScreen || 'home'));
  }, 100);
}

/* ============================================================
   🏠 بازگشت به خانه
   ============================================================ */
function backToHome(){
  showScreen('home');
}

/* ============================================================
   ⚙️ Settings Modal
   ============================================================ */
function openSettings(){
  const modal = document.getElementById('settingsModal');
  if(modal) modal.classList.remove('hidden');

  /* بارگذاری مقادیر فعلی */
  const selSide = document.getElementById('selSide');
  if(selSide && typeof humanColor !== 'undefined') selSide.value = humanColor;

  const selLevel = document.getElementById('selLevel');
  if(selLevel && typeof level !== 'undefined') selLevel.value = String(level);

  const selTime = document.getElementById('selTime');
  if(selTime && typeof timeControl !== 'undefined') selTime.value = timeControl;

  const selEngine = document.getElementById('selEngine');
  if(selEngine && typeof engineType !== 'undefined') selEngine.value = engineType;

  const selTheme = document.getElementById('selTheme');
  if(selTheme && typeof theme !== 'undefined') selTheme.value = theme;

  const chkSound = document.getElementById('chkSound');
  if(chkSound) {
    try {
      const o = ChessStorage.optsLoad();
      if(o.sound != null) chkSound.checked = !!o.sound;
    } catch(e) {}
  }

  /* به‌روزرسانی نشان رتبه در هدر */
  if(typeof updateHeaderRating === 'function') updateHeaderRating();
}

function closeSettings(){
  const modal = document.getElementById('settingsModal');
  if(modal) modal.classList.add('hidden');
}

/* ============================================================
   🏅 نشان رتبه در هدر
   ============================================================ */
function updateHeaderRating(){
  const badge = document.getElementById('headerRatingBadge');
  if(!badge) return;
  if(window.ChessRating){
    const d = ChessRating.load();
    badge.textContent = d.rating;
  }
}

/* ============================================================
   📊 به‌روزرسانی پیشرفت در خانه
   ============================================================ */
function updateHomeProgress(){
  const el = document.getElementById('homeLearnProgress');
  if(!el) return;

  try {
    const completed = JSON.parse(localStorage.getItem('learn-completed') || '[]');
    const total = (typeof LEARN_DB !== 'undefined') ? LEARN_DB.length : 0;
    const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    el.textContent = pct + '%';
  } catch(e) {}
}

/* ============================================================
   🚀 راه‌اندازی اولیه برنامه
   ============================================================ */
function initApp(){
  /* ۱) کتابخانهٔ بازی‌ها */
  if(window.GamesViewer) GamesViewer.reloadLibrary();

  /* ۲) اندازهٔ صفحه */
  if(typeof updateBoardSize === 'function') updateBoardSize();

  /* ۳) رندر اولیه */
  if(typeof render === 'function') render();

  /* ۴) بارگذاری تنظیمات */
  if(typeof loadSavedOptions === 'function') loadSavedOptions();
  if(typeof theme !== 'undefined') applyTheme(theme);

  /* ۵) بنر ادامه بازی */
  if(typeof ChessStorage !== 'undefined' && ChessStorage.hasAuto()){
    const banner = document.getElementById('homeContinueBanner');
    if(banner) banner.classList.remove('hidden');
  }

  /* ۶) پیشرفت آکادمی */
  updateHomeProgress();

  /* ۷) نشان رتبه در هدر */
  updateHeaderRating();

  /* ۸) بررسی Splash */
  const seenSplash = sessionStorage.getItem('splash-seen');
  if(seenSplash){
    const splash = document.getElementById('splashScreen');
    if(splash) splash.style.display = 'none';
    const shell = document.getElementById('appShell');
    if(shell) shell.classList.remove('hidden');
    document.body.classList.add('app-mode');
    showScreen('home');
  } else {
    sessionStorage.setItem('splash-seen', '1');
  }

  /* ۹) فعال‌سازی موتور و مربی */
  setTimeout(() => {
    const wantSF = (window.crossOriginIsolated === true)
                && (typeof Worker !== 'undefined')
                && (!/[?&]ai\b/.test(location.search));
    if(wantSF && typeof initStockfish === 'function'){
      if(typeof engine !== 'undefined') engine = 'stockfish';
      if(typeof updateBadge === 'function') updateBadge();
      initStockfish();
    } else if(typeof switchToAI === 'function') {
      switchToAI();
    }

    if(window.Coach){
      if(typeof Coach.init === 'function') Coach.init();
      if(typeof Coach.updateStrengthInfo === 'function') Coach.updateStrengthInfo();
    }
  }, 300);

  setTimeout(() => {
    if(typeof updateBoardSize === 'function') updateBoardSize();
  }, 500);
}

/* ============================================================
   🎯 اتصال رویدادهای کلی
   ============================================================ */
function bindGlobalEvents(){
  const pgnInp = document.getElementById('pgnFileInput');
  if(pgnInp && !pgnInp._bound){
    pgnInp._bound = true;
    if(typeof handlePGNFile === 'function') {
      pgnInp.addEventListener('change', handlePGNFile);
    }
  }
}

/* ============================================================
   🌐 PWA
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
window.showScreen = showScreen;
window.switchTab = switchTab;
window.enterApp = enterApp;
window.backToHome = backToHome;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.updateHeaderRating = updateHeaderRating;
window.updateHomeProgress = updateHomeProgress;
window.initApp = initApp;
window.bindGlobalEvents = bindGlobalEvents;
window.initPWA = initPWA;

/* ============================================================
   🚀 Auto-Init
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
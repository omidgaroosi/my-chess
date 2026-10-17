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

  /* آیکون منو */
  const menuBtn = document.getElementById('btnMenu');
  if(menuBtn) menuBtn.textContent = (name === 'home') ? '🏠' : '🏠';

  /* نوار پایین */
  document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });

  /* اسکرول به بالا */
  const body = document.querySelector('.app-body');
  if(body) body.scrollTop = 0;

  /* راه‌اندازی اولیهٔ هر صفحه */
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
  if(name === 'books' && window.LiveLessons){
    LiveLessons.init();
  }
  if(name === 'games'){
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
  if(selSide) selSide.value = humanColor;

  const selLevel = document.getElementById('selLevel');
  if(selLevel) selLevel.value = String(level);

  const selTime = document.getElementById('selTime');
  if(selTime) selTime.value = timeControl;

  const selEngine = document.getElementById('selEngine');
  if(selEngine) selEngine.value = engineType;

  const selTheme = document.getElementById('selTheme');
  if(selTheme) selTheme.value = theme;

  const chkSound = document.getElementById('chkSound');
  if(chkSound) chkSound.checked = document.getElementById('chkSound')?.checked ?? true;

  /* به‌روزرسانی نشان رتبه در هدر */
  updateHeaderRating();
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
   🔄 بازنویسی initApp
   ============================================================ */
function initApp(){
  GamesViewer.reloadLibrary();
  updateBoardSize();
  render();

  loadSavedOptions();
  applyTheme(theme);

  /* نشان دادن/مخفی کردن بنر ادامه بازی */
  if(typeof ChessStorage !== 'undefined' && ChessStorage.hasAuto()){
    const banner = document.getElementById('homeContinueBanner');
    if(banner) banner.classList.remove('hidden');
  }

  /* پیشرفت آکادمی */
  updateHomeProgress();

  /* نشان رتبه در هدر */
  updateHeaderRating();

  /* اگر splash دیده شده، مستقیم برو به shell */
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

  /* فعال‌سازی موتور فقط بعد از ورود */
  setTimeout(() => {
    const wantSF = (window.crossOriginIsolated === true)
                && (typeof Worker !== 'undefined')
                && (!/[?&]ai\b/.test(location.search));
    if(wantSF){
      engine = 'stockfish';
      updateBadge();
      initStockfish();
    } else {
      switchToAI();
    }

    Coach.init();
    Coach.updateStrengthInfo();
  }, 300);

  setTimeout(updateBoardSize, 500);
}

/* ============================================================
   📊 به‌روزرسانی پیشرفت در خانه
   ============================================================ */
function updateHomeProgress(){
  const el = document.getElementById('homeLearnProgress');
  if(!el) return;

  try {
    const completed = JSON.parse(localStorage.getItem('learn-completed') || '[]');
    const total = LEARN_DB.length;
    const pct = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    el.textContent = pct + '%';
  } catch(e) {}
}

/* اتصال به window */
window.showScreen = showScreen;
window.switchTab = switchTab;
window.enterApp = enterApp;
window.backToHome = backToHome;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.updateHeaderRating = updateHeaderRating;
window.updateHomeProgress = updateHomeProgress;

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
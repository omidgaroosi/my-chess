"use strict";
/* ============================================================
   🏅 rating.js — سیستم رتبهٔ ELO
   ------------------------------------------------------------
   - رتبهٔ شروع: ۱۲۰۰
   - رتبهٔ حریف بر اساس سطح سختی
   - K-factor هوشمند (بالا در ابتدا، پایین با تجربه)
   - ذخیره‌سازی در localStorage
   ساخته شده توسط امید گروسی
   ============================================================ */

window.ChessRating = (() => {
  const KEY = 'chess.rating.v1';
  const START_RATING = 1200;

  /* رتبهٔ فرضی حریف بر اساس سطح ۰ تا ۴ */
  const OPPONENT_RATING = [800, 1000, 1200, 1500, 1800];

  function load(){
    try{
      const d = JSON.parse(localStorage.getItem(KEY));
      if(d && typeof d.rating === 'number') return d;
    }catch(e){}
    return {
      rating: START_RATING,
      peak: START_RATING,
      games: 0,          /* تعداد بازی‌های رتبه‌دار */
      wins: 0,
      losses: 0,
      draws: 0,
      history: []        /* [{ts, before, after, delta, opp, result, level}] */
    };
  }

  function save(d){
    try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){}
  }

  /* فرمول احتمال برد بر اساس اختلاف رتبه */
  function expectedScore(myR, oppR){
    return 1 / (1 + Math.pow(10, (oppR - myR) / 400));
  }

  /* K-factor: بالاتر برای بازیکنان تازه‌کار */
  function kFactor(games){
    if(games < 10) return 40;
    if(games < 30) return 32;
    if(games < 100) return 24;
    return 16;
  }

  /* نتیجهٔ بازی: 'win' | 'loss' | 'draw' */
  function scoreOf(result){
    if(result === 'win')  return 1;
    if(result === 'draw') return 0.5;
    return 0;
  }

  /* محاسبهٔ تغییر رتبه و ذخیره */
  function recordGame(result, level){
    const d = load();
    const oppRating = OPPONENT_RATING[level] ?? 1200;
    const before = d.rating;
    const exp = expectedScore(before, oppRating);
    const k = kFactor(d.games);
    const actual = scoreOf(result);
    const delta = Math.round(k * (actual - exp));
    const after = Math.max(100, before + delta);

    d.rating = after;
    d.games++;
    if(result === 'win')  d.wins++;
    if(result === 'loss') d.losses++;
    if(result === 'draw') d.draws++;
    if(after > d.peak) d.peak = after;

    d.history.unshift({
      ts: Date.now(),
      before, after, delta,
      opp: oppRating,
      oppName: nameOfLevel(level),
      result, level
    });
    while(d.history.length > 100) d.history.pop();

    save(d);
    return { before, after, delta, oppRating };
  }

  function nameOfLevel(level){
    return ['خیلی آسان','آسان','متوسط','سخت','خیلی سخت'][level] || '؟';
  }

  function reset(){
    try{ localStorage.removeItem(KEY); }catch(e){}
  }

  /* عنوان رتبه بر اساس عدد */
  function titleOf(rating){
    if(rating >= 2000) return { label:'🏆 استاد', color:'#ffd54f' };
    if(rating >= 1800) return { label:'👑 پیشرفته', color:'#ffb74d' };
    if(rating >= 1500) return { label:'⚔️ ماهر', color:'#81c784' };
    if(rating >= 1300) return { label:'💪 متوسط', color:'#64b5f6' };
    if(rating >= 1100) return { label:'📚 مبتدی', color:'#9aa0ae' };
    return { label:'🌱 تازه‌کار', color:'#8a8f9c' };
  }

  return { load, save, recordGame, reset, titleOf, nameOfLevel, OPPONENT_RATING, START_RATING };
})();
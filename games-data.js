"use strict";
/* ============================================================
   🎬 games-data.js — پایگاه دادهٔ بازی‌های استادان
   ------------------------------------------------------------
   هر بازی: { id, title, white, black, event, date, result, pgn }
   pgn می‌تواند شامل هدرها و حرکات باشد یا فقط متن حرکات.
   ساخته شده توسط امید گروسی
   ============================================================ */

const GAMES_DB = [

/* ============================================================
   🏆 دستهٔ ۱: شاهکارهای کلاسیک
   ============================================================ */
{
  id: 'g001',
  category: 'classic',
  categoryFA: 'شاهکارهای کلاسیک',
  title: 'بازی اپرا — مورفی در برابر دو حریف',
  white: 'Paul Morphy',
  black: 'Duke Karl / Count Isouard',
  event: 'Paris Opera House',
  date: '1858',
  result: '1-0',
  description: 'مشهورترین بازی تاریخ شطرنج — مورفی همهٔ مهره‌هایش را برای یک مات هماهنگ کرد.',
  pgn: `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Morphy, Paul"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`
},
{
  id: 'g002',
  category: 'classic',
  categoryFA: 'شاهکارهای کلاسیک',
  title: 'بازی جاویدان — آندرسن',
  white: 'Adolf Anderssen',
  black: 'Lionel Kieseritzky',
  event: 'London',
  date: '1851',
  result: '1-0',
  description: 'آندرسن وزیر و دو رخ را فدا کرد و فقط با سه مهرهٔ سبک مات کرد.',
  pgn: `[Event "London Immortal"]
[Date "1851.??.??"]
[White "Anderssen, Adolf"]
[Black "Kieseritzky, Lionel"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5
8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8
15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6
21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`
},
{
  id: 'g003',
  category: 'classic',
  categoryFA: 'شاهکارهای کلاسیک',
  title: 'نبرد قرن — فیشر ۱۳ ساله',
  white: 'Donald Byrne',
  black: 'Robert James Fischer',
  event: 'New York Rosenwald',
  date: '1956',
  result: '0-1',
  description: 'فداکاری وزیر توسط فیشر ۱۳ ساله — ۱۷...Be6!! که همهٔ حضار را میخکوب کرد.',
  pgn: `[Event "New York Rosenwald"]
[Date "1956.10.17"]
[White "Byrne, Donald"]
[Black "Fischer, Robert James"]
[Result "0-1"]
[ECO "D97"]

1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6
8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4
14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+
20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1
26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4
32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+
38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1`
},
{
  id: 'g004',
  category: 'classic',
  categoryFA: 'شاهکارهای کلاسیک',
  title: 'بازی اورگرین — آندرسن در برابر دوفرِن',
  white: 'Adolf Anderssen',
  black: 'Jean Dufresne',
  event: 'Berlin',
  date: '1852',
  result: '1-0',
  description: 'به آن «همیشه‌سبز» می‌گویند چون هرگز پیر نمی‌شود — حمله‌ای که هرگز متوقف نشد.',
  pgn: `[Event "Berlin Evergreen"]
[Date "1852.??.??"]
[White "Anderssen, Adolf"]
[Black "Dufresne, Jean"]
[Result "1-0"]
[ECO "C52"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3
8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6
14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3
20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0`
},

/* ============================================================
   🏅 دستهٔ ۲: شاهکارهای معاصر
   ============================================================ */
{
  id: 'g005',
  category: 'modern',
  categoryFA: 'شاهکارهای معاصر',
  title: 'جاودانهٔ کاسپاروف — شکار شاه توپالوف',
  white: 'Garry Kasparov',
  black: 'Veselin Topalov',
  event: 'Wijk aan Zee',
  date: '1999',
  result: '1-0',
  description: 'کاسپاروف شاه توپالوف را از قلعه بیرون کشید و تا وسط صفحه شکارش کرد.',
  pgn: `[Event "Hoogovens A"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[White "Kasparov, Garry"]
[Black "Topalov, Veselin"]
[Result "1-0"]
[ECO "B07"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7
8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O
14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5
20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4
25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7
30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2
35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3
40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`
},

/* ============================================================
   🎓 دستهٔ ۳: درس‌های کلاسیک
   ============================================================ */
{
  id: 'g006',
  category: 'lesson',
  categoryFA: 'درس‌های کلاسیک',
  title: 'کارپف در برابر ساکس — درس حمله در وسط بازی',
  white: 'Anatoly Karpov',
  black: 'Gyula Sax',
  event: 'Linares',
  date: '1983.02.14',
  result: '1-0',
  description: 'یک درس کامل در بهره‌گیری از ستون باز و حملهٔ هماهنگ مهره‌ها.',
  pgn: `[Event "Linares"]
[Site "Linares ESP"]
[Date "1983.02.14"]
[White "Karpov, Anatoly"]
[Black "Sax, Gyula"]
[Result "1-0"]
[ECO "B81"]

1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 d6 6. g4 h6 7. Rg1 Be7
8. Be3 Nc6 9. Qe2 Bd7 10. h4 Nxd4 11. Bxd4 e5 12. Be3 Bc6 13. Qd3 Qa5
14. O-O-O Nxe4 15. Nxe4 d5 16. Qb3 dxe4 17. Bc4 Rf8 18. Rd5 Bxd5 19. Bxd5 Rd8
20. Bc4 Bb4 21. c3 b5 22. Be2 Bd6 23. Qd5 Ke7 24. Bc5 Bxc5 25. Qxe5+ Kd7
26. Qxc5 Qc7 27. Qf5+ Ke7 28. Qxe4+ Kd7 29. Qf5+ Ke7 30. Re1 Rd6 31. Bc4+ Kd8
32. Bxb5 a6 33. Ba4 g6 34. Qf3 Kc8 35. Re7 Rd1+ 36. Kxd1 Qxe7 37. Qa8+ Kc7
38. Qa7+ Kd6 39. Qb6+ Ke5 40. Qd4+ Ke6 41. Bb3# 1-0`
}

]; /* پایان GAMES_DB */

/* ============================================================
   دسته‌بندی‌ها برای نمایش در سایدبار
   ============================================================ */
const GAMES_CATEGORIES = [
  { id:'classic', name:'🏆 شاهکارهای کلاسیک', desc:'مورفی، آندرسن، فیشر' },
  { id:'modern',  name:'🏅 شاهکارهای معاصر', desc:'کاسپاروف، کارلسن، دینگ' },
  { id:'lesson',  name:'🎓 درس‌های کلاسیک',  desc:'آموزشی و پوزیسیونی' }
];

const GAMES_META = {
  author: 'امید گروسی',
  version: '1.0',
  total: GAMES_DB.length
};
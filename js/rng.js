(function (global) {
  // 可設種子的亂數（mulberry32）。全部模擬都走這裡，同一種子＋同一操作紀錄就能重現同一局。
  let state = 1;

  function seed(s) {
    state = (Number(s) >>> 0) || 1;
  }

  function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function freshSeed() {
    return Math.floor(Math.random() * 4294967295) + 1;
  }

  global.LifeRNG = { seed: seed, random: random, freshSeed: freshSeed };
})(typeof window !== "undefined" ? window : globalThis);

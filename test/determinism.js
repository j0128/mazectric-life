// 用法：node test/determinism.js
// 檢查：同種子同操作 → 同一局；重播存檔 → 與原局完全一致。
globalThis.window = globalThis;
const fs = require("fs");
const path = require("path");
for (const f of ["rng", "patterns", "world", "gallery", "civ", "engine"]) {
  const src = fs.readFileSync(path.join(__dirname, "..", "js", f + ".js"), "utf8");
  (0, eval)(src);
}
const E = LifeEngine;
let fail = 0;
function check(name, ok, extra) {
  console.log((ok ? "ok   " : "FAIL ") + name + (extra ? "  " + extra : ""));
  if (!ok) fail++;
}
function digest(g) {
  let h = 2166136261 >>> 0;
  const mix = (arr) => { for (let i = 0; i < arr.length; i++) h = Math.imul(h ^ arr[i], 16777619) >>> 0; };
  mix(g.life); mix(g.owner); mix(g.terrain);
  mix([g.generation, g.energy | 0, Math.round(g.food), g.season]);
  return h.toString(16) + "/" + E.population(g);
}
function play(seed, steps) {
  const g = E.createGame(200, 120, seed);
  E.scatter(g, 30);
  const blocks = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (let i = 0; i < steps; i++) {
    if (i === 3) E.stamp(g, blocks, 100, 60);
    if (i === 10) E.plant(g, 50, 50);
    if (i === 20) E.erase(g, 100, 60);
    if (i % 150 === 0) E.scatter(g, 20);
    E.step(g);
  }
  return g;
}
const N = Number(process.env.STEPS || 400);
const a = play(12345, N);
const b = play(12345, N);
const c = play(999, N);
check("same seed → same result", digest(a) === digest(b), digest(a));
check("different seed → different result", digest(a) !== digest(c));
const save = JSON.parse(JSON.stringify({ seed: a.seed, cols: a.cols, rows: a.rows, log: a.log, ticks: a.ticks }));
const r = E.replay(save);
check("replay of save matches original", digest(r) === digest(a), digest(r));
check("population is alive after run", E.population(a) > 0);
process.exit(fail ? 1 : 0);

(function (global) {
  const W = global.LifeWorld;
  const STORAGE_KEY = "survival-life-gallery-mazectric";

  function loadFound() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(arr);
    } catch (err) {
      return new Set();
    }
  }

  function saveFound(found) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(found)));
    } catch (err) {
      /* ignore quota / private mode */
    }
  }

  function cellsOf(variant) {
    const set = {};
    variant.forEach((p) => {
      set[p[0] + "," + p[1]] = true;
    });
    return set;
  }

  function matchAt(game, ox, oy, variant, occupied) {
    const cols = game.cols;
    const rows = game.rows;
    const life = game.life;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < variant.length; i++) {
      const vx = variant[i][0];
      const vy = variant[i][1];
      if (vx > maxX) maxX = vx;
      if (vy > maxY) maxY = vy;
      const x = W.wrap(ox + vx, cols);
      const y = oy + vy;
      if (y < 0 || y >= rows) return false;
      if (!life[W.idx(x, y, cols)]) return false;
    }
    for (let dy = -1; dy <= maxY + 1; dy++) {
      for (let dx = -1; dx <= maxX + 1; dx++) {
        if (occupied[dx + "," + dy]) continue;
        const x = W.wrap(ox + dx, cols);
        const y = oy + dy;
        if (y < 0 || y >= rows) continue;
        if (life[W.idx(x, y, cols)]) return false;
      }
    }
    return true;
  }

  function collectMatches(game, pattern) {
    const matches = [];
    if (!pattern) return matches;
    for (let v = 0; v < pattern.variants.length; v++) {
      const variant = pattern.variants[v];
      const occupied = cellsOf(variant);
      for (let y = 0; y < game.rows; y++) {
        for (let x = 0; x < game.cols; x++) {
          if (!matchAt(game, x, y, variant, occupied)) continue;
          const cells = variant.map(function (p) {
            return {
              x: W.wrap(x + p[0], game.cols),
              y: y + p[1],
            };
          });
          matches.push({ ox: x, oy: y, cells: cells });
        }
      }
    }
    return matches;
  }

  function scan(game, patterns, found) {
    const newly = [];
    for (let p = 0; p < patterns.length; p++) {
      const pattern = patterns[p];
      if (found.has(pattern.id) || pattern.discover === false) continue;
      if (collectMatches(game, pattern).length) newly.push(pattern);
    }
    return newly;
  }

  global.LifeGallery = {
    loadFound: loadFound,
    saveFound: saveFound,
    scan: scan,
    collectMatches: collectMatches,
  };
})(window);

(function (global) {
  const TERRAIN = {
    SOIL: 0,
    FERTILE: 1,
    ROCK: 2,
    WATER: 3,
    RIVER: 4,
    ICE: 5,
    SAND: 6,
    MARSH: 7,
    GROVE: 8,
    HIGHLAND: 9,
    SNOW: 10,
  };

  const RESOURCE = {
    NONE: 0,
    NUTRIENT: 1,
    CRYSTAL: 2,
  };

  const CURRENT = {
    NONE: 0,
    COLD: 1,
    WARM: 2,
  };

  const TERRAIN_LIFE = {
    0: { surviveMin: 1, surviveMax: 4, droughtMax: 3, rockDroughtMax: 4, food: 1 },
    1: { surviveMin: 1, surviveMax: 5, droughtMax: 4, food: 0.65 },
    2: { dead: true, food: 0 },
    3: { surviveMin: 1, surviveMax: 4, droughtMax: 3, food: 1 },
    4: { surviveMin: 1, surviveMax: 4, droughtMax: 3, food: 1 },
    5: { surviveMin: 1, surviveMax: 4, droughtMax: 4, food: 0.85 },
    6: { surviveMin: 1, surviveMax: 3, droughtMax: 2, food: 1.15 },
    7: { surviveMin: 1, surviveMax: 5, droughtMax: 2, food: 0.8 },
    8: { surviveMin: 1, surviveMax: 4, droughtMax: 4, food: 0.72 },
    9: { surviveMin: 1, surviveMax: 4, droughtMax: 4, rockDroughtMax: 4, food: 0.9 },
    10: { dead: true, food: 0 },
  };

  const SEASON_LENGTH = 32;
  const SEASONS = [
    { id: "warm", name: "溫暖", maxRes: 138, spawnMin: 4, spawnMax: 12, every: 6 },
    { id: "rain", name: "雨季", maxRes: 196, spawnMin: 7, spawnMax: 18, every: 3 },
    { id: "flood", name: "洪水", maxRes: 128, spawnMin: 3, spawnMax: 10, every: 6 },
    { id: "winter", name: "冬季", maxRes: 64, spawnMin: 1, spawnMax: 5, every: 8 },
    { id: "drought", name: "乾旱", maxRes: 32, spawnMin: 0, spawnMax: 3, every: 12 },
  ];

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function idx(x, y, cols) {
    return y * cols + x;
  }

  function wrap(v, max) {
    return (v % max + max) % max;
  }

  function inY(y, rows) {
    return y >= 0 && y < rows;
  }

  function nbr(x, y, dx, dy, cols, rows) {
    const ny = y + dy;
    if (!inY(ny, rows)) return null;
    return { x: wrap(x + dx, cols), y: ny };
  }

  function hash2(x, y, s) {
    let n = x * 374761393 + y * 668265263 + s * 1274126177;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothNoise(x, y, s) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, s);
    const b = hash2(ix + 1, iy, s);
    const c = hash2(ix, iy + 1, s);
    const d = hash2(ix + 1, iy + 1, s);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }

  function fbm(x, y, s) {
    return (
      smoothNoise(x / 28, y / 22, s) * 0.52 +
      smoothNoise(x / 11, y / 9, s + 3) * 0.3 +
      smoothNoise(x / 4.5, y / 4, s + 7) * 0.18
    );
  }

  function isRockAdjacent(terrain, x, y, cols, rows) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const p = nbr(x, y, dx, dy, cols, rows);
        if (!p) continue;
        const t = terrain[idx(p.x, p.y, cols)];
        if (t === TERRAIN.ROCK || t === TERRAIN.SNOW) return true;
      }
    }
    return false;
  }

  function surviveMax(terrain, x, y, cols, rows, drought, sheltered) {
    const i = idx(x, y, cols);
    const t = terrain[i];
    const spec = TERRAIN_LIFE[t] || TERRAIN_LIFE[TERRAIN.SOIL];
    if (!drought || sheltered) return spec.surviveMax;
    if (t === TERRAIN.SOIL || t === TERRAIN.HIGHLAND) {
      if (spec.rockDroughtMax != null && isRockAdjacent(terrain, x, y, cols, rows)) {
        return spec.rockDroughtMax;
      }
    }
    return spec.droughtMax;
  }

  function blobFill(terrain, cols, rows, type, steps) {
    let x = randInt(cols);
    let y = randInt(rows);
    for (let i = 0; i < steps; i++) {
      terrain[idx(x, y, cols)] = type;
      if (Math.random() < 0.35) {
        const nx = wrap(x + 1, cols);
        terrain[idx(nx, y, cols)] = type;
      }
      if (Math.random() < 0.35) {
        const ny = wrap(y + 1, rows);
        terrain[idx(x, ny, cols)] = type;
      }
      x = wrap(x + randInt(3) - 1, cols);
      y = wrap(y + randInt(3) - 1, rows);
    }
  }

  function canHoldResource(terrain, life, i) {
    const t = terrain[i];
    if (t === TERRAIN.ROCK || t === TERRAIN.WATER || t === TERRAIN.RIVER || t === TERRAIN.SNOW) return false;
    if (life && life[i]) return false;
    return true;
  }

  function placeResource(terrain, resources, life, cols, rows, kind, preferFertile, resAmt) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const x = randInt(cols);
      const y = randInt(rows);
      const i = idx(x, y, cols);
      if (resources[i]) continue;
      if (!canHoldResource(terrain, life, i)) continue;
      if (preferFertile && terrain[i] !== TERRAIN.FERTILE && terrain[i] !== TERRAIN.MARSH && terrain[i] !== TERRAIN.GROVE && Math.random() < 0.65) continue;
      resources[i] = kind;
      if (resAmt) resAmt[i] = 1;
      return true;
    }
    return false;
  }

  function countResources(resources) {
    let n = 0;
    for (let i = 0; i < resources.length; i++) if (resources[i]) n++;
    return n;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function paintRiver(terrain, cols, rows) {
    const vertical = Math.random() < 0.55;
    let x = vertical ? 10 + randInt(Math.max(1, cols - 20)) : 0;
    let y = vertical ? 0 : 6 + randInt(Math.max(1, rows - 12));
    const targetX = vertical ? clamp(x + randInt(21) - 10, 0, cols - 1) : cols - 1;
    const targetY = vertical ? rows - 1 : clamp(y + randInt(17) - 8, 0, rows - 1);
    const steps = cols + rows + 40 + randInt(50);
    for (let s = 0; s < steps; s++) {
      const i = idx(x, y, cols);
      if (terrain[i] !== TERRAIN.ROCK && terrain[i] !== TERRAIN.WATER) {
        terrain[i] = TERRAIN.RIVER;
      } else if (terrain[i] === TERRAIN.WATER) {
        terrain[i] = TERRAIN.WATER;
      }
      if (Math.random() < 0.5) {
        const wx = clamp(x + (vertical ? 1 : 0), 0, cols - 1);
        const wy = clamp(y + (vertical ? 0 : 1), 0, rows - 1);
        const ni = idx(wx, wy, cols);
        if (terrain[ni] !== TERRAIN.ROCK && terrain[ni] !== TERRAIN.WATER) {
          terrain[ni] = TERRAIN.RIVER;
        }
      }
      if (x < targetX) x++;
      else if (x > targetX) x--;
      else x = clamp(x + randInt(3) - 1, 0, cols - 1);
      if (y < targetY) y++;
      else if (y > targetY) y--;
      else y = clamp(y + randInt(3) - 1, 0, rows - 1);
      x = clamp(x, 0, cols - 1);
      y = clamp(y, 0, rows - 1);
    }
  }

  function pickMonsoon() {
    const bag = [
      { dx: 1, dy: 0, label: "向東", back: "向西" },
      { dx: -1, dy: 0, label: "向西", back: "向東" },
      { dx: 0, dy: 1, label: "向南", back: "向北" },
      { dx: 0, dy: -1, label: "向北", back: "向南" },
    ];
    if (Math.random() < 0.7) return bag[Math.random() < 0.5 ? 0 : 1];
    return bag[2 + randInt(2)];
  }

  function yearKindLabel(game) {
    if (game.yearKind === "wet") return "多雨年";
    if (game.yearKind === "dry") return "旱年";
    return "";
  }

  function monsoonFromDir(dx, dy) {
    if (dx > 0) return { dx: 1, dy: 0, label: "向東", back: "向西" };
    if (dx < 0) return { dx: -1, dy: 0, label: "向西", back: "向東" };
    if (dy > 0) return { dx: 0, dy: 1, label: "向南", back: "向北" };
    return { dx: 0, dy: -1, label: "向北", back: "向南" };
  }

  function cloneMonsoon(m) {
    if (!m) return null;
    return { dx: m.dx, dy: m.dy, label: m.label, back: m.back };
  }

  function turnMonsoon90(m) {
    if (!m) return null;
    if (Math.random() < 0.5) return monsoonFromDir(-m.dy, m.dx);
    return monsoonFromDir(m.dy, -m.dx);
  }

  function monsoonLabel(game) {
    const parts = [];
    const year = yearKindLabel(game);
    if (year) parts.push(year);
    if (game.pestTint) parts.push("蟲疾");
    if (game.stormTint) parts.push("颱風");
    if (game.glacialLeft) parts.push("中冰期");
    if (game.climateKind === "hot") parts.push("酷熱");
    if (game.climateKind === "cold") parts.push("嚴寒");
    if (game.epochOmen === "volcano") parts.push("地裂兆");
    if (game.epochOmen === "climate") parts.push("年候兆");
    if (game.epochOmen === "drift") parts.push("山移兆");
    if (game.epochOmen === "shore") parts.push("岸遷兆");
    if (game.coastRecedeLeft) parts.push("岸退");
    if (game.swampAgeLeft) parts.push("湖沼");
    const m = game.monsoon;
    const sid = (SEASONS[game.season] || {}).id;
    if (!game.glacialLeft && sid === "winter" && game.iceAge) parts.push("小冰期");
    else if (game.monsoonShifted && sid === "rain") parts.push("季風轉向");
    else if (m) {
      if (sid === "winter") parts.push("季風" + (m.back || m.label));
      else if (sid === "rain") parts.push("季風" + m.label);
      else if (sid === "drought") parts.push("雨影");
    }
    return parts.join(" · ");
  }

  function lowestNeighbor(height, x, y, cols, rows) {
    let best = null;
    let bestH = height[idx(x, y, cols)] + 1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const p = nbr(x, y, dx, dy, cols, rows);
        if (!p) continue;
        const h = height[idx(p.x, p.y, cols)];
        const cost = h + (dx && dy ? 0.3 : 0);
        if (cost < bestH) {
          bestH = cost;
          best = p;
        }
      }
    }
    return best;
  }

  const FLOW_DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  function canCarveRiverOn(t) {
    return (
      t === TERRAIN.SOIL ||
      t === TERRAIN.FERTILE ||
      t === TERRAIN.SAND ||
      t === TERRAIN.MARSH ||
      t === TERRAIN.GROVE ||
      t === TERRAIN.HIGHLAND
    );
  }

  function touchesWater(terrain, cols, rows, i) {
    const x = i % cols;
    const y = (i - x) / cols;
    for (let d = 0; d < 4; d++) {
      const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
      if (!p) continue;
      if (terrain[idx(p.x, p.y, cols)] === TERRAIN.WATER) return true;
    }
    return false;
  }

  function riverHasOutlet(terrain, height, cols, rows, start) {
    const seen = {};
    let cur = start;
    for (let step = 0; step < 240; step++) {
      if (seen[cur]) return false;
      seen[cur] = 1;
      if (terrain[cur] === TERRAIN.WATER) return true;
      if (touchesWater(terrain, cols, rows, cur)) return true;
      if (terrain[cur] !== TERRAIN.RIVER) return false;
      const x = cur % cols;
      const y = (cur - x) / cols;
      let best = -1;
      let bestH = 9999;
      for (let d = 0; d < 8; d++) {
        const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        if (seen[ni]) continue;
        if (terrain[ni] === TERRAIN.WATER) return true;
        if (terrain[ni] !== TERRAIN.RIVER) continue;
        const h = (height && height[ni]) || 128;
        if (h < bestH) {
          bestH = h;
          best = ni;
        }
      }
      if (best < 0) return false;
      cur = best;
    }
    return false;
  }

  function extendRiverToOutlet(terrain, height, cols, rows, start, maxSteps) {
    let cur = start;
    const seen = {};
    const limit = maxSteps == null ? 12 : maxSteps;
    for (let step = 0; step < limit; step++) {
      if (seen[cur]) break;
      seen[cur] = 1;
      if (terrain[cur] === TERRAIN.WATER || touchesWater(terrain, cols, rows, cur)) return true;
      const x = cur % cols;
      const y = (cur - x) / cols;
      let best = -1;
      let bestH = 9999;
      for (let d = 0; d < 8; d++) {
        const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        const t = terrain[ni];
        if (t === TERRAIN.WATER) return true;
        if (t === TERRAIN.SNOW || t === TERRAIN.ROCK) continue;
        if (t !== TERRAIN.RIVER && !canCarveRiverOn(t)) continue;
        const h = ((height && height[ni]) || 128) + (FLOW_DIRS[d][0] && FLOW_DIRS[d][1] ? 0.3 : 0);
        if (h < bestH) {
          bestH = h;
          best = ni;
        }
      }
      if (best < 0) break;
      if (terrain[best] !== TERRAIN.RIVER) terrain[best] = TERRAIN.RIVER;
      cur = best;
    }
    return terrain[cur] === TERRAIN.WATER || touchesWater(terrain, cols, rows, cur);
  }

  function riverOrthoCount(terrain, cols, rows, i) {
    const x = i % cols;
    const y = (i - x) / cols;
    let n = 0;
    for (let d = 0; d < 4; d++) {
      const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
      if (!p) continue;
      if (terrain[idx(p.x, p.y, cols)] === TERRAIN.RIVER) n++;
    }
    return n;
  }

  function thinRiverMesh(terrain, cols, rows) {
    for (let pass = 0; pass < 2; pass++) {
      const kill = [];
      for (let i = 0; i < terrain.length; i++) {
        if (terrain[i] !== TERRAIN.RIVER) continue;
        if (touchesWater(terrain, cols, rows, i)) continue;
        if (riverOrthoCount(terrain, cols, rows, i) >= 4) kill.push(i);
      }
      if (!kill.length) break;
      for (let k = 0; k < kill.length; k++) terrain[kill[k]] = TERRAIN.SOIL;
    }
  }

  function drainRiversShort(terrain, height, cols, rows) {
    const n = terrain.length;
    const seen = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (terrain[s] !== TERRAIN.RIVER || seen[s]) continue;
      const stack = [s];
      seen[s] = 1;
      let mouth = false;
      let lowest = s;
      let lowH = (height && height[s]) || 128;
      while (stack.length) {
        const cur = stack.pop();
        if (touchesWater(terrain, cols, rows, cur)) mouth = true;
        const h = (height && height[cur]) || 128;
        if (h < lowH) {
          lowH = h;
          lowest = cur;
        }
        const x = cur % cols;
        const y = (cur - x) / cols;
        for (let d = 0; d < 8; d++) {
          const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          if (seen[ni] || terrain[ni] !== TERRAIN.RIVER) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (mouth) continue;
      extendRiverToOutlet(terrain, height, cols, rows, lowest, 12);
    }
  }

  function repairRivers(terrain, height, cols, rows) {
    const n = terrain.length;
    const seen = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (terrain[s] !== TERRAIN.RIVER || seen[s]) continue;
      const cells = [];
      const stack = [s];
      seen[s] = 1;
      let mouth = false;
      let lowest = s;
      let lowH = (height && height[s]) || 128;
      while (stack.length) {
        const cur = stack.pop();
        cells.push(cur);
        if (touchesWater(terrain, cols, rows, cur)) mouth = true;
        const h = (height && height[cur]) || 128;
        if (h < lowH) {
          lowH = h;
          lowest = cur;
        }
        const x = cur % cols;
        const y = (cur - x) / cols;
        for (let d = 0; d < 8; d++) {
          const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          if (seen[ni] || terrain[ni] !== TERRAIN.RIVER) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (mouth) continue;
      if (cells.length < 8) {
        for (let k = 0; k < cells.length; k++) terrain[cells[k]] = TERRAIN.SOIL;
        continue;
      }
      if (terrain[lowest] !== TERRAIN.SNOW) terrain[lowest] = TERRAIN.WATER;
    }
  }

  function raiseShallows(terrain, height, sea, cols, rows) {
    let land = 0;
    const water = [];
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === TERRAIN.WATER && height[i] < sea) water.push(i);
      else if (terrain[i] !== TERRAIN.WATER) land++;
    }
    water.sort(function (a, b) {
      return height[b] - height[a];
    });
    const want = Math.round(land * 0.15);
    for (let k = 0; k < want && k < water.length; k++) {
      terrain[water[k]] = TERRAIN.SOIL;
    }
  }

  function isOrographic(t) {
    return t === TERRAIN.ROCK || t === TERRAIN.SNOW || t === TERRAIN.HIGHLAND;
  }

  function rainShadowDist(terrain, height, monsoon, x, y, cols, rows) {
    if (!monsoon || !height) return 0;
    const self = height[idx(x, y, cols)] || 0;
    for (let s = 1; s <= 30; s++) {
      const p = nbr(x, y, -monsoon.dx * s, -monsoon.dy * s, cols, rows);
      if (!p) break;
      const ni = idx(p.x, p.y, cols);
      const t = terrain[ni];
      if (t === TERRAIN.WATER) break;
      if (isOrographic(t) && (height[ni] || 0) - self > 18) return s;
    }
    return 0;
  }

  function countSandNbrs(terrain, x, y, cols, rows) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const p = nbr(x, y, dx, dy, cols, rows);
        if (!p) continue;
        if (terrain[idx(p.x, p.y, cols)] === TERRAIN.SAND) n++;
      }
    }
    return n;
  }

  function coastCurrentKind(current, terrain, x, y, cols, rows) {
    if (!current) return CURRENT.NONE;
    let cold = 0;
    let warm = 0;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (let d = 0; d < 4; d++) {
      const p = nbr(x, y, dirs[d][0], dirs[d][1], cols, rows);
      if (!p) continue;
      const ni = idx(p.x, p.y, cols);
      if (terrain[ni] !== TERRAIN.WATER) continue;
      if (current[ni] === CURRENT.COLD) cold++;
      else if (current[ni] === CURRENT.WARM) warm++;
    }
    if (cold > warm && cold) return CURRENT.COLD;
    if (warm > cold && warm) return CURRENT.WARM;
    return CURRENT.NONE;
  }

  function isDesertCoreAt(terrain, height, monsoon, current, x, y, cols, rows) {
    if (terrain[idx(x, y, cols)] !== TERRAIN.SAND) return false;
    if (countSandNbrs(terrain, x, y, cols, rows) >= 5) return true;
    const d = rainShadowDist(terrain, height, monsoon, x, y, cols, rows);
    if (d >= 1 && d <= 24) return true;
    if (coastCurrentKind(current, terrain, x, y, cols, rows) === CURRENT.COLD) return true;
    return false;
  }

  function isDesertCore(game, i) {
    if (!game || !game.baseTerrain) return false;
    const cols = game.cols;
    const x = i % cols;
    const y = (i - x) / cols;
    return isDesertCoreAt(game.baseTerrain, game.height, game.monsoon, game.current, x, y, cols, game.rows);
  }

  function buildCurrents(terrain, height, sea, cols, rows) {
    const current = new Uint8Array(cols * rows);
    const cw = Math.random() < 0.72 ? 1 : -1;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, cols);
        if (terrain[i] !== TERRAIN.WATER) continue;
        let landE = 0;
        let landW = 0;
        let landN = 0;
        let landS = 0;
        let land = 0;
        for (let d = 0; d < 4; d++) {
          const p = nbr(x, y, dirs[d][0], dirs[d][1], cols, rows);
          if (!p) continue;
          const t = terrain[idx(p.x, p.y, cols)];
          if (t === TERRAIN.WATER || t === TERRAIN.RIVER) continue;
          land++;
          if (dirs[d][0] > 0) landE++;
          else if (dirs[d][0] < 0) landW++;
          else if (dirs[d][1] > 0) landS++;
          else landN++;
        }
        if (!land) continue;
        let southward = 0;
        if (landE + landW >= landN + landS) {
          southward = landE > landW ? cw : -cw;
        }
        const lat = y / Math.max(1, rows - 1);
        let coldness = (0.42 - lat) * 1.6;
        if (southward > 0) coldness += 0.5;
        if (southward < 0) coldness -= 0.5;
        if (height && height[i] < sea - 12) coldness += 0.12;
        if (lat < 0.22) coldness += 0.2;
        if (lat > 0.72) coldness -= 0.25;
        if (coldness > 0.15) current[i] = CURRENT.COLD;
        else if (coldness < -0.12) current[i] = CURRENT.WARM;
      }
    }
    const next = new Uint8Array(current);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, cols);
        if (terrain[i] !== TERRAIN.WATER || current[i]) continue;
        let cold = 0;
        let warm = 0;
        for (let d = 0; d < 4; d++) {
          const p = nbr(x, y, dirs[d][0], dirs[d][1], cols, rows);
          if (!p) continue;
          const c = current[idx(p.x, p.y, cols)];
          if (c === CURRENT.COLD) cold++;
          else if (c === CURRENT.WARM) warm++;
        }
        if (cold > warm && cold) next[i] = CURRENT.COLD;
        else if (warm > cold && warm) next[i] = CURRENT.WARM;
      }
    }
    return next;
  }

  function paintClimate(terrain, height, monsoon, current, sea, cols, rows) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, cols);
        const t0 = terrain[i];
        if (t0 === TERRAIN.WATER || t0 === TERRAIN.RIVER || t0 === TERRAIN.SNOW) continue;
        if (isOrographic(t0)) {
          if (t0 === TERRAIN.HIGHLAND && Math.random() < 0.16) terrain[i] = TERRAIN.ROCK;
          continue;
        }
        let down = 0;
        let downN = 0;
        for (let s = 1; s <= 8; s++) {
          const p = nbr(x, y, monsoon.dx * s, monsoon.dy * s, cols, rows);
          if (!p) break;
          down += height[idx(p.x, p.y, cols)];
          downN++;
        }
        const self = height[i];
        const shadowDist = rainShadowDist(terrain, height, monsoon, x, y, cols, rows);
        const windward = downN >= 3 && self - down / downN > 14;
        let wet = 0.32 + (self - sea) / 640;
        if (shadowDist) wet -= 0.44 * (1 - shadowDist / 36);
        if (windward) wet += 0.22;
        const ck = coastCurrentKind(current, terrain, x, y, cols, rows);
        if (ck === CURRENT.COLD) wet -= 0.3;
        else if (ck === CURRENT.WARM) wet += 0.22;
        if (wet < 0.18) terrain[i] = TERRAIN.SAND;
        else if (wet > 0.62) terrain[i] = TERRAIN.MARSH;
        else if (wet > 0.48) terrain[i] = TERRAIN.GROVE;
        else if (wet > 0.4) terrain[i] = TERRAIN.FERTILE;
        else terrain[i] = TERRAIN.SOIL;
      }
    }

    for (let pass = 0; pass < 2; pass++) {
      const next = new Uint8Array(terrain);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = idx(x, y, cols);
          const t = terrain[i];
          if (t !== TERRAIN.SOIL && t !== TERRAIN.FERTILE && t !== TERRAIN.GROVE) continue;
          if (countSandNbrs(terrain, x, y, cols, rows) >= 5) next[i] = TERRAIN.SAND;
        }
      }
      terrain.set(next);
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, cols);
        if (terrain[i] !== TERRAIN.SOIL && terrain[i] !== TERRAIN.SAND && terrain[i] !== TERRAIN.GROVE && terrain[i] !== TERRAIN.FERTILE) {
          continue;
        }
        let wetN = 0;
        let riverN = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const p = nbr(x, y, dx, dy, cols, rows);
            if (!p) continue;
            const t = terrain[idx(p.x, p.y, cols)];
            if (t === TERRAIN.WATER || t === TERRAIN.RIVER) wetN++;
            if (t === TERRAIN.RIVER) riverN++;
          }
        }
        const ck = coastCurrentKind(current, terrain, x, y, cols, rows);
        if (wetN >= 4 && (terrain[i] === TERRAIN.SOIL || terrain[i] === TERRAIN.FERTILE || terrain[i] === TERRAIN.GROVE)) {
          terrain[i] = TERRAIN.MARSH;
        } else if (wetN && terrain[i] === TERRAIN.SOIL && ck !== CURRENT.COLD) {
          terrain[i] = TERRAIN.FERTILE;
        }
        if (wetN >= 3 && terrain[i] === TERRAIN.SAND && (ck !== CURRENT.COLD || riverN >= 2)) {
          terrain[i] = TERRAIN.FERTILE;
        }
      }
    }
  }

  function generateWorld(cols, rows) {
    const terrain = new Uint8Array(cols * rows);
    const resources = new Uint8Array(cols * rows);
    const height = new Uint8Array(cols * rows);
    const seed = 1 + randInt(999999);
    const monsoon = pickMonsoon();
    const sea = 98 + randInt(16);

    for (let y = 0; y < rows; y++) {
      const lat = y / Math.max(1, rows - 1);
      const north = 1 - lat;
      for (let x = 0; x < cols; x++) {
        const n1 = fbm(x, y, seed);
        const continent = smoothNoise(x / 55, y / 42, seed + 11);
        let h = n1 * 160 + north * 34 + (continent - 0.4) * 68 + 22;
        if (lat > 0.64) h -= (lat - 0.64) * 150;
        height[idx(x, y, cols)] = clamp(Math.round(h), 0, 255);
      }
    }

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, cols);
        const h = height[i];
        const lat = y / Math.max(1, rows - 1);
        if (h < sea) {
          terrain[i] = TERRAIN.WATER;
          continue;
        }
        const alpine = h >= 188 || (lat < 0.2 && h >= 164);
        if (alpine) {
          terrain[i] = TERRAIN.SNOW;
          continue;
        }
        if (h >= 150) {
          terrain[i] = TERRAIN.HIGHLAND;
          continue;
        }
        terrain[i] = TERRAIN.SOIL;
      }
    }

    raiseShallows(terrain, height, sea, cols, rows);

    const acc = new Uint16Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const start = idx(x, y, cols);
        if (terrain[start] === TERRAIN.WATER) continue;
        let cx = x;
        let cy = y;
        const flowSteps = Math.max(80, Math.floor((cols + rows) * 0.45));
        for (let step = 0; step < flowSteps; step++) {
          const i = idx(cx, cy, cols);
          if (acc[i] < 60000) acc[i] += 1;
          if (terrain[i] === TERRAIN.WATER) break;
          const nxt = lowestNeighbor(height, cx, cy, cols, rows);
          if (!nxt) break;
          if (nxt.x === cx && nxt.y === cy) {
            if (acc[i] > 28 && terrain[i] !== TERRAIN.SNOW) terrain[i] = TERRAIN.WATER;
            break;
          }
          cx = nxt.x;
          cy = nxt.y;
        }
      }
    }

    const riverCut = 20 + Math.floor(cols / 45);
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === TERRAIN.WATER || terrain[i] === TERRAIN.SNOW) continue;
      if (acc[i] >= riverCut && acc[i] < 82) terrain[i] = TERRAIN.RIVER;
      else if (acc[i] >= 82 && height[i] > sea + 2 && height[i] < sea + 22) terrain[i] = TERRAIN.WATER;
    }

    drainRiversShort(terrain, height, cols, rows);
    thinRiverMesh(terrain, cols, rows);
    repairRivers(terrain, height, cols, rows);

    const current = buildCurrents(terrain, height, sea, cols, rows);
    paintClimate(terrain, height, monsoon, current, sea, cols, rows);

    let land = 0;
    let water = 0;
    let snow = 0;
    let sands = 0;
    let coldCoasts = 0;
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === TERRAIN.WATER) water++;
      else if (terrain[i] === TERRAIN.SNOW) snow++;
      else if (terrain[i] === TERRAIN.SAND) {
        sands++;
        land++;
        const x = i % cols;
        const y = (i - x) / cols;
        if (coastCurrentKind(current, terrain, x, y, cols, rows) === CURRENT.COLD) coldCoasts++;
      } else if (terrain[i] !== TERRAIN.ROCK && terrain[i] !== TERRAIN.RIVER) land++;
    }
    let note = snow > water * 0.12 ? "河從雪山入海" : water > land ? "群島環海" : "高地分水入洋";
    if (sands > land * 0.1) note += coldCoasts > sands * 0.18 ? " · 寒流岸有沙漠" : " · 背風有沙漠";

    const area = land + 1;
    const areaMul = (cols * rows) / (200 * 120);
    const nuts = Math.min(Math.round(160 * areaMul), 32 + Math.floor(area / 80));
    const crystals = Math.min(Math.round(56 * areaMul), 14 + Math.floor(area / 220));
    const resAmt = new Uint8Array(cols * rows);
    const ore = new Uint8Array(cols * rows);
    for (let i = 0; i < nuts; i++) {
      placeResource(terrain, resources, null, cols, rows, RESOURCE.NUTRIENT, true, resAmt);
    }
    for (let i = 0; i < crystals; i++) {
      placeResource(terrain, resources, null, cols, rows, RESOURCE.CRYSTAL, true, resAmt);
    }
    for (let i = 0; i < resources.length; i++) {
      if (resources[i] !== RESOURCE.CRYSTAL) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      if ((terrain[i] === TERRAIN.HIGHLAND || isRockAdjacent(terrain, x, y, cols, rows)) && Math.random() < 0.38) {
        ore[i] = 1;
      }
    }

    return {
      terrain: terrain,
      resources: resources,
      resAmt: resAmt,
      ore: ore,
      height: height,
      monsoon: monsoon,
      monsoonBase: { dx: monsoon.dx, dy: monsoon.dy, label: monsoon.label, back: monsoon.back },
      note: note,
      seaLevel: sea,
      seaOrigin: sea,
      current: current,
    };
  }

  function respawnResources(game, life, options) {
    const cols = game.cols;
    const rows = game.rows;
    const max = options.max || 36;
    const current = countResources(game.resources);
    if (current >= max) return 0;
    const spawnMin = options.spawnMin != null ? options.spawnMin : 2;
    const spawnMax = options.spawnMax != null ? options.spawnMax : 5;
    const roll = spawnMin + randInt(Math.max(1, spawnMax - spawnMin + 1));
    const want = Math.min(roll, max - current);
    let added = 0;
    for (let i = 0; i < want; i++) {
      const rare = Math.random() < 0.18;
      const kind = rare ? RESOURCE.CRYSTAL : RESOURCE.NUTRIENT;
      if (placeResource(game.terrain, game.resources, life, cols, rows, kind, true, game.resAmt)) {
        added++;
      }
    }
    return added;
  }

  function spawnTownBounty(game) {
    const cols = game.cols;
    const rows = game.rows;
    const life = game.life;
    (game.settlements || []).forEach(function (s) {
      const tries = 1 + (Math.random() < 0.45 ? 1 : 0);
      for (let t = 0; t < tries; t++) {
        const x = wrap(Math.round(s.cx) + randInt(9) - 4, cols);
        let y = Math.round(s.cy) + randInt(9) - 4;
        if (!inY(y, rows)) continue;
        const i = idx(x, y, cols);
        if (game.resources[i]) continue;
        if (!canHoldResource(game.terrain, life, i)) continue;
        game.resources[i] = Math.random() < 0.45 ? RESOURCE.CRYSTAL : RESOURCE.NUTRIENT;
        if (game.resAmt) game.resAmt[i] = 1;
      }
    });
    if (!game.stain || game.generation % 4 !== 0) return;
    let extra = 0;
    for (let i = 0; i < game.stain.length && extra < 3; i++) {
      if (game.stain[i] < 4) continue;
      if (game.civCells && game.civCells[i]) continue;
      if (game.resources[i]) continue;
      if (!canHoldResource(game.terrain, life, i)) continue;
      if (Math.random() < 0.1) {
        game.resources[i] = RESOURCE.NUTRIENT;
        if (game.resAmt) game.resAmt[i] = 1;
        extra += 1;
      }
    }
  }

  function wipeRes(game, i) {
    game.resources[i] = RESOURCE.NONE;
    if (game.resAmt) game.resAmt[i] = 0;
    if (game.ore) game.ore[i] = 0;
  }

  function restoreTerrain(game) {
    game.terrain.set(game.baseTerrain);
    const terrain = game.terrain;
    for (let i = 0; i < terrain.length; i++) {
      if (terrain[i] === TERRAIN.WATER || terrain[i] === TERRAIN.RIVER) {
        if (game.life) game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
        wipeRes(game, i);
      }
    }
  }

  function applyFlood(game) {
    game.terrain.set(game.baseTerrain);
    const cols = game.cols;
    const rows = game.rows;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    const extra = [];
    const seen = {};
    const floodable = {};
    floodable[TERRAIN.SOIL] = 1;
    floodable[TERRAIN.FERTILE] = 1;
    floodable[TERRAIN.SAND] = 1;
    floodable[TERRAIN.GROVE] = 1;
    function pushExtra(i) {
      if (seen[i]) return;
      seen[i] = 1;
      extra.push(i);
    }
    const dry = game.yearKind === "dry";
    const wet = game.yearKind === "wet";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, cols);
        if (game.baseTerrain[i] !== TERRAIN.WATER) continue;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const p = nbr(x, y, dx, dy, cols, rows);
            if (!p) continue;
            const ni = idx(p.x, p.y, cols);
            const t = game.baseTerrain[ni];
            if (!floodable[t]) continue;
            if (dry && Math.random() > 0.35) continue;
            pushExtra(ni);
          }
        }
      }
    }
    if (wet) {
      const first = extra.slice();
      first.forEach(function (i) {
        const x = i % cols;
        const y = (i - x) / cols;
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (let d = 0; d < 4; d++) {
          const p = nbr(x, y, dirs[d][0], dirs[d][1], cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          const t = game.baseTerrain[ni];
          if (!floodable[t]) continue;
          if (game.height && game.height[ni] > sea + 2) continue;
          pushExtra(ni);
        }
      });
    }
    extra.forEach((i) => {
      game.terrain[i] = TERRAIN.WATER;
    });
    game.floodedCells = extra.slice();
    const burst = applyMountainBurst(game);
    game.floodNote = burst;
    for (let i = 0; i < game.terrain.length; i++) {
      if (game.terrain[i] !== TERRAIN.WATER && game.terrain[i] !== TERRAIN.RIVER) continue;
      if (game.dikeCells && game.dikeCells[i] && game.terrain[i] === TERRAIN.WATER) continue;
      if (game.raftCells && game.raftCells[i]) {
        if (Math.random() < 0.7) continue;
        delete game.raftCells[i];
        if (game.raftIdle) delete game.raftIdle[i];
      }
      if (game.life) game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
      wipeRes(game, i);
    }
  }

  function shoreTouchesLand(base, x, y, cols, rows) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let d = 0; d < 4; d++) {
      const p = nbr(x, y, dirs[d][0], dirs[d][1], cols, rows);
      if (!p) continue;
      const t = base[idx(p.x, p.y, cols)];
      if (t !== TERRAIN.WATER && t !== TERRAIN.RIVER) return true;
    }
    return false;
  }

  function freezeRivers(game, iceAge) {
    const cols = game.cols;
    const rows = game.rows;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    const base = game.baseTerrain;
    const height = game.height;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, cols);
        const t = game.terrain[i];
        const b = base[i];
        if (t === TERRAIN.ROCK || t === TERRAIN.SNOW) continue;
        let freeze = false;
        if (b === TERRAIN.RIVER || t === TERRAIN.RIVER) freeze = true;
        else if (b === TERRAIN.WATER) {
          if (shoreTouchesLand(base, x, y, cols, rows)) freeze = true;
          else if (iceAge && height && height[i] >= sea - 14) freeze = true;
        }
        if (!freeze) continue;
        game.terrain[i] = TERRAIN.ICE;
        wipeRes(game, i);
      }
    }
  }

  function thawRivers(game) {
    for (let i = 0; i < game.terrain.length; i++) {
      if (game.terrain[i] !== TERRAIN.ICE) continue;
      const b = game.baseTerrain[i];
      if (b === TERRAIN.RIVER) game.terrain[i] = TERRAIN.RIVER;
      else if (b === TERRAIN.WATER) game.terrain[i] = TERRAIN.WATER;
      else game.terrain[i] = b;
      if (game.life) game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
      wipeRes(game, i);
    }
    game.iceAge = false;
  }

  function hasNeighbor(terrain, x, y, cols, rows, test) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const p = nbr(x, y, dx, dy, cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        if (test(terrain[ni], ni)) return true;
      }
    }
    return false;
  }

  function nearSea(terrain, x, y, cols, rows) {
    return hasNeighbor(terrain, x, y, cols, rows, function (t) {
      return t === TERRAIN.WATER;
    });
  }

  function nearWet(terrain, x, y, cols, rows) {
    return hasNeighbor(terrain, x, y, cols, rows, function (t) {
      return t === TERRAIN.WATER || t === TERRAIN.RIVER || t === TERRAIN.ICE;
    });
  }

  function writeLand(game, i, type) {
    if (game.driedRiver && game.driedRiver[i]) return false;
    if (type === TERRAIN.WATER || type === TERRAIN.SNOW) return false;
    if (game.baseTerrain[i] === TERRAIN.WATER || game.baseTerrain[i] === TERRAIN.SNOW) return false;
    if (game.terrain[i] === TERRAIN.WATER && game.baseTerrain[i] === TERRAIN.WATER) return false;
    const vis = game.terrain[i];
    const overlay = vis === TERRAIN.ICE || (vis === TERRAIN.WATER && game.baseTerrain[i] !== TERRAIN.WATER);
    game.baseTerrain[i] = type;
    if (!overlay) {
      game.terrain[i] = type;
      if (type === TERRAIN.RIVER || type === TERRAIN.ROCK) {
        if (game.life) game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
        wipeRes(game, i);
      } else if (type === TERRAIN.SOIL || type === TERRAIN.FERTILE) {
        if (vis === TERRAIN.RIVER) wipeRes(game, i);
      }
    }
    return true;
  }

  function sampleCell(game, pred, tries) {
    const n = game.baseTerrain.length;
    for (let t = 0; t < tries; t++) {
      const i = randInt(n);
      if (pred(i)) return i;
    }
    return -1;
  }

  function floodSilt(game) {
    const extra = game.floodedCells || [];
    game.floodedCells = null;
    let silt = 0;
    extra.forEach(function (i) {
      if (game.baseTerrain[i] === TERRAIN.WATER) return;
      if (game.baseTerrain[i] !== TERRAIN.SOIL && game.baseTerrain[i] !== TERRAIN.FERTILE) return;
      if (game.life && game.life[i]) return;
      if (Math.random() < 0.32) {
        if (writeLand(game, i, TERRAIN.FERTILE)) silt++;
      }
    });
    const carved = carveFloodRivers(game, extra);
    if (silt > 3 && carved) return "洪水在岸上留下沃土 · " + carved;
    if (carved) return carved;
    return silt > 3 ? "洪水在岸上留下沃土" : null;
  }

  function thawMud(game) {
    const cols = game.cols;
    const rows = game.rows;
    let n = 0;
    for (let k = 0; k < 6; k++) {
      const i = sampleCell(game, function (j) {
        if (game.baseTerrain[j] !== TERRAIN.SOIL) return false;
        if (game.life && game.life[j]) return false;
        const x = j % cols;
        const y = (j - x) / cols;
        return hasNeighbor(game.baseTerrain, x, y, cols, rows, function (t) {
          return t === TERRAIN.RIVER;
        });
      }, 40);
      if (i < 0) break;
      if (writeLand(game, i, TERRAIN.FERTILE)) n++;
    }
    return n > 2 ? "解凍後岸邊留下泥灘" : null;
  }

  function wrapDelta(a, b, max) {
    const d = Math.abs(a - b);
    return Math.min(d, max - d);
  }

  function isOcean(game, i) {
    if (game.baseTerrain[i] !== TERRAIN.WATER) return false;
    if (!game.height) return true;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    return game.height[i] < sea;
  }

  function isInlandLake(game, i) {
    return game.baseTerrain[i] === TERRAIN.WATER && !isOcean(game, i);
  }

  function writeLakeShore(game, i, type) {
    if (!isInlandLake(game, i)) return false;
    if (type !== TERRAIN.MARSH && type !== TERRAIN.SOIL && type !== TERRAIN.FERTILE) return false;
    const vis = game.terrain[i];
    game.baseTerrain[i] = type;
    if (vis === TERRAIN.ICE) return true;
    game.terrain[i] = type;
    if (game.life) game.life[i] = 0;
    if (game.owner) game.owner[i] = 0;
    wipeRes(game, i);
    return true;
  }

  function ensureHeight(game, i, minH) {
    if (!game.height || game.height.length !== game.baseTerrain.length) return;
    if (game.height[i] < minH) game.height[i] = minH;
  }

  function isShallowOcean(game, i) {
    if (!isOcean(game, i)) return false;
    if (!game.height) return false;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    return game.height[i] >= sea - 22;
  }

  function writeFromOcean(game, i, type) {
    if (!isOcean(game, i)) return false;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    if (game.height && game.height[i] < sea - 26) return false;
    if (
      type !== TERRAIN.MARSH &&
      type !== TERRAIN.SOIL &&
      type !== TERRAIN.FERTILE &&
      type !== TERRAIN.ROCK &&
      type !== TERRAIN.HIGHLAND &&
      type !== TERRAIN.SNOW
    ) {
      return false;
    }
    const vis = game.terrain[i];
    game.baseTerrain[i] = type;
    ensureHeight(game, i, sea);
    if (vis === TERRAIN.ICE) return true;
    game.terrain[i] = type;
    if (game.life) game.life[i] = 0;
    if (game.owner) game.owner[i] = 0;
    wipeRes(game, i);
    return true;
  }

  function ensureRiverRisk(game) {
    const n = game.baseTerrain.length;
    if (!game.riverRisk || game.riverRisk.length !== n) game.riverRisk = new Uint8Array(n);
  }

  function isMountainRiver(game, i) {
    if (game.baseTerrain[i] !== TERRAIN.RIVER) return false;
    const cols = game.cols;
    const rows = game.rows;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    if (game.height && game.height[i] >= sea + 18) return true;
    const x = i % cols;
    const y = (i - x) / cols;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const p = nbr(x, y, dx, dy, cols, rows);
        if (!p) continue;
        const t = game.baseTerrain[idx(p.x, p.y, cols)];
        if (t === TERRAIN.HIGHLAND || t === TERRAIN.ROCK || t === TERRAIN.SNOW) return true;
      }
    }
    return false;
  }

  function markRiverRisk(game, i) {
    ensureRiverRisk(game);
    if (i < 0 || i >= game.riverRisk.length) return;
    game.riverRisk[i] = 22;
  }

  function dikeTownNear(game, x, y) {
    const s = nearestTown(game, x, y, 8);
    return !!(s && s.trait === "dike");
  }

  function tickRiverRisk(game) {
    if (!game.riverRisk) return;
    if (game.generation % 2 !== 0) return;
    for (let i = 0; i < game.riverRisk.length; i++) {
      if (game.riverRisk[i]) game.riverRisk[i] -= 1;
    }
  }

  function applyMountainBurst(game) {
    ensureRiverRisk(game);
    const cols = game.cols;
    const rows = game.rows;
    const extra = game.floodedCells || [];
    const seen = {};
    extra.forEach(function (i) {
      seen[i] = 1;
    });
    let burst = 0;
    let held = false;
    const floodable = {};
    floodable[TERRAIN.SOIL] = 1;
    floodable[TERRAIN.FERTILE] = 1;
    floodable[TERRAIN.SAND] = 1;
    floodable[TERRAIN.GROVE] = 1;
    for (let i = 0; i < game.riverRisk.length; i++) {
      if (!game.riverRisk[i]) continue;
      if (game.baseTerrain[i] !== TERRAIN.RIVER) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      if (dikeTownNear(game, x, y)) {
        held = true;
        continue;
      }
      const reach = 2;
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > reach) continue;
          if (!dx && !dy) continue;
          const p = nbr(x, y, dx, dy, cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          const t = game.baseTerrain[ni];
          if (!floodable[t]) continue;
          if (seen[ni]) continue;
          seen[ni] = 1;
          extra.push(ni);
          burst += 1;
        }
      }
    }
    extra.forEach(function (i) {
      if (game.dikeCells && game.dikeCells[i]) return;
      game.terrain[i] = TERRAIN.WATER;
      if (game.life) game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
      wipeRes(game, i);
    });
    game.floodedCells = extra;
    if (burst) return "改道的河在大雨裡決口";
    if (held) return "堤防擋住了山洪";
    return null;
  }

  function spawnVolcanoIsle(game) {
    const cols = game.cols;
    const rows = game.rows;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    let origin = -1;
    for (let attempt = 0; attempt < 120; attempt++) {
      const i = randInt(game.baseTerrain.length);
      if (!isShallowOcean(game, i)) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      let wetN = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const p = nbr(x, y, dx, dy, cols, rows);
          if (!p) continue;
          if (isOcean(game, idx(p.x, p.y, cols))) wetN++;
        }
      }
      if (wetN < 3) continue;
      origin = i;
      break;
    }
    if (origin < 0) return null;
    const want = 6 + randInt(9);
    const cells = [origin];
    const seen = {};
    seen[origin] = 1;
    let guard = 0;
    while (cells.length < want && guard < 80) {
      guard++;
      const src = cells[randInt(cells.length)];
      const x = src % cols;
      const y = (src - x) / cols;
      const d = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]][randInt(8)];
      const p = nbr(x, y, d[0], d[1], cols, rows);
      if (!p) continue;
      const ni = idx(p.x, p.y, cols);
      if (seen[ni]) continue;
      if (!isOcean(game, ni) && game.terrain[ni] !== TERRAIN.ICE) continue;
      if (!isOcean(game, ni) && game.baseTerrain[ni] !== TERRAIN.WATER) continue;
      seen[ni] = 1;
      cells.push(ni);
    }
    if (cells.length < 6) return null;
    const oy = (origin - (origin % cols)) / cols;
    const north = oy / Math.max(1, rows - 1) < 0.22;
    const made = [];
    cells.forEach(function (i, n) {
      let type = TERRAIN.SOIL;
      if (n === 0 || n < 2) type = Math.random() < 0.6 ? TERRAIN.ROCK : TERRAIN.HIGHLAND;
      else if (n < 4) type = TERRAIN.HIGHLAND;
      if (north && n === 0 && Math.random() < 0.35) type = TERRAIN.SNOW;
      if (!writeFromOcean(game, i, type)) return;
      ensureHeight(game, i, sea + 8);
      made.push(i);
    });
    if (made.length < 6) return null;
    const crystal = made[Math.min(made.length - 1, 2)];
    if (
      game.resources &&
      game.baseTerrain[crystal] !== TERRAIN.ROCK &&
      game.baseTerrain[crystal] !== TERRAIN.SNOW &&
      game.baseTerrain[crystal] !== TERRAIN.WATER
    ) {
      game.resources[crystal] = RESOURCE.CRYSTAL;
      if (game.resAmt) game.resAmt[crystal] = 2;
    }
    return Math.random() < 0.5 ? "海底冒出一座島" : "火山在海上噴出新陸";
  }

  function townDist(game, x, y, settl) {
    return wrapDelta(x, Math.round(settl.cx), game.cols) + Math.abs(y - settl.cy);
  }

  function nearestTown(game, x, y, maxDist) {
    let best = null;
    let bestD = maxDist + 1;
    (game.settlements || []).forEach(function (s) {
      const d = townDist(game, x, y, s);
      if (d <= maxDist && d < bestD) {
        bestD = d;
        best = s;
      }
    });
    return best;
  }

  function pickRiverCell(game) {
    const cols = game.cols;
    const rows = game.rows;
    const towns = game.settlements || [];
    if (towns.length) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const s = towns[randInt(towns.length)];
        const x = wrap(Math.round(s.cx) + randInt(17) - 8, cols);
        const y = Math.round(s.cy) + randInt(17) - 8;
        if (!inY(y, rows)) continue;
        const i = idx(x, y, cols);
        if (game.baseTerrain[i] === TERRAIN.RIVER) return i;
      }
    }
    return sampleCell(game, function (j) {
      return game.baseTerrain[j] === TERRAIN.RIVER;
    }, 30);
  }

  function meanderRiver(game) {
    const cols = game.cols;
    const rows = game.rows;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const tries = (game.settlements || []).length ? 80 : 50;
    for (let attempt = 0; attempt < tries; attempt++) {
      const i = pickRiverCell(game);
      if (i < 0 || i == null) return null;
      const x = i % cols;
      const y = (i - x) / cols;
      const d = dirs[randInt(4)];
      const p = nbr(x, y, d[0], d[1], cols, rows);
      if (!p) continue;
      const ni = idx(p.x, p.y, cols);
      const nt = game.baseTerrain[ni];
      if (nt !== TERRAIN.SOIL && nt !== TERRAIN.FERTILE && nt !== TERRAIN.SAND && nt !== TERRAIN.MARSH) continue;
      if (game.life && game.life[ni]) continue;
      if (!writeLand(game, ni, TERRAIN.RIVER)) continue;
      const mountain = isMountainRiver(game, i) || isMountainRiver(game, ni);
      const town = nearestTown(game, x, y, 8);
      const fill = town && Math.random() < 0.45 ? TERRAIN.FERTILE : TERRAIN.SOIL;
      writeLand(game, i, fill);
      reconnectAround(game, ni);
      reconnectAround(game, i);
      if (mountain) {
        markRiverRisk(game, ni);
      }
      if (town) {
        if (town.trait === "dike" || town.trait === "expand") return "有人讓河改道";
        return "河道改了";
      }
      return "河流改了一點岸線";
    }
    return null;
  }

  function reconnectRiverGame(game, start) {
    const terrain = game.baseTerrain;
    const height = game.height;
    const cols = game.cols;
    const rows = game.rows;
    if (start == null || start < 0 || start >= terrain.length) return false;
    if (terrain[start] !== TERRAIN.RIVER) return false;
    if (riverHasOutlet(terrain, height, cols, rows, start)) return true;
    let cur = start;
    const seen = {};
    for (let step = 0; step < 6; step++) {
      if (seen[cur]) break;
      seen[cur] = 1;
      if (touchesWater(terrain, cols, rows, cur)) return true;
      const x = cur % cols;
      const y = (cur - x) / cols;
      let best = -1;
      let bestH = 9999;
      for (let d = 0; d < 8; d++) {
        const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        const t = terrain[ni];
        if (t === TERRAIN.WATER) return true;
        if (t === TERRAIN.SNOW || t === TERRAIN.ROCK) continue;
        if (t !== TERRAIN.RIVER && !canCarveRiverOn(t)) continue;
        if (game.life && game.life[ni] && t !== TERRAIN.RIVER) continue;
        const h = ((height && height[ni]) || 128) + (FLOW_DIRS[d][0] && FLOW_DIRS[d][1] ? 0.3 : 0);
        if (h < bestH) {
          bestH = h;
          best = ni;
        }
      }
      if (best < 0) break;
      if (terrain[best] !== TERRAIN.RIVER) {
        if (!writeLand(game, best, TERRAIN.RIVER)) break;
      }
      cur = best;
    }
    const ok = riverHasOutlet(terrain, height, cols, rows, start);
    if (!ok) markRiverRisk(game, start);
    return ok;
  }

  function reconnectAround(game, i) {
    reconnectRiverGame(game, i);
    const cols = game.cols;
    const x = i % cols;
    const y = (i - x) / cols;
    for (let d = 0; d < 4; d++) {
      const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, game.rows);
      if (!p) continue;
      const ni = idx(p.x, p.y, cols);
      if (game.baseTerrain[ni] === TERRAIN.RIVER) reconnectRiverGame(game, ni);
    }
  }

  function townStainDeep(game, s) {
    const list = s.list || [];
    for (let k = 0; k < list.length; k++) {
      if (game.stain && game.stain[list[k]] >= 8) return true;
    }
    return false;
  }

  function riverComponentAt(terrain, cols, rows, start, height) {
    const n = terrain.length;
    if (start < 0 || start >= n || terrain[start] !== TERRAIN.RIVER) {
      return { cells: [], mouth: false, lowest: start };
    }
    const seen = {};
    const cells = [];
    const stack = [start];
    seen[start] = 1;
    let mouth = false;
    let lowest = start;
    let lowH = (height && height[start]) || 128;
    while (stack.length) {
      const cur = stack.pop();
      cells.push(cur);
      if (touchesWater(terrain, cols, rows, cur)) mouth = true;
      const h = (height && height[cur]) || 128;
      if (h < lowH) {
        lowH = h;
        lowest = cur;
      }
      const x = cur % cols;
      const y = (cur - x) / cols;
      for (let d = 0; d < 8; d++) {
        const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        if (seen[ni] || terrain[ni] !== TERRAIN.RIVER) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    return { cells: cells, mouth: mouth, lowest: lowest };
  }

  function pruneDanglingRiver(game, start) {
    const terrain = game.baseTerrain;
    const cols = game.cols;
    const rows = game.rows;
    if (start == null || terrain[start] !== TERRAIN.RIVER) return;
    const info = riverComponentAt(terrain, cols, rows, start, game.height);
    if (!info.cells.length) return;
    if (info.mouth) {
      reconnectRiverGame(game, start);
      return;
    }
    if (info.cells.length < 10) {
      for (let k = 0; k < info.cells.length; k++) writeLand(game, info.cells[k], TERRAIN.SOIL);
      return;
    }
    reconnectRiverGame(game, info.lowest);
  }

  function fillRiverLand(game) {
    if ((game.generation || 0) % 6 !== 0) return null;
    const cols = game.cols;
    const rows = game.rows;
    const towns = (game.settlements || []).filter(function (s) {
      return (s.age || 0) >= 25 && townStainDeep(game, s);
    });
    if (!towns.length) return null;
    const s = towns[randInt(towns.length)];
    const cands = [];
    const seenCand = {};
    for (let k = 0; k < 40; k++) {
      const x = wrap(Math.round(s.cx) + randInt(19) - 9, cols);
      const y = Math.round(s.cy) + randInt(19) - 9;
      if (!inY(y, rows)) continue;
      const i = idx(x, y, cols);
      if (seenCand[i]) continue;
      seenCand[i] = 1;
      if (game.baseTerrain[i] !== TERRAIN.RIVER) continue;
      if (touchesWater(game.baseTerrain, cols, rows, i)) continue;
      if (game.life && game.life[i]) continue;
      cands.push(i);
    }
    if (!cands.length) return null;
    let chance = 0.18;
    if (s.trait === "dike") chance = 0.32;
    if (Math.random() > chance) return null;
    cands.sort(function (a, b) {
      return riverOrthoCount(game.baseTerrain, cols, rows, b) - riverOrthoCount(game.baseTerrain, cols, rows, a);
    });
    const nFill = cands.length > 1 && Math.random() < 0.55 ? 2 : 1;
    let filled = 0;
    const scars = [];
    for (let f = 0; f < nFill && f < cands.length; f++) {
      const i = cands[f];
      if (game.baseTerrain[i] !== TERRAIN.RIVER) continue;
      if (touchesWater(game.baseTerrain, cols, rows, i)) continue;
      const next = s.trait === "dike" || Math.random() < 0.55 ? TERRAIN.SOIL : TERRAIN.MARSH;
      if (!writeLand(game, i, next)) continue;
      filled++;
      scars.push(i);
    }
    if (!filled) return null;
    for (let k = 0; k < scars.length; k++) {
      reconnectAround(game, scars[k]);
      const i = scars[k];
      const x = i % cols;
      const y = (i - x) / cols;
      for (let d = 0; d < 4; d++) {
        const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
        if (!p) continue;
        pruneDanglingRiver(game, idx(p.x, p.y, cols));
      }
    }
    return "有人填了一段河";
  }

  function carveFloodRivers(game, extra) {
    if (game.yearKind === "dry") return null;
    if (!extra || !extra.length) return null;
    const chance = game.yearKind === "wet" ? 0.22 : 0.08;
    if (Math.random() > chance) return null;
    const cols = game.cols;
    const rows = game.rows;
    const height = game.height;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    const cands = [];
    const seen = {};
    extra.forEach(function (i) {
      if (seen[i]) return;
      seen[i] = 1;
      if (game.life && game.life[i]) return;
      const t = game.baseTerrain[i];
      if (!canCarveRiverOn(t)) return;
      if (t === TERRAIN.HIGHLAND && height && height[i] > sea + 16) return;
      cands.push(i);
    });
    if (!cands.length) return null;
    cands.sort(function (a, b) {
      return ((height && height[a]) || 128) - ((height && height[b]) || 128);
    });
    const start = cands[randInt(Math.min(8, cands.length))];
    const path = [];
    let cur = start;
    const walked = {};
    const want = 3 + randInt(6);
    let reached = touchesWater(game.baseTerrain, cols, rows, cur) || game.baseTerrain[cur] === TERRAIN.RIVER;
    for (let step = 0; step < want; step++) {
      if (walked[cur]) break;
      walked[cur] = 1;
      if (game.baseTerrain[cur] !== TERRAIN.RIVER) {
        if (!writeLand(game, cur, TERRAIN.RIVER)) break;
        path.push(cur);
      }
      if (touchesWater(game.baseTerrain, cols, rows, cur)) {
        reached = true;
        break;
      }
      const x = cur % cols;
      const y = (cur - x) / cols;
      let best = -1;
      let bestH = 9999;
      for (let d = 0; d < 8; d++) {
        const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        if (walked[ni]) continue;
        const t = game.baseTerrain[ni];
        if (t === TERRAIN.WATER) {
          reached = true;
          best = -2;
          break;
        }
        if (t === TERRAIN.RIVER) {
          reached = true;
          best = ni;
          bestH = -1;
          continue;
        }
        if (!canCarveRiverOn(t)) continue;
        if (game.life && game.life[ni]) continue;
        const h = (height && height[ni]) || 128;
        if (h < bestH) {
          bestH = h;
          best = ni;
        }
      }
      if (best === -2) break;
      if (best < 0) break;
      cur = best;
    }
    if (reached && path.length) {
      reconnectRiverGame(game, path[0]);
      return path.length > 3 ? "低地走成了河" : "大雨後積水成川";
    }
    path.forEach(function (i) {
      writeLand(game, i, TERRAIN.MARSH);
    });
    if (path.length) return "低地積了水";
    return null;
  }

  function civDrawLake(game) {
    const towns = game.settlements || [];
    if (!towns.length) return null;
    const cols = game.cols;
    const rows = game.rows;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let drained = 0;
    const cap = game.hungry ? 3 : 2;
    for (let t = 0; t < towns.length && drained < cap; t++) {
      const s = towns[randInt(towns.length)];
      let chance = 0.16;
      if (s.trait === "deep" || s.legacy === "rite") chance += 0.14;
      if (s.trait === "dike" || s.trait === "expand") chance += 0.08;
      const f = game.factions && game.factions[s.owner || 0];
      if (f && (f.kingdom || f.empire)) chance += 0.1;
      if (game.hungry) chance += 0.14;
      if ((s.size || 0) >= 20) chance += 0.08;
      if (Math.random() > chance) continue;
      let picked = -1;
      for (let attempt = 0; attempt < 24; attempt++) {
        const x = wrap(Math.round(s.cx) + randInt(11) - 5, cols);
        const y = Math.round(s.cy) + randInt(11) - 5;
        if (!inY(y, rows)) continue;
        const i = idx(x, y, cols);
        if (!isInlandLake(game, i)) continue;
        let bank = false;
        for (let d = 0; d < 4; d++) {
          const p = nbr(x, y, dirs[d][0], dirs[d][1], cols, rows);
          if (!p) continue;
          const bt = game.baseTerrain[idx(p.x, p.y, cols)];
          if (bt !== TERRAIN.WATER && bt !== TERRAIN.RIVER) {
            bank = true;
            break;
          }
        }
        if (!bank) continue;
        picked = i;
        break;
      }
      if (picked < 0) continue;
      if (!writeLakeShore(game, picked, TERRAIN.MARSH)) continue;
      drained += 1;
      const px = picked % cols;
      const py = (picked - px) / cols;
      for (let d = 0; d < 4; d++) {
        const p = nbr(px, py, dirs[d][0], dirs[d][1], cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        if (game.baseTerrain[ni] === TERRAIN.SOIL && Math.random() < 0.5) {
          writeLand(game, ni, TERRAIN.FERTILE);
        }
        if (game.baseTerrain[ni] === TERRAIN.MARSH && Math.random() < 0.35) {
          writeLand(game, ni, TERRAIN.SOIL);
        }
      }
    }
    if (!drained) return null;
    return drained > 1 ? "取水讓湖縮小" : "湖岸退了";
  }

  function siltRiverMouth(game, gen) {
    if (gen % 8 !== 0) return null;
    const cols = game.cols;
    const rows = game.rows;
    const cands = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = idx(x, y, cols);
        if (game.baseTerrain[i] !== TERRAIN.RIVER) continue;
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (let k = 0; k < 4; k++) {
          const p = nbr(x, y, dirs[k][0], dirs[k][1], cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          if (!isShallowOcean(game, ni)) continue;
          cands.push(ni);
        }
      }
    }
    if (!cands.length) return null;
    const cap = 1 + (Math.random() < 0.35 ? 1 : 0);
    let n = 0;
    const used = {};
    for (let t = 0; t < cands.length && n < cap; t++) {
      const ni = cands[randInt(cands.length)];
      if (used[ni] || !isOcean(game, ni)) continue;
      used[ni] = 1;
      const x = ni % cols;
      const y = (ni - x) / cols;
      const town = nearestTown(game, x, y, 8);
      let chance = 0.12;
      if (town && (town.trait === "dike" || town.trait === "expand")) chance = 0.22;
      if (Math.random() >= chance) continue;
      if (!writeFromOcean(game, ni, TERRAIN.MARSH)) continue;
      n++;
    }
    if (!n) return null;
    return "河口淤出灘地";
  }

  function terraceHighlands(game) {
    if ((game.generation || 0) % 8 !== 0) return null;
    if (!game.settlements || !game.settlements.length) return null;
    if (!game.stain) return null;
    const cols = game.cols;
    const rows = game.rows;
    const factions = game.factions || {};
    const cands = [];
    game.settlements.forEach(function (s) {
      const f = factions[s.owner != null ? s.owner : s.fid];
      const lived = f ? f.lived : 0;
      const climb = s.trait === "climb" || (f && f.skills && f.skills.climb);
      const king = f && (f.kingdom || f.empire);
      const need = climb ? 70 : king ? 74 : 80;
      if ((s.age || 0) < need && lived < need) return;
      const cells = s.list || [];
      for (let k = 0; k < cells.length; k++) {
        const i = cells[k];
        if ((game.stain[i] || 0) < 10) continue;
        const x = i % cols;
        const y = (i - x) / cols;
        const around = [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
        for (let a = 0; a < around.length; a++) {
          const p = nbr(x, y, around[a][0], around[a][1], cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          const t = game.baseTerrain[ni];
          if (t === TERRAIN.SNOW || t === TERRAIN.WATER || t === TERRAIN.ICE || t === TERRAIN.RIVER) continue;
          if (t !== TERRAIN.ROCK && t !== TERRAIN.HIGHLAND) continue;
          if ((game.stain[ni] || 0) < 8 && a !== 0) continue;
          cands.push({ i: ni, town: s });
        }
      }
    });
    if (!cands.length) return null;
    const usedTown = {};
    let n = 0;
    let rock = false;
    for (let t = 0; t < cands.length && n < 2; t++) {
      const item = cands[randInt(cands.length)];
      const key = Math.round(item.town.cx) + "," + Math.round(item.town.cy);
      if (usedTown[key]) continue;
      const cellT = game.baseTerrain[item.i];
      if (cellT === TERRAIN.SNOW) continue;
      if (cellT === TERRAIN.ROCK) {
        if (!writeLand(game, item.i, TERRAIN.HIGHLAND)) continue;
        rock = true;
      } else if (cellT === TERRAIN.HIGHLAND) {
        const next = Math.random() < 0.55 ? TERRAIN.SOIL : TERRAIN.FERTILE;
        if (!writeLand(game, item.i, next)) continue;
      } else continue;
      usedTown[key] = 1;
      n++;
    }
    if (!n) return null;
    return rock ? "山邊被住成了土坡" : "有人在高處開出田子";
  }

  function passPlantable(t) {
    return (
      t === TERRAIN.SOIL ||
      t === TERRAIN.FERTILE ||
      t === TERRAIN.GROVE ||
      t === TERRAIN.HIGHLAND ||
      t === TERRAIN.SAND ||
      t === TERRAIN.MARSH
    );
  }

  function carveMountainPass(game) {
    if ((game.generation || 0) % 10 !== 0) return null;
    if (!game.settlements || !game.settlements.length) return null;
    const cols = game.cols;
    const rows = game.rows;
    const factions = game.factions || {};
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const cands = [];
    game.settlements.forEach(function (s) {
      const f = factions[s.owner != null ? s.owner : s.fid];
      const lived = f ? f.lived : 0;
      const climb = s.trait === "climb" || (f && f.skills && f.skills.climb);
      const need = climb ? 70 : 80;
      if ((s.age || 0) < need && lived < need) return;
      let chance = 0.1;
      if (climb) chance = 0.42;
      else if (s.trait === "expand") chance = 0.18;
      if (Math.random() > chance) return;
      const cells = s.list || [];
      for (let k = 0; k < cells.length; k++) {
        const i = cells[k];
        const x = i % cols;
        const y = (i - x) / cols;
        for (let r = 0; r < 6; r++) {
          for (let d = 0; d < dirs.length; d++) {
            const p = nbr(x, y, dirs[d][0] * r, dirs[d][1] * r, cols, rows);
            if (!p) continue;
            const ni = idx(p.x, p.y, cols);
            const t = game.baseTerrain[ni];
            if (t !== TERRAIN.ROCK) continue;
            if (t === TERRAIN.SNOW) continue;
            let plant = false;
            let ridge = false;
            for (let e = 0; e < dirs.length; e++) {
              const q = nbr(p.x, p.y, dirs[e][0], dirs[e][1], cols, rows);
              if (!q) continue;
              const qt = game.baseTerrain[idx(q.x, q.y, cols)];
              if (passPlantable(qt)) plant = true;
              if (qt === TERRAIN.ROCK || qt === TERRAIN.SNOW) ridge = true;
            }
            if (plant && ridge) cands.push(ni);
          }
        }
      }
    });
    if (!cands.length) return null;
    const i = cands[randInt(cands.length)];
    if (game.baseTerrain[i] !== TERRAIN.ROCK) return null;
    if (!writeLand(game, i, TERRAIN.HIGHLAND)) return null;
    return "開出一條山口";
  }

  function ensureDriedRiver(game) {
    const n = game.baseTerrain.length;
    if (!game.driedRiver || game.driedRiver.length !== n) game.driedRiver = new Uint8Array(n);
  }

  function dikeGuardsCell(game, i) {
    const cols = game.cols;
    const x = i % cols;
    const y = (i - x) / cols;
    const towns = game.settlements || [];
    for (let t = 0; t < towns.length; t++) {
      const s = towns[t];
      if (s.trait !== "dike") continue;
      if (townDist(game, x, y, s) <= 2) return true;
    }
    if (game.dikeCells && game.dikeCells[i]) return true;
    if (game.civCells && game.civCells[i] && game.civCells[i].trait === "dike") return true;
    return false;
  }

  function applyYearSea(game) {
    if (!game.height || game.seaLevel == null) return null;
    if ((game.generation || 0) <= 0) return null;
    const origin = game.seaOrigin == null ? game.seaLevel : game.seaOrigin;
    const oldSea = game.seaLevel;
    let next = oldSea;
    if (game.coastRecedeLeft > 0) next = Math.min(next, oldSea - (1 + randInt(2)));
    else if (game.yearKind === "wet") next = oldSea + (2 + randInt(3));
    else if (game.yearKind === "dry") next = oldSea - (2 + randInt(3));
    else if (oldSea > origin) next = oldSea - 1;
    else if (oldSea < origin) next = oldSea + 1;
    next = Math.max(origin - (game.coastRecedeLeft > 0 ? 14 : 8), Math.min(origin + 8, next));
    if (next === oldSea) return null;
    const lo = Math.min(oldSea, next);
    const hi = Math.max(oldSea, next);
    const cands = [];
    for (let i = 0; i < game.baseTerrain.length; i++) {
      const h = game.height[i];
      if (h < lo || h >= hi) continue;
      cands.push(i);
    }
    cands.sort(function (a, b) {
      return next > oldSea ? game.height[a] - game.height[b] : game.height[b] - game.height[a];
    });
    const cap = next > oldSea ? 48 : cands.length;
    let n = 0;
    for (let k = 0; k < cands.length && n < cap; k++) {
      const i = cands[k];
      if (next > oldSea) {
        if (game.baseTerrain[i] === TERRAIN.WATER) continue;
        if (game.baseTerrain[i] === TERRAIN.ROCK || game.baseTerrain[i] === TERRAIN.SNOW || game.baseTerrain[i] === TERRAIN.HIGHLAND) continue;
        if (dikeGuardsCell(game, i)) continue;
        game.baseTerrain[i] = TERRAIN.WATER;
        if (game.terrain[i] !== TERRAIN.ICE) game.terrain[i] = TERRAIN.WATER;
        if (game.life) game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
        wipeRes(game, i);
        n++;
      } else if (isOcean(game, i) && writeFromOcean(game, i, TERRAIN.MARSH)) {
        n++;
      }
    }
    game.seaLevel = next;
    if (!n) return null;
    return next > oldSea ? "海面漲了" : "潮退露出灘";
  }

  function shiftMonsoonRain(game) {
    if (!game.monsoon) return null;
    if (!game.monsoonBase) game.monsoonBase = cloneMonsoon(game.monsoon);
    if (Math.random() > 0.34) {
      game.monsoon = cloneMonsoon(game.monsoonBase);
      game.monsoonShifted = false;
      return null;
    }
    game.monsoon = turnMonsoon90(game.monsoonBase);
    game.monsoonShifted = true;
    return "季風轉向";
  }

  function restoreMonsoonBase(game) {
    if (game.monsoonBase) game.monsoon = cloneMonsoon(game.monsoonBase);
    game.monsoonShifted = false;
  }

  function shrinkDryRivers(game) {
    ensureDriedRiver(game);
    restoreDryRivers(game, false);
    const cols = game.cols;
    const rows = game.rows;
    const base = game.baseTerrain;
    const keepRatio = game.yearKind === "dry" ? 0.3 : 0.5;
    const seen = new Uint8Array(base.length);
    let dried = 0;
    for (let s = 0; s < base.length; s++) {
      if (base[s] !== TERRAIN.RIVER || seen[s]) continue;
      if (game.terrain[s] === TERRAIN.ICE) continue;
      const cells = [];
      const stack = [s];
      seen[s] = 1;
      let mouth = false;
      while (stack.length) {
        const cur = stack.pop();
        cells.push(cur);
        if (touchesWater(base, cols, rows, cur)) mouth = true;
        const x = cur % cols;
        const y = (cur - x) / cols;
        for (let d = 0; d < 8; d++) {
          const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          if (seen[ni] || base[ni] !== TERRAIN.RIVER) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (!mouth || cells.length < 6) continue;
      const dist = {};
      const parent = {};
      const q = [];
      for (let k = 0; k < cells.length; k++) {
        if (!touchesWater(base, cols, rows, cells[k])) continue;
        dist[cells[k]] = 0;
        q.push(cells[k]);
      }
      for (let h = 0; h < q.length; h++) {
        const cur = q[h];
        const x = cur % cols;
        const y = (cur - x) / cols;
        for (let d = 0; d < 8; d++) {
          const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          if (base[ni] !== TERRAIN.RIVER || dist[ni] != null) continue;
          dist[ni] = dist[cur] + 1;
          parent[ni] = cur;
          q.push(ni);
        }
      }
      let far = cells[0];
      let farD = -1;
      for (let k = 0; k < cells.length; k++) {
        const d0 = dist[cells[k]];
        if (d0 == null) continue;
        if (d0 > farD) {
          farD = d0;
          far = cells[k];
        }
      }
      const keep = {};
      const keepN = Math.max(3, Math.ceil(cells.length * keepRatio));
      let walk = far;
      const path = [];
      const guard = {};
      while (walk != null && !guard[walk]) {
        guard[walk] = 1;
        path.push(walk);
        walk = parent[walk];
      }
      path.reverse();
      const start = Math.max(0, path.length - keepN);
      for (let k = start; k < path.length; k++) keep[path[k]] = 1;
      for (let k = 0; k < cells.length; k++) {
        if (touchesWater(base, cols, rows, cells[k])) keep[cells[k]] = 1;
      }
      for (let k = 0; k < cells.length; k++) {
        const i = cells[k];
        if (keep[i]) continue;
        if (game.terrain[i] === TERRAIN.ICE) continue;
        game.driedRiver[i] = 1;
        game.terrain[i] = TERRAIN.SAND;
        dried++;
      }
    }
    if (!dried) return null;
    return "河枯成一線";
  }

  function restoreDryRivers(game, refill) {
    if (!game.driedRiver) return null;
    const cols = game.cols;
    const rows = game.rows;
    let n = 0;
    const restored = [];
    for (let i = 0; i < game.driedRiver.length; i++) {
      if (!game.driedRiver[i]) continue;
      game.driedRiver[i] = 0;
      if (game.baseTerrain[i] === TERRAIN.RIVER) {
        game.terrain[i] = TERRAIN.RIVER;
        if (game.life) game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
        wipeRes(game, i);
        restored.push(i);
        n++;
      }
    }
    if (refill && game.yearKind === "wet") {
      let extra = 0;
      for (let k = 0; k < restored.length && extra < 6; k++) {
        const i = restored[k];
        const x = i % cols;
        const y = (i - x) / cols;
        for (let d = 0; d < 4 && extra < 6; d++) {
          const p = nbr(x, y, FLOW_DIRS[d][0], FLOW_DIRS[d][1], cols, rows);
          if (!p) continue;
          const ni = idx(p.x, p.y, cols);
          if (!canCarveRiverOn(game.baseTerrain[ni])) continue;
          if (game.life && game.life[ni]) continue;
          if (writeLand(game, ni, TERRAIN.RIVER)) extra++;
        }
      }
    }
    return n ? "乾河又來了水" : null;
  }

  function fillShallowSea(game) {
    if ((game.generation || 0) % 8 !== 0) return null;
    const cols = game.cols;
    const rows = game.rows;
    const towns = (game.settlements || []).filter(function (s) {
      return (s.age || 0) >= 25 && townStainDeep(game, s);
    });
    if (!towns.length) return null;
    const s = towns[randInt(towns.length)];
    const cands = [];
    const seen = {};
    for (let k = 0; k < 36; k++) {
      const x = wrap(Math.round(s.cx) + randInt(21) - 10, cols);
      const y = Math.round(s.cy) + randInt(21) - 10;
      if (!inY(y, rows)) continue;
      const i = idx(x, y, cols);
      if (seen[i]) continue;
      seen[i] = 1;
      if (!isShallowOcean(game, i)) continue;
      if (game.life && game.life[i]) continue;
      if (game.raftCells && game.raftCells[i]) continue;
      cands.push(i);
    }
    if (!cands.length) return null;
    let chance = 0.14;
    if (s.trait === "dike" || s.trait === "expand") chance = 0.26;
    if (game.yearKind === "dry") chance += 0.08;
    if (Math.random() > chance) return null;
    const i = cands[randInt(cands.length)];
    if (!writeFromOcean(game, i, TERRAIN.MARSH)) return null;
    return "有人填了一小塊海";
  }

  function spreadGrove(game, count) {
    const m = game.monsoon;
    const ux = m ? -m.dx : 0;
    const uy = m ? -m.dy : 0;
    const cols = game.cols;
    const rows = game.rows;
    let n = 0;
    for (let k = 0; k < count; k++) {
      const i = sampleCell(game, function (j) {
        return game.baseTerrain[j] === TERRAIN.GROVE;
      }, 28);
      if (i < 0) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      const dirs = [[ux, uy], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let d = 0; d < dirs.length; d++) {
        const p = nbr(x, y, dirs[d][0], dirs[d][1], cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        if (game.stain && game.stain[ni] >= 8) continue;
        if (game.life && game.life[ni] && Math.random() < 0.7) continue;
        const t = game.baseTerrain[ni];
        if (t === TERRAIN.SAND) {
          if (isDesertCore(game, ni)) continue;
          if (writeLand(game, ni, TERRAIN.SOIL)) n++;
          break;
        }
        if (t === TERRAIN.SOIL || t === TERRAIN.FERTILE) {
          if (writeLand(game, ni, TERRAIN.GROVE)) n++;
          break;
        }
      }
    }
    return n;
  }

  function spreadSand(game, count) {
    const m = game.monsoon;
    const dx = m ? m.dx : 0;
    const dy = m ? m.dy : 0;
    const cols = game.cols;
    const rows = game.rows;
    let n = 0;
    for (let k = 0; k < count; k++) {
      const i = sampleCell(game, function (j) {
        if (game.baseTerrain[j] !== TERRAIN.SAND) return false;
        const x = j % cols;
        const y = (j - x) / cols;
        const ck = coastCurrentKind(game.current, game.baseTerrain, x, y, cols, rows);
        const shadow = rainShadowDist(game.baseTerrain, game.height, game.monsoon, x, y, cols, rows);
        if (game.yearKind === "dry" || ck === CURRENT.COLD || shadow) return true;
        return Math.random() < 0.45;
      }, 40);
      if (i < 0) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      const dirs = [
        [dx, dy],
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (let d = 0; d < dirs.length; d++) {
        const p = nbr(x, y, dirs[d][0], dirs[d][1], cols, rows);
        if (!p) continue;
        const ni = idx(p.x, p.y, cols);
        if (game.stain && game.stain[ni] >= 8) continue;
        if (game.civCells && game.civCells[ni]) continue;
        if (game.life && game.life[ni] && Math.random() < 0.75) continue;
        const t = game.baseTerrain[ni];
        if (t !== TERRAIN.GROVE && t !== TERRAIN.SOIL && t !== TERRAIN.FERTILE) continue;
        const ck = coastCurrentKind(game.current, game.baseTerrain, p.x, p.y, cols, rows);
        if (ck === CURRENT.WARM && Math.random() < 0.7) continue;
        if (writeLand(game, ni, TERRAIN.SAND)) n++;
        break;
      }
    }
    return n;
  }

  function shrinkSand(game, count) {
    const cols = game.cols;
    const rows = game.rows;
    let n = 0;
    for (let k = 0; k < count; k++) {
      const i = sampleCell(game, function (j) {
        if (game.baseTerrain[j] !== TERRAIN.SAND) return false;
        if (game.stain && game.stain[j] >= 8) return false;
        if (game.civCells && game.civCells[j]) return false;
        if (game.life && game.life[j] && Math.random() < 0.65) return false;
        if (isDesertCore(game, j)) return false;
        const x = j % cols;
        const y = (j - x) / cols;
        const ck = coastCurrentKind(game.current, game.baseTerrain, x, y, cols, rows);
        if (ck === CURRENT.COLD) return false;
        const shadow = rainShadowDist(game.baseTerrain, game.height, game.monsoon, x, y, cols, rows);
        if (shadow && ck !== CURRENT.WARM && Math.random() < 0.65) return false;
        return true;
      }, 45);
      if (i < 0) continue;
      if (writeLand(game, i, TERRAIN.SOIL)) n++;
    }
    return n;
  }

  function driftTerrain(game, seasonId) {
    tickRiverRisk(game);
    const cols = game.cols;
    const rows = game.rows;
    const notes = [];
    const vis = game.terrain;
    const base = game.baseTerrain;

    function xy(i) {
      const x = i % cols;
      return { x: x, y: (i - x) / cols };
    }

    function tryEnrich(count) {
      let n = 0;
      for (let k = 0; k < count; k++) {
        const i = sampleCell(game, function (j) {
          if (base[j] !== TERRAIN.SOIL) return false;
          if (game.life && game.life[j] && Math.random() < 0.7) return false;
          const p = xy(j);
          return nearWet(vis, p.x, p.y, cols, rows) || nearWet(base, p.x, p.y, cols, rows);
        }, 35);
        if (i < 0) continue;
        if (writeLand(game, i, TERRAIN.FERTILE)) n++;
      }
      return n;
    }

    function tryDessicate(count, protectShore) {
      let n = 0;
      for (let k = 0; k < count; k++) {
        const i = sampleCell(game, function (j) {
          if (base[j] !== TERRAIN.FERTILE) return false;
          const p = xy(j);
          if (protectShore && nearSea(base, p.x, p.y, cols, rows)) return false;
          if (!protectShore && nearWet(base, p.x, p.y, cols, rows) && Math.random() < 0.7) return false;
          return true;
        }, 40);
        if (i < 0) continue;
        if (writeLand(game, i, TERRAIN.SOIL)) n++;
      }
      return n;
    }

    function tryWeather(count) {
      let n = 0;
      for (let k = 0; k < count; k++) {
        const i = sampleCell(game, function (j) {
          if (base[j] !== TERRAIN.ROCK) return false;
          const p = xy(j);
          return nearWet(base, p.x, p.y, cols, rows) || nearWet(vis, p.x, p.y, cols, rows);
        }, 40);
        if (i < 0) continue;
        if (writeLand(game, i, TERRAIN.SOIL)) n++;
      }
      return n;
    }

    const areaMul = (cols * rows) / (200 * 120);
    if (seasonId === "rain") {
      if (tryEnrich(3 + randInt(3)) > 2) notes.push("雨水讓岸邊變肥");
      tryWeather(Math.random() < 0.45 ? 1 : 0);
      const groves = spreadGrove(game, 2 + randInt(3) + (game.yearKind === "wet" ? 1 : 0));
      if (groves > 1) notes.push("林往前長");
      let shrinkN = 5 + randInt(6) + (game.yearKind === "wet" ? 5 : 0) - (game.yearKind === "dry" ? 2 : 0);
      shrinkN = Math.max(2, Math.round(shrinkN * areaMul));
      const faded = shrinkSand(game, shrinkN);
      if (faded > 2) notes.push("沙漠退了");
      if (game.monsoonShifted) {
        const flip = spreadSand(game, Math.max(2, Math.round((3 + randInt(3)) * areaMul)));
        if (flip > 1 && faded <= 2) notes.push("沙往新的背風堆");
      }
    } else if (seasonId === "drought") {
      if (tryDessicate(2 + randInt(3), true) > 1) notes.push("沃土退了");
      let sandN = 8 + randInt(8) + (game.yearKind === "dry" ? 6 : 0) - (game.yearKind === "wet" ? 3 : 0);
      if (game.climateKind === "hot") sandN = Math.round(sandN * 1.85);
      sandN = Math.max(3, Math.round(sandN * areaMul));
      const sands = spreadSand(game, sandN);
      if (sands > 4) notes.push("沿岸起了旱");
      else if (sands > 1) notes.push("沙埋了地");
    } else if (seasonId === "warm") {
      tryEnrich(1);
      tryDessicate(1, false);
      if (game.yearKind === "dry") spreadSand(game, Math.max(1, Math.round(2 * areaMul)));
      else shrinkSand(game, Math.max(1, Math.round(1 * areaMul)));
    }

    if (seasonId !== "winter" && seasonId !== "drought") {
      const civRiver = (game.settlements || []).some(function (s) {
        return s.trait === "dike" || s.trait === "expand" || (s.size || 0) >= 16;
      });
      const every = civRiver ? 4 : 6;
      if (game.generation % every === 0) {
        const moved = meanderRiver(game);
        if (moved) notes.push(moved);
      }
      const filled = fillRiverLand(game);
      if (filled) notes.push(filled);
    }

    if (seasonId !== "flood" && game.generation % 5 === 0) {
      const lake = civDrawLake(game);
      if (lake) notes.push(lake);
    }

    if (seasonId !== "winter") {
      const silt = siltRiverMouth(game, game.generation || 0);
      if (silt) notes.push(silt);
      const filledSea = fillShallowSea(game);
      if (filledSea) notes.push(filledSea);
    }
    const terr = terraceHighlands(game);
    if (terr) notes.push(terr);
    const pass = carveMountainPass(game);
    if (pass) notes.push(pass);

    const civ = game.civCells || {};
    for (let k = 0; k < 8; k++) {
      const i = sampleCell(game, function (j) {
        return !!(civ[j] && base[j] === TERRAIN.SOIL);
      }, 20);
      if (i < 0) break;
      if (Math.random() < 0.35) writeLand(game, i, TERRAIN.FERTILE);
    }
    if (game.hungry) {
      for (let k = 0; k < 6; k++) {
        const i = sampleCell(game, function (j) {
          return !!(game.life[j] && base[j] === TERRAIN.FERTILE);
        }, 25);
        if (i < 0) break;
        if (Math.random() < 0.4) writeLand(game, i, TERRAIN.SOIL);
      }
    }

    return notes.length ? notes.join(" · ") : null;
  }

  function lifeNear(game, x, y, r) {
    const cols = game.cols;
    const rows = game.rows;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const ny = y + dy;
        if (!inY(ny, rows)) continue;
        const nx = wrap(x + dx, cols);
        if (game.life[idx(nx, ny, cols)]) return true;
      }
    }
    return false;
  }

  function growWildStocks(game, seasonId) {
    if (!game.resources) return;
    if (!game.resAmt || game.resAmt.length !== game.resources.length) {
      game.resAmt = new Uint8Array(game.resources.length);
      for (let i = 0; i < game.resources.length; i++) {
        if (game.resources[i] && !game.resAmt[i]) game.resAmt[i] = 1;
      }
    }
    if (!game.ore || game.ore.length !== game.resources.length) game.ore = new Uint8Array(game.resources.length);
    const cols = game.cols;
    const rows = game.rows;
    let max = Math.round(((SEASONS[game.season] || {}).maxRes || 80) * (cols * rows) / (200 * 120));
    if (game.glacialLeft) max = Math.round(max * 0.35);
    for (let i = 0; i < game.resources.length; i++) {
      if (!game.resources[i]) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      const near = lifeNear(game, x, y, 3);
      const stain = game.stain && game.stain[i] >= 4;
      if (seasonId === "flood" && (game.terrain[i] === TERRAIN.WATER || game.terrain[i] === TERRAIN.RIVER)) {
        wipeRes(game, i);
        continue;
      }
      if (game.glacialLeft && game.resources[i] === RESOURCE.CRYSTAL && Math.random() < 0.08) {
        if (game.resAmt[i] > 1) game.resAmt[i] -= 1;
        else wipeRes(game, i);
        continue;
      }
      if (seasonId === "drought") {
        if (Math.random() < (near || stain ? 0.55 : 0.28)) {
          if (game.resAmt[i] > 1) game.resAmt[i] -= 1;
          else wipeRes(game, i);
        }
      } else if (seasonId === "winter") {
        if (game.resAmt[i] > 1 && Math.random() < 0.1) game.resAmt[i] -= 1;
      } else if (!near && !stain && game.resAmt[i] < 3) {
        const grow = seasonId === "rain" ? 0.42 : 0.16;
        if (Math.random() < grow) game.resAmt[i] += 1;
      }
    }
    if (seasonId === "winter" || seasonId === "drought" || seasonId === "flood") return;
    let current = countResources(game.resources);
    const areaMul = (cols * rows) / (200 * 120);
    const tries = Math.round((seasonId === "rain" ? 28 : 14) * areaMul * (game.glacialLeft ? 0.4 : 1));
    for (let k = 0; k < tries && current < max; k++) {
      const x = randInt(cols);
      const y = randInt(rows);
      if (lifeNear(game, x, y, 2)) continue;
      const i = idx(x, y, cols);
      if (game.stain && game.stain[i] >= 4) continue;
      const t = game.terrain[i];
      if (t === TERRAIN.ROCK || t === TERRAIN.WATER || t === TERRAIN.RIVER || t === TERRAIN.SNOW || t === TERRAIN.ICE) continue;
      if (game.resources[i]) continue;
      let p = 0.12;
      let crystal = 0.28;
      if (t === TERRAIN.GROVE || t === TERRAIN.MARSH || t === TERRAIN.FERTILE) p = 0.42;
      else if (t === TERRAIN.SOIL) p = 0.24;
      else if (t === TERRAIN.SAND) p = 0.07;
      else if (t === TERRAIN.HIGHLAND) {
        p = 0.16;
        crystal = 0.55;
      }
      if (game.glacialLeft) {
        p *= 0.45;
        crystal *= 0.4;
      }
      if (Math.random() > p) continue;
      const kind = Math.random() < crystal ? RESOURCE.CRYSTAL : RESOURCE.NUTRIENT;
      game.resources[i] = kind;
      game.resAmt[i] = 1;
      if (kind === RESOURCE.CRYSTAL && (t === TERRAIN.HIGHLAND || isRockAdjacent(game.terrain, x, y, cols, rows)) && Math.random() < 0.38) {
        game.ore[i] = 1;
      }
      current++;
    }
  }

  const EPOCH_LEAD = 14;

  function forceTerrain(game, i, type, minH) {
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    if (isOcean(game, i)) {
      const ok = writeFromOcean(game, i, type === TERRAIN.SAND ? TERRAIN.HIGHLAND : type);
      if (ok && minH) ensureHeight(game, i, minH);
      return ok;
    }
    if (type === TERRAIN.WATER) return false;
    const vis = game.terrain[i];
    game.baseTerrain[i] = type;
    if (minH) ensureHeight(game, i, minH);
    if (vis !== TERRAIN.ICE) game.terrain[i] = type;
    if (type === TERRAIN.ROCK || type === TERRAIN.SNOW) {
      if (game.life) game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
      wipeRes(game, i);
    }
    return true;
  }

  function pickEpochLand(game) {
    const hits = [];
    for (let i = 0; i < game.baseTerrain.length; i++) {
      const t = game.baseTerrain[i];
      if (t === TERRAIN.WATER || t === TERRAIN.SNOW) continue;
      if (hits.length > 220 && Math.random() > 0.2) continue;
      hits.push(i);
    }
    if (!hits.length) return -1;
    return hits[Math.floor(Math.random() * hits.length)];
  }

  function coastTsunami(game) {
    const cache = (game.skillCells && game.skillCells.cache) || {};
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const path = {};
    if (!game.life) return;
    for (let i = 0; i < game.life.length; i++) {
      if (!game.life[i] || cache[i]) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      let wet = false;
      for (let d = 0; d < 4; d++) {
        const p = nbr(x, y, dirs[d][0], dirs[d][1], game.cols, game.rows);
        if (!p) continue;
        const t = game.terrain[idx(p.x, p.y, game.cols)];
        if (t === TERRAIN.WATER || t === TERRAIN.RIVER || t === TERRAIN.ICE) {
          wet = true;
          break;
        }
      }
      if (!wet) continue;
      path[i] = 1;
      game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
    }
    game.stormPath = path;
    game.stormDir = { dx: 1, dy: 0 };
    game.stormTint = Math.max(game.stormTint || 0, 14);
  }

  function nextVolcanoAt(game) {
    return (game.generation || 0) + 1800 + Math.floor(Math.random() * 401);
  }

  function volcanoChance(game) {
    return Math.min(0.9, 0.42 + (game.volcanoMiss || 0) * 0.16);
  }

  function fireMegaVolcano(game, events) {
    const at = pickEpochLand(game);
    if (at < 0) return;
    const level = game.volcanoMiss || 0;
    const mul = 1 + 0.2 * level;
    const cols = game.cols;
    const ox = at % cols;
    const oy = (at - ox) / cols;
    const scale = Math.sqrt((cols * game.rows) / (200 * 120));
    const r = Math.round((18 + Math.floor(Math.random() * 11)) * Math.max(0.9, Math.min(1.4, scale)) * mul);
    const r2 = r * r;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    const midKill = Math.min(0.92, 0.62 + level * 0.08);
    const farKill = Math.min(0.88, 0.48 + level * 0.08);
    if (!game.caldera) game.caldera = {};
    for (let i = 0; i < game.baseTerrain.length; i++) {
      const x = i % cols;
      const y = (i - x) / cols;
      const ddx = wrapDelta(x, ox, cols);
      const ddy = Math.abs(y - oy);
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 > r2) continue;
      const d = Math.sqrt(d2);
      if (d <= r * 0.28) {
        forceTerrain(game, i, y / Math.max(1, game.rows - 1) < 0.28 && Math.random() < 0.35 ? TERRAIN.SNOW : TERRAIN.ROCK, sea + 22);
        game.caldera[i] = 1;
        if (game.life) game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
      } else if (d <= r * 0.55) {
        const north = y / Math.max(1, game.rows - 1) < 0.3;
        forceTerrain(game, i, north && Math.random() < 0.22 ? TERRAIN.SNOW : TERRAIN.HIGHLAND, sea + 14);
        game.caldera[i] = 2;
        if (game.life) {
          game.life[i] = 0;
          if (game.owner) game.owner[i] = 0;
        }
      } else if (d <= r * 0.78) {
        const b = game.baseTerrain[i];
        if (b === TERRAIN.GROVE || b === TERRAIN.FERTILE || b === TERRAIN.SOIL) {
          forceTerrain(game, i, TERRAIN.SAND, 0);
          game.caldera[i] = 3;
        }
        if (game.life && game.life[i] && Math.random() < midKill) {
          game.life[i] = 0;
          if (game.owner) game.owner[i] = 0;
        }
      } else if (game.life && game.life[i] && Math.random() < farKill) {
        game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
      }
    }
    game.quakeTint = 18;
    game.quakeRing = { x: ox, y: oy, r: r, tint: 14 };
    game.extremeTint = Math.max(game.extremeTint || 0, 14);
    coastTsunami(game);
    if (level >= 2) coastTsunami(game);
    game.glacialLeft = 100 + level * 40 + Math.floor(Math.random() * 41);
    game.iceAge = true;
    freezeRivers(game, true);
    game.calderaCoolLeft = 0;
    game.volcanoMiss = 0;
    game.epochVolcano = "pending";
    game.epochVolcanoAt = nextVolcanoAt(game);
    events.push(level ? "某地火山爆發，這回山抬得更高" : "某地火山爆發，山抬起來了");
    events.push("海嘯打上諸岸");
    events.push("中冰期開始");
  }

  function coolCaldera(game, events) {
    if (!game.caldera) return;
    Object.keys(game.caldera).forEach(function (key) {
      const i = Number(key);
      const t = game.baseTerrain[i];
      if (t === TERRAIN.ROCK || t === TERRAIN.SNOW || t === TERRAIN.SAND) {
        forceTerrain(game, i, TERRAIN.HIGHLAND, 0);
      }
    });
    game.caldera = {};
    events.push("火山地帶冷卻，可以上去了");
  }

  function fireMegaClimate(game, events) {
    const left = 100 + Math.floor(Math.random() * 61);
    if (Math.random() < 0.5) {
      game.climateKind = "hot";
      game.climateLeft = left;
      game.yearKind = "dry";
      game.pestYear = false;
      const sea = applyYearSea(game);
      if (sea) events.push(sea);
      events.push("全球酷熱乾旱");
    } else {
      game.climateKind = "cold";
      game.climateLeft = left;
      game.glacialLeft = Math.max(game.glacialLeft || 0, left);
      game.iceAge = true;
      freezeRivers(game, true);
      const rows = game.rows;
      for (let i = 0; i < game.baseTerrain.length; i++) {
        const y = Math.floor(i / game.cols);
        if (y / Math.max(1, rows - 1) > 0.38) continue;
        if (game.baseTerrain[i] !== TERRAIN.HIGHLAND) continue;
        if (Math.random() > 0.08) continue;
        forceTerrain(game, i, TERRAIN.SNOW, 0);
      }
      events.push("全球嚴寒");
    }
  }

  function tickRidgeDrift(game, events) {
    if ((game.generation || 0) % 12 !== 0) return;
    const dx = game.driftDx || 0;
    if (!dx) return;
    const cols = game.cols;
    const rows = game.rows;
    let n = 0;
    for (let i = 0; i < game.baseTerrain.length; i++) {
      const t = game.baseTerrain[i];
      if (t !== TERRAIN.ROCK && t !== TERRAIN.HIGHLAND && t !== TERRAIN.SNOW) continue;
      if (Math.random() > 0.045) continue;
      const x = i % cols;
      const y = (i - x) / cols;
      const nx = wrap(x + dx, cols);
      const ny = y;
      if (ny < 6 || ny > rows - 8) continue;
      const ni = idx(nx, ny, cols);
      const destT = game.baseTerrain[ni];
      if (destT === TERRAIN.SNOW && t !== TERRAIN.SNOW) continue;
      if (isOcean(game, ni) && !isShallowOcean(game, ni)) continue;
      forceTerrain(game, ni, t, game.height ? game.height[i] : 0);
      const down = t === TERRAIN.ROCK || t === TERRAIN.SNOW ? TERRAIN.HIGHLAND : TERRAIN.SOIL;
      forceTerrain(game, i, down, 0);
      n += 1;
      if (n > 28) break;
    }
    if (n > 6 && Math.random() < 0.45) {
      events.push(dx > 0 ? "山脈往東移了一截" : "山脈往西移了一截");
    }
  }

  function fireEpochShore(game, events) {
    if ((game.glacialLeft || 0) <= 0 && Math.random() < 0.5) {
      game.coastRecedeLeft = 90 + Math.floor(Math.random() * 41);
      game.yearKind = "dry";
      const note = applyYearSea(game);
      if (note) events.push(note);
      events.push("岸線大退");
      return;
    }
    game.swampAgeLeft = 80 + Math.floor(Math.random() * 41);
    expandLowMarshes(game, 36);
    events.push("湖沼擴張");
  }

  function expandLowMarshes(game, cap) {
    if (!game.baseTerrain || !game.height) return 0;
    const sea = game.seaLevel == null ? 100 : game.seaLevel;
    let n = 0;
    for (let k = 0; k < 220 && n < cap; k++) {
      const i = randInt(game.baseTerrain.length);
      const t = game.baseTerrain[i];
      if (t !== TERRAIN.SOIL && t !== TERRAIN.FERTILE && t !== TERRAIN.GROVE) continue;
      if (game.height[i] > sea + 6) continue;
      if (Math.random() > 0.45) continue;
      writeLand(game, i, TERRAIN.MARSH);
      n += 1;
    }
    return n;
  }

  function resolveEpochSlot(game, key, at, chance, coming, events) {
    const g = game.generation || 0;
    const st = game[key];
    if (st !== "pending" && st !== "coming") return;
    if (g < at - EPOCH_LEAD) return;
    if (st === "pending") {
      if (Math.random() < chance) {
        game[key] = "coming";
        game.epochOmen = coming;
        if (coming === "shore") events.push("岸將遷");
      } else if (key === "epochVolcano") {
        game.volcanoMiss = (game.volcanoMiss || 0) + 1;
        game.epochVolcano = "pending";
        game.epochVolcanoAt = nextVolcanoAt(game);
        if (game.epochOmen === coming) game.epochOmen = null;
        events.push("這回山沒裂，下回會更兇");
      } else {
        game[key] = "skipped";
        if (game.epochOmen === coming) game.epochOmen = null;
      }
      return;
    }
    if (g < at) return;
    game.epochOmen = null;
    game[key] = "fired";
    if (key === "epochVolcano") fireMegaVolcano(game, events);
    else if (key === "epochClimate") fireMegaClimate(game, events);
    else if (key === "epochShore") fireEpochShore(game, events);
    else if (key === "epochDrift") {
      game.driftDx = Math.random() < 0.5 ? 1 : -1;
      events.push(game.driftDx > 0 ? "山脈開始往東蠕動" : "山脈開始往西蠕動");
    }
  }

  function tickEpochs(game) {
    const events = [];
    if (!game.epochVolcano) game.epochVolcano = "pending";
    if (game.epochVolcanoAt == null) game.epochVolcanoAt = 1820 + Math.floor(Math.random() * 361);
    if (game.epochClimateAt == null) game.epochClimateAt = 5750 + Math.floor(Math.random() * 501);
    if (game.epochDriftAt == null) game.epochDriftAt = 7800 + Math.floor(Math.random() * 401);
    if (!game.epochShore) game.epochShore = "pending";
    if (game.epochShoreAt == null) game.epochShoreAt = 9800 + Math.floor(Math.random() * 601);
    if (game.epochVolcano === "skipped") {
      game.volcanoMiss = Math.max(game.volcanoMiss || 0, 1);
      game.epochVolcano = "pending";
      game.epochVolcanoAt = nextVolcanoAt(game);
    }
    resolveEpochSlot(game, "epochVolcano", game.epochVolcanoAt, volcanoChance(game), "volcano", events);
    resolveEpochSlot(game, "epochClimate", game.epochClimateAt, 0.4, "climate", events);
    resolveEpochSlot(game, "epochDrift", game.epochDriftAt, 0.5, "drift", events);
    resolveEpochSlot(game, "epochShore", game.epochShoreAt, 0.45, "shore", events);
    if ((game.glacialLeft || 0) > 0) {
      game.glacialLeft -= 1;
      game.iceAge = true;
      if (game.generation % 4 === 0) freezeRivers(game, true);
      if (game.glacialLeft <= 0) {
        game.glacialLeft = 0;
        if (game.climateKind !== "cold") {
          thawRivers(game);
          game.iceAge = false;
        }
        events.push("中冰期結束");
        if (game.caldera && Object.keys(game.caldera).length) {
          game.calderaCoolLeft = 40 + Math.floor(Math.random() * 31);
        }
      }
    }
    if ((game.calderaCoolLeft || 0) > 0) {
      game.calderaCoolLeft -= 1;
      if (game.calderaCoolLeft <= 0) coolCaldera(game, events);
    }
    if ((game.climateLeft || 0) > 0) {
      game.climateLeft -= 1;
      if (game.climateKind === "hot") game.yearKind = "dry";
      if (game.climateKind === "cold") {
        game.iceAge = true;
        if (game.generation % 4 === 0) freezeRivers(game, true);
      }
      if (game.climateLeft <= 0) {
        const kind = game.climateKind;
        game.climateKind = null;
        if (kind === "cold" && !(game.glacialLeft > 0)) {
          thawRivers(game);
          game.iceAge = false;
        }
        events.push(kind === "hot" ? "酷熱消退" : "嚴寒消退");
      }
    }
    if (game.epochDrift === "fired") tickRidgeDrift(game, events);
    if ((game.coastRecedeLeft || 0) > 0) {
      game.coastRecedeLeft -= 1;
      if (game.generation % 6 === 0) {
        const note = applyYearSea(game);
        if (note) events.push(note);
      }
      if (game.coastRecedeLeft <= 0) events.push("岸線漸漸回來了");
    }
    if ((game.swampAgeLeft || 0) > 0) {
      game.swampAgeLeft -= 1;
      if (game.generation % 5 === 0) expandLowMarshes(game, 8);
      if (game.swampAgeLeft <= 0) events.push("湖沼退了一截");
    }
    return events;
  }

  global.LifeWorld = {
    TERRAIN: TERRAIN,
    RESOURCE: RESOURCE,
    CURRENT: CURRENT,
    TERRAIN_LIFE: TERRAIN_LIFE,
    SEASONS: SEASONS,
    SEASON_LENGTH: SEASON_LENGTH,
    idx: idx,
    wrap: wrap,
    monsoonLabel: monsoonLabel,
    yearKindLabel: yearKindLabel,
    inY: inY,
    isRockAdjacent: isRockAdjacent,
    surviveMax: surviveMax,
    generateWorld: generateWorld,
    respawnResources: respawnResources,
    countResources: countResources,
    restoreTerrain: restoreTerrain,
    applyFlood: applyFlood,
    writeLand: writeLand,
    writeFromOcean: writeFromOcean,
    isShallowOcean: isShallowOcean,
    spawnVolcanoIsle: spawnVolcanoIsle,
    freezeRivers: freezeRivers,
    thawRivers: thawRivers,
    applyYearSea: applyYearSea,
    shiftMonsoonRain: shiftMonsoonRain,
    restoreMonsoonBase: restoreMonsoonBase,
    shrinkDryRivers: shrinkDryRivers,
    restoreDryRivers: restoreDryRivers,
    driftTerrain: driftTerrain,
    floodSilt: floodSilt,
    thawMud: thawMud,
    spawnTownBounty: spawnTownBounty,
    growWildStocks: growWildStocks,
    tickEpochs: tickEpochs,
  };
})(window);

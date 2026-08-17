(function (global) {
  const W = global.LifeWorld;
  const TERRAIN = W.TERRAIN;
  const RESOURCE = W.RESOURCE;

  const MAP_SIZES = [
    { id: "small", cols: 200, rows: 120, name: "小", note: "較順" },
    { id: "medium", cols: 320, rows: 192, name: "中", note: "現況" },
    { id: "large", cols: 400, rows: 240, name: "大", note: "更細、較慢" },
  ];

  function normalizeSize(cols, rows) {
    const c = Number(cols);
    const r = Number(rows);
    for (let i = 0; i < MAP_SIZES.length; i++) {
      if (MAP_SIZES[i].cols === c && MAP_SIZES[i].rows === r) return MAP_SIZES[i];
    }
    return MAP_SIZES[1];
  }

  function allocBoard(game, cols, rows) {
    const n = cols * rows;
    game.cols = cols;
    game.rows = rows;
    game.life = new Uint8Array(n);
    game.next = new Uint8Array(n);
    game.owner = new Uint8Array(n);
    game.nextOwner = new Uint8Array(n);
  }
  const START_ENERGY = 30;
  const START_FOOD = 40;
  const FEED_RATIO = 10;
  const STARVE_CAP = 0.12;
  const CRYSTAL_ENERGY = 5;
  const CRYSTAL_FOOD = 12;

  function mapY(y, rows) {
    if (y < 0 || y >= rows) return -1;
    return y;
  }

  function resetClimate(game, packed) {
    game.terrain = packed.terrain;
    game.baseTerrain = new Uint8Array(packed.terrain);
    game.resources = packed.resources;
    game.life.fill(0);
    game.next.fill(0);
    if (game.owner) game.owner.fill(0);
    if (game.nextOwner) game.nextOwner.fill(0);
    game.generation = 0;
    game.energy = START_ENERGY;
    game.foods = { 0: START_FOOD };
    game.hungryBy = {};
    game.food = START_FOOD;
    game.hungry = false;
    game.season = 0;
    game.seasonAge = 0;
    game.flashes = [];
    game.skillCells = { cache: {}, hardy: {}, sprout: {} };
    game.skills = { cache: false, hardy: false, sprout: false, migrate: false };
    Object.assign(game, global.LifeCiv.emptyCivState());
    game.height = packed.height ? new Uint8Array(packed.height) : null;
    game.monsoon = packed.monsoon || null;
    game.monsoonBase = packed.monsoonBase || (packed.monsoon ? Object.assign({}, packed.monsoon) : null);
    game.monsoonShifted = false;
    game.worldNote = packed.note || "";
    game.seaLevel = packed.seaLevel;
    game.seaOrigin = packed.seaOrigin != null ? packed.seaOrigin : packed.seaLevel;
    game.current = packed.current ? new Uint8Array(packed.current) : null;
    const cells = game.cols * game.rows;
    game.resAmt = packed.resAmt ? new Uint8Array(packed.resAmt) : new Uint8Array(cells);
    game.iceAge = false;
    game.boatCells = {};
    game.raftCells = {};
    game.raftIdle = {};
    game.stain = new Uint8Array(cells);
    game.stainWho = new Uint8Array(cells);
    game.riverRisk = new Uint8Array(cells);
    game.driedRiver = new Uint8Array(cells);
    rollYear(game);
  }

  function createGame(cols, rows) {
    const size = normalizeSize(cols, rows);
    const packed = W.generateWorld(size.cols, size.rows);
    const game = {
      cols: size.cols,
      rows: size.rows,
      terrain: packed.terrain,
      baseTerrain: new Uint8Array(packed.terrain),
      resources: packed.resources,
      life: new Uint8Array(size.cols * size.rows),
      next: new Uint8Array(size.cols * size.rows),
      owner: new Uint8Array(size.cols * size.rows),
      nextOwner: new Uint8Array(size.cols * size.rows),
      generation: 0,
      energy: START_ENERGY,
      food: START_FOOD,
      foods: { 0: START_FOOD },
      hungryBy: {},
      season: 0,
      seasonAge: 0,
      flashes: [],
      hungry: false,
      skillCells: { cache: {}, hardy: {}, sprout: {} },
      skills: { cache: false, hardy: false, sprout: false, migrate: false },
    };
    Object.assign(game, global.LifeCiv.emptyCivState());
    game.height = packed.height ? new Uint8Array(packed.height) : null;
    game.monsoon = packed.monsoon || null;
    game.monsoonBase = packed.monsoonBase || (packed.monsoon ? Object.assign({}, packed.monsoon) : null);
    game.monsoonShifted = false;
    game.worldNote = packed.note || "";
    game.seaLevel = packed.seaLevel;
    game.seaOrigin = packed.seaOrigin != null ? packed.seaOrigin : packed.seaLevel;
    const cells = size.cols * size.rows;
    game.current = packed.current ? new Uint8Array(packed.current) : null;
    game.resAmt = packed.resAmt ? new Uint8Array(packed.resAmt) : new Uint8Array(cells);
    game.iceAge = false;
    game.boatCells = {};
    game.raftCells = {};
    game.raftIdle = {};
    game.stain = new Uint8Array(cells);
    game.stainWho = new Uint8Array(cells);
    game.riverRisk = new Uint8Array(cells);
    game.driedRiver = new Uint8Array(cells);
    rollYear(game);
    return game;
  }

  function newMap(game) {
    resetClimate(game, W.generateWorld(game.cols, game.rows));
  }

  function resizeMap(game, cols, rows) {
    const size = normalizeSize(cols, rows);
    allocBoard(game, size.cols, size.rows);
    resetClimate(game, W.generateWorld(size.cols, size.rows));
  }

  function clearLife(game) {
    game.life.fill(0);
    if (game.owner) game.owner.fill(0);
    if (game.nextOwner) game.nextOwner.fill(0);
    game.generation = 0;
    game.flashes = [];
    game.skillCells = { cache: {}, hardy: {}, sprout: {} };
    game.skills = { cache: false, hardy: false, sprout: false, migrate: false };
    Object.assign(game, global.LifeCiv.emptyCivState());
    game.foods = { 0: START_FOOD };
    game.hungryBy = {};
    game.food = START_FOOD;
    game.hungry = false;
    if (game.stain) game.stain.fill(0);
    if (game.stainWho) game.stainWho.fill(0);
    if (game.riverRisk) game.riverRisk.fill(0);
    if (currentSeason(game).id === "flood") W.restoreTerrain(game);
    else if (currentSeason(game).id === "winter") W.thawRivers(game);
    else game.terrain.set(game.baseTerrain);
    game.season = 0;
    game.seasonAge = 0;
    game.iceAge = false;
    game.boatCells = {};
    game.raftCells = {};
    game.raftIdle = {};
    if (game.driedRiver) game.driedRiver.fill(0);
    game.monsoonShifted = false;
    if (game.monsoonBase) game.monsoon = Object.assign({}, game.monsoonBase);
    rollYear(game);
  }

  function rollYear(game) {
    if (game.climateKind === "hot") {
      game.yearKind = "dry";
      game.pestYear = false;
      let note = "旱年";
      if (W.applyYearSea) {
        const seaNote = W.applyYearSea(game);
        if (seaNote) note = note + " · " + seaNote;
      }
      return note;
    }
    const r = Math.random();
    let kind = "normal";
    if (r < 0.28) kind = "wet";
    else if (r < 0.56) kind = "dry";
    game.yearKind = kind;
    game.pestYear = false;
    game.pestTint = 0;
    let note = null;
    if (kind === "wet") note = "多雨年";
    else if (kind === "dry") note = "旱年";
    if (W.applyYearSea) {
      const seaNote = W.applyYearSea(game);
      if (seaNote) note = note ? note + " · " + seaNote : seaNote;
    }
    return note;
  }

  function tryPest(game, seasonId) {
    if (seasonId !== "rain" && seasonId !== "drought") return null;
    if (game.pestYear) return null;
    if (Math.random() > 0.15) return null;
    game.pestYear = true;
    game.pestTint = 18;
    return "這一季蟲疾";
  }

  function currentSeason(game) {
    return W.SEASONS[game.season];
  }

  function seasonLeft(game) {
    return W.SEASON_LENGTH - game.seasonAge;
  }

  function population(game) {
    let n = 0;
    const life = game.life;
    for (let i = 0; i < life.length; i++) if (life[i]) n++;
    return n;
  }

  function isPlantable(game, x, y) {
    if (y < 0 || y >= game.rows) return false;
    x = W.wrap(x, game.cols);
    const i = W.idx(x, y, game.cols);
    const t = game.terrain[i];
    if (game.driedRiver && game.driedRiver[i]) return true;
    return (
      t === TERRAIN.SOIL ||
      t === TERRAIN.FERTILE ||
      t === TERRAIN.ICE ||
      t === TERRAIN.SAND ||
      t === TERRAIN.MARSH ||
      t === TERRAIN.GROVE ||
      t === TERRAIN.HIGHLAND
    );
  }

  function harvestCell(game, i) {
    const kind = game.resources[i];
    if (!kind) return 0;
    const who = (game.owner && game.owner[i]) || 0;
    const crystal = kind === RESOURCE.CRYSTAL;
    const amt = Math.max(1, Math.min(3, (game.resAmt && game.resAmt[i]) || 1));
    game.resources[i] = RESOURCE.NONE;
    if (game.resAmt) game.resAmt[i] = 0;
    const x = i % game.cols;
    const y = (i - x) / game.cols;
    game.flashes.push({ x: x, y: y, age: 0, crystal: crystal });
    if (crystal) {
      const foodGain = [0, 8, 12, 16][amt];
      const enGain = [0, 4, 5, 7][amt];
      game.energy += enGain;
      if (global.LifeCiv.addFood) global.LifeCiv.addFood(game, who, foodGain);
      else game.food += foodGain;
      return foodGain;
    }
    for (let n = 0; n < amt; n++) spawnBeside(game, x, y, who);
    return amt;
  }

  function spawnBeside(game, x, y, who) {
    const ortho = shuffled([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const diag = shuffled([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    const dirs = ortho.concat(diag);
    for (let d = 0; d < dirs.length; d++) {
      const nx = W.wrap(x + dirs[d][0], game.cols);
      const ny = mapY(y + dirs[d][1], game.rows);
      if (ny < 0) continue;
      if (!isPlantable(game, nx, ny)) continue;
      const ni = W.idx(nx, ny, game.cols);
      if (game.life[ni]) continue;
      game.life[ni] = 1;
      if (game.owner) game.owner[ni] = who || 0;
      return true;
    }
    return false;
  }

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function patternById(id) {
    const list = global.LifePatterns.PATTERNS;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function gatherSkills(game) {
    const G = global.LifeGallery;
    const cache = {};
    const hardy = {};
    const sprout = {};
    const shelter = {};
    const blocks = G.collectMatches(game, patternById("block"));
    const halls = G.collectMatches(game, patternById("hall"));
    const corners = G.collectMatches(game, patternById("corner"));
    const snakes = G.collectMatches(game, patternById("snake"));
    function markShelter(match, extra) {
      match.cells.forEach(function (c) {
        const i = W.idx(c.x, c.y, game.cols);
        shelter[i] = 1;
        if (extra) extra[i] = 1;
      });
    }
    blocks.forEach(function (match) {
      markShelter(match, cache);
    });
    halls.forEach(function (match) {
      markShelter(match, hardy);
    });
    corners.forEach(function (match) {
      markShelter(match, null);
      match.cells.forEach(function (c) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = W.wrap(c.x + dx, game.cols);
            const ny = mapY(c.y + dy, game.rows);
            if (ny < 0) continue;
            if (!isPlantable(game, nx, ny)) continue;
            const ni = W.idx(nx, ny, game.cols);
            if (!game.life[ni]) sprout[ni] = 1;
          }
        }
      });
    });
    snakes.forEach(function (match) {
      markShelter(match, null);
    });
    return {
      cache: cache,
      hardy: hardy,
      sprout: sprout,
      shelter: shelter,
      snakes: snakes,
      flags: {
        cache: blocks.length > 0,
        hardy: halls.length > 0,
        sprout: corners.length > 0,
        migrate: false,
      },
    };
  }

  function neighborCount(game, x, y) {
    const cols = game.cols;
    const rows = game.rows;
    const life = game.life;
    const terrain = game.terrain;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const ny = y + dy;
        if (ny < 0 || ny >= rows) continue;
        const nx = W.wrap(x + dx, cols);
        const i = W.idx(nx, ny, cols);
        if (terrain[i] === TERRAIN.ROCK || terrain[i] === TERRAIN.SNOW) continue;
        if (life[i]) n++;
      }
    }
    return n;
  }

  function starve(game, cache) {
    cache = cache || {};
    const Civ = global.LifeCiv;
    game._lifePop = population(game);
    if (!game.foods) game.foods = { 0: game.food || 0 };
    if (!game.hungryBy) game.hungryBy = {};
    const bills = {};
    const pops = {};
    for (let i = 0; i < game.life.length; i++) {
      if (!game.life[i]) continue;
      const who = (game.owner && game.owner[i]) || 0;
      pops[who] = (pops[who] || 0) + 1;
    }
    game._ownerPop = pops;
    for (let i = 0; i < game.life.length; i++) {
      if (!game.life[i]) continue;
      const who = (game.owner && game.owner[i]) || 0;
      bills[who] = (bills[who] || 0) + Civ.foodWeight(game, i, cache);
    }
    game.hungryBy = {};
    const keys = Object.keys(bills);
    if (!keys.length) {
      game.hungry = false;
      if (Civ.syncFood) Civ.syncFood(game);
      return 0;
    }
    let totalKill = 0;
    for (let k = 0; k < keys.length; k++) {
      const who = Number(keys[k]);
      const billable = bills[who];
      if (billable <= 0) continue;
      const need = Math.ceil(billable / FEED_RATIO);
      const paid = Civ.spendFood ? Civ.spendFood(game, who, need) : 0;
      let deficit = need - paid;
      const fac = game.factions && game.factions[who];
      if (fac && (fac.rotHungry || 0) > 0) {
        fac.rotHungry -= 1;
        game.hungryBy[who] = 1;
        if (deficit <= 0) deficit = Math.max(2, Math.ceil(need * 0.5));
      }
      if (deficit <= 0) continue;
      game.hungryBy[who] = 1;
      let cap = STARVE_CAP + Math.min(0.16, deficit / 90);
      if (currentSeason(game).id === "drought") cap += 0.04;
      if (game.yearKind === "dry") cap += 0.02;
      if (game.pestTint) cap += 0.03;
      if (game.glacialLeft) cap += 0.04;
      if (game.climateKind === "hot") cap += 0.05;
      if (game.climateKind === "cold") cap += 0.03;
      cap = Math.min(0.28, cap);
      const pop = pops[who] || 0;
      const want = Math.min(deficit * FEED_RATIO, Math.max(1, Math.ceil(pop * cap)), pop);
      const ranked = [];
      for (let y = 0; y < game.rows; y++) {
        for (let x = 0; x < game.cols; x++) {
          const i = W.idx(x, y, game.cols);
          if (!game.life[i] || cache[i]) continue;
          const o = (game.owner && game.owner[i]) || 0;
          if (o !== who) continue;
          ranked.push({ i: i, r: Civ.starveRank(game, i, neighborCount(game, x, y)) });
        }
      }
      ranked.sort(function (a, b) {
        return a.r - b.r;
      });
      const kill = Math.min(want, ranked.length);
      for (let n = 0; n < kill; n++) {
        const i = ranked[n].i;
        game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
      }
      totalKill += kill;
    }
    game.hungry = !!game.hungryBy[0];
    if (Civ.syncFood) Civ.syncFood(game);
    return totalKill;
  }

  function migrateSnakes(game, snakes) {
    if (currentSeason(game).id !== "flood" || !snakes || !snakes.length) return false;
    let moved = false;
    const snakeIndex = {};
    snakes.forEach(function (match) {
      match.cells.forEach(function (c) {
        snakeIndex[W.idx(c.x, c.y, game.cols)] = 1;
      });
    });
    snakes.forEach(function (match) {
      let pushX = 0;
      let pushY = 0;
      let touch = false;
      match.cells.forEach(function (c) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        dirs.forEach(function (d) {
          const nx = W.wrap(c.x + d[0], game.cols);
          const ny = mapY(c.y + d[1], game.rows);
          if (ny < 0) return;
          if (game.terrain[W.idx(nx, ny, game.cols)] === TERRAIN.WATER || game.terrain[W.idx(nx, ny, game.cols)] === TERRAIN.RIVER) {
            touch = true;
            pushX -= d[0];
            pushY -= d[1];
          }
        });
      });
      if (!touch) return;
      let dx = 0;
      let dy = 0;
      if (Math.abs(pushX) >= Math.abs(pushY)) dx = pushX > 0 ? 1 : pushX < 0 ? -1 : 0;
      else dy = pushY > 0 ? 1 : pushY < 0 ? -1 : 0;
      if (!dx && !dy) return;
      const dest = [];
      let ok = true;
      for (let i = 0; i < match.cells.length; i++) {
        const c = match.cells[i];
        const x = W.wrap(c.x + dx, game.cols);
        const y = mapY(c.y + dy, game.rows);
        if (y < 0) {
          ok = false;
          break;
        }
        if (!isPlantable(game, x, y)) {
          ok = false;
          break;
        }
        const ni = W.idx(x, y, game.cols);
        if (game.life[ni] && !snakeIndex[ni]) {
          ok = false;
          break;
        }
        dest.push({ x: x, y: y, i: ni, from: W.idx(c.x, c.y, game.cols) });
      }
      if (!ok) return;
      dest.forEach(function (d) {
        const who = (game.owner && game.owner[d.from]) || 0;
        game.life[d.from] = 0;
        if (game.owner) game.owner[d.from] = 0;
        d.who = who;
      });
      dest.forEach(function (d) {
        game.life[d.i] = 1;
        if (game.owner) game.owner[d.i] = d.who;
        snakeIndex[d.from] = 0;
        snakeIndex[d.i] = 1;
        if (game.resources[d.i]) harvestCell(game, d.i);
      });
      moved = true;
    });
    return moved;
  }

  function advanceSeason(game) {
    game.seasonAge += 1;
    if (game.seasonAge < W.SEASON_LENGTH) return null;
    const prev = currentSeason(game);
    game.season = (game.season + 1) % W.SEASONS.length;
    game.seasonAge = 0;
    const next = currentSeason(game);
    if (next.id === "warm") {
      const yearNote = rollYear(game);
      if (yearNote) {
        game.events = game.events || [];
        game.events.push(yearNote);
      }
    }
    if (prev.id === "rain") {
      if (W.restoreMonsoonBase) W.restoreMonsoonBase(game);
    }
    if (next.id === "rain") {
      const wind = W.shiftMonsoonRain && W.shiftMonsoonRain(game);
      if (wind) {
        game.events = game.events || [];
        game.events.push(wind);
      }
      const riverBack = W.restoreDryRivers && W.restoreDryRivers(game, true);
      if (riverBack) {
        game.events = game.events || [];
        game.events.push(riverBack);
      }
    }
    if (next.id === "drought") {
      const dryR = W.shrinkDryRivers && W.shrinkDryRivers(game);
      if (dryR) {
        game.events = game.events || [];
        game.events.push(dryR);
      }
    }
    if (prev.id === "flood") {
      W.restoreTerrain(game);
      const silt = W.floodSilt(game);
      global.LifeCiv.washRuins(game);
      if (silt) {
        game.events = game.events || [];
        game.events.push(silt);
      }
    }
    if (prev.id === "winter") {
      if ((game.glacialLeft || 0) > 0 || game.climateKind === "cold") {
        game.iceAge = true;
        W.freezeRivers(game, true);
      } else {
        W.thawRivers(game);
        const mud = W.thawMud(game);
        global.LifeCiv.washRuins(game);
        if (mud) {
          game.events = game.events || [];
          game.events.push(mud);
        }
      }
    }
    if (next.id === "winter") {
      let iceChance = 0.25;
      if (game.yearKind === "wet") iceChance = 0.12;
      else if (game.yearKind === "dry") iceChance = 0.35;
      if ((game.glacialLeft || 0) > 0 || game.climateKind === "cold") iceChance = 1;
      game.iceAge = Math.random() < iceChance;
      W.freezeRivers(game, game.iceAge || !!(game.glacialLeft || game.climateKind === "cold"));
      const ice = global.LifeCiv.tryWinterCrossings(game, isPlantable);
      if (ice && ice.length) {
        game.events = game.events || [];
        ice.forEach(function (e) {
          game.events.push(e);
        });
      }
      if (game.iceAge && !(game.glacialLeft > 0) && game.climateKind !== "cold") {
        game.events = game.events || [];
        game.events.push("小冰期：淺海結冰");
      }
    }
    if (next.id === "flood") {
      const dikeOwner = {};
      Object.keys(game.dikeCells || {}).forEach(function (key) {
        dikeOwner[key] = (game.owner && game.owner[Number(key)]) || 0;
      });
      W.applyFlood(game);
      if (game.floodNote) {
        game.events = game.events || [];
        game.events.push(game.floodNote);
      }
      Object.keys(game.dikeCells || {}).forEach(function (key) {
        const i = Number(key);
        if (game.terrain[i] === TERRAIN.WATER) {
          game.life[i] = 1;
          if (game.owner) game.owner[i] = dikeOwner[key] || 0;
        }
      });
      if (global.LifeCiv.expandDikes) global.LifeCiv.expandDikes(game);
      global.LifeCiv.washRuins(game);
    }
    const pest = tryPest(game, next.id);
    if (pest) {
      game.events = game.events || [];
      game.events.push(pest);
    }
    return next;
  }

  function step(game) {
    const cols = game.cols;
    const rows = game.rows;
    const life = game.life;
    const next = game.next;
    const terrain = game.terrain;
    const skills = gatherSkills(game);
    const Civ = global.LifeCiv;
    if (Civ.markBoatCells) Civ.markBoatCells(game);
    if (Civ.growRaftFloor) Civ.growRaftFloor(game);
    const migrated = migrateSnakes(game, skills.snakes);
    const climbed = Civ.evacuateHighGround(game, isPlantable);
    const forCA = gatherSkills(game);
    const drought = currentSeason(game).id === "drought";
    const sprout = Civ.markExpandBirths(game, forCA.sprout);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = W.idx(x, y, cols);
        const t = terrain[i];
        const dike = game.dikeCells && game.dikeCells[i];
        const boat = game.boatCells && game.boatCells[i];
        const raft = game.raftCells && game.raftCells[i];
        const wet = t === TERRAIN.WATER || t === TERRAIN.RIVER;
        if (t === TERRAIN.ROCK || t === TERRAIN.SNOW) {
          next[i] = 0;
          continue;
        }
        if (wet && !dike && !boat && !raft && !(game.driedRiver && game.driedRiver[i])) {
          next[i] = 0;
          continue;
        }
        const n = neighborCount(game, x, y);
        const alive = life[i];
        const town = game.civCells && game.civCells[i];
        const memory = town && town.legacy === "memory";
        const high = town && town.trait === "climb" && memory && W.isRockAdjacent(terrain, x, y, cols, rows);
        const maxLive = W.surviveMax(
          terrain,
          x,
          y,
          cols,
          rows,
          drought,
          !!(forCA.hardy[i] || town || memory)
        );
        const crowd = memory && alive ? Math.max(maxLive, drought ? (high ? 5 : 4) : 5) : maxLive;
        const house = forCA.cache && forCA.cache[i];
        const scatter = (game.glacialLeft || 0) > 0 && !town && !house;
        const need = scatter ? 2 : 1;
        const crowdCap = scatter ? Math.min(crowd, 3) : crowd;
        if (wet) {
          if (raft) {
            if (alive) next[i] = n >= need && n <= crowdCap ? 1 : 0;
            else next[i] = n === 3 ? 1 : 0;
          } else {
            next[i] = alive && n >= need && n <= crowdCap ? 1 : 0;
          }
          continue;
        }
        if (alive) next[i] = n >= need && n <= crowdCap ? 1 : 0;
        else if (n === 3 || (n === 2 && (sprout[i] || t === TERRAIN.GROVE))) next[i] = 1;
        else next[i] = 0;
      }
    }

    if (!game.owner) game.owner = new Uint8Array(next.length);
    if (!game.nextOwner) game.nextOwner = new Uint8Array(next.length);
    const nextOwner = game.nextOwner;
    nextOwner.fill(0);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = W.idx(x, y, cols);
        if (!next[i]) continue;
        nextOwner[i] = life[i] ? (game.owner[i] || 0) : Civ.majorityOwner(game, x, y);
      }
    }

    game.life = next;
    game.next = life;
    const oldOwner = game.owner;
    game.owner = nextOwner;
    game.nextOwner = oldOwner;
    game.generation += 1;
    const raftNote = Civ.tickRafts ? Civ.tickRafts(game) : null;

    const fresh = game.life;
    for (let i = 0; i < fresh.length; i++) {
      if (fresh[i] && game.resources[i]) harvestCell(game, i);
    }
    const after = gatherSkills(game);
    const starved = starve(game, after.cache);
    if (Civ.tickGlacialFood) Civ.tickGlacialFood(game);
    let groups = Civ.findGroups(game, after.shelter);
    let hearthNote = "";
    if (Civ.tryHearthSpark(game, groups, isPlantable)) {
      groups = Civ.findGroups(game, after.shelter);
      hearthNote = "走廊裡自己冒出爐芯";
    }
    const disaster = Civ.fireDisaster(game, groups);
    if (disaster.events.length) groups = Civ.findGroups(game, after.shelter);
    const townEvents = Civ.trackSettlements(game, groups);
    const crisisEvents = Civ.tickCrises ? Civ.tickCrises(game) : [];
    Civ.tickStain(game);
    const occupied = Civ.occupyRuins(game);
    const caravanEvents = Civ.tickCaravans(game, isPlantable);
    const warEvents = Civ.tickBorderWar ? Civ.tickBorderWar(game) : [];
    const spawned = Civ.trySpawnNpc(game, { flood: currentSeason(game).id === "flood" });
    if (spawned) {
      for (let i = 0; i < game.life.length; i++) {
        if (game.life[i] && game.resources[i]) harvestCell(game, i);
      }
    }
    after.flags.migrate = migrated;
    after.flags.climb = climbed;
    after.flags.cache = after.flags.cache || skills.flags.cache;
    after.flags.hardy = after.flags.hardy || skills.flags.hardy;
    after.flags.sprout = after.flags.sprout || skills.flags.sprout;
    game.skillCells = { cache: after.cache, hardy: after.hardy, sprout: after.sprout };
    game.skills = after.flags;
    game.events = disaster.events.concat(townEvents).concat(crisisEvents || []).concat(occupied).concat(caravanEvents).concat(warEvents);
    if (hearthNote) game.events.unshift(hearthNote);
    if (raftNote) game.events.push(raftNote);
    if (climbed) game.events.unshift("登高：往高處撤");
    if (spawned) game.events.push(spawned);
    const drifted = W.driftTerrain(game, currentSeason(game).id);
    if (drifted) game.events.push(drifted);
    game.extremeTint = disaster.extreme ? 18 : Math.max(0, (game.extremeTint || 0) - 1);
    game.quakeTint = disaster.quake ? 16 : Math.max(0, (game.quakeTint || 0) - 1);
    game.pestTint = Math.max(0, (game.pestTint || 0) - 1);
    const blowEvents = Civ.tickRegionBlows ? Civ.tickRegionBlows(game) : [];
    if (blowEvents && blowEvents.length) game.events = game.events.concat(blowEvents);
    const epochEvents = W.tickEpochs ? W.tickEpochs(game) : [];
    if (epochEvents && epochEvents.length) game.events = game.events.concat(epochEvents);

    const season = currentSeason(game);
    if (game.generation % season.every === 0) {
      const areaMul = (game.cols * game.rows) / (200 * 120);
      let maxRes = Math.round(season.maxRes * areaMul);
      if (game.yearKind === "wet" && season.id === "rain") maxRes = Math.floor(maxRes * 1.15);
      if (game.yearKind === "dry") maxRes = Math.floor(maxRes * 0.85);
      W.respawnResources(game, game.life, {
        max: maxRes,
        spawnMin: Math.max(season.spawnMin, Math.round(season.spawnMin * areaMul)),
        spawnMax: Math.max(season.spawnMax, Math.round(season.spawnMax * areaMul)),
      });
      if (W.spawnTownBounty) W.spawnTownBounty(game);
      if (W.growWildStocks) W.growWildStocks(game, season.id);
    }

    const changed = advanceSeason(game);
    Civ.recordChronicle(game, game.events);
    const extinct = Civ.checkExtinct(game);
    return {
      starved: starved,
      seasonChanged: changed,
      skills: after.flags,
      events: game.events,
      extreme: disaster.extreme,
      quake: disaster.quake,
      extinct: extinct,
    };
  }

  function plant(game, x, y) {
    if (!isPlantable(game, x, y)) return false;
    const i = W.idx(x, y, game.cols);
    if (game.life[i]) return false;
    if (game.energy < 1) return false;
    game.energy -= 1;
    game.life[i] = 1;
    if (game.owner) game.owner[i] = 0;
    if (game.resources[i]) harvestCell(game, i);
    return true;
  }

  function erase(game, x, y) {
    const i = W.idx(x, y, game.cols);
    if (!game.life[i]) return false;
    game.life[i] = 0;
    if (game.owner) game.owner[i] = 0;
    return true;
  }

  function canStamp(game, cells, ox, oy) {
    for (let i = 0; i < cells.length; i++) {
      const x = W.wrap(ox + cells[i][0], game.cols);
      const y = mapY(oy + cells[i][1], game.rows);
      if (y < 0) return false;
      if (!isPlantable(game, x, y)) return false;
    }
    return true;
  }

  function stamp(game, cells, ox, oy) {
    const cost = cells.length;
    if (game.energy < cost) return false;
    if (!canStamp(game, cells, ox, oy)) return false;
    game.energy -= cost;
    for (let i = 0; i < cells.length; i++) {
      const x = W.wrap(ox + cells[i][0], game.cols);
      const y = mapY(oy + cells[i][1], game.rows);
      const id = W.idx(x, y, game.cols);
      game.life[id] = 1;
      if (game.owner) game.owner[id] = 0;
      if (game.resources[id]) harvestCell(game, id);
    }
    return true;
  }

  function scatter(game, budget) {
    const spend = Math.min(game.energy, budget);
    let placed = 0;
    let guard = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (placed + 1 < spend && guard < spend * 50) {
      guard++;
      const x = Math.floor(Math.random() * game.cols);
      const y = Math.floor(Math.random() * game.rows);
      if (!plant(game, x, y)) continue;
      placed++;
      const start = Math.floor(Math.random() * dirs.length);
      for (let d = 0; d < dirs.length && placed < spend; d++) {
        const dir = dirs[(start + d) % dirs.length];
        const nx = W.wrap(x + dir[0], game.cols);
        const ny = mapY(y + dir[1], game.rows);
        if (ny < 0) continue;
        if (plant(game, nx, ny)) {
          placed++;
          break;
        }
      }
    }
    return placed;
  }

  function tickFlashes(game) {
    game.flashes = game.flashes.filter((f) => {
      f.age += 1;
      return f.age < 14;
    });
  }

  global.LifeEngine = {
    MAP_SIZES: MAP_SIZES,
    COLS: 320,
    ROWS: 192,
    START_ENERGY: START_ENERGY,
    START_FOOD: START_FOOD,
    createGame: createGame,
    newMap: newMap,
    resizeMap: resizeMap,
    clearLife: clearLife,
    population: population,
    currentSeason: currentSeason,
    seasonLeft: seasonLeft,
    isPlantable: isPlantable,
    step: step,
    plant: plant,
    erase: erase,
    canStamp: canStamp,
    stamp: stamp,
    scatter: scatter,
    tickFlashes: tickFlashes,
  };
})(window);

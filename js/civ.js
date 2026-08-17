(function (global) {
  const W = global.LifeWorld;
  const TERRAIN = W.TERRAIN;

  const RESOURCE = W.RESOURCE;
  const TRAITS = {
    deep: { id: "deep", name: "深倉" },
    dike: { id: "dike", name: "堤防" },
    climb: { id: "climb", name: "登高" },
    resist: { id: "resist", name: "抗災" },
    expand: { id: "expand", name: "拓殖" },
    sail: { id: "sail", name: "航海" },
    farm: { id: "farm", name: "農" },
  };
  const TRAIT_IDS = ["deep", "dike", "climb", "resist", "expand", "sail", "farm"];
  const LEGACIES = {
    memory: { id: "memory", name: "記旱" },
    rite: { id: "rite", name: "歲祀" },
    hearth: { id: "hearth", name: "回爐" },
    ward: { id: "ward", name: "加護" },
    wall: { id: "wall", name: "城垣" },
  };
  const LEGACY_IDS = ["memory", "rite", "hearth", "ward", "wall"];
  const HERO_TAGS = {
    humane: { id: "humane", name: "仁政" },
    birth: { id: "birth", name: "多產" },
    heirs: { id: "heirs", name: "多子" },
    warlord: { id: "warlord", name: "統領征戰" },
    thrift: { id: "thrift", name: "節儉" },
    lavish: { id: "lavish", name: "奢侈" },
    cruel: { id: "cruel", name: "暴虐" },
    endless: { id: "endless", name: "窮兵" },
    suspect: { id: "suspect", name: "猜忌" },
    fool: { id: "fool", name: "昏庸" },
    idle: { id: "idle", name: "怠政" },
    settle: { id: "settle", name: "勤拓" },
    vanity: { id: "vanity", name: "好大喜功" },
    brief: { id: "brief", name: "短命" },
  };
  const HERO_IDS = Object.keys(HERO_TAGS);
  const CIV_MIN = 12;
  const SNAKE_CAP = 5;
  const FLEET_MAX_AGE = 20;
  const FLEET_TOWN = 18;

  function snakeSlotFull(game) {
    let n = 0;
    (game.caravans || []).forEach(function (c) {
      if (c.kind !== "fleet") n += 1;
    });
    return n >= SNAKE_CAP;
  }
  const HALL_WALL = 4;
  const SPARK_LIFE = 40;
  const WEAK_MAX = 7;
  const OVERLAP = 0.25;
  const GRACE = 2;
  const ROLL_AGE = 30;
  const ROLL_RETRY = 20;
  const EXPAND_CAP = 2;
  const NPC_MAX = 8;
  const LIVING_CAP = 6;
  const HUNGER_BREAK = 10;
  const TOWNLESS_MAX = 16;
  const NPC_DIST = 12;
  const RUIN_MAX = 6;
  const RUIN_FOOD = 8;
  const RUIN_ENERGY = 3;

  const VILLAGE_SRC = [
    [0, 0], [1, 0],
    [0, 1], [1, 1],
    [0, 2],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  ];

  function disasterWait() {
    return 96 + Math.floor(Math.random() * 33) - 16;
  }

  function npcWait(game) {
    const gen = (game && game.generation) || 0;
    let base = 50 + Math.floor(Math.random() * 31);
    if (gen > 4000) base = 220 + Math.floor(Math.random() * 121);
    else if (gen > 2000) base = 140 + Math.floor(Math.random() * 81);
    return base;
  }

  function emptyCivState() {
    return {
      settlements: [],
      ghosts: [],
      nextId: 1,
      civCells: {},
      dikeCells: {},
      expandCells: {},
      weakGroups: [],
      disasterIn: disasterWait(),
      npcIn: npcWait(),
      omen: false,
      lastEvent: "",
      events: [],
      nextSettleId: 1,
      nextNpcOwner: 1,
      ruinSites: [],
      caravans: [],
      extremeTint: 0,
      quakeTint: 0,
      pestTint: 0,
      yearKind: "normal",
      pestYear: false,
      sparkCells: {},
      factions: {},
      chronicle: [],
      hadCiv: false,
      extinctShown: false,
      raftCells: {},
      raftIdle: {},
      crisisIn: crisisWait(),
      blowIn: blowWait(),
      darkIn: darkWait(),
      stormTint: 0,
      stormPath: {},
      stormDir: { dx: 1, dy: 1 },
      quakeRing: null,
      epochVolcanoAt: 1820 + Math.floor(Math.random() * 361),
      epochClimateAt: 5750 + Math.floor(Math.random() * 501),
      epochDriftAt: 7800 + Math.floor(Math.random() * 401),
      epochVolcano: "pending",
      epochClimate: "pending",
      epochDrift: "pending",
      glacialLeft: 0,
      calderaCoolLeft: 0,
      caldera: {},
      climateKind: null,
      climateLeft: 0,
      driftDx: 0,
      epochOmen: null,
    };
  }

  function crisisWait() {
    return 55 + Math.floor(Math.random() * 36);
  }

  function blowWait() {
    return 110 + Math.floor(Math.random() * 61);
  }

  function darkWait() {
    return 180 + Math.floor(Math.random() * 121);
  }

  function idx(game, x, y) {
    if (y < 0 || y >= game.rows) return game.cols * game.rows;
    return W.idx(W.wrap(x, game.cols), y, game.cols);
  }

  function ownerOf(game, i) {
    return (game.owner && game.owner[i]) || 0;
  }

  const NPC_START_FOOD = 28;

  function foodOf(game, who) {
    who = who || 0;
    if (!game.foods) game.foods = { 0: game.food || 0 };
    if (game.foods[who] == null) game.foods[who] = 0;
    return game.foods[who] | 0;
  }

  function syncFood(game) {
    game.food = foodOf(game, 0);
    game.hungry = !!(game.hungryBy && game.hungryBy[0]);
  }

  function addFood(game, who, n) {
    who = who || 0;
    foodOf(game, who);
    game.foods[who] = Math.max(0, foodOf(game, who) + (n || 0));
    syncFood(game);
    return game.foods[who];
  }

  function spendFood(game, who, n) {
    who = who || 0;
    const have = foodOf(game, who);
    const paid = Math.min(have, Math.max(0, n || 0));
    game.foods[who] = have - paid;
    syncFood(game);
    return paid;
  }

  function isHungry(game, who) {
    who = who || 0;
    if (game.hungryBy && game.hungryBy[who]) return true;
    const f = game.factions && game.factions[who];
    return !!(f && (f.rotHungry || 0) > 0);
  }

  const HAN_DIG = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

  function hanOrdinal(n) {
    n = Math.floor(Number(n) || 0);
    if (n <= 0) return String(n);
    if (n < 10) return HAN_DIG[n];
    if (n === 10) return "十";
    if (n < 20) return "十" + HAN_DIG[n - 10];
    if (n < 100) {
      const t = Math.floor(n / 10);
      const o = n % 10;
      return HAN_DIG[t] + "十" + (o ? HAN_DIG[o] : "");
    }
    return String(n);
  }

  function civName(n) {
    if (n <= 1) return "文明一";
    return "第" + hanOrdinal(n) + "文明";
  }

  function ownerLifeCounts(game) {
    const counts = {};
    const n = game.life ? game.life.length : 0;
    for (let i = 0; i < n; i++) {
      if (!game.life[i]) continue;
      const o = (game.owner && game.owner[i]) || 0;
      counts[o] = (counts[o] || 0) + 1;
    }
    return counts;
  }

  function ensureFaction(game, owner) {
    if (!game.factions) game.factions = {};
    const o = owner || 0;
    if (game.factions[o]) return game.factions[o];
    const n = o + 1;
    game.factions[o] = {
      n: n,
      skills: {},
      peak: 0,
      kingdom: false,
      empire: false,
      kingLived: 0,
      hero: null,
      heroIn: 12 + Math.floor(Math.random() * 20),
      alive: false,
      lived: 0,
      nextRoll: ROLL_AGE,
    };
    return game.factions[o];
  }

  function isKingdomOwner(game, owner) {
    const f = game.factions && game.factions[owner || 0];
    return !!(f && (f.kingdom || f.empire));
  }

  function isEmpireOwner(game, owner) {
    const f = game.factions && game.factions[owner || 0];
    return !!(f && f.empire);
  }

  function hasHeroTag(game, owner, id) {
    const f = game.factions && game.factions[owner || 0];
    const tags = f && f.hero && f.hero.tags;
    return !!(tags && tags.indexOf(id) >= 0);
  }

  function livingFactionCount(game) {
    let n = 0;
    Object.keys(game.factions || {}).forEach(function (key) {
      if (game.factions[key] && game.factions[key].alive) n += 1;
    });
    return n;
  }

  function factionHasSkill(game, who, id) {
    const f = game.factions && game.factions[who || 0];
    return !!(f && f.skills && f.skills[id]);
  }

  function hasFarm(game, settl) {
    if (settl && settl.trait === "farm") return true;
    return factionHasSkill(game, settl && settl.owner, "farm");
  }

  function mergeFactionSkills(dst, src) {
    if (!dst.skills) dst.skills = {};
    Object.keys((src && src.skills) || {}).forEach(function (id) {
      dst.skills[id] = 1;
    });
  }

  function reassignOwner(game, from, to) {
    if (from === to) return;
    if (game.owner) {
      for (let i = 0; i < game.owner.length; i++) {
        if (game.owner[i] === from) game.owner[i] = to;
      }
    }
    (game.settlements || []).forEach(function (s) {
      if ((s.owner || 0) !== from) return;
      s.owner = to;
      s.npc = to !== 0;
      inheritFactionSkills(game, s);
    });
    (game.ghosts || []).forEach(function (s) {
      if ((s.owner || 0) === from) s.owner = to;
    });
    (game.caravans || []).forEach(function (c) {
      if ((c.owner || 0) === from) c.owner = to;
    });
  }

  function absorbFaction(game, loser, winner, events) {
    loser = loser || 0;
    winner = winner || 0;
    if (loser === winner) return false;
    if (loser === 0) return false;
    const lf = ensureFaction(game, loser);
    const wf = ensureFaction(game, winner);
    mergeFactionSkills(wf, lf);
    const leftover = foodOf(game, loser);
    if (leftover) {
      spendFood(game, loser, leftover);
      addFood(game, winner, leftover);
    }
    reassignOwner(game, loser, winner);
    lf.alive = false;
    lf.kingdom = false;
    lf.empire = false;
    lf.towns = 0;
    lf.pop = 0;
    lf.hungryStreak = 0;
    if (game.foods) game.foods[loser] = 0;
    events.push(civName(lf.n) + "併入" + civName(wf.n));
    return true;
  }

  function pickAbsorbHost(game, who) {
    const neigh = ownersTouching(game, who);
    const lifeBy = ownerLifeCounts(game);
    let best = null;
    let bestPop = -1;
    neigh.forEach(function (o) {
      if (o === who) return;
      const f = game.factions && game.factions[o];
      if (!f || !f.alive) return;
      const p = lifeBy[o] || 0;
      if (p > bestPop) {
        bestPop = p;
        best = o;
      }
    });
    return best;
  }

  function wipeOwnerCells(game, who, dropTowns) {
    if (dropTowns) {
      (game.settlements || []).forEach(function (s) {
        if ((s.owner || 0) !== who) return;
        const members = s.members;
        (s.list || []).forEach(function (i) {
          game.life[i] = 0;
          if (game.owner) game.owner[i] = 0;
        });
        dropRuinFromMembers(game, members, s);
      });
    }
    if (!game.life || !game.owner) return;
    for (let i = 0; i < game.life.length; i++) {
      if (game.owner[i] !== who) continue;
      game.life[i] = 0;
      game.owner[i] = 0;
    }
  }

  function killSmallestTown(game, owner, events) {
    const list = (game.settlements || []).filter(function (s) {
      return (s.owner || 0) === owner;
    });
    if (list.length < 2) return false;
    list.sort(function (a, b) {
      return (a.size || 0) - (b.size || 0);
    });
    const town = list[0];
    const members = town.members;
    (town.list || []).forEach(function (i) {
      game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
    });
    dropRuinFromMembers(game, members, town);
    events.push(civName(ensureFaction(game, owner).n) + "連饑，分鎮散了");
    return true;
  }

  function scatterFaction(game, who, events) {
    who = who || 0;
    const f = ensureFaction(game, who);
    if (who === 0 || f.kingdom || f.empire) {
      scrapeOwner(game, who, 0.2);
      f.hungryStreak = 0;
      events.push(civName(f.n) + "連饑，走廊大減");
      return false;
    }
    const host = pickAbsorbHost(game, who);
    if (host != null) return absorbFaction(game, who, host, events);
    wipeOwnerCells(game, who, true);
    f.alive = false;
    f.kingdom = false;
    f.empire = false;
    f.towns = 0;
    f.pop = 0;
    f.hungryStreak = 0;
    if (game.foods) game.foods[who] = 0;
    events.push(civName(f.n) + "因饑散族");
    return true;
  }

  function markFactionExtinct(game, o, f, events) {
    f.alive = false;
    f.kingdom = false;
    f.empire = false;
    f.towns = 0;
    f.pop = 0;
    f.hungryStreak = 0;
    if (o !== 0 && game.foods) game.foods[o] = 0;
    events.push(civName(f.n) + "滅亡");
  }

  function countLife(game) {
    if (game._lifePop != null) return game._lifePop;
    let n = 0;
    const life = game.life || [];
    for (let i = 0; i < life.length; i++) if (life[i]) n++;
    return n;
  }

  function densityScale(game, owner) {
    let pop = 0;
    if (game._ownerPop && game._ownerPop[owner || 0] != null) pop = game._ownerPop[owner || 0];
    else pop = (ownerLifeCounts(game)[owner || 0] || 0);
    let scale = 1 + Math.max(0, pop - 40) / 280;
    if (isEmpireOwner(game, owner)) scale *= 0.55;
    if (hasHeroTag(game, owner, "thrift")) scale *= 0.85;
    if (hasHeroTag(game, owner, "lavish")) scale *= 1.25;
    if (hasHeroTag(game, owner, "vanity")) scale *= 1.12;
    if (hasHeroTag(game, owner, "endless")) scale *= 1.08;
    return scale;
  }

  function factionTraitId(f) {
    for (let i = 0; i < TRAIT_IDS.length; i++) {
      if (f.skills && f.skills[TRAIT_IDS[i]]) return TRAIT_IDS[i];
    }
    return null;
  }

  function factionLegacyId(f) {
    for (let i = 0; i < LEGACY_IDS.length; i++) {
      if (f.skills && f.skills[LEGACY_IDS[i]]) return LEGACY_IDS[i];
    }
    return null;
  }

  function rememberSkills(game, settl) {
    if (!settl) return;
    const f = ensureFaction(game, settl.owner || 0);
    if (settl.trait && TRAITS[settl.trait]) f.skills[settl.trait] = 1;
    if (settl.legacy && LEGACIES[settl.legacy]) f.skills[settl.legacy] = 1;
  }

  function inheritFactionSkills(game, settl) {
    if (!settl) return;
    const f = ensureFaction(game, settl.owner || 0);
    if (!settl.trait) {
      const id = factionTraitId(f);
      if (id) settl.trait = id;
    }
    if (!settl.legacy) {
      const id = factionLegacyId(f);
      if (id) settl.legacy = id;
    }
    rememberSkills(game, settl);
  }

  function tryFactionTrait(game, f, events, memorySettl) {
    if (!f || factionTraitId(f)) return;
    const age = f.lived || 0;
    const need = f.nextRoll || ROLL_AGE;
    if (age < need) return;
    if (Math.random() < 0.7) {
      const id = pickTrait(memorySettl || { memory: emptyMemory() });
      f.skills[id] = 1;
      events.push(civName(f.n) + "學會了" + TRAITS[id].name);
    } else {
      f.nextRoll = age + ROLL_RETRY;
    }
  }

  function canBecomeEmpire(f) {
    if (!f || !f.kingdom) return false;
    if ((f.kingLived || 0) < 80) return false;
    const skills = f.skills || {};
    return !!(skills.deep || skills.memory || skills.rite);
  }

  function pickHeroTags() {
    const bag = HERO_IDS.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = bag[i];
      bag[i] = bag[j];
      bag[j] = t;
    }
    const tags = [bag[0]];
    if (Math.random() < 0.2 && bag[1]) tags.push(bag[1]);
    return tags;
  }

  function heroLabel(tags) {
    return (tags || [])
      .map(function (id) {
        return HERO_TAGS[id] && HERO_TAGS[id].name;
      })
      .filter(Boolean)
      .join("、");
  }

  function tickHero(game, f, events) {
    if (!f) return;
    if (f.hero && f.hero.tags && f.hero.tags.length) {
      f.hero.age = (f.hero.age || 0) + 1;
      if (f.hero.age >= (f.hero.maxAge || 50)) {
        events.push(civName(f.n) + "之主辭世");
        f.hero = null;
        f.heroIn = 20 + Math.floor(Math.random() * 24);
      }
      return;
    }
    f.heroIn = (f.heroIn == null ? 16 : f.heroIn) - 1;
    if (f.heroIn > 0) return;
    if (!f.kingdom && (f.lived || 0) < 80) {
      f.heroIn = 8;
      return;
    }
    if ((game.seasonAge || 0) !== 1 && (game.generation || 0) % 32 !== 0) {
      f.heroIn = 1;
      return;
    }
    if (Math.random() > 0.3) {
      f.heroIn = 8;
      return;
    }
    const tags = pickHeroTags();
    let maxAge = 40 + Math.floor(Math.random() * 31);
    if (tags.indexOf("brief") >= 0) maxAge = 22 + Math.floor(Math.random() * 16);
    f.hero = { tags: tags, age: 0, maxAge: maxAge };
    f.heroIn = 0;
    events.push(civName(f.n) + "出了" + heroLabel(tags) + "之主");
  }

  function tryCivilSplit(game, events, forcedOwner) {
    const groups = {};
    (game.settlements || []).forEach(function (s) {
      const o = s.owner || 0;
      if (!groups[o]) groups[o] = [];
      groups[o].push(s);
    });
    const keys = forcedOwner != null ? [String(forcedOwner)] : Object.keys(groups);
    for (let k = 0; k < keys.length; k++) {
      const o = Number(keys[k]);
      const list = groups[o] || [];
      if (list.length < 2) continue;
      if (livingFactionCount(game) >= LIVING_CAP) continue;
      const f = game.factions[o];
      list.sort(function (a, b) {
        return (a.size || 0) - (b.size || 0);
      });
      const splinter = list[0];
      const who = game.nextNpcOwner || 1;
      game.nextNpcOwner = who + 1;
      const nf = ensureFaction(game, who);
      nf.alive = true;
      Object.keys((f && f.skills) || {}).forEach(function (id) {
        if (Math.random() < 0.5) nf.skills[id] = 1;
      });
      splinter.owner = who;
      splinter.npc = true;
      (splinter.list || []).forEach(function (i) {
        if (game.life[i] && game.owner) game.owner[i] = who;
      });
      const share = Math.floor(foodOf(game, o) * 0.4);
      if (share) {
        spendFood(game, o, share);
        addFood(game, who, share);
      }
      if (f) f.hungryStreak = 0;
      nf.hungryStreak = 0;
      events.push("內戰：" + civName((f && f.n) || 1) + "分裂出" + civName(nf.n));
      return true;
    }
    return false;
  }

  function hungerBreakChance(game, o, f) {
    let chance = 0.55;
    if (hasHeroTag(game, o, "heirs")) chance += 0.18;
    if (hasHeroTag(game, o, "suspect")) chance += 0.14;
    if (hasHeroTag(game, o, "cruel")) chance += 0.08;
    if (hasHeroTag(game, o, "humane")) chance *= 0.4;
    if (hasHeroTag(game, o, "fool") && Math.random() < 0.5) return 0;
    return chance;
  }

  function tryHungerBreak(game, events) {
    const byOwner = {};
    (game.settlements || []).forEach(function (s) {
      const o = s.owner || 0;
      if (!byOwner[o]) byOwner[o] = [];
      byOwner[o].push(s);
    });
    const order = Object.keys(game.factions || {}).map(Number);
    order.sort(function (a, b) {
      const fa = game.factions[a];
      const fb = game.factions[b];
      return ((fb && fb.hungryStreak) || 0) - ((fa && fa.hungryStreak) || 0);
    });
    for (let k = 0; k < order.length; k++) {
      const o = order[k];
      const f = game.factions[o];
      if (!f || !f.alive) continue;
      if ((f.hungryStreak || 0) < HUNGER_BREAK) continue;
      const towns = (byOwner[o] || []).length;
      const atCap = livingFactionCount(game) >= LIVING_CAP;
      if (towns >= 2 && !atCap && Math.random() < hungerBreakChance(game, o, f)) {
        if (tryCivilSplit(game, events, o)) return;
      }
      if (towns >= 2 && atCap) {
        killSmallestTown(game, o, events);
        f.hungryStreak = 0;
        return;
      }
      scatterFaction(game, o, events);
      return;
    }
  }

  function tryGhostFade(game, events) {
    Object.keys(game.factions || {}).forEach(function (key) {
      const o = Number(key);
      const f = game.factions[o];
      if (!f || !f.alive) return;
      if (o === 0) return;
      if ((f.townless || 0) < TOWNLESS_MAX) return;
      const host = pickAbsorbHost(game, o);
      if (host != null) absorbFaction(game, o, host, events);
      else {
        wipeOwnerCells(game, o, false);
        markFactionExtinct(game, o, f, events);
      }
    });
  }

  function tryBorderAbsorb(game, loser, winner, events) {
    if (loser === winner || loser === 0) return false;
    const lf = game.factions && game.factions[loser];
    if (!lf || !lf.alive || lf.kingdom || lf.empire) return false;
    const towns = (lf.towns || 0);
    const pop = lf.pop || 0;
    if (towns > 1 && pop > 22) return false;
    if (Math.random() > 0.16) return false;
    return absorbFaction(game, loser, winner, events);
  }

  function updateFactions(game, events) {
    events = events || [];
    if (!game.factions) game.factions = {};
    const byOwner = {};
    (game.settlements || []).forEach(function (s) {
      const o = s.owner || 0;
      if (!byOwner[o]) byOwner[o] = { n: 0, pop: 0, sample: s };
      byOwner[o].n += 1;
      byOwner[o].pop += s.size || 0;
      ensureFaction(game, o);
      rememberSkills(game, s);
    });
    const lifeBy = ownerLifeCounts(game);
    Object.keys(game.factions).forEach(function (key) {
      const o = Number(key);
      const f = game.factions[o];
      const info = byOwner[o];
      const hasTown = !!(info && info.n);
      if (hasTown) f.townless = 0;
      else f.townless = (f.townless || 0) + 1;
      if (isHungry(game, o)) f.hungryStreak = (f.hungryStreak || 0) + 1;
      else f.hungryStreak = 0;
    });
    tryGhostFade(game, events);
    Object.keys(game.factions).forEach(function (key) {
      const o = Number(key);
      const f = game.factions[o];
      const info = byOwner[o];
      const cells = lifeBy[o] || 0;
      const hasTown = !!(info && info.n);
      const keepGhost = !hasTown && cells > 0 && (o === 0 || (f.townless || 0) < TOWNLESS_MAX);
      const live = hasTown || keepGhost;
      if (live) {
        game.hadCiv = true;
        game.extinctShown = false;
        f.lived = (f.lived || 0) + 1;
        const king = !!(info && (info.n >= 2 || info.pop >= 40));
        if (king && !f.kingdom) events.push(civName(f.n) + "成為王國");
        f.kingdom = king;
        if (king) {
          f.wasKingdom = true;
          f.kingLived = (f.kingLived || 0) + 1;
        }
        const emp = canBecomeEmpire(f);
        if (emp && !f.empire) events.push(civName(f.n) + "成為帝國");
        f.empire = emp;
        if (emp) f.wasKingdom = true;
        f.towns = info ? info.n : 0;
        f.pop = info ? info.pop : cells;
        f.peak = Math.max(f.peak || 0, f.pop);
        f.alive = true;
        tryFactionTrait(game, f, events, info && info.sample);
        tickHero(game, f, events);
      } else if (f.alive) {
        wipeOwnerCells(game, o, false);
        markFactionExtinct(game, o, f, events);
      }
    });
    tryHungerBreak(game, events);
    return events;
  }

  function logChronicle(game, text) {
    if (!text) return;
    if (!game.chronicle) game.chronicle = [];
    const last = game.chronicle[game.chronicle.length - 1];
    if (last && last.text === text && last.gen === game.generation) return;
    game.chronicle.push({ gen: game.generation || 0, text: text });
    if (game.chronicle.length > 80) game.chronicle.shift();
  }

  function isMajorEvent(text) {
    return /學會|聚落形成|極端|地震|佔領遺址|因糧|過河|分家|出走|而遷|爐芯|王國|帝國|滅亡|全部消失|遠方出現|繼承了火種|之主|內戰|衝突|海底|火山|河口淤|開出田|土坡|山洪|決口|舊鎮荒了|離開了舊址|舊址生出|上香|還記得|歲祀的人說|舊爐還有人記得|多雨年|旱年|蟲疾|填了一段河|低地走成|積水成川|積了水|河枯成一線|乾河又來了水|海面漲了|潮退露出灘|季風轉向|林往前長|沙埋了地|填了一小塊海|海上有人住下來|船團散了|開出一條山口|船團|航海|大疫|倉中生霉|強震|颱風|疫過了邊境|中冰期|冷卻|酷熱|嚴寒|山脈|火山爆發|海嘯打上|年候將亂|地要裂|併入|散族|分鎮散了|諸部離散|開出田糧/.test(
      text || ""
    );
  }

  function recordChronicle(game, events) {
    (events || []).forEach(function (e) {
      if (isMajorEvent(e)) logChronicle(game, e);
    });
  }

  function checkExtinct(game) {
    const towns = (game.settlements || []).length;
    const ghost = (game.ghosts || []).some(function (g) {
      return (g.miss || 0) <= GRACE;
    });
    const lifeBy = ownerLifeCounts(game);
    let someone = false;
    Object.keys(game.factions || {}).forEach(function (key) {
      if ((lifeBy[Number(key)] || 0) > 0) someone = true;
    });
    if (!someone && (lifeBy[0] || 0) > 0 && game.hadCiv) someone = true;
    if (towns > 0 || ghost || someone) {
      if (towns > 0 || someone) {
        game.hadCiv = true;
        game.extinctShown = false;
      }
      return false;
    }
    if (!game.hadCiv || game.extinctShown) return false;
    game.extinctShown = true;
    logChronicle(game, "場上文明全部消失");
    return true;
  }

  function factionList(game) {
    const out = [];
    Object.keys(game.factions || {}).forEach(function (key) {
      const f = game.factions[key];
      const skills = [];
      Object.keys(f.skills || {}).forEach(function (id) {
        const spec = TRAITS[id] || LEGACIES[id];
        if (spec) skills.push(spec.name);
      });
      let rank = "遺跡";
      if (f.alive) {
        if (f.empire) rank = "帝國";
        else if (f.kingdom) rank = "王國";
        else if (!(f.towns) || ((f.towns || 0) <= 1 && skills.length === 0)) rank = "部落";
        else rank = "聚落";
      }
      out.push({
        n: f.n,
        owner: Number(key),
        name: civName(f.n),
        rank: rank,
        skills: skills,
        hero: heroLabel(f.hero && f.hero.tags),
        alive: !!f.alive,
        player: Number(key) === 0,
        food: foodOf(game, Number(key)),
        hungry: isHungry(game, Number(key)),
        wasKingdom: !!f.wasKingdom,
        plague: (f.plague || 0) > 0,
      });
    });
    out.sort(function (a, b) {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return a.n - b.n;
    });
    return out;
  }

  function tickStain(game) {
    const n = game.life.length;
    if (!game.stain || game.stain.length !== n) {
      game.stain = new Uint8Array(n);
      game.stainWho = new Uint8Array(n);
    }
    const stain = game.stain;
    const who = game.stainWho;
    const fade = game.generation % 8 === 0;
    for (let i = 0; i < n; i++) {
      const s = game.civCells && game.civCells[i];
      if (s && game.life[i]) {
        if (stain[i] < 12) stain[i] += 1;
        who[i] = (s.owner || 0) + 1;
      } else if (fade && stain[i]) {
        stain[i] -= 1;
        if (!stain[i]) who[i] = 0;
      }
    }
  }

  function majorityOwner(game, x, y) {
    const counts = {};
    let best = 0;
    let bestN = -1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const ni = idx(game, x + dx, y + dy);
        if (game.terrain[ni] === TERRAIN.ROCK || game.terrain[ni] === TERRAIN.SNOW) continue;
        if (!game.life[ni]) continue;
        const o = ownerOf(game, ni);
        counts[o] = (counts[o] || 0) + 1;
        const n = counts[o];
        if (n > bestN || (n === bestN && o === 0)) {
          bestN = n;
          best = o;
        }
      }
    }
    return bestN < 0 ? 0 : best;
  }

  function solidBlockCells(memberSet, game) {
    const cols = game.cols;
    const keys = Object.keys(memberSet);
    for (let k = 0; k < keys.length; k++) {
      const i = Number(keys[k]);
      const x = i % cols;
      const y = (i - x) / cols;
      const b = idx(game, x + 1, y);
      const c = idx(game, x, y + 1);
      const d = idx(game, x + 1, y + 1);
      if (memberSet[i] && memberSet[b] && memberSet[c] && memberSet[d]) {
        return [i, b, c, d];
      }
    }
    return null;
  }

  function hasSolidBlock(game, memberSet) {
    return !!solidBlockCells(memberSet, game);
  }

  function groupHasShelter(list, shelter) {
    if (!shelter) return false;
    for (let i = 0; i < list.length; i++) if (shelter[list[i]]) return true;
    return false;
  }

  function markSpark(game, cells) {
    if (!game.sparkCells) game.sparkCells = {};
    const until = (game.generation || 0) + SPARK_LIFE;
    (cells || []).forEach(function (i) {
      game.sparkCells[i] = until;
    });
  }

  function isSpark(game, i) {
    return !!(game.sparkCells && game.sparkCells[i] && game.sparkCells[i] > (game.generation || 0));
  }

  function groupHasSpark(game, list) {
    for (let k = 0; k < (list || []).length; k++) if (isSpark(game, list[k])) return true;
    return false;
  }

  function homeTown(game, owner) {
    let best = null;
    (game.settlements || []).forEach(function (s) {
      if ((s.owner || 0) !== (owner || 0)) return;
      if (!best || s.size > best.size) best = s;
    });
    return best;
  }

  function settlOfGroup(game, group) {
    const keys = Object.keys(group.members);
    for (let k = 0; k < keys.length; k++) {
      const s = game.civCells[keys[k]];
      if (s) return s;
    }
    return null;
  }

  function disasterChance(game, group) {
    const s = settlOfGroup(game, group);
    const p = potencyOf(s);
    const resist = !!(s && s.trait === "resist");
    const ward = !!(s && s.legacy === "ward");
    let chance = 0.5;
    if (resist && ward) chance = [0.12, 0.06, 0.03][p];
    else if (resist || ward) chance = [0.2, 0.12, 0.06][p];
    if (s && s.legacy === "wall" && s.walled) chance *= 0.65;
    if (isKingdomOwner(game, s && s.owner)) chance *= 0.7;
    return chance;
  }

  function emptyMemory() {
    return {
      flood: 0,
      drought: 0,
      hungry: 0,
      disaster: 0,
      nearWater: 0,
      nearRock: 0,
      sawNpc: 0,
      ruins: 0,
      quake: 0,
      crowded: 0,
      scarce: 0,
      halls: 0,
      boats: 0,
      lush: 0,
    };
  }

  function seasonIdOf(game) {
    return (W.SEASONS[game.season] || {}).id || "";
  }

  function cellTouchesWet(game, x, y) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let d = 0; d < 4; d++) {
      const t = game.terrain[idx(game, x + dirs[d][0], y + dirs[d][1])];
      if (t === TERRAIN.WATER || t === TERRAIN.RIVER) return true;
    }
    return false;
  }

  function cellSeesNpc(game, x, y, who) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (!dx && !dy) continue;
        const ni = idx(game, x + dx, y + dy);
        if (!game.life[ni]) continue;
        if (ownerOf(game, ni) !== who) return true;
      }
    }
    return false;
  }

  function localResourceScore(game, cx, cy) {
    let n = 0;
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const i = idx(game, Math.round(cx) + dx, Math.round(cy) + dy);
        const r = game.resources && game.resources[i];
        if (r === RESOURCE.CRYSTAL) n += 3;
        else if (r === RESOURCE.NUTRIENT) n += 1;
      }
    }
    return n;
  }

  function hallCount(game, list) {
    const hardy = (game.skillCells && game.skillCells.hardy) || {};
    let n = 0;
    for (let i = 0; i < (list || []).length; i++) if (hardy[list[i]]) n++;
    return n;
  }

  function isWalled(game, settl) {
    if (!settl || settl.legacy !== "wall") return false;
    return hallCount(game, settl.list) >= HALL_WALL;
  }

  function bump(mem, key, n) {
    mem[key] = (mem[key] || 0) + (n || 1);
  }

  function tallyExperience(game, settl) {
    const mem = settl.memory || emptyMemory();
    settl.memory = mem;
    const sid = seasonIdOf(game);
    const who = settl.owner || 0;
    const list = settl.list || [];
    let water = 0;
    let rock = 0;
    let lush = 0;
    let npc = false;
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (!game.life[i]) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      if (cellTouchesWet(game, x, y)) water++;
      if (W.isRockAdjacent(game.terrain, x, y, game.cols, game.rows)) rock++;
      const tt = game.terrain[i];
      if (tt === TERRAIN.FERTILE || tt === TERRAIN.GROVE || tt === TERRAIN.MARSH) lush++;
      if (!npc && cellSeesNpc(game, x, y, who)) npc = true;
    }
    if (sid === "flood") bump(mem, "flood");
    if (sid === "drought") bump(mem, "drought");
    if (isHungry(game, who)) {
      bump(mem, "hungry");
      settl.hungryStreak = (settl.hungryStreak || 0) + 1;
    } else {
      settl.hungryStreak = 0;
    }
    if (water) bump(mem, "nearWater", water > 3 ? 2 : 1);
    if (rock) bump(mem, "nearRock", rock > 3 ? 2 : 1);
    if (npc) bump(mem, "sawNpc");
    if (settl.size >= 22) bump(mem, "crowded");
    if (lush) bump(mem, "lush", lush > 4 ? 2 : 1);
    if (localResourceScore(game, settl.cx, settl.cy) < 3) bump(mem, "scarce");
    const halls = hallCount(game, list);
    if (halls > mem.halls) mem.halls = halls;
    settl.walled = isWalled(game, settl);
  }

  function rememberDisaster(game, groups) {
    (groups || []).forEach(function (g) {
      if (!g.civ) return;
      let alive = 0;
      for (let k = 0; k < g.list.length; k++) if (game.life[g.list[k]]) alive++;
      if (alive < 4) return;
      const s = settlOfGroup(game, g);
      if (!s) return;
      s.memory = s.memory || emptyMemory();
      bump(s.memory, "disaster");
    });
  }

  function tier(n, step, cap) {
    return Math.min(cap, Math.floor((n || 0) / step));
  }

  function pickWeighted(ids, weights) {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Math.max(1, weights[i]);
    let r = Math.random() * sum;
    for (let i = 0; i < ids.length; i++) {
      r -= Math.max(1, weights[i]);
      if (r <= 0) return ids[i];
    }
    return ids[ids.length - 1];
  }

  function pickTraitWeighted(settl) {
    return pickWeighted(TRAIT_IDS, [
      1 + tier((settl.memory || {}).hungry, 4, 6) + tier((settl.memory || {}).drought, 8, 4),
      1 + tier((settl.memory || {}).flood, 6, 5) + tier((settl.memory || {}).nearWater, 8, 5),
      1 + tier((settl.memory || {}).flood, 8, 4) + tier((settl.memory || {}).nearRock, 6, 6),
      1 + tier((settl.memory || {}).disaster, 1, 6),
      1 + tier((settl.memory || {}).crowded, 4, 4) + tier((settl.memory || {}).scarce, 4, 4),
      1 +
        tier((settl.memory || {}).nearWater, 8, 6) +
        tier((settl.memory || {}).flood, 6, 4) +
        tier((settl.memory || {}).boats, 1, 7),
      1 +
        tier((settl.memory || {}).hungry, 4, 5) +
        tier((settl.memory || {}).drought, 8, 4) +
        tier((settl.memory || {}).lush, 4, 7),
    ]);
  }

  function pickLegacyWeighted(settl) {
    const m = settl.memory || emptyMemory();
    const fed = (settl.hungryStreak || 0) === 0 ? 3 : 0;
    return pickWeighted(LEGACY_IDS, [
      1 + tier(m.drought, 8, 5) + tier(m.hungry, 6, 3),
      1 + fed + Math.max(0, 3 - tier(m.hungry, 8, 3)),
      1 + tier(m.ruins, 1, 5) + tier(m.quake, 1, 4),
      1 + tier(m.disaster, 1, 5) + tier(m.quake, 1, 3),
      1 + tier(m.disaster, 1, 4) + tier(m.sawNpc, 6, 4) + tier(m.halls, 2, 4),
    ]);
  }

  function groupOnOpenWater(game, list) {
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      const t = game.terrain[i];
      if (t !== TERRAIN.WATER && t !== TERRAIN.RIVER) continue;
      if (game.dikeCells && game.dikeCells[i]) continue;
      if (game.raftCells && game.raftCells[i]) continue;
      return true;
    }
    return false;
  }

  function findGroups(game, shelter) {
    const cols = game.cols;
    const rows = game.rows;
    const seen = new Uint8Array(game.life.length);
    const groups = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const start = W.idx(x, y, cols);
        if (!game.life[start] || seen[start]) continue;
        const who = ownerOf(game, start);
        const stack = [start];
        seen[start] = 1;
        const members = {};
        const list = [];
        let sx = 0;
        let sy = 0;
        while (stack.length) {
          const i = stack.pop();
          members[i] = 1;
          list.push(i);
          const cx = i % cols;
          const cy = (i - cx) / cols;
          sx += cx;
          sy += cy;
          for (let d = 0; d < 4; d++) {
            const ni = idx(game, cx + dirs[d][0], cy + dirs[d][1]);
            if (seen[ni] || !game.life[ni]) continue;
            if (ownerOf(game, ni) !== who) continue;
            if (game.terrain[ni] === TERRAIN.ROCK || game.terrain[ni] === TERRAIN.SNOW) continue;
            seen[ni] = 1;
            stack.push(ni);
          }
        }
        const size = list.length;
        const block = hasSolidBlock(game, members);
        const spark = groupHasSpark(game, list);
        groups.push({
          members: members,
          list: list,
          size: size,
          block: block,
          owner: who,
          npc: who > 0,
          cx: sx / size,
          cy: sy / size,
          weak: size < 8 && !block && !groupHasShelter(list, shelter) && !spark,
          civ: size >= CIV_MIN && block && !groupOnOpenWater(game, list),
        });
      }
    }
    return groups;
  }

  function overlapCount(aMembers, listB) {
    let n = 0;
    for (let i = 0; i < listB.length; i++) if (aMembers[listB[i]]) n++;
    return n;
  }

  function pickTrait(settl) {
    return pickTraitWeighted(settl || { memory: emptyMemory() });
  }

  function pickLegacy(settl) {
    return pickLegacyWeighted(settl || { memory: emptyMemory() });
  }

  function potencyOf(s) {
    if (!s) return 0;
    return Math.min(2, Math.floor((s.age || 0) / 80) + Math.floor((s.rebirths || 0) / 3));
  }

  function tryLegacy(game, settl, events) {
    inheritFactionSkills(game, settl);
    if (settl.legacy) {
      rememberSkills(game, settl);
      return;
    }
    if (potencyOf(settl) < 1) return;
    settl.legacy = pickLegacy(settl);
    rememberSkills(game, settl);
    events.push("一座聚落學會了遺芳「" + LEGACIES[settl.legacy].name + "」");
  }

  function withLineage(settl, src) {
    src = src || {};
    settl.rebirths = src.rebirths || 0;
    settl.legacy = src.legacy || null;
    settl.lineageId = src.lineageId || src.id || settl.id;
    settl.inspiredBy = src.inspiredBy ? Object.assign({}, src.inspiredBy) : {};
    settl.caravanIn = src.caravanIn != null ? src.caravanIn : 20 + Math.floor(Math.random() * 12);
    settl.memory = Object.assign(emptyMemory(), src.memory || {});
    settl.hungryStreak = src.hungryStreak || 0;
    settl.walled = !!src.walled;
    settl.seedIn = src.seedIn != null ? src.seedIn : 12 + Math.floor(Math.random() * 10);
    settl.riteVisitIn = src.riteVisitIn != null ? src.riteVisitIn : 28 + Math.floor(Math.random() * 20);
    return settl;
  }

  function tryRoll(game, settl, events) {
    inheritFactionSkills(game, settl);
    if (settl.trait) {
      rememberSkills(game, settl);
      return;
    }
    const f = ensureFaction(game, settl.owner || 0);
    const age = Math.max(settl.age || 0, f.lived || 0);
    const need = settl.nextRoll || f.nextRoll || ROLL_AGE;
    if (age < need) return;
    if (Math.random() < 0.7) {
      settl.trait = pickTrait(settl);
      rememberSkills(game, settl);
      events.push("一座聚落學會了" + TRAITS[settl.trait].name);
    } else {
      settl.nextRoll = age + ROLL_RETRY;
      f.nextRoll = settl.nextRoll;
    }
  }

  function trackSettlements(game, groups) {
    const events = [];
    const civGroups = groups.filter(function (g) {
      return g.civ;
    });
    const prev = (game.settlements || []).concat(game.ghosts || []);
    const usedPrev = {};
    const usedNew = {};
    const pairs = [];
    for (let p = 0; p < prev.length; p++) {
      for (let n = 0; n < civGroups.length; n++) {
        const ov = overlapCount(prev[p].members || {}, civGroups[n].list);
        if (!ov) continue;
        const denom = Math.max(prev[p].size, civGroups[n].size);
        const score = ov / denom;
        pairs.push({ p: p, n: n, ov: ov, score: score });
      }
    }
    pairs.sort(function (a, b) {
      return b.ov - a.ov || b.score - a.score;
    });
    const matched = [];
    pairs.forEach(function (pair) {
      if (usedPrev[pair.p] || usedNew[pair.n]) return;
      if (pair.score < OVERLAP && pair.ov < 4) return;
      usedPrev[pair.p] = 1;
      usedNew[pair.n] = 1;
      matched.push(pair);
    });

    const next = [];
    matched.forEach(function (pair) {
      const old = prev[pair.p];
      const g = civGroups[pair.n];
      const settl = {
        id: old.id,
        members: g.members,
        list: g.list,
        size: g.size,
        cx: g.cx,
        cy: g.cy,
        age: old.age + 1,
        trait: old.trait,
        nextRoll: old.nextRoll || ROLL_AGE,
        miss: 0,
        npc: !!(old.npc || g.npc),
        owner: old.owner != null ? old.owner : g.owner,
        hearthDropped: old.hearthDropped,
      };
      withLineage(settl, old);
      inheritFactionSkills(game, settl);
      tallyExperience(game, settl);
      tryRoll(game, settl, events);
      tryLegacy(game, settl, events);
      if (settl.legacy === "rite" && settl.age % 16 === 0) {
        const who = settl.owner || 0;
        let gift = Math.min(6, Math.max(1, Math.floor(settl.size / 8)));
        if (isHungry(game, who)) gift = Math.min(8, gift + 2);
        addFood(game, who, gift);
        events.push("歲祀：+" + gift + " 糧");
      }
      if (settl.age && settl.age % (hasFarm(game, settl) ? 4 : 8) === 0) harvestTown(game, settl);
      next.push(settl);
    });

    civGroups.forEach(function (g, n) {
      if (usedNew[n]) return;
      let ghost = null;
      let ghostIdx = -1;
      for (let p = 0; p < prev.length; p++) {
        if (usedPrev[p]) continue;
        if ((prev[p].miss || 0) > GRACE) continue;
        const dx = prev[p].cx - g.cx;
        const dy = prev[p].cy - g.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = g.size / Math.max(1, prev[p].size);
        if (dist <= 10 && ratio > 0.45 && ratio < 2.2) {
          if (!ghost || dist < Math.sqrt(Math.pow(ghost.cx - g.cx, 2) + Math.pow(ghost.cy - g.cy, 2))) {
            ghost = prev[p];
            ghostIdx = p;
          }
        }
      }
      if (ghost) {
        usedPrev[ghostIdx] = 1;
        const settl = {
          id: ghost.id,
          members: g.members,
          list: g.list,
          size: g.size,
          cx: g.cx,
          cy: g.cy,
          age: ghost.age + 1,
          trait: ghost.trait,
          nextRoll: ghost.nextRoll || ROLL_AGE,
          miss: 0,
          npc: !!(ghost.npc || g.npc),
          owner: ghost.owner != null ? ghost.owner : g.owner,
          hearthDropped: ghost.hearthDropped,
        };
        withLineage(settl, ghost);
        inheritFactionSkills(game, settl);
        tallyExperience(game, settl);
        tryRoll(game, settl, events);
        tryLegacy(game, settl, events);
        next.push(settl);
        if (ghost.age < 2 && !settl.npc) events.push("一座聚落形成");
      } else {
        const npc = !!g.npc;
        const settl = withLineage({
          id: game.nextSettleId++,
          members: g.members,
          list: g.list,
          size: g.size,
          cx: g.cx,
          cy: g.cy,
          age: 1,
          trait: null,
          nextRoll: npc ? 9999 : ROLL_AGE,
          miss: 0,
          npc: npc,
          owner: g.owner || 0,
          hearthDropped: false,
        }, { id: game.nextSettleId });
        settl.lineageId = settl.id;
        inheritFactionSkills(game, settl);
        tallyExperience(game, settl);
        if (npc && !settl.trait) settl.trait = pickTrait(settl);
        rememberSkills(game, settl);
        next.push(settl);
        if (!npc) events.push("一座聚落形成");
      }
    });

    const ghosts = [];
    for (let p = 0; p < prev.length; p++) {
      if (usedPrev[p]) continue;
      const miss = (prev[p].miss || 0) + 1;
      if (miss <= GRACE) {
        ghosts.push(withLineage({
          id: prev[p].id,
          members: prev[p].members,
          list: prev[p].list,
          size: prev[p].size,
          cx: prev[p].cx,
          cy: prev[p].cy,
          age: prev[p].age,
          trait: prev[p].trait,
          nextRoll: prev[p].nextRoll,
          miss: miss,
          npc: prev[p].npc,
          owner: prev[p].owner,
          hearthDropped: prev[p].hearthDropped,
        }, prev[p]));
      } else if (!prev[p].hearthDropped) {
        dropRuinFromMembers(game, prev[p].members, prev[p]);
      }
    }

    game.settlements = next;
    game.ghosts = ghosts;
    const civCells = {};
    const dikeCells = {};
    const expandCells = {};
    next.forEach(function (s) {
      s.list.forEach(function (i) {
        civCells[i] = s;
        if (s.trait === "dike") {
          dikeCells[i] = 1;
          if (potencyOf(s) >= 1) {
            const x = i % game.cols;
            const y = (i - x) / game.cols;
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
              const ni = idx(game, x + d[0], y + d[1]);
              if (game.terrain[ni] === TERRAIN.WATER) dikeCells[ni] = 1;
            });
          }
        }
        if (s.trait === "expand") expandCells[i] = s.id;
      });
    });
    game.civCells = civCells;
    game.dikeCells = dikeCells;
    game.expandCells = expandCells;
    updateFactions(game, events);
    return events;
  }

  function markExpandBirths(game, sprout) {
    sprout = sprout || {};
    const caps = {};
    const candidates = [];
    game.settlements.forEach(function (s) {
      if (s.trait !== "expand") return;
      if (foodOf(game, s.owner || 0) < 12 || isHungry(game, s.owner || 0)) return;
      caps[s.id] = 0;
      s.list.forEach(function (i) {
        const x = i % game.cols;
        const y = (i - x) / game.cols;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = W.wrap(x + dx, game.cols);
            const ny = y + dy;
            if (ny < 0 || ny >= game.rows) continue;
            const t = game.terrain[W.idx(nx, ny, game.cols)];
            if (t !== TERRAIN.SOIL && t !== TERRAIN.FERTILE && t !== TERRAIN.ICE && t !== TERRAIN.SAND && t !== TERRAIN.MARSH && t !== TERRAIN.GROVE && t !== TERRAIN.HIGHLAND) continue;
            const ni = W.idx(nx, ny, game.cols);
            if (game.life[ni]) continue;
            let n = 0;
            for (let ey = -1; ey <= 1; ey++) {
              for (let ex = -1; ex <= 1; ex++) {
                if (!ex && !ey) continue;
                const ei = idx(game, nx + ex, ny + ey);
                if (game.terrain[ei] === TERRAIN.ROCK) continue;
                if (game.life[ei]) n++;
              }
            }
            if (n !== 2) continue;
            candidates.push({ i: ni, id: s.id, cap: 2 + potencyOf(s) });
          }
        }
      });
    });
    shuffledLocal(candidates).forEach(function (c) {
      if (caps[c.id] >= (c.cap || EXPAND_CAP)) return;
      sprout[c.i] = 1;
      sprout["cap-" + c.i] = c.id;
      caps[c.id] = (caps[c.id] || 0) + 1;
    });
    game.expandCaps = caps;
    return sprout;
  }

  function shuffledLocal(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function tryHearthSpark(game, groups, isPlantable) {
    isPlantable = isPlantable || function (g, x, y) {
      const t = g.terrain[W.idx(x, y, g.cols)];
      return t === TERRAIN.SOIL || t === TERRAIN.FERTILE || t === TERRAIN.ICE;
    };
    let sparked = false;
    (groups || []).forEach(function (g) {
      if (g.size < 8 || g.block) return;
      if (Math.random() > 0.04) return;
      const origins = shuffledLocal(g.list.slice());
      for (let k = 0; k < origins.length; k++) {
        const i = origins[k];
        const x = i % game.cols;
        const y = (i - x) / game.cols;
        const cells = [
          W.idx(x, y, game.cols),
          idx(game, x + 1, y),
          idx(game, x, y + 1),
          idx(game, x + 1, y + 1),
        ];
        let live = 0;
        let ok = true;
        const fill = [];
        for (let n = 0; n < 4; n++) {
          const ci = cells[n];
          const cx = ci % game.cols;
          const cy = (ci - cx) / game.cols;
          if (game.terrain[ci] === TERRAIN.ROCK) {
            ok = false;
            break;
          }
          if (game.life[ci]) {
            if (!g.members[ci]) {
              ok = false;
              break;
            }
            live += 1;
          } else {
            if (!isPlantable(game, cx, cy)) {
              ok = false;
              break;
            }
            fill.push(ci);
          }
        }
        if (!ok || live < 2 || live > 3 || !fill.length) continue;
        const who = g.owner || 0;
        fill.forEach(function (ci) {
          game.life[ci] = 1;
          if (game.owner) game.owner[ci] = who;
        });
        markSpark(game, cells);
        sparked = true;
        break;
      }
    });
    return sparked;
  }

  function ruinIndex(game) {
    const map = {};
    (game.ruinSites || []).forEach(function (site, s) {
      site.cells.forEach(function (i) {
        map[i] = s;
      });
    });
    return map;
  }

  function washRuins(game) {
    if (!game.ruinSites) return;
    game.ruinSites = game.ruinSites.filter(function (site) {
      site.cells = site.cells.filter(function (i) {
        const t = game.terrain[i];
        return t === TERRAIN.SOIL || t === TERRAIN.FERTILE || t === TERRAIN.ICE;
      });
      return site.cells.length > 0;
    });
  }

  function dropRuinFromMembers(game, members, meta) {
    if (!members) return;
    const block = solidBlockCells(members, game);
    if (!block) return;
    const cells = [];
    for (let k = 0; k < block.length; k++) {
      const i = block[k];
      const t = game.terrain[i];
      if (t !== TERRAIN.SOIL && t !== TERRAIN.FERTILE && t !== TERRAIN.ICE && t !== TERRAIN.HIGHLAND && t !== TERRAIN.GROVE && t !== TERRAIN.MARSH) continue;
      if (game.life && game.life[i]) continue;
      cells.push(i);
    }
    if (!cells.length) return;
    const existing = ruinIndex(game);
    for (let k = 0; k < cells.length; k++) {
      if (existing[cells[k]] != null) return;
    }
    if (!game.ruinSites) game.ruinSites = [];
    while (game.ruinSites.length >= RUIN_MAX) game.ruinSites.shift();
    meta = meta || {};
    game.ruinSites.push({
      cells: cells,
      age: 0,
      lineageId: meta.lineageId || meta.id,
      trait: meta.trait || null,
      legacy: meta.legacy || null,
      rebirths: meta.rebirths || 0,
      civAge: meta.age || 0,
      owner: meta.owner || 0,
    });
  }

  function bloomRuins(game, sites) {
    const notes = [];
    if (!sites || !sites.length) return notes;
    if (!game.baseTerrain) return notes;
    const cols = game.cols;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let grew = 0;
    for (let s = 0; s < sites.length && grew < 2; s++) {
      const site = sites[s];
      if ((site.age || 0) < 24) continue;
      const cells = site.cells || [];
      for (let k = 0; k < cells.length && grew < 2; k++) {
        const i = cells[k];
        const x = i % cols;
        const y = (i - x) / cols;
        const d = dirs[Math.floor(Math.random() * 4)];
        const ni = idx(game, x + d[0], y + d[1]);
        if (ni < 0 || ni >= game.baseTerrain.length) continue;
        if (game.life && game.life[ni]) continue;
        const t = game.baseTerrain[ni];
        if (t === TERRAIN.SOIL) {
          const next = Math.random() < 0.55 ? TERRAIN.GROVE : TERRAIN.FERTILE;
          if (W.writeLand && W.writeLand(game, ni, next)) grew++;
        } else if (
          (t === TERRAIN.FERTILE || t === TERRAIN.GROVE || t === TERRAIN.MARSH) &&
          game.resources &&
          !game.resources[ni] &&
          Math.random() < 0.22
        ) {
          game.resources[ni] = RESOURCE.NUTRIENT;
          if (game.resAmt) game.resAmt[ni] = 1;
          grew++;
        }
      }
      if ((site.age || 0) >= 80 && !site.forestTold) {
        site.forestTold = 1;
        notes.push("舊址生出林木");
      }
    }
    return notes;
  }

  function occupyRuins(game) {
    const sites = game.ruinSites || [];
    if (!sites.length) return [];
    const events = [];
    const kept = [];
    sites.forEach(function (site) {
      let hit = -1;
      for (let k = 0; k < site.cells.length; k++) {
        if (game.life[site.cells[k]]) {
          hit = site.cells[k];
          break;
        }
      }
      if (hit < 0) {
        kept.push(site);
        return;
      }
      let food = RUIN_FOOD;
      let energy = RUIN_ENERGY;
      const s = game.civCells && game.civCells[hit];
      if (s && site.lineageId) {
        s.memory = s.memory || emptyMemory();
        bump(s.memory, "ruins");
        if (s.legacy === "hearth" && s.lineageId === site.lineageId) {
          food += 4;
          energy += 2;
        }
        if (s.legacy === "rite") food += 3;
        const sameLine = s.lineageId === site.lineageId;
        if (!sameLine || !s.trait) {
          s.lineageId = site.lineageId;
          if (site.trait && !s.trait) s.trait = site.trait;
          if (site.legacy && !s.legacy) s.legacy = site.legacy;
          s.rebirths = (s.rebirths || 0) + 1;
          s.age = Math.max(s.age || 0, site.civAge || 0);
          events.push("一座聚落繼承了火種");
        }
      }
      game.energy += energy;
      addFood(game, ownerOf(game, hit), food);
      const x = hit % game.cols;
      const y = (hit - x) / game.cols;
      game.flashes.push({ x: x, y: y, age: 0, ruin: true });
      events.push("佔領遺址：+" + food + " 糧、+" + energy + " 能");
    });
    kept.forEach(function (site) {
      site.age = (site.age || 0) + 1;
    });
    const bloom = bloomRuins(game, kept);
    bloom.forEach(function (e) {
      events.push(e);
    });
    game.ruinSites = kept;
    return events;
  }

  function killGroup(game, group) {
    group.list.forEach(function (i) {
      game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
    });
    if (group.civ) {
      const s = game.civCells && game.civCells[group.list[0]];
      dropRuinFromMembers(game, group.members, s);
    }
  }

  function quakeChance(game, group) {
    const s = settlOfGroup(game, group);
    const p = potencyOf(s);
    const resist = !!(s && s.trait === "resist");
    const ward = !!(s && s.legacy === "ward");
    if (resist && ward) return scaleQuake([0.4, 0.28, 0.18][p], game, s);
    if (resist || ward) return scaleQuake([0.55, 0.4, 0.28][p], game, s);
    return scaleQuake(0.72, game, s);
  }

  function scaleQuake(pKill, game, s) {
    if (isKingdomOwner(game, s && s.owner)) return pKill * 0.85;
    return pKill;
  }

  function uniqueIndices(list) {
    const seen = {};
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (seen[v]) continue;
      seen[v] = 1;
      out.push(v);
    }
    return out;
  }

  function fireQuake(game, groups) {
    const hardy = (game.skillCells && game.skillCells.hardy) || {};
    let houses = 0;
    let walls = 0;
    groups.forEach(function (g) {
      if (!g.civ) return;
      const s = settlOfGroup(game, g);
      const pKill = quakeChance(game, g);
      const toKill = [];
      const block = solidBlockCells(g.members, game);
      if (block) {
        block.forEach(function (i) {
          if (Math.random() < pKill) toKill.push(i);
        });
      }
      if (s && s.legacy === "wall") {
        g.list.forEach(function (i) {
          if (!hardy[i]) return;
          if (Math.random() < pKill) {
            toKill.push(i);
            walls += 1;
          }
        });
      }
      uniqueIndices(toKill).forEach(function (i) {
        if (!game.life[i]) return;
        game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
        houses += 1;
      });
      if (s) {
        s.memory = s.memory || emptyMemory();
        bump(s.memory, "quake");
      }
      if (block) dropRuinFromMembers(game, g.members, s);
    });
    smashRafts(game);
    let note = "地震掠過，房屋仍在";
    if (walls) note = "地震：城牆崩解";
    else if (houses) note = "地震：房屋倒塌";
    if (Math.random() < 0.33 && W.spawnVolcanoIsle) {
      const isle = W.spawnVolcanoIsle(game);
      if (isle) return note + "。" + isle;
    }
    return note;
  }

  function fireDisaster(game, groups) {
    game.disasterIn -= 1;
    game.omen = game.disasterIn > 0 && game.disasterIn <= 8;
    if (game.disasterIn > 0) return { events: [], extreme: false, quake: false };
    game.disasterIn = disasterWait();
    game.omen = false;
    const events = [];
    groups.forEach(function (g) {
      if (g.weak) killGroup(game, g);
    });
    const kindRoll = Math.random();
    if (kindRoll >= 0.6) {
      rememberDisaster(game, groups);
      events.push("災變：弱小族群被抹去");
      return { events: events, extreme: false, quake: false };
    }
    if (kindRoll >= 0.3) {
      const note = fireQuake(game, groups);
      rememberDisaster(game, groups);
      events.push(note);
      return { events: events, extreme: false, quake: true };
    }
    const civs = groups.filter(function (g) {
      return g.civ;
    });
    const byOwner = {};
    civs.forEach(function (g) {
      const o = g.owner || 0;
      if (!byOwner[o]) byOwner[o] = [];
      byOwner[o].push(g);
    });
    const doomed = [];
    let spared = false;
    Object.keys(byOwner).forEach(function (key) {
      const list = byOwner[key];
      const local = [];
      list.forEach(function (g) {
        const chance = disasterChance(game, g);
        if (Math.random() < chance) local.push(g);
      });
      if (local.length === list.length && list.length > 0) {
        local.sort(function (a, b) {
          const ar = disasterChance(game, a);
          const br = disasterChance(game, b);
          if (ar !== br) return br - ar;
          return a.size - b.size;
        });
        local.pop();
        spared = true;
      }
      local.forEach(function (g) {
        doomed.push(g);
      });
    });
    doomed.forEach(function (g) {
      killGroup(game, g);
    });
    rememberDisaster(game, groups);
    events.push(spared ? "極端氣候侵襲，各族留下最後一座聚落" : "極端氣候侵襲");
    return { events: events, extreme: true, quake: false };
  }

  function harvestTown(game, settl) {
    if (!settl || !settl.list) return 0;
    let lush = 0;
    (settl.list || []).forEach(function (i) {
      if (!game.life[i]) return;
      const t = game.terrain[i];
      if (t === TERRAIN.FERTILE || t === TERRAIN.GROVE || t === TERRAIN.MARSH) lush += 1;
    });
    const farm = hasFarm(game, settl);
    if (!lush && !farm) return 0;
    let gift = lush ? 1 + Math.min(2, Math.floor(lush / 8)) : 0;
    if (settl.legacy === "rite") gift += 1;
    if (farm) gift = Math.max(2, gift * 2 + 1);
    if (gift) addFood(game, settl.owner || 0, gift);
    if (farm && Math.random() < 0.55) sowTownCrystal(game, settl);
    return gift;
  }

  function sowTownCrystal(game, settl) {
    if (!game.resources || !settl || !settl.list) return false;
    if (!game.resAmt || game.resAmt.length !== game.resources.length) {
      game.resAmt = new Uint8Array(game.life.length);
    }
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 1], [-3, 1], [1, 3], [-1, -3]];
    const ox = Math.round(settl.cx);
    const oy = Math.round(settl.cy);
    for (let t = 0; t < dirs.length; t++) {
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      const x = W.wrap(ox + d[0], game.cols);
      const y = oy + d[1];
      if (y < 0 || y >= game.rows) continue;
      const i = W.idx(x, y, game.cols);
      if (game.life[i] || game.resources[i]) continue;
      const tt = game.terrain[i];
      if (tt === TERRAIN.ROCK || tt === TERRAIN.WATER || tt === TERRAIN.RIVER || tt === TERRAIN.SNOW) continue;
      game.resources[i] = RESOURCE.CRYSTAL;
      game.resAmt[i] = 1;
      return true;
    }
    return false;
  }

  function foodWeight(game, i, cache) {
    if (!game.life[i]) return 0;
    if (cache && cache[i]) return 0;
    const spec = W.TERRAIN_LIFE[game.terrain[i]] || W.TERRAIN_LIFE[TERRAIN.SOIL];
    const terra = spec.food == null ? 1 : spec.food;
    const s = game.civCells && game.civCells[i];
    let w = terra;
    if (s) {
      if (s.trait === "deep") w = terra * [0.22, 0.16, 0.1][potencyOf(s)];
      else w = terra * 0.38;
      const home = homeTown(game, s.owner || 0);
      if (home && s.id !== home.id && s.size < 16) {
        const dist = wrapDelta(s.cx, home.cx, game.cols) + distY(s.cy, home.cy);
        if (dist > 8) w *= 0.45;
      }
    } else {
      w = terra * 0.3;
    }
    if (isSpark(game, i)) w *= 0.55;
    w *= densityScale(game, s ? s.owner : ownerOf(game, i));
    return w;
  }

  function starveRank(game, i, n) {
    if (isSpark(game, i)) return 1000 + n;
    const s = game.civCells && game.civCells[i];
    if (s) {
      const home = homeTown(game, s.owner || 0);
      if (home && s.id !== home.id && s.size < 16) return 800 + n;
      if (s.size >= 20) return -n;
    }
    return n;
  }

  function traitLabel(game) {
    const n = (game.settlements || []).length;
    const live = livingFactionCount(game);
    if (!n && !live) return "0";
    const f = game.factions && game.factions[0];
    const rank = f && f.empire ? "帝國" : f && f.kingdom ? "王國" : "";
    const tribe = "活族 " + live;
    if (rank) return "文明一 · " + rank + " · " + tribe;
    return (n ? n + " 鎮 · " : "") + tribe;
  }

  function normCells(cells) {
    const minX = Math.min.apply(null, cells.map(function (p) { return p[0]; }));
    const minY = Math.min.apply(null, cells.map(function (p) { return p[1]; }));
    return cells.map(function (p) {
      return [p[0] - minX, p[1] - minY];
    });
  }

  function rot90(cells) {
    return normCells(cells.map(function (p) {
      return [-p[1], p[0]];
    }));
  }

  function flipX(cells) {
    return normCells(cells.map(function (p) {
      return [-p[0], p[1]];
    }));
  }

  function villageVariants() {
    const seen = {};
    const out = [];
    let cur = normCells(VILLAGE_SRC);
    for (let r = 0; r < 4; r++) {
      [cur, flipX(cur)].forEach(function (v) {
        const key = v.map(function (p) { return p.join(","); }).join(";");
        if (!seen[key]) {
          seen[key] = true;
          out.push(v);
        }
      });
      cur = rot90(cur);
    }
    return out;
  }

  const VILLAGE_VARIANTS = villageVariants();

  function wrapDelta(a, b, max) {
    const d = Math.abs(a - b);
    return Math.min(d, max - d);
  }

  function distY(a, b) {
    return Math.abs(a - b);
  }

  function tooCloseToPlayer(game, cells, ox, oy) {
    const cols = game.cols;
    const rows = game.rows;
    for (let n = 0; n < cells.length; n++) {
      const x = W.wrap(ox + cells[n][0], cols);
      const y = oy + cells[n][1];
      if (y < 0 || y >= rows) return true;
      for (let i = 0; i < game.life.length; i++) {
        if (!game.life[i]) continue;
        const px = i % cols;
        const py = (i - px) / cols;
        if (Math.max(wrapDelta(x, px, cols), distY(y, py)) < NPC_DIST) {
          return true;
        }
      }
    }
    return false;
  }

  function npcTownCount(game) {
    const ids = {};
    let n = 0;
    (game.settlements || []).forEach(function (s) {
      if (!s.npc) return;
      const key = s.owner || s.id;
      if (ids[key]) return;
      ids[key] = 1;
      n++;
    });
    if (n) return n;
    const seen = {};
    if (!game.owner) return 0;
    for (let i = 0; i < game.owner.length; i++) {
      const o = game.owner[i];
      if (o && game.life[i] && !seen[o]) {
        seen[o] = 1;
        n++;
      }
    }
    return n;
  }

  function canPlaceVillage(game, cells, ox, oy) {
    const cols = game.cols;
    const sites = ruinIndex(game);
    let fertile = 0;
    let rockAdj = 0;
    for (let n = 0; n < cells.length; n++) {
      const x = W.wrap(ox + cells[n][0], cols);
      const y = oy + cells[n][1];
      if (y < 0 || y >= game.rows) return null;
      const i = W.idx(x, y, cols);
      const t = game.terrain[i];
      if (t !== TERRAIN.SOIL && t !== TERRAIN.FERTILE && t !== TERRAIN.MARSH && t !== TERRAIN.GROVE) return null;
      if (game.life[i]) return null;
      if (sites[i] != null) return null;
      if (game.stain && game.stain[i] >= 4) return null;
      if (t === TERRAIN.FERTILE) fertile++;
      if (W.isRockAdjacent(game.terrain, x, y, game.cols, game.rows)) rockAdj++;
    }
    return fertile * 8 + rockAdj;
  }

  function trySpawnNpc(game, options) {
    options = options || {};
    if (game.npcIn == null) game.npcIn = npcWait(game);
    game.npcIn -= 1;
    if (game.npcIn > 0) return null;
    game.npcIn = npcWait(game);
    if (options.flood) return null;
    if (livingFactionCount(game) >= LIVING_CAP) return null;
    if (npcTownCount(game) >= NPC_MAX) return null;
    if (!game.owner) {
      game.owner = new Uint8Array(game.life.length);
    }
    let best = null;
    const variants = VILLAGE_VARIANTS;
    for (let attempt = 0; attempt < 140; attempt++) {
      const cells = variants[Math.floor(Math.random() * variants.length)];
      const ox = Math.floor(Math.random() * game.cols);
      const oy = Math.floor(Math.random() * game.rows);
      const score = canPlaceVillage(game, cells, ox, oy);
      if (score == null) continue;
      if (tooCloseToPlayer(game, cells, ox, oy)) continue;
      if (!best || score > best.score) {
        best = { cells: cells, ox: ox, oy: oy, score: score };
      }
      if (score >= 32) break;
    }
    if (!best) return null;
    const who = game.nextNpcOwner || 1;
    game.nextNpcOwner = who + 1;
    ensureFaction(game, who).alive = true;
    best.cells.forEach(function (p) {
      const x = W.wrap(best.ox + p[0], game.cols);
      const y = best.oy + p[1];
      if (y < 0 || y >= game.rows) return;
      const i = W.idx(x, y, game.cols);
      game.life[i] = 1;
      game.owner[i] = who;
    });
    addFood(game, who, NPC_START_FOOD);
    return "遠方出現" + civName(who + 1);
  }

  const SNAKE_SRC_CELLS = [
    [0, 0], [1, 0],
    [1, 1],
    [2, 2], [3, 2],
  ];

  function snakeVariants() {
    const seen = {};
    const out = [];
    let cur = normCells(SNAKE_SRC_CELLS);
    for (let r = 0; r < 4; r++) {
      [cur, flipX(cur)].forEach(function (v) {
        const key = v.map(function (p) { return p.join(","); }).join(";");
        if (!seen[key]) {
          seen[key] = true;
          out.push(v);
        }
      });
      cur = rot90(cur);
    }
    return out;
  }

  const SNAKE_SHAPES = snakeVariants();

  function dismissCaravan(game, caravan) {
    (caravan.cells || []).forEach(function (i) {
      if (game.life[i]) game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
    });
  }

  function caravanAlive(game, caravan) {
    let n = 0;
    (caravan.cells || []).forEach(function (i) {
      if (game.life[i]) n++;
    });
    return n >= 3;
  }

  function pickCaravanTarget(game, settl) {
    let bestTown = null;
    let bestScore = -1;
    (game.settlements || []).forEach(function (s) {
      if (s.id === settl.id) return;
      if ((s.owner || 0) !== (settl.owner || 0)) return;
      const weaker = potencyOf(s) < potencyOf(settl) || !s.trait;
      const score = (weaker ? 40 : 10) - Math.abs(s.cx - settl.cx) - Math.abs(s.cy - settl.cy);
      if (score > bestScore) {
        bestScore = score;
        bestTown = s;
      }
    });
    if (bestTown) {
      return { kind: "town", id: bestTown.id, cx: bestTown.cx, cy: bestTown.cy };
    }
    let ruin = null;
    (game.ruinSites || []).forEach(function (site) {
      if ((site.owner || 0) !== (settl.owner || 0)) return;
      const i = site.cells[0];
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      if (!ruin) ruin = { kind: "ruin", cx: x, cy: y, site: site };
    });
    return ruin;
  }

  function pickRaidTarget(game, settl) {
    let best = null;
    let bestScore = -999;
    (game.settlements || []).forEach(function (s) {
      if (s.id === settl.id) return;
      if ((s.owner || 0) === (settl.owner || 0)) return;
      const dist = wrapDelta(s.cx, settl.cx, game.cols) + distY(s.cy, settl.cy);
      if (dist > 22) return;
      const score = 40 - dist;
      if (score > bestScore) {
        bestScore = score;
        best = { kind: "raid", id: s.id, cx: s.cx, cy: s.cy };
      }
    });
    return best;
  }

  function pickMigrateTarget(game, settl, isPlantable) {
    let best = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = Math.floor(Math.random() * game.cols);
      const y = Math.floor(Math.random() * game.rows);
      if (!isPlantable(game, x, y)) continue;
      const i = W.idx(x, y, game.cols);
      if (game.life[i]) continue;
      const dist = wrapDelta(x, settl.cx, game.cols) + distY(y, settl.cy);
      if (dist < 12) continue;
      let wealth = 0;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const ni = idx(game, x + dx, y + dy);
          if (game.life[ni]) wealth -= 2;
          const r = game.resources && game.resources[ni];
          if (r === RESOURCE.CRYSTAL) wealth += 12;
          else if (r === RESOURCE.NUTRIENT) wealth += 3;
          if (game.terrain[ni] === TERRAIN.FERTILE) wealth += 1;
        }
      }
      const score = wealth - dist * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = { kind: "res", cx: x, cy: y };
      }
    }
    if (!best || bestScore < 4) return null;
    return best;
  }

  function spawnSnake(game, settl, target, isPlantable, kind) {
    if (!target) return false;
    const ox = Math.round(settl.cx);
    const oy = Math.round(settl.cy);
    const dirX = target.cx > ox ? 1 : target.cx < ox ? -1 : 0;
    const dirY = target.cy > oy ? 1 : target.cy < oy ? -1 : 0;
    const shapes = SNAKE_SHAPES;
    for (let attempt = 0; attempt < 24; attempt++) {
      const shape = shapes[attempt % shapes.length];
      const bx = W.wrap(ox + dirX * (3 + (attempt % 5)) + (attempt % 3) - 1, game.cols);
      const by = oy + dirY * (3 + (attempt % 5)) + (Math.floor(attempt / 3) % 3) - 1;
      if (by < 0 || by >= game.rows) continue;
      let ok = true;
      const cells = [];
      for (let n = 0; n < shape.length; n++) {
        const x = W.wrap(bx + shape[n][0], game.cols);
        const y = by + shape[n][1];
        if (y < 0 || y >= game.rows) {
          ok = false;
          break;
        }
        if (!isPlantable(game, x, y)) {
          ok = false;
          break;
        }
        const i = W.idx(x, y, game.cols);
        if (game.life[i]) {
          ok = false;
          break;
        }
        cells.push(i);
      }
      if (!ok) continue;
      cells.forEach(function (i) {
        game.life[i] = 1;
        if (game.owner) game.owner[i] = settl.owner || 0;
      });
      markSpark(game, cells);
      const lifeMax = kind === "fleet" ? FLEET_MAX_AGE : kind === "boat" ? 48 : kind === "migrate" ? 48 : 40;
      game.caravans.push({
        cells: cells,
        owner: settl.owner || 0,
        fromId: settl.id,
        lineageId: settl.lineageId || settl.id,
        trait: settl.trait,
        legacy: settl.legacy,
        potency: potencyOf(settl),
        target: target,
        kind: kind || "culture",
        age: 0,
        maxAge: lifeMax,
      });
      return true;
    }
    return false;
  }

  function spawnCaravan(game, settl, isPlantable) {
    return spawnSnake(game, settl, pickCaravanTarget(game, settl), isPlantable, "culture");
  }

  function spawnFleet(game, settl, target, isPlantable) {
    if (!target) return false;
    let ox = Math.round(settl.cx);
    let oy = Math.round(settl.cy);
    const list = settl.list || [];
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (!game.life[i]) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      let found = false;
      for (let d = 0; d < 4; d++) {
        const nx = W.wrap(x + dirs[d][0], game.cols);
        const ny = y + dirs[d][1];
        if (ny < 0 || ny >= game.rows) continue;
        const t = game.terrain[W.idx(nx, ny, game.cols)];
        if (t !== TERRAIN.WATER && t !== TERRAIN.RIVER) continue;
        if (game.life[W.idx(nx, ny, game.cols)]) continue;
        ox = nx;
        oy = ny;
        found = true;
        break;
      }
      if (found) break;
    }
    const dirX = target.cx > ox ? 1 : target.cx < ox ? -1 : 0;
    const dirY = target.cy > oy ? 1 : target.cy < oy ? -1 : 0;
    const px = dirY;
    const py = -dirX;
    const shapes = SNAKE_SHAPES;
    function boatShape(bx, by, shape, used) {
      const cells = [];
      for (let n = 0; n < shape.length; n++) {
        const x = W.wrap(bx + shape[n][0], game.cols);
        const y = by + shape[n][1];
        if (!canBoatStep(game, x, y)) return null;
        const i = W.idx(x, y, game.cols);
        if (game.life[i] || (used && used.indexOf(i) >= 0)) return null;
        cells.push(i);
      }
      return cells;
    }
    for (let attempt = 0; attempt < 56; attempt++) {
      const parties = [];
      const used = [];
      let ok = true;
      for (let p = 0; p < 3; p++) {
        const shape = shapes[(attempt + p) % shapes.length];
        const bx = W.wrap(ox + dirX * (1 + (attempt % 5)) + px * p * 4 + (attempt % 3) - 1, game.cols);
        const by = oy + dirY * (1 + (attempt % 5)) + py * p * 4 + (Math.floor(attempt / 3) % 3) - 1;
        const cells = boatShape(bx, by, shape, used);
        if (!cells) {
          ok = false;
          break;
        }
        parties.push(cells);
        cells.forEach(function (i) {
          used.push(i);
        });
      }
      if (!ok) continue;
      const all = [];
      const who = settl.owner || 0;
      parties.forEach(function (cells) {
        cells.forEach(function (i) {
          game.life[i] = 1;
          if (game.owner) game.owner[i] = who;
          all.push(i);
        });
      });
      markSpark(game, all);
      game.caravans.push({
        cells: all,
        parties: parties,
        owner: who,
        fromId: settl.id,
        lineageId: settl.lineageId || settl.id,
        trait: settl.trait,
        legacy: settl.legacy,
        potency: potencyOf(settl),
        target: target,
        kind: "fleet",
        age: 0,
        maxAge: FLEET_MAX_AGE,
      });
      return true;
    }
    return false;
  }

  function deliverCulture(game, caravan, dest, events) {
    if (!dest) return;
    if (caravan.trait && !dest.trait) dest.trait = caravan.trait;
    if (caravan.legacy && !dest.legacy) dest.legacy = caravan.legacy;
    dest.inspiredBy = dest.inspiredBy || {};
    if (caravan.lineageId && !dest.inspiredBy[caravan.lineageId] && caravan.potency >= potencyOf(dest)) {
      dest.inspiredBy[caravan.lineageId] = 1;
      dest.rebirths = (dest.rebirths || 0) + 1;
    }
    addFood(game, dest.owner || 0, 4);
    events.push("商隊把火種送到另一座聚落");
  }

  function raidArrived(game, caravan, events) {
    const target = caravan.target;
    const dest = (game.settlements || []).filter(function (s) {
      return s.id === target.id;
    })[0];
    if (!dest) return false;
    let hit = false;
    for (let n = 0; n < caravan.cells.length; n++) {
      const i = caravan.cells[n];
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let d = 0; d < dirs.length; d++) {
        const ni = idx(game, x + dirs[d][0], y + dirs[d][1]);
        if (dest.members && dest.members[ni] && game.life[ni]) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    if (!hit) return false;
    const victim = dest.owner || 0;
    const thief = caravan.owner || 0;
    const steal = Math.min(foodOf(game, victim), 4 + Math.floor(Math.random() * 5));
    spendFood(game, victim, steal);
    addFood(game, thief, steal);
    const walled = dest.legacy === "wall" && dest.walled;
    if (!walled) {
      const block = {};
      const hearth = solidBlockCells(dest.members, game);
      if (hearth) hearth.forEach(function (i) { block[i] = 1; });
      const edges = dest.list.filter(function (i) {
        return game.life[i] && !block[i];
      });
      shuffledLocal(edges).slice(0, 1 + Math.floor(Math.random() * 2)).forEach(function (i) {
        game.life[i] = 0;
        if (game.owner) game.owner[i] = 0;
      });
    }
    if (caravan.owner > 0) events.push(walled ? "客族搶糧，城垣守住爐芯" : "客族來搶糧");
    else events.push(walled ? "因糧而戰，城垣守住爐芯" : "因糧而戰");
    tryBorderAbsorb(game, victim, thief, events);
    return true;
  }

  const OUTPOST_SRC = VILLAGE_SRC;

  function findOutpostCells(game, live, isPlantable, maxAttempt, reserved) {
    if (!live || !live.length) return null;
    const i0 = live[0];
    const ox = i0 % game.cols;
    const oy = (i0 - ox) / game.cols;
    const tries = maxAttempt || 28;
    const spread = Math.max(4, Math.ceil(Math.sqrt(tries)));
    for (let attempt = 0; attempt < tries; attempt++) {
      const bx = W.wrap(ox + (attempt % spread) - Math.floor(spread / 2), game.cols);
      const by = oy + Math.floor(attempt / spread) - Math.floor(spread / 2);
      if (by < 0 || by >= game.rows) continue;
      let ok = true;
      const cells = [];
      for (let n = 0; n < OUTPOST_SRC.length; n++) {
        const x = W.wrap(bx + OUTPOST_SRC[n][0], game.cols);
        const y = by + OUTPOST_SRC[n][1];
        if (y < 0 || y >= game.rows) {
          ok = false;
          break;
        }
        if (!isPlantable(game, x, y)) {
          ok = false;
          break;
        }
        const i = W.idx(x, y, game.cols);
        if ((game.life[i] && live.indexOf(i) < 0) || (reserved && reserved[i])) {
          ok = false;
          break;
        }
        cells.push(i);
      }
      if (ok) return cells;
    }
    return null;
  }

  function plantOutpost(game, caravan, isPlantable) {
    const live = (caravan.cells || []).filter(function (i) {
      return game.life[i];
    });
    const cells = findOutpostCells(game, live, isPlantable, 28);
    if (!cells) return false;
    const who = caravan.owner || 0;
    dismissCaravan(game, caravan);
    cells.forEach(function (i) {
      game.life[i] = 1;
      if (game.owner) game.owner[i] = who;
    });
    markSpark(game, cells);
    return true;
  }

  function migrateArrived(game, caravan, isPlantable) {
    const target = caravan.target;
    if (!target) return false;
    let sx = 0;
    let sy = 0;
    let n = 0;
    (caravan.cells || []).forEach(function (i) {
      if (!game.life[i]) return;
      const x = i % game.cols;
      sx += x;
      sy += (i - x) / game.cols;
      n++;
    });
    if (!n) return false;
    const dist = wrapDelta(sx / n, target.cx, game.cols) + distY(sy / n, target.cy);
    if (dist > 3) return false;
    return plantOutpost(game, caravan, isPlantable);
  }

  function nearestPlantableCell(game, ox, oy, isPlantable, maxR) {
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) !== r) continue;
          const x = W.wrap(ox + dx, game.cols);
          const y = oy + dy;
          if (y < 0 || y >= game.rows) continue;
          if (!isPlantable(game, x, y)) continue;
          const i = W.idx(x, y, game.cols);
          if (game.life[i]) continue;
          return i;
        }
      }
    }
    return null;
  }

  function landFleet(game, caravan, isPlantable, force) {
    const who = caravan.owner || 0;
    const parties = caravan.parties && caravan.parties.length ? caravan.parties : [caravan.cells];
    const reserved = {};
    const planned = [];
    parties.forEach(function (party) {
      const live = (party || []).filter(function (i) {
        return game.life[i];
      });
      let cells = findOutpostCells(game, live, isPlantable, force ? 96 : 40, reserved);
      if (!cells && force && live.length) {
        const i0 = live[0];
        const near = nearestPlantableCell(game, i0 % game.cols, (i0 - (i0 % game.cols)) / game.cols, isPlantable, 16);
        if (near != null) cells = findOutpostCells(game, [near], isPlantable, 96, reserved);
      }
      if (!cells) return;
      cells.forEach(function (i) {
        reserved[i] = 1;
      });
      planned.push(cells);
    });
    if (!planned.length) return false;
    dismissCaravan(game, caravan);
    planned.forEach(function (cells) {
      cells.forEach(function (i) {
        game.life[i] = 1;
        if (game.owner) game.owner[i] = who;
      });
      markSpark(game, cells);
    });
    return true;
  }

  function fleetArrived(game, caravan, isPlantable) {
    const target = caravan.target;
    if (!target) return false;
    let sx = 0;
    let sy = 0;
    let n = 0;
    let onShore = false;
    (caravan.cells || []).forEach(function (i) {
      if (!game.life[i]) return;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      sx += x;
      sy += y;
      n++;
      if (isPlantable(game, x, y)) onShore = true;
    });
    if (!n) return false;
    const dist = wrapDelta(sx / n, target.cx, game.cols) + distY(sy / n, target.cy);
    if (dist > 3 && !onShore) return false;
    return landFleet(game, caravan, isPlantable, false);
  }

  function caravanArrived(game, caravan, events, isPlantable) {
    const target = caravan.target;
    if (!target) return false;
    if (caravan.kind === "raid") return raidArrived(game, caravan, events);
    if (caravan.kind === "migrate" || caravan.kind === "boat") return migrateArrived(game, caravan, isPlantable);
    if (caravan.kind === "fleet") return fleetArrived(game, caravan, isPlantable);
    if (target.kind === "ruin") {
      let sx = 0;
      let sy = 0;
      let n = 0;
      (caravan.cells || []).forEach(function (i) {
        if (!game.life[i]) return;
        const x = i % game.cols;
        sx += x;
        sy += (i - x) / game.cols;
        n++;
      });
      if (n && wrapDelta(sx / n, target.cx, game.cols) + distY(sy / n, target.cy) <= 4) return true;
      for (let k = 0; k < (caravan.cells || []).length; k++) {
        const i = caravan.cells[k];
        const sites = game.ruinSites || [];
        for (let s = 0; s < sites.length; s++) {
          if (sites[s].cells.indexOf(i) >= 0) return true;
        }
      }
    }
    const dest = (game.settlements || []).filter(function (s) {
      return s.id === target.id;
    })[0];
    if (!dest) return false;
    for (let n = 0; n < caravan.cells.length; n++) {
      const i = caravan.cells[n];
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let d = 0; d < dirs.length; d++) {
        const ni = idx(game, x + dirs[d][0], y + dirs[d][1]);
        if (dest.members && dest.members[ni]) {
          deliverCulture(game, caravan, dest, events);
          return true;
        }
      }
    }
    return false;
  }

  function stepCaravan(game, caravan, isPlantable) {
    if (!caravanAlive(game, caravan)) return false;
    const live = caravan.cells.filter(function (i) {
      return game.life[i];
    });
    caravan.cells = live;
    let sx = 0;
    let sy = 0;
    live.forEach(function (i) {
      const x = i % game.cols;
      sx += x;
      sy += (i - x) / game.cols;
    });
    const cx = sx / live.length;
    const cy = sy / live.length;
    const tx = caravan.target.cx;
    const ty = caravan.target.cy;
    let dx = 0;
    let dy = 0;
    const gx = wrapDelta(cx, tx, game.cols);
    const gy = distY(cy, ty);
    if (gx >= gy) dx = ((tx - cx + game.cols) % game.cols) < game.cols / 2 ? 1 : -1;
    else dy = ty > cy ? 1 : ty < cy ? -1 : 0;
    const dest = [];
    for (let n = 0; n < live.length; n++) {
      const from = live[n];
      const x = W.wrap((from % game.cols) + dx, game.cols);
      const y = Math.floor(from / game.cols) + dy;
      if (y < 0 || y >= game.rows) return false;
      if (caravan.kind === "boat" || caravan.kind === "fleet") {
        if (!canBoatStep(game, x, y)) return false;
      } else if (!isPlantable(game, x, y)) return false;
      const ni = W.idx(x, y, game.cols);
      if (game.life[ni] && live.indexOf(ni) < 0) return false;
      dest.push({ from: from, i: ni });
    }
    const who = caravan.owner || 0;
    dest.forEach(function (d) {
      game.life[d.from] = 0;
      if (game.owner) game.owner[d.from] = 0;
    });
    dest.forEach(function (d) {
      game.life[d.i] = 1;
      if (game.owner) game.owner[d.i] = who;
    });
    caravan.cells = dest.map(function (d) {
      return d.i;
    });
    if (caravan.parties) {
      const remap = {};
      dest.forEach(function (d) {
        remap[d.from] = d.i;
      });
      caravan.parties = caravan.parties.map(function (party) {
        return (party || [])
          .map(function (i) {
            return remap[i] != null ? remap[i] : i;
          })
          .filter(function (i) {
            return game.life[i];
          });
      });
    }
    return true;
  }

  function snakeBusy(game, settl) {
    return (game.caravans || []).some(function (c) {
      return c.fromId === settl.id;
    });
  }

  function pickLandTarget(game, settl, isPlantable, scoreFn) {
    let best = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = Math.floor(Math.random() * game.cols);
      const y = Math.floor(Math.random() * game.rows);
      const t = game.terrain[W.idx(x, y, game.cols)];
      if (t !== TERRAIN.SOIL && t !== TERRAIN.FERTILE && t !== TERRAIN.MARSH && t !== TERRAIN.GROVE) continue;
      if (!isPlantable(game, x, y)) continue;
      const i = W.idx(x, y, game.cols);
      if (game.life[i]) continue;
      const dist = wrapDelta(x, settl.cx, game.cols) + distY(y, settl.cy);
      if (dist < 12) continue;
      const score = scoreFn(game, x, y, dist, t);
      if (score > bestScore) {
        bestScore = score;
        best = { kind: "res", cx: x, cy: y };
      }
    }
    if (!best || bestScore < 2) return null;
    return best;
  }

  function pickSeedTarget(game, settl, isPlantable) {
    const trait = settl.trait;
    if (trait === "expand") return pickMigrateTarget(game, settl, isPlantable);
    if (trait === "climb") {
      return pickLandTarget(game, settl, isPlantable, function (g, x, y, dist) {
        return heightScore(g, x, y) + dist * 0.15;
      });
    }
    if (trait === "dike") {
      return pickLandTarget(game, settl, isPlantable, function (g, x, y, dist, t) {
        let s = cellTouchesWet(g, x, y) ? 8 : distToWet(g, x, y) < 4 ? 4 : 0;
        if (t === TERRAIN.FERTILE) s += 3;
        return s + dist * 0.1;
      });
    }
    return pickLandTarget(game, settl, isPlantable, function (g, x, y, dist, t) {
      let s = dist * 0.4;
      if (t === TERRAIN.FERTILE) s += 2;
      if (W.isRockAdjacent(g.terrain, x, y, g.cols, g.rows)) s += 2;
      return s;
    });
  }

  function seedWait(settl, game) {
    let wait = 40 + Math.floor(Math.random() * 17);
    if (settl.trait === "expand") wait = 16 + Math.floor(Math.random() * 13);
    else if (settl.trait === "climb" || settl.trait === "dike") wait = 26 + Math.floor(Math.random() * 15);
    else if (settl.trait === "resist") wait = 32 + Math.floor(Math.random() * 17);
    const occ = ownerLifeCounts(game)[settl.owner || 0] || 0;
    wait += Math.min(48, Math.floor(occ / 22));
    const who = settl.owner || 0;
    if (hasHeroTag(game, who, "birth")) wait = Math.max(10, wait - 12);
    if (hasHeroTag(game, who, "settle")) wait = Math.max(12, wait - 8);
    if (hasHeroTag(game, who, "vanity")) wait = Math.max(10, wait - 6);
    if (hasHeroTag(game, who, "idle")) wait += 14;
    return wait;
  }

  function seedLabel(settl) {
    if (settl.trait === "climb") return "登高的人往高處分家";
    if (settl.trait === "dike") return "堤防的人沿岸分家";
    if (settl.trait === "resist") return "災後有人出走";
    if (settl.trait === "deep") return "倉滿，分出一支部族";
    if (settl.trait === "sail") return "航海的人渡海分家";
    if (settl.trait === "farm") return "農人開田分家";
    return "為尋資源而遷";
  }

  function tickSeeds(game, isPlantable, events) {
    const packed = countLife(game) / Math.max(1, game.cols * game.rows);
    (game.settlements || []).forEach(function (s) {
      if (!s.trait) return;
      if (s.trait === "deep" && foodOf(game, s.owner || 0) < 16) return;
      if (s.seedIn == null) s.seedIn = seedWait(s, game);
      s.seedIn -= 1;
      if (s.seedIn > 0) return;
      s.seedIn = seedWait(s, game);
      if (packed > 0.32 && !hasHeroTag(game, s.owner, "vanity") && Math.random() < packed) return;
      if (s.trait === "resist" && !(s.memory && s.memory.disaster) && Math.random() < 0.5) return;
      if (snakeSlotFull(game)) return;
      if (snakeBusy(game, s)) return;
      const target = pickSeedTarget(game, s, isPlantable);
      if (target && spawnSnake(game, s, target, isPlantable, "migrate")) {
        events.push(seedLabel(s));
      }
    });
  }

  function townTouchesRiverOrIce(game, settl) {
    const list = settl.list || [];
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (!game.life[i]) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
      for (let d = 0; d < dirs.length; d++) {
        const t = game.terrain[idx(game, x + dirs[d][0], y + dirs[d][1])];
        if (t === TERRAIN.RIVER || t === TERRAIN.ICE) return true;
      }
    }
    return false;
  }

  function pickCrossTarget(game, settl, isPlantable) {
    return pickLandTarget(game, settl, isPlantable, function (g, x, y, dist, t) {
      const wet = distToWet(g, x, y);
      let s = wet <= 3 ? 10 : wet <= 6 ? 4 : 0;
      if (t === TERRAIN.FERTILE) s += 2;
      return s + Math.min(20, dist) * 0.35;
    });
  }

  function tryWinterCrossings(game, isPlantable) {
    const events = [];
    if (!game.caravans) game.caravans = [];
    (game.settlements || []).forEach(function (s) {
      if (!s.trait) return;
      if (!townTouchesRiverOrIce(game, s)) return;
      if (snakeSlotFull(game)) return;
      if (snakeBusy(game, s)) return;
      const chance = s.trait === "expand" ? 0.72 : s.trait === "dike" ? 0.55 : s.trait === "farm" ? 0.5 : 0.48;
      let roll = chance;
      if (hasHeroTag(game, s.owner, "settle") || hasHeroTag(game, s.owner, "vanity")) roll += 0.12;
      if (hasHeroTag(game, s.owner, "idle")) roll *= 0.5;
      if (Math.random() > roll) return;
      const target = pickCrossTarget(game, s, isPlantable);
      if (!target) return;
      if (spawnSnake(game, s, target, isPlantable, "migrate")) {
        const last = game.caravans[game.caravans.length - 1];
        if (last) last.maxAge = 30;
        events.push("沿冰過河");
      }
    });
    return events;
  }

  function hungerNeed(settl) {
    if (settl.legacy === "rite") return 10;
    if (settl.trait === "deep") return 12;
    return 6;
  }

  function wantRaid(game, s) {
    const o = s.owner || 0;
    if (hasHeroTag(game, o, "fool") && Math.random() < 0.45) return false;
    if (hasHeroTag(game, o, "humane") && Math.random() < 0.55) return false;
    if (hasHeroTag(game, o, "warlord") || hasHeroTag(game, o, "endless")) return true;
    if (hasHeroTag(game, o, "cruel") && (isHungry(game, o) || Math.random() < 0.25)) return true;
    if (s.trait === "expand" && (s.hungryStreak || 0) >= hungerNeed(s)) return true;
    if (isHungry(game, o) && Math.random() < 0.2) return true;
    return false;
  }

  function tickPressure(game, isPlantable, events) {
    (game.settlements || []).forEach(function (s) {
      if (!wantRaid(game, s)) return;
      if (snakeSlotFull(game)) return;
      if (snakeBusy(game, s)) return;
      const foe = pickRaidTarget(game, s);
      if (foe) {
        if (spawnSnake(game, s, foe, isPlantable, "raid")) {
          s.hungryStreak = 0;
        }
        return;
      }
      if (s.trait !== "expand" && !hasHeroTag(game, s.owner, "settle") && !hasHeroTag(game, s.owner, "vanity")) {
        return;
      }
      const res = pickMigrateTarget(game, s, isPlantable);
      if (res && spawnSnake(game, s, res, isPlantable, "migrate")) {
        s.hungryStreak = 0;
        events.push("為尋資源而遷");
      }
    });
  }

  function tickBorderWar(game) {
    const events = [];
    if (!game.life || !game.owner) return events;
    const cols = game.cols;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const hits = [];
    const seen = {};
    const n = game.life.length;
    for (let i = 0; i < n; i++) {
      if (!game.life[i]) continue;
      const a = ownerOf(game, i);
      const x = i % cols;
      const y = (i - x) / cols;
      for (let d = 0; d < 4; d++) {
        const ni = idx(game, x + dirs[d][0], y + dirs[d][1]);
        if (!game.life[ni]) continue;
        const b = ownerOf(game, ni);
        if (a === b) continue;
        const key = i < ni ? i + ":" + ni : ni + ":" + i;
        if (seen[key]) continue;
        seen[key] = 1;
        hits.push({ a: a, b: b, i: i, ni: ni });
      }
    }
    if (!hits.length) return events;
    let fights = 0;
    const take = Math.min(hits.length, 10);
    for (let k = 0; k < take; k++) {
      const h = hits[Math.floor(Math.random() * hits.length)];
      let chance = 0.12;
      if (hasHeroTag(game, h.a, "warlord") || hasHeroTag(game, h.a, "endless")) chance += 0.1;
      if (hasHeroTag(game, h.b, "warlord") || hasHeroTag(game, h.b, "endless")) chance += 0.06;
      if (hasHeroTag(game, h.a, "cruel") || hasHeroTag(game, h.b, "cruel")) chance += 0.06;
      if (hasHeroTag(game, h.a, "humane") && hasHeroTag(game, h.b, "humane")) chance *= 0.4;
      else if (hasHeroTag(game, h.a, "humane") || hasHeroTag(game, h.b, "humane")) chance *= 0.7;
      if (hasHeroTag(game, h.a, "fool") && Math.random() < 0.4) continue;
      if (Math.random() > chance) continue;
      const attacker = Math.random() < 0.5 ? h.a : h.b;
      const loser = attacker === h.a ? h.ni : h.i;
      const loserOwner = attacker === h.a ? h.b : h.a;
      if (hasHeroTag(game, attacker, "cruel") || Math.random() < 0.55) {
        game.life[loser] = 0;
        game.owner[loser] = 0;
      } else {
        game.owner[loser] = attacker;
      }
      fights += 1;
      if (tryBorderAbsorb(game, loserOwner, attacker, events)) break;
    }
    if (fights) events.push("邊界衝突");
    return events;
  }

  function canBoatStep(game, x, y) {
    if (y < 0 || y >= game.rows) return false;
    const t = game.terrain[W.idx(W.wrap(x, game.cols), y, game.cols)];
    if (t === TERRAIN.ROCK || t === TERRAIN.SNOW) return false;
    if (t === TERRAIN.WATER || t === TERRAIN.RIVER || t === TERRAIN.ICE) return true;
    return (
      t === TERRAIN.SOIL ||
      t === TERRAIN.FERTILE ||
      t === TERRAIN.SAND ||
      t === TERRAIN.MARSH ||
      t === TERRAIN.GROVE ||
      t === TERRAIN.HIGHLAND
    );
  }

  function markBoatCells(game) {
    game.boatCells = {};
    (game.caravans || []).forEach(function (c) {
      if (c.kind !== "boat" && c.kind !== "fleet") return;
      const mark = c.kind === "fleet" ? 2 : 1;
      (c.cells || []).forEach(function (i) {
        if (game.life[i]) game.boatCells[i] = mark;
      });
    });
  }

  function pickBoatTarget(game, settl, isPlantable) {
    let best = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 90; attempt++) {
      const x = Math.floor(Math.random() * game.cols);
      const y = Math.floor(Math.random() * game.rows);
      if (!isPlantable(game, x, y)) continue;
      const i = W.idx(x, y, game.cols);
      if (game.life[i]) continue;
      const dist = wrapDelta(x, settl.cx, game.cols) + distY(y, settl.cy);
      if (dist < 10 || dist > 48) continue;
      let wealth = dist * 0.25;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const ni = idx(game, x + dx, y + dy);
          if (game.life[ni]) wealth -= 2;
          const r = game.resources && game.resources[ni];
          const amt = (game.resAmt && game.resAmt[ni]) || 1;
          if (r === RESOURCE.CRYSTAL) wealth += 10 * amt;
          else if (r === RESOURCE.NUTRIENT) wealth += 2 * amt;
        }
      }
      if (wealth > bestScore) {
        bestScore = wealth;
        best = { kind: "res", cx: x, cy: y };
      }
    }
    if (!best || bestScore < 3) return null;
    return best;
  }

  function pickFleetTarget(game, settl, isPlantable) {
    let best = null;
    let bestScore = -1;
    for (let attempt = 0; attempt < 120; attempt++) {
      const x = Math.floor(Math.random() * game.cols);
      const y = Math.floor(Math.random() * game.rows);
      if (!isPlantable(game, x, y)) continue;
      const i = W.idx(x, y, game.cols);
      if (game.life[i]) continue;
      const dist = wrapDelta(x, settl.cx, game.cols) + distY(y, settl.cy);
      if (dist < 6 || dist > 18) continue;
      let wealth = 12 - Math.abs(dist - 12);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ni = idx(game, x + dx, y + dy);
          if (game.life[ni]) wealth -= 1;
          const r = game.resources && game.resources[ni];
          const amt = (game.resAmt && game.resAmt[ni]) || 1;
          if (r === RESOURCE.CRYSTAL) wealth += 6 * amt;
          else if (r === RESOURCE.NUTRIENT) wealth += 1 * amt;
        }
      }
      if (wealth > bestScore) {
        bestScore = wealth;
        best = { kind: "res", cx: x, cy: y };
      }
    }
    if (!best) return null;
    return best;
  }

  function townTouchesSea(game, settl) {
    const list = settl.list || [];
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (!game.life[i]) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      if (cellTouchesWet(game, x, y)) return true;
    }
    return false;
  }

  const RAFT_CAP = 80;
  const RAFT_SRC = [
    [0, 0], [1, 0], [2, 0], [3, 0],
    [0, 1], [1, 1], [2, 1], [3, 1],
    [0, 2], [1, 2], [2, 2], [3, 2],
  ];
  const RAFT_ROT = [
    [0, 0], [1, 0], [2, 0],
    [0, 1], [1, 1], [2, 1],
    [0, 2], [1, 2], [2, 2],
    [0, 3], [1, 3], [2, 3],
  ];

  function raftCount(game) {
    return Object.keys(game.raftCells || {}).length;
  }

  function raftAliveNear(game, i) {
    if (!game.raftCells) return false;
    const cols = game.cols;
    const x = i % cols;
    const y = (i - x) / cols;
    const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let d = 0; d < dirs.length; d++) {
      const ni = idx(game, x + dirs[d][0], y + dirs[d][1]);
      if (!game.raftCells[ni]) continue;
      if (game.life[ni]) return true;
    }
    return false;
  }

  function townOnRaft(game, settl) {
    const list = settl.list || [];
    let n = 0;
    for (let k = 0; k < list.length; k++) {
      if (game.raftCells && game.raftCells[list[k]]) n++;
    }
    return n >= 6;
  }

  function townTouchesShallowOcean(game, settl) {
    const list = settl.list || [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let k = 0; k < list.length; k++) {
      const i = list[k];
      if (!game.life[i]) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      for (let d = 0; d < dirs.length; d++) {
        const ni = idx(game, x + dirs[d][0], y + dirs[d][1]);
        if (W.isShallowOcean && W.isShallowOcean(game, ni)) return true;
      }
    }
    return false;
  }

  function raftPatternFits(game, ox, oy, pattern) {
    for (let k = 0; k < pattern.length; k++) {
      const x = W.wrap(ox + pattern[k][0], game.cols);
      const y = oy + pattern[k][1];
      if (y < 0 || y >= game.rows) return false;
      const i = W.idx(x, y, game.cols);
      if (!(W.isShallowOcean && W.isShallowOcean(game, i))) return false;
      if (game.life[i]) return false;
      if (game.dikeCells && game.dikeCells[i]) return false;
    }
    return true;
  }

  function stampRaft(game, ox, oy, pattern, owner) {
    if (!game.raftCells) game.raftCells = {};
    if (!game.raftIdle) game.raftIdle = {};
    pattern.forEach(function (p) {
      const x = W.wrap(ox + p[0], game.cols);
      const y = oy + p[1];
      const i = W.idx(x, y, game.cols);
      game.life[i] = 1;
      if (game.owner) game.owner[i] = owner || 0;
      game.raftCells[i] = 1;
      game.raftIdle[i] = 0;
    });
  }

  function smashRafts(game) {
    if (!game.raftCells) return;
    Object.keys(game.raftCells).forEach(function (key) {
      if (Math.random() >= 0.22) return;
      const i = Number(key);
      if (game.life) game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
      delete game.raftCells[i];
      if (game.raftIdle) delete game.raftIdle[i];
    });
  }

  function growRaftFloor(game) {
    if (!game.raftCells) game.raftCells = {};
    const keys = Object.keys(game.raftCells);
    if (!keys.length) return;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    keys.forEach(function (key) {
      const i = Number(key);
      if (!game.life[i]) return;
      if (raftCount(game) >= RAFT_CAP) return;
      if (Math.random() > 0.2) return;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      const d = dirs[Math.floor(Math.random() * dirs.length)];
      const ni = idx(game, x + d[0], y + d[1]);
      if (!(W.isShallowOcean && W.isShallowOcean(game, ni))) return;
      if (game.raftCells[ni]) return;
      game.raftCells[ni] = 1;
      if (!game.raftIdle) game.raftIdle = {};
      game.raftIdle[ni] = 0;
    });
  }

  function tickRafts(game) {
    if (!game.raftCells) game.raftCells = {};
    if (!game.raftIdle) game.raftIdle = {};
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const add = [];
    Object.keys(game.raftCells).forEach(function (key) {
      const i = Number(key);
      if (!game.life[i]) return;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      dirs.forEach(function (d) {
        const ni = idx(game, x + d[0], y + d[1]);
        if (!game.life[ni]) return;
        if (!(W.isShallowOcean && W.isShallowOcean(game, ni))) return;
        if (game.raftCells[ni]) return;
        add.push(ni);
      });
    });
    for (let a = 0; a < add.length; a++) {
      if (raftCount(game) >= RAFT_CAP) break;
      game.raftCells[add[a]] = 1;
      game.raftIdle[add[a]] = 0;
    }
    let lost = 0;
    Object.keys(game.raftCells).forEach(function (key) {
      const i = Number(key);
      const t = game.terrain[i];
      if (t !== TERRAIN.WATER && t !== TERRAIN.RIVER) {
        delete game.raftCells[i];
        delete game.raftIdle[i];
        return;
      }
      if (game.life[i] || raftAliveNear(game, i)) {
        game.raftIdle[i] = 0;
        return;
      }
      game.raftIdle[i] = (game.raftIdle[i] || 0) + 1;
      if (game.raftIdle[i] >= 8) {
        delete game.raftCells[i];
        delete game.raftIdle[i];
        lost += 1;
      }
    });
    if (lost >= 8) return "船團散了";
    return null;
  }

  function spawnRaftTowns(game, events) {
    if (!game.raftCells) game.raftCells = {};
    if (raftCount(game) >= RAFT_CAP) return;
    (game.settlements || []).forEach(function (s) {
      if (!s.trait) return;
      if (townOnRaft(game, s)) return;
      if (!townTouchesShallowOcean(game, s)) return;
      const f = ensureFaction(game, s.owner || 0);
      const lived = f ? f.lived || 0 : 0;
      if ((s.age || 0) < 50 && lived < 50) return;
      if (s.raftIn == null) s.raftIn = 24 + Math.floor(Math.random() * 17);
      s.raftIn -= 1;
      if (s.raftIn > 0) return;
      s.raftIn = 24 + Math.floor(Math.random() * 17);
      let chance = 0.08;
      if (s.trait === "expand") chance = 0.18;
      else if (s.trait === "dike") chance = 0.14;
      else if (s.trait === "climb") chance = 0.06;
      if (hasHeroTag(game, s.owner, "settle")) chance += 0.08;
      if (hasHeroTag(game, s.owner, "idle")) chance *= 0.45;
      if (Math.random() > chance) return;
      if (raftCount(game) + RAFT_SRC.length > RAFT_CAP) return;
      const list = s.list || [];
      const origins = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        if (!game.life[i]) continue;
        const x = i % game.cols;
        const y = (i - x) / game.cols;
        for (let d = 0; d < dirs.length; d++) {
          const ox = W.wrap(x + dirs[d][0], game.cols);
          const oy = y + dirs[d][1];
          const ni = W.idx(ox, oy, game.cols);
          if (!(W.isShallowOcean && W.isShallowOcean(game, ni))) continue;
          origins.push({ x: ox, y: oy });
        }
      }
      if (!origins.length) return;
      const patterns = [RAFT_SRC, RAFT_ROT];
      let placed = false;
      for (let t = 0; t < 18 && !placed; t++) {
        const o = origins[Math.floor(Math.random() * origins.length)];
        const pattern = patterns[t % patterns.length];
        const ox = W.wrap(o.x + (t % 3) - 1, game.cols);
        const oy = o.y + Math.floor(t / 6) - 1;
        if (!raftPatternFits(game, ox, oy, pattern)) continue;
        stampRaft(game, ox, oy, pattern, s.owner || 0);
        placed = true;
      }
      if (placed) events.push("海上有人住下來");
    });
  }

  function tickAbandon(game, events) {
    const towns = game.settlements || [];
    if (towns.length < 2) return;
    const cands = [];
    towns.forEach(function (s) {
      if ((s.age || 0) < 40) return;
      const o = s.owner || 0;
      const peers = towns.filter(function (t) {
        return (t.owner || 0) === o && t.id !== s.id && (t.size || 0) >= CIV_MIN;
      });
      if (!peers.length) return;
      const hungry = (s.hungryStreak || 0) >= 8;
      const poor = localResourceScore(game, s.cx, s.cy) < 3;
      if (!hungry && !poor) return;
      let w = 10 + Math.max(0, 28 - (s.size || 0));
      if (s.trait === "expand") w += 14;
      if (s.trait === "deep" || s.legacy === "rite" || s.legacy === "memory") w = Math.max(2, Math.floor(w * 0.4));
      if ((s.hungryStreak || 0) >= 12) w += 8;
      cands.push({ s: s, w: w });
    });
    if (!cands.length) return;
    if (Math.random() > 0.12) return;
    let sum = 0;
    cands.forEach(function (c) {
      sum += c.w;
    });
    let r = Math.random() * sum;
    let pick = cands[0].s;
    for (let i = 0; i < cands.length; i++) {
      r -= cands[i].w;
      if (r <= 0) {
        pick = cands[i].s;
        break;
      }
    }
    (pick.list || []).forEach(function (i) {
      game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
    });
    pick.hearthDropped = true;
    dropRuinFromMembers(game, pick.members, pick);
    events.push(Math.random() < 0.5 ? "一座舊鎮荒了" : "有人離開了舊址");
  }

  function tickPilgrimage(game, isPlantable, events) {
    const sites = game.ruinSites || [];
    if (!sites.length) return;
    (game.settlements || []).forEach(function (s) {
      if (s.legacy !== "rite") return;
      if (s.riteVisitIn == null) s.riteVisitIn = 36 + Math.floor(Math.random() * 20);
      s.riteVisitIn -= 1;
      if (s.riteVisitIn > 0) return;
      s.riteVisitIn = 40 + Math.floor(Math.random() * 18);
      if (snakeSlotFull(game)) return;
      if (snakeBusy(game, s)) return;
      let best = null;
      let bestD = 80;
      sites.forEach(function (site) {
        const sameOwner = (site.owner || 0) === (s.owner || 0);
        const sameLine = site.lineageId && site.lineageId === (s.lineageId || s.id);
        if (!sameOwner && !sameLine) return;
        const i = site.cells && site.cells[0];
        if (i == null) return;
        const x = i % game.cols;
        const y = (i - x) / game.cols;
        const d = wrapDelta(x, s.cx, game.cols) + distY(y, s.cy);
        if (d < 6 || d > 70) return;
        if (d < bestD) {
          bestD = d;
          best = { kind: "ruin", cx: x, cy: y };
        }
      });
      if (!best) return;
      if (spawnSnake(game, s, best, isPlantable, "culture")) {
        events.push("有人回舊爐上香");
      }
    });
  }

  function tickTales(game, events) {
    if ((game.generation || 0) % 32 !== 0 || !game.generation) return;
    const tellers = (game.settlements || []).filter(function (s) {
      return s.legacy === "rite" || s.legacy === "memory";
    });
    if (!tellers.length) return;
    const s = tellers[Math.floor(Math.random() * tellers.length)];
    const f = ensureFaction(game, s.owner || 0);
    const m = s.memory || {};
    const name = civName(f.n);
    if (s.legacy === "memory") {
      events.push(name + "還記得那年饑荒");
      return;
    }
    if (m.flood || m.nearWater) events.push("歲祀的人說，河改過道");
    else events.push("舊爐還有人記得");
  }

  function tickBoats(game, isPlantable, events) {
    (game.settlements || []).forEach(function (s) {
      if (!s.trait) return;
      if (!townTouchesSea(game, s)) return;
      if (townOnRaft(game, s)) return;
      if (s.boatIn == null) s.boatIn = 22 + Math.floor(Math.random() * 16);
      s.boatIn -= 1;
      if (s.boatIn > 0) return;
      s.boatIn = 22 + Math.floor(Math.random() * 16);
      if (snakeSlotFull(game)) return;
      if (snakeBusy(game, s)) return;
      let chance = s.trait === "expand" ? 0.68 : s.trait === "dike" || s.trait === "sail" ? 0.48 : 0.3;
      if (hasHeroTag(game, s.owner, "settle")) chance += 0.12;
      if (hasHeroTag(game, s.owner, "idle")) chance *= 0.5;
      if (Math.random() > chance) return;
      const target = pickBoatTarget(game, s, isPlantable);
      if (target && spawnSnake(game, s, target, isPlantable, "boat")) {
        const mem = s.memory || emptyMemory();
        s.memory = mem;
        bump(mem, "boats", 1);
        events.push("一艘小船出海");
      }
    });
  }

  function hasSail(game, settl) {
    if (!settl) return false;
    if (settl.trait === "sail") return true;
    const f = game.factions && game.factions[settl.owner || 0];
    return !!(f && f.skills && f.skills.sail);
  }

  function fleetAtSea(game, owner) {
    return (game.caravans || []).some(function (c) {
      return c.kind === "fleet" && (c.owner || 0) === (owner || 0);
    });
  }

  function tickFleets(game, isPlantable, events) {
    (game.settlements || []).forEach(function (s) {
      if (!hasSail(game, s)) return;
      if ((s.size || 0) < FLEET_TOWN) return;
      if (!townTouchesSea(game, s)) return;
      if (townOnRaft(game, s)) return;
      if (fleetAtSea(game, s.owner || 0)) return;
      if (s.fleetIn == null) s.fleetIn = 32 + Math.floor(Math.random() * 20);
      s.fleetIn -= 1;
      if (s.fleetIn > 0) return;
      s.fleetIn = 40 + Math.floor(Math.random() * 22);
      let chance = 0.42;
      if (hasHeroTag(game, s.owner, "settle")) chance += 0.12;
      if (hasHeroTag(game, s.owner, "vanity")) chance += 0.1;
      if (hasHeroTag(game, s.owner, "idle")) chance *= 0.5;
      if (Math.random() > chance) return;
      const target = pickFleetTarget(game, s, isPlantable);
      if (target && spawnFleet(game, s, target, isPlantable)) {
        events.push(civName(ensureFaction(game, s.owner || 0).n) + "派出船團");
      }
    });
  }

  function tickCaravans(game, isPlantable) {
    const events = [];
    if (!game.caravans) game.caravans = [];
    (game.settlements || []).forEach(function (s) {
      if (!s.trait) return;
      if (s.trait === "expand" && (s.hungryStreak || 0) >= 4) return;
      if (s.caravanIn == null) s.caravanIn = 20;
      s.caravanIn -= 1;
      if (s.caravanIn > 0) return;
      s.caravanIn = 24 + Math.floor(Math.random() * 10);
      if (snakeSlotFull(game)) return;
      if (snakeBusy(game, s)) return;
      if (spawnCaravan(game, s, isPlantable)) events.push("一支商隊出發");
    });
    tickSeeds(game, isPlantable, events);
    tickPressure(game, isPlantable, events);
    tickAbandon(game, events);
    tickPilgrimage(game, isPlantable, events);
    tickTales(game, events);
    tickBoats(game, isPlantable, events);
    tickFleets(game, isPlantable, events);
    spawnRaftTowns(game, events);
    const keep = [];
    game.caravans.forEach(function (c) {
      c.age = (c.age || 0) + 1;
      if (c.kind === "fleet" && c.age >= FLEET_MAX_AGE) {
        if (landFleet(game, c, isPlantable, true)) {
          events.push("船團登岸");
          return;
        }
        dismissCaravan(game, c);
        events.push("船團沒靠岸");
        return;
      }
      if (c.age > (c.maxAge || 40)) {
        dismissCaravan(game, c);
        return;
      }
      if (!caravanAlive(game, c)) return;
      if (caravanArrived(game, c, events, isPlantable)) {
        if (c.kind === "fleet") {
          events.push("船團登岸");
          return;
        }
        if (c.kind !== "migrate" && c.kind !== "boat") dismissCaravan(game, c);
        return;
      }
      if (!stepCaravan(game, c, isPlantable)) {
        if (c.kind === "fleet" && landFleet(game, c, isPlantable, true)) {
          events.push("船團登岸");
          return;
        }
        if (c.kind === "fleet") events.push("船團沒靠岸");
        dismissCaravan(game, c);
        return;
      }
      keep.push(c);
    });
    game.caravans = keep;
    return events;
  }

  function distToWet(game, x, y) {
    let best = 8;
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const t = game.terrain[idx(game, x + dx, y + dy)];
        if (t !== TERRAIN.WATER && t !== TERRAIN.RIVER) continue;
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < best) best = d;
      }
    }
    return best;
  }

  function heightScore(game, x, y) {
    let s = distToWet(game, x, y);
    if (W.isRockAdjacent(game.terrain, x, y, game.cols, game.rows)) s += 4;
    return s;
  }

  function evacuateHighGround(game, isPlantable) {
    if (seasonIdOf(game) !== "rain" || (game.seasonAge || 0) < 24) return false;
    let moved = 0;
    const reserved = {};
    (game.settlements || []).forEach(function (s) {
      if (s.trait !== "climb") return;
      const shore = [];
      (s.list || []).forEach(function (i) {
        if (!game.life[i]) return;
        const x = i % game.cols;
        const y = (i - x) / game.cols;
        if (!cellTouchesWet(game, x, y)) return;
        shore.push({ i: i, x: x, y: y });
      });
      shuffledLocal(shore);
      let local = 0;
      shore.forEach(function (c) {
        if (local >= 3) return;
        const here = heightScore(game, c.x, c.y);
        let best = null;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const nx = W.wrap(c.x + d[0], game.cols);
          const ny = c.y + d[1];
          if (ny < 0 || ny >= game.rows) return;
          if (!isPlantable(game, nx, ny)) return;
          const ni = W.idx(nx, ny, game.cols);
          if (game.life[ni] || reserved[ni]) return;
          const sc = heightScore(game, nx, ny);
          if (sc <= here) return;
          if (!best || sc > best.sc) best = { i: ni, sc: sc };
        });
        if (!best) return;
        const who = ownerOf(game, c.i);
        game.life[c.i] = 0;
        if (game.owner) game.owner[c.i] = 0;
        game.life[best.i] = 1;
        if (game.owner) game.owner[best.i] = who;
        reserved[best.i] = 1;
        local += 1;
        moved += 1;
      });
    });
    return moved > 0;
  }

  function ownerHasWard(game, who) {
    const f = game.factions && game.factions[who || 0];
    const skills = (f && f.skills) || {};
    if (skills.resist || skills.ward) return true;
    return (game.settlements || []).some(function (s) {
      return (s.owner || 0) === (who || 0) && (s.trait === "resist" || s.legacy === "ward");
    });
  }

  function rankedOwnerCells(game, who, cache) {
    cache = cache || (game.skillCells && game.skillCells.cache) || {};
    const ranked = [];
    for (let y = 0; y < game.rows; y++) {
      for (let x = 0; x < game.cols; x++) {
        const i = W.idx(x, y, game.cols);
        if (!game.life[i] || cache[i]) continue;
        const o = (game.owner && game.owner[i]) || 0;
        if (o !== who) continue;
        ranked.push({ i: i, r: starveRank(game, i, 2) });
      }
    }
    ranked.sort(function (a, b) {
      return a.r - b.r;
    });
    return ranked;
  }

  function scrapeOwner(game, who, frac) {
    const ranked = rankedOwnerCells(game, who);
    const want = Math.max(1, Math.ceil(ranked.length * Math.max(0.02, frac)));
    const kill = Math.min(want, ranked.length);
    for (let n = 0; n < kill; n++) {
      const i = ranked[n].i;
      game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
    }
    return kill;
  }

  function ownersTouching(game, who) {
    const seen = {};
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < game.life.length; i++) {
      if (!game.life[i]) continue;
      if (((game.owner && game.owner[i]) || 0) !== who) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      for (let d = 0; d < 4; d++) {
        const ni = idx(game, x + dirs[d][0], y + dirs[d][1]);
        if (!game.life[ni]) continue;
        const o = (game.owner && game.owner[ni]) || 0;
        if (o !== who) seen[o] = 1;
      }
    }
    return Object.keys(seen).map(Number);
  }

  function livingCrisisOwners(game) {
    const lifeBy = ownerLifeCounts(game);
    const out = [];
    Object.keys(game.factions || {}).forEach(function (key) {
      const o = Number(key);
      if ((lifeBy[o] || 0) <= 0) return;
      out.push(o);
    });
    return out;
  }

  function crisisWeight(game, who, lifeBy) {
    const f = game.factions && game.factions[who];
    if (!f) return 0;
    if ((f.plague || 0) > 0) return 0;
    if ((f.rotHungry || 0) > 0) return 0;
    let w = lifeBy[who] || 1;
    if (f.empire) w *= 2.2;
    else if (f.kingdom) w *= 1.8;
    else w *= 0.6;
    if (hasHeroTag(game, who, "fool")) w *= 1.25;
    if (hasHeroTag(game, who, "cruel")) w *= 1.15;
    if (hasHeroTag(game, who, "lavish")) w *= 1.2;
    if (hasHeroTag(game, who, "humane")) w *= 0.75;
    if (ownerHasWard(game, who)) w *= 0.8;
    return w;
  }

  function pickCrisisVictim(game) {
    const lifeBy = ownerLifeCounts(game);
    const owners = livingCrisisOwners(game);
    let sum = 0;
    const weights = owners.map(function (o) {
      const w = crisisWeight(game, o, lifeBy);
      sum += w;
      return { o: o, w: w };
    });
    if (sum <= 0) return null;
    let r = Math.random() * sum;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i].w;
      if (r <= 0) return weights[i].o;
    }
    return weights[weights.length - 1].o;
  }

  function applyPlague(game, who, events, inherited) {
    const f = ensureFaction(game, who);
    let dur = inherited || 16 + Math.floor(Math.random() * 13);
    let frac = 0.08;
    if (ownerHasWard(game, who)) {
      dur = Math.max(8, Math.floor(dur * 0.6));
      frac = 0.05;
    }
    f.plague = Math.max(f.plague || 0, dur);
    f.plagueFrac = frac;
    f.plagueSpread = false;
    events.push("大疫起於" + civName(f.n));
  }

  function applyFoodRot(game, who, events) {
    const f = ensureFaction(game, who);
    const have = foodOf(game, who);
    let take = 0.55 + Math.random() * 0.2;
    if (f.skills && f.skills.deep) take *= 0.65;
    const lost = spendFood(game, who, Math.ceil(have * take));
    f.rotHungry = 8;
    events.push(civName(f.n) + "倉中生霉" + (lost ? "（-" + lost + "糧）" : ""));
  }

  function tickPlagues(game, events) {
    Object.keys(game.factions || {}).forEach(function (key) {
      const who = Number(key);
      const f = game.factions[who];
      if (!f || !(f.plague > 0)) return;
      scrapeOwner(game, who, f.plagueFrac || 0.08);
      f.plague -= 1;
      if (f.plague <= 0) {
        f.plague = 0;
        f.plagueFrac = 0;
        return;
      }
      if (f.plagueSpread || Math.random() > 0.18) return;
      const neigh = ownersTouching(game, who);
      if (!neigh.length) return;
      const other = neigh[Math.floor(Math.random() * neigh.length)];
      const dest = ensureFaction(game, other);
      dest.plague = Math.max(dest.plague || 0, Math.ceil(f.plague / 2));
      dest.plagueFrac = ownerHasWard(game, other) ? 0.05 : 0.08;
      f.plagueSpread = true;
      events.push("疫過了邊境，傳到" + civName(dest.n));
    });
  }

  function tickCrises(game) {
    const events = [];
    tickPlagues(game, events);
    const living = livingCrisisOwners(game);
    if (!living.length) return events;
    if (game.crisisIn == null) game.crisisIn = crisisWait();
    game.crisisIn -= 1;
    if (game.crisisIn > 0) return events;
    game.crisisIn = crisisWait();
    const who = pickCrisisVictim(game);
    if (who == null) return events;
    if (Math.random() < 0.62) applyPlague(game, who, events, 0);
    else applyFoodRot(game, who, events);
    return events;
  }

  function cellIsLand(game, i) {
    const t = game.terrain[i];
    return (
      t === TERRAIN.SOIL ||
      t === TERRAIN.FERTILE ||
      t === TERRAIN.SAND ||
      t === TERRAIN.MARSH ||
      t === TERRAIN.GROVE ||
      t === TERRAIN.HIGHLAND
    );
  }

  function pickLivedLand(game) {
    const hits = [];
    for (let i = 0; i < game.life.length; i++) {
      if (!game.life[i] || !cellIsLand(game, i)) continue;
      if (hits.length > 180 && Math.random() > 0.35) continue;
      hits.push(i);
    }
    if (!hits.length) return null;
    return hits[Math.floor(Math.random() * hits.length)];
  }

  function blowRadius(game) {
    const scale = Math.sqrt((game.cols * game.rows) / (200 * 120));
    return Math.round((16 + Math.floor(Math.random() * 13)) * Math.max(0.85, Math.min(1.45, scale)));
  }

  function fireRegionQuake(game, events) {
    const at = pickLivedLand(game);
    if (at == null) return false;
    const ox = at % game.cols;
    const oy = (at - ox) / game.cols;
    const r = blowRadius(game);
    let pKill = 0.4 + Math.random() * 0.15;
    let killed = 0;
    let seen = 0;
    for (let i = 0; i < game.life.length; i++) {
      if (!game.life[i]) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      if (wrapDelta(x, ox, game.cols) * wrapDelta(x, ox, game.cols) + distY(y, oy) * distY(y, oy) > r * r) continue;
      seen += 1;
      let p = pKill;
      const s = game.civCells && game.civCells[i];
      if (s && (s.trait === "resist" || s.legacy === "ward")) p *= 0.78;
      if (Math.random() >= p) continue;
      game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
      killed += 1;
    }
    if (!seen) return false;
    game.quakeTint = 16;
    game.quakeRing = { x: ox, y: oy, r: r, tint: 12 };
    events.push("某地強震，人口大減");
    return killed > 0 || true;
  }

  function typhoonStart(game) {
    const cands = [];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = 0; i < game.life.length; i++) {
      if (!game.life[i]) continue;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      for (let d = 0; d < 4; d++) {
        const nx = W.wrap(x + dirs[d][0], game.cols);
        const ny = y + dirs[d][1];
        if (ny < 0 || ny >= game.rows) continue;
        const ni = W.idx(nx, ny, game.cols);
        const t = game.terrain[ni];
        if (t === TERRAIN.WATER || t === TERRAIN.RIVER) cands.push(ni);
      }
    }
    if (cands.length) return cands[Math.floor(Math.random() * cands.length)];
    return pickLivedLand(game);
  }

  function fireTyphoon(game, events) {
    const start = typhoonStart(game);
    if (start == null) return false;
    let x = start % game.cols;
    let y = (start - x) / game.cols;
    const at = pickLivedLand(game);
    const tx = at == null ? W.wrap(x + 20, game.cols) : at % game.cols;
    const ty = at == null ? y : (at - tx) / game.cols;
    let dx = wrapDelta(x, tx, game.cols) === 0 ? (Math.random() < 0.5 ? 1 : -1) : ((tx - x + game.cols) % game.cols < game.cols / 2 ? 1 : -1);
    let dy = ty === y ? 0 : ty > y ? 1 : -1;
    if (!dx && !dy) dx = 1;
    const len = 28 + Math.floor(Math.random() * 21);
    const half = 2 + Math.floor(Math.random() * 3);
    const path = {};
    for (let step = 0; step < len; step++) {
      for (let oy = -half; oy <= half; oy++) {
        for (let ox = -half; ox <= half; ox++) {
          if (Math.abs(ox) + Math.abs(oy) > half + 1) continue;
          const px = W.wrap(x + ox, game.cols);
          const py = y + oy;
          if (py < 0 || py >= game.rows) continue;
          path[W.idx(px, py, game.cols)] = 1;
        }
      }
      if (Math.random() < 0.32) {
        const turn = Math.random() < 0.5 ? 1 : -1;
        const ndx = dy * turn;
        const ndy = -dx * turn;
        dx = ndx;
        dy = ndy;
        if (!dx && !dy) dx = 1;
      }
      x = W.wrap(x + dx, game.cols);
      y = y + dy;
      if (y < 0) {
        y = 0;
        dy = 1;
      }
      if (y >= game.rows) {
        y = game.rows - 1;
        dy = -1;
      }
    }
    const cache = (game.skillCells && game.skillCells.cache) || {};
    Object.keys(path).forEach(function (key) {
      const i = Number(key);
      if (!game.life[i] || cache[i]) return;
      game.life[i] = 0;
      if (game.owner) game.owner[i] = 0;
    });
    game.stormPath = path;
    game.stormDir = { dx: dx, dy: dy };
    game.stormTint = 16;
    events.push("颱風過境，無房者捲走");
    return true;
  }

  function fireDarkAge(game, events) {
    const lifeBy = ownerLifeCounts(game);
    const small = [];
    Object.keys(game.factions || {}).forEach(function (key) {
      const o = Number(key);
      const f = game.factions[o];
      if (!f || !f.alive || o === 0) return;
      if (f.kingdom || f.empire) {
        if (Math.random() < 0.35) scrapeOwner(game, o, 0.08);
        return;
      }
      small.push({ o: o, w: 8 + Math.max(1, 40 - (lifeBy[o] || 0)) + ((f.hungryStreak || 0) >= 4 ? 10 : 0) });
    });
    if (!small.length) return false;
    let n = 1 + (small.length > 3 && Math.random() < 0.45 ? 1 : 0);
    events.push("諸部離散");
    while (n > 0 && small.length) {
      let sum = 0;
      small.forEach(function (s) {
        sum += s.w;
      });
      let r = Math.random() * sum;
      let pick = small[small.length - 1];
      for (let i = 0; i < small.length; i++) {
        r -= small[i].w;
        if (r <= 0) {
          pick = small[i];
          small.splice(i, 1);
          break;
        }
      }
      const f = game.factions[pick.o];
      if ((f.towns || 0) <= 1 && (lifeBy[pick.o] || 0) < 28) scatterFaction(game, pick.o, events);
      else scrapeOwner(game, pick.o, 0.28);
      n -= 1;
    }
    return true;
  }

  function tickDarkAge(game, events) {
    if ((game.generation || 0) < 400) return;
    if (game.darkIn == null) game.darkIn = darkWait();
    game.darkIn -= 1;
    if (game.darkIn > 0) return;
    game.darkIn = darkWait();
    if (livingFactionCount(game) < 4) return;
    fireDarkAge(game, events);
  }

  function tickRegionBlows(game) {
    const events = [];
    tickDarkAge(game, events);
    if (game.stormTint) {
      game.stormTint = Math.max(0, game.stormTint - 1);
      if (!game.stormTint) game.stormPath = {};
    }
    if (game.quakeRing) {
      game.quakeRing.tint = (game.quakeRing.tint || 0) - 1;
      if (game.quakeRing.tint <= 0) game.quakeRing = null;
    }
    let pop = 0;
    if (game.life) {
      for (let i = 0; i < game.life.length; i++) if (game.life[i]) pop += 1;
    }
    if (pop < 28) return events;
    if (game.blowIn == null) game.blowIn = blowWait();
    game.blowIn -= 1;
    if (game.blowIn > 0) return events;
    game.blowIn = blowWait();
    const sid = seasonIdOf(game);
    let pStorm = 0.4;
    if (sid === "rain" || sid === "flood") pStorm = 0.55;
    if (sid === "drought" || sid === "winter") pStorm = 0.22;
    if (Math.random() < pStorm) fireTyphoon(game, events);
    else fireRegionQuake(game, events);
    return events;
  }

  function expandDikes(game) {
    Object.keys(game.dikeCells || {}).forEach(function (key) {
      const i = Number(key);
      if (game.terrain[i] !== TERRAIN.WATER) return;
      if (game.life[i]) return;
      game.life[i] = 1;
      const x = i % game.cols;
      const y = (i - x) / game.cols;
      let who = 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const ni = idx(game, x + d[0], y + d[1]);
        const s = game.civCells && game.civCells[ni];
        if (s) who = s.owner || 0;
      });
      if (game.owner) game.owner[i] = who;
    });
  }

  global.LifeCiv = {
    TRAITS: TRAITS,
    LEGACIES: LEGACIES,
    HERO_TAGS: HERO_TAGS,
    emptyCivState: emptyCivState,
    findGroups: findGroups,
    trackSettlements: trackSettlements,
    markExpandBirths: markExpandBirths,
    fireDisaster: fireDisaster,
    foodWeight: foodWeight,
    traitLabel: traitLabel,
    disasterWait: disasterWait,
    foodOf: foodOf,
    addFood: addFood,
    spendFood: spendFood,
    syncFood: syncFood,
    isHungry: isHungry,
    majorityOwner: majorityOwner,
    ownerOf: ownerOf,
    occupyRuins: occupyRuins,
    washRuins: washRuins,
    trySpawnNpc: trySpawnNpc,
    tickCaravans: tickCaravans,
    expandDikes: expandDikes,
    evacuateHighGround: evacuateHighGround,
    tryWinterCrossings: tryWinterCrossings,
    markBoatCells: markBoatCells,
    tryHearthSpark: tryHearthSpark,
    tickRafts: tickRafts,
    growRaftFloor: growRaftFloor,
    starveRank: starveRank,
    tickStain: tickStain,
    factionList: factionList,
    tickCrises: tickCrises,
    tickRegionBlows: tickRegionBlows,
    recordChronicle: recordChronicle,
    checkExtinct: checkExtinct,
    civName: civName,
    potencyOf: potencyOf,
    npcWait: npcWait,
    tickBorderWar: tickBorderWar,
    hasHeroTag: hasHeroTag,
    isEmpireOwner: isEmpireOwner,
    densityScale: densityScale,
  };
})(window);

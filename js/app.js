(function () {
  const engine = window.LifeEngine;
  const world = window.LifeWorld;
  const patterns = window.LifePatterns.PATTERNS;
  const gallery = window.LifeGallery;
  const TERRAIN = world.TERRAIN;
  const RESOURCE = world.RESOURCE;
  const CURRENT = world.CURRENT || { NONE: 0, COLD: 1, WARM: 2 };

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const toastEl = document.getElementById("toast");
  const stampList = document.getElementById("stamp-list");
  const galleryList = document.getElementById("gallery-list");
  const btnPlay = document.getElementById("btn-play");
  const btnStep = document.getElementById("btn-step");
  const btnScatter = document.getElementById("btn-scatter");
  const btnClear = document.getElementById("btn-clear");
  const btnNew = document.getElementById("btn-new");
  const btnSize = document.getElementById("btn-size");
  const speedEl = document.getElementById("speed");
  const statusEl = document.getElementById("status");
  const factionListEl = document.getElementById("faction-list");
  const chronicleEl = document.getElementById("chronicle");
  const chronicleListEl = document.getElementById("chronicle-list");
  const chronicleTitleEl = document.getElementById("chronicle-title");
  const btnChronicle = document.getElementById("btn-chronicle");
  const btnChronicleClose = document.getElementById("chronicle-close");

  const TERRAIN_COLOR = {
    0: [88, 128, 62],
    1: [102, 148, 58],
    2: [128, 122, 110],
    3: [48, 124, 172],
    4: [34, 108, 106],
    5: [176, 206, 214],
    6: [132, 98, 62],
    7: [36, 78, 62],
    8: [16, 52, 24],
    9: [118, 112, 92],
    10: [214, 224, 232],
  };

  const SEASON_TINT = {
    warm: "rgba(210, 170, 80, 0.03)",
    rain: "rgba(50, 130, 190, 0.06)",
    drought: "rgba(150, 90, 30, 0.08)",
    flood: "rgba(20, 55, 110, 0.09)",
    winter: "rgba(200, 225, 240, 0.07)",
  };

  const FIT_SIZE = 6;

  const STAIN_PALETTE = [
    [214, 154, 58],
    [232, 118, 86],
    [186, 92, 148],
    [86, 148, 214],
    [220, 184, 92],
  ];

  const SIZE_KEY = "survival-life-map-size";
  let game = null;
  const found = gallery.loadFound();
  let playing = false;
  let selectedStamp = null;
  let stampCells = null;
  let hover = { x: -1, y: -1 };
  let painting = false;
  let erasing = false;
  let panning = false;
  let panLast = null;
  let viewZoom = 1;
  let camX = 160;
  let camY = 96;
  let lastStep = 0;
  let toastTimer = 0;

  function speedDelay() {
    const v = Number(speedEl.value);
    return 430 - v * 38;
  }

  function loadSavedSize() {
    try {
      const raw = localStorage.getItem(SIZE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        const list = engine.MAP_SIZES || [];
        for (let i = 0; i < list.length; i++) {
          if (list[i].cols === o.cols && list[i].rows === o.rows) return list[i];
        }
      }
    } catch (err) {}
    return (engine.MAP_SIZES && engine.MAP_SIZES[1]) || { cols: 320, rows: 192 };
  }

  function startWithSize(cols, rows) {
    playing = false;
    btnPlay.textContent = "播放";
    btnPlay.classList.remove("playing");
    if (!game) game = engine.createGame(cols, rows);
    else engine.resizeMap(game, cols, rows);
    viewZoom = 1;
    camX = game.cols / 2;
    camY = game.rows / 2;
    closeChronicle();
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify({ cols: game.cols, rows: game.rows }));
    } catch (err) {}
    const overlay = document.getElementById("size-overlay");
    if (overlay) overlay.classList.add("hidden");
    hud();
    resize();
    setStatus(
      game.cols +
        "×" +
        game.rows +
        "。" +
        (game.worldNote ? game.worldNote + "。" : "") +
        "左鍵種植，右鍵擦除。"
    );
    if (game.worldNote) showToast(game.worldNote);
    if (window.LifeDebug) {
      window.LifeDebug.cols = game.cols;
      window.LifeDebug.rows = game.rows;
      window.LifeDebug.gen = game.generation;
    }
  }

  function openSizePicker(canCancel) {
    playing = false;
    btnPlay.textContent = "播放";
    btnPlay.classList.remove("playing");
    const overlay = document.getElementById("size-overlay");
    const box = document.getElementById("size-choices");
    const cancel = document.getElementById("size-cancel");
    if (!overlay || !box) return;
    const saved = loadSavedSize();
    box.innerHTML = "";
    (engine.MAP_SIZES || []).forEach(function (sz) {
      const btn = document.createElement("button");
      btn.type = "button";
      if (sz.cols === saved.cols && sz.rows === saved.rows) btn.className = "picked";
      btn.innerHTML =
        "<strong>" + sz.name + "　" + sz.cols + "×" + sz.rows + "</strong><span>" + sz.note + "</span>";
      btn.addEventListener("click", function () {
        startWithSize(sz.cols, sz.rows);
      });
      box.appendChild(btn);
    });
    if (cancel) {
      if (canCancel && game) cancel.classList.remove("hidden");
      else cancel.classList.add("hidden");
    }
    overlay.classList.remove("hidden");
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.add("hidden");
    }, 1800);
  }

  function unlock(pattern) {
    if (found.has(pattern.id)) return;
    found.add(pattern.id);
    gallery.saveFound(found);
    renderGallery();
    showToast("發現：" + pattern.name);
  }

  function scanDiscoveries() {
    gallery.scan(game, patterns, found).forEach(unlock);
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function renderFactions() {
    if (!factionListEl) return;
    const list = window.LifeCiv.factionList(game);
    if (!list.length) {
      factionListEl.innerHTML = "<p class=\"hint\">尚無正式聚落。</p>";
      return;
    }
    factionListEl.innerHTML = list
      .map(function (f) {
        const skills = f.skills.length ? f.skills.join("、") : "尚未產生技能";
        const hero = f.hero ? "<div class=\"faction-hero\">" + f.hero + "</div>" : "";
        const rgb = factionRgb(f.owner);
        const deadKing = !f.alive && f.wasKingdom;
        const border = deadKing
          ? "border-color:#d4a017"
          : "border-left-color: rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
        return (
          "<div class=\"faction-item " +
          (f.player ? "player" : "guest") +
          (f.alive ? "" : " dead") +
          (deadKing ? " was-kingdom" : "") +
          "\" style=\"" +
          border +
          "\"><div class=\"faction-head\"><strong>" +
          f.name +
          "</strong><span>" +
          f.rank +
          "</span></div><div class=\"faction-skills\">" +
          skills +
          "</div><div class=\"faction-food\">糧 " +
          f.food +
          (f.alive && f.hungry ? " · 饑" : "") +
          (f.alive && f.plague ? " · 疫" : "") +
          "</div>" +
          hero +
          "</div>"
        );
      })
      .join("");
  }

  function fillChronicle() {
    if (!chronicleListEl) return;
    const rows = game.chronicle || [];
    const season = engine.currentSeason(game);
    const year = (world.yearKindLabel && world.yearKindLabel(game)) || "平年";
    const kicker =
      "<li class=\"kicker\">本局 · " + year + " · " + season.name + "</li>";
    if (!rows.length) {
      chronicleListEl.innerHTML = kicker + "<li>還沒有大事。</li>";
      return;
    }
    chronicleListEl.innerHTML =
      kicker +
      rows
        .map(function (row) {
          return "<li><span>第 " + row.gen + " 代</span>" + row.text + "</li>";
        })
        .join("");
  }

  function openChronicle(title) {
    if (!chronicleEl) return;
    if (chronicleTitleEl) chronicleTitleEl.textContent = title || "大事紀";
    fillChronicle();
    chronicleEl.classList.remove("hidden");
  }

  function closeChronicle() {
    if (chronicleEl) chronicleEl.classList.add("hidden");
  }

  function hud() {
    if (!game) return;
    const season = engine.currentSeason(game);
    document.getElementById("stat-gen").textContent = String(game.generation);
    document.getElementById("stat-pop").textContent = String(engine.population(game));
    document.getElementById("stat-food").textContent = String(
      window.LifeCiv.foodOf ? window.LifeCiv.foodOf(game, 0) : game.food || 0
    );
    document.getElementById("stat-energy").textContent = String(game.energy);
    document.getElementById("stat-climate").textContent =
      season.name +
      (world.monsoonLabel && world.monsoonLabel(game) ? " · " + world.monsoonLabel(game) : "") +
      " · " +
      engine.seasonLeft(game) +
      (game.omen ? " 災兆" + game.disasterIn : "");
    const wrap = document.getElementById("stat-climate-wrap");
    wrap.className =
      "stat climate " +
      season.id +
      (game.yearKind === "wet" ? " wet" : "") +
      (game.yearKind === "dry" ? " dry" : "") +
      (game.omen ? " omen" : "") +
      (game.stormTint ? " storm" : "") +
      (game.glacialLeft ? " glacial" : "") +
      (game.climateKind === "hot" ? " mega-hot" : "") +
      (game.climateKind === "cold" ? " mega-cold" : "");
    document.getElementById("stat-civ").textContent = window.LifeCiv.traitLabel(game);
    renderFactions();
    if (game.omen) {
      setStatus(
        "災兆：還有 " +
          game.disasterIn +
          " 代。連成 8 格，或留下 2×2／長廊／拐角／短蛇。極端氣候會留最後一座聚落；地震先砸房屋與城垣。"
      );
    } else if (game.epochOmen === "volcano") {
      setStatus("災兆：地要裂了。一場火山、強震與海嘯將來。");
    } else if (game.epochOmen === "climate") {
      setStatus("災兆：年候將亂。全球會過熱或過冷。");
    } else if (game.epochOmen === "drift") {
      setStatus("災兆：山脈不安，脊線將開始挪動。");
    } else if (game.glacialLeft) {
      setStatus("中冰期：近岸與淺海結冰，饑餓加重。還有 " + game.glacialLeft + " 代。");
    } else if (game.climateKind === "hot") {
      setStatus("全球酷熱乾旱。沙漠擴張，海面偏低。");
    } else if (game.climateKind === "cold") {
      setStatus("全球嚴寒。冰蓋加寬，雪線下壓。");
    } else if (game.stormTint) {
      setStatus("颱風過境，無房者被捲走。只有方塊房屋能留下。");
    } else if (game.quakeRing && game.quakeRing.tint > 0) {
      setStatus("某地強震：圈內居民驟減。");
    } else if (season.id === "rain" && engine.seasonLeft(game) <= 8) {
      setStatus("洪水將至。學會登高的聚落會往岩邊、離水處撤；堤防則留下守岸。");
    } else if (game.skills && game.skills.cache) {
      setStatus("方塊窖藏中：那 4 格不吃糧、不被餓死。");
    } else if (game.skills && game.skills.hardy) {
      setStatus("長廊耐旱中：這段巷道不受乾旱收緊。");
    } else if (game.hungry) {
      setStatus("文明一在挨餓，走廊正從外緣退縮。他族有自己的糧，不會被連坐。");
    } else if (season.id === "drought") {
      setStatus("乾旱：內陸鄰居 4 也活不了；湖岸仍可續，岩邊可避旱。");
    } else if (season.id === "winter") {
      setStatus(
        game.iceAge
          ? "小冰期：近岸與淺海結冰，可以過海。解凍後冰上的生命會掉進水裡。"
          : "冬季：河面與近岸結冰，可以過岸。聚落也可能放小船出海。"
      );
    } else if (season.id === "flood") {
      setStatus("洪水：湖岸被淹，活細胞會被沖掉。");
    } else if (season.id === "rain") {
      setStatus("雨季季風吹向迎風坡，背風是雨影。岸邊沃土會慢慢變多。");
    } else if (season.id === "warm") {
      setStatus("地形會慢慢變：河岸會挪，內陸湖可能因取水縮小，大海不會被抽乾。");
    } else if (game.energy <= 0) {
      setStatus("能量用盡。播放演化，採結晶才能再種。");
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    draw();
  }

  function layout() {
    const dpr = window.devicePixelRatio || 1;
    if (!game) return { size: 2, ox: 0, oy: 0, dpr: dpr, fit: 1 };
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const fit = Math.max(1, Math.floor(Math.min(w / game.cols, h / game.rows)));
    const size = Math.max(2, Math.floor(fit * viewZoom));
    let ox;
    let oy;
    if (viewZoom <= 1.02) {
      ox = Math.floor((w - size * game.cols) / 2);
      oy = Math.floor((h - size * game.rows) / 2);
    } else {
      ox = Math.floor(w / 2 - camX * size);
      oy = Math.floor(h / 2 - camY * size);
    }
    return { size: size, ox: ox, oy: oy, dpr: dpr, fit: fit };
  }

  function clampCam() {
    if (viewZoom <= 1.02) {
      camX = game.cols / 2;
      camY = game.rows / 2;
      return;
    }
    const L = layout();
    if (!L.size) return;
    const viewW = canvas.width / L.dpr / L.size;
    const viewH = canvas.height / L.dpr / L.size;
    const halfW = viewW / 2;
    const halfH = viewH / 2;
    if (viewW >= game.cols) camX = game.cols / 2;
    else camX = Math.max(halfW, Math.min(game.cols - halfW, camX));
    if (viewH >= game.rows) camY = game.rows / 2;
    else camY = Math.max(halfH, Math.min(game.rows - halfH, camY));
  }

  function cellAtEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    const L = layout();
    const x = Math.floor((ev.clientX - rect.left - L.ox) / L.size);
    const y = Math.floor((ev.clientY - rect.top - L.oy) / L.size);
    if (!game) return null;
    if (x < 0 || y < 0 || x >= game.cols || y >= game.rows) return null;
    return { x: x, y: y };
  }

  function adjacentRgb(rgb, n) {
    const k = n || 0;
    return [
      Math.max(0, Math.min(255, rgb[0] + k)),
      Math.max(0, Math.min(255, rgb[1] + k)),
      Math.max(0, Math.min(255, rgb[2] + Math.round(k * 0.7))),
    ];
  }

  function rgbToHex(rgb) {
    function h(v) {
      v = Math.max(0, Math.min(255, v | 0));
      return (v < 16 ? "0" : "") + v.toString(16);
    }
    return "#" + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
  }

  function factionRgb(owner) {
    const i = ((owner || 0) % STAIN_PALETTE.length + STAIN_PALETTE.length) % STAIN_PALETTE.length;
    return STAIN_PALETTE[i];
  }

  function lifeHex(owner, town, walled) {
    const base = factionRgb(owner);
    if (walled) return rgbToHex(adjacentRgb(base, 36));
    if (town) return rgbToHex(adjacentRgb(base, 72));
    return rgbToHex(adjacentRgb(base, 22));
  }

  function shade(rgb, x, y, size) {
    const n = ((x * 73 + y * 149) % 9) - 4;
    if (size < FIT_SIZE) {
      return [
        Math.max(0, Math.min(255, rgb[0] + n)),
        Math.max(0, Math.min(255, rgb[1] + n)),
        Math.max(0, Math.min(255, rgb[2] + Math.round(n * 0.7))),
      ];
    }
    const n2 = ((x * 31 + y * 97) % 5) - 2;
    return [
      Math.max(0, Math.min(255, rgb[0] + n * 3 + n2 * 2)),
      Math.max(0, Math.min(255, rgb[1] + n * 3 + n2)),
      Math.max(0, Math.min(255, rgb[2] + n * 2 + n2)),
    ];
  }

  function clampC(v) {
    return Math.max(0, Math.min(255, v | 0));
  }

  function adjRgb(rgb, r, g, b) {
    return [clampC(rgb[0] + r), clampC(rgb[1] + g), clampC(rgb[2] + b)];
  }

  function isWetCell(t) {
    return t === TERRAIN.WATER || t === TERRAIN.RIVER;
  }

  function isSolidLand(t) {
    if (t == null) return false;
    return t !== TERRAIN.WATER && t !== TERRAIN.RIVER && t !== TERRAIN.ICE;
  }

  function sandTone(rgb, x, y) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (neighborTerrain(x, y, dx, dy) === TERRAIN.SAND) n++;
      }
    }
    if (n < 2) return rgb;
    const u = Math.min(1, (n - 1) / 6);
    return [
      Math.round(rgb[0] + (196 - rgb[0]) * u),
      Math.round(rgb[1] + (168 - rgb[1]) * u),
      Math.round(rgb[2] + (110 - rgb[2]) * u),
    ];
  }

  function neighborTerrain(x, y, dx, dy) {
    const ny = y + dy;
    if (ny < 0 || ny >= game.rows) return null;
    return game.terrain[world.idx(world.wrap(x + dx, game.cols), ny, game.cols)];
  }

  function neighborHeight(x, y, dx, dy) {
    if (!game.height) return null;
    const ny = y + dy;
    if (ny < 0 || ny >= game.rows) return null;
    return game.height[world.idx(world.wrap(x + dx, game.cols), ny, game.cols)];
  }

  function shoreWater(x, y) {
    return (
      isSolidLand(neighborTerrain(x, y, 1, 0)) ||
      isSolidLand(neighborTerrain(x, y, -1, 0)) ||
      isSolidLand(neighborTerrain(x, y, 0, 1)) ||
      isSolidLand(neighborTerrain(x, y, 0, -1))
    );
  }

  function shoreLand(x, y) {
    return (
      isWetCell(neighborTerrain(x, y, 1, 0)) ||
      isWetCell(neighborTerrain(x, y, -1, 0)) ||
      isWetCell(neighborTerrain(x, y, 0, 1)) ||
      isWetCell(neighborTerrain(x, y, 0, -1))
    );
  }

  function slopeLight(rgb, t, x, y, size) {
    if (!game.height) return rgb;
    const h = game.height[world.idx(x, y, game.cols)] || 0;
    const east = neighborHeight(x, y, 1, 0);
    const south = neighborHeight(x, y, 0, 1);
    let d = 0;
    if (east != null) d += h - east;
    if (south != null) d += h - south;
    let lift = Math.max(-18, Math.min(18, Math.round(d * 0.55)));
    if (isWetCell(t)) lift = Math.round(lift * 0.22);
    else if (t === TERRAIN.SNOW || t === TERRAIN.HIGHLAND) lift = Math.round(lift * 1.35);
    if (size < FIT_SIZE) lift = Math.round(lift * 0.7);
    if (!lift) return rgb;
    if (t === TERRAIN.HIGHLAND || t === TERRAIN.ROCK) {
      return adjRgb(rgb, Math.round(lift * 1.1), lift, Math.round(lift * 0.65));
    }
    return adjRgb(rgb, lift, lift, Math.round(lift * 0.82));
  }

  function riverFlowDir(x, y) {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let best = dirs[0];
    let bestH = 9999;
    for (let d = 0; d < 4; d++) {
      const ny = y + dirs[d][1];
      if (ny < 0 || ny >= game.rows) continue;
      const ni = world.idx(world.wrap(x + dirs[d][0], game.cols), ny, game.cols);
      const nt = game.terrain[ni];
      if (nt !== TERRAIN.RIVER && nt !== TERRAIN.WATER) continue;
      const h = game.height ? game.height[ni] : 128;
      if (h < bestH) {
        bestH = h;
        best = dirs[d];
      }
    }
    return best;
  }

  function gradeTerrain(rgb, t, sid, yearKind) {
    const wet = yearKind === "wet";
    const dry = yearKind === "dry";
    const water = isWetCell(t);
    if (sid === "winter") {
      if (t === TERRAIN.HIGHLAND || t === TERRAIN.ROCK) rgb = adjRgb(rgb, 8, 6, 2);
      else rgb = adjRgb(rgb, 5, 8, 13);
      if (t === TERRAIN.SNOW || t === TERRAIN.ICE) rgb = adjRgb(rgb, 11, 12, 14);
      if (water) rgb = adjRgb(rgb, 4, 6, 10);
    } else if (sid === "rain" || sid === "flood") {
      if (water) rgb = adjRgb(rgb, -6, -2, 11);
      else if (t === TERRAIN.HIGHLAND || t === TERRAIN.ROCK) rgb = adjRgb(rgb, -4, 3, -2);
      else rgb = adjRgb(rgb, -6, 5, 3);
      if (wet && t !== TERRAIN.HIGHLAND && t !== TERRAIN.ROCK) rgb = adjRgb(rgb, -4, 3, 9);
    } else if (sid === "drought") {
      rgb = adjRgb(rgb, 11, 5, -7);
      if (t === TERRAIN.SAND) rgb = adjRgb(rgb, 9, 6, -3);
      if (dry) rgb = adjRgb(rgb, 6, 3, -5);
    } else {
      rgb = adjRgb(rgb, 4, 2, -3);
    }
    return rgb;
  }

  function waveLift(t, sid, yearKind, x, y, gen) {
    if (t === TERRAIN.ICE) {
      if ((x * 3 + y * 7 + gen) % 6 === 0) return [18, 20, 22];
      return null;
    }
    if (!isWetCell(t)) return null;
    const wet = yearKind === "wet";
    const storm = sid === "rain" || sid === "flood";
    if (sid === "winter") {
      if ((x + y * 2 + gen) % 5 === 0) return [16, 18, 22];
      return null;
    }
    if (t === TERRAIN.RIVER) {
      const period = storm || wet ? 5 : 7;
      if ((x * 2 + y + Math.floor(gen / 2)) % period === 0) {
        return storm || wet ? [14, 22, 18] : [8, 14, 12];
      }
      return null;
    }
    const period = wet && storm ? 4 : storm ? 5 : 6;
    if ((x + y + Math.floor(gen / 2)) % period === 0) {
      return storm || wet ? [20, 16, 28] : [10, 10, 14];
    }
    return null;
  }

  function rgbFill(rgb) {
    ctx.fillStyle = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
  }

  function waterSubdiv(size) {
    if (size < 2) return 1;
    if (size < 9) return 2;
    return 3;
  }

  function paintCellFill(px, py, size, rgb, t, x, y) {
    if (t !== TERRAIN.WATER) {
      rgbFill(rgb);
      ctx.fillRect(px, py, size, size);
      return;
    }
    const n = waterSubdiv(size);
    if (n <= 1) {
      rgbFill(rgb);
      ctx.fillRect(px, py, size, size);
      return;
    }
    const step = size / n;
    for (let sy = 0; sy < n; sy++) {
      for (let sx = 0; sx < n; sx++) {
        const k = ((x * n + sx) * 13 + (y * n + sy) * 29) % 7 - 3;
        rgbFill(adjRgb(rgb, k, k + (k > 0 ? 1 : 0), Math.round(k * 0.35)));
        ctx.fillRect(px + sx * step, py + sy * step, step + 0.5, step + 0.5);
      }
    }
  }

  function paintTerrainMarks(px, py, size, t, x, y) {
    if (size < FIT_SIZE) return;
    const h = ((x * 73 + y * 149) % 11 + 11) % 11;
    const m = Math.max(1, Math.floor(size * 0.22));
    if (t === TERRAIN.GROVE) {
      ctx.fillStyle = "rgba(18, 52, 24, 0.55)";
      ctx.fillRect(px + (h % 3), py + (h % 2), m, m);
      if (size >= 5) ctx.fillRect(px + size - m - 1, py + Math.floor(size * 0.4), m, m);
      if (size >= 8) {
        ctx.fillStyle = "rgba(40, 72, 32, 0.4)";
        ctx.fillRect(px + Math.floor(size * 0.35), py + 1, 1, Math.max(1, m));
      }
    } else if (t === TERRAIN.ROCK || t === TERRAIN.HIGHLAND) {
      ctx.fillStyle = t === TERRAIN.ROCK ? "rgba(54, 48, 40, 0.42)" : "rgba(72, 64, 46, 0.38)";
      ctx.fillRect(px + Math.max(0, size - m - (h % 2)), py + (h % 3), m, Math.max(1, m - 1));
      if (size >= 8 && h % 3 === 0) {
        ctx.fillStyle = "rgba(220, 220, 230, 0.18)";
        ctx.fillRect(px + 1, py + 1, Math.max(1, Math.floor(size * 0.25)), 1);
      }
    } else if (t === TERRAIN.SAND) {
      ctx.fillStyle = "rgba(230, 210, 150, 0.38)";
      const span = Math.max(1, size - 2);
      ctx.fillRect(px + (h % span), py + ((h * 3) % span), 1, 1);
      ctx.fillRect(px + ((h * 5) % span), py + ((h * 2) % span), 1, 1);
    } else if (t === TERRAIN.MARSH) {
      ctx.fillStyle = "rgba(12, 36, 32, 0.34)";
      ctx.fillRect(px, py + size - Math.max(1, Math.floor(size * 0.3)), size, Math.max(1, Math.floor(size * 0.2)));
    } else if (t === TERRAIN.RIVER) {
      const flow = riverFlowDir(x, y);
      ctx.fillStyle = "rgba(168, 224, 214, 0.3)";
      const thick = Math.max(1, Math.floor(size * 0.16));
      if (flow[0] !== 0 && flow[1] === 0) {
        ctx.fillRect(px, py + Math.floor(size / 2) - Math.floor(thick / 2), size, thick);
      } else if (flow[1] !== 0 && flow[0] === 0) {
        ctx.fillRect(px + Math.floor(size / 2) - Math.floor(thick / 2), py, thick, size);
      } else {
        ctx.fillRect(px, py + Math.floor(size * 0.42), size, thick);
      }
    } else if (t === TERRAIN.ICE && h % 4 === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
      ctx.fillRect(px, py + 1, Math.max(1, Math.floor(size * 0.28)), 1);
    } else if (t === TERRAIN.SNOW) {
      if (h % 3 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
        ctx.fillRect(px + (h % 2), py, Math.max(1, Math.floor(size * 0.35)), 1);
      }
      if (size >= 6 && h % 4 === 1) {
        ctx.fillStyle = "rgba(210, 222, 236, 0.4)";
        ctx.fillRect(px + Math.floor(size * 0.4), py + Math.floor(size * 0.55), 1, 1);
      }
    }
  }

  function draw() {
    const L = layout();
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0b0e0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!game || L.size < 2) return;

    const size = L.size;
    const ruinMap = {};
    (game.ruinSites || []).forEach(function (site) {
      site.cells.forEach(function (i) {
        ruinMap[i] = 1;
      });
    });
    const viewW = canvas.width / L.dpr;
    const viewH = canvas.height / L.dpr;
    const x0 = Math.max(0, Math.floor(-L.ox / size));
    const y0 = Math.max(0, Math.floor(-L.oy / size));
    const x1 = Math.min(game.cols, Math.ceil((viewW - L.ox) / size) + 1);
    const y1 = Math.min(game.rows, Math.ceil((viewH - L.oy) / size) + 1);
    const sid = engine.currentSeason(game).id;
    const yearKind = game.yearKind;
    const gen = game.generation || 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = world.idx(x, y, game.cols);
        const rgb0 = TERRAIN_COLOR[game.terrain[i]] || TERRAIN_COLOR[0];
        let rgb = shade(rgb0, x, y, size);
        if (game.terrain[i] === TERRAIN.WATER && game.height && game.seaLevel != null && game.height[i] < game.seaLevel - 18) {
          const deep = Math.min(14, Math.floor((game.seaLevel - 18 - game.height[i]) * 0.5));
          rgb = [
            Math.max(0, rgb[0] - Math.floor(deep * 0.7)),
            Math.max(0, rgb[1] - Math.floor(deep * 0.45)),
            Math.max(0, rgb[2] - Math.floor(deep * 0.15)),
          ];
        } else if (game.height && game.height[i]) {
          const lift = Math.floor((game.height[i] - 110) / 28);
          rgb = [
            Math.max(0, Math.min(255, rgb[0] + lift)),
            Math.max(0, Math.min(255, rgb[1] + lift)),
            Math.max(0, Math.min(255, rgb[2] + lift)),
          ];
        }
        rgb = gradeTerrain(rgb, game.terrain[i], sid, yearKind);
        rgb = slopeLight(rgb, game.terrain[i], x, y, size);
        if (game.terrain[i] === TERRAIN.SAND) rgb = sandTone(rgb, x, y);
        if (game.terrain[i] === TERRAIN.WATER && game.current) {
          if (game.current[i] === CURRENT.COLD) rgb = adjRgb(rgb, -12, -8, 2);
          else if (game.current[i] === CURRENT.WARM) rgb = adjRgb(rgb, 10, 18, 6);
        }
        if (game.driedRiver && game.driedRiver[i]) rgb = adjRgb(rgb, 14, 2, -22);
        if (game.stormPath && game.stormPath[i] && game.stormTint) {
          rgb = adjRgb(rgb, -10, -6, 8);
        }
        if (isWetCell(game.terrain[i]) && shoreWater(x, y)) {
          if (game.terrain[i] === TERRAIN.WATER) {
            if (game.current && game.current[i] === CURRENT.COLD) rgb = adjRgb(rgb, -2, 8, 12);
            else if (game.current && game.current[i] === CURRENT.WARM) rgb = adjRgb(rgb, 22, 34, 10);
            else rgb = adjRgb(rgb, 16, 26, 6);
          } else rgb = adjRgb(rgb, -18, -12, -8);
          if (size >= FIT_SIZE) {
            const storm = sid === "rain" || sid === "flood" || (game.stormPath && game.stormPath[i]);
            const foamPeriod = storm || yearKind === "wet" ? 2 : 3;
            if ((x * 5 + y * 11 + Math.floor(gen / 2)) % foamPeriod === 0) {
              rgb = adjRgb(rgb, 42, 40, 44);
            }
          }
        } else if (isSolidLand(game.terrain[i]) && shoreLand(x, y)) {
          rgb = adjRgb(rgb, -12, -8, -6);
          if (game.terrain[i] === TERRAIN.SAND || game.terrain[i] === TERRAIN.SOIL) {
            rgb = adjRgb(rgb, 10, 6, -4);
          }
        }
        if (size >= FIT_SIZE && game.terrain[i] === TERRAIN.WATER && (x + Math.floor(y / 2) + Math.floor(gen / 3)) % 9 === 0) {
          rgb = adjRgb(rgb, 8, 10, 16);
        }
        if (size >= FIT_SIZE) {
          const wave = waveLift(game.terrain[i], sid, yearKind, x, y, gen);
          if (wave) rgb = adjRgb(rgb, wave[0], wave[1], wave[2]);
        }
        paintCellFill(L.ox + x * size, L.oy + y * size, size, rgb, game.terrain[i], x, y);
        if (game.stain && game.stain[i] && !game.life[i]) {
          const palette = STAIN_PALETTE[(game.stainWho[i] - 1 + STAIN_PALETTE.length) % STAIN_PALETTE.length];
          const a = 0.22 + (game.stain[i] / 12) * 0.42;
          ctx.fillStyle = "rgba(" + palette[0] + "," + palette[1] + "," + palette[2] + "," + a + ")";
          ctx.fillRect(L.ox + x * size, L.oy + y * size, size, size);
        }
        if (!game.life[i]) paintTerrainMarks(L.ox + x * size, L.oy + y * size, size, game.terrain[i], x, y);
      }
    }

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = world.idx(x, y, game.cols);
        const px = L.ox + x * size;
        const py = L.oy + y * size;
        const res = game.resources[i];
        if (ruinMap[i] && !game.life[i]) {
          ctx.fillStyle = "#5a3a28";
          const pad = Math.max(1, size * 0.22);
          ctx.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2);
        }
        const amt = Math.max(1, (game.resAmt && game.resAmt[i]) || 1);
        if (res === RESOURCE.NUTRIENT) {
          ctx.beginPath();
          ctx.fillStyle = "#f0c044";
          ctx.arc(px + size * 0.5, py + size * 0.5, Math.max(1.6, size * (0.16 + amt * 0.1)), 0, Math.PI * 2);
          ctx.fill();
        } else if (res === RESOURCE.CRYSTAL) {
          ctx.save();
          ctx.fillStyle = "#7ee8ff";
          ctx.translate(px + size * 0.5, py + size * 0.5);
          ctx.rotate(Math.PI / 4);
          const s = Math.max(3, size * (0.22 + amt * 0.1));
          ctx.fillRect(-s / 2, -s / 2, s, s);
          ctx.restore();
        }
        if (game.life[i]) {
          const owner = game.owner && game.owner[i] ? game.owner[i] : 0;
          const town = game.civCells && game.civCells[i];
          const walled =
            game.skillCells &&
            game.skillCells.hardy[i] &&
            town &&
            town.walled;
          let color = lifeHex(owner, town, walled);
          if (game.boatCells && game.boatCells[i] === 2) color = "#a6e0f6";
          else if (game.boatCells && game.boatCells[i]) color = "#7ec8e8";
          else if (game.raftCells && game.raftCells[i] && !town) color = "#7ec8e8";
          const plague = game.factions && game.factions[owner] && (game.factions[owner].plague || 0) > 0;
          if (plague && !(game.boatCells && game.boatCells[i]) && !(game.raftCells && game.raftCells[i] && !town)) {
            color = "#c5d45e";
          }
          if (game.skillCells && game.skillCells.cache[i]) color = "#f3e56a";
          ctx.fillStyle = color;
          const pad = size > 6 ? 1 : 0;
          ctx.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2);
          if (town && size >= 3) {
            ctx.fillStyle = "rgba(24, 16, 10, 0.78)";
            ctx.fillRect(px, py, size, 1);
            ctx.fillRect(px, py + size - 1, size, 1);
            ctx.fillRect(px, py, 1, size);
            ctx.fillRect(px + size - 1, py, 1, size);
          } else if (size >= 4) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
            ctx.fillRect(px + pad, py + pad, Math.max(1, size - pad * 2 - 1), 1);
          }
        }
        if (game.skillCells && game.skillCells.cache && game.skillCells.cache[i]) {
          const pulse = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin((game.generation || 0) * 0.4));
          ctx.fillStyle = "rgba(255, 196, 90, " + pulse + ")";
          ctx.fillRect(px, py, size, size);
        } else if (ruinMap[i] && !game.life[i]) {
          const pulse = 0.12 + 0.08 * (0.5 + 0.5 * Math.sin((game.generation || 0) * 0.28 + 1));
          ctx.fillStyle = "rgba(232, 168, 96, " + pulse + ")";
          ctx.fillRect(px, py, size, size);
        }
        if (game.stormPath && game.stormPath[i] && game.stormTint) {
          if (size < 6) {
            ctx.fillStyle = "rgba(120, 150, 180, " + Math.min(0.34, game.stormTint / 42) + ")";
            ctx.fillRect(px, py, size, size);
          } else {
            ctx.strokeStyle = "rgba(220, 236, 250, " + Math.min(0.62, game.stormTint / 24) + ")";
            ctx.beginPath();
            const sdx = game.stormDir && game.stormDir.dx < 0 ? -1 : 1;
            const sdy = game.stormDir && game.stormDir.dy < 0 ? -1 : 1;
            ctx.moveTo(px + (gen + x) % 3, py);
            ctx.lineTo(px + size - 1 + sdx, py + size - 1 + sdy);
            ctx.stroke();
            if ((x + y + gen) % 2 === 0) {
              ctx.beginPath();
              ctx.moveTo(px + 1, py + Math.floor(size * 0.3));
              ctx.lineTo(px + Math.floor(size * 0.55), py + size);
              ctx.stroke();
            }
          }
        }
      }
    }

    game.flashes.forEach(function (f) {
      const a = 1 - f.age / 14;
      ctx.globalAlpha = a;
      ctx.fillStyle = f.ruin ? "#e0a070" : f.crystal ? "#bdf6ff" : "#ffe18a";
      ctx.beginPath();
      ctx.arc(
        L.ox + (f.x + 0.5) * size,
        L.oy + (f.y + 0.5) * size,
        size * (0.3 + f.age * 0.08),
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = SEASON_TINT[engine.currentSeason(game).id];
    ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    if (game.yearKind === "wet") {
      ctx.fillStyle = "rgba(40, 90, 150, 0.04)";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    } else if (game.yearKind === "dry") {
      ctx.fillStyle = "rgba(160, 110, 40, 0.045)";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    }
    if (game.extremeTint) {
      ctx.fillStyle = "rgba(120, 30, 20, " + Math.min(0.35, game.extremeTint / 40) + ")";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    }
    if (game.quakeTint) {
      ctx.fillStyle = "rgba(90, 70, 30, " + Math.min(0.32, game.quakeTint / 40) + ")";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    }
    if (game.pestTint) {
      ctx.fillStyle = "rgba(70, 110, 50, " + Math.min(0.22, game.pestTint / 50) + ")";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    }
    if (game.stormTint) {
      ctx.fillStyle = "rgba(48, 72, 102, " + Math.min(0.18, game.stormTint / 70) + ")";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    }
    if (game.glacialLeft) {
      ctx.fillStyle = "rgba(200, 220, 235, " + Math.min(0.16, 0.05 + game.glacialLeft / 900) + ")";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    }
    if (game.climateKind === "hot") {
      ctx.fillStyle = "rgba(180, 90, 30, 0.08)";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    } else if (game.climateKind === "cold") {
      ctx.fillStyle = "rgba(160, 190, 220, 0.1)";
      ctx.fillRect(L.ox, L.oy, size * game.cols, size * game.rows);
    }
    if (game.quakeRing && game.quakeRing.tint > 0) {
      const qx = L.ox + game.quakeRing.x * size;
      const qy = L.oy + game.quakeRing.y * size;
      const qr = (game.quakeRing.r || 8) * size;
      ctx.strokeStyle = "rgba(88, 62, 28, " + Math.min(0.55, game.quakeRing.tint / 16) + ")";
      ctx.lineWidth = Math.max(1, size * 0.15);
      ctx.beginPath();
      ctx.arc(qx + size * 0.5, qy + size * 0.5, qr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    if (stampCells && hover.x >= 0) {
      const ok = engine.canStamp(game, stampCells, hover.x, hover.y) && game.energy >= stampCells.length;
      ctx.fillStyle = ok ? "rgba(182,224,90,0.45)" : "rgba(200,70,50,0.45)";
      stampCells.forEach(function (p) {
        const x = world.wrap(hover.x + p[0], game.cols);
        const y = hover.y + p[1];
        if (y < 0 || y >= game.rows) return;
        ctx.fillRect(L.ox + x * size, L.oy + y * size, size, size);
      });
    } else if (hover.x >= 0 && hover.y >= 0) {
      ctx.strokeStyle = "rgba(231,238,223,0.55)";
      ctx.strokeRect(L.ox + hover.x * size + 0.5, L.oy + hover.y * size + 0.5, size - 1, size - 1);
    }
  }

  let lastSkillToast = "";

  function isVisible() {
    return typeof document === "undefined" || !document.hidden;
  }

  function doStep(opts) {
    if (!game) return;
    const result = engine.step(game);
    if (window.LifeDebug) {
      window.LifeDebug.steps = (window.LifeDebug.steps || 0) + 1;
      window.LifeDebug.gen = game.generation;
      window.LifeDebug.hidden = !isVisible();
    }
    scanDiscoveries();
    hud();
    if (!opts || opts.draw !== false) draw();
    if (result.extinct) {
      playing = false;
      btnPlay.textContent = "播放";
      btnPlay.classList.remove("playing");
      openChronicle("文明紀事");
      setStatus("場上文明已全部消失。可從大事紀回顧本局。");
      return;
    }
    if (result.seasonChanged) {
      const ice = (result.events || []).indexOf("沿冰過河") >= 0;
      showToast("進入" + result.seasonChanged.name + (ice ? " · 沿冰過河" : ""));
    } else if (result.events && result.events.length) {
      showToast(result.events[0]);
    } else if (result.skills) {
      let note = "";
      if (result.skills.climb) note = "登高：往高處撤";
      else if (result.skills.migrate) note = "短蛇自己挪開洪水";
      else if (result.skills.sprout) note = "拐角正在發芽";
      else if (result.skills.cache) note = "方塊正在窖藏";
      else if (result.skills.hardy) note = "長廊正在抗旱";
      if (note && note !== lastSkillToast) {
        lastSkillToast = note;
        showToast(note);
      }
      if (!note) lastSkillToast = "";
    }
  }

  function paintAt(cell, eraseMode) {
    if (!game || !cell) return;
    if (eraseMode) {
      engine.erase(game, cell.x, cell.y);
    } else if (stampCells) {
      if (engine.stamp(game, stampCells, cell.x, cell.y)) {
        unlock(selectedStamp);
        setStatus("蓋下「" + selectedStamp.name + "」，消耗 " + selectedStamp.cost + " 能量。");
      } else if (game.energy < selectedStamp.cost) {
        setStatus("能量不足，無法蓋章。");
      } else {
        setStatus("圖章壓到岩石或水面，整份取消。");
      }
    } else if (!engine.plant(game, cell.x, cell.y)) {
      if (game.energy < 1) setStatus("能量不足。");
    }
    hud();
    draw();
  }

  function renderStamps() {
    stampList.innerHTML = "";
    patterns.forEach(function (pattern) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "stamp-btn" + (selectedStamp && selectedStamp.id === pattern.id ? " active" : "");
      btn.innerHTML = pattern.name + "<small>" + pattern.desc + " · " + pattern.cost + " 能量</small>";
      btn.addEventListener("click", function () {
        if (selectedStamp && selectedStamp.id === pattern.id) {
          selectedStamp = null;
          stampCells = null;
        } else {
          selectedStamp = pattern;
          stampCells = pattern.cells.slice();
        }
        renderStamps();
        draw();
      });
      stampList.appendChild(btn);
    });
  }

  function renderGallery() {
    galleryList.innerHTML = "";
    patterns.forEach(function (pattern) {
      const item = document.createElement("div");
      const known = found.has(pattern.id);
      item.className = "gallery-item" + (known ? " found" : "");
      item.innerHTML = (known ? pattern.name : "？？？") + "<small>" + (known ? pattern.desc : "尚未目擊") + "</small>";
      galleryList.appendChild(item);
    });
  }

  canvas.addEventListener("auxclick", function (ev) {
    if (ev.button === 1) ev.preventDefault();
  });

  canvas.addEventListener("contextmenu", function (ev) {
    ev.preventDefault();
  });

  canvas.addEventListener("pointerdown", function (ev) {
    canvas.focus();
    if (canvas.setPointerCapture) canvas.setPointerCapture(ev.pointerId);
    if (ev.button === 1) {
      panning = true;
      panLast = { x: ev.clientX, y: ev.clientY };
      canvas.style.cursor = "grabbing";
      ev.preventDefault();
      return;
    }
    const cell = cellAtEvent(ev);
    erasing = ev.button === 2 || ev.buttons === 2;
    painting = !erasing && !stampCells;
    if (stampCells && !erasing) {
      paintAt(cell, false);
    } else {
      paintAt(cell, erasing);
    }
  });

  canvas.addEventListener("pointermove", function (ev) {
    if (panning && panLast) {
      const L = layout();
      if (viewZoom > 1.02 && L.size) {
        camX -= (ev.clientX - panLast.x) / L.size;
        camY -= (ev.clientY - panLast.y) / L.size;
        clampCam();
      }
      panLast = { x: ev.clientX, y: ev.clientY };
      draw();
      return;
    }
    const cell = cellAtEvent(ev);
    hover = cell || { x: -1, y: -1 };
    if (painting || erasing) paintAt(cell, erasing);
    else draw();
  });

  canvas.addEventListener("pointerup", function () {
    painting = false;
    erasing = false;
    panning = false;
    canvas.style.cursor = "crosshair";
  });

  canvas.addEventListener("pointerleave", function () {
    hover = { x: -1, y: -1 };
    painting = false;
    erasing = false;
    panning = false;
    canvas.style.cursor = "crosshair";
    draw();
  });

  canvas.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    const before = cellAtEvent(ev);
    if (ev.deltaY < 0) viewZoom = Math.min(4, viewZoom * 1.18);
    else viewZoom = Math.max(1, viewZoom / 1.18);
    if (viewZoom <= 1.02) {
      viewZoom = 1;
      camX = game.cols / 2;
      camY = game.rows / 2;
    } else if (before) {
      camX = before.x + 0.5;
      camY = before.y + 0.5;
    }
    clampCam();
    draw();
  }, { passive: false });

  btnPlay.addEventListener("click", function () {
    if (!game) return;
    playing = !playing;
    btnPlay.textContent = playing ? "暫停" : "播放";
    btnPlay.classList.toggle("playing", playing);
    if (playing) closeChronicle();
  });

  btnStep.addEventListener("click", doStep);

  btnScatter.addEventListener("click", function () {
    if (!game) return;
    const n = engine.scatter(game, 20);
    setStatus(n ? "散出 " + n + " 個細胞。" : "沒有能量可散種。");
    hud();
    draw();
  });

  btnClear.addEventListener("click", function () {
    if (!game) return;
    playing = false;
    btnPlay.textContent = "播放";
    btnPlay.classList.remove("playing");
    engine.clearLife(game);
    closeChronicle();
    hud();
    draw();
    setStatus("生命已清空，地形保留。");
  });

  btnNew.addEventListener("click", function () {
    if (!game) return;
    playing = false;
    btnPlay.textContent = "播放";
    btnPlay.classList.remove("playing");
    engine.newMap(game);
    viewZoom = 1;
    camX = game.cols / 2;
    camY = game.rows / 2;
    closeChronicle();
    hud();
    draw();
    setStatus(game.worldNote ? game.worldNote + "。滾輪放大，中鍵拖曳平移。" : "新地圖已生成。");
  });

  if (btnSize) {
    btnSize.addEventListener("click", function () {
      openSizePicker(true);
    });
  }
  const sizeCancel = document.getElementById("size-cancel");
  if (sizeCancel) {
    sizeCancel.addEventListener("click", function () {
      const overlay = document.getElementById("size-overlay");
      if (overlay && game) overlay.classList.add("hidden");
    });
  }

  window.addEventListener("keydown", function (ev) {
    if (ev.code === "Space") {
      ev.preventDefault();
      btnPlay.click();
    } else if (ev.key === "n" || ev.key === "N") {
      doStep();
    } else if (ev.key === "r" || ev.key === "R") {
      if (!stampCells) return;
      stampCells = window.LifePatterns.rotate90(stampCells);
      draw();
    } else if (ev.key === "Escape") {
      if (chronicleEl && !chronicleEl.classList.contains("hidden")) {
        closeChronicle();
        return;
      }
      selectedStamp = null;
      stampCells = null;
      renderStamps();
      draw();
    }
  });

  window.addEventListener("resize", resize);

  if (btnChronicle) {
    btnChronicle.addEventListener("click", function () {
      playing = false;
      btnPlay.textContent = "播放";
      btnPlay.classList.remove("playing");
      openChronicle("大事紀");
    });
  }
  if (btnChronicleClose) btnChronicleClose.addEventListener("click", closeChronicle);
  if (chronicleEl) {
    chronicleEl.addEventListener("click", function (ev) {
      if (ev.target === chronicleEl) closeChronicle();
    });
  }

  function simTick() {
    if (!game) return;
    engine.tickFlashes(game);
    const visible = isVisible();
    if (playing) {
      const now =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now();
      if (now - lastStep >= speedDelay()) {
        lastStep = now;
        doStep({ draw: visible });
        return;
      }
    }
    if (visible && game.flashes.length) draw();
  }

  window.LifeDebug = {
    steps: 0,
    gen: 0,
    hidden: false,
    playing: function () {
      return playing;
    },
    startWithSize: startWithSize,
  };

  setInterval(simTick, 16);

  renderStamps();
  renderGallery();
  if (window.GAME_VERSION) {
    const verEl = document.getElementById("game-version");
    if (verEl) verEl.textContent = "v" + window.GAME_VERSION;
    document.title = "生存遊戲 v" + window.GAME_VERSION + " · Mazectric";
  }
  setStatus("請先選擇地圖大小。");
  openSizePicker(false);
})();

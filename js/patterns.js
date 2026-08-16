(function (global) {
  function parseAscii(art) {
    const cells = [];
    const lines = art.replace(/^\n+|\n+$/g, "").split("\n");
    lines.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        const ch = line[x];
        if (ch === "O" || ch === "#" || ch === "*") cells.push([x, y]);
      }
    });
    return cells;
  }

  function transform(cells, fn) {
    const mapped = cells.map(([x, y]) => fn(x, y));
    const minX = Math.min.apply(null, mapped.map((p) => p[0]));
    const minY = Math.min.apply(null, mapped.map((p) => p[1]));
    return mapped
      .map(([x, y]) => [x - minX, y - minY])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }

  function rotate90(cells) {
    return transform(cells, (x, y) => [-y, x]);
  }

  function flipX(cells) {
    return transform(cells, (x, y) => [-x, y]);
  }

  function variantsOf(cells) {
    const seen = {};
    const out = [];
    let current = transform(cells, (x, y) => [x, y]);
    for (let r = 0; r < 4; r++) {
      [current, flipX(current)].forEach((v) => {
        const key = v.map((p) => p.join(",")).join(";");
        if (!seen[key]) {
          seen[key] = true;
          out.push(v);
        }
      });
      current = rotate90(current);
    }
    return out;
  }

  function bbox(cells) {
    return {
      w: 1 + Math.max.apply(null, cells.map((p) => p[0])),
      h: 1 + Math.max.apply(null, cells.map((p) => p[1])),
    };
  }

  const CATALOG = [
    {
      id: "dimer",
      name: "雙格",
      desc: "最小可存活單位",
      art: "##",
    },
    {
      id: "line3",
      name: "短線",
      desc: "三格靜止線段",
      art: "###",
    },
    {
      id: "block",
      name: "方塊",
      desc: "穩定的 2×2 · 場上有它會窖藏",
      art: "##\n##",
    },
    {
      id: "corner",
      name: "拐角",
      desc: "容易往走廊長 · 場上有它會發芽",
      art: "##\n#",
    },
    {
      id: "snake",
      name: "短蛇",
      desc: "走廊種子 · 洪水時會自己挪開",
      art: "##\n #\n  ##",
    },
    {
      id: "hall",
      name: "長廊",
      desc: "較長的存活巷道 · 場上有它會耐旱",
      art: "#####",
    },
    {
      id: "glider-relic",
      name: "滑翔機遺物",
      desc: "康威遺物，在此規則下會變形",
      art: " #\n  #\n###",
      discover: false,
    },
  ];

  const PATTERNS = CATALOG.map((item) => {
    const stampCells = parseAscii(item.art.replace(/\./g, " "));
    const phases = item.phases || [item.art];
    const seen = {};
    const variants = [];
    phases.forEach((art) => {
      variantsOf(parseAscii(art.replace(/\./g, " "))).forEach((v) => {
        const key = v.map((p) => p.join(",")).join(";");
        if (!seen[key]) {
          seen[key] = true;
          variants.push(v);
        }
      });
    });
    return {
      id: item.id,
      name: item.name,
      desc: item.desc,
      cost: stampCells.length,
      cells: transform(stampCells, (x, y) => [x, y]),
      variants: variants,
      size: bbox(stampCells),
      discover: item.discover !== false,
    };
  });

  global.LifePatterns = {
    parseAscii: parseAscii,
    rotate90: rotate90,
    PATTERNS: PATTERNS,
  };
})(window);

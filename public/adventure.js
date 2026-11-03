// Dip Duck — Les Plumes du Calme : jeu d'aventure original vu de dessus, style rétro « Game Boy Color ».
// Données (cartes du monde, textes) dans adventure-data.js. Sauvegarde dans le navigateur
// (localStorage) : rien sur la blockchain, aucun prix, les cartes de collection n'ont aucune valeur.
(() => {
  "use strict";

  const DATA = window.DIPDUCK_ADVENTURE_DATA;
  const TILE = 16, COLS = 16, ROWS = 11, HUD = 16;
  const W = COLS * TILE, PH = ROWS * TILE, H = PH + HUD;
  const SCALE = 3;
  const SAVE_KEY = "dipduck-adventure-v2";

  // ─── Rendu rétro ───
  // On dessine en basse définition sur deux calques (décor, puis personnages), on ramène chaque
  // pixel à une palette de 16 couleurs, on entoure les personnages d'un contour foncé d'1 pixel,
  // puis on agrandit ×3 sans lissage. Les textes sont écrits par-dessus en police pixel.
  const canvas = document.getElementById("adv-canvas");
  const display = canvas.getContext("2d");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  function makeLayer() { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; }
  const bgLayer = makeLayer(), spLayer = makeLayer();
  const bgCtx = bgLayer.getContext("2d", { willReadFrequently: true });
  const spCtx = spLayer.getContext("2d", { willReadFrequently: true });
  let ctx = bgCtx;

  const PALETTE = [
    "#10101c", "#2b2b45", "#5a5a7a", "#a0a0b8", "#f4f4e8",
    "#2f6b26", "#5aa83c", "#a8d86a",
    "#1e5aa8", "#4aa3df",
    "#7a4a24", "#c08040", "#f0d890",
    "#ffd23f", "#ff8c1a", "#d83a3a",
  ];
  const PAL_RGB = PALETTE.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const INK = PAL_RGB[0];
  const UI = { ink: "#10101c", paper: "#f4f4e8", dim: "#a0a0b8", accent: "#ffd23f", night: "#2b2b45" };
  const FONT = '"Press Start 2P", monospace';
  if (document.fonts) document.fonts.load(`24px ${FONT}`).catch(() => {});

  const logo = new Image();
  logo.src = "logo.png";

  const savedLang = (() => { try { return localStorage.getItem("lang"); } catch { return null; } })();
  const LANG = (savedLang || navigator.language || "en").slice(0, 2).toLowerCase() === "fr" ? "fr" : "en";
  const T = DATA.TEXT[LANG];

  // ─── Construction des écrans ───
  function buildScreen(rows, open, border) {
    if (rows.length !== 9 || rows.some((r) => r.length !== 14)) throw new Error("Carte invalide : " + rows.join("|"));
    const ground = border === "#" ? "_" : ".";
    const gapTile = (ch) => (ch === "W" ? "W" : ground);
    const map = [];
    for (let y = 0; y < ROWS; y++) {
      let line = "";
      for (let x = 0; x < COLS; x++) {
        const edge = y === 0 || y === ROWS - 1 || x === 0 || x === COLS - 1;
        if (!edge) { line += rows[y - 1][x - 1]; continue; }
        const gapX = x === 7 || x === 8, gapY = y >= 4 && y <= 6;
        if (y === 0 && gapX && open.includes("n")) line += gapTile(rows[0][x - 1]);
        else if (y === ROWS - 1 && gapX && open.includes("s")) line += gapTile(rows[8][x - 1]);
        else if (x === 0 && gapY && open.includes("w")) line += gapTile(rows[y - 1][0]);
        else if (x === COLS - 1 && gapY && open.includes("e")) line += gapTile(rows[y - 1][13]);
        else line += border;
      }
      map.push(line);
    }
    return map;
  }
  const SCREENS = DATA.SCREENS;
  for (const spec of Object.values(SCREENS)) spec.map = buildScreen(spec.rows, spec.open, spec.border);
  const areaOf = (key) => key.split(":")[0];
  const groundOf = (key) => (SCREENS[key].border === "#" ? "_" : ".");

  // ─── Sauvegarde ───
  function freshFlags() {
    return {
      started: false, talked: false, key: false, power: false, flippers: false,
      f1: false, f2: false, f3: false, bought: false, mamaDone: false,
      coins: 0, maxHp: 6, time: 0, deaths: 0, pieces: 0,
      opened: {}, solved: {}, broken: {}, doors: {}, blockPos: {}, ducklings: {}, cards: {},
      keys: { d1: 0, d2: 0, d3: 0 }, sw: { d1: 0, d2: 0, d3: 0 },
      cp: ["o:1,2", 7 * TILE + 2, 7 * TILE + 2],
    };
  }
  let flags = freshFlags();
  let hasSave = false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { flags = { ...freshFlags(), ...JSON.parse(raw) }; hasSave = flags.started; }
  } catch { /* sauvegarde illisible : nouvelle partie */ }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(flags)); } catch { /* navigation privée */ } }
  const featherCount = () => (flags.f1 ? 1 : 0) + (flags.f2 ? 1 : 0) + (flags.f3 ? 1 : 0);
  const cardCount = () => DATA.CARD_IDS.filter((id) => flags.cards[id]).length;
  const ducklingCount = () => Object.keys(flags.ducklings).length;
  function chapter() {
    if (!flags.talked) return 0;
    if (!flags.key) return 1;
    if (!flags.f1) return 2;
    if (!flags.f2) return 3;
    if (!flags.f3) return 4;
    return 5;
  }
  function fmtTime(sec) { const t = Math.floor(sec); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; }
  function fmt(s, vars) { return s.replace(/\{(\w)\}/g, (_, k) => vars[k]); }

  // ─── Sons ───
  let audio = null;
  function unlockAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      else if (audio.state === "suspended") audio.resume();
    } catch { audio = null; }
  }
  function tone(f1, f2, dur, type = "square", vol = 0.05, delay = 0) {
    if (!audio) return;
    const t0 = audio.currentTime + delay;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t0);
    o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(audio.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const sfx = {
    quack: () => { tone(620, 300, 0.09, "sawtooth", 0.04); tone(560, 280, 0.08, "sawtooth", 0.03, 0.09); },
    mega: () => { tone(400, 120, 0.2, "sawtooth", 0.06); },
    hit: () => tone(320, 110, 0.1, "square", 0.05),
    hurt: () => tone(220, 60, 0.25, "square", 0.06),
    coin: () => { tone(988, 988, 0.05, "square", 0.03); tone(1319, 1319, 0.12, "square", 0.03, 0.05); },
    heart: () => tone(660, 990, 0.15, "triangle", 0.06),
    chest: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.12, "triangle", 0.07, i * 0.1)); },
    solve: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.1, "square", 0.04, i * 0.08)); },
    wrong: () => tone(180, 90, 0.3, "square", 0.05),
    push: () => tone(90, 70, 0.12, "triangle", 0.07),
    torch: () => tone(300, 900, 0.15, "triangle", 0.05),
    crystal: () => { tone(1200, 600, 0.12, "triangle", 0.05); tone(900, 1500, 0.1, "triangle", 0.04, 0.06); },
    rock: () => tone(120, 40, 0.3, "sawtooth", 0.07),
    boss: () => tone(110, 45, 0.5, "sawtooth", 0.07),
    door: () => tone(200, 400, 0.3, "triangle", 0.07),
    splash: () => tone(500, 150, 0.15, "triangle", 0.04),
  };

  // ─── Commandes ───
  const keys = { up: false, down: false, left: false, right: false };
  let actionQueued = false, menuQueued = false;
  const KEYMAP = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right" };
  const ACTION_KEYS = ["Space", "Enter", "KeyJ", "KeyZ", "KeyE"];
  const MENU_KEYS = ["KeyM", "Escape", "Tab"];
  addEventListener("keydown", (e) => {
    unlockAudio();
    if (state === "menu" && !e.repeat && ["ArrowLeft", "ArrowRight", "KeyA", "KeyD"].includes(e.code)) { menuPage ^= 1; e.preventDefault(); return; }
    if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (ACTION_KEYS.includes(e.code)) { if (!e.repeat) actionQueued = true; e.preventDefault(); }
    if (MENU_KEYS.includes(e.code)) { if (!e.repeat) menuQueued = true; e.preventDefault(); }
    if (e.code === "KeyN" && state === "title") { flags = freshFlags(); hasSave = false; save(); }
  });
  addEventListener("keyup", (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false; });
  addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener("pointerdown", () => {
    unlockAudio();
    if (state === "menu") menuPage ^= 1; else actionQueued = true;
  });
  for (const button of document.querySelectorAll("[data-dir]")) {
    const dir = button.dataset.dir;
    const on = (e) => { e.preventDefault(); unlockAudio(); keys[dir] = true; };
    const off = (e) => { e.preventDefault(); keys[dir] = false; };
    button.addEventListener("pointerdown", on);
    button.addEventListener("pointerup", off);
    button.addEventListener("pointercancel", off);
    button.addEventListener("pointerleave", off);
  }
  const actButton = document.getElementById("act");
  if (actButton) actButton.addEventListener("pointerdown", (e) => { e.preventDefault(); unlockAudio(); actionQueued = true; });
  const menuButton = document.getElementById("menu");
  if (menuButton) menuButton.addEventListener("pointerdown", (e) => { e.preventDefault(); unlockAudio(); menuQueued = true; });
  function consumeAction() { if (actionQueued) { actionQueued = false; return true; } return false; }
  function consumeMenu() { if (menuQueued) { menuQueued = false; return true; } return false; }

  // ─── État ───
  let state = "intro"; // intro | title | play | menu | end
  // Verrou d'ouverture : pas de partie avant le lancement (simple affichage, le jeu n'a aucun prix).
  const OPENS_AT = Date.parse(DATA.OPENS_AT || "");
  let unlocked = false;
  const isLocked = () => !unlocked && !Number.isNaN(OPENS_AT) && Date.now() < OPENS_AT;
  let introT = 0, titleIdle = 0;
  const INTRO_SCENE = 4 * 60, INTRO_LEN = 4 * INTRO_SCENE;
  let menuPage = 0;
  let frame = 0, endAt = 0;
  let cur = "o:1,2";
  let tiles = [];
  let enemies = [], chests = [], pickups = [], shots = [], parts = [], npcs = [], blocks = [];
  let torchLit = [];
  let dialog = null;
  let bumpCd = 0, swCd = 0, shake = 0, lastWaterMsg = -9999, lastCrackMsg = -9999;
  let push = { block: null, dir: null, t: 0 };
  let lastBlock = null;
  let hadEnemies = false;
  const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const player = { x: 0, y: 0, w: 12, h: 12, dir: "down", hp: 6, atk: 0, inv: 0, kx: 0, ky: 0, kt: 0, walk: 0, swim: false };

  const tilePos = (tx, ty) => [tx * TILE + 2, ty * TILE + 2];
  function say(lines, done) {
    const list = (Array.isArray(lines) ? lines : [lines]).filter(Boolean);
    if (!list.length) { if (done) done(); return; }
    dialog = { lines: list, i: 0, done };
  }
  function cardLine(id) {
    if (flags.cards[id]) return null;
    flags.cards[id] = true;
    save();
    return fmt(T.newCard, { n: T.cards[id] });
  }

  const ENEMY_TYPES = {
    crab: { w: 12, h: 10, hp: 2, dmg: 1 },
    cub: { w: 12, h: 12, hp: 3, dmg: 2 },
    bat: { w: 10, h: 8, hp: 1, dmg: 1, fly: true },
    sentinel: { w: 14, h: 14, hp: 4, dmg: 2 },
    crabking: { w: 28, h: 20, hp: 12, dmg: 2, boss: true },
    pelican: { w: 24, h: 24, hp: 16, dmg: 2, boss: true },
    bearking: { w: 26, h: 26, hp: 22, dmg: 2, boss: true },
  };
  const BOSS = {
    crabking: { speed: 0.7, angry: 1.0, charge: 3.0, shotEvery: 0, shots: 0, angryShots: 0, summon: "crab" },
    pelican: { speed: 0.6, angry: 0.85, charge: 3.4, shotEvery: 80, shots: 3, angryShots: 5, summon: null },
    bearking: { speed: 0.45, angry: 0.65, charge: 2.8, shotEvery: 90, shots: 1, angryShots: 3, summon: "cub" },
  };
  function makeEnemy(t, tx, ty) {
    const d = ENEMY_TYPES[t];
    return { t, x: tx * TILE + (TILE - d.w) / 2, y: ty * TILE + (TILE - d.h) / 2, w: d.w, h: d.h, hp: d.hp, dmg: d.dmg,
      boss: !!d.boss, fly: !!d.fly, dir: [1, 0], timer: 0, inv: 0, kx: 0, ky: 0, kt: 0, state: "walk", st: 0, vx: 0, vy: 0,
      phase: Math.random() * 6, summoned: false };
  }

  function refreshChests() {
    const spec = SCREENS[cur];
    chests = (spec.chests || []).filter((c) => !c.reward || flags.solved[cur]).map((c) => ({ ...c, open: !!flags.opened[c.id] }));
  }

  function enter(key, pos) {
    cur = key;
    const spec = SCREENS[key];
    const ground = groundOf(key);
    tiles = spec.map.map((r) => r.split(""));
    const blockStart = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = tiles[y][x];
      if (ch === "K" && flags.broken[`${key}:${x},${y}`]) tiles[y][x] = ground;
      if (ch === "L" && flags.doors[key]) tiles[y][x] = ground;
      if (ch === "e" && flags.solved[key]) tiles[y][x] = "E";
      if (ch === "O") { tiles[y][x] = ground; blockStart.push([x, y]); }
    }
    const saved = flags.solved[key] && flags.blockPos[key];
    blocks = (saved || blockStart).map(([x, y]) => ({ tx: x, ty: y, x: x * TILE, y: y * TILE, mv: 0, dx: 0, dy: 0 }));
    torchLit = [];
    enemies = [];
    if (!(spec.puzzle === "clear" && flags.solved[key])) {
      for (const [t, x, y] of spec.enemies || []) enemies.push(makeEnemy(t, x, y));
      if (spec.boss) enemies.push(makeEnemy(spec.boss, 7, 3));
    }
    hadEnemies = enemies.length > 0;
    npcs = (spec.npcs || []).filter(([t, , , id]) => !(t === "duckling" && flags.ducklings[id])).map(([t, x, y, id]) => ({ t, x, y, id }));
    pickups = []; shots = []; parts = [];
    push = { block: null, dir: null, t: 0 };
    refreshChests();
    [player.x, player.y] = pos;
    player.kt = 0;
    if (spec.checkpoint) flags.cp = [key, player.x, player.y];
    flags.last = [key, player.x, player.y];
    save();
    if (spec.boss && !flags.solved[key]) { sfx.boss(); say(T.bossIntro[spec.boss]); }
  }

  function startGame() {
    state = "play";
    player.hp = flags.maxHp;
    player.dir = "down";
    if (!flags.started) {
      flags.started = true;
      enter("o:1,2", tilePos(7, 7));
      say(T.intro[T.intro.length - 1]);
    } else {
      const [k, x, y] = flags.last && SCREENS[flags.last[0]] ? flags.last : flags.cp;
      enter(k, [x, y]);
    }
  }

  // Retient l'endroit exact où l'on joue : toutes les 5 secondes et quand on quitte la page.
  function rememberSpot() {
    if (state !== "play" && state !== "menu") return;
    if (player.hp <= 0) return;
    flags.last = [cur, player.x, player.y];
    save();
  }
  addEventListener("pagehide", rememberSpot);
  document.addEventListener("visibilitychange", () => { if (document.hidden) rememberSpot(); });

  // ─── Collisions ───
  function tileAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return null;
    return tiles[ty][tx];
  }
  const sw = () => flags.sw[areaOf(cur)] || 0;
  function solidTile(ch, who) {
    switch (ch) {
      case "W": return who === "shot" ? false : !(who === "player" && flags.flippers);
      case "G": return !flags.solved[cur];
      case "u": return sw() === 0;
      case "v": return sw() === 1;
      case "_": case ".": case ",": case "S": case "P": case "E": case "e": return false;
      default: return "TRHD#xnBCMKLQl".includes(ch);
    }
  }
  function blockAtPoint(px, py) {
    for (const b of blocks) if (px >= b.x && px < b.x + TILE && py >= b.y && py < b.y + TILE) return b;
    return null;
  }
  // Case qui bloque (ou null). Hors de l'écran : libre pour le canard (changement d'écran).
  function blockedAt(x, y, w, h, who, ignore) {
    const xs = [x, x + w - 0.01], ys = [y, y + h - 0.01];
    for (let sx = x + 8; sx < x + w - 0.01; sx += 8) xs.push(sx);
    for (let sy = y + 8; sy < y + h - 0.01; sy += 8) ys.push(sy);
    for (const px of xs) for (const py of ys) {
      const ch = tileAt(px, py);
      if (ch === null) { if (who !== "player") return "#"; continue; }
      if (ignore && ignore.has(`${Math.floor(px / TILE)},${Math.floor(py / TILE)}`)) continue;
      if (solidTile(ch, who)) return ch;
      const b = blockAtPoint(px, py);
      if (b) { lastBlock = b; return "O"; }
    }
    return null;
  }
  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  const center = (e) => [e.x + e.w / 2, e.y + e.h / 2];
  function npcAt(x, y, w, h) {
    return npcs.some((n) => n.t !== "duckling" && overlap({ x, y, w, h }, { x: n.x * TILE + 2, y: n.y * TILE + 2, w: 12, h: 12 }));
  }
  // Barrières levées sous le canard : on ne le coince pas dedans.
  function barrierIgnore(ent) {
    const set = new Set();
    for (let ty = Math.floor(ent.y / TILE); ty <= Math.floor((ent.y + ent.h - 0.01) / TILE); ty++)
      for (let tx = Math.floor(ent.x / TILE); tx <= Math.floor((ent.x + ent.w - 0.01) / TILE); tx++) {
        const ch = tiles[ty] && tiles[ty][tx];
        if (ch === "u" || ch === "v") set.add(`${tx},${ty}`);
      }
    return set;
  }
  function move(ent, dx, dy, who = "enemy") {
    if (!dx && !dy) return null;
    const nx = ent.x + dx, ny = ent.y + dy;
    const ignore = who === "player" ? barrierIgnore(ent) : null;
    let b = blockedAt(nx, ny, ent.w, ent.h, who, ignore);
    if (!b && who === "player" && npcAt(nx, ny, ent.w, ent.h)) b = "N";
    if (!b) { ent.x = nx; ent.y = ny; return null; }
    if (who === "player" && !"CBMGLNO".includes(b)) {
      // Aide aux coins : glisse vers le passage s'il est tout proche.
      for (const off of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8]) {
        if (dx && !blockedAt(nx, ent.y + off, ent.w, ent.h, who, ignore) && !npcAt(nx, ent.y + off, ent.w, ent.h)) { ent.y += Math.sign(off); return null; }
        if (dy && !blockedAt(ent.x + off, ny, ent.w, ent.h, who, ignore) && !npcAt(ent.x + off, ny, ent.w, ent.h)) { ent.x += Math.sign(off); return null; }
      }
    }
    return b;
  }

  // ─── Blocs à pousser ───
  function blockFree(tx, ty) {
    if (tx < 1 || ty < 1 || tx > COLS - 2 || ty > ROWS - 2) return false;
    const ch = tiles[ty][tx];
    if (ch === "u" || ch === "v") { if (solidTile(ch, "block")) return false; }
    else if (!"_.,SPe".includes(ch)) return false;
    if (blocks.some((b) => b.tx === tx && b.ty === ty)) return false;
    return true;
  }
  function tryPush(b, [dx, dy]) {
    if (b.mv > 0 || flags.solved[cur]) return;
    if (!blockFree(b.tx + dx, b.ty + dy)) return;
    b.tx += dx; b.ty += dy; b.dx = dx; b.dy = dy; b.mv = 10;
    sfx.push();
  }
  function updateBlocks() {
    for (const b of blocks) {
      if (b.mv > 0) {
        b.mv--;
        b.x += b.dx * 1.6; b.y += b.dy * 1.6;
        if (b.mv === 0) { b.x = b.tx * TILE; b.y = b.ty * TILE; }
      }
    }
  }

  // ─── Énigmes ───
  function solveRoom() {
    if (flags.solved[cur]) return;
    flags.solved[cur] = true;
    flags.blockPos[cur] = blocks.map((b) => [b.tx, b.ty]);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (tiles[y][x] === "e") tiles[y][x] = "E";
    refreshChests();
    for (const c of chests) burst(c.x * TILE + 8, c.y * TILE + 8, "#f4f4e8", 14);
    sfx.solve();
    save();
    if (SCREENS[cur].name === "forest") say(cardLine("forest"));
  }
  function checkPuzzle() {
    const spec = SCREENS[cur];
    if (flags.solved[cur] || !spec.puzzle) return;
    if (spec.puzzle === "clear" && hadEnemies && enemies.length === 0) solveRoom();
    if (spec.puzzle === "plates") {
      const [pcx, pcy] = center(player);
      let all = true, any = false;
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (tiles[y][x] !== "P") continue;
        any = true;
        const byBlock = blocks.some((b) => b.mv === 0 && b.tx === x && b.ty === y);
        const byDuck = Math.floor(pcx / TILE) === x && Math.floor(pcy / TILE) === y;
        if (!byBlock && !byDuck) all = false;
      }
      if (any && all) solveRoom();
    }
  }
  function hitTorch(tx, ty) {
    const spec = SCREENS[cur];
    if (flags.solved[cur] || spec.puzzle !== "torches") return;
    if (torchLit.some(([x, y]) => x === tx && y === ty)) return;
    const next = spec.order[torchLit.length];
    if (next[0] === tx && next[1] === ty) {
      torchLit.push([tx, ty]);
      sfx.torch();
      if (torchLit.length === spec.order.length) solveRoom();
    } else {
      torchLit = [];
      sfx.wrong();
      shake = 6;
    }
  }

  // ─── Actions ───
  function frontPoint(dist = 10) {
    const [dx, dy] = DIRS[player.dir];
    const [cx, cy] = center(player);
    return [cx + dx * dist, cy + dy * dist];
  }

  function talk(n) {
    if (n.t === "frog") {
      if (!flags.talked) { flags.talked = true; save(); return say([...T.frogFirst, cardLine("frog")]); }
      return say(T.frogHint[chapter()]);
    }
    if (n.t === "beaver") {
      if (flags.bought) return say(T.beaverDone);
      if (flags.coins >= 25) {
        flags.coins -= 25; flags.bought = true; flags.maxHp += 2; player.hp = flags.maxHp; save(); sfx.heart();
        return say([T.beaverSold, cardLine("beaver")]);
      }
      return say([T.beaverAsk, T.beaverPoor]);
    }
    if (n.t === "mama") {
      const count = ducklingCount();
      if (flags.mamaDone) return say(T.mamaAfter);
      if (count >= 3) {
        flags.mamaDone = true; flags.maxHp += 2; player.hp = flags.maxHp; save(); sfx.heart();
        return say([T.mamaDone, T.gotHeartC, cardLine("ducklings")]);
      }
      if (count === 0) return say(T.mamaAsk);
      return say(fmt(T.mamaSome, { n: count }));
    }
  }

  function specialTile(ch) {
    const area = areaOf(cur);
    if (ch === "C") {
      if (!flags.key) return say(T.caveLocked);
      sfx.door();
      const first = !flags.solved["cave-open"];
      flags.solved["cave-open"] = true;
      const [k, x, y] = DATA.ENTRANCES.C;
      enter(k, tilePos(x, y));
      if (first) say(T.caveOpen);
      return;
    }
    if (ch === "M") { sfx.door(); const [k, x, y] = DATA.ENTRANCES.M; return enter(k, tilePos(x, y)); }
    if (ch === "B") {
      if (!flags.f1 || !flags.f2) return say(T.denLocked);
      sfx.door();
      const [k, x, y] = DATA.ENTRANCES.B;
      return enter(k, tilePos(x, y));
    }
    if (ch === "G" && !flags.solved[cur]) return say(T.gate);
    if (ch === "L") {
      if ((flags.keys[area] || 0) > 0) {
        flags.keys[area]--;
        flags.doors[cur] = true;
        const ground = groundOf(cur);
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (tiles[y][x] === "L") tiles[y][x] = ground;
        sfx.door();
        save();
        return say(T.unlocked);
      }
      return say(T.locked);
    }
    if (ch === "W" && !flags.flippers && frame - lastWaterMsg > 600) { lastWaterMsg = frame; return say(T.deepWater); }
    if (ch === "K" && !flags.power && frame - lastCrackMsg > 600) { lastCrackMsg = frame; return say(T.cracked); }
  }

  function interact() {
    const [fx, fy] = frontPoint(10);
    for (const n of npcs) {
      if (n.t === "duckling") continue;
      if (fx >= n.x * TILE - 2 && fx < n.x * TILE + TILE + 2 && fy >= n.y * TILE - 2 && fy < n.y * TILE + TILE + 2) { talk(n); return true; }
    }
    const ch = tileAt(fx, fy);
    if (ch === "n") {
      const textKey = (SCREENS[cur].signs || {})[`${Math.floor(fx / TILE)},${Math.floor(fy / TILE)}`];
      if (textKey) { say(T[textKey]); return true; }
    }
    if (ch && "CBMLG".includes(ch) && solidTile(ch, "player")) { specialTile(ch); return true; }
    return false;
  }

  function attack() {
    if (player.swim) return;
    player.atk = 14;
    if (flags.power) sfx.mega(); else sfx.quack();
    const [fx, fy] = frontPoint(12);
    const box = { x: fx - 9, y: fy - 9, w: 18, h: 18 };
    for (const e of enemies) if (overlap(box, e)) hurtEnemy(e);
    const seen = new Set();
    for (const [px, py] of [[fx, fy], [fx - 6, fy], [fx + 6, fy], [fx, fy - 6], [fx, fy + 6]]) {
      const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
      const k = `${tx},${ty}`;
      if (seen.has(k) || !tiles[ty] || tiles[ty][tx] === undefined) continue;
      seen.add(k);
      const ch = tiles[ty][tx];
      if (ch === "x") {
        tiles[ty][tx] = groundOf(cur);
        burst(tx * TILE + 8, ty * TILE + 8, "#5aa83c", 8);
        const r = Math.random();
        if (r < 0.35) dropAt(tx * TILE + 4, ty * TILE + 4, "coin");
        else if (r < 0.5) dropAt(tx * TILE + 4, ty * TILE + 4, "heart");
      } else if (ch === "K") {
        if (flags.power) {
          tiles[ty][tx] = groundOf(cur);
          flags.broken[`${cur}:${tx},${ty}`] = true;
          save();
          burst(tx * TILE + 8, ty * TILE + 8, "#a0a0b8", 14);
          sfx.rock();
          shake = 6;
        } else if (frame - lastCrackMsg > 600) { lastCrackMsg = frame; say(T.cracked); }
      } else if (ch === "l") {
        hitTorch(tx, ty);
      } else if (ch === "Q" && swCd === 0) {
        const area = areaOf(cur);
        flags.sw[area] = (flags.sw[area] || 0) ^ 1;
        swCd = 20;
        sfx.crystal();
        save();
      }
    }
  }

  function dropAt(x, y, t, v = 1) { pickups.push({ t, x, y, w: 8, h: 8, v, life: 600 }); }
  function burst(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.5 + Math.random() * 1.5;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 20 + Math.random() * 15, color });
    }
  }

  function hurtEnemy(e) {
    if (e.inv > 0) return;
    e.hp--;
    sfx.hit();
    e.inv = e.boss ? 25 : 14;
    const [dx, dy] = DIRS[player.dir];
    if (!e.boss) {
      const k = e.t === "sentinel" ? 1.4 : 2.4;
      e.kx = dx * k; e.ky = dy * k; e.kt = e.t === "sentinel" ? 5 : 8;
    } else if (e.state === "walk") { e.kx = dx * 1.5; e.ky = dy * 1.5; e.kt = 5; }
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    const [cx, cy] = center(e);
    burst(cx, cy, e.t === "crab" || e.t === "crabking" ? "#d83a3a" : "#c08040", e.boss ? 40 : 12);
    enemies = enemies.filter((o) => o !== e);
    if (e.boss) {
      enemies = [];
      shots = [];
      shake = 30;
      sfx.boss();
      say([T.bossDown[e.t], cardLine(e.t)]);
      return;
    }
    const r = Math.random();
    if (r < 0.6) dropAt(cx - 4, cy - 4, "coin", e.t === "crab" || e.t === "bat" ? 1 : 2);
    else if (r < 0.8) dropAt(cx - 4, cy - 4, "heart");
  }

  function hurtPlayer(dmg, src) {
    if (player.inv > 0 || dialog) return;
    player.hp -= dmg;
    player.inv = 60;
    sfx.hurt();
    shake = 8;
    const [px, py] = center(player), [sx, sy] = center(src);
    const len = Math.hypot(px - sx, py - sy) || 1;
    player.kx = ((px - sx) / len) * 2.2;
    player.ky = ((py - sy) / len) * 2.2;
    player.kt = 10;
    if (player.hp <= 0) {
      player.hp = 0;
      flags.deaths++;
      save();
      say(T.dead, () => {
        player.hp = flags.maxHp;
        player.inv = 0;
        enter(flags.cp[0], [flags.cp[1], flags.cp[2]]);
      });
    }
  }

  function openChest(c) {
    c.open = true;
    flags.opened[c.id] = true;
    sfx.chest();
    burst(c.x * TILE + 8, c.y * TILE + 8, "#ffd23f", 16);
    const area = areaOf(cur);
    let lines = [];
    switch (c.item) {
      case "key": flags.key = true; lines = [T.gotKey, cardLine("key")]; break;
      case "smallkey": flags.keys[area] = (flags.keys[area] || 0) + 1; lines = [T.gotSmallKey]; break;
      case "power": flags.power = true; lines = [T.gotPower, cardLine("power")]; break;
      case "flippers": flags.flippers = true; lines = [T.gotFlippers, cardLine("flippers")]; break;
      case "coins": flags.coins += 30; lines = [T.gotCoins]; break;
      case "piece":
        flags.pieces++;
        if (flags.pieces % 4 === 0) { flags.maxHp += 2; player.hp = flags.maxHp; lines = [T.gotPiece4, cardLine("pieces")]; }
        else lines = [fmt(T.gotPiece, { n: flags.pieces % 4 })];
        break;
      case "f1": case "f2":
        flags[c.item] = true; flags.maxHp += 2; player.hp = flags.maxHp;
        lines = [fmt(T.gotFeather, { n: featherCount() }), T.gotHeartC];
        break;
      case "f3": {
        flags.f3 = true;
        const calm = flags.deaths === 0 ? cardLine("calm") : null;
        save();
        return say([fmt(T.gotFeather, { n: 3 }), ...T.ending, calm], () => { state = "end"; endAt = frame; save(); });
      }
    }
    save();
    say(lines);
  }

  // ─── Mise à jour (60 fois par seconde) ───
  function update() {
    frame++;
    if (shake > 0) shake--;
    if (swCd > 0) swCd--;
    if (state === "intro") {
      menuQueued = false;
      introT++;
      if (consumeAction() || introT >= INTRO_LEN) { state = "title"; titleIdle = 0; }
      return;
    }
    if (state === "title") {
      menuQueued = false;
      // Comme les vieux jeux : sans action pendant 25 s, l'intro repasse.
      if (++titleIdle > 25 * 60) { state = "intro"; introT = 0; return; }
      if (consumeAction() && !isLocked()) startGame();
      return;
    }
    if (state === "end") {
      menuQueued = false;
      if (frame - endAt < 90) { actionQueued = false; return; }
      if (consumeAction()) { hasSave = true; state = "title"; }
      return;
    }
    if (state === "menu") {
      if (consumeMenu() || consumeAction()) state = "play";
      return;
    }
    if (dialog) {
      menuQueued = false;
      if (consumeAction()) {
        dialog.i++;
        if (dialog.i >= dialog.lines.length) {
          const done = dialog.done;
          dialog = null;
          bumpCd = 45;
          if (done) done();
        }
      }
      return;
    }
    if (consumeMenu()) { state = "menu"; menuPage = 0; return; }
    flags.time += 1 / 60;
    if (frame % 300 === 0) rememberSpot();
    updatePlayer();
    if (dialog || state !== "play") return;
    updateBlocks();
    updateEnemies();
    updateShots();
    updatePickups();
    for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life--; }
    parts = parts.filter((p) => p.life > 0);
    checkPuzzle();
  }

  function updatePlayer() {
    const p = player;
    if (p.atk > 0) p.atk--;
    if (p.inv > 0) p.inv--;
    if (bumpCd > 0) bumpCd--;
    const dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    const [c0x, c0y] = center(p);
    const wasSwim = p.swim;
    p.swim = tileAt(c0x, c0y) === "W";
    if (p.swim && !wasSwim) sfx.splash();
    if (p.kt > 0) {
      p.kt--;
      move(p, p.kx, 0, "player");
      move(p, 0, p.ky, "player");
    } else {
      if (dx && !dy) p.dir = dx > 0 ? "right" : "left";
      else if (dy && !dx) p.dir = dy > 0 ? "down" : "up";
      else if (dx && dy) {
        const h = dx > 0 ? "right" : "left", v = dy > 0 ? "down" : "up";
        if (p.dir !== h && p.dir !== v) p.dir = v;
      }
      const sp = (p.swim ? 0.8 : p.atk > 6 ? 0.5 : 1.2) * (dx && dy ? 0.75 : 1);
      const bx = dx ? move(p, dx * sp, 0, "player") : null;
      const by = dy ? move(p, 0, dy * sp, "player") : null;
      if (dx || dy) p.walk++;
      const b = bx || by;
      if (b === "O" && lastBlock && (!dx || !dy)) {
        if (push.block === lastBlock && push.dir === p.dir) push.t++;
        else push = { block: lastBlock, dir: p.dir, t: 1 };
        if (push.t >= 14) { tryPush(lastBlock, DIRS[p.dir]); push.t = 0; }
      } else push.t = 0;
      if (b && bumpCd === 0 && "CBMGLWK".includes(b)) {
        bumpCd = 45;
        const before = cur;
        specialTile(b);
        if (dialog || cur !== before) return;
      }
    }
    if (consumeAction()) { if (!interact()) attack(); }
    if (dialog) return;

    // Changement d'écran
    const [cx, cy] = center(p);
    const [area, coords] = cur.split(":");
    let [gx, gy] = coords.split(",").map(Number);
    let moved = false;
    if (cx < 0) { gx--; p.x = W - p.w - 1; moved = true; }
    else if (cx >= W) { gx++; p.x = 1; moved = true; }
    else if (cy < 0) { gy--; p.y = PH - p.h - 1; moved = true; }
    else if (cy >= PH) { gy++; p.y = 1; moved = true; }
    if (moved) {
      const next = `${area}:${gx},${gy}`;
      if (SCREENS[next]) return enter(next, [p.x, p.y]);
      p.x = Math.max(0, Math.min(W - p.w, p.x));
      p.y = Math.max(0, Math.min(PH - p.h, p.y));
    }

    const under = tileAt(cx, cy);
    if (under === "E") {
      sfx.door();
      const [k, x, y] = DATA.EXITS[area];
      return enter(k, tilePos(x, y));
    }
    for (const c of chests) {
      if (!c.open && overlap(p, { x: c.x * TILE + 2, y: c.y * TILE + 3, w: 12, h: 11 })) { openChest(c); return; }
    }
    for (const n of npcs) {
      if (n.t === "duckling" && overlap(p, { x: n.x * TILE + 3, y: n.y * TILE + 3, w: 10, h: 10 })) {
        flags.ducklings[n.id] = true;
        npcs = npcs.filter((o) => o !== n);
        save();
        sfx.heart();
        say(fmt(T.duckling, { n: ducklingCount() }));
        return;
      }
    }
  }

  function updateEnemies() {
    const [px, py] = center(player);
    for (const e of [...enemies]) {
      if (e.inv > 0) e.inv--;
      if (e.kt > 0) {
        e.kt--;
        if (e.fly) { e.x += e.kx; e.y += e.ky; } else { move(e, e.kx, 0); move(e, 0, e.ky); }
      } else if (e.t === "crab") {
        e.timer--;
        if (e.timer <= 0) {
          const options = [[1, 0], [-1, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
          e.dir = options[Math.floor(Math.random() * options.length)];
          e.timer = 40 + Math.random() * 80;
        }
        if (move(e, e.dir[0] * 0.5, e.dir[1] * 0.5)) e.timer = 0;
      } else if (e.t === "cub" || e.t === "sentinel") {
        const [ex, ey] = center(e);
        const d = Math.hypot(px - ex, py - ey) || 1;
        const range = e.t === "sentinel" ? 120 : 90, sp = e.t === "sentinel" ? 0.75 : 0.65;
        if (d < range && !player.swim) {
          move(e, ((px - ex) / d) * sp, 0);
          move(e, 0, ((py - ey) / d) * sp);
        } else {
          e.timer--;
          if (e.timer <= 0) { e.dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)]; e.timer = 50 + Math.random() * 60; }
          if (move(e, e.dir[0] * 0.4, e.dir[1] * 0.4)) e.timer = 0;
        }
      } else if (e.t === "bat") {
        e.phase += 0.08;
        const [ex, ey] = center(e);
        const d = Math.hypot(px - ex, py - ey) || 1;
        let vx = Math.cos(e.phase) * 0.6, vy = Math.sin(e.phase * 1.3) * 0.6;
        if (d < 100) { vx += ((px - ex) / d) * 0.55; vy += ((py - ey) / d) * 0.55; }
        e.x = Math.max(0, Math.min(W - e.w, e.x + vx));
        e.y = Math.max(0, Math.min(PH - e.h, e.y + vy));
      } else if (e.boss) {
        updateBoss(e, px, py);
      }
      if (overlap(e, player)) hurtPlayer(e.dmg, e);
    }
  }

  function updateBoss(e, px, py) {
    const cfg = BOSS[e.t];
    e.st++;
    const [ex, ey] = center(e);
    const d = Math.hypot(px - ex, py - ey) || 1;
    const angry = e.hp <= ENEMY_TYPES[e.t].hp / 2;
    if (angry && cfg.summon && !e.summoned) {
      e.summoned = true;
      enemies.push(makeEnemy(cfg.summon, 4, 5), makeEnemy(cfg.summon, 11, 5));
      burst(4 * TILE + 8, 5 * TILE + 8, "#f4f4e8", 10);
      burst(11 * TILE + 8, 5 * TILE + 8, "#f4f4e8", 10);
    }
    if (e.state === "walk") {
      const sp = angry ? cfg.angry : cfg.speed;
      if (e.t === "crabking") {
        move(e, Math.sign(px - ex) * sp, 0);
        move(e, 0, Math.sign(py - ey) * sp * 0.3);
      } else {
        move(e, ((px - ex) / d) * sp, 0);
        move(e, 0, ((py - ey) / d) * sp);
      }
      if (cfg.shotEvery && e.st % cfg.shotEvery === Math.floor(cfg.shotEvery / 2)) throwCandles(e, px, py, angry ? cfg.angryShots : cfg.shots);
      if (e.st >= (angry ? 120 : 170)) { e.state = "wind"; e.st = 0; }
    } else if (e.state === "wind") {
      if (e.st >= 30) { e.vx = ((px - ex) / d) * cfg.charge; e.vy = ((py - ey) / d) * cfg.charge; e.state = "charge"; e.st = 0; }
    } else if (e.state === "charge") {
      const b = move(e, e.vx, 0) || move(e, 0, e.vy);
      if (b) { e.state = "stun"; e.st = 0; shake = 12; sfx.boss(); }
      else if (e.st > 55) { e.state = "walk"; e.st = 0; }
    } else if (e.state === "stun") {
      if (e.st >= 55) { e.state = "walk"; e.st = 0; }
    }
  }

  function throwCandles(e, px, py, n) {
    const [ex, ey] = center(e);
    const base = Math.atan2(py - ey, px - ex);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.35;
      shots.push({ x: ex - 2, y: ey - 3, w: 4, h: 6, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6, life: 240 });
    }
  }

  function updateShots() {
    for (const s of shots) {
      s.x += s.vx; s.y += s.vy; s.life--;
      const ch = tileAt(s.x + 2, s.y + 3);
      if (ch === null || solidTile(ch, "shot")) s.life = 0;
      if (s.life > 0 && overlap(s, player)) { hurtPlayer(1, s); s.life = 0; }
    }
    shots = shots.filter((s) => s.life > 0);
  }

  function updatePickups() {
    for (const k of pickups) {
      k.life--;
      if (overlap(k, player)) {
        k.life = 0;
        if (k.t === "coin") { flags.coins += k.v; sfx.coin(); }
        else { player.hp = Math.min(flags.maxHp, player.hp + 2); sfx.heart(); }
      }
    }
    pickups = pickups.filter((k) => k.life > 0);
  }

  // ─── Dessin ───
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circle(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  const texts = [];
  function txt(str, x, y, size, color = UI.ink, align = "left") { texts.push({ str, x, y, size, color, align }); }
  function textWidth(str, size) { display.font = `${size * SCALE}px ${FONT}`; return display.measureText(str).width / SCALE; }
  function wrapText(text, maxWidth, size) {
    const words = text.split(" "), lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (textWidth(test, size) > maxWidth && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function grass(x, y, n) {
    rect(x, y, 16, 16, "#5aa83c");
    rect(x + ((n * 3) % 12) + 1, y + ((n * 5) % 12) + 2, 2, 1, "#2f6b26");
    rect(x + ((n * 7 + 5) % 12) + 1, y + ((n * 2 + 7) % 12) + 1, 1, 2, "#a8d86a");
  }
  function floor(x, y) {
    rect(x, y, 16, 16, "#5a5a7a");
    rect(x, y, 16, 1, "#2b2b45");
    rect(x, y, 1, 16, "#2b2b45");
  }
  function rock(x, y, cracked = false) {
    rect(x + 1, y + 3, 14, 12, "#a0a0b8");
    rect(x + 2, y + 2, 12, 2, "#f4f4e8");
    rect(x + 1, y + 13, 14, 2, "#5a5a7a");
    if (cracked) {
      rect(x + 7, y + 3, 1, 4, "#10101c"); rect(x + 6, y + 6, 1, 3, "#10101c"); rect(x + 8, y + 8, 1, 4, "#10101c");
      rect(x + 4, y + 9, 3, 1, "#10101c");
    } else rect(x + 3, y + 5, 4, 2, "#f4f4e8");
  }
  function water(x, y, tx, ty) {
    rect(x, y, 16, 16, "#1e5aa8");
    const o = Math.floor(frame / 20 + tx + ty) % 4;
    rect(x + o * 3, y + 4, 5, 1, "#4aa3df");
    rect(x + ((o * 3 + 8) % 12), y + 11, 4, 1, "#4aa3df");
  }

  function drawTile(ch, tx, ty) {
    const x = tx * TILE, y = ty * TILE + HUD;
    const n = (tx * 7 + ty * 13) % 5;
    const dungeon = SCREENS[cur].border === "#";
    const base = () => (dungeon ? floor(x, y) : grass(x, y, n));
    switch (ch) {
      case ".": grass(x, y, n); break;
      case ",": grass(x, y, n); rect(x + 4, y + 5, 2, 2, "#d83a3a"); rect(x + 10, y + 9, 2, 2, "#ffd23f"); rect(x + 7, y + 12, 2, 2, "#f4f4e8"); break;
      case "T": grass(x, y, n); rect(x + 6, y + 10, 4, 6, "#7a4a24"); circle(x + 8, y + 7, 7, "#2f6b26"); circle(x + 6, y + 5, 3, "#5aa83c"); break;
      case "W": water(x, y, tx, ty); break;
      case "R": base(); rock(x, y); break;
      case "K": base(); rock(x, y, true); break;
      case "S": rect(x, y, 16, 16, "#f0d890"); rect(x + ((n * 3) % 14), y + ((n * 5) % 14), 1, 1, "#c08040"); rect(x + ((n * 7 + 4) % 14), y + ((n * 3 + 8) % 14), 1, 1, "#c08040"); break;
      case "H": case "D": {
        const below = tiles[ty + 1] && tiles[ty + 1][tx];
        if (ch === "H" && (below === "H" || below === "D")) {
          rect(x, y, 16, 16, "#d83a3a");
          for (let i = 2; i < 16; i += 4) rect(x, y + i, 16, 1, "#7a4a24");
        } else {
          rect(x, y, 16, 16, "#f0d890");
          rect(x, y + 15, 16, 1, "#c08040");
          if (ch === "D") { rect(x + 4, y + 4, 8, 12, "#7a4a24"); rect(x + 9, y + 10, 2, 2, "#ffd23f"); }
          else { rect(x + 4, y + 4, 8, 6, "#4aa3df"); rect(x + 7, y + 4, 1, 6, "#f0d890"); }
        }
        break;
      }
      case "#": rect(x, y, 16, 16, "#2b2b45"); rect(x, y + 7, 16, 1, "#10101c"); rect(x + (ty % 2 ? 4 : 11), y, 1, 7, "#10101c"); rect(x + (ty % 2 ? 11 : 4), y + 8, 1, 8, "#10101c"); break;
      case "_": floor(x, y); break;
      case "x": grass(x, y, n); circle(x + 8, y + 9, 6, "#2f6b26"); circle(x + 6, y + 7, 2, "#a8d86a"); circle(x + 10, y + 10, 1.5, "#a8d86a"); break;
      case "n": base(); rect(x + 7, y + 8, 2, 8, "#7a4a24"); rect(x + 2, y + 3, 12, 7, "#c08040"); rect(x + 3, y + 5, 10, 1, "#7a4a24"); rect(x + 3, y + 7, 7, 1, "#7a4a24"); break;
      case "C":
        grass(x, y, n); rock(x, y);
        rect(x + 4, y + 7, 8, 9, "#10101c"); circle(x + 8, y + 8, 4, "#10101c");
        if (!flags.solved["cave-open"]) { rect(x + 6, y + 10, 4, 4, "#ffd23f"); rect(x + 7, y + 11, 2, 2, "#10101c"); }
        break;
      case "M":
        rect(x, y, 16, 16, "#a0a0b8"); rect(x, y, 16, 3, "#f4f4e8");
        rect(x + (tx % 2 ? 0 : 4), y + 5, 12, 11, "#10101c");
        rect(x + (tx % 2 ? 0 : 4), y + 3, 12, 2, "#ffd23f");
        break;
      case "B": {
        rect(x, y, 16, 16, "#7a4a24");
        rect(x, y + 5, 16, 1, "#10101c"); rect(x, y + 11, 16, 1, "#10101c");
        const filled = tx === 7 ? flags.f1 : flags.f2;
        drawFeather(x + 8, y + 9, filled ? 1 : 0.35);
        break;
      }
      case "G": floor(x, y); if (!flags.solved[cur]) { for (let i = 0; i < 4; i++) rect(x + 1 + i * 4, y, 2, 16, "#a0a0b8"); rect(x, y + 3, 16, 2, "#5a5a7a"); rect(x, y + 11, 16, 2, "#5a5a7a"); } break;
      case "P": {
        floor(x, y);
        const pressed = flags.solved[cur] || blocks.some((b) => b.tx === tx && b.ty === ty);
        rect(x + 2, y + 2, 12, 12, "#10101c"); rect(x + 3, y + 3, 10, 10, pressed ? "#5aa83c" : "#d83a3a");
        break;
      }
      case "E": floor(x, y); rect(x + 2, y + 2, 12, 12, "#10101c"); for (let i = 0; i < 3; i++) rect(x + 3, y + 4 + i * 3, 10, 1, "#a0a0b8"); break;
      case "e": floor(x, y); break;
      case "L": floor(x, y); rect(x + 1, y, 14, 16, "#7a4a24"); rect(x + 1, y + 7, 14, 2, "#c08040"); rect(x + 6, y + 9, 4, 4, "#ffd23f"); rect(x + 7, y + 10, 2, 2, "#10101c"); break;
      case "l": {
        floor(x, y);
        rect(x + 4, y + 9, 8, 6, "#5a5a7a"); rect(x + 3, y + 8, 10, 2, "#a0a0b8");
        const lit = flags.solved[cur] || torchLit.some(([a, b]) => a === tx && b === ty);
        if (lit) { const f = Math.floor(frame / 6) % 2; circle(x + 8, y + 5 + f, 4, "#ff8c1a"); circle(x + 8, y + 6, 2, "#ffd23f"); }
        else rect(x + 6, y + 6, 4, 2, "#2b2b45");
        break;
      }
      case "Q": {
        floor(x, y);
        ctx.fillStyle = sw() === 1 ? "#d83a3a" : "#4aa3df";
        ctx.beginPath(); ctx.moveTo(x + 8, y + 1); ctx.lineTo(x + 14, y + 8); ctx.lineTo(x + 8, y + 15); ctx.lineTo(x + 2, y + 8); ctx.fill();
        rect(x + 6, y + 5, 2, 4, "#f4f4e8");
        break;
      }
      case "u": case "v": {
        floor(x, y);
        const color = ch === "u" ? "#4aa3df" : "#d83a3a";
        if (solidTile(ch, "player")) { rect(x + 1, y + 1, 14, 14, color); rect(x + 3, y + 3, 10, 10, "#10101c"); rect(x + 4, y + 4, 8, 8, color); }
        else { rect(x + 3, y + 3, 10, 1, color); rect(x + 3, y + 12, 10, 1, color); rect(x + 3, y + 3, 1, 10, color); rect(x + 12, y + 3, 1, 10, color); }
        break;
      }
      default: rect(x, y, 16, 16, "#ff00ff");
    }
  }

  function drawFeather(x, y, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(-0.6);
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f4f4e8";
    ctx.beginPath(); ctx.ellipse(-0.8, -1, 1, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    rect(-0.5, 2, 1, 5, "#c08040");
    ctx.restore();
  }

  function drawHeart(x, y, fill) {
    const shape = (c) => {
      circle(x + 2.3, y + 2.4, 2.3, c); circle(x + 5.7, y + 2.4, 2.3, c);
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x + 0.1, y + 3); ctx.lineTo(x + 7.9, y + 3); ctx.lineTo(x + 4, y + 7.6); ctx.fill();
    };
    shape("#5a5a7a");
    if (fill === "empty") return;
    ctx.save();
    if (fill === "half") { ctx.beginPath(); ctx.rect(x - 1, y - 1, 5, 10); ctx.clip(); }
    shape("#d83a3a");
    ctx.restore();
  }

  function drawDuck(cx, cy, dir, step, scale = 1, bow = false) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    const leg = Math.floor(step / 8) % 2;
    rect(-4, 6 + leg, 3, 1.5, "#ff8c1a"); rect(1, 7 - leg, 3, 1.5, "#ff8c1a");
    circle(0, 2, 6, "#ffd23f");
    circle(dir === "left" ? 2 : dir === "right" ? -2 : 0, 3, 3, "#f0d890");
    const hx = dir === "left" ? -2 : dir === "right" ? 2 : 0, hy = dir === "up" ? -4 : -3;
    circle(hx, hy, 4.5, "#ffd23f");
    rect(hx - 1, hy - 7, 2, 3, "#ffd23f"); rect(hx + 1, hy - 6, 1.5, 2, "#ffd23f");
    if (bow) { rect(hx - 4, hy - 6, 3, 3, "#d83a3a"); rect(hx - 2, hy - 5, 2, 1, "#d83a3a"); }
    if (dir === "down") {
      rect(hx - 4.5, hy - 1.5, 9, 2.5, "#10101c"); rect(hx - 3.5, hy - 1, 1.5, 1, "#ff8c1a"); rect(hx + 1.5, hy - 1, 1.5, 1, "#ff8c1a");
      rect(hx - 2.5, hy + 2, 5, 2, "#ff8c1a");
    } else if (dir === "left") {
      rect(hx - 5, hy - 1.5, 6, 2.5, "#10101c"); rect(hx - 8, hy + 1, 4, 2, "#ff8c1a");
    } else if (dir === "right") {
      rect(hx - 1, hy - 1.5, 6, 2.5, "#10101c"); rect(hx + 4, hy + 1, 4, 2, "#ff8c1a");
    } else {
      rect(-1, 7, 2, 2, "#f0d890");
    }
    ctx.restore();
  }

  function drawEnemyAt(t, cx, cy, e = null) {
    const st = e ? e.state : "walk";
    if (t === "crab" || t === "crabking") {
      const s = t === "crabking" ? 2.2 : 1;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
      const wob = Math.sin(frame / 6 + (e ? e.x : 0)) * 0.8;
      rect(-6, 3, 12, 1, "#7a4a24");
      circle(-6, -1 + wob, 2.5, "#d83a3a"); circle(6, -1 - wob, 2.5, "#d83a3a");
      circle(0, 1, 5, "#d83a3a");
      rect(-3, -1, 2, 2, "#f4f4e8"); rect(1, -1, 2, 2, "#f4f4e8");
      rect(-2.5, -0.5, 1, 1, "#10101c"); rect(1.5, -0.5, 1, 1, "#10101c");
      rect(-0.5, -7, 1, 3, "#2b2b45");
      circle(0, -8, 1.3 + Math.sin(frame / 4) * 0.3, "#ff8c1a");
      if (t === "crabking") rect(-3, -6, 6, 1.5, "#ffd23f");
      ctx.restore();
    } else if (t === "cub" || t === "sentinel") {
      const fur = t === "sentinel" ? "#7a4a24" : "#c08040";
      circle(cx - 4, cy - 5, 2.4, fur); circle(cx + 4, cy - 5, 2.4, fur);
      circle(cx, cy, t === "sentinel" ? 7 : 6, fur);
      circle(cx, cy + 2, 2.6, "#f0d890");
      rect(cx - 0.8, cy + 1, 1.6, 1, "#10101c");
      rect(cx - 3, cy - 2, 1.5, 1.5, "#10101c"); rect(cx + 1.5, cy - 2, 1.5, 1.5, "#10101c");
      rect(cx - 4, cy - 4, 3, 1, "#d83a3a"); rect(cx + 1, cy - 4, 3, 1, "#d83a3a");
      if (t === "sentinel") { rect(cx - 6, cy - 7, 12, 3, "#a0a0b8"); rect(cx - 1, cy - 9, 2, 3, "#a0a0b8"); }
    } else if (t === "bat") {
      const flap = Math.floor(frame / 5) % 2 ? 2 : -1;
      ctx.fillStyle = "#2b2b45";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 7, cy - 2 + flap); ctx.lineTo(cx - 4, cy + 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 7, cy - 2 + flap); ctx.lineTo(cx + 4, cy + 2); ctx.fill();
      rect(cx - 2, cy - 3, 4, 6, "#d83a3a");
      circle(cx, cy - 5, 1.3, "#ff8c1a");
      rect(cx - 1.5, cy - 1, 1, 1, "#f4f4e8"); rect(cx + 0.5, cy - 1, 1, 1, "#f4f4e8");
    } else if (t === "pelican") {
      const x = cx + (st === "wind" ? Math.sin(frame) * 1.5 : 0);
      circle(x, cy + 2, 11, "#f4f4e8");
      circle(x - 9, cy + 2, 5, "#a0a0b8"); circle(x + 9, cy + 2, 5, "#a0a0b8");
      circle(x, cy - 7, 6, "#f4f4e8");
      rect(x - 2, cy - 4, 4, 10, "#ff8c1a"); rect(x - 3, cy + 3, 6, 4, "#ffd23f");
      rect(x - 4, cy - 9, 2, 2, "#10101c"); rect(x + 2, cy - 9, 2, 2, "#10101c");
      if (st === "stun") for (let i = 0; i < 3; i++) { const a = frame / 10 + i * 2.1; circle(x + Math.cos(a) * 9, cy - 16 + Math.sin(a) * 2, 1.5, "#ffd23f"); }
    } else if (t === "bearking") {
      const x = cx + (st === "wind" ? Math.sin(frame) * 1.5 : 0);
      circle(x - 10, cy - 10, 4.5, "#7a4a24"); circle(x + 10, cy - 10, 4.5, "#7a4a24");
      circle(x, cy, 13, "#7a4a24");
      circle(x, cy + 4, 7.5, "#c08040");
      circle(x, cy - 1, 4, "#f0d890");
      rect(x - 1.5, cy - 2.5, 3, 2, "#10101c");
      if (st === "stun") {
        rect(x - 6, cy - 6, 3, 1, "#10101c"); rect(x + 3, cy - 6, 3, 1, "#10101c");
        for (let i = 0; i < 3; i++) { const a = frame / 10 + i * 2.1; circle(x + Math.cos(a) * 9, cy - 16 + Math.sin(a) * 2, 1.5, "#ffd23f"); }
      } else { rect(x - 6, cy - 7, 3, 3, "#d83a3a"); rect(x + 3, cy - 7, 3, 3, "#d83a3a"); }
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.moveTo(x - 7, cy - 12); ctx.lineTo(x - 7, cy - 19); ctx.lineTo(x - 3.5, cy - 15); ctx.lineTo(x, cy - 20);
      ctx.lineTo(x + 3.5, cy - 15); ctx.lineTo(x + 7, cy - 19); ctx.lineTo(x + 7, cy - 12);
      ctx.fill();
    }
  }
  function drawEnemy(e) {
    if (e.inv > 0 && Math.floor(e.inv / 3) % 2) return;
    const [cx, c0] = center(e);
    drawEnemyAt(e.t, cx, c0 + HUD, e);
  }

  function drawNpcAt(t, cx, cy) {
    const bob = Math.sin(frame / 20) > 0 ? 0 : 0.6;
    if (t === "frog") {
      circle(cx, cy + 1 + bob, 6.5, "#5aa83c");
      circle(cx - 3.5, cy - 4 + bob, 2.8, "#5aa83c"); circle(cx + 3.5, cy - 4 + bob, 2.8, "#5aa83c");
      circle(cx - 3.5, cy - 4 + bob, 1.8, "#f4f4e8"); circle(cx + 3.5, cy - 4 + bob, 1.8, "#f4f4e8");
      rect(cx - 4, cy - 4.5 + bob, 1, 1.5, "#10101c"); rect(cx + 3, cy - 4.5 + bob, 1, 1.5, "#10101c");
      rect(cx - 3, cy + 2 + bob, 6, 1, "#2f6b26");
      rect(cx - 6, cy - 7 + bob, 12, 1.5, "#f4f4e8");
      rect(cx + 7, cy - 2, 1, 9, "#7a4a24");
    } else if (t === "beaver") {
      ctx.fillStyle = "#7a4a24"; ctx.beginPath(); ctx.ellipse(cx + 6, cy + 5, 3, 5, 0.6, 0, Math.PI * 2); ctx.fill();
      circle(cx, cy + 1 + bob, 6.5, "#c08040");
      circle(cx - 4, cy - 5 + bob, 1.8, "#c08040"); circle(cx + 4, cy - 5 + bob, 1.8, "#c08040");
      circle(cx, cy + 1 + bob, 3, "#f0d890");
      rect(cx - 3, cy - 2 + bob, 1.5, 1.5, "#10101c"); rect(cx + 1.5, cy - 2 + bob, 1.5, 1.5, "#10101c");
      rect(cx - 1.5, cy + 2.5 + bob, 3, 2.5, "#f4f4e8");
    } else if (t === "mama") {
      drawDuck(cx, cy, "down", 0, 1.15, true);
    } else if (t === "duckling") {
      drawDuck(cx, cy + 2, Math.floor(frame / 40) % 2 ? "left" : "right", frame, 0.6);
    }
  }
  function drawNpc(n) { drawNpcAt(n.t, n.x * TILE + 8, n.y * TILE + 8 + HUD); }

  function drawChest(c) {
    const x = c.x * TILE, y = c.y * TILE + HUD;
    if (c.open) {
      rect(x + 2, y + 7, 12, 8, "#c08040"); rect(x + 3, y + 7, 10, 3, "#10101c");
      rect(x + 2, y + 2, 12, 4, "#7a4a24");
    } else {
      rect(x + 2, y + 4, 12, 11, "#c08040"); rect(x + 2, y + 4, 12, 3, "#f0d890");
      rect(x + 2, y + 8, 12, 1, "#ffd23f"); rect(x + 7, y + 8, 2, 3, "#ffd23f");
      if (Math.floor(frame / 30) % 2) rect(x + 12, y + 3, 1, 1, "#f4f4e8");
    }
  }

  function drawBlock(b) {
    const x = b.x, y = b.y + HUD;
    rect(x + 1, y + 1, 14, 14, "#a0a0b8"); rect(x + 1, y + 1, 14, 2, "#f4f4e8"); rect(x + 1, y + 13, 14, 2, "#5a5a7a");
    rect(x + 4, y + 5, 8, 6, "#5a5a7a"); rect(x + 5, y + 6, 6, 4, "#a0a0b8");
  }

  function drawPlayer() {
    const p = player;
    if (p.inv > 0 && Math.floor(p.inv / 4) % 2) return;
    const [cx, c0] = center(p);
    const cy = c0 + HUD - 1;
    if (p.swim) {
      ctx.save(); ctx.beginPath(); ctx.rect(cx - 12, cy - 14, 24, 15); ctx.clip();
      drawDuck(cx, cy + 3, p.dir, p.walk);
      ctx.restore();
      rect(cx - 7, cy + 3, 14, 1, "#f4f4e8");
      return;
    }
    drawDuck(cx, cy, p.dir, p.walk);
    if (p.atk > 0) {
      const [fx, f0] = frontPoint(9);
      const fy = f0 + HUD;
      const a0 = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[p.dir];
      const k = 1 - p.atk / 14;
      ctx.strokeStyle = flags.power ? "#ffd23f" : "#f4f4e8";
      ctx.lineWidth = flags.power ? 2 : 1.5;
      for (const r of [3 + k * 6, 7 + k * 8]) { ctx.beginPath(); ctx.arc(fx, fy, r, a0 - 0.9, a0 + 0.9); ctx.stroke(); }
    }
  }

  function drawKeyIcon(x, y) { circle(x, y, 2.5, "#ffd23f"); rect(x + 2, y - 1, 6, 2, "#ffd23f"); rect(x + 6, y + 1, 2, 2, "#ffd23f"); }
  function drawHud() {
    ctx = bgCtx;
    rect(0, 0, W, HUD, UI.night);
    rect(0, HUD - 1, W, 1, "#10101c");
    ctx = spCtx;
    for (let i = 0; i < flags.maxHp / 2; i++) {
      const hp = player.hp - i * 2;
      drawHeart(3 + i * 10, 4, hp >= 2 ? "full" : hp === 1 ? "half" : "empty");
    }
    circle(98, 8, 3.5, "#ffd23f"); circle(98, 8, 1.5, "#ff8c1a");
    txt(`${flags.coins}`, 104, 4.5, 7, UI.paper);
    const area = areaOf(cur);
    if (area !== "o") { drawKeyIcon(140, 8); txt(`${flags.keys[area] || 0}`, 150, 4.5, 7, UI.paper); }
    if (flags.power) { circle(172, 8, 3, "#ffd23f"); ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(172, 8, 6, -0.7, 0.7); ctx.stroke(); }
    if (flags.flippers) { ctx.fillStyle = "#ff8c1a"; ctx.beginPath(); ctx.moveTo(186, 3); ctx.lineTo(192, 13); ctx.lineTo(182, 13); ctx.fill(); }
    for (let i = 0; i < 3; i++) {
      if (flags["f" + (i + 1)]) drawFeather(W - 34 + i * 11, 8, 1);
      else rect(W - 35 + i * 11, 6, 2, 4, "#5a5a7a");
    }
    ctx = bgCtx;
  }

  function drawDialog() {
    const x = 6, w = W - 12, size = 6, lh = 10;
    const lines = wrapText(dialog.lines[dialog.i], w - 14, size).slice(0, 7);
    const h = lines.length * lh + 12, y = H - h - 5;
    ctx = spCtx;
    rect(x, y, w, h, UI.night);
    rect(x + 2, y + 2, w - 4, 1, UI.accent); rect(x + 2, y + h - 3, w - 4, 1, UI.accent);
    if (Math.floor(frame / 20) % 2) {
      ctx.fillStyle = UI.accent; ctx.beginPath();
      ctx.moveTo(x + w - 12, y + h - 9); ctx.lineTo(x + w - 6, y + h - 9); ctx.lineTo(x + w - 9, y + h - 5); ctx.fill();
    }
    ctx = bgCtx;
    lines.forEach((l, i) => txt(l, x + 7, y + 7 + i * lh, size, UI.paper));
  }

  function drawWorld() {
    ctx = bgCtx;
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) drawTile(tiles[ty][tx], tx, ty);
    ctx = spCtx;
    for (const b of blocks) drawBlock(b);
    for (const c of chests) drawChest(c);
    for (const k of pickups) {
      if (k.life < 120 && Math.floor(k.life / 6) % 2) continue;
      if (k.t === "coin") { circle(k.x + 4, k.y + 4 + HUD, 3.5, "#ffd23f"); circle(k.x + 4, k.y + 4 + HUD, 1.5, k.v > 1 ? "#d83a3a" : "#ff8c1a"); }
      else drawHeart(k.x, k.y + HUD, "full");
    }
    for (const n of npcs) drawNpc(n);
    if (cur === "o:1,2") {
      // Canetons rentrés à la maison, autour de Maman Cane.
      const home = ducklingCount();
      for (let i = 0; i < home; i++) drawNpcAt("duckling", 9 * TILE + (i - 1) * 9, 8 * TILE + 8 + HUD);
    }
    for (const e of enemies) drawEnemy(e);
    drawPlayer();
    for (const s of shots) { rect(s.x, s.y + HUD + 1, 4, 6, "#d83a3a"); circle(s.x + 2, s.y + HUD, 1.4, "#ff8c1a"); }
    for (const p of parts) if (p.life > 6) rect(Math.round(p.x) - 1, Math.round(p.y) + HUD - 1, 2, 2, p.color);
    const boss = enemies.find((e) => e.boss);
    if (boss) {
      rect(W / 2 - 50, H - 9, 100, 5, UI.night);
      rect(W / 2 - 49, H - 8, (98 * boss.hp) / ENEMY_TYPES[boss.t].hp, 3, "#d83a3a");
    }
    drawHud();
  }

  function drawPondBackground() {
    ctx = bgCtx;
    rect(0, 0, W, H, UI.night);
    const colors = ["#1e5aa8", "#4aa3df", "#f4f4e8"];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) ctx.lineTo(x, H - 26 + i * 8 + Math.round(Math.sin(x / 18 + frame / 30 + i) * 3));
      ctx.lineTo(W, H);
      ctx.fill();
    }
  }

  // Intro animée : 4 scènes de 4 secondes (l'Étang calme, l'orage, le vol des plumes, le canard calme).
  function drawIntro() {
    const scene = Math.min(3, Math.floor(introT / INTRO_SCENE));
    const st = (introT - scene * INTRO_SCENE) / INTRO_SCENE; // 0 → 1 dans la scène
    const storm = scene === 1 || scene === 2;
    const sea = 118;
    ctx = bgCtx;
    rect(0, 0, W, H, scene === 0 ? "#4aa3df" : UI.night);
    if (scene === 0) {
      circle(206, 34, 14, "#ffd23f"); circle(206, 34, 9, "#f0d890");
      for (const [cx, cy] of [[50, 30], [90, 46], [150, 24]]) { circle(cx, cy, 6, "#f4f4e8"); circle(cx + 7, cy + 1, 5, "#f4f4e8"); circle(cx - 7, cy + 2, 4, "#f4f4e8"); }
    } else {
      for (const [cx, cy] of [[40, 26], [110, 18], [190, 30], [240, 14]]) { circle(cx, cy, 9, "#5a5a7a"); circle(cx + 10, cy + 2, 7, "#5a5a7a"); circle(cx - 10, cy + 3, 6, "#5a5a7a"); }
    }
    rect(0, sea, W, H - sea, "#1e5aa8");
    for (let i = 0; i < 12; i++) {
      const wx = (i * 41 + Math.floor(frame / (storm ? 4 : 10)) * 2) % (W + 20) - 10;
      rect(wx, sea + 4 + (i % 4) * 7, 8, 1, "#4aa3df");
    }
    if (storm) {
      for (let i = 0; i < 50; i++) rect((i * 37 + frame * 2) % W, (i * 53 + frame * 6) % sea, 1, 4, "#a0a0b8");
      if (frame % 97 < 4) rect(0, 0, W, sea, "#f4f4e8");
    }
    if (scene === 3) for (let i = 0; i < 24; i++) rect((i * 29) % W, (i * 17) % 90, 1, 1, "#f4f4e8");

    ctx = spCtx;
    if (scene === 1) {
      for (let i = 0; i < 6; i++) {
        const x = 20 + i * 42, y = ((i * 31 + introT * 1.5) % (sea + 10)) - 10;
        rect(x, y + 2, 4, 7, "#d83a3a"); circle(x + 2, y + 1, 1.4, "#ff8c1a");
      }
    }
    const bob = Math.round(Math.sin(frame / 15) * 1.5);
    if (scene < 3) {
      const shake = storm ? Math.round(Math.sin(frame / 2)) : 0;
      drawDuck(80 + shake, sea - 4 + bob, "right", 0, 1.6);
      // Les trois plumes : au-dessus du canard, puis volées vers le Roi Ours.
      for (let i = 0; i < 3; i++) {
        let fx = 62 + i * 18, fy = 70 + Math.round(Math.sin(frame / 12 + i) * 3);
        if (scene === 2) {
          const k = Math.min(1, Math.max(0, (st - 0.3) / 0.5));
          fx += (176 + i * 10 - fx) * k; fy += (62 - fy) * k;
        }
        drawFeather(fx, fy, 1);
      }
    }
    if (scene === 2) {
      const bx = Math.round(W + 30 - Math.min(1, st / 0.3) * (W + 30 - 196));
      rect(bx - 22, sea - 8, 44, 10, "#5a5a7a"); rect(bx - 20, sea - 10, 40, 3, "#a0a0b8");
      drawEnemyAt("bearking", bx, sea - 30, { state: st > 0.8 ? "wind" : "walk", x: 0 });
    }
    if (scene === 3) {
      drawDuck(W / 2, 92 + bob, "down", 0, 3.2);
      const g = Math.floor((st * 3) % 1 * 30);
      if (st > 0.25) rect(W / 2 - 14 + g, 80 + bob, 3, 2, "#f4f4e8");
    }

    ctx = bgCtx;
    rect(0, 146, W, H - 146, UI.ink);
    wrapText(T.introScenes[scene], W - 20, 6).slice(0, 3).forEach((l, i) => txt(l, W / 2, 152 + i * 10, 6, UI.paper, "center"));
    if (Math.floor(frame / 30) % 2) txt(T.skip, W - 6, 4, 4, UI.dim, "right");
  }

  function drawTitle() {
    drawPondBackground();
    if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, W / 2 - 32, 8, 64, 64);
    txt("DIP DUCK", W / 2, 80, 16, UI.accent, "center");
    txt(T.subtitle, W / 2, 102, 8, UI.paper, "center");
    if (isLocked()) {
      const left = Math.max(0, Math.floor((OPENS_AT - Date.now()) / 1000));
      const pad = (n) => String(n).padStart(2, "0");
      txt(T.lockedTitle, W / 2, 118, 6, UI.accent, "center");
      txt(T.lockedDate, W / 2, 128, 5, UI.paper, "center");
      txt(fmt(T.countdown, { d: Math.floor(left / 86400), h: pad(Math.floor((left % 86400) / 3600)), m: pad(Math.floor((left % 3600) / 60)), s: pad(left % 60) }), W / 2, 138, 6, UI.accent, "center");
      return;
    }
    if (Math.floor(frame / 30) % 2) txt(T.start, W / 2, 124, 6, UI.accent, "center");
    txt(T.controls, W / 2, 140, 4, UI.dim, "center");
    if (hasSave) txt(T.newGame, W / 2, 150, 4, UI.dim, "center");
  }

  function drawEnd() {
    drawPondBackground();
    ctx = spCtx;
    for (let i = 0; i < 3; i++) drawFeather(W / 2 - 22 + i * 22, 22 + Math.round(Math.sin(frame / 20 + i) * 3), 1);
    drawDuck(W / 2, 54, "down", frame, 2);
    ctx = bgCtx;
    txt(T.endTitle, W / 2, 80, 12, UI.accent, "center");
    txt(fmt(T.endStats, { c: flags.coins, t: fmtTime(flags.time), d: flags.deaths }), W / 2, 100, 5, UI.paper, "center");
    txt(fmt(T.endCards, { n: cardCount() }), W / 2, 112, 5, UI.paper, "center");
    txt(T.thanks, W / 2, 126, 6, UI.dim, "center");
    if (frame - endAt > 90 && Math.floor(frame / 30) % 2) txt(T.again, W / 2, 142, 6, UI.accent, "center");
  }

  function cardArt(id, cx, cy) {
    switch (id) {
      case "frog": drawNpcAt("frog", cx, cy); break;
      case "key": drawKeyIcon(cx - 4, cy); break;
      case "crabking": drawEnemyAt("crab", cx, cy + 1); break;
      case "power": circle(cx, cy, 3, "#ffd23f"); ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, 7, -0.8, 0.8); ctx.stroke(); break;
      case "pelican": ctx.save(); ctx.translate(cx, cy); ctx.scale(0.55, 0.55); drawEnemyAt("pelican", 0, 0); ctx.restore(); break;
      case "flippers": ctx.fillStyle = "#ff8c1a"; ctx.beginPath(); ctx.moveTo(cx - 3, cy - 7); ctx.lineTo(cx + 5, cy + 6); ctx.lineTo(cx - 8, cy + 6); ctx.fill(); break;
      case "bearking": ctx.save(); ctx.translate(cx, cy + 2); ctx.scale(0.5, 0.5); drawEnemyAt("bearking", 0, 0); ctx.restore(); break;
      case "forest": circle(cx, cy - 1, 7, "#2f6b26"); rect(cx - 1, cy + 4, 3, 5, "#7a4a24"); break;
      case "ducklings": for (let i = 0; i < 3; i++) drawDuck(cx - 8 + i * 8, cy + 1, "down", 0, 0.55); break;
      case "pieces": drawHeart(cx - 4, cy - 4, "full"); break;
      case "beaver": drawNpcAt("beaver", cx, cy); break;
      case "calm": drawDuck(cx, cy, "down", 0, 1); break;
    }
  }

  function drawMenu() {
    ctx = bgCtx;
    rect(0, 0, W, H, UI.night);
    if (menuPage === 0) {
      txt(T.menuProgress, W / 2, 8, 8, UI.accent, "center");
      const done = chapter();
      ctx = spCtx;
      T.chapters.forEach((_, i) => {
        const y = 26 + i * 13;
        rect(14, y, 7, 7, i < done ? "#5aa83c" : "#5a5a7a");
        if (i < done) { rect(15, y + 3, 2, 2, "#f4f4e8"); rect(17, y + 4, 3, 1, "#f4f4e8"); rect(19, y + 1, 1, 3, "#f4f4e8"); }
      });
      ctx = bgCtx;
      T.chapters.forEach((name, i) => txt(`${i + 1}. ${name}`, 28, 27 + i * 13, 5, i < done ? UI.paper : i === done ? UI.accent : UI.dim));
      txt(T.objective, 14, 98, 5, UI.accent);
      wrapText(T.goals[done], W - 30, 5).slice(0, 3).forEach((l, i) => txt(l, 14, 108 + i * 9, 5, UI.paper));
      txt(fmt(T.statsLine1, { a: ducklingCount(), b: flags.pieces }), 14, 146, 5, UI.dim);
      txt(fmt(T.statsLine2, { c: cardCount(), d: flags.deaths, t: fmtTime(flags.time) }), 14, 158, 5, UI.dim);
    } else {
      txt(T.menuCards, W / 2, 8, 7, UI.accent, "center");
      const cw = 52, ch = 42, gx = 8, x0 = (W - (4 * cw + 3 * gx)) / 2;
      DATA.CARD_IDS.forEach((id, i) => {
        const x = x0 + (i % 4) * (cw + gx), y = 22 + Math.floor(i / 4) * (ch + 7);
        const have = !!flags.cards[id];
        ctx = spCtx;
        rect(x, y, cw, ch, have ? "#f0d890" : "#5a5a7a");
        rect(x + 2, y + 2, cw - 4, 24, have ? "#4aa3df" : "#2b2b45");
        if (have) cardArt(id, x + cw / 2, y + 14);
        ctx = bgCtx;
        if (have) txt(T.cards[id], x + cw / 2, y + 31, 4, UI.ink, "center");
        else { txt("?", x + cw / 2, y + 9, 8, UI.dim, "center"); txt("???", x + cw / 2, y + 31, 4, UI.night, "center"); }
      });
      txt(fmt(T.cardsNote, { n: cardCount() }), W / 2, 172, 4, UI.dim, "center");
    }
    txt(T.menuHelp, W / 2, 182, 4, UI.dim, "center");
  }

  function nearest(r, g, b) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < PAL_RGB.length; i++) {
      const [R, G, B] = PAL_RGB[i];
      const d = (r - R) ** 2 * 0.3 + (g - G) ** 2 * 0.59 + (b - B) ** 2 * 0.11;
      if (d < bd) { bd = d; best = i; }
    }
    return PAL_RGB[best];
  }
  const nearestCache = new Map();
  function quantize(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    let c = nearestCache.get(key);
    if (!c) { c = nearest(r, g, b); if (nearestCache.size < 50000) nearestCache.set(key, c); }
    return c;
  }

  function present(ox, oy) {
    const bg = bgCtx.getImageData(0, 0, W, H), sp = spCtx.getImageData(0, 0, W, H);
    const b = bg.data, s = sp.data;
    const put = (i, c) => { b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = 255; };
    for (let i = 0; i < b.length; i += 4) put(i, quantize(b[i], b[i + 1], b[i + 2]));
    const solid = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) if (s[p * 4 + 3] >= 128) solid[p] = 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = y * W + x, i = p * 4;
      if (solid[p]) put(i, quantize(s[i], s[i + 1], s[i + 2]));
      else if ((x > 0 && solid[p - 1]) || (x < W - 1 && solid[p + 1]) || (y > 0 && solid[p - W]) || (y < H - 1 && solid[p + W])) put(i, INK);
    }
    bgCtx.putImageData(bg, 0, 0);
    display.imageSmoothingEnabled = false;
    display.fillStyle = UI.ink;
    display.fillRect(0, 0, canvas.width, canvas.height);
    display.drawImage(bgLayer, ox * SCALE, oy * SCALE, W * SCALE, H * SCALE);
    display.textBaseline = "top";
    for (const t of texts) {
      display.font = `${t.size * SCALE}px ${FONT}`;
      display.textAlign = t.align;
      const x = Math.round((t.x + ox) * SCALE), y = Math.round((t.y + oy) * SCALE);
      if (t.color !== UI.ink) { display.fillStyle = UI.ink; display.fillText(t.str, x + 2, y + 2); }
      display.fillStyle = t.color;
      display.fillText(t.str, x, y);
    }
  }

  function draw() {
    texts.length = 0;
    bgCtx.clearRect(0, 0, W, H);
    spCtx.clearRect(0, 0, W, H);
    ctx = bgCtx;
    let ox = 0, oy = 0;
    if (state === "intro") drawIntro();
    else if (state === "title") drawTitle();
    else if (state === "end") drawEnd();
    else if (state === "menu") drawMenu();
    else {
      if (shake > 0) { ox = Math.round((Math.random() - 0.5) * 3); oy = Math.round((Math.random() - 0.5) * 3); }
      drawWorld();
      if (dialog) drawDialog();
    }
    present(ox, oy);
  }

  // ─── Boucle ───
  let last = performance.now(), acc = 0;
  const STEP = 1000 / 60;
  function loop(now) {
    acc += Math.min(100, now - last);
    last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Pour les tests automatiques seulement.
  window.__dipduckAdventure = {
    get state() { return state; }, get cur() { return cur; }, get dialog() { return dialog; },
    get enemies() { return enemies; }, get chests() { return chests; }, get blocks() { return blocks; },
    get tiles() { return tiles; }, get npcs() { return npcs; }, introAt(t) { state = "intro"; introT = t; }, unlockForTests() { unlocked = true; }, player, flags: () => flags, enter, tilePos, SCREENS,
  };
})();

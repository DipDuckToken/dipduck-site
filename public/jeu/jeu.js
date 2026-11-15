// Dip Duck — prototype jouable v2 : grand monde en marche libre (vue isométrique).
// Dessins : ../art/generateur.js (window.DD). Monde généré à partir d'une graine fixe (toujours le même).
(() => {
  "use strict";
  const DD = window.DD;
  const AUDIO = window.AUDIO || { sfx() {}, setTrack() {}, toggle() { return false; }, on: false };
  const canvas = document.getElementById("jeu");
  const ctx = canvas.getContext("2d");
  let N = 112;
  const toScreen = (i, j) => [(i - j) * 64, (i + j) * 32];
  const toTile = (x, y) => { const a = x / 64, b = y / 32; return [(a + b) / 2, (b - a) / 2]; };
  let rs = 12345; const rnd = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
  const SEASONS = ["ete", "automne", "hiver", "nuit"];
  const SEASON_NAME = { ete: "été", automne: "automne", hiver: "hiver", nuit: "nuit" };
  let season = "ete";
  let cur = null; // scène affichée (monde, intérieur, grotte)

  // ─── Bruit (forêts, marais, relief) ───
  function hash(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
  function vnoise(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
  const noise = (x, y, s) => vnoise(x / 14, y / 14, s) * .65 + vnoise(x / 5, y / 5, s + 7) * .35;

  // ─── Monde ───
  let G = new Array(N * N).fill("herbe");
  let TAG = new Array(N * N).fill("");
  const id = (i, j) => i * N + j;
  const inMap = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
  const isWater = (i, j) => !inMap(i, j) || G[id(i, j)] === "eau" || G[id(i, j)] === "nenuphar" || G[id(i, j)] === "vide";
  const TOWNS = [
    { id: "village", name: "Village de l'Étang", i: 56, j: 58, r: 10 },
    { id: "hameau", name: "Hameau du Moulin", i: 24, j: 82, r: 7 },
    { id: "port", name: "Port du Lac", i: 86, j: 44, r: 6 },
    { id: "camp", name: "Campement des Bois", i: 30, j: 32, r: 4 },
    { id: "ruines", name: "Ruines du Calme", i: 94, j: 92, r: 7 },
  ];
  const town = (k) => TOWNS.find((t) => t.id === k);
  const distT = (i, j, t) => Math.hypot(i - t.i, j - t.j);
  const RIVER = [[58, 4], [54, 16], [60, 28], [72, 34], [82, 30]];
  function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const k = id(i, j), n1 = noise(i, j, 3), n2 = noise(i, j, 11);
    let t = "herbe", tag = "";
    if ((j < 6 + n2 * 6 && i < 52) || i < 4 + n2 * 4) { t = "gravier"; tag = "montagne"; }
    if (((i - 92) / 13) ** 2 + ((j - 24) / 9) ** 2 < 1 + (n1 - .5) * .5) { t = hash(i, j, 5) < .12 ? "nenuphar" : "eau"; tag = "eau"; }
    let rd = 99; for (let s = 0; s < RIVER.length - 1; s++) rd = Math.min(rd, segDist(i, j, ...RIVER[s], ...RIVER[s + 1]));
    if (rd < 1.1 + (n2 - .5)) { t = "eau"; tag = "eau"; }
    const sw = Math.hypot(i - 20, j - 102);
    if (sw < 11 + n1 * 3 && tag !== "eau") { t = n1 > .63 ? "eau" : "boue"; tag = t === "eau" ? "eau" : "marais"; }
    if (!tag && (n1 > .58 || Math.hypot(i - 30, j - 32) < 14 + n2 * 4)) { t = "foret"; tag = "foret"; }
    if (!tag && hash(i, j, 9) < .08) t = "fleurs";
    G[k] = t; TAG[k] = tag;
  }
  for (const [i0, j0, i1, j1, t] of [[14, 70, 22, 77, "ble"], [28, 88, 35, 95, "ble"], [16, 88, 21, 92, "potager"], [48, 72, 56, 78, "ble"], [62, 72, 66, 76, "potager"], [70, 60, 77, 66, "ble"]])
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (TAG[id(i, j)] !== "eau") { G[id(i, j)] = t; TAG[id(i, j)] = "champ"; }
  for (const tw of TOWNS) for (let i = tw.i - tw.r; i <= tw.i + tw.r; i++) for (let j = tw.j - tw.r; j <= tw.j + tw.r; j++) {
    if (!inMap(i, j) || TAG[id(i, j)] === "eau") continue;
    const d = distT(i, j, tw);
    if (d <= tw.r) { TAG[id(i, j)] = "ville"; G[id(i, j)] = d < tw.r * .38 ? (tw.id === "ruines" ? "pierre" : "paves") : (tw.id === "ruines" ? "gravier" : hash(i, j, 4) < .1 ? "fleurs" : "herbe"); }
  }
  function road(a, b) {
    let i = a.i, j = a.j, guard = 0;
    while ((i !== b.i || j !== b.j) && guard++ < 600) {
      const di = Math.sign(b.i - i), dj = Math.sign(b.j - j), r = hash(i, j, 99);
      if (di && (!dj || r < .5 + (Math.abs(b.i - i) - Math.abs(b.j - j)) * .04)) i += di; else j += dj;
      const k = id(i, j);
      if (G[k] === "eau" || G[k] === "nenuphar") G[k] = "pont";
      else if (TAG[k] === "ville") G[k] = G[k] === "pierre" || G[k] === "gravier" ? G[k] : "paves";
      else G[k] = "terre";
      if (TAG[k] !== "ville") TAG[k] = "route";
    }
  }
  road(town("village"), town("hameau")); road(town("village"), town("port")); road(town("village"), town("camp"));
  road(town("village"), town("ruines")); road(town("hameau"), { i: 22, j: 96 }); road(town("camp"), { i: 52, j: 12 }); road({ i: 52, j: 12 }, { i: 52, j: 2 }); road(town("hameau"), { i: 2, j: 72 }); road(town("port"), { i: 110, j: 50 });

  // ─── Objets et formes de collision ───
  // type : [largeur, hauteur, ancre x, ancre y, dessin, forme] ; forme ["c", rayon] ou ["r", demi-largeur i, demi-largeur j]
  const PROPS = {
    maison: [380, 380, 190, 300, (c, x, y) => DD.maison(c, x, y), ["r", .78, .74]],
    taverne: [380, 360, 190, 290, (c, x, y) => DD.taverne(c, x, y), ["r", .8, .65]],
    boulangerie: [360, 360, 180, 290, (c, x, y) => DD.boulangerie(c, x, y), ["r", .7, .6]],
    chapelle: [380, 440, 190, 360, (c, x, y) => DD.chapelle(c, x, y), ["r", .8, .55]],
    ecole: [440, 360, 220, 280, (c, x, y) => DD.ecole(c, x, y), ["r", 1, .55]],
    grange: [380, 360, 190, 290, (c, x, y) => DD.grange(c, x, y), ["r", .75, .6]],
    moulin: [260, 300, 130, 262, (c, x, y) => DD.moulin(c, x, y), ["c", .45]],
    cabanePecheur: [270, 250, 120, 175, (c, x, y) => DD.cabanePecheur(c, x, y), ["c", .5]],
    voilier: [180, 200, 90, 160, (c, x, y) => DD.voilier(c, x, y), null],
    barque: [170, 90, 85, 55, (c, x, y) => DD.barque(c, x, y), null],
    etal: [320, 280, 160, 210, (c, x, y) => DD.etal(c, x, y), ["r", .7, .4]],
    puits: [200, 230, 100, 200, (c, x, y) => DD.puits(c, x, y), ["c", .45]],
    fontaine: [220, 200, 110, 170, (c, x, y) => DD.fontaine(c, x, y), ["c", .58]],
    arbre: [230, 260, 115, 235, (c, x, y) => DD.arbre(c, x, y), ["c", .3]],
    arbre2: [230, 260, 115, 235, (c, x, y) => DD.arbre(c, x, y, .85), ["c", .27]],
    erable: [230, 260, 115, 235, (c, x, y) => (season === "automne" ? DD.erable(c, x, y) : DD.arbre(c, x, y, .95)), ["c", .3]],
    sapin: [150, 200, 75, 180, (c, x, y) => DD.sapin(c, x, y), ["c", .25]],
    bouleau: [150, 220, 75, 200, (c, x, y) => DD.bouleau(c, x, y), ["c", .18]],
    fougere: [170, 120, 85, 100, (c, x, y) => DD.fougere(c, x, y), null],
    buisson: [130, 100, 65, 85, (c, x, y) => DD.buisson(c, x, y), ["c", .32]],
    baies: [130, 100, 65, 85, (c, x, y) => DD.buissonBaies(c, x, y), ["c", .32]],
    rocher: [130, 90, 65, 75, (c, x, y) => DD.rocher(c, x, y, .9), ["c", .36]],
    pilier: [110, 170, 55, 150, (c, x, y) => DD.pilier(c, x, y, .9), ["c", .34]],
    montagne: [320, 250, 160, 228, (c, x, y) => DD.montagne(c, x, y, .8), ["c", 1.45]],
    souche: [100, 80, 50, 65, (c, x, y) => DD.souche(c, x, y), ["c", .22]],
    champiMaison: [170, 210, 85, 185, (c, x, y) => DD.champiMaison(c, x, y), ["c", .38]],
    tente: [170, 150, 85, 115, (c, x, y) => DD.tente(c, x, y), ["c", .55]],
    feuCamp: [150, 150, 75, 115, (c, x, y) => DD.feuCamp(c, x, y), ["c", .38]],
    meule: [110, 100, 55, 85, (c, x, y) => DD.meuleFoin(c, x, y), ["c", .33]],
    epouvantail: [100, 140, 50, 125, (c, x, y) => DD.epouvantail(c, x, y), ["c", .14]],
    lanterne: [130, 150, 65, 130, (c, x, y) => DD.lanterne(c, x, y), ["c", .12]],
    banc: [110, 80, 55, 62, (c, x, y) => DD.banc(c, x, y), ["c", .2]],
    pots: [100, 80, 50, 66, (c, x, y) => DD.potsFleurs(c, x, y), ["c", .18]],
    panneau: [170, 120, 85, 105, (c, x, y) => DD.panneau(c, x, y), ["c", .1]],
    fleurs: [90, 60, 45, 50, (c, x, y) => (season === "hiver" ? 0 : DD.fleursTouffe(c, x, y)), null],
    herbes: [90, 60, 45, 50, (c, x, y) => DD.hautesHerbes(c, x, y), null],
    roseaux: [90, 90, 45, 80, (c, x, y) => DD.roseaux(c, x, y), null],
    tonneau: [80, 70, 40, 60, (c, x, y) => DD.tonneau(c, x, y), ["c", .18]],
    caisse: [90, 70, 45, 60, (c, x, y) => DD.caisse(c, x, y), ["c", .2]],
    champignons: [80, 60, 40, 50, (c, x, y) => DD.champignons(c, x, y), null],
    tasBois: [100, 90, 50, 75, (c, x, y) => DD.tasBois(c, x, y), ["c", .3]],
    ruche: [80, 100, 40, 85, (c, x, y) => DD.ruche(c, x, y), ["c", .15]],
    coffre: [100, 80, 50, 62, (c, x, y) => DD.coffre(c, x, y), ["c", .25]],
    lit: [170, 150, 85, 110, (c, x, y) => DD.M.lit(c, x, y), ["r", .47, .3]],
    table: [110, 100, 55, 70, (c, x, y) => DD.M.table(c, x, y), ["c", .3]],
    chaise: [70, 80, 35, 60, (c, x, y) => DD.M.chaise(c, x, y), ["c", .14]],
    cheminee: [130, 190, 65, 150, (c, x, y) => DD.M.cheminee(c, x, y), ["r", .25, .48]],
    etagere: [110, 200, 55, 165, (c, x, y) => DD.M.etagere(c, x, y), ["r", .16, .42]],
    etagerePain: [110, 180, 55, 150, (c, x, y) => DD.M.etagerePain(c, x, y), ["r", .16, .42]],
    tapis: [210, 110, 105, 55, (c, x, y) => DD.M.tapis(c, x, y), null],
    paillasson: [90, 50, 45, 25, (c, x, y) => DD.M.paillasson(c, x, y), null],
    comptoir: [240, 150, 120, 95, (c, x, y) => DD.M.comptoir(c, x, y), ["r", .82, .22]],
    comptoirPain: [240, 150, 120, 95, (c, x, y) => DD.M.comptoirPain(c, x, y), ["r", .82, .22]],
    four: [140, 150, 70, 110, (c, x, y) => DD.M.four(c, x, y), ["c", .45]],
    sac: [50, 60, 25, 45, (c, x, y) => DD.M.sac(c, x, y), ["c", .15]],
    pupitre: [70, 90, 35, 70, (c, x, y) => DD.M.pupitre(c, x, y), ["c", .15]],
    cierges: [60, 90, 30, 70, (c, x, y) => DD.M.cierges(c, x, y), ["c", .15]],
    bancEglise: [150, 110, 75, 75, (c, x, y) => DD.M.bancEglise(c, x, y), ["r", .47, .22]],
    pupitreEcole: [80, 80, 40, 55, (c, x, y) => DD.M.pupitreEcole(c, x, y), ["r", .22, .17]],
    tableau: [190, 180, 95, 140, (c, x, y) => DD.M.tableau(c, x, y), ["r", .06, .6]],
    mur: [132, 116, 66, 80, (c, x, y) => DD.M.mur(c, x, y), ["r", .5, .5]],
    bloc: [120, 130, 60, 92, (c, x, y) => DD.M.bloc(c, x, y), ["r", .46, .46]],
    plaque: [100, 56, 50, 28, (c, x, y) => DD.M.plaque(c, x, y), null],
    plaqueOn: [100, 56, 50, 28, (c, x, y) => DD.M.plaqueOn(c, x, y), null],
    grille: [140, 170, 70, 120, (c, x, y) => DD.M.grille(c, x, y), ["r", .5, .1]],
    porteBois: [140, 170, 70, 120, (c, x, y) => DD.M.porteBois(c, x, y), ["r", .12, .5]],
    brasero: [70, 100, 35, 85, (c, x, y) => DD.M.brasero(c, x, y), ["c", .15]],
    grotte: [240, 200, 120, 160, (c, x, y) => DD.M.grotte(c, x, y), ["c", .9]],
    archeForet: [170, 180, 85, 140, (c, x, y) => { DD.M.archeTexte = "FORÊT PROFONDE"; DD.M.arche(c, x, y); }, null],
    archeVal: [170, 180, 85, 140, (c, x, y) => { DD.M.archeTexte = "VAL DE L'ÉTANG"; DD.M.arche(c, x, y); }, null],
    poteau: [44, 90, 22, 74, (c, x, y) => DD.M.poteau(c, x, y), ["c", .16]],
    temple: [340, 300, 170, 232, (c, x, y) => DD.M.temple(c, x, y), ["r", 1.1, .8]],
    murMousse: [132, 116, 66, 80, (c, x, y) => { DD.M.mur(c, x, y); for (let k = 0; k < 4; k++) DD.ell(c, x - 40 + k * 26, y - 44 - (k % 2) * 8 - 10, 10, 4, k % 2 ? "rgba(90,150,60,.9)" : "rgba(120,180,70,.85)"); }, ["r", .5, .5]],
    porteBoisI: [140, 170, 70, 120, (c, x, y) => DD.M.porteBoisI(c, x, y), ["r", .5, .12]],
    archeMonts: [170, 180, 85, 140, (c, x, y) => { DD.M.archeTexte = "MONTS DU VENT"; DD.M.arche(c, x, y); }, null],
    archeVal2: [170, 180, 85, 140, (c, x, y) => { DD.M.archeTexte = "VAL DE L'ÉTANG"; DD.M.arche(c, x, y); }, null],
    tourVent: [200, 360, 100, 300, (c, x, y) => DD.M.tourVent(c, x, y), ["c", .75]],
    glaceFendue: [120, 130, 60, 92, (c, x, y) => DD.M.glaceFendue(c, x, y), ["r", .5, .5]],
    murNeige: [132, 116, 66, 80, (c, x, y) => DD.M.murNeige(c, x, y), ["r", .5, .5]],
    murPhare: [132, 116, 66, 80, (c, x, y) => DD.M.murPhare(c, x, y), ["r", .5, .5]],
    archeCote: [170, 180, 85, 140, (c, x, y) => { DD.M.archeTexte = "CÔTE AUX PHARES"; DD.M.arche(c, x, y); }, null],
    archeVal3: [170, 180, 85, 140, (c, x, y) => { DD.M.archeTexte = "VAL DE L'ÉTANG"; DD.M.arche(c, x, y); }, null],
    phare: [220, 380, 110, 330, (c, x, y) => DD.phare(c, x, y), ["c", .7]],
    phareEteint: [220, 380, 110, 330, (c, x, y) => { DD.phare(c, x, y); DD.poly(c, [[x - 20, y - 270], [x + 20, y - 270], [x + 20, y - 234], [x - 20, y - 234]], "#2e2b36", "#16141c", 3); DD.line(c, x, y - 270, x, y - 234, "#16141c", 2); }, ["c", .7]],
  };
  const FLAT = new Set(["tapis", "paillasson", "plaque", "plaqueOn"]);
  const VEG = new Set(["arbre", "arbre2", "erable", "sapin", "bouleau", "buisson", "baies", "fougere", "herbes", "roseaux", "pilier"]);
  const BIG = new Set(["maison", "taverne", "boulangerie", "chapelle", "ecole", "grange"]);
  let props = [], propGrid = new Map(), shapeGrid = new Map(), occ = new Uint8Array(N * N);
  const gridAdd = (m, i, j, v) => { const k = id(i, j); if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  function place(type, i, j) {
    const def = PROPS[type], v = Math.floor(hash(Math.round(i * 10), Math.round(j * 10), 21) * 3);
    const p = { type, i, j, v, key: FLAT.has(type) ? i + j - 6 : i + j, cells: [] };
    props.push(p); gridAdd(propGrid, Math.round(i), Math.round(j), p);
    const sh = def[5];
    if (sh) {
      const s = sh[0] === "c" ? { t: "c", i, j, r: sh[1] } : { t: "r", i0: i - sh[1], i1: i + sh[1], j0: j - sh[2], j1: j + sh[2] }; p.shape = s; s.prop = p; if (type === "poteau") s.thin = true;
      const ext = sh[0] === "c" ? sh[1] : Math.max(sh[1], sh[2]);
      for (let a = Math.floor(i - ext - .5); a <= Math.ceil(i + ext + .5); a++) for (let b = Math.floor(j - ext - .5); b <= Math.ceil(j + ext + .5); b++) if (inMap(a, b)) { gridAdd(shapeGrid, a, b, s); occ[id(a, b)] = 1; p.cells.push(id(a, b)); }
    }
    occ[id(Math.round(i), Math.round(j))] = 1;
    return p;
  }
  const freeCell = (i, j, rad = 0) => { for (let a = i - rad; a <= i + rad; a++) for (let b = j - rad; b <= j + rad; b++) { if (!inMap(a, b) || occ[id(a, b)] || isWater(a, b) || TAG[id(a, b)] === "route" || ["terre", "paves", "pont"].includes(G[id(a, b)])) return false; } return true; };

  // villes : bâtiments en anneau autour de la place
  const TOWN_BUILD = {
    village: ["maison", "taverne", "boulangerie", "chapelle", "ecole", "maison", "etal", "maison", "taverne", "etal", "puits", "maison"],
    hameau: ["moulin", "grange", "maison", "boulangerie", "puits", "grange"],
    port: ["cabanePecheur", "maison", "taverne", "etal", "cabanePecheur"],
    camp: ["tente", "tente", "feuCamp", "tasBois", "tente"],
    ruines: [],
  };
  for (const tw of TOWNS) {
    if (tw.id !== "ruines" && tw.id !== "camp") place("fontaine", tw.i, tw.j);
    const list = TOWN_BUILD[tw.id];
    let n = 0;
    for (let ring = 0; ring < 3 && n < list.length; ring++) for (let a = 0; a < 16 && n < list.length; a++) {
      const ang = a / 16 * Math.PI * 2 + ring * .4, d = tw.r * (.5 + ring * .18);
      const ci = Math.round(tw.i + Math.cos(ang) * d), cj = Math.round(tw.j + Math.sin(ang) * d), big = BIG.has(list[n]);
      if (!freeCell(ci, cj, big ? 1 : 0)) continue;
      place(list[n], big ? ci + .5 : ci, big ? cj + .5 : cj); n++;
    }
    if (tw.id !== "ruines") for (let a = 0; a < 6; a++) { const ang = a / 6 * Math.PI * 2 + .3, ci = Math.round(tw.i + Math.cos(ang) * tw.r * .34), cj = Math.round(tw.j + Math.sin(ang) * tw.r * .34); if (!occ[id(ci, cj)] && G[id(ci, cj)] !== "terre") place(a % 2 ? "lanterne" : ["banc", "pots", "tonneau"][a % 3], ci + .3, cj + .3); }
  }
  { const r = town("ruines"); for (let a = 0; a < 12; a++) { if (a % 4 === 1) continue; const ang = a / 12 * Math.PI * 2; place(a % 3 ? "pilier" : "rocher", r.i + Math.cos(ang) * 4.2, r.j + Math.sin(ang) * 4.2); } place("coffre", r.i, r.j - .5); }
  for (const [i, j] of [[90, 30], [96, 22], [84, 26]]) place(hash(i, j, 3) < .5 ? "voilier" : "barque", i, j);
  // nature
  for (let i = 1; i < N - 1; i++) for (let j = 1; j < N - 1; j++) {
    const k = id(i, j), tag = TAG[k], h = hash(i, j, 77);
    if (occ[k] || isWater(i, j) || tag === "route" || tag === "ville" || G[k] === "pont") continue;
    if (tag === "montagne") { if (i % 3 === 0 && j % 3 === 0 && freeCell(i, j, 1)) place("montagne", i + (h - .5) * .6, j + (hash(i, j, 3) - .5) * .6); else if (h < .08) place("rocher", i, j); continue; }
    if (tag === "foret") { if (h < .42) place(["sapin", "arbre", "bouleau", "arbre2", "sapin"][Math.floor(hash(i, j, 8) * 5)], i + (hash(i, j, 2) - .5) * .5, j + (hash(i, j, 6) - .5) * .5); else if (h < .5) place(["fougere", "baies", "souche", "champignons", "fougere"][Math.floor(hash(i, j, 8) * 5)], i, j); continue; }
    if (tag === "marais") { if (h < .2) place("roseaux", i, j); else if (h < .25) place("arbre2", i, j); else if (h < .28) place("champignons", i, j); continue; }
    if (tag === "champ") { if (h < .015) place("epouvantail", i, j); else if (h < .03) place("meule", i, j); continue; }
    if (h < .025) place(["arbre", "erable", "buisson", "rocher"][Math.floor(hash(i, j, 8) * 4)], i, j);
    else if (h < .06) place(["fleurs", "herbes", "fleurs"][Math.floor(hash(i, j, 8) * 3)], i, j);
  }
  for (const [i, j] of [[13, 72], [13, 76], [23, 69], [36, 87]]) if (freeCell(i, j)) place("ruche", i, j);
  // bord du monde
  for (let k = 0; k < N; k++) for (const [i, j] of [[k, 0], [0, k], [k, N - 1], [N - 1, k]]) gridAdd(shapeGrid, i, j, { t: "r", i0: i - .5, i1: i + .5, j0: j - .5, j1: j + .5 });

  // ─── Collisions : cercle du personnage contre les formes, l'eau et les autres êtres ───
  let beingsSolid = [];
  function hitShape(s, i, j, r) {
    if (s.t === "c") return (s.i - i) ** 2 + (s.j - j) ** 2 < (s.r + r) ** 2;
    const dx = Math.max(s.i0 - i, 0, i - s.i1), dy = Math.max(s.j0 - j, 0, j - s.j1); return dx * dx + dy * dy < r * r;
  }
  function collides(i, j, r, self) {
    if (cur && cur.inside ? (i - r < -.45 || j - r < -.45 || i + r > N - .55 || j + r > N - .55) : (i < .6 || j < .6 || i > N - 1.6 || j > N - 1.6)) return true;
    const ci = Math.round(i), cj = Math.round(j);
    for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) {
      if (isWater(a, b)) { const dx = Math.max(a - .5 - i, 0, i - a - .5), dy = Math.max(b - .5 - j, 0, j - b - .5); if (dx * dx + dy * dy < (r * .7) ** 2) return true; }
      const list = shapeGrid.get(id(a, b)); if (list) for (const s of list) if (hitShape(s, i, j, r)) return true;
    }
    // êtres vivants (et Dip Duck pour les autres) : on bloque seulement si le pas rapproche ;
    // s'ils se chevauchent déjà, on peut toujours s'éloigner (jamais coincé).
    const others = self && self !== duck ? [...beingsSolid, duck] : beingsSolid;
    for (const n of others) {
      if (n === self) continue;
      const lim = (r + n.r) ** 2, dNew = (n.i - i) ** 2 + (n.j - j) ** 2;
      if (dNew >= lim) continue;
      if (self && dNew > (n.i - self.i) ** 2 + (n.j - self.j) ** 2) continue;
      return true;
    }
    return false;
  }
  function moveBody(b, di, dj, r) {
    if (!collides(b.i + di, b.j + dj, r, b)) { b.i += di; b.j += dj; return true; }
    let moved = false;
    if (!collides(b.i + di, b.j, r, b)) { b.i += di; moved = true; }
    if (!collides(b.i, b.j + dj, r, b)) { b.j += dj; moved = true; }
    return moved;
  }

  // ─── Êtres vivants ───
  const ANIMS = {
    idle: (k) => ({ sx: 1 + Math.sin(k / 4 * 6.283) * .03, sy: 1 - Math.sin(k / 4 * 6.283) * .045, rot: 0, dy: 0 }),
    walk: (k) => ({ sx: 1, sy: 1, rot: Math.sin(k / 4 * 6.283) * .08, dy: -Math.abs(Math.sin(k / 4 * 6.283)) * 5 }),
    hop: (k) => ({ sx: [1, 1.1, .92, 1][k], sy: [1, .88, 1.1, 1][k], rot: 0, dy: [0, 0, -14, -5][k] }),
    float: (k) => ({ sx: 1, sy: 1, rot: Math.sin(k / 4 * 6.283) * .05, dy: -8 - Math.sin(k / 4 * 6.283) * 7 }),
    peck: (k) => ({ sx: 1, sy: 1, rot: [0, .25, .5, .2][k], dy: 0 }),
  };
  const BEINGS = {
    grenouille: (c, x, y) => DD.grenouille(c, x, y), castor: (c, x, y) => DD.castor(c, x, y), crapaude: (c, x, y) => DD.crapaude(c, x, y), goeland: (c, x, y) => DD.goeland(c, x, y),
    mouton: (c, x, y) => DD.mouton(c, x, y), poule: (c, x, y) => DD.poule(c, x, y), vache: (c, x, y) => DD.vache(c, x, y), cochon: (c, x, y) => DD.cochon(c, x, y),
    cheval: (c, x, y) => DD.cheval(c, x, y), lapin: (c, x, y) => DD.lapin(c, x, y), cerf: (c, x, y) => DD.cerf(c, x, y), renard: (c, x, y) => DD.renard(c, x, y), ecureuil: (c, x, y) => DD.ecureuil(c, x, y),
    hibou: (c, x, y) => DD.hibou(c, x, y), follet: (c, x, y) => DD.M.follet(c, x, y), tourbillon: (c, x, y) => DD.M.tourbillon(c, x, y),
    golemCire: (c, x, y) => { c.save(); c.translate(x, y); c.scale(1.7, 1.7); c.filter = "sepia(.6) saturate(1.4) hue-rotate(-15deg)"; DD.golemFumee(c, 0, 0); c.restore(); },
    grandFollet: (c, x, y) => { c.save(); c.translate(x, y); c.scale(2.1, 2.1); DD.M.follet(c, 0, 0); c.restore(); },
    roiTourbillon: (c, x, y) => { c.save(); c.translate(x, y); c.scale(2.1, 2.1); DD.M.tourbillon(c, 0, 0); c.restore(); DD.poly(c, [[x - 18, y - 150], [x - 12, y - 168], [x - 4, y - 154], [x + 4, y - 172], [x + 12, y - 154], [x + 18, y - 168], [x + 22, y - 148]], "#ffd23f", "#8a6a10", 2); },
    bougieNoire: (c, x, y) => { c.save(); c.translate(x, y); c.scale(2.3, 2.3); c.filter = "brightness(.32) saturate(.4)"; DD.bougie(c, 0, 0, "attaque"); c.restore(); DD.ell(c, x, y - 150, 30, 30, "rgba(160,40,255,.35)"); DD.ell(c, x - 12, y - 70, 5, 5, "#ff3a3a"); DD.ell(c, x + 12, y - 70, 5, 5, "#ff3a3a"); },
    chevre: (c, x, y) => DD.chevre(c, x, y),
    bougie: (c, x, y) => DD.bougie(c, x, y), grandeBougie: (c, x, y) => { c.save(); c.translate(x, y); c.scale(1.8, 1.8); DD.bougie(c, 0, 0, "attaque"); c.restore(); },
    caneton: (c, x, y) => { c.save(); c.translate(x, y); c.scale(.55, .55); DD.canard(c, 0, 0, "face", ""); c.restore(); },
  };
  const V = town("village"), P = town("port"), H = town("hameau");
  let npcs = [
    { kind: "grenouille", i: V.i + 2.5, j: V.j - 2.5, name: "Grand-père Grenouille", r: .32 },
    { kind: "crapaude", i: V.i - 3, j: V.j + 2.4, name: "Madame Crapaude", r: .32 },
    { kind: "castor", i: H.i + 2, j: H.j - 2.6, name: "Le Castor", r: .32 },
    { kind: "goeland", i: P.i - 2, j: P.j + 2.2, name: "Goéland", r: .3 },
  ];
  // dégager la place des habitants
  for (const n of npcs) { const k = id(Math.round(n.i), Math.round(n.j)); const s = shapeGrid.get(k); if (s) shapeGrid.set(k, s.filter((x) => !(x.t === "c" && Math.hypot(x.i - n.i, x.j - n.j) < .9))); }
  beingsSolid.push(...npcs);
  let animals = [];
  function spawnAnimals(kind, anim, n, region, speed) {
    for (let t = 0, made = 0; t < 4000 && made < n; t++) {
      const i = 2 + Math.floor(rnd() * (N - 4)), j = 2 + Math.floor(rnd() * (N - 4));
      if (TAG[id(i, j)] !== region || occ[id(i, j)] || isWater(i, j) || collides(i, j, .3)) continue;
      animals.push({ kind, anim, i, j, hi: i, hj: j, ti: i, tj: j, wait: rnd() * 3, flip: false, phase: rnd() * 4, speed, r: .26 }); made++;
    }
  }
  spawnAnimals("mouton", "walk", 10, "", .6); spawnAnimals("vache", "walk", 5, "", .5); spawnAnimals("cheval", "walk", 3, "", .9);
  spawnAnimals("poule", "peck", 10, "champ", .7); spawnAnimals("cochon", "walk", 4, "champ", .6);
  spawnAnimals("lapin", "hop", 10, "foret", 1.4); spawnAnimals("cerf", "walk", 5, "foret", .8); spawnAnimals("renard", "walk", 4, "foret", 1.1); spawnAnimals("ecureuil", "hop", 6, "foret", 1.2);
  beingsSolid.push(...animals);
  let candles = [];
  function spawnCandles(n, region) {
    for (let t = 0, made = 0; t < 6000 && made < n; t++) {
      const i = 2 + Math.floor(rnd() * (N - 4)), j = 2 + Math.floor(rnd() * (N - 4));
      if ((region !== null && TAG[id(i, j)] !== region) || occ[id(i, j)] || isWater(i, j) || Math.hypot(i - V.i, j - V.j) < 13 || collides(i, j, .3)) continue;
      candles.push({ i, j, home: [i, j], ti: i, tj: j, phase: rnd() * 4, alive: true, r: .26, id: candles.length }); made++;
    }
  }
  spawnCandles(14, "champ"); spawnCandles(10, ""); spawnCandles(6, "marais"); spawnCandles(6, "foret");
  const R0 = town("ruines");
  const boss = { kind: "grandeBougie", i: R0.i, j: R0.j + 1.5, hp: 6, alive: true, r: .5, hurt: 0, phase: 0 };
  let items = [];
  function scatter(kind, n, test) { for (let t = 0, made = 0; t < 20000 && made < n; t++) { const i = 2 + Math.floor(hash(t, made, kind.length * 13) * (N - 4)), j = 2 + Math.floor(hash(made, t, kind.length * 31) * (N - 4)); if (occ[id(i, j)] || isWater(i, j) || !test(TAG[id(i, j)]) || collides(i, j, .3)) continue; occ[id(i, j)] = 1; items.push({ kind, i, j, got: false, id: kind + made }); made++; } }
  scatter("plume", 40, (tag) => tag !== "ville");
  scatter("champi", 12, (tag) => tag === "foret" || tag === "marais");
  // canetons : on choisit une case libre près de chaque lieu prévu
  const ducklings = [];
  for (const [ti, tj, where] of [[33, 22, "forêt"], [19, 104, "marais"], [50, 10, "montagnes"]]) {
    let best = null; for (let rr = 0; rr < 8 && !best; rr++) for (let a = -rr; a <= rr && !best; a++) for (let b = -rr; b <= rr && !best; b++) { const i = ti + a, j = tj + b; if (inMap(i, j) && !isWater(i, j) && !collides(i, j, .35)) best = [i, j]; }
    ducklings.push({ kind: "caneton", i: best[0], j: best[1], where, got: false, id: "caneton" + ducklings.length });
  }

  // ─── Scènes : le monde, les intérieurs, la Grotte des Échos ───
  const WORLD = { id: "monde", name: null, N, G, TAG, props, propGrid, shapeGrid, occ, npcs, animals, candles, items, beingsSolid, inside: false, ret: null };
  cur = WORLD;
  function setScene(sc) { cur = sc; ({ N, G, TAG, props, propGrid, shapeGrid, occ, npcs, animals, candles, items, beingsSolid } = sc); }
  const FROG = npcs[0], CRAPAUDE = npcs[1];
  function removeProp(p) {
    const k = props.indexOf(p); if (k >= 0) props.splice(k, 1);
    const g = propGrid.get(id(Math.round(p.i), Math.round(p.j))); if (g && g.includes(p)) g.splice(g.indexOf(p), 1);
    if (p.shape) for (const c of p.cells) { const l = shapeGrid.get(c); if (l && l.includes(p.shape)) l.splice(l.indexOf(p.shape), 1); }
  }
  // portes des bâtiments (devant la porte dessinée)
  const DOORS = { maison: [.1, 1.12], taverne: [1.17, .02], boulangerie: [.32, 1.02], chapelle: [1.17, 0], ecole: [1.37, 0], grange: [1.12, 0] };
  const doorsList = [];
  for (const p of props) if (DOORS[p.type]) { const d = { i: p.i + DOORS[p.type][0], j: p.j + DOORS[p.type][1] }; if (!collides(d.i, d.j, .3)) { p.door = d; doorsList.push(p); } }
  // entrée de la grotte, au pied des montagnes
  let caveSpot = null;
  for (let rr = 0; rr < 14 && !caveSpot; rr++) for (let a = -rr; a <= rr && !caveSpot; a++) for (let b = -rr; b <= rr && !caveSpot; b++) { const i = 48 + a, j = 14 + b; if (inMap(i, j) && freeCell(i, j, 1) && !collides(i + 1.1, j + 1.1, .4)) caveSpot = [i, j]; }
  const cave = place("grotte", caveSpot[0], caveSpot[1]);
  cave.door = { i: caveSpot[0] + 1.1, j: caveSpot[1] + 1.1 };

  function makeScene(sid, n, floor, extra) { return { id: sid, N: n, G: new Array(n * n).fill(floor), TAG: new Array(n * n).fill(""), props: [], propGrid: new Map(), shapeGrid: new Map(), occ: new Uint8Array(n * n), npcs: [], animals: [], candles: [], items: [], beingsSolid: [], inside: true, ...extra }; }
  const INTERIORS = {
    maison: { n: 7, floor: "parquet", name: "Maison", exit: 3, list: [["lit", 2.4, .35], ["etagere", .05, 1.7], ["cheminee", 0, 4.4], ["tapis", 3.4, 3.4], ["table", 3.4, 3.4], ["chaise", 2.7, 3.4], ["chaise", 4.1, 3.4], ["coffre", 5.4, .4], ["pots", 5.6, 4.6]] },
    taverne: { n: 9, floor: "parquet", name: "Taverne du Canard Calme", exit: 4, list: [["comptoir", 2.2, 1.3], ["tonneau", .4, .4], ["tonneau", 1.1, .3], ["tonneau", 3.6, .3], ["cheminee", 0, 6.2], ["tapis", 5, 5], ["table", 5, 5], ["chaise", 4.3, 5], ["chaise", 5.7, 5], ["chaise", 5, 4.3], ["table", 2.4, 5.6], ["chaise", 1.7, 5.6], ["chaise", 3.1, 5.6], ["table", 6.6, 2.4], ["chaise", 6.6, 1.7], ["chaise", 7.3, 2.4], ["etagere", .05, 3.3], ["coffre", 7.6, .4]],
      npcs: [{ kind: "castor", i: 2.2, j: .55, name: "Le Tavernier", lines: ["Bienvenue à la Taverne du Canard Calme !", "On raconte qu'une grotte s'ouvre au pied des montagnes, au nord. Les anciens l'appellent la Grotte des Échos.", "Il paraît qu'une lanterne magique y dort dans un coffre… gardée par des énigmes."] }] },
    boulangerie: { n: 7, floor: "carrelage", name: "Boulangerie", exit: 3, list: [["four", .6, .7], ["comptoirPain", 3.6, 1.6], ["etagerePain", .05, 3.4], ["sac", 6, .4], ["sac", 6.2, 1.1], ["sac", 5.5, .4], ["table", 4, 4.4], ["chaise", 3.3, 4.4], ["chaise", 4.7, 4.4], ["pots", .6, 5.4]],
      npcs: [{ kind: "goeland", i: 3.6, j: .7, name: "Le Boulanger", shop: true, lines: ["Bienvenue à la boulangerie, petit canard !", "Ma tarte aux baies te remet tous tes cœurs : 3 pièces."] }] },
    chapelle: { n: 9, floor: "carrelage", name: "Chapelle", exit: 4.6, list: [["cierges", .4, .5], ["cierges", .4, 7.4], ["pupitre", 1.6, 4], ["tapis", 4.5, 4], ["bancEglise", 3.6, 2.4], ["bancEglise", 3.6, 5.6], ["bancEglise", 5.6, 2.4], ["bancEglise", 5.6, 5.6], ["bancEglise", 7.4, 2.4], ["bancEglise", 7.4, 5.6], ["pots", .4, 2.6], ["pots", .4, 5.4]],
      npcs: [{ kind: "grenouille", i: 1.5, j: 3.1, name: "Le Sonneur", lines: ["Chut… ici, on vient chercher le calme.", "Ces cierges blancs brûlent sans jamais paniquer. Les bougies rouges, elles, ont oublié comment.", "Une vieille légende dit qu'une Bougie Noire, cachée quelque part, les rend toutes rouges…"] }] },
    ecole: { n: 8, floor: "parquet", name: "École", exit: 4, list: [["tableau", .05, 3.5], ["pupitreEcole", 3, 2], ["pupitreEcole", 3, 3.6], ["pupitreEcole", 3, 5.2], ["pupitreEcole", 5, 2], ["pupitreEcole", 5, 3.6], ["pupitreEcole", 5, 5.2], ["pots", 7, .4], ["coffre", 7, 6.6]],
      npcs: [{ kind: "crapaude", i: 1.2, j: 2.2, name: "La Maîtresse", lines: ["Bonjour ! Aujourd'hui, la leçon du jour :", "Quand tout s'agite, on respire, on compte jusqu'à trois… et on réfléchit avant d'agir.", "C'est comme ça qu'on calme une bougie rouge. Et beaucoup d'autres choses !"] }] },
    grange: { n: 8, floor: "ble", name: "Grange", exit: 4, list: [["meule", 1, .8], ["meule", 2, .8], ["meule", 1, 1.9], ["tonneau", 6.6, .5], ["caisse", 5.8, .5], ["tasBois", .5, 5.2], ["coffre", 6.8, 6.6]], poules: 3 },
  };
  function buildInterior(p) {
    const T = INTERIORS[p.type] || INTERIORS.maison;
    const sc = makeScene("int:" + p.i + "," + p.j, T.n, T.floor, { name: T.name, building: p, exit: { i: T.exit, j: T.n - 1 } });
    const prev = cur; setScene(sc);
    for (const [t, i, j] of T.list) place(t, i, j);
    place("paillasson", T.exit, T.n - 1);
    for (const n of T.npcs || []) npcs.push({ ...n, r: .32 });
    for (let k = 0; k < (T.poules || 0); k++) animals.push({ kind: "poule", anim: "peck", i: 3 + k, j: 4, hi: 3.5, hj: 4, ti: 3 + k, tj: 4, wait: k, flip: false, phase: k, speed: .5, r: .24 });
    beingsSolid.push(...npcs, ...animals);
    setScene(prev); return sc;
  }
  function enterBuilding(p) {
    if (!p.interior) p.interior = buildInterior(p);
    WORLD.ret = { ...p.door }; setScene(p.interior); AUDIO.sfx("door");
    duck.i = cur.exit.i; duck.j = cur.N - 2.1; duck.view = "dos"; duck.flip = false;
    say(cur.name, 2);
  }
  function exitScene() { AUDIO.sfx("door"); const sc = cur, rp = sc.retPos || WORLD.ret; setScene(sc.parent || WORLD); duck.i = rp.i; duck.j = rp.j; duck.view = "face"; save(); }

  // Grotte des Échos : # mur, B bloc à pousser, P plaque, G grille, L porte à clé, K clé, C bougie, T coffre, E sortie
  const D1 = [
    "##################",
    "#................#",
    "#.......T........#",
    "#................#",
    "########G#########",
    "#....#.....#.....#",
    "#....#.....#..K..#",
    "#.B..L.....#.....#",
    "#....#..C........#",
    "#..P.#.....#..C..#",
    "#....#.....#.....#",
    "######..C..#######",
    "######.....#######",
    "######.....#######",
    "########.#########",
    "#######...########",
    "#######.E.########",
    "##################",
  ];
  let DUNGEON = null;
  function buildDungeon() {
    const n = 18, sc = makeScene("grotte", n, "pierre", { name: "Grotte des Échos", inside: false, dark: true, blocks: [] });
    const prev = cur; setScene(sc);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ch = D1[j][i];
      if (ch === "#") { place("mur", i, j); G[id(i, j)] = "gravier"; continue; }
      G[id(i, j)] = hash(i, j, 41) < .25 ? "gravier" : "pierre";
      if (ch === "P") sc.plate = place(Q.d1.gate ? "plaqueOn" : "plaque", i, j);
      if (ch === "B") { const at = Q.d1.block || [i, j]; sc.blocks.push(place("bloc", at[0], at[1])); }
      if (ch === "G" && !Q.d1.gate) sc.gate = place("grille", i, j);
      if (ch === "L" && !Q.d1.door) sc.door = place("porteBois", i, j);
      if (ch === "K" && !Q.d1.key) items.push({ kind: "cle", i, j, got: false, id: "d1cle" });
      if (ch === "C") { const cid = "d1c" + candles.length; candles.push({ i, j, home: [i, j], ti: i, tj: j, phase: 0, alive: !Q.d1.calmed.includes(cid), r: .26, id: cid }); }
      if (ch === "T") sc.chest = place("coffre", i, j);
      if (ch === "E") { sc.exit = { i, j }; place("paillasson", i, j); }
    }
    for (const [i, j] of [[6, 5], [10, 5], [6, 13], [10, 13], [1, 5], [16, 5], [7, 1], [10, 1]]) if (D1[j][i] === ".") place("brasero", i, j);
    sc.boss = Q.d1.chest ? null : makeBoss("golem", "d1", 13, 2, [.5, 16.5, .5, 3.5]); sc.shots = [];
    for (const [i, j] of [[2, 10], [16, 10], [9, 12], [3, 5]]) if (D1[j][i] === ".") items.push({ kind: "piece", i, j, got: false, id: "d1p" + i + j });
    beingsSolid.push(...npcs);
    setScene(prev); return sc;
  }
  function enterDungeon() {
    if (!Q.d1.gate) Q.d1.block = null; // bloc coincé ? il reprend sa place en revenant
    if (!DUNGEON) DUNGEON = buildDungeon();
    else if (!Q.d1.gate) { const prev = cur; setScene(DUNGEON); const b = DUNGEON.blocks[0]; if (b) removeProp(b); DUNGEON.blocks[0] = place("bloc", 2, 7); setScene(prev); }
    WORLD.ret = { ...cave.door }; setScene(DUNGEON); AUDIO.sfx("whoosh");
    duck.i = DUNGEON.exit.i; duck.j = DUNGEON.exit.j - 1.1; duck.view = "dos";
    say(Q.d1.gate ? "La Grotte des Échos." : "La Grotte des Échos… il fait sombre. (Bloc coincé ? Ressors et reviens.)", 4);
  }
  // actions propres aux scènes (Espace)
  function sceneAction() {
    if (cur.boss && cur.boss.alive && props.some((p) => p.type === "coffre" && near(p, 1.2) && (p === cur.chest || p === cur.chestF))) { say(cur.boss.name + " garde le coffre ! Calme-le d'abord.", 2.5); return true; }
    if (cur === COTE) {
      if (near(phareDoor, 1.2)) { enterPhare(); return true; }
      if (COTE.isleChest && near(COTE.isleChest, 1.2)) { if (!Q.isle2) { Q.isle2 = true; Q.maxHearts++; duck.hearts = Q.maxHearts; Q.pieces += 10; AUDIO.sfx("chest"); sparkle(COTE.isleChest.i, COTE.isleChest.j, ["#ffd23f", "#ff8fb1"], 30); say("Le coffre de l'îlot : +1 cœur et +10 pièces !", 4); save(); } else say("Le coffre est vide.", 2); return true; }
    }
    if (cur === PHARE && PHARE.chestF && near(PHARE.chestF, 1.2)) { if (!Q.d4.chestF) { Q.d4.chestF = true; Q.cote = Math.max(Q.cote, 2); if (COTE && COTE.phare) COTE.phare.type = "phare"; Q.maxHearts++; duck.hearts = Q.maxHearts; Q.pieces += 30; sparkle(PHARE.chestF.i, PHARE.chestF.j, ["#ffd23f", "#fff4b0", "#6fd0ef", "#ff8fb1", "#ffffff"], 80); save(); startEnding(); } else say("Le coffre est vide.", 2); return true; }
    if (cur === MONTS && near(towerDoor, 1.1)) { enterTower(); return true; }
    if (cur === TOWER) {
      if (TOWER.chestT && near(TOWER.chestT, 1.2)) { if (!Q.d3.chestT) { Q.d3.chestT = true; Q.bottes = true; Q.sel = ownedItems().indexOf("bottes"); AUDIO.sfx("chest"); sparkle(TOWER.chestT.i, TOWER.chestT.j, ["#ffd23f", "#6fd0ef"], 30); say("Les BOTTES DU VENT ! Marche dans une direction et appuie sur X pour bondir. (C : changer d'objet)", 7); save(); } else say("Le coffre est vide.", 2); return true; }
      if (TOWER.chestF && near(TOWER.chestF, 1.2)) { if (!Q.d3.chestF) { Q.d3.chestF = true; Q.monts = Math.max(Q.monts, 2); Q.maxHearts++; duck.hearts = Q.maxHearts; Q.pieces += 20; AUDIO.sfx("chest"); sparkle(TOWER.chestF.i, TOWER.chestF.j, ["#ffd23f", "#fff4b0", "#6fd0ef", "#ffffff"], 50); say("La PLUME DU VENT ! +1 cœur et +20 pièces. ✨", 6); save(); } else say("Le coffre est vide.", 2); return true; }
    }
    if (cur === FOREST) {
      if (near(templeDoor, 1.1)) { enterTemple(); return true; }
      if (FOREST.islandChest && near(FOREST.islandChest, 1.2)) { if (!Q.island) { Q.island = true; Q.maxHearts++; duck.hearts = Q.maxHearts; Q.pieces += 10; sparkle(FOREST.islandChest.i, FOREST.islandChest.j, ["#ffd23f", "#ff8fb1"], 30); AUDIO.sfx("chest"); say("Le coffre de l'île : +1 cœur et +10 pièces !", 4); save(); } else say("Le coffre est vide.", 2); return true; }
    }
    if (cur === TEMPLE) {
      if (TEMPLE.chestG && near(TEMPLE.chestG, 1.2)) { if (!Q.d2.chestG) { Q.d2.chestG = true; Q.grappin = true; sparkle(TEMPLE.chestG.i, TEMPLE.chestG.j, ["#ffd23f", "#fff4b0"], 30); AUDIO.sfx("chest"); say("Le GRAPPIN ! Tourne-toi vers un poteau et appuie sur X (ou OBJET).", 6); save(); } else say("Le coffre est vide.", 2); return true; }
      if (TEMPLE.chestF && near(TEMPLE.chestF, 1.2)) { if (!Q.d2.chestF) { Q.d2.chestF = true; Q.foret = Math.max(Q.foret, 2); Q.maxHearts++; duck.hearts = Q.maxHearts; Q.pieces += 20; sparkle(TEMPLE.chestF.i, TEMPLE.chestF.j, ["#ffd23f", "#fff4b0", "#6fd0ef", "#8fd65a"], 50); AUDIO.sfx("chest"); say("La PLUME DE LA FORÊT ! +1 cœur et +20 pièces. ✨", 6); save(); } else say("Le coffre est vide.", 2); return true; }
    }
    if (cur === WORLD) {
      const b = doorsList.find((p) => near(p.door, .85)); if (b) { enterBuilding(b); return true; }
      if (near(cave.door, 1)) { enterDungeon(); return true; }
      return false;
    }
    if (cur.inside) {
      const ch = props.find((p) => p.type === "coffre" && near(p, 1.15));
      if (ch) { if (!Q.chests.includes(cur.id)) { Q.chests.push(cur.id); Q.pieces += 5; sparkle(ch.i, ch.j, ["#ffd23f", "#fff4b0"], 18); AUDIO.sfx("chest"); say("Coffre : +5 pièces !", 3); save(); } else say("Le coffre est vide.", 2); return true; }
    }
    if (cur === DUNGEON && cur.chest && near(cur.chest, 1.2)) {
      if (!Q.d1.chest) { Q.d1.chest = true; Q.maxHearts++; duck.hearts = Q.maxHearts; Q.pieces += 20; sparkle(cur.chest.i, cur.chest.j, ["#ffd23f", "#fff4b0", "#6fd0ef"], 40); AUDIO.sfx("chest"); say("La Lanterne des Échos ! +1 cœur et +20 pièces. ✨", 5); save(); }
      else say("Le coffre est vide.", 2);
      return true;
    }
    return false;
  }
  // mécanismes : sortie, porte à clé, bloc à pousser, plaque et grille
  let pushT = 0, lockMsg = 0;
  const wallAt = (i, j) => !inMap(i, j) || (cur === DUNGEON && D1[j][i] === "#");
  function sceneUpdate(dt) {
    lockMsg -= dt;
    if (cur === WORLD && near(worldArch.zone, .7)) { enterForest(); return; }
    if (cur === WORLD && near(worldArch2.zone, .7)) { enterMonts(); return; }
    if (cur === WORLD && near(worldArch3.zone, .7)) { enterCote(); return; }
    if (cur === COTE && near(coteArch.zone, .7)) { leaveCote(); return; }
    if (cur === MONTS && near(montsArch.zone, .7)) { leaveMonts(); return; }
    if (cur === TOWER && TOWER.door && near(TOWER.door, 1.05)) {
      if (Q.d3.key) { removeProp(TOWER.door); TOWER.door = null; Q.d3.door = true; AUDIO.sfx("unlock"); say("La porte de la tour s'ouvre !", 3); save(); }
      else if (lockMsg <= 0) { say("Fermée à clé. La clé est de l'autre côté d'un gouffre… il faudrait bondir.", 3.5); lockMsg = 4; }
    }
    if (cur === FOREST && near(forestArch.zone, .7)) { leaveForest(); return; }
    if (cur === TEMPLE && TEMPLE.door && near(TEMPLE.door, 1.05)) {
      if (Q.d2.key) { removeProp(TEMPLE.door); TEMPLE.door = null; Q.d2.door = true; AUDIO.sfx("unlock"); say("La porte du temple s'ouvre !", 3); save(); }
      else if (lockMsg <= 0) { say("Fermée à clé. La clé est de l'autre côté d'un gouffre, à droite…", 3.5); lockMsg = 4; }
    }
    if (cur !== WORLD && cur.exit && Math.hypot(duck.i - cur.exit.i, duck.j - cur.exit.j) < .45) { exitScene(); return; }
    if (cur === PHARE) { phareUpdate(dt); return; }
    if (cur !== DUNGEON) { duck.pushAxis = null; return; }
    lockMsg -= dt;
    if (cur.door && near(cur.door, 1.05)) {
      if (Q.d1.key) { removeProp(cur.door); cur.door = null; Q.d1.door = true; sparkle(5, 7, ["#ffd23f", "#fff"], 16); AUDIO.sfx("unlock"); say("La clé tourne… la porte s'ouvre !", 3); save(); }
      else if (lockMsg <= 0) { say("Une porte fermée à clé. La clé doit être quelque part dans la grotte…", 3); lockMsg = 4; }
    }
    // pousser le bloc : il faut marcher contre lui un court instant
    // pousser le bloc : Dip Duck se met dans l'axe du bloc et le suit tant qu'il avance vers lui
    const b = cur.blocks[0];
    duck.pushAxis = null;
    if (b && duck.moving) {
      const di = b.i - duck.i, dj = b.j - duck.j;
      const ax = Math.abs(di) > Math.abs(dj) ? [Math.sign(di), 0] : [0, Math.sign(dj)];
      const along = ax[0] ? di * ax[0] : dj * ax[1], side = ax[0] ? Math.abs(dj) : Math.abs(di);
      const mv = duck.lastMove || [0, 0], dot = mv[0] * ax[0] + mv[1] * ax[1];
      if (dot > .3 && along > 0 && along < 1.9 && side < .6) {
        duck.pushAxis = ax;
        const k = Math.min(1, dt * 10);
        if (ax[0]) moveBody(duck, 0, (b.j - duck.j) * k, duck.r); else moveBody(duck, (b.i - duck.i) * k, 0, duck.r);
        if (along < 1.0) {
          pushT += dt;
          if (pushT > .22) {
            pushT = 0;
            const ti = Math.round(b.i) + ax[0], tj = Math.round(b.j) + ax[1];
            const same = (o) => o && Math.round(o.i) === ti && Math.round(o.j) === tj;
            const busy = wallAt(ti, tj) || same(cur.gate) || same(cur.door) || same(cur.chest) || candles.some((c) => c.alive && same(c)) || Math.hypot(duck.i - ti, duck.j - tj) < .6;
            if (!busy) { AUDIO.sfx("push"); removeProp(b); cur.blocks[0] = place("bloc", ti, tj); Q.d1.block = [ti, tj]; }
            else say("Le bloc ne bouge pas de ce côté.", 1.5);
          }
        } else pushT = 0;
      } else pushT = 0;
    }
    const bb = cur.blocks[0];
    if (cur.gate && bb && cur.plate && Math.round(bb.i) === Math.round(cur.plate.i) && Math.round(bb.j) === Math.round(cur.plate.j)) {
      removeProp(cur.gate); cur.gate = null; Q.d1.gate = true;
      removeProp(cur.plate); cur.plate = place("plaqueOn", cur.plate.i, cur.plate.j);
      AUDIO.sfx("gate"); say("Clac ! La grille s'est levée au fond de la grotte.", 4); save();
    }
  }
  function promptTarget() {
    if (cur === MONTS && near(towerDoor, 1.1)) return { prompt: "Espace : entrer dans la Tour du Vent" };
    if (cur === COTE && near(phareDoor, 1.2)) return { prompt: "Espace : entrer dans le Phare" };
    if ((cur === COTE && COTE.isleChest && near(COTE.isleChest, 1.2)) || (cur === PHARE && PHARE.chestF && near(PHARE.chestF, 1.2))) return { prompt: "Espace : ouvrir le coffre" };
    if (cur === TOWER && ((TOWER.chestT && near(TOWER.chestT, 1.2)) || (TOWER.chestF && near(TOWER.chestF, 1.2)))) return { prompt: "Espace : ouvrir le coffre" };
    if (cur === FOREST) { if (near(templeDoor, 1.1)) return { prompt: "Espace : entrer dans le Temple Moussu" }; if (FOREST.islandChest && near(FOREST.islandChest, 1.2)) return { prompt: "Espace : ouvrir le coffre" }; }
    if (cur === TEMPLE && ((TEMPLE.chestG && near(TEMPLE.chestG, 1.2)) || (TEMPLE.chestF && near(TEMPLE.chestF, 1.2)))) return { prompt: "Espace : ouvrir le coffre" };
    if (cur === WORLD) {
      const b = doorsList.find((p) => near(p.door, .85)); if (b) return { prompt: "Espace : entrer — " + ((INTERIORS[b.type] || INTERIORS.maison).name) };
      if (near(cave.door, 1)) return { prompt: "Espace : entrer dans la Grotte des Échos" };
    } else if (cur.inside) { if (props.some((p) => p.type === "coffre" && near(p, 1.15))) return { prompt: "Espace : ouvrir le coffre" }; }
    else if (cur === DUNGEON && cur.chest && near(cur.chest, 1.2)) return { prompt: "Espace : ouvrir le coffre" };
    return null;
  }
  // murs du fond des intérieurs
  function drawWalls() {
    const n = N, H = 150, A = toScreen(-.5, -.5), B = toScreen(n - .5, -.5), C = toScreen(-.5, n - .5);
    const wall = (P1, P2, col1, col2) => {
      DD.poly(ctx, [[P1[0], P1[1] - 32], [P2[0], P2[1] - 32], [P2[0], P2[1] - 32 - H], [P1[0], P1[1] - 32 - H]], DD.lin(ctx, 0, P1[1] - H, 0, P1[1], [[0, col1], [1, col2]]), "#3a2a1a", 2);
      for (let k = 1; k < 12; k++) { const t = k / 12; ctx.strokeStyle = "rgba(0,0,0,.08)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(P1[0] + (P2[0] - P1[0]) * t, P1[1] - 32 + (P2[1] - P1[1]) * t); ctx.lineTo(P1[0] + (P2[0] - P1[0]) * t, P1[1] - 32 - H + (P2[1] - P1[1]) * t); ctx.stroke(); }
      DD.poly(ctx, [[P1[0], P1[1] - 32], [P2[0], P2[1] - 32], [P2[0], P2[1] - 46], [P1[0], P1[1] - 46]], "#6b4022");
      const mx = (P1[0] + P2[0]) / 2, my = (P1[1] + P2[1]) / 2 - 32 - 92, sl = (P2[1] - P1[1]) / (P2[0] - P1[0]);
      DD.poly(ctx, [[mx - 30, my - 30 * sl], [mx + 30, my + 30 * sl], [mx + 30, my + 30 * sl + 44], [mx - 30, my - 30 * sl + 44]], "#bfe6f8", "#6b4022", 4);
      DD.line(ctx, mx, my, mx, my + 44, "#6b4022", 3);
    };
    wall(A, B, "#f3e3c3", "#e0caa0"); wall(A, C, "#e6d2a8", "#cdb488");
    DD.line(ctx, A[0], A[1] - 32, A[0], A[1] - 32 - H, "#3a2a1a", 3);
  }
  // obscurité de la grotte : seules les flammes et Dip Duck éclairent
  function darkness(W, Hh, x0, y0, vw, vh) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "#2a2a40"; ctx.fillRect(0, 0, W, Hh); ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    const glow = (x, y, r, col) => { const g = ctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    for (const p of props) if (p.type === "brasero") { const [x, y] = toScreen(p.i, p.j); glow(x, y - 50, 230, "rgba(255,170,80,.42)"); }
    for (const c of candles) if (c.alive) { const [x, y] = toScreen(c.i, c.j); glow(x, y - 68, 120, "rgba(255,110,50,.5)"); }
    if (cur.boss && cur.boss.alive && cur.boss.vis) { const [x, y] = toScreen(cur.boss.i, cur.boss.j); glow(x, y - 90, 260, "rgba(200,160,255,.35)"); }
    for (const sh of cur.shots || []) { const [x, y] = toScreen(sh.i, sh.j); glow(x, y - 30, 70, "rgba(120,200,255,.6)"); }
    const [dx, dy] = toScreen(duck.i, duck.j); glow(dx, dy - 30, Q.d1.chest ? 420 : 260, Q.d1.chest ? "rgba(255,240,170,.45)" : "rgba(255,240,200,.3)");
    ctx.globalCompositeOperation = "source-over";
  }

  // ─── Région 2 : la Forêt Profonde (et le Temple Moussu) ───
  WORLD.outdoor = true;
  // arche au nord du monde, au bout du sentier du campement
  for (const p of [...props]) if (Math.hypot(p.i - 52, p.j - 2) < 2.2 && p.type !== "grotte") removeProp(p);
  const worldArch = place("archeForet", 52, 2);
  worldArch.zone = { i: 52, j: 1.6, scene: WORLD };
  WORLD.passages = [{ i: 52, j: 2, name: "→ Forêt Profonde" }];
  const FN = 80;
  let FOREST = null, TEMPLE = null, OWL = null, templeDoor = null, forestArch = null;
  function buildForest() {
    const sc = makeScene("foret", FN, "foret", { name: "Forêt Profonde", inside: false, outdoor: true, mist: true, places: [{ i: 40, j: 42, name: "Clairière des Lucioles" }, { i: 40, j: 8, name: "Temple Moussu" }, { i: 62, j: 26, name: "Île" }], passages: [{ i: 40, j: 78, name: "→ Val de l'Étang" }] });
    const prev = cur; setScene(sc);
    for (let i = 0; i < FN; i++) for (let j = 0; j < FN; j++) {
      const k = id(i, j), n1 = noise(i + 300, j + 300, 21), n2 = noise(i + 300, j + 300, 33);
      let t = "foret", tag = "foret";
      if (n1 < .38) { t = hash(i, j, 61) < .15 ? "fleurs" : "herbe"; tag = "clairiere"; }
      if (Math.abs(j - (60 + Math.sin(i / 7) * 3 + (n2 - .5) * 2)) < 1.1) { t = "eau"; tag = "eau"; }
      const dp = Math.hypot(i - 62, j - 26);
      if (dp < 5.5 + n2 * 1.5) { t = hash(i, j, 7) < .15 ? "nenuphar" : "eau"; tag = "eau"; }
      if (dp < 2.3) { t = "herbe"; tag = "ile"; }
      G[k] = t; TAG[k] = tag;
    }
    const CL = { i: 40, j: 42, r: 7 }, TP = { i: 40, j: 9, r: 5 };
    for (let i = 0; i < FN; i++) for (let j = 0; j < FN; j++) {
      const dc = Math.hypot(i - CL.i, j - CL.j), dt = Math.hypot(i - TP.i, j - TP.j);
      if (dc < CL.r && TAG[id(i, j)] !== "eau") { TAG[id(i, j)] = "ville"; G[id(i, j)] = dc < 2.6 ? "terre" : hash(i, j, 3) < .15 ? "fleurs" : "herbe"; }
      if (dt < TP.r) { TAG[id(i, j)] = "ville"; G[id(i, j)] = dt < 3 ? "pierre" : "gravier"; }
    }
    road({ i: 40, j: 78 }, { i: 40, j: 49 }); road({ i: 40, j: 35 }, { i: 40, j: 14 }); road({ i: 34, j: 42 }, { i: 8, j: 46 }); road({ i: 46, j: 42 }, { i: 60, j: 36 });
    // île de l'étang : un poteau sur l'île, un sur la rive (grappin)
    let shore = 27; while (shore < 40 && (G[id(62, shore)] === "eau" || G[id(62, shore)] === "nenuphar" || TAG[id(62, shore)] === "ile")) shore++;
    place("poteau", 62, 25.2); place("poteau", 62, shore + 1); sc.islandChest = place("coffre", 61.3, 26.6);
    // la clairière des Lucioles : maisons-champignons autour du feu
    place("feuCamp", 40, 42); place("puits", 37.5, 39.5);
    for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2 + .2, i = Math.round(40 + Math.cos(ang) * 5), j = Math.round(42 + Math.sin(ang) * 5); if (freeCell(i, j)) place(a % 3 === 2 ? "tente" : "champiMaison", i, j); }
    for (const [i, j] of [[37, 44.6], [43, 39.4], [43.4, 44.6], [36.6, 40]]) if (!occ[id(Math.round(i), Math.round(j))]) place("lanterne", i, j);
    // temple
    const tp = place("temple", 40, 7.5); templeDoor = { i: 40, j: 9.6, scene: sc };
    for (const [i, j] of [[37, 10], [43, 10]]) place("brasero", i, j);
    // arche du retour
    forestArch = place("archeVal", 40, 78); forestArch.zone = { i: 40, j: 78.3, scene: sc };
    // nature
    for (let i = 1; i < FN - 1; i++) for (let j = 1; j < FN - 1; j++) {
      const k = id(i, j), tag = TAG[k], h = hash(i + 500, j, 77);
      if (occ[k] || isWater(i, j) || tag === "route" || tag === "ville" || tag === "ile" || G[k] === "pont") continue;
      if (tag === "foret") { if (h < .5) place(["sapin", "arbre", "bouleau", "arbre2", "sapin", "erable"][Math.floor(hash(i, j, 18) * 6)], i + (hash(i, j, 2) - .5) * .5, j + (hash(i, j, 6) - .5) * .5); else if (h < .6) place(["fougere", "baies", "souche", "champignons", "fougere", "rocher"][Math.floor(hash(i, j, 8) * 6)], i, j); continue; }
      if (h < .03) place(["buisson", "rocher", "baies"][Math.floor(hash(i, j, 8) * 3)], i, j); else if (h < .09) place(["fleurs", "herbes", "fougere"][Math.floor(hash(i, j, 8) * 3)], i, j);
    }
    for (let i = 0; i < FN; i++) for (let j = 0; j < FN; j++) if (TAG[id(i, j)] === "eau" && hash(i, j, 12) < .05 && Math.abs(j - 60) > 3) place("roseaux", i, j);
    // habitants
    OWL = { kind: "hibou", i: 42.2, j: 40.2, name: "La Chouette Sage", r: .3, scene: sc };
    npcs.push(OWL, { kind: "renard", i: 37.4, j: 43.4, name: "Le Renard Marchand", r: .3, merchant: true, lines: ["Psst, petit canard ! Je vends une Fiole de vie : +1 cœur pour toujours. 40 pièces, une seule fois.", "Et ma tarte aux mûres te remet tous tes cœurs : 3 pièces."] },
      { kind: "ecureuil", i: 44.6, j: 43.6, name: "Mère Écureuil", r: .26, lines: ["Les feux follets bleus ne sont pas méchants… juste paniqués. Un coup de bec les apaise.", "Au nord, le Temple Moussu est plein de gouffres. Il paraît qu'on y trouve un grappin !"] });
    // animaux, feux follets, collections
    const spawn = (kind, anim, n, speed) => { for (let t = 0, m = 0; t < 3000 && m < n; t++) { const i = 2 + Math.floor(rnd() * (FN - 4)), j = 2 + Math.floor(rnd() * (FN - 4)); if (occ[id(i, j)] || isWater(i, j) || TAG[id(i, j)] === "ville" || collides(i, j, .3)) continue; animals.push({ kind, anim, i, j, hi: i, hj: j, ti: i, tj: j, wait: rnd() * 3, flip: false, phase: rnd() * 4, speed, r: .26 }); m++; } };
    spawn("cerf", "walk", 6, .8); spawn("lapin", "hop", 8, 1.4); spawn("renard", "walk", 4, 1.1); spawn("ecureuil", "hop", 8, 1.2);
    for (let t = 0, m = 0; t < 5000 && m < 16; t++) { const i = 2 + Math.floor(rnd() * (FN - 4)), j = 2 + Math.floor(rnd() * (FN - 4)); if (occ[id(i, j)] || isWater(i, j) || TAG[id(i, j)] === "ville" || Math.hypot(i - 40, j - 76) < 8 || collides(i, j, .3)) continue; const cid = "fc" + m; candles.push({ kind: "follet", i, j, home: [i, j], ti: i, tj: j, phase: rnd() * 4, alive: !(Q.calmedIds || []).includes(cid), r: .26, id: cid }); m++; }
    const drop = (kind, n, pre) => { for (let t = 0, m = 0; t < 8000 && m < n; t++) { const i = 2 + Math.floor(hash(t, m, pre.length * 7 + 3) * (FN - 4)), j = 2 + Math.floor(hash(m, t, pre.length * 11 + 5) * (FN - 4)); if (occ[id(i, j)] || isWater(i, j) || collides(i, j, .3)) continue; occ[id(i, j)] = 1; const iid = pre + m; items.push({ kind, i, j, got: (Q.got || []).includes(iid), id: iid }); m++; } };
    drop("plume", 20, "fp"); drop("luciole", 8, "fl");
    beingsSolid.push(...npcs, ...animals);
    setScene(prev); return sc;
  }
  function enterForest() { if (!FOREST) FOREST = buildForest(); setScene(FOREST); AUDIO.sfx("whoosh"); duck.i = 40; duck.j = 76.6; duck.view = "dos"; say("La Forêt Profonde — la Clairière des Lucioles est droit devant.", 4); save(); }
  function leaveForest() { setScene(WORLD); AUDIO.sfx("whoosh"); duck.i = 52; duck.j = 3.4; duck.view = "face"; say("Retour au Val de l'Étang.", 2.5); save(); }

  // Temple Moussu : # mur, V gouffre, o poteau, K clé, L porte (dans un mur horizontal), T grappin, F Plume de la Forêt, C feu follet, E sortie
  const D2 = [
    "####################",
    "#........F.........#",
    "#....o.......o.....#",
    "#..................#",
    "#VVVVVVVVVVVVVVVVVV#",
    "#VVVVVVVVVVVVVVVVVV#",
    "#..................#",
    "#....o.......o.....#",
    "##########L#########",
    "#......#.....#..V.o#",
    "#..T...#..C..#..V..#",
    "#......#.....#o.V.K#",
    "#......#.....#..V..#",
    "###.####.....##.####",
    "#..................#",
    "#....C.......C.....#",
    "#..................#",
    "#########.##########",
    "########.E.#########",
    "####################",
  ];
  function buildTemple() {
    const n = 20, sc = makeScene("temple", n, "pierre", { name: "Temple Moussu", inside: false, dark: true, parent: FOREST, retPos: { i: templeDoor.i, j: templeDoor.j + .2 } });
    const prev = cur; setScene(sc);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ch = D2[j][i];
      if (ch === "#") { place("murMousse", i, j); G[id(i, j)] = "gravier"; continue; }
      G[id(i, j)] = ch === "V" ? "vide" : hash(i, j, 43) < .3 ? "gravier" : "pierre";
      if (ch === "o") place("poteau", i, j);
      if (ch === "K" && !Q.d2.key) items.push({ kind: "cle", i, j, got: false, id: "d2cle" });
      if (ch === "L" && !Q.d2.door) sc.door = place("porteBoisI", i, j);
      if (ch === "T") sc.chestG = place("coffre", i, j);
      if (ch === "F") sc.chestF = place("coffre", i, j);
      if (ch === "C") { const cid = "d2c" + candles.length; candles.push({ kind: "follet", i, j, home: [i, j], ti: i, tj: j, phase: 0, alive: !(Q.calmedIds || []).includes(cid), r: .26, id: cid }); }
      if (ch === "E") { sc.exit = { i, j }; place("paillasson", i, j); }
    }
    for (const [i, j] of [[2, 14], [17, 14], [9, 10], [11, 10], [3, 1], [16, 1], [2, 6], [17, 6]]) if (D2[j][i] === ".") place("brasero", i, j);
    sc.boss = Q.d2.chestF ? null : makeBoss("follet", "d2", 13, 1.5, [.5, 18.5, .5, 3.5]); sc.shots = [];
    setScene(prev); return sc;
  }
  function enterTemple() {
    if (!TEMPLE) TEMPLE = buildTemple();
    setScene(TEMPLE); AUDIO.sfx("whoosh"); duck.i = TEMPLE.exit.i; duck.j = TEMPLE.exit.j - 1.1; duck.view = "dos";
    say(Q.grappin ? "Le Temple Moussu." : "Le Temple Moussu… des gouffres partout. Il faudrait un grappin.", 4);
  }

  // ─── Grappin (touche X ou bouton OBJET) ───
  function useGrappin() {
    if (dialog || duck.hook || duck.dash) return;
    const dir = duck.lastMove || (duck.view === "face" ? [.7, .7] : [-.7, -.7]);
    const range = cur.outdoor ? 10 : 6.5;
    let best = null, bestScore = -1;
    for (const p of props) {
      if (p.type !== "poteau") continue;
      const ri = p.i - duck.i, rj = p.j - duck.j, d = Math.hypot(ri, rj);
      if (d < .9 || d > range) continue;
      const cos = (ri * dir[0] + rj * dir[1]) / d; if (cos < .6) continue;
      // la corde ne doit pas traverser un mur, un arbre ou un bâtiment
      let clear = true;
      for (let s = .5; s < d - .5 && clear; s += .25) {
        const si = duck.i + ri * s / d, sj = duck.j + rj * s / d, l = shapeGrid.get(id(Math.round(si), Math.round(sj)));
        if (l) for (const sh of l) if (!sh.thin && hitShape(sh, si, sj, .05)) { clear = false; break; }
      }
      if (clear && cos - d * .02 > bestScore) { bestScore = cos - d * .02; best = p; }
    }
    if (!best) { AUDIO.sfx("miss"); say("Le grappin ne trouve aucun poteau dans cette direction.", 2); duck.rope = { t: .3, to: [duck.i + dir[0] * 3, duck.j + dir[1] * 3] }; return; }
    const ri = best.i - duck.i, rj = best.j - duck.j, ax = Math.abs(ri) > Math.abs(rj) ? [Math.sign(ri), 0] : [0, Math.sign(rj)];
    AUDIO.sfx("grapple"); duck.hook = { post: best, ti: best.i - ax[0] * .85, tj: best.j - ax[1] * .85 };
  }
  function hookUpdate(dt) {
    if (duck.rope) { duck.rope.t -= dt; if (duck.rope.t <= 0) duck.rope = null; }
    if (!duck.hook) return false;
    const h = duck.hook, d = Math.hypot(h.ti - duck.i, h.tj - duck.j), sp = 11 * dt;
    if (d <= sp) { duck.i = h.ti; duck.j = h.tj; duck.hook = null; }
    else { duck.i += (h.ti - duck.i) / d * sp; duck.j += (h.tj - duck.j) / d * sp; }
    return true;
  }

  // ─── Région 3 : les Monts du Vent (et la Tour du Vent) ───
  for (const p of [...props]) if (Math.hypot(p.i - 2, p.j - 72) < 2.5) removeProp(p);
  const worldArch2 = place("archeMonts", 2, 72);
  worldArch2.zone = { i: 1.6, j: 72, scene: WORLD };
  WORLD.passages.push({ i: 2, j: 72, name: "→ Monts du Vent" });
  const MN = 80;
  let MONTS = null, TOWER = null, GUIDE = null, towerDoor = null, montsArch = null;
  function buildMonts() {
    const sc = makeScene("monts", MN, "neige", { name: "Monts du Vent", inside: false, outdoor: true, snow: true, winds: [], places: [{ i: 42, j: 42, name: "Refuge des Cimes" }, { i: 40, j: 8, name: "Tour du Vent" }, { i: 20, j: 24, name: "Lac gelé" }], passages: [{ i: 78, j: 42, name: "→ Val de l'Étang" }] });
    const prev = cur; setScene(sc);
    for (let i = 0; i < MN; i++) for (let j = 0; j < MN; j++) {
      const k = id(i, j), n1 = noise(i + 700, j + 700, 51), n2 = noise(i + 700, j + 700, 57);
      let t = "neige", tag = "";
      if (n1 > .6) { t = "gravier"; tag = "roc"; }
      if (Math.hypot(i - 20, j - 24) < 7 + n2 * 2) { t = "glace"; tag = "glace"; }
      G[k] = t; TAG[k] = tag;
    }
    const CL = { i: 42, j: 42, r: 7 }, TP = { i: 40, j: 9, r: 5 };
    for (let i = 0; i < MN; i++) for (let j = 0; j < MN; j++) {
      const dc = Math.hypot(i - CL.i, j - CL.j), dt = Math.hypot(i - TP.i, j - TP.j);
      if (dc < CL.r) { TAG[id(i, j)] = "ville"; G[id(i, j)] = dc < 2.6 ? "pierre" : "neige"; }
      if (dt < TP.r) { TAG[id(i, j)] = "ville"; G[id(i, j)] = dt < 3 ? "pierre" : "gravier"; }
    }
    road({ i: 78, j: 42 }, { i: 49, j: 42 }); road({ i: 42, j: 35 }, { i: 40, j: 13 }); road({ i: 35, j: 42 }, { i: 26, j: 28 }); road({ i: 46, j: 47 }, { i: 60, j: 66 });
    // rafales : couloirs où le vent pousse Dip Duck (par intermittence)
    sc.winds.push({ i0: 55, i1: 63, j0: 36, j1: 48, dir: [0, 1], period: 4 }, { i0: 34, i1: 46, j0: 18, j1: 27, dir: [1, 0], period: 3.4 }, { i0: 52, i1: 62, j0: 56, j1: 66, dir: [-1, 0], period: 3 });
    // le Refuge des Cimes
    place("feuCamp", 42, 42); place("puits", 39.5, 39.5);
    for (let a = 0; a < 6; a++) { const ang = a / 6 * Math.PI * 2 + .5, i = Math.round(42 + Math.cos(ang) * 5), j = Math.round(42 + Math.sin(ang) * 5); if (freeCell(i, j, 1)) place(a % 3 === 2 ? "tasBois" : "maison", i + .5, j + .5); }
    for (const [i, j] of [[39, 44.6], [45, 39.4], [45.4, 44.6]]) if (!occ[id(Math.round(i), Math.round(j))]) place("lanterne", i, j);
    // la Tour du Vent
    place("tourVent", 40, 7.5); towerDoor = { i: 40, j: 9.4, scene: sc };
    for (const [i, j] of [[37, 10], [43, 10]]) place("brasero", i, j);
    montsArch = place("archeVal2", 78, 42); montsArch.zone = { i: 78.3, j: 42, scene: sc };
    // nature : falaises infranchissables, sapins enneigés, rochers
    for (let i = 1; i < MN - 1; i++) for (let j = 1; j < MN - 1; j++) {
      const k = id(i, j), tag = TAG[k], h = hash(i + 900, j, 77);
      if (occ[k] || isWater(i, j) || tag === "route" || tag === "ville" || tag === "glace" || G[k] === "pont") continue;
      if (tag === "roc") { if (i % 3 === 0 && j % 3 === 0 && freeCell(i, j, 1)) place("montagne", i, j); else if (h < .12) place("rocher", i, j); continue; }
      if (h < .1) place(hash(i, j, 3) < .8 ? "sapin" : "bouleau", i + (hash(i, j, 2) - .5) * .5, j + (hash(i, j, 6) - .5) * .5); else if (h < .13) place("rocher", i, j);
    }
    // habitants
    GUIDE = { kind: "goeland", dlg: "guide", i: 44.1, j: 40.9, name: "Le Guide des Cimes", r: .3, scene: sc };
    npcs.push(GUIDE, { kind: "castor", i: 40.1, j: 43.4, name: "Le Bûcheron", r: .32, lines: ["Brrr ! Ici, le vent souffle par rafales. Attends qu'il se calme avant de traverser.", "On dit que la Tour du Vent cache des bottes qui font bondir comme une bourrasque."] },
      { kind: "chevre", i: 43.6, j: 43.9, name: "Mamie Chèvre", r: .28, lines: ["J'ai grimpé ces montagnes toute ma vie, petit.", "Sur le lac gelé, ça glisse… mais les plus belles fleurs, les edelweiss, poussent près des falaises."] });
    const spawn = (kind, anim, n, speed) => { for (let t = 0, m = 0; t < 3000 && m < n; t++) { const i = 2 + Math.floor(rnd() * (MN - 4)), j = 2 + Math.floor(rnd() * (MN - 4)); if (occ[id(i, j)] || isWater(i, j) || TAG[id(i, j)] === "ville" || collides(i, j, .3)) continue; animals.push({ kind, anim, i, j, hi: i, hj: j, ti: i, tj: j, wait: rnd() * 3, flip: false, phase: rnd() * 4, speed, r: .26 }); m++; } };
    spawn("chevre", "walk", 8, .7); spawn("lapin", "hop", 6, 1.4); spawn("renard", "walk", 3, 1.1); spawn("cerf", "walk", 3, .8);
    for (let t = 0, m = 0; t < 5000 && m < 14; t++) { const i = 2 + Math.floor(rnd() * (MN - 4)), j = 2 + Math.floor(rnd() * (MN - 4)); if (occ[id(i, j)] || isWater(i, j) || TAG[id(i, j)] === "ville" || Math.hypot(i - 76, j - 42) < 8 || collides(i, j, .3)) continue; const cid = "mc" + m; candles.push({ kind: "tourbillon", i, j, home: [i, j], ti: i, tj: j, phase: rnd() * 4, alive: !(Q.calmedIds || []).includes(cid), r: .26, id: cid }); m++; }
    const drop = (kind, n, pre, test) => { for (let t = 0, m = 0; t < 8000 && m < n; t++) { const i = 2 + Math.floor(hash(t, m, pre.length * 7 + 13) * (MN - 4)), j = 2 + Math.floor(hash(m, t, pre.length * 11 + 17) * (MN - 4)); if (occ[id(i, j)] || isWater(i, j) || !test(i, j) || collides(i, j, .3)) continue; occ[id(i, j)] = 1; const iid = pre + m; items.push({ kind, i, j, got: (Q.got || []).includes(iid), id: iid }); m++; } };
    drop("plume", 20, "mp", () => true);
    drop("edelweiss", 6, "me", (i, j) => { for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (inMap(i + a, j + b) && TAG[id(i + a, j + b)] === "roc") return true; return false; });
    beingsSolid.push(...npcs, ...animals);
    setScene(prev); return sc;
  }
  function enterMonts() { if (!MONTS) MONTS = buildMonts(); setScene(MONTS); AUDIO.sfx("whoosh"); duck.i = 76.6; duck.j = 42; duck.view = "dos"; say("Les Monts du Vent — le Refuge des Cimes est à l'ouest. Gare aux rafales !", 4); save(); }
  function leaveMonts() { setScene(WORLD); AUDIO.sfx("whoosh"); duck.i = 3.4; duck.j = 72; duck.view = "face"; say("Retour au Val de l'Étang.", 2.5); save(); }

  // Tour du Vent : # mur, V gouffre (franchissable avec les bottes), g glace fêlée (à briser en bondissant),
  // K clé, L porte, T coffre des bottes, F Plume du Vent, C tourbillon, E sortie
  const D3 = [
    "########.F.#########",
    "########...#########",
    "########...#########",
    "#########L##########",
    "#..................#",
    "#...C.........C....#",
    "#..................#",
    "#########.##########",
    "#########.##########",
    "#########g##########",
    "#########.##########",
    "######.......#######",
    "#....#......VV.....#",
    "#..T.#......VV..K..#",
    "#..........CVV.....#",
    "#....#......VV.....#",
    "########...#########",
    "########...#########",
    "########.E.#########",
    "####################",
  ];
  function buildTower() {
    const n = 20, sc = makeScene("tour", n, "pierre", { name: "Tour du Vent", inside: false, dark: true, parent: MONTS, retPos: { i: towerDoor.i, j: towerDoor.j + .3 } });
    const prev = cur; setScene(sc);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ch = D3[j][i];
      if (ch === "#") { place("murNeige", i, j); G[id(i, j)] = "gravier"; continue; }
      G[id(i, j)] = ch === "V" ? "vide" : hash(i, j, 47) < .25 ? "glace" : "pierre";
      if (ch === "g" && !(Q.d3.ice || []).includes(i + "," + j)) place("glaceFendue", i, j);
      if (ch === "K" && !Q.d3.key) items.push({ kind: "cle", i, j, got: false, id: "d3cle" });
      if (ch === "L" && !Q.d3.door) sc.door = place("porteBoisI", i, j);
      if (ch === "T") sc.chestT = place("coffre", i, j);
      if (ch === "F") sc.chestF = place("coffre", i, j);
      if (ch === "C") { const cid = "d3c" + candles.length; candles.push({ kind: "tourbillon", i, j, home: [i, j], ti: i, tj: j, phase: 0, alive: !(Q.calmedIds || []).includes(cid), r: .26, id: cid }); }
      if (ch === "E") { sc.exit = { i, j }; place("paillasson", i, j); }
    }
    for (const [i, j] of [[2, 12], [17, 12], [7, 15], [10, 15], [2, 4], [17, 4], [8, 10], [10, 11]]) if (D3[j][i] === ".") place("brasero", i, j);
    sc.boss = Q.d3.chestF ? null : makeBoss("tourbillon", "d3", 14, 5, [.5, 18.5, 3.6, 6.6]); sc.shots = [];
    setScene(prev); return sc;
  }
  function enterTower() {
    if (!TOWER) TOWER = buildTower();
    setScene(TOWER); AUDIO.sfx("whoosh"); duck.i = TOWER.exit.i; duck.j = TOWER.exit.j - 1.1; duck.view = "dos";
    say(Q.bottes ? "La Tour du Vent." : "La Tour du Vent… un coffre doit cacher les Bottes du Vent.", 4);
  }

  // ─── Bottes du Vent : un bond rapide (franchit les petits gouffres, brise la glace fêlée) ───
  function solidAt(i, j, r) {
    if (i < .6 || j < .6 || i > N - 1.6 || j > N - 1.6) return { prop: null };
    const ci = Math.round(i), cj = Math.round(j);
    for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) { const l = shapeGrid.get(id(a, b)); if (l) for (const s of l) if (hitShape(s, i, j, r)) return s; }
    return null;
  }
  function dash() {
    if (duck.dash || duck.hook) return;
    let d = duck.lastMove || (duck.view === "face" ? [.7, .7] : [-.7, -.7]); const L = Math.hypot(d[0], d[1]) || 1; d = [d[0] / L, d[1] / L];
    duck.dash = { di: d[0], dj: d[1], left: 3.3, from: [duck.i, duck.j] }; AUDIO.sfx("whoosh");
  }
  function dashUpdate(dt) {
    if (!duck.dash) return false;
    const D = duck.dash, st = Math.min(D.left, 14 * dt), ni = duck.i + D.di * st, nj = duck.j + D.dj * st;
    const bb = cur.boss;
    if (bb && bb.alive && bb.vis && Math.hypot(bb.i - ni, bb.j - nj) < bb.r + .45) { if (bb.type === "tourbillon" || bb.st === "stun" || bb.st === "tired" || bb.type === "follet") bossHit(bb, "bond"); endDash(); return true; }
    const hit = solidAt(ni, nj, duck.r);
    if (hit) {
      if (hit.prop && hit.prop.type === "glaceFendue") { const p = hit.prop; removeProp(p); Q.d3.ice.push(Math.round(p.i) + "," + Math.round(p.j)); AUDIO.sfx("hit"); sparkle(p.i, p.j, ["#e8f6ff", "#a8d4ee", "#ffffff"], 24); say("CRAC ! La glace vole en éclats.", 2.5); save(); }
      endDash(); return true;
    }
    duck.i = ni; duck.j = nj; D.left -= st;
    if (D.left <= 0) endDash();
    return true;
  }
  function endDash() {
    const D = duck.dash; duck.dash = null;
    if (isWater(Math.round(duck.i), Math.round(duck.j))) { duck.i = D.from[0]; duck.j = D.from[1]; burn({ i: duck.i - D.di * .01, j: duck.j - D.dj * .01 }); say("Plouf ! Trop court… élance-toi tout près du bord.", 3); }
  }
  // objets : C pour choisir, X pour utiliser
  const ITEM_NAMES = { grappin: "Grappin", bottes: "Bottes du Vent" };
  const ownedItems = () => [Q.grappin && "grappin", Q.bottes && "bottes"].filter(Boolean);
  const selItem = () => { const l = ownedItems(); return l.length ? l[(Q.sel || 0) % l.length] : null; };
  function cycleItem() { const l = ownedItems(); if (l.length < 2) { say(l.length ? "Tu n'as qu'un objet pour l'instant." : "Tu n'as pas encore d'objet.", 2); return; } Q.sel = ((Q.sel || 0) + 1) % l.length; AUDIO.sfx("blip"); say("Objet : " + ITEM_NAMES[selItem()], 1.5); }
  function useItem() { const it = selItem(); if (!it) { say("Tu n'as pas encore d'objet à utiliser.", 2); return; } if (dialog) return; if (it === "bottes") dash(); else useGrappin(); }
  // vent : pousse Dip Duck quand la rafale souffle
  const windOn = (w) => Math.sin(duck.t * Math.PI * 2 / w.period) > -.1;
  function windUpdate(dt) {
    if (!cur.winds || duck.dash || duck.hook) return;
    for (const w of cur.winds) if (duck.i >= w.i0 && duck.i <= w.i1 && duck.j >= w.j0 && duck.j <= w.j1 && windOn(w)) moveBody(duck, w.dir[0] * 2.1 * dt, w.dir[1] * 2.1 * dt, duck.r);
  }

  // ─── Boss des donjons ───
  // golem : fonce, se cogne au mur, sonné = vulnérable au coup de bec
  // follet : apparaît, tire des boules bleues, disparaît ; vulnérable quand il est visible
  // tourbillon : repousse Dip Duck ; seul un bond des Bottes du Vent le touche
  const BOSS_INFO = {
    golem: { name: "Le Golem des Échos", hp: 3, r: .55, kind: "golemCire" },
    follet: { name: "Le Grand Feu Follet", hp: 4, r: .5, kind: "grandFollet" },
    tourbillon: { name: "Le Roi Tourbillon", hp: 3, r: .55, kind: "roiTourbillon" },
    noire: { name: "La Bougie Noire", hp: 8, r: .6, kind: "bougieNoire" },
  };
  function makeBoss(type, key, i, j, room) {
    if (Q.bossDone[key]) return null;
    const I = BOSS_INFO[type];
    return { type, key, name: I.name, kind: I.kind, hp: I.hp, max: I.hp, r: I.r, i, j, home: [i, j], room, alive: true, engaged: false, st: "wait", t: 1.2, hurt: 0, phase: 0, vis: true, di: 0, dj: 0 };
  }
  const inRoom = (b) => duck.i >= b.room[0] && duck.i <= b.room[1] && duck.j >= b.room[2] && duck.j <= b.room[3];
  function bossDefeated(b) {
    b.alive = false; Q.bossDone[b.key] = true; AUDIO.sfx("fanfare");
    for (const c of candles) if (String(c.id).startsWith("noire") && c.alive) { c.alive = false; sparkle(c.i, c.j, ["#ffd23f", "#fff4b0"], 8); }
    cur.shots = [];
    sparkle(b.i, b.j, ["#ffd23f", "#fff4b0", "#6fd0ef", "#ff8fb1"], 60);
    say(b.name + " est calmé ! Le coffre est libre.", 5); save();
  }
  function bossHit(b, how) {
    if (b.hurt > 0) return;
    b.hp--; b.hurt = .7; AUDIO.sfx("hit"); sparkle(b.i, b.j, ["#ff8a3d", "#ffd23f", "#ffffff"], 14);
    if (b.hp <= 0) { bossDefeated(b); return; }
    if (b.type === "golem") { b.st = "wait"; b.t = .9; }
    if (b.type === "follet") { b.st = "vanish"; b.t = .5; }
    if (b.type === "tourbillon") { b.st = "stun"; b.t = .9; }
    if (b.type === "noire") { b.st = "chase"; b.t = 1.4; if (b.hp === 4) say("La Bougie Noire s'embrase ! Elle fonce maintenant… fais-la se cogner aux murs !", 3.5); }
    say(`${b.name} : encore ${b.hp} !`, 1.8);
  }
  // coup de bec sur un boss (renvoie true si un boss était à portée)
  function bossPeck() {
    const b = cur.boss; if (!b || !b.alive || !b.vis || !near(b, 1.5)) return false;
    if (b.type === "golem" && b.st !== "stun") { say("Trop dur ! Attends qu'il se cogne contre un mur.", 2); return true; }
    if (b.type === "noire" && b.st !== "tired" && b.st !== "stun") { say("Sa flamme noire te repousse ! Attends qu'elle s'essouffle.", 2); return true; }
    if (b.type === "tourbillon") { say("Le vent te repousse ! Fonce-lui dessus avec les Bottes du Vent (X).", 2.5); return true; }
    bossHit(b, "bec"); return true;
  }
  function freeRoomCell(b) {
    for (let k = 0; k < 60; k++) { const i = b.room[0] + .5 + rnd() * (b.room[1] - b.room[0] - 1), j = b.room[2] + .5 + rnd() * (b.room[3] - b.room[2] - 1); if (!collides(i, j, b.r) && Math.hypot(i - duck.i, j - duck.j) > 3) return [i, j]; }
    return b.home;
  }
  function bossUpdate(dt) {
    const b = cur.boss; if (!b || !b.alive) return;
    if (!b.engaged) { if (inRoom(b)) { b.engaged = true; say(b.name + " !", 2.5); AUDIO.sfx("gate"); } else return; }
    b.phase += dt * 5; b.hurt = Math.max(0, b.hurt - dt); b.t -= dt;
    const dd = Math.hypot(b.i - duck.i, b.j - duck.j);
    if (b.type === "golem") {
      if (b.st === "wait" && b.t <= 0) { b.st = "prep"; b.t = .7; }
      else if (b.st === "prep" && b.t <= 0) { const d = Math.max(.01, dd); b.di = (duck.i - b.i) / d; b.dj = (duck.j - b.j) / d; b.st = "charge"; b.t = 3; AUDIO.sfx("push"); }
      else if (b.st === "charge") { const sp = 7 * dt; if (solidAt(b.i + b.di * sp, b.j + b.dj * sp, b.r) || b.t <= 0) { b.st = "stun"; b.t = 2.2; AUDIO.sfx("hit"); say("BOUM ! Il est sonné : vite, un coup de bec !", 2); } else { b.i += b.di * sp; b.j += b.dj * sp; } }
      else if (b.st === "stun" && b.t <= 0) { b.st = "wait"; b.t = .5; }
      if (dd < b.r + .35 && b.st !== "stun") burn(b);
    } else if (b.type === "follet") {
      if (b.st === "wait") { b.st = "show"; b.t = 1.8; b.shots = 0; b.vis = true; }
      if (b.st === "show") { if (b.t < 1.5 - b.shots * .45 && b.shots < 3) { b.shots++; const d = Math.max(.01, dd), a = (b.shots - 2) * .25, ci = (duck.i - b.i) / d, cj = (duck.j - b.j) / d; cur.shots.push({ i: b.i, j: b.j, vi: (ci * Math.cos(a) - cj * Math.sin(a)) * 4.2, vj: (ci * Math.sin(a) + cj * Math.cos(a)) * 4.2, t: 0 }); AUDIO.sfx("miss"); } if (b.t <= 0) { b.st = "vanish"; b.t = .6; } }
      else if (b.st === "vanish") { b.vis = false; if (b.t <= 0) { [b.i, b.j] = freeRoomCell(b); b.st = "show"; b.t = 1.8; b.shots = 0; b.vis = true; AUDIO.sfx("whoosh"); } }
      if (b.vis && dd < b.r + .3) burn(b);
    } else if (b.type === "noire") { noireUpdate(b, dt, dd);
    } else if (b.type === "tourbillon") {
      if (b.st === "stun") { if (b.t <= 0) b.st = "move"; }
      else { if (!b.di && !b.dj || b.t <= 0) { const a = rnd() * Math.PI * 2; b.di = Math.cos(a); b.dj = Math.sin(a); b.t = 1.6; b.st = "move"; } const sp = 3 * dt; if (solidAt(b.i + b.di * sp, b.j + b.dj * sp, b.r) || isWater(Math.round(b.i + b.di), Math.round(b.j + b.dj))) { b.di = -b.di; b.dj = -b.dj; } else { b.i += b.di * sp; b.j += b.dj * sp; } }
      if (dd < 2.6 && !duck.dash) { const d = Math.max(.3, dd); moveBody(duck, (duck.i - b.i) / d * 2.6 * dt, (duck.j - b.j) / d * 2.6 * dt, duck.r); }
      if (dd < b.r + .3 && !duck.dash) burn(b);
    }
  }
  function shotsUpdate(dt) {
    if (!cur.shots || !cur.shots.length) return;
    for (const s of cur.shots) { s.t += dt; s.i += s.vi * dt; s.j += s.vj * dt; if (s.t > 3 || solidAt(s.i, s.j, .08)) s.dead = true; else if (Math.hypot(s.i - duck.i, s.j - duck.j) < .45) { burn(s); s.dead = true; } }
    cur.shots = cur.shots.filter((s) => !s.dead);
  }

  // ─── Région 4 : la Côte aux Phares (et le Phare de la Bougie Noire) ───
  for (const p of [...props]) if (Math.hypot(p.i - 109.4, p.j - 50) < 2.5) removeProp(p);
  const worldArch3 = place("archeCote", 109.4, 50);
  worldArch3.zone = { i: 110.1, j: 50, scene: WORLD };
  WORLD.passages.push({ i: 109.4, j: 50, name: "→ Côte aux Phares" });
  const CN = 80;
  let COTE = null, PHARE = null, CAPITAINE = null, phareDoor = null, coteArch = null;
  function buildCote() {
    const sc = makeScene("cote", CN, "herbe", { name: "Côte aux Phares", inside: false, outdoor: true, places: [{ i: 26, j: 42, name: "Port-Plume" }, { i: 66, j: 16, name: "Phare de la Bougie Noire" }, { i: 62, j: 54, name: "Îlot" }], passages: [{ i: 2, j: 40, name: "→ Val de l'Étang" }] });
    const prev = cur; setScene(sc);
    for (let i = 0; i < CN; i++) for (let j = 0; j < CN; j++) {
      const k = id(i, j), n1 = noise(i + 1100, j + 1100, 71), shore = 46 + Math.sin(j / 9) * 4 + (n1 - .5) * 3;
      let t = hash(i, j, 81) < .08 ? "fleurs" : "herbe", tag = "";
      if (i > shore) { t = hash(i, j, 5) < .04 ? "nenuphar" : "eau"; tag = "eau"; } else if (i > shore - 4) { t = "sable"; tag = "plage"; }
      if (Math.hypot(i - 66, j - 16) < 5.2 + n1) { t = Math.hypot(i - 66, j - 16) < 2.8 ? "pierre" : "gravier"; tag = "ile"; }
      if (Math.hypot(i - 62, j - 54) < 2.4) { t = "sable"; tag = "ile"; }
      if (!tag && n1 > .66) { t = "foret"; tag = "foret"; }
      G[k] = t; TAG[k] = tag;
    }
    const PP = { i: 26, j: 42, r: 7 };
    for (let i = 0; i < CN; i++) for (let j = 0; j < CN; j++) { const d = Math.hypot(i - PP.i, j - PP.j); if (d < PP.r && TAG[id(i, j)] !== "eau") { TAG[id(i, j)] = "ville"; G[id(i, j)] = d < 2.6 ? "paves" : G[id(i, j)] === "sable" ? "sable" : "herbe"; } }
    road({ i: 2, j: 40 }, { i: 20, j: 42 }); road({ i: 32, j: 40 }, { i: 50, j: 16 }); road({ i: 50, j: 16 }, { i: 63, j: 16 }); road({ i: 30, j: 46 }, { i: 44, j: 56 });
    // port : cabanes de pêcheurs au bord de l'eau, bateaux
    place("fontaine", 26, 42);
    for (let a = 0; a < 6; a++) { const ang = a / 6 * Math.PI * 2 + .3, i = Math.round(26 + Math.cos(ang) * 5), j = Math.round(42 + Math.sin(ang) * 5); if (freeCell(i, j, 1)) place(["maison", "etal", "maison", "taverne", "etal", "puits"][a], (a % 2 === 0 || a === 3) ? i + .5 : i, (a % 2 === 0 || a === 3) ? j + .5 : j); }
    for (const j of [30, 36, 50, 58]) { let i = 30; while (i < 70 && TAG[id(i, j)] !== "eau") i++; if (i < 70) place("cabanePecheur", i - 1.4, j); }
    for (const [i, j] of [[60, 34], [64, 44], [58, 66], [70, 28]]) if (isWater(i, j)) place(hash(i, j, 3) < .5 ? "voilier" : "barque", i, j);
    for (const [i, j] of [[24, 39.4], [28.6, 44.6], [23.4, 44.4]]) if (!occ[id(Math.round(i), Math.round(j))]) place("lanterne", i, j);
    // le phare sur son île, au bout du long pont
    sc.phare = place(Q.d4.chestF ? "phare" : "phareEteint", 67, 15); phareDoor = { i: 67.8, j: 16.2, scene: sc };
    for (const [i, j] of [[64, 13], [64, 19]]) place("brasero", i, j);
    // îlot au coffre : poteaux pour le grappin
    let sh = 54; for (let i = 62; i > 40; i--) if (!isWater(i, 54) && TAG[id(i, 54)] !== "ile") { sh = i; break; }
    place("poteau", sh - 1, 54); place("poteau", 60.8, 54); sc.isleChest = place("coffre", 62.6, 53.4);
    coteArch = place("archeVal3", 2, 40); coteArch.zone = { i: 1.6, j: 40, scene: sc };
    // nature
    for (let i = 1; i < CN - 1; i++) for (let j = 1; j < CN - 1; j++) {
      const k = id(i, j), tag = TAG[k], h = hash(i + 1300, j, 77);
      if (occ[k] || isWater(i, j) || tag === "route" || tag === "ville" || tag === "ile" || G[k] === "pont") continue;
      if (tag === "plage") { if (h < .03) place("rocher", i, j); else if (h < .05) place("roseaux", i, j); continue; }
      if (tag === "foret") { if (h < .45) place(["arbre", "sapin", "arbre2"][Math.floor(hash(i, j, 8) * 3)], i, j); continue; }
      if (h < .03) place(["arbre", "buisson", "rocher"][Math.floor(hash(i, j, 8) * 3)], i, j); else if (h < .08) place(["fleurs", "herbes"][Math.floor(hash(i, j, 8) * 2)], i, j);
    }
    CAPITAINE = { kind: "goeland", dlg: "capitaine", i: 28.4, j: 40.4, name: "La Capitaine Mouette", r: .3, scene: sc };
    npcs.push(CAPITAINE, { kind: "castor", i: 24, j: 44.6, name: "Le Vieux Pêcheur", r: .32, lines: ["Depuis que la Bougie Noire s'est installée dans le phare, il ne guide plus les bateaux.", "Les poissons ont peur, les marins aussi. Il faut rallumer la vraie lumière !"] },
      { kind: "grenouille", i: 27.6, j: 44.6, name: "Ti-Grenouille", r: .3, lines: ["Grand-père Grenouille, c'est mon arrière-grand-oncle !", "Il dit que la Bougie Noire n'est pas méchante… qu'elle a juste avalé toute la peur de l'Étang."] });
    const spawn = (kind, anim, n, speed) => { for (let t = 0, m = 0; t < 3000 && m < n; t++) { const i = 2 + Math.floor(rnd() * (CN - 4)), j = 2 + Math.floor(rnd() * (CN - 4)); if (occ[id(i, j)] || isWater(i, j) || TAG[id(i, j)] === "ville" || TAG[id(i, j)] === "ile" || collides(i, j, .3)) continue; animals.push({ kind, anim, i, j, hi: i, hj: j, ti: i, tj: j, wait: rnd() * 3, flip: false, phase: rnd() * 4, speed, r: .26 }); m++; } };
    spawn("mouton", "walk", 6, .6); spawn("poule", "peck", 6, .7); spawn("lapin", "hop", 4, 1.4);
    for (let t = 0, m = 0; t < 5000 && m < 14; t++) { const i = 2 + Math.floor(rnd() * (CN - 4)), j = 2 + Math.floor(rnd() * (CN - 4)); if (occ[id(i, j)] || isWater(i, j) || TAG[id(i, j)] === "ville" || i < 10 || collides(i, j, .3)) continue; const cid = "cc" + m; candles.push({ i, j, home: [i, j], ti: i, tj: j, phase: rnd() * 4, alive: !(Q.calmedIds || []).includes(cid), r: .26, id: cid }); m++; }
    const drop = (kind, n, pre, test) => { for (let t = 0, m = 0; t < 9000 && m < n; t++) { const i = 2 + Math.floor(hash(t, m, pre.length * 7 + 23) * (CN - 4)), j = 2 + Math.floor(hash(m, t, pre.length * 11 + 29) * (CN - 4)); if (occ[id(i, j)] || isWater(i, j) || !test(i, j) || collides(i, j, .3)) continue; occ[id(i, j)] = 1; const iid = pre + m; items.push({ kind, i, j, got: (Q.got || []).includes(iid), id: iid }); m++; } };
    drop("plume", 20, "cp", () => true);
    drop("coquillage", 6, "cq", (i, j) => TAG[id(i, j)] === "plage");
    beingsSolid.push(...npcs, ...animals);
    setScene(prev); return sc;
  }
  function enterCote() { if (!COTE) COTE = buildCote(); setScene(COTE); AUDIO.sfx("whoosh"); duck.i = 3.4; duck.j = 40; duck.view = "face"; say("La Côte aux Phares — Port-Plume est tout près. Le phare est éteint…", 4); save(); }
  function leaveCote() { setScene(WORLD); AUDIO.sfx("whoosh"); duck.i = 108; duck.j = 50; duck.view = "face"; say("Retour au Val de l'Étang.", 2.5); save(); }

  // Le Phare : B bloc, P plaque, G grille, V gouffre (bond), o poteau (grappin), K clé, L porte, F Plume de Lumière, C bougie, E sortie
  const D4 = [
    "####################",
    "#........F.........#",
    "#..................#",
    "#..................#",
    "#..................#",
    "##########L#########",
    "#....o.........o...#",
    "#..................#",
    "#VVVVVVVVVVVVVVVVVV#",
    "#VVVVVVVVVVVVVVVVVV#",
    "#VVVVVVVVVVVVVVVVVV#",
    "#..................#",
    "#....o.........o...#",
    "#######G############",
    "#.....#.....#..VV..#",
    "#..B..#..C..#..VV.K#",
    "#.....#........VV..#",
    "#...P.......#..VV..#",
    "#.....#..E..#..VV..#",
    "####################",
  ];
  function buildPhare() {
    const n = 20, sc = makeScene("phare", n, "pierre", { name: "Phare de la Bougie Noire", inside: false, dark: true, parent: COTE, retPos: { i: phareDoor.i + .3, j: phareDoor.j + .3 }, blocks: [] });
    const prev = cur; setScene(sc);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ch = D4[j][i];
      if (ch === "#") { place("murPhare", i, j); G[id(i, j)] = "gravier"; continue; }
      G[id(i, j)] = ch === "V" ? "vide" : hash(i, j, 53) < .25 ? "gravier" : "pierre";
      if (ch === "o") place("poteau", i, j);
      if (ch === "B") { const at = Q.d4.block || [i, j]; sc.blocks.push(place("bloc", at[0], at[1])); sc.blockHome = [i, j]; }
      if (ch === "P") sc.plate = place(Q.d4.gate ? "plaqueOn" : "plaque", i, j);
      if (ch === "G" && !Q.d4.gate) sc.gate = place("grille", i, j);
      if (ch === "K" && !Q.d4.key) items.push({ kind: "cle", i, j, got: false, id: "d4cle" });
      if (ch === "L" && !Q.d4.door) sc.door = place("porteBoisI", i, j);
      if (ch === "F") sc.chestF = place("coffre", i, j);
      if (ch === "C") { const cid = "d4c" + candles.length; candles.push({ i, j, home: [i, j], ti: i, tj: j, phase: 0, alive: !(Q.calmedIds || []).includes(cid), r: .26, id: cid }); }
      if (ch === "E") { sc.exit = { i, j }; place("paillasson", i, j); }
    }
    for (const [i, j] of [[1, 14], [11, 14], [1, 18], [11, 18], [2, 1], [17, 1], [2, 4], [17, 4], [1, 7], [18, 7]]) if (D4[j][i] === ".") place("brasero", i, j);
    sc.boss = Q.d4.chestF ? null : makeBoss("noire", "d4", 14, 2.5, [.5, 18.5, .5, 4.5]); sc.shots = [];
    setScene(prev); return sc;
  }
  function enterPhare() {
    if (!PHARE) PHARE = buildPhare();
    else if (!Q.d4.gate) { const prev = cur; setScene(PHARE); const b = PHARE.blocks[0]; if (b) removeProp(b); PHARE.blocks[0] = place("bloc", ...PHARE.blockHome); Q.d4.block = null; setScene(prev); }
    setScene(PHARE); AUDIO.sfx("whoosh"); duck.i = PHARE.exit.i; duck.j = PHARE.exit.j - 1.1; duck.view = "dos";
    say(Q.d4.chestF ? "Le phare est calme." : "Le Phare… tout en haut, une flamme noire. Il faudra tous tes objets.", 4);
  }
  // mécanismes du phare : bloc à pousser (même règle que la grotte), plaque, grille, porte
  function phareUpdate(dt) {
    if (cur !== PHARE) return;
    const b = PHARE.blocks[0];
    if (b && duck.moving) {
      const di = b.i - duck.i, dj = b.j - duck.j, ax = Math.abs(di) > Math.abs(dj) ? [Math.sign(di), 0] : [0, Math.sign(dj)];
      const along = ax[0] ? di * ax[0] : dj * ax[1], side = ax[0] ? Math.abs(dj) : Math.abs(di), mv = duck.lastMove || [0, 0], dot = mv[0] * ax[0] + mv[1] * ax[1];
      if (dot > .3 && along > 0 && along < 1.9 && side < .6) {
        duck.pushAxis = ax; const k = Math.min(1, dt * 10);
        if (ax[0]) moveBody(duck, 0, (b.j - duck.j) * k, duck.r); else moveBody(duck, (b.i - duck.i) * k, 0, duck.r);
        if (along < 1) { PHARE.pushT = (PHARE.pushT || 0) + dt; if (PHARE.pushT > .22) { PHARE.pushT = 0; const ti = Math.round(b.i) + ax[0], tj = Math.round(b.j) + ax[1]; if (D4[tj] && D4[tj][ti] !== "#" && D4[tj][ti] !== "V" && D4[tj][ti] !== "G" && !candles.some((c) => c.alive && Math.round(c.i) === ti && Math.round(c.j) === tj)) { AUDIO.sfx("push"); removeProp(b); PHARE.blocks[0] = place("bloc", ti, tj); Q.d4.block = [ti, tj]; } else say("Le bloc ne bouge pas de ce côté.", 1.5); } }
      } else { duck.pushAxis = null; PHARE.pushT = 0; }
    } else duck.pushAxis = null;
    const bb = PHARE.blocks[0];
    if (PHARE.gate && bb && Math.round(bb.i) === Math.round(PHARE.plate.i) && Math.round(bb.j) === Math.round(PHARE.plate.j)) { removeProp(PHARE.gate); PHARE.gate = null; Q.d4.gate = true; removeProp(PHARE.plate); PHARE.plate = place("plaqueOn", PHARE.plate.i, PHARE.plate.j); AUDIO.sfx("gate"); say("Clac ! La grille du phare se lève.", 3.5); save(); }
    if (PHARE.door && near(PHARE.door, 1.05)) {
      if (Q.d4.key) { removeProp(PHARE.door); PHARE.door = null; Q.d4.door = true; AUDIO.sfx("unlock"); say("La porte du sommet s'ouvre… une chaleur noire en sort.", 3.5); save(); }
      else if (lockMsg <= 0) { say("Fermée à clé. La clé est derrière le gouffre, en bas à droite.", 3.5); lockMsg = 4; }
    }
  }
  // la Bougie Noire : poursuit, tire en éventail puis s'épuise (vulnérable) ; à mi-vie, elle fonce aussi comme le golem
  function noireUpdate(b, dt, dd) {
    if (b.st === "wait") { b.st = "chase"; b.t = 2.4; }
    if (b.st === "chase") { const d = Math.max(.01, dd), sp = (b.hp <= 4 ? 1.9 : 1.3) * dt; moveBody(b, (duck.i - b.i) / d * sp, (duck.j - b.j) / d * sp, b.r); if (b.t <= 0) { b.st = "shoot"; b.t = .5; } }
    else if (b.st === "shoot" && b.t <= 0) {
      const d = Math.max(.01, dd), ci = (duck.i - b.i) / d, cj = (duck.j - b.j) / d, n = b.hp <= 4 ? 7 : 5;
      for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * .28; cur.shots.push({ i: b.i, j: b.j, vi: (ci * Math.cos(a) - cj * Math.sin(a)) * 4, vj: (ci * Math.sin(a) + cj * Math.cos(a)) * 4, t: 0, red: true }); }
      AUDIO.sfx("hurt"); b.cycle = (b.cycle || 0) + 1;
      if (b.cycle % 2 === 0 && candles.filter((c) => c.alive).length < 4) for (const s of [-1, 1]) candles.push({ i: b.i + s, j: b.j + 1, home: [b.i, b.j + 1], ti: b.i, tj: b.j, phase: 0, alive: true, r: .26, id: "noire" + Math.random() });
      b.st = "tired"; b.t = 1.7; say("Elle s'essouffle : vite, un coup de bec !", 1.6);
    }
    else if (b.st === "tired" && b.t <= 0) { if (b.hp <= 4) { b.st = "prep"; b.t = .7; } else { b.st = "chase"; b.t = 2.4; } }
    else if (b.st === "prep" && b.t <= 0) { const d = Math.max(.01, dd); b.di = (duck.i - b.i) / d; b.dj = (duck.j - b.j) / d; b.st = "charge"; b.t = 2.5; }
    else if (b.st === "charge") { const sp = 7.5 * dt; if (solidAt(b.i + b.di * sp, b.j + b.dj * sp, b.r) || b.t <= 0) { b.st = "stun"; b.t = 2; AUDIO.sfx("hit"); } else { b.i += b.di * sp; b.j += b.dj * sp; } }
    else if (b.st === "stun" && b.t <= 0) { b.st = "chase"; b.t = 2; }
    if (dd < b.r + .35 && b.st !== "tired" && b.st !== "stun") burn(b);
  }
  // fin de l'acte I
  let ending = 0;
  function startEnding() { ending = 1; AUDIO.sfx("fanfare"); setTimeout(() => AUDIO.sfx("coeur"), 900); }

  // ─── Quêtes ───
  const Q = { main: 0, calmed: 0, side: 0, champis: 0, plumes: 0, maxHearts: 5, pieces: 0, chests: [], foret: 0, lucioles: 0, grappin: false, d2: { key: false, door: false, chestG: false, chestF: false }, calmedIds: [], got: [], bossDone: {}, cote: 0, coq: 0, capReward: false, isle2: false, time: 0, d4: { key: false, door: false, gate: false, block: null, chestF: false }, monts: 0, bottes: false, sel: 0, edel: 0, guideReward: false, d3: { key: false, door: false, chestT: false, chestF: false, ice: [] }, owlReward: false, fiole: false, island: false, d1: { key: false, door: false, gate: false, chest: false, block: null, calmed: [] } };
  const chest = { i: R0.i, j: R0.j - .5 };
  const MAIN = [
    { text: "Parle à Grand-père Grenouille, au Village de l'Étang.", target: () => FROG },
    { text: () => `Calme 10 bougies rouges dans les champs et les prés (${Math.min(Q.calmed, 10)}/10).`, target: () => nearestCandle() },
    { text: "Retourne voir Grand-père Grenouille.", target: () => FROG },
    { text: () => `Retrouve les 3 canetons perdus (${ducklings.filter((d) => d.got).length}/3).`, target: () => ducklings.find((d) => !d.got) },
    { text: "Ramène les nouvelles à Grand-père Grenouille.", target: () => FROG },
    { text: "Va aux Ruines du Calme, au sud-est, et calme la Grande Bougie.", target: () => (boss.alive ? boss : chest) },
    { text: "Ouvre le coffre des ruines.", target: () => chest },
    { text: "Rapporte la Plume du Calme à Grand-père Grenouille.", target: () => FROG },
    { text: "L'Étang est calme… pour l'instant. Explore et collectionne !", target: () => null },
  ];
  const DIALOGS = {
    grenouille: () => [
      ["Bienvenue au Village de l'Étang, petit !", "Les bougies rouges se sont réveillées : elles sèment la panique partout.", "Calmes-en dix d'un bon coup de bec. Mais attention, ça brûle !"],
      ["Continue ! Il en reste encore dans les champs et les prés."],
      ["Bravo ! Les champs respirent.", "Mais trois de nos canetons se sont perdus en fuyant les bougies.", "Le Goéland du Port et le Castor du Hameau les ont peut-être vus. Retrouve-les !"],
      ["Les canetons comptent sur toi. Ouvre la carte (touche M) si tu te perds."],
      ["Les trois canetons sont rentrés ! Merci, Dip Duck.", "Une Grande Bougie s'est installée aux Ruines du Calme, au sud-est.", "Elle garde la Plume du Calme. Va la chercher, et sois prudent."],
      ["La Grande Bougie est aux Ruines du Calme, au sud-est. Suis la route."],
      ["Le coffre des ruines contient la Plume du Calme. Ouvre-le !"],
      ["La Plume du Calme ! L'Étang retrouve son souffle.", "Mais j'ai un drôle de pressentiment… Madame Crapaude parle d'époques qui changent.", "On dit qu'une deuxième Plume dort dans la Forêt Profonde, au bout du sentier nord du Campement des Bois."],
      ["La Forêt Profonde t'attend, au nord du Campement des Bois. Bonne route, petit !"],
    ][Q.main],
    crapaude: () => (Q.side === 0 ? ["Je vois… des usines, des machines, des chaînes de blocs… l'Étang ne restera pas un village.", "En attendant, il me faut des champignons pour mes visions. Rapporte-m'en 12, de la forêt et du marais."]
      : Q.side === 1 ? (Q.champis >= 12 ? ["Douze champignons ! Mes visions s'éclaircissent.", "Tiens : un cœur de plus, pour les épreuves à venir."] : [`Encore des champignons, petit : ${Q.champis}/12.`])
        : ["Les époques changeront. Garde ton calme, et ne crois jamais un cadeau trop beau pour être vrai."]),
    capitaine: () => (Q.cote === 0 ? ["Ahoy, petit canard ! Je suis la Capitaine Mouette.", "Le phare s'est éteint quand la Bougie Noire s'y est installée. Depuis, les bateaux se perdent.", "Prends le long pont vers l'île du phare. Il te faudra le bloc, les bottes ET le grappin."]
      : Q.cote === 1 ? ["Le phare est au bout du long pont, au nord-est.", Q.coq >= 6 && !Q.capReward ? "Six coquillages ! Merci, moussaillon." : `Ramène-moi des coquillages de la plage : ${Q.coq}/6.`]
        : Q.cote === 2 ? ["LA LUMIÈRE EST REVENUE ! Regarde le phare briller…", "La Bougie Noire n'était que la peur de l'Étang. Tu l'as calmée, Dip Duck.", "Les quatre Plumes du Calme sont réunies. L'Étang te doit tout !"]
          : [Q.coq >= 6 && !Q.capReward ? "Six coquillages ! Merci, moussaillon." : `Mes coquillages : ${Q.coq}/6.`, "Le phare guide de nouveau les bateaux, grâce à toi."]),
    guide: () => (Q.monts === 0 ? ["Bienvenue au Refuge des Cimes, voyageur à plumes !", "La troisième Plume du Calme est tout en haut de la Tour du Vent, au nord.", "Méfie-toi des rafales : attends qu'elles retombent pour traverser."]
      : Q.monts === 1 ? ["La Tour du Vent est au bout du sentier, au nord du refuge.", Q.edel >= 6 && !Q.guideReward ? "Six edelweiss ! Tu as l'œil, petit." : `Si tu trouves des edelweiss près des falaises, apporte-les-moi : ${Q.edel}/6.`]
        : Q.monts === 2 ? ["La Plume du Vent ! Trois Plumes du Calme réunies.", "La Bougie Noire doit trembler… mais repose-toi, la suite viendra."]
          : [Q.edel >= 6 && !Q.guideReward ? "Six edelweiss ! Merci, petit." : `Mes edelweiss : ${Q.edel}/6.`, "Le vent est plus doux depuis que tu es passé."]),
    hibou: () => (Q.foret === 0 ? ["Hou-hou… Un canard au cœur calme ! On t'attendait.", "La deuxième Plume du Calme dort au fond du Temple Moussu, au nord de la forêt.", "Le temple est plein de gouffres : cherche d'abord le grappin caché dans ses salles."]
      : Q.foret === 1 ? ["Le Temple Moussu est au bout du sentier, tout au nord.", Q.lucioles >= 8 && !Q.owlReward ? "Oh ! Tu as trouvé mes 8 lucioles ! Merci." : `Si tu croises des lucioles, ramène-les-moi : ${Q.lucioles}/8.`]
        : Q.foret === 2 ? ["La Plume de la Forêt ! Deux Plumes du Calme sont réunies.", "Mais la Bougie Noire n'a pas dit son dernier mot… Repose-toi, petit, la suite viendra."]
          : [Q.lucioles >= 8 && !Q.owlReward ? "Mes 8 lucioles ! Merci, petit." : `Mes lucioles, petit : ${Q.lucioles}/8.`, "La forêt respire mieux grâce à toi."]),
    castor: () => ["Un caneton ? J'en ai vu un filer vers le marais, au sud. Ça sent la boue là-bas !", "Petit conseil de castor : ne montre jamais à tout le monde ce que tu possèdes."],
    goeland: () => ["Du haut de ma tour, j'ai vu un caneton près des montagnes, au nord, et un autre dans la forêt du campement.", "Et les ruines au sud-est… une lueur rouge y brille toutes les nuits."],
  };
  const FQ = [
    { text: "Va dans la Forêt Profonde (sentier au nord du Campement des Bois) et trouve la Chouette Sage.", target: () => (FOREST ? OWL : worldArch.zone) },
    { text: "Explore le Temple Moussu, au nord de la forêt, et trouve la Plume de la Forêt.", target: () => (FOREST ? templeDoor : worldArch.zone) },
    { text: "Rapporte la Plume de la Forêt à la Chouette Sage.", target: () => (FOREST ? OWL : worldArch.zone) },
    { text: "Deux Plumes du Calme réunies ! La suite arrive bientôt… Explore et collectionne.", target: () => null },
  ];
  const MQ = [
    { text: "Va dans les Monts du Vent (sentier à l'ouest du Hameau du Moulin) et trouve le Guide des Cimes.", target: () => (MONTS ? GUIDE : worldArch2.zone) },
    { text: "Monte à la Tour du Vent, au nord des Monts, et trouve la Plume du Vent.", target: () => (MONTS ? towerDoor : worldArch2.zone) },
    { text: "Rapporte la Plume du Vent au Guide des Cimes.", target: () => (MONTS ? GUIDE : worldArch2.zone) },
    { text: "Trois Plumes du Calme réunies ! La suite arrive bientôt… Explore et collectionne.", target: () => null },
  ];
  const CQ = [
    { text: "Va sur la Côte aux Phares (route à l'est du Port du Lac) et parle à la Capitaine Mouette.", target: () => (COTE ? CAPITAINE : worldArch3.zone) },
    { text: "Traverse le long pont jusqu'au Phare et affronte la Bougie Noire.", target: () => (COTE ? phareDoor : worldArch3.zone) },
    { text: "Rapporte la Plume de Lumière à la Capitaine Mouette.", target: () => (COTE ? CAPITAINE : worldArch3.zone) },
    { text: "Fin de l'Acte I — merci d'avoir joué ! Explore et collectionne tout.", target: () => null },
  ];
  const curQuest = () => (Q.main < 8 ? MAIN[Q.main] : Q.foret < 3 ? FQ[Q.foret] : Q.monts < 3 ? MQ[Q.monts] : CQ[Math.min(Q.cote, 3)]);
  function aimFor(goal) {
    if (cur === TEMPLE || cur === DUNGEON || cur === TOWER || cur === PHARE) return null;
    if (!cur.outdoor) return cur.exit;
    if (!goal) return null;
    const gs = goal.scene || WORLD;
    if (gs === cur) return goal;
    if (cur === WORLD) return gs === COTE || gs === PHARE || goal === worldArch3.zone ? worldArch3.zone : gs === MONTS || gs === TOWER || goal === worldArch2.zone ? worldArch2.zone : worldArch.zone;
    return cur === FOREST ? forestArch.zone : cur === COTE ? coteArch.zone : montsArch.zone;
  }
  function nearestCandle() { let best = null, bd = 1e9; for (const c of WORLD.candles) if (c.alive) { const d = Math.hypot(c.i - duck.i, c.j - duck.j); if (d < bd) { bd = d; best = c; } } return best; }

  // ─── Dip Duck ───
  const duck = { i: V.i + 1.5, j: V.j + 1.5, view: "face", flip: false, t: 0, moving: false, peck: 0, hurt: 0, hearts: 5, r: .28 };
  const particles = [];
  let dialog = null, message = "", messageT = 0, showMap = false;
  const say = (m, t = 3.5) => { message = m; messageT = t; };
  const SAVE = "dipduck-proto-v2";
  function save() { try { localStorage.setItem(SAVE, JSON.stringify({ sc: (cur.outdoor ? cur : cur.parent || WORLD).id, d: cur.outdoor ? [duck.i, duck.j] : cur.retPos ? [cur.retPos.i, cur.retPos.j] : [WORLD.ret.i, WORLD.ret.j], Q, c: WORLD.candles.filter((c) => !c.alive).map((c) => c.id), it: WORLD.items.filter((x) => x.got).map((x) => x.id), dk: ducklings.filter((x) => x.got).map((x) => x.id), b: boss.alive })); } catch { /* */ } }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE) || "null"); if (!s) return false;
      [duck.i, duck.j] = s.d; Object.assign(Q, s.Q); for (const c of candles) if (s.c.includes(c.id)) c.alive = false;
      for (const x of items) if (s.it.includes(x.id)) x.got = true; for (const x of ducklings) if (s.dk.includes(x.id)) x.got = true; boss.alive = s.b; duck.hearts = Q.maxHearts;
      if (s.sc === "foret") { FOREST = buildForest(); setScene(FOREST); [duck.i, duck.j] = s.d; }
      if (s.sc === "cote") { COTE = buildCote(); setScene(COTE); [duck.i, duck.j] = s.d; }
      if (s.sc === "monts") { MONTS = buildMonts(); setScene(MONTS); [duck.i, duck.j] = s.d; }
      return true;
    } catch { return false; }
  }
  if (!load()) say("Parle à Grand-père Grenouille, juste à côté. (Espace / QUACK)", 6); else say("Partie reprise. Bon retour à l'Étang !", 4);
  setInterval(save, 5000);

  // ─── Images en cache (ImageBitmap = rapide) ───
  const cache = new Map();
  const mk = (w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; };
  const bmp = (s) => { if (window.createImageBitmap) createImageBitmap(s.cv).then((b) => { s.cv = b; }); return s; };
  function tileSprite(type, v) {
    const sea = cur.outdoor ? (cur.snow ? "hiver" : season) : "ete", key = sea + ":t:" + type + v; if (cache.has(key)) return cache.get(key);
    const cv = mk(132, 72), c = cv.getContext("2d"); DD.setSeason(season === "automne" ? "automne" : "ete"); DD.setSeed(type.length * 53 + v * 977 + 3);
    const wet = type === "eau" || type === "nenuphar";
    if (sea === "hiver" && wet) c.filter = "saturate(.3) brightness(1.45)";
    DD.GROUND[type](c, 66, 36); c.filter = "none";
    if (sea === "hiver" && !wet && type !== "pont") { c.globalAlpha = ["terre", "paves", "pierre", "gravier"].includes(type) ? .45 : .86; DD.GROUND.neige(c, 66, 36); c.globalAlpha = 1; }
    const s = bmp({ cv, ax: 66, ay: 36 }); cache.set(key, s); return s;
  }
  function propSprite(type, v) {
    const pse = cur.snow ? "hiver" : season, key = pse + ":p:" + type + v; if (cache.has(key)) return cache.get(key);
    const [w, h, ax, ay, f] = PROPS[type], cv = mk(w, h), c = cv.getContext("2d");
    DD.setSeason(season === "automne" ? "automne" : "ete"); DD.setSeed(type.length * 97 + v * 331 + 7);
    if (pse === "hiver" && VEG.has(type)) c.filter = "saturate(.25) brightness(1.2)";
    f(c, ax, ay); c.filter = "none";
    if (pse === "hiver" && VEG.has(type)) for (let k = 0; k < 6; k++) DD.ell(c, ax + (rnd() - .5) * w * .4, ay - (h - 40) * (.5 + rnd() * .45), 6 + rnd() * 5, 3 + rnd() * 2, "rgba(255,255,255,.95)");
    if (pse === "hiver" && BIG.has(type)) for (let k = 0; k < 14; k++) DD.ell(c, ax - 90 + k * 13, ay - 150 - k * 4, 12, 6, "rgba(250,252,255,.85)");
    const s = bmp({ cv, ax, ay }); cache.set(key, s); return s;
  }
  function beingSprite(kind, anim, k, flip, view = "side") {
    const key = "b:" + kind + anim + k + flip + view; if (cache.has(key)) return cache.get(key);
    const big = ["grandeBougie", "golemCire", "grandFollet", "roiTourbillon", "bougieNoire"].includes(kind), cv = mk(big ? 260 : 180, big ? 280 : 190), c = cv.getContext("2d"), a = ANIMS[anim](k), cx = big ? 130 : 90, cy = big ? 255 : 168;
    DD.setSeed(31); DD.shadow(c, cx, cy, big ? 40 : 22, big ? 12 : 7);
    c.save(); c.translate(cx, cy + a.dy); c.rotate(a.rot); c.scale(a.sx * (flip ? -1 : 1), a.sy); (view !== "side" && DD.VUES && DD.VUES[kind] ? DD.VUES[kind][view] : BEINGS[kind])(c, 0, 0); c.restore();
    const s = bmp({ cv, ax: cx, ay: cy }); cache.set(key, s); return s;
  }
  const POSES = {
    idle: [{ bob: 0 }, { bob: -1.5 }, { bob: -2.5 }, { bob: -1.5 }], walk: [{ step: 1 }, { step: 0, bob: -3 }, { step: -1 }, { step: 0, bob: -3 }],
    peck: [{ lean: 0 }, { lean: -.12, bob: -2 }, { lean: .38, bob: 2 }, { lean: .12 }], hurt: [{ lean: -.25, hit: true }, { lean: -.15, hit: true }, { lean: -.05 }, { lean: 0 }],
  };
  function duckSprite(view, flip, anim, k) {
    const key = "d:" + season + view + flip + anim + k; if (cache.has(key)) return cache.get(key);
    const cv = mk(170, 170), c = cv.getContext("2d"); c.save(); c.translate(85, 150); c.scale(flip ? -1 : 1, 1); DD.canard(c, 0, 0, view, "", POSES[anim][k]);
    if (season === "hiver") { c.beginPath(); c.moveTo(-12, -38); c.quadraticCurveTo(4, -30, 16, -38); c.strokeStyle = "#d8402a"; c.lineWidth = 6; c.lineCap = "round"; c.stroke(); }
    c.restore(); const s = bmp({ cv, ax: 85, ay: 150 }); cache.set(key, s); return s;
  }
  function itemSprite(kind) {
    const key = "i:" + kind; if (cache.has(key)) return cache.get(key);
    const cv = mk(80, 80), c = cv.getContext("2d");
    if (kind === "plume") { DD.shadow(c, 40, 66, 12, 4); DD.leaf(c, 34, 60, -1.2, 40, 8, ["#e0a830", "#fff4b0"]); DD.ell(c, 54, 22, 3, 3, "#fff"); }
    else if (kind === "cle") DD.M.cle(c, 40, 64); else if (kind === "piece") DD.M.piece(c, 40, 64); else if (kind === "luciole") DD.M.luciole(c, 40, 64); else if (kind === "edelweiss") DD.M.edelweiss(c, 40, 64); else if (kind === "coquillage") DD.M.coquillage(c, 40, 64);
    else { DD.setSeed(5); DD.champignons(c, 40, 64); }
    const s = bmp({ cv, ax: 40, ay: 64 }); cache.set(key, s); return s;
  }

  // ─── Carte du monde (touche M) ───
  let minimap = null;
  // carte d'une région extérieure (dessinée une fois, gardée dans la scène)
  function buildMinimap() {
    const S = 4, cv = mk(N * S, N * S), c = cv.getContext("2d");
    const COL = { herbe: "#7cc54a", fleurs: "#8ccc58", foret: "#3e6e2a", eau: "#3f8ac0", nenuphar: "#3f8ac0", terre: "#d9b27a", paves: "#c4beb2", pont: "#a36a36", gravier: "#a8a092", pierre: "#b8b2a6", ble: "#e8c45a", potager: "#8a5a32", boue: "#7a5a3a", neige: "#eef4fa", glace: "#bfe2f6", sable: "#f0d89a" };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const t = TAG[id(i, j)]; c.fillStyle = t === "montagne" || t === "roc" ? "#9a8670" : COL[G[id(i, j)]] || "#7cc54a"; c.fillRect(i * S, j * S, S, S); }
    for (const p of props) { if (BIG.has(p.type) || ["moulin", "champiMaison", "temple", "tourVent", "phare", "cabanePecheur"].includes(p.type)) { c.fillStyle = "#c2453a"; c.fillRect(p.i * S - 3, p.j * S - 3, 6, 6); } else if (p.type === "montagne") { c.fillStyle = "#7d6a56"; c.fillRect(p.i * S - 5, p.j * S - 5, 10, 10); } else if (["sapin", "arbre", "arbre2", "bouleau", "erable"].includes(p.type) && cur !== WORLD) { c.fillStyle = "rgba(30,70,25,.55)"; c.fillRect(p.i * S - 2, p.j * S - 2, 4, 4); } }
    cur.minimap = cv;
  }
  const mapPlaces = () => (cur === WORLD ? TOWNS : cur.places || []);
  function rebuild() { cache.clear(); }

  // ─── Commandes ───
  const keys = new Set(), stick = { x: 0, y: 0, on: false };
  addEventListener("keydown", (e) => {
    if (document.getElementById("panneau")?.classList.contains("ouvert")) return; // réglages ouverts : le jeu ne bouge pas
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (e.repeat) return; keys.add(e.key.toLowerCase());
    if (e.key === " " || e.key === "Enter") action();
    if (e.key.toLowerCase() === "n") nextSeason();
    if (e.key.toLowerCase() === "x") useItem();
    if (e.key.toLowerCase() === "c") cycleItem();
    if (e.key.toLowerCase() === "v") { const on = AUDIO.toggle(); say(on ? "Son activé" : "Son coupé", 1.5); const b = document.getElementById("son"); if (b) b.textContent = on ? "♪ Son" : "♪ Muet"; }
    if (e.key.toLowerCase() === "m") { if (cur.outdoor) { showMap = !showMap; AUDIO.sfx("papier"); } else say(cur === FOREST ? "La forêt est trop dense pour la carte ! Suis les sentiers." : "Pas de carte ici : sors d'abord.", 2.5); }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  addEventListener("blur", () => keys.clear());
  document.getElementById("quack").addEventListener("pointerdown", (e) => { e.preventDefault(); action(); });
  const sonBtn = document.getElementById("son"); if (sonBtn) { sonBtn.textContent = AUDIO.on ? "♪ Son" : "♪ Muet"; sonBtn.addEventListener("click", () => { const on = AUDIO.toggle(); sonBtn.textContent = on ? "♪ Son" : "♪ Muet"; }); }
  const objBtn = document.getElementById("objet"); if (objBtn) objBtn.addEventListener("pointerdown", (e) => { e.preventDefault(); useItem(); });
  document.getElementById("saison").addEventListener("click", nextSeason);
  const carteBtn = document.getElementById("carte"); if (carteBtn) carteBtn.addEventListener("click", () => { if (cur.outdoor) { showMap = !showMap; AUDIO.sfx("papier"); } else say("Pas de carte ici : sors d'abord.", 2); });
  const stickEl = document.getElementById("stick"), knob = document.getElementById("knob");
  function stickMove(e) { const r = stickEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const d = Math.hypot(dx, dy), m = 55; if (d > m) { dx *= m / d; dy *= m / d; } stick.x = dx / m; stick.y = dy / m; knob.style.transform = `translate(${dx}px, ${dy}px)`; }
  stickEl.addEventListener("pointerdown", (e) => { stick.on = true; stickEl.setPointerCapture(e.pointerId); stickMove(e); });
  stickEl.addEventListener("pointermove", (e) => { if (stick.on) stickMove(e); });
  const stickEnd = () => { stick.on = false; stick.x = stick.y = 0; knob.style.transform = ""; };
  stickEl.addEventListener("pointerup", stickEnd); stickEl.addEventListener("pointercancel", stickEnd);
  function nextSeason() { AUDIO.sfx("chime"); season = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length]; document.getElementById("saison").textContent = "Saison : " + SEASON_NAME[season]; rebuild(); }

  const near = (a, d) => Math.hypot(a.i - duck.i, a.j - duck.j) < d;
  function sparkle(i, j, cols, n = 16) { const [x, y] = toScreen(i, j); for (let k = 0; k < n; k++) particles.push({ x, y: y - 40, vx: (rnd() - .5) * 160, vy: -rnd() * 160 - 40, life: 1, col: cols[k % cols.length] }); }
  function talk(n) {
    AUDIO.sfx("blip");
    dialog = { name: n.name, lines: n.lines || DIALOGS[n.dlg || n.kind](), line: 0, after: () => {
      if (n.shop) { if (duck.hearts >= Q.maxHearts) say("Tu es en pleine forme ! Reviens quand tu seras blessé.", 3); else if (Q.pieces < 3) say("Il te faut 3 pièces. Calme des bougies ou ouvre des coffres !", 3.5); else { Q.pieces -= 3; duck.hearts = Q.maxHearts; AUDIO.sfx("piece"); say("Tarte aux baies : tous tes cœurs sont revenus ! (-3 pièces)", 3.5); } }
      if (n === CAPITAINE) { if (Q.cote === 0) Q.cote = 1; else if (Q.cote === 2) { Q.cote = 3; AUDIO.sfx("fanfare"); say("Acte I terminé ! 🦆✨", 6); } if (Q.coq >= 6 && !Q.capReward) { Q.capReward = true; Q.maxHearts++; duck.hearts = Q.maxHearts; AUDIO.sfx("coeur"); say("La Capitaine t'offre un cœur de plus ! ❤", 4); } }
      if (n === GUIDE) { if (Q.monts === 0) Q.monts = 1; else if (Q.monts === 2) { Q.monts = 3; AUDIO.sfx("fanfare"); say("Quête des Monts terminée ! 🦆", 5); } if (Q.edel >= 6 && !Q.guideReward) { Q.guideReward = true; Q.maxHearts++; duck.hearts = Q.maxHearts; AUDIO.sfx("coeur"); say("Le Guide t'offre un cœur de plus ! ❤", 4); } }
      if (n === OWL) { if (Q.foret === 0) Q.foret = 1; else if (Q.foret === 2) { Q.foret = 3; AUDIO.sfx("fanfare"); say("Quête de la forêt terminée ! 🦆", 5); } if (Q.lucioles >= 8 && !Q.owlReward) { Q.owlReward = true; Q.maxHearts++; duck.hearts = Q.maxHearts; AUDIO.sfx("coeur"); say("La Chouette t'offre un cœur de plus ! ❤", 4); } }
      if (n.merchant) { if (!Q.fiole && Q.pieces >= 40) { Q.fiole = true; Q.pieces -= 40; Q.maxHearts++; duck.hearts = Q.maxHearts; AUDIO.sfx("coeur"); say("Fiole de vie : +1 cœur pour toujours ! (-40 pièces)", 4); } else if (duck.hearts < Q.maxHearts && Q.pieces >= 3) { Q.pieces -= 3; duck.hearts = Q.maxHearts; AUDIO.sfx("piece"); say("Tarte aux mûres : cœurs pleins ! (-3 pièces)", 3); } else say(Q.fiole ? "Reviens quand tu seras blessé !" : `La Fiole coûte 40 pièces. Tu en as ${Q.pieces}.`, 3); }
      if (n === FROG && [0, 2, 4, 7].includes(Q.main)) { Q.main++; if (Q.main === 8) AUDIO.sfx("fanfare"); say("Quête principale terminée ! 🦆", 5); }
      if (n === CRAPAUDE) { if (Q.side === 0) Q.side = 1; else if (Q.side === 1 && Q.champis >= 12) { Q.side = 2; Q.maxHearts++; duck.hearts = Q.maxHearts; AUDIO.sfx("coeur"); say("Un cœur de plus ! ❤", 4); } }
      save();
    } };
  }
  function action() {
    if (ending) { ending = 0; say("La lumière du phare brille sur l'Étang. Parle à la Capitaine Mouette.", 5); return; }
    if (dialog) { AUDIO.sfx("blip"); dialog.line++; if (dialog.line >= dialog.lines.length) { const a = dialog.after; dialog = null; a(); } return; }
    if (showMap) { showMap = false; return; }
    const n = npcs.find((x) => near(x, 1.6)); if (n) { talk(n); return; }
    if (!(cur.boss && cur.boss.alive && cur.boss.vis && near(cur.boss, 1.6)) && sceneAction()) return;
    if (cur === WORLD && Q.main === 6 && near(chest, 1.4)) { Q.main = 7; sparkle(chest.i, chest.j, ["#ffd23f", "#fff4b0", "#6fd0ef"], 40); AUDIO.sfx("chest"); say("Tu as trouvé la Plume du Calme ! ✨", 5); save(); return; }
    if (duck.peck > 0) return;
    duck.peck = .34; AUDIO.sfx("quack"); bossPeck();
    for (const c of candles) if (c.alive && near(c, 1.3)) {
      c.alive = false; AUDIO.sfx("calm"); Q.calmed++; Q.pieces++; if (cur === DUNGEON) Q.d1.calmed.push(c.id); else if (cur !== WORLD) Q.calmedIds.push(c.id); sparkle(c.i, c.j, ["#ffd23f", "#fff4b0", "#6fd0ef"]);
      if (Q.main === 1 && Q.calmed >= 10) { Q.main = 2; AUDIO.sfx("fanfare"); say("Dix bougies calmées ! Retourne voir Grand-père Grenouille.", 5); } else say(`Bougie calmée ! (${Q.calmed} au total)`, 2.5);
    }
    if (cur === WORLD && boss.alive && near(boss, 1.6) && boss.hurt <= 0) {
      boss.hp--; AUDIO.sfx("hit"); boss.hurt = .6; sparkle(boss.i, boss.j, ["#ff8a3d", "#ffd23f"], 12);
      const d = Math.max(.01, Math.hypot(boss.i - duck.i, boss.j - duck.j)); moveBody(boss, (boss.i - duck.i) / d * 1.2, (boss.j - duck.j) / d * 1.2, boss.r);
      if (boss.hp <= 0) { boss.alive = false; AUDIO.sfx("fanfare"); sparkle(boss.i, boss.j, ["#ffd23f", "#fff4b0", "#6fd0ef", "#ff8fb1"], 50); if (Q.main === 5) Q.main = 6; say("La Grande Bougie est calmée ! Ouvre le coffre.", 5); save(); }
      else say(`Grande Bougie : encore ${boss.hp} coups de bec !`, 2);
    }
  }

  // ─── Mise à jour ───
  function wander(a, dt) {
    a.phase += dt * 6;
    if (a.wait > 0) { a.wait -= dt; return; }
    const d = Math.hypot(a.ti - a.i, a.tj - a.j);
    if (d < .1) { a.ti = a.hi + (rnd() - .5) * 8; a.tj = a.hj + (rnd() - .5) * 8; a.wait = 1 + rnd() * 3; return; }
    const sp = a.speed * dt, di = (a.ti - a.i) / d * sp, dj = (a.tj - a.j) / d * sp;
    const oi = a.i, oj = a.j;
    if (moveBody(a, di, dj, a.r)) {
      // la vue suit le vrai mouvement à l'écran : profil (gauche/droite), face (vers nous), dos (s'éloigne)
      const sx = ((a.i - oi) - (a.j - oj)) * 64, sy = ((a.i - oi) + (a.j - oj)) * 32;
      if (Math.hypot(sx, sy) > sp * 8) { if (Math.abs(sx) >= Math.abs(sy) * .9) { a.view = "side"; a.flip = sx < 0; } else a.view = sy > 0 ? "face" : "dos"; }
    } else { a.ti = a.i; a.tj = a.j; a.wait = .4; }
  }
  function burn(src) {
    if (duck.hurt > 0) return;
    duck.hearts--; duck.hurt = 1.1; AUDIO.sfx("hurt");
    const d = Math.max(.01, Math.hypot(duck.i - src.i, duck.j - src.j)); moveBody(duck, (duck.i - src.i) / d * .9, (duck.j - src.j) / d * .9, duck.r);
    if (duck.hearts <= 0) { if (cur !== WORLD) setScene(WORLD); duck.hearts = Q.maxHearts; duck.i = V.i + 1.5; duck.j = V.j + 1.5; say("Dip Duck se repose au village… et repart, tout calme.", 4); } else say("Aïe, ça brûle ! Un coup de bec quand elle est tout près.", 2.5);
  }
  function update(dt) {
    let sx = 0, sy = 0;
    if (keys.has("arrowleft") || keys.has("a") || keys.has("q")) sx -= 1;
    if (keys.has("arrowright") || keys.has("d")) sx += 1;
    if (keys.has("arrowup") || keys.has("w") || keys.has("z")) sy -= 1;
    if (keys.has("arrowdown") || keys.has("s")) sy += 1;
    if (stick.on) { sx = stick.x; sy = stick.y; }
    const mag = Math.hypot(sx, sy);
    const hooking = hookUpdate(dt) || dashUpdate(dt);
    windUpdate(dt);
    duck.moving = !hooking && !dialog && !showMap && mag > .15 && duck.hurt <= .6;
    if (duck.moving) {
      sx /= Math.max(1, mag); sy /= Math.max(1, mag);
      const speed = 230 * dt, px = sx * speed, py = sy * speed * .75;
      const mi = (px / 64 + py / 32) / 2, mj = (py / 32 - px / 64) / 2, ml = Math.hypot(mi, mj) || 1; duck.lastMove = [mi / ml, mj / ml];
      if (duck.pushAxis) moveBody(duck, duck.pushAxis[0] ? mi : 0, duck.pushAxis[1] ? mj : 0, duck.r); else moveBody(duck, mi, mj, duck.r);
      duck.view = sy > .2 ? "face" : sy < -.2 ? "dos" : duck.view;
      duck.flip = duck.view === "face" ? sx < -.1 : sx > .1;
    }
    if (duck.moving) { duck.stepT = (duck.stepT || 0) - dt; if (duck.stepT <= 0) { duck.stepT = .27; const g = G[id(Math.round(duck.i), Math.round(duck.j))]; AUDIO.sfx(["paves", "pierre", "parquet", "carrelage", "gravier", "pont"].includes(g) ? "pasDur" : g === "boue" ? "pasEau" : "pas"); } }
    AUDIO.setTrack(cur.boss && cur.boss.alive && cur.boss.engaged ? "boss" : cur.dark ? "donjon" : cur.inside ? "interieur" : cur === FOREST ? (season === "nuit" ? "nuit" : "foret") : cur === MONTS ? (season === "nuit" ? "nuit" : "monts") : cur === COTE ? (season === "nuit" ? "nuit" : "cote") : season === "nuit" ? "nuit" : "village");
    duck.t += dt; Q.time += dt; duck.peck = Math.max(0, duck.peck - dt); duck.hurt = Math.max(0, duck.hurt - dt);
    for (const a of animals) if (Math.abs(a.i - duck.i) + Math.abs(a.j - duck.j) < 30) wander(a, dt);
    for (const c of candles) {
      if (!c.alive || Math.abs(c.i - duck.i) + Math.abs(c.j - duck.j) > 30) continue;
      c.phase += dt * 5;
      const dd = Math.hypot(c.i - duck.i, c.j - duck.j);
      let ti = c.ti, tj = c.tj, sp = .8;
      if (dd < 3.6 && !dialog) { ti = duck.i; tj = duck.j; sp = 1.5; }
      else if (Math.hypot(c.ti - c.i, c.tj - c.j) < .1) { c.ti = c.home[0] + (rnd() - .5) * 5; c.tj = c.home[1] + (rnd() - .5) * 5; }
      const d = Math.hypot(ti - c.i, tj - c.j);
      if (d > .05 && !moveBody(c, (ti - c.i) / d * sp * dt, (tj - c.j) / d * sp * dt, c.r) && dd >= 3.6) { c.ti = c.i; c.tj = c.j; }
      if (dd < .62) burn(c);
    }
    sceneUpdate(dt); bossUpdate(dt); shotsUpdate(dt);
    if (cur === WORLD && boss.alive && Math.hypot(boss.i - duck.i, boss.j - duck.j) < 14) {
      boss.phase += dt * 5; boss.hurt = Math.max(0, boss.hurt - dt);
      const dd = Math.hypot(boss.i - duck.i, boss.j - duck.j);
      if (dd < 7 && !dialog && boss.hurt <= 0) { const d = Math.max(.01, dd); moveBody(boss, (duck.i - boss.i) / d * 1.1 * dt, (duck.j - boss.j) / d * 1.1 * dt, boss.r); }
      if (dd < .95) burn(boss);
    }
    for (const x of items) if (!x.got && near(x, .7)) {
      x.got = true; sparkle(x.i, x.j, x.kind === "plume" ? ["#ffd23f", "#fff4b0"] : ["#ff6b5e", "#fff"], 10);
      if (cur !== WORLD) Q.got.push(x.id);
      AUDIO.sfx(x.kind === "plume" || x.kind === "luciole" || x.kind === "edelweiss" || x.kind === "coquillage" ? "plume" : x.kind === "cle" ? "cle" : "piece");
      if (x.kind === "plume") { Q.plumes++; say(`Plume dorée ! (${Q.plumes}/100)`, 2); } else if (x.kind === "coquillage") { Q.coq++; say(`Coquillage ! (${Q.coq}/6) — la Capitaine les collectionne.`, 2.5); } else if (x.kind === "cle" && cur === PHARE) { Q.d4.key = true; say("Une clé ! Elle ouvre la porte du sommet.", 3.5); } else if (x.kind === "edelweiss") { Q.edel++; say(`Edelweiss ! (${Q.edel}/6) — le Guide des Cimes les aime.`, 2.5); } else if (x.kind === "cle" && cur === TOWER) { Q.d3.key = true; say("Une clé ! Elle ouvre la porte en haut de la tour.", 3.5); } else if (x.kind === "luciole") { Q.lucioles++; say(`Luciole ! (${Q.lucioles}/8) — la Chouette Sage les collectionne.`, 2.5); } else if (x.kind === "cle" && cur === TEMPLE) { Q.d2.key = true; say("Une clé ! Elle ouvre la porte au nord du temple.", 3.5); } else if (x.kind === "cle") { Q.d1.key = true; say("Une clé ! Elle ouvre sûrement une porte de la grotte.", 3.5); } else if (x.kind === "piece") { Q.pieces++; say(`Pièce ! (${Q.pieces})`, 1.5); } else { Q.champis++; say(`Champignon ! (${Q.champis}/12)${Q.side === 0 ? " — Madame Crapaude en cherche…" : ""}`, 2.5); }
    }
    if (cur === WORLD) for (const d of ducklings) if (!d.got && near(d, .9)) { d.got = true; AUDIO.sfx("fanfare"); sparkle(d.i, d.j, ["#ffd23f", "#fff"], 20); say(`Caneton retrouvé ! (${ducklings.filter((x) => x.got).length}/3)`, 3); if (Q.main === 3 && ducklings.every((x) => x.got)) { Q.main = 4; AUDIO.sfx("fanfare"); say("Les trois canetons sont saufs ! Retourne au village.", 5); } }
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt * 1.3; }
    for (let k = particles.length - 1; k >= 0; k--) if (particles[k].life <= 0) particles.splice(k, 1);
    messageT -= dt;
  }

  // ─── Dessin ───
  function draw() {
    const W = Math.round(innerWidth * devicePixelRatio), Hh = Math.round(innerHeight * devicePixelRatio);
    if (canvas.width !== W || canvas.height !== Hh) { canvas.width = W; canvas.height = Hh; }
    const zoom = devicePixelRatio * (innerWidth < 700 ? .62 : .85);
    const [dx, dy] = toScreen(duck.i, duck.j);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = cur.inside ? "#1e1612" : cur.dark ? "#08080c" : season === "nuit" ? "#0b1430" : season === "hiver" ? "#cfe0ee" : season === "automne" ? "#f2d2a8" : "#9ad6f0"; ctx.fillRect(0, 0, W, Hh);
    const camX = dx, camY = dy - 40;
    ctx.setTransform(zoom, 0, 0, zoom, W / 2 - camX * zoom, Hh / 2 - camY * zoom);
    const vw = W / zoom, vh = Hh / zoom, x0 = camX - vw / 2, y0 = camY - vh / 2;
    if (cur.inside) drawWalls();
    const corners = [toTile(x0, y0), toTile(x0 + vw, y0), toTile(x0, y0 + vh), toTile(x0 + vw, y0 + vh)];
    const iMin = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0]))) - 1), iMax = Math.min(N - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))) + 8);
    const jMin = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1]))) - 1), jMax = Math.min(N - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))) + 8);
    for (let i = iMin; i <= iMax; i++) for (let j = jMin; j <= jMax; j++) {
      const [x, y] = toScreen(i, j); if (x < x0 - 70 || x > x0 + vw + 70 || y < y0 - 40 || y > y0 + vh + 40) continue;
      const s = tileSprite(G[id(i, j)], (i * 7 + j * 13) % 3); ctx.drawImage(s.cv, x - s.ax, y - s.ay);
    }
    const list = [];
    const visible = (i, j) => { const [x, y] = toScreen(i, j); return x > x0 - 200 && x < x0 + vw + 200 && y > y0 - 60 && y < y0 + vh + 300; };
    const put = (key, i, j, s, alpha = 1, lift = 0) => list.push({ key, d: () => { const [x, y] = toScreen(i, j); if (alpha < 1) ctx.globalAlpha = alpha; ctx.drawImage(s.cv, x - s.ax, y - s.ay - lift); ctx.globalAlpha = 1; } });
    for (let i = iMin; i <= iMax; i++) for (let j = jMin; j <= jMax; j++) { const ps = propGrid.get(id(i, j)); if (ps) for (const p of ps) if (visible(p.i, p.j)) put(p.key, p.i, p.j, propSprite(p.type, p.v)); }
    const tick = Math.floor(duck.t * 3) % 4;
    for (const n of npcs) if (visible(n.i, n.j)) put(n.i + n.j, n.i, n.j, beingSprite(n.kind, "idle", tick, false));
    for (const a of animals) if (visible(a.i, a.j)) put(a.i + a.j, a.i, a.j, beingSprite(a.kind, a.anim, a.wait > 0 && a.anim !== "peck" ? 0 : Math.floor(a.phase) % 4, a.flip, a.view || "side"));
    for (const c of candles) if (c.alive && visible(c.i, c.j)) put(c.i + c.j, c.i, c.j, beingSprite(c.kind || "bougie", c.kind === "follet" ? "float" : "hop", Math.floor(c.phase) % 4, false));
    { const b = cur.boss; if (b && b.alive && b.vis && visible(b.i, b.j)) list.push({ key: b.i + b.j, d: () => {
      const s = beingSprite(b.kind, b.type === "golem" ? "walk" : "float", b.st === "stun" ? 0 : Math.floor(b.phase) % 4, false), [x, y] = toScreen(b.i, b.j), shake = b.st === "prep" ? Math.sin(duck.t * 60) * 4 : 0;
      if (b.hurt > 0 && Math.floor(duck.t * 14) % 2) ctx.globalAlpha = .45; ctx.drawImage(s.cv, x - s.ax + shake, y - s.ay); ctx.globalAlpha = 1;
      if (b.st === "stun") for (let k = 0; k < 3; k++) { const a = duck.t * 4 + k * 2.1; DD.ell(ctx, x + Math.cos(a) * 28, y - 175 + Math.sin(a) * 8, 5, 5, "#ffd23f"); }
    } }); }
    for (const sh of cur.shots || []) list.push({ key: sh.i + sh.j, d: () => { const [x, y] = toScreen(sh.i, sh.j); DD.ell(ctx, x, y - 30, 15, 15, sh.red ? "rgba(255,90,60,.45)" : "rgba(120,200,255,.4)"); DD.ell(ctx, x, y - 30, 7, 7, sh.red ? "#ffe0c8" : "#e8f8ff"); } });
    if (cur === WORLD && boss.alive && visible(boss.i, boss.j)) list.push({ key: boss.i + boss.j, d: () => { const s = beingSprite("grandeBougie", "hop", Math.floor(boss.phase) % 4, false), [x, y] = toScreen(boss.i, boss.j); if (boss.hurt > 0 && Math.floor(duck.t * 14) % 2) ctx.globalAlpha = .5; ctx.drawImage(s.cv, x - s.ax, y - s.ay); ctx.globalAlpha = 1; ctx.fillStyle = "rgba(25,20,35,.8)"; ctx.fillRect(x - 42, y - 200, 84, 10); ctx.fillStyle = "#ff5a3a"; ctx.fillRect(x - 40, y - 198, 80 * boss.hp / 6, 6); } });
    for (const x of items) if (!x.got && visible(x.i, x.j)) put(x.i + x.j, x.i, x.j, itemSprite(x.kind), 1, x.kind === "plume" ? Math.sin(duck.t * 3 + x.i) * 4 : 0);
    if (cur === WORLD) for (const d of ducklings) if (!d.got && visible(d.i, d.j)) put(d.i + d.j, d.i, d.j, beingSprite("caneton", "hop", Math.floor(duck.t * 4) % 4, false));
    list.push({ key: duck.i + duck.j, d: () => {
      const anim = duck.hurt > .6 ? "hurt" : duck.peck > 0 ? "peck" : duck.moving ? "walk" : "idle";
      const k = anim === "peck" ? Math.min(3, Math.floor((.34 - duck.peck) / .34 * 4)) : anim === "hurt" ? Math.min(3, Math.floor((1.1 - duck.hurt) * 6)) : Math.floor(duck.t * (anim === "walk" ? 9 : 3)) % 4;
      const s = duckSprite(duck.view, duck.flip, anim, k);
      if (duck.hurt > 0 && Math.floor(duck.t * 14) % 2) ctx.globalAlpha = .45;
      ctx.drawImage(s.cv, dx - s.ax, dy - s.ay); ctx.globalAlpha = 1;
    } });
    list.sort((a, b) => a.key - b.key).forEach((e) => e.d());
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); DD.ell(ctx, p.x, p.y, 4, 4, p.col); } ctx.globalAlpha = 1;
    // corde du grappin
    if (duck.hook || duck.rope) { const [px, py] = duck.hook ? toScreen(duck.hook.post.i, duck.hook.post.j) : toScreen(...duck.rope.to); const [qx, qy] = toScreen(duck.i, duck.j); DD.line(ctx, qx, qy - 34, px, py - (duck.hook ? 58 : 30), "#5a3418", 3); DD.ell(ctx, px, py - (duck.hook ? 58 : 30), 5, 5, "#9aa2b0"); }
    if (cur.winds) for (const w of cur.winds) if (windOn(w)) for (let k = 0; k < 18; k++) {
      const u = ((k * 0.137 + duck.t * .6) % 1), v = (k * 0.618) % 1, wi = w.i0 + (w.dir[0] ? u : v) * (w.i1 - w.i0), wj = w.j0 + (w.dir[1] ? u : v) * (w.j1 - w.j0);
      const [x1, y1] = toScreen(wi, wj), [x2, y2] = toScreen(wi + w.dir[0] * .8, wj + w.dir[1] * .8);
      if (x1 > x0 - 50 && x1 < x0 + vw + 50 && y1 > y0 - 50 && y1 < y0 + vh + 50) DD.line(ctx, x1, y1 - 30, x2, y2 - 30, "rgba(255,255,255,.7)", 2);
    }
    if (cur.mist) { for (let k = 0; k < 14; k++) { const mx = x0 + ((k * 211 + duck.t * 14) % (vw + 400)) - 200, my = y0 + ((k * 137) % vh); DD.ell(ctx, mx, my, 220, 60, "rgba(235,245,240,.07)"); } }
    const goal = curQuest().target();
    if (goal && (goal.scene || WORLD) === cur) { const [gx, gy] = toScreen(goal.i, goal.j); if (gx > x0 && gx < x0 + vw && gy > y0 && gy < y0 + vh) { const by = gy - 130 + Math.sin(duck.t * 4) * 6; DD.poly(ctx, [[gx - 12, by], [gx + 12, by], [gx, by + 18]], "#ffd23f", "#6a4a10", 2); } }
    if (cur.outdoor && season === "nuit") night(W, Hh, x0, y0, vw, vh);
    if (cur.dark) darkness(W, Hh, x0, y0, vw, vh);
    if (cur.outdoor && (season === "hiver" || cur.snow)) { ctx.fillStyle = "rgba(255,255,255,.85)"; for (let k = 0; k < 120; k++) { const fx = x0 + ((k * 97.3 + duck.t * 20 * (1 + k % 3)) % vw), fy = y0 + ((k * 61.7 + duck.t * 60 * (1 + k % 2)) % vh); ctx.fillRect(fx, fy, 3, 3); } }
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    hud(goal, camX, camY, zoom / devicePixelRatio);
  }
  function night(W, Hh, x0, y0, vw, vh) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "#3c4c8c"; ctx.fillRect(0, 0, W, Hh); ctx.restore();
    ctx.globalCompositeOperation = "lighter";
    const glow = (x, y, r, col) => { if (x < x0 - r || x > x0 + vw + r || y < y0 - r || y > y0 + vh + r) return; const g = ctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    for (const p of props) { if (!["lanterne", "feuCamp", "maison", "taverne", "boulangerie"].includes(p.type)) continue; const [x, y] = toScreen(p.i, p.j); if (p.type === "lanterne") glow(x, y - 78, 120, "rgba(255,190,90,.55)"); else if (p.type === "feuCamp") glow(x, y - 20, 140, "rgba(255,140,60,.6)"); else glow(x + 30, y - 30, 70, "rgba(255,210,120,.45)"); }
    for (const c of candles) if (c.alive) { const [x, y] = toScreen(c.i, c.j); glow(x, y - 68, 90, "rgba(255,110,50,.55)"); }
    if (cur === COTE && Q.d4.chestF) { const [x, y] = toScreen(67, 15); glow(x, y - 270, 260, "rgba(255,240,150,.7)"); }
    if (boss.alive) { const [x, y] = toScreen(boss.i, boss.j); glow(x, y - 130, 200, "rgba(255,80,40,.6)"); }
    const [dx, dy] = toScreen(duck.i, duck.j); glow(dx, dy - 30, 110, "rgba(255,240,190,.18)");
    ctx.globalCompositeOperation = "source-over";
  }
  function heart(x, y, on) { ctx.fillStyle = on ? "#ff5a5a" : "#5a4a5a"; ctx.beginPath(); ctx.moveTo(x, y + 8); ctx.bezierCurveTo(x - 14, y - 2, x - 6, y - 12, x, y - 4); ctx.bezierCurveTo(x + 6, y - 12, x + 14, y - 2, x, y + 8); ctx.fill(); }
  function panel(x, y, w, h, r = 12, col = "rgba(25,20,35,.8)") { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }
  function hud(goal, camX, camY, z) {
    const Wc = innerWidth, Hc = innerHeight;
    // mise en page : grand écran (tout sur une ligne) ou téléphone (empilé, plus petit)
    const mob = Wc < 760, pw = mob ? Wc - 120 : 580, ph = mob ? 108 : 92;
    panel(14, 14, pw, ph);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px system-ui, sans-serif"; ctx.fillText("Dip Duck", 28, 36);
    for (let k = 0; k < Q.maxHearts; k++) heart(36 + k * 24, 56, k < duck.hearts);
    { const full = `Plumes ${Q.plumes}/100 · Lucioles ${Q.lucioles}/8 · Edelweiss ${Q.edel}/6 · Coquillages ${Q.coq}/6 · Champignons ${Q.champis}/12 · Canetons ${ducklings.filter((d) => d.got).length}/3`; ctx.fillStyle = "#ffd9a0";
      if (mob) { ctx.font = "bold 10px system-ui, sans-serif"; const parts = full.split(" · "), h1 = parts.slice(0, 3).join(" · "), h2 = parts.slice(3).join(" · "); ctx.fillText(h1, 24, 88, pw - 20); ctx.fillText(h2, 24, 102, pw - 20); }
      else { ctx.font = "bold 12px system-ui, sans-serif"; ctx.fillText(full, 26, 92); } }
    const cx0 = mob ? 14 + pw - 64 : 220; DD.ell(ctx, cx0, 36, 7, 7, "#ffd23f"); ctx.fillStyle = "#fff"; ctx.font = "bold 14px system-ui"; ctx.fillText(String(Q.pieces), cx0 + 12, 41); if (Q.d1.key && !Q.d1.door) { ctx.fillStyle = "#ffd23f"; ctx.fillText("🔑", cx0 + 44, 41); }
    const t = curQuest().text, txt = "★ " + (typeof t === "function" ? t() : t);
    // objectif : à droite du panneau s'il y a la place, sinon en dessous (sur une ou deux lignes)
    let objBottom; { ctx.font = "bold 14px system-ui, sans-serif"; const room = Wc - 608 - 190;
      if (!mob && room >= 320) { const tw = Math.min(room, ctx.measureText(txt).width + 28), tx = 608 + (room - tw) / 2; panel(tx, 14, tw, 32, 10); ctx.fillStyle = "#ffd23f"; ctx.fillText(txt, tx + 14, 35, tw - 28); objBottom = 112; }
      else { const oy = mob ? 152 : 114, ow = mob ? Wc - 28 : Wc - 220; ctx.font = (mob ? "bold 12px" : "bold 14px") + " system-ui, sans-serif"; const two = ctx.measureText(txt).width > ow - 28; panel(14, oy, ow, two ? 46 : 30, 10); ctx.fillStyle = "#ffd23f"; wrap(txt, 28, oy + 20, ow - 28, 17); objBottom = oy + (two ? 50 : 34); } }
    if (cur.boss && cur.boss.alive && cur.boss.engaged) { const b = cur.boss, bw = Math.min(420, Wc - 80), bx = (Wc - bw) / 2; const by = mob ? objBottom + 4 : Hc - 118; panel(bx - 10, by, bw + 20, 46, 10); ctx.fillStyle = "#ffd9a0"; ctx.font = "bold 14px system-ui"; ctx.textAlign = "center"; ctx.fillText(b.name, Wc / 2, by + 18); ctx.textAlign = "left"; ctx.fillStyle = "#3a2a3a"; ctx.fillRect(bx, by + 26, bw, 10); ctx.fillStyle = "#ff5a3a"; ctx.fillRect(bx, by + 26, bw * b.hp / b.max, 10); }
    const it = selItem(); if (it) { ctx.font = "bold 13px system-ui"; const tt = "Objet (X) : " + ITEM_NAMES[it] + (ownedItems().length > 1 ? "  ·  C : changer" : ""), tw2 = ctx.measureText(tt).width + 24; panel(Wc - tw2 - 24, Hc - 170, tw2, 30, 10); ctx.fillStyle = "#6fd0ef"; ctx.fillText(tt, Wc - tw2 - 12, Hc - 150); }
    const aim = aimFor(goal);
    if (aim && !showMap) {
      const goal = aim; const [gx, gy] = toScreen(goal.i, goal.j), sx = Wc / 2 + (gx - camX) * z, sy = Hc / 2 + (gy - camY) * z;
      if (sx < 30 || sx > Wc - 30 || sy < 60 || sy > Hc - 30) {
        const ang = Math.atan2(sy - Hc / 2, sx - Wc / 2), Rr = Math.min(Wc, Hc) / 2 - 60, ax = Wc / 2 + Math.cos(ang) * Rr, ay = Hc / 2 + Math.sin(ang) * Rr;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); DD.poly(ctx, [[22, 0], [-10, -14], [-4, 0], [-10, 14]], "#ffd23f", "#6a4a10", 2.5); ctx.restore();
        ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.fillText(Math.round(Math.hypot(goal.i - duck.i, goal.j - duck.j)) + " m", ax - 12, ay + 30);
      }
    }
    const here = cur === WORLD && TOWNS.find((tw2) => Math.hypot(duck.i - tw2.i, duck.j - tw2.j) < tw2.r);
    const where = cur !== WORLD ? cur.name : here ? here.name : { foret: "Forêt", marais: "Marais", montagne: "Montagnes", champ: "Champs", eau: "Rivière", route: "Route" }[TAG[id(Math.round(duck.i), Math.round(duck.j))]] || "Prairie";
    ctx.font = "bold 13px system-ui"; const ww = ctx.measureText(where).width + 24, wy = mob ? 118 : 70; panel(Wc - ww - 8, wy, ww, 26, 8); ctx.fillStyle = "#fff"; ctx.fillText(where, Wc - ww + 4, wy + 18);
    if (dialog) {
      const w = Math.min(Wc - 40, 640), x = (Wc - w) / 2, y = Hc - 200;
      panel(x, y, w, 126, 16, "#fffaf0"); ctx.strokeStyle = "#5a4326"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#b8602a"; ctx.font = "bold 15px system-ui"; ctx.fillText(dialog.name, x + 18, y + 28);
      ctx.fillStyle = "#3d2a12"; ctx.font = "16px system-ui"; wrap(dialog.lines[dialog.line], x + 18, y + 56, w - 36, 22);
      ctx.fillStyle = "#8a7558"; ctx.font = "12px system-ui"; ctx.fillText("Espace / QUACK : continuer", x + w - 180, y + 116);
    } else if (messageT > 0) { ctx.font = (mob ? "bold 12px" : "bold 15px") + " system-ui"; const w = Math.min(Wc - 20, ctx.measureText(message).width + 30), my = (cur.boss && cur.boss.alive && cur.boss.engaged && mob ? objBottom + 56 : objBottom + 4); panel((Wc - w) / 2, my, w, 34, 10); ctx.fillStyle = "#fff"; ctx.fillText(message, (Wc - w) / 2 + 15, my + 22, w - 30); }
    const n = !dialog && (npcs.find((x) => near(x, 1.6)) || promptTarget());
    if (n) { const t2 = n.prompt || `Espace : parler à ${n.name}`; ctx.font = "bold 13px system-ui"; const w = ctx.measureText(t2).width + 24; panel((Wc - w) / 2, Hc / 2 + 30, w, 28, 8); ctx.fillStyle = "#ffd23f"; ctx.fillText(t2, (Wc - w) / 2 + 12, Hc / 2 + 49); }
    if (showMap) mapOverlay(Wc, Hc, goal);
    if (ending) {
      ending += 1 / 60; panel(0, 0, Wc, Hc, 0, `rgba(10,10,25,${Math.min(.88, ending * .6)})`);
      const a = Math.min(1, ending * .8); ctx.globalAlpha = a; ctx.textAlign = "center";
      ctx.fillStyle = "#ffd23f"; ctx.font = "bold 44px system-ui"; ctx.fillText("Fin de l'Acte I", Wc / 2, Hc / 2 - 120);
      ctx.fillStyle = "#fff"; ctx.font = "bold 20px system-ui"; ctx.fillText("La Plume de Lumière rallume le phare.", Wc / 2, Hc / 2 - 70);
      ctx.font = "17px system-ui"; ctx.fillText("La Bougie Noire n'était que la peur de l'Étang. Dip Duck l'a calmée.", Wc / 2, Hc / 2 - 40);
      ctx.fillText("Mais au loin, une fumée d'usine s'élève… les époques commencent à changer.", Wc / 2, Hc / 2 - 14);
      const mn = Math.floor(Q.time / 60); ctx.fillStyle = "#bfeaff"; ctx.font = "bold 16px system-ui";
      ctx.fillText(`Temps de jeu : ${Math.floor(mn / 60)} h ${String(mn % 60).padStart(2, "0")} · Plumes dorées : ${Q.plumes}/100 · Cœurs : ${Q.maxHearts} · Pièces : ${Q.pieces}`, Wc / 2, Hc / 2 + 30);
      ctx.fillStyle = "#ffd9a0"; ctx.font = "15px system-ui"; ctx.fillText("Merci d'avoir joué à Dip Duck : Les Plumes du Calme. À suivre dans l'Acte II !", Wc / 2, Hc / 2 + 70);
      ctx.fillStyle = "#ffd23f"; ctx.font = "bold 14px system-ui"; ctx.fillText("Espace / QUACK : continuer à explorer", Wc / 2, Hc / 2 + 120);
      ctx.textAlign = "left"; ctx.globalAlpha = 1;
    }
  }
  function mapOverlay(Wc, Hc, goal) {
    panel(0, 0, Wc, Hc, 0, "rgba(10,10,20,.72)");
    const size = Math.min(Wc, Hc * 1.6) * .8, S = size / N / Math.SQRT2, cy0 = Hc / 2;
    const proj = (i, j) => { const u = (i - N / 2) * S, v = (j - N / 2) * S; return [Wc / 2 + (u - v) * Math.SQRT1_2, cy0 + (u + v) * Math.SQRT1_2 * .55]; };
    ctx.save(); ctx.translate(Wc / 2, cy0); ctx.scale(1, .55); ctx.rotate(Math.PI / 4); ctx.scale(S / 4, S / 4); ctx.translate(-N * 2, -N * 2); if (!cur.minimap) buildMinimap(); ctx.drawImage(cur.minimap, 0, 0); ctx.restore();
    ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
    for (const tw of mapPlaces()) { const [x, y] = proj(tw.i, tw.j); DD.ell(ctx, x, y, 5, 5, "#fffaf0"); ctx.fillStyle = "#fff"; ctx.fillText(tw.name, x, y - 10); }
    for (const a of cur.passages || []) { const [x, y] = proj(a.i, a.j); DD.ell(ctx, x, y, 6, 6, "#6fd0ef"); ctx.fillStyle = "#bfeaff"; ctx.fillText(a.name, x, y + 20); }
    const g2 = aimFor(goal); if (g2) { const [x, y] = proj(g2.i, g2.j); DD.ell(ctx, x, y, 8, 8, "#ffd23f"); }
    const [px, py] = proj(duck.i, duck.j); DD.ell(ctx, px, py, 7, 7, "#ff5a3a"); ctx.fillStyle = "#ff8a6a"; ctx.fillText("Dip Duck", px, py + 22);
    ctx.fillStyle = "#ffd23f"; ctx.fillText("Carte : " + (cur.name || "Val de l'Étang") + " — jaune = objectif · bleu = passage · M ou Espace pour fermer", Wc / 2, Hc - 70); ctx.textAlign = "left";
  }
  function wrap(text, x, y, max, lh) { const words = text.split(" "); let line = ""; for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > max && line) { ctx.fillText(line, x, y); line = w; y += lh; } else line = t; } ctx.fillText(line, x, y); }

  // ─── Boucle ───
  rebuild();
  let last = performance.now();
  const perf = { u: 0, d: 0 };
  function frame(now) { const dt = Math.min(.05, (now - last) / 1000); last = now; let t = performance.now(); update(dt); perf.u = performance.now() - t; t = performance.now(); draw(); perf.d = performance.now() - t; requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  window.__proto = { perf, enterCote, enterPhare, get PHARE() { return PHARE; }, get COTE() { return COTE; }, get ending() { return ending; }, enterDungeon, get dboss() { return cur.boss; }, enterMonts, enterTower, dash, cycleItem, get MONTS() { return MONTS; }, get TOWER() { return TOWER; }, enterForest, enterTemple, useItem, get FOREST() { return FOREST; }, get TEMPLE() { return TEMPLE; }, moveBlock: (i, j) => { const b = cur.blocks[0]; removeProp(b); cur.blocks[0] = place("bloc", i, j); Q.d1.block = [i, j]; }, get cur() { return cur; }, WORLD, enterDungeon, setScene, doorsList, Qd: () => Q, duck, animals, candles, npcs, Q, boss, items, ducklings, action, nextSeason, collides, TOWNS, props, chest, get season() { return season; }, toggleMap: () => { showMap = !showMap; } };
})();

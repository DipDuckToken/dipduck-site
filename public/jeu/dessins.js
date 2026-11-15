// Dip Duck — générateur des planches isométriques (style 2D lisse, vue en diagonale).
// Tout est dessiné par le code : aucune image externe. Chaque planche est un <canvas> avec un id
// (planche-1-sols, planche-2-nature, planche-3-batiments, planche-4-personnages, scene-exemple).
(() => {
  "use strict";
  const TW = 128, TH = 64; // une case : losange de 128 × 64 px
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const R = (a, b) => a + rnd() * (b - a);
  const TAU = Math.PI * 2;
  let SEASON = "ete";
  const AUT = () => SEASON === "automne";

  // ─── Outils de dessin ───
  function mix(hex, t) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const T = t < 0 ? 0 : 255, k = Math.abs(t);
    r = Math.round(r + (T - r) * k); g = Math.round(g + (T - g) * k); b = Math.round(b + (T - b) * k);
    return `rgb(${r},${g},${b})`;
  }
  function lin(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, col] of stops) g.addColorStop(o, col); return g; }
  function rad(c, x0, y0, r0, x1, y1, r1, stops) { const g = c.createRadialGradient(x0, y0, r0, x1, y1, r1); for (const [o, col] of stops) g.addColorStop(o, col); return g; }
  function ell(c, x, y, rx, ry, fill, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(rx, .1), Math.max(ry, .1), rot, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } }
  function poly(c, pts, fill, stroke, lw = 2) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.lineJoin = "round"; c.stroke(); }
  }
  function line(c, x0, y0, x1, y1, col, lw = 2) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = "round"; c.stroke(); }
  function shadow(c, x, y, rx, ry) { ell(c, x, y, rx, ry, "rgba(25,45,10,.28)"); }
  function diamond(c, x, y, w = TW, h = TH) { c.beginPath(); c.moveTo(x, y - h / 2); c.lineTo(x + w / 2, y); c.lineTo(x, y + h / 2); c.lineTo(x - w / 2, y); c.closePath(); }
  function blob(c, x, y, rx, ry, n = 9, jit = .18) {
    const pts = [];
    for (let k = 0; k < n; k++) { const a = k / n * TAU, f = 1 + R(-jit, jit); pts.push([x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f]); }
    const m = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    c.beginPath(); const s = m(pts[n - 1], pts[0]); c.moveTo(s[0], s[1]);
    for (let k = 0; k < n; k++) { const p = pts[k], e = m(p, pts[(k + 1) % n]); c.quadraticCurveTo(p[0], p[1], e[0], e[1]); }
    c.closePath();
  }
  // Point d'un objet en coordonnées de cases (i, j) et hauteur z, autour d'un centre (x, y).
  const Q = (x, y) => (i, j, z = 0) => [x + (i - j) * TW / 2, y + (i + j) * TH / 2 - z];
  function quad(c, q, pts, fill, stroke, lw) { poly(c, pts.map((p) => q(...p)), fill, stroke, lw); }
  // Boîte isométrique : centre (ci, cj), taille a × b cases, de z0 à z0 + h.
  function box(c, q, ci, cj, a, b, z0, h, cl, cr, ct, stroke = "rgba(40,25,10,.55)") {
    const i0 = ci - a / 2, i1 = ci + a / 2, j0 = cj - b / 2, j1 = cj + b / 2, z1 = z0 + h;
    quad(c, q, [[i0, j1, z0], [i1, j1, z0], [i1, j1, z1], [i0, j1, z1]], cl, stroke, 1.5);
    quad(c, q, [[i1, j0, z0], [i1, j1, z0], [i1, j1, z1], [i1, j0, z1]], cr, stroke, 1.5);
    if (ct) quad(c, q, [[i0, j0, z1], [i1, j0, z1], [i1, j1, z1], [i0, j1, z1]], ct, stroke, 1.5);
  }

  // ─── Sols (une case) ───
  function texture(c, x, y, n, cols, len) {
    for (let k = 0; k < n; k++) {
      const px = x + R(-60, 60), py = y + R(-30, 30);
      c.strokeStyle = cols[k % cols.length]; c.lineWidth = 1.6; c.lineCap = "round";
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + R(-2, 2), py - R(len * .5, len)); c.stroke();
    }
  }
  const GROUND = {
    herbe(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, AUT() ? [[0, "#d6cf6e"], [1, "#a89a3e"]] : [[0, "#a4dc5e"], [1, "#68b23e"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let k = 0; k < 4; k++) ell(c, x + R(-40, 40), y + R(-16, 16), R(12, 22), R(5, 9), "rgba(255,255,190,.10)");
      texture(c, x, y, 60, AUT() ? ["rgba(130,100,30,.45)", "rgba(250,230,150,.55)"] : ["rgba(45,110,30,.45)", "rgba(210,245,150,.55)"], 7);
      if (AUT()) for (let k = 0; k < 7; k++) ell(c, x + R(-50, 50), y + R(-20, 20), R(2.5, 4), R(1.4, 2.2), ["#d8402a", "#ff8a3d", "#e0a030"][k % 3], R(0, 3));
      c.restore();
    },
    fleurs(c, x, y) {
      GROUND.herbe(c, x, y);
      c.save(); diamond(c, x, y); c.clip();
      const cols = ["#ff8fb1", "#fff3a0", "#ffffff", "#c79bff"];
      for (let k = 0; k < 14; k++) { const px = x + R(-44, 44), py = y + R(-18, 18); for (let p = 0; p < 5; p++) ell(c, px + Math.cos(p / 5 * TAU) * 2.2, py + Math.sin(p / 5 * TAU) * 1.4, 1.8, 1.3, cols[k % 4]); ell(c, px, py, 1.1, 1, "#f2a530"); }
      c.restore();
    },
    terre(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#e8c891"], [1, "#c69c63"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let k = 0; k < 16; k++) { const px = x + R(-50, 50), py = y + R(-22, 22), r = R(2, 4.5); ell(c, px + 1, py + 1, r, r * .6, "rgba(110,75,35,.35)"); ell(c, px, py, r, r * .6, R(0, 1) < .5 ? "#d9b27a" : "#b88a55"); }
      for (let k = 0; k < 3; k++) line(c, x + R(-40, 20), y + R(-15, 15), x + R(-20, 40), y + R(-15, 15), "rgba(130,90,45,.25)", 1.2);
      c.restore();
    },
    sable(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#fbe6b0"], [1, "#e7c47e"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let k = 0; k < 40; k++) ell(c, x + R(-60, 60), y + R(-30, 30), .9, .7, "rgba(170,120,60,.45)");
      for (let k = 0; k < 3; k++) { c.beginPath(); const px = x + R(-40, 30), py = y + R(-14, 14); c.moveTo(px, py); c.quadraticCurveTo(px + 15, py - 5, px + 30, py); c.strokeStyle = "rgba(255,255,255,.45)"; c.lineWidth = 1.5; c.stroke(); }
      c.restore();
    },
    pierre(c, x, y) {
      diamond(c, x, y); c.fillStyle = "#7d7a74"; c.fill();
      for (const [dx, dy] of [[-32, 0], [32, 0], [0, -16], [0, 16]]) {
        diamond(c, x + dx, y + dy, 60, 30); c.fillStyle = lin(c, x + dx - 30, y + dy - 15, x + dx + 30, y + dy + 15, [[0, "#d6d2c8"], [1, "#a8a297"]]); c.fill();
        c.strokeStyle = "rgba(255,255,255,.35)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + dx - 28, y + dy); c.lineTo(x + dx, y + dy - 14); c.lineTo(x + dx + 28, y + dy); c.stroke();
      }
    },
    eau(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#6fd0ef"], [1, "#2f8ac2"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let k = 0; k < 6; k++) { const px = x + R(-40, 40), py = y + R(-16, 16), w = R(8, 16); c.beginPath(); c.ellipse(px, py, w, w * .35, 0, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 1.6; c.stroke(); }
      for (let k = 0; k < 5; k++) ell(c, x + R(-50, 50), y + R(-20, 20), 1.6, 1, "rgba(255,255,255,.9)");
      c.restore();
    },
    nenuphar(c, x, y) {
      GROUND.eau(c, x, y);
      lily(c, x - 14, y + 2, 1); lily(c, x + 22, y - 8, .7, true);
    },
    pont(c, x, y) {
      GROUND.eau(c, x, y);
      for (let k = -3; k <= 3; k++) {
        const ox = k * 15, oy = -k * 7.5;
        poly(c, [[x + ox - 40, y + oy - 12], [x + ox - 28, y + oy - 18], [x + ox + 40, y + oy + 16], [x + ox + 28, y + oy + 22]], lin(c, x + ox - 40, y + oy, x + ox + 40, y + oy, [[0, "#c98f52"], [1, "#9c6532"]]), "#5e3a1a", 1.5);
      }
    },
  };
  function lily(c, x, y, s, flower) {
    c.beginPath(); c.moveTo(x, y); c.ellipse(x, y, 16 * s, 8 * s, 0, .35, TAU - .05); c.closePath();
    c.fillStyle = lin(c, x - 16 * s, y, x + 16 * s, y, [[0, "#7cc84a"], [1, "#3f8d2c"]]); c.fill(); c.strokeStyle = "#2b6a1f"; c.lineWidth = 1.2; c.stroke();
    if (flower) { for (let p = 0; p < 6; p++) { const a = p / 6 * TAU; ell(c, x + Math.cos(a) * 4 * s, y - 4 * s + Math.sin(a) * 2 * s, 4 * s, 2.4 * s, p % 2 ? "#ff9cc0" : "#ffc2d8", a); } ell(c, x, y - 5 * s, 2.4 * s, 1.8 * s, "#ffd23f"); }
  }

  // Falaise : bloc de terre et de roche avec de l'herbe qui déborde en haut.
  function falaise(c, x, y, H, top = "herbe") {
    poly(c, [[x - 64, y], [x, y + 32], [x, y + 32 + H], [x - 64, y + H]], lin(c, x - 64, y, x, y + H, [[0, "#c29a66"], [1, "#8c6a43"]]), "rgba(60,35,15,.6)", 1.5);
    poly(c, [[x, y + 32], [x + 64, y], [x + 64, y + H], [x, y + 32 + H]], lin(c, x, y, x + 64, y + H, [[0, "#8f6f48"], [1, "#634a2f"]]), "rgba(60,35,15,.6)", 1.5);
    for (let k = 1; k < H / 14; k++) { // strates
      const d = k * 14 + R(-3, 3);
      line(c, x - 62, y + d, x - 2, y + 32 + d, "rgba(90,60,30,.35)", 1.4);
      line(c, x + 2, y + 32 + d, x + 62, y + d, "rgba(50,30,15,.35)", 1.4);
    }
    for (let k = 0; k < 6; k++) { const px = x + R(-58, 58), py = y + R(18, H + 10) + (px < x ? (px - x + 64) * .5 : (x + 64 - px) * .5) * 0; ell(c, px, py, R(3, 6), R(2, 3), "rgba(255,240,210,.18)"); }
    GROUND[top](c, x, y);
    // herbe qui déborde sur les deux faces avant
    const green = AUT() ? ["#a89a3e", "#c8bc58"] : ["#5fae3c", "#7cc54a"];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      ell(c, x - 64 + 64 * t, y + 32 * t + R(2, 5), R(4, 7), R(3, 6), green[k % 2]);
      ell(c, x + 64 * t, y + 32 - 32 * t + R(2, 5), R(4, 7), R(3, 6), green[(k + 1) % 2]);
    }
  }

  // ─── Nature ───
  function rockBlob(c, x, y, rx, ry, col) {
    blob(c, x, y, rx, ry, 8, .16);
    c.save(); c.fillStyle = rad(c, x - rx * .4, y - ry * .5, 2, x, y, Math.max(rx, ry) * 1.3, [[0, mix(col, .4)], [.55, col], [1, mix(col, -.4)]]); c.fill();
    c.lineWidth = 2.4; c.strokeStyle = mix(col, -.62); c.stroke(); c.clip();
    ell(c, x + rx * .55, y + ry * .55, rx, ry * .8, "rgba(60,40,20,.25)");
    c.strokeStyle = mix(col, -.4); c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - rx * .15, y - ry * .7); c.lineTo(x + rx * .05, y - ry * .2); c.lineTo(x - rx * .1, y + ry * .2); c.stroke();
    blob(c, x - rx * .2, y - ry * .85, rx * .45, ry * .25, 7, .3); c.fillStyle = "rgba(110,175,60,.9)"; c.fill();
    c.restore();
  }
  function rocher(c, x, y, s = 1) { shadow(c, x, y, 34 * s, 11 * s); rockBlob(c, x, y - 18 * s, 32 * s, 22 * s, "#c8b48c"); }
  function petitsCailloux(c, x, y) { shadow(c, x, y, 26, 8); rockBlob(c, x - 10, y - 8, 14, 10, "#bfb3a0"); rockBlob(c, x + 12, y - 5, 10, 7, "#cdbf9e"); }
  function pilier(c, x, y, s = 1) {
    shadow(c, x, y, 34 * s, 11 * s);
    rockBlob(c, x, y - 22 * s, 30 * s, 24 * s, "#c9a978");
    rockBlob(c, x - 3 * s, y - 58 * s, 25 * s, 22 * s, "#d1b383");
    rockBlob(c, x + 2 * s, y - 92 * s, 20 * s, 18 * s, "#d8bd8e");
    foliage(c, x + 2 * s, y, [[-10, -110, 9], [6, -112, 10], [0, -118, 8]], s);
  }
  function peak(c, x, y, w, h, col) {
    const pk = [x + w * .06, y - h];
    const left = [[x - w / 2, y], [x - w * .32, y - h * .42], [x - w * .14, y - h * .64], pk, [x + w * .02, y - h * .5], [x + w * .1, y]];
    const right = [pk, [x + w * .22, y - h * .62], [x + w * .36, y - h * .34], [x + w / 2, y], [x + w * .1, y], [x + w * .02, y - h * .5]];
    poly(c, left, lin(c, x - w / 2, y - h, x, y, [[0, mix(col, .3)], [1, col]]));
    poly(c, right, lin(c, x, y - h, x + w / 2, y, [[0, mix(col, -.25)], [1, mix(col, -.45)]]));
    c.save(); poly(c, [...left.slice(0, 4), ...right.slice(1, 4)]); c.clip();
    const zig = []; for (let k = 0; k <= 10; k++) zig.push([x + w / 2 - k * w / 10, y - h * .7 + (k % 2 ? 9 : -4)]);
    poly(c, [[x - w, y - h - 20], [x + w, y - h - 20], ...zig], "#f6f8ff");
    poly(c, right, "rgba(40,50,90,.18)");
    for (let k = 0; k < 6; k++) line(c, x + R(-w * .3, w * .3), y - R(h * .1, h * .5), x + R(-w * .3, w * .3), y - R(h * .1, h * .5), "rgba(60,40,20,.2)", 1.4);
    c.restore();
    poly(c, [...left.slice(0, 4), ...right.slice(1, 4)], null, mix(col, -.65), 2.4);
  }
  function montagne(c, x, y, s = 1) {
    shadow(c, x, y, 120 * s, 26 * s);
    peak(c, x + 55 * s, y - 8 * s, 140 * s, 170 * s, "#9a8670");
    peak(c, x - 25 * s, y, 190 * s, 230 * s, "#b39f86");
    for (let k = 0; k < 16; k++) ell(c, x - 110 * s + k * 14 * s, y - R(0, 6) * s, R(9, 14) * s, R(6, 10) * s, k % 2 ? "#5fae3c" : "#7cc54a");
  }
  function foliage(c, x, y, list, s = 1, pal) {
    pal = pal || (AUT() ? ["#6a1e08", "#d0582a", "#f29a3a", "#ffd88a"] : ["#2c6522", "#4f9a35", "#7cc54a", "#bdf077"]);
    const L = [...list].sort((a, b) => a[1] - b[1]);
    for (const [dx, dy, r] of L) ell(c, x + dx * s, y + dy * s, (r + 3) * s, (r + 3) * s, pal[0]);
    for (const [dx, dy, r] of L) { const cx = x + dx * s, cy = y + dy * s; ell(c, cx, cy, r * s, r * s, rad(c, cx - r * .35 * s, cy - r * .45 * s, 1, cx, cy, r * s, [[0, pal[2]], [.65, pal[1]], [1, mix(pal[1], -.22)]])); }
    for (const [dx, dy, r] of L) for (let k = 0; k < 3; k++) ell(c, x + (dx - r * .3 + R(-4, 4)) * s, y + (dy - r * .45 + R(-3, 3)) * s, 3.2 * s, 2 * s, "rgba(220,255,160,.55)", R(-1, 1));
  }
  function trunk(c, x, y, h, w, s) {
    c.beginPath(); c.moveTo(x - w * 1.3 * s, y); c.quadraticCurveTo(x - w * .7 * s, y - h * .5 * s, x - w * .8 * s, y - h * s);
    c.lineTo(x + w * .8 * s, y - h * s); c.quadraticCurveTo(x + w * .7 * s, y - h * .5 * s, x + w * 1.4 * s, y); c.quadraticCurveTo(x, y + 4 * s, x - w * 1.3 * s, y); c.closePath();
    c.fillStyle = lin(c, x - w * s, 0, x + w * s, 0, [[0, "#a8774a"], [1, "#6b4426"]]); c.fill(); c.strokeStyle = "#3f2512"; c.lineWidth = 2; c.stroke();
    for (let k = 0; k < 3; k++) line(c, x + R(-3, 3) * s, y - R(10, h * .8) * s, x + R(-3, 3) * s, y - R(10, h * .8) * s, "rgba(50,25,10,.35)", 1.3);
  }
  function arbre(c, x, y, s = 1) {
    shadow(c, x + 6 * s, y, 46 * s, 14 * s); trunk(c, x, y, 70, 8, s);
    foliage(c, x, y, [[0, -95, 34], [-30, -82, 26], [30, -84, 27], [-18, -120, 25], [18, -118, 26], [0, -138, 20], [-40, -104, 20], [40, -106, 20], [0, -76, 22]], s);
  }
  function sapin(c, x, y, s = 1) {
    shadow(c, x + 4 * s, y, 32 * s, 11 * s); trunk(c, x, y, 26, 6, s);
    for (const [ty, w, h] of [[-22, 40, 52], [-50, 32, 46], [-76, 23, 40]]) {
      const yy = y + ty * s;
      poly(c, [[x, yy - h * s], [x + w * s, yy], [x - w * s, yy]], lin(c, x - w * s, yy - h * s, x + w * s, yy, [[0, "#5ea845"], [1, "#2a6a2e"]]), "#1d4a1f", 2);
      poly(c, [[x, yy - h * s], [x + w * s, yy], [x + 4 * s, yy - 4 * s]], "rgba(0,30,0,.2)");
    }
  }
  function leaf(c, x0, y0, ang, len, wid, cols) {
    const tx = x0 + Math.cos(ang) * len, ty = y0 + Math.sin(ang) * len + len * .35 * Math.abs(Math.cos(ang));
    const mx = (x0 + tx) / 2, my = (y0 + ty) / 2 - len * .12, nx = -Math.sin(ang) * wid, ny = Math.cos(ang) * wid;
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx + nx, my + ny, tx, ty); c.quadraticCurveTo(mx - nx, my - ny, x0, y0); c.closePath();
    c.fillStyle = lin(c, x0, y0, tx, ty, [[0, cols[0]], [1, cols[1]]]); c.fill(); c.strokeStyle = "#1f5a1c"; c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(mx, my, tx, ty); c.strokeStyle = "rgba(230,255,180,.6)"; c.lineWidth = 1.2; c.stroke();
  }
  function fougere(c, x, y, s = 1) {
    shadow(c, x, y, 40 * s, 12 * s);
    const n = 9; for (let k = 0; k < n; k++) { const a = Math.PI + (k + .5) / n * Math.PI; leaf(c, x, y - 6 * s, a, R(44, 60) * s, R(9, 13) * s, k % 2 ? ["#3e8a2c", "#8fd65a"] : ["#2f7426", "#6fc04a"]); }
  }
  function buisson(c, x, y, s = 1) {
    shadow(c, x, y, 34 * s, 10 * s);
    foliage(c, x, y, [[-16, -18, 18], [16, -18, 18], [0, -30, 20], [0, -14, 16]], s);
    for (let k = 0; k < 7; k++) ell(c, x + R(-26, 26) * s, y + R(-38, -10) * s, 3 * s, 3 * s, k % 2 ? "#ff6f8f" : "#ffffff");
  }
  function fleursTouffe(c, x, y) {
    const cols = ["#ff7aa2", "#ffd23f", "#ffffff", "#b58cff", "#ff8a3d"];
    for (let k = 0; k < 9; k++) {
      const px = x + R(-26, 26), py = y + R(-8, 8), h = R(14, 26);
      line(c, px, py, px + R(-3, 3), py - h, "#3f8a2c", 1.6);
      for (let p = 0; p < 5; p++) ell(c, px + Math.cos(p / 5 * TAU) * 3.4, py - h + Math.sin(p / 5 * TAU) * 3, 2.8, 2.3, cols[k % 5]);
      ell(c, px, py - h, 1.8, 1.8, "#f29b20");
    }
  }
  function champignons(c, x, y) {
    shadow(c, x, y, 24, 7);
    for (const [dx, dy, s] of [[-10, 2, 1], [12, -2, .7]]) {
      const bx = x + dx, by = y + dy;
      poly(c, [[bx - 5 * s, by], [bx - 4 * s, by - 16 * s], [bx + 4 * s, by - 16 * s], [bx + 5 * s, by]], "#f6ecd4", "#7a5c3c", 1.5);
      c.beginPath(); c.ellipse(bx, by - 16 * s, 15 * s, 12 * s, 0, Math.PI, 0); c.closePath(); c.fillStyle = rad(c, bx - 5 * s, by - 24 * s, 1, bx, by - 16 * s, 16 * s, [[0, "#ff7b6b"], [1, "#c5282b"]]); c.fill(); c.strokeStyle = "#6b1414"; c.lineWidth = 1.8; c.stroke();
      for (const [ox, oy] of [[-7, -19], [2, -24], [8, -18]]) ell(c, bx + ox * s, by + oy * s, 2.4 * s, 1.8 * s, "#fff");
    }
  }
  function hautesHerbes(c, x, y) {
    for (let k = 0; k < 16; k++) { const px = x + R(-24, 24), h = R(18, 34), bend = R(-10, 10); c.beginPath(); c.moveTo(px - 2, y); c.quadraticCurveTo(px, y - h * .6, px + bend, y - h); c.quadraticCurveTo(px + 1, y - h * .5, px + 2, y); c.fillStyle = k % 2 ? "#5fae3c" : "#8fd65a"; c.fill(); }
  }
  function roseaux(c, x, y) {
    for (let k = 0; k < 7; k++) {
      const px = x + R(-20, 20), h = R(36, 58), b = R(-5, 5);
      line(c, px, y, px + b, y - h, "#4f8a30", 2);
      if (k % 2 === 0) { ell(c, px + b, y - h + 6, 3.4, 9, "#7a4a22"); ell(c, px + b - 1, y - h + 3, 1.2, 4, "rgba(255,220,180,.4)"); }
      else leaf(c, px, y - 4, -Math.PI / 2 + R(-.4, .4), h * .8, 3, ["#3e7a2a", "#9ad860"]);
    }
  }

  // ─── Bâtiments et objets ───
  function maison(c, x, y) {
    const q = Q(x, y), a = 1.5, b = 1.4, h = 72, rh = 62, o = .16;
    shadow(c, x, y + 10, 120, 40);
    const R1 = q(-a / 2 - o, 0, h + rh), R2 = q(a / 2 + o, 0, h + rh);
    const F1 = q(-a / 2 - o, b / 2 + o, h - 12), F2 = q(a / 2 + o, b / 2 + o, h - 12), B1 = q(-a / 2 - o, -b / 2 - o, h - 12), B2 = q(a / 2 + o, -b / 2 - o, h - 12);
    poly(c, [R1, R2, B2, B1], "#b9822f", "#5a3a12", 2);
    // murs : enduit crème, poutres, soubassement de pierre
    box(c, q, 0, 0, a, b, 0, h, lin(c, x - 100, 0, x, 0, [[0, "#fbefd3"], [1, "#efdcb4"]]), lin(c, x, 0, x + 100, 0, [[0, "#ddc69b"], [1, "#c8ae80"]]), null);
    box(c, q, 0, 0, a, b, 0, 16, "#a59d90", "#857e72", null);
    for (const zz of [16, h]) { quad(c, q, [[-a / 2, b / 2, zz], [a / 2, b / 2, zz], [a / 2, b / 2, zz + 4], [-a / 2, b / 2, zz + 4]], "#7a4b25"); quad(c, q, [[a / 2, -b / 2, zz], [a / 2, b / 2, zz], [a / 2, b / 2, zz + 4], [a / 2, -b / 2, zz + 4]], "#5f3a1c"); }
    for (const ii of [-a / 2, -.2, .35]) quad(c, q, [[ii, b / 2, 16], [ii + .05, b / 2, 16], [ii + .05, b / 2, h], [ii, b / 2, h]], "#7a4b25");
    quad(c, q, [[a / 2, b / 2 - .05, 16], [a / 2, b / 2, 16], [a / 2, b / 2, h], [a / 2, b / 2 - .05, h]], "#5f3a1c");
    // porte (face gauche)
    quad(c, q, [[-.12, b / 2, 4], [.26, b / 2, 4], [.26, b / 2, 50], [-.12, b / 2, 50]], lin(c, x - 40, 0, x, 0, [[0, "#a8693a"], [1, "#7b4a24"]]), "#3d2310", 2);
    for (const ii of [0, .07, .14]) line(c, ...q(ii, b / 2, 6), ...q(ii, b / 2, 48), "rgba(40,20,5,.4)", 1.2);
    ell(c, ...q(.2, b / 2, 26), 2.4, 2.4, "#ffd23f");
    // fenêtre ronde (face droite)
    const win = []; for (let k = 0; k < 24; k++) { const t = k / 24 * TAU; win.push(q(a / 2, .05 + Math.cos(t) * .2, 44 + Math.sin(t) * 16)); }
    poly(c, win, rad(c, ...q(a / 2, 0, 50), 2, ...q(a / 2, .05, 44), 26, [[0, "#fff6c8"], [1, "#9fd4ef"]]), "#5f3a1c", 4);
    line(c, ...q(a / 2, -.15, 44), ...q(a / 2, .25, 44), "#5f3a1c", 2.4); line(c, ...q(a / 2, .05, 28), ...q(a / 2, .05, 60), "#5f3a1c", 2.4);
    // jardinière
    box(c, q, a / 2 + .06, .05, .08, .4, 18, 8, "#8a5530", "#6b4022", "#5a3a20", null);
    for (let k = 0; k < 6; k++) ell(c, ...q(a / 2 + .06, -.13 + k * .07, 30), 3.2, 3.2, k % 2 ? "#ff6f8f" : "#ffd23f");
    // pignon et toit de chaume
    quad(c, q, [[a / 2, -b / 2, h], [a / 2, b / 2, h], [a / 2, 0, h + rh - 6]], "#d1b98b", "rgba(40,25,10,.55)", 1.5);
    ell(c, ...q(a / 2, 0, h + 24), 7, 9, "#5f3a1c");
    box(c, q, -.35, -.15, .22, .22, h + 30, rh + 20, "#b0a596", "#8b8173", "#5a524a");
    poly(c, [R1, R2, F2, F1], lin(c, ...R1, ...F1, [[0, "#f3c96a"], [1, "#cf9640"]]), "#5a3a12", 2);
    for (let k = 1; k < 18; k++) { const t = k / 18; const p0 = [R1[0] + (R2[0] - R1[0]) * t, R1[1] + (R2[1] - R1[1]) * t], p1 = [F1[0] + (F2[0] - F1[0]) * t, F1[1] + (F2[1] - F1[1]) * t]; line(c, ...p0, ...p1, "rgba(130,80,25,.45)", 1.4); }
    for (let k = 0; k < 14; k++) { const t = (k + .5) / 14; ell(c, F1[0] + (F2[0] - F1[0]) * t, F1[1] + (F2[1] - F1[1]) * t + 2, 7, 5, k % 2 ? "#d79c45" : "#e8b45a"); }
    poly(c, [R2, F2, [F2[0] + 4, F2[1] + 4], [R2[0] + 4, R2[1] + 4]], "#9a6a28");
    // fumée
    for (let k = 0; k < 3; k++) ell(c, ...q(-.35 + k * .1, -.15 - k * .1, h + rh + 30 + k * 18), 8 + k * 3, 6 + k * 2, `rgba(255,255,255,${.6 - k * .15})`);
  }
  function etal(c, x, y) {
    const q = Q(x, y), a = 1.3, b = .7;
    shadow(c, x, y + 6, 100, 30);
    for (const [pi, pj] of [[-a / 2, -b / 2], [a / 2, -b / 2], [-a / 2, b / 2], [a / 2, b / 2]]) box(c, q, pi, pj, .07, .07, 0, pj < 0 ? 100 : 82, "#8a5530", "#6b4022", null);
    box(c, q, 0, .05, a, b * .7, 0, 34, lin(c, x - 80, 0, x, 0, [[0, "#c98f52"], [1, "#a36a36"]]), "#8a5530", "#d9a66a");
    for (let k = 1; k < 4; k++) line(c, ...q(-a / 2, .05 + b * .35, k * 9), ...q(a / 2, .05 + b * .35, k * 9), "rgba(60,30,10,.35)", 1.2);
    // marchandises : poissons et pommes
    for (let k = 0; k < 4; k++) { const [px, py] = q(-.45 + k * .22, .05, 38); ell(c, px, py, 11, 5, "#8fb6cf", -.4); ell(c, px - 4, py - 2, 2, 2, "#fff"); poly(c, [[px + 9, py - 6], [px + 15, py - 9], [px + 13, py - 1]], "#7aa0b8"); }
    for (let k = 0; k < 5; k++) { const [px, py] = q(.35 + (k % 3) * .08, -.12 + Math.floor(k / 3) * .1, 40); ell(c, px, py, 5, 5, "#e2453b"); ell(c, px - 1.5, py - 2, 1.5, 1.2, "rgba(255,255,255,.7)"); }
    // auvent rayé
    const o = .12, N = 8;
    for (let k = 0; k < N; k++) {
      const i0 = -a / 2 - o + (a + 2 * o) * k / N, i1 = -a / 2 - o + (a + 2 * o) * (k + 1) / N;
      quad(c, q, [[i0, -b / 2 - o, 104], [i1, -b / 2 - o, 104], [i1, b / 2 + o, 80], [i0, b / 2 + o, 80]], k % 2 ? "#fff4d6" : "#ffb52e", "rgba(120,60,10,.5)", 1);
      const [sx, sy] = q((i0 + i1) / 2, b / 2 + o, 80); const [ax, ay] = q(i0, b / 2 + o, 80), [bx, by] = q(i1, b / 2 + o, 80);
      c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(sx, sy + 14, bx, by); c.closePath(); c.fillStyle = k % 2 ? "#fff4d6" : "#ffb52e"; c.fill(); c.strokeStyle = "rgba(120,60,10,.5)"; c.lineWidth = 1; c.stroke();
    }
    // pancarte
    const [px, py] = q(a / 2 + .05, .3, 50); poly(c, [[px - 4, py - 14], [px + 26, py - 28], [px + 26, py - 8], [px - 4, py + 6]], "#f3e3c3", "#5f3a1c", 2);
    c.save(); c.translate(px + 11, py - 9); c.transform(1, -.47, 0, 1, 0, 0); c.fillStyle = "#5f3a1c"; c.font = "bold 9px sans-serif"; c.textAlign = "center"; c.fillText("POISSON", 0, 3); c.restore();
  }
  function cylindre(c, x, y, rx, ry, h, side, top, stroke = "#4a3e30") {
    c.beginPath(); c.moveTo(x - rx, y - h); c.lineTo(x - rx, y); c.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); c.lineTo(x + rx, y - h); c.closePath();
    c.fillStyle = side; c.fill(); c.strokeStyle = stroke; c.lineWidth = 2; c.stroke();
    ell(c, x, y - h, rx, ry, top); c.strokeStyle = stroke; c.stroke();
  }
  function puits(c, x, y) {
    shadow(c, x, y + 4, 56, 18);
    cylindre(c, x, y, 40, 20, 34, lin(c, x - 40, 0, x + 40, 0, [[0, "#d2cbbd"], [.5, "#b9b1a2"], [1, "#857d70"]]), "#cfc8b8");
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) { const t = (k + (r % 2) * .5) / 6; const px = x - 40 + 80 * t; line(c, px, y - r * 11 + 9 * Math.sin(t * Math.PI), px, y - r * 11 - 11 + 9 * Math.sin(t * Math.PI), "rgba(70,60,50,.4)", 1.2); }
    for (let r = 1; r < 3; r++) { c.beginPath(); c.ellipse(x, y - r * 11, 40, 20, 0, 0, Math.PI); c.strokeStyle = "rgba(70,60,50,.4)"; c.lineWidth = 1.2; c.stroke(); }
    ell(c, x, y - 34, 31, 14, lin(c, 0, y - 48, 0, y - 20, [[0, "#163a52"], [1, "#2f7fa8"]]));
    for (const dx of [-36, 36]) { poly(c, [[x + dx - 3, y - 30], [x + dx + 3, y - 30], [x + dx + 3, y - 98], [x + dx - 3, y - 98]], "#7a4b25", "#3d2310", 1.5); }
    line(c, x - 36, y - 84, x + 36, y - 84, "#5f3a1c", 4); line(c, x, y - 84, x, y - 58, "#c9b48a", 1.5);
    poly(c, [[x - 9, y - 58], [x + 9, y - 58], [x + 7, y - 44], [x - 7, y - 44]], "#9c6532", "#3d2310", 1.5);
    poly(c, [[x - 52, y - 92], [x, y - 128], [x + 52, y - 92], [x + 42, y - 88], [x, y - 116], [x - 42, y - 88]], "#c2453a", "#5c1a14", 2);
    poly(c, [[x, y - 128], [x + 52, y - 92], [x + 42, y - 88], [x, y - 116]], "rgba(0,0,0,.18)");
  }
  function phare(c, x, y) {
    shadow(c, x, y + 4, 60, 18);
    cylindre(c, x, y, 52, 24, 20, "#9e968a", "#b9b1a2");
    const H = 210, r0 = 36, r1 = 25, yb = y - 20;
    const body = () => { c.beginPath(); c.moveTo(x - r0, yb); c.lineTo(x - r1, yb - H); c.lineTo(x + r1, yb - H); c.lineTo(x + r0, yb); c.ellipse(x, yb, r0, r0 * .45, 0, 0, Math.PI); c.closePath(); };
    body(); c.fillStyle = "#f6f1e6"; c.fill();
    c.save(); body(); c.clip();
    for (let k = 0; k < 4; k++) {
      const z0 = 20 + k * 52, z1 = z0 + 26, ra = r0 + (r1 - r0) * z0 / H, rb = r0 + (r1 - r0) * z1 / H;
      c.beginPath(); c.ellipse(x, yb - z0, ra, ra * .45, 0, Math.PI, 0, true); c.lineTo(x + rb, yb - z1); c.ellipse(x, yb - z1, rb, rb * .45, 0, 0, Math.PI); c.closePath(); c.fillStyle = "#d8463a"; c.fill();
    }
    c.fillStyle = lin(c, x - r0, 0, x + r0, 0, [[0, "rgba(255,255,255,.25)"], [.45, "rgba(0,0,0,0)"], [1, "rgba(30,20,40,.35)"]]); c.fillRect(x - r0, yb - H, r0 * 2, H + 30);
    c.restore(); body(); c.strokeStyle = "#4a3e30"; c.lineWidth = 2; c.stroke();
    poly(c, [[x - 10, yb + 14], [x - 10, yb - 16], [x + 10, yb - 16], [x + 10, yb + 14]], "#6b4022", "#3d2310", 2);
    const yt = yb - H;
    ell(c, x, yt, 40, 16, "#3e3a44"); ell(c, x, yt - 3, 40, 16, "#5a5560");
    ell(c, x, yt - 30, 70, 50, rad(c, x, yt - 30, 4, x, yt - 30, 70, [[0, "rgba(255,230,120,.75)"], [1, "rgba(255,230,120,0)"]]));
    poly(c, [[x - 20, yt - 4], [x - 20, yt - 40], [x + 20, yt - 40], [x + 20, yt - 4]], lin(c, x - 20, 0, x + 20, 0, [[0, "#fff6b0"], [1, "#ffcc3a"]]), "#2f2b33", 3);
    line(c, x, yt - 4, x, yt - 40, "#2f2b33", 2.4);
    for (let k = 0; k < 9; k++) { const t = k / 8; line(c, x - 40 + 80 * t, yt - 3 + 12 * Math.sin(t * Math.PI), x - 40 + 80 * t, yt - 17 + 12 * Math.sin(t * Math.PI), "#2f2b33", 1.6); }
    c.beginPath(); c.ellipse(x, yt - 17, 40, 16, 0, 0, Math.PI); c.strokeStyle = "#2f2b33"; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(x - 26, yt - 40); c.quadraticCurveTo(x, yt - 76, x + 26, yt - 40); c.closePath(); c.fillStyle = "#c2453a"; c.fill(); c.strokeStyle = "#5c1a14"; c.stroke();
    ell(c, x, yt - 60, 4, 4, "#ffd23f");
  }
  function cloture(c, x, y) {
    const d = [32, 16];
    for (const k of [-1, 0, 1]) { const px = x + d[0] * k, py = y + d[1] * k; poly(c, [[px - 4, py], [px - 4, py - 36], [px, py - 42], [px + 4, py - 36], [px + 4, py]], "#b07a45", "#4a2a12", 1.6); }
    for (const z of [14, 28]) { c.beginPath(); c.moveTo(x - 36, y - 18 - z + 2); c.lineTo(x + 36, y + 18 - z + 2); c.strokeStyle = "#4a2a12"; c.lineWidth = 7; c.stroke(); c.strokeStyle = "#c48a50"; c.lineWidth = 4.5; c.stroke(); }
  }
  function lanterne(c, x, y) {
    shadow(c, x, y, 16, 6);
    ell(c, x, y - 76, 46, 46, rad(c, x, y - 76, 2, x, y - 76, 46, [[0, "rgba(255,210,90,.55)"], [1, "rgba(255,210,90,0)"]]));
    poly(c, [[x - 3, y], [x - 3, y - 64], [x + 3, y - 64], [x + 3, y]], "#3e3a44", "#1d1a20", 1.5);
    poly(c, [[x - 10, y - 64], [x + 10, y - 64], [x + 12, y - 90], [x - 12, y - 90]], lin(c, x - 10, 0, x + 10, 0, [[0, "#fff4b0"], [1, "#ffb52e"]]), "#1d1a20", 2.4);
    line(c, x, y - 64, x, y - 90, "#1d1a20", 1.5);
    poly(c, [[x - 16, y - 90], [x + 16, y - 90], [x, y - 102]], "#3e3a44", "#1d1a20", 1.5);
  }
  function panneau(c, x, y) {
    shadow(c, x, y, 18, 6);
    poly(c, [[x - 3, y], [x - 3, y - 70], [x + 3, y - 70], [x + 3, y]], "#9c6532", "#3d2310", 1.5);
    const sign = (yy, dir, txt) => {
      const w = 54, pts = dir > 0 ? [[x - 4, yy], [x + w, yy - 6], [x + w + 10, yy + 4], [x + w, yy + 14], [x - 4, yy + 20]] : [[x + 4, yy - 6], [x - w, yy], [x - w - 10, yy + 10], [x - w, yy + 20], [x + 4, yy + 14]];
      poly(c, pts, "#e8c891", "#5f3a1c", 2);
      c.save(); c.fillStyle = "#5f3a1c"; c.font = "bold 10px sans-serif"; c.textAlign = "center"; c.translate(x + dir * 26, yy + 10); c.rotate(dir * -.1); c.fillText(txt, 0, 0); c.restore();
    };
    sign(y - 66, 1, "ÉTANG"); sign(y - 42, -1, "MARCHÉ");
  }
  function coffre(c, x, y) {
    const q = Q(x, y); shadow(c, x, y + 2, 34, 11);
    box(c, q, 0, 0, .46, .3, 0, 22, "#a8693a", "#7b4a24", null, "#3d2310");
    const L = [q(-.23, .15, 22), q(.23, .15, 22)], Rr = [q(.23, -.15, 22), q(.23, .15, 22)];
    c.beginPath(); c.moveTo(...q(-.23, .15, 22)); c.quadraticCurveTo(...q(-.23, .15, 40), ...q(-.23, -.15, 34)); c.lineTo(...q(.23, -.15, 34)); c.quadraticCurveTo(...q(.23, .15, 40), ...q(.23, .15, 22)); c.closePath(); c.fillStyle = "#c58046"; c.fill(); c.strokeStyle = "#3d2310"; c.lineWidth = 1.6; c.stroke();
    c.beginPath(); c.moveTo(...q(.23, .15, 22)); c.quadraticCurveTo(...q(.23, .15, 40), ...q(.23, -.15, 34)); c.lineTo(...q(.23, -.15, 22)); c.closePath(); c.fillStyle = "#94592c"; c.fill(); c.stroke();
    for (const t of [-.15, .15]) line(c, ...q(t, .15, 0), ...q(t, .15, 32), "#ffd23f", 3);
    poly(c, [q(-.03, .15, 12), q(.05, .15, 12), q(.05, .15, 24), q(-.03, .15, 24)], "#ffd23f", "#8a5a10", 1.5);
    void L; void Rr;
  }
  function tonneau(c, x, y) {
    shadow(c, x, y + 2, 24, 8);
    c.beginPath(); c.moveTo(x - 18, y); c.quadraticCurveTo(x - 24, y - 22, x - 18, y - 44); c.lineTo(x + 18, y - 44); c.quadraticCurveTo(x + 24, y - 22, x + 18, y); c.ellipse(x, y, 18, 8, 0, 0, Math.PI); c.closePath();
    c.fillStyle = lin(c, x - 22, 0, x + 22, 0, [[0, "#c98f52"], [.5, "#a36a36"], [1, "#6b4022"]]); c.fill(); c.strokeStyle = "#3d2310"; c.lineWidth = 2; c.stroke();
    for (const t of [-.5, 0, .5]) line(c, x + t * 22, y + 5, x + t * 22, y - 40, "rgba(40,20,5,.35)", 1.2);
    for (const yy of [-8, -36]) { c.beginPath(); c.ellipse(x, y + yy, 21, 8, 0, 0, Math.PI); c.strokeStyle = "#4a4a52"; c.lineWidth = 3; c.stroke(); }
    ell(c, x, y - 44, 18, 8, "#b8834c"); c.strokeStyle = "#3d2310"; c.lineWidth = 2; c.stroke();
  }
  function caisse(c, x, y) {
    const q = Q(x, y); shadow(c, x, y + 2, 30, 10);
    box(c, q, 0, 0, .36, .36, 0, 34, "#d9a66a", "#b07a45", "#e8bd85", "#4a2a12");
    for (const [a1, b1] of [[[-.18, .18, 0], [.18, .18, 34]], [[.18, .18, 0], [-.18, .18, 34]]]) line(c, ...q(...a1), ...q(...b1), "#8a5530", 3);
    for (const [a1, b1] of [[[.18, -.18, 0], [.18, .18, 34]], [[.18, .18, 0], [.18, -.18, 34]]]) line(c, ...q(...a1), ...q(...b1), "#6b4022", 3);
  }

  // ─── Personnages ───
  const OUT = "#5a3a0a";
  function canard(c, x, y, view = "face", mood = "", pose = {}) {
    const { step = 0, bob = 0, lean = 0, hit = false } = pose;
    shadow(c, x, y, 24 + bob * .4, 8 + bob * .12);
    ell(c, x - 8 + step * 5, y - 2 - Math.max(0, step) * 4, 7, 3.5, "#ff8a3d"); ell(c, x + 8 - step * 5, y - Math.max(0, -step) * 4, 7, 3.5, "#ff8a3d");
    c.save(); c.translate(x, y + bob); c.rotate(lean); c.translate(-x, -y);
    if (hit) c.filter = "sepia(1) saturate(5) hue-rotate(-40deg) brightness(1.05)";
    const body = rad(c, x - 8, y - 34, 2, x, y - 22, 28, [[0, "#fff4a8"], [.55, "#ffd23f"], [1, "#e89a18"]]);
    if (view === "face") {
      poly(c, [[x - 18, y - 30], [x - 30, y - 42], [x - 20, y - 22]], "#f2b52a", OUT, 2);
      ell(c, x, y - 22, 22, 19, body); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
      ell(c, x - 3, y - 18, 11, 9, "rgba(255,250,220,.5)");
      if (mood === "joie") { leaf(c, x + 16, y - 30, -1.1, 22, 7, ["#f2b52a", "#ffe27a"]); leaf(c, x - 16, y - 30, -2.0, 22, 7, ["#f2b52a", "#ffe27a"]); }
      else { ell(c, x - 15, y - 22, 7, 11, "#f2b52a", .5); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); }
      const hd = rad(c, x - 4, y - 58, 2, x + 2, y - 50, 22, [[0, "#fff4a8"], [.6, "#ffd23f"], [1, "#e89a18"]]);
      ell(c, x + 3, y - 50, 17, 16, hd); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
      for (const [dx, a] of [[0, -1.9], [4, -1.4]]) leaf(c, x + 3 + dx, y - 64, a, 10, 3, ["#ffd23f", "#e89a18"]);
      ell(c, x - 6, y - 43, 4, 2.5, "rgba(255,120,120,.5)");
      c.beginPath(); c.moveTo(x + 10, y - 47); c.quadraticCurveTo(x + 30, y - 47, x + 30, y - 42); c.quadraticCurveTo(x + 22, y - 37, x + 10, y - 40); c.closePath(); c.fillStyle = "#ff8a3d"; c.fill(); c.strokeStyle = "#a8481a"; c.lineWidth = 1.8; c.stroke();
      line(c, x + 12, y - 43, x + 26, y - 43, "#c9541f", 1.2);
      // lunettes de soleil (le signe de Dip Duck)
      c.beginPath(); c.roundRect(x - 6, y - 59, 13, 9, 3); c.roundRect(x + 9, y - 59, 12, 9, 3); c.fillStyle = "#16141c"; c.fill();
      line(c, x + 7, y - 56, x + 9, y - 56, "#16141c", 2); line(c, x - 6, y - 56, x - 12, y - 58, "#16141c", 2);
      line(c, x - 3, y - 57, x, y - 54, "rgba(255,255,255,.8)", 1.5); line(c, x + 12, y - 57, x + 15, y - 54, "rgba(255,255,255,.8)", 1.5);
      if (mood === "joie") { c.beginPath(); c.moveTo(x - 7, y - 70); c.lineTo(x + 3, y - 96); c.lineTo(x + 13, y - 68); c.closePath(); c.fillStyle = "#4aa3df"; c.fill(); c.strokeStyle = "#1d4f78"; c.lineWidth = 1.6; c.stroke(); ell(c, x + 3, y - 97, 3.5, 3.5, "#ff7aa2"); }
    } else {
      ell(c, x, y - 22, 22, 19, body); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
      ell(c, x - 15, y - 22, 7, 11, "#f2b52a", .5); ell(c, x + 15, y - 22, 7, 11, "#f2b52a", -.5);
      poly(c, [[x - 6, y - 12], [x, y - 2], [x + 6, y - 12]], "#f2b52a", OUT, 1.6);
      ell(c, x - 2, y - 50, 17, 16, rad(c, x - 6, y - 58, 2, x, y - 50, 22, [[0, "#ffe27a"], [1, "#e89a18"]])); c.strokeStyle = OUT; c.lineWidth = 2.2; c.stroke();
      line(c, x - 18, y - 52, x + 14, y - 55, "#16141c", 2);
      for (const [dx, a] of [[0, -1.9], [4, -1.4]]) leaf(c, x - 2 + dx, y - 64, a, 10, 3, ["#ffd23f", "#e89a18"]);
    }
    c.restore();
    if (hit) for (let k = 0; k < 3; k++) { const a = -2.4 + k * .5; c.fillStyle = "#ffd23f"; c.font = "bold 16px sans-serif"; c.fillText("✦", x + Math.cos(a) * 36 - 6, y - 56 + Math.sin(a) * 26); }
  }
  function eyes(c, x, y, r, gap, look = 1) { for (const s of [-1, 1]) { ell(c, x + s * gap, y, r, r, "#fff"); c.strokeStyle = "#1d1a20"; c.lineWidth = 1.6; c.stroke(); ell(c, x + s * gap + look * r * .3, y + r * .1, r * .5, r * .55, "#1d1a20"); ell(c, x + s * gap + look * r * .1, y - r * .25, r * .18, r * .18, "#fff"); } }
  function grenouille(c, x, y) {
    shadow(c, x, y, 26, 8);
    line(c, x + 24, y, x + 30, y - 52, "#7a4b25", 4); ell(c, x + 31, y - 54, 5, 4, "#9c6532");
    ell(c, x - 12, y - 2, 10, 4, "#3f8d2c"); ell(c, x + 12, y - 2, 10, 4, "#3f8d2c");
    ell(c, x, y - 24, 24, 22, rad(c, x - 8, y - 34, 2, x, y - 24, 28, [[0, "#a6e070"], [1, "#3f8d2c"]])); c.strokeStyle = "#1f5a1c"; c.lineWidth = 2.2; c.stroke();
    ell(c, x, y - 18, 14, 12, "#e6f5c0");
    ell(c, x - 11, y - 46, 9, 9, "#7cc84a"); ell(c, x + 11, y - 46, 9, 9, "#7cc84a");
    eyes(c, x, y - 47, 6, 11);
    line(c, x - 18, y - 56, x - 6, y - 58, "#fff", 3); line(c, x + 6, y - 58, x + 18, y - 56, "#fff", 3);
    c.beginPath(); c.moveTo(x - 12, y - 34); c.quadraticCurveTo(x, y - 28, x + 12, y - 34); c.strokeStyle = "#1f5a1c"; c.lineWidth = 2; c.stroke();
    poly(c, [[x - 10, y - 31], [x + 10, y - 31], [x + 2, y - 6], [x - 2, y - 6]], "#ffffff", "#c9c2b0", 1.2);
    line(c, x + 18, y - 26, x + 28, y - 40, "#3f8d2c", 5);
  }
  function castor(c, x, y) {
    shadow(c, x, y, 28, 9);
    c.save(); c.translate(x - 22, y - 8); c.rotate(-.5); c.beginPath(); c.roundRect(-10, -26, 20, 34, 8); c.fillStyle = "#6b4a2e"; c.fill(); c.strokeStyle = "#2e1d10"; c.lineWidth = 2; c.stroke();
    for (let k = -2; k <= 2; k++) line(c, k * 4, -22, k * 4, 4, "rgba(0,0,0,.25)", 1); c.restore();
    ell(c, x, y - 24, 22, 22, rad(c, x - 8, y - 34, 2, x, y - 24, 28, [[0, "#c08a5a"], [1, "#7a4f2a"]])); c.strokeStyle = "#2e1d10"; c.lineWidth = 2.2; c.stroke();
    ell(c, x, y - 18, 13, 13, "#e9cfa8");
    poly(c, [[x - 18, y - 24], [x + 18, y - 24], [x + 16, y - 12], [x - 16, y - 12]], "#3d6fb0", "#1d3a66", 1.6);
    ell(c, x, y - 50, 17, 15, rad(c, x - 6, y - 56, 2, x, y - 50, 20, [[0, "#c08a5a"], [1, "#7a4f2a"]])); c.strokeStyle = "#2e1d10"; c.lineWidth = 2.2; c.stroke();
    ell(c, x - 13, y - 62, 5, 5, "#7a4f2a"); ell(c, x + 13, y - 62, 5, 5, "#7a4f2a");
    eyes(c, x, y - 54, 4, 7);
    ell(c, x, y - 44, 8, 6, "#e9cfa8"); ell(c, x, y - 47, 3, 2.2, "#2e1d10");
    poly(c, [[x - 4, y - 42], [x + 4, y - 42], [x + 4, y - 35], [x - 4, y - 35]], "#fff", "#8a7a60", 1.2); line(c, x, y - 42, x, y - 35, "#8a7a60", 1);
  }
  function crapaude(c, x, y) {
    shadow(c, x, y, 28, 9);
    ell(c, x, y - 22, 26, 22, rad(c, x - 8, y - 34, 2, x, y - 24, 30, [[0, "#b9a46a"], [1, "#6e6236"]])); c.strokeStyle = "#3a3218"; c.lineWidth = 2.2; c.stroke();
    for (let k = 0; k < 6; k++) ell(c, x + R(-16, 16), y - R(10, 34), 2.5, 2, "rgba(60,50,20,.4)");
    c.beginPath(); c.moveTo(x - 28, y - 26); c.quadraticCurveTo(x, y - 4, x + 28, y - 26); c.lineTo(x + 22, y - 36); c.quadraticCurveTo(x, y - 24, x - 22, y - 36); c.closePath(); c.fillStyle = "#7b4bb5"; c.fill(); c.strokeStyle = "#3b2160"; c.lineWidth = 1.6; c.stroke();
    for (const [px, py] of [[x - 12, y - 24], [x + 6, y - 20], [x + 16, y - 27]]) { c.fillStyle = "#ffd23f"; c.font = "10px sans-serif"; c.fillText("✦", px - 4, py + 3); }
    ell(c, x, y - 46, 18, 13, rad(c, x - 6, y - 52, 2, x, y - 46, 20, [[0, "#c4b07a"], [1, "#7a6c3e"]])); c.strokeStyle = "#3a3218"; c.lineWidth = 2; c.stroke();
    eyes(c, x, y - 54, 5, 9, -1);
    c.beginPath(); c.moveTo(x - 10, y - 42); c.quadraticCurveTo(x, y - 38, x + 10, y - 42); c.strokeStyle = "#3a3218"; c.lineWidth = 1.8; c.stroke();
    c.beginPath(); c.ellipse(x, y - 64, 22, 7, 0, 0, TAU); c.fillStyle = "#7b4bb5"; c.fill(); c.strokeStyle = "#3b2160"; c.stroke();
    ell(c, x + 26, y - 14, 10, 10, rad(c, x + 23, y - 17, 1, x + 26, y - 14, 11, [[0, "#ffffff"], [.5, "#b8e4ff"], [1, "#6c8fd9"]])); c.strokeStyle = "#3b2160"; c.lineWidth = 1.6; c.stroke();
  }
  function goeland(c, x, y) {
    shadow(c, x, y, 24, 8);
    line(c, x - 6, y, x - 6, y - 12, "#f2a530", 3); line(c, x + 6, y, x + 6, y - 12, "#f2a530", 3);
    ell(c, x, y - 28, 20, 20, rad(c, x - 6, y - 36, 2, x, y - 28, 24, [[0, "#ffffff"], [1, "#c9ced8"]])); c.strokeStyle = "#4a4e5a"; c.lineWidth = 2.2; c.stroke();
    ell(c, x - 14, y - 28, 8, 14, "#8e96a8", .3); c.strokeStyle = "#4a4e5a"; c.lineWidth = 1.6; c.stroke();
    ell(c, x + 2, y - 54, 14, 13, "#ffffff"); c.strokeStyle = "#4a4e5a"; c.lineWidth = 2; c.stroke();
    poly(c, [[x + 12, y - 54], [x + 30, y - 50], [x + 12, y - 47]], "#ffcf3a", "#9a6a10", 1.5); ell(c, x + 24, y - 49, 2, 1.6, "#d8463a");
    eyes(c, x + 2, y - 57, 3.5, 5);
    c.beginPath(); c.ellipse(x + 2, y - 64, 15, 5, 0, 0, TAU); c.fillStyle = "#24345c"; c.fill();
    c.beginPath(); c.roundRect(x - 10, y - 76, 24, 12, 4); c.fill(); line(c, x - 10, y - 66, x + 14, y - 66, "#ffd23f", 2); ell(c, x + 2, y - 71, 2.5, 2.5, "#ffd23f");
  }
  function bougie(c, x, y, mood = "") {
    shadow(c, x, y, 20, 7);
    ell(c, x, y - 68, 30, 30, rad(c, x, y - 68, 2, x, y - 68, 30, [[0, "rgba(255,170,60,.6)"], [1, "rgba(255,120,40,0)"]]));
    ell(c, x - 8, y - 2, 6, 3, "#8a1f1f"); ell(c, x + 8, y - 1, 6, 3, "#8a1f1f");
    c.beginPath(); c.moveTo(x - 16, y - 4); c.lineTo(x - 16, y - 50); c.ellipse(x, y - 50, 16, 6, 0, Math.PI, 0); c.lineTo(x + 16, y - 4); c.ellipse(x, y - 4, 16, 6, 0, 0, Math.PI); c.closePath();
    c.fillStyle = lin(c, x - 16, 0, x + 16, 0, [[0, "#ff6b5e"], [.5, "#e0362f"], [1, "#9e1d1d"]]); c.fill(); c.strokeStyle = "#5c0f0f"; c.lineWidth = 2; c.stroke();
    for (const [dx, l] of [[-10, 16], [2, 10], [10, 22]]) { c.beginPath(); c.moveTo(x + dx - 3, y - 52); c.lineTo(x + dx - 3, y - 52 + l); c.arc(x + dx, y - 52 + l, 3, Math.PI, 0, true); c.lineTo(x + dx + 3, y - 52); c.fillStyle = "#ff7b6b"; c.fill(); }
    ell(c, x, y - 50, 16, 6, "#ff8a7a"); c.strokeStyle = "#5c0f0f"; c.lineWidth = 1.6; c.stroke();
    line(c, x, y - 52, x, y - 60, "#2a1a10", 2);
    c.beginPath(); c.moveTo(x, y - 84); c.quadraticCurveTo(x + 10, y - 66, x, y - 58); c.quadraticCurveTo(x - 10, y - 66, x, y - 84); c.fillStyle = "#ffb52e"; c.fill();
    c.beginPath(); c.moveTo(x, y - 76); c.quadraticCurveTo(x + 5, y - 64, x, y - 60); c.quadraticCurveTo(x - 5, y - 64, x, y - 76); c.fillStyle = "#fff4b0"; c.fill();
    eyes(c, x, y - 30, 5, 7, 1);
    line(c, x - 13, y - 39, x - 3, y - 35, "#3a0808", 2.4); line(c, x + 13, y - 39, x + 3, y - 35, "#3a0808", 2.4);
    if (mood === "attaque") { c.beginPath(); c.ellipse(x, y - 18, 6, 4, 0, 0, TAU); c.fillStyle = "#3a0808"; c.fill(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * .45; line(c, x + Math.cos(a) * 30, y - 68 + Math.sin(a) * 30, x + Math.cos(a) * 40, y - 68 + Math.sin(a) * 40, "#ffb52e", 2.4); } }
    else { c.beginPath(); c.moveTo(x - 6, y - 17); c.quadraticCurveTo(x, y - 21, x + 6, y - 17); c.strokeStyle = "#3a0808"; c.lineWidth = 2; c.stroke(); }
  }

  // ─── Bâtiments des époques ───
  // Rectangle posé sur une face : "L" = face avant gauche (j = b/2, u le long de i), "R" = face avant droite (i = a/2, u le long de j).
  function faceRect(c, q, face, a, b, u0, u1, z0, z1, fill, stroke, lw = 1.2) {
    const P = (u, z) => face === "L" ? q(u, b / 2, z) : q(a / 2, u, z);
    poly(c, [P(u0, z0), P(u1, z0), P(u1, z1), P(u0, z1)], fill, stroke, lw);
  }
  function faceCircle(c, q, face, a, b, uc, zc, ru, rz, fill, stroke, lw = 2) {
    const pts = []; for (let k = 0; k < 28; k++) { const t = k / 28 * TAU; const u = uc + Math.cos(t) * ru, z = zc + Math.sin(t) * rz; pts.push(face === "L" ? q(u, b / 2, z) : q(a / 2, u, z)); }
    poly(c, pts, fill, stroke, lw);
  }
  function windows(c, q, face, a, b, cols, rows, z0, z1, col, lit) {
    const span = face === "L" ? a : b, m = .1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const u0 = -span / 2 + m + (span - 2 * m) * k / cols + .03, u1 = u0 + (span - 2 * m) / cols - .06;
      const zz0 = z0 + (z1 - z0) * r / rows + 4, zz1 = zz0 + (z1 - z0) / rows - 8;
      faceRect(c, q, face, a, b, u0, u1, zz0, zz1, lit && rnd() < lit ? "#ffe27a" : col, "rgba(20,20,30,.5)");
    }
  }
  function fumee(c, x, y, n, col = "rgba(120,120,125,") { for (let k = 0; k < n; k++) ell(c, x + k * 9 + R(-4, 4), y - k * 18, 10 + k * 4, 8 + k * 3, `${col}${.75 - k * .12})`); }
  function moulin(c, x, y) {
    shadow(c, x, y + 4, 52, 16);
    const H = 120, r0 = 34, r1 = 24;
    c.beginPath(); c.moveTo(x - r0, y); c.lineTo(x - r1, y - H); c.lineTo(x + r1, y - H); c.lineTo(x + r0, y); c.ellipse(x, y, r0, 14, 0, 0, Math.PI); c.closePath();
    c.fillStyle = lin(c, x - r0, 0, x + r0, 0, [[0, "#e6dccb"], [.5, "#cfc3ad"], [1, "#9a8e7a"]]); c.fill(); c.strokeStyle = "#4a3e30"; c.lineWidth = 2; c.stroke();
    for (let k = 1; k < 7; k++) { const yy = y - k * 17, r = r0 + (r1 - r0) * k * 17 / H; c.beginPath(); c.ellipse(x, yy, r, r * .4, 0, 0, Math.PI); c.strokeStyle = "rgba(80,70,55,.35)"; c.lineWidth = 1.2; c.stroke(); }
    poly(c, [[x - 8, y + 12], [x - 8, y - 22], [x + 8, y - 22], [x + 8, y + 12]], "#7b4a24", "#3d2310", 2);
    c.beginPath(); c.moveTo(x - r1 - 8, y - H); c.lineTo(x, y - H - 50); c.lineTo(x + r1 + 8, y - H); c.ellipse(x, y - H, r1 + 8, 10, 0, 0, Math.PI); c.closePath(); c.fillStyle = lin(c, x - 30, 0, x + 30, 0, [[0, "#d9584a"], [1, "#8e2a22"]]); c.fill(); c.strokeStyle = "#4a1410"; c.stroke();
    const hx = x + 6, hy = y - H + 10;
    for (let k = 0; k < 4; k++) {
      const a = .4 + k * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a) * .85;
      const p = (d, w) => [hx + ca * d - sa * w, hy + sa * d + ca * w * .85];
      line(c, hx, hy, ...p(92, 0), "#5f3a1c", 4);
      poly(c, [p(20, 3), p(90, 3), p(90, 20), p(20, 20)], "rgba(250,240,215,.92)", "#5f3a1c", 1.6);
      for (let d = 34; d < 90; d += 14) line(c, ...p(d, 3), ...p(d, 20), "#8a5530", 1);
    }
    ell(c, hx, hy, 6, 6, "#3d2310");
  }
  function forge(c, x, y) {
    const q = Q(x, y), a = 1.3, b = 1;
    shadow(c, x, y + 8, 100, 32);
    box(c, q, 0, 0, a, b, 0, 60, lin(c, x - 90, 0, x, 0, [[0, "#a9a297"], [1, "#8a8377"]]), "#6e685e", null);
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) faceRect(c, q, "L", a, b, Math.max(-a / 2, -a / 2 + k * a / 6 - (r % 2) * .1), Math.min(a / 2, -a / 2 + (k + 1) * a / 6 - (r % 2) * .1 - .02), r * 12 + 1, r * 12 + 11, null, "rgba(50,45,40,.35)", 1);
    faceRect(c, q, "L", a, b, -.25, .2, 0, 40, "#2a1d16", "#1a120c", 2);
    ell(c, ...q(-.02, b / 2 + .05, 14), 26, 16, rad(c, ...q(0, b / 2, 14), 2, ...q(0, b / 2, 14), 26, [[0, "rgba(255,190,80,.9)"], [1, "rgba(255,90,30,0)"]]));
    quad(c, q, [[-a / 2 - .1, -b / 2 - .1, 58], [a / 2 + .1, -b / 2 - .1, 58], [a / 2 + .1, 0, 92], [-a / 2 - .1, 0, 92]], "#4a4750", "#2a2830", 2);
    quad(c, q, [[a / 2, -b / 2, 60], [a / 2, b / 2, 60], [a / 2, 0, 90]], "#6e685e", "#2a2830", 1.5);
    box(c, q, -.3, -.25, .25, .25, 70, 60, "#8a5a46", "#6b4434", "#3a2a22");
    quad(c, q, [[-a / 2 - .1, b / 2 + .1, 58], [a / 2 + .1, b / 2 + .1, 58], [a / 2 + .1, 0, 92], [-a / 2 - .1, 0, 92]], "#5d5a63", "#2a2830", 2);
    fumee(c, ...q(-.3, -.25, 136), 3);
    const [ax, ay] = q(a / 2 + .3, .1, 0); poly(c, [[ax - 14, ay], [ax - 10, ay - 12], [ax - 20, ay - 18], [ax + 20, ay - 18], [ax + 12, ay - 12], [ax + 14, ay]], "#3e3a44", "#16141c", 1.6);
  }
  function usine(c, x, y) {
    const q = Q(x, y), a = 1.8, b = 1.2, h = 80;
    shadow(c, x, y + 10, 150, 46);
    box(c, q, 0, 0, a, b, 0, h, lin(c, x - 150, 0, x, 0, [[0, "#c2603f"], [1, "#9c4630"]]), "#7e3826", null);
    for (let r = 0; r < 10; r++) { const z = r * 8; line(c, ...q(-a / 2, b / 2, z), ...q(a / 2, b / 2, z), "rgba(255,220,200,.18)", 1); line(c, ...q(a / 2, -b / 2, z), ...q(a / 2, b / 2, z), "rgba(255,220,200,.12)", 1); }
    windows(c, q, "L", a, b, 6, 2, 12, h - 6, "#3a4a5c", .5); windows(c, q, "R", a, b, 3, 2, 12, h - 6, "#2e3a48", .4);
    for (const [ci, cj, hh] of [[-.5, -.35, 170], [.2, -.35, 200]]) { const [cx, cy] = q(ci, cj, h); cylindre(c, cx, cy + 10, 13, 6, hh - h + 10, lin(c, cx - 13, 0, cx + 13, 0, [[0, "#b8563a"], [1, "#6e2a1c"]]), "#2a1a14"); line(c, cx - 13, cy - (hh - h) + 22, cx + 13, cy - (hh - h) + 22, "#e8e2d6", 4); }
    for (let k = 0; k < 4; k++) { const i0 = -a / 2 + k * a / 4, i1 = i0 + a / 4; quad(c, q, [[i0, -b / 2, h], [i0, b / 2, h], [i1, b / 2, h + 34], [i1, -b / 2, h + 34]], "#5d5a63", "#2a2830", 1.6); quad(c, q, [[i1, -b / 2, h + 34], [i1, b / 2, h + 34], [i1, b / 2, h], [i1, -b / 2, h]], "#8fb4cf", "#2a2830", 1.6); }
    for (const [ci, cj, hh] of [[-.5, -.35, 170], [.2, -.35, 200]]) { const [cx, cy] = q(ci, cj, h); fumee(c, cx, cy - (hh - h) - 4, 5, "rgba(90,90,95,"); }
    faceRect(c, q, "L", a, b, .45, .8, 0, 46, "#4a3a2e", "#2a1d16", 2);
  }
  function chateauEau(c, x, y) {
    shadow(c, x, y + 4, 50, 16);
    for (const [dx, dy] of [[-30, -6], [30, -6], [-18, 8], [18, 8]]) line(c, x + dx, y + dy, x + dx * .55, y - 110, "#5d5a63", 5);
    line(c, x - 26, y - 40, x + 26, y - 40, "#5d5a63", 3); line(c, x - 24, y - 75, x + 24, y - 75, "#5d5a63", 3);
    cylindre(c, x, y - 108, 44, 18, 60, lin(c, x - 44, 0, x + 44, 0, [[0, "#9fc0d6"], [.5, "#7a9db6"], [1, "#4e6a80"]]), "#7a9db6", "#24303c");
    for (const z of [20, 40]) { c.beginPath(); c.ellipse(x, y - 108 - z, 44, 18, 0, 0, Math.PI); c.strokeStyle = "#24303c"; c.lineWidth = 1.5; c.stroke(); }
    c.beginPath(); c.moveTo(x - 48, y - 168); c.lineTo(x, y - 205); c.lineTo(x + 48, y - 168); c.ellipse(x, y - 168, 48, 19, 0, 0, Math.PI); c.closePath(); c.fillStyle = lin(c, x - 48, 0, x + 48, 0, [[0, "#c2603f"], [1, "#7e3826"]]); c.fill(); c.strokeStyle = "#3a1810"; c.lineWidth = 2; c.stroke();
    c.fillStyle = "#fff"; c.font = "bold 15px sans-serif"; c.textAlign = "center"; c.fillText("ÉTANG", x, y - 128); c.textAlign = "left";
  }
  function bureaux(c, x, y) {
    const q = Q(x, y), a = 1.1, b = 1, h = 230;
    shadow(c, x, y + 8, 90, 30);
    box(c, q, 0, 0, a, b, 0, h, lin(c, x - 70, y - h, x, y, [[0, "#9fd6f2"], [1, "#4f8fbf"]]), lin(c, x, y - h, x + 70, y, [[0, "#6aa6cf"], [1, "#2f5f8a"]]), "#c9d6de");
    for (let z = 20; z < h; z += 18) { line(c, ...q(-a / 2, b / 2, z), ...q(a / 2, b / 2, z), "rgba(30,50,80,.55)", 2); line(c, ...q(a / 2, -b / 2, z), ...q(a / 2, b / 2, z), "rgba(20,35,60,.55)", 2); }
    for (let k = 1; k < 5; k++) { line(c, ...q(-a / 2 + k * a / 5, b / 2, 0), ...q(-a / 2 + k * a / 5, b / 2, h), "rgba(30,50,80,.4)", 1.2); line(c, ...q(a / 2, -b / 2 + k * b / 5, 0), ...q(a / 2, -b / 2 + k * b / 5, h), "rgba(20,35,60,.4)", 1.2); }
    poly(c, [q(-a / 2, b / 2, h), q(-.1, b / 2, h), q(-.4, b / 2, 40), q(-a / 2, b / 2, 40)], "rgba(255,255,255,.18)");
    faceRect(c, q, "L", a, b, -.15, .15, 0, 22, "#2a3a4a", "#16202a", 2);
    box(c, q, .15, -.1, .3, .3, h, 20, "#a9b4bc", "#7d8890", "#c9d6de");
    line(c, ...q(-.3, -.2, h), ...q(-.3, -.2, h + 50), "#5d5a63", 2); ell(c, ...q(-.3, -.2, h + 50), 3, 3, "#ff4a4a");
  }
  function antenne(c, x, y) {
    shadow(c, x, y + 4, 40, 12);
    const H = 230;
    for (let k = 0; k < 9; k++) { const t0 = k / 9, t1 = (k + 1) / 9, w0 = 34 - 30 * t0, w1 = 34 - 30 * t1; line(c, x - w0, y - H * t0, x + w1, y - H * t1, k % 2 ? "#e8e2d6" : "#c2453a", 2); line(c, x + w0, y - H * t0, x - w1, y - H * t1, k % 2 ? "#e8e2d6" : "#c2453a", 2); line(c, x - w1, y - H * t1, x + w1, y - H * t1, "#8a2a22", 1.5); }
    line(c, x - 34, y, x - 4, y - H, "#c2453a", 4); line(c, x + 34, y, x + 4, y - H, "#c2453a", 4);
    for (const [dz, s] of [[60, 1], [120, -1]]) { const yy = y - H + dz; poly(c, [[x + s * 6, yy], [x + s * 22, yy - 6], [x + s * 22, yy + 14], [x + s * 6, yy + 18]], "#d8dde2", "#4a4e5a", 1.5); }
    ell(c, x, y - H - 6, 14, 14, "rgba(255,80,80,.3)"); ell(c, x, y - H - 6, 6, 6, "#ff4a4a");
    for (let k = 1; k <= 3; k++) { c.strokeStyle = `rgba(80,200,255,${.9 - k * .2})`; c.lineWidth = 3; c.beginPath(); c.arc(x, y - H - 6, 14 + k * 12, -.9, -.2); c.stroke(); c.beginPath(); c.arc(x, y - H - 6, 14 + k * 12, Math.PI + .2, Math.PI + .9); c.stroke(); }
  }
  function minage(c, x, y) {
    const q = Q(x, y), a = 1.7, b = 1.1, h = 70;
    shadow(c, x, y + 8, 140, 42);
    box(c, q, 0, 0, a, b, 0, h, lin(c, x - 140, 0, x, 0, [[0, "#6c7480"], [1, "#4e5560"]]), "#3c424c", "#8a929e");
    for (let k = 0; k < 7; k++) { const u0 = -a / 2 + .08 + k * (a - .16) / 7; faceRect(c, q, "L", a, b, u0, u0 + (a - .16) / 7 - .03, 8, h - 10, "#262a32", "#14161a"); for (let z = 14; z < h - 12; z += 7) { const [lx, ly] = q(u0 + .05, b / 2, z); ell(c, lx, ly, 1.6, 1.6, rnd() < .7 ? "#3dff8a" : "#ffb52e"); } }
    for (let k = 0; k < 2; k++) { const uc = -.25 + k * .5; faceCircle(c, q, "R", a, b, uc, h / 2, .2, 22, "#2a2e36", "#14161a", 2); for (let p = 0; p < 5; p++) { const t = p / 5 * TAU; line(c, ...q(a / 2, uc, h / 2), ...q(a / 2, uc + Math.cos(t) * .17, h / 2 + Math.sin(t) * 18), "#8a929e", 3); } }
    for (let k = 0; k < 3; k++) { const [px, py] = q(-.5 + k * .5, 0, h); for (let w = 0; w < 3; w++) { c.beginPath(); c.moveTo(px - 6 + w * 6, py - 4); c.bezierCurveTo(px - 12 + w * 6, py - 14, px + w * 6, py - 22, px - 6 + w * 6, py - 34); c.strokeStyle = "rgba(255,150,80,.55)"; c.lineWidth = 2; c.stroke(); } }
    c.fillStyle = "#3dff8a"; c.font = "bold 13px monospace"; const [tx, ty] = q(-a / 2, b / 2, h + 6); c.fillText("NODE #4663", tx + 10, ty);
  }
  function cubeIso(c, x, y, s, top, left, right, edge) {
    poly(c, [[x, y - s], [x + s, y - s / 2], [x, y], [x - s, y - s / 2]], top, edge, 2);
    poly(c, [[x - s, y - s / 2], [x, y], [x, y + s], [x - s, y + s / 2]], left, edge, 2);
    poly(c, [[x, y], [x + s, y - s / 2], [x + s, y + s / 2], [x, y + s]], right, edge, 2);
  }
  function tourBlocs(c, x, y) {
    shadow(c, x, y + 4, 60, 18);
    ell(c, x, y - 120, 90, 140, rad(c, x, y - 120, 4, x, y - 120, 120, [[0, "rgba(80,220,255,.35)"], [1, "rgba(80,220,255,0)"]]));
    const blocks = [[0, -10], [6, -64], [-6, -118], [4, -172], [0, -226]];
    blocks.forEach(([dx, dy], k) => {
      const bx = x + dx, by = y + dy;
      cubeIso(c, bx, by, 30, "#4ad8ff", "#1f6f9e", "#164e70", "#0a2a40");
      c.fillStyle = "#dff8ff"; c.font = "bold 12px monospace"; c.textAlign = "center"; c.fillText("#" + (4659 + k), bx - 14, by + 14); c.textAlign = "left";
      if (k) { const [px, py] = [x + blocks[k - 1][0], y + blocks[k - 1][1]]; for (let l = 0; l < 2; l++) { ell(c, (px + bx) / 2 + 18, (py + by) / 2 - 4 + l * 10, 5, 7, null); c.strokeStyle = "#ffd23f"; c.lineWidth = 3; c.stroke(); } }
    });
  }
  function gratteCiel(c, x, y) {
    const q = Q(x, y), a = .9, b = .9, h = 320;
    shadow(c, x, y + 8, 80, 26);
    box(c, q, 0, 0, a, b, 0, h, lin(c, x - 60, y - h, x, y, [[0, "#3a3352"], [1, "#221d33"]]), "#17142a", "#4a4266");
    windows(c, q, "L", a, b, 4, 14, 20, h - 20, "#2c2744", .35); windows(c, q, "R", a, b, 4, 14, 20, h - 20, "#211d36", .3);
    for (const [p0, p1, col] of [[[-a / 2, b / 2, 0], [-a / 2, b / 2, h], "#ff4fd8"], [[a / 2, b / 2, 0], [a / 2, b / 2, h], "#4ae8ff"], [[a / 2, -b / 2, 0], [a / 2, -b / 2, h], "#ff4fd8"]]) { line(c, ...q(...p0), ...q(...p1), col, 3); line(c, ...q(...p0), ...q(...p1), "rgba(255,255,255,.6)", 1); }
    const [sx, sy] = q(-.05, b / 2, h - 30);
    c.save(); c.translate(sx - 28, sy - 6); c.transform(1, .5, 0, 1, 0, 0); c.fillStyle = "#16142a"; c.fillRect(0, -30, 56, 30); c.strokeStyle = "#ffd23f"; c.lineWidth = 2; c.strokeRect(0, -30, 56, 30); c.fillStyle = "#ffd23f"; c.font = "bold 16px sans-serif"; c.fillText("DIP", 12, -9); c.restore();
  }
  function forteresse(c, x, y) {
    const q = Q(x, y), a = 1.6, b = 1.3, h = 100;
    shadow(c, x, y + 10, 140, 44);
    box(c, q, 0, 0, a, b, 0, h, lin(c, x - 130, 0, x, 0, [[0, "#c9ced8"], [1, "#9aa2b0"]]), "#7a8292", "#dde2ea");
    for (let k = 0; k < 5; k++) { const i0 = -a / 2 + k * a / 5 + .04; box(c, q, i0 + .1, b / 2 - .08, .16, .16, h, 18, "#b4bac6", "#8a92a2", "#dde2ea"); }
    faceCircle(c, q, "L", a, b, 0, 48, .42, 38, lin(c, x - 40, 0, x + 40, 0, [[0, "#ffe27a"], [1, "#c99a20"]]), "#6a4a10", 4);
    faceCircle(c, q, "L", a, b, 0, 48, .3, 27, "#b88a1a", "#6a4a10", 2);
    for (let p = 0; p < 6; p++) { const t = p / 6 * TAU; line(c, ...q(Math.cos(t) * .07, b / 2, 48 + Math.sin(t) * 6), ...q(Math.cos(t) * .28, b / 2, 48 + Math.sin(t) * 25), "#6a4a10", 4); }
    faceCircle(c, q, "L", a, b, 0, 48, .07, 6, "#6a4a10");
    const [sx, sy] = q(a / 2, 0, 60); poly(c, [[sx - 18, sy - 26], [sx + 18, sy - 44], [sx + 18, sy - 10], [sx, sy + 12], [sx - 18, sy + 8]], "#4ad8ff", "#164e70", 2.5);
    c.fillStyle = "#0a2a40"; c.font = "bold 16px sans-serif"; c.textAlign = "center"; c.fillText("2/3", sx, sy - 8); c.textAlign = "left";
  }

  // ─── Ennemis des époques ───
  function golemFumee(c, x, y) {
    shadow(c, x, y, 30, 9);
    for (const [dx, dy, r, col] of [[-14, -14, 14, "#4a4a50"], [14, -14, 14, "#4a4a50"], [0, -40, 26, "#5d5d64"], [-24, -50, 12, "#6e6e76"], [24, -52, 12, "#6e6e76"], [0, -74, 18, "#76767e"]]) { ell(c, x + dx, y + dy, r + 2, r + 2, "#2a2a30"); ell(c, x + dx, y + dy, r, r, rad(c, x + dx - r * .3, y + dy - r * .3, 1, x + dx, y + dy, r, [[0, mix(col, .25)], [1, col]])); }
    for (const [dx, dy] of [[-8, -32], [10, -44], [-4, -50]]) { poly(c, [[x + dx - 4, y + dy], [x + dx, y + dy - 5], [x + dx + 5, y + dy], [x + dx + 1, y + dy + 4]], "#1a1a1e"); ell(c, x + dx, y + dy, 2, 1.5, "#ff7a2a"); }
    for (const s of [-1, 1]) { ell(c, x + s * 7, y - 76, 8, 6, "rgba(255,150,40,.35)"); ell(c, x + s * 7, y - 76, 4, 3, "#ffb52e"); }
    fumee(c, x + 4, y - 96, 3, "rgba(110,110,118,");
  }
  function verInfo(c, x, y) {
    shadow(c, x, y, 34, 9);
    const seg = [[-30, -8, 10], [-16, -14, 12], [0, -20, 14], [14, -30, 15], [22, -48, 17]];
    seg.forEach(([dx, dy, r], k) => { ell(c, x + dx, y + dy, r + 2, r + 2, "#0f3a1a"); ell(c, x + dx, y + dy, r, r, rad(c, x + dx - r * .3, y + dy - r * .3, 1, x + dx, y + dy, r, [[0, "#8affb0"], [1, "#1fa04a"]])); if (k < 4) { c.fillStyle = "#0f3a1a"; c.font = "bold 9px monospace"; c.fillText(k % 2 ? "1" : "0", x + dx - 3, y + dy + 3); } });
    eyes(c, x + 24, y - 52, 5, 6, 1);
    line(c, x + 18, y - 40, x + 32, y - 40, "#0f3a1a", 2);
    for (let k = 0; k < 6; k++) { c.fillStyle = ["#ff4fd8", "#4ae8ff", "#3dff8a"][k % 3]; c.fillRect(x + R(-40, 40), y + R(-70, -10), R(3, 7), R(3, 7)); }
  }
  function hydre(c, x, y) {
    shadow(c, x, y, 50, 14);
    for (const [hx, hy] of [[-46, -96], [0, -118], [46, -96]]) { c.beginPath(); c.moveTo(x + hx * .25, y - 60); c.quadraticCurveTo(x + hx * .9, y - 70, x + hx, y + hy + 14); c.strokeStyle = "#3a0808"; c.lineWidth = 12; c.stroke(); c.strokeStyle = "#b02a22"; c.lineWidth = 8; c.stroke(); }
    cubeIso(c, x, y - 34, 32, "#ff6b5e", "#b02a22", "#7e1a14", "#3a0808");
    c.fillStyle = "#fff"; c.font = "bold 16px sans-serif"; c.textAlign = "center"; c.fillText("51%", x - 16, y - 12); c.textAlign = "left";
    for (const [hx, hy] of [[-46, -96], [0, -118], [46, -96]]) {
      cubeIso(c, x + hx, y + hy, 16, "#ff8a7a", "#c5282b", "#8e1a1a", "#3a0808");
      ell(c, x + hx - 6, y + hy - 2, 3, 3, "#ffd23f"); ell(c, x + hx + 6, y + hy - 2, 3, 3, "#ffd23f");
    }
  }
  function hameconneur(c, x, y) {
    shadow(c, x, y, 30, 9);
    line(c, x + 10, y - 50, x + 20, y - 92, "#5f3a1c", 3); c.beginPath(); c.moveTo(x + 20, y - 92); c.quadraticCurveTo(x + 46, y - 96, x + 44, y - 60); c.strokeStyle = "#ddd"; c.lineWidth = 1.2; c.stroke();
    poly(c, [[x + 34, y - 60], [x + 54, y - 60], [x + 54, y - 42], [x + 34, y - 42]], "#ff4fd8", "#6a1a5a", 1.6); line(c, x + 44, y - 60, x + 44, y - 42, "#ffd23f", 3); line(c, x + 34, y - 51, x + 54, y - 51, "#ffd23f", 3);
    c.fillStyle = "#3a1a3a"; c.font = "bold 8px sans-serif"; c.textAlign = "center"; c.fillText("AIRDROP", x + 44, y - 64); c.textAlign = "left";
    poly(c, [[x - 28, y - 26], [x - 44, y - 40], [x - 44, y - 12]], "#2a2f5a", "#10132a", 2);
    ell(c, x - 2, y - 26, 28, 22, rad(c, x - 10, y - 34, 2, x, y - 26, 30, [[0, "#6a7ab8"], [1, "#2a2f5a"]])); c.strokeStyle = "#10132a"; c.lineWidth = 2.2; c.stroke();
    c.beginPath(); c.moveTo(x + 6, y - 16); c.lineTo(x + 26, y - 21); c.lineTo(x + 6, y - 26); c.closePath(); c.fillStyle = "#10132a"; c.fill();
    for (let k = 0; k < 4; k++) poly(c, [[x + 9 + k * 4, y - 23], [x + 11 + k * 4, y - 18], [x + 13 + k * 4, y - 23]], "#fff");
    ell(c, x + 6, y - 36, 6, 6, "#fff"); c.strokeStyle = "#10132a"; c.lineWidth = 1.6; c.stroke(); ell(c, x + 8, y - 36, 3, 3.3, "#10132a");
    c.beginPath(); c.moveTo(x - 6, y - 46); c.quadraticCurveTo(x - 2, y - 66, x + 10, y - 60); c.strokeStyle = "#10132a"; c.lineWidth = 2; c.stroke();
  }
  function siphon(c, x, y) {
    shadow(c, x, y, 26, 8);
    c.beginPath(); c.moveTo(x - 26, y - 6); c.quadraticCurveTo(x - 30, y - 70, x, y - 74); c.quadraticCurveTo(x + 30, y - 70, x + 26, y - 6);
    for (let k = 0; k < 4; k++) c.quadraticCurveTo(x + 19 - k * 13, y + 6, x + 13 - k * 13, y - 6);
    c.closePath(); c.fillStyle = rad(c, x - 8, y - 56, 2, x, y - 40, 44, [[0, "#d8b8ff"], [1, "#6a3ab5"]]); c.fill(); c.strokeStyle = "#2e1660"; c.lineWidth = 2.2; c.stroke();
    eyes(c, x, y - 50, 6, 9, 1);
    c.beginPath(); c.moveTo(x + 22, y - 34); c.bezierCurveTo(x + 50, y - 34, x + 40, y - 6, x + 62, y - 10); c.strokeStyle = "#2e1660"; c.lineWidth = 9; c.stroke(); c.strokeStyle = "#8a5ad8"; c.lineWidth = 6; c.stroke();
    poly(c, [[x + 58, y - 18], [x + 74, y - 22], [x + 74, y + 2], [x + 58, y - 2]], "#5d5a63", "#16141c", 1.6);
    for (let k = 0; k < 3; k++) { ell(c, x + 84 + k * 10, y - 10 + (k % 2) * 6, 5, 5, "#ffd23f"); c.strokeStyle = "#b8860b"; c.lineWidth = 1.2; c.stroke(); }
  }
  function ombre(c, x, y) {
    shadow(c, x, y, 24, 8);
    c.beginPath(); c.moveTo(x - 20, y); c.quadraticCurveTo(x - 26, y - 50, x - 14, y - 66); c.lineTo(x + 14, y - 66); c.quadraticCurveTo(x + 26, y - 50, x + 20, y); c.closePath();
    c.fillStyle = lin(c, x - 20, 0, x + 20, 0, [[0, "#3a3548"], [1, "#16131f"]]); c.fill(); c.strokeStyle = "#08070c"; c.lineWidth = 2; c.stroke();
    ell(c, x, y - 70, 18, 17, "#2a2636"); c.strokeStyle = "#08070c"; c.stroke();
    c.beginPath(); c.roundRect(x - 16, y - 76, 32, 9, 4); c.fillStyle = "#08070c"; c.fill();
    ell(c, x - 7, y - 72, 3, 2, "#ff4a4a"); ell(c, x + 7, y - 72, 3, 2, "#ff4a4a");
    poly(c, [[x + 20, y - 46], [x + 50, y - 50], [x + 52, y - 26], [x + 22, y - 22]], "#5d5a63", "#08070c", 1.5);
    c.fillStyle = "#fff"; c.font = "bold 9px sans-serif"; c.fillText("SAC", x + 26, y - 32);
  }

  // ─── Décor varié : campagne, forêt, village, ville, industrie, monde moderne ───
  // Sols supplémentaires
  Object.assign(GROUND, {
    ble(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#f0d070"], [1, "#c99a30"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let r = -5; r <= 5; r++) for (let k = -6; k <= 6; k++) { const px = x + k * 10 + r * 10, py = y + k * 5 - r * 5; if (Math.abs(px - x) / 64 + Math.abs(py - y) / 32 > .95) continue; line(c, px, py + 4, px + 1, py - 9, "#b5852a", 1.4); ell(c, px + 1, py - 10, 2, 3.5, "#ffe08a"); }
      c.restore();
    },
    potager(c, x, y) {
      diamond(c, x, y); c.fillStyle = "#8a5a32"; c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let r = -3; r <= 3; r++) { const ox = r * 18, oy = -r * 9; poly(c, [[x + ox - 64, y + oy], [x + ox - 58, y + oy - 4], [x + ox + 64, y + oy + 57], [x + ox + 58, y + oy + 61]].map(([a, b]) => [a, b - 30]), "#6e4424"); for (let k = -4; k <= 4; k++) { const px = x + ox + k * 14, py = y + oy + k * 7 - 2; leaf(c, px, py, -2.2, 9, 3, ["#3e8a2c", "#8fd65a"]); leaf(c, px, py, -.9, 9, 3, ["#3e8a2c", "#8fd65a"]); } }
      c.restore();
    },
    foret(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#6e8a3a"], [1, "#4a5e28"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip();
      const cols = ["#c26a2a", "#e0a030", "#8a4a20", "#a8b84a"];
      for (let k = 0; k < 26; k++) ell(c, x + R(-58, 58), y + R(-28, 28), R(3, 5), R(1.6, 2.6), cols[k % 4], R(0, 3));
      for (let k = 0; k < 4; k++) { const px = x + R(-40, 40), py = y + R(-15, 15); line(c, px, py, px + R(8, 16), py + R(-4, 4), "#5a3a1c", 1.6); }
      c.restore();
    },
    boue(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#8a6a44"], [1, "#5e4228"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let k = 0; k < 3; k++) { const px = x + R(-36, 36), py = y + R(-12, 12); ell(c, px, py, R(10, 18), R(4, 7), "#6a8aa0"); ell(c, px - 3, py - 1, 4, 1.4, "rgba(255,255,255,.6)"); }
      for (let k = 0; k < 6; k++) { const px = x + R(-50, 50), py = y + R(-20, 20); ell(c, px, py, 3, 2, "#4a3218"); ell(c, px + 6, py - 2, 3, 2, "#4a3218"); }
      c.restore();
    },
    paves(c, x, y) {
      diamond(c, x, y); c.fillStyle = "#6e6a64"; c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let r = -8; r <= 8; r++) for (let k = -8; k <= 8; k++) { const px = x + (k - r) * 8 + (r % 2) * 4, py = y + (k + r) * 4; ell(c, px, py, 6.4, 3.4, ["#b8b2a6", "#a8a296", "#c4beb2"][(r * 3 + k) & 1 ? 0 : (k & 1) + 1]); }
      c.restore();
    },
    asphalte(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#5a5a62"], [1, "#3e3e46"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip();
      for (let k = 0; k < 40; k++) ell(c, x + R(-60, 60), y + R(-30, 30), .9, .7, "rgba(255,255,255,.18)");
      for (let k = -3; k <= 2; k++) poly(c, [[x + k * 20, y + k * 10 - 1.5], [x + k * 20 + 12, y + k * 10 + 4.5], [x + k * 20 + 12, y + k * 10 + 7.5], [x + k * 20, y + k * 10 + 1.5]], "#ffd23f");
      poly(c, [[x - 64, y - 1], [x, y - 33], [x + 2, y - 30], [x - 60, y + 1]], "#d8d8d8"); poly(c, [[x, y + 33], [x + 64, y + 1], [x + 60, y - 1], [x - 2, y + 30]], "#d8d8d8");
      c.restore();
    },
    gravier(c, x, y) {
      diamond(c, x, y); c.fillStyle = "#a8a092"; c.fill();
      c.save(); diamond(c, x, y); c.clip(); for (let k = 0; k < 90; k++) ell(c, x + R(-62, 62), y + R(-31, 31), R(1.2, 2.6), R(.8, 1.6), ["#8a8274", "#c8c0b0", "#6e665a"][k % 3]); c.restore();
    },
    rails(c, x, y) {
      GROUND.gravier(c, x, y);
      const P = (a, b) => [x + (a - b) * 64, y + (a + b) * 32];
      c.save(); diamond(c, x, y); c.clip();
      for (let t = -.45; t <= .46; t += .15) poly(c, [P(t - .03, -.22), P(t + .03, -.22), P(t + .03, .22), P(t - .03, .22)], "#7a5232", "#3d2310", 1);
      for (const o of [-.13, .13]) { line(c, ...P(-.6, o), ...P(.6, o), "#3e3a44", 4.5); line(c, ...P(-.6, o - .01), ...P(.6, o - .01), "#d8dde2", 1.4); }
      c.restore();
    },
    neige(c, x, y) {
      diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#ffffff"], [1, "#cfe2f2"]]); c.fill();
      c.save(); diamond(c, x, y); c.clip(); for (let k = 0; k < 6; k++) ell(c, x + R(-40, 40), y + R(-16, 16), R(10, 20), R(4, 8), "rgba(150,190,230,.25)"); c.restore();
    },
  });

  // Bâtiment à deux pans (toit, murs, pignon, décor)
  function batisse(c, x, y, o) {
    const q = Q(x, y), { a, b, h, rh } = o, ov = o.ov ?? .12;
    shadow(c, x, y + 8, (a + b) * 48, (a + b) * 15);
    const R1 = q(-a / 2 - ov, 0, h + rh), R2 = q(a / 2 + ov, 0, h + rh), F1 = q(-a / 2 - ov, b / 2 + ov, h - 10), F2 = q(a / 2 + ov, b / 2 + ov, h - 10), B1 = q(-a / 2 - ov, -b / 2 - ov, h - 10), B2 = q(a / 2 + ov, -b / 2 - ov, h - 10);
    poly(c, [R1, R2, B2, B1], o.roofDark, "#2a1a0a", 2);
    box(c, q, 0, 0, a, b, 0, h, o.wallL, o.wallR, null);
    if (o.deco) o.deco(q);
    quad(c, q, [[a / 2, -b / 2, h], [a / 2, b / 2, h], [a / 2, 0, h + rh - 4]], o.gable || o.wallR, "rgba(40,25,10,.55)", 1.5);
    if (o.decoGable) o.decoGable(q);
    poly(c, [R1, R2, F2, F1], o.roof, "#2a1a0a", 2);
    for (let k = 1; k < 10; k++) { const t = k / 10; line(c, R1[0] + (F1[0] - R1[0]) * t, R1[1] + (F1[1] - R1[1]) * t, R2[0] + (F2[0] - R2[0]) * t, R2[1] + (F2[1] - R2[1]) * t, "rgba(0,0,0,.18)", 1.4); }
    poly(c, [R2, F2, [F2[0] + 4, F2[1] + 4], [R2[0] + 4, R2[1] + 4]], o.roofDark);
    if (o.top) o.top(q);
    return q;
  }
  const wheel = (c, x, y, r, col = "#6b4022") => { ell(c, x, y, r * .55, r, col); c.strokeStyle = "#2a1a0a"; c.lineWidth = 2; c.stroke(); for (let k = 0; k < 4; k++) { const t = k / 4 * Math.PI; line(c, x - Math.cos(t) * r * .5, y - Math.sin(t) * r * .95, x + Math.cos(t) * r * .5, y + Math.sin(t) * r * .95, "#2a1a0a", 1.4); } };

  // ── Campagne ──
  function grange(c, x, y) {
    batisse(c, x, y, { a: 1.4, b: 1.1, h: 62, rh: 52, wallL: lin(c, x - 100, 0, x, 0, [[0, "#d0473a"], [1, "#a8352a"]]), wallR: "#8a2a20", roof: "#5d5a63", roofDark: "#3e3a44",
      deco: (q) => { for (let k = 1; k < 7; k++) line(c, ...q(-.7 + k * .2, .55, 0), ...q(-.7 + k * .2, .55, 62), "rgba(60,10,5,.35)", 1.2); faceRect(c, q, "L", 1.4, 1.1, -.2, .2, 0, 30, "#6a1e16", "#fff", 2.5); line(c, ...q(-.2, .55, 0), ...q(.2, .55, 30), "#fff", 2); line(c, ...q(.2, .55, 0), ...q(-.2, .55, 30), "#fff", 2); },
      decoGable: (q) => { faceRect(c, q, "R", 1.4, 1.1, -.35, .35, 0, 50, "#6a1e16", "#fff", 3); line(c, ...q(.7, -.35, 0), ...q(.7, .35, 50), "#fff", 3); line(c, ...q(.7, .35, 0), ...q(.7, -.35, 50), "#fff", 3); faceRect(c, q, "R", 1.4, 1.1, -.12, .12, 72, 92, "#2a1a10", "#fff", 2); for (let k = 0; k < 5; k++) line(c, ...q(.7, -.1 + k * .05, 72), ...q(.7, -.1 + k * .05 + R(-.04, .04), 66), "#f0d070", 2); } });
  }
  function meuleFoin(c, x, y) { shadow(c, x, y + 2, 34, 11); cylindre(c, x, y, 30, 13, 34, lin(c, x - 30, 0, x + 30, 0, [[0, "#f6dc80"], [1, "#c9962e"]]), "#f3d27a", "#8a6418"); for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(x, y - 34, k * 8, k * 3.4, 0, 0, TAU); c.strokeStyle = "#b8862a"; c.lineWidth = 1.2; c.stroke(); } for (let k = 0; k < 10; k++) line(c, x + R(-28, 28), y - R(2, 30), x + R(-28, 28), y - R(2, 30), "rgba(150,100,20,.4)", 1); }
  function epouvantail(c, x, y) {
    shadow(c, x, y, 18, 6); line(c, x, y, x, y - 90, "#7a4b25", 4); line(c, x - 30, y - 62, x + 30, y - 62, "#7a4b25", 4);
    poly(c, [[x - 26, y - 66], [x + 26, y - 66], [x + 16, y - 28], [x - 16, y - 28]], "#4a7ab8", "#1d3a66", 2); for (const s of [-1, 1]) for (let k = 0; k < 3; k++) line(c, x + s * 28, y - 62, x + s * (32 + k * 3), y - 54 + k * 3, "#f0d070", 2);
    ell(c, x, y - 80, 14, 14, "#e8d0a0"); c.strokeStyle = "#7a5a30"; c.lineWidth = 2; c.stroke(); line(c, x - 6, y - 82, x - 2, y - 78, "#2a1a0a", 2); line(c, x - 2, y - 82, x - 6, y - 78, "#2a1a0a", 2); line(c, x + 3, y - 82, x + 7, y - 78, "#2a1a0a", 2); line(c, x + 7, y - 82, x + 3, y - 78, "#2a1a0a", 2);
    ell(c, x, y - 92, 22, 6, "#8a5530"); poly(c, [[x - 11, y - 92], [x - 8, y - 108], [x + 8, y - 108], [x + 11, y - 92]], "#9c6532", "#3d2310", 1.5);
  }
  function charrette(c, x, y) {
    const q = Q(x, y); shadow(c, x, y + 4, 50, 14);
    box(c, q, 0, 0, .7, .4, 18, 22, "#c98f52", "#9c6532", "#7a4b25", "#3d2310");
    for (let k = 0; k < 5; k++) ell(c, ...q(-.25 + k * .12, R(-.1, .1), 44), 9, 6, k % 2 ? "#e2453b" : "#ffb52e");
    wheel(c, ...q(.1, .22, 14), 16); line(c, ...q(.35, 0, 22), ...q(.8, .05, 10), "#7a4b25", 4); line(c, ...q(.35, .15, 22), ...q(.8, .2, 10), "#7a4b25", 4);
  }
  function vache(c, x, y) {
    shadow(c, x, y + 2, 40, 11);
    for (const dx of [-22, -12, 14, 24]) line(c, x + dx, y - 22, x + dx, y, "#3a3a3a", 5);
    ell(c, x, y - 34, 36, 18, "#fafafa"); c.strokeStyle = "#2a2a2a"; c.lineWidth = 2; c.stroke();
    c.save(); ell(c, x, y - 34, 36, 18); c.clip(); for (const [dx, dy, r] of [[-14, -40, 9], [10, -28, 8], [24, -42, 6]]) ell(c, x + dx, y + dy, r, r * .8, "#2a2a2a"); c.restore();
    ell(c, x + 40, y - 42, 13, 11, "#fafafa"); c.stroke(); ell(c, x + 48, y - 37, 9, 6, "#ffb0b8"); c.stroke(); ell(c, x + 37, y - 46, 2.5, 2.5, "#1a1a1a");
    poly(c, [[x + 32, y - 52], [x + 30, y - 60], [x + 36, y - 53]], "#f2e6c8", "#5a4a30", 1.2); poly(c, [[x + 44, y - 52], [x + 47, y - 60], [x + 48, y - 51]], "#f2e6c8", "#5a4a30", 1.2);
    line(c, x - 36, y - 36, x - 42, y - 20, "#2a2a2a", 2);
  }
  function poule(c, x, y) { shadow(c, x, y, 14, 4); line(c, x - 3, y, x - 3, y - 8, "#f2a530", 2); line(c, x + 3, y, x + 3, y - 8, "#f2a530", 2); ell(c, x, y - 16, 12, 10, "#fff"); c.strokeStyle = "#8a8070"; c.lineWidth = 1.6; c.stroke(); ell(c, x + 8, y - 26, 6, 6, "#fff"); c.stroke(); poly(c, [[x + 6, y - 32], [x + 8, y - 36], [x + 11, y - 32]], "#e0362f"); poly(c, [[x + 13, y - 26], [x + 18, y - 25], [x + 13, y - 23]], "#f2a530"); ell(c, x + 9, y - 27, 1.4, 1.4, "#1a1a1a"); }
  function ruche(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 26, 8); box(c, q, 0, 0, .28, .28, 0, 10, "#8a5530", "#6b4022", "#9c6532"); for (let k = 0; k < 3; k++) box(c, q, 0, 0, .26, .26, 10 + k * 16, 16, "#ffd86a", "#e0a830", "#f3c96a", "#7a5a10"); quad(c, q, [[-.17, -.17, 58], [.17, -.17, 58], [.17, .17, 58], [-.17, .17, 58]], "#c2453a", "#5c1a14", 1.5); for (let k = 0; k < 5; k++) { const bx = x + R(-30, 30), by = y - R(20, 70); ell(c, bx, by, 3, 2, "#ffd23f"); line(c, bx - 1, by, bx + 1, by, "#1a1a1a", 1); ell(c, bx, by - 2, 2, 1.4, "rgba(255,255,255,.8)"); } }
  function abreuvoir(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 40, 12); box(c, q, 0, 0, .7, .25, 0, 20, "#9c6532", "#7a4b25", "#6a8ac8", "#3d2310"); quad(c, q, [[-.32, -.09, 20], [.32, -.09, 20], [.32, .09, 20], [-.32, .09, 20]], lin(c, x - 30, 0, x + 30, 0, [[0, "#8fd0f0"], [1, "#3f8ac0"]])); }
  function tasBois(c, x, y) { shadow(c, x, y + 2, 34, 10); const rows = [[4, 0], [3, -12], [2, -24], [1, -36]]; for (const [n, dy] of rows) for (let k = 0; k < n; k++) { const lx = x - (n - 1) * 7 + k * 14, ly = y + dy - 6; line(c, lx - 14, ly - 7, lx, ly, "#8a5530", 11); ell(c, lx, ly, 6, 6, "#e8c891"); c.strokeStyle = "#7a4b25"; c.lineWidth = 1.5; c.stroke(); ell(c, lx, ly, 2.5, 2.5, null); c.strokeStyle = "#b88a55"; c.lineWidth = 1; c.stroke(); } }

  // ── Forêt ──
  function bouleau(c, x, y) {
    shadow(c, x, y, 30, 10);
    c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x - 4, y - 90); c.lineTo(x + 4, y - 90); c.lineTo(x + 7, y); c.closePath(); c.fillStyle = lin(c, x - 6, 0, x + 6, 0, [[0, "#ffffff"], [1, "#cfcac0"]]); c.fill(); c.strokeStyle = "#5a5550"; c.lineWidth = 1.6; c.stroke();
    for (let k = 0; k < 8; k++) { const yy = y - 8 - k * 11; line(c, x - 5, yy, x + R(-1, 3), yy + R(-1, 1), "#2a2620", 2); }
    foliage(c, x, y, [[0, -104, 20], [-18, -92, 15], [18, -94, 16], [0, -122, 15], [-10, -78, 12], [12, -80, 12]], 1, ["#4f8a2a", "#8ac84a", "#b6e46a", "#e8ffa0"]);
  }
  function souche(c, x, y) { shadow(c, x, y + 2, 26, 8); for (const [dx, a] of [[-18, 2.8], [18, .3], [-6, 2], [10, 1.2]]) leaf(c, x + dx * .3, y - 4, a, 20, 5, ["#7a4b25", "#5a3418"]); cylindre(c, x, y, 20, 9, 22, lin(c, x - 20, 0, x + 20, 0, [[0, "#a8774a"], [1, "#5a3418"]]), "#e8c891", "#3f2512"); for (let k = 1; k < 4; k++) { c.beginPath(); c.ellipse(x, y - 22, k * 5, k * 2.2, 0, 0, TAU); c.strokeStyle = "#b88a55"; c.lineWidth = 1; c.stroke(); } blob(c, x - 10, y - 8, 8, 4, 7, .3); c.fillStyle = "rgba(100,170,60,.9)"; c.fill(); }
  function troncCouche(c, x, y) {
    shadow(c, x, y + 4, 56, 12);
    poly(c, [[x - 50, y - 26], [x + 40, y + 18 - 26], [x + 40, y + 18], [x - 50, y]], lin(c, 0, y - 26, 0, y + 10, [[0, "#a8774a"], [1, "#5a3418"]]), "#3f2512", 2);
    for (let k = 0; k < 5; k++) line(c, x - 44 + k * 18, y - 18 + k * 9, x - 30 + k * 18, y - 14 + k * 9, "rgba(40,20,5,.35)", 1.2);
    ell(c, x + 40, y + 5, 9, 13, "#e8c891"); c.strokeStyle = "#3f2512"; c.lineWidth = 2; c.stroke(); ell(c, x + 40, y + 5, 4, 6, null); c.strokeStyle = "#b88a55"; c.lineWidth = 1; c.stroke();
    blob(c, x - 20, y - 22, 16, 5, 7, .3); c.fillStyle = "rgba(100,170,60,.9)"; c.fill();
    champignonsPetits(c, x - 30, y - 2);
  }
  function champignonsPetits(c, x, y) { for (const [dx, s] of [[0, 1], [7, .7]]) { line(c, x + dx, y, x + dx, y - 7 * s, "#f6ecd4", 2.4); c.beginPath(); c.ellipse(x + dx, y - 7 * s, 5 * s, 4 * s, 0, Math.PI, 0); c.fillStyle = "#e8a030"; c.fill(); } }
  function feuCamp(c, x, y) {
    ell(c, x, y - 20, 50, 40, rad(c, x, y - 20, 2, x, y - 20, 50, [[0, "rgba(255,170,60,.55)"], [1, "rgba(255,120,40,0)"]]));
    for (let k = 0; k < 8; k++) { const t = k / 8 * TAU; rockBlob(c, x + Math.cos(t) * 24, y + Math.sin(t) * 10, 7, 5, "#a8a297"); }
    line(c, x - 16, y + 2, x + 14, y - 8, "#6b4022", 7); line(c, x + 16, y + 2, x - 14, y - 8, "#5a3418", 7);
    for (const [s, col] of [[1, "#ff7a2a"], [.7, "#ffb52e"], [.4, "#fff4b0"]]) { c.beginPath(); c.moveTo(x - 14 * s, y - 4); c.quadraticCurveTo(x - 16 * s, y - 24 * s, x - 4 * s, y - 34 * s); c.quadraticCurveTo(x, y - 46 * s, x + 4 * s, y - 50 * s); c.quadraticCurveTo(x + 18 * s, y - 28 * s, x + 14 * s, y - 4); c.closePath(); c.fillStyle = col; c.fill(); }
    for (let k = 0; k < 4; k++) ell(c, x + R(-16, 16), y - R(50, 80), 1.6, 1.6, "#ffd23f");
  }
  function tente(c, x, y) {
    shadow(c, x, y + 4, 56, 16);
    const A = [x - 50, y - 6], B = [x + 10, y + 24], C = [x + 50, y + 4], D = [x - 10, y - 26], T1 = [x - 20, y - 64], T2 = [x + 20, y - 44];
    poly(c, [D, C, T2, T1], "#c95a3a", "#4a1a10", 2);
    poly(c, [A, B, T2, T1], lin(c, x - 50, 0, x + 10, 0, [[0, "#f0864e"], [1, "#d8663a"]]), "#4a1a10", 2);
    poly(c, [B, C, T2], "#b04a2e", "#4a1a10", 2); poly(c, [[x + 20, y + 16], [x + 36, y + 8], T2], "#3a1a10");
    line(c, ...T2, x + 20, y - 54, "#5a3418", 2.4); ell(c, x + 20, y - 56, 3, 3, "#ffd23f");
  }
  function champiMaison(c, x, y) {
    shadow(c, x, y + 4, 46, 14);
    cylindre(c, x, y, 26, 11, 60, lin(c, x - 26, 0, x + 26, 0, [[0, "#fff6e0"], [1, "#d8c8a0"]]), "#f6ecd4", "#7a5c3c");
    c.beginPath(); c.moveTo(x - 8, y + 9); c.lineTo(x - 8, y - 18); c.arc(x, y - 18, 8, Math.PI, 0); c.lineTo(x + 8, y + 9); c.closePath(); c.fillStyle = "#7b4a24"; c.fill(); c.strokeStyle = "#3d2310"; c.lineWidth = 1.6; c.stroke();
    ell(c, x + 15, y - 36, 5, 6, "#fff4b0"); c.strokeStyle = "#7a5c3c"; c.stroke();
    c.beginPath(); c.ellipse(x, y - 60, 52, 38, 0, Math.PI, 0); c.ellipse(x, y - 60, 52, 12, 0, 0, Math.PI); c.closePath(); c.fillStyle = rad(c, x - 16, y - 86, 2, x, y - 60, 56, [[0, "#ff7b6b"], [1, "#a8201f"]]); c.fill(); c.strokeStyle = "#5a0f0f"; c.lineWidth = 2.4; c.stroke();
    for (const [dx, dy, r] of [[-28, -70, 7], [0, -88, 8], [26, -72, 6], [-8, -66, 5], [14, -82, 4]]) ell(c, x + dx, y + dy, r, r * .7, "#fff");
    fumee(c, x + 20, y - 102, 2);
  }
  function terrier(c, x, y) { shadow(c, x, y + 2, 36, 10); blob(c, x, y - 8, 34, 16, 9, .15); c.fillStyle = lin(c, 0, y - 24, 0, y + 6, [[0, "#a87a4a"], [1, "#6e4a28"]]); c.fill(); c.strokeStyle = "#3f2512"; c.lineWidth = 2; c.stroke(); ell(c, x + 6, y - 6, 13, 9, "#1e1208"); for (let k = 0; k < 5; k++) leaf(c, x - 24 + k * 6, y - 18, -1.6 + R(-.4, .4), 14, 3, ["#3e8a2c", "#8fd65a"]); eyes(c, x + 6, y - 6, 2.6, 4, 0); }
  function buissonBaies(c, x, y) { shadow(c, x, y, 32, 10); foliage(c, x, y, [[-16, -16, 17], [16, -16, 17], [0, -28, 19]], 1, ["#1f4a1c", "#2f6e2a", "#4f9a3a", "#8fd65a"]); for (let k = 0; k < 12; k++) { const bx = x + R(-28, 28), by = y - R(8, 40); ell(c, bx, by, 3, 3, "#4a5ad8"); ell(c, bx - 1, by - 1, 1, 1, "#c8d0ff"); } }

  // ── Village ──
  function taverne(c, x, y) {
    batisse(c, x, y, { a: 1.5, b: 1.2, h: 72, rh: 48, wallL: lin(c, x - 100, 0, x, 0, [[0, "#f3e3c3"], [1, "#e0caa0"]]), wallR: "#c8ae80", roof: lin(c, x - 80, y - 140, x + 80, y - 60, [[0, "#c86a4a"], [1, "#94402a"]]), roofDark: "#6e2e1e",
      deco: (q) => { box(c, q, 0, 0, 1.5, 1.2, 0, 14, "#a59d90", "#857e72", null); for (const u of [-.55, -.1, .35]) faceRect(c, q, "L", 1.5, 1.2, u, u + .22, 30, 54, "#ffe8a0", "#5f3a1c", 3); faceRect(c, q, "L", 1.5, 1.2, .62, .74, 0, 0, null); faceRect(c, q, "R", 1.5, 1.2, -.15, .2, 2, 48, "#7b4a24", "#3d2310", 2);
        line(c, ...q(-.75, .6, 62), ...q(-.95, .6, 62), "#2a1a0a", 2.4); const [sx, sy] = q(-.92, .6, 56); poly(c, [[sx - 16, sy - 2], [sx + 8, sy + 10], [sx + 8, sy + 30], [sx - 16, sy + 18]], "#e8c891", "#5f3a1c", 2); c.fillStyle = "#c98f2a"; c.fillRect(sx - 9, sy + 6, 9, 12); c.fillStyle = "#fff"; c.fillRect(sx - 9, sy + 4, 9, 3); } });
  }
  function fontaine(c, x, y) {
    shadow(c, x, y + 4, 60, 18);
    cylindre(c, x, y, 52, 22, 20, lin(c, x - 52, 0, x + 52, 0, [[0, "#d8d2c6"], [1, "#9a9284"]]), "#c4beb2");
    ell(c, x, y - 20, 44, 18, lin(c, 0, y - 38, 0, y - 2, [[0, "#9fe0f6"], [1, "#3f8ac0"]]));
    cylindre(c, x, y - 20, 9, 4, 40, "#c4beb2", "#d8d2c6");
    cylindre(c, x, y - 58, 24, 9, 6, "#c4beb2", "#9fe0f6");
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x, y - 70); c.quadraticCurveTo(x + s * (14 + k * 8), y - 92 + k * 4, x + s * (22 + k * 10), y - 28 + k * 2); c.strokeStyle = `rgba(150,220,250,${.9 - k * .2})`; c.lineWidth = 2.4; c.stroke(); }
    for (let k = 0; k < 6; k++) ell(c, x + R(-36, 36), y - R(14, 26), 2, 1, "#fff");
  }
  function banc(c, x, y) { shadow(c, x, y + 2, 36, 10); for (const dx of [-24, 20]) line(c, x + dx, y - 2 + dx * .5, x + dx, y - 18 + dx * .5, "#3e3a44", 4); poly(c, [[x - 34, y - 26], [x + 30, y + 6], [x + 24, y + 9], [x - 40, y - 23]], "#b07a45", "#4a2a12", 1.6); poly(c, [[x - 34, y - 26], [x + 30, y + 6], [x + 30, y - 10], [x - 34, y - 42]], "#c48a50", "#4a2a12", 1.6); line(c, x - 34, y - 34, x + 30, y - 2, "#8a5530", 1.4); }
  function cordeLinge(c, x, y) { shadow(c, x, y, 50, 10); for (const dx of [-46, 46]) line(c, x + dx, y + dx * .3, x + dx, y + dx * .3 - 70, "#7a4b25", 4); c.beginPath(); c.moveTo(x - 46, y - 84); c.quadraticCurveTo(x, y - 62, x + 46, y - 56); c.strokeStyle = "#ddd"; c.lineWidth = 1.4; c.stroke(); const cols = ["#4a7ab8", "#ff8fb1", "#fff", "#ffd23f"]; for (let k = 0; k < 4; k++) { const px = x - 34 + k * 22, py = y - 77 + k * 5; poly(c, [[px - 8, py], [px + 8, py + 1], [px + 7, py + 20], [px - 7, py + 19]], cols[k], "rgba(0,0,0,.35)", 1.2); } }
  function potsFleurs(c, x, y) { shadow(c, x, y + 2, 30, 8); for (const [dx, dy, s, col] of [[-16, 0, 1, "#ff6f8f"], [10, -6, .8, "#ffd23f"], [18, 6, .7, "#b58cff"]]) { const px = x + dx, py = y + dy; poly(c, [[px - 10 * s, py - 20 * s], [px + 10 * s, py - 20 * s], [px + 7 * s, py], [px - 7 * s, py]], "#c86a3a", "#6e2e1e", 1.5); ell(c, px, py - 20 * s, 10 * s, 3 * s, "#5a3418"); foliage(c, px, py - 22 * s, [[0, -6, 7], [-6, -2, 5], [6, -2, 5]], s); for (let k = 0; k < 4; k++) ell(c, px + R(-8, 8) * s, py - R(26, 36) * s, 2.6 * s, 2.6 * s, col); } }
  function panneauAffiche(c, x, y) { shadow(c, x, y + 2, 34, 8); for (const dx of [-26, 26]) line(c, x + dx, y + dx * .3, x + dx, y + dx * .3 - 70, "#7a4b25", 4); poly(c, [[x - 32, y - 76], [x + 32, y - 58], [x + 32, y - 18], [x - 32, y - 36]], "#c98f52", "#3d2310", 2); const ps = [[-24, -64, "#fff"], [-4, -54, "#fff4b0"], [14, -50, "#ffd0e0"], [-20, -44, "#d0f0ff"]]; for (const [dx, dy, col] of ps) { poly(c, [[x + dx, y + dy], [x + dx + 14, y + dy + 4], [x + dx + 14, y + dy + 20], [x + dx, y + dy + 16]], col, "rgba(0,0,0,.3)", 1); ell(c, x + dx + 7, y + dy + 3, 1.6, 1.6, "#e0362f"); } poly(c, [[x - 36, y - 78], [x + 36, y - 58], [x + 36, y - 54], [x - 36, y - 74]], "#7a4b25"); }

  // ── Ville ──
  function boutique(c, x, y) {
    const q = Q(x, y), a = 1.2, b = 1, h = 96; shadow(c, x, y + 8, 100, 32);
    box(c, q, 0, 0, a, b, 0, h, lin(c, x - 90, 0, x, 0, [[0, "#f6d9c4"], [1, "#e6b898"]]), "#c99878", "#dccab8");
    faceRect(c, q, "L", a, b, -.5, .3, 6, 44, lin(c, x - 60, 0, x, 0, [[0, "#cfeaf8"], [1, "#8fc4e0"]]), "#2a3a4a", 2.5);
    for (const [u, col] of [[-.4, "#ff6f8f"], [-.2, "#ffd23f"], [0, "#6fd0ef"], [.15, "#8fd65a"]]) { const [px, py] = q(u, b / 2, 16); poly(c, [[px - 6, py], [px + 6, py + 3], [px + 6, py - 12], [px - 6, py - 15]], col, "rgba(0,0,0,.4)", 1); }
    faceRect(c, q, "L", a, b, .35, .55, 0, 46, "#5d3a2a", "#2a1a10", 2);
    for (let k = 0; k < 6; k++) { const u0 = -.6 + k * .2; quad(c, q, [[u0, b / 2, 58], [u0 + .2, b / 2, 58], [u0 + .2, b / 2 + .25, 46], [u0, b / 2 + .25, 46]], k % 2 ? "#fff" : "#3aa86a", "rgba(0,0,0,.35)", 1); }
    windows(c, q, "L", a, b, 3, 1, 64, h - 6, "#9fc4dc", 0); windows(c, q, "R", a, b, 2, 2, 10, h - 6, "#86aec8", 0);
    const [sx, sy] = q(-.2, b / 2, 70); c.save(); c.translate(sx, sy); c.transform(1, .5, 0, 1, 0, 0); c.fillStyle = "#3aa86a"; c.fillRect(-30, -12, 60, 16); c.fillStyle = "#fff"; c.font = "bold 11px sans-serif"; c.textAlign = "center"; c.fillText("ÉPICERIE", 0, 0); c.restore();
  }
  function feuCirculation(c, x, y) { shadow(c, x, y, 12, 4); line(c, x, y, x, y - 70, "#3e3a44", 4); c.beginPath(); c.roundRect(x - 9, y - 106, 18, 40, 5); c.fillStyle = "#1d1a20"; c.fill(); for (const [k, col] of [[0, "#ff4a4a"], [1, "#4a3a20"], [2, "#2a4a2a"]]) ell(c, x, y - 98 + k * 12, 4.6, 4.6, col); ell(c, x, y - 98, 9, 9, "rgba(255,80,80,.3)"); }
  function borneIncendie(c, x, y) { shadow(c, x, y + 1, 14, 5); cylindre(c, x, y, 9, 4, 26, lin(c, x - 9, 0, x + 9, 0, [[0, "#ff6b5e"], [1, "#a8201f"]]), "#e0362f", "#5a0f0f"); c.beginPath(); c.ellipse(x, y - 26, 9, 4, 0, Math.PI, 0); c.lineTo(x + 5, y - 34); c.lineTo(x - 5, y - 34); c.closePath(); c.fillStyle = "#e0362f"; c.fill(); c.strokeStyle = "#5a0f0f"; c.lineWidth = 1.6; c.stroke(); for (const s of [-1, 1]) { ell(c, x + s * 11, y - 16, 4, 4, "#c5282b"); c.stroke(); } }
  function poubelle(c, x, y) { const q = Q(x, y); shadow(c, x, y + 1, 18, 6); box(c, q, 0, 0, .2, .2, 0, 30, "#3aa86a", "#2a7a4a", null, "#123a22"); quad(c, q, [[-.12, -.12, 30], [.12, -.12, 30], [.12, .12, 30], [-.12, .12, 30]], "#2f8a56", "#123a22", 1.5); c.fillStyle = "#fff"; c.font = "bold 12px sans-serif"; const [tx, ty] = q(0, .1, 14); c.fillText("♻", tx - 10, ty + 2); }
  function lampadaire(c, x, y) { shadow(c, x, y, 12, 4); ell(c, x + 20, y - 100, 40, 30, rad(c, x + 20, y - 100, 2, x + 20, y - 100, 40, [[0, "rgba(255,240,180,.5)"], [1, "rgba(255,240,180,0)"]])); line(c, x, y, x, y - 108, "#5d5a63", 4); c.beginPath(); c.moveTo(x, y - 108); c.quadraticCurveTo(x, y - 118, x + 18, y - 116); c.strokeStyle = "#5d5a63"; c.lineWidth = 4; c.stroke(); poly(c, [[x + 10, y - 118], [x + 30, y - 114], [x + 26, y - 108], [x + 12, y - 110]], "#3e3a44"); ell(c, x + 20, y - 108, 7, 2.4, "#fff8d0"); }
  function abribus(c, x, y) {
    const q = Q(x, y); shadow(c, x, y + 4, 60, 16);
    for (const [i, j] of [[-.4, -.15], [.4, -.15]]) line(c, ...q(i, j, 0), ...q(i, j, 70), "#5d5a63", 3);
    quad(c, q, [[-.4, -.15, 6], [.4, -.15, 6], [.4, -.15, 66], [-.4, -.15, 66]], "rgba(170,220,240,.45)", "#5d5a63", 2);
    quad(c, q, [[.4, -.15, 6], [.4, .1, 6], [.4, .1, 66], [.4, -.15, 66]], "rgba(150,200,230,.5)", "#5d5a63", 2);
    box(c, q, 0, -.06, .6, .1, 16, 6, "#b07a45", "#8a5530", "#c48a50");
    box(c, q, 0, 0, .9, .4, 70, 6, "#3e3a44", "#2a2830", "#5d5a63");
    const [sx, sy] = q(-.55, .15, 0); line(c, sx, sy, sx, sy - 80, "#5d5a63", 3); ell(c, sx, sy - 86, 10, 10, "#3a7ad8"); c.fillStyle = "#fff"; c.font = "bold 8px sans-serif"; c.textAlign = "center"; c.fillText("BUS", sx, sy - 83); c.textAlign = "left";
  }
  function voiture(c, x, y, col = "#e0362f") {
    const q = Q(x, y); shadow(c, x, y + 4, 52, 16);
    box(c, q, 0, 0, .8, .4, 8, 20, lin(c, x - 50, 0, x, 0, [[0, mix(col, .15)], [1, col]]), mix(col, -.3), mix(col, .1), "#2a1010");
    box(c, q, -.05, 0, .45, .36, 28, 18, "#8fc4e0", "#6aa6cf", mix(col, .1), "#2a1010");
    line(c, ...q(.1, .18, 28), ...q(.1, .18, 46), mix(col, -.2), 3);
    for (const [i, j] of [[-.25, .2], [.25, .2], [.25, -.2]]) { const [wx, wy] = q(i, j, 6); ell(c, wx, wy, 8, 9, "#1d1a20"); ell(c, wx, wy, 3.4, 4, "#9aa2b0"); }
    ell(c, ...q(.4, .12, 18), 3, 3, "#fff8d0"); ell(c, ...q(.4, -.12, 18), 3, 3, "#fff8d0");
  }
  function cabineTel(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 24, 8); box(c, q, 0, 0, .26, .26, 0, 90, "#3a7ad8", "#2a5aa8", "#4a8ae8", "#0f2a55"); faceRect(c, q, "L", .26, .26, -.09, .09, 10, 70, "rgba(200,235,255,.75)", "#0f2a55", 2); const [px, py] = q(0, .13, 40); poly(c, [[px - 5, py - 6], [px + 5, py - 2], [px + 5, py + 10], [px - 5, py + 6]], "#1d1a20"); const [sx, sy] = q(0, .13, 80); c.save(); c.translate(sx, sy); c.transform(1, .5, 0, 1, 0, 0); c.fillStyle = "#fff"; c.font = "bold 9px sans-serif"; c.textAlign = "center"; c.fillText("TÉL", 0, 3); c.restore(); }
  function distributeur(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 26, 8); box(c, q, 0, 0, .34, .26, 0, 66, lin(c, x - 30, 0, x, 0, [[0, "#ff5a5a"], [1, "#c5282b"]]), "#8e1a1a", "#ff8a7a", "#3a0808"); faceRect(c, q, "L", .34, .26, -.14, .05, 22, 60, "rgba(200,235,255,.8)", "#3a0808", 1.6); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { const [bx, by] = q(-.12 + k * .06, .13, 26 + r * 12); poly(c, [[bx - 2, by], [bx + 2, by + 1], [bx + 2, by - 8], [bx - 2, by - 9]], ["#3aa86a", "#ffd23f", "#4a8ae8"][(r + k) % 3]); } for (let k = 0; k < 3; k++) ell(c, ...q(.11, .13, 50 - k * 8), 2.4, 2.4, "#fff"); faceRect(c, q, "L", .34, .26, -.14, .1, 6, 14, "#1d1a20"); }
  function arbreBac(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 30, 9); box(c, q, 0, 0, .34, .34, 0, 20, "#9aa2b0", "#7a8292", "#5a3418", "#3e3a44"); trunk(c, x, y - 20, 30, 4, 1); foliage(c, x, y - 20, [[0, -46, 18], [-14, -38, 13], [14, -40, 13], [0, -60, 13]]); }

  // ── Zone industrielle ──
  function wagonnet(c, x, y) { const q = Q(x, y); shadow(c, x, y + 4, 40, 12); quad(c, q, [[-.3, .18, 10], [.3, .18, 10], [.35, .22, 40], [-.35, .22, 40]], "#7a8292", "#2a2830", 2); quad(c, q, [[.3, -.18, 10], [.3, .18, 10], [.35, .22, 40], [.35, -.22, 40]], "#5d6470", "#2a2830", 2); for (let k = 0; k < 9; k++) ell(c, ...q(R(-.28, .28), R(-.16, .16), 42 + R(0, 8)), R(5, 9), R(4, 6), k % 2 ? "#2a2830" : "#1a1a20"); for (const i of [-.2, .2]) { const [wx, wy] = q(i, .2, 6); ell(c, wx, wy, 6, 7, "#3e3a44"); ell(c, wx, wy, 2, 2.4, "#9aa2b0"); } }
  function tasCharbon(c, x, y) { shadow(c, x, y + 2, 46, 12); blob(c, x, y - 16, 44, 20, 10, .2); c.fillStyle = lin(c, 0, y - 36, 0, y + 4, [[0, "#4a4a52"], [1, "#16161c"]]); c.fill(); for (let k = 0; k < 24; k++) { const px = x + R(-36, 36), py = y - R(2, 30); ell(c, px, py, R(3, 6), R(2, 4), k % 3 ? "#2a2a30" : "#5a5a64"); } line(c, x + 28, y - 4, x + 40, y - 44, "#7a4b25", 3); poly(c, [[x + 36, y - 46], [x + 50, y - 42], [x + 46, y - 30], [x + 34, y - 34]], "#9aa2b0", "#2a2830", 1.4); }
  function tuyaux(c, x, y) { shadow(c, x, y + 2, 50, 12); const pipe = (pts, w) => { c.beginPath(); c.moveTo(...pts[0]); for (const p of pts.slice(1)) c.lineTo(...p); c.strokeStyle = "#2a2830"; c.lineWidth = w + 4; c.lineJoin = "round"; c.stroke(); c.strokeStyle = "#8a929e"; c.lineWidth = w; c.stroke(); c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = w * .25; c.stroke(); }; pipe([[x - 50, y - 10], [x - 10, y + 10], [x - 10, y - 50], [x + 40, y - 25]], 12); pipe([[x - 40, y - 30], [x, y - 10]], 8); for (const [px, py] of [[x - 10, y + 10], [x - 10, y - 50]]) ell(c, px, py, 10, 10, "#6e7682"); ell(c, x + 18, y - 52, 13, 13, null); c.strokeStyle = "#c5282b"; c.lineWidth = 3.5; c.stroke(); line(c, x + 5, y - 52, x + 31, y - 52, "#c5282b", 2.4); line(c, x + 18, y - 65, x + 18, y - 39, "#c5282b", 2.4); line(c, x + 18, y - 39, x + 18, y - 34, "#2a2830", 3); }
  function conteneur(c, x, y) { const q = Q(x, y), a = 1.2, b = .45, h = 52; shadow(c, x, y + 4, 80, 22); box(c, q, 0, 0, a, b, 0, h, lin(c, x - 80, 0, x, 0, [[0, "#ff9a4a"], [1, "#e0702a"]]), "#b8561e", "#ffae6a", "#4a1e08"); for (let k = 1; k < 16; k++) line(c, ...q(-a / 2 + k * a / 16, b / 2, 2), ...q(-a / 2 + k * a / 16, b / 2, h - 2), "rgba(80,30,5,.35)", 1.4); for (let k = 1; k < 6; k++) line(c, ...q(a / 2, -b / 2 + k * b / 6, 2), ...q(a / 2, -b / 2 + k * b / 6, h - 2), "rgba(60,20,5,.4)", 1.4); const [tx, ty] = q(-.2, b / 2, 30); c.save(); c.translate(tx, ty); c.transform(1, .5, 0, 1, 0, 0); c.fillStyle = "#fff"; c.font = "bold 13px sans-serif"; c.fillText("POND LINE", -30, 0); c.restore(); }
  function grue(c, x, y) {
    shadow(c, x, y, 30, 9); const H = 200;
    for (let k = 0; k < 10; k++) { const y0 = y - k * 20, y1 = y0 - 20; line(c, x - 10, y0, x + 10, y1, "#e0a830", 2); line(c, x + 10, y0, x - 10, y1, "#e0a830", 2); }
    line(c, x - 10, y, x - 10, y - H, "#c98f1a", 4); line(c, x + 10, y, x + 10, y - H, "#c98f1a", 4);
    line(c, x - 40, y - H, x + 110, y - H, "#c98f1a", 6); line(c, x - 40, y - H - 14, x + 110, y - H, "#e0a830", 2); line(c, x, y - H - 30, x - 40, y - H, "#e0a830", 2); line(c, x, y - H - 30, x + 110, y - H, "#e0a830", 2); line(c, x, y - H, x, y - H - 30, "#c98f1a", 4);
    poly(c, [[x - 46, y - H - 4], [x - 26, y - H - 4], [x - 26, y - H + 14], [x - 46, y - H + 14]], "#7a8292", "#2a2830", 1.6);
    poly(c, [[x - 12, y - H + 4], [x + 14, y - H + 4], [x + 14, y - H + 24], [x - 12, y - H + 24]], "#ffd23f", "#2a2830", 1.6);
    line(c, x + 80, y - H, x + 80, y - 90, "#2a2830", 1.4); c.beginPath(); c.arc(x + 80, y - 84, 6, -1.6, Math.PI * .9); c.strokeStyle = "#5d5a63"; c.lineWidth = 3; c.stroke();
  }
  function baril(c, x, y) { shadow(c, x, y + 2, 18, 6); cylindre(c, x, y, 15, 6, 38, lin(c, x - 15, 0, x + 15, 0, [[0, "#4a8ae8"], [1, "#1d4a9a"]]), "#3a7ad8", "#0f2a55"); for (const z of [10, 26]) { c.beginPath(); c.ellipse(x, y - z, 15, 6, 0, 0, Math.PI); c.strokeStyle = "#0f2a55"; c.lineWidth = 2.4; c.stroke(); } ell(c, x + 5, y - 38, 3, 1.4, "#0f2a55"); }
  function paletteCaisses(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 44, 13); box(c, q, 0, 0, .6, .6, 0, 6, "#c98f52", "#9c6532", "#d9a66a", "#3d2310"); box(c, q, -.12, -.12, .3, .3, 6, 28, "#d9a66a", "#b07a45", "#e8bd85", "#4a2a12"); box(c, q, .14, .1, .26, .26, 6, 22, "#d9a66a", "#b07a45", "#e8bd85", "#4a2a12"); box(c, q, -.1, -.1, .24, .24, 34, 20, "#c4beb2", "#9a9284", "#d8d2c6", "#3e3a44"); }
  function engrenage(c, x, y) { shadow(c, x, y + 2, 34, 9); const cx = x, cy = y - 42, r = 36, n = 12; c.beginPath(); for (let k = 0; k < n * 2; k++) { const t = k / (n * 2) * TAU, rr = k % 2 ? r : r + 8, t2 = (k + 1) / (n * 2) * TAU; c.lineTo(cx + Math.cos(t) * rr * .6, cy + Math.sin(t) * rr); c.lineTo(cx + Math.cos(t2) * rr * .6, cy + Math.sin(t2) * rr); } c.closePath(); c.fillStyle = lin(c, cx - 20, 0, cx + 20, 0, [[0, "#b8bec8"], [1, "#6e7682"]]); c.fill(); c.strokeStyle = "#2a2830"; c.lineWidth = 2; c.stroke(); ell(c, cx, cy, 8, 13, "#2a2830"); for (let k = 0; k < 4; k++) { const t = k / 4 * TAU + .4; ell(c, cx + Math.cos(t) * 13, cy + Math.sin(t) * 22, 4, 6, "#4a4e5a"); } }
  function locomotive(c, x, y) {
    const q = Q(x, y); shadow(c, x, y + 6, 80, 22);
    box(c, q, 0, 0, 1.1, .4, 6, 10, "#3e3a44", "#2a2830", "#5d5a63");
    const bl = q(-.5, 0, 34), br = q(.25, 0, 34); c.beginPath(); c.moveTo(bl[0], bl[1] - 20); c.lineTo(br[0], br[1] - 20); c.lineTo(br[0], br[1] + 20); c.lineTo(bl[0], bl[1] + 20); c.closePath(); c.fillStyle = lin(c, 0, bl[1] - 20, 0, bl[1] + 20, [[0, "#3aa86a"], [1, "#1f6a3e"]]); c.fill(); c.strokeStyle = "#0f2a18"; c.lineWidth = 2; c.stroke();
    ell(c, br[0], br[1], 10, 20, "#2a7a4a"); c.stroke(); ell(c, br[0] + 2, br[1], 4, 6, "#ffd23f");
    for (let k = 1; k < 4; k++) { const p = q(-.5 + k * .19, 0, 34); line(c, p[0], p[1] - 20, p[0], p[1] + 20, "#ffd23f", 2); }
    box(c, q, -.4, 0, .35, .44, 16, 54, "#c5282b", "#8e1a1a", "#3e3a44", "#3a0808"); faceRect(c, q, "L", .35, .44, -.07, .07, 0, 0, null); { const p = q(-.4, .22, 50); poly(c, [[p[0] - 10, p[1] - 6], [p[0] + 8, p[1] + 3], [p[0] + 8, p[1] - 12], [p[0] - 10, p[1] - 21]], "#fff4b0", "#3a0808", 1.6); }
    const st = q(.05, 0, 54); cylindre(c, st[0], st[1] + 4, 7, 3, 22, "#2a2830", "#1a1a20"); fumee(c, st[0], st[1] - 26, 4);
    for (const i of [-.35, -.05, .2]) { const [wx, wy] = q(i, .22, 10); ell(c, wx, wy, 9, 11, "#c5282b"); c.strokeStyle = "#3a0808"; c.lineWidth = 2; c.stroke(); ell(c, wx, wy, 3, 4, "#3a0808"); }
  }

  // ── Monde moderne (époques 3 à 5) ──
  function panneauSolaire(c, x, y) { shadow(c, x, y + 2, 40, 10); line(c, x - 4, y, x - 4, y - 30, "#5d5a63", 4); const P = [[x - 46, y - 40], [x + 14, y - 10], [x + 40, y - 40], [x - 20, y - 70]]; poly(c, P, lin(c, x - 46, y - 70, x + 40, y - 10, [[0, "#3a5ab8"], [1, "#1a2a6a"]]), "#c9ced8", 2.4); for (let k = 1; k < 4; k++) { const t = k / 4; line(c, P[0][0] + (P[3][0] - P[0][0]) * t, P[0][1] + (P[3][1] - P[0][1]) * t, P[1][0] + (P[2][0] - P[1][0]) * t, P[1][1] + (P[2][1] - P[1][1]) * t, "#8aa0d8", 1.2); } for (let k = 1; k < 6; k++) { const t = k / 6; line(c, P[0][0] + (P[1][0] - P[0][0]) * t, P[0][1] + (P[1][1] - P[0][1]) * t, P[3][0] + (P[2][0] - P[3][0]) * t, P[3][1] + (P[2][1] - P[3][1]) * t, "#8aa0d8", 1.2); } line(c, x - 30, y - 60, x - 10, y - 54, "rgba(255,255,255,.6)", 3); }
  function borneRecharge(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 20, 6); box(c, q, 0, 0, .2, .16, 0, 70, "#f4f6f8", "#c9ced8", "#dde2ea", "#3e3a44"); faceRect(c, q, "L", .2, .16, -.07, .07, 40, 60, "#1a2a3a", "#3e3a44"); ell(c, ...q(0, .08, 50), 4, 3, "#3dff8a"); c.beginPath(); c.moveTo(...q(.1, .08, 30)); c.bezierCurveTo(x + 30, y - 10, x + 20, y + 10, x + 40, y + 4); c.strokeStyle = "#1d1a20"; c.lineWidth = 3.4; c.stroke(); poly(c, [[x + 36, y], [x + 46, y + 2], [x + 44, y + 10], [x + 36, y + 8]], "#3e3a44"); c.fillStyle = "#3dff8a"; c.font = "bold 14px sans-serif"; const [tx, ty] = q(0, .08, 30); c.fillText("⚡", tx - 6, ty); }
  function atmCrypto(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 26, 8); box(c, q, 0, 0, .3, .26, 0, 80, lin(c, x - 30, 0, x, 0, [[0, "#ffd23f"], [1, "#e0a830"]]), "#b8860b", "#ffe27a", "#4a3a08"); faceRect(c, q, "L", .3, .26, -.11, .11, 46, 70, lin(c, x - 20, 0, x + 20, 0, [[0, "#4ad8ff"], [1, "#1f6f9e"]]), "#1d1a20", 2); faceRect(c, q, "L", .3, .26, -.09, .09, 24, 38, "#3e3a44", "#1d1a20"); for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) ell(c, ...q(-.06 + k * .06, .13, 28 + r * 4), 1.6, 1.2, "#c9ced8"); faceRect(c, q, "L", .3, .26, -.08, .08, 14, 18, "#1d1a20"); const [tx, ty] = q(0, .13, 76); c.save(); c.translate(tx, ty); c.transform(1, .5, 0, 1, 0, 0); c.fillStyle = "#4a3a08"; c.font = "bold 7px sans-serif"; c.textAlign = "center"; c.fillText("CRYPTO ATM", 0, 2); c.restore(); }
  function rackServeurs(c, x, y) { const q = Q(x, y); shadow(c, x, y + 2, 30, 9); box(c, q, 0, 0, .36, .3, 0, 100, "#262a32", "#1a1d24", "#3c424c", "#0a0c10"); for (let k = 0; k < 9; k++) { faceRect(c, q, "L", .36, .3, -.15, .15, 6 + k * 10.5, 14 + k * 10.5, "#3c424c", "#0a0c10", 1); for (let l = 0; l < 3; l++) ell(c, ...q(-.12 + l * .04, .15, 10 + k * 10.5), 1.4, 1.4, rnd() < .75 ? "#3dff8a" : "#ff4a4a"); } }
  function drone(c, x, y) { ell(c, x, y, 22, 6, "rgba(25,45,10,.22)"); const yy = y - 80; for (const [dx, dy] of [[-26, -6], [26, -6], [-20, 8], [20, 8]]) { line(c, x, yy, x + dx, yy + dy, "#3e3a44", 3); ell(c, x + dx, yy + dy - 3, 14, 3.4, "rgba(200,210,220,.55)"); c.strokeStyle = "#3e3a44"; c.lineWidth = 1; c.stroke(); } c.beginPath(); c.roundRect(x - 12, yy - 6, 24, 12, 5); c.fillStyle = "#f4f6f8"; c.fill(); c.strokeStyle = "#3e3a44"; c.lineWidth = 2; c.stroke(); ell(c, x, yy + 9, 4, 4, "#1d1a20"); ell(c, x + 8, yy - 2, 2, 2, "#ff4a4a"); }
  function ecranPub(c, x, y) { shadow(c, x, y, 30, 8); line(c, x - 14, y, x - 14, y - 70, "#5d5a63", 5); line(c, x + 14, y + 4, x + 14, y - 66, "#5d5a63", 5); const P = [[x - 50, y - 130], [x + 50, y - 100], [x + 50, y - 50], [x - 50, y - 80]]; poly(c, P, "#1d1a20", "#3e3a44", 4); poly(c, [[x - 44, y - 124], [x + 44, y - 98], [x + 44, y - 56], [x - 44, y - 82]], lin(c, x - 44, y - 124, x + 44, y - 56, [[0, "#ff4fd8"], [1, "#4a8ae8"]])); c.save(); c.translate(x, y - 88); c.transform(1, .3, 0, 1, 0, 0); c.fillStyle = "#fff"; c.font = "bold 15px sans-serif"; c.textAlign = "center"; c.fillText("STAY CALM", 0, -4); c.font = "bold 9px sans-serif"; c.fillText("never share your seed", 0, 10); c.restore(); }
  function trottinette(c, x, y) { shadow(c, x, y + 2, 26, 6); line(c, x - 22, y - 8, x + 18, y + 4, "#3e3a44", 5); line(c, x + 18, y + 4, x + 12, y - 46, "#3e3a44", 4); line(c, x + 4, y - 48, x + 20, y - 44, "#1d1a20", 4); for (const [dx, dy] of [[-24, -6], [20, 6]]) { ell(c, x + dx, y + dy, 6, 7, "#1d1a20"); ell(c, x + dx, y + dy, 2, 2.4, "#9aa2b0"); } line(c, x - 18, y - 10, x + 12, y, "#3dff8a", 2); }
  function camera(c, x, y) { shadow(c, x, y, 10, 4); line(c, x, y, x, y - 80, "#5d5a63", 4); line(c, x, y - 78, x + 12, y - 82, "#5d5a63", 3); c.save(); c.translate(x + 20, y - 80); c.rotate(.35); c.beginPath(); c.roundRect(-12, -7, 26, 14, 4); c.fillStyle = "#f4f6f8"; c.fill(); c.strokeStyle = "#3e3a44"; c.lineWidth = 2; c.stroke(); ell(c, 14, 0, 4, 5, "#1d1a20"); ell(c, -6, -3, 1.6, 1.6, "#ff4a4a"); c.restore(); c.beginPath(); c.moveTo(x + 34, y - 74); c.lineTo(x + 70, y - 30); c.lineTo(x + 40, y - 24); c.closePath(); c.fillStyle = "rgba(255,80,80,.12)"; c.fill(); }
  function casierColis(c, x, y) { const q = Q(x, y), a = .7, b = .3; shadow(c, x, y + 4, 44, 13); box(c, q, 0, 0, a, b, 0, 80, "#e0a830", "#b8860b", "#ffd23f", "#4a3a08"); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { faceRect(c, q, "L", a, b, -a / 2 + .04 + k * (a - .08) / 4, -a / 2 + .04 + (k + 1) * (a - .08) / 4 - .02, 4 + r * 19, 4 + (r + 1) * 19 - 3, "#f3c96a", "#7a5a10", 1.2); ell(c, ...q(-a / 2 + .04 + (k + 1) * (a - .08) / 4 - .05, b / 2, 12 + r * 19), 1.4, 1.4, "#4a3a08"); } }

  // ─── Animaux ───
  function pattes(c, x, y, xs, h, col, w = 4) { for (const dx of xs) line(c, x + dx, y - h, x + dx, y, col, w); }
  function mouton(c, x, y) {
    shadow(c, x, y + 2, 30, 9); pattes(c, x, y, [-14, -6, 8, 16], 16, "#2a2a2a");
    for (const [dx, dy, r] of [[-14, -24, 12], [0, -28, 14], [14, -24, 12], [-6, -36, 11], [8, -36, 11], [-18, -32, 9], [18, -32, 9]]) { ell(c, x + dx, y + dy, r + 2, r + 2, "#8a8478"); }
    for (const [dx, dy, r] of [[-14, -24, 12], [0, -28, 14], [14, -24, 12], [-6, -36, 11], [8, -36, 11], [-18, -32, 9], [18, -32, 9]]) ell(c, x + dx, y + dy, r, r, rad(c, x + dx - 4, y + dy - 4, 1, x + dx, y + dy, r, [[0, "#ffffff"], [1, "#e4ded0"]]));
    ell(c, x + 26, y - 32, 9, 8, "#3a3a3a"); ell(c, x + 20, y - 36, 4, 2.5, "#3a3a3a", -.5); ell(c, x + 28, y - 34, 1.8, 1.8, "#fff");
  }
  function cheval(c, x, y) {
    shadow(c, x, y + 2, 40, 11); pattes(c, x, y, [-22, -12, 14, 24], 28, "#6b4426", 5); for (const dx of [-22, -12, 14, 24]) ell(c, x + dx, y, 3.4, 2, "#2a1a0a");
    c.beginPath(); c.moveTo(x - 30, y - 40); c.quadraticCurveTo(x - 46, y - 30, x - 40, y - 12); c.strokeStyle = "#3a2410"; c.lineWidth = 6; c.stroke();
    ell(c, x, y - 40, 32, 15, lin(c, 0, y - 55, 0, y - 25, [[0, "#b8784a"], [1, "#8a5530"]])); c.strokeStyle = "#3a2410"; c.lineWidth = 2; c.stroke();
    poly(c, [[x + 20, y - 48], [x + 34, y - 80], [x + 44, y - 76], [x + 34, y - 40]], "#a8693a", "#3a2410", 2);
    c.save(); c.translate(x + 44, y - 78); c.rotate(.5); ell(c, 0, 0, 14, 8, "#a8693a"); c.strokeStyle = "#3a2410"; c.lineWidth = 2; c.stroke(); c.restore();
    for (let k = 0; k < 6; k++) ell(c, x + 26 + k * 2, y - 52 - k * 5, 4, 3, "#3a2410");
    ell(c, x + 42, y - 82, 2, 2, "#1a1a1a"); poly(c, [[x + 36, y - 88], [x + 38, y - 96], [x + 42, y - 88]], "#a8693a", "#3a2410", 1.4);
  }
  function cochon(c, x, y) {
    shadow(c, x, y + 2, 30, 9); pattes(c, x, y, [-14, -6, 8, 16], 12, "#d87a8a", 5);
    ell(c, x, y - 24, 26, 15, rad(c, x - 8, y - 32, 2, x, y - 24, 28, [[0, "#ffd0d8"], [1, "#f0909e"]])); c.strokeStyle = "#a8505e"; c.lineWidth = 2; c.stroke();
    ell(c, x + 24, y - 30, 12, 11, "#f8b0bc"); c.stroke(); ell(c, x + 33, y - 28, 6, 5, "#f0909e"); c.stroke(); ell(c, x + 31, y - 28, 1.2, 1.6, "#7a2a3a"); ell(c, x + 35, y - 28, 1.2, 1.6, "#7a2a3a");
    ell(c, x + 24, y - 34, 2, 2, "#1a1a1a"); poly(c, [[x + 16, y - 38], [x + 18, y - 46], [x + 24, y - 40]], "#f0909e", "#a8505e", 1.4);
    c.beginPath(); c.arc(x - 28, y - 28, 4, 0, Math.PI * 1.6); c.strokeStyle = "#a8505e"; c.lineWidth = 2; c.stroke();
    ell(c, x - 6, y - 16, 8, 4, "rgba(110,75,35,.35)");
  }
  function chevre(c, x, y) {
    shadow(c, x, y + 2, 28, 8); pattes(c, x, y, [-12, -4, 8, 14], 18, "#5a5550", 3.4);
    ell(c, x, y - 28, 22, 12, lin(c, 0, y - 40, 0, y - 16, [[0, "#f4f0e6"], [1, "#c8c0b0"]])); c.strokeStyle = "#5a5550"; c.lineWidth = 2; c.stroke();
    poly(c, [[x + 14, y - 32], [x + 22, y - 50], [x + 30, y - 46], [x + 24, y - 28]], "#ece6d8", "#5a5550", 1.6);
    ell(c, x + 30, y - 50, 9, 7, "#ece6d8"); c.stroke(); ell(c, x + 31, y - 52, 1.6, 1.6, "#1a1a1a");
    c.beginPath(); c.moveTo(x + 26, y - 56); c.quadraticCurveTo(x + 18, y - 70, x + 12, y - 62); c.strokeStyle = "#7a6a50"; c.lineWidth = 3; c.stroke();
    poly(c, [[x + 32, y - 44], [x + 36, y - 34], [x + 30, y - 40]], "#ece6d8", "#5a5550", 1.2);
  }
  function cerf(c, x, y) {
    shadow(c, x, y + 2, 34, 10); pattes(c, x, y, [-18, -10, 12, 20], 30, "#7a4a24", 3.6);
    ell(c, x, y - 40, 28, 13, lin(c, 0, y - 53, 0, y - 27, [[0, "#c8884a"], [1, "#94582c"]])); c.strokeStyle = "#3a2410"; c.lineWidth = 2; c.stroke();
    for (let k = 0; k < 5; k++) ell(c, x - 12 + k * 6, y - 46 + (k % 2) * 3, 1.8, 1.4, "#f4e6c8");
    poly(c, [[x + 18, y - 46], [x + 26, y - 74], [x + 34, y - 72], [x + 28, y - 40]], "#b8784a", "#3a2410", 1.6);
    ell(c, x + 34, y - 76, 11, 8, "#b8784a"); c.stroke(); ell(c, x + 36, y - 78, 1.8, 1.8, "#1a1a1a"); ell(c, x + 44, y - 74, 2.4, 2, "#1a1a1a");
    for (const s of [-1, 1]) { const bx = x + 30 + s * 4; c.beginPath(); c.moveTo(bx, y - 82); c.lineTo(bx + s * 6, y - 104); c.moveTo(bx + s * 3, y - 92); c.lineTo(bx + s * 12, y - 98); c.moveTo(bx + s * 5, y - 100); c.lineTo(bx - s * 2, y - 112); c.strokeStyle = "#6b4426"; c.lineWidth = 3; c.lineCap = "round"; c.stroke(); }
    ell(c, x - 28, y - 44, 5, 4, "#fff");
  }
  function lapin(c, x, y) { shadow(c, x, y + 1, 16, 5); ell(c, x, y - 12, 13, 11, "#b8b0a4"); c.strokeStyle = "#5a5550"; c.lineWidth = 1.6; c.stroke(); ell(c, x + 10, y - 22, 8, 7, "#c4bcb0"); c.stroke(); for (const s of [0, 5]) { ell(c, x + 8 + s, y - 36, 3, 9, "#c4bcb0", .1); c.stroke(); ell(c, x + 8 + s, y - 36, 1.4, 6, "#f0b0b8", .1); } ell(c, x + 13, y - 24, 1.6, 1.6, "#1a1a1a"); ell(c, x - 12, y - 14, 4, 4, "#fff"); }
  function renard(c, x, y) {
    shadow(c, x, y + 2, 30, 8); pattes(c, x, y, [-10, -3, 8, 14], 12, "#2a1a10", 3.4);
    c.beginPath(); c.moveTo(x - 16, y - 20); c.quadraticCurveTo(x - 44, y - 24, x - 40, y - 6); c.quadraticCurveTo(x - 28, y - 4, x - 16, y - 14); c.fillStyle = "#e8742a"; c.fill(); c.strokeStyle = "#6a2a0a"; c.lineWidth = 1.6; c.stroke(); ell(c, x - 39, y - 8, 5, 4, "#fff");
    ell(c, x, y - 20, 20, 10, "#e8742a"); c.stroke(); ell(c, x + 4, y - 14, 10, 4, "#fff4e6");
    poly(c, [[x + 14, y - 30], [x + 30, y - 22], [x + 40, y - 18], [x + 28, y - 12], [x + 14, y - 16]], "#e8742a", "#6a2a0a", 1.6); poly(c, [[x + 28, y - 16], [x + 40, y - 18], [x + 28, y - 12]], "#fff4e6");
    poly(c, [[x + 16, y - 30], [x + 18, y - 40], [x + 22, y - 28]], "#e8742a", "#6a2a0a", 1.4); poly(c, [[x + 22, y - 28], [x + 26, y - 38], [x + 28, y - 26]], "#e8742a", "#6a2a0a", 1.4);
    ell(c, x + 24, y - 23, 1.8, 1.8, "#1a1a1a"); ell(c, x + 40, y - 18, 1.8, 1.6, "#1a1a1a");
  }
  function hibou(c, x, y) { shadow(c, x, y, 18, 5); line(c, x - 22, y - 4, x + 22, y - 4, "#6b4426", 6); ell(c, x, y - 24, 16, 20, rad(c, x - 4, y - 30, 1, x, y - 24, 20, [[0, "#c8a070"], [1, "#7a5430"]])); c.strokeStyle = "#3a2410"; c.lineWidth = 2; c.stroke(); ell(c, x, y - 18, 9, 11, "#f0dcb8"); for (let k = 0; k < 4; k++) line(c, x - 4 + (k % 2) * 6, y - 22 + k * 4, x - 2 + (k % 2) * 6, y - 20 + k * 4, "#b88a55", 1.2); eyes(c, x, y - 32, 6, 7, 0); poly(c, [[x - 2, y - 28], [x + 2, y - 28], [x, y - 23]], "#f2a530"); poly(c, [[x - 14, y - 40], [x - 10, y - 48], [x - 6, y - 40]], "#7a5430"); poly(c, [[x + 6, y - 40], [x + 10, y - 48], [x + 14, y - 40]], "#7a5430"); for (const s of [-1, 1]) line(c, x + s * 4, y - 6, x + s * 4, y - 3, "#f2a530", 2); }
  function ecureuil(c, x, y) { shadow(c, x, y + 1, 16, 5); c.beginPath(); c.moveTo(x - 6, y - 4); c.quadraticCurveTo(x - 30, y - 10, x - 24, y - 36); c.quadraticCurveTo(x - 16, y - 50, x - 8, y - 38); c.quadraticCurveTo(x - 18, y - 24, x - 4, y - 10); c.fillStyle = "#c8642a"; c.fill(); c.strokeStyle = "#6a2a0a"; c.lineWidth = 1.6; c.stroke(); ell(c, x + 2, y - 12, 9, 11, "#d8743a"); c.stroke(); ell(c, x + 4, y - 9, 5, 7, "#fff0d8"); ell(c, x + 6, y - 26, 7, 7, "#d8743a"); c.stroke(); poly(c, [[x + 2, y - 31], [x + 3, y - 38], [x + 7, y - 32]], "#d8743a", "#6a2a0a", 1.2); ell(c, x + 8, y - 27, 1.6, 1.6, "#1a1a1a"); ell(c, x + 9, y - 16, 3.4, 4, "#8a5a2a"); }

  // ─── Bâtiments 2 ───
  function chapelle(c, x, y) {
    batisse(c, x, y, { a: 1.5, b: 1, h: 70, rh: 46, wallL: lin(c, x - 100, 0, x, 0, [[0, "#f4efe4"], [1, "#e0d8c6"]]), wallR: "#c8bea8", roof: "#4a6a8a", roofDark: "#2e4a64",
      deco: (q) => { for (const u of [-.5, -.15, .2]) { const [px, py] = q(u + .08, .5, 30); c.beginPath(); c.moveTo(px - 7, py + 18); c.lineTo(px - 7, py); c.arc(px, py, 7, Math.PI, 0); c.lineTo(px + 7, py + 22); c.closePath(); c.fillStyle = lin(c, px, py - 8, px, py + 20, [[0, "#ff9cc0"], [.5, "#8ac8f0"], [1, "#ffd23f"]]); c.fill(); c.strokeStyle = "#5a4a30"; c.lineWidth = 2; c.stroke(); } faceCircle(c, q, "R", 1.5, 1, 0, 88, .12, 12, "#8ac8f0", "#5a4a30", 3); faceRect(c, q, "R", 1.5, 1, -.14, .14, 0, 44, "#7b4a24", "#3d2310", 2); },
      top: (q) => { box(c, q, .55, 0, .34, .34, 70, 90, "#f4efe4", "#c8bea8", null); faceRect(c, q, "R", 1.44, .34, -.08, .08, 130, 152, "#3a2a1a"); const [bx, by] = q(.72, 0, 136); ell(c, bx, by, 6, 7, "#e0a830"); const t = q(.55, 0, 205); poly(c, [q(.38, .17, 160), q(.72, .17, 160), t], "#4a6a8a", "#1e3448", 2); poly(c, [q(.72, -.17, 160), q(.72, .17, 160), t], "#2e4a64", "#1e3448", 2); line(c, t[0], t[1], t[0], t[1] - 18, "#5a4a30", 2); poly(c, [[t[0], t[1] - 18], [t[0] + 12, t[1] - 15], [t[0], t[1] - 12]], "#e0a830"); } });
  }
  function ecole(c, x, y) {
    batisse(c, x, y, { a: 1.9, b: 1, h: 66, rh: 40, wallL: lin(c, x - 120, 0, x, 0, [[0, "#ffd8a8"], [1, "#f0b878"]]), wallR: "#d89a5a", roof: "#c2453a", roofDark: "#8e2a22",
      deco: (q) => { windows(c, q, "L", 1.9, 1, 5, 1, 18, 56, "#9fd4ef", 0); faceRect(c, q, "R", 1.9, 1, -.15, .15, 0, 42, "#3a7ad8", "#1d3a66", 2); const [sx, sy] = q(0, .5, 62); c.save(); c.translate(sx, sy); c.transform(1, .5, 0, 1, 0, 0); c.fillStyle = "#fff"; c.fillRect(-28, -10, 56, 14); c.strokeStyle = "#8e2a22"; c.strokeRect(-28, -10, 56, 14); c.fillStyle = "#8e2a22"; c.font = "bold 10px sans-serif"; c.textAlign = "center"; c.fillText("ÉCOLE", 0, 1); c.restore(); },
      top: (q) => { box(c, q, .3, 0, .2, .2, 96, 22, "#fff", "#ddd", "#c2453a"); ell(c, ...q(.4, 0, 108), 5, 6, "#e0a830"); const [fx, fy] = q(-.8, .5, 0); line(c, fx - 30, fy + 10, fx - 30, fy - 90, "#9aa2b0", 3); poly(c, [[fx - 30, fy - 90], [fx - 4, fy - 84], [fx - 30, fy - 72]], "#3aa86a", "#1f6a3e", 1.2); } });
    for (const [dx, dy, col] of [[-80, 30, "#ff8fb1"], [-60, 40, "#6fd0ef"]]) { ell(c, x + dx, y + dy, 5, 5, col); }
  }
  function gare(c, x, y) {
    const q = batisse(c, x, y, { a: 2, b: .9, h: 70, rh: 34, wallL: lin(c, x - 120, 0, x, 0, [[0, "#c86a4a"], [1, "#a8503a"]]), wallR: "#8a3a28", roof: "#4a4750", roofDark: "#2a2830",
      deco: (q) => { windows(c, q, "L", 2, .9, 6, 1, 12, 52, "#fff4c0", 0); faceCircle(c, q, "R", 2, .9, 0, 86, .14, 14, "#fff", "#2a2830", 3); line(c, ...q(1, 0, 86), ...q(1, 0, 96), "#2a2830", 2); line(c, ...q(1, 0, 86), ...q(1, .08, 86), "#2a2830", 2); const [sx, sy] = q(-.2, .45, 64); c.save(); c.translate(sx, sy); c.transform(1, .5, 0, 1, 0, 0); c.fillStyle = "#1d3a66"; c.fillRect(-46, -11, 92, 15); c.fillStyle = "#fff"; c.font = "bold 9px sans-serif"; c.textAlign = "center"; c.fillText("GARE DE L'ÉTANG", 0, 0); c.restore(); } });
    quad(c, q, [[-1, .45, 46], [1, .45, 46], [1, .95, 38], [-1, .95, 38]], "rgba(90,85,100,.92)", "#2a2830", 2);
    for (const i of [-.9, -.3, .3, .9]) line(c, ...q(i, .9, 0), ...q(i, .9, 38), "#2a2830", 3);
  }
  function boulangerie(c, x, y) {
    batisse(c, x, y, { a: 1.3, b: 1.1, h: 64, rh: 44, wallL: lin(c, x - 90, 0, x, 0, [[0, "#fff0d0"], [1, "#efd8a8"]]), wallR: "#d8bc88", roof: "#9c6532", roofDark: "#6b4022",
      deco: (q) => { faceRect(c, q, "L", 1.3, 1.1, -.5, .05, 8, 42, "#ffe8b0", "#6b4022", 3); for (let k = 0; k < 4; k++) { const [px, py] = q(-.42 + k * .12, .55, 18); ell(c, px, py, 7, 4, "#d8963a", .45); line(c, px - 3, py - 2, px + 1, py + 1, "#a8641a", 1.2); } faceRect(c, q, "L", 1.3, 1.1, .2, .45, 0, 44, "#7b4a24", "#3d2310", 2); const [sx, sy] = q(-.6, .55, 60); line(c, sx, sy, sx - 14, sy - 6, "#2a1a0a", 2); ell(c, sx - 18, sy + 6, 13, 9, "#e0a830"); c.strokeStyle = "#6b4022"; c.lineWidth = 2; c.stroke(); ell(c, sx - 18, sy + 6, 8, 3.5, "#c2701a", .3); },
      top: (q) => { box(c, q, -.3, -.2, .22, .22, 70, 54, "#c4beb2", "#9a9284", "#5a524a"); fumee(c, ...q(-.3, -.2, 130), 3, "rgba(240,240,240,"); } });
  }
  function erable(c, x, y, s = 1) { shadow(c, x + 6, y, 44 * s, 14 * s); trunk(c, x, y, 64, 8, s); foliage(c, x, y, [[0, -92, 32], [-28, -80, 24], [28, -80, 25], [-16, -114, 23], [18, -112, 24], [0, -130, 18], [-38, -98, 18], [38, -100, 18]], s, ["#7a1a0a", "#d8402a", "#ff8a3d", "#ffd06a"]); poly(c, [[x + 6 * s, y - 34 * s], [x + 16 * s, y - 30 * s], [x + 15 * s, y - 18 * s], [x + 7 * s, y - 22 * s]], "#9aa2b0", "#3e3a44", 1.4); line(c, x + 4 * s, y - 36 * s, x + 9 * s, y - 34 * s, "#3e3a44", 2); }
  function cabaneSucre(c, x, y) {
    batisse(c, x, y, { a: 1.5, b: 1.1, h: 56, rh: 44, wallL: lin(c, x - 100, 0, x, 0, [[0, "#b07a45"], [1, "#8a5530"]]), wallR: "#6b4022", roof: "#c2453a", roofDark: "#8e2a22",
      deco: (q) => { for (let z = 6; z < 56; z += 8) { line(c, ...q(-.75, .55, z), ...q(.75, .55, z), "rgba(40,20,5,.45)", 1.6); line(c, ...q(.75, -.55, z), ...q(.75, .55, z), "rgba(30,15,5,.45)", 1.6); } faceRect(c, q, "L", 1.5, 1.1, -.45, -.15, 18, 42, "#ffe8a0", "#3d2310", 2.5); faceRect(c, q, "R", 1.5, 1.1, -.15, .15, 0, 42, "#5a3418", "#2a1a0a", 2); },
      top: (q) => { box(c, q, 0, 0, .7, .3, 100, 16, "#8a5530", "#6b4022", "#c2453a"); for (let k = 0; k < 4; k++) ell(c, ...q(-.2 + k * .14, 0, 124 + k * 14), 14 + k * 5, 9 + k * 3, `rgba(255,255,255,${.75 - k * .15})`); } });
    for (const [dx, dy] of [[-90, 30], [-74, 40]]) { cylindre(c, x + dx, y + dy, 9, 4, 18, "#8a5530", "#b07a45", "#3d2310"); }
  }
  function eolienne(c, x, y) { shadow(c, x, y, 20, 6); poly(c, [[x - 6, y], [x - 3, y - 190], [x + 3, y - 190], [x + 6, y]], lin(c, x - 6, 0, x + 6, 0, [[0, "#ffffff"], [1, "#c9ced8"]]), "#8a929e", 1.4); c.beginPath(); c.roundRect(x - 8, y - 198, 22, 12, 5); c.fillStyle = "#f4f6f8"; c.fill(); c.strokeStyle = "#8a929e"; c.stroke(); const hx = x - 8, hy = y - 192; for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * TAU / 3 + .3; c.save(); c.translate(hx, hy); c.rotate(a); c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(40, -8, 86, 0); c.quadraticCurveTo(40, 5, 0, 3); c.closePath(); c.fillStyle = "#fbfcfd"; c.fill(); c.strokeStyle = "#8a929e"; c.lineWidth = 1.4; c.stroke(); c.restore(); } ell(c, hx, hy, 5, 5, "#dde2ea"); c.strokeStyle = "#8a929e"; c.stroke(); }

  // ─── Eau ───
  function surEau(c, x, y, rx = 60, ry = 26) { ell(c, x, y, rx, ry, lin(c, x - rx, y - ry, x + rx, y + ry, [[0, "#6fd0ef"], [1, "#2f8ac2"]])); for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x + R(-rx * .6, rx * .6), y + R(-ry * .5, ry * .5), 10, 3, 0, Math.PI * 1.1, Math.PI * 1.9); c.strokeStyle = "rgba(255,255,255,.6)"; c.lineWidth = 1.5; c.stroke(); } }
  function ponton(c, x, y) { surEau(c, x, y + 6, 80, 30); const q = Q(x, y); for (const [i, j] of [[-.6, -.15], [-.6, .15], [0, -.15], [0, .15], [.6, -.15], [.6, .15]]) box(c, q, i, j, .06, .06, -14, 26, "#7a4b25", "#5a3418", null); for (let k = 0; k < 9; k++) { const i0 = -.7 + k * .155; quad(c, q, [[i0, -.22, 12], [i0 + .14, -.22, 12], [i0 + .14, .22, 12], [i0, .22, 12]], k % 2 ? "#c98f52" : "#b8834c", "#4a2a12", 1.2); } box(c, q, .55, .1, .14, .14, 12, 10, "#3a7ad8", "#2a5aa8", "#4a8ae8"); }
  function barque(c, x, y) { surEau(c, x, y + 4, 56, 22); c.beginPath(); c.moveTo(x - 44, y - 16); c.quadraticCurveTo(x - 30, y + 8, x + 10, y + 10); c.quadraticCurveTo(x + 40, y + 6, x + 48, y - 14); c.lineTo(x + 30, y - 18); c.lineTo(x - 34, y - 22); c.closePath(); c.fillStyle = lin(c, 0, y - 22, 0, y + 10, [[0, "#c98f52"], [1, "#7a4b25"]]); c.fill(); c.strokeStyle = "#3d2310"; c.lineWidth = 2; c.stroke(); poly(c, [[x - 34, y - 22], [x + 30, y - 18], [x + 26, y - 12], [x - 30, y - 16]], "#5a3418"); line(c, x - 10, y - 18, x - 46, y + 2, "#8a5530", 3); ell(c, x - 48, y + 4, 6, 3, "#8a5530"); line(c, x + 10, y - 16, x + 40, y + 8, "#8a5530", 3); ell(c, x + 42, y + 10, 6, 3, "#8a5530"); }
  function voilier(c, x, y) { surEau(c, x, y + 4, 60, 22); c.beginPath(); c.moveTo(x - 46, y - 14); c.quadraticCurveTo(x - 20, y + 10, x + 20, y + 6); c.lineTo(x + 50, y - 16); c.closePath(); c.fillStyle = lin(c, 0, y - 14, 0, y + 8, [[0, "#ffffff"], [1, "#c9ced8"]]); c.fill(); c.strokeStyle = "#3e3a44"; c.lineWidth = 2; c.stroke(); line(c, x - 40, y - 12, x + 44, y - 14, "#3a7ad8", 3); line(c, x, y - 14, x, y - 120, "#5a3418", 3); poly(c, [[x + 3, y - 116], [x + 3, y - 20], [x + 44, y - 22]], lin(c, x, y - 116, x + 44, y - 20, [[0, "#fff8e8"], [1, "#e8dcc4"]]), "#8a7a60", 1.6); poly(c, [[x - 3, y - 100], [x - 3, y - 22], [x - 34, y - 20]], "#ffd23f", "#8a6a10", 1.6); poly(c, [[x, y - 120], [x + 14, y - 116], [x, y - 112]], "#e0362f"); }
  function bateauVapeur(c, x, y) { surEau(c, x, y + 6, 80, 28); c.beginPath(); c.moveTo(x - 64, y - 20); c.quadraticCurveTo(x - 40, y + 10, x + 30, y + 10); c.lineTo(x + 66, y - 18); c.closePath(); c.fillStyle = lin(c, 0, y - 20, 0, y + 10, [[0, "#3e3a44"], [1, "#1d1a20"]]); c.fill(); c.strokeStyle = "#0a0a10"; c.lineWidth = 2; c.stroke(); line(c, x - 60, y - 16, x + 62, y - 16, "#c5282b", 4); poly(c, [[x - 40, y - 20], [x + 30, y - 18], [x + 30, y - 48], [x - 40, y - 50]], "#f4efe4", "#5a4a30", 2); for (let k = 0; k < 5; k++) ell(c, x - 30 + k * 14, y - 34, 4, 4, "#8ac8f0"); poly(c, [[x - 44, y - 50], [x + 34, y - 48], [x + 30, y - 54], [x - 40, y - 56]], "#c5282b"); cylindre(c, x - 6, y - 52, 8, 3, 34, "#1d1a20", "#3e3a44"); line(c, x - 14, y - 78, x + 2, y - 78, "#c5282b", 4); fumee(c, x - 6, y - 92, 4, "rgba(80,80,85,"); ell(c, x + 44, y - 18, 10, 18, "#c5282b"); c.strokeStyle = "#5a0f0f"; c.lineWidth = 2; c.stroke(); for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI; line(c, x + 44 - Math.cos(t) * 9, y - 18 - Math.sin(t) * 16, x + 44 + Math.cos(t) * 9, y - 18 + Math.sin(t) * 16, "#5a0f0f", 1.4); } }
  function cabanePecheur(c, x, y) { surEau(c, x + 20, y + 10, 70, 24); for (const dx of [-30, 0, 30]) line(c, x + dx, y + 16 - dx * .3, x + dx, y - 10 - dx * .3, "#5a3418", 5); c.save(); c.translate(0, -16); batisse(c, x, y, { a: .9, b: .7, h: 44, rh: 30, wallL: "#7a9db6", wallR: "#4e6a80", roof: "#9c6532", roofDark: "#6b4022", deco: (q) => { faceRect(c, q, "L", .9, .7, -.15, .15, 6, 34, "#3d2310", "#1a0f05", 2); } }); c.restore(); for (let k = 0; k < 6; k++) for (let l = 0; l < 4; l++) ell(c, x + 50 + k * 5, y - 30 + l * 6 + k * 1.5, 1, 1, "#3e3a44"); line(c, x + 48, y - 34, x + 78, y - 20, "#5a3418", 2); }
  function bouee(c, x, y) { surEau(c, x, y + 2, 34, 13); cylindre(c, x, y, 12, 5, 16, "#e0362f", "#ff6b5e", "#5a0f0f"); cylindre(c, x, y - 16, 8, 3.4, 14, "#fff", "#fff", "#5a0f0f"); cylindre(c, x, y - 30, 5, 2, 8, "#e0362f", "#e0362f", "#5a0f0f"); ell(c, x, y - 40, 10, 10, "rgba(255,230,120,.5)"); ell(c, x, y - 40, 3, 3, "#ffe27a"); }

  // ─── Locomotive et tuyaux refaits (vue isométrique propre) ───
  function locomotive2(c, x, y) {
    const q = Q(x, y), A = 1.3, B = .34;
    shadow(c, x, y + 6, 90, 26);
    box(c, q, 0, 0, A, B, 8, 8, "#2a2830", "#1d1a20", "#3e3a44", "#0a0a10");
    // chaudière : boîte arrondie (vert) avec cerclages dorés
    box(c, q, .12, 0, .9, B * .9, 16, 30, lin(c, x - 60, 0, x, 0, [[0, "#3aa86a"], [1, "#1f6a3e"]]), "#17502e", "#4ac87e", "#0f2a18");
    for (const i of [-.2, .1, .4]) { line(c, ...q(i, B * .45, 16), ...q(i, B * .45, 46), "#ffd23f", 3); line(c, ...q(i, -B * .45, 46), ...q(i, B * .45, 46), "#ffd23f", 3); }
    faceCircle(c, q, "R", 1.14, B, 0, 31, .13, 13, "#2a7a4a", "#0f2a18", 2); faceCircle(c, q, "R", 1.14, B, 0, 31, .05, 5, "#ffd23f", "#8a6a10", 1.5);
    // cabine rouge à l'arrière
    box(c, q, -.45, 0, .36, B * 1.1, 16, 60, "#c5282b", "#8e1a1a", "#3e3a44", "#3a0808");
    faceRect(c, q, "L", .36, B * 1.1, -.1, .08, 0, 0, null);
    { const P = (u, z) => q(-.45 + u, B * .55, z); poly(c, [P(-.1, 46), P(.1, 46), P(.1, 66), P(-.1, 66)], "#fff4b0", "#3a0808", 2); }
    // cheminée et dôme
    { const [cx, cy] = q(.45, 0, 46); cylindre(c, cx, cy, 7, 3, 26, "#1d1a20", "#3e3a44"); poly(c, [[cx - 11, cy - 26], [cx + 11, cy - 26], [cx + 7, cy - 32], [cx - 7, cy - 32]], "#3e3a44", "#0a0a10", 1.5); fumee(c, cx, cy - 44, 4); }
    { const [dx, dy] = q(.05, 0, 46); ell(c, dx, dy - 4, 8, 7, "#ffd23f"); c.strokeStyle = "#8a6a10"; c.lineWidth = 1.5; c.stroke(); }
    // roues rouges sur le côté gauche
    for (const i of [-.42, -.08, .22, .5]) { const r = i < 0 ? 15 : 11; faceCircle(c, q, "L", A, B, i, r - 2, r / 64, r, "#c5282b", "#3a0808", 2); faceCircle(c, q, "L", A, B, i, r - 2, .02, 3, "#3a0808"); }
    line(c, ...q(-.42, B / 2 + .01, 13), ...q(.5, B / 2 + .01, 9), "#9aa2b0", 3);
    // chasse-pierres à l'avant
    poly(c, [q(.65, -B / 2, 8), q(.65, B / 2, 8), q(.8, 0, 0)], "#c5282b", "#3a0808", 1.6);
  }
  function tuyaux2(c, x, y) {
    const q = Q(x, y); shadow(c, x, y + 4, 60, 18);
    const pipeI = (j, z, i0, i1, col) => box(c, q, (i0 + i1) / 2, j, i1 - i0, .12, z, 12, col, mix(col, -.25), mix(col, .2), "#2a2830");
    const pipeV = (i, j, z0, h, col) => box(c, q, i, j, .12, .12, z0, h, col, mix(col, -.25), mix(col, .2), "#2a2830");
    pipeV(-.45, -.1, 0, 70, "#8a929e"); pipeI(-.1, 58, -.45, .45, "#8a929e"); pipeV(.45, -.1, 0, 70, "#8a929e");
    pipeI(.25, 6, -.6, .5, "#c9a24a"); pipeV(.1, .25, 6, 40, "#c9a24a");
    for (const [i, j, z] of [[-.45, -.1, 58], [.45, -.1, 58]]) box(c, q, i, j, .16, .16, z - 2, 16, "#6e7682", "#4e5560", "#9aa2b0", "#2a2830");
    faceCircle(c, q, "R", .9 + .12, .5, -.1, 34, .12, 12, null, "#c5282b", 4);
    line(c, ...q(.51, -.22, 34), ...q(.51, .02, 34), "#c5282b", 2.4); line(c, ...q(.51, -.1, 22), ...q(.51, -.1, 46), "#c5282b", 2.4);
    { const [gx, gy] = q(.1, .25, 46); ell(c, gx, gy - 6, 10, 10, "#f4f6f8"); c.strokeStyle = "#2a2830"; c.lineWidth = 2; c.stroke(); line(c, gx, gy - 6, gx + 5, gy - 11, "#c5282b", 2); }
  }

  window.DD = { setSeason: (v) => { SEASON = v; }, GROUND, Q, wheel, TW, TH, OUT, abreuvoir, abribus, antenne, arbre, arbreBac, atmCrypto, banc, baril, barque, bateauVapeur, batisse, blob, borneIncendie, borneRecharge, bouee, bougie, boulangerie, bouleau, boutique, box, buisson, buissonBaies, bureaux, cabanePecheur, cabaneSucre, cabineTel, caisse, camera, canard, casierColis, castor, cerf, champiMaison, champignons, champignonsPetits, chapelle, charrette, chateauEau, cheval, chevre, cloture, cochon, coffre, conteneur, cordeLinge, crapaude, cubeIso, cylindre, diamond, distributeur, drone, ecole, ecranPub, ecureuil, ell, engrenage, eolienne, epouvantail, erable, etal, eyes, faceCircle, faceRect, falaise, feuCamp, feuCirculation, fleursTouffe, foliage, fontaine, forge, forteresse, fougere, fumee, gare, goeland, golemFumee, grange, gratteCiel, grenouille, grue, hameconneur, hautesHerbes, hibou, hydre, lampadaire, lanterne, lapin, leaf, lily, lin, line, locomotive, locomotive2, maison, meuleFoin, minage, mix, montagne, moulin, mouton, ombre, paletteCaisses, panneau, panneauAffiche, panneauSolaire, pattes, peak, petitsCailloux, phare, pilier, poly, ponton, potsFleurs, poubelle, poule, puits, quad, rackServeurs, rad, renard, rocher, rockBlob, roseaux, ruche, sapin, shadow, siphon, souche, surEau, tasBois, tasCharbon, taverne, tente, terrier, texture, tonneau, tourBlocs, troncCouche, trottinette, trunk, tuyaux, tuyaux2, usine, vache, verInfo, voilier, voiture, wagonnet, windows, setSeed: (v) => { seed = v; } };
  if (window.DD_LIB) { window.__done = true; return; }

  // ─── Planches ───
  function sheet(id, title, items, cols, cw, ch) {
    const rows = Math.ceil(items.length / cols), W = cols * cw + 40, H = rows * ch + 90;
    const cv = document.createElement("canvas"); cv.id = id; cv.width = W; cv.height = H; document.body.append(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#f4ecdc"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#3d2a12"; c.font = "bold 28px sans-serif"; c.fillText(title, 24, 46);
    c.font = "13px sans-serif"; c.fillStyle = "#8a7558"; c.fillText("Dip Duck — style isométrique 2D · case = 128 × 64 px · brouillon de direction artistique", 24, 68);
    items.forEach(([name, draw, ax = .5, ay = .78], k) => {
      const x0 = 20 + (k % cols) * cw, y0 = 80 + Math.floor(k / cols) * ch;
      c.fillStyle = "#fffaf0"; c.beginPath(); c.roundRect(x0 + 6, y0 + 6, cw - 12, ch - 12, 12); c.fill();
      c.strokeStyle = "#e3d5bb"; c.lineWidth = 1.5; c.stroke();
      c.save(); c.beginPath(); c.rect(x0 + 6, y0 + 6, cw - 12, ch - 30); c.clip();
      draw(c, x0 + cw * ax, y0 + ch * ay); c.restore();
      c.fillStyle = "#5a4326"; c.font = "bold 14px sans-serif"; c.textAlign = "center"; c.fillText(name, x0 + cw / 2, y0 + ch - 14); c.textAlign = "left";
    });
  }
  const big = (f, k) => (c, x, y) => { c.save(); c.translate(x, y); c.scale(k, k); f(c, 0, 0); c.restore(); };
  const g = (t) => (c, x, y) => GROUND[t](c, x, y - 20);
  sheet("planche-1-sols", "Planche 1 — Sols et falaises", [
    ["Herbe", g("herbe"), .5, .55], ["Herbe fleurie", g("fleurs"), .5, .55], ["Terre (chemin)", g("terre"), .5, .55], ["Sable", g("sable"), .5, .55],
    ["Dalles de pierre", g("pierre"), .5, .55], ["Eau", g("eau"), .5, .55], ["Eau + nénuphars", g("nenuphar"), .5, .55], ["Pont de bois", g("pont"), .5, .55],
    ["Falaise basse", (c, x, y) => falaise(c, x, y - 60, 40), .5, .62], ["Falaise haute", (c, x, y) => falaise(c, x, y - 80, 80), .5, .62],
    ["Falaise + chemin", (c, x, y) => falaise(c, x, y - 60, 40, "terre"), .5, .62], ["Falaise + sable", (c, x, y) => falaise(c, x, y - 60, 40, "sable"), .5, .62],
  ], 4, 230, 210);
  sheet("planche-2-nature", "Planche 2 — Nature : arbres, roches, montagnes", [
    ["Arbre rond", arbre], ["Sapin", sapin], ["Fougère géante", fougere], ["Buisson fleuri", buisson],
    ["Rocher", rocher], ["Cailloux", petitsCailloux], ["Pilier de roche", pilier], ["Champignons", champignons],
    ["Fleurs", fleursTouffe], ["Hautes herbes", hautesHerbes], ["Roseaux", roseaux], ["Montagne", (c, x, y) => montagne(c, x, y, .62)],
  ], 4, 230, 250);
  sheet("planche-3-batiments", "Planche 3 — Bâtiments et objets", [
    ["Maison du village", (c, x, y) => maison(c, x, y), .5, .7], ["Étal du marché", etal, .45, .7], ["Puits", puits, .5, .78], ["Phare (acte III)", (c, x, y) => { c.save(); c.translate(x, y); c.scale(.82, .82); phare(c, 0, 0); c.restore(); }, .5, .86],
    ["Clôture", big(cloture, 1.6)], ["Lanterne", big(lanterne, 1.6)], ["Panneau", big(panneau, 1.5)], ["Coffre", big(coffre, 1.8)],
    ["Tonneau", big(tonneau, 1.8)], ["Caisse", big(caisse, 1.8)],
  ], 4, 300, 330);
  sheet("planche-4-personnages", "Planche 4 — Personnages", [
    ["Dip Duck (face)", big((c, x, y) => canard(c, x, y, "face"), 2)], ["Dip Duck (dos)", big((c, x, y) => canard(c, x, y, "dos"), 2)], ["Dip Duck (joie)", big((c, x, y) => canard(c, x, y, "face", "joie"), 2)],
    ["Grand-père Grenouille", big(grenouille, 2)], ["Le Castor", big(castor, 2)], ["Madame Crapaude", big(crapaude, 2)], ["Goéland, gardien du phare", big(goeland, 2)],
    ["Bougie rouge", big((c, x, y) => bougie(c, x, y), 2)], ["Bougie rouge (attaque)", big((c, x, y) => bougie(c, x, y, "attaque"), 2)],
  ], 3, 300, 280);

  const small = (f, k) => (c, x, y) => { c.save(); c.translate(x, y); c.scale(k, k); f(c, 0, 0); c.restore(); };
  sheet("planche-5-epoques", "Planche 5 — Bâtiments des époques", [
    ["1 · Village — Moulin", moulin, .5, .86], ["1 · Village — Forge", forge, .5, .74],
    ["2 · Industrie — Usine", usine, .5, .78], ["2 · Industrie — Château d'eau", chateauEau, .5, .9],
    ["3 · Information — Bureaux", small(bureaux, .85), .5, .88], ["3 · Information — Antenne", small(antenne, .85), .5, .9],
    ["4 · Blockchain — Centre de minage", minage, .5, .76], ["4 · Blockchain — Tour des blocs", small(tourBlocs, .9), .5, .86],
    ["5 · Aujourd'hui — Gratte-ciel", small(gratteCiel, .78), .5, .9], ["5 · Aujourd'hui — Forteresse-Coffre (2 sur 3)", forteresse, .5, .78],
  ], 2, 440, 360);
  sheet("planche-6-ennemis-epoques", "Planche 6 — Ennemis des époques", [
    ["1 · Bougie rouge", big((c, x, y) => bougie(c, x, y), 1.8)], ["2 · Golem de fumée", big(golemFumee, 1.8)], ["3 · Ver informatique", big(verInfo, 1.8)],
    ["4 · Hydre des 51 %", big(hydre, 1.5)], ["5 · Hameçonneur (faux airdrop)", big(hameconneur, 1.8)], ["5 · Siphon (vide les coffres)", big(siphon, 1.5)],
    ["5 · Bande des Ombres (enlèvements)", big(ombre, 1.8)],
  ], 3, 320, 300);

  sheet("planche-7-sols-varies", "Planche 7 — Sols variés", [
    ["Champ de blé", g("ble"), .5, .55], ["Potager", g("potager"), .5, .55], ["Sol de forêt", g("foret"), .5, .55], ["Boue et flaques", g("boue"), .5, .55], ["Neige", g("neige"), .5, .55],
    ["Pavés (village)", g("paves"), .5, .55], ["Gravier", g("gravier"), .5, .55], ["Rails", g("rails"), .5, .55], ["Route (ville)", g("asphalte"), .5, .55], ["Dalles", g("pierre"), .5, .55],
  ], 5, 220, 200);
  sheet("planche-8-campagne-foret", "Planche 8 — Campagne et forêt", [
    ["Grange", small(grange, .72), .5, .8], ["Meule de foin", big(meuleFoin, 1.4)], ["Épouvantail", big(epouvantail, 1.3)], ["Charrette", big(charrette, 1.5)], ["Vache", big(vache, 1.3)],
    ["Poule", big(poule, 2)], ["Ruche", big(ruche, 1.5)], ["Abreuvoir", big(abreuvoir, 1.5)], ["Tas de bois", big(tasBois, 1.5)], ["Bouleau", bouleau],
    ["Souche", big(souche, 1.5)], ["Tronc couché", big(troncCouche, 1.4)], ["Feu de camp", big(feuCamp, 1.4)], ["Tente", big(tente, 1.3)], ["Maison-champignon", champiMaison],
    ["Terrier", big(terrier, 1.5)], ["Buisson à baies", big(buissonBaies, 1.4)],
  ], 5, 250, 250);
  sheet("planche-9-village-ville", "Planche 9 — Village et ville", [
    ["Taverne", small(taverne, .72), .5, .8], ["Fontaine", fontaine, .5, .8], ["Banc", big(banc, 1.4)], ["Corde à linge", big(cordeLinge, 1.3)], ["Pots de fleurs", big(potsFleurs, 1.5)],
    ["Tableau d'affichage", big(panneauAffiche, 1.3)], ["Épicerie", small(boutique, .78), .5, .82], ["Feu de circulation", big(feuCirculation, 1.3)], ["Borne d'incendie", big(borneIncendie, 1.8)], ["Poubelle de tri", big(poubelle, 1.8)],
    ["Lampadaire", big(lampadaire, 1.2)], ["Abribus", abribus, .5, .8], ["Voiture", big(voiture, 1.3)], ["Cabine téléphonique", big(cabineTel, 1.2)], ["Distributeur", big(distributeur, 1.4)],
    ["Arbre en bac", big(arbreBac, 1.4)],
  ], 5, 250, 250);
  sheet("planche-10-industrie-moderne", "Planche 10 — Zone industrielle et monde moderne", [
    ["Locomotive", locomotive2, .5, .74], ["Wagonnet de charbon", big(wagonnet, 1.4)], ["Tas de charbon", big(tasCharbon, 1.4)], ["Tuyaux et vanne", big(tuyaux2, 1.2)], ["Conteneur", conteneur, .5, .76],
    ["Grue", (c, x, y) => { c.save(); c.translate(x - 30, y); c.scale(.8, .8); grue(c, 0, 0); c.restore(); }, .5, .88], ["Baril", big(baril, 1.6)], ["Palette et caisses", big(paletteCaisses, 1.5)], ["Engrenage géant", big(engrenage, 1.4)], ["Panneau solaire", big(panneauSolaire, 1.4)],
    ["Borne de recharge", big(borneRecharge, 1.4)], ["Distributeur crypto", big(atmCrypto, 1.3)], ["Baie de serveurs", big(rackServeurs, 1.2)], ["Drone", big(drone, 1.3)], ["Écran publicitaire", ecranPub, .5, .84],
    ["Trottinette", big(trottinette, 1.6)], ["Caméra", big(camera, 1.3)], ["Casiers à colis", big(casierColis, 1.3)],
  ], 5, 250, 250);

  sheet("planche-11-animaux", "Planche 11 — Animaux", [
    ["Mouton", big(mouton, 1.6)], ["Cheval", big(cheval, 1.3)], ["Cochon", big(cochon, 1.6)], ["Chèvre", big(chevre, 1.6)], ["Cerf", big(cerf, 1.3)],
    ["Lapin", big(lapin, 2)], ["Renard", big(renard, 1.7)], ["Hibou", big(hibou, 2)], ["Écureuil", big(ecureuil, 2)], ["Vache", big(vache, 1.3)],
  ], 5, 250, 230);
  sheet("planche-12-batiments-2", "Planche 12 — Chapelle, école, gare, boulangerie, cabane à sucre", [
    ["Chapelle", small(chapelle, .7), .5, .86], ["École", small(ecole, .62), .5, .8], ["Gare", small(gare, .62), .5, .8],
    ["Boulangerie", small(boulangerie, .75), .5, .8], ["Cabane à sucre", small(cabaneSucre, .7), .55, .8], ["Érable (eau d'érable)", erable, .5, .86],
    ["Éolienne", small(eolienne, .8), .55, .9],
  ], 3, 330, 330);
  sheet("planche-13-eau", "Planche 13 — Eau, port et bateaux", [
    ["Ponton", ponton, .5, .66], ["Barque", big(barque, 1.3), .5, .66], ["Voilier", voilier, .5, .8], ["Bateau à vapeur", bateauVapeur, .5, .74],
    ["Cabane de pêcheur", small(cabanePecheur, .85), .45, .74], ["Bouée", big(bouee, 1.6), .5, .7],
  ], 3, 330, 260);

  // ─── Animations de Dip Duck (une ligne = une animation, une colonne = une image) ───
  const ANIMS = [
    ["Repos", "face", "", [{ bob: 0 }, { bob: -1.5 }, { bob: -2.5 }, { bob: -1.5 }]],
    ["Marche ↘ (bas droite)", "face", "", [{ step: 1, bob: 0 }, { step: 0, bob: -3 }, { step: -1, bob: 0 }, { step: 0, bob: -3 }]],
    ["Marche ↙ (bas gauche)", "face", "", [{ step: 1, bob: 0 }, { step: 0, bob: -3 }, { step: -1, bob: 0 }, { step: 0, bob: -3 }], true],
    ["Marche ↖ (haut gauche)", "dos", "", [{ step: 1, bob: 0 }, { step: 0, bob: -3 }, { step: -1, bob: 0 }, { step: 0, bob: -3 }]],
    ["Marche ↗ (haut droite)", "dos", "", [{ step: 1, bob: 0 }, { step: 0, bob: -3 }, { step: -1, bob: 0 }, { step: 0, bob: -3 }], true],
    ["Coup de bec", "face", "", [{ lean: 0 }, { lean: -.12, bob: -2 }, { lean: .38, bob: 2 }, { lean: .12 }]],
    ["Coup reçu", "face", "", [{ lean: -.25, hit: true }, { lean: -.15, hit: true }, { lean: -.05 }, { lean: 0 }]],
    ["Joie", "face", "joie", [{ bob: 0 }, { bob: -12 }, { bob: -20 }, { bob: -8 }]],
  ];
  (function animSheet() {
    const cw = 150, ch = 150, lw = 230, W = lw + cw * 4 + 30, H = 90 + ch * ANIMS.length + 20;
    const cv = document.createElement("canvas"); cv.id = "planche-14-animations"; cv.width = W; cv.height = H; document.body.append(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#f4ecdc"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#3d2a12"; c.font = "bold 28px sans-serif"; c.fillText("Planche 14 — Animations de Dip Duck", 24, 46);
    c.font = "13px sans-serif"; c.fillStyle = "#8a7558"; c.fillText("4 images par animation, environ 8 images par seconde · les directions gauches = image retournée", 24, 68);
    ANIMS.forEach(([name, view, mood, frames, flip], r) => {
      const y0 = 80 + r * ch;
      c.fillStyle = "#5a4326"; c.font = "bold 16px sans-serif"; c.fillText(name, 24, y0 + ch / 2 + 6);
      frames.forEach((pose, k) => {
        const x0 = lw + k * cw;
        c.fillStyle = "#fffaf0"; c.beginPath(); c.roundRect(x0 + 6, y0 + 6, cw - 12, ch - 12, 12); c.fill(); c.strokeStyle = "#e3d5bb"; c.lineWidth = 1.5; c.stroke();
        c.save(); c.translate(x0 + cw / 2, y0 + ch - 26); c.scale(flip ? -1.3 : 1.3, 1.3); canard(c, 0, 0, view, mood, pose); c.restore();
        c.fillStyle = "#b8a888"; c.font = "11px sans-serif"; c.fillText(String(k + 1), x0 + 14, y0 + 22);
      });
    });
  })();
  // Images séparées pour fabriquer des GIF animés (marche ↘ et joie)
  window.__frames = {};
  for (const r of [1, 7]) {
    const [name, view, mood, frames] = ANIMS[r];
    window.__frames[r === 1 ? "marche" : "joie"] = frames.map((pose) => { const cv = document.createElement("canvas"); cv.width = 240; cv.height = 240; const c = cv.getContext("2d"); c.fillStyle = "#f4ecdc"; c.fillRect(0, 0, 240, 240); c.save(); c.translate(120, 200); c.scale(2, 2); canard(c, 0, 0, view, mood, pose); c.restore(); return cv.toDataURL("image/png"); });
  }

  // ─── Scène d'exemple : exploration libre dans un coin de l'Étang (pas de tour par tour) ───
  function scene(id, mode = "ete", ui = true) {
    seed = 42; SEASON = mode;
    const N = 12, W = 1640, H = 1080, OX = 820, OY = 250;
    const cv = document.createElement("canvas"); cv.id = id; cv.width = W; cv.height = H; document.body.append(cv);
    const c = cv.getContext("2d");
    const SKY = { ete: ["#9ad6f0", "#d8f1d0"], automne: ["#f2c08a", "#f6e2c4"], hiver: ["#c6dbec", "#f4f8fc"], nuit: ["#0b1430", "#26386a"] }[mode];
    c.fillStyle = lin(c, 0, 0, 0, H, [[0, SKY[0]], [1, SKY[1]]]); c.fillRect(0, 0, W, H);
    for (let k = 0; k < 7; k++) { const cx = R(0, W), cy = R(20, 160); for (let p = 0; p < 4; p++) ell(c, cx + p * 30, cy + R(-8, 8), 34, 18, mode === "nuit" ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.75)"); }
    // Végétation selon la saison (automne : feuilles rousses ; hiver : couleurs froides et neige)
    const veg = (f, h = 100, tint = false) => (x, y) => {
      c.filter = mode === "automne" && tint ? "hue-rotate(-70deg) saturate(1.4)" : mode === "hiver" ? "saturate(.25) brightness(1.2)" : "none";
      f(x, y); c.filter = "none";
      if (mode === "hiver") for (let k = 0; k < 6; k++) ell(c, x + R(-h * .28, h * .28), y - h * R(.55, 1), R(6, 11), R(3, 5), "rgba(255,255,255,.95)");
    };
    const X = (i, j) => OX + (i - j) * 64, Y = (i, j) => OY + (i + j) * 32;
    const lvl = (i, j) => (i === 0 || j === 0) ? 2 : (i === 1 || j === 1) ? 1 : 0;
    const water = (i, j) => (i - 9.5) ** 2 + (j - 9.5) ** 2 < 7;
    const path = (i, j) => lvl(i, j) === 0 && !water(i, j) && (j === 5 || i === 5);
    const ht = (i, j) => lvl(i, j) * 36;
    const groundType = (i, j) => water(i, j) ? ((i * 7 + j * 3) % 5 === 0 ? "nenuphar" : "eau") : path(i, j) ? "terre" : ((i * 5 + j * 11) % 7 === 0 ? "fleurs" : "herbe");
    // 1) sols plats
    for (let s = 0; s <= 2 * (N - 1); s++) for (let i = 0; i < N; i++) {
      const j = s - i; if (j < 0 || j >= N || lvl(i, j)) continue;
      const gt = groundType(i, j), wet = water(i, j), x = X(i, j), y = Y(i, j);
      if (mode === "hiver") {
        if (wet) { c.filter = "saturate(.3) brightness(1.45)"; GROUND.eau(c, x, y); c.filter = "none"; }
        else { GROUND[gt](c, x, y); c.globalAlpha = gt === "terre" ? .5 : .88; GROUND.neige(c, x, y); c.globalAlpha = 1; }
      } else {
        GROUND[gt](c, x, y);
      }
    }
    const duck = [5, 7], foes = [[8, 6]];
    // 3) tout le reste, trié de l'arrière vers l'avant
    const draws = [];
    const at = (i, j, f, key = i + j) => draws.push({ key, f: () => f(X(i, j), Y(i, j) - ht(i, j)) });
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (lvl(i, j)) draws.push({ key: i + j - .5, f: () => { falaise(c, X(i, j), Y(i, j) - ht(i, j), ht(i, j) + 2, mode === "hiver" ? "neige" : (i + j) % 4 ? "herbe" : "fleurs"); c.filter = "none"; } });
    for (const [i, j] of [[0, 3], [0, 6], [0, 9], [3, 0], [7, 0], [10, 0]]) at(i, j, veg((x, y) => sapin(c, x, y), 120));
    for (const [i, j] of [[1, 5], [5, 1], [1, 8]]) at(i, j, veg((x, y) => pilier(c, x, y, .9), 30));
    for (const [i, j] of [[0, 1], [1, 0]]) at(i, j, veg((x, y) => arbre(c, x, y, .9), 130));
    const mx = (X(3, 2) + X(4, 3)) / 2, my = (Y(3, 2) + Y(4, 3)) / 2;
    draws.push({ key: 3.5 + 2.5 + .6, f: () => { maison(c, mx, my); if (mode === "hiver") { const q = Q(mx, my); poly(c, [q(-.91, 0, 134), q(.91, 0, 134), q(.91, .8, 65), q(-.91, .8, 65)], "rgba(250,252,255,.96)", "#b8c8d8", 1.5); for (let k = 0; k < 12; k++) { const [px, py] = q(-.85 + k * .155, .82, 63); ell(c, px, py, 8, 5, "#fafcff"); } } } });
    at(8, 3, (x, y) => etal(c, x, y), 11.2); at(9, 2, (x, y) => tonneau(c, x, y)); at(9, 4, (x, y) => caisse(c, x, y));
    at(2, 9, (x, y) => puits(c, x, y)); at(6, 4, (x, y) => lanterne(c, x, y)); at(4, 4, (x, y) => panneau(c, x, y));
    at(10, 2, veg((x, y) => arbre(c, x, y), 140)); at(2, 11, veg((x, y) => arbre(c, x, y, .95), 135)); at(11, 4, veg((x, y) => fougere(c, x, y), 50, true));
    if (mode !== "hiver") { at(7, 2, veg((x, y) => fleursTouffe(c, x, y), 20)); at(4, 7, veg((x, y) => fleursTouffe(c, x, y), 20)); at(3, 11, (x, y) => champignons(c, x, y)); }
    at(6, 9, veg((x, y) => buisson(c, x, y), 40)); at(10, 5, (x, y) => rocher(c, x, y, .8)); at(4, 10, veg((x, y) => hautesHerbes(c, x, y), 20, true));
    at(7, 9, veg((x, y) => roseaux(c, x, y), 40, true)); at(9, 7, veg((x, y) => roseaux(c, x, y), 40, true)); at(2, 6, (x, y) => grenouille(c, x, y)); at(11, 6, (x, y) => petitsCailloux(c, x, y));
    // Dip Duck marche librement sur le chemin (petits nuages de poussière derrière lui)
    at(...duck, (x, y) => { for (let k = 0; k < 3; k++) ell(c, x - 30 - k * 16, y - 6 - k * 9, 7 - k * 1.5, 5 - k, mode === "hiver" ? `rgba(255,255,255,${.9 - k * .2})` : `rgba(240,225,190,${.8 - k * .2})`); canard(c, x, y, "face"); if (mode === "hiver") { c.beginPath(); c.moveTo(x - 12, y - 38); c.quadraticCurveTo(x + 4, y - 30, x + 16, y - 38); c.strokeStyle = "#d8402a"; c.lineWidth = 6; c.lineCap = "round"; c.stroke(); line(c, x - 8, y - 36, x - 12, y - 18, "#d8402a", 6); } });
    for (const f of foes) at(...f, (x, y) => bougie(c, x, y));
    draws.sort((a, b) => a.key - b.key).forEach((d) => d.f());
    if (mode === "automne") for (let k = 0; k < 70; k++) ell(c, R(0, W), R(0, H), R(3, 6), R(1.6, 3), ["#d8402a", "#ff8a3d", "#e0a030", "#a0522d"][k % 4], R(0, 3));
    if (mode === "hiver") for (let k = 0; k < 260; k++) ell(c, R(0, W), R(0, H), R(1.2, 3.2), R(1.2, 3.2), "rgba(255,255,255,.9)");
    if (mode === "nuit") {
      c.globalCompositeOperation = "multiply"; c.fillStyle = "#3c4c8c"; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "lighter";
      const glow = (x, y, r, col) => ell(c, x, y, r, r, rad(c, x, y, 1, x, y, r, [[0, col], [1, "rgba(0,0,0,0)"]]));
      glow(X(6, 4), Y(6, 4) - 78, 110, "rgba(255,190,90,.55)");
      glow(mx + 45, my - 20, 60, "rgba(255,210,120,.6)");
      for (const f of foes) glow(X(...f), Y(...f) - 68, 80, "rgba(255,120,50,.55)");
      glow(X(5, 7), Y(5, 7) - 30, 70, "rgba(255,240,180,.18)");
      for (let k = 0; k < 40; k++) { const x = R(200, 1450), y = R(300, 950); glow(x, y, 9, "rgba(220,255,120,.7)"); }
      c.globalCompositeOperation = "source-over";
      for (let k = 0; k < 120; k++) ell(c, R(0, W), R(0, 120), R(.6, 1.6), R(.6, 1.6), "rgba(255,255,255,.85)");
      ell(c, W - 160, 70, 34, 34, "#fff6d8"); ell(c, W - 146, 62, 30, 30, SKY[0]);
    }
    SEASON = "ete";
    if (!ui) { c.fillStyle = mode === "nuit" ? "rgba(255,255,255,.85)" : "rgba(60,40,20,.8)"; c.font = "bold 30px sans-serif"; c.fillText({ automne: "Automne", hiver: "Hiver", nuit: "La nuit" }[mode] || "", 30, 56); return; }
    // bulle de dialogue de Grand-père Grenouille
    { const x = X(2, 6) + 20, y = Y(2, 6) - 150, w = 250, h = 58;
      c.fillStyle = "#fffaf0"; c.beginPath(); c.roundRect(x - 40, y, w, h, 14); c.fill(); c.strokeStyle = "#5a4326"; c.lineWidth = 3; c.stroke();
      poly(c, [[x - 4, y + h - 2], [x + 18, y + h - 2], [x - 8, y + h + 22]], "#fffaf0"); line(c, x - 4, y + h, x - 8, y + h + 22, "#5a4326", 3); line(c, x + 18, y + h, x - 8, y + h + 22, "#5a4326", 3);
      c.fillStyle = "#5a4326"; c.font = "bold 15px sans-serif"; c.fillText("Une bougie rouge rôde", x - 26, y + 24); c.fillText("près du marché, petit !", x - 26, y + 45); }
    // interface : vie, calme, pièces
    c.fillStyle = "rgba(25,20,35,.78)"; c.beginPath(); c.roundRect(20, 20, 300, 74, 14); c.fill();
    c.fillStyle = "#fff"; c.font = "bold 16px sans-serif"; c.fillText("Dip Duck", 36, 46);
    for (let k = 0; k < 5; k++) { const hx = 44 + k * 26, hy = 70; c.fillStyle = k < 4 ? "#ff5a5a" : "#5a4a5a"; c.beginPath(); c.moveTo(hx, hy + 8); c.bezierCurveTo(hx - 14, hy - 2, hx - 6, hy - 12, hx, hy - 4); c.bezierCurveTo(hx + 6, hy - 12, hx + 14, hy - 2, hx, hy + 8); c.fill(); }
    c.fillStyle = "#3a3348"; c.beginPath(); c.roundRect(180, 62, 120, 14, 7); c.fill(); c.fillStyle = "#6fd0ef"; c.beginPath(); c.roundRect(180, 62, 84, 14, 7); c.fill(); c.fillStyle = "#fff"; c.font = "bold 11px sans-serif"; c.fillText("CALME", 214, 73);
    c.fillStyle = "rgba(25,20,35,.78)"; c.beginPath(); c.roundRect(W - 170, 20, 150, 44, 14); c.fill();
    ell(c, W - 146, 42, 12, 12, "#ffd23f"); c.strokeStyle = "#b8860b"; c.lineWidth = 2; c.stroke(); c.fillStyle = "#fff"; c.font = "bold 18px sans-serif"; c.fillText("× 128", W - 126, 49);
    // commandes tactiles : joystick à gauche, boutons d'action à droite
    ell(c, 130, H - 140, 84, 84, "rgba(25,20,35,.35)"); c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = 3; c.stroke();
    ell(c, 158, H - 158, 36, 36, "rgba(255,255,255,.85)"); c.strokeStyle = "rgba(25,20,35,.5)"; c.stroke();
    for (const [bx2, by2, r, col, txt] of [[W - 150, H - 130, 56, "#ffd23f", "QUACK"], [W - 270, H - 90, 40, "#6fd0ef", "OBJET"], [W - 250, H - 210, 36, "#ff8fb1", "SAC"]]) {
      ell(c, bx2, by2 + 4, r, r, "rgba(25,20,35,.35)"); ell(c, bx2, by2, r, r, col); c.strokeStyle = "#3a2a10"; c.lineWidth = 3; c.stroke();
      c.fillStyle = "#3a2a10"; c.font = `bold ${Math.round(r * .32)}px sans-serif`; c.textAlign = "center"; c.fillText(txt, bx2, by2 + r * .12); c.textAlign = "left";
    }
    c.fillStyle = "rgba(255,255,255,.75)"; c.font = "13px sans-serif"; c.fillText("Brouillon de direction artistique — Dip Duck (dipduck.xyz)", 20, H - 18);
  }
  scene("scene-exemple");
  scene("scene-automne", "automne", false);
  scene("scene-hiver", "hiver", false);
  scene("scene-nuit", "nuit", false);

  // ─── Animations des habitants, animaux et ennemis (déformations simples, 4 images) ───
  const PNJ = [
    ["Grand-père Grenouille", grenouille, "idle"], ["Le Castor", castor, "idle"], ["Madame Crapaude", crapaude, "idle"], ["Goéland", goeland, "walk"],
    ["Mouton", mouton, "walk"], ["Poule", poule, "peck"], ["Bougie rouge", (c, x, y) => bougie(c, x, y), "hop"], ["Golem de fumée", golemFumee, "walk"],
    ["Ver informatique", verInfo, "wiggle"], ["Siphon", siphon, "float"], ["Hameçonneur", hameconneur, "float"], ["Bande des Ombres", ombre, "walk"],
  ];
  function animT(kind, k) {
    const t = k / 4 * TAU;
    switch (kind) {
      case "idle": return { sx: 1 + Math.sin(t) * .03, sy: 1 - Math.sin(t) * .045, rot: 0, dy: 0 };
      case "walk": return { sx: 1, sy: 1, rot: Math.sin(t) * .08, dy: -Math.abs(Math.sin(t)) * 5 };
      case "peck": return { sx: 1, sy: 1, rot: [0, .25, .5, .2][k], dy: 0 };
      case "hop": return { sx: [1, 1.1, .92, 1][k], sy: [1, .88, 1.1, 1][k], rot: 0, dy: [0, 0, -14, -5][k] };
      case "wiggle": return { sx: 1 + Math.sin(t) * .07, sy: 1 - Math.sin(t) * .04, rot: 0, dy: 0, skew: Math.sin(t) * .14 };
      default: return { sx: 1, sy: 1, rot: Math.sin(t) * .05, dy: -6 - Math.sin(t) * 7 };
    }
  }
  function drawAnim(c, f, kind, k, x, y, s) {
    const a = animT(kind, k);
    shadow(c, x, y, 22 * s, 7 * s);
    c.save(); c.translate(x, y + a.dy * s); c.rotate(a.rot); c.transform(1, 0, -(a.skew || 0), 1, 0, 0); c.scale(a.sx * s, a.sy * s); f(c, 0, 0); c.restore();
  }
  (function pnjSheet() {
    const cw = 150, ch = 150, lw = 230, W = lw + cw * 4 + 30, H = 90 + ch * PNJ.length + 20;
    const cv = document.createElement("canvas"); cv.id = "planche-15-animations-pnj"; cv.width = W; cv.height = H; document.body.append(cv);
    const c = cv.getContext("2d");
    c.fillStyle = "#f4ecdc"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#3d2a12"; c.font = "bold 28px sans-serif"; c.fillText("Planche 15 — Animations des habitants et ennemis", 24, 46);
    c.font = "13px sans-serif"; c.fillStyle = "#8a7558"; c.fillText("respiration, marche, picorer, sautiller, onduler, flotter · 4 images chacune", 24, 68);
    PNJ.forEach(([name, f, kind], r) => {
      const y0 = 80 + r * ch;
      c.fillStyle = "#5a4326"; c.font = "bold 16px sans-serif"; c.fillText(name, 24, y0 + ch / 2 + 6);
      for (let k = 0; k < 4; k++) {
        const x0 = lw + k * cw;
        c.fillStyle = "#fffaf0"; c.beginPath(); c.roundRect(x0 + 6, y0 + 6, cw - 12, ch - 12, 12); c.fill(); c.strokeStyle = "#e3d5bb"; c.lineWidth = 1.5; c.stroke();
        c.save(); c.beginPath(); c.rect(x0 + 6, y0 + 6, cw - 12, ch - 12); c.clip(); drawAnim(c, f, kind, k, x0 + cw / 2, y0 + ch - 24, 1.05); c.restore();
      }
    });
  })();
  for (const [key, r] of [["bougie", 6], ["siphon", 9], ["mouton", 4], ["grenouille", 0]]) {
    const [, f, kind] = PNJ[r];
    window.__frames[key] = [0, 1, 2, 3].map((k) => { const cv = document.createElement("canvas"); cv.width = 200; cv.height = 200; const c = cv.getContext("2d"); c.fillStyle = "#f4ecdc"; c.fillRect(0, 0, 200, 200); drawAnim(c, f, kind, k, 100, 170, 1.4); return cv.toDataURL("image/png"); });
  }
  window.__done = true;
})();

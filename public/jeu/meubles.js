// Dip Duck — meubles, sols d'intérieur et éléments de donjon (s'ajoutent à window.DD).
(() => {
  "use strict";
  const DD = window.DD;
  const { box, Q, faceRect, cylindre, ell, poly, line, lin, rad, shadow, diamond, cubeIso, rockBlob } = DD;
  const M = {};

  // ─── Sols d'intérieur ───
  DD.GROUND.parquet = (c, x, y) => {
    const P = (a, b) => [x + (a - b) * 64, y + (a + b) * 32];
    for (let k = 0; k < 8; k++) {
      const b0 = -.5 + k / 8, b1 = b0 + 1 / 8;
      poly(c, [P(-.5, b0), P(.5, b0), P(.5, b1), P(-.5, b1)], ["#c98f52", "#b87f46", "#d39a5c", "#bf8a4e"][k % 4]);
      const a = -.5 + ((k * 37) % 10) / 10; line(c, ...P(a, b0), ...P(a, b1), "rgba(60,30,10,.35)", 1);
    }
    diamond(c, x, y); c.strokeStyle = "rgba(60,30,10,.18)"; c.lineWidth = 1; c.stroke();
  };
  DD.GROUND.carrelage = (c, x, y) => {
    const P = (a, b) => [x + (a - b) * 64, y + (a + b) * 32];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) { const a0 = -.5 + a / 4, b0 = -.5 + b / 4; poly(c, [P(a0, b0), P(a0 + .25, b0), P(a0 + .25, b0 + .25), P(a0, b0 + .25)], (a + b) % 2 ? "#f4ead6" : "#c8643a", "rgba(80,40,20,.25)", 1); }
  };

  // ─── Meubles ───
  M.lit = (c, x, y) => {
    const q = Q(x, y); shadow(c, x, y + 4, 62, 20);
    box(c, q, -.47, 0, .06, .6, 0, 50, "#8a5530", "#6b4022", "#a36a36", "#3d2310");
    box(c, q, 0, 0, .9, .55, 0, 16, "#9c6532", "#7a4b25", "#b07a45", "#3d2310");
    box(c, q, .02, 0, .84, .5, 16, 10, "#f4f0e6", "#d8d2c6", "#ffffff", "#8a8478");
    box(c, q, .17, 0, .56, .52, 22, 6, "#4a7ab8", "#3a5a98", "#5a8ad8", "#1d3a66");
    box(c, q, -.3, 0, .18, .38, 26, 9, "#ffffff", "#e8e2d6", "#ffffff", "#8a8478");
  };
  M.table = (c, x, y) => {
    const q = Q(x, y); shadow(c, x, y + 2, 40, 13);
    for (const [a, b] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]]) box(c, q, a, b, .05, .05, 0, 28, "#7a4b25", "#5a3418", null, "#3d2310");
    box(c, q, 0, 0, .56, .56, 28, 5, "#b07a45", "#8a5530", "#c98f52", "#3d2310");
    ell(c, ...q(-.08, -.05, 34), 9, 4.5, "#ffffff"); ell(c, ...q(-.08, -.05, 35), 5.5, 2.6, "#e0a830");
    cylindre(c, ...q(.13, .1, 33), 4, 2, 11, "#8fc4e0", "#cfeaf8", "#3a5a78");
  };
  M.chaise = (c, x, y) => {
    const q = Q(x, y); shadow(c, x, y + 1, 16, 6);
    for (const [a, b] of [[-.1, -.1], [.1, -.1], [-.1, .1], [.1, .1]]) box(c, q, a, b, .035, .035, 0, 16, "#7a4b25", "#5a3418", null, "#3d2310");
    box(c, q, -.12, 0, .04, .26, 16, 26, "#9c6532", "#7a4b25", "#b07a45", "#3d2310");
    box(c, q, 0, 0, .26, .26, 16, 4, "#b07a45", "#8a5530", "#c98f52", "#3d2310");
  };
  M.cheminee = (c, x, y) => {
    const q = Q(x, y);
    box(c, q, 0, 0, .45, .9, 0, 104, "#a9a297", "#8a8377", "#c4beb2", "#3e3a30");
    for (let r = 1; r < 6; r++) line(c, ...q(.225, -.45, r * 17), ...q(.225, .45, r * 17), "rgba(40,35,30,.3)", 1.2);
    faceRect(c, q, "R", .45, .9, -.26, .26, 0, 42, "#2a1d16", "#1a120c", 2);
    const [fx, fy] = q(.24, 0, 8);
    ell(c, fx, fy - 8, 30, 22, rad(c, fx, fy - 8, 1, fx, fy - 8, 30, [[0, "rgba(255,200,90,.95)"], [1, "rgba(255,90,30,0)"]]));
    poly(c, [[fx - 10, fy], [fx - 2, fy - 24], [fx + 3, fy - 10], [fx + 9, fy - 20], [fx + 11, fy]], "#ffb52e"); poly(c, [[fx - 5, fy], [fx, fy - 12], [fx + 5, fy]], "#fff4b0");
    box(c, q, .06, 0, .56, 1.02, 46, 7, "#8a5530", "#6b4022", "#a36a36", "#3d2310");
  };
  M.etagere = (c, x, y) => {
    const q = Q(x, y); box(c, q, 0, 0, .28, .8, 0, 112, "#8a5530", "#6b4022", "#a36a36", "#3d2310");
    for (let s = 0; s < 4; s++) { const z = 8 + s * 26; faceRect(c, q, "R", .28, .8, -.37, .37, z, z + 22, "#4a2a12"); for (let k = 0; k < 7; k++) { const u = -.35 + k * .1; faceRect(c, q, "R", .28, .8, u, u + .075, z, z + 19 - (k % 3) * 4, ["#c2453a", "#3a7ad8", "#3aa86a", "#e0a830", "#8a5ad8"][(k + s) % 5], "rgba(0,0,0,.3)", 1); } }
  };
  M.etagerePain = (c, x, y) => {
    const q = Q(x, y); box(c, q, 0, 0, .28, .8, 0, 96, "#b07a45", "#8a5530", "#c98f52", "#3d2310");
    for (let s = 0; s < 3; s++) { const z = 10 + s * 28; faceRect(c, q, "R", .28, .8, -.37, .37, z, z + 24, "#6b4022"); for (let k = 0; k < 4; k++) { const [bx, by] = q(.16, -.28 + k * .19, z + 8); ell(c, bx, by, 9, 5, "#d8963a", .45); line(c, bx - 4, by - 2, bx + 1, by + 1, "#a8641a", 1.2); } }
  };
  M.tapis = (c, x, y) => {
    diamond(c, x, y, 200, 100); c.fillStyle = "#b8402a"; c.fill();
    diamond(c, x, y, 172, 86); c.fillStyle = "#e0a830"; c.fill();
    diamond(c, x, y, 152, 76); c.fillStyle = "#9a2a1e"; c.fill();
    for (const s of [100, 56]) { diamond(c, x, y, s, s / 2); c.strokeStyle = "#ffd23f"; c.lineWidth = 2; c.stroke(); }
  };
  M.paillasson = (c, x, y) => { diamond(c, x, y, 80, 40); c.fillStyle = "#8a6a3a"; c.fill(); c.strokeStyle = "#5a4020"; c.lineWidth = 2; c.stroke(); c.fillStyle = "#fff"; c.font = "bold 10px sans-serif"; c.textAlign = "center"; c.fillText("SORTIE", x, y + 4); c.textAlign = "left"; };
  M.comptoir = (c, x, y) => {
    const q = Q(x, y); shadow(c, x, y + 4, 86, 26);
    box(c, q, 0, 0, 1.6, .4, 0, 38, lin(c, x - 90, 0, x, 0, [[0, "#a36a36"], [1, "#7a4b25"]]), "#5a3418", "#c98f52", "#3d2310");
    for (let k = 1; k < 8; k++) line(c, ...q(-.8 + k * .2, .2, 2), ...q(-.8 + k * .2, .2, 36), "rgba(40,20,5,.3)", 1.2);
    for (let k = 0; k < 5; k++) { const [bx, by] = q(-.6 + k * .3, 0, 38); cylindre(c, bx, by, 3.5, 1.6, 16, ["#3aa86a", "#c2453a", "#8a5530", "#e0a830", "#3a7ad8"][k], "#fff", "#1a1a1a"); }
  };
  M.comptoirPain = (c, x, y) => {
    M.comptoir(c, x, y); const q = Q(x, y);
    for (let k = 0; k < 6; k++) { const [bx, by] = q(-.7 + k * .26, .05, 40); ell(c, bx, by - 2, 10, 5, "#d8963a", .4); line(c, bx - 5, by - 3, bx + 2, by, "#a8641a", 1.2); }
  };
  M.four = (c, x, y) => {
    shadow(c, x, y + 4, 60, 20);
    c.beginPath(); c.ellipse(x, y - 4, 56, 24, 0, 0, Math.PI); c.ellipse(x, y - 4, 56, 74, 0, Math.PI, 0); c.closePath();
    c.fillStyle = lin(c, x - 56, 0, x + 56, 0, [[0, "#d0704a"], [1, "#8a3a28"]]); c.fill(); c.strokeStyle = "#4a1a10"; c.lineWidth = 2; c.stroke();
    for (let r = 1; r < 5; r++) { c.beginPath(); c.ellipse(x, y - 4, 56, r * 15, 0, Math.PI, 0); c.strokeStyle = "rgba(60,20,10,.35)"; c.lineWidth = 1.2; c.stroke(); }
    c.beginPath(); c.ellipse(x + 8, y - 6, 22, 20, 0, Math.PI, 0); c.closePath(); c.fillStyle = "#2a1208"; c.fill();
    ell(c, x + 8, y - 12, 17, 10, rad(c, x + 8, y - 12, 1, x + 8, y - 12, 17, [[0, "rgba(255,180,60,.95)"], [1, "rgba(255,80,20,.1)"]]));
    cylindre(c, x - 20, y - 70, 8, 3, 30, "#8a3a28", "#5a2a1a", "#3a1208");
  };
  M.sac = (c, x, y) => {
    shadow(c, x, y + 2, 20, 6);
    c.beginPath(); c.moveTo(x - 16, y); c.quadraticCurveTo(x - 21, y - 24, x - 10, y - 34); c.lineTo(x + 10, y - 34); c.quadraticCurveTo(x + 21, y - 24, x + 16, y); c.closePath();
    c.fillStyle = "#f4ecdc"; c.fill(); c.strokeStyle = "#8a7a60"; c.lineWidth = 1.6; c.stroke(); line(c, x - 10, y - 34, x + 10, y - 34, "#8a5530", 3);
    c.fillStyle = "#8a5530"; c.font = "bold 7px sans-serif"; c.textAlign = "center"; c.fillText("FARINE", x, y - 12); c.textAlign = "left";
  };
  M.pupitre = (c, x, y) => { const q = Q(x, y); shadow(c, x, y + 2, 20, 7); box(c, q, 0, 0, .16, .16, 0, 40, "#8a5530", "#6b4022", null, "#3d2310"); poly(c, [q(-.2, -.18, 44), q(.18, -.18, 52), q(.18, .18, 52), q(-.2, .18, 44)], "#a36a36", "#3d2310", 1.6); poly(c, [q(-.14, -.13, 47), q(.12, -.13, 53), q(.12, .13, 53), q(-.14, .13, 47)], "#fffaf0", "#8a7a60", 1); };
  M.cierges = (c, x, y) => {
    shadow(c, x, y, 22, 7);
    for (const [dx, dy, h] of [[-10, 0, 26], [0, 4, 34], [10, -2, 22], [4, -6, 18]]) { cylindre(c, x + dx, y + dy, 4, 1.8, h, "#fffaf0", "#ffffff", "#a89a80"); ell(c, x + dx, y + dy - h - 6, 10, 10, "rgba(255,230,140,.3)"); ell(c, x + dx, y + dy - h - 6, 3, 6, "#ffd86a"); }
  };
  M.bancEglise = (c, x, y) => { const q = Q(x, y); shadow(c, x, y + 2, 50, 14); box(c, q, 0, -.2, .9, .06, 0, 40, "#8a5530", "#6b4022", "#a36a36", "#3d2310"); box(c, q, 0, 0, .9, .34, 16, 5, "#b07a45", "#8a5530", "#c98f52", "#3d2310"); for (const a of [-.4, .4]) box(c, q, a, 0, .05, .34, 0, 16, "#7a4b25", "#5a3418", null, "#3d2310"); };
  M.pupitreEcole = (c, x, y) => { const q = Q(x, y); shadow(c, x, y + 2, 30, 10); box(c, q, 0, 0, .4, .3, 0, 24, "#3aa86a", "#2a7a4a", "#c98f52", "#123a22"); ell(c, ...q(0, 0, 25), 7, 3.5, "#fff"); };
  M.tableau = (c, x, y) => { const q = Q(x, y); box(c, q, 0, 0, .08, 1.2, 30, 60, "#2a4a3a", "#1d3a2a", "#8a5530", "#5a3418"); c.save(); const [tx, ty] = q(.05, -.3, 70); c.translate(tx, ty); c.transform(1, -.5, 0, 1, 0, 0); c.fillStyle = "#fff"; c.font = "bold 13px sans-serif"; c.fillText("1 + 1 = 2", 0, 0); c.fillText("🦆 calme", 0, 18); c.restore(); };

  // ─── Donjon ───
  M.mur = (c, x, y) => {
    const H = 44, t = y - H;
    poly(c, [[x - 64, t], [x, t + 32], [x, t + 32 + H], [x - 64, t + H]], "#6e6a64", "rgba(20,20,25,.6)", 1.5);
    poly(c, [[x, t + 32], [x + 64, t], [x + 64, t + H], [x, t + 32 + H]], "#55524c", "rgba(20,20,25,.6)", 1.5);
    for (let r = 1; r < 3; r++) { const d = r * H / 3; line(c, x - 62, t + d, x - 2, t + 32 + d, "rgba(0,0,0,.25)", 1.2); line(c, x + 2, t + 32 + d, x + 62, t + d, "rgba(0,0,0,.25)", 1.2); }
    diamond(c, x, t); c.fillStyle = "#8a857c"; c.fill(); c.strokeStyle = "rgba(20,20,25,.5)"; c.lineWidth = 1.2; c.stroke();
  };
  M.bloc = (c, x, y) => { shadow(c, x, y + 4, 50, 18); cubeIso(c, x, y - 26, 52, "#b8b2a6", "#8a857c", "#6e6a64", "#2a2830"); for (const [a, b] of [[-26, -36], [10, -20]]) line(c, x + a, y + b, x + a + 12, y + b + 8, "rgba(40,35,30,.4)", 1.4); };
  M.plaque = (c, x, y) => { diamond(c, x, y, 96, 48); c.fillStyle = "#4a4750"; c.fill(); diamond(c, x, y - 3, 80, 40); c.fillStyle = "#9a6ad8"; c.fill(); c.strokeStyle = "#3a2a60"; c.lineWidth = 2; c.stroke(); ell(c, x, y - 3, 8, 4, "#e0c8ff"); };
  M.plaqueOn = (c, x, y) => { diamond(c, x, y, 96, 48); c.fillStyle = "#4a4750"; c.fill(); diamond(c, x, y, 80, 40); c.fillStyle = "#3dff8a"; c.fill(); c.strokeStyle = "#0f5a2a"; c.lineWidth = 2; c.stroke(); };
  M.grille = (c, x, y) => {
    const q = Q(x, y);
    for (let k = 0; k < 6; k++) { const i = -.42 + k * .168; box(c, q, i, 0, .05, .05, 0, 70, "#5d5a63", "#3e3a44", "#8a929e", "#16141c"); }
    box(c, q, 0, 0, .95, .07, 62, 8, "#5d5a63", "#3e3a44", "#8a929e", "#16141c"); box(c, q, 0, 0, .95, .07, 24, 5, "#5d5a63", "#3e3a44", "#8a929e", "#16141c");
  };
  M.porteBois = (c, x, y) => {
    const q = Q(x, y);
    box(c, q, 0, 0, .2, .96, 0, 64, "#9c6532", lin(c, x, 0, x + 60, 0, [[0, "#b07a45"], [1, "#8a5530"]]), "#7a4b25", "#3d2310");
    for (const z of [14, 48]) line(c, ...q(.1, -.48, z), ...q(.1, .48, z), "#3e3a44", 4);
    const [lx, ly] = q(.11, 0, 32); poly(c, [[lx - 7, ly - 2], [lx + 7, ly - 9], [lx + 7, ly + 7], [lx - 7, ly + 14]], "#ffd23f", "#6a4a10", 1.6); ell(c, lx, ly + 3, 2, 3, "#3a2a08");
  };
  M.brasero = (c, x, y) => {
    shadow(c, x, y, 16, 6); line(c, x, y, x, y - 34, "#3e3a44", 4);
    c.beginPath(); c.ellipse(x, y - 36, 14, 6, 0, 0, Math.PI); c.lineTo(x - 14, y - 36); c.closePath(); c.fillStyle = "#5d5a63"; c.fill();
    ell(c, x, y - 52, 24, 24, rad(c, x, y - 52, 1, x, y - 52, 24, [[0, "rgba(255,190,80,.7)"], [1, "rgba(255,100,30,0)"]]));
    poly(c, [[x - 9, y - 38], [x - 4, y - 58], [x, y - 46], [x + 5, y - 62], [x + 9, y - 38]], "#ffb52e"); poly(c, [[x - 4, y - 38], [x, y - 50], [x + 4, y - 38]], "#fff4b0");
  };
  M.grotte = (c, x, y) => {
    shadow(c, x, y + 6, 96, 28);
    rockBlob(c, x - 36, y - 46, 62, 50, "#9a8670"); rockBlob(c, x + 38, y - 40, 54, 46, "#8a7660"); rockBlob(c, x, y - 92, 62, 42, "#a8947c");
    c.beginPath(); c.moveTo(x - 30, y + 6); c.quadraticCurveTo(x - 36, y - 64, x + 2, y - 70); c.quadraticCurveTo(x + 40, y - 64, x + 34, y + 10); c.closePath();
    c.fillStyle = lin(c, 0, y - 70, 0, y + 10, [[0, "#0a0806"], [1, "#2a2018"]]); c.fill(); c.strokeStyle = "#3a2e22"; c.lineWidth = 3; c.stroke();
    for (const s of [-1, 1]) { line(c, x + s * 46, y + 4, x + s * 46, y - 40, "#5a3418", 3); poly(c, [[x + s * 46 - 6, y - 40], [x + s * 46 + 6, y - 40], [x + s * 46, y - 54]], "#ffb52e"); }
  };
  M.cle = (c, x, y) => { shadow(c, x, y + 4, 12, 4); c.save(); c.translate(x, y - 22); c.rotate(-.5); ell(c, -10, 0, 8, 8, null); c.strokeStyle = "#e0a830"; c.lineWidth = 4; c.stroke(); line(c, -2, 0, 18, 0, "#e0a830", 4); line(c, 12, 0, 12, 7, "#e0a830", 3); line(c, 17, 0, 17, 6, "#e0a830", 3); c.restore(); };
  M.piece = (c, x, y) => { shadow(c, x, y + 4, 10, 3); ell(c, x, y - 18, 9, 9, "#ffd23f"); c.strokeStyle = "#b8860b"; c.lineWidth = 2; c.stroke(); ell(c, x - 3, y - 21, 2.5, 3, "rgba(255,255,255,.8)"); };

  // ─── Forêt Profonde et Temple Moussu ───
  DD.GROUND.vide = (c, x, y) => {
    diamond(c, x, y); c.fillStyle = "#050406"; c.fill();
    c.save(); diamond(c, x, y); c.clip();
    poly(c, [[x - 64, y], [x, y - 32], [x + 64, y], [x + 64, y - 20], [x, y - 52], [x - 64, y - 20]], "#2a2622");
    c.fillStyle = rad(c, x, y + 6, 4, x, y + 6, 60, [[0, "rgba(0,0,0,1)"], [1, "rgba(40,30,50,.6)"]]); c.fillRect(x - 64, y - 32, 128, 64);
    c.restore();
  };
  M.porteBoisI = (c, x, y) => {
    const q = Q(x, y);
    box(c, q, 0, 0, .96, .2, 0, 64, lin(c, x - 60, 0, x, 0, [[0, "#b07a45"], [1, "#8a5530"]]), "#9c6532", "#7a4b25", "#3d2310");
    for (const z of [14, 48]) line(c, ...q(-.48, .1, z), ...q(.48, .1, z), "#3e3a44", 4);
    const [lx, ly] = q(0, .11, 32); poly(c, [[lx - 7, ly - 9], [lx + 7, ly - 2], [lx + 7, ly + 14], [lx - 7, ly + 7]], "#ffd23f", "#6a4a10", 1.6); ell(c, lx, ly + 3, 2, 3, "#3a2a08");
  };
  M.poteau = (c, x, y) => {
    shadow(c, x, y + 2, 16, 6); cylindre(c, x, y, 9, 4, 54, lin(c, x - 9, 0, x + 9, 0, [[0, "#c98f52"], [1, "#7a4b25"]]), "#e8c891", "#3d2310");
    for (const z of [16, 34]) { c.beginPath(); c.ellipse(x, y - z, 9, 4, 0, 0, Math.PI); c.strokeStyle = "#ffd23f"; c.lineWidth = 3; c.stroke(); }
    ell(c, x, y - 60, 7, 7, null); c.strokeStyle = "#9aa2b0"; c.lineWidth = 3; c.stroke();
  };
  M.arche = (c, x, y) => {
    for (const s of [-1, 1]) { shadow(c, x + s * 52, y + s * 26, 14, 5); cylindre(c, x + s * 52, y + s * 26, 8, 4, 96, "#8a5530", "#a36a36", "#3d2310"); }
    c.beginPath(); c.moveTo(x - 60, y - 70 - 26); c.lineTo(x + 60, y - 70 + 26); c.lineTo(x + 60, y - 86 + 26); c.lineTo(x - 60, y - 86 - 26); c.closePath(); c.fillStyle = "#9c6532"; c.fill(); c.strokeStyle = "#3d2310"; c.lineWidth = 2; c.stroke();
    for (let k = 0; k < 7; k++) ell(c, x - 54 + k * 18, y - 92 - 26 + k * 9, 10, 7, k % 2 ? "#4f9a35" : "#7cc54a");
    poly(c, [[x - 30, y - 64], [x + 30, y - 34], [x + 30, y - 16], [x - 30, y - 46]], "#e8c891", "#5f3a1c", 2);
    c.save(); c.translate(x, y - 38); c.transform(1, .5, 0, 1, 0, 0); c.fillStyle = "#5f3a1c"; c.font = "bold 10px sans-serif"; c.textAlign = "center"; c.fillText(M.archeTexte || "", 0, 0); c.restore();
  };
  M.temple = (c, x, y) => {
    const q = Q(x, y); shadow(c, x, y + 10, 150, 46);
    box(c, q, 0, 0, 2.2, 1.6, 0, 18, "#8a857c", "#6e6a64", "#a8a297", "#2a2830");
    box(c, q, 0, 0, 1.8, 1.3, 18, 70, lin(c, x - 100, 0, x, 0, [[0, "#b8b2a6"], [1, "#9a9284"]]), "#7d776c", null, "#2a2830");
    for (const u of [-.75, -.35, .35, .75]) box(c, q, u, .72, .16, .16, 18, 70, "#d0cabc", "#a8a297", null, "#2a2830");
    faceRect(c, q, "L", 1.8, 1.3, -.2, .2, 18, 70, "#050406", "#2a2830", 2);
    poly(c, [q(-1, -.75, 88), q(1, -.75, 88), q(1, .75, 88), q(-1, .75, 88)], "#8a857c", "#2a2830", 2);
    poly(c, [q(-1, .75, 88), q(1, .75, 88), q(0, .75, 130)], "#a8a297", "#2a2830", 2);
    poly(c, [q(1, -.75, 88), q(1, .75, 88), q(0, .75, 130), q(0, -.75, 130)], "#6e6a64", "#2a2830", 2);
    for (let k = 0; k < 18; k++) { const [mx, my] = q(-1 + Math.random() * 2, .75, 18 + Math.random() * 110); ell(c, mx, my, 6 + Math.random() * 6, 3 + Math.random() * 3, k % 2 ? "rgba(90,150,60,.85)" : "rgba(120,180,70,.8)"); }
    for (let k = 0; k < 6; k++) { const [vx, vy] = q(-.9 + k * .35, .76, 88); line(c, vx, vy, vx + (k % 2 ? 4 : -3), vy + 30 + k * 6, "#3e7a2a", 2.4); }
  };
  M.follet = (c, x, y) => {
    ell(c, x, y - 40, 34, 34, rad(c, x, y - 40, 2, x, y - 40, 34, [[0, "rgba(140,220,255,.55)"], [1, "rgba(100,180,255,0)"]]));
    c.beginPath(); c.moveTo(x, y - 74); c.quadraticCurveTo(x + 20, y - 46, x + 12, y - 26); c.quadraticCurveTo(x, y - 16, x - 12, y - 26); c.quadraticCurveTo(x - 20, y - 46, x, y - 74); c.closePath();
    c.fillStyle = lin(c, 0, y - 74, 0, y - 18, [[0, "#e8f8ff"], [1, "#4ab4ff"]]); c.fill(); c.strokeStyle = "#1d5a9a"; c.lineWidth = 1.6; c.stroke();
    for (const s of [-1, 1]) { ell(c, x + s * 5, y - 38, 3.4, 4.2, "#fff"); ell(c, x + s * 5 + 1, y - 37, 1.8, 2.4, "#0a2a55"); }
    c.beginPath(); c.arc(x, y - 30, 4, .2, Math.PI - .2); c.strokeStyle = "#0a2a55"; c.lineWidth = 1.6; c.stroke();
  };
  M.luciole = (c, x, y) => { ell(c, x, y - 26, 16, 16, rad(c, x, y - 26, 1, x, y - 26, 16, [[0, "rgba(230,255,140,.95)"], [1, "rgba(230,255,140,0)"]])); ell(c, x, y - 26, 4, 4, "#f8ffb0"); ell(c, x - 4, y - 30, 4, 2, "rgba(255,255,255,.7)"); ell(c, x + 4, y - 30, 4, 2, "rgba(255,255,255,.7)"); };

  // ─── Monts du Vent et Tour du Vent ───
  DD.GROUND.glace = (c, x, y) => {
    diamond(c, x, y); c.fillStyle = lin(c, x - 64, y - 32, x + 64, y + 32, [[0, "#e8f6ff"], [1, "#a8d4ee"]]); c.fill();
    c.save(); diamond(c, x, y); c.clip();
    for (let k = 0; k < 4; k++) { const ox = (k - 1.5) * 30; line(c, x + ox - 20, y + 8, x + ox + 18, y - 10, "rgba(255,255,255,.75)", 2); }
    line(c, x - 30, y + 4, x - 4, y - 8, "rgba(120,170,210,.5)", 1); line(c, x + 10, y + 10, x + 30, y, "rgba(120,170,210,.5)", 1);
    c.restore();
  };
  M.tourVent = (c, x, y) => {
    shadow(c, x, y + 8, 80, 26);
    cylindre(c, x, y, 58, 26, 22, "#8a857c", "#a8a297", "#2a2830");
    const body = (yy, r0, r1, H) => { c.beginPath(); c.moveTo(x - r0, yy); c.lineTo(x - r1, yy - H); c.lineTo(x + r1, yy - H); c.lineTo(x + r0, yy); c.ellipse(x, yy, r0, r0 * .45, 0, 0, Math.PI); c.closePath(); };
    body(y - 22, 46, 36, 190); c.fillStyle = lin(c, x - 46, 0, x + 46, 0, [[0, "#d8d2c6"], [.5, "#b8b2a6"], [1, "#7d776c"]]); c.fill(); c.strokeStyle = "#2a2830"; c.lineWidth = 2; c.stroke();
    for (let k = 1; k < 9; k++) { const yy = y - 22 - k * 21, r = 46 - 10 * k * 21 / 190; c.beginPath(); c.ellipse(x, yy, r, r * .45, 0, 0, Math.PI); c.strokeStyle = "rgba(40,35,30,.3)"; c.lineWidth = 1.4; c.stroke(); }
    c.beginPath(); c.moveTo(x - 14, y - 6); c.lineTo(x - 14, y - 50); c.arc(x, y - 50, 14, Math.PI, 0); c.lineTo(x + 14, y - 2); c.closePath(); c.fillStyle = "#050406"; c.fill(); c.strokeStyle = "#2a2830"; c.stroke();
    for (const [dx, dy] of [[-12, -110], [16, -150], [-6, -185]]) { c.beginPath(); c.roundRect(x + dx - 5, y + dy, 10, 16, 5); c.fillStyle = "#fff4b0"; c.fill(); c.strokeStyle = "#2a2830"; c.lineWidth = 1.5; c.stroke(); }
    c.beginPath(); c.moveTo(x - 44, y - 212); c.lineTo(x, y - 290); c.lineTo(x + 44, y - 212); c.ellipse(x, y - 212, 44, 16, 0, 0, Math.PI); c.closePath();
    c.fillStyle = lin(c, x - 44, 0, x + 44, 0, [[0, "#5a8ad8"], [1, "#2a4a98"]]); c.fill(); c.strokeStyle = "#16244a"; c.lineWidth = 2; c.stroke();
    poly(c, [[x - 44, y - 212], [x - 20, y - 236], [x + 20, y - 236], [x + 44, y - 212], [x, y - 200]], "rgba(255,255,255,.9)");
    line(c, x, y - 290, x, y - 320, "#3e3a44", 2.5);
    for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x, y - 318 + k * 8); c.quadraticCurveTo(x + 20, y - 324 + k * 8 + Math.sin(k) * 4, x + 40, y - 314 + k * 8); c.strokeStyle = ["#ffd23f", "#6fd0ef", "#ff8fb1"][k]; c.lineWidth = 3; c.stroke(); }
  };
  M.tourbillon = (c, x, y) => {
    ell(c, x, y - 34, 32, 32, rad(c, x, y - 34, 2, x, y - 34, 32, [[0, "rgba(230,240,255,.5)"], [1, "rgba(230,240,255,0)"]]));
    for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(x + Math.sin(k) * 3, y - 10 - k * 13, 20 - k * 3, 6 - k * .6, 0, 0, Math.PI * 1.7); c.strokeStyle = k % 2 ? "#ffffff" : "#b8d4ee"; c.lineWidth = 4; c.lineCap = "round"; c.stroke(); }
    for (const s of [-1, 1]) { ell(c, x + s * 6, y - 34, 3.4, 4.2, "#fff"); c.strokeStyle = "#2a3a5a"; c.lineWidth = 1.2; c.stroke(); ell(c, x + s * 6 + 1, y - 33, 1.8, 2.4, "#1a2a4a"); }
    line(c, x - 10, y - 42, x - 3, y - 40, "#2a3a5a", 2); line(c, x + 10, y - 42, x + 3, y - 40, "#2a3a5a", 2);
  };
  M.edelweiss = (c, x, y) => { shadow(c, x, y + 3, 12, 4); line(c, x, y, x, y - 16, "#6a8a5a", 2); for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; ell(c, x + Math.cos(a) * 6, y - 20 + Math.sin(a) * 4, 5, 2.4, "#ffffff", a); c.strokeStyle = "#c8d0c8"; c.lineWidth = 1; c.stroke(); } ell(c, x, y - 20, 3, 2.4, "#f2d03a"); };
  M.glaceFendue = (c, x, y) => {
    shadow(c, x, y + 4, 50, 18); cubeIso(c, x, y - 26, 54, "#e8f6ff", "#a8d4ee", "#7ab4d8", "#3a6a9a");
    for (const [a, b, e, f] of [[-30, -40, -14, -18], [-14, -18, -22, 4], [10, -30, 24, -6], [24, -6, 18, 14], [-6, -60, 8, -46]]) line(c, x + a, y + b, x + e, y + f, "#2a5a8a", 1.8);
  };
  M.murNeige = (c, x, y) => { M.mur(c, x, y); for (let k = 0; k < 5; k++) ell(c, x - 48 + k * 24, y - 44 - (k % 2) * 6 - 12, 13, 5, "rgba(250,252,255,.95)"); };

  // ─── Côte aux Phares ───
  M.coquillage = (c, x, y) => {
    shadow(c, x, y + 3, 12, 4);
    c.beginPath(); c.moveTo(x, y - 6); for (let k = 0; k <= 8; k++) { const a = Math.PI + k / 8 * Math.PI; c.lineTo(x + Math.cos(a) * 12, y - 12 + Math.sin(a) * 12); } c.closePath();
    c.fillStyle = lin(c, x - 12, y - 24, x + 12, y - 6, [[0, "#ffe0d0"], [1, "#f0a08a"]]); c.fill(); c.strokeStyle = "#a8604a"; c.lineWidth = 1.4; c.stroke();
    for (let k = 1; k < 8; k++) { const a = Math.PI + k / 8 * Math.PI; line(c, x, y - 6, x + Math.cos(a) * 11, y - 12 + Math.sin(a) * 11, "rgba(168,96,74,.6)", 1); }
  };
  M.murPhare = (c, x, y) => { M.mur(c, x, y); const t = y - 44; poly(c, [[x - 64, t + 16], [x, t + 48], [x, t + 58], [x - 64, t + 26]], "rgba(200,60,50,.75)"); poly(c, [[x, t + 48], [x + 64, t + 16], [x + 64, t + 26], [x, t + 58]], "rgba(160,40,35,.75)"); };
  DD.M = M;
})();

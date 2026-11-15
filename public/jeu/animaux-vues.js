// Dip Duck — vues de face et de dos des animaux (la vue de profil est dans art/generateur.js).
// DD.VUES[animal].face(c, x, y) et .dos(c, x, y) ; (x, y) = point au sol, comme les profils.
(() => {
  "use strict";
  const DD = window.DD;
  const { ell, poly, line, shadow, eyes, rad } = DD;
  const st = (c, col, w = 2) => { c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
  const legs = (c, x, y, xs, top, col, w) => { for (const dx of xs) line(c, x + dx, y - top, x + dx, y, col, w); };
  const V = {};

  // ─── Mouton ───
  const laine = (c, x, y, pts) => { for (const [dx, dy, r] of pts) ell(c, x + dx, y + dy, r + 2, r + 2, "#8a8478"); for (const [dx, dy, r] of pts) ell(c, x + dx, y + dy, r, r, rad(c, x + dx - 3, y + dy - 3, 1, x + dx, y + dy, r, [[0, "#ffffff"], [1, "#e4ded0"]])); };
  V.mouton = {
    face(c, x, y) { shadow(c, x, y + 2, 24, 8); legs(c, x, y - 3, [-12, 12], 12, "#2a2a2a", 4); legs(c, x, y, [-6, 6], 14, "#2a2a2a", 4.5);
      laine(c, x, y, [[-12, -24, 11], [12, -24, 11], [0, -30, 13], [0, -18, 11]]);
      ell(c, -14 + x, y - 34, 6, 3, "#3a3a3a", -.3); ell(c, 14 + x, y - 34, 6, 3, "#3a3a3a", .3);
      ell(c, x, y - 28, 9, 11, "#3a3a3a"); ell(c, x - 4, y - 31, 2, 2, "#fff"); ell(c, x + 4, y - 31, 2, 2, "#fff"); ell(c, x, y - 22, 3, 1.6, "#1a1a1a");
      laine(c, x, y, [[0, -40, 6], [-5, -38, 4], [5, -38, 4]]); },
    dos(c, x, y) { shadow(c, x, y + 2, 24, 8); legs(c, x, y, [-8, 8], 14, "#2a2a2a", 4.5); legs(c, x, y - 3, [-12, 12], 12, "#2a2a2a", 4);
      ell(c, -14 + x, y - 40, 6, 3, "#3a3a3a", -.3); ell(c, 14 + x, y - 40, 6, 3, "#3a3a3a", .3);
      laine(c, x, y, [[-12, -24, 11], [12, -24, 11], [0, -30, 13], [0, -38, 9], [0, -18, 10]]); laine(c, x, y, [[0, -14, 5]]); },
  };
  // ─── Vache ───
  const taches = (c, list) => { for (const [x, y, r] of list) ell(c, x, y, r, r * .8, "#2a2a2a"); };
  V.vache = {
    face(c, x, y) { shadow(c, x, y + 2, 28, 9); legs(c, x, y - 3, [-15, 15], 18, "#3a3a3a", 5); legs(c, x, y, [-8, 8], 22, "#3a3a3a", 5.5);
      ell(c, x, y - 32, 24, 18, "#fafafa"); st(c, "#2a2a2a"); taches(c, [[x - 14, y - 36, 6], [x + 15, y - 28, 5]]);
      poly(c, [[x - 8, y - 50], [x - 15, y - 58], [x - 12, y - 49]], "#f2e6c8", "#5a4a30", 1.4); poly(c, [[x + 8, y - 50], [x + 15, y - 58], [x + 12, y - 49]], "#f2e6c8", "#5a4a30", 1.4);
      ell(c, x - 16, y - 46, 7, 4, "#fafafa", -.4); st(c, "#2a2a2a", 1.5); ell(c, x + 16, y - 46, 7, 4, "#fafafa", .4); st(c, "#2a2a2a", 1.5);
      ell(c, x, y - 40, 12, 14, "#fafafa"); st(c, "#2a2a2a"); ell(c, x - 5, y - 46, 2.4, 2.4, "#1a1a1a"); ell(c, x + 5, y - 46, 2.4, 2.4, "#1a1a1a");
      ell(c, x, y - 31, 11, 7, "#ffb0b8"); st(c, "#a8505e", 1.5); ell(c, x - 4, y - 31, 1.6, 2, "#7a2a3a"); ell(c, x + 4, y - 31, 1.6, 2, "#7a2a3a"); },
    dos(c, x, y) { shadow(c, x, y + 2, 28, 9); legs(c, x, y, [-9, 9], 22, "#3a3a3a", 5.5); legs(c, x, y - 3, [-15, 15], 18, "#3a3a3a", 5);
      poly(c, [[x - 8, y - 48], [x - 15, y - 57], [x - 12, y - 47]], "#f2e6c8", "#5a4a30", 1.4); poly(c, [[x + 8, y - 48], [x + 15, y - 57], [x + 12, y - 47]], "#f2e6c8", "#5a4a30", 1.4); ell(c, x - 13, y - 46, 6, 3.5, "#fafafa", -.4); st(c, "#2a2a2a", 1.4); ell(c, x + 13, y - 46, 6, 3.5, "#fafafa", .4); st(c, "#2a2a2a", 1.4);
      ell(c, x, y - 32, 24, 19, "#fafafa"); st(c, "#2a2a2a"); taches(c, [[x - 10, y - 40, 7], [x + 12, y - 30, 6], [x - 4, y - 24, 4]]);
      line(c, x, y - 30, x, y - 8, "#2a2a2a", 2); ell(c, x, y - 7, 3, 4, "#2a2a2a"); },
  };
  // ─── Cheval ───
  V.cheval = {
    face(c, x, y) { shadow(c, x, y + 2, 26, 8); legs(c, x, y - 3, [-12, 12], 26, "#6b4426", 5); legs(c, x, y, [-6, 6], 30, "#6b4426", 5.5); for (const dx of [-6, 6]) ell(c, x + dx, y, 3.5, 2, "#2a1a0a");
      ell(c, x, y - 40, 20, 16, "#a8693a"); st(c, "#3a2410");
      poly(c, [[x - 7, y - 50], [x + 7, y - 50], [x + 6, y - 66], [x - 6, y - 66]], "#a8693a", "#3a2410", 1.6);
      ell(c, x, y - 72, 9, 17, "#b8784a"); st(c, "#3a2410"); ell(c, x, y - 60, 7, 6, "#e8c8a0");
      ell(c, x - 3, y - 61, 1.4, 1.8, "#3a2410"); ell(c, x + 3, y - 61, 1.4, 1.8, "#3a2410"); ell(c, x - 6, y - 76, 2, 2.2, "#1a1a1a"); ell(c, x + 6, y - 76, 2, 2.2, "#1a1a1a");
      poly(c, [[x - 7, y - 86], [x - 9, y - 96], [x - 3, y - 88]], "#a8693a", "#3a2410", 1.2); poly(c, [[x + 7, y - 86], [x + 9, y - 96], [x + 3, y - 88]], "#a8693a", "#3a2410", 1.2);
      ell(c, x, y - 88, 4, 5, "#3a2410"); },
    dos(c, x, y) { shadow(c, x, y + 2, 26, 8); legs(c, x, y, [-7, 7], 30, "#6b4426", 5.5); legs(c, x, y - 3, [-12, 12], 26, "#6b4426", 5);
      ell(c, x, y - 72, 8, 14, "#8a5530"); st(c, "#3a2410"); poly(c, [[x - 6, y - 82], [x - 8, y - 92], [x - 2, y - 84]], "#a8693a", "#3a2410", 1.2); poly(c, [[x + 6, y - 82], [x + 8, y - 92], [x + 2, y - 84]], "#a8693a", "#3a2410", 1.2);
      for (let k = 0; k < 5; k++) ell(c, x, y - 60 - k * 5, 3.5, 3, "#3a2410");
      ell(c, x, y - 40, 20, 17, "#a8693a"); st(c, "#3a2410");
      c.beginPath(); c.moveTo(x - 3, y - 44); c.quadraticCurveTo(x - 6, y - 24, x + 2, y - 12); c.strokeStyle = "#3a2410"; c.lineWidth = 7; c.lineCap = "round"; c.stroke(); },
  };
  // ─── Cochon ───
  V.cochon = {
    face(c, x, y) { shadow(c, x, y + 2, 24, 8); legs(c, x, y, [-10, -4, 4, 10], 10, "#d87a8a", 5);
      ell(c, x, y - 20, 22, 16, "#f8b0bc"); st(c, "#a8505e");
      poly(c, [[x - 14, y - 32], [x - 20, y - 42], [x - 8, y - 36]], "#f0909e", "#a8505e", 1.4); poly(c, [[x + 14, y - 32], [x + 20, y - 42], [x + 8, y - 36]], "#f0909e", "#a8505e", 1.4);
      ell(c, x, y - 24, 15, 13, "#ffc8d0"); st(c, "#a8505e"); ell(c, x - 6, y - 29, 2, 2, "#1a1a1a"); ell(c, x + 6, y - 29, 2, 2, "#1a1a1a");
      ell(c, x, y - 20, 8, 6, "#f0909e"); st(c, "#a8505e", 1.5); ell(c, x - 3, y - 20, 1.4, 2, "#7a2a3a"); ell(c, x + 3, y - 20, 1.4, 2, "#7a2a3a"); },
    dos(c, x, y) { shadow(c, x, y + 2, 24, 8); legs(c, x, y, [-10, -4, 4, 10], 10, "#d87a8a", 5);
      poly(c, [[x - 12, y - 34], [x - 16, y - 44], [x - 6, y - 36]], "#f0909e", "#a8505e", 1.4); poly(c, [[x + 12, y - 34], [x + 16, y - 44], [x + 6, y - 36]], "#f0909e", "#a8505e", 1.4);
      ell(c, x, y - 21, 22, 17, "#f8b0bc"); st(c, "#a8505e"); ell(c, x, y - 26, 12, 7, "rgba(255,230,235,.5)");
      c.beginPath(); c.arc(x, y - 16, 4, 0, Math.PI * 1.7); st(c, "#a8505e", 2.2); },
  };
  // ─── Chèvre ───
  V.chevre = {
    face(c, x, y) { shadow(c, x, y + 2, 20, 7); legs(c, x, y - 3, [-10, 10], 16, "#5a5550", 3); legs(c, x, y, [-5, 5], 18, "#5a5550", 3.4);
      ell(c, x, y - 28, 15, 12, "#ece6d8"); st(c, "#5a5550");
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 5, y - 52); c.quadraticCurveTo(x + s * 14, y - 66, x + s * 18, y - 56); st(c, "#7a6a50", 3); ell(c, x + s * 12, y - 47, 6, 3, "#ece6d8", s * .4); st(c, "#5a5550", 1.2); }
      ell(c, x, y - 44, 8, 11, "#f4f0e6"); st(c, "#5a5550"); ell(c, x - 4, y - 47, 1.8, 1.8, "#1a1a1a"); ell(c, x + 4, y - 47, 1.8, 1.8, "#1a1a1a"); ell(c, x, y - 38, 2.4, 1.4, "#5a5550");
      poly(c, [[x - 3, y - 35], [x + 3, y - 35], [x, y - 26]], "#ece6d8", "#5a5550", 1.2); },
    dos(c, x, y) { shadow(c, x, y + 2, 20, 7); legs(c, x, y, [-5, 5], 18, "#5a5550", 3.4); legs(c, x, y - 3, [-10, 10], 16, "#5a5550", 3);
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 4, y - 48); c.quadraticCurveTo(x + s * 12, y - 62, x + s * 16, y - 52); st(c, "#7a6a50", 3); }
      ell(c, x, y - 44, 7, 8, "#d8d2c4"); st(c, "#5a5550", 1.4);
      ell(c, x, y - 28, 15, 13, "#ece6d8"); st(c, "#5a5550"); poly(c, [[x - 3, y - 34], [x + 3, y - 34], [x, y - 44]], "#ece6d8", "#5a5550", 1.2); },
  };
  // ─── Cerf ───
  const bois = (c, x, y, s) => { const bx = x + s * 4; c.beginPath(); c.moveTo(bx, y); c.lineTo(bx + s * 8, y - 20); c.moveTo(bx + s * 4, y - 10); c.lineTo(bx + s * 14, y - 14); c.moveTo(bx + s * 7, y - 17); c.lineTo(bx + s * 4, y - 28); c.strokeStyle = "#6b4426"; c.lineWidth = 3; c.lineCap = "round"; c.stroke(); };
  V.cerf = {
    face(c, x, y) { shadow(c, x, y + 2, 22, 7); legs(c, x, y - 3, [-10, 10], 28, "#7a4a24", 3.4); legs(c, x, y, [-5, 5], 32, "#7a4a24", 3.6);
      ell(c, x, y - 42, 16, 13, "#b8784a"); st(c, "#3a2410"); ell(c, x, y - 40, 7, 8, "#f4e6c8");
      poly(c, [[x - 6, y - 50], [x + 6, y - 50], [x + 5, y - 62], [x - 5, y - 62]], "#b8784a", "#3a2410", 1.4);
      bois(c, x - 4, y - 78, -1); bois(c, x + 4, y - 78, 1);
      ell(c, x - 11, y - 74, 6, 3, "#b8784a", -.4); ell(c, x + 11, y - 74, 6, 3, "#b8784a", .4);
      ell(c, x, y - 70, 8, 11, "#c8884a"); st(c, "#3a2410"); ell(c, x, y - 62, 4, 3, "#2a1a0a"); ell(c, x - 4, y - 73, 1.8, 2, "#1a1a1a"); ell(c, x + 4, y - 73, 1.8, 2, "#1a1a1a"); },
    dos(c, x, y) { shadow(c, x, y + 2, 22, 7); legs(c, x, y, [-5, 5], 32, "#7a4a24", 3.6); legs(c, x, y - 3, [-10, 10], 28, "#7a4a24", 3.4);
      bois(c, x - 4, y - 76, -1); bois(c, x + 4, y - 76, 1); ell(c, x, y - 68, 7, 9, "#94582c"); st(c, "#3a2410", 1.4);
      ell(c, x, y - 42, 16, 14, "#b8784a"); st(c, "#3a2410"); ell(c, x, y - 36, 9, 8, "#fff4e0"); ell(c, x, y - 42, 3, 4, "#7a4a24"); },
  };
  // ─── Lapin ───
  V.lapin = {
    face(c, x, y) { shadow(c, x, y + 1, 14, 5); ell(c, x, y - 11, 12, 11, "#b8b0a4"); st(c, "#5a5550", 1.6); ell(c, x, y - 9, 6, 7, "#f4f0e6");
      for (const s of [-1, 1]) { ell(c, x + s * 4, y - 38, 3, 10, "#c4bcb0", s * .1); st(c, "#5a5550", 1.4); ell(c, x + s * 4, y - 38, 1.4, 7, "#f0b0b8", s * .1); }
      ell(c, x, y - 25, 9, 8, "#c4bcb0"); st(c, "#5a5550", 1.6); ell(c, x - 3.5, y - 27, 1.6, 1.8, "#1a1a1a"); ell(c, x + 3.5, y - 27, 1.6, 1.8, "#1a1a1a"); ell(c, x, y - 23, 1.6, 1.2, "#f08aa0");
      for (const s of [-1, 1]) line(c, x + s * 3, y - 23, x + s * 10, y - 24, "#8a8478", .8); },
    dos(c, x, y) { shadow(c, x, y + 1, 14, 5); for (const s of [-1, 1]) { ell(c, x + s * 4, y - 38, 3, 10, "#b8b0a4", s * .1); st(c, "#5a5550", 1.4); }
      ell(c, x, y - 25, 8, 7, "#b8b0a4"); st(c, "#5a5550", 1.4); ell(c, x, y - 11, 12, 11, "#b8b0a4"); st(c, "#5a5550", 1.6); ell(c, x, y - 6, 4.5, 4.5, "#ffffff"); },
  };
  // ─── Renard ───
  V.renard = {
    face(c, x, y) { shadow(c, x, y + 2, 18, 6);
      c.beginPath(); c.moveTo(x + 8, y - 10); c.quadraticCurveTo(x + 26, y - 14, x + 22, y - 2); c.quadraticCurveTo(x + 14, y, x + 8, y - 4); c.fillStyle = "#e8742a"; c.fill(); st(c, "#6a2a0a", 1.4); ell(c, x + 22, y - 3, 4, 3, "#fff");
      legs(c, x, y, [-5, 5], 10, "#2a1a10", 3.4); ell(c, x, y - 18, 11, 10, "#e8742a"); st(c, "#6a2a0a", 1.6); ell(c, x, y - 15, 6, 7, "#fff4e6");
      poly(c, [[x - 10, y - 32], [x - 9, y - 44], [x - 3, y - 34]], "#e8742a", "#6a2a0a", 1.4); poly(c, [[x + 10, y - 32], [x + 9, y - 44], [x + 3, y - 34]], "#e8742a", "#6a2a0a", 1.4);
      ell(c, x, y - 30, 11, 9, "#e8742a"); st(c, "#6a2a0a", 1.6); poly(c, [[x - 9, y - 28], [x, y - 20], [x + 9, y - 28], [x, y - 25]], "#fff4e6");
      ell(c, x - 4, y - 32, 1.6, 2, "#1a1a1a"); ell(c, x + 4, y - 32, 1.6, 2, "#1a1a1a"); ell(c, x, y - 21, 2, 1.6, "#1a1a1a"); },
    dos(c, x, y) { shadow(c, x, y + 2, 18, 6); legs(c, x, y, [-5, 5], 10, "#2a1a10", 3.4);
      poly(c, [[x - 9, y - 30], [x - 8, y - 42], [x - 3, y - 32]], "#e8742a", "#6a2a0a", 1.4); poly(c, [[x + 9, y - 30], [x + 8, y - 42], [x + 3, y - 32]], "#e8742a", "#6a2a0a", 1.4);
      ell(c, x, y - 29, 10, 8, "#d8642a"); st(c, "#6a2a0a", 1.4); ell(c, x, y - 18, 11, 10, "#e8742a"); st(c, "#6a2a0a", 1.6);
      c.beginPath(); c.moveTo(x - 6, y - 16); c.quadraticCurveTo(x - 4, y + 6, x, y + 8); c.quadraticCurveTo(x + 4, y + 6, x + 6, y - 16); c.fillStyle = "#e8742a"; c.fill(); st(c, "#6a2a0a", 1.4); ell(c, x, y + 4, 4, 4, "#fff"); },
  };
  // ─── Écureuil ───
  const queue = (c, x, y, s) => { c.beginPath(); c.moveTo(x, y - 4); c.quadraticCurveTo(x + s * 22, y - 8, x + s * 18, y - 34); c.quadraticCurveTo(x + s * 12, y - 46, x + s * 4, y - 36); c.quadraticCurveTo(x + s * 12, y - 22, x, y - 10); c.fillStyle = "#c8642a"; c.fill(); st(c, "#6a2a0a", 1.5); };
  V.ecureuil = {
    face(c, x, y) { shadow(c, x, y + 1, 12, 4); queue(c, x + 4, y, 1); ell(c, x, y - 12, 9, 11, "#d8743a"); st(c, "#6a2a0a", 1.5); ell(c, x, y - 10, 5, 7, "#fff0d8");
      ell(c, x, y - 26, 8, 7, "#d8743a"); st(c, "#6a2a0a", 1.5); for (const s of [-1, 1]) poly(c, [[x + s * 7, y - 30], [x + s * 6, y - 38], [x + s * 2, y - 32]], "#d8743a", "#6a2a0a", 1.2);
      ell(c, x - 3, y - 27, 1.5, 1.6, "#1a1a1a"); ell(c, x + 3, y - 27, 1.5, 1.6, "#1a1a1a"); ell(c, x, y - 23, 1.4, 1, "#3a1a0a"); ell(c, x, y - 15, 3.4, 4, "#8a5a2a"); },
    dos(c, x, y) { shadow(c, x, y + 1, 12, 4); ell(c, x, y - 26, 8, 7, "#c8642a"); st(c, "#6a2a0a", 1.5); for (const s of [-1, 1]) poly(c, [[x + s * 7, y - 30], [x + s * 6, y - 38], [x + s * 2, y - 32]], "#c8642a", "#6a2a0a", 1.2);
      ell(c, x, y - 12, 9, 11, "#d8743a"); st(c, "#6a2a0a", 1.5);
      c.beginPath(); c.moveTo(x - 6, y - 4); c.quadraticCurveTo(x - 10, y - 30, x, y - 44); c.quadraticCurveTo(x + 10, y - 30, x + 6, y - 4); c.closePath(); c.fillStyle = "#c8642a"; c.fill(); st(c, "#6a2a0a", 1.5); },
  };
  // ─── Poule ───
  V.poule = {
    face(c, x, y) { shadow(c, x, y, 12, 4); line(c, x - 3, y, x - 3, y - 8, "#f2a530", 2); line(c, x + 3, y, x + 3, y - 8, "#f2a530", 2);
      ell(c, x, y - 15, 11, 10, "#fff"); st(c, "#8a8070", 1.6); ell(c, x, y - 26, 7, 7, "#fff"); st(c, "#8a8070", 1.4);
      poly(c, [[x - 3, y - 32], [x, y - 37], [x + 3, y - 32]], "#e0362f"); poly(c, [[x - 2.5, y - 25], [x + 2.5, y - 25], [x, y - 21]], "#f2a530"); ell(c, x, y - 19, 1.6, 2.4, "#e0362f");
      ell(c, x - 3, y - 27, 1.3, 1.3, "#1a1a1a"); ell(c, x + 3, y - 27, 1.3, 1.3, "#1a1a1a"); },
    dos(c, x, y) { shadow(c, x, y, 12, 4); line(c, x - 3, y, x - 3, y - 8, "#f2a530", 2); line(c, x + 3, y, x + 3, y - 8, "#f2a530", 2);
      ell(c, x, y - 26, 6.5, 6.5, "#fff"); st(c, "#8a8070", 1.4); poly(c, [[x - 3, y - 31], [x, y - 36], [x + 3, y - 31]], "#e0362f");
      ell(c, x, y - 15, 11, 10, "#fff"); st(c, "#8a8070", 1.6); for (const dx of [-3, 0, 3]) ell(c, x + dx, y - 22, 2.4, 6, "#f4f0e6", dx * .06); },
  };
  DD.VUES = V;
  void eyes;
})();

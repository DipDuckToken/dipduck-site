// Cartes de collection « style NFT » : chaque éclosion donne une carte unique.
// Les choix du joueur (nom, humeur, élément, nombre porte-bonheur) et un tirage
// aléatoire passent dans un hachage SHA-256 qui décide des attributs. Certains
// choix influencent discrètement certaines chances (les « secrets ») : le joueur
// sait que ses choix comptent, pas comment. Ces cartes-là ne sont pas enregistrées
// sur une blockchain ; le moteur de dessin sert aussi aux vrais NFT (nft.js), dont
// les attributs viennent du contrat DipDuckCards (mêmes tables de poids).
const DipCards = (() => {
  const canvas = document.getElementById("card-canvas");
  // Canvas de dessin en cours : celui de la page, ou celui passé à render().
  let ctx = canvas?.getContext("2d");
  const S = 1080;
  const form = document.getElementById("card-form");

  // Attributs : clé de traduction et poids sur 1000 (plus le poids est faible, plus c'est rare).
  const TRAITS = {
    bg: [["pond", 300], ["sunset", 220], ["candles", 180], ["night", 140], ["crash", 90], ["vault", 50], ["cosmic", 18], ["diamond", 2]],
    duck: [["classic", 520], ["midnight", 180], ["ice", 140], ["ember", 90], ["shadow", 45], ["golden", 20], ["alien", 5]],
    hat: [["none", 450], ["cap", 200], ["party", 150], ["crown", 90], ["halo", 60], ["wizard", 40], ["tophat", 10]],
    eyes: [["none", 700], ["laser", 120], ["stars", 100], ["hearts", 60], ["diamond", 20]],
    neck: [["none", 600], ["chain", 220], ["bowtie", 130], ["diamondchain", 50]],
    aura: [["none", 500], ["bubbles", 200], ["coins", 150], ["sparkles", 100], ["holo", 40], ["lightning", 10]],
    frame: [["bronze", 500], ["silver", 300], ["gold", 150], ["holo", 45], ["obsidian", 5]],
    cheeks: [["none", 600], ["blush", 250], ["freckles", 100], ["warpaint", 50]],
    item: [["none", 500], ["coin", 180], ["rocket", 130], ["diamond", 80], ["trophy", 60], ["moon", 30], ["egg", 20]],
    weather: [["none", 550], ["rain", 160], ["snow", 130], ["confetti", 120], ["meteor", 40]],
  };
  const ORDER = Object.keys(TRAITS);

  // Les secrets : multiplicateurs de poids selon les choix. Ils changent les chances,
  // pas la rareté affichée (calculée sur les poids de base, identiques pour tous).
  function secrets({ name, mood, element, lucky }) {
    const boost = {};
    const add = (trait, value, factor) => {
      boost[`${trait}.${value}`] = (boost[`${trait}.${value}`] ?? 1) * factor;
    };
    if (element === "fire") add("eyes", "laser", 2);
    if (element === "ice") add("duck", "ice", 2);
    if (element === "water") add("aura", "bubbles", 2);
    if (element === "thunder") add("aura", "lightning", 3);
    if (mood === "sleepy") add("bg", "night", 2);
    if (mood === "brave") add("hat", "crown", 1.5);
    if (mood === "hungry") add("aura", "coins", 2);
    if (mood === "calm") add("hat", "halo", 2);
    if (String(lucky).includes("7")) {
      add("frame", "gold", 1.5);
      add("frame", "holo", 1.5);
    }
    if (element === "thunder") add("weather", "meteor", 2);
    if (element === "ice") add("weather", "snow", 2);
    if (mood === "hungry") add("item", "egg", 2);
    if (mood === "brave") add("cheeks", "warpaint", 2);
    if (mood === "calm") add("cheeks", "blush", 1.5);
    if (Number(lucky) === 777) add("item", "moon", 3);
    if (name.trim().toLowerCase() === "satoshi") add("duck", "golden", 3);
    return boost;
  }

  // ─── Rareté ───────────────────────────────────────────────────────────────
  const probability = (trait, value) => TRAITS[trait].find(([key]) => key === value)[1] / 1000;
  const rarityScore = (card) => ORDER.reduce((sum, trait) => sum - Math.log2(probability(trait, card[trait])), 0);

  // Répartition des scores, simulée une fois : sert à dire « top X % ».
  const DISTRIBUTION = (() => {
    const scores = [];
    for (let i = 0; i < 20_000; i++) {
      const card = {};
      for (const trait of ORDER) card[trait] = pick(TRAITS[trait], Math.random());
      scores.push(rarityScore(card));
    }
    return scores.sort((a, b) => b - a);
  })();

  function topPercent(score) {
    let low = 0;
    let high = DISTRIBUTION.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      DISTRIBUTION[mid] > score ? (low = mid + 1) : (high = mid);
    }
    return Math.max(0.01, (low / DISTRIBUTION.length) * 100);
  }

  const TIERS = [
    [1, "legendary", "#ff8a3d"],
    [5, "epic", "#c084fc"],
    [15, "rare", "#5ab8ff"],
    [40, "uncommon", "#ffd23f"],
    [100, "common", "#b3c0d3"],
  ];
  const tierOf = (top) => TIERS.find(([limit]) => top <= limit);
  // Édition Trophée (prix de concours) : tirée à part par le contrat, sans les options les
  // plus communes, donc toujours dans le top 5 % ; le palier affiché ne descend jamais sous « épique ».
  const tierOfCard = (card) => tierOf(card.trophy ? Math.min(card.top, 5) : card.top);
  const TROPHY_GOLD = "#ffd23f";

  // Étoiles d'un attribut : 1 (courant) à 5 (introuvable).
  function stars(p) {
    return p >= 0.3 ? 1 : p >= 0.12 ? 2 : p >= 0.05 ? 3 : p >= 0.015 ? 4 : 5;
  }

  function pick(options, unit, boost = {}, trait = "") {
    const weights = options.map(([key, weight]) => weight * (boost[`${trait}.${key}`] ?? 1));
    let roll = unit * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < options.length; i++) {
      roll -= weights[i];
      if (roll < 0) return options[i][0];
    }
    return options.at(-1)[0];
  }

  async function hatch(inputs) {
    const nonce = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const encode = (salt) => new TextEncoder().encode(JSON.stringify({ ...inputs, nonce, salt }));
    // Deux hachages SHA-256 : 64 octets, de quoi tirer chaque attribut indépendamment.
    const bytes = new Uint8Array(64);
    bytes.set(new Uint8Array(await crypto.subtle.digest("SHA-256", encode(0))), 0);
    bytes.set(new Uint8Array(await crypto.subtle.digest("SHA-256", encode(1))), 32);
    const view = new DataView(bytes.buffer);
    const boost = secrets(inputs);
    const card = {
      serial: [...bytes.slice(0, 3)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase(),
      name: inputs.name,
      mood: inputs.mood,
      element: inputs.element,
    };
    ORDER.forEach((trait, i) => {
      card[trait] = pick(TRAITS[trait], view.getUint32(4 + i * 4) / 2 ** 32, boost, trait);
    });
    card.top = topPercent(rarityScore(card));
    return card;
  }

  // ─── Dessin ───────────────────────────────────────────────────────────────
  const FRAMES = {
    bronze: ["#8a5a2b", "#d29a5c"],
    silver: ["#8d99ae", "#e9eef5"],
    gold: ["#c98a00", "#ffe066"],
    holo: ["#ff7ad9", "#5ab8ff", "#ffd23f", "#c084fc"],
    obsidian: ["#05070c", "#3a3f4b"],
  };
  const DUCK_FILTERS = {
    classic: "none",
    midnight: "brightness(0.72) saturate(1.25)",
    ice: "hue-rotate(170deg) saturate(0.9) brightness(1.05)",
    ember: "hue-rotate(-22deg) saturate(1.7)",
    shadow: "grayscale(1) contrast(1.25)",
    golden: "sepia(1) saturate(3.2) brightness(1.08)",
    alien: "hue-rotate(255deg) saturate(1.6)",
  };
  // Repères sur le badge de la mascotte (fractions de sa taille).
  const HEAD_TOP = { x: 0.5, y: 0.25 };
  const LENSES = [{ x: 0.33, y: 0.45 }, { x: 0.53, y: 0.45 }];
  const NECK = { x: 0.52, y: 0.73 };
  const CHEEKS = [{ x: 0.6, y: 0.55 }, { x: 0.2, y: 0.52 }];
  const BILL_TIP = { x: 0.2, y: 0.6 };

  function seeded(seedText) {
    let h = 2166136261;
    for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
      h = Math.imul(h ^ (h >>> 15), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 2 ** 32;
    };
  }

  function background(kind, rnd) {
    const g = (stops, x0 = 0, y0 = 0, x1 = 0, y1 = S) => {
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
      return grad;
    };
    switch (kind) {
      case "sunset":
        ctx.fillStyle = g(["#ff9a3d", "#e5484d", "#5b2a6e", "#1d1b3a"]);
        ctx.fillRect(0, 0, S, S);
        break;
      case "candles":
        DD.pond(ctx, S, S);
        DD.candles(ctx, 40, 200, S - 80, 600, [0.8, 0.6, 0.7, 0.4, 0.3, 0.5, 0.2, 0.35, 0.6, 0.75, 0.9], { alpha: 0.3 });
        break;
      case "night":
        ctx.fillStyle = g(["#05070f", "#111a33"]);
        ctx.fillRect(0, 0, S, S);
        starsField(rnd, 140, "#ffffff");
        ctx.fillStyle = "#fff4c2";
        ctx.beginPath();
        ctx.arc(860, 220, 70, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#111a33";
        ctx.beginPath();
        ctx.arc(890, 200, 64, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "crash":
        ctx.fillStyle = g(["#2a0a10", "#120509"]);
        ctx.fillRect(0, 0, S, S);
        DD.candles(ctx, 20, 120, S - 40, 760, [1, 0.85, 0.9, 0.6, 0.65, 0.35, 0.4, 0.15, 0.2, 0.02], { alpha: 0.55 });
        break;
      case "vault":
        ctx.fillStyle = g(["#3b2a00", "#b07d00", "#ffe066", "#b07d00"], 0, 0, S, S);
        ctx.fillRect(0, 0, S, S);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#ffffff";
        for (let x = -S; x < S; x += 140) ctx.fillRect(x + S * 0.4, 0, 40, S * 2);
        ctx.globalAlpha = 1;
        break;
      case "cosmic": {
        ctx.fillStyle = "#0a0420";
        ctx.fillRect(0, 0, S, S);
        for (const [x, y, r, c] of [[300, 300, 520, "rgba(192,132,252,0.55)"], [800, 700, 480, "rgba(90,184,255,0.45)"], [600, 200, 300, "rgba(255,122,217,0.35)"]]) {
          const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, c);
          rg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = rg;
          ctx.fillRect(0, 0, S, S);
        }
        starsField(rnd, 220, "#ffffff");
        break;
      }
      case "diamond":
        ctx.fillStyle = g(["#e6fbff", "#9be7ff", "#c7d2fe"], 0, 0, S, S);
        ctx.fillRect(0, 0, S, S);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 26; i++) {
          ctx.beginPath();
          ctx.moveTo(rnd() * S, rnd() * S);
          ctx.lineTo(rnd() * S, rnd() * S);
          ctx.lineTo(rnd() * S, rnd() * S);
          ctx.closePath();
          ctx.stroke();
        }
        break;
      default:
        DD.pond(ctx, S, S);
        DD.water(ctx, S, S - 140, 20);
    }
  }

  function starsField(rnd, count, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = 0.3 + rnd() * 0.7;
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, rnd() * 2.6 + 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function sparkle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rr = i % 2 ? r * 0.28 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function heart(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.5);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    ctx.fill();
  }

  function hat(kind, at, size) {
    const x = at.x;
    const y = at.y;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = 8;
    ctx.strokeStyle = DD.NAVY;
    switch (kind) {
      case "cap":
        ctx.fillStyle = DD.ORANGE;
        ctx.beginPath();
        ctx.ellipse(x, y + 10, size * 0.28, size * 0.2, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(x + size * 0.22, y + 10, size * 0.2, size * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case "party":
        ctx.fillStyle = "#c084fc";
        ctx.beginPath();
        ctx.moveTo(x - size * 0.16, y + 14);
        ctx.lineTo(x + size * 0.16, y + 14);
        ctx.lineTo(x + 8, y - size * 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = DD.YELLOW;
        ctx.beginPath();
        ctx.arc(x + 8, y - size * 0.42, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case "crown": {
        ctx.fillStyle = "#ffcc33";
        const w = size * 0.36;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y + 16);
        ctx.lineTo(x - w / 2, y - 60);
        ctx.lineTo(x - w / 4, y - 18);
        ctx.lineTo(x, y - 82);
        ctx.lineTo(x + w / 4, y - 18);
        ctx.lineTo(x + w / 2, y - 60);
        ctx.lineTo(x + w / 2, y + 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        for (const [dx, c] of [[-w / 4, "#e5484d"], [0, "#5ab8ff"], [w / 4, "#e5484d"]]) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(x + dx, y - 2, 11, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "halo":
        ctx.shadowColor = "#ffe066";
        ctx.shadowBlur = 40;
        ctx.strokeStyle = "#ffe066";
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.ellipse(x, y - 50, size * 0.22, size * 0.06, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case "wizard":
        ctx.fillStyle = "#3b2a8f";
        ctx.beginPath();
        ctx.moveTo(x - size * 0.24, y + 18);
        ctx.lineTo(x + size * 0.24, y + 18);
        ctx.lineTo(x - 30, y - size * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        sparkle(x - 6, y - 70, 22, DD.YELLOW);
        sparkle(x + 40, y - 10, 14, DD.YELLOW);
        break;
      case "tophat":
        ctx.fillStyle = "#11141c";
        ctx.fillRect(x - size * 0.14, y - size * 0.34, size * 0.28, size * 0.34);
        ctx.strokeRect(x - size * 0.14, y - size * 0.34, size * 0.28, size * 0.34);
        ctx.fillRect(x - size * 0.24, y - 6, size * 0.48, 22);
        ctx.strokeRect(x - size * 0.24, y - 6, size * 0.48, 22);
        ctx.fillStyle = DD.YELLOW;
        ctx.fillRect(x - size * 0.14 + 4, y - 40, size * 0.28 - 8, 18);
        break;
    }
    ctx.restore();
  }

  function eyes(kind, lenses, size) {
    ctx.save();
    for (const lens of lenses) {
      if (kind === "laser") {
        ctx.shadowColor = "#ff2d55";
        ctx.shadowBlur = 30;
        ctx.strokeStyle = "rgba(255,45,85,0.9)";
        ctx.lineWidth = 16;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lens.x, lens.y);
        ctx.lineTo(S + 40, lens.y - 160 - (lens.x - S / 2) * 0.1);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 5;
        ctx.stroke();
      } else if (kind === "stars") {
        sparkle(lens.x, lens.y, size * 0.05, "#ffffff");
      } else if (kind === "hearts") {
        heart(lens.x, lens.y, size * 0.035, "#ff5c8a");
      } else if (kind === "diamond") {
        ctx.shadowColor = "#9be7ff";
        ctx.shadowBlur = 25;
        sparkle(lens.x, lens.y, size * 0.06, "#e6fbff");
      }
    }
    ctx.restore();
  }

  function neck(kind, at, size) {
    if (kind === "none") return;
    ctx.save();
    if (kind === "bowtie") {
      ctx.fillStyle = "#e5484d";
      ctx.strokeStyle = DD.NAVY;
      ctx.lineWidth = 6;
      const w = size * 0.1;
      ctx.beginPath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(at.x - w, at.y - w * 0.6);
      ctx.lineTo(at.x - w, at.y + w * 0.6);
      ctx.closePath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(at.x + w, at.y - w * 0.6);
      ctx.lineTo(at.x + w, at.y + w * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(at.x, at.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Chaîne : maillons le long d'un arc ; version diamant pour la plus rare.
      const diamond = kind === "diamondchain";
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI * (0.15 + (0.7 * i) / 16);
        const x = at.x + Math.cos(a) * size * 0.2;
        const y = at.y - 40 + Math.sin(a) * size * 0.1;
        ctx.fillStyle = diamond ? "#e6fbff" : "#ffcc33";
        ctx.strokeStyle = diamond ? "#5ab8ff" : "#8a5a00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, diamond ? 9 : 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (diamond) sparkle(at.x, at.y + 34, 26, "#ffffff");
    }
    ctx.restore();
  }

  function aura(kind, rnd, behind) {
    ctx.save();
    if (behind && kind === "holo") {
      const rg = ctx.createLinearGradient(0, 0, S, S);
      ["#ff7ad9", "#5ab8ff", "#ffd23f", "#c084fc", "#ff7ad9"].forEach((c, i) => rg.addColorStop(i / 4, c));
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, S, S);
    }
    if (!behind) {
      if (kind === "bubbles") {
        ctx.strokeStyle = "rgba(155,231,255,0.8)";
        ctx.lineWidth = 4;
        for (let i = 0; i < 22; i++) {
          ctx.beginPath();
          ctx.arc(rnd() * S, rnd() * S, 8 + rnd() * 26, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (kind === "coins") {
        for (let i = 0; i < 18; i++) {
          // Autour du canard seulement : le visage reste visible.
          let x;
          let y;
          do {
            x = rnd() * S;
            y = rnd() * S * 0.9;
          } while (Math.hypot(x - S / 2, y - 570) < 330);
          ctx.fillStyle = "#ffcc33";
          ctx.strokeStyle = "#8a5a00";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.ellipse(x, y, 26, 26 * (0.4 + rnd() * 0.6), rnd(), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (kind === "sparkles") {
        for (let i = 0; i < 26; i++) sparkle(rnd() * S, rnd() * S, 8 + rnd() * 20, "rgba(255,255,255,0.9)");
      } else if (kind === "lightning") {
        ctx.strokeStyle = "#ffe066";
        ctx.shadowColor = "#ffe066";
        ctx.shadowBlur = 30;
        ctx.lineWidth = 10;
        ctx.lineJoin = "miter";
        for (const x0 of [140, 940]) {
          ctx.beginPath();
          ctx.moveTo(x0, 80);
          let x = x0;
          for (let y = 80; y < 760; y += 85) {
            x += (rnd() - 0.5) * 120;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // ─── Humeur (toujours visible) ────────────────────────────────────────────
  function mood(kind, at, size) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (kind === "calm") {
      // Ondes paisibles autour du canard et une feuille sur l'eau.
      ctx.strokeStyle = "rgba(155,231,255,0.55)";
      ctx.lineWidth = 6;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath();
        ctx.ellipse(S / 2, at({ x: 0.5, y: 0.92 }).y, size * (0.42 + r * 0.08), 26 + r * 12, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const leaf = at({ x: 0.84, y: 0.86 });
      ctx.fillStyle = DD.YELLOW;
      ctx.beginPath();
      ctx.ellipse(leaf.x, leaf.y, 34, 16, -0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "brave") {
      // Sourcils froncés au-dessus des lunettes et bandeau rouge.
      ctx.strokeStyle = DD.NAVY;
      ctx.lineWidth = 16;
      for (const [x, tilt] of [[0.33, 1], [0.53, -1]]) {
        const p = at({ x, y: 0.365 });
        ctx.beginPath();
        ctx.moveTo(p.x - 44, p.y - 14 * tilt);
        ctx.lineTo(p.x + 44, p.y + 14 * tilt);
        ctx.stroke();
      }
      const band = at({ x: 0.5, y: 0.31 });
      ctx.strokeStyle = DD.RED;
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.ellipse(band.x, band.y + 10, size * 0.2, 30, 0, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(band.x + size * 0.19, band.y + 4);
      ctx.lineTo(band.x + size * 0.27, band.y + 40);
      ctx.moveTo(band.x + size * 0.19, band.y + 4);
      ctx.lineTo(band.x + size * 0.29, band.y - 10);
      ctx.stroke();
    } else if (kind === "sleepy") {
      // Paupières tombantes sur les verres et « Z z z ».
      ctx.fillStyle = "rgba(242,161,0,0.95)";
      ctx.strokeStyle = DD.NAVY;
      ctx.lineWidth = 6;
      for (const x of [0.33, 0.53]) {
        const p = at({ x, y: 0.45 });
        ctx.beginPath();
        ctx.ellipse(p.x, p.y - 8, 62, 34, 0, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      const z = at({ x: 0.78, y: 0.2 });
      ctx.fillStyle = "#ffffff";
      ctx.lineWidth = 8;
      [[0, 0, 64], [56, -60, 48], [96, -110, 36]].forEach(([dx, dy, fs]) => {
        ctx.font = `700 ${fs}px "Fredoka", sans-serif`;
        ctx.strokeText("Z", z.x + dx, z.y + dy);
        ctx.fillText("Z", z.x + dx, z.y + dy);
      });
    } else if (kind === "hungry") {
      // Goutte de bave au bout du bec et pain qui flotte.
      const tip = at(BILL_TIP);
      ctx.fillStyle = "#9be7ff";
      ctx.strokeStyle = DD.NAVY;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.quadraticCurveTo(tip.x - 18, tip.y + 40, tip.x, tip.y + 52);
      ctx.quadraticCurveTo(tip.x + 18, tip.y + 40, tip.x, tip.y);
      ctx.fill();
      ctx.stroke();
      const bread = { x: S - 250, y: 300 };
      ctx.fillStyle = "#e0a05a";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.roundRect(bread.x - 70, bread.y - 40, 140, 80, 36);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(11,21,36,0.6)";
      ctx.lineWidth = 5;
      for (const dx of [-30, 0, 30]) {
        ctx.beginPath();
        ctx.moveTo(bread.x + dx - 10, bread.y - 26);
        ctx.lineTo(bread.x + dx + 10, bread.y + 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function cheeks(kind, spots) {
    if (kind === "none") return;
    ctx.save();
    for (const [i, p] of spots.entries()) {
      const r = i === 0 ? 34 : 24;
      if (kind === "blush") {
        ctx.fillStyle = "rgba(255,92,138,0.45)";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, r * 1.3, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (kind === "freckles") {
        ctx.fillStyle = "rgba(138,90,43,0.85)";
        for (const [dx, dy] of [[-14, -6], [0, 6], [14, -4], [6, -16], [-6, 14]]) {
          ctx.beginPath();
          ctx.arc(p.x + dx * (r / 30), p.y + dy * (r / 30), 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind === "warpaint") {
        ctx.strokeStyle = DD.RED;
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        for (const dy of [-12, 10]) {
          ctx.beginPath();
          ctx.moveTo(p.x - r, p.y + dy);
          ctx.lineTo(p.x + r, p.y + dy - 6);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  // Objet qui flotte à côté du canard, en bas à gauche de la carte.
  function item(kind) {
    if (kind === "none") return;
    const x = 200;
    const y = 800;
    ctx.save();
    ctx.lineWidth = 7;
    ctx.strokeStyle = DD.NAVY;
    ctx.lineJoin = "round";
    switch (kind) {
      case "coin":
        ctx.fillStyle = "#ffcc33";
        ctx.beginPath();
        ctx.arc(x, y, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#8a5a00";
        ctx.font = '700 64px "Fredoka", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("D", x, y + 4);
        break;
      case "rocket":
        ctx.translate(x, y);
        ctx.rotate(0.6);
        ctx.fillStyle = "#e9eef5";
        ctx.beginPath();
        ctx.moveTo(0, -80);
        ctx.quadraticCurveTo(36, -40, 30, 40);
        ctx.lineTo(-30, 40);
        ctx.quadraticCurveTo(-36, -40, 0, -80);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = DD.WATER;
        ctx.beginPath();
        ctx.arc(0, -20, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = DD.ORANGE;
        ctx.beginPath();
        ctx.moveTo(-20, 44);
        ctx.lineTo(0, 100);
        ctx.lineTo(20, 44);
        ctx.fill();
        break;
      case "diamond":
        ctx.fillStyle = "#9be7ff";
        ctx.beginPath();
        ctx.moveTo(x - 60, y - 20);
        ctx.lineTo(x - 30, y - 56);
        ctx.lineTo(x + 30, y - 56);
        ctx.lineTo(x + 60, y - 20);
        ctx.lineTo(x, y + 60);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        sparkle(x + 40, y - 60, 18, "#ffffff");
        break;
      case "trophy":
        ctx.fillStyle = "#ffcc33";
        ctx.beginPath();
        ctx.moveTo(x - 50, y - 60);
        ctx.lineTo(x + 50, y - 60);
        ctx.quadraticCurveTo(x + 50, y + 10, x, y + 14);
        ctx.quadraticCurveTo(x - 50, y + 10, x - 50, y - 60);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(x - 10, y + 14, 20, 30);
        ctx.strokeRect(x - 10, y + 14, 20, 30);
        ctx.fillRect(x - 40, y + 44, 80, 18);
        ctx.strokeRect(x - 40, y + 44, 80, 18);
        break;
      case "moon":
        ctx.fillStyle = "#fff4c2";
        ctx.shadowColor = "#fff4c2";
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(x, y, 62, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(200,180,120,0.5)";
        for (const [dx, dy, r] of [[-20, -14, 12], [18, 10, 16], [-6, 28, 8]]) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case "egg":
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffe066";
        ctx.shadowBlur = 36;
        ctx.beginPath();
        ctx.ellipse(x, y, 46, 62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.stroke();
        sparkle(x + 22, y - 30, 14, "#ffffff");
        break;
    }
    ctx.restore();
  }

  function weather(kind, rnd) {
    if (kind === "none") return;
    ctx.save();
    if (kind === "rain") {
      ctx.strokeStyle = "rgba(155,231,255,0.7)";
      ctx.lineWidth = 4;
      for (let i = 0; i < 90; i++) {
        const x = rnd() * S;
        const y = rnd() * S;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 12, y + 40);
        ctx.stroke();
      }
    } else if (kind === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 110; i++) {
        ctx.beginPath();
        ctx.arc(rnd() * S, rnd() * S, 3 + rnd() * 6, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === "confetti") {
      const colors = [DD.YELLOW, DD.ORANGE, "#ff7ad9", DD.WATER, "#c084fc"];
      for (let i = 0; i < 120; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.save();
        ctx.translate(rnd() * S, rnd() * S);
        ctx.rotate(rnd() * Math.PI);
        ctx.fillRect(-8, -4, 16, 8);
        ctx.restore();
      }
    } else if (kind === "meteor") {
      for (let i = 0; i < 4; i++) {
        const x = 200 + rnd() * 760;
        const y = 80 + rnd() * 260;
        const tail = ctx.createLinearGradient(x, y, x - 220, y - 120);
        tail.addColorStop(0, "rgba(255,138,61,0.95)");
        tail.addColorStop(1, "rgba(255,138,61,0)");
        ctx.strokeStyle = tail;
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 220, y - 120);
        ctx.stroke();
        ctx.fillStyle = "#ffe066";
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Emblème de l'élément choisi, en haut au centre.
  function emblem(kind) {
    const x = S / 2;
    const y = 104;
    ctx.save();
    ctx.fillStyle = "rgba(11,21,36,0.78)";
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.fill();
    if (kind === "water") {
      ctx.fillStyle = DD.WATER;
      ctx.beginPath();
      ctx.moveTo(x, y - 30);
      ctx.quadraticCurveTo(x + 26, y + 4, x, y + 28);
      ctx.quadraticCurveTo(x - 26, y + 4, x, y - 30);
      ctx.fill();
    } else if (kind === "fire") {
      ctx.fillStyle = DD.ORANGE;
      ctx.beginPath();
      ctx.moveTo(x, y - 32);
      ctx.quadraticCurveTo(x + 30, y, x + 16, y + 26);
      ctx.quadraticCurveTo(x, y + 34, x - 16, y + 26);
      ctx.quadraticCurveTo(x - 30, y, x, y - 32);
      ctx.fill();
      ctx.fillStyle = DD.YELLOW;
      ctx.beginPath();
      ctx.ellipse(x, y + 14, 9, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "ice") {
      ctx.strokeStyle = "#e6fbff";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a) * 28, y - Math.sin(a) * 28);
        ctx.lineTo(x + Math.cos(a) * 28, y + Math.sin(a) * 28);
        ctx.stroke();
      }
    } else if (kind === "thunder") {
      ctx.fillStyle = DD.YELLOW;
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 32);
      ctx.lineTo(x - 18, y + 4);
      ctx.lineTo(x - 2, y + 4);
      ctx.lineTo(x - 8, y + 32);
      ctx.lineTo(x + 18, y - 6);
      ctx.lineTo(x + 2, y - 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function frame(kind) {
    const colors = FRAMES[kind];
    const grad = ctx.createLinearGradient(0, 0, S, S);
    colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
    ctx.save();
    ctx.lineWidth = 40;
    ctx.strokeStyle = grad;
    ctx.strokeRect(20, 20, S - 40, S - 40);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(11,21,36,0.9)";
    ctx.strokeRect(42, 42, S - 84, S - 84);
    ctx.restore();
  }

  // Liseré doré en plus du cadre tiré : la marque visuelle de l'édition Trophée.
  function trophyFrame() {
    ctx.save();
    ctx.lineWidth = 8;
    ctx.strokeStyle = TROPHY_GOLD;
    ctx.setLineDash([28, 14]);
    ctx.strokeRect(50, 50, S - 100, S - 100);
    ctx.restore();
  }

  function plate(text, x, y, align, color = "#ffffff", size = 40) {
    ctx.font = `700 ${size}px "Fredoka", sans-serif`;
    const w = ctx.measureText(text).width + 40;
    const left = align === "left" ? x : x - w;
    ctx.fillStyle = "rgba(11,21,36,0.78)";
    ctx.beginPath();
    ctx.roundRect(left, y, w, size + 26, 18);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, left + 20, y + (size + 26) / 2 + 2);
  }

  async function render(card, target = canvas) {
    const [mascot] = await Promise.all([DD.loadMascot(), DD.fontsReady()]);
    // Après l'attente, tout le dessin est synchrone : changer de canvas ici est sans risque.
    ctx = target.getContext("2d");
    const rnd = seeded(card.serial);
    ctx.clearRect(0, 0, S, S);
    background(card.bg, rnd);
    aura(card.aura, rnd, true);
    const size = 680;
    const bx = (S - size) / 2;
    const by = 230;
    ctx.save();
    ctx.filter = DUCK_FILTERS[card.duck];
    ctx.drawImage(mascot, bx, by, size, size);
    ctx.restore();
    const at = (p) => ({ x: bx + p.x * size, y: by + p.y * size });
    cheeks(card.cheeks, CHEEKS.map(at));
    neck(card.neck, at(NECK), size);
    eyes(card.eyes, LENSES.map(at), size);
    mood(card.mood, at, size);
    // Les chapeaux sont dessinés à l'échelle de la tête (≈ 62 % du badge).
    if (card.hat !== "none") hat(card.hat, at(HEAD_TOP), size * 0.62);
    aura(card.aura, rnd, false);
    item(card.item);
    weather(card.weather, rnd);
    frame(card.frame);
    if (card.trophy) trophyFrame();
    emblem(card.element);
    const [, tier, color] = tierOfCard(card);
    plate(card.label ?? `DIP DUCK #${card.serial}`, 70, 70, "left");
    plate(t(`tier_${tier}`), S - 70, 70, "right", color);
    if (card.trophy) plate(t("cardTrophy").toUpperCase(), 70, 152, "left", TROPHY_GOLD, 36);
    plate(`${card.name || "Dip Duck"} · ${t(`mood_${card.mood}`)}`, 70, S - 146, "left", DD.YELLOW, 40);
    plate(`${t("cardTop")} ${formatTop(card.top)}`, S - 70, S - 146, "right", color, 40);
  }

  const formatTop = (top) => `${top < 1 ? top.toFixed(2) : top.toFixed(1)} %`;

  function tierLabel(card) {
    const [, tier, color] = tierOfCard(card);
    const edition = card.trophy ? `${t("cardTrophy")} · ` : "";
    return { text: `${edition}${t(`tier_${tier}`)} · ${t("cardTop")} ${formatTop(card.top)}`, color };
  }

  /** Liste des attributs avec leurs étoiles de rareté. */
  function traitItems(card) {
    return ORDER.map((trait) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = t(`trait_${trait}`);
      const value = document.createElement("strong");
      value.textContent = t(`${trait}_${card[trait]}`);
      const rarity = document.createElement("span");
      rarity.className = "stars";
      const n = stars(probability(trait, card[trait]));
      rarity.textContent = "★".repeat(n) + "☆".repeat(5 - n);
      li.append(name, value, rarity);
      return li;
    });
  }

  const MOODS = ["calm", "brave", "sleepy", "hungry"];
  const ELEMENTS = ["water", "fire", "ice", "thunder"];

  /** Carte d'un vrai NFT : indices d'attributs lus dans le contrat (même ordre que TRAITS). */
  function fromChain(id, traitIndexes, info) {
    const card = {
      serial: String(id),
      label: `DIP DUCK CARD #${id}`,
      name: info.name,
      mood: MOODS[info.mood] ?? "calm",
      element: ELEMENTS[info.element] ?? "water",
      trophy: info.trophy === true,
    };
    ORDER.forEach((trait, i) => {
      card[trait] = TRAITS[trait][traitIndexes[i]]?.[0] ?? TRAITS[trait][0][0];
    });
    card.top = topPercent(rarityScore(card));
    return card;
  }

  function showDetails(card) {
    const label = tierLabel(card);
    const [, tier] = tierOfCard(card);
    const badge = document.getElementById("card-tier");
    badge.textContent = label.text;
    badge.style.setProperty("--tier", label.color);
    document.getElementById("card-traits").replaceChildren(...traitItems(card));
    document.getElementById("card-result").hidden = false;
    const url = location.protocol.startsWith("http") ? ` ${location.origin}${location.pathname}#memes` : "";
    const text = t("cardShareText").replace("{tier}", t(`tier_${tier}`)).replace("{serial}", card.serial);
    document.getElementById("card-share").href = `https://x.com/intent/post?text=${encodeURIComponent(text + url)}`;
  }

  let current;
  if (canvas) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const inputs = {
        name: String(data.get("name") || "").trim().slice(0, 20),
        mood: String(data.get("mood")),
        element: String(data.get("element")),
        lucky: Number(data.get("lucky") || 0),
      };
      current = await hatch(inputs);
      await render(current);
      showDetails(current);
    });
    document.getElementById("card-download").addEventListener("click", () => {
      if (current) DD.download(canvas, `dipduck-${current.serial}.png`);
    });
    document.addEventListener("langchange", () => {
      if (current) {
        render(current);
        showDetails(current);
      }
    });

    // Onglets Mème / Carte de collection
    for (const tab of document.querySelectorAll("[data-tab]")) {
      tab.addEventListener("click", () => {
        for (const other of document.querySelectorAll("[data-tab]")) {
          const active = other === tab;
          other.setAttribute("aria-selected", String(active));
          document.getElementById(other.dataset.tab).hidden = !active;
        }
      });
    }

    // Carte d'exemple en attendant la première éclosion.
    render({
      serial: "000000", name: "Dip Duck", mood: "calm", element: "water", top: 50,
      bg: "pond", duck: "classic", hat: "none", eyes: "none", neck: "none", aura: "none", frame: "gold",
      cheeks: "none", item: "none", weather: "none",
    });
  }

  return { render, fromChain, tierLabel, traitItems, ORDER, MOODS, ELEMENTS };
})();

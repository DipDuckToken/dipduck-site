// Dessin sur <canvas>, partagé par le générateur de mèmes, la bannière du kit
// média et le jeu. Tout est dessiné localement : aucune image ne quitte le navigateur.
const DD = (() => {
  const NAVY = "#0b1524";
  const NAVY_2 = "#1d3557";
  const YELLOW = "#ffd23f";
  const ORANGE = "#ff8a3d";
  const RED = "#e5484d";
  const WATER = "#5ab8ff";

  let mascot;
  function loadMascot() {
    mascot ??= new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = "logo.png";
    });
    return mascot;
  }

  // Le texte des mèmes utilise Fredoka : on attend qu'elle soit chargée.
  function fontsReady() {
    if (!document.fonts) return Promise.resolve();
    return Promise.all([document.fonts.load('700 80px "Fredoka"'), document.fonts.load('800 40px "Nunito"')]).catch(() => {});
  }

  function pond(ctx, w, h) {
    const bg = ctx.createRadialGradient(w / 2, h * 0.35, 0, w / 2, h * 0.35, Math.max(w, h) * 0.75);
    bg.addColorStop(0, NAVY_2);
    bg.addColorStop(1, NAVY);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  function glow(ctx, x, y, r, color = "rgba(255,210,63,0.28)") {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(255,210,63,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /** Bougies : une baisse marquée puis une remontée. `heights` est une suite de clôtures (0 = bas, 1 = haut). */
  function candles(ctx, x, y, w, h, closes, { up = YELLOW, down = RED, alpha = 1 } = {}) {
    const step = w / closes.length;
    const body = step * 0.56;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 1; i < closes.length; i++) {
      const open = closes[i - 1];
      const close = closes[i];
      const top = y + h * (1 - Math.max(open, close));
      const bottom = y + h * (1 - Math.min(open, close));
      const cx = x + step * i + step / 2;
      ctx.fillStyle = ctx.strokeStyle = close >= open ? up : down;
      ctx.lineWidth = Math.max(2, step * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx, top - step * 0.35);
      ctx.lineTo(cx, bottom + step * 0.35);
      ctx.stroke();
      ctx.fillRect(cx - body / 2, top, body, Math.max(bottom - top, 4));
    }
    ctx.restore();
  }

  function water(ctx, w, y, amplitude = 18, color = WATER) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = amplitude * 0.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let x = -20; x <= w + 20; x += 8) {
      const yy = y + Math.sin(x / 45) * amplitude * 0.5;
      x === -20 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Texte de mème : majuscules, blanc avec un contour épais, sur plusieurs lignes si besoin. */
  function memeText(ctx, text, x, y, maxWidth, size, baseline = "top") {
    const words = text.toUpperCase().trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;
    let fontSize = size;
    let lines;
    // Réduit la taille jusqu'à tenir sur 3 lignes au plus.
    for (;;) {
      ctx.font = `700 ${fontSize}px "Fredoka", "Nunito", "PingFang SC", "Microsoft YaHei", sans-serif`;
      lines = wrap(ctx, words, maxWidth);
      if (lines.length <= 3 || fontSize <= size * 0.5) break;
      fontSize -= 4;
    }
    const lineHeight = fontSize * 1.08;
    const startY = baseline === "top" ? y : y - lineHeight * (lines.length - 1);
    ctx.textAlign = "center";
    ctx.textBaseline = baseline === "top" ? "top" : "bottom";
    ctx.lineJoin = "round";
    ctx.lineWidth = fontSize * 0.16;
    ctx.strokeStyle = NAVY;
    ctx.fillStyle = "#ffffff";
    lines.forEach((line, i) => {
      ctx.strokeText(line, x, startY + i * lineHeight);
      ctx.fillText(line, x, startY + i * lineHeight);
    });
  }

  function wrap(ctx, words, maxWidth) {
    // Le chinois n'a pas d'espaces : on coupe alors caractère par caractère.
    const tokens = words.length === 1 && ctx.measureText(words[0]).width > maxWidth ? [...words[0]] : words;
    const joiner = tokens === words ? " " : "";
    const lines = [];
    let line = "";
    for (const token of tokens) {
      const candidate = line ? line + joiner + token : token;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = token;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function signature(ctx, w, h) {
    ctx.font = '800 30px "Nunito", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(255,210,63,0.85)";
    ctx.fillText("$DIPDUCK", w - 28, h - 22);
  }

  function download(canvas, filename) {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }

  /** Bannière X (1500 × 500) pour le kit média. */
  async function banner() {
    const [image] = await Promise.all([loadMascot(), fontsReady()]);
    const canvas = document.createElement("canvas");
    canvas.width = 1500;
    canvas.height = 500;
    const ctx = canvas.getContext("2d");
    pond(ctx, 1500, 500);
    candles(ctx, 820, 60, 640, 300, [0.9, 0.75, 0.82, 0.55, 0.4, 0.2, 0.1, 0.25, 0.45, 0.6, 0.78, 0.95], { alpha: 0.22 });
    glow(ctx, 330, 250, 330);
    ctx.drawImage(image, 120, 40, 420, 420);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = YELLOW;
    ctx.font = '700 150px "Fredoka", sans-serif';
    ctx.fillText("DIP DUCK", 600, 270);
    ctx.fillStyle = "#ffffff";
    ctx.font = '800 46px "Nunito", sans-serif';
    ctx.fillText("$DIPDUCK  ·  BUY THE DIP. QUACK.", 606, 345);
    water(ctx, 1500, 480, 16);
    return canvas;
  }

  return { NAVY, YELLOW, ORANGE, RED, WATER, loadMascot, fontsReady, pond, glow, candles, water, memeText, signature, download, banner };
})();

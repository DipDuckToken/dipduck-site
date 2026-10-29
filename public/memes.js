// Générateur de mèmes : trois modèles dessinés sur un canvas 1080 × 1080.
(() => {
  const canvas = document.getElementById("meme-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const top = document.getElementById("meme-top");
  const bottom = document.getElementById("meme-bottom");
  const S = 1080;
  let mascot;
  let captionIndex = 0;

  const TEMPLATES = {
    classic() {
      DD.pond(ctx, S, S);
      DD.glow(ctx, S / 2, S / 2 + 40, 460);
      ctx.drawImage(mascot, 190, 210, 700, 700);
    },
    chart() {
      ctx.fillStyle = "#120d14";
      ctx.fillRect(0, 0, S, S);
      DD.candles(ctx, 40, 230, 1000, 520, [0.95, 0.9, 0.78, 0.8, 0.6, 0.45, 0.48, 0.3, 0.18, 0.08, 0.12, 0.05], { alpha: 0.95 });
      DD.glow(ctx, 790, 820, 300, "rgba(255,210,63,0.35)");
      ctx.drawImage(mascot, 560, 560, 460, 460);
    },
    calm() {
      // Haut : la panique. Bas : le canard, calme sur l'eau.
      ctx.fillStyle = "#1a0f16";
      ctx.fillRect(0, 0, S, S / 2);
      DD.candles(ctx, 0, 150, S, 330, [1, 0.8, 0.85, 0.5, 0.55, 0.3, 0.35, 0.1, 0.15, 0.02], { alpha: 0.9 });
      ctx.save();
      ctx.translate(0, S / 2);
      DD.pond(ctx, S, S / 2);
      DD.glow(ctx, S / 2, 230, 300);
      ctx.drawImage(mascot, S / 2 - 210, 40, 420, 420);
      DD.water(ctx, S, 470, 22);
      ctx.restore();
      ctx.fillStyle = DD.YELLOW;
      ctx.fillRect(0, S / 2 - 4, S, 8);
    },
  };

  function captions() {
    return t("memeCaptions").split("|").map((pair) => pair.split(" / "));
  }

  function setCaption(index) {
    const list = captions();
    captionIndex = index % list.length;
    [top.value, bottom.value = ""] = list[captionIndex];
  }

  function template() {
    return document.querySelector('input[name="tpl"]:checked').value;
  }

  function render() {
    if (!mascot) return;
    ctx.clearRect(0, 0, S, S);
    TEMPLATES[template()]();
    const calm = template() === "calm";
    DD.memeText(ctx, top.value, S / 2, 40, S - 100, 96, "top");
    DD.memeText(ctx, bottom.value, S / 2, S - 40, S - 100, 96, "bottom");
    if (!calm) DD.signature(ctx, S, S);
    updateShare();
  }

  function updateShare() {
    const url = location.protocol.startsWith("http") ? ` ${location.origin}${location.pathname}` : "";
    const text = encodeURIComponent(t("memeShareText") + url);
    document.getElementById("meme-share").href = `https://x.com/intent/post?text=${text}`;
  }

  document.getElementById("meme-form").addEventListener("input", render);
  document.getElementById("meme-random").addEventListener("click", () => {
    setCaption(captionIndex + 1 + Math.floor(Math.random() * (captions().length - 1)));
    render();
  });
  document.getElementById("meme-download").addEventListener("click", () => DD.download(canvas, "dipduck-meme.png"));
  document.addEventListener("langchange", () => {
    setCaption(captionIndex);
    render();
  });

  Promise.all([DD.loadMascot(), DD.fontsReady()]).then(([image]) => {
    mascot = image;
    setCaption(0);
    render();
  });
})();

// « Attrape la baisse » sur la vraie courbe du Bitcoin, depuis 2010.
// Le canard glisse jour après jour sur le prix réel ; il faut toucher l'écran
// pile au fond de chaque vraie baisse. La vitesse suit la chute du jour : un
// krach de 20 % en une journée défile bien plus vite qu'une baisse de 2 %.
// Les niveaux sont les grandes époques du Bitcoin.
// Utilisé par la page d'accueil et par game.html (plein écran, future mini-app Telegram).
const DipGame = (() => {
  const W = 960;
  const H = 480;
  const DUCK_X = 280;
  const DUCK_SIZE = 72;
  const PX_PER_DAY = 12;
  const Y_SCALE = 300; // pixels par unité de log naturel du prix (≈ 80 px pour +30 %)
  // Règles en nombres entiers, identiques au contrat DipDuckLeaderboard qui rejoue les
  // parties classées : ne pas les changer sans redéployer une saison.
  const PERFECT = 12; // px entre le canard et le fond de la baisse (≈ 1 jour)
  const GOOD = 32;
  const WINDOW = GOOD * 3; // une touche vise la première baisse non jouée à moins de 96 px
  const LIVES = 3;
  const MAX_SPEED = 690; // px/s
  // Saut et pièces : une touche loin de toute baisse fait sauter le canard (sans perdre de
  // vie). Il ramasse une pièce s'il passe dessus au SOMMET du saut : pièce entre +84 et
  // +132 px devant le point de saut (sommet à +108). Les pièces sont dessinées à la hauteur du
  // sommet : ce qu'on voit toucher est exactement ce qui compte.
  const JUMP_SPAN = 216; // ≈ 1,2 s de vol
  const JUMP_HEIGHT = 130; // px à l'écran (dessin seulement)
  const COIN_FROM = 84; // sommet du saut en +108, ± 24 px
  const COIN_TO = 132;
  const DIVE_SPAN = 60; // plongeon quand on touche près d'une baisse (dessin seulement)
  // Pièces placées pour être TOUTES atteignables par un saut bien calé :
  const COIN_EVERY = 20; // une pièce tous les 20 jours (plus long qu'un saut)…
  const COIN_PHASE = 15; // …les jours où jour % 20 == 15…
  const COIN_CLEAR_BEFORE = 2; // …pas dans les 2 jours avant une baisse…
  const COIN_CLEAR_AFTER = 14; // …ni dans les 14 jours après (on sauterait sur la baisse).
  // Record : le plus loin dans l'histoire (jour atteint), puis le score en cas d'égalité.
  const RECORD_KEY = "dipduck-record";
  const RESTART_DELAY = 900; // ms : un tap de trop juste après la fin ne relance pas la partie

  // Vitesse : pas trop lente, pas trop rapide, et plus vive pendant les chutes.
  const BASE_SPEED = 140; // px/s au niveau 1 (≈ 12 jours par seconde)
  const SPEED_PER_LEVEL = 8;
  const SPEED_PER_DROP_POINT = 0.06; // +6 % de vitesse par point de baisse du jour
  const MAX_SPEED_FACTOR = 2.6;

  // Époques du Bitcoin : date de début et clé de traduction.
  const LEVELS = [
    ["2010-08-18", "lvl1"], ["2013-01-01", "lvl2"], ["2014-01-01", "lvl3"], ["2017-01-01", "lvl4"],
    ["2018-01-01", "lvl5"], ["2020-01-01", "lvl6"], ["2021-01-01", "lvl7"], ["2022-01-01", "lvl8"],
    ["2023-01-01", "lvl9"], ["2025-01-01", "lvl10"],
  ];
  // Chaque nouvelle année de données (ajoutée chaque mois) ouvre un niveau de plus.
  const lastYear = new Date(Date.parse(`${BTC_HISTORY.start}T00:00:00Z`) + (BTC_HISTORY.prices.length - 1) * 86_400_000).getUTCFullYear();
  for (let year = 2026; year <= lastYear; year++) LEVELS.push([`${year}-01-01`, "lvlYear"]);
  const levelName = (i) => tr(LEVELS[i][1]).replace("{year}", LEVELS[i][0].slice(0, 4));

  // Médiane sur 3 jours : retire les pics d'un seul jour (artefacts des données de
  // 2010-2011), mais garde les vrais krachs, qui durent plus d'un jour.
  const prices = BTC_HISTORY.prices.map((p, i, all) => {
    if (i === 0 || i === all.length - 1) return p;
    return [all[i - 1], p, all[i + 1]].sort((x, y) => x - y)[1];
  });
  const startMs = Date.parse(`${BTC_HISTORY.start}T00:00:00Z`);
  const logs = prices.map((p) => Math.log(p));
  const dayOf = (iso) => Math.max(0, Math.round((Date.parse(`${iso}T00:00:00Z`) - startMs) / 86_400_000));
  const levelStarts = LEVELS.map(([iso]) => dayOf(iso));
  // Les toutes premières semaines (août-septembre 2010) n'ont que des prix arrondis au
  // centime et des pics d'un jour : la partie commence au 1er octobre 2010.
  const GAME_START_DAY = dayOf("2010-10-01");
  const DIPS = findDips().filter((dip) => dip.day > GAME_START_DAY);

  /**
   * Les vraies baisses, celles qu'on voit sur la courbe (un V) :
   * - plus bas sur ± 7 jours, et strictement sous les 7 jours précédents
   *   (un palier plat n'est pas une baisse) ;
   * - au moins 10 % sous le plus haut des 30 jours précédents ;
   * - suivie d'un rebond d'au moins 5 % dans les 14 jours.
   */
  function findDips() {
    const out = [];
    for (let i = 7; i < prices.length - 14; i++) {
      let lowest = true;
      for (let j = i - 7; j < i && lowest; j++) if (prices[j] <= prices[i]) lowest = false;
      for (let j = i + 1; j <= i + 7 && lowest; j++) if (prices[j] < prices[i]) lowest = false;
      if (!lowest) continue;
      const peak = Math.max(...prices.slice(Math.max(0, i - 30), i));
      const rebound = Math.max(...prices.slice(i + 1, i + 15));
      if (peak / prices[i] >= 1.1 && rebound / prices[i] >= 1.05 && (out.length === 0 || i - out.at(-1).day > 7)) {
        out.push({ day: i, drawdown: 1 - prices[i] / peak });
      }
    }
    return out;
  }

  const levelAt = (day) => levelStarts.findLastIndex((start) => day >= start);
  const baseSpeed = (lvl) => BASE_SPEED + SPEED_PER_LEVEL * lvl;
  const dailyChange = (day) => (day > 0 ? prices[day] / prices[day - 1] - 1 : 0);

  // Vitesse visée au jour `day` : la baisse du jour accélère le défilement, une hausse non.
  function targetSpeed(day) {
    const base = baseSpeed(levelAt(day));
    const drop = Math.max(0, -dailyChange(day) * 100);
    return Math.min(base * (1 + SPEED_PER_DROP_POINT * drop), base * MAX_SPEED_FACTOR, MAX_SPEED);
  }

  /**
   * Temps (en secondes) qu'il faut au canard pour atteindre chaque jour, en simulant le
   * défilement à `fps` images par seconde avec la même vitesse que le jeu. Sert à fixer,
   * pour chaque saison, le temps minimal qu'exige le contrat (tools/make-season.mjs).
   */
  function timeProfile(fps) {
    const seconds = new Array(prices.length).fill(0);
    const dt = 1 / fps;
    let x = GAME_START_DAY * PX_PER_DAY;
    let speed = baseSpeed(0);
    let t = 0;
    let day = GAME_START_DAY;
    while (day < prices.length - 1) {
      speed += (targetSpeed(day) - speed) * Math.min(1, dt * 2.5);
      speed = Math.min(speed, MAX_SPEED);
      x += speed * dt;
      t += dt;
      while (day < Math.floor(x / PX_PER_DAY) && day < prices.length - 1) seconds[++day] = t;
    }
    return seconds;
  }

  function record() {
    try {
      return { day: -1, score: 0, ...JSON.parse(localStorage.getItem(RECORD_KEY) || "{}") };
    } catch {
      return { day: -1, score: 0 };
    }
  }

  const dateOf = (day) => {
    const locale = typeof currentLang === "string" ? (currentLang === "zh" ? "zh-CN" : currentLang) : "en";
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(startMs + day * 86_400_000);
  };

  function mount(canvas, { onGameOver } = {}) {
    const ctx = canvas.getContext("2d");
    let mascot;
    let state = "ready"; // ready | playing | over | done
    let scroll, speed, score, lives, popups, splashes, flash, last, dips, camera, level, levelBannerUntil, reached, endedAt;
    let caught, coins, coinList, airborneUntil, jumpFrom, landed, diveFrom;
    // Partie classée : saison figée (baisses et fin) et liste des touches envoyée au contrat.
    let mode = "casual";
    let armedSeason = null;
    let taps = [];
    let endX = 0;

    const rand = (min, max) => min + Math.random() * (max - min);

    // Chaque partie part du début de l'histoire du Bitcoin (octobre 2010), sans choix du niveau.
    function reset(season) {
      scroll = GAME_START_DAY * PX_PER_DAY - DUCK_X;
      speed = baseSpeed(0);
      score = 0;
      lives = LIVES;
      popups = [];
      splashes = [];
      flash = 0;
      endX = (season ? season.endDay : prices.length - 1) * PX_PER_DAY;
      // Seules comptent les baisses qu'on peut dépasser avant la ligne d'arrivée.
      dips = (season ? season.dips.map(([day, bonus]) => ({ day, bonus })) : DIPS.map((dip) => ({ day: dip.day, bonus: bonusOf(dip) })))
        .filter((dip) => dip.day * PX_PER_DAY + GOOD + 1 <= endX)
        .map((dip) => ({ ...dip, done: false }));
      coinList = coinsFor(dips, endX);
      caught = 0;
      coins = 0;
      airborneUntil = 0;
      jumpFrom = -Infinity;
      landed = true;
      diveFrom = -Infinity;
      taps = [];
      level = -1;
      reached = GAME_START_DAY;
      camera = logAt(duckWorldX());
    }

    const duckWorldX = () => scroll + DUCK_X;

    // Pièces : jours où jour % 20 == 15, atteignables depuis le départ, avant l'arrivée, loin des baisses.
    function coinsFor(list, finishX) {
      const out = [];
      for (let day = GAME_START_DAY + 1; day * PX_PER_DAY < finishX; day++) {
        if (day % COIN_EVERY !== COIN_PHASE) continue;
        if (day * PX_PER_DAY - COIN_TO < GAME_START_DAY * PX_PER_DAY) continue;
        if (list.some((dip) => day >= dip.day - COIN_CLEAR_BEFORE && day <= dip.day + COIN_CLEAR_AFTER)) continue;
        out.push({ x: day * PX_PER_DAY, taken: false });
      }
      return out;
    }

    // Hauteur du canard pendant un saut (dessin) : arc de 144 px de long.
    function jumpLift(x) {
      const u = (x - jumpFrom) / JUMP_SPAN;
      return u > 0 && u < 1 ? 4 * JUMP_HEIGHT * u * (1 - u) : 0;
    }

    // Pose du canard à la position x : hauteur, inclinaison et écrasement (dessin seulement).
    function duckPose(x) {
      const u = (x - jumpFrom) / JUMP_SPAN;
      if (u > 0 && u < 1) {
        // Penche vers le haut à la montée, vers le bas à la descente.
        return { lift: jumpLift(x), tilt: -0.45 * (1 - 2 * u), squash: 1 };
      }
      if (u >= 1 && u < 1.12) return { lift: 0, tilt: 0, squash: 0.82 }; // réception
      const v = (x - diveFrom) / DIVE_SPAN;
      if (v > 0 && v < 1) return { lift: -22 * Math.sin(Math.PI * v), tilt: 0.35 * Math.sin(Math.PI * v), squash: 1 };
      return { lift: 0, tilt: 0, squash: 1 };
    }

    function logAt(worldX) {
      const d = worldX / PX_PER_DAY;
      const i = Math.max(0, Math.min(prices.length - 2, Math.floor(d)));
      const u = Math.max(0, Math.min(1, d - i));
      return logs[i] + (logs[i + 1] - logs[i]) * u;
    }

    // La courbe est un peu basse à l'écran : de la place au-dessus pour les sauts et les pièces.
    const screenY = (logPrice) => H * 0.66 - (logPrice - camera) * Y_SCALE;

    function tap() {
      if (state !== "playing") {
        if (endedAt && performance.now() - endedAt < RESTART_DELAY) return;
        mode = armedSeason ? "ranked" : "casual";
        reset(armedSeason);
        armedSeason = null;
        state = "playing";
        last = performance.now();
        onGameOver?.(null);
        return;
      }
      // Position entière : c'est elle qui est jugée, ici comme dans le contrat.
      const x = Math.floor(duckWorldX());
      if (mode === "ranked") taps.push(x);
      passes(x);
      if (state !== "playing") return;
      const target = dips.find((dip) => !dip.done && Math.abs(dip.day * PX_PER_DAY - x) <= WINDOW);
      const distance = target ? Math.abs(target.day * PX_PER_DAY - x) : Infinity;
      // Bonus : plus la vraie baisse était profonde, plus elle rapporte.
      const bonus = target ? target.bonus : 0;
      if (!target) {
        // Loin de toute baisse : saut (pas en l'air), et ramassage des pièces devant.
        if (x >= airborneUntil) {
          airborneUntil = x + JUMP_SPAN;
          jumpFrom = x;
          landed = false;
          for (const coin of coinList) {
            if (!coin.taken && coin.x >= x + COIN_FROM && coin.x <= x + COIN_TO) {
              // Comptée tout de suite (comme dans le contrat), montrée quand le canard passe dessus.
              coin.taken = true;
              coins += 1;
            }
          }
        }
        return;
      }
      diveFrom = x;
      if (distance <= PERFECT) {
        target.done = true;
        caught += 1;
        score += 3 + bonus;
        popup(`${tr("gamePerfect")} +${3 + bonus}`, DD.YELLOW);
        splash();
      } else if (distance <= GOOD) {
        target.done = true;
        caught += 1;
        score += 1 + bonus;
        popup(`${tr("gameGood")} +${1 + bonus}`, "#ffffff");
        splash();
      } else {
        // Trop tôt ou trop tard sur une baisse : elle est perdue, et une vie avec.
        target.done = true;
        miss(x);
      }
    }

    // Baisses dépassées sans être touchées (fond + GOOD < limite) : une vie chacune.
    function passes(limit) {
      for (const dip of dips) {
        if (dip.done) continue;
        const dipX = dip.day * PX_PER_DAY;
        if (dipX + GOOD >= limit) break;
        dip.done = true;
        miss(dipX + GOOD + 1);
        if (state !== "playing") return;
      }
    }

    // eventX : position où la vie est perdue ; la dernière fixe le jour atteint.
    function miss(eventX) {
      lives -= 1;
      flash = 1;
      popup(tr("gameMiss"), DD.RED);
      if (lives <= 0) {
        reached = Math.floor(eventX / PX_PER_DAY);
        finish("over");
      }
    }

    function finish(result) {
      state = result;
      endedAt = performance.now();
      setTouchMode();
      const previous = record();
      // Départage : distance, puis baisses attrapées, puis pièces, puis points.
      const mine = [reached, caught, coins, score];
      const theirs = [previous.day, previous.caught ?? 0, previous.coins ?? 0, previous.score];
      const better = mine.findIndex((v, i) => v !== theirs[i]);
      if (better !== -1 && mine[better] > theirs[better]) {
        localStorage.setItem(RECORD_KEY, JSON.stringify({ day: reached, caught, coins, score }));
      }
      const ranked = mode === "ranked";
      onGameOver?.({ day: reached, date: dateOf(reached), caught, coins, score, record: record(), ranked, taps: ranked ? taps.slice() : null });
    }

    function popup(text, color) {
      popups.push({ text, color, y: 0, life: 1 });
    }

    function splash() {
      const y = screenY(logAt(duckWorldX()));
      for (let i = 0; i < 14; i++) {
        splashes.push({ x: DUCK_X, y, vx: rand(-160, 160), vy: rand(-320, -120), life: 1 });
      }
    }

    function update(dt) {
      const day = Math.floor(duckWorldX() / PX_PER_DAY);
      const lvl = levelAt(day);
      if (lvl !== level) {
        level = lvl;
        levelBannerUntil = performance.now() + 2600;
      }
      speed += (targetSpeed(day) - speed) * Math.min(1, dt * 2.5);
      speed = Math.min(speed, MAX_SPEED);
      scroll += speed * dt;
      camera += (logAt(duckWorldX()) - camera) * Math.min(1, dt * 3);

      const x = Math.floor(duckWorldX());
      passes(Math.min(x, endX));
      if (state !== "playing") return;
      if (x >= endX) {
        reached = endX / PX_PER_DAY;
        finish("done");
      }
    }

    function draw(now) {
      const dt = Math.min((now - (last ?? now)) / 1000, 0.05);
      last = now;
      if (state === "playing") update(dt);

      DD.pond(ctx, W, H);
      ctx.strokeStyle = "rgba(36,57,91,0.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 10]);
      for (let y = 100; y < H; y += 90) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Courbe réelle : seulement les jours visibles.
      const first = Math.max(0, Math.floor(scroll / PX_PER_DAY) - 1);
      const lastDay = Math.min(prices.length - 1, Math.ceil((scroll + W) / PX_PER_DAY) + 1);
      ctx.beginPath();
      for (let d = first; d <= lastDay; d++) {
        const x = d * PX_PER_DAY - scroll;
        const y = screenY(logs[d]);
        d === first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(lastDay * PX_PER_DAY - scroll, H);
      ctx.lineTo(first * PX_PER_DAY - scroll, H);
      ctx.closePath();
      const area = ctx.createLinearGradient(0, 100, 0, H);
      area.addColorStop(0, "rgba(255,138,61,0.32)");
      area.addColorStop(1, "rgba(255,138,61,0)");
      ctx.fillStyle = area;
      ctx.fill();
      ctx.beginPath();
      for (let d = first; d <= lastDay; d++) {
        const x = d * PX_PER_DAY - scroll;
        const y = screenY(logs[d]);
        d === first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = DD.ORANGE;
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Pièces à ramasser en sautant, au-dessus de la courbe.
      for (const coin of coinList) {
        const x = coin.x - scroll;
        if (coin.taken && !coin.shown && duckWorldX() >= coin.x) {
          coin.shown = true;
          popup("+1", DD.YELLOW);
          splash();
        }
        if (coin.shown || x < -20 || x > W + 20) continue;
        // À la hauteur du centre du canard au sommet du saut (corps du canard ≈ 30 px au-dessus de la courbe).
        const y = screenY(logs[Math.min(prices.length - 1, Math.floor(coin.x / PX_PER_DAY))]) - JUMP_HEIGHT - 30;
        // Halo : la pièce brille un peu pour qu'on la voie venir.
        ctx.fillStyle = "rgba(255,210,63,0.25)";
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffcc33";
        ctx.strokeStyle = "#8a5a00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Les vraies baisses à attraper : un petit rond au fond de chacune.
      ctx.strokeStyle = "rgba(255,210,63,0.75)";
      ctx.lineWidth = 3;
      for (const dip of dips) {
        const x = dip.day * PX_PER_DAY - scroll;
        if (dip.done || x < -20 || x > W + 20) continue;
        ctx.beginPath();
        ctx.arc(x, screenY(logs[dip.day]) + 14, 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Repère vertical du canard
      ctx.strokeStyle = "rgba(255,210,63,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(DUCK_X, 70);
      ctx.lineTo(DUCK_X, H);
      ctx.stroke();

      const groundY = screenY(logAt(duckWorldX()));
      const pose = state === "playing" ? duckPose(duckWorldX()) : { lift: 0, tilt: 0, squash: 1 };
      const duckY = groundY - pose.lift;
      // Réception d'un saut : éclaboussure.
      if (state === "playing" && !landed && duckWorldX() >= jumpFrom + JUMP_SPAN) {
        landed = true;
        splash();
      }
      // Ombre sur la courbe, plus petite quand le canard est haut.
      if (pose.lift > 4) {
        const k = Math.max(0.35, 1 - pose.lift / (JUMP_HEIGHT * 1.6));
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(DUCK_X, groundY + 2, 26 * k, 7 * k, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (mascot) {
        ctx.save();
        ctx.translate(DUCK_X, duckY - DUCK_SIZE / 2 + 6);
        ctx.rotate(pose.tilt);
        ctx.scale(1 + (1 - pose.squash) * 0.6, pose.squash);
        ctx.drawImage(mascot, -DUCK_SIZE / 2, -DUCK_SIZE / 2, DUCK_SIZE, DUCK_SIZE);
        ctx.restore();
      }

      for (const s of splashes) {
        s.vy += 900 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt * 1.6;
        ctx.fillStyle = `rgba(90,184,255,${Math.max(s.life, 0)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      splashes = splashes.filter((s) => s.life > 0);

      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      for (const p of popups) {
        p.y += dt * 60;
        p.life -= dt * 1.2;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.font = '700 36px "Fredoka", sans-serif';
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, DUCK_X, duckY - DUCK_SIZE - 18 - p.y);
      }
      ctx.globalAlpha = 1;
      popups = popups.filter((p) => p.life > 0);

      if (flash > 0) {
        ctx.fillStyle = `rgba(229,72,77,${flash * 0.25})`;
        ctx.fillRect(0, 0, W, H);
        flash = Math.max(0, flash - dt * 3);
      }

      hud(now);
      const best = record();
      const bestText = best.day >= 0 ? `${tr("gameBest")} : ${dateOf(best.day)} · ` : "";
      if (state === "ready" && armedSeason) overlay(tr("gameRankedReady"), tr("gameStart"));
      else if (state === "ready") overlay(tr("gameTitle"), `${bestText}${tr("gameStart")}`);
      if (state === "over") overlay(tr("gameReached").replace("{date}", dateOf(reached)), `${tr("gameScore")} ${score} · ${bestText}${tr("gameRetry")}`);
      if (state === "done") overlay(tr("gameFinished"), `${tr("gameScore")} ${score} · ${tr("gameRetry")}`);
      requestAnimationFrame(draw);
    }

    function hud(now) {
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = '700 32px "Fredoka", sans-serif';
      ctx.fillText(`${tr("gameScore")} ${score}`, 24, 18);
      ctx.font = '800 20px "Nunito", sans-serif';
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(`${tr("gameDips")} ${caught} · ${tr("gameCoins")} ${coins}`, W - 24, 58);
      ctx.textAlign = "left";
      for (let i = 0; i < LIVES; i++) {
        ctx.fillStyle = i < lives ? DD.YELLOW : "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.arc(W - 36 - i * 34, 36, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      if (state !== "playing") {
        ctx.textBaseline = "alphabetic";
        return;
      }
      // Date réelle, prix et variation du jour
      const day = Math.min(prices.length - 1, Math.floor(duckWorldX() / PX_PER_DAY));
      const change = dailyChange(day) * 100;
      const locale = typeof currentLang === "string" ? (currentLang === "zh" ? "zh-CN" : currentLang) : "en";
      const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(startMs + day * 86_400_000);
      const price = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumSignificantDigits: 4 }).format(prices[day]);
      ctx.font = '800 20px "Nunito", sans-serif';
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(`${levelName(level)} · ${date} · BTC ${price}`, 24, 62);
      ctx.fillStyle = change < 0 ? DD.RED : DD.YELLOW;
      ctx.fillText(`${change >= 0 ? "+" : ""}${change.toFixed(1)} %`, 24, 88);

      if (now < levelBannerUntil) {
        ctx.textAlign = "center";
        ctx.fillStyle = DD.YELLOW;
        ctx.font = '700 40px "Fredoka", sans-serif';
        ctx.fillText(`${tr("gameLevel")} ${level + 1} — ${levelName(level)}`, W / 2, 120);
      }
      ctx.textBaseline = "alphabetic";
    }

    function overlay(title, subtitle) {
      ctx.fillStyle = "rgba(11,21,36,0.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = DD.YELLOW;
      ctx.font = '700 56px "Fredoka", sans-serif';
      ctx.fillText(title, W / 2, H / 2 - 30);
      ctx.fillStyle = "#ffffff";
      ctx.font = '800 26px "Nunito", sans-serif';
      ctx.fillText(subtitle, W / 2, H / 2 + 34);
      ctx.textBaseline = "alphabetic";
    }

    // Sur mobile, faire défiler la page en passant sur le jeu ne doit ni lancer une
    // partie ni coûter une vie : hors partie, le jeu se lance par un vrai clic (pas
    // déclenché par un défilement) ; pendant la partie, chaque toucher compte.
    function setTouchMode() {
      canvas.style.touchAction = state === "playing" ? "none" : "pan-y";
    }
    canvas.tabIndex = 0;
    canvas.addEventListener("click", () => {
      if (state !== "playing") {
        tap();
        setTouchMode();
      }
    });
    canvas.addEventListener("pointerdown", (event) => {
      if (state !== "playing") return;
      event.preventDefault();
      tap();
    });
    // Espace : seulement pendant une partie, ou si le jeu a le focus (sinon la page défile).
    window.addEventListener("keydown", (event) => {
      if (event.code !== "Space" || event.target.closest?.("input, textarea, button, a, select")) return;
      if (state !== "playing" && document.activeElement !== canvas) return;
      event.preventDefault();
      tap();
      setTouchMode();
    });

    reset();
    setTouchMode();
    Promise.all([DD.loadMascot(), DD.fontsReady()]).then(([image]) => {
      mascot = image;
    });
    requestAnimationFrame(draw);

    // Partie classée : le site l'arme après la transaction de départ ; elle commence au prochain toucher.
    return {
      armRanked(season) {
        armedSeason = season;
        if (state !== "playing") state = "ready";
        endedAt = 0;
      },
    };
  }

  // Textes : ceux du site s'il est chargé, sinon ceux de game.html.
  function tr(key) {
    return typeof t === "function" ? t(key) : key;
  }

  const bonusOf = (dip) => Math.round(dip.drawdown * 10);

  return {
    mount,
    record,
    dateOf,
    dipCount: DIPS.length,
    // Pour tools/make-season.mjs : baisses [jour, bonus] et jour de départ.
    seasonDips: () => DIPS.map((dip) => [dip.day, bonusOf(dip)]),
    timeProfile,
    GAME_START_DAY,
  };
})();

// Page d'accueil : branche le jeu, le record (date la plus lointaine) et le partage.
(() => {
  const canvas = document.getElementById("game-canvas");
  if (!canvas || document.body.dataset.page === "game") return;
  const share = document.getElementById("game-share");
  const bestEl = document.getElementById("game-best");
  const showRecord = () => {
    const best = DipGame.record();
    bestEl.textContent = best.day >= 0 ? `${DipGame.dateOf(best.day)} (${best.score})` : "—";
  };
  showRecord();
  document.addEventListener("langchange", showRecord);
  window.dipGameController = DipGame.mount(canvas, {
    onGameOver(result) {
      if (result === null) {
        share.hidden = true;
        return;
      }
      showRecord();
      // Pour le classement on-chain (leaderboard.js) : le résultat de la partie terminée.
      document.dispatchEvent(new CustomEvent("dipgameover", { detail: result }));
      const url = location.protocol.startsWith("http") ? ` ${location.origin}${location.pathname}#game` : "";
      const text = t("gameShareText").replace("{date}", result.date).replace("{score}", result.score);
      share.href = `https://x.com/intent/post?text=${encodeURIComponent(text + url)}`;
      share.hidden = false;
    },
  });
})();

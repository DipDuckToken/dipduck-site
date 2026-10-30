// Classement public du jeu, sur la blockchain (contrat DipDuckGame du kit).
//
// Un seul contrat pour toujours : la courbe du Bitcoin de 2010 à aujourd'hui (historique
// figé au déploiement, puis un prix par jour lu chez Chainlink), et des concours de 3 mois
// (trimestres) qui s'enchaînent tout seuls. Chaque concours a sa ligne d'arrivée, une date
// de la courbe. Ordre du classement : la distance, puis les baisses attrapées, puis les
// pièces, puis les points.
//
// Parties classées vérifiées : le joueur signe un départ (startRun), joue, puis envoie la
// liste de ses touches. Le contrat REJOUE la partie (baisses, sauts, pièces) avec les
// mêmes règles entières que le jeu et refuse un résultat arrivé plus vite que le jeu ne le
// permet. Personne ne peut inventer un résultat ; seul un programme qui jouerait vraiment
// en temps réel resterait possible.
//
// Prix décalé : la courbe s'arrête à hier. Le contrat n'enregistre que des jours terminés,
// chacun à sa clôture officielle Chainlink : pour chaque jour, le site cherche le dernier
// round du flux publié avant minuit UTC (recherche par paliers sur getRoundData, en lots de
// 16 lectures : environ 3 lots par jour), puis l'envoie à recordDay, qui le vérifie. Ce
// rattrapage n'est demandé que si les prix ne couvrent pas encore la course du concours
// (en pratique au début de chaque trimestre : 2 transactions pour ~90 jours).
// Si le flux principal est muet depuis plus de 2 jours et qu'un flux de secours existe, le site
// prend ses rounds (recordDayBackup). Sans prix 14 jours après le début d'un trimestre, le
// contrat passe en mode dégradé : currentContest renvoie une course déjà couverte, rien à rattraper.

// ─── À remplir après le déploiement (voir README.md) ────────────────────────
const LEADERBOARD_CONFIG = {
  // Adresse du contrat de jeu (deployments/robinhood.json du kit → game.address)
  contract: "",
  // Réseau : à ne changer que pour un test.
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  chainId: 4663,
};
// ────────────────────────────────────────────────────────────────────────────

(() => {
  const section = document.getElementById("leaderboard");
  if (!section) return;
  const live = /^0x[0-9a-fA-F]{40}$/.test(LEADERBOARD_CONFIG.contract);
  const SEL = {
    startRun: "0xc97406d8", // startRun()
    submit: "0x106a15e7", // submit(uint32[],bytes32)
    verify: "0x12ee0963", // verify(uint32[],uint32) → (day, caught, coins, score, finalX)
    currentContest: "0x1e5934af", // currentContest() → (id, startTs, endTs, finishDay)
    topList: "0xfeafb845", // topList(uint32)
    best: "0x2950dca2", // best(uint32,address)
    dipCount: "0x83152f44", // dipCount()
    dipAt: "0x2746ea46", // dipAt(uint256) → (day, bonus)
    recordDay: "0xf40805ea", // recordDay(uint80[]) : un round Chainlink par jour, 60 jours au plus
    daysBehind: "0x8ca809dc", // daysBehind() : jours terminés pas encore enregistrés
    lastRecordedDay: "0x3278239b", // lastRecordedDay()
    FEED: "0x0beaf38c", // FEED() : flux Chainlink BTC/USD
    recordDayBackup: "0x284aa381", // recordDayBackup(uint80[]) : rounds du flux de secours
    BACKUP_FEED: "0xa87d514f", // BACKUP_FEED() : flux de secours (0 = aucun)
    mainFeedStale: "0x61059274", // mainFeedStale() : principal muet depuis plus de 2 jours
  };
  // Flux Chainlink (AggregatorV3) : roundId = phaseId << 64 | numéro du round dans la phase.
  const FEED_SEL = {
    latestRoundData: "0xfeaf968c", // latestRoundData() → (roundId, answer, startedAt, updatedAt, answeredInRound)
    getRoundData: "0x9a6fc8f5", // getRoundData(uint80)
  };
  const DATA_START = 1282089600; // jour 0 du jeu (DATA_START du contrat), 2010-08-18 UTC
  const FINISH_EVAL = 15; // la course du concours doit être enregistrée jusqu'à finishDay + 15
  const MAX_DAYS_PER_TX = 60; // MAX_DAYS_PER_CALL du contrat
  const PROBES = 16; // lectures par lot
  const MAX_BATCHES_PER_DAY = 12; // recherche bornée
  const MASK64 = (1n << 64n) - 1n;
  const CHAIN_HEX = `0x${LEADERBOARD_CONFIG.chainId.toString(16)}`;
  const NICK_PATTERN = /^[A-Za-z0-9 ._-]{0,16}$/;
  const $ = (id) => document.getElementById(id);
  let contest; // concours en cours
  let lastRun; // dernière partie classée terminée
  let account;

  // ─── Encodage ABI minimal ─────────────────────────────────────────────────
  const word = (n) => BigInt(n).toString(16).padStart(64, "0");
  const hexOf = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const nickWord = (nick) => hexOf(new TextEncoder().encode(nick)).padEnd(64, "0");
  const uintArray = (items) => word(items.length) + items.map(word).join("");
  const addressWord = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const words = (hex) => (hex.replace(/^0x/, "").match(/.{64}/g) ?? []).map((w) => BigInt(`0x${w}`));
  function decodeNick(wordValue) {
    const hex = wordValue.toString(16).padStart(64, "0");
    const bytes = hex.match(/.{2}/g).map((h) => parseInt(h, 16)).filter((b) => b !== 0);
    return new TextDecoder().decode(new Uint8Array(bytes));
  }

  async function rpc(method, params) {
    const response = await fetch(LEADERBOARD_CONFIG.rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const body = await response.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  }
  const call = (data) => rpc("eth_call", [{ to: LEADERBOARD_CONFIG.contract, data }, "latest"]);

  // Plusieurs appels en une requête JSON-RPC (lot) ; si le RPC refuse les lots, un par un.
  async function rpcBatch(requests) {
    const single = (r) =>
      fetch(LEADERBOARD_CONFIG.rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...r }),
      }).then((response) => response.json(), () => ({ error: {} }));
    try {
      const response = await fetch(LEADERBOARD_CONFIG.rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requests.map((r, i) => ({ jsonrpc: "2.0", id: i, ...r }))),
      });
      const body = await response.json();
      if (!Array.isArray(body)) throw new Error("batch");
      const byId = new Map(body.map((reply) => [reply.id, reply]));
      return requests.map((_, i) => byId.get(i) ?? { error: {} });
    } catch {
      return Promise.all(requests.map(single));
    }
  }

  // ─── Clôtures officielles Chainlink ───────────────────────────────────────
  // updatedAt (secondes) de chaque round, ou null s'il n'existe pas.
  async function roundTimes(feed, ids) {
    const replies = await rpcBatch(ids.map((id) => ({ method: "eth_call", params: [{ to: feed, data: FEED_SEL.getRoundData + word(id) }, "latest"] })));
    return replies.map((reply) => {
      if (!reply || reply.error || !reply.result || reply.result.length < 2 + 64 * 5) return null;
      const updatedAt = words(reply.result)[3];
      return updatedAt === 0n ? null : updatedAt;
    });
  }

  // Plus grand numéro n de [lo, hi] (phase `phase`) dont le round est publié au plus tard à `end`,
  // sachant que celui de `lo` l'est : galop (lo + 1, 2, 4… en un lot), puis paliers de 16.
  async function searchLast(feed, phase, lo, hi, end) {
    let exponential = true;
    let stride = 1n; // galop : grandit si tout un lot est encore avant `end`
    for (let batch = 0; lo < hi; batch++) {
      if (batch >= MAX_BATCHES_PER_DAY) throw new Error(t("lbRoundNotFound"));
      const points = [];
      for (let k = 1; k <= PROBES; k++) {
        let n = exponential ? lo + stride * (1n << BigInt(k - 1)) : lo + ((hi - lo) * BigInt(k)) / BigInt(PROBES);
        if (n > hi) n = hi;
        if (n > lo && n !== points.at(-1)) points.push(n);
      }
      const times = await roundTimes(feed, points.map((n) => (phase << 64n) | n));
      const bad = times.findIndex((time) => time === null || time > end);
      if (bad === -1) {
        lo = points.at(-1);
        stride <<= 16n;
        continue;
      }
      if (bad > 0) lo = points[bad - 1];
      hi = points[bad] - 1n;
      exponential = false;
    }
    return lo;
  }

  /**
   * Rounds Chainlink des jours fromDay, fromDay + 1… (au plus toDay) : pour chaque jour, le dernier
   * round publié avant son minuit UTC de fin. S'arrête au premier jour pas encore final (aucun round
   * après son minuit). Gère un changement de phase récent (jours de la phase précédente).
   */
  async function findCloses(feed, fromDay, toDay, progress) {
    const latest = words(await rpc("eth_call", [{ to: feed, data: FEED_SEL.latestRoundData }, "latest"]));
    const phase = latest[0] >> 64n;
    const latestUpdated = latest[3];
    const cursor = new Map(); // dernier résultat par phase : point de départ du jour suivant
    const lastOf = new Map(); // dernier round d'une phase terminée
    const ids = [];
    for (let day = fromDay; day <= toDay; day++) {
      const end = BigInt(DATA_START + (day + 1) * 86_400);
      if (latestUpdated <= end) break; // pas encore de round après minuit : jour pas final
      progress?.(day - fromDay + 1, toDay - fromDay + 1);
      let found;
      for (const p of phase > 1n ? [phase, phase - 1n] : [phase]) {
        const lo = cursor.get(p) ?? 1n;
        const [first] = await roundTimes(feed, [(p << 64n) | lo]);
        if (first === null || first > end) continue; // ce jour est avant cette phase
        let hi = p === phase ? latest[0] & MASK64 : lastOf.get(p);
        if (hi === undefined) {
          hi = await searchLast(feed, p, 1n, MASK64 >> 1n, 1n << 62n);
          lastOf.set(p, hi);
        }
        const n = await searchLast(feed, p, lo, hi, end);
        cursor.set(p, n);
        found = (p << 64n) | n;
        break;
      }
      if (found === undefined) throw new Error(t("lbRoundNotFound"));
      ids.push(found);
    }
    return ids;
  }

  async function loadContest() {
    const [id, startTs, endTs, finishDay] = words(await call(SEL.currentContest)).map(Number);
    return { id, start: startTs * 1000, end: endTs * 1000, finishDay };
  }

  // Liste des baisses du contrat (historiques + trouvées depuis par le contrat), gardée en cache.
  async function loadDips() {
    const count = Number(words(await call(SEL.dipCount))[0]);
    const key = `dipduck-dips-${LEADERBOARD_CONFIG.contract}`;
    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      cached = [];
    }
    const dips = cached.slice(0, count);
    for (let start = dips.length; start < count; start += 8) {
      const batch = [];
      for (let i = start; i < Math.min(start + 8, count); i++) batch.push(call(SEL.dipAt + word(i)).then((hex) => words(hex).map(Number)));
      dips.push(...(await Promise.all(batch)));
    }
    localStorage.setItem(key, JSON.stringify(dips));
    return dips;
  }

  // topList(id) → (address[], uint32[] days, uint32[] caught, uint32[] coins, uint32[] scores, bytes32[] nicknames)
  async function loadTop(id) {
    const all = words(await call(SEL.topList + word(id)));
    const array = (index) => {
      const start = Number(all[index]) / 32;
      const length = Number(all[start]);
      return all.slice(start + 1, start + 1 + length);
    };
    const [players, days, caught, coins, scores, nicks] = [0, 1, 2, 3, 4, 5].map(array);
    return players.map((player, i) => ({
      player: `0x${player.toString(16).padStart(40, "0")}`,
      day: Number(days[i]),
      caught: Number(caught[i]),
      coins: Number(coins[i]),
      score: Number(scores[i]),
      nick: decodeNick(nicks[i]),
    }));
  }

  // ─── Affichage ────────────────────────────────────────────────────────────
  // Pseudo semi-masqué (« DipMaster » → « Di••••••r ») : aucune adresse ni lien vers un wallet n'est affiché.
  const masked = (nick) => {
    const chars = [...nick];
    if (chars.length <= 3) return `${chars[0]}••`;
    const head = chars.length >= 6 ? 2 : 1;
    return chars.slice(0, head).join("") + "•".repeat(chars.length - head - 1) + chars[chars.length - 1];
  };
  const locale = () => (currentLang === "zh" ? "zh-CN" : currentLang);
  const quarterName = (id) => `T${(id % 4) + 1} ${2026 + Math.floor(id / 4)}`;

  function cell(text) {
    const td = document.createElement("td");
    td.textContent = text; // pseudos affichés en texte brut
    return td;
  }

  function row(entry, rank) {
    const tr = document.createElement("tr");
    if (account && entry.player.toLowerCase() === account.toLowerCase()) tr.className = "me";
    const who = cell(entry.nick ? masked(entry.nick) : `🦆 #${rank}`);
    tr.append(cell(`${rank}`), who, cell(DipGame.dateOf(entry.day)), cell(String(entry.caught)), cell(String(entry.coins)), cell(String(entry.score)));
    return tr;
  }

  async function showTop() {
    contest = await loadContest();
    const end = new Intl.DateTimeFormat(locale(), { dateStyle: "long", timeZone: "UTC" }).format(contest.end - 1000);
    $("lb-season").textContent = t("lbContest")
      .replace("{name}", quarterName(contest.id))
      .replace("{end}", end)
      .replace("{finish}", DipGame.dateOf(contest.finishDay));
    const top = await loadTop(contest.id);
    $("lb-empty").hidden = top.length > 0;
    $("lb-body").replaceChildren(...top.map((entry, i) => row(entry, i + 1)));
    // Les gagnants du concours précédent restent affichés.
    if (contest.id > 0) {
      const previous = (await loadTop(contest.id - 1)).slice(0, 3);
      $("lb-previous-wrap").hidden = previous.length === 0;
      $("lb-previous-title").textContent = t("lbPrevious").replace("{name}", quarterName(contest.id - 1));
      $("lb-previous").replaceChildren(...previous.map((entry, i) => row(entry, i + 1)));
    }
  }

  function status(text, kind = "") {
    $("lb-status").textContent = text;
    $("lb-status").dataset.kind = kind;
  }

  // ─── Wallet et transactions ───────────────────────────────────────────────
  // Avant chaque transaction : le wallet doit être sur Robinhood Chain (changement demandé si
  // besoin, puis relu) ; sinon rien n'est envoyé.
  async function ensureChain() {
    const onChain = async () => Number(await window.ethereum.request({ method: "eth_chainId" })) === LEADERBOARD_CONFIG.chainId;
    if (await onChain()) return;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } catch (error) {
      if (error.code !== 4902) throw new Error(t("nftWrongChain"));
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: CHAIN_HEX, chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [LEADERBOARD_CONFIG.rpc], blockExplorerUrls: [EXPLORER] }],
      });
    }
    if (!(await onChain())) throw new Error(t("nftWrongChain"));
  }

  async function connect() {
    if (!window.ethereum) throw new Error(t("nftNoWallet"));
    [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureChain();
  }

  async function send(data) {
    await ensureChain();
    const hash = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from: account, to: LEADERBOARD_CONFIG.contract, data, chainId: CHAIN_HEX }] });
    for (let i = 0; i < 120; i++) {
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      if (receipt) {
        if (receipt.status !== "0x1") throw new Error(t("nftFailed"));
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(t("nftSlow"));
  }

  // Si les prix enregistrés ne couvrent pas la course du concours (début de trimestre), le
  // départ serait refusé (DataBehind) : on enregistre d'abord les clôtures officielles.
  async function catchUp() {
    contest = await loadContest();
    const needed = contest.finishDay + FINISH_EVAL;
    const last = Number(words(await call(SEL.lastRecordedDay))[0]);
    if (last >= needed) return;
    const block = await rpc("eth_getBlockByNumber", ["latest", false]);
    const yesterday = Math.floor((Number(BigInt(block.timestamp)) - DATA_START) / 86_400) - 1;
    // Flux principal, ou le secours si le principal est muet et qu'un secours existe.
    const backup = `0x${(await call(SEL.BACKUP_FEED)).slice(-40)}`;
    const useBackup = !/^0x0{40}$/.test(backup) && BigInt(await call(SEL.mainFeedStale)) !== 0n;
    const feed = useBackup ? backup : `0x${(await call(SEL.FEED)).slice(-40)}`;
    const ids = await findCloses(feed, last + 1, yesterday, (done, total) => status(t("lbFindingRounds").replace("{done}", done).replace("{total}", total), "wait"));
    if (last + ids.length < needed) throw new Error(t("lbDataBehind"));
    for (let i = 0; i < ids.length; i += MAX_DAYS_PER_TX) {
      status(t("lbCatchUp"), "wait");
      await send((useBackup ? SEL.recordDayBackup : SEL.recordDay) + word(32) + uintArray(ids.slice(i, i + MAX_DAYS_PER_TX)));
    }
  }

  // 1. Départ signé (le contrat ne lit aucun prix : il marche même pendant une panne du flux),
  //    puis le jeu attend le prochain toucher. La course va de 2010 à la ligne d'arrivée du concours.
  async function startRanked() {
    await connect();
    await catchUp();
    status(t("lbLoadingCourse"), "wait");
    status(t("lbConfirmStart"), "wait");
    await send(SEL.startRun);
    contest = await loadContest();
    // Après le départ : la liste des baisses inclut celles que le contrat vient peut-être de trouver.
    const dips = await loadDips();
    window.dipGameController?.armRanked({ dips, endDay: contest.finishDay });
    lastRun = undefined;
    $("lb-submit-wrap").hidden = true;
    status(t("lbArmed"), "ok");
    document.getElementById("game").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // 2. Fin de partie classée : le contrat rejoue d'abord les touches (lecture gratuite) ;
  //    on n'envoie que s'il trouve exactement le même résultat que le jeu.
  async function submit() {
    if (!lastRun) throw new Error(t("lbPlayFirst"));
    const nick = $("lb-nick").value.trim();
    if (!NICK_PATTERN.test(nick)) throw new Error(t("lbNickRule"));
    await connect();
    const verified = words(await call(SEL.verify + word(64) + word(contest.finishDay) + uintArray(lastRun.taps))).map(Number);
    const mine = [lastRun.day, lastRun.caught, lastRun.coins, lastRun.score];
    if (mine.some((value, i) => value !== verified[i])) throw new Error(t("lbMismatch"));
    const best = words(await call(SEL.best + word(contest.id) + addressWord(account))).map(Number).slice(0, 4);
    const first = mine.findIndex((value, i) => value !== best[i]);
    if (first === -1 || mine[first] < best[first]) throw new Error(t("lbNotBetter").replace("{date}", DipGame.dateOf(best[0])));
    status(t("nftConfirmTx"), "wait");
    // submit(uint32[] taps, bytes32 nickname) : en-tête = position du tableau, pseudo ; puis le tableau.
    await send(SEL.submit + word(64) + nickWord(nick) + uintArray(lastRun.taps));
    status(t("lbSaved"), "ok");
    $("lb-submit-wrap").hidden = true;
    lastRun = undefined;
    await showTop();
  }

  async function run(task) {
    try {
      await task();
    } catch (error) {
      status(error?.message ?? String(error), "error");
    }
  }

  section.hidden = !live;
  if (!live) return;
  document.addEventListener("dipgameover", (event) => {
    const result = event.detail;
    if (!result.ranked) {
      $("lb-submit-wrap").hidden = true;
      status(t("lbCasual"));
      return;
    }
    lastRun = result;
    $("lb-result").textContent = t("lbYourRun")
      .replace("{date}", result.date)
      .replace("{caught}", result.caught)
      .replace("{coins}", result.coins)
      .replace("{score}", result.score);
    $("lb-submit-wrap").hidden = false;
    status("");
  });
  $("lb-ranked").addEventListener("click", () => run(startRanked));
  // Le visiteur change de compte ou de réseau dans son wallet : on oublie la partie en cours.
  window.ethereum?.on?.("accountsChanged", (accounts) => {
    account = accounts?.[0];
    lastRun = undefined;
    $("lb-submit-wrap").hidden = true;
    status("");
    run(showTop);
  });
  window.ethereum?.on?.("chainChanged", () => {
    status("");
    run(showTop);
  });
  $("lb-submit").addEventListener("click", () => run(submit));
  document.addEventListener("langchange", () => run(showTop));
  run(showTop);
  setInterval(() => run(showTop), 60_000);
})();

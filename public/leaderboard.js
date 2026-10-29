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
    recordDay: "0xb7e04c9b", // recordDay() : enregistre jusqu'à 60 jours de prix par appel
    daysBehind: "0x8ca809dc", // daysBehind() : jours de prix encore à enregistrer
  };
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
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
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
    const who = document.createElement("td");
    const link = document.createElement("a");
    link.href = `${EXPLORER}/address/${entry.player}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = entry.nick || short(entry.player);
    who.append(link);
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
  async function connect() {
    if (!window.ethereum) throw new Error(t("nftNoWallet"));
    [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    const chainId = `0x${LEADERBOARD_CONFIG.chainId.toString(16)}`;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
    } catch (error) {
      if (error.code !== 4902) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId, chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [LEADERBOARD_CONFIG.rpc], blockExplorerUrls: [EXPLORER] }],
      });
    }
  }

  async function send(data) {
    const hash = await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from: account, to: LEADERBOARD_CONFIG.contract, data }] });
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

  // 1. Départ signé (le contrat note aussi le prix du jour au passage), puis le jeu
  //    attend le prochain toucher. La course va de 2010 à la ligne d'arrivée du concours.
  async function startRanked() {
    await connect();
    // Si la courbe a pris du retard (personne n'a joué depuis longtemps), on la rattrape
    // d'abord, 60 jours par transaction, pour que le départ ne soit pas refusé.
    for (let i = 0; i < 20 && Number(words(await call(SEL.daysBehind))[0]) > 60; i++) {
      status(t("lbCatchUp"), "wait");
      await send(SEL.recordDay);
    }
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
  $("lb-submit").addEventListener("click", () => run(submit));
  document.addEventListener("langchange", () => run(showTop));
  run(showTop);
  setInterval(() => run(showTop), 60_000);
})();

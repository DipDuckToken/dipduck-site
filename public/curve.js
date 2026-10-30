// Courbe de lancement (contrat LaunchCurve du kit) : achat et revente du token avant
// l'ouverture du pool Uniswap.
//
// La courbe vend 87 % de l'offre (vendus + pool) à prix croissant : réserves VIRTUELLES
// (2 ETH virtuels), chaque achat fait monter le prix, chaque revente le fait baisser.
// Aucun owner, aucun frais. Quand TARGET_ETH (3 ETH) est réuni, l'achat qui l'atteint ouvre
// TOUT SEUL le pool Uniswap v2 (l'ETH réuni + le reste des tokens, au prix exact de fin de
// courbe) et envoie les parts LP à l'adresse morte : `graduated` passe à vrai, la courbe est
// fermée pour toujours et le bouton d'achat du site renvoie vers Uniswap (CONFIG.buyUrl).
//
// Anti-bot : rien avant OPEN_AT ; pendant 24 h ensuite, un wallet ne peut pas détenir plus de
// 0,5 % de l'offre (1re heure), 1 % (jusqu'à 6 h), 2 % (jusqu'à 24 h) : walletLimit().
// Le site prévient AVANT l'envoi et propose le maximum permis.
//
// Transactions en direct : événements Bought / Sold / Graduated lus avec eth_getLogs.
//
// Lecture seule sans wallet : eth_call sur le RPC public. Achat et revente par le wallet du
// visiteur (window.ethereum). Encodage ABI fait à la main, comme leaderboard.js et nft.js.

(() => {
  const section = document.getElementById("curve");
  if (!section) return;
  const RPC = "https://rpc.mainnet.chain.robinhood.com";
  const CHAIN = 4663;
  const CHAIN_HEX = `0x${CHAIN.toString(16)}`;
  const CURVE = CONFIG.curve;
  const live = isAddress(CURVE);
  // Sélecteurs : 4 premiers octets du keccak256 de chaque signature (vérifiés avec ethers).
  const SEL = {
    OPEN_AT: "0xd8f93498", // OPEN_AT()
    TARGET_ETH: "0xae2c1a6e", // TARGET_ETH()
    VIRTUAL_ETH: "0x6700c0c3", // VIRTUAL_ETH()
    VIRTUAL_TOKENS: "0xe90ceb9f", // VIRTUAL_TOKENS()
    TOKEN: "0x82bfefc8", // TOKEN()
    PAIR: "0xace3a8a7", // PAIR()
    ethReserve: "0xd62ccb3f", // ethReserve()
    tokensSold: "0x518ab2a8", // tokensSold()
    graduated: "0xe7c2b772", // graduated()
    walletLimit: "0x3c8463a1", // walletLimit() : 0 avant OPEN_AT, max(uint256) = aucune limite
    price: "0xa035b1fe", // price() : wei par token entier
    quoteBuy: "0x4beb394c", // quoteBuy(uint256) → (tokensOut, ethUsed)
    quoteSell: "0xa64190c4", // quoteSell(uint256) → ethOut
    buy: "0xd6febde8", // buy(uint256 minTokensOut, uint256 deadline), payable
    sell: "0xd3c9727c", // sell(uint256 tokensIn, uint256 minEthOut, uint256 deadline)
  };
  // ERC-20 du token.
  const TOKEN_SEL = {
    balanceOf: "0x70a08231", // balanceOf(address)
    allowance: "0xdd62ed3e", // allowance(address,address)
    approve: "0x095ea7b3", // approve(address,uint256)
    totalSupply: "0x18160ddd", // totalSupply()
  };
  // Erreurs du contrat (sélecteur → texte) : WalletLimit(uint256) a le même sélecteur côté token.
  const ERRORS = {
    "0xddafad98": "curveErrNotOpen", // NotOpen()
    "0x7dd37f70": "curveErrSlippage", // Slippage()
    "0xfb64dd5c": "curveErrWalletLimit", // WalletLimit(uint256 limit)
    "0x203d82d8": "curveErrExpired", // Expired()
    "0xe6a0d45f": "curveErrGraduated", // AlreadyGraduated()
    "0xa8908786": "curveErrTooMany", // TooManyTokens(uint256 max)
    "0x1f2a2005": "curveErrZero", // ZeroAmount()
  };
  // Événements de la courbe (topic0 = keccak256 de la signature, vérifié avec ethers).
  const TOPIC = {
    Bought: "0x27330bd7589580547b6437e08f9c60653de63691d2d2b2c13bff9ee67da2a68d", // Bought(address,uint256,uint256,uint256,uint256)
    Sold: "0x490fdc1c23c0f3a84bf80a0384eaadcb9188c9ef71b9430da391a0e4c4c39bf6", // Sold(address,uint256,uint256,uint256,uint256)
    Graduated: "0x71aa8c3702dbbc54247a4e6446450e64a46250dd72707a247ddb01d72eaef445", // Graduated(address,uint256,uint256,uint256,uint256)
  };
  const FEED_SIZE = 20; // transactions affichées
  const LOG_CHUNK = 50_000; // blocs par eth_getLogs au départ (réduit tout seul si le RPC refuse)
  const MIN_CHUNK = 1_000;
  const MAX_CHUNKS = 40; // recherche vers le passé bornée à chaque premier chargement
  const MAX = (1n << 256n) - 1n;
  const UNIT = 10n ** 18n;
  const DEADLINE_SECONDS = 600; // deadline = maintenant + 10 min
  const LIMIT_STEPS = [[3_600, "0.5"], [6 * 3_600, "1"], [24 * 3_600, "2"]]; // fin de palier (s après OPEN_AT), % de l'offre
  const $ = (id) => document.getElementById(id);
  let info; // constantes lues une fois
  let state; // état lu à chaque rafraîchissement
  let account;
  let busy = false;

  // ─── Encodage ABI minimal ─────────────────────────────────────────────────
  const word = (n) => BigInt(n).toString(16).padStart(64, "0");
  const addressWord = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const words = (hex) => (hex.replace(/^0x/, "").match(/.{64}/g) ?? []).map((w) => BigInt(`0x${w}`));
  const addressAt = (hex) => `0x${hex.replace(/^0x/, "").slice(24, 64)}`;

  // Montant tapé (« 0,05 » ou « 0.05 ») → unités de base, sans passer par un nombre à virgule.
  function parseAmount(text) {
    const clean = String(text || "").trim().replace(/[\s_]/g, "").replace(",", ".");
    if (!/^\d*\.?\d*$/.test(clean) || clean === "" || clean === ".") return 0n;
    const [whole, frac = ""] = clean.split(".");
    return BigInt(whole || "0") * UNIT + BigInt(frac.slice(0, 18).padEnd(18, "0"));
  }
  // Unités de base → texte exact pour un champ (au plus `decimals` décimales, arrondi vers le bas).
  function amountText(value, decimals = 18) {
    const whole = value / UNIT;
    const frac = (value % UNIT).toString().padStart(18, "0").slice(0, decimals).replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  }
  const locale = () => (currentLang === "zh" ? "zh-CN" : currentLang);
  const toNumber = (value) => Number(value / 10n ** 12n) / 1e6; // précision suffisante pour l'affichage
  const fmtEth = (value) => `${new Intl.NumberFormat(locale(), { maximumSignificantDigits: 5 }).format(toNumber(value))} ETH`;
  const fmtTokens = (value, compact = false) =>
    new Intl.NumberFormat(locale(), compact ? { notation: "compact", maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }).format(toNumber(value));
  const fill = (key, values) => Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, v), t(key));

  // ─── Lecture sur la chaîne ────────────────────────────────────────────────
  // Comme nft.js, mais l'erreur garde ses données : on y cherche l'erreur du contrat.
  async function rpc(method, params) {
    const response = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const body = await response.json();
    if (body.error) throw Object.assign(new Error(body.error.message), { data: body.error.data });
    return body.result;
  }
  const callTo = (to, data) => rpc("eth_call", [{ to, data }, "latest"]);
  const call = (data) => callTo(CURVE, data);
  const uint = async (data) => words(await call(data))[0];
  const tokenUint = async (data) => words(await callTo(info.token, data))[0];

  async function loadInfo() {
    const [openAt, target, vEth, vTokens] = await Promise.all([SEL.OPEN_AT, SEL.TARGET_ETH, SEL.VIRTUAL_ETH, SEL.VIRTUAL_TOKENS].map(uint));
    const [token, pair] = await Promise.all([call(SEL.TOKEN), call(SEL.PAIR)]).then((list) => list.map(addressAt));
    info = { openAt: Number(openAt) * 1000, target, vEth, vTokens, token, pair };
    // « Vérifie toi-même » (app.js) : les parts LP de la paire, lues ici dans la courbe.
    showVerify("v-lp", `${EXPLORER}/token/${pair}?tab=holders`);
    info.supply = await tokenUint(TOKEN_SEL.totalSupply);
  }

  async function loadState() {
    const [ethReserve, tokensSold, graduated, price, limit] = await Promise.all(
      [SEL.ethReserve, SEL.tokensSold, SEL.graduated, SEL.price, SEL.walletLimit].map(uint),
    );
    const balance = account ? await tokenUint(TOKEN_SEL.balanceOf + addressWord(account)) : undefined;
    state = { ethReserve, tokensSold, graduated: graduated === 1n, price, limit, balance };
  }

  async function quoteBuy(ethIn) {
    const [tokensOut, ethUsed] = words(await call(SEL.quoteBuy + word(ethIn)));
    return { tokensOut, ethUsed };
  }
  const quoteSell = (tokensIn) => uint(SEL.quoteSell + word(tokensIn));

  // ─── Erreurs lisibles ─────────────────────────────────────────────────────
  // Les wallets et les RPC rangent les données de revert à des endroits différents : on
  // cherche un sélecteur connu n'importe où dans l'erreur.
  function textOf(value, depth = 0) {
    if (value === null || value === undefined || depth > 5) return "";
    if (typeof value !== "object") return String(value);
    return [value.message, ...Object.values(value)].map((v) => textOf(v, depth + 1)).join(" ");
  }

  function readable(error) {
    if (error?.code === 4001) return t("curveRejected");
    const text = textOf(error).toLowerCase();
    for (const [selector, key] of Object.entries(ERRORS)) {
      const at = text.indexOf(selector);
      if (at === -1) continue;
      const arg = text.slice(at + 10, at + 74);
      const value = /^[0-9a-f]{64}$/.test(arg) ? BigInt(`0x${arg}`) : undefined;
      return fill(key, { limit: value === undefined ? "—" : fmtTokens(value), max: value === undefined ? "—" : fmtTokens(value) });
    }
    return error?.message ?? String(error);
  }

  // Simulation avant l'envoi (gratuite) : si le contrat refuserait, rien n'est envoyé.
  async function simulate(to, data, value = 0n) {
    await rpc("eth_call", [{ from: account, to, data, value: `0x${value.toString(16)}` }, "latest"]);
  }

  // ─── Wallet et transactions ───────────────────────────────────────────────
  // Avant chaque transaction : le wallet doit être sur Robinhood Chain (changement demandé si
  // besoin, puis relu) ; sinon rien n'est envoyé.
  async function ensureChain() {
    const onChain = async () => Number(await window.ethereum.request({ method: "eth_chainId" })) === CHAIN;
    if (await onChain()) return;
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } catch (error) {
      if (error.code !== 4902) throw new Error(t("nftWrongChain"));
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: CHAIN_HEX, chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: [EXPLORER] }],
      });
    }
    if (!(await onChain())) throw new Error(t("nftWrongChain"));
  }

  async function connect() {
    if (!window.ethereum) throw new Error(t("nftNoWallet"));
    [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    await ensureChain();
    return account;
  }

  async function send(to, data, value = 0n) {
    await ensureChain();
    const hash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to, data, value: `0x${value.toString(16)}`, chainId: CHAIN_HEX }],
    });
    status(`${t("nftPending")} ${hash.slice(0, 10)}…`, "wait");
    for (let i = 0; i < 180; i++) {
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      if (receipt) {
        if (receipt.status !== "0x1") throw new Error(t("curveFailed"));
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(t("nftSlow"));
  }

  function status(text, kind = "") {
    $("curve-status").textContent = text;
    $("curve-status").dataset.kind = kind;
  }

  const deadline = () => word(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
  // Glissement accepté, en points de base (1 % par défaut, entre 0,1 % et 20 %).
  function slippageBps() {
    const pct = Number(String($("curve-slippage").value).replace(",", "."));
    return BigInt(Math.round(Math.min(20, Math.max(0.1, Number.isFinite(pct) ? pct : 1)) * 100));
  }
  const withSlippage = (amount) => (amount * (10_000n - slippageBps())) / 10_000n;

  // Plus grand achat (en ETH) qui laisse le wallet sous la limite : inverse de la courbe
  // (x × y = K), puis vérifié avec quoteBuy et réduit si l'arrondi déborde.
  async function maxBuyEth(room) {
    const k = info.vEth * info.vTokens;
    const x = info.vEth + state.ethReserve;
    const y = info.vTokens - state.tokensSold;
    if (room <= 0n || room >= y) return 0n;
    let eth = k / (y - room) - x;
    const ethRoom = info.target - state.ethReserve;
    if (eth >= ethRoom) eth = ethRoom - 1n;
    eth -= eth % 10n ** 12n; // 6 décimales : lisible dans le champ
    for (let i = 0; i < 8 && eth > 0n; i++) {
      if ((await quoteBuy(eth)).tokensOut <= room) return eth;
      eth = (eth * 995n) / 1000n;
      eth -= eth % 10n ** 12n;
    }
    return 0n;
  }

  // ─── Achat ────────────────────────────────────────────────────────────────
  async function buy() {
    const input = $("curve-buy-form").elements.eth;
    const ethIn = parseAmount(input.value);
    if (ethIn === 0n) throw new Error(t("curveBadAmount"));
    await connect();
    await loadState();
    if (state.graduated) throw new Error(t("curveErrGraduated"));
    if (Date.now() < info.openAt) throw new Error(t("curveErrNotOpen"));
    const { tokensOut, ethUsed } = await quoteBuy(ethIn);
    if (tokensOut === 0n) throw new Error(t("curveBadAmount"));
    // Limite par wallet : prévenir avant l'envoi et proposer le maximum permis.
    if (state.limit !== MAX && state.balance + tokensOut > state.limit) {
      const room = state.limit > state.balance ? state.limit - state.balance : 0n;
      const max = await maxBuyEth(room);
      if (max === 0n) throw new Error(fill("curveLimitReached", { limit: fmtTokens(state.limit) }));
      input.value = amountText(max, 6);
      await previewBuy();
      throw new Error(fill("curveOverLimit", { limit: fmtTokens(state.limit), max: fmtEth(max) }));
    }
    const data = SEL.buy + word(withSlippage(tokensOut)) + deadline();
    await simulate(CURVE, data, ethIn);
    status(ethUsed < ethIn ? fill("curveConfirmRefund", { used: fmtEth(ethUsed) }) : t("nftConfirmTx"), "wait");
    await send(CURVE, data, ethIn);
    input.value = "";
    $("curve-buy-quote").textContent = "";
    status(t("curveBought"), "ok");
    await refresh();
    await refreshFeed();
  }

  // ─── Revente ──────────────────────────────────────────────────────────────
  async function sell() {
    const input = $("curve-sell-form").elements.tokens;
    const tokensIn = parseAmount(input.value);
    if (tokensIn === 0n) throw new Error(t("curveBadAmount"));
    await connect();
    await loadState();
    if (state.graduated) throw new Error(t("curveErrGraduated"));
    if (Date.now() < info.openAt) throw new Error(t("curveErrNotOpen"));
    if (tokensIn > state.balance) throw new Error(fill("curveNotEnough", { tokens: fmtTokens(state.balance) }));
    if (tokensIn > state.tokensSold) throw new Error(fill("curveErrTooMany", { max: fmtTokens(state.tokensSold) }));
    const ethOut = await quoteSell(tokensIn);
    if (ethOut === 0n) throw new Error(t("curveBadAmount"));
    // La courbe reprend les tokens par transferFrom : autorisation d'abord, si elle ne suffit pas.
    const allowance = await tokenUint(TOKEN_SEL.allowance + addressWord(account) + addressWord(CURVE));
    if (allowance < tokensIn) {
      status(t("curveApprove"), "wait");
      await send(info.token, TOKEN_SEL.approve + addressWord(CURVE) + word(tokensIn));
    }
    const data = SEL.sell + word(tokensIn) + word(withSlippage(ethOut)) + deadline();
    await simulate(CURVE, data);
    status(t("nftConfirmTx"), "wait");
    await send(CURVE, data);
    input.value = "";
    $("curve-sell-quote").textContent = "";
    status(t("curveSold"), "ok");
    await refresh();
    await refreshFeed();
  }

  // ─── Aperçus (quoteBuy / quoteSell, gratuits) ─────────────────────────────
  async function previewBuy() {
    const out = $("curve-buy-quote");
    const ethIn = parseAmount($("curve-buy-form").elements.eth.value);
    if (ethIn === 0n || !state || state.graduated) {
      out.textContent = "";
      return;
    }
    const { tokensOut, ethUsed } = await quoteBuy(ethIn);
    const lines = [fill("curveQuoteBuy", { tokens: fmtTokens(tokensOut), min: fmtTokens(withSlippage(tokensOut)) })];
    if (ethUsed < ethIn) lines.push(fill("curveQuoteRefund", { used: fmtEth(ethUsed) }));
    if (account && state.balance !== undefined && state.limit !== MAX && state.balance + tokensOut > state.limit) {
      lines.push(fill("curveQuoteOverLimit", { limit: fmtTokens(state.limit) }));
    }
    out.textContent = lines.join(" ");
  }

  async function previewSell() {
    const out = $("curve-sell-quote");
    const tokensIn = parseAmount($("curve-sell-form").elements.tokens.value);
    if (tokensIn === 0n || !state || state.graduated) {
      out.textContent = "";
      return;
    }
    if (tokensIn > state.tokensSold) {
      out.textContent = fill("curveErrTooMany", { max: fmtTokens(state.tokensSold) });
      return;
    }
    const ethOut = await quoteSell(tokensIn);
    out.textContent = fill("curveQuoteSell", { eth: fmtEth(ethOut), min: fmtEth(withSlippage(ethOut)) });
  }

  // Un aperçu à la fois, 300 ms après la dernière frappe.
  function debounce(task) {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => task().catch(() => {}), 300);
    };
  }

  // ─── Transactions en direct (eth_getLogs) ─────────────────────────────────
  // Le RPC public limite la plage de blocs : lecture par tranches depuis la fin (une tranche
  // refusée est coupée en deux), puis seulement les nouveaux blocs à chaque rafraîchissement.
  // Si eth_getLogs échoue quand même, la liste laisse la place au lien Blockscout.
  let feed = []; // du plus récent au plus ancien
  let scannedTo; // dernier bloc déjà lu
  let chunk = LOG_CHUNK;
  let feedBroken = false;
  const blockTimes = new Map();
  const hexBlock = (n) => `0x${n.toString(16)}`;

  async function logsBetween(from, to) {
    try {
      return await rpc("eth_getLogs", [{ address: CURVE, fromBlock: hexBlock(from), toBlock: hexBlock(to), topics: [[TOPIC.Bought, TOPIC.Sold, TOPIC.Graduated]] }]);
    } catch (error) {
      if (to - from + 1 <= MIN_CHUNK) throw error;
      const mid = from + Math.floor((to - from) / 2);
      chunk = Math.max(MIN_CHUNK, mid - from + 1);
      return [...(await logsBetween(from, mid)), ...(await logsBetween(mid + 1, to))];
    }
  }

  // Bought / Graduated : (ethIn, tokensOut, …) ; Sold : (tokensIn, ethOut, …).
  function parseLog(log) {
    const w = words(log.data);
    const kind = log.topics[0] === TOPIC.Sold ? "sell" : log.topics[0] === TOPIC.Graduated ? "pool" : "buy";
    return {
      kind,
      eth: kind === "sell" ? w[1] : w[0],
      tokens: kind === "sell" ? w[0] : w[1],
      who: `0x${log.topics[1].slice(26)}`,
      tx: log.transactionHash,
      block: Number(log.blockNumber),
      time: log.blockTimestamp ? Number(log.blockTimestamp) * 1000 : undefined,
    };
  }

  async function loadFeed() {
    const latest = Number(await rpc("eth_blockNumber", []));
    const start = Math.max(0, Number(CONFIG.curveFromBlock) || 0);
    if (scannedTo === undefined) {
      // Premier chargement : de la fin vers le passé, jusqu'à FEED_SIZE transactions.
      const found = [];
      let to = latest;
      for (let i = 0; i < MAX_CHUNKS && to >= start && found.length < FEED_SIZE; i++) {
        const from = Math.max(start, to - chunk + 1);
        found.push(...(await logsBetween(from, to)).reverse());
        to = from - 1;
      }
      feed = found.map(parseLog).slice(0, FEED_SIZE);
    } else if (latest > scannedTo) {
      const fresh = [];
      for (let from = scannedTo + 1; from <= latest; from += chunk) fresh.push(...(await logsBetween(from, Math.min(latest, from + chunk - 1))));
      feed = [...fresh.reverse().map(parseLog), ...feed].slice(0, FEED_SIZE);
    }
    scannedTo = latest;
    // Heure de chaque transaction : celle de son bloc (gardée en mémoire).
    const missing = [...new Set(feed.filter((e) => e.time === undefined && !blockTimes.has(e.block)).map((e) => e.block))];
    await Promise.all(missing.map(async (n) => {
      const block = await rpc("eth_getBlockByNumber", [hexBlock(n), false]);
      if (block) blockTimes.set(n, Number(block.timestamp) * 1000);
    }));
    for (const e of feed) e.time ??= blockTimes.get(e.block);
    feedBroken = false;
  }

  function feedCell(text, className = "") {
    const td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function renderFeed() {
    $("curve-feed-error").hidden = !feedBroken;
    $("curve-feed-empty").hidden = feedBroken || scannedTo === undefined || feed.length > 0;
    $("curve-feed-wrap").hidden = feedBroken || feed.length === 0;
    $("curve-feed-all").href = `${EXPLORER}/address/${CURVE}`;
    const when = new Intl.DateTimeFormat(locale(), { dateStyle: "short", timeStyle: "short" });
    const labels = { buy: "curveFeedBuy", sell: "curveFeedSell", pool: "curveFeedPool" };
    $("curve-feed-body").replaceChildren(...feed.map((e) => {
      const tr = document.createElement("tr");
      // Wallet abrégé ; le lien mène à la transaction sur Blockscout.
      const link = document.createElement("a");
      link.href = `${EXPLORER}/tx/${e.tx}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `${e.who.slice(0, 6)}…${e.who.slice(-4)}`;
      const whoCell = feedCell("");
      whoCell.append(link);
      tr.append(
        feedCell(t(labels[e.kind]), e.kind === "sell" ? "out" : "in"),
        feedCell(fmtEth(e.eth), "num"),
        feedCell(fmtTokens(e.tokens, true), "num"),
        feedCell(e.time ? when.format(e.time) : "—"),
        whoCell,
      );
      return tr;
    }));
  }

  async function refreshFeed() {
    try {
      await loadFeed();
    } catch {
      feedBroken = true;
    }
    renderFeed();
  }

  // ─── Affichage ────────────────────────────────────────────────────────────
  const clock = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 3_600)}:${String(Math.floor((s % 3_600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  // Limite par wallet : palier en cours (% de l'offre) et temps avant le palier suivant.
  function renderLimit() {
    const box = $("curve-limit");
    const when = $("curve-limit-when");
    const elapsed = (Date.now() - info.openAt) / 1000;
    if (elapsed < 0) {
      box.textContent = "0.5 %";
      when.textContent = t("curveLimitAtOpen");
      return;
    }
    const step = LIMIT_STEPS.find(([end]) => elapsed < end);
    if (!step || state.graduated) {
      box.textContent = t("curveNoLimit");
      when.textContent = state.graduated ? t("curveLimitToken") : "";
      return;
    }
    const pct = `${Number(step[1]).toLocaleString(locale())} %`;
    box.textContent = state.limit !== MAX && state.limit > 0n ? fmtTokens(state.limit, true) : pct;
    const key = step === LIMIT_STEPS.at(-1) ? "curveLimitEnds" : "curveLimitNext";
    when.textContent = fill(key, { pct, time: clock(step[0] - elapsed) });
  }

  function render() {
    const now = Date.now();
    const before = now < info.openAt;
    const done = state.graduated;
    const raised = done ? info.target : state.ethReserve;
    $("curve-raised").textContent = `${fmtEth(raised).replace(" ETH", "")} / ${fmtEth(info.target)}`;
    $("curve-progress").style.setProperty("--done", `${Math.min(100, Number((raised * 10_000n) / info.target) / 100)}%`);
    // Prix pour 1 million de tokens : plus lisible qu'un prix par token (minuscule).
    $("curve-price").textContent = done ? "—" : fmtEth(state.price * 1_000_000n);
    $("curve-mine").textContent = state.balance === undefined ? "—" : fmtTokens(state.balance, true);
    renderLimit();
    $("curve-trade").hidden = before || done;
    $("curve-connect").hidden = Boolean(account) || done;
    $("curve-done").hidden = !done;
    $("curve-opens").hidden = !before;
    if (before) {
      const date = new Intl.DateTimeFormat(locale(), { dateStyle: "long", timeStyle: "short" }).format(info.openAt);
      $("curve-opens").textContent = fill("curveOpensAt", { date });
    }
    $("curve-contract").href = `${EXPLORER}/address/${CURVE}`;
    $("curve-pair").href = `${EXPLORER}/address/${info.pair}`;
    const uniswap = $("curve-uniswap");
    uniswap.hidden = !CONFIG.buyUrl;
    if (CONFIG.buyUrl) uniswap.href = CONFIG.buyUrl;
    setBuyLinks(done && CONFIG.buyUrl ? CONFIG.buyUrl : "#curve", done && Boolean(CONFIG.buyUrl));
  }

  // Bouton d'achat principal : vers cette section tant que la courbe est ouverte, puis Uniswap.
  function setBuyLinks(url, external) {
    for (const el of document.querySelectorAll(".buy-link")) {
      el.href = url;
      el.removeAttribute("aria-disabled");
      if (external) {
        el.target = "_blank";
        el.rel = "noopener";
      } else {
        el.removeAttribute("target");
        el.removeAttribute("rel");
      }
    }
  }

  // ─── Compte à rebours jusqu'à OPEN_AT (lu dans le contrat) ────────────────
  let countdownTimer;
  function countdown() {
    clearTimeout(countdownTimer);
    const box = $("curve-countdown");
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const left = Math.max(0, Math.floor((info.openAt - Date.now()) / 1000));
      box.hidden = left === 0 || state.graduated;
      $("curve-cd-d").textContent = Math.floor(left / 86_400);
      $("curve-cd-h").textContent = pad(Math.floor((left % 86_400) / 3_600));
      $("curve-cd-m").textContent = pad(Math.floor((left % 3_600) / 60));
      $("curve-cd-s").textContent = pad(left % 60);
      if (left > 0) countdownTimer = setTimeout(tick, 1000);
      else run(refresh); // ouverture : on relit l'état une fois
    };
    if (info.openAt > Date.now()) tick();
    else box.hidden = true;
  }

  async function refresh() {
    if (!info) await loadInfo();
    await loadState();
    render();
  }

  async function run(task) {
    try {
      await task();
    } catch (error) {
      status(readable(error), "error");
    }
  }

  // Action du visiteur : une seule à la fois (pas de double envoi).
  async function act(task) {
    if (busy) return;
    busy = true;
    await run(task);
    busy = false;
  }

  section.hidden = !live;
  if (!live) return;
  // Tant que la courbe est configurée, le bouton d'achat mène à cette section.
  setBuyLinks("#curve", false);

  $("curve-buy-form").addEventListener("submit", (event) => {
    event.preventDefault();
    act(buy);
  });
  $("curve-sell-form").addEventListener("submit", (event) => {
    event.preventDefault();
    act(sell);
  });
  $("curve-buy-form").elements.eth.addEventListener("input", debounce(previewBuy));
  $("curve-sell-form").elements.tokens.addEventListener("input", debounce(previewSell));
  $("curve-slippage").addEventListener("input", debounce(() => Promise.all([previewBuy(), previewSell()])));
  $("curve-sell-max").addEventListener("click", () => act(async () => {
    await connect();
    await loadState();
    $("curve-sell-form").elements.tokens.value = amountText(state.balance < state.tokensSold ? state.balance : state.tokensSold);
    render();
    await previewSell();
  }));
  $("curve-connect").addEventListener("click", () => act(async () => {
    await connect();
    status("");
    await refresh();
  }));
  document.addEventListener("langchange", () => {
    if (info && state) {
      render();
      previewBuy().catch(() => {});
      previewSell().catch(() => {});
      renderFeed();
    }
  });
  // Le visiteur change de compte ou de réseau : on relit l'état.
  window.ethereum?.on?.("accountsChanged", (accounts) => {
    account = accounts?.[0];
    status("");
    run(refresh);
  });
  window.ethereum?.on?.("chainChanged", () => {
    status("");
    run(refresh);
  });

  (async () => {
    // Déjà autorisé lors d'une visite précédente : solde affiché sans fenêtre du wallet.
    try {
      if (window.ethereum) [account] = await window.ethereum.request({ method: "eth_accounts" });
    } catch {
      account = undefined;
    }
    await run(refresh);
    if (info) countdown();
    await refreshFeed();
    // Relecture régulière ; la limite et son temps restant bougent chaque seconde.
    setInterval(() => {
      if (state?.graduated) return;
      refresh().catch(() => {}); // silencieux : ne cache pas un message en cours
      refreshFeed();
    }, 15_000);
    setInterval(() => {
      if (info && state && !state.graduated) renderLimit();
    }, 1_000);
  })();
})();

// Lancement sur Uniswap v3 (contrat LaunchPool du kit) : achat et revente dans le pool officiel.
//
// LaunchPool a déployé le token et créé son pool TOKEN/WETH à 1 % de frais, rempli D'UN SEUL
// CÔTÉ : ≈ 87 % de l'offre (que des tokens) placés du prix de départ jusqu'à l'infini. Chaque
// achat fait monter le prix, l'ETH des acheteurs reste dans le pool, chacun revend quand il veut.
// La position Uniswap (NFT = clé du pool) reste pour toujours dans LaunchPool, qui n'a aucune
// fonction pour la retirer : liquidité verrouillée à vie. Les frais d'échange de la position
// vont au Safe communauté (collectFees, appelable par tous). Le créateur n'apporte aucun ETH.
//
// Anti-bot (appliqué par le token) : aucun achat avant OPEN_AT ; pendant 24 h ensuite, un wallet
// ne peut pas détenir plus de 0,5 % de l'offre (1re heure), 1 % (jusqu'à 6 h), 2 % (jusqu'à 24 h).
// Le site prévient AVANT l'envoi et propose le maximum permis.
//
// Échanges par les contrats officiels d'Uniswap sur Robinhood Chain : QuoterV2 pour l'aperçu
// (eth_call), SwapRouter02 pour l'envoi. Transactions en direct : événements Swap du pool.
// Lecture seule sans wallet (RPC public). Encodage ABI fait à la main, comme leaderboard.js et nft.js.

(() => {
  const section = document.getElementById("launch");
  if (!section) return;
  const RPC = "https://rpc.mainnet.chain.robinhood.com";
  const CHAIN = 4663;
  const CHAIN_HEX = `0x${CHAIN.toString(16)}`;
  const LAUNCHER = CONFIG.launcher;
  const live = isAddress(LAUNCHER);
  // Contrats officiels d'Uniswap v3 sur Robinhood Chain.
  const ROUTER = "0xcaf681a66d020601342297493863e78c959e5cb2"; // SwapRouter02
  const QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7"; // QuoterV2
  const ROUTER_SELF = "0x0000000000000000000000000000000000000002"; // « le routeur lui-même » (ADDRESS_THIS)
  const FEE = 10_000n; // 1 %, niveau de frais du pool (FEE de LaunchPool)
  // Sélecteurs : 4 premiers octets du keccak256 de chaque signature (vérifiés avec ethers).
  const SEL = {
    OPEN_AT: "0xd8f93498", // OPEN_AT()
    TOKEN: "0x82bfefc8", // TOKEN()
    POOL: "0x7535d246", // POOL()
    WETH: "0xad5c4648", // WETH()
    POSITION_MANAGER: "0x1bea83fe", // POSITION_MANAGER()
    POSITION_ID: "0xd7ac71ff", // POSITION_ID()
  };
  const POOL_SEL = {
    slot0: "0x3850c7bd", // slot0() → (sqrtPriceX96, tick, …)
    token0: "0x0dfe1681", // token0()
  };
  const TOKEN_SEL = {
    walletLimit: "0x3c8463a1", // walletLimit() : max(uint256) = aucune limite
    balanceOf: "0x70a08231", // balanceOf(address)
    allowance: "0xdd62ed3e", // allowance(address,address)
    approve: "0x095ea7b3", // approve(address,uint256)
    totalSupply: "0x18160ddd", // totalSupply()
  };
  const SWAP_SEL = {
    exactInputSingle: "0x04e45aaf", // exactInputSingle((tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96)), payable
    multicall: "0x5ae401dc", // multicall(uint256 deadline, bytes[] data)
    unwrapWETH9: "0x49404b7c", // unwrapWETH9(uint256 amountMinimum, address recipient)
    quote: "0xc6a5026a", // QuoterV2.quoteExactInputSingle((tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96)) → (amountOut, …)
  };
  // Erreurs du token (sélecteur → texte) et messages d'Uniswap (texte → texte).
  const ERRORS = {
    "0xfb64dd5c": "launchErrWalletLimit", // WalletLimit(uint256 limit)
    "0x14356134": "launchErrNotOpen", // PoolNotOpen()
  };
  const UNISWAP_ERRORS = [
    ["too little received", "launchErrSlippage"],
    ["insufficient weth9", "launchErrSlippage"],
    ["transaction too old", "launchErrExpired"],
  ];
  // Événement Swap du pool v3 (topic0 = keccak256 de la signature, vérifié avec ethers).
  const SWAP_TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"; // Swap(address,address,int256,int256,uint160,uint128,int24)
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
  const signed = (w) => (w >= 1n << 255n ? w - (1n << 256n) : w); // int256
  const abs = (n) => (n < 0n ? -n : n);
  // bytes[] : longueur, positions (depuis le début de la liste), puis chaque élément complété à 32 octets.
  function bytesArray(items) {
    const bodies = items.map((hex) => {
      const raw = hex.replace(/^0x/, "");
      return word(raw.length / 2) + raw.padEnd(Math.ceil(raw.length / 64) * 64, "0");
    });
    let offset = items.length * 32;
    const heads = bodies.map((body) => {
      const head = word(offset);
      offset += body.length / 2;
      return head;
    });
    return word(items.length) + heads.join("") + bodies.join("");
  }

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
  const fmtNumber = (n) => new Intl.NumberFormat(locale(), { maximumSignificantDigits: 5 }).format(n);
  const fmtEth = (value) => `${fmtNumber(toNumber(value))} ETH`;
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
  const uintAt = async (to, data) => words(await callTo(to, data))[0];
  const addressOf = async (to, data) => addressAt(await callTo(to, data));

  async function loadInfo() {
    const [token, pool, weth, npm] = await Promise.all([SEL.TOKEN, SEL.POOL, SEL.WETH, SEL.POSITION_MANAGER].map((s) => addressOf(LAUNCHER, s)));
    const [openAt, positionId] = await Promise.all([SEL.OPEN_AT, SEL.POSITION_ID].map((s) => uintAt(LAUNCHER, s)));
    const [token0, supply] = await Promise.all([addressOf(pool, POOL_SEL.token0), uintAt(token, TOKEN_SEL.totalSupply)]);
    info = { openAt: Number(openAt) * 1000, token, pool, weth, npm, positionId, supply, tokenIs0: token0.toLowerCase() === token.toLowerCase() };
    // « Vérifie toi-même » (app.js) : la position (NFT) et le pool, lus ici dans LaunchPool.
    showVerify("v-position", `${EXPLORER}/token/${npm}/instance/${positionId}`);
    showVerify("v-pool", `${EXPLORER}/address/${pool}`);
  }

  async function loadState() {
    const [slot0, wethInPool, limit] = await Promise.all([
      callTo(info.pool, POOL_SEL.slot0),
      uintAt(info.weth, TOKEN_SEL.balanceOf + addressWord(info.pool)),
      uintAt(info.token, TOKEN_SEL.walletLimit),
    ]);
    const balance = account ? await uintAt(info.token, TOKEN_SEL.balanceOf + addressWord(account)) : undefined;
    state = { sqrtPrice: words(slot0)[0], wethInPool, limit, balance };
  }

  // Prix d'un token en ETH, depuis slot0 (même nombre de décimales des deux côtés).
  function priceEth() {
    const ratio = Number(state.sqrtPrice) / 2 ** 96;
    const p = ratio * ratio; // token1 par token0
    return info.tokenIs0 ? p : 1 / p;
  }

  // QuoterV2 (eth_call) : sortie exacte d'un échange, frais compris. Échoue si le token refuse
  // (avant l'ouverture, ou montant au-dessus de la limite par wallet).
  async function quote(tokenIn, tokenOut, amountIn) {
    const data = SWAP_SEL.quote + addressWord(tokenIn) + addressWord(tokenOut) + word(amountIn) + word(FEE) + word(0);
    return words(await callTo(QUOTER, data))[0];
  }
  const quoteBuy = (ethIn) => quote(info.weth, info.token, ethIn);
  const quoteSell = (tokensIn) => quote(info.token, info.weth, tokensIn);
  const limitActive = () => state.limit !== MAX;

  // ─── Erreurs lisibles ─────────────────────────────────────────────────────
  // Les wallets et les RPC rangent les données de revert à des endroits différents : on
  // cherche un sélecteur ou un message connu n'importe où dans l'erreur.
  function textOf(value, depth = 0) {
    if (value === null || value === undefined || depth > 5) return "";
    if (typeof value !== "object") return String(value);
    return [value.message, ...Object.values(value)].map((v) => textOf(v, depth + 1)).join(" ");
  }

  function readable(error) {
    if (error?.code === 4001) return t("launchRejected");
    const text = textOf(error).toLowerCase();
    for (const [selector, key] of Object.entries(ERRORS)) {
      const at = text.indexOf(selector);
      if (at === -1) continue;
      const arg = text.slice(at + 10, at + 74);
      const value = /^[0-9a-f]{64}$/.test(arg) ? BigInt(`0x${arg}`) : undefined;
      return fill(key, { limit: value === undefined ? "—" : fmtTokens(value) });
    }
    for (const [needle, key] of UNISWAP_ERRORS) if (text.includes(needle)) return t(key);
    return error?.message ?? String(error);
  }

  // Simulation avant l'envoi (gratuite) : si l'échange serait refusé, rien n'est envoyé.
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
        if (receipt.status !== "0x1") throw new Error(t("launchFailed"));
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error(t("nftSlow"));
  }

  function status(text, kind = "") {
    $("launch-status").textContent = text;
    $("launch-status").dataset.kind = kind;
  }

  const deadline = () => Math.floor(Date.now() / 1000) + DEADLINE_SECONDS;
  // Glissement accepté, en points de base (1 % par défaut, entre 0,1 % et 20 %).
  function slippageBps() {
    const pct = Number(String($("launch-slippage").value).replace(",", "."));
    return BigInt(Math.round(Math.min(20, Math.max(0.1, Number.isFinite(pct) ? pct : 1)) * 100));
  }
  const withSlippage = (amount) => (amount * (10_000n - slippageBps())) / 10_000n;

  // Plus grand achat (en ETH) qui laisse le wallet sous la limite : recherche par dichotomie avec
  // QuoterV2 (une cotation refusée par le token compte comme « trop »).
  async function maxBuyEth(room) {
    if (room <= 0n) return 0n;
    const fits = async (eth) => {
      try {
        return (await quoteBuy(eth)) <= room;
      } catch {
        return false;
      }
    };
    let lo = 0n;
    let hi = 10n ** 15n; // 0,001 ETH, doublé tant que ça passe
    for (let i = 0; i < 24 && (await fits(hi)); i++) {
      lo = hi;
      hi *= 2n;
    }
    for (let i = 0; i < 18 && hi - lo > 10n ** 12n; i++) {
      const mid = (lo + hi) / 2n;
      if (await fits(mid)) lo = mid;
      else hi = mid;
    }
    return lo - (lo % 10n ** 12n); // 6 décimales : lisible dans le champ
  }

  // ─── Achat : ETH → token (exactInputSingle payable, le routeur emballe l'ETH) ──
  async function buy() {
    const input = $("launch-buy-form").elements.eth;
    const ethIn = parseAmount(input.value);
    if (ethIn === 0n) throw new Error(t("launchBadAmount"));
    await connect();
    await loadState();
    if (Date.now() < info.openAt) throw new Error(t("launchErrNotOpen"));
    let tokensOut;
    try {
      tokensOut = await quoteBuy(ethIn);
    } catch (error) {
      // Pendant les 24 h de limite, le token refuse aussi la cotation d'un trop gros achat.
      if (!limitActive()) throw new Error(readable(error));
    }
    // Limite par wallet : prévenir avant l'envoi et proposer le maximum permis.
    if (limitActive() && (tokensOut === undefined || state.balance + tokensOut > state.limit)) {
      const room = state.limit > state.balance ? state.limit - state.balance : 0n;
      const max = await maxBuyEth(room);
      if (max === 0n) throw new Error(fill("launchLimitReached", { limit: fmtTokens(state.limit) }));
      input.value = amountText(max, 6);
      await previewBuy();
      throw new Error(fill("launchOverLimit", { limit: fmtTokens(state.limit), max: fmtEth(max) }));
    }
    if (!tokensOut) throw new Error(t("launchBadAmount"));
    const data = SWAP_SEL.exactInputSingle + addressWord(info.weth) + addressWord(info.token) + word(FEE) + addressWord(account) + word(ethIn) + word(withSlippage(tokensOut)) + word(0);
    await simulate(ROUTER, data, ethIn);
    status(t("nftConfirmTx"), "wait");
    await send(ROUTER, data, ethIn);
    input.value = "";
    $("launch-buy-quote").textContent = "";
    status(t("launchBought"), "ok");
    await refresh();
    await refreshFeed();
  }

  // ─── Revente : token → WETH (gardé par le routeur) → ETH vers le vendeur ─────
  // multicall(deadline, [exactInputSingle(destinataire = routeur), unwrapWETH9(minimum, vendeur)])
  async function sell() {
    const input = $("launch-sell-form").elements.tokens;
    const tokensIn = parseAmount(input.value);
    if (tokensIn === 0n) throw new Error(t("launchBadAmount"));
    await connect();
    await loadState();
    if (Date.now() < info.openAt) throw new Error(t("launchErrNotOpen"));
    if (tokensIn > state.balance) throw new Error(fill("launchNotEnough", { tokens: fmtTokens(state.balance) }));
    const ethOut = await quoteSell(tokensIn).catch((error) => {
      throw new Error(readable(error));
    });
    if (ethOut === 0n) throw new Error(t("launchBadAmount"));
    // Le routeur prend les tokens par transferFrom : autorisation d'abord, si elle ne suffit pas.
    const allowance = await uintAt(info.token, TOKEN_SEL.allowance + addressWord(account) + addressWord(ROUTER));
    if (allowance < tokensIn) {
      status(t("launchApprove"), "wait");
      await send(info.token, TOKEN_SEL.approve + addressWord(ROUTER) + word(tokensIn));
    }
    const minEth = withSlippage(ethOut);
    const swap = SWAP_SEL.exactInputSingle + addressWord(info.token) + addressWord(info.weth) + word(FEE) + addressWord(ROUTER_SELF) + word(tokensIn) + word(minEth) + word(0);
    const unwrap = SWAP_SEL.unwrapWETH9 + word(minEth) + addressWord(account);
    const data = SWAP_SEL.multicall + word(deadline()) + word(64) + bytesArray([swap, unwrap]);
    await simulate(ROUTER, data);
    status(t("nftConfirmTx"), "wait");
    await send(ROUTER, data);
    input.value = "";
    $("launch-sell-quote").textContent = "";
    status(t("launchSold"), "ok");
    await refresh();
    await refreshFeed();
  }

  // ─── Aperçus (QuoterV2, gratuits) ─────────────────────────────────────────
  async function previewBuy() {
    const out = $("launch-buy-quote");
    const ethIn = parseAmount($("launch-buy-form").elements.eth.value);
    if (ethIn === 0n || !state) {
      out.textContent = "";
      return;
    }
    let tokensOut;
    try {
      tokensOut = await quoteBuy(ethIn);
    } catch {
      out.textContent = limitActive() ? fill("launchQuoteOverLimit", { limit: fmtTokens(state.limit) }) : t("launchErrQuote");
      return;
    }
    const lines = [fill("launchQuoteBuy", { tokens: fmtTokens(tokensOut), min: fmtTokens(withSlippage(tokensOut)) })];
    if (limitActive() && state.balance !== undefined && state.balance + tokensOut > state.limit) {
      lines.push(fill("launchQuoteOverLimit", { limit: fmtTokens(state.limit) }));
    }
    out.textContent = lines.join(" ");
  }

  async function previewSell() {
    const out = $("launch-sell-quote");
    const tokensIn = parseAmount($("launch-sell-form").elements.tokens.value);
    if (tokensIn === 0n || !state) {
      out.textContent = "";
      return;
    }
    try {
      const ethOut = await quoteSell(tokensIn);
      out.textContent = fill("launchQuoteSell", { eth: fmtEth(ethOut), min: fmtEth(withSlippage(ethOut)) });
    } catch {
      out.textContent = t("launchErrQuote");
    }
  }

  // Un aperçu à la fois, 300 ms après la dernière frappe.
  function debounce(task) {
    let timer;
    return () => {
      clearTimeout(timer);
      timer = setTimeout(() => task().catch(() => {}), 300);
    };
  }

  // ─── Transactions en direct (événements Swap du pool, eth_getLogs) ─────────
  // Le RPC public limite la plage de blocs : lecture par tranches depuis la fin (une tranche
  // refusée est coupée en deux), puis seulement les nouveaux blocs à chaque rafraîchissement.
  // Si eth_getLogs échoue quand même, la liste laisse la place au lien Blockscout.
  let feed = []; // du plus récent au plus ancien
  let scannedTo; // dernier bloc déjà lu
  let chunk = LOG_CHUNK;
  let feedBroken = false;
  const blockTimes = new Map();
  const senders = new Map(); // transaction → wallet qui l'a envoyée
  const hexBlock = (n) => `0x${n.toString(16)}`;

  async function logsBetween(from, to) {
    try {
      return await rpc("eth_getLogs", [{ address: info.pool, fromBlock: hexBlock(from), toBlock: hexBlock(to), topics: [SWAP_TOPIC] }]);
    } catch (error) {
      if (to - from + 1 <= MIN_CHUNK) throw error;
      const mid = from + Math.floor((to - from) / 2);
      chunk = Math.max(MIN_CHUNK, mid - from + 1);
      return [...(await logsBetween(from, mid)), ...(await logsBetween(mid + 1, to))];
    }
  }

  // Swap : (amount0, amount1, sqrtPriceX96, liquidity, tick), montants vus du pool. Côté token
  // négatif = des tokens sortent du pool = achat ; positif = revente.
  function parseLog(log) {
    const [amount0, amount1] = words(log.data).slice(0, 2).map(signed);
    const tokenAmount = info.tokenIs0 ? amount0 : amount1;
    const ethAmount = info.tokenIs0 ? amount1 : amount0;
    return {
      kind: tokenAmount < 0n ? "buy" : "sell",
      eth: abs(ethAmount),
      tokens: abs(tokenAmount),
      tx: log.transactionHash,
      block: Number(log.blockNumber),
      time: log.blockTimestamp ? Number(log.blockTimestamp) * 1000 : undefined,
    };
  }

  async function loadFeed() {
    const latest = Number(await rpc("eth_blockNumber", []));
    const start = Math.max(0, Number(CONFIG.launchFromBlock) || 0);
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
    // Heure (celle du bloc) et wallet (expéditeur de la transaction), gardés en mémoire. Le
    // destinataire du Swap ne suffit pas : pour une revente, c'est le routeur.
    const blocks = [...new Set(feed.filter((e) => e.time === undefined && !blockTimes.has(e.block)).map((e) => e.block))];
    const txs = [...new Set(feed.filter((e) => !senders.has(e.tx)).map((e) => e.tx))];
    await Promise.all([
      ...blocks.map(async (n) => {
        const block = await rpc("eth_getBlockByNumber", [hexBlock(n), false]);
        if (block) blockTimes.set(n, Number(block.timestamp) * 1000);
      }),
      ...txs.map(async (hash) => {
        const tx = await rpc("eth_getTransactionByHash", [hash]).catch(() => null);
        if (tx?.from) senders.set(hash, tx.from);
      }),
    ]);
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
    $("launch-feed-error").hidden = !feedBroken;
    $("launch-feed-empty").hidden = feedBroken || scannedTo === undefined || feed.length > 0;
    $("launch-feed-wrap").hidden = feedBroken || feed.length === 0;
    if (info) $("launch-feed-all").href = `${EXPLORER}/address/${info.pool}`;
    const when = new Intl.DateTimeFormat(locale(), { dateStyle: "short", timeStyle: "short" });
    $("launch-feed-body").replaceChildren(...feed.map((e) => {
      const tr = document.createElement("tr");
      // Wallet abrégé (ou la transaction s'il est inconnu) ; le lien mène à la transaction sur Blockscout.
      const who = senders.get(e.tx) ?? e.tx;
      const link = document.createElement("a");
      link.href = `${EXPLORER}/tx/${e.tx}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `${who.slice(0, 6)}…${who.slice(-4)}`;
      const whoCell = feedCell("");
      whoCell.append(link);
      tr.append(
        feedCell(t(e.kind === "buy" ? "launchFeedBuy" : "launchFeedSell"), e.kind === "buy" ? "in" : "out"),
        feedCell(fmtEth(e.eth), "num"),
        feedCell(fmtTokens(e.tokens, true), "num"),
        feedCell(e.time ? when.format(e.time) : "—"),
        whoCell,
      );
      return tr;
    }));
  }

  async function refreshFeed() {
    if (!info) return;
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
    const box = $("launch-limit");
    const when = $("launch-limit-when");
    const elapsed = (Date.now() - info.openAt) / 1000;
    if (elapsed < 0) {
      box.textContent = `${Number("0.5").toLocaleString(locale())} %`;
      when.textContent = t("launchLimitAtOpen");
      return;
    }
    const step = LIMIT_STEPS.find(([end]) => elapsed < end);
    if (!step) {
      box.textContent = t("launchNoLimit");
      when.textContent = "";
      return;
    }
    const pct = `${Number(step[1]).toLocaleString(locale())} %`;
    box.textContent = limitActive() ? fmtTokens(state.limit, true) : pct;
    const key = step === LIMIT_STEPS.at(-1) ? "launchLimitEnds" : "launchLimitNext";
    when.textContent = fill(key, { pct, time: clock(step[0] - elapsed) });
  }

  function render() {
    const before = Date.now() < info.openAt;
    const price = priceEth();
    // Prix pour 1 million de tokens : plus lisible qu'un prix par token (minuscule).
    $("launch-price").textContent = Number.isFinite(price) ? `${fmtNumber(price * 1e6)} ETH` : "—";
    $("launch-mcap").textContent = Number.isFinite(price) ? `${fmtNumber(price * toNumber(info.supply))} ETH` : "—";
    $("launch-eth").textContent = fmtEth(state.wethInPool);
    $("launch-mine").textContent = state.balance === undefined ? "—" : fmtTokens(state.balance, true);
    renderLimit();
    $("launch-trade").hidden = before;
    $("launch-connect").hidden = Boolean(account);
    $("launch-opens").hidden = !before;
    if (before) {
      const date = new Intl.DateTimeFormat(locale(), { dateStyle: "long", timeStyle: "short" }).format(info.openAt);
      $("launch-opens").textContent = fill("launchOpensAt", { date });
    }
    $("launch-contract").href = `${EXPLORER}/address/${LAUNCHER}`;
    $("launch-pool").href = `${EXPLORER}/address/${info.pool}`;
    const uniswap = $("launch-uniswap");
    uniswap.hidden = !CONFIG.buyUrl || before;
    if (CONFIG.buyUrl) uniswap.href = CONFIG.buyUrl;
  }

  // Bouton d'achat principal : vers cette section (achat sur le site, lien Uniswap à côté).
  function setBuyLinks() {
    for (const el of document.querySelectorAll(".buy-link")) {
      el.href = "#launch";
      el.removeAttribute("aria-disabled");
      el.removeAttribute("target");
      el.removeAttribute("rel");
    }
  }

  // ─── Compte à rebours jusqu'à OPEN_AT (lu dans LaunchPool) ────────────────
  let countdownTimer;
  function countdown() {
    clearTimeout(countdownTimer);
    const box = $("launch-countdown");
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const left = Math.max(0, Math.floor((info.openAt - Date.now()) / 1000));
      box.hidden = left === 0;
      $("launch-cd-d").textContent = Math.floor(left / 86_400);
      $("launch-cd-h").textContent = pad(Math.floor((left % 86_400) / 3_600));
      $("launch-cd-m").textContent = pad(Math.floor((left % 3_600) / 60));
      $("launch-cd-s").textContent = pad(left % 60);
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
  setBuyLinks();

  $("launch-buy-form").addEventListener("submit", (event) => {
    event.preventDefault();
    act(buy);
  });
  $("launch-sell-form").addEventListener("submit", (event) => {
    event.preventDefault();
    act(sell);
  });
  $("launch-buy-form").elements.eth.addEventListener("input", debounce(previewBuy));
  $("launch-sell-form").elements.tokens.addEventListener("input", debounce(previewSell));
  $("launch-slippage").addEventListener("input", debounce(() => Promise.all([previewBuy(), previewSell()])));
  $("launch-sell-max").addEventListener("click", () => act(async () => {
    await connect();
    await loadState();
    $("launch-sell-form").elements.tokens.value = amountText(state.balance);
    render();
    await previewSell();
  }));
  $("launch-connect").addEventListener("click", () => act(async () => {
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
      refresh().catch(() => {}); // silencieux : ne cache pas un message en cours
      refreshFeed();
    }, 15_000);
    setInterval(() => {
      if (info && state) renderLimit();
    }, 1_000);
  })();
})();

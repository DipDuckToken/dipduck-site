// Dip Duck Cards : les vrais NFT (contrat DipDuckCards du kit).
// Lecture directe sur la chaîne par le RPC public, mint et votes par le wallet du
// visiteur (MetaMask, Rabby… via window.ethereum). Aucune bibliothèque externe :
// l'encodage des appels est fait à la main (sélecteurs calculés depuis l'ABI).
//
// Fondations : une cagnotte par période de 30 jours. Pendant la période, les cartes
// votent pour une fondation de la liste et les détenteurs peuvent en proposer une
// nouvelle (vote oui / non) ; une fondation approuvée entre dans la liste pour la
// cagnotte suivante. Rien n'est versé avant la fin d'une période.

// ─── À remplir après le déploiement (voir README.md) ────────────────────────
const NFT_CONFIG = {
  // Adresse du contrat (deployments/robinhood.json du kit → nft.address)
  contract: "",
  // Ouverture du mint en UTC, identique à launch.config.ts → nft.mintStart.
  // Sert au compte à rebours tant que le contrat n'est pas déployé.
  mintStart: "",
  // Page de la collection sur OpenSea (Robinhood Chain y est supporté), une fois visible
  openseaUrl: "",
  // Réseau : à ne changer que pour un test (testnet ou nœud local).
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  chainId: 4663,
};
// ────────────────────────────────────────────────────────────────────────────

const NFT = (() => {
  const RPC = NFT_CONFIG.rpc;
  const CHAIN_ID = `0x${NFT_CONFIG.chainId.toString(16)}`;
  const ZERO = "0x" + "0".repeat(64);
  const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  // Sélecteurs : 4 premiers octets du keccak256 de chaque signature.
  const SEL = {
    mint: "0x50bf0465", // mint(bytes32,uint8,uint8,uint16,uint256)
    revealMany: "0x7243af58", // revealMany(uint256[])
    traitsOf: "0x5efab6e4", // traitsOf(uint256)
    cardOf: "0xc22b8d82", // cardOf(uint256)
    totalMinted: "0xa2309ff8",
    tokensOfOwner: "0x8462151c", // tokensOfOwner(address)
    MINT_START: "0xc6374d0c",
    PRICE: "0x8d859f3e",
    MAX_SUPPLY: "0x32cb6b0c",
    REVEAL_DELAY: "0xa7bc4e30",
    PROPOSAL_QUORUM: "0x47b042b6",
    // Périodes et versements
    currentRound: "0x8a19c8bc",
    roundEnd: "0x9ef6c17f", // roundEnd(uint256)
    roundCharity: "0x219bc6f0", // roundCharity(uint256)
    roundPaid: "0xbf3ddf73", // roundPaid(uint256)
    foundersAvailable: "0xc6b4a928",
    communityAvailable: "0xe9404d4f",
    foundersPaid: "0x4b75cbdf",
    communityPaid: "0xa0a984e2",
    charityReleased: "0xf526ad5e",
    withdrawFounders: "0x7b88eab4",
    withdrawCommunity: "0x3ab85c7b",
    releaseCharity: "0x4718a3a1", // releaseCharity(uint256)
    // Vote des fondations
    vote: "0xf429af19", // vote(uint256[],uint256)
    hasVoted: "0x64390ff1", // hasVoted(uint256,uint256)
    votesFor: "0x9e1c296d", // votesFor(uint256,uint256)
    winnerOf: "0x8cb5d700", // winnerOf(uint256)
    charityPlan: "0xfdbda6cf", // charityPlan(uint256) → (kind, index)
    candidateCount: "0xa9a981a3",
    candidate: "0x1de43c4b", // candidate(uint256)
    // Propositions
    propose: "0x57ea412c", // propose(string,address,string,string)
    voteProposal: "0x8391b958", // voteProposal(uint256,uint256[],bool)
    finalizeProposal: "0x5652077c", // finalizeProposal(uint256)
    proposalCount: "0xda35c664",
    proposal: "0x30326c17", // proposal(uint256)
    hasVotedProposal: "0xc074cd72", // hasVotedProposal(uint256,uint256)
  };
  const NAME_PATTERN = /^[A-Za-z0-9 ._-]{0,20}$/;
  const PAST_ROUNDS_SHOWN = 6;
  const PROPOSALS_SHOWN = 20;
  const $ = (id) => document.getElementById(id);
  const live = /^0x[0-9a-fA-F]{40}$/.test(NFT_CONFIG.contract);
  let account;
  let info = {}; // constantes et compteurs lus sur la chaîne

  // ─── Encodage ABI minimal ─────────────────────────────────────────────────
  const hexOf = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const word = (n) => BigInt(n).toString(16).padStart(64, "0");
  const addressWord = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const uintArray = (items) => word(items.length) + items.map(word).join("");
  const nameWord = (name) => hexOf(new TextEncoder().encode(name)).padEnd(64, "0");
  function stringTail(text) {
    const bytes = new TextEncoder().encode(text);
    return word(bytes.length) + hexOf(bytes).padEnd(Math.ceil(bytes.length / 32) * 64, "0");
  }
  const words = (hex) => (hex.replace(/^0x/, "").match(/.{64}/g) ?? []).map((w) => BigInt(`0x${w}`));
  const addressAt = (hex, index) => `0x${hex.replace(/^0x/, "").slice(index * 64 + 24, index * 64 + 64)}`;
  function decodeName(hex) {
    const bytes = hex.replace(/^0x/, "").slice(0, 64).match(/.{2}/g).map((h) => parseInt(h, 16)).filter((b) => b !== 0);
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
  function decodeString(hex, offsetBytes) {
    const data = hex.replace(/^0x/, "");
    const start = Number(offsetBytes) * 2;
    const length = Number(BigInt(`0x${data.slice(start, start + 64)}`));
    const raw = data.slice(start + 64, start + 64 + length * 2).match(/.{2}/g) ?? [];
    return new TextDecoder().decode(new Uint8Array(raw.map((h) => parseInt(h, 16))));
  }

  // ─── Lecture sur la chaîne ────────────────────────────────────────────────
  async function rpc(method, params) {
    const response = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const body = await response.json();
    if (body.error) throw new Error(body.error.message);
    return body.result;
  }
  const call = (data) => rpc("eth_call", [{ to: NFT_CONFIG.contract, data }, "latest"]);
  const uint = async (selector, arg = "") => words(await call(selector + arg))[0];

  async function loadInfo() {
    const [price, maxSupply, mintStart, revealDelay, minted, count, round, quorum] = await Promise.all(
      [SEL.PRICE, SEL.MAX_SUPPLY, SEL.MINT_START, SEL.REVEAL_DELAY, SEL.totalMinted, SEL.candidateCount, SEL.currentRound, SEL.PROPOSAL_QUORUM].map((s) => uint(s)),
    );
    info = {
      price,
      maxSupply: Number(maxSupply),
      mintStart: Number(mintStart) * 1000,
      revealDelay: Number(revealDelay),
      minted: Number(minted),
      candidates: Number(count),
      round: Number(round),
      roundEnd: Number(await uint(SEL.roundEnd, word(round))) * 1000,
      quorum: Number(quorum),
    };
  }

  async function loadCard(id) {
    const [traitsHex, cardHex] = await Promise.all([call(SEL.traitsOf + word(id)), call(SEL.cardOf + word(id))]);
    const traitWords = words(traitsHex);
    const c = words(cardHex);
    return {
      id,
      traits: traitWords.slice(0, 10).map(Number),
      revealed: traitWords[10] === 1n,
      name: decodeName(cardHex),
      mood: Number(c[1]),
      element: Number(c[2]),
      commitBlock: Number(c[4]),
    };
  }

  async function loadCandidates() {
    const list = [];
    for (let i = 0; i < info.candidates; i++) {
      // (string name, address wallet, string url, uint256 fromRound)
      const hex = await call(SEL.candidate + word(i));
      const w = words(hex);
      list.push({ index: i, name: decodeString(hex, w[0]), wallet: addressAt(hex, 1), url: decodeString(hex, w[2]), fromRound: Number(w[3]) });
    }
    return list;
  }

  async function loadProposal(id) {
    // (string name, address wallet, string url, string description, address proposer,
    //  uint256 round, uint256 yes, uint256 no, uint8 status)
    const hex = await call(SEL.proposal + word(id));
    const w = words(hex);
    return {
      id,
      name: decodeString(hex, w[0]),
      wallet: addressAt(hex, 1),
      url: decodeString(hex, w[2]),
      description: decodeString(hex, w[3]),
      proposer: addressAt(hex, 4),
      round: Number(w[5]),
      yes: Number(w[6]),
      no: Number(w[7]),
      status: Number(w[8]),
    };
  }

  // ─── Wallet ───────────────────────────────────────────────────────────────
  async function connect() {
    if (!window.ethereum) throw new Error(t("nftNoWallet"));
    [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
    } catch (error) {
      if (error.code !== 4902) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: CHAIN_ID, chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: [EXPLORER] }],
      });
    }
    return account;
  }

  async function send(data, value = 0n) {
    const hash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: account, to: NFT_CONFIG.contract, data, value: `0x${value.toString(16)}` }],
    });
    status(`${t("nftPending")} ${hash.slice(0, 10)}…`, "wait");
    for (let i = 0; i < 180; i++) {
      const receipt = await rpc("eth_getTransactionReceipt", [hash]);
      if (receipt) {
        if (receipt.status !== "0x1") throw new Error(t("nftFailed"));
        return receipt;
      }
      await sleep(1500);
    }
    throw new Error(t("nftSlow"));
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function status(text, kind = "") {
    const el = $("nft-status");
    el.textContent = text;
    el.dataset.kind = kind;
  }

  /** Cartes du wallet connecté (après connexion). */
  async function myCards() {
    await connect();
    return words(await call(SEL.tokensOfOwner + addressWord(account))).slice(2).map(Number);
  }

  // ─── Mint puis révélation ─────────────────────────────────────────────────
  async function mint(form) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    if (!NAME_PATTERN.test(name)) throw new Error(t("nftNameRule"));
    const quantity = Math.min(10, Math.max(1, Number(data.get("quantity") || 1)));
    const mood = DipCards.MOODS.indexOf(String(data.get("mood")));
    const element = DipCards.ELEMENTS.indexOf(String(data.get("element")));
    const lucky = Math.min(999, Math.max(0, Number(data.get("lucky") || 0)));
    await connect();
    status(t("nftConfirmMint"), "wait");
    const payload = SEL.mint + nameWord(name) + word(mood) + word(element) + word(lucky) + word(quantity);
    const receipt = await send(payload, info.price * BigInt(quantity));
    const ids = receipt.logs
      .filter((log) => log.address.toLowerCase() === NFT_CONFIG.contract.toLowerCase() && log.topics[0] === TRANSFER && log.topics[1] === ZERO)
      .map((log) => Number(BigInt(log.topics[3])));
    await reveal(ids);
    await refresh();
  }

  // Le hasard se fixe un peu après le mint (bloc cible) : on attend, puis une
  // seule transaction révèle toutes les cartes (si personne ne l'a déjà fait).
  async function reveal(ids) {
    if (ids.length === 0) return;
    const first = await loadCard(ids[0]);
    const target = first.commitBlock + info.revealDelay;
    status(t("nftHatching"), "wait");
    for (;;) {
      const latest = await rpc("eth_getBlockByNumber", ["latest", false]);
      // Sur Robinhood Chain, block.number du contrat suit le numéro de bloc L1 (l1BlockNumber).
      const l1 = Number(BigInt(latest.l1BlockNumber ?? latest.number));
      if (l1 > target) break;
      await sleep(3000);
    }
    const pending = [];
    for (const id of ids) if (!(await loadCard(id)).revealed) pending.push(id);
    if (pending.length > 0) {
      status(t("nftConfirmReveal"), "wait");
      await send(SEL.revealMany + word(32) + uintArray(pending));
    }
    status(t("nftDone"), "ok");
  }

  // ─── Affichage ────────────────────────────────────────────────────────────
  const locale = () => (currentLang === "zh" ? "zh-CN" : currentLang);
  const eth = (wei) => `${(Number(wei) / 1e18).toLocaleString(locale(), { maximumFractionDigits: 5 })} ETH`;
  const shortAddress = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  const dateOf = (ms) => new Intl.DateTimeFormat(locale(), { dateStyle: "long", timeStyle: "short" }).format(ms);

  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text; // toujours du texte brut, jamais du HTML
    if (className) el.className = className;
    return el;
  }

  function externalLink(href, text) {
    const a = element("a", text);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  function button(label, onClick, kind = "ghost") {
    const b = element("button", label, `btn ${kind} small`);
    b.type = "button";
    b.addEventListener("click", () => run(onClick));
    return b;
  }

  // Lien d'une fondation ou d'une proposition : seulement http(s), sinon rien.
  function safeUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
    } catch {
      return undefined;
    }
  }

  async function cardTile(id) {
    const card = await loadCard(id);
    const tile = element("article", undefined, "nft-tile");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1080;
    tile.append(canvas);
    const caption = element("p");
    if (card.revealed) {
      const drawn = DipCards.fromChain(id, card.traits, card);
      await DipCards.render(drawn, canvas);
      const label = DipCards.tierLabel(drawn);
      caption.textContent = `#${id} · ${label.text}`;
      caption.style.color = label.color;
      // L'image de la carte, en PNG 1080 × 1080 (la carte elle-même reste dans le wallet).
      tile.append(button(t("nftDownload"), async () => DD.download(canvas, `dip-duck-card-${id}.png`)));
    } else {
      DD.pond(canvas.getContext("2d"), 1080, 1080);
      caption.textContent = `#${id} · ${t("nftUnrevealed")}`;
      tile.append(button(t("nftRevealNow"), () => reveal([id]).then(refresh)));
    }
    tile.append(caption, externalLink(`${EXPLORER}/token/${NFT_CONFIG.contract}/instance/${id}`, "Blockscout"));
    return tile;
  }

  async function showMine() {
    if (!account) return;
    const ids = words(await call(SEL.tokensOfOwner + addressWord(account))).slice(2).map(Number);
    $("nft-mine-wrap").hidden = false;
    $("nft-mine").replaceChildren(...(await Promise.all(ids.map(cardTile))));
    $("nft-mine-empty").hidden = ids.length > 0;
  }

  // Vote de la période en cours : fondations admises pour cette cagnotte.
  async function showVote() {
    const all = await loadCandidates();
    const eligible = all.filter((c) => c.fromRound <= info.round);
    const votes = await Promise.all(eligible.map((c) => uint(SEL.votesFor, word(info.round) + word(c.index))));
    const total = votes.reduce((sum, v) => sum + Number(v), 0);
    const pot = await uint(SEL.roundCharity, word(info.round));
    $("round-title").textContent = t("nftRoundTitle").replace("{n}", info.round + 1).replace("{pot}", eth(pot));
    $("vote-ends").textContent = `${t("nftRoundEnds")} ${dateOf(info.roundEnd)}`;
    $("vote-list").replaceChildren(
      ...eligible.map((c, i) => {
        const li = element("li");
        const label = element("label");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "candidate";
        radio.value = String(c.index);
        label.append(radio, element("strong", c.name));
        const bar = element("div", undefined, "vote-bar");
        bar.style.setProperty("--share", `${total ? (Number(votes[i]) / total) * 100 : 0}%`);
        const links = element("span", undefined, "vote-links");
        links.append(externalLink(`${EXPLORER}/address/${c.wallet}`, shortAddress(c.wallet)));
        const site = safeUrl(c.url);
        if (site) links.append(" · ", externalLink(site, t("nftWebsite")));
        li.append(label, bar, element("span", `${votes[i]} ${t("nftVotes")}`), links);
        return li;
      }),
    );
    // Les fondations approuvées qui attendent la prochaine cagnotte.
    const upcoming = all.filter((c) => c.fromRound > info.round);
    $("vote-upcoming").hidden = upcoming.length === 0;
    $("vote-upcoming").textContent = `${t("nftUpcoming")} ${upcoming.map((c) => c.name).join(", ")}`;
    await showPastRounds(all);
  }

  // Périodes terminées : gagnante, cagnotte, et versement à déclencher si besoin.
  async function showPastRounds(candidates) {
    const rows = [];
    for (let r = info.round - 1; r >= Math.max(0, info.round - PAST_ROUNDS_SHOWN); r--) {
      const [winnerHex, planHex, pot, paid] = await Promise.all([
        call(SEL.winnerOf + word(r)),
        call(SEL.charityPlan + word(r)),
        uint(SEL.roundCharity, word(r)),
        uint(SEL.roundPaid, word(r)),
      ]);
      const [hasWinner, index] = words(winnerHex);
      // Ce que fera le versement : 1 gagnante, 2 report, 3 dernière gagnante (secours), 4 partage égal (secours).
      const [kind, planIndex] = words(planHex).map(Number);
      const li = element("li");
      const name = hasWinner === 1n ? candidates[Number(index)]?.name ?? `#${index}` : t("nftNoWinner");
      li.append(element("strong", `${t("nftRound")} ${r + 1}`), element("span", name), element("span", eth(pot)));
      if (paid === 1n) li.append(element("span", t("nftPaid"), "ok"));
      else if (kind === 1) li.append(button(t("nftSendCharity"), () => releaseCharity(r)));
      else if (kind === 2) li.append(button(t("nftRollOver"), () => releaseCharity(r)));
      else if (kind === 3) li.append(button(t("nftFallbackLast").replace("{name}", candidates[planIndex]?.name ?? `#${planIndex}`), () => releaseCharity(r)));
      else if (kind === 4) li.append(button(t("nftFallbackSplit"), () => releaseCharity(r)));
      rows.push(li);
    }
    $("past-rounds-wrap").hidden = rows.length === 0;
    $("past-rounds").replaceChildren(...rows);
  }

  async function releaseCharity(round) {
    await connect();
    status(t("nftConfirmTx"), "wait");
    await send(SEL.releaseCharity + word(round));
    status(t("nftSent"), "ok");
    await refresh();
  }

  async function voteNow() {
    const choice = document.querySelector('input[name="candidate"]:checked');
    if (!choice) throw new Error(t("nftPickCharity"));
    const ids = await myCards();
    const free = [];
    for (const id of ids) if ((await uint(SEL.hasVoted, word(info.round) + word(id))) === 0n) free.push(id);
    if (free.length === 0) throw new Error(t("nftNoVotes"));
    status(t("nftConfirmVote").replace("{n}", free.length), "wait");
    await send(SEL.vote + word(64) + word(choice.value) + uintArray(free));
    status(t("nftVoted"), "ok");
    await showVote();
  }

  // ─── Propositions de fondations ───────────────────────────────────────────
  const STATUS_KEYS = ["nftStatusOpen", "nftStatusApproved", "nftStatusRejected", "nftStatusFull"];

  async function showProposals() {
    const count = Number(await uint(SEL.proposalCount));
    const ids = [];
    for (let id = count - 1; id >= Math.max(0, count - PROPOSALS_SHOWN); id--) ids.push(id);
    const proposals = await Promise.all(ids.map(loadProposal));
    $("proposal-empty").hidden = proposals.length > 0;
    $("proposal-list").replaceChildren(
      ...proposals.map((p) => {
        const li = element("li", undefined, "proposal");
        const head = element("div", undefined, "proposal-head");
        head.append(element("strong", p.name), element("span", t(STATUS_KEYS[p.status] ?? "nftStatusOpen"), `pill s${p.status}`));
        const meta = element("p", undefined, "hint");
        meta.append(`${t("nftRound")} ${p.round + 1} · ${t("nftProposedBy")} `, externalLink(`${EXPLORER}/address/${p.proposer}`, shortAddress(p.proposer)), " · ", externalLink(`${EXPLORER}/address/${p.wallet}`, shortAddress(p.wallet)));
        const site = safeUrl(p.url);
        if (site) meta.append(" · ", externalLink(site, t("nftWebsite")));
        const total = p.yes + p.no;
        const tally = element("div", undefined, "tally");
        tally.style.setProperty("--yes", `${total ? (p.yes / total) * 100 : 0}%`);
        const counts = element("p", `${t("nftYes")} ${p.yes} · ${t("nftNo")} ${p.no} · ${t("nftQuorum").replace("{n}", info.quorum)}`, "hint");
        li.append(head, element("p", p.description, "proposal-text"), meta, tally, counts);
        if (p.status === 0 && p.round === info.round) {
          const actions = element("div", undefined, "actions");
          actions.append(button(t("nftVoteYes"), () => voteProposal(p.id, true), "primary"), button(t("nftVoteNo"), () => voteProposal(p.id, false)));
          li.append(actions);
        } else if (p.status === 0) {
          li.append(button(t("nftFinalize"), () => finalizeProposal(p.id)));
        }
        return li;
      }),
    );
  }

  async function voteProposal(id, support) {
    const ids = await myCards();
    const free = [];
    for (const card of ids) if ((await uint(SEL.hasVotedProposal, word(id) + word(card))) === 0n) free.push(card);
    if (free.length === 0) throw new Error(t("nftNoVotes"));
    status(t("nftConfirmVote").replace("{n}", free.length), "wait");
    await send(SEL.voteProposal + word(id) + word(96) + word(support ? 1 : 0) + uintArray(free));
    status(t("nftVoted"), "ok");
    await showProposals();
  }

  async function finalizeProposal(id) {
    await connect();
    status(t("nftConfirmTx"), "wait");
    await send(SEL.finalizeProposal + word(id));
    status(t("nftSent"), "ok");
    // Une fondation approuvée change le nombre de candidats : on relit tout.
    await refresh();
  }

  async function propose(form) {
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const wallet = String(data.get("wallet") || "").trim();
    const url = String(data.get("url") || "").trim();
    const description = String(data.get("description") || "").trim();
    const size = (text) => new TextEncoder().encode(text).length;
    if (size(name) < 1 || size(name) > 40 || size(url) > 120 || size(description) < 1 || size(description) > 280) {
      throw new Error(t("nftProposalRules"));
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Error(t("nftBadAddress"));
    if (url && !safeUrl(url)) throw new Error(t("nftBadUrl"));
    if ((await myCards()).length === 0) throw new Error(t("nftNeedCard"));
    // propose(string name, address wallet, string url, string description) : 4 mots d'en-tête, puis les textes.
    const tails = [stringTail(name), stringTail(url), stringTail(description)];
    const head = 4 * 32;
    const offsets = [head, head + tails[0].length / 2, head + (tails[0].length + tails[1].length) / 2];
    status(t("nftConfirmTx"), "wait");
    await send(SEL.propose + word(offsets[0]) + addressWord(wallet) + word(offsets[1]) + word(offsets[2]) + tails.join(""));
    status(t("nftProposed"), "ok");
    form.reset();
    await showProposals();
  }

  // ─── Trésorerie ───────────────────────────────────────────────────────────
  async function showTreasury() {
    const [founders, community, foundersPaid, communityPaid, released] = await Promise.all(
      [SEL.foundersAvailable, SEL.communityAvailable, SEL.foundersPaid, SEL.communityPaid, SEL.charityReleased].map((s) => uint(s)),
    );
    $("tr-founders").textContent = eth(founders);
    $("tr-community").textContent = eth(community);
    $("tr-founders-paid").textContent = eth(foundersPaid);
    $("tr-community-paid").textContent = eth(communityPaid);
    $("tr-released").textContent = eth(released);
    $("withdraw-founders").disabled = founders === 0n;
    $("withdraw-community").disabled = community === 0n;
    $("tr-contract").href = `${EXPLORER}/address/${NFT_CONFIG.contract}`;
  }

  async function withdraw(selector) {
    await connect();
    status(t("nftConfirmTx"), "wait");
    await send(selector);
    status(t("nftSent"), "ok");
    await showTreasury();
  }

  async function refresh() {
    await loadInfo();
    $("nft-minted").textContent = `${info.minted.toLocaleString(locale())} / ${info.maxSupply.toLocaleString(locale())}`;
    $("nft-progress").style.setProperty("--done", `${(info.minted / info.maxSupply) * 100}%`);
    const opened = Date.now() >= info.mintStart;
    $("nft-form").hidden = !opened || info.minted >= info.maxSupply;
    $("nft-soldout").hidden = info.minted < info.maxSupply;
    countdown(info.mintStart);
    await Promise.all([showVote(), showProposals(), showTreasury(), showMine()]);
  }

  // ─── Compte à rebours du mint ─────────────────────────────────────────────
  let countdownTimer;
  function countdown(targetMs) {
    clearTimeout(countdownTimer);
    const box = $("nft-countdown");
    if (!targetMs || Number.isNaN(targetMs)) {
      box.hidden = true;
      return;
    }
    const pad = (n) => String(n).padStart(2, "0");
    let running = false;
    const tick = () => {
      const left = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      box.hidden = left === 0;
      $("nft-cd-d").textContent = Math.floor(left / 86_400);
      $("nft-cd-h").textContent = pad(Math.floor((left % 86_400) / 3_600));
      $("nft-cd-m").textContent = pad(Math.floor((left % 3_600) / 60));
      $("nft-cd-s").textContent = pad(left % 60);
      if (left > 0) {
        running = true;
        countdownTimer = setTimeout(tick, 1000);
      } else if (running && live) {
        // Le mint vient d'ouvrir : on recharge l'état une seule fois.
        running = false;
        run(refresh);
      }
    };
    tick();
  }

  // Aperçu : des cartes au hasard défilent tant qu'on n'a pas les siennes.
  async function preview() {
    const canvas = $("nft-preview");
    const random = () => DipCards.ORDER.map(() => (Math.random() < 0.6 ? 0 : Math.floor(Math.random() * 4)));
    let n = 0;
    const draw = async () => {
      n += 1;
      const card = DipCards.fromChain("????", random(), { name: "Dip Duck", mood: n % 4, element: (n >> 1) % 4 });
      card.label = "DIP DUCK CARD";
      await DipCards.render(card, canvas);
    };
    await draw();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(draw, 3500);
  }

  async function run(task) {
    try {
      await task();
    } catch (error) {
      status(error?.message ?? String(error), "error");
    }
  }

  function init() {
    if (!$("nft")) return;
    preview();
    // Mint, fondations et trésorerie n'apparaissent qu'une fois le contrat déployé.
    for (const id of ["nft-live", "nft-vote-wrap", "nft-proposals-wrap", "nft-treasury"]) $(id).hidden = !live;
    $("nft-opensea").hidden = !NFT_CONFIG.openseaUrl;
    if (NFT_CONFIG.openseaUrl) $("nft-opensea").href = NFT_CONFIG.openseaUrl;
    if (!live) {
      countdown(Date.parse(NFT_CONFIG.mintStart));
      return;
    }
    $("nft-form").addEventListener("submit", (event) => {
      event.preventDefault();
      run(() => mint(event.currentTarget));
    });
    $("proposal-form").addEventListener("submit", (event) => {
      event.preventDefault();
      run(() => propose(event.currentTarget));
    });
    $("nft-connect").addEventListener("click", () => run(async () => {
      await connect();
      await showMine();
    }));
    $("vote-btn").addEventListener("click", () => run(voteNow));
    $("withdraw-founders").addEventListener("click", () => run(() => withdraw(SEL.withdrawFounders)));
    $("withdraw-community").addEventListener("click", () => run(() => withdraw(SEL.withdrawCommunity)));
    document.addEventListener("langchange", () => run(refresh));
    run(refresh);
    setInterval(() => run(loadInfo), 60_000);
  }

  init();
  return { refresh, loadCard, live };
})();

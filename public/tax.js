// « Mon suivi » : l'historique du wallet CONNECTÉ avec Dip Duck, prêt pour la déclaration.
// Pas de saisie d'adresse : le site ne sert pas à consulter l'activité des autres.
// Données publiques de Blockscout (l'explorateur officiel), sans rien envoyer à
// personne : achats et ventes de DIPDUCK, mints et échanges de cartes, versements
// reçus du contrat NFT. Chaque ligne est valorisée en USD et en CAD au cours du jour
// (ETH/USD de Coinbase, USD/CAD de la Banque du Canada : voir eth-history.js).
// Aide à la tenue de registres, pas un conseil fiscal.
(() => {
  const section = document.getElementById("suivi");
  if (!section) return;
  const API = `${EXPLORER}/api/v2`;
  const ZERO = "0x0000000000000000000000000000000000000000";
  const MAX_PAGES = 20;
  const $ = (id) => document.getElementById(id);
  const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(a);
  const token = () => (isAddress(CONFIG.contract) ? CONFIG.contract.toLowerCase() : undefined);
  const nft = () => (typeof NFT_CONFIG !== "undefined" && isAddress(NFT_CONFIG.contract) ? NFT_CONFIG.contract.toLowerCase() : undefined);
  let rows = [];
  let account = "";

  // ─── Lecture Blockscout ───────────────────────────────────────────────────
  // L'API publique limite le débit : 2 requêtes à la fois, et on réessaie après
  // une pause croissante si elle répond 429 (trop de requêtes).
  const MAX_PARALLEL = 2;
  let running = 0;
  const waiting = [];
  async function slot() {
    if (running < MAX_PARALLEL) {
      running += 1;
      return;
    }
    await new Promise((resolve) => waiting.push(resolve));
  }
  function release() {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  }

  async function get(path) {
    await slot();
    try {
      for (let attempt = 1; ; attempt++) {
        const response = await fetch(`${API}${path}`);
        if (response.ok) return await response.json();
        if (response.status !== 429 || attempt === 4) throw new Error(`Blockscout ${response.status}`);
        // Limite atteinte : on attend la remise à zéro annoncée par l'API (au plus 2 minutes).
        const reset = Math.min(Number(response.headers.get("x-ratelimit-reset")) || 5000, 120_000);
        $("tax-status").textContent = t("taxRateLimit").replace("{s}", Math.ceil(reset / 1000));
        await new Promise((resolve) => setTimeout(resolve, reset + 500));
      }
    } finally {
      release();
    }
  }

  async function all(path) {
    const items = [];
    let params = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const sep = path.includes("?") ? "&" : "?";
      const data = await get(`${path}${params ? sep + params : ""}`);
      items.push(...(data.items ?? []));
      if (!data.next_page_params) break;
      params = new URLSearchParams(data.next_page_params).toString();
    }
    return items;
  }

  const lower = (a) => (a ?? "").toLowerCase();
  const wei = (v) => BigInt(v ?? 0);

  // ─── Cours du jour (UTC) ──────────────────────────────────────────────────
  const historyStart = Date.parse(`${ETH_HISTORY.start}T00:00:00Z`);
  function priceOn(timestamp) {
    const day = Math.floor((Date.parse(timestamp) - historyStart) / 86_400_000);
    const last = ETH_HISTORY.usd.length - 1;
    const i = Math.min(Math.max(day, 0), last);
    // Au-delà du dernier jour connu (aujourd'hui) : dernier cours, marqué « estimé ».
    return { usd: ETH_HISTORY.usd[i], usdcad: ETH_HISTORY.usdcad[i], cad: ETH_HISTORY.cad[i], estimated: day > last || day < 0 };
  }

  // ─── Construction des lignes ──────────────────────────────────────────────
  // Peu de requêtes : des listes de 50 éléments par page, jamais une requête par
  // transaction (l'API publique accepte environ 150 requêtes toutes les 2 minutes).
  async function load(address) {
    const me = lower(address);
    const [tokenTransfers, nftTransfers, txs, internals] = await Promise.all([
      token() ? all(`/addresses/${address}/token-transfers?token=${token()}`) : [],
      nft() ? all(`/addresses/${address}/token-transfers?token=${nft()}`) : [],
      all(`/addresses/${address}/transactions`),
      all(`/addresses/${address}/internal-transactions`),
    ]);
    const txByHash = new Map(txs.map((tx) => [tx.hash, tx]));
    // ETH reçu en interne (ventes, versements), par transaction.
    const received = new Map();
    for (const i of internals) {
      if (lower(i.to?.hash) !== me || i.success === false || wei(i.value) === 0n) continue;
      received.set(i.transaction_hash, (received.get(i.transaction_hash) ?? 0n) + wei(i.value));
    }

    // Regroupe par transaction.
    const byTx = new Map();
    const entry = (hash, timestamp) => {
      if (!byTx.has(hash)) byTx.set(hash, { hash, timestamp, tokenIn: 0n, tokenOut: 0n, decimals: 18, cardsIn: [], cardsOut: [], minted: [], payout: 0n });
      return byTx.get(hash);
    };
    for (const t of [...tokenTransfers, ...nftTransfers]) {
      const e = entry(t.transaction_hash, t.timestamp);
      const from = lower(t.from?.hash);
      const to = lower(t.to?.hash);
      const address = lower(t.token?.address ?? t.token?.address_hash);
      if (address === token()) {
        e.decimals = Number(t.total?.decimals ?? 18);
        if (to === me) e.tokenIn += wei(t.total?.value);
        if (from === me) e.tokenOut += wei(t.total?.value);
      } else if (address === nft()) {
        const id = t.total?.token_id ?? t.total?.token_instance?.id ?? "?";
        if (to === me && from === ZERO) e.minted.push(id);
        else if (to === me) e.cardsIn.push(id);
        else if (from === me) e.cardsOut.push(id);
      }
    }
    // Versements du contrat NFT (parts fondateurs ou communauté).
    for (const i of internals) {
      if (nft() && lower(i.from?.hash) === nft() && lower(i.to?.hash) === me && i.success !== false && wei(i.value) > 0n) {
        entry(i.transaction_hash, i.timestamp).payout += wei(i.value);
      }
    }

    const list = [...byTx.values()].map((e) => {
      const tx = txByHash.get(e.hash);
      const paidByMe = lower(tx?.from?.hash) === me;
      return {
        ...e,
        ethOut: paidByMe ? wei(tx.value) : 0n,
        fee: paidByMe ? wei(tx.fee?.value) : 0n,
        ethIn: received.get(e.hash) ?? 0n,
        failed: tx !== undefined && tx.status !== "ok",
      };
    });
    return list.filter((e) => !e.failed).map(classify).sort((a, b) => a.date.localeCompare(b.date));
  }

  function classify(e) {
    const tokens = (n) => `${formatToken(n, e.decimals)} DIPDUCK`;
    const cards = (ids) => `${ids.length} × #${ids.join(", #")}`;
    let kind;
    let detail = "";
    if (e.payout > 0n) {
      kind = "taxPayout";
    } else if (e.minted.length) {
      kind = e.ethOut > 0n ? "taxMint" : "taxMintFree";
      detail = cards(e.minted);
    } else if (e.tokenIn > 0n && e.ethOut > 0n) {
      kind = "taxBuyToken";
      detail = tokens(e.tokenIn);
    } else if (e.tokenOut > 0n && e.ethIn > 0n) {
      kind = "taxSellToken";
      detail = tokens(e.tokenOut);
    } else if (e.tokenIn > 0n) {
      kind = "taxReceiveToken";
      detail = tokens(e.tokenIn);
    } else if (e.tokenOut > 0n) {
      kind = "taxSendToken";
      detail = tokens(e.tokenOut);
    } else if (e.cardsIn.length) {
      kind = e.ethOut > 0n ? "taxBuyCard" : "taxReceiveCard";
      detail = cards(e.cardsIn);
    } else {
      kind = e.ethIn > 0n ? "taxSellCard" : "taxSendCard";
      detail = cards(e.cardsOut);
    }
    // Les versements arrivent en interne : ils comptent comme ETH reçu.
    const ethIn = e.payout > 0n ? e.payout : e.ethIn;
    const price = priceOn(e.timestamp);
    const toEth = (v) => Number(v) / 1e18;
    const net = toEth(ethIn) || toEth(e.ethOut);
    return {
      date: e.timestamp,
      kind,
      detail,
      ethIn: toEth(ethIn),
      ethOut: toEth(e.ethOut),
      fee: toEth(e.fee),
      price,
      usd: net * (price.usd ?? 0),
      cad: net * (price.cad ?? 0),
      feeCad: toEth(e.fee) * (price.cad ?? 0),
      hash: e.hash,
    };
  }

  function formatToken(value, decimals) {
    const whole = Number(value / 10n ** BigInt(decimals));
    return whole.toLocaleString(locale());
  }

  // ─── Affichage ────────────────────────────────────────────────────────────
  const locale = () => (currentLang === "zh" ? "zh-CN" : currentLang);
  const money = (v, currency) => new Intl.NumberFormat(locale(), { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  const ethText = (v) => (v ? `${v.toLocaleString(locale(), { maximumFractionDigits: 6 })}` : "—");

  function cell(text, className) {
    const td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  function years() {
    return [...new Set(rows.map((r) => r.date.slice(0, 4)))].sort().reverse();
  }

  function render() {
    const year = $("tax-year").value;
    const shown = rows.filter((r) => !year || r.date.startsWith(year));
    $("tax-body").replaceChildren(
      ...shown.map((r) => {
        const tr = document.createElement("tr");
        const date = new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }).format(Date.parse(r.date));
        const link = document.createElement("a");
        link.href = `${EXPLORER}/tx/${r.hash}`;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `${r.hash.slice(0, 8)}…`;
        const proof = document.createElement("td");
        proof.append(link);
        const estimated = r.price.estimated ? " ≈" : "";
        tr.append(
          cell(date),
          cell(t(r.kind)),
          cell(r.detail),
          cell(ethText(r.ethIn), "num in"),
          cell(ethText(r.ethOut), "num out"),
          cell(ethText(r.fee), "num"),
          cell(money(r.cad, "CAD") + estimated, "num"),
          cell(money(r.usd, "USD") + estimated, "num"),
          proof,
        );
        return tr;
      }),
    );
    const sum = (f) => shown.reduce((s, r) => s + f(r), 0);
    $("tax-in").textContent = money(sum((r) => (r.ethIn ? r.cad : 0)), "CAD");
    $("tax-out").textContent = money(sum((r) => (r.ethOut ? r.cad : 0)), "CAD");
    $("tax-fees").textContent = money(sum((r) => r.feeCad), "CAD");
    $("tax-count").textContent = String(shown.length);
    $("tax-result").hidden = false;
    $("tax-empty").hidden = shown.length > 0;
  }

  // CSV : une ligne par opération, séparateur « ; » (Excel en français), UTF-8 avec BOM.
  function exportCsv() {
    const year = $("tax-year").value;
    const head = ["date_utc", "operation", "detail", "eth_recu", "eth_paye", "frais_reseau_eth", "cours_eth_usd", "taux_usd_cad_bdc", "valeur_usd", "valeur_cad", "frais_cad", "cours_estime", "transaction", "preuve"];
    const quote = (v) => `"${String(v).replaceAll('"', '""')}"`;
    // Excel en français et en espagnol attend une virgule décimale.
    const decimal = ["fr", "es"].includes(currentLang) ? "," : ".";
    const num = (v) => String(v).replace(".", decimal);
    const lines = rows
      .filter((r) => !year || r.date.startsWith(year))
      .map((r) => [r.date, t(r.kind), r.detail, num(r.ethIn), num(r.ethOut), num(r.fee), num(r.price.usd), num(r.price.usdcad), num(r.usd.toFixed(2)), num(r.cad.toFixed(2)), num(r.feeCad.toFixed(2)), r.price.estimated ? "oui" : "non", r.hash, `${EXPLORER}/tx/${r.hash}`].map(quote).join(";"));
    const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dipduck-suivi-${account.slice(0, 8)}-${year || "tout"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function show(address) {
    const status = $("tax-status");
    if (!isAddress(address)) {
      status.textContent = t("nftBadAddress");
      return;
    }
    status.textContent = t("taxLoading");
    $("tax-result").hidden = true;
    try {
      rows = await load(address);
      const select = $("tax-year");
      select.replaceChildren(new Option(t("taxAllYears"), ""), ...years().map((y) => new Option(y, y)));
      select.value = years()[0] ?? "";
      render();
      status.textContent = "";
    } catch (error) {
      status.textContent = `${t("taxError")} (${error.message})`;
    }
  }

  function init() {
    const ready = token() || nft();
    $("tax-tool").hidden = !ready;
    $("tax-soon").hidden = Boolean(ready);
    if (!ready) return;
    $("tax-connect").addEventListener("click", async () => {
      if (!window.ethereum) {
        $("tax-status").textContent = t("nftNoWallet");
        return;
      }
      try {
        [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch {
        return; // connexion refusée dans le wallet
      }
      $("tax-account").textContent = `${t("taxConnected")} ${account}`;
      $("tax-account").hidden = false;
      show(account);
    });
    // Le wallet change de compte : on n'affiche plus l'historique du précédent.
    window.ethereum?.on?.("accountsChanged", () => {
      rows = [];
      account = "";
      $("tax-result").hidden = true;
      $("tax-account").hidden = true;
    });
    $("tax-year").addEventListener("change", render);
    $("tax-csv").addEventListener("click", exportCsv);
    document.addEventListener("langchange", () => rows.length && render());
  }

  init();
})();

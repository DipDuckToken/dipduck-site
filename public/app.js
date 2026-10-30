// ─── À remplir après le lancement (voir README.md) ──────────────────────────
// Laisse une valeur vide tant qu'elle n'existe pas : la section correspondante
// reste masquée ou le bouton désactivé.
const CONFIG = {
  // Adresse du token (deployments/robinhood.json → token.address)
  contract: "",
  // Adresse du contrat de blocage (deployments/robinhood.json → vesting.address)
  vesting: "",
  // Adresse de la courbe de lancement (deployments/robinhood.json → curve.address) :
  // section « Courbe de lancement » ; vide = section masquée
  curve: "",
  // Lien d'achat direct (page de swap Uniswap avec l'adresse du token), une fois testé ;
  // tant que la courbe n'a pas ouvert le pool, le bouton d'achat mène à la courbe
  buyUrl: "",
  // Lien du graphique ; vide = la page DexScreener trouvée automatiquement
  chartUrl: "",
  // Wallet de la réserve communauté (launch.config.ts → community.beneficiary)
  communityWallet: "",
  // Date et heure du lancement, en UTC, pour le compte à rebours
  // (ex. "2026-11-20T20:00:00Z"). Vide = pas de compte à rebours.
  launchAt: "",
  x: "https://x.com/DipDuckToken",
  telegram: "",
};
// ────────────────────────────────────────────────────────────────────────────

const EXPLORER = "https://robinhoodchain.blockscout.com";
const LANGS = Object.keys(I18N);
const isAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(value);
const launched = isAddress(CONFIG.contract);
let currentLang = "en";
let market; // dernières données DexScreener

const t = (key) => I18N[currentLang][key] ?? I18N.en[key] ?? "";

function pickLanguage() {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  if (fromUrl && LANGS.includes(fromUrl)) return fromUrl;
  const saved = localStorage.getItem("lang");
  if (saved && LANGS.includes(saved)) return saved;
  const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LANGS.includes(browser) ? browser : "en";
}

function renderMarquee() {
  const track = document.getElementById("marquee");
  const words = t("marquee").split("|");
  track.replaceChildren();
  // Deux copies : l'animation défile de -50 % pour boucler sans saut.
  for (let copy = 0; copy < 2; copy++) {
    for (let i = 0; i < 3; i++) {
      for (const word of words) {
        const span = document.createElement("span");
        span.textContent = word;
        track.append(span);
      }
    }
  }
}

function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  }
  document.getElementById("ca-value").textContent = launched ? CONFIG.contract : t("contractPending");
  renderMarquee();
  renderStats();
  localStorage.setItem("lang", lang);
  document.dispatchEvent(new Event("langchange"));
}

function setLinks(selector, url) {
  for (const el of document.querySelectorAll(selector)) {
    if (url) {
      el.href = url;
      el.removeAttribute("aria-disabled");
    } else {
      el.removeAttribute("href");
      el.setAttribute("aria-disabled", "true");
    }
  }
}

function applyConfig() {
  document.getElementById("ca").classList.toggle("pending", !launched);
  setLinks(".buy-link", launched ? CONFIG.buyUrl : "");
  setLinks(".chart-link", launched ? CONFIG.chartUrl || `${EXPLORER}/token/${CONFIG.contract}` : "");

  if (isAddress(CONFIG.vesting)) {
    const link = document.getElementById("vesting-link");
    link.href = `${EXPLORER}/address/${CONFIG.vesting}`;
    link.textContent = CONFIG.vesting;
    document.getElementById("vesting-line").hidden = false;
  }
  if (isAddress(CONFIG.communityWallet)) {
    const link = document.getElementById("community-link");
    link.href = `${EXPLORER}/address/${CONFIG.communityWallet}`;
    link.textContent = CONFIG.communityWallet;
    document.getElementById("community-line").hidden = false;
  }
  for (const [id, url] of [["x-link", CONFIG.x], ["tg-link", CONFIG.telegram]]) {
    const el = document.getElementById(id);
    el.hidden = !url;
    if (url) el.href = url;
  }
}

// ─── Chiffres en direct (DexScreener, API publique) ─────────────────────────
function money(value, compact) {
  if (!Number.isFinite(value)) return "—";
  const locale = currentLang === "zh" ? "zh-CN" : currentLang;
  if (compact) {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
  }
  // Prix minuscules : chiffres significatifs plutôt que décimales fixes.
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumSignificantDigits: 4 }).format(value);
}

function renderStats() {
  const note = document.getElementById("stats-note");
  if (!market) {
    note.textContent = t("statsSoon");
    return;
  }
  document.getElementById("s-price").textContent = money(Number(market.priceUsd), false);
  document.getElementById("s-mcap").textContent = money(market.marketCap ?? market.fdv, true);
  document.getElementById("s-liq").textContent = money(market.liquidity?.usd, true);
  document.getElementById("s-vol").textContent = money(market.volume?.h24, true);
  note.textContent = t("statsLive");
}

async function loadMarket() {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${CONFIG.contract}`);
    if (!response.ok) return;
    const data = await response.json();
    const pairs = (data.pairs ?? []).filter(
      (pair) => pair.chainId === "robinhood" && pair.baseToken?.address?.toLowerCase() === CONFIG.contract.toLowerCase(),
    );
    if (pairs.length === 0) return;
    market = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    // Seulement un lien DexScreener : on ne met jamais sur le site une URL venue d'ailleurs.
    if (!CONFIG.chartUrl && /^https:\/\/dexscreener\.com\//.test(market.url || "")) setLinks(".chart-link", market.url);
    renderStats();
  } catch {
    // Pas de données : les tirets restent affichés.
  }
}

// Détenteurs : le compteur de Blockscout (l'explorateur officiel de la chaîne).
async function loadHolders() {
  try {
    const response = await fetch(`${EXPLORER}/api/v2/tokens/${CONFIG.contract}`);
    if (!response.ok) return;
    const { holders_count: holders } = await response.json();
    if (holders === undefined || holders === null) return;
    const locale = currentLang === "zh" ? "zh-CN" : currentLang;
    document.getElementById("s-holders").textContent = new Intl.NumberFormat(locale).format(Number(holders));
  } catch {
    // Pas de données : le tiret reste affiché.
  }
}

// ─── Compte à rebours ───────────────────────────────────────────────────────
function startCountdown() {
  const target = Date.parse(CONFIG.launchAt);
  const box = document.getElementById("countdown");
  if (Number.isNaN(target) || launched) return;
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const left = Math.max(0, Math.floor((target - Date.now()) / 1000));
    box.hidden = left === 0;
    document.getElementById("cd-d").textContent = Math.floor(left / 86_400);
    document.getElementById("cd-h").textContent = pad(Math.floor((left % 86_400) / 3_600));
    document.getElementById("cd-m").textContent = pad(Math.floor((left % 3_600) / 60));
    document.getElementById("cd-s").textContent = pad(left % 60);
    if (left > 0) setTimeout(tick, 1000);
  };
  tick();
}

// ─── Interactions ───────────────────────────────────────────────────────────
document.getElementById("kit-banner").addEventListener("click", async () => {
  DD.download(await DD.banner(), "dipduck-banner-x-1500x500.png");
});

document.getElementById("copy").addEventListener("click", async (event) => {
  const label = event.currentTarget.querySelector("[data-i18n]");
  await navigator.clipboard.writeText(CONFIG.contract);
  label.textContent = t("copied");
  setTimeout(() => (label.textContent = t("copy")), 1500);
});

for (const button of document.querySelectorAll("[data-lang]")) {
  button.addEventListener("click", () => applyLanguage(button.dataset.lang));
}

// Apparition des sections au défilement (désactivée si l'animation est réduite).
if (!matchMedia("(prefers-reduced-motion: reduce)").matches && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });
  for (const el of document.querySelectorAll(".section > *, .stats, .cta-band")) {
    el.classList.add("reveal");
    observer.observe(el);
  }
}

applyConfig();
applyLanguage(pickLanguage());
startCountdown();
if (launched) {
  loadMarket();
  loadHolders();
  setInterval(loadMarket, 60_000);
  setInterval(loadHolders, 120_000);
}

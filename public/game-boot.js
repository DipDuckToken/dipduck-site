// game.html : page autonome (plein écran, future mini-app Telegram), même langue que le site.
// Fichier séparé (pas de script inline) pour permettre une CSP script-src 'self'.
const LANGS = Object.keys(I18N);
const fromUrl = new URLSearchParams(location.search).get("lang");
const saved = localStorage.getItem("lang");
const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
const currentLang = [fromUrl, saved, browser].find((l) => LANGS.includes(l)) || "en";
const t = (key) => I18N[currentLang][key] ?? I18N.en[key] ?? key;
document.documentElement.lang = currentLang === "zh" ? "zh-Hans" : currentLang;

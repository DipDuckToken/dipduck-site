// card.html : réglages partagés avec cards.js et nft.js (explorateur, langue, traduction).
// Fichier séparé (pas de script inline) pour permettre une CSP script-src 'self'.
const EXPLORER = "https://robinhoodchain.blockscout.com";
const params = new URLSearchParams(location.search);
const LANGS = Object.keys(I18N);
const currentLang = [params.get("lang"), localStorage.getItem("lang")].find((l) => LANGS.includes(l)) || "en";
const t = (key) => I18N[currentLang][key] ?? I18N.en[key] ?? key;
if (params.get("render")) document.body.classList.add("render");

// roadmap.html : même langue que le site, listes « titre::texte|… » construites depuis i18n.js.
// Fichier séparé (pas de script inline) pour permettre une CSP script-src 'self'.
const LANGS = Object.keys(I18N);

function pickLanguage() {
  const fromUrl = new URLSearchParams(location.search).get("lang");
  const saved = localStorage.getItem("lang");
  const browser = (navigator.language || "en").slice(0, 2).toLowerCase();
  return [fromUrl, saved, browser].find((l) => LANGS.includes(l)) || "en";
}

function applyLanguage(lang) {
  const t = (key) => I18N[lang][key] ?? I18N.en[key] ?? "";
  document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
  document.title = t("rmPageTitle");
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const list of document.querySelectorAll("[data-items]")) {
    list.replaceChildren();
    for (const item of t(list.dataset.items).split("|")) {
      const [title, text] = item.split("::");
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = title;
      const p = document.createElement("p");
      p.textContent = text;
      li.append(strong, p);
      list.append(li);
    }
  }
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  }
  localStorage.setItem("lang", lang);
}

for (const button of document.querySelectorAll("[data-lang]")) {
  button.addEventListener("click", () => applyLanguage(button.dataset.lang));
}
applyLanguage(pickLanguage());

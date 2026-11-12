// roadmap.html : même langue que le site, listes « titre::texte|… » construites depuis i18n.js.
// Fichier séparé (pas de script inline) pour permettre une CSP script-src 'self'.
const LANGS = Object.keys(I18N);
// Étapes terminées, par liste et par position (0 = première), pareil dans toutes les langues.
// Ne cocher que ce qui est vérifiable publiquement (chaîne, site).
const DONE = {
  rmPhase1Items: [0, 1, 2, 3], // lancement équitable (11 nov. 19 h), liquidité verrouillée, anti-bot 24 h, jeu et mèmes
};
const DONE_LABEL = { en: "Done", fr: "Fait", es: "Hecho", zh: "已完成" };

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
    const done = DONE[list.dataset.items] ?? [];
    for (const [index, item] of t(list.dataset.items).split("|").entries()) {
      const [title, text] = item.split("::");
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = title;
      if (done.includes(index)) {
        li.classList.add("done");
        const badge = document.createElement("span");
        badge.className = "rm-done";
        badge.textContent = `✓ ${DONE_LABEL[lang] ?? DONE_LABEL.en}`;
        strong.append(" ", badge);
      }
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

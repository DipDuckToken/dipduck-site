// Sélecteur de langue en liste : un bouton « FR ▾ » ouvre les 4 langues. Les boutons [data-lang]
// restent gérés par app.js / roadmap-boot.js (clic = changer de langue) ; ici on ouvre, ferme et
// on affiche la langue choisie sur le bouton.
(() => {
  const box = document.querySelector(".langs");
  if (!box) return;
  const toggle = box.querySelector(".lang-toggle");
  const menu = box.querySelector(".lang-menu");
  const current = box.querySelector(".lang-current");
  const items = [...menu.querySelectorAll("[data-lang]")];

  const open = (yes) => {
    menu.hidden = !yes;
    toggle.setAttribute("aria-expanded", String(yes));
  };
  const showCurrent = () => {
    const on = items.find((b) => b.getAttribute("aria-pressed") === "true");
    if (on) current.textContent = on.dataset.short;
  };

  toggle.addEventListener("click", (e) => { e.stopPropagation(); open(menu.hidden); });
  for (const item of items) item.addEventListener("click", () => { open(false); toggle.focus(); });
  document.addEventListener("click", (e) => { if (!box.contains(e.target)) open(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { open(false); toggle.focus(); } });

  new MutationObserver(showCurrent).observe(menu, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
  showCurrent();
})();

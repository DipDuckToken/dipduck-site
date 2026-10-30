// card.html : dessine la vraie carte ?id=… (animation_url des métadonnées) ; avec
// ?render=1, tools/render-nft-images.mjs attend body[data-ready="1"] pour la capture PNG.
(async () => {
  const id = Number(params.get("id"));
  const msg = document.getElementById("msg");
  if (!NFT.live || !Number.isInteger(id) || id < 1) {
    msg.textContent = "Dip Duck Cards";
    return;
  }
  const card = await NFT.loadCard(id);
  if (!card.revealed) {
    DD.pond(document.getElementById("card").getContext("2d"), 1080, 1080);
    msg.textContent = `#${id} · ${t("nftUnrevealed")}`;
    return;
  }
  await DipCards.render(DipCards.fromChain(id, card.traits, card), document.getElementById("card"));
  msg.textContent = `Dip Duck Card #${id}`;
  document.body.dataset.ready = "1"; // repère pour la génération des images
})();

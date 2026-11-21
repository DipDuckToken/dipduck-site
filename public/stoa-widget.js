// No Stoa request until the visitor opens the optional panel.
// Stoa renders quotes only here; signing stays on stoadex.com.
{
  const frame = document.getElementById("stoa-frame");
  const panel = frame?.closest("details");
  panel?.addEventListener("toggle", () => {
    if (panel.open && !frame.hasAttribute("src")) {
      frame.src = frame.dataset.src;
    }
  });
}

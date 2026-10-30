// Bouton « Connecter mon wallet » de l'en-tête : connexion, passage sur Robinhood Chain,
// adresse abrégée une fois connecté. Fonctionne avant comme après le déploiement des contrats.
(() => {
  const CHAIN_ID = 4663;
  const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;
  const RPC = "https://rpc.mainnet.chain.robinhood.com";
  const EXPLORER = "https://robinhoodchain.blockscout.com";
  const button = document.getElementById("wallet-btn");
  const label = document.getElementById("wallet-label");
  if (!button || !label) return;

  let account = null;
  let onRightChain = false;

  const narrow = window.matchMedia("(max-width: 640px)");
  const short = (a) => (narrow.matches ? `${a.slice(0, 4)}…${a.slice(-3)}` : `${a.slice(0, 6)}…${a.slice(-4)}`);

  function render() {
    button.dataset.state = account ? (onRightChain ? "ok" : "wrong") : "off";
    if (!account) label.textContent = t(narrow.matches ? "walletShort" : "walletConnect");
    else if (!onRightChain) label.textContent = t(narrow.matches ? "walletShortChain" : "walletWrongChain");
    else label.textContent = short(account);
    button.title = account ? account : "";
  }

  async function readChain() {
    const chain = await window.ethereum.request({ method: "eth_chainId" });
    onRightChain = Number.parseInt(chain, 16) === CHAIN_ID;
  }

  async function switchChain() {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } catch (error) {
      if (error.code !== 4902) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: CHAIN_HEX, chainName: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: [EXPLORER] }],
      });
    }
    await readChain();
  }

  button.addEventListener("click", async () => {
    if (!window.ethereum) {
      label.textContent = t("walletNone");
      button.dataset.state = "wrong";
      setTimeout(render, 4000);
      return;
    }
    try {
      if (!account) [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
      await readChain();
      if (!onRightChain) await switchChain();
    } catch {
      // refus dans le wallet : on garde l'état actuel
    }
    render();
  });

  document.addEventListener("langchange", render);
  narrow.addEventListener("change", render);

  if (window.ethereum) {
    window.ethereum.on?.("accountsChanged", (accounts) => {
      account = accounts[0] ?? null;
      render();
    });
    window.ethereum.on?.("chainChanged", async () => {
      await readChain().catch(() => {});
      render();
    });
    // Déjà autorisé lors d'une visite précédente : reconnexion sans fenêtre.
    window.ethereum
      .request({ method: "eth_accounts" })
      .then(async (accounts) => {
        account = accounts[0] ?? null;
        if (account) await readChain();
        render();
      })
      .catch(render);
  }
  render();
})();

// Génère l'image PNG de chaque vraie carte révélée : public/nft/<id>.png.
// C'est le champ « image » des métadonnées (OpenSea, wallets). Le dessin est
// exactement celui du site : la page card.html est ouverte dans Chromium headless.
//
//   npx playwright install chromium   (une fois, en local)
//   node tools/render-nft-images.mjs
//
// Seules les cartes sans image sont dessinées ; le workflow GitHub garde les
// images déjà faites dans son cache. Rien à faire tant que le contrat n'est pas
// renseigné dans public/nft.js.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const OUT = path.join(PUBLIC, "nft");
const RPC = "https://rpc.mainnet.chain.robinhood.com";

const contract = readFileSync(path.join(PUBLIC, "nft.js"), "utf8").match(/contract:\s*"(0x[0-9a-fA-F]{40})"/)?.[1];
if (!contract) {
  console.log("Pas de contrat NFT dans public/nft.js : rien à générer.");
  process.exit(0);
}

async function call(data) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: contract, data }, "latest"] }),
  });
  const { result, error } = await response.json();
  if (error) throw new Error(error.message);
  return result;
}

const word = (n) => BigInt(n).toString(16).padStart(64, "0");
const total = Number(BigInt(await call("0xa2309ff8"))); // totalMinted()
mkdirSync(OUT, { recursive: true });

const todo = [];
for (let id = 1; id <= total; id++) {
  if (existsSync(path.join(OUT, `${id}.png`))) continue;
  const traits = await call(`0x5efab6e4${word(id)}`); // traitsOf(id) : 10 mots + révélée
  if (BigInt(`0x${traits.slice(2 + 64 * 10, 2 + 64 * 11)}`) === 1n) todo.push(id);
}
console.log(`${total} cartes mintées, ${todo.length} image(s) à générer.`);
if (todo.length === 0) process.exit(0);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
for (const id of todo) {
  await page.goto(`${pathToFileURL(path.join(PUBLIC, "card.html"))}?id=${id}&render=1`);
  await page.waitForSelector("body[data-ready='1']", { timeout: 60_000 });
  await page.locator("#card").screenshot({ path: path.join(OUT, `${id}.png`) });
  console.log(`  nft/${id}.png`);
}
await browser.close();

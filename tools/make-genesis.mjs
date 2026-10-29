// Prépare les données de départ du contrat de jeu DipDuckGame, juste avant son déploiement.
//
//   node tools/make-genesis.mjs
//
// Écrit seasons/genesis.json (lu par le kit : launch.config.ts → game.genesisFile) :
//   detectFrom      premier jour dont le contrat détectera lui-même les baisses
//   dips            baisses historiques [jour, bonus], trouvées par le moteur du jeu
//   histMinSeconds  temps minimal (s) au début de chaque tranche de 30 jours
//   recentPrices    prix bruts (USD × 1e8) des jours detectFrom−45 … detectFrom+13
// Les données sont fraîches (jusqu'à hier) : déploie le contrat dans la foulée. Ensuite,
// le contrat ajoute lui-même un prix par jour (Chainlink) et trouve les nouvelles baisses.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false";
const DAY = 86_400;
const BUCKET_DAYS = 30;
const MARGIN = 0.85;

// Historique quotidien jusqu'à hier, arrondi comme btc-history.js (4 chiffres significatifs).
const response = await fetch(SOURCE, { headers: { "User-Agent": "dipduck-site" } });
const values = (await response.json()).values.filter((point) => point.y > 0);
const byDay = new Map(values.map((point) => [Math.floor(point.x / DAY), point.y]));
const firstDay = Math.min(...byDay.keys());
const yesterday = Math.floor(Date.now() / 1000 / DAY) - 1;
const prices = [];
let previous;
for (let day = firstDay; day <= yesterday; day++) {
  previous = byDay.get(day) ?? previous;
  prices.push(Number(previous.toPrecision(4)));
}
const start = new Date(firstDay * DAY * 1000).toISOString().slice(0, 10);
if (start !== "2010-08-18") throw new Error(`La source commence le ${start}, attendu le 2010-08-18 (DATA_START du contrat).`);

// Moteur du jeu (sans la partie qui touche à la page), sur ces données fraîches.
const engine = readFileSync(path.join(ROOT, "public", "game.js"), "utf8").split("// Page d'accueil")[0];
const context = vm.createContext({ localStorage: { getItem: () => null }, BTC_HISTORY: { start, prices } });
vm.runInContext(`${engine}\nthis.DipGame = DipGame;`, context);
const { DipGame } = context;

const lastDay = prices.length - 1;
const detectFrom = lastDay - 13;
const dips = DipGame.seasonDips().filter(([day]) => day < detectFrom);
const profiles = [30, 60, 144].map((fps) => DipGame.timeProfile(fps));
const histMinSeconds = [];
for (let day = 0; day <= lastDay; day += BUCKET_DAYS) {
  histMinSeconds.push(Math.floor(Math.min(...profiles.map((p) => p[day] ?? 0)) * MARGIN));
}
const recentPrices = [];
for (let day = detectFrom - 45; day <= detectFrom + 13; day++) recentPrices.push(String(Math.round(prices[day] * 1e8)));

mkdirSync(path.join(ROOT, "seasons"), { recursive: true });
writeFileSync(path.join(ROOT, "seasons", "genesis.json"), `${JSON.stringify({ detectFrom, dips, histMinSeconds, recentPrices })}\n`);
const date = (day) => new Date((firstDay + day) * DAY * 1000).toISOString().slice(0, 10);
console.log(`Genèse : ${dips.length} baisses historiques ; le contrat détectera lui-même à partir du ${date(detectFrom)}.`);
console.log(`Dernier jour inclus : ${date(lastDay)}. Déploie le contrat aujourd'hui (npm run game:deploy:mainnet dans le kit).`);

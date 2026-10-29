"""Écrit public/eth-history.js : cours quotidien de l'ETH en USD et en CAD.

    python tools/make-price-history.py

Sert au suivi fiscal du site (valeur de chaque transaction à sa date).
- ETH/USD : cours de clôture quotidien de Coinbase Exchange (UTC).
- USD/CAD : taux quotidien moyen de la Banque du Canada (série FXUSDCAD), le taux que
  l'ARC et Revenu Québec acceptent. Les jours sans taux (fins de semaine, fériés)
  reprennent le dernier taux publié.
Depuis le lancement de Robinhood Chain (1er juillet 2026) jusqu'à hier. Le workflow
GitHub le relance à chaque exécution.
"""

import json
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

START = date(2026, 7, 1)
OUT = Path(__file__).resolve().parent.parent / "public" / "eth-history.js"
CANDLES = "https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=86400&start={}&end={}"
BOC = "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?start_date={}&end_date={}"


def get(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": "dipduck-site"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def eth_usd(first: date, last: date) -> dict[date, float]:
    closes: dict[date, float] = {}
    cursor = first
    while cursor <= last:
        # 300 bougies au plus par requête.
        chunk_end = min(cursor + timedelta(days=299), last)
        for candle in get(CANDLES.format(f"{cursor}T00:00:00Z", f"{chunk_end}T23:59:59Z")):
            # [heure, bas, haut, ouverture, clôture, volume]
            closes[datetime.fromtimestamp(candle[0], timezone.utc).date()] = candle[4]
        cursor = chunk_end + timedelta(days=1)
    return closes


def usd_cad(first: date, last: date) -> dict[date, float]:
    data = get(BOC.format(first - timedelta(days=10), last))
    return {date.fromisoformat(o["d"]): float(o["FXUSDCAD"]["v"]) for o in data["observations"] if "FXUSDCAD" in o}


def main() -> None:
    last = datetime.now(timezone.utc).date() - timedelta(days=1)
    usd = eth_usd(START, last)
    fx = usd_cad(START, last)
    usd_rows, cad_rows, fx_rows = [], [], []
    price = rate = None
    day = START
    while day <= last:
        price = usd.get(day, price)
        # Dernier taux publié à cette date (ou avant).
        rate = fx.get(day, rate) if day in fx else rate or next((fx[d] for d in sorted(fx, reverse=True) if d <= day), None)
        usd_rows.append(f"{price:.2f}" if price else "null")
        fx_rows.append(f"{rate:.4f}" if rate else "null")
        cad_rows.append(f"{price * rate:.2f}" if price and rate else "null")
        day += timedelta(days=1)
    OUT.write_text(
        "// Généré par tools/make-price-history.py — ne pas modifier à la main.\n"
        "// Un nombre par jour (UTC) : ETH en USD (Coinbase), taux USD/CAD (Banque du Canada), ETH en CAD.\n"
        f'const ETH_HISTORY = {{ start: "{START}", usd: [{",".join(usd_rows)}], usdcad: [{",".join(fx_rows)}], cad: [{",".join(cad_rows)}] }};\n',
        encoding="utf-8",
    )
    print(f"{len(usd_rows)} jours, du {START} au {last} -> {OUT}")


if __name__ == "__main__":
    main()

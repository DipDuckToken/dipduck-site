"""Télécharge l'historique quotidien du prix du Bitcoin et l'écrit dans public/btc-history.js.

    python tools/make-btc-history.py

Source : api.blockchain.info (prix de marché quotidien en USD, depuis août 2010).
Les jours manquants reprennent le prix de la veille ; les prix sont arrondis à
4 chiffres significatifs (largement assez pour le jeu, et le fichier reste léger).

La courbe s'arrête au dernier jour du mois précédent : chaque mois, une nouvelle
exécution ajoute le mois qui vient de se terminer. Le workflow GitHub quotidien
le fait tout seul le 1er de chaque mois (voir README.md).
"""

import json
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

URL = "https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false"
OUT = Path(__file__).resolve().parent.parent / "public" / "btc-history.js"
DAY = 86_400


def significant(value: float, digits: int = 4) -> str:
    text = f"{value:.{digits}g}"
    return str(int(float(text))) if "e" in text else text


def main() -> None:
    request = urllib.request.Request(URL, headers={"User-Agent": "dipduck-site"})
    with urllib.request.urlopen(request, timeout=60) as response:
        values = json.load(response)["values"]
    by_day = {point["x"] // DAY: point["y"] for point in values if point["y"] > 0}
    # Dernier jour inclus : la veille du 1er du mois en cours (UTC).
    month_start = date.today().replace(day=1)
    end_of_last_month = datetime(month_start.year, month_start.month, 1, tzinfo=timezone.utc).timestamp() // DAY - 1
    first, last = min(by_day), min(max(by_day), int(end_of_last_month))
    prices, previous = [], None
    for day in range(first, last + 1):
        previous = by_day.get(day, previous)
        prices.append(significant(previous))
    start = datetime.fromtimestamp(first * DAY, timezone.utc).strftime("%Y-%m-%d")
    OUT.write_text(
        "// Généré par tools/make-btc-history.py — ne pas modifier à la main.\n"
        "// Prix quotidien du Bitcoin en USD (source : blockchain.info), un nombre par jour.\n"
        f'const BTC_HISTORY = {{ start: "{start}", prices: [{",".join(prices)}] }};\n',
        encoding="utf-8",
    )
    print(f"{len(prices)} jours, du {start} au {datetime.fromtimestamp(last * DAY, timezone.utc):%Y-%m-%d} -> {OUT}")


if __name__ == "__main__":
    main()

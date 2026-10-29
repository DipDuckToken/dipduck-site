"""Fabrique toutes les images du site à partir du logo téléchargé depuis Canva.

    python tools/make-logos.py chemin/vers/logo-canva.png

Le badge est découpé en cercle (coins transparents), puis exporté en :
  public/logo.png            512 × 512  (Blockscout, DexScreener, wallets)
  public/logo-1024.png       1024 × 1024 (réserve haute définition)
  public/favicon-48.png      48 × 48
  public/apple-touch-icon.png 180 × 180
  public/og-image.png        1200 × 630 (aperçu des liens sur X, Telegram…)
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

PUBLIC = Path(__file__).resolve().parent.parent / "public"
NAVY = (11, 21, 36, 255)
SUPERSAMPLE = 4


def circle_mask(size: int, inset_ratio: float) -> Image.Image:
    """Masque circulaire lissé (anticrénelage par suréchantillonnage)."""
    big = size * SUPERSAMPLE
    inset = int(big * inset_ratio)
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).ellipse((inset, inset, big - inset - 1, big - inset - 1), fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def badge(source: Image.Image, inset_ratio: float) -> Image.Image:
    side = min(source.size)
    left = (source.width - side) // 2
    top = (source.height - side) // 2
    square = source.crop((left, top, left + side, top + side)).convert("RGBA")
    square.putalpha(circle_mask(side, inset_ratio))
    return square


def save_square(image: Image.Image, size: int, name: str) -> None:
    image.resize((size, size), Image.LANCZOS).save(PUBLIC / name, optimize=True)
    print(f"  {name} ({size} × {size})")


def og_image(logo: Image.Image) -> None:
    canvas = Image.new("RGBA", (1200, 630), NAVY)
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((300, 15, 900, 615), fill=(255, 210, 63, 70))
    canvas.alpha_composite(glow.filter(ImageFilter.GaussianBlur(80)))
    mark = logo.resize((520, 520), Image.LANCZOS)
    canvas.alpha_composite(mark, ((1200 - 520) // 2, (630 - 520) // 2))
    canvas.convert("RGB").save(PUBLIC / "og-image.png", optimize=True)
    print("  og-image.png (1200 × 630)")


def main() -> None:
    if len(sys.argv) not in (2, 3):
        sys.exit("Usage : python tools/make-logos.py chemin/vers/logo-canva.png [inset, défaut 0.015]")
    # Inset de 1,5 % : retire le fond clair autour de l'anneau doré.
    inset = float(sys.argv[2]) if len(sys.argv) > 2 else 0.015
    logo = badge(Image.open(sys.argv[1]), inset)
    print("Images écrites dans public/ :")
    save_square(logo, 1024, "logo-1024.png")
    save_square(logo, 512, "logo.png")
    save_square(logo, 180, "apple-touch-icon.png")
    save_square(logo, 48, "favicon-48.png")
    og_image(logo)


if __name__ == "__main__":
    main()

"""Render every PantauPesisir brand asset from one vector definition.

The mark is red-on-white, matching the interface palette: a signal-red rounded
square, cream waves, and a deeper red sun (the sun needs to separate from the
field, so it is darker than the background rather than the same red).

Outputs (run from frontend/):
    public/logo-mark.svg        the wordmark asset, and the source of the PNGs
    app/icon.png                512, favicon and metadata
    app/apple-icon.png          180, iOS home screen
    public/apple-touch-icon.png 180, legacy touch icon
    public/icons/icon-192.png   192, PWA
    public/icons/icon-512.png   512, PWA
    public/icons/maskable-512.png  512, full-bleed with a safe zone
    app/opengraph-image.png     1200x630 share card
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Palette taken from frontend/app/globals.css @theme.
FIELD = (26, 58, 56)      # --color-ground   #1a3a38
DEEP = (214, 60, 45)      # the red sun, kept as the one warm accent
CREAM = (255, 255, 255)   # --color-paper
LIGHT = (110, 176, 175)   # teal, the lower wave
INK = (14, 27, 38)
MUTED = (90, 96, 102)

SCALE = 8


def wave_path(size: float, y: float, amp: float, thickness: float) -> str:
    """An SVG path for one wave band, built from two offset sine curves."""
    width = size * 0.74
    x0 = (size - width) / 2
    steps = 120
    top, bottom = [], []
    for i in range(steps + 1):
        t = i / steps
        x = x0 + width * t
        curve = y + amp * math.sin(2 * math.pi * t - math.pi / 2)
        top.append((x, curve - thickness / 2))
        bottom.append((x, curve + thickness / 2))
    pts = top + bottom[::-1]
    return "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"


def wave_points_svg(y: float, amp: float, thickness: float) -> str:
    """The same polygon the PNG uses, emitted as an SVG path.

    Both outputs read from this one function so the favicon and the wordmark
    cannot describe different shapes.
    """
    s = 512
    width = s * 0.74
    x0 = (s - width) / 2
    top, bottom = [], []
    for i in range(201):
        t = i / 200
        x = x0 + width * t
        curve = y + amp * math.sin(2 * math.pi * t - math.pi / 2)
        top.append((x, curve - thickness / 2))
        bottom.append((x, curve + thickness / 2))
    pts = top + bottom[::-1]
    return "M" + "L".join(f"{x:.1f} {yy:.1f}" for x, yy in pts) + "Z"


def svg() -> str:
    waves = wave_points_svg(512 * 0.52, 512 * 0.060, 512 * 0.088)
    waves2 = wave_points_svg(512 * 0.68, 512 * 0.052, 512 * 0.088)
    lines = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="PantauPesisir">',
        '  <rect width="512" height="512" rx="113" fill="#1a3a38"/>',
        '  <circle cx="343" cy="138" r="44" fill="#d63c2d"/>',
        f'  <path d="{waves}" fill="#ffffff"/>',
        f'  <path d="{waves2}" fill="#6eb0af"/>',
        "</svg>",
    ]
    return chr(10).join(lines) + chr(10)


def draw_mark(size: int, maskable: bool = False) -> Image.Image:
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if maskable:
        # The OS crops maskable icons to a circle, so the field is full-bleed and
        # the mark shrinks into the safe zone instead of touching the edge.
        d.rectangle([0, 0, s, s], fill=FIELD)
        inner = int(s * 0.72)
        offset = (s - inner) // 2
        layer = Image.new("RGBA", (inner, inner), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        s = inner
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=FIELD)

    r = s * 0.085
    cx, cy = s * 0.67, s * 0.27
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DEEP)

    for y, amp, colour in ((s * 0.52, s * 0.060, CREAM), (s * 0.68, s * 0.052, LIGHT)):
        width = s * 0.74
        x0 = (s - width) / 2
        top, bottom = [], []
        for i in range(201):
            t = i / 200
            x = x0 + width * t
            curve = y + amp * math.sin(2 * math.pi * t - math.pi / 2)
            top.append((x, curve - s * 0.044))
            bottom.append((x, curve + s * 0.044))
        d.polygon(top + bottom[::-1], fill=colour)

    if maskable:
        img.paste(layer, (offset, offset), layer)

    return img.resize((size, size), Image.LANCZOS)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    for n in (["seguisb.ttf", "segoeuib.ttf"] if bold else ["segoeui.ttf"]):
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    return ImageFont.load_default()


def opengraph(out: Path) -> None:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), (250, 248, 245))
    d = ImageDraw.Draw(img)

    mark = draw_mark(116).convert("RGBA")
    img.paste(mark, (96, 214), mark)

    d.text((238, 232), "PantauPesisir", font=font(64, True), fill=INK)
    d.text((240, 306), "Konsol pemantauan pesisir", font=font(28), fill=MUTED)
    d.line([(240, 356), (312, 356)], fill=FIELD, width=4)
    d.text(
        (96, 430),
        "Ombak, angin, dan peringatan aktif di tiga pantai,\ndirangkum menjadi satu keputusan.",
        font=font(30),
        fill=INK,
        spacing=12,
    )

    d.rectangle([0, H - 88, W, H], fill=FIELD)
    d.text((96, H - 62), "pantaupesisir.vercel.app", font=font(28, True), fill=(255, 255, 255))
    img.save(out, "PNG")
    print("wrote", out)


def main() -> None:
    Path("public/logo-mark.svg").write_text(svg(), encoding="utf-8")
    print("wrote public/logo-mark.svg")

    for path, size, maskable in [
        ("app/icon.png", 512, False),
        ("app/apple-icon.png", 180, False),
        ("public/apple-touch-icon.png", 180, False),
        ("public/icons/icon-192.png", 192, False),
        ("public/icons/icon-512.png", 512, False),
        ("public/icons/maskable-512.png", 512, True),
    ]:
        draw_mark(size, maskable).save(path, "PNG")
        print("wrote", path)

    opengraph(Path("app/opengraph-image.png"))


if __name__ == "__main__":
    main()

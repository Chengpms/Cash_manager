#!/usr/bin/env python3
"""Genera los iconos de la app (escritorio y Android) a partir de un dibujo
vectorial sencillo: una cartera blanca sobre un degradado naranja/terracota.

Uso: python3 scripts/generate-icons.py   (requiere Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
LIGHT = (0xF3, 0x92, 0x5A)
DARK = (0xB8, 0x50, 0x1F)
SS = 4  # supersampling para bordes suaves


def gradient(size):
    # Degradado diagonal; se calcula pequeño y se escala (es lineal, no se nota)
    n = min(size, 256)
    img = Image.new("RGB", (n, n))
    px = img.load()
    for y in range(n):
        for x in range(n):
            t = (x + y) / (2 * (n - 1))
            px[x, y] = tuple(int(LIGHT[i] + (DARK[i] - LIGHT[i]) * t) for i in range(3))
    return img.resize((size, size), Image.BILINEAR)


def draw_wallet(draw, cx, cy, w, color, accent=DARK):
    """Cartera rellena centrada en (cx, cy) con anchura w."""
    h = w * 0.70
    r = w * 0.13
    x0, y0 = cx - w / 2, cy - h / 2 + w * 0.06
    # Billete asomando por arriba (blanco semitransparente)
    note = (255, 255, 255, 150)
    draw.rounded_rectangle([x0 + w * 0.10, y0 - w * 0.16, x0 + w * 0.78, y0 + w * 0.10], radius=r * 0.6, fill=note)
    # Cuerpo
    draw.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=r, fill=color)
    # Cierre (pestaña en el lado derecho, en el color de fondo)
    cw, ch = w * 0.36, h * 0.34
    ccy = y0 + h * 0.52
    draw.rounded_rectangle(
        [x0 + w - cw, ccy - ch / 2, x0 + w + w * 0.02, ccy + ch / 2], radius=ch / 2, fill=accent + (255,)
    )
    dot = w * 0.06
    dx = x0 + w - cw + ch / 2
    draw.ellipse([dx - dot, ccy - dot, dx + dot, ccy + dot], fill=color)


def square_icon(size, radius_ratio=0.22, wallet_ratio=0.56, round_shape=False):
    big = size * SS
    bg = gradient(big)
    mask = Image.new("L", (big, big), 0)
    md = ImageDraw.Draw(mask)
    if round_shape:
        md.ellipse([0, 0, big - 1, big - 1], fill=255)
    else:
        md.rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * radius_ratio), fill=255)
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    img.paste(bg, (0, 0), mask)
    draw_wallet(ImageDraw.Draw(img), big / 2, big / 2, big * wallet_ratio, (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def foreground(size):
    """Capa frontal del icono adaptativo de Android (zona segura = 66% central)."""
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw_wallet(ImageDraw.Draw(img), big / 2, big / 2, big * 0.40, (255, 255, 255, 255))
    return img.resize((size, size), Image.LANCZOS)


def background(size):
    return gradient(size)


def main():
    desktop = ROOT / "desktop" / "build"
    desktop.mkdir(parents=True, exist_ok=True)
    square_icon(1024).save(desktop / "icon.png")
    square_icon(256).save(desktop / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    square_icon(256).save(ROOT / "frontend" / "public" / "icon.png") if (ROOT / "frontend" / "public").exists() else None

    res = ROOT / "frontend" / "android" / "app" / "src" / "main" / "res"
    if res.exists():
        densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
        for name, scale in densities.items():
            d = res / f"mipmap-{name}"
            d.mkdir(exist_ok=True)
            legacy = int(48 * scale)
            adaptive = int(108 * scale)
            square_icon(legacy, radius_ratio=0.18, wallet_ratio=0.58).save(d / "ic_launcher.png")
            square_icon(legacy, wallet_ratio=0.52, round_shape=True).save(d / "ic_launcher_round.png")
            foreground(adaptive).save(d / "ic_launcher_foreground.png")
            background(adaptive).save(d / "ic_launcher_background.png")
        anydpi = res / "mipmap-anydpi-v26"
        anydpi.mkdir(exist_ok=True)
        xml = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
            "</adaptive-icon>\n"
        )
        (anydpi / "ic_launcher.xml").write_text(xml)
        (anydpi / "ic_launcher_round.xml").write_text(xml)

        # Pantallas de arranque: fondo crema con el icono en el centro
        for splash in res.glob("drawable*/splash.png"):
            with Image.open(splash) as old:
                w, h = old.size
            img = Image.new("RGB", (w, h), (0xF6, 0xF0, 0xE4))
            size = int(min(w, h) * 0.28)
            icon = square_icon(size)
            img.paste(icon, ((w - size) // 2, (h - size) // 2), icon)
            img.save(splash)
    print("Iconos generados")


if __name__ == "__main__":
    main()

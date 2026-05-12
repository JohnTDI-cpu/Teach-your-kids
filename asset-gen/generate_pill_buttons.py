"""
Procedural glossy pill buttons (assets/menu/btn_pill_*.webp).

Qwen-Image was the wrong tool for this asset class: when asked for a
"long horizontal pill" it produced three separate pill objects or
inserted a small pill in the middle of a wide white canvas — Metro then
stretched the resulting non-pill-shaped image across the actual button
and the result looked broken.

A 100-line PIL script gives us:
  - exact aspect ratio (1024 × 256 = 4:1) so React Native's
    `resizeMode='stretch'` is essentially a no-op for typical button sizes
  - colour matched exactly to the PillButton.tsx fallback palette
  - a clean rounded rectangle, soft drop shadow, broad gloss highlight
    on the top half and a subtle darker rim, in every colour

Run:
    python asset-gen/generate_pill_buttons.py

Outputs to: app/assets/menu/btn_pill_{green,blue,orange,purple,red,gray}.webp
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "app" / "assets" / "menu"
W, H = 1024, 256
PAD = 16

# Mirror PillButton.tsx PILL_FALLBACK exactly so the on-screen colour is
# identical whether the asset loads or not.
COLORS = {
    "green":  (76, 175, 80),
    "blue":   (33, 150, 243),
    "orange": (255, 152, 0),
    "purple": (156, 39, 176),
    "red":    (211, 47, 47),
    "gray":   (158, 158, 158),
}


def _mix(c, other, t):
    return tuple(int(c[i] * (1 - t) + other[i] * t) for i in range(3))


def render(base):
    radius = (H - 2 * PAD) // 2
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))

    # Drop shadow — black rounded rect offset down, then blurred.
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (PAD, PAD + 6, W - PAD, H - PAD + 6),
        radius=radius, fill=(0, 0, 0, 110),
    )
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(7)))

    # Solid body — flat fill, no per-pixel gradient. The gloss layer does
    # the 3D work without darkening the bottom half.
    ImageDraw.Draw(out).rounded_rectangle(
        (PAD, PAD, W - PAD, H - PAD),
        radius=radius, fill=base + (255,),
    )

    # Pill-shape mask used to clip the gloss.
    pill_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(pill_mask).rounded_rectangle(
        (PAD, PAD, W - PAD, H - PAD), radius=radius, fill=255,
    )

    # Top gloss — build it as an ALPHA-only layer to avoid the classic
    # "blurred-black-transparent bleed darkens the rest of the pill" trap
    # that happens when you `putalpha(mask)` on an RGBA image whose RGB
    # contains residual black from transparent areas.
    inner_w = W - 2 * PAD
    inner_h = H - 2 * PAD
    gloss_alpha = Image.new("L", (W, H), 0)
    ImageDraw.Draw(gloss_alpha).rounded_rectangle(
        (PAD + inner_w * 5 // 100, PAD + 8,
         W - PAD - inner_w * 5 // 100, PAD + inner_h * 42 // 100),
        radius=inner_h * 18 // 100, fill=160,
    )
    gloss_alpha = gloss_alpha.filter(ImageFilter.GaussianBlur(8))
    gloss_alpha = ImageChops.multiply(gloss_alpha, pill_mask)
    gloss = Image.new("RGBA", (W, H), (255, 255, 255, 0))
    gloss.putalpha(gloss_alpha)
    out.alpha_composite(gloss)

    # Subtle darker rim — 30 % toward black, partially transparent.
    ImageDraw.Draw(out).rounded_rectangle(
        (PAD, PAD, W - PAD, H - PAD), radius=radius,
        outline=_mix(base, (0, 0, 0), 0.30) + (200,), width=2,
    )
    return out


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, base in COLORS.items():
        path = OUTPUT_DIR / f"btn_pill_{name}.webp"
        render(base).save(path, "WEBP", quality=94, method=6)
        print(f"  wrote {path.name}  ({W}x{H})")


if __name__ == "__main__":
    main()

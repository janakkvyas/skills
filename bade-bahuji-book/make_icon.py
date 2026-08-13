#!/usr/bin/env python3
"""Generate the launcher icon (open book on a maroon/gold tile) with Pillow."""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

SIZE = 192  # xxxhdpi launcher icon


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def main(out_path):
    s = SIZE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # tile background with vertical shade
    tile = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    for y in range(s):
        t = y / s
        r = int(0x7A + (0x48 - 0x7A) * t)
        g = int(0x1F + (0x0F - 0x1F) * t)
        b = int(0x27 + (0x15 - 0x27) * t)
        td.line([(0, y), (s, y)], fill=(r, g, b, 255))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=s // 5, fill=255)
    img.paste(tile, (0, 0), mask)

    # gold rim
    d.rounded_rectangle([3, 3, s - 4, s - 4], radius=s // 5 - 2, outline=(207, 161, 75, 255), width=4)

    # open book: two page fans meeting at centre spine
    cx, top, bottom = s // 2, int(s * 0.36), int(s * 0.72)
    w = int(s * 0.30)
    sag = int(s * 0.05)

    def page_poly(side):
        pts = []
        steps = 16
        for i in range(steps + 1):
            t = i / steps
            x = cx + side * int(w * t)
            y = top + int(math.sin(t * math.pi) * -sag) + int(t * s * 0.045)
            pts.append((x, y))
        for i in range(steps + 1):
            t = 1 - i / steps
            x = cx + side * int(w * t)
            y = bottom - int(math.sin(t * math.pi) * sag) - int((1 - t) * s * 0.02)
            pts.append((x, y))
        return pts

    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.polygon(page_poly(-1), fill=(0, 0, 0, 110))
    sd.polygon(page_poly(1), fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    img.paste(shadow, (2, 5), shadow)

    d.polygon(page_poly(-1), fill=(248, 240, 221, 255))
    d.polygon(page_poly(1), fill=(238, 227, 203, 255))

    # spine
    d.line([(cx, top - sag // 2), (cx, bottom + sag - 2)], fill=(122, 89, 55, 255), width=3)

    # text lines on pages
    for side in (-1, 1):
        for row in range(4):
            y = top + int(s * 0.075) + row * int(s * 0.062)
            x1 = cx + side * int(s * 0.055)
            x2 = cx + side * int(s * 0.23)
            d.line([(x1, y + (2 if side < 0 else 3)), (x2, y + 6)], fill=(170, 145, 110, 210), width=2)

    # bookmark ribbon
    d.polygon([(cx - 4, top - sag), (cx + 4, top - sag), (cx + 4, top + 18), (cx, top + 12), (cx - 4, top + 18)],
              fill=(207, 161, 75, 255))

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path)
    print("icon written:", out_path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "apk/res/mipmap-xxxhdpi/ic_launcher.png")

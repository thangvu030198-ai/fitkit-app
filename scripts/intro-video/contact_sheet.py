#!/usr/bin/env python3
"""Ghép ảnh thành contact sheet có nhãn.  python3 contact_sheet.py OUT.jpg COLS W img1 img2 ...  (nhãn = tên file)"""
import sys, os
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    h = round(im.height * w / im.width)
    ims.append((os.path.basename(f), im.resize((w, h))))
hmax = max(i.height for _, i in ims) + 22
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + 6), rows * hmax), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for k, (name, im) in enumerate(ims):
    x, y = (k % cols) * (w + 6), (k // cols) * hmax
    sheet.paste(im, (x, y + 20)); d.text((x + 3, y + 4), name, fill=(255, 220, 120))
sheet.save(out, quality=85)
print(out, sheet.size)

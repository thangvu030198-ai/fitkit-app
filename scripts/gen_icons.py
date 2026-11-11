#!/usr/bin/env python3
"""TapEasy — sinh toàn bộ tài sản thương hiệu từ HÌNH HỌC VECTOR (chỉ cần Pillow + numpy).

Nguồn: logo chủ app cung cấp (assets/brand/source/logo-original.jpg, nền trắng).
  • Biểu tượng (mark): quả tạ 2 đĩa/bên + thanh đòn tách rời, chấm tròn (đầu người) và 2 nét cong
    vuốt nhọn (vai/nụ cười) — vẽ lại bằng đo đạc điểm ảnh (sai số < 0,5 px trên ảnh gốc).
  • Chữ (wordmark): "Tap" than + "Easy" teal. T, E, y dựng lại bằng toạ độ đo trên logo; a, p lấy
    đường viền Poppins Bold (SIL OFL 1.1) đã khớp tỉ lệ; s vector hoá trực tiếp từ logo (khớp đường cong
    Bézier). Kết quả là PATH → không phụ thuộc font khi hiển thị.
  • Màu đo từ ảnh gốc (trung vị vùng lõi, đã bỏ viền khử răng cưa): teal RGB(2,188,179) #02BCB3,
    than RGB(36,45,51) #242D33.

Xuất:
  assets/brand/logo-mark.svg, logo-mark-white.svg, logo-wordmark-light.svg, logo-wordmark-dark.svg,
  logo-lockup-light.svg, logo-lockup-dark.svg, logo-horizontal-light.svg, logo-horizontal-dark.svg,
  logo-mark-512.png, logo-lockup-light-1200.png, logo-lockup-dark-1200.png, icon-alt-dark-1024.png,
  logo-full.png (bản GỐC đã tách nền, rộng 1200) + source/mark-original.png (biểu tượng cắt từ ảnh gốc)
  assets/icon-192.png, icon-512.png (purpose any, bo góc), icon-maskable-512.png (vùng an toàn 80 %),
  apple-touch-icon-180.png, icon-1024.png, icon-only.png / icon-foreground.png / icon-background.png
  (@capacitor/assets), splash.png, splash-dark.png (2732²), favicon-16/32.png, favicon.ico, favicon.svg,
  shortcut-workout-96.png, shortcut-meal-96.png, og-tapeasy.jpg (1200×630)

Chạy:  python3 scripts/gen_icons.py            # tất cả
       python3 scripts/gen_icons.py --only svg,icons,splash,og,original
"""
import os, re, math, sys, argparse
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, "assets")
BRAND = os.path.join(ASSETS, "brand")
SOURCE = os.path.join(BRAND, "source", "logo-original.jpg")

# ---------------------------------------------------------------- màu thương hiệu
TEAL = "#02BCB3"         # teal logo (đo từ ảnh gốc)
TEAL_BRIGHT = "#33D6C9"  # teal sáng cho chữ/dữ liệu trên nền tối (9,8:1 trên navy)
TEAL_DEEP = "#00756F"    # teal đậm cho chữ trên nền sáng (5,6:1 trên trắng)
INK = "#242D33"          # than "Tap" (đo từ ảnh gốc)
IVORY = "#F5F7F3"        # "Tap" trên nền tối
NAVY = "#061A24"         # nền app
GRAD = ("#1CCFC1", "#02A69E", "#027A74")   # nền icon: teal sáng → teal → teal đậm (chéo 135°)

def rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

# ---------------------------------------------------------------- hình học (đơn vị thiết kế)
WORD_W, WORD_H = 770.2, 180.6
WORD = [  # (vai trò, chữ, path) — toạ độ: cap-top = 0, baseline = 141.9
    ('tap', 'T', 'M0 0 L116.8 0 L116.8 28.2 L74.5 28.2 L74.5 141.9 L42.3 141.9 L42.3 28.2 L0 28.2 Z'),
    ('tap', 'a', 'M145.17 36.06 Q156.21 36.06 164.53 40.55 Q172.85 45.03 177.34 52.33 L177.34 37.55 L209.31 37.55 L209.31 141.9 L177.34 141.9 L177.34 127.13 Q172.66 134.42 164.34 138.91 Q156.02 143.4 144.99 143.4 Q132.27 143.4 121.8 136.76 Q111.33 130.12 105.25 117.87 Q99.17 105.62 99.17 89.54 Q99.17 73.46 105.25 61.3 Q111.33 49.15 121.8 42.6 Q132.27 36.06 145.17 36.06 ZM154.52 63.92 Q144.99 63.92 138.35 70.75 Q131.71 77.57 131.71 89.54 Q131.71 101.51 138.35 108.52 Q144.99 115.53 154.52 115.53 Q164.06 115.53 170.7 108.61 Q177.34 101.69 177.34 89.73 Q177.34 77.76 170.7 70.84 Q164.06 63.92 154.52 63.92 Z'),
    ('tap', 'p', 'M290.54 36.06 Q303.44 36.06 313.92 42.6 Q324.39 49.15 330.47 61.3 Q336.54 73.46 336.54 89.54 Q336.54 105.62 330.47 117.87 Q324.39 130.12 313.92 136.76 Q303.44 143.4 290.54 143.4 Q279.7 143.4 271.37 138.91 Q263.05 134.42 258.38 127.31 L258.38 179.8 L226.4 179.8 L226.4 37.55 L258.38 37.55 L258.38 52.33 Q263.05 45.03 271.28 40.55 Q279.51 36.06 290.54 36.06 ZM281 63.92 Q271.47 63.92 264.83 70.84 Q258.19 77.76 258.19 89.73 Q258.19 101.69 264.83 108.61 Q271.47 115.53 281 115.53 Q290.54 115.53 297.27 108.52 Q304.01 101.51 304.01 89.54 Q304.01 77.57 297.37 70.75 Q290.73 63.92 281 63.92 Z'),
    ('easy', 'E', 'M352.6 0 L449.8 0 L449.8 26.8 L384.2 26.8 L384.2 57.4 L442.8 57.4 L442.8 83 L384.2 83 L384.2 115.3 L450.6 115.3 L450.6 141.9 L352.6 141.9 Z'),
    ('easy', 'a', 'M503.06 36.06 Q514.1 36.06 522.42 40.55 Q530.74 45.03 535.23 52.33 L535.23 37.55 L567.21 37.55 L567.21 141.9 L535.23 141.9 L535.23 127.13 Q530.55 134.42 522.23 138.91 Q513.91 143.4 502.88 143.4 Q490.16 143.4 479.69 136.76 Q469.22 130.12 463.14 117.87 Q457.06 105.62 457.06 89.54 Q457.06 73.46 463.14 61.3 Q469.22 49.15 479.69 42.6 Q490.16 36.06 503.06 36.06 ZM512.41 63.92 Q502.88 63.92 496.24 70.75 Q489.6 77.57 489.6 89.54 Q489.6 101.51 496.24 108.52 Q502.88 115.53 512.41 115.53 Q521.95 115.53 528.59 108.61 Q535.23 101.69 535.23 89.73 Q535.23 77.76 528.59 70.84 Q521.95 63.92 512.41 63.92 Z'),
    ('easy', 's', 'M590.84 110.56 L576.51 127.56 C595.2 151.56 663.19 151.8 662.91 112.44 C662.77 92.21 646.42 84.52 629.21 80.45 C623.18 79.03 612.83 78.1 608.63 73.17 C603.37 67 610.47 60.9 616.59 60.05 C627.32 58.56 635.49 63.34 644.34 68.64 L658.91 52.94 C639.62 26.81 576.52 32.42 579.09 72.31 C580.28 90.95 597.66 97.41 613.21 101.03 C619.67 102.53 628.98 103.35 633.29 109.05 C639.3 116.99 629.51 120.9 622.84 121.54 C610.95 122.68 600.41 117.06 590.96 110.65 Z'),
    ('easy', 'y', 'M662.9 39.4 L693.8 39.4 L717.4 107.81 L740.8 39.4 L770.2 39.4 L728.92 149 C720.92 170.27 712.5 180.6 689.4 180.6 L675.7 180.6 L675.7 155.8 L685.4 155.8 C703.14 155.8 703.71 141.84 698.6 129 Z'),
]
MARK_W, MARK_H = 200, 134
MARK_RECTS = [[0, 16, 18, 72, 9], [24, 0, 26, 104, 13], [56, 42, 88, 20, 10], [150, 0, 26, 104, 13], [182, 16, 18, 72, 9]]  # x, y, w, h, rx (đĩa tạ + thanh đòn)
MARK_DOT = (100, 90.8, 11)  # cx, cy, r
SWOOSH_L = 'M89.17 112.78 C74.75 123.89 57.49 131.24 39.38 133.4 C34.53 133.98 24.78 134.68 20.22 133.38 C22.75 132.74 25.52 132.72 28.12 132.38 C32.56 131.8 36.97 131.01 41.31 129.93 C57.34 125.97 72.29 118.27 84.72 107.38 C86.21 106.15 88.41 106.37 89.64 107.86 C90.87 109.35 90.66 111.55 89.17 112.78 Z'
SWOOSH_L_BOLD = 'M90.76 114.71 C75.8 125.75 57.95 132.91 39.37 134.45 C35 134.81 30.6 134.88 26.23 134.5 C24.27 134.33 22.01 134.24 20.22 133.38 C22.37 132.43 26.03 132.16 28.44 131.72 C33.11 130.87 37.73 129.82 42.28 128.47 C57.44 123.97 71.48 116.17 83.13 105.45 C85.68 103.35 89.47 103.71 91.57 106.27 C93.68 108.82 93.32 112.6 90.76 114.71 Z'  # bản nét dày cho icon ≤ 96 px

def _f(v):
    s = "%.2f" % v; s = s.rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s

def mirror_x(d, W):
    toks = re.findall(r"[A-Za-z]|-?\d*\.?\d+", d); out = []; i = 0
    for t in toks:
        if t.isalpha(): out.append(t); i = 0; continue
        v = float(t); out.append(_f(W - v if i % 2 == 0 else v)); i += 1
    return re.sub(r"([MLCQZ]) ", r"\1", " ".join(out))

SWOOSH_R = mirror_x(SWOOSH_L, MARK_W)
SWOOSH_R_BOLD = mirror_x(SWOOSH_L_BOLD, MARK_W)

def mark_shapes(bold=False, dumbbell_only=False):
    sh = [("rect",) + tuple(r) for r in MARK_RECTS]
    if dumbbell_only: return sh
    sh.append(("circle",) + tuple(MARK_DOT))
    sh += [("path", SWOOSH_L_BOLD if bold else SWOOSH_L), ("path", SWOOSH_R_BOLD if bold else SWOOSH_R)]
    return sh

def word_shapes(role=None):
    return [("path", d) for r, _, d in WORD if role is None or r == role]

# ---------------------------------------------------------------- path → đa giác
def parse_path(d):
    toks = re.findall(r"[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?", d); out = []; i = 0; cmd = None
    n = {"M": 2, "L": 2, "C": 6, "Q": 4}
    while i < len(toks):
        if toks[i] in "MLCQZ": cmd = toks[i]; i += 1
        if cmd == "Z": out.append(("Z", ())); continue
        out.append((cmd, tuple(float(v) for v in toks[i:i + n[cmd]]))); i += n[cmd]
        if cmd == "M": cmd = "L"
    return out

def flatten(d, s=1.0, tx=0.0, ty=0.0):
    """Trả về danh sách đa giác (đã biến đổi x*s+tx, y*s+ty), số đoạn cong tự thích ứng theo kích thước."""
    polys, cur, pos, start = [], [], (0.0, 0.0), (0.0, 0.0)
    T = lambda p: (p[0] * s + tx, p[1] * s + ty)
    for cmd, v in parse_path(d):
        if cmd == "M":
            if len(cur) > 2: polys.append(cur)
            pos = start = v[:2]; cur = [T(pos)]
        elif cmd == "L":
            pos = v[:2]; cur.append(T(pos))
        elif cmd in "CQ":
            pts = [pos] + [v[k:k + 2] for k in range(0, len(v), 2)]
            L = sum(math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1)) * s
            steps = max(6, min(160, int(math.sqrt(L) * 2)))
            P = np.array(pts, float)
            for t in np.linspace(0, 1, steps + 1)[1:]:
                mt = 1 - t
                p = (mt ** 3 * P[0] + 3 * mt * mt * t * P[1] + 3 * mt * t * t * P[2] + t ** 3 * P[3]) if cmd == "C" \
                    else (mt * mt * P[0] + 2 * mt * t * P[1] + t * t * P[2])
                cur.append(T(p))
            pos = v[-2:]
        elif cmd == "Z":
            if len(cur) > 2: polys.append(cur)
            cur = []; pos = start
    if len(cur) > 2: polys.append(cur)
    return polys

# ---------------------------------------------------------------- raster (siêu lấy mẫu, even-odd)
def shape_mask(shapes, s, tx, ty, W, H, ss=4):
    """Mặt nạ L (W×H) của danh sách hình ('rect',x,y,w,h,r) | ('circle',cx,cy,r) | ('path',d)."""
    WS, HS = W * ss, H * ss
    base = Image.new("L", (WS, HS), 0); dr = ImageDraw.Draw(base)
    paths = []
    for sh in shapes:
        if sh[0] == "rect":
            x, y, w, h, r = sh[1:]
            x0, y0 = (x * s + tx) * ss, (y * s + ty) * ss
            dr.rounded_rectangle([x0, y0, x0 + w * s * ss - 1, y0 + h * s * ss - 1], radius=r * s * ss, fill=255)
        elif sh[0] == "circle":
            cx, cy, r = sh[1:]
            cx, cy, r = (cx * s + tx) * ss, (cy * s + ty) * ss, r * s * ss
            dr.ellipse([cx - r, cy - r, cx + r - 1, cy + r - 1], fill=255)
        else:
            paths.append(sh[1])
    acc = np.asarray(base) > 127
    for d in paths:
        x = None
        for poly in flatten(d, s * ss, tx * ss, ty * ss):
            im = Image.new("L", (WS, HS), 0); ImageDraw.Draw(im).polygon(poly, fill=255)
            m = np.asarray(im) > 127
            x = m if x is None else (x ^ m)
        if x is not None: acc = acc | x
    return Image.fromarray(acc.astype(np.uint8) * 255).reduce(ss) if ss > 1 else Image.fromarray(acc.astype(np.uint8) * 255)

def paint(img, mask, color, offset=(0, 0)):
    """Tô màu đặc qua mặt nạ lên ảnh RGBA."""
    layer = Image.new("RGBA", mask.size, rgb(color) + (0,)); layer.putalpha(mask)
    img.alpha_composite(layer, dest=offset)

def linear_gradient(W, H, stops, angle=135):
    a = math.radians(angle - 90)
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    dx, dy = math.cos(a), math.sin(a)
    t = (x * dx + y * dy); t = (t - t.min()) / max(1e-6, (t.max() - t.min()))
    pos = np.linspace(0, 1, len(stops)); cols = np.array([rgb(c) for c in stops], np.float32)
    out = np.zeros((H, W, 3), np.float32)
    for k in range(3): out[..., k] = np.interp(t, pos, cols[:, k])
    return out

def radial_glow(arr, cx, cy, r, color, alpha):
    H, W = arr.shape[:2]
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    k = np.clip(1 - np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r, 0, 1) ** 2 * alpha
    return arr * (1 - k[..., None]) + np.array(rgb(color), np.float32) * k[..., None]

def to_img(arr):
    return Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

def rounded_alpha(S, radius, ss=4):
    m = Image.new("L", (S * ss, S * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S * ss - 1, S * ss - 1], radius=radius * S * ss, fill=255)
    return m.reduce(ss)

def save(img, path, rgb_only=False, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if rgb_only or path.lower().endswith((".jpg", ".jpeg")): img = img.convert("RGB")
    img.save(path, optimize=True, **kw)
    print("  wrote", os.path.relpath(path, ROOT).replace(os.sep, "/"), img.size)

# ---------------------------------------------------------------- SVG
SVG_HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="TapEasy">\n<title>TapEasy</title>\n'

def svg_shapes(shapes, fill):
    out = []
    for sh in shapes:
        if sh[0] == "rect":
            x, y, w, h, r = sh[1:]
            out.append('<rect x="%s" y="%s" width="%s" height="%s" rx="%s"/>' % tuple(_f(v) for v in (x, y, w, h, r)))
        elif sh[0] == "circle":
            out.append('<circle cx="%s" cy="%s" r="%s"/>' % tuple(_f(v) for v in sh[1:]))
        else:
            out.append('<path d="%s"/>' % sh[1])
    return '<g fill="%s" fill-rule="evenodd">\n%s\n</g>\n' % (fill, "\n".join(out))

def svg_mark(fill=TEAL, bold=False):
    return SVG_HEAD.format(w=MARK_W, h=MARK_H) + svg_shapes(mark_shapes(bold), fill) + "</svg>\n"

def svg_word_group(tap, easy):
    return svg_shapes(word_shapes("tap"), tap) + svg_shapes(word_shapes("easy"), easy)

def svg_wordmark(tap, easy):
    return SVG_HEAD.format(w=_f(WORD_W), h=_f(WORD_H)) + svg_word_group(tap, easy) + "</svg>\n"

# Bố cục xếp chồng (giống logo gốc): biểu tượng căn theo trọng tâm mực của chữ, cách chữ 20,7 đơn vị
LOCK_MARK_X, LOCK_WORD_Y = 276.65, 154.7
LOCK_W, LOCK_H = WORD_W, LOCK_WORD_Y + WORD_H
# Bố cục ngang: biểu tượng cao bằng chữ hoa (141,9), khoảng cách 0,36 × chữ hoa
HZ_K = 141.9 / MARK_H; HZ_GAP = 51.0
HZ_WORD_X = MARK_W * HZ_K + HZ_GAP
HZ_W, HZ_H = HZ_WORD_X + WORD_W, WORD_H

def svg_lockup(tap, easy, mark=TEAL):
    return (SVG_HEAD.format(w=_f(LOCK_W), h=_f(LOCK_H))
            + '<g transform="translate(%s 0)">\n' % _f(LOCK_MARK_X) + svg_shapes(mark_shapes(), mark) + "</g>\n"
            + '<g transform="translate(0 %s)">\n' % _f(LOCK_WORD_Y) + svg_word_group(tap, easy) + "</g>\n</svg>\n")

def svg_horizontal(tap, easy, mark=TEAL):
    return (SVG_HEAD.format(w=_f(HZ_W), h=_f(HZ_H))
            + '<g transform="scale(%s)">\n' % ("%.5f" % HZ_K) + svg_shapes(mark_shapes(), mark) + "</g>\n"
            + '<g transform="translate(%s 0)">\n' % _f(HZ_WORD_X) + svg_word_group(tap, easy) + "</g>\n</svg>\n")

def svg_favicon():
    s = 64 * 0.74 / MARK_W; tx = (64 - MARK_W * s) / 2; ty = (64 - MARK_H * s) / 2 + 0.6
    g = svg_shapes(mark_shapes(bold=True), "#FFFFFF")
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n<title>TapEasy</title>\n'
            '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="%s"/><stop offset=".55" stop-color="%s"/><stop offset="1" stop-color="%s"/>'
            '</linearGradient></defs>\n<rect width="64" height="64" rx="14" fill="url(#g)"/>\n'
            '<g transform="translate(%s %s) scale(%s)">\n%s</g>\n</svg>\n') % (GRAD + (_f(tx), _f(ty), "%.5f" % s, g))

def write_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh: fh.write(text)
    print("  wrote", os.path.relpath(path, ROOT).replace(os.sep, "/"), "(%d B)" % len(text.encode()))

def gen_svg():
    print("SVG:")
    write_text(os.path.join(BRAND, "logo-mark.svg"), svg_mark(TEAL))
    write_text(os.path.join(BRAND, "logo-mark-white.svg"), svg_mark("#FFFFFF"))
    write_text(os.path.join(BRAND, "logo-wordmark-light.svg"), svg_wordmark(IVORY, TEAL))
    write_text(os.path.join(BRAND, "logo-wordmark-dark.svg"), svg_wordmark(INK, TEAL))
    write_text(os.path.join(BRAND, "logo-lockup-light.svg"), svg_lockup(IVORY, TEAL))
    write_text(os.path.join(BRAND, "logo-lockup-dark.svg"), svg_lockup(INK, TEAL))
    write_text(os.path.join(BRAND, "logo-horizontal-light.svg"), svg_horizontal(IVORY, TEAL))
    write_text(os.path.join(BRAND, "logo-horizontal-dark.svg"), svg_horizontal(INK, TEAL))
    write_text(os.path.join(ASSETS, "favicon.svg"), svg_favicon())

# ---------------------------------------------------------------- vẽ logo lên ảnh
def draw_mark(img, cx, cy, width, color, bold=None, dumbbell_only=False):
    """Vẽ biểu tượng rộng `width` px, tâm hộp bao tại (cx, cy)."""
    s = width / MARK_W
    if bold is None: bold = width <= 70
    x0, y0 = int(math.floor(cx - MARK_W * s / 2)) - 2, int(math.floor(cy - MARK_H * s / 2)) - 2
    W, H = int(MARK_W * s) + 5, int(MARK_H * s) + 5
    m = shape_mask(mark_shapes(bold, dumbbell_only), s, cx - MARK_W * s / 2 - x0, cy - MARK_H * s / 2 - y0, W, H)
    paint(img, m, color, (x0, y0))

def draw_word(img, x, y, width, tap, easy):
    s = width / WORD_W; x0, y0 = int(x) - 2, int(y) - 2
    W, H = int(WORD_W * s) + 5, int(WORD_H * s) + 5
    for role, col in (("tap", tap), ("easy", easy)):
        paint(img, shape_mask(word_shapes(role), s, x - x0, y - y0, W, H), col, (x0, y0))

def draw_lockup(img, cx, top, width, tap, easy, mark=TEAL):
    s = width / LOCK_W; left = cx - width / 2
    draw_mark(img, left + (LOCK_MARK_X + MARK_W / 2) * s, top + MARK_H * s / 2, MARK_W * s, mark, bold=False)
    draw_word(img, left, top + LOCK_WORD_Y * s, WORD_W * s, tap, easy)
    return LOCK_H * s

def draw_horizontal(img, left, top, height, tap, easy, mark=TEAL):
    s = height / HZ_H
    draw_mark(img, left + MARK_W * HZ_K * s / 2, top + MARK_H * HZ_K * s / 2, MARK_W * HZ_K * s, mark)
    draw_word(img, left + HZ_WORD_X * s, top, WORD_W * s, tap, easy)
    return HZ_W * s

# ---------------------------------------------------------------- icon app
def teal_bg(S):
    arr = linear_gradient(S, S, GRAD, 135)
    arr = radial_glow(arr, S * 0.22, S * 0.12, S * 0.85, "#FFFFFF", 0.16)   # ánh sáng mềm góc trên-trái
    return to_img(arr)

def app_icon(S, frac=0.62, radius=None, bg="teal", bold=None):
    """frac = bề rộng biểu tượng / cạnh icon. radius = bo góc (tỉ lệ cạnh) hoặc None (vuông kín)."""
    if bg == "teal":
        img = teal_bg(S); col = "#FFFFFF"
    elif bg == "dark":
        arr = linear_gradient(S, S, ("#123A44", NAVY), 135)
        arr = radial_glow(arr, S * 0.5, S * 0.46, S * 0.56, TEAL, 0.30)
        img = to_img(arr); col = TEAL_BRIGHT
    else:
        img = Image.new("RGBA", (S, S), (0, 0, 0, 0)); col = "#FFFFFF"
    # hạ tâm 1,2 % để cân thị giác (khối quả tạ nặng phía trên)
    draw_mark(img, S / 2, S / 2 + S * 0.012, S * frac, col, bold=bold)
    if radius:
        img.putalpha(rounded_alpha(S, radius))
    return img

def shortcut(kind, size=96):
    S = size; img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    disc = to_img(linear_gradient(S, S, GRAD, 135))
    m = Image.new("L", (S * 4, S * 4), 0); ImageDraw.Draw(m).ellipse([0, 0, S * 4 - 1, S * 4 - 1], fill=255)
    disc.putalpha(m.reduce(4)); img.alpha_composite(disc)
    if kind == "workout":   # chỉ quả tạ (cao 104/134) → dời tâm hộp bao để quả tạ nằm giữa
        w = S * 0.64; draw_mark(img, S / 2, S / 2 + (MARK_H / 2 - 52) * w / MARK_W, w, "#FFFFFF", dumbbell_only=True)
    else:   # bát cơm + đôi đũa
        ss = 8; L = Image.new("L", (S * ss, S * ss), 0); d = ImageDraw.Draw(L); u = S * ss / 100
        d.pieslice([22 * u, 22 * u, 78 * u, 78 * u], 0, 180, fill=255)               # lòng bát
        d.rounded_rectangle([18 * u, 47 * u, 82 * u, 53 * u], radius=3 * u, fill=255)  # miệng bát
        d.rounded_rectangle([40 * u, 76 * u, 60 * u, 81 * u], radius=2.5 * u, fill=255) # chân bát
        for x1, x2 in ((44, 66), (52, 74)):                                             # đôi đũa chéo
            p1, p2 = np.array([x1 * u, 42 * u]), np.array([x2 * u, 18 * u]); w = 2.6 * u
            n = np.array([-(p2 - p1)[1], (p2 - p1)[0]]); n = n / np.linalg.norm(n) * w
            d.polygon([tuple(p1 + n), tuple(p2 + n * .7), tuple(p2 - n * .7), tuple(p1 - n)], fill=255)
        paint(img, L.reduce(ss), "#FFFFFF")
    return img

def gen_icons():
    print("Icon:")
    save(app_icon(1024), os.path.join(ASSETS, "icon-1024.png"), rgb_only=True)            # store / nguồn
    save(app_icon(1024), os.path.join(ASSETS, "icon-only.png"), rgb_only=True)            # @capacitor/assets (iOS không alpha)
    save(app_icon(512, radius=0.2237), os.path.join(ASSETS, "icon-512.png"))               # PWA purpose any
    save(app_icon(192, radius=0.2237), os.path.join(ASSETS, "icon-192.png"))
    save(app_icon(512, frac=0.56), os.path.join(ASSETS, "icon-maskable-512.png"))          # tràn viền, ≤ vùng an toàn 80 %
    save(app_icon(180, frac=0.62), os.path.join(ASSETS, "apple-touch-icon-180.png"), rgb_only=True)
    save(app_icon(1024, frac=0.46, bg="none"), os.path.join(ASSETS, "icon-foreground.png"))  # Android adaptive (vùng an toàn 66/108)
    save(teal_bg(1024), os.path.join(ASSETS, "icon-background.png"), rgb_only=True)
    f32 = app_icon(32, frac=0.80, radius=0.22, bold=True)
    f16 = app_icon(16, frac=0.86, radius=0.22, bold=True)
    f48 = app_icon(48, frac=0.76, radius=0.22, bold=True)
    save(f32, os.path.join(ASSETS, "favicon-32.png")); save(f16, os.path.join(ASSETS, "favicon-16.png"))
    f48.save(os.path.join(ASSETS, "favicon.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=[f16, f32])
    print("  wrote assets/favicon.ico (16/32/48)")
    save(shortcut("workout"), os.path.join(ASSETS, "shortcut-workout-96.png"))
    save(shortcut("meal"), os.path.join(ASSETS, "shortcut-meal-96.png"))
    # bản PNG của logo vector
    m = Image.new("RGBA", (512, 512), (0, 0, 0, 0)); draw_mark(m, 256, 256, 448, TEAL)
    save(m, os.path.join(BRAND, "logo-mark-512.png"))
    for name, tap in (("light", IVORY), ("dark", INK)):
        W = 1200; pad = 60; h = int(LOCK_H * (W - 2 * pad) / LOCK_W) + 2 * pad
        im = Image.new("RGBA", (W, h), (0, 0, 0, 0)); draw_lockup(im, W / 2, pad, W - 2 * pad, tap, TEAL)
        save(im, os.path.join(BRAND, "logo-lockup-%s-1200.png" % name))
    save(app_icon(1024, bg="dark"), os.path.join(BRAND, "icon-alt-dark-1024.png"), rgb_only=True)

def gen_splash():
    print("Splash:")
    S = 2732; LW = 860          # logo rộng 860 px ≈ 68 % bề ngang màn dọc sau khi cắt 19,5:9
    light = to_img(radial_glow(np.full((S, S, 3), rgb("#F7FBFA"), np.float32), S / 2, S / 2, S * 0.42, "#D9F4F1", 0.55))
    h = LOCK_H * LW / LOCK_W
    draw_lockup(light, S / 2, S / 2 - h / 2, LW, INK, TEAL)
    save(light, os.path.join(ASSETS, "splash.png"), rgb_only=True)
    arr = linear_gradient(S, S, ("#0B2A33", NAVY, "#04131B"), 180)
    arr = radial_glow(arr, S / 2, S / 2 - 40, S * 0.40, TEAL, 0.22)
    dark = to_img(arr)
    draw_lockup(dark, S / 2, S / 2 - h / 2, LW, IVORY, TEAL)
    save(dark, os.path.join(ASSETS, "splash-dark.png"), rgb_only=True)

def find_font(names):
    dirs = ["/usr/share/fonts", "/usr/local/share/fonts", os.path.expanduser("~/.fonts"), "C:/Windows/Fonts", "/Library/Fonts", "/System/Library/Fonts"]
    for n in names:
        for d in dirs:
            for root, _, files in os.walk(d) if os.path.isdir(d) else []:
                if n in files: return os.path.join(root, n)
    return None

def gen_og():
    print("OG image:")
    W, H = 1200, 630
    arr = linear_gradient(W, H, ("#0B2A33", NAVY, "#04131B"), 160)
    arr = radial_glow(arr, W * 0.5, H * 0.30, W * 0.55, TEAL, 0.22)
    arr = radial_glow(arr, W * 0.98, H * 1.05, W * 0.40, "#FF7A45", 0.12)
    img = to_img(arr)
    lw = 470; lh = draw_lockup(img, W / 2, 70, lw, IVORY, TEAL)
    bold = find_font(["Lato-Bold.ttf", "BeVietnamPro-Bold.ttf", "segoeuib.ttf", "DejaVuSans-Bold.ttf"])
    reg = find_font(["Lato-Regular.ttf", "BeVietnamPro-Regular.ttf", "segoeui.ttf", "DejaVuSans.ttf"])
    if bold and reg:
        d = ImageDraw.Draw(img)
        f1 = ImageFont.truetype(bold, 50); f2 = ImageFont.truetype(reg, 28)
        t1 = "Tập dễ dàng. Tiến bộ mỗi ngày."
        t2 = "Giáo án gym · Calo món Việt · Kết nối PT — miễn phí"
        y = 70 + lh + 46
        d.text((W / 2, y), t1, font=f1, fill=rgb(IVORY), anchor="mt")
        d.text((W / 2, y + 74), t2, font=f2, fill=rgb("#A3F0E8"), anchor="mt")
    else:
        print("  (không tìm thấy font có dấu tiếng Việt → OG chỉ có logo)")
    save(img, os.path.join(ASSETS, "og-tapeasy.jpg"), quality=88)

# ---------------------------------------------------------------- tách nền logo GỐC
def extract_original(src=SOURCE):
    if not os.path.exists(src):
        print("  (bỏ qua: chưa có", os.path.relpath(src, ROOT), ")"); return
    print("Logo gốc → nền trong suốt:")
    a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    H, W = a.shape[:2]
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, 0)
    mx, mn = a.max(-1), a.min(-1); sat = mx - mn
    def core(mask):
        m = Image.fromarray(mask.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(7))
        return np.median(a[np.asarray(m) > 127], 0)
    teal = core((sat > 60) & (a[..., 2] > a[..., 0] + 40))
    ink = core((mx < 120) & (sat < 40))
    print("  nền  RGB%s" % (tuple(int(round(v)) for v in bg),))
    print("  teal RGB%s  #%02X%02X%02X" % ((tuple(int(round(v)) for v in teal),) + tuple(int(round(v)) for v in teal)))
    print("  than RGB%s  #%02X%02X%02X" % ((tuple(int(round(v)) for v in ink),) + tuple(int(round(v)) for v in ink)))
    # vùng chữ than: điểm tối + ít bão hoà, mở hình thái (bỏ nhiễu JPEG) rồi nới 4 px
    core_ink = Image.fromarray((((mx < 140) & (sat < 45)) * 255).astype(np.uint8))
    core_ink = core_ink.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MaxFilter(9))
    ink_zone = np.asarray(core_ink) > 127
    # mỗi điểm ảnh = α·F + (1-α)·nền với F = than (trong vùng chữ than) hoặc teal
    F = np.where(ink_zone[..., None], ink, teal).astype(np.float32)
    dv = bg - F
    al = np.clip(((bg - a) * dv).sum(-1) / (dv * dv).sum(-1), 0, 1)
    al[al < 0.05] = 0; al[al > 0.92] = 1
    color = np.where(ink_zone[..., None], rgb(INK), rgb(TEAL)).astype(np.uint8)
    ys, xs = np.nonzero(al > 0.08)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    pad = int(0.04 * (x1 - x0))
    box = (max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad))
    A = Image.fromarray((al * 255 + .5).astype(np.uint8)).crop(box); C = Image.fromarray(color, "RGB").crop(box)
    k = 1200 / A.width; size = (1200, int(round(A.height * k)))
    A2 = A.resize(size, Image.LANCZOS)
    A2 = A2.point(lambda v: max(0, min(255, int((v - 128) * 1.18 + 128))))   # làm gọn mép sau khi phóng
    out = C.resize(size, Image.NEAREST).convert("RGBA"); out.putalpha(A2)
    save(out, os.path.join(BRAND, "logo-full.png"))
    # cắt riêng biểu tượng: dải trống ngang đầu tiên giữa biểu tượng và chữ
    rows = (al[y0:y1, x0:x1] > 0.08).any(1)
    split = y0 + (y1 - y0) // 3; run = 0
    for i, filled in enumerate(rows):                 # dải trống ≥ 8 hàng (bỏ qua khe nhỏ trong biểu tượng)
        run = 0 if filled else run + 1
        if run >= 8: split = y0 + i - run + 1; break
    sub = al[y0:split, x0:x1]; yy, xx = np.nonzero(sub > 0.08)
    mb = (x0 + xx.min() - 8, y0 + yy.min() - 8, x0 + xx.max() + 9, y0 + yy.max() + 9)
    M = Image.fromarray((al * 255 + .5).astype(np.uint8)).crop(mb)
    mk = Image.new("RGBA", M.size, rgb(TEAL) + (0,)); mk.putalpha(M)
    save(mk, os.path.join(BRAND, "source", "mark-original.png"))

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="svg,icons,splash,og,original")
    which = set(ap.parse_args().only.split(","))
    if "svg" in which: gen_svg()
    if "original" in which: extract_original()
    if "icons" in which: gen_icons()
    if "splash" in which: gen_splash()
    if "og" in which: gen_og()

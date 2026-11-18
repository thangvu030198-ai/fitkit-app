#!/usr/bin/env python3
"""TapEasy — tách vùng nhóm cơ từ hình giải phẫu tô MÀU KHOÁ (Muse AI) cho bản đồ phục hồi cơ (recovery.js).

Vào : media/anatomy/raw/body-{m,f}-{front,back}.png  (scripts/ai_anatomy_prompts.json, nền đen, 6 màu khoá thuần)
Ra  : media/anatomy/body-*-shade.webp  — ảnh xám có kênh alpha (độ sáng = khối cơ, thớ cơ), nền trong suốt
      media/anatomy/body-*-label.png   — ảnh 8-bit: 0 = phần xám (đầu, tay, gối…), 1..6 = nhóm cơ theo màu khoá, 255 = nền
      media/anatomy/index.json          — danh sách + bảng nhãn → nhóm cơ, kích thước, % điểm ảnh từng nhóm (để duyệt)
      media/anatomy/_review/*.jpg       — gốc | nhãn | thử tô màu trạng thái (duyệt bằng mắt trước khi bật trong app)
Màu khoá (thứ tự nhãn 1..6): đỏ 0°, vàng 60°, xanh lá 120°, lục lam 180°, xanh dương 240°, tím hồng 300°.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "media/anatomy/raw"; OUT = ROOT / "media/anatomy"; REV = OUT / "_review"
HUES = [0, 60, 120, 180, 240, 300]
GROUPS = { "front": ["Ngực", "Vai", "Tay trước", "Bụng", "Đùi trước", "Bắp chân"],
           "back":  ["Lưng", "Vai", "Tay sau", "Mông", "Đùi sau", "Bắp chân"] }
H_OUT = 900
DEMO = { "Ngực": (255, 138, 91), "Lưng": (255, 200, 87), "Vai": (255, 138, 91), "Đùi trước": (255, 200, 87), "Mông": (94, 230, 199), "Đùi sau": (94, 230, 199) }

def hsv_img(im):
    """→ (hue độ 0–360, saturation 0–1, value 0–1) bằng PIL (chính xác, nhanh)"""
    a = np.asarray(im.convert("HSV")).astype(np.float32)
    return a[..., 0] * 360.0 / 255.0, a[..., 1] / 255.0, a[..., 2] / 255.0

def process(path):
    pid = path.stem; view = "front" if pid.endswith("front") else "back"
    im = Image.open(path).convert("RGB")
    # cắt sát hình người (bỏ viền đen thừa) rồi thu về chiều cao chuẩn
    _, s, v = hsv_img(im)
    body = v > 0.09
    ys, xs = np.where(body)
    if not len(ys): raise RuntimeError(f"{pid}: ảnh trống")
    pad = 12
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad), min(im.height, ys.max() + pad))
    im = im.crop(box); im = im.resize((max(1, round(im.width * H_OUT / im.height)), H_OUT), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    h, s, v = hsv_img(im)
    bg = v <= 0.09
    lab = np.zeros(v.shape, np.uint8)
    col = (s >= 0.42) & (v >= 0.22) & ~bg
    dist = np.stack([np.minimum(np.abs(h - x), 360 - np.abs(h - x)) for x in HUES], -1)
    k = dist.argmin(-1); ok = dist.min(-1) <= 28
    lab[col & ok] = (k[col & ok] + 1).astype(np.uint8)
    lab[bg] = 255
    # làm sạch nhãn: lọc mode loại hạt lẻ, giữ nền
    L = Image.fromarray(lab, "L").filter(ImageFilter.ModeFilter(7))
    lab = np.asarray(L).copy(); lab[bg] = 255
    if view == "back":
        # mông nhỡ (gluteus medius) đôi khi bị AI tô màu đùi sau: phần xanh dương nằm CAO hơn đáy mông → trả về Mông
        cy = np.where(lab == 4)[0]
        if len(cy) > 200:
            yc = int(np.percentile(cy, 75))
            blue = (lab == 5); blue[yc:, :] = False
            lab[blue] = 4
    # bóng sáng: chuẩn hoá V theo từng nhãn để màu khoá sáng/tối khác nhau không làm lệch khối
    shade = np.zeros(v.shape, np.float32)
    for kk in range(0, 7):
        m = lab == kk
        if m.sum() < 50: continue
        p95 = float(np.percentile(v[m], 95)) or 1.0
        shade[m] = np.clip(v[m] / p95, 0, 1) * 0.92
    alpha = np.clip((v - 0.06) / 0.08, 0, 1)
    alpha[lab == 255] = np.minimum(alpha[lab == 255], 0.0)
    g8 = (shade * 255).astype(np.uint8); a8 = (alpha * 255).astype(np.uint8)
    Image.merge("LA", (Image.fromarray(g8, "L"), Image.fromarray(a8, "L"))).convert("RGBA").save(OUT / f"{pid}-shade.webp", "WEBP", quality=88, method=6)
    Image.fromarray(lab, "L").save(OUT / f"{pid}-label.png", optimize=True)
    tot = int((lab != 255).sum()) or 1
    share = { GROUPS[view][i]: round(float((lab == i + 1).sum()) / tot * 100, 1) for i in range(6) }
    # bảng duyệt: gốc | nhãn | thử tô
    pal = np.array([[140, 140, 140], [255, 0, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255]], np.uint8)
    lv = np.where(lab[..., None] == 255, 0, pal[np.minimum(lab, 6)])
    demo = np.zeros(a.shape, np.float32)
    for kk in range(0, 7):
        m = lab == kk
        c = np.array((120, 135, 150) if kk == 0 else DEMO.get(GROUPS[view][kk - 1], (94, 230, 199)), np.float32) / 255
        demo[m] = c * (0.30 + 0.85 * shade[m][:, None])
    demo = (np.clip(demo, 0, 1) * alpha[..., None] * 255).astype(np.uint8)
    w = im.width; sheet = Image.new("RGB", (w * 3, H_OUT), (8, 14, 20))
    sheet.paste(im, (0, 0)); sheet.paste(Image.fromarray(lv.astype(np.uint8), "RGB"), (w, 0)); sheet.paste(Image.fromarray(demo, "RGB"), (w * 2, 0))
    sheet.thumbnail((1500, 1500)); sheet.save(REV / f"{pid}.jpg", quality=82)
    return { "id": pid, "view": view, "sex": pid.split("-")[1], "w": im.width, "h": H_OUT, "shade": f"{pid}-shade.webp", "label": f"{pid}-label.png",
             "groups": GROUPS[view], "share": share }

def main():
    REV.mkdir(parents=True, exist_ok=True)
    files = sorted(RAW.glob("body-*-*.png"))
    if not files: sys.exit("Không có ảnh gốc trong media/anatomy/raw")
    idx, bad = [], []
    for f in files:
        try:
            e = process(f); idx.append(e)
            miss = [g for g, p in e["share"].items() if p < 1.0]
            print(f"✓ {e['id']}: " + " · ".join(f"{g} {p}%" for g, p in e["share"].items()) + (f"  ⚠ thiếu: {', '.join(miss)}" if miss else ""))
            if miss: bad.append(e["id"])
        except Exception as ex:
            print(f"✗ {f.name}: {ex}"); bad.append(f.stem)
    (OUT / "index.json").write_text(json.dumps({ "version": 1, "hues": HUES, "items": idx, "warn": bad }, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()

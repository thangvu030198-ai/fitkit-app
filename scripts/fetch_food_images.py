#!/usr/bin/env python3
"""
FIT KIT — Ảnh món ăn / thực phẩm THẬT, đã TÁCH NỀN (PNG trong suốt → WebP).
Nguồn: Pixabay API (Pixabay Content License — miễn phí, dùng thương mại, không bắt buộc ghi nguồn;
Pixabay yêu cầu tải về server riêng thay vì hotlink → ảnh được lưu trong repo, phát qua jsDelivr).
Tách nền bằng rembg (mô hình U²-Net, mã nguồn mở MIT) chạy trên GitHub Actions.
Kết quả: media/food/<id>.webp (320px, nền trong suốt) + media/food/index.json + contact.jpg để duyệt nhanh.
Đổi ảnh: sửa từ khoá trong scripts/food_sources.json hoặc thêm "pick": {"<id>": <pixabay_id>}.
"""
import json, os, io, sys, urllib.request, urllib.parse
from PIL import Image
from rembg import remove, new_session

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "media", "food")
SRC = json.load(open(os.path.join(os.path.dirname(__file__), "food_sources.json"), encoding="utf-8"))
KEY = os.environ.get("PIXABAY_KEY") or "58526802-1bdd38af8d2196fe689410081"
UA = {"User-Agent": "FitKit-media-sync/1.0"}
FOODTAGS = ("food", "fruit", "vegetable", "meal", "dish", "eat", "healthy", "cook", "kitchen", "breakfast", "lunch", "dinner", "drink", "nut", "meat", "fish", "seafood", "bread", "rice", "noodle", "soup", "salad", "snack", "dessert", "diet", "nutrition", "protein", "organic", "fresh", "ingredient")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def search(q):
    u = "https://pixabay.com/api/?" + urllib.parse.urlencode({"key": KEY, "q": q, "image_type": "photo", "per_page": 30, "safesearch": "true", "category": "food"})
    hits = json.loads(get(u)).get("hits", [])
    if not hits:
        u = u.replace("&category=food", "")
        hits = json.loads(get(u)).get("hits", [])
    words = [w for w in q.lower().split() if len(w) > 2]
    def score(h):
        t = h.get("tags", "").lower()
        s = sum(3 for w in words if w in t) + (2 if any(k in t for k in FOODTAGS) else 0)
        s += 2 if any(k in t for k in ("isolated", "white background", "cutout")) else 0
        return s + min(h.get("likes", 0), 200) / 200
    hits.sort(key=score, reverse=True)
    return hits


def main():
    os.makedirs(OUT, exist_ok=True)
    session = new_session("isnet-general-use")
    idx_path = os.path.join(OUT, "index.json")
    old = {}
    if os.path.exists(idx_path):
        try: old = json.load(open(idx_path, encoding="utf-8"))
        except Exception: old = {}
    picks = SRC.get("pick", {})
    index, tiles = {}, []
    for group in ("foods", "recipes"):
        for fid, q in SRC[group].items():
            dst = os.path.join(OUT, fid + ".webp")
            try:
                if fid in old and old[fid].get("q") == q and old[fid].get("px") == picks.get(fid, old[fid].get("px")) and os.path.exists(dst):
                    index[fid] = old[fid]; tiles.append(dst); continue
                hits = search(q)
                if fid in picks:
                    hits = [h for h in hits if h["id"] == picks[fid]] or json.loads(get(f"https://pixabay.com/api/?key={KEY}&id={picks[fid]}"))["hits"]
                if not hits:
                    print("  - không có ảnh:", fid, q); continue
                h = hits[0]
                raw = get(h["webformatURL"])
                cut = remove(raw, session=session)
                im = Image.open(io.BytesIO(cut)).convert("RGBA")
                bbox = im.getchannel("A").point(lambda a: 255 if a > 20 else 0).getbbox()
                if bbox: im = im.crop(bbox)
                im.thumbnail((360, 360))
                im.save(dst, "WEBP", quality=80, method=6)
                index[fid] = {"file": fid + ".webp", "q": q, "px": h["id"], "page": h["pageURL"], "user": h.get("user", ""), "group": group}
                tiles.append(dst)
                print("  ✓", fid, h["id"], h.get("tags", "")[:50])
            except Exception as e:
                print("  ✗", fid, e)
    json.dump(index, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # Bảng xem nhanh để duyệt ảnh
    n = len(tiles); cols = 10; rows = (n + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 120, max(1, rows) * 120), (240, 240, 240))
    for i, t in enumerate(tiles):
        im = Image.open(t).convert("RGBA"); im.thumbnail((110, 110))
        bg = Image.new("RGBA", (120, 120), (255, 255, 255, 255)); bg.alpha_composite(im, ((120 - im.width) // 2, (120 - im.height) // 2))
        sheet.paste(bg.convert("RGB"), ((i % cols) * 120, (i // cols) * 120))
    sheet.save(os.path.join(OUT, "contact.jpg"), quality=80)
    print("Xong:", len(index), "ảnh")


if __name__ == "__main__":
    main()

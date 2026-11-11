#!/usr/bin/env python3
"""
FIT KIT — Ảnh món ăn / thực phẩm THẬT, đã TÁCH NỀN (PNG trong suốt → WebP).
Nguồn: Pixabay API (Pixabay Content License — miễn phí, dùng thương mại, không bắt buộc ghi nguồn;
Pixabay yêu cầu tải về server riêng thay vì hotlink → ảnh được lưu trong repo, phát qua jsDelivr).
Tách nền bằng rembg (mô hình U²-Net, mã nguồn mở MIT) chạy trên GitHub Actions.
Kết quả: media/food/<id>.webp (320px, nền trong suốt) + media/food/index.json + contact.jpg để duyệt nhanh.
Đổi ảnh: sửa từ khoá trong scripts/food_sources.json hoặc thêm "pick": {"<id>": <pixabay_id>}.
Món chay / thuần chay: liệt kê id trong "veg" → loại mọi ảnh có tag thịt/cá/trứng (QN-13).

KHOÁ API (QN-13 / bảo mật): KHÔNG viết khoá vào mã. Đặt secret `PIXABAY_KEY` trong
GitHub → Settings → Secrets and variables → Actions, và truyền vào bước chạy script:
    env: { PIXABAY_KEY: ${{ secrets.PIXABAY_KEY }} }
Khoá cũ từng nằm trong mã (đã lộ trên repo công khai) → hãy THU HỒI và tạo khoá mới tại pixabay.com/api/docs.
"""
import json, os, io, sys, urllib.request, urllib.parse

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "media", "food")
SRC = json.load(open(os.path.join(os.path.dirname(__file__), "food_sources.json"), encoding="utf-8"))
KEY = os.environ.get("PIXABAY_KEY", "").strip()
UA = {"User-Agent": "FitKit-media-sync/1.0"}
FOODTAGS = ("food", "fruit", "vegetable", "meal", "dish", "eat", "healthy", "cook", "kitchen", "breakfast", "lunch", "dinner", "drink", "nut", "meat", "fish", "seafood", "bread", "rice", "noodle", "soup", "salad", "snack", "dessert", "diet", "nutrition", "protein", "organic", "fresh", "ingredient")
# QN-13: ảnh lạc đề hay gặp khi chọn tự động (cà phê thay đậu đen/whey, rác thải thay bia, người trong ảnh, trứng Phục sinh…)
BADTAGS = ("coffee", "trash", "pollution", "garbage", "waste", "easter", "girl", "woman", "boy", "people", "person", "portrait", "hand", "eye", "raw fish", "sashimi")
# QN-13: món chay / thuần chay không được dùng ảnh có thịt, cá, trứng, hải sản
MEATTAGS = ("meat", "bacon", "pork", "rib", "chicken", "beef", "steak", "ham", "sausage", "fish", "salmon", "tuna", "shrimp", "prawn", "clam", "seafood", "sushi", "egg")
VEG = set(SRC.get("veg", []))


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def score_hit(h, words, veg=False):
    """Điểm 1 ảnh Pixabay: khớp từ khoá + là đồ ăn + nền trơn; trừ nặng ảnh lạc đề / ảnh có thịt cho món chay (QN-13)."""
    t = h.get("tags", "").lower()
    s = sum(3 for w in words if w in t) + (2 if any(k in t for k in FOODTAGS) else 0)
    s += 2 if any(k in t for k in ("isolated", "white background", "cutout")) else 0
    s -= 6 * sum(1 for k in BADTAGS if k in t)
    if veg and any(k in t for k in MEATTAGS):
        s -= 100
    return s + min(h.get("likes", 0), 200) / 200


def search(q, veg=False):
    u = "https://pixabay.com/api/?" + urllib.parse.urlencode({"key": KEY, "q": q, "image_type": "photo", "per_page": 30, "safesearch": "true", "category": "food"})
    hits = json.loads(get(u)).get("hits", [])
    if not hits:
        u = u.replace("&category=food", "")
        hits = json.loads(get(u)).get("hits", [])
    words = [w for w in q.lower().split() if len(w) > 2]
    hits.sort(key=lambda h: score_hit(h, words, veg), reverse=True)
    if veg:   # món chay: thà không có ảnh (hiện emoji) còn hơn ảnh có thịt/cá/trứng
        hits = [h for h in hits if not any(k in h.get("tags", "").lower() for k in MEATTAGS)]
    return hits


def main():
    if not KEY:
        sys.exit("Thiếu biến môi trường PIXABAY_KEY — đặt secret PIXABAY_KEY trong GitHub Actions (xem đầu file). Không chạy.")
    from PIL import Image
    from rembg import remove, new_session
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
                hits = search(q, fid in VEG)
                if fid in picks:   # ảnh chọn tay (đã duyệt) luôn thắng
                    hits = [h for h in hits if h["id"] == picks[fid]] or json.loads(get("https://pixabay.com/api/?" + urllib.parse.urlencode({"key": KEY, "id": picks[fid]})))["hits"]
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

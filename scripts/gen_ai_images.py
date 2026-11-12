#!/usr/bin/env python3
"""TapEasy — tạo ảnh bằng API ảnh (OpenAI-compatible) theo 1 manifest JSON bất kỳ (bản tổng quát của gen_ai_food_images.py).

Chạy trong GitHub Actions (vd media-people-ai.yml). KHOÁ API KHÔNG BAO GIỜ nằm trong mã:
  IMG_API_KEY   (bắt buộc, secret)          IMG_API_BASE  (vd https://apivn.vn/v1)
  IMG_MODEL     (vd gpt-image-2.5)          IMG_MODE      auto | images | chat
  IMG_MANIFEST  đường dẫn manifest (mặc định scripts/ai_people_prompts.json)
  IMG_OUTDIR    thư mục ra (mặc định media/people-ai)
  IMG_SIZE      khung mặc định khi mục không ghi "size" (1024x1024)
  IMG_QUALITY   low|medium|high|auto ("" = không gửi)
  IMG_IDS       danh sách id cách nhau dấu phẩy (rỗng = tất cả)
  IMG_LIMIT     số ảnh tối đa lần này (rỗng/0 = không giới hạn)
  IMG_FORCE     1 = tạo lại cả ảnh đã có      IMG_WORKERS  số luồng song song (mặc định 3)
  IMG_GROUPS    lọc theo trường "group" (cách nhau dấu phẩy)

Manifest: danh sách (hoặc {"items":[...]}) các mục
  { id, name, size:"1024x1536"|"1536x1024"|"1024x1024", cutout:false, prompt, must_have, must_not, ... }
  cutout:true  → tách nền, ảnh vuông 512 px nền trong suốt (giống ảnh món ăn)
  cutout:false → giữ nguyên khung, lưu WebP q82 ở 2 cỡ: <id>.webp (cạnh dài 1280) + <id>-sm.webp (cạnh dài 480)
Đầu ra: <OUTDIR>/<id>.webp, <OUTDIR>/index.json, <OUTDIR>/_review/contact-XX.jpg (bảng duyệt), <OUTDIR>/_review/log.json
Ảnh đã có và prompt + khung không đổi (hash) thì bỏ qua (trừ khi IMG_FORCE=1).
"""
import base64, concurrent.futures as cf, hashlib, io, json, os, re, sys, time, threading, datetime
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = Path(os.environ.get("IMG_MANIFEST", "") or "scripts/ai_people_prompts.json")
MANIFEST = MANIFEST if MANIFEST.is_absolute() else ROOT / MANIFEST
OUT = Path(os.environ.get("IMG_OUTDIR", "") or "media/people-ai")
OUT = OUT if OUT.is_absolute() else ROOT / OUT
REVIEW = OUT / "_review"

KEY = os.environ.get("IMG_API_KEY", "").strip()
BASE = (os.environ.get("IMG_API_BASE", "") or "https://api.openai.com/v1").strip().rstrip("/")
MODEL = (os.environ.get("IMG_MODEL", "") or "gpt-image-1").strip()
MODE = (os.environ.get("IMG_MODE", "") or "auto").strip().lower()
DEF_SIZE = (os.environ.get("IMG_SIZE", "") or "1024x1024").strip()
QUALITY = os.environ.get("IMG_QUALITY", "medium").strip()
IDS = [s.strip() for s in os.environ.get("IMG_IDS", "").split(",") if s.strip()]
GROUPS = [s.strip() for s in os.environ.get("IMG_GROUPS", "").split(",") if s.strip()]
LIMIT = int(os.environ.get("IMG_LIMIT", "0") or 0)
FORCE = os.environ.get("IMG_FORCE", "") in ("1", "true", "yes")
WORKERS = max(1, min(6, int(os.environ.get("IMG_WORKERS", "3") or 3)))
TIMEOUT = 300
SIZES_OK = {"1024x1024", "1024x1536", "1536x1024"}
BIG, SMALL, WEBP_Q = 1280, 480, 82

if not KEY:
    sys.exit("Thiếu IMG_API_KEY — đặt secret trong Settings → Secrets and variables → Actions.")
if not re.match(r"^(https://|http://127\.0\.0\.1[:/])", BASE):  # http chỉ cho máy chủ giả khi kiểm thử
    sys.exit("IMG_API_BASE phải bắt đầu bằng https://")
if not MANIFEST.exists():
    sys.exit(f"Không thấy manifest {MANIFEST}")
OUT.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)

HDR = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
lock = threading.Lock()
log = {"model": MODEL, "base": BASE, "manifest": str(MANIFEST.relative_to(ROOT)) if ROOT in MANIFEST.parents else MANIFEST.name,
       "started": datetime.datetime.utcnow().isoformat() + "Z", "items": {}}
mode_ok = {"value": None if MODE == "auto" else MODE}


def redact(s):
    return str(s).replace(KEY, "***") if KEY else str(s)


def size_of(it):
    s = str(it.get("size") or DEF_SIZE)
    return s if s in SIZES_OK else DEF_SIZE


def phash(it):
    return hashlib.sha1((it["prompt"] + "|" + size_of(it) + "|" + str(bool(it.get("cutout")))).encode("utf-8")).hexdigest()[:12]


# ---------------------------------------------------------------- gọi API
def _img_from_payload(obj):
    """Tìm ảnh trong JSON trả về: data[].b64_json | data[].url | chuỗi data:image | URL ảnh trong text."""
    if isinstance(obj, dict):
        if isinstance(obj.get("data"), list) and obj["data"]:
            d0 = obj["data"][0]
            if isinstance(d0, dict):
                if d0.get("b64_json"):
                    return ("b64", d0["b64_json"])
                if d0.get("url"):
                    return ("url", d0["url"])
        for k in ("b64_json", "image_base64", "image"):
            v = obj.get(k)
            if isinstance(v, str) and len(v) > 200:
                return ("b64", v.split(",", 1)[-1])
        ch = obj.get("choices")  # chat completions
        if isinstance(ch, list) and ch:
            msg = ch[0].get("message") or {}
            imgs = msg.get("images")
            if isinstance(imgs, list) and imgs:
                im = imgs[0]
                u = (im.get("image_url") or {}).get("url") if isinstance(im, dict) else None
                if u:
                    return ("b64", u.split(",", 1)[1]) if u.startswith("data:") else ("url", u)
            content = msg.get("content")
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        u = (part.get("image_url") or {}).get("url") if isinstance(part.get("image_url"), dict) else part.get("image_url")
                        if isinstance(u, str):
                            return ("b64", u.split(",", 1)[1]) if u.startswith("data:") else ("url", u)
                        if part.get("b64_json"):
                            return ("b64", part["b64_json"])
                content = " ".join(p.get("text", "") for p in content if isinstance(p, dict))
            if isinstance(content, str):
                m = re.search(r"data:image/[a-z]+;base64,([A-Za-z0-9+/=]+)", content)
                if m:
                    return ("b64", m.group(1))
                m = re.search(r"(https?://[^\s)\"'>]+)", content)
                if m:
                    return ("url", m.group(1))
    return None


def _fetch_bytes(kind, val):
    if kind == "b64":
        return base64.b64decode(val)
    r = requests.get(val, timeout=TIMEOUT)
    r.raise_for_status()
    return r.content


def call_images(prompt, size, cutout, minimal=False):
    body = {"model": MODEL, "prompt": prompt, "n": 1, "size": size}
    if not minimal:
        if QUALITY:
            body["quality"] = QUALITY
        if cutout:
            body["background"] = "transparent"
        body["output_format"] = "png"
    return requests.post(f"{BASE}/images/generations", headers=HDR, json=body, timeout=TIMEOUT)


def call_chat(prompt, size):
    w, h = size.split("x")
    shape = "vertical portrait 2:3" if int(h) > int(w) else "horizontal landscape 3:2" if int(w) > int(h) else "square 1:1"
    body = {"model": MODEL, "messages": [{"role": "user", "content": f"Generate one image, {shape} ({size}). {prompt}"}]}
    return requests.post(f"{BASE}/chat/completions", headers=HDR, json=body, timeout=TIMEOUT)


def generate(it):
    """Trả bytes ảnh. Tự dò kiểu API: images (đủ tham số) → images (tối giản) → chat."""
    prompt, size, cutout = it["prompt"], size_of(it), bool(it.get("cutout"))
    tries = []
    order = [mode_ok["value"]] if mode_ok["value"] else ["images", "images-min", "chat"]
    if mode_ok["value"] == "images":
        order = ["images", "images-min"]
    last = None
    for attempt in range(4):
        for m in order:
            try:
                if m == "images":
                    r = call_images(prompt, size, cutout)
                elif m == "images-min":
                    r = call_images(prompt, size, cutout, minimal=True)
                else:
                    r = call_chat(prompt, size)
            except requests.RequestException as e:
                last = f"{m}: {redact(e)}"; tries.append(last); continue
            if r.status_code == 429 or r.status_code >= 500:
                last = f"{m}: HTTP {r.status_code} {redact(r.text[:300])}"; tries.append(last)
                time.sleep(min(60, 8 * (attempt + 1))); break  # thử lại vòng sau
            if r.status_code >= 400:
                last = f"{m}: HTTP {r.status_code} {redact(r.text[:300])}"; tries.append(last)
                continue  # thử kiểu gọi khác
            try:
                obj = r.json()
            except ValueError:
                last = f"{m}: không phải JSON: {redact(r.text[:200])}"; tries.append(last); continue
            got = _img_from_payload(obj)
            if not got:
                last = f"{m}: không thấy ảnh trong phản hồi: {redact(json.dumps(obj)[:300])}"; tries.append(last); continue
            data = _fetch_bytes(*got)
            with lock:
                if MODE == "auto" and mode_ok["value"] is None:
                    mode_ok["value"] = "images" if m.startswith("images") else "chat"
                    print(f"[api] dùng kiểu gọi: {m}")
            return data, m
        else:
            break
    raise RuntimeError(" | ".join(tries[-4:]) or str(last))


# ---------------------------------------------------------------- xử lý ảnh
_rembg_session = None


def remove_bg(im):
    """(cutout:true) Ảnh đã có nền trong suốt thì giữ; nếu không thì tách nền bằng rembg; dự phòng: xoá nền trắng nối biên."""
    im = im.convert("RGBA")
    if im.getchannel("A").getextrema()[0] < 250:
        return im
    global _rembg_session
    try:
        from rembg import remove, new_session
        with lock:
            if _rembg_session is None:
                _rembg_session = new_session("isnet-general-use")
        return remove(im, session=_rembg_session).convert("RGBA")
    except Exception as e:
        print("  rembg lỗi, dùng xoá nền trắng:", redact(e))
        import numpy as np
        from collections import deque
        a = np.array(im)
        h, w = a.shape[:2]
        rgb = a[..., :3].astype(int)
        white = (rgb.min(axis=2) > 232) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 18)
        seen = np.zeros((h, w), bool)
        q = deque([(y, x) for y in (0, h - 1) for x in range(w)] + [(y, x) for x in (0, w - 1) for y in range(h)])
        while q:
            y, x = q.popleft()
            if seen[y, x] or not white[y, x]:
                continue
            seen[y, x] = True
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and not seen[yy, xx]:
                    q.append((yy, xx))
        a[..., 3] = np.where(seen, 0, 255)
        return Image.fromarray(a, "RGBA")


def finish_cutout(im, size=512, pad=0.06):
    bbox = im.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    side = int(max(w, h) * (1 + pad * 2))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    return canvas.resize((size, size), Image.LANCZOS)


def fit_long(im, long_side):
    w, h = im.size
    k = long_side / max(w, h)
    return im if k >= 1 else im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)


def save_photo(im, it):
    """cutout:false → 2 cỡ WebP q82 (giữ khung)."""
    im = im.convert("RGB")
    big, sm = fit_long(im, BIG), fit_long(im, SMALL)
    fn, fs = f"{it['id']}.webp", f"{it['id']}-sm.webp"
    big.save(OUT / fn, "WEBP", quality=WEBP_Q, method=6)
    sm.save(OUT / fs, "WEBP", quality=WEBP_Q, method=6)
    return {"file": fn, "sm": fs, "w": big.size[0], "h": big.size[1]}


# ---------------------------------------------------------------- bảng duyệt
def contact_sheets(items, index):
    done = [it for it in items if it["id"] in index]
    if not done:
        return []
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    cell, cols, rows = 240, 6, 5
    sheets = []
    for s in range(0, len(done), cols * rows):
        chunk = done[s:s + cols * rows]
        sheet = Image.new("RGB", (cols * cell, ((len(chunk) - 1) // cols + 1) * (cell + 40)), (22, 30, 40))
        dr = ImageDraw.Draw(sheet)
        for i, it in enumerate(chunk):
            x, y = (i % cols) * cell, (i // cols) * (cell + 40)
            try:
                e = index[it["id"]]
                im = Image.open(OUT / (e.get("sm") or e["file"])).convert("RGBA")
                im.thumbnail((cell - 16, cell - 16))
                bg = Image.new("RGBA", im.size, (255, 255, 255, 255)); bg.alpha_composite(im)
                sheet.paste(bg.convert("RGB"), (x + (cell - im.size[0]) // 2, y + 8 + (cell - 16 - im.size[1]) // 2))
            except Exception:
                pass
            dr.text((x + 8, y + cell - 2), f"{s + i + 1}. {it['id']}"[:32], fill=(230, 240, 245), font=font)
            dr.text((x + 8, y + cell + 16), str(it.get("name", ""))[:32], fill=(150, 170, 185), font=font)
        p = REVIEW / f"contact-{s // (cols * rows) + 1:02d}.jpg"
        sheet.save(p, quality=82)
        sheets.append(p.name)
    return sheets


# ---------------------------------------------------------------- main
def load_manifest():
    data = json.loads(MANIFEST.read_text("utf-8"))
    items = data.get("items", []) if isinstance(data, dict) else data
    ok = []
    for it in items:
        if not isinstance(it, dict) or not re.match(r"^[a-z0-9][a-z0-9-]{0,63}$", str(it.get("id", ""))) or not it.get("prompt"):
            print("  bỏ mục manifest không hợp lệ:", str(it)[:80]); continue
        ok.append(it)
    return ok


def main():
    items = load_manifest()
    index_p = OUT / "index.json"
    index = json.loads(index_p.read_text("utf-8")) if index_p.exists() else {}
    todo = []
    for it in items:
        if IDS and it["id"] not in IDS:
            continue
        if GROUPS and it.get("group") not in GROUPS:
            continue
        cur = index.get(it["id"])
        if cur and not FORCE and cur.get("ph") == phash(it) and (OUT / cur["file"]).exists():
            continue
        todo.append(it)
    if LIMIT:
        todo = todo[:LIMIT]
    print(f"Model {MODEL} @ {BASE} · manifest {MANIFEST.name} → {OUT.relative_to(ROOT) if ROOT in OUT.parents else OUT} · cần tạo {len(todo)} ảnh · {WORKERS} luồng")

    ok = fail = 0

    def work(it):
        t0 = time.time()
        data, used = generate(it)
        im = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
        if it.get("cutout"):
            fn = f"{it['id']}.webp"
            finish_cutout(remove_bg(im)).save(OUT / fn, "WEBP", quality=84, method=6)
            entry = {"file": fn}
        else:
            entry = save_photo(im, it)
        entry.update({"src": "ai", "model": MODEL, "ph": phash(it), "size": size_of(it),
                      "at": datetime.date.today().isoformat(), "name": it.get("name")})
        return entry, used, round(time.time() - t0, 1)

    first, rest = todo[:1], todo[1:]  # ảnh đầu chạy riêng để dò kiểu API, sau đó song song
    for batch, workers in ((first, 1), (rest, WORKERS)):
        with cf.ThreadPoolExecutor(max_workers=workers) as ex:
            futs = {ex.submit(work, it): it for it in batch}
            for f in cf.as_completed(futs):
                it = futs[f]
                try:
                    entry, used, sec = f.result()
                    with lock:
                        index[it["id"]] = entry
                        log["items"][it["id"]] = {"ok": True, "via": used, "sec": sec}
                        index_p.write_text(json.dumps(index, ensure_ascii=False, indent=1), "utf-8")
                    ok += 1
                    print(f"  ✓ {it['id']} ({size_of(it)}, {used}, {sec}s)")
                except Exception as e:
                    fail += 1
                    with lock:
                        log["items"][it["id"]] = {"ok": False, "error": redact(e)[:600]}
                    print(f"  ✗ {it['id']}: {redact(e)[:300]}")
        if batch is first and first and fail:
            print("Ảnh đầu tiên lỗi — dừng để kiểm tra cấu hình API (xem log.json).")
            break

    log["finished"] = datetime.datetime.utcnow().isoformat() + "Z"
    log["ok"], log["fail"] = ok, fail
    log["sheets"] = contact_sheets(items, index)
    (REVIEW / "log.json").write_text(json.dumps(log, ensure_ascii=False, indent=1), "utf-8")
    print(f"Xong: {ok} ảnh mới, {fail} lỗi, tổng {len(index)} ảnh. Bảng duyệt: {log['sheets']}")
    if ok == 0 and fail:
        sys.exit(1)


if __name__ == "__main__":
    main()

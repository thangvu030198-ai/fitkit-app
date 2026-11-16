#!/usr/bin/env python3
"""TapEasy — sinh ẢNH hoặc VIDEO minh hoạ bài tập qua API KVAPI/Muse (bất đồng bộ: POST → hỏi lại theo id → tải file).

Chạy trong GitHub Actions (.github/workflows/media-muse.yml). KHOÁ API KHÔNG BAO GIỜ nằm trong mã / log:
  MUSE_API_KEY   (bắt buộc, secret)      MUSE_API_BASE (mặc định https://muse.careflow-demo.online)
  MUSE_KIND      image | video           MUSE_MANIFEST (mặc định scripts/ai_exercise_prompts.json)
  MUSE_IDS       id cách nhau dấu phẩy (rỗng = tất cả)    MUSE_LIMIT  tối đa số mục lần này (0 = không giới hạn)
  MUSE_FORCE     1 = làm lại cả mục đã có               MUSE_WORKERS số job song song (mặc định 3)
  MUSE_DURATION  10 | 20 (giây, chỉ video)              MUSE_RATIO  ảnh: 1:1 (mặc định) · video: 9:16 (mặc định)
Đầu ra:
  ảnh  → media/exercise-ai/<id>.webp (1024) + <id>-sm.webp (480) + index.json + _review/contact-XX.jpg
  video→ media/exercise-ai-video/<id>.mp4 (540p H.264, không tiếng, ≤ 3 MB) + <id>.jpg (poster) + index.json + _review/contact-XX.jpg
Mục đã có và prompt không đổi (hash) thì bỏ qua — chạy lại không tốn lượt. Link của nhà cung cấp hết hạn sau ~36 giờ nên file được tải về repo ngay.
"""
import concurrent.futures as cf, hashlib, io, json, os, re, subprocess, sys, tempfile, threading, time, datetime
from pathlib import Path

import requests
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
KEY = os.environ.get("MUSE_API_KEY", "").strip()
BASE = (os.environ.get("MUSE_API_BASE", "") or "https://muse.careflow-demo.online").strip().rstrip("/")
KIND = (os.environ.get("MUSE_KIND", "") or "image").strip().lower()
MANIFEST = ROOT / (os.environ.get("MUSE_MANIFEST", "") or "scripts/ai_exercise_prompts.json")
IDS = [s.strip() for s in os.environ.get("MUSE_IDS", "").split(",") if s.strip()]
if any(x.lower() in ("all", "*", "tatca") for x in IDS): IDS = []   # "all" = cả bộ (ô trống bị GitHub điền lại giá trị mặc định)
LIMIT = int(os.environ.get("MUSE_LIMIT", "0") or 0)
FORCE = os.environ.get("MUSE_FORCE", "") in ("1", "true", "yes")
WORKERS = max(1, min(6, int(os.environ.get("MUSE_WORKERS", "3") or 3)))
DURATION = int(os.environ.get("MUSE_DURATION", "10") or 10)
RATIO = (os.environ.get("MUSE_RATIO", "") or ("1:1" if KIND == "image" else "9:16")).strip()
OUT = ROOT / ("media/exercise-ai" if KIND == "image" else "media/exercise-ai-video")
REVIEW = OUT / "_review"
POLL, MAX_WAIT = 5, 300

if not KEY: sys.exit("Thiếu MUSE_API_KEY — thêm secret ở Settings → Secrets and variables → Actions.")
if not BASE.startswith("https://"): sys.exit("MUSE_API_BASE phải bắt đầu bằng https://")
if KIND not in ("image", "video"): sys.exit("MUSE_KIND phải là image hoặc video")
if KIND == "video" and DURATION not in (10, 20): sys.exit("MUSE_DURATION chỉ nhận 10 hoặc 20 (tiết kiệm lượt)")
OUT.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)
H = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
lock = threading.Lock()

VIDEO_MOTION = ("\n\nMOTION (video): the figure performs 2 slow, controlled, complete repetitions of the exercise with full range of motion, "
  "smooth tempo (about 2 seconds down, 1 second up), the teal glow on the working muscles gently pulses brighter on each effort. "
  "Camera completely static, locked-off three-quarter view, no cuts, no zoom, no text overlays. Seamless start and end pose so the clip can loop.")

def safe(s): return re.sub(r"sk-[A-Za-z0-9]{8,}", "sk-***", str(s))[:400]
def h(item): return hashlib.sha256((KIND + "|" + RATIO + "|" + str(DURATION) + "|" + item["prompt"]).encode()).hexdigest()[:16]

def load_index():
    p = OUT / "index.json"
    try: return {x["id"]: x for x in json.loads(p.read_text())}
    except Exception: return {}

def submit(prompt):
    url = f"{BASE}/v1/{'images' if KIND == 'image' else 'videos'}"
    body = {"prompt": prompt[:5000], "aspect_ratio": RATIO}
    if KIND == "video": body["duration_seconds"] = DURATION
    for attempt in range(3):
        r = requests.post(url, headers=H, json=body, timeout=60)
        if r.status_code in (200, 201, 202): return r.json()["id"]
        if r.status_code == 402: raise RuntimeError("Hết lượt (402 insufficient balance)")
        if r.status_code in (401, 400): raise RuntimeError(f"HTTP {r.status_code}: {safe(r.text)}")
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Gửi job thất bại: HTTP {r.status_code} {safe(r.text)}")

def wait(job_id):
    url = f"{BASE}/v1/{'images' if KIND == 'image' else 'videos'}/{job_id}"
    t0 = time.time()
    while time.time() - t0 < MAX_WAIT:
        time.sleep(POLL)
        try: j = requests.get(url, headers=H, timeout=30).json()
        except Exception: continue
        if j.get("status") == "done" and j.get("url"): return j
        if j.get("status") == "failed": raise RuntimeError("failed: " + safe(j.get("error")))
    raise RuntimeError("quá thời gian chờ")

def download(u):
    r = requests.get(u, timeout=180); r.raise_for_status(); return r.content

def save_image(item, data):
    im = Image.open(io.BytesIO(data)).convert("RGB")
    big = im.copy(); big.thumbnail((1024, 1024)); big.save(OUT / f"{item['id']}.webp", "WEBP", quality=84, method=6)
    sm = im.copy(); sm.thumbnail((480, 480)); sm.save(OUT / f"{item['id']}-sm.webp", "WEBP", quality=80, method=6)
    return {"file": f"{item['id']}.webp", "small": f"{item['id']}-sm.webp", "w": big.width, "h": big.height}

def save_video(item, data):
    with tempfile.TemporaryDirectory() as td:
        src = Path(td) / "in.mp4"; src.write_bytes(data)
        dst = OUT / f"{item['id']}.mp4"; poster = OUT / f"{item['id']}.jpg"
        vf = "scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)',fps=30"
        for crf in (26, 30, 34):
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-an", "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
                            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dst)], check=True)
            if dst.stat().st_size <= 3_000_000: break
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "1", "-i", str(dst), "-frames:v", "1", "-q:v", "4", str(poster)], check=True)
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(dst)], capture_output=True, text=True).stdout.strip()
    return {"file": f"{item['id']}.mp4", "poster": f"{item['id']}.jpg", "duration": round(float(dur or 0), 1), "bytes": dst.stat().st_size}

def work(item):
    prompt = item["prompt"] + (VIDEO_MOTION if KIND == "video" else "")
    t0 = time.time()
    job_id = submit(prompt)
    j = wait(job_id)
    meta = (save_image if KIND == "image" else save_video)(item, download(j["url"]))
    meta.update({"id": item["id"], "name": item.get("name", ""), "group": item.get("group", ""), "hash": h(item), "provider": "KVAPI/Muse",
                 "kind": KIND, "ratio": RATIO, "created": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), "seconds": round(time.time() - t0)})
    return meta

def contact_sheet(index):
    items = [x for x in index.values() if (OUT / (x.get("small") or x.get("poster") or "")).exists()]
    items.sort(key=lambda x: x["id"])
    for n in range(0, len(items), 20):
        part = items[n:n + 20]; cols, cw = 5, 300; ch = cw if KIND == "image" else int(cw * 16 / 9)
        sheet = Image.new("RGB", (cols * cw, ((len(part) + cols - 1) // cols) * (ch + 28)), (12, 18, 24))
        d = ImageDraw.Draw(sheet)
        for i, x in enumerate(part):
            im = Image.open(OUT / (x.get("small") or x.get("poster"))).convert("RGB"); im.thumbnail((cw, ch))
            px, py = (i % cols) * cw, (i // cols) * (ch + 28)
            sheet.paste(im, (px + (cw - im.width) // 2, py)); d.text((px + 6, py + ch + 6), x["id"][:40], fill=(200, 230, 228))
        sheet.save(REVIEW / f"contact-{n // 20 + 1:02d}.jpg", quality=82)

def main():
    data = json.loads(MANIFEST.read_text()); items = data["items"] if isinstance(data, dict) else data
    if IDS: items = [x for x in items if x["id"] in IDS]
    index = load_index()
    todo = [x for x in items if FORCE or index.get(x["id"], {}).get("hash") != h(x) or not (OUT / index.get(x["id"], {}).get("file", "_")).exists()]
    if LIMIT: todo = todo[:LIMIT]
    cost = len(todo) * (0.5 if KIND == "image" else DURATION / 10)
    print(f"Muse {KIND}: {len(todo)} mục cần tạo (bỏ qua {len(items) - len(todo)} đã có) · ước tính {cost:g} lượt · {BASE}")
    ok, fail = 0, []
    with cf.ThreadPoolExecutor(WORKERS) as ex:
        futs = {ex.submit(work, it): it for it in todo}
        for f in cf.as_completed(futs):
            it = futs[f]
            try:
                meta = f.result()
                with lock: index[it["id"]] = meta; (OUT / "index.json").write_text(json.dumps(sorted(index.values(), key=lambda x: x["id"]), ensure_ascii=False, indent=1))
                ok += 1; print(f"  ✓ {it['id']} ({meta['seconds']} s)")
            except Exception as e:
                fail.append((it["id"], safe(e))); print(f"  ✗ {it['id']}: {safe(e)}")
                if "402" in str(e): print("Hết lượt — dừng."); break
    contact_sheet(index)
    (REVIEW / "log.json").write_text(json.dumps({"at": datetime.datetime.utcnow().isoformat() + "Z", "kind": KIND, "ok": ok, "fail": fail}, ensure_ascii=False, indent=1))
    print(f"Xong: {ok} thành công, {len(fail)} lỗi.")
    if todo and not ok: sys.exit(1)

if __name__ == "__main__":
    main()

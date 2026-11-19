#!/usr/bin/env python3
"""TapEasy — bổ sung VIDEO 3D từ free-exercise-db-with-videos (harshvishu) cho động tác CHƯA có trong kho clip riêng.

Ưu tiên: media/ex3d/index.json đã có clip từ kho riêng (src="local") → động tác nào đã có (trùng slug / trùng tên / trùng id bài)
thì KHÔNG lấy nữa. Còn lại: tải video nam (không có thì nữ) + ảnh bìa, nén 640px (H.264, không tiếng), ghi thêm vào index (src="hv").
Chạy trong GitHub Actions (cần mạng + ffmpeg). Chạy lại nhiều lần được: bỏ qua mục đã có.
Biến môi trường: EX3D_LIMIT (mặc định 400), EX3D_FORCE=1 (tải lại cả mục hv đã có).
"""
import json, os, re, subprocess, sys, tempfile, urllib.request, urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "media/ex3d"
IDX = OUT / "index.json"
SRC = "https://raw.githubusercontent.com/harshvishu/free-exercise-db-with-videos/main/data/exercises.json"
LIMIT = int(os.environ.get("EX3D_LIMIT", "400"))
FORCE = os.environ.get("EX3D_FORCE") == "1"
UA = {"User-Agent": "TapEasy-media-bot"}

STOP = {"the", "with", "on", "and", "a", "of", "exercise", "standing", "seated", "sitting", "lying", "laying", "one", "arm", "single",
        "two", "grip", "medium", "to", "v", "bar", "version"}
SYN = [(r"lever(age)?|sled|machine", "machine"), (r"dumbbells?", "dumbbell"), (r"barbells?", "barbell"), (r"cables?", "cable"),
       (r"ez[- ]?bar|ez[- ]?barbell", "ezbar"), (r"push[- ]?ups?", "pushup"), (r"pull[- ]?ups?|chin[- ]?ups?", "pullup"),
       (r"sit[- ]?ups?", "situp"), (r"pull ?downs?", "pulldown"), (r"flyes|flies|fly", "fly"), (r"curls", "curl"), (r"rows", "row"),
       (r"raises", "raise"), (r"squats", "squat"), (r"lunges", "lunge"), (r"triceps|tricep", "tricep"), (r"biceps|bicep", "bicep"),
       (r"extensions", "extension"), (r"presses", "press"), (r"deadlifts", "deadlift"), (r"dips", "dip"), (r"crunches", "crunch")]

def norm(name):
    s = " " + re.sub(r"[^a-z0-9 ]+", " ", str(name).lower().replace("_", " ").replace("-", " ")) + " "
    for pat, rep in SYN: s = re.sub(r"\b(" + pat + r")\b", rep, s)
    return " ".join(sorted(w for w in s.split() if w and w not in STOP))

def exdb_keys():
    keys = []
    for f in sorted(ROOT.glob("exdb-vi*.js")):
        keys += re.findall(r'^\s*"([^"]+)":\{n:', f.read_text(encoding="utf-8"), flags=re.M)
    return keys

def get(url, dest=None, timeout=90):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
    if dest: Path(dest).write_bytes(data)
    return data

def ff(*args):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    idx = json.loads(IDX.read_text(encoding="utf-8")) if IDX.exists() else []
    local = [e for e in idx if e.get("src") == "local"]
    have_hv = {e["slug"]: e for e in idx if e.get("src") == "hv"}
    covered_slug = {e["slug"] for e in local}
    covered_name = {norm(e["name"]) for e in local} | {norm(e["slug"]) for e in local}
    covered_ids = {i for e in local for i in e.get("ids", [])}
    keys = exdb_keys(); by_norm = {}
    for k in keys: by_norm.setdefault(norm(k), []).append(k)

    data = json.loads(get(SRC))
    if isinstance(data, dict): data = data.get("data") or data.get("exercises") or []
    print(f"Nguồn: {len(data)} bài · kho riêng: {len(local)} clip · exdb: {len(keys)} id")
    added, skipped, failed = 0, {"đã có (kho riêng)": 0, "không có video": 0}, []
    new_hv = {}
    for ex in data:
        vids = ex.get("videos") or {}
        url = vids.get("male") or vids.get("female")
        if not url: skipped["không có video"] += 1; continue
        slug = re.sub(r"[^a-z0-9-]+", "-", Path(urllib.parse.urlparse(url).path).stem.lower()).strip("-")
        names = [ex.get("name", "")] + list(ex.get("aliases") or [])
        n0 = norm(ex.get("name", slug))
        ids = sorted({k for nm in names for k in by_norm.get(norm(nm), [])})
        if slug in covered_slug or n0 in covered_name or (ids and set(ids) <= covered_ids):
            skipped["đã có (kho riêng)"] += 1; continue
        if slug in new_hv: continue
        if slug in have_hv and not FORCE and (OUT / f"{slug}.mp4").exists():
            new_hv[slug] = have_hv[slug]; continue
        if added >= LIMIT: break
        thumb_url = ((ex.get("thumbnails") or {}).get("male") or (ex.get("thumbnails") or {}).get("female") or "")
        try:
            with tempfile.TemporaryDirectory() as td:
                raw = Path(td) / "raw.mp4"; get(url, raw, timeout=180)
                ff("-i", str(raw), "-an", "-t", "15", "-vf", "scale=640:-2:flags=lanczos,fps=24", "-c:v", "libx264", "-preset", "slow",
                   "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / f"{slug}.mp4"))
                if thumb_url:
                    rawj = Path(td) / "t.jpg"; get(thumb_url, rawj)
                    ff("-i", str(rawj), "-vf", "scale=480:-2", "-q:v", "4", str(OUT / f"{slug}.jpg"))
                else:
                    ff("-ss", "2", "-i", str(OUT / f"{slug}.mp4"), "-frames:v", "1", "-vf", "scale=480:-2", "-q:v", "4", str(OUT / f"{slug}.jpg"))
            dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(OUT / f"{slug}.mp4")]).decode() or 0)
            eq = str(ex.get("equipment") or "").lower()
            eqk = "barbell" if "barbell" in eq else "dumbbell" if "dumbbell" in eq else "cable" if "cable" in eq else \
                  "smith" if "smith" in eq else "kettlebell" if "kettlebell" in eq else "machine" if re.search(r"machine|leverage|sled", eq) else ""
            new_hv[slug] = {"slug": slug, "file": f"{slug}.mp4", "thumb": f"{slug}.jpg", "name": str(ex.get("name", slug))[:80], "equip": eqk,
                            "ids": ids, "core": [], "src": "hv", "duration": round(dur), "source": "free-exercise-db-with-videos"}
            added += 1
            print(f"✓ {slug}  ids={ids}")
        except Exception as e:
            failed.append(slug); print(f"✗ {slug}: {e}")
            for ext in ("mp4", "jpg"):
                p = OUT / f"{slug}.{ext}"
                if p.exists() and slug not in have_hv: p.unlink()
    # dọn file hv cũ không còn dùng (vd động tác nay đã có trong kho riêng)
    for slug in set(have_hv) - set(new_hv):
        for ext in ("mp4", "jpg"):
            p = OUT / f"{slug}.{ext}"
            if p.exists(): p.unlink()
    final = local + sorted(new_hv.values(), key=lambda e: e["slug"])
    IDX.write_text(json.dumps(final, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"Xong: thêm {added}, tổng hv {len(new_hv)}, bỏ qua {skipped}, lỗi {len(failed)}")
    if failed and not added: sys.exit(1)

if __name__ == "__main__":
    main()

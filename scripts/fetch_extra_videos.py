#!/usr/bin/env python3
"""
FIT KIT — Video bổ sung cho các bài mà YMove / wger chưa có.
Danh sách chọn tay trong scripts/extra_sources.json, chỉ gồm nguồn dùng thương mại được:
  · Pexels  — Pexels License: miễn phí, dùng thương mại, được chỉnh sửa, không bắt buộc ghi nguồn
              (không bán lại bản gốc, không đưa lên kho ảnh/video khác).
  · Wikimedia Commons — CC BY / CC BY-SA / Public domain: ghi tác giả + giấy phép (lấy tự động từ API).
Mỗi video được cắt ≤20 giây, nén 540p H.264 không tiếng, tạo ảnh bìa, ghi media/extra/index.json.
"""
import json, os, subprocess, tempfile, urllib.request, urllib.parse, re, html

ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "media", "extra")
SRC = os.path.join(os.path.dirname(__file__), "extra_sources.json")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 FitKit-media-sync"}


def fetch(url, dst=None):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    if dst:
        open(dst, "wb").write(data)
    return data


def commons_meta(fname):
    q = urllib.parse.urlencode({"action": "query", "prop": "imageinfo", "iiprop": "url|extmetadata",
                                "titles": "File:" + fname, "format": "json"})
    j = json.loads(fetch("https://commons.wikimedia.org/w/api.php?" + q))
    p = next(iter(j["query"]["pages"].values()))
    ii = p["imageinfo"][0]
    m = ii["extmetadata"]
    clean = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()
    return {"url": ii["url"], "page": ii["descriptionurl"],
            "author": clean(m.get("Artist", {}).get("value")) or "Wikimedia Commons",
            "license": clean(m.get("LicenseShortName", {}).get("value")) or "",
            "licenseUrl": (m.get("LicenseUrl", {}) or {}).get("value", "")}


def encode(src, mp4, jpg):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-t", "20",
                    "-vf", "scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)',fps=30",
                    "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
                    "-an", "-movflags", "+faststart", mp4], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "2", "-i", mp4,
                    "-frames:v", "1", "-q:v", "4", jpg], check=True)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4],
                         capture_output=True, text=True).stdout.strip()
    return round(float(dur or 0))


def main():
    os.makedirs(OUT, exist_ok=True)
    idx_path = os.path.join(OUT, "index.json")
    old = {}
    if os.path.exists(idx_path):
        try: old = {x["key"]: x for x in json.load(open(idx_path, encoding="utf-8"))}
        except Exception: old = {}
    index, fails = [], []
    for s in json.load(open(SRC, encoding="utf-8")):
        key = s["key"]
        mp4, jpg = os.path.join(OUT, key + ".mp4"), os.path.join(OUT, key + ".jpg")
        srcid = str(s.get("pexels") or s.get("commons") or s.get("file"))
        try:
            if s.get("file"):   # clip tự quay / tạo bằng AI, đã đưa vào repo (media/extra-src/)
                meta = {"url": None, "page": s.get("page",""), "author": s.get("author","FIT KIT"), "license": s.get("license","Nội dung của FIT KIT"), "licenseUrl": ""}
            elif s.get("pexels"):
                meta = {"url": f"https://www.pexels.com/download/video/{s['pexels']}/", "page": s["page"],
                        "author": "Pexels", "license": "Pexels License", "licenseUrl": "https://www.pexels.com/license/"}
            else:
                meta = commons_meta(s["commons"])
            if old.get(key, {}).get("srcId") == srcid and os.path.exists(mp4):
                entry = old[key]
            else:
                with tempfile.NamedTemporaryFile(delete=False) as t: tmp = t.name
                if s.get("file"):
                    import shutil; shutil.copy(os.path.join(ROOT, s["file"]), tmp); print("  ⧉", key, s["file"])
                else:
                    print("  ↓", key, meta["url"]); fetch(meta["url"], tmp)
                dur = encode(tmp, mp4, jpg)
                os.unlink(tmp)
                entry = {"key": key, "name": s["name"], "alias": s.get("alias", []), "file": key + ".mp4", "thumb": key + ".jpg",
                         "duration": dur, "provider": s["provider"], "author": meta["author"], "license": meta["license"],
                         "licenseUrl": meta["licenseUrl"], "source": meta["page"], "srcId": srcid,
                         "modified": "Cắt ≤20 giây, nén 540p H.264, bỏ tiếng"}
            index.append(entry)
        except Exception as e:
            print("  ✗", key, e); fails.append(key)
    json.dump(index, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"Xong: {len(index)} video, lỗi: {fails}")


if __name__ == "__main__":
    main()

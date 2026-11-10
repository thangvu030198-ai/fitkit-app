#!/usr/bin/env python3
"""
FIT KIT — Lấy video bài tập miễn phí từ wger.de (CC-BY-SA 4.0) và nén lại cho điện thoại.

- Gọi API công khai https://wger.de/api/v2/video/ → chọn 1 video tốt nhất cho mỗi bài
  (ưu tiên H.264, dung lượng nhỏ).
- Tải về, nén thành MP4 H.264 cao 540px, không tiếng, ~1–3MB (file gốc 20–90MB, chuẩn HEVC
  mà nhiều điện thoại Android không phát được).
- Tạo ảnh bìa JPG và media/wger/index.json (tên bài, tác giả, giấy phép, link nguồn)
  để app hiển thị đúng điều kiện ghi nguồn của CC-BY-SA.

Chạy bằng GitHub Actions (workflow "Media — video wger"), cần ffmpeg.
CC-BY-SA 4.0 cho phép chỉnh sửa (nén lại) và dùng thương mại, miễn là ghi tên tác giả,
dẫn link giấy phép và bản chỉnh sửa giữ nguyên giấy phép CC-BY-SA.
"""
import json, os, subprocess, sys, urllib.request, tempfile

API = "https://wger.de/api/v2"
OUT = os.path.join(os.path.dirname(__file__), "..", "media", "wger")
LICENSES = {1: ("CC BY-SA 3.0", "https://creativecommons.org/licenses/by-sa/3.0/"),
            2: ("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
            3: ("CC0 1.0", "https://creativecommons.org/publicdomain/zero/1.0/"),
            4: ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/")}
UA = {"User-Agent": "FitKit-media-sync/1.0 (+https://github.com/thangvu030198-ai/fitkit-app)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def main():
    os.makedirs(OUT, exist_ok=True)
    old = {}
    idx_path = os.path.join(OUT, "index.json")
    if os.path.exists(idx_path):
        try:
            old = {str(x["ex"]): x for x in json.load(open(idx_path, encoding="utf-8"))}
        except Exception:
            old = {}

    vids = get(f"{API}/video/?format=json&limit=500")["results"]
    best = {}
    for v in vids:
        if v.get("license") not in LICENSES:
            continue   # chỉ nhận giấy phép cho phép dùng thương mại
        score = (0 if v.get("codec") == "h264" else 1000) + (v.get("size") or 0) / 1e6
        k = v["exercise"]
        if k not in best or score < best[k][0]:
            best[k] = (score, v)
    print(f"{len(vids)} video, {len(best)} bài có video dùng được")

    index = []
    for ex_id, (_, v) in sorted(best.items()):
        try:
            info = get(f"{API}/exerciseinfo/{ex_id}/?format=json")
        except Exception as e:
            print("  bỏ qua", ex_id, e); continue
        trs = info.get("translations") or []
        en = next((t for t in trs if t.get("language") == 2), trs[0] if trs else {})
        name = (en.get("name") or "").strip()
        if not name:
            continue
        lic_name, lic_url = LICENSES[v["license"]]
        file_mp4, file_jpg = f"{ex_id}.mp4", f"{ex_id}.jpg"
        dst_mp4, dst_jpg = os.path.join(OUT, file_mp4), os.path.join(OUT, file_jpg)
        same = old.get(str(ex_id), {}).get("srcUuid") == v["uuid"] and os.path.exists(dst_mp4)
        if not same:
            with tempfile.NamedTemporaryFile(suffix=".mov", delete=False) as tmp:
                src = tmp.name
            print(f"  ↓ {ex_id} {name} ({round((v.get('size') or 0)/1e6)}MB)")
            urllib.request.urlretrieve(v["video"], src)
            # 540p, H.264, không tiếng, bật faststart để phát ngay khi đang tải
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-t", "30",
                            "-vf", "scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)',fps=30",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-pix_fmt", "yuv420p",
                            "-an", "-movflags", "+faststart", dst_mp4], check=True)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", dst_mp4,
                            "-frames:v", "1", "-q:v", "4", dst_jpg], check=True)
            os.remove(src)
        cats = info.get("category") or {}
        index.append({
            "ex": ex_id, "name": name, "category": cats.get("name", ""),
            "file": file_mp4, "thumb": file_jpg, "duration": round(float(v.get("duration") or 0)),
            "author": v.get("license_author") or "wger.de contributors",
            "license": lic_name, "licenseUrl": lic_url,
            "source": f"https://wger.de/exercise/{ex_id}/view-base/",
            "srcUuid": v["uuid"], "modified": "Nén lại 540p H.264, bỏ tiếng",
        })

    keep = {x["file"] for x in index} | {x["thumb"] for x in index} | {"index.json", "README.md"}
    for f in os.listdir(OUT):
        if f not in keep:
            os.remove(os.path.join(OUT, f))
    json.dump(index, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    open(os.path.join(OUT, "README.md"), "w", encoding="utf-8").write(
        "# Video bài tập từ wger.de\n\nCác video trong thư mục này lấy từ https://wger.de "
        "(dự án mã nguồn mở), giấy phép **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/).\n"
        "Tác giả của từng video ghi trong `index.json`. FIT KIT đã nén lại (540p, H.264, bỏ tiếng); "
        "các bản nén này cũng được phát hành theo CC BY-SA 4.0.\n")
    print(f"Xong: {len(index)} video → media/wger/")


if __name__ == "__main__":
    sys.exit(main())

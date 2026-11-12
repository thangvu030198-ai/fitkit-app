#!/usr/bin/env python3
"""TapEasy intro — ảnh nền (ảnh AI người tập, đen trắng/teal khi dựng) + khung hình clip màn chào.

Nguồn theo thứ tự: thư mục --from-dir (đã tải sẵn) → media/ trong repo → GitHub Pages (cần mạng).
Ra: build/assets/bg/<id>.webp, build/assets/clip/f_0001.jpg… ; ghi khoá "bg" và "clip" vào build/manifest.json/.js

  python3 scripts/intro-video/fetch_assets.py
  python3 scripts/intro-video/fetch_assets.py --from-dir /tmp/dl
"""
import argparse, json, os, shutil, subprocess, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BUILD = os.path.join(HERE, "build")
PAGES = "https://thangvu030198-ai.github.io/fitkit-app/media/"
CLIP = "welcome/welcome-bw-720.mp4"


def get(rel, from_dir, dest):
    name = rel.split("/")[-1]
    for cand in ([os.path.join(from_dir, name)] if from_dir else []) + [os.path.join(REPO, "media", rel)]:
        if os.path.exists(cand):
            shutil.copyfile(cand, dest); return True
    try:
        req = urllib.request.Request(PAGES + rel, headers={"User-Agent": "TapEasyIntroBuilder/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f: f.write(r.read())
        return True
    except Exception as e:
        print("  thiếu", rel, e); return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-dir", default="")
    ap.add_argument("--clip-seconds", type=float, default=12)
    ap.add_argument("--clip-width", type=int, default=720)
    args = ap.parse_args()
    tl = json.load(open(os.path.join(HERE, "timeline.json"), encoding="utf-8"))
    os.makedirs(os.path.join(BUILD, "assets", "bg"), exist_ok=True)
    man_p = os.path.join(BUILD, "manifest.json")
    man = json.load(open(man_p, encoding="utf-8")) if os.path.exists(man_p) else {"scale": 3, "shots": {}}
    man["bg"] = {}
    for key in sorted({c.get("bg") for c in tl["chapters"] if str(c.get("bg", "")).startswith("people:")}):
        pid = key.split(":", 1)[1]
        dest = os.path.join(BUILD, "assets", "bg", pid + ".webp")
        if os.path.exists(dest) or get(f"people-ai/{pid}.webp", args.from_dir, dest):
            man["bg"][key] = f"assets/bg/{pid}.webp"
    # clip màn chào → khung JPEG (bộ dựng chọn khung theo t, không phát <video> để giữ tất định)
    clip_dir = os.path.join(BUILD, "assets", "clip"); os.makedirs(clip_dir, exist_ok=True)
    src = os.path.join(BUILD, "assets", "welcome.mp4")
    if os.path.exists(src) or get(CLIP, args.from_dir, src):
        for f in os.listdir(clip_dir): os.remove(os.path.join(clip_dir, f))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-t", str(args.clip_seconds), "-i", src, "-vf",
                        f"fps=30,scale={args.clip_width}:-2", "-q:v", "4", os.path.join(clip_dir, "f_%04d.jpg")], check=True)
        n = len([f for f in os.listdir(clip_dir) if f.endswith(".jpg")])
        man["clip"] = {"pattern": "assets/clip/f_%04d.jpg", "count": n, "fps": 30, "speed": 1}
        print(f"clip: {n} khung")
    else:
        man["clip"] = None
    with open(man_p, "w", encoding="utf-8") as f: json.dump(man, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BUILD, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("window.__MANIFEST__=" + json.dumps(man, ensure_ascii=False) + ";\n")
    print("nền:", man["bg"])


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""TapEasy Shorts — ảnh nền người tập (AI, media/people-ai) + ảnh món (AI, media/food-ai) + QR cộng đồng Zalo.

Nguồn theo thứ tự: --from-dir → media/ trong repo → GitHub Pages của app (cần mạng; chỉ dùng khi dựng trên Actions).
Ra: build/assets/people/<id>.webp, build/assets/food/<id>.webp, build/assets/qr.jpg. Thiếu ảnh → bộ dựng vẽ nền thay thế (không lỗi).

  python3 scripts/shorts/fetch_assets.py [--ids a,b] [--from-dir /tmp/dl]
"""
import argparse, json, os, shutil, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(HERE, "build", "assets")
PAGES = "https://thangvu030198-ai.github.io/fitkit-app/media/"
QR = os.path.join(HERE, "..", "intro-video", "assets", "zalo-community-qr.jpg")


def refs(series, ids):
    people, food = set(), set()
    def key(k):
        if isinstance(k, str) and k.startswith("people:"): people.add(k.split(":", 1)[1])
    for s in series["shorts"]:
        if ids and s["id"] not in ids: continue
        key(s.get("bg"))
        for b in s["beats"]:
            key(b.get("bg"))
            for v in (b["v"] if isinstance(b["v"], list) else [b["v"]]):
                key(v.get("src"))
                for side in ("a", "b"):
                    if isinstance(v.get(side), dict): key(v[side].get("img"))
                if v.get("k") == "food": food.update(it["id"] for it in v["items"])
    return sorted(people), sorted(food)


def get(rel, from_dir, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 1000: return True
    for cand in ([os.path.join(from_dir, os.path.basename(rel))] if from_dir else []) + [os.path.join(REPO, "media", rel)]:
        if os.path.exists(cand): shutil.copyfile(cand, dest); return True
    try:
        req = urllib.request.Request(PAGES + rel, headers={"User-Agent": "TapEasyShortsBuilder/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f: f.write(r.read())
        return True
    except Exception as e:
        print(f"  thiếu {rel}: {type(e).__name__}"); return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="")
    ap.add_argument("--from-dir", default="")
    args = ap.parse_args()
    series = json.load(open(os.path.join(HERE, "series.json"), encoding="utf-8"))
    ids = [x for x in args.ids.split(",") if x]
    people, food = refs(series, ids)
    for d in ("people", "food"): os.makedirs(os.path.join(OUT, d), exist_ok=True)
    ok_p = sum(get(f"people-ai/{p}.webp", args.from_dir, os.path.join(OUT, "people", p + ".webp")) for p in people)
    ok_f = sum(get(f"food-ai/{f}.webp", args.from_dir, os.path.join(OUT, "food", f + ".webp")) for f in food)
    if os.path.exists(QR): shutil.copyfile(QR, os.path.join(OUT, "qr.jpg"))
    else: print("::error::thiếu QR cộng đồng Zalo (scripts/intro-video/assets/zalo-community-qr.jpg)"); return 1
    print(f"ảnh người {ok_p}/{len(people)} · ảnh món {ok_f}/{len(food)} · QR ✓ → {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

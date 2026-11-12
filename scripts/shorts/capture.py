#!/usr/bin/env python3
"""TapEasy Shorts — chụp màn app THẬT cho các short (Playwright, 390×844 @3x, vùng an toàn iPhone giả lập).

Dùng lại NGUYÊN bộ chụp của intro (scripts/intro-video/capture_app.py + director.js) mà không sửa file nào của intro:
  - nạp capture_app.py như module, trỏ BUILD → scripts/shorts/build/app, HERE → build/app/_dir
  - build/app/_dir/director.js = director.js của intro + shorts_director.js (shot bổ sung: sleep, progressInbody)
  - build/app/needs.json = độ cuộn cần cho từng shot (lấy từ series.json) → capture_app chụp các dải cuộn
  - --only = các shot mà series.json dùng (chuỗi shot vẫn chạy đủ để giữ trạng thái app)
Ra: build/app/shots/<id>/*.jpg + build/app/manifest.js/.json (+ build/app/qa/safe/report.txt). Lỗi vùng an toàn chỉ cảnh báo.

  python3 scripts/shorts/capture.py --url https://thangvu030198-ai.github.io/fitkit-app/ [--ids bmr-tdee,demo-ghi-set]
"""
import argparse, asyncio, importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
INTRO = os.path.join(HERE, "..", "intro-video")
APP = os.path.join(HERE, "build", "app")


def shots_needed(series, ids):
    need, scroll = [], {}
    for s in series["shorts"]:
        if ids and s["id"] not in ids: continue
        for b in s["beats"]:
            for v in (b["v"] if isinstance(b["v"], list) else [b["v"]]):
                if v.get("k") == "phone":
                    need.append(v["shot"])
                    if v.get("scroll"): scroll[v["shot"]] = max(scroll.get(v["shot"], 0), int(v["scroll"]))
                elif v.get("k") == "themes":
                    need += v["shots"]
    return list(dict.fromkeys(need)), scroll


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://thangvu030198-ai.github.io/fitkit-app/")
    ap.add_argument("--scale", default="3")
    ap.add_argument("--ids", default="")
    ap.add_argument("--list", action="store_true", help="chỉ in danh sách shot cần chụp")
    args = ap.parse_args()
    series = json.load(open(os.path.join(HERE, "series.json"), encoding="utf-8"))
    ids = [x for x in args.ids.split(",") if x]
    need, scroll = shots_needed(series, ids)
    print(f"{len(need)} shot app: {', '.join(need)}")
    print("cuộn:", scroll)
    if args.list: return 0
    os.makedirs(os.path.join(APP, "_dir"), exist_ok=True)
    with open(os.path.join(APP, "_dir", "director.js"), "w", encoding="utf-8") as f:
        f.write(open(os.path.join(INTRO, "director.js"), encoding="utf-8").read())
        f.write("\n;\n")
        f.write(open(os.path.join(HERE, "shorts_director.js"), encoding="utf-8").read())
    with open(os.path.join(APP, "needs.json"), "w") as f: json.dump(scroll, f)
    spec = importlib.util.spec_from_file_location("intro_capture_app", os.path.join(INTRO, "capture_app.py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    mod.BUILD = APP                                   # ảnh + manifest + QA vào thư mục shorts
    mod.HERE = os.path.join(APP, "_dir")              # director.js đã ghép
    sys.argv = ["capture_app.py", "--url", args.url, "--scale", args.scale, "--only", ",".join(need), "--safe-warn"]
    asyncio.run(mod.main())
    man = json.load(open(os.path.join(APP, "manifest.json"), encoding="utf-8"))
    miss = [s for s in need if s not in man.get("shots", {})]
    if miss: print("::warning::Thiếu shot app (bộ dựng sẽ vẽ màn chờ thay thế): " + ", ".join(miss))
    print(f"✓ {len(need) - len(miss)}/{len(need)} shot → {APP}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

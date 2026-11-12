#!/usr/bin/env python3
"""TapEasy Shorts — ghép hình + âm thanh, chuẩn hoá −14 LUFS (mạng xã hội) / đỉnh thật ≤ −1 dBTP, xuất bản.

Mỗi id: build/out/<id>.video.mp4 + build/audio/<id>.wav → <dest>/<id>.mp4 (H.264 high, yuv420p, AAC 192k, +faststart),
<dest>/<id>.jpg (ảnh bìa), <dest>/<id>.srt (phụ đề), build/out/<id>.meta.json.
--index: quét <dest>/*.mp4 + series.json → <dest>/index.json (tiêu đề, thời lượng, caption, hashtag, bìa…).

  python3 scripts/shorts/finalize.py --ids bmr-tdee --dest media/shorts
  python3 scripts/shorts/finalize.py --index --dest media/shorts
"""
import argparse, json, os, re, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BUILD = os.path.join(HERE, "build")


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode: raise SystemExit("lỗi: " + " ".join(cmd)[:200] + "\n" + p.stderr[-800:])
    return p


def probe_dur(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], capture_output=True, text=True)
    try: return float(p.stdout.strip())
    except Exception: return 0.0


def loud(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", p.stderr); TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", p.stderr)
    return (float(I[-1]) if I else None), (float(TP[-1]) if TP else None)


def finalize(sid, dest):
    P = json.load(open(os.path.join(BUILD, "plans", sid + ".json"), encoding="utf-8"))
    video = os.path.join(BUILD, "out", sid + ".video.mp4"); audio = os.path.join(BUILD, "audio", sid + ".wav")
    if not os.path.exists(video): raise SystemExit(f"thiếu {video} (chạy render.py)")
    if not os.path.exists(audio): subprocess.run([sys.executable, os.path.join(HERE, "audio.py"), "--ids", sid], check=True)
    raw = os.path.join(BUILD, "out", sid + ".mux.mp4")
    run(["ffmpeg", "-v", "error", "-y", "-i", video, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", f"{P['duration']:.3f}", raw])
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", raw, "-vn", "-af", "loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S)
    af = "loudnorm=I=-14:TP=-1.0:LRA=11"
    if m:
        lp = json.loads(m.group(0))
        af += (f":measured_I={lp['input_i']}:measured_TP={lp['input_tp']}:measured_LRA={lp['input_lra']}"
               f":measured_thresh={lp['input_thresh']}:offset={lp['target_offset']}:linear=true")
    os.makedirs(dest, exist_ok=True)
    out = os.path.join(dest, sid + ".mp4")
    run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
         "-movflags", "+faststart", "-metadata", f"title=TapEasy — {P['title']}", "-metadata", "comment=TapEasy Shorts", out])
    cover = os.path.join(BUILD, "out", sid + ".jpg")
    if os.path.exists(cover): shutil.copyfile(cover, os.path.join(dest, sid + ".jpg"))
    else: run(["ffmpeg", "-v", "error", "-y", "-ss", "1.2", "-i", out, "-frames:v", "1", "-q:v", "3", os.path.join(dest, sid + ".jpg")])
    shutil.copyfile(os.path.join(BUILD, "plans", sid + ".srt"), os.path.join(dest, sid + ".srt"))
    I, TP = loud(out)
    meta = {"id": sid, "duration": round(probe_dur(out), 2), "plan_duration": P["duration"], "mb": round(os.path.getsize(out) / 1e6, 2),
            "lufs": I, "true_peak": TP, "voice": P.get("voice", False), "tempo": P.get("tempo", 1)}
    json.dump(meta, open(os.path.join(BUILD, "out", sid + ".meta.json"), "w"), indent=1)
    print(f"✓ {os.path.relpath(out, REPO)} {meta['duration']}s · {meta['mb']} MB · {I} LUFS · đỉnh {TP} dBTP · giọng {'có' if meta['voice'] else 'KHÔNG'}")


def index(dest):
    series = json.load(open(os.path.join(HERE, "series.json"), encoding="utf-8"))
    items = []
    for s in series["shorts"]:
        mp4 = os.path.join(dest, s["id"] + ".mp4")
        if not os.path.exists(mp4): continue
        mp = os.path.join(BUILD, "out", s["id"] + ".meta.json")
        meta = json.load(open(mp)) if os.path.exists(mp) else {}
        items.append({"id": s["id"], "n": s["n"], "title": s["title"], "pillar": s.get("pillar", ""), "hook": " ".join(s["hook"]),
                      "cover_title": s["cover"], "caption": s["caption"], "hashtags": s["hashtags"],
                      "duration": meta.get("duration") or round(probe_dur(mp4), 2), "voice": meta.get("voice"),
                      "video": s["id"] + ".mp4", "cover": s["id"] + ".jpg", "srt": s["id"] + ".srt",
                      "mb": round(os.path.getsize(mp4) / 1e6, 2)})
    out = {"series": "TapEasy Shorts", "generated": time.strftime("%Y-%m-%d %H:%M"), "count": len(items), "format": "1080x1920 H.264 30fps, AAC -14 LUFS",
           "cta": "Tải miễn phí trong cộng đồng TapEasy (QR nhóm Zalo)", "items": items}
    with open(os.path.join(dest, "index.json"), "w", encoding="utf-8") as f: json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"index.json: {len(items)} short")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="")
    ap.add_argument("--dest", default=os.path.join(REPO, "media", "shorts"))
    ap.add_argument("--index", action="store_true")
    args = ap.parse_args()
    dest = os.path.abspath(args.dest)
    if args.index: index(dest); return 0
    ids = [x for x in args.ids.split(",") if x]
    for sid in ids: finalize(sid, dest)
    return 0


if __name__ == "__main__":
    sys.exit(main())

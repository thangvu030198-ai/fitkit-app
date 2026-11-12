#!/usr/bin/env python3
"""TapEasy intro — ghép đoạn hình + nhạc, chuẩn hoá âm lượng, poster.

- Nối build/out/<fmt>/chunks/chunk_*.mp4 (cùng thông số → -c copy)
- Ghép build/mix.wav (nhạc + giọng đọc đã hạ nhạc khi có lời — mix_audio.py) hoặc build/music.wav nếu chưa trộn/không có lời
  (AAC 192k), chuẩn hoá trên MP4 cuối: loudnorm 2 lượt → -14 LUFS, đỉnh thật ≤ -1 dBTP
- Poster JPG từ khung đẹp (mặc định: chương kết, sau CTA 1,2 s)
- Nếu file > --max-mb (mặc định 95 MB, giới hạn 100 MB của GitHub) → mã hoá lại CRF cao hơn

  python3 scripts/intro-video/finalize.py --fmt v --fmt h --dest media/intro
"""
import argparse, glob, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BUILD = os.path.join(HERE, "build")
NAME = {"v": "tapeasy-intro-1080x1920", "h": "tapeasy-intro-1920x1080"}


def run(cmd, **kw):
    print("$", " ".join(cmd)[:220], flush=True)
    return subprocess.run(cmd, check=True, **kw)


def loudnorm_params(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af",
                        "loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", p.stderr, re.S)
    return json.loads(m.group(0)) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fmt", action="append", default=[])
    ap.add_argument("--dest", default=os.path.join(REPO, "media", "intro"))
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--max-mb", type=float, default=95)
    ap.add_argument("--poster-at", type=float, default=-1)
    args = ap.parse_args()
    fmts = args.fmt or ["v", "h"]
    tl = json.load(open(os.path.join(BUILD, "timeline.resolved.json"), encoding="utf-8"))
    music = os.path.join(BUILD, "music.wav")
    if not os.path.exists(music):
        run([sys.executable, os.path.join(HERE, "music.py")])
    mix = os.path.join(BUILD, "mix.wav")              # mix_audio.py: nhạc + lời (ducking); cũ hơn music.wav = bỏ qua
    if os.path.exists(mix) and os.path.getmtime(mix) >= os.path.getmtime(music) - 1:
        print("âm thanh: build/mix.wav (nhạc + giọng đọc)"); music = mix
    else:
        print("âm thanh: build/music.wav (nhạc không lời)")
    os.makedirs(args.dest, exist_ok=True)
    poster_t = args.poster_at if args.poster_at >= 0 else (tl["chapters"][-1].get("cta_at", tl["duration"] - 4) + 1.6)
    for f in fmts:
        sub = f + ("-draft" if args.draft else "")
        chunks = sorted(glob.glob(os.path.join(BUILD, "out", sub, "chunks", "chunk_*.mp4")))
        if not chunks:
            print("không có đoạn nào cho", f); continue
        lst = os.path.join(BUILD, "out", sub, "list.txt")
        with open(lst, "w") as fh:
            for c in chunks: fh.write(f"file '{os.path.abspath(c)}'\n")
        video = os.path.join(BUILD, "out", sub, "video.mp4")
        run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video])
        name = NAME[f] + ("-draft" if args.draft else "")
        raw = os.path.join(BUILD, "out", sub, "mux.mp4")
        run(["ffmpeg", "-v", "error", "-y", "-i", video, "-i", music, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
             "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", raw])
        lp = loudnorm_params(raw)
        out = os.path.join(args.dest, name + ".mp4")
        af = "loudnorm=I=-14:TP=-1.0:LRA=11"
        if lp:
            af += (f":measured_I={lp['input_i']}:measured_TP={lp['input_tp']}:measured_LRA={lp['input_lra']}"
                   f":measured_thresh={lp['input_thresh']}:offset={lp['target_offset']}:linear=true")
        run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-c:v", "copy", "-af", af, "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
             "-movflags", "+faststart", "-metadata", "title=TapEasy — Tập đúng · Tiến bộ thật sự", out])
        mb = os.path.getsize(out) / 1e6
        if mb > args.max_mb:
            print(f"! {mb:.1f} MB > {args.max_mb} MB → mã hoá lại")
            tmp = out + ".re.mp4"
            run(["ffmpeg", "-v", "error", "-y", "-i", out, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-maxrate", "2400k",
                 "-bufsize", "6M", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                 "-c:a", "copy", "-movflags", "+faststart", tmp])
            os.replace(tmp, out); mb = os.path.getsize(out) / 1e6
        poster = os.path.join(args.dest, name + "-poster.jpg")
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{poster_t:.2f}", "-i", out, "-frames:v", "1", "-q:v", "3", poster])
        # đo lại
        chk = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", out, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"],
                             capture_output=True, text=True).stderr
        I = re.findall(r"I:\s+(-?[\d.]+) LUFS", chk); TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", chk)
        print(f"✓ {out}  {mb:.1f} MB  · {I[-1] if I else '?'} LUFS · đỉnh {TP[-1] if TP else '?'} dBTP")


if __name__ == "__main__":
    main()

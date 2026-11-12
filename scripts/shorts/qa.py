#!/usr/bin/env python3
"""TapEasy Shorts — QA (mã thoát 1 nếu có lỗi).

Kiểm từng short:
  1. thời lượng 15–45 s (MP4 thật qua ffprobe; --static: theo kế hoạch) và khớp kế hoạch ±0,35 s
  2. thẻ kết ≥ 2 s; hook hiện ngay đầu (≤ 1,5 s)
  3. chữ nằm trong vùng an toàn TikTok/Reels (không vào 220 px trên, 420 px dưới, 140 px phải, 60 px trái) — hộp chữ ĐO THẬT
     trong Chromium lúc dựng (build/qa/<id>/layout.json, render.py), kể cả ảnh bìa
  4. phụ đề ≤ 2 dòng, tiêu đề/phụ đề không tràn dòng
  5. không có 2 khối chữ chồng nhau
  6. tệp tồn tại & kích thước hợp lý: MP4 0,3–60 MB có hình + tiếng, bìa JPG ≥ 15 KB 1080×1920, SRT không rỗng;
     độ to −14 ± 1,5 LUFS, đỉnh ≤ −0,5 dBTP
Ra build/qa/report.txt + report.json.

  python3 scripts/shorts/qa.py --media media/shorts [--ids a,b]
  python3 scripts/shorts/qa.py --static          # chỉ kế hoạch (không cần video), dùng trong sandbox
"""
import argparse, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BUILD = os.path.join(HERE, "build")
W, H = 1080, 1920
SAFE = {"top": 220, "bottom": 420, "right": 140, "left": 60}


def ffprobe(path):
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,pix_fmt,r_frame_rate,codec_name,profile",
                        "-of", "json", path], capture_output=True, text=True)
    try: return json.loads(p.stdout)
    except Exception: return {}


def loud(path):
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    I = re.findall(r"I:\s+(-?[\d.]+) LUFS", p.stderr); TP = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", p.stderr)
    return (float(I[-1]) if I else None), (float(TP[-1]) if TP else None)


def inter(a, b):
    x = max(0, min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"]))
    y = max(0, min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"]))
    return x * y


def check_layout(sid, errs, warns):
    p = os.path.join(BUILD, "qa", sid, "layout.json")
    if not os.path.exists(p): errs.append("thiếu layout.json (render.py chưa đo bố cục)"); return 0
    L = json.load(open(p, encoding="utf-8"))
    n = 0
    for s in L["samples"]:
        tag = f"t={s['t']}"
        for c in s.get("capLines", []):
            if c > 2: errs.append(f"{tag}: phụ đề {c} dòng")
        items = s["items"]
        for it in items:
            n += 1
            x0, y0, x1, y1 = it["x"], it["y"], it["x"] + it["w"], it["y"] + it["h"]
            if x0 < SAFE["left"] - 1 or x1 > W - SAFE["right"] + 1 or y0 < SAFE["top"] - 1 or y1 > H - SAFE["bottom"] + 1:
                errs.append(f"{tag}: chữ ngoài vùng an toàn [{it['qa']}] “{it['text'][:30]}” {x0},{y0}–{x1},{y1}")
            if it.get("lines") == 99: errs.append(f"{tag}: chữ tràn dòng [{it['qa']}] “{it['text'][:30]}”")
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                if inter(a, b) > 6:
                    errs.append(f"{tag}: chữ chồng nhau [{a['qa']}] “{a['text'][:24]}” × [{b['qa']}] “{b['text'][:24]}”")
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--media", default=os.path.join(REPO, "media", "shorts"))
    ap.add_argument("--ids", default="")
    ap.add_argument("--static", action="store_true")
    args = ap.parse_args()
    series = json.load(open(os.path.join(HERE, "series.json"), encoding="utf-8"))
    ids = [x for x in args.ids.split(",") if x]
    if not ids:
        ids = [s["id"] for s in series["shorts"]] if args.static else [s["id"] for s in series["shorts"] if os.path.exists(os.path.join(args.media, s["id"] + ".mp4"))]
    if not ids: print("QA: không có short nào để kiểm"); return 1
    report, bad = [], 0
    for sid in ids:
        errs, warns = [], []
        pp = os.path.join(BUILD, "plans", sid + ".json")
        if not os.path.exists(pp): subprocess.run(["node", os.path.join(HERE, "prep.js"), "--ids", sid], check=True, capture_output=True)
        P = json.load(open(pp, encoding="utf-8"))
        S = next(s for s in series["shorts"] if s["id"] == sid)
        dur = P["duration"]
        endd = P["end"]["t1"] - P["end"]["t0"]
        if endd < 2: errs.append(f"thẻ kết {endd:.2f} s < 2 s")
        if not (P["beats"][0]["t0"] == 0 and P["hook"]["t_full"] <= 1.5 and P["beats"][0]["h"] == S["hook"]): errs.append("hook không hiện trọn trong 1,5 s đầu")
        if any(len(c["lines"]) > 2 for c in P["chunks"]): errs.append("có cụm phụ đề > 2 dòng (kế hoạch)")
        if not P.get("chunks"): errs.append("không có phụ đề chuyển động (karaoke)")
        if not args.static:
            # Yêu cầu chủ dự án: clip nào cũng có giọng đọc + chữ chuyển động
            if os.environ.get("SHORTS_REQUIRE_VOICE", "1") == "1" and not P.get("voice"): errs.append("THIẾU giọng đọc (bắt buộc)")
            mp4 = os.path.join(args.media, sid + ".mp4"); jpg = os.path.join(args.media, sid + ".jpg"); srt = os.path.join(args.media, sid + ".srt")
            if not os.path.exists(mp4): errs.append("thiếu MP4")
            else:
                info = ffprobe(mp4); dur = float((info.get("format") or {}).get("duration") or 0)
                st = info.get("streams") or []
                v = next((x for x in st if x.get("codec_type") == "video"), {}); a = next((x for x in st if x.get("codec_type") == "audio"), None)
                if (v.get("width"), v.get("height")) != (W, H): errs.append(f"kích thước {v.get('width')}×{v.get('height')}")
                if v.get("pix_fmt") != "yuv420p" or v.get("codec_name") != "h264": errs.append(f"mã hoá {v.get('codec_name')}/{v.get('pix_fmt')}")
                if v.get("r_frame_rate") not in ("30/1", "30000/1001"): warns.append(f"fps {v.get('r_frame_rate')}")
                if not a: errs.append("không có tiếng")
                if abs(dur - P["duration"]) > 0.35: errs.append(f"thời lượng MP4 {dur:.2f} ≠ kế hoạch {P['duration']:.2f}")
                mb = os.path.getsize(mp4) / 1e6
                if not (0.3 <= mb <= 60): errs.append(f"dung lượng {mb:.1f} MB bất thường")
                I, TP = loud(mp4)
                if I is None or abs(I + 14) > 1.5: errs.append(f"độ to {I} LUFS (cần −14 ± 1,5)")
                if TP is not None and TP > -0.5: errs.append(f"đỉnh {TP} dBTP > −0,5")
            if not os.path.exists(jpg) or os.path.getsize(jpg) < 15000: errs.append("thiếu/ảnh bìa quá nhỏ")
            else:
                try:
                    from PIL import Image
                    if Image.open(jpg).size != (W, H): errs.append("ảnh bìa không 1080×1920")
                except ImportError: pass
            if not os.path.exists(srt) or os.path.getsize(srt) < 20: errs.append("thiếu SRT")
            check_layout(sid, errs, warns)
        if not (15 <= dur <= 45): errs.append(f"thời lượng {dur:.2f} s ngoài 15–45 s")
        bad += 1 if errs else 0
        report.append({"id": sid, "ok": not errs, "duration": round(dur, 2), "end_card": round(endd, 2), "voice": P.get("voice"), "errors": errs[:40], "warnings": warns})
    lines = [f"QA TapEasy Shorts ({'kế hoạch' if args.static else 'video'}) — {len(ids) - bad}/{len(ids)} ĐẠT", ""]
    for r in report:
        lines.append(f"{'ĐẠT' if r['ok'] else 'LỖI'}  {r['id']:<20} {r['duration']:5.1f}s · kết {r['end_card']:.1f}s · giọng {'có' if r['voice'] else 'không'}")
        lines += [f"      ✗ {e}" for e in r["errors"]] + [f"      · {w}" for w in r["warnings"]]
    os.makedirs(os.path.join(BUILD, "qa"), exist_ok=True)
    with open(os.path.join(BUILD, "qa", "report.txt"), "w", encoding="utf-8") as f: f.write("\n".join(lines) + "\n")
    json.dump(report, open(os.path.join(BUILD, "qa", "report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n".join(lines))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

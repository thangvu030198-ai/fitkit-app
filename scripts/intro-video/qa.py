#!/usr/bin/env python3
"""TapEasy intro — QA trên video đã dựng.

1) Contact sheet: 1 khung 0,3 s sau mỗi mốc chương/shot (kèm thời điểm)
2) Dải 10 khung hai bên mỗi chuyển chương (soi nháy sáng 1 khung)
3) Quét độ sáng trung bình từng khung (signalstats YAVG) → báo bước nhảy > ngưỡng
4) Khung 0 không đen
5) Đoạn kết: mã QR nhóm Zalo giải mã được ở 5 thời điểm trong 5,2 s cuối (OpenCV, thử phóng ×1/×1,5/×2)
   và vùng QR đứng YÊN (chênh lệch trung bình giữa khung đầu/cuối < 2 mức) — ra qr_end.jpg

  python3 scripts/intro-video/qa.py media/intro/tapeasy-intro-1080x1920.mp4
"""
import json, os, subprocess, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")


def grab(video, t, w):
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, t):.3f}", "-i", video, "-frames:v", "1", "-vf", f"scale={w}:-2",
                        "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
    from io import BytesIO
    return Image.open(BytesIO(p.stdout)).convert("RGB") if p.stdout else Image.new("RGB", (w, w), (255, 0, 0))


def sheet(items, cols, path):
    w, h = items[0][1].size
    rows = (len(items) + cols - 1) // cols
    S = Image.new("RGB", (cols * (w + 4), rows * (h + 18)), (16, 16, 16)); d = ImageDraw.Draw(S)
    for k, (lab, im) in enumerate(items):
        x, y = (k % cols) * (w + 4), (k // cols) * (h + 18)
        S.paste(im, (x, y + 16)); d.text((x + 2, y + 2), lab, fill=(255, 210, 90))
    S.save(path, quality=85)


def qr_check(video, tl, out):
    try:
        import cv2, numpy as np
    except Exception:
        return ["QR: bỏ qua (thiếu opencv-python-headless)"]
    dur = tl["duration"]; det = cv2.QRCodeDetector(); res = []; boxes = []; frames = []
    for dt in (5.2, 4.0, 2.5, 1.0, 0.1):
        p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{dur - dt:.3f}", "-i", video, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
        im = cv2.imdecode(np.frombuffer(p.stdout, np.uint8), cv2.IMREAD_COLOR) if p.stdout else None
        if im is None: res.append((dt, "", None)); continue
        frames.append(im); val, pts = "", None
        for f in (1, 1.5, 2):
            x = im if f == 1 else cv2.resize(im, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC)
            v, pp, _ = det.detectAndDecode(x)
            if v: val, pts = v, (pp.reshape(-1, 2) / f if pp is not None else None); break
        res.append((dt, val, pts))
        if pts is not None: boxes.append(pts)
    ok = all(v for _, v, _ in res) and len({v for _, v, _ in res}) == 1
    lines = [f"QR cuối phim: {'ĐẠT' if ok else 'TRƯỢT'} — giải mã {sum(1 for _, v, _ in res if v)}/{len(res)} khung (−5,2…−0,1 s)"]
    if boxes and len(frames) >= 2:
        b = boxes[0]; x0, y0 = np.maximum(b.min(0).astype(int) - 10, 0); x1, y1 = b.max(0).astype(int) + 10
        a, z = frames[0][y0:y1, x0:x1].astype(float), frames[-1][y0:y1, x0:x1].astype(float)
        diff = float(np.abs(a - z).mean()); side = int(max(x1 - x0, y1 - y0))
        lines.append(f"QR đứng yên: chênh lệch TB {diff:.2f} ({'ĐẠT' if diff < 2 else 'TRƯỢT'}) · cạnh QR ≈ {side}px")
        cv2.imwrite(os.path.join(out, "qr_end.jpg"), frames[-1][y0:y1, x0:x1])
    return lines


def main():
    video = sys.argv[1]
    tag = os.path.splitext(os.path.basename(video))[0]
    out = os.path.join(BUILD, "qa", tag); os.makedirs(out, exist_ok=True)
    tl = json.load(open(os.path.join(BUILD, "timeline.resolved.json"), encoding="utf-8"))
    fps = tl["fps"]
    marks = []
    for c in tl["chapters"]:
        marks.append((c["t0"] + .3, f"{c['t0']:.1f}s {c['id']}"))
        for s in c["shots"][1:]: marks.append((s["t0"] + .3, f"{s['t0']:.1f}s {s['id']}"))
    vert = "1080x1920" in video or "1920" not in video
    w = 180 if vert else 300
    items = [(lab, grab(video, t, w)) for t, lab in marks if t < tl["duration"]]
    for k in range(0, len(items), 40):
        sheet(items[k:k + 40], 10 if vert else 6, os.path.join(out, f"contact_{k // 40 + 1}.jpg"))
    # dải quanh chuyển chương
    for c in tl["chapters"][:-1]:
        b = c["t1"]
        strip = [(f"{(b + (i - 10) / fps):.2f}", grab(video, b + (i - 10) / fps, 120 if vert else 200)) for i in range(0, 20, 2)]
        sheet(strip, 10, os.path.join(out, f"cut_{c['id']}_{b:.1f}.jpg"))
    # độ sáng từng khung
    p = subprocess.run(["ffprobe", "-v", "error", "-f", "lavfi", "-i", f"movie={video},signalstats", "-show_entries",
                        "frame_tags=lavfi.signalstats.YAVG", "-of", "csv=p=0"], capture_output=True, text=True)
    ys = [float(x) for x in p.stdout.split() if x.replace(".", "", 1).isdigit()]
    pops = [(i, ys[i - 1], ys[i], ys[i + 1]) for i in range(1, len(ys) - 1)
            if abs(ys[i] - ys[i - 1]) > 18 and abs(ys[i] - ys[i + 1]) > 18]        # lên rồi xuống ngay = nháy 1 khung
    lines = [f"video: {video}", f"khung: {len(ys)}", f"khung 0 YAVG={ys[0] if ys else '?'} ({'ĐẠT' if ys and ys[0] > 8 else 'ĐEN?'})",
             f"nháy 1 khung (>18 mức Y): {len(pops)}"] + [f"  khung {i} ({i / fps:.2f}s): {a:.0f}→{b:.0f}→{c:.0f}" for i, a, b, c in pops[:40]]
    lines += qr_check(video, tl, out)
    open(os.path.join(out, "report.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("\n".join(lines)); print("→", out)


if __name__ == "__main__":
    main()

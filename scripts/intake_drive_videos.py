#!/usr/bin/env python3
"""Tải video từ thư mục Google Drive (đã chia sẻ "bất kỳ ai có link"), nén nhẹ và tạo bảng khung hình để duyệt.
Kết quả: media/intake/<tên>.mp4 (540p, không tiếng), media/intake/sheet-N.jpg (mỗi dòng 1 video × 5 khung hình),
media/intake/index.json (tên, md5, thời lượng, kích thước, nhóm trùng)."""
import os, sys, json, hashlib, subprocess, glob
from PIL import Image, ImageDraw
SRC = "drive_in"; OUT = os.path.join(os.path.dirname(__file__), "..", "media", "intake")
os.makedirs(OUT, exist_ok=True)
files = sorted(glob.glob(os.path.join(SRC, "**", "*.mp4"), recursive=True) + glob.glob(os.path.join(SRC, "**", "*.mov"), recursive=True))
print(len(files), "video")
def probe(p):
    r = subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries","stream=width,height:format=duration","-of","json",p],capture_output=True,text=True)
    j = json.loads(r.stdout or "{}"); s = (j.get("streams") or [{}])[0]
    return float(j.get("format",{}).get("duration",0) or 0), s.get("width",0), s.get("height",0)
index, rows, by_md5 = [], [], {}
for p in files:
    name = os.path.splitext(os.path.basename(p))[0].replace(" ", "_").replace("(","").replace(")","")
    md5 = hashlib.md5(open(p,"rb").read()).hexdigest()
    dur, w, h = probe(p)
    dup_of = by_md5.get(md5)
    by_md5.setdefault(md5, name)
    item = {"name": name, "md5": md5, "duration": round(dur,1), "w": w, "h": h, "dup_of": dup_of, "size": os.path.getsize(p)}
    index.append(item)
    if dup_of: continue
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",p,"-t","20","-vf","scale='if(gt(iw,ih),-2,540)':'if(gt(iw,ih),540,-2)',fps=30","-c:v","libx264","-preset","veryfast","-crf","28","-pix_fmt","yuv420p","-an","-movflags","+faststart",os.path.join(OUT,name+".mp4")],check=True)
    frames = []
    for i, f in enumerate([0.08, 0.3, 0.5, 0.7, 0.92]):
        fp = f"/tmp/{name}_{i}.jpg"
        subprocess.run(["ffmpeg","-y","-loglevel","error","-ss",str(max(0.0,dur*f)),"-i",p,"-frames:v","1","-vf","scale=-2:260",fp])
        if os.path.exists(fp): frames.append(Image.open(fp).convert("RGB"))
    if frames: rows.append((name, dur, w, h, frames))
# Bảng khung hình: 8 video mỗi ảnh
for k in range(0, len(rows), 8):
    chunk = rows[k:k+8]
    W = 160 + max(sum(fr.width + 6 for fr in r[4]) for r in chunk)
    H = sum(r[4][0].height + 14 for r in chunk)
    sheet = Image.new("RGB", (W, H), (20, 20, 24)); d = ImageDraw.Draw(sheet); y = 0
    for name, dur, w, h, frs in chunk:
        d.text((6, y+6), name, fill=(255,255,255)); d.text((6, y+24), f"{dur:.1f}s {w}x{h}", fill=(180,180,180))
        x = 160
        for fr in frs: sheet.paste(fr, (x, y+7)); x += fr.width + 6
        y += frs[0].height + 14
    sheet.save(os.path.join(OUT, f"sheet-{k//8+1}.jpg"), quality=72)
json.dump(index, open(os.path.join(OUT,"index.json"),"w"), indent=1)
print("xong", len(rows), "video duy nhất,", sum(1 for x in index if x["dup_of"]), "trùng")

#!/usr/bin/env python3
"""TapEasy intro — đổi storyboard (timeline.json, đơn vị phách) sang giây.

Ra:
  build/timeline.resolved.json   — mọi mốc thời gian tuyệt đối (giây): render.py, music.py, qa.py cùng đọc
  build/timeline.js              — cùng nội dung cho compose.html (window.__TIMELINE__)
  build/needs.json               — shot cần chụp + độ cuộn tối đa cần (capture_app.py đọc để chụp vừa đủ)
  build/qr-card.png              — thẻ QR nhóm Zalo "TapEasy Cộng Đồng" cắt gọn từ assets/zalo-community-qr.jpg
                                   (chỉ phần thẻ trắng, bo góc trong suốt; kiểm giải mã được trước khi dùng)

Chạy:  python3 scripts/intro-video/prep.py
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")


def resolve(tl):
    bpm = float(tl["bpm"]); beat = 60.0 / bpm
    T = lambda b: round(b * beat, 4)
    t = tl.get("lead_in_beats", 0) * beat
    chapters, events, needs = [], [], {}
    for i, ch in enumerate(tl["chapters"]):
        c = dict(ch); c["i"] = i
        c0 = t; c1 = t + ch["beats"] * beat
        c["t0"], c["t1"] = round(c0, 4), round(c1, 4)
        shots_start = ch.get("phone_in", 0) if ch.get("kind") == "intro" else 0
        st = c0 + shots_start * beat
        shots = []
        total = sum(s["beats"] for s in ch["shots"]) + shots_start
        if abs(total - ch["beats"]) > 1e-6:
            print(f"! chương {ch['id']}: tổng phách shot {total} ≠ {ch['beats']} — shot cuối tự bù", file=sys.stderr)
        for k, s in enumerate(ch["shots"]):
            b = s["beats"]
            if k == len(ch["shots"]) - 1:
                b = ch["beats"] - shots_start - sum(x["beats"] for x in ch["shots"][:-1])
            r = {"id": s["id"], "t0": round(st, 4), "t1": round(st + b * beat, 4), "enter": s.get("enter", "push" if k else "cut")}
            r["scroll"] = [[round(st + a * beat, 4), round(st + bb * beat, 4), y] for a, bb, y in s.get("scroll", [])]
            r["taps"] = [[round(st + a * beat, 4), tg] for a, tg in s.get("taps", [])]
            r["focus"] = [[round(st + a * beat, 4), round(st + bb * beat, 4), rect, sc] for a, bb, rect, sc in s.get("focus", [])]
            for tap in r["taps"]:
                events.append({"t": tap[0], "type": "tap"})
            if k and r["enter"] in ("push", "sheet", "theme"):
                events.append({"t": r["t0"], "type": "swish" if r["enter"] != "theme" else "pop"})
            mx = max([y for _, _, y in r["scroll"]] + [0])
            needs[s["id"]] = max(needs.get(s["id"], 0), mx)
            shots.append(r); st += b * beat
        c["shots"] = shots
        c["captions"] = [[T(a) + c0, txt] for a, txt in ch.get("captions", [])]
        if "slogan" in ch: c["slogan"] = [[txt, T(a) + c0] for txt, a in ch["slogan"]]
        for key in ("phone_in", "a2hs", "cta_at"):
            if key in ch: c[key] = round(c0 + T(ch[key]), 4)
        if "stat" in ch:
            s = dict(ch["stat"]); s["t"] = round(c0 + T(s.pop("at")), 4); c["stat"] = s
        chapters.append(c)
        t = c1
    duration = round(t + 0.0, 4)
    # sự kiện chuyển cảnh + nhạc
    hero = tl.get("hero_chapter")
    for i, c in enumerate(chapters[:-1]):
        b = chapters[i + 1]["t0"]; kind = c.get("out", "cut")
        if chapters[i + 1]["id"] == hero:
            events.append({"t": round(b - 3.6, 4), "type": "riser", "dur": 3.2})
            events.append({"t": b, "type": "impact"})
        elif kind in ("zoom", "whip", "rotate", "sweep", "flood"):
            events.append({"t": round(b - 0.08, 4), "type": "whoosh", "kind": kind})
        elif kind == "match":
            events.append({"t": b, "type": "tick"})
    events.append({"t": chapters[0]["t0"] + 4 * beat, "type": "impact"})          # logo/slogan đầu phim
    if "cta_at" in chapters[-1]: events.append({"t": chapters[-1]["cta_at"], "type": "impact"})
    events.sort(key=lambda e: e["t"])
    beats = [round(k * beat, 4) for k in range(int(duration / beat) + 1)]
    out = {"bpm": bpm, "beat": round(beat, 6), "fps": tl.get("fps", 30), "duration": duration,
           "hero": hero, "chapters": chapters, "events": events, "beats": beats}
    return out, needs


def qr_card(src_rel):
    """Cắt thẻ trắng chứa QR khỏi ảnh chủ app gửi (nền xanh) → build/qr-card.png (góc bo trong suốt).
    Trả {src, ar, qr:[x,y,w,h] (tỉ lệ theo thẻ), data} — compose.js đọc TL.qr. Không đổi kích thước (giữ nét)."""
    from PIL import Image, ImageDraw
    import numpy as np
    src = os.path.join(HERE, src_rel)
    im = Image.open(src).convert("RGB"); g = np.asarray(im.convert("L"))
    white = g > 235
    rows = np.where(white.mean(1) > .6)[0]; cols = np.where(white.mean(0) > .5)[0]
    y0, y1, x0, x1 = int(rows.min()), int(rows.max()) + 1, int(cols.min()), int(cols.max()) + 1
    card = im.crop((x0, y0, x1, y1)); w, h = card.size
    # bán kính bo góc: đo dải xanh ở góc trên-trái của thẻ
    cg = np.asarray(card.convert("L"))
    r = next((k for k in range(1, min(w, h) // 4) if cg[k, k] > 235), 40)
    r = int(round(r / (1 - 0.7071))) if r > 1 else 40
    mask = Image.new("L", (w * 4, h * 4), 0); ImageDraw.Draw(mask).rounded_rectangle((0, 0, w * 4 - 1, h * 4 - 1), r * 4, fill=255)
    mask = mask.resize((w, h), Image.LANCZOS)
    out = card.convert("RGBA"); out.putalpha(mask)
    dst = os.path.join(BUILD, "qr-card.png"); out.save(dst, optimize=True)
    dark = cg < 90
    ys, xs = np.where(dark[int(h * .15):int(h * .8), :]); ys = ys + int(h * .15)
    qr = [round(xs.min() / w, 4), round(ys.min() / h, 4), round((xs.max() - xs.min() + 1) / w, 4), round((ys.max() - ys.min() + 1) / h, 4)]
    data = ""
    try:
        import cv2
        data, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.cvtColor(np.asarray(card), cv2.COLOR_RGB2BGR))
    except Exception as e:
        print("  (bỏ qua kiểm QR: " + str(e)[:60] + ")")
    print(f"thẻ QR {w}×{h} (cắt {x0},{y0}) · QR {qr} · giải mã: {'OK' if data else 'chưa kiểm/không đọc được'}")
    return {"src": "qr-card.png", "ar": round(h / w, 5), "qr": qr, "w": w, "h": h, "decodes": bool(data)}


def main():
    tl = json.load(open(os.path.join(HERE, "timeline.json"), encoding="utf-8"))
    res, needs = resolve(tl)
    os.makedirs(BUILD, exist_ok=True)
    if tl.get("qr_card"):
        res["qr"] = qr_card(tl["qr_card"])
    with open(os.path.join(BUILD, "timeline.resolved.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BUILD, "timeline.js"), "w", encoding="utf-8") as f:
        f.write("window.__TIMELINE__=" + json.dumps(res, ensure_ascii=False) + ";\n")
    with open(os.path.join(BUILD, "needs.json"), "w", encoding="utf-8") as f:
        json.dump(needs, f, indent=1)
    bgs = sorted({c.get("bg") for c in res["chapters"] if c.get("bg")})
    print(f"thời lượng {res['duration']:.1f}s · {len(res['chapters'])} chương · {sum(len(c['shots']) for c in res['chapters'])} shot · nền {bgs}")
    for c in res["chapters"]:
        print(f"  {c['t0']:7.2f}–{c['t1']:7.2f}  {c['id']:<10} {len(c['shots'])} shot  → {c.get('out')}")


if __name__ == "__main__":
    main()

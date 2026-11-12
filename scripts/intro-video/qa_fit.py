#!/usr/bin/env python3
"""TapEasy intro — QA "ảnh app khít màn mockup" (chạy trước render, cần Playwright + Chromium).

Ở nhiều thời điểm (giữa mỗi shot, mỗi chuyển màn trong điện thoại, ±0,1–0,25 s quanh MỌI chuyển chương:
zoom xuyên / whip / xoay 3D / match / sweep / flood, mỗi đoạn soi cận) dựng 2 khung từ compose.html:
  ?qa=fit  : lớp ảnh app tô MAGENTA, nền màn trống tô XANH LÁ (ẩn chữ, kính, island, thanh trạng thái, hạt phim)
  ?qa=scr  : ẩn lớp ảnh app → chỉ còn vùng màn mockup XANH LÁ
Đo:
  1) khung bao magenta (ảnh app) vs khung bao xanh của ?qa=scr (vùng màn) — từng cạnh, sai lệch ≤ --tol px (mặc định 1)
  2) điểm xanh lộ ra bên trong màn ở ?qa=fit (viền đen/hở = ảnh không phủ kín màn) — 0 điểm cách mép > 2 px
  3) window.__probe(): khung bao DOM của lớp ảnh/ảnh gốc vs .screen, tỉ lệ ảnh 390:844, island/thanh trạng thái/home
Vì ảnh app nằm TRONG cây transform của điện thoại nên sai lệch phải ~0 cả khi xoay 3D/zoom/whip (không trễ khung).
  4) CHỮ (v2): window.__capCheck() — mọi phụ đề dựng thật ở đúng bề rộng: không từ mồ côi ở dòng cuối, không dấu "·/—/:" mở đầu
     dòng, ≤ 2 dòng, không tràn; window.__textQA() ở từng mốc — kicker/tiêu đề/phụ đề/thẻ số/chip/CTA không đè nhau (sát mép < 12 px: cảnh báo)
Ra build/qa/fit-<fmt>/report.txt (+ fit_corners.jpg: 4 góc màn phóng ×4 ở các mốc khó). Mã thoát 1 nếu trượt hoặc lỗi chữ.

  python3 scripts/intro-video/qa_fit.py --fmt v --draft
  python3 scripts/intro-video/qa_fit.py --fmt h
"""
import argparse, asyncio, io, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
sys.path.insert(0, HERE)
from render import serve, FMT  # noqa: E402


def sample_times(tl):
    ts = []
    for c in tl["chapters"]:
        for s in c["shots"]:
            ts.append((s["t0"] + s["t1"]) / 2)
            if s.get("enter") in ("push", "sheet", "fade", "theme") and s["t0"] > c["t0"]:
                ts += [s["t0"] + .12, s["t0"] + .25]
            for a, b, _r, _k in s.get("focus", []):
                ts += [a + .3, min(b, a + .9)]
        if c.get("kind") == "outro":
            ts += [c["a2hs"] + 1.0, c["a2hs"] + 2.2, c["cta_at"] - .2, c["cta_at"] + .3]
        if c.get("kind") == "soon":
            ts += [c["t0"] + 1.5] + [w[0] + .5 for w in c.get("watch", [])] + [x + .5 for x in c.get("sync", [])]
        if c.get("kind") == "intro" and c.get("phone_in"):
            ts += [c["phone_in"] + .15, c["phone_in"] + .4]
    for c in tl["chapters"][:-1]:
        b = c["t1"]
        ts += [b - .25, b - .1, b - .03, b + .03, b + .1, b + .25, b + .45]
    return sorted(set(round(t, 3) for t in ts if 0 < t < tl["duration"]))


def masks(png):
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(io.BytesIO(png)).convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mag = (r > 190) & (g < 80) & (b > 190)
    grn = (g > 190) & (r < 80) & (b < 80)
    return mag, grn


def erode(m, r):
    """co mặt nạ r px (chỉ numpy): điểm còn lại cách mép vùng > r px"""
    import numpy as np
    o = m.copy()
    for _ in range(r):
        p = np.pad(o, 1, constant_values=False)
        o = o & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    return o


def bbox(m):
    import numpy as np
    ys, xs = np.where(m)
    if not len(xs): return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fmt", default="v", choices=list(FMT))
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--tol", type=float, default=1.0)
    ap.add_argument("--port", type=int, default=8771)
    ap.add_argument("--times", default="", help="danh sách giây, phân cách bằng dấu phẩy (mặc định: tự chọn)")
    ap.add_argument("--text-warn", action="store_true", help="lỗi chữ chỉ cảnh báo, không làm mã thoát 1")
    args = ap.parse_args()
    import numpy as np
    from PIL import Image, ImageDraw
    from playwright.async_api import async_playwright

    tl = json.load(open(os.path.join(BUILD, "timeline.resolved.json"), encoding="utf-8"))
    W, H = FMT[args.fmt]
    if args.draft: W, H = W // 2, H // 2
    times = [float(x) for x in args.times.split(",") if x] or sample_times(tl)
    out = os.path.join(BUILD, "qa", f"fit-{args.fmt}{'-draft' if args.draft else ''}"); os.makedirs(out, exist_ok=True)
    srv = serve(args.port)
    lines, fails, corners = [], 0, []
    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=["--disable-dev-shm-usage", "--force-color-profile=srgb", "--hide-scrollbars"])
        pages = {}
        for mode in ("fit", "scr", ""):
            ctx = await br.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
            pg = await ctx.new_page()
            q = f"&qa={mode}" if mode else ""
            await pg.goto(f"http://127.0.0.1:{args.port}/scripts/intro-video/compose.html?w={W}&h={H}{q}", wait_until="networkidle", timeout=180000)
            await pg.evaluate("window.__ready")
            pages[mode] = pg
        worst = 0.0
        cap = await pages[""].evaluate("window.__capCheck ? window.__capCheck() : {bad:[], rows:[]}")
        text_bad = list(cap["bad"]); text_lines = ["— phụ đề (dựng thật, đúng bề rộng) —"] + cap["rows"]
        for t in times:
            for pg in pages.values(): await pg.evaluate(f"window.__render({t})")
            fit_png = await pages["fit"].screenshot(type="png")
            scr_png = await pages["scr"].screenshot(type="png")
            mag, grn_fit = masks(fit_png)
            _, scr = masks(scr_png)
            bm, bs = bbox(mag), bbox(scr)
            probe = await pages["fit"].evaluate("window.__probe()")
            dom = max([s["err"] for p in probe for s in p["shots"] if s["settled"]] + [0])
            ar = max([s.get("arErr") or 0 for p in probe for s in p["shots"]] + [0])
            if bs is None:
                lines.append(f"{t:8.3f}s  (không thấy điện thoại)"); continue
            if bm is None:
                lines.append(f"{t:8.3f}s  ! không thấy ảnh app trong màn"); fails += 1; continue
            d = max(abs(bm[i] - bs[i]) for i in range(4))
            inner = erode(scr, 2)
            gaps = int((grn_fit & inner).sum())
            bad = d > args.tol or gaps > 0 or dom > args.tol or ar > .002
            worst = max(worst, d, dom)
            fails += bad
            isl = "; ".join(f"{p['ch']}: island {p['islandTop']:.1f}–{p['islandBottom']:.1f} lệch tâm {p['islandCx']:.2f} · trạng thái {p['statusH']} · home cách đáy {p['homeGap']:.1f} · kính {p['glassErr']:.2f}px" for p in probe[:1])
            lines.append(f"{t:8.3f}s  {'TRƯỢT' if bad else 'ok   '}  bbox ảnh {bm} màn {bs} lệch {d}px · DOM {dom:.2f}px · hở {gaps} điểm · tỉ lệ ảnh {ar:.4f} · {isl}")
        # chữ đè nhau / sát mép — trên khung thường ở mọi mốc (kể cả mốc không có điện thoại)
        for t in times:
            await pages[""].evaluate(f"window.__render({t})")
            for it in await pages[""].evaluate("window.__textQA ? window.__textQA() : []"):
                warn = "sát mép" in it
                text_lines.append(f"{t:8.3f}s  {'cảnh báo' if warn else 'LỖI CHỮ'}  {it}")
                if not warn: text_bad.append(f"{t:.3f}s {it}")
        # góc phóng to: các mốc khó (sau chuyển cảnh + soi cận) trên khung thường
        hard = [t for t in times if any(abs(t - c["t1"] - .1) < 1e-3 or abs(t - c["t1"] + .1) < 1e-3 for c in tl["chapters"][:-1])][:12]
        for t in hard:
            await pages[""].evaluate(f"window.__render({t})")
            png = await pages[""].screenshot(type="png")
            probe = await pages[""].evaluate("window.__probe()")
            if not probe: continue
            im = Image.open(io.BytesIO(png)).convert("RGB"); s = probe[0]["scr"]; z = max(24, int(70 * probe[0]["k"]))
            crops = []
            for (x, y) in [(s["x"], s["y"]), (s["x"] + s["w"] - z, s["y"]), (s["x"], s["y"] + s["h"] - z), (s["x"] + s["w"] - z, s["y"] + s["h"] - z)]:
                x, y = int(round(x)) - 6, int(round(y)) - 6
                crops.append(im.crop((x, y, x + z + 12, y + z + 12)).resize((200, 200), Image.NEAREST))
            corners.append((f"{t:.2f}s", crops))
        await br.close()
    srv.shutdown()
    if corners:
        S = Image.new("RGB", (4 * 204, len(corners) * 220), (20, 20, 20)); dr = ImageDraw.Draw(S)
        for i, (lab, cs) in enumerate(corners):
            dr.text((4, i * 220 + 3), lab, fill=(255, 210, 90))
            for j, c in enumerate(cs): S.paste(c, (j * 204, i * 220 + 18))
        S.save(os.path.join(out, "fit_corners.jpg"), quality=88)
    head = [f"QA khít {W}×{H} · {len(times)} thời điểm · dung sai {args.tol}px · lệch lớn nhất {worst:.2f}px · trượt {fails}",
            f"QA chữ: {len(text_bad)} lỗi (phụ đề mồ côi/dấu đầu dòng/tràn, chữ đè nhau)"]
    open(os.path.join(out, "report.txt"), "w", encoding="utf-8").write("\n".join(head + lines + [""] + text_lines) + "\n")
    print("\n".join(head + [l for l in lines if "TRƯỢT" in l or "!" in l][:40] + text_bad[:40]))
    print("→", out)
    sys.exit(1 if fails or (text_bad and not args.text_warn) else 0)


if __name__ == "__main__":
    asyncio.run(main())

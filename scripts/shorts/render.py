#!/usr/bin/env python3
"""TapEasy Shorts — chụp khung từ shorts.html (render(t) thuần) → H.264 1080×1920, 30 fps, yuv420p, BT.709.

- Mỗi short: mở shorts.html?id=<id>, đợi __ready (font + ảnh), chụp tuần tự từng khung (không thời gian thực).
- Nhoè chuyển động ở khung chuyển cảnh nhanh (__blurSamples(t) > 1): 3 khung con trên nửa khoảng khung (màn trập 180°),
  không trộn qua mốc cắt (__cuts()). Tắt bằng --no-blur.
- QA bố cục: ở các mốc ổn định (giữa mỗi mảnh hình / sau bước cuối, giữa mỗi cụm phụ đề, thẻ kết) gọi __probe() →
  build/qa/<id>/layout.json (hộp chữ thật đo trong Chromium) cho qa.py.
- Ảnh bìa: __cover() → build/out/<id>.jpg.
Ra: build/out/<id>.video.mp4 (chưa có tiếng — finalize.py ghép âm thanh + chuẩn hoá).

  python3 scripts/shorts/render.py --ids bmr-tdee,giac-ngu
  python3 scripts/shorts/render.py --ids bmr-tdee --draft --end 6      # nháp 540×960, 6 s đầu
"""
import argparse, asyncio, functools, http.server, io, json, math, os, subprocess, sys, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BUILD = os.path.join(HERE, "build")


def serve(port):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=REPO)
    class Q(http.server.ThreadingHTTPServer):
        daemon_threads = True
    srv = Q(("127.0.0.1", port), h)
    srv.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def encoder(path, w, h, fps, crf, maxrate):
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
           "-c:v", "libx264", "-preset", "medium", "-crf", str(crf), "-maxrate", maxrate, "-bufsize", "10M",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-g", str(fps * 2), "-r", str(fps),
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709", "-movflags", "+faststart", path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def sample_times(P):
    """mốc ổn định để đo bố cục (không rơi vào 0,4 s chuyển cảnh)"""
    ts = []
    for b in P["beats"]:
        for p in b["pieces"]:
            a = p["t0"] + 0.55; z = p["t1"] - 0.12
            if p.get("steps"): a = max(a, p["steps"][-1] + 0.5)
            if z > p["t0"] + 0.45: ts.append(round(min(a, z), 3))
    for c in P["chunks"]:
        if c.get("hidden"): continue
        ts.append(round(max(c["t0"] + 0.2, (c["t0"] + c["t1"]) / 2), 3))
    ts.append(round(P["end"]["t0"] + 1.2, 3)); ts.append(round(P["end"]["t1"] - 0.1, 3))
    return sorted(set(t for t in ts if 0 <= t < P["duration"]))


async def render_one(page, sid, args, np, Image):
    P = json.load(open(os.path.join(BUILD, "plans", sid + ".json"), encoding="utf-8"))
    fps = args.fps or P.get("fps", 30)
    W, H = (540, 960) if args.draft else (1080, 1920)
    url = f"http://127.0.0.1:{args.port}/scripts/shorts/shorts.html?id={sid}"
    await page.goto(url, wait_until="networkidle", timeout=180000)
    info = await page.evaluate("window.__ready")
    print(f"[{sid}] {info}", flush=True)
    cuts = await page.evaluate("window.__cuts()")
    total = int(math.ceil(P["duration"] * fps))
    f0 = int(round(args.start * fps)); f1 = min(total, int(round(args.end * fps)) if args.end else total)
    out_dir = os.path.join(BUILD, "out"); os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, sid + (".draft" if args.draft else "") + ".video.mp4")
    enc = encoder(path + ".part.mp4", W, H, fps, args.crf, args.maxrate)
    sub_dt = 0.5 / fps

    async def grab():
        buf = await page.screenshot(type="jpeg", quality=93, animations="allow", caret="initial")
        im = Image.open(io.BytesIO(buf)).convert("RGB")
        if im.size != (W, H): im = im.resize((W, H), Image.LANCZOS)
        return np.asarray(im)

    t0 = time.time()
    for n in range(f0, f1):
        t = n / fps
        N = 1 if (args.draft or args.no_blur) else int(await page.evaluate(f"window.__blurSamples({t})"))
        if N <= 1:
            await page.evaluate(f"window.__render({t})"); img = await grab()
        else:
            lo, hi = t - sub_dt / 2, t + sub_dt / 2
            for c in cuts:
                if lo < c <= hi:
                    if t < c: hi = c - 1e-4
                    else: lo = c
            acc = None
            for k in range(N):
                await page.evaluate(f"window.__render({lo + (hi - lo) * k / (N - 1)})")
                fr = (await grab()).astype(np.float32); acc = fr if acc is None else acc + fr
            img = (acc / N + 0.5).clip(0, 255).astype(np.uint8)
        enc.stdin.write(img.tobytes())
        if (n - f0) % 150 == 149: print(f"  [{sid}] khung {n + 1}/{f1} · {(n - f0 + 1) / (time.time() - t0):.1f} khung/s", flush=True)
    enc.stdin.close(); enc.wait()
    if enc.returncode: raise SystemExit(f"ffmpeg lỗi ({sid})")
    os.replace(path + ".part.mp4", path)
    # QA bố cục
    qa_dir = os.path.join(BUILD, "qa", sid); os.makedirs(qa_dir, exist_ok=True)
    samples = []
    for t in sample_times(P):
        await page.evaluate(f"window.__render({t})")
        pr = await page.evaluate("window.__probe()"); pr["t"] = t; samples.append(pr)
    # ảnh bìa
    await page.evaluate("window.__cover()")
    cover = os.path.join(out_dir, sid + ".jpg")
    await page.screenshot(path=cover, type="jpeg", quality=90)
    cv = await page.evaluate("window.__probe()"); cv["t"] = "cover"; samples.append(cv)
    json.dump({"id": sid, "W": W, "H": H, "safe": P["safe"], "samples": samples}, open(os.path.join(qa_dir, "layout.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"  ✓ [{sid}] {f1 - f0} khung trong {time.time() - t0:.0f}s → {os.path.relpath(path, REPO)} · bìa · {len(samples)} mẫu bố cục", flush=True)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ids", default="")
    ap.add_argument("--fps", type=int, default=0)
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--end", type=float, default=0)
    ap.add_argument("--crf", type=int, default=21)
    ap.add_argument("--maxrate", default="6M")
    ap.add_argument("--no-blur", action="store_true")
    ap.add_argument("--port", type=int, default=8766)
    args = ap.parse_args()
    import numpy as np
    from PIL import Image
    from playwright.async_api import async_playwright
    ids = [x for x in args.ids.split(",") if x] or [f[:-5] for f in sorted(os.listdir(os.path.join(BUILD, "plans"))) if f.endswith(".json") and f != "index.json"]
    srv = serve(args.port)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--disable-dev-shm-usage", "--force-color-profile=srgb", "--hide-scrollbars", "--font-render-hinting=none"])
        ctx = await browser.new_context(viewport={"width": 1080, "height": 1920}, device_scale_factor=0.5 if args.draft else 1)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("  JS:", str(e)[:200], file=sys.stderr))
        for sid in ids:
            await render_one(page, sid, args, np, Image)
        await browser.close()
    srv.shutdown()


if __name__ == "__main__":
    asyncio.run(main())

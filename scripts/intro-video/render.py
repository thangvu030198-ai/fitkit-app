#!/usr/bin/env python3
"""TapEasy intro — chụp khung từ compose.html (render(t) thuần) → H.264.

- Khung = window.__render(t); chụp tuần tự, không thời gian thực.
- Nhoè chuyển động: ở đoạn nhanh (window.__blurSamples(t) > 1) chụp N khung con trải trên nửa
  khoảng khung (màn trập 180°) rồi lấy trung bình; khung con không vượt mốc cắt cứng (window.__cuts()).
- Chia đoạn (chunk) 600 khung → chunk_XXXX.mp4; chạy lại sẽ bỏ qua đoạn đã có (tiếp tục được).
- --part i --parts n: chỉ dựng phần thứ i (chạy song song trên nhiều máy GitHub Actions).

  python3 scripts/intro-video/render.py --fmt v               # 1080×1920
  python3 scripts/intro-video/render.py --fmt h --fps 60      # 1920×1080, 60 fps
  python3 scripts/intro-video/render.py --fmt v --draft --start 0 --end 20   # nháp 540p, 20 s đầu
"""
import argparse, asyncio, functools, http.server, io, json, math, os, subprocess, sys, threading, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BUILD = os.path.join(HERE, "build")
FMT = {"v": (1080, 1920), "h": (1920, 1080)}


def serve(port):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=REPO)
    class Q(http.server.ThreadingHTTPServer):
        daemon_threads = True
    srv = Q(("127.0.0.1", port), h)
    srv.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def ffmpeg_writer(path, w, h, fps, crf, maxrate):
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
           "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-maxrate", maxrate, "-bufsize", "8M",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-g", str(fps * 2),
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709", "-movflags", "+faststart", path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def frame_count(path):
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
                              "stream=nb_read_packets", "-of", "csv=p=0", path], capture_output=True, text=True, timeout=120)
        return int(out.stdout.strip() or 0)
    except Exception:
        return 0


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fmt", default="v", choices=list(FMT))
    ap.add_argument("--fps", type=int, default=0)
    ap.add_argument("--draft", action="store_true", help="nửa độ phân giải (540p), không nhoè")
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--end", type=float, default=0)
    ap.add_argument("--part", type=int, default=0)
    ap.add_argument("--parts", type=int, default=1)
    ap.add_argument("--chunk", type=int, default=600)
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--maxrate", default="3000k")
    ap.add_argument("--no-blur", action="store_true")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    import numpy as np
    from PIL import Image
    from playwright.async_api import async_playwright

    tl = json.load(open(os.path.join(BUILD, "timeline.resolved.json"), encoding="utf-8"))
    fps = args.fps or int(tl.get("fps", 30))
    W, H = FMT[args.fmt]
    if args.draft: W, H = W // 2, H // 2
    out_dir = args.out or os.path.join(BUILD, "out", args.fmt + ("-draft" if args.draft else ""))
    chunks_dir = os.path.join(out_dir, "chunks"); os.makedirs(chunks_dir, exist_ok=True)
    total = int(math.ceil(tl["duration"] * fps))
    f0 = int(round(args.start * fps)); f1 = int(round(args.end * fps)) if args.end else total
    # chia phần cho song song
    span = f1 - f0; per = int(math.ceil(span / args.parts))
    p0 = f0 + args.part * per; p1 = min(f1, p0 + per)
    chunks = [(a, min(p1, a + args.chunk)) for a in range(p0, p1, args.chunk)]
    print(f"{W}×{H} @{fps} · khung {p0}–{p1} / {total} · {len(chunks)} đoạn → {chunks_dir}", flush=True)

    srv = serve(args.port)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--disable-dev-shm-usage", "--force-color-profile=srgb", "--hide-scrollbars",
                                                 "--disable-gpu-vsync", "--font-render-hinting=none"])
        ctx = await browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: print("  JS:", str(e)[:200], file=sys.stderr))
        url = f"http://127.0.0.1:{args.port}/scripts/intro-video/compose.html?w={W}&h={H}&fps={fps}"
        await page.goto(url, wait_until="networkidle", timeout=180000)
        info = await page.evaluate("window.__ready")
        print("compose:", info, flush=True)
        cuts = await page.evaluate("window.__cuts()")
        sub_dt = 0.5 / fps                                  # màn trập 180°

        async def grab():
            buf = await page.screenshot(type="jpeg", quality=95, animations="allow", caret="initial")
            return np.asarray(Image.open(io.BytesIO(buf)).convert("RGB"))

        t_start = time.time(); done = 0
        for (a, b) in chunks:
            path = os.path.join(chunks_dir, f"chunk_{a:06d}.mp4")
            if os.path.exists(path) and frame_count(path) == b - a:
                print(f"  bỏ qua {os.path.basename(path)} (đã có)"); continue
            tmp = path + ".part.mp4"
            enc = ffmpeg_writer(tmp, W, H, fps, args.crf, args.maxrate)
            for n in range(a, b):
                t = n / fps
                N = 1 if (args.draft or args.no_blur) else int(await page.evaluate(f"window.__blurSamples({t})"))
                if N <= 1:
                    await page.evaluate(f"window.__render({t})")
                    img = await grab()
                else:
                    lo, hi = t - sub_dt / 2, t + sub_dt / 2
                    for c in cuts:                      # không trộn khung qua mốc cắt
                        if lo < c <= hi:
                            if t < c: hi = c - 1e-4
                            else: lo = c
                    acc = None
                    for k in range(N):
                        ts = lo + (hi - lo) * (k / (N - 1))
                        await page.evaluate(f"window.__render({ts})")
                        fr = (await grab()).astype(np.float32)
                        acc = fr if acc is None else acc + fr
                    img = (acc / N + 0.5).clip(0, 255).astype(np.uint8)
                enc.stdin.write(img.tobytes())
                done += 1
                if done % 150 == 0:
                    el = time.time() - t_start
                    print(f"  khung {n}/{p1}  {done / el:.2f} khung/s", flush=True)
            enc.stdin.close(); enc.wait()
            os.replace(tmp, path)
            print(f"  ✓ {os.path.basename(path)}", flush=True)
        await browser.close()
    srv.shutdown()
    print(f"xong phần {args.part + 1}/{args.parts} sau {time.time() - t_start:.0f}s")


if __name__ == "__main__":
    asyncio.run(main())

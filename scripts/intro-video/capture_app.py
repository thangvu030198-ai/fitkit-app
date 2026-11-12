#!/usr/bin/env python3
"""TapEasy intro — chụp app THẬT bằng Playwright (390×844 @3x) cho bộ dựng.

Khung chụp = đúng vùng màn của mockup trong compose.js (390×844 CSS px, không co giãn). director.js giả lập
vùng an toàn iPhone (trên 47 px cho thanh trạng thái 9:41 + dynamic island, dưới 34 px cho thanh home) bằng cách
viết lại env(safe-area-inset-*) của app; số đo ghi vào manifest.safe. Mỗi ảnh được kiểm đúng 390·s × 844·s px.

Mỗi shot (director.js → __TI.order): ảnh nền toàn màn (base) + các dải cuộn (strips) của vùng cuộn,
toạ độ điểm chạm. Ra build/shots/<id>/*.jpg + build/manifest.js (window.__MANIFEST__).

  python3 scripts/intro-video/prep.py                       # tạo build/needs.json
  python3 scripts/intro-video/capture_app.py --url https://thangvu030198-ai.github.io/fitkit-app/
  python3 scripts/intro-video/capture_app.py --url http://127.0.0.1:8000/index.html --only home,nutrition

Chỉ dùng dữ liệu demo cục bộ (localStorage của ngữ cảnh trình duyệt mới) — KHÔNG đăng nhập tài khoản thật.
"""
import argparse, asyncio, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
VW, VH = 390, 844            # = SCR_W × SCR_H trong compose.js (vùng màn của mockup)


def check_size(path, scale):
    from PIL import Image
    w, h = Image.open(path).size
    ew, eh = round(VW * scale), round(VH * scale)
    if (w, h) != (ew, eh):
        raise SystemExit(f"! {path}: {w}×{h} ≠ {ew}×{eh} — ảnh app sẽ không khít màn mockup")


def write_manifest(man):
    with open(os.path.join(BUILD, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BUILD, "manifest.js"), "w", encoding="utf-8") as f:
        f.write("window.__MANIFEST__=" + json.dumps(man, ensure_ascii=False) + ";\n")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://thangvu030198-ai.github.io/fitkit-app/")
    ap.add_argument("--scale", type=float, default=3.0, help="deviceScaleFactor (3 = @3x)")
    ap.add_argument("--quality", type=int, default=90)
    ap.add_argument("--only", default="", help="chỉ lưu các shot này (vẫn chạy cả chuỗi để giữ trạng thái)")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()
    from playwright.async_api import async_playwright

    needs_p = os.path.join(BUILD, "needs.json")
    needs = json.load(open(needs_p)) if os.path.exists(needs_p) else {}
    only = set(x for x in args.only.split(",") if x)
    shots_dir = os.path.join(BUILD, "shots"); os.makedirs(shots_dir, exist_ok=True)
    man_p = os.path.join(BUILD, "manifest.json")
    man = json.load(open(man_p, encoding="utf-8")) if os.path.exists(man_p) else {}
    man.setdefault("shots", {}); man.setdefault("bg", {}); man["scale"] = args.scale
    man["screen"] = {"w": VW, "h": VH}
    man["captured_from"] = args.url; man["captured_at"] = time.strftime("%Y-%m-%d %H:%M")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=not args.headed, args=["--disable-dev-shm-usage", "--force-color-profile=srgb"])
        ctx = await browser.new_context(viewport={"width": VW, "height": VH}, device_scale_factor=args.scale,
                                        locale="vi-VN", timezone_id="Asia/Ho_Chi_Minh", is_mobile=False, has_touch=False)
        await ctx.add_init_script(path=os.path.join(HERE, "director.js"))
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:200]))
        await page.goto(args.url, wait_until="networkidle", timeout=120000)
        order = await page.evaluate("__TI.order")
        man["safe"] = {"top": await page.evaluate("__TI.SAFE_TOP"), "bottom": await page.evaluate("__TI.SAFE_BOT")}
        print(f"{len(order)} shot theo thứ tự director.js")
        for sid in order:
            t0 = time.time()
            m = await page.evaluate("id => __TI.run(id)", sid)
            keep = (not only or sid in only)
            if keep:
                d = os.path.join(shots_dir, sid); os.makedirs(d, exist_ok=True)
                for f in os.listdir(d): os.remove(os.path.join(d, f))
                await page.screenshot(path=os.path.join(d, "base.jpg"), type="jpeg", quality=args.quality)
                check_size(os.path.join(d, "base.jpg"), args.scale)
                sc = m["scroller"]; need = needs.get(sid, 0)
                strips = []
                if need > 0 and not m.get("noStrips") and m["scrollMax"] > 0 and sc["h"] > 100:
                    mx = await page.evaluate("__TI.prepStrips()")
                    limit = min(mx, need + 40)
                    step = max(120, sc["h"] - 48)
                    ys, y = [], 0
                    while True:
                        ys.append(min(y, limit))
                        if y >= limit: break
                        y += step
                    for k, y in enumerate(dict.fromkeys(ys)):
                        real = await page.evaluate("y => __TI.scrollTo(y)", y)
                        fn = f"s{k:02d}.jpg"
                        await page.screenshot(path=os.path.join(d, fn), type="jpeg", quality=args.quality,
                                              clip={"x": sc["x"], "y": sc["y"], "width": sc["w"], "height": sc["h"]})
                        strips.append({"y": round(real), "src": f"shots/{sid}/{fn}"})
                    await page.evaluate("__TI.endStrips()")
                man["shots"][sid] = {"base": f"shots/{sid}/base.jpg", "viewport": m["viewport"], "scroller": sc,
                                     "scrollMax": m["scrollMax"], "scrollTop": m.get("scrollTop", 0), "strips": strips, "targets": m["targets"],
                                     "light": m["light"], "theme": m.get("theme", ""), "noStrips": m.get("noStrips", False)}
                write_manifest(man)
            await page.evaluate("id => __TI.after(id)", sid)
            log = " | ".join(m.get("log") or [])
            print(f"  {sid:<16} cuộn≤{m['scrollMax']:>5} dải={len(man['shots'].get(sid, {}).get('strips', [])) if keep else '-'} "
                  f"{time.time()-t0:4.1f}s {('LOG ' + log) if log else ''}", flush=True)
        if errs: print("Lỗi JS trong app (bỏ qua nếu không ảnh hưởng):", *errs[:8], sep="\n  ")
        await browser.close()
    write_manifest(man)
    print("xong →", os.path.join(BUILD, "manifest.js"))


if __name__ == "__main__":
    asyncio.run(main())

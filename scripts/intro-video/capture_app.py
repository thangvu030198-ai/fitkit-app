#!/usr/bin/env python3
"""TapEasy intro — chụp app THẬT bằng Playwright (390×844 @3x) cho bộ dựng.

Khung chụp = đúng vùng màn của mockup trong compose.js (390×844 CSS px, không co giãn). director.js giả lập
vùng an toàn iPhone 14/15 Pro (trên 59 px cho thanh trạng thái 9:41 + dynamic island, dưới 34 px cho thanh home) bằng cách
viết lại env(safe-area-inset-*) của app thành px + ép --sat/--sab; số đo ghi vào manifest.safe. Mỗi ảnh được kiểm đúng 390·s × 844·s px.

QA vùng an toàn (mọi shot, riêng từng cảnh có sheet mở): không chữ/nút nào của app trong dải 0–59 px trên / 34 px dưới
(trừ nền; nội dung đang cuộn tràn xuống dưới thanh home được phép), sheet cách dải trạng thái ≥ 12 px, tiêu đề + nút đóng
sheet nằm dưới dải, đáy sheet chừa thanh home. Ra build/qa/safe/report.txt + report.json + ảnh khoanh đỏ <shot>.jpg;
có lỗi → mã thoát 3 (sau khi đã ghi đủ manifest) trừ khi --safe-warn.

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


def safe_report(audits, man, scale):
    """build/qa/safe/: report.txt (từng shot + bảng riêng các cảnh có sheet mở), report.json, ảnh khoanh đỏ cho shot lỗi."""
    out = os.path.join(BUILD, "qa", "safe"); os.makedirs(out, exist_ok=True)
    st, sb = man["safe"]["top"], man["safe"]["bottom"]
    lines = [f"QA vùng an toàn — giả lập iPhone {VW}×{VH}, trên {st} px (thanh trạng thái + dynamic island), dưới {sb} px (thanh home)", ""]
    bad = 0
    for sid, a in audits.items():
        e, w = a.get("errors", []), a.get("warns", [])
        if e: bad += 1
        lines.append(f"{'LỖI ' if e else 'ĐẠT '} {sid:<16} lỗi {len(e)} · cảnh báo mép {len(w)}" + ("" if a.get("fitted", True) else " · app bản cũ (chưa --fk-safe)"))
        for x in e: lines.append(f"      ✗ {x['zone']:<6} {x['el']}  {x['box']}")
        for x in w[:4]: lines.append(f"      · {x['zone']:<6} {x['el']}  {x['box']}")
        if e:
            try:
                from PIL import Image, ImageDraw
                im = Image.open(os.path.join(BUILD, "shots", sid, "base.jpg")).convert("RGB"); dr = ImageDraw.Draw(im, "RGBA")
                k = scale
                dr.rectangle([0, 0, im.width, st * k], fill=(255, 200, 0, 40)); dr.rectangle([0, (VH - sb) * k, im.width, im.height], fill=(255, 200, 0, 40))
                for x in e:
                    bx, by, bw, bh = x["box"]; dr.rectangle([bx * k, by * k, (bx + bw) * k, (by + max(bh, 1)) * k], outline=(255, 0, 0, 255), width=max(2, int(k * 1.5)))
                im.save(os.path.join(out, f"{sid}.jpg"), quality=82)
            except Exception as ex:
                lines.append(f"      (không vẽ được ảnh: {ex})")
    sheets = {k: a["sheet"] for k, a in audits.items() if a.get("sheet")}
    lines += ["", f"Cảnh có sheet mở ({len(sheets)}): mép trên ≥ {st + 12}, tiêu đề ≥ {st}, đáy sheet chừa ≥ {sb}"]
    for sid, sh in sheets.items():
        ok = not any(x["zone"] in ("sheet", "top") for x in audits[sid].get("errors", []))
        lines.append(f"  {'ĐẠT' if ok else 'LỖI'}  {sid:<16} mép trên y={sh['top']} · tiêu đề y={sh['header']} · nút đóng {sh['close']} · đệm đáy {sh['padBottom']:.0f} · lề ngang {sh['padX']:.0f}")
    lines += ["", f"Kết quả: {'ĐẠT' if not bad else f'{bad} shot LỖI'} ({len(audits)} shot)"]
    with open(os.path.join(out, "report.txt"), "w", encoding="utf-8") as f: f.write("\n".join(lines) + "\n")
    with open(os.path.join(out, "report.json"), "w", encoding="utf-8") as f: json.dump({"safe": man["safe"], "shots": audits}, f, ensure_ascii=False, indent=1)
    print("\n".join(lines[-(len(sheets) + 3):]))
    return bad


async def capture_seq(page, sid, d, args):
    """Chuỗi khung theo thời gian ẢO của animation app (director.js: shot.seq): τ = k / fps, mỗi khung toàn màn 390×844.
    director dừng + tua mọi CSS animation tới τ và tính lại số đếm → khung đều nhau dù chụp chậm. Ra shots/<id>/q%03d.jpg."""
    info = await page.evaluate("id => __TI.seqInfo(id)", sid)
    if not info: return None
    meta = await page.evaluate("id => __TI.seqPrep(id)", sid)
    fps = int(info.get("fps") or 30); n = int(round(info["dur"] * fps)) + 1
    t0 = time.time()
    for k in range(n):
        await page.evaluate("([id, t]) => __TI.seqAt(id, t)", [sid, k / fps])
        fn = os.path.join(d, f"q{k:03d}.jpg")
        await page.screenshot(path=fn, type="jpeg", quality=min(args.quality, 84))
        if k == 0: check_size(fn, args.scale)
    await page.evaluate("id => __TI.seqEnd(id)", sid)
    print(f"    chuỗi khung {sid}: {n} khung @{fps} fps ({info['dur']} s) trong {time.time()-t0:.0f}s · cuộn tới {meta.get('y')}", flush=True)
    return {"fps": fps, "count": n, "pattern": f"shots/{sid}/q%03d.jpg", "y": meta.get("y", 0)}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://thangvu030198-ai.github.io/fitkit-app/")
    ap.add_argument("--scale", type=float, default=3.0, help="deviceScaleFactor (3 = @3x)")
    ap.add_argument("--quality", type=int, default=90)
    ap.add_argument("--only", default="", help="chỉ lưu các shot này (vẫn chạy cả chuỗi để giữ trạng thái)")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--safe-warn", action="store_true", help="QA vùng an toàn chỉ cảnh báo, không trả mã lỗi")
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
        print(f"{len(order)} shot theo thứ tự director.js · vùng an toàn {man['safe']}")
        audits = {}
        for sid in order:
            t0 = time.time()
            m = await page.evaluate("id => __TI.run(id)", sid)
            keep = (not only or sid in only)
            if keep:
                d = os.path.join(shots_dir, sid); os.makedirs(d, exist_ok=True)
                for f in os.listdir(d): os.remove(os.path.join(d, f))
                await page.screenshot(path=os.path.join(d, "base.jpg"), type="jpeg", quality=args.quality)
                check_size(os.path.join(d, "base.jpg"), args.scale)
                seq = await capture_seq(page, sid, d, args)
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
                                     "light": m["light"], "theme": m.get("theme", ""), "noStrips": m.get("noStrips", False),
                                     "stripInset": m.get("stripInset", 0)}
                if m.get("bandColor"): man["shots"][sid]["bandColor"] = m["bandColor"]
                if m.get("safeAudit"): audits[sid] = m["safeAudit"]
                if seq: man["shots"][sid]["seq"] = seq
                write_manifest(man)
            await page.evaluate("id => __TI.after(id)", sid)
            log = " | ".join(m.get("log") or [])
            print(f"  {sid:<16} cuộn≤{m['scrollMax']:>5} dải={len(man['shots'].get(sid, {}).get('strips', [])) if keep else '-'} "
                  f"{time.time()-t0:4.1f}s {('LOG ' + log) if log else ''}", flush=True)
        if errs: print("Lỗi JS trong app (bỏ qua nếu không ảnh hưởng):", *errs[:8], sep="\n  ")
        await browser.close()
    write_manifest(man)
    print("xong →", os.path.join(BUILD, "manifest.js"))
    bad = safe_report(audits, man, args.scale)
    if bad and not args.safe_warn:
        print(f"::error::QA vùng an toàn: {bad} shot có chữ/nút trong dải trạng thái/thanh home — xem build/qa/safe/report.txt")
        sys.exit(3)


if __name__ == "__main__":
    asyncio.run(main())

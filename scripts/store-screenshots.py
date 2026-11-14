#!/usr/bin/env python3
"""TapEasy — chụp ảnh màn hình ĐÚNG KÍCH THƯỚC cho App Store / Google Play từ bản web.  (R3-store)

  pip install playwright && python -m playwright install chromium         # một lần, trên máy chủ dự án hoặc CI
  python3 scripts/store-screenshots.py                                    # phục vụ thư mục gốc repo tại localhost rồi chụp
  python3 scripts/store-screenshots.py --url https://thangvu030198-ai.github.io/fitkit-app/   # chụp từ bản web đang chạy
  python3 scripts/store-screenshots.py --only ios-6.7,android-phone --screens home,workout,nutrition
  python3 scripts/store-screenshots.py --dry-run                          # chỉ in kế hoạch (không cần Playwright)

Kết quả: store/screenshots/out/<thiết bị>/<NN>-<màn>.png  (script tự kiểm lại kích thước từng file PNG).

Kích thước (px, dọc) — kiểm lại bảng hiện hành trước khi nộp:
  ios-6.9   1320 × 2868   iPhone 16/17 Pro Max      (App Store nhận 6.9" HOẶC 6.7" làm bộ ảnh chính)
  ios-6.7   1290 × 2796   iPhone 15 Pro Max / Plus  ← BẮT BUỘC có 1 bộ 6.7"/6.9"
  ios-6.5   1242 × 2688   iPhone 11 Pro Max / XS Max (tuỳ chọn — Apple tự thu nhỏ từ 6.7" nếu bỏ trống)
  ios-5.5   1242 × 2208   iPhone 8 Plus              (tuỳ chọn — chỉ cần nếu muốn ảnh riêng cho máy cũ)
  android-phone 1080 × 1920  Google Play: 2–8 ảnh, tỉ lệ 9:16, cạnh dài ≤ 2 × cạnh ngắn (1080 × 2400 KHÔNG hợp lệ)
App chỉ phát hành cho iPhone (TARGETED_DEVICE_FAMILY = 1) ⇒ KHÔNG cần ảnh iPad.

Dữ liệu mẫu: store/screenshots/seed-state.json được ghi vào localStorage["fitkit_state_v1"] trước khi app khởi động
(sửa file này, hoặc xuất dữ liệu thật từ máy chụp: Hồ sơ → Sao lưu → dán vào). Không dùng tên/ảnh người thật.
Ảnh ra là ảnh "thô" của app; khung + tiêu đề marketing: docs/STORE-LISTING.md §6.
"""
import argparse, functools, http.server, json, os, socketserver, struct, sys, threading

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STATE_KEY = "fitkit_state_v1"

# tên: (rộng CSS, cao CSS, tỉ lệ điểm ảnh, user-agent di động)
IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
AND_UA = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
DEVICES = {
    "ios-6.9": (440, 956, 3, IOS_UA),
    "ios-6.7": (430, 932, 3, IOS_UA),
    "ios-6.5": (414, 896, 3, IOS_UA),
    "ios-5.5": (414, 736, 3, IOS_UA),
    "android-phone": (360, 640, 3, AND_UA),
}
# màn → đoạn JS đưa app tới màn đó (goto() của app.js). Thứ tự = thứ tự ảnh trên store (docs/STORE-LISTING.md §6).
SCREENS = [
    ("home", "goto('home')"),
    ("plans", "goto('plans')"),
    ("workout", "goto('workout')"),
    ("library", "goto('library')"),
    ("nutrition", "goto('nutrition')"),
    ("coach", "goto('coach')"),
    ("progress", "goto('progress')"),
    ("profile", "goto('profile')"),
]


def expected_px(name):
    w, h, dpr, _ = DEVICES[name]
    return w * dpr, h * dpr


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("không phải PNG: " + path)
    return struct.unpack(">II", head[16:24])


def play_ok(w, h):
    """Luật Google Play cho ảnh điện thoại: mỗi cạnh 320–3840 px, cạnh dài ≤ 2 × cạnh ngắn."""
    return 320 <= min(w, h) and max(w, h) <= 3840 and max(w, h) <= 2 * min(w, h)


def serve(directory):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
    handler.log_message = lambda *a, **k: None
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, "http://127.0.0.1:%d/" % srv.server_address[1]


def main(argv=None):
    ap = argparse.ArgumentParser(description="Chụp ảnh màn hình store cho TapEasy")
    ap.add_argument("--url", help="URL bản web (mặc định: tự phục vụ --dir tại localhost)")
    ap.add_argument("--dir", default=ROOT, help="thư mục web để phục vụ (gốc repo hoặc www/)")
    ap.add_argument("--out", default=os.path.join(ROOT, "store", "screenshots", "out"))
    ap.add_argument("--only", help="danh sách thiết bị, cách nhau dấu phẩy: " + ",".join(DEVICES))
    ap.add_argument("--screens", help="danh sách màn, cách nhau dấu phẩy: " + ",".join(s for s, _ in SCREENS))
    ap.add_argument("--seed", default=os.path.join(ROOT, "store", "screenshots", "seed-state.json"))
    ap.add_argument("--local-storage", action="append", default=[], metavar="KEY=VALUE", help="đặt thêm localStorage (vd ngôn ngữ giao diện)")
    ap.add_argument("--color-scheme", choices=["dark", "light"], default="dark")
    ap.add_argument("--wait-ms", type=int, default=1200, help="chờ sau mỗi lần chuyển màn (hiệu ứng, ảnh)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)

    devices = [d.strip() for d in a.only.split(",")] if a.only else list(DEVICES)
    bad = [d for d in devices if d not in DEVICES]
    if bad:
        ap.error("thiết bị không có: " + ", ".join(bad))
    screens = SCREENS
    if a.screens:
        want = [s.strip() for s in a.screens.split(",")]
        known = dict(SCREENS)
        miss = [s for s in want if s not in known]
        if miss:
            ap.error("màn không có: " + ", ".join(miss))
        screens = [(s, known[s]) for s in want]
    extra = {}
    for kv in a.local_storage:
        if "=" not in kv:
            ap.error("--local-storage cần dạng KEY=VALUE")
        k, v = kv.split("=", 1)
        extra[k] = v
    seed = None
    if a.seed and os.path.exists(a.seed):
        with open(a.seed, encoding="utf8") as f:
            seed = json.load(f)

    for d in devices:
        w, h = expected_px(d)
        note = ""
        if d.startswith("android") and not play_ok(w, h):
            note = "  ⚠️ không hợp lệ với Google Play"
        print("• %-14s %4d × %4d px (%d ảnh)%s" % (d, w, h, len(screens), note))
    if a.dry_run:
        return 0

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("❌ Chưa cài Playwright:  pip install playwright && python -m playwright install chromium")
        return 2

    srv = None
    url = a.url
    if not url:
        if not os.path.exists(os.path.join(a.dir, "index.html")):
            print("❌ %s không có index.html" % a.dir)
            return 2
        srv, url = serve(a.dir)
    init = "(function(){try{"
    if seed is not None:
        init += "if(!localStorage.getItem(%s))localStorage.setItem(%s,%s);" % (json.dumps(STATE_KEY), json.dumps(STATE_KEY), json.dumps(json.dumps(seed, ensure_ascii=False)))
    for k, v in extra.items():
        init += "localStorage.setItem(%s,%s);" % (json.dumps(k), json.dumps(v))
    init += "}catch(e){}})();"

    failures = 0
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for d in devices:
                cw, ch, dpr, ua = DEVICES[d]
                ctx = browser.new_context(viewport={"width": cw, "height": ch}, device_scale_factor=dpr, is_mobile=True, has_touch=True,
                                          user_agent=ua, locale="vi-VN", timezone_id="Asia/Ho_Chi_Minh", color_scheme=a.color_scheme,
                                          service_workers="block", reduced_motion="reduce")
                ctx.add_init_script(init)
                page = ctx.new_page()
                page.goto(url, wait_until="load")
                page.wait_for_function("typeof goto === 'function'", timeout=30000)
                page.wait_for_timeout(a.wait_ms + 1500)
                outdir = os.path.join(a.out, d)
                os.makedirs(outdir, exist_ok=True)
                for i, (name, js) in enumerate(screens, 1):
                    try:
                        page.evaluate("()=>{ try{ if(typeof closeSheet === 'function') closeSheet(); }catch(e){} %s; var s = document.getElementById('app-scroll'); if(s) s.scrollTop = 0; window.scrollTo(0, 0); }" % js)
                        page.wait_for_timeout(a.wait_ms)
                        path = os.path.join(outdir, "%02d-%s.png" % (i, name))
                        page.screenshot(path=path, full_page=False)
                        got, want = png_size(path), expected_px(d)
                        if tuple(got) != tuple(want):
                            print("❌ %s: %s × %s, cần %s × %s" % (path, got[0], got[1], want[0], want[1]))
                            failures += 1
                        else:
                            print("✓ %s" % os.path.relpath(path, ROOT))
                    except Exception as e:      # một màn lỗi không dừng cả bộ
                        print("❌ %s/%s: %s" % (d, name, e))
                        failures += 1
                ctx.close()
            browser.close()
    finally:
        if srv:
            srv.shutdown()
    if failures:
        print("❌ %d ảnh lỗi" % failures)
        return 1
    print("✅ Xong — ảnh ở %s. Xem lại từng ảnh: không có dữ liệu thật, không có chữ 'demo', không có màn trống." % os.path.relpath(a.out, ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""TapEasy — ghép index.html + MỌI CSS/JS cục bộ (đúng thứ tự) thành 1 file HTML chạy độc lập.

  python3 scripts/build-single-html.py OUT.html                      # bản dùng thử (vd FitKit-dung-thu.html)
  python3 scripts/build-single-html.py OUT.html --test tests/browser/t_integrated.js   # + kịch bản kiểm thử trong trang
  Dữ liệu nạp lười (vòng 2, fkLazy): thẻ <script type="text/fk-lazy" data-group=… src=…> được NHÚNG + chạy ngay
  và đăng ký window.__fkLazyDone[src] = 1 ⇒ fkLazy.load('exdbvi'|'kb') resolve ngay (bản 1 file không có file rời).
  tuỳ chọn: --offline   bỏ font Google / script CDN (khung xem trước không tải mạng)
            --no-sw     (mặc định bật) chặn đăng ký service worker — file đơn không có sw.js
            --embed-shop nhúng ảnh sản phẩm assets/shop/*.webp (≈ 1,9 MB base64) vào window.__TE_INLINE_ASSETS —
                        shop.js ghép tên ảnh động nên không thay chuỗi được; shop.js tra bảng này qua assetSrc() (vòng 3)

- Ảnh cục bộ (assets/…) được nhúng base64 khi file tồn tại và ≤ 400 KB: trong CSS url(), thuộc tính HTML
  và chuỗi JS (vd "assets/brand/logo-mark.svg"). Ảnh chưa có (logo do agent thương hiệu làm) giữ nguyên
  đường dẫn → app tự hiện chữ "TapEasy" thay thế.
- "</script" trong mã JS được thoát thành "<\\/script".
"""
import base64, json, mimetypes, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAX_INLINE = 400 * 1024


def data_uri(rel):
    p = (ROOT / rel).resolve()
    try:
        p.relative_to(ROOT)
    except ValueError:
        return None
    if not p.is_file() or p.stat().st_size > MAX_INLINE:
        return None
    mime = mimetypes.guess_type(str(p))[0] or ("image/svg+xml" if p.suffix == ".svg" else "application/octet-stream")
    return f"data:{mime};base64," + base64.b64encode(p.read_bytes()).decode()


ASSET_RE = re.compile(r'(?<![\w/.-])((?:\./)?assets/[\w./-]+\.(?:png|jpe?g|svg|webp|gif))')


def inline_assets(text):
    cache = {}

    def rep(m):
        rel = m.group(1)
        if rel not in cache:
            cache[rel] = data_uri(rel.lstrip("./") if rel.startswith("./") else rel)
        return cache[rel] or rel
    return ASSET_RE.sub(rep, text)


def shop_assets_script():
    d = ROOT / "assets" / "shop"
    m = {}
    for f in sorted(d.glob("*.webp")):
        m["assets/shop/" + f.name] = "data:image/webp;base64," + base64.b64encode(f.read_bytes()).decode()
    import json
    return "<script>/* ảnh Gian hàng nhúng sẵn (build-single-html.py --embed-shop) */ window.__TE_INLINE_ASSETS = " + json.dumps(m) + ";</script>\n", len(m)


def build(out, test=None, offline=False, no_sw=True, embed_shop=False):
    html = (ROOT / "index.html").read_text(encoding="utf8")
    if offline:
        html = re.sub(r'<link[^>]+fonts\.(googleapis|gstatic)[^>]*>\s*', '', html)
        html = re.sub(r'<script src="https?://[^"]+"[^>]*></script>\s*', '', html)
    html = re.sub(r'<link rel="manifest"[^>]*>\s*', '', html)

    missing = []

    def css(m):
        href = m.group(1)
        p = ROOT / href
        if not p.exists():
            missing.append(href)
            return f'<!-- thiếu {href} -->'
        extra = ' data-pb-css' if href == "program-builder.css" else ''   # program-builder.js tự chèn <link> nếu không thấy CSS của nó
        return f'<style data-src="{href}"{extra}>\n' + inline_assets(p.read_text(encoding="utf8")) + '\n</style>'
    html = re.sub(r'<link rel="stylesheet" href="(?!https?:)([^"]+\.css)">', css, html)

    def js(m):
        src = m.group(1)
        p = ROOT / src
        if not p.exists():
            missing.append(src)
            return f'<!-- thiếu {src} -->'
        code = inline_assets(p.read_text(encoding="utf8")).replace("</script", "<\\/script")
        return f'<script data-src="{src}">\n' + code + '\n</script>'
    html = re.sub(r'<script src="(?!https?:)([^"]+\.js)"></script>', js, html)

    # Vòng 2 (ux, fkLazy): dữ liệu nạp lười <script type="text/fk-lazy" data-group="…" src="…"> — bản 1 file không có
    # file rời để tải ⇒ NHÚNG và chạy ngay tại chỗ, rồi đăng ký vào window.__fkLazyDone ⇒ fkLazy.load(nhóm) resolve ngay.
    lazy = []

    def lazy_js(m):
        attrs = m.group(1)
        src = (re.search(r'\bsrc="([^"]+\.js)"', attrs) or [None, None])[1]
        grp = (re.search(r'\bdata-group="([\w-]+)"', attrs) or [None, ""])[1]
        if not src:
            return m.group(0)
        p = ROOT / src
        if not p.exists():
            missing.append(src)
            return f'<!-- thiếu {src} -->'
        lazy.append(src)
        code = inline_assets(p.read_text(encoding="utf8")).replace("</script", "<\\/script")
        reg = f'\n;(window.__fkLazyDone = window.__fkLazyDone || {{}})[{json.dumps(src)}] = 1;'
        return f'<script data-src="{src}" data-fk-lazy="{grp}">\n' + code + reg + '\n</script>'
    html = re.sub(r'<script((?=[^>]*\btype="text/fk-lazy")[^>]*)></script>', lazy_js, html)
    if lazy:
        print(f"Nhúng {len(lazy)} file dữ liệu nạp lười (fkLazy, đăng ký sẵn): {', '.join(lazy)}")
    html = inline_assets(html)

    pre = ""
    if no_sw:
        pre += ('<script>/* bản 1 file: không có sw.js */ try{ if(navigator.serviceWorker){ '
                'Object.defineProperty(navigator.serviceWorker, "register", { value: ()=> Promise.resolve(null), configurable:true }); } }catch(e){}</script>\n')
    if test:
        pre += ('<script>window.__errs=[];window.addEventListener("error",e=>window.__errs.push((e.message||"")+" @"+(e.filename||"").slice(-30)+":"+(e.lineno||"")));'
                'window.addEventListener("unhandledrejection",e=>window.__errs.push("REJ: "+(e.reason&&(e.reason.stack||e.reason.message)||e.reason)));'
                '(function(){const ce=console.error;console.error=function(){try{window.__errs.push("console.error: "+[].map.call(arguments,a=>a&&a.stack||String(a)).join(" ").slice(0,300));}catch(e){}return ce.apply(console,arguments);};})();'
                '</script>\n')
    if embed_shop:
        sc, n = shop_assets_script()
        pre += sc
        print(f"Nhúng {n} ảnh Gian hàng")
    html = html.replace('<head>', '<head>\n' + pre, 1)
    if test:
        t = pathlib.Path(test)
        if not t.is_absolute():
            t = ROOT / t
        html = html.replace('</body>', '<script data-src="test">\n' + t.read_text(encoding="utf8") + '\n</script>\n</body>')
    pathlib.Path(out).write_text(html, encoding="utf8")
    print(f"Đã ghi {out} ({len(html)/1024:.0f} KB)" + (f" · thiếu: {', '.join(missing)}" if missing else ""))


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__); sys.exit(1)
    out = a[0]
    test = a[a.index("--test") + 1] if "--test" in a else None
    build(out, test=test, offline="--offline" in a, no_sw="--keep-sw" not in a, embed_shop="--embed-shop" in a)

#!/usr/bin/env python3
"""FIT KIT — sinh "lớp màu theo theme" cho themes.css từ style.css.

Vì sao cần: style.css còn ~490 màu viết cứng (hex / rgba) rải qua nhiều lớp ghi đè.
Script này đọc style.css, lấy MỌI khai báo thuộc nhóm màu (color, background*, border*,
outline*, box-shadow, text-shadow, fill, stroke, filter, accent/caret-color, biến --x có màu)
theo đúng thứ tự gốc, thay màu cứng bằng biến theme, rồi ghi lại với tiền tố
`:where(html.fk-themed)` (độ ưu tiên = 0) => mỗi luật mới có ĐÚNG độ ưu tiên như luật gốc
và đứng sau style.css nên thắng luật gốc; thứ tự ghi đè giữa các luật màu được giữ nguyên.
Lớp này chỉ bật khi <html> có class fk-themed (mọi theme khác "Mặc định").

Dùng:
  python3 scripts/gen_themes_layer.py                 # in lớp sinh ra (stdout)
  python3 scripts/gen_themes_layer.py --write         # thay đoạn giữa 2 dấu mốc trong themes.css
  python3 scripts/gen_themes_layer.py --inventory     # bảng màu cứng (markdown) cho docs
  python3 scripts/gen_themes_layer.py --modules       # lớp màu cho MỌI css module -> themes-modules.css
  python3 scripts/gen_themes_layer.py --modules a.css,b.css   # chỉ vài file
Chạy lại mỗi khi sửa màu trong style.css / css module.
Bỏ qua (giữ bảng màu riêng, không theo theme): xem SKIP_CSS và SKIP_SEL bên dưới
(vd. cửa hàng .tsx là lớp phủ nền sáng riêng — thẻ .sx- trong màn Sự kiện vẫn theo theme).
"""
import re, sys, os, bisect, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STYLE = os.path.join(ROOT, "style.css")
THEMES = os.path.join(ROOT, "themes.css")
MARK_A = "/* @generated:start — KHÔNG sửa tay đoạn này, chạy scripts/gen_themes_layer.py --write */"
MARK_B = "/* @generated:end */"

# ---------------------------------------------------------------- parser
def strip_comments(css):
    return re.sub(r'/\*.*?\*/', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), css, flags=re.S)

def parse(css):
    s = strip_comments(css); out = []; n = len(s)
    nl = [i for i, c in enumerate(s) if c == "\n"]
    def lineof(pos): return bisect.bisect_right(nl, pos - 1) + 1
    def split_decls(body, base):
        parts, cur, start, depth, q = [], "", 0, 0, None
        for idx, ch in enumerate(body):
            if q:
                cur += ch
                if ch == q: q = None
                continue
            if ch in "\"'": q = ch; cur += ch; continue
            if ch == "(": depth += 1
            elif ch == ")": depth -= 1
            if ch == ";" and depth == 0:
                parts.append((cur, start)); cur = ""; start = idx + 1
            else:
                cur += ch
        if cur.strip(): parts.append((cur, start))
        return [(p.strip(), base + st + len(p) - len(p.lstrip())) for p, st in parts if p.strip()]
    def block(i, ctx):
        while i < n:
            while i < n and s[i] in " \t\r\n": i += 1
            if i >= n: return i
            if s[i] == "}": return i + 1
            j, depth = i, 0
            while j < n and not (s[j] in "{;" and depth == 0):
                if s[j] == "(": depth += 1
                elif s[j] == ")": depth -= 1
                j += 1
            prelude = " ".join(s[i:j].split())
            if j >= n: return j
            if s[j] == ";": i = j + 1; continue
            if prelude.startswith(("@media", "@supports")):
                i = block(j + 1, prelude); continue
            k, depth = j + 1, 1
            while k < n and depth:
                if s[k] == "{": depth += 1
                elif s[k] == "}": depth -= 1
                k += 1
            body = s[j + 1:k - 1]
            if prelude.startswith("@"):
                out.append(dict(ctx=ctx, sel=prelude, decls=None, body=body, line=lineof(i), at=True))
            else:
                decls = []
                for part, pos in split_decls(body, j + 1):
                    if ":" not in part: continue
                    p, v = part.split(":", 1); p = p.strip(); v = " ".join(v.split())
                    imp = bool(re.search(r'!\s*important\s*$', v))
                    v = re.sub(r'\s*!\s*important\s*$', '', v)
                    decls.append((p, v, imp, lineof(pos)))
                out.append(dict(ctx=ctx, sel=prelude, decls=decls, line=lineof(i), at=False))
            i = k
        return i
    block(0, None)
    return out

# ---------------------------------------------------------------- phân loại
COLOR_LIT = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)|\bwhite\b')

def is_color_prop(p):
    if p.startswith("--"): return False  # xử lý riêng
    if p in ("color", "box-shadow", "text-shadow", "fill", "stroke", "filter", "accent-color", "caret-color",
             "text-decoration", "text-decoration-color", "-webkit-text-fill-color", "stop-color"):
        return True
    if p.startswith("background"): return True
    if p.startswith("border") and "radius" not in p and p not in ("border-spacing", "border-collapse"): return True
    if p.startswith("outline"): return True
    return False

def semantic(p):
    if p in ("color", "-webkit-text-fill-color", "caret-color", "text-decoration", "text-decoration-color", "accent-color"):
        return "text"
    if p.startswith("border") or p.startswith("outline"): return "line"
    return "fill"

def norm_hex(h):
    h = h.lower()
    if len(h) == 4: h = "#" + "".join(c * 2 for c in h[1:])
    return h

HEX = {  # màu đậm/thương hiệu -> biến
    "#061a24": "var(--navy)", "#0b2a33": "var(--navy-2)", "#114650": "var(--navy-3)", "#1b6a68": "var(--navy-4)",
    "#0e3038": "var(--navy-2)", "#1c4a52": "var(--navy-3)",
    "#5ee6c7": "var(--mint)", "#9af1dd": "var(--mint-2)", "#2fb99a": "var(--mint-3)",
    "#ff7a45": "var(--coral)", "#ffb08a": "var(--coral-2)", "#e0582a": "var(--coral-3)", "#ff9466": "var(--coral-4)",
    "#ff5a2e": "var(--coral-hot)",
    "#d6ecea": "rgba(var(--fk-ink-rgb),.84)", "#b0b8bc": "rgba(var(--fk-ink-rgb),.72)", "#6b7a80": "rgba(var(--fk-ink-rgb),.5)",
}
RGB = {  # bộ 3 kênh -> biến rgb
    (94, 230, 199): "--mint-rgb", (255, 122, 69): "--coral-rgb", (255, 176, 138): "--coral-2-rgb",
    (34, 52, 62): "--fk-sheet-1-rgb", (14, 28, 36): "--fk-sheet-2-rgb",
    # thẻ nổi tối của module (popup thành tích, bong bóng chat khi .lowfx) → theo màu sheet của theme (theme sáng = trắng)
    (36, 72, 82): "--fk-sheet-1-rgb", (8, 30, 40): "--fk-sheet-2-rgb", (20, 44, 56): "--fk-sheet-1-rgb",
}
OLD_DARK = {(6, 6, 6), (8, 8, 8), (10, 10, 10), (12, 12, 12), (20, 20, 30), (2, 10, 16)}
# phần tử nằm trên ảnh/video: nền tối giữ tối ở mọi theme (kể cả theme Sáng)
SCRIM_SEL = re.compile(r'(?<![\w-])\.(?:hero\b|wl|pp-|vp-|vplayer|vthumb|ld-media|mg-|auth-hero|stock)|#screen-ptprofile|#auth\b')
CORALISH = re.compile(r'var\(--(?:coral|primary)(?:-dark)?\)|#ff7a45|#ff9466|rgba\(255,\s*122,\s*69,\s*\.9', re.I)
MINTISH = re.compile(r'var\(--mint\)|var\(--success\)', re.I)
DARKBG = re.compile(r'var\(--navy\)|#061a24|#000\b|#000000|rgba\(0,\s*0,\s*0|#1877f2|#1f1f1f|#111\b', re.I)
SCRIMBG = re.compile(r'rgba\(6,\s*26,\s*36,\s*\.[5-9]', re.I)
ON_CORAL_SEL = re.compile(r'\.btn-primary \.material-symbols-rounded|\.cam-badge \.material-symbols-rounded|\.vp-play')
# đặc biệt: (selector, prop) -> giá trị (biến theo theme)
SPECIAL = {
    ("#toast", "background"): "rgba(var(--fk-toast-rgb),.94)",
    ("#toast", "color"): "var(--fk-toast-ink)",
    ("#toast .material-symbols-rounded", "color"): "var(--fk-toast-accent)",
    (".bottom-nav", "background"): "var(--fk-dock-bg)",
    (".topbar .icon-btn, .icon-btn", "background"): "var(--fk-chip-bg)",
    (".avatar-ini", "color"): "#fff",
}

def alpha_of(s):
    m = re.match(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)', s)
    r, g, b, a = m.groups(); return (int(r), int(g), int(b)), (a if a is not None else "1")

def map_value(sel, prop, val, rule_bg):
    sem = semantic(prop) if not prop.startswith("--") else "fill"
    if prop in ("fill", "stroke") and re.search(r'(^|[\s>])text\s*$', sel.split(",")[-1]):
        sem = "text"   # chữ SVG; còn lại fill/stroke là bề mặt (vd. đoạn trống của đồng hồ calo)
    key = (sel, "background" if prop.startswith("background") and prop in ("background", "background-color") else prop)
    if key in SPECIAL and (prop in ("background", "background-color", "color")):
        return SPECIAL[key]
    scrim = bool(SCRIM_SEL.search(sel))
    on_text = None
    if sem == "text":
        if CORALISH.search(rule_bg) or ON_CORAL_SEL.search(sel): on_text = "var(--on-coral)"
        elif MINTISH.search(rule_bg): on_text = "var(--on-mint)"
        elif DARKBG.search(rule_bg) or (scrim and SCRIMBG.search(rule_bg)): on_text = "#fff"
        # chữ màu navy trên nền mint/coral
        val = re.sub(r'var\(--navy(?:\s*,\s*#[0-9a-fA-F]+)?\)', "var(--on-mint)", val)

    def rep(m):
        lit = m.group(0)
        if lit.lower() == "white" or lit.startswith("#"):
            h = "#ffffff" if lit.lower() == "white" else norm_hex(lit)
            if h == "#ffffff":
                if sem == "text": return on_text or "var(--fk-ink)"
                return lit  # nền/viền trắng đặc (chip ảnh, nút Google...) giữ nguyên
            if h == "#061a24" and sem == "text": return "var(--on-mint)"
            return HEX.get(h, lit)
        rgb, a = alpha_of(lit)
        if rgb == (255, 255, 255):
            if sem == "text":
                if on_text == "#fff": return lit
                return f"rgba(var(--fk-ink-rgb),calc({a} + (1 - {a}) * var(--fk-text-boost)))"
            k = "--fk-line-k" if sem == "line" else "--fk-ov-k"
            return f"rgba(var(--fk-ov-rgb),calc({a} * var({k})))"
        if rgb == (6, 26, 36):
            return f"rgba(var({'--fk-scrim-rgb' if scrim else '--fk-veil-rgb'}),{a})"
        if rgb in OLD_DARK:
            return f"rgba(var(--fk-scrim-rgb),{a})"
        if rgb in RGB:
            return f"rgba(var({RGB[rgb]}),{a})"
        return lit
    out = COLOR_LIT.sub(rep, val)
    # var(--mint-2, #9AF1DD) → var(--mint-2, var(--mint-2)) là thừa → gộp về var(--mint-2)
    return re.sub(r'var\((--[\w-]+)\s*,\s*var\(\1\)\)', r'var(\1)', out)

def prefix_sel(sel):
    out = []
    for part in split_selectors(sel):
        p = part.strip()
        if p.startswith(":root"): out.append(":root:where(.fk-themed)" + p[5:])
        elif re.match(r'html\b', p): out.append("html:where(.fk-themed)" + p[4:])
        else: out.append(":where(html.fk-themed) " + p)
    return ", ".join(out)

def split_selectors(sel):
    parts, cur, depth = [], "", 0
    for ch in sel:
        if ch == "(": depth += 1
        elif ch == ")": depth -= 1
        if ch == "," and depth == 0: parts.append(cur); cur = ""
        else: cur += ch
    parts.append(cur)
    return parts

def generate(css, skip_sel=None):
    rules = parse(css)
    if skip_sel is not None:
        # bỏ luật mà MỌI selector con đều thuộc vùng có bảng màu riêng (vd. .tsx của cửa hàng)
        rules = [r for r in rules if r["at"] or not all(skip_sel.search(p) for p in split_selectors(r["sel"]))]
    custom_with_lit = set()
    for r in rules:
        if r["at"]: continue
        for p, v, imp, ln in r["decls"]:
            if p.startswith("--") and COLOR_LIT.search(v) and not r["sel"].startswith(":root"):
                custom_with_lit.add(p)
    # bỏ khai báo "chết": cùng @media + cùng selector + cùng thuộc tính bị khai báo lại phía sau
    # (độ quan trọng >= ) => chắc chắn bị ghi đè, không cần sao chép.
    last = {}
    for ri, r in enumerate(rules):
        if r["at"]: continue
        for di, (p, v, imp, ln) in enumerate(r["decls"]):
            last.setdefault((r["ctx"], r["sel"], p), []).append((ri, di, imp))
    dead = set()
    for key, lst in last.items():
        for idx, (ri, di, imp) in enumerate(lst):
            if any(imp2 or not imp for (_, _, imp2) in lst[idx + 1:]):
                dead.add((ri, di))
    out, last_ctx, count = [], None, 0
    for ri, r in enumerate(rules):
        if r["at"] or r["sel"].startswith(":root"): continue
        keep = [(p, v, imp, ln) for di, (p, v, imp, ln) in enumerate(r["decls"])
                if (is_color_prop(p) or p in custom_with_lit) and (ri, di) not in dead]
        if not keep: continue
        rule_bg = " ".join(v for p, v, _, _ in r["decls"] if p.startswith("background"))
        body = []
        for p, v, imp, ln in keep:
            if p in ("mask", "-webkit-mask"): continue
            nv = map_value(r["sel"], p, v, rule_bg)
            body.append(f"{p}:{nv}{' !important' if imp else ''}")
        if not body: continue
        line = f"{prefix_sel(r['sel'])}{{ {'; '.join(body)}; }} /*L{r['line']}*/"
        if r["ctx"] != last_ctx:
            if last_ctx: out.append("}")
            if r["ctx"]: out.append(r["ctx"] + "{")
            last_ctx = r["ctx"]
        out.append(("  " if r["ctx"] else "") + line); count += 1
    if last_ctx: out.append("}")
    return "\n".join(out), count

def inventory(css):
    rules = parse(css)
    inv = collections.OrderedDict()
    for r in rules:
        if r["at"]: continue
        for p, v, imp, ln in r["decls"]:
            if p in ("mask", "-webkit-mask"): continue
            for m in COLOR_LIT.finditer(v):
                lit = m.group(0)
                if lit.startswith("#"): k = norm_hex(lit)
                elif lit.lower() == "white": k = "#ffffff"
                else:
                    rgb, a = alpha_of(lit); k = "rgba(%d,%d,%d,·)" % rgb
                inv.setdefault(k, []).append(ln)
    rows = []
    for k, lines in sorted(inv.items(), key=lambda kv: -len(kv[1])):
        if k.startswith("#") and k in HEX: tgt = HEX[k]
        elif k == "#ffffff": tgt = "chữ → `var(--fk-ink)` / chữ trên coral → `var(--on-coral)`; nền trắng đặc giữ nguyên"
        elif k.startswith("rgba(255,255,255"): tgt = "chữ → `rgba(var(--fk-ink-rgb),a+boost)`; nền → `rgba(var(--fk-ov-rgb),a·k)`; viền → `…·--fk-line-k`"
        elif k.startswith("rgba(6,26,36"): tgt = "trên ảnh/video → `rgba(var(--fk-scrim-rgb),a)`; còn lại → `rgba(var(--fk-veil-rgb),a)`"
        else:
            m = re.match(r'rgba\((\d+),(\d+),(\d+)', k)
            rgb = tuple(int(x) for x in m.groups()) if m else None
            if rgb in RGB: tgt = f"`rgba(var({RGB[rgb]}),a)`"
            elif rgb in OLD_DARK: tgt = "`rgba(var(--fk-scrim-rgb),a)` (tông đen cũ)"
            elif k == "#061a24": tgt = "nền → `var(--navy)`; chữ → `var(--on-mint)`"
            else: tgt = "giữ nguyên (đen/xám trung tính, màu thương hiệu bên thứ ba hoặc :root cũ)"
        if k == "#061a24": tgt = "nền → `var(--navy)`; chữ → `var(--on-mint)`"
        ls = sorted(set(lines))
        shown = ", ".join(map(str, ls[:14])) + (f" … (+{len(ls)-14})" if len(ls) > 14 else "")
        rows.append(f"| `{k}` | {len(lines)} | {shown} | {tgt if tgt.startswith(('`','nền','chữ','trên','giữ')) else '`'+tgt+'`'} |")
    return "| Màu cứng | Số lần | Dòng trong style.css | Map sang |\n|---|---|---|---|\n" + "\n".join(rows)

def modules_layer(files):
    parts, total = [], 0
    for f in files:
        css = open(os.path.join(ROOT, f), encoding="utf-8").read()
        layer, count = generate(css, SKIP_SEL.get(f))
        total += count
        parts.append(f"/* ===== {f}: {count} luật ===== */\n{layer}")
    head = ("/* TapEasy — themes-modules.css (SINH TỰ ĐỘNG, đừng sửa tay)\n"
            "   Lớp màu theo theme cho CSS của các module. Nạp SAU CÙNG (sau mọi file .css module).\n"
            "   Tạo lại: python3 scripts/gen_themes_layer.py --modules [a.css,b.css]\n"
            f"   Nguồn: {', '.join(files)} — tổng {total} luật. */\n")
    return head + "\n".join(parts) + "\n", total

# file KHÔNG sinh lớp màu: lõi (đã có lớp riêng trong themes.css) + các lớp theme/thương hiệu tự dùng token
SKIP_CSS = {"style.css", "themes.css", "themes-modules.css", "ui-kit.css", "brand.css", "theme-packs.css", "ui-signature.css", "theme-accent.css"}  # theme-accent.css: đã chỉ dùng token
# selector bỏ qua theo file: vùng có bảng màu riêng có chủ đích
SKIP_SEL = {
    "shop.css": re.compile(r'(^|[\s>+~(,])(?:html)?\.tsx(?:-[\w-]+)?\b'),   # cửa hàng: lớp phủ toàn màn nền sáng riêng (giữ ở mọi theme)
    # bảng quản trị: lớp phủ LUÔN TỐI với token riêng --a-* (admin.css). Sinh lớp màu sẽ đổi --a-muted/--a-panel theo
    # --fk-ov-rgb → chữ mực tối trên nền navy ở theme Sáng / Thu Alpine. Giữ nguyên bảng màu gốc ở mọi theme.
    "admin.css": re.compile(r'\.adm(?:-[\w-]+)?\b'),
}

if __name__ == "__main__":
    if "--modules" in sys.argv:
        i = sys.argv.index("--modules")
        arg = sys.argv[i + 1] if len(sys.argv) > i + 1 and not sys.argv[i + 1].startswith("--") else ""
        files = [x for x in arg.split(",") if x] or sorted(f for f in os.listdir(ROOT) if f.endswith(".css") and f not in SKIP_CSS)
        text, total = modules_layer(files)
        open(os.path.join(ROOT, "themes-modules.css"), "w", encoding="utf-8").write(text)
        print(f"themes-modules.css: {total} luật từ {len(files)} file: {', '.join(files)}"); sys.exit(0)
    css = open(STYLE, encoding="utf-8").read()
    if "--inventory" in sys.argv:
        print(inventory(css)); sys.exit(0)
    layer, count = generate(css)
    head = f"/* Lớp màu sinh tự động từ style.css: {count} luật. Tiền tố :where() => độ ưu tiên giữ nguyên như gốc. */\n"
    if "--write" in sys.argv:
        t = open(THEMES, encoding="utf-8").read()
        a, b = t.index(MARK_A), t.index(MARK_B)
        t = t[:a + len(MARK_A)] + "\n" + head + layer + "\n" + t[b:]
        open(THEMES, "w", encoding="utf-8").write(t)
        print(f"themes.css: đã ghi {count} luật")
    else:
        print(head + layer)

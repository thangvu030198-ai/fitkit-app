/* =========================================================================
   Vòng sửa lỗi sau QA (11/11/2026) — fixer UX (hiệu năng · a11y · giao diện)
   Hồi quy cho docs/qa/QA-ux-performance.md (QU-xx) + QS-22 (CSP). Xem docs/qa/FIX-ux.md.
   File sở hữu: index.html, style.css, sw.js, ui-kit.js/.css, icons.js, brand.css, themes.js, themes.css,
   themes-modules.css, theme-packs.*, ui-signature.*, scripts/prepare-www.sh, scripts/build-single-html.py,
   manifest.json, landing.html, docs/GLOSSARY-vi.md §UI.
   Phần lớn là kiểm tĩnh (DOM shim của tests/ không tính CSS); phần chạy được: nạp app, fkTheme, sw.js, prepare-www.sh.
   ========================================================================= */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");
const { assert, expectNone } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const noComments = s=> s.replace(/\/\*[\s\S]*?\*\//g, "");

/* ---- tương phản WCAG ---- */
function lum(hex){
  const h = hex.replace("#", ""); const x = h.length === 3 ? h.split("").map(c=> c + c).join("") : h;
  return [0, 2, 4].map(i=> parseInt(x.slice(i, i + 2), 16) / 255)
    .map(v=> v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
    .reduce((a, v, i)=> a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const contrast = (a, b)=>{ const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hexOf = v=> (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i.exec((v || "").trim()) || [])[0];
/** token của từng khối :root[data-theme="…"] (theme gói hoặc theme cũ) — giá trị hex */
function themeTokens(css){
  const out = {};
  for(const m of noComments(css).matchAll(/:root\[data-theme="([a-z]+)"\]\s*\{([^}]*)\}/g)){
    const t = out[m[1]] = out[m[1]] || {};
    for(const d of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) t[d[1]] = d[2].trim();
  }
  return out;
}
/** khối Node nhúng trong prepare-www.sh (gộp CSS, sinh ASSETS cho sw.js) */
function prepareNode(){
  const sh = read("scripts/prepare-www.sh");
  const m = /node - <<'NODE_EOF'[^\n]*\n([\s\S]*?)\nNODE_EOF/.exec(sh);
  assert.ok(m, "prepare-www.sh thiếu khối node - <<'NODE_EOF'");
  return m[1];
}

module.exports = {
  name: "Vòng sửa lỗi QA — Trải nghiệm, hiệu năng, a11y (fix-ux)",
  area: "index.html · style.css · themes.* · ui-kit.* · sw.js · prepare-www.sh",
  async define(t){
    const html = read("index.html"), style = read("style.css"), themes = read("themes.css"), uk = read("ui-kit.js"),
      ukc = read("ui-kit.css"), sw = read("sw.js"), tjs = read("themes.js"), sh = read("scripts/prepare-www.sh");

    /* ---------------- QU-28: chữ trên nút coral đạt AA ở MỌI theme ---------------- */
    t.test("QU-28: --on-coral của theme Mặc định là navy (≥ 4,5:1 trên #FF7A45); style.css không còn chữ trắng cứng trên nền coral", ()=>{
      const root = /:root\{([\s\S]*?)\}/.exec(noComments(themes))[1];
      const on = hexOf((/--on-coral:([^;]+);/.exec(root) || [])[1]);
      assert.ok(on, "themes.css :root thiếu --on-coral dạng hex");
      assert.ok(contrast("#FF7A45", on) >= 4.5, `--on-coral ${on} trên coral chỉ ${contrast("#FF7A45", on).toFixed(2)}:1`);
      const css = noComments(style);
      for(const sel of [".btn-primary", ".nu-mini", ".wl-pill.gold", ".tpl-add"]){
        const rules = [...css.matchAll(new RegExp("(?:^|\\})\\s*" + sel.replace(/\./g, "\\.") + "\\{([^}]*)\\}", "g"))].map(m=> m[1]);
        const bad = rules.filter(r=> /background:var\(--coral\)/.test(r) && /(^|;|\s)color:#fff/i.test(r));
        assert.deepEqual(bad, [], sel + " còn chữ #fff trên coral");
      }
      assert.match(css, /\.btn-primary\{ background:var\(--coral\) !important; color:var\(--on-coral, #061A24\) !important; \}/);
    });
    t.test("QU-28: mọi theme cũ (Đại dương, Hoàng hôn, Rừng, Tím đêm, Sáng) + 5 gói giao diện: --on-coral/--coral ≥ 4,5:1", ()=>{
      const tok = Object.assign({}, themeTokens(themes), themeTokens(read("theme-packs.css")));
      const ids = ["ocean","sunset","forest","midnight","light","aurora","espresso","alpine","wellness","sanctuary"];
      const low = [];
      for(const id of ids){
        const t0 = tok[id]; assert.ok(t0, "không thấy token theme " + id);
        const bg = hexOf(t0["--coral"]), fg = hexOf(t0["--on-coral"]);
        assert.ok(bg && fg, id + " thiếu --coral/--on-coral hex");
        const c = contrast(bg, fg); if(c < 4.5) low.push(`${id}: ${fg} trên ${bg} = ${c.toFixed(2)}:1`);
      }
      expectNone(low, "theme trượt AA chữ trên CTA");
      // Gói có nút gradient riêng: chữ tối trên màu sáng nhất/đậm nhất của gradient
      const P = noComments(read("theme-packs.css"));
      for(const [id, stops, ink] of [["espresso", ["#FFA36C", "#F27A3B"], "#1A0A04"], ["alpine", ["#FBD06A", "#F6B733"], "#2E2D2A"]]){
        assert.ok(P.includes(`html[data-theme="${id}"] .btn-primary`), id);
        for(const s of stops) assert.ok(contrast(s, ink) >= 4.5, `${id} ${ink}/${s}`);
      }
    });
    t.test("QU-28: chạy thật — fkTheme.set() đổi đủ 11 theme không lỗi, theme Mặc định giữ --on-coral navy", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      assert.deepEqual(app.loadErrors.map(e=> e.file + ": " + e.error.message), []);
      for(const id of ["light","aurora","espresso","alpine","wellness","sanctuary","ocean","sunset","forest","midnight","navy"]){
        app.run(`fkTheme.set(${JSON.stringify(id)})`);
        assert.equal(app.ev("document.documentElement.getAttribute('data-theme')"), id);
      }
      assert.equal(app.ev("state.theme"), "navy");
      const errs = app.consoleLog.filter(c=> c[0] === "error" || (c[0] === "warn" && /\[themes\]/.test(c[1])));
      assert.deepEqual(errs, []);
    });

    /* ---------------- QU-12: đổi theme nhẹ hơn ---------------- */
    t.test("QU-12: thẻ Hồ sơ ngoài khung nhìn dùng content-visibility:auto (đổi theme chỉ tính phần đang thấy)", ()=>{
      assert.match(noComments(style), /#screen-profile \.content > \.card\{ content-visibility:auto; contain-intrinsic-size:auto 240px; \}/);
    });

    /* ---------------- QU-01 / QU-08: tài nguyên chặn render lúc mở ---------------- */
    t.test("QU-08: không còn JSZip đồng bộ trong <head>; Google Fonts ≤ 4 họ, nạp không chặn vẽ (media=print→all) + display=swap", ()=>{
      const head = html.slice(0, html.indexOf("</head>"));
      assert.ok(!/<script[^>]+jszip/i.test(head), "JSZip vẫn nạp đồng bộ trong <head>");
      const font = /<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"([^>]*)>/.exec(head);
      assert.ok(font, "không thấy link Google Fonts");
      const fams = [...font[1].matchAll(/family=([^:&]+)/g)].map(m=> m[1]);
      assert.ok(fams.length <= 4, "nạp " + fams.length + " họ font: " + fams.join(", "));
      for(const old of ["Oswald", "Be+Vietnam+Pro", "Hanken+Grotesk"]) assert.ok(!fams.includes(old), "còn nạp font cũ " + old);
      assert.match(font[1], /display=swap/);
      assert.match(font[2], /media="print" onload="this\.media='all'"/, "font Google vẫn chặn vẽ");
      // script ngoài trong <head> chỉ được async
      const ext = [...head.matchAll(/<script src="https?:[^"]+"([^>]*)>/g)].filter(m=> !/\basync\b/.test(m[1]));
      assert.deepEqual(ext.map(m=> m[0]), [], "script bên thứ ba đồng bộ trong <head>");
    });
    t.test("QU-08: loadJSZip() nạp khi cần (CDN có SRI + crossorigin, dự phòng vendor/), bọc buildBackupZip/restoreFromBackupZip", async ()=>{
      assert.match(uk, /window\.loadJSZip = function\(\)/);
      assert.match(uk, /JSZIP_SRI = "sha512-[A-Za-z0-9+/=]{80,}"/);
      assert.match(uk, /s\.crossOrigin = "anonymous"; s\.integrity = JSZIP_SRI/);
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      assert.equal(app.ev("typeof loadJSZip"), "function");
      assert.equal(app.ev("typeof JSZip"), "undefined", "JSZip không được nạp lúc mở app");
    });

    /* ---------------- QU-01 (một phần) + bước 11 kế hoạch: gộp + nén trong prepare-www.sh ---------------- */
    t.test("QU-01: prepare-www.sh gộp CSS đúng thứ tự → app.<băm>.css, giữ JS từng file, giữ dấu hiệu program-builder; www chạy lại được", ()=>{
      assert.match(sh, /BUNDLE="\$\{BUNDLE:-1\}"; MINIFY="\$\{MINIFY:-1\}"; MINIFY_JS="\$\{MINIFY_JS:-0\}"/);
      assert.match(sh, /npx --yes esbuild@0\.24/, "thiếu đường dùng esbuild khi CI có mạng");
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fkwww-"));
      try{
        const W = path.join(tmp, "www"); fs.mkdirSync(W);
        const refs = [...html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css|png|jpe?g|svg|ico|webp|json))"/g)].map(m=> m[1]).filter(f=> !/^(https?:|data:)/.test(f));
        for(const f of new Set(["index.html", "sw.js", "manifest.json", ...refs])){
          fs.mkdirSync(path.dirname(path.join(W, f)), { recursive:true }); fs.copyFileSync(path.join(ROOT, f), path.join(W, f)); }
        const out = cp.execFileSync(process.execPath, ["-"], { cwd: tmp, input: prepareNode(), env: Object.assign({}, process.env, { BUNDLE:"1", MINIFY:"1", MINIFY_JS:"0", ESBUILD:"" }) }).toString();
        assert.match(out, /✅ www\/index\.html/, out);
        const wh = fs.readFileSync(path.join(W, "index.html"), "utf8");
        const cssLinks = [...wh.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=> m[1]).filter(h=> !/^https?:/.test(h));
        assert.equal(cssLinks.length, 1, "còn " + cssLinks.length + " stylesheet cục bộ");
        assert.match(cssLinks[0], /^app\.[0-9a-f]{10}\.css$/);
        assert.ok(wh.includes("<style data-pb-css></style>"), "mất dấu hiệu CSS của program-builder.js");
        // JS: KHÔNG gộp (TDZ) — số <script src> cục bộ giữ nguyên
        const n = s=> [...s.matchAll(/<script src="(?!https?:)[^"]+"/g)].length;
        assert.equal(n(wh), n(html));
        // CSS gộp: thứ tự cascade giữ nguyên (luật đầu style.css trước luật cuối themes-modules.css), luật vẫn đủ
        const bundle = fs.readFileSync(path.join(W, cssLinks[0]), "utf8");
        const iA = bundle.indexOf(".btn-primary{background:var(--coral) !important;color:var(--on-coral,#061A24) !important}");
        const iB = bundle.indexOf(":where(html.fk-themed) .te-xp-badge{background:var(--coral);color:var(--on-coral)}");
        assert.ok(iA > 0 && iB > iA, "thứ tự/luật CSS trong bản gộp sai (" + iA + ", " + iB + ")");
        assert.ok(!/\/\*/.test(bundle.replace(/"[^"]*"|'[^']*'/g, "")), "bản gộp còn chú thích");
        assert.ok(/#app-scroll :is\(/.test(bundle), "bộ nén làm mất khoảng trắng tổ hợp con cháu trước :is()");
        // sw.js trong www: ASSETS sinh tự động + băm phiên bản, parse được, đủ file www/index.html dùng
        const wsw = fs.readFileSync(path.join(W, "sw.js"), "utf8");
        new Function(wsw);
        assert.match(wsw, /const CACHE = "fitkit-v\d+-[0-9a-f]{10}";/);
        const assets = [...(/const ASSETS = \[([\s\S]*?)\];/.exec(wsw)[1]).matchAll(/"\.\/([^"]+)"/g)].map(m=> m[1]);
        const need = [...wh.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=> m[1]).filter(f=> !/^https?:/.test(f));
        expectNone(need.filter(f=> !assets.includes(f)), "www/sw.js thiếu");
        expectNone(assets.filter(f=> !fs.existsSync(path.join(W, f))), "www/sw.js trỏ tới file không có");
      } finally { fs.rmSync(tmp, { recursive:true, force:true }); }
    }, { timeout: 30000 });
    t.test("QU-01: bộ nén CSS an toàn — giữ chuỗi, calc(), tổ hợp con cháu; bỏ chú thích", ()=>{
      const code = prepareNode();
      const fn = new Function(/function minCss\(src\)\{[\s\S]*?\n\}/.exec(code)[0] + "\nreturn minCss;")();
      const src = `/* a */ .a  :is(.b, .c) > .d {  width: calc(100% - 2px) ;  content: "x  /* y */  z" ; }\n\n@media (min-width:600px){ .e{ color:#fff; } }`;
      // ":" giữ nguyên khoảng trắng (".a :is()" khác ".a:is()") — chỉ gộp còn 1 dấu cách
      assert.equal(fn(src), `.a :is(.b,.c) > .d{width: calc(100% - 2px);content: "x  /* y */  z"}@media (min-width:600px){.e{color:#fff}}`);
    });

    /* ---------------- QU-09: service worker ---------------- */
    t.test("QU-09: sw.js — HTML mạng trước có hạn giờ 3 s, JS/CSS/ảnh stale-while-revalidate, font cache-first, cài từng file", ()=>{
      new Function(sw);
      assert.match(sw, /const HTML_TIMEOUT_MS = 3000;/);
      assert.match(sw, /function staleWhileRevalidate\(e(?:, name)?\)/);
      assert.match(sw, /return e\.respondWith\(networkFirstHTML\(e\)\)/);
      assert.match(sw, /return e\.respondWith\(staleWhileRevalidate\(e(?:, CACHE)?\)\)/);
      assert.match(sw, /fonts\.gstatic\.com"\) return e\.respondWith\(cacheFirst\(e, FONT_CACHE\)\)/);
      assert.match(sw, /ASSETS\.map\(u=>[\s\S]{0,200}c\.put\(u, res\)[\s\S]{0,40}\.catch\(\(\)=>\{\}\)/, "precache phải lưu từng file");
      assert.match(sh, /Luôn làm: sinh lại danh sách ASSETS \+ băm phiên bản cache trong www\/sw\.js/);
    });

    /* ---------------- QU-27 / QU-33 / QU-30 / QU-35: a11y ---------------- */
    t.test("QU-27: 24/24 nút icon trong index.html có aria-label; ui-kit tự gắn tên cho nút icon do module sinh", ()=>{
      const btns = [...html.matchAll(/<button[^>]*class="[^"]*icon-btn[^"]*"[^>]*>/g)].map(m=> m[0]);
      assert.ok(btns.length >= 20, "chỉ thấy " + btns.length + " nút icon");
      expectNone(btns.filter(b=> !/aria-label="[^"]+"/.test(b)), "nút icon thiếu aria-label");
      for(const [ic, lb] of [["menu","Mở menu"],["arrow_back","Quay lại"],["refresh","Làm mới"],["tune","Chỉnh mục tiêu"],["account_circle","Hồ sơ"]])
        assert.ok(new RegExp(ic + ':"' + lb + '"').test(uk), "ICON_LABELS thiếu " + ic);
    });
    t.test("QU-33: nhãn chung ('Thêm', 'Sửa', 'CSV'…) được thêm ngữ cảnh — nhãn vẫn chứa chữ hiển thị (WCAG 2.5.3)", ()=>{
      assert.match(uk, /const GENERIC = \/\^\(thêm\|sửa\|xoá\|xóa\|csv\|yêu thích/);
      assert.match(uk, /el\.setAttribute\("aria-label", text \+ " – " \+ c\)/);
      assert.match(uk, /im\.setAttribute\("alt", t \? "" : \(contextOf\(im\) \|\| ""\)\)/, "ảnh thiếu alt chưa được xử lý");
    });
    t.test("QU-30: thẻ chọn dạng div (.choice-card, .role-card, .metric, .streak-chip, .toggle) → role + tabindex + Enter/Space", ()=>{
      assert.match(uk, /const KBD_SEL = "\.choice-card, \.role-card, \.metric, \.streak-chip, \.toggle/);
      assert.match(uk, /el\.classList\.contains\("toggle"\) \? "switch" : el\.classList\.contains\("choice-card"\) \? "radio" : "button"/);
      assert.match(uk, /e\.key !== "Enter" && e\.key !== " "/);
    });
    t.test("QU-35: <main id=app-scroll>, h1 ẩn theo màn, link 'Bỏ qua tới nội dung', viền focus chung, aria-current ở thanh dưới", async ()=>{
      assert.match(html, /<main id="app-scroll" tabindex="-1" aria-labelledby="fk-page-title">/);
      assert.match(html, /<\/main><!-- \/#app-scroll -->/);
      assert.match(html, /<h1 class="fk-sr" id="fk-page-title">/);
      assert.match(html, /<a class="fk-skip" href="#app-scroll">Bỏ qua tới nội dung chính<\/a>/);
      assert.match(ukc, /:focus-visible\{\s*outline:2px solid var\(--mint, #33D6C9\)/);
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      app.run("fkA11y.syncScreen('nutrition')");
      assert.equal(app.ev("document.getElementById('fk-page-title').textContent"), "TapEasy — Dinh dưỡng");
      assert.equal(app.ev("document.documentElement.getAttribute('data-screen')"), "nutrition");
    });

    /* ---------------- QU-31 / QU-32: cỡ chữ + vùng chạm ---------------- */
    t.test("QU-31 / QU-32: nhãn dải tuần + chip chuỗi 12 px; nút icon thanh trên, tab ngày, nút 'Thêm' món ≥ 44 px", ()=>{
      const css = noComments(style);
      assert.match(css, /\.wd small, \.streak-chip small\{ font-size:12px;/);
      assert.match(css, /\.topbar \.icon-btn\{ box-sizing:border-box; width:44px; height:44px; min-width:44px;/);
      assert.match(css, /\.day-tab\{ min-width:44px; min-height:44px;/);
      assert.match(css, /\.nu-mini\{ box-sizing:content-box; width:34px; height:34px; padding:5px;/);   // 34 + 2×5 = 44
      assert.match(css, /\.nav-item\{ min-height:44px; \}/);
    });

    /* ---------------- QU-04 / QU-34 / QU-05 / QU-10: chuyển động, máy yếu, ảnh ---------------- */
    t.test("QU-04 / QU-34: video nền màn chào có nút Tạm dừng 44 px; giảm chuyển động / tiết kiệm dữ liệu / máy yếu → không phát video; hoạt ảnh vô hạn có giới hạn lượt", ()=>{
      assert.match(uk, /btn\.className = "fk-vid-toggle"/);
      assert.match(uk, /"Tạm dừng video nền" : "Phát video nền"/);
      assert.match(uk, /if\(lowMedia\(\)\)\{\s+\/\/ giảm chuyển động/);
      assert.match(ukc, /\.fk-vid-toggle\{[^}]*width:var\(--fk-tap\); height:var\(--fk-tap\)/);
      assert.match(ukc, /@media \(prefers-reduced-motion: reduce\)\{ \.wl-hero-video, \.wl-credit\{ display:none !important; \} \}/);
      const css = noComments(style);
      for(const s of [".wl-speed i{ will-change:transform; animation-iteration-count:4; }", ".wl-hero-bg{ animation-iteration-count:2; }"]) assert.ok(css.includes(s), s);
    });
    t.test("QU-05: bật html.lowfx / fk-lowmedia ngay trong <head> (themes.js) theo RAM/lõi/Save-Data; danh sách dài dùng content-visibility", async ()=>{
      assert.match(tjs, /root\.classList\.toggle\("lowfx", low\)/);
      assert.match(tjs, /\(nav\.hardwareConcurrency \|\| 8\) <= 4 \|\| \(nav\.deviceMemory \|\| 8\) <= 4/);
      assert.match(ukc, /:is\(\.fp-card, \.cm-card, \.kb-card, \.exlib-row, \.tpl-card, \.np-row, \.food-result\)\{ content-visibility:auto;/);
      // máy yếu giả lập → lowfx bật ngay khi nạp themes.js
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      app.run("navigator.hardwareConcurrency = 4; navigator.deviceMemory = 2; document.documentElement.classList.remove('lowfx')");
      app.run(read("themes.js"), path.join(ROOT, "themes.js"));
      assert.equal(app.ev("document.documentElement.classList.contains('lowfx')"), true);
    });
    t.test("QU-10: ảnh chèn động nhận loading=lazy + decoding=async (trừ hero / fetchpriority=high)", ()=>{
      assert.match(uk, /im\.setAttribute\("loading", "lazy"\)/);
      assert.match(uk, /im\.getAttribute\("fetchpriority"\) === "high" \|\| im\.closest\("\.hero, \.wl-hero, \.home-hero, \.splash, \.topbar"\)/);
    });

    /* ---------------- QU-26: ngoại tuyến ---------------- */
    t.test("QU-26: dải 'Đang ngoại tuyến' chung (role=status, aria-live) bật theo sự kiện offline/online", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      assert.equal(app.ev("typeof fkOffline"), "function");
      app.run("fkOffline(true)");
      const el = "document.getElementById('fk-offline')";
      assert.equal(app.ev(`${el}.getAttribute('role')`), "status");
      assert.ok(/Đang ngoại tuyến/.test(app.ev(`${el}.innerHTML`)));
      assert.ok(app.ev(`${el}.classList.contains('on')`));
      app.run("fkOffline(false)");
      assert.ok(/Đã có mạng trở lại/.test(app.ev(`${el}.innerHTML`)));
      const w = app.ev("Object.keys(globalThis.__winListeners || {})");
      assert.ok(w.includes("offline") && w.includes("online"), "chưa lắng nghe online/offline");
    });

    /* ---------------- QU-36: màn rộng ---------------- */
    t.test("QU-36 (một phần): ≥ 1024 px — dashboard PT / học viên mở khung rộng, Cửa hàng lưới 4 cột", ()=>{
      const c = noComments(ukc);
      const m = /@media \(min-width:1024px\)\{([\s\S]*?)\n\}/.exec(c);
      assert.ok(m, "ui-kit.css thiếu khối @media (min-width:1024px)");
      for(const s of ["coach","client"]) assert.ok(m[1].includes(`[data-screen="${s}"]`), s);
      assert.match(m[1], /#app-shell\{ max-width:min\(1120px, 94vw\); \}/);
      assert.match(m[1], /  \.tsx-grid\{ grid-template-columns:repeat\(4, minmax\(0, 1fr\)\); \}/);   // lớp phủ Cửa hàng
      assert.match(uk, /ROOT\.setAttribute\("data-screen", name\)/);
    });

    /* ---------------- QU-24 / QU-25: thuật ngữ ---------------- */
    t.test("QU-24 / QU-25: GLOSSARY-vi.md có §UI (một khái niệm = một tên, thuật ngữ Anh → Việt, quy tắc chữ); index.html + ui-kit dùng đúng tên", ()=>{
      const g = read("docs/GLOSSARY-vi.md");
      assert.match(g, /## 8\. Thuật ngữ giao diện \(§UI\)/);
      for(const w of ["**Giáo án**", "**Tiến độ**", "**Cửa hàng**", "**Sự kiện**", "**Hồ sơ**", "**Tuần giảm tải**", "**Độ nặng cảm nhận (RPE 1–10)**"]) assert.ok(g.includes(w), "§UI thiếu " + w);
      const visible = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
      for(const bad of ["Tiến trình", "Gian hàng", "TapEasy Store", "Chương trình của tôi", "Routine", "Hồ sơ của tôi"]) assert.ok(!visible.includes(bad), "index.html còn '" + bad + "'");
      assert.match(uk, /shop:"Cửa hàng"/);
      assert.match(uk, /progress:"Tiến độ"/);
    });

    /* ---------------- QS-22: CSP ---------------- */
    t.test("QS-22: index.html có Content-Security-Policy (object-src 'none', base-uri 'self', không 'unsafe-eval')", ()=>{
      const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
      assert.ok(m, "thiếu CSP");
      assert.match(m[1], /object-src 'none'/);
      assert.match(m[1], /base-uri 'self'/);
      assert.ok(!/unsafe-eval/.test(m[1]), "CSP cho phép unsafe-eval");
      assert.match(m[1], /script-src 'self'[^;]*https:\/\/cdnjs\.cloudflare\.com/, "loadJSZip cần cdnjs trong script-src");
    });

    /* ---------------- Ràng buộc thứ tự nạp (test cũ 00-boot / 50-theme-packs) vẫn giữ ---------------- */
    t.test("Thứ tự nạp: themes.js trong <head>, health-safety.js cuối, brand.css → themes-modules.css cuối cùng; app nạp không lỗi", async ()=>{
      const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)].map(m=> m[1]).filter(h=> !/^https?:/.test(h));
      assert.deepEqual(css.slice(-2), ["brand.css", "themes-modules.css"]);
      assert.equal(css[0], "style.css"); assert.equal(css[1], "themes.css");
      assert.ok(html.indexOf('<script src="themes.js">') < html.indexOf("</head>"));
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      assert.equal(app.order[app.order.length - 1], "health-safety.js");
      assert.deepEqual(app.loadErrors.map(e=> e.file + ": " + e.error.message), []);
    });

    /* =====================================================================
       VÒNG 2 (HANDOFF-ROUND-BRIEF, mục ux) — xem docs/qa/FIX-ux.md §"Vòng 2"
       ===================================================================== */
    const LAZY = { exdbvi: ["exdb-vi-1.js", "exdb-vi-2.js", "exdb-vi-3.js"],
      kb: ["kb-data-1.js", "kb-data-2.js", "kb-data-3.js", "kb-data-4.js", "kb-data-5.js", "kb-data-6.js"] };
    const LAZY_ALL = [...LAZY.exdbvi, ...LAZY.kb];
    const lazyJs = read("fk-lazy.js");
    /** app KHÔNG nạp sẵn dữ liệu lười (giống trình duyệt: thẻ type="text/fk-lazy" không chạy); _inject = chạy file trong vm */
    async function lazyApp(failOn){
      const vm = require("vm");
      const { scriptOrder } = require("../lib/harness");
      const app = await t.app({ state:{ onboarded:true, authDone:true }, scripts: scriptOrder().filter(f=> !LAZY_ALL.includes(f)) });
      const log = []; const fail = new Set([].concat(failOn || []));
      app.ctx.__inj = src=>{
        log.push(src);
        if(fail.has(src)) return Promise.reject(new Error("mất mạng giả: " + src));
        new vm.Script(fs.readFileSync(path.join(ROOT, src), "utf8"), { filename: src }).runInContext(app.ctx);
        return Promise.resolve();
      };
      app.run("fkLazy._inject = function(s){ return __inj(s); }");
      return { app, log, fail };
    }

    t.test("R2-LAZY-01 (QU-01): fk-lazy.js trong <head> ngay sau themes.js; 9 file dữ liệu là KHAI BÁO type=\"text/fk-lazy\" đúng nhóm, đúng vị trí cũ; vẫn precache + chép www", ()=>{
      const head = html.slice(0, html.indexOf("</head>"));
      assert.ok(head.includes('<script src="themes.js"></script>') && head.indexOf('<script src="fk-lazy.js">') > head.indexOf('<script src="themes.js">'), "fk-lazy.js phải ở <head>, sau themes.js");
      const decl = [...html.matchAll(/<script type="text\/fk-lazy" data-group="([\w-]+)" src="([^"]+)"><\/script>/g)].map(m=> [m[1], m[2]]);
      const groups = {}; decl.forEach(([g, f])=> (groups[g] = groups[g] || []).push(f));
      assert.deepEqual(groups, LAZY, "khai báo nhóm trong index.html");
      for(const f of LAZY_ALL){
        assert.ok(!html.includes(`<script src="${f}"></script>`), f + " vẫn chạy ngay lúc mở app");
        assert.ok(fs.existsSync(path.join(ROOT, f)), "thiếu file " + f);
        assert.ok(sw.includes(`"./${f}"`), "sw.js không precache " + f);
        assert.ok(sh.split(/\s+/).includes(f), "prepare-www.sh không chép " + f);
      }
      assert.ok(sw.includes('"./fk-lazy.js"') && sh.split(/\s+/).includes("fk-lazy.js"), "fk-lazy.js chưa vào sw.js / prepare-www.sh");
      assert.ok(Number((/const CACHE = "fitkit-v(\d+)"/.exec(sw) || [])[1]) >= 8, "đổi file nạp → tăng phiên bản cache (≥ v8)");
      // danh sách dự phòng trong fk-lazy.js khớp khai báo
      for(const [g, files] of Object.entries(LAZY)) assert.ok(lazyJs.includes(`${g}: [${files.map(f=> JSON.stringify(f)).join(", ")}]`) || lazyJs.includes(`${g}: [${files.map(f=> JSON.stringify(f)).join(",")}]`), "GROUPS." + g + " lệch index.html");
      // exdb-vi.js (mã ghi đè hàm) vẫn nạp sẵn, sau dữ liệu khai báo
      assert.ok(html.indexOf('<script src="exdb-vi.js"></script>') > html.indexOf('src="exdb-vi-3.js"'));
    });

    t.test("R2-LAZY-02 (QU-01): mở app KHÔNG chạy dữ liệu; fkLazy.load('kb') nạp tuần tự đúng thứ tự, gọi trùng = 1 lần; xong → loaded() + dữ liệu đủ; Kho kiến thức vẽ được", async ()=>{
      const { app, log } = await lazyApp();
      assert.deepEqual(app.loadErrors.map(e=> e.file + ": " + e.error.message), []);
      assert.equal(app.ev("typeof fkLazy.load"), "function");
      assert.deepEqual(app.evj("fkLazy.groups()"), ["exdbvi", "kb"]);
      assert.equal(app.ev("(window.KB_ARTICLES || []).length"), 0, "kb-data đã chạy lúc mở app");
      assert.equal(app.ev("Object.keys(window.EXDB_VI || {}).length"), 0, "exdb-vi-* đã chạy lúc mở app");
      assert.equal(app.ev("fkLazy.loaded('kb')"), false);
      await app.run("Promise.all([fkLazy.load('kb'), fkLazy.load('kb')])");
      assert.deepEqual(log, LAZY.kb, "thứ tự / số lần chèn");
      assert.equal(app.ev("fkLazy.loaded('kb')"), true);
      const n = app.ev("KB_ARTICLES.length");
      assert.ok(n >= 50 && app.ev("KB_GLOSSARY.length") > 0 && app.ev("KB_FAQ.length") > 0);
      await app.run("fkLazy.load('kb')"); assert.equal(log.length, 6, "đã nạp vẫn chèn lại");
      await app.run("fkLazy.load('exdbvi')");
      assert.deepEqual(log.slice(6), LAZY.exdbvi);
      assert.ok(app.ev("Object.keys(EXDB_VI).length") >= 800);
      // bên tiêu thụ (commerce kb.js): mở Kho kiến thức sau khi nạp → có bài
      app.run("goto('kb')"); await app.settle(30);
      assert.equal(app.ev("KB_ARTICLES.length"), n, "nhân đôi bài");
    });

    t.test("R2-LAZY-03 (QU-01): lỗi mạng → reject (module hiện Thử lại); thử lại chỉ tải file còn thiếu, KHÔNG nhân đôi bài", async ()=>{
      const { app, log, fail } = await lazyApp("kb-data-3.js");
      const r1 = await app.run("fkLazy.load('kb').then(()=> 'ok', e=> 'lỗi: ' + e.message)");
      assert.match(r1, /^lỗi: mất mạng giả: kb-data-3\.js/);
      assert.equal(app.ev("fkLazy.loaded('kb')"), false);
      fail.clear();
      await app.run("fkLazy.load('kb')");
      assert.deepEqual(log, ["kb-data-1.js", "kb-data-2.js", "kb-data-3.js", "kb-data-3.js", "kb-data-4.js", "kb-data-5.js", "kb-data-6.js"]);
      const ids = app.evj("KB_ARTICLES.map(a=> a.id)");
      assert.equal(new Set(ids).size, ids.length, "bài bị nạp 2 lần");
      const r2 = await app.run("fkLazy.load('khong-co').then(()=> 'ok', e=> e.message)");
      assert.match(r2, /không có nhóm/);
    });

    t.test("R2-LAZY-04 (QU-01): dữ liệu đã có sẵn (thẻ thường / bản cũ / test) hoặc bản ghép đăng ký __fkLazyDone → resolve ngay, không chèn thẻ", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });       // harness nạp MỌI src= (kể cả khai báo lười)
      let n = 0; app.ctx.__inj = ()=>{ n++; return Promise.resolve(); };
      app.run("fkLazy._inject = function(s){ return __inj(s); }");
      await app.run("Promise.all([fkLazy.load('kb'), fkLazy.load('exdbvi')])");
      assert.equal(n, 0, "dữ liệu có sẵn mà vẫn tải lại");
      assert.equal(app.ev("fkLazy.loaded('kb') && fkLazy.loaded('exdbvi')"), true);
      // bản ghép: file đã nhúng + đăng ký → không tải
      const { app: a2, log } = await lazyApp();
      a2.run(`${JSON.stringify(LAZY.exdbvi)}.forEach(f=> window.__fkLazyDone[f] = 1)`);
      await a2.run("fkLazy.load('exdbvi')");
      assert.deepEqual(log, []);
    });

    t.test("R2-LAZY-05 (QU-01): build-single-html.py nhúng + chạy 9 file dữ liệu và đăng ký window.__fkLazyDone (fkLazy.load resolve ngay)", ()=>{
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fksingle-"));
      try{
        const out = path.join(tmp, "one.html");
        let py = null;
        try{ py = cp.execFileSync("python3", [path.join(ROOT, "scripts", "build-single-html.py"), out, "--offline"], { cwd: ROOT, timeout: 60000 }).toString(); }
        catch(e){ if(e.code === "ENOENT") return; throw e; }                                   // máy không có python3 → bỏ qua
        assert.match(py, /Nhúng (?:9|1[0-9]) file dữ liệu nạp lười/);   // R3: + từ điển i18n-en*.js
        const one = fs.readFileSync(out, "utf8");
        assert.ok(!/<script type="text\/fk-lazy"[^>]*><\/script>/.test(one), "còn thẻ khai báo chưa nhúng");
        for(const f of LAZY_ALL){
          assert.ok(one.includes(`<script data-src="${f}" data-fk-lazy=`), "chưa nhúng " + f);
          assert.ok(one.includes(`(window.__fkLazyDone = window.__fkLazyDone || {})["${f}"] = 1;`), "chưa đăng ký " + f);
        }
        assert.ok(one.indexOf('data-src="kb-data-6.js"') < one.indexOf('data-src="kb.js"'), "thứ tự nhúng");
      } finally { fs.rmSync(tmp, { recursive:true, force:true }); }
    }, { timeout: 60000 });

    t.test("R2-LAZY-06 (QU-01): prepare-www.sh — file nạp lười vẫn có trong www/ và trong ASSETS của www/sw.js", ()=>{
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fkwww2-"));
      try{
        const W = path.join(tmp, "www"); fs.mkdirSync(W);
        const refs = [...html.matchAll(/(?:src|href)="([^"#?]+\.(?:js|css|png|jpe?g|svg|ico|webp|json))"/g)].map(m=> m[1]).filter(f=> !/^(https?:|data:)/.test(f));
        for(const f of new Set(["index.html", "sw.js", "manifest.json", ...refs])){
          fs.mkdirSync(path.dirname(path.join(W, f)), { recursive:true }); fs.copyFileSync(path.join(ROOT, f), path.join(W, f)); }
        const out = cp.execFileSync(process.execPath, ["-"], { cwd: tmp, input: prepareNode(), env: Object.assign({}, process.env, { BUNDLE:"1", MINIFY:"1", MINIFY_JS:"0", ESBUILD:"" }) }).toString();
        assert.match(out, /Nạp lười \(fkLazy\): 9 file/);
        const wsw = fs.readFileSync(path.join(W, "sw.js"), "utf8");
        const assets = [...(/const ASSETS = \[([\s\S]*?)\];/.exec(wsw)[1]).matchAll(/"\.\/([^"]+)"/g)].map(m=> m[1]);
        expectNone(LAZY_ALL.concat("fk-lazy.js").filter(f=> !assets.includes(f)), "www/sw.js không precache");
        const wh = fs.readFileSync(path.join(W, "index.html"), "utf8");
        assert.equal((wh.match(/<script type="text\/fk-lazy"/g) || []).length, 9, "www/index.html mất khai báo nạp lười");
      } finally { fs.rmSync(tmp, { recursive:true, force:true }); }
    }, { timeout: 30000 });

    t.test("SEC-6 (FIX-security #6): prepare-www.sh — STORE_BUILD=1 + firebase-config.js trống → DỪNG; mặc định chỉ cảnh báo; có cấu hình → qua", ()=>{
      const m = /\nfb_empty=0\n[\s\S]*?\nfi\n(?:[^\n]*\n)*?fi\n/.exec(sh);
      assert.ok(m, "thiếu khối kiểm firebase-config.js");
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fkstore-"));
      try{
        const run = (cfg, env)=>{
          if(cfg == null){ try{ fs.unlinkSync(path.join(tmp, "firebase-config.js")); }catch(e){} }
          else fs.writeFileSync(path.join(tmp, "firebase-config.js"), cfg);
          try{ return { code: 0, out: cp.execFileSync("bash", ["-c", "set -e\n" + m[0] + "\necho QUA"], { cwd: tmp, env: Object.assign({}, process.env, env) }).toString() }; }
          catch(e){ return { code: e.status, out: String(e.stdout || "") + String(e.stderr || "") }; }
        };
        const empty = read("firebase-config.js").replace(/\b(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId):\s*"[^"]*"/g, '$1: ""');   // R3: file thật đã có cấu hình → tự làm rỗng để thử nhánh "trống"
        let r = run(empty, { STORE_BUILD:"1" }); assert.equal(r.code, 1, r.out); assert.match(r.out, /STORE_BUILD=1 nhưng firebase-config\.js trống/);
        r = run(null, { STORE_BUILD:"1" }); assert.equal(r.code, 1, "thiếu file mà vẫn qua");
        r = run(empty, { STORE_BUILD:"0" }); assert.equal(r.code, 0, r.out); assert.match(r.out, /CHẾ ĐỘ DEMO[\s\S]*QUA/);
        const full = empty.replace(/apiKey:\s*""/, 'apiKey: "AIzaFAKE"').replace(/projectId:\s*""/, 'projectId: "tapeasy-x"').replace(/appId:\s*""/, 'appId: "1:2:web:3"');
        r = run(full, { STORE_BUILD:"1" }); assert.equal(r.code, 0, r.out); assert.ok(!/DEMO/.test(r.out) && /QUA/.test(r.out));
      } catch(e){ if(e.code === "ENOENT") return; throw e; }
      finally { fs.rmSync(tmp, { recursive:true, force:true }); }
    });

    t.test("NU-4 (FIX-nutrition #4): đã cuộn #app-scroll → html.fk-scrolled → thanh trên dính có nền theo theme; về đầu → bỏ", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const fns = app.dom._listeners.scroll || [];
      assert.ok(fns.length, "ui-kit.js chưa nghe scroll");
      const fire = top=> fns.forEach(fn=>{ try{ fn({ target:{ id:"app-scroll", scrollTop: top } }); }catch(e){} });
      fire(240); assert.equal(app.ev("document.documentElement.classList.contains('fk-scrolled')"), true);
      fire(0);   assert.equal(app.ev("document.documentElement.classList.contains('fk-scrolled')"), false);
      const css = noComments(ukc);
      const rule = /html\.fk-scrolled #app-scroll > \.screen\.active > \.topbar:not\(\.transparent\)\{([^}]*)\}/.exec(css);
      assert.ok(rule, "thiếu luật nền thanh trên khi đã cuộn");
      assert.match(rule[1], /background:rgba\(var\(--fk-veil-rgb, 6,26,36\), \.9\d?\) !important/, "nền phải theo token theme, gần đặc");
      assert.ok(!/backdrop-filter/.test(rule[1]), "phần tử dính không được blur (QU-05)");
      assert.match(uk, /syncScreen[\s\S]*fkSyncScrolled\(\)/, "đổi màn phải tính lại trạng thái cuộn");
    });

    t.test("PT-3 (FIX-pt QP-20/QP-23): style.css gốc — .pp-glass/.pp-chips span/.pp-cta không blur; .stat-box .cap ≥ 12 px; .seg button ≥ 44 px", ()=>{
      const css = noComments(style);
      const rule = sel=> [...css.matchAll(new RegExp("(?:^|\\})\\s*" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\{([^}]*)\\}", "g"))].map(m=> m[1]).join(";");
      for(const sel of [".pp-glass", ".pp-chips span", ".pp-cta", ".pp-nav", ".pp-nav > *"]) assert.ok(!/backdrop-filter/.test(rule(sel)), sel + " còn backdrop-filter");
      assert.match(rule(".pp-chips span"), /background:rgba\(6,26,36,\.55\)/);
      assert.match(rule(".pp-cta"), /background:rgba\(14,18,28,\.94\)/);
      const cap = Number((/font-size:(\d+)px/.exec(rule(".stat-box .cap")) || [])[1]); assert.ok(cap >= 12, ".stat-box .cap " + cap + "px");
      assert.match(rule(".seg button"), /min-height:44px/);
    });

    t.test("QC-16 (FIX-commerce #2): ui-signature.js không còn bọc #tsx-place (Cửa hàng dùng nút thường + hộp xác nhận)", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const sel = app.evj("teSig.slideTargets.map(x=> x.sel)");
      assert.ok(!sel.includes("#tsx-place"), "còn #tsx-place");
      assert.ok(sel.includes("#btn-session-done") && sel.includes("#del-go"), "mất mục tiêu trượt khác");
    });

    t.test("QU-36 (vòng 2): ≥ 1024 px — khung rộng cho Sự kiện / Cộng đồng / Kho kiến thức (CSS module đã có lưới 2 cột); Tìm PT tự mở khung trong findpt.css", ()=>{
      const m = /@media \(min-width:1024px\)\{([\s\S]*?)\n\}/.exec(noComments(ukc));
      const shellSel = (/(html:is\([^)]*\)) #app-shell\{/.exec(m[1]) || [])[1] || "";
      for(const s of ["coach", "client", "events", "community", "kb"]) assert.ok(shellSel.includes(`[data-screen="${s}"]`), "khung rộng thiếu " + s);
      assert.ok(!shellSel.includes('"findpt"'), "Tìm PT tự quản khung (1 080 px) — không bó 820 px");
      // điều kiện: module tương ứng đã có lưới 2 cột bám data-screen
      for(const [f, s] of [["events.css", "events"], ["community.css", "community"], ["kb.css", "kb"], ["findpt.css", "findpt"]]){
        const css = noComments(read(f));
        assert.ok(new RegExp(`@media \\(min-width:1024px\\)\\{[\\s\\S]*html\\[data-screen="${s}"\\]`).test(css), f + " chưa có lưới ≥ 1024 px");
      }
    });

    t.test("DS-1 (QU-28 tài liệu): DESIGN-SYSTEM.md ghi --on-coral Mặc định = #061A24 (6,9:1), bỏ cảnh báo 2,6:1", ()=>{
      const ds = read("docs/DESIGN-SYSTEM.md");
      assert.match(ds, /\| `--on-coral` \(chữ trên CTA\) \| `#061A24` 6,9:1 \|/);
      assert.ok(!/⚠ 2,6:1/.test(ds) && !/giữ nguyên nút coral \+ chữ trắng/.test(ds), "còn ghi chú cũ 2,6:1");
      assert.ok(contrast("#FF7A45", "#061A24") >= 6.8);
    });
  },
};

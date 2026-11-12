/* TapEasy — TOKEN ACCENT THEO THEME + LOGO ĐỔI MÀU + SLOGAN TIẾNG VIỆT + 4 GÓI MỚI (theme-accent.css/.js · theme-packs.css · themes.js)
   Chạy riêng: node tests/run.js --only theme-accent
   - Kiểm TOKEN tĩnh cho cả 15 theme (6 cũ + 9 gói): đủ bộ --accent/--on-accent/--accent-soft/--accent-glow/--cta-… · --link · --logo-…;
     tương phản WCAG (AA) của chữ trên accent, chữ trên CTA (cả 2 đầu gradient), link trên nền + thẻ, logo trên nền.
   - Kiểm LUẬT: CTA / chip đang chọn / tab đang chọn / logo / toggle / tiến độ / tick hiệp / link "Xem tất cả" / màn chào
     đọc đúng token (không màu cứng), độ ưu tiên ≥ luật gói, nạp đúng chỗ.
   - Kiểm JS: logo SVG nội tuyến (2 nhóm màu "Tap" / "Easy"+biểu tượng, không fill cứng), nhận diện ảnh logo (kể cả data: URI).
   - Kiểm SLOGAN: font hiển thị có glyph tiếng Việt, Google Fonts có subset vietnamese, line-height đủ cho dấu chồng.
   - Đo computed style thật (CTA/pill/tab/logo = token của theme) bằng Playwright: _test/accent-harness (window.__accent) — docs/THEME-PACKS.md §8. */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const { scriptOrder, APP_DIR } = require("../lib/harness");

const read = f=> fs.readFileSync(path.join(APP_DIR, f), "utf8");
const strip = s=> s.replace(/\/\*[\s\S]*?\*\//g, "");
const THEMES = ["navy", "ocean", "sunset", "forest", "midnight", "light",
  "aurora", "espresso", "alpine", "wellness", "sanctuary", "ember", "volt", "violet", "lime"];
const NEW_PACKS = ["ember", "volt", "violet", "lime"];
const REQ = ["--accent", "--accent-2", "--accent-rgb", "--on-accent", "--cta-bg", "--cta-solid", "--cta-rgb", "--cta-fg", "--cta-shadow",
  "--link", "--logo-mark", "--logo-text", "--gauge-a", "--gauge-b", "--ring-1", "--ring-2", "--ring-3"];
/* nền + thẻ thật của từng theme (vùng chữ link / logo đặt lên) */
const SURF = {
  navy:["#061A24", "#0B2A33"], ocean:["#03142B", "#08254A"], sunset:["#1A0C1C", "#2A1430"], forest:["#071A12", "#0D2A1D"],
  midnight:["#0E0A26", "#1A1342"], light:["#EDF2F5", "#FFFFFF"], aurora:["#000000", "#1A1A1A"], espresso:["#180A06", "#3A1F14"],
  alpine:["#EAE6DE", "#F4F0E9"], wellness:["#34414D", "#4A5764"], sanctuary:["#2A2322", "#3E342D"],
  ember:["#F4F4F2", "#FFFFFF"], volt:["#0B0B0C", "#1A1A1C"], violet:["#15161C", "#1F2029"], lime:["#FFFFFF", "#F3F4EF"],
};

/* ---------- màu & WCAG ---------- */
function rgb(s){
  s = String(s).trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if(m){ let h = m[1]; if(h.length === 3) h = h.split("").map(c=> c + c).join(""); return [0, 2, 4].map(i=> parseInt(h.slice(i, i + 2), 16)); }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if(m) return [+m[1], +m[2], +m[3]];
  throw new Error("màu lạ: " + s);
}
const lum = c=>{ const f = v=>{ v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
const cr = (a, b)=>{ const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const hexes = v=> String(v).match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/ig) || [];

/** khối token { --x: v } của selector đúng nguyên văn */
function block(css, sel){
  const i = css.indexOf(sel + "{"); if(i < 0) return null;
  const body = css.slice(i + sel.length + 1, css.indexOf("\n}", i));
  const out = {}; strip(body).replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (_, k, v)=>{ out[k] = v.trim(); return ""; });
  return out;
}
function tokensOf(css, id){
  const sel = id === "navy" ? ':root, :root[data-theme="navy"]' : `:root[data-theme="${id}"]`;
  return block(css, sel);
}

module.exports = {
  name: "Accent theo theme · logo đổi màu · slogan tiếng Việt · 4 gói mới",
  area: "Giao diện (theme-accent.css/.js · theme-packs · themes.js)",
  async define(t){
    const app = await t.app({ settleMs: 120 });
    await app.settle(40);
    const ACSS = read("theme-accent.css"), ACSS_ = strip(ACSS), AJS = read("theme-accent.js");
    const PCSS = read("theme-packs.css"), STYLE = read("style.css"), html = read("index.html");

    t.test("Gắn đúng chỗ: theme-accent.css sau ui-signature.css, trước press-feel.css (brand.css → themes-modules.css vẫn 2 file cuối); theme-accent.js ngay sau theme-packs.js; health-safety.js cuối; sw.js / prepare-www.sh / build-single-html.py", ()=>{
      const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m=> m[1]).filter(h=> !/^https?:/.test(h));
      assert.equal(css[css.length - 1], "themes-modules.css"); assert.equal(css[css.length - 2], "brand.css");
      // press-feel.css giữ vị trí ngay trước brand.css (suite 71) → theme-accent.css nằm giữa ui-signature.css và press-feel.css
      assert.equal(css[css.indexOf("ui-signature.css") + 1], "theme-accent.css", "theme-accent.css ngay sau ui-signature.css");
      assert.equal(css[css.indexOf("theme-accent.css") + 1], "press-feel.css", "theme-accent.css ngay trước press-feel.css");
      assert.deepEqual(css.slice(-3), ["press-feel.css", "brand.css", "themes-modules.css"]);
      const o = scriptOrder(), at = f=> o.indexOf(f);
      assert.equal(o[at("theme-packs.js") + 1], "theme-accent.js", "theme-accent.js ngay sau theme-packs.js");
      assert.ok(at("theme-accent.js") < at("ui-signature.js"));
      assert.equal(o[o.length - 1], "health-safety.js", "health-safety.js LUÔN CUỐI");
      const sw = read("sw.js");
      assert.ok(sw.includes('"./theme-accent.css"') && sw.includes('"./theme-accent.js"'), "sw.js ASSETS");
      assert.ok(Number((/const CACHE = "fitkit-v(\d+)"/.exec(sw) || [])[1]) >= 13, "tăng cache sw.js (≥ v13)");
      assert.match(read("scripts/prepare-www.sh"), /cp theme-accent\.css theme-accent\.js www\//);
      assert.match(read("scripts/build-single-html.py"), /theme-accent\.css", "theme-accent\.js/);
      assert.deepEqual(app.loadErrors.map(e=> e.file), [], "nạp lỗi");
    });

    t.test("Đủ token accent cho 15 theme (6 cũ + 9 gói) và khớp danh sách bộ chọn", ()=>{
      const ids = app.evj("fkTheme.list.map(x=> x.id)").filter(x=> x !== "auto");
      assert.deepEqual(ids, THEMES, "bộ chọn = 15 theme");
      for(const id of THEMES){
        const T = tokensOf(ACSS, id); assert.ok(T, "thiếu khối token " + id);
        const miss = REQ.filter(k=> !T[k]); assert.deepEqual(miss, [], id + " thiếu token");
        assert.equal(T["--accent-rgb"].replace(/\s/g, ""), rgb(T["--accent"]).join(","), id + ": --accent-rgb khớp --accent");
        assert.equal(T["--cta-rgb"].replace(/\s/g, ""), rgb(T["--cta-solid"]).join(","), id + ": --cta-rgb khớp --cta-solid");
      }
      // token dẫn xuất (khai báo cả ở đảo tối để tính lại)
      for(const k of ["--accent-soft", "--accent-glow", "--accent-line"]) assert.match(ACSS_, new RegExp(k + ":rgba\\(var\\(--accent-rgb\\)"), k);
    });

    t.test("Tương phản AA: chữ trên accent, chữ trên CTA (2 đầu gradient), link trên nền + thẻ (≥ 4,5:1); logo trên nền (chữ ≥ 4,5:1, biểu tượng ≥ 3:1)", ()=>{
      const bad = [];
      const chk = (label, r, min)=>{ if(!(r >= min)) bad.push(`${label}: ${r.toFixed(2)}:1 < ${min}`); };
      for(const id of THEMES){
        const T = tokensOf(ACSS, id);
        chk(`${id} on-accent/accent`, cr(T["--on-accent"], T["--accent"]), 4.5);
        for(const c of new Set([T["--cta-solid"], ...hexes(T["--cta-bg"])])) chk(`${id} cta-fg/${c}`, cr(T["--cta-fg"], c), 4.5);
        for(const s of SURF[id]){
          chk(`${id} link/${s}`, cr(T["--link"], s), 4.5);
          chk(`${id} logo-text/${s}`, cr(T["--logo-text"], s), 4.5);
          chk(`${id} logo-mark/${s}`, cr(T["--logo-mark"], s), 3);
          // accent dùng làm vòng/thanh/viền trên nền: ≥ 3:1 (WCAG 1.4.11). Chanh sáng / Cam năng lượng: accent là MẢNG nền
          // (chip, CTA, tab) luôn kèm chữ --on-accent đen — đồ hoạ trên nền sáng dùng --link (ô-liu / cam đậm) thay vì accent.
          if(!["lime", "ember"].includes(id)) chk(`${id} accent (đồ hoạ)/${s}`, cr(T["--accent"], s), 3);
        }
      }
      // "đảo tối" của theme sáng (ảnh/video, màn chào): nền scrim tối
      const islands = [...ACSS_.matchAll(/html\.fk-light(?:\[data-theme="(\w+)"\])? :is\([^)]*\)\{([^}]*)\}/g)];
      assert.ok(islands.length >= 4, "đảo tối: mặc định + alpine + ember + lime");
      for(const m of islands){
        const T = {}; m[2].replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (_, k, v)=>{ T[k] = v.trim(); return ""; });
        if(!T["--accent"]) continue;
        const who = "đảo " + (m[1] || "sáng");
        chk(`${who} on-accent`, cr(T["--on-accent"], T["--accent"]), 4.5);
        chk(`${who} cta-fg`, cr(T["--cta-fg"], T["--cta-solid"]), 4.5);
        chk(`${who} link/scrim`, cr(T["--link"], "#061A24"), 4.5);
        chk(`${who} logo-text/scrim`, cr(T["--logo-text"], "#061A24"), 4.5);
      }
      // sheet kem của Sanctuary
      const sh = block(ACSS, 'html[data-theme="sanctuary"] .sheet');
      chk("sanctuary sheet on-accent", cr(sh["--on-accent"], sh["--accent"]), 4.5); chk("sanctuary sheet link/kem", cr(sh["--link"], "#F5F0E8"), 4.5);
      chk("sanctuary sheet cta", cr(sh["--cta-fg"], sh["--cta-solid"]), 4.5); chk("sanctuary sheet logo-text", cr(sh["--logo-text"], "#F5F0E8"), 4.5);
      assert.deepEqual(bad, [], "cặp màu dưới AA");
    });

    t.test("CTA / chip đang chọn / tab đang chọn / toggle / tiến độ / tick hiệp / link / badge / ripple đọc token (không màu cứng), độ ưu tiên ≥ luật gói", ()=>{
      const rule = sel=>{ const i = ACSS_.indexOf(sel + "{"); assert.ok(i >= 0, "thiếu luật " + sel); return ACSS_.slice(i + sel.length + 1, ACSS_.indexOf("}", i)); };
      assert.match(rule("html[data-theme] .btn-primary"), /background:var\(--cta-bg\) !important; color:var\(--cta-fg\) !important/);
      assert.match(rule("html[data-theme] .btn-primary:not(.is-pressed)"), /box-shadow:var\(--cta-shadow\)/);
      assert.match(ACSS_, /html\[data-theme\] :is\(\.pill\.active, \.pill\.hot, \.seg button\.active, \.choice-card\.selected[^{]*\{\s*background:var\(--accent\) !important; color:var\(--on-accent\) !important/);
      assert.match(rule("html[data-theme] .nav-item.active .material-symbols-rounded"), /background:var\(--accent\); color:var\(--on-accent\)/);
      assert.match(rule("html[data-theme] .toggle.on"), /background:var\(--accent\)/);
      assert.match(rule("html[data-theme] .progress-fill"), /var\(--accent\)/);
      assert.match(rule("html[data-theme] .onboard-progress div.done"), /var\(--accent\)/);
      assert.match(rule("html[data-theme] .sig-stepper"), /--sig-step-on-bg:var\(--accent\)/);
      assert.match(rule("html[data-theme] .set-row.done .set-check"), /background:var\(--accent\); color:var\(--on-accent\)/);
      assert.match(rule("html[data-theme] .section-title a"), /color:var\(--link\) !important/);
      assert.match(rule("html[data-theme] .st-done"), /var\(--accent\)/);
      assert.match(rule("html[data-theme] .sig-gauge .s2"), /var\(--gauge-b\)/);
      assert.match(rule('html[data-theme] [stroke="#5EE6C7" i]'), /stroke:var\(--accent\)/);
      assert.match(rule("html[data-theme] input[type=\"range\"]"), /accent-color:var\(--accent\)/);
      assert.match(ACSS_, /\.pf-rpl > i\{ --pf-ripple:var\(--accent\)/);
      // không màu cứng trong phần thành phần (§4) — chỉ token
      const comp = ACSS_.slice(ACSS_.indexOf("html[data-theme]{ accent-color"), ACSS_.indexOf(".ta-logo{"));
      assert.deepEqual(hexes(comp.replace(/\[(?:stroke|fill)="#[0-9A-F]+" i\]/gi, "")), [], "màu cứng trong luật thành phần");
      // luật gói cùng đối tượng (html[data-theme="x"] .btn-primary) nạp TRƯỚC → luật accent (cùng độ ưu tiên) thắng
      const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m=> m[1]);
      assert.ok(css.indexOf("theme-packs.css") < css.indexOf("theme-accent.css"));
    });

    t.test("Logo: SVG nội tuyến 2 nhóm màu (\"Tap\" = --logo-text, \"Easy\" + biểu tượng = --logo-mark), không fill cứng; file logo gốc không đổi; có fallback", ()=>{
      const wm = app.ev(`teAccent.logoSVG("wordmark", "brand-wm", "TapEasy")`);
      assert.match(wm, /^<svg [^>]*class="ta-logo ta-wordmark brand-wm"[^>]*viewBox="0 0 770\.2 180\.6"[^>]*role="img" aria-label="TapEasy"/);
      assert.equal((wm.match(/<g class="ta-tap"[^>]*>([\s\S]*?)<\/g>/)[1].match(/<path /g) || []).length, 3, "Tap = 3 path");
      assert.equal((wm.match(/<g class="ta-easy"[^>]*>([\s\S]*?)<\/g>/)[1].match(/<path /g) || []).length, 4, "Easy = 4 path");
      const lk = app.ev(`teAccent.logoSVG("lockup", "splash-logo", "TapEasy")`), mk = app.ev(`teAccent.logoSVG("mark", "wl-tag-mark", "")`);
      assert.match(lk, /class="ta-mark"/); assert.match(lk, /class="ta-tap"/); assert.match(lk, /viewBox="0 0 770\.2 335\.3"/);
      assert.match(mk, /aria-hidden="true"/); assert.match(mk, /viewBox="0 0 200 134"/);
      for(const s of [wm, lk, mk]) assert.doesNotMatch(s, /fill="#|style=/, "màu logo phải đến từ CSS");
      assert.match(app.ev(`teAccent.logoSVG("wordmark", '"><img onerror=x>', '"><b>')`), /&quot;&gt;&lt;img/, "thoát ký tự lớp/nhãn");
      assert.deepEqual(app.evj(`["assets/brand/logo-wordmark-light.svg","assets/brand/logo-wordmark-dark.svg","assets/brand/logo-lockup-dark.svg","assets/brand/logo-mark.svg","assets/brand/logo-mark-white.svg","x.svg"].map(teAccent.kindOf)`),
        ["wordmark", "wordmark", "lockup", "mark", "", ""]);
      assert.match(ACSS_, /\.ta-logo \.ta-tap\{ fill:var\(--logo-text, #F5F7F3\)/);
      assert.match(ACSS_, /\.ta-logo :is\(\.ta-easy, \.ta-mark\)\{ fill:var\(--logo-mark, #02BCB3\)/);
      assert.match(ACSS_, /html\[data-theme\] \.brand-text b\{ color:var\(--logo-mark\)/);
      // nhận diện cả bản 1 file (ảnh nhúng data: URI) theo lớp của ảnh logo
      assert.match(AJS, /\["splash-logo","lockup"\], \["wl-tag-mark","mark"\], \["brand-wm","wordmark"\]/);
      assert.match(AJS, /\.tsx, \.adm, \[data-ta-keep\]/, "Cửa hàng / Quản trị giữ logo riêng");
      // file gốc không sửa
      assert.match(read("assets/brand/logo-wordmark-light.svg"), /<g fill="#F5F7F3" fill-rule="evenodd">/);
      assert.match(read("assets/brand/logo-mark.svg"), /<g fill="#02BCB3" fill-rule="evenodd">/);
      // màn chào / thanh trên / menu / splash / onboarding vẫn có <img> gốc (fallback khi JS lỗi)
      assert.match(read("pt.js"), /class="wl-brand-img" src="assets\/brand\/logo-wordmark-light\.svg"/);
      assert.match(read("pt.js"), /class="splash-logo on-dark" src="assets\/brand\/logo-lockup-light\.svg"/);
      assert.match(html, /class="brand-onboard"><img class="brand-wm on-dark"/);
    });

    t.test("Slogan \"Tập đúng, tiến bộ thật sự\": font hiển thị có đủ glyph tiếng Việt, Google Fonts có subset vietnamese, line-height đủ cho dấu chồng, không tổng hợp đậm giả", ()=>{
      const pt = read("pt.js");
      assert.match(pt, /<span class="l1">Tập đúng<\/span>\s*<span class="l2">Tiến bộ<\/span>\s*<span class="l3">Thật sự<\/span>/);
      const cond = (/--cond:([^;]+);/.exec(STYLE) || [])[1] || "";
      const fams = cond.split(",").map(s=> s.trim().replace(/['"]/g, ""));
      assert.equal(fams[0], "Barlow Condensed", "font chính");
      const VI_OK = ["Barlow Condensed", "Inter Tight", "Inter", "Roboto Condensed", "Segoe UI", "Arial", "sans-serif", "Be Vietnam Pro", "Manrope", "JetBrains Mono"];
      assert.deepEqual(fams.filter(f=> !VI_OK.includes(f)), [], "font thiếu dấu tiếng Việt trong chuỗi --cond (vd. Arial Narrow)");
      const head = (/\.wl-head\{([^}]*)\}/.exec(STYLE) || [])[1] || "";
      assert.ok(parseFloat((/line-height:([\d.]+)/.exec(head) || [])[1]) >= 1.0, "line-height .wl-head ≥ 1 (dấu chồng Ậ Ế Ộ Ự)");
      assert.match(head, /font-synthesis:none/); assert.match(head, /padding-top:\.1\d?em/);
      assert.doesNotMatch(head, /letter-spacing:-/, "không letter-spacing âm");
      for(const sel of [".wl-tag{", ".wl-brand{", ".wl-stat b{"]){ const r = STYLE.slice(STYLE.indexOf(sel), STYLE.indexOf("}", STYLE.indexOf(sel))); assert.match(r, /font-synthesis:none/, sel); }
      assert.ok(parseFloat((/\.wl-tag\{[^}]*line-height:([\d.]+)/.exec(STYLE) || [])[1]) >= 1.0, ".wl-tag line-height ≥ 1");
      // khoá lại ở MỌI theme (gói đặt h1 300 / tracking âm)
      assert.match(ACSS_, /html\[data-theme\] \.wl :is\(\.wl-head, \.wl-tag\)\{[^}]*font-weight:800; font-synthesis:none;[^}]*letter-spacing:\.005em; line-height:1\.(0[6-9]|1\d)/);
      assert.ok(parseFloat((/\.wl-head\{([^}]*)\}/.exec(STYLE) || [])[1].match(/line-height:([\d.]+)/)[1]) >= 1.08, "slogan: line-height ≥ 1,08 (v2: dấu chạm dòng)");
      // v2: bản đồ màn chào vẽ trọn (pathLength chuẩn hoá), có wlMapFinish(), không còn mũi tên SMIL; tiêu đề buổi không đè vòng tiến độ
      assert.match(pt, /class="wl-route"/); assert.match(pt, /pathLength="1"/); assert.doesNotMatch(pt, /class="wl-runner"/);
      assert.match(pt, /window\.wlMapFinish = /); assert.match(STYLE, /\.wl-route\{[^}]*stroke-dasharray:1 1; stroke-dashoffset:1;/);
      assert.match(ACSS_, /\.home-hero:has\(\.home-hero-ring\) \.home-hero-body > :is\(\.hero-eyebrow, \.headline\)\{ max-width:calc\(100% - 82px\); \}/);
      assert.match(ACSS_, /\.headline\{ overflow-wrap:anywhere; text-wrap:balance;/);
      const gf = (/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/.exec(html) || [])[1] || "";
      assert.match(gf, /family=Barlow\+Condensed:wght@800/); assert.match(gf, /subset=vietnamese/); assert.match(gf, /display=swap/);
      assert.match(read("themes.js"), /"&subset=vietnamese&display=swap"/, "font gói nạp lười cũng có subset vietnamese");
      // tiêu đề IN HOA của gói Volt: line-height ≥ 1,05
      assert.match(PCSS, /html\[data-theme="volt"\] :is\(h1, h2, \.headline, \.hero-title\)\{[^}]*text-transform:uppercase;[^}]*line-height:1\.0[5-9]/);
      // mọi font gói = Google Fonts có tiếng Việt
      const all = [...new Set(app.evj("fkTheme.list.flatMap(x=> x.fonts || [])").map(f=> f.split(":")[0].replace(/\+/g, " ")))];
      assert.deepEqual(all.filter(f=> !VI_OK.includes(f)), [], "font gói không hỗ trợ tiếng Việt");
    });

    t.test("4 gói mới (Cam năng lượng · Volt · Tím Đêm Pro · Chanh sáng): đăng ký + ảnh xem trước, token gói, đúng nét mẫu, áp tức thì", ()=>{
      const list = app.evj("fkTheme.list.filter(x=> x.pack).map(x=> ({ id:x.id, name:x.name, mode:x.mode || 'dark', pv:x.pv, fonts:x.fonts }))");
      const by = Object.fromEntries(list.map(x=> [x.id, x]));
      assert.deepEqual(NEW_PACKS.map(id=> by[id] && by[id].name), ["Cam năng lượng", "Volt", "Tím Đêm Pro", "Chanh sáng"]);
      assert.deepEqual(NEW_PACKS.map(id=> by[id].mode), ["light", "dark", "dark", "light"]);
      for(const id of NEW_PACKS) assert.ok(by[id].pv && by[id].pv.bg && by[id].pv.cta && by[id].fonts.length, id + " thiếu pv/fonts");
      const P = id=> block(PCSS, `:root[data-theme="${id}"]`);
      for(const id of NEW_PACKS){ const T = P(id); assert.ok(T, "theme-packs.css thiếu " + id);
        for(const k of ["--bg", "--navy", "--mint", "--coral", "--on-mint", "--on-coral", "--text-muted", "--text-dim", "--glass", "--fk-shell-bg", "--fk-theme-color", "--tp-r-card", "--tp-btn-h"]) assert.ok(T[k], id + " thiếu " + k); }
      // nét mẫu
      const A = id=> tokensOf(ACSS, id);
      assert.match(A("ember")["--cta-bg"], /#FF6A2B 0%, #FF8A3D 100%/); assert.match(A("ember")["--cta-shadow"], /rgba\(255,106,43/);
      assert.equal(P("ember")["--tp-r-btn"], "999px"); assert.ok(parseInt(P("ember")["--tp-r-card"]) >= 24 && parseInt(P("ember")["--tp-r-card"]) <= 28);
      assert.equal(P("volt")["--bg"], "#0B0B0C"); assert.match(P("volt")["--glass-solid"], /#1A1A1C/); assert.equal(A("volt")["--accent"], "#D4FF3A"); assert.equal(A("volt")["--on-accent"], "#0B0B0C");
      assert.equal(P("violet")["--bg"], "#15161C"); assert.match(P("violet")["--glass-solid"], /#1F2029/); assert.equal(A("violet")["--cta-solid"], "#6C4CF5");
      assert.deepEqual(["--ring-1", "--ring-2", "--ring-3"].map(k=> A("violet")[k]), ["#7C5CFF", "#FFC83D", "#3DD6F5"], "vòng chỉ số tím/vàng/xanh");
      assert.equal(A("lime")["--accent"], "#DFFF4F"); assert.equal(A("lime")["--cta-fg"], "#0B0B0C"); assert.equal(P("lime")["--bg"], "#FFFFFF");
      assert.match(PCSS, /html:is\(\[data-theme="volt"\], \[data-theme="lime"\]\) \.btn-block\.btn-primary::after\{[^}]*width:44px; height:44px;[^}]*border-radius:50%/, "nút tròn mũi tên ≥ 44");
      assert.match(PCSS, /html\[data-theme="lime"\] \.home-hero::after\{[^}]*width:44px; height:44px;/, "thẻ ảnh có nút mũi tên tròn 44");
      assert.match(PCSS, /html\[data-theme="volt"\] \.home-greet h2 span\{ color:#D4FF3A/, "Volt: dòng 2 tiêu đề màu chanh");
      // máy yếu + giảm chuyển động
      assert.match(PCSS, /html\.lowfx:is\(\[data-theme="ember"\], \[data-theme="volt"\], \[data-theme="violet"\], \[data-theme="lime"\]\)/);
      assert.match(PCSS, /@media \(prefers-reduced-motion: reduce\)\{\s*html:is\(\[data-theme="volt"\], \[data-theme="lime"\]\) \.btn-block\.btn-primary::after\{ transition:none; \}/);
      assert.match(ACSS_, /html\.lowfx\[data-theme\] \.btn-primary:not\(\.is-pressed\)\{ box-shadow:none !important; \}/);
      assert.match(ACSS_, /@media \(prefers-reduced-motion: reduce\)\{\s*\.ta-logo :is\(\.ta-tap, \.ta-easy, \.ta-mark\)\{ transition:none; \}/);
      // áp tức thì: chỉ đổi data-theme/class (không tải lại), lưu state
      for(const id of NEW_PACKS){
        app.run(`fkTheme.set(${JSON.stringify(id)})`);
        const r = app.evj(`({ th:document.documentElement.getAttribute("data-theme"), tp:document.documentElement.classList.contains("tp-pack"), lt:document.documentElement.classList.contains("fk-light"), st:state.theme })`);
        assert.deepEqual(r, { th:id, tp:true, lt:id === "ember" || id === "lime", st:id }, id);
      }
      app.run("fkTheme.set('navy')");
      assert.equal(app.consoleErrors ? app.consoleErrors.length : 0, 0, "lỗi console");
    });

    t.test("Tài liệu docs/THEME-PACKS.md có mục token accent + 4 gói mới", ()=>{
      const doc = read("docs/THEME-PACKS.md");
      for(const k of ["--accent", "--on-accent", "--cta-bg", "--link", "--logo-mark", "--logo-text", "theme-accent.css", "theme-accent.js", ...NEW_PACKS]) assert.ok(doc.includes(k), "doc thiếu " + k);
    });
  },
};

/* TapEasy — 5 GÓI GIAO DIỆN + THÀNH PHẦN CHỮ KÝ (themes.js · theme-packs.css/.js · ui-signature.css/.js)
   Chạy riêng: node tests/run.js --only theme-packs
   - Nạp app thật theo index.html; kiểm API fkTheme / teSlideConfirm / teSig qua DOM shim (không phân tích CSS bằng trình duyệt).
   - Kiểm tĩnh CSS: token đặc trưng của 5 gói, tương phản AA (tính WCAG có trộn alpha), vùng chạm ≥ 44 px,
     reduced-motion, html.lowfx, không hotlink tài sản ngoài (chỉ Google Fonts), lớp màu module đã sinh lại cho MỌI CSS module.
   - Ảnh chụp 11 theme × 4 màn: Playwright (outputs/_test/themes2-harness/shoot.py) — xem docs/THEME-PACKS.md. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { assert, expectNone } = require("../lib/framework");
const { scriptOrder, APP_DIR } = require("../lib/harness");

const read = f=> fs.readFileSync(path.join(APP_DIR, f), "utf8");
const PACKS = ["aurora", "espresso", "alpine", "wellness", "sanctuary"];
const CLASSIC = ["navy", "ocean", "sunset", "forest", "midnight", "light"];

/* ---------- màu & tương phản WCAG 2.x ---------- */
function parseColor(s){
  s = String(s).trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if(m){ let h = m[1]; if(h.length === 3) h = h.split("").map(c=> c + c).join("");
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16), h.length === 8 ? parseInt(h.slice(6,8),16)/255 : 1]; }
  m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if(m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  throw new Error("màu lạ: " + s);
}
/** trộn các lớp từ dưới lên: over("#000", "rgba(255,255,255,.1)", …) */
function over(...layers){
  let [r, g, b] = parseColor(layers[0]);
  for(const L of layers.slice(1)){ const [r2, g2, b2, a] = parseColor(L); r = r2*a + r*(1-a); g = g2*a + g*(1-a); b = b2*a + b*(1-a); }
  return [r, g, b, 1];
}
function lum(c){ const f = v=>{ v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v + .055)/1.055, 2.4); }; return .2126*f(c[0]) + .7152*f(c[1]) + .0722*f(c[2]); }
function contrast(fg, bg){ const a = lum(fg), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); }
/** chữ (có thể trong suốt) trên nền đặc */
const rgbStr = c=> `rgb(${c.slice(0, 3).map(v=> Math.round(v)).join(",")})`;
function cr(text, ...bgLayers){ const bg = over(...bgLayers); return contrast(over(rgbStr(bg), text), bg); }

/* ---------- token của một gói trong theme-packs.css ---------- */
function tokens(css, id){
  const m = css.match(new RegExp(':root\\[data-theme="' + id + '"\\]\\{([\\s\\S]*?)\\n\\}'));
  if(!m) return null;
  const out = {};
  m[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (_, k, v)=>{ out[k] = v.trim(); return ""; });
  return out;
}

module.exports = {
  name: "Gói giao diện (5 gói) & thành phần chữ ký",
  area: "Giao diện (themes.js · theme-packs · ui-signature)",
  async define(t){
    const app = await t.app({ settleMs: 120 });
    await app.settle(40);
    const PCSS = read("theme-packs.css"), SCSS = read("ui-signature.css"), TCSS = read("themes.css");
    const PJS = read("theme-packs.js"), SJS = read("ui-signature.js"), TJS = read("themes.js");
    const html = read("index.html");

    t.test("Gắn đúng chỗ: index.html (CSS sau mọi module, trước brand.css; JS sau admin.js, ngay trước health-safety.js), sw.js, prepare-www.sh", ()=>{
      const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m=> m[1]).filter(h=> !/^https?:/.test(h));
      const ci = f=> css.indexOf(f);
      assert.ok(ci("theme-packs.css") > 0 && ci("ui-signature.css") === ci("theme-packs.css") + 1, "ui-signature.css ngay sau theme-packs.css");
      for(const mod of ["ui-kit.css","nutrition-pro.css","training-pro.css","program-builder.css","pt-pro.css","pt-connect.css","community.css",
        "achievements.css","health-safety.css","events.css","shop.css","findpt.css","kb.css","admin.css"]) assert.ok(ci(mod) < ci("theme-packs.css"), mod + " phải trước theme-packs.css");
      assert.ok(ci("ui-signature.css") < ci("brand.css"), "trước brand.css (brand.css + themes-modules.css luôn cuối)");
      const o = scriptOrder(), at = f=> o.indexOf(f);
      assert.ok(at("admin.js") < at("theme-packs.js") && at("theme-packs.js") < at("ui-signature.js"), "theme-packs.js → ui-signature.js sau admin.js");
      assert.equal(at("ui-signature.js"), at("health-safety.js") - 1, "ui-signature.js ngay trước health-safety.js");
      assert.equal(o[o.length - 1], "health-safety.js");
      assert.ok(at("themes.js") < at("icons.js"), "themes.js vẫn trong <head>");
      const sw = read("sw.js"), www = read("scripts/prepare-www.sh");
      for(const f of ["theme-packs.css","ui-signature.css","theme-packs.js","ui-signature.js"]){
        assert.ok(sw.includes(`"./${f}"`), "sw.js ASSETS thiếu " + f);
        assert.ok(new RegExp("cp [^\\n]*\\b" + f.replace(".", "\\.") + "\\b").test(www), "prepare-www.sh không chép " + f);
      }
      assert.deepEqual(app.loadErrors.map(e=> e.file), [], "nạp lỗi");
    });

    t.test("Bộ chọn: 6 theme cũ giữ nguyên + Tự động + 5 gói (có ảnh xem trước pv, font Google)", ()=>{
      const list = app.evj("fkTheme.list.map(x=> ({ id:x.id, name:x.name, pack:!!x.pack, pv:!!x.pv, fonts:x.fonts || [], mode:x.mode || 'dark' }))");
      assert.deepEqual(list.filter(x=> !x.pack).map(x=> x.id), ["auto", ...CLASSIC]);
      assert.deepEqual(list.filter(x=> !x.pack).map(x=> x.name), ["Tự động","Mặc định","Đại dương","Hoàng hôn","Rừng","Tím đêm","Sáng"]);
      assert.deepEqual(list.filter(x=> x.pack).map(x=> x.id), PACKS);
      assert.deepEqual(list.filter(x=> x.pack).map(x=> x.name), ["Aurora","Espresso","Thu Alpine","Sương Wellness","Sanctuary"]);
      assert.ok(list.filter(x=> x.pack).every(x=> x.pv && x.fonts.length), "gói thiếu pv / fonts");
      assert.equal(list.find(x=> x.id === "alpine").mode, "light", "Thu Alpine là gói SÁNG");
      const fams = [...new Set(list.flatMap(x=> x.fonts).map(f=> f.split(":")[0].replace(/\+/g, " ")))].sort();
      assert.deepEqual(fams, ["Inter", "Inter Tight", "JetBrains Mono", "Manrope"], "chỉ font Google miễn phí (OFL)");
      assert.match(TJS, /const GF = "https:\/\/fonts\.googleapis\.com\/css2\?"/);
      app.run("fkTheme.set('navy')");
      const card = app.lastHtml("fk-theme-card");
      assert.equal((card.match(/data-fk-theme="/g) || []).length, 12, "12 lựa chọn (Tự động + 6 + 5)");
      assert.equal((card.match(/class="fk-pack-pv"/g) || []).length, 5, "5 ảnh xem trước");
      assert.match(card, /role="radiogroup"/); assert.match(card, /Gói giao diện/);
    });

    t.test("Áp gói: data-theme/data-pack, class tp-pack, fk-light cho Thu Alpine, lưu state.theme; về Mặc định gỡ tp-pack", ()=>{
      for(const id of PACKS){
        app.run(`fkTheme.set(${JSON.stringify(id)})`);
        const r = app.evj(`({ th:document.documentElement.getAttribute("data-theme"), pk:document.documentElement.getAttribute("data-pack"),
          tp:document.documentElement.classList.contains("tp-pack"), lt:document.documentElement.classList.contains("fk-light"), st:state.theme })`);
        assert.deepEqual(r, { th:id, pk:id, tp:true, lt:id === "alpine", st:id }, id);
      }
      app.run("fkTheme.set('navy')");
      assert.equal(app.ev("document.documentElement.classList.contains('tp-pack')"), false);
      assert.equal(app.ev("document.documentElement.getAttribute('data-pack')"), null);
      assert.equal(app.ev("JSON.parse(localStorage.getItem('fitkit_state_v1')).theme"), "navy");
    });

    t.test("Thêm gói lúc chạy: fkTheme.register (id hợp lệ, không trùng) → có trong bộ chọn", ()=>{
      const ok = app.ev(`fkTheme.register({ id:"thu-nghiem", name:"Thử nghiệm", desc:"gói thử", meta:"#101010",
        pv:{ bg:"#101010", card:"#222", ink:"#fff", acc:"#0f0", cta:"#fff", ctaInk:"#000" } })`);
      assert.equal(ok, true);
      assert.equal(app.ev(`fkTheme.register({ id:"thu-nghiem", name:"x" })`), false, "trùng id");
      assert.equal(app.ev(`fkTheme.register({ id:"Bad Id!", name:"x" })`), false, "id sai mẫu");
      assert.ok(app.ev("fkTheme.list.some(x=> x.id === 'thu-nghiem' && x.pack)"));
      app.run("fkTheme.renderPicker()");
      assert.match(app.lastHtml("fk-theme-card"), /data-fk-theme="thu-nghiem"/);
      assert.doesNotMatch(app.lastHtml("fk-theme-card"), /<script|javascript:/i);
    });

    t.test("Token đặc trưng 5 mẫu có trong theme-packs.css (đúng giá trị brief)", ()=>{
      const T = Object.fromEntries(PACKS.map(id=> [id, tokens(PCSS, id)]));
      PACKS.forEach(id=> assert.ok(T[id], "thiếu khối :root[data-theme=\"" + id + "\"]"));
      // Aurora
      assert.equal(T.aurora["--bg"], "#000000"); assert.equal(T.aurora["--glass-solid"], "#1A1A1A");
      assert.equal(T.aurora["--tp-r-input"], "12px"); assert.equal(T.aurora["--tp-btn-h"], "56px");
      assert.equal(T.aurora["--sig-step-on-bg"], "#FFFFFF"); assert.equal(T.aurora["--sig-step-on-ink"], "#000000");
      assert.match(T.aurora["--font-ui"], /^'Inter'/);
      assert.match(PCSS, /html\[data-theme="aurora"\] \.btn-primary\{ background:#fff !important; color:#000 !important/);
      // Espresso
      assert.equal(T.espresso["--bg"], "#180A06"); assert.equal(T.espresso["--fk-ink"], "#EDE4D8");
      assert.equal(T.espresso["--tp-ease"], "cubic-bezier(.16,1,.3,1)"); assert.equal(T.espresso["--tp-r-card"], "24px");
      assert.match(T.espresso["--fk-shell-bg"], /radial-gradient[\s\S]*radial-gradient/);
      assert.match(PCSS, /backdrop-filter:url\(#tp-lg-refract\)/); assert.match(PJS, /feDisplacementMap/);
      // Thu Alpine
      assert.match(T.alpine["--glass"], /rgba\(244,240,233,\.94\)/); assert.equal(T.alpine["--glass-blur"], "blur(14px)");
      assert.equal(T.alpine["--tp-panel"], "#EAE6DE"); assert.equal(T.alpine["--fk-ink"], "#2E2D2A");
      for(const [k, v] of [["--tp-amber","#F6B733"],["--tp-amber-2","#FBD06A"],["--tp-orange","#F59E0B"],["--tp-violet","#7C6CF2"]]) assert.equal(T.alpine[k], v, k);
      assert.equal(T.alpine["--tp-head-w"], "300"); assert.equal(T.alpine["--tp-head-track"], "-.045em");
      assert.match(T.alpine["--font-head"], /^'Inter Tight'/); assert.match(T.alpine["--font-mono"], /^'JetBrains Mono'/);
      assert.equal(T.alpine["--shadow-card"], "none");
      assert.match(PCSS, /data-theme="alpine"\][^{]*\.pill:not\(\.active\):not\(\.hot\)\{ background:var\(--tp-peach\)/, "chip đào");
      assert.match(SCSS, /\.sig-mono::before\{ content:":: "/, "nhãn mono \"::\"");
      // Sương Wellness
      assert.match(PCSS, /html\[data-theme="wellness"\] :is\([^)]*\)::before\{[^}]*-webkit-mask-composite:xor;[^}]*mask-composite:exclude;/, "viền gradient ::before + mask-composite");
      assert.equal(T.wellness["--sig-choice-r"], "32px");
      assert.match(PCSS, /tpHalo/, "quầng vàng nút tròn");
      // Sanctuary
      assert.equal(T.sanctuary["--navy-4"], "#5A4C41"); assert.equal(T.sanctuary["--navy-rgb"], "29,25,26");
      assert.equal(T.sanctuary["--mint"], "#F1E5C6"); assert.equal(T.sanctuary["--fk-ink"], "#F5F0E8");
      assert.match(T.sanctuary["--font-head"], /^'Manrope'/); assert.equal(T.sanctuary["--tp-head-w"], "300");
      assert.match(PCSS, /\.te-ev-date\{ width:68px; height:90px;/, "thẻ ngày 68×90");
    });

    t.test("Tương phản AA (≥ 4,5:1) của chữ chính, chữ mờ, CTA, chip trong 5 gói (tính có trộn alpha)", ()=>{
      const bad = [];
      const chk = (label, ratio, min)=>{ if(!(ratio >= (min || 4.5))) bad.push(`${label}: ${ratio.toFixed(2)}:1`); };
      // Aurora — chữ trên thẻ #1A1A1A, CTA trắng/đen, chip đang chọn trắng/đen
      chk("aurora chữ/thẻ", cr("#FFFFFF", "#1A1A1A")); chk("aurora muted/thẻ", cr("rgba(255,255,255,.78)", "#1A1A1A"));
      chk("aurora dim/thẻ", cr("rgba(255,255,255,.62)", "#1A1A1A")); chk("aurora CTA", cr("#000000", "#FFFFFF"));
      chk("aurora mint/nền", cr("#C8F25A", "#000000"));
      // Espresso — vùng sáng nhất: quầng cam .42 trên #1F0E08 + thẻ rgba(255,236,220,.08) (muted .55 của mẫu không đạt AA → .85)
      const espBg = ["#1F0E08", "rgba(214,120,60,.42)", "rgba(255,236,220,.08)"];
      chk("espresso chữ/thẻ", cr("#EDE4D8", ...espBg)); chk("espresso muted/thẻ", cr("rgba(237,228,216,.86)", ...espBg));
      chk("espresso dim/thẻ", cr("rgba(235,220,205,.85)", ...espBg));
      chk("espresso CTA (đầu sáng)", cr("#1A0A04", "#FFA36C")); chk("espresso CTA (đầu tối)", cr("#1A0A04", "#F27A3B"));
      // Thu Alpine — thẻ kem, panel #EAE6DE, chip đào, CTA hổ phách, chữ tím/hổ phách đậm
      const card = ["#EAE6DE", "rgba(244,240,233,.94)"];
      chk("alpine mực/thẻ", cr("#2E2D2A", ...card)); chk("alpine muted/panel", cr("rgba(46,45,42,.78)", "#EAE6DE"));
      chk("alpine dim/panel", cr("rgba(46,45,42,.70)", "#EAE6DE")); chk("alpine chip đào", cr("#5A3A1E", "#F8DCC6"));
      chk("alpine CTA", cr("#2E2D2A", "#F6B733")); chk("alpine tím/thẻ", cr("#5A49CF", ...card)); chk("alpine hổ phách đậm/thẻ", cr("#A9520A", ...card));
      chk("alpine chip chọn", cr("#F4F0E9", "#2E2D2A"));
      // Sương Wellness — vùng sáng nhất của nền + thẻ kính .075
      const wBg = ["#384656", "rgba(226,233,240,.06)", "rgba(255,255,255,.075)"];
      chk("wellness chữ trên chip/nút kính .2", cr("#FFFFFF", "#384656", "rgba(226,233,240,.06)", "rgba(255,255,255,.2)"));
      chk("wellness chữ cứng .72 + boost .45", cr("rgba(255,255,255,.846)", ...wBg));
      chk("wellness chữ/thẻ", cr("#FFFFFF", ...wBg)); chk("wellness muted/thẻ", cr("rgba(255,255,255,.90)", ...wBg));
      chk("wellness dim/thẻ", cr("rgba(255,255,255,.86)", ...wBg)); chk("wellness CTA", cr("#26313C", "#F6F3EC"));
      chk("wellness thẻ chọn đã chọn", cr("rgba(38,49,60,.8)", "#F6F3EC"));
      // Sanctuary — đỉnh nền #3E342D + quầng kem .09 + thẻ .08; sheet kem
      const sBg = ["#3E342D", "rgba(241,229,198,.09)", "rgba(245,240,232,.08)"];
      chk("sanctuary chữ cứng .6 + boost .35", cr("rgba(245,240,232,.74)", ...sBg)); chk("sanctuary đất nung/thẻ", cr("#F4BC9C", ...sBg));
      chk("sanctuary chữ/thẻ", cr("#F5F0E8", ...sBg)); chk("sanctuary muted/thẻ", cr("rgba(245,240,232,.88)", ...sBg));
      chk("sanctuary dim/thẻ", cr("rgba(245,240,232,.86)", ...sBg)); chk("sanctuary CTA", cr("#1D191A", "#F1E5C6"));
      chk("sanctuary sheet chữ", cr("rgba(29,25,26,.78)", "#FFFFFF")); chk("sanctuary sheet CTA", cr("#F5F0E8", "#1D191A"));
      chk("sanctuary thẻ ngày", cr("rgba(29,25,26,.72)", "#F5F0E8"));
      expectNone(bad, "Dưới chuẩn AA");
    });

    t.test("Vùng chạm ≥ 44 px, chữ ≥ 12 px trong lớp gói & chữ ký", ()=>{
      assert.match(PCSS, /html\.tp-pack \.topbar \.icon-btn\{ width:44px; height:44px; min-width:44px; \}/);
      assert.match(PCSS, /html\.tp-pack :is\(\.field input[^)]*\)\{ border-radius:var\(--tp-r-input\); min-height:44px; \}/);
      assert.match(SCSS, /\.sig-slide-thumb\{[^}]*width:44px; height:44px;/);
      assert.match(SCSS, /\.sig-step\{[^}]*min-height:44px;/);
      assert.match(TCSS, /\.fk-theme-opt\{[^}]*min-height:56px;/);
      const small = [];
      for(const [f, src] of [["theme-packs.css", PCSS], ["ui-signature.css", SCSS]])
        for(const m of src.matchAll(/font-size:\s*([\d.]+)px/g)) if(+m[1] < 12) small.push(`${f}: font-size ${m[1]}px`);
      expectNone(small, "Chữ dưới 12 px");
    });

    t.test("Giảm chuyển động & máy yếu: reduced-motion tắt hoạt ảnh, html.lowfx bỏ kính/khúc xạ", ()=>{
      assert.match(PCSS, /@media \(prefers-reduced-motion: reduce\)\{[\s\S]*animation:none !important/);
      assert.match(PCSS, /@media \(prefers-reduced-motion: no-preference\)\{\s*html\.tp-pack \.screen\.enter \.content > \*\{ animation:tpRise/, "reveal so le chỉ khi cho phép chuyển động");
      assert.match(SCSS, /@media \(prefers-reduced-motion: reduce\)\{[\s\S]*\.sig-slide \*[\s\S]*animation:none !important; transition:none !important;/);
      assert.match(PCSS, /html\.lowfx\[data-theme="espresso"\][^{]*\{\s*-webkit-backdrop-filter:none !important; backdrop-filter:none !important;/);
      assert.match(PCSS, /html\.lowfx\[data-theme="wellness"\] :is\(\.card, \.metric, \.stat-box\)::before\{ display:none; \}/);
      assert.match(SCSS, /html\.lowfx \.sig-slide-track\{ -webkit-backdrop-filter:none; backdrop-filter:none; \}/);
      // khúc xạ: tắt khi lowfx (theme-packs.js) — kiểm lúc chạy
      app.run("fkTheme.set('espresso'); document.documentElement.classList.add('lowfx')");
      assert.equal(app.ev("tpPacks.refractOn()"), false, "lowfx phải tắt khúc xạ");
      app.run("document.documentElement.classList.remove('lowfx'); fkTheme.set('navy')");
      assert.equal(app.ev("tpPacks.refractOn()"), false, "chỉ gói Espresso có khúc xạ");
      assert.match(PJS, /iPhone\|iPad\|iPod/); assert.match(PJS, /prefers-reduced-transparency: reduce/);
      assert.match(SJS, /const RM = \(\)=>/); assert.match(SJS, /function typewrite\(el, speed\)\{\s*if\(!el \|\| el\.dataset\.sigTw \|\| RM\(\)\) return;/);
    });

    t.test("Không hotlink/sao chép tài sản: không URL ngoài (trừ Google Fonts / namespace SVG), không @font-face, không ảnh/video", ()=>{
      const bad = [];
      for(const [f, src] of [["theme-packs.css", PCSS], ["ui-signature.css", SCSS], ["theme-packs.js", PJS], ["ui-signature.js", SJS], ["themes.js", TJS]]){
        for(const m of src.matchAll(/https?:\/\/[^\s"'`)<>]+/g)){
          const u = m[0];
          if(/^https:\/\/fonts\.googleapis\.com\/css2\?$/.test(u) || /^http:\/\/www\.w3\.org\/2000\/svg$/.test(u)) continue;
          bad.push(`${f}: ${u}`);
        }
        if(/@font-face|@import/i.test(src)) bad.push(`${f}: @font-face/@import`);
        if(/\.(?:jpe?g|png|webp|gif|mp4|webm|woff2?|ttf|otf)\b/i.test(src.replace(/\/\*[\s\S]*?\*\//g, ""))) bad.push(`${f}: tham chiếu file ảnh/video/font`);
        if(/motionsites/i.test(src)) bad.push(`${f}: nhắc tên nguồn mẫu`);
      }
      expectNone(bad, "Tài sản ngoài");
    });

    t.test("teSlideConfirm: bọc nút gốc (ẩn, giữ handler), trượt đủ → gọi click gốc 1 lần; nút disabled → không xác nhận; chốt 85 %", async ()=>{
      assert.match(SJS, /const SNAP = 0\.85;/);
      assert.equal(app.ev("typeof teSlideConfirm"), "function");
      const r = await app.ev(`(async()=>{
        const b = document.createElement("button"); b.textContent = "Kết thúc buổi"; let n = 0; b.addEventListener("click", ()=> n++);
        const api = teSlideConfirm(b);
        const again = teSlideConfirm(b);
        const st0 = { orig:b.classList.contains("sig-slide-orig"), hidden:b.getAttribute("aria-hidden"), tab:b.tabIndex, same: again === api };
        api.complete(); await new Promise(r=> setTimeout(r, 260));
        const d = document.createElement("button"); d.textContent = "Đặt hàng"; d.disabled = true; let m = 0; d.addEventListener("click", ()=> m++);
        const api2 = teSlideConfirm(d); api2.complete(); await new Promise(r=> setTimeout(r, 260));
        let k = 0; const api3 = teSlideConfirm(document.createElement("div"), ()=> k++, { wrap:false, label:"Trượt để xoá" }); api3.complete(); await new Promise(r=> setTimeout(r, 260));
        return JSON.stringify(Object.assign(st0, { n, m, k, state: api.el.getAttribute("data-state") }));
      })()`);
      const o = JSON.parse(r);
      assert.deepEqual(o, { orig:true, hidden:"true", tab:-1, same:true, n:1, m:0, k:1, state:"done" });
    });

    t.test("Tự bọc: Kết thúc buổi tập · Xoá tài khoản (id có thật trong mã lõi); KHÔNG bọc đặt hàng Cửa hàng", ()=>{
      const sel = app.evj("teSig.slideTargets.map(x=> x.sel)");
      for(const [s, file] of [["#btn-session-done","app.js"],["#del-go","pt.js"]]){
        assert.ok(sel.includes(s), "thiếu mục tiêu " + s);
        assert.ok(read(file).includes(s.slice(1)), `${s} không còn trong ${file}`);
      }
      // vòng 2 (ux · FIX-commerce #2, QC-16): Cửa hàng dùng nút thường + hộp xác nhận tóm tắt → bỏ "Trượt để đặt hàng"
      assert.ok(!sel.includes("#tsx-place"), "#tsx-place không còn là mục tiêu trượt xác nhận");
      assert.ok(app.evj("teSig.slideTargets.find(x=> x.sel === '#del-go').danger"), "xoá tài khoản = kiểu nguy hiểm");
      assert.match(SJS, /orig\.click\(\)/, "xác nhận = gọi click() của nút gốc (giữ mọi kiểm tra cũ)");
    });

    t.test("Stepper onboarding 3 chặng (Bạn · Cơ thể · Mục tiêu): chặng đang làm aria-current, chặng trước có dấu xong", ()=>{
      app.run("obStep = 2; renderOnboardProgress()");
      const h = app.lastHtml("sig-stepper");
      assert.equal((h.match(/class="sig-step /g) || []).length, 3);
      assert.match(h, /sig-step done[^>]*>.*Bạn/); assert.match(h, /sig-step on" aria-current="step">.*Cơ thể/); assert.match(h, /sig-step off[^>]*>.*Mục tiêu/);
      assert.match(h, /sig-step-bar[\s\S]*width:60%/);
      assert.ok(app.ev("document.getElementById('onboard-progress').classList.contains('sig-has-stepper')"));
      app.run("obStep = 0; renderOnboardProgress()");
      assert.match(app.lastHtml("sig-stepper"), /sig-step on" aria-current="step">.*Bạn/);
    });

    t.test("Gauge nửa vòng Trang chủ: nhãn mono, phần trăm đúng, 'Còn' / 'Vượt', không chèn HTML", ()=>{
      const g = app.ev(`teSig.gaugeHTML({ kcal:800, goal:2000, p:50, c:90, f:20, pt:120, ct:250, ft:60 })`);
      assert.match(g, /class="sig-mono">Năng lượng hôm nay/); assert.match(g, /M 22 104 A 88 88 0 0 1 198 104/);
      assert.match(g, /stroke-dasharray:40\.00 100/); assert.match(g, /Còn 1\.200/);
      assert.equal((g.match(/class="sig-mac m-/g) || []).length, 3);
      const over = app.ev(`teSig.gaugeHTML({ kcal:2300, goal:2000, p:0, c:0, f:0, pt:0, ct:0, ft:0 })`);
      assert.match(over, /sig-gauge is-over/); assert.match(over, /Vượt 300/); assert.match(over, /stroke-dasharray:100\.00 100/);
      const zero = app.ev(`teSig.gaugeHTML({ kcal:0, goal:0, p:0, c:0, f:0 })`);
      assert.doesNotMatch(zero, /NaN|undefined/);
    });

    t.test("Hồ sơ (hero + thẻ thống kê minh hoạ), Trang chủ, typewriter Sanctuary: chạy qua wrapper, không lỗi console", async ()=>{
      ["renderProfileScreen","renderHomeScreen","renderOnboardProgress","goto"].forEach(fn=> assert.equal(app.ev(`typeof ${fn}`), "function"));
      for(const id of [...PACKS, "navy", "light"]){
        app.run(`fkTheme.set(${JSON.stringify(id)}); renderHomeScreen(); renderProfileScreen(); goto("profile"); goto("home");`);
      }
      await app.settle(80);
      assert.match(SJS, /if\(OFF\.typewriter \|\| theme\(\) !== "sanctuary"\) return;/, "typewriter chỉ khi bật Sanctuary");
      assert.match(SJS, /wrapGlobal\("renderProfileScreen", decorateProfile\)/); assert.match(SJS, /wrapGlobal\("renderHomeScreen", decorateHome\)/);
      const errs = app.consoleLog.filter(c=> c[0] === "error" || (c[0] === "warn" && /ui-signature|theme-packs|\[themes\]/.test(c[1]))).map(c=> c[1]);
      assert.deepEqual(errs.concat(app.asyncErrors.map(e=> String(e))), []);
      app.run("fkTheme.set('navy')");
    });

    t.test("Thẻ chọn bo lớn có số 01/02 (lớp chung .sig-choices/.sig-choice + onboarding + program builder)", ()=>{
      assert.match(SCSS, /:is\(\.sig-choices, #goal-list, #activity-list, \.pb-grid\)\{ counter-reset:sigc; \}/);
      assert.match(SCSS, /content:counter\(sigc, decimal-leading-zero\)/);
      assert.match(SCSS, /border-radius:var\(--sig-choice-r, 24px\)/);
    });

    t.test("Lớp màu module đã sinh lại cho MỌI CSS module (gen_themes_layer.py --modules)", ()=>{
      const SKIP = ["style.css","themes.css","themes-modules.css","ui-kit.css","brand.css","theme-packs.css","ui-signature.css"];
      const mods = fs.readdirSync(APP_DIR).filter(f=> f.endsWith(".css") && !SKIP.includes(f)).sort();
      const tm = read("themes-modules.css");
      const src = (tm.match(/Nguồn: ([^—]+) —/) || [])[1] || "";
      assert.deepEqual(src.split(",").map(s=> s.trim()).filter(Boolean), mods, "themes-modules.css chưa gồm mọi CSS module");
      assert.doesNotMatch(tm, /var\((--[\w-]+)\s*,\s*var\(\1\)\)/, "còn var(--x, var(--x)) thừa");
      let py = null;
      try{
        py = execFileSync("python3", ["-c", "import sys,os; sys.path.insert(0, os.path.join(sys.argv[1], 'scripts')); import gen_themes_layer as g; " +
          "fs = sorted(f for f in os.listdir(sys.argv[1]) if f.endswith('.css') and f not in g.SKIP_CSS); sys.stdout.write(g.modules_layer(fs)[0])", APP_DIR],
          { encoding:"utf8", stdio:["ignore", "pipe", "ignore"], timeout:60000 });
      }catch(e){ py = null; }   // máy không có python3 → chỉ kiểm danh sách nguồn
      if(py != null) assert.equal(py, tm, "themes-modules.css cũ — chạy lại: python3 scripts/gen_themes_layer.py --modules");
    }, { timeout: 70000 });

    t.test("Tài liệu docs/THEME-PACKS.md: có Trạng thái, cách thêm gói mới, giới hạn", ()=>{
      const doc = read("docs/THEME-PACKS.md");
      assert.match(doc, /## Trạng thái/); assert.match(doc, /Thêm gói mới/i); assert.match(doc, /fkTheme\.register/);
      for(const id of PACKS) assert.ok(doc.includes(id), "doc thiếu " + id);
    });
  },
};

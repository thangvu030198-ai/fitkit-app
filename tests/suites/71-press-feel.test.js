/* =========================================================================
   Cảm giác bấm (press-feel.js + press-feel.css) — docs/PRESS-FEEL.md
   Chạy riêng: node tests/run.js --only 71-press
   - pointerdown → .is-pressed ngay; pointerup → gỡ (lò xo rồi dọn lớp); kéo > 8 px → huỷ; disabled / slider → không áp
   - Kính: phần tử có backdrop-filter KHÔNG bị scale (.pf-glass), nút nhỏ có kính → tạm tắt blur (.pf-noblur)
   - prefers-reduced-motion → .pf-still, không gợn sóng; CSS không có transform trong media reduce
   - Rung: Capacitor giả (impact LIGHT/MEDIUM, selection, notification SUCCESS), web → navigator.vibrate; công tắc tắt → không rung
   - fkBusy: khoá bấm đôi + spinner; listener async tự khoá; data-busy; công tắc "Rung khi chạm" ở Hồ sơ
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const sleep = ms=> new Promise(r=> setTimeout(r, ms));

/* Phần tử giả có closest/matches/querySelector theo selector đơn giản (giống 69-morph-icons) */
const FAKE = `
(function(){
  function parseSimple(s){
    const o = { tag:null, id:null, cls:[], attrs:[] };
    s = s.replace(/\\[([\\w-]+)(?:=(?:"([^"]*)"|([^\\]]*)))?\\]/g, (m, k, v1, v2)=>{ o.attrs.push([k, v1 !== undefined ? v1 : (v2 !== undefined ? v2 : null)]); return ""; });
    s = s.replace(/#([\\w-]+)/g, (m, v)=>{ o.id = v; return ""; });
    s = s.replace(/\\.([\\w-]+)/g, (m, v)=>{ o.cls.push(v); return ""; });
    if(s.trim()) o.tag = s.trim().toUpperCase();
    return o;
  }
  function matchSimple(el, o){
    if(!el || !el.classList) return false;
    if(o.tag && el.tagName !== o.tag) return false;
    if(o.id && el.id !== o.id) return false;
    if(!o.cls.every(c=> el.classList.contains(c))) return false;
    return o.attrs.every(([k, v])=>{ const a = el.getAttribute(k); return v === null ? a !== null : a === v; });
  }
  function matchSel(el, sel){
    return String(sel).split(",").some(part=>{
      const ps = part.trim().split(/\\s+/).map(parseSimple);
      if(!matchSimple(el, ps[ps.length-1])) return false;
      let cur = el.parentNode, i = ps.length - 2;
      while(i >= 0 && cur){ if(matchSimple(cur, ps[i])) i--; cur = cur.parentNode; }
      return i < 0;
    });
  }
  class FE extends document.Element {
    constructor(tag, opts){
      super(tag); opts = opts || {};
      if(opts.cls) this.className = opts.cls;
      if(opts.id) this.id = opts.id;
      Object.entries(opts.attrs || {}).forEach(([k, v])=> this.setAttribute(k, v));
      this._css = {};
      const self = this;
      this.style = { _p:{}, setProperty(k, v){ this._p[k] = v; }, removeProperty(k){ delete this._p[k]; }, getPropertyValue(k){ return this._p[k] || ""; } };
    }
    matches(sel){ return matchSel(this, sel); }
    closest(sel){ let c = this; while(c){ if(c.matches && matchSel(c, sel)) return c; c = c.parentNode; } return null; }
    querySelectorAll(sel){ const out = []; (function walk(n){ (n.children || []).forEach(ch=>{ if(ch.classList && matchSel(ch, sel)) out.push(ch); walk(ch); }); })(this); return out; }
    querySelector(sel){ return this.querySelectorAll(sel)[0] || null; }
    contains(n){ while(n){ if(n === this) return true; n = n.parentNode; } return false; }
    getBoundingClientRect(){ const w = this._w || 120, h = this._h || 44; return { left:10, top:20, right:10+w, bottom:20+h, width:w, height:h, x:10, y:20 }; }
  }
  window.__FE = FE;
  document.createElement = t=> new FE(t);       // phần tử do press-feel tạo (gợn sóng, spinner) cũng đọc được style
  window.__mk = function(tag, opts, kids){ const e = new FE(tag, opts); (kids || []).forEach(k=> e.appendChild(k)); return e; };
  /* getComputedStyle giả: el._bf = "blur(16px)" (bị .pf-noblur gỡ nếu el._bfSoft) */
  window.__gcs = function(el){
    let bf = el && el._bf || "none";
    if(el && el._bfSoft && el.classList.contains("pf-noblur")) bf = "none";
    return { display:"block", position:"static", color:"rgb(6, 26, 36)", backdropFilter: bf, transform: el && el._tf || "none", getPropertyValue(){ return ""; } };
  };
  window.getComputedStyle = window.__gcs;
  window.__ev = function(type, target, x, y, extra){
    return Object.assign({ type, target, clientX: x == null ? 30 : x, clientY: y == null ? 40 : y, pointerId: 1, isPrimary: true, button: 0, isTrusted: true,
      preventDefault(){ this.defaultPrevented = true; }, stopPropagation(){ this.stopped = true; }, stopImmediatePropagation(){ this.stopped = true; } }, extra || {});
  };
  /* Capacitor giả */
  window.__installCap = function(native){
    const log = window.__hap = [];
    window.Capacitor = { isNativePlatform: ()=> native !== false, Plugins: { Haptics: {
      impact(o){ log.push("impact:" + o.style); return Promise.resolve(); },
      notification(o){ log.push("notification:" + o.type); return Promise.resolve(); },
      selectionStart(){ log.push("selStart"); return Promise.resolve(); },
      selectionChanged(){ log.push("selChanged"); return Promise.resolve(); },
      selectionEnd(){ log.push("selEnd"); return Promise.resolve(); },
    } } };
    return log;
  };
  window.__vib = [];
  navigator.vibrate = function(p){ window.__vib.push(p); return true; };
})();`;

/* ấn: down → (move) → up → click */
const TAP = `window.__tap = function(el, opt){ opt = opt || {};
  const H = fkPress._h;
  H.onDown(__ev("pointerdown", el));
  if(opt.move) H.onMove(__ev("pointermove", el, 30 + opt.move, 40));
  H.onUp(__ev("pointerup", el));
  const c = __ev("click", el); H.onClick(c); return c; };`;

async function mkApp(t){
  const app = await t.app({});
  app.run(FAKE); app.run(TAP);
  app.run(`fkPress._h.reset(); state.pressFeel = undefined;`);
  return app;
}

module.exports = {
  name: "Cảm giác bấm (press-feel)",
  area: "press-feel.js · press-feel.css · index.html/sw.js/prepare-www.sh/build-single-html.py/package.json",
  async define(t){
    t.test("Nạp & gắn đúng chỗ: CSS ngay trước brand.css (brand → themes-modules cuối), JS ngay trước morph-icons.js, health-safety.js cuối", async ()=>{
      const app = await t.app({});
      assert.equal(app.loadErrors.length, 0, app.loadErrors.map(e=> e.file + ": " + e.error).join("\n"));
      assert.equal(app.ev("typeof fkPress"), "object"); assert.equal(app.ev("typeof fkBusy"), "function");
      const html = read("index.html");
      const css = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)].map(m=> m[1]).filter(h=> !/^https?:/.test(h));
      assert.deepEqual(css.slice(-3), ["press-feel.css", "brand.css", "themes-modules.css"]);
      const sc = [...html.matchAll(/<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(m=> m[1]).filter(s=> !/^https?:/.test(s) && !/kb-data|exdb-vi-\d/.test(s));
      assert.deepEqual(sc.slice(-3), ["press-feel.js", "morph-icons.js", "health-safety.js"]);
      const sw = read("sw.js"), sh = read("scripts/prepare-www.sh"), py = read("scripts/build-single-html.py"), pkg = JSON.parse(read("package.json"));
      assert.ok(sw.includes('"./press-feel.js"') && sw.includes('"./press-feel.css"'), "sw.js ASSETS");
      assert.ok(/press-feel\.js \\/.test(sh) && /cp press-feel\.css www\//.test(sh), "prepare-www.sh chép 2 file");
      assert.ok(/press-feel\.css/.test(py) && /press-feel\.js/.test(py), "build-single-html.py kiểm 2 file");
      assert.match(pkg.dependencies["@capacitor/haptics"] || "", /^\^?6\./, "@capacitor/haptics 6.x");
      assert.ok(app.ev("toast.__pfWrapped && finishSession.__pfWrapped && setAuthBusy.__pfWrapped"), "bọc toast/finishSession/setAuthBusy (renderProfileScreen: health-safety.js bọc thêm lớp ngoài — kiểm bằng hành vi ở test công tắc)");
      // listener uỷ quyền 1 lần trên document (capture)
      const L = app.dom._listeners;
      for(const ty of ["pointerdown", "pointermove", "pointerup", "pointercancel", "click"]) assert.ok((L[ty] || []).length >= 1, "thiếu listener " + ty);
    });

    t.test("pointerdown thêm .is-pressed NGAY; pointerup gỡ; sau lò xo (≈280 ms) dọn .pf-armed", async ()=>{
      const app = await mkApp(t);
      app.run(`window.__b = __mk("button", { cls:"btn btn-outline" });
        fkPress._h.onDown(__ev("pointerdown", __b));
        window.__r1 = { p: __b.classList.contains("is-pressed"), a: __b.classList.contains("pf-armed"), s: __b.style._p["--pf-s"] };
        fkPress._h.onUp(__ev("pointerup", __b));
        window.__r15 = __b.classList.contains("is-pressed");`);
      assert.deepEqual(app.evj("__r1"), { p:true, a:true, s:"0.96" }, "nút nhỏ lún 0,96");
      assert.equal(app.ev("__r15"), true, "chạm quá nhanh: giữ lún tối thiểu 90 ms để mắt kịp thấy");
      await sleep(110);
      app.run(`window.__r2 = { p: __b.classList.contains("is-pressed"), a: __b.classList.contains("pf-armed") };`);
      assert.deepEqual(app.evj("__r2"), { p:false, a:true }, "thả: gỡ is-pressed, giữ armed cho lò xo");
      await sleep(330);
      assert.equal(app.ev("__b.classList.contains('pf-armed')"), false, "dọn lớp sau lò xo");
      // thẻ lớn → 0,98; con bên trong (svg/span) vẫn tìm được nút cha
      app.run(`window.__c = __mk("div", { cls:"card", attrs:{ onclick:"x()" } }, [__mk("span", { cls:"t" })]);
        fkPress._h.onDown(__ev("pointerdown", __c.children[0]));`);
      assert.equal(app.ev("__c.classList.contains('is-pressed') && __c.classList.contains('pf-big')"), true);
      assert.equal(app.ev("__c.style._p['--pf-s']"), "0.98");
      app.run(`fkPress._h.onCancel();`);
      assert.equal(app.ev("__c.classList.contains('is-pressed')"), false, "pointercancel/cuộn → huỷ");
    });

    t.test("Kéo/cuộn > 8 px → huỷ nhấn; ≤ 8 px vẫn giữ", async ()=>{
      const app = await mkApp(t);
      const r = app.evj(`(()=>{
        const b = __mk("button", { cls:"pill" }); const H = fkPress._h;
        H.onDown(__ev("pointerdown", b, 100, 100));
        H.onMove(__ev("pointermove", b, 105, 104));            // 6,4 px
        const keep = b.classList.contains("is-pressed");
        H.onMove(__ev("pointermove", b, 100, 109));            // 9 px
        const gone = !b.classList.contains("is-pressed");
        return { keep, gone, cur: H.current() }; })()`);
      assert.deepEqual(r, { keep:true, gone:true, cur:null });
    });

    t.test("Không áp khi disabled / aria-disabled / slider / input range / data-no-press", async ()=>{
      const app = await mkApp(t);
      const r = app.evj(`(()=>{
        const H = fkPress._h, out = {};
        const d = __mk("button", { cls:"btn" }); d.disabled = true;
        const a = __mk("button", { cls:"btn", attrs:{ "aria-disabled":"true" } });
        const thumb = __mk("div", { cls:"sig-slide-thumb", attrs:{ role:"button" } });
        const rng = __mk("input", { attrs:{ type:"range" } });
        const np = __mk("button", { cls:"btn", attrs:{ "data-no-press":"" } });
        const fs = __mk("button", { cls:"btn" }); __mk("fieldset", { attrs:{ disabled:"" } }, [fs]);
        [["d", d], ["a", a], ["thumb", thumb], ["rng", rng], ["np", np], ["fs", fs]].forEach(([k, el])=>{
          H.onDown(__ev("pointerdown", el)); out[k] = el.classList.contains("is-pressed") || el.classList.contains("pf-armed"); H.onUp(__ev("pointerup", el)); });
        return out; })()`);
      assert.deepEqual(r, { d:false, a:false, thumb:false, rng:false, np:false, fs:false });
    });

    t.test("KHÔNG scale phần tử đang có backdrop-filter: thẻ kính → .pf-glass; nút nhỏ kính → tạm tắt blur (.pf-noblur), không gỡ được → .pf-glass", async ()=>{
      const app = await mkApp(t);
      const r = app.evj(`(()=>{
        const H = fkPress._h, o = {};
        const card = __mk("div", { cls:"list-item", attrs:{ onclick:"go()" } }); card._bf = "blur(16px)";
        H.onDown(__ev("pointerdown", card)); o.card = ["pf-glass","pf-noblur","is-pressed"].map(c=> card.classList.contains(c)); H.onCancel();
        const pill = __mk("button", { cls:"pill" }); pill._bf = "blur(14px)"; pill._bfSoft = true;          // CSS .pf-noblur gỡ được blur
        H.onDown(__ev("pointerdown", pill)); o.pill = ["pf-glass","pf-noblur","is-pressed"].map(c=> pill.classList.contains(c)); H.onCancel();
        const hard = __mk("button", { cls:"icon-btn" }); hard._bf = "blur(16px)";                           // luật khác giữ blur (!important)
        H.onDown(__ev("pointerdown", hard)); o.hard = ["pf-glass","pf-noblur","is-pressed"].map(c=> hard.classList.contains(c)); H.onCancel();
        const kid = __mk("span", { cls:"pill" }); kid._bf = "blur(14px)";                                   // CON có kính → cha cũng không scale
        const box = __mk("div", { cls:"card", attrs:{ onclick:"go()" } }, [kid]);
        H.onDown(__ev("pointerdown", box)); o.box = box.classList.contains("pf-glass"); H.onCancel();
        const solid = __mk("button", { cls:"btn btn-primary" });
        H.onDown(__ev("pointerdown", solid)); o.solid = ["pf-glass","pf-noblur","pf-solid"].map(c=> solid.classList.contains(c)); H.onCancel();
        return o; })()`);
      assert.deepEqual(r.card, [true, false, true], "thẻ kính: chỉ phủ màu, không scale");
      assert.deepEqual(r.pill, [false, true, true], "pill kính: tắt blur tạm rồi mới scale");
      assert.deepEqual(r.hard, [true, false, true], "không tắt được blur → không scale");
      assert.equal(r.box, true, "con có blur → cha không scale");
      assert.deepEqual(r.solid, [false, false, true], "CTA nền đặc: scale + tối nhẹ");
      // CSS: mọi luật .is-pressed có transform scale đều loại trừ .pf-glass; .pf-glass ép transform:none; .pf-noblur gỡ blur
      const css = read("press-feel.css").replace(/\/\*[\s\S]*?\*\//g, "");
      const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m=> [m[1].trim(), m[2]]);
      const scaling = rules.filter(([sel, body])=> /transform:\s*translateY\(1px\) scale/.test(body));
      assert.ok(scaling.length >= 1);
      scaling.forEach(([sel])=> sel.split(",").forEach(s=> assert.ok(/:not\(\.pf-glass\)/.test(s) && /:not\(\.pf-still\)/.test(s), "luật scale thiếu :not(.pf-glass)/:not(.pf-still): " + s)));
      assert.ok(rules.some(([sel, b])=> /\.pf-glass\.is-pressed/.test(sel) && /transform:none !important/.test(b)), ".pf-glass.is-pressed transform:none");
      assert.ok(rules.some(([sel, b])=> /\.pf-noblur/.test(sel) && /backdrop-filter:none !important/.test(b) && /-webkit-backdrop-filter:none !important/.test(b)), ".pf-noblur gỡ blur");
      assert.ok(!rules.some(([sel, b])=> /\.pf-noblur/.test(sel) && /transform/.test(b)), "không gộp transform vào luật kính");
    });

    t.test("prefers-reduced-motion → không scale (.pf-still), không gợn sóng; CSS media reduce bỏ transform/ripple", async ()=>{
      const app = await mkApp(t);
      const r = app.evj(`(()=>{
        window.matchMedia = q=> ({ matches: /reduce/.test(q), addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
        const b = __mk("button", { cls:"btn btn-primary" });
        fkPress._h.onDown(__ev("pointerdown", b));
        const o = { still: b.classList.contains("pf-still"), pressed: b.classList.contains("is-pressed"), rpl: b.querySelectorAll(".pf-rpl").length };
        fkPress._h.onUp(__ev("pointerup", b));
        const t = __mk("span", { cls:"toggle", attrs:{ role:"switch" } }); fkPress._h.onClick(__ev("click", t)); o.pop = t.classList.contains("pf-pop");
        return o; })()`);
      assert.deepEqual(r, { still:true, pressed:true, rpl:0, pop:false }, "vẫn đổi màu nền (is-pressed) nhưng không scale/sóng/nảy");
      const css = read("press-feel.css");
      const m = css.match(/@media \(prefers-reduced-motion: reduce\)\{([\s\S]*?)\n\}/);
      assert.ok(m, "có khối reduced-motion");
      assert.match(m[1], /\.is-pressed:not\(\.pf-still\)[^{]*\{ transform:none !important;/);
      assert.match(m[1], /\.pf-rpl\{ display:none !important; \}/);
      assert.match(m[1], /animation:none !important/);
    });

    t.test("Gợn sóng: chỉ CTA + item danh sách; gỡ sau khi thả; theo token (currentColor / --mint)", async ()=>{
      const app = await mkApp(t);
      const r = app.evj(`(()=>{
        const H = fkPress._h;
        const cta = __mk("button", { cls:"btn btn-primary" }); H.onDown(__ev("pointerdown", cta, 40, 30));
        const o = { cta: cta.querySelectorAll(".pf-rpl").length, pos: cta.style.position };
        const dot = cta.querySelector(".pf-rpl").children[0]; o.x = dot.style._p["--x"]; o.y = dot.style._p["--y"];
        H.onUp(__ev("pointerup", cta));
        const pill = __mk("button", { cls:"pill" }); H.onDown(__ev("pointerdown", pill)); o.pill = pill.querySelectorAll(".pf-rpl").length; H.onCancel();
        const li = __mk("div", { cls:"list-item", attrs:{ onclick:"a()" } }); H.onDown(__ev("pointerdown", li)); o.li = li.querySelectorAll(".pf-rpl").length; H.onUp(__ev("pointerup", li));
        window.__cta = cta; return o; })()`);
      assert.deepEqual(r, { cta:1, pos:"relative", x:"30px", y:"10px", pill:0, li:1 });
      await sleep(560);   // giữ lún tối thiểu 90 ms + mờ dần 420 ms
      assert.equal(app.ev("__cta.querySelectorAll('.pf-rpl').length"), 0, "gỡ gợn sóng sau khi mờ dần");
      const css = read("press-feel.css");
      assert.match(css, /var\(--pf-ripple, currentColor\)/); assert.match(css, /\.list-item \.pf-rpl > i\{ --pf-ripple:var\(--mint\)/);
    });

    t.test("Rung (Capacitor giả): chạm thường LIGHT, CTA/tick hiệp MEDIUM, tab/chip selection, lưu xong/Xong buổi SUCCESS", async ()=>{
      const app = await mkApp(t);
      app.run(`__installCap(true);`);
      const seq = [
        [`__mk("button", { cls:"btn btn-outline" })`, ["impact:LIGHT"]],
        [`__mk("button", { cls:"btn btn-primary" })`, ["impact:MEDIUM"]],
        [`__mk("button", { cls:"set-check", attrs:{ "data-done":"0" } })`, ["impact:MEDIUM"]],
        [`__mk("nav", { cls:"bottom-nav" }, [__mk("button", { cls:"nav-item" })]).children[0]`, ["selStart", "selChanged", "selEnd"]],
        [`__mk("button", { cls:"pill" })`, ["selStart", "selChanged", "selEnd"]],
        [`__mk("button", { cls:"btn", attrs:{ "data-haptic":"none" } })`, []],
      ];
      for(const [mk, want] of seq){
        app.run(`fkPress._h.reset(); __hap.length = 0; __tap(${mk});`);
        await sleep(5);
        assert.deepEqual(app.evj("__hap"), want, mk);
      }
      // click lập trình (không có pointerdown gần đây) → không rung
      app.run(`fkPress._h.reset(); __hap.length = 0; fkPress._h.onClick(__ev("click", __mk("button", { cls:"btn" })));`);
      assert.deepEqual(app.evj("__hap"), []);
      // toast thành công ngay sau một chạm → notification SUCCESS; toast lỗi → ERROR
      app.run(`fkPress._h.reset(); __tap(__mk("button", { cls:"btn" })); __hap.length = 0; toast("Đã lưu"); `);
      await sleep(5);
      assert.deepEqual(app.evj("__hap"), ["notification:SUCCESS"]);
      app.run(`__hap.length = 0; toast("Lỗi mạng", "error");`); await sleep(5);
      assert.deepEqual(app.evj("__hap"), ["notification:ERROR"]);
      // finishSession (Xong buổi tập) → SUCCESS (gọi bản bọc với hàm gốc giả)
      const r = app.evj(`(()=>{ fkPress._h.reset(); __hap.length = 0; return fkPress.haptic("success"); })()`);
      assert.equal(r, true); assert.deepEqual(app.evj("__hap"), ["notification:SUCCESS"]);
      assert.match(read("press-feel.js"), /wrapGlobal\("finishSession"[\s\S]{0,200}haptic\("success"\)/, "finishSession → rung success");
      // không phải native (web trong Capacitor) → navigator.vibrate
      app.run(`__installCap(false); fkPress._h.reset(); __vib.length = 0; __tap(__mk("button", { cls:"btn" })); fkPress._h.reset(); __tap(__mk("button", { cls:"btn btn-primary" }));`);
      assert.deepEqual(app.evj("__vib"), [10, 15], "web: vibrate 10 ms (chạm) / 15 ms (CTA)");
    });

    t.test("Tắt công tắc 'Rung khi chạm' → không rung (native lẫn web); mặc định BẬT; lưu state.pressFeel", async ()=>{
      const app = await mkApp(t);
      app.run(`__installCap(true);`);
      assert.equal(app.ev("fkPress.enabled()"), true, "mặc định bật");
      app.run(`fkPress.set(false);`);
      assert.deepEqual(app.evj("state.pressFeel"), { haptic:false });
      assert.ok(/"pressFeel":\{"haptic":false\}/.test(app.localStorage.getItem("fitkit_state_v1")), "đã saveState");
      app.run(`__hap.length = 0; __vib.length = 0; __tap(__mk("button", { cls:"btn btn-primary" })); fkPress.haptic("success");
        delete window.Capacitor; fkPress._h.reset(); __tap(__mk("button", { cls:"btn" }));`);
      assert.deepEqual(app.evj("__hap"), []); assert.deepEqual(app.evj("__vib"), []);
      app.run(`fkPress.set(true); fkPress._h.reset(); __tap(__mk("button", { cls:"btn" }));`);
      assert.deepEqual(app.evj("__vib"), [10]);
      // thẻ cài đặt trong Hồ sơ: renderProfileScreen → #pf-card có công tắc role=switch; bấm → đổi state
      app.run(`renderProfileScreen();`);
      const html = app.ev(`document.getElementById("pf-card").innerHTML`);
      assert.match(html, /Rung khi chạm/); assert.match(html, /role="switch" aria-checked="true"/); assert.match(html, /class="toggle on"/);
      app.run(`(()=>{ const card = document.getElementById("pf-card"); const sw = __mk("button", { id:"pf-haptic-sw" });
        card._listeners.click[0]({ target: sw }); })()`);
      assert.equal(app.ev("fkPress.enabled()"), false, "bấm công tắc → tắt");
    });

    t.test("fkBusy: khoá bấm đôi + spinner (sau 120 ms) + mở khi xong; listener async tự khoá; data-busy mở khi có toast", async ()=>{
      const app = await mkApp(t);
      app.run(`window.__b = __mk("button", { cls:"btn btn-primary" }); let res; window.__p = new Promise(r=> res = r); window.__res = res;
        window.__ret = fkBusy(__b, __p);`);
      assert.equal(app.ev("__ret === __p"), true, "trả lại đúng promise");
      assert.equal(app.ev("__b.getAttribute('data-pf-busy') + '|' + __b.getAttribute('aria-busy')"), "1|true");
      let c = app.ev(`(()=>{ const e = __ev("click", __b); fkPress._h.onClick(e); return !!e.stopped && !!e.defaultPrevented; })()`);
      assert.equal(c, true, "đang chờ → chặn bấm lần 2");
      assert.equal(app.ev("__b.querySelectorAll('.pf-spin').length"), 0, "chưa hiện spinner ngay (tránh nháy)");
      await sleep(150);
      assert.equal(app.ev("__b.querySelectorAll('.pf-spin').length + '|' + __b.classList.contains('pf-busy')"), "1|true");
      app.run(`__res(1);`); await sleep(5);
      assert.equal(app.ev("__b.querySelectorAll('.pf-spin').length + '|' + __b.getAttribute('data-pf-busy') + '|' + __b.classList.contains('pf-busy')"), "0|null|false");
      // promise lỗi cũng mở khoá
      app.run(`window.__b2 = __mk("button", { cls:"btn" }); fkBusy(__b2, Promise.reject(new Error("x"))).catch(()=>{});`); await sleep(5);
      assert.equal(app.ev("__b2.getAttribute('data-pf-busy')"), null);
      // listener click async gắn sau khi nạp → tự khoá nút
      app.run(`window.__b3 = __mk("button", { cls:"btn" }); let r3; window.__p3 = new Promise(r=> r3 = r); window.__r3 = r3;
        __b3.addEventListener("click", async ()=>{ await __p3; });
        __b3.dispatchEvent(__ev("click", __b3, 0, 0, { currentTarget: __b3 }));`);
      assert.equal(app.ev("__b3.getAttribute('data-pf-busy')"), "1", "async listener → khoá");
      app.run(`__r3();`); await sleep(5);
      assert.equal(app.ev("__b3.getAttribute('data-pf-busy')"), null);
      // data-busy: khoá khi bấm, mở khi app báo toast
      app.run(`window.__b4 = __mk("button", { cls:"btn", attrs:{ "data-busy":"" } }); fkPress._h.reset(); __tap(__b4);`);
      assert.equal(app.ev("__b4.getAttribute('data-pf-busy')"), "1");
      app.run(`toast("Đã lưu");`);
      assert.equal(app.ev("__b4.getAttribute('data-pf-busy')"), null);
      // setAuthBusy (đăng nhập) → spinner ngay trên #au-submit
      app.run(`window.__au = document.getElementById("au-submit"); setAuthBusy(true);`); await sleep(5);
      assert.equal(app.ev("__au.getAttribute('data-pf-busy')"), "1");
      app.run(`setAuthBusy(false);`);
      assert.equal(app.ev("__au.getAttribute('data-pf-busy')"), null);
    });

    t.test("Công tắc/tick: nảy nhẹ (.pf-pop) — hàng công tắc nảy núm; phần tử có kính nảy lớp con, không nảy chính nó", async ()=>{
      const app = await mkApp(t);
      const r = app.evj(`(()=>{
        const H = fkPress._h, o = {};
        const tick = __mk("button", { cls:"set-check" }); H.onClick(__ev("click", tick)); o.tick = tick.classList.contains("pf-pop");
        const tg = __mk("span", { cls:"toggle" }); const row = __mk("button", { cls:"pf-row", attrs:{ role:"switch" } }, [__mk("span", { cls:"t" }), tg]);
        H.onClick(__ev("click", row.children[0])); o.knob = tg.classList.contains("pf-pop"); o.row = row.classList.contains("pf-pop");
        const inner = __mk("span", { cls:"material-symbols-rounded" }); const fav = __mk("button", { cls:"icon-btn np-fav", attrs:{ "aria-pressed":"false" } }, [inner]); fav._bf = "blur(16px)";
        H.onClick(__ev("click", fav)); o.fav = fav.classList.contains("pf-pop"); o.inner = inner.classList.contains("pf-pop");
        return o; })()`);
      assert.deepEqual(r, { tick:true, knob:true, row:false, fav:false, inner:true });
      await sleep(450);
      assert.equal(app.ev("document.querySelectorAll('.pf-pop').length"), 0);
      const css = read("press-feel.css");
      assert.match(css, /@keyframes pfPop/); assert.match(css, /\.toggle\.pf-pop::after\{ animation:pfKnob/);
    });

    t.test("CSS: bỏ trễ chạm (touch-action/tap-highlight/user-select/cursor), chỉ token theme, chữ ≥ 12 px, không font: … inherit", async ()=>{
      const css = read("press-feel.css");
      assert.match(css, /touch-action:manipulation; -webkit-tap-highlight-color:transparent;/);
      assert.match(css, /-webkit-user-select:none; user-select:none;/);
      assert.match(css, /\{ cursor:pointer; \}/);
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/#onboarding/g, "")), "không mã màu hex cứng");
      assert.ok(!/rgba\((?!var\(|0,0,0)/.test(css), "rgba chỉ dùng biến token hoặc đen (bóng)");
      assert.ok(!/font:[^;]*inherit/.test(css), "không dùng font: … inherit");
      for(const m of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(+m[1] >= 12, "chữ < 12px");
      assert.match(css, /min-height:var\(--fk-tap, 44px\)/, "hàng công tắc ≥ 44 px");
      // lớp màu module đã sinh lại (themes-modules.css gồm press-feel.css)
      assert.match(read("themes-modules.css"), /press-feel\.css/);
    });
  }
};

/* =========================================================================
   Icon biến hình (morph-icons.js + thư viện morphicons tự host) — docs/MORPH-ICONS.md
   Chạy riêng: node tests/run.js --only 69-morph
   - FK_LINE → 1 chuỗi d tuyệt đối HỢP LỆ (kiểm bằng bộ đọc path độc lập trong file này)
   - fkMorph không lỗi khi thiếu thư viện / tên lạ / host rỗng → đổi icon tức thì
   - Thư viện GIẢ (window.Morphicons.createMorph) → morphTo đúng icon đích ở menu, play/pause, tick, tim, …
   - prefers-reduced-motion → đổi tức thì, không tạo morph
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const sleep = ms=> new Promise(r=> setTimeout(r, ms));

/* Bộ kiểm path SVG độc lập (không dùng mã của morph-icons.js) */
const ARGN = { M:2, L:2, H:1, V:1, C:6, S:4, Q:4, T:2, A:7, Z:0 };
function checkD(d){
  assert.equal(typeof d, "string", "d phải là chuỗi");
  assert.ok(/^M/.test(d), "d phải bắt đầu bằng M tuyệt đối: " + d);
  assert.ok(!/[a-z]/.test(d.replace(/e[+-]?\d/g, "")), "chỉ dùng lệnh TUYỆT ĐỐI (chữ hoa): " + d);
  assert.ok(!/NaN|Infinity|undefined/.test(d), "số lỗi trong d: " + d);
  const segs = d.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/g) || [];
  assert.equal(segs.join(""), d, "ký tự lạ ngoài lệnh: " + d);
  let n = 0;
  for(const s of segs){
    const c = s[0], nums = (s.slice(1).match(/-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi) || []).map(Number);
    if(c === "Z"){ assert.equal(nums.length, 0, "Z không có số"); continue; }
    assert.ok(nums.length > 0 && nums.length % ARGN[c] === 0, `lệnh ${c} sai số tham số (${nums.length}) trong ${d}`);
    nums.forEach(v=> assert.ok(Number.isFinite(v), "số không hữu hạn"));
    if(c === "A") for(let i = 0; i < nums.length; i += 7){ assert.ok(nums[i+3] === 0 || nums[i+3] === 1, "cờ cung"); assert.ok(nums[i+4] === 0 || nums[i+4] === 1, "cờ cung"); }
    n++;
  }
  assert.ok(n >= 2, "d quá ngắn: " + d);
}

/* Phần tử giả có closest/matches/querySelector theo selector đơn giản (đủ cho các điểm áp dụng) — dựng trong vm */
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
    }
    matches(sel){ return matchSel(this, sel); }
    closest(sel){ let c = this; while(c){ if(c.matches && matchSel(c, sel)) return c; c = c.parentNode; } return null; }
    querySelectorAll(sel){ const out = []; (function walk(n){ (n.children || []).forEach(ch=>{ if(ch.classList && matchSel(ch, sel)) out.push(ch); walk(ch); }); })(this); return out; }
    querySelector(sel){ return this.querySelectorAll(sel)[0] || null; }
    get innerHTML(){ return this._html; }
    set innerHTML(v){ this._html = String(v); this.children.forEach(c=>{ c.parentNode = c.parentElement = null; }); this.children.length = 0; }
  }
  window.__FE = FE;
  window.__icon = function(name){ const s = new FE("span", { cls:"material-symbols-rounded" }); s.textContent = name; s.dataset.ic = name; s._text = ""; s._html = "<svg></svg>"; return s; };
  window.__mk = function(tag, opts, kids){ const e = new FE(tag, opts); (kids || []).forEach(k=> e.appendChild(k)); return e; };
  window.__installMock = function(){
    const log = window.__mm = [];
    window.Morphicons = { createMorph(el, icon, o){
      const rec = { el, init: icon, opts: o, to: [], sets: [], destroyed:false }; log.push(rec);
      el.setAttribute("d", icon);
      return { morphTo(i, s){ rec.to.push([i, s]); el.setAttribute("d", i); }, set(i){ rec.sets.push(i); el.setAttribute("d", i); }, seek(){}, progress: 1, reducedMotion: o && o.reducedMotion, destroy(){ rec.destroyed = true; } };
    } };
    return log;
  };
})();`;

module.exports = {
  name: "Icon biến hình (morphicons)",
  area: "morph-icons.js · vendor-morphicons.yml · index.html/sw.js/prepare-www.sh/build-single-html.py",
  async define(t){
    t.test("Nạp: fkMorph có mặt, không lỗi khi nạp; thẻ script defer ngay trước health-safety.js (vẫn cuối)", async ()=>{
      const app = await t.app({});
      assert.equal(app.loadErrors.length, 0, app.loadErrors.map(e=> e.file + ": " + e.error).join("\n"));
      assert.equal(app.ev("typeof fkMorph"), "function");
      assert.equal(app.ev("fkMorph.ready()"), false, "chưa có thư viện → chưa biến hình");
      const html = read("index.html");
      const scripts = [...html.matchAll(/<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/g)].map(m=> m[1]).filter(s=> !/^https?:/.test(s) && !/kb-data|exdb-vi-\d/.test(s));
      assert.equal(scripts[scripts.length-1], "health-safety.js", "health-safety.js phải là script cuối");
      assert.equal(scripts[scripts.length-2], "morph-icons.js", "morph-icons.js ngay trước health-safety.js");
      assert.ok(/<script src="morph-icons\.js" defer><\/script>/.test(html), "thẻ phải có defer");
      assert.ok(!/vendor\/morphicons/.test(html), "thư viện nạp lười — không có thẻ script tĩnh");
    });

    t.test("FK_LINE → d: mọi icon (và mọi icon morph dùng tới + biến thể) cho chuỗi d tuyệt đối hợp lệ", async ()=>{
      const app = await t.app({});
      const all = app.evj(`Object.keys(FK_LINE)`);
      const used = ["menu","close","play_arrow","pause","check","_ring","favorite","bookmark","visibility","visibility_off",
        "chevron_right","chevron_left","expand_more","expand_less","light_mode","dark_mode","palette","add",
        "home","fitness_center","restaurant","groups","person"];
      const variants = used.filter(n=> n[0] !== "_").flatMap(n=> ["_s:" + n, "_m:" + n]);
      const names = [...new Set(all.concat(used, variants))];
      const ds = app.evj(`(${JSON.stringify(names)}).map(n=> [n, fkMorph.d(n)])`);
      const missing = ds.filter(([n, d])=> !d).map(([n])=> n);
      assert.deepEqual(missing, [], "icon không đổi được: " + missing.join(", "));
      ds.forEach(([n, d])=>{ try{ checkD(d); }catch(e){ e.message = n + ": " + e.message; throw e; } });
      // hình học: tròn/chữ nhật → cung A đúng toạ độ; path tương đối → tuyệt đối
      assert.equal(app.ev(`fkMorph.spec2d("c:12,12,3")`), "M9 12A3 3 0 1 0 15 12A3 3 0 1 0 9 12Z");
      assert.equal(app.ev(`fkMorph.spec2d("r:3,4,18,18,2.5")`), "M5.5 4H18.5A2.5 2.5 0 0 1 21 6.5V19.5A2.5 2.5 0 0 1 18.5 22H5.5A2.5 2.5 0 0 1 3 19.5V6.5A2.5 2.5 0 0 1 5.5 4Z");
      assert.equal(app.ev(`fkMorph.spec2d("M18 6 6 18|M6 6l12 12")`), "M18 6L6 18M6 6L18 18");
      assert.equal(app.ev(`fkMorph.spec2d("m2 2 3 0h1v1z")`), "M2 2L5 2H6V3Z");
      assert.equal(app.ev(`fkMorph.d("_s:close")`), "M15 9L9 15M9 9L15 15", "biến thể thu nhỏ 50 % quanh tâm");
      // cờ cung viết dính ("a1 1 0 011 1") vẫn đọc đúng
      assert.equal(app.ev(`fkMorph.spec2d("M0 0a1 1 0 011 1")`), "M0 0A1 1 0 0 1 1 1");
      // path hỏng → null, không ném lỗi
      assert.equal(app.ev(`(()=>{ FK_LINE.__bad = "L1 2 x"; const d = fkMorph.d("__bad"); delete FK_LINE.__bad; return d; })()`), null);
    });

    t.test("Thiếu thư viện (offline / chưa vendor): fkMorph không lỗi, đổi icon tức thì giữ aria-label", async ()=>{
      const app = await t.app({});
      app.run(FAKE);
      const r = app.evj(`(()=>{
        delete window.Morphicons;
        const sp = __icon("menu"); const b = __mk("button", { cls:"icon-btn", attrs:{ "aria-label":"Mở menu" } }, [sp]);
        const out = { a: fkMorph(b, "close", { label:"Đóng menu" }), ic: sp.dataset.ic, svg: /M18 6 6 18/.test(sp.innerHTML), lbl: b.getAttribute("aria-label") };
        out.nul = fkMorph(null, "close"); out.empty = fkMorph(__mk("div"), "close");
        out.unknown = fkMorph(b, "khong_co_icon_nay"); out.ic2 = sp.dataset.ic;
        return out; })()`);
      assert.deepEqual(r, { a:false, ic:"close", svg:true, lbl:"Đóng menu", nul:false, empty:false, unknown:false, ic2:"khong_co_icon_nay" });
    });

    t.test("Thư viện giả: fkMorph tạo 1 path, createMorph(icon cũ, reducedMotion 'user', strokeWidth 1.8) → morphTo icon đích", async ()=>{
      const app = await t.app({});
      app.run(FAKE);
      const r = app.evj(`(()=>{
        const log = __installMock();
        const sp = __icon("play_arrow"); const b = __mk("button", {}, [sp]);
        const ok = fkMorph(b, "pause", { spring:"bouncy" });
        const rec = log[0], svg = sp.children[0];
        const ok2 = fkMorph(b, "play_arrow");             // lần 2: dùng lại instance (bay tiếp từ hình đang có)
        return { ok, ok2, n: log.length, init: rec.init, to: rec.to, opts: rec.opts, ic: sp.dataset.ic,
          tag: svg && svg.tagName, cls: svg && svg.getAttribute("class"), hid: svg && svg.getAttribute("aria-hidden"), kids: svg && svg.children.length,
          dPause: fkMorph.d("pause"), dPlay: fkMorph.d("play_arrow"), ready: fkMorph.ready() };
      })()`);
      assert.equal(r.ok, true); assert.equal(r.ok2, true); assert.equal(r.n, 1, "chỉ 1 instance cho 1 icon");
      assert.equal(r.init, r.dPlay); assert.deepEqual(r.to, [[r.dPause, "bouncy"], [r.dPlay, "smooth"]]);
      assert.deepEqual(r.opts, { reducedMotion:"user", strokeWidth:1.8 });
      assert.equal(r.ic, "play_arrow"); assert.equal(String(r.tag).toLowerCase(), "svg"); assert.equal(r.kids, 1, "gộp mọi path thành 1 path");
      assert.ok(/\bln\b/.test(r.cls) && /fk-mi/.test(r.cls)); assert.equal(r.hid, "true"); assert.equal(r.ready, true);
    });

    t.test("Menu ☰ → ✕ khi mở menu, ✕ → ☰ khi đóng sheet; aria-label Đóng/Mở menu", async ()=>{
      const app = await t.app({});
      app.run(FAKE);
      app.run(`window.__installMock(); window.__mb = __mk("button", { cls:"icon-btn btn-menu-trigger", attrs:{ "aria-label":"Mở menu" } }, [__icon("menu")]);
        document.getElementById("sheet-backdrop").classList.add("open");
        fkMorph._h.onClickCapture({ target: __mb.children[0] });`);
      await sleep(30);
      let r = app.evj(`({ n: __mm.length, init: __mm[0] && __mm[0].init, to: __mm[0] && __mm[0].to.map(x=> x[0]), lbl: __mb.getAttribute("aria-label"), dm: fkMorph.d("menu"), dc: fkMorph.d("close") })`);
      assert.equal(r.n, 1); assert.equal(r.init, r.dm); assert.deepEqual(r.to, [r.dc]); assert.equal(r.lbl, "Đóng menu");
      app.run(`document.getElementById("sheet-backdrop").classList.remove("open"); fkMorph._h.onSheetChange();`);
      r = app.evj(`({ to: __mm[0].to.map(x=> x[0]), lbl: __mb.getAttribute("aria-label"), ic: __mb.children[0].dataset.ic, dm: fkMorph.d("menu"), dc: fkMorph.d("close") })`);
      assert.deepEqual(r.to, [r.dc, r.dm]); assert.equal(r.lbl, "Mở menu"); assert.equal(r.ic, "menu");
    });

    t.test("Phát ↔ tạm dừng: nút video nền màn chào (video.js vẽ lại icon) + nút tạm dừng đồng hồ nghỉ", async ()=>{
      const app = await t.app({});
      app.run(FAKE);
      app.run(`window.__installMock(); window.__vb = __mk("button", { cls:"wl-vid-toggle" }, [__icon("pause")]);
        fkMorph._h.onClickCapture({ target: __vb });
        __vb.innerHTML = ""; const s = new __FE("span", { cls:"material-symbols-rounded" }); s.textContent = "play_arrow"; __vb.appendChild(s);`);
      await sleep(30);
      let r = app.evj(`({ init: __mm[0] && __mm[0].init, to: __mm[0] && __mm[0].to.map(x=> x[0]), dp: fkMorph.d("pause"), da: fkMorph.d("play_arrow") })`);
      assert.equal(r.init, r.dp, "bay từ icon cũ (pause)"); assert.deepEqual(r.to, [r.da]);
      // đồng hồ nghỉ: Tạm dừng → play_arrow (+ aria-label), Tiếp tục → pause (gọi lại startSetRest với số giây còn lại)
      r = app.evj(`(()=>{
        const b = __mk("button", { id:"fk-rest-pause", attrs:{ "aria-label":"Tạm dừng đếm nghỉ" } }, [__icon("pause")]);
        document.getElementById("rest-num").textContent = "37";
        let called = null; const old = startSetRest; window.__restArgs = null;
        const n0 = __mm.length;
        fkMorph._h.onClickCapture({ target: b.children[0] });
        const a = { paused: fkMorph._h.rest.paused, lbl: b.getAttribute("aria-label"), to: __mm[n0].to.map(x=> x[0]) };
        fkMorph._h.onClickCapture({ target: b });
        a.paused2 = fkMorph._h.rest.paused; a.lbl2 = b.getAttribute("aria-label"); a.to2 = __mm[n0].to.map(x=> x[0]);
        a.wrapped = !!startSetRest.__fkMorph;
        a.da = fkMorph.d("play_arrow"); a.dp = fkMorph.d("pause");
        return a; })()`);
      assert.equal(r.paused, true); assert.equal(r.lbl, "Tiếp tục đếm nghỉ"); assert.deepEqual(r.to, [r.da]);
      assert.equal(r.paused2, false); assert.equal(r.lbl2, "Tạm dừng đếm nghỉ"); assert.deepEqual(r.to2, [r.da, r.dp]);
      assert.equal(r.wrapped, true, "startSetRest được bọc để reset nút khi bắt đầu nghỉ mới");
    });

    t.test("Ô tick hiệp xong: vòng tròn → dấu tick (bouncy); bỏ tick không biến thành vòng", async ()=>{
      const app = await t.app({});
      app.run(FAKE);
      app.run(`window.__installMock();
        window.__btn = __mk("button", { cls:"set-check", attrs:{ "data-done":"0" } }, [__icon("check")]);
        window.__row = __mk("div", { cls:"set-row" }, [__btn]);
        fkMorph._h.onClickCapture({ target: __btn.children[0] });
        __row.classList.add("done");`);
      await sleep(30);
      let r = app.evj(`({ n: __mm.length, init: __mm[0] && __mm[0].init, to: __mm[0] && __mm[0].to, ring: fkMorph.d("_ring"), ck: fkMorph.d("check") })`);
      assert.equal(r.n, 1); assert.equal(r.init, r.ring); assert.deepEqual(r.to, [[r.ck, "bouncy"]]);
      app.run(`fkMorph._h.onClickCapture({ target: __btn }); __row.classList.remove("done");`);
      await sleep(30);
      r = app.evj(`({ sets: __mm[0].sets, to: __mm[0].to.map(x=> x[0]), ck: fkMorph.d("check"), sck: fkMorph.d("_s:check") })`);
      assert.deepEqual(r.sets, [r.sck]); assert.deepEqual(r.to, [r.ck, r.ck], "bỏ tick: vẫn là dấu tick (nảy nhẹ từ dạng nhỏ)");
      // bài trong danh sách hôm nay vừa xong → ô ✓ biến từ vòng tròn
      r = app.evj(`(()=>{
        const n0 = __mm.length;
        const ck = __mk("div", { cls:"check" }, [__icon("check")]);
        const item = __mk("div", { cls:"list-item", attrs:{ "data-ex":"u1" } }, [ck]);
        const list = __mk("div", {}, [item]);
        const orig = document.getElementById; document.getElementById = id=> id === "exercise-list" ? list : orig.call(document, id);
        try{ fkMorph._h.checkExerciseList(); ck.classList.add("checked"); fkMorph._h.checkExerciseList(); fkMorph._h.checkExerciseList(); }
        finally{ document.getElementById = orig; }
        return { n: __mm.length - n0, init: __mm[n0] && __mm[n0].init, to: __mm[n0] && __mm[n0].to.map(x=> x[0]), ring: fkMorph.d("_ring"), ck: fkMorph.d("check") };
      })()`);
      assert.equal(r.n, 1); assert.equal(r.init, r.ring); assert.deepEqual(r.to, [r.ck]);
    });

    t.test("Tim / bookmark: bật → nảy từ dạng nhỏ; tắt → về dạng thường (nút vẽ lại vẫn tìm được)", async ()=>{
      const app = await t.app({});
      app.run(FAKE);
      app.run(`window.__installMock();
        window.__fav = __mk("button", { cls:"icon-btn np-fav", attrs:{ "data-np-fav":"f:pho-bo", "aria-pressed":"false" } }, [__icon("favorite")]);
        fkMorph._h.onClickCapture({ target: __fav.children[0] });
        __fav.classList.add("on"); __fav.setAttribute("aria-pressed", "true");
        window.__bm = __mk("button", { cls:"cm-act", attrs:{ "data-act":"save", "aria-pressed":"false" } }, [__icon("bookmark")]);
        fkMorph._h.onClickCapture({ target: __bm });
        __bm.classList.add("on");`);
      await sleep(30);
      const r = app.evj(`({ n: __mm.length, a: __mm.map(m=> [m.init, m.to]), hs: fkMorph.d("_s:favorite"), h: fkMorph.d("favorite"), bs: fkMorph.d("_s:bookmark"), b: fkMorph.d("bookmark") })`);
      assert.equal(r.n, 2);
      assert.deepEqual(r.a[0], [r.hs, [[r.h, "bouncy"]]]);
      assert.deepEqual(r.a[1], [r.bs, [[r.b, "bouncy"]]]);
    });

    t.test("Khác: thanh điều hướng nảy, mắt mật khẩu, chevron <details>, mặt trời ↔ trăng, '+' → ✓ khi thêm món", async ()=>{
      const app = await t.app({});
      app.run(FAKE);
      // tab dưới
      app.run(`window.__installMock(); window.__nb = __mk("button", { cls:"nav-item", attrs:{ "data-goto":"nutrition" } }, [__icon("restaurant")]);
        window.__nav = __mk("nav", { cls:"bottom-nav" }, [__nb]);
        fkMorph._h.onClickCapture({ target: __nb }); __nb.classList.add("active");`);
      await sleep(30);
      let r = app.evj(`({ init: __mm[0] && __mm[0].init, to: __mm[0] && __mm[0].to, s: fkMorph.d("_s:restaurant"), d: fkMorph.d("restaurant") })`);
      assert.equal(r.init, r.s); assert.deepEqual(r.to, [[r.d, "bouncy"]]);
      // mắt mật khẩu
      r = app.evj(`(()=>{
        const inp = __mk("input", { attrs:{ type:"password" } }); inp.type = "password";
        const eye = __mk("button", { cls:"fk-pw-eye", attrs:{ "aria-label":"Hiện mật khẩu" } }, [__icon("visibility")]);
        const wrap = __mk("span", { cls:"fk-pw-wrap" }, [inp, eye]);
        const n0 = __mm.length;
        fkMorph._h.onClickCapture({ target: eye.children[0] });
        const a = { type: inp.type, lbl: eye.getAttribute("aria-label"), pr: eye.getAttribute("aria-pressed"), to: __mm[n0].to.map(x=> x[0]), init: __mm[n0].init };
        fkMorph._h.onClickCapture({ target: eye });
        a.type2 = inp.type; a.lbl2 = eye.getAttribute("aria-label");
        a.v = fkMorph.d("visibility"); a.vo = fkMorph.d("visibility_off");
        return a; })()`);
      assert.equal(r.type, "text"); assert.equal(r.lbl, "Ẩn mật khẩu"); assert.equal(r.pr, "true"); assert.equal(r.init, r.v); assert.equal(r.to[0], r.vo);
      assert.equal(r.type2, "password"); assert.equal(r.lbl2, "Hiện mật khẩu");
      // chevron trong <summary>
      r = app.evj(`(()=>{
        const sp = __icon("chevron_right"); const sum = __mk("summary", {}, [__mk("span"), sp]); const det = __mk("details", {}, [sum]);
        const n0 = __mm.length; fkMorph._h.onDetailsToggle({ target: det });
        return { init: __mm[n0].init, to: __mm[n0].to.map(x=> x[0]), l: fkMorph.d("chevron_left"), rr: fkMorph.d("chevron_right") }; })()`);
      assert.equal(r.init, r.l); assert.deepEqual(r.to, [r.rr]);
      // theme sáng ↔ tối: icon tiêu đề thẻ Giao diện
      app.run(`(()=>{
        const h = __icon("palette"); window.__tc = __mk("div", { id:"fk-theme-card" }, [__mk("div", { cls:"card-title" }, [h])]);
        const root = document.documentElement; root.classList.remove("fk-light"); root.classList.add("fk-dark");
        fkMorph._h.onModeChange(); window.__n0 = __mm.length;
        root.classList.remove("fk-dark"); root.classList.add("fk-light"); fkMorph._h.onModeChange(); })()`);
      await sleep(80);
      r = app.evj(`({ init: __mm[__n0] && __mm[__n0].init, to: __mm[__n0] && __mm[__n0].to.map(x=> x[0]), dk: fkMorph.d("dark_mode"), lt: fkMorph.d("light_mode") })`);
      assert.equal(r.init, r.dk); assert.deepEqual(r.to, [r.lt]);
      // thêm món thành công → "+" của bữa đó thành ✓
      r = app.evj(`(()=>{
        const b = __mk("button", { cls:"nu-mini", attrs:{ "data-add-meal":"lunch" } }, [__icon("add")]);
        const oq = document.querySelector; document.querySelector = function(sel){ return /data-add-meal="lunch"/.test(sel) ? b : oq.call(document, sel); };
        try{
          fkMorph._h.checkFoodAdds();
          const n0 = __mm.length;
          getDayFoodLog(todayStr()).lunch.push({ name:"Phở bò", grams:350, kcal:420, protein:25, carbs:50, fat:12 });
          fkMorph._h.checkFoodAdds();
          return { n: __mm.length - n0, init: __mm[n0] && __mm[n0].init, to: __mm[n0] && __mm[n0].to, add: fkMorph.d("add"), ck: fkMorph.d("check") };
        } finally { document.querySelector = oq; }
      })()`);
      assert.equal(r.n, 1); assert.equal(r.init, r.add); assert.deepEqual(r.to, [[r.ck, "bouncy"]]);
    });

    t.test("prefers-reduced-motion → đổi icon tức thì, không tạo morph, không tải thư viện", async ()=>{
      const app = await t.app({});
      app.run(FAKE);
      const r = app.evj(`(()=>{
        __installMock();
        window.matchMedia = q=> ({ matches: /reduce/.test(q), addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
        const sp = __icon("menu"); const b = __mk("button", {}, [sp]);
        const ok = fkMorph(b, "close", { spring:"snappy" });
        return { ok, n: __mm.length, ic: sp.dataset.ic, svg: /M18 6 6 18/.test(sp.innerHTML), ready: fkMorph.ready(), red: fkMorph.reduced() };
      })()`);
      assert.deepEqual(r, { ok:false, n:0, ic:"close", svg:true, ready:false, red:true });
    });

    t.test("Đóng gói: workflow vendor, sw.js, prepare-www.sh, build-single-html.py", async ()=>{
      const yml = read(".github/workflows/vendor-morphicons.yml");
      assert.ok(/workflow_dispatch/.test(yml) && /paths:\s*\n\s*-\s*"\.github\/workflows\/vendor-morphicons\.yml"/.test(yml), "trigger");
      assert.ok(/actions\/setup-node/.test(yml) && /npm i [^\n]*morphicons@\$V[^\n]*esbuild/.test(yml), "cài morphicons + esbuild");
      assert.ok(/export \* from "morphicons\/dom"/.test(yml), "entry");
      assert.ok(/--format=iife/.test(yml) && /--global-name=Morphicons/.test(yml) && /--minify/.test(yml) && /vendor\/morphicons\.min\.js/.test(yml), "bundle IIFE");
      assert.ok(/vendor\/morphicons\.LICENSE/.test(yml) && /morphicons\.VERSION/.test(yml) && /git add vendor\//.test(yml) && /git push/.test(yml), "LICENSE + phiên bản + commit");
      const sw = read("sw.js"), sh = read("scripts/prepare-www.sh");
      assert.ok(/"\.\/morph-icons\.js"/.test(sw), "sw.js ASSETS có morph-icons.js");
      assert.ok(/"vendor\/morphicons\.min\.js"/.test(sh) && /const extra = \[[^\]]*vendor\/morphicons\.min\.js/.test(sh), "prepare-www.sh thêm vendor vào ASSETS khi có file");
      assert.ok(/morph-icons\.js \\/.test(sh) && /vendor\/morphicons\.min\.js www\/vendor\//.test(sh), "prepare-www.sh chép file");
      const py = read("scripts/build-single-html.py");
      assert.ok(/\(\?: defer\)\?><\/script>/.test(py), "build-single-html nhận thẻ defer");
      assert.ok(/morphicons\.min\.js/.test(py) && /if v\.exists\(\)/.test(py), "nhúng vendor nếu có");
    });
  }
};

/* =========================================================================
   TapEasy — morph-icons.js: icon BIẾN HÌNH mượt kiểu lò xo (thư viện morphicons, MIT — https://www.morphicons.com)
   Hướng dẫn đầy đủ: docs/MORPH-ICONS.md

   - Thư viện tự host: vendor/morphicons.min.js (IIFE, global `Morphicons`) — tạo bằng workflow
     .github/workflows/vendor-morphicons.yml. Nạp LƯỜI: sau "load" + lúc rảnh (qua fkLazy._inject nếu có),
     hoặc ngay lần chạm đầu tiên. Bản 1 file (build-single-html.py) nhúng sẵn nếu file vendor có.
   - Icon FK_LINE (icons.js: path nối "|", "c:cx,cy,r" tròn, "r:x,y,w,h,rx" chữ nhật) → 1 chuỗi `d` tuyệt đối
     (tròn/chữ nhật bo góc đổi thành lệnh A/H/V) → morph trên 1 <path> duy nhất.
   - API: fkMorph(hostEl, toName, { spring:"snappy"|"smooth"|"bouncy", from:"tên"|"_s:tên"|"_m:tên", label })
       → true nếu đang biến hình, false nếu đổi icon TỨC THÌ (không có thư viện / offline / chưa vendor /
         prefers-reduced-motion / tên lạ). Không bao giờ ném lỗi.
     fkMorph.d(name) → chuỗi d · fkMorph.spec2d(spec) · fkMorph.ready() · fkMorph.load() → Promise<bool>
   - Áp dụng (listener uỷ quyền + bọc hàm nhỏ, KHÔNG sửa file lõi): menu ☰↔✕, phát↔tạm dừng (video nền màn chào,
     đồng hồ nghỉ giữa hiệp — thêm nút tạm dừng), tick hiệp/bài xong, tim/bookmark, mắt (mật khẩu + ẩn calo),
     chevron mở rộng/thu gọn, mặt trời↔trăng khi đổi theme sáng/tối, nút "+" bữa ăn → ✓ khi thêm món, tab dưới nảy.
   Nạp bằng <script src="morph-icons.js" defer> (trước health-safety.js); chạy được ở mọi thứ tự (không bọc hàm render).
   ========================================================================= */
(function(){
  "use strict";
  var G = typeof window !== "undefined" ? window : globalThis;
  if(G.fkMorph && G.fkMorph.__v) return;
  var D = G.document;
  var NS = "http://www.w3.org/2000/svg";
  var VENDOR_SRC = "vendor/morphicons.min.js";
  var STROKE_W = 1.8;                         // giống icons.js (svg.ln)
  var SPRINGS = { snappy:1, smooth:1, bouncy:1 };

  /* ---------------------------------------------------------------------
     1. FK_LINE → chuỗi d (tuyệt đối, hợp lệ, 1 path)
     --------------------------------------------------------------------- */
  var ARGN = { M:2, L:2, H:1, V:1, C:6, S:4, Q:4, T:2, A:7, Z:0 };
  var NUM_RE = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  function isSep(ch){ return ch === " " || ch === "," || ch === "\n" || ch === "\t" || ch === "\r"; }

  /* Phân tích 1 path SVG → [{c:"M", a:[…]}] TUYỆT ĐỐI (m/l/h/v/c/s/q/t/a/z đổi sang hoa). Ném lỗi khi sai cú pháp. */
  function parsePath(d){
    d = String(d == null ? "" : d);
    var out = [], i = 0, n = d.length, cmd = null, cx = 0, cy = 0, sx = 0, sy = 0, first = true;
    function skip(){ while(i < n && isSep(d[i])) i++; }
    function num(){
      skip(); NUM_RE.lastIndex = i;
      var m = NUM_RE.exec(d); if(!m) throw new Error("path: thiếu số ở vị trí " + i + " trong \"" + d + "\"");
      i = NUM_RE.lastIndex; return parseFloat(m[0]);
    }
    function flag(){
      skip(); var ch = d[i];
      if(ch !== "0" && ch !== "1") throw new Error("path: cờ cung phải là 0/1 ở vị trí " + i);
      i++; return ch === "1" ? 1 : 0;
    }
    skip();
    while(i < n){
      var ch = d[i];
      if(/[MmLlHhVvCcSsQqTtAaZz]/.test(ch)){ cmd = ch; i++; }
      else if(cmd === null) throw new Error("path: phải bắt đầu bằng lệnh M");
      else if(cmd === "Z" || cmd === "z") throw new Error("path: số thừa sau Z");
      if(first && cmd !== "M" && cmd !== "m") throw new Error("path: phải bắt đầu bằng M");
      first = false;
      var up = cmd.toUpperCase(), rel = cmd !== up, a;
      if(up === "Z"){ out.push({ c:"Z", a:[] }); cx = sx; cy = sy; skip(); continue; }
      if(up === "A"){
        a = [num(), num(), num(), flag(), flag(), num(), num()];
        if(rel){ a[5] += cx; a[6] += cy; }
        cx = a[5]; cy = a[6];
      } else {
        a = []; for(var k = 0; k < ARGN[up]; k++) a.push(num());
        if(up === "H"){ if(rel) a[0] += cx; cx = a[0]; }
        else if(up === "V"){ if(rel) a[0] += cy; cy = a[0]; }
        else {
          if(rel) for(var j = 0; j < a.length; j += 2){ a[j] += cx; a[j+1] += cy; }
          cx = a[a.length-2]; cy = a[a.length-1];
        }
      }
      out.push({ c:up, a:a });
      if(up === "M"){ sx = cx; sy = cy; cmd = rel ? "l" : "L"; }   // cặp số tiếp theo sau M = L
      skip();
    }
    if(!out.length) throw new Error("path rỗng");
    return out;
  }
  function fmt(v){ var r = Math.round(v * 1000) / 1000; return String(Object.is(r, -0) ? 0 : r); }
  function serialize(list){
    return list.map(function(s){ return s.c + s.a.map(fmt).join(" "); }).join("");
  }
  /* Phóng/thu quanh tâm (12,12) — tạo biến thể "nhỏ" cho hiệu ứng nảy */
  function scaleList(list, k){
    var f = function(v){ return 12 + k * (v - 12); };
    return list.map(function(s){
      var a = s.a.slice();
      if(s.c === "A"){ a[0] *= k; a[1] *= k; a[5] = f(a[5]); a[6] = f(a[6]); }
      else for(var j = 0; j < a.length; j++) a[j] = f(a[j]);
      return { c:s.c, a:a };
    });
  }
  function circleList(cx, cy, r){
    return [{ c:"M", a:[cx - r, cy] }, { c:"A", a:[r, r, 0, 1, 0, cx + r, cy] }, { c:"A", a:[r, r, 0, 1, 0, cx - r, cy] }, { c:"Z", a:[] }];
  }
  function rectList(x, y, w, h, rx){
    rx = Math.max(0, Math.min(Number(rx) || 0, w / 2, h / 2));
    if(!rx) return [{ c:"M", a:[x, y] }, { c:"H", a:[x + w] }, { c:"V", a:[y + h] }, { c:"H", a:[x] }, { c:"Z", a:[] }];
    return [
      { c:"M", a:[x + rx, y] }, { c:"H", a:[x + w - rx] }, { c:"A", a:[rx, rx, 0, 0, 1, x + w, y + rx] },
      { c:"V", a:[y + h - rx] }, { c:"A", a:[rx, rx, 0, 0, 1, x + w - rx, y + h] },
      { c:"H", a:[x + rx] }, { c:"A", a:[rx, rx, 0, 0, 1, x, y + h - rx] },
      { c:"V", a:[y + rx] }, { c:"A", a:[rx, rx, 0, 0, 1, x + rx, y] }, { c:"Z", a:[] }
    ];
  }
  function nums(s){ return s.split(",").map(function(v){ var x = parseFloat(v); if(!isFinite(x)) throw new Error("số lạ: " + s); return x; }); }
  /* spec FK_LINE ("M…|c:12,12,3|r:3,3,18,18,2") → danh sách lệnh tuyệt đối */
  function specToList(spec){
    var all = [];
    String(spec || "").split("|").forEach(function(seg){
      seg = seg.trim(); if(!seg) return;
      var part;
      if(seg.indexOf("c:") === 0){ var c = nums(seg.slice(2)); part = circleList(c[0], c[1], c[2]); }
      else if(seg.indexOf("r:") === 0){ var r = nums(seg.slice(2)); part = rectList(r[0], r[1], r[2], r[3], r[4]); }
      else part = parsePath(seg);
      all = all.concat(part);
    });
    if(!all.length) throw new Error("icon rỗng");
    return all;
  }
  function spec2d(spec, k){ var l = specToList(spec); return serialize(k && k !== 1 ? scaleList(l, k) : l); }

  /* Hình chỉ dùng để biến hình (không đăng ký vào FK_LINE) + dự phòng khi module khác chưa thêm icon */
  var EXTRA = {
    _ring: "c:12,12,8",
    chevron_left: "M15 18l-6-6 6-6",
    expand_less: "M18 15l-6-6-6 6",
    expand_more: "M6 9l6 6 6-6",
    pause: "M8 5v14|M16 5v14",
    visibility_off: "M2 12s3.5-7 10-7c2 0 3.8.6 5.3 1.6|M22 12s-3.5 7-10 7c-2 0-3.8-.6-5.3-1.6|M3 3l18 18|M9.9 9.9a3 3 0 0 0 4.2 4.2",
    favorite: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
    bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
    palette: "M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4.2 4H16a2 2 0 0 0-1.4 3.4A1.6 1.6 0 0 1 13.4 22z|c:7.5,10.5,1.2|c:10.5,6.8,1.2|c:15.2,7.4,1.2|c:17.3,11.3,1.2",
    dark_mode: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
    light_mode: "c:12,12,4|M12 2v2|M12 20v2|M4.9 4.9l1.4 1.4|M17.7 17.7l1.4 1.4|M2 12h2|M20 12h2|M4.9 19.1l1.4-1.4|M17.7 6.3l1.4-1.4"
  };
  var VARIANT = { _s:0.5, _m:0.8 };          // "_s:favorite" = tim thu nhỏ 50 % (nảy), "_m:" = 80 %
  function lineTable(){ try{ return typeof FK_LINE !== "undefined" ? FK_LINE : (G.FK_LINE || null); }catch(e){ return null; } }
  function specOf(name){
    name = String(name || "");
    var T = lineTable();
    return (T && Object.prototype.hasOwnProperty.call(T, name) && T[name]) || (Object.prototype.hasOwnProperty.call(EXTRA, name) ? EXTRA[name] : null);
  }
  var dCache = {};
  /* tên icon (kể cả biến thể "_s:tên") → d; null nếu không có trong FK_LINE/EXTRA hoặc lỗi */
  function dOf(name){
    name = String(name || "");
    var k = 1, base = name, m = /^(_[a-z]):(.+)$/.exec(name);
    if(m && VARIANT[m[1]]){ k = VARIANT[m[1]]; base = m[2]; }
    var spec = specOf(base); if(!spec) return null;
    var key = k + "|" + spec;
    if(!(key in dCache)){ try{ dCache[key] = spec2d(spec, k); }catch(e){ dCache[key] = null; } }
    return dCache[key];
  }

  /* ---------------------------------------------------------------------
     2. Thư viện: nạp lười + kiểm tra
     --------------------------------------------------------------------- */
  function lib(){ var M = G.Morphicons; return M && typeof M.createMorph === "function" ? M : null; }
  function reduced(){
    try{ return !!(G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; }
  }
  var loadP = null, loadFailed = false;
  function injectOwn(src){
    return new Promise(function(res, rej){
      var s = D.createElement("script"); s.src = src; s.async = true; s.setAttribute("data-fk-morph", "1");
      s.onload = function(){ res(); };
      s.onerror = function(){ try{ s.remove(); }catch(e){} rej(new Error("morph-icons: không tải được " + src)); };
      (D.head || D.body || D.documentElement).appendChild(s);
    });
  }
  function load(){
    if(lib()) return Promise.resolve(true);
    if(loadFailed) return Promise.resolve(false);
    if(loadP) return loadP;
    var done = G.__fkLazyDone = G.__fkLazyDone || {};
    var inj = (G.fkLazy && typeof G.fkLazy._inject === "function") ? function(s){ return G.fkLazy._inject(s); } : injectOwn;
    loadP = Promise.resolve().then(function(){ return done[VENDOR_SRC] ? null : inj(VENDOR_SRC); })
      .then(function(){ done[VENDOR_SRC] = 1; return !!lib(); })
      .catch(function(){ loadFailed = true; return false; })      // chưa vendor / offline → đổi icon tức thì
      .then(function(ok){ if(!ok) loadFailed = true; loadP = null; return ok; });
    return loadP;
  }
  function scheduleLoad(){
    if(lib() || reduced()) return;            // giảm chuyển động → không cần tải
    var go = function(){
      var run = function(){ load(); };
      if(typeof G.requestIdleCallback === "function") G.requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 0);
    };
    if(D.readyState === "complete") setTimeout(go, 1200);
    else G.addEventListener("load", function(){ setTimeout(go, 1200); }, { once: true });
  }

  /* ---------------------------------------------------------------------
     3. fkMorph(host, toName, opts)
     --------------------------------------------------------------------- */
  var REG = typeof WeakMap === "function" ? new WeakMap() : null;
  var LIVE = [];
  function hasCls(el, c){ return !!(el && el.classList && el.classList.contains(c)); }
  /* tìm <span class="material-symbols-rounded"> trong host (duyệt con, không phụ thuộc querySelector) */
  function findIcon(host, depth){
    if(!host) return null;
    if(hasCls(host, "material-symbols-rounded")) return host;
    depth = depth || 0; if(depth > 4) return null;
    var kids = host.children || [];
    for(var i = 0; i < kids.length; i++){ var r = findIcon(kids[i], depth + 1); if(r) return r; }
    return null;
  }
  function firstSvg(el){
    var kids = (el && el.children) || [];
    for(var i = 0; i < kids.length; i++){ var t = String(kids[i].tagName || "").toLowerCase(); if(t === "svg") return kids[i]; }
    return null;
  }
  /* nơi chứa svg: span icon, hoặc chính host nếu host chỉ có 1 <svg> trực tiếp (vd nút video nền của ui-kit) */
  function holderOf(host){
    var sp = findIcon(host); if(sp) return sp;
    if(host && firstSvg(host)) return host;
    return null;
  }
  function nameOf(holder){
    if(!holder) return "";
    var ds = holder.dataset || {};
    if(ds.ic) return ds.ic;
    if(ds.fkMi) return ds.fkMi;
    return String(holder.textContent || "").trim();
  }
  function setName(holder, name){
    try{ holder.dataset.ic = name; holder.dataset.fkMi = name; }catch(e){}
  }
  function connected(el){ return !!el && (el.isConnected === undefined ? true : el.isConnected); }
  function prune(){
    for(var i = LIVE.length - 1; i >= 0; i--){
      var r = LIVE[i];
      if(!connected(r.svg) || (r.holder && r.svg.parentNode !== r.holder)){
        try{ r.inst.destroy(); }catch(e){}
        LIVE.splice(i, 1);
        if(REG && REG.get(r.holder) === r) REG.delete(r.holder);
      }
    }
  }
  function dropRec(holder){
    var r = REG && REG.get(holder); if(!r) return;
    try{ r.inst.destroy(); }catch(e){}
    REG.delete(holder); var i = LIVE.indexOf(r); if(i >= 0) LIVE.splice(i, 1);
  }
  /* đổi icon tức thì (đường cũ của app: icons.js vẽ SVG nhiều phần tử) */
  function instant(holder, name){
    if(!holder) return;
    dropRec(holder);
    if(hasCls(holder, "material-symbols-rounded")){
      if(typeof G.fkIconSvg === "function"){ holder.innerHTML = G.fkIconSvg(name); setName(holder, name); }
      else { holder.textContent = name; }     // icons.js sẽ tự đổi chữ → SVG
      try{ delete holder.dataset.fkMi; holder.dataset.ic = name; }catch(e){}
    } else {
      var d = dOf(name); if(!d) return;      // host có svg trực tiếp: vẽ lại 1 path nét
      holder.innerHTML = ""; holder.appendChild(makeSvg(d).svg); setName(holder, name);
    }
  }
  function makeSvg(d){
    var svg = D.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("class", "ln fk-mi");
    svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", String(STROKE_W));
    svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
    var path = D.createElementNS(NS, "path"); if(d) path.setAttribute("d", d);
    svg.appendChild(path);
    return { svg: svg, path: path };
  }
  function labelHost(host, label){
    if(label == null || !host || !host.setAttribute) return;
    var b = (host.closest && host.closest("button, [role=button], a")) || host;
    try{ b.setAttribute("aria-label", String(label)); }catch(e){}
  }
  function canAnimate(){ return !!lib() && !reduced() && !api.disabled; }

  function fkMorph(host, toName, opts){
    opts = opts || {};
    var holder = null;
    try{
      holder = holderOf(host);
      toName = String(toName || "");
      if(!holder || !toName) return false;
      if(opts.label != null) labelHost(host, opts.label);
      var from = opts.from ? String(opts.from) : nameOf(holder);
      var dTo = dOf(toName), dFrom = dOf(from);
      api.last = { to: toName, from: from, animated: false };
      if(!dTo || !dFrom || !canAnimate()){
        if(!lib() && !reduced()) load();    // lần sau có thể đã sẵn sàng
        instant(holder, toName); return false;
      }
      if(dFrom === dTo && !opts.from){ setName(holder, toName); return false; }
      prune();
      var rec = REG && REG.get(holder);
      if(rec && (rec.svg.parentNode !== holder || !connected(rec.svg))){ dropRec(holder); rec = null; }
      if(!rec){
        var built = makeSvg(null);
        holder.innerHTML = ""; holder.appendChild(built.svg);
        var inst = lib().createMorph(built.path, dFrom, { reducedMotion: "user", strokeWidth: STROKE_W });
        rec = { holder: holder, svg: built.svg, path: built.path, inst: inst };
        if(REG) REG.set(holder, rec); LIVE.push(rec);
      } else if(opts.from){
        rec.inst.set(dFrom);
      }
      var sp = opts.spring && SPRINGS[opts.spring] ? opts.spring : (opts.spring && typeof opts.spring === "object" ? opts.spring : "smooth");
      rec.inst.morphTo(dTo, sp);
      setName(holder, toName);
      api.last.animated = true;
      return true;
    }catch(e){
      try{ if(holder) instant(holder, toName); }catch(_){}
      return false;
    }
  }

  var api = fkMorph;
  api.__v = 1;
  api.d = dOf;
  api.spec2d = spec2d;
  api.parse = parsePath;
  api.extra = EXTRA;
  api.ready = function(){ return canAnimate(); };
  api.load = load;
  api.reduced = reduced;
  api.disabled = false;
  api.last = null;
  api._resetLoad = function(){ loadP = null; loadFailed = false; };
  G.fkMorph = api;

  /* ---------------------------------------------------------------------
     4. Điểm áp dụng (listener uỷ quyền — không sửa file lõi)
     --------------------------------------------------------------------- */
  function closest(el, sel){ try{ return el && el.closest ? el.closest(sel) : null; }catch(e){ return null; } }
  function later(fn, ms){ setTimeout(function(){ try{ fn(); }catch(e){} }, ms || 0); }
  /* chờ trạng thái đổi (handler của app chạy sau listener capture; có chỗ vẽ lại không đồng bộ) */
  function whenChanged(read, before, cb){
    var waits = [0, 120, 450], k = 0;
    (function step(){
      later(function(){
        var now = read();
        if(now && now.v !== before){ cb(now); return; }
        if(++k < waits.length) step();
      }, waits[k]);
    })();
  }
  function attrSel(el){
    if(!el || !el.getAttribute) return null;
    if(el.id) return "#" + cssEsc(el.id);
    var names = ["data-np-fav", "data-cm-like", "data-cm-save", "data-fp-save", "data-np-done", "data-done", "data-tp-done", "data-px-done", "data-toggle-meal", "data-nu-kcal", "data-act"];
    for(var i = 0; i < names.length; i++){
      var v = el.getAttribute(names[i]); if(v != null) return "[" + names[i] + "=\"" + String(v).replace(/["\\]/g, "\\$&") + "\"]";
    }
    return null;
  }
  function cssEsc(s){ try{ return G.CSS && G.CSS.escape ? G.CSS.escape(s) : String(s).replace(/[^\w-]/g, "\\$&"); }catch(e){ return String(s); } }
  function refind(el, sel, scope){
    if(connected(el) && !(el.isConnected === false)) return el;
    try{ return sel ? (scope || D).querySelector(sel) : null; }catch(e){ return null; }
  }

  /* 4a. Bật/tắt có trạng thái (tick, tim, bookmark) */
  var heartOn = function(el){ return hasCls(el, "on") || (el.getAttribute && el.getAttribute("aria-pressed") === "true"); };
  var TOGGLES = [
    { sel: ".set-check", state: function(el){ var row = closest(el, ".set-row"); return !!(row && hasCls(row, "done")); },
      icon: "check", on: { from: "_ring", spring: "bouncy" }, off: { from: "_s:check", spring: "snappy" } },
    { sel: "[data-np-done]", state: function(el){ return hasCls(el, "done") || (el.getAttribute && el.getAttribute("aria-pressed") === "true"); },
      icon: "check", on: { from: "_ring", spring: "bouncy" }, off: { from: "_s:check", spring: "snappy" }, inner: ".np-chk" },
    { sel: "[data-np-fav], #np-q-fav, #np-r-fav, [data-cm-like], .cm-act[data-act=\"like\"], [data-fp-save]", state: heartOn,
      icon: "favorite", on: { from: "_s:favorite", spring: "bouncy" }, off: { from: "_m:favorite", spring: "smooth" } },
    { sel: "[data-cm-save], .cm-act[data-act=\"save\"]", state: heartOn,
      icon: "bookmark", on: { from: "_s:bookmark", spring: "bouncy" }, off: { from: "_m:bookmark", spring: "smooth" } }
  ];
  function onToggleClick(t){
    for(var i = 0; i < TOGGLES.length; i++){
      var T = TOGGLES[i], el = closest(t, T.sel); if(!el) continue;
      (function(T, el){
        var before = !!T.state(el), key = attrSel(el);
        whenChanged(function(){ var e2 = refind(el, key); return e2 ? { v: !!T.state(e2), el: e2 } : null; }, before, function(now){
          var host = now.el;
          if(T.inner){ var inner = closest(host, T.inner) || (host.querySelector && host.querySelector(T.inner)); if(inner) host = inner; }
          fkMorph(host, T.icon, now.v ? T.on : T.off);
        });
      })(T, el);
      return true;
    }
    return false;
  }

  /* 4b. Nút đổi icon khi bấm (app vẽ lại icon khác) → morph từ icon cũ sang icon mới */
  var SWAPS = [
    { sel: ".wl-vid-toggle" },                                   // video.js: video nền màn chào (pause ↔ play_arrow)
    { sel: "[data-nu-kcal]", refind: ".nu-kcal-eye" }           // nutrition.js: ẩn/hiện số calo (visibility ↔ visibility_off)
  ];
  function onSwapClick(t){
    for(var i = 0; i < SWAPS.length; i++){
      var S = SWAPS[i], el = closest(t, S.sel); if(!el) continue;
      (function(S, el){
        var from = nameOf(holderOf(el));
        whenChanged(function(){
          var e2 = connected(el) && holderOf(el) && nameOf(holderOf(el)) !== from ? el : refind(null, S.refind || attrSel(el));
          var h = e2 && holderOf(e2); return h ? { v: nameOf(h), el: e2 } : null;
        }, from, function(now){ fkMorph(now.el, now.v, { from: from, spring: "snappy" }); });
      })(S, el);
      return true;
    }
    return false;
  }

  /* 4c. Nút video nền của ui-kit (.fk-vid-toggle — svg trực tiếp, đổi theo sự kiện play/pause) */
  function onUiKitVid(t){
    var btn = closest(t, ".fk-vid-toggle"); if(!btn) return false;
    var paused = function(){ return btn.getAttribute("aria-pressed") === "true"; };   // aria-pressed = !playing
    var before = paused();
    whenChanged(function(){ return { v: paused(), el: btn }; }, before, function(now){
      fkMorph(btn, now.v ? "play_arrow" : "pause", { from: now.v ? "pause" : "play_arrow", spring: "snappy" });
    });
    return true;
  }

  /* 4d. Menu ☰ ↔ ✕ (sheet menu chính) */
  var menu = { btn: null, label: null, at: 0 };
  function sheetOpen(){ var bd = D.getElementById && D.getElementById("sheet-backdrop"); return !!(bd && hasCls(bd, "open")); }
  function onMenuClick(t){
    var btn = closest(t, ".btn-menu-trigger, .btn-menu-trigger-nu"); if(!btn) return false;
    var now = Date.now();
    if(now - menu.at < 400) return true;       // nút ☰ ở Dinh dưỡng bấm hộ #btn-menu (click lồng) → giữ nút người dùng bấm
    menu.at = now;
    later(function(){
      if(!sheetOpen()) return;
      menu.btn = btn; menu.label = btn.getAttribute ? btn.getAttribute("aria-label") : null;
      fkMorph(btn, "close", { spring: "snappy", label: "Đóng menu" });
    }, 0);
    return true;
  }
  function onSheetChange(){
    if(!menu.btn || sheetOpen()) return;
    var b = menu.btn; menu.btn = null;
    fkMorph(b, "menu", { spring: "smooth" });
    try{ if(menu.label != null) b.setAttribute("aria-label", menu.label); else b.removeAttribute("aria-label"); }catch(e){}
  }

  /* 4e. Thanh điều hướng dưới: tab vừa chọn nảy (biến hình từ dạng thu nhỏ) */
  function onNavClick(t){
    var btn = closest(t, ".bottom-nav .nav-item"); if(!btn) return false;
    var was = hasCls(btn, "active");
    later(function(){
      if(was || !hasCls(btn, "active")) return;
      var h = holderOf(btn), name = nameOf(h); if(!name) return;
      fkMorph(btn, name, { from: "_s:" + name, spring: "bouncy" });
    }, 0);
    return true;
  }

  /* 4f. Bữa ăn: mở/thu chi tiết (chevron) */
  function onMealToggle(t){
    var el = closest(t, "[data-toggle-meal]"); if(!el) return false;
    if(closest(t, "[data-edit-time]") || closest(t, "[data-add-meal]")) return false;
    var id = el.getAttribute("data-toggle-meal");
    later(function(){
      var b = D.querySelector('.nu-mini[data-toggle-meal="' + String(id).replace(/["\\]/g, "\\$&") + '"]');
      if(b) fkMorph(b, "chevron_right", { from: "chevron_left", spring: "snappy" });
    }, 0);
    return true;
  }

  /* 4g. <details> có chevron trong <summary> (Kho kiến thức, Sự kiện…) */
  function onDetailsToggle(e){
    var det = e && e.target; if(!det || String(det.tagName || "").toLowerCase() !== "details") return;
    var sum = det.querySelector && det.querySelector("summary"); if(!sum) return;
    var h = findIcon(sum); if(!h) return;
    var name = nameOf(h);
    var opp = { chevron_right: "chevron_left", expand_more: "expand_less", expand_less: "expand_more" }[name];
    if(opp) fkMorph(h, name, { from: opp, spring: "snappy" });
  }

  /* 4h. Đồng hồ nghỉ giữa hiệp: thêm nút Tạm dừng ↔ Tiếp tục (app.js / training-pro.js dùng chung #set-rest) */
  var rest = { paused: false };
  function restBtn(){ return D.getElementById ? D.getElementById("fk-rest-pause") : null; }
  function ensureRestPause(){
    var box = D.getElementById && D.getElementById("set-rest");
    if(!box || !box.insertAdjacentHTML || !box.querySelector) return;
    if(box.querySelector("#fk-rest-pause")) return;
    var plus = box.querySelector("#rest-plus"); if(!plus || plus.id !== "rest-plus") return;
    plus.insertAdjacentHTML("beforebegin", '<button type="button" id="fk-rest-pause" class="fk-rest-pause" aria-label="Tạm dừng đếm nghỉ" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">pause</span></button>');
    rest.paused = false;
  }
  function setRestUI(paused, animate){
    var b = restBtn(); if(!b || !b.setAttribute) return;
    b.setAttribute("aria-label", paused ? "Tiếp tục đếm nghỉ" : "Tạm dừng đếm nghỉ");
    b.setAttribute("aria-pressed", paused ? "true" : "false");
    var to = paused ? "play_arrow" : "pause";
    if(animate) fkMorph(b, to, { spring: "snappy" }); else if(nameOf(holderOf(b)) !== to) instant(holderOf(b), to);
  }
  function onRestPause(t){
    if(rest.paused && closest(t, "#rest-plus")){          // +15s lúc đang dừng: app hẹn lại thông báo → huỷ (vẫn đang dừng)
      later(function(){ if(rest.paused && typeof cancelRestNotif === "function") cancelRestNotif(); }, 0);
      return true;
    }
    var b = closest(t, "#fk-rest-pause"); if(!b) return false;
    if(!rest.paused){
      try{ clearInterval(G._restTimer); }catch(e){}
      try{ if(typeof cancelRestNotif === "function") cancelRestNotif(); }catch(e){}
      rest.paused = true; setRestUI(true, true);
    } else {
      var n = D.getElementById("rest-num"), left = Math.max(1, parseInt(n && n.textContent, 10) || 1);
      rest.paused = false;
      try{ if(typeof startSetRest === "function") startSetRest(left); }catch(e){}
      setRestUI(false, true);
    }
    return true;
  }
  function wrapRest(){
    try{
      if(typeof startSetRest === "function" && !startSetRest.__fkMorph){
        var _s = startSetRest;
        startSetRest = function(){ if(rest.paused){ rest.paused = false; setRestUI(false, false); } return _s.apply(this, arguments); };
        startSetRest.__fkMorph = true;
      }
      if(typeof stopSetRest === "function" && !stopSetRest.__fkMorph){
        var _t = stopSetRest;
        stopSetRest = function(){ if(rest.paused){ rest.paused = false; setRestUI(false, false); } return _t.apply(this, arguments); };
        stopSetRest.__fkMorph = true;
      }
    }catch(e){}
  }

  /* 4i. Hiện/ẩn mật khẩu: nút mắt cạnh mọi ô mật khẩu */
  function ensurePwEyes(){
    if(!D.querySelectorAll) return;
    var list = D.querySelectorAll('input[type="password"]:not([data-fk-eye])');
    for(var i = 0; i < list.length; i++){
      var inp = list[i]; if(!inp || !inp.parentNode || !inp.setAttribute) continue;
      inp.setAttribute("data-fk-eye", "1");
      var wrap = D.createElement("span"); wrap.className = "fk-pw-wrap";
      inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      var b = D.createElement("button");
      b.type = "button"; b.className = "fk-pw-eye"; b.setAttribute("aria-label", "Hiện mật khẩu"); b.setAttribute("aria-pressed", "false");
      if(inp.id) b.setAttribute("aria-controls", inp.id);
      b.innerHTML = '<span class="material-symbols-rounded" aria-hidden="true">visibility</span>';
      wrap.appendChild(b);
    }
  }
  function onPwEye(t){
    var b = closest(t, ".fk-pw-eye"); if(!b) return false;
    var wrap = closest(b, ".fk-pw-wrap"), inp = wrap && wrap.querySelector("input");
    if(!inp) return true;
    var show = inp.type === "password";
    try{ inp.type = show ? "text" : "password"; }catch(e){}
    b.setAttribute("aria-pressed", show ? "true" : "false");
    fkMorph(b, show ? "visibility_off" : "visibility", { spring: "snappy", label: show ? "Ẩn mật khẩu" : "Hiện mật khẩu" });
    return true;
  }

  /* 4j. Theme sáng ↔ tối: icon tiêu đề thẻ Giao diện biến mặt trời ↔ trăng rồi về bảng màu */
  var mode = null, modeT = null;
  function curMode(){ var r = D.documentElement; return hasCls(r, "fk-light") ? "light" : hasCls(r, "fk-dark") ? "dark" : null; }
  function onModeChange(){
    var m = curMode(); if(!m) return;
    if(mode === null || m === mode){ mode = m; return; }
    var old = mode; mode = m;
    later(function(){
      var card = D.getElementById("fk-theme-card"); if(!card || !card.querySelector) return;
      var title = card.querySelector(".card-title"), h = title && findIcon(title); if(!h) return;
      var to = m === "light" ? "light_mode" : "dark_mode", from = old === "light" ? "light_mode" : "dark_mode";
      fkMorph(h, to, { from: from, spring: "smooth" });
      clearTimeout(modeT);
      modeT = setTimeout(function(){ try{ if(connected(h)) fkMorph(h, "palette", { spring: "smooth" }); }catch(e){} }, 1600);
    }, 30);
  }

  /* 4k. Thêm món thành công → nút "+" của bữa đó biến thành ✓ rồi trở lại */
  var foodSnap = null;
  function foodCounts(){
    var st; try{ st = typeof state !== "undefined" ? state : G.state; }catch(e){ st = G.state; }
    var fl = st && st.foodLog; if(!fl || typeof fl !== "object") return null;
    var out = {};
    Object.keys(fl).forEach(function(day){
      var v = fl[day]; if(!v || typeof v !== "object") return;
      Object.keys(v).forEach(function(meal){ if(Array.isArray(v[meal])) out[day + "|" + meal] = v[meal].length; });
    });
    return out;
  }
  function checkFoodAdds(){
    var now = foodCounts(); if(!now) return;
    var prev = foodSnap; foodSnap = now;
    if(!prev) return;
    Object.keys(now).forEach(function(k){
      if(now[k] <= (prev[k] || 0)) return;
      var meal = k.split("|")[1];
      var b = D.querySelector && D.querySelector('.nu-mini[data-add-meal="' + meal.replace(/["\\]/g, "\\$&") + '"]');
      if(!b || !findIcon(b)) return;
      fkMorph(b, "check", { from: "add", spring: "bouncy" });
      setTimeout(function(){ try{ if(connected(b)) fkMorph(b, "add", { spring: "smooth" }); }catch(e){} }, 1500);
    });
  }

  /* 4l. Danh sách bài hôm nay: bài vừa xong → ô ✓ biến từ vòng tròn */
  var exSnap = { key: null, done: null };
  function checkExerciseList(){
    var list = D.getElementById && D.getElementById("exercise-list"); if(!list || !list.querySelectorAll) return;
    var items = list.querySelectorAll(".list-item[data-ex]"); if(!items || !items.length) return;
    var st; try{ st = typeof state !== "undefined" ? state : G.state; }catch(e){ st = G.state; }
    var key = (st && (st.activePlanId + "|" + st.selectedDay)) || "?";
    var done = {}, fresh = [];
    for(var i = 0; i < items.length; i++){
      var it = items[i], uid = it.getAttribute("data-ex"), ck = it.querySelector(".check");
      if(ck && hasCls(ck, "checked")){ done[uid] = 1; if(exSnap.key === key && exSnap.done && !exSnap.done[uid]) fresh.push(ck); }
    }
    exSnap = { key: key, done: done };
    fresh.forEach(function(ck){ fkMorph(ck, "check", { from: "_ring", spring: "bouncy" }); });
  }

  /* ---------- gom sự kiện ---------- */
  function onClickCapture(e){
    var t = e && e.target; if(!t) return;
    try{
      if(onMenuClick(t)) return;
      if(onPwEye(t)) return;
      if(onRestPause(t)) return;
      if(onUiKitVid(t)) return;
      if(onSwapClick(t)) return;
      if(onToggleClick(t)) return;
      if(onNavClick(t)) return;
      onMealToggle(t);
    }catch(err){}
  }
  var tickT = null;
  function tick(){
    tickT = null;
    try{ ensurePwEyes(); }catch(e){}
    try{ ensureRestPause(); }catch(e){}
    try{ checkFoodAdds(); }catch(e){}
    try{ checkExerciseList(); }catch(e){}
    try{ onSheetChange(); }catch(e){}
  }
  function schedTick(){ if(!tickT) tickT = setTimeout(tick, 60); }

  var CSS = ".fk-pw-wrap{position:relative;display:block}" +
    ".fk-pw-wrap>input{padding-right:48px!important;width:100%;box-sizing:border-box}" +
    ".fk-pw-eye{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:44px;height:44px;border:0;border-radius:12px;background:transparent;color:inherit;opacity:.8;display:grid;place-items:center;cursor:pointer;padding:0}" +
    ".fk-pw-eye:hover,.fk-pw-eye[aria-pressed=\"true\"]{opacity:1}" +
    ".fk-pw-eye .material-symbols-rounded{font-size:20px;line-height:1}" +
    ".fk-pw-eye svg{width:20px;height:20px}" +
    ".set-rest .fk-rest-pause{width:44px;min-width:44px;padding:0;display:grid;place-items:center}" +
    ".set-rest .fk-rest-pause svg{width:18px;height:18px}" +
    ".fk-vid-toggle svg.fk-mi{fill:none;stroke:currentColor;stroke-width:2}";

  function start(){
    try{
      if(D.head && D.createElement && !(D.getElementById && D.getElementById("fk-morph-css") && D.getElementById("fk-morph-css").tagName === "STYLE")){
        var st = D.createElement("style"); st.id = "fk-morph-css"; st.textContent = CSS; D.head.appendChild(st);
      }
    }catch(e){}
    try{ D.addEventListener("click", onClickCapture, true); }catch(e){}
    try{ D.addEventListener("toggle", onDetailsToggle, true); }catch(e){}
    try{ G.addEventListener("online", function(){ if(!lib()) loadFailed = false; }); }catch(e){}
    try{ D.addEventListener("pointerdown", function once(){ D.removeEventListener("pointerdown", once, true); if(!reduced()) load(); }, true); }catch(e){}
    wrapRest();
    try{
      if(typeof G.MutationObserver === "function" && D.body){
        new G.MutationObserver(schedTick).observe(D.body, { childList: true, subtree: true });
        var bd = D.getElementById("sheet-backdrop");
        if(bd && bd.nodeType === 1) new G.MutationObserver(function(){ try{ onSheetChange(); }catch(e){} }).observe(bd, { attributes: true, attributeFilter: ["class"] });
        new G.MutationObserver(function(){ try{ onModeChange(); }catch(e){} }).observe(D.documentElement, { attributes: true, attributeFilter: ["class"] });
      }
    }catch(e){}
    mode = curMode();
    tick();
    scheduleLoad();
  }

  /* dùng trong kiểm thử */
  api._h = { onClickCapture: onClickCapture, onDetailsToggle: onDetailsToggle, onSheetChange: onSheetChange, onModeChange: onModeChange,
    tick: tick, checkFoodAdds: checkFoodAdds, checkExerciseList: checkExerciseList, ensurePwEyes: ensurePwEyes, wrapRest: wrapRest,
    holderOf: holderOf, nameOf: nameOf, menu: menu, rest: rest };

  try{
    if(D && D.readyState === "loading") D.addEventListener("DOMContentLoaded", start, { once: true });
    else if(D) start();
  }catch(e){}
})();

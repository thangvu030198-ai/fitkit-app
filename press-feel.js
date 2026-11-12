/* =========================================================================
   TapEasy — press-feel.js: cảm giác BẤM "đã tay" (nhấn lún tức thì + lò xo khi thả, gợn sóng, rung xúc giác,
   trạng thái chờ cho tác vụ bất đồng bộ, nảy cho công tắc/tick). Hướng dẫn: docs/PRESS-FEEL.md
   CSS đi kèm: press-feel.css (nạp ngay trước brand.css). Script nạp ngay trước morph-icons.js (health-safety.js vẫn cuối).

   - 1 listener uỷ quyền trên document (pointerdown/move/up/cancel + click, pha capture) — không gắn gì vào từng nút.
   - pointerdown → .is-pressed NGAY (không đợi click); di chuyển > 8 px / cuộn / pointercancel → huỷ; thả → lò xo 220 ms.
   - CHỐNG NHÁY KÍNH: phần tử có backdrop-filter KHÔNG bao giờ bị transform khi đang có blur:
       · nút nhỏ (pill, icon-btn, btn-outline…) → tạm tắt blur (.pf-noblur) trong lúc nhấn + lúc lò xo, rồi bật lại;
         nếu CSS khác vẫn giữ blur → chuyển sang .pf-glass (không scale);
       · thẻ lớn (card, list-item, choice-card… còn blur, hoặc chứa con có blur) → .pf-glass: chỉ phủ sáng/tối + viền, không scale.
   - prefers-reduced-motion → .pf-still: không scale, không gợn sóng, chỉ đổi màu nền nhẹ.
   - Rung: Capacitor.Plugins.Haptics (native) hoặc navigator.vibrate (web); công tắc "Rung khi chạm" ở Hồ sơ (state.pressFeel.haptic).
   - API: fkPress.haptic(kind) · fkPress.enabled() · fkPress.set(on) · fkBusy(btn, promise|fn) · fkBusy.done(btn)
   Không sửa file lõi: chỉ bọc toast/openSheet/closeSheet/finishSession/setAuthBusy/renderProfileScreen theo tên toàn cục.
   ========================================================================= */
(function(){
  "use strict";
  var G = typeof window !== "undefined" ? window : globalThis;
  if(G.fkPress && G.fkPress.__v) return;
  var D = G.document;

  /* ---------------------------------------------------------------------
     0. Cấu hình
     --------------------------------------------------------------------- */
  var MOVE_CANCEL = 8;                 // px — kéo/cuộn quá ngưỡng thì huỷ nhấn
  var RELEASE_MS = 280;
  var MIN_PRESS_MS = 90;               // chạm rất nhanh (down+up cùng khung) vẫn thấy lún ≥ 5 khung rồi mới bật lò xo                // thời gian lò xo thả (CSS 220 ms) + biên an toàn trước khi bật lại blur
  var BUSY_SHOW_MS = 120;              // tác vụ xong nhanh hơn ngưỡng này → không hiện spinner (tránh nháy)
  var BUSY_MAX_MS = 20000;             // tự mở khoá nếu promise treo
  var PRESS_SEL = [
    ".btn", ".icon-btn", ".pill", ".chip", ".choice-card", ".role-card", ".list-item[onclick]", ".list-item[role=button]",
    ".card[onclick]", ".card[role=button]", ".metric", ".bottom-nav button", ".seg button", "[role=button]", "[role=tab]",
    "[role=switch]", "button", "a.btn", ".nav-item", ".entry-tile", ".set-check", ".toggle", ".fk-theme-opt", ".wl-cta", ".wl-pill",
    "[data-press]"
  ].join(",");
  var EXCLUDE_SEL = "input, textarea, select, [contenteditable=true], [role=slider], .sig-slide, .sig-slide-track, .sig-slide-thumb, [data-no-press]";
  var BIG_SEL = ".card, .list-item, .choice-card, .role-card, .metric, .entry-tile, .fk-theme-opt, .plan-card, .sig-choice, .pb-opt, .te-xp";
  var RIPPLE_SEL = ".btn-primary, .wl-cta, .btn-cta, .sc-px-cta, .pb-tpl-cta, .cm-share-cta, .te-hc-cta, [data-ripple], .list-item";
  var SOLID_SEL = ".btn-primary, .wl-cta, .btn-soft, .btn-fab, .btn-cta, .sc-px-cta";       // nền đặc → tối nhẹ bằng brightness
  var MEDIUM_SEL = ".btn-primary, .wl-cta, .btn-cta, .btn-fab, .set-check, .sc-px-cta, [data-haptic=medium]";
  var SELECT_SEL = ".bottom-nav button, .nav-item, .seg button, .fk-seg button, .pill, .chip, [role=tab], [role=radio], .day-tab, .date-chip, .fk-theme-opt, [data-haptic=selection]";
  var POP_SEL = ".toggle, [role=switch], input[type=checkbox], .set-check, .list-item .check, [aria-pressed], .np-fav, .cm-act";
  var SUCCESS_ICONS = { check_circle:1, task_alt:1, done:1, done_all:1, celebration:1, military_tech:1, emoji_events:1, verified:1, cloud_done:1 };
  var VIBE = { light:10, medium:15, selection:8, success:[12, 60, 15], error:[20, 40, 20] };

  /* ---------------------------------------------------------------------
     1. Tiện ích
     --------------------------------------------------------------------- */
  function now(){ return Date.now(); }
  function isEl(x){ return !!(x && x.nodeType === 1 && x.classList); }
  function toEl(t){ while(t && t.nodeType !== 1) t = t.parentNode; return t || null; }
  function closest(el, sel){ try{ return el && el.closest ? el.closest(sel) : null; }catch(e){ return null; } }
  function matches(el, sel){ try{ return !!(el && el.matches && el.matches(sel)); }catch(e){ return false; } }
  function reduced(){
    try{ return !!(G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; }
  }
  function cs(el){ try{ return G.getComputedStyle ? G.getComputedStyle(el) : null; }catch(e){ return null; } }
  function backdropOf(el){
    var s = cs(el); if(!s) return false;
    var v = s.backdropFilter || s.webkitBackdropFilter || "";
    if(!v && s.getPropertyValue) v = s.getPropertyValue("backdrop-filter") || s.getPropertyValue("-webkit-backdrop-filter") || "";
    return !!v && v !== "none";
  }
  /* phần tử con có blur → scale cha sẽ làm lớp kính của con dựng lại (nháy) → coi như kính */
  function glassInside(el){
    var seen = 0, stack = [].slice.call(el.children || []);
    while(stack.length && seen < 40){
      var n = stack.shift(); seen++;
      if(backdropOf(n)) return true;
      if(n.children && n.children.length) stack = stack.concat([].slice.call(n.children));
    }
    return false;
  }
  /* phần tử đang dùng transform để định vị (translate(-50%)…) → không ghi đè */
  function ownTransform(el){
    var s = cs(el); var t = s && (s.transform || (s.getPropertyValue && s.getPropertyValue("transform"))) || "none";
    return !(t === "none" || t === "" || /^matrix\(1, ?0, ?0, ?1, ?0, ?0\)$/.test(t));
  }
  function disabled(el){
    if(!el) return true;
    if(el.disabled === true || el.getAttribute("aria-disabled") === "true" || el.classList.contains("disabled")) return true;
    return !!closest(el, "fieldset[disabled]");
  }
  function isBusy(el){ return !!(el && el.getAttribute && el.getAttribute("data-pf-busy") === "1"); }
  function st(){ try{ return typeof state !== "undefined" ? state : null; }catch(e){ return null; } }
  function save(){ try{ if(typeof saveState === "function") saveState(); }catch(e){} }

  /* đích bấm hợp lệ từ target của sự kiện */
  function targetOf(t){
    var el = toEl(t); if(!el) return null;
    if(closest(el, EXCLUDE_SEL)) return null;
    var hit = closest(el, PRESS_SEL);
    if(!hit || disabled(hit)) return null;
    return hit;
  }

  /* ---------------------------------------------------------------------
     2. Rung xúc giác
     --------------------------------------------------------------------- */
  function enabled(){
    var s = st(); if(!s) return true;
    var p = s.pressFeel;
    if(p === false) return false;
    return !(p && p.haptic === false);           // mặc định BẬT
  }
  function setEnabled(on){
    var s = st(); if(!s) return;
    s.pressFeel = Object.assign({}, (s.pressFeel && typeof s.pressFeel === "object") ? s.pressFeel : {}, { haptic: !!on });
    save();
  }
  function nativeHaptics(){
    try{
      var C = G.Capacitor; if(!C) return null;
      var native = typeof C.isNativePlatform === "function" ? C.isNativePlatform() : (C.platform && C.platform !== "web");
      if(!native) return null;
      return (C.Plugins && C.Plugins.Haptics) || null;
    }catch(e){ return null; }
  }
  function canVibrate(){ return !!nativeHaptics() || !!(G.navigator && typeof G.navigator.vibrate === "function"); }
  var lastHap = { kind:"", at:0 };
  function haptic(kind){
    kind = VIBE[kind] ? kind : "light";
    if(!enabled()) return false;
    var t = now();
    if(lastHap.kind === kind && t - lastHap.at < 60) return false;     // chống dội (2 listener cùng 1 chạm)
    lastHap = { kind: kind, at: t };
    var H = nativeHaptics();
    try{
      if(H){
        var p;
        if(kind === "light") p = H.impact({ style: "LIGHT" });
        else if(kind === "medium") p = H.impact({ style: "MEDIUM" });
        else if(kind === "success") p = H.notification({ type: "SUCCESS" });
        else if(kind === "error") p = H.notification({ type: "ERROR" });
        else if(kind === "selection"){
          if(typeof H.selectionStart === "function"){ p = Promise.resolve(H.selectionStart()).then(function(){ return H.selectionChanged(); }).then(function(){ return H.selectionEnd(); }); }
          else p = H.impact({ style: "LIGHT" });
        }
        if(p && p.catch) p.catch(function(){});
        return true;
      }
      if(G.navigator && typeof G.navigator.vibrate === "function"){ G.navigator.vibrate(VIBE[kind]); return true; }
    }catch(e){}
    return false;
  }
  function hapticKind(el){
    var forced = el.getAttribute && el.getAttribute("data-haptic");
    if(forced) return forced === "none" ? null : forced;
    if(matches(el, MEDIUM_SEL)) return "medium";
    if(matches(el, SELECT_SEL)) return "selection";
    return "light";
  }

  /* ---------------------------------------------------------------------
     3. Nhấn lún + lò xo + gợn sóng
     --------------------------------------------------------------------- */
  var cur = null;                       // { el, id, x, y, rpl }
  var timers = typeof WeakMap === "function" ? new WeakMap() : null;
  var lastDownAt = 0, lastTap = { el:null, at:0 };
  var CLS_ALL = ["is-pressed", "pf-armed", "pf-noblur", "pf-glass", "pf-still", "pf-big", "pf-solid"];

  function clearTimer(el){ if(!timers) return; var t = timers.get(el); if(t){ clearTimeout(t); timers.delete(el); } }

  function classify(el){
    var big = matches(el, BIG_SEL);
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width:0, height:0 };
    if(!big && r.width > 240 && r.height > 72) big = true;
    var scale = big ? 0.98 : (r.width > 200 ? 0.975 : 0.96);
    var mode = "scale";
    if(reduced()) mode = "still";
    else if(ownTransform(el) && !el.classList.contains("pf-armed")) mode = "still";
    else if(backdropOf(el)) mode = big ? "glass" : "noblur";
    else if(glassInside(el)) mode = "glass";
    return { big: big, scale: scale, mode: mode };
  }

  function press(el, x, y, id){
    clearTimer(el);
    try{ [].slice.call(el.children || []).forEach(function(k){ if(k.classList && k.classList.contains("pf-rpl") && !k.classList.contains("out")) dropRipple(k, true); }); }catch(e){}
    // ĐỌC hết trước (rect, computed style) rồi mới GHI lớp — tránh ép trình duyệt tính lại style/layout nhiều lần
    var c = classify(el);
    var wantRipple = c.mode !== "still" && matches(el, RIPPLE_SEL);
    var geo = wantRipple ? rippleGeo(el, x, y) : null;
    var cl = el.classList;
    cl.add("pf-armed");
    if(c.big) cl.add("pf-big");
    if(matches(el, SOLID_SEL)) cl.add("pf-solid");
    if(c.mode === "still") cl.add("pf-still");
    if(c.mode === "glass") cl.add("pf-glass");
    if(c.mode === "noblur"){
      cl.add("pf-noblur");
      if(backdropOf(el)){ cl.remove("pf-noblur"); cl.add("pf-glass"); }   // CSS khác vẫn giữ blur → không scale
    }
    try{ el.style.setProperty("--pf-s", String(c.scale)); }catch(e){}
    cl.add("is-pressed");
    cur = { el: el, id: id, x: x, y: y, t: now(), rpl: geo ? ripple(el, geo) : null };
  }

  function rippleGeo(el, x, y){
    try{
      var r = el.getBoundingClientRect(), s = cs(el);
      var lx = (x || 0) - (r.left || 0), ly = (y || 0) - (r.top || 0), w = r.width || 0, h = r.height || 0;
      var dmax = Math.sqrt(Math.pow(Math.max(lx, w - lx), 2) + Math.pow(Math.max(ly, h - ly), 2)) * 2;
      return { lx: lx, ly: ly, d: Math.max(24, Math.round(dmax)), stat: !!(s && s.position === "static") };
    }catch(e){ return null; }
  }
  function ripple(el, g){
    try{
      if(g.stat) el.style.position = "relative";
      var box = D.createElement("span"); box.className = "pf-rpl"; box.setAttribute("aria-hidden", "true");
      var dot = D.createElement("i");
      dot.style.setProperty("--x", g.lx + "px"); dot.style.setProperty("--y", g.ly + "px"); dot.style.setProperty("--d", g.d + "px");
      box.appendChild(dot); el.appendChild(box);
      return box;
    }catch(e){ return null; }
  }
  function dropRipple(box, fast){
    if(!box) return;
    try{ box.classList.add("out"); }catch(e){}
    setTimeout(function(){ try{ if(box.parentNode) box.parentNode.removeChild(box); }catch(e){} }, fast ? 160 : 420);
  }

  function release(cancelled){
    if(!cur) return;
    var el = cur.el, box = cur.rpl, held = now() - (cur.t || 0); cur = null;
    if(!cancelled && held < MIN_PRESS_MS){            // giữ trạng thái lún tối thiểu rồi mới thả (vẫn không chặn click)
      clearTimer(el);
      var w = setTimeout(function(){ if(timers) timers.delete(el); finishRelease(el, box, false); }, MIN_PRESS_MS - held);
      if(timers) timers.set(el, w);
      return;
    }
    finishRelease(el, box, cancelled);
  }
  function finishRelease(el, box, cancelled){
    el.classList.remove("is-pressed");
    dropRipple(box, cancelled);
    clearTimer(el);
    var t = setTimeout(function(){
      if(el.classList.contains("is-pressed")) return;
      CLS_ALL.forEach(function(c){ el.classList.remove(c); });
      if(timers) timers.delete(el);
    }, RELEASE_MS);
    if(timers) timers.set(el, t);
  }

  function onDown(e){
    try{
      if(!e || e.isPrimary === false || (e.button != null && e.button > 0)) return;
      lastDownAt = now();
      if(cur) release(true);
      var el = targetOf(e.target); if(!el) return;
      if(isBusy(el)) return;
      press(el, e.clientX, e.clientY, e.pointerId);
    }catch(err){}
  }
  function onMove(e){
    if(!cur || (cur.id != null && e.pointerId != null && e.pointerId !== cur.id)) return;
    var dx = (e.clientX || 0) - (cur.x || 0), dy = (e.clientY || 0) - (cur.y || 0);
    if(dx * dx + dy * dy > MOVE_CANCEL * MOVE_CANCEL) release(true);
  }
  function onUp(e){
    if(!cur) return;
    if(e && cur.id != null && e.pointerId != null && e.pointerId !== cur.id) return;
    lastTap = { el: cur.el, at: now() };
    release(false);
  }
  function onCancel(){ if(cur) release(true); }

  /* ---------------------------------------------------------------------
     4. Click: khoá bấm đôi khi đang chờ · rung · nảy công tắc
     --------------------------------------------------------------------- */
  function pop(el){
    if(reduced()) return;
    var host = el;
    if(backdropOf(el)) host = el.firstElementChild || null;     // không scale phần tử có kính
    if(!host || !host.classList) return;
    host.classList.remove("pf-pop");
    try{ void host.offsetWidth; }catch(e){}
    host.classList.add("pf-pop");
    setTimeout(function(){ try{ host.classList.remove("pf-pop"); }catch(e){} }, 420);
  }
  function onClick(e){
    try{
      var el0 = toEl(e && e.target); if(!el0) return;
      var busy = closest(el0, "[data-pf-busy=\"1\"]");
      if(busy){ if(e.preventDefault) e.preventDefault(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); else if(e.stopPropagation) e.stopPropagation(); return; }
      var popEl = closest(el0, POP_SEL);
      var el = targetOf(el0);
      var fromPointer = now() - lastDownAt < 1500;
      if(el){
        lastTap = { el: el, at: now() };
        if(fromPointer && e.isTrusted !== false){ var k = hapticKind(el); if(k) haptic(k); }
        if(el.hasAttribute && el.hasAttribute("data-busy") && !el.hasAttribute("data-no-busy")) busyOn(el, { auto: true });
      }
      if(popEl && !disabled(popEl)){
        var knob = !matches(popEl, ".toggle") && popEl.querySelector ? popEl.querySelector(".toggle") : null;   // hàng công tắc → nảy núm
        pop(knob || popEl);
      }
    }catch(err){}
  }

  /* ---------------------------------------------------------------------
     5. Trạng thái chờ — fkBusy(btn, promise)
     --------------------------------------------------------------------- */
  var busyMap = typeof WeakMap === "function" ? new WeakMap() : null;
  var autoBusy = [];
  function busyOn(btn, opts){
    if(!isEl(btn)) return null;
    var rec = busyMap && busyMap.get(btn);
    if(rec){ rec.n++; return rec; }
    rec = { n: 1, show: null, max: null, pos: null, auto: !!(opts && opts.auto) };
    if(busyMap) busyMap.set(btn, rec);
    btn.setAttribute("data-pf-busy", "1"); btn.setAttribute("aria-busy", "true");
    btn.classList.add("pf-busy-lock");
    rec.show = setTimeout(function(){
      rec.show = null;
      try{
        var s = cs(btn);
        if(s && s.color) btn.style.setProperty("--pf-busy-c", s.color);
        if(s && s.position === "static"){ rec.pos = btn.style.position || ""; btn.style.position = "relative"; }
        var sp = D.createElement("span"); sp.className = "pf-spin"; sp.setAttribute("aria-hidden", "true");
        btn.appendChild(sp); rec.spin = sp;
        btn.classList.add("pf-busy");
      }catch(e){}
    }, (opts && opts.immediate) ? 0 : BUSY_SHOW_MS);
    var ms = (opts && opts.max) || Number(btn.getAttribute("data-busy")) || BUSY_MAX_MS;
    rec.max = setTimeout(function(){ busyOff(btn, true); }, Math.max(1000, ms));
    if(rec.auto) autoBusy.push(btn);
    return rec;
  }
  function busyOff(btn, force){
    if(!isEl(btn)) return;
    var rec = busyMap && busyMap.get(btn);
    if(rec && !force && --rec.n > 0) return;
    if(rec){
      if(rec.show) clearTimeout(rec.show);
      if(rec.max) clearTimeout(rec.max);
      if(rec.spin && rec.spin.parentNode) try{ rec.spin.parentNode.removeChild(rec.spin); }catch(e){}
      if(rec.pos !== null) try{ btn.style.position = rec.pos; }catch(e){}
      if(busyMap) busyMap.delete(btn);
    }
    btn.removeAttribute("data-pf-busy"); btn.removeAttribute("aria-busy");
    btn.classList.remove("pf-busy-lock"); btn.classList.remove("pf-busy");
    try{ btn.style.removeProperty("--pf-busy-c"); }catch(e){}
    var i = autoBusy.indexOf(btn); if(i >= 0) autoBusy.splice(i, 1);
  }
  function releaseAuto(){ autoBusy.slice().forEach(function(b){ busyOff(b, true); }); }

  function fkBusy(btn, p, opts){
    var promise;
    try{ promise = typeof p === "function" ? p() : p; }catch(e){ promise = Promise.reject(e); }
    if(!promise || typeof promise.then !== "function") return Promise.resolve(promise);
    if(!isEl(btn)) return promise;
    busyOn(btn, opts);
    var done = function(){ busyOff(btn); };
    promise.then(done, done);
    return promise;
  }
  fkBusy.on = busyOn;
  fkBusy.done = function(btn){ busyOff(btn, true); };
  fkBusy.isBusy = isBusy;

  /* Listener click trả về Promise (async ()=>{…}) → tự khoá + spinner trên nút đã bấm.
     Chỉ bọc listener "click" gắn SAU khi file này nạp (màn được vẽ lười nên phần lớn nút thuộc diện này). */
  var BUSY_BTN_SEL = "button, .btn, [role=button], .pill, .chip, a.btn";
  function busyTargetFor(ev, ct){
    if(!ct || ct.nodeType !== 1 || ct === D.body || ct === D.documentElement) return null;   // bỏ uỷ quyền cấp document
    if(matches(ct, BUSY_BTN_SEL)) return ct;
    var b = closest(toEl(ev && ev.target), BUSY_BTN_SEL);
    if(b && ct.contains && ct.contains(b)) return b;
    return null;
  }
  function patchListeners(){
    var proto = (G.EventTarget && G.EventTarget.prototype) || (G.Element && G.Element.prototype);
    if(!proto || proto.__pfPatched || typeof proto.addEventListener !== "function") return;
    var add = proto.addEventListener, rem = proto.removeEventListener;
    var wrapped = typeof WeakMap === "function" ? new WeakMap() : null;
    if(!wrapped) return;
    proto.addEventListener = function(type, fn, o){
      if(type === "click" && typeof fn === "function" && this && this.nodeType === 1){
        var w = wrapped.get(fn);
        if(!w){
          w = function(ev){
            var r = fn.apply(this, arguments);
            if(r && typeof r.then === "function"){
              try{ var b = busyTargetFor(ev, ev && ev.currentTarget || this); if(b && !b.hasAttribute("data-no-busy")) fkBusy(b, r); }catch(e){}
            }
            return r;
          };
          wrapped.set(fn, w);
        }
        return add.call(this, type, w, o);
      }
      return add.call(this, type, fn, o);
    };
    proto.removeEventListener = function(type, fn, o){
      if(type === "click" && typeof fn === "function"){ var w = wrapped.get(fn); if(w) rem.call(this, type, w, o); }
      return rem.call(this, type, fn, o);
    };
    proto.__pfPatched = true;
  }

  /* ---------------------------------------------------------------------
     6. Bọc hàm app (theo tên toàn cục, an toàn nếu không có)
     --------------------------------------------------------------------- */
  function wrapGlobal(name, make){
    try{
      var old = G[name];
      if(typeof old !== "function" || old.__pfWrapped) return false;
      var nw = make(old); nw.__pfWrapped = true;
      G[name] = nw;          // khai báo function ở script cổ điển = thuộc tính window → mọi nơi gọi theo tên đều thấy bản bọc
      return true;
    }catch(e){ return false; }
  }
  function hookApp(){
    // toast thành công sau một lần chạm gần đây → rung "success"; toast lỗi → "error"; mở khoá nút data-busy
    wrapGlobal("toast", function(old){ return function(msg, icon){
      var r = old.apply(this, arguments);
      try{
        releaseAuto();
        var ic = icon === undefined ? "check_circle" : String(icon || "");
        if(now() - lastTap.at < 4000){
          if(SUCCESS_ICONS[ic]) haptic("success");
          else if(ic === "error" || ic === "error_outline" || ic === "warning") haptic("error");
        }
      }catch(e){}
      return r;
    }; });
    wrapGlobal("openSheet", function(old){ return function(){ var r = old.apply(this, arguments); try{ releaseAuto(); }catch(e){} return r; }; });
    wrapGlobal("closeSheet", function(old){ return function(){ var r = old.apply(this, arguments); try{ releaseAuto(); }catch(e){} return r; }; });
    // "Xong buổi tập" → rung thành công
    wrapGlobal("finishSession", function(old){ return function(){
      var r = old.apply(this, arguments);
      try{ haptic("success"); }catch(e){}
      return r;
    }; });
    // Đăng nhập / đăng ký / quên mật khẩu (pt.js): setAuthBusy(true|false) → spinner + khoá bấm đôi trên #au-submit
    wrapGlobal("setAuthBusy", function(old){ return function(b){
      var r = old.apply(this, arguments);
      try{ var btn = D.getElementById("au-submit"); if(btn){ if(b) busyOn(btn, { immediate: true }); else busyOff(btn, true); } }catch(e){}
      return r;
    }; });
    // Thẻ cài đặt "Cảm giác chạm" trong Hồ sơ
    wrapGlobal("renderProfileScreen", function(old){ return function(){
      var r = old.apply(this, arguments);
      try{ renderSettings(); }catch(e){}
      return r;
    }; });
  }

  /* ---------------------------------------------------------------------
     7. Cài đặt: "Rung khi chạm" (Hồ sơ → sau thẻ Giao diện)
     --------------------------------------------------------------------- */
  try{ if(G.FK_LINE && !G.FK_LINE.vibration) G.FK_LINE.vibration = "m2 8 2 2-2 2 2 2-2 2|m22 8-2 2 2 2-2 2 2 2|r:8,5,8,14,1"; }catch(e){}
  function settingsHTML(){
    var on = enabled();
    var note = canVibrate() ? "Rung nhẹ khi bấm nút, đổi tab, xong hiệp và lưu thành công." : "Máy/trình duyệt này không hỗ trợ rung — bật sẵn để dùng trong app cài đặt.";
    return '<div class="card-title"><span class="material-symbols-rounded">vibration</span>Cảm giác chạm</div>' +
      '<button type="button" class="pf-row" id="pf-haptic-sw" role="switch" aria-checked="' + on + '" data-haptic="none">' +
        '<span class="t"><b>Rung khi chạm</b><small>' + note + '</small></span>' +
        '<span class="toggle' + (on ? " on" : "") + '" aria-hidden="true"></span>' +
      '</button>';
  }
  function renderSettings(){
    var scr = D.getElementById("screen-profile"); if(!scr || !scr.querySelector) return;
    var content = scr.querySelector(".content"); if(!content) return;
    var card = D.getElementById("pf-card");
    if(!card || !card.parentNode){
      card = D.createElement("div"); card.className = "card pf-card"; card.id = "pf-card";
      var anchor = D.getElementById("fk-theme-card");
      if(anchor && anchor.parentNode === content && anchor.nextSibling) content.insertBefore(card, anchor.nextSibling);
      else if(anchor && anchor.parentNode === content) content.appendChild(card);
      else {
        var acc = D.getElementById("profile-account-card");
        if(acc && acc.parentNode === content) content.insertBefore(card, acc); else content.appendChild(card);
      }
      card.addEventListener("click", function(e){
        var sw = closest(toEl(e.target), "#pf-haptic-sw"); if(!sw) return;
        var on = !enabled(); setEnabled(on);
        updateSettings(card);
        if(on) haptic("medium");
        try{ if(typeof toast === "function") toast(on ? "Đã bật rung khi chạm" : "Đã tắt rung khi chạm", on ? "vibration" : "notifications_off"); }catch(e2){}
      });
    }
    if(!updateSettings(card)) card.innerHTML = settingsHTML();
  }
  /* cập nhật tại chỗ (không vẽ lại) để hiệu ứng nảy của công tắc chạy liền mạch */
  function updateSettings(card){
    var sw = card && card.querySelector ? card.querySelector("#pf-haptic-sw") : null;
    if(!sw || !sw.parentNode) return false;
    var on = enabled();
    sw.setAttribute("aria-checked", String(on));
    var tg = sw.querySelector(".toggle"); if(tg) tg.classList.toggle("on", on);
    return true;
  }

  /* ---------------------------------------------------------------------
     8. Khởi động
     --------------------------------------------------------------------- */
  var api = {
    __v: 1,
    haptic: haptic, enabled: enabled, set: setEnabled, canVibrate: canVibrate, reduced: reduced,
    renderSettings: renderSettings,
    _h: { onDown: onDown, onMove: onMove, onUp: onUp, onCancel: onCancel, onClick: onClick, classify: classify,
      current: function(){ return cur; }, busyOn: busyOn, busyOff: busyOff, hapticKind: hapticKind, targetOf: targetOf,
      reset: function(){ lastHap = { kind:"", at:0 }; cur = null; lastDownAt = 0; lastTap = { el:null, at:0 }; } }
  };
  G.fkPress = api;
  G.fkBusy = fkBusy;

  function start(){
    var opt = { capture: true, passive: true };
    try{
      D.addEventListener("pointerdown", onDown, opt);
      D.addEventListener("pointermove", onMove, opt);
      D.addEventListener("pointerup", onUp, opt);
      D.addEventListener("pointercancel", onCancel, opt);
      D.addEventListener("dragstart", onCancel, opt);
      D.addEventListener("scroll", onCancel, opt);
      D.addEventListener("click", onClick, true);
      G.addEventListener("blur", onCancel);
    }catch(e){}
    try{ patchListeners(); }catch(e){}
    try{ hookApp(); }catch(e){}
    try{ var a = D.querySelector && D.querySelector(".screen.active"); if(a && a.id === "screen-profile") renderSettings(); }catch(e){}
  }
  start();
})();

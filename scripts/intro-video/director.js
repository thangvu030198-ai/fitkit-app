/* =========================================================================
   TapEasy intro video — "đạo diễn" chạy BÊN TRONG app (Playwright addInitScript).
   - Không sửa mã app: chỉ gọi hàm toàn cục (goto, showAuth, openSheet, fkTheme…)
     và dữ liệu demo cục bộ (cloud.mode "demo", localStorage). KHÔNG đăng nhập tài khoản thật.
   - capture_app.py gọi lần lượt  __TI.run(id)  theo  __TI.order,  rồi
     __TI.scrollTo(y)  để chụp từng dải cuộn của vùng cuộn (scroller).
   - Mỗi shot trả { scroller rect, scrollMax, targets{tên:{x,y,w,h}} (toạ độ tài liệu
     trong vùng cuộn), light (theme sáng?) }.
   ========================================================================= */
(function(){
  "use strict";
  const W = window;
  if(W.__TI) return;
  const TI = W.__TI = { log: [] };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const $q = (s, r) => { try{ return (r || document).querySelector(s); }catch(e){ return null; } };
  const $a = (s, r) => { try{ return Array.from((r || document).querySelectorAll(s)); }catch(e){ return []; } };
  const G = k => { try{ return (new Function("return typeof " + k + "!=='undefined' ? " + k + " : undefined"))(); }catch(e){ return undefined; } };
  const vis = el => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const click = el => { if(el){ try{ el.click(); }catch(e){} return true; } return false; };
  async function waitFor(fn, ms){ const t0 = Date.now(); while(Date.now() - t0 < (ms || 6000)){ try{ const v = await fn(); if(v) return v; }catch(e){} await sleep(80); } return null; }
  const say = m => { TI.log.push(String(m)); try{ console.log("[TI] " + m); }catch(e){} };
  const setVal = (el, v) => { if(!el) return; el.value = v; el.dispatchEvent(new Event("input", { bubbles:true })); el.dispatchEvent(new Event("change", { bubbles:true })); };
  const pad = n => String(n).padStart(2, "0");
  const ds = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  /* PRNG có hạt giống → dữ liệu demo giống nhau mọi lần chụp */
  let seed = 20261112;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  /* ---------- CSS chụp: vùng an toàn giả lập iPhone 14/15 Pro (trên 59 px / dưới 34 px), ẩn thanh cuộn/toast/caret ----------
     Chromium (Playwright 1.48) không cho đặt env(safe-area-inset-*) → "polyfill": viết lại MỌI env(safe-area-inset-*) trong CSS
     của app thành px (TI.applySafeArea, chạy lại trước mỗi shot vì có CSS nạp muộn) + ép biến --sat/--sab của app (style.css).
     Dải 0…59 px để trống cho thanh trạng thái 9:41 + dynamic island do compose.js vẽ; dải 34 px dưới cho thanh home.
     Số đo ghi vào manifest.safe để bộ dựng khớp. TI.safeAudit() = QA: không chữ/nút nào của app lọt vào 2 dải (capture_app.py
     ghi build/qa/safe/ và báo lỗi). */
  const SAFE_TOP = 59, SAFE_BOT = 34;
  TI.SAFE_TOP = SAFE_TOP; TI.SAFE_BOT = SAFE_BOT;
  const ENV_RE = /env\(\s*safe-area-inset-(top|bottom|left|right)\s*(?:,(?:[^()]|\([^()]*\))*)?\)/g;
  const envFix = v => v.replace(ENV_RE, (m, k) => k === "top" ? SAFE_TOP + "px" : k === "bottom" ? SAFE_BOT + "px" : "0px");
  function patchRules(rules){
    let n = 0;
    for(const r of Array.from(rules || [])){
      try{
        if(r.style && r.style.cssText.indexOf("safe-area-inset") >= 0){ r.style.cssText = envFix(r.style.cssText); n++; }
        if(r.cssRules) n += patchRules(r.cssRules);
      }catch(e){}
    }
    return n;
  }
  /* bản app cũ (chưa có --fk-safe trong style.css): ép lớp phủ xuống dưới dải trạng thái như trước */
  TI.appFitted = () => { try{ return getComputedStyle(document.documentElement).getPropertyValue("--fk-safe").trim() === "1"; }catch(e){ return false; } };
  function legacyCSS(){
    if($q("#__ti_legacy") || !document.head || TI.appFitted()) return;
    const st = document.createElement("style"); st.id = "__ti_legacy";
    st.textContent = `
      #app-shell{ padding-top:${SAFE_TOP}px!important; }
      #auth:not(.wl-mode), #onboarding{ top:${SAFE_TOP}px!important; bottom:0!important; height:auto!important; }
      #onboarding{ padding-bottom:${SAFE_BOT}px!important; }
      .sheet{ padding-bottom:${SAFE_BOT}px; max-height:min(88%, calc(100% - ${SAFE_TOP + 12}px))!important; }`;
    document.head.appendChild(st);
    say("app chưa có --fk-safe (bản cũ) → dùng CSS ép vùng an toàn của director");
  }
  TI.applySafeArea = function(){
    let n = 0;
    for(const sh of Array.from(document.styleSheets)){ try{ n += patchRules(sh.cssRules); }catch(e){} }
    $a("[style*='safe-area-inset']").forEach(el => { el.setAttribute("style", envFix(el.getAttribute("style"))); n++; });
    if(document.readyState === "complete") legacyCSS();
    return n;
  };
  /* ---------- QA vùng an toàn ----------
     Phần tử "chữ/nút" = lá có chữ trực tiếp, button, a, input/select/textarea, [role=button], icon svg nhỏ (≤ 64 px).
     Lấy hình chữ nhật THẤY ĐƯỢC (cắt theo mọi tổ tiên overflow≠visible + màn). Lỗi khi:
       trên : lọt vào 0…SAFE_TOP (mọi phần tử — nền/ảnh lớn không tính);
       dưới : lọt vào (H−SAFE_BOT)…H, trừ nội dung của vùng cuộn đang tràn tiếp xuống dưới (cuộn dưới thanh home như iOS).
     Mép ngang < 12 px → cảnh báo "edge" (không chặn). Có sheet mở → kiểm thêm mép trên sheet, header + nút đóng. */
  function visRect(el){
    const r = el.getBoundingClientRect();
    let x0 = r.left, y0 = r.top, x1 = r.right, y1 = r.bottom, scrollClip = null;
    for(let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement){
      const cs = getComputedStyle(p);
      if(cs.overflowX !== "visible" || cs.overflowY !== "visible"){
        const q = p.getBoundingClientRect();
        if(/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 4 && !scrollClip) scrollClip = { el: p, top: q.top, bottom: q.bottom };
        x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom);
      }
      if(cs.position === "fixed") break;
    }
    x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, innerWidth); y1 = Math.min(y1, innerHeight);
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, raw: r, scrollClip };
  }
  function shown(el){
    try{ if(el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false; }catch(e){}
    for(let p = el; p && p !== document.documentElement; p = p.parentElement){
      const cs = getComputedStyle(p);
      if(cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false;
    }
    return true;
  }
  function isUI(el){
    const tg = el.tagName;
    if(/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(tg) || el.getAttribute("role") === "button") return true;
    if(/^(svg)$/i.test(tg)){ const r = el.getBoundingClientRect(); return r.width <= 64 && r.height <= 64 && !el.closest("button,a,[role=button]"); }
    for(const n of el.childNodes) if(n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  }
  const nameOf = el => { const c = (typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "").trim().split(/\s+/).slice(0, 2).join(".");
    return (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (c ? "." + c : "")).slice(0, 48) + (el.textContent ? " “" + el.textContent.trim().replace(/\s+/g, " ").slice(0, 24) + "”" : ""); };
  TI.safeAudit = function(){
    const H = innerHeight, W = innerWidth, errors = [], warns = [];
    $a("body *").forEach(el => {
      if(el.closest("#__ti_css, script, style, noscript, template, head")) return;
      if(!isUI(el)) return;
      const r0 = el.getBoundingClientRect();
      if(r0.width < 2 || r0.height < 2 || r0.bottom <= 0 || r0.top >= H || r0.right <= 0 || r0.left >= W) return;
      if(r0.top >= SAFE_TOP - 1 && r0.bottom <= H - SAFE_BOT + 1 && r0.left >= 12 && r0.right <= W - 12) return;   // nhanh: nằm gọn vùng an toàn
      const v = visRect(el); if(v.w < 2 || v.h < 2) return;
      if(!shown(el)) return;
      const nm = nameOf(el), box = [Math.round(v.x0), Math.round(v.y0), Math.round(v.w), Math.round(v.h)];
      if(v.y0 < SAFE_TOP - 1) errors.push({ zone: "top", el: nm, box });
      else if(v.y1 > H - SAFE_BOT + 1){
        /* nội dung vùng cuộn tràn dưới thanh home khi CHƯA cuộn hết (sẽ cuộn lên được) = bình thường trên iOS;
           cuộn hết rồi mà vẫn nằm trong dải home = thiếu padding đáy → lỗi */
        const sc = v.scrollClip, ce = sc && sc.el;
        const scrolling = sc && sc.bottom >= H - SAFE_BOT && ce.scrollTop < ce.scrollHeight - ce.clientHeight - 1;
        if(!scrolling) errors.push({ zone: "bottom", el: nm, box });
      }
      if((v.x0 < 12 && v.raw.left >= -1 && v.x0 > 0.5) || (v.x1 > W - 12 && v.raw.right <= W + 1 && v.x1 < W - 0.5)){
        if(!el.closest("button,a,[role=button],input,select,textarea") || /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) warns.push({ zone: "edge", el: nm, box });
      }
    });
    /* sheet đang mở: mép trên ≥ SAFE_TOP + 12, tiêu đề + nút đóng nằm trọn dưới dải trạng thái, đáy chừa thanh home */
    let sheet = null;
    const bd = $q("#sheet-backdrop.open"), sc = bd && ($q("#sheet-content") || $q(".sheet"));
    if(sc){
      const r = sc.getBoundingClientRect(), cs = getComputedStyle(sc);
      const hd = sc.querySelector(".sheet-header"), hr = hd && hd.getBoundingClientRect();
      const cl = hd && hd.querySelector("button, .icon-btn"), cr = cl && cl.getBoundingClientRect();
      sheet = { top: Math.round(r.top), height: Math.round(r.height), padBottom: parseFloat(cs.paddingBottom) || 0, padX: Math.min(parseFloat(cs.paddingLeft) || 0, parseFloat(cs.paddingRight) || 0),
                header: hr ? Math.round(hr.top) : null, close: cr ? [Math.round(cr.left), Math.round(cr.top), Math.round(cr.width), Math.round(cr.height)] : null };
      if(r.top < SAFE_TOP + 12 - 1) errors.push({ zone: "sheet", el: "mép trên sheet y=" + Math.round(r.top) + " < " + (SAFE_TOP + 12), box: [0, Math.round(r.top), W, 0] });
      if(hr && hr.top < SAFE_TOP) errors.push({ zone: "sheet", el: "tiêu đề sheet y=" + Math.round(hr.top), box: [0, Math.round(hr.top), W, Math.round(hr.height)] });
      if(cr && (cr.top < SAFE_TOP || cr.right > W - 8)) errors.push({ zone: "sheet", el: "nút đóng sheet", box: sheet.close });
      if(r.bottom >= H - 1 && sheet.padBottom < SAFE_BOT) errors.push({ zone: "sheet", el: "đáy sheet chỉ chừa " + sheet.padBottom + " px < thanh home " + SAFE_BOT, box: [0, H - SAFE_BOT, W, SAFE_BOT] });
      if(sheet.padX < 16) warns.push({ zone: "edge", el: "lề ngang sheet " + sheet.padX + " px < 16", box: [0, Math.round(r.top), W, 0] });
    }
    const uniq = a => { const seen = new Set(); return a.filter(x => { const k = x.zone + x.el; if(seen.has(k)) return false; seen.add(k); return true; }); };
    return { errors: uniq(errors).slice(0, 20), warns: uniq(warns).slice(0, 12), sheet, fitted: TI.appFitted() };
  };
  function injectCSS(){
    if($q("#__ti_css")) return;
    const st = document.createElement("style"); st.id = "__ti_css";
    st.textContent = `
      :root{ --sat:${SAFE_TOP}px!important; --sab:${SAFE_BOT}px!important; --sal:0px!important; --sar:0px!important; }
      html,body{ scrollbar-width:none; }
      ::-webkit-scrollbar{ width:0!important; height:0!important; display:none!important; }
      *{ caret-color:transparent!important; }
      html, body, #app-shell{ background-color:#03080B; }
      .toast, #toast, .fk-toast, .toast-wrap{ opacity:0!important; visibility:hidden!important; }
      body.__ti-notrans *{ transition:none!important; }
      html:not(.__ti-pop) .ach-pop{ display:none!important; }
      html:not(.__ti-pop) canvas.ach-confetti, html:not(.__ti-pop) .ach-confetti{ display:none!important; }
      /* màn chào: bản app cũ còn mũi tên SMIL chạy trên bản đồ (trước giờ begin nằm ở góc 0,0 = "chấm lạ") → ẩn khi chụp */
      .wl-runner{ display:none!important; }
    `;
    (document.head || document.documentElement).appendChild(st);
    TI.applySafeArea();
  }
  W.addEventListener("load", () => { try{ TI.applySafeArea(); legacyCSS(); }catch(e){} });
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectCSS); else injectCSS();

  /* ---------- tiện ích đo ---------- */
  function scrollableUp(el){
    while(el && el !== document.documentElement){
      const cs = getComputedStyle(el);
      if(/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 200) return el;
      el = el.parentElement;
    }
    return null;
  }
  TI.findScroller = function(hint){
    if(hint){ const h = typeof hint === "string" ? $q(hint) : hint; if(h) return h; }
    const sb = $q("#sheet-backdrop.open") ? ($q("#sheet-content") || $q(".sheet")) : null;
    if(sb){ const s = scrollableUp(sb) || scrollableUp($q("#sheet-content > *")) || $q(".sheet"); if(s) return s; }
    const at = document.elementFromPoint(195, 520);
    return scrollableUp(at) || $q("#app-scroll");
  };
  let curScroller = null, stickyFixed = [];
  function rectOf(el){ const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }
  TI.measure = function(spec){
    spec = spec || {};
    const sc = curScroller = TI.findScroller(spec.scroller);
    const sr = sc ? rectOf(sc) : { x:0, y:0, w:innerWidth, h:innerHeight };
    const vr = { x:0, y:0, w:innerWidth, h:innerHeight };
    // vùng cuộn bị cắt bởi viewport
    const cl = { x: Math.max(0, sr.x), y: Math.max(0, sr.y), w: Math.min(innerWidth, sr.x + sr.w) - Math.max(0, sr.x), h: Math.min(innerHeight, sr.y + sr.h) - Math.max(0, sr.y) };
    /* dải cuộn chỉ lấy PHẦN NỘI DUNG thật sự cuộn: bỏ viền trên + bo góc của sheet và tiêu đề sheet dính (sticky) —
       nếu không, mỗi dải mang theo viền mờ/bo góc của sheet và khi ghép sẽ hiện "vạch ngang" cắt qua nội dung, tiêu đề
       bị cuộn mất. Vùng cuộn bắt đầu trong dải trạng thái (lớp phủ tràn viền) → cắt từ SAFE_TOP (nội dung không đè 9:41). */
    let inset = 0, bandColor = "";
    if(sc){
      const cs = getComputedStyle(sc);
      const isSheet = sc.matches && sc.matches(".sheet, #sheet-content, [role=dialog]");
      const rad = parseFloat(cs.borderTopLeftRadius) || 0;
      if(isSheet || rad > 0) inset = (parseFloat(cs.borderTopWidth) || 0) + rad;
      const hd = isSheet && Array.from(sc.children).find(c => c.classList && c.classList.contains("sheet-header"));
      if(hd && getComputedStyle(hd).position === "sticky") inset = Math.max(inset, Math.ceil(hd.getBoundingClientRect().bottom - cl.y));
      if(cl.y < SAFE_TOP){
        inset = Math.max(inset, SAFE_TOP - cl.y);
        for(let p = sc; p && p !== document.documentElement; p = p.parentElement){ const bg = getComputedStyle(p).backgroundColor; if(bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)){ bandColor = bg; break; } }
        bandColor = bandColor || "#061A24";
      }
      inset = Math.max(0, Math.min(Math.round(inset), Math.max(0, cl.h - 120)));
      cl.y += inset; cl.h -= inset;
    }
    const top0 = sc ? sc.scrollTop : 0;
    const targets = {};
    Object.entries(spec.targets || {}).forEach(([name, sel]) => {
      let el = null;
      try{ el = typeof sel === "function" ? sel() : $a(sel).find(vis); }catch(e){}
      if(!el){ say("thiếu target " + name + " " + sel); return; }
      const r = el.getBoundingClientRect();
      const inside = sc && sc.contains(el);
      // toạ độ: inside → toạ độ tài liệu trong vùng cuộn (cộng scrollTop); ngoài → toạ độ màn hình
      targets[name] = { x: Math.round(r.left), y: Math.round(r.top + (inside ? top0 - cl.y : 0)), w: Math.round(r.width), h: Math.round(r.height), doc: !!inside };
    });
    const max = sc ? Math.max(0, sc.scrollHeight - sc.clientHeight) : 0;
    let light = false; try{ light = !!(W.fkTheme && fkTheme.isLight(fkTheme.current())); }catch(e){}
    return { viewport: vr, scroller: cl, stripInset: inset, bandColor, scrollMax: max, scrollTop: top0, targets, light, theme: (W.fkTheme && fkTheme.current && fkTheme.current()) || "" };
  };
  async function imagesSettled(ms){
    await waitFor(() => $a("img").filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 2 && i.src && !i.complete; }).length === 0, ms || 5000);
  }
  TI.settle = async function(ms){ await sleep(ms || 900); await imagesSettled(); await sleep(150); };
  /* Dải cuộn: tắt sticky trong vùng cuộn (để dải ghép liền mạch) rồi cuộn tới y */
  TI.prepStrips = function(){
    const sc = curScroller; if(!sc) return 0;
    stickyFixed = [];
    /* tắt sticky (dải ghép liền mạch) — trừ tiêu đề sheet: nó nằm trong phần đã cắt bỏ (stripInset) nên giữ dính */
    $a("*", sc).forEach(el => { const p = getComputedStyle(el).position; if(p === "sticky" && !(el.parentElement === sc && el.classList.contains("sheet-header"))){ stickyFixed.push([el, el.style.position]); el.style.position = "relative"; } });
    sc.style.scrollBehavior = "auto"; sc.style.scrollSnapType = "none";
    return Math.max(0, sc.scrollHeight - sc.clientHeight);
  };
  TI.scrollTo = async function(y, wait){
    const sc = curScroller; if(!sc) return 0;
    sc.scrollTop = y; sc.dispatchEvent(new Event("scroll"));
    await sleep(wait || 650); await imagesSettled(3000); await sleep(120);
    return sc.scrollTop;
  };
  TI.endStrips = function(){ stickyFixed.forEach(([el, p]) => el.style.position = p); stickyFixed = []; if(curScroller) curScroller.scrollTop = 0; };

  /* ---------- đóng mọi lớp phủ ---------- */
  async function closeAll(){
    try{ if($q("#sheet-backdrop.open") && G("closeSheet")) closeSheet(); }catch(e){}
    try{ const T = G("TapShop"); if(T && T.isOpen && T.isOpen()) T.close(); }catch(e){}
    try{ const A = G("TE_ADMIN"); if(A && A.isOpen && A.isOpen()) A.close(); }catch(e){}
    try{ const F = G("TE_FINDPT"); if(F && F.closeLightbox) F.closeLightbox(); }catch(e){}
    await sleep(350);
  }
  TI.closeAll = closeAll;
  async function go(screen, ms){ await closeAll(); try{ goto(screen); }catch(e){ say("goto " + screen + " lỗi " + e.message); } const sc = $q("#app-scroll"); if(sc) sc.scrollTop = 0; await TI.settle(ms || 1000); }
  function theme(id){ try{ fkTheme.set(id); }catch(e){ say("theme " + e.message); } }

  /* =========================================================================
     DỮ LIỆU DEMO: người dùng tập đều 4 tuần, nhật ký ăn, nước, ngủ
     ========================================================================= */
  const BASEKG = { chest:50, back:45, legs:70, shoulders:22, arms:14, glutes:60, core:0, full:30 };
  function baseKgFor(meta){
    const m = String((meta && (meta.muscle || meta.group)) || "").toLowerCase();
    const n = String((meta && meta.name) || "").toLowerCase();
    if(/squat|deadlift|leg press|đạp đùi/.test(n)) return 80;
    if(/bench|đẩy ngực/.test(n)) return 55;
    if(/row|chèo|kéo/.test(n)) return 45;
    if(/press|đẩy vai/.test(n)) return 30;
    if(/curl|cuốn|tricep|tay sau|raise|dang/.test(n)) return 12;
    for(const k in BASEKG) if(m.indexOf(k) >= 0) return BASEKG[k];
    if(/ngực/.test(m)) return 50; if(/lưng/.test(m)) return 45; if(/chân|đùi|mông/.test(m)) return 65; if(/vai/.test(m)) return 20; if(/tay/.test(m)) return 12;
    return 25;
  }
  TI.seedHistory = function(){
    const plan = getActivePlan(); if(!plan) return say("không có giáo án");
    const today = new Date(); today.setHours(12, 0, 0, 0);
    state.finishedDates = Array.isArray(state.finishedDates) ? state.finishedDates : [];
    const prevSession = G("session");
    let n = 0;
    for(let back = 29; back >= 1; back--){
      const d = addDays(today, -back), key = ds(d);
      const dk = DAY_KEYS[(d.getDay() + 6) % 7];
      const day = plan.days && plan.days[dk];
      if(!day || !Array.isArray(day.items) || !day.items.length) continue;
      if(rnd() < 0.12) continue;                 // vài buổi nghỉ cho tự nhiên
      const week = Math.floor((29 - back) / 7);
      try{ session = { date:key, sid:"seed" + key, isToday:false, dayKey:dk }; }catch(e){}
      day.items.forEach(item => {
        try{
          const meta = getExerciseMeta(item) || {};
          const reps = item.reps || meta.reps || "8-12";
          const timed = G("isTimedReps") ? isTimedReps(reps) : false;
          const top = parseInt(String(reps).split(/[-–]/).pop(), 10) || 10;
          const kg0 = baseKgFor(meta);
          const kg = timed ? 0 : Math.round((kg0 + week * (kg0 >= 40 ? 2.5 : 1)) * 2) / 2;
          const nsets = Number(item.sets) || 3;
          const sets = Array.from({ length:nsets }, (_, i) => ({ kg, reps: Math.max(1, top - (i === nsets - 1 ? 1 : 0) - (rnd() < .3 ? 1 : 0)), rpe: [7, 7.5, 8, 8.5][Math.min(3, i)], done:true }));
          recordExerciseResult(exKey(item), meta.name || "", reps, sets, timed);
        }catch(e){}
      });
      state.workoutLog[key] = { dayKey:dk, completedExerciseIds: day.items.map(i => i.uid), finishedAt: d.getTime() + 3600e3 * (6 + Math.floor(rnd()*3)) };
      if(!state.finishedDates.includes(key)) state.finishedDates.push(key);
      n++;
    }
    try{ session = prevSession || null; }catch(e){}
    // nước + ngủ + cân nặng
    state.waterLog = state.waterLog || {}; state.sleepLog = state.sleepLog || {};
    for(let back = 13; back >= 0; back--){
      const key = ds(addDays(today, -back));
      state.waterLog[key] = back === 0 ? 1.5 : Math.round((1.8 + rnd() * 1.0) * 4) / 4;
      if(back) state.sleepLog[key] = { start:"23:" + pad(Math.floor(rnd()*50)), end:"06:" + pad(Math.floor(rnd()*40)), hours: Math.round((6.6 + rnd()*1.4)*10)/10, quality: 3 + Math.floor(rnd()*2.2) };
    }
    // nhật ký ăn hôm nay + 6 ngày trước (món thật trong FOODS)
    try{
      const pick = ids => ids.map(id => (FOODS || []).find(f => f.id === id)).filter(Boolean);
      const day = (b, l, dn, s) => ({ breakfast:b, lunch:l, dinner:dn, snack:s });
      const it = (f, g) => ({ name:f.name, grams:g, kcal:Math.round(f.kcal*g/100), protein:Math.round(f.protein*g/10)/10, carbs:Math.round(f.carbs*g/10)/10, fat:Math.round(f.fat*g/10)/10, foodId:f.id });
      const pool = (FOODS || []).filter(f => f && f.kcal > 40);
      state.foodLog = state.foodLog || {};
      for(let back = 6; back >= 0; back--){
        const key = ds(addDays(today, -back));
        const p3 = () => pool[Math.floor(rnd() * pool.length)];
        const meals = back === 0
          ? day([it(p3(), 120), it(p3(), 200)], [it(p3(), 180), it(p3(), 150)], [], [it(p3(), 100)])
          : day([it(p3(), 150)], [it(p3(), 200), it(p3(), 120)], [it(p3(), 180), it(p3(), 120)], [it(p3(), 100)]);
        state.foodLog[key] = meals;
      }
    }catch(e){ say("foodLog " + e.message); }
    // cân nặng (InBody) theo tuần
    try{
      state.inbodyLogs = Array.isArray(state.inbodyLogs) ? state.inbodyLogs : [];
      if(!state.inbodyLogs.length){
        for(let w = 4; w >= 0; w--) state.inbodyLogs.push({ date: ds(addDays(today, -w*7)), weight: Math.round((70.2 + (4-w)*0.45)*10)/10, fat: Math.round((18.5 - (4-w)*0.35)*10)/10, muscle: Math.round((32.1 + (4-w)*0.25)*10)/10 });
      }
    }catch(e){}
    saveState();
    say("seed " + n + " buổi");
    return n;
  };

  /* =========================================================================
     DANH SÁCH SHOT (thứ tự chạy = thứ tự trạng thái) — id phải khớp timeline.json
     ========================================================================= */
  const S = TI.shots = {};
  const order = TI.order = [];
  function shot(id, def){ S[id] = def; order.push(id); }

  // --- 1. Màn chào (landing 3 phần) ---
  /* Bản đồ TapEasy (.wl-map) vẽ khi cuộn tới (~1,5 s) — dải cuộn chụp từng nấc nên trước đây dính lúc đang vẽ dở
     (đường nửa chừng, nút chưa bật). Chụp ở trạng thái đã vẽ xong: wlMapFinish() của app (bản mới) hoặc tự gắn .in.done. */
  TI.wlFinish = function(){
    let ok = false;
    try{ if(typeof W.wlMapFinish === "function") ok = W.wlMapFinish(); }catch(e){}
    $a("#wl .wl-rev").forEach(el => el.classList.add("in", "done"));
    $a("#wl .wl-map .wl-route").forEach(p => { p.style.animation = "none"; p.style.strokeDasharray = "none"; p.style.strokeDashoffset = "0"; });
    $a("#wl .wl-map :is(.wl-stop, .wl-node)").forEach(n => { n.style.animation = "none"; n.style.transform = n.classList.contains("wl-node") ? "translate(-50%,-50%) scale(1)" : "none"; });
    return ok;
  };
  shot("welcome", { setup: async () => { await waitFor(() => $q("#auth.open #auth-guest"), 15000); await sleep(1800); TI.wlFinish(); await sleep(200); }, scroller: "#auth",
    targets: { cta: "#wl-start", guest: "#auth-guest" } });
  // --- 2. Onboarding + sàng lọc ---
  shot("ob0", { setup: async () => { click($q("#auth-guest")); await waitFor(() => vis($q("#onboarding")) && $q("#in-name"), 6000); await sleep(600); setVal($q("#in-name"), "Minh Anh"); await TI.settle(500); },
    scroller: ".onboard-step.active", targets: { next: "#onboard-next", name: "#in-name" } });
  shot("ob1", { setup: async () => { click($q("#onboard-next")); await sleep(450); click($q('[data-field="gender"][data-value="male"]')); setVal($q("#in-age"), "27"); await TI.settle(400); },
    scroller: ".onboard-step.active", targets: { male: '[data-field="gender"][data-value="male"]', next: "#onboard-next" } });
  shot("ob2", { setup: async () => { click($q("#onboard-next")); await sleep(450); setVal($q("#in-height"), "172"); setVal($q("#in-weight"), "70"); setVal($q("#in-bodyfat"), "18"); await TI.settle(400); },
    scroller: ".onboard-step.active", targets: { next: "#onboard-next" } });
  shot("ob3", { setup: async () => { click($q("#onboard-next")); await sleep(450); const a = $a('[data-field="activity"]'); click(a[2] || a[0]); await TI.settle(400); },
    scroller: ".onboard-step.active", targets: { act: '[data-field="activity"].active, [data-field="activity"][aria-checked="true"]', next: "#onboard-next" } });
  shot("ob4", { setup: async () => { click($q("#onboard-next")); await sleep(450); click($q('[data-field="goal"][data-value="gain"]') || $q('[data-field="goal"]')); await sleep(200); click($q('[data-field="level"][data-value="intermediate"]')); await TI.settle(400); },
    scroller: ".onboard-step.active", targets: { goal: '[data-field="goal"][data-value="gain"]', next: "#onboard-next" } });
  shot("health", { setup: async () => { click($q("#onboard-next")); await waitFor(() => $q("#hs-skip"), 6000); await sleep(700);
      const cb = $a('#hs-root input[type=checkbox], .hs-overlay input[type=checkbox], [id^="hs"] input[type=checkbox]').find(vis); if(cb){ cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles:true })); }
      await TI.settle(500); },
    targets: { start: () => $a("button").filter(vis).find(b => /Bắt đầu/.test(b.textContent) && b.closest('[id^="hs"], .hs-overlay, .hs-wrap')) } });
  shot("health2", { setup: async () => {
      const st = $a("button").filter(vis).find(b => /Bắt đầu/.test(b.textContent) && b.closest('[id^="hs"], .hs-overlay, .hs-wrap'));
      click(st); await sleep(700);
      // trả lời "Không" cho các câu đầu tiên để trang có trạng thái chọn
      $a(".hs-opt").filter(vis).forEach(o => { if(/Không/.test(o.textContent)) click(o); });
      await TI.settle(500); } });
  shot("home0", { setup: async () => {
      const sk = $q("#hs-skip"); if(sk && vis(sk)) click(sk); await sleep(900);
      // đóng popup chào mừng / thành tích nếu có
      await closeAll();
      TI.seedHistory();
      state.selectedDay = todayDayKey(); saveState();
      try{ renderAll && renderAll(); }catch(e){}
      await go("home", 1600);
    }, scroller: "#app-scroll", targets: { week: ".week-strip, .week-cal, .home-week, [class*=week]", streak: "[class*=streak]", menu: "#screen-home .btn-menu-trigger" } });
  shot("profile", { setup: async () => { await go("profile", 1300); }, scroller: "#app-scroll" });

  // --- 3. Trang chủ / lịch tuần / chuỗi ngày ---
  shot("home", { setup: async () => { await go("home", 1300); }, scroller: "#app-scroll",
    targets: { explore: "#te-explore", start: () => $a("#home-content button, #home-content .btn").filter(vis).find(b => /Bắt đầu|Tập ngay|Vào tập/.test(b.textContent)) } });
  shot("workout", { setup: async () => { await go("workout", 1300); }, scroller: "#app-scroll",
    targets: { start: () => $a("#screen-workout button").filter(vis).find(b => /Bắt đầu/.test(b.textContent)), first: "#screen-workout .ex-item, #screen-workout .exercise-item, #screen-workout .list-item" } });
  shot("progress", { setup: async () => { await go("progress", 1500); }, scroller: "#app-scroll" });

  // --- 4. Giáo án ---
  shot("templates", { setup: async () => { await closeAll(); openTemplateBrowser(); await TI.settle(1100); },
    targets: { first: "#sheet-content .tpl-card, #sheet-content [data-tpl], #sheet-content .card" } });
  shot("tplDetail", { setup: async () => { const t = (PROGRAM_TEMPLATES || []).find(x => /ppl|push/i.test(x.id + x.name)) || PROGRAM_TEMPLATES[0];
      await closeAll(); openTemplateDetail(t.id); await TI.settle(1100); },
    targets: { add: () => $a("#sheet-content button").filter(vis).find(b => /Thêm vào tuần|Dùng giáo án|Áp dụng/.test(b.textContent)) } });
  shot("builder", { setup: async () => { await closeAll(); openProgramBuilder(); await TI.settle(1200); } });
  shot("plans", { setup: async () => { await go("plans", 1200); }, scroller: "#app-scroll" });

  // --- 5. Buổi tập ---
  shot("session", { setup: async () => {
      await closeAll(); state.selectedDay = todayDayKey();
      const plan = getActivePlan(); let dk = todayDayKey();
      if(!(plan.days[dk] && plan.days[dk].items && plan.days[dk].items.length)) dk = DAY_KEYS.find(k => plan.days[k] && plan.days[k].items && plan.days[k].items.length) || dk;
      state.selectedDay = dk; TI._dk = dk;
      startSession(dk); await sleep(900);
      const hs = $q("#hs-skip"); if(hs && vis(hs)) click(hs);
      // bỏ qua màn khởi động nếu có nút Bắt đầu
      await TI.settle(900);
    }, targets: { kg: "#sheet-content input[inputmode=decimal], #sheet-content input[type=number]", done: () => $a("#sheet-content button").filter(vis).find(b => /Xong hiệp|✓|check/.test(b.textContent) || b.matches(".set-done, [data-set-done]")) } });
  shot("sessionSets", { setup: async () => {
      // điền 1–2 hiệp đầu như người dùng thật rồi tick
      const rows = $a("#sheet-content .set-row, #sheet-content tr, #sheet-content [data-set]").filter(vis);
      const tick = $a("#sheet-content .set-check, #sheet-content [data-act=done], #sheet-content .set-done, #sheet-content button[aria-label*=hiệp]").filter(vis);
      if(tick[0]) click(tick[0]);
      await TI.settle(900);
    } });
  shot("rest", { setup: async () => { try{ startSetRest(90); }catch(e){ say("rest " + e.message); } await sleep(300);
      const r = $q("#set-rest"); if(r){ r.scrollIntoView({ block:"center" }); } await TI.settle(500); },
    targets: { rest: "#set-rest" } });
  shot("warmup", { setup: async () => { try{ stopSetRest && stopSetRest(); }catch(e){}
      const sc = TI.findScroller(); if(sc) sc.scrollTop = 0;
      const b = $a("#sheet-content button").filter(vis).find(x => /Khởi động/.test(x.textContent)); click(b); await TI.settle(1100); } });
  shot("exdetail", { setup: async () => {
      await closeAll(); const plan = getActivePlan(); const dk = TI._dk || todayDayKey(); state.selectedDay = dk;
      const it = (plan.days[dk].items || [])[0]; if(it) openExerciseDetail(it.uid, true); await TI.settle(1500); } });
  shot("history", { setup: async () => {
      await closeAll(); const keys = Object.keys(state.setHist || {}).sort((a, b) => (state.setHist[b].list || []).length - (state.setHist[a].list || []).length);
      const k = keys.find(k => /bench|squat|press/i.test(k)) || keys[0];
      if(k) openExerciseHistory(k, state.setHist[k].name); await TI.settle(1200); } });
  shot("exlib", { setup: async () => { await go("exlib", 1600); }, scroller: "#app-scroll", targets: { search: "#screen-exlib input" } });
  shot("libdetail", { setup: async () => {
      try{ openLibDetail(EXERCISES.benchpress ? "benchpress" : Object.keys(EXERCISES)[0]); }catch(e){ say("lib " + e.message); }
      await TI.settle(1600); } });

  // --- 6. Chu kỳ, giảm tải, siêu hiệp, khối lượng ---
  shot("cycle", { setup: async () => { await closeAll(); try{ FKTP.openCycleSheet(); }catch(e){ say("cycle " + e.message); } await TI.settle(1000); } });
  shot("superset", { setup: async () => { await closeAll(); try{ const p = getActivePlan(); FKTP.openSupersetEditor(p.id, TI._dk || todayDayKey()); }catch(e){ say("ss " + e.message); } await TI.settle(1000); } });
  shot("volume", { setup: async () => { await go("workout", 1300); }, scroller: "#app-scroll",
    targets: { vol: "[class*=vol-card], [class*=volume], .tp-vol" } });

  // --- 7. Thành tích ---
  shot("achieve", { setup: async () => { await closeAll(); try{ FKAch.open(); }catch(e){ say("ach " + e.message); } await TI.settle(1500); }, scroller: "#app-scroll" });
  shot("badgepop", { setup: async () => { await go("home", 800); document.documentElement.classList.add("__ti-pop"); await TI.settle(700); },
    after: async () => { document.documentElement.classList.remove("__ti-pop"); try{ const b = $a(".ach-pop button").find(x => /Tiếp|Đóng|OK/.test(x.textContent)); click(b); }catch(e){} await sleep(300); } });
  shot("weekly", { setup: async () => { await closeAll(); try{ FKAch.openWeekly("last"); }catch(e){} await TI.settle(1300); } });
  shot("records", { setup: async () => { await go("progress", 1000); try{ const b = $a("#screen-progress button, #screen-progress .pill, #screen-progress [role=tab]").find(x => /Kỷ lục/.test(x.textContent)); click(b); }catch(e){} await TI.settle(1000); }, scroller: "#app-scroll" });

  // --- 8. Dinh dưỡng ---
  shot("nutrition", { setup: async () => { await go("nutrition", 2200); }, scroller: "#app-scroll",
    targets: { water: "[class*=water]", plan: "[class*=plan-slot], .np-plan, [class*=menu]" } });
  shot("recipe", { setup: async () => {
      await closeAll(); const r = (RECIPES || []).find(x => /air|nồi chiên/i.test(x.name + (x.tags || "") + (x.method || ""))) || (RECIPES || []).find(x => /gà|ga-/.test(x.id + x.name)) || RECIPES[0];
      openRecipe(r.id); await TI.settle(1600); } });
  shot("recipeVeg", { setup: async () => {
      await closeAll(); const r = (RECIPES || []).find(x => x.veg || /chay|đậu phụ|đậu hũ/i.test(x.name)) || RECIPES[3];
      openRecipe(r.id); await TI.settle(1500); } });
  shot("swap", { setup: async () => { await closeAll(); try{ NutriPro.ui.openSwapSheet(0, "lunch"); }catch(e){ say("swap " + e.message); } await TI.settle(1400); } });
  shot("shopping", { setup: async () => { await closeAll(); try{ NutriPro.ui.openShoppingList(); }catch(e){} await TI.settle(1300); } });
  shot("addfood", { setup: async () => { await closeAll(); try{ openAddFood("lunch"); }catch(e){} await sleep(600);
      const i = $a("#sheet-content input").find(vis); if(i){ setVal(i, "pho bo"); } await TI.settle(1200); } });
  shot("hidekcal", { setup: async () => { await closeAll(); state.nutriPro = state.nutriPro || {}; TI._hk = state.nutriPro.hideKcal; state.nutriPro.hideKcal = true; saveState(); await go("nutrition", 1600); }, scroller: "#app-scroll",
    after: async () => { state.nutriPro.hideKcal = TI._hk; if(TI._hk === undefined) delete state.nutriPro.hideKcal; saveState(); } });

  // --- 9. TapEasy PT (tài khoản demo CỤC BỘ, không phải tài khoản thật) ---
  TI.seedPT = async function(){
    try{
      if(!cloud.isLoggedIn()) await cloud.signUp("pt.demo@tapeasy.local", "demo-" + Math.floor(rnd()*1e8), "Coach Huy");
      await cloud.updateMyProfile({ mainRole:"pt", isPT:true, brandName:"Huy Strength Lab" });
      // số liệu hồ sơ PT demo (không để 0 trên phần "Thành tích huấn luyện")
      try{ await cloud.updateMyProfile({ years:7, stats:{ students:48, sessions:1250, seed:true } }); }catch(e){}
      const names = [["Lan Phương","Giảm mỡ, săn chắc"],["Quốc Bảo","Tăng cơ"],["Thu Hà","Sức khoẻ lưng"],["Minh Tuấn","Chuẩn bị thi đấu"],["Ngọc Ánh","Sau sinh"]];
      const mine = await cloud.myClientsAsPT();
      if(mine.length < 3){
        const today = new Date(); today.setHours(12,0,0,0);
        for(let i = 0; i < names.length; i++){
          const [name, goal] = names[i];
          const total = [12, 24, 16, 36, 12][i];
          const start = ds(addDays(today, -28 - i*3));
          const c = await cloud.createClient({ name, goal, startDate:start, packageTotal:total, health:{ gender: i % 2 ? "male" : "female" } });
          const price = [3600000, 6500000, 4600000, 9000000, 3600000][i];
          await cloud.updateClient(c.id, { pkg:{ price, sessions:total, start, state:"active" },
            payments:[{ date:start, amount: i === 2 ? price/2 : price, price, kind:"pay", sessions:total },
                      { date: ds(addDays(today, -2 - i*3)), amount: price, price, kind:"renew", sessions:total }] });
          if(i < 2){ try{ await cloud.updateClient(c.id, { studentUid:"demo-student-" + i, studentName:name, joinedAt: Date.now() - 864e5*20, linkedVia:"code" }); }catch(e){} }
          for(let k = -10; k <= 6; k++){
            if((k + i) % 3 === 1) continue;
            const d = addDays(today, k*2 + (i % 2));
            await cloud.saveSession(c.id, { date: ds(d), time: ["06:30","07:30","17:30","18:30","19:30"][i], duration:60,
              status: k < 0 ? (k === -4 && i === 3 ? "cancelled" : "done") : "scheduled", title: ["Thân trên","Thân dưới","Toàn thân"][(k+30) % 3] });
          }
          try{ await cloud.addNote(c.id, "Buổi hôm nay squat ổn định hơn, giữ RPE 8 nhé!", "pt"); await cloud.addNote(c.id, "Dạ em cảm ơn anh, mai em tập bù buổi thứ 5 ạ.", "student"); }catch(e){}
        }
      }
      try{ refreshCoachData && (await refreshCoachData(true)); }catch(e){}
    }catch(e){ say("seedPT " + e.message); }
  };
  shot("coach", { setup: async () => { await closeAll(); await TI.seedPT(); await go("coach", 2200); }, scroller: "#app-scroll",
    targets: { client: "#coach-content .client-card, #coach-content .list-item, #coach-content [data-cid]" } });
  shot("client", { setup: async () => {
      const cs = await cloud.myClientsAsPT(); const c = cs.find(x => /Quốc Bảo/.test(x.name)) || cs[0];
      if(c){ TI._cid = c.id; try{ await openClientForm(c.id); }catch(e){ say("client " + e.message); } }
      await TI.settle(1800); }, scroller: "#app-scroll" });
  shot("ptcal", { setup: async () => { await closeAll(); try{ PTP.openCalendar(); }catch(e){ say("cal " + e.message); } await TI.settle(1300); } });
  shot("ptassign", { setup: async () => { await closeAll(); try{ PTP.openAssign(TI._cid); }catch(e){ say("assign " + e.message); } await TI.settle(1300); } });
  shot("ptrevenue", { setup: async () => { await closeAll(); try{ PTP.openRevenue(); }catch(e){ say("rev " + e.message); } await TI.settle(1300); } });
  shot("ptproxy", { setup: async () => { await closeAll(); try{ TEConnect.openProxyLogger(TI._cid); }catch(e){ say("proxy " + e.message); } await TI.settle(1300); } });
  // --- 10. Tìm PT ---
  shot("findpt", { setup: async () => { await closeAll(); try{ TE_FINDPT.open(); }catch(e){ try{ goto("findpt"); }catch(_){} }
      await waitFor(() => $a("#fp-album .fp-card").length, 8000); await TI.settle(1800); }, scroller: "#app-scroll",
    targets: { filters: "[data-fp='filters']", card: "#fp-album .fp-card" } });
  shot("fpfilters", { setup: async () => { click($q("[data-fp='filters']")); await waitFor(() => $q("#ff-prov"), 3000); await TI.settle(900); } });
  /* Hồ sơ PT kiểu F1: hero → cuộn tới "Thành tích huấn luyện" → số đếm 0 → giá trị thật (đếm 2,2 s, trễ 0,8/1,0/1,2 s),
     vòng cung xoay. Chụp CHUỖI KHUNG theo thời gian ảo τ (seq): mọi CSS animation trong phần này bị dừng và tua tới đúng τ
     (Web Animations API), số đếm tính lại đúng công thức của ptprofile.js (ease-out bậc 3) → mượt, tất định, không chụp lúc còn 0. */
  const PP_FALLBACK = [48, 1250, 7];
  shot("fpprofile", { setup: async () => { await closeAll(); try{ await TE_FINDPT.openListing("seed_khang", { from:"findpt" }); }catch(e){ say("fp " + e.message); }
      await waitFor(() => $q("#screen-ptprofile.active"), 6000); await TI.settle(2000); }, scroller: "#app-scroll", noStrips: true,
    targets: { reviews: "#fp-rv-box" },
    seq: { dur: 5.9, fps: 30,
      prep: async () => {
        const sc = TI._ppSc = $q("#app-scroll"); const secs = $a("#pp-content .pp-sec"); const sec = TI._ppSec = secs[1];
        if(!sc || !sec) return say("seq: không thấy phần thành tích");
        try{ const io = G("ppIO"); if(io) io.disconnect(); }catch(e){}
        sc.style.scrollBehavior = "auto"; sc.style.scrollSnapType = "none";
        sec.classList.remove("in", "done");
        $a("[data-count]", sec).forEach((n, i) => { n._counted = true; if(!(+n.dataset.count > 0)) n.dataset.count = PP_FALLBACK[i] || 0; n.textContent = "0"; });
        sc.scrollTop = 0;
        TI._ppY = Math.min(sc.scrollHeight - sc.clientHeight, Math.round(sec.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop));
        TI._ppR = null;
        sec.getAnimations({ subtree:true }).forEach(a => { try{ a.pause(); a.currentTime = 0; }catch(e){} });
        await sleep(250);
        return { y: TI._ppY };
      },
      at: async (tau) => {
        const sc = TI._ppSc, sec = TI._ppSec; if(!sc || !sec) return;
        const io = x => x < .5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2, cl = x => Math.max(0, Math.min(1, x));
        sc.scrollTop = Math.round(TI._ppY * io(cl((tau - .3) / 1.25)));
        const sr = sc.getBoundingClientRect(), r = sec.getBoundingClientRect();
        if(TI._ppR == null && r.top < sr.top + sr.height * .8){ TI._ppR = tau; sec.classList.add("in"); }   // = rootMargin −20 % của ppIO
        const lt = TI._ppR == null ? 0 : tau - TI._ppR;
        sec.getAnimations({ subtree:true }).forEach(a => { try{ a.pause(); a.currentTime = (a.animationName === "ppSpin" ? tau : lt) * 1000; }catch(e){} });
        $a("[data-count]", sec).forEach(n => {
          const target = +n.dataset.count || 0, d = (+n.dataset.delay || 0) / 1000;
          const p = TI._ppR == null ? 0 : cl((lt - d) / 2.2);
          n.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("vi-VN");
        });
      },
      end: async () => { const sec = TI._ppSec; if(sec){ sec.classList.add("in", "done"); $a("[data-count]", sec).forEach(n => n.textContent = (+n.dataset.count || 0).toLocaleString("vi-VN")); }
        try{ const f = G("ppReveal"); if(f) f(); }catch(e){} }
    } });
  // phần còn lại của hồ sơ (thương hiệu, album, bảng giá, đánh giá): tiếp đúng vị trí cuộn cuối chuỗi khung, mọi phần đã hiện đủ
  shot("fpdetails", { setup: async () => {
      $a("#pp-content .pp-sec").forEach(sec => sec.classList.add("in", "done"));
      $a("#pp-content [data-count]").forEach(n => { n._counted = true; n.textContent = (+n.dataset.count || 0).toLocaleString("vi-VN"); });
      const sc = $q("#app-scroll"); if(sc){ sc.style.scrollBehavior = "auto"; sc.scrollTop = TI._ppY || sc.clientHeight; }
      await TI.settle(900); }, scroller: "#app-scroll",
    targets: { reviews: "#fp-rv-box" } });

  // --- 11. Cộng đồng, sự kiện, cửa hàng ---
  shot("community", { setup: async () => { await closeAll(); try{ TECommunity.open(); }catch(e){ goto("community"); } await TI.settle(1800); }, scroller: "#app-scroll" });
  shot("events", { setup: async () => { await closeAll(); try{ TapEv.open("events"); }catch(e){ goto("events"); } await TI.settle(1800); }, scroller: "#app-scroll" });
  shot("challenges", { setup: async () => { try{ const c = (TapEv.cache.challenges || [])[0]; if(c) TapEv.openChallenge(c.id); }catch(e){ say("ch " + e.message); } await TI.settle(1500); } });
  shot("gifts", { setup: async () => { await closeAll(); try{ TapEv.open("gifts"); }catch(e){} await TI.settle(1500); }, scroller: "#app-scroll" });
  shot("shop", { light:true, setup: async () => { await closeAll(); try{ TapShop.open(); }catch(e){ say("shop " + e.message); } await waitFor(() => $a(".tsx-tile").length, 8000); await TI.settle(1800); },
    scroller: () => { const s = $q("#tsx"); return scrollableUp(s && s.querySelector(".tsx-tile")) || s; } });
  shot("product", { light:true, setup: async () => { try{ TapShop.openProduct("p_tee"); }catch(e){} await TI.settle(1500); },
    scroller: () => scrollableUp($q("#tsx .tsx-sw, #tsx [data-sx=add]")) || $q("#tsx") });

  // --- 12. Kho kiến thức ---
  shot("kb", { setup: async () => { try{ TapShop.close(); }catch(e){} await closeAll(); try{ TEKB.open(); }catch(e){ goto("kb"); } await TI.settle(1600); }, scroller: "#app-scroll" });
  shot("kbarticle", { setup: async () => { try{ const l = TEKB.list(); const a = (l || []).find(x => /squat|đạm|protein|ngủ/i.test(x.title || "")) || (l || [])[0]; if(a) TEKB.openArticle(a.id); }catch(e){ say("kb " + e.message); } await TI.settle(1500); }, scroller: "#app-scroll" });

  // --- 13. 16 giao diện ---
  TI.themeIds = () => { try{ return fkTheme.list.map(t => t.id).filter(id => id !== "auto"); }catch(e){ return []; } };
  shot("themepicker", { setup: async () => { await go("profile", 900); try{ const sc = $q("#app-scroll"); const pk = $q("[data-fk-theme]"); if(pk) pk.scrollIntoView({ block:"center" }); }catch(e){} await TI.settle(900); }, scroller: "#app-scroll",
    targets: { pick: "[data-fk-theme]" } });
  ["navy","ocean","sunset","forest","midnight","light","aurora","espresso","alpine","wellness","sanctuary","ember","volt","violet","lime"].forEach(id => {
    shot("theme-" + id, { setup: async () => { await closeAll(); theme(id); await go("home", 1300); }, scroller: "#app-scroll", noStrips: true });
  });
  shot("theme-end", { setup: async () => { theme("navy"); await go("home", 1200); }, scroller: "#app-scroll", noStrips: true });

  // --- 14. Bảo mật ---
  shot("privacy", { setup: async () => { await closeAll(); try{ openPrivacySheet(); }catch(e){} await TI.settle(1200); } });
  shot("account", { setup: async () => { await go("profile", 1200); }, scroller: "#app-scroll",
    targets: { del: () => $a("#screen-profile button, #screen-profile a").filter(vis).find(b => /Xoá tài khoản|Xóa tài khoản/.test(b.textContent)) } });
  shot("menu", { setup: async () => { await go("home", 700); click($q("#screen-home .btn-menu-trigger")); await TI.settle(1000); } });

  /* ---------- chạy 1 shot ---------- */
  TI.run = async function(id){
    const def = S[id]; if(!def) return { error: "không có shot " + id };
    TI.log = [];
    try{ TI.applySafeArea(); }catch(e){}
    try{ await def.setup(); }catch(e){ say("setup " + id + ": " + (e && e.message)); }
    try{ if(TI.applySafeArea()) await sleep(120); }catch(e){}
    const sc = typeof def.scroller === "function" ? (() => { try{ return def.scroller(); }catch(e){ return null; } })() : def.scroller;
    const m = TI.measure({ scroller: sc, targets: def.targets });
    if(def.light !== undefined) m.light = def.light;
    m.id = id; m.noStrips = !!def.noStrips; m.safe = { top: SAFE_TOP, bottom: SAFE_BOT };
    try{ const a = TI.safeAudit(); m.safeAudit = a; if(a.errors.length) say("SAFE " + a.errors.slice(0, 4).map(x => x.zone + ":" + x.el).join(", ")); }catch(e){ say("safeAudit " + e.message); }
    m.log = TI.log.slice();
    return m;
  };
  /* chuỗi khung (seq): capture_app.py gọi seqInfo → seqPrep → seqAt(τ) + chụp, lặp → seqEnd */
  TI.seqInfo = id => { const q = S[id] && S[id].seq; return q ? { dur: q.dur, fps: q.fps || 30 } : null; };
  TI.seqPrep = async id => { const q = S[id].seq; let r = null; try{ r = q.prep ? await q.prep() : null; }catch(e){ say("seqPrep " + e.message); } return Object.assign({ y: TI._ppY || 0 }, r || {}); };
  TI.seqAt = async (id, tau) => { try{ await S[id].seq.at(tau); }catch(e){ say("seqAt " + e.message); } };
  TI.seqEnd = async id => { try{ const q = S[id].seq; if(q.end) await q.end(); }catch(e){} };
  TI.after = async function(id){ const def = S[id]; if(def && def.after){ try{ await def.after(); }catch(e){} } };
})();

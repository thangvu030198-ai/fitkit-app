/* =========================================================================
   TapEasy — THÀNH PHẦN CHỮ KÝ (ui-signature.js + ui-signature.css)
   Học phong cách từ 5 mẫu tham khảo (không dùng tài sản của mẫu), dùng chung toàn app, chạy với MỌI theme (chỉ đọc token):
     A. Trượt để xác nhận (Wellness)  — teSlideConfirm(el, onConfirm, opts). Tự bọc: "Xong bài — kết thúc buổi",
        "Kết thúc & lưu" (PT), "Đặt hàng" (cửa hàng), "Xoá vĩnh viễn tài khoản", "Xoá hết" (đặt lại dữ liệu).
        Nút gốc chỉ bị ẩn (không xoá) — trượt đủ 85 % → gọi nút gốc .click() → mọi trình xử lý/kiểm tra cũ vẫn chạy.
     B. Stepper onboarding (Aurora)    — bọc renderOnboardProgress: 3 chặng Bạn · Cơ thể · Mục tiêu + nội dung hiện so le.
     C. Hồ sơ (Espresso)               — hero mờ dần vào nền + 3 thẻ thống kê có hình minh hoạ (bọc renderProfileScreen).
     D. Trang chủ (Alpine)             — thẻ năng lượng: gauge nửa vòng + nhãn mono "::" + số đếm tăng (bọc renderHomeScreen).
     E. Thẻ chọn bo lớn có số 01/02 (Wellness) — lớp CSS .sig-choices/.sig-choice, tự áp cho onboarding & program builder.
     F. Typewriter + tiêu đề editorial (Sanctuary) — màn Sự kiện / Kho kiến thức khi theme Sanctuary bật.
   Mọi hiệu ứng tắt khi prefers-reduced-motion. Lỗi trong module này không làm hỏng app (try/catch từng phần).
   Nạp: sau mọi module, NGAY TRƯỚC health-safety.js (health-safety luôn cuối, bọc ngoài — chỉ chèn thêm khối, không xoá
   phần trang trí của file này); <link rel="stylesheet" href="ui-signature.css"> ngay sau theme-packs.css.
   Tắt từng phần: window.TE_SIG_OFF = { slide:1, stepper:1, profile:1, gauge:1, typewriter:1 } (đặt trước khi nạp file).
   ========================================================================= */
(function(G){
"use strict";
const D = document;
const OFF = Object.assign({}, G.TE_SIG_OFF || {});
const q = (s, r)=> (r || D).querySelector(s);
const qa = (s, r)=> Array.from((r || D).querySelectorAll(s));
const esc = s=> (typeof G.escapeHtml === "function" ? G.escapeHtml(String(s == null ? "" : s))
  : String(s == null ? "" : s).replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])));
const warn = (m, e)=>{ try{ console.warn("[ui-signature] " + m, e || ""); }catch(_){} };
const RM = ()=>{ try{ return !!(G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; } };
const theme = ()=> D.documentElement.getAttribute("data-theme") || "navy";
const ic = n=> `<span class="material-symbols-rounded">${n}</span>`;
const nf = n=>{ n = Math.round(Number(n) || 0); try{ return n.toLocaleString("vi-VN"); }catch(e){ return String(n); } };
function wrapGlobal(name, after){
  try{
    const old = G[name]; if(typeof old !== "function") return false;
    const w = function(){ const r = old.apply(this, arguments); try{ after.apply(this, arguments); }catch(e){ warn(name, e); } return r; };
    w._sigWrapped = true; G[name] = w;   // hàm khai báo bằng "function" ở script thường = thuộc tính window → mọi lời gọi dùng bản bọc
    return true;
  }catch(e){ warn("wrap " + name, e); return false; }
}

/* ---------- icon bổ sung ---------- */
try{
  if(typeof FK_LINE !== "undefined") Object.assign(FK_LINE, Object.fromEntries(Object.entries({
    arrow_forward:"M5 12h14|M12 5l7 7-7 7",
    keyboard_double_arrow_right:"M6 17l5-5-5-5|M13 17l5-5-5-5",
    sports_score:"M5 21V4|M5 4h12l-2 4 2 4H5",
    shopping_bag:"M6 7h12l1 13H5z|M9 7a3 3 0 0 1 6 0",
    scale:"r:3,4,18,16,4|M8.5 10a4.5 4.5 0 0 1 7 0|M12 10l1.5-2",
  }).filter(([k])=> !FK_LINE[k])));
}catch(e){}

/* =========================================================================
   A. TRƯỢT ĐỂ XÁC NHẬN
   ========================================================================= */
const SNAP = 0.85;
function lowerFirst(s){ s = String(s || "").trim(); return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function teSlideConfirm(el, onConfirm, opts){
  if(typeof el === "string") el = q(el);
  if(!el) return null;
  opts = Object.assign({}, opts || {});
  const isBtn = el.tagName === "BUTTON" || el.getAttribute("role") === "button" || el.tagName === "A";
  const wrapBtn = isBtn && opts.wrap !== false;
  if(wrapBtn && el._sigSlide) return el._sigSlide;
  const orig = wrapBtn ? el : null;
  const baseText = ()=> orig ? (orig.textContent || "").replace(/\s+/g, " ").trim() : "";
  const label = ()=> typeof opts.label === "function" ? opts.label(orig) : (opts.label || ("Trượt để " + lowerFirst(baseText() || "xác nhận")));
  const confirmFn = typeof onConfirm === "function" ? onConfirm : (orig ? ()=> orig.click() : ()=>{});

  const box = D.createElement("div");
  box.className = "sig-slide" + (opts.danger ? " is-danger" : "") + (opts.className ? " " + opts.className : "");
  box.setAttribute("data-state", "idle");
  const hintId = "sig-sh-" + Math.random().toString(36).slice(2, 8);
  box.innerHTML = `<div class="sig-slide-track">
      <span class="sig-slide-fill" aria-hidden="true"></span>
      <span class="sig-slide-label" aria-hidden="true"><span class="t"></span></span>
      <button type="button" class="sig-slide-thumb" aria-describedby="${hintId}">${ic(opts.icon || "arrow_forward")}</button>
    </div><span class="sig-sr" id="${hintId}">Kéo nút sang phải, hoặc nhấn Enter, để xác nhận.</span>`;
  const track = q(".sig-slide-track", box), thumb = q(".sig-slide-thumb", box), fill = q(".sig-slide-fill", box), txt = q(".sig-slide-label .t", box);
  const setLabel = t=>{ txt.textContent = t; thumb.setAttribute("aria-label", t.replace(/^Trượt để /i, "Xác nhận: ")); };
  setLabel(label());

  if(orig){
    orig.classList.add("sig-slide-orig");
    orig.setAttribute("aria-hidden", "true"); orig.tabIndex = -1;
    const par = orig.parentElement;
    let after = orig;
    try{
      if(par && par.classList.contains("tp-wrap")) after = par;   // training-pro bọc nút trong span bắt click (kiểm tra AMRAP) → đặt thanh trượt ngoài span
      else {   // nút đứng trong hàng ngang cùng nút khác (vd "Huỷ | Xoá hết") → đặt thanh trượt dưới hàng
        const cs = par && getComputedStyle(par);
        const sib = par ? Array.from(par.children).filter(c=> c !== orig && c.offsetParent !== null) : [];
        if(cs && cs.display.includes("flex") && !cs.flexDirection.startsWith("column") && sib.length) after = par;
      }
    }catch(e){}
    after.insertAdjacentElement("afterend", box);
  } else if(opts.wrap === false && el){ el.appendChild(box); }

  let p = 0, dragging = false, startX = 0, startP = 0, moved = 0, done = false, resetT = 0;
  const maxPx = ()=> Math.max(1, track.clientWidth - thumb.offsetWidth - 8);
  function paint(v, anim){
    p = Math.max(0, Math.min(1, v));
    box.classList.toggle("is-anim", !!anim && !RM());
    thumb.style.transform = `translate3d(${(p * maxPx()).toFixed(1)}px,0,0)`;
    fill.style.width = `calc(${(p * maxPx()).toFixed(1)}px + 52px)`;
    box.style.setProperty("--sig-p", p.toFixed(3));
  }
  function setState(s){ box.setAttribute("data-state", s); }
  function reset(){
    clearTimeout(resetT); done = false; setState("idle"); thumb.disabled = isDisabled(); setLabel(label()); paint(0, true);
  }
  function isDisabled(){ return !!(orig && (orig.disabled || orig.getAttribute("aria-disabled") === "true")) || !!opts.disabled; }
  function complete(){
    if(done || isDisabled()) { if(!done) paint(0, true); return; }
    done = true; paint(1, true); setState("done");
    try{ navigator.vibrate && navigator.vibrate(18); }catch(e){}
    setTimeout(()=>{
      try{ confirmFn(); }catch(e){ warn("confirm", e); }
      // nút gốc vẫn còn & bật sau 0,9 s (kiểm tra không qua / cần nhập thêm) → trả thanh trượt về đầu
      resetT = setTimeout(()=>{ if(!box.isConnected) return; if(orig && orig.isConnected && !isDisabled()) reset(); else if(!orig && opts.resetAfter !== false) reset(); }, 900);
    }, RM() ? 0 : 180);
  }
  function nudge(){ if(RM() || done) return; box.classList.remove("is-nudge"); void box.offsetWidth; box.classList.add("is-nudge"); }

  thumb.addEventListener("pointerdown", e=>{
    if(done || thumb.disabled) return;
    dragging = true; moved = 0; startX = e.clientX; startP = p; setState("drag");
    try{ thumb.setPointerCapture(e.pointerId); }catch(_){}
    box.classList.remove("is-anim");
  });
  thumb.addEventListener("pointermove", e=>{
    if(!dragging) return;
    const dx = e.clientX - startX; moved = Math.max(moved, Math.abs(dx));
    paint(startP + dx / maxPx(), false);
    if(e.cancelable) e.preventDefault();
  });
  const end = ()=>{
    if(!dragging) return; dragging = false;
    if(p >= SNAP) complete();
    else { setState("idle"); paint(0, true); if(moved < 6) nudge(); }
  };
  thumb.addEventListener("pointerup", end);
  thumb.addEventListener("pointercancel", ()=>{ if(dragging){ dragging = false; setState("idle"); paint(0, true); } });
  thumb.addEventListener("click", e=>{ e.preventDefault(); });   // chạm (không trượt) không xác nhận
  thumb.addEventListener("keydown", e=>{
    if(done) return;
    if(e.key === "Enter" || e.key === " "){ e.preventDefault(); complete(); }
    else if(e.key === "ArrowRight"){ e.preventDefault(); paint(p + .25, true); if(p >= SNAP) complete(); }
    else if(e.key === "ArrowLeft" || e.key === "Escape"){ e.preventDefault(); paint(0, true); }
  });
  track.addEventListener("pointerdown", e=>{ if(e.target === track || e.target.closest(".sig-slide-label")) nudge(); });

  // đồng bộ trạng thái nút gốc (disabled / chữ "Đang xử lý…")
  let mo = null;
  if(orig && typeof MutationObserver === "function"){
    mo = new MutationObserver(()=>{
      if(!box.isConnected){ mo.disconnect(); return; }
      if(isDisabled()){
        thumb.disabled = true;
        if(done){ setState("busy"); const t = baseText(); if(t) txt.textContent = t; }
        else box.classList.add("is-disabled");
      } else {
        box.classList.remove("is-disabled"); thumb.disabled = false;
        if(done){ reset(); } else setLabel(label());
      }
    });
    mo.observe(orig, { attributes:true, attributeFilter:["disabled", "aria-disabled"], childList:true, characterData:true, subtree:true });
  }
  if(isDisabled()){ thumb.disabled = true; box.classList.add("is-disabled"); }
  requestAnimationFrame(()=> paint(0, false));
  const api = { el:box, reset, complete, destroy(){ try{ mo && mo.disconnect(); box.remove(); if(orig){ orig.classList.remove("sig-slide-orig"); orig.removeAttribute("aria-hidden"); orig.removeAttribute("tabindex"); orig._sigSlide = null; } }catch(e){} } };
  if(orig) orig._sigSlide = api;
  return api;
}
G.teSlideConfirm = teSlideConfirm;

/* Nút được bọc tự động (thêm mục: teSig.slideTargets.push({ sel, label, danger, when, icon })) */
const SLIDE_TARGETS = [
  { sel:"#btn-session-done", when:b=> /kết thúc buổi/i.test(b.textContent || ""), label:"Trượt để kết thúc buổi tập", icon:"sports_score" },
  { sel:"#px-finish", label:"Trượt để kết thúc & lưu buổi", icon:"sports_score" },
  /* vòng 2 (ux · FIX-commerce #2, QC-16): BỎ #tsx-place — Cửa hàng dùng nút "ĐẶT HÀNG" thường + hộp xác nhận tóm tắt (shop.js confirmOrder) */
  { sel:"#del-go", label:"Trượt để xoá vĩnh viễn tài khoản", danger:true, icon:"delete_forever" },
  { sel:"#btn-confirm-reset", label:"Trượt để xoá hết dữ liệu", danger:true, icon:"delete_forever" },
];
let scanQueued = false;
function scanSlides(){
  scanQueued = false;
  if(OFF.slide) return;
  SLIDE_TARGETS.forEach(t=>{
    try{
      qa(t.sel).forEach(b=>{
        if(b._sigSlide || b.dataset.sigSkip) return;
        if(t.when && !t.when(b)) return;
        teSlideConfirm(b, null, { label:t.label, danger:t.danger, icon:t.icon, className:t.className });
      });
    }catch(e){ warn("slide " + t.sel, e); }
  });
}
function queueScan(){ if(scanQueued) return; scanQueued = true; (G.requestAnimationFrame || setTimeout)(scanSlides, 16); }

/* =========================================================================
   B. STEPPER ONBOARDING (3 chặng)
   ========================================================================= */
const STEP_GROUPS = [ { label:"Bạn", steps:[0] }, { label:"Cơ thể", steps:[1, 2] }, { label:"Mục tiêu", steps:[3, 4] } ];
let lastObStep = -1;
function renderStepper(){
  if(OFF.stepper) return;
  const prog = D.getElementById("onboard-progress"); if(!prog) return;
  const cur = typeof obStep === "number" ? obStep : Number((q(".onboard-step.active") || {}).dataset ? q(".onboard-step.active").dataset.step : 0) || 0;
  const total = typeof OB_STEPS === "number" ? OB_STEPS : 5;
  const gi = Math.max(0, STEP_GROUPS.findIndex(g=> g.steps.includes(cur)));
  let st = q("#sig-stepper");
  if(!st){
    st = D.createElement("ol"); st.id = "sig-stepper"; st.className = "sig-stepper"; st.setAttribute("aria-label", "Các bước tạo hồ sơ");
    prog.insertAdjacentElement("beforebegin", st);
  }
  prog.classList.add("sig-has-stepper");
  st.innerHTML = STEP_GROUPS.map((g, i)=>{
    const s = i < gi ? "done" : i === gi ? "on" : "off";
    return `<li class="sig-step ${s}" ${s === "on" ? 'aria-current="step"' : ""}><span class="n" aria-hidden="true">${s === "done" ? ic("check") : i + 1}</span><span class="l">${esc(g.label)}</span><span class="sig-sr">${s === "done" ? " — đã xong" : s === "on" ? " — đang làm" : ""}</span></li>`;
  }).join("") + `<li class="sig-step-bar" aria-hidden="true"><i style="width:${Math.round((cur + 1) / total * 100)}%"></i></li>`;
  // nội dung bước hiện so le (fade + y 10px, cách nhau 0,15 s)
  if(cur !== lastObStep){
    lastObStep = cur;
    const act = q(".onboard-step.active");
    if(act && !RM()){ act.classList.remove("sig-reveal"); void act.offsetWidth; act.classList.add("sig-reveal"); }
  }
}

/* =========================================================================
   C. HỒ SƠ: hero mờ dần + thẻ thống kê có minh hoạ
   ========================================================================= */
function illSVG(kind, v){
  const a = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  if(kind === "weight") return `<svg class="sig-ill" viewBox="0 0 64 40" aria-hidden="true"><rect x="8" y="10" width="48" height="26" rx="9" ${a} opacity=".55"/><path d="M22 21a10 10 0 0 1 20 0" ${a}/><path d="M32 21l4-5" ${a} class="acc"/><circle cx="32" cy="21" r="1.6" fill="currentColor"/><path d="M14 6h36" ${a} opacity=".35"/></svg>`;
  if(kind === "bmi"){
    const b = Math.max(15, Math.min(35, Number(v) || 22)); const t = (b - 15) / 20; const ang = Math.PI * (1 - t);
    const x = 32 + 20 * Math.cos(ang), y = 32 - 20 * Math.sin(ang);
    return `<svg class="sig-ill" viewBox="0 0 64 40" aria-hidden="true"><path d="M12 32a20 20 0 0 1 40 0" ${a} opacity=".35"/><path d="M19.6 16.4A20 20 0 0 1 40.5 13.9" ${a} class="acc" stroke-width="3"/><line x1="32" y1="32" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" ${a}/><circle cx="32" cy="32" r="2.4" fill="currentColor"/></svg>`;
  }
  if(kind === "streak"){
    const n = Math.max(0, Math.min(7, Number(v) || 0));
    const bars = Array.from({ length:7 }, (_, i)=> `<rect x="${6 + i * 7.6}" y="${30 - (i < n ? 8 + i * 1.6 : 4)}" width="4.4" height="${i < n ? 8 + i * 1.6 : 4}" rx="2.2" fill="currentColor" ${i < n ? 'class="acc-f"' : 'opacity=".3"'}/>`).join("");
    return `<svg class="sig-ill" viewBox="0 0 64 40" aria-hidden="true"><path d="M50 6c4 5 6 8 6 12a6 6 0 0 1-12 0c0-2 1-4 2-5 0 2 1 3 2 3 0-4 1-7 2-10z" ${a} class="acc"/>${bars}</svg>`;
  }
  return "";
}
function decorateProfile(){
  if(OFF.profile) return;
  const scr = D.getElementById("screen-profile"); if(!scr) return;
  const content = q(".content", scr); if(!content) return;
  const head = content.firstElementChild;
  if(head && q("#profile-avatar", head) && !head.classList.contains("sig-pf-hero")){
    head.classList.add("sig-pf-hero");
    if(!q(".sig-pf-vert", head)){ const v = D.createElement("span"); v.className = "sig-pf-vert"; v.setAttribute("aria-hidden", "true"); v.textContent = "Hồ sơ · " + new Date().getFullYear(); head.appendChild(v); }
  }
  try{ const tb = D.getElementById("btn-edit-targets-profile"); if(tb && !tb.getAttribute("aria-label")) tb.setAttribute("aria-label", "Chỉnh mục tiêu dinh dưỡng"); }catch(e){}   // nút chỉ có icon
  const grid = q(".stat-grid", content); if(!grid) return;
  grid.classList.add("sig-stats");
  const map = [["stat-weight", "weight"], ["stat-bmi", "bmi"], ["stat-streak", "streak"]];
  map.forEach(([id, kind])=>{
    const num = D.getElementById(id); if(!num) return;
    const box = num.closest(".stat-box"); if(!box) return;
    box.classList.add("sig-stat"); box.setAttribute("data-ill", kind);
    let ill = q(".sig-ill-wrap", box);
    if(!ill){ ill = D.createElement("span"); ill.className = "sig-ill-wrap"; box.insertBefore(ill, box.firstChild); }
    const val = num.textContent;
    if(ill.getAttribute("data-v") !== val){ ill.setAttribute("data-v", val); ill.innerHTML = illSVG(kind, parseFloat(String(val).replace(",", "."))); }
  });
}

/* =========================================================================
   D. TRANG CHỦ: thẻ năng lượng — gauge nửa vòng + nhãn mono "::"
   ========================================================================= */
let gaugeAnimated = false;
function arcPath(cx, cy, r){ return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`; }
function gaugeHTML(d){
  const pct = d.goal ? Math.min(1, d.kcal / d.goal) : 0;
  const over = d.goal && d.kcal > d.goal;
  const R = 88, CX = 110, CY = 104;
  const ticks = Array.from({ length:11 }, (_, i)=>{ const a = Math.PI * (1 - i / 10); const r1 = R + 13, r2 = R + (i % 5 === 0 ? 20 : 17);
    return `<line x1="${(CX + r1 * Math.cos(a)).toFixed(1)}" y1="${(CY - r1 * Math.sin(a)).toFixed(1)}" x2="${(CX + r2 * Math.cos(a)).toFixed(1)}" y2="${(CY - r2 * Math.sin(a)).toFixed(1)}"/>`; }).join("");
  const a = Math.PI * (1 - pct), ex = CX + R * Math.cos(a), ey = CY - R * Math.sin(a);
  const left = Math.max(0, Math.round(d.goal - d.kcal));
  const mac = [["Đạm", d.p, d.pt, "p"], ["Tinh bột", d.c, d.ct, "c"], ["Chất béo", d.f, d.ft, "f"]];
  const remTxt = over ? "Vượt " + nf(d.kcal - d.goal) : "Còn " + nf(left);
  return `<div class="sig-gauge-head"><span class="sig-mono">Năng lượng hôm nay</span><span class="sig-mono sig-dim">Mục tiêu ${nf(d.goal)}</span></div>
    <div class="sig-gauge${over ? " is-over" : ""}" style="--sig-pct:${(pct * 100).toFixed(1)}">
      <svg viewBox="0 0 220 120" aria-hidden="true" focusable="false">
        <defs><linearGradient id="sig-g-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="s1"/><stop offset="1" class="s2"/></linearGradient></defs>
        <g class="tk">${ticks}</g>
        <path class="bg" d="${arcPath(CX, CY, R)}" pathLength="100"/>
        <path class="fg" d="${arcPath(CX, CY, R)}" pathLength="100" stroke="url(#sig-g-grad)" style="stroke-dasharray:${(pct * 100).toFixed(2)} 100"/>
        <circle class="dot" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="6"/>
      </svg>
      <div class="sig-gauge-c"><b data-sig-count="${Math.round(d.kcal)}">${nf(d.kcal)}</b><small>kcal đã nạp</small>
        <em class="sig-mono ${over ? "is-over" : ""}">${esc(remTxt)}</em></div>
      <span class="sig-gauge-end l sig-mono" aria-hidden="true">0</span><span class="sig-gauge-end r sig-mono" aria-hidden="true">${nf(d.goal)}</span>
    </div>
    <div class="sig-macros">${mac.map(([l, v, t, k])=> `<div class="sig-mac m-${k}"><span class="sig-mono">${l}</span><b>${Math.round(v)}<small>/${Math.round(t || 0)}g</small></b><i><s style="width:${t ? Math.min(100, Math.round(v / t * 100)) : 0}%"></s></i></div>`).join("")}</div>`;
}
function countUp(el, dur){
  const to = Number(el.getAttribute("data-sig-count")) || 0; if(!to || RM()) return;
  const t0 = performance.now();
  const step = t=>{ if(!el.isConnected) return; const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = nf(to * e); if(k < 1) requestAnimationFrame(step); };
  el.textContent = "0"; requestAnimationFrame(step);
}
function decorateHome(){
  if(OFF.gauge) return;
  const el = D.getElementById("home-content"); if(!el) return;
  const grid = q(".metric-grid", el); if(!grid) return;
  /* integrator (FIX-nutrition vòng 2 #2): đang "Ẩn số calo" (nuHideKcal — mặc định bật khi khai tiền sử RLĂU) → không vẽ thẻ "kcal đã nạp" */
  let hideK = false; try{ hideK = typeof nuHideKcal === "function" && !!nuHideKcal(); }catch(e){}
  if(hideK){ const old = q(".sig-gauge-card", grid); if(old) old.remove(); grid.classList.remove("sig-gauged"); return; }
  const p = (G.state && G.state.profile) || (typeof state !== "undefined" ? state.profile : {}) || {};
  let food = {};
  try{ food = typeof getDayFoodLog === "function" ? getDayFoodLog() : {}; }catch(e){}
  const tot = { kcal:0, p:0, c:0, f:0 };
  Object.values(food || {}).forEach(l=> (Array.isArray(l) ? l : []).forEach(i=>{ tot.kcal += +i.kcal || 0; tot.p += +i.protein || 0; tot.c += +i.carbs || 0; tot.f += +i.fat || 0; }));
  const d = { kcal:tot.kcal, goal:Number(p.goalKcal) || 0, p:tot.p, c:tot.c, f:tot.f, pt:p.protein, ct:p.carbs, ft:p.fat };
  let card = q(".sig-gauge-card", grid);
  const sigKey = [Math.round(d.kcal), d.goal, Math.round(d.p), Math.round(d.c), Math.round(d.f), d.pt, d.ct, d.ft].join("|");
  if(!card){
    card = D.createElement("section");
    card.className = "sig-gauge-card"; card.setAttribute("role", "button"); card.tabIndex = 0;
    card.addEventListener("click", ()=>{ try{ goto("nutrition"); }catch(e){} });
    card.addEventListener("keydown", e=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); try{ goto("nutrition"); }catch(_){} } });
    grid.insertBefore(card, grid.firstChild);
    grid.classList.add("sig-gauged");
  }
  card.setAttribute("aria-label", `Năng lượng hôm nay: ${nf(d.kcal)} trên ${nf(d.goal)} kcal. Mở Dinh dưỡng`);
  if(card.getAttribute("data-k") === sigKey) return;
  card.setAttribute("data-k", sigKey);
  card.innerHTML = gaugeHTML(d);
  if(!gaugeAnimated && !RM()){
    gaugeAnimated = true;
    card.classList.add("is-intro");
    const dur = parseFloat(getComputedStyle(D.documentElement).getPropertyValue("--sig-gauge-dur")) || 1.3;
    const b = q("[data-sig-count]", card); if(b) countUp(b, dur * 1000);
    setTimeout(()=> card.classList.remove("is-intro"), dur * 1000 + 300);
  }
}

/* =========================================================================
   F. TYPEWRITER (Sanctuary) — Sự kiện / Kho kiến thức
   ========================================================================= */
let visit = 0; const typedVisit = {};
function typewrite(el, speed){
  if(!el || el.dataset.sigTw || RM()) return;
  el.dataset.sigTw = "1";
  const full = (el.textContent || "").replace(/\s+/g, " ").trim(); if(!full) return;
  const walker = D.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = []; let n; while((n = walker.nextNode())) if(n.nodeValue) nodes.push([n, n.nodeValue]);
  if(!nodes.length) return;
  el.setAttribute("aria-label", full); el.classList.add("sig-tw");
  nodes.forEach(([node])=> node.nodeValue = "");
  const caret = D.createElement("span"); caret.className = "sig-tw-caret"; caret.setAttribute("aria-hidden", "true");
  let ni = 0, ci = 0;
  const tick = ()=>{
    if(!el.isConnected){ return; }
    const [node, text] = nodes[ni];
    if(caret.previousSibling !== node) node.parentNode.insertBefore(caret, node.nextSibling);
    ci++; node.nodeValue = text.slice(0, ci);
    if(ci >= text.length){ ni++; ci = 0; }
    if(ni < nodes.length) setTimeout(tick, speed + (/[,.·&]/.test(text[ci - 1] || "") ? speed * 3 : 0));
    else { setTimeout(()=>{ caret.remove(); el.classList.remove("sig-tw"); el.removeAttribute("aria-label"); }, 1200); }
  };
  setTimeout(tick, 220);
}
let typeQueued = false;
function queueType(){ if(typeQueued) return; typeQueued = true; setTimeout(()=>{ typeQueued = false; typeScreen(); }, 40); }
function typeScreen(){
  if(OFF.typewriter || theme() !== "sanctuary") return;
  const act = q(".screen.active"); if(!act) return;
  const sid = act.id;
  if(!/screen-(events|kb)$/.test(sid) || typedVisit[sid] === visit) return;
  const h = q(".te-h, .kb-hero h2", act); if(!h) return;
  typedVisit[sid] = visit;
  h.classList.add("sig-editorial");
  typewrite(h, 42);
}

/* =========================================================================
   GẮN VÀO APP
   ========================================================================= */
function hook(){
  if(hook.done) return; hook.done = true;
  // B. stepper
  if(!OFF.stepper){
    if(wrapGlobal("renderOnboardProgress", renderStepper)){ try{ renderStepper(); }catch(e){} }
  }
  // C. hồ sơ
  if(!OFF.profile && wrapGlobal("renderProfileScreen", decorateProfile)){ try{ decorateProfile(); }catch(e){} }
  // D. trang chủ
  if(!OFF.gauge && wrapGlobal("renderHomeScreen", decorateHome)){ try{ decorateHome(); }catch(e){} }
  // F. đổi màn → typewriter
  wrapGlobal("goto", ()=>{ visit++; setTimeout(typeScreen, 140); setTimeout(typeScreen, 600); });
  try{ G.addEventListener("fk:themechange", ()=>{ try{ decorateHome(); decorateProfile(); }catch(e){} }); }catch(e){}
  // A. trượt để xác nhận: theo dõi DOM (sheet, cửa hàng phủ toàn màn)
  try{
    if(typeof MutationObserver === "function") new MutationObserver(muts=>{
      for(const m of muts){ if(m.addedNodes && m.addedNodes.length){ queueScan(); if(theme() === "sanctuary") queueType(); break; } }
    }).observe(D.body, { childList:true, subtree:true });
  }catch(e){ warn("observer", e); }
  queueScan();
}
G.teSig = { slideConfirm:teSlideConfirm, slideTargets:SLIDE_TARGETS, scan:scanSlides, renderStepper, decorateProfile, decorateHome, typewrite, gaugeHTML };
if(D.readyState === "loading") D.addEventListener("DOMContentLoaded", ()=>{ try{ hook(); }catch(e){ warn("hook", e); } });
else { try{ hook(); }catch(e){ warn("hook", e); } }
})(window);

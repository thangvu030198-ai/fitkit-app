/* =========================================================================
   TapEasy — CHỌN BỘ MÔN KHI VÀO APP (sport-picker.js) · 21/11/2026
   Mỗi lần mở app (1 lần / phiên), sau màn chào/đăng nhập: màn tối toàn khung, vòng cung sáng phía sau,
   băng chuyền icon 3D vuốt ngang (bài giữa to + sáng, 2 bên nhỏ, nghiêng, mờ), tên bộ môn + chấm trang + mô tả,
   nút "Vào <bộ môn>". Bộ môn chưa có → vẫn có icon, dòng "COMING SOON" dưới icon, nút khoá "Sắp ra mắt".
   API: window.FKSport = { open(), close(), current(), SPORTS }
   Thiết kế riêng của TapEasy (icon vẽ bằng SVG + CSS) — không dùng logo/thương hiệu của bên thứ ba.
   ========================================================================= */
(function(G){
"use strict";
if(G.FKSport) return;
const D = document;
const KEY_SEL = "fk_sport", KEY_SEEN = "fk_sport_seen";

/* glyph nét (24×24), stroke = currentColor */
const GL = {
  fitness: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  hyrox:   '<path d="M9 7.6a3 3 0 0 1 6 0V9.5"/><path d="M9 7.6V9.5"/><path d="M5.8 15.2a6.2 6.2 0 0 0 12.4 0c0-2.3-1-4.3-2.5-5.7H8.3c-1.5 1.4-2.5 3.4-2.5 5.7z"/><path d="M10 15h4"/>',
  run:     '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2v4M6 12l3-3 4 1 2 3 3 1M11 15l1.5-5"/>',
  cycle:   '<circle cx="6" cy="16" r="3.6"/><circle cx="18" cy="16" r="3.6"/><path d="M6 16l4-7h5l3 7M10 9l3 7h-7M13.5 6h2.5"/>',
  swim:    '<circle cx="16.5" cy="6" r="1.8"/><path d="M5 12l5-3 3 3 3-2M2.5 16.5c1.6 1.2 3.2 1.2 4.8 0s3.2-1.2 4.8 0 3.2 1.2 4.8 0 3.2-1.2 4.6 0M2.5 20c1.6 1.2 3.2 1.2 4.8 0s3.2-1.2 4.8 0 3.2 1.2 4.8 0 3.2-1.2 4.6 0"/>',
  yoga:    '<circle cx="12" cy="4.5" r="1.8"/><path d="M12 7.5v6M5 10.5l7 1.5 7-1.5M7 19.5l5-3.5 5 3.5M4 19.5h16"/>'
};
const SPORTS = [   /* logo bộ môn: thiết kế của TapEasy (anh Thắng gửi 21/11) — assets/sports/*.png */
  { id:"fitness", name:"Fitness", sub:"Giáo án phòng gym · ghi hiệp · dinh dưỡng · PT", ready:true,  img:"assets/sports/fitness.png", c1:"#2FD6C8" },
  { id:"hyrox",   name:"Hyrox",   sub:"8 trạm thể lực xen kẽ 8 × 1 km chạy",           ready:false, img:"assets/sports/hyrox.png",   c1:"#2FD6C8" },
  { id:"run",     name:"Running", sub:"Chạy bộ · lộ trình 5K, 10K, bán marathon",       ready:false, img:"assets/sports/run.png",     c1:"#2FD6C8" },
  { id:"cycle",   name:"Cycling", sub:"Đạp xe trong nhà & ngoài trời theo vùng tim",    ready:false, img:"assets/sports/cycle.png",   c1:"#2FD6C8" }
];

const CSS = `
#fk-sport{ position:absolute; inset:0; z-index:130; display:flex; flex-direction:column; align-items:center; color:#fff; overflow:hidden;
  background:radial-gradient(120% 70% at 50% 38%, #101820 0%, #05080B 60%, #000 100%); font-family:inherit; -webkit-user-select:none; user-select:none;
  padding:calc(14px + env(safe-area-inset-top)) 0 calc(18px + env(safe-area-inset-bottom)); opacity:0; transition:opacity .35s ease; }
#fk-sport.on{ opacity:1; }
#fk-sport.out{ opacity:0; transform:scale(1.04); transition:opacity .35s ease, transform .45s cubic-bezier(.2,.8,.2,1); }
#fk-sport .fs-top{ width:100%; display:flex; align-items:center; justify-content:space-between; padding:0 18px; box-sizing:border-box; position:relative; z-index:3; }
#fk-sport .fs-brand{ font-weight:800; letter-spacing:.02em; font-size:15px; opacity:.9; }
#fk-sport .fs-brand b{ color:var(--fs-c1, #3BE3D3); transition:color .3s; }
#fk-sport .fs-skip{ border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.06); color:#fff; font:inherit; font-size:13px; font-weight:600; border-radius:999px; padding:8px 14px; cursor:pointer; }
#fk-sport .fs-arch{ position:absolute; left:50%; top:13%; width:132%; max-width:620px; transform:translateX(-50%); pointer-events:none; z-index:0; }
#fk-sport .fs-arch path{ transition:stroke .4s; }
#fk-sport .fs-glow{ position:absolute; left:50%; top:33%; width:300px; height:300px; transform:translate(-50%,-50%); border-radius:50%; pointer-events:none; z-index:0;
  background:radial-gradient(circle, var(--fs-glow, rgba(59,227,211,.32)) 0%, transparent 68%); filter:blur(8px); transition:background .4s; }
#fk-sport .fs-head{ position:relative; z-index:2; margin-top:auto; text-align:center; font-size:12px; letter-spacing:.18em; font-weight:700; opacity:.6; }
#fk-sport .fs-track{ position:relative; z-index:2; width:100%; display:flex; gap:0; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none;
  -webkit-overflow-scrolling:touch; padding:7vh 0 3vh; perspective:900px; flex:0 0 auto; }
#fk-sport .fs-track::-webkit-scrollbar{ display:none; }
#fk-sport .fs-pad{ flex:0 0 calc(50% - 88px); }
#fk-sport .fs-item{ flex:0 0 176px; scroll-snap-align:center; display:flex; flex-direction:column; align-items:center; gap:10px; border:0; background:none; color:inherit; padding:0; cursor:pointer;
  transform-style:preserve-3d; will-change:transform, opacity; -webkit-tap-highlight-color:transparent; }
#fk-sport .fs-ic{ position:relative; width:150px; height:150px; border-radius:38px; display:grid; place-items:center;
  background:linear-gradient(150deg, var(--c1) 0%, var(--c2) 100%);
  box-shadow:0 26px 40px -14px var(--c2), inset 0 2px 0 rgba(255,255,255,.55), inset 0 -10px 22px rgba(0,0,0,.28); }
#fk-sport .fs-ic::before{ content:""; position:absolute; inset:0; border-radius:inherit; background:linear-gradient(170deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.08) 38%, transparent 55%); pointer-events:none; }
#fk-sport .fs-ic::after{ content:""; position:absolute; left:12%; right:12%; bottom:-30px; height:26px; border-radius:50%; background:radial-gradient(closest-side, var(--c2), transparent); opacity:.55; filter:blur(6px); }
#fk-sport .fs-ic svg{ position:relative; width:78px; height:78px; color:var(--ink); fill:none; stroke:currentColor; stroke-width:2.1; stroke-linecap:round; stroke-linejoin:round; filter:drop-shadow(0 1px 0 rgba(255,255,255,.35)); }
#fk-sport .fs-ic.logo{ background:linear-gradient(160deg, #FFFFFF 0%, #EEF3F5 55%, #D9E2E6 100%); box-shadow:0 26px 44px -16px rgba(47,214,200,.55), inset 0 2px 0 #fff, inset 0 -10px 20px rgba(13,34,48,.12); }
#fk-sport .fs-ic.logo::after{ background:radial-gradient(closest-side, rgba(47,214,200,.9), transparent); opacity:.35; }
#fk-sport .fs-ic img{ position:relative; width:78%; height:78%; object-fit:contain; pointer-events:none; -webkit-user-drag:none; }
#fk-sport .fs-item.soon .fs-ic img{ filter:grayscale(.35); opacity:.9; }
#fk-sport .fs-cap{ font-size:12px; font-weight:700; opacity:.85; min-height:18px; }
#fk-sport .fs-soon{ font-size:10.5px; font-weight:800; letter-spacing:.14em; padding:4px 9px; border-radius:999px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.22); color:#fff; }
#fk-sport .fs-info{ position:relative; z-index:2; text-align:center; padding:0 28px; margin-top:4vh; }
#fk-sport .fs-dots{ display:flex; gap:6px; justify-content:center; margin-bottom:16px; }
#fk-sport .fs-dots i{ width:6px; height:6px; border-radius:3px; background:rgba(255,255,255,.28); transition:width .25s, background .25s; }
#fk-sport .fs-dots i.on{ width:20px; background:var(--fs-c1, #3BE3D3); }
#fk-sport .fs-name{ font-size:40px; line-height:1.05; font-weight:900; letter-spacing:-.02em; margin:0; }
#fk-sport .fs-sub{ font-size:14px; line-height:1.45; color:rgba(255,255,255,.72); margin:8px auto 0; max-width:300px; min-height:40px; }
#fk-sport .fs-cta{ position:relative; z-index:2; width:calc(100% - 40px); max-width:420px; margin:auto auto 0; min-height:56px; border-radius:999px; border:0; font:inherit; font-size:16px; font-weight:800; cursor:pointer;
  background:#fff; color:#05080B; box-shadow:0 12px 30px -10px var(--fs-glow, rgba(59,227,211,.45)); transition:background .25s, color .25s, transform .12s; }
#fk-sport .fs-cta:active{ transform:scale(.97); }
#fk-sport .fs-cta[disabled]{ background:rgba(255,255,255,.1); color:rgba(255,255,255,.78); box-shadow:none; cursor:default; border:1px solid rgba(255,255,255,.18); }
#fk-sport .fs-hint{ position:relative; z-index:2; font-size:12px; color:rgba(255,255,255,.55); margin-top:10px; text-align:center; }
@media (prefers-reduced-motion: reduce){ #fk-sport, #fk-sport.out{ transition:none; } }
@media (max-height:680px){ #fk-sport .fs-ic{ width:112px; height:112px; border-radius:30px; } #fk-sport .fs-ic svg{ width:58px; height:58px; } #fk-sport .fs-name{ font-size:32px; } #fk-sport .fs-track{ padding-top:3vh; } }
`;

let el = null, idx = 0, raf = 0, lastIdx = -1;
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} },
  sget(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } },
  sset(k, v){ try{ sessionStorage.setItem(k, v); }catch(e){} }
};
const esc = s=> String(s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reduced = ()=>{ try{ return G.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
function buzz(){ try{ if(typeof haptic === "function") haptic("light"); else if(navigator.vibrate) navigator.vibrate(8); }catch(e){} }

function css(){ if(D.getElementById("fk-sport-css")) return; const s = D.createElement("style"); s.id = "fk-sport-css"; s.textContent = CSS; D.head.appendChild(s); }

function html(){
  return `<div class="fs-top"><span class="fs-brand">Tap<b>Easy</b></span><button type="button" class="fs-skip" data-fs-skip>Bỏ qua</button></div>
    <svg class="fs-arch" viewBox="0 0 400 300" aria-hidden="true"><defs><linearGradient id="fsArch" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <path d="M40 300 C40 60 360 60 360 300" fill="none" stroke="url(#fsArch)" stroke-width="2.5"/><path d="M70 300 C70 95 330 95 330 300" fill="none" stroke="var(--fs-c1, #3BE3D3)" stroke-opacity=".35" stroke-width="1.5"/></svg>
    <div class="fs-glow" aria-hidden="true"></div>
    <div class="fs-head">CHỌN BỘ MÔN</div>
    <div class="fs-track" role="listbox" aria-label="Bộ môn">
      <span class="fs-pad" aria-hidden="true"></span>
      ${SPORTS.map((s, i)=> `<button type="button" class="fs-item${s.ready ? "" : " soon"}" role="option" data-fs-i="${i}" aria-label="${esc(s.name)}${s.ready ? "" : " — sắp ra mắt"}" style="--c1:${s.c1};--c2:${s.c2 || s.c1};--ink:${s.ink || "#061A24"}">
        <span class="fs-ic${s.img ? " logo" : ""}">${s.img ? `<img src="${esc(s.img)}" alt="" width="256" height="256" decoding="async" draggable="false">` : `<svg viewBox="0 0 24 24" aria-hidden="true">${GL[s.id] || ""}</svg>`}</span>
        ${s.ready ? `<span class="fs-cap">Đang có</span>` : `<span class="fs-soon">COMING SOON</span>`}
      </button>`).join("")}
      <span class="fs-pad" aria-hidden="true"></span>
    </div>
    <div class="fs-info">
      <div class="fs-dots" aria-hidden="true">${SPORTS.map(()=> "<i></i>").join("")}</div>
      <h2 class="fs-name" aria-live="polite"></h2>
      <p class="fs-sub"></p>
    </div>
    <button type="button" class="fs-cta" data-fs-go></button>
    <div class="fs-hint">Vuốt ngang để xem các bộ môn</div>`;
}

/* vị trí cuộn → biến đổi 3D từng icon + bộ môn đang ở giữa */
function paint(){
  raf = 0; if(!el) return;
  const tr = el.querySelector(".fs-track"), items = el.querySelectorAll(".fs-item");
  const mid = tr.scrollLeft + tr.clientWidth / 2;
  let best = 0, bd = 1e9;
  items.forEach((it, i)=>{
    const c = it.offsetLeft + it.offsetWidth / 2, d = (c - mid) / it.offsetWidth;   // −1 … 1 = 1 ô sang trái/phải
    const a = Math.min(1, Math.abs(d));
    const sc = 1 - .3 * a, ry = Math.max(-1, Math.min(1, d)) * -28, op = 1 - .55 * a, ty = a * 18;
    it.style.transform = reduced() ? "" : `translateY(${ty}px) rotateY(${ry}deg) scale(${sc})`;
    it.style.opacity = String(op);
    if(Math.abs(d) < bd){ bd = Math.abs(d); best = i; }
  });
  if(best !== lastIdx){ lastIdx = best; select(best, false); }
}
function select(i, scroll){
  idx = i; const s = SPORTS[i]; if(!s || !el) return;
  el.style.setProperty("--fs-c1", s.c1);
  el.style.setProperty("--fs-glow", hexA(s.c1, .34));
  el.querySelector(".fs-name").textContent = s.name;
  el.querySelector(".fs-sub").textContent = s.sub;
  el.querySelectorAll(".fs-dots i").forEach((d, k)=> d.classList.toggle("on", k === i));
  el.querySelectorAll(".fs-item").forEach((it, k)=> it.setAttribute("aria-selected", k === i ? "true" : "false"));
  const cta = el.querySelector(".fs-cta");
  cta.disabled = !s.ready;
  cta.textContent = s.ready ? `Vào ${s.name}` : `${s.name} · Sắp ra mắt`;
  if(!scroll) buzz();
  if(scroll){ const it = el.querySelectorAll(".fs-item")[i], tr = el.querySelector(".fs-track"); if(it && tr) tr.scrollTo({ left: it.offsetLeft + it.offsetWidth / 2 - tr.clientWidth / 2, behavior: reduced() ? "auto" : "smooth" }); }
}
function hexA(h, a){ const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

function open(){
  if(el) return;
  css();
  const host = D.getElementById("app-shell") || D.body;
  el = D.createElement("div"); el.id = "fk-sport"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Chọn bộ môn");
  el.innerHTML = html(); host.appendChild(el);
  const tr = el.querySelector(".fs-track");
  tr.addEventListener("scroll", ()=>{ if(!raf) raf = requestAnimationFrame(paint); }, { passive:true });
  el.addEventListener("click", e=>{
    const t = e.target; if(!t || !t.closest) return;
    if(t.closest("[data-fs-skip]")){ close(); return; }
    const it = t.closest("[data-fs-i]");
    if(it){ const i = Number(it.dataset.fsI); if(i !== idx) select(i, true); else if(SPORTS[i].ready) go(); return; }
    if(t.closest("[data-fs-go]")) go();
  });
  el.addEventListener("keydown", e=>{
    if(e.key === "ArrowRight" && idx < SPORTS.length - 1) select(idx + 1, true);
    else if(e.key === "ArrowLeft" && idx > 0) select(idx - 1, true);
    else if(e.key === "Escape") close();
  });
  const start = Math.max(0, SPORTS.findIndex(s=> s.id === (store.get(KEY_SEL) || "fitness")));
  requestAnimationFrame(()=>{
    const it = el.querySelectorAll(".fs-item")[start];
    tr.scrollLeft = it.offsetLeft + it.offsetWidth / 2 - tr.clientWidth / 2;
    lastIdx = -1; paint(); select(start, false);
    el.classList.add("on");
    try{ el.querySelector(".fs-cta").focus({ preventScroll:true }); }catch(e){}
  });
}
function go(){
  const s = SPORTS[idx]; if(!s || !s.ready) return;
  store.set(KEY_SEL, s.id); buzz(); close();
}
function close(){
  if(!el) return; const x = el; el = null; store.sset(KEY_SEEN, "1");
  x.classList.add("out");
  setTimeout(()=> x.remove(), reduced() ? 0 : 420);
}

/* tự mở 1 lần / phiên khi đã vào app (đã qua màn chào / đăng nhập / onboarding) */
function ready(){
  try{
    if(typeof state === "undefined" || !state || !state.onboarded) return false;
    const a = D.getElementById("auth"); if(a && a.classList.contains("open")) return false;
    const ob = D.getElementById("onboarding"); if(ob && ob.offsetParent !== null && getComputedStyle(ob).display !== "none") return false;
    return true;
  }catch(e){ return false; }
}
function auto(){
  if(store.sget(KEY_SEEN)) return;
  let tries = 0;
  const tick = ()=>{ if(store.sget(KEY_SEEN) || el) return; if(ready()) open(); else if(++tries < 600) setTimeout(tick, 500); };   // chờ tối đa ~5 phút (đang đăng nhập / onboarding)
  setTimeout(tick, 700);
}
G.FKSport = { open, close, current: ()=> store.get(KEY_SEL) || "fitness", SPORTS };
if(D.readyState === "complete") auto(); else G.addEventListener("load", auto);
})(typeof window !== "undefined" ? window : globalThis);

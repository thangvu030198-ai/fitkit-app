/* =========================================================================
   TapEasy — HIỆU ỨNG MỞ APP (intro.js) · 21/11/2026
   Nạp NGAY sau <div id="app-shell"> (trước mọi màn) → màn đen phủ kín từ khung hình đầu, không nháy màn chào.
   0–0,7 s  logo TapEasy hiện dần (thu nhỏ → đúng cỡ, nhoè → nét, quầng sáng teal) + chữ TapEasy
   0,7–1,25 s  giữ, quầng sáng "thở"
   1,25–2,5 s  logo vỡ thành hàng nghìn hạt sáng bay ngược lên như khói/tia lửa (quét từ dưới lên), nền đen mờ dần → lộ app
   Chạm bất kỳ đâu = bỏ qua. Máy bật "Giảm chuyển động" → chỉ hiện/mờ logo. Không có canvas (môi trường test) → bỏ qua ngay.
   API: window.FKIntro = { done: bool, skip() } · phát sự kiện "fk-intro-done" trên window khi xong.
   ========================================================================= */
(function(G){
"use strict";
const D = document;
const shell = D.getElementById("app-shell") || D.body;
const FK = G.FKIntro = { done:false, skip(){ finish(true); } };
let finished = false, raf = 0, ov = null;
function finish(fast){
  if(finished) return; finished = true;
  cancelAnimationFrame(raf);
  if(ov){ const o = ov; o.style.transition = `opacity ${fast ? 180 : 320}ms ease`; o.style.opacity = "0"; setTimeout(()=>{ try{ o.remove(); }catch(e){} }, fast ? 200 : 340); }
  FK.done = true;
  try{ G.dispatchEvent(new Event("fk-intro-done")); }catch(e){}
}
try{
  const q = String(G.location && G.location.search || "");
  const cv0 = D.createElement("canvas");
  if(/[?&]nointro\b/.test(q) || !cv0.getContext || !cv0.getContext("2d")){ FK.done = true; return; }
}catch(e){ FK.done = true; return; }

const reduced = (()=>{ try{ return G.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } })();
ov = D.createElement("div"); ov.id = "fk-intro"; ov.setAttribute("aria-hidden", "true");
ov.style.cssText = "position:absolute;inset:0;z-index:200;background:#000;overflow:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent;";
const cv = D.createElement("canvas"); cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
const word = D.createElement("div");
word.innerHTML = 'Tap<b style="color:#02BCB3;font-weight:800">Easy</b>';
word.style.cssText = "position:absolute;left:0;right:0;text-align:center;font:700 26px/1 Inter,'Inter Tight',system-ui,sans-serif;letter-spacing:-.01em;color:#fff;opacity:0;transform:translateY(8px);transition:opacity .5s ease .25s, transform .6s cubic-bezier(.2,.8,.2,1) .25s;";
ov.appendChild(cv); ov.appendChild(word); shell.appendChild(ov);
ov.addEventListener("click", ()=> finish(true));
setTimeout(()=> finish(false), 4200);   // an toàn: không bao giờ kẹt màn đen

const ctx = cv.getContext("2d");
const dpr = Math.min(2, G.devicePixelRatio || 1);
let W = 0, H = 0;
function size(){ const r = ov.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
size();

const img = new Image();
img.decoding = "async";
img.onload = start; img.onerror = ()=> finish(true);
img.src = "assets/brand/logo-mark-512.png";
setTimeout(()=>{ if(!img.complete) finish(true); }, 1500);   // mạng chậm → bỏ hiệu ứng

let L = 0, cx = 0, cy = 0, parts = null, t0 = 0;
const T_IN = 700, T_HOLD = 1250, T_OUT = 2500;
function layout(){ L = Math.min(W * 0.46, H * 0.26, 220); cx = W / 2; cy = H * 0.44; word.style.top = (cy + L * 0.52 + 18) + "px"; }

/* lấy mẫu điểm ảnh logo → hạt */
function sample(){
  const S = Math.round(L), oc = D.createElement("canvas"); oc.width = S; oc.height = S;
  const o = oc.getContext("2d"); o.drawImage(img, 0, 0, S, S);
  let data; try{ data = o.getImageData(0, 0, S, S).data; }catch(e){ return []; }
  const step = S > 180 ? 3 : 2, out = [];
  for(let y = 0; y < S; y += step) for(let x = 0; x < S; x += step){
    const i = (y * S + x) * 4; if(data[i + 3] < 120) continue;
    const ry = y / S;                                   // 0 trên → 1 dưới: phần dưới vỡ trước, quét lên
    out.push({
      x: cx - S / 2 + x, y: cy - S / 2 + y, r: data[i], g: data[i + 1], b: data[i + 2],
      d: (1 - ry) * 420 + Math.random() * 180,          // trễ (ms) theo hàng
      vx: (Math.random() - .5) * 0.9 + (x / S - .5) * 0.8,
      vy: -(1.4 + Math.random() * 2.6),
      s: step * (0.7 + Math.random() * 0.6), w: Math.random() * Math.PI * 2, hot: Math.random() < .22
    });
  }
  return out;
}
function start(){
  if(finished) return;
  layout(); parts = reduced ? [] : sample();
  t0 = performance.now();
  requestAnimationFrame(()=>{ word.style.opacity = "1"; word.style.transform = "none"; });
  raf = requestAnimationFrame(frame);
}
const ease = t=> 1 - Math.pow(1 - t, 3);

function drawLogo(a, sc, blur, glow){
  ctx.save();
  ctx.globalAlpha = a;
  if(glow > 0){ ctx.shadowColor = "rgba(2,188,179,.85)"; ctx.shadowBlur = glow; }
  if(blur > 0.3 && "filter" in ctx) ctx.filter = `blur(${blur}px)`;
  const s = L * sc; ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
  ctx.restore();
}
function halo(a){
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, L * 1.3);
  g.addColorStop(0, `rgba(2,188,179,${.22 * a})`); g.addColorStop(1, "rgba(2,188,179,0)");
  ctx.fillStyle = g; ctx.fillRect(cx - L * 1.4, cy - L * 1.4, L * 2.8, L * 2.8);
}
function frame(now){
  if(finished) return;
  const t = now - t0;
  ctx.clearRect(0, 0, W, H);
  if(reduced){
    const a = t < 400 ? t / 400 : t < 1100 ? 1 : Math.max(0, 1 - (t - 1100) / 300);
    drawLogo(a, 1, 0, 24); if(t > 1100) word.style.opacity = String(a);
    if(t > 1450){ finish(false); return; }
    raf = requestAnimationFrame(frame); return;
  }
  if(t < T_HOLD){
    const k = ease(Math.min(1, t / T_IN));
    halo(k * (0.85 + 0.15 * Math.sin(t / 160)));
    drawLogo(k, 0.82 + 0.18 * k, (1 - k) * 10, 18 + 22 * k);
  } else {
    const te = t - T_HOLD;
    if(te < 260) halo(1 - te / 260);
    if(te > 80) word.style.opacity = String(Math.max(0, 1 - (te - 80) / 380));
    ctx.globalCompositeOperation = "lighter";
    let alive = 0;
    for(let i = 0; i < parts.length; i++){
      const p = parts[i], lt = te - p.d;
      if(lt < 0){ ctx.globalAlpha = 1; ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`; ctx.fillRect(p.x, p.y, p.s, p.s); alive++; continue; }   // chưa vỡ
      const f = lt / 16.7, life = 1 - lt / 1100; if(life <= 0) continue; alive++;
      p.w += 0.09;
      const x = p.x + p.vx * f * 1.6 + Math.sin(p.w + f * 0.05) * 6 * (1 - life);
      const y = p.y + p.vy * f * 1.5 - f * f * 0.012;   // bay lên, tăng tốc nhẹ
      const heat = Math.max(0, 1 - lt / 260);           // lúc vỡ sáng trắng rồi về teal
      const r = Math.round(p.r + (255 - p.r) * (p.hot ? 0.9 : heat)), g = Math.round(p.g + (255 - p.g) * (p.hot ? 0.6 : heat * .8)), b = Math.round(p.b + (255 - p.b) * heat * .6);
      ctx.globalAlpha = Math.min(1, life * 1.15);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const s = p.s * (0.6 + life * 0.6);
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    if(t > T_OUT - 650) ov.style.background = `rgba(0,0,0,${Math.max(0, 1 - (t - (T_OUT - 650)) / 650)})`;
    if(t >= T_OUT || !alive){ finish(false); return; }
  }
  raf = requestAnimationFrame(frame);
}
G.addEventListener("resize", ()=>{ if(!finished){ size(); } });
})(typeof window !== "undefined" ? window : globalThis);

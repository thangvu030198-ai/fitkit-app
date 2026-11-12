/* =========================================================================
   TapEasy intro — bộ dựng khung.  window.__render(t) → Promise (ảnh đã giải mã)
   Thuần theo t: không Date.now / Math.random / fetch trong lúc vẽ.
   Dữ liệu: window.__TIMELINE__ (build/timeline.js, do prep.py sinh)
            window.__MANIFEST__ (build/manifest.js, do capture_app.py sinh; thiếu → màn giả)
   ========================================================================= */
(function(){
"use strict";
/* makeComposer(opts): một bộ dựng gắn vào 1 phần tử stage (compose.html dùng 1; preview_fit.html dựng nhiều
   bộ cùng lúc để làm contact sheet).  opts = { stage, w, h, fps, qa, timeline, manifest, resolve(path) } */
function makeComposer(opts){
const TL = opts.timeline || window.__TIMELINE__;
const MAN = opts.manifest || window.__MANIFEST__ || { scale:1, shots:{}, bg:{}, clip:null };
const W = opts.w || 1080, H = opts.h || 1920, V = H > W;
const FPS = opts.fps || TL.fps || 30;
const RES = opts.resolve || (p => p);   // đường dẫn ảnh → URL (preview tự chứa: data URI)
const BUILD = "build/";
const ROOT = "../../";           // gốc repo (assets/brand…)
const QA = opts.qa || "";        // "fit" | "scr" — tô màu đo khít (qa_fit.py)
const C = TL.chapters;

/* ---------------- toán ---------------- */
const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, p) => a + (b - a) * p;
const outExpo = p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(p));
const inCubic = p => { p = clamp(p); return p * p * p; };
const outCubic = p => { p = clamp(p); return 1 - Math.pow(1 - p, 3); };
const inOut = p => { p = clamp(p); return p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2; };   // ~ cubic-bezier(.65,0,.35,1)
const logLerp = (a, b, p) => Math.exp(lerp(Math.log(a), Math.log(b), p));
/* lò xo đóng (khối lượng 1) từ 0 → 1 */
function spring(t, k, c){
  if(t <= 0) return 0;
  const w0 = Math.sqrt(k), z = c / (2 * w0);
  if(z < 1){ const wd = w0 * Math.sqrt(1 - z*z); return 1 - Math.exp(-z*w0*t) * (Math.cos(wd*t) + (z*w0/wd) * Math.sin(wd*t)); }
  if(z === 1) return 1 - Math.exp(-w0*t) * (1 + w0*t);
  const s = Math.sqrt(z*z - 1), r1 = -w0*(z - s), r2 = -w0*(z + s);
  return 1 + (r2*Math.exp(r1*t) - r1*Math.exp(r2*t)) / (r1 - r2);
}
const SP = { ui:[320,30], cam:[170,26], type:[120,24], heavy:[90,19], play:[260,14] };
const sp = (t, n) => spring(t, SP[n][0], SP[n][1]);
const px = v => v.toFixed(2) + "px";
const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; if(parent) parent.appendChild(e); return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
/* Phụ đề không mồ côi: dấu "·", "—", "–", ":" không đứng đầu dòng (dính vào chữ trước bằng &nbsp;), từ ngắn ≤ 2 ký tự
   (1, PT, &, km, Zone 1–5…) dính vào chữ sau/trước, 2 từ cuối luôn đi cùng nhau; trình duyệt chia dòng cân (text-wrap:balance). */
const NB = "\u00A0";
function typo(s){
  // "~" trong timeline = khoảng trắng không ngắt (vd "Kết~nối")
  const w = String(s).trim().split(/\s+/);
  let out = [];
  for(const x of w){
    if(out.length && /^[·—–:;,.!?)»]/.test(x)){ out[out.length - 1] += NB + x; continue; }          // dấu không mở đầu dòng
    if(out.length && /^\d[\d–.,×]*$/.test(x) && /^\p{L}/u.test(out[out.length - 1])){ out[out.length - 1] += NB + x; continue; }   // "Zone 1–5", "kỳ 4–16"
    out.push(x);
  }
  // cụm giữa hai dấu "·" ngắn (≤ 3 từ) không bị ngắt giữa chừng
  const segs = []; let cur = [];
  out.forEach(x => { cur.push(x); if(/[·]$/.test(x)){ segs.push(cur); cur = []; } }); if(cur.length) segs.push(cur);
  out = []; segs.forEach(g => { if(g.length <= 3 && segs.length > 1) out.push(g.join(NB)); else out.push(...g); });
  for(let i = out.length - 2; i >= 0; i--){                                                             // từ rất ngắn dính chữ sau
    const last = out[i].split(NB).pop();
    if(last.length <= 2 && /[\p{L}\d&]/u.test(last)){ out[i] += NB + out[i + 1]; out.splice(i + 1, 1); }
  }
  if(out.length >= 3){ const a = out.pop(); out[out.length - 1] += NB + a; }                          // 2 từ cuối đi cùng
  return out.join(" ").replace(/~/g, NB);
}
const escT = s => esc(typo(s)).replace(/\u00A0/g, "&nbsp;");

/* ---------------- bảng màu theme (chương 12) ---------------- */
const THEME = {
  navy:["Mặc định","#061A24","#5EE6C7"], ocean:["Đại dương","#06283D","#38BDF8"], sunset:["Hoàng hôn","#2A1020","#FF7A45"],
  forest:["Rừng","#0B2018","#4ADE80"], midnight:["Tím đêm","#120E2A","#A78BFA"], light:["Sáng","#EEF3F5","#0E9F9A"],
  aurora:["Aurora","#050505","#FFFFFF"], espresso:["Espresso","#180A06","#E8A26A"], alpine:["Thu Alpine","#EAE6DE","#F6B733"],
  wellness:["Sương Wellness","#2C353F","#F2D16B"], sanctuary:["Sanctuary","#1D191A","#F1E5C6"], ember:["Cam năng lượng","#F4F4F2","#FF6A2B"],
  volt:["Volt","#0B0B0C","#D4FF3A"], violet:["Tím Đêm Pro","#15161C","#7254FA"], lime:["Chanh sáng","#F7F8F2","#DFFF4F"], end:["Mặc định","#061A24","#5EE6C7"]
};
const themeOf = id => { const m = /^theme-(.+)$/.exec(id || ""); return m ? (THEME[m[1]] || THEME.navy) : null; };

/* ---------------- bố cục ---------------- */
const stage = opts.stage;
stage.style.width = W + "px"; stage.style.height = H + "px";
if(QA) stage.classList.add("qa-fit"); if(QA === "scr") stage.classList.add("qa-scr");
/* Số đo điện thoại — MỘT nguồn. Màn = khung chụp app (390×844 CSS px) đặt nguyên, không co giãn. */
const PH_W = 424, PH_H = 878, SCR_X = 17, SCR_Y = 17, SCR_W = 390, SCR_H = 844;
const R_OUT = 72, R_SCR = R_OUT - SCR_X;                 // bo góc đồng tâm: màn = khung − 17
/* vùng an toàn lúc chụp (capture_app.py ghi vào manifest; iPhone 14/15 Pro: 59 trên / 34 dưới); manifest cũ chưa ghi = 50/22 */
const SAFE = Object.assign({ top:59, bottom:34 }, MAN.safe || ((MAN.shots && Object.keys(MAN.shots).length) ? { top:50, bottom:22 } : {}));
const ISL = { w:120, h:34, y:11 };                       // dynamic island (toạ độ màn) — nằm gọn trong dải trạng thái
const HOME = { w:134, h:5, bottom:8 };
const QR_AR = (TL.qr && TL.qr.ar) || (1284 / 1020);     // thẻ QR: cao/rộng sau khi cắt (prep.py ghi)
function sideOf(ci){
  if(!V){ let s = "right"; for(let i = 0; i <= ci; i++){ if(i && !C[i].carry) s = s === "right" ? "left" : "right"; } return C[ci].kind === "outro" || C[ci].kind === "intro" ? "right" : s; }
  return "center";
}
function L(ci){
  const side = sideOf(ci);
  /* chương "Sắp ra mắt": điện thoại + đồng hồ đứng cạnh nhau (duo) */
  if(C[ci].kind === "soon"){
    if(V) return { side:"center", duo:true, phoneH: H*0.50, cx: W*0.36, cy: H*0.565, tx: W*0.075, tw: W*0.85,
      kickY: H*0.052, kickSize: W*0.025, titleY: H*0.072, titleSize: W*0.092, capY: H*0.902, capSize: W*0.037, capW: W*0.85,
      statX: W*0.04, statY: H*0.36, statSize: W*0.075, tilt: 1, watch: { cx: W*0.765, cy: H*0.585, h: H*0.36 } };
    return { side:"right", duo:true, phoneH: H*0.80, cx: W*0.60, cy: H*0.52, tx: W*0.06, tw: W*0.40,
      kickY: H*0.235, kickSize: H*0.024, titleY: H*0.275, titleSize: H*0.095, capY: H*0.6, capSize: H*0.036, capW: W*0.38,
      statX: W*0.06, statY: H*0.76, statSize: H*0.07, tilt: -1, watch: { cx: W*0.835, cy: H*0.53, h: H*0.70 } };
  }
  if(V) return { side, phoneH: H*0.64, cx: W/2, cy: H*0.567, tx: W*0.075, tw: W*0.85,
    kickY: H*0.052, kickSize: W*0.025, titleY: H*0.072, titleSize: W*0.092, capY: H*0.902, capSize: W*0.037, capW: W*0.85,
    statX: W*0.04, statY: H*0.40, statSize: W*0.075, tilt: (ci % 2 ? -1 : 1) };
  const right = side === "right";
  return { side, phoneH: H*0.87, cx: right ? W*0.715 : W*0.285, cy: H*0.5, tx: right ? W*0.075 : W*0.52, tw: W*0.42,
    kickY: H*0.235, kickSize: H*0.024, titleY: H*0.275, titleSize: H*0.105, capY: H*0.6, capSize: H*0.038, capW: W*0.4,
    statX: right ? W*0.075 : W*0.52, statY: H*0.75, statSize: H*0.075, tilt: right ? -1 : 1 };
}

/* ---------------- nạp ảnh ---------------- */
const pending = new Set();
function img(src, cls, parent){ const i = el("img", cls, parent); i.decoding = "sync"; i.src = RES(src); i.alt = ""; return i; }
function shotData(id){ return MAN.shots && MAN.shots[id]; }

/* ---------------- dựng DOM cho mỗi chương ---------------- */
/* thanh trạng thái 9:41 giả, vẽ TRONG dải an toàn trên (0…SAFE.top), canh giữa theo dynamic island */
const STATUS_SVG = col => { const cy = ISL.y + ISL.h / 2, dy = (cy - 26).toFixed(2); return `<svg class="status" viewBox="0 0 390 ${SAFE.top}" width="390" height="${SAFE.top}"><g fill="${col}">
  <text x="60" y="${(cy + 6).toFixed(2)}" font-family="Inter Tight, Inter, sans-serif" font-weight="700" font-size="17" text-anchor="middle">9:41</text><g transform="translate(0,${dy})">
  <rect x="284" y="27" width="3.2" height="5" rx="1"/><rect x="289.2" y="24.5" width="3.2" height="7.5" rx="1"/><rect x="294.4" y="22" width="3.2" height="10" rx="1"/><rect x="299.6" y="19.5" width="3.2" height="12.5" rx="1"/>
  <path d="M314 23.2a11 11 0 0 1 15 0l-1.5 1.6a8.8 8.8 0 0 0-12 0z M316.6 26a7.2 7.2 0 0 1 9.8 0l-1.6 1.6a5 5 0 0 0-6.6 0z M319.3 28.8a3.3 3.3 0 0 1 4.4 0l-2.2 2.3z"/>
  <rect x="336" y="20.5" width="25" height="12" rx="3.6" fill="none" stroke="${col}" stroke-opacity=".45" stroke-width="1.2"/><rect x="338" y="22.5" width="19" height="8" rx="2"/><path d="M362.6 24.6v4a2 2 0 0 0 0-4z" fill-opacity=".5"/></g></g></svg>`; };

function buildPhone(parent){
  const cam = el("div", "cam", parent);
  const rig = el("div", "rig", cam);
  const tilt = el("div", "tilt", rig);
  const ph = el("div", "phone", tilt);
  [["--ph-w", PH_W], ["--ph-h", PH_H], ["--scr-x", SCR_X], ["--scr-y", SCR_Y], ["--scr-w", SCR_W], ["--scr-h", SCR_H], ["--r-out", R_OUT], ["--r-scr", R_SCR]]
    .forEach(([k, v]) => rig.style.setProperty(k, v + "px"));
  el("div", "shadow", ph); el("div", "frame", ph); el("div", "frame2", ph); el("div", "bezel", ph);
  [[-3, 150, 34], [-3, 205, 62], [-3, 280, 62], [PH_W - 2, 235, 100]].forEach(([x, y, h]) => { const b = el("div", "btn", ph); b.style.left = x + "px"; b.style.top = y + "px"; b.style.height = h + "px"; });
  const scr = el("div", "screen", ph);
  const layers = el("div", "abs", scr); layers.style.width = SCR_W + "px"; layers.style.height = SCR_H + "px";
  const over = el("div", "abs", scr); over.style.width = SCR_W + "px"; over.style.height = SCR_H + "px";
  const statusBox = el("div", "abs", scr);
  const homebar = el("div", "homebar", scr); homebar.style.top = (SCR_H - HOME.bottom - HOME.h) + "px";
  const touch = el("div", "touch", scr), ripple = el("div", "ripple", scr), glow = el("div", "tapglow", scr);
  const island = el("div", "island", ph); el("i", "", island);
  Object.assign(island.style, { left: px(SCR_X + (SCR_W - ISL.w) / 2), top: px(SCR_Y + ISL.y), width: px(ISL.w), height: px(ISL.h) });
  island.firstChild.style.right = px(ISL.h / 2 - 6);
  const glass = el("div", "glass", ph); el("div", "refl", glass); const sheen = el("div", "sheen", glass);
  return { cam, rig, tilt, ph, scr, layers, over, statusBox, homebar, island, touch, ripple, glow, sheen, statusCol:null, mounted:[] };
}

function splitTitle(lines, accent, style){
  // trả về HTML + danh sách phần tử động
  return lines.map((ln, li) => {
    const acc = li === accent ? " acc" : "";
    if(style === "chars"){
      return `<span class="ln${acc}">` + Array.from(ln).map(ch => ch === " " ? `<span class="c">&nbsp;</span>` : `<span class="c">${esc(ch)}</span>`).join("") + `</span>`;
    }
    if(style === "wipe") return `<span class="ln${acc}"><span class="wtxt">${esc(ln)}</span><i class="wipebar"></i></span>`;
    return `<span class="ln${acc}">` + ln.split(" ").map(w => `<span class="mask"><span class="w">${esc(w)}</span></span>`).join(" ") + `</span>`;
  }).join("");
}

/* =====================================================================================================
   CHƯƠNG "SẮP RA MẮT" (kind:"soon") — tính năng cập nhật sau, KHÔNG phải ảnh chụp app:
   - màn điện thoại tự vẽ (mock:run | mock:hyrox | mock:rest | mock:health | mock:summary) theo nhận diện TapEasy (navy/mint/coral)
   - đồng hồ thông minh tự vẽ (CSS/SVG, kiểu chung: mặt tròn, vành chia vạch, 3 nút, dây silicon — không logo/thiết kế hãng nào)
     với giao diện TapEasy trên đồng hồ: chạy (nhịp tim + vùng tim), HYROX, nghỉ giữa hiệp, sức khoẻ/đồng bộ, tổng kết
   - dữ liệu "bay" từ đồng hồ sang điện thoại ở các mốc ch.sync.  Mọi thứ là hàm thuần của t.
   Nội dung: vùng tim 5 mức theo % nhịp tim tối đa (Z1 50–60 · Z2 60–70 · Z3 70–80 · Z4 80–90 · Z5 90–100 %), HYROX = 8 × (1 km chạy
   + 1 trạm): SkiErg 1000 m · Sled Push 50 m · Sled Pull 50 m · Burpee Broad Jump 80 m · Row 1000 m · Farmers Carry 200 m ·
   Sandbag Lunges 100 m · Wall Balls 100 lần; Roxzone = vùng chuyển giữa chạy và trạm (tính vào tổng thời gian).
   ===================================================================================================== */
const ZC = ["#9AA4AE", "#38BDF8", "#34D399", "#FF9F43", "#FF4D5E"];           // màu vùng tim Z1…Z5
const HRMAX = 190;
const mmss = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
const vnum = (x, d) => x.toFixed(d).replace(".", ",");
const pace = s => `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, "0")}"`;
/* nhịp tim "nhảy" theo từng nhịp đập (đổi số mỗi ~0,4 s), tất định */
function hrAt(t, base){ const k = Math.floor(t * 2.5); return Math.round((base || 160) + 4 * Math.sin(k * 1.7) + 3 * Math.sin(k * .61) + 2 * Math.sin(k * 2.9)); }
const zoneOf = hr => clamp(Math.floor((hr / HRMAX - .5) / .1), 0, 4);
const HYROX = [["Chạy 1", "1 km", 281], ["SkiErg", "1000 m", 252], ["Chạy 2", "1 km", 295], ["Sled Push", "50 m", 188], ["Chạy 3", "1 km", 302],
  ["Sled Pull", "50 m", 260], ["Chạy 4", "1 km", 310], ["Burpee Broad Jump", "80 m", 0], ["Chạy 5", "1 km", 0], ["Row", "1000 m", 0], ["Chạy 6", "1 km", 0],
  ["Farmers Carry", "200 m", 0], ["Chạy 7", "1 km", 0], ["Sandbag Lunges", "100 m", 0], ["Chạy 8", "1 km", 0], ["Wall Balls", "100 lần", 0]];
const HY_SWITCH = 3.4;                                                         // giây: xong Burpee Broad Jump → sang Chạy 5
function hyState(lt){
  if(lt < HY_SWITCH) return { cur: 7, st: 151 + lt, total: 2282 + lt, rox: 0 };
  return { cur: 8, st: lt - HY_SWITCH, total: 2282 + lt, rox: Math.min(lt - HY_SWITCH, 1e9) };
}
/* lộ trình GPS (toạ độ bản đồ 358×300) */
const ROUTE = [[38,252],[52,214],[64,176],[82,148],[112,128],[148,118],[176,98],[204,76],[240,66],[276,78],[302,104],[312,140],[304,176],[282,200],[252,214],[222,230],[192,246],[160,258],[124,266],[88,266],[60,262]];
const RLEN = (() => { const a = [0]; for(let i = 1; i < ROUTE.length; i++) a.push(a[i-1] + Math.hypot(ROUTE[i][0]-ROUTE[i-1][0], ROUTE[i][1]-ROUTE[i-1][1])); return a; })();
function routeAt(p){ const L = RLEN[RLEN.length-1] * clamp(p); let i = 1; while(i < RLEN.length - 1 && RLEN[i] < L) i++; const a = ROUTE[i-1], b = ROUTE[i], q = (L - RLEN[i-1]) / Math.max(1e-6, RLEN[i] - RLEN[i-1]); return [lerp(a[0], b[0], q), lerp(a[1], b[1], q)]; }
const SPLITS = [324, 315, 309, 312, 303, 310];
const SOON_TAG = `<span class="mk-soon">Sắp ra mắt</span>`;
const ICON = {
  heart: `<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>`,
  run: `<svg viewBox="0 0 24 24"><circle cx="14.5" cy="4.5" r="2.2" fill="currentColor"/><path d="M9 21l2.4-5.6 2.6 2.4V22M7 12.5l2.8-3.6 4 .8 2.2 3.3 3 .6M11.4 15.4l1.4-5.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  watch: `<svg viewBox="0 0 24 24"><rect x="8" y="1.5" width="8" height="4" rx="1.5" fill="currentColor" opacity=".55"/><rect x="8" y="18.5" width="8" height="4" rx="1.5" fill="currentColor" opacity=".55"/><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8.5V12l2.4 1.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  sync: `<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M18.6 3.2v4.2h-4.2M5.4 20.8v-4.2h4.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  warn: `<svg viewBox="0 0 24 24"><path d="M12 3l10 18H2z" fill="currentColor"/><path d="M12 10v5M12 17.6v.4" stroke="#1B0F0A" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};
/* cung tròn SVG (độ, 0 = 12 giờ, theo chiều kim đồng hồ) */
function arcD(cx, cy, r, a0, a1){ const P = a => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)]; const [x0, y0] = P(a0), [x1, y1] = P(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; }

/* ---------- màn điện thoại tự vẽ ---------- */
function buildMock(kind, root){
  root.classList.add("mk-root");
  const m = { kind, root, q: {} };
  const box = el("div", "mk mk-" + kind, root);
  const top = (title, sub) => `<div class="mk-top"><span class="mk-back">‹</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div>${SOON_TAG}</div>`;
  if(kind === "run"){
    const streets = [[0,40,358,70],[0,150,358,128],[0,230,358,262],[70,0,96,300],[180,0,170,300],[290,0,262,300],[0,300,120,0]].map(([a,b,c,d]) => `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}"/>`).join("");
    box.innerHTML = top("Chạy bộ", "Buổi sáng · GPS") + `
      <div class="mk-map"><svg viewBox="0 0 358 300">
        <path class="mk-park" d="M118 150 C140 128,200 122,236 140 C268 158,262 196,226 206 C186 220,130 206,116 184 Z"/>
        <path class="mk-river" d="M-10 292 C80 270,160 300,240 282 S330 250,370 262"/>
        <g class="mk-street">${streets}</g>
        <polyline class="mk-route-ghost" points="${ROUTE.map(p => p.join(",")).join(" ")}"/>
        <polyline class="mk-route" points="${ROUTE.map(p => p.join(",")).join(" ")}" stroke-dasharray="${RLEN[RLEN.length-1].toFixed(1)}"/>
        <g class="mk-kms"></g>
        <circle class="mk-start" cx="${ROUTE[0][0]}" cy="${ROUTE[0][1]}" r="6"/>
        <circle class="mk-me-halo" r="15"/><circle class="mk-me" r="6.5"/>
      </svg><div class="mk-gps"><i></i>GPS mạnh</div></div>
      <div class="mk-stats"><div><b class="q-km">0</b><small>km</small></div><div><b class="q-pace">–</b><small>pace /km</small></div><div><b class="q-time">–</b><small>thời gian</small></div><div><b class="q-hr">–</b><small>bpm</small></div></div>
      <div class="mk-zone"><div class="mk-lab">Thời gian trong vùng tim</div><div class="mk-zbar">${ZC.map((c, i) => `<i style="background:${c}"></i>`).join("")}</div>
        <div class="mk-zleg">${ZC.map((c, i) => `<span><i style="background:${c}"></i>Z${i+1}</span>`).join("")}</div></div>
      <div class="mk-splits"><div class="mk-lab">Splits từng km</div>${SPLITS.map((s, i) => `<div class="mk-split"><span>${i+1}</span><div class="mk-sbar"><i style="width:${(100 * (1 - (s - 290) / 60)).toFixed(1)}%"></i></div><b>${pace(s)}</b></div>`).join("")}</div>`;
    m.q.route = box.querySelector(".mk-route"); m.q.me = box.querySelector(".mk-me"); m.q.halo = box.querySelector(".mk-me-halo"); m.q.kms = box.querySelector(".mk-kms");
    m.q.zb = Array.from(box.querySelectorAll(".mk-zbar i")); m.q.sp = Array.from(box.querySelectorAll(".mk-split"));
    ["km", "pace", "time", "hr"].forEach(k => m.q[k] = box.querySelector(".q-" + k));
  } else if(kind === "hyrox"){
    box.innerHTML = top("HYROX", "Mô phỏng thi đấu · Open") + `
      <div class="mk-hyhead"><div><small>Tổng thời gian</small><b class="q-total">00:00</b></div><div><small>Roxzone</small><b class="q-rox">03:46</b></div></div>
      <div class="mk-hylist">${HYROX.map(([nm, ds, tm], i) => `<div class="mk-hy ${i % 2 ? "st" : "rn"}"><span class="ix">${i % 2 ? (i + 1) / 2 : ICON.run}</span><div><b>${esc(nm)}</b><small>${ds}</small></div><em>${tm ? mmss(tm) : "—"}</em></div>`).join("")}</div>`;
    m.q.rows = Array.from(box.querySelectorAll(".mk-hy")); m.q.total = box.querySelector(".q-total"); m.q.rox = box.querySelector(".q-rox");
  } else if(kind === "rest"){
    box.innerHTML = top("Buổi tập hôm nay", "Thân trên · Sức mạnh") + `
      <div class="mk-card mk-ex"><b>Đẩy ngực tạ đòn</b><small>4 hiệp · nghỉ 1:00</small>
        <div class="mk-sets">${[["1","60 kg","8",1],["2","60 kg","8",1],["3","62,5 kg","6",0],["4","62,5 kg","6",0]].map(([k,kg,r,d]) => `<div class="${d ? "done" : ""}"><span>${k}</span><span>${kg}</span><span>× ${r}</span><i>${d ? ICON.check : ""}</i></div>`).join("")}</div></div>
      <div class="mk-card mk-rest"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="84" class="bg"/><circle cx="100" cy="100" r="84" class="fg" transform="rotate(-90 100 100)" stroke-dasharray="${(2 * Math.PI * 84).toFixed(2)}"/></svg>
        <div class="mk-restc"><small>Nghỉ giữa hiệp</small><b class="q-rest">0:24</b><small>Tiếp: hiệp 3 · 62,5 kg × 6</small></div></div>
      <div class="mk-btns"><span>−15 s</span><span>+15 s</span><span class="pri">Bỏ qua</span></div>
      <div class="mk-wchip">${ICON.watch}Đồng hồ rung khi hết giờ nghỉ</div>`;
    m.q.ring = box.querySelector(".mk-rest .fg"); m.q.rest = box.querySelector(".q-rest");
  } else if(kind === "health"){
    box.innerHTML = top("Sức khoẻ", "Đồng bộ từ đồng hồ") + `
      <div class="mk-card mk-sync"><span class="ic">${ICON.watch}</span><div><b>Đồng hồ thông minh</b><small class="q-sync">Đang đồng bộ…</small></div><span class="sp">${ICON.sync}</span></div>
      <div class="mk-grid">
        <div class="mk-card mk-hr"><div class="mk-lab">${ICON.heart} Nhịp tim</div><b class="q-hr">64</b><small>bpm lúc nghỉ</small>
          <svg viewBox="0 0 160 46" class="mk-spark"><polyline class="q-line" points=""/></svg></div>
        <div class="mk-card"><div class="mk-lab">HRV</div><b class="q-hrv">0</b><small>ms · ổn định</small></div>
        <div class="mk-card"><div class="mk-lab">SpO₂</div><b class="q-spo">0</b><small>% oxy trong máu</small></div>
        <div class="mk-card"><div class="mk-lab">VO₂max</div><b class="q-vo">0</b><small>ước tính · Tốt</small></div>
        <div class="mk-card mk-sleep"><div class="mk-lab">Giấc ngủ</div><b>7 g 24 ph</b>
          <div class="mk-stage">${[[8,"#5b6b75"],[22,"#38BDF8"],[46,"#7C9CF5"],[24,"#5EE6C7"]].map(([w, c]) => `<i style="flex:${w};background:${c}"></i>`).join("")}</div><small>Thức · REM · Nông · Sâu</small></div>
      </div>
      <div class="mk-alert">${ICON.warn}<div><b>Cảnh báo nhịp tim cao</b><small>186 bpm lúc đang nghỉ · ngưỡng bạn đặt 180</small></div></div>`;
    m.q.cards = Array.from(box.querySelectorAll(".mk-grid .mk-card")); m.q.alert = box.querySelector(".mk-alert");
    ["hr", "hrv", "spo", "vo", "sync", "line"].forEach(k => m.q[k] = box.querySelector(".q-" + k)); m.q.sp = box.querySelector(".mk-sync .sp");
  } else {
    box.innerHTML = top("Nhật ký tập", "Tự ghi từ đồng hồ") + `
      <div class="mk-card mk-sum"><div class="mk-lab">${ICON.run} Chạy bộ buổi sáng · 06:10</div><b class="q-km">10,02</b><small>km</small>
        <div class="mk-sumg"><div><b>52:40</b><small>thời gian</small></div><div><b>5'15"</b><small>pace TB</small></div><div><b>148</b><small>bpm TB</small></div>
          <div><b>176</b><small>bpm tối đa</small></div><div><b>612</b><small>kcal</small></div><div><b>49</b><small>VO₂max</small></div></div>
        <div class="mk-zbar">${[6, 24, 41, 23, 6].map((w, i) => `<i style="flex:${w};background:${ZC[i]}"></i>`).join("")}</div></div>
      <div class="mk-saved">${ICON.check}<div><b>Đã lưu vào Nhật ký tập</b><small>Tự ghi từ đồng hồ · không cần nhập tay</small></div></div>`;
    m.q.card = box.querySelector(".mk-sum"); m.q.saved = box.querySelector(".mk-saved"); m.q.km = box.querySelector(".q-km");
  }
  m.render = (lt, t) => renderMock(m, lt, t);
  return m;
}
function renderMock(m, lt){
  const q = m.q;
  if(m.kind === "run"){
    const p = inOut((lt - .4) / 7.6), L = RLEN[RLEN.length - 1];
    q.route.setAttribute("stroke-dashoffset", (L * (1 - p)).toFixed(1));
    const [x, y] = routeAt(p); q.me.setAttribute("cx", x.toFixed(1)); q.me.setAttribute("cy", y.toFixed(1));
    q.halo.setAttribute("cx", x.toFixed(1)); q.halo.setAttribute("cy", y.toFixed(1)); q.halo.setAttribute("r", (10 + 8 * ((lt * 1.2) % 1)).toFixed(2)); q.halo.style.opacity = (.55 * (1 - (lt * 1.2) % 1)).toFixed(3);
    const kmTot = 6.42, km = kmTot * p, nk = Math.floor(km + 1e-6);
    if(q.kms.childElementCount !== nk){ let h = ""; for(let i = 1; i <= nk; i++){ const [a, b] = routeAt(i / kmTot); h += `<g><circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="8.5"/><text x="${a.toFixed(1)}" y="${(b + 3.4).toFixed(1)}">${i}</text></g>`; } q.kms.innerHTML = h; }
    q.km.textContent = vnum(km, 2); q.pace.textContent = p > .02 ? `5'12"` : "–"; q.time.textContent = mmss(1928 * p + lt * 0);
    q.hr.textContent = p > .02 ? String(hrAt(lt)) : "–";
    const zw = [6, 22, 38, 27, 7], g = outCubic((lt - 1.2) / 1.4);
    q.zb.forEach((e, i) => e.style.flex = String(Math.max(.001, zw[i] * g)));
    q.sp.forEach((e, i) => { const a = sp(lt - 2.2 - i * .28, "ui"); e.style.opacity = clamp(a * 1.5).toFixed(3); e.style.transform = `translate3d(${px(18 * (1 - a))},0,0)`; e.querySelector(".mk-sbar i").style.transform = `scaleX(${clamp(a).toFixed(3)})`; });
  } else if(m.kind === "hyrox"){
    const S = hyState(lt);
    q.total.textContent = mmss(S.total); q.rox.textContent = mmss(226 + (S.cur === 8 ? Math.min(S.rox, 14) : 0));
    q.rows.forEach((r, i) => {
      r.classList.toggle("done", i < S.cur); r.classList.toggle("cur", i === S.cur);
      const em = r.querySelector("em");
      if(i === S.cur) em.textContent = mmss(S.st);
      else if(i === 7 && S.cur > 7) em.textContent = mmss(151 + HY_SWITCH);
      else if(!HYROX[i][2]) em.textContent = "—";
      const a = sp(lt - .1 - i * .035, "ui"); r.style.opacity = (clamp(a * 1.4) * (i > S.cur ? .45 : 1)).toFixed(3); r.style.transform = `translate3d(0,${px(10 * (1 - a))},0)`;
    });
  } else if(m.kind === "rest"){
    const rem = 24.4 - lt, C0 = 2 * Math.PI * 84;
    q.ring.setAttribute("stroke-dashoffset", (C0 * (1 - clamp(rem / 60))).toFixed(2));
    q.rest.textContent = "0:" + String(Math.max(0, Math.ceil(rem))).padStart(2, "0");
  } else if(m.kind === "health"){
    const sy = clamp((lt - .3) / 1.6);
    q.sync.textContent = sy < 1 ? "Đang đồng bộ… " + Math.round(sy * 100) + " %" : "Đã đồng bộ · vừa xong";
    q.sp.style.transform = `rotate(${(sy < 1 ? lt * 300 : 0).toFixed(1)}deg)`; q.sp.style.color = sy < 1 ? "" : "var(--mint)";
    q.cards.forEach((c, i) => { const a = sp(lt - 1.2 - i * .16, "ui"); c.style.opacity = clamp(a * 1.4).toFixed(3); c.style.transform = `translate3d(0,${px(16 * (1 - a))},0) scale(${(.96 + .04 * clamp(a)).toFixed(4)})`; });
    const v = k => outExpo((lt - 1.4 - k * .16) / 1.2);
    q.hr.textContent = String(Math.round(64 * v(0))); q.hrv.textContent = String(Math.round(62 * v(1))); q.spo.textContent = String(Math.round(97 * v(2))); q.vo.textContent = String(Math.round(49 * v(3)));
    const pts = []; for(let i = 0; i <= 40; i++){ const x = i * 4, ph = (i + lt * 6); pts.push(`${x},${(30 - 10 * Math.max(0, Math.sin(ph * .9)) ** 6 * 2.2 + 3 * Math.sin(ph * .31)).toFixed(1)}`); }
    q.line.setAttribute("points", pts.join(" "));
    const al = sp(lt - 5.0, "play"); q.alert.style.opacity = clamp(al * 2).toFixed(3); q.alert.style.transform = `translate3d(0,${px(30 * (1 - al))},0) scale(${(.9 + .1 * al).toFixed(4)})`;
  } else {
    const a = sp(lt - .3, "ui"), b = sp(lt - 1.6, "play");
    q.card.style.opacity = clamp(a * 1.5).toFixed(3); q.card.style.transform = `translate3d(0,${px(24 * (1 - a))},0)`;
    q.km.textContent = vnum(10.02 * outExpo((lt - .4) / 1.4), 2);
    q.saved.style.opacity = clamp(b * 2).toFixed(3); q.saved.style.transform = `scale(${(.85 + .15 * b).toFixed(4)})`;
  }
}

/* ---------- đồng hồ thông minh tự vẽ ---------- */
const WW = 300, WH = 600, WF = 236;                       // khung đồng hồ (px nội bộ) · đường kính mặt hiển thị
function buildSoon(n){
  const w = n.watch = el("div", "watch", n.fg);
  w.style.width = WW + "px"; w.style.height = WH + "px";
  const ticks = Array.from({ length: 60 }, (_, i) => { const a = i * 6, l = i % 5 ? 6 : 12; return `<line x1="150" y1="${10}" x2="150" y2="${10 + l}" transform="rotate(${a} 150 150)" stroke-width="${i % 5 ? 1.4 : 2.6}"/>`; }).join("");
  w.innerHTML = `
    <div class="w-strap top"></div><div class="w-strap bot">${Array.from({ length: 6 }, (_, i) => `<i style="top:${54 + i * 26}px"></i>`).join("")}</div>
    <div class="w-btn" style="right:-9px;top:205px;height:46px"></div><div class="w-btn crown" style="right:-13px;top:278px;height:42px"></div>
    <div class="w-btn" style="right:-9px;top:347px;height:46px"></div><div class="w-btn" style="left:-9px;top:262px;height:74px"></div>
    <div class="w-case"><svg class="w-bezel" viewBox="0 0 300 300"><circle cx="150" cy="150" r="146" class="ring"/><g class="tk">${ticks}</g></svg>
      <div class="w-face"><div class="w-scr"></div><div class="w-glare"></div></div></div>`;
  n.wFace = w.querySelector(".w-face"); n.wScrBox = w.querySelector(".w-scr");
  n.wScr = {};
  ["run", "hyrox", "rest", "health", "summary"].forEach(k => { const d = el("div", "ws ws-" + k, n.wScrBox); d.innerHTML = watchHTML(k); n.wScr[k] = d; });
  n.soonChip = el("div", "soonchip", n.txt, "Sắp ra mắt");
  n.fly = el("div", "flylayer", n.fg);
  n.flyDots = Array.from({ length: 8 }, (_, i) => el("div", "fly" + (i % 3 === 0 ? " hrt" : ""), n.fly, i % 3 === 0 ? ICON.heart : ""));
  n.landRing = el("div", "landring", n.fly);
}
function watchHTML(k){
  const c = WF / 2;
  if(k === "run"){
    const segs = ZC.map((col, i) => { const a0 = -135 + i * 54 + 2, a1 = a0 + 50; return `<path d="${arcD(c, c, 108, a0, a1)}" stroke="${col}" class="zs"/>`; }).join("");
    return `<svg class="wz" viewBox="0 0 ${WF} ${WF}">${segs}<circle class="zm" r="6"/></svg>
      <div class="wr-top"><i class="gps"></i><span class="q-time">32:08</span></div>
      <div class="wr-hr"><span class="hb">${ICON.heart}</span><b class="q-hr">160</b></div>
      <div class="wr-zone q-zone">VÙNG 4</div>
      <div class="wr-row"><div><b class="q-pace">5'12"</b><small>/km</small></div><div><b class="q-km">6,18</b><small>km</small></div></div>
      <div class="wr-brand">TapEasy</div>`;
  }
  if(k === "hyrox"){
    const segs = Array.from({ length: 16 }, (_, i) => { const a0 = -150 + i * 18.75 + 1.6, a1 = a0 + 15.5; return `<path d="${arcD(c, c, 108, a0, a1)}" class="hs ${i % 2 ? "st" : "rn"}"/>`; }).join("");
    return `<svg class="wz" viewBox="0 0 ${WF} ${WF}">${segs}</svg>
      <div class="wh-top">HYROX · <span class="q-total">38:02</span></div>
      <div class="wh-lab q-lab">TRẠM 4/8</div><div class="wh-name q-name">BURPEE<br>BROAD JUMP</div>
      <b class="wh-time q-st">02:31</b><div class="wh-sub q-sub">80 m</div>`;
  }
  if(k === "rest"){
    const C0 = (2 * Math.PI * 96).toFixed(2);
    return `<svg class="wz" viewBox="0 0 ${WF} ${WF}"><circle cx="${c}" cy="${c}" r="96" class="rbg"/><circle cx="${c}" cy="${c}" r="96" class="rfg" stroke-dasharray="${C0}" transform="rotate(-90 ${c} ${c})"/></svg>
      <div class="wt-lab">NGHỈ</div><b class="wt-time q-rest">0:24</b><div class="wt-next">Tiếp: hiệp 3<br>62,5 kg × 6</div>`;
  }
  if(k === "health"){
    return `<svg class="wz" viewBox="0 0 ${WF} ${WF}"><path d="${arcD(c, c, 108, -120, 120)}" class="hb0"/><path d="${arcD(c, c, 108, -120, 120)}" class="hb1" pathLength="1"/></svg>
      <div class="wk-top"><span class="sp">${ICON.sync}</span><span class="q-sy">Đồng bộ</span></div>
      <div class="wk-vals">${[["64", "bpm · nghỉ"], ["62", "ms · HRV"], ["97", "% SpO₂"], ["7:24", "giờ ngủ"]].map(([v, l]) => `<div class="wk-v"><b>${v}</b><small>${l}</small></div>`).join("")}</div>
      <div class="wk-alert">${ICON.warn}<b>NHỊP TIM CAO</b><span>186 bpm</span></div>`;
  }
  return `<div class="wd-ok">${ICON.check}</div><div class="wd-lab">HOÀN THÀNH</div><b class="wd-km">10,02 km</b><div class="wd-sub">52:40 · 148 bpm</div>
    <div class="wd-send">${ICON.sync} Đã gửi tới TapEasy</div>`;
}
function watchAt(ch, t){ let k = 0; (ch.watch || []).forEach((w, i) => { if(w[0] <= t) k = i; }); return k; }
function renderWatchScreen(n, key, lt, t){
  const S = n.wScr[key], q = s => S.querySelector(s);
  if(key === "run"){
    const hr = hrAt(t), z = zoneOf(hr);
    q(".q-hr").textContent = String(hr); q(".q-time").textContent = mmss(1928 + lt); q(".q-km").textContent = vnum(6.18 + lt / 312, 2);
    const zEl = q(".q-zone"); zEl.textContent = "VÙNG " + (z + 1); zEl.style.color = ZC[z];
    const beat = (t * hr / 60) % 1; q(".hb").style.transform = `scale(${(1 + .22 * Math.exp(-beat * 9)).toFixed(4)})`;
    const dr = outCubic((lt - .15) / .9);
    S.querySelectorAll(".zs").forEach((p, i) => { p.style.opacity = (i === z ? 1 : .32).toFixed(2); p.style.strokeWidth = i === z ? "11" : "7"; p.style.strokeDasharray = "200"; p.style.strokeDashoffset = (200 * (1 - clamp(dr * 5 - i))).toFixed(1); });
    const f = clamp((hr / HRMAX - .5) / .5), a = -135 + f * 270, m = q(".zm");
    m.setAttribute("cx", (WF / 2 + 108 * Math.sin(a * Math.PI / 180)).toFixed(2)); m.setAttribute("cy", (WF / 2 - 108 * Math.cos(a * Math.PI / 180)).toFixed(2)); m.style.opacity = dr.toFixed(3);
  } else if(key === "hyrox"){
    const S2 = hyState(lt);
    q(".q-total").textContent = mmss(S2.total); q(".q-st").textContent = mmss(S2.st);
    if(S2.cur === 7){ q(".q-lab").textContent = "TRẠM 4/8"; q(".q-name").innerHTML = "BURPEE<br>BROAD JUMP"; q(".q-sub").textContent = "80 m"; }
    else { q(".q-lab").textContent = "CHẠY 5/8"; q(".q-name").innerHTML = "1 KM<br>SAU ROXZONE"; q(".q-sub").textContent = "pace 4'48\"/km"; }
    S.querySelectorAll(".hs").forEach((p, i) => { p.classList.toggle("done", i < S2.cur); p.style.opacity = i === S2.cur ? (.55 + .45 * Math.abs(Math.sin(t * 4))).toFixed(3) : ""; });
  } else if(key === "rest"){
    const rem = 24.4 - lt, C0 = 2 * Math.PI * 96;
    q(".rfg").setAttribute("stroke-dashoffset", (C0 * (1 - clamp(rem / 60))).toFixed(2)); q(".q-rest").textContent = "0:" + String(Math.max(0, Math.ceil(rem))).padStart(2, "0");
  } else if(key === "health"){
    const sy = clamp((lt - .1) / 1.8);
    q(".sp").style.transform = `rotate(${(sy < 1 ? lt * 300 : 0).toFixed(1)}deg)`; q(".q-sy").textContent = sy < 1 ? "Đang đo…" : "Đã đồng bộ";
    const hb = q(".hb1"); hb.style.strokeDasharray = "1"; hb.style.strokeDashoffset = (1 - sy).toFixed(4);
    const per = 2.0, k = Math.floor(Math.max(0, lt - .3) / per) % 4;
    S.querySelectorAll(".wk-v").forEach((v, i) => { const u = (Math.max(0, lt - .3) % per) / per; const on = i === k; v.style.opacity = on ? (clamp(u / .12) * clamp((1 - u) / .12)).toFixed(3) : "0"; v.style.transform = on ? `translate3d(0,${px(10 * (1 - outCubic(u / .15)))},0)` : ""; });
    const al = clamp((lt - 5.0) / .2) * clamp((7.6 - lt) / .2), alr = q(".wk-alert");
    alr.style.opacity = al.toFixed(3); alr.style.transform = `scale(${(.9 + .1 * outCubic(al)).toFixed(4)})`;
  } else {
    const a = sp(lt - .1, "play"); q(".wd-ok").style.transform = `scale(${clamp(a, 0, 1.4).toFixed(4)})`;
  }
}
function renderSoon(n, t, kn){
  const ch = n.ch, lt = t - ch.t0, Ld = n.L, wl = Ld.watch, w = n.watch;
  // đồng hồ vào: trượt từ phải + xoay nhẹ (lò xo camera), trôi nhẹ khi đứng
  const e = sp(lt - .45, "cam"), k = wl.h / WH;
  const x = wl.cx + (1 - e) * W * .3, y = wl.cy + H * .004 * Math.sin(2 * Math.PI * t / 4.7);
  const rot = lerp(14, -4, e) + .8 * Math.sin(2 * Math.PI * t / 6.3);
  w.style.transform = `translate3d(${px(x - WW / 2)},${px(y - WH / 2)},0) rotate(${rot.toFixed(3)}deg) scale(${k.toFixed(5)})`;
  w.style.opacity = clamp((lt - .45) / .25).toFixed(3);
  // chip "Sắp ra mắt" trên đồng hồ
  const cq = sp(lt - .9, "ui");
  Object.assign(n.soonChip.style, { left: px(wl.cx), top: px(wl.cy - wl.h / 2 - (V ? H * .045 : H * .075)), fontSize: px(V ? W * .03 : H * .03),
    opacity: clamp((lt - .9) / .2).toFixed(3), transform: `translate(-50%,0) scale(${(.85 + .15 * cq).toFixed(4)})` });
  // màn đồng hồ: trượt ngang khi đổi
  const ws = ch.watch, wi = watchAt(ch, t), keys = Object.keys(n.wScr);
  keys.forEach(kk => n.wScr[kk].style.display = "none");
  const cur = ws[wi], prev = wi > 0 ? ws[wi - 1] : null, p = (t - cur[0]) / .38;
  const show = (key, xoff, op, ltk) => { const S = n.wScr[key]; S.style.display = ""; S.style.transform = xoff ? `translate3d(${px(xoff)},0,0)` : ""; S.style.opacity = op.toFixed(3); renderWatchScreen(n, key, ltk, t); };
  if(prev && p < 1){ const q = outExpo(p); show(prev[1], -WF * .6 * q, 1 - q, t - prev[0]); show(cur[1], WF * .6 * (1 - q), q, t - cur[0]); }
  else show(cur[1], 0, 1, t - cur[0]);
  // rung khi hết giờ nghỉ / cảnh báo: rung nhẹ đồng hồ
  const buzz = (cur[1] === "health" && t - cur[0] > 5.0 && t - cur[0] < 5.6) ? Math.sin(t * 160) * 2.2 * Math.exp(-(t - cur[0] - 5.0) * 4) : 0;
  if(buzz) w.style.transform += ` translate3d(${px(buzz)},0,0)`;
  // dữ liệu bay từ đồng hồ → điện thoại
  const wf = { x: wl.cx + 0, y: wl.cy }, ph = screenToStage(n, 195, 330);
  let anyR = false;
  n.flyDots.forEach(d => d.style.opacity = "0");
  (ch.sync || []).forEach(ts => {
    const u0 = t - ts; if(u0 < -.05 || u0 > 1.4) return;
    n.flyDots.forEach((d, i) => {
      const u = clamp((u0 - i * .055) / .62); if(u <= 0 || u >= 1) return;
      const q = inOut(u), mx = (wf.x + ph.x) / 2, my = Math.min(wf.y, ph.y) - H * (V ? .10 : .18) - i * 6;
      const bx = (1 - q) * (1 - q) * wf.x + 2 * (1 - q) * q * mx + q * q * ph.x, by = (1 - q) * (1 - q) * wf.y + 2 * (1 - q) * q * my + q * q * ph.y;
      const sz = (V ? W : H) * (d.classList.contains("hrt") ? .03 : .016);
      Object.assign(d.style, { opacity: (Math.sin(Math.PI * u) * 1.2).toFixed(3), width: px(sz), height: px(sz), transform: `translate3d(${px(bx - sz / 2)},${px(by - sz / 2)},0)` });
    });
    const r = (u0 - .62 - 7 * .055) / .45;
    if(r > 0 && r < 1){ anyR = true; const R = (V ? W : H) * (.03 + .09 * outCubic(r)); Object.assign(n.landRing.style, { opacity: ((1 - r) * .9).toFixed(3), width: px(R * 2), height: px(R * 2), transform: `translate3d(${px(ph.x - R)},${px(ph.y - R)},0)` }); }
  });
  if(!anyR) n.landRing.style.opacity = "0";
}

/* ---------- QA chữ: phụ đề không mồ côi / không dấu đầu dòng; chữ không đè nhau; không sát mép ---------- */
function capCheck(){
  const bad = [], rows = [];
  NODES.forEach(n => {
    if(!n.caps.length) return;
    stage.appendChild(n.root);
    n.caps.forEach(o => {
      const c = o.c.cloneNode(true); c.style.opacity = "1"; c.style.transform = ""; c.style.filter = ""; c.style.visibility = "hidden";
      // tách theo khoảng trắng THƯỜNG (nbsp giữ nguyên = cụm không ngắt)
      const dot = c.querySelector(".dot"); const text = c.textContent;
      c.innerHTML = ""; if(dot) c.appendChild(dot);
      text.split(" ").forEach((tok, i) => { if(i) c.appendChild(document.createTextNode(" ")); el("span", "tok", c).textContent = tok; });
      o.c.parentNode.appendChild(c);
      const toks = Array.from(c.querySelectorAll(".tok")); const lines = [];
      toks.forEach(s => { const y = Math.round(s.offsetTop); let L0 = lines.find(l => Math.abs(l.y - y) < 4); if(!L0){ L0 = { y, t: [] }; lines.push(L0); } L0.t.push(s.textContent); });
      const over = c.scrollWidth > parseFloat(o.c.style.width) + 1;
      const issues = [];
      if(lines.length > 1){ const last = lines[lines.length - 1].t; if(last.length === 1 && !/ /.test(last[0])) issues.push("mồ côi: “" + last[0] + "”"); }
      lines.forEach((l, i) => { if(i && /^[·—–:,;.]/.test(l.t[0])) issues.push("dấu đầu dòng: " + l.t[0]); });
      if(lines.length > 2) issues.push(lines.length + " dòng");
      if(over) issues.push("tràn ngang");
      const txt = lines.map(l => l.t.join(" ").replace(/ /g, " ")).join(" ⏎ ");
      rows.push((issues.length ? "LỖI " : "ok   ") + n.ch.id + ": " + txt + (issues.length ? "  ← " + issues.join(", ") : ""));
      if(issues.length) bad.push(n.ch.id + ": " + issues.join(", "));
      c.remove();
    });
    stage.removeChild(n.root);
  });
  return { bad, rows };
}
function textQA(){
  const sr = stage.getBoundingClientRect(), f = W / sr.width, issues = [];
  const R = e => { const r = e.getBoundingClientRect(); return { x: (r.left - sr.left) * f, y: (r.top - sr.top) * f, w: r.width * f, h: r.height * f }; };
  const opa = e => { let o = 1; for(let x = e; x && x !== stage; x = x.parentElement){ const v = parseFloat(x.style.opacity); if(!isNaN(v)) o *= v; if(x.style.display === "none") return 0; } return o; };
  mounted.forEach(n => {
    const items = [];
    const add = (e, name) => { if(e && e.isConnected && opa(e) > .5){ const r = R(e); if(r.w > 2 && r.h > 2) items.push({ name, r }); } };
    add(n.kick, "kicker"); add(n.title, "tiêu đề"); n.caps.forEach((o, i) => add(o.c, "phụ đề " + (i + 1))); add(n.stat, "thẻ số"); add(n.chip, "chip theme"); add(n.soonChip, "chip sắp ra mắt");
    if(n.cta) add(n.cta, "CTA"); if(n.qrCap) add(n.qrCap, "chú thích QR"); if(n.slogan) add(n.slogan, "khẩu hiệu");
    for(let i = 0; i < items.length; i++) for(let j = i + 1; j < items.length; j++){
      const a = items[i].r, b = items[j].r;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if(ox > 2 && oy > 2) issues.push(`${n.ch.id}: ${items[i].name} đè ${items[j].name} (${ox.toFixed(0)}×${oy.toFixed(0)} px)`);
    }
    items.forEach(it => { const r = it.r, m = Math.min(r.x, r.y, W - r.x - r.w, H - r.y - r.h); if(m < 12 && it.name !== "tiêu đề") issues.push(`${n.ch.id}: ${it.name} sát mép (${m.toFixed(0)} px)`); });
  });
  return issues;
}

const NODES = C.map((ch, ci) => {
  const n = { ci, ch, L: L(ci) };
  const root = n.root = el("div", "slot");
  // nền
  const bg = n.bg = el("div", "bg", root);
  el("div", "base", bg);
  if(ch.bg === "clip" && MAN.clip){ n.clip = img(BUILD + MAN.clip.pattern.replace("%04d", "0001"), "clipf", bg); }
  else if(ch.bg && MAN.bg && MAN.bg[ch.bg]){ n.photo = img(BUILD + MAN.bg[ch.bg], "photo", bg); el("div", "teal", bg); }
  n.flood = el("div", "abs", bg); n.flood.style.width = "100%"; n.flood.style.height = "100%";
  el("div", "grid", bg).style.backgroundSize = `${Math.round(W/12)}px ${Math.round(W/12)}px`;
  n.blob1 = el("div", "blob", bg); n.blob2 = el("div", "blob", bg);
  n.blob1.style.cssText += `width:${W*0.7}px;height:${W*0.7}px;background:#1fb39a;`;
  n.blob2.style.cssText += `width:${W*0.55}px;height:${W*0.55}px;background:#ff7a45;opacity:.16;`;
  el("div", "tint", bg);
  if(ch.num){ n.ghost = el("div", "ghost", bg, ch.num); n.ghost.style.fontSize = (V ? W*0.9 : H*1.05) + "px"; }
  // tiền cảnh (điện thoại + chữ) — có thể co giãn riêng khi chuyển cảnh
  n.fg = el("div", "fg", root);
  n.P = buildPhone(n.fg);
  // chữ
  const tx = n.txt = el("div", "txt", n.fg);
  if(V){ el("div", "capbg", tx); }
  const Ld = n.L;
  if(ch.num){
    n.kick = el("div", "kicker" + (ch.kind === "soon" ? " soon" : ""), tx, `<span class="n">00</span><span class="bar"></span><span>${esc(ch.kicker || (ch.id === "themes" ? "Giao diện" : "Tính năng"))}</span>`);
    n.kick.style.fontSize = px(Ld.kickSize); n.kick.style.left = px(Ld.tx); n.kick.style.top = px(Ld.kickY);
    n.kickN = n.kick.querySelector(".n"); n.kickBar = n.kick.querySelector(".bar");
  }
  if(ch.kind !== "intro"){
    n.title = el("div", "title", tx, splitTitle(ch.title || [], ch.accent, ch.style || "rise"));
    n.title.style.left = px(Ld.tx); n.title.style.top = px(Ld.titleY); n.title.style.fontSize = px(Ld.titleSize);
    if(ch.kind === "outro"){ const O = outroLayout(); n.L.tw = O.titleW; n.title.style.fontSize = px(O.titleSize); }
  }
  n.caps = (ch.captions || []).map(([t, s]) => { const c = el("div", "cap", tx, `<span class="dot"></span>${escT(s)}`); c.style.left = px(Ld.tx); c.style.top = px(Ld.capY); c.style.width = px(Ld.capW); c.style.fontSize = px(Ld.capSize); return { t, c }; });
  if(ch.stat){ n.stat = el("div", "stat", tx, `<div class="v">0</div><div class="l">${esc(ch.stat.label)}</div>`); n.stat.style.fontSize = px(Ld.statSize * 0.42); n.statV = n.stat.querySelector(".v"); n.statV.style.fontSize = px(Ld.statSize); }
  if(ch.kind === "themes"){ n.chip = el("div", "chip", tx); n.chip.style.fontSize = px(V ? W*0.03 : H*0.03); }
  // phần riêng
  if(ch.kind === "intro") buildIntro(n);
  if(ch.kind === "outro") buildOutro(n);
  if(ch.kind === "soon") buildSoon(n);
  n.shotNodes = {};
  return n;
});

/* chữ tiêu đề: tự thu nhỏ cho vừa bề ngang */
function fitTitles(){
  NODES.forEach(n => {
    if(!n.title) return;
    stage.appendChild(n.root);
    let fs = parseFloat(n.title.style.fontSize);
    for(let k = 0; k < 30; k++){
      const w = Math.max(...Array.from(n.title.querySelectorAll(".ln")).map(l => l.scrollWidth));
      if(w <= n.L.tw) break;
      fs *= 0.95; n.title.style.fontSize = px(fs);
    }
    n.titleSize = fs;
    // phụ đề nằm dưới tiêu đề (ngang)
    const th = n.title.getBoundingClientRect().height;
    if(!V){ const y = Math.max(n.L.capY, n.L.titleY + th + H*0.05); n.caps.forEach(o => o.c.style.top = px(y)); n.capTop = y; }
    stage.removeChild(n.root);
  });
}

/* ---------------- shot trong điện thoại ---------------- */
function shotNode(n, key, id){
  if(n.shotNodes[key]) return n.shotNodes[key];
  const d = shotData(id);
  const s = { id, d, root: el("div", "shotl") };
  if(/^mock:/.test(id)){ s.mock = buildMock(id.slice(5), s.root); n.shotNodes[key] = s; return s; }
  if(d){
    s.base = img(BUILD + d.base, "base", s.root);
    if(d.strips && d.strips.length && !d.noStrips){
      const sc = d.scroller;
      s.clip = el("div", "clip", s.root);
      Object.assign(s.clip.style, { left: px(sc.x), top: px(sc.y), width: px(sc.w), height: px(sc.h) });
      s.strips = el("div", "strips", s.clip);
      d.strips.forEach(st => { const i = img(BUILD + st.src, "", s.strips); i.style.left = "0px"; i.style.top = px(st.y); i.style.width = px(sc.w); i.style.height = px(sc.h); });
      /* lớp phủ tràn viền (vùng cuộn bắt đầu trong dải trạng thái): dải cuộn bị cắt từ SAFE.top; khi cuộn, nền thanh trạng thái
         (màu nền app lúc chụp) hiện dần để nội dung không bao giờ đè 9:41 / dynamic island — như thanh trạng thái iOS */
      if(d.bandColor){ s.band = el("div", "band", s.root); Object.assign(s.band.style, { left: "0px", top: "0px", width: "390px", height: px(Math.min(SAFE.top, sc.y)), background: d.bandColor, opacity: "0" }); }
    }
    /* chuỗi khung (seq): ảnh toàn màn đổi theo t, phủ trên base/dải cuộn trong cửa sổ shot.seq */
    if(d.seq && d.seq.count){ s.seqImg = img(BUILD + d.seq.pattern.replace("%03d", "000"), "seqf", s.root); s.seqImg.style.display = "none"; s.seqK = 0; }
  } else {
    el("div", "ph", s.root, `<div style="font-size:15px;opacity:.6;font-family:JetBrains Mono">SHOT</div><div>${esc(id)}</div><div style="font-size:13px;opacity:.55">chưa chụp — chạy capture_app.py</div>`);
  }
  n.shotNodes[key] = s;
  return s;
}
function scrollAt(shot, t){
  const d0 = shotData(shot.id);
  let y = shot.from_capture && d0 ? (d0.scrollTop || 0) : 0;
  for(const [a, b, to] of shot.scroll){ if(t <= a) break; y = t >= b ? to : lerp(y, to, inOut((t - a) / (b - a))); }
  const d = shotData(shot.id);
  if(d){
    if(!d.strips || !d.strips.length || d.noStrips) return d.scrollTop || 0;      // ảnh tĩnh: giữ đúng độ cuộn lúc chụp
    const cover = Math.max(...d.strips.map(s => s.y)); y = Math.min(y, d.scrollMax || 0, cover);
  }
  return Math.max(0, y);
}
/* khung của chuỗi seq tại t: trước cửa sổ → ẩn (base), trong → khung floor((t−t0)·fps), sau → giữ khung cuối */
function setSeq(s, shot, t){
  const q = s.d.seq, w = shot.seq || { t0: shot.t0, t1: shot.t1 };
  if(t < w.t0){ s.seqImg.style.display = "none"; return; }
  const k = clamp(Math.floor((t - w.t0) * q.fps + 1e-6), 0, q.count - 1);
  s.seqImg.style.display = "";
  if(k !== s.seqK || !s.seqImg.getAttribute("src")){ s.seqK = k; s.seqImg.src = RES(BUILD + q.pattern.replace("%03d", String(k).padStart(3, "0"))); pending.add(s.seqImg); }
}
/* điểm chạm → toạ độ màn hình (390×844) */
function tapPoint(shot, target, t){
  if(Array.isArray(target)) return { x: target[0], y: target[1] };
  const d = shotData(shot.id); const tg = d && d.targets && d.targets[target];
  if(!tg) return { x: 195, y: 640 };
  let y = tg.y + tg.h / 2;
  if(tg.doc) y = d.scroller.y + tg.y - scrollAt(shot, t) + tg.h / 2;
  return { x: tg.x + tg.w / 2, y: clamp(y, 60, 820) };
}
function rectFor(shot, r, t){
  if(Array.isArray(r)) return { x: r[0], y: r[1], w: r[2], h: r[3] };
  const d = shotData(shot.id); const tg = d && d.targets && d.targets[r];
  if(!tg) return { x: 20, y: 300, w: 350, h: 260 };
  const y = tg.doc ? d.scroller.y + tg.y - scrollAt(shot, t) : tg.y;
  return { x: tg.x, y, w: tg.w, h: tg.h };
}
const ENTER_DUR = { push:.45, sheet:.42, fade:.3, theme:.36, cut:0 };
const FLOOD_PTS = [[330,120],[60,760],[195,420],[350,700],[40,200],[300,520],[120,640],[260,90]];

function renderScreen(n, t){
  const ch = n.ch, P = n.P, shots = ch.shots;
  let k = 0; for(let i = 0; i < shots.length; i++) if(shots[i].t0 <= t) k = i;
  const cur = shots[k];
  const want = [];
  const enter = cur.enter, dur = ENTER_DUR[enter] || 0;
  const p = dur ? (t - cur.t0) / dur : 1;
  let prev = null, prevKey = null;
  if(p < 1 && p >= 0){
    if(k > 0){ prev = shots[k-1]; prevKey = ch.i + ":" + (k-1); }
    else if(ch.carry && ch.i > 0){ const pc = C[ch.i-1]; prev = pc.shots[pc.shots.length-1]; prevKey = "carry:" + ch.i; }
  }
  const curNode = shotNode(n, ch.i + ":" + k, cur.id);
  const prevNode = prev ? shotNode(n, prevKey, prev.id) : null;
  if(prevNode) want.push(prevNode);
  want.push(curNode);
  // gắn đúng các lớp
  P.mounted.forEach(s => { if(!want.includes(s)) s.root.remove(); });
  want.forEach(s => { if(s.root.parentNode !== P.layers) { P.layers.appendChild(s.root); s.root.querySelectorAll("img").forEach(i => pending.add(i)); } else P.layers.appendChild(s.root); });
  P.mounted = want;
  // cuộn
  const setScroll = (s, shot) => { if(s.strips){ const y = scrollAt(shot, t); s.strips.style.transform = `translate3d(0,${px(-y)},0)`; if(s.band) s.band.style.opacity = clamp(y / 60).toFixed(3); } };
  setScroll(curNode, cur); if(prevNode) setScroll(prevNode, prev);
  [[curNode, cur], [prevNode, prev]].forEach(([s, shot]) => { if(!s) return; if(s.seqImg) setSeq(s, shot, t); if(s.mock) s.mock.render(t - shot.t0, t, shot); });
  // chuyển màn trong điện thoại
  curNode.root.style.cssText = ""; if(prevNode) prevNode.root.style.cssText = "";
  if(prevNode){
    const e = outExpo(p);
    if(enter === "push"){ curNode.root.style.transform = `translate3d(${px(390*(1-e))},0,0)`; curNode.root.style.boxShadow = "-20px 0 40px rgba(0,0,0,.35)"; prevNode.root.style.transform = `translate3d(${px(-110*e)},0,0)`; prevNode.root.style.filter = `brightness(${1 - .35*e})`; }
    else if(enter === "sheet"){ curNode.root.style.transform = `translate3d(0,${px(844*0.42*(1-e))},0)`; curNode.root.style.opacity = clamp(p*3.5); }
    else if(enter === "fade"){ curNode.root.style.opacity = inOut(p); }
    else if(enter === "theme"){ const [fx, fy] = FLOOD_PTS[k % FLOOD_PTS.length]; const r = Math.hypot(Math.max(fx, 390-fx), Math.max(fy, 844-fy)) * 1.05 * outCubic(p); curNode.root.style.clipPath = `circle(${px(r)} at ${fx}px ${fy}px)`; }
  }
  // thanh trạng thái theo độ sáng màn
  const d = shotData(enter !== "cut" && prev && p < .5 ? prev.id : cur.id);
  const col = d && d.light ? "#111" : "#fff";
  if(P.statusCol !== col){ P.statusBox.innerHTML = STATUS_SVG(col); P.statusCol = col; P.homebar.style.background = d && d.light ? "rgba(0,0,0,.82)" : "rgba(255,255,255,.88)"; }
  // ngón tay
  renderTouch(n, t, k);
  return { cur, k, scroll: scrollAt(cur, t) };
}

function renderTouch(n, t, k){
  const P = n.P, shots = n.ch.shots;
  let best = null;
  for(let i = Math.max(0, k-1); i <= Math.min(shots.length-1, k+1); i++){
    for(const [tc, tg] of shots[i].taps){ if(t >= tc - .34 && t <= tc + .42){ best = { tc, tg, shot: shots[i] }; } }
  }
  const T = P.touch, R = P.ripple, G = P.glow;
  if(best){
    const pt = tapPoint(best.shot, best.tg, best.tc);
    const a = clamp((t - (best.tc - .34)) / .2), out = clamp((t - (best.tc + .14)) / .26);
    const ease = outCubic(a);
    let sc = lerp(1.3, 1, ease) * (1 - .16 * Math.exp(-Math.pow((t - best.tc) / .045, 2)));
    const ox = 22 * (1 - ease), oy = 34 * (1 - ease);
    T.style.opacity = (ease * (1 - out)).toFixed(3);
    T.style.transform = `translate3d(${px(pt.x + ox)},${px(pt.y + oy)},0) scale(${sc.toFixed(4)})`;
    const rp = clamp((t - best.tc) / .4);
    const show = t >= best.tc;
    R.style.opacity = show ? ((1 - rp) * .8).toFixed(3) : "0";
    const rr = 10 + 46 * outCubic(rp);
    R.style.width = R.style.height = px(rr*2); R.style.transform = `translate3d(${px(pt.x - rr)},${px(pt.y - rr)},0)`;
    const gp = clamp((t - (best.tc - .1)) / .5); G.style.opacity = (Math.sin(Math.PI * gp) * .9).toFixed(3);
    G.style.width = G.style.height = "120px"; G.style.transform = `translate3d(${px(pt.x - 60)},${px(pt.y - 60)},0)`;
    return;
  }
  // ngón tay kéo khi cuộn dài (shot "drag": false → không vẽ, vd màn chào: chấm trắng trôi qua bản đồ trông như lỗi)
  const cur = shots[k];
  for(const [a, b, to] of (cur.drag === false ? [] : cur.scroll)){
    if(t >= a - .18 && t <= b + .12){
      const from = (() => { let y = 0; for(const s of cur.scroll){ if(s[0] >= a) break; y = s[2]; } return y; })();
      if(Math.abs(to - from) < 150) break;
      const q = inOut((t - a) / (b - a)), dir = to > from ? 1 : -1;
      const y = dir > 0 ? lerp(640, 300, q) : lerp(300, 640, q);
      const op = clamp((t - (a - .18)) / .15) * clamp(((b + .12) - t) / .15);
      T.style.opacity = (op * .85).toFixed(3); T.style.transform = `translate3d(318px,${px(y)},0) scale(.92)`;
      R.style.opacity = "0"; G.style.opacity = "0";
      return;
    }
  }
  T.style.opacity = "0"; R.style.opacity = "0"; G.style.opacity = "0";
}

/* ---------------- tư thế điện thoại ---------------- */
function basePose(ci){
  const Ld = NODES[ci].L;
  const k = Ld.phoneH / PH_H;
  return { x: Ld.cx, y: Ld.cy, k, ry: 1.3 * Ld.tilt, rx: .5 };
}
function pose(ci, t, depth){
  const ch = C[ci], b = basePose(ci);
  const enterT = ch.kind === "intro" ? ch.phone_in : ch.t0;
  const s = sp(t - enterT - .02, "cam");
  let P = { x: b.x, y: b.y, k: b.k, ry: lerp(7 * NODES[ci].L.tilt, b.ry, s), rx: lerp(2, b.rx, s) + 9 * (1 - s), o: 1 };
  if(ch.carry && ci > 0 && !depth){
    const a = pose(ci - 1, ch.t0, 1);
    P = { x: lerp(a.x, P.x, s), y: lerp(a.y, P.y, s), k: lerp(a.k, P.k, s), ry: lerp(a.ry, b.ry, s), rx: lerp(a.rx, b.rx, s), o: 1 };
  } else if(ch.kind === "intro"){
    P.y += (1 - s) * H * 0.36; P.o = clamp(s * 2.5);
  }
  if(ch.kind === "intro" && t < enterT){ P.o = 0; }
  // trôi nhẹ (tuyến tính / sin, không phải phím)
  P.y += H * 0.0035 * Math.sin(2 * Math.PI * t / 5.3);
  P.ry += 0.7 * Math.sin(2 * Math.PI * t / 7.1);
  // chương kết: điện thoại lùi xuống + mờ đi, nhường toàn khung cho thẻ QR cộng đồng
  if(ch.kind === "outro" && ch.cta_at){
    const e = inOut((t - ch.cta_at + .35) / .7);
    P.k *= 1 - .14 * e; P.y += H * .10 * e; P.o *= 1 - e;
  }
  return P;
}
function focusOf(n, t, scroll){
  for(const s of n.ch.shots) for(const [a, b, r, sc] of s.focus){
    if(t < a || t > b + .5) continue;
    const f = t <= b ? inOut((t - a) / .6) : 1 - inOut((t - b) / .5);
    const R = rectFor(s, r, t);
    return { f, sc: V ? Math.pow(sc, .85) : sc, cx: R.x + R.w / 2, cy: R.y + R.h / 2 };
  }
  return null;
}
function applyPose(n, t, extra){
  const P = pose(n.ch.i, t), Pp = n.P;
  extra = extra || {};
  let k = P.k * (extra.s || 1), x = P.x + (extra.x || 0), y = P.y + (extra.y || 0);
  const fo = focusOf(n, t);
  n.focusF = fo ? fo.f : 0;
  if(fo && fo.f > 0){
    const z = logLerp(1, fo.sc, fo.f);
    const dx = (SCR_X + fo.cx - PH_W / 2) * P.k, dy = (SCR_Y + fo.cy - PH_H / 2) * P.k;
    // điểm được soi trôi dần về gần trung tâm khung
    const tx = V ? W / 2 : P.x, ty = V ? H * .52 : H / 2;
    x += (tx - (P.x + dx * z)) * fo.f * .55 + dx * (1 - z) * (1 - fo.f * .55);
    y += (ty - (P.y + dy * z)) * fo.f * .55 + dy * (1 - z) * (1 - fo.f * .55);
    k *= z;
  }
  Pp.rig.style.transform = `translate3d(${px(x - PH_W/2)},${px(y - PH_H/2)},0) scale(${k.toFixed(5)})`;
  Pp.tilt.style.transform = `rotateY(${(P.ry + (extra.ry || 0)).toFixed(3)}deg) rotateX(${(P.rx + (extra.rx || 0)).toFixed(3)}deg)`;
  Pp.cam.style.opacity = (P.o * (extra.o == null ? 1 : extra.o)).toFixed(3);
  n.phoneAt = { x, y, k };
  return { x, y, k, fo };
}
/* điểm trong màn (390×844) → toạ độ khung */
function screenToStage(n, sx, sy){ const a = n.phoneAt || { x: W/2, y: H/2, k: 1 }; return { x: a.x + (SCR_X + sx - PH_W/2) * a.k, y: a.y + (SCR_Y + sy - PH_H/2) * a.k }; }

/* ---------------- chữ động ---------------- */
function renderText(n, t, kn){
  const ch = n.ch, lt = t - ch.t0;
  const tstart = ch.kind === "outro" ? (ch.cta_at - ch.t0) : 0;
  const tl = lt - tstart;
  if(n.kick){
    const a = clamp((lt - .1) / .45);
    const num = parseInt(ch.num, 10) || 0;
    n.kickN.textContent = String(Math.round(num * outExpo(a))).padStart(2, "0");
    n.kick.style.opacity = clamp((lt - .05) / .25).toFixed(3);
    n.kickBar.style.width = px(n.L.kickSize * 3.2 * outExpo((lt - .15) / .6));
  }
  if(n.title){
    const st = ch.style || "rise";
    if(ch.kind === "outro" && lt < tstart){ n.title.style.opacity = "0"; }
    else n.title.style.opacity = "1";
    if(st === "rise"){
      n.title.querySelectorAll(".w").forEach((w, i) => { const s = sp(tl - .25 - i * .075, "type"); w.style.transform = `translate3d(0,${(110 * (1 - s)).toFixed(2)}%,0)`; });
    } else if(st === "chars"){
      n.title.querySelectorAll(".c").forEach((c, i) => { const s = sp(tl - .25 - i * .022, "ui"); c.style.opacity = clamp(s * 1.4).toFixed(3); c.style.transform = `translate3d(0,${(0.5 * (1 - s)).toFixed(3)}em,0)`; c.style.filter = s > .98 ? "" : `blur(${(8 * (1 - clamp(s))).toFixed(2)}px)`; });
    } else {
      n.title.querySelectorAll(".ln").forEach((ln, i) => {
        const p = outExpo((tl - .3 - i * .14) / .75);
        const tx = ln.querySelector(".wtxt"), bar = ln.querySelector(".wipebar");
        tx.style.clipPath = `inset(-10% ${(100 * (1 - p)).toFixed(2)}% -20% 0)`;
        const w = ln.scrollWidth;
        bar.style.left = px(w * p); bar.style.opacity = (p > 0 && p < 1 ? 1 : 0).toString();
      });
    }
  }
  // phụ đề: cũ rời sớm 0,12 s, mới bật vào bằng lò xo (blur 10 px / y 16 px), không chồng
  const caps = n.caps;
  let vis = -1; for(let i = 0; i < caps.length; i++) if(t >= caps[i].t - .12) vis = i;
  const outro = ch.kind === "outro" && t >= ch.cta_at - .3;
  caps.forEach((o, i) => {
    if(i !== vis || outro){ o.c.style.opacity = "0"; return; }
    const nx = caps[i + 1];
    const leave = nx ? clamp((t - (nx.t - .12)) / .12) : 0;
    const s = sp(t - o.t, "cam");
    o.c.style.opacity = (clamp(s * 1.6) * (1 - leave)).toFixed(3);
    o.c.style.transform = `translate3d(0,${px(16 * (1 - s) - 8 * leave)},0)`;
    o.c.style.filter = s > .98 && !leave ? "" : `blur(${(10 * (1 - clamp(s)) + 6 * leave).toFixed(2)}px)`;
  });
  if(n.stat){
    const s = ch.stat, a = t - s.t;
    const q = sp(a, "ui");
    n.stat.style.opacity = (clamp(a / .2) * (s.until ? 1 - clamp((t - s.until) / .3) : 1)).toFixed(3);
    n.stat.style.transform = `translate3d(0,${px(20 * (1 - q))},0) scale(${(.9 + .1 * q).toFixed(4)})`;
    n.statV.textContent = Math.round(s.value * outExpo(a / 1.3)).toLocaleString("vi-VN") + (s.suffix || "");
    // vị trí: cạnh điện thoại
    const a2 = n.phoneAt || { x: W/2, y: H/2, k: 1 };
    if(V){ n.stat.style.left = px(n.L.statX); n.stat.style.top = px(n.L.statY); }
    else { n.stat.style.left = px(n.L.statX); n.stat.style.top = px(n.L.statY); }
  }
  // một tiêu điểm: khi soi cận màn hình (khung dọc), tiêu đề lùi lại (mờ + nhoè nhẹ), phụ đề giữ nguyên
  const df = V ? (n.focusF || 0) : 0;
  [n.kick, n.title].forEach(e => { if(!e) return; if(df > .01){ e.style.filter = `blur(${(2.6 * df).toFixed(2)}px)`; e.style.opacity = (parseFloat(e.style.opacity || 1) * (1 - .8 * df)).toFixed(3); } else e.style.filter = ""; });
  n.txt.style.opacity = (kn.textO == null ? 1 : kn.textO).toFixed(3);
  n.txt.style.transform = kn.textY ? `translate3d(0,${px(kn.textY)},0)` : "";
}

/* ---------------- nền ---------------- */
function renderBg(n, t, kn){
  const ch = n.ch, lt = t - ch.t0, dur = ch.t1 - ch.t0;
  // nhịp: đẩy nhẹ ở phách mạnh (mỗi ô nhịp), tắt dần theo hàm mũ
  const bar = TL.beat * 4; const since = ((t % bar) + bar) % bar;
  const punch = .012 * Math.exp(-since / .14);
  const drift = lt / dur;
  const sideK = n.L.side === "left" ? 1 : -1;
  n.bg.style.transform = `translate3d(${px(W * .015 * sideK * (drift - .5))},0,0) scale(${(1.02 + punch).toFixed(4)})`;
  if(n.photo){ n.photo.style.transform = `translate3d(${px(-W * .03 * (drift - .5))},${px(H * .01 * Math.sin(lt * .4))},0) scale(1.1)`; }
  if(n.clip && MAN.clip){
    const N = MAN.clip.count, fps = MAN.clip.fps || 30;
    const f = Math.floor(lt * fps * (MAN.clip.speed || 1)) % N;
    const src = RES(BUILD + MAN.clip.pattern.replace("%04d", String(f + 1).padStart(4, "0")));
    if(n.clip.getAttribute("src") !== src){ n.clip.src = src; pending.add(n.clip); }
    let dim = .7;
    if(ch.kind === "intro" && ch.phone_in) dim = lerp(.75, .32, inOut((t - ch.phone_in + .4) / 1.2));
    if(ch.kind === "outro") dim = .4;
    n.clip.style.filter = `grayscale(1) contrast(1.12) brightness(${dim.toFixed(3)})`;
    n.clip.style.transform = `scale(${(1.06 + .04 * drift).toFixed(4)})`;
  }
  n.blob1.style.transform = `translate3d(${px(W * (.45 + .1 * Math.sin(lt * .21)))},${px(H * (.1 + .05 * Math.cos(lt * .17)))},0)`;
  n.blob2.style.transform = `translate3d(${px(-W * .2 + W * .08 * Math.cos(lt * .19))},${px(H * (.62 + .04 * Math.sin(lt * .23)))},0)`;
  if(n.ghost){ n.ghost.style.transform = `translate3d(${px(V ? W * .25 - W * .05 * drift : (n.L.side === "right" ? W * .02 : W * .52) - W * .04 * drift)},${px(V ? H * .5 : H * .02)},0)`; }
  // chương giao diện: nền đổi màu theo theme bằng vòng tràn màu từ điện thoại
  if(ch.kind === "themes"){
    let k = 0; ch.shots.forEach((s, i) => { if(s.t0 <= t) k = i; });
    const cur = themeOf(ch.shots[k].id), prev = k > 0 ? themeOf(ch.shots[k-1].id) : null;
    const base = n.bg.querySelector(".base");
    const p = (t - ch.shots[k].t0) / .45;
    if(cur && prev && p < 1){
      base.style.background = mixBg(prev[1]);
      const [fx, fy] = FLOOD_PTS[k % FLOOD_PTS.length]; const o = screenToStage(n, fx, fy);
      const r = Math.hypot(Math.max(o.x, W - o.x), Math.max(o.y, H - o.y)) * 1.05 * outCubic(p);
      n.flood.style.background = mixBg(cur[1]); n.flood.style.clipPath = `circle(${px(r)} at ${px(o.x)} ${px(o.y)})`;
    } else { base.style.background = mixBg((cur || THEME.navy)[1]); n.flood.style.clipPath = "circle(0px at 0 0)"; }
    if(n.chip){
      const th = cur || THEME.navy; n.chip.textContent = th[0];
      n.chip.style.color = th[2]; n.chip.style.borderColor = th[2];
      const q = sp(t - ch.shots[k].t0, "ui");
      const pa = n.phoneAt || { x: W/2, y: H/2, k: 1 };
      let cx = V ? W / 2 : n.L.tx, cy = V ? pa.y - PH_H * pa.k / 2 - H * .035 : H * .885;
      // Ngang: thẻ số nằm ở H*.75 cao ~H*.15 → chip đặt CẠNH thẻ số (căn giữa dọc), không chồng lên (QA chữ v3)
      if(!V && n.stat){ cx = n.L.statX + n.stat.offsetWidth + W * .02; cy = n.L.statY + (n.stat.offsetHeight - n.chip.offsetHeight) / 2; }
      n.chip.style.left = px(cx); n.chip.style.top = px(cy);
      n.chip.style.transform = `translate(${V ? "-50%" : "0"},0) scale(${(.85 + .15 * q).toFixed(4)})`;
      n.chip.style.opacity = clamp((t - ch.shots[1].t0 + .2) / .2).toFixed(3);
    }
  }
  n.bg.style.opacity = (kn.bgO == null ? 1 : kn.bgO).toFixed(3);
}
function mixBg(hex){
  // nền khung = màu theme pha tối để chữ trắng luôn đọc được
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  const L = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
  const f = L > .5 ? .30 : 1;
  return `radial-gradient(120% 80% at 70% 20%, rgb(${r*f|0},${g*f|0},${b*f|0}) 0%, rgb(${r*f*.55|0},${g*f*.55|0},${b*f*.55|0}) 55%, #020507 100%)`;
}

/* ---------------- chương mở đầu ---------------- */
function buildIntro(n){
  const ch = n.ch;
  n.logo = el("div", "logo", n.txt); img(ROOT + "assets/brand/logo-wordmark-light.svg", "", n.logo);
  n.logoBar = el("div", "", n.txt); n.logoBar.style.cssText = "position:absolute;background:#5EE6C7;border-radius:3px;";
  n.slogan = el("div", "slogan", n.txt);
  n.sw = (ch.slogan || []).map(([s, tt], i) => { const w = el("span", "sw", n.slogan, esc(s)); if(i === 1) w.style.color = "var(--mint)"; return { w, t: tt }; });
  n.black = el("div", "black", n.root);
}
function renderIntro(n, t){
  const ch = n.ch, lt = t - ch.t0;
  n.black.style.opacity = (1 - outCubic(lt / .55)).toFixed(3);
  // logo: lộ bằng mặt nạ + vạch mint
  const lw = V ? W * .62 : W * .34, lh = lw * 180.6 / 770.2;
  const lp = outExpo((lt - .25) / .95);
  const lx = W / 2 - lw / 2, ly = (V ? H * .40 : H * .40) - lh / 2;
  const s0 = ch.slogan && ch.slogan[0] ? ch.slogan[0][1] : ch.t0 + 2;
  const up = inOut((t - s0 + .55) / .5);
  const logoY = lerp(ly, V ? H * .12 : H * .14, up), logoS = lerp(1, .55, up);
  const fadeL = 1 - clamp((t - (ch.phone_in - .35)) / .35);
  Object.assign(n.logo.style, { left: px(lx), top: px(logoY), width: px(lw), transformOrigin: "50% 0", transform: `scale(${logoS.toFixed(4)})`, clipPath: `inset(-5% ${(100 * (1 - lp)).toFixed(2)}% -5% 0)`, opacity: fadeL.toFixed(3) });
  Object.assign(n.logoBar.style, { left: px(lx + lw * lp - 4), top: px(ly - lh * .08), width: "8px", height: px(lh * 1.16), opacity: (lp > 0 && lp < .995 ? 1 : 0).toString() });
  // khẩu hiệu: đập theo phách
  const fs = V ? W * .19 : H * .2;
  n.slogan.style.fontSize = px(fs);
  const pin = sp(t - ch.phone_in + .25, "cam");
  const sx = V ? W / 2 : lerp(W / 2, W * .075, pin), sy = V ? lerp(H * .27, H * .035, pin) : lerp(H * .17, H * .17, pin);
  const sc = V ? lerp(1, .42, pin) : lerp(1, .55, pin);
  n.slogan.style.left = px(sx); n.slogan.style.top = px(sy);
  n.slogan.style.textAlign = V || pin < .5 ? "center" : "left";
  n.slogan.style.transformOrigin = V ? "50% 0" : (pin < .5 ? "50% 0" : "0 0");
  n.slogan.style.transform = `translate(${V || pin < .5 ? "-50%" : "0"},0) scale(${sc.toFixed(4)})`;
  let shake = 0;
  n.sw.forEach(o => {
    const a = t - o.t; const s = sp(a, "ui");
    o.w.style.opacity = clamp(a / .06).toFixed(3);
    o.w.style.transform = `scale(${lerp(1.38, 1, s).toFixed(4)})`;
    if(a >= 0) shake += Math.exp(-a / .09) * 7 * Math.sin(a * 90);
  });
  n.txt.style.transform = shake ? `translate3d(${px(shake)},${px(shake * .4)},0)` : "";
  // vệt sáng lướt trên kính điện thoại khi vừa vào
  sheen(n, t, ch.phone_in + .6);
}
function sheen(n, t, t0){
  const p = (t - t0) / 1.1;
  n.P.sheen.style.left = (p > 0 && p < 1) ? (lerp(-60, 140, inOut(p))).toFixed(2) + "%" : "-80%";
}

/* ---------------- chương kết ---------------- */
/* CTA: "Tham gia TapEasy Cộng Đồng để nhận bản tải miễn phí" + thẻ QR nhóm Zalo (assets/zalo-community-qr.jpg,
   prep.py cắt gọn thẻ trắng → build/qr-card.png). QR giữ YÊN từ cta_at+1,3 s tới hết phim, nằm trên lớp riêng
   phía trên hạt phim/vignette; không tắt đen ở cuối. KHÔNG hiện URL/tên miền nào. */
function outroLayout(){
  if(V){
    const lw = W * .40, lh = lw * 180.6 / 770.2, ly = H * .035;
    const cw = W * .72, ch = cw * QR_AR;
    return { lw, lh, lx: W / 2 - lw / 2, ly, titleX: W * .05, titleW: W * .90, titleSize: W * .078, align: "center",
      leadSize: W * .040, cw, ch, cx: W / 2, capSize: W * .042, capGap: H * .018, cardGap: H * .022 };
  }
  const ch = H * .84, cw = ch / QR_AR;
  const lw = W * .22, lh = lw * 180.6 / 770.2;
  return { lw, lh, lx: W * .06, ly: H * .22, titleX: W * .06, titleW: W * .44, titleSize: H * .085, align: "left",
    leadSize: H * .040, cw, ch, cx: W * .735, cy: H * .055, capSize: H * .034, capGap: H * .02 };
}
function buildOutro(n){
  const ch = n.ch, P = n.P;
  n.share = el("div", "share", P.over, `<div class="h"><img src="${RES(ROOT + "assets/icon-192.png")}" alt=""><div><b>TapEasy</b><small>Ứng dụng tập luyện · Tiếng Việt</small></div></div>
    <div class="row"><span>Sao chép</span><span class="ico"></span></div>
    <div class="row hl"><span><b>Thêm vào màn hình chính</b></span><span class="ico plus"></span></div>
    <div class="row"><span>Thêm dấu trang</span><span class="ico"></span></div>`);
  n.hs = el("div", "hs", P.over);
  const cols = 4, gx = 26, gw = 62, gap = (390 - 2 * gx - cols * gw) / (cols - 1);
  for(let r = 0; r < 5; r++) for(let c = 0; c < cols; c++){
    if(r === 2 && c === 1) continue;
    const ic = el("div", "ic", n.hs); ic.style.left = px(gx + c * (gw + gap)); ic.style.top = px(92 + r * 104);
    ic.style.background = `rgba(255,255,255,${(.08 + ((r * 7 + c * 3) % 5) * .025).toFixed(3)})`;
  }
  el("div", "dock", n.hs);
  n.appX = gx + 1 * (gw + gap); n.appY = 92 + 2 * 104;
  n.app = el("div", "app", n.hs, `<img src="${RES(ROOT + "assets/icon-192.png")}" alt="">`); n.app.style.left = px(n.appX); n.app.style.top = px(n.appY);
  n.appL = el("div", "lbl", n.hs, "TapEasy"); n.appL.style.left = px(n.appX - 9); n.appL.style.top = px(n.appY + 68);
  // CTA
  n.logo = el("div", "logo", n.txt); img(ROOT + "assets/brand/logo-wordmark-light.svg", "", n.logo);
  n.cta = el("div", "cta", n.txt, `<div class="lead">để nhận <b>bản tải miễn phí</b></div>`);
  n.qrL = el("div", "qrlayer", null);
  n.qrCard = el("div", "qrcard", n.qrL);
  n.qrImg = img(BUILD + ((TL.qr && TL.qr.src) || "qr-card.png"), "", n.qrCard);
  n.qrImg.onerror = () => { if(!/zalo-community-qr/.test(n.qrImg.src)) n.qrImg.src = RES("assets/zalo-community-qr.jpg"); };
  n.qrCap = el("div", "qrcap", n.qrL, `<span>Quét mã bằng Zalo để tham gia</span>`);
  n.black = el("div", "black", n.root);
}
function renderOutro(n, t){
  const ch = n.ch, a = ch.a2hs || ch.t0 + 2;
  // 1) bảng chia sẻ trượt lên → chạm "Thêm vào màn hình chính"
  const up = outExpo((t - a) / .5), down = inCubic((t - a - 1.9) / .3);
  n.share.style.transform = `translate3d(0,${px(420 * (1 - up) + 420 * down)},0)`;
  n.share.style.display = t > a - .1 && t < a + 2.3 ? "" : "none";
  // 2) màn hình chính tràn màu từ điểm chạm, icon bật vào
  const hp = (t - a - 2.0) / .38;
  const open = (t - a - 4.1);
  if(hp > 0 && open < .55){
    n.hs.style.display = "";
    const r = Math.hypot(390, 844) * 1.05 * outCubic(hp);
    n.hs.style.clipPath = hp < 1 ? `circle(${px(r)} at 300px 700px)` : "";
    const ip = spring(t - a - 2.6, SP.play[0], SP.play[1]);
    n.app.style.transform = `scale(${clamp(ip, 0, 2).toFixed(4)})`; n.appL.style.opacity = clamp((t - a - 2.8) / .2).toFixed(3);
    // 3) chạm icon → phóng vào icon, mở app
    const z = inCubic(open / .55);
    n.hs.style.transformOrigin = `${n.appX + 31}px ${n.appY + 31}px`;
    n.hs.style.transform = open > 0 ? `scale(${logLerp(1, 9, z).toFixed(4)})` : "";
    n.hs.style.opacity = open > 0 ? (1 - z).toFixed(3) : "1";
  } else n.hs.style.display = "none";
  // ngón tay cho 2 lần chạm (vẽ tay vì lớp phủ không phải shot)
  const taps = [[a + 1.45, 195, 844 - 8 - 22 - 52 * 1.6], [a + 3.9, n.appX + 31, n.appY + 31]];
  const P = n.P; let shown = false;
  for(const [tc, x, y] of taps){ if(t >= tc - .34 && t <= tc + .42){ shown = true;
    const e = outCubic(clamp((t - (tc - .34)) / .2)), out = clamp((t - (tc + .14)) / .26);
    const sc = lerp(1.3, 1, e) * (1 - .16 * Math.exp(-Math.pow((t - tc) / .045, 2)));
    P.touch.style.opacity = (e * (1 - out)).toFixed(3); P.touch.style.transform = `translate3d(${px(x + 22*(1-e))},${px(y + 34*(1-e))},0) scale(${sc.toFixed(4)})`;
    const rp = clamp((t - tc) / .4), rr = 10 + 46 * outCubic(rp);
    P.ripple.style.opacity = t >= tc ? ((1 - rp) * .8).toFixed(3) : "0"; P.ripple.style.width = P.ripple.style.height = px(rr * 2); P.ripple.style.transform = `translate3d(${px(x - rr)},${px(y - rr)},0)`; } }
  if(!shown && t > a - .5 && t < a + 4.6){ P.touch.style.opacity = "0"; P.ripple.style.opacity = "0"; }
  // 4) CTA: logo → "Tham gia / TapEasy Cộng Đồng" → "để nhận bản tải miễn phí" → thẻ QR (giữ yên tới hết)
  const c0 = ch.cta_at, O = outroLayout();
  const lp = outExpo((t - c0) / .9);
  Object.assign(n.logo.style, { left: px(O.lx), top: px(O.ly), width: px(O.lw), clipPath: `inset(-5% ${(100 * (1 - lp)).toFixed(2)}% -5% 0)` });
  if(n.title){
    Object.assign(n.title.style, { left: px(O.titleX), top: px(O.ly + O.lh + H * (V ? .018 : .045)), width: px(O.titleW), textAlign: O.align });
  }
  const ty = n.title ? n.title.offsetTop + n.title.offsetHeight : H * .3;
  const q = sp(t - c0 - .5, "type");
  Object.assign(n.cta.style, { left: px(O.titleX), width: px(O.titleW), top: px(ty + H * .008), transform: `translate3d(0,${px(14 * (1 - q))},0)`,
    opacity: clamp((t - c0 - .5) / .3).toFixed(3), textAlign: O.align, fontSize: px(O.leadSize) });
  // thẻ QR: lò xo vào rồi KHOÁ cứng (không transform/opacity/filter) từ c0 + 1,3 s
  const cardTop = V ? ty + H * .008 + O.leadSize * 1.35 + O.cardGap : O.cy;
  const cx = O.cx - O.cw / 2;
  const showQ = t >= c0 + .2;
  n.qrL.style.display = showQ ? "" : "none";
  if(showQ){
    const settled = t >= c0 + 1.3;
    const k = settled ? 1 : sp(t - c0 - .2, "ui");
    Object.assign(n.qrCard.style, { left: px(Math.round(cx)), top: px(Math.round(cardTop)), width: px(Math.round(O.cw)), height: px(Math.round(O.ch)),
      transform: settled ? "" : `translate3d(0,${px(40 * (1 - k))},0) scale(${(.94 + .06 * k).toFixed(4)})`, opacity: settled ? "" : clamp((t - c0 - .2) / .25).toFixed(3) });
    const capY = Math.round(cardTop + O.ch + (V ? O.capGap : H * .012));
    n.qrCap.style.fontSize = px(O.capSize); n.qrCap.style.top = px(capY);
    n.qrCap.style.left = px(O.cx); n.qrCap.style.transform = "translate(-50%,0)";
    n.qrCap.style.opacity = settled ? "" : clamp((t - c0 - .6) / .3).toFixed(3);
    n.qrRect = { x: Math.round(cx), y: Math.round(cardTop), w: Math.round(O.cw), h: Math.round(O.ch), still: c0 + 1.3 };
  }
  n.black.style.opacity = "0";                       // không tắt đen: khung cuối là thẻ QR
  sheen(n, t, c0 + .4);
}

/* ---------------- chuyển chương ---------------- */
const PRE = { zoom:.3, whip:.25, rotate:.35, sweep:.25, flood:.02, match:.25, end:0, cut:0 };
const POST = { zoom:.6, whip:.5, rotate:.7, sweep:.45, flood:.45, match:.5, end:0, cut:0 };
const UID = (window.__composerN = (window.__composerN || 0) + 1);
const fxl = el("div", "fx", null);
const sweepEl = el("div", "sweep", fxl);
el("div", "vignette", fxl);
const grainSvg = el("div", "", fxl, `<svg class="grain" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><filter id="gr${UID}"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="1" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#gr${UID})"/></svg>`);
const grT = grainSvg.querySelector("feTurbulence");

/* điểm phóng: lần chạm cuối của chương (nếu trong 1,2 s cuối) hoặc giữa màn hình */
function zoomPoint(ci){
  const n = NODES[ci], ch = n.ch, s = ch.shots[ch.shots.length - 1];
  const tap = s.taps.length ? s.taps[s.taps.length - 1] : null;
  if(tap && ch.t1 - tap[0] < 1.4){ const pt = tapPoint(s, tap[1], tap[0]); return screenToStage(n, pt.x, pt.y); }
  return screenToStage(n, 195, 422);
}
function knobsFor(t){
  // trả về danh sách {ci, kn} cần vẽ (thứ tự dưới → trên)
  let ci = C.length - 1; for(let i = 0; i < C.length; i++){ if(t < C[i].t1){ ci = i; break; } }
  const list = [];
  const ch = C[ci];
  const prev = ci > 0 ? C[ci - 1] : null, next = ci < C.length - 1 ? C[ci + 1] : null;
  let A = null, B = null, kind = null, p = 0;
  if(next && t >= ch.t1 - (PRE[ch.out] || 0)){ A = ci; B = ci + 1; kind = ch.out; p = t - ch.t1; }
  else if(prev && t < ch.t0 + (POST[prev.out] || 0)){ A = ci - 1; B = ci; kind = prev.out; p = t - ch.t0; }
  if(A == null) return [{ ci, kn:{} }];
  const kA = {}, kB = {};
  const pre = PRE[kind], post = POST[kind];
  if(kind === "zoom"){
    // phóng xuyên vào màn hình tại điểm vừa chạm → cảnh mới tiến tới (0,75 → 1) cùng chiều chuyển động
    if(p < 0){ const e = inCubic((p + pre) / pre); kA.zoom = logLerp(1, 2.8, e); kA.zoomAt = zoomPoint(A); kA.blur = 18 * e; kA.textO = 1 - e; kB.hide = true; }
    else { kA.hide = true; const q = outExpo(p / post); kB.fgS = lerp(.75, 1, q); kB.blur = 12 * (1 - q); }
  } else if(kind === "whip"){
    // lia máy: hai cảnh cùng chiều, cùng tốc độ, liền mạch (nhoè do khung con)
    const u = p < 0 ? .5 * inCubic((p + pre) / pre) : .5 + .5 * outExpo(p / post);
    kA.slotX = -W * 1.04 * u; kB.slotX = W * 1.04 * (1 - u);
    if(u >= .999) kA.hide = true;
  } else if(kind === "rotate"){
    const e = inCubic((p + pre) / (pre + .12));
    kA.phone = { ry: 80 * e * (NODES[A].L.tilt || 1), x: -W * .18 * e, o: 1 - e }; kA.textO = 1 - clamp((p + pre) / .25);
    kB.bgO = inOut((p + .2) / .6); kB.phone = { ry: -75 * (1 - sp(p + .08, "cam")) * (NODES[B].L.tilt || 1), o: clamp((p + .08) / .15) };
    if(p > post - .05) kA.hide = true;
    kB.textO = p < 0 ? 0 : 1;
  } else if(kind === "sweep"){
    const sp0 = (p + pre) / (pre + .25);
    sweepEl.style.display = sp0 > 0 && sp0 < 1 ? "" : "none";
    sweepEl.style.width = px(W * .5); sweepEl.style.left = px(lerp(-W * .8, W * 1.3, inOut(sp0)));
    if(p < 0){ kB.hide = true; } else { kA.hide = true; const q = outExpo(p / post); kB.slotS = lerp(1.05, 1, q); }
  } else if(kind === "flood"){
    const a = NODES[A];
    const last = a.ch.shots[a.ch.shots.length - 1];
    const o = screenToStage(a, 195, 760);
    const r = Math.hypot(Math.max(o.x, W - o.x), Math.max(o.y, H - o.y)) * 1.05 * outCubic(p / .38);
    if(p < 0) kB.hide = true; else { kB.clip = `circle(${px(r)} at ${px(o.x)} ${px(o.y)})`; if(p > .4) kA.hide = true; }
  } else if(kind === "match"){
    if(p < 0){ kA.textO = 1 - clamp((p + pre) / pre); kB.hide = true; }
    else { kA.phoneHide = true; kA.textO = 0; kB.bgO = inOut(p / post); if(p >= post - .02) kA.hide = true; }
  } else { if(p < 0) kB.hide = true; else kA.hide = true; }
  if(!kA.hide) list.push({ ci: A, kn: kA, role:"A", p, kind });
  if(!kB.hide) list.push({ ci: B, kn: kB, role:"B", p, kind });
  return list;
}

function renderChapter(n, t, kn){
  const ch = n.ch;
  renderBg(n, t, kn);
  const ex = kn.phone || {};
  applyPose(n, t, { ry: ex.ry, x: ex.x, o: kn.phoneHide ? 0 : ex.o });
  renderScreen(n, t);
  if(ch.kind === "intro") renderIntro(n, t);
  if(ch.kind === "outro") renderOutro(n, t);
  if(ch.kind === "themes") sheen(n, t, ch.t0 + .5);
  if(ch.kind === "soon") renderSoon(n, t, kn);
  renderText(n, t, kn);
  // biến đổi cả slot
  const tf = [];
  if(kn.slotX) tf.push(`translate3d(${px(kn.slotX)},0,0)`);
  if(kn.slotS && kn.slotS !== 1) tf.push(`scale(${kn.slotS.toFixed(4)})`);
  n.fg.style.transform = kn.fgS && kn.fgS !== 1 ? `scale(${kn.fgS.toFixed(4)})` : "";
  if(kn.zoom && kn.zoom !== 1){
    const a = kn.zoomAt || n.phoneAt || { x: W/2, y: H/2 };
    n.root.style.transformOrigin = `${px(a.x)} ${px(a.y)}`;
    tf.push(`scale(${kn.zoom.toFixed(4)})`);
  } else n.root.style.transformOrigin = "50% 50%";
  n.root.style.transform = tf.join(" ");
  n.root.style.filter = kn.blur > .2 ? `blur(${kn.blur.toFixed(2)}px)` : "";
  n.root.style.opacity = kn.slotO == null ? "" : kn.slotO.toFixed(3);
  n.root.style.clipPath = kn.clip || "";
}

/* ---------------- vòng vẽ ---------------- */
let mounted = [];
let lastT = null;
function render(t){
  const list = knobsFor(t);
  const want = list.map(o => NODES[o.ci]);
  mounted.forEach(n => { if(!want.includes(n)) n.root.remove(); });
  want.forEach(n => { if(n.root.parentNode !== stage){ stage.appendChild(n.root); n.root.querySelectorAll("img").forEach(i => pending.add(i)); } });
  // thứ tự: cũ dưới, mới trên
  list.forEach(o => stage.appendChild(NODES[o.ci].root));
  stage.appendChild(fxl);
  NODES.forEach(n => { if(!n.qrL) return; const on = want.includes(n) && t >= n.ch.cta_at; if(on && n.qrL.parentNode !== stage){ stage.appendChild(n.qrL); n.qrL.querySelectorAll("img").forEach(i => pending.add(i)); } else if(on) stage.appendChild(n.qrL); else if(n.qrL.parentNode) n.qrL.remove(); });
  mounted = want;
  if(!list.some(o => o.kind === "sweep")) sweepEl.style.display = "none";
  list.forEach(o => renderChapter(NODES[o.ci], t, o.kn));
  // hạt phim: đổi hạt giống mỗi 2 khung
  grT.setAttribute("seed", String(1 + (Math.floor(t * FPS / 2) % 997)));
  lastT = t;
}
async function settle(){
  const list = Array.from(pending); pending.clear();
  await Promise.all(list.map(i => i.isConnected ? (i.decode ? i.decode().catch(() => {}) : Promise.resolve()) : Promise.resolve()));
  // ảnh trong DOM chưa xong (mạng chậm)
  const imgs = Array.from(stage.querySelectorAll("img")).filter(i => !i.complete);
  if(imgs.length) await Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 4000); })));
}
/* số khung con cho nhoè chuyển động: chỉ ở đoạn nhanh (whip/zoom/flood và chuyển màn push) */
function blurSamples(t){
  for(let i = 0; i < C.length - 1; i++){
    const b = C[i].t1, k = C[i].out;
    if(k === "whip" && t > b - .27 && t < b + .45) return 8;
    if(k === "zoom" && t > b - .32 && t < b + .3) return 6;
    if((k === "rotate" || k === "sweep") && t > b - .36 && t < b + .3) return 4;
  }
  for(const ch of C){ if(ch.kind === "intro" && ch.phone_in && t > ch.phone_in && t < ch.phone_in + .5) return 4;
    for(const s of ch.shots){ if((s.enter === "push") && t > s.t0 && t < s.t0 + .22) return 4; } }
  return 1;
}
/* mốc cắt cứng: khung con không vượt qua */
function cutPoints(){ const cs = []; C.forEach((c, i) => { if(i < C.length - 1 && ["zoom","whip","sweep","match"].includes(c.out)) cs.push(c.t1); }); return cs; }

/* ---------------- QA khít: khung bao (toạ độ khung dựng) của màn mockup vs lớp ảnh app ----------------
   Cùng một cây DOM/transform (rig → tilt → phone → screen → shot) nên khi xoay 3D/zoom/whip ảnh app không thể trễ khung;
   probe() đo lại để chứng minh (sai lệch ≤ 1 px) và kiểm ảnh chụp đúng tỉ lệ 390:844. */
function probe(){
  const sr = stage.getBoundingClientRect(), f = W / sr.width;
  const R = e => { const r = e.getBoundingClientRect(); return { x: (r.left - sr.left) * f, y: (r.top - sr.top) * f, w: r.width * f, h: r.height * f }; };
  const d4 = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.x + a.w - b.x - b.w), Math.abs(a.y + a.h - b.y - b.h));
  const out = [];
  mounted.forEach(n => {
    const P = n.P; if(!P || +(P.cam.style.opacity || 1) < .02) return;
    const scr = R(P.scr), glass = R(P.ph.querySelector(".glass")), isl = R(P.island), st = P.statusBox.firstChild ? R(P.statusBox.firstChild) : null, hb = R(P.homebar);
    const k = scr.w / SCR_W;
    const shots = P.mounted.map(s => {
      const settled = !s.root.style.transform && !s.root.style.clipPath && (s.root.style.opacity === "" || +s.root.style.opacity >= 1);
      const o = { id: s.id, settled, layer: R(s.root) };
      if(s.base){ o.img = R(s.base); o.nat = [s.base.naturalWidth, s.base.naturalHeight]; o.arErr = s.base.naturalWidth ? Math.abs(s.base.naturalWidth / s.base.naturalHeight - SCR_W / SCR_H) : null; }
      o.err = Math.max(d4(o.layer, scr), o.img ? d4(o.img, scr) : 0);
      return o;
    });
    out.push({ ch: n.ch.id, scr, k, glassErr: d4(glass, scr), islandTop: (isl.y - scr.y) / k, islandBottom: (isl.y + isl.h - scr.y) / k,
      islandCx: (isl.x + isl.w / 2 - scr.x - scr.w / 2) / k, statusH: st ? st.h / k : null, homeGap: (scr.y + scr.h - hb.y - hb.h) / k,
      safe: SAFE, shots, qr: n.qrRect && lastT >= n.ch.cta_at ? n.qrRect : null });
  });
  return out;
}

const ready = (async () => {
  try{ await document.fonts.ready; }catch(e){}
  fitTitles();
  render(0); await settle();
  return { W, H, duration: TL.duration, shots: Object.keys(MAN.shots || {}).length, safe: SAFE };
})();
return { render, settle, ready, probe, blurSamples, cutPoints, capCheck, textQA, duration: TL.duration, W, H };
}

window.__makeComposer = makeComposer;
if(window.__NO_AUTO) return;
const Q = new URLSearchParams(location.search);
const comp = makeComposer({ stage: document.getElementById("stage"), w: +Q.get("w") || 1080, h: +Q.get("h") || 1920, fps: +Q.get("fps") || 0, qa: Q.get("qa") || "" });
window.__render = async function(t){ comp.render(t); await comp.settle(); return true; };
window.__blurSamples = comp.blurSamples;
window.__cuts = comp.cutPoints;
window.__probe = comp.probe;
window.__capCheck = comp.capCheck;    // phụ đề: mồ côi / dấu đầu dòng / tràn (qa_fit.py)
window.__textQA = comp.textQA;        // chữ đè nhau / sát mép ở khung hiện tại
window.__duration = comp.duration;
window.__ready = comp.ready;

// xem thử
if(Q.get("t") != null){ window.__ready.then(() => window.__render(+Q.get("t"))); }
if(Q.get("play")){ const t0 = performance.now(), off = +Q.get("from") || 0; window.__ready.then(() => { const loop = () => { comp.render(off + (performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop(); }); }
})();

/* =========================================================================
   TapEasy — GÓI GIAO DIỆN: hiệu ứng chạy bằng JS (theme-packs.js) · nạp sau mọi module, ngay trước ui-signature.js / health-safety.js
   Danh sách gói + áp theme ở themes.js; màu/chất liệu/font/chuyển động ở theme-packs.css. File này chỉ lo:
   1. Kính lỏng có KHÚC XẠ cho gói Espresso: bộ lọc SVG <filter id="tp-lg-refract"> = feDisplacementMap đọc bản đồ
      dịch chuyển vẽ bằng canvas từ SDF (hàm khoảng cách có dấu) của hình chữ nhật bo góc → mép kính bẻ cong nền phía sau.
      Chỉ bật (html.tp-refract) khi: gói có refract, trình duyệt Chromium (backdrop-filter:url() chỉ Chromium hỗ trợ),
      KHÔNG phải iPhone/iPad, KHÔNG html.lowfx (máy yếu / giảm trong suốt), KHÔNG prefers-reduced-transparency.
   2. API: window.tpPacks = { refreshFx(), refractOn(), sdfMap(w,h,r,band) }.
   Không sửa DOM của app, không lưu state.
   ========================================================================= */
(function(){
  "use strict";
  const root = document.documentElement;
  const REFRACT_PACKS = { espresso:1 };
  const FILTER_ID = "tp-lg-refract";
  const warn = (m, e)=>{ try{ console.warn("[theme-packs] " + m, e || ""); }catch(_){} };

  /* ---------- SDF hình chữ nhật bo góc → bản đồ dịch chuyển (R = dx, G = dy, 128 = đứng yên) ----------
     Toạ độ chuẩn hoá theo cạnh ngắn; trong dải "band" sát mép, điểm ảnh bị kéo về phía tâm theo
     độ dốc của SDF (pháp tuyến), cường độ giảm dần theo hàm (1 - d/band)^2 → giống mép thấu kính. */
  function sdfMap(w, h, r, band){
    w = w || 128; h = h || 64; r = r == null ? Math.min(w, h) / 2 : r; band = band || Math.min(w, h) * 0.32;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d"); if(!ctx) return "";
    const img = ctx.createImageData(w, h), d = img.data;
    const hx = w / 2, hy = h / 2;
    const sd = (x, y)=>{ // SDF hộp bo góc (Inigo Quilez), âm ở bên trong
      const qx = Math.abs(x - hx) - (hx - r), qy = Math.abs(y - hy) - (hy - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
      return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r;
    };
    for(let y = 0; y < h; y++){
      for(let x = 0; x < w; x++){
        const px = x + .5, py = y + .5;
        const dist = -sd(px, py);                    // >0 ở trong
        let dx = 0, dy = 0;
        if(dist > 0 && dist < band){
          const gx = sd(px + 1, py) - sd(px - 1, py), gy = sd(px, py + 1) - sd(px, py - 1);
          const gl = Math.hypot(gx, gy) || 1;
          const k = Math.pow(1 - dist / band, 2);     // mạnh nhất ở mép
          dx = -gx / gl * k; dy = -gy / gl * k;        // kéo vào trong
        }
        const i = (y * w + x) * 4;
        d[i] = Math.round(128 + dx * 127); d[i + 1] = Math.round(128 + dy * 127); d[i + 2] = 128; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    try{ return c.toDataURL("image/png"); }catch(e){ return ""; }
  }

  let filterReady = false;
  function ensureFilter(){
    if(filterReady || document.getElementById(FILTER_ID)) { filterReady = true; return true; }
    if(!document.body) return false;
    const map = sdfMap(160, 72, 36, 22);
    if(!map) return false;
    const NS = "http://www.w3.org/2000/svg";
    const wrap = document.createElement("div");
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    wrap.innerHTML = `<svg xmlns="${NS}" width="0" height="0" focusable="false">
      <filter id="${FILTER_ID}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB" primitiveUnits="objectBoundingBox">
        <feImage href="${map}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map"/>
        <feDisplacementMap in="SourceGraphic" in2="map" scale="0.12" xChannelSelector="R" yChannelSelector="G" result="refr"/>
        <feGaussianBlur in="refr" stdDeviation="0.004" />
      </filter></svg>`;
    document.body.appendChild(wrap);
    filterReady = true;
    return true;
  }

  /* ---------- quyết định bật khúc xạ ---------- */
  function isChromium(){
    try{
      const ua = navigator.userAgent || "";
      if(/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return false;   // WebKit
      const brands = navigator.userAgentData && navigator.userAgentData.brands;
      if(brands && brands.some(b=> /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand))) return true;
      return /Chrome\/\d+/.test(ua) && !/Firefox|FxiOS/i.test(ua);
    }catch(e){ return false; }
  }
  function reducedTransparency(){ try{ return !!(window.matchMedia && matchMedia("(prefers-reduced-transparency: reduce)").matches); }catch(e){ return false; } }
  function refractOn(){
    const id = root.getAttribute("data-theme") || "";
    return !!REFRACT_PACKS[id] && isChromium() && !root.classList.contains("lowfx") && !reducedTransparency()
      && !(window.TP_NO_REFRACT) && (typeof CSS === "undefined" || !CSS.supports || CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));
  }
  let busy = false;
  function refreshFx(){
    if(busy) return; busy = true;
    try{
      const on = refractOn() && ensureFilter();
      if(root.classList.contains("tp-refract") !== !!on) root.classList.toggle("tp-refract", !!on);
    }catch(e){ warn("fx", e); }
    busy = false;
  }

  /* đổi theme / bật-tắt lowfx (class trên <html>) → tính lại */
  try{
    window.addEventListener("fk:themechange", refreshFx);
    new MutationObserver(muts=>{ if(muts.some(m=> m.attributeName === "class" || m.attributeName === "data-theme")) refreshFx(); })
      .observe(root, { attributes:true, attributeFilter:["class", "data-theme"] });
  }catch(e){ warn("observe", e); }

  window.tpPacks = { refreshFx, refractOn, sdfMap };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshFx); else refreshFx();
})();

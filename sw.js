/* TapEasy — Service Worker (chỉ dùng khi chạy dạng web/PWA, app native không dùng)
   Chiến lược (vòng sửa UX — QU-09, docs/qa/FIX-ux.md):
   - HTML (điều hướng, index.html): MẠNG TRƯỚC, quá 3 s hoặc mất mạng → bản đã lưu (bỏ qua ?go=… của lối tắt PWA).
   - JS/CSS/ảnh/JSON cùng nguồn: STALE-WHILE-REVALIDATE — trả ngay bản trong cache, tải bản mới chạy nền cho lần mở sau.
   - Google Fonts (CSS + woff2): cache-first trong cache riêng (file font bất biến theo URL).
   R3 (docs/qa/R3-ux.md): precache tải bằng cache:"reload" (không lấy bản cũ trong HTTP cache) · tài nguyên ngoài danh sách vào
     cache riêng có giới hạn (RT_CACHE) · HTML lỗi 5xx → bản đã lưu · mất mạng mà chưa có bản lưu → trang ngoại tuyến ·
     kích hoạt xong báo cho trang ("Có bản mới — tải lại") · bấm thông báo → mở/đưa app ra trước.
   - Precache đủ mọi file index.html nạp (scripts/prepare-www.sh kiểm danh sách); lưu TỪNG file.
   Tên cache giữ tiền tố "fitkit-" (định danh kỹ thuật, không hiển thị) — đổi số phiên bản mỗi lần thêm/bớt/sửa file. */
const CACHE = "fitkit-v25";  // v24: nối Firebase thật (project tapeasy) + điền chính sách/điều khoản · v23 (R3 tích hợp): sửa lỗi lõi/dinh dưỡng/cloud/admin/cửa hàng, i18n-en-6.js, terms.html · v22 (R3 ux): i18n.js + từ điển i18n-en*.js (đổi ngôn ngữ Việt/Anh), cache chạy-lúc-dùng có giới hạn, trang ngoại tuyến, báo "Có bản mới", notificationclick · v21: analytics.js (thống kê có đồng ý) + feedback.js (góp ý/NPS/có gì mới) + onboarding "Kế hoạch đã sẵn sàng" · v20: slogan giãn dòng, Volt tiêu đề không đè vòng, bản đồ màn chào (wlMapFinish) · v13: theme-accent.css/.js (token accent + logo đổi màu theo theme, 4 gói mới) · v12: press-feel.js/.css (cảm giác bấm) · v11: morph-icons.js + vendor/morphicons.min.js (icon biến hình) · v10: people-ai.js (ảnh có người → ảnh AI) · v9 (integrator 12/11): app.js, pt.js, nhiều module đổi — làm mới cache · v8 (vòng 2 ux): fk-lazy.js — exdb-vi-1..3 / kb-data-1..6 nạp lười nhưng VẪN precache (offline)
                             // v7 (vòng sửa UX): SWR + HTML mạng trước có hạn giờ; JSZip nạp khi cần; CSP
                             // (v6: Quản trị & phân quyền, Tìm PT, Kho kiến thức, ảnh/clip sự kiện · v5: PT Connect, Cộng đồng, Sự kiện, Gian hàng)
const FONT_CACHE = "fitkit-fonts-v1";
const RT_CACHE = "fitkit-rt-v1";   // R3-UX-03: tài nguyên KHÔNG precache (ảnh Cửa hàng, ảnh minh hoạ, JSON media…) — có giới hạn số mục
const RT_MAX = 150;
const HTML_TIMEOUT_MS = 3000;
const ASSETS = [
  "./index.html", "./manifest.json",
  // CSS (đúng thứ tự index.html)
  "./style.css", "./themes.css", "./brand.css", "./ui-kit.css", "./nutrition-pro.css", "./training-pro.css", "./program-builder.css",
  "./pt-pro.css", "./pt-connect.css", "./community.css", "./achievements.css", "./health-safety.css", "./events.css", "./shop.css",
  "./findpt.css", "./kb.css", "./admin.css",
  "./themes-modules.css",
  "./theme-packs.css", "./ui-signature.css", "./theme-packs.js", "./ui-signature.js",   // gói giao diện + thành phần chữ ký (docs/THEME-PACKS.md)
  "./press-feel.css",   // cảm giác bấm (docs/PRESS-FEEL.md)
  "./theme-accent.css", "./theme-accent.js",   // token accent theo theme + logo SVG nội tuyến (docs/THEME-PACKS.md §8)
  // JS lõi
  "./themes.js", "./fk-lazy.js", "./i18n.js", "./i18n-en.js", "./i18n-en-2.js", "./i18n-en-3.js", "./i18n-en-4.js", "./i18n-en-5.js", "./i18n-en-6.js", "./icons.js", "./firebase-config.js", "./media-config.js", "./cloud.js", "./rbac.js", "./analytics.js", "./data.js", "./people-ai.js", "./templates.js", "./exdb.js", "./app.js",
  "./meals.js", "./meals-extra.js", "./nutrition.js", "./freevideos.js", "./video.js", "./library.js", "./coach.js", "./ptprofile.js", "./pt.js",
  // JS module mở rộng
  "./ui-kit.js", "./exdb-vi-1.js", "./exdb-vi-2.js", "./exdb-vi-3.js", "./exdb-vi.js", "./nutrition-pro.js", "./training-pro.js",
  "./program-builder.js", "./pt-pro.js", "./cloud-social.js", "./pt-connect.js", "./community.js",
  "./cloud-pt-directory.js", "./findpt.js", "./achievements.js",
  "./cloud-events.js", "./events-media.js", "./events.js", "./shop-data.js", "./shop.js",
  "./kb-data-1.js", "./kb-data-2.js", "./kb-data-3.js", "./kb-data-4.js", "./kb-data-5.js", "./kb-data-6.js", "./kb.js",
  "./cloud-admin.js", "./admin.js", "./feedback.js", "./press-feel.js", "./morph-icons.js", "./health-safety.js",
  // vendor/morphicons.min.js (icon biến hình, nạp lười): KHÔNG liệt kê tĩnh vì chỉ có sau khi chạy workflow vendor-morphicons —
  // scripts/prepare-www.sh tự thêm vào ASSETS khi file có; lúc chạy, lần tải đầu được cache stale-while-revalidate như mọi JS cùng nguồn.
  // Ảnh / thương hiệu
  "./assets/bg-storm.jpg", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/icon-maskable-512.png", "./assets/icon-maskable-192.png", "./assets/apple-touch-icon-180.png",
  "./assets/favicon.svg", "./assets/favicon-32.png", "./assets/favicon-16.png", "./assets/favicon.ico",
  "./assets/shortcut-workout-96.png", "./assets/shortcut-meal-96.png", "./assets/shortcut-progress-96.png",
  "./assets/brand/logo-mark.svg", "./assets/brand/logo-mark-white.svg", "./assets/brand/logo-wordmark-light.svg", "./assets/brand/logo-wordmark-dark.svg",
  "./assets/brand/logo-lockup-light.svg", "./assets/brand/logo-lockup-dark.svg", "./assets/brand/logo-horizontal-light.svg", "./assets/brand/logo-horizontal-dark.svg",
  "./assets/brand/logo-full.png",
];

/* Không cache sẵn: ảnh sản phẩm assets/shop/*.webp (≈ 1,3 MB — cache khi xem, trong RT_CACHE có giới hạn), ảnh/clip Pexels & Firebase Storage
   (khác origin → đi thẳng mạng, trình duyệt tự cache HTTP). */
const PRECACHED = new Set(ASSETS.map(u=> new URL(u, self.location.href).pathname));

self.addEventListener("install", e=>{
  // Lưu TỪNG file (một file thiếu/404 không làm hỏng cả bộ nhớ đệm như addAll).
  // R3-UX-01: cache:"reload" — bỏ qua HTTP cache (GitHub Pages max-age 10 phút) để bản mới không precache nhầm file cũ.
  e.waitUntil(caches.open(CACHE).then(c=> Promise.all(ASSETS.map(u=>
    fetch(new Request(u, { cache:"reload" })).then(res=>{ if(res && res.status === 200) return c.put(u, res); }).catch(()=>{})
  ))).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate", e=>{
  const keep = [CACHE, FONT_CACHE, RT_CACHE];
  e.waitUntil(caches.keys()
    .then(keys=> Promise.all(keys.filter(k=> /^fitkit-/.test(k) && keep.indexOf(k) < 0).map(k=> caches.delete(k))))
    .then(()=> self.clients.claim())
    // R3-UX-02: báo các trang đang mở — ui-kit.js hiện dải "Có bản mới — tải lại" (không tự tải lại giữa buổi tập)
    .then(()=> self.clients.matchAll({ type:"window", includeUncontrolled:true }))
    .then(list=>{ (list || []).forEach(c=>{ try{ c.postMessage({ type:"FK_SW_ACTIVATED", version:CACHE }); }catch(_){} }); })
    .catch(()=>{}));
});
self.addEventListener("message", e=>{
  const d = e.data || {};
  if(d.type === "SKIP_WAITING") self.skipWaiting();
  else if(d.type === "GET_VERSION" && e.source){ try{ e.source.postMessage({ type:"FK_SW_VERSION", version:CACHE }); }catch(_){} }
});

/* Chỉ lưu phản hồi 200 đầy đủ cùng nguồn/CORS — không lưu lỗi, 206 (một phần), opaque */
function cacheable(res){ return !!res && res.status === 200 && (res.type === "basic" || res.type === "cors"); }
let trimming = false;
function trimRuntime(){
  if(trimming) return; trimming = true;
  caches.open(RT_CACHE).then(c=> c.keys().then(keys=>
    keys.length > RT_MAX ? Promise.all(keys.slice(0, keys.length - RT_MAX).map(k=> c.delete(k))) : null
  )).catch(()=>{}).then(()=>{ trimming = false; });
}
function putCache(name, req, res){
  if(cacheable(res)){
    const copy = res.clone();
    caches.open(name).then(c=> c.put(req, copy)).then(()=>{ if(name === RT_CACHE) trimRuntime(); }).catch(()=>{});
  }
  return res;
}
/* Trang ngoại tuyến tối giản (điều hướng tới trang chưa từng lưu khi mất mạng) */
function offlinePage(){
  const html = '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
    '<title>TapEasy — Đang ngoại tuyến</title><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;' +
    'background:#061A24;color:#EAF6F4;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:center;padding:24px;box-sizing:border-box}' +
    'h1{font-size:22px;margin:0 0 8px}p{margin:0 0 20px;color:#A9C4C1}a,button{display:inline-block;min-height:44px;padding:11px 20px;margin:4px;border-radius:999px;' +
    'border:1px solid #33D6C9;background:transparent;color:#EAF6F4;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}a{background:#33D6C9;color:#061A24}</style></head>' +
    '<body><main><h1>TapEasy đang ngoại tuyến</h1><p>Trang này chưa được lưu để xem khi mất mạng.<br>This page isn’t available offline yet.</p>' +
    '<a href="./index.html">Mở TapEasy</a><button onclick="location.reload()">Thử lại · Retry</button></main></body></html>';
  return new Response(html, { status:503, statusText:"Offline", headers:{ "Content-Type":"text/html; charset=utf-8", "Cache-Control":"no-store" } });
}
/* HTML: mạng trước; quá HTML_TIMEOUT_MS mà đã có bản lưu → trả bản lưu (mạng vẫn cập nhật cache cho lần sau).
   R3-UX-04: khoá cache = đường dẫn KHÔNG kèm ?query (hết phình cache theo ?utm=…); 5xx → bản lưu; không có gì → trang ngoại tuyến. */
function networkFirstHTML(e){
  const req = e.request, url = new URL(req.url);
  const isIndex = /\/(index\.html)?$/.test(url.pathname);
  const key = isIndex ? "./index.html" : url.origin + url.pathname;   // index.html?go=… (lối tắt PWA) dùng chung 1 bản
  const fromCache = ()=> caches.match(key, { ignoreSearch:true });
  const net = fetch(req).then(res=>{ if(!res.redirected) putCache(CACHE, key, res); return res; });
  e.waitUntil(net.catch(()=>{}));
  return new Promise(resolve=>{
    let done = false;
    const finish = r=>{ if(!done && r){ done = true; resolve(r); } };
    const fallback = ()=> fromCache().then(r=> r || (req.mode === "navigate" ? offlinePage() : Response.error()))
                                     .catch(()=> offlinePage());
    const t = setTimeout(()=>{ fromCache().then(finish).catch(()=>{}); }, HTML_TIMEOUT_MS);
    net.then(r=>{
      clearTimeout(t);
      if(r && r.status >= 500) return fromCache().then(c=> finish(c || r)).catch(()=> finish(r));   // máy chủ lỗi → ưu tiên bản đã lưu
      finish(r);
    }, ()=>{ clearTimeout(t); fallback().then(finish); });
  });
}
/* Tài nguyên tĩnh: trả bản trong cache ngay, cập nhật nền. File trong ASSETS → CACHE (đổi theo phiên bản); còn lại → RT_CACHE có giới hạn. */
function staleWhileRevalidate(e){
  const req = e.request;
  const name = PRECACHED.has(new URL(req.url).pathname) ? CACHE : RT_CACHE;
  return caches.open(name).then(c=> c.match(req).then(hit=>{
    const net = fetch(req).then(res=> putCache(name, req, res));
    if(hit){ e.waitUntil(net.catch(()=>{})); return hit; }
    return net.catch(()=> caches.match(req, { ignoreSearch:true }).then(r=> r || Response.error()));
  }));
}
/* Font Google: cache trước (URL font bất biến) */
function cacheFirst(e, name){
  const req = e.request;
  return caches.open(name).then(c=> c.match(req).then(hit=> hit || fetch(req).then(res=> putCache(name, req, res))));
}

self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method !== "GET") return;
  if(req.headers.has("range")) return;                         // video/âm thanh tua từng đoạn: để trình duyệt tự xử lý
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(req.mode === "navigate" || /\/(index\.html)?$/.test(url.pathname)) return e.respondWith(networkFirstHTML(e));
    if(/\.(?:js|css|svg|png|jpe?g|webp|ico|json|woff2?)$/i.test(url.pathname)) return e.respondWith(staleWhileRevalidate(e));
    return;                                                    // còn lại: đi thẳng mạng
  }
  if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return e.respondWith(cacheFirst(e, FONT_CACHE));
  // Firebase, Google Sign-In, ảnh Pexels/Pixabay/Storage… đi thẳng mạng (trình duyệt tự cache HTTP)
});

/* R3-UX-06: bấm thông báo (nhắc tập/ăn/ngủ hiện qua registration.showNotification) → đưa app ra trước hoặc mở app */
self.addEventListener("notificationclick", e=>{
  try{ e.notification.close(); }catch(_){}
  const target = new URL((e.notification && e.notification.data && e.notification.data.url) || "./index.html", self.location.href).href;
  e.waitUntil(self.clients.matchAll({ type:"window", includeUncontrolled:true }).then(list=>{
    for(const c of list || []){ if(c.url.indexOf(self.registration.scope) === 0 && "focus" in c) return c.focus(); }
    return self.clients.openWindow ? self.clients.openWindow(target) : null;
  }).catch(()=>{}));
});

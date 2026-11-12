/* TapEasy — Service Worker (chỉ dùng khi chạy dạng web/PWA, app native không dùng)
   Chiến lược (vòng sửa UX — QU-09, docs/qa/FIX-ux.md):
   - HTML (điều hướng, index.html): MẠNG TRƯỚC, quá 3 s hoặc mất mạng → bản đã lưu (bỏ qua ?go=… của lối tắt PWA).
   - JS/CSS/ảnh/JSON cùng nguồn: STALE-WHILE-REVALIDATE — trả ngay bản trong cache, tải bản mới chạy nền cho lần mở sau.
   - Google Fonts (CSS + woff2): cache-first trong cache riêng (file font bất biến theo URL).
   - Precache đủ mọi file index.html nạp (scripts/prepare-www.sh kiểm danh sách); lưu TỪNG file.
   Tên cache giữ tiền tố "fitkit-" (định danh kỹ thuật, không hiển thị) — đổi số phiên bản mỗi lần thêm/bớt/sửa file. */
const CACHE = "fitkit-v21";  // v21: analytics.js (thống kê có đồng ý) + feedback.js (góp ý/NPS/có gì mới) + onboarding "Kế hoạch đã sẵn sàng" · v20: slogan giãn dòng, Volt tiêu đề không đè vòng, bản đồ màn chào (wlMapFinish) · v13: theme-accent.css/.js (token accent + logo đổi màu theo theme, 4 gói mới) · v12: press-feel.js/.css (cảm giác bấm) · v11: morph-icons.js + vendor/morphicons.min.js (icon biến hình) · v10: people-ai.js (ảnh có người → ảnh AI) · v9 (integrator 12/11): app.js, pt.js, nhiều module đổi — làm mới cache · v8 (vòng 2 ux): fk-lazy.js — exdb-vi-1..3 / kb-data-1..6 nạp lười nhưng VẪN precache (offline)
                             // v7 (vòng sửa UX): SWR + HTML mạng trước có hạn giờ; JSZip nạp khi cần; CSP
                             // (v6: Quản trị & phân quyền, Tìm PT, Kho kiến thức, ảnh/clip sự kiện · v5: PT Connect, Cộng đồng, Sự kiện, Gian hàng)
const FONT_CACHE = "fitkit-fonts-v1";
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
  "./themes.js", "./fk-lazy.js", "./icons.js", "./firebase-config.js", "./media-config.js", "./cloud.js", "./rbac.js", "./analytics.js", "./data.js", "./people-ai.js", "./templates.js", "./exdb.js", "./app.js",
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
  "./assets/bg-storm.jpg", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/icon-maskable-512.png", "./assets/apple-touch-icon-180.png",
  "./assets/favicon.svg", "./assets/favicon-32.png", "./assets/favicon-16.png", "./assets/favicon.ico",
  "./assets/shortcut-workout-96.png", "./assets/shortcut-meal-96.png",
  "./assets/brand/logo-mark.svg", "./assets/brand/logo-mark-white.svg", "./assets/brand/logo-wordmark-light.svg", "./assets/brand/logo-wordmark-dark.svg",
  "./assets/brand/logo-lockup-light.svg", "./assets/brand/logo-lockup-dark.svg", "./assets/brand/logo-horizontal-light.svg", "./assets/brand/logo-horizontal-dark.svg",
  "./assets/brand/logo-full.png",
];

/* Không cache sẵn: ảnh sản phẩm assets/shop/*.webp (≈ 1,3 MB — cache khi xem), ảnh/clip Pexels & Firebase Storage
   (khác origin → đi thẳng mạng, trình duyệt tự cache HTTP). */

self.addEventListener("install", e=>{
  // Lưu TỪNG file (một file thiếu/404 không làm hỏng cả bộ nhớ đệm như addAll)
  e.waitUntil(caches.open(CACHE).then(c=> Promise.all(ASSETS.map(u=> c.add(u).catch(()=>{})))).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.filter(k=> k!==CACHE && k!==FONT_CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

function putCache(name, req, res){
  if(res && res.ok && (res.type === "basic" || res.type === "cors")){ const copy = res.clone(); caches.open(name).then(c=> c.put(req, copy)).catch(()=>{}); }
  return res;
}
/* HTML: mạng trước; quá HTML_TIMEOUT_MS mà đã có bản lưu → trả bản lưu (mạng vẫn cập nhật cache cho lần sau) */
function networkFirstHTML(e){
  const req = e.request;
  const isIndex = /\/(index\.html)?$/.test(new URL(req.url).pathname);
  const key = isIndex ? "./index.html" : req;                 // index.html?go=… (lối tắt PWA) dùng chung 1 bản
  const fromCache = ()=> caches.match(key, { ignoreSearch:true }).then(r=> r || (isIndex ? null : caches.match(req, { ignoreSearch:true })));
  const net = fetch(req).then(res=> putCache(CACHE, key, res));
  e.waitUntil(net.catch(()=>{}));
  return new Promise(resolve=>{
    let done = false;
    const finish = r=>{ if(!done && r){ done = true; resolve(r); } };
    const t = setTimeout(()=>{ fromCache().then(finish).catch(()=>{}); }, HTML_TIMEOUT_MS);
    net.then(r=>{ clearTimeout(t); finish(r); },
             ()=>{ clearTimeout(t); fromCache().then(r=> finish(r || Response.error())).catch(()=> finish(Response.error())); });
  });
}
/* Tài nguyên tĩnh: trả bản trong cache ngay, cập nhật nền */
function staleWhileRevalidate(e, name){
  const req = e.request;
  return caches.open(name).then(c=> c.match(req).then(hit=>{
    const net = fetch(req).then(res=> putCache(name, req, res));
    if(hit){ e.waitUntil(net.catch(()=>{})); return hit; }
    return net.catch(()=> caches.match(req, { ignoreSearch:true }));
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
  const url = new URL(req.url);
  if(url.origin === self.location.origin){
    if(req.mode === "navigate" || /\/(index\.html)?$/.test(url.pathname)) return e.respondWith(networkFirstHTML(e));
    if(/\.(?:js|css|svg|png|jpe?g|webp|ico|json|woff2?)$/i.test(url.pathname)) return e.respondWith(staleWhileRevalidate(e, CACHE));
    return;                                                    // còn lại: đi thẳng mạng
  }
  if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") return e.respondWith(cacheFirst(e, FONT_CACHE));
  // Firebase, Google Sign-In, ảnh Pexels/Pixabay/Storage… đi thẳng mạng (trình duyệt tự cache HTTP)
});

/* FIT KIT — Service Worker (chỉ dùng khi chạy dạng web/PWA, app native không dùng)
   Chiến lược: mạng trước, lỗi mạng thì dùng bản đã lưu → luôn nhận bản mới nhất. */
const CACHE = "fitkit-v3";
const ASSETS = ["./index.html","./style.css","./icons.js","./firebase-config.js","./media-config.js","./freevideos.js","./video.js","./library.js","./cloud.js","./data.js","./templates.js","./exdb.js","./app.js","./meals.js","./nutrition.js","./coach.js","./ptprofile.js","./pt.js","./manifest.json"];

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method!=="GET" || new URL(req.url).origin!==self.location.origin) return; // Firebase, ảnh... đi thẳng mạng
  e.respondWith(
    fetch(req).then(res=>{ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{}); return res; })
      .catch(()=> caches.match(req))
  );
});

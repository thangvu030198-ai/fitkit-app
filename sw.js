/* FIT KIT — Service Worker tối giản
   Mục đích: cho phép cài đặt ứng dụng (PWA) lên màn hình chính,
   giúp thông báo nhắc nhở hoạt động ổn định hơn trên di động. */
const CACHE = "fitkit-v1";
const ASSETS = ["./index.html", "./style.css", "./app.js", "./data.js", "./manifest.json"];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener("activate", (e)=> self.clients.claim());
self.addEventListener("fetch", (e)=>{
  e.respondWith(
    caches.match(e.request).then(res=> res || fetch(e.request).catch(()=>res))
  );
});

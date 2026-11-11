/* =========================================================================
   TapEasy — ẢNH & CLIP CHO SỰ KIỆN (events-media.js) · window.TapMedia
   Yêu cầu chủ app: "Các phần sự kiện đăng lên luôn phải kèm ảnh hoặc clip và nội dung."

   - Luật nội dung (hàm thuần, chạy được trong Node):
       sự kiện / thử thách : tên ≥ 4 ký tự + mô tả ≥ 80 ký tự + ≥ 1 ảnh hoặc 1 video
       review / bài đăng sau sự kiện : nội dung ≥ 20 ký tự + ≥ 1 ảnh hoặc 1 video
       ảnh ≤ 10 (nén ≤ 1600 px, WebP nếu máy hỗ trợ, không thì JPEG) · video ≤ 60 giây, ≤ 25 MB
   - Xử lý trên máy: nén ảnh bằng canvas (+ ảnh nhỏ 640 px cho thẻ), đọc thời lượng video,
     trích 1 khung hình làm ảnh bìa (poster) bằng canvas.
   - Lưu trữ: demo → IndexedDB "tapeasy_media_v1" (không nhét video vào localStorage),
     firebase → Firebase Storage (qua cloudEvents.putMedia — xem cloud-events.js).
   - Hiển thị: ảnh bìa / clip tự phát KHÔNG TIẾNG khi cuộn tới (IntersectionObserver), tôn trọng
     prefers-reduced-motion, chế độ tiết kiệm dữ liệu (Save-Data, mạng 2G), tuỳ chọn tắt tự phát;
     gallery vuốt (scroll-snap) + trình xem toàn màn hình.
   Nạp SAU cloud-events.js, TRƯỚC events.js (events.js chỉ tra window.TapMedia lúc dùng).
   ========================================================================= */
(function(G){
"use strict";

/* ---------------------------------------------------------------------
   1. LUẬT & HÀM THUẦN
   --------------------------------------------------------------------- */
const LIMITS = {
  maxSide: 1600, thumbSide: 640, posterSide: 1280,
  imgQuality: 0.82, imgMaxBytes: 900 * 1024, thumbMaxBytes: 140 * 1024,
  imgInputBytes: 40 * 1024 * 1024,
  images: 10, videoSec: 60, videoBytes: 25 * 1024 * 1024,
  videos: { event: 2, challenge: 1, review: 1, recap: 2 },
  minTitle: 4, minDesc: { event: 80, challenge: 80 }, minText: { review: 20, recap: 20 }, maxText: 2000,
  reportHide: 3,
};
const KIND_NAME = { event: "sự kiện", challenge: "thử thách", review: "review", recap: "bài đăng" };
const arr = a=> Array.isArray(a) ? a : [];
const textLen = s=> String(s == null ? "" : s).replace(/\s+/g, " ").trim().length;
const nfv = n=>{ try{ return Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 1 }); }catch(e){ return String(Math.round(n * 10) / 10); } };
function fmtBytes(n){ n = Number(n) || 0; return n >= 1048576 ? nfv(Math.round(n / 104857.6) / 10) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
function fmtDur(s){ s = Math.max(0, Math.round(Number(s) || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
/* Chỉ chấp nhận nguồn an toàn: https, ảnh/video trong IndexedDB (idb:), ảnh mẫu vẽ SVG (art:), data:image, blob: (xem trước khi chưa lưu) */
function isSafeSrc(s){ s = String(s || ""); return /^https:\/\/[^\s"'<>]+$/i.test(s) || /^idb:[\w\-]+$/.test(s) || /^art:[\w\-]+$/.test(s) || /^data:image\/(jpeg|png|webp|svg\+xml)[;,]/.test(s) || /^blob:[^\s"'<>]+$/.test(s); }
function normMedia(list){
  return arr(list).filter(m=> m && (m.kind === "image" || m.kind === "video") && isSafeSrc(m.src)).slice(0, 24)
    .map((m, i)=> Object.assign({}, m, { id: String(m.id || ("m" + i)) }));
}
/* Ảnh/clip của một tài liệu (tương thích dữ liệu cũ: review.photos[], event.cover URL) */
function mediaOf(doc){
  doc = doc || {};
  let m = normMedia(doc.media);
  if(!m.length && Array.isArray(doc.photos)) m = doc.photos.filter(p=> typeof p === "string" && isSafeSrc(p)).map((p, i)=> ({ id: "ph" + i, kind: "image", src: p }));
  if(!m.length && typeof doc.cover === "string" && /^https:\/\//.test(doc.cover)) m = [{ id: "cv", kind: "image", src: doc.cover }];
  return m;
}
function coverOf(doc){ const m = mediaOf(doc); return m.find(x=> doc && doc.coverId && x.id === doc.coverId) || m[0] || null; }
function counts(list){ const m = arr(list).filter(Boolean); const images = m.filter(x=> x.kind === "image").length, videos = m.filter(x=> x.kind === "video").length; return { images, videos, total: images + videos }; }
/** URL https dùng làm "cover" (trường cũ — module khác vẫn đọc ev.cover): ảnh bìa hoặc poster của clip bìa */
function coverUrl(doc){ const c = coverOf(doc); if(!c) return ""; const u = c.kind === "video" ? (c.poster || c.thumb || "") : (c.src || ""); return /^https:\/\//.test(u) ? u : ""; }

/**
 * Kiểm tra nội dung trước khi đăng.
 * kind: "event" | "challenge" | "review" | "recap" (bài đăng sau sự kiện của BTC)
 * → { ok, errors:[{ field:"title"|"desc"|"text"|"stars"|"media", msg }] }  (tiếng Việt, thân thiện)
 */
function validate(kind, doc){
  doc = doc || {};
  const E = [], add = (field, msg)=> E.push({ field, msg });
  const isPost = kind === "review" || kind === "recap";
  const name = KIND_NAME[kind] || "sự kiện";
  if(!isPost){
    const tl = textLen(doc.title);
    if(tl < LIMITS.minTitle) add("title", `Tên ${name} cần ít nhất ${LIMITS.minTitle} ký tự.`);
    const need = LIMITS.minDesc[kind] || 80, dl = textLen(doc.desc);
    if(dl < need) add("desc", `Mô tả ${name} cần ít nhất ${need} ký tự (hiện có ${dl}) — nêu rõ lịch trình, ai phù hợp, quà/quyền lợi và lưu ý an toàn.`);
  } else {
    if(kind === "review"){ const s = Number(doc.stars); if(!(s >= 1 && s <= 5)) add("stars", "Chọn số sao từ 1 đến 5."); }
    const need = LIMITS.minText[kind] || 20, tl = textLen(doc.text);
    if(tl < need) add("text", kind === "review"
      ? `Cảm nhận cần ít nhất ${need} ký tự (hiện có ${tl}) — chia sẻ điều bạn thích hoặc điều ban tổ chức nên cải thiện.`
      : `Nội dung bài đăng cần ít nhất ${need} ký tự (hiện có ${tl}) — kể lại khoảnh khắc, cảm ơn người tham gia, hẹn lần sau.`);
    else if(tl > LIMITS.maxText) add("text", `Nội dung tối đa ${nfv(LIMITS.maxText)} ký tự (hiện có ${nfv(tl)}).`);
  }
  const raw = arr(doc.media).filter(Boolean);
  const pending = raw.filter(m=> m.pending).length;
  const media = normMedia(raw.filter(m=> !m.pending));
  const c = counts(media);
  if(pending) add("media", "Ảnh/video đang được xử lý — đợi vài giây rồi đăng nhé.");
  else if(!c.total) add("media", isPost ? "Thêm ít nhất 1 ảnh hoặc 1 video khoảnh khắc của bạn." : `Thêm ít nhất 1 ảnh hoặc 1 video cho ${name} — có hình ảnh mọi người dễ hình dung và đăng ký nhiều hơn.`);
  if(c.images > LIMITS.images) add("media", `Tối đa ${LIMITS.images} ảnh (đang có ${c.images}) — bỏ bớt ảnh nhé.`);
  const vmax = LIMITS.videos[kind] != null ? LIMITS.videos[kind] : 1;
  if(c.videos > vmax) add("media", `Tối đa ${vmax} video (đang có ${c.videos}).`);
  media.forEach((m, i)=>{
    if(m.kind !== "video") return;
    if(Number(m.dur) > LIMITS.videoSec + 0.5) add("media", `Video ${i + 1} dài ${fmtDur(m.dur)} — tối đa ${LIMITS.videoSec} giây.`);
    if(Number(m.size) > LIMITS.videoBytes) add("media", `Video ${i + 1} nặng ${fmtBytes(m.size)} — tối đa ${fmtBytes(LIMITS.videoBytes)}.`);
  });
  return { ok: !E.length, errors: E };
}
/* Ảnh Pexels (giấy phép Pexels: miễn phí, dùng thương mại, không bắt buộc ghi nguồn — app vẫn ghi credit) */
const pexels = (id, by, alt)=> ({ id: "px" + id, kind: "image", alt: alt || "",
  src: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`,
  thumb: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=640`,
  credit: { by: by || "", site: "Pexels", url: `https://www.pexels.com/photo/${id}/` } });
const pexelsVideo = (id, file, dur, alt)=> ({ id: "pxv" + id, kind: "video", alt: alt || "", dur,
  src: `https://videos.pexels.com/video-files/${id}/${file}`,
  poster: `https://images.pexels.com/videos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1280`,
  thumb: `https://images.pexels.com/videos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=640`,
  credit: { by: "", site: "Pexels", url: `https://www.pexels.com/video/${id}/` } });
const newId = (p)=> (p || "m") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const extOf = mime=> /webp/.test(mime) ? "webp" : /png/.test(mime) ? "png" : /jpe?g/.test(mime) ? "jpg" : /webm/.test(mime) ? "webm" : /quicktime/.test(mime) ? "mov" : /mp4|m4v/.test(mime) ? "mp4" : "bin";
/** Bài cộng đồng bị ẩn: kiểm duyệt ẩn, hoặc ≥ 3 báo cáo mà chưa được kiểm duyệt giữ lại */
/* tự ẩn theo trọng số báo cáo (tài khoản < 3 ngày tuổi = 0 — xem cloud-events.js) */
const isHidden = p=> !!p && (p.hidden === true || (!p.modOk && (p.reportWeight != null ? Number(p.reportWeight) || 0 : Number(p.reportCount) || 0) >= LIMITS.reportHide));

const TapMedia = { LIMITS, textLen, fmtBytes, fmtDur, isSafeSrc, normMedia, mediaOf, coverOf, coverUrl, counts, validate, pexels, pexelsVideo, newId, extOf, isHidden };
G.TapMedia = TapMedia;
if(typeof module !== "undefined" && module.exports) module.exports = TapMedia;
if(typeof document === "undefined" || typeof G.addEventListener !== "function") return;

/* =====================================================================
   PHẦN TRÌNH DUYỆT
   ===================================================================== */
const D = document;
const esc = s=> String(s == null ? "" : s).replace(/[&<>"'`]/g, c=> ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c]));
const icon = n=> `<span class="material-symbols-rounded">${n}</span>`;
const say = (m, ic)=>{ try{ toast(esc(m), ic || "info"); }catch(e){} };
const warn = e=>{ try{ console.warn("[media]", e); }catch(_){} };
const reduceMotion = ()=>{ try{ return !!(G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; } };

/* ---------- icon nét mảnh (tiền tố tm_) ---------- */
function addIcons(){
  try{
    if(typeof FK_LINE === "undefined") return;
    Object.assign(FK_LINE, {
      tm_left: "M15 5l-7 7 7 7", tm_right: "M9 5l7 7-7 7", tm_close: "M6 6l12 12|M18 6 6 18",
      tm_play: "M8 5.5v13l10.5-6.5z", tm_star: "M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.5 9.4l6.6-1z",
      tm_heart: "M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.8 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.4 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z",
      tm_comment: "M4 5h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 17h-9.5L6 20.5V17H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 5z",
      tm_flag: "M5 21V4|M5 4h12l-2.5 4.5L17 13H5", tm_image: "r:3,4,18,16,2.5|c:8.5,9.5,1.6|M21 16l-5-5-9 9",
      tm_video: "r:2.5,6,13,12,2.5|M15.5 10.5 21.5 7v10l-6-3.5", tm_trash: "M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3",
      tm_eye: "M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z|c:12,12,3",
      tm_eye_off: "M3 3l18 18|M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.4.7-1.4 2-2.8 3.3|M6.4 7.6C4.6 8.9 3.2 10.7 2.5 12c1 1.5 4.5 6 9.5 6 1.6 0 3-.4 4.3-1.1|M9.9 9.9a3 3 0 0 0 4.2 4.2",
      tm_shield: "M12 2.5 4 5.5v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10v-6z|M9 12l2 2 4-4",
      tm_expand: "M4 9V4h5|M20 9V4h-5|M4 15v5h5|M20 15v5h-5", tm_send: "M4 12 20 4l-4 16-4-6.5z|M12 13.5 20 4",
      tm_gallery: "r:6,3,15,13,2|M3 7v12a2 2 0 0 0 2 2h12|M9 13l3-3 4 4 2-2 3 3",
      tm_autoplay: "r:3,5,18,14,3|M10 9.5v5l4.5-2.5z", tm_link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    });
  }catch(e){ warn(e); }
}

/* ---------------------------------------------------------------------
   2. INDEXEDDB (bản demo) — ảnh/video lưu dạng Blob, KHÔNG dùng localStorage
   --------------------------------------------------------------------- */
const IDB = (function(){
  const NAME = "tapeasy_media_v1", STORE = "files", mem = new Map();
  /* fix-commerce QC-10: indexedDB.open() có thể KHÔNG BAO GIỜ trả lời (lỗi WebKit/WebView đã biết) → mọi thao tác có hạn chờ.
     Hết hạn: tạm coi IndexedDB không dùng được (usable=false) nhưng vẫn giữ yêu cầu mở — nếu sau đó mở được thì tự dùng lại. */
  const WAIT_MS = 1000;
  let dbp = null, dbReady = null, usable = typeof indexedDB !== "undefined";
  const timed = (p, ms, msg)=> new Promise((res, rej)=>{ let done = false; const t = setTimeout(()=>{ if(!done){ done = true; rej(Object.assign(new Error(msg || "IndexedDB không phản hồi"), { code:"idb-timeout" })); } }, ms);
    p.then(v=>{ if(!done){ done = true; clearTimeout(t); res(v); } }, e=>{ if(!done){ done = true; clearTimeout(t); rej(e); } }); });
  function open(){
    if(dbReady) return Promise.resolve(dbReady);
    if(!dbp){
      dbp = new Promise((res, rej)=>{
        try{
          const r = indexedDB.open(NAME, 1);
          r.onupgradeneeded = ()=>{ if(!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
          r.onsuccess = ()=>{ dbReady = r.result; usable = true; res(r.result); }; r.onerror = ()=> rej(r.error || new Error("IndexedDB")); r.onblocked = ()=> rej(new Error("IndexedDB bị chặn"));
        }catch(e){ rej(e); }
      }).catch(e=>{ dbp = null; usable = false; throw e; });
    }
    return timed(dbp, WAIT_MS, "IndexedDB không phản hồi").catch(e=>{ if(e && e.code === "idb-timeout") usable = false; throw e; });
  }
  function tx(mode, fn){
    return open().then(db=> timed(new Promise((res, rej)=>{
      const t = db.transaction(STORE, mode), st = t.objectStore(STORE); let out;
      const r = fn(st); if(r) r.onsuccess = ()=>{ out = r.result; };
      t.oncomplete = ()=> res(out); t.onerror = t.onabort = ()=> rej(t.error || (r && r.error) || new Error("IndexedDB"));
    }), Math.max(WAIT_MS, 15000), "IndexedDB không phản hồi"));
  }
  const quota = e=> e && (e.name === "QuotaExceededError" || /quota/i.test(String(e.message || "")));
  return {
    get usable(){ return usable; },
    async put(key, blob){
      if(!usable){ mem.set(key, blob); return "mem"; }
      try{ await tx("readwrite", st=> st.put({ blob, type: blob.type, size: blob.size, ts: Date.now() }, key)); return "idb"; }
      catch(e){
        if(quota(e)) throw Object.assign(new Error("Bộ nhớ máy đầy — xoá bớt video/ảnh cũ hoặc giải phóng dung lượng rồi thử lại."), { code: "quota", vi: true });
        if(e && e.code === "idb-timeout"){ mem.set(key, blob); return "mem"; }   // không phản hồi → bộ nhớ tạm (cloudEvents.putMedia báo lỗi "Thử lại")
        try{ const buf = await blob.arrayBuffer(); await tx("readwrite", st=> st.put({ buf, type: blob.type, size: blob.size, ts: Date.now() }, key)); return "idb"; }   // Safari cũ không lưu được Blob
        catch(e2){ warn(e2); mem.set(key, blob); return "mem"; }
      }
    },
    async get(key){
      if(mem.has(key)) return mem.get(key);
      if(!usable) return null;
      try{ const r = await tx("readonly", st=> st.get(key)); if(!r) return null; return r.blob || (r.buf ? new Blob([r.buf], { type: r.type || "" }) : null); }catch(e){ warn(e); return null; }
    },
    async del(key){ mem.delete(key); if(!usable) return; try{ await tx("readwrite", st=> st.delete(key)); }catch(e){ warn(e); } },
    async keys(){ if(!usable) return Array.from(mem.keys()); try{ return (await tx("readonly", st=> st.getAllKeys())) || []; }catch(e){ return Array.from(mem.keys()); } },
    _mem: mem,
  };
})();

/* ---------------------------------------------------------------------
   3. GIẢI NGUỒN + "HYDRATE" phần tử (idb: → object URL), lỗi tải → hiện minh hoạ dự phòng
   --------------------------------------------------------------------- */
const URLS = new Map();
async function resolve(src){
  src = String(src || "");
  if(!src) return "";
  if(src.startsWith("idb:")){
    const k = src.slice(4); if(URLS.has(k)) return URLS.get(k);
    const b = await IDB.get(k); if(!b) return "";
    const u = URL.createObjectURL(b); URLS.set(k, u); return u;
  }
  if(src.startsWith("art:")){ try{ return G.TapEv && typeof G.TapEv.demoPhoto === "function" ? G.TapEv.demoPhoto(src) : ""; }catch(e){ return ""; } }
  return isSafeSrc(src) ? src : "";
}
const direct = s=> /^(https:|data:image|blob:)/.test(String(s || ""));
function hydrate(root){
  root = root || D;
  let list = [];
  try{ list = Array.from(root.querySelectorAll("[data-tm-src]:not([data-tm-h]),[data-tm-poster]:not([data-tm-ph]),video[data-tm-auto]:not([data-tm-io])")); }catch(e){ return; }
  list.forEach(el=>{
    if(el.hasAttribute("data-tm-src") && !el.hasAttribute("data-tm-h")){
      el.setAttribute("data-tm-h", "1");
      resolve(el.getAttribute("data-tm-src")).then(u=>{
        if(!u){ el.classList.add("tm-broken"); return; }
        if(el.tagName === "VIDEO"){ el.dataset.tmUrl = u; if(!el.hasAttribute("data-tm-auto")) el.src = u; else if(INVIEW.has(el)) autoplay(el); }
        else el.src = u;
      }).catch(()=> el.classList.add("tm-broken"));
    }
    if(el.hasAttribute("data-tm-poster") && !el.hasAttribute("data-tm-ph")){
      el.setAttribute("data-tm-ph", "1");
      resolve(el.getAttribute("data-tm-poster")).then(u=>{ if(u) el.setAttribute("poster", u); }).catch(()=>{});
    }
    if(el.tagName === "VIDEO" && el.hasAttribute("data-tm-auto") && !el.hasAttribute("data-tm-io")){ el.setAttribute("data-tm-io", "1"); el.muted = true; el.defaultMuted = true; observe(el); }
  });
}

/* ---------------------------------------------------------------------
   4. TỰ PHÁT CLIP KHÔNG TIẾNG KHI CUỘN TỚI
   --------------------------------------------------------------------- */
function connInfo(){ try{ return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null; }catch(e){ return null; } }
function prefAuto(){ try{ const t = (typeof state !== "undefined" && state && state.tapEvents) || {}; return t.mediaAutoplay !== false; }catch(e){ return true; } }
function setPrefAuto(on){ try{ if(typeof state !== "undefined" && state){ state.tapEvents = state.tapEvents || {}; state.tapEvents.mediaAutoplay = !!on; if(typeof saveState === "function") saveState(); } }catch(e){ warn(e); } if(!on) pauseAll(); else D.querySelectorAll("video[data-tm-auto]").forEach(v=>{ if(INVIEW.has(v)) autoplay(v); }); }
/** "" = được tự phát; ngược lại là lý do không tự phát */
function autoplayBlock(){
  if(!prefAuto()) return "off";
  if(reduceMotion()) return "motion";
  const c = connInfo(); if(c && (c.saveData || /(^|-)2g$/.test(String(c.effectiveType || "")))) return "data";
  try{ if(D.documentElement.classList.contains("lowfx")) return "lowfx"; }catch(e){}
  return "";
}
const INVIEW = new WeakSet();
let io = null;
function observe(v){
  if(!("IntersectionObserver" in G)) return;
  if(!io) io = new IntersectionObserver(entries=> entries.forEach(en=>{
    const v = en.target; if(!v.isConnected){ io.unobserve(v); return; }
    const on = en.isIntersecting && en.intersectionRatio >= 0.6;
    if(on){ INVIEW.add(v); autoplay(v); } else { INVIEW.delete(v); if(!v.paused) try{ v.pause(); }catch(e){} }
  }), { threshold: [0, 0.6, 1] });
  io.observe(v);
}
function autoplay(v){
  if(autoplayBlock() || D.hidden) return;
  const u = v.dataset.tmUrl; if(!u) return;
  if(!v.getAttribute("src")){ v.preload = "auto"; v.src = u; }
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true;
  D.querySelectorAll("video[data-tm-auto]").forEach(o=>{ if(o !== v && !o.paused) try{ o.pause(); }catch(e){} });   // mỗi lúc 1 clip
  try{ const p = v.play(); if(p && p.catch) p.catch(()=> v.classList.add("tm-noauto")); }catch(e){}
}
function pauseAll(){ D.querySelectorAll("video[data-tm-auto]").forEach(v=>{ try{ v.pause(); }catch(e){} }); }
D.addEventListener("visibilitychange", ()=>{ if(D.hidden) pauseAll(); });
/* trạng thái phát → ẩn/hiện nút play trên ảnh bìa (sự kiện media không nổi bọt → bắt ở pha capture) */
["playing", "pause", "ended"].forEach(t=> D.addEventListener(t, e=>{ const v = e.target; if(!v || v.tagName !== "VIDEO") return; const box = v.closest(".tm-cover, .tm-slide"); if(box) box.classList.toggle("playing", t === "playing"); }, true));
D.addEventListener("error", e=>{ const t = e.target; if(t && t.classList && (t.classList.contains("tm-img") || t.classList.contains("tm-vid"))) t.classList.add("tm-broken"); }, true);

/* ---------------------------------------------------------------------
   5. HTML: ảnh bìa thẻ · gallery vuốt · trình xem toàn màn hình
   --------------------------------------------------------------------- */
const GAL = new Map(); let _gid = 0;
function regGal(media){ const id = "g" + (++_gid); GAL.set(id, media); if(GAL.size > 300) GAL.delete(GAL.keys().next().value); return id; }
function imgHTML(m, o){
  o = o || {}; const s = (o.thumb && m.thumb) || m.src;
  return `<img class="tm-img" ${direct(s) ? `src="${esc(s)}"` : `data-tm-src="${esc(s)}"`} alt="${esc(m.alt || o.alt || "")}"${o.eager ? "" : ` loading="lazy"`} decoding="async" draggable="false">`;
}
function vidHTML(m, o){
  o = o || {}; const p = m.poster || m.thumb || "";
  const pa = p ? (direct(p) ? ` poster="${esc(p)}"` : ` data-tm-poster="${esc(p)}"`) : "";
  return `<video class="tm-vid" data-tm-src="${esc(m.src)}"${pa} playsinline webkit-playsinline preload="${o.auto ? "none" : "metadata"}"${o.auto ? " data-tm-auto muted loop" : ""}${o.controls ? " controls" : ""} aria-label="${esc(m.alt || "Video")}"></video>`;
}
function creditHTML(m){
  const c = m && m.credit; if(!c || !(c.by || c.site)) return "";
  const who = esc(c.by || c.site), site = c.by && c.site ? " / " + esc(c.site) : "";
  return `${m.kind === "video" ? "Video" : "Ảnh"}: ${c.url && /^https:\/\//.test(c.url) ? `<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${who}</a>` : who}${site}`;
}
/** Ảnh bìa cho thẻ (ảnh nhỏ 640 px, clip tự phát không tiếng) — minh hoạ dự phòng nằm dưới, hiện khi chưa có/lỗi ảnh */
function coverHTML(doc, o){
  o = o || {};
  const media = mediaOf(doc), c = coverOf(doc), n = counts(media);
  let inner = "";
  if(c) inner = c.kind === "video" ? vidHTML(c, { auto: o.auto !== false }) + `<span class="tm-play" aria-hidden="true">${icon("tm_play")}</span>` : imgHTML(c, { thumb: o.thumb !== false, alt: o.alt });
  const badge = o.badges === false ? "" : (n.total > 1 || n.videos) ? `<span class="tm-cnt" aria-label="${n.images} ảnh, ${n.videos} video">${n.images ? icon("tm_image") + n.images : ""}${n.videos ? `${icon("tm_video")}${c && c.kind === "video" && c.dur ? fmtDur(c.dur) : n.videos}` : ""}</span>` : "";
  return `<div class="tm-cover${c && c.kind === "video" ? " is-video" : ""}"><div class="tm-fb" aria-hidden="true">${o.fallback || ""}</div>${inner}${badge}</div>`;
}
/** Gallery vuốt ngang (scroll-snap). o: { fallback, ratio:"16/10", controls:true, auto:false (tự phát clip đầu), thumb:false, credits:true, open:true, label } */
function galleryHTML(list, o){
  o = o || {};
  const media = normMedia(list), n = media.length, ratio = o.ratio || "16/10";
  if(!n) return o.fallback ? `<div class="tm-gal empty" style="--tm-ratio:${esc(ratio)}"><div class="tm-fb" aria-hidden="true">${o.fallback}</div></div>` : "";
  const gid = regGal(media);
  const slides = media.map((m, i)=> `<figure class="tm-slide" data-i="${i}" role="group" aria-roledescription="trang chiếu" aria-label="${i + 1}/${n}${m.kind === "video" ? " · video" : ""}">
      <div class="tm-fb" aria-hidden="true">${o.fallback || ""}</div>
      ${m.kind === "video" ? vidHTML(m, { auto: !!o.auto && i === 0, controls: o.controls !== false }) + (o.controls === false ? `<span class="tm-play" aria-hidden="true">${icon("tm_play")}</span>` : "") : imgHTML(m, { thumb: !!o.thumb, eager: i === 0 && !!o.eager })}
      ${o.open !== false ? (m.kind === "image" ? `<button type="button" class="tm-zoom" data-tm-open="${i}" aria-label="Xem ảnh ${i + 1} toàn màn hình"></button>` : `<button type="button" class="tm-full" data-tm-open="${i}" aria-label="Mở video ${i + 1} toàn màn hình">${icon("tm_expand")}</button>`) : ""}
      ${o.credits !== false && creditHTML(m) ? `<figcaption class="tm-credit">${creditHTML(m)}</figcaption>` : ""}
    </figure>`).join("");
  return `<div class="tm-gal" data-tm-gal="${gid}" style="--tm-ratio:${esc(ratio)}">
    <div class="tm-track" tabindex="0" aria-label="${esc(o.label || "Ảnh & video")}: ${n} mục${n > 1 ? ", vuốt ngang để xem" : ""}">${slides}</div>
    ${n > 1 ? `<span class="tm-count" aria-hidden="true">1/${n}</span><div class="tm-dots" aria-hidden="true">${media.map((m, i)=> `<i class="${i === 0 ? "on" : ""}${m.kind === "video" ? " v" : ""}"></i>`).join("")}</div>
      <button type="button" class="tm-nav prev" data-tm-nav="-1" aria-label="Mục trước">${icon("tm_left")}</button><button type="button" class="tm-nav next" data-tm-nav="1" aria-label="Mục sau">${icon("tm_right")}</button>` : ""}
  </div>`;
}
/* cập nhật chấm/đếm + dừng clip đã trượt khỏi màn hình */
const _galT = new WeakMap();
function onTrackScroll(tr){
  if(_galT.get(tr)) return;
  _galT.set(tr, true);
  (G.requestAnimationFrame || setTimeout)(()=>{
    _galT.delete(tr);
    const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)), box = tr.parentNode;
    const slides = tr.children, n = slides.length;
    const cnt = box && box.querySelector(":scope > .tm-count, :scope > .tm-lb-bar .tm-lb-n"); if(cnt) cnt.textContent = `${Math.min(n, i + 1)}/${n}`;
    if(box) box.querySelectorAll(":scope > .tm-dots i").forEach((d, k)=> d.classList.toggle("on", k === i));
    Array.from(slides).forEach((s, k)=>{ if(k !== i) s.querySelectorAll("video").forEach(v=>{ if(!v.paused) try{ v.pause(); }catch(e){} }); });
    if(box && box.classList.contains("tm-lb")){ const c = box.querySelector(".tm-lb-cap"); const m = LB && LB.media[i]; if(c) c.innerHTML = m ? creditHTML(m) : ""; const nEl = box.querySelector(".tm-lb-n"); if(nEl) nEl.textContent = `${i + 1}/${n}`; }
  });
}
D.addEventListener("scroll", e=>{ const t = e.target; if(t && t.classList && (t.classList.contains("tm-track") || t.classList.contains("tm-lb-track"))) onTrackScroll(t); }, true);
function go(tr, dir){ if(!tr) return; tr.scrollBy({ left: dir * tr.clientWidth, behavior: reduceMotion() ? "auto" : "smooth" }); }

/* ---------- Trình xem toàn màn hình ---------- */
let LB = null;
function openLightbox(list, start){
  closeLightbox();
  const media = normMedia(list), n = media.length; if(!n) return;
  start = Math.max(0, Math.min(n - 1, Number(start) || 0));
  const el = D.createElement("div");
  el.className = "tm-lb"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Xem ảnh và video");
  el.innerHTML = `<div class="tm-lb-bar"><span class="tm-lb-n" aria-live="polite">${start + 1}/${n}</span><button type="button" class="tm-lb-x" data-tm-lb="close" aria-label="Đóng">${icon("tm_close")}</button></div>
    <div class="tm-lb-track tm-track-lb">${media.map((m, i)=> `<figure class="tm-lb-slide" data-i="${i}">${m.kind === "video" ? vidHTML(m, { controls: true }) : imgHTML(m, { eager: Math.abs(i - start) <= 1 })}</figure>`).join("")}</div>
    <div class="tm-lb-cap">${creditHTML(media[start])}</div>
    ${n > 1 ? `<button type="button" class="tm-nav prev" data-tm-lbnav="-1" aria-label="Mục trước">${icon("tm_left")}</button><button type="button" class="tm-nav next" data-tm-lbnav="1" aria-label="Mục sau">${icon("tm_right")}</button>` : ""}`;
  D.body.appendChild(el);
  LB = { el, media, prev: D.activeElement };
  const tr = el.querySelector(".tm-lb-track");
  tr.scrollLeft = start * tr.clientWidth;
  (G.requestAnimationFrame || setTimeout)(()=>{ tr.scrollLeft = start * tr.clientWidth; });
  hydrate(el);
  try{ el.querySelector(".tm-lb-x").focus({ preventScroll: true }); }catch(e){}
}
function closeLightbox(){
  if(!LB) return false;
  const l = LB; LB = null;
  l.el.querySelectorAll("video").forEach(v=>{ try{ v.pause(); }catch(e){} });
  l.el.remove();
  try{ l.prev && l.prev.focus && l.prev.focus({ preventScroll: true }); }catch(e){}
  return true;
}
D.addEventListener("click", e=>{
  const t = e.target && e.target.closest ? e.target : null; if(!t) return;
  const op = t.closest("[data-tm-open]");
  if(op){ const g = op.closest("[data-tm-gal]"); const m = g && GAL.get(g.dataset.tmGal); if(m){ e.preventDefault(); e.stopPropagation(); openLightbox(m, Number(op.dataset.tmOpen) || 0); } return; }
  const nav = t.closest("[data-tm-nav]"); if(nav){ e.preventDefault(); e.stopPropagation(); go(nav.parentNode.querySelector(".tm-track"), Number(nav.dataset.tmNav)); return; }
  const ln = t.closest("[data-tm-lbnav]"); if(ln){ e.preventDefault(); go(LB && LB.el.querySelector(".tm-lb-track"), Number(ln.dataset.tmLbnav)); return; }
  if(t.closest("[data-tm-lb='close']")){ e.preventDefault(); closeLightbox(); return; }
  if(LB && t === LB.el){ closeLightbox(); }
}, true);
D.addEventListener("keydown", e=>{
  if(!LB) return;
  if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); closeLightbox(); }
  else if(e.key === "ArrowRight" || e.key === "ArrowLeft"){ e.preventDefault(); go(LB.el.querySelector(".tm-lb-track"), e.key === "ArrowRight" ? 1 : -1); }
  else if(e.key === "Tab"){ const f = Array.from(LB.el.querySelectorAll("button, video[controls], a[href]")); if(f.length){ const i = f.indexOf(D.activeElement); if(e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); } else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); } } }
}, true);

/* ---------------------------------------------------------------------
   6. XỬ LÝ TỆP: nén ảnh · đọc video + trích khung làm poster
   --------------------------------------------------------------------- */
const toBlob = (cv, type, q)=> new Promise(res=>{ try{ cv.toBlob(b=> res(b), type, q); }catch(e){ res(null); } });
let _webp = null;
async function webpOK(){
  if(_webp !== null) return _webp;
  try{ const c = D.createElement("canvas"); c.width = c.height = 2; const b = await toBlob(c, "image/webp", 0.8); _webp = !!(b && b.type === "image/webp"); }catch(e){ _webp = false; }
  return _webp;
}
async function encode(src, w, h, maxSide, q, maxBytes){
  const s = Math.min(1, maxSide / Math.max(w, h)), W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
  const cv = D.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d");
  const type = (await webpOK()) ? "image/webp" : "image/jpeg";
  if(type === "image/jpeg"){ cx.fillStyle = "#fff"; cx.fillRect(0, 0, W, H); }
  cx.imageSmoothingQuality = "high"; cx.drawImage(src, 0, 0, W, H);
  let qq = q, b = await toBlob(cv, type, qq);
  while(b && b.size > maxBytes && qq > 0.5){ qq = Math.round((qq - 0.08) * 100) / 100; b = await toBlob(cv, type, qq); }
  if(!b) throw new Error("Máy không nén được ảnh này.");
  return { blob: b, w: W, h: H, cv };
}
async function decodeImage(file){
  if(typeof G.createImageBitmap === "function"){ try{ return await G.createImageBitmap(file, { imageOrientation: "from-image" }); }catch(e){ try{ return await G.createImageBitmap(file); }catch(_){} } }
  return new Promise((res, rej)=>{
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = ()=>{ res(im); setTimeout(()=> URL.revokeObjectURL(u), 2000); };
    im.onerror = ()=>{ URL.revokeObjectURL(u); rej(new Error("x")); };
    im.src = u;
  });
}
async function processImage(file){
  const name = String(file && file.name || "");
  if(!file || (!/^image\//.test(file.type || "") && !/\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(name))) throw new Error(`"${name || "Tệp"}" không phải ảnh.`);
  if(file.size > LIMITS.imgInputBytes) throw new Error(`Ảnh "${name}" nặng ${fmtBytes(file.size)} — chọn ảnh dưới 40 MB.`);
  let bmp;
  try{ bmp = await decodeImage(file); }
  catch(e){ throw new Error(/heic|heif/i.test(name + file.type) ? `Máy này chưa đọc được ảnh HEIC "${name}" — chọn ảnh JPG/PNG (iPhone: Cài đặt → Camera → Định dạng → "Tương thích nhất").` : `Không đọc được ảnh "${name}" — thử ảnh JPG/PNG khác.`); }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  if(!w || !h) throw new Error(`Ảnh "${name}" bị lỗi kích thước.`);
  const full = await encode(bmp, w, h, LIMITS.maxSide, LIMITS.imgQuality, LIMITS.imgMaxBytes);
  const th = await encode(full.cv, full.w, full.h, LIMITS.thumbSide, 0.76, LIMITS.thumbMaxBytes);
  try{ bmp.close && bmp.close(); }catch(e){}
  return { kind: "image", blob: full.blob, thumbBlob: th.blob, w: full.w, h: full.h, mime: full.blob.type, size: full.blob.size };
}
function processVideo(file){
  const name = String(file && file.name || "");
  if(!file || (!/^video\//.test(file.type || "") && !/\.(mp4|m4v|mov|webm|3gp)$/i.test(name))) return Promise.reject(new Error(`"${name || "Tệp"}" không phải video.`));
  if(file.size > LIMITS.videoBytes) return Promise.reject(new Error(`Video "${name}" nặng ${fmtBytes(file.size)} — tối đa ${fmtBytes(LIMITS.videoBytes)}. Hãy quay ở 720p hoặc cắt ngắn lại.`));
  return new Promise((resolveP, rejectP)=>{
    const url = URL.createObjectURL(file), v = D.createElement("video");
    let done = false, dur = NaN, fixing = false, grabbing = false, t0 = 0;
    const finish = (err, val)=>{ if(done) return; done = true; clearTimeout(t0); try{ v.removeAttribute("src"); v.load(); }catch(e){} URL.revokeObjectURL(url); err ? rejectP(err) : resolveP(val); };
    t0 = setTimeout(()=> finish(new Error(`Đọc video "${name}" quá lâu — thử video MP4 khác.`)), 25000);
    v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.preload = "auto";
    const result = poster=> ({ kind: "video", blob: file, dur: Math.round(dur * 10) / 10, w: v.videoWidth || 0, h: v.videoHeight || 0, posterBlob: poster ? poster.full : null, thumbBlob: poster ? poster.thumb : null, mime: file.type || (/\.webm$/i.test(name) ? "video/webm" : /\.mov$/i.test(name) ? "video/quicktime" : "video/mp4"), size: file.size });
    const check = ()=>{
      if(!(dur > 0)) return finish(new Error(`Không đọc được thời lượng video "${name}".`));
      if(dur > LIMITS.videoSec + 0.5) return finish(new Error(`Video "${name}" dài ${fmtDur(dur)} — tối đa ${LIMITS.videoSec} giây. Hãy cắt ngắn trong app Ảnh của máy rồi chọn lại.`));
      grab();
    };
    const grab = ()=>{
      if(grabbing) return; grabbing = true;
      let fired = false;
      const onSeek = async ()=>{
        if(fired) return; fired = true; v.removeEventListener("seeked", onSeek);
        let poster = null;
        try{ const w = v.videoWidth, h = v.videoHeight; if(w && h){ const full = await encode(v, w, h, LIMITS.posterSide, 0.8, 400 * 1024); const thumb = await encode(full.cv, full.w, full.h, LIMITS.thumbSide, 0.76, LIMITS.thumbMaxBytes); poster = { full: full.blob, thumb: thumb.blob }; } }catch(e){ warn(e); }
        finish(null, result(poster));
      };
      v.addEventListener("seeked", onSeek);
      try{ v.currentTime = Math.max(0.05, Math.min(1, dur * 0.25)); }catch(e){}
      setTimeout(()=>{ if(fired) return; const p = v.play && v.play(); if(p && p.then) p.then(()=>{ v.pause(); }).catch(()=>{}); setTimeout(()=>{ if(!fired) onSeek(); }, 1500); }, 3000);   // iOS: cần phát để có khung hình
    };
    v.addEventListener("loadedmetadata", ()=>{
      dur = v.duration;
      if(!isFinite(dur)){ fixing = true; try{ v.currentTime = 1e7; }catch(e){} return; }   // WebM thiếu thời lượng
      check();
    });
    v.addEventListener("durationchange", ()=>{ if(fixing && isFinite(v.duration) && v.duration > 0){ fixing = false; dur = v.duration; try{ v.currentTime = 0; }catch(e){} check(); } });
    v.addEventListener("error", ()=> finish(new Error(`Định dạng video "${name}" chưa được hỗ trợ trên máy này — hãy chọn MP4 (H.264).`)));
    v.src = url;
  });
}
/* Thêm bằng đường dẫn https (quản trị): ảnh hoặc video .mp4/.webm — đọc thời lượng video */
function probeUrl(url){
  url = String(url || "").trim();
  if(!/^https:\/\/[^\s"'<>]+$/i.test(url)) return Promise.reject(new Error("Đường dẫn phải bắt đầu bằng https:// và không chứa khoảng trắng."));
  const isVid = /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(url) || /videos\.pexels\.com\/video-files/.test(url);
  return new Promise((res, rej)=>{
    let t0 = setTimeout(()=> rej(new Error("Không tải được tệp từ đường dẫn này (quá thời gian).")), 20000);
    if(isVid){
      const v = D.createElement("video"); v.preload = "metadata"; v.muted = true;
      v.onloadedmetadata = ()=>{ clearTimeout(t0); const d = v.duration; v.removeAttribute("src"); try{ v.load(); }catch(e){}
        if(isFinite(d) && d > LIMITS.videoSec + 0.5) rej(new Error(`Video dài ${fmtDur(d)} — tối đa ${LIMITS.videoSec} giây.`)); else res({ kind: "video", src: url, dur: isFinite(d) ? Math.round(d * 10) / 10 : 0 }); };
      v.onerror = ()=>{ clearTimeout(t0); rej(new Error("Không mở được video từ đường dẫn này.")); };
      v.src = url;
    } else {
      const im = new Image();
      im.onload = ()=>{ clearTimeout(t0); res({ kind: "image", src: url, w: im.naturalWidth, h: im.naturalHeight }); };
      im.onerror = ()=>{ clearTimeout(t0); rej(new Error("Không mở được ảnh từ đường dẫn này.")); };
      im.src = url;
    }
  });
}

/* ---------------------------------------------------------------------
   7. TRÌNH CHỌN ẢNH/CLIP cho form (thêm · sắp xếp · chọn ảnh bìa · bỏ)
   --------------------------------------------------------------------- */
let _eid = 0; const EDITORS = new Set();
function createEditor(opt){
  opt = Object.assign({ kind: "event", media: [], coverId: "", label: "Ảnh & video", allowUrl: false, required: true, onChange: null }, opt || {});
  for(const e of Array.from(EDITORS)) if(e.el() && !e.el().isConnected){ e.destroy(); }   // dọn trình chọn của form đã đóng
  const id = "tm-ed-" + (++_eid);
  const vmax = LIMITS.videos[opt.kind] != null ? LIMITS.videos[opt.kind] : 1;
  const S = { items: normMedia(opt.media), coverId: String(opt.coverId || ""), sel: -1, removed: [], busy: 0, root: null, urls: [] };
  if(!S.items.some(m=> m.id === S.coverId)) S.coverId = S.items[0] ? S.items[0].id : "";
  const q = s=> S.root ? S.root.querySelector(s) : null;
  const objURL = b=>{ const u = URL.createObjectURL(b); S.urls.push(u); return u; };
  const msg = (t, bad)=>{ const m = q(".tm-ed-msg"); if(m){ m.textContent = t || ""; m.classList.toggle("bad", !!bad); } };
  const changed = ()=>{ try{ opt.onChange && opt.onChange(api); }catch(e){ warn(e); } };

  function hint(){ return `1–${LIMITS.images} ảnh (tự nén ≤ ${LIMITS.maxSide} px)${vmax ? ` · ${vmax > 1 ? "tối đa " + vmax + " video" : "1 video"} ≤ ${LIMITS.videoSec} giây, ≤ ${fmtBytes(LIMITS.videoBytes)}` : ""}. Chạm vào ô để đổi thứ tự hoặc chọn ảnh bìa.`; }
  function html(){
    return `<div class="tm-ed" id="${id}" data-kind="${esc(opt.kind)}">
      <div class="tm-ed-head"><div><b>${esc(opt.label)}</b>${opt.required ? ` <span class="tm-req">Bắt buộc</span>` : ""}</div><small>${esc(hint())}</small></div>
      <div class="tm-ed-grid"></div>
      <div class="tm-ed-bar" hidden></div>
      <div class="tm-ed-add">
        <label class="btn btn-outline tm-add">${icon("photo_camera")}<span>Thêm ảnh</span><input type="file" accept="image/*" multiple data-tm-in="image" hidden></label>
        ${vmax ? `<label class="btn btn-outline tm-add">${icon("videocam")}<span>Thêm video</span><input type="file" accept="video/mp4,video/quicktime,video/webm,video/*" data-tm-in="video" hidden></label>` : ""}
      </div>
      ${opt.allowUrl ? `<details class="tm-url"><summary>${icon("tm_link")}Thêm bằng đường dẫn https (ảnh Pexels/Unsplash, video .mp4)</summary>
        <div class="field"><label for="${id}-u">Đường dẫn</label><input id="${id}-u" type="url" inputmode="url" maxlength="400" placeholder="https://images.pexels.com/photos/…"></div>
        <div class="field"><label for="${id}-c">Ghi nguồn (tác giả / trang)</label><input id="${id}-c" type="text" maxlength="80" placeholder="VD: Nguyễn An / Pexels"></div>
        <button type="button" class="btn btn-outline btn-sm" data-tm-act="url">${icon("te_plus")}Thêm</button></details>` : ""}
      <p class="tm-ed-msg" role="status" aria-live="polite"></p>
    </div>`;
  }
  function tileHTML(m, i){
    const sel = i === S.sel, cover = m.id === S.coverId, label = `${m.kind === "video" ? "Video" : "Ảnh"} ${i + 1}${cover ? ", ảnh bìa" : ""}${m.pending ? ", đang xử lý" : ""}`;
    const thumb = m.kind === "video" ? (m.thumb || m.poster) : (m.thumb || m.src);
    return `<button type="button" class="tm-tile${sel ? " sel" : ""}${cover ? " cover" : ""}${m.pending ? " busy" : ""}" data-i="${i}" aria-pressed="${sel}" aria-label="${esc(label)}">
      ${m.pending ? `<span class="tm-spin" aria-hidden="true"></span>` : thumb ? imgHTML({ src: thumb }, {}) : `<span class="tm-tile-v">${icon("videocam")}</span>`}
      ${m.kind === "video" && !m.pending ? `<span class="tm-tile-dur">${icon("tm_play")}${m.dur ? fmtDur(m.dur) : "video"}</span>` : ""}
      ${cover && !m.pending ? `<span class="tm-tile-cover">${icon("tm_star")}Bìa</span>` : ""}
      <span class="tm-tile-n" aria-hidden="true">${i + 1}</span>
    </button>`;
  }
  function render(){
    if(!S.root) return;
    const grid = q(".tm-ed-grid"), bar = q(".tm-ed-bar"), n = S.items.length;
    grid.innerHTML = n ? S.items.map(tileHTML).join("") : `<div class="tm-ed-empty">${icon("tm_gallery")}<span>Chưa có ảnh/video nào${opt.required ? " — cần ít nhất 1 để đăng" : ""}.</span></div>`;
    if(S.sel >= n) S.sel = -1;
    const m = S.items[S.sel];
    if(!m || m.pending){ bar.hidden = true; bar.innerHTML = ""; }
    else {
      const cover = m.id === S.coverId;
      bar.hidden = false;
      bar.innerHTML = `<span class="tm-ed-sel">${m.kind === "video" ? "Video" : "Ảnh"} ${S.sel + 1}/${n}</span>
        <button type="button" class="btn btn-sm ${cover ? "btn-primary" : "btn-outline"}" data-tm-act="cover" aria-pressed="${cover}">${icon("tm_star")}${cover ? "Đang là ảnh bìa" : "Đặt làm bìa"}</button>
        <button type="button" class="icon-btn" data-tm-act="left" aria-label="Chuyển lên trước"${S.sel === 0 ? " disabled" : ""}>${icon("tm_left")}</button>
        <button type="button" class="icon-btn" data-tm-act="right" aria-label="Chuyển ra sau"${S.sel === n - 1 ? " disabled" : ""}>${icon("tm_right")}</button>
        <button type="button" class="icon-btn" data-tm-act="del" aria-label="Bỏ ${m.kind === "video" ? "video" : "ảnh"} ${S.sel + 1}">${icon("tm_trash")}</button>`;
    }
    const c = counts(S.items.filter(x=> !x.pending));
    const add = S.root.querySelectorAll(".tm-add");
    if(add[0]) add[0].classList.toggle("disabled", c.images >= LIMITS.images);
    if(add[1]) add[1].classList.toggle("disabled", c.videos >= vmax);
    if(n && !S.busy){ const m2 = q(".tm-ed-msg"); if(m2 && !m2.classList.contains("bad")) m2.textContent = `${c.images} ảnh${vmax ? ` · ${c.videos} video` : ""}${S.coverId ? " · đã chọn ảnh bìa" : ""}`; }
    if(n) S.root.classList.remove("tm-invalid"), S.root.removeAttribute("aria-invalid");
    hydrate(S.root);
  }
  async function addFiles(files, kind){
    files = Array.from(files || []);
    for(const f of files){
      const isVid = kind === "video" || /^video\//.test(f.type || "");
      const c = counts(S.items);
      if(isVid && c.videos >= vmax){ msg(vmax ? `Tối đa ${vmax} video cho ${KIND_NAME[opt.kind] || "bài đăng"} — bỏ video cũ trước khi thêm.` : "Mục này chỉ nhận ảnh.", true); continue; }
      if(!isVid && c.images >= LIMITS.images){ msg(`Tối đa ${LIMITS.images} ảnh — bỏ bớt ảnh trước khi thêm.`, true); break; }
      const it = { id: newId("m"), kind: isVid ? "video" : "image", pending: true, local: true, src: "blob:pending" };
      S.items.push(it); if(!S.coverId) S.coverId = it.id; S.busy++; msg(isVid ? `Đang đọc video "${f.name}"…` : `Đang nén ảnh "${f.name}"…`); render();
      try{
        const r = isVid ? await processVideo(f) : await processImage(f);
        it._blob = r.blob; it._thumbBlob = r.thumbBlob || null; it._posterBlob = r.posterBlob || null;
        Object.assign(it, { pending: false, w: r.w, h: r.h, mime: r.mime, size: r.size, dur: r.dur });
        it.src = objURL(r.blob);
        if(r.thumbBlob) it.thumb = objURL(r.thumbBlob);
        if(r.posterBlob) it.poster = objURL(r.posterBlob);
        msg("");
      }catch(e){
        S.items = S.items.filter(x=> x !== it); if(S.coverId === it.id) S.coverId = S.items[0] ? S.items[0].id : "";
        msg(e.message || "Không thêm được tệp này.", true); say(e.message || "Không thêm được tệp này.", "error");
      }finally{ S.busy--; render(); changed(); }
    }
  }
  function act(a){
    const i = S.sel, m = S.items[i]; if(!m) return;
    if(a === "cover"){ S.coverId = m.id; msg(`Đã chọn ${m.kind === "video" ? "video" : "ảnh"} ${i + 1} làm ảnh bìa.`); }
    else if(a === "left" && i > 0){ S.items.splice(i - 1, 0, S.items.splice(i, 1)[0]); S.sel = i - 1; }
    else if(a === "right" && i < S.items.length - 1){ S.items.splice(i + 1, 0, S.items.splice(i, 1)[0]); S.sel = i + 1; }
    else if(a === "del"){
      S.items.splice(i, 1);
      if(!m.local) [m.src, m.thumb, m.poster].forEach(s=>{ if(s) S.removed.push(s); });
      if(S.coverId === m.id) S.coverId = S.items[0] ? S.items[0].id : "";
      S.sel = -1; msg(S.items.length ? "Đã bỏ 1 mục." : "Đã bỏ — cần ít nhất 1 ảnh hoặc video để đăng.", !S.items.length);
    }
    render(); changed();
    const t = q(`.tm-tile[data-i="${S.sel}"]`) || q(".tm-ed-add .tm-add"); try{ t && t.focus({ preventScroll: true }); }catch(e){}
  }
  async function addUrl(){
    const u = q(`#${id}-u`), c = q(`#${id}-c`); if(!u) return;
    const by = String(c && c.value || "").trim().slice(0, 80);
    msg("Đang kiểm tra đường dẫn…");
    try{
      const r = await probeUrl(u.value);
      const k = counts(S.items);
      if(r.kind === "video" && k.videos >= vmax) throw new Error(`Tối đa ${vmax} video.`);
      if(r.kind === "image" && k.images >= LIMITS.images) throw new Error(`Tối đa ${LIMITS.images} ảnh.`);
      const site = (/pexels\.com/.test(r.src) ? "Pexels" : /unsplash\.com/.test(r.src) ? "Unsplash" : /pixabay\.com/.test(r.src) ? "Pixabay" : "");
      const it = Object.assign({ id: newId("u") }, r, by || site ? { credit: { by: by.replace(/\s*\/\s*(Pexels|Unsplash|Pixabay)\s*$/i, ""), site } } : {});
      S.items.push(it); if(!S.coverId) S.coverId = it.id; u.value = ""; if(c) c.value = "";
      msg("Đã thêm từ đường dẫn."); render(); changed();
    }catch(e){ msg(e.message, true); }
  }
  function mount(root){
    S.root = (root && root.id === id) ? root : (root || D).querySelector("#" + id);
    if(!S.root) return api;
    S.root.addEventListener("click", e=>{
      const a = e.target.closest("[data-tm-act]"); if(a){ e.preventDefault(); if(a.dataset.tmAct === "url") addUrl(); else act(a.dataset.tmAct); return; }
      const t = e.target.closest(".tm-tile"); if(t){ const i = Number(t.dataset.i); S.sel = S.sel === i ? -1 : i; render(); const t2 = q(`.tm-tile[data-i="${i}"]`); try{ t2 && t2.focus({ preventScroll: true }); }catch(_){} }
      const lab = e.target.closest(".tm-add.disabled"); if(lab){ e.preventDefault(); msg(lab.querySelector("[data-tm-in='video']") ? `Đã đủ ${vmax} video.` : `Đã đủ ${LIMITS.images} ảnh.`, true); }
    });
    S.root.addEventListener("change", e=>{ const inp = e.target.closest("[data-tm-in]"); if(!inp) return; const files = inp.files; addFiles(files, inp.dataset.tmIn).then(()=>{ inp.value = ""; }); });
    S.root.addEventListener("keydown", e=>{ if(S.sel < 0 || !e.target.closest(".tm-tile")) return; if(e.key === "ArrowLeft" && e.altKey){ e.preventDefault(); act("left"); } else if(e.key === "ArrowRight" && e.altKey){ e.preventDefault(); act("right"); } else if(e.key === "Delete"){ e.preventDefault(); act("del"); } });
    EDITORS.add(api); render();
    return api;
  }
  const clean = m=>{ const o = {}; ["id", "kind", "src", "thumb", "poster", "w", "h", "dur", "size", "mime", "alt", "credit"].forEach(k=>{ if(m[k] != null && m[k] !== "") o[k] = m[k]; }); return o; };
  function value(){ return { media: S.items.map(m=> m.pending ? { id: m.id, kind: m.kind, pending: true, src: "blob:pending" } : clean(m)), coverId: S.coverId }; }
  /** Tải tệp mới lên (demo: IndexedDB · firebase: Storage) → { media, coverId, cover } dùng để lưu tài liệu */
  async function commit(scope, onProgress){
    if(S.busy) throw Object.assign(new Error("Ảnh/video đang được xử lý — đợi vài giây rồi đăng nhé."), { vi: true });
    const CE = G.cloudEvents; if(!CE || typeof CE.putMedia !== "function") throw new Error("Thiếu lớp lưu trữ ảnh/video (cloud-events.js).");
    const local = S.items.filter(m=> m.local), up = [];
    let k = 0;
    try{
      for(const m of local){
        k++; try{ onProgress && onProgress(k, local.length); }catch(e){}
        const base = `${scope}/${m.id}`;
        const src = await CE.putMedia(`${base}.${extOf(m.mime)}`, m._blob, { contentType: m.mime }); up.push(src);
        let thumb = "", poster = "";
        if(m._posterBlob){ poster = await CE.putMedia(`${base}_p.${extOf(m._posterBlob.type)}`, m._posterBlob, { contentType: m._posterBlob.type }); up.push(poster); }
        if(m._thumbBlob){ thumb = await CE.putMedia(`${base}_t.${extOf(m._thumbBlob.type)}`, m._thumbBlob, { contentType: m._thumbBlob.type }); up.push(thumb); }
        m._done = { src, thumb, poster };
      }
    }catch(e){
      for(const s of up) try{ await CE.deleteMedia(s); }catch(_){}
      local.forEach(m=> delete m._done);
      throw e;
    }
    /* đã tải xong → thành mục "đã lưu" (đăng lại khi lưu tài liệu lỗi sẽ không tải trùng) */
    local.forEach(m=>{ const d = m._done; delete m._done; Object.assign(m, { src: d.src, thumb: d.thumb || undefined, poster: d.poster || undefined, local: false }); delete m._blob; delete m._thumbBlob; delete m._posterBlob; });
    const media = S.items.map(clean), coverId = media.some(m=> m.id === S.coverId) ? S.coverId : (media[0] ? media[0].id : "");
    return { media, coverId, cover: coverUrl({ media, coverId }) };
  }
  function destroy(){ S.urls.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} }); S.urls = []; EDITORS.delete(api); }
  function setInvalid(on){ if(!S.root) return; S.root.classList.toggle("tm-invalid", !!on); if(on) S.root.setAttribute("aria-invalid", "true"); else S.root.removeAttribute("aria-invalid"); }
  const api = { id, html, mount, value, commit, destroy, setInvalid, isBusy: ()=> S.busy > 0, items: ()=> S.items.slice(), removed: ()=> S.removed.slice(), el: ()=> S.root, _addFiles: addFiles };
  return api;
}

/* ---------------------------------------------------------------------
   8. BÁO LỖI THÂN THIỆN CHO FORM + BỘ ĐẾM KÝ TỰ
   --------------------------------------------------------------------- */
/** box: phần tử tóm tắt lỗi; fields: { title, desc, text, stars, media } → phần tử để tô đỏ/cuộn tới */
function showErrors(box, errors, fields){
  fields = fields || {};
  Object.values(fields).forEach(el=>{ if(el && el.classList){ el.classList.remove("tm-invalid"); el.removeAttribute("aria-invalid"); } });
  if(!box) return;
  if(!errors || !errors.length){ box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  box.innerHTML = `<b>${icon("warning")}Chưa đăng được — cần bổ sung:</b><ul>${errors.map(e=> `<li>${esc(e.msg)}</li>`).join("")}</ul>`;
  errors.forEach(e=>{ const el = fields[e.field]; if(el && el.classList){ el.classList.add("tm-invalid"); el.setAttribute("aria-invalid", "true"); } });
  const first = fields[errors[0].field] || box;
  try{ first.scrollIntoView({ block: "center", behavior: reduceMotion() ? "auto" : "smooth" }); }catch(e){}
  try{ if(/^(INPUT|TEXTAREA|SELECT)$/.test(first.tagName)) first.focus({ preventScroll: true }); }catch(e){}
  say(errors[0].msg, "error");
}
function bindCounter(input, min, max){
  if(!input) return;
  let c = input.parentNode.querySelector(".tm-cc");
  if(!c){ c = D.createElement("small"); c.className = "tm-cc"; c.setAttribute("aria-live", "polite"); input.insertAdjacentElement("afterend", c); }
  const up = ()=>{ const n = textLen(input.value); c.textContent = n >= min ? `${n} ký tự ✓` : `${n}/${min} ký tự tối thiểu`; c.classList.toggle("ok", n >= min); if(n >= min && input.classList.contains("tm-invalid")){ input.classList.remove("tm-invalid"); input.removeAttribute("aria-invalid"); } };
  input.addEventListener("input", up); up();
}

/* ---------------------------------------------------------------------
   9. KHỞI ĐỘNG
   --------------------------------------------------------------------- */
addIcons();
let _hq = false;
try{
  new MutationObserver(()=>{ if(_hq) return; _hq = true; (G.requestAnimationFrame || setTimeout)(()=>{ _hq = false; hydrate(D); }); })
    .observe(D.documentElement, { childList: true, subtree: true });
}catch(e){ warn(e); }
hydrate(D);

Object.assign(TapMedia, {
  idb: IDB, resolve, hydrate, coverHTML, galleryHTML, imgHTML, vidHTML, creditHTML, openLightbox, closeLightbox, lightboxOpen: ()=> !!LB,
  processImage, processVideo, probeUrl, createEditor, showErrors, bindCounter,
  autoplayBlock, autoplayPref: prefAuto, setAutoplay: setPrefAuto, pauseAll, addIcons, _GAL: GAL,
});
try{ if(G.TapEv && typeof G.TapEv.rerender === "function") G.TapEv.rerender(); }catch(e){}
})(typeof window !== "undefined" ? window : globalThis);

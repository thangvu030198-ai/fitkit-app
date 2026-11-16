/* =========================================================================
   TapEasy — ẢNH MINH HOẠ BÀI TẬP PHONG CÁCH RIÊNG (exercise-art.js)
   Nạp NGAY SAU people-ai.js (trước templates.js/app.js).
   - Ảnh do AI tạo từ mô tả chữ (workflow media-muse.yml → media/exercise-ai/), phong cách TapEasy:
     hình người xám graphite dáng cao, cơ bắp như người mẫu fitness (≈8 đầu), cơ đang làm việc phát sáng xanh teal, nền navy (docs/EXERCISE-ART.md).
   - media/exercise-ai/index.json liệt kê ảnh đã có; id "ex-<key>" ↔ EXERCISES[key].
   - Có ảnh → EXERCISES[key].img = ảnh AI; danh sách bài dùng ảnh nhỏ (-sm) thay ảnh bìa video kho.
   - Chưa có / lỗi mạng → giữ ảnh cũ. Danh sách id lưu localStorage để lần mở sau đổi ngay từ đầu.
   ========================================================================= */
(function(G){
"use strict";
if(G.fkExArt) return;
const BASE = "https://tapeasy.app/media/exercise-ai/";
const VBASE = "https://tapeasy.app/media/exercise-ai-video/";
const LS = "fk_exart_idx", LSV = "fk_exart_vidx";
let avail = new Set();
let vids = {};             // key → { src, poster, ratio }
/* Duyệt chuyên môn (HLV): clip/ảnh chưa đạt kỹ thuật thì ẩn — app dùng ảnh đúng / video nguồn gốc thay thế.
   Cập nhật sau mỗi vòng duyệt (docs/EXERCISE-ART.md § Duyệt). Dạng "key@hash" để chỉ ẩn ĐÚNG bản lỗi —
   bản render lại (hash mới) tự hiện khi đã đạt. */
const HOLD_VIDEO = new Set(["preacher"]);   // 17/11/2026: 3 lần render chưa có đệm preacher → dùng ảnh minh hoạ (đạt) + video nguồn gốc
const HOLD_IMAGE = new Set([]);

function ls(get, v, k){ k = k || LS; try{ if(get) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }
function keyOf(id){ return String(id || "").replace(/^ex-/, ""); }
function exs(){ try{ return typeof EXERCISES !== "undefined" ? EXERCISES : null; }catch(e){ return null; } }
function valid(e){ return e && typeof e.id === "string" && /^ex-[a-z0-9]+$/.test(e.id) && e.file === e.id + ".webp"; }

function apply(ids){
  const E = exs(); if(!E) return 0;
  let n = 0;
  ids.forEach(id=>{ const k = keyOf(id); if(E[k]){ if(!E[k]._origImg) E[k]._origImg = E[k].img; E[k].img = BASE + id + ".webp"; avail.add(k); n++; } });
  return n;
}
function swapDom(){
  if(typeof document === "undefined") return;
  document.querySelectorAll("img[data-exart]").forEach(im=>{
    const k = im.getAttribute("data-exart");
    if(avail.has(k) && im.src.indexOf("/exercise-ai/") < 0){ im.src = BASE + "ex-" + k + "-sm.webp"; }
  });
}
function vValid(e){ return e && typeof e.id === "string" && /^ex-[a-z0-9]+$/.test(e.id) && e.file === e.id + ".mp4" && (!e.poster || e.poster === e.id + ".jpg"); }
function applyVideos(list){
  const o = {};
  (list || []).filter(vValid).filter(e=> !HOLD_VIDEO.has(keyOf(e.id) + "@" + e.hash) && !HOLD_VIDEO.has(keyOf(e.id))).forEach(e=>{ o[keyOf(e.id)] = { src: VBASE + e.file + "?h=" + String(e.hash || "").replace(/[^a-z0-9]/gi, ""), poster: e.poster ? VBASE + e.poster + "?h=" + String(e.hash || "").replace(/[^a-z0-9]/gi, "") : "", ratio: e.ratio === "9:16" ? "9:16" : "16:9" }; });
  vids = o; return Object.keys(o).length;
}
function load(){
  const cv = ls(true, null, LSV);
  if(cv){ try{ applyVideos(JSON.parse(cv)); }catch(e){} }
  const cached = ls(true);
  if(cached){ try{ apply(JSON.parse(cached)); }catch(e){} }
  if(typeof fetch !== "function") return;
  fetch(BASE + "index.json", { cache: "no-cache" }).then(r=> r.ok ? r.json() : null).then(j=>{
    if(!Array.isArray(j)) return;
    const ids = j.filter(valid).filter(e=> !HOLD_IMAGE.has(keyOf(e.id) + "@" + e.hash) && !HOLD_IMAGE.has(keyOf(e.id))).map(e=> e.id);
    ls(false, JSON.stringify(ids));
    if(apply(ids)) swapDom();
  }).catch(()=>{});
  fetch(VBASE + "index.json", { cache: "no-cache" }).then(r=> r.ok ? r.json() : null).then(j=>{
    if(!Array.isArray(j)) return;
    const keep = j.filter(vValid).map(e=> ({ id: e.id, file: e.file, poster: e.poster, ratio: e.ratio, hash: e.hash }));
    ls(false, JSON.stringify(keep), LSV); applyVideos(keep);
  }).catch(()=>{});
}

G.fkExArt = {
  BASE,
  has: k=> avail.has(String(k || "")),
  /** ảnh nhỏ cho danh sách: item của buổi/giáo án (exerciseId) hoặc key */
  thumb(itemOrKey){
    const k = typeof itemOrKey === "string" ? itemOrKey : (itemOrKey && !itemOrKey.custom ? itemOrKey.exerciseId : "");
    return k && avail.has(k) ? BASE + "ex-" + k + "-sm.webp" : "";
  },
  full: k=> avail.has(k) ? BASE + "ex-" + k + ".webp" : "",
  /** video minh hoạ phong cách TapEasy (lặp, không tiếng): { src, poster, ratio } hoặc null */
  video: k=> vids[String(k || "")] || null,
  isAi: u=> String(u || "").indexOf("/media/exercise-ai/") >= 0,
  _apply: apply, _applyVideos: applyVideos, _hold: { video: HOLD_VIDEO, image: HOLD_IMAGE }, _keys: ()=> Array.from(avail),
};
load();
})(typeof window !== "undefined" ? window : globalThis);

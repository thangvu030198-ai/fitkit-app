/* =========================================================================
   TapEasy — NÚT "XEM VIDEO HƯỚNG DẪN TRÊN YOUTUBE" (guide-links.js) · 19/11/2026
   Nạp SAU app.js / library.js. Chỉ là ĐƯỜNG LINK tìm kiếm YouTube (mở trình duyệt / app YouTube) —
   app không nhúng, không tải, không lưu video của người khác.
   Gắn vào: chi tiết bài trong buổi (openExerciseDetail), khối "Hướng dẫn kỹ thuật" ở màn tập (renderSessionStep),
   tab Hướng dẫn ở Thư viện bài tập (library.js gọi FKYT.button()).
   API: window.FKYT = { query(name), url(name), button(name), open(url) }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKYT) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));

/** "Đẩy ngực máy (Machine Chest Press)" → "Machine Chest Press proper form"; tên chỉ tiếng Việt → "<tên> kỹ thuật đúng" */
function query(name){
  const s = String(name || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if(!s) return "";
  const m = /\(([^()]*[A-Za-z][^()]*)\)\s*$/.exec(s);
  if(m) return `${m[1].trim()} proper form`;
  if(/^[\x20-\x7E]+$/.test(s)) return `${s} proper form`;
  return `${s} kỹ thuật đúng`;
}
function url(name){ const q = query(name); return q ? "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) : ""; }
function button(name, cls){
  const u = url(name); if(!u) return "";
  return `<button type="button" class="btn btn-outline btn-sm yt-btn ${cls || ""}" data-yt="${esc(u)}"><span class="material-symbols-rounded">play_circle</span>Xem video hướng dẫn trên YouTube</button>`;
}
function open(u){
  if(!/^https:\/\/www\.youtube\.com\/results\?search_query=/.test(String(u || ""))) return false;
  try{
    const C = G.Capacitor, B = C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Browser;
    if(B){ B.open({ url: u }); return true; }
  }catch(e){}
  try{ G.open(u, "_blank", "noopener"); }catch(e){}
  return true;
}
if(D && D.addEventListener) D.addEventListener("click", e=>{
  const b = e.target && e.target.closest ? e.target.closest("[data-yt]") : null; if(!b) return;
  e.preventDefault(); open(b.getAttribute("data-yt"));
});

/* ---- gắn vào các màn có sẵn ---- */
function sheetName(){ const sc = D && D.getElementById("sheet-content"); const h = sc && sc.querySelector("h3"); return h ? h.textContent : ""; }
function addToSession(){
  const sc = D && D.getElementById("sheet-content"); if(!sc || sc.querySelector(".yt-btn")) return;
  const g = Array.from(sc.querySelectorAll("details.set-guide")).find(d=>{ const sm = d.querySelector("summary"); return sm && /Hướng dẫn kỹ thuật/.test(sm.textContent); });
  if(!g) return;
  const name = sheetName(); const html = button(name, "in-guide"); if(!html) return;
  g.insertAdjacentHTML("beforeend", html);
}
function addToDetail(){
  const sc = D && D.getElementById("sheet-content"); if(!sc || sc.querySelector(".yt-btn")) return;
  const t = Array.from(sc.querySelectorAll(".card-title")).find(x=> /Hướng dẫn kỹ thuật/.test(x.textContent)); if(!t) return;
  const p = t.nextElementSibling; const html = button(sheetName(), "in-detail"); if(!html) return;
  (p || t).insertAdjacentHTML("afterend", html);
}
function install(){
  if(typeof renderSessionStep === "function" && !renderSessionStep.__yt){ const f = renderSessionStep; renderSessionStep = function(){ const o = f.apply(this, arguments); try{ addToSession(); }catch(e){} return o; }; renderSessionStep.__yt = true; }
  if(typeof openExerciseDetail === "function" && !openExerciseDetail.__yt){ const f = openExerciseDetail; openExerciseDetail = function(){ const o = f.apply(this, arguments); try{ addToDetail(); }catch(e){} return o; }; openExerciseDetail.__yt = true; }
}
G.FKYT = { query, url, button, open, install };
install();
if(D) D.addEventListener("DOMContentLoaded", install, { once: true });
})(typeof window !== "undefined" ? window : globalThis);

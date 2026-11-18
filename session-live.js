/* =========================================================================
   TapEasy — THẺ "ĐANG TẬP" Ở MÀN HÌNH KHOÁ / THANH THÔNG BÁO (session-live.js) · 19/11/2026
   Nạp SAU session-focus.js. Chỉ chạy trên app Android cài từ store (Capacitor LocalNotifications).
   - Khi đang có buổi tập mà người dùng khoá máy / chuyển app → đăng 1 thông báo IM LẶNG (kênh "Buổi tập đang chạy",
     mức thấp: không kêu, không rung) ghi: bài đang tập, hiệp tiếp theo (kg × lần), giờ hết nghỉ.
     Chạm vào → mở lại đúng màn tập. Quay lại app / xong buổi → tự xoá.
   - Báo HẾT GIỜ NGHỈ (có chuông) vẫn do app.js (scheduleRestNotif, id 900) như cũ.
   - iOS: chưa dùng (thông báo cục bộ iOS luôn kêu mỗi lần cập nhật) → để dành cho Live Activity / Dynamic Island.
   API: window.FKLive = { text(), post(), clear(), CH, ID }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKLive) return;
const D = G.document;
const ID = 901, CH = "fk-session";
const P = ()=>{ try{ const C = G.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.getPlatform && C.getPlatform() === "android" && C.Plugins && C.Plugins.LocalNotifications || null; }catch(e){ return null; } };
const S = ()=>{ try{ return typeof session !== "undefined" ? session : null; }catch(e){ return null; } };
const hm = ms=>{ const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const clip = (s, n)=> String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

/** nội dung thẻ từ màn tập đang mở (null = không có buổi đang chạy) */
function text(now){
  const s = S(); if(!s || s.finished || !Array.isArray(s.items) || !s.items.length) return null;
  now = now || Date.now();
  const sc = D && D.getElementById("sheet-content");
  const name = clip(sc && sc.querySelector("h3") ? sc.querySelector("h3").textContent : "", 60);
  const title = `Đang tập · Bài ${Math.min(s.idx + 1, s.items.length)}/${s.items.length}${name ? " · " + name : ""}`;
  let next = "";
  const F = G.FKFocus, c = F && F.current ? F.current() : null;
  if(c && c.row){
    const kg = (c.row.querySelector("input[data-kg]") || {}).value, reps = (c.row.querySelector("input[data-reps]") || {}).value;
    next = `Hiệp ${c.i + 1}/${c.list.length}${reps ? ` — ${kg ? String(kg).replace(".", ",") + " kg × " : ""}${reps} lần` : ""}`;
  }else if(c && c.list && c.list.length) next = "Xong các hiệp — mở app để sang bài tiếp";
  const restEnd = Number(G._restEnd) || 0;
  const body = restEnd > now ? `Nghỉ đến ${hm(restEnd)}${next ? " · Tiếp: " + next : ""}` : (next || "Chạm để quay lại buổi tập");
  return { title: clip(title, 90), body: clip(body, 140) };
}
let chOk = false;
async function channel(p){
  if(chOk || !p.createChannel) return;
  try{ await p.createChannel({ id: CH, name: "Buổi tập đang chạy", description: "Bài và hiệp đang tập, hiện khi khoá màn hình", importance: 2, visibility: 1, vibration: false, lights: false }); chOk = true; }catch(e){}
}
async function post(){
  const p = P(); if(!p) return false;
  const t = text(); if(!t) return false;
  try{
    const perm = p.checkPermissions ? await p.checkPermissions() : { display: "granted" };
    if(perm && perm.display !== "granted") return false;      // không xin quyền lúc đang ẩn app
    await channel(p);
    await p.schedule({ notifications: [{ id: ID, title: t.title, body: t.body, channelId: CH, autoCancel: true, ongoing: false, extra: { fk: "session" } }] });
    return true;
  }catch(e){ return false; }
}
async function clear(){ const p = P(); if(!p) return; try{ await p.cancel({ notifications: [{ id: ID }] }); }catch(e){} }

if(D && D.addEventListener){
  D.addEventListener("visibilitychange", ()=>{ if(D.visibilityState === "hidden") post(); else clear(); });
}
clear();      // mở app lại sau khi bị tắt hẳn → xoá thẻ cũ còn sót
G.FKLive = { text, post, clear, CH, ID };
})(typeof window !== "undefined" ? window : globalThis);

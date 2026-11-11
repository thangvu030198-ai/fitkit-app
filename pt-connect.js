/* =========================================================================
   TapEasy PT CONNECT (pt-connect.js + pt-connect.css) — kết nối PT ↔ học viên
   Dùng API cloud.social (cloud-social.js). Nạp SAU pt-pro.js.

   PHÍA HỌC VIÊN
   · Hộp thư lời mời (email / mã / QR) → xem PT → Chấp nhận / Từ chối
   · "Tab PT" trong màn PT khi đã có PT: Lịch PT giao · Chương trình · Chat · Tiến độ chung
   · "Bắt đầu tập & ghi kg×lần" ngay trên buổi PT giao → dữ liệu tự hiện bên PT
   · Tự đồng bộ nhật ký tập (setLog / setHist / workoutLog tóm tắt) lên form để PT xem
   · Tự nhận buổi PT "log thay" vào nhật ký của mình khi mở app
   PHÍA PT (TapEasy PT)
   · Nút "Mời học viên" (email / mã / QR), danh sách lời mời đã gửi
   · Tab "Chat" và "Nhật ký tập" (bảng tiến độ học viên từ dữ liệu đồng bộ) trong form học viên
   · "Tập cùng — log thay": ghi hiệp kg × lần ngay trên máy PT cho học viên
   · Huy hiệu số tin nhắn chưa đọc trên thanh điều hướng PT
   Dữ liệu cục bộ: state.ptConnect = { applied, syncHash, syncAt, syncErr, hub, hubTab, share, draft, pendingJoin }
   ========================================================================= */
(function(){
"use strict";
const W = typeof window !== "undefined" ? window : globalThis;
if(W.TEConnect && W.TEConnect.installed) return;
const TE = W.TEConnect = W.TEConnect || {};
if(typeof cloud === "undefined" || !cloud || !cloud.social){ try{ console.warn("[pt-connect] cần nạp cloud-social.js trước"); }catch(e){} return; }
const S = cloud.social, L = S.logic;

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH
   --------------------------------------------------------------------- */
const esc = s=> (typeof escapeHtml === "function") ? escapeHtml(s==null ? "" : String(s)) : String(s==null ? "" : s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = (n, cls)=> `<span class="material-symbols-rounded${cls ? " "+cls : ""}" aria-hidden="true">${n}</span>`;
const q = (sel, root)=> (root || document).querySelector(sel);
const qa = (sel, root)=> Array.from((root || document).querySelectorAll(sel));
const p2 = n=> String(n).padStart(2, "0");
const tday = ()=> (typeof todayStr === "function" ? todayStr() : L.dstr(new Date()));
const rel = d=> (typeof relDay === "function" ? relDay(d) : d);
const hm = ts=>{ const d = new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const ddmm = d=>{ const m = String(d == null ? "" : d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : "—"; };   // QS-04: chỉ số, không cắt chuỗi thô
const viN = n=> Math.round(Number(n)||0).toLocaleString("vi-VN");
const kgS = n=> (Math.round((Number(n)||0)*10)/10).toLocaleString("vi-VN");
const warn = (...a)=>{ try{ console.warn("[pt-connect]", ...a); }catch(e){} };
const safe = (fn, label)=> function(){ try{ return fn.apply(this, arguments); }catch(e){ warn(label || "", e); } };
const amPT = ()=> !!(cloud.profile && cloud.profile.isPT);
const PD = ()=> (typeof ptData !== "undefined" && ptData) ? ptData : { asPT:[], asStudent:[], sessions:{}, notes:{}, loaded:false };
const asPT = ()=> PD().asPT || [];
const asSt = ()=> PD().asStudent || [];
const sessOf = cid=> (PD().sessions || {})[cid] || [];
const findC = cid=> asPT().concat(asSt()).find(c=> c.id === cid) || null;
const roleOf = cid=> asPT().some(c=> c.id === cid) ? "pt" : "student";
const initials = n=> String(n||"?").trim().split(/\s+/).map(w=> w[0]||"").slice(-2).join("").toUpperCase() || "?";
const startOf = s=> (typeof sessStart === "function" ? sessStart(s) : new Date(s.date + "T" + (s.time||"00:00"))).getTime();
const isImg = d=> typeof d === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(d);
const visible = el=> !!(el && document.body && document.body.contains && document.body.contains(el));
/* App Store 1.2 (vòng 2): chặn người dùng — FKBlock (coach.js) bọc API cloud.js blockUser / listBlocked / isBlockedSync */
const isBlk = uid=>{ try{ return !!uid && (W.FKBlock ? W.FKBlock.is(uid) : (typeof cloud.isBlockedSync === "function" && cloud.isBlockedSync(String(uid)))); }catch(e){ return false; } };
const peerOf = (c, role)=> c ? ((role === "pt" ? c.studentUid : c.ptId) || null) : null;
const peerName = (c, role)=> c ? (role === "pt" ? (c.studentName || c.name || "Học viên") : (c.ptName || "PT")) : "";
function rid(p){ return `${p||"x"}${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`; }
function brandMark(cls){
  return `<span class="te-mark ${cls||""}" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M9.5 10.5h13M16 10.5v12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><circle cx="16" cy="26" r="1.9" fill="currentColor"/></svg><img src="assets/brand/logo-mark.svg" alt="" onerror="this.remove()"></span>`;
}
function avatarHTML(photo, name, cls){
  return isImg(photo) || /^https:\/\//.test(String(photo||""))
    ? `<img class="sc-av ${cls||""}" src="${esc(photo)}" alt="">`
    : `<span class="sc-av ini ${cls||""}" aria-hidden="true">${esc(initials(name))}</span>`;
}
function st(){
  if(typeof state === "undefined" || !state) return { applied:{}, syncHash:{} };
  const s = state.ptConnect = Object.assign({ applied:{}, syncHash:{}, syncAt:0, syncErr:"", hub:null, hubTab:"schedule", share:true, draft:null, pendingJoin:null, metric:null }, state.ptConnect || {});
  if(typeof s.applied !== "object" || !s.applied) s.applied = {};
  if(typeof s.syncHash !== "object" || !s.syncHash) s.syncHash = {};
  return s;
}
const save = ()=>{ try{ saveState(); }catch(e){} };
const C = { invites:[], sent:[], ptProfiles:{}, chat:null, watchStop:null, invStop:null, syncT:null, applying:false, px:null };

/* Icon nét mảnh bổ sung (chỉ thêm nếu chưa có) */
function addIcons(){
  if(typeof FK_LINE !== "object" || !FK_LINE) return;
  const CHAT = "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.8L3 21l1.9-4.8A8.4 8.4 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5z";
  const add = {
    forum: CHAT + "|M8 11.5h.01|M12 11.5h.01|M16 11.5h.01", chat: CHAT, chat_bubble: CHAT,
    qr_code_2: "r:3,3,7,7,1.2|r:14,3,7,7,1.2|r:3,14,7,7,1.2|M14 14h3v3|M21 14v.01|M14 21h3|M21 17.5V21h-.5|M17.5 17.5h.01",
    qr_code_scanner: "M3 7V5a2 2 0 0 1 2-2h2|M17 3h2a2 2 0 0 1 2 2v2|M21 17v2a2 2 0 0 1-2 2h-2|M7 21H5a2 2 0 0 1-2-2v-2|M7 12h10",
    inbox: "M22 12h-6l-2 3h-4l-2-3H2|M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z",
    done_all: "M2 13l4 4L16 7|M12 15l2 2 8-8", done: "M20 6 9 17l-5-5",
    add_photo_alternate: "r:3,3,18,18,2|c:9,9,2|M21 15l-5-5L5 21",
    image: "r:3,3,18,18,2|c:9,9,2|M21 15l-5-5L5 21",
    favorite: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
    bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
    verified: "M12 2.5l2.3 1.7 2.9-.2.9 2.7 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.7-2.9-.2L12 21.5l-2.3-1.7-2.9.2-.9-2.7-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.7 2.9.2z|M8.7 12l2.3 2.3 4.3-4.6",
    more_horiz: "M5 12h.01|M12 12h.01|M19 12h.01", remove: "M5 12h14", expand_more: "M6 9l6 6 6-6", chevron_left: "M15 18l-6-6 6-6",
    sync: "M21 12a9 9 0 0 1-15.5 6.2|M3 12A9 9 0 0 1 18.5 5.8|M18.5 2v4h-4|M5.5 22v-4h4",
    how_to_reg: "c:9,7,4|M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1|M16 11l2 2 4-4",
    sports_gymnastics: "c:12,4.5,2|M5 9h14|M12 9v6|M12 15l-4 6|M12 15l4 6",
    timer: "c:12,14,8|M12 10v4l2 2|M10 2h4", pause: "M8 5v14|M16 5v14", stop_circle: "c:12,12,10|r:9,9,6,6,1",
    // App Store 1.2 (vòng 2): chặn / bỏ chặn người dùng
    block: "c:12,12,9|M5.6 5.6l12.8 12.8", lock: "r:5,11,14,10,2|M8 11V7a4 4 0 0 1 8 0v4", lock_open: "r:5,11,14,10,2|M8 11V7a4 4 0 0 1 7.8-1.2",
    filter_list: "M3 6h18|M7 12h10|M10 18h4", public: "c:12,12,10|M2 12h20|M12 2a15 15 0 0 1 0 20|M12 2a15 15 0 0 0 0 20",
    mark_chat_unread: CHAT + "|c:19,5,2.5", ios_share: "M12 3v12|M8 7l4-4 4 4|M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
  };
  Object.keys(add).forEach(k=>{ if(!FK_LINE[k]) FK_LINE[k] = add[k]; });
}

/* ---------------------------------------------------------------------
   1. MÃ QR (byte mode, mức sửa lỗi M, phiên bản 1–10) — không cần mạng
   --------------------------------------------------------------------- */
const QR = (()=>{
  const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const BLK_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  const rawModules = v=>{ let r = (16*v + 128)*v + 64; if(v >= 2){ const n = Math.floor(v/7) + 2; r -= (25*n - 10)*n - 55; if(v >= 7) r -= 36; } return r; };
  const dataCw = v=> Math.floor(rawModules(v)/8) - ECC_M[v]*BLK_M[v];
  const mul = (x, y)=>{ let z = 0; for(let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; };
  function rsDiv(deg){ const r = new Array(deg - 1).fill(0); r.push(1); let root = 1; for(let i = 0; i < deg; i++){ for(let j = 0; j < r.length; j++){ r[j] = mul(r[j], root); if(j + 1 < r.length) r[j] ^= r[j+1]; } root = mul(root, 2); } return r; }
  function rsRem(data, div){ const r = div.map(()=> 0); data.forEach(b=>{ const f = b ^ r.shift(); r.push(0); div.forEach((c, i)=> r[i] ^= mul(c, f)); }); return r; }
  function utf8(s){ return Array.from(unescape(encodeURIComponent(s)), c=> c.charCodeAt(0)); }
  function encode(text){
    const bytes = utf8(text);
    let ver = 1;
    for(; ver <= 10; ver++){ const cc = ver < 10 ? 8 : 16; if(4 + cc + bytes.length*8 <= dataCw(ver)*8) break; }
    if(ver > 10) throw new Error("QR: nội dung quá dài");
    const size = ver*4 + 17;
    const bits = [];
    const push = (val, len)=>{ for(let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b=> push(b, 8));
    const cap = dataCw(ver)*8;
    push(0, Math.min(4, cap - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for(let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
    const data = []; for(let i = 0; i < bits.length; i += 8){ let b = 0; for(let j = 0; j < 8; j++) b = (b << 1) | bits[i+j]; data.push(b); }
    // ECC + xen kẽ khối
    const nb = BLK_M[ver], ecl = ECC_M[ver], raw = Math.floor(rawModules(ver)/8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDiv(ecl);
    const blocks = [];
    for(let i = 0, k = 0; i < nb; i++){
      const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = rsRem(dat, div); if(i < nShort) dat.push(0); blocks.push(dat.concat(ecc));
    }
    const cw = [];
    for(let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j)=>{ if(i !== shortLen - ecl || j >= nShort) cw.push(b[i]); });
    // Ma trận
    const M = Array.from({length:size}, ()=> new Array(size).fill(false));
    const F = Array.from({length:size}, ()=> new Array(size).fill(false));
    const set = (x, y, d)=>{ M[y][x] = d; F[y][x] = true; };
    for(let i = 0; i < size; i++){ set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy)=>{ for(let dy = -4; dy <= 4; dy++) for(let dx = -4; dx <= 4; dx++){ const x = cx + dx, y = cy + dy; if(x >= 0 && x < size && y >= 0 && y < size){ const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); } } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const align = [];
    if(ver > 1){ const n = Math.floor(ver/7) + 2, step = Math.ceil((ver*4 + 4) / (n*2 - 2)) * 2; align.push(6); for(let pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos); }
    align.forEach((ay, i)=> align.forEach((ax, j)=>{
      if((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return;
      for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const drawFormat = mask=>{
      const d = (0 << 3) | mask; let rem = d; for(let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((d << 10) | rem) ^ 0x5412, bit = i=> ((b >>> i) & 1) !== 0;
      for(let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for(let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for(let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for(let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if(ver >= 7){ let rem = ver; for(let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); const b = (ver << 12) | rem;
      for(let i = 0; i < 18; i++){ const c = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, bb = Math.floor(i/3); set(a, bb, c); set(bb, a, c); } }
    // Đặt dữ liệu theo đường zigzag
    let k = 0;
    for(let right = size - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(let v = 0; v < size; v++) for(let j = 0; j < 2; j++){
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if(!F[y][x] && k < cw.length*8){ M[y][x] = ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) !== 0; k++; }
      }
    }
    const maskFn = [ (x,y)=> (x+y)%2===0, (x,y)=> y%2===0, (x)=> x%3===0, (x,y)=> (x+y)%3===0, (x,y)=> (Math.floor(x/3)+Math.floor(y/2))%2===0,
      (x,y)=> x*y%2 + x*y%3 === 0, (x,y)=> (x*y%2 + x*y%3)%2===0, (x,y)=> ((x+y)%2 + x*y%3)%2===0 ];
    const apply = m=>{ for(let y = 0; y < size; y++) for(let x = 0; x < size; x++) if(!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = ()=>{
      let p = 0, dark = 0;
      for(let y = 0; y < size; y++){ let run = 1; for(let x = 1; x <= size; x++){ if(x < size && M[y][x] === M[y][x-1]) run++; else { if(run >= 5) p += run - 2; run = 1; } } }
      for(let x = 0; x < size; x++){ let run = 1; for(let y = 1; y <= size; y++){ if(y < size && M[y][x] === M[y-1][x]) run++; else { if(run >= 5) p += run - 2; run = 1; } } }
      for(let y = 0; y < size - 1; y++) for(let x = 0; x < size - 1; x++){ const c = M[y][x]; if(c === M[y][x+1] && c === M[y+1][x] && c === M[y+1][x+1]) p += 3; }
      M.forEach(r=> r.forEach(c=>{ if(c) dark++; }));
      p += Math.floor(Math.abs(dark*20 - size*size*10) / (size*size)) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for(let m = 0; m < 8; m++){ apply(m); drawFormat(m); const pp = penalty(); if(pp < bestP){ bestP = pp; best = m; } apply(m); }
    apply(best); drawFormat(best);
    return { size, ver, mask: best, modules: M };
  }
  function svg(text, px){
    const { size, modules } = encode(text), qz = 4, n = size + qz*2;
    let d = "";
    modules.forEach((row, y)=> row.forEach((c, x)=>{ if(c) d += `M${x+qz} ${y+qz}h1v1h-1z`; }));
    return `<svg class="sc-qr-svg" viewBox="0 0 ${n} ${n}" width="${px||200}" height="${px||200}" role="img" aria-label="Mã QR" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#061A24"/></svg>`;
  }
  return { encode, svg };
})();

/* Link mời: mở web app với ?join=MÃ (camera điện thoại quét được) */
function joinUrl(code){
  let base = "https://thangvu030198-ai.github.io/fitkit-app/";
  try{ if(/^https?:$/.test(location.protocol) && !/localhost|127\.0\.0\.1|test\.local/.test(location.host)) base = location.origin + location.pathname.replace(/[^/]*$/, ""); }catch(e){}
  if(W.TAPEASY_JOIN_URL) base = W.TAPEASY_JOIN_URL;
  return `${base}?join=${encodeURIComponent(code)}`;
}

/* ---------------------------------------------------------------------
   2. BIỂU ĐỒ SVG (đường + cột) cho bảng tiến độ
   --------------------------------------------------------------------- */
let _gid = 0;
function lineSVG(pts, o){
  o = o || {};
  const W0 = 320, H0 = 150, P = { l:34, r:14, t:16, b:24 };
  if(!pts.length) return `<p class="small-note">${esc(o.empty || "Chưa có dữ liệu.")}</p>`;
  const vals = pts.map(p=> p.v).concat(o.target != null ? [o.target] : []);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if(mx - mn < 1){ mn -= 1; mx += 1; }
  const padV = (mx - mn)*0.12; mn -= padV; mx += padV;
  const t0 = L.dparse(pts[0].date).getTime(), t1 = L.dparse(pts[pts.length-1].date).getTime(), span = Math.max(1, t1 - t0);
  const X = d=> pts.length === 1 ? (P.l + (W0 - P.l - P.r)/2) : P.l + (L.dparse(d).getTime() - t0)/span*(W0 - P.l - P.r);
  const Y = v=> P.t + (1 - (v - mn)/(mx - mn))*(H0 - P.t - P.b);
  const id = "scg" + (++_gid);
  const line = pts.map((p, i)=> `${i ? "L" : "M"}${X(p.date).toFixed(1)} ${Y(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${X(pts[pts.length-1].date).toFixed(1)} ${H0 - P.b} L${X(pts[0].date).toFixed(1)} ${H0 - P.b} Z`;
  const last = pts[pts.length-1], fmt = o.fmt || (v=> kgS(v));
  const grid = [0, 0.5, 1].map(f=>{ const v = mn + (mx - mn)*(1 - f), y = P.t + f*(H0 - P.t - P.b); return `<line x1="${P.l}" x2="${W0 - P.r}" y1="${y}" y2="${y}" class="g"/><text x="${P.l - 6}" y="${y + 4}" text-anchor="end" class="ax">${esc(fmt(v))}</text>`; }).join("");
  return `<svg class="sc-chart" viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${esc(o.label || "Biểu đồ")}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    ${o.target != null ? `<line x1="${P.l}" x2="${W0 - P.r}" y1="${Y(o.target)}" y2="${Y(o.target)}" class="tg"/><text x="${W0 - P.r}" y="${Y(o.target) - 5}" text-anchor="end" class="ax tgt">Mục tiêu ${esc(fmt(o.target))}</text>` : ""}
    ${pts.length > 1 ? `<path d="${area}" fill="url(#${id})" class="ar"/>` : ""}
    <path d="${line}" class="ln"/>
    ${pts.map(p=> `<circle cx="${X(p.date).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${p === last ? 4.5 : 2.6}" class="${p === last ? "pt last" : "pt"}"/>`).join("")}
    <text x="${P.l}" y="${H0 - 6}" class="ax">${ddmm(pts[0].date)}</text>
    ${pts.length > 1 ? `<text x="${W0 - P.r}" y="${H0 - 6}" text-anchor="end" class="ax">${ddmm(last.date)}</text>` : ""}
  </svg>`;
}
function barsSVG(weeks){
  const W0 = 320, H0 = 130, P = { l:8, r:8, t:12, b:24 };
  const mx = Math.max(3, ...weeks.map(w=> w.pt + w.self));
  const bw = (W0 - P.l - P.r) / weeks.length;
  const Y = v=> (v / mx) * (H0 - P.t - P.b);
  return `<svg class="sc-chart bars" viewBox="0 0 ${W0} ${H0}" role="img" aria-label="Chuyên cần 8 tuần">
    ${weeks.map((w, i)=>{
      const x = P.l + i*bw + bw*0.2, bwi = bw*0.6, base = H0 - P.b;
      const hPt = Y(w.pt), hSelf = Y(w.self);
      return `<g>
        ${w.self ? `<rect x="${x.toFixed(1)}" y="${(base - hPt - hSelf).toFixed(1)}" width="${bwi.toFixed(1)}" height="${hSelf.toFixed(1)}" rx="3" class="b-self"/>` : ""}
        ${w.pt ? `<rect x="${x.toFixed(1)}" y="${(base - hPt).toFixed(1)}" width="${bwi.toFixed(1)}" height="${hPt.toFixed(1)}" rx="3" class="b-pt"/>` : ""}
        ${!w.pt && !w.self ? `<rect x="${x.toFixed(1)}" y="${base - 2}" width="${bwi.toFixed(1)}" height="2" rx="1" class="b-zero"/>` : ""}
        ${w.missed ? `<circle cx="${(x + bwi/2).toFixed(1)}" cy="${(base - hPt - hSelf - 7).toFixed(1)}" r="3.2" class="b-miss"/>` : ""}
        <text x="${(x + bwi/2).toFixed(1)}" y="${H0 - 8}" text-anchor="middle" class="ax">${esc(w.label)}</text>
      </g>`; }).join("")}
  </svg>`;
}

/* ---------------------------------------------------------------------
   3. BẢNG TIẾN ĐỘ CHUNG (cân nặng · 1RM · chuyên cần)
   --------------------------------------------------------------------- */
function progressModel(c, role){
  const sync = (c && c.trainingSync) || null;
  const me = role === "student";
  const ss = sessOf(c.id);
  // Cân nặng: số đo PT (pt-pro) + cân nặng học viên đồng bộ / máy học viên
  const wmap = {};
  const own = me ? L.buildTrainingSummary(state, { useGlobalStreak:true }) : null;
  ((me ? own.weights : (sync && sync.weights)) || []).forEach(([d, v])=>{ if(v > 0) wmap[d] = v; });
  (c.measurements || []).forEach(m=>{ if(m && L.dparse && /^\d{4}-\d{2}-\d{2}$/.test(m.date) && Number(m.weight) > 0) wmap[m.date] = Number(m.weight); });
  const weights = Object.entries(wmap).sort((a,b)=> a[0].localeCompare(b[0])).slice(-40).map(([date, v])=> ({ date, v }));
  const target = c.health && c.health.goal && Number(c.health.goal.targetWeight) > 0 ? Number(c.health.goal.targetWeight) : null;
  // 1RM theo bài
  let exs = [];
  if(me){
    exs = Object.entries(state.setHist || {}).map(([k, h])=> ({ key:k, name:h.name, pts:(h.list||[]).filter(x=> x.e1rm > 0).map(x=> ({ date:x.date, v:x.e1rm, top:x.top })) }));
  } else if(sync && sync.ex){
    exs = Object.entries(sync.ex).map(([k, e])=> ({ key:k, name:e.n, pts:(e.h||[]).filter(x=> x[1] > 0).map(x=> ({ date:x[0], v:x[1], top:x[2] })), last:e.last }));
  }
  exs = exs.filter(e=> e.pts.length).sort((a,b)=> (b.pts[b.pts.length-1].date).localeCompare(a.pts[a.pts.length-1].date)).slice(0, 8);
  // Chuyên cần 8 tuần: buổi với PT (done) + buổi tự tập (từ nhật ký đồng bộ), chấm cam = vắng/huỷ
  const finished = new Set(me ? (state.finishedDates || []) : ((sync && sync.finished) || []));
  const ptDates = new Set(ss.filter(s=> s.status === "done").map(s=> s.date));
  const mon = d=>{ const x = L.dparse(d); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return L.dstr(x); };
  const m0 = mon(tday());
  const weeks = [];
  for(let i = 7; i >= 0; i--){
    const from = L.dadd(m0, -7*i), to = L.dadd(from, 7);
    const inW = d=> d >= from && d < to;
    const pt = ss.filter(s=> s.status === "done" && inW(s.date)).length;
    const self = [...finished].filter(d=> inW(d) && !ptDates.has(d)).length;
    const missed = ss.filter(s=> inW(s.date) && (s.status === "cancelled" || (s.status === "scheduled" && startOf(s) < Date.now() - 3*3600000))).length;
    weeks.push({ label: ddmm(from), pt, self, missed });
  }
  const done = ss.filter(s=> s.status === "done").length;
  const cancelled = ss.filter(s=> s.status === "cancelled").length;
  const overdue = ss.filter(s=> s.status === "scheduled" && startOf(s) < Date.now() - 3*3600000).length;
  const rate = done + cancelled + overdue ? Math.round(done / (done + cancelled + overdue) * 100) : null;
  const s30 = me ? own.s30 : (sync ? sync.s30 : null);
  return { sync, own, weights, target, exs, weeks, done, rate, s30, streak: me ? own.streak : (sync ? sync.streak : null),
    s7: me ? own.s7 : (sync ? sync.s7 : null), vol7: me ? own.vol7 : (sync ? sync.vol7 : null) };
}
function progressHTML(c, role){
  const m = progressModel(c, role);
  const sel = m.exs.find(e=> e.key === st().metric) || m.exs[0] || null;
  const wDelta = m.weights.length > 1 ? m.weights[m.weights.length-1].v - m.weights[0].v : null;
  const best = sel ? Math.max(...sel.pts.map(p=> p.v)) : 0;
  const first = sel ? sel.pts[0].v : 0;
  return `
    <div class="sc-kpis">
      <div><b>${m.streak != null ? m.streak : "—"}</b><small>ngày liên tiếp</small></div>
      <div><b>${m.s30 != null ? m.s30 : "—"}</b><small>buổi / 30 ngày</small></div>
      <div><b>${m.rate != null ? m.rate + "%" : "—"}</b><small>chuyên cần với PT</small></div>
    </div>
    <div class="card sc-chart-card mint">
      <div class="card-title">${ic("monitor_weight")}Cân nặng${wDelta != null ? `<span class="sc-delta ${wDelta < 0 ? "down" : "up"}">${wDelta > 0 ? "+" : ""}${kgS(wDelta)} kg</span>` : ""}</div>
      ${lineSVG(m.weights, { target: m.target, label:"Cân nặng", empty: role === "pt" ? "Chưa có cân nặng — nhập số đo ở tab Sức khoẻ hoặc chờ học viên đồng bộ." : "Chưa có cân nặng — ghi InBody/cân nặng ở mục Tiến độ hoặc nhờ PT đo." })}
    </div>
    <div class="card sc-chart-card coral">
      <div class="card-title">${ic("trending_up")}1RM ước tính${sel && sel.pts.length > 1 && first ? `<span class="sc-delta up">${best >= first ? "+" : ""}${Math.round((best/first - 1)*100)}%</span>` : ""}</div>
      ${m.exs.length ? `<div class="sc-chips" role="tablist">${m.exs.map(e=> `<button type="button" class="pill ${sel && e.key === sel.key ? "active" : ""}" data-sc-metric="${esc(e.key)}">${esc(String(e.name).split("(")[0].trim())}</button>`).join("")}</div>
        ${lineSVG(sel.pts, { label:"1RM", fmt: v=> Math.round(v) })}
        <p class="small-note">Tốt nhất <b>${Math.round(best)} kg</b> · ${sel.pts.length} buổi · tạ nặng nhất ${kgS(Math.max(...sel.pts.map(p=> p.top||0)))} kg. 1RM ước tính theo Epley.</p>`
      : `<p class="small-note">${role === "pt" ? "Chưa có dữ liệu tạ. Khi học viên ghi kg × lần (hoặc bạn ghi thay), biểu đồ sẽ hiện ở đây." : "Ghi kg × lần trong buổi tập để theo dõi sức mạnh."}</p>`}
    </div>
    <div class="card sc-chart-card">
      <div class="card-title">${ic("bar_chart")}Chuyên cần 8 tuần</div>
      ${barsSVG(m.weeks)}
      <div class="sc-legend"><span><i class="b-pt"></i>Tập với PT</span><span><i class="b-self"></i>Tự tập</span><span><i class="b-miss"></i>Vắng / quá hạn</span></div>
    </div>`;
}
function bindProgress(root, rerender){
  qa("[data-sc-metric]", root).forEach(b=> b.addEventListener("click", ()=>{ st().metric = b.dataset.scMetric; save(); rerender(); }));
}

/* ---------------------------------------------------------------------
   4. CHAT 1-1
   --------------------------------------------------------------------- */
function stopChat(){ if(C.chat && C.chat.stop){ try{ C.chat.stop(); }catch(e){} } C.chat = null; }
const QUICK = {
  pt: ["Tốt lắm, giữ nhịp này nhé!", "Nhớ ăn đủ đạm hôm nay", "Gửi mình video hiệp cuối để xem form nhé", "Buổi sau mình tăng 2,5 kg"],
  student: ["Hôm nay em tập xong rồi ạ", "Em xin dời buổi ạ", "Bài này em làm đúng form chưa ạ?", "Em hơi đau khớp gối"],
};
function dayLabel(ts){ const d = L.dstr(new Date(ts)); return d === tday() ? "Hôm nay" : rel(d); }
/* QS-12 (fix-pt): tên & vai người gửi lấy từ FORM (c.ptId / c.studentUid), KHÔNG từ trường name/role/kind trong tin;
   tin "system" do người dùng gửi hiển thị như tin thường của chính người gửi (không còn dòng "hệ thống" giả). */
function senderOf(m, c){
  c = c || {};
  if(m.from && m.from === c.ptId) return { pt:true, name: c.ptName || "PT" };
  if(m.from && m.from === c.studentUid) return { pt:false, name: c.studentName || c.name || "Học viên" };
  return { pt:false, name: "Người dùng không còn trong form" };
}
function msgsHTML(list, c, role){
  const meUid = cloud.user && cloud.user.uid;
  const info = S.chatInfo(c, role);
  let lastDay = "", out = "";
  const mine = list.filter(m=> m.from === meUid);
  const lastMine = mine[mine.length-1];
  list.forEach(m=>{
    const ts = Number(m.ts) || 0;
    const day = L.dstr(new Date(ts));
    if(day !== lastDay){ out += `<div class="sc-day"><span>${esc(dayLabel(ts))}</span></div>`; lastDay = day; }
    // Dòng hệ thống THẬT: chỉ do hệ thống ghi (from === "system" — demo: cloud-social nội bộ, Firebase: Cloud Function; rules cấm người dùng gửi kind "system")
    if(m.kind === "system" && m.from === "system"){ out += `<div class="sc-sys">${ic("info")}<span>${esc(m.text)}</span></div>`; return; }
    const isMe = m.from === meUid;
    const who = senderOf(m, c);
    const isLog = m.kind === "log" && who.pt === (m.role === "pt");
    const img = isImg(m.img) ? m.img : "";
    const body = isLog
      ? `<div class="sc-logmsg">${ic("fitness_center")}<div><b>${isMe ? "Bạn" : esc(who.name)} đã ghi buổi tập</b><span>${esc(m.text)}</span></div></div>`
      : `${img ? `<button type="button" class="sc-img" data-sc-img="${esc(m.id)}" aria-label="Xem ảnh"><img src="${esc(img)}" alt="Ảnh trong tin nhắn" loading="lazy"></button>` : ""}${m.text ? `<div class="sc-txt">${esc(m.text)}</div>` : ""}`;
    const tick = isMe && m === lastMine ? (m._pending ? `<span class="sc-rc">${ic("schedule")}Đang gửi</span>` : (info.otherReadAt >= ts ? `<span class="sc-rc seen">${ic("done_all")}Đã xem ${hm(info.otherReadAt)}</span>` : `<span class="sc-rc">${ic("done")}Đã gửi</span>`)) : "";
    out += `<div class="sc-msg ${isMe ? "me" : "them"} ${isLog ? "log" : ""}">
      ${isMe ? "" : `<div class="sc-who">${esc(who.name)}${who.pt ? ` <i class="sc-badge-pt">PT</i>` : ""}</div>`}
      <div class="sc-bub">${body}<time>${hm(ts)}</time></div>${tick}</div>`;
  });
  return out || `<div class="sc-empty">${ic("forum")}<b>Bắt đầu trò chuyện</b><p>${role === "pt" ? "Hỏi thăm, dặn dò, nhận ảnh/video form từ học viên. Tin nhắn có trạng thái đã xem." : "Nhắn PT của bạn: hỏi bài, báo dời lịch, gửi ảnh tiến độ."}</p></div>`;
}
/* Gắn khung chat vào `host`. opts.inline = true: khung cao cố định (trong tab PT), ngược lại cuộn theo trang (form học viên) */
function mountChat(host, cid, role, opts){
  opts = opts || {};
  stopChat();
  const c0 = findC(cid);
  // App Store 1.2: đã chặn người kia → không mở luồng tin (không nhận tin mới), hiện khối "Bạn đã chặn…" + Bỏ chặn
  const peer = peerOf(c0, role), pName = peerName(c0, role);
  if(peer && isBlk(peer)){
    // FKBlock.blockedHTML tự escape tên/uid (coach.js)
    const blkHTML = W.FKBlock ? W.FKBlock.blockedHTML(peer, pName, "Tin nhắn của người này được ẩn và bạn không nhận tin mới. Người này không nhắn được cho bạn.") : `<p class="empty-hint">Bạn đã chặn người này.</p>`;
    host.insertAdjacentHTML("beforeend", `<div class="sc-chat sc-chat-blocked ${opts.inline ? "inline" : ""}" data-sc-chat="${esc(cid)}">${blkHTML}</div>`);
    C.chat = { cid, role, box: qa(".sc-chat", host).pop(), host, opts, blocked:true, stop: null };
    return;
  }
  // Nút "Chặn người này" (App Store 1.2) — FKBlock.btnHTML tự escape; bắt sự kiện chung qua data-fk-block (coach.js)
  const blkBtnHTML = peer && W.FKBlock ? W.FKBlock.btnHTML(peer, pName, role === "pt" ? "Chat — học viên" : "Chat — PT", "sc-blockbtn") : "";
  host.insertAdjacentHTML("beforeend", `
    <div class="sc-chat ${opts.inline ? "inline" : ""}" data-sc-chat="${esc(cid)}">
      ${blkBtnHTML ? `<div class="sc-chat-tools"><span>${ic("lock")}Chỉ bạn và ${esc(pName)} thấy cuộc trò chuyện</span>${blkBtnHTML}</div>` : ""}
      <div class="sc-msgs" aria-live="polite">${typeof fkSkeleton === "function" ? fkSkeleton(3, "list") : `<p class="empty-hint">Đang tải…</p>`}</div>
      <div class="sc-quick">${QUICK[role].map(t=> `<button type="button" class="pill" data-sc-q="${esc(t)}">${esc(t)}</button>`).join("")}</div>
      <div class="sc-bar">
        <button type="button" class="sc-attach" aria-label="Gửi ảnh">${ic("add_photo_alternate")}</button>
        <textarea rows="1" maxlength="2000" placeholder="Nhắn ${role === "pt" ? "học viên" : "PT"}…" aria-label="Nội dung tin nhắn"></textarea>
        <button type="button" class="sc-send" aria-label="Gửi">${ic("send")}</button>
      </div>
      ${S.engine === "demo" ? `<p class="small-note sc-note">${ic("sync")}Bản thử nghiệm: tin nhắn lưu trên máy này, tự làm mới mỗi 5 giây.</p>` : ""}
    </div>`);
  const box = qa(".sc-chat", host).pop();
  if(!box) return;
  const list = q(".sc-msgs", box), ta = q("textarea", box);
  const ctx = C.chat = { cid, role, box, host, opts, list: [], pending: [], stop: null };
  const scrollEnd = ()=>{ try{ if(opts.inline){ list.scrollTop = list.scrollHeight; } else { const sc = q("#app-scroll"); if(sc) sc.scrollTo(0, sc.scrollHeight); } }catch(e){} };
  const paint = ()=>{
    if(C.chat !== ctx) return;
    if(!visible(box)){ stopChat(); return; }
    const c = findC(cid) || c0 || {};
    list.innerHTML = msgsHTML(ctx.list.concat(ctx.pending), c, role);
    qa("[data-sc-img]", list).forEach(b=> b.addEventListener("click", ()=>{ const m = ctx.list.find(x=> x.id === b.dataset.scImg); if(m) openImage(m.img); }));
    scrollEnd();
  };
  ctx.paint = paint;
  const markRead = ()=>{
    const c = findC(cid); if(!c) return;
    const info = S.chatInfo(c, role);
    if(document.visibilityState === "hidden") return;
    if(info.unread || !info.myReadAt){
      c.chat = Object.assign({}, c.chat || {}); c.chat.read = Object.assign({}, c.chat.read || {}, { [role]: info.sentByOther }); c.chat.readAt = Object.assign({}, c.chat.readAt || {}, { [role]: Date.now() });
      paintBadge();
      S.markRead(cid, role).catch(()=>{});
    }
  };
  ctx.markRead = markRead;
  ctx.stop = S.watchMessages(cid, (msgs, cdoc)=>{
    if(C.chat !== ctx) return;
    if(!visible(box)){ stopChat(); return; }
    if(cdoc){ const c = findC(cid); if(c && cdoc.chat) c.chat = cdoc.chat; }
    ctx.list = (msgs || []).filter(m=> !(m && m.from && m.from !== (cloud.user && cloud.user.uid) && isBlk(m.from))); ctx.pending = ctx.pending.filter(p=> !msgs.some(m=> m.from === p.from && m.ts >= p.ts - 1 && m.text === p.text));
    paint(); markRead();
  }, { onError: e=>{ list.innerHTML = typeof fkError === "function" ? fkError(e.message, ()=> mountChat(host, cid, role, opts)) : `<p class="empty-hint">${esc(e.message)}</p>`; } });
  const send = async (payload)=>{
    const p = Object.assign({ id: rid("p"), from: cloud.user.uid, role, name: cloud.user.name, ts: Date.now(), kind: payload.img ? "image" : "text", _pending:true }, payload);
    ctx.pending.push(p); paint();
    try{ await S.sendMessage(cid, payload, role); if(ctx.stop && ctx.stop.refresh) ctx.stop.refresh(); }
    catch(e){ ctx.pending = ctx.pending.filter(x=> x !== p); paint(); toast(esc(e.message), "error"); if(payload.text) ta.value = payload.text; }
  };
  const doSend = ()=>{ const t = ta.value.trim(); if(!t) return; ta.value = ""; ta.style.height = ""; send({ text: t }); };
  q(".sc-send", box).addEventListener("click", doSend);
  ta.addEventListener("keydown", e=>{ if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); doSend(); } });
  ta.addEventListener("input", ()=>{ ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
  qa("[data-sc-q]", box).forEach(b=> b.addEventListener("click", ()=>{ ta.value = b.dataset.scQ; ta.focus(); }));
  q(".sc-attach", box).addEventListener("click", ()=> pickImage(async data=>{ toast("Đang gửi ảnh…", "image"); await send({ img: data, text: ta.value.trim() }); ta.value = ""; }));
}
function openImage(src){
  if(!isImg(src)) return;
  openSheet(`<div class="sheet-header"><h3>Ảnh</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div><img class="sc-full" src="${esc(src)}" alt="Ảnh trong tin nhắn">`);
}
/* Chọn ảnh → nén ≤ 720 px JPEG, tự giảm chất lượng tới khi ≤ ~95 KB */
function pickImage(onDone){
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = ()=>{
    const f = inp.files && inp.files[0]; if(!f) return;
    const img = new Image();
    img.onload = ()=>{
      try{
        let max = 720, quality = 0.82, out = "";
        for(let i = 0; i < 6; i++){
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(img.width*k)); cv.height = Math.max(1, Math.round(img.height*k));
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          out = cv.toDataURL("image/jpeg", quality);
          if(out.length <= 130000) break;
          quality -= 0.12; if(quality < 0.45){ quality = 0.7; max = Math.round(max*0.8); }
        }
        URL.revokeObjectURL(img.src);
        if(out.length > 139000){ toast("Ảnh quá lớn, chọn ảnh khác nhé", "error"); return; }
        onDone(out);
      }catch(e){ toast("Không xử lý được ảnh này", "error"); }
    };
    img.onerror = ()=> toast("Không đọc được ảnh này", "error");
    img.src = URL.createObjectURL(f);
  };
  inp.click();
}

/* ---------------------------------------------------------------------
   5. HUY HIỆU CHƯA ĐỌC (thanh điều hướng PT + hàng học viên + tab Chat)
   --------------------------------------------------------------------- */
function unreadTotal(){
  let n = 0;
  asPT().forEach(c=>{ if(!isBlk(c.studentUid)) n += S.chatInfo(c, "pt").unread; });          // không đếm tin từ người đã chặn
  asSt().forEach(c=>{ if(!isBlk(c.ptId)) n += S.chatInfo(c, "student").unread; });
  return n + (C.invites || []).filter(i=> !isBlk(i.ptId)).length;
}
function paintBadge(){
  const wrap = q('.nav-item[data-goto="coach"] .nav-badge-wrap') || q(".nav-badge-wrap");
  if(!wrap) return;
  let el = q(".sc-nav-count", wrap);
  if(!el){ wrap.insertAdjacentHTML("beforeend", `<i class="sc-nav-count" hidden></i>`); el = q(".sc-nav-count", wrap); }
  if(!el) return;
  const n = unreadTotal();
  el.textContent = n > 99 ? "99+" : String(n);
  el.hidden = !n;
  try{ const btn = wrap.closest(".nav-item"); if(btn) btn.setAttribute("aria-label", n ? `PT, ${n} mục chưa đọc` : "PT"); }catch(e){}
  if(n){ const dot = q("#nav-coach-dot"); if(dot) dot.style.display = "none"; }
  qa("[data-sc-tabcount]").forEach(x=>{ const c = findC(x.dataset.scTabcount); const u = c && !isBlk(peerOf(c, roleOf(c.id))) ? S.chatInfo(c, roleOf(c.id)).unread : 0; x.textContent = u; x.hidden = !u; });
}

/* ---------------------------------------------------------------------
   6. LỜI MỜI — phía PT
   --------------------------------------------------------------------- */
function ptInviteText(c){
  const pr = cloud.profile || {};
  return `Chào ${c.name || "bạn"}, mình là PT ${pr.brandName || (cloud.user && cloud.user.name) || ""} trên TapEasy PT. Tải app TapEasy → mục PT → "Nhập mã PT" → mã: ${c.joinCode}\nHoặc mở link: ${joinUrl(c.joinCode)}`;
}
function openInviteSheet(c, tab){
  if(!c) return;
  tab = tab || "code";
  const sent = (C.sent || []).filter(i=> i.clientId === c.id);
  const pend = sent.find(i=> i.status === "pending"), dec = sent.find(i=> i.status === "declined");
  let qr = ""; try{ qr = QR.svg(joinUrl(c.joinCode), 196); }catch(e){ qr = ""; }
  openSheet(`
    <div class="sheet-header"><h3>Mời học viên</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <div class="sc-inv-who">${avatarHTML(null, c.name)}<div><b>${esc(c.name)}</b><small>${c.studentUid ? `<span class="ok">● Đã kết nối</span>` : pend ? `Đã gửi lời mời tới ${esc(pend.email)}` : dec ? `<span class="warn">${esc(dec.email)} đã từ chối</span>` : "Chưa kết nối tài khoản"}</small></div></div>
    <div class="seg sc-seg" role="tablist">
      <button type="button" class="${tab === "code" ? "active" : ""}" data-inv-tab="code">${ic("qr_code_2")}Mã &amp; QR</button>
      <button type="button" class="${tab === "email" ? "active" : ""}" data-inv-tab="email">${ic("mail")}Email</button>
    </div>
    <div class="sc-inv-body" ${tab === "code" ? "" : "hidden"} data-inv-pane="code">
      <div class="sc-qr">${qr}<div class="sc-qr-cap">${brandMark("sm")}<span>Quét bằng camera điện thoại<br>hoặc nhập mã trong app TapEasy</span></div></div>
      <div class="join-code" aria-label="Mã mời">${esc(c.joinCode)}</div>
      <div class="sc-row2">
        <button type="button" class="btn btn-outline btn-block" id="inv-copy">${ic("content_copy")}Sao chép</button>
        <button type="button" class="btn btn-primary btn-block" id="inv-share">${ic("share")}Gửi lời mời</button>
      </div>
    </div>
    <div class="sc-inv-body" ${tab === "email" ? "" : "hidden"} data-inv-pane="email">
      <div class="field"><label for="inv-email">Email tài khoản TapEasy của học viên</label><input id="inv-email" type="email" inputmode="email" autocomplete="off" placeholder="hocvien@gmail.com" value="${esc(pend ? pend.email : (c.studentEmail || ""))}"></div>
      <div class="field" style="margin-top:10px;"><label for="inv-msg">Lời nhắn (không bắt buộc)</label><textarea id="inv-msg" rows="3" maxlength="500">${esc(`Chào ${c.name}, mình sẽ đồng hành cùng bạn trên TapEasy PT: giao lịch, giáo án và theo dõi tiến độ mỗi buổi. Chấp nhận lời mời để bắt đầu nhé!`)}</textarea></div>
      <p class="small-note">Học viên đăng nhập TapEasy bằng email này sẽ thấy lời mời ở mục <b>PT → Hộp thư lời mời</b> và chọn Chấp nhận / Từ chối.</p>
      <p class="auth-err" id="inv-err"></p>
      <button type="button" class="btn btn-primary btn-block" id="inv-send">${ic("send")}${pend ? "Gửi lại lời mời" : "Gửi lời mời"}</button>
      ${pend ? `<button type="button" class="btn btn-ghost btn-block" id="inv-cancel">Huỷ lời mời đang chờ</button>` : ""}
    </div>
    <button type="button" class="btn btn-ghost btn-block" id="inv-open">${ic("chevron_right")}Mở form học viên</button>`);
  qa("[data-inv-tab]").forEach(b=> b.addEventListener("click", ()=>{
    qa("[data-inv-tab]").forEach(x=> x.classList.toggle("active", x === b));
    qa("[data-inv-pane]").forEach(p=> p.hidden = p.dataset.invPane !== b.dataset.invTab);
  }));
  const cp = q("#inv-copy"); if(cp) cp.addEventListener("click", ()=> (typeof copyText === "function" ? copyText(ptInviteText(c)) : null));
  const sh = q("#inv-share"); if(sh) sh.addEventListener("click", ()=> (typeof shareText === "function" ? shareText("Lời mời TapEasy PT", ptInviteText(c)) : null));
  q("#inv-open").addEventListener("click", ()=>{ closeSheet(); if(typeof openClientForm === "function") openClientForm(c.id, "pt", "info"); });
  const sendBtn = q("#inv-send");
  if(sendBtn) sendBtn.addEventListener("click", async ()=>{
    const email = q("#inv-email").value.trim(), msg = q("#inv-msg").value.trim();
    sendBtn.disabled = true; q("#inv-err").textContent = "";
    try{
      if(pend && pend.email !== email.toLowerCase()) await S.cancelInvite(pend.id);
      await S.sendInvite({ clientId: c.id, email, name: c.name, message: msg });
      await loadSent(); closeSheet(); toast(`Đã gửi lời mời tới ${esc(email)}`, "send");
      rerenderCoach();
    }catch(e){ q("#inv-err").textContent = e.message; sendBtn.disabled = false; }
  });
  const cancel = q("#inv-cancel");
  if(cancel) cancel.addEventListener("click", async ()=>{ try{ await S.cancelInvite(pend.id); await loadSent(); closeSheet(); toast("Đã huỷ lời mời", "close"); rerenderCoach(); }catch(e){ toast(esc(e.message), "error"); } });
}
function openInvitePicker(){
  const open = asPT().filter(c=> !c.studentUid);
  openSheet(`
    <div class="sheet-header"><h3>Mời học viên</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">Gửi lời mời qua <b>email</b>, <b>mã mời</b> hoặc <b>QR</b>. Học viên chấp nhận → mục PT xuất hiện trên app của họ, mọi buổi tập tự đồng bộ về bạn.</p>
    <button type="button" class="sc-pick new" id="inv-new">${ic("person_add")}<div><b>Học viên mới</b><small>Tạo form quản lý rồi gửi lời mời</small></div>${ic("chevron_right")}</button>
    ${open.length ? `<div class="sc-sub">Học viên chưa kết nối (${open.length})</div>` + open.map(c=>{
      const p = (C.sent||[]).find(i=> i.clientId === c.id && i.status === "pending");
      return `<button type="button" class="sc-pick" data-inv-c="${esc(c.id)}">${avatarHTML(null, c.name)}<div><b>${esc(c.name)}</b><small>${p ? `Đang chờ ${esc(p.email)}` : `Mã ${esc(c.joinCode)}`}</small></div>${ic("chevron_right")}</button>`; }).join("") : ""}`);
  q("#inv-new").addEventListener("click", ()=>{ if(typeof openAddClientSheet === "function") openAddClientSheet(); });
  qa("[data-inv-c]").forEach(b=> b.addEventListener("click", ()=> openInviteSheet(findC(b.dataset.invC), "email")));
}
async function loadSent(){ if(!cloud.isLoggedIn() || !amPT()){ C.sent = []; return; } try{ C.sent = await S.sentInvites(); }catch(e){ C.sent = C.sent || []; } }
function sentCardHTML(){
  const recent = (C.sent || []).filter(i=> i.status === "pending" || (i.status === "declined" && Date.now() - (i.respondedAt||0) < 14*86400000));
  if(!recent.length) return "";
  return `<div class="card sc-sent">
    <div class="card-title">${ic("mail")}Lời mời đã gửi <span class="sc-count">${recent.length}</span></div>
    ${recent.slice(0, 6).map(i=> `<div class="sc-sent-row">
      <div class="sc-sent-i ${i.status === "pending" ? "pending" : "declined"}">${ic(i.status === "pending" ? "schedule" : "close")}</div>
      <div class="t"><b>${esc(i.name || i.email)}</b><small>${esc(i.email)} · ${i.status === "pending" ? "đang chờ phản hồi" : "đã từ chối"} · ${ddmm(L.dstr(new Date(i.createdAt||Date.now())))}</small></div>
      <button type="button" class="btn btn-soft btn-sm" data-sent-open="${esc(i.clientId)}">${i.status === "pending" ? "Xem" : "Mời lại"}</button>
    </div>`).join("")}
  </div>`;
}

/* ---------------------------------------------------------------------
   7. LỜI MỜI — phía học viên (hộp thư + nhập mã / QR)
   --------------------------------------------------------------------- */
async function loadInvites(){ if(!cloud.isLoggedIn()){ C.invites = []; return; } try{ C.invites = (await S.myInvites()).filter(i=> !isBlk(i.ptId)); }catch(e){ C.invites = C.invites || []; } }
function inboxHTML(){
  const list = C.invites || [];
  if(!list.length) return "";
  return `<section class="sc-inbox" aria-label="Hộp thư lời mời">
    <div class="sc-inbox-h">${ic("inbox")}<b>Hộp thư lời mời</b><span class="sc-count">${list.length}</span></div>
    ${list.map(i=> `<div class="sc-inv-card">
      <div class="sc-inv-top">${avatarHTML(i.ptPhoto, i.ptBrand || i.ptName, "lg")}
        <div><div class="sc-eyebrow">${brandMark("xs")}TapEasy PT</div><b>${esc(i.ptBrand || i.ptName)}</b><small>${esc(i.ptSpecialty || "Huấn luyện viên cá nhân")} · mời bạn tập cùng</small></div></div>
      ${i.message ? `<p class="sc-inv-msg">“${esc(i.message)}”</p>` : ""}
      <ul class="sc-inv-perks"><li>${ic("event")}Lịch &amp; giáo án PT giao hiện trong app</li><li>${ic("forum")}Chat trực tiếp với PT</li><li>${ic("insights")}Nhật ký tập tự đồng bộ để PT theo dõi</li></ul>
      <div class="sc-row2"><button type="button" class="btn btn-outline btn-block" data-inv-decline="${esc(i.id)}">Từ chối</button><button type="button" class="btn btn-primary btn-block" data-inv-accept="${esc(i.id)}">${ic("handshake")}Chấp nhận</button></div>
    </div>`).join("")}
  </section>`;
}
function bindInbox(root){
  qa("[data-inv-accept]", root).forEach(b=> b.addEventListener("click", async ()=>{
    b.disabled = true;
    try{
      const c = await S.acceptInvite(b.dataset.invAccept);
      C.invites = C.invites.filter(i=> i.id !== b.dataset.invAccept);
      await afterLinked(c);
    }catch(e){ toast(esc(e.message), "error"); b.disabled = false; await loadInvites(); rerenderCoach(); }
  }));
  qa("[data-inv-decline]", root).forEach(b=> b.addEventListener("click", ()=> confirmDialog("Từ chối lời mời?", "PT sẽ thấy bạn đã từ chối. Bạn vẫn có thể kết nối sau bằng mã PT gửi.", async ()=>{
    try{ await S.declineInvite(b.dataset.invDecline); C.invites = C.invites.filter(i=> i.id !== b.dataset.invDecline); paintBadge(); rerenderCoach(); toast("Đã từ chối lời mời", "close"); }
    catch(e){ toast(esc(e.message), "error"); }
  }, "Từ chối", "close")));
}
async function afterLinked(c){
  closeSheet();
  if(typeof coachTab !== "undefined") coachTab = "coaches";
  st().hub = c.id; st().hubTab = "schedule"; save();
  try{ await refreshCoachData(true); }catch(e){}
  if(typeof goto === "function") goto("coach");
  toast(`Đã kết nối với PT ${esc(c.ptName || "")} — mục PT đã sẵn sàng`, "handshake");
  paintBadge(); scheduleSync(300);
}
/* Thay sheet "Nhập mã PT" của coach.js: xem trước PT → Chấp nhận / Từ chối, có quét QR nếu máy hỗ trợ */
function openJoin(prefill){
  if(!cloud.isLoggedIn()){ st().pendingJoin = prefill || st().pendingJoin || null; save(); if(typeof showAuth === "function") showAuth("signup"); return; }
  const canScan = typeof W.BarcodeDetector === "function" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  openSheet(`
    <div class="sheet-header"><h3>Nhập mã PT</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    ${(C.invites||[]).length ? `<button type="button" class="sc-pick hot" id="jn-inbox">${ic("inbox")}<div><b>Bạn có ${C.invites.length} lời mời qua email</b><small>Xem trong Hộp thư lời mời</small></div>${ic("chevron_right")}</button>` : ""}
    <p class="small-note">Nhập mã mời PT gửi (6–10 chữ và số), hoặc quét QR trên máy PT.</p>
    <input id="jn-code" class="join-input" maxlength="10" placeholder="K7M2QXPA" autocomplete="off" autocapitalize="characters" aria-label="Mã PT" value="${esc(prefill || "")}">
    <p class="auth-err" id="jn-err"></p>
    <div class="sc-row2">
      ${canScan ? `<button type="button" class="btn btn-outline btn-block" id="jn-scan">${ic("qr_code_scanner")}Quét QR</button>` : ""}
      <button type="button" class="btn btn-primary btn-block" id="jn-go">Xem lời mời</button>
    </div>
    <div id="jn-preview"></div>`);
  const inp = q("#jn-code");
  inp.addEventListener("input", ()=>{ inp.value = S.normalizeCode(inp.value); });
  const ib = q("#jn-inbox"); if(ib) ib.addEventListener("click", ()=>{ closeSheet(); if(typeof coachTab !== "undefined") coachTab = "coaches"; goto("coach"); });
  const go = async ()=>{
    const btn = q("#jn-go"); btn.disabled = true; q("#jn-err").textContent = "";
    try{ const pv = await S.previewCode(inp.value); showPreview(pv); }
    catch(e){ q("#jn-err").textContent = e.message; }
    btn.disabled = false;
  };
  q("#jn-go").addEventListener("click", go);
  inp.addEventListener("keydown", e=>{ if(e.key === "Enter") go(); });
  const sc = q("#jn-scan"); if(sc) sc.addEventListener("click", ()=> scanQR(code=>{ inp.value = code; go(); }));
  if(prefill) setTimeout(go, 50); else setTimeout(()=>{ try{ inp.focus(); }catch(e){} }, 250);
}
function showPreview(pv){
  const box = q("#jn-preview"); if(!box) return;
  const p = pv.pt;
  box.innerHTML = `<div class="sc-inv-card preview">
    <div class="sc-inv-top">${avatarHTML(p.photo, p.brandName || p.name, "lg")}
      <div><div class="sc-eyebrow">${brandMark("xs")}TapEasy PT</div><b>${esc(p.brandName || p.name)}</b><small>${esc([p.specialty, p.area, p.years ? p.years + " năm kinh nghiệm" : ""].filter(Boolean).join(" · ") || "Huấn luyện viên cá nhân")}</small></div></div>
    ${pv.linked ? `<p class="auth-err">Mã này đã được một tài khoản khác dùng. Hỏi PT mã mới nhé.</p>` : `<p class="sc-inv-msg">${esc(p.name)} mời bạn tham gia lớp tập trên TapEasy PT. Chấp nhận để thấy lịch, giáo án và chat với PT.</p>`}
    <div class="sc-row2"><button type="button" class="btn btn-outline btn-block" id="pv-no">Từ chối</button><button type="button" class="btn btn-primary btn-block" id="pv-yes" ${pv.linked ? "disabled" : ""}>${ic("handshake")}Chấp nhận</button></div>
  </div>`;
  q("#pv-no").addEventListener("click", ()=>{ closeSheet(); toast("Đã bỏ qua lời mời", "close"); });
  q("#pv-yes").addEventListener("click", async ()=>{
    const b = q("#pv-yes"); b.disabled = true;
    try{ const c = await S.acceptCode(pv.code); await afterLinked(c); }
    catch(e){ const er = q("#jn-err"); if(er) er.textContent = e.message; b.disabled = false; }
  });
}
async function scanQR(onCode){
  let stream = null, raf = 0, stopped = false;
  const stop = ()=>{ stopped = true; cancelAnimationFrame(raf); try{ stream && stream.getTracks().forEach(t=> t.stop()); }catch(e){} };
  try{
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
    openSheet(`<div class="sheet-header"><h3>Quét QR của PT</h3><button class="icon-btn" id="qs-x" aria-label="Đóng">${ic("close")}</button></div><div class="sc-scan"><video id="qs-v" playsinline muted></video><i></i></div><p class="small-note" style="text-align:center;">Hướng camera vào mã QR trên máy PT</p>`);
    onSheetCloseHook = stop;
    q("#qs-x").addEventListener("click", ()=>{ closeSheet(); openJoin(); });
    const v = q("#qs-v"); v.srcObject = stream; await v.play();
    const det = new W.BarcodeDetector({ formats:["qr_code"] });
    const loop = async ()=>{
      if(stopped) return;
      try{ const r = await det.detect(v); const raw = r && r[0] && r[0].rawValue; const code = raw ? S.normalizeCode(raw) : ""; if(/^[A-Z0-9]{6,10}$/.test(code)){ onSheetCloseHook = null; stop(); openJoin(code); return; } }catch(e){}
      raf = requestAnimationFrame(loop);
    };
    loop();
  }catch(e){ stop(); toast("Không mở được camera — hãy nhập mã", "error"); openJoin(); }
}

/* ---------------------------------------------------------------------
   8. HỌC VIÊN: tập buổi PT giao ngay trong app (ghi kg × lần)
   --------------------------------------------------------------------- */
function exIdByName(name){
  if(typeof EXERCISES === "undefined") return null;
  const n = L.normS(name);
  for(const [id, e] of Object.entries(EXERCISES)){ if(L.normS(e.name) === n) return id; }
  return null;
}
/* FIX-core §4 (vòng 2): bài PT giao đi từ cloud vào buổi tập của học viên → lọc NGAY LÚC NHẬP (không chỉ escape khi vẽ):
   chữ bỏ thẻ/ký tự điều khiển + cắt độ dài, số ép nguyên trong khoảng, id bài chỉ nhận khoá có thật, URL qua safeUrl(…,{noBlob:true}). */
const pTxt = (s, n)=> String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>`]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const pNum = (v, lo, hi, d)=>{ const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d; };
const pUrl = u=>{ try{ return typeof safeUrl === "function" ? safeUrl(u, { noBlob:true }) : (/^https:\/\/[^\s"'<>]+$/.test(String(u||"")) ? String(u) : ""); }catch(e){ return ""; } };
const hasEx = id=> typeof id === "string" && typeof EXERCISES !== "undefined" && Object.prototype.hasOwnProperty.call(EXERCISES, id) && !!EXERCISES[id];
function cleanStock(s){
  if(!s || typeof s !== "object") return null;
  const o = { url: pUrl(s.url), thumb: pUrl(s.thumb), provider: pTxt(s.provider, 40), author: pTxt(s.author, 80), authorUrl: pUrl(s.authorUrl), pageUrl: pUrl(s.pageUrl), license: pTxt(s.license, 60) };
  return o.url ? o : null;
}
function toPlanItem(e, i){
  e = (e && typeof e === "object") ? e : {};
  const name = pTxt(e.name, 80);
  const exId = hasEx(e.exId) ? e.exId : exIdByName(name);
  const uidBase = pTxt(e.uid, 40).replace(/[^\w-]/g, "") || rid("u");
  const base = { uid: uidBase + "_pt" + pNum(i, 0, 999, 0), sets: pNum(e.sets, 1, 10, 3), reps: pTxt(e.reps, 20) || "10", restSec: pNum(e.restSec, 0, 600, 60), clipId:null };
  const stock = cleanStock(e.stock); if(stock) base.stock = stock;
  if(exId) return Object.assign(base, { exerciseId: exId, custom:null });
  return Object.assign(base, { exerciseId:null, custom:{ name: name || "Bài tập", muscle: pTxt(e.muscle, 40) || "Tuỳ chỉnh", equipment: "—", guide: pTxt(e.guide, 500), img: pUrl(e.img) } });
}
function startPTSession(cid, sid){
  const s = sessOf(cid).find(x=> x.id === sid);
  if(!s || !(s.exercises||[]).length){ toast("Buổi này chưa có bài tập", "error"); return; }
  if(typeof session !== "undefined" && session && !session.finished && !session._pt && session.idx > 0){
    confirmDialog("Đang có buổi tập dở", "Bạn đang tập dở giáo án cá nhân. Bắt đầu buổi PT giao sẽ thay buổi đang dở (kết quả các bài đã xong vẫn được lưu).", ()=> _startPT(cid, s), "Bắt đầu", "play_arrow");
    return;
  }
  _startPT(cid, s);
}
function _startPT(cid, s){
  const c = findC(cid);
  const items = s.exercises.map(toPlanItem);
  session = { dayKey: (typeof todayDayKey === "function" ? todayDayKey() : "T2"), idx:0, items, isToday:true, completed:[],
    _pt: { cid, sid: s.id, title: s.title || "Buổi PT giao", ptName: c ? (c.ptName || "PT") : "PT", map: s.exercises.map((e, i)=> ({ i, uid: items[i].uid })) } };
  const orig = items.map(it=> Object.assign({}, it));
  renderSessionStep();
  // training-pro: không áp tuần giảm tải của giáo án cá nhân cho buổi PT giao
  try{ if(session && session._tp && session._tp.deload){ session._tp.deload = false; session.items = orig; session.sets = {}; renderSessionStep(); } }catch(e){}
  try{ if(session && session._tp) session._tp.planName = "Buổi PT giao"; }catch(e){}
}
async function finishPTSession(s, tpBefore){
  const P = s._pt; if(!P) return;
  const td = tday();
  const exs = [];
  const sessions = sessOf(P.cid), base = sessions.find(x=> x.id === P.sid);
  const exercises = base && base.exercises ? JSON.parse(JSON.stringify(base.exercises)) : [];
  let vol = 0;
  s.items.forEach((it, i)=>{
    const rows = ((s.sets || {})[it.uid] || []).filter(r=> r.done);
    const did = s.completed.includes(it.uid);
    const meta = typeof getExerciseMeta === "function" ? getExerciseMeta(it) : { name: it.custom && it.custom.name };
    const sets = rows.map(r=> ({ kg: Number(r.kg)||0, reps: Number(r.reps)||0, rpe: r.rpe ? Number(r.rpe) : undefined }));
    sets.forEach(x=> vol += x.kg*x.reps);
    if(did) exs.push({ name: meta.name, key: typeof exKey === "function" ? exKey(it) : it.exerciseId, sets: JSON.parse(JSON.stringify(sets)) });
    if(exercises[i]){ exercises[i].done = did; if(did) exercises[i].result = sets.length ? sets.map(x=> `${x.kg}×${x.reps}`).join(" · ") : "✓"; }
  });
  if(!exs.length) return;
  // Nhật ký học viên: buổi PT giao tính là buổi đã tập
  state.workoutLog = state.workoutLog || {};
  const w = state.workoutLog[td] = state.workoutLog[td] || { dayKey: s.dayKey, completedExerciseIds: [], finishedAt: Date.now() };
  w.ptSession = { cid: P.cid, sid: P.sid, title: P.title };
  if(!state.finishedDates.includes(td)) state.finishedDates.push(td);
  try{ const tl = state.trainingPro && state.trainingPro.log; const e = tl && tl[tl.length-1]; if(e && e.date === td && (!tpBefore || tl.length > tpBefore)){ e.title = P.title; e.planName = "Buổi PT giao"; e.ptSid = P.sid; } }catch(e){}
  save();
  try{
    await cloud.saveSession(P.cid, { id: P.sid, status:"done", completedAt: Date.now(), completedBy:"student", exercises,
      studentLog: { date: td, at: Date.now(), exercises: exs, volume: Math.round(vol), durationMin: s._tp && s._tp.startedAt ? Math.round((Date.now() - s._tp.startedAt)/60000) : 0 } });
    try{ await S.sendMessage(P.cid, { kind:"log", text:`Hoàn thành "${P.title}": ${exs.length} bài${vol ? ` · ${viN(vol)} kg` : ""}.`, meta:{ sid:P.sid } }, "student"); }catch(e){}
    toast(`Đã gửi kết quả buổi tập cho ${esc(P.ptName)}`, "send");
    refreshCoachData(true);
  }catch(e){ toast(esc(e.message), "error"); }
  scheduleSync(800);
}

/* ---------------------------------------------------------------------
   9. HỌC VIÊN: nhận buổi PT "log thay" + đồng bộ nhật ký tập lên form
   --------------------------------------------------------------------- */
async function applyPendingProxyLogs(){
  if(C.applying || !cloud.isLoggedIn()) return 0;
  C.applying = true; let n = 0; const prs = []; let lastTitle = "";
  try{
    for(const c of asSt()){
      for(const s of sessOf(c.id)){
        if(!s.proxyLog) continue;
        // QP-06 (fix-pt): PT sửa buổi "log thay" → rev tăng, proxyApplied về null → học viên GỠ bản cũ (ảnh chụp) rồi áp bản mới (không cộng dồn)
        const rec = st().applied[s.id];
        const rev = Number(s.proxyLog.rev) || 1, logAt = Number(s.proxyLog.at) || 0;
        const recRev = rec && typeof rec === "object" ? (Number(rec.rev) || 1) : (rec ? 1 : 0);
        if(rec && recRev >= rev) continue;                                                  // máy này đã áp bản mới nhất
        if(!rec && s.proxyApplied && Number(s.proxyApplied) >= logAt) continue;            // đã áp ở máy khác
        const prev = rec && typeof rec === "object" ? rec.snap : null;
        const r = S.applyProxyLog(state, s, { cid: c.id, prev });
        if(!r.applied) continue;
        st().applied[s.id] = { at: Date.now(), rev, snap: r.snap || null }; n++; lastTitle = s.proxyLog.title || s.title || ""; prs.push(...r.prs);
        S.markProxyApplied(c.id, s.id).then(()=>{ s.proxyApplied = Date.now(); }).catch(()=>{});
      }
    }
    if(n){
      save();
      toast(prs.length ? `PT đã ghi buổi tập cho bạn · kỷ lục mới: ${esc(prs[0].name)} ~${prs[0].e1rm} kg` : `PT đã ghi buổi "${esc(lastTitle)}" vào nhật ký của bạn`, prs.length ? "military_tech" : "fitness_center");
      const a = q(".screen.active");
      if(a && a.id === "screen-home" && typeof renderHomeScreen === "function") renderHomeScreen();
      if(a && a.id === "screen-workout" && typeof renderWorkoutScreen === "function") renderWorkoutScreen();
      scheduleSync(500);
    }
  }catch(e){ warn("apply", e); }
  C.applying = false;
  return n;
}
function scheduleSync(ms){ clearTimeout(C.syncT); C.syncT = setTimeout(()=>{ syncNow().catch(()=>{}); }, ms == null ? 2500 : ms); }
async function syncNow(force){
  if(!cloud.isLoggedIn() || !asSt().length) return false;
  if(st().share === false) return false;
  const sum = S.buildTrainingSummary(state);
  const h = S.summaryHash(sum);
  let pushed = false;
  for(const c of asSt()){
    if(!force && st().syncHash[c.id] === h) continue;
    try{ await S.pushTrainingSync(c.id, sum); st().syncHash[c.id] = h; st().syncAt = Date.now(); st().syncErr = ""; c.trainingSync = sum; pushed = true; }
    catch(e){ st().syncErr = e.message; }
  }
  save();
  return pushed;
}

/* ---------------------------------------------------------------------
   10. HỌC VIÊN: "TAB PT" trong màn PT (Lịch · Chương trình · Chat · Tiến độ)
   --------------------------------------------------------------------- */
async function ptProfile(uid){
  if(C.ptProfiles[uid]) return C.ptProfiles[uid];
  try{ C.ptProfiles[uid] = await cloud.getUser(uid) || {}; }catch(e){ C.ptProfiles[uid] = {}; }
  return C.ptProfiles[uid];
}
function hubHTML(){
  const list = asSt(); if(!list.length) return "";
  let cid = st().hub; if(!list.some(c=> c.id === cid)) cid = list[0].id;
  const c = list.find(x=> x.id === cid);
  const pr = C.ptProfiles[c.ptId] || {};
  const ss = sessOf(c.id);
  const nx = typeof nextSessionOf === "function" ? nextSessionOf(c.id) : null;
  const done = ss.filter(s=> s.status === "done").length, total = Number(c.packageTotal)||0;
  const un = isBlk(c.ptId) ? 0 : S.chatInfo(c, "student").unread;
  const tab = st().hubTab || "schedule";
  const tabs = [["schedule","Lịch","event"],["program","Giáo án","school"],["chat","Chat","forum"],["progress","Tiến độ","insights"]];
  return `<section class="sc-hub" data-sc-hub="${esc(c.id)}">
    ${list.length > 1 ? `<div class="sc-chips">${list.map(x=> `<button type="button" class="pill ${x.id === c.id ? "active" : ""}" data-hub-pick="${esc(x.id)}">${esc(x.ptName || "PT")}</button>`).join("")}</div>` : ""}
    <div class="sc-hero">
      <div class="sc-hero-glow"></div>
      <div class="sc-hero-top">
        ${avatarHTML(pr.photo, pr.brandName || c.ptName, "xl")}
        <div class="sc-hero-id">
          <div class="sc-eyebrow">${brandMark("xs")}PT của bạn · TapEasy PT</div>
          <h3>${esc(pr.brandName || c.ptName || "PT")}</h3>
          <small>${esc(pr.specialty || c.goal || "Huấn luyện cá nhân")}</small>
        </div>
      </div>
      <div class="sc-hero-stats">
        <div><b>${total ? Math.max(0, total - done) : done}</b><small>${total ? "buổi còn lại" : "buổi đã tập"}</small></div>
        <div><b>${nx ? esc(nx.time || "--:--") : "—"}</b><small>${nx ? esc(rel(nx.date)) : "chưa có lịch"}</small></div>
        <div><b>${done}</b><small>buổi cùng PT</small></div>
      </div>
      <div class="sc-hero-act">
        <button type="button" class="btn btn-primary btn-sm" data-hub-tab-go="chat">${ic("forum")}Nhắn PT${un ? ` <i class="cnt">${un}</i>` : ""}</button>
        <button type="button" class="btn btn-soft btn-sm" data-hub-profile>${ic("visibility")}Hồ sơ PT</button>
        <button type="button" class="btn btn-soft btn-sm" data-hub-form>${ic("summarize")}Form đầy đủ</button>
      </div>
    </div>
    <div class="sc-tabs" role="tablist">${tabs.map(([id, label, icon])=> `<button type="button" role="tab" aria-selected="${tab === id}" class="${tab === id ? "active" : ""}" data-hub-tab="${id}">${ic(icon)}<span>${label}</span>${id === "chat" ? `<i class="cnt" data-sc-tabcount="${esc(c.id)}" ${un ? "" : "hidden"}>${un}</i>` : ""}</button>`).join("")}</div>
    <div class="sc-hub-body" data-hub-body></div>
  </section>`;
}
function sessRow(s, cid, opts){
  opts = opts || {};
  const n = (s.exercises||[]).length, dn = (s.exercises||[]).filter(e=> e.done).length;
  const pw = s.program ? Math.round(Number(s.program.week)) || 0 : 0, pws = s.program ? Math.round(Number(s.program.weeks)) || 0 : 0;
  // QP-16: "Tuần 4/12" (không viết "T4" — dễ đọc nhầm thành Thứ Tư)
  const tag = s.proxyLog ? `<span class="sc-tag pt">${ic("sports_gymnastics")}PT ghi thay</span>` : s.studentLog ? `<span class="sc-tag ok">${ic("done_all")}Đã gửi kết quả</span>` : s.program ? `<span class="sc-tag">${esc(s.program.name ? String(s.program.name).split("—")[0].trim() : "Giáo án")}${pw ? ` · Tuần ${pw}${pws ? "/" + pws : ""}` : ""}</span>` : "";
  const cls = ({ scheduled:"scheduled", done:"done", cancelled:"cancelled" })[s.status] || "";
  return `<button type="button" class="sc-sess ${cls}" data-sess-open="${esc(cid)}:${esc(s.id)}">
    <div class="date-chip"><b>${esc(s.time || "--:--")}</b><small>${esc(rel(s.date))}</small></div>
    <div class="info"><div class="name">${esc(s.title || "Buổi tập")}</div><div class="meta">${s.status === "done" ? `${dn || n}/${n} bài` : `${n} bài`}${s.mode === "online" ? " · Online" : ""} ${tag}</div></div>
    ${typeof statusPill === "function" ? statusPill(s) : ""}
  </button>`;
}
function hubSchedule(body, c){
  const ss = sessOf(c.id).slice().sort((a,b)=> startOf(a) - startOf(b));
  const now = Date.now(), td = tday();
  const todays = ss.filter(s=> s.date === td && s.status === "scheduled");
  const up = ss.filter(s=> s.status === "scheduled" && startOf(s) >= now - 3*3600000 && s.date !== td).slice(0, 8);
  const overdue = ss.filter(s=> s.status === "scheduled" && startOf(s) < now - 3*3600000 && s.date !== td).slice(-3);
  const past = ss.filter(s=> s.status !== "scheduled").slice(-5).reverse();
  body.innerHTML = `
    ${todays.length ? todays.map(s=> `<div class="card sc-today">
      <div class="sc-eyebrow">${ic("today")}Hôm nay · ${esc(s.time || "")} · ${s.mode === "online" ? "Online" : "Tại phòng tập"}</div>
      <h3>${esc(s.title || "Buổi tập")}</h3>
      ${s.ptNote ? `<p class="small-note"><b>PT dặn:</b> ${esc(s.ptNote)}</p>` : ""}
      <div class="sc-exlist">${(s.exercises||[]).slice(0, 6).map((e, i)=> `<span>${i+1}. ${esc(String(e.name||"").split("(")[0].trim())} <i>${esc(e.sets||"")}×${esc(e.reps||"")}</i></span>`).join("")}${(s.exercises||[]).length > 6 ? `<span class="more">+${s.exercises.length - 6} bài</span>` : ""}</div>
      <div class="sc-row2"><button type="button" class="btn btn-outline btn-block" data-sess-open="${esc(c.id)}:${esc(s.id)}">Chi tiết</button><button type="button" class="btn btn-primary btn-block" data-sess-start="${esc(c.id)}:${esc(s.id)}">${ic("play_arrow")}Bắt đầu &amp; ghi kg×lần</button></div>
    </div>`).join("") : ""}
    ${overdue.length ? `<div class="sc-sub warn">Quá hạn chưa xác nhận</div>${overdue.map(s=> sessRow(s, c.id)).join("")}` : ""}
    <div class="sc-sub">Sắp tới</div>
    ${up.length ? up.map(s=> sessRow(s, c.id)).join("") : `<p class="small-note">${todays.length ? "Chưa có buổi nào khác." : "PT chưa xếp buổi mới. Nhắn PT để hẹn lịch nhé!"}</p>`}
    ${past.length ? `<div class="sc-sub">Gần đây</div>${past.map(s=> sessRow(s, c.id)).join("")}` : ""}`;
}
function hubProgram(body, c){
  const ss = sessOf(c.id);
  const batches = {};
  ss.forEach(s=>{ if(s.program && s.program.batch){ const b = batches[s.program.batch] = batches[s.program.batch] || { name: s.program.name, weeks: s.program.weeks, list:[] }; b.list.push(s); } });
  const arr = Object.values(batches).map(b=>{
    b.list.sort((a,b2)=> startOf(a) - startOf(b2));
    b.done = b.list.filter(s=> s.status === "done").length;
    b.next = b.list.find(s=> s.status === "scheduled" && startOf(s) >= Date.now() - 3*3600000);
    b.week = b.next && b.next.program ? b.next.program.week : b.weeks;
    return b; }).sort((a,b)=> (b.next ? 1 : 0) - (a.next ? 1 : 0));
  const nx = typeof nextSessionOf === "function" ? nextSessionOf(c.id) : null;
  body.innerHTML = `
    ${arr.length ? arr.map(b=> `<div class="card sc-prog">
      <div class="sc-eyebrow">${ic("school")}Giáo án PT giao</div>
      <h3>${esc(b.name || "Giáo án")}</h3>
      <div class="sc-prog-meta"><span>Tuần ${esc(b.week || 1)}/${esc(b.weeks || "?")}</span><span>${b.done}/${b.list.length} buổi</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${b.list.length ? Math.round(b.done/b.list.length*100) : 0}%"></div></div>
      ${b.next ? `<p class="small-note" style="margin-top:8px;">Buổi tới: <b>${esc(b.next.title || "")}</b> · ${esc(b.next.time || "")} ${esc(rel(b.next.date))}</p>` : `<p class="small-note" style="margin-top:8px;">Đã hoàn tất đợt giáo án này.</p>`}
    </div>`).join("") : `<div class="card sc-prog empty">${ic("school")}<div><b>Chưa có giáo án dài hạn</b><p class="small-note">Khi PT giao nguyên giáo án (nhiều tuần), tiến độ từng tuần hiện ở đây. Các buổi lẻ xem ở tab Lịch.</p></div></div>`}
    ${nx && (nx.exercises||[]).length ? `<div class="sc-sub">Bài tập buổi tới · ${esc(nx.title || "")}</div>
      <div class="sc-exgrid">${nx.exercises.map((e, i)=> `<button type="button" class="sc-ex" data-ex-i="${i}">
        ${e.img ? `<img src="${esc(e.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="n">${i+1}</span>`}
        <div><b>${esc(e.name)}</b><small>${esc(e.sets||"-")} hiệp × ${esc(e.reps||"-")} · nghỉ ${esc(e.restSec||0)}s</small></div>${ic("chevron_right")}</button>`).join("")}</div>
      <button type="button" class="btn btn-primary btn-block" data-sess-start="${esc(c.id)}:${esc(nx.id)}" style="margin-top:10px;">${ic("play_arrow")}Tập buổi này &amp; ghi kg×lần</button>` : ""}`;
  qa("[data-ex-i]", body).forEach(b=> b.addEventListener("click", ()=>{ const e = nx.exercises[Number(b.dataset.exI)]; if(e && typeof openSessionExerciseDetail === "function") openSessionExerciseDetail(e); }));
}
function hubProgress(body, c){
  const s = st();
  body.innerHTML = `<div class="sc-share">
      <div>${ic("sync")}<div><b>Chia sẻ nhật ký tập với PT</b><small>${s.share === false ? "Đang tắt — PT chỉ thấy buổi tập cùng PT." : s.syncErr ? `<span class="warn">Chưa đồng bộ được: ${esc(s.syncErr)}</span>` : s.syncAt ? `Đã đồng bộ lúc ${hm(s.syncAt)} ${esc(rel(L.dstr(new Date(s.syncAt))))}` : "Tự đồng bộ sau mỗi buổi tập"}</small></div></div>
      <button type="button" class="toggle ${s.share === false ? "" : "on"}" data-sc-share role="switch" aria-checked="${s.share !== false}" aria-label="Chia sẻ nhật ký tập với PT"></button>
    </div>
    <div data-sc-prog>${progressHTML(c, "student")}</div>`;
  bindProgress(body, ()=> hubProgress(body, c));
  q("[data-sc-share]", body).addEventListener("click", async ()=>{
    s.share = s.share === false; save();
    if(s.share){ s.syncHash = {}; await syncNow(true); toast("Đã bật chia sẻ nhật ký với PT", "sync"); }
    else{ try{ await S.pushTrainingSync(c.id, { v:1, at: Date.now(), off:true }); }catch(e){} toast("Đã tắt chia sẻ — PT không còn thấy nhật ký tự tập", "close"); }
    hubProgress(body, c);
  });
}
function renderHub(root){
  const hub = q(".sc-hub", root); if(!hub) return;
  const cid = hub.dataset.scHub, c = findC(cid); if(!c) return;
  const body = q("[data-hub-body]", hub);
  const tab = st().hubTab || "schedule";
  stopChat();
  try{
    if(tab === "schedule") hubSchedule(body, c);
    else if(tab === "program") hubProgram(body, c);
    else if(tab === "chat"){ body.innerHTML = ""; mountChat(body, c.id, "student", { inline:true }); }
    else hubProgress(body, c);
  }catch(e){ warn("hub", e); body.innerHTML = `<p class="empty-hint">Không hiển thị được mục này.</p>`; }
  qa("[data-sess-open]", body).forEach(b=> b.addEventListener("click", ()=>{ const [x, sid] = b.dataset.sessOpen.split(":"); openClientForm(x, "student", "today"); if(typeof cf !== "undefined"){ cf.focusSid = sid; renderClientForm(); } }));
  qa("[data-sess-start]", body).forEach(b=> b.addEventListener("click", ()=>{ const [x, sid] = b.dataset.sessStart.split(":"); startPTSession(x, sid); }));
  if(!C.ptProfiles[c.ptId]) ptProfile(c.ptId).then(pr=>{ if(pr && (pr.photo || pr.brandName || pr.specialty)) rerenderCoach(); });
}
function bindHub(root){
  const hub = q(".sc-hub", root); if(!hub) return;
  qa("[data-hub-pick]", hub).forEach(b=> b.addEventListener("click", ()=>{ st().hub = b.dataset.hubPick; save(); rerenderCoach(); }));
  qa("[data-hub-tab], [data-hub-tab-go]", hub).forEach(b=> b.addEventListener("click", ()=>{ st().hubTab = b.dataset.hubTab || b.dataset.hubTabGo; save(); rerenderCoach(); }));
  const c = findC(hub.dataset.scHub);
  const pf = q("[data-hub-profile]", hub); if(pf) pf.addEventListener("click", ()=> typeof openPTProfile === "function" && openPTProfile(c.ptId, c.id));
  const fm = q("[data-hub-form]", hub); if(fm) fm.addEventListener("click", ()=> openClientForm(c.id, "student", "today"));
  renderHub(root);
}
function rerenderCoach(){ const a = q(".screen.active"); if(a && a.id === "screen-coach" && typeof renderCoachScreen === "function") renderCoachScreen(false); }

/* Chèn vào màn PT (sau coach.js + pt-pro.js) */
function enhanceCoachScreen(){
  if(!cloud.isLoggedIn() || !PD().loaded) return;
  const body = q("#coach-tab-body"); if(!body) return;
  const tab = typeof coachTab !== "undefined" ? coachTab : (amPT() ? "clients" : "coaches");
  if(tab === "coaches"){
    if(!q(".sc-inbox", body) && (C.invites||[]).length) body.insertAdjacentHTML("afterbegin", inboxHTML());
    if(!q(".sc-hub", body) && asSt().length){
      const inbox = q(".sc-inbox", body);
      if(inbox) inbox.insertAdjacentHTML("afterend", hubHTML()); else body.insertAdjacentHTML("afterbegin", hubHTML());
      const join = q("#btn-join-pt", body);
      if(join){ join.classList.remove("btn-primary"); join.classList.add("btn-outline"); join.insertAdjacentHTML("beforebegin", `<div class="sc-sub" style="margin-top:18px;">Quản lý kết nối</div>`); }
    }
    bindInbox(body); bindHub(body);
  } else if(tab === "clients" && amPT()){
    const add = q("#btn-add-client", body);
    // QU-16 (fix-pt): không còn nút "Mời học viên" thứ hai — lối mời (mã / QR / email) nằm trong sheet "Thêm học viên"; chỉ giữ thẻ lời mời đã gửi
    if(add && !q("#sc-sent-anchor", body)){
      add.insertAdjacentHTML("afterend", `<span id="sc-sent-anchor" hidden></span>${sentCardHTML()}`);
      qa("[data-sent-open]", body).forEach(b=> b.addEventListener("click", ()=> openInviteSheet(findC(b.dataset.sentOpen), "email")));
    }
  }
}

/* ---------------------------------------------------------------------
   11. FORM HỌC VIÊN: tab "Chat" + "Nhật ký tập", nút "Tập cùng — log thay"
   --------------------------------------------------------------------- */
const MY_TABS = { sc_chat: tabChat, sc_track: tabTrack };
function ensureTabs(){
  if(typeof CF_TABS === "undefined" || !Array.isArray(CF_TABS)) return;
  if(!CF_TABS.some(t=> t.id === "sc_chat")){ const i = CF_TABS.findIndex(t=> t.id === "today"); CF_TABS.splice(i >= 0 ? i+1 : 1, 0, { id:"sc_chat", label:"Chat" }); }
  if(!CF_TABS.some(t=> t.id === "sc_track")){ const i = CF_TABS.findIndex(t=> t.id === "progress"); CF_TABS.splice(i >= 0 ? i+1 : CF_TABS.length, 0, { id:"sc_track", label:"Nhật ký tập" }); }
}
function tabChat(body, c){
  const role = (typeof cf !== "undefined" && cf.role) || roleOf(c.id);
  body.innerHTML = "";
  if(role === "pt" && !c.studentUid){
    body.innerHTML = typeof fkEmpty === "function" ? fkEmpty("forum", "Học viên chưa kết nối", "Gửi lời mời (email / mã / QR) để chat và nhận nhật ký tập tự động.", { label:"Mời học viên", icon:"qr_code_2", onClick: ()=> openInviteSheet(c) })
      : `<p class="empty-hint">Học viên chưa kết nối tài khoản.</p>`;
    return;
  }
  mountChat(body, c.id, role, { inline:false });
}
function tabTrack(body, c){
  const role = (typeof cf !== "undefined" && cf.role) || roleOf(c.id);
  const sync = c.trainingSync;
  const wk = sync && !sync.off ? (sync.workouts || []).slice().reverse() : [];
  const byLabel = { pt:["PT ghi thay","pt"], ptsess:["Buổi PT giao","ok"], self:["Tự tập",""] };
  const exs = sync && sync.ex ? Object.entries(sync.ex).slice(0, 8) : [];
  body.innerHTML = `
    ${role === "pt" ? `<button type="button" class="btn btn-primary btn-block sc-px-cta" data-px-start>${ic("sports_gymnastics")}Tập cùng — log thay</button>` : ""}
    <div class="sc-syncbar ${sync && !sync.off ? "" : "off"}">${ic("sync")}<span>${sync && sync.off ? "Học viên đã tắt chia sẻ nhật ký tự tập." : sync ? `Học viên đồng bộ lúc ${hm(sync.at)} ${esc(rel(L.dstr(new Date(sync.at))))}` : role === "pt" ? "Chưa có dữ liệu đồng bộ — học viên cần mở app TapEasy (bản mới) sau khi kết nối." : "Nhật ký của bạn tự đồng bộ cho PT sau mỗi buổi tập."}</span></div>
    ${progressHTML(c, role)}
    ${wk.length ? `<div class="card"><div class="card-title">${ic("history")}Nhật ký buổi tập (${wk.length})</div>
      ${wk.slice(0, 14).map(w=> `<div class="sc-wk"><div class="date-chip"><b>${ddmm(w.d)}</b><small>${esc((rel(w.d)||"").split(",")[0])}</small></div>
        <div class="t"><b>${esc(w.t || "Buổi tập")}</b><small>${w.n ? `${w.n}${w.tot ? "/" + w.tot : ""} bài` : "Hoàn thành"}${w.vol ? ` · ${viN(w.vol)} kg` : ""}${w.dur ? ` · ${w.dur} phút` : ""}</small></div>
        <span class="sc-tag ${byLabel[w.by] ? byLabel[w.by][1] : ""}">${esc(byLabel[w.by] ? byLabel[w.by][0] : "Tự tập")}</span></div>`).join("")}</div>` : ""}
    ${exs.length && role === "pt" ? `<div class="card"><div class="card-title">${ic("fitness_center")}Mức tạ gần nhất</div>
      ${exs.map(([k, e])=> `<div class="tb-row"><span>${esc(String(e.n).split("(")[0].trim())}</span><b>${e.last ? e.last.s.map(x=> `${kgS(x[0])}×${x[1]}`).join(" · ") : "—"}</b><small>${e.last ? ddmm(e.last.d) : ""}</small></div>`).join("")}</div>` : ""}`;
  bindProgress(body, ()=> renderClientForm());
  const px = q("[data-px-start]", body); if(px) px.addEventListener("click", ()=> openProxyLogger(c.id, pickProxySession(c.id)));
}
function pickProxySession(cid){
  const td = tday();
  const ss = sessOf(cid).filter(s=> s.status === "scheduled" && s.date === td).sort((a,b)=> startOf(a) - startOf(b));
  return ss[0] ? ss[0].id : null;
}
/* Sau khi coach.js vẽ tab gốc: chèn nút phù hợp */
function postTab(c){
  const body = q("#client-content"); if(!body || typeof cf === "undefined") return;
  if(cf.tab === "today"){
    const sessions = sessOf(c.id);
    let s = cf.focusSid ? sessions.find(x=> x.id === cf.focusSid) : null;
    if(!s && typeof nextSessionOf === "function") s = nextSessionOf(c.id) || sessions.filter(x=> x.status === "scheduled").slice(-1)[0] || null;
    if(cf.role === "pt" && c.studentUid){
      // QP-07 (fix-pt): "log thay" gắn vào buổi HÔM NAY; buổi đang xem ở ngày khác → hỏi PT có dời buổi về hôm nay không (nhất quán với tab "Nhật ký tập")
      const todayId = pickProxySession(c.id);
      const other = s && s.status === "scheduled" && s.date !== tday() ? s : null;
      const tgt = todayId ? sessions.find(x=> x.id === todayId) : (s && s.status === "scheduled" && s.date === tday() ? s : null);
      body.insertAdjacentHTML("afterbegin", `<button type="button" class="btn btn-primary btn-block sc-px-cta" data-px-today>${ic("sports_gymnastics")}Tập cùng — log thay${tgt ? ` <small>· ${esc(tgt.title || "buổi hôm nay")}</small>` : ""}</button>`);
      const b = q("[data-px-today]", body);
      if(b) b.addEventListener("click", ()=>{
        if(tgt || !other) return openProxyLogger(c.id, tgt ? tgt.id : null);
        const go = moveIt=>{ try{ closeSheet(); }catch(e){} openProxyLogger(c.id, moveIt ? other.id : null); };
        openSheet(`<div class="sheet-header"><h3>Ghi buổi hôm nay</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
          <p class="small-note">Buổi <b>${esc(other.title || "buổi tập")}</b> đang lên lịch ngày ${esc(ddmm(other.date))}. Học viên tập hôm nay?</p>
          <button type="button" class="btn btn-primary btn-block" data-pxm="1" style="margin-top:12px;">Dời buổi ${esc(ddmm(other.date))} về hôm nay &amp; ghi</button>
          <button type="button" class="btn btn-outline btn-block" data-pxm="0" style="margin-top:8px;">Ghi buổi riêng hôm nay (giữ lịch cũ)</button>`);
        qa("[data-pxm]").forEach(x=> x.addEventListener("click", ()=> go(x.dataset.pxm === "1")));
      });
    }
    // QP-04 / Q05 (fix-pt): học viên chỉ "Bắt đầu tập & ghi kg×lần" cho buổi HÔM NAY / HÔM QUA — không tự hoàn thành trước buổi tương lai
    const stOK = s && (typeof studentCanComplete === "function" ? studentCanComplete(s.date) : s.date === tday());
    if(cf.role === "student" && s && s.status === "scheduled" && stOK && (s.exercises||[]).length){
      body.insertAdjacentHTML("afterbegin", `<button type="button" class="btn btn-primary btn-block sc-px-cta" data-st-start>${ic("play_arrow")}Bắt đầu tập &amp; ghi kg × lần</button>`);
      const b = q("[data-st-start]", body); if(b) b.addEventListener("click", ()=> startPTSession(c.id, s.id));
    }
    if(s && (s.proxyLog || s.studentLog)) body.insertAdjacentHTML("beforeend", resultCardHTML(s));
  }
  if(cf.tab === "info" && cf.role === "pt" && !c.studentUid){
    body.insertAdjacentHTML("afterbegin", `<button type="button" class="btn btn-primary btn-block sc-px-cta" data-inv-form>${ic("qr_code_2")}Mời học viên · email / mã / QR</button>`);
    const b = q("[data-inv-form]", body); if(b) b.addEventListener("click", ()=> openInviteSheet(c, "email"));
  }
  // số tin chưa đọc trên tab Chat
  const tb = q('#client-tabs [data-cft="sc_chat"]');
  if(tb && !q("[data-sc-tabcount]", tb)){ const u = S.chatInfo(c, cf.role).unread; tb.insertAdjacentHTML("beforeend", ` <i class="cnt" data-sc-tabcount="${esc(c.id)}" ${u ? "" : "hidden"}>${u}</i>`); }
}
function resultCardHTML(s){
  const log = s.proxyLog || s.studentLog;
  const exs = log.exercises || [];
  return `<div class="card sc-result">
    <div class="card-title">${ic(s.proxyLog ? "sports_gymnastics" : "done_all")}${s.proxyLog ? `PT ${esc(s.proxyLog.byName || "")} ghi thay` : "Kết quả học viên ghi"}${log.volume ? `<span class="sc-delta up">${viN(log.volume)} kg</span>` : ""}</div>
    ${exs.map(e=> `<div class="tb-row"><span>${esc(String(e.name||"").split("(")[0].trim())}</span><b>${(e.sets||[]).map(x=> e.timed ? "✓" : `${kgS(x.kg)}×${x.reps}`).join(" · ")}</b></div>`).join("")}
    ${s.proxyLog && s.proxyLog.note ? `<p class="small-note">${esc(s.proxyLog.note)}</p>` : ""}
    ${s.proxyLog ? `<p class="small-note">${s.proxyApplied ? "Đã vào nhật ký của học viên." : "Sẽ vào nhật ký của học viên khi học viên mở app."}</p>` : ""}
  </div>`;
}

/* ---------------------------------------------------------------------
   12. "TẬP CÙNG — LOG THAY" (PT ghi hiệp kg × lần cho học viên)
   --------------------------------------------------------------------- */
function lastFor(c, key){ const e = c && c.trainingSync && c.trainingSync.ex && c.trainingSync.ex[key]; return e && e.last ? e.last : null; }
function exFromSession(e){
  const exId = (e.exId && typeof EXERCISES !== "undefined" && EXERCISES[e.exId]) ? e.exId : exIdByName(e.name || "");
  const meta = exId ? EXERCISES[exId] : null;
  return { key: exId || ("c:" + (e.name||"")), exerciseId: exId, name: meta ? meta.name : (e.name || "Bài tập"), img: e.img || (meta && meta.img) || "", muscle: e.muscle || (meta && meta.muscle) || "",
    reps: String(e.reps || (meta && meta.reps) || "10"), restSec: Number(e.restSec || (meta && meta.restSec)) || 90, target: Number(e.sets || (meta && meta.sets)) || 3 };
}
function buildRows(c, it){
  const last = lastFor(c, it.key);
  const timed = L && typeof isTimedReps === "function" ? isTimedReps(it.reps) : false;
  const bottom = typeof repBottom === "function" ? repBottom(it.reps) : 0;
  it.timed = timed;
  it.sets = Array.from({ length: it.target }, (_, i)=>{ const l = last && (last.s[i] || last.s[last.s.length-1]); return { kg: l ? l[0] : "", reps: timed ? "" : (bottom || (l ? l[1] : "")), rpe:"", done:false }; });
  return it;
}
function openProxyLogger(cid, sid){
  const c = findC(cid); if(!c) return;
  const s = st();
  if(s.draft && s.draft.cid === cid && (s.draft.items||[]).length && !C.px){
    openSheet(`<div class="sheet-header"><h3>Buổi đang ghi dở</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
      <p class="small-note">Bạn có buổi <b>${esc(s.draft.title)}</b> của ${esc(c.name)} đang ghi dở (${s.draft.items.length} bài, bắt đầu ${hm(s.draft.startedAt)}).</p>
      <div class="sc-row2" style="margin-top:14px;"><button type="button" class="btn btn-outline btn-block" id="pxd-new">Bắt đầu buổi mới</button><button type="button" class="btn btn-primary btn-block" id="pxd-go">${ic("play_arrow")}Tiếp tục</button></div>`);
    q("#pxd-go").addEventListener("click", ()=>{ C.px = s.draft; renderPx(); });
    q("#pxd-new").addEventListener("click", ()=>{ s.draft = null; save(); openProxyLogger(cid, sid); });
    return;
  }
  const sess = sid ? sessOf(cid).find(x=> x.id === sid) : null;
  const items = (sess && sess.exercises || []).map(e=> buildRows(c, exFromSession(e)));
  C.px = { cid, sid: sess ? sess.id : null, name: c.name, title: sess ? (sess.title || "Tập cùng PT") : "Tập cùng PT", startedAt: Date.now(), idx: 0, items, note:"" };
  if(!items.length){ renderPx(); openPxPicker(); return; }
  renderPx();
}
function saveDraft(){ if(!C.px) return; st().draft = JSON.parse(JSON.stringify(C.px)); save(); }
let pxTick = null, pxRest = null;
function stopPxTimers(){ clearInterval(pxTick); pxTick = null; clearInterval(pxRest && pxRest.t); pxRest = null; }
function fmtClock(ms){ const s = Math.max(0, Math.floor(ms/1000)); const h = Math.floor(s/3600), m = Math.floor(s%3600/60); return (h ? h + ":" + p2(m) : m) + ":" + p2(s%60); }
function renderPx(){
  const P = C.px; if(!P) return;
  const c = findC(P.cid) || { name: P.name };
  const it = P.items[P.idx];
  const last = it ? lastFor(c, it.key) : null;
  const doneEx = P.items.filter(x=> x.sets.some(r=> r.done)).length;
  openSheet(`<div class="sc-px">
    <div class="sheet-header"><h3>${ic("sports_gymnastics")}Tập cùng · ${esc(c.name)}</h3><button class="icon-btn" id="px-x" aria-label="Đóng (lưu nháp)">${ic("close")}</button></div>
    <div class="sc-px-top"><span class="sc-clock">${ic("timer")}<b data-px-clock>${fmtClock(Date.now() - P.startedAt)}</b></span><span>${doneEx}/${P.items.length} bài</span><span class="sc-px-mode">${brandMark("xs")}Ghi thay học viên</span></div>
    <div class="sc-px-chips" role="tablist">${P.items.map((x, i)=> `<button type="button" class="${i === P.idx ? "active" : ""} ${x.sets.some(r=> r.done) ? "ok" : ""}" data-px-go="${i}" aria-label="Bài ${i+1}">${x.sets.some(r=> r.done) ? ic("check") : i+1}<span>${esc(String(x.name).split("(")[0].trim())}</span></button>`).join("")}<button type="button" class="add" id="px-add" aria-label="Thêm bài">${ic("add")}</button></div>
    ${it ? `
    <div class="sc-px-ex">
      ${it.img ? `<img src="${esc(it.img)}" alt="" onerror="this.style.display='none'">` : `<span class="sc-px-n">${P.idx+1}</span>`}
      <div><b>${esc(it.name)}</b><small>Mục tiêu ${esc(it.target)} hiệp × ${esc(it.reps)} · nghỉ ${esc(it.restSec)}s</small>
        ${last ? `<small class="sc-px-last">${ic("history")}Lần trước HV (${ddmm(last.d)}): ${last.s.map(x=> `${kgS(x[0])}×${x[1]}`).join(" · ")}</small>` : ""}</div>
    </div>
    <div class="set-table sc-px-table">
      <div class="set-head"><span>Hiệp</span>${it.timed ? `<span style="flex:2">Mục tiêu</span>` : `<span>Kg</span><span>Lần</span><span class="rpe-h">RPE</span>`}<span></span></div>
      ${it.sets.map((r, i)=> `<div class="set-row ${r.done ? "done" : ""}">
        <b>${i+1}</b>
        ${it.timed ? `<span style="flex:2" class="small-note">${esc(it.reps)}</span>` :
          `<input type="number" inputmode="decimal" min="0" max="500" step="0.5" value="${esc(r.kg)}" data-px-kg="${i}" placeholder="kg" aria-label="Kg hiệp ${i+1}">
           <input type="number" inputmode="numeric" min="0" max="200" value="${esc(r.reps)}" data-px-reps="${i}" placeholder="lần" aria-label="Số lần hiệp ${i+1}">
           <select class="rpe" data-px-rpe="${i}" aria-label="RPE hiệp ${i+1}"><option value="">–</option>${[6,7,7.5,8,8.5,9,9.5,10].map(v=> `<option ${String(r.rpe) === String(v) ? "selected" : ""}>${v}</option>`).join("")}</select>`}
        <button type="button" class="set-check" data-px-done="${i}" aria-label="Xong hiệp ${i+1}">${ic("check")}</button>
      </div>`).join("")}
    </div>
    <div class="sc-row2 sc-px-setbtn"><button type="button" class="btn btn-ghost btn-sm" id="px-minus" ${it.sets.length <= 1 ? "disabled" : ""}>${ic("remove")}Bớt hiệp</button><button type="button" class="btn btn-ghost btn-sm" id="px-plus">${ic("add")}Thêm hiệp</button></div>
    <div class="set-rest sc-px-rest" id="px-rest" hidden>${ic("timer")}<b id="px-rest-n">0</b><small>giây nghỉ</small><button type="button" id="px-rest-plus">+15s</button><button type="button" id="px-rest-skip">Bỏ qua</button></div>
    <div class="sc-row2"><button type="button" class="btn btn-outline btn-block" id="px-prev" ${P.idx === 0 ? "disabled" : ""}>${ic("chevron_left")}Bài trước</button><button type="button" class="btn btn-outline btn-block" id="px-next">${P.idx < P.items.length - 1 ? "Bài tiếp" : "Thêm bài"}${ic("chevron_right")}</button></div>
    <button type="button" class="btn btn-ghost btn-block btn-sm" id="px-del">${ic("delete")}Bỏ bài này khỏi buổi</button>`
    : `<div class="sc-empty">${ic("fitness_center")}<b>Chưa có bài nào</b><p>Thêm bài từ thư viện để bắt đầu ghi.</p></div>`}
    <div class="field" style="margin-top:12px;"><label for="px-note">Ghi chú cho học viên (không bắt buộc)</label><textarea id="px-note" rows="2" maxlength="500" placeholder="VD: Squat xuống sâu hơn tuần trước, giữ lưng tốt">${esc(P.note || "")}</textarea></div>
    <button type="button" class="btn btn-primary btn-block" id="px-finish" ${doneEx ? "" : "disabled"}>${ic("task_alt")}Kết thúc &amp; lưu vào nhật ký học viên</button>
    <p class="small-note" style="text-align:center;">Chỉ các hiệp đã đánh dấu ✓ được lưu. Học viên nhận vào nhật ký khi mở app.</p>
  </div>`);
  onSheetCloseHook = ()=>{ stopPxTimers(); if(C.px){ saveDraft(); toast("Đã lưu nháp buổi tập cùng", "edit_note"); C.px = null; } };
  clearInterval(pxTick);
  pxTick = setInterval(()=>{ const el = q("[data-px-clock]"); if(!el || !C.px){ clearInterval(pxTick); return; } el.textContent = fmtClock(Date.now() - C.px.startedAt); }, 1000);
  bindPx();
}
function bindPx(){
  const P = C.px; if(!P) return;
  const it = P.items[P.idx];
  const keepNote = ()=>{ const n = q("#px-note"); if(n) P.note = n.value; };
  const rerender = ()=>{ keepNote(); saveDraft(); onSheetCloseHook = null; renderPx(); };
  q("#px-x").addEventListener("click", ()=> closeSheet());
  qa("[data-px-go]").forEach(b=> b.addEventListener("click", ()=>{ P.idx = Number(b.dataset.pxGo); rerender(); }));
  q("#px-add").addEventListener("click", ()=>{ keepNote(); saveDraft(); onSheetCloseHook = null; openPxPicker(); });
  if(it){
    const clamp = (v, a, b)=> Math.min(b, Math.max(a, Number(v)||0));
    qa("[data-px-kg]").forEach(inp=> inp.addEventListener("change", ()=>{ const v = clamp(inp.value, 0, 500); inp.value = v; it.sets[inp.dataset.pxKg].kg = v; saveDraft(); }));
    qa("[data-px-reps]").forEach(inp=> inp.addEventListener("change", ()=>{ const v = Math.round(clamp(inp.value, 0, 200)); inp.value = v; it.sets[inp.dataset.pxReps].reps = v; saveDraft(); }));
    qa("[data-px-rpe]").forEach(sel=> sel.addEventListener("change", ()=>{ it.sets[sel.dataset.pxRpe].rpe = sel.value; saveDraft(); }));
    qa("[data-px-done]").forEach(b=> b.addEventListener("click", ()=>{
      const i = Number(b.dataset.pxDone), r = it.sets[i];
      // đọc giá trị đang gõ (chưa "change")
      const kgI = q(`[data-px-kg="${i}"]`), rpI = q(`[data-px-reps="${i}"]`);
      if(kgI && kgI.value !== "") r.kg = Number(kgI.value)||0;
      if(rpI && rpI.value !== "") r.reps = Number(rpI.value)||0;
      r.done = !r.done;
      const row = b.closest(".set-row"); if(row) row.classList.toggle("done", r.done);
      if(r.done && i < it.sets.length - 1 && it.restSec > 0) pxStartRest(it.restSec);
      if(r.done && i === it.sets.length - 1 && P.idx < P.items.length - 1) toast("Xong bài — chuyển bài tiếp khi sẵn sàng", "check_circle");
      saveDraft();
      const fin = q("#px-finish"); if(fin) fin.disabled = !P.items.some(x=> x.sets.some(z=> z.done));
    }));
    q("#px-plus").addEventListener("click", ()=>{ const l = it.sets[it.sets.length-1] || { kg:"", reps:"" }; it.sets.push({ kg:l.kg, reps:l.reps, rpe:"", done:false }); rerender(); });
    q("#px-minus").addEventListener("click", ()=>{ if(it.sets.length > 1){ it.sets.pop(); rerender(); } });
    q("#px-prev").addEventListener("click", ()=>{ if(P.idx > 0){ P.idx--; rerender(); } });
    q("#px-next").addEventListener("click", ()=>{ if(P.idx < P.items.length - 1){ P.idx++; rerender(); } else { keepNote(); saveDraft(); onSheetCloseHook = null; openPxPicker(); } });
    q("#px-del").addEventListener("click", ()=>{ P.items.splice(P.idx, 1); P.idx = Math.max(0, Math.min(P.idx, P.items.length - 1)); rerender(); });
  }
  q("#px-finish").addEventListener("click", async ()=>{
    keepNote();
    const btn = q("#px-finish"); btn.disabled = true; btn.textContent = "Đang lưu…";
    try{
      const saved = await S.saveProxyLog(P.cid, { title: P.title, startedAt: P.startedAt, date: tday(), note: P.note,
        durationMin: Math.round((Date.now() - P.startedAt)/60000), exercises: P.items.map(x=> ({ key:x.key, exerciseId:x.exerciseId, name:x.name, muscle:x.muscle, reps:x.reps, timed:x.timed, img:x.img, sets:x.sets.filter(r=> r.done) })) }, P.sid);
      const sum = { n: P.items.filter(x=> x.sets.some(r=> r.done)).length, sets: saved.proxyLog ? saved.proxyLog.sets : 0, vol: saved.proxyLog ? saved.proxyLog.volume : 0 };
      C.px = null; st().draft = null; save(); stopPxTimers(); onSheetCloseHook = null;
      openSheet(`<div class="sc-done">
        <div class="sc-done-ic">${ic("task_alt")}</div>
        <h3>Đã lưu buổi tập cùng!</h3>
        <p class="small-note">${sum.n} bài · ${sum.sets} hiệp${sum.vol ? ` · ${viN(sum.vol)} kg tổng khối lượng` : ""}</p>
        <p class="small-note">Buổi đã được đánh dấu <b>Đã tập</b> (trừ vào gói) và sẽ tự vào nhật ký + biểu đồ 1RM của học viên khi họ mở app.</p>
        <button type="button" class="btn btn-primary btn-block" onclick="closeSheet()">Xong</button>
      </div>`);
      try{ await reloadClient(); }catch(e){ refreshCoachData(true); }
    }catch(e){ toast(esc(e.message), "error"); btn.disabled = false; btn.innerHTML = `${ic("task_alt")}Kết thúc &amp; lưu vào nhật ký học viên`; }
  });
}
function pxStartRest(sec){
  const box = q("#px-rest"); if(!box) return;
  clearInterval(pxRest && pxRest.t);
  pxRest = { left: sec };
  box.hidden = false; q("#px-rest-n").textContent = sec;
  pxRest.t = setInterval(()=>{
    const n = q("#px-rest-n"); if(!n || !pxRest){ clearInterval(pxRest && pxRest.t); return; }
    pxRest.left--; n.textContent = Math.max(0, pxRest.left);
    if(pxRest.left <= 0){ clearInterval(pxRest.t); box.hidden = true; try{ if(typeof beep === "function") beep(); }catch(e){} toast("Hết giờ nghỉ — vào hiệp tiếp!", "timer"); }
  }, 1000);
  q("#px-rest-plus").onclick = ()=>{ if(pxRest){ pxRest.left += 15; q("#px-rest-n").textContent = pxRest.left; } };
  q("#px-rest-skip").onclick = ()=>{ clearInterval(pxRest && pxRest.t); box.hidden = true; };
}
function openPxPicker(filter){
  const P = C.px; if(!P) return;
  const c = findC(P.cid);
  const fq = L.normS(filter || "");
  const recent = c && c.trainingSync && c.trainingSync.ex ? Object.keys(c.trainingSync.ex).filter(k=> typeof EXERCISES !== "undefined" && EXERCISES[k]).slice(0, 8) : [];
  const all = typeof EXERCISES !== "undefined" ? Object.entries(EXERCISES).filter(([id, e])=> !fq || L.normS(e.name + " " + e.muscle).includes(fq)) : [];
  const groups = {};
  all.forEach(([id, e])=> (groups[e.muscle] = groups[e.muscle] || []).push([id, e]));
  const row = (id, e)=> `<button type="button" class="sc-pick" data-px-pick="${esc(id)}">${e.img ? `<img class="sc-av" src="${esc(e.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="sc-av ini">${esc(initials(e.name))}</span>`}<div><b>${esc(e.name)}</b><small>${esc(e.muscle)} · ${esc(e.sets)}×${esc(e.reps)}</small></div>${ic("add_circle")}</button>`;
  openSheet(`
    <div class="sheet-header"><button class="icon-btn" id="pk-back" aria-label="Quay lại">${ic("arrow_back")}</button><h3 style="flex:1;margin-left:8px;">Thêm bài tập</h3></div>
    <div class="ptp-search sc-search">${ic("search")}<input id="pk-q" type="search" placeholder="Tìm bài, nhóm cơ…" value="${esc(filter || "")}" aria-label="Tìm bài tập" autocomplete="off"></div>
    ${typeof openExDbPicker === "function" ? `<button type="button" class="btn btn-soft btn-sm" id="pk-db" style="margin:8px 0;">${ic("library_books")}Thư viện 800+ bài</button>` : ""}
    ${!fq && recent.length ? `<div class="sc-sub">Học viên tập gần đây</div>${recent.map(id=> row(id, EXERCISES[id])).join("")}` : ""}
    ${Object.entries(groups).map(([m, arr])=> `<div class="sc-sub">${esc(m)}</div>${arr.map(([id, e])=> row(id, e)).join("")}`).join("") || `<p class="empty-hint">Không tìm thấy bài phù hợp.</p>`}`);
  q("#pk-back").addEventListener("click", ()=> renderPx());
  const inp = q("#pk-q"); let t = null;
  inp.addEventListener("input", ()=>{ clearTimeout(t); t = setTimeout(()=>{ openPxPicker(inp.value); const n = q("#pk-q"); if(n){ n.focus(); try{ n.setSelectionRange(n.value.length, n.value.length); }catch(e){} } }, 250); });
  qa("[data-px-pick]").forEach(b=> b.addEventListener("click", ()=>{
    const id = b.dataset.pxPick, e = EXERCISES[id];
    P.items.push(buildRows(c, { key:id, exerciseId:id, name:e.name, img:e.img || "", muscle:e.muscle || "", reps:String(e.reps||"10"), restSec:Number(e.restSec)||90, target:Number(e.sets)||3 }));
    P.idx = P.items.length - 1; saveDraft(); renderPx();
  }));
  const db = q("#pk-db"); if(db) db.addEventListener("click", ()=> openExDbPicker(items=>{
    (items||[]).forEach(x=>{ const id = exIdByName(x.name || ""); P.items.push(buildRows(c, { key: id || ("c:" + x.name), exerciseId: id, name: x.name, img: x.img || "", muscle: x.muscle || "", reps: String(x.reps || "10"), restSec: Number(x.restSec)||90, target: Number(x.sets)||3 })); });
    P.idx = Math.max(0, P.items.length - 1); saveDraft(); renderPx();
  }, { multi:true }));
}

/* ---------------------------------------------------------------------
   13. THEO DÕI REALTIME (form của tôi + lời mời)
   --------------------------------------------------------------------- */
function stopWatch(){ try{ C.watchStop && C.watchStop(); }catch(e){} try{ C.invStop && C.invStop(); }catch(e){} C.watchStop = C.invStop = null; }
function startWatch(){
  stopWatch();
  if(!cloud.isLoggedIn()) return;
  C.watchStop = S.watchClients((role, list)=>{
    const pd = PD(); if(!pd.loaded) return;
    const key = role === "pt" ? "asPT" : "asStudent";
    const before = (pd[key] || []).map(c=> c.id + ":" + (c.studentUid || "") + ":" + (c.ptId || "")).sort().join("|");
    const map = {}; (pd[key] || []).forEach(c=> map[c.id] = c);
    pd[key] = list.map(c=> map[c.id] ? Object.assign(map[c.id], c) : c);
    const after = pd[key].map(c=> c.id + ":" + (c.studentUid || "") + ":" + (c.ptId || "")).sort().join("|");
    paintBadge();
    if(C.chat && C.chat.paint) C.chat.paint();
    if(before !== after){ if(typeof refreshCoachData === "function") refreshCoachData(true); }
  });
  C.invStop = S.watchInvites(list=>{
    const had = (C.invites||[]).length;
    C.invites = list; paintBadge();
    if(list.length > had){ toast(`Bạn có lời mời từ PT ${esc(list[0].ptBrand || list[0].ptName || "")}`, "inbox"); rerenderCoach(); }
  });
}

/* ---------------------------------------------------------------------
   14. TÍCH HỢP (ghi đè hàm toàn cục — luôn gọi lại hàm cũ, bọc try/catch)
   --------------------------------------------------------------------- */
function install(){
  addIcons();
  ensureTabs();
  st();
  // App Store 1.2: chặn / bỏ chặn → vẽ lại khung chat đang mở (form học viên; màn PT do coach.js vẽ lại), lời mời, huy hiệu
  try{ document.addEventListener("fk:blocks-changed", ()=>{
    try{ const ch = C.chat, a = q(".screen.active");
      if(ch && ch.host && visible(ch.box) && !(a && a.id === "screen-coach")){ try{ ch.box.remove(); }catch(e){} mountChat(ch.host, ch.cid, ch.role, ch.opts); } }catch(e){ warn("block", e); }
    paintBadge(); loadInvites().then(()=>{ paintBadge(); }).catch(()=>{});
  }); }catch(e){}
  // Màn PT
  if(typeof renderCoachScreen === "function"){
    const _r = renderCoachScreen;
    renderCoachScreen = function(){ stopChatIfHidden(); const r = _r.apply(this, arguments); try{ enhanceCoachScreen(); paintBadge(); }catch(e){ warn("coach", e); } return r; };
  }
  // Form học viên
  if(typeof renderClientForm === "function"){
    const _rcf = renderClientForm;
    renderClientForm = function(){
      let mine = null;
      try{ ensureTabs(); mine = (typeof cf !== "undefined" && MY_TABS[cf.tab]) ? cf.tab : null; }catch(e){}
      if(mine){
        const c = typeof cfClient === "function" ? cfClient() : findC(cf.cid);
        cf.tab = "info";
        try{ _rcf.apply(this, arguments); } finally { cf.tab = mine; }
        if(!c) return;
        try{
          const cc = q("#client-content"); cc.classList.remove("ptp-tabbody");
          qa("#client-tabs [data-cft]").forEach(b=> b.classList.toggle("active", b.dataset.cft === mine));
          const act = q(`#client-tabs [data-cft="${mine}"]`); if(act && act.scrollIntoView) act.scrollIntoView({ inline:"center", block:"nearest" });
          MY_TABS[mine](cc, c);
          postTab(c);
        }catch(e){ warn("tab", e); q("#client-content").innerHTML = `<p class="empty-hint">Không hiển thị được mục này.</p>`; }
        return;
      }
      stopChat();
      const r = _rcf.apply(this, arguments);
      try{ const c = typeof cfClient === "function" ? cfClient() : null; if(c) postTab(c); }catch(e){ warn("post", e); }
      return r;
    };
  }
  // Huy hiệu nav
  if(typeof updateCoachBadge === "function"){
    const _u = updateCoachBadge;
    updateCoachBadge = function(){ const r = _u.apply(this, arguments); try{ paintBadge(); }catch(e){} return r; };
  }
  // Sau mỗi lần tải dữ liệu PT: lời mời, buổi "log thay", đồng bộ nhật ký
  if(typeof refreshCoachData === "function"){
    const _rc = refreshCoachData;
    refreshCoachData = function(){
      const p = _rc.apply(this, arguments);
      Promise.resolve(p).then(async ()=>{
        if(!cloud.isLoggedIn()) return;
        await Promise.all([loadInvites(), loadSent()]);
        paintBadge();
        await applyPendingProxyLogs();
        scheduleSync();
        const a = q(".screen.active");
        if(a && a.id === "screen-coach"){
          const body = q("#coach-tab-body");
          const needInbox = (C.invites||[]).length && body && !q(".sc-inbox", body) && typeof coachTab !== "undefined" && coachTab === "coaches";
          const needSent = amPT() && body && !q(".sc-sent", body) && (C.sent||[]).some(i=> i.status === "pending");
          if(needInbox || needSent) rerenderCoach();
        }
      }).catch(e=> warn("refresh", e));
      return p;
    };
  }
  // Mã mời: dùng sheet mới (xem trước PT → chấp nhận / từ chối)
  if(typeof openJoinSheet === "function"){ openJoinSheet = function(){ return openJoin(); }; }
  if(typeof showInviteSheet === "function"){ showInviteSheet = function(c){ return openInviteSheet(c, "code"); }; }
  try{ if(typeof inviteText === "function") inviteText = ptInviteText; }catch(e){}
  // Hàng học viên: số tin nhắn chưa đọc
  if(typeof clientRowHTML === "function"){
    const _row = clientRowHTML;
    clientRowHTML = function(c, role){
      let h = _row.apply(this, arguments);
      try{
        const u = S.chatInfo(c, role).unread;
        if(u){
          const badge = `<span class="sc-row-chat" title="${u} tin nhắn mới">${ic("forum")}<b>${u}</b></span>`;
          const k = h.lastIndexOf('<span class="material-symbols-rounded"');
          h = k > 0 ? h.slice(0, k) + badge + h.slice(k) : h;
        }
        const sy = c.trainingSync && !c.trainingSync.off && c.trainingSync.workouts && c.trainingSync.workouts.length ? c.trainingSync.workouts[c.trainingSync.workouts.length-1] : null;
        if(role === "pt" && sy){ const k2 = h.indexOf('<div class="meta"'); if(k2 > 0) h = h.slice(0, k2) + `<div class="meta sc-row-sync">${ic("sync")}Tập gần nhất: ${esc(rel(sy.d))}${sy.by === "self" ? " · tự tập" : ""}</div>` + h.slice(k2); }
      }catch(e){}
      return h;
    };
  }
  // Học viên kết thúc buổi PT giao trong app → gửi kết quả cho PT
  if(typeof finishSession === "function"){
    const _f = finishSession;
    finishSession = function(){
      let s = null, tpLen = 0;
      try{ s = typeof session !== "undefined" ? session : null; tpLen = state.trainingPro && state.trainingPro.log ? state.trainingPro.log.length : 0; }catch(e){}
      const r = _f.apply(this, arguments);
      /* integrator (FIX-core vòng 2 #7): buổi bị chặn "< 3 phút" (app.js fkSessionGate → s.tooShort) → KHÔNG gửi kết quả cho PT */
      try{ if(s && s._pt && !s.tooShort) finishPTSession(s, tpLen); else if(s && s.isToday) scheduleSync(); }catch(e){ warn("finish", e); }
      return r;
    };
  }
  // Ngày có buổi PT (giao / ghi thay) luôn tính là ngày đã tập
  if(typeof updateFinishedDates === "function"){
    const _ufd = updateFinishedDates;
    updateFinishedDates = function(){
      const r = _ufd.apply(this, arguments);
      try{ const td = tday(), w = state.workoutLog && state.workoutLog[td]; if(w && (w.byPT || w.ptSession) && !state.finishedDates.includes(td)){ state.finishedDates.push(td); save(); } }catch(e){}
      return r;
    };
  }
  // Rời màn → dừng nghe chat
  if(typeof goto === "function"){
    const _g = goto;
    goto = function(screen){ if(screen !== "client" && screen !== "coach") stopChat(); return _g.apply(this, arguments); };
  }
  // Đăng nhập / đăng xuất
  try{ cloud.onAuth(()=>{ stopChat(); C.invites = []; C.sent = []; C.ptProfiles = {}; startWatch(); paintBadge(); maybePendingJoin(); }); }catch(e){}
  try{ document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState === "visible" && C.chat && C.chat.markRead) C.chat.markRead(); }); }catch(e){}
  // Link mời ?join=MÃ
  try{
    const m = String(location.search + location.hash).match(/[?&#]join=([A-Za-z0-9]{6,10})(?![A-Za-z0-9])/);   // mã mời 6–10 ký tự (FIX-security #1)
    if(m){ st().pendingJoin = m[1].toUpperCase(); save(); try{ history.replaceState(null, "", location.pathname); }catch(e){} }
  }catch(e){}
  Promise.resolve(cloud.init && cloud.init()).then(()=>{ startWatch(); paintBadge(); maybePendingJoin(); }).catch(()=>{});
  // Module nạp sau appBoot(): vẽ lại màn đang mở
  try{ const a = q(".screen.active"); if(a && a.id === "screen-coach") renderCoachScreen(false); if(a && a.id === "screen-client") renderClientForm(); }catch(e){}
  return true;
}
function stopChatIfHidden(){ if(C.chat && !visible(C.chat.box)) stopChat(); }
function maybePendingJoin(){
  const code = st().pendingJoin; if(!code || !cloud.isLoggedIn()) return;
  st().pendingJoin = null; save();
  setTimeout(()=> openJoin(code), 600);
}

Object.assign(TE, {
  QR, joinUrl, openInviteSheet, openInvitePicker, openJoin, openProxyLogger, startPTSession, applyPendingProxyLogs, syncNow, scheduleSync,
  progressModel, progressHTML, lineSVG, barsSVG, unreadTotal, paintBadge, mountChat, stopChat, inboxHTML, hubHTML, toPlanItem, msgsHTML, pickProxySession,
  _C: C, state: st,
});
try{ TE.installed = install(); }catch(e){ warn("không cài được", e); }
})();

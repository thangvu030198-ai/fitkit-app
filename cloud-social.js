/* =========================================================================
   TapEasy — LỚP DỮ LIỆU XÃ HỘI (cloud-social.js)
   Mở rộng đối tượng `cloud` (cloud.js) bằng `cloud.social`:
     1. Lời mời PT → học viên (email hoặc mã mời 6–10 ký tự / QR) · chấp nhận / từ chối / huỷ
     2. Chat 1-1 PT ↔ học viên: tin nhắn, ảnh nhỏ đã nén, trạng thái "đã xem",
        realtime (onSnapshot) khi Firebase · hỏi lại mỗi 5 giây khi demo
     3. Đồng bộ nhật ký tập của học viên (setLog / setHist / workoutLog tóm tắt) lên form để PT xem
     4. PT ghi buổi tập thay học viên ("Tập cùng — log thay") → đẩy về nhật ký học viên khi học viên mở app
     5. Cộng đồng: routine công khai — đăng, thích, lưu, sao chép, báo cáo vi phạm, tìm kiếm / lọc
     6. Kiểm duyệt cơ bản: lọc từ ngữ thô tục tiếng Việt, ẩn nội dung bị báo cáo ≥ 3 lần

   Hai "động cơ" giống cloud.js:
     - demo     : localStorage riêng, key "tapeasy_social_demo_v1"
     - firebase : firebase.firestore() toàn cục khi cloud.mode === "firebase"

   Dữ liệu Firestore (xem docs/INTEGRATION-social.md để có rules):
     invites/{id}                    { clientId, ptId, ptName, ptBrand, ptPhoto, email, code, name, message,
                                       status:"pending"|"accepted"|"declined"|"cancelled", createdAt, respondedAt, studentUid, studentName }
     clients/{cid}.chat              { n:{pt,student}, read:{pt,student}, readAt:{pt,student}, last:{ts,role,name,text} }
     clients/{cid}.trainingSync      tóm tắt nhật ký tập do app học viên ghi (≤ ~60 KB)
     clients/{cid}/messages/{id}     { from, role:"pt"|"student", name, text, img, kind:"text"|"image"|"log"|"system", meta, ts }
     clients/{cid}/sessions/{id}     + proxyLog { by, byName, at, date, title, exercises[], volume, sets, durationMin, note } + proxyApplied
     routines/{id}                   routine công khai + bộ đếm likes / saves / copies / reports, hidden
     routines/{id}/likes|saves|copies|reports/{uid}
     userSocial/{uid}                { liked:[], saved:[], copied:[], reported:[] }
   Nạp SAU cloud.js (khuyến nghị: sau pt-pro.js, trước pt-connect.js / community.js).
   ========================================================================= */
(function(){
"use strict";
if(typeof cloud === "undefined" || !cloud) return;
if(cloud.social && cloud.social.__v) return;

const DEMO_KEY = "tapeasy_social_demo_v1";
const CLOUD_DEMO_KEY = "fitkit_cloud_demo_v1";       // kho demo của cloud.js (chỉ đọc joinCodes)
const POLL_MS = 5000;
const REPORT_HIDE = 3;
const MAX_MSG_LEN = 2000;
const MAX_IMG_CHARS = 140000;                       // ảnh chat (dataURL) ≤ ~100 KB
const SYNC_MAX_CHARS = 60000;                       // trainingSync ≤ ~60 KB (giới hạn 1 MiB / doc Firestore)
const DAY = 86400000;

const now = ()=> Date.now();
const rid = (p="id")=> `${p}${now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const lc = s=> String(s==null ? "" : s).trim().toLowerCase();
const clean = o=> JSON.parse(JSON.stringify(o == null ? null : o));
const pad = n=> String(n).padStart(2, "0");
const dstr = d=> `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayS = ()=> (typeof todayStr === "function" ? todayStr() : dstr(new Date()));
const dparse = s=>{ const [y,m,d] = String(s||"").split("-").map(Number); return new Date(y||1970, (m||1)-1, d||1); };
const dadd = (s, n)=>{ const x = dparse(s); x.setDate(x.getDate()+n); return dstr(x); };
const isDate = s=> /^\d{4}-\d{2}-\d{2}$/.test(String(s||""));
/* FIX-security #1 (vòng 2): mã mời 6–10 ký tự — mã cũ 6, mã mới 8 (cloud.js JOIN_CODE_LEN) */
const CODE_MIN = 6, CODE_MAX = 10;
const CODE_RE = /^[A-Z0-9]{6,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const r1 = n=> Math.round(n*10)/10;
function hashStr(s){ let h = 5381; s = String(s); for(let i=0;i<s.length;i++) h = ((h<<5) + h + s.charCodeAt(i)) | 0; return (h>>>0).toString(36); }

function err(msg, code){ const e = new Error(msg); e.code = code || "social/error"; return e; }
const ERR = {
  "permission-denied": "Máy chủ chưa cho phép thao tác này. Chủ app cần cập nhật firestore.rules (xem INTEGRATION-social.md).",
  "unavailable": "Không kết nối được máy chủ, kiểm tra mạng rồi thử lại.",
  "not-found": "Dữ liệu không còn tồn tại.",
  "failed-precondition": "Máy chủ cần tạo chỉ mục (index) cho truy vấn này — xem INTEGRATION-social.md.",
  "resource-exhausted": "Dữ liệu quá lớn hoặc vượt hạn mức, thử lại với ảnh nhỏ hơn.",
};
function nice(e){
  if(e && e.code && String(e.code).startsWith("social/")) return e;
  const code = e && (e.code || "");
  const m = ERR[code] || (e && e.message) || "Đã có lỗi xảy ra.";
  return err(m, code || "social/error");
}
const wrap = fn=> async (...a)=>{ try{ return await fn(...a); }catch(e){ throw nice(e); } };

const me = ()=> cloud.user || null;
function needUser(){ const u = me(); if(!u) throw err("Bạn cần đăng nhập để dùng tính năng này.", "social/auth"); return u; }
const isFb = ()=> cloud.mode === "firebase" && typeof firebase !== "undefined" && !!firebase.firestore;
const fdb = ()=> firebase.firestore();
const FV = ()=> firebase.firestore.FieldValue;
const qd = q=> q.docs.map(d=> Object.assign({ id:d.id }, d.data()));
const dd = d=> d && d.exists ? Object.assign({ id:d.id }, d.data()) : null;

/* =====================================================================
   0. KIỂM DUYỆT: từ ngữ thô tục tiếng Việt (có dấu, không dấu, teencode)
   — Chỉ so khớp NGUYÊN TỪ để tránh bắt nhầm: "buổi", "đeo", "lon nước", "các", "du lịch", "70 cm"…
   ===================================================================== */
const BAD_TOKENS = new Set([
  // có dấu (khớp chính xác, không bỏ dấu vì dễ trùng từ thường)
  "đụ","địt","đéo","đĩ","lồn","cặc","buồi","điếm","cứt","đcm","đm","đmm","đkm","đmcs","đjt","đ!t",
  // teencode / không dấu không gây nhầm
  "dm","dmm","dcm","dkm","dmcs","vcl","vkl","vl","vcc","clgt","cmm","loz","lìn","dit","djt","cak","cax","đếch",
  // tiếng Anh phổ biến
  "fuck","fucking","fck","fuk","shit","bitch","dick","pussy","cunt","motherfucker","asshole",
]);
const BAD_PHRASES = [
  "địt mẹ","đụ má","đù má","đụ mẹ","đéo biết","con mẹ mày","mẹ mày","bố mày","óc chó","đồ chó","thằng chó","con chó cái",
  "súc vật","khốn nạn","mất dạy","đồ ngu","thằng ngu","con ngu","ngu như bò","óc lợn","óc bò","cái lồn","con cặc",
  "du ma","du me","dit me","dit con me","con cac","cai lon","oc cho","do ngu","thang ngu","me may","di me",
];
const normVi = s=> String(s==null ? "" : s).normalize("NFC").toLowerCase();
const stripVi = s=> normVi(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const TOKEN_RE = /[\p{L}\p{N}!*]+/gu;
function tokenBad(tok){
  if(!tok) return false;
  const t = tok.replace(/^[!*]+|[!*]+$/g, "");
  if(!t) return false;
  const c1 = t.replace(/(.)\1+/gu, "$1"), c2 = t.replace(/(.)\1{2,}/gu, "$1$1");
  return BAD_TOKENS.has(t) || BAD_TOKENS.has(c2) || (c1.length >= 3 && BAD_TOKENS.has(c1)) || BAD_TOKENS.has(t.replace(/[*]/g, ""));
}
function findProfanity(text){
  const s = normVi(text);
  if(!s.trim()) return [];
  const hits = new Set();
  const toks = s.match(TOKEN_RE) || [];
  toks.forEach(t=>{ if(tokenBad(t)) hits.add(t); });
  // ghép các ký tự lẻ liên tiếp: "v.c.l", "đ m" → "vcl", "đm"
  let run = "";
  const flush = ()=>{ if(run.length >= 2 && tokenBad(run)) hits.add(run); run = ""; };
  toks.forEach(t=>{ if([...t].length === 1) run += t; else flush(); }); flush();
  const spaced = " " + toks.join(" ") + " ";
  BAD_PHRASES.forEach(p=>{ if(spaced.includes(" " + p + " ")) hits.add(p); });
  return [...hits];
}
function cleanText(text){
  let out = String(text==null ? "" : text).normalize("NFC");
  if(!findProfanity(out).length) return out;
  out = out.replace(/[\p{L}\p{N}!*]+/gu, w=> tokenBad(normVi(w)) ? "*".repeat([...w].length) : w);
  BAD_PHRASES.forEach(p=>{
    const re = new RegExp("(^|[^\\p{L}])(" + p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+") + ")(?=$|[^\\p{L}])", "giu");
    out = out.replace(re, (m0, pre, w)=> pre + w.replace(/[^\s]/gu, "*"));
  });
  return findProfanity(out).length ? "[Nội dung đã được ẩn vì vi phạm tiêu chuẩn cộng đồng]" : out;
}

/* =====================================================================
   1. LOGIC THUẦN (dùng chung cho UI & kiểm thử)
   ===================================================================== */
const otherRole = r=> r === "pt" ? "student" : "pt";
function chatInfo(client, role){
  const c = (client && client.chat) || {};
  const n = c.n || {}, read = c.read || {}, readAt = c.readAt || {};
  const o = otherRole(role);
  return {
    unread: Math.max(0, (Number(n[o])||0) - (Number(read[role])||0)),
    sentByOther: Number(n[o])||0, sentByMe: Number(n[role])||0,
    otherReadAt: Number(readAt[o])||0, myReadAt: Number(readAt[role])||0,
    last: c.last || null,
  };
}

/* ---- Hàm tạ / lần (dùng của app.js nếu có) ---- */
const _repTop = r=>{ if(typeof repTop === "function") return repTop(r); const m = String(r||"").match(/(\d+)\s*[-–]\s*(\d+)/); if(m) return Number(m[2]); const n = String(r||"").match(/^\s*(\d+)/); return n ? Number(n[1]) : 0; };
const _repBottom = r=>{ if(typeof repBottom === "function") return repBottom(r); const m = String(r||"").match(/(\d+)\s*[-–]\s*(\d+)/); return m ? Number(m[1]) : _repTop(r); };
const _isMax = r=> /tối đa|max|amrap/i.test(String(r||""));
const _isTimed = r=>{ if(typeof isTimedReps === "function") return isTimedReps(r); const s = String(r||""); if(_isMax(s)) return false; return /giây|phút|(^|\s)\d*\s*m(\s|$|\/)|km|vòng|\d+\s*s(\s|$|\/)/i.test(s) || !_repTop(s); };
const _e1rm = (kg, reps)=>{ if(typeof e1rm === "function") return e1rm(kg, reps); kg = Number(kg)||0; reps = Math.min(12, Number(reps)||0); if(!kg || !reps) return 0; return reps===1 ? kg : kg*(1+reps/30); };
const dayKeyOf = date=> ["CN","T2","T3","T4","T5","T6","T7"][dparse(date).getDay()];

/* Tóm tắt nhật ký tập của học viên để PT xem (gọn, ≤ SYNC_MAX_CHARS) */
function buildTrainingSummary(st, opts){
  st = st || {}; opts = opts || {};
  const today = opts.today || todayS();
  const from60 = dadd(today, -60), from120 = dadd(today, -120);
  const p = st.profile || {};
  const hist = st.setHist || {}, slog = st.setLog || {};
  // Buổi tập: ưu tiên nhật ký training-pro (có khối lượng, thời gian), bổ sung workoutLog
  const workouts = {};
  const tp = st.trainingPro && Array.isArray(st.trainingPro.log) ? st.trainingPro.log : [];
  tp.forEach(l=>{ if(!l || !isDate(l.date) || l.date < from60) return;
    const w = workouts[l.date] = workouts[l.date] || { d:l.date, t:l.title||"", n:0, tot:0, vol:0, dur:0, by:"self" };
    w.n += Number(l.completed)||0; w.tot += Number(l.total)||0; w.vol += Number(l.volume)||0; w.dur += Math.round((Number(l.dur)||0)/60);
    if(l.byPT) w.by = "pt"; if(!w.t) w.t = l.title || ""; });
  Object.entries(st.workoutLog || {}).forEach(([d, l])=>{
    if(!isDate(d) || d < from60 || !l) return;
    const done = (l.completedExerciseIds||[]).length;
    if(!done && !l.byPT && !l.ptSession) return;
    const w = workouts[d] = workouts[d] || { d, t:"", n:0, tot:0, vol:0, dur:0, by:"self" };
    if(!w.n) w.n = done;
    if(l.byPT){ w.by = "pt"; if(!w.t) w.t = l.byPT.title || "Buổi tập cùng PT"; }
    else if(l.ptSession && w.by !== "pt"){ w.by = "ptsess"; if(!w.t) w.t = l.ptSession.title || "Buổi PT giao"; }
    if(!w.t && l.dayKey && st.plans && st.activePlanId && st.plans[st.activePlanId] && st.plans[st.activePlanId].days[l.dayKey]) w.t = st.plans[st.activePlanId].days[l.dayKey].title || "";
  });
  // QP-22 (fix-pt): tóm tắt gửi cho TỪNG PT — bỏ buổi tập với PT khác (byPT / ptSession thuộc form khác)
  const foreign = new Set();
  if(opts.forCid){
    Object.entries(st.workoutLog || {}).forEach(([d, l])=>{
      const tag = l && (l.byPT || l.ptSession);
      if(tag && tag.cid && tag.cid !== opts.forCid){ foreign.add(d); delete workouts[d]; }
    });
  }
  const finished = (st.finishedDates || []).filter(d=> isDate(d) && d >= from120 && !foreign.has(d)).sort();
  finished.forEach(d=>{ if(d >= from60 && !workouts[d]) workouts[d] = { d, t:"", n:0, tot:0, vol:0, dur:0, by:"self" }; });
  const wl = Object.values(workouts).sort((a,b)=> a.d.localeCompare(b.d)).slice(-60)
    .map(w=>{ const o = { d:w.d, n:w.n, by:w.by }; if(w.t) o.t = String(w.t).slice(0,60); if(w.tot) o.tot = w.tot; if(w.vol) o.vol = Math.round(w.vol); if(w.dur) o.dur = w.dur; return o; });
  // Cân nặng
  const weights = {};
  (st.inbodyLogs || []).forEach(l=>{ if(l && Number(l.weight) > 0 && l.ts){ weights[dstr(new Date(l.ts))] = r1(Number(l.weight)); } });
  if(Number(p.weight) > 0 && !Object.keys(weights).length) weights[today] = r1(Number(p.weight));
  const wts = Object.entries(weights).sort((a,b)=> a[0].localeCompare(b[0])).slice(-60);
  // Bài tập: 1RM theo thời gian + lần tập gần nhất (để PT điền sẵn tạ khi "log thay")
  const exAll = Object.keys(Object.assign({}, hist, slog)).map(k=>{
    const h = hist[k] || { list:[] }, l = slog[k];
    const lastD = [(h.list.length ? h.list[h.list.length-1].date : ""), (l && l.date) || ""].sort().pop();
    return { k, h, l, lastD };
  }).filter(x=> x.lastD).sort((a,b)=> b.lastD.localeCompare(a.lastD));
  const mk = (limitEx, limitPts)=>{
    const ex = {};
    exAll.slice(0, limitEx).forEach(({ k, h, l })=>{
      const pts = (h.list||[]).filter(x=> isDate(x.date)).slice(-limitPts).map(x=> [x.date, r1(Number(x.e1rm)||0), Number(x.top)||0, Math.round(Number(x.vol)||0)]);
      const o = { n: String(h.name || (typeof EXERCISES !== "undefined" && EXERCISES[k] && EXERCISES[k].name) || k.replace(/^c:/, "")).slice(0,80) };
      if(pts.length) o.h = pts;
      if(l && isDate(l.date) && Array.isArray(l.sets)) o.last = { d:l.date, s: l.sets.slice(0,10).map(s=> [Number(s.kg)||0, Number(s.reps)||0]) };
      ex[k] = o;
    });
    return ex;
  };
  const sum = arr=> arr.reduce((a,b)=> a+b, 0);
  const in7 = wl.filter(w=> w.d > dadd(today, -7)), in30 = wl.filter(w=> w.d > dadd(today, -30));
  let streak = 0;
  try{ if(typeof calcStreak === "function" && opts.useGlobalStreak !== false) streak = calcStreak(); }catch(e){}
  const base = {
    v:1, at: opts.at || now(), name: String(p.name || "").slice(0,60),
    profile: { gender:p.gender || "", height:Number(p.height)||0, weight:Number(p.weight)||0, goal:p.goal || "" },
    streak, s7: in7.length, s30: in30.length, vol7: Math.round(sum(in7.map(w=> w.vol||0))),
    finished: finished.slice(-120), workouts: wl, weights: wts,
  };
  const plans = [[25,24],[20,16],[15,12],[10,8],[6,5],[3,3]];
  for(const [e, n] of plans){
    const out = Object.assign({}, base, { ex: mk(e, n) });
    if(JSON.stringify(out).length <= SYNC_MAX_CHARS) return out;
  }
  return Object.assign({}, base, { ex:{}, workouts: wl.slice(-20), finished: finished.slice(-40) });
}
function summaryHash(s){ const c = Object.assign({}, s); delete c.at; return hashStr(JSON.stringify(c)); }

/* Ghi 1 kết quả bài tập vào setLog / setHist của học viên cho NGÀY bất kỳ (không chỉ hôm nay) */
function writeExerciseResult(st, key, name, reps, sets, timed, date){
  st.setLog = st.setLog || {}; st.setHist = st.setHist || {};
  const prev = st.setLog[key];
  const bottom = _repBottom(reps);
  const failed = !timed && bottom && sets.filter(x=> x.kg>0 && x.reps < bottom).length >= Math.min(2, sets.length);
  if(!prev || !prev.date || prev.date <= date){
    const prevFails = prev && prev.date !== date ? (prev.fails >= 2 ? 0 : (prev.fails||0)) : ((prev && prev.prevFails)||0);
    st.setLog[key] = { date, sets, reps, fails: failed ? prevFails + 1 : 0, prevFails, byPT: true };
  }
  if(timed) return null;
  const h = st.setHist[key] = st.setHist[key] || { name, list:[] };
  h.name = h.name || name;
  const prevBest = Math.max(0, ...h.list.filter(x=> x.date !== date).map(x=> x.e1rm||0));
  const same = h.list.find(x=> x.date === date);
  const all = (same ? (same.sets||[]) : []).concat(sets);
  const best = Math.max(0, ...all.map(x=> _e1rm(x.kg, x.reps)));
  const vol = all.reduce((a,x)=> a + (Number(x.kg)||0)*(Number(x.reps)||0), 0);
  h.list = h.list.filter(x=> x.date !== date);
  h.list.push({ date, e1rm: r1(best), top: Math.max(0, ...all.map(x=> Number(x.kg)||0)), vol: Math.round(vol), sets: all });
  h.list.sort((a,b)=> a.date < b.date ? -1 : 1);
  if(h.list.length > 120) h.list = h.list.slice(-120);
  return (best > 0 && prevBest > 0 && best > prevBest + 0.4) ? { name, e1rm: Math.round(best) } : null;
}

/* Ảnh chụp gọn phần đã áp của 1 buổi "log thay" (để thay — không cộng dồn — khi PT sửa: QP-06) */
const proxyKey = e=> String(e.key || e.exerciseId || ("c:" + (e.name||"")));
function proxySets(e){
  return (e.sets||[]).filter(s=> s && (Number(s.kg) > 0 || Number(s.reps) > 0 || e.timed)).map(s=>{
    const o = { kg: Number(s.kg)||0, reps: e.timed ? 0 : (Number(s.reps)||0) }; if(s.rpe) o.rpe = Number(s.rpe); return o; });
}
function proxySnapshot(sess){
  const log = sess && sess.proxyLog; if(!log || !Array.isArray(log.exercises)) return null;
  const date = isDate(log.date) ? log.date : (isDate(sess.date) ? sess.date : todayS());
  return { rev: Number(log.rev)||1, at: Number(log.at)||0, date,
    ex: log.exercises.map(e=> ({ key: proxyKey(e), timed: !!e.timed, sets: proxySets(e).map(s=> [s.kg, s.reps]) })).filter(x=> x.sets.length) };
}
/* Gỡ đúng các hiệp của bản "log thay" cũ khỏi setHist/setLog/trainingPro.log (giữ hiệp học viên tự ghi cùng ngày) */
function revertProxyLog(st, snap, sid){
  if(!st || !snap) return 0;
  let n = 0;
  (snap.ex || []).forEach(x=>{
    const h = st.setHist && st.setHist[x.key];
    if(h && Array.isArray(h.list)){
      const ent = h.list.find(e=> e.date === snap.date);
      if(ent && Array.isArray(ent.sets)){
        const rest = ent.sets.slice();
        x.sets.forEach(([kg, reps])=>{ const i = rest.findIndex(s=> Number(s.kg) === kg && Number(s.reps) === reps); if(i >= 0){ rest.splice(i, 1); n++; } });
        if(!rest.length) h.list = h.list.filter(e=> e !== ent);
        else Object.assign(ent, { sets: rest, e1rm: r1(Math.max(0, ...rest.map(s=> _e1rm(s.kg, s.reps)))), top: Math.max(0, ...rest.map(s=> Number(s.kg)||0)),
          vol: Math.round(rest.reduce((a,s)=> a + (Number(s.kg)||0)*(Number(s.reps)||0), 0)) });
      }
    }
    const sl = st.setLog && st.setLog[x.key];
    if(sl && sl.date === snap.date && sl.byPT) delete st.setLog[x.key];
  });
  if(sid && st.trainingPro && Array.isArray(st.trainingPro.log)) st.trainingPro.log = st.trainingPro.log.filter(l=> !(l && l.ptSid === sid));
  return n;
}
/* Áp buổi PT "log thay" vào nhật ký học viên (state). Trả { applied, prs, date, snap }
   opts.prev: ảnh chụp lần áp trước → gỡ trước rồi áp bản mới (PT sửa log thay) */
function applyProxyLog(st, sess, opts){
  opts = opts || {};
  const log = sess && sess.proxyLog;
  if(!log || !Array.isArray(log.exercises)) return { applied:false, prs:[] };
  if(opts.prev) revertProxyLog(st, opts.prev, sess.id);
  const date = isDate(log.date) ? log.date : (isDate(sess.date) ? sess.date : todayS());
  const prs = [];
  let done = 0, vol = 0, nsets = 0;
  log.exercises.forEach(e=>{
    const sets = proxySets(e);
    if(!sets.length) return;
    done++; nsets += sets.length; vol += sets.reduce((a,s)=> a + s.kg*s.reps, 0);
    const key = proxyKey(e);
    const pr = writeExerciseResult(st, key, e.name || key, e.reps || "", sets, !!e.timed, date);
    if(pr) prs.push(pr);
  });
  st.workoutLog = st.workoutLog || {};
  const w = st.workoutLog[date];
  const tag = { cid: opts.cid || null, sid: sess.id || null, title: log.title || sess.title || "Buổi tập cùng PT", by: log.byName || "PT" };
  if(!w) st.workoutLog[date] = { dayKey: dayKeyOf(date), completedExerciseIds: [], finishedAt: log.at || now(), byPT: tag };
  else w.byPT = tag;
  st.finishedDates = st.finishedDates || [];
  if(done && !st.finishedDates.includes(date)){ st.finishedDates.push(date); st.finishedDates.sort(); }
  // Nhật ký buổi tập của training-pro (nếu module có)
  if(st.trainingPro && Array.isArray(st.trainingPro.log) && !st.trainingPro.log.some(l=> l && l.ptSid === sess.id)){
    st.trainingPro.log.push({ id: "pt_" + (sess.id || rid("x")), ptSid: sess.id || null, byPT: true, date, dayKey: dayKeyOf(date),
      planId: null, planName: "Buổi với PT", title: tag.title, startedAt: log.startedAt || log.at || now(), endedAt: log.at || now(),
      dur: Math.round((Number(log.durationMin)||0)*60), volume: Math.round(vol), sets: nsets, completed: done, total: log.exercises.length,
      exercises: log.exercises.map(e=> ({ key: e.key || e.exerciseId || ("c:"+(e.name||"")), name: e.name, muscle: e.muscle || "", sets: (e.sets||[]).length, hard: (e.sets||[]).length, timed: !!e.timed,
        vol: Math.round((e.sets||[]).reduce((a,s)=> a + (Number(s.kg)||0)*(Number(s.reps)||0), 0)), best: Math.round(Math.max(0, ...(e.sets||[]).map(s=> _e1rm(s.kg, s.reps)))) })),
      prs: prs.map(p=> p.name), note: log.note ? `PT ${log.byName||""}: ${log.note}` : `Do PT ${log.byName||""} ghi thay` });
    st.trainingPro.log.sort((a,b)=> String(a.date).localeCompare(String(b.date)));
    if(st.trainingPro.log.length > 300) st.trainingPro.log = st.trainingPro.log.slice(-300);
  }
  return { applied: true, prs, date, done, volume: Math.round(vol), snap: proxySnapshot(sess) };
}

/* ---- Routine: chuẩn hoá, chuyển plan ↔ routine, lọc & sắp xếp ---- */
const DAY_KEYS_ = ["T2","T3","T4","T5","T6","T7","CN"];
const GOALS_R = { lose:"Giảm mỡ", muscle:"Tăng cơ", strength:"Sức mạnh", glute:"Mông & chân", endurance:"Sức bền", health:"Khoẻ toàn diện" };
const LEVELS_R = { beginner:"Mới tập", intermediate:"Trung bình", advanced:"Nâng cao" };
const GENDERS_R = { nam:"Nam", nu:"Nữ", chung:"Nam & Nữ" };
const EQUIP_R = { gym:"Phòng gym", home:"Tại nhà", minimal:"Ít dụng cụ" };
const normS = s=> stripVi(s).replace(/\s+/g, " ").trim();

function routineFromPlan(plan, meta){
  meta = meta || {};
  const days = {}; let per = 0, durSum = 0;
  DAY_KEYS_.forEach(k=>{
    const d = (plan && plan.days && plan.days[k]) || { title:"Nghỉ ngơi", items:[] };
    const ex = (d.items||[]).slice(0, 20).map(it=>{
      const known = it.exerciseId && typeof EXERCISES !== "undefined" && EXERCISES[it.exerciseId];
      const o = { id: known ? it.exerciseId : null, sets: Math.max(1, Math.min(10, Number(it.sets)||3)), reps: String(it.reps||"10").slice(0,60), rest: Math.max(0, Math.min(600, Number(it.restSec)||0)) };
      if(!known){ const c = it.custom || {}; o.name = String(c.name || "Bài tự tạo").slice(0,80); if(c.muscle) o.muscle = String(c.muscle).slice(0,40); if(c.guide) o.guide = String(c.guide).slice(0,500); if(c.equipment) o.equip = String(c.equipment).slice(0,40); }
      return o;
    });
    if(ex.length){ per++; durSum += Number(d.duration)||0; }
    days[k] = { title: String(d.title || (ex.length ? "Buổi tập" : "Nghỉ ngơi")).slice(0,60), intensity: d.intensity || (ex.length ? "Vừa" : "Nghỉ"), duration: Number(d.duration)||0, ex };
  });
  return {
    title: String(meta.title || (plan && plan.name) || "Giáo án của tôi").trim().slice(0,80),
    desc: String(meta.desc || "").trim().slice(0,1000),
    goal: GOALS_R[meta.goal] ? meta.goal : "muscle",
    level: LEVELS_R[meta.level] ? meta.level : "beginner",
    gender: GENDERS_R[meta.gender] ? meta.gender : "chung",
    equipment: EQUIP_R[meta.equipment] ? meta.equipment : "gym",
    weeks: Math.max(1, Math.min(52, Number(meta.weeks)||8)),
    tags: (meta.tags||[]).map(t=> String(t).trim().slice(0,24)).filter(Boolean).slice(0,6),
    perWeek: per, durationAvg: per ? Math.round(durSum/per) : 0, days,
    source: meta.source || (plan && plan.fromTemplate ? { kind:"template", id: plan.fromTemplate } : { kind:"plan" }),
  };
}
/* QS-03 (fix-pt): routine là dữ liệu của NGƯỜI KHÁC → chuẩn hoá khi nhập vào giáo án trên máy
   (nơi vẽ ở app.js/pt.js chưa escape hết): cắt độ dài, bỏ ký tự HTML, cường độ theo danh sách trắng, số trong khoảng hợp lệ. */
const INT_OK = ["Nhẹ","Vừa","Cao","Rất cao","Nghỉ"];
const plain = (s, n)=> String(s == null ? "" : s).replace(/[<>"'`&\\]/g, "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const clampN = (v, lo, hi, d)=>{ const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, Math.round(x))) : d; };
function planFromRoutine(r, uidFn){
  const mkUid = uidFn || (typeof uid === "function" ? uid : ()=> rid("u"));
  r = r || {};
  const days = {};
  DAY_KEYS_.forEach(k=>{
    const d = (r.days && r.days[k]) || { title:"Nghỉ ngơi", ex:[] };
    days[k] = { title: plain(d.title, 60) || "Nghỉ ngơi", intensity: INT_OK.includes(d.intensity) ? d.intensity : "Vừa", duration: clampN(d.duration, 0, 240, 30),
      items: (Array.isArray(d.ex) ? d.ex : []).slice(0, 20).map(e=>{
        e = e || {};
        const known = e.id && typeof EXERCISES !== "undefined" && Object.prototype.hasOwnProperty.call(EXERCISES, e.id) && EXERCISES[e.id];
        return { uid: (known ? e.id + "_" : "") + mkUid(), exerciseId: known ? e.id : null,
          custom: known ? null : { name: plain(e.name, 80) || "Bài tập", muscle: plain(e.muscle, 40) || "Tuỳ chỉnh", equipment: plain(e.equip, 40) || "—", guide: plain(e.guide, 500) },
          sets: clampN(e.sets, 1, 10, 3), reps: plain(e.reps, 20) || "10", restSec: clampN(e.rest, 0, 600, 60), clipId: null };
      }) };
  });
  return { id: "plan_" + mkUid(), name: plain(r.title, 80) || "Giáo án chia sẻ", tagline: `CỘNG ĐỒNG · ${plain(r.authorName || "TapEasy", 40).toUpperCase()}`, builtin:false,
    fromRoutine: r.id ? plain(r.id, 60) : null, days };
}
function validateRoutine(r){
  if(!r || typeof r !== "object") return "Giáo án chia sẻ không hợp lệ.";
  const t = String(r.title||"").trim();
  if(t.length < 4) return "Tên giáo án cần ít nhất 4 ký tự.";
  if(t.length > 80) return "Tên giáo án tối đa 80 ký tự.";
  if(String(r.desc||"").length > 1000) return "Mô tả tối đa 1000 ký tự.";
  const days = Object.values(r.days||{});
  if(!days.some(d=> d && (d.ex||[]).length)) return "Giáo án cần ít nhất 1 buổi có bài tập.";
  const texts = [r.title, r.desc, ...(r.tags||[]), ...days.map(d=> d && d.title), ...days.flatMap(d=> (d && d.ex || []).map(e=> [e.name, e.guide].join(" ")))].join(" \n ");
  const bad = findProfanity(texts);
  if(bad.length) return `Nội dung có từ ngữ không phù hợp ("${bad.slice(0,3).join('", "')}"). Vui lòng sửa lại trước khi đăng.`;
  return null;
}
/* QC-14 (vòng 2): báo cáo routine tính theo TRỌNG SỐ — tài khoản ≥ 7 ngày tuổi = 1, mới/khách = 0; tự ẩn khi trọng số ≥ 3.
   Nguồn trọng số: demo `reportWeight` (tổng w từng báo cáo); Firebase `autoModWeight` do Function routineReportHeal ghi.
   Kiểm duyệt viên đã quyết (`moderatedAt`) → theo `hidden`; dữ liệu cũ chưa có trọng số → như trước (số báo cáo thô). */
const REPORT_TRUST_DAYS = 7;
function reportWeightOf(r){
  if(!r) return null;
  if(r.reportWeight != null) return Number(r.reportWeight) || 0;
  if(r.autoModWeight != null) return Number(r.autoModWeight) || 0;
  return null;
}
function isHidden(r){
  if(!r || r.approved) return false;
  if(r.moderatedAt) return r.hidden === true;
  const w = reportWeightOf(r);
  if(w != null) return w >= REPORT_HIDE;
  return (Number(r.reports)||0) >= REPORT_HIDE || r.hidden === true;
}
function routineText(r){
  const exNames = Object.values(r.days||{}).flatMap(d=> (d.ex||[]).map(e=> e.name || (e.id && typeof EXERCISES !== "undefined" && EXERCISES[e.id] ? EXERCISES[e.id].name : ""))).join(" ");
  return normS([r.title, r.desc, r.authorName, (r.tags||[]).join(" "), GOALS_R[r.goal], LEVELS_R[r.level], exNames].join(" "));
}
function filterRoutines(list, f){
  f = f || {};
  const q = normS(f.q || "");
  const words = q ? q.split(" ").filter(Boolean) : [];
  return (list||[]).filter(r=>{
    if(!r) return false;
    if(!f.includeHidden && isHidden(r) && !(f.viewer && r.authorUid === f.viewer)) return false;
    if(f.goal && f.goal !== "all" && r.goal !== f.goal) return false;
    if(f.level && f.level !== "all" && r.level !== f.level) return false;
    if(f.gender && f.gender !== "all" && !(r.gender === f.gender || (f.gender !== "chung" && r.gender === "chung"))) return false;
    if(f.perWeek && f.perWeek !== "all"){
      const n = Number(r.perWeek)||0;
      if(f.perWeek === "2-3" && !(n >= 2 && n <= 3)) return false;
      if(f.perWeek === "4" && n !== 4) return false;
      if(f.perWeek === "5+" && n < 5) return false;
    }
    if(f.equipment && f.equipment !== "all" && r.equipment !== f.equipment) return false;
    if(f.author && r.authorUid !== f.author) return false;
    if(f.ids && !f.ids.includes(r.id)) return false;
    if(words.length){ const hay = routineText(r); if(!words.every(w=> hay.includes(w))) return false; }
    return true;
  });
}
function trendScore(r, t){
  const age = Math.max(0, ((t || now()) - (Number(r.createdAt)||0)) / 3600000);
  return ((Number(r.likes)||0)*2 + (Number(r.copies)||0)*3 + (Number(r.saves)||0) + 1) / Math.pow(age + 24, 0.6);
}
function sortRoutines(list, mode){
  const a = (list||[]).slice();
  if(mode === "new") return a.sort((x,y)=> (Number(y.createdAt)||0) - (Number(x.createdAt)||0));
  if(mode === "copies") return a.sort((x,y)=> (Number(y.copies)||0) - (Number(x.copies)||0) || (Number(y.likes)||0) - (Number(x.likes)||0));
  if(mode === "likes") return a.sort((x,y)=> (Number(y.likes)||0) - (Number(x.likes)||0));
  const t = now();
  return a.sort((x,y)=> trendScore(y, t) - trendScore(x, t));
}

/* =====================================================================
   2. ĐỘNG CƠ DEMO (localStorage riêng)
   ===================================================================== */
const EMPTY = ()=> ({ invites:{}, messages:{}, routines:{}, likes:{}, saves:{}, copies:{}, reports:{}, userSocial:{}, seeded:{} });
function dLoad(){ try{ return Object.assign(EMPTY(), JSON.parse(localStorage.getItem(DEMO_KEY) || "{}")); }catch(e){ return EMPTY(); } }
function dSave(d){
  try{ localStorage.setItem(DEMO_KEY, JSON.stringify(d)); }
  catch(e){
    // Hết bộ nhớ: bỏ ảnh cũ trong chat demo rồi thử lại
    Object.values(d.messages||{}).forEach(box=> Object.values(box).sort((a,b)=> a.ts-b.ts).slice(0, -6).forEach(m=>{ if(m.img){ m.img = null; m.text = (m.text||"") + " [ảnh đã xoá để tiết kiệm bộ nhớ]"; } }));
    localStorage.setItem(DEMO_KEY, JSON.stringify(d));
  }
}
function cloudDemo(){ try{ return JSON.parse(localStorage.getItem(CLOUD_DEMO_KEY) || "{}"); }catch(e){ return {}; } }
const delay = (ms=60)=> new Promise(r=> setTimeout(r, ms));
function us(d, uid){ return d.userSocial[uid] = Object.assign({ liked:[], saved:[], copied:[], reported:[] }, d.userSocial[uid] || {}); }
function toggleIn(arr, v, on){ const i = arr.indexOf(v); if(on && i < 0) arr.push(v); if(!on && i >= 0) arr.splice(i, 1); }

const demo = {
  /* Lời mời */
  async sendInvite(inv){ await delay(); const d = dLoad(); const id = rid("i"); d.invites[id] = Object.assign({ id }, inv); dSave(d); return d.invites[id]; },
  async myInvites(email){ return Object.values(dLoad().invites).filter(i=> i.email === email && i.status === "pending"); },
  async sentInvites(ptId){ return Object.values(dLoad().invites).filter(i=> i.ptId === ptId); },
  async getInvite(id){ return dLoad().invites[id] || null; },
  async updateInvite(id, partial){ const d = dLoad(); if(!d.invites[id]) throw err("Lời mời không còn tồn tại.", "not-found"); Object.assign(d.invites[id], partial); dSave(d); return d.invites[id]; },
  async deleteInvite(id){ const d = dLoad(); delete d.invites[id]; dSave(d); },
  async lookupCode(code){ const db = cloudDemo(); return (db.joinCodes || {})[code] || null; },
  /* Chat */
  async listMessages(cid, limit){ return Object.values(dLoad().messages[cid] || {}).sort((a,b)=> a.ts - b.ts).slice(-limit); },
  async addMessage(cid, msg, role){
    const d = dLoad(); d.messages[cid] = d.messages[cid] || {};
    const id = rid("m"); d.messages[cid][id] = Object.assign({ id }, msg);
    const box = Object.values(d.messages[cid]).sort((a,b)=> a.ts - b.ts);
    if(box.length > 500) box.slice(0, box.length - 500).forEach(m=> delete d.messages[cid][m.id]);
    dSave(d);
    const c = await cloud.getClient(cid);
    if(c){
      const chat = clean(c.chat || {}); chat.n = chat.n || {}; chat.n[role] = (Number(chat.n[role])||0) + 1;
      chat.last = { ts: msg.ts, role, name: msg.name, text: msg.kind === "image" ? "[Ảnh]" : String(msg.text||"").slice(0,120) };
      await cloud.updateClient(cid, { chat });
    }
    return d.messages[cid][id];
  },
  async markRead(cid, role, n){
    const c = await cloud.getClient(cid); if(!c) return;
    const chat = clean(c.chat || {}); chat.read = chat.read || {}; chat.readAt = chat.readAt || {};
    if((Number(chat.read[role])||0) >= n && chat.readAt[role]) return;
    chat.read[role] = n; chat.readAt[role] = now();
    await cloud.updateClient(cid, { chat });
  },
  async setClientField(cid, field, value){ await cloud.updateClient(cid, { [field]: value }); },
  /* Routine */
  async listRoutines(){ return Object.values(dLoad().routines); },
  async getRoutine(id){ return dLoad().routines[id] || null; },
  async createRoutine(r){ const d = dLoad(); const id = rid("r"); d.routines[id] = Object.assign({ id }, r); dSave(d); return d.routines[id]; },
  async updateRoutine(id, partial, uid){ const d = dLoad(); const r = d.routines[id]; if(!r) throw err("Giáo án chia sẻ không còn tồn tại.", "not-found"); if(r.authorUid !== uid) throw err("Bạn chỉ sửa được giáo án chia sẻ của mình.", "permission-denied"); Object.assign(r, partial, { updatedAt: now() }); dSave(d); return r; },
  async deleteRoutine(id, uid){ const d = dLoad(); const r = d.routines[id]; if(r && r.authorUid !== uid) throw err("Bạn chỉ xoá được giáo án chia sẻ của mình.", "permission-denied"); delete d.routines[id]; ["likes","saves","copies","reports"].forEach(k=> delete d[k][id]); dSave(d); },
  async toggle(kind, id, uid, on){
    const d = dLoad(); const r = d.routines[id]; if(!r) throw err("Giáo án chia sẻ không còn tồn tại.", "not-found");
    const field = kind === "likes" ? "liked" : "saved";
    d[kind][id] = d[kind][id] || {};
    const had = !!d[kind][id][uid];
    if(on === undefined) on = !had;
    if(on && !had){ d[kind][id][uid] = now(); r[kind] = (Number(r[kind])||0) + 1; }
    if(!on && had){ delete d[kind][id][uid]; r[kind] = Math.max(0, (Number(r[kind])||0) - 1); }
    toggleIn(us(d, uid)[field], id, on);
    dSave(d); return { on, count: r[kind] };
  },
  async recordCopy(id, uid){
    const d = dLoad(); const r = d.routines[id]; if(!r) return { first:false, count:0 };
    d.copies[id] = d.copies[id] || {};
    const first = !d.copies[id][uid];
    if(first){ d.copies[id][uid] = now(); r.copies = (Number(r.copies)||0) + 1; toggleIn(us(d, uid).copied, id, true); }
    dSave(d); return { first, count: r.copies };
  },
  async report(id, uid, reason, w){
    const d = dLoad(); const r = d.routines[id]; if(!r) throw err("Giáo án chia sẻ không còn tồn tại.", "not-found");
    if(r.authorUid && r.authorUid === uid) throw err("Bạn không thể tự báo cáo giáo án chia sẻ của chính mình.", "social/self");
    d.reports[id] = d.reports[id] || {};
    if(d.reports[id][uid]) return { already:true, reports: r.reports, weight: reportWeightOf(r) || 0, hidden: isHidden(r) };
    d.reports[id][uid] = { reason, ts: now(), w: w ? 1 : 0 };
    r.reports = (Number(r.reports)||0) + 1;
    // QC-14: trọng số = tổng w (báo cáo cũ chưa có w tính 1 — giữ tương thích); bỏ báo cáo của chính tác giả
    r.reportWeight = Object.keys(d.reports[id]).reduce((a, k)=> a + (k === r.authorUid ? 0 : (d.reports[id][k] && d.reports[id][k].w != null ? (Number(d.reports[id][k].w)||0) : 1)), 0);
    if(!r.moderatedAt) r.hidden = !r.approved && r.reportWeight >= REPORT_HIDE;
    toggleIn(us(d, uid).reported, id, true);
    dSave(d); return { already:false, reports: r.reports, weight: r.reportWeight, hidden: isHidden(r) };
  },
  async mySocial(uid){ const d = dLoad(); return clean(us(d, uid)); },
  ensureSeeds(seeds, version){
    const d = dLoad(); if(d.seeded[version]) return false;
    (seeds||[]).forEach(s=>{ if(!d.routines[s.id]) d.routines[s.id] = clean(s); });
    d.seeded[version] = now(); dSave(d); return true;
  },
};

/* =====================================================================
   3. ĐỘNG CƠ FIREBASE (firebase.firestore() toàn cục)
   ===================================================================== */
const clientRef = cid=> fdb().collection("clients").doc(cid);
const msgCol = cid=> clientRef(cid).collection("messages");
const fbe = {
  async sendInvite(inv){ const ref = fdb().collection("invites").doc(); await ref.set(inv); return Object.assign({ id: ref.id }, inv); },
  async myInvites(email){ return qd(await fdb().collection("invites").where("email","==",email).where("status","==","pending").get()); },
  async sentInvites(ptId){ return qd(await fdb().collection("invites").where("ptId","==",ptId).get()); },
  async getInvite(id){ return dd(await fdb().collection("invites").doc(id).get()); },
  async updateInvite(id, partial){ await fdb().collection("invites").doc(id).update(partial); return Object.assign({ id }, partial); },
  async deleteInvite(id){ await fdb().collection("invites").doc(id).delete(); },
  async lookupCode(code){ return dd(await fdb().collection("joinCodes").doc(code).get()); },
  async listMessages(cid, limit){ return qd(await msgCol(cid).orderBy("ts","desc").limit(limit).get()).reverse(); },
  async addMessage(cid, msg, role){
    const ref = msgCol(cid).doc(), batch = fdb().batch();
    batch.set(ref, msg);
    batch.update(clientRef(cid), { ["chat.n." + role]: FV().increment(1),
      "chat.last": { ts: msg.ts, role, name: msg.name, text: msg.kind === "image" ? "[Ảnh]" : String(msg.text||"").slice(0,120) } });
    await batch.commit();
    return Object.assign({ id: ref.id }, msg);
  },
  async markRead(cid, role, n){ await clientRef(cid).update({ ["chat.read." + role]: n, ["chat.readAt." + role]: now() }); },
  async setClientField(cid, field, value){ await clientRef(cid).update({ [field]: value }); },
  watchMessages(cid, limit, cb, onErr){ return msgCol(cid).orderBy("ts","desc").limit(limit).onSnapshot(s=> cb(qd(s).reverse()), e=> onErr && onErr(nice(e))); },
  watchClients(uid, cb, onErr){
    const u1 = fdb().collection("clients").where("ptId","==",uid).onSnapshot(s=> cb("pt", qd(s)), e=> onErr && onErr(nice(e)));
    const u2 = fdb().collection("clients").where("studentUid","==",uid).onSnapshot(s=> cb("student", qd(s)), e=> onErr && onErr(nice(e)));
    return ()=>{ try{ u1(); }catch(e){} try{ u2(); }catch(e){} };
  },
  watchInvites(email, cb, onErr){ return fdb().collection("invites").where("email","==",email).where("status","==","pending").onSnapshot(s=> cb(qd(s)), e=> onErr && onErr(nice(e))); },
  /* Routine */
  async listRoutines(limit){ return qd(await fdb().collection("routines").orderBy("createdAt","desc").limit(limit || 200).get()); },
  async routinesByAuthor(uid){ return qd(await fdb().collection("routines").where("authorUid","==",uid).get()); },
  async getRoutine(id){ return dd(await fdb().collection("routines").doc(id).get()); },
  async createRoutine(r){ const ref = fdb().collection("routines").doc(); await ref.set(r); return Object.assign({ id: ref.id }, r); },
  async updateRoutine(id, partial){ await fdb().collection("routines").doc(id).update(Object.assign({}, partial, { updatedAt: now() })); return dd(await fdb().collection("routines").doc(id).get()); },
  async deleteRoutine(id){ await fdb().collection("routines").doc(id).delete(); },
  async toggle(kind, id, uid, on){
    const rref = fdb().collection("routines").doc(id), sub = rref.collection(kind).doc(uid);
    const field = kind === "likes" ? "liked" : "saved";
    const had = (await sub.get()).exists;
    if(on === undefined) on = !had;
    if(on === had){ const r = dd(await rref.get()); return { on, count: r ? (r[kind]||0) : 0 }; }
    const b = fdb().batch();
    if(on) b.set(sub, { ts: now() }); else b.delete(sub);
    b.update(rref, { [kind]: FV().increment(on ? 1 : -1) });
    b.set(fdb().collection("userSocial").doc(uid), { [field]: on ? FV().arrayUnion(id) : FV().arrayRemove(id) }, { merge:true });
    await b.commit();
    const r = dd(await rref.get()); return { on, count: r ? (r[kind]||0) : 0 };
  },
  async recordCopy(id, uid){
    const rref = fdb().collection("routines").doc(id), sub = rref.collection("copies").doc(uid);
    if((await sub.get()).exists) return { first:false };
    const b = fdb().batch();
    b.set(sub, { ts: now() });
    b.update(rref, { copies: FV().increment(1) });
    b.set(fdb().collection("userSocial").doc(uid), { copied: FV().arrayUnion(id) }, { merge:true });
    await b.commit(); return { first:true };
  },
  async report(id, uid, reason, w){
    const rref = fdb().collection("routines").doc(id), sub = rref.collection("reports").doc(uid);
    return fdb().runTransaction(async tx=>{
      const r = await tx.get(rref); if(!r.exists) throw err("Giáo án chia sẻ không còn tồn tại.", "not-found");
      const rd = r.data() || {};
      if(rd.authorUid === uid) throw err("Bạn không thể tự báo cáo giáo án chia sẻ của chính mình.", "social/self");
      const s = await tx.get(sub); if(s.exists) return { already:true, reports: rd.reports||0, weight: reportWeightOf(rd) || 0, hidden: isHidden(rd) };
      // rules bắt buộc hidden == (reports >= 3) cho lượt báo cáo của client; Function routineReportHeal tính lại "ẩn" theo
      // tuổi tài khoản (autoModWeight) ngay sau đó — giao diện đọc isHidden() theo trọng số (QC-14)
      const reports = (Number(rd.reports)||0) + 1, rawHidden = reports >= REPORT_HIDE;
      tx.set(sub, { reason, ts: now(), uid });       // integrator (FIX-security vòng 2 #4): uid → deleteMyAccount dọn được dấu báo cáo (rules: uid = mình)
      tx.update(rref, { reports, hidden: rawHidden });
      tx.set(fdb().collection("userSocial").doc(uid), { reported: FV().arrayUnion(id) }, { merge:true });
      const est = rd.autoModWeight != null ? (Number(rd.autoModWeight)||0) + (w ? 1 : 0) : null;
      return { already:false, reports, weight: est == null ? (w ? 1 : 0) : est, hidden: isHidden(Object.assign({}, rd, { reports, hidden: rawHidden, autoModWeight: est == null ? undefined : est })) };
    });
  },
  async mySocial(uid){ const d = dd(await fdb().collection("userSocial").doc(uid).get()); return Object.assign({ liked:[], saved:[], copied:[], reported:[] }, d || {}); },
};

/* =====================================================================
   4. API CÔNG KHAI — cloud.social
   ===================================================================== */
const E = ()=> isFb() ? fbe : demo;
let SEEDS = [], SEED_VERSION = "v1";
const isLocalRoutine = id=> !isFb() || String(id||"").startsWith("seed-") || !!dLoad().routines[id];
const RE = id=> isLocalRoutine(id) ? demo : fbe;
function actorFor(id){
  const u = me();
  if(u) return u.uid;
  if(isLocalRoutine(id)){
    let g = null; try{ g = localStorage.getItem("tapeasy_guest_id"); if(!g){ g = rid("guest"); localStorage.setItem("tapeasy_guest_id", g); } }catch(e){ g = "guest"; }
    return g;
  }
  throw err("Bạn cần đăng nhập để tương tác với giáo án chia sẻ.", "social/auth");
}
function myRoleIn(c){ const u = me(); if(!u || !c) return null; if(c.ptId === u.uid) return "pt"; if(c.studentUid === u.uid) return "student"; return null; }
const JOIN = { ctx: null };     // bằng chứng nhận form (lời mời đúng email) — QS-14, xem lớp quyền §5
/* QS-12: tin "hệ thống" do CHÍNH HỆ THỐNG sinh — không đi qua api.sendMessage (đường của người dùng, luôn ép text/image).
   demo: ghi thẳng vào hộp tin (from:"system"); Firebase: Cloud Function joinByCode ghi trong giao dịch liên kết → ở đây bỏ qua. */
async function systemMessage(cid, text){
  if(isFb() || !cid) return null;
  return demo.addMessage(cid, { from:"system", role:"system", kind:"system", name:"", text: cleanText(String(text||"").slice(0, 200)), ts: now() }, "student");
}

/* App Store 1.2 (vòng 2): chặn người dùng — API thật cloud.js (blockUser / unblockUser / listBlocked / isBlocked / isBlockedSync).
   · Lọc dữ liệu của người MÌNH đã chặn: tin nhắn (list/watch), lời mời theo email.
   · Không gửi tin cho người mình đã chặn; demo mô phỏng rules blockedBy(người nhận, mình) — người bị chặn không nhắn được. */
const BLOCKED_ME_MSG = "Không gửi được tin nhắn: người nhận đã tắt liên lạc với bạn.";
async function warmBlocks(){ try{ if(me() && typeof cloud.isBlocked === "function") await cloud.isBlocked("__warm__"); }catch(e){} }
const blockedSync = uid=>{ try{ return !!uid && typeof cloud.isBlockedSync === "function" && cloud.isBlockedSync(String(uid)); }catch(e){ return false; } };
function demoBlockedBy(a, b){ if(isFb() || !a || !b) return false; try{ const db = cloudDemo(); return !!(db.blocks && db.blocks[a] && db.blocks[a][b]); }catch(e){ return false; } }
const dropBlocked = (list, key)=> (list || []).filter(x=> !(x && x[key] && x[key] !== "system" && (!me() || x[key] !== me().uid) && blockedSync(x[key])));

/* QC-14: tuổi tài khoản người báo cáo — demo: hồ sơ trong kho cloud.js (users[uid].createdAt); chính mình: cloud.profile.createdAt,
   Firebase: thời điểm tạo trong Auth. Không rõ tuổi (khách, tài khoản lạ) → 0 (không tính vào ngưỡng tự ẩn). */
function accountCreatedAt(uid){
  let t = 0; const u = me();
  if(!isFb()){ try{ const users = cloudDemo().users || {}; t = Number(users[uid] && users[uid].createdAt) || 0; }catch(e){} }
  if(!t && u && u.uid === uid){
    try{ t = Number(cloud.profile && cloud.profile.createdAt) || 0; }catch(e){}
    try{ if(!t && isFb() && firebase.auth && firebase.auth().currentUser) t = Date.parse(firebase.auth().currentUser.metadata.creationTime) || 0; }catch(e){}
  }
  return t;
}
function reportTrust(uid){ const t = accountCreatedAt(uid); return t && (now() - t) >= REPORT_TRUST_DAYS * DAY ? 1 : 0; }

/* Bộ hỏi lại (polling) cho động cơ demo + nghe sự kiện storage giữa các tab */
function poller(fn, ms){
  let stopped = false, busy = false;
  const tick = async ()=>{ if(stopped || busy) return; busy = true; try{ await fn(); }catch(e){} busy = false; };
  const t = setInterval(tick, ms || POLL_MS);
  const onStore = ev=>{ if(!ev || !ev.key || ev.key === DEMO_KEY || ev.key === CLOUD_DEMO_KEY) tick(); };
  try{ window.addEventListener("storage", onStore); }catch(e){}
  tick();
  return { stop(){ stopped = true; clearInterval(t); try{ window.removeEventListener("storage", onStore); }catch(e){} }, tick };
}

const api = {
  __v: 1,
  get engine(){ return isFb() ? "firebase" : "demo"; },
  POLL_MS, REPORT_HIDE,

  /* ---------- Lời mời ---------- */
  sendInvite: wrap(async ({ clientId, email, name, message })=>{
    const u = needUser();
    const em = lc(email);
    if(!EMAIL_RE.test(em)) throw err("Email chưa đúng định dạng, ví dụ: ten@gmail.com.", "social/email");
    if(em === lc(u.email)) throw err("Đây là email của chính bạn.", "social/self");
    const c = await cloud.getClient(clientId);
    if(!c || c.ptId !== u.uid) throw err("Không tìm thấy form học viên.", "not-found");
    if(c.studentUid) throw err("Form này đã kết nối với một tài khoản học viên.", "social/linked");
    const old = (await E().sentInvites(u.uid)).find(i=> i.clientId === clientId && i.email === em && i.status === "pending");
    if(old) return old;
    const pr = cloud.profile || {};
    return E().sendInvite(clean({ clientId, ptId: u.uid, ptName: u.name || pr.name || "PT", ptBrand: pr.brandName || "", ptPhoto: (pr.photo && String(pr.photo).length < 200000) ? pr.photo : null,
      ptSpecialty: pr.specialty || "", email: em, code: c.joinCode || "", name: String(name || c.name || "").slice(0,80),
      message: cleanText(String(message||"").slice(0,500)), status:"pending", createdAt: now(), respondedAt: null }));
  }),
  myInvites: wrap(async ()=>{ const u = me(); if(!u || !u.email) return []; await warmBlocks(); return dropBlocked(await E().myInvites(lc(u.email)), "ptId").sort((a,b)=> (b.createdAt||0) - (a.createdAt||0)); }),
  sentInvites: wrap(async clientId=>{ const u = me(); if(!u) return []; return (await E().sentInvites(u.uid)).filter(i=> !clientId || i.clientId === clientId).sort((a,b)=> (b.createdAt||0) - (a.createdAt||0)); }),
  acceptInvite: wrap(async id=>{
    const u = needUser();
    const inv = await E().getInvite(id);
    if(!inv || inv.status !== "pending") throw err("Lời mời không còn hiệu lực.", "social/expired");
    if(inv.email !== lc(u.email)) throw err("Lời mời này gửi cho email khác.", "social/email");
    if(inv.ptId === u.uid) throw err("Bạn không thể tự nhận lời mời của mình.", "social/self");
    if(!isFb()){ const c = await cloud.getClient(inv.clientId); if(!c) throw err("PT đã xoá form học viên này.", "not-found"); if(c.studentUid && c.studentUid !== u.uid) throw err("Lời mời đã hết hiệu lực (form đã có học viên khác).", "social/linked"); }
    let client;
    if(isFb()){
      // QS-14: rules không cho học viên tự ghi studentUid — liên kết qua Function joinByCode (email đã xác minh + lời mời đang chờ); Function ghi luôn dòng hệ thống
      const r = await firebase.app().functions("asia-southeast1").httpsCallable("joinByCode")({ clientId: inv.clientId });
      client = (r && r.data) || await cloud.getClient(inv.clientId);
      await E().updateInvite(id, { status:"accepted", respondedAt: now(), studentUid: u.uid, studentName: u.name });
      return client;
    }
    JOIN.ctx = { cid: inv.clientId, invite: id, uid: u.uid };          // QS-14: bằng chứng = lời mời đúng email (lớp quyền kiểm tra)
    try{ client = await cloud.updateClient(inv.clientId, { studentUid: u.uid, studentName: u.name, studentEmail: u.email }); }
    catch(e){ if(e && /quyền|permission/i.test((e.code||"") + (e.message||""))) throw err("Lời mời đã hết hiệu lực (form đã có học viên khác hoặc đã bị xoá).", "social/linked"); throw e; }
    finally{ JOIN.ctx = null; }
    await E().updateInvite(id, { status:"accepted", respondedAt: now(), studentUid: u.uid, studentName: u.name });
    // QS-12: dòng hệ thống do HỆ THỐNG ghi (demo: nội bộ; Firebase: Function joinByCode) — người dùng không gửi được kind "system"
    // FIX-security #2: ở Firebase KHÔNG gọi (rules từ chối kind "system" từ client; Function joinByCode đã ghi) — chỉ demo
    if(!isFb()){ try{ await systemMessage(inv.clientId, `${u.name || "Học viên"} đã chấp nhận lời mời tập cùng.`); }catch(e){} }
    return client;
  }),
  declineInvite: wrap(async id=>{
    const u = needUser(); const inv = await E().getInvite(id);
    if(!inv || inv.status !== "pending") return null;
    if(inv.email !== lc(u.email)) throw err("Lời mời này gửi cho email khác.", "social/email");
    return E().updateInvite(id, { status:"declined", respondedAt: now(), studentUid: u.uid, studentName: u.name });
  }),
  cancelInvite: wrap(async id=>{ const u = needUser(); const inv = await E().getInvite(id); if(inv && inv.ptId !== u.uid) throw err("Không phải lời mời của bạn.", "permission-denied"); await E().deleteInvite(id); }),
  normalizeCode(raw){ return String(raw||"").trim().toUpperCase().replace(/^.*[?&#]join=/i, "").replace(/[^A-Z0-9]/g, "").slice(0, CODE_MAX); },
  CODE_MIN, CODE_MAX, isCode: c=> CODE_RE.test(String(c||"")),
  previewCode: wrap(async raw=>{
    const code = api.normalizeCode(raw);
    if(!CODE_RE.test(code)) throw err("Mã gồm 6–10 ký tự chữ và số, ví dụ: K7M2QX.", "social/code");   // cùng câu với cloud.js join/bad-code
    const link = await E().lookupCode(code);
    if(!link) throw err("Mã không đúng hoặc đã bị xoá. Hỏi lại PT của bạn nhé.", "social/code");
    const u = me();
    if(u && link.ptId === u.uid) throw err("Đây là mã do chính bạn tạo cho học viên.", "social/self");
    let pt = null; try{ pt = await cloud.getUser(link.ptId); }catch(e){}
    let linked = false;
    if(!isFb()){ const c = (cloudDemo().clients || {})[link.clientId]; linked = !!(c && c.studentUid && (!u || c.studentUid !== u.uid)); }
    return { code, clientId: link.clientId, ptId: link.ptId, linked,
      pt: { name: (pt && pt.name) || "PT", brandName: (pt && pt.brandName) || "", photo: (pt && pt.photo) || null, specialty: (pt && pt.specialty) || "", area: (pt && pt.area) || "", years: (pt && pt.years) || 0 } };
  }),
  acceptCode: wrap(async raw=>{
    const code = api.normalizeCode(raw);
    const c = await cloud.joinByCode(code);
    try{ const u = me(); const inv = (await E().myInvites(lc(u.email))).find(i=> i.code === code); if(inv) await E().updateInvite(inv.id, { status:"accepted", respondedAt: now(), studentUid: u.uid, studentName: u.name }); }catch(e){}
    if(!isFb()){ try{ await systemMessage(c.id, `${(me() && me().name) || "Học viên"} đã kết nối bằng mã mời.`); }catch(e){} }   // FIX-security #2
    return c;
  }),
  watchInvites(cb){
    const u = me(); if(!u || !u.email) return ()=>{};
    warmBlocks();
    if(isFb()) return fbe.watchInvites(lc(u.email), l=> cb(dropBlocked(l, "ptId")), ()=>{});
    let sig = null;
    const p = poller(async ()=>{ const l = dropBlocked(await demo.myInvites(lc(u.email)), "ptId"); const s = l.map(i=> i.id).join(","); if(s !== sig){ sig = s; cb(l); } });
    return p.stop;
  },

  /* ---------- Chat ---------- */
  chatInfo, otherRole, myRoleIn,
  listMessages: wrap(async (cid, limit)=>{ await warmBlocks(); return dropBlocked(await E().listMessages(cid, limit || 200), "from"); }),
  sendMessage: wrap(async (cid, m, roleHint)=>{
    const u = needUser();
    m = m || {};
    let role = roleHint;
    const c = await cloud.getClient(cid);
    if(!role) role = myRoleIn(c);
    if(role !== "pt" && role !== "student") throw err("Bạn không thuộc cuộc trò chuyện này.", "permission-denied");
    // App Store 1.2: không nhắn cho người mình đã chặn; người nhận đã chặn mình → máy chủ (rules) / demo từ chối
    const peer = c ? (role === "pt" ? c.studentUid : c.ptId) : null;
    await warmBlocks();
    if(peer && blockedSync(peer)) throw err("Bạn đã chặn người này — bỏ chặn để nhắn tin.", "social/blocked");
    if(peer && demoBlockedBy(peer, u.uid)) throw err(BLOCKED_ME_MSG, "social/blocked");
    const text = String(m.text||"").trim().slice(0, MAX_MSG_LEN);
    const img = m.img && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(m.img) ? m.img : null;
    if(m.img && !img) throw err("Ảnh không hợp lệ.", "social/img");
    if(img && img.length > MAX_IMG_CHARS) throw err("Ảnh quá lớn, hãy chọn ảnh khác.", "social/img");
    if(!text && !img) throw err("Tin nhắn trống.", "social/empty");
    // QS-12: người dùng không gửi được tin "system" (chỉ Cloud Function); kind ngoài danh sách → tin thường
    let kind = ["text","image","log"].includes(m.kind) ? m.kind : (img ? "image" : "text");
    if(kind === "log" && isFb()) kind = "text";          // rules: "log" chỉ do Cloud Function ghi
    const msg = clean({ from: u.uid, role, name: u.name || "", text, img, kind, meta: m.meta || null, ts: now() });
    try{ return await E().addMessage(cid, msg, role); }
    catch(e){ if(isFb() && e && e.code === "permission-denied") throw err(BLOCKED_ME_MSG + " Nếu không phải vậy, hãy thử lại sau.", "social/blocked"); throw e; }
  }),
  markRead: wrap(async (cid, role, client)=>{
    if(!me() || !role) return;
    const info = chatInfo(client || await cloud.getClient(cid), role);
    if(!info.unread && info.myReadAt) return;
    return E().markRead(cid, role, info.sentByOther);
  }),
  watchMessages(cid, cb, opts){
    opts = opts || {};
    const limit = opts.limit || 200;
    warmBlocks();
    if(isFb()) return fbe.watchMessages(cid, limit, list=> cb(dropBlocked(list, "from")), opts.onError);   // không nhận tin mới từ người đã chặn
    let sig = null;
    const p = poller(async ()=>{
      const list = dropBlocked(await demo.listMessages(cid, limit), "from");
      const c = (cloudDemo().clients || {})[cid] || {};
      const s = list.length + ":" + (list.length ? list[list.length-1].id : "") + ":" + JSON.stringify((c.chat||{}).readAt || {});
      if(s !== sig){ sig = s; cb(list, c); }
    }, opts.pollMs);
    const stop = p.stop; stop.refresh = p.tick;
    return stop;
  },
  /* Theo dõi form PT ↔ học viên của tôi (badge tin nhắn, đồng bộ) — realtime khi firebase, hỏi lại 5 s khi demo */
  watchClients(cb, opts){
    const u = me(); if(!u) return ()=>{};
    opts = opts || {};
    if(isFb()) return fbe.watchClients(u.uid, cb, opts.onError);
    let sig = { pt:null, student:null };
    const p = poller(async ()=>{
      const all = Object.values(cloudDemo().clients || {});
      const mine = { pt: all.filter(c=> c.ptId === u.uid), student: all.filter(c=> c.studentUid === u.uid) };
      ["pt","student"].forEach(r=>{ const s = JSON.stringify(mine[r].map(c=> [c.id, c.updatedAt, c.chat])); if(s !== sig[r]){ sig[r] = s; cb(r, mine[r]); } });
    }, opts.pollMs);
    return p.stop;
  },

  /* ---------- Đồng bộ nhật ký tập ---------- */
  buildTrainingSummary, summaryHash,
  pushTrainingSync: wrap(async (cid, summary)=>{ needUser(); return E().setClientField(cid, "trainingSync", clean(summary)); }),

  /* ---------- PT log buổi tập thay học viên ---------- */
  saveProxyLog: wrap(async (cid, log, sid)=>{
    const u = needUser();
    const c = await cloud.getClient(cid);
    if(!c || c.ptId !== u.uid) throw err("Chỉ PT của học viên này mới ghi thay được.", "permission-denied");
    const exs = (log.exercises||[]).map(e=> clean({ key: e.key || e.exerciseId || ("c:" + (e.name||"")), exerciseId: e.exerciseId || null, name: String(e.name||"").slice(0,80),
      muscle: e.muscle || "", reps: String(e.reps||""), timed: !!e.timed, img: e.img || "",
      sets: (e.sets||[]).filter(s=> s && (s.done || s.done === undefined)).map(s=>{ const o = { kg: Number(s.kg)||0, reps: Number(s.reps)||0 }; if(s.rpe) o.rpe = Number(s.rpe); return o; }) }))
      .filter(e=> e.sets.length);
    if(!exs.length) throw err("Chưa có hiệp nào được ghi.", "social/empty");
    const vol = exs.reduce((a,e)=> a + e.sets.reduce((b,s)=> b + s.kg*s.reps, 0), 0);
    const date = isDate(log.date) ? log.date : todayS();
    const proxyLog = clean({ v:1, by: u.uid, byName: u.name || "PT", at: now(), startedAt: log.startedAt || null, date, title: String(log.title || "Tập cùng PT").slice(0,80),
      exercises: exs, volume: Math.round(vol), sets: exs.reduce((a,e)=> a + e.sets.length, 0), durationMin: Math.max(0, Math.round(Number(log.durationMin)||0)), note: String(log.note||"").slice(0,500) });
    let base = null;
    if(sid){ const ss = await cloud.listSessions(cid); base = ss.find(s=> s.id === sid) || null; }
    const exercises = (base && base.exercises ? clean(base.exercises) : []);
    exs.forEach(e=>{
      const hit = exercises.find(x=> (x.exId && x.exId === e.exerciseId) || (x.name && lc(x.name) === lc(e.name)));
      const res = e.sets.map(s=> e.timed ? "✓" : `${s.kg}×${s.reps}`).join(" · ");
      if(hit){ hit.done = true; hit.result = res; }
      else exercises.push({ uid: rid("u"), name: e.name, exId: e.exerciseId || undefined, sets: e.sets.length, reps: e.reps || String(e.sets[0].reps||""), restSec: 90, img: e.img || "", muscle: e.muscle || "", done: true, result: res });
    });
    const hm = d=> `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    // QP-06: mỗi lần PT sửa → rev + 1, học viên thay (không cộng dồn) kết quả lần trước
    proxyLog.rev = base && base.proxyLog ? (Number(base.proxyLog.rev)||1) + 1 : 1;
    const s = clean(Object.assign(
      base ? { id: base.id } : { date, time: hm(new Date(log.startedAt || now())), mode:"offline", title: proxyLog.title, seenByStudent:false },
      { status:"done", completedAt: now(), completedBy:"pt", exercises, proxyLog, proxyApplied: null }));
    // QP-07: buổi gắn vào phải trùng ngày tập thật (UI đã hỏi PT trước khi dời)
    if(base && isDate(base.date) && base.date !== date) s.date = date;
    const saved = await cloud.saveSession(cid, s);
    try{ await api.sendMessage(cid, { kind:"log", text:`Đã ghi buổi "${proxyLog.title}": ${exs.length} bài · ${proxyLog.sets} hiệp${vol ? ` · ${Math.round(vol).toLocaleString("vi-VN")} kg` : ""}.`, meta:{ sid: saved.id, volume: proxyLog.volume } }, "pt"); }catch(e){}
    return saved;
  }),
  applyProxyLog, writeExerciseResult, revertProxyLog, proxySnapshot,
  markProxyApplied: wrap(async (cid, sid)=> cloud.saveSession(cid, { id: sid, proxyApplied: now() })),    // proxyApplied ≥ proxyLog.at ⇔ đã áp bản mới nhất

  /* ---------- Cộng đồng: routine ---------- */
  setSeeds(list, version){ SEEDS = (list||[]).map(clean); SEED_VERSION = version || SEED_VERSION; },
  get seeds(){ return SEEDS; },
  listRoutines: wrap(async opts=>{
    opts = opts || {};
    if(SEEDS.length) demo.ensureSeeds(SEEDS, SEED_VERSION);
    let list = await demo.listRoutines();
    if(isFb()){
      let remote = [];
      try{ remote = await fbe.listRoutines(opts.limit || 200); }catch(e){ if(!list.length) throw e; }
      const ids = new Set(remote.map(r=> r.id));
      list = remote.concat(list.filter(r=> !ids.has(r.id)));
    }
    return list;
  }),
  getRoutine: wrap(async id=> RE(id).getRoutine(id)),
  routinesByAuthor: wrap(async uid=>{
    const local = (await demo.listRoutines()).filter(r=> r.authorUid === uid);
    if(!isFb() || uid === "tapeasy") return local;
    return (await fbe.routinesByAuthor(uid)).concat(local);
  }),
  publishRoutine: wrap(async (routine, opts)=>{
    const u = needUser();
    const bad = validateRoutine(routine);
    if(bad) throw err(bad, "social/invalid");
    const mine = (await api.routinesByAuthor(u.uid)).filter(r=> (r.createdAt||0) > now() - DAY);
    if(mine.length >= 10) throw err("Bạn đã đăng 10 giáo án chia sẻ trong 24 giờ, thử lại sau nhé.", "social/rate");
    const pr = cloud.profile || {};
    const doc = clean(Object.assign({}, routine, {
      authorUid: u.uid, authorName: (pr.isPT && pr.brandName) || u.name || pr.name || "Thành viên",
      authorRole: pr.isPT ? "pt" : "member", authorPhoto: (pr.photo && String(pr.photo).length < 60000) ? pr.photo : null,
      authorSpecialty: pr.isPT ? (pr.specialty || "") : "",
      likes:0, saves:0, copies:0, reports:0, hidden:false, status:"public", createdAt: now(), updatedAt: now(), v:1 }));
    if(opts && opts.id){ ["likes","saves","copies","reports","hidden","createdAt","status","v"].forEach(k=> delete doc[k]); return RE(opts.id).updateRoutine(opts.id, doc, u.uid); }
    return E().createRoutine(doc);
  }),
  deleteRoutine: wrap(async id=>{ const u = needUser(); return RE(id).deleteRoutine(id, u.uid); }),
  toggleLike: wrap(async (id, on)=> RE(id).toggle("likes", id, actorFor(id), on)),
  toggleSave: wrap(async (id, on)=> RE(id).toggle("saves", id, actorFor(id), on)),
  recordCopy: wrap(async id=>{ let a; try{ a = actorFor(id); }catch(e){ return { first:false }; } return RE(id).recordCopy(id, a); }),
  reportRoutine: wrap(async (id, reason)=>{ const a = actorFor(id); return RE(id).report(id, a, String(reason||"Khác").slice(0,200), reportTrust(a)); }),
  /** QC-14: trọng số báo cáo của một tài khoản (1 = ≥ 7 ngày tuổi; 0 = mới/khách) */
  reportTrust: uid=> reportTrust(uid),
  mySocial: wrap(async ()=>{
    const u = me();
    let guest = null; try{ guest = localStorage.getItem("tapeasy_guest_id"); }catch(e){}
    const local = await demo.mySocial(u ? u.uid : (guest || "guest"));
    if(!isFb() || !u) return local;
    let remote = { liked:[], saved:[], copied:[], reported:[] };
    try{ remote = await fbe.mySocial(u.uid); }catch(e){}
    const m = k=> Array.from(new Set([...(remote[k]||[]), ...(local[k]||[])]));
    return { liked: m("liked"), saved: m("saved"), copied: m("copied"), reported: m("reported") };
  }),

  /* ---------- Kiểm duyệt ---------- */
  moderation: { findProfanity, cleanText, hasProfanity: t=> findProfanity(t).length > 0, REPORT_HIDE, REPORT_TRUST_DAYS, isHidden, reportWeightOf },

  /* ---------- Logic thuần (UI & kiểm thử) ---------- */
  logic: { chatInfo, buildTrainingSummary, summaryHash, applyProxyLog, writeExerciseResult, routineFromPlan, planFromRoutine, validateRoutine,
    filterRoutines, sortRoutines, trendScore, isHidden, findProfanity, cleanText, hashStr, normS, dadd, dstr, dparse, dayKeyOf,
    GOALS: GOALS_R, LEVELS: LEVELS_R, GENDERS: GENDERS_R, EQUIP: EQUIP_R, DEMO_KEY },
  _demo: { load: dLoad, save: dSave, reset(){ try{ localStorage.removeItem(DEMO_KEY); }catch(e){} } },
};

/* =====================================================================
   5. LỚP QUYỀN PT ↔ HỌC VIÊN (fix-pt · 11/11/2026)
   Bọc cloud.saveSession / updateClient / deleteSession / leaveCoach / deleteAccount / deleteClient /
   getUser / updateMyProfile. Bản demo: mô phỏng đúng firestore.rules đề xuất (docs/qa/FIX-pt.md · Chuyển giao);
   bản Firebase: chặn ở client (UI), máy chủ chặn bằng rules.
   · QP-01  Học viên KHÔNG tạo / xoá buổi, KHÔNG đổi "Đã tập" → "Huỷ/vắng"; chỉ PT đổi trạng thái — mọi lần đổi ghi statusLog.
   · QP-04  Học viên chỉ chuyển scheduled → done cho buổi HÔM NAY / HÔM QUA (không hoàn thành trước buổi tương lai).
   · QP-05  Học viên không ghi được xác nhận bác sĩ (PT-only: clients.parqClearance; health.parq.clearance bị giữ nguyên).
   · QP-18  Học viên chỉ ghi health/measurements/photos/chat/trainingSync của form mình; người ngoài form → permission-denied.
   · QP-11  Rời PT: gỡ trainingSync (+ tuỳ chọn xoá ảnh/số đo/sức khoẻ tự nhập), lưu quyền đánh giá bền vững (QP-02).
   · QP-03/17 Xoá tài khoản (demo): dọn sức khoẻ/ảnh/số đo/nhật ký khỏi form PT, tin nhắn, lời mời theo email, niêm yết Tìm PT.
   · QP-10  SĐT PT không ghi vào users/{uid} (ai cũng đọc được) — lưu riêng trên máy + gửi vào form học viên (clients.ptPhone).
   · QS-14  Nhận form chưa kết nối phải có bằng chứng (lời mời đúng email / mã — joinByCode của cloud.js).
   Demo: trường trái quyền bị BỎ QUA (ghi phần hợp lệ, trả bản ghi thật) để đồng bộ ngoại tuyến không vỡ; người ngoài form → lỗi.
   ===================================================================== */
const SESS_STUDENT_KEYS = new Set(["feedback","feedbackAt","seenByStudent","studentLog","proxyApplied","exercises","status","completedAt","completedBy","updatedAt"]);   // = studentSessionEdit() trong firestore.rules
const CLIENT_STUDENT_KEYS = new Set(["health","measurements","photos","chat","trainingSync","updatedAt"]);
const JOIN_KEYS = new Set(["studentUid","studentName","studentEmail","updatedAt"]);
const ST_OK = new Set(["scheduled","done","cancelled"]);
const same = (a, b)=> JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
const permErr = m=>{ const e = new Error(m || "Bạn không có quyền thực hiện thao tác này."); e.code = "permission-denied"; return e; };
const pwarn = (...a)=>{ try{ console.warn("[quyền PT]", ...a); }catch(e){} };
function canStudentComplete(date, today){ today = today || todayS(); return isDate(date) && date <= today && date >= dadd(today, -1); }

/** Lọc 1 lần ghi buổi tập theo vai. Trả { patch, denied[], reason } — reason "not-member" | "student-create" | null */
function sessionPolicy(role, cur, input, today, uid){
  let patch = Object.assign({}, input || {}); delete patch.id; delete patch.statusLog;
  today = today || todayS();
  const denied = [];
  if(role !== "pt" && role !== "student") return { patch:{}, denied: Object.keys(patch), reason:"not-member" };
  if("status" in patch && !ST_OK.has(patch.status)){ denied.push("status"); delete patch.status; }      // QS-04: trạng thái theo danh sách trắng
  if(role === "student"){
    if(!cur) return { patch:{}, denied: Object.keys(patch), reason:"student-create" };
    const out = {};
    Object.keys(patch).forEach(k=>{
      if(same(patch[k], cur[k])) return;
      if(!SESS_STUDENT_KEYS.has(k)){ denied.push(k); return; }
      out[k] = patch[k];
    });
    if("status" in out && !(cur.status === "scheduled" && out.status === "done" && canStudentComplete(cur.date, today))){ denied.push("status"); delete out.status; }
    const completing = out.status === "done";
    if(completing){ out.completedBy = "student"; out.completedAt = Number(out.completedAt) || now(); }
    else ["completedAt","completedBy"].forEach(k=>{ if(k in out){ denied.push(k); delete out[k]; } });
    if("studentLog" in out && !completing && !(cur.status === "done" && cur.completedBy === "student")){ denied.push("studentLog"); delete out.studentLog; }
    if("exercises" in out){
      const ce = Array.isArray(cur.exercises) ? cur.exercises : [], pe = Array.isArray(out.exercises) ? out.exercises : [];
      if(pe.length !== ce.length) denied.push("exercises.length");
      out.exercises = ce.map((e, i)=>{ const p = pe[i] || {}, o = Object.assign({}, e);
        if("done" in p) o.done = !!p.done; if(typeof p.result === "string") o.result = p.result.slice(0, 200); return o; });
      if(same(out.exercises, ce)) delete out.exercises;
    }
    if("feedback" in out) out.feedback = String(out.feedback == null ? "" : out.feedback).slice(0, 2000);
    patch = out;
  }
  if(cur && "status" in patch && patch.status !== cur.status){
    const log = { from: cur.status || null, to: patch.status, by: role, uid: uid || null, at: now() };
    if(patch.cancelKind) log.kind = String(patch.cancelKind).slice(0, 20);
    patch.statusLog = (Array.isArray(cur.statusLog) ? cur.statusLog : []).concat([log]).slice(-20);
  } else if(!cur && role === "pt" && patch.status && patch.status !== "scheduled"){
    patch.statusLog = [{ from:null, to: patch.status, by:"pt", uid: uid || null, at: now() }];
  }
  return { patch, denied, reason: null };
}
/** Lọc 1 lần ghi form học viên. proof = có lời mời / mã hợp lệ khi nhận form */
function clientPolicy(cur, input, uid, proof){
  const patch = Object.assign({}, input || {}); delete patch.id;
  if(!cur) return { patch:{}, denied:[], reason:"not-found" };
  const keys = Object.keys(patch);
  if(cur.ptId === uid){
    if("ptId" in patch && patch.ptId !== uid) return { patch:{}, denied:["ptId"], reason:"not-member" };
    if("parqClearance" in patch && patch.parqClearance) patch.parqClearance = Object.assign({}, patch.parqClearance, { by:"pt", byUid: uid });
    return { patch, denied:[], reason:null };
  }
  if(!cur.studentUid && patch.studentUid === uid && keys.every(k=> JOIN_KEYS.has(k)))
    return proof ? { patch, denied:[], reason:null } : { patch:{}, denied: keys, reason:"join-proof" };
  if(cur.studentUid !== uid) return { patch:{}, denied: keys, reason:"not-member" };
  if(patch.studentUid === null && keys.every(k=> JOIN_KEYS.has(k))) return { patch, denied:[], reason:null };     // rời PT
  const out = {}, denied = [];
  keys.forEach(k=>{
    if(same(patch[k], cur[k])) return;
    if(!CLIENT_STUDENT_KEYS.has(k)){ denied.push(k); return; }
    out[k] = patch[k];
  });
  // QP-05: xác nhận bác sĩ là việc của PT — học viên ghi health thì giữ nguyên clearance cũ
  if(out.health && typeof out.health === "object"){
    const h = Object.assign({}, out.health);
    if(h.parq && typeof h.parq === "object"){
      const old = cur.health && cur.health.parq ? cur.health.parq.clearance : null;
      if(!same(h.parq.clearance || null, old || null)) denied.push("health.parq.clearance");
      h.parq = Object.assign({}, h.parq, { clearance: old || null });
    }
    out.health = h;
  }
  // số đo / ảnh PT nhập: học viên không sửa/xoá
  ["measurements","photos"].forEach(k=>{
    if(!(k in out)) return;
    const mine = (Array.isArray(out[k]) ? out[k] : []).filter(x=> x && x.by !== "pt");
    const pts = (Array.isArray(cur[k]) ? cur[k] : []).filter(x=> x && x.by === "pt");
    const ids = new Set(pts.map(x=> x.id));
    out[k] = mine.filter(x=> !ids.has(x.id)).concat(pts).sort((a,b)=> String(a.date||"").localeCompare(String(b.date||"")));
  });
  return { patch: out, denied, reason:null };
}

/* SĐT riêng của PT: lưu trên máy (state.ptPrivate[uid]) — users/{uid} công khai không còn SĐT (QP-10 / QS-17) */
function privBox(){ try{ if(typeof state === "undefined" || !state) return null; state.ptPrivate = state.ptPrivate && typeof state.ptPrivate === "object" ? state.ptPrivate : {}; return state.ptPrivate; }catch(e){ return null; } }
function myPhone(){ const u = me(); const b = privBox(); const v = u && b && b[u.uid] && b[u.uid].phone; return v || ""; }
function setMyPhone(v){
  const u = me(); const b = privBox(); const phone = String(v || "").trim().slice(0, 20);
  if(u && b){ b[u.uid] = Object.assign({}, b[u.uid], { phone }); try{ saveState(); }catch(e){} }
  // Firebase: users/{uid}/private/contact (chỉ chủ + học viên đang kết nối đọc được — rules QS-17)
  if(u && isFb()){ try{ fdb().collection("users").doc(u.uid).collection("private").doc("contact").set({ phone, updatedAt: now() }).catch(()=>{}); }catch(e){} }
}

async function curSession(cid, sid){
  if(!sid) return null;
  if(isFb()){ try{ return dd(await fdb().collection("clients").doc(cid).collection("sessions").doc(sid).get()); }catch(e){ return null; } }
  const s = ((cloudDemo().sessions || {})[cid] || {})[sid]; return s ? clean(s) : null;
}

/* Dọn dữ liệu người dùng đã xoá tài khoản — bản demo mô phỏng Cloud Function cleanupUserData (Firebase: Chuyển giao) */
function demoCleanupDeletedUser(info){
  if(isFb() || !info || !info.uid) return;
  const uid = info.uid, email = lc(info.email);
  try{
    const db = JSON.parse(localStorage.getItem(CLOUD_DEMO_KEY) || "{}");
    (info.studentForms || []).forEach(cid=>{
      const c = db.clients && db.clients[cid]; if(!c) return;
      ["health","measurements","photos","trainingSync","parqClearance"].forEach(k=> delete c[k]);
      if(c.chat) c.chat = { n:{ pt: Number((c.chat.n||{}).pt)||0, student:0 }, read:{ pt:0, student: Number((c.chat.read||{}).student)||0 }, readAt:{} };
      c.updatedAt = now();
      Object.values((db.sessions || {})[cid] || {}).forEach(s=>{ ["feedback","feedbackAt","studentLog"].forEach(k=> delete s[k]); });
      const ns = (db.notes || {})[cid] || {}; Object.keys(ns).forEach(id=>{ if(ns[id] && ns[id].authorUid === uid) delete ns[id]; });
    });
    localStorage.setItem(CLOUD_DEMO_KEY, JSON.stringify(db));
  }catch(e){ pwarn("dọn kho demo", e); }
  const d = dLoad();
  (info.studentForms || []).forEach(cid=>{ const box = d.messages[cid]; if(box) Object.keys(box).forEach(id=>{ if(box[id] && box[id].from === uid) delete box[id]; }); });
  (info.ptForms || []).forEach(cid=>{ delete d.messages[cid]; });
  Object.keys(d.invites).forEach(id=>{ const i = d.invites[id]; if(i && (i.ptId === uid || i.studentUid === uid || (email && i.email === email))) delete d.invites[id]; });
  dSave(d);
  try{ if(cloud.ptdir && typeof cloud.ptdir._cleanupUser === "function") cloud.ptdir._cleanupUser(uid, (info.studentForms || []).concat(info.ptForms || [])); }catch(e){ pwarn("dọn Tìm PT", e); }
}

const RAW = {};
function installPolicy(){
  ["saveSession","updateClient","deleteSession","leaveCoach","deleteAccount","deleteClient","getUser","updateMyProfile"].forEach(k=>{ RAW[k] = cloud[k]; });
  if(typeof RAW.saveSession !== "function" || cloud.__ptPolicy) return false;
  const ccache = {};      // form theo cid (30 s) — giảm 1 lần đọc / lần ghi khi PT tạo hàng loạt buổi
  const getC = async (cid, fresh)=>{
    const u = me(); const k = (u ? u.uid : "") + "|" + cid, hit = ccache[k];
    if(!fresh && hit && Date.now() - hit.at < 30000) return hit.c;
    const c = await cloud.getClient(cid); ccache[k] = { c, at: Date.now() }; return c;
  };
  const drop = cid=>{ Object.keys(ccache).forEach(k=>{ if(k.endsWith("|" + cid)) delete ccache[k]; }); };

  cloud.saveSession = async function(cid, s){
    const u = me(); if(!u) return RAW.saveSession.apply(cloud, arguments);
    const c = await getC(cid);
    const role = myRoleIn(c);
    if(!role) throw permErr("Bạn không thuộc form PT ↔ học viên này.");
    const sid = s && s.id ? s.id : null;
    const cur = sid ? await curSession(cid, sid) : null;
    const pol = sessionPolicy(role, cur, s, todayS(), u.uid);
    if(pol.reason === "student-create"){ pwarn("học viên không tạo buổi tập (chỉ PT xếp lịch)"); return null; }
    /* integrator (FIX-security vòng 2 #3): rules nhận statusLog học viên nối thêm đúng 1 dòng { from:'scheduled', to:'done', by:'student', uid, at }
       khi CHÍNH lần ghi chuyển scheduled → done — sessionPolicy chỉ cho học viên đúng chuyển này nên giữ nguyên dòng log (không xoá nữa). */
    if(pol.denied.length) pwarn("bỏ qua trường không được phép:", pol.denied.join(", "));
    if(cur && !Object.keys(pol.patch).length) return cur;
    return RAW.saveSession.call(cloud, cid, Object.assign(sid ? { id: sid } : {}, pol.patch));
  };
  cloud.deleteSession = async function(cid, sid){
    const u = me(); if(!u) return RAW.deleteSession.apply(cloud, arguments);
    const c = await getC(cid);
    if(myRoleIn(c) !== "pt") throw permErr("Chỉ PT xoá được buổi tập.");
    return RAW.deleteSession.apply(cloud, arguments);
  };
  cloud.updateClient = async function(cid, partial){
    const u = me(); if(!u) return RAW.updateClient.apply(cloud, arguments);
    const proof = !!(JOIN.ctx && JOIN.ctx.cid === cid && JOIN.ctx.uid === u.uid);
    let c = null;
    try{ c = await getC(cid, true); }catch(e){ if(proof) return RAW.updateClient.call(cloud, cid, partial); throw e; }
    if(!c) return RAW.updateClient.apply(cloud, arguments);
    const pol = clientPolicy(c, partial, u.uid, proof);
    if(pol.reason === "not-member" || pol.reason === "join-proof") throw permErr(pol.reason === "join-proof" ? "Cần mã hoặc lời mời của PT để nhận form này." : "Bạn không thuộc form PT ↔ học viên này.");
    if(pol.denied.length) pwarn("bỏ qua trường không được phép:", pol.denied.join(", "));
    if(!Object.keys(pol.patch).length) return c;
    drop(cid);
    return RAW.updateClient.call(cloud, cid, pol.patch);
  };
  cloud.leaveCoach = async function(cid, opts){
    opts = opts || {};
    const u = me(); let c = null;
    try{ c = u ? await getC(cid, true) : null; }catch(e){}
    if(c && u && c.studentUid === u.uid){
      try{ if(cloud.ptdir && typeof cloud.ptdir.recordRights === "function") await cloud.ptdir.recordRights(c, await RAW_list(cid)); }catch(e){ pwarn("quyền đánh giá", e); }
      const wipe = { trainingSync: null };
      if(opts.wipeHealth) Object.assign(wipe, { health: null, measurements: [], photos: [] });
      try{ await cloud.updateClient(cid, wipe); }catch(e){ pwarn("gỡ dữ liệu khi rời PT", e); }
      try{ const pc = typeof state !== "undefined" && state && state.ptConnect; if(pc && pc.syncHash) delete pc.syncHash[cid]; }catch(e){}
    }
    drop(cid);
    return RAW.leaveCoach.call(cloud, cid);
  };
  cloud.deleteClient = async function(cid){
    const u = me(); let c = null;
    try{ c = u ? await getC(cid, true) : null; }catch(e){}
    if(c && u && c.ptId === u.uid && c.studentUid){
      try{ if(cloud.ptdir && typeof cloud.ptdir.recordRights === "function") await cloud.ptdir.recordRights(c, await RAW_list(cid)); }catch(e){}
    }
    const r = await RAW.deleteClient.apply(cloud, arguments);
    drop(cid);
    if(!isFb()){ try{ const d = dLoad(); delete d.messages[cid]; Object.keys(d.invites).forEach(id=>{ if(d.invites[id] && d.invites[id].clientId === cid) delete d.invites[id]; }); dSave(d); }catch(e){} }
    return r;
  };
  cloud.deleteAccount = async function(pw){
    const u = me();
    const info = u ? { uid: u.uid, email: u.email, studentForms: [], ptForms: [] } : null;
    if(info){ try{ info.studentForms = (await cloud.myCoaches()).map(c=> c.id); info.ptForms = (await cloud.myClientsAsPT()).map(c=> c.id); }catch(e){} }
    const r = await RAW.deleteAccount.apply(cloud, arguments);      // xác thực mật khẩu trước — sai mật khẩu thì không dọn gì
    if(info) demoCleanupDeletedUser(info);
    Object.keys(ccache).forEach(k=> delete ccache[k]);
    return r;
  };
  cloud.getUser = async function(uid){
    const p = await RAW.getUser.apply(cloud, arguments);
    const u = me();
    if(p && typeof p === "object" && "phone" in p && !(u && u.uid === uid)){ const o = Object.assign({}, p); delete o.phone; return o; }
    return p;
  };
  cloud.updateMyProfile = async function(partial){
    partial = Object.assign({}, partial || {});
    if("phone" in partial){
      setMyPhone(partial.phone);
      // rules mới: users/{uid} không được chứa "phone" → Firebase xoá hẳn trường (kể cả hồ sơ cũ); demo ghi null
      partial.phone = isFb() ? FV().delete() : null;
    }
    return RAW.updateMyProfile.call(cloud, partial);
  };
  const RAW_list = cid=> cloud.listSessions(cid);
  try{ Object.defineProperty(cloud, "__ptPolicy", { value: true }); }catch(e){ cloud.__ptPolicy = true; }
  return true;
}
api.policy = { sessionPolicy, clientPolicy, canStudentComplete, installed: false, _demoCleanup: demoCleanupDeletedUser };
api.myPhone = myPhone; api.setMyPhone = setMyPhone;
try{ api.policy.installed = installPolicy(); }catch(e){ pwarn("không cài được lớp quyền", e); }

try{ cloud.social = api; }catch(e){ try{ Object.defineProperty(cloud, "social", { value: api, configurable:true }); }catch(_){} }
})();

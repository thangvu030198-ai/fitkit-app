/* =========================================================================
   TapEasy CỘNG ĐỒNG (community.js + community.css)
   · Bảng tin routine: thẻ đẹp (tên, tác giả, mục tiêu, cấp độ, số buổi, lượt sao chép / thích)
   · Tìm kiếm không dấu + lọc mục tiêu / cấp độ / giới tính / số buổi / dụng cụ, sắp xếp
   · Chi tiết routine: xem tuần, bài, video hướng dẫn, khối lượng theo nhóm cơ
   · "Sao chép vào tuần tập của tôi" → tạo plan mới trong state.plans (tự gắn video)
   · "Chia sẻ routine của tôi": chọn plan → mô tả → đăng
   · Hồ sơ người đăng, thích / lưu, báo cáo vi phạm (≥ 3 báo cáo → tạm ẩn), lọc từ ngữ thô tục
   · Dữ liệu mẫu: ≥ 12 routine của "TapEasy Team" (từ PROGRAM_TEMPLATES + biến thể)
   Điểm vào: menu ☰ · thẻ trên Trang chủ · nút trong màn Giáo án mẫu · goto("community")
   Cần cloud-social.js. Nạp SAU pt-pro.js. Trạng thái giao diện: state.community.
   ========================================================================= */
(function(){
"use strict";
const W = typeof window !== "undefined" ? window : globalThis;
if(W.TECommunity && W.TECommunity.installed) return;
const TC = W.TECommunity = W.TECommunity || {};
if(typeof cloud === "undefined" || !cloud || !cloud.social){ try{ console.warn("[community] cần nạp cloud-social.js trước"); }catch(e){} return; }
const S = cloud.social, L = S.logic;

/* ---------------------------------------------------------------------
   0b. fix-commerce — KIỂM DUYỆT MỞ RỘNG (QC-13) + LÀM SẠCH ROUTINE KHI SAO CHÉP (QS-03, QC-15)
   Bộ lọc gốc ở cloud-social.js (chỉ so NGUYÊN TỪ). Lớp này bổ sung — không thay — bằng chuẩn hoá:
   bỏ dấu (đ→d), đổi ký tự lách (! 1 | → i, 0 → o, @ → a, $ → s), bỏ . * _ - xen giữa, ghép chữ cái rời ("d.i.t m.e"),
   rồi so GỐC MẠNH ở đầu từ viết liền (ditme, djtme, ditmemay, vailon…) + danh sách viết tắt (cc, clm, cmnr…).
   Danh sách cho phép tránh bắt nhầm: lon (nước), các, cm, dm (đơn vị), du (lịch)… — chỉ bắt khi viết liền với gốc mạnh.
   Cài lên cloud.social.moderation / logic (hợp kết quả với bộ lọc gốc) → Cộng đồng, Tìm PT, kiểm duyệt quản trị cùng dùng.
   --------------------------------------------------------------------- */
const MOD = (function(){
  const strip = s=> String(s == null ? "" : s).normalize("NFC").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
  const LEET = { "!":"i", "1":"i", "|":"i", "0":"o", "@":"a", "$":"s" };
  const normTok = t=>{ let x = strip(t); if(/[a-z]/.test(x)) x = x.replace(/[!1|0@$]/g, c=> LEET[c]); return x.replace(/[*._\-]/g, ""); };
  const EXACT = new Set(["dit","djt","dume","duma","ditme","djtme","dkm","dcm","dcmm","dmm","dmcs","vcl","vkl","vcc","vlz","vailz","cc","clm","clmm","cmn","cmnr","cmm","loz","cak","cax","fuck","fck","fuk","shit"]);
  const ROOTS = [/^d[ij]t(me|ma|cu|con|bo|mo|may|m)/, /^dj?m(may|mm|cs|nr)$/, /^vail(o|z)?[nzl]+$/, /^cail[o]?[nz]+$/, /fuck|phuck|fukk/, /^shit/, /^cl(m|gt)+$/, /^dcm+$/, /^dkm+$/];
  const RAW = [/lồn/, /địt/, /cặc/, /buồi/];                        // có dấu, viết liền (vãilồn, địtmẹ…)
  const collapse = x=> x.replace(/(.)\1+/g, "$1");
  /* R3-ADMIN-05: từ khoá cấm do quản trị nhập (Bảng quản trị → Cộng đồng → Từ khoá cấm) — so KHÔNG DẤU, không phân biệt hoa thường,
     khớp nguyên từ / cụm từ (ranh giới là ký tự không phải chữ-số). cloud-admin.js gọi setCustom() mỗi khi cài đặt đổi. */
  let CUSTOM = [];
  const toksFull = t=> (String(t == null ? "" : t).normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  /* Khớp theo TỪ: chữ trong bài có dấu → phải đúng dấu ("kèo" không bắt "kéo"); chữ viết KHÔNG dấu → so dạng không dấu ("thuoc giam can") */
  function setCustom(list){ CUSTOM = (Array.isArray(list) ? list : []).map(w=>{ const full = toksFull(w); return { full, strip: full.map(strip) }; }).filter(w=> w.full.length && w.full.join("").length >= 2).slice(0, 200); return CUSTOM.length; }
  function customAt(tf, ts, i, w){ for(let j = 0; j < w.full.length; j++){ const a = tf[i + j]; if(a == null) return false; if(a !== w.full[j] && !(a === ts[i + j] && a === w.strip[j])) return false; } return true; }
  function customHits(text){
    if(!CUSTOM.length) return [];
    const tf = toksFull(text), ts = tf.map(strip), out = [];
    CUSTOM.forEach(w=>{ for(let i = 0; i + w.full.length <= tf.length; i++){ if(customAt(tf, ts, i, w)){ out.push(w.full.join(" ")); break; } } });
    return out;
  }
  const customTok = tok=>{ const tf = toksFull(tok); if(tf.length !== 1) return false; const ts = tf.map(strip); return CUSTOM.some(w=> w.full.length === 1 && customAt(tf, ts, 0, w)); };
  function tokBad(tok){
    const raw = String(tok || "").normalize("NFC").toLowerCase();
    if(RAW.some(re=> re.test(raw))) return true;
    const n = normTok(tok); if(n.length < 2 || /^\d+$/.test(n)) return false;
    const c = collapse(n);
    return EXACT.has(n) || EXACT.has(c) || ROOTS.some(re=> re.test(n) || re.test(c));
  }
  function hits(text){
    const s = String(text == null ? "" : text); if(!s.trim()) return [];
    const out = new Set();
    const toks = s.match(/[\p{L}\p{N}!|@$*._\-]+/gu) || [];
    toks.forEach((t, i)=>{ if(!tokBad(t)) return;
      if(/^c+$/i.test(normTok(t)) && i > 0 && /^\d+([.,]\d+)?$/.test(toks[i-1])) return;   // "150 cc" (dung tích)
      out.add(t); });
    /* chữ cái rời liên tiếp: "d.i.t m.e", "c c" */
    const letters = s.match(/[\p{L}!|@$]+/gu) || [];
    let run = "";
    const flush = ()=>{ if(run.length >= 2 && tokBad(run)) out.add(run); run = ""; };
    letters.forEach(t=>{ if([...t].length === 1) run += t; else flush(); }); flush();
    customHits(s).forEach(w=> out.add(w));
    return [...out];
  }
  function union(a, b){ return Array.from(new Set([].concat(a || [], b || []))); }
  let origFind = null, origClean = null;
  const find = t=>{ let base = []; try{ base = origFind ? origFind(t) : []; }catch(e){} return union(base, hits(t)); };
  function clean(t){
    let out = String(t == null ? "" : t);
    try{ out = origClean ? origClean(out) : out; }catch(e){}
    if(!hits(out).length) return out;
    out = out.replace(/[\p{L}\p{N}!|@$*._\-]+/gu, w=> tokBad(w) || (CUSTOM.length && customTok(w)) ? "*".repeat([...w].length) : w);
    return hits(out).length ? "[Nội dung đã được ẩn vì vi phạm tiêu chuẩn cộng đồng]" : out;
  }
  function routineTexts(r){ r = r || {}; const days = Object.values(r.days || {}); return [r.title, r.desc, ...(r.tags || []), ...days.map(d=> d && d.title), ...days.flatMap(d=> ((d && d.ex) || []).map(e=> [e && e.name, e && e.guide].join(" ")))].join(" \n "); }
  function validate(r){ const bad = hits(routineTexts(r)); return bad.length ? `Nội dung có từ ngữ không phù hợp ("${bad.slice(0,3).join('", "')}"). Vui lòng sửa lại trước khi đăng.` : null; }
  function install(){
    const M = S.moderation || {}; if(M.__fixCommerce) return;
    origFind = typeof M.findProfanity === "function" ? M.findProfanity : (typeof L.findProfanity === "function" ? L.findProfanity : null);
    origClean = typeof M.cleanText === "function" ? M.cleanText : (typeof L.cleanText === "function" ? L.cleanText : null);
    Object.assign(M, { findProfanity: find, cleanText: clean, hasProfanity: t=> find(t).length > 0, __fixCommerce: true });
    if(L){ L.findProfanity = find; L.cleanText = clean;
      if(typeof L.validateRoutine === "function"){ const ov = L.validateRoutine; L.validateRoutine = r=> ov(r) || validate(r); } }
    if(typeof S.publishRoutine === "function"){ const op = S.publishRoutine;
      S.publishRoutine = async function(routine, opts){ const bad = validate(routine); if(bad) throw Object.assign(new Error(bad), { code:"social/invalid" }); return op.apply(this, arguments); }; }
  }
  return { hits, tokBad, find, clean, validate, install, normTok, setCustom, customHits };
})();
try{ MOD.install(); }catch(e){ try{ console.warn("[community] moderation", e); }catch(_){} }
TC.moderation = MOD;
try{ const A0 = W.cloudAdmin; if(A0 && typeof A0.bannedWords === "function") MOD.setCustom(A0.bannedWords()); }catch(e){}

/* QS-03: routine của người khác → giáo án trên máy: CHỈ giữ trường cho phép, ép kiểu số, cắt độ dài, bỏ ký tự thẻ HTML
   (giáo án được vẽ ở Trang chủ/Tập luyện — app.js/pt.js — nên dữ liệu phải sạch ngay khi nhập). */
const PLAN_INT = ["Nghỉ","Thấp","Nhẹ","Vừa","Cao","Rất cao"];
const clipT = (s, n)=> String(s == null ? "" : s).replace(/[<>`\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
const intIn = (v, lo, hi, d)=>{ const n = Math.round(Number(v)); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
function sanitizePlan(plan, r){
  plan = plan || {}; r = r || {};
  const mk = ()=>{ try{ return typeof uid === "function" ? uid() : Math.random().toString(36).slice(2, 10); }catch(e){ return Math.random().toString(36).slice(2, 10); } };
  const safeId = (s, n)=> String(s == null ? "" : s).replace(/[^\w\-]/g, "").slice(0, n || 80);
  const days = {};
  DK.forEach(k=>{
    const d = (plan.days && plan.days[k]) || {};
    const items = (Array.isArray(d.items) ? d.items : []).slice(0, 20).map(it=>{
      it = it || {};
      const known = it.exerciseId && typeof EXERCISES !== "undefined" && Object.prototype.hasOwnProperty.call(EXERCISES, it.exerciseId) ? String(it.exerciseId) : null;
      const c = it.custom || {};
      return { uid: safeId(it.uid) || ((known ? known + "_" : "") + mk()), exerciseId: known,
        custom: known ? null : { name: MOD.clean(clipT(c.name || "Bài tập", 80)) || "Bài tập", muscle: clipT(c.muscle || "Tuỳ chỉnh", 40), equipment: clipT(c.equipment || "—", 40), guide: MOD.clean(clipT(c.guide, 500)) },
        sets: intIn(it.sets, 1, 10, 3), reps: clipT(it.reps || "10", 60) || "10", restSec: intIn(it.restSec, 0, 600, 60), clipId: null };
    });
    days[k] = { title: MOD.clean(clipT(d.title || (items.length ? "Buổi tập" : "Nghỉ ngơi"), 60)), intensity: PLAN_INT.includes(d.intensity) ? d.intensity : (items.length ? "Vừa" : "Nghỉ"),
      duration: intIn(d.duration, 0, 240, 30), items };
  });
  const author = MOD.clean(clipT(r.authorName || "TapEasy", 40)) || "TapEasy";
  return { id: safeId(plan.id) || ("plan_" + mk()), name: MOD.clean(clipT(r.title || plan.name || "Giáo án cộng đồng", 80)) || "Giáo án cộng đồng",
    tagline: `CỘNG ĐỒNG · ${author.toUpperCase()}`, builtin:false, fromRoutine: safeId(r.id || plan.fromRoutine) || null, days };
}
try{ if(L && typeof L.planFromRoutine === "function" && !L.planFromRoutine.__fixCommerce){ const op = L.planFromRoutine; L.planFromRoutine = function(r, uidFn){ return sanitizePlan(op.call(this, r, uidFn), r); }; L.planFromRoutine.__fixCommerce = true; } }catch(e){}
/* QC-14 (phần ở lớp Cộng đồng): tác giả không tự báo cáo routine của mình. Trọng số theo tuổi tài khoản → cloud-social.js (chuyển giao pt) */
try{ if(typeof S.reportRoutine === "function" && !S.reportRoutine.__fixCommerce){ const orr = S.reportRoutine;
  S.reportRoutine = async function(id, reason){ const u = cloud.user;
    if(u){ let r = (C.list || []).find(x=> x.id === id) || null; if(!r){ try{ r = await S.getRoutine(id); }catch(e){} }
      if(r && r.authorUid && r.authorUid === u.uid) throw Object.assign(new Error("Đây là giáo án chia sẻ của bạn — bạn có thể sửa hoặc gỡ thay vì báo cáo."), { code:"social/own" }); }
    return orr.apply(this, arguments); };
  S.reportRoutine.__fixCommerce = true; } }catch(e){}

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH
   --------------------------------------------------------------------- */
const esc = s=> (typeof escapeHtml === "function") ? escapeHtml(s==null ? "" : String(s)) : String(s==null ? "" : s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = (n, cls)=> `<span class="material-symbols-rounded${cls ? " "+cls : ""}" aria-hidden="true">${n}</span>`;
const q = (sel, root)=> (root || document).querySelector(sel);
const qa = (sel, root)=> Array.from((root || document).querySelectorAll(sel));
const DK = typeof DAY_KEYS !== "undefined" ? DAY_KEYS : ["T2","T3","T4","T5","T6","T7","CN"];
const DLBL = typeof DAY_LABELS !== "undefined" ? DAY_LABELS : { T2:"Thứ 2", T3:"Thứ 3", T4:"Thứ 4", T5:"Thứ 5", T6:"Thứ 6", T7:"Thứ 7", CN:"Chủ nhật" };
const kN = n=>{ n = Number(n)||0; return n >= 10000 ? Math.round(n/1000) + "k" : n >= 1000 ? (Math.round(n/100)/10).toLocaleString("vi-VN") + "k" : String(n); };
const warn = (...a)=>{ try{ console.warn("[community]", ...a); }catch(e){} };
const initials = n=> String(n||"?").trim().split(/\s+/).map(w=> w[0]||"").slice(-2).join("").toUpperCase() || "?";
const isImg = d=> typeof d === "string" && (/^data:image\/(jpeg|png|webp);base64,/.test(d) || /^https:\/\//.test(d));
const exMeta = e=> (e && e.id && typeof EXERCISES !== "undefined" && EXERCISES[e.id]) ? EXERCISES[e.id] : null;
const exName = e=>{ const m = exMeta(e); return m ? m.name : (e && e.name) || "Bài tập"; };
const shortName = n=> String(n||"").split("(")[0].trim();
/* Quyền quản trị (rbac.js → teCan) — chỉ ẩn/hiện nút; quyền ghi thật ở firestore.rules (hasPerm) */
const can = p=>{ try{ return typeof teCan === "function" ? !!teCan(p) : false; }catch(e){ return false; } };
const CA = ()=> (W.cloudAdmin && typeof W.cloudAdmin.moderate === "function") ? W.cloudAdmin : null;
const pinnedSet = ()=>{ try{ const A = CA(); return new Set((A && A.featuredIds && A.featuredIds()) || []); }catch(e){ return new Set(); } };
const isPinned = (r, set)=> !!(r && (r.featured || (set || pinnedSet()).has(r.id)));
function brandMark(cls){
  return `<span class="te-mark ${cls||""}" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M9.5 10.5h13M16 10.5v12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><circle cx="16" cy="26" r="1.9" fill="currentColor"/></svg><img src="assets/brand/logo-mark.svg" alt="" onerror="this.remove()"></span>`;
}
/* fix-commerce QC-17: trạng thái màn LUÔN là cùng một đối tượng (bổ sung mặc định tại chỗ) — trước đây mỗi lần gọi st() tạo bản sao,
   bộ lắng nghe ô tìm kiếm giữ bản cũ → chỉ vẽ lại vùng kết quả thì từ khoá bị mất (danh sách không lọc). */
const ST_F = { goal:"all", level:"all", gender:"all", perWeek:"all", equipment:"all", q:"" };
let _stLocal = null;
function st(){
  let s;
  if(typeof state === "undefined" || !state) s = _stLocal = _stLocal || {};
  else s = state.community = (state.community && typeof state.community === "object" && !Array.isArray(state.community)) ? state.community : {};
  if(!s.tab) s.tab = "explore";
  if(!s.sort) s.sort = "trend";
  if(!s.f || typeof s.f !== "object") s.f = {};
  for(const k in ST_F) if(s.f[k] == null) s.f[k] = ST_F[k];
  return s;
}
const save = ()=>{ try{ saveState(); }catch(e){} };
/* ---- R3-ADMIN-04 · Điều khoản nội dung người dùng (App Store Guideline 1.2: người dùng phải đồng ý điều khoản,
   không dung thứ nội dung phản cảm / người dùng lạm dụng; có Báo cáo + Chặn; xử lý báo cáo trong 24 giờ) ---- */
const TERMS = [
  "Không dung thứ nội dung phản cảm: khiêu dâm, bạo lực, thù ghét, quấy rối, xúc phạm, lừa đảo.",
  "Không quảng cáo, spam, bán thuốc / thực phẩm chức năng không rõ nguồn gốc; không lời khuyên sức khoẻ nguy hiểm.",
  "Chỉ đăng nội dung của bạn; ảnh / clip có người khác phải được họ đồng ý. Không lộ thông tin cá nhân của người khác.",
  "Mỗi bài, bình luận đều có nút Báo cáo; bạn có thể Chặn bất kỳ người dùng nào — nội dung của họ biến mất ngay khỏi bảng tin của bạn.",
  "Đội ngũ TapEasy xem xét báo cáo trong vòng 24 giờ: gỡ nội dung vi phạm và tạm dừng / khoá tài khoản đăng nội dung đó.",
];
const termsOK = ()=> Number(st().termsAt) > 0;
function acceptTerms(){ const s = st(); if(!(Number(s.termsAt) > 0)){ s.termsAt = Date.now(); s.termsV = 1; save(); } return true; }
function openTerms(onAgree){
  const ok = termsOK();
  openSheet(`<div class="sheet-header"><h3>Tiêu chuẩn cộng đồng</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <ol class="cm-terms">${TERMS.map(t=> `<li>${esc(t)}</li>`).join("")}</ol>
    <p class="small-note">Vi phạm có thể bị gỡ bài, tạm dừng đăng hoặc khoá tài khoản mà không báo trước.</p>
    ${ok ? `<p class="small-note cm-terms-ok">${ic("check_circle")}Bạn đã đồng ý với tiêu chuẩn này.</p>` : `<button type="button" class="btn btn-primary btn-block" id="cm-terms-go">Tôi đồng ý</button>`}`);
  const b = q("#cm-terms-go"); if(b) b.addEventListener("click", ()=>{ acceptTerms(); closeSheet(); toast("Cảm ơn bạn — cùng giữ cộng đồng lành mạnh", "check_circle"); if(typeof onAgree === "function") setTimeout(onAgree, 250); });
}
const C = { list:null, social:{ liked:[], saved:[], copied:[], reported:[] }, loading:null, prev:"home", err:"", blocked:[] };

const GOAL_IC = { lose:"local_fire_department", muscle:"fitness_center", strength:"bolt", glute:"self_improvement", endurance:"directions_run", health:"favorite" };
const INT_CLS = { "Rất cao":"hi", "Cao":"hi", "Vừa":"mid", "Thấp":"lo", "Nghỉ":"rest" };

/* ---------------------------------------------------------------------
   1. DỮ LIỆU MẪU — "TapEasy Team" (từ PROGRAM_TEMPLATES + biến thể)
   --------------------------------------------------------------------- */
const TEAM = { authorUid:"tapeasy", authorName:"TapEasy Team", authorRole:"team", authorSpecialty:"Đội ngũ HLV & chuyên gia TapEasy" };
const TPL_GOAL = { "tpl-m-fb":"muscle", "tpl-m-ul":"muscle", "tpl-m-ulppl":"muscle", "tpl-m-ppl6":"muscle", "tpl-m-pb":"strength",
  "tpl-f-fb":"glute", "tpl-f-home":"lose", "tpl-f-glute":"glute", "tpl-f-hybrid":"lose", "tpl-f-lower3":"glute", "tpl-f-pb":"strength",
  "tpl-u-home":"health", "tpl-u-cardio":"lose", "tpl-u-hyrox":"endurance", "tpl-u-hybrid-adv":"endurance" };
const TPL_EQ = { "tpl-f-home":"home", "tpl-u-home":"home", "tpl-u-cardio":"minimal" };
const SEED_T0 = Date.UTC(2026, 8, 20);   // mốc cố định → dữ liệu mẫu ổn định giữa các lần mở app
function seedCounts(i){ const r = (k)=> Math.abs(Math.sin((i+1)*(k+3)*12.9898)*43758.5453) % 1; return { copies: 180 + Math.round(r(1)*1600), likes: 90 + Math.round(r(2)*900), saves: 40 + Math.round(r(3)*500) }; }
function mkDays(spec){
  const days = {};
  DK.forEach(k=>{
    const d = spec[k];
    if(!d || !d.ex || !d.ex.length){ days[k] = { title: (d && d.title) || "Nghỉ ngơi", intensity:"Nghỉ", duration:0, ex:[] }; return; }
    days[k] = { title: d.title, intensity: d.intensity || "Vừa", duration: d.duration || 45, ex: d.ex.map(([id, sets, reps, rest])=> ({ id, sets, reps: String(reps), rest })) };
  });
  return days;
}
function finishSeed(r, i){
  const per = Object.values(r.days).filter(d=> d.ex.length).length;
  const durs = Object.values(r.days).filter(d=> d.ex.length).map(d=> d.duration||0);
  return Object.assign({ reports:0, hidden:false, status:"public", v:1 }, TEAM, seedCounts(i), r, {
    perWeek: per, durationAvg: durs.length ? Math.round(durs.reduce((a,b)=> a+b, 0)/durs.length) : 0,
    createdAt: SEED_T0 + i*3*86400000, updatedAt: SEED_T0 + i*3*86400000 });
}
const R = (id, s, r, rest)=> [id, s, r, rest];
const VARIANTS = [
  { id:"seed-v-ppl3", title:"PPL 3 buổi cho người bận rộn", goal:"muscle", level:"intermediate", gender:"chung", equipment:"gym", weeks:10,
    tags:["PPL","3 buổi","Tăng cơ"],
    desc:"Push · Pull · Legs gói gọn trong 3 buổi ~60 phút. Mỗi nhóm cơ 1 lần/tuần nhưng đủ 10–14 hiệp, ưu tiên bài đa khớp và bài ở tư thế cơ bị kéo giãn. Hợp với người đi làm chỉ tập được thứ 2-4-6.\n\nTăng tiến kép: khi mọi hiệp chạm đỉnh khoảng lần, tăng tạ nhỏ nhất. Dừng cách thất bại 1–2 lần (RIR 1–2).",
    days:{ T2:{ title:"Push — ngực, vai, tay sau", intensity:"Cao", duration:60, ex:[R("benchpress",3,"6-10",150),R("inclinedb",3,"8-12",90),R("dbpress",3,"8-12",90),R("cablelateral",3,"12-15",45),R("ohtriext",3,"10-15",60)] },
      T4:{ title:"Pull — lưng, tay trước", intensity:"Cao", duration:60, ex:[R("latpulldown",3,"8-12",90),R("csrow",3,"8-12",90),R("cablerow",2,"10-12",75),R("facepull",3,"15",45),R("preacher",3,"10-12",60)] },
      T6:{ title:"Legs — đùi, mông, bắp chân", intensity:"Cao", duration:60, ex:[R("squat",3,"6-10",180),R("rdl",3,"8-10",120),R("legpress",2,"10-12",90),R("legcurl",3,"10-15",60),R("calfraise",3,"12-15",45)] },
      T7:{ title:"Đi bộ 8–10k bước", intensity:"Thấp", duration:40, ex:[R("walking",1,"40 phút",0)] } } },
  { id:"seed-v-lunch", title:"Giảm mỡ 30 phút giờ nghỉ trưa", goal:"lose", level:"beginner", gender:"chung", equipment:"minimal", weeks:8,
    tags:["30 phút","Circuit","Giảm mỡ"],
    desc:"4 buổi × 30 phút tập theo vòng (circuit): làm lần lượt các bài, nghỉ ngắn giữa bài, hết vòng nghỉ 90 giây. Đốt năng lượng tốt mà vẫn giữ cơ khi ăn thâm hụt.\n\nChỉ cần 1 cặp tạ đơn hoặc tạ ấm. Giữ nhịp thở đều, kỹ thuật trước tốc độ.",
    days:{ T2:{ title:"Circuit toàn thân A", intensity:"Vừa", duration:30, ex:[R("gobletsquat",3,"12",30),R("dbrow",3,"12 mỗi tay",30),R("dbpress",3,"10",30),R("mountainclimber",3,"30 giây",30),R("plank",3,"30 giây",60)] },
      T3:{ title:"Đi bộ ngắt quãng", intensity:"Vừa", duration:30, ex:[R("intervalwalk",5,"3 phút nhanh + 3 phút chậm",0)] },
      T5:{ title:"Circuit toàn thân B", intensity:"Vừa", duration:30, ex:[R("lunges",3,"10 mỗi chân",30),R("inclinepushup",3,"10",30),R("kbswing",3,"15",30),R("glutebridge",3,"15",30),R("deadbug",3,"10 mỗi bên",60)] },
      T6:{ title:"Zone 2", intensity:"Thấp", duration:30, ex:[R("zone2",1,"30 phút",0)] } } },
  { id:"seed-v-dbhome", title:"Tạ đơn tại nhà — Upper / Lower 4 buổi", goal:"muscle", level:"intermediate", gender:"chung", equipment:"home", weeks:10,
    tags:["Tại nhà","Tạ đơn","Upper/Lower"],
    desc:"Tăng cơ thật sự chỉ với tạ đơn chỉnh được (2–24 kg) và 1 ghế. Tạ nhẹ thì bù bằng tempo chậm 3 giây khi hạ và số lần cao hơn (12–20), vẫn dừng cách thất bại 1–2 lần.\n\nThân trên 2 buổi, thân dưới 2 buổi; mỗi nhóm cơ ~10–14 hiệp/tuần.",
    days:{ T2:{ title:"Upper A", intensity:"Vừa", duration:50, ex:[R("dbbench",4,"8-12",90),R("dbrow",4,"10-12 mỗi tay",75),R("dbpress",3,"10-12",75),R("lateralraise",3,"15-20",45),R("hammercurl",2,"12-15",45)] },
      T3:{ title:"Lower A", intensity:"Vừa", duration:45, ex:[R("gobletsquat",4,"10-15",90),R("rdl",3,"10-12",90),R("stepup",3,"10 mỗi chân",75),R("calfraise",3,"15-20",45)] },
      T5:{ title:"Upper B", intensity:"Vừa", duration:50, ex:[R("inclinepushup",3,"tối đa −2",60),R("pullover",3,"12-15",60),R("dbpress",3,"8-12",75),R("dbrow",3,"12 mỗi tay",60),R("skullcrusher",2,"12-15",45)] },
      T6:{ title:"Lower B", intensity:"Vừa", duration:45, ex:[R("bulgarian",3,"8-12",90),R("glutebridge",3,"15-20",60),R("lunges",3,"10 mỗi chân",60),R("sideplank",2,"30 giây mỗi bên",30)] } } },
  { id:"seed-v-5x5", title:"Sức mạnh 5×5 cho người mới — 3 buổi", goal:"strength", level:"beginner", gender:"chung", equipment:"gym", weeks:12,
    tags:["5x5","Tạ đòn","Sức mạnh"],
    desc:"Chương trình kinh điển để học 4 bài tạ đòn nền tảng. Luân phiên buổi A/B, mỗi buổi thành công +2,5 kg (deadlift +5 kg). Hụt 2 buổi liền → giảm 10% rồi tăng lại (app tự gợi ý).\n\nKhởi động 2–3 hiệp tăng dần trước hiệp chính. Ưu tiên kỹ thuật, quay video hiệp cuối gửi PT xem form.",
    days:{ T2:{ title:"Buổi A — Squat · Bench · Row", intensity:"Cao", duration:60, ex:[R("squat",5,"5",180),R("benchpress",5,"5",180),R("bentoverrow",5,"5",120)] },
      T4:{ title:"Buổi B — Squat · Press · Deadlift", intensity:"Cao", duration:60, ex:[R("squat",5,"5",180),R("overheadpress",5,"5",150),R("deadlift",1,"5",240)] },
      T6:{ title:"Buổi A — Squat · Bench · Row", intensity:"Cao", duration:60, ex:[R("squat",5,"5",180),R("benchpress",5,"5",180),R("bentoverrow",5,"5",120),R("plank",3,"45 giây",45)] } } },
  { id:"seed-v-5k", title:"Chạy 5 km đầu tiên + sức mạnh nền", goal:"endurance", level:"beginner", gender:"chung", equipment:"minimal", weeks:8,
    tags:["Chạy bộ","5 km","Hybrid"],
    desc:"Từ đi bộ – chạy xen kẽ tới chạy liền 5 km sau 8 tuần. 3 buổi chạy (1 nhẹ dài, 1 ngắt quãng, 1 thoải mái) + 1 buổi sức mạnh giúp gối và hông khoẻ, giảm chấn thương.\n\nQuy tắc: chạy nhẹ phải nói chuyện được; tổng quãng chạy tăng không quá 10%/tuần.",
    days:{ T2:{ title:"Chạy ngắt quãng", intensity:"Vừa", duration:30, ex:[R("running",6,"1 phút chạy + 2 phút đi bộ",0),R("stretch",1,"5 phút",0)] },
      T4:{ title:"Sức mạnh cho người chạy", intensity:"Vừa", duration:40, ex:[R("gobletsquat",3,"10-12",75),R("stepup",3,"10 mỗi chân",60),R("rdl",3,"10",75),R("calfraise",3,"15",45),R("sideplank",2,"30 giây mỗi bên",30)] },
      T6:{ title:"Chạy thoải mái", intensity:"Thấp", duration:30, ex:[R("zone2",1,"20-30 phút chạy chậm",0)] },
      CN:{ title:"Chạy dài nhẹ", intensity:"Thấp", duration:45, ex:[R("running",1,"30-45 phút, chạy – đi bộ xen kẽ",0),R("stretch",1,"10 phút",0)] } } },
  { id:"seed-v-office", title:"Dân văn phòng: lưng khoẻ, vai gáy nhẹ", goal:"health", level:"beginner", gender:"chung", equipment:"home", weeks:6,
    tags:["Văn phòng","Tư thế","Lưng"],
    desc:"Ngồi 8 tiếng làm lưng dưới mỏi, vai gáy cứng? 3 buổi ngắn tập cơ lõi, mông và lưng trên — nhóm cơ giữ tư thế — kèm giãn cơ.\n\nĐứng dậy đi lại 2–3 phút mỗi giờ làm việc. Có đau lan xuống chân hoặc tê bì → đi khám trước khi tập.",
    days:{ T2:{ title:"Lõi & tư thế", intensity:"Thấp", duration:25, ex:[R("deadbug",3,"10 mỗi bên",30),R("glutebridge",3,"15",45),R("invertedrow",3,"8-12",60),R("sideplank",2,"20-30 giây mỗi bên",30),R("stretch",1,"8 phút",0)] },
      T4:{ title:"Đi bộ nhanh + giãn cơ", intensity:"Thấp", duration:35, ex:[R("walking",1,"25 phút",0),R("stretch",1,"10 phút",0)] },
      T6:{ title:"Toàn thân nhẹ", intensity:"Vừa", duration:30, ex:[R("bwsquat",3,"15",45),R("inclinepushup",3,"8-12",60),R("dbrow",3,"12 mỗi tay",45),R("plank",3,"30 giây",30),R("stretch",1,"8 phút",0)] } } },
];
function buildSeeds(){
  const out = [];
  try{
    (typeof PROGRAM_TEMPLATES !== "undefined" ? PROGRAM_TEMPLATES : []).forEach((t, i)=>{
      const days = {};
      DK.forEach(k=>{ const d = t.days[k]; days[k] = d && d.ex && d.ex.length ? { title:d.title, intensity:d.intensity, duration:d.duration, ex: d.ex.map(([id, sets, reps, rest])=> ({ id, sets, reps:String(reps), rest })) } : { title:"Nghỉ ngơi", intensity:"Nghỉ", duration:0, ex:[] }; });
      out.push(finishSeed({ id: "seed-" + t.id, title: t.name, desc: `${t.desc}\n\n${t.origin}.`, goal: TPL_GOAL[t.id] || "muscle", level: t.level, gender: t.gender,
        equipment: TPL_EQ[t.id] || "gym", weeks: t.weeks, tags: [t.goal].concat(t.perWeek ? [`${t.perWeek} buổi/tuần`] : []), days, source:{ kind:"template", id:t.id } }, i));
    });
  }catch(e){ warn("seed tpl", e); }
  VARIANTS.forEach((v, j)=>{
    try{ const ok = Object.values(v.days).every(d=> d.ex.every(e=> typeof EXERCISES === "undefined" || EXERCISES[e[0]]));
      if(ok) out.push(finishSeed(Object.assign({}, v, { days: mkDays(v.days), source:{ kind:"team" } }), out.length + j)); }catch(e){ warn("seed", v.id, e); }
  });
  return out;
}

/* ---------------------------------------------------------------------
   2. DỮ LIỆU
   --------------------------------------------------------------------- */
async function load(force){
  if(C.loading) return C.loading;
  if(C.list && !force) return C.list;
  C.loading = (async ()=>{
    try{
      const [list, soc] = await Promise.all([S.listRoutines(), S.mySocial().catch(()=> C.social), loadBlocks()]);
      C.list = list; C.social = soc || C.social; C.err = "";
    }catch(e){ C.err = e.message; C.list = C.list || S.seeds.slice(); }
    C.loading = null;
    return C.list;
  })();
  return C.loading;
}
const meUid = ()=> (cloud.user && cloud.user.uid) || null;
/* ---- Chặn người dùng (App Store Guideline 1.2) — API thật ở cloud.js: blockUser(uid,{name,reason}) · unblockUser · listBlocked · isBlockedSync.
   Giáo án chia sẻ của người đã chặn bị ẩn khỏi bảng tin, tìm kiếm, thẻ Trang chủ, hồ sơ tác giả. ---- */
async function loadBlocks(){
  try{ if(!cloud.user || typeof cloud.listBlocked !== "function"){ C.blocked = []; return C.blocked; }
    C.blocked = await cloud.listBlocked(); }catch(e){ C.blocked = C.blocked || []; }
  return C.blocked;
}
const isBlockedAuthor = uid=>{ try{ return !!(uid && uid !== meUid() && typeof cloud.isBlockedSync === "function" && cloud.isBlockedSync(String(uid))); }catch(e){ return false; } };
const canBlockAuthor = r=> !!(r && r.authorUid && r.authorUid !== "tapeasy" && r.authorRole !== "team" && r.authorUid !== meUid() && typeof cloud.blockUser === "function");
function blockAuthor(uid, name){
  uid = String(uid || ""); if(!uid || uid === "tapeasy" || uid === meUid()) return;
  if(!cloud.user){ toast("Đăng nhập để chặn người dùng", "info"); if(typeof showAuth === "function") setTimeout(()=> showAuth("login"), 400); return; }
  const nm = String(S.moderation.cleanText(name || "") || "").replace(/[\u0000-\u001f<>`]/g, "").trim().slice(0, 40) || "người này";
  confirmDialog(`Chặn ${esc(nm)}?`, "Bạn sẽ không còn thấy giáo án chia sẻ, Khoảnh khắc và bình luận của người này; họ cũng không nhắn tin hay bình luận được cho bạn. Bỏ chặn bất cứ lúc nào ở Cộng đồng hoặc màn PT → Người đã chặn.", async ()=>{
    try{
      await cloud.blockUser(uid, { name: nm, reason: "community" });
      await loadBlocks();
      try{ closeSheet(); }catch(e){}
      toast(`Đã chặn ${esc(nm)}`, "block"); render();
    }catch(e){ toast(esc(e && e.message || "Không chặn được người này"), "error"); }
  }, "Chặn", "block");
}
async function openBlocked(){
  const draw = list=>{
    openSheet(`<div class="sheet-header"><h3>Người đã chặn</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
      <p class="small-note">Bạn không thấy giáo án chia sẻ, Khoảnh khắc, bình luận của những người này và họ không liên hệ được với bạn. Bỏ chặn để hiện lại.</p>
      <div class="cm-blocked">${list.length ? list.map(b=> `<div class="cm-blocked-row"><span class="cm-av ini" aria-hidden="true">${esc(initials(b.name || "?"))}</span><div><b>${esc(b.name || "Thành viên")}</b><small>Chặn ${esc(b.at ? new Date(Number(b.at)).toLocaleDateString("vi-VN") : "")}</small></div><button type="button" class="btn btn-outline btn-sm" data-cm-unblock="${esc(b.uid)}" aria-label="Bỏ chặn ${esc(b.name || "")}">Bỏ chặn</button></div>`).join("")
        : (typeof fkEmpty === "function" ? fkEmpty("block", "Chưa chặn ai", "Chặn từ nút “Chặn người này” trong chi tiết giáo án chia sẻ, Khoảnh khắc hoặc bình luận.", null, { small:true }) : `<p class="empty-hint">Chưa chặn ai.</p>`)}</div>`);
    qa("[data-cm-unblock]").forEach(b=> b.addEventListener("click", async ()=>{
      b.disabled = true;
      try{ await cloud.unblockUser(b.dataset.cmUnblock); const l = await loadBlocks(); toast("Đã bỏ chặn", "check_circle"); draw(l); render(); }
      catch(e){ b.disabled = false; toast(esc(e && e.message || "Không bỏ chặn được"), "error"); }
    }));
  };
  draw(await loadBlocks());
}
const has = (k, id)=> (C.social[k] || []).includes(id);
function findR(id){ return (C.list || []).find(r=> r.id === id) || null; }
function patchR(id, partial){ const r = findR(id); if(r) Object.assign(r, partial); return r; }

/* ---------------------------------------------------------------------
   3. THẺ ROUTINE
   --------------------------------------------------------------------- */
function coverHTML(r, big){
  const gi = GOAL_IC[r.goal] || "fitness_center";
  return `<div class="cm-cover g-${esc(r.goal)} ${big ? "big" : ""}">
    <svg class="cm-pat" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 92 C40 70 70 108 110 84 S170 58 200 72 V120 H0Z"/><path d="M0 104 C50 88 90 118 130 98 S180 82 200 90 V120 H0Z"/><circle cx="168" cy="26" r="34"/><circle cx="168" cy="26" r="20"/></svg>
    <span class="cm-gic">${ic(gi)}</span>
    <div class="cm-cover-top"><span class="cm-chip lv-${esc(r.level)}">${esc(L.LEVELS[r.level] || "")}</span><span class="cm-chip">${esc(L.GENDERS[r.gender] || "")}</span></div>
    <div class="cm-cover-bot"><b>${esc(r.perWeek || 0)}</b> buổi/tuần · ${esc(r.weeks || "?")} tuần${r.durationAvg ? ` · ~${esc(r.durationAvg)}′` : ""}</div>
  </div>`;
}
function authorHTML(r, small){
  const team = r.authorRole === "team", pt = r.authorRole === "pt";
  return `<span class="cm-author ${small ? "sm" : ""}">${team ? brandMark("xs") : (isImg(r.authorPhoto) ? `<img class="cm-av" src="${esc(r.authorPhoto)}" alt="">` : `<span class="cm-av ini">${esc(initials(r.authorName))}</span>`)}
    <span class="nm">${esc(r.authorName || "Thành viên")}</span>${team ? ic("verified", "cm-ver") : pt ? `<i class="cm-pt">PT</i>` : ""}</span>`;
}
function cardHTML(r){
  const liked = has("liked", r.id), saved = has("saved", r.id), hidden = L.isHidden(r);
  return `<article class="cm-card ${hidden ? "is-hidden" : ""}" data-cm-open="${esc(r.id)}" role="button" tabindex="0" aria-label="${esc(r.title)}">
    ${coverHTML(r)}
    <button type="button" class="cm-save ${saved ? "on" : ""}" data-cm-save="${esc(r.id)}" aria-pressed="${saved}" aria-label="${saved ? "Bỏ lưu" : "Lưu"} giáo án chia sẻ">${ic("bookmark")}</button>
    <div class="cm-body">
      <span class="cm-goal g-${esc(r.goal)}">${esc(L.GOALS[r.goal] || "")}</span>${isPinned(r) ? `<span class="cm-pin">${ic("push_pin")}Ghim</span>` : ""}
      <h3>${esc(S.moderation.cleanText(r.title))}</h3>
      ${authorHTML(r, true)}
      <div class="cm-stats">
        <span title="Lượt sao chép">${ic("content_copy")}${kN(r.copies)}</span>
        <button type="button" class="cm-like ${liked ? "on" : ""}" data-cm-like="${esc(r.id)}" aria-pressed="${liked}" aria-label="${liked ? "Bỏ thích" : "Thích"}">${ic("favorite")}<b>${kN(r.likes)}</b></button>
      </div>
      ${hidden ? `<p class="cm-hidden-note">${ic("visibility")}Đang tạm ẩn do bị báo cáo</p>` : ""}
    </div>
  </article>`;
}

/* ---------------------------------------------------------------------
   4. MÀN CỘNG ĐỒNG
   --------------------------------------------------------------------- */
function ensureScreen(){
  if(document.getElementById("screen-community") && q("#community-content")) return;
  const host = q("#app-scroll"); if(!host) return;
  host.insertAdjacentHTML("beforeend", `
  <section id="screen-community" class="screen" aria-label="Cộng đồng TapEasy">
    <div class="topbar">
      <button class="icon-btn" id="cm-back" aria-label="Quay lại">${ic("arrow_back")}</button>
      <div class="logo cm-logo">${brandMark("sm")}<span>Cộng đồng</span></div>
      <button class="icon-btn" id="cm-plus" aria-label="Chia sẻ giáo án của tôi">${ic("add")}</button>
    </div>
    <div class="content" id="community-content"></div>
  </section>`);
  try{ if(typeof SUB_SCREENS !== "undefined" && Array.isArray(SUB_SCREENS) && !SUB_SCREENS.includes("community")) SUB_SCREENS.push("community"); }catch(e){}
  const b = q("#cm-back"); if(b) b.addEventListener("click", ()=> goto(C.prev && C.prev !== "community" ? C.prev : "home"));
  const p = q("#cm-plus"); if(p) p.addEventListener("click", ()=> openShare());
}
const GOAL_CHIPS = [["all","Tất cả"]].concat(Object.entries(L.GOALS));
function filtersNow(){
  const s = st(), f = Object.assign({}, s.f, { viewer: meUid() });
  if(s.tab === "saved") f.ids = C.social.saved || [];
  if(s.tab === "mine"){ f.author = meUid() || "__none__"; f.includeHidden = true; }
  return f;
}
/* QU-06: vẽ ngay khung + 8 thẻ đầu, phần còn lại theo lô sau khung hình đầu (mở màn nhanh, không khựng)
   QC-17: ô tìm kiếm KHÔNG bị vẽ lại khi gõ — chỉ vùng kết quả (#cm-results) thay đổi → bàn phím iOS không đóng, con trỏ giữ nguyên */
const FIRST_BATCH = 8, BATCH = 8;
let _batchTok = 0;
function currentList(){
  const s = st(), pins = pinnedSet();
  return L.sortRoutines(L.filterRoutines(C.list || [], filtersNow()), s.sort).filter(r=> !isBlockedAuthor(r.authorUid))   // App Store 1.2
    .map((r, i)=> [r, i]).sort((a, b)=> (isPinned(b[0], pins) ? 1 : 0) - (isPinned(a[0], pins) ? 1 : 0) || a[1] - b[1]).map(x=> x[0]);   // routine được ghim (quản trị) lên đầu
}
function resultsHTML(list){
  const s = st();
  return `<div class="cm-resbar"><span class="small-note">${list.length} giáo án chia sẻ${C.err ? ` · <span class="warn">${esc(C.err)}</span>` : ""}</span>
      <label class="cm-sort">${ic("sort")}<select id="cm-sort" aria-label="Sắp xếp">${[["trend","Thịnh hành"],["new","Mới nhất"],["copies","Sao chép nhiều"],["likes","Yêu thích nhất"]].map(([v, t])=> `<option value="${v}" ${s.sort === v ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
    ${s.tab === "mine" ? `<button type="button" class="cm-share-cta" id="cm-share">${brandMark("md")}<div><b>Chia sẻ giáo án của tôi</b><small>Chọn giáo án trong "Giáo án của tôi" → viết vài dòng → đăng. Mọi người sao chép được bằng 1 chạm.</small></div>${ic("chevron_right")}</button>` : ""}
    <div class="cm-grid" id="cm-grid" aria-busy="${list.length > FIRST_BATCH}">${list.slice(0, FIRST_BATCH).map(cardHTML).join("") || emptyHTML(s.tab)}</div>`;
}
function fillRest(list){
  const tok = ++_batchTok; let i = FIRST_BATCH;
  if(list.length <= i) return;
  const step = ()=>{
    if(tok !== _batchTok) return;
    const g = q("#cm-grid"); if(!g) return;
    const html = list.slice(i, i + BATCH).map(cardHTML).join(""); i += BATCH;
    if(typeof g.insertAdjacentHTML === "function") g.insertAdjacentHTML("beforeend", html); else g.innerHTML += html;
    if(i < list.length) setTimeout(step, 16); else { try{ g.setAttribute("aria-busy", "false"); }catch(e){} }
  };
  setTimeout(step, 16);
}
function render(){
  const el = q("#community-content"); if(!el) return;
  const s = st();
  if(!C.list){
    el.innerHTML = `<div class="cm-hero">${heroInner([])}</div>${typeof fkSkeleton === "function" ? fkSkeleton(3, "card") : `<p class="empty-hint">Đang tải…</p>`}`;
    load().then(render);
    return;
  }
  const list = currentList();
  const sel = (id, label, opts, val)=> `<label class="cm-sel"><span>${label}</span><select data-cm-f="${id}" aria-label="${label}">${opts.map(([v, t])=> `<option value="${v}" ${val === v ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  const myCount = (C.list || []).filter(r=> r.authorUid && r.authorUid === meUid()).length;
  el.innerHTML = `
    <div class="cm-hero">${heroInner(C.list)}</div>
    <div class="seg cm-seg" role="tablist">
      <button type="button" role="tab" class="${s.tab === "explore" ? "active" : ""}" data-cm-tab="explore">${ic("public")}Khám phá</button>
      <button type="button" role="tab" class="${s.tab === "saved" ? "active" : ""}" data-cm-tab="saved">${ic("bookmark")}Đã lưu${(C.social.saved||[]).length ? ` <i class="cnt">${C.social.saved.length}</i>` : ""}</button>
      <button type="button" role="tab" class="${s.tab === "mine" ? "active" : ""}" data-cm-tab="mine">${ic("person")}Của tôi${myCount ? ` <i class="cnt">${myCount}</i>` : ""}</button>
    </div>
    <div class="cm-search">${ic("search")}<input id="cm-q" type="search" placeholder="Tìm giáo án chia sẻ, bài tập, tác giả…" value="${esc(s.f.q)}" autocomplete="off" enterkeyhint="search" aria-label="Tìm giáo án chia sẻ" aria-controls="cm-results"></div>
    <div class="cm-goals" role="group" aria-label="Lọc theo mục tiêu">${GOAL_CHIPS.map(([v, t])=> `<button type="button" class="pill ${s.f.goal === v ? "active" : ""}" data-cm-goal="${esc(v)}" aria-pressed="${s.f.goal === v ? "true" : "false"}">${v !== "all" ? ic(GOAL_IC[v]) : ""}${esc(t)}</button>`).join("")}</div>
    <div class="cm-filters">
      ${sel("level", "Cấp độ", [["all","Mọi cấp độ"]].concat(Object.entries(L.LEVELS)), s.f.level)}
      ${sel("gender", "Dành cho", [["all","Nam & Nữ"],["nam","Nam"],["nu","Nữ"]], s.f.gender)}
      ${sel("perWeek", "Số buổi", [["all","Mọi lịch"],["2-3","2–3 buổi"],["4","4 buổi"],["5+","5+ buổi"]], s.f.perWeek)}
      ${sel("equipment", "Dụng cụ", [["all","Tất cả"]].concat(Object.entries(L.EQUIP)), s.f.equipment)}
    </div>
    <div id="cm-results" class="cm-results" aria-live="polite">${resultsHTML(list)}</div>
    <p class="small-note cm-rules">${ic("shield")}Tiêu chuẩn cộng đồng: không quảng cáo, không nội dung thô tục hay nguy hiểm. Giáo án chia sẻ bị báo cáo từ ${esc(S.REPORT_HIDE)} lần sẽ tạm ẩn chờ kiểm duyệt; báo cáo được xem xét trong 24 giờ.</p>
    <button type="button" class="cm-blocked-link" id="cm-terms">${ic("shield")}Xem tiêu chuẩn cộng đồng</button>
    ${cloud.user && typeof cloud.listBlocked === "function" ? `<button type="button" class="cm-blocked-link" id="cm-blocked">${ic("block")}Người đã chặn${(C.blocked || []).length ? ` (${(C.blocked || []).length})` : ""}</button>` : ""}`;
  bind(el);
  const bl = q("#cm-blocked", el); if(bl) bl.addEventListener("click", ()=> openBlocked());
  const tm = q("#cm-terms", el); if(tm) tm.addEventListener("click", ()=> openTerms());
  bindResults(q("#cm-results", el) || el);
  fillRest(list);
}
/** Chỉ vẽ lại vùng kết quả (tìm kiếm, sắp xếp, thích/lưu) — giữ nguyên ô tìm kiếm & vị trí cuộn */
function renderList(){
  const box = q("#cm-results"); if(!box || !C.list){ render(); return; }
  const list = currentList();
  box.innerHTML = resultsHTML(list);
  bindResults(box);
  fillRest(list);
}
function bind(el){
  qa("[data-cm-tab]", el).forEach(b=> b.addEventListener("click", ()=>{ st().tab = b.dataset.cmTab; save(); render(); }));
  qa("[data-cm-goal]", el).forEach(b=> b.addEventListener("click", ()=>{ st().f.goal = b.dataset.cmGoal; save();
    qa("[data-cm-goal]", el).forEach(x=>{ const on = x.dataset.cmGoal === st().f.goal; x.classList.toggle("active", on); x.setAttribute("aria-pressed", String(on)); }); renderList(); }));
  qa("[data-cm-f]", el).forEach(sel=> sel.addEventListener("change", ()=>{ st().f[sel.dataset.cmF] = sel.value; save(); renderList(); }));
  const inp = q("#cm-q", el); let t = null;
  if(inp) inp.addEventListener("input", ()=>{ clearTimeout(t); t = setTimeout(()=>{ st().f.q = inp.value; save(); renderList(); }, 220); });
}
function bindResults(box){
  const so = q("#cm-sort", box); if(so) so.addEventListener("change", ()=>{ st().sort = so.value; save(); renderList(); });
  const sh = q("#cm-share", box); if(sh) sh.addEventListener("click", ()=> openShare());
  const grid = q("#cm-grid", box); if(!grid) return;
  /* uỷ quyền sự kiện: thẻ vẽ theo lô vẫn bấm được, không gắn hàng trăm listener */
  grid.addEventListener("click", e=>{
    const t = e.target; if(!t || !t.closest) return;
    const lk = t.closest("[data-cm-like]"); if(lk){ e.stopPropagation(); toggle("like", lk.dataset.cmLike); return; }
    const sv = t.closest("[data-cm-save]"); if(sv){ e.stopPropagation(); toggle("save", sv.dataset.cmSave); return; }
    const card = t.closest("[data-cm-open]"); if(card) openDetail(card.dataset.cmOpen);
  });
  grid.addEventListener("keydown", e=>{ if(e.key !== "Enter" && e.key !== " ") return; const card = e.target && e.target.closest && e.target.closest("[data-cm-open]"); if(card && e.target === card){ e.preventDefault(); openDetail(card.dataset.cmOpen); } });
}
function heroInner(list){
  const copies = (list||[]).reduce((a, r)=> a + (Number(r.copies)||0), 0);
  const authors = new Set((list||[]).map(r=> r.authorUid)).size;
  return `<div class="cm-hero-glow"></div>
    <div class="cm-eyebrow">${brandMark("xs")}Cộng đồng TapEasy</div>
    <h2>Giáo án thật,<br><span>từ người tập thật</span></h2>
    <p>Sao chép giáo án của PT và cộng đồng — một chạm là vào tuần tập của bạn, kèm video hướng dẫn.</p>
    <div class="cm-hero-stats"><div><b>${(list||[]).length || "—"}</b><small>giáo án chia sẻ</small></div><div><b>${copies ? kN(copies) : "—"}</b><small>lượt sao chép</small></div><div><b>${authors || "—"}</b><small>tác giả</small></div></div>`;
}
function emptyHTML(tab){
  const e = tab === "saved" ? ["bookmark", "Chưa lưu giáo án chia sẻ nào", "Bấm biểu tượng lưu trên thẻ giáo án để xem lại nhanh ở đây."]
    : tab === "mine" ? ["ios_share", "Bạn chưa chia sẻ giáo án nào", "Chia sẻ giáo án bạn đang tập — giúp người khác và nhận lượt sao chép."]
    : ["search", "Không có giáo án chia sẻ phù hợp", "Thử bỏ bớt bộ lọc hoặc tìm bằng từ khoá khác."];
  return `<div class="cm-empty">${typeof fkEmpty === "function" ? fkEmpty(e[0], e[1], e[2]) : `<p class="empty-hint">${e[1]}</p>`}</div>`;
}
async function toggle(kind, id){
  const k = kind === "like" ? "liked" : "saved", f = kind === "like" ? "likes" : "saves";
  const was = has(k, id), r = findR(id);
  C.social[k] = was ? C.social[k].filter(x=> x !== id) : (C.social[k] || []).concat(id);
  if(r) r[f] = Math.max(0, (Number(r[f])||0) + (was ? -1 : 1));
  refreshViews(id);
  try{
    const res = kind === "like" ? await S.toggleLike(id, !was) : await S.toggleSave(id, !was);
    if(r && res && typeof res.count === "number") r[f] = res.count;
    if(kind === "save") toast(was ? "Đã bỏ lưu" : "Đã lưu vào mục Đã lưu", "bookmark");
  }catch(e){
    C.social[k] = was ? (C.social[k] || []).concat(id) : C.social[k].filter(x=> x !== id);
    if(r) r[f] = Math.max(0, (Number(r[f])||0) + (was ? 1 : -1));
    toast(esc(e.message), "error");
    if(e.code === "social/auth" && typeof showAuth === "function") setTimeout(()=> showAuth("login"), 600);
  }
  refreshViews(id);
}
function refreshViews(id){
  const a = q(".screen.active");
  if(a && a.id === "screen-community") renderList();
  const d = q("#sheet-content .cm-detail");
  if(d && d.dataset.id === id) paintDetailActions(id);
}

/* ---------------------------------------------------------------------
   5. CHI TIẾT ROUTINE
   --------------------------------------------------------------------- */
const MUSCLE_GROUPS = [["Ngực", /ngực/i], ["Lưng", /lưng/i], ["Vai", /vai/i], ["Tay", /tay/i], ["Chân", /chân|đùi/i], ["Mông", /mông/i], ["Bụng", /bụng/i], ["Cardio", /tim mạch|toàn thân|giãn/i]];
function muscleVolume(r){
  const v = {};
  Object.values(r.days || {}).forEach(d=> (d.ex || []).forEach(e=>{
    const m = (exMeta(e) || {}).muscle || e.muscle || "";
    const hit = MUSCLE_GROUPS.filter(([, re])=> re.test(m));
    (hit.length ? hit : [["Khác"]]).forEach(([g], i)=> v[g] = (v[g]||0) + (Number(e.sets)||0) * (i ? 0.5 : 1));
  }));
  return Object.entries(v).filter(([g])=> g !== "Khác").sort((a,b)=> b[1] - a[1]);
}
function openDetail(id){
  const r = findR(id);
  if(!r){ toast("Giáo án chia sẻ không còn tồn tại", "error"); return; }
  if(isBlockedAuthor(r.authorUid)){ toast("Bạn đã chặn tác giả này — bỏ chặn ở Cộng đồng → Người đã chặn", "block"); return; }
  const mine = r.authorUid && r.authorUid === meUid();
  const vol = muscleVolume(r);
  const maxV = Math.max(1, ...vol.map(x=> x[1]));
  openSheet(`<div class="cm-detail" data-id="${esc(r.id)}">
    <div class="sheet-header"><h3>Giáo án chia sẻ</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    ${coverHTML(r, true)}
    <h2 class="cm-title">${esc(S.moderation.cleanText(r.title))}</h2>
    <button type="button" class="cm-author-row" data-cm-author="${esc(r.authorUid)}">${authorHTML(r)}<small>${r.authorRole === "team" ? "Đội ngũ chuyên môn TapEasy" : r.authorRole === "pt" ? esc(r.authorSpecialty || "Huấn luyện viên") : "Thành viên cộng đồng"}</small>${ic("chevron_right")}</button>
    <div class="cm-tags">
      <span class="cm-goal g-${esc(r.goal)}">${ic(GOAL_IC[r.goal] || "fitness_center")}${esc(L.GOALS[r.goal] || "")}</span>
      <span>${esc(L.LEVELS[r.level] || "")}</span><span>${esc(L.GENDERS[r.gender] || "")}</span><span>${esc(L.EQUIP[r.equipment] || "")}</span>
      ${(r.tags || []).slice(0, 4).map(t=> `<span>#${esc(S.moderation.cleanText(t))}</span>`).join("")}
    </div>
    <div class="cm-kpis"><div><b>${esc(r.perWeek)}</b><small>buổi/tuần</small></div><div><b>${esc(r.weeks)}</b><small>tuần</small></div><div><b>~${esc(r.durationAvg || 0)}′</b><small>mỗi buổi</small></div><div><b>${kN(r.copies)}</b><small>sao chép</small></div></div>
    <div class="cm-actions" data-cm-actions></div>
    ${r.desc ? `<div class="cm-desc">${esc(S.moderation.cleanText(r.desc)).replace(/\n/g, "<br>")}</div>` : ""}
    ${L.isHidden(r) ? `<p class="cm-hidden-note">${ic("visibility")}Giáo án chia sẻ đang tạm ẩn do bị báo cáo ${esc(r.reports)} lần, chờ kiểm duyệt.</p>` : ""}
    ${vol.length ? `<div class="cm-sub">Khối lượng mỗi tuần (hiệp / nhóm cơ)</div>
      <div class="cm-vol">${vol.map(([g, n])=> `<div><span>${esc(g)}</span><i><b style="width:${Math.round(n/maxV*100)}%"></b></i><em>${Math.round(n*10)/10}</em></div>`).join("")}</div>
      <p class="small-note">Khuyến nghị tăng cơ: ~10–20 hiệp / nhóm cơ / tuần. Nhóm cơ phụ tính ½ hiệp.</p>` : ""}
    <div class="cm-sub">Lịch tuần</div>
    <div class="cm-week">${DK.map(k=>{ const d = (r.days || {})[k] || { ex:[] }; return `
      <div class="cm-day ${d.ex && d.ex.length ? "" : "rest"}">
        <div class="cm-day-h"><b>${esc(DLBL[k] || k)}</b><span>${esc(d.title || "Nghỉ ngơi")}</span>${d.ex && d.ex.length ? `<i class="int-${INT_CLS[d.intensity] || "mid"}">${esc(d.intensity || "")}${d.duration ? ` · ${esc(d.duration)}′` : ""}</i>` : ""}</div>
        ${d.ex && d.ex.length ? `<ol>${d.ex.map((e, i)=> `<li><button type="button" data-cm-ex="${esc(k)}:${i}"><span>${esc(shortName(exName(e)))}</span><b>${esc(e.sets)} × ${esc(e.reps)}</b>${ic("play_circle", "cm-play")}</button></li>`).join("")}</ol>` : ""}
      </div>`; }).join("")}</div>
    <div class="cm-sticky">
      <button type="button" class="btn btn-primary btn-block" id="cm-copy">${ic("content_copy")}Sao chép vào tuần tập của tôi</button>
      ${mine ? `<button type="button" class="btn btn-ghost btn-block" id="cm-del">${ic("delete")}Gỡ giáo án chia sẻ của tôi</button>` : ""}
    </div>
  </div>`);
  paintDetailActions(r.id);
  const sc = q("#sheet-content"); if(sc) sc.scrollTop = 0;
  q("#cm-copy").addEventListener("click", ()=> openCopy(r.id));
  const del = q("#cm-del"); if(del) del.addEventListener("click", ()=> confirmDialog("Gỡ giáo án chia sẻ?", "Giáo án sẽ bị xoá khỏi cộng đồng. Những người đã sao chép vẫn giữ bản của họ.", async ()=>{
    try{ await S.deleteRoutine(r.id); C.list = (C.list || []).filter(x=> x.id !== r.id); toast("Đã gỡ giáo án chia sẻ", "delete"); render(); }catch(e){ toast(esc(e.message), "error"); }
  }, "Gỡ", "delete"));
  qa("[data-cm-author]").forEach(b=> b.addEventListener("click", ()=> openAuthor(r.authorUid, r)));
  qa("[data-cm-ex]").forEach(b=> b.addEventListener("click", ()=>{
    const [k, i] = b.dataset.cmEx.split(":"); const e = r.days[k].ex[Number(i)], m = exMeta(e) || {};
    if(typeof openSessionExerciseDetail !== "function") return;
    openSessionExerciseDetail({ name: exName(e), sets: e.sets, reps: e.reps, restSec: e.rest, img: m.img || "", guide: m.guide || e.guide || "", muscle: m.muscle || e.muscle || "", equipment: m.equipment || "" });
    const h = q("#sheet-content .sheet-header");
    if(h && !q("#cm-ex-back", h)){ h.insertAdjacentHTML("afterbegin", `<button class="icon-btn" id="cm-ex-back" aria-label="Quay lại giáo án chia sẻ">${ic("arrow_back")}</button>`); q("#cm-ex-back").addEventListener("click", ()=> openDetail(r.id)); }
  }));
}
function paintDetailActions(id){
  const box = q("#sheet-content [data-cm-actions]"); const r = findR(id); if(!box || !r) return;
  const liked = has("liked", id), saved = has("saved", id), reported = has("reported", id);
  box.innerHTML = `
    <button type="button" class="cm-act ${liked ? "on like" : ""}" data-act="like" aria-pressed="${liked}">${ic("favorite")}<span>${kN(r.likes)}</span></button>
    <button type="button" class="cm-act ${saved ? "on" : ""}" data-act="save" aria-pressed="${saved}">${ic("bookmark")}<span>${saved ? "Đã lưu" : "Lưu"}</span></button>
    <button type="button" class="cm-act" data-act="share">${ic("share")}<span>Chia sẻ</span></button>
    <button type="button" class="cm-act ${reported ? "on warn" : ""}" data-act="report" ${reported ? "disabled" : ""}>${ic("flag")}<span>${reported ? "Đã báo cáo" : "Báo cáo"}</span></button>
    ${canBlockAuthor(r) ? `<button type="button" class="cm-act cm-block" data-act="block" aria-label="Chặn người này (${esc(r.authorName || "tác giả")})">${ic("block")}<span>Chặn người này</span></button>` : ""}
    ${CA() && can("community.moderate") ? `<button type="button" class="cm-act cm-mod" data-act="mod-hide">${ic(L.isHidden(r) ? "visibility" : "visibility_off")}<span>${L.isHidden(r) ? "Khôi phục" : "Ẩn (kiểm duyệt)"}</span></button>` : ""}
    ${CA() && can("community.feature") ? `<button type="button" class="cm-act cm-mod ${isPinned(r) ? "on" : ""}" data-act="feature" aria-pressed="${isPinned(r)}">${ic("push_pin")}<span>${isPinned(r) ? "Bỏ ghim" : "Ghim"}</span></button>` : ""}`;
  qa("[data-act]", box).forEach(b=> b.addEventListener("click", ()=>{
    const a = b.dataset.act;
    if(a === "mod-hide" || a === "feature"){ modAction(a, id); return; }
    if(a === "like") toggle("like", id);
    if(a === "save") toggle("save", id);
    if(a === "report") openReport(id);
    if(a === "block") blockAuthor(r.authorUid, r.authorName);
    if(a === "share" && typeof shareText === "function") shareText(`${r.title} — TapEasy`, `Giáo án "${r.title}" của ${r.authorName} trên TapEasy: ${r.perWeek} buổi/tuần · ${L.GOALS[r.goal] || ""} · ${L.LEVELS[r.level] || ""}. Mở app TapEasy → Cộng đồng để sao chép vào tuần tập của bạn!`);
  }));
}

/* Kiểm duyệt (community.moderate) / ghim (community.feature) qua cloudAdmin — ghi audit, rules kiểm hasPerm() */
async function modAction(a, id){
  const r = findR(id), A = CA(); if(!r || !A) return;
  try{
    if(a === "mod-hide"){
      const hide = !L.isHidden(r);
      await A.moderate({ type:"routine", id, title: r.title }, hide ? "hide" : "keep", "Từ màn Cộng đồng");
      patchR(id, hide ? { hidden:true } : { hidden:false, approved:true, reports:0 });
      toast(hide ? "Đã ẩn giáo án chia sẻ (kiểm duyệt)" : "Đã khôi phục giáo án chia sẻ", hide ? "visibility" : "check_circle");
    } else {
      const on = !isPinned(r);
      await A.setFeatured(id, on); patchR(id, { featured: on });
      toast(on ? "Đã ghim giáo án lên đầu Cộng đồng" : "Đã bỏ ghim", "push_pin");
    }
    await load(true); paintDetailActions(id); render();
  }catch(e){ toast(e && e.message || "Không thực hiện được", "error"); }
}

/* ---------------------------------------------------------------------
   6. SAO CHÉP → plan mới trong state.plans
   --------------------------------------------------------------------- */
function openCopy(id){
  const r = findR(id); if(!r) return;
  const exists = Object.values(state.plans || {}).find(p=> p.fromRoutine === id);
  openSheet(`
    <div class="sheet-header"><button class="icon-btn" id="cp-back" aria-label="Quay lại">${ic("arrow_back")}</button><h3 style="flex:1;margin-left:8px;">Sao chép giáo án chia sẻ</h3></div>
    <div class="cm-copy-card">${coverHTML(r)}<div><b>${esc(S.moderation.cleanText(r.title))}</b><small>${esc(r.perWeek)} buổi/tuần · ${esc(r.weeks)} tuần · của ${esc(S.moderation.cleanText(r.authorName))}</small></div></div>
    ${exists ? `<p class="small-note warn">${ic("info")} Bạn đã có bản sao "${esc(exists.name)}" trong Giáo án của tôi. Sao chép lần nữa sẽ tạo thêm 1 bản.</p>` : ""}
    <label class="cm-check"><input type="checkbox" id="cp-active" checked> <span><b>Đặt làm giáo án đang tập</b><small>Lịch tuần ở tab Tập luyện chuyển sang giáo án này. Giáo án cũ vẫn giữ trong "Giáo án của tôi".</small></span></label>
    <label class="cm-check"><input type="checkbox" id="cp-video" checked> <span><b>Tự gắn video hướng dẫn</b><small>Cần mạng; bài nào chưa có video vẫn xem được ảnh &amp; hướng dẫn.</small></span></label>
    <button type="button" class="btn btn-primary btn-block" id="cp-go" style="margin-top:14px;">${ic("content_copy")}Sao chép ngay</button>`);
  q("#cp-back").addEventListener("click", ()=> openDetail(id));
  q("#cp-go").addEventListener("click", async ()=>{
    const b = q("#cp-go"); b.disabled = true; b.textContent = "Đang sao chép…";
    try{
      const res = await copyRoutine(id, { setActive: q("#cp-active").checked, videos: q("#cp-video").checked });
      closeSheet();
      toast(`Đã thêm "${S.moderation.cleanText(res.plan && res.plan.name || r.title)}" vào Giáo án của tôi${res.withVid != null ? ` · ${Number(res.withVid)||0}/${Number(res.total)||0} bài có video` : ""}`, "check_circle");
      if(res.active) goto("workout"); else render();
    }catch(e){ toast(esc(e.message), "error"); b.disabled = false; b.innerHTML = `${ic("content_copy")}Sao chép ngay`; }
  });
}
async function copyRoutine(id, opts){
  opts = opts || {};
  const r = findR(id) || await S.getRoutine(id);
  if(!r) throw new Error("Giáo án chia sẻ không còn tồn tại.");
  const plan = sanitizePlan(L.planFromRoutine(r), r);   // QS-03: làm sạch lần nữa (kể cả khi cloud-social bị thay)
  let vid = { total:null, withVid:null };
  if(opts.videos && typeof tplAttachVideos === "function"){ try{ vid = await tplAttachVideos(plan); }catch(e){} }
  state.plans = state.plans || {};
  state.plans[plan.id] = plan;
  if(opts.setActive !== false){ state.activePlanId = plan.id; try{ state.selectedDay = todayDayKey(); }catch(e){} }
  save();
  try{ const res = await S.recordCopy(id); if(res && res.first){ const rr = findR(id); if(rr) rr.copies = (Number(rr.copies)||0) + 1; C.social.copied = (C.social.copied || []).concat(id); } }catch(e){}
  return { plan, active: opts.setActive !== false, total: vid.total, withVid: vid.withVid };
}

/* ---------------------------------------------------------------------
   7. CHIA SẺ ROUTINE CỦA TÔI
   --------------------------------------------------------------------- */
function planStats(p){
  const days = DK.map(k=> p.days && p.days[k]).filter(d=> d && (d.items||[]).length);
  return { days: days.length, ex: days.reduce((a, d)=> a + d.items.length, 0) };
}
function openShare(planId){
  if(!cloud.isLoggedIn()){
    openSheet(`<div class="sheet-header"><h3>Chia sẻ giáo án</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
      <div class="cm-login">${brandMark("lg")}<b>Đăng nhập để chia sẻ</b><p class="small-note">Giáo án được đăng dưới tên tài khoản TapEasy của bạn để mọi người biết tác giả.</p>
      <div class="sc-row2 cm-row2"><button type="button" class="btn btn-outline btn-block" onclick="closeSheet();showAuth('login')">Đăng nhập</button><button type="button" class="btn btn-primary btn-block" onclick="closeSheet();showAuth('signup')">Tạo tài khoản</button></div></div>`);
    return;
  }
  const plans = Object.values(state.plans || {});
  if(!planId){
    openSheet(`<div class="sheet-header"><h3>Chọn giáo án để chia sẻ</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
      <p class="small-note">Chọn 1 giáo án trong "Giáo án của tôi". Video bạn tự quay <b>không</b> được đăng kèm.</p>
      <div class="cm-plans">${plans.map(p=>{ const s2 = planStats(p); return `<button type="button" class="cm-plan ${s2.ex ? "" : "off"}" data-cm-plan="${esc(p.id)}" ${s2.ex ? "" : "disabled"}>
        <span class="cm-plan-ic">${ic(p.id === state.activePlanId ? "play_arrow" : "edit_calendar")}</span>
        <div><b>${esc(p.name)}</b><small>${s2.days} buổi/tuần · ${s2.ex} bài${p.id === state.activePlanId ? " · đang tập" : ""}${p.fromRoutine ? " · bản sao từ cộng đồng" : ""}</small></div>${ic("chevron_right")}</button>`; }).join("") || `<p class="empty-hint">Chưa có giáo án nào.</p>`}</div>`);
    qa("[data-cm-plan]").forEach(b=> b.addEventListener("click", ()=> openShare(b.dataset.cmPlan)));
    return;
  }
  const p = state.plans[planId]; if(!p) return;
  const prof = state.profile || {};
  const g0 = prof.goal === "lose" ? "lose" : prof.goal === "gain" ? "muscle" : "health";
  const tplL = p.fromTemplate && typeof PROGRAM_TEMPLATES !== "undefined" ? PROGRAM_TEMPLATES.find(t=> t.id === p.fromTemplate) : null;
  const lv0 = tplL ? tplL.level : "beginner", gd0 = tplL ? tplL.gender : (prof.gender === "female" ? "nu" : prof.gender === "male" ? "nam" : "chung");
  const opt = (o, v)=> Object.entries(o).map(([k, t])=> `<option value="${k}" ${k === v ? "selected" : ""}>${t}</option>`).join("");
  openSheet(`<div class="cm-share">
    <div class="sheet-header"><button class="icon-btn" id="sh-back" aria-label="Quay lại">${ic("arrow_back")}</button><h3 style="flex:1;margin-left:8px;">Đăng lên cộng đồng</h3></div>
    <div class="field"><label for="sh-title">Tên giáo án</label><input id="sh-title" maxlength="80" value="${esc(p.name)}" placeholder="VD: Upper/Lower 4 buổi cho dân văn phòng"></div>
    <div class="field" style="margin-top:10px;"><label for="sh-desc">Mô tả &amp; mẹo</label><textarea id="sh-desc" rows="4" maxlength="1000" placeholder="Giáo án hợp với ai? Bạn đã tập bao lâu, kết quả thế nào? Lưu ý kỹ thuật, cách tăng tạ…">${esc(tplL ? tplL.desc : "")}</textarea></div>
    <div class="cm-form2">
      <div class="field"><label for="sh-goal">Mục tiêu</label><select id="sh-goal">${opt(L.GOALS, g0)}</select></div>
      <div class="field"><label for="sh-level">Cấp độ</label><select id="sh-level">${opt(L.LEVELS, lv0)}</select></div>
      <div class="field"><label for="sh-gender">Dành cho</label><select id="sh-gender">${opt(L.GENDERS, gd0)}</select></div>
      <div class="field"><label for="sh-eq">Dụng cụ</label><select id="sh-eq">${opt(L.EQUIP, "gym")}</select></div>
      <div class="field"><label for="sh-weeks">Số tuần</label><input id="sh-weeks" type="number" inputmode="numeric" min="1" max="52" value="${esc(tplL ? tplL.weeks : 8)}"></div>
      <div class="field"><label for="sh-tags">Thẻ (cách nhau dấu phẩy)</label><input id="sh-tags" maxlength="120" placeholder="VD: tại nhà, 45 phút"></div>
    </div>
    <div class="cm-sub">Xem trước</div>
    <div class="cm-preview" id="sh-prev"></div>
    ${termsOK() ? "" : `<label class="cm-agree"><input type="checkbox" id="sh-terms"><span>Tôi đồng ý với <b>Tiêu chuẩn cộng đồng TapEasy</b>: không nội dung phản cảm, quấy rối, spam; bài vi phạm bị gỡ trong 24 giờ và tài khoản có thể bị khoá.</span></label>`}
    <p class="auth-err" id="sh-err" role="alert"></p>
    <button type="button" class="btn btn-primary btn-block" id="sh-go">${ic("ios_share")}Đăng giáo án</button>
    <p class="small-note" style="text-align:center;">Bằng việc đăng, bạn đồng ý với tiêu chuẩn cộng đồng TapEasy. Bạn có thể gỡ bất kỳ lúc nào.</p>
  </div>`);
  const meta = ()=> ({ title: q("#sh-title").value, desc: q("#sh-desc").value, goal: q("#sh-goal").value, level: q("#sh-level").value, gender: q("#sh-gender").value,
    equipment: q("#sh-eq").value, weeks: Number(q("#sh-weeks").value)||8, tags: q("#sh-tags").value.split(",").map(x=> x.trim()).filter(Boolean) });
  const pr = cloud.profile || {}, u = cloud.user || {};
  const preview = ()=>{
    const r = Object.assign(L.routineFromPlan(p, meta()), { id:"preview", authorName: (pr.isPT && pr.brandName) || u.name || "Bạn", authorRole: pr.isPT ? "pt" : "member", authorPhoto: pr.photo || null, likes:0, copies:0 });
    const bad = S.moderation.findProfanity([r.title, r.desc, (r.tags||[]).join(" ")].join(" "));
    q("#sh-prev").innerHTML = cardHTML(r).replace(/data-cm-(open|like|save)="[^"]*"/g, "");
    q("#sh-err").textContent = bad.length ? `Có từ ngữ không phù hợp: "${bad.slice(0,3).join('", "')}"` : "";
  };
  preview();
  ["#sh-title","#sh-desc","#sh-tags"].forEach(s=> q(s).addEventListener("input", ()=>{ clearTimeout(C._pv); C._pv = setTimeout(preview, 250); }));
  ["#sh-goal","#sh-level","#sh-gender","#sh-eq","#sh-weeks"].forEach(s=> q(s).addEventListener("change", preview));
  q("#sh-back").addEventListener("click", ()=> openShare());
  q("#sh-go").addEventListener("click", async ()=>{
    const b = q("#sh-go"), tk = q("#sh-terms");
    if(tk && !tk.checked){ q("#sh-err").textContent = "Hãy tick đồng ý với Tiêu chuẩn cộng đồng trước khi đăng."; try{ tk.focus(); }catch(e){} return; }
    if(tk) acceptTerms();
    b.disabled = true; q("#sh-err").textContent = "";
    try{
      const doc = await S.publishRoutine(L.routineFromPlan(p, meta()));
      C.list = [doc].concat((C.list || []).filter(x=> x.id !== doc.id));
      st().tab = "mine"; save();
      closeSheet(); toast("Đã đăng giáo án lên cộng đồng", "ios_share");
      if(!q("#screen-community.active")) goto("community"); else render();
      setTimeout(()=> openDetail(doc.id), 350);
    }catch(e){ q("#sh-err").textContent = e.message; b.disabled = false; }
  });
}

/* ---------------------------------------------------------------------
   8. HỒ SƠ NGƯỜI ĐĂNG + BÁO CÁO
   --------------------------------------------------------------------- */
async function openAuthor(uid, r0){
  const team = uid === "tapeasy";
  const mine = (C.list || []).filter(x=> x.authorUid === uid && (!L.isHidden(x) || uid === meUid()));
  const copies = mine.reduce((a, x)=> a + (Number(x.copies)||0), 0), likes = mine.reduce((a, x)=> a + (Number(x.likes)||0), 0);
  const draw = pr=>{
    const name = team ? "TapEasy Team" : (pr && (pr.brandName || pr.name)) || (r0 && r0.authorName) || "Thành viên";
    const isPT = !team && ((pr && pr.isPT) || (r0 && r0.authorRole === "pt"));
    const photo = !team && pr && isImg(pr.photo) ? pr.photo : null;
    openSheet(`<div class="cm-profile">
      <div class="sheet-header"><button class="icon-btn" id="au-back" aria-label="Quay lại">${ic("arrow_back")}</button><h3 style="flex:1;margin-left:8px;">Hồ sơ</h3></div>
      <div class="cm-prof-hero">
        ${team ? brandMark("xl") : photo ? `<img class="cm-av xl" src="${esc(photo)}" alt="">` : `<span class="cm-av ini xl">${esc(initials(name))}</span>`}
        <h2>${esc(name)} ${team ? ic("verified", "cm-ver") : isPT ? `<i class="cm-pt">PT</i>` : ""}</h2>
        <p>${team ? "Đội ngũ HLV &amp; chuyên gia dinh dưỡng của TapEasy biên soạn giáo án theo nguyên tắc tập luyện dựa trên bằng chứng (RIR, tăng tiến kép, Zone 2…)." : esc([pr && pr.specialty, pr && pr.area, pr && pr.years ? pr.years + " năm kinh nghiệm" : ""].filter(Boolean).join(" · ") || (isPT ? "Huấn luyện viên trên TapEasy PT" : "Thành viên cộng đồng TapEasy"))}</p>
        ${!team && pr && pr.bio ? `<p class="small-note">${esc(S.moderation.cleanText(pr.bio))}</p>` : ""}
      </div>
      <div class="cm-kpis"><div><b>${mine.length}</b><small>giáo án chia sẻ</small></div><div><b>${kN(copies)}</b><small>lượt sao chép</small></div><div><b>${kN(likes)}</b><small>lượt thích</small></div></div>
      ${isPT && typeof openPTProfile === "function" ? `<button type="button" class="btn btn-outline btn-block" id="au-pt">${ic("visibility")}Xem hồ sơ PT đầy đủ</button>` : ""}
      <div class="cm-sub">Giáo án đã chia sẻ</div>
      <div class="cm-mini">${mine.map(x=> `<button type="button" class="cm-mini-row" data-cm-mini="${esc(x.id)}"><span class="cm-mini-ic g-${esc(x.goal)}">${ic(GOAL_IC[x.goal] || "fitness_center")}</span><div><b>${esc(S.moderation.cleanText(x.title))}</b><small>${esc(L.GOALS[x.goal] || "")} · ${esc(x.perWeek)} buổi/tuần · ${kN(x.copies)} sao chép</small></div>${ic("chevron_right")}</button>`).join("") || `<p class="small-note">Chưa có giáo án chia sẻ công khai.</p>`}</div>
      ${!team && canBlockAuthor({ authorUid: uid, authorRole: r0 && r0.authorRole }) ? `<button type="button" class="btn btn-ghost btn-block" id="au-block" style="margin-top:12px;">${ic("block")}Chặn người này</button>` : ""}
    </div>`);
    q("#au-back").addEventListener("click", ()=> r0 ? openDetail(r0.id) : closeSheet());
    const bb = q("#au-block"); if(bb) bb.addEventListener("click", ()=> blockAuthor(uid, name));
    const pb = q("#au-pt"); if(pb) pb.addEventListener("click", ()=>{ closeSheet(); openPTProfile(uid); });
    qa("[data-cm-mini]").forEach(b=> b.addEventListener("click", ()=> openDetail(b.dataset.cmMini)));
  };
  if(team){ draw(null); return; }
  draw(null);
  try{ const pr = await cloud.getUser(uid); if(pr && q("#sheet-content .cm-profile")) draw(pr); }catch(e){}
}
const REASONS = ["Spam / quảng cáo", "Nội dung thô tục, xúc phạm", "Kiến thức sai, có thể gây chấn thương", "Sao chép của người khác không ghi nguồn", "Khác"];
function openReport(id){
  const r = findR(id); if(!r) return;
  openSheet(`<div class="sheet-header"><button class="icon-btn" id="rp-back" aria-label="Quay lại">${ic("arrow_back")}</button><h3 style="flex:1;margin-left:8px;">Báo cáo giáo án chia sẻ</h3></div>
    <p class="small-note">Báo cáo được giữ kín. Giáo án bị báo cáo từ ${esc(S.REPORT_HIDE)} lần sẽ tạm ẩn để đội ngũ TapEasy xem xét.</p>
    <div class="cm-reasons">${REASONS.map((t, i)=> `<label class="cm-check"><input type="radio" name="rp" value="${esc(t)}" ${i === 0 ? "checked" : ""}> <span><b>${esc(t)}</b></span></label>`).join("")}</div>
    <div class="field" style="margin-top:10px;"><label for="rp-note">Chi tiết (không bắt buộc)</label><textarea id="rp-note" rows="2" maxlength="180"></textarea></div>
    <button type="button" class="btn btn-primary btn-block" id="rp-go" style="margin-top:12px;">${ic("flag")}Gửi báo cáo</button>`);
  q("#rp-back").addEventListener("click", ()=> openDetail(id));
  q("#rp-go").addEventListener("click", async ()=>{
    const reason = ((qa('input[name="rp"]').find(x=> x.checked) || {}).value || "Khác") + (q("#rp-note").value.trim() ? ": " + q("#rp-note").value.trim() : "");
    const b = q("#rp-go"); b.disabled = true;
    try{
      const res = await S.reportRoutine(id, reason);
      try{ const A = CA(); if(A && A.report) A.report("routine", id, reason, { title: r.title }).catch(()=>{}); }catch(e){}   // hàng đợi kiểm duyệt chung (Bảng quản trị)
      C.social.reported = (C.social.reported || []).concat(id);
      patchR(id, { reports: res.reports, hidden: res.hidden });
      closeSheet();
      toast(res.already ? "Bạn đã báo cáo giáo án này trước đó" : res.hidden ? "Cảm ơn bạn — giáo án đã được tạm ẩn chờ kiểm duyệt" : "Cảm ơn bạn đã báo cáo, TapEasy sẽ xem xét", "flag");
      render();
    }catch(e){ toast(esc(e.message), "error"); b.disabled = false; }
  });
}

/* ---------------------------------------------------------------------
   9. ĐIỂM VÀO: Trang chủ · menu ☰ · Giáo án mẫu
   --------------------------------------------------------------------- */
function homeCardHTML(){
  const list = L.sortRoutines(L.filterRoutines(C.list || S.seeds, {}), "trend").filter(r=> !isBlockedAuthor(r.authorUid)).slice(0, 3);
  return `<button type="button" class="cm-home" id="cm-home" aria-label="Mở Cộng đồng TapEasy">
    <div class="cm-home-glow"></div>
    <div class="cm-home-top">${brandMark("sm")}<div><b>Cộng đồng TapEasy</b><small>Sao chép giáo án chia sẻ của PT &amp; người tập khác</small></div>${ic("chevron_right")}</div>
    <div class="cm-home-row">${list.map(r=> `<div class="cm-home-mini g-${esc(r.goal)}"><span>${ic(GOAL_IC[r.goal] || "fitness_center")}</span><b>${esc(shortName(r.title).slice(0, 34))}</b><small>${ic("content_copy")}${kN(r.copies)}</small></div>`).join("")}</div>
  </button>`;
}
function injectHome(){
  const el = q("#home-content"); if(!el || q("#cm-home", el)) return;
  const anchor = q(".quick-row", el) || q(".entry-grid", el);
  if(anchor) anchor.insertAdjacentHTML("afterend", homeCardHTML()); else el.insertAdjacentHTML("beforeend", homeCardHTML());
  const b = q("#cm-home", el); if(b) b.addEventListener("click", ()=> goto("community"));
}
function injectTpl(){
  const root = q("#sheet-content"); if(!root || q(".cm-tpl-cta", root)) return;
  const after = q(".pb-tpl-cta", root) || q(".sheet-header", root); if(!after) return;
  after.insertAdjacentHTML("afterend", `<button type="button" class="cm-tpl-cta">${brandMark("sm")}<div><b>Giáo án chia sẻ từ cộng đồng</b><small>Xem giáo án PT &amp; người tập khác chia sẻ, sao chép 1 chạm.</small></div>${ic("chevron_right")}</button>`);
  const b = q(".cm-tpl-cta", root); if(b) b.addEventListener("click", ()=>{ closeSheet(); goto("community"); });
}
function injectMenu(){
  const sc = q("#sheet-content"); if(!sc || q("[data-cm-menu]", sc)) return;
  const coach = q(`[onclick*="goto('coach')"]`, sc); if(!coach) return;
  coach.insertAdjacentHTML("afterend", `<div class="link-row" data-cm-menu role="button" tabindex="0"><div class="left">${ic("public")}<div><div class="name">Cộng đồng</div><div class="sub">Giáo án chia sẻ · sao chép 1 chạm</div></div></div>${ic("chevron_right")}</div>`);
  const row = q("[data-cm-menu]", sc); if(row) row.addEventListener("click", ()=>{ closeSheet(); goto("community"); });
}

/* ---------------------------------------------------------------------
   10. CÀI ĐẶT
   --------------------------------------------------------------------- */
function install(){
  try{ if(typeof FK_LINE === "object" && FK_LINE){ const add = {
    public: "c:12,12,10|M2 12h20|M12 2a15 15 0 0 1 0 20|M12 2a15 15 0 0 0 0 20",
    favorite: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
    bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
    verified: "M12 2.5l2.3 1.7 2.9-.2.9 2.7 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.7-2.9-.2L12 21.5l-2.3-1.7-2.9.2-.9-2.7-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.7 2.9.2z|M8.7 12l2.3 2.3 4.3-4.6",
    ios_share: "M12 3v12|M8 7l4-4 4 4|M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7",
    sort: "M3 6h13|M3 12h9|M3 18h5|M18 8v12|M15 17l3 3 3-3",
    directions_run: "c:13,4,2|M7 21l3-7 3 2v5|M16 10l-3-3-4 1-2 4|M13 13l3 2h3",
    visibility_off: "M3 3l18 18|M10.6 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1|M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6|M9.9 9.9a3 3 0 0 0 4.2 4.2",
    push_pin: "M9 3h6l-1 6 4 4H6l4-4z|M12 13v8",
    block: "c:12,12,9|M5.7 5.7l12.6 12.6",
  }; Object.keys(add).forEach(k=>{ if(!FK_LINE[k]) FK_LINE[k] = add[k]; }); } }catch(e){}
  st();
  try{ S.setSeeds(buildSeeds(), "v1"); }catch(e){ warn("seeds", e); }
  ensureScreen();
  if(typeof goto === "function"){
    const _g = goto;
    goto = function(screen){
      if(screen === "community"){
        ensureScreen();
        const cur = (q(".screen.active") || {}).id || "";
        if(cur && cur !== "screen-community") C.prev = cur.replace("screen-", "");
      }
      const r = _g.apply(this, arguments);
      if(screen === "community"){ try{ render(); load(true).then(()=>{ if(q("#screen-community.active")) render(); }); }catch(e){ warn("render", e); } }
      return r;
    };
  }
  if(typeof renderHomeScreen === "function"){
    const _h = renderHomeScreen;
    renderHomeScreen = function(){ const r = _h.apply(this, arguments); try{ injectHome(); }catch(e){ warn("home", e); } return r; };
  }
  if(typeof openTemplateBrowser === "function"){
    const _t = openTemplateBrowser;
    openTemplateBrowser = function(){ const r = _t.apply(this, arguments); try{ injectTpl(); }catch(e){ warn("tpl", e); } return r; };
  }
  if(typeof fkHandleBack === "function"){
    const _b = fkHandleBack;
    fkHandleBack = function(){
      try{ const sb = q("#sheet-backdrop"); const open = sb && sb.classList.contains("open");
        if(!open && q("#screen-community.active")){ goto(C.prev && C.prev !== "community" ? C.prev : "home"); return true; } }catch(e){}
      return _b.apply(this, arguments);
    };
  }
  try{ document.addEventListener("click", e=>{ const t = e.target; if(t && t.closest && t.closest(".btn-menu-trigger, .btn-menu-trigger-nu")) setTimeout(()=>{ try{ injectMenu(); }catch(err){} }, 0); }, true); }catch(e){}
  try{ cloud.onAuth(()=>{ C.social = { liked:[], saved:[], copied:[], reported:[] }; C.list = null; C.blocked = []; }); }catch(e){}
  load().then(()=>{ const h = q("#screen-home"); if(h && h.classList.contains("active")){ const card = q("#cm-home"); if(card) card.remove(); injectHome(); } }).catch(()=>{});
  try{ const h = q("#screen-home"); if(h && h.classList.contains("active")) injectHome(); }catch(e){}
  return true;
}

Object.assign(TC, { termsOK, acceptTerms, openTerms, TERMS, open: ()=> goto("community"), render, load, openDetail, openShare, openCopy, copyRoutine, openAuthor, openReport, buildSeeds, muscleVolume, cardHTML, homeCardHTML, _C: C, state: st,
  blockAuthor, openBlocked, loadBlocks, isBlockedAuthor, currentList });
try{ TC.installed = install(); }catch(e){ warn("không cài được", e); }
})();

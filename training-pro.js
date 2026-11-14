/* =========================================================================
   TapEasy — TRAINING PRO (training-pro.js + training-pro.css)
   Nạp SAU pt.js. Nâng cấp buổi tập, không sửa file gốc — chỉ ghi đè hàm toàn cục:
     1. Chu kỳ giáo án: "Tuần x/y", tuần giảm tải (deload) tự động, gợi ý khi hết chu kỳ
     2. Superset / circuit: ghép 2–5 bài liên tiếp, tập luân phiên, nghỉ sau mỗi vòng
     3. AMRAP / tối đa: nhãn AMRAP, bắt buộc ghi số lần thật, ước tính 1RM & tạ lần sau
     4. Khối lượng theo nhóm cơ / tuần (hiệp hiệu quả, khuyến nghị 10–20) — màn Tiến độ
     5. Thẻ tổng kết buổi tập 1080×1350 (canvas) — lưu ảnh / chia sẻ
     6. Đồng hồ buổi tập + ghi chú từng buổi + nhật ký buổi tập
   Dữ liệu riêng: state.trainingPro = { cycles, links, amrapItems, amrap, log }
   ========================================================================= */
(function(){
"use strict";
if(typeof window !== "undefined" && window.FKTP && window.FKTP.installed) return;
const TP = (typeof window !== "undefined" ? (window.FKTP = window.FKTP || {}) : {});

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH CHUNG
   --------------------------------------------------------------------- */
const DAY_MS = 86400000;
const cssEsc = (v)=> (typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, "\\$&");
const esc = (s)=> (typeof escapeHtml === "function") ? escapeHtml(String(s==null?"":s)) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = (v)=> Number(v)||0;
const r1 = (x)=> Math.round(x*10)/10;
const p2 = (n)=> String(n).padStart(2,"0");
const dstr = (d)=> (typeof todayStr === "function") ? todayStr(d) : `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const viNum = (n)=> { try{ return Math.round(n).toLocaleString("vi-VN"); }catch(e){ return String(Math.round(n)); } };
const ddmm = (ds)=> ds ? `${ds.slice(8,10)}/${ds.slice(5,7)}` : "";
const curSession = ()=> { try{ return session; }catch(e){ return null; } };   // biến `let session` của app.js
/* Cấp "Mới tập" (QU-22 / GLOSSARY §8.2): ẩn RPE/RIR — dùng chung quy tắc fkSimpleMode() của app.js nếu có */
const simpleMode = ()=> { try{ if(typeof fkSimpleMode === "function") return !!fkSimpleMode(); const p = (state && state.profile) || {}; return p.level === "beginner" && !p.showRpe; }catch(e){ return false; } };
function safe(fn, label){ return function(){ try{ return fn.apply(this, arguments); }catch(e){ try{ console.warn("[training-pro]", label||"", e); }catch(_){} } }; }

/* Icon mới (nét 24×24) */
try{
  if(typeof FK_LINE === "object") Object.assign(FK_LINE, {
    link_off: "M10 13a5 5 0 0 0 7.5.5l1-1|M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7|M15.5 4.5l.8-.8a5 5 0 0 1 7 7|M3 3l18 18",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3",
    edit_note: "M4 6h12|M4 10h12|M4 14h7|M19.5 12.5a1.8 1.8 0 0 1 2.5 2.5L16 21l-3 .8.8-3z",
    event_repeat: "r:3,4,18,18,2.5|M16 2v4|M8 2v4|M3 10h18|M15 15.5a3 3 0 1 1-1-2.2|M15 12.5v2h-2",
    upgrade: "M12 15V5|M7 10l5-5 5 5|M5 20h14",
    timer_play: "c:12,14,8|M12 10v4l2 2|M10 2h4",
    stacks: "M12 3 2 8l10 5 10-5z|M2 13l10 5 10-5|M2 17.5l10 5 10-5",
    history: "M3 12a9 9 0 1 0 2.6-6.4L3 8|M3 3v5h5|M12 7v5l3 2",
    image: "r:3,3,18,18,2|c:9,9,2|M21 15l-5-5L5 21",
    trophy: "M8 21h8|M12 17v4|M7 4h10v5a5 5 0 0 1-10 0z|M17 5h3a3 3 0 0 1-3 4|M7 5H4a3 3 0 0 0 3 4",
  });
}catch(e){}

/* ---------------------------------------------------------------------
   1. KHO DỮ LIỆU RIÊNG
   --------------------------------------------------------------------- */
function store(){
  if(!state.trainingPro || typeof state.trainingPro !== "object") state.trainingPro = {};
  const s = state.trainingPro;
  if(!s.cycles || typeof s.cycles !== "object") s.cycles = {};       // planId → chu kỳ
  if(!s.links || typeof s.links !== "object") s.links = {};          // planId → dayKey → ["uidA>uidB"]
  if(!s.amrapItems || typeof s.amrapItems !== "object") s.amrapItems = {}; // uid → true (hiệp cuối AMRAP)
  if(!s.amrap || typeof s.amrap !== "object") s.amrap = {};          // exKey → [{date,kg,reps,e1rm}]
  if(!Array.isArray(s.log)) s.log = [];                              // nhật ký buổi tập
  return s;
}
const save = ()=>{ try{ saveState(); }catch(e){} };

/* ---------------------------------------------------------------------
   2. CHU KỲ GIÁO ÁN & TUẦN GIẢM TẢI
   --------------------------------------------------------------------- */
function parseD(ds){ const a = String(ds||"").split("-").map(Number); return new Date(a[0]||1970, (a[1]||1)-1, a[2]||1); }
function mondayStr(d){ d = d || new Date(); const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return dstr(x); }
function weeksBetween(aMon, bMon){ return Math.round((parseD(bMon) - parseD(aMon)) / (7*DAY_MS)); }
function addDaysStr(ds, n){ const x = parseD(ds); x.setDate(x.getDate()+n); return dstr(x); }
function daysSince(ds, now){ if(!ds) return 0; return Math.round((parseD(dstr(now || new Date())) - parseD(ds)) / DAY_MS); }
/* Ngày bắt buộc của giáo án (QT-22: bỏ ngày đi bộ/Zone 2 "tuỳ chọn") — dùng planRequiredDays của templates.js nếu có */
function requiredDays(plan){
  try{ if(typeof planRequiredDays === "function") return planRequiredDays(plan); }catch(e){}
  return DAY_KEYS.filter(k=> (((plan||{}).days||{})[k]||{}).items && plan.days[k].items.length && !plan.days[k].optional);
}
/* Giảm tạ theo tỉ lệ nhưng LUÔN nhẹ hơn tạ cũ (QT-02): roundTo(5×0,9, 2,5) = 5 → dùng nấc nhỏ 0,5–1 kg; null nếu không giảm được */
function lighterKg(base, factor, step){
  base = num(base); step = num(step) || 2.5; if(!(base > 0)) return null;
  let v = Math.round(base*factor/step)*step;
  if(v >= base){ const fine = base <= 10 ? 0.5 : 1; v = Math.floor(base*factor/fine)*fine; }
  v = Math.round(v*100)/100;
  return v > 0 && v < base ? v : null;
}
/* Áp dụng từ T2–T5 → tính tuần này là tuần 1; T6–CN → tuần 1 bắt đầu T2 tuần sau (mấy ngày còn lại là "làm quen") */
function defaultStart(now){ now = now || new Date(); const wd = (now.getDay()+6)%7; const m = mondayStr(now); return wd >= 4 ? addDaysStr(m, 7) : m; }
/* Chu kỳ giảm tải theo giáo án mẫu: trường deloadEvery, hoặc đọc mô tả ("tuần 4 giảm tải", "deload mỗi 5 tuần"); mặc định 5 */
function deloadEveryFor(t){
  if(t && t.deloadEvery !== undefined && t.deloadEvery !== null && !isNaN(Number(t.deloadEvery))) return Math.max(0, Number(t.deloadEvery));
  const txt = ((t && t.desc) || "") + " " + ((t && t.origin) || "");
  let m = txt.match(/tuần\s*(\d+)\s*(?:là\s*)?(?:giảm tải|deload|nhẹ)/i); if(m) return Number(m[1]);   // QT-09: "tuần 4 nhẹ"
  m = txt.match(/(?:deload|giảm tải)\s*(?:sau\s*)?mỗi\s*(\d+)\s*tuần/i); if(m) return Number(m[1]);
  return 5;
}
function isDeloadWeek(c, week){
  if(!c || week < 1 || week > num(c.weeks)) return false;
  const ov = c.overrides || {};
  if(ov[week] === true || ov[week] === false) return ov[week];
  const every = num(c.deloadEvery);
  return every > 0 && week % every === 0;
}
function cycleInfo(planId, now){
  const c = planId && store().cycles[planId]; if(!c) return null;
  const week = weeksBetween(c.startDate, mondayStr(now || new Date())) + 1;
  const total = Math.max(1, num(c.weeks));
  const pre = week < 1, done = week > total;
  const deload = isDeloadWeek(c, week);
  let nextDeload = 0;
  for(let w = Math.max(1, week + (deload?1:0)); w <= total; w++){ if(isDeloadWeek(c, w)){ nextDeload = w; break; } }
  return { c, week, total, pre, done, deload, nextDeload, round: c.round || 1 };
}
function snapshotE1rm(planId){
  const plan = state.plans && state.plans[planId]; const out = {};
  if(!plan) return out;
  const H = state.setHist || {};
  DAY_KEYS.forEach(k=> ((plan.days[k]||{}).items||[]).forEach(it=>{
    const key = exKey(it); const h = H[key]; if(!h || !h.list) return;
    const best = Math.max(0, ...h.list.map(x=> num(x.e1rm)));
    if(best > 0) out[key] = best;
  }));
  return out;
}
function startCycle(planId, opts){
  opts = opts || {};
  const st = store();
  const t = opts.tpl || null;
  st.cycles[planId] = {
    planId,
    tplId: t ? t.id : (opts.tplId || null),
    weeks: Math.max(1, Math.min(52, num(opts.weeks || (t && t.weeks) || 8))),
    deloadEvery: opts.deloadEvery !== undefined ? Math.max(0, num(opts.deloadEvery)) : deloadEveryFor(t),
    startDate: opts.startDate || defaultStart(opts.now),
    round: opts.round || 1,
    createdAt: Date.now(),
    base: snapshotE1rm(planId),
    overrides: {},
  };
  return st.cycles[planId];
}
function endCycle(planId){ delete store().cycles[planId]; }
/* Kết quả chu kỳ: 1RM ước tính đầu chu kỳ → tốt nhất trong chu kỳ */
function cycleResults(planId){
  const c = store().cycles[planId]; if(!c) return [];
  const H = state.setHist || {}; const out = [];
  const plan = state.plans[planId]; if(!plan) return out;
  const keys = new Set();
  DAY_KEYS.forEach(k=> ((plan.days[k]||{}).items||[]).forEach(it=> keys.add(exKey(it))));
  keys.forEach(key=>{
    const h = H[key]; if(!h || !h.list) return;
    const inCyc = h.list.filter(x=> x.date >= c.startDate && num(x.e1rm) > 0);
    if(!inCyc.length) return;
    const now = Math.max(...inCyc.map(x=> num(x.e1rm)));
    const before = num((c.base||{})[key]) || num(inCyc[0].e1rm);
    out.push({ key, name: h.name || key, before, now, pct: before ? (now-before)/before*100 : 0 });
  });
  return out.sort((a,b)=> b.now - a.now);
}
/* Mức độ chuyên cần: số ngày đã tập trong chu kỳ / số buổi theo lịch */
function cycleAdherence(planId){
  const c = store().cycles[planId]; const plan = state.plans[planId]; if(!c || !plan) return null;
  const perWeek = requiredDays(plan).length;
  const end = addDaysStr(c.startDate, num(c.weeks)*7 - 1);
  const dates = new Set();
  (state.finishedDates||[]).forEach(d=>{ if(d >= c.startDate && d <= end) dates.add(d); });
  store().log.forEach(e=>{ if(e.date >= c.startDate && e.date <= end && e.planId === planId) dates.add(e.date); });
  const planned = perWeek * num(c.weeks);
  return { done: dates.size, planned, pct: planned ? Math.round(dates.size/planned*100) : 0 };
}
const LV_ORDER = ["beginner","intermediate","advanced"];
function tplCardioShare(t){
  const CARDIO = (typeof TPL_CARDIO !== "undefined") ? TPL_CARDIO : new Set(["walking","inclinewalk","zone2","intervalwalk","running","rowing","jumprope","stretch"]);
  let lift = 0, cardio = 0;
  Object.values(t.days||{}).forEach(d=>{ if(!d.ex || !d.ex.length) return; if(d.ex.every(e=> CARDIO.has(e[0]))) cardio++; else lift++; });
  return (lift+cardio) ? cardio/(lift+cardio) : 0;
}
/* Gợi ý giáo án nâng cấp: cùng giới (hoặc "chung"), cấp độ kế tiếp, cùng kiểu (tạ/hybrid/cardio), số buổi gần nhau */
function nextTemplate(tplId, userGender){
  if(typeof PROGRAM_TEMPLATES === "undefined") return null;
  const t = PROGRAM_TEMPLATES.find(x=> x.id === tplId); if(!t) return null;
  const li = LV_ORDER.indexOf(t.level);
  // QT-21: giáo án "Nam & Nữ" → chỉ gợi ý giáo án hợp giới tính của NGƯỜI DÙNG (nữ không nhận giáo án nam)
  const ug = userGender === "female" ? "nu" : userGender === "male" ? "nam" : null;
  const okG = (x)=> (x.gender === t.gender || x.gender === "chung" || t.gender === "chung") && (!ug || x.gender === ug || x.gender === "chung");
  let pool = PROGRAM_TEMPLATES.filter(x=> x.id !== t.id && okG(x) && LV_ORDER.indexOf(x.level) === li + 1);
  if(!pool.length) pool = PROGRAM_TEMPLATES.filter(x=> x.id !== t.id && okG(x) && x.level === t.level);
  if(!pool.length) return null;
  const cs = tplCardioShare(t), wantPW = num(t.perWeek) + (li < 2 ? 1 : 0);
  const score = (x)=> (x.gender === t.gender ? 0 : 1.5) + Math.abs(num(x.perWeek) - wantPW)*0.6 + Math.abs(tplCardioShare(x) - cs)*4;
  return pool.slice().sort((a,b)=> score(a) - score(b))[0];
}

/* ---------------------------------------------------------------------
   3. SUPERSET / CIRCUIT
   --------------------------------------------------------------------- */
const MAX_GROUP = 5;
const HEAVY = new Set(["squat","frontsquat","deadlift","benchpress","overheadpress","hacksquat","rdl","legpress","hipthrust"]);
function linksOf(planId, dayKey){ const L = store().links[planId]; return (L && Array.isArray(L[dayKey])) ? L[dayKey] : []; }
/* Nhóm = chuỗi bài LIỀN NHAU được nối "uidA>uidB". Trả về mảng chỉ số (chỉ nhóm ≥ 2 bài). */
function groupsFor(planId, dayKey, items){
  const L = new Set(linksOf(planId, dayKey));
  const out = []; let cur = null;
  (items||[]).forEach((it, i)=>{
    if(cur && i > 0 && L.has(items[i-1].uid + ">" + it.uid) && cur.length < MAX_GROUP) cur.push(i);
    else { cur = [i]; out.push(cur); }
  });
  return out.filter(g=> g.length > 1);
}
function isLinked(planId, dayKey, a, b){ return linksOf(planId, dayKey).includes(a + ">" + b); }
function toggleLink(planId, dayKey, items, i){
  const st = store();
  const a = items[i], b = items[i+1]; if(!a || !b) return { ok:false };
  st.links[planId] = st.links[planId] || {};
  // dọn liên kết cũ không còn liền nhau
  const valid = new Set(items.slice(0,-1).map((x,j)=> x.uid + ">" + items[j+1].uid));
  let arr = (st.links[planId][dayKey] || []).filter(k=> valid.has(k));
  const k = a.uid + ">" + b.uid;
  if(arr.includes(k)){ arr = arr.filter(x=> x !== k); st.links[planId][dayKey] = arr; return { ok:true, linked:false }; }
  arr.push(k);
  st.links[planId][dayKey] = arr;   // kiểm tra kích thước nhóm sau khi nối
  let size = 1, j = i; while(j > 0 && arr.includes(items[j-1].uid + ">" + items[j].uid)){ size++; j--; }
  j = i + 1; size++; while(j < items.length-1 && arr.includes(items[j].uid + ">" + items[j+1].uid)){ size++; j++; }
  if(size > MAX_GROUP){ st.links[planId][dayKey] = arr.filter(x=> x !== k); return { ok:false, reason:"max" }; }
  return { ok:true, linked:true, heavy: HEAVY.has(a.exerciseId) && HEAVY.has(b.exerciseId) };
}
/* GLOSSARY §8.2: superset → "Siêu hiệp (superset)"; circuit → "Liên hoàn (circuit)" — tên đầy đủ có tiếng Anh ở sheet ghép bài */
function groupLabel(n){ return n === 2 ? "Siêu hiệp" : "Liên hoàn"; }

/* ---------------------------------------------------------------------
   4. AMRAP / TỐI ĐA
   --------------------------------------------------------------------- */
function amrapKind(item){
  const r = String(item && item.reps || "");
  if(isTimedReps(r)) return "";
  if(/amrap|tối đa|\bmax\b/i.test(r)) return "all";
  if(/\d\s*\+(?=\s|$|·|,|\))/.test(r)) return "last";
  if(item && store().amrapItems[item.uid]) return "last";
  return "";
}
function amrapRows(item, n){
  const k = amrapKind(item); if(!k || !n) return [];
  if(k === "all") return Array.from({length:n}, (_,i)=> i);
  return [n-1];
}
function amrapLabel(item){
  const m = String(item && item.reps || "").match(/tối đa\s*[−–-]\s*(\d+)/i);
  return m ? `TỐI ĐA −${m[1]}` : "AMRAP";
}
/* Nhãn ngắn trong danh sách bài (tránh lặp chữ "tối đa −2" đã có sẵn trong số lần) */
function amrapListTag(item){
  const k = amrapKind(item); if(!k) return "";
  if(k === "last") return "AMRAP hiệp cuối";
  return /tối đa\s*[−–-]\s*\d/i.test(String(item.reps||"")) ? "" : "AMRAP";
}
function amrapRule(item){
  const m = String(item && item.reps || "").match(/tối đa\s*[−–-]\s*(\d+)/i);
  if(m) return `làm đến khi còn khoảng ${m[1]} lần nữa là hết sức${simpleMode() ? "" : ` (RIR ${m[1]})`} — ghi đúng số lần thật.`;
  return `làm tối đa số lần với kỹ thuật chuẩn (dừng khi form bắt đầu xấu) — ghi đúng số lần thật.`;
}
/* Kg gợi ý cho N lần, chừa RIR lần (Epley đảo) */
function kgForReps(oneRm, reps, rir, step){
  if(!oneRm || !reps) return 0;
  const k = oneRm / (1 + (reps + (rir||0))/30);
  return Math.max(0, roundTo(k, step || 2.5));
}
function bestRepsAt(key, kg){
  const L = store().amrap[key] || [];
  return L.filter(x=> num(x.kg) >= num(kg) - 0.01).reduce((a,x)=> Math.max(a, num(x.reps)), 0);
}

/* ---------------------------------------------------------------------
   5. NHÓM CƠ & KHỐI LƯỢNG TUẦN
   --------------------------------------------------------------------- */
const MG = ["Ngực","Lưng","Vai","Tay trước","Tay sau","Đùi trước","Đùi sau","Mông","Bắp chân","Bụng"];
/* Hệ số hiệp: nhóm cơ chính = 1, nhóm cơ phụ = 0,5 (cách đếm "fractional sets") */
const MMAP = {
  benchpress:{"Ngực":1,"Tay sau":.5,"Vai":.5}, inclinedb:{"Ngực":1,"Vai":.5,"Tay sau":.5}, pushup:{"Ngực":1,"Tay sau":.5,"Vai":.5},
  cablefly:{"Ngực":1}, pecdeck:{"Ngực":1}, dbbench:{"Ngực":1,"Tay sau":.5,"Vai":.5}, machinepress:{"Ngực":1,"Tay sau":.5,"Vai":.5},
  inclinepushup:{"Ngực":1,"Tay sau":.5},
  pullup:{"Lưng":1,"Tay trước":.5}, bentoverrow:{"Lưng":1,"Tay trước":.5}, latpulldown:{"Lưng":1,"Tay trước":.5},
  cablerow:{"Lưng":1,"Tay trước":.5}, dbrow:{"Lưng":1,"Tay trước":.5}, csrow:{"Lưng":1,"Tay trước":.5}, invertedrow:{"Lưng":1,"Tay trước":.5},
  pullover:{"Lưng":1,"Ngực":.5},
  deadlift:{"Mông":1,"Đùi sau":.5,"Lưng":.5,"Đùi trước":.5},
  overheadpress:{"Vai":1,"Tay sau":.5}, dbpress:{"Vai":1,"Tay sau":.5}, lateralraise:{"Vai":1}, cablelateral:{"Vai":1}, facepull:{"Vai":1,"Lưng":.5},
  squat:{"Đùi trước":1,"Mông":.5}, frontsquat:{"Đùi trước":1,"Mông":.5}, hacksquat:{"Đùi trước":1,"Mông":.5}, smithsquat:{"Đùi trước":1,"Mông":.5},
  legpress:{"Đùi trước":1,"Mông":.5}, gobletsquat:{"Đùi trước":1,"Mông":.5}, bwsquat:{"Đùi trước":1,"Mông":.5}, lunges:{"Đùi trước":1,"Mông":.5},
  bulgarian:{"Đùi trước":1,"Mông":1}, stepup:{"Đùi trước":1,"Mông":1}, legext:{"Đùi trước":1},
  legcurl:{"Đùi sau":1}, rdl:{"Đùi sau":1,"Mông":.5}, calfraise:{"Bắp chân":1},
  hipthrust:{"Mông":1,"Đùi sau":.5}, glutebridge:{"Mông":1}, kickback:{"Mông":1}, abduction:{"Mông":1}, kbswing:{"Mông":1,"Đùi sau":.5},
  bicepcurl:{"Tay trước":1}, hammercurl:{"Tay trước":1}, preacher:{"Tay trước":1},
  tricepdip:{"Tay sau":1,"Ngực":.5}, tricepsdown:{"Tay sau":1}, skullcrusher:{"Tay sau":1}, ohtriext:{"Tay sau":1},
  plank:{"Bụng":1}, hangingleg:{"Bụng":1}, russiantwist:{"Bụng":1}, crunch:{"Bụng":1}, deadbug:{"Bụng":1}, sideplank:{"Bụng":1}, woodchop:{"Bụng":1},
  mountainclimber:{"Bụng":.5}, wallball:{"Đùi trước":.5,"Vai":.5}, sledpush:{"Đùi trước":.5},
};
function mapToken(t){
  t = String(t||"").toLowerCase().trim();
  if(!t) return null;
  if(/bắp chân/.test(t)) return "Bắp chân";
  if(/đùi sau/.test(t)) return "Đùi sau";
  if(/đùi trước/.test(t)) return "Đùi trước";
  if(/mông|đùi ngoài/.test(t)) return "Mông";
  if(/^chân$|^chân\s/.test(t)) return "Đùi trước";
  if(/ngực/.test(t)) return "Ngực";
  if(/lưng|xô|cầu vai/.test(t)) return "Lưng";
  if(/vai/.test(t)) return "Vai";
  if(/tay trước|bắp tay trước/.test(t)) return "Tay trước";
  if(/tay sau/.test(t)) return "Tay sau";
  if(/bụng|core|liên sườn/.test(t)) return "Bụng";
  return null;
}
function parseMuscle(str){
  const out = {};
  String(str||"").split(/[\/,]/).forEach((tok, i)=>{ const g = mapToken(tok); if(g && out[g] === undefined) out[g] = i === 0 ? 1 : .5; });
  return out;
}
function findCustomMuscle(name){
  for(const p of Object.values(state.plans||{})) for(const k of DAY_KEYS){
    const it = (((p.days||{})[k]||{}).items||[]).find(x=> x.custom && x.custom.name === name);
    if(it) return it.custom.muscle || "";
  }
  return "";
}
/* QT-19: dùng CHUNG bảng hệ số nhóm cơ với program-builder (PB.EX[id].m) để 2 màn đếm giống nhau */
const PB_TO_MG = { chest:"Ngực", back:"Lưng", shoulders:"Vai", biceps:"Tay trước", triceps:"Tay sau", quads:"Đùi trước", hams:"Đùi sau", glutes:"Mông", calves:"Bắp chân", core:"Bụng" };
const _pbW = {};
function pbWeights(key){
  if(key in _pbW) return _pbW[key];
  let out = null;
  try{
    const P = (typeof window !== "undefined" && window.PB) || (typeof PB !== "undefined" ? PB : null);
    const e = P && P.EX && P.EX[key];
    if(e && e.m){ out = {}; for(const k in e.m){ const g = PB_TO_MG[k]; if(g && e.m[k] > 0) out[g] = e.m[k]; } }
  }catch(err){ out = null; }
  if(out) _pbW[key] = out;
  return out;
}
function muscleWeights(key, fallbackMuscle){
  key = String(key||"");
  if(!key.startsWith("c:")){ const w = pbWeights(key); if(w) return w; }
  if(!key.startsWith("c:") && MMAP[key]) return MMAP[key];
  let m = fallbackMuscle || "";
  if(!m && !key.startsWith("c:") && typeof EXERCISES !== "undefined" && EXERCISES[key]) m = EXERCISES[key].muscle;
  if(!m && key.startsWith("c:")) m = findCustomMuscle(key.slice(2));
  return parseMuscle(m);
}
/* Hiệp hiệu quả: hiệp chính đã xong; hiệp ghi RPE ≤ 6 (còn ≥ 4 lần) tính nửa hiệp */
function hardSets(sets){ return (sets||[]).reduce((a,x)=> a + (x && x.rpe && num(x.rpe) <= 6 ? .5 : 1), 0); }
function weekRange(offset, now){
  const mon = parseD(mondayStr(now || new Date())); mon.setDate(mon.getDate() + 7*(offset||0));
  const sun = new Date(mon); sun.setDate(sun.getDate()+6);
  return { from: dstr(mon), to: dstr(sun) };
}
function weekVolume(from, to){
  const acc = {}; MG.forEach(g=> acc[g] = 0);
  const seen = new Set(); let sessions = 0, durSec = 0, tonnage = 0;
  store().log.forEach(e=>{
    if(!e || e.date < from || e.date > to) return;
    sessions++; durSec += num(e.dur); tonnage += num(e.volume);
    (e.exercises||[]).forEach(x=>{
      seen.add(e.date + "|" + x.key);
      const w = muscleWeights(x.key, x.muscle), hs = x.hard != null ? num(x.hard) : num(x.sets);
      for(const g in w) if(acc[g] !== undefined) acc[g] += hs * w[g];
    });
  });
  Object.entries(state.setHist||{}).forEach(([key, h])=> ((h && h.list)||[]).forEach(en=>{
    if(!en || en.date < from || en.date > to || seen.has(en.date + "|" + key)) return;
    seen.add(en.date + "|" + key);
    const w = muscleWeights(key), hs = hardSets(en.sets);
    for(const g in w) if(acc[g] !== undefined) acc[g] += hs * w[g];
  }));
  MG.forEach(g=> acc[g] = Math.round(acc[g]*2)/2);
  return { acc, sessions, durSec, tonnage };
}
function plannedVolume(plan){
  const acc = {}; MG.forEach(g=> acc[g] = 0);
  if(!plan) return acc;
  DAY_KEYS.forEach(k=> (((plan.days||{})[k]||{}).items||[]).forEach(it=>{
    const w = muscleWeights(exKey(it), getExerciseMeta(it).muscle);
    for(const g in w) if(acc[g] !== undefined) acc[g] += num(it.sets) * w[g];
  }));
  MG.forEach(g=> acc[g] = Math.round(acc[g]*2)/2);
  return acc;
}
/* QT-19: vạch chuẩn theo GIÁO ÁN (plannedVolume) — giáo án người mới cố ý < 10 hiệp, giáo án chuyên mông cố ý 22–24 hiệp.
   Không có giáo án (planned = 0 cho mọi nhóm) → chuẩn chung tăng cơ 10–20. */
function volTarget(planned){
  const p = num(planned);
  if(p > 0) return { lo: Math.max(1, Math.round(p*0.8*2)/2), hi: Math.max(20, Math.round(p*1.25*2)/2), plan: p };
  return { lo: 10, hi: 20, plan: 0 };
}
function volStatus(v, planned){
  if(planned === undefined) return v < 5 ? "low2" : v < 10 ? "low" : v <= 20 ? "ok" : "high";
  const T = volTarget(planned);
  return v < T.lo*0.5 ? "low2" : v < T.lo ? "low" : v <= T.hi ? "ok" : "high";
}

/* ---------------------------------------------------------------------
   6. BUỔI TẬP: KHỞI TẠO, ĐIỀN SẴN, DELOAD
   --------------------------------------------------------------------- */
function deloadSets(n){ n = Math.max(1, num(n) || 1); return Math.max(1, Math.round(n * 0.6)); }
function deloadClone(it){
  const c = Object.assign({}, it, { sets: deloadSets(it.sets), _tpOrigSets: it.sets });
  ["stock","clipId"].forEach(k=> Object.defineProperty(c, k, { get(){ return it[k]; }, set(v){ it[k] = v; }, enumerable:true, configurable:true }));
  return c;
}
function lastNoteFor(planId, dayKey){
  const L = store().log;
  for(let i = L.length-1; i >= 0; i--){ const e = L[i]; if(e.planId === planId && e.dayKey === dayKey && e.note) return e; }
  return null;
}
function initSession(s){
  const plan = getActivePlan();
  const info = plan ? cycleInfo(plan.id) : null;
  const quick = !!s._quick;                       // buổi nhanh 20 phút (achievements.js) có logic tạ riêng
  const deload = !!(info && info.deload) && !quick;
  s._tp = { startedAt: Date.now(), note: "", planId: plan && plan.id, week: info && !info.pre && !info.done ? info.week : 0, weeks: info ? info.total : 0,
            deload, groups: [], groupOf: {}, prs: [], seen: {}, noteOpen: false, ctxItem: null, hint: {} };
  // QT-13: số ngày từ buổi tập gần nhất (bất kỳ bài nào) — nghỉ ≥ 7 ngày thì buổi thường đầu tiên tự giảm tạ
  try{ const lt = lastTrainDate(); s._tp.trainGap = lt && lt < dstr(new Date()) ? daysSince(lt) : 0; }catch(e){ s._tp.trainGap = 0; }
  if(deload) s.items = s.items.map(deloadClone);
  const groups = plan && !quick ? groupsFor(plan.id, s.dayKey, s.items) : [];
  s._tp.groups = groups.map(g=> g.map(i=> s.items[i].uid));
  s._tp.groups.forEach((g, gi)=> g.forEach(u=> s._tp.groupOf[u] = gi));
  ensureTick();
}
function ctxFor(item){
  const meta = getExerciseMeta(item), key = exKey(item);
  state.setLog = state.setLog || {};
  const last = state.setLog[key];
  const timed = isTimedReps(item.reps);
  const nSets = Math.min(20, Math.max(1, Math.round(num(item.sets)) || 1));   // R3-CORE-05: kẹp 1–20 hiệp
  const top = repTop(item.reps);
  const prog = progressionFor(item, meta, last, timed, nSets);
  return { meta, key, last, timed, nSets, top, prog };
}
/* Top set + back-off (QT-08): hiệp 1 nặng nhất, các hiệp sau giảm ~10%.
   Giáo án mới: item.scheme = "topback" (templates.js). Giáo án cũ tạo trước bản sửa → tra lại giáo án mẫu gốc. */
function isTopBack(item){
  if(!item) return false;
  if(item.scheme === "topback") return true;
  if(item.scheme || !item.exerciseId) return false;
  try{
    const plan = getActivePlan();
    const t = plan && plan.fromTemplate && typeof PROGRAM_TEMPLATES !== "undefined" ? PROGRAM_TEMPLATES.find(x=> x.id === plan.fromTemplate) : null;
    return !!(t && Object.values(t.days).some(d=> (d.ex||[]).some(e=> e[0] === item.exerciseId && e[4] && e[4].scheme === "topback" && String(e[2]) === String(item.reps))));
  }catch(e){ return false; }
}
function backoffKg(top, step){ const v = lighterKg(top, 0.9, step); return v == null ? top : v; }
/* Điền sẵn hiệp — nguồn chung cho mọi buổi tập (app.js dùng lại session.sets nếu đã có):
   · QT-01: buổi trước có hiệp 0 kg ở bài có tạ (lỗi cũ) → dùng tạ chính, không điền 0 kg
   · QT-10: số lần = số lần buổi trước (trong khoảng lần) thay vì luôn là đáy khoảng
   · QT-08: top set + back-off
   · QT-13: nghỉ bài này ≥ 7 ngày → tạ ~90% (≥ 21 ngày ~80%) cho buổi thường đầu tiên */
function ensureRows(s, item, ctx){
  s.sets = s.sets || {};
  if(!s.sets[item.uid]){
    const { last, timed, nSets, top, prog, meta } = ctx;
    const L = last && Array.isArray(last.sets) ? last.sets : [];
    const maxR = isMaxReps(item.reps);
    const bottom = repBottom(item.reps) || top || "";
    const lastTop = Math.max(0, ...L.map(x=> num(x && x.kg)));
    const step = weightStep(meta);
    const tb = !timed && isTopBack(item);
    const tp = s._tp || {};
    // Chỉ khi NGƯỜI TẬP nghỉ ≥ 7 ngày (không tập buổi nào) — bài tập 1 lần/tuần cách nhau 7 ngày là bình thường
    const gap = num(tp.trainGap);
    const exGap = last && last.date ? daysSince(last.date) : 0;
    const ret = !timed && !s._quick && !tp.deload && gap >= 7 && exGap >= gap && lastTop > 0 ? (gap >= 21 ? 0.8 : 0.9) : 1;
    const rows = Array.from({length:nSets}, (_,i)=>{
      const l = L[i] || L[L.length-1];
      let kg = "";
      if(l){ const own = num(l.kg); kg = prog.delta && ret === 1 ? prog.kg : (own > 0 ? own : (lastTop > 0 ? lastTop : l.kg)); }
      let reps;
      if(timed || maxR) reps = (l && maxR) ? l.reps : "";
      else if(l && !prog.delta && ret === 1 && num(l.reps) > 0) reps = top ? Math.min(top, Math.max(num(bottom) || 1, Math.round(num(l.reps)))) : Math.round(num(l.reps));
      else reps = bottom;
      return { kg, reps, rpe:"", done:false };
    });
    if(tb && rows.length && num(rows[0].kg) > 0){
      const top0 = prog.delta && ret === 1 ? num(prog.kg) : (num(L[0] && L[0].kg) || lastTop);
      rows[0].kg = top0;
      for(let i = 1; i < rows.length; i++) rows[i].kg = backoffKg(top0, step);
    }
    if(ret < 1){
      rows.forEach(r=>{ const k = num(r.kg); if(k > 0){ const v = lighterKg(k, ret, step); if(v != null) r.kg = v; } });
      tp.ret = tp.ret || {}; tp.ret[item.uid] = { gap, pct: Math.round(ret*100) };
    }
    if(tb){ tp.tb = tp.tb || {}; tp.tb[item.uid] = true; }
    s.sets[item.uid] = rows;
  }
  return s.sets[item.uid];
}
/* QT-10: 3 buổi gần nhất ghi y hệt (cùng kg × lần) → nhắc thử thêm lần */
function sameThreeTimes(key){
  const h = (state.setHist||{})[key]; const L = h && Array.isArray(h.list) ? h.list.slice(-3) : [];
  if(L.length < 3) return false;
  const sig = x=> JSON.stringify((x.sets||[]).map(y=> [num(y.kg), num(y.reps)]));
  return L.every(x=> sig(x) === sig(L[0])) && (L[0].sets||[]).length > 0;
}
/* Lần đầu mở bài trong buổi: deload → tạ −10% so với buổi thường gần nhất; AMRAP → để trống số lần để ghi số thật */
function firstView(s, item, ctx, rows){
  const tp = s._tp; if(tp.seen[item.uid]) return; tp.seen[item.uid] = true;
  if(tp.deload && !ctx.timed){
    const step = weightStep(ctx.meta);
    rows.forEach((r, i)=>{
      if(r.done) return;
      const l = ctx.last && ctx.last.sets && (ctx.last.sets[i] || ctx.last.sets[ctx.last.sets.length-1]);
      const base = num(l && num(l.kg) > 0 ? l.kg : r.kg);
      if(base > 0){
        // QT-02: roundTo(base×0,9, 2,5) trả lại đúng mức cũ khi tạ ≤ 12,5 kg → dùng nấc nhỏ; vẫn không giảm được thì bớt ~20% số lần
        const v = lighterKg(base, 0.9, step);
        if(v != null) r.kg = v;
        else { r.kg = base; if(num(r.reps) > 1) r.reps = Math.max(1, Math.round(num(r.reps)*0.8)); }
      }
    });
  }
  amrapRows(item, rows.length).forEach(i=>{
    const r = rows[i]; if(!r || r.done) return;
    // mốc cần vượt: số lần đã điền sẵn, số lần hiệp tương ứng buổi trước, kỷ lục AMRAP ở mức tạ này
    const l = ctx.last && ctx.last.sets && (ctx.last.sets[i] || ctx.last.sets[ctx.last.sets.length-1]);
    tp.hint[item.uid] = Math.max(num(tp.hint[item.uid]), num(r.reps), num(l && l.reps), bestRepsAt(ctx.key, num(r.kg)));
    r.reps = "";
  });
}
const needsPrefill = (s, item)=> s._tp && !s._tp.seen[item.uid] && (s._tp.deload || amrapRows(item, Math.max(1, num(item.sets)||1)).length > 0);

/* ---------------------------------------------------------------------
   7. ĐỒNG HỒ BUỔI TẬP
   --------------------------------------------------------------------- */
let tick = null;
function fmtClock(ms){
  const t = Math.max(0, Math.floor(ms/1000)), h = Math.floor(t/3600), m = Math.floor(t%3600/60), sec = t%60;
  return h ? `${h}:${p2(m)}:${p2(sec)}` : `${p2(m)}:${p2(sec)}`;
}
function fmtDur(sec){
  sec = Math.max(0, Math.round(num(sec)));
  const h = Math.floor(sec/3600), m = Math.round(sec%3600/60);
  if(h) return `${h} giờ ${p2(m)} phút`;
  return sec < 60 ? `${sec} giây` : `${Math.max(1, m)} phút`;
}
function ensureTick(){
  if(tick || typeof document === "undefined") return;
  tick = setInterval(()=>{
    const s = curSession();
    const els = document.querySelectorAll("[data-tp-clock]");
    if(!s || !s._tp){ if(!els.length){ clearInterval(tick); tick = null; } return; }
    const txt = fmtClock(Date.now() - s._tp.startedAt);
    els.forEach(e=>{ if(e.textContent !== txt) e.textContent = txt; });
  }, 1000);
}

/* ---------------------------------------------------------------------
   8. GIAO DIỆN BUỔI TẬP — thanh trên (đồng hồ, tuần, ghi chú)
   --------------------------------------------------------------------- */
function sbarHTML(s){
  const tp = s._tp;
  const ln = lastNoteFor(tp.planId, s.dayKey);
  return `
  <div class="tp-sbar">
    <span class="tp-clock" title="Thời gian buổi tập"><span class="material-symbols-rounded">timer</span><b data-tp-clock>${fmtClock(Date.now()-tp.startedAt)}</b></span>
    ${tp.week ? `<span class="tp-wk">Tuần ${tp.week}/${tp.weeks}</span>` : ""}
    ${tp.deload ? `<span class="tp-wk tp-dl">Giảm tải</span>` : ""}
    <button type="button" class="tp-note-btn ${tp.note?'has':''}" id="tp-note-btn" aria-expanded="${tp.noteOpen?'true':'false'}"><span class="material-symbols-rounded">edit_note</span>Ghi chú</button>
  </div>
  <div class="tp-note-box" id="tp-note-box" ${tp.noteOpen?"":"hidden"}>
    ${ln ? `<p class="small-note">Lần trước (${ddmm(ln.date)}): “${esc(ln.note)}”</p>` : ""}
    <textarea id="tp-note" rows="3" maxlength="600" placeholder="Cảm giác hôm nay, giấc ngủ, chỗ đau mỏi, điều chỉnh cho lần sau…">${esc(tp.note)}</textarea>
  </div>`;
}
function bindSbar(s){
  const btn = document.getElementById("tp-note-btn"), box = document.getElementById("tp-note-box"), ta = document.getElementById("tp-note");
  if(btn && box) btn.addEventListener("click", ()=>{ box.hidden = !box.hidden; s._tp.noteOpen = !box.hidden; btn.setAttribute("aria-expanded", String(!box.hidden)); if(!box.hidden && ta) ta.focus(); });
  if(ta) ta.addEventListener("input", ()=>{ s._tp.note = ta.value.slice(0,600); if(btn) btn.classList.toggle("has", !!ta.value.trim()); });
  ensureTick();
}
function deloadBannerHTML(timed){
  return `<div class="tp-dl-banner"><span class="material-symbols-rounded">trending_down</span><span><b>Tuần giảm tải</b> — số hiệp đã giảm ~40%, ${timed ? "giảm ~1/3 thời gian hoặc tốc độ" : "tạ điền sẵn giảm ~10%"}. Dừng xa thất bại (còn 3–4 lần), tập nhẹ nhàng để hồi phục rồi tăng tiếp.</span></div>`;
}
function amrapNoteHTML(item, rowsIdx, nRows){
  if(!rowsIdx.length) return "";
  const which = rowsIdx.length === nRows ? "Mọi hiệp" : `Hiệp ${rowsIdx[0]+1}`;
  return `<div class="tp-amrap-note"><span class="tp-am-tag">${amrapLabel(item)}</span><span>${which}: ${amrapRule(item)}</span></div>`;
}
/* Ước tính trực tiếp khi nhập số lần AMRAP */
function amrapEstimate(item, ctx, rows){
  const idx = amrapRows(item, rows.length);
  let best = null;
  idx.forEach(i=>{ const r = rows[i]; const reps = num(r.reps), kg = num(r.kg); if(!reps) return;
    const e = kg > 0 ? e1rm(kg, reps) : 0;
    if(!best || (kg > 0 ? e > best.e : reps > best.reps)) best = { kg, reps, e }; });
  if(!best) return "";
  if(best.kg <= 0){
    const prev = bestRepsAt(ctx.key, 0);
    return prev ? (best.reps > prev ? `<b>Kỷ lục số lần mới!</b> ${best.reps} lần (cũ: ${prev}).` : `Kỷ lục số lần: ${prev} — lần này ${best.reps}.`) : `Ghi nhận ${best.reps} lần — dùng làm mốc cho lần sau.`;
  }
  const step = weightStep(ctx.meta);
  const target = ctx.top && ctx.top < 30 ? ctx.top : 8;
  const sug = kgForReps(best.e, target, 2, step);
  return `1RM ước tính <b>~${Math.round(best.e)} kg</b> (${best.kg} kg × ${best.reps})${best.reps > 12 ? " · trên 12 lần nên ước tính kém chính xác — lần sau tăng tạ" : ""}. Tạ gợi ý cho ${target} lần (còn 2 lần): <b>~${sug} kg</b>.`;
}

/* ---------------------------------------------------------------------
   9. BUỔI TẬP ĐƠN (bài lẻ) — trang trí màn gốc
   --------------------------------------------------------------------- */
function decorateSingle(s, item){
  const sheet = document.getElementById("sheet-content"); if(!sheet || !s._tp) return;
  const ctx = ctxFor(item);
  const rows = (s.sets||{})[item.uid] || [];
  const liveRows = ()=> ((s.sets||{})[item.uid]) || rows;
  const track = sheet.querySelector(".progress-track");
  if(track && !sheet.querySelector(".tp-sbar")){ track.insertAdjacentHTML("afterend", sbarHTML(s)); bindSbar(s); }
  const chips = sheet.querySelector(".chip-row");
  try{ singleNotes(s, item, ctx, rows, sheet, chips); }catch(e){}
  if(s._tp.deload){
    sheet.querySelectorAll(".set-up").forEach(up=> up.remove());
    if(chips && !sheet.querySelector(".tp-dl-banner")) chips.insertAdjacentHTML("afterend", deloadBannerHTML(ctx.timed));
    if(chips && item._tpOrigSets) chips.insertAdjacentHTML("beforeend", `<span class="pill">Giảm tải: ${esc(item.sets)}/${esc(item._tpOrigSets)} hiệp</span>`);
  }
  const am = ctx.timed ? [] : amrapRows(item, rows.length);
  if(am.length){
    if(chips) chips.insertAdjacentHTML("beforeend", `<span class="pill tp-am-pill">${amrapLabel(item)}</span>`);
    const table = sheet.querySelector(".set-table");
    if(table){
      table.insertAdjacentHTML("beforebegin", amrapNoteHTML(item, am, rows.length));
      table.insertAdjacentHTML("afterend", `<div class="tp-am-est" id="tp-am-est" aria-live="polite"></div>`);
      const hint = num(s._tp.hint[item.uid]);
      am.forEach(i=>{
        const row = table.querySelector(`.set-row[data-set="${i}"]`); if(!row) return;
        row.classList.add("tp-amrap");
        const b = row.querySelector("b"); if(b) b.textContent = (i+1) + "+";
        const inp = row.querySelector("[data-reps]"); if(inp){ inp.placeholder = hint ? `≥${hint}` : "tối đa"; inp.setAttribute("aria-label", `Số lần tối đa hiệp ${i+1}`); }
      });
      const upd = ()=>{ const el = document.getElementById("tp-am-est"); if(el) el.innerHTML = amrapEstimate(item, ctx, rows); };
      table.addEventListener("input", ()=> setTimeout(upd, 0));
      table.addEventListener("change", ()=> setTimeout(upd, 0));
      upd();
      // chặn đánh dấu xong hiệp AMRAP khi chưa nhập số lần thật (nghe ở pha capture của phần tử cha)
      table.addEventListener("click", (e)=>{
        const btn = e.target.closest && e.target.closest("[data-done]"); if(!btn) return;
        const i = Number(btn.dataset.done); if(!am.includes(i)) return;
        const L = liveRows(); const r = L[i]; if(!r || r.done) return;
        const inp = table.querySelector(`[data-reps="${i}"]`);
        const v = num(inp && inp.value !== "" ? inp.value : r.reps);
        if(!v){ e.stopPropagation(); e.preventDefault(); toast("Nhập số lần thực tế bạn làm được ở hiệp AMRAP", "edit"); if(inp) inp.focus(); return; }
        r.reps = Math.round(v);
      }, true);
    }
    const done = document.getElementById("btn-session-done");
    if(done && !done.parentElement.classList.contains("tp-wrap")){
      const wrap = document.createElement("span"); wrap.className = "tp-wrap"; done.before(wrap); wrap.appendChild(done);
      wrap.addEventListener("click", (e)=>{
        // đọc hàng hiệp HIỆN TẠI (app.js có thể thay mảng session.sets[uid] sau khi vẽ) + giá trị đang gõ trong ô
        const L = liveRows();
        L.forEach((r, i)=>{ const inp = sheet.querySelector(`[data-reps="${i}"]`); if(r && inp && inp.value !== "" && !num(r.reps)) r.reps = num(inp.value); });
        const anyDone = L.some(r=> r && r.done);
        const bad = am.find(i=> L[i] && (anyDone ? L[i].done : true) && !num(L[i].reps));
        if(bad !== undefined){ e.stopPropagation(); e.preventDefault(); toast(`Hiệp ${bad+1} là AMRAP — nhập số lần thật trước khi lưu`, "edit"); const inp = sheet.querySelector(`[data-reps="${bad}"]`); if(inp) inp.focus(); }
      }, true);
    }
  }
}

/* Ghi chú điền sẵn (quay lại sau nghỉ, top set, 3 buổi y hệt) + tự chép kg xuống hiệp sau (QT-01) */
function prefillNotesHTML(s, item, ctx){
  const tp = s._tp || {}, out = [];
  const ret = tp.ret && tp.ret[item.uid];
  if(ret) out.push(`<div class="set-up down tp-ret"><span class="material-symbols-rounded">trending_down</span><span>Bạn nghỉ bài này ${esc(ret.gap)} ngày → app điền sẵn ~${esc(ret.pct)}% mức tạ cũ để quay lại an toàn. Buổi sau tăng lại như thường.</span></div>`);
  if(tp.tb && tp.tb[item.uid]) out.push(`<div class="tp-amrap-note tp-tb-note"><span class="material-symbols-rounded">stacks</span><span><b>Hiệp 1 là hiệp nặng</b>${/RPE/i.test(String(item.reps)) ? (simpleMode() ? "" : " (theo độ nặng cảm nhận — RPE — mục tiêu)") : ""}, các hiệp sau giảm ~10% tạ. App tăng tạ khi hiệp nặng đạt đỉnh khoảng lần.</span></div>`);
  else if(!ret && !ctx.timed && !(ctx.prog && ctx.prog.delta) && sameThreeTimes(ctx.key)) out.push(`<p class="small-note tp-same" style="color:var(--mint-2)">3 buổi gần nhất bạn ghi y hệt nhau. Hôm nay thử thêm 1 lần ở hiệp đầu (giữ kỹ thuật chuẩn) — đó là cách để app tăng tạ cho bạn.</p>`);
  return out.join("");
}
function singleNotes(s, item, ctx, rows, sheet, chips){
  if(!sheet.querySelector(".tp-prefill-notes")){
    const html = prefillNotesHTML(s, item, ctx);
    if(html){
      if(s._tp.ret && s._tp.ret[item.uid]) sheet.querySelectorAll(".set-up:not(.tp-ret)").forEach(x=> x.remove());   // tránh 2 thông báo trái ngược
      const anchor = sheet.querySelector(".set-up") || sheet.querySelector(".set-last") || chips;
      if(anchor) anchor.insertAdjacentHTML("afterend", `<div class="tp-prefill-notes">${html}</div>`);
    }
  }
  const table = sheet.querySelector(".set-table");
  if(table && !ctx.timed && !table.dataset.tpFill){
    table.dataset.tpFill = "1";
    table.addEventListener("change", (e)=>{
      const inp = e.target; if(!inp || !inp.matches || !inp.matches("[data-kg]")) return;
      fillDown(rows, Number(inp.dataset.kg), num(inp.value), (j, v)=>{ const n = table.querySelector(`[data-kg="${j}"]`); if(n) n.value = v; });
    });
  }
}
/* Gõ kg ở hiệp i → điền xuống các hiệp sau còn trống (chưa xong). Hàm thuần: trả về số hiệp đã điền. */
function fillDown(rows, i, v, onFill){
  if(!(v > 0) || !Array.isArray(rows)) return 0;
  let n = 0;
  for(let j = i + 1; j < rows.length; j++){ const r = rows[j]; if(!r || r.done || num(r.kg) > 0) continue; r.kg = v; n++; if(onFill) onFill(j, v); }
  return n;
}
/* Hiệp đã xong nhưng kg trống/0 ở bài có tạ → lấy kg hiệp trước (hoặc tạ chính buổi trước). Bài trọng lượng cơ thể giữ 0. */
function fillBlankKg(key, sets){
  if(!Array.isArray(sets) || !sets.length) return sets;
  const last = (state.setLog||{})[key];
  const lastTop = Math.max(0, ...((last && last.sets) || []).map(x=> num(x && x.kg)));
  const firstPos = (sets.find(x=> num(x && x.kg) > 0) || {}).kg;
  if(!(num(firstPos) > 0) && !(lastTop > 0)) return sets;      // bài trọng lượng cơ thể / chưa từng có tạ
  let carry = num(firstPos) > 0 ? num(firstPos) : lastTop;
  return sets.map(x=>{
    const k = num(x && x.kg);
    if(k > 0){ carry = k; return x; }
    return Object.assign({}, x, { kg: carry });
  });
}

/* ---------------------------------------------------------------------
   10. BUỔI TẬP SUPERSET / CIRCUIT — màn riêng, luân phiên các bài
   --------------------------------------------------------------------- */
function groupCursor(rowsArr){
  const rounds = Math.max(...rowsArr.map(r=> r.length));
  for(let r = 0; r < rounds; r++) for(let k = 0; k < rowsArr.length; k++){ const row = rowsArr[k][r]; if(row && !row.done) return { r, k }; }
  return null;
}
function renderGroupStep(s, gi){
  const tp = s._tp;
  const uids = tp.groups[gi];
  const idxs = uids.map(u=> s.items.findIndex(it=> it.uid === u)).filter(i=> i >= 0);
  const items = idxs.map(i=> s.items[i]);
  if(items.length < 2) return false;
  if(!s._awake){ s._awake = true; keepAwake(true); }
  onSheetCloseHook = ()=>{ const ss = curSession(); if(ss && !ss.finished){ stopSetRest(); keepAwake(false); ss._awake = false; ss.paused = true; toast("Đã tạm dừng buổi tập — bấm Bắt đầu để tiếp tục", "pause"); } };
  const ctxs = items.map(ctxFor);
  const rowsArr = items.map((it, k)=> ensureRows(s, it, ctxs[k]));
  items.forEach((it, k)=> firstView(s, it, ctxs[k], rowsArr[k]));
  const letter = String.fromCharCode(65 + gi);
  const kind = groupLabel(items.length);
  const rounds = Math.max(...rowsArr.map(r=> r.length));
  const restSec = Math.max(0, ...items.map(it=> num(it.restSec)));
  const first = idxs[0], lastI = idxs[idxs.length-1], n = s.items.length;
  const cur = groupCursor(rowsArr);
  const isLastStep = lastI >= n - 1;
  const anyTimedDeload = tp.deload && ctxs.some(c=> c.timed);
  const smp = simpleMode();   // cấp Mới tập: ẩn cột RPE (GLOSSARY §8.2, cùng quy tắc bảng hiệp của app.js)
  openSheet(`
    <div class="progress-row"><span class="label">Bài ${first+1}–${lastI+1}/${n}</span><span class="value">${s.isToday?'Hôm nay':'Xem trước'}</span></div>
    <div class="progress-track" style="margin-bottom:12px;"><div class="progress-fill" style="width:${(first/n)*100}%"></div></div>
    ${sbarHTML(s)}
    <div class="tp-ss-head"><span class="tp-ss-tag"><span class="material-symbols-rounded">link</span>${kind} ${letter}</span><b>Vòng <span id="tp-round">${cur ? cur.r+1 : rounds}</span>/${rounds}</b></div>
    <p class="small-note tp-ss-rule">Làm lần lượt ${items.map((_,k)=> letter+(k+1)).join(" → ")} gần như không nghỉ, xong một vòng mới nghỉ ${restSec ? restSec+" giây" : "ngắn"}.</p>
    ${tp.deload ? deloadBannerHTML(anyTimedDeload && ctxs.every(c=>c.timed)) : ""}
    <div class="tp-ss tp-ss-${items.length}">
    ${items.map((it, k)=>{
      const c = ctxs[k], rows = rowsArr[k];
      const am = c.timed ? [] : amrapRows(it, rows.length);
      const hint = num(tp.hint[it.uid]);
      const lastTxt = c.last && c.last.sets && c.last.sets.length ? `Lần trước: ${c.last.sets.map(x=> c.timed ? "✓" : `${x.kg||0}×${x.reps}`).join(" · ")}` : "";
      const thumb = (it.stock && it.stock.thumb) || c.meta.img || "";
      return `
      <section class="tp-ss-ex" data-k="${k}">
        <div class="tp-ss-exh">
          ${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="tp-ss-ph"></span>`}
          <div class="tp-ss-nm"><b><i>${letter}${k+1}</i>${esc(c.meta.name)}</b><small>${esc(it.sets)} hiệp × ${esc(String(it.reps))}${it._tpOrigSets ? ` (tuần giảm tải, gốc ${esc(it._tpOrigSets)})` : ""}${lastTxt ? " · " + esc(lastTxt) : ""}</small></div>
          ${!c.timed ? `<button type="button" class="icon-btn tp-ss-hist" data-hist="${k}" aria-label="Lịch sử ${esc(c.meta.name)}"><span class="material-symbols-rounded">show_chart</span></button>` : ""}
        </div>
        ${!tp.deload && c.prog.msg && !(tp.ret && tp.ret[it.uid]) ? `<div class="set-up ${c.prog.delta<0?'down':''}"><span class="material-symbols-rounded">${c.prog.delta<0?'trending_down':'trending_up'}</span><span>${c.prog.msg}</span></div>` : ""}
        ${prefillNotesHTML(s, it, c)}
        ${amrapNoteHTML(it, am, rows.length)}
        <div class="set-table">
          <div class="set-head"><span>Hiệp</span>${c.timed ? `<span style="flex:2">Mục tiêu</span>` : `<span>Kg</span><span>Lần</span>${smp ? "" : `<span class="rpe-h" title="Độ nặng cảm nhận (RPE 1–10)">RPE</span>`}`}<span></span></div>
          ${rows.map((r, i)=>`
          <div class="set-row ${r.done?'done':''} ${am.includes(i)?'tp-amrap':''} ${cur && cur.k===k && cur.r===i ? 'tp-cur' : ''}" data-tp-row="${k}:${i}">
            <b>${i+1}${am.includes(i)?"+":""}</b>
            ${c.timed ? `<span style="flex:2" class="small-note">${esc(String(it.reps))}</span>`
              : `<input type="number" inputmode="decimal" min="0" max="500" step="0.5" value="${esc(r.kg)}" data-tp-kg="${k}:${i}" placeholder="kg" aria-label="Kg hiệp ${i+1}">
                 <input type="number" inputmode="numeric" min="0" max="200" value="${esc(r.reps)}" data-tp-reps="${k}:${i}" placeholder="${am.includes(i) ? (hint ? "≥"+hint : "tối đa") : "lần"}" aria-label="Số lần hiệp ${i+1}">
                 ${smp ? "" : `<select class="rpe" data-tp-rpe="${k}:${i}" aria-label="Độ nặng cảm nhận (RPE) hiệp ${i+1}"><option value="">–</option>${[6,7,7.5,8,8.5,9,9.5,10].map(v=>`<option ${String(r.rpe)===String(v)?'selected':''}>${v}</option>`).join("")}</select>`}`}
            <button type="button" class="set-check" data-tp-done="${k}:${i}" aria-label="Xong hiệp ${i+1} ${esc(c.meta.name)}"><span class="material-symbols-rounded">check</span></button>
          </div>`).join("")}
        </div>
        ${am.length ? `<div class="tp-am-est" data-tp-est="${k}" aria-live="polite"></div>` : ""}
        <details class="set-guide tp-ss-media" data-media="${k}"><summary>Video & kỹ thuật</summary><div class="tp-ss-vid" id="tp-ss-vid-${k}"></div><p>${esc(c.meta.guide||"")}</p></details>
      </section>`; }).join("")}
    </div>
    ${!smp && ctxs.some(c=> !c.timed) ? `<p class="small-note tp-rpe-note" style="margin-top:4px;">RPE = độ nặng cảm nhận (1–10): 8 ≈ còn 2 lần nữa, 9 ≈ còn 1, 10 = hết sức.</p>` : ""}
    <div class="set-rest" id="set-rest" hidden><span class="material-symbols-rounded">timer</span><b id="rest-num">0</b><small>giây nghỉ sau vòng</small><button id="rest-plus">+15s</button><button id="rest-skip">Bỏ qua</button></div>
    <button class="btn btn-primary btn-block" id="tp-ss-done" style="margin-top:12px;"><span class="material-symbols-rounded">check</span>${isLastStep ? `Xong ${kind.toLowerCase()} — kết thúc buổi` : `Xong ${kind.toLowerCase()} — bài tiếp`}</button>
    <button class="btn btn-ghost btn-block" id="tp-ss-skip" style="margin-top:6px;">Bỏ qua nhóm này</button>
  `);
  bindSbar(s);
  const sheet = document.getElementById("sheet-content");
  const clamp = (v,min,max)=> Math.min(max, Math.max(min, num(v)));
  const at = (attr, el)=> el.getAttribute(attr).split(":").map(Number);
  const updEst = ()=> items.forEach((it, k)=>{ const el = sheet.querySelector(`[data-tp-est="${k}"]`); if(el) el.innerHTML = amrapEstimate(it, ctxs[k], rowsArr[k]); });
  const paintCursor = ()=>{
    const c = groupCursor(rowsArr);
    sheet.querySelectorAll(".set-row.tp-cur").forEach(x=> x.classList.remove("tp-cur"));
    const rd = document.getElementById("tp-round"); if(rd) rd.textContent = c ? c.r+1 : rounds;
    if(c){ const row = sheet.querySelector(`[data-tp-row="${c.k}:${c.r}"]`); if(row){ row.classList.add("tp-cur"); return row; } }
    return null;
  };
  sheet.querySelectorAll("[data-tp-kg]").forEach(inp=> inp.addEventListener("change", ()=>{ const [k,i] = at("data-tp-kg", inp); const v = clamp(inp.value,0,500); inp.value = v; rowsArr[k][i].kg = v;
    fillDown(rowsArr[k], i, v, (j, vv)=>{ const n = sheet.querySelector(`[data-tp-kg="${k}:${j}"]`); if(n) n.value = vv; });   // QT-01: tự chép kg xuống hiệp sau còn trống
    updEst(); }));
  sheet.querySelectorAll("[data-tp-reps]").forEach(inp=>{
    const h = ()=>{ const [k,i] = at("data-tp-reps", inp); if(inp.value === ""){ rowsArr[k][i].reps = ""; updEst(); return; } const v = Math.round(clamp(inp.value,0,200)); rowsArr[k][i].reps = v; updEst(); };
    inp.addEventListener("input", h); inp.addEventListener("change", ()=>{ h(); if(inp.value !== "") inp.value = Math.round(clamp(inp.value,0,200)); });
  });
  sheet.querySelectorAll("[data-tp-rpe]").forEach(sel=> sel.addEventListener("change", ()=>{ const [k,i] = at("data-tp-rpe", sel); rowsArr[k][i].rpe = sel.value; }));
  sheet.querySelectorAll("[data-tp-done]").forEach(b=> b.addEventListener("click", ()=>{
    const [k,i] = at("data-tp-done", b); const r = rowsArr[k][i]; const it = items[k];
    if(!r.done && !ctxs[k].timed && amrapRows(it, rowsArr[k].length).includes(i)){
      const inp = sheet.querySelector(`[data-tp-reps="${k}:${i}"]`); const v = num(inp && inp.value);
      if(!v){ toast("Nhập số lần thực tế bạn làm được ở hiệp AMRAP", "edit"); if(inp) inp.focus(); return; }
      r.reps = Math.round(v);
    }
    r.done = !r.done;
    b.closest(".set-row").classList.toggle("done", r.done);
    const next = paintCursor();
    if(!r.done) return;
    const roundDone = rowsArr.every(rows=> !rows[i] || rows[i].done);
    const remaining = rowsArr.some(rows=> rows.some(x=> !x.done));
    if(roundDone && remaining && restSec > 0){ startSetRest(restSec); const rb = document.getElementById("set-rest"); if(rb && rb.scrollIntoView) rb.scrollIntoView({ block:"nearest", behavior:"smooth" }); }
    else if(!roundDone && next){ stopSetRest(); if(next.scrollIntoView) next.scrollIntoView({ block:"center", behavior:"smooth" }); }
  }));
  sheet.querySelectorAll("[data-hist]").forEach(b=> b.addEventListener("click", ()=>{ const c = ctxs[Number(b.dataset.hist)]; openExerciseHistory(c.key, c.meta.name, ()=> renderSessionStep()); }));
  sheet.querySelectorAll("[data-media]").forEach(d=> d.addEventListener("toggle", ()=>{
    if(!d.open || d.dataset.mounted) return; d.dataset.mounted = "1";
    const k = Number(d.dataset.media), it = items[k], meta = ctxs[k].meta, host = document.getElementById("tp-ss-vid-"+k); if(!host) return;
    try{
      if(it.clipId && typeof mediaVideoHTML === "function"){ host.innerHTML = mediaVideoHTML(it.clipId, "tp-ss-video-"+k, { maxHeight:"30vh" }); mountClipVideo("#tp-ss-video-"+k, it.clipId); }
      else if(typeof videoBlockHTML === "function" && typeof mountVideoBlock === "function"){ const vb = videoBlockHTML(); host.innerHTML = vb.html; mountVideoBlock(vb.id, typeof videoQueryFor === "function" ? videoQueryFor(meta) : meta.name, { name: meta.name, stock: it.stock, onSave: st=>{ it.stock = st; save(); } }); }
      else if(meta.img){ host.innerHTML = `<img src="${esc(meta.img)}" alt="" style="width:100%;border-radius:14px;">`; }
    }catch(e){}
  }));
  updEst();
  document.getElementById("tp-ss-done").addEventListener("click", ()=>{
    let any = rowsArr.some(rows=> rows.some(r=> r.done));
    if(!any){
      // QT-01: báo rõ số hiệp chưa có kg ở bài có tạ (app sẽ lấy kg hiệp trước / buổi trước, không lưu 0 kg)
      const noKg = items.reduce((a, it, k)=>{ if(ctxs[k].timed) return a; const L = rowsArr[k]; const weighted = L.some(r=> num(r.kg) > 0) || Math.max(0, ...((ctxs[k].last && ctxs[k].last.sets) || []).map(x=> num(x.kg))) > 0; return a + (weighted ? L.filter(r=> !(num(r.kg) > 0)).length : 0); }, 0);
      if(!confirm(`Bạn chưa đánh dấu hiệp nào. Ghi nhận tất cả hiệp của ${kind.toLowerCase()} như đang hiển thị?${noKg ? `\n${noKg} hiệp chưa có kg — app sẽ lấy kg của hiệp trước.` : ""}`)) return;
      rowsArr.forEach(rows=> rows.forEach(r=>{ r.done = true; r._bulk = true; }));   // integrator (FIX-core vòng 2 #4): như app.js — buổi < 3 phút chỉ bấm cả loạt không tính
    }
    for(let k = 0; k < items.length; k++){
      if(ctxs[k].timed) continue;
      const bad = amrapRows(items[k], rowsArr[k].length).find(i=> rowsArr[k][i].done && !num(rowsArr[k][i].reps));
      if(bad !== undefined){ toast(`${letter}${k+1}: hiệp ${bad+1} là AMRAP — nhập số lần thật trước khi lưu`, "edit"); const inp = sheet.querySelector(`[data-tp-reps="${k}:${bad}"]`); if(inp) inp.focus(); if(!any) rowsArr.forEach(rows=> rows.forEach(r=>{ r.done = false; delete r._bulk; })); return; }
    }
    items.forEach((it, k)=>{
      const c = ctxs[k], doneRows = rowsArr[k].filter(r=> r.done);
      if(!doneRows.length) return;
      let keep = doneRows.map(r=>({ kg: num(r.kg), reps: c.timed ? 0 : num(r.reps), rpe: r.rpe ? Number(r.rpe) : undefined }));
      if(!c.timed){ keep = fillBlankKg(c.key, keep); doneRows.forEach((r, j)=>{ if(!(num(r.kg) > 0) && keep[j].kg > 0) r.kg = keep[j].kg; }); }
      if(s.isToday){ tp.ctxItem = it; try{ recordExerciseResult(c.key, c.meta.name, it.reps, keep, c.timed); } finally { tp.ctxItem = null; } }
      s.completed.push(it.uid);
    });
    stopSetRest(); save();
    s.idx = lastI + 1; renderSessionStep();
  });
  document.getElementById("tp-ss-skip").addEventListener("click", ()=>{ stopSetRest(); s.idx = lastI + 1; renderSessionStep(); });
  return true;
}

/* ---------------------------------------------------------------------
   11. GHI NHẬN KẾT QUẢ: deload không làm hỏng tiến trình · AMRAP & kỷ lục số lần
   --------------------------------------------------------------------- */
function afterRecord(s, item, key, name){
  const rows = (s.sets||{})[item.uid] || [];
  if(isTimedReps(item.reps)) return;
  const idx = amrapRows(item, rows.length); if(!idx.length) return;
  /* R3-CORE-16: buổi qua nửa đêm — ghi theo ngày chốt lúc bắt đầu (session.date, QT-07) cho khớp setHist / nhật ký */
  const st = store(); const today = (typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) ? s.date : dstr(new Date());
  const L = st.amrap[key] = (st.amrap[key] || []).filter(x=> x.date !== today);
  idx.forEach(i=>{
    const r = rows[i]; if(!r || !r.done) return;
    const kg = num(r.kg), reps = Math.round(num(r.reps)); if(!reps) return;
    const same = L.filter(x=> num(x.kg) >= kg - 0.01);      // chỉ so với các lần cùng mức tạ trở lên
    const prev = same.reduce((a,x)=> Math.max(a, num(x.reps)), 0);
    L.push({ date: today, kg, reps, e1rm: kg > 0 ? r1(e1rm(kg, reps)) : 0 });
    if(same.length && reps > prev){
      s._tp.prs.push({ name, text: kg > 0 ? `${reps} lần với ${kg} kg (kỷ lục số lần)` : `${reps} lần (kỷ lục số lần)` });
      toast(`Kỷ lục số lần: ${name} — ${reps} lần`, "military_tech");
    }
  });
  if(L.length > 60) st.amrap[key] = L.slice(-60);
}

/* ---------------------------------------------------------------------
   12. TỔNG KẾT BUỔI, NHẬT KÝ, THẺ CHIA SẺ
   --------------------------------------------------------------------- */
function buildSummary(s){
  const tp = s._tp || {};
  const now = Date.now();
  const plan = state.plans && state.plans[tp.planId];
  const day = plan && plan.days && plan.days[s.dayKey];
  let vol = 0, sets = 0;
  const exercises = [];
  s.items.forEach(it=>{
    const rows = (s.sets||{})[it.uid]; if(!rows) return;
    const done = rows.filter(r=> r.done); if(!done.length) return;
    let v = 0; done.forEach(r=> v += num(r.kg) * num(r.reps));
    vol += v;
    if(!s.completed.includes(it.uid)) return;
    sets += done.length;
    const meta = getExerciseMeta(it), timed = isTimedReps(it.reps);
    let best = null;
    if(!timed) done.forEach(r=>{ const e = e1rm(r.kg, r.reps); if(!best || e > best.e || (e === best.e && num(r.reps) > best.reps)) best = { kg:num(r.kg), reps:num(r.reps), e }; });
    exercises.push({ key: exKey(it), name: meta.name, muscle: meta.muscle, sets: done.length, hard: hardSets(done), timed, vol: Math.round(v),
                     best: best ? { kg: best.kg, reps: best.reps } : null });
  });
  // bài tính giờ (plank, cardio) vẫn được tính là đã xong dù không có hàng nào "done" nếu người dùng bấm Xong → đã đánh dấu tất cả
  const prs = (s.prs||[]).map(p=> ({ name: p.name, text: `~${p.e1rm} kg 1RM ước tính` })).concat(tp.prs || []);
  // QT-07: buổi qua nửa đêm ghi vào ngày CHỐT lúc bắt đầu (session.date của app.js) — khớp workoutLog / setHist / Thành tích
  const sDate = (typeof s.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) ? s.date : dstr(new Date());
  return {
    id: "tp" + now, sid: s.sid || null, date: sDate, dayKey: s.dayKey, makeup: !!s.makeup, planId: tp.planId || null,
    planName: plan ? plan.name : "", title: s._quick ? "Buổi nhanh 20 phút" : (day ? day.title : ""),
    startedAt: tp.startedAt || now, endedAt: now, dur: tp.startedAt ? Math.round((now - tp.startedAt)/1000) : 0,
    volume: Math.round(vol), sets, completed: s.completed.length, total: s.items.length,
    exercises, prs, week: tp.week || 0, weeks: tp.weeks || 0, deload: !!tp.deload, note: (tp.note||"").trim(), isToday: !!s.isToday,
  };
}
function saveLog(sum){
  const st = store();
  const e = Object.assign({}, sum); delete e.isToday;
  st.log.push(e);
  if(st.log.length > 300) st.log = st.log.slice(-300);
  save();
  return e;
}
function finishDecorate(sum, entry){
  const sheet = document.getElementById("sheet-content"); if(!sheet) return;
  const xong = Array.from(sheet.querySelectorAll("button.btn-primary")).pop();
  const html = `
  <div class="tp-fin">
    <div class="stat-grid tp-fin-stats">
      <div class="stat-box"><div class="num">${fmtClock(sum.dur*1000)}</div><div class="cap">Thời gian</div></div>
      <div class="stat-box"><div class="num">${sum.sets}</div><div class="cap">Hiệp đã tập</div></div>
      <div class="stat-box"><div class="num">${sum.volume ? viNum(sum.volume) : "–"}</div><div class="cap">Khối lượng (kg)</div></div>
    </div>
    ${sum.week ? `<p class="small-note tp-fin-wk">Chu kỳ: tuần ${sum.week}/${sum.weeks}${sum.deload ? " · tuần giảm tải — tạ & hiệp nhẹ là đúng kế hoạch" : ""}</p>` : ""}
    ${(sum.prs||[]).filter(p=> /kỷ lục số lần/.test(p.text)).length ? `<div class="pr-list">${sum.prs.filter(p=> /kỷ lục số lần/.test(p.text)).map(p=>`<div><span class="material-symbols-rounded">military_tech</span> <b>${esc(p.name)}</b> — ${esc(p.text)}</div>`).join("")}</div>` : ""}
    ${entry ? `<div class="field tp-fin-note"><label for="tp-fin-note">Ghi chú buổi tập</label><textarea id="tp-fin-note" rows="3" maxlength="600" placeholder="Cảm giác, giấc ngủ, chỗ đau mỏi, điều chỉnh lần sau…">${esc(sum.note)}</textarea></div>
    <button class="btn btn-outline btn-block" id="tp-share-open"><span class="material-symbols-rounded">share</span>Tạo thẻ tổng kết để chia sẻ</button>` : ""}
  </div>`;
  if(xong) xong.insertAdjacentHTML("beforebegin", html); else sheet.insertAdjacentHTML("beforeend", html);
  const ta = document.getElementById("tp-fin-note");
  let tmr = null;
  if(ta) ta.addEventListener("input", ()=>{ sum.note = ta.value.slice(0,600).trim(); if(entry){ entry.note = sum.note; clearTimeout(tmr); tmr = setTimeout(save, 400); } });
  const sb = document.getElementById("tp-share-open");
  if(sb) sb.addEventListener("click", ()=>{ if(entry) save(); openShareCard(entry || sum, ()=> reopenFinish(sum, entry)); });
}
function reopenFinish(sum, entry){
  openSheet(`
    <div style="text-align:center;padding:16px 0 4px;">
      <span class="material-symbols-rounded" style="font-size:56px;color:var(--success);">military_tech</span>
      <h3 style="font-size:22px;margin-top:10px;">Hoàn thành buổi tập!</h3>
      <p class="small-note" style="margin-top:6px;">${sum.completed}/${sum.total} bài tập đã hoàn thành${sum.isToday ? " · Đã lưu vào nhật ký" : " · Chế độ xem trước, chưa lưu"}</p>
      <button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="closeSheet();renderWorkoutScreen();">Xong</button>
    </div>`);
  finishDecorate(sum, entry);
}

/* ---- Thẻ chia sẻ 1080×1350 ---- */
const CARD_W = 1080, CARD_H = 1350;
const FONT = `"Inter Tight","Inter",-apple-system,"Segoe UI",Roboto,Arial,sans-serif`;
function rr(ctx, x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r); ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath(); }
function fit(ctx, text, maxW){
  text = String(text||""); if(ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while(lo < hi){ const mid = (lo+hi+1) >> 1; if(ctx.measureText(text.slice(0,mid) + "…").width <= maxW) lo = mid; else hi = mid-1; }
  return text.slice(0, lo).trimEnd() + "…";
}
function spaced(ctx, text, x, y, sp){ let cx = x; for(const ch of String(text)){ ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; } return cx; }
function shortName(n){ const s = String(n||"").replace(/\s*\([^)]*\)\s*$/, "").trim(); return s || String(n||""); }
const WD = ["Chủ nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"];
function drawShareCard(canvas, sum){
  canvas.width = CARD_W; canvas.height = CARD_H;
  const c = canvas.getContext("2d"); if(!c) return false;
  // nền navy + quầng sáng mint/coral
  const bg = c.createLinearGradient(0, 0, CARD_W, CARD_H); bg.addColorStop(0, "#0C3140"); bg.addColorStop(.55, "#061A24"); bg.addColorStop(1, "#030E14");
  c.fillStyle = bg; c.fillRect(0, 0, CARD_W, CARD_H);
  const glow = (x, y, r, col)=>{ const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, CARD_W, CARD_H); };
  glow(940, 120, 560, "rgba(94,230,199,.30)"); glow(80, 1300, 620, "rgba(255,122,69,.26)");
  c.strokeStyle = "rgba(255,255,255,.05)"; c.lineWidth = 2;
  for(let i = -CARD_H; i < CARD_W; i += 46){ c.beginPath(); c.moveTo(i, CARD_H); c.lineTo(i + CARD_H*0.55, 0); c.stroke(); }
  c.textBaseline = "alphabetic";
  // logo chữ TapEasy
  c.fillStyle = "#FFFFFF"; c.font = `800 64px ${FONT}`;
  const lx = spaced(c, "Tap", 72, 132, 2); c.fillStyle = "#5EE6C7"; spaced(c, "Easy", lx + 2, 132, 2);   // "Tap" trắng + "Easy" teal (đổi thương hiệu)
  c.fillStyle = "#FF7A45"; c.beginPath(); c.arc(72 + 6, 160, 6, 0, Math.PI*2); c.fill();
  c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(92, 157, 190, 4);
  // ngày
  const d = parseD(sum.date || dstr(new Date()));
  c.textAlign = "right"; c.fillStyle = "rgba(255,255,255,.75)"; c.font = `600 32px ${FONT}`;
  c.fillText(`${WD[d.getDay()]} · ${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`, CARD_W - 72, 124);
  if(sum.week){ c.fillStyle = sum.deload ? "#FFB08A" : "#9AF1DD"; c.font = `700 28px ${FONT}`; c.fillText(`TUẦN ${sum.week}/${sum.weeks}${sum.deload ? " · GIẢM TẢI" : ""}`, CARD_W - 72, 166); }
  c.textAlign = "left";
  // tiêu đề (tự thu nhỏ chữ khi tên buổi dài)
  c.fillStyle = "#5EE6C7"; c.font = `700 30px ${FONT}`; spaced(c, "HOÀN THÀNH BUỔI TẬP", 72, 276, 4);
  const title = (sum.title || "Buổi tập").toUpperCase();
  let fs = 92; c.font = `800 ${fs}px ${FONT}`;
  while(fs > 60 && c.measureText(title).width > CARD_W - 144){ fs -= 4; c.font = `800 ${fs}px ${FONT}`; }
  c.fillStyle = "#FFFFFF"; c.fillText(fit(c, title, CARD_W - 144), 72, 374);
  c.fillStyle = "rgba(255,255,255,.62)"; c.font = `500 34px ${FONT}`;
  c.fillText(fit(c, sum.planName || "", CARD_W - 144), 72, 428);
  // ô chỉ số 2×2
  const tiles = [
    ["TỔNG KHỐI LƯỢNG", sum.volume ? viNum(sum.volume) : "—", sum.volume ? "kg" : ""],
    ["THỜI GIAN", fmtClock(num(sum.dur)*1000), ""],
    ["BÀI TẬP", `${sum.completed}/${sum.total}`, ""],
    ["SỐ HIỆP", String(sum.sets||0), ""],
  ];
  const tw = (CARD_W - 144 - 24)/2, th = 160;
  tiles.forEach((t, i)=>{
    const x = 72 + (i%2)*(tw + 24), y = 478 + Math.floor(i/2)*(th + 20);
    c.fillStyle = "rgba(255,255,255,.08)"; rr(c, x, y, tw, th, 30); c.fill();
    c.strokeStyle = "rgba(255,255,255,.16)"; c.lineWidth = 2; rr(c, x, y, tw, th, 30); c.stroke();
    c.fillStyle = "rgba(255,255,255,.62)"; c.font = `700 24px ${FONT}`; spaced(c, t[0], x + 30, y + 48, 2);
    c.fillStyle = i === 0 ? "#FF7A45" : "#FFFFFF"; c.font = `800 68px ${FONT}`;
    const val = fit(c, t[1], tw - 110); c.fillText(val, x + 30, y + 128);
    if(t[2]){ const w = c.measureText(val).width; c.fillStyle = "rgba(255,255,255,.62)"; c.font = `600 32px ${FONT}`; c.fillText(t[2], x + 30 + w + 12, y + 128); }
  });
  // kỷ lục + bài nổi bật — chỉ vẽ những dòng vừa khung (dòng cuối ≤ Y_MAX, trên chân thẻ)
  const Y_MAX = 1192;
  let y = 892;
  const prs = (sum.prs||[]).slice(0, 3);
  if(prs.length){
    c.fillStyle = "#FFB08A"; c.font = `700 28px ${FONT}`; spaced(c, "KỶ LỤC MỚI", 72, y, 4);
    prs.forEach(p=>{
      y += 58;
      c.fillStyle = "#FF7A45"; c.beginPath(); c.arc(92, y - 11, 18, 0, Math.PI*2); c.fill();
      c.fillStyle = "#061A24"; c.font = `800 18px ${FONT}`; c.textAlign = "center"; c.fillText("PR", 92, y - 4); c.textAlign = "left";
      c.fillStyle = "#FFFFFF"; c.font = `700 34px ${FONT}`; c.fillText(fit(c, shortName(p.name), 500), 128, y);
      c.fillStyle = "rgba(255,255,255,.72)"; c.font = `500 30px ${FONT}`; c.textAlign = "right"; c.fillText(fit(c, p.text, 390), CARD_W - 72, y); c.textAlign = "left";
    });
    y += 66;
  }
  const exs = (sum.exercises||[]).slice().sort((a,b)=> (b.vol - a.vol) || (b.sets - a.sets));
  const room = Math.floor((Y_MAX - (y + 54)) / 50) + 1;          // số dòng bài còn vừa
  if(exs.length && room >= Math.min(2, exs.length)){
    c.fillStyle = "#9AF1DD"; c.font = `700 28px ${FONT}`; spaced(c, "BÀI NỔI BẬT", 72, y, 4); y += 4;
    const kgTxt = (v)=> String(v).replace(".", ",");
    exs.slice(0, Math.min(5, room)).forEach(x=>{
      y += 50;
      c.fillStyle = "#FFFFFF"; c.font = `600 32px ${FONT}`; c.fillText(fit(c, shortName(x.name), 560), 72, y);
      c.fillStyle = "rgba(255,255,255,.72)"; c.font = `500 30px ${FONT}`; c.textAlign = "right";
      c.fillText(x.best && x.best.kg ? `${kgTxt(x.best.kg)} kg × ${x.best.reps} · ${x.sets} hiệp` : x.best && x.best.reps ? `${x.best.reps} lần · ${x.sets} hiệp` : `${x.sets} hiệp`, CARD_W - 72, y); c.textAlign = "left";
    });
  }
  // chân thẻ
  c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(72, CARD_H - 112, CARD_W - 144, 2);
  c.fillStyle = "rgba(255,255,255,.7)"; c.font = `600 28px ${FONT}`; c.fillText("Tập cùng TapEasy · Huấn luyện & dinh dưỡng thông minh", 72, CARD_H - 62);
  c.fillStyle = "#5EE6C7"; rr(c, CARD_W - 72 - 120, CARD_H - 88, 120, 36, 18); c.fill();
  c.fillStyle = "#061A24"; c.font = `800 22px ${FONT}`; c.textAlign = "center"; c.fillText("TapEasy", CARD_W - 72 - 60, CARD_H - 62); c.textAlign = "left";
  return true;
}
function shareText(sum){
  return `Vừa hoàn thành buổi ${sum.title || "tập"}${sum.week ? ` (tuần ${sum.week}/${sum.weeks})` : ""}: ${sum.completed}/${sum.total} bài · ${sum.sets} hiệp · ${sum.volume ? viNum(sum.volume) + " kg" : ""} · ${fmtClock(num(sum.dur)*1000)}. Tập cùng TapEasy!`;
}
function canvasBlob(canvas){ return new Promise(res=>{ try{ canvas.toBlob(b=> res(b), "image/png"); }catch(e){ res(null); } }); }
async function openShareCard(sum, onBack){
  openSheet(`
    <div class="sheet-header">${onBack ? `<button class="icon-btn" id="tp-sc-back" aria-label="Quay lại"><span class="material-symbols-rounded">arrow_back</span></button>` : ""}<h3 style="flex:1;margin-left:8px;font-size:17px;">Thẻ tổng kết</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <div class="tp-share-wrap"><canvas id="tp-share-canvas" class="tp-share-canvas" width="1080" height="1350" aria-label="Thẻ tổng kết buổi tập"></canvas></div>
    <div class="tp-share-actions">
      <button class="btn btn-outline" id="tp-sc-save"><span class="material-symbols-rounded">download</span>Lưu ảnh</button>
      <button class="btn btn-primary" id="tp-sc-share"><span class="material-symbols-rounded">share</span>Chia sẻ</button>
    </div>
    <p class="small-note" style="text-align:center;margin-top:8px;">Ảnh 1080×1350 — vừa khung bài đăng Instagram / Facebook / Zalo.</p>
    <div id="tp-sc-fallback"></div>
  `);
  const back = document.getElementById("tp-sc-back"); if(back) back.addEventListener("click", onBack);
  const cv = document.getElementById("tp-share-canvas");
  try{ if(document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load(`800 64px "Inter Tight"`), document.fonts.load(`600 32px "Inter"`)]), new Promise(r=> setTimeout(r, 900))]); }catch(e){}
  drawShareCard(cv, sum);
  const fname = `tapeasy-${sum.date || dstr(new Date())}.png`;
  const showFallback = ()=>{
    let url = ""; try{ url = cv.toDataURL("image/png"); }catch(e){}
    const fb = document.getElementById("tp-sc-fallback"); if(!fb || !url) return;
    fb.innerHTML = `<p class="small-note" style="margin-top:10px;">Nhấn giữ ảnh bên dưới và chọn <b>Lưu ảnh</b>.</p><img src="${url}" alt="Thẻ tổng kết" style="width:100%;border-radius:16px;margin-top:6px;">`;
  };
  const native = (()=>{ try{ return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }catch(e){ return false; } })();
  document.getElementById("tp-sc-save").addEventListener("click", async ()=>{
    if(native){ showFallback(); return; }
    const blob = await canvasBlob(cv);
    if(!blob){ showFallback(); return; }
    try{
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 4000);
      toast("Đã lưu ảnh thẻ tổng kết", "download");
    }catch(e){ showFallback(); }
  });
  document.getElementById("tp-sc-share").addEventListener("click", async ()=>{
    const text = shareText(sum);
    const blob = await canvasBlob(cv);
    try{
      if(blob && typeof File === "function" && navigator.canShare){
        const file = new File([blob], fname, { type:"image/png" });
        if(navigator.canShare({ files:[file] })){ await navigator.share({ files:[file], title:"TapEasy", text }); return; }
      }
      if(navigator.share){ await navigator.share({ title:"TapEasy", text }); showFallback(); return; }
    }catch(e){ if(e && /abort|cancel/i.test(e.name + " " + e.message)) return; }
    showFallback();
    try{ await navigator.clipboard.writeText(text); toast("Đã chép nội dung — lưu ảnh rồi đăng kèm nhé", "content_copy"); }catch(e){ toast("Nhấn giữ ảnh để lưu rồi chia sẻ", "image"); }
  });
}

/* ---- Nhật ký buổi tập ---- */
function openLogSheet(){
  const L = store().log.slice().reverse().slice(0, 40);
  openSheet(`
    <div class="sheet-header"><h3>Nhật ký buổi tập</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    ${L.length ? `<div class="tp-log">${L.map(e=>`
      <div class="tp-log-item" data-log="${esc(e.id)}">
        <div class="tp-log-h"><b>${ddmm(e.date)} · ${esc(e.title || "Buổi tập")}</b>${e.week ? `<span class="tp-wk ${e.deload?'tp-dl':''}">T${e.week}/${e.weeks}</span>` : ""}</div>
        <small>${fmtDur(e.dur)} · ${e.sets} hiệp · ${e.volume ? viNum(e.volume)+" kg" : "—"} · ${e.completed}/${e.total} bài${(e.prs||[]).length ? ` · ${(e.prs||[]).length} kỷ lục` : ""}</small>
        <p class="tp-log-note ${e.note?'':'empty'}">${e.note ? esc(e.note) : "Chưa có ghi chú"}</p>
        <div class="tp-log-act"><button class="btn btn-ghost btn-sm" data-log-note="${esc(e.id)}"><span class="material-symbols-rounded">edit_note</span>Ghi chú</button><button class="btn btn-ghost btn-sm" data-log-card="${esc(e.id)}"><span class="material-symbols-rounded">share</span>Thẻ chia sẻ</button></div>
      </div>`).join("")}</div>`
      : `<p class="empty-hint">Chưa có buổi tập nào được ghi. Hoàn thành một buổi để xem thời gian, khối lượng và ghi chú tại đây.</p>`}
  `);
  const find = (id)=> store().log.find(x=> x.id === id);
  document.querySelectorAll("[data-log-card]").forEach(b=> b.addEventListener("click", ()=>{ const e = find(b.dataset.logCard); if(e) openShareCard(e, openLogSheet); }));
  document.querySelectorAll("[data-log-note]").forEach(b=> b.addEventListener("click", ()=>{
    const e = find(b.dataset.logNote); if(!e) return;
    const box = b.closest(".tp-log-item"); const p = box.querySelector(".tp-log-note");
    if(box.querySelector("textarea")) return;
    p.outerHTML = `<textarea class="tp-log-ta" rows="3" maxlength="600" placeholder="Ghi chú cho buổi này…">${esc(e.note||"")}</textarea>`;
    const ta = box.querySelector("textarea"); ta.focus();
    ta.addEventListener("blur", ()=>{ e.note = ta.value.slice(0,600).trim(); save(); const np = document.createElement("p"); np.className = "tp-log-note" + (e.note ? "" : " empty"); np.textContent = e.note || "Chưa có ghi chú"; ta.replaceWith(np); });
  }));
}

/* ---------------------------------------------------------------------
   13. MÀN TẬP LUYỆN — thẻ chu kỳ, nhóm superset, nhãn AMRAP, đồng hồ tạm dừng
   --------------------------------------------------------------------- */
function segHTML(info){
  const segs = [];
  for(let w = 1; w <= info.total; w++){
    const cls = [w < info.week ? "done" : "", w === info.week ? "cur" : "", isDeloadWeek(info.c, w) ? "dl" : ""].filter(Boolean).join(" ");
    segs.push(`<i class="${cls}" title="Tuần ${w}${isDeloadWeek(info.c, w) ? " · giảm tải" : ""}"></i>`);
  }
  return `<div class="tp-cyc-bar" aria-hidden="true">${segs.join("")}</div>`;
}
function cycleCardHTML(plan, info){
  const c = info.c;
  if(info.done){
    const res = cycleResults(plan.id).slice(0, 3), adh = cycleAdherence(plan.id);
    const nx = c.tplId ? nextTemplate(c.tplId, (state.profile||{}).gender) : null;
    return `<div class="card tp-cycle tp-cyc-done" id="tp-cycle">
      <div class="tp-cyc-top"><div><small>CHU KỲ ${c.weeks} TUẦN · VÒNG ${c.round||1}</small><b>Hoàn thành!</b></div><span class="material-symbols-rounded tp-cyc-ic">military_tech</span></div>
      ${adh ? `<p class="small-note">Chuyên cần: <b>${adh.done}/${adh.planned}</b> buổi (${adh.pct}%).</p>` : ""}
      ${res.length ? `<div class="tp-cyc-res">${res.map(x=>`<div class="tb-row"><span>${esc(shortName(x.name))}</span><b>${Math.round(x.before)} → ${Math.round(x.now)} kg</b><small class="${x.pct>=0?'up':'down'}">${x.pct>=0?"+":""}${Math.round(x.pct)}%</small></div>`).join("")}<p class="small-note">1RM ước tính đầu chu kỳ → tốt nhất trong chu kỳ.</p></div>` : ""}
      <p class="small-note" style="margin:8px 0 10px;">Bước tiếp theo: lặp lại chu kỳ với mức tạ mới bạn đã đạt, hoặc chuyển sang giáo án cao hơn.</p>
      <button class="btn btn-primary btn-block" id="tp-cyc-repeat"><span class="material-symbols-rounded">restart_alt</span>Lặp lại chu kỳ với tạ mới</button>
      ${nx ? `<button class="btn btn-outline btn-block" id="tp-cyc-next" data-tpl="${esc(nx.id)}" style="margin-top:8px;"><span class="material-symbols-rounded">upgrade</span>Nâng cấp: ${esc(nx.name)}</button>`
           : `<button class="btn btn-outline btn-block" id="tp-cyc-browse" style="margin-top:8px;"><span class="material-symbols-rounded">school</span>Chọn giáo án nâng cấp</button>`}
      <button class="btn btn-ghost btn-block" id="tp-cyc-end" style="margin-top:4px;">Dừng theo dõi chu kỳ</button>
    </div>`;
  }
  if(info.pre){
    return `<div class="card tp-cycle" id="tp-cycle" role="button" tabindex="0">
      <div class="tp-cyc-top"><div><small>CHU KỲ ${info.total} TUẦN · SẮP BẮT ĐẦU</small><b>Tuần làm quen</b></div><span class="material-symbols-rounded tp-cyc-ic">event_repeat</span></div>
      <p class="small-note">Tuần 1 bắt đầu từ T2 ${ddmm(c.startDate)}. Mấy buổi còn lại tuần này: tập nhẹ, học kỹ thuật và tìm mức tạ phù hợp.</p>
    </div>`;
  }
  return `<div class="card tp-cycle ${info.deload?'tp-cyc-dl':''}" id="tp-cycle" role="button" tabindex="0" aria-label="Chu kỳ tập: tuần ${info.week} trên ${info.total}">
    <div class="tp-cyc-top">
      <div><small>CHU KỲ · VÒNG ${info.round}</small><b>Tuần ${info.week}<span>/${info.total}</span></b></div>
      ${info.deload ? `<span class="tp-cyc-tag dl"><span class="material-symbols-rounded">trending_down</span>Tuần giảm tải</span>`
        : info.nextDeload ? `<span class="tp-cyc-tag">Giảm tải: tuần ${info.nextDeload}</span>` : `<span class="tp-cyc-tag">${info.week === info.total ? "Tuần cuối" : "Tập bình thường"}</span>`}
    </div>
    ${segHTML(info)}
    ${info.deload ? `<p class="small-note">Tuần này giảm ~40% số hiệp và ~10% mức tạ, dừng xa thất bại. Mức tạ đã tăng được giữ nguyên cho tuần sau.</p>` : ""}
  </div>`;
}
function wrapGroups(container, rowSel, uidAttr, plan, dayKey){
  const items = (((plan.days||{})[dayKey]||{}).items) || [];
  const groups = groupsFor(plan.id, dayKey, items);
  groups.forEach((g, gi)=>{
    const rows = g.map(i=> container.querySelector(`${rowSel}[${uidAttr}="${cssEsc(items[i].uid)}"]`)).filter(Boolean);
    if(rows.length < 2) return;
    const w = document.createElement("div"); w.className = "tp-ss-wrap";
    const letter = String.fromCharCode(65 + gi);
    w.innerHTML = `<div class="tp-ss-label"><span class="material-symbols-rounded">link</span><b>${groupLabel(rows.length)} ${letter}</b><span>luân phiên · nghỉ sau mỗi vòng</span></div>`;
    rows[0].before(w); rows.forEach((r, k)=>{ w.appendChild(r); const nm = r.querySelector(".name"); if(nm && !nm.querySelector(".tp-ss-idx")) nm.insertAdjacentHTML("afterbegin", `<span class="tp-ss-idx">${letter}${k+1}</span>`); });
  });
  return groups.length;
}
function decorateWorkout(){
  const plan = getActivePlan(); if(!plan) return;
  const scr = document.getElementById("screen-workout"); if(!scr) return;
  const info = cycleInfo(plan.id);
  // tagline hero
  const tag = document.getElementById("workout-tagline");
  if(tag && info && !info.pre && !info.done) tag.textContent = `${plan.tagline || ""} · Tuần ${info.week}/${info.total}${info.deload ? " · Tuần giảm tải" : ""}`.replace(/^ · /, "");
  // pill chu kỳ trong hàng nút
  const chipRow = scr.querySelector(".content > .chip-row");
  if(chipRow && !chipRow.querySelector(".tp-cyc-pill")){
    chipRow.insertAdjacentHTML("beforeend", `<button class="pill tp-cyc-pill" type="button" style="cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">event_repeat</span>&nbsp;Chu kỳ &amp; tuần giảm tải</button><button class="pill tp-log-pill" type="button" style="cursor:pointer;"><span class="material-symbols-rounded" style="font-size:14px;">history</span>&nbsp;Nhật ký buổi tập</button>`);
    chipRow.querySelector(".tp-cyc-pill").addEventListener("click", ()=> openCycleSheet());
    chipRow.querySelector(".tp-log-pill").addEventListener("click", ()=> openLogSheet());
  }
  // QT-05: người mới đang dùng giáo án mặc định "elite" → gợi ý giáo án vừa sức
  try{ recoCard(plan); }catch(e){ console.warn("[training-pro] reco", e); }
  // thẻ chu kỳ
  const old = document.getElementById("tp-cycle"); if(old) old.remove();
  const today = document.getElementById("today-card");
  if(info && today){
    today.insertAdjacentHTML("beforebegin", cycleCardHTML(plan, info));
    const card = document.getElementById("tp-cycle");
    if(info.done){
      card.querySelector("#tp-cyc-repeat").addEventListener("click", ()=>{
        const c = info.c; startCycle(plan.id, { tplId: c.tplId, weeks: c.weeks, deloadEvery: c.deloadEvery, round: (c.round||1) + 1 }); save();
        renderWorkoutScreen(); toast(`Bắt đầu vòng ${(c.round||1)+1} — app giữ mức tạ mới bạn đã đạt`, "restart_alt");
      });
      const nx = card.querySelector("#tp-cyc-next"); if(nx) nx.addEventListener("click", ()=>{ if(typeof openTemplateDetail === "function") openTemplateDetail(nx.dataset.tpl); });
      const br = card.querySelector("#tp-cyc-browse"); if(br) br.addEventListener("click", ()=>{ try{ const lv = (PROGRAM_TEMPLATES.find(t=> t.id === info.c.tplId)||{}).level; const i = LV_ORDER.indexOf(lv); if(typeof tplUI === "object") tplUI.level = LV_ORDER[Math.min(2, i+1)] || "all"; }catch(e){} openTemplateBrowser(); });
      card.querySelector("#tp-cyc-end").addEventListener("click", ()=> confirmDialog("Dừng theo dõi chu kỳ?", "Lịch tập vẫn giữ nguyên, chỉ bỏ đếm tuần và tuần giảm tải.", ()=>{ endCycle(plan.id); save(); renderWorkoutScreen(); }, "Dừng", "event_repeat"));
    } else {
      card.addEventListener("click", ()=> openCycleSheet());
      card.addEventListener("keydown", e=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); openCycleSheet(); } });
      try{ gapBanner(plan, info, card); }catch(e){ console.warn("[training-pro] gap", e); }
    }
  }
  // buổi đang tạm dừng → đồng hồ + nút Tiếp tục
  const s = curSession();
  if(today && s && s._tp && s.paused && !s.finished && s.dayKey === state.selectedDay){
    const btn = document.getElementById("btn-start-session");
    if(btn){
      btn.innerHTML = `<span class="material-symbols-rounded">play_arrow</span>Tiếp tục buổi tập`;
      btn.insertAdjacentHTML("beforebegin", `<div class="tp-paused"><span class="material-symbols-rounded">timer</span>Buổi tập đang tạm dừng · <b data-tp-clock>${fmtClock(Date.now() - s._tp.startedAt)}</b> · đã xong ${s.completed.length}/${s.items.length} bài</div>`);
      ensureTick();
    }
  }
  // danh sách bài: nhóm superset + nhãn AMRAP + deload
  const list = document.getElementById("exercise-list");
  const day = plan.days[state.selectedDay];
  if(list && day && day.items.length){
    const dlThisWeek = !!(info && info.deload);
    day.items.forEach(it=>{
      const row = list.querySelector(`.list-item[data-ex="${cssEsc(it.uid)}"]`); if(!row) return;
      const meta = row.querySelector(".meta"); if(!meta || meta.querySelector(".tp-tag")) return;
      const am = amrapListTag(it);
      if(am) meta.insertAdjacentHTML("beforeend", ` <span class="tp-tag tp-am-tag">${am}</span>`);
      if(dlThisWeek) meta.insertAdjacentHTML("beforeend", ` <span class="tp-tag tp-dl-tag">Giảm tải ${deloadSets(it.sets)} hiệp</span>`);
    });
    wrapGroups(list, ".list-item", "data-ex", plan, state.selectedDay);
  }
  // nút ghép superset ở tiêu đề danh sách
  const cnt = document.getElementById("link-exercise-count");
  if(cnt && cnt.parentElement){
    let b = cnt.parentElement.querySelector(".tp-ss-open");
    if(!b){ cnt.insertAdjacentHTML("beforebegin", `<button type="button" class="tp-ss-open"><span class="material-symbols-rounded">link</span>Siêu hiệp</button>`); b = cnt.parentElement.querySelector(".tp-ss-open"); b.addEventListener("click", ()=>{ const p = getActivePlan(); openSupersetEditor(p.id, state.selectedDay, ()=> renderWorkoutScreen()); }); }
    b.hidden = !(day && day.items.length >= 2);
  }
}

/* ---- QT-13: nghỉ dài giữa chu kỳ → đề nghị lùi chu kỳ, bỏ tuần giảm tải kế tiếp ---- */
function lastTrainDate(){
  let d = "";
  (Array.isArray(state.finishedDates) ? state.finishedDates : []).forEach(x=>{ if(typeof x === "string" && x > d) d = x; });
  store().log.forEach(e=>{ if(e && typeof e.date === "string" && e.date > d) d = e.date; });
  Object.keys(state.workoutLog||{}).forEach(k=>{ const w = state.workoutLog[k]; if(w && w.finishedAt && k > d) d = k; });
  Object.values(state.setLog||{}).forEach(l=>{ if(l && typeof l.date === "string" && l.date > d) d = l.date; });
  return d;
}
function cycleGap(info, now){
  if(!info || info.pre || info.done) return null;
  const last = lastTrainDate(); if(!last || last < info.c.startDate) return null;
  const gap = daysSince(last, now);
  if(gap < 7 || info.c.gapAck === last) return null;
  return { last, gap, weeks: Math.max(1, Math.floor(gap/7)) };
}
/* Lùi chu kỳ: dời ngày bắt đầu N tuần (tuần đã nghỉ không tính), bỏ tuần giảm tải nếu nó rơi vào 2 tuần ngay sau khi quay lại */
function shiftCycle(planId, weeks, now){
  const c = store().cycles[planId]; if(!c) return null;
  c.startDate = addDaysStr(c.startDate, 7*Math.max(0, weeks|0));
  c.overrides = c.overrides || {};
  const info = cycleInfo(planId, now);
  if(info && !info.pre){
    for(let w = Math.max(1, info.week); w <= Math.min(info.total, info.week + 1); w++) if(isDeloadWeek(c, w)) c.overrides[w] = false;
  }
  return c;
}
function gapBanner(plan, info, card){
  const g = cycleGap(info); if(!g) return;
  card.insertAdjacentHTML("beforeend", `<div class="tp-gap" role="group" aria-label="Nghỉ dài giữa chu kỳ">
    <p class="small-note"><b>Bạn đã nghỉ ${esc(g.gap)} ngày.</b> Lùi chu kỳ ${esc(g.weeks)} tuần để không "mất" tuần tập? Thời gian nghỉ đã là hồi phục nên app bỏ tuần giảm tải sắp tới; buổi đầu tiên tạ tự giảm ~10%.</p>
    <div class="tp-gap-act"><button type="button" class="btn btn-primary btn-sm" data-tp-gap="shift">Lùi ${esc(g.weeks)} tuần</button><button type="button" class="btn btn-ghost btn-sm" data-tp-gap="keep">Giữ nguyên</button></div></div>`);
  card.querySelectorAll("[data-tp-gap]").forEach(b=> b.addEventListener("click", (e)=>{
    e.stopPropagation();
    if(b.dataset.tpGap === "shift"){ shiftCycle(plan.id, g.weeks); toast(`Đã lùi chu kỳ ${g.weeks} tuần`, "event_repeat"); }
    const c = store().cycles[plan.id]; if(c) c.gapAck = g.last;
    save(); renderWorkoutScreen();
  }));
}
/* ---- QT-05: giáo án gợi ý cho người mới (giáo án mặc định của app là chương trình 6 buổi cường độ cao) ---- */
function hasHistory(){
  return Object.keys(state.setLog||{}).length > 0 || (Array.isArray(state.finishedDates) && state.finishedDates.length > 0) || store().log.length > 0;
}
function recoCard(plan){
  const old = document.getElementById("tp-reco"); if(old) old.remove();
  if(!plan || !plan.builtin || hasHistory() || store().recoDismissed || typeof tplRecommend !== "function") return;
  const t = tplRecommend(state.profile || {}, state.health || {}); if(!t) return;
  const host = document.getElementById("today-card"); if(!host) return;
  const n = requiredDays(plan).length;
  host.insertAdjacentHTML("beforebegin", `<div class="card tp-reco" id="tp-reco">
    <div class="card-title"><span class="material-symbols-rounded">tips_and_updates</span>Giáo án vừa sức cho người mới</div>
    <p class="small-note">Giáo án đang dùng (<b>${esc(plan.name)}</b>) là giáo án mẫu ${esc(n)} buổi/tuần khá nặng. Nếu bạn mới bắt đầu, nên tập <b>${esc(t.name)}</b> — ${esc(t.perWeek)} buổi/tuần, học kỹ thuật an toàn rồi tăng dần.</p>
    <div class="tp-reco-act">
      <button type="button" class="btn btn-primary btn-sm" data-tp-reco="use"><span class="material-symbols-rounded">check</span>Dùng giáo án gợi ý</button>
      <button type="button" class="btn btn-outline btn-sm" data-tp-reco="pb">Tạo giáo án riêng</button>
      <button type="button" class="btn btn-ghost btn-sm" data-tp-reco="keep">Giữ giáo án hiện tại</button>
    </div></div>`);
  const card = document.getElementById("tp-reco");
  card.querySelectorAll("[data-tp-reco]").forEach(b=> b.addEventListener("click", ()=>{
    const a = b.dataset.tpReco;
    if(a === "use"){ b.disabled = true; if(typeof tplAddToWeek === "function") tplAddToWeek(t); return; }
    if(a === "pb"){ if(typeof openProgramBuilder === "function") openProgramBuilder(); return; }
    store().recoDismissed = Date.now(); save(); card.remove();
  }));
}

/* ---- Sheet cài đặt chu kỳ ---- */
function openCycleSheet(){
  const plan = getActivePlan(); if(!plan) return;
  const info = cycleInfo(plan.id);
  const tpl = (typeof PROGRAM_TEMPLATES !== "undefined" && plan.fromTemplate) ? PROGRAM_TEMPLATES.find(t=> t.id === plan.fromTemplate) : null;
  const c = info ? info.c : null;
  const weeks = c ? c.weeks : (tpl ? tpl.weeks : 8);
  const every = c ? num(c.deloadEvery) : deloadEveryFor(tpl);
  const weekOpts = Array.from({length:13}, (_,i)=> i+4);
  if(weekOpts.indexOf(weeks) < 0) weekOpts.push(weeks);
  const curWeek = info && !info.pre ? Math.min(info.week, weeks) : 1;
  openSheet(`
    <div class="sheet-header"><h3>Chu kỳ tập luyện</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="margin-bottom:10px;">${esc(plan.name)}${c ? ` · bắt đầu T2 ${ddmm(c.startDate)}/${c.startDate.slice(0,4)} · vòng ${c.round||1}` : ""}</p>
    ${info && !info.pre && !info.done ? `<div class="tp-cyc-now"><b>Tuần ${info.week}/${info.total}</b><span>${info.deload ? "Tuần giảm tải" : "Tập bình thường"}</span></div>${segHTML(info)}
      <button class="btn btn-outline btn-block" id="tp-cs-toggle" style="margin-top:10px;"><span class="material-symbols-rounded">${info.deload?'trending_up':'trending_down'}</span>${info.deload ? "Tuần này tập bình thường (bỏ giảm tải)" : "Đổi tuần này thành tuần giảm tải"}</button>` : ""}
    <div class="field-row" style="margin-top:14px;">
      <div class="field"><label for="tp-cs-weeks">Tổng số tuần</label><select id="tp-cs-weeks">${weekOpts.sort((a,b)=>a-b).map(w=>`<option value="${w}" ${w===weeks?'selected':''}>${w} tuần</option>`).join("")}</select></div>
      <div class="field"><label for="tp-cs-every">Tuần giảm tải</label><select id="tp-cs-every">${[[0,"Không"],[4,"Mỗi tuần thứ 4"],[5,"Mỗi tuần thứ 5"],[6,"Mỗi tuần thứ 6"],[8,"Mỗi tuần thứ 8"]].map(([v,l])=>`<option value="${v}" ${v===every?'selected':''}>${l}</option>`).join("")}</select></div>
    </div>
    <div class="field" style="margin-top:10px;"><label for="tp-cs-cur">${c ? "Tuần hiện tại" : "Bắt đầu"}</label>
      <select id="tp-cs-cur">${c ? Array.from({length:weeks}, (_,i)=> i+1).map(w=>`<option value="${w}" ${w===curWeek?'selected':''}>Tuần ${w}</option>`).join("")
        : `<option value="auto">${defaultStart() === mondayStr() ? "Tuần này là tuần 1" : "Tuần 1 bắt đầu từ T2 tuần sau"}</option><option value="1">Tuần này là tuần 1</option><option value="next">T2 tuần sau</option>`}</select></div>
    <button class="btn btn-primary btn-block" id="tp-cs-save" style="margin-top:14px;">${c ? "Lưu thay đổi" : "Bắt đầu theo dõi chu kỳ"}</button>
    ${c ? `<button class="btn btn-ghost btn-block" id="tp-cs-end" style="margin-top:6px;">Dừng theo dõi chu kỳ</button>` : ""}
    <div class="tp-explain">
      <p><b>Tuần giảm tải</b> giữ nguyên bài tập và kỹ thuật nhưng giảm ~40% số hiệp, giảm ~10% mức tạ và dừng xa thất bại (còn 3–4 lần). Khớp, gân và hệ thần kinh hồi phục → tuần sau mạnh hơn.</p>
      <p>App tự áp dụng khi bạn bắt đầu buổi tập trong tuần giảm tải; kết quả tuần đó không làm tụt mức tạ tăng tiến của bạn.</p>
    </div>
  `);
  const tg = document.getElementById("tp-cs-toggle");
  if(tg) tg.addEventListener("click", ()=>{ const cc = info.c; cc.overrides = cc.overrides || {}; cc.overrides[info.week] = !info.deload; save(); closeSheet(); renderWorkoutScreen(); toast(info.deload ? "Tuần này tập bình thường" : "Đã chuyển tuần này thành tuần giảm tải", "event_repeat"); });
  document.getElementById("tp-cs-save").addEventListener("click", ()=>{
    const w = num(document.getElementById("tp-cs-weeks").value) || 8;
    const ev = num(document.getElementById("tp-cs-every").value);
    const cur = document.getElementById("tp-cs-cur").value;
    if(c){
      c.weeks = w; c.deloadEvery = ev;
      const cw = Math.max(1, Math.min(w, num(cur) || 1));
      c.startDate = addDaysStr(mondayStr(), -7*(cw-1));
    } else {
      const start = cur === "1" ? mondayStr() : cur === "next" ? addDaysStr(mondayStr(), 7) : defaultStart();
      startCycle(plan.id, { tpl, tplId: plan.fromTemplate || null, weeks: w, deloadEvery: ev, startDate: start });
    }
    save(); closeSheet(); renderWorkoutScreen(); toast(c ? "Đã cập nhật chu kỳ" : "Đã bắt đầu theo dõi chu kỳ", "event_repeat");
  });
  const en = document.getElementById("tp-cs-end");
  if(en) en.addEventListener("click", ()=>{ endCycle(plan.id); save(); closeSheet(); renderWorkoutScreen(); toast("Đã dừng theo dõi chu kỳ", "event_repeat"); });
}

/* ---- Sheet ghép superset / circuit ---- */
function openSupersetEditor(planId, dayKey, onDone){
  const plan = state.plans[planId]; if(!plan) return;
  const render = ()=>{
    const items = plan.days[dayKey].items;
    const groups = groupsFor(planId, dayKey, items);
    const lab = {}; groups.forEach((g, gi)=> g.forEach((i, k)=> lab[i] = String.fromCharCode(65+gi) + (k+1)));
    openSheet(`
      <div class="sheet-header"><h3>Siêu hiệp &amp; liên hoàn · ${esc((typeof DAY_LABELS !== "undefined" && DAY_LABELS[dayKey]) || dayKey)}</h3><button class="icon-btn" id="tp-se-close" aria-label="Xong"><span class="material-symbols-rounded">close</span></button></div>
      <p class="small-note" style="margin-bottom:12px;">Bấm <b>Ghép</b> giữa hai bài để tập luân phiên: 2 bài = siêu hiệp (superset), 3–${MAX_GROUP} bài = liên hoàn (circuit). Khi tập, app chuyển lần lượt từng bài và chỉ nghỉ sau khi xong một vòng (lấy thời gian nghỉ dài nhất trong nhóm).</p>
      ${items.length < 2 ? `<p class="empty-hint">Cần ít nhất 2 bài trong buổi để ghép.</p>` : `<div class="tp-se">${items.map((it, i)=>{
        const meta = getExerciseMeta(it);
        const link = i < items.length-1 ? isLinked(planId, dayKey, it.uid, items[i+1].uid) : false;
        return `<div class="tp-se-row ${lab[i]?'in':''}"><span class="tp-se-lab">${lab[i] || (i+1)}</span><div class="tp-se-info"><b>${esc(meta.name)}</b><small>${esc(meta.muscle)} · ${esc(it.sets)} × ${esc(String(it.reps))} · nghỉ ${esc(it.restSec)}s</small></div></div>
          ${i < items.length-1 ? `<button type="button" class="tp-se-link ${link?'on':''}" data-link="${i}" aria-pressed="${link}"><span class="material-symbols-rounded">${link?'link':'link_off'}</span>${link ? "Đã ghép — bấm để tách" : "Ghép với bài dưới"}</button>` : ""}`;
      }).join("")}</div>`}
      <div class="tp-explain"><p><b>Mẹo HLV:</b> ghép bài đối vận (đẩy ↔ kéo, tay trước ↔ tay sau) hoặc bài chính + bài bụng/bắp chân để tiết kiệm thời gian mà không giảm sức. Tránh ghép hai bài đa khớp nặng (Squat + Deadlift…).</p></div>
      <button class="btn btn-primary btn-block" id="tp-se-done" style="margin-top:12px;">Xong</button>
    `);
    const done = ()=>{ closeSheet(); if(onDone) onDone(); };
    document.getElementById("tp-se-close").addEventListener("click", done);
    document.getElementById("tp-se-done").addEventListener("click", done);
    document.querySelectorAll("[data-link]").forEach(b=> b.addEventListener("click", ()=>{
      const r = toggleLink(planId, dayKey, plan.days[dayKey].items, Number(b.dataset.link));
      if(!r.ok && r.reason === "max"){ toast(`Mỗi circuit tối đa ${MAX_GROUP} bài`, "error"); return; }
      save();
      if(r.heavy) toast("Hai bài đa khớp nặng ghép với nhau dễ giảm chất lượng hiệp — cân nhắc nhé", "warning");
      render();
    }));
  };
  render();
}

/* ---- Màn sửa giáo án: hiển thị nhóm + nút ghép ---- */
function decoratePlanEditor(){
  if(typeof plansUI !== "object" || plansUI.mode === "list") return;
  const plan = state.plans[plansUI.planId]; if(!plan) return;
  const host = document.getElementById("plans-content"); if(!host) return;
  const dayKey = plansUI.day;
  const items = ((plan.days[dayKey]||{}).items) || [];
  items.forEach(it=>{
    const row = host.querySelector(`[data-item="${cssEsc(it.uid)}"]`); if(!row) return;
    const meta = row.querySelector(".meta"); const am = amrapListTag(it); if(meta && !meta.querySelector(".tp-tag") && am) meta.insertAdjacentHTML("beforeend", ` <span class="tp-tag tp-am-tag">${am}</span>`);
  });
  wrapGroups(host, "[data-item]", "data-item", plan, dayKey);
  if(items.length >= 2 && !host.querySelector(".tp-ss-edit")){
    host.insertAdjacentHTML("beforeend", `<button class="btn btn-outline btn-block tp-ss-edit" style="margin-top:12px;"><span class="material-symbols-rounded">link</span>Ghép siêu hiệp / liên hoàn</button>`);
    host.querySelector(".tp-ss-edit").addEventListener("click", ()=> openSupersetEditor(plan.id, dayKey, ()=> renderPlansScreen()));
  }
}
/* ---- Sửa bài trong giáo án: bật "hiệp cuối AMRAP" ---- */
function decorateItemEditor(plan, dayKey, itemUid){
  const item = ((plan.days[dayKey]||{}).items||[]).find(it=> it.uid === itemUid); if(!item) return;
  const saveBtn = document.getElementById("pie-save"); if(!saveBtn || document.getElementById("tp-am-last")) return;
  const timed = isTimedReps(item.reps), auto = /amrap|tối đa|\bmax\b/i.test(String(item.reps)) || /\d\s*\+/.test(String(item.reps));
  saveBtn.insertAdjacentHTML("beforebegin", `
    <label class="tp-switch-row ${timed||auto?'dis':''}"><input type="checkbox" id="tp-am-last" ${store().amrapItems[item.uid] || auto ? "checked" : ""} ${timed||auto?"disabled":""}>
      <span><b>Hiệp cuối AMRAP</b><small>${timed ? "Không áp dụng cho bài tính giờ." : auto ? "Số lần đã ghi dạng AMRAP / tối đa / “5+”." : "Làm tối đa số lần ở hiệp cuối để app ước tính 1RM và gợi ý tạ lần sau."}</small></span></label>`);
  const cb = document.getElementById("tp-am-last");
  if(cb && !cb.disabled) cb.addEventListener("change", ()=>{ const st = store(); if(cb.checked) st.amrapItems[item.uid] = true; else delete st.amrapItems[item.uid]; save(); });
}

/* ---------------------------------------------------------------------
   14. MÀN TIẾN ĐỘ — khối lượng theo nhóm cơ / tuần (SVG)
   --------------------------------------------------------------------- */
let volOffset = 0;
/* W = bề rộng thật (px) của khung → chữ trong SVG giữ đúng 12,5 px, không bị co nhỏ trên máy hẹp */
function volumeSVG(acc, planned, W){
  W = Math.max(260, Math.min(640, Math.round(W || 320)));
  const rowH = 30, top = 18, labW = 74, x0 = labW + 6, x1 = W - 42;
  const maxV = Math.max(24, ...MG.map(g=> acc[g]), ...MG.map(g=> planned[g] || 0)) ;
  const hasPlan = MG.some(g=> (planned[g] || 0) > 0);
  const sx = (v)=> x0 + (Math.min(v, maxV)/maxV) * (x1 - x0);
  const H = top + MG.length*rowH + 22;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="tp-vol-svg" role="img" aria-label="Số hiệp hiệu quả theo nhóm cơ trong tuần">`;
  if(!hasPlan) s += `<rect x="${sx(10)}" y="${top-6}" width="${sx(20)-sx(10)}" height="${MG.length*rowH+4}" rx="4" class="band"/>`;
  [0,10,20].forEach(v=>{ s += `<line x1="${sx(v)}" y1="${top-6}" x2="${sx(v)}" y2="${top+MG.length*rowH-2}" class="grid"/><text x="${sx(v)}" y="${top+MG.length*rowH+14}" class="ax" text-anchor="middle">${v}</text>`; });
  MG.forEach((g, i)=>{
    const y = top + i*rowH, v = acc[g], st = hasPlan ? volStatus(v, planned[g] || 0) : volStatus(v);
    s += `<text x="${labW}" y="${y+rowH/2+4}" class="lab" text-anchor="end">${g}</text>`;
    s += `<rect x="${x0}" y="${y+6}" width="${x1-x0}" height="${rowH-12}" rx="${(rowH-12)/2}" class="track"/>`;
    if(v > 0) s += `<rect x="${x0}" y="${y+6}" width="${Math.max(rowH-12, sx(v)-x0)}" height="${rowH-12}" rx="${(rowH-12)/2}" class="bar ${st}"/>`;
    if(planned[g] > 0) s += `<line x1="${sx(planned[g])}" y1="${y+3}" x2="${sx(planned[g])}" y2="${y+rowH-3}" class="plan"/>`;
    s += `<text x="${W-2}" y="${y+rowH/2+4}" class="val ${st}" text-anchor="end">${String(v).replace(".", ",")}</text>`;
  });
  return s + `</svg>`;
}
function volumeCardHTML(from, to, v, planned){
  const hasPlan = MG.some(g=> (planned[g] || 0) > 0);
  // QT-19: "Còn thiếu" / "Khá cao" so với mục tiêu của GIÁO ÁN, không áp chuẩn 10–20 cho mọi giáo án
  const low = hasPlan ? MG.filter(g=> planned[g] > 0 && v.acc[g] < volTarget(planned[g]).lo) : MG.filter(g=> v.acc[g] < 10 && v.acc[g] > 0);
  const high = hasPlan ? MG.filter(g=> v.acc[g] > volTarget(planned[g] || 0).hi) : MG.filter(g=> v.acc[g] > 20);
  const any = MG.some(g=> v.acc[g] > 0);
  const label = volOffset === 0 ? "Tuần này" : volOffset === -1 ? "Tuần trước" : `${-volOffset} tuần trước`;
  return `<div class="card tp-vol-card" id="tp-vol-card">
    <div class="card-title"><span class="material-symbols-rounded">bar_chart</span>Khối lượng theo nhóm cơ</div>
    <div class="tp-vol-nav">
      <button type="button" class="icon-btn" data-vol="-1" aria-label="Tuần trước"><span class="material-symbols-rounded">arrow_back</span></button>
      <div><b>${label}</b><small>${ddmm(from)} – ${ddmm(to)}</small></div>
      <button type="button" class="icon-btn" data-vol="1" ${volOffset >= 0 ? "disabled" : ""} aria-label="Tuần sau"><span class="material-symbols-rounded" style="transform:scaleX(-1)">arrow_back</span></button>
    </div>
    ${v.sessions ? `<p class="small-note tp-vol-sum">${v.sessions} buổi · ${fmtDur(v.durSec)} · ${viNum(v.tonnage)} kg tổng khối lượng</p>` : ""}
    <div class="tp-vol-chart"></div>
    <div class="tp-legend">${hasPlan ? `<span><i class="low"></i>Thiếu so với giáo án</span><span><i class="ok"></i>Đạt mục tiêu</span><span><i class="high"></i>Quá cao</span><span><i class="plan"></i>Mục tiêu giáo án</span>` : `<span><i class="low"></i>Dưới 10</span><span><i class="ok"></i>10–20 (khuyến nghị)</span><span><i class="high"></i>Trên 20</span>`}</div>
    ${!any ? `<p class="small-note" style="margin-top:8px;">Chưa có hiệp nào được ghi trong tuần này. Hoàn thành buổi tập (đánh dấu từng hiệp) để app đếm khối lượng.</p>` : `
    ${low.length ? `<p class="small-note tp-vol-tip"><b>Còn thiếu so với giáo án:</b> ${low.map(g=> `${g} (${String(v.acc[g]).replace(".", ",")}${hasPlan ? "/" + String(planned[g]).replace(".", ",") : ""})`).join(", ")}${volOffset === 0 ? " — vẫn còn ngày trong tuần để bù." : "."}</p>` : ""}
    ${high.length ? `<p class="small-note tp-vol-tip"><b>Khá cao:</b> ${high.join(", ")} — vượt khá xa mục tiêu, theo dõi đau mỏi, cân nhắc bớt 2–4 hiệp nếu hồi phục kém.</p>` : ""}`}
    <p class="small-note" style="margin-top:6px;">Hiệp hiệu quả = hiệp chính đã hoàn thành, gần thất bại (còn ≤ 4 lần). Nhóm cơ phụ của bài đa khớp tính 0,5 hiệp (cùng bảng hệ số với "Tạo giáo án riêng"); hiệp ghi độ nặng cảm nhận (RPE) ≤ 6 tính nửa hiệp. ${hasPlan ? "Mục tiêu = số hiệp theo giáo án của bạn (vạch trắng); khuyến nghị chung để tăng cơ là 10–20 hiệp/nhóm cơ/tuần." : "Khuyến nghị tăng cơ: 10–20 hiệp/nhóm cơ/tuần."}</p>
  </div>`;
}
function insertVolumeCard(){
  const host = document.getElementById("progress-content"); if(!host) return;
  const old = document.getElementById("tp-vol-card"); if(old) old.remove();
  /* integrator (FIX-core vòng 2 #3): thẻ Khối lượng tuần chỉ thuộc tab "Kỷ lục" của màn Tiến độ (không chèn ở Ảnh / InBody) */
  try{ if(typeof progressUI !== "undefined" && progressUI && progressUI.tab && progressUI.tab !== "records") return; }catch(e){}
  const { from, to } = weekRange(volOffset);
  const v = weekVolume(from, to);
  const planned = plannedVolume(getActivePlan());
  const w = document.createElement("div"); w.innerHTML = volumeCardHTML(from, to, v, planned); const card = w.firstElementChild;
  const pr = host.querySelector(".pr-card");
  if(pr) pr.after(card); else host.insertBefore(card, host.children[1] || null);
  const chart = card.querySelector(".tp-vol-chart");
  if(chart) chart.innerHTML = volumeSVG(v.acc, planned, chart.clientWidth || (card.clientWidth - 32));
  card.querySelectorAll("[data-vol]").forEach(b=> b.addEventListener("click", ()=>{ volOffset = Math.min(0, volOffset + Number(b.dataset.vol)); insertVolumeCard(); }));
}

/* ---------------------------------------------------------------------
   15. GHI ĐÈ HÀM — giữ nguyên hành vi cũ
   --------------------------------------------------------------------- */
function install(){
  if(typeof renderSessionStep !== "function") return false;
  const _render = renderSessionStep;
  renderSessionStep = function(){
    const s = curSession();
    try{ if(s && !s._tp) initSession(s); if(s && s._tp) s._tp.pauseShown = false; }catch(e){ console.warn("[training-pro] init", e); }
    if(s && s._tp && s.idx < s.items.length){
      const it = s.items[s.idx];
      const gi = s._tp.groupOf[it.uid];
      if(gi !== undefined && s._tp.groups[gi] && s._tp.groups[gi][0] === it.uid){
        try{ if(renderGroupStep(s, gi)) return; }catch(e){ console.warn("[training-pro] group", e); }
      }
      try{
        // Điền sẵn hiệp cho MỌI bài (QT-01/08/10/13) trước khi app.js vẽ — app.js dùng lại session.sets đã có
        if(!(s.sets && s.sets[it.uid]) || needsPrefill(s, it)){ const ctx = ctxFor(it); const rows = ensureRows(s, it, ctx); if(needsPrefill(s, it)) firstView(s, it, ctx, rows); }
      }catch(e){ console.warn("[training-pro] prefill", e); }
    }
    const r = _render.apply(this, arguments);
    try{ const s2 = curSession(); if(s2 && s2._tp && s2.idx < s2.items.length && !s2.finished) decorateSingle(s2, s2.items[s2.idx]); }catch(e){ console.warn("[training-pro] decorate", e); }
    return r;
  };

  if(typeof closeSheet === "function"){
    const _cs = closeSheet;
    closeSheet = function(){
      const r = _cs.apply(this, arguments);
      try{
        const s = curSession();
        if(s && s._tp && s.paused && !s.finished && !s._tp.pauseShown){
          s._tp.pauseShown = true;
          const sc = document.getElementById("screen-workout");
          if(sc && sc.classList.contains("active")) renderWorkoutScreen();
        }
      }catch(e){}
      return r;
    };
  }
  if(typeof recordExerciseResult === "function"){
    const _rec = recordExerciseResult;
    recordExerciseResult = function(key, name){
      const s = curSession(); let prev = null, restore = false, item = null;
      const args = Array.prototype.slice.call(arguments);
      try{
        if(s && s._tp){
          item = s._tp.ctxItem || s.items[s.idx] || null;
          if(item && exKey(item) !== key) item = null;
          if(s._tp.deload){ const cur = (state.setLog||{})[key]; if(cur && cur.date !== dstr(new Date())){ prev = JSON.parse(JSON.stringify(cur)); restore = true; } }
          // QT-01: hiệp đã xong để trống kg ở bài có tạ → kế thừa kg hiệp trước / buổi trước (không lưu 0 kg)
          if(!args[4] && Array.isArray(args[3])){
            args[3] = fillBlankKg(key, args[3]);
            const rows = item && s.sets && s.sets[item.uid];
            if(rows){ let carry = 0; rows.forEach(r=>{ if(!r.done) return; if(num(r.kg) > 0) carry = num(r.kg); else { const f = args[3].find(x=> num(x.kg) > 0); const v = carry || (f ? num(f.kg) : 0); if(v > 0) r.kg = v; } }); }
          }
        }
      }catch(e){}
      const r = _rec.apply(this, args);
      try{
        if(restore && prev){ state.setLog[key] = prev; }
        if(s && s._tp && item) afterRecord(s, item, key, name);
      }catch(e){ console.warn("[training-pro] record", e); }
      return r;
    };
  }

  /* QT-08: top set + back-off → xét tăng tạ theo HIỆP NẶNG (hiệp 1), tôn trọng RPE mục tiêu trong chuỗi "3-5 · RPE 8" */
  if(typeof progressionFor === "function"){
    const _pf = progressionFor;
    progressionFor = function(item, meta, last, timed){
      try{
        if(!timed && last && Array.isArray(last.sets) && last.sets.length && isTopBack(item)){
          const topSet = last.sets[0];
          const r = _pf.call(this, item, meta, Object.assign({}, last, { sets:[topSet] }), timed, 1) || { delta:0 };
          const m = String(item.reps||"").match(/RPE\s*(\d+(?:[.,]\d)?)/i);
          const rpeT = m ? Number(m[1].replace(",", ".")) : 0;
          if(r.delta > 0 && rpeT && num(topSet.rpe) > rpeT + 0.5) return { delta:0 };
          if(r.delta > 0) r.msg = `Hiệp nặng lần trước đạt ${repTop(item.reps)} lần${rpeT ? ` (RPE ≤ ${rpeT})` : ""} → app <b>tăng hiệp nặng lên ${r.kg} kg</b>, các hiệp sau ~${backoffKg(r.kg, weightStep(meta))} kg.`;
          return r;
        }
      }catch(e){ console.warn("[training-pro] progression", e); }
      return _pf.apply(this, arguments);
    };
  }

  if(typeof finishSession === "function"){
    const _finish = finishSession;
    finishSession = function(){
      const s = curSession(); let sum = null;
      try{ if(s && s._tp) sum = buildSummary(s); }catch(e){ console.warn("[training-pro] summary", e); }
      const r = _finish.apply(this, arguments);
      try{
        if(sum){
          const entry = sum.isToday && sum.completed > 0 ? saveLog(sum) : null;
          finishDecorate(sum, entry);
        }
      }catch(e){ console.warn("[training-pro] finish", e); }
      return r;
    };
  }

  if(typeof renderWorkoutScreen === "function"){
    const _rw = renderWorkoutScreen;
    renderWorkoutScreen = function(){ const r = _rw.apply(this, arguments); try{ decorateWorkout(); }catch(e){ console.warn("[training-pro] workout", e); } return r; };
  }
  if(typeof renderProgressScreen === "function"){
    const _rp = renderProgressScreen;
    renderProgressScreen = function(){ const r = _rp.apply(this, arguments); try{ insertVolumeCard(); }catch(e){ console.warn("[training-pro] progress", e); } return r; };
  }
  if(typeof renderPlansScreen === "function"){
    const _rps = renderPlansScreen;
    renderPlansScreen = function(){ const r = _rps.apply(this, arguments); try{ decoratePlanEditor(); }catch(e){ console.warn("[training-pro] plans", e); } return r; };
  }
  if(typeof openPlanItemEditor === "function"){
    const _pie = openPlanItemEditor;
    openPlanItemEditor = function(plan, dayKey, itemUid){ const r = _pie.apply(this, arguments); try{ decorateItemEditor(plan, dayKey, itemUid); }catch(e){} return r; };
  }
  if(typeof tplAddToWeek === "function"){
    const _add = tplAddToWeek;
    tplAddToWeek = async function(t){
      const before = new Set(Object.keys(state.plans || {}));
      const r = await _add.apply(this, arguments);
      try{
        const ids = Object.keys(state.plans || {}).filter(id=> !before.has(id) && state.plans[id].fromTemplate === (t && t.id));
        const id = ids[0] || (state.plans[state.activePlanId] && state.plans[state.activePlanId].fromTemplate === (t && t.id) ? state.activePlanId : null);
        if(id){
          const c = startCycle(id, { tpl: t });
          save();
          const sc = document.getElementById("screen-workout");
          if(sc && sc.classList.contains("active")) renderWorkoutScreen();
          setTimeout(()=> toast(c.startDate === mondayStr() ? `Chu kỳ ${c.weeks} tuần bắt đầu — tuần này là tuần 1${c.deloadEvery ? ` · giảm tải mỗi tuần thứ ${c.deloadEvery}` : ""}` : `Chu kỳ ${c.weeks} tuần bắt đầu từ T2 ${ddmm(c.startDate)} — mấy ngày tới là tuần làm quen`, "event_repeat"), 2600);
        }
      }catch(e){ console.warn("[training-pro] tplAddToWeek", e); }
      return r;
    };
  }
  if(typeof openTemplateDetail === "function"){
    const _otd = openTemplateDetail;
    openTemplateDetail = function(id){
      const r = _otd.apply(this, arguments);
      try{
        const t = PROGRAM_TEMPLATES.find(x=> x.id === id); const use = document.getElementById("tpl-use");
        if(t && use && !document.getElementById("tp-tpl-cyc")){
          const ev = deloadEveryFor(t); const dl = []; for(let w = 1; w <= t.weeks; w++) if(ev && w % ev === 0) dl.push(w);
          use.insertAdjacentHTML("beforebegin", `<p class="small-note tp-tpl-cyc" id="tp-tpl-cyc"><span class="material-symbols-rounded">event_repeat</span>Chu kỳ ${t.weeks} tuần · ${dl.length ? `tuần giảm tải: ${dl.join(", ")}` : "không có tuần giảm tải"} — app tự đếm tuần và giảm tải giúp bạn.</p>`);
        }
      }catch(e){}
      return r;
    };
  }
  return true;
}

/* ---------------------------------------------------------------------
   16. KHỞI ĐỘNG
   --------------------------------------------------------------------- */
Object.assign(TP, {
  // thuần logic (dùng cho kiểm thử)
  mondayStr, weeksBetween, defaultStart, deloadEveryFor, isDeloadWeek, cycleInfo, startCycle, endCycle, cycleResults, cycleAdherence, nextTemplate,
  groupsFor, toggleLink, isLinked, amrapKind, amrapRows, amrapLabel, kgForReps, muscleWeights, parseMuscle, hardSets, weekRange, weekVolume, plannedVolume,
  deloadSets, deloadClone, buildSummary, fmtClock, fmtDur, drawShareCard, shareText, volStatus, volTarget, MG,
  lighterKg, ensureRows, ctxFor, isTopBack, fillDown, fillBlankKg, sameThreeTimes, cycleGap, shiftCycle, lastTrainDate, requiredDays, hasHistory, prefillNotesHTML,
  amrapRule, groupLabel, simpleMode,
  // giao diện
  openCycleSheet, openSupersetEditor, openLogSheet, openShareCard, insertVolumeCard, decorateWorkout, store,
});
try{
  if(typeof state !== "undefined" && state){
    store();
    TP.installed = install();
    if(typeof document !== "undefined"){
      const w = document.getElementById("screen-workout");
      if(w && w.classList.contains("active") && typeof getActivePlan === "function" && getActivePlan()) renderWorkoutScreen();
      const p = document.getElementById("screen-progress");
      if(p && p.classList.contains("active")) renderProgressScreen();
    }
  }
}catch(e){ try{ console.warn("[training-pro] khởi động lỗi", e); }catch(_){} }
})();

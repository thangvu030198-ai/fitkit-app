/* =========================================================================
   TapEasy — THÀNH TÍCH (achievements.js)
   Huy hiệu (47) · Cấp độ & XP · Bức tường kỷ lục · Tổng kết tuần · Nhắc quay lại
   - Nạp SAU pt.js (xem docs/INTEGRATION-achievements.md)
   - Dữ liệu riêng: state.achievements = { earned:{id:{d,t}}, quick:[date], level, xp,
     init, firstSeen, snooze, seenWeek }
   - Mọi số liệu được TÍNH LẠI từ dữ liệu sẵn có (workoutLog, finishedDates,
     setHist, setLog, foodLog, waterLog, sleepLog, progressPhotos, inbodyLogs).
   - Phần lõi (window.FKAch) là hàm thuần → kiểm thử được bằng Node.
   ========================================================================= */
(function(G){
"use strict";

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH NGÀY THÁNG & ĐỊNH DẠNG
   --------------------------------------------------------------------- */
const p2 = n=> String(n).padStart(2,"0");
const ds = d=> `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
const isDs = s=> typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const parse = s=>{ const a = s.split("-").map(Number); return new Date(a[0], a[1]-1, a[2], 12); };
const addD = (s, n)=>{ const d = parse(s); d.setDate(d.getDate()+n); return ds(d); };
const diffD = (a, b)=> Math.round((parse(b) - parse(a))/86400000);            // b − a (ngày)
const DK = ["CN","T2","T3","T4","T5","T6","T7"];
const dayKeyOf = s=> DK[parse(s).getDay()];
const mondayOf = s=>{ const d = parse(s); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return ds(d); };
const dm = s=> isDs(s) ? `${s.slice(8,10)}/${s.slice(5,7)}` : "";
const dmy = s=> isDs(s) ? `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}` : "";
const nf = (n, d=0)=>{ n = Number(n)||0; try{ return n.toLocaleString("vi-VN", { maximumFractionDigits:d, minimumFractionDigits:0 }); }catch(e){ return String(Math.round(n*10**d)/10**d); } };
const ratioTxt = r=> String(r).replace(".", ",");
const tons = kg=> kg >= 1000 ? `${nf(kg/1000, kg >= 100000 ? 0 : 1)} tấn` : `${nf(kg)} kg`;
const clamp01 = x=> Math.max(0, Math.min(1, Number(x)||0));
const esc = s=> (typeof G.escapeHtml==="function" ? G.escapeHtml(String(s==null?"":s)) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));
const obj = o=> (o && typeof o==="object") ? o : {};
const MAX_DAYS = 1100;   // giới hạn lịch sử tính toán (~3 năm) để luôn nhanh

/* Bài nâng chính (theo id trong data.js/templates.js hoặc tên bài tự thêm) */
function liftOf(key, name){
  const k = String(key||"").toLowerCase(), n = String(name||"").toLowerCase();
  if(k==="benchpress") return "bench";
  if(k==="squat" || k==="frontsquat") return "squat";
  if(k==="deadlift") return "deadlift";
  if(/bench press|đẩy ngực nằm/.test(n) && !/dumbbell|tạ đơn|incline|decline|nghiêng|dốc|machine|máy|smith|close|hẹp|floor/.test(n)) return "bench";
  if(/(back|barbell|front|high.bar|low.bar) squat|gánh tạ|gánh đùi/.test(n) && !/smith|hack|goblet|split|bulgaria|box|jump|tay không|bodyweight/.test(n)) return "squat";
  if(/deadlift/.test(n) && !/romanian|rdl|stiff|chân thẳng|single|một chân|dumbbell|tạ đơn|kettlebell|tạ ấm|trap|hex/.test(n)) return "deadlift";
  return null;
}

/* ---------------------------------------------------------------------
   1. NGỮ CẢNH: chuỗi ngày (series) tính từ toàn bộ dữ liệu
   --------------------------------------------------------------------- */
function buildCtx(st, now){
  st = obj(st);
  const today = ds(now instanceof Date ? now : new Date());
  const P = obj(st.profile), A = obj(st.achievements);
  const WL = obj(st.workoutLog), FL = obj(st.foodLog), WA = obj(st.waterLog), SL = obj(st.sleepLog), SH = obj(st.setHist), SG = obj(st.setLog);

  /* Buổi tập = ngày hoàn thành đủ giáo án (finishedDates) ∪ ngày bấm "kết thúc buổi" có ≥1 bài ∪ buổi 20 phút */
  const sess = new Map();
  (Array.isArray(st.finishedDates) ? st.finishedDates : []).forEach(d=>{ if(isDs(d) && d<=today) sess.set(d, {}); });
  Object.keys(WL).forEach(d=>{
    const l = WL[d]; if(!isDs(d) || d>today || !l || typeof l!=="object") return;
    const n = Array.isArray(l.completedExerciseIds) ? l.completedExerciseIds.length : 0;
    if(l.finishedAt && n && !sess.has(d)) sess.set(d, {});
    if(l.finishedAt && sess.has(d)){ const h = new Date(Number(l.finishedAt)).getHours(); if(isFinite(h)) sess.get(d).hour = h; }
  });
  (Array.isArray(A.quick) ? A.quick : []).forEach(d=>{ if(isDs(d) && d<=today && !sess.has(d)) sess.set(d, {}); });

  /* QT-06: nhật ký buổi tập (training-pro) là nguồn đếm số buổi & khối lượng từng buổi →
     2 buổi/ngày được đếm 2, khối lượng không bị mất khi lịch sử bài (setHist) ghi đè cùng ngày. */
  const TPL = obj(st.trainingPro), tpCnt = {}, tpVol = {};
  (Array.isArray(TPL.log) ? TPL.log : []).forEach(e=>{
    if(!e || !isDs(e.date) || e.date > today || !(Number(e.completed) > 0)) return;
    tpCnt[e.date] = (tpCnt[e.date]||0) + 1;
    const v = Number(e.volume); if(v > 0 && isFinite(v)) tpVol[e.date] = (tpVol[e.date]||0) + v;
    if(!sess.has(e.date)) sess.set(e.date, {});
  });

  /* Lịch giáo án hiện tại → ngày nghỉ không làm đứt chuỗi (giống calcStreak của app).
     QT-22: ngày đi bộ / Zone 2 "tuỳ chọn" không tính vào chỉ tiêu (planRequiredDays của templates.js). */
  const plan = obj(st.plans)[st.activePlanId];
  const planned = new Set();
  let req = null; try{ if(plan && typeof G.planRequiredDays === "function") req = G.planRequiredDays(plan); }catch(e){ req = null; }
  if(Array.isArray(req)) req.forEach(k=> planned.add(k));
  else if(plan && plan.days) for(const k in plan.days){ const v = plan.days[k]; if(v && Array.isArray(v.items) && v.items.length && !v.optional) planned.add(k); }

  const bw = Number(P.weight) > 25 ? Number(P.weight) : 65;
  const female = P.gender === "female";
  const goals = {
    water: P.waterTargetOverride != null && Number(P.waterTargetOverride) > 0 ? Number(P.waterTargetOverride) : Math.round(bw*0.035*10)/10,
    protein: Number(P.protein) > 0 ? Number(P.protein) : Math.round(bw*1.6),
    kcal: Number(P.goalKcal) > 0 ? Number(P.goalKcal) : 0,
    sleep: Number(P.sleepGoalHours) > 0 ? Number(P.sleepGoalHours) : 8,
  };
  goals.sleepMin = Math.max(7, goals.sleep - 0.5);

  /* Khối lượng, kỷ lục (PR), 1RM bài chính theo ngày — từ setHist */
  const vol = {}, prs = {}, lifts = {}, firstEx = {};
  for(const key in SH){
    const h = SH[key]; if(!h || !Array.isArray(h.list)) continue;
    const lift = liftOf(key, h.name);
    const list = h.list.filter(x=> x && isDs(x.date) && x.date<=today).sort((a,b)=> a.date<b.date?-1:a.date>b.date?1:0);
    let best = 0;
    for(const x of list){
      let v = Number(x.vol);
      if(!(v>=0) || !isFinite(v)) v = Array.isArray(x.sets) ? x.sets.reduce((a,s)=> a + (Number(s&&s.kg)||0)*(Number(s&&s.reps)||0), 0) : 0;
      vol[x.date] = (vol[x.date]||0) + v;
      const e = Number(x.e1rm)||0;
      if(e>0 && best>0 && e > best + 0.4) (prs[x.date] = prs[x.date]||[]).push({ key, name: h.name||key, e1rm: e, prev: best });
      if(e > best) best = e;
      if(lift && e>0){ const L = lifts[x.date] = lifts[x.date]||{}; L[lift] = Math.max(L[lift]||0, e); }
    }
    if(list.length) firstEx[key] = list[0].date;
  }
  for(const key in SG){ const l = SG[key]; if(l && isDs(l.date) && l.date<=today && !(key in firstEx)) firstEx[key] = l.date; }
  /* QT-06: khối lượng ngày = max(lịch sử bài, nhật ký buổi tập) — khớp số "tấn" của Nhật ký buổi tập */
  for(const d in tpVol) if(tpVol[d] > (vol[d]||0)) vol[d] = tpVol[d];

  /* Ăn uống: tổng kcal, đạm, số món theo ngày (KHÔNG gọi getDayFoodLog để khỏi tạo ngày rỗng) */
  const food = {};
  for(const d in FL){
    if(!isDs(d) || d>today) continue;
    const day = FL[d]; if(!day || typeof day!=="object") continue;
    let n=0, k=0, p=0;
    for(const m in day){ const arr = day[m]; if(!Array.isArray(arr)) continue;
      for(const it of arr){ if(!it || typeof it!=="object") continue; n++; k += Number(it.kcal)||0; p += Number(it.protein)||0; } }
    if(n) food[d] = { n, kcal:k, protein:p };
  }

  /* Ngày bắt đầu = ngày dữ liệu sớm nhất (tối đa MAX_DAYS) */
  let start = today;
  const consider = d=>{ if(isDs(d) && d<start) start = d; };
  sess.forEach((_, d)=> consider(d)); Object.keys(vol).forEach(consider); Object.keys(food).forEach(consider);
  Object.keys(WA).forEach(d=>{ if(Number(WA[d])>0 && d<=today) consider(d); });
  Object.keys(SL).forEach(d=>{ if(d<=today) consider(d); });
  Object.values(firstEx).forEach(consider);
  const minStart = addD(today, -MAX_DAYS);
  if(start < minStart) start = minStart;

  const series = [], byDate = {};
  let lastIdx = -1;
  const cursor = parse(start);
  for(let guard = 0; guard <= MAX_DAYS+1; guard++, cursor.setDate(cursor.getDate()+1)){
    const d = ds(cursor); if(d > today) break;
    const dk = DK[cursor.getDay()];
    const f = food[d], s = sess.get(d);
    const water = Number(WA[d])||0;
    const sl = SL[d]; const sleepH = sl && Number(sl.hours) > 0 ? Number(sl.hours) : 0;
    const x = {
      d, dk, today: d===today, rest: !planned.has(dk),
      sess: !!s, sessN: s ? Math.max(1, tpCnt[d]||0) : 0, hour: s && s.hour!=null ? s.hour : null, gapBefore: 0,
      vol: vol[d]||0, prs: (prs[d]||[]).length, lift: lifts[d]||null,
      food: !!f, foodN: f ? f.n : 0, kcal: f ? f.kcal : 0, protein: f ? f.protein : 0,
      water, waterOk: goals.water > 0 && water >= goals.water - 0.05,
      sleep: sleepH, sleepOk: sleepH >= goals.sleepMin,
    };
    x.protOk = !!f && x.protein >= goals.protein*0.9;
    x.kcalOk = !!f && goals.kcal > 0 && Math.abs(x.kcal - goals.kcal) <= goals.kcal*0.1;
    if(x.sess){ x.gapBefore = lastIdx >= 0 ? series.length - lastIdx : 0; lastIdx = series.length; }
    series.push(x); byDate[d] = x;
  }
  /* QT-20: ngày bắt đầu theo dõi = max(lần đầu mở app, ngày tạo giáo án đang dùng) */
  let since = isDs(A.firstSeen) ? A.firstSeen : null;
  const pc = plan && (Number(plan.createdAt) || Number(plan.builder && plan.builder.createdAt));
  if(pc > 0){ const pd = ds(new Date(pc)); if(!since || pd > since) since = pd; }
  if(since && since > today) since = today;
  return { st, today, P, A, plan, planned, bw, female, goals, series, byDate, sess, prs, vol, food, firstEx, since };
}

/* Bộ đếm dùng chung cho huy hiệu */
function cum(c, f, target){ let v=0, at=null; for(const x of c.series){ v += f(x)||0; if(at===null && v>=target) at = x.d; } return { val:v, target, at }; }
function streak(c, f, target){ let cur=0, best=0, at=null; for(const x of c.series){ const r = f(x); if(r>0) cur++; else if(r<0) cur=0; if(cur>best) best=cur; if(at===null && cur>=target) at = x.d; } return { val:cur, best, target, at }; }
function peak(c, f, target){ let v=0, at=null; for(const x of c.series){ const y = f(x)||0; if(y>v) v=y; if(at===null && v>=target) at = x.d; } return { val:v, target, at }; }
function nth(dates, target){ const a = dates.filter(isDs).sort(); return { val:a.length, target, at: a.length>=target ? a[target-1] : null }; }
const sessRun = x=> x.sess ? 1 : (x.rest || x.today) ? 0 : -1;
const okRun = key=> x=> x[key] ? 1 : x.today ? 0 : -1;

/* Tuần trọn giáo án: số buổi trong tuần (T2–CN) ≥ số ngày tập của giáo án → ngày hoàn thành */
function fullWeeks(c){
  if(c._fw) return c._fw;
  const need = c.planned.size, byWeek = {};
  if(need) for(const x of c.series){ if(!x.sess) continue; const m = mondayOf(x.d); (byWeek[m] = byWeek[m]||[]).push(x.d); }
  return (c._fw = Object.keys(byWeek).sort().filter(m=> byWeek[m].length >= need).map(m=>({ mon:m, at: byWeek[m][need-1] })));
}
function perfectWeeks(c){
  return fullWeeks(c).filter(w=>{
    const sun = addD(w.mon, 6); if(sun > c.today) return false;
    for(let i=0;i<7;i++){ const x = c.byDate[addD(w.mon,i)]; if(!x || !x.waterOk || !x.food) return false; }
    return true;
  }).map(w=> addD(w.mon, 6));
}

/* ---------------------------------------------------------------------
   2. ĐỊNH NGHĨA HUY HIỆU
   tier: 1 = Đồng, 2 = Bạc, 3 = Vàng · glyph: hình vẽ nét 24×24 (mục 3)
   --------------------------------------------------------------------- */
const CATS = [
  { id:"train", label:"Tập luyện", icon:"fitness_center" },
  { id:"habit", label:"Chuỗi & thói quen", icon:"local_fire_department" },
  { id:"strength", label:"Sức mạnh & kỷ lục", icon:"ach_trophy" },
  { id:"nutri", label:"Dinh dưỡng & nước", icon:"restaurant" },
  { id:"recover", label:"Hồi phục & theo dõi", icon:"bedtime" },
];
const TIER_XP = [0, 50, 150, 400];
const STRENGTH = {
  male:   { bench:[0.75,1,1.5], squat:[1,1.5,2], deadlift:[1.25,1.75,2.25] },
  female: { bench:[0.5,0.75,1], squat:[0.75,1.25,1.5], deadlift:[1,1.5,2] },
};
const LIFT_NAME = { bench:["Đẩy ngực","Bench Press"], squat:["Gánh đùi","Back Squat"], deadlift:["Deadlift","Deadlift"] };

const BADGES = [
  /* ---- Tập luyện ---- */
  { id:"s1", cat:"train", tier:1, glyph:"flag", label:"1", name:"Bước chân đầu tiên", desc:"Hoàn thành buổi tập đầu tiên.", unit:"buổi", ev:c=> cum(c, x=> x.sessN||0, 1) },
  { id:"s10", cat:"train", tier:1, glyph:"dumbbell", label:"10", name:"Bền bỉ 10 buổi", desc:"Hoàn thành 10 buổi tập.", unit:"buổi", ev:c=> cum(c, x=> x.sessN||0, 10) },
  { id:"s50", cat:"train", tier:2, glyph:"dumbbellArc", label:"50", name:"Chiến binh 50 buổi", desc:"Hoàn thành 50 buổi tập.", unit:"buổi", ev:c=> cum(c, x=> x.sessN||0, 50) },
  { id:"s100", cat:"train", tier:3, glyph:"crown", label:"100", name:"Câu lạc bộ 100", desc:"Hoàn thành 100 buổi tập — bạn đã biến tập luyện thành lối sống.", unit:"buổi", ev:c=> cum(c, x=> x.sessN||0, 100) },
  { id:"v10", cat:"train", tier:1, glyph:"kettlebell", label:"10T", name:"10 tấn đầu tiên", desc:"Tổng khối lượng nâng (kg × lần của mọi hiệp đã ghi) đạt 10 tấn.", vol:true, ev:c=> cum(c, x=> x.vol, 10000) },
  { id:"v100", cat:"train", tier:2, glyph:"plates", label:"100T", name:"Trăm tấn thép", desc:"Tổng khối lượng nâng đạt 100 tấn.", vol:true, ev:c=> cum(c, x=> x.vol, 100000) },
  { id:"v1000", cat:"train", tier:3, glyph:"mountain", label:"1000T", name:"Nghìn tấn", desc:"Tổng khối lượng nâng đạt 1.000 tấn — tương đương nâng cả một con tàu nhỏ.", vol:true, ev:c=> cum(c, x=> x.vol, 1000000) },
  { id:"heavy", cat:"train", tier:2, glyph:"anvil", label:"10T", name:"Buổi tập nặng ký", desc:"Nâng tổng cộng từ 10 tấn trở lên trong một buổi.", vol:true, ev:c=> peak(c, x=> x.vol, 10000) },
  { id:"cyc1", cat:"train", tier:1, glyph:"calCheck", label:"1", name:"Trọn tuần giáo án", desc:"Tập đủ mọi buổi theo giáo án trong một tuần (Thứ Hai – Chủ nhật).", unit:"tuần", ev:c=> nth(fullWeeks(c).map(w=>w.at), 1) },
  { id:"cyc4", cat:"train", tier:2, glyph:"calGrid", label:"4", name:"Tháng kỷ luật", desc:"4 tuần trọn giáo án.", unit:"tuần", ev:c=> nth(fullWeeks(c).map(w=>w.at), 4) },
  { id:"cyc12", cat:"train", tier:3, glyph:"cycle", label:"12", name:"Chu kỳ 12 tuần", desc:"12 tuần trọn giáo án — đủ một chu kỳ tăng cơ/sức mạnh hoàn chỉnh.", unit:"tuần", ev:c=> nth(fullWeeks(c).map(w=>w.at), 12) },
  { id:"var15", cat:"train", tier:1, glyph:"grid4", label:"15", name:"Đa năng", desc:"Tập 15 bài tập khác nhau.", unit:"bài", ev:c=> nth(Object.values(c.firstEx), 15) },
  { id:"var30", cat:"train", tier:2, glyph:"compass", label:"30", name:"Nhà thám hiểm", desc:"Tập 30 bài tập khác nhau.", unit:"bài", ev:c=> nth(Object.values(c.firstEx), 30) },
  { id:"early", cat:"train", tier:1, glyph:"sunrise", label:"5", name:"Chim sớm", desc:"Hoàn thành 5 buổi tập trước 8:00 sáng.", unit:"buổi", ev:c=> cum(c, x=> x.sess && x.hour!=null && x.hour < 8 ? 1 : 0, 5) },
  { id:"owl", cat:"train", tier:1, glyph:"moonStar", label:"5", name:"Cú đêm", desc:"Hoàn thành 5 buổi tập sau 20:00.", unit:"buổi", ev:c=> cum(c, x=> x.sess && x.hour!=null && x.hour >= 20 ? 1 : 0, 5) },
  { id:"weekend", cat:"train", tier:1, glyph:"weekend", label:"T7·CN", name:"Chiến binh cuối tuần", desc:"Tập cả Thứ Bảy và Chủ nhật trong cùng một tuần.", unit:"lần", ev:c=> cum(c, x=> x.dk==="CN" && x.sess && c.byDate[addD(x.d,-1)] && c.byDate[addD(x.d,-1)].sess ? 1 : 0, 1) },

  /* ---- Chuỗi & thói quen ---- */
  { id:"st7", cat:"habit", tier:1, glyph:"flame", label:"7", name:"Chuỗi lửa 7", desc:"Chuỗi 7 buổi tập liên tiếp (ngày nghỉ theo giáo án không làm đứt chuỗi).", run:true, unit:"buổi", ev:c=> streak(c, sessRun, 7) },
  { id:"st30", cat:"habit", tier:2, glyph:"flameSpark", label:"30", name:"Chuỗi lửa 30", desc:"Chuỗi 30 buổi tập liên tiếp theo lịch.", run:true, unit:"buổi", ev:c=> streak(c, sessRun, 30) },
  { id:"st100", cat:"habit", tier:3, glyph:"flameRing", label:"100", name:"Ngọn lửa bất diệt", desc:"Chuỗi 100 buổi tập liên tiếp theo lịch.", run:true, unit:"buổi", ev:c=> streak(c, sessRun, 100) },
  { id:"comeback", cat:"habit", tier:1, glyph:"comeback", label:"", name:"Trở lại mạnh mẽ", desc:"Quay lại tập sau ít nhất 7 ngày nghỉ. Bắt đầu lại luôn đáng được ghi nhận!", unit:"lần", ev:c=> cum(c, x=> x.sess && x.gapBefore >= 8 ? 1 : 0, 1) },
  { id:"allround", cat:"habit", tier:2, glyph:"diamond", label:"", name:"Ngày toàn diện", desc:"Trong cùng một ngày: tập luyện, uống đủ nước, đạt mục tiêu đạm và ngủ đủ giấc.", unit:"ngày", ev:c=> cum(c, x=> x.sess && x.waterOk && x.protOk && x.sleepOk ? 1 : 0, 1) },
  { id:"perfect", cat:"habit", tier:3, glyph:"star", label:"7/7", name:"Tuần hoàn hảo", desc:"Trong một tuần: tập đủ buổi theo giáo án, uống đủ nước 7/7 ngày và ghi ăn uống 7/7 ngày.", unit:"tuần", ev:c=> nth(perfectWeeks(c), 1) },

  /* ---- Sức mạnh & kỷ lục ---- */
  { id:"pr1", cat:"strength", tier:1, glyph:"trophy", label:"PR", name:"Kỷ lục đầu tiên", desc:"Phá kỷ lục cá nhân (1RM ước tính) ở bất kỳ bài nào.", unit:"kỷ lục", ev:c=> cum(c, x=> x.prs, 1) },
  { id:"pr10", cat:"strength", tier:2, glyph:"bolt", label:"10", name:"Kẻ phá kỷ lục", desc:"Phá 10 kỷ lục cá nhân.", unit:"kỷ lục", ev:c=> cum(c, x=> x.prs, 10) },
  { id:"pr50", cat:"strength", tier:3, glyph:"rocket", label:"50", name:"Cỗ máy kỷ lục", desc:"Phá 50 kỷ lục cá nhân.", unit:"kỷ lục", ev:c=> cum(c, x=> x.prs, 50) },
];
["bench","squat","deadlift"].forEach(lift=>{
  [1,2,3].forEach(tier=>{
    const ratio = c=> STRENGTH[c && c.female ? "female" : "male"][lift][tier-1];
    BADGES.push({
      id:`${lift}${tier}`, cat:"strength", tier, glyph: lift, plates: tier, lift,
      label: c=> `${ratioTxt(ratio(c))}×`,
      name: c=> `${LIFT_NAME[lift][0]} ${ratioTxt(ratio(c))}× cân nặng`,
      desc: c=> `1RM ước tính (công thức Epley) bài ${LIFT_NAME[lift][1]} đạt ${ratioTxt(ratio(c))} lần cân nặng cơ thể — với ${nf(c.bw,1)} kg là khoảng ${nf(Math.round(ratio(c)*c.bw/2.5)*2.5,1)} kg.`,
      ev: c=> peak(c, x=> x.lift && x.lift[lift] ? x.lift[lift]/c.bw : 0, ratio(c)),
      fmt: (r, c)=> `${nf(Math.min(r.val, r.target)*c.bw)}/${nf(r.target*c.bw)} kg`,
    });
  });
});
BADGES.push(
  /* ---- Dinh dưỡng & nước ---- */
  { id:"food7", cat:"nutri", tier:1, glyph:"notebook", label:"7", name:"Nhật ký 7 ngày", desc:"Ghi ăn uống 7 ngày liên tiếp.", run:true, unit:"ngày", ev:c=> streak(c, okRun("food"), 7) },
  { id:"food30", cat:"nutri", tier:2, glyph:"notebookCheck", label:"30", name:"Nhật ký 30 ngày", desc:"Ghi ăn uống 30 ngày liên tiếp.", run:true, unit:"ngày", ev:c=> streak(c, okRun("food"), 30) },
  { id:"food100", cat:"nutri", tier:3, glyph:"fork", label:"100", name:"Kỷ luật bàn ăn", desc:"Tổng cộng 100 ngày có ghi ăn uống.", unit:"ngày", ev:c=> cum(c, x=> x.food?1:0, 100) },
  { id:"prot1", cat:"nutri", tier:1, glyph:"egg", label:"", name:"Đủ đạm", desc:"Đạt từ 90% mục tiêu đạm trở lên trong một ngày.", unit:"ngày", ev:c=> cum(c, x=> x.protOk?1:0, 1) },
  { id:"prot7", cat:"nutri", tier:2, glyph:"drumstick", label:"7", name:"Tuần giàu đạm", desc:"Đạt ≥ 90% mục tiêu đạm 7 ngày liên tiếp.", run:true, unit:"ngày", ev:c=> streak(c, okRun("protOk"), 7) },
  { id:"prot30", cat:"nutri", tier:3, glyph:"fish", label:"30", name:"Bậc thầy đạm", desc:"Tổng cộng 30 ngày đạt mục tiêu đạm.", unit:"ngày", ev:c=> cum(c, x=> x.protOk?1:0, 30) },
  { id:"water7", cat:"nutri", tier:1, glyph:"drop", label:"7", name:"Đủ nước 7 ngày", desc:"Uống đủ mục tiêu nước 7 ngày liên tiếp.", run:true, unit:"ngày", ev:c=> streak(c, okRun("waterOk"), 7) },
  { id:"water30", cat:"nutri", tier:2, glyph:"drops", label:"30", name:"Cơ thể đủ nước", desc:"Uống đủ mục tiêu nước 30 ngày liên tiếp.", run:true, unit:"ngày", ev:c=> streak(c, okRun("waterOk"), 30) },
  { id:"kcal7", cat:"nutri", tier:2, glyph:"scale", label:"±10%", name:"Cân bằng năng lượng", desc:"Năng lượng nạp vào nằm trong ±10% mục tiêu calo 7 ngày liên tiếp.", run:true, unit:"ngày", ev:c=> streak(c, okRun("kcalOk"), 7) },

  /* ---- Hồi phục & theo dõi ---- */
  { id:"sleep7", cat:"recover", tier:1, glyph:"moonZ", label:"7", name:"Ngủ ngon 7 đêm", desc:"Ngủ đủ giấc (≥ mục tiêu − 30 phút, tối thiểu 7 giờ) 7 đêm liên tiếp.", run:true, unit:"đêm", ev:c=> streak(c, okRun("sleepOk"), 7) },
  { id:"sleep30", cat:"recover", tier:2, glyph:"bed", label:"30", name:"Giấc ngủ vàng", desc:"Tổng cộng 30 đêm ngủ đủ giấc.", unit:"đêm", ev:c=> cum(c, x=> x.sleepOk?1:0, 30) },
  { id:"photo", cat:"recover", tier:1, glyph:"camera", label:"", name:"Lưu dấu hành trình", desc:"Chụp ảnh tiến trình đầu tiên.", unit:"ảnh", ev:c=> nth((Array.isArray(c.st.progressPhotos)?c.st.progressPhotos:[]).filter(p=>p&&p.ts).map(p=> ds(new Date(p.ts))).filter(d=> d<=c.today), 1) },
  { id:"inbody3", cat:"recover", tier:1, glyph:"chart", label:"3", name:"Đo lường đều đặn", desc:"Ghi 3 lần chỉ số cơ thể / InBody.", unit:"lần", ev:c=> nth((Array.isArray(c.st.inbodyLogs)?c.st.inbodyLogs:[]).filter(l=>l&&l.ts).map(l=> ds(new Date(l.ts))).filter(d=> d<=c.today), 3) },
);

/* ---------------------------------------------------------------------
   3. HÌNH HUY HIỆU (SVG nét mảnh, gradient mint → coral, khung theo hạng)
   --------------------------------------------------------------------- */
const FLAME = "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z";
const NOTE = "M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6z|M9.5 3v18";
const CAL = "r:3,4.5,18,16.5,2.5|M16 2.5v4|M8 2.5v4|M3 10h18";
const GLYPHS = {
  flag: "M6 21V3.5|M6 4h11l-2.5 4 2.5 4H6|M3.5 21h5",
  dumbbell: "M6.5 7v10|M17.5 7v10|M3.5 9.5v5|M20.5 9.5v5|M6.5 12h11",
  dumbbellArc: "M6.5 10v9|M17.5 10v9|M3.5 12.5v4|M20.5 12.5v4|M6.5 14.5h11|M6 6.5a8.5 8.5 0 0 1 12 0|M12 2.5v1.5",
  crown: "M4 18 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10.5z|M4 21h16|c:12,14,1.2",
  kettlebell: "M9 8.5V7a3 3 0 0 1 6 0v1.5|M7.2 8.5h9.6a2 2 0 0 1 2 2.2l-.9 8.6a2 2 0 0 1-2 1.7H8.1a2 2 0 0 1-2-1.7l-.9-8.6a2 2 0 0 1 2-2.2z|M10 14.5h4",
  plates: "r:3.5,16,17,4,1.5|r:5,10.5,14,4,1.5|r:6.5,5,11,4,1.5",
  mountain: "M2 20 9 7.5l4 6.5 3-4.5L22 20z|M9 7.5V3l3.2 1.2L9 5.4",
  anvil: "M3 7h12.5L21 5v3.5l-4.5 2.5V13H9A6 6 0 0 1 3 7z|M10 13v4|M14.5 13v4|M7 20.5 8.5 17h8l1.5 3.5z",
  calCheck: CAL + "|M8.5 15.5l2.3 2.3 4.7-4.6",
  calGrid: CAL + "|M7.5 14h.01|M12 14h.01|M16.5 14h.01|M7.5 17.5h.01|M12 17.5h.01|M16.5 17.5h.01",
  cycle: "M20.5 12a8.5 8.5 0 1 1-2.5-6|M20.5 4v4.5H16|M8.5 12.5l2.4 2.4 4.6-4.8",
  grid4: "r:3.5,3.5,7,7,1.8|r:13.5,3.5,7,7,1.8|r:3.5,13.5,7,7,1.8|r:13.5,13.5,7,7,1.8",
  compass: "c:12,12,9|M15.5 8.5l-2 5-5 2 2-5z|M12 3v1.5|M12 19.5V21",
  sunrise: "M12 2.5v3|M4.6 7.6l2 2|M19.4 7.6l-2 2|M2.5 15.5h3|M18.5 15.5h3|M7 15.5a5 5 0 0 1 10 0|M3 19h18|M7 22h10",
  moonStar: "M14 3.5a8 8 0 1 0 6.5 12.6A6.5 6.5 0 0 1 14 3.5z|M19 2.5v3|M17.5 4h3",
  weekend: "r:2.5,5,8.5,15,2|r:13,5,8.5,15,2|M6.75 3v3.5|M17.25 3v3.5|M4.7 13.2l1.5 1.5 2.6-2.8|M15.2 13.2l1.5 1.5 2.6-2.8",
  flame: FLAME,
  flameSpark: FLAME + "|M20.5 2.5v3|M19 4h3|M3.5 3.5l1.2 1.2",
  flameRing: FLAME + "|M2.5 9.5l1.5.8|M21.5 9.5l-1.5.8|M12 0.8v1.2",
  comeback: "M9 14 4 9l5-5|M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  star: "M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.5 9.4l6.6-1z",
  diamond: "M6.5 3.5h11L21.5 9 12 21 2.5 9z|M2.5 9h19|M9.5 3.5 8 9l4 12 4-12-1.5-5.5",
  trophy: "M8 21h8|M12 16.5V21|M7 3.5h10V9a5 5 0 0 1-10 0z|M17 5h3v1.5a4 4 0 0 1-3.6 4|M7 5H4v1.5a4 4 0 0 0 3.6 4",
  bolt: "M13 2 3.5 13.5H12L11 22l9.5-11.5H12z",
  rocket: "M12 2.5c3 2.5 4.5 6 4.5 10l-2 3.5h-5l-2-3.5c0-4 1.5-7.5 4.5-10z|c:12,9.5,1.6|M7.5 13 4.5 16v3l3-1.5|M16.5 13l3 3v3l-3-1.5|M10.5 19.5 12 22l1.5-2.5",
  notebook: NOTE + "|M12.5 8h3.5|M12.5 12h3.5|M12.5 16h2",
  notebookCheck: NOTE + "|M12 12.5l1.8 1.8 3.2-3.6",
  fork: "M7 2.5v8|M4.5 2.5V7a2.5 2.5 0 0 0 5 0V2.5|M7 10.5v11|M17.5 21.5v-19c-2.5 1.5-4 4.5-4 8h4",
  egg: "M12 3c-3.6 0-6.5 5.6-6.5 10.2a6.5 6.5 0 0 0 13 0C18.5 8.6 15.6 3 12 3z|M9 14a3 3 0 0 0 3 3",
  drumstick: "c:14.5,9.5,5.5|M10.6 13.4 6 18|M4 16.5a1.6 1.6 0 1 0 1.5 2 1.6 1.6 0 1 0 2-1.5",
  fish: "M7 12c2.6-3.6 5.6-5.2 8.6-5.2 2.9 0 5.2 2.4 6.4 5.2-1.2 2.8-3.5 5.2-6.4 5.2-3 0-6-1.6-8.6-5.2z|M7 12 2.5 8.5v7z|M17.5 11h.01",
  drop: "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  drops: "M12 18.5a5.5 5.5 0 0 0 5.5-5.5c0-1.6-.8-3-2.4-4.3S12.4 5.3 12 3.3c-.4 2-1.5 4.1-3.1 5.4S6.5 11.4 6.5 13a5.5 5.5 0 0 0 5.5 5.5z|M2.5 21.5c1.6 0 1.6-1 3.2-1s1.6 1 3.2 1 1.6-1 3.1-1 1.6 1 3.2 1 1.6-1 3.2-1 1.6 1 3.1 1",
  scale: "M12 3.5v17|M5 6.5h14|M8 20.5h8|M5 6.5 2.5 13a2.5 2.5 0 0 0 5 0z|M19 6.5 16.5 13a2.5 2.5 0 0 0 5 0z",
  moonZ: "M11 4a7.5 7.5 0 1 0 9 9 6 6 0 0 1-9-9z|M15 2.5h4l-4 4h4",
  bed: "M2.5 19.5V5.5|M2.5 15h19|M21.5 19.5v-6a3 3 0 0 0-3-3H10v4.5|c:6.2,11.5,2",
  camera: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z|c:12,13,3",
  chart: "M3 3v18h18|M7 15l4-4 3 3 5-6|c:19,8,1.2",
};
/* Bài nâng chính: số đĩa tạ mỗi bên = hạng (1/2/3) */
function plateMarks(y, n){ let s = ""; for(let i=0;i<n;i++){ const xl = 3.4 + i*1.9, xr = 20.6 - i*1.9; s += `|M${xl} ${y-3}v6|M${xr} ${y-3}v6`; } return s; }
function liftGlyph(lift, n){
  if(lift==="bench") return "M1.5 5h21" + plateMarks(5, n) + "|M9 5v5|M15 5v5|M6.5 12h11|M4 15.5h16|M7 15.5v4.5|M17 15.5v4.5";
  if(lift==="squat") return "M1.5 8h21" + plateMarks(8, n) + "|c:12,4.3,1.8|M12 8v5.5|M12 13.5l-4.5 2.5 1.5 5|M12 13.5l4.5 2.5-1.5 5";
  return "M1.5 18h21" + plateMarks(18, n) + "|M12 14.5V3.5|M8.5 7 12 3.5 15.5 7|M3 22.5h18";
}
function glyphFor(b){ return b.lift ? liftGlyph(b.lift, b.plates||1) : (GLYPHS[b.glyph] || GLYPHS.star); }
function pathsSVG(d){
  return String(d).split("|").map(s=>{
    if(s.startsWith("c:")){ const a = s.slice(2).split(","); return `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}"/>`; }
    if(s.startsWith("r:")){ const a = s.slice(2).split(","); return `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" rx="${a[4]||0}"/>`; }
    return `<path d="${s}"/>`;
  }).join("");
}
const TIERS = {
  1:{ id:"bronze", label:"Đồng", c1:"#FFD2B3", c2:"#C9713F", ink:"#FFB08A" },
  2:{ id:"silver", label:"Bạc",  c1:"#FFFFFF", c2:"#86AEB8", ink:"#DDF7F1" },
  3:{ id:"gold",   label:"Vàng", c1:"#FFEDB0", c2:"#E39A2D", ink:"#FFD27A" },
};
const f1 = n=> Math.round(n*100)/100;
function polyPath(n, r, rot){ let d = ""; for(let i=0;i<n;i++){ const a = rot + i*2*Math.PI/n; d += (i?"L":"M") + f1(32+r*Math.cos(a)) + " " + f1(32+r*Math.sin(a)); } return d + "Z"; }
function rosettePath(n, r){
  const pts = []; for(let i=0;i<n;i++){ const a = -Math.PI/2 + i*2*Math.PI/n; pts.push([f1(32+r*Math.cos(a)), f1(32+r*Math.sin(a))]); }
  const chord = 2*r*Math.sin(Math.PI/n), br = f1(chord*0.56);
  return "M" + pts[0].join(" ") + pts.map((_,i)=>{ const q = pts[(i+1)%n]; return `A${br} ${br} 0 0 1 ${q[0]} ${q[1]}`; }).join("") + "Z";
}
const FRAME = {
  1: { outer: "M32 4a28 28 0 1 1 0 56a28 28 0 1 1 0-56z", inner: "M32 9a23 23 0 1 1 0 46a23 23 0 1 1 0-46z" },
  2: { outer: polyPath(6, 29.5, -Math.PI/2), inner: polyPath(6, 24.5, -Math.PI/2) },
  3: { outer: rosettePath(16, 26.2), inner: "M32 10a22 22 0 1 1 0 44a22 22 0 1 1 0-44z" },
};
let _gid = 0;
function resolve(v, c){ return typeof v==="function" ? v(c) : v; }
/* badgeSVG(b, size, {label:false, ctx}) — trả về chuỗi <svg> */
function badgeSVG(b, size, opt){
  opt = opt || {};
  const T = TIERS[b.tier] || TIERS[1], F = FRAME[b.tier] || FRAME[1];
  const id = "fkach" + (++_gid);
  const label = opt.label === false ? "" : (b.labelTxt != null ? b.labelTxt : resolve(b.label, opt.ctx) || "");
  const gs = 1.18, cy = label ? 27.5 : 32, gx = f1(32 - 12*gs), gy = f1(cy - 12*gs);
  const pips = Array.from({length:b.tier}, (_,i)=> `<circle cx="${32 + (i-(b.tier-1)/2)*4.2}" cy="${label ? 9.6 : 8.6}" r="1.15"/>`).join("");
  return `<svg class="ach-svg tier-${T.id}" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" focusable="false">`
    + `<defs><linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.c1}"/><stop offset="1" stop-color="${T.c2}"/></linearGradient>`
    + `<linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21"><stop offset="0" stop-color="#9AF1DD"/><stop offset=".5" stop-color="#5EE6C7"/><stop offset="1" stop-color="#FF7A45"/></linearGradient>`
    + `<radialGradient id="${id}b" cx=".5" cy=".32" r=".78"><stop offset="0" stop-color="#1B5361"/><stop offset=".65" stop-color="#0B2A33"/><stop offset="1" stop-color="#061A24"/></radialGradient></defs>`
    + `<path class="ach-frame" d="${F.outer}" fill="url(#${id}b)" stroke="url(#${id}f)" stroke-width="2.2" stroke-linejoin="round"/>`
    + `<path d="${F.inner}" fill="none" stroke="url(#${id}f)" stroke-width=".8" opacity=".5"${b.tier===3?' stroke-dasharray="1.5 2.2"':""}/>`
    + `<g fill="${T.ink}" opacity=".9">${pips}</g>`
    + `<g class="ach-glyph" transform="translate(${gx},${gy}) scale(${gs})" fill="none" stroke="url(#${id}g)" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${pathsSVG(glyphFor(b))}</g>`
    + (label ? `<text x="32" y="53" text-anchor="middle" fill="${T.ink}" font-family="Inter Tight, Inter, -apple-system, sans-serif" font-size="${String(label).length > 4 ? 9 : 10.4}" font-weight="700" letter-spacing=".2">${esc(label)}</text>` : "")
    + `</svg>`;
}

/* ---------------------------------------------------------------------
   4. XP & CẤP ĐỘ
   --------------------------------------------------------------------- */
const XP_RULES = { session:100, volPer:100, volCap:100, pr:25, food:20, protein:15, kcal:10, water:15, sleep:10 };
function computeXP(c, earnedTiers){
  const out = { train:0, nutri:0, water:0, sleep:0, badge:0 };
  for(const x of c.series){
    if(x.sess) out.train += XP_RULES.session * Math.min(2, x.sessN||1);   // QT-06: 2 buổi/ngày = 2 buổi (tối đa 2 để tránh "cày" XP)
    out.train += Math.min(XP_RULES.volCap, Math.floor(x.vol/XP_RULES.volPer)) + x.prs*XP_RULES.pr;
    if(x.food){ out.nutri += XP_RULES.food; if(x.protOk) out.nutri += XP_RULES.protein; if(x.kcalOk) out.nutri += XP_RULES.kcal; }
    if(x.waterOk) out.water += XP_RULES.water;
    if(x.sleepOk) out.sleep += XP_RULES.sleep;
  }
  (earnedTiers||[]).forEach(t=> out.badge += TIER_XP[t]||0);
  out.total = out.train + out.nutri + out.water + out.sleep + out.badge;
  return out;
}
const xpForLevel = L=> 60*(L-1)*(L+8);   // L2: 600 · L5: 3.120 · L10: 9.720 · L20: 31.920 · L30: 66.120 (~90 ngày tập đều ≈ cấp 13–15)
const LEVEL_TITLES = [[30,"Huyền thoại"],[20,"Tinh anh"],[15,"Vận động viên"],[10,"Chiến binh"],[5,"Người tập chăm"],[1,"Tân binh"]];
const LEVEL_RANKS  = [[30,"Huyền Thoại"],[20,"Kim Cương"],[15,"Bạch Kim"],[10,"Vàng"],[5,"Bạc"],[1,"Đồng"]];
function levelFor(xp){
  xp = Math.max(0, Math.floor(Number(xp)||0));
  let L = 1; while(L < 99 && xpForLevel(L+1) <= xp) L++;
  const a = xpForLevel(L), b = xpForLevel(L+1);
  return { lvl:L, xp, into: xp-a, need: b-a, pct: (xp-a)/(b-a), next: b,
    title: LEVEL_TITLES.find(t=> L>=t[0])[1], rank: LEVEL_RANKS.find(t=> L>=t[0])[1] };
}

/* ---------------------------------------------------------------------
   5. ĐÁNH GIÁ TỔNG
   --------------------------------------------------------------------- */
function progText(b, r, c){
  if(b.fmt) return b.fmt(r, c);
  if(b.vol) return `${tons(Math.min(r.val||0, r.target))} / ${tons(r.target)}`;
  if(b.run) return `Chuỗi hiện tại ${nf(Math.min(r.val||0, r.target))}/${nf(r.target)} ${b.unit||""}`.trim();
  return `${nf(Math.min(Math.floor(r.val||0), r.target))}/${nf(r.target)} ${b.unit||""}`.trim();
}
function evaluate(st, now){
  const c = buildCtx(st, now);
  const E = obj(c.A.earned);
  const badges = BADGES.map(b=>{
    let r; try{ r = b.ev(c) || {}; }catch(e){ r = { val:0, target:1, at:null }; }
    if(!(r.target > 0)) r.target = 1;
    const stored = E[b.id] && isDs(E[b.id].d) ? E[b.id] : null;
    const earned = !!(r.at || stored);
    const pct = earned ? 1 : Math.min(0.99, clamp01((r.val||0)/r.target));
    return Object.assign({}, b, {
      name: resolve(b.name, c), desc: resolve(b.desc, c), labelTxt: resolve(b.label, c) || "",
      r, earned, at: stored ? stored.d : r.at, pct, prog: progText(b, r, c), stored: !!stored,
    });
  });
  const xp = computeXP(c, badges.filter(b=> b.earned).map(b=> b.tier));
  const run = streak(c, sessRun, 1e9);
  const totalVol = Object.values(c.vol).reduce((a,v)=> a+v, 0);
  const prTotal = Object.values(c.prs).reduce((a,l)=> a+l.length, 0);
  return { today: c.today, ctx: c, badges, xp, level: levelFor(xp.total),
    stats: { sessions: c.series.reduce((a,x)=> a + (x.sessN||0), 0), curStreak: run.val, bestStreak: run.best, totalVol, prTotal, earned: badges.filter(b=>b.earned).length, total: badges.length } };
}
/* Huy hiệu "sắp đạt" (hiệu ứng gần đích): % cao nhất, ưu tiên hạng thấp */
function nearest(ev, n){
  return ev.badges.filter(b=> !b.earned && b.pct > 0).sort((a,b)=> (b.pct - a.pct) || (a.tier - b.tier)).slice(0, n||1);
}

/* ---------------------------------------------------------------------
   6. BỨC TƯỜNG KỶ LỤC
   --------------------------------------------------------------------- */
function prWall(st, now){
  const c = buildCtx(st, now); const SH = obj(obj(st).setHist); const rows = [];
  for(const key in SH){
    const h = SH[key]; if(!h || !Array.isArray(h.list)) continue;
    const list = h.list.filter(x=> x && isDs(x.date) && x.date<=c.today).sort((a,b)=> a.date<b.date?-1:1);
    let best = 0, bestDate = null, top = 0, prCount = 0, lastPr = null;
    for(const x of list){
      const e = Number(x.e1rm)||0;
      if(e>0 && best>0 && e > best + 0.4){ prCount++; lastPr = x.date; }
      if(e > best){ best = e; bestDate = x.date; }
      top = Math.max(top, Number(x.top)||0);
    }
    if(!(best > 0)){
      /* QT-17: bài trọng lượng cơ thể (kéo xà, chống đẩy, cầu mông…) — e1RM 0 → theo dõi KỶ LỤC SỐ LẦN (1 hiệp) */
      let rBest = 0, rDate = null, rPr = 0, rLast = null, reps = 0;
      for(const x of list){
        const sets = Array.isArray(x.sets) ? x.sets : [];
        if(sets.some(s=> (Number(s && s.kg)||0) > 0)) continue;              // có tạ → không phải hiệp tay không
        const m = sets.reduce((a, s)=> Math.max(a, Math.round(Number(s && s.reps)||0)), 0);
        reps += sets.reduce((a, s)=> a + Math.max(0, Math.round(Number(s && s.reps)||0)), 0);
        if(m > 0 && rBest > 0 && m > rBest){ rPr++; rLast = x.date; }
        if(m > rBest){ rBest = m; rDate = x.date; }
      }
      if(rBest > 0 && rBest <= 500) rows.push({ key, name: String(h.name||key), bw: true, maxReps: rBest, bestDate: rDate, totalReps: reps, e1rm: 0, top: 0,
        n: list.length, prCount: rPr, lastPr: rLast, lift: null, ratio: 0, isNew: !!(rLast && diffD(rLast, c.today) <= 7) });
      continue;
    }
    const lift = liftOf(key, h.name);
    rows.push({ key, name: String(h.name||key), e1rm: best, bestDate, top, n: list.length, prCount, lastPr, lift,
      ratio: best/c.bw, isNew: !!(lastPr && diffD(lastPr, c.today) <= 7) });
  }
  const LO = { bench:0, squat:1, deadlift:2 };
  rows.sort((a,b)=> (a.lift ? LO[a.lift] : 9) - (b.lift ? LO[b.lift] : 9) || (a.bw ? 1 : 0) - (b.bw ? 1 : 0) || String(b.lastPr||b.bestDate).localeCompare(String(a.lastPr||a.bestDate)) || b.e1rm - a.e1rm);
  const totalVol = Object.values(c.vol).reduce((a,v)=> a+v, 0);
  const prTotal = Object.values(c.prs).reduce((a,l)=> a+l.length, 0);
  const weekPrs = Object.keys(c.prs).filter(d=> diffD(d, c.today) < 7).reduce((a,d)=> a + c.prs[d].length, 0);
  return { rows, totalVol, prTotal, weekPrs, bw: c.bw };
}

/* ---------------------------------------------------------------------
   7. TỔNG KẾT TUẦN + LỜI KHUYÊN CÁ NHÂN HOÁ
   --------------------------------------------------------------------- */
function weekStats(c, mon, limitDays){
  const sun = addD(mon,6);
  /* QT-20: tuần đầu (cài app / đổi giáo án giữa tuần) chỉ tính từ ngày bắt đầu, không chấm từ thứ Hai */
  const from = c.since && c.since > mon && c.since <= sun ? c.since : mon;
  let planned = 0, due = 0;
  for(let d = from; d <= sun; d = addD(d,1)){ if(c.planned.has(dayKeyOf(d))){ planned++; if(d < c.today) due++; } }
  if(c.since && c.since > sun){ planned = 0; due = 0; }
  const w = { mon, sun, from, partial: from > mon, days:0, sessions:0, vol:0, prs:[], foodDays:0, kcalSum:0, protSum:0, water:0, waterOkDays:0, sleepDays:0, sleepSum:0,
    planned: from > mon ? planned : c.planned.size, due };
  const maxI = Math.min(7, limitDays || 7);
  for(let i=0;i<maxI;i++){
    const d = addD(mon,i); if(d > c.today) break;
    if(d < from) continue;
    w.days++;
    const x = c.byDate[d]; if(!x) continue;
    if(x.sess) w.sessions += x.sessN || 1;
    w.vol += x.vol;
    (c.prs[d]||[]).forEach(p=> w.prs.push(Object.assign({ date:d }, p)));
    if(x.food){ w.foodDays++; w.kcalSum += x.kcal; w.protSum += x.protein; }
    w.water += x.water; if(x.waterOk) w.waterOkDays++;
    if(x.sleep > 0){ w.sleepDays++; w.sleepSum += x.sleep; }
  }
  w.kcalAvg = w.foodDays ? w.kcalSum/w.foodDays : 0;
  w.protAvg = w.foodDays ? w.protSum/w.foodDays : 0;
  w.waterAvg = w.days ? w.water/w.days : 0;
  w.sleepAvg = w.sleepDays ? w.sleepSum/w.sleepDays : 0;
  return w;
}
function consecutiveFullWeeks(c, mon){
  const set = new Set(fullWeeks(c).map(w=> w.mon)); let n = 0, m = mon;
  while(set.has(m) && n < 60){ n++; m = addD(m, -7); }
  return n;
}
function weeklyTip(c, w, pw){
  const g = c.goals, planned = w.planned, goal = c.P.goal;
  /* QT-20: tuần đầu sử dụng / mới đổi giáo án → chưa chấm chuyên cần, chỉ động viên */
  if(w.partial && w.days <= 3) return { icon:"ach_spark", title:"Tuần đầu tiên — làm quen nhịp tập",
    text: `Bạn bắt đầu theo dõi từ ${dm(w.from)}. Tuần này chỉ cần hoàn thành ${planned ? `${planned} buổi còn lại theo lịch` : "1–2 buổi"} — chưa cần so sánh hay tăng tạ. Ghi kg × lần mỗi hiệp để tuần sau app gợi ý mức tạ chính xác.` };
  if(w.sessions === 0 && (w.sun < c.today || w.due > 0)) return { icon:"ach_spark", title:"Khởi động lại thật nhẹ",
    text: pw.sessions ? `Tuần trước bạn tập ${pw.sessions} buổi, tuần này chưa có buổi nào. Đừng cố tập bù — chỉ cần 2 buổi 20 phút trong tuần tới là đủ giữ nhịp. Hẹn sẵn giờ cụ thể (ví dụ “18:30 thứ Ba, ngay sau giờ làm”) giúp bạn thực hiện được dễ hơn rất nhiều.`
      : `Chọn 2 khung giờ cố định trong tuần tới và bật nhắc nhở. Buổi đầu chỉ cần 20 phút — quan trọng nhất là bắt đầu.` };
  const target = w.sun < c.today ? planned : Math.max(w.due, 0);   // tuần đang diễn ra: chỉ so với số buổi đã tới hạn
  if(target >= 2 && w.sessions < target*0.6) return { icon:"schedule", title:"Làm lịch tập dễ giữ hơn",
    text:`Bạn tập ${w.sessions}/${target} buổi theo giáo án${w.sun < c.today ? "" : " (tính tới hôm qua)"}. Nếu lịch đang quá dày, hãy giảm còn ${Math.max(2, w.sessions+1)} buổi/tuần nhưng đều đặn — tập đều quan trọng hơn tập nhiều. Ngày bận: làm buổi rút gọn 20 phút, vẫn được tính vào chuỗi.` };
  if(pw.vol > 2000 && w.vol > pw.vol*1.3) return { icon:"warning", title:"Khối lượng tăng hơi nhanh",
    text:`Tổng khối lượng tăng ${Math.round((w.vol/pw.vol-1)*100)}% so với tuần trước. Tăng quá 10–20% mỗi tuần dễ gây quá tải gân, khớp. Giữ mức hiện tại thêm 1 tuần rồi mới tăng tiếp, và ưu tiên ngủ đủ 7–9 giờ.` };
  if(w.foodDays >= 3 && g.protein && w.protAvg < g.protein*0.8){ const gap = Math.round(g.protein - w.protAvg);
    return { icon:"restaurant", title:"Bổ sung thêm đạm",
      text:`Đạm trung bình ${nf(w.protAvg)} g/ngày (khoảng ${Math.round(w.protAvg/g.protein*100)}% mục tiêu ${nf(g.protein)} g), còn thiếu ~${gap} g. Gợi ý: thêm 100 g ức gà (~31 g đạm), hoặc 2 quả trứng + 1 hộp sữa chua Hy Lạp (~22 g), hoặc 200 g đậu phụ (~16 g). Chia đều 20–40 g đạm mỗi bữa để cơ tổng hợp protein tốt nhất.` }; }
  if(w.foodDays >= 4 && g.kcal){
    const r = w.kcalAvg/g.kcal;
    if(goal==="lose" && r > 1.1) return { icon:"local_fire_department", title:"Calo đang vượt mục tiêu giảm mỡ",
      text:`Trung bình ${nf(w.kcalAvg)} kcal/ngày, cao hơn mục tiêu ${nf(g.kcal)} kcal khoảng ${nf(w.kcalAvg-g.kcal)} kcal. Cách dễ nhất: bỏ đồ uống có đường và bớt 1 thìa dầu khi nấu (~120 kcal). Giữ nguyên lượng đạm để không mất cơ.` };
    if(goal==="gain" && r < 0.9) return { icon:"restaurant", title:"Ăn thêm một chút để tăng cơ",
      text:`Trung bình ${nf(w.kcalAvg)} kcal/ngày, thấp hơn mục tiêu ${nf(g.kcal)} kcal khoảng ${nf(g.kcal-w.kcalAvg)} kcal. Thêm 1 bữa phụ ~400 kcal: 1 quả chuối + 2 thìa bơ đậu phộng + 1 ly sữa tươi. Dư năng lượng nhẹ (5–10%) giúp tăng cơ mà ít tích mỡ.` };
    if(goal==="maintain" && Math.abs(r-1) > 0.15) return { icon:"ach_scale", title:"Giữ năng lượng ổn định",
      text:`Calo trung bình ${nf(w.kcalAvg)} kcal/ngày, lệch ${Math.round(Math.abs(r-1)*100)}% so với mục tiêu duy trì ${nf(g.kcal)} kcal. Cố gắng giữ trong khoảng ±10% để cân nặng và hiệu suất tập ổn định.` };
  }
  if(g.water && w.waterAvg < g.water*0.8) return { icon:"water_drop", title:"Uống thêm nước",
    text:`Nước trung bình ${nf(w.waterAvg,1)} L/ngày, mục tiêu ${nf(g.water,1)} L. Mẹo: để sẵn chai 500 ml trong tầm mắt — uống hết 1 chai trước 10h, 1 chai trước 15h và 1 chai trong buổi tập. Mất nước khoảng 2% cân nặng đã đủ làm giảm sức bền.` };
  if(w.sleepDays >= 3 && w.sleepAvg < 7) return { icon:"bedtime", title:"Ưu tiên giấc ngủ",
    text:`Bạn ngủ trung bình ${nf(w.sleepAvg,1)} giờ/đêm. Ngủ dưới 7 giờ làm chậm phục hồi cơ và tăng cảm giác thèm ăn. Thử cố định giờ đi ngủ, tắt màn hình 30 phút trước khi ngủ và tránh cà phê sau 14h.` };
  if(w.foodDays < Math.min(4, w.days)) return { icon:"edit_calendar", title:"Ghi ăn uống đều hơn",
    text:`Bạn ghi ăn uống ${w.foodDays}/${w.days} ngày. Ghi ít nhất 5 ngày/tuần để số liệu calo, đạm đủ tin cậy — mẹo: ghi ngay sau bữa và dùng lại món quen trong danh sách.` };
  const fw = consecutiveFullWeeks(c, w.mon);
  if(fw >= 6) return { icon:"self_improvement", title:"Cân nhắc 1 tuần giảm tải",
    text:`Bạn đã tập đủ ${fw} tuần liên tiếp — rất kỷ luật! Sau 6–8 tuần, một tuần giảm tải (bớt ~40–50% số hiệp, giữ mức tạ) giúp khớp và hệ thần kinh hồi phục; tuần sau đó bạn thường khoẻ hơn.` };
  if(w.prs.length){ const names = Array.from(new Set(w.prs.map(p=> String(p.name).split(" (")[0]))).slice(0,3).join(", ");
    return { icon:"ach_trophy", title:"Đà tăng tiến rất tốt",
      text:`Bạn phá ${w.prs.length} kỷ lục (${names}). Giữ quy tắc tăng tiến: khi đạt đỉnh khoảng lần ở mọi hiệp với kỹ thuật chuẩn, tăng 2,5 kg cho bài thân trên hoặc 2,5–5 kg cho bài thân dưới.` }; }
  return { icon:"tips_and_updates", title:"Giữ nhịp ổn định",
    /* GLOSSARY §8.2: RPE = "Độ nặng cảm nhận (RPE 1–10)"; cấp Mới tập (cột RPE ẩn) → nói bằng số lần còn dư */
    text: (c.P && c.P.level === "beginner" && !c.P.showRpe)
      ? `Một tuần cân bằng! Để tiến bộ tiếp, để ý hiệp cuối mỗi bài: nếu còn dư từ 3 lần trở lên mà vẫn đúng kỹ thuật, tuần sau tăng nhẹ tạ hoặc thêm 1 lần.`
      : `Một tuần cân bằng! Để tiến bộ tiếp, hãy ghi độ nặng cảm nhận (RPE 1–10) cho hiệp cuối mỗi bài: nếu ≤ 7 (còn dư ≥ 3 lần), tuần sau tăng nhẹ tạ hoặc thêm 1 lần.` };
}
function weeklySummary(st, now, which){
  const c = buildCtx(st, now); const thisMon = mondayOf(c.today);
  const mon = which==="this" ? thisMon : addD(thisMon, -7);
  const cur = weekStats(c, mon);
  const prev = weekStats(c, addD(mon, -7), which==="this" ? cur.days : 7);   // tuần này: so cùng số ngày
  return { which: which==="this" ? "this" : "last", cur, prev, tip: weeklyTip(c, cur, prev), goals: c.goals, goal: c.P.goal };
}

/* ---------------------------------------------------------------------
   8. NHẮC QUAY LẠI + BUỔI NGẮN 20 PHÚT
   --------------------------------------------------------------------- */
function comebackInfo(st, now){
  const c = buildCtx(st, now);
  if(c.sess.has(c.today)) return null;
  const dates = Array.from(c.sess.keys()).sort(); const last = dates[dates.length-1];
  if(!last){
    const fs = c.A.firstSeen;
    if(!isDs(fs) || diffD(fs, c.today) < 3) return null;
    return { never:true, gap: diffD(fs, c.today), total:0, missed:0 };
  }
  const gap = diffD(last, c.today);
  if(gap < 3) return null;
  let missed = 0;                                   // số buổi theo lịch đã lỡ (không tính hôm nay)
  for(let d = addD(last,1); d < c.today; d = addD(d,1)) if(c.planned.has(dayKeyOf(d))) missed++;
  if(c.planned.size && missed === 0 && gap < 5) return null;   // nghỉ đúng lịch (vd T6 → T2) thì không nhắc
  return { never:false, gap, last, total: dates.length, missed };
}
function isLongCardio(it, EX){
  const meta = it.exerciseId && EX[it.exerciseId];
  const reps = String(it.reps || (meta && meta.reps) || "");
  const m = reps.match(/(\d+)\s*(?:-\s*\d+\s*)?phút/i);
  return !!(m && Number(m[1]) >= 10) || /giãn cơ/i.test(String(meta && meta.muscle || ""));
}
function quickPlan(st, now, EX){
  st = obj(st);
  if(!EX){ try{ EX = typeof EXERCISES !== "undefined" ? EXERCISES : null; }catch(e){ EX = null; } }   // EXERCISES là const (không nằm trên window)
  EX = EX || {};
  const today = ds(now instanceof Date ? now : new Date());
  const plan = obj(st.plans)[st.activePlanId];
  let src = null;
  if(plan && plan.days){
    const base = parse(today).getDay();
    for(let i=0;i<7 && !src;i++){ const k = DK[(base+i)%7]; const day = plan.days[k];
      if(day && Array.isArray(day.items) && day.items.filter(it=> !isLongCardio(it, EX)).length >= 2) src = { key:k, day }; }
  }
  let items = src ? src.day.items.filter(it=> !isLongCardio(it, EX)).slice(0,4) : [];
  let from = src ? (src.day.title || "Giáo án") : "";
  if(items.length < 2){
    items = ["bwsquat","pushup","glutebridge","invertedrow","plank"].filter(id=> EX[id]).slice(0,4)
      .map(id=> ({ exerciseId:id, sets: EX[id].sets, reps: EX[id].reps, restSec: EX[id].restSec }));
    from = "Toàn thân không dụng cụ";
  }
  /* QT-03: sàng lọc sức khoẻ áp dụng cả cho buổi nhanh (trước đây chỉ startSession được lọc) */
  const safe = quickSafety(st, items, EX, src ? src.day.intensity : "Vừa");
  items = safe.items;
  const stamp = Date.now().toString(36);
  return { from, swapped: safe.swapped, removed: safe.removed, screened: safe.screened, flags: safe.flags, items: items.map((it,i)=> Object.assign({}, it, {
    uid: `q${i}_${stamp}_${it.uid || it.exerciseId || i}`,
    sets: Math.min(2, Math.max(1, Number(it.sets)||2)),
    restSec: Math.min(60, Number(it.restSec) > 0 ? Number(it.restSec) : 45),
  })) };
}
/* Cờ sức khoẻ: dùng API công khai của health-safety.js (FKHealth.flags là hàm thuần) — không có thì bỏ qua */
function healthFlags(st){
  try{ const H = G.FKHealth; if(H && typeof H.flags === "function") return H.flags(obj(st.health), obj(st.profile)); }catch(e){}
  /* QT-03 (trình duyệt): health-safety.js nạp CUỐI → thẻ "Quay lại tập" vẽ lúc khởi động chưa có FKHealth và từng liệt kê
     Burpee cho người khai bệnh tim. Dự phòng THẬN TRỌNG từ dữ liệu sàng lọc thô (cùng tên trường với hsFlags). */
  const h = obj(st.health); if(!h.completedAt) return null;
  const p = obj(st.profile), q0 = obj(h.parq), female = p.gender === "female";
  const injuries = Array.isArray(h.injuries) ? h.injuries.filter(x=> typeof x === "string") : [];
  const preg = female && h.pregnancy === "pregnant", post = female && h.pregnancy === "postpartum";
  const cardio = h.cardio || "none", symptom = !!(q0.chestPain || q0.dizzy), supervised = !!q0.supervised;
  const hideNow = (cardio === "heart" || cardio === "htn_bad" || symptom || supervised || (preg && !!h.pregComplication)) && !h.clearedVigorous;
  return { screened:true, fallback:true, hideNow, cautionVeryHigh: hideNow || cardio !== "none" || !!q0.heart || preg, cardio, preg, post,
    tri: Math.min(3, Math.max(1, Number(h.trimester) || 1)), symptom, supervised, injuries, preCheck: cardio !== "none" || symptom || preg || post || supervised || (h.kidney && h.kidney !== "none") || h.diabetes === "type1" };
}
const QS_HIGH = /burpee|jump|nhảy|nhay|hiit|sprint|tabata|plyo|mountain ?climber|mountainclimber|leo núi|wall ?ball|wallball|thruster|sled|jumping ?jack|box ?jump/i;
function itemTagsSafe(it, intensity, EX){
  try{ const H = G.FKHealth; if(H && typeof H.itemTags === "function") return H.itemTags(it, intensity) || {}; }catch(e){}
  const m = (it.exerciseId && EX[it.exerciseId]) || it.custom || {};
  const t = `${it.exerciseId||""} ${m.name||""} ${m.muscle||""}`;
  return { veryHigh: QS_HIGH.test(t), impact: QS_HIGH.test(t), inj: [] };
}
/* Bài thay thế tác động thấp (không nhảy, không va chạm), theo thứ tự ưu tiên */
const QS_SUBS = ["glutebridge","inclinepushup","invertedrow","deadbug","bwsquat","sideplank","plank","pushup"];
function quickSafety(st, items, EX, intensity){
  const f = healthFlags(st);
  const out = { items, swapped:[], removed:0, screened: !!(f && f.screened), flags: f };
  if(!f || !f.screened) return out;
  const JOINT = ["knee","ankle","hip","lowback"];
  /* Tim mạch / huyết áp / triệu chứng / thai kỳ & sau sinh / thận / hạ đường huyết / đau khớp chi dưới → không HIIT, không nhảy */
  const noHigh = f.hideNow || f.cautionVeryHigh || f.cardio !== "none" || f.preg || f.post || f.symptom || f.supervised || f.injuries.some(j=> JOINT.includes(j));
  const noImpact = noHigh;
  if(!noHigh) return out;
  const supineBad = f.preg && f.tri >= 2;
  const bad = (it)=>{ const tg = itemTagsSafe(it, intensity, EX); return !!(tg.veryHigh || (noImpact && tg.impact)); };
  const hurts = (it)=>{ const tg = itemTagsSafe(it, "Vừa", EX); return (tg.inj||[]).some(k=> f.injuries.includes(k)) || (supineBad && tg.supine) || bad(it); };
  const used = new Set(items.map(it=> it.exerciseId).filter(Boolean));
  const next = [];
  items.forEach(it=>{
    if(!bad(it)){ next.push(it); return; }
    const sub = QS_SUBS.find(id=> EX[id] && !used.has(id) && !hurts({ exerciseId:id, reps: EX[id].reps }));
    const nm = (it.exerciseId && EX[it.exerciseId] && EX[it.exerciseId].name) || (it.custom && it.custom.name) || it.exerciseId || "Bài tập";
    if(sub){
      used.add(sub);
      next.push({ exerciseId:sub, custom:null, sets: EX[sub].sets, reps: EX[sub].reps, restSec: EX[sub].restSec, clipId:null, _swapFrom: it.exerciseId || null });
      out.swapped.push({ from: nm, to: EX[sub].name });
    } else out.removed++;
  });
  out.items = next;
  return out;
}
/* Tỷ lệ tạ khi quay lại: < 7 ngày giữ nguyên · 7–20 ngày ~90% · ≥ 21 ngày ~80% */
const returnLoad = gap=> gap >= 21 ? 0.8 : gap >= 7 ? 0.9 : 1;

/* ---------------------------------------------------------------------
   XUẤT LÕI (dùng cho Node test và module khác)
   --------------------------------------------------------------------- */
const FKAch = G.FKAch = {
  version: "1.0", BADGES, CATS, TIERS, XP_RULES, STRENGTH,
  buildCtx, evaluate, nearest, prWall, weeklySummary, weekStats, comebackInfo, quickPlan, returnLoad, lighterKg, quickSafety,
  levelFor, xpForLevel, badgeSVG, liftOf, glyphFor,
  _d: { ds, addD, diffD, mondayOf, dayKeyOf },
};

/* =====================================================================
   PHẦN GIAO DIỆN — chỉ chạy trong trình duyệt khi app đã nạp
   ===================================================================== */
if(typeof document === "undefined" || typeof G.addEventListener !== "function") return;
let _hasState = false; try{ _hasState = typeof state !== "undefined" && !!state; }catch(e){}
if(!_hasState){ console.warn("[achievements] Không thấy state — module chưa được tích hợp."); return; }

const q = (s, r)=> (r||document).querySelector(s);
const qa = (s, r)=> Array.from((r||document).querySelectorAll(s));
const warn = e=>{ try{ console.warn("[achievements]", e); }catch(_){} };
const reduceMotion = ()=>{ try{ return G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } };
const todayS = ()=> ds(new Date());
const icon = n=> `<span class="material-symbols-rounded">${n}</span>`;
let _busy = false, _checkT = null, _xpSnap = null, _prev = "profile", _filter = "all";

function ensureAch(){
  const a = state.achievements = obj(state.achievements);
  a.earned = obj(a.earned);
  a.quick = Array.isArray(a.quick) ? a.quick : [];
  if(!isDs(a.firstSeen)) a.firstSeen = todayS();
  return a;
}
function save(){ _busy = true; try{ saveState(); }catch(e){ warn(e); } finally{ _busy = false; } }
function sessionActive(){ try{ return typeof session !== "undefined" && session && !session.finished && !session.paused; }catch(e){ return false; } }
function sheetOpen(){ const b = q("#sheet-backdrop"); return !!(b && b.classList.contains("open")); }
function blockingOverlay(){
  const a = q("#auth"); if(a && a.classList.contains("open")) return true;
  const o = q("#onboarding"); if(o && o.classList.contains("open")) return true;
  /* integrator (FIX-core vòng 2 #6): lớp sàng lọc sức khoẻ, màn chào, Cửa hàng toàn màn, trang ẩn (tab nền) cũng chặn popup */
  const h = q("#hs-overlay"); if(h && h.classList.contains("open")) return true;
  const w = q("#welcome"); if(w && w.classList.contains("open")) return true;
  try{ if(document.documentElement.classList.contains("tsx-lock")) return true; }catch(e){}
  try{ if(document.hidden) return true; }catch(e){}
  return false;
}
/* integrator (FIX-core vòng 2 #6): popup + pháo giấy chạy ngay lúc mở app (~600 ms CPU ở 4×, mục lớn nhất của TBT khởi động)
   → chỉ hiện khi người dùng đã ở trong app ≥ ACH_QUIET_MS (tính từ lúc module nạp) và không có sheet/lớp phủ nào mở */
const ACH_QUIET_MS = 6000, _achBootAt = Date.now();
const achQuietLeft = ()=>{ const el = Date.now() - _achBootAt; return el < 0 ? 0 : Math.max(0, ACH_QUIET_MS - el); };   // đồng hồ lùi (giả lập) → không chờ
/* Huy hiệu "cũ": đạt từ trước hôm qua (tính lại từ lịch sử — dữ liệu cũ, đồng bộ, lần đầu bật module) → ghi nhận lặng lẽ, không popup */
function achIsOld(dateStr, today){ const d = String(dateStr || ""); if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const y = new Date(today + "T12:00:00"); y.setDate(y.getDate() - 1); const ys = y.getFullYear() + "-" + String(y.getMonth()+1).padStart(2,"0") + "-" + String(y.getDate()).padStart(2,"0");
  return d < ys; }
/* Máy yếu / tiết kiệm dữ liệu → không chạy pháo giấy (canvas 110–150 hạt × 2,3 s) */
function lowEndDevice(){ try{ const n = G.navigator || {}; return !!((n.connection && n.connection.saveData) || (Number(n.deviceMemory) && Number(n.deviceMemory) <= 2) || (Number(n.hardwareConcurrency) && Number(n.hardwareConcurrency) <= 2)); }catch(e){ return false; } }

/* ---------- Icon nét mảnh riêng của module ---------- */
function addIcons(){
  try{
    if(typeof FK_LINE === "undefined") return;
    Object.assign(FK_LINE, {
      ach_trophy: GLYPHS.trophy, ach_lock: "r:5,10.5,14,10.5,2.5|M8 10.5V7.5a4 4 0 0 1 8 0v3",
      ach_spark: "M12 2.5v4|M12 17.5v4|M2.5 12h4|M17.5 12h4|M5.3 5.3l2.8 2.8|M15.9 15.9l2.8 2.8|M5.3 18.7l2.8-2.8|M15.9 8.1l2.8-2.8",
      ach_up: "M6 15l6-6 6 6", ach_down: "M6 9l6 6 6-6", ach_flat: "M5 12h14",
      ach_arrow: "M5 12h14|M13 6l6 6-6 6", ach_scale: GLYPHS.scale, ach_medal: "c:12,14.5,6|M8.5 9.5 6 2.5h4l2 5|M15.5 9.5 18 2.5h-4l-2 5|M12 12v5",
    });
  }catch(e){ warn(e); }
}

/* ---------- Kiểm tra huy hiệu mới ---------- */
function runCheck(opt){
  opt = opt || {};
  if(!state || !state.onboarded) return null;
  if(!opt.force && sessionActive()) return null;      // đang tập: đợi kết thúc buổi rồi mới chúc mừng
  const A = ensureAch();
  const ev = evaluate(state, new Date());
  const newly = ev.badges.filter(b=> b.earned && !A.earned[b.id]);
  newly.forEach(b=>{ A.earned[b.id] = { d: b.r.at || ev.today, t: Date.now() }; b.at = A.earned[b.id].d; });
  const prevLvl = Number(A.level)||0, lvl = ev.level.lvl;
  const first = !A.init;
  let changed = newly.length > 0 || A.level !== lvl || A.xp !== ev.xp.total || first;
  A.level = lvl; A.xp = ev.xp.total;
  /* integrator: lần đầu bật module / huy hiệu đạt từ trước hôm qua = "cũ" → ghi nhận lặng lẽ (xem ở màn Thành tích), không popup + pháo giấy */
  const fresh = newly.filter(b=> !achIsOld(A.earned[b.id].d, ev.today));
  if(first){ A.init = ev.today; if(fresh.length) enqueue([{ type:"intro", list:fresh }], opt); }
  else {
    const items = fresh.sort((a,b)=> b.tier - a.tier).map(b=>({ type:"badge", b }));
    if(items.length > 3) enqueue(items.slice(0,2).concat([{ type:"intro", list: fresh.slice(2), more:true }]), opt);
    else if(items.length) enqueue(items, opt);
    if(prevLvl && lvl > prevLvl) enqueue([{ type:"level", lv: ev.level }], opt);
  }
  if(changed) save();
  return { ev, newly };
}
/* Hiệu năng (QA-training §3): mỗi saveState / vẽ Trang chủ đều hẹn kiểm tra huy hiệu → chạy lúc RẢNH
   (requestIdleCallback, tối đa chờ 2 s), không chen vào khung hình lúc chuyển màn / cuộn */
function scheduleCheck(ms){
  clearTimeout(_checkT);
  _checkT = setTimeout(()=>{
    const go = ()=>{ try{ runCheck(); }catch(e){ warn(e); } };
    if(typeof G.requestIdleCallback === "function") G.requestIdleCallback(go, { timeout:2000 }); else go();
  }, ms==null ? 1200 : ms);
}

/* ---------- Popup chúc mừng + confetti ---------- */
const _queue = []; let _popEl = null, _retryT = null, _retries = 0;
/* QA-training UX §2.7: popup huy hiệu sau buổi tập KHÔNG che màn "Hoàn thành buổi tập" (sheet) — huy hiệu mới hiện
   ngay trong màn đó (injectFinishXP); popup chúc mừng đợi tới khi người dùng đóng sheet (wrapper closeSheet) */
function enqueue(items, opt){ _queue.push(...items); setTimeout(()=> tryShow(!!(opt && opt.force && !opt.fromSession)), opt && opt.fromSession ? 900 : 250); }
function tryShow(force){
  if(_popEl || !_queue.length) return;
  const quiet = achQuietLeft();
  if(quiet > 0){ clearTimeout(_retryT); _retryT = setTimeout(()=> tryShow(force), quiet + 50); return; }   // integrator: chưa đủ vài giây trong app
  if(blockingOverlay() || sessionActive() || (!force && sheetOpen())){
    clearTimeout(_retryT); if(_retries++ < 90) _retryT = setTimeout(()=> tryShow(false), 2000); return;
  }
  _retries = 0;
  showPop(_queue.shift());
}
function popHTML(it){
  if(it.type==="level"){
    const lv = it.lv;
    return `<div class="ach-pop-eyebrow">${icon("ach_spark")}Lên cấp!</div>
      <div class="ach-pop-level"><div class="ach-pop-lvnum">${lv.lvl}</div></div>
      <h3 id="ach-pop-title">Cấp ${lv.lvl} · ${esc(lv.title)}</h3>
      <p>Bạn đã đạt ${nf(lv.xp)} XP — hạng <b>${esc(lv.rank)}</b>. Mỗi buổi tập, mỗi ngày ăn uống và uống nước đều đặn đều góp XP.</p>
      <div class="ach-pop-actions"><button class="btn btn-outline" data-pop="open">Xem thành tích</button><button class="btn btn-primary" data-pop="ok">Tiếp tục</button></div>`;
  }
  if(it.type==="intro"){
    const L = it.list.slice().sort((a,b)=> b.tier - a.tier);
    return `<div class="ach-pop-eyebrow">${icon("ach_medal")}${it.more ? "Còn nữa" : "Thành tích của bạn"}</div>
      <div class="ach-pop-row">${L.slice(0,5).map(b=> `<span title="${esc(b.name)}">${badgeSVG(b, 58, { label:false })}</span>`).join("")}</div>
      <h3 id="ach-pop-title">${it.more ? `Và ${L.length} huy hiệu khác` : `Đã mở khoá ${L.length} huy hiệu`}</h3>
      <p>${it.more ? "Bạn đang có một ngày rất năng suất!" : "TapEasy đã tính lại từ lịch sử tập luyện, ăn uống và nghỉ ngơi của bạn. Tiếp tục để mở khoá những huy hiệu kế tiếp nhé."}</p>
      <div class="ach-pop-xp">+${nf(L.reduce((a,b)=> a + TIER_XP[b.tier], 0))} XP</div>
      <div class="ach-pop-actions"><button class="btn btn-outline" data-pop="open">Xem tất cả</button><button class="btn btn-primary" data-pop="ok">Tuyệt vời!</button></div>`;
  }
  const b = it.b, T = TIERS[b.tier];
  return `<div class="ach-pop-eyebrow tier-${T.id}">${icon("ach_medal")}Huy hiệu mới · ${T.label}</div>
    <div class="ach-pop-badge tier-${T.id}"><i class="ach-rays" aria-hidden="true"></i>${badgeSVG(b, 136)}</div>
    <h3 id="ach-pop-title">${esc(b.name)}</h3>
    <p>${esc(b.desc)}</p>
    <div class="ach-pop-xp">+${TIER_XP[b.tier]} XP</div>
    <div class="ach-pop-actions"><button class="btn btn-outline" data-pop="open">Xem thành tích</button><button class="btn btn-primary" data-pop="ok">${_queue.length ? "Tiếp" : "Tuyệt vời!"}</button></div>`;
}
function showPop(it){
  const host = q("#app-shell") || document.body;
  const el = document.createElement("div");
  el.className = "ach-pop" + (host === document.body ? " fixed" : "");
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "ach-pop-title");
  el.innerHTML = `<div class="ach-pop-card">${popHTML(it)}</div>`;
  host.appendChild(el); _popEl = el;
  const prevFocus = document.activeElement;
  const close = (goOpen)=>{
    if(!_popEl) return;
    el.classList.add("out");
    document.removeEventListener("keydown", onKey, true);
    setTimeout(()=>{ el.remove(); _popEl = null;
      if(goOpen){ _queue.length = 0; if(sheetOpen()) try{ closeSheet(); }catch(e){} openScreen(); }
      else if(_queue.length) setTimeout(()=> tryShow(true), 180);
      else if(prevFocus && prevFocus.focus) try{ prevFocus.focus(); }catch(e){}
    }, reduceMotion() ? 0 : 200);
  };
  const onKey = e=>{ if(e.key==="Escape"){ e.stopPropagation(); close(false); } };
  document.addEventListener("keydown", onKey, true);
  el.addEventListener("click", e=>{
    const b = e.target.closest("[data-pop]");
    if(b) close(b.dataset.pop==="open"); else if(e.target === el) close(false);
  });
  const ok = q("[data-pop='ok']", el); if(ok) setTimeout(()=>{ try{ ok.focus({ preventScroll:true }); }catch(e){} }, 60);
  if(it.type !== "intro" || !it.more) confetti(el, it.type==="badge" ? it.b.tier : 2);
  try{ if(!reduceMotion() && navigator.vibrate) navigator.vibrate([18, 40, 18]); }catch(e){}
}
function confetti(host, tier){
  if(reduceMotion() || lowEndDevice()) return;
  try{
    const cv = document.createElement("canvas"); cv.className = "ach-confetti"; cv.setAttribute("aria-hidden","true");
    host.insertBefore(cv, host.firstChild);
    const W = host.clientWidth || 360, H = host.clientHeight || 640, dpr = Math.min(2, G.devicePixelRatio||1);
    cv.width = W*dpr; cv.height = H*dpr;
    const ctx = cv.getContext && cv.getContext("2d"); if(!ctx){ cv.remove(); return; }
    ctx.scale(dpr, dpr);
    const cols = tier===3 ? ["#FFD27A","#FFEDB0","#5EE6C7","#FF7A45","#FFFFFF"] : ["#5EE6C7","#9AF1DD","#FF7A45","#FFB08A","#FFFFFF"];
    const N = Math.min(tier===3 ? 150 : 110, Math.round(W*H/2600));
    const ps = Array.from({length:N}, ()=>({ x: W/2 + (Math.random()-.5)*70, y: H*0.36, vx: (Math.random()-.5)*10, vy: -Math.random()*11-3,
      r: 2.5+Math.random()*3.5, a: Math.random()*6.28, va: (Math.random()-.5)*.35, c: cols[Math.random()*cols.length|0], s: Math.random() < .6 }));
    const t0 = performance.now(), D = 2300;
    const tick = t=>{
      const k = (t - t0)/D;
      if(k >= 1 || !cv.isConnected){ cv.remove(); return; }
      ctx.clearRect(0,0,W,H); ctx.globalAlpha = k > .65 ? Math.max(0,(1-k)/.35) : 1;
      for(const p of ps){
        p.vy += .26; p.vx *= .985; p.vy *= .992; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        if(p.s) ctx.fillRect(-p.r, -p.r*.38, p.r*2, p.r*.76); else { ctx.beginPath(); ctx.arc(0,0,p.r*.55,0,6.283); ctx.fill(); }
        ctx.restore();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }catch(e){ warn(e); }
}

/* ---------- Thành phần giao diện dùng chung ---------- */
let _rid = 0;
function ringSVG(pct, size, stroke){
  const id = "fkachr" + (++_rid), r = (size-stroke)/2, c = 2*Math.PI*r, off = c*(1-clamp01(pct));
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9AF1DD"/><stop offset=".6" stop-color="#5EE6C7"/><stop offset="1" stop-color="#FF7A45"/></linearGradient></defs>`
    + `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="${stroke}"/>`
    + `<circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
}
function levelBlock(ev, size){
  const L = ev.level;
  return `<div class="ach-lvl">
    <div class="ach-lvl-ring" style="width:${size}px;height:${size}px">${ringSVG(L.pct, size, size > 70 ? 7 : 5)}<div class="ach-lvl-num"><b>${L.lvl}</b><small>cấp</small></div></div>
    <div class="ach-lvl-info">
      <div class="ach-lvl-title">${esc(L.title)} <span class="ach-rank">Hạng ${esc(L.rank)}</span></div>
      <div class="ach-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${L.need}" aria-valuenow="${L.into}" aria-label="Tiến độ lên cấp ${L.lvl+1}"><i style="width:${Math.round(L.pct*100)}%"></i></div>
      <div class="ach-lvl-sub">${nf(L.into)}/${nf(L.need)} XP · còn ${nf(L.need - L.into)} XP lên cấp ${L.lvl+1}</div>
    </div></div>`;
}
function bindOpen(root){
  qa("[data-ach-open]", root).forEach(el=>{
    el.addEventListener("click", e=>{ if(e.target.closest("[data-ach-week],[data-ach-quick],[data-ach-snooze],[data-ach-wkdismiss]")) return; openScreen(); });
    el.addEventListener("keydown", e=>{ if((e.key==="Enter" || e.key===" ") && e.target === el){ e.preventDefault(); openScreen(); } });
  });
  qa("[data-ach-week]", root).forEach(b=> b.addEventListener("click", e=>{ e.stopPropagation(); openWeekly("last"); }));
}

/* ---------- TRANG CHỦ ---------- */
function comebackCardHTML(cb){
  const name = esc(String((state.profile && state.profile.name) || "").trim().split(" ").slice(-1)[0] || "bạn");
  const plan = quickPlan(state, new Date());
  let k, h, body;
  if(cb.never){ k = "Chưa có buổi tập nào"; h = "Buổi đầu tiên chỉ cần 20 phút";
    body = "Bắt đầu nhỏ để tạo đà: 4 bài × 2 hiệp, không cần hoàn hảo. Xong buổi này bạn nhận ngay huy hiệu “Bước chân đầu tiên”."; }
  else if(cb.gap < 7){ k = `${cb.gap} ngày chưa tập`; h = `Quay lại nhẹ nhàng nhé, ${name}`;
    body = "Nghỉ vài ngày không làm mất cơ hay sức mạnh — cơ thể còn hồi phục tốt hơn. Một buổi ngắn hôm nay giúp nối lại thói quen trước khi nó nguội đi."; }
  else if(cb.gap < 21){ k = `${cb.gap} ngày chưa tập`; h = "Sức mạnh của bạn vẫn còn nguyên";
    body = `Sau ${cb.gap} ngày, sức mạnh hầu như chưa giảm (thường phải nghỉ hẳn 2–3 tuần mới giảm rõ). Buổi 20 phút với ~90% mức tạ cũ là cách quay lại an toàn — app đã tự giảm tạ sẵn cho bạn.`; }
  else { k = `${cb.gap} ngày chưa tập`; h = "Chào mừng bạn trở lại!";
    body = "Hãy bắt đầu với ~80% mức tạ cũ và ít hiệp hơn để tránh đau mỏi cơ khởi phát muộn (DOMS). Chỉ 2–3 buổi là bạn bắt nhịp lại — “trí nhớ cơ bắp” giúp lấy lại sức nhanh hơn lần đầu."; }
  const reward = !cb.never && cb.gap >= 8 && !ensureAch().earned.comeback ? `<div class="ach-cb-reward">${badgeSVG(BADGES.find(b=>b.id==="comeback"), 34, { label:false })}<span>Hoàn thành để nhận huy hiệu <b>Trở lại mạnh mẽ</b></span></div>` : "";
  return `<div class="card ach-home ach-comeback" role="region" aria-label="Gợi ý quay lại tập">
    <div class="ach-cb-head"><span class="ach-cb-ic">${icon("ach_spark")}</span><div><div class="ach-cb-k">${k}</div><h3>${h}</h3></div></div>
    <p class="ach-cb-body">${body}</p>
    <div class="ach-cb-plan">
      <div class="ach-cb-plan-h">${icon("timer")}<span>Buổi ngắn ~20 phút · ${esc(plan.from)}</span></div>
      <ol>${plan.items.map(it=>{ let nm = ""; try{ nm = getExerciseMeta(it).name; }catch(e){ nm = it.exerciseId || ""; }
        return `<li><span>${esc(String(nm).split(" (")[0])}</span><b>${it.sets} × ${esc(String(it.reps))}</b></li>`; }).join("")}</ol>
    </div>
    ${plan.swapped && plan.swapped.length ? `<p class="ach-cb-note ach-cb-safe">${icon("health_and_safety")}Theo sàng lọc sức khoẻ: ${plan.swapped.map(x=> `${esc(String(x.from).split(" (")[0])} → ${esc(String(x.to).split(" (")[0])}`).join(", ")}</p>` : ""}
    ${reward}
    <div class="ach-cb-actions"><button class="btn btn-primary" data-ach-quick>${icon("play_arrow")}Bắt đầu 20 phút</button><button class="btn btn-ghost" data-ach-snooze>Để mai</button></div>
    <p class="ach-cb-note">Buổi ngắn vẫn được tính vào chuỗi ngày tập.</p>
  </div>`;
}
function deltaHTML(cur, prev, unit, digits){
  const d = cur - prev; if(!prev && !cur) return `<span class="ach-d flat">${icon("ach_flat")}–</span>`;
  if(Math.abs(d) < (digits ? 0.05 : 0.5)) return `<span class="ach-d flat">${icon("ach_flat")}bằng tuần trước</span>`;
  return `<span class="ach-d ${d>0?"up":"down"}">${icon(d>0?"ach_up":"ach_down")}${d>0?"+":"−"}${nf(Math.abs(d), digits||0)}${unit||""}</span>`;
}
function weekCardHTML(ws){
  const w = ws.cur, pw = ws.prev;
  return `<div class="card ach-home ach-weekcard" role="region" aria-label="Tổng kết tuần">
    <div class="ach-wk-head"><div><div class="ach-cb-k">${dm(w.mon)} – ${dm(w.sun)}</div><h3>Tổng kết tuần qua</h3></div>
      <button class="icon-btn ach-x" data-ach-wkdismiss aria-label="Ẩn tổng kết tuần">${icon("close")}</button></div>
    <div class="ach-wk-mini">
      <div><b>${w.sessions}${w.planned ? `<small>/${w.planned}</small>` : ""}</b><span>buổi tập</span>${deltaHTML(w.sessions, pw.sessions)}</div>
      <div><b>${tons(w.vol)}</b><span>khối lượng</span>${deltaHTML(w.vol/1000, pw.vol/1000, " t", 1)}</div>
      <div><b>${w.prs.length}</b><span>kỷ lục mới</span></div>
    </div>
    <div class="ach-tip-mini">${icon(ws.tip.icon)}<span><b>${esc(ws.tip.title)}</b></span></div>
    <button class="btn btn-outline btn-block btn-sm" data-ach-week>Xem chi tiết &amp; lời khuyên</button>
  </div>`;
}
function miniCardHTML(ev){
  const next = nearest(ev, 1)[0];
  const recent = ev.badges.filter(b=> b.earned).sort((a,b)=> String(b.at).localeCompare(String(a.at)) || b.tier - a.tier).slice(0, 4);
  return `<div class="card ach-home ach-mini" data-ach-open role="button" tabindex="0" aria-label="Mở màn Thành tích">
    <div class="ach-mini-top">${levelBlock(ev, 58)}<span class="ach-chev">${icon("chevron_right")}</span></div>
    ${next ? `<div class="ach-next">
        <span class="ach-next-svg locked">${badgeSVG(next, 46, { label:false })}</span>
        <div class="ach-next-info"><div class="ach-next-k">Sắp đạt · ${Math.round(next.pct*100)}%</div><div class="ach-next-n">${esc(next.name)}</div>
        <div class="ach-bar sm"><i style="width:${Math.round(next.pct*100)}%"></i></div><div class="ach-next-p">${esc(next.prog)}</div></div>
      </div>` : ""}
    <div class="ach-mini-foot">
      <div class="ach-mini-badges" aria-label="${ev.stats.earned}/${ev.stats.total} huy hiệu">${recent.map(b=> badgeSVG(b, 32, { label:false })).join("")}<span>${ev.stats.earned}/${ev.stats.total} huy hiệu</span></div>
      <button class="btn btn-sm btn-outline" data-ach-week>${icon("summarize")}Tuần</button>
    </div>
  </div>`;
}
function homeInject(){
  const el = q("#home-content"); if(!el || !state.onboarded) return;
  qa(".ach-home", el).forEach(n=> n.remove());
  const now = new Date(), A = ensureAch(), ev = evaluate(state, now), today = ev.today;
  const anchor = q(".home-hero", el) || el.firstElementChild;
  const ins = (html, before)=>{ const w = document.createElement("div"); w.innerHTML = html.trim(); const n = w.firstElementChild;
    if(before && before.parentNode) before.parentNode.insertBefore(n, before); else el.appendChild(n); return n; };
  /* 1. Nhắc quay lại (ưu tiên cao nhất) */
  const cb = comebackInfo(state, now);
  if(cb && A.snooze !== today){
    const card = ins(comebackCardHTML(cb), anchor);
    q("[data-ach-quick]", card).addEventListener("click", ()=> startQuick(cb));
    q("[data-ach-snooze]", card).addEventListener("click", ()=>{ ensureAch().snooze = today; save(); card.remove(); try{ toast("Hẹn bạn ngày mai nhé!", "schedule"); }catch(e){} });
  }
  /* 2. Tổng kết tuần: thứ Hai (tới hết thứ Tư nếu chưa xem) */
  const dayIdx = (now.getDay()+6)%7, mon = mondayOf(today);
  if(dayIdx <= 2 && A.seenWeek !== mon){
    const ws = weeklySummary(state, now, "last");
    const w = ws.cur;
    if(w.sessions || w.foodDays || w.water > 0 || ws.prev.sessions){
      const card = ins(weekCardHTML(ws), anchor);
      bindOpen(card);
      q("[data-ach-wkdismiss]", card).addEventListener("click", ()=>{ ensureAch().seenWeek = mon; save(); card.remove(); });
    }
  }
  /* 3. Thẻ cấp độ + huy hiệu sắp đạt (sau các chỉ số trong ngày) */
  const metric = q(".metric-grid", el);
  const mini = ins(miniCardHTML(ev), metric ? metric.nextSibling : null);
  bindOpen(mini);
  scheduleCheck(700);
  /* QT-03: vẽ lúc khởi động trước khi health-safety.js nạp → vẽ lại thẻ 1 lần khi FKHealth đã sẵn.
     Vòng 2: ưu tiên sự kiện "fk:health-ready" (health-safety.js phát khi gán window.FKHealth — FIX-training §4.3);
     DOMContentLoaded chỉ còn là dự phòng cho bản health-safety chưa phát sự kiện. Chỉ vẽ lại 1 lần (_reinjectDone). */
  if(cb && !G.FKHealth && !_reinjectWait){
    _reinjectWait = true;
    const again = ()=>{
      if(_reinjectDone || !G.FKHealth) return;
      _reinjectDone = true;
      try{ if(q("#home-content") && state.onboarded) homeInject(); }catch(e){ warn(e); }
    };
    try{ document.addEventListener("fk:health-ready", ()=> setTimeout(again, 0), { once:true }); }catch(e){}
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", ()=> setTimeout(again, 0), { once:true });
    else setTimeout(again, 0);
  }
}
let _reinjectWait = false, _reinjectDone = false;

/* ---------- BUỔI NGẮN 20 PHÚT ---------- */
function startQuick(cb){
  try{
    if(typeof session !== "undefined" && session && session._quick && session.paused && !session.finished){ session.paused = false; renderSessionStep(); return; }
    const plan = quickPlan(state, new Date());
    if(!plan.items.length){ goto("workout"); return; }
    const go = ()=>{
      _xpSnap = evaluate(state, new Date()).xp.total;
      // QT-07: chốt ngày lúc bắt đầu (như startSession của app.js) → buổi qua nửa đêm ghi trọn vào 1 ngày
      const s = { dayKey: todayDayKey(), idx:0, items: plan.items, isToday:true, completed:[], _quick:true, sets:{},
        date: todayS(), sid: (typeof uid === "function" ? uid() : "q" + Date.now()), startedAt: Date.now() };
      /* Quay lại sau thời gian nghỉ dài → tự giảm tạ so với lần trước */
      const f = cb && !cb.never ? returnLoad(cb.gap) : 1;
      if(f < 1){
        plan.items.forEach(it=>{
          const key = typeof exKey==="function" ? exKey(it) : it.exerciseId;
          const last = state.setLog && state.setLog[key];
          const timed = typeof isTimedReps==="function" ? isTimedReps(it.reps) : false;
          if(!last || !Array.isArray(last.sets) || !last.sets.length || timed) return;
          const kg0 = Math.max(...last.sets.map(x=> Number(x.kg)||0)); if(!kg0) return;
          const meta = getExerciseMeta(it), step = typeof weightStep==="function" ? weightStep(meta) : 2.5;
          const kg = lighterKg(kg0, f, step);                       // QT-02: tạ nhỏ (≤ 12,5 kg) vẫn giảm được
          const bottom = typeof repBottom==="function" ? (repBottom(it.reps) || "") : "";
          const reps = kg == null && bottom ? Math.max(1, bottom - 2) : bottom;   // không giảm được tạ → giảm số lần
          s.sets[it.uid] = Array.from({ length: it.sets }, ()=> ({ kg: kg == null ? kg0 : kg, reps, rpe:"", done:false }));
        });
      }
      session = s;
      renderSessionStep();
      const msgs = [];
      if(f < 1) msgs.push(`Đã giảm tạ còn ~${Math.round(f*100)}% lần trước để quay lại an toàn`);
      if(plan.swapped && plan.swapped.length) msgs.push(`Đã thay ${plan.swapped.length} bài cường độ cao bằng bài tác động thấp theo sàng lọc sức khoẻ`);
      if(msgs.length) setTimeout(()=>{ try{ toast(msgs.join(" · "), f < 1 ? "trending_down" : "health_and_safety"); }catch(e){} }, 400);
    };
    /* QT-03: kiểm tra nhanh trước buổi tập (như startSession của health-safety) — 1 lần/ngày */
    const fl = plan.flags;
    const h = state.health = obj(state.health);
    if(fl && fl.screened && fl.preCheck && h.lastPreCheck !== todayS()){
      try{ const H = G.FKHealth; if(H && typeof H.openPreSession === "function"){ H.openPreSession(go); return; } }catch(e){}
      openQuickPreCheck(fl, go); return;
    }
    go();
  }catch(e){ warn(e); try{ goto("workout"); }catch(_){} }
}
/* Giảm tạ theo tỉ lệ nhưng LUÔN nhẹ hơn tạ cũ (roundTo theo nấc 2,5 kg trả lại đúng mức cũ khi tạ ≤ 12,5 kg) — null nếu không giảm được */
function lighterKg(base, factor, step){
  base = Number(base)||0; step = Number(step)||2.5; if(!(base > 0)) return null;
  let v = Math.round(base*factor/step)*step;
  if(v >= base){ const fine = base <= 10 ? 0.5 : 1; v = Math.floor(base*factor/fine)*fine; }
  v = Math.round(v*100)/100;
  return v > 0 && v < base ? v : null;
}
function openQuickPreCheck(f, onGo){
  const li = [];
  if(f.symptom || f.supervised || f.pregComp) li.push(`<li class="urgent"><b>Bạn nên được bác sĩ cho phép trước khi tập.</b></li>`);
  if(f.cardio !== "none") li.push(`<li>Huyết áp lúc nghỉ ≥ 180/110 mmHg, đau ngực, khó thở → <b>không tập hôm nay</b>. Không nín thở khi nâng tạ.</li>`);
  if(f.hypo || f.diab === "type1") li.push(`<li>Đã đo đường huyết? Dưới ~5,6 mmol/L → ăn 15–30 g tinh bột trước, mang theo kẹo / đường viên.</li>`);
  if(f.preg) li.push(`<li>Dừng ngay nếu ra máu, co thắt đau, chóng mặt, đau ngực. Giữ mức "vẫn nói chuyện được", uống đủ nước.</li>`);
  if(f.post) li.push(`<li>Sau sinh: tăng dần, ưu tiên sàn chậu và hơi thở; dừng nếu són tiểu, nặng vùng chậu.</li>`);
  if(f.kidney && f.kidney !== "none") li.push(`<li>Uống nước theo chỉ định của bác sĩ thận; không tập ngay sau buổi lọc máu.</li>`);
  li.push(`<li>Buổi 20 phút đã bỏ bài nhảy / cường độ rất cao. Đau / tức ngực, khó thở bất thường, choáng váng → dừng ngay, gọi <b>115</b>.</li>`);
  openSheet(`
    <div class="sheet-header"><h3>Kiểm tra nhanh trước khi tập</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${icon("close")}</button></div>
    <ul class="hs-precheck">${li.join("")}</ul>
    <button class="btn btn-primary btn-block" id="ach-pre-go" style="margin-top:12px;">${icon("play_arrow")}Tôi đã kiểm tra — bắt đầu</button>
    <p class="small-note" style="text-align:center;margin-top:6px;">Chỉ nhắc 1 lần mỗi ngày.</p>`);
  const b = q("#ach-pre-go");
  if(b) b.addEventListener("click", ()=>{ obj(state.health).lastPreCheck = todayS(); try{ saveState(); }catch(e){} onGo(); });
}

/* ---------- MÀN THÀNH TÍCH ---------- */
function ensureScreen(){
  if(q("#screen-achieve")) return;
  const host = q("#app-scroll"); if(!host) return;
  const sec = document.createElement("section");
  sec.id = "screen-achieve"; sec.className = "screen";
  sec.innerHTML = `<div class="topbar">
      <button class="icon-btn" id="ach-back" aria-label="Quay lại">${icon("arrow_back")}</button>
      <div class="logo">Thành tích</div>
      <button class="icon-btn" id="ach-week-top" aria-label="Tổng kết tuần">${icon("summarize")}</button>
    </div>
    <div class="content" id="ach-content"></div>`;
  host.appendChild(sec);
  q("#ach-back", sec).addEventListener("click", ()=> goto(_prev || "profile"));
  q("#ach-week-top", sec).addEventListener("click", ()=> openWeekly("last"));
  try{ if(typeof SUB_SCREENS !== "undefined" && Array.isArray(SUB_SCREENS) && !SUB_SCREENS.includes("achieve")) SUB_SCREENS.push("achieve"); }catch(e){}
}
function openScreen(){ ensureScreen(); goto("achieve"); }
function tileHTML(b){
  const T = TIERS[b.tier];
  return `<button class="ach-tile tier-${T.id} ${b.earned ? "earned" : "locked"}" data-ach-badge="${b.id}" aria-label="${esc(b.name)}, hạng ${T.label}, ${b.earned ? "đã đạt ngày " + dmy(b.at) : "đã được " + Math.round(b.pct*100) + "%"}">
    <span class="ach-tile-svg">${badgeSVG(b, 76)}${b.earned ? "" : `<span class="ach-lock">${icon("ach_lock")}</span>`}</span>
    <b>${esc(b.name)}</b>
    ${b.earned ? `<small class="ach-tile-date">${dmy(b.at)}</small>` : `<small>${Math.round(b.pct*100)}%</small><i class="ach-bar xs"><i style="width:${Math.round(b.pct*100)}%"></i></i>`}
  </button>`;
}
function prWallHTML(){
  const W = prWall(state, new Date());
  if(!W.rows.length) return `<div class="card ach-prwall"><p class="empty-hint">Chưa có kỷ lục nào — ghi kg × lần trong buổi tập để TapEasy tự theo dõi 1RM ước tính và kỷ lục của bạn.</p></div>`;
  const LN = { bench:"Đẩy ngực", squat:"Gánh đùi", deadlift:"Deadlift" };
  return `<div class="card ach-prwall">
    <div class="ach-pw-stats">
      <div><b>${tons(W.totalVol)}</b><span>tổng khối lượng</span></div>
      <div><b>${nf(W.prTotal)}</b><span>kỷ lục đã phá</span></div>
      <div><b>${nf(W.weekPrs)}</b><span>kỷ lục 7 ngày qua</span></div>
    </div>
    <div class="ach-pw-grid">${W.rows.slice(0, 18).map(r=>{
      const parts = r.name.split(" ("); const vi = parts[0], en = parts[1] ? parts[1].replace(/\)$/, "") : "";
      if(r.bw) return `<button class="ach-pw ach-pw-bw ${r.isNew ? "new" : ""}" data-ach-pr="${esc(r.key)}" aria-label="${esc(vi)}: kỷ lục ${nf(r.maxReps)} lần trong 1 hiệp">
        ${r.isNew ? `<span class="ach-new">Mới</span>` : ""}
        <span class="ach-pw-n">${esc(vi)}</span>
        ${en ? `<span class="ach-pw-en">${esc(en)}</span>` : ""}
        <b>${nf(r.maxReps)}<small> lần</small></b>
        <span class="ach-pw-m">Kỷ lục số lần / hiệp · ${esc(dm(r.bestDate))}</span>
        <span class="ach-pw-m">Tổng ${nf(r.totalReps)} lần · ${nf(r.n)} buổi</span>
      </button>`;
      return `<button class="ach-pw ${r.lift ? "big" : ""} ${r.isNew ? "new" : ""}" data-ach-pr="${esc(r.key)}" aria-label="${esc(vi)}: 1RM ước tính ${nf(r.e1rm)} kg">
        ${r.isNew ? `<span class="ach-new">Mới</span>` : ""}
        <span class="ach-pw-n">${esc(r.lift ? LN[r.lift] : vi)}</span>
        ${en && !r.lift ? `<span class="ach-pw-en">${esc(en)}</span>` : r.lift ? `<span class="ach-pw-en">${nf(r.ratio, 2)}× cân nặng</span>` : ""}
        <b>${nf(r.e1rm)}<small> kg</small></b>
        <span class="ach-pw-m">1RM ước tính · ${dm(r.bestDate)}</span>
        <span class="ach-pw-m">Tạ nặng nhất ${nf(r.top,1)} kg · ${r.n} buổi</span>
      </button>`; }).join("")}</div>
    <p class="small-note">1RM ước tính theo công thức Epley: tạ × (1 + lần/30). Chạm vào một bài để xem biểu đồ.</p>
  </div>`;
}
function renderAchScreen(){
  ensureScreen();
  const box = q("#ach-content"); if(!box) return;
  let chk = null; try{ chk = runCheck(); }catch(e){ warn(e); }
  const ev = (chk && chk.ev) || evaluate(state, new Date()), S = ev.stats, X = ev.xp;   // dùng lại kết quả runCheck — không tính 2 lần
  const near = nearest(ev, 3);
  const list = ev.badges.filter(b=> _filter==="earned" ? b.earned : _filter==="locked" ? !b.earned : true);
  box.innerHTML = `
    <div class="card ach-hero">
      ${levelBlock(ev, 92)}
      <div class="ach-xp-parts">
        <span>${icon("fitness_center")}Tập luyện <b>${nf(X.train)}</b></span>
        <span>${icon("restaurant")}Ăn uống <b>${nf(X.nutri)}</b></span>
        <span>${icon("water_drop")}Nước <b>${nf(X.water)}</b></span>
        <span>${icon("bedtime")}Giấc ngủ <b>${nf(X.sleep)}</b></span>
        <span>${icon("ach_medal")}Huy hiệu <b>${nf(X.badge)}</b></span>
      </div>
    </div>
    <div class="stat-grid ach-stats">
      <div class="stat-box"><div class="num">${S.earned}<small>/${S.total}</small></div><div class="cap">Huy hiệu</div></div>
      <div class="stat-box"><div class="num">${S.sessions}</div><div class="cap">Buổi tập</div></div>
      <div class="stat-box"><div class="num">${S.bestStreak}</div><div class="cap">Chuỗi dài nhất</div></div>
    </div>
    <button class="btn btn-outline btn-block" data-ach-week>${icon("summarize")}Tổng kết tuần &amp; lời khuyên</button>
    ${near.length ? `<div class="section-title"><h3>Sắp đạt</h3></div>
    <div class="ach-near">${near.map(b=> `<button class="ach-near-row" data-ach-badge="${b.id}">
        <span class="ach-next-svg locked">${badgeSVG(b, 50, { label:false })}</span>
        <span class="ach-near-info"><b>${esc(b.name)}</b><span class="ach-bar sm"><i style="width:${Math.round(b.pct*100)}%"></i></span><small>${esc(b.prog)}</small></span>
        <span class="ach-near-pct">${Math.round(b.pct*100)}%</span></button>`).join("")}</div>` : ""}
    <div class="section-title"><h3>Huy hiệu</h3></div>
    <div class="ach-filter" role="tablist" aria-label="Lọc huy hiệu">
      ${[["all","Tất cả", S.total],["earned","Đã đạt", S.earned],["locked","Chưa đạt", S.total - S.earned]].map(([k,l,n])=>
        `<button role="tab" aria-selected="${_filter===k}" class="ach-chip ${_filter===k?"active":""}" data-ach-filter="${k}">${l} <i>${n}</i></button>`).join("")}
    </div>
    ${CATS.map(cat=>{ const L = list.filter(b=> b.cat===cat.id); if(!L.length) return "";
      const all = ev.badges.filter(b=> b.cat===cat.id);
      return `<div class="ach-cat"><div class="ach-cat-h">${icon(cat.icon)}<span>${cat.label}</span><small>${all.filter(b=>b.earned).length}/${all.length}</small></div>
        <div class="ach-grid">${L.map(tileHTML).join("")}</div></div>`; }).join("") || `<p class="empty-hint">Chưa có huy hiệu nào ở mục này — tiếp tục nhé!</p>`}
    <div class="section-title"><h3>Bức tường kỷ lục</h3></div>
    ${prWallHTML()}
    <p class="small-note ach-foot">XP: buổi tập +${XP_RULES.session} · mỗi 100 kg khối lượng +1 (tối đa ${XP_RULES.volCap}/ngày) · kỷ lục +${XP_RULES.pr} · ghi ăn uống +${XP_RULES.food} · đủ đạm +${XP_RULES.protein} · đúng calo +${XP_RULES.kcal} · đủ nước +${XP_RULES.water} · ngủ đủ +${XP_RULES.sleep} · huy hiệu Đồng/Bạc/Vàng +${TIER_XP[1]}/${TIER_XP[2]}/${TIER_XP[3]}.</p>
  `;
  bindOpen(box);
  qa("[data-ach-filter]", box).forEach(b=> b.addEventListener("click", ()=>{ _filter = b.dataset.achFilter; renderAchScreen(); }));
  qa("[data-ach-badge]", box).forEach(b=> b.addEventListener("click", ()=> openBadge(b.dataset.achBadge)));
  qa("[data-ach-pr]", box).forEach(b=> b.addEventListener("click", ()=>{
    const k = b.dataset.achPr, h = (state.setHist||{})[k];
    if(h && typeof openExerciseHistory==="function") openExerciseHistory(k, h.name);
  }));
}
function openBadge(id){
  const ev = evaluate(state, new Date()); const b = ev.badges.find(x=> x.id===id); if(!b) return;
  const T = TIERS[b.tier], cat = CATS.find(c=> c.id===b.cat);
  openSheet(`
    <div class="sheet-header"><h3>${esc(cat ? cat.label : "Huy hiệu")}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${icon("close")}</button></div>
    <div class="ach-detail ${b.earned ? "earned" : "locked"}">
      <div class="ach-detail-svg tier-${T.id}">${badgeSVG(b, 148)}</div>
      <span class="ach-tier-pill tier-${T.id}">Hạng ${T.label} · +${TIER_XP[b.tier]} XP</span>
      <h3>${esc(b.name)}</h3>
      <p>${esc(b.desc)}</p>
      ${b.earned ? `<div class="ach-detail-ok">${icon("check_circle")}Đạt ngày ${dmy(b.at)}</div>`
        : `<div class="ach-detail-prog"><div class="ach-bar"><i style="width:${Math.round(b.pct*100)}%"></i></div><div><b>${Math.round(b.pct*100)}%</b> · ${esc(b.prog)}</div></div>`}
    </div>
    <button class="btn btn-primary btn-block" onclick="closeSheet()">${b.earned ? "Tuyệt vời" : "Cố lên!"}</button>
  `);
}

/* ---------- TỔNG KẾT TUẦN (sheet) ---------- */
function openWeekly(which){
  const ws = weeklySummary(state, new Date(), which);
  const w = ws.cur, pw = ws.prev, g = ws.goals;
  if(ws.which === "last"){ ensureAch().seenWeek = mondayOf(todayS()); save(); }
  const pctOf = (a, b)=> b ? Math.round(a/b*100) : 0;
  openSheet(`
    <div class="sheet-header"><h3>Tổng kết tuần</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${icon("close")}</button></div>
    <div class="ach-seg" role="tablist">
      <button role="tab" aria-selected="${ws.which==="last"}" class="${ws.which==="last"?"active":""}" data-wk="last">Tuần trước</button>
      <button role="tab" aria-selected="${ws.which==="this"}" class="${ws.which==="this"?"active":""}" data-wk="this">Tuần này</button>
    </div>
    <p class="small-note ach-wk-range">${dmy(w.partial ? w.from : w.mon)} – ${dmy(w.sun)}${w.partial ? " · tính từ ngày bạn bắt đầu" : ws.which==="this" ? ` · ${w.days} ngày đầu, so với cùng kỳ tuần trước` : " · so với tuần liền trước"}</p>
    <div class="ach-wk-grid">
      <div class="ach-wk-box">${icon("fitness_center")}<b>${w.sessions}${w.planned ? `<small>/${w.planned}</small>` : ""}</b><span>Buổi tập</span>${deltaHTML(w.sessions, pw.sessions, " buổi")}</div>
      <div class="ach-wk-box">${icon("bar_chart")}<b>${tons(w.vol)}</b><span>Khối lượng</span>${deltaHTML(w.vol/1000, pw.vol/1000, " tấn", 1)}</div>
      <div class="ach-wk-box">${icon("ach_trophy")}<b>${w.prs.length}</b><span>Kỷ lục mới</span>${deltaHTML(w.prs.length, pw.prs.length)}</div>
      <div class="ach-wk-box">${icon("local_fire_department")}<b>${w.foodDays ? nf(w.kcalAvg) : "–"}</b><span>Calo TB/ngày${g.kcal ? ` · mục tiêu ${nf(g.kcal)}` : ""}</span>${w.foodDays && pw.foodDays ? deltaHTML(w.kcalAvg, pw.kcalAvg, " kcal") : `<span class="ach-d flat">${w.foodDays} ngày có ghi</span>`}</div>
      <div class="ach-wk-box">${icon("water_drop")}<b>${nf(w.waterAvg,1)}<small> L</small></b><span>Nước TB/ngày · ${pctOf(w.waterAvg, g.water)}% mục tiêu</span>${deltaHTML(w.waterAvg, pw.waterAvg, " L", 1)}</div>
      <div class="ach-wk-box">${icon("restaurant")}<b>${w.foodDays ? nf(w.protAvg) : "–"}<small> g</small></b><span>Đạm TB · mục tiêu ${nf(g.protein)} g</span>${w.foodDays && pw.foodDays ? deltaHTML(w.protAvg, pw.protAvg, " g") : `<span class="ach-d flat">${w.waterOkDays}/${w.days} ngày đủ nước</span>`}</div>
    </div>
    ${w.prs.length ? `<div class="ach-wk-prs"><div class="ach-cat-h">${icon("ach_trophy")}<span>Kỷ lục trong tuần</span></div>
      ${w.prs.slice(0,6).map(p=> `<div class="tb-row"><span>${esc(String(p.name).split(" (")[0])}</span><b>${nf(p.e1rm)} kg</b><small>+${nf(p.e1rm - p.prev, 1)} kg · ${dm(p.date)}</small></div>`).join("")}</div>` : ""}
    <div class="ach-tip">${icon(ws.tip.icon)}<div><b>${esc(ws.tip.title)}</b><p>${esc(ws.tip.text)}</p></div></div>
    <button class="btn btn-primary btn-block" id="ach-wk-go">${icon("event_available")}Lên kế hoạch tuần này</button>
  `);
  qa("#sheet-content [data-wk]").forEach(b=> b.addEventListener("click", ()=> openWeekly(b.dataset.wk)));
  const go = q("#ach-wk-go"); if(go) go.addEventListener("click", ()=>{ closeSheet(); goto("workout"); });
}

/* ---------- HỒ SƠ ---------- */
function profileInject(){
  const scr = q("#screen-profile"); if(!scr || !state.onboarded) return;
  const ev = evaluate(state, new Date()), L = ev.level;
  const badge = q("#profile-badge"), sub = q("#profile-sub");
  if(badge) badge.textContent = `HẠNG ${L.rank.toUpperCase()}`;
  if(sub) sub.textContent = `Cấp độ ${L.lvl} · ${L.title} · ${nf(L.xp)} XP`;
  const old = q("#ach-prof-card"); if(old) old.remove();
  const recent = ev.badges.filter(b=> b.earned).sort((a,b)=> String(b.at).localeCompare(String(a.at)) || b.tier - a.tier).slice(0, 6);
  const w = document.createElement("div");
  w.innerHTML = `<div class="card ach-prof" id="ach-prof-card" data-ach-open role="button" tabindex="0" aria-label="Mở màn Thành tích">
    <div class="card-title" style="justify-content:space-between;"><span style="display:flex;align-items:center;gap:8px;">${icon("ach_medal")}Thành tích</span><span class="ach-prof-count">${ev.stats.earned}/${ev.stats.total} huy hiệu</span></div>
    ${levelBlock(ev, 64)}
    ${recent.length ? `<div class="ach-prof-row">${recent.map(b=> `<span title="${esc(b.name)}">${badgeSVG(b, 40, { label:false })}</span>`).join("")}</div>` : `<p class="small-note" style="margin-top:10px;">Hoàn thành buổi tập đầu tiên để mở khoá huy hiệu đầu tiên.</p>`}
    <button class="btn btn-outline btn-block" data-ach-go>${icon("ach_trophy")}Huy hiệu &amp; bức tường kỷ lục</button>
  </div>`;
  const card = w.firstElementChild;
  const grid = q(".stat-grid", scr);
  if(grid && grid.parentNode) grid.parentNode.insertBefore(card, grid.nextSibling); else (q(".content", scr) || scr).appendChild(card);
  bindOpen(card);
  const go = q("[data-ach-go]", card); if(go) go.addEventListener("click", e=>{ e.stopPropagation(); openScreen(); });
}

/* ---------- XP trong màn "Hoàn thành buổi tập" ---------- */
function injectFinishXP(res){
  try{
    if(!res || !res.ev) return;
    const sc = q("#sheet-content"); if(!sc || q(".ach-finish", sc)) return;
    const gained = _xpSnap != null ? Math.max(0, res.ev.xp.total - _xpSnap) : null;
    _xpSnap = null;
    const div = document.createElement("div"); div.className = "ach-finish";
    div.innerHTML = finishXPHTML(res, gained);
    const btn = qa("button", sc).pop();
    if(btn && btn.parentNode) btn.parentNode.insertBefore(div, btn); else sc.appendChild(div);
  }catch(e){ warn(e); }
}
function finishXPHTML(res, gained){
  const L = res.ev.level, newly = Array.isArray(res.newly) ? res.newly.filter(Boolean) : [];
  return `<div class="ach-finish-top">${gained != null ? `<b>+${nf(gained)} XP</b>` : `<b>${nf(L.xp)} XP</b>`}<span>Cấp ${esc(L.lvl)} · ${esc(L.title)}</span></div>
      <div class="ach-bar"><i style="width:${Math.round(L.pct*100)}%"></i></div>
      <small>Còn ${nf(L.need - L.into)} XP lên cấp ${esc(L.lvl+1)}${newly.length ? ` · ${newly.length} huy hiệu mới!` : ""}</small>
      ${newly.length ? `<div class="ach-finish-badges">${newly.slice(0, 4).map(b=> `<span title="${esc(b.name || "")}">${badgeSVG(b, 32, { label:false })}</span>`).join("")}<span class="ach-finish-bn">${esc(newly.slice(0, 2).map(b=> b.name || "").filter(Boolean).join(" · "))}</span></div>` : ""}`;
}

/* ---------------------------------------------------------------------
   TÍCH HỢP: ghi đè hàm toàn cục (giữ hành vi cũ, chèn thêm UI)
   --------------------------------------------------------------------- */
function wrapFn(name, make){
  try{ const old = G[name]; if(typeof old !== "function") return false; G[name] = make(old); return true; }
  catch(e){ warn(e); return false; }
}
function integrate(){
  addIcons();
  ensureAch();
  ensureScreen();

  wrapFn("renderHomeScreen", old=> function(){ const r = old.apply(this, arguments); try{ homeInject(); }catch(e){ warn(e); } return r; });
  wrapFn("renderProfileScreen", old=> function(){ const r = old.apply(this, arguments); try{ profileInject(); }catch(e){ warn(e); } return r; });

  wrapFn("startSession", old=> function(){
    try{ if(!(typeof session!=="undefined" && session && session.paused)) _xpSnap = evaluate(state, new Date()).xp.total; }catch(e){}
    return old.apply(this, arguments);
  });

  wrapFn("finishSession", old=> function(){
    let s = null; try{ s = typeof session!=="undefined" ? session : null; }catch(e){}
    const quick = !!(s && s._quick), isToday = !!(s && s.isToday), done = s && Array.isArray(s.completed) ? s.completed.length : 0;
    const r = old.apply(this, arguments);
    try{
      if(quick && isToday && done){
        const A = ensureAch(), t = (s && typeof s.date === "string" && isDs(s.date)) ? s.date : todayS();   // QT-07
        if(!A.quick.includes(t)) A.quick.push(t);
        if(Array.isArray(state.finishedDates) && !state.finishedDates.includes(t)) state.finishedDates.push(t);
        save();
      }
      if(isToday){ const res = runCheck({ force:true, fromSession:true }); injectFinishXP(res); }
    }catch(e){ warn(e); }
    return r;
  });

  wrapFn("saveState", old=> function(){ const r = old.apply(this, arguments); if(!_busy) scheduleCheck(); return r; });

  wrapFn("goto", old=> function(screen){
    if(screen === "achieve"){
      ensureScreen();
      const cur = (q(".screen.active")||{}).id || "";
      if(cur && cur !== "screen-achieve") _prev = cur.replace("screen-","");
    }
    const r = old.apply(this, arguments);
    if(screen === "achieve") try{ renderAchScreen(); }catch(e){ warn(e); }
    return r;
  });

  wrapFn("closeSheet", old=> function(){ const r = old.apply(this, arguments); if(_queue.length) setTimeout(()=> tryShow(false), 350); return r; });

  wrapFn("fkHandleBack", old=> function(){
    if(_popEl){ const b = q("[data-pop='ok']", _popEl); if(b) b.click(); return true; }
    const cur = (q(".screen.active")||{}).id || "";
    if(cur === "screen-achieve" && !sheetOpen()){ goto(_prev || "profile"); return true; }
    return old.apply(this, arguments);
  });

  /* App đã khởi động trước khi module nạp → vẽ lại màn đang mở */
  const cur = (q(".screen.active")||{}).id || "";
  if(state.onboarded){
    if(cur === "screen-home") try{ renderHomeScreen(); }catch(e){ warn(e); }
    if(cur === "screen-profile") try{ renderProfileScreen(); }catch(e){ warn(e); }
    else try{ profileInject(); }catch(e){}
  }
  scheduleCheck(1500);
}

FKAch.open = ()=> openScreen();
FKAch.openWeekly = w=> openWeekly(w || "last");
FKAch.check = o=> runCheck(o);
FKAch.startQuick = ()=> startQuick(comebackInfo(state, new Date()));
FKAch._ui = { homeInject, profileInject, renderAchScreen, showPop, tryShow, injectFinishXP, finishXPHTML, prWallHTML, queue: _queue, achIsOld, achQuietLeft, lowEndDevice };

try{ integrate(); }catch(e){ warn(e); }

})(typeof window !== "undefined" ? window : globalThis);

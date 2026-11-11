/* =========================================================================
   TapEasy — SỨC KHOẺ & AN TOÀN  (health-safety.js · nạp SAU pt.js)

   1. Sàng lọc sức khoẻ khi onboarding / lần đầu mở app:
      PAR-Q+ rút gọn (7 câu), thai kỳ & sau sinh, cho con bú, tiểu đường,
      tim mạch & huyết áp, bệnh thận, tiền sử rối loạn ăn uống, chấn thương,
      dưới 18 tuổi (lấy từ tuổi trong hồ sơ).  → lưu state.health (chỉ trên máy).
   2. Điều chỉnh khuyến nghị (ghi đè recomputeProfile):
      · không thâm hụt calo khi mang thai / cho con bú / < 18 tuổi / tiền sử RLĂU
      · mang thai: + 0 / 340 / 452 kcal theo tam cá nguyệt; cho con bú: + 500 kcal (≤ 6 tháng, FAO/WHO/UNU 2004)
        / + 400 kcal (> 6 tháng, IOM 2005); 9–18 tuổi: không dưới EER IOM 2005 (vòng sửa QN-24)
      · đạm: thai kỳ 1,2–1,5 g/kg, cho bú 1,3 g/kg, 13–17 tuổi 1,2–1,5 g/kg,
        bệnh thận mạn ≤ 0,8 g/kg (TRẦN cứng cho thực đơn), lọc máu ≤ 1,2 g/kg (KDOQI 2020 / KDIGO 2024)
      · mọi người dùng (kể cả chưa sàng lọc): ≥ 60 tuổi ≤ 1,2 g/kg (PROT-AGE 2013), đạm ≤ 35 % năng lượng
        (AMDR), sát ngưỡng thiếu cân (BMI < 19,5) thâm hụt ≤ 10 % — QN-08 / QN-27
   3. Gắn cờ trên giáo án / buổi tập: ẩn buổi & bài cường độ RẤT CAO khi có vấn đề
      tim mạch / huyết áp chưa kiểm soát / triệu chứng (đau ngực, ngất) / biến chứng
      thai kỳ; cảnh báo nằm ngửa, bật nhảy, gập bụng, nín thở, vùng chấn thương.
   4. Màn "Sức khoẻ & an toàn" trong Hồ sơ + tuyên bố miễn trừ trách nhiệm y tế.

   Nguồn: PAR-Q+ 2023 (PAR-Q+ Collaboration), ACSM's Guidelines 11th ed. (2021),
   ACOG Committee Opinion 804 (2020), ADA Standards of Care / Colberg 2016,
   IOM DRI (2005), KDOQI Nutrition in CKD (2020), Goom–Donnelly–Brockwell
   Return-to-running postnatal (2019).
   ========================================================================= */
(function(){
"use strict";
try{

/* ---------------- 0. Icon bổ sung (nét 24×24) ---------------- */
try{
  if(typeof FK_LINE !== "undefined") Object.assign(FK_LINE, {
    health_and_safety: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|M12 8v6|M9 11h6",
    favorite: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
    monitor_heart: "r:2,4,20,16,3|M2 12h5l2-3 3 6 2-3h8",
    pregnant_woman: "c:11,4,2|M10 22v-6|M10 8v6h4a3 3 0 0 0 0-6h-4z|M13 16v6",
    medical_services: "r:3,7,18,13,2|M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2|M12 11v6|M9 14h6",
    lock: "r:5,11,14,10,2|M8 11V7a4 4 0 0 1 8 0v4",
    visibility_off: "M2 12s3.5-7 10-7c2 0 3.8.6 5.3 1.6|M22 12s-3.5 7-10 7c-2 0-3.8-.6-5.3-1.6|M3 3l18 18|M9.9 9.9a3 3 0 0 0 4.2 4.2",
    healing: "M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z|M8.5 8.5l7 7",
    stethoscope: "M5 3v5a5 5 0 0 0 10 0V3|M10 13v3a5 5 0 0 0 10 0v-3|c:20,11,2",
    emergency: "c:12,12,10|M12 7v10|M7 12h10",
  });
}catch(e){}

/* ---------------- 1. Dữ liệu tĩnh ---------------- */
const PARQ = [
  ["heart", "Bác sĩ từng nói bạn có <b>bệnh tim</b> HOẶC <b>tăng huyết áp</b>?"],
  ["chestPain", "Bạn có bị <b>đau ngực</b> khi nghỉ ngơi, khi sinh hoạt hằng ngày HOẶC khi vận động?"],
  ["dizzy", "Trong 12 tháng qua, bạn có <b>mất thăng bằng do choáng váng</b> HOẶC từng <b>bất tỉnh</b>? <small>Chọn \"Không\" nếu chỉ choáng do thở quá nhanh khi tập mạnh.</small>"],
  ["chronic", "Bạn có được chẩn đoán <b>bệnh mạn tính</b> nào khác (ngoài bệnh tim, tăng huyết áp)?"],
  ["meds", "Bạn có đang dùng <b>thuốc kê đơn</b> cho bệnh mạn tính?"],
  ["joint", "Hiện tại (hoặc trong 12 tháng qua) bạn có vấn đề <b>xương, khớp, cơ, gân, dây chằng</b> có thể nặng hơn khi vận động nhiều hơn? <small>Chọn \"Không\" nếu vấn đề cũ không còn ảnh hưởng.</small>"],
  ["supervised", "Bác sĩ từng nói bạn <b>chỉ nên vận động khi có giám sát y tế</b>?"],
];
const INJ = { shoulder:"Vai", lowback:"Lưng dưới", knee:"Gối", wrist:"Cổ tay / khuỷu", hip:"Hông", ankle:"Cổ chân", neck:"Cổ" };
const KCAL_PREG = [0, 340, 452];          // IOM 2005 — tam cá nguyệt 1/2/3
/* QN-01/QN-25: năng lượng tạo sữa — 0–6 tháng ~+500 kcal (FAO/WHO/UNU 2004: +505 kcal/ngày với mẹ đủ cân),
   > 6 tháng +400 kcal (IOM 2005). Bản cũ luôn +330 (IOM có trừ 170 kcal từ mỡ dự trữ — chỉ đúng khi mẹ đang giảm cân). */
const KCAL_LACT = [500, 400];
const DAY_MS = 86400000;
const PRIVACY_URL = "https://thangvu030198-ai.github.io/fitkit-app/privacy-policy.html";
/* Mở link ngoài: app native dùng @capacitor/browser (không rời WebView của app), web mở tab mới */
function openExternal(url){
  try{
    const B = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
    if(B && B.open){ B.open({ url }); return; }
  }catch(e){}
  window.open(url, "_blank", "noopener");
}

/* Bỏ dấu tiếng Việt để so khớp từ khoá */
function hsNorm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d"); }
const esc = s => (typeof escapeHtml==="function" ? escapeHtml(s) : String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));

/* ---------------- 2. Cờ sức khoẻ (hàm thuần, test được bằng Node) ---------------- */
function hsFlags(h, p){
  h = h || {}; p = p || {};
  const q = h.parq || {};
  const female = p.gender === "female";
  const age = Number(p.age) || 0;
  const preg = female && h.pregnancy === "pregnant";
  const post = female && h.pregnancy === "postpartum";
  const tri = Math.min(3, Math.max(1, Number(h.trimester) || 1));
  const ppWeeks = post ? (h.postpartumWeeks || "gt12") : null;
  const ppLate = ppWeeks === "gt12" || ppWeeks === "gt26";          // > 12 tuần (gt26 = > 6 tháng, QN-25)
  const bf = female && !preg && !!h.breastfeeding;
  const minor = age > 0 && age < 18;
  const ed = h.edHistory === "yes";
  const diab = h.diabetes || "none";
  const hypo = (diab === "type1") || ((diab === "type2") && !!h.hypoRisk);
  const cardio = h.cardio || "none";
  const kidney = h.kidney || "none";
  const injuries = Array.isArray(h.injuries) ? h.injuries.filter(k=>INJ[k]) : [];
  const symptom = !!(q.chestPain || q.dizzy);
  const supervised = !!q.supervised;
  const pregComp = preg && !!h.pregComplication;
  const parqYes = PARQ.some(([k])=> !!q[k]);
  const screened = !!h.completedAt;

  const hideVeryHigh = screened && (cardio === "heart" || cardio === "htn_bad" || symptom || supervised || pregComp);
  const cleared = !!h.clearedVigorous;
  const hideNow = hideVeryHigh && !cleared;
  const postEarly = post && !ppLate;                        // < 12 tuần sau sinh
  const cautionVeryHigh = screened && (hideVeryHigh || cardio === "htn_ok" || !!q.heart || preg || postEarly || hypo || kidney !== "none");
  const valsalva = screened && (cardio !== "none" || !!q.heart || preg || kidney === "dialysis" || (diab !== "none" && diab !== "pre"));

  const noDeficitReasons = [];
  if(preg) noDeficitReasons.push("pregnant");
  if(bf) noDeficitReasons.push("breastfeeding");
  if(minor) noDeficitReasons.push("minor");
  if(ed) noDeficitReasons.push("ed");
  const noDeficit = noDeficitReasons.length > 0;
  /* cho bú: sau sinh ≤ 6 tháng → +500; > 6 tháng (hoặc không khai báo sau sinh — thường đã > 12 tháng) → +400 */
  const kcalExtra = preg ? KCAL_PREG[tri-1] : bf ? (post && ppWeeks !== "gt26" ? KCAL_LACT[0] : KCAL_LACT[1]) : 0;

  // Đạm (g/kg cân nặng tham chiếu) — null = giữ công thức gốc của app (2 g/kg, trần 180 g)
  let ppk = null;
  if(preg) ppk = tri === 1 ? 1.2 : 1.5;
  else if(bf) ppk = 1.3;
  /* QN-01: 13–17 tuổi ~1,0–1,5 g/kg — 1,5 khi tập nhiều / tăng cơ, 1,2 khi ít vận động (DRI 0,85 g/kg; VĐV trẻ 1,2–1,6) */
  const teenPpk = (p.goal === "gain" || ["moderate","active","veryActive"].includes(p.activity)) ? 1.5 : 1.2;
  if(minor) ppk = Math.min(ppk == null ? teenPpk : ppk, teenPpk);
  if(kidney === "ckd") ppk = Math.min(ppk == null ? 0.8 : ppk, 0.8);
  if(kidney === "dialysis") ppk = Math.min(ppk == null ? 1.2 : ppk, 1.2);

  // Lý do nên hỏi bác sĩ (hiển thị trong kết quả & Hồ sơ)
  const doctor = [];
  if(symptom) doctor.push("symptom");
  if(supervised) doctor.push("supervised");
  if(pregComp) doctor.push("pregComp");
  if(parqYes) doctor.push("parq");
  if(preg) doctor.push("pregnant");
  if(post && (ppWeeks === "lt6" || (h.cesarean && !ppLate))) doctor.push("postpartum");
  if(cardio !== "none") doctor.push("cardio");
  if(diab !== "none") doctor.push("diabetes");
  if(kidney !== "none") doctor.push("kidney");
  if(ed) doctor.push("ed");
  if(injuries.length) doctor.push("injury");
  if(minor) doctor.push("minor");

  const urgent = screened && (symptom || supervised || pregComp);
  const preCheck = screened && (cardio !== "none" || symptom || hypo || preg || post || kidney !== "none" || supervised);

  return {
    screened, female, age, minor, preg, post, tri, ppWeeks, postEarly, bf, ed, diab, hypo, cardio, kidney, injuries,
    symptom, supervised, pregComp, parqYes, hideVeryHigh, hideNow, cleared, cautionVeryHigh, valsalva,
    noDeficit, noDeficitReasons, kcalExtra, ppk, doctor, urgent, preCheck,
    /* QN-01/03/07/16: cờ cho thực đơn & nước — proteinCap: đạm là TRẦN cứng (bệnh thận mạn chưa lọc máu);
       noSuppl: không gợi ý bột đạm/whey; noRare: không gợi ý món tái/sống; waterExtra (L); fluidLimit: lọc máu → hạn chế dịch */
    proteinCap: kidney === "ckd", noSuppl: preg || minor || kidney !== "none", noRare: preg,
    waterExtra: preg ? (tri >= 2 ? 0.3 : 0) : bf ? 0.7 : 0, fluidLimit: kidney === "dialysis", hideBmi: preg || ed,
    any: screened && (doctor.length > 0 || noDeficit || ppk != null),
  };
}

/* ---------------- 3. Phân loại bài tập theo rủi ro (từ khoá, hàm thuần) ---------------- */
const RX = {
  veryHigh: /hiit|burpee|sprint|tabata|plyo|box ?jump|jump ?squat|tuck ?jump|nuoc rut|sled ?push|sledpush|day xe truot|wall ?ball|wallball|nem bong tuong|thruster|mountain ?climber|mountainclimber|leo nui|jump ?rope|jumprope|nhay day|jumping jack/,
  impact: /jump|nhay|burpee|running|chay bo|sprint|box ?jump|plyo|wall ?ball|wallball|nem bong|skipping/,
  supine: /bench ?press|dbbench|benchpress|day nguc nam|day nguc ta don|skull|nam duoi tay sau|crunch|gap bung|dead ?bug|deadbug|bo chet|glute ?bridge|glutebridge|cau mong|pullover|nam ngua|floor press|sit-?up/,
  notSupine: /incline|nghieng|machine|may /,
  prone: /leg ?curl|legcurl|cuon gan kheo|nam sap|prone|superman/,
  coreFlex: /crunch|gap bung|sit-?up|hanging ?leg|hangingleg|nang chan treo|russian ?twist|russiantwist|v-?up|toes? to bar|leg raise/,
  heavyEq: /thanh don|barbell|ta don|dumbbell|may|machine|ta am|kettlebell|smith|ez/,
  timed: /giay|phut|km|\d\s*m\b|\bm\b|vong|\d\s*s\b|\//,
  walk: /walk|di bo/,
};
const RX_INJ = {
  shoulder: /overhead|shoulder press|day vai|bench|day nguc|\bdip|dips|tricepdip|pull-?up|pullup|keo xa|chin-?up|pullover|push-?up|pushup|chong day|wall ?ball|wallball|lateral raise|lateralraise|nang ta vai|dang vai|upright row|snatch|jerk|burpee|handstand/,
  lowback: /deadlift|rdl|good ?morning|bent-?over|bentoverrow|gap nguoi|back squat|ganh ta|front ?squat|frontsquat|squat ta truoc|swing|vung ta|russian ?twist|sit-?up|crunch|gap bung|hyperextension|sled|day xe|farmer|xach ta|rowing|cheo thuyen|t-?bar/,
  knee: /squat|lunge|chung chan|leg ?press|legpress|day chan|leg ?extension|legext|duoi chan|step-?up|stepup|buoc buc|bulgarian|jump|nhay|burpee|running|chay bo|sprint|wall ?ball|wallball|sled|hack/,
  wrist: /push-?up|pushup|chong day|bench|day nguc|\bdip|dips|tricepdip|skull|front ?squat|frontsquat|squat ta truoc|burpee|mountain|leo nui|bicep|hammer|preacher|cuon tay|tricep|tay sau/,
  hip: /squat|deadlift|rdl|lunge|chung chan|bulgarian|hip ?thrust|hipthrust|day hong|abduction|mo hong|swing|vung ta|step-?up|stepup|buoc buc|running|chay bo|kickback|da mong|glute ?bridge|cau mong/,
  ankle: /running|chay bo|sprint|jump|nhay|burpee|lunge|chung chan|calf|bap chan|step-?up|stepup|buoc buc|box ?jump|sled|wall ?ball|wallball/,
  neck: /back squat|ganh ta|shrug|overhead|day vai|crunch|gap bung|sit-?up|headstand/,
};
function hsRepTop(reps){
  const r = String(reps||"");
  const m = r.match(/(\d+)\s*[-–]\s*(\d+)/); if(m) return Number(m[2]);
  const n = r.match(/^\s*(\d+)/); return n ? Number(n[1]) : 0;
}
/* text = id + tên + nhóm cơ + dụng cụ; reps = chuỗi số lần; intensity = cường độ buổi */
function hsTagsFor(text, reps, intensity){
  const t = hsNorm(text), r = hsNorm(reps);
  const isWalk = RX.walk.test(t);
  const timed = RX.timed.test(r);
  const top = hsRepTop(reps);
  const tags = {
    veryHigh: !isWalk && (RX.veryHigh.test(t) || (/running|chay bo/.test(t) && /nhanh|sprint|interval|800 m|400 m/.test(r)) || /1rm|toi da 1 lan|max effort/.test(t+" "+r)),
    impact: !isWalk && RX.impact.test(t),
    supine: RX.supine.test(t) && !RX.notSupine.test(t),
    prone: RX.prone.test(t),
    coreFlex: RX.coreFlex.test(t),
    heavy: !timed && top > 0 && top <= 6 && RX.heavyEq.test(t),
    dayVeryHigh: intensity === "Rất cao",
    inj: isWalk ? [] : Object.keys(RX_INJ).filter(k=> RX_INJ[k].test(t)),   // đi bộ: tải thấp, không gắn cờ chấn thương
  };
  return tags;
}
function hsItemTags(item, intensity){
  let meta = {};
  try{ meta = getExerciseMeta(item) || {}; }catch(e){}
  return hsTagsFor(`${item.exerciseId||""} ${meta.name||""} ${meta.muscle||""} ${meta.equipment||""}`, item.reps, intensity);
}
/* Ghi chú hiển thị cho 1 bài theo cờ sức khoẻ → [{lv:'hide'|'warn'|'info', ic, t}] */
function hsNotesFor(tags, f){
  const out = [];
  if(!f || !f.screened) return out;
  if(tags.veryHigh){
    if(f.hideNow) out.push({ lv:"hide", ic:"visibility_off", t:"Cường độ rất cao — đã ẩn theo sàng lọc sức khoẻ (tim mạch / huyết áp / triệu chứng). Hỏi bác sĩ trước khi tập." });
    else if(f.cautionVeryHigh) out.push({ lv:"warn", ic:"favorite", t:"Cường độ rất cao — với tình trạng của bạn, hãy hạ xuống mức vừa (vẫn nói được câu ngắn)." });
  }
  if(tags.heavy && f.valsalva) out.push({ lv:"warn", ic:"monitor_heart", t:"Tạ nặng: thở ra khi đẩy/kéo, không nín thở; giữ RPE ≤ 7 (còn ~3 lần nữa mới kiệt sức)." });
  if(tags.heavy && f.minor) out.push({ lv:"info", ic:"school", t:"Dưới 18 tuổi: tập có người giám sát, ưu tiên kỹ thuật, không thử tạ tối đa." });
  if(f.preg && f.tri >= 2 && tags.supine) out.push({ lv:"warn", ic:"pregnant_woman", t:"Từ tam cá nguyệt 2 tránh nằm ngửa lâu — đổi sang ghế nghiêng 30–45° hoặc tư thế nằm nghiêng." });
  if(f.preg && f.tri >= 2 && tags.prone) out.push({ lv:"warn", ic:"pregnant_woman", t:"Tư thế nằm sấp không phù hợp khi bụng lớn — đổi sang bài đứng hoặc ngồi." });
  if(tags.impact && f.preg) out.push({ lv:"warn", ic:"pregnant_woman", t:"Bật nhảy / va chạm tăng nguy cơ ngã và áp lực sàn chậu — đổi sang bài không nhảy." });
  if(tags.impact && f.postEarly) out.push({ lv:"warn", ic:"pregnant_woman", t:"Chạy / nhảy: nên đợi ≥ 12 tuần sau sinh và khi sàn chậu ổn định (không són tiểu, không nặng vùng chậu)." });
  if(tags.coreFlex && ((f.preg && f.tri >= 2) || f.postEarly)) out.push({ lv:"warn", ic:"pregnant_woman", t:"Hạn chế gập bụng mạnh (nguy cơ tách cơ thẳng bụng) — thay bằng thở bụng, bird-dog, plank nghiêng nếu không đau." });
  const hit = (tags.inj||[]).filter(k=> f.injuries.includes(k));
  if(hit.length) out.push({ lv:"warn", ic:"healing", t:`Bài tải lên vùng ${hit.map(k=>INJ[k].toLowerCase()).join(", ")} bạn đã khai báo chấn thương — giảm tạ / biên độ, dừng nếu đau tăng.` });
  return out;
}

/* ---------------- 4. Điều chỉnh dinh dưỡng (gọi sau recomputeProfile gốc) ---------------- */
/* QN-24: EER (Estimated Energy Requirement) IOM 2005 cho 9–18 tuổi — gồm 25 kcal tăng trưởng.
   Thừa cân (BMI ≥ 25, xấp xỉ ngưỡng IOTF trưởng thành) dùng phương trình "duy trì cân nặng" cho trẻ thừa cân. */
function hsTeenEER(p){
  p = p || {};
  const age = Number(p.age) || 0;
  if(!(age >= 9 && age < 19)) return 0;
  const w = Number(p.weight) || 0, h = (Number(p.height) || 0) / 100;
  if(!w || !h) return 0;
  const male = p.gender === "male";
  const lvl = ({ sedentary:0, light:1, moderate:2, active:2, veryActive:3 })[p.activity];
  const L = lvl == null ? 1 : lvl;
  if(w/(h*h) < 25){
    const PA = male ? [1.00, 1.13, 1.26, 1.42] : [1.00, 1.16, 1.31, 1.56];
    return Math.round(male ? 88.5 - 61.9*age + PA[L]*(26.7*w + 903*h) + 25 : 135.3 - 30.8*age + PA[L]*(10*w + 934*h) + 25);
  }
  const PA = male ? [1.00, 1.12, 1.24, 1.45] : [1.00, 1.18, 1.35, 1.60];
  return Math.round(male ? 114 - 50.9*age + PA[L]*(19.5*w + 1161.4*h) : 389 - 41.2*age + PA[L]*(15*w + 701.6*h));
}
/* Phân bổ lại macro khi calo/đạm đổi: béo 25 % năng lượng, tinh bột = phần còn lại (đạm thấp → bù bằng tinh bột/béo) */
function hsSetMacros(p, kcal, protein){
  const fatKcal = kcal * 0.25;
  p.goalKcal = kcal;
  p.protein = protein;
  p.fat = Math.round(fatKcal / 9);
  p.carbs = Math.max(0, Math.round((kcal - protein*4 - fatKcal) / 4));
}
/* QN-08 / QN-27 — lớp an toàn chung cho MỌI người dùng mục tiêu tự động (kể cả chưa sàng lọc).
   Chỉ GIẢM đạm / chỉ NÂNG calo → cộng dồn an toàn với công thức của app.js (calcMacros). */
function hsGeneralTargets(p){
  p.nutriNotes = [];
  if(!p || p.autoTargets === false || !(p.goalKcal > 0)) return;
  const hh = (p.height||0)/100, w = Number(p.weight) || 0;
  const ref = hh ? Math.min(w, 25*hh*hh) : w;
  let kcal = p.goalKcal, protein = p.protein || 0;
  /* QN-27: BMI 18,5–19,5 muốn giảm → thâm hụt tối đa 10 %; nếu dự báo 4 tuần tụt BMI < 18,5 → giữ mức duy trì */
  const bmi = hh && w ? w/(hh*hh) : 0;
  if(p.goal === "lose" && !p.goalBlocked && bmi >= 18.5 && bmi < 19.5 && p.tdee > 0){
    let k2 = Math.max(kcal, Math.round(p.tdee * 0.9));
    const loss28 = Math.max(0, p.tdee - k2) * 28 / 7700;               // kg mỡ ~7.700 kcal
    if((w - loss28)/(hh*hh) < 18.5) k2 = Math.max(kcal, p.tdee);
    if(k2 !== kcal){ p.nutriNotes.push(k2 >= p.tdee ? "nearUnderBlock" : "nearUnder"); kcal = k2; }
  }
  /* QN-08: ≥ 60 tuổi 1,0–1,2 g/kg (PROT-AGE 2013) → lấy 1,2 g/kg để giữ cơ */
  if((Number(p.age) || 0) >= 60 && ref > 0){
    const cap = Math.round(ref * 1.2);
    if(protein > cap){ protein = cap; p.nutriNotes.push("age60"); }
  }
  /* QN-08: đạm ≤ 35 % năng lượng (AMDR 10–35 %, IOM 2005) */
  const capPct = Math.floor(kcal * 0.35 / 4);
  if(protein > capPct){ protein = capPct; p.nutriNotes.push("cap35"); }
  if(kcal !== p.goalKcal || protein !== p.protein) hsSetMacros(p, kcal, protein);
}
function hsApplyNutrition(p, h){
  if(!p) return null;
  p.hsAdjust = null;
  try{ hsGeneralTargets(p); }catch(e){ console.warn("[health-safety] general", e); }
  const f = hsFlags(h, p);
  if(!f.screened) return null;
  let floorKcal = Math.round((p.tdee||0) + f.kcalExtra);
  const eer = f.minor ? hsTeenEER(p) : 0;                           // QN-24: dưới 18 tuổi không dưới EER
  if(eer > floorKcal) floorKcal = eer;
  if(p.autoTargets === false){
    const warn = [];
    if(f.noDeficit && (p.goalKcal||0) < floorKcal) warn.push("kcal");
    if(f.ppk != null && f.kidney !== "none"){
      const hh = (p.height||0)/100, ref = hh ? Math.min(p.weight, 25*hh*hh) : p.weight;
      if((p.protein||0) > Math.round(ref*f.ppk)) warn.push("protein");
    }
    p.hsAdjust = warn.length ? { manual:true, warn } : null;
    return p.hsAdjust;
  }
  const from = { kcal:p.goalKcal, protein:p.protein };
  let kcal = p.goalKcal || 0;
  if(f.preg || f.bf) kcal = floorKcal;                 // không thâm hụt, không "bulk" — chỉ cộng nhu cầu thai kỳ / tạo sữa
  else if(f.noDeficit && kcal < floorKcal) kcal = floorKcal;
  let protein = p.protein || 0;
  if(f.ppk != null){
    const hh = (p.height||0)/100, ref = hh ? Math.min(p.weight, 25*hh*hh) : p.weight;
    protein = Math.round(ref * f.ppk);
  }
  protein = Math.min(protein, Math.floor(kcal * 0.35 / 4));            // QN-08: trần 35 % năng lượng
  const extra = { ppk:f.ppk, reasons:f.noDeficitReasons.slice(), proteinCap: !!f.proteinCap, eer: eer || null };
  if(kcal === from.kcal && protein === from.protein){
    p.hsAdjust = f.noDeficit || f.ppk != null ? Object.assign({ from, to:{ kcal, protein }, unchanged:true }, extra) : null;
    return p.hsAdjust;
  }
  hsSetMacros(p, kcal, protein);
  p.hsAdjust = Object.assign({ from, to:{ kcal, protein } }, extra);
  return p.hsAdjust;
}

/* ---------------- 5. Nội dung lời khuyên ---------------- */
const TIPS = {
  general: [
    "Khởi động 5–10 phút, tăng cường độ từ từ; thả lỏng sau tập.",
    "Tự kiểm tra cường độ bằng \"talk test\": nói được câu ngắn = mức vừa; không nói nổi = rất cao.",
    "Dừng tập và gọi cấp cứu <b>115</b> nếu đau / tức ngực, khó thở bất thường, choáng váng, ngất, tim đập rất nhanh hoặc loạn nhịp.",
  ],
  symptom: ["Bạn khai báo <b>đau ngực</b> hoặc <b>choáng / ngất</b> — hãy đi khám trước khi tập ở bất kỳ cường độ nào."],
  supervised: ["Bác sĩ từng dặn bạn chỉ vận động khi có giám sát y tế — hãy tập theo chương trình của cơ sở y tế/phục hồi chức năng."],
  parq: ["Bạn trả lời \"Có\" ở ít nhất một câu PAR-Q+ — nên hỏi ý kiến bác sĩ trước khi bắt đầu hoặc tăng cường độ tập."],
  cardio: [
    "Hỏi bác sĩ tim mạch về mức cường độ phù hợp (nhịp tim mục tiêu) trước khi tăng tải.",
    "Khởi động và thả lỏng ≥ 10 phút; tránh tăng / giảm cường độ đột ngột.",
    "Không nín thở khi nâng tạ (nghiệm pháp Valsalva): thở ra khi đẩy / kéo, giữ RPE ≤ 7.",
    "Nếu có máy đo: huyết áp lúc nghỉ từ <b>160/100 mmHg</b> trở lên → chỉ tập nhẹ; từ <b>180/110 mmHg</b> trở lên → hoãn tập và liên hệ bác sĩ.",
    "Một số thuốc (VD chẹn beta) làm nhịp tim tăng ít — hãy dựa vào cảm nhận gắng sức (RPE) thay vì nhịp tim.",
    "Nếu bác sĩ dặn hạn chế muối / nước (VD suy tim), làm theo chỉ định của bác sĩ thay vì mục tiêu nước của app.",
  ],
  diabetes: [
    "Đo đường huyết trước tập (nhất là khi dùng insulin / sulfonylurea): dưới khoảng <b>5,0–5,6 mmol/L (90–100 mg/dL)</b> → ăn thêm 15–30 g tinh bột (VD 1 lát bánh mì, 1 quả chuối nhỏ) rồi mới tập.",
    "Trên <b>13,9 mmol/L (250 mg/dL)</b> kèm ceton máu / nước tiểu (hay gặp ở type 1) → hoãn tập. Không có ceton và thấy khoẻ thì có thể tập nhẹ, uống đủ nước.",
    "Luôn mang theo đường viên / kẹo. Run tay, vã mồ hôi, đói cồn cào, hoa mắt, lú lẫn → dừng tập, ăn 15 g đường, đo lại sau 15 phút.",
    "Hạ đường huyết có thể xảy ra muộn tới 24 giờ sau tập — kiểm tra đường huyết trước khi ngủ nếu tập buổi chiều/tối.",
    "Kiểm tra bàn chân sau tập, mang giày vừa vặn. Có bệnh võng mạc tăng sinh: tránh nín thở, tạ rất nặng, bật nhảy, cúi đầu thấp.",
    "Thực đơn gợi ý của app chưa thiết kế riêng cho người tiểu đường — hỏi bác sĩ / chuyên gia dinh dưỡng về lượng tinh bột mỗi bữa.",
  ],
  pregnant: [
    "Trao đổi với bác sĩ sản khoa trước khi bắt đầu hoặc duy trì chương trình tập.",
    "Mục tiêu tham khảo: khoảng 150 phút/tuần ở cường độ vừa (vẫn nói chuyện được), chia nhiều buổi.",
    "Từ tam cá nguyệt 2: tránh nằm ngửa lâu — dùng ghế nghiêng hoặc tư thế nằm nghiêng.",
    "Tránh môn va chạm, bài dễ ngã (bật nhảy, thăng bằng khó), tập nơi nóng ẩm / hot yoga, lặn biển, nín thở khi nâng tạ.",
    "Uống đủ nước (thêm khoảng 0,3 L/ngày), mặc thoáng, không để quá nóng.",
    "<b>DỪNG TẬP và gọi bác sĩ</b> nếu: ra máu âm đạo, co thắt tử cung đều và đau, rỉ / vỡ ối, khó thở trước khi gắng sức, chóng mặt, đau đầu, đau ngực, yếu cơ ảnh hưởng thăng bằng, đau hoặc sưng bắp chân.",
    "Ăn uống: tránh thịt / cá / trứng sống hoặc tái, sữa chưa tiệt trùng, rượu bia; giới hạn cà phê (≤ 200 mg caffeine/ngày, khoảng 1–2 tách).",
  ],
  pregComp: ["Bạn khai báo có <b>biến chứng thai kỳ</b> hoặc được dặn hạn chế vận động — chỉ tập khi bác sĩ sản khoa cho phép và theo đúng mức bác sĩ dặn. Các buổi / bài cường độ rất cao đã được ẩn."],
  postpartum: [
    "Khám hậu sản (thường khoảng 6 tuần) trước khi tập lại có tạ; sinh mổ thường cần 6–8 tuần hoặc lâu hơn tuỳ bác sĩ.",
    "Bắt đầu bằng đi bộ, thở bụng và tập cơ sàn chậu (Kegel) nếu không đau.",
    "Chạy bộ, bật nhảy: nên đợi ít nhất 12 tuần sau sinh và khi không còn són tiểu, nặng / tức vùng chậu.",
    "Thấy \"gờ\" dọc giữa bụng khi gắng sức (tách cơ thẳng bụng) → hạn chế gập bụng mạnh, hỏi chuyên viên vật lý trị liệu sàn chậu.",
  ],
  breastfeeding: [
    "Cho bú hoặc hút sữa trước khi tập; mặc áo ngực nâng đỡ tốt.",
    "Uống thêm khoảng 0,7 L nước/ngày; không ăn kiêng gắt — giảm cân quá nhanh có thể ảnh hưởng nguồn sữa.",
    "Tập ở mức vừa không làm giảm số lượng hay chất lượng sữa.",
  ],
  kidney: [
    "Hỏi bác sĩ thận về lượng đạm, nước, kali, phốt pho, natri — thực đơn gợi ý của TapEasy <b>chưa tính</b> các giới hạn này.",
    "Không áp dụng mục tiêu nước mặc định của app nếu bác sĩ dặn hạn chế nước.",
    "Không tự dùng whey, creatine hay thực phẩm bổ sung khi chưa hỏi bác sĩ.",
  ],
  dialysis: ["Đang lọc máu: tập vào ngày không lọc hoặc theo chương trình của trung tâm; không mang tạ, không đeo vật nặng ở tay có cầu nối động–tĩnh mạch (AV fistula)."],
  ed: [
    "TapEasy sẽ không đặt mục tiêu thâm hụt calo cho bạn và không gợi ý chuyển sang \"Giảm mỡ\".",
    "Số calo được <b>ẩn</b> mặc định — màn Dinh dưỡng hiển thị khẩu phần theo bàn tay và \"đĩa ăn cân bằng\" thay cho đồng hồ calo. Bạn có thể bật lại trong Hồ sơ → Sức khoẻ &amp; an toàn.",
    "Nếu việc đếm calo, cân nặng hay tập luyện khiến bạn lo âu, thấy tội lỗi hoặc muốn \"tập bù\" — hãy tạm dừng theo dõi và trao đổi với bác sĩ / chuyên gia tâm lý.",
    "Tập để khoẻ hơn, không phải để \"đốt bù\" món đã ăn.",
  ],
  injury: [
    "Đau khi tập ≤ 3/10 và hết trong 24 giờ thường chấp nhận được; đau tăng, sưng, tê hoặc đau sang hôm sau → giảm tải / đổi bài và hỏi bác sĩ hoặc chuyên viên vật lý trị liệu.",
    "Các bài tải lên vùng bạn khai báo sẽ có cờ cảnh báo trong giáo án và khi tập.",
  ],
  minor: [
    "Dưới 18 tuổi: tập dưới sự giám sát của huấn luyện viên có chuyên môn hoặc người lớn; ưu tiên kỹ thuật đúng hơn mức tạ.",
    "Không thử tạ tối đa (1RM) khi chưa có giám sát. Ăn đủ năng lượng để phát triển — TapEasy không đặt mục tiêu thâm hụt calo.",
    "Hỏi ý kiến bố mẹ / người giám hộ và bác sĩ nếu có bệnh lý.",
  ],
};
const DOCTOR_LABEL = {
  symptom:"Đau ngực / choáng ngất", supervised:"Cần giám sát y tế", pregComp:"Biến chứng thai kỳ", parq:"Có câu PAR-Q+ trả lời \"Có\"",
  pregnant:"Đang mang thai", postpartum:"Sau sinh (chưa khám hậu sản / sinh mổ)", cardio:"Tim mạch / huyết áp", diabetes:"Tiểu đường",
  kidney:"Bệnh thận", ed:"Tiền sử rối loạn ăn uống", injury:"Chấn thương", minor:"Dưới 18 tuổi",
};
const REASON_LABEL = { pregnant:"đang mang thai", breastfeeding:"đang cho con bú", minor:"dưới 18 tuổi", ed:"tiền sử rối loạn ăn uống" };

const DISCLAIMER_SHORT = "TapEasy là ứng dụng hỗ trợ tập luyện và dinh dưỡng phổ thông, <b>không phải thiết bị y tế</b>, không chẩn đoán hay điều trị bệnh. Mọi số liệu chỉ là ước lượng tham khảo. Hãy hỏi bác sĩ trước khi bắt đầu chương trình tập hoặc chế độ ăn mới.";
const DISCLAIMER_FULL = [
  "TapEasy là ứng dụng hỗ trợ tập luyện và dinh dưỡng dành cho người khoẻ mạnh nói chung. TapEasy <b>không phải thiết bị y tế</b> và không dùng để chẩn đoán, điều trị, chữa khỏi hay phòng ngừa bất kỳ bệnh nào.",
  "Các con số calo, BMR, TDEE, macro, tỉ lệ mỡ, mức tạ gợi ý và thực đơn đều là <b>ước lượng</b> theo công thức phổ biến (Mifflin-St Jeor, ISSN, IOM…). Cơ thể mỗi người khác nhau — kết quả thực tế có thể chênh lệch.",
  "Bảng sàng lọc dựa trên PAR-Q+ chỉ giúp nhận ra khi nào bạn nên hỏi ý kiến bác sĩ. Nó <b>không thay thế</b> khám sức khoẻ, và việc trả lời \"Không\" ở mọi câu không có nghĩa là bạn chắc chắn an toàn.",
  "Hãy hỏi bác sĩ trước khi bắt đầu chương trình tập hoặc chế độ ăn mới, đặc biệt nếu bạn đang mang thai, mới sinh, cho con bú, dưới 18 tuổi, có bệnh tim mạch, huyết áp, tiểu đường, bệnh thận, tiền sử rối loạn ăn uống, chấn thương hoặc đang dùng thuốc.",
  "Lời khuyên của huấn luyện viên (PT) trong app là ý kiến chuyên môn thể thao, không phải chỉ định y khoa.",
  "Dừng tập ngay và gọi cấp cứu <b>115</b> nếu đau / tức ngực, khó thở bất thường, choáng váng, ngất hoặc tim đập bất thường.",
  "Dữ liệu sàng lọc chỉ lưu trên thiết bị của bạn (và trong bản sao lưu Google Drive nếu bạn tự bật), không gửi lên máy chủ TapEasy.",
];

/* ---------------- 6. Trạng thái ---------------- */
function H(){ if(!state.health || typeof state.health !== "object") state.health = {}; return state.health; }
function curFlags(){ return hsFlags(H(), state.profile); }
function fmtDate(ts){ const d = new Date(ts); return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`; }
function hsStale(h){
  if(!h || !h.completedAt) return false;
  const days = (Date.now() - h.completedAt) / DAY_MS;
  if(days > 365) return true;                                                       // PAR-Q+: đánh giá lại mỗi năm
  if(h.pregnancy === "pregnant" && days > 84) return true;                          // ~1 tam cá nguyệt
  if(h.pregnancy === "postpartum" && h.postpartumWeeks !== "gt12" && h.postpartumWeeks !== "gt26" && days > 42) return true;
  return false;
}
function obOpen(){ const ob = document.getElementById("onboarding"); return !!(ob && ob.classList.contains("open")); }
/* Đang onboarding → giới tính vừa chọn (tempProfile của app.js); ngoài ra lấy từ hồ sơ */
function hsGender(){ try{ if(obOpen() && typeof tempProfile !== "undefined" && tempProfile && tempProfile.gender) return tempProfile.gender; }catch(e){} return state.profile.gender; }
function hsAge(){ const el = document.getElementById("in-age"); if(obOpen() && el && Number(el.value)) return Number(el.value); return Number(state.profile.age)||0; }

/* ---------------- 6b. API công khai — GÁN SỚM (FIX-training §4.3, vòng 2) ----------------
   File này vẫn nạp CUỐI (bọc mọi hàm render/startSession), nhưng window.FKHealth được gán NGAY khi file chạy — trước các bước
   bọc hàm & vẽ lại lúc khởi động bên dưới — nên mọi hàm render chạy trong lúc khởi động (recomputeProfile, rerenderActive,
   thẻ "Quay lại tập" của achievements…) đều đã thấy cờ sức khoẻ. Phần logic thuần (flags / itemTags / tagsFor / notesFor…)
   không phụ thuộc DOM. Khởi động xong: FKHealth.ready = true và document phát sự kiện "fk:health-ready"
   (module vẽ trước đó tự vẽ lại; module khác vẫn giữ dự phòng riêng khi chưa có FKHealth). */
const FKH = window.FKHealth = {
  flags: hsFlags, tagsFor: hsTagsFor, itemTags: hsItemTags, notesFor: hsNotesFor, applyNutrition: hsApplyNutrition,
  teenEER: hsTeenEER, generalTargets: hsGeneralTargets,
  norm: hsNorm, stale: hsStale, current: curFlags,
  openScreening, openTipsSheet, openDisclaimer, openPreSession, isOpen,
  PARQ, INJ, TIPS, DISCLAIMER_FULL,
  ready: false,
  /* chạy cb khi health-safety đã khởi động xong (ngay lập tức nếu đã xong) */
  onReady(cb){
    if(typeof cb !== "function") return;
    if(FKH.ready){ try{ cb(FKH); }catch(e){ console.warn("[health-safety] onReady", e); } return; }
    try{ document.addEventListener("fk:health-ready", ()=>{ try{ cb(FKH); }catch(e){ console.warn("[health-safety] onReady", e); } }, { once:true }); }catch(e){}
  },
};

/* =====================================================================
   7. MÀN SÀNG LỌC (lớp phủ toàn màn hình, phía trên onboarding)
   ===================================================================== */
let draft = null, step = 0, onDone = null, mode = "first";
const STEPS = 5;

function toDraft(h){
  const yn = v => v === true ? "yes" : v === false ? "no" : "";
  const q = h.parq || {};
  const d = { ack: !!h.ack, parq:{} };
  PARQ.forEach(([k])=> d.parq[k] = h.completedAt ? yn(!!q[k]) : "");
  if(h.completedAt){
    Object.assign(d, {
      pregnancy: h.pregnancy || "none", trimester: String(h.trimester||""), pregComplication: yn(!!h.pregComplication),
      postpartumWeeks: h.postpartumWeeks || "", cesarean: yn(!!h.cesarean), breastfeeding: yn(!!h.breastfeeding),
      diabetes: h.diabetes || "none", hypoRisk: h.hypoRisk ? "yes" : "no", cardio: h.cardio || "none", kidney: h.kidney || "none",
      edHistory: h.edHistory || "no", injuries: (h.injuries||[]).length ? h.injuries.slice() : ["none"], injuryNote: h.injuryNote || "",
    });
  } else Object.assign(d, { injuries: [], injuryNote: "" });
  return d;
}
function fromDraft(d, prev){
  const yes = v => v === "yes";
  const female = hsGender() === "female";
  const parq = {}; PARQ.forEach(([k])=> parq[k] = yes(d.parq[k]));
  const preg = female ? (d.pregnancy || "none") : "none";
  return {
    v: 1, completedAt: Date.now(), skippedAt: null, ack: d.ack ? Date.now() : null,
    parq, pregnancy: preg,
    trimester: preg === "pregnant" ? (Number(d.trimester) || 1) : null,
    pregComplication: preg === "pregnant" && yes(d.pregComplication),
    postpartumWeeks: preg === "postpartum" ? (d.postpartumWeeks || "gt12") : null,
    cesarean: preg === "postpartum" && yes(d.cesarean),
    breastfeeding: female && preg !== "pregnant" && yes(d.breastfeeding),
    diabetes: d.diabetes || "none",
    hypoRisk: (d.diabetes === "type1" || d.diabetes === "type2") && d.hypoRisk !== "no",
    cardio: d.cardio || "none", kidney: d.kidney || "none", edHistory: d.edHistory || "no",
    injuries: (d.injuries||[]).filter(k=> INJ[k]), injuryNote: String(d.injuryNote||"").slice(0,120),
    clearedVigorous: prev && prev.clearedVigorous || null,
    lastPreCheck: prev && prev.lastPreCheck || null,
  };
}

function ensureOverlay(){
  let el = document.getElementById("hs-overlay");
  if(el) return el;
  el = document.createElement("div");
  el.id = "hs-overlay";
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Sàng lọc sức khoẻ");
  el.innerHTML = `
    <div class="onboard-wrap hs-wrap">
      <div class="hs-top"><div class="onboard-progress hs-progress" id="hs-progress"></div><button type="button" class="hs-skip" id="hs-skip">Để sau</button></div>
      <div class="hs-body" id="hs-body"></div>
      <div class="onboard-footer">
        <button type="button" class="btn btn-outline" id="hs-back" aria-label="Quay lại"><span class="material-symbols-rounded">arrow_back</span></button>
        <button type="button" class="btn btn-primary btn-block" id="hs-next">Tiếp tục</button>
      </div>
    </div>`;
  (document.getElementById("app-shell") || document.body).appendChild(el);
  el.querySelector("#hs-next").addEventListener("click", next);
  el.querySelector("#hs-back").addEventListener("click", ()=> go(step-1));
  el.querySelector("#hs-skip").addEventListener("click", skip);
  el.querySelector("#hs-body").addEventListener("click", onBodyClick);
  el.querySelector("#hs-body").addEventListener("change", onBodyChange);
  el.querySelector("#hs-body").addEventListener("input", e=>{ if(e.target.id === "hs-inj-note") draft.injuryNote = e.target.value; });
  hsKeysOnce();
  return el;
}
function isOpen(){ const el = document.getElementById("hs-overlay"); return !!(el && el.classList.contains("open")); }

/* ---- FIX-core §1 (vòng 2): lớp sàng lọc là HỘP THOẠI THẬT cho bàn phím & trình đọc màn hình ----
   role="dialog" aria-modal="true" · mở ra: focus vào hộp (tiêu đề bước, tabindex=-1 — đọc được ngay nội dung bước) ·
   nền phía sau `inert` (mọi anh em trên đường từ lớp phủ lên <body>, trừ #toast và #sheet-backdrop) · Tab / Shift+Tab xoay vòng
   trong hộp, không thoát ra ngoài · Esc = "Để sau" (chế độ sửa: "Đóng") · đóng: gỡ inert, trả focus về nút đã mở (nếu còn hiện).
   Trước đây: focus kẹt ở #onboard-next phía sau, phải Tab 23 lần mới tới "Để sau". */
let _hsInert = [], _hsReturn = null, _hsKeys = false;
const HS_FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
function hsFocusables(el){
  if(!el || typeof el.querySelectorAll !== "function") return [];
  return [...el.querySelectorAll(HS_FOCUSABLE)].filter(x=>{
    if(x.hidden || (x.closest && x.closest("[hidden],[inert]"))) return false;
    let vis = ""; try{ vis = typeof getComputedStyle === "function" ? (getComputedStyle(x).visibility || "") : ""; }catch(e){}
    if(vis === "hidden" || (x.style && x.style.visibility === "hidden")) return false;
    if(x.closest && x.closest("details:not([open])") && x.tagName !== "SUMMARY") return false;      // nội dung <details> đang đóng
    return x.offsetParent !== null || (x.getClientRects && x.getClientRects().length > 0);
  });
}
function hsTrapOn(el){
  if(_hsInert.length) return;
  const ae = document.activeElement;
  _hsReturn = ae && ae !== document.body && !(el.contains && el.contains(ae)) ? ae : null;
  let node = el;
  while(node && node.parentNode && node !== document.body && node !== document.documentElement){
    const par = node.parentNode;
    [...(par.children || [])].forEach(sib=>{
      if(sib === node || !sib.setAttribute || /^(SCRIPT|STYLE|LINK|TEMPLATE|META)$/.test(sib.tagName || "")) return;
      if(sib.id === "toast" || sib.id === "sheet-backdrop") return;                       // thông báo & sheet mở chồng lên vẫn dùng được
      if(sib.hasAttribute && sib.hasAttribute("inert")) return;                             // inert sẵn (của sheet) → không đụng
      sib.setAttribute("inert", ""); _hsInert.push(sib);
    });
    node = par;
  }
}
function hsTrapOff(){
  _hsInert.forEach(x=>{ try{ x.removeAttribute("inert"); }catch(e){} });
  _hsInert = [];
  const rf = _hsReturn; _hsReturn = null;
  /* trả focus SAU khi hàm gọi lại (onboarding) chạy xong — chỉ khi nút cũ còn hiện, không bị inert */
  if(rf) setTimeout(()=>{
    try{ if(rf.focus && rf.isConnected !== false && !(rf.closest && rf.closest("[inert]")) && rf.offsetParent !== null) rf.focus({ preventScroll:true }); }catch(e){}
  }, 0);
}
function hsFocusStep(){
  const el = document.getElementById("hs-overlay"); if(!el) return;
  const h = el.querySelector("#hs-body .onboard-hero");
  if(!h || !h.setAttribute) return;
  h.setAttribute("tabindex", "-1"); h.id = "hs-title";
  try{ h.focus({ preventScroll:true }); }catch(e){ try{ h.focus(); }catch(_){} }
}
function hsKeysOnce(){
  if(_hsKeys) return; _hsKeys = true;
  /* pha BẮT (capture) để chạy trước listener Esc của sheet trong app.js: sheet đang mở chồng lên → để app.js đóng sheet, không "Để sau" */
  document.addEventListener("keydown", e=>{
    if(!isOpen()) return;
    const bd = document.getElementById("sheet-backdrop");
    if(bd && bd.classList.contains("open")) return;
    const el = document.getElementById("hs-overlay");
    if(e.key === "Escape" || e.key === "Esc"){ e.preventDefault(); e.stopPropagation(); skip(); return; }
    if(e.key !== "Tab") return;
    const f = hsFocusables(el), a = document.activeElement;
    if(!f.length){ e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if(!(el.contains && el.contains(a)) || a === el){ e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if(e.shiftKey && a === first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && a === last){ e.preventDefault(); first.focus(); }
  }, true);
}

function openScreening(opts){
  opts = opts || {};
  mode = opts.mode || (H().completedAt ? "edit" : "first");
  onDone = typeof opts.onDone === "function" ? opts.onDone : null;
  draft = toDraft(H());
  const el = ensureOverlay();
  /* hộp thoại thật (đặt lại mỗi lần mở — kể cả khi phần tử có sẵn từ trước) */
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Sàng lọc sức khoẻ");
  hsKeysOnce();
  el.querySelector("#hs-skip").textContent = mode === "edit" ? "Đóng" : "Để sau";
  el.querySelector("#hs-skip").setAttribute("aria-label", mode === "edit" ? "Đóng sàng lọc sức khoẻ (Esc)" : "Để sau — bỏ qua sàng lọc (Esc)");
  el.classList.add("open");
  hsTrapOn(el);
  go(mode === "edit" ? 1 : 0);
}
function closeOverlay(){ const el = document.getElementById("hs-overlay"); if(el) el.classList.remove("open"); hsTrapOff(); }

function skip(){
  if(mode !== "edit"){ H().skippedAt = Date.now(); saveState(); }
  closeOverlay();
  const cb = onDone; onDone = null;
  if(cb) cb("skip");
  else if(mode !== "edit") toast("Bạn có thể sàng lọc sức khoẻ bất cứ lúc nào trong Hồ sơ", "health_and_safety");
}

function opt(key, val, label, sub){
  const cur = key.split(".").reduce((o,k)=> o && o[k], draft);
  const on = Array.isArray(cur) ? cur.includes(val) : cur === val;
  return `<button type="button" class="hs-opt ${on?"on":""}" data-k="${key}" data-v="${val}" aria-pressed="${on}">${label}${sub?`<small>${sub}</small>`:""}</button>`;
}
function yn(key){ return `<div class="hs-yn">${opt(key,"yes","Có")}${opt(key,"no","Không")}</div>`; }
function q(title, inner, key, note){
  return `<div class="hs-q" data-q="${key||""}"><h4>${title}</h4>${note?`<p class="hs-note">${note}</p>`:""}${inner}</div>`;
}

function stepHTML(i){
  const female = hsGender() === "female";
  if(i === 0) return `
    <div class="hs-hero"><span class="material-symbols-rounded">health_and_safety</span></div>
    <h3 class="onboard-hero">Sức khoẻ &amp; an toàn</h3>
    <p class="onboard-sub">Vài câu hỏi (~1 phút) giúp TapEasy điều chỉnh mức calo, đạm và ẩn / cảnh báo bài tập không phù hợp với bạn. Dữ liệu <b>chỉ lưu trên điện thoại này</b>.</p>
    <div class="hs-disc">${DISCLAIMER_SHORT}
      <details><summary>Đọc đầy đủ tuyên bố miễn trừ trách nhiệm y tế</summary><ul>${DISCLAIMER_FULL.map(x=>`<li>${x}</li>`).join("")}</ul></details>
    </div>
    <label class="hs-check" data-q="ack"><input type="checkbox" id="hs-ack" ${draft.ack?"checked":""}><span>Tôi hiểu TapEasy không thay thế tư vấn của bác sĩ.</span></label>
    <p class="hs-note">Bạn có thể bấm "Để sau", nhưng khi đó app không biết để điều chỉnh an toàn cho bạn.</p>`;
  if(i === 1) return `
    <h3 class="onboard-hero">Sẵn sàng vận động?</h3>
    <p class="onboard-sub">7 câu hỏi dựa trên PAR-Q+ (bản rút gọn). Trả lời trung thực — không có đáp án "đúng".</p>
    ${PARQ.map(([k,t],n)=> q(`<span class="hs-num">${n+1}</span>${t}`, yn("parq."+k), "parq."+k)).join("")}`;
  if(i === 2){
    const d = draft;
    let preg = "";
    if(female){
      preg = q("Thai kỳ &amp; sau sinh", `<div class="hs-opts">${opt("pregnancy","none","Không áp dụng")}${opt("pregnancy","pregnant","Đang mang thai")}${opt("pregnancy","postpartum","Đã sinh trong 12 tháng qua")}</div>
        ${d.pregnancy==="pregnant" ? `
          <div class="hs-sub"><h5>Đang ở giai đoạn nào?</h5><div class="hs-opts">${opt("trimester","1","Tam cá nguyệt 1","tuần 1–13")}${opt("trimester","2","Tam cá nguyệt 2","tuần 14–27")}${opt("trimester","3","Tam cá nguyệt 3","từ tuần 28")}</div></div>
          <div class="hs-sub" data-q="pregComplication"><h5>Có biến chứng (tiền sản giật, nhau tiền đạo, ra máu, dọa sinh non, hở eo, đa thai…) hoặc bác sĩ dặn hạn chế vận động?</h5>${yn("pregComplication")}</div>` : ""}
        ${d.pregnancy==="postpartum" ? `
          <div class="hs-sub"><h5>Sinh được bao lâu?</h5><div class="hs-opts">${opt("postpartumWeeks","lt6","Dưới 6 tuần")}${opt("postpartumWeeks","6to12","6–12 tuần")}${opt("postpartumWeeks","gt12","12 tuần – 6 tháng")}${opt("postpartumWeeks","gt26","Trên 6 tháng")}</div></div>
          <div class="hs-sub" data-q="cesarean"><h5>Sinh mổ?</h5>${yn("cesarean")}</div>` : ""}`, "pregnancy");
      if(d.pregnancy !== "pregnant") preg += q("Đang cho con bú?", yn("breastfeeding"), "breastfeeding");
    }
    return `
      <h3 class="onboard-hero">Tình trạng sức khoẻ</h3>
      <p class="onboard-sub">Chọn đúng tình trạng hiện tại để app không đưa ra khuyến nghị nguy hiểm cho bạn.</p>
      ${preg}
      ${q("Tiểu đường", `<div class="hs-opts">${opt("diabetes","none","Không")}${opt("diabetes","pre","Tiền tiểu đường")}${opt("diabetes","type2","Type 2")}${opt("diabetes","type1","Type 1")}</div>
        ${d.diabetes==="type1"||d.diabetes==="type2" ? `<div class="hs-sub" data-q="hypoRisk"><h5>Dùng insulin hoặc thuốc dễ gây hạ đường huyết (VD gliclazide, glimepiride)?</h5><div class="hs-opts">${opt("hypoRisk","yes","Có")}${opt("hypoRisk","no","Không")}${opt("hypoRisk","unknown","Không rõ")}</div></div>` : ""}`, "diabetes")}
      ${q("Tim mạch &amp; huyết áp", `<div class="hs-opts hs-col">${opt("cardio","none","Không")}${opt("cardio","htn_ok","Tăng huyết áp đã kiểm soát","thường dưới 140/90 mmHg khi dùng thuốc")}${opt("cardio","htn_bad","Huyết áp chưa kiểm soát / không rõ")}${opt("cardio","heart","Bệnh tim","mạch vành, suy tim, rối loạn nhịp, van tim, đặt stent…")}</div>`, "cardio")}
      ${q("Bệnh thận", `<div class="hs-opts">${opt("kidney","none","Không")}${opt("kidney","ckd","Bệnh thận mạn")}${opt("kidney","dialysis","Đang lọc máu")}</div>`, "kidney")}`;
  }
  if(i === 3){
    const age = hsAge();
    return `
      <h3 class="onboard-hero">Ăn uống &amp; chấn thương</h3>
      <p class="onboard-sub">Giúp app chọn cách khuyến nghị phù hợp với bạn.</p>
      ${q("Bạn từng có rối loạn ăn uống (chán ăn, ăn vô độ, cuồng ăn…) hoặc đang điều trị?", `<div class="hs-opts">${opt("edHistory","no","Không")}${opt("edHistory","yes","Có")}${opt("edHistory","skip","Không muốn trả lời")}</div>`, "edHistory",
        "Câu trả lời giúp app tránh đặt mục tiêu thâm hụt calo cho bạn.")}
      ${q("Chấn thương / đau cơ xương khớp hiện tại", `<div class="hs-opts">${opt("injuries","none","Không có")}${Object.entries(INJ).map(([k,l])=> opt("injuries",k,l)).join("")}</div>
        ${(draft.injuries||[]).some(k=>INJ[k]) ? `<div class="field hs-field"><label for="hs-inj-note">Ghi chú (không bắt buộc)</label><input type="text" id="hs-inj-note" maxlength="120" placeholder="VD: đứt dây chằng chéo gối phải 2024" value="${esc(draft.injuryNote||"")}"></div>` : ""}`, "injuries")}
      ${age ? `<div class="hs-agebox ${age<18?"warn":""}"><span class="material-symbols-rounded">${age<18?"school":"check_circle"}</span><span>Tuổi trong hồ sơ: <b>${age}</b>${age<18?" — dưới 18 tuổi: app sẽ không đặt thâm hụt calo và nhắc tập có giám sát.":""}</span></div>` : ""}`;
  }
  // i === 4: kết quả
  const tmp = fromDraft(draft, H());
  const f = hsFlags(tmp, { gender: hsGender(), age: hsAge(), activity: state.profile.activity, goal: state.profile.goal });
  const items = [];
  if(f.urgent) items.push(`<div class="hs-banner hs-urgent"><span class="material-symbols-rounded">emergency</span><div><b>Nên đi khám trước khi tập.</b> ${[...(f.symptom?TIPS.symptom:[]), ...(f.supervised?TIPS.supervised:[]), ...(f.pregComp?TIPS.pregComp:[])].join(" ")}</div></div>`);
  const adj = [];
  if(f.preg) adj.push(`Calo = mức duy trì + <b>${f.kcalExtra}</b> kcal (tam cá nguyệt ${f.tri}); không thâm hụt.`);
  else if(f.bf) adj.push(`Calo = mức duy trì + <b>${f.kcalExtra}</b> kcal cho việc tạo sữa; không thâm hụt.`);
  else if(f.noDeficit) adj.push(`Không áp dụng thâm hụt calo (${f.noDeficitReasons.map(r=>REASON_LABEL[r]).join(", ")}).`);
  if(f.ppk != null) adj.push(`Đạm khoảng <b>${String(f.ppk).replace(".",",")} g/kg</b>/ngày${f.kidney!=="none"?" (giới hạn vì bệnh thận — hỏi bác sĩ thận)":""}.`);
  if(f.ed) adj.push(`<b>Ẩn số calo</b> trên màn Dinh dưỡng — hiển thị khẩu phần &amp; đĩa ăn cân bằng (bạn bật lại được).`);
  if(f.hideVeryHigh) adj.push(`<b>Ẩn</b> buổi &amp; bài cường độ rất cao (HIIT, nước rút, burpee, Hyrox…).`);
  else if(f.cautionVeryHigh) adj.push(`Cảnh báo ở buổi / bài cường độ rất cao.`);
  if(f.preg && f.tri >= 2) adj.push(`Gắn cờ bài nằm ngửa / nằm sấp, bật nhảy, gập bụng mạnh.`);
  else if(f.preg) adj.push(`Gắn cờ bài bật nhảy, nín thở khi nâng tạ.`);
  if(f.postEarly) adj.push(`Gắn cờ chạy / nhảy và gập bụng mạnh (dưới 12 tuần sau sinh).`);
  if(f.injuries.length) adj.push(`Gắn cờ bài tải lên: ${f.injuries.map(k=>INJ[k].toLowerCase()).join(", ")}.`);
  if(f.preCheck) adj.push(`Nhắc kiểm tra an toàn trước buổi tập đầu tiên mỗi ngày.`);
  items.push(adj.length
    ? `<div class="hs-res"><h4><span class="material-symbols-rounded">tune</span>TapEasy sẽ điều chỉnh</h4><ul>${adj.map(a=>`<li>${a}</li>`).join("")}</ul></div>`
    : `<div class="hs-res ok"><h4><span class="material-symbols-rounded">check_circle</span>Không có lưu ý đặc biệt</h4><p>Bạn có thể bắt đầu tập ở mức vừa và tăng dần. Hãy làm lại sàng lọc khi sức khoẻ thay đổi hoặc sau 12 tháng.</p></div>`);
  if(f.doctor.length) items.push(`<div class="hs-res doc"><h4><span class="material-symbols-rounded">stethoscope</span>Nên hỏi ý kiến bác sĩ</h4><div class="hs-chips">${f.doctor.map(k=>`<span>${DOCTOR_LABEL[k]}</span>`).join("")}</div><p>Hãy trao đổi với bác sĩ trước khi bắt đầu hoặc tăng cường độ tập. TapEasy không thay thế tư vấn y tế.</p></div>`);
  return `<h3 class="onboard-hero">Kết quả sàng lọc</h3><p class="onboard-sub">Bạn có thể sửa lại bất cứ lúc nào: Hồ sơ → Sức khoẻ &amp; an toàn.</p>${items.join("")}`;
}

function go(i){
  step = Math.max(0, Math.min(STEPS-1, i));
  const el = ensureOverlay();
  el.querySelector("#hs-progress").innerHTML = Array.from({length:STEPS}, (_,k)=> `<div class="${k<=step?"done":""}"></div>`).join("");
  el.querySelector("#hs-body").innerHTML = stepHTML(step);
  el.querySelector("#hs-body").scrollTop = 0;
  el.querySelector("#hs-back").style.visibility = step === 0 ? "hidden" : "visible";
  el.querySelector("#hs-next").textContent = step === 0 ? "Bắt đầu" : step === STEPS-1 ? (mode === "first" ? "Hoàn tất & tiếp tục" : "Lưu") : "Tiếp tục";
  if(isOpen()) hsFocusStep();                  // vòng 2: mỗi bước mới → focus tiêu đề bước (trình đọc màn hình đọc ngay)
}

function missing(i){
  const d = draft, miss = [];
  const female = hsGender() === "female";
  if(i === 0 && !d.ack) miss.push("ack");
  if(i === 1) PARQ.forEach(([k])=>{ if(!d.parq[k]) miss.push("parq."+k); });
  if(i === 2){
    if(female){
      if(!d.pregnancy) miss.push("pregnancy");
      if(d.pregnancy === "pregnant"){ if(!d.trimester) miss.push("pregnancy"); if(!d.pregComplication) miss.push("pregComplication"); }
      if(d.pregnancy === "postpartum"){ if(!d.postpartumWeeks) miss.push("pregnancy"); if(!d.cesarean) miss.push("cesarean"); }
      if(d.pregnancy !== "pregnant" && !d.breastfeeding) miss.push("breastfeeding");
    }
    if(!d.diabetes) miss.push("diabetes");
    if((d.diabetes === "type1" || d.diabetes === "type2") && !d.hypoRisk) miss.push("hypoRisk");
    if(!d.cardio) miss.push("cardio");
    if(!d.kidney) miss.push("kidney");
  }
  if(i === 3){
    if(!d.edHistory) miss.push("edHistory");
    if(!(d.injuries||[]).length) miss.push("injuries");
  }
  return miss;
}
function next(){
  const miss = missing(step);
  if(miss.length){
    const body = document.getElementById("hs-body");
    $$(".hs-missing", body).forEach(x=> x.classList.remove("hs-missing"));
    miss.forEach(k=>{ const box = body.querySelector(`[data-q="${k}"]`); if(box) box.classList.add("hs-missing"); });
    const first = body.querySelector(".hs-missing"); if(first && first.scrollIntoView) first.scrollIntoView({ block:"center", behavior:"smooth" });
    /* vòng 2: bàn phím — đưa focus tới ô đầu tiên còn thiếu */
    const ctl = first && first.querySelector ? first.querySelector("input, .hs-opt") : null;
    if(ctl && ctl.focus){ try{ ctl.focus({ preventScroll:true }); }catch(e){} }
    toast(step === 0 ? "Hãy đánh dấu ô xác nhận để tiếp tục" : "Vui lòng trả lời đủ các câu được tô viền", "error");
    return;
  }
  if(step < STEPS-1){ go(step+1); return; }
  commit();
}
function commit(){
  const prev = H();
  const h = fromDraft(draft, prev);
  /* vòng 2: vừa khai tiền sử RLĂU → bỏ lựa chọn "ẩn số calo" cũ để mặc định (BẬT) áp dụng; người dùng vẫn tắt lại được */
  if(h.edHistory === "yes" && prev.edHistory !== "yes" && state.nutriPro && typeof state.nutriPro === "object") delete state.nutriPro.hideKcal;
  // Nếu không còn lý do ẩn bài → xoá xác nhận "bác sĩ đã cho phép" cũ
  if(!hsFlags(h, Object.assign({}, state.profile, { gender: hsGender(), age: hsAge() || state.profile.age })).hideVeryHigh) h.clearedVigorous = null;
  state.health = h;
  saveState();
  const cb = onDone; onDone = null;
  closeOverlay();
  if(cb){ cb("done"); }                       // onboarding: hàm gốc tự recomputeProfile + chào mừng
  else {
    try{ recomputeProfile(); saveState(); }catch(e){}
    rerenderActive();
  }
  const f = curFlags();
  if(f.urgent) setTimeout(()=> toast("Đã lưu — hãy hỏi bác sĩ trước khi tập", "stethoscope"), cb ? 2600 : 0);
  else if(!cb) toast("Đã lưu sàng lọc sức khoẻ", "health_and_safety");
}
function onBodyClick(e){
  const b = e.target.closest(".hs-opt"); if(!b) return;
  const key = b.dataset.k, val = b.dataset.v;
  if(key === "injuries"){
    let arr = (draft.injuries||[]).slice();
    if(val === "none") arr = ["none"];
    else { arr = arr.filter(x=> x !== "none"); arr = arr.includes(val) ? arr.filter(x=> x !== val) : arr.concat(val); }
    draft.injuries = arr;
  } else {
    const parts = key.split("."); let o = draft;
    for(let k=0; k<parts.length-1; k++){ o[parts[k]] = o[parts[k]] || {}; o = o[parts[k]]; }
    o[parts[parts.length-1]] = val;
  }
  const body = document.getElementById("hs-body"), top = body.scrollTop;
  const ae = document.activeElement, hadFocus = !!(ae && body.contains && body.contains(ae));
  body.innerHTML = stepHTML(step); body.scrollTop = top;
  /* vòng 2: vẽ lại bước làm mất nút đang focus → focus lại đúng lựa chọn vừa bấm (không rơi về <body> / ra ngoài hộp) */
  if(hadFocus || ae === document.body){
    const nb = body.querySelector(`.hs-opt[data-k="${key}"][data-v="${val}"]`);
    if(nb && nb.focus){ try{ nb.focus({ preventScroll:true }); }catch(e){} }
  }
}
function onBodyChange(e){ if(e.target.id === "hs-ack") draft.ack = e.target.checked; }

/* =====================================================================
   8. SHEET: lời khuyên, miễn trừ, kiểm tra trước buổi, khoá buổi
   ===================================================================== */
function tipBlocks(f){
  const blocks = [];
  const add = (ic, title, list, cls) => list && list.length && blocks.push(`<div class="hs-tipblock ${cls||""}"><h4><span class="material-symbols-rounded">${ic}</span>${title}</h4><ul>${list.map(x=>`<li>${x}</li>`).join("")}</ul></div>`);
  if(f.symptom) add("emergency", "Cần khám trước khi tập", TIPS.symptom, "urgent");
  if(f.supervised) add("medical_services", "Vận động có giám sát y tế", TIPS.supervised, "urgent");
  if(f.pregComp) add("pregnant_woman", "Biến chứng thai kỳ", TIPS.pregComp, "urgent");
  if(f.preg) add("pregnant_woman", `Khi mang thai (tam cá nguyệt ${f.tri})`, TIPS.pregnant);
  if(f.post) add("pregnant_woman", "Sau sinh", TIPS.postpartum);
  if(f.bf) add("water_drop", "Cho con bú", TIPS.breastfeeding);
  if(f.cardio !== "none" || (f.parqYes && H().parq && H().parq.heart)) add("monitor_heart", "Tim mạch & huyết áp", TIPS.cardio);
  if(f.diab !== "none" && f.diab !== "pre") add("water_drop", f.hypo ? "Tiểu đường — nguy cơ hạ đường huyết" : "Tiểu đường", TIPS.diabetes);
  if(f.diab === "pre") add("water_drop", "Tiền tiểu đường", ["Tập đều đặn (≥ 150 phút/tuần) và giảm cân nhẹ nếu thừa cân giúp giảm nguy cơ tiến triển thành tiểu đường type 2. Hỏi bác sĩ về lịch xét nghiệm định kỳ."]);
  if(f.kidney !== "none") add("medical_services", f.kidney === "dialysis" ? "Đang lọc máu" : "Bệnh thận mạn", TIPS.kidney.concat(f.kidney === "dialysis" ? TIPS.dialysis : []));
  if(f.ed) add("favorite", "Ăn uống lành mạnh", TIPS.ed);
  if(f.injuries.length) add("healing", `Chấn thương: ${f.injuries.map(k=>INJ[k].toLowerCase()).join(", ")}${H().injuryNote?` — ${esc(H().injuryNote)}`:""}`, TIPS.injury);
  if(f.minor) add("school", "Dưới 18 tuổi", TIPS.minor);
  if(f.parqYes && !f.symptom && !f.supervised) add("stethoscope", "PAR-Q+", TIPS.parq);
  add("info", "Nguyên tắc chung", TIPS.general);
  return blocks.join("");
}
function openTipsSheet(){
  const f = curFlags();
  openSheet(`
    <div class="sheet-header"><h3>Lưu ý an toàn khi tập</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    ${f.screened ? "" : `<div class="hs-banner hs-warn"><span class="material-symbols-rounded">info</span><div>Bạn chưa làm sàng lọc sức khoẻ — dưới đây chỉ là lưu ý chung.</div></div>`}
    ${tipBlocks(f)}
    <p class="small-note hs-src">Tham khảo: PAR-Q+ 2023, ACSM's Guidelines (2021), ACOG Committee Opinion 804 (2020), ADA Standards of Care, IOM DRI, KDOQI 2020. Không thay thế tư vấn y tế.</p>
    <button class="btn btn-outline btn-block" id="hs-tips-disc" style="margin-top:8px;"><span class="material-symbols-rounded">shield</span>Tuyên bố miễn trừ trách nhiệm y tế</button>
  `);
  const b = document.getElementById("hs-tips-disc"); if(b) b.addEventListener("click", openDisclaimer);
}
function openDisclaimer(){
  openSheet(`
    <div class="sheet-header"><h3>Miễn trừ trách nhiệm y tế</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <div class="policy-text hs-disc-full">${DISCLAIMER_FULL.map(x=>`<p>${x}</p>`).join("")}</div>
    <button class="btn btn-primary btn-block" onclick="closeSheet()" style="margin-top:12px;">Tôi đã hiểu</button>
  `);
}
function preSessionList(f){
  const out = [];
  if(f.symptom || f.supervised || f.pregComp) out.push(`<li class="urgent"><b>Bạn nên được bác sĩ cho phép trước khi tập.</b></li>`);
  if(f.cardio !== "none") out.push(`<li>Huyết áp lúc nghỉ ≥ 180/110 mmHg, đau ngực, khó thở → <b>không tập hôm nay</b>. Không nín thở khi nâng tạ.</li>`);
  if(f.hypo || f.diab === "type1") out.push(`<li>Đã đo đường huyết? Dưới ~5,6 mmol/L (100 mg/dL) → ăn 15–30 g tinh bột trước. Mang theo kẹo / đường viên.</li>`);
  else if(f.diab === "type2") out.push(`<li>Uống đủ nước; nếu thấy run tay, vã mồ hôi, hoa mắt → dừng tập và ăn chút đường.</li>`);
  if(f.preg) out.push(`<li>Dừng ngay nếu ra máu, co thắt đau, rỉ ối, chóng mặt, đau đầu, đau ngực, đau / sưng bắp chân. Giữ mức "vẫn nói chuyện được", uống đủ nước, tránh quá nóng.</li>`);
  if(f.post) out.push(`<li>Sau sinh: tăng dần, ưu tiên sàn chậu và hơi thở; dừng nếu són tiểu, nặng vùng chậu hoặc ra máu nhiều hơn.</li>`);
  if(f.kidney === "dialysis") out.push(`<li>Không tập ngay sau buổi lọc máu; không mang tạ ở tay có cầu nối AV.</li>`);
  else if(f.kidney === "ckd") out.push(`<li>Uống nước theo chỉ định của bác sĩ thận; tránh mất nước khi tập.</li>`);
  out.push(`<li>Đau / tức ngực, khó thở bất thường, choáng váng → dừng ngay, gọi <b>115</b>.</li>`);
  return out.join("");
}
function openPreSession(onGo){
  const f = curFlags();
  openSheet(`
    <div class="sheet-header"><h3>Kiểm tra nhanh trước khi tập</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <ul class="hs-precheck">${preSessionList(f)}</ul>
    <button class="btn btn-primary btn-block" id="hs-pre-go" style="margin-top:12px;"><span class="material-symbols-rounded">play_arrow</span>Tôi đã kiểm tra — bắt đầu</button>
    <button class="btn btn-ghost btn-block" id="hs-pre-tips" style="margin-top:6px;">Xem đầy đủ lưu ý an toàn</button>
    <p class="small-note" style="text-align:center;margin-top:6px;">Chỉ nhắc 1 lần mỗi ngày.</p>
  `);
  document.getElementById("hs-pre-go").addEventListener("click", ()=>{ H().lastPreCheck = todayStr(); saveState(); onGo(); });
  document.getElementById("hs-pre-tips").addEventListener("click", openTipsSheet);
}
function lockReason(f){
  const r = [];
  if(f.cardio === "heart") r.push("bệnh tim");
  if(f.cardio === "htn_bad") r.push("huyết áp chưa kiểm soát");
  if(f.symptom) r.push("đau ngực / choáng ngất");
  if(f.supervised) r.push("cần giám sát y tế");
  if(f.pregComp) r.push("biến chứng thai kỳ");
  return r.join(", ");
}
function openLockSheet(){
  const f = curFlags();
  openSheet(`
    <div class="sheet-header"><h3>Buổi cường độ rất cao đã được ẩn</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <div class="hs-banner hs-urgent"><span class="material-symbols-rounded">lock</span><div>Theo sàng lọc sức khoẻ (${lockReason(f)}), TapEasy không đề xuất buổi / bài cường độ rất cao như HIIT, nước rút, burpee, Hyrox cho bạn. Gắng sức tối đa làm tăng mạnh huyết áp và nhu cầu oxy của tim.</div></div>
    <p class="small-note" style="margin-top:10px;">Gợi ý thay thế: đi bộ nhanh, đạp xe hoặc chèo ở mức "vẫn nói chuyện được" (Zone 2) 20–40 phút, kết hợp tạ nhẹ–vừa (RPE ≤ 7).</p>
    <button class="btn btn-outline btn-block" id="hs-lock-clear" style="margin-top:12px;"><span class="material-symbols-rounded">stethoscope</span>Bác sĩ đã cho phép tôi tập cường độ cao</button>
    <button class="btn btn-ghost btn-block" id="hs-lock-tips" style="margin-top:6px;">Xem lưu ý an toàn</button>
  `);
  document.getElementById("hs-lock-clear").addEventListener("click", confirmClearance);
  document.getElementById("hs-lock-tips").addEventListener("click", openTipsSheet);
}
function confirmClearance(){
  confirmDialog("Bác sĩ đã cho phép?", "Chỉ xác nhận khi bác sĩ đã khám và đồng ý cho bạn tập cường độ rất cao. Bạn có thể tắt lại trong Hồ sơ → Sức khoẻ & an toàn.", ()=>{
    H().clearedVigorous = Date.now(); saveState(); closeSheet(); rerenderActive();
    toast("Đã hiện lại các buổi cường độ rất cao", "check_circle");
  }, "Xác nhận", "stethoscope");
}

/* =====================================================================
   9. CHÈN GIAO DIỆN VÀO CÁC MÀN CÓ SẴN
   ===================================================================== */
function noteBoxHTML(notes){
  if(!notes.length) return "";
  return `<div class="hs-notebox">${notes.map(n=>`<div class="hs-nb ${n.lv}"><span class="material-symbols-rounded">${n.ic}</span><span>${n.t}</span></div>`).join("")}</div>`;
}
function chipsHTML(notes){
  if(!notes.length) return "";
  const short = n => n.lv === "hide" ? "Đã ẩn" : n.ic === "pregnant_woman" ? "Thai kỳ" : n.ic === "healing" ? "Chấn thương" : n.ic === "monitor_heart" ? "Không nín thở" : n.ic === "favorite" ? "Rất cao" : n.ic === "school" ? "< 18 tuổi" : "Lưu ý";
  const uniq = []; notes.forEach(n=>{ const s = short(n); if(!uniq.some(u=>u.s===s)) uniq.push({ s, lv:n.lv, ic:n.ic }); });
  return `<div class="hs-chiprow">${uniq.slice(0,3).map(u=>`<span class="hs-chip ${u.lv}"><span class="material-symbols-rounded">${u.ic}</span>${u.s}</span>`).join("")}</div>`;
}
/* Gắn cờ vào danh sách bài (màn Tập luyện: [data-ex]; trình sửa giáo án: [data-item]) */
function decorateRows(root, items, attr, intensity, f){
  let hidden = 0;
  items.forEach(it=>{
    const row = root.querySelector(`[${attr}="${it.uid}"]`); if(!row) return;
    const notes = hsNotesFor(hsItemTags(it, intensity), f);
    if(!notes.length) return;
    const info = row.querySelector(".info") || row;
    if(!info.querySelector(".hs-chiprow")) info.insertAdjacentHTML("beforeend", chipsHTML(notes));
    if(notes.some(n=>n.lv === "hide")){ row.classList.add("hs-dim"); hidden++; }
  });
  return hidden;
}

/* --- Màn Tập luyện --- */
function decorateWorkout(){
  const f = curFlags(); if(!f.screened) return;
  const plan = getActivePlan(); if(!plan) return;
  const day = plan.days[state.selectedDay]; if(!day) return;
  const card = document.getElementById("today-card"); if(!card) return;
  const isRest = !day.items.length;
  const lockDay = f.hideNow && day.intensity === "Rất cao" && !isRest;
  const btn = document.getElementById("btn-start-session");
  if(lockDay && btn){
    btn.insertAdjacentHTML("beforebegin", `<div class="hs-locked"><span class="material-symbols-rounded">lock</span><div><b>Buổi cường độ rất cao — đã ẩn</b><small>Theo sàng lọc sức khoẻ (${lockReason(f)}). Hãy hỏi bác sĩ hoặc tập buổi nhẹ hơn.</small></div></div>`);
    const alt = document.createElement("button");
    alt.className = "btn btn-outline btn-block"; alt.id = "hs-why"; alt.type = "button";
    alt.innerHTML = `<span class="material-symbols-rounded">info</span>Vì sao bị ẩn?`;
    btn.replaceWith(alt);
    alt.addEventListener("click", openLockSheet);
  } else if(!isRest && (f.any || f.urgent)){
    const lines = [];
    if(f.urgent) lines.push("Bạn nên được bác sĩ cho phép trước khi tập.");
    else if(day.intensity === "Rất cao" && f.cautionVeryHigh) lines.push("Buổi cường độ rất cao — hãy giảm xuống mức vừa.");
    else if(f.preg) lines.push(`Mang thai tam cá nguyệt ${f.tri}: giữ mức "vẫn nói chuyện được", uống đủ nước.`);
    else if(f.hypo) lines.push("Đo đường huyết trước tập, mang theo kẹo / đường viên.");
    else if(f.cardio !== "none") lines.push("Khởi động kỹ, không nín thở khi nâng tạ.");
    else lines.push("Có lưu ý an toàn theo sàng lọc sức khoẻ của bạn.");
    if(!card.querySelector(".hs-today")) card.insertAdjacentHTML("beforeend", `<button type="button" class="hs-today ${f.urgent?"urgent":""}" id="hs-today"><span class="material-symbols-rounded">${f.urgent?"stethoscope":"health_and_safety"}</span><span>${lines[0]}</span><span class="material-symbols-rounded">chevron_right</span></button>`);
    const t = document.getElementById("hs-today"); if(t) t.addEventListener("click", openTipsSheet);
  }
  const list = document.getElementById("exercise-list");
  if(list && !isRest){
    const hidden = decorateRows(list, day.items, "data-ex", day.intensity, f);
    if(hidden && !lockDay && !list.querySelector(".hs-hidden-note")){
      list.insertAdjacentHTML("afterbegin", `<button type="button" class="hs-hidden-note"><span class="material-symbols-rounded">visibility_off</span><span>${hidden} bài cường độ rất cao sẽ được bỏ qua khi bạn bấm "Bắt đầu buổi tập".</span></button>`);
      list.querySelector(".hs-hidden-note").addEventListener("click", openLockSheet);
    }
  }
}

/* --- Trình sửa giáo án --- */
function decoratePlans(){
  const f = curFlags(); if(!f.screened) return;
  if(typeof plansUI === "undefined" || plansUI.mode !== "edit" || !plansUI.planId) return;
  const plan = state.plans[plansUI.planId]; if(!plan) return;
  const day = plan.days[plansUI.day]; if(!day) return;
  const root = document.getElementById("screen-plans"); if(!root) return;
  decorateRows(root, day.items, "data-item", day.intensity, f);
  const sel = document.getElementById("pd-intensity");
  if(sel && day.intensity === "Rất cao" && (f.hideNow || f.cautionVeryHigh) && !root.querySelector(".hs-plan-note")){
    sel.closest(".card").insertAdjacentHTML("beforeend", `<div class="hs-nb ${f.hideNow?"hide":"warn"} hs-plan-note"><span class="material-symbols-rounded">${f.hideNow?"lock":"favorite"}</span><span>${f.hideNow ? "Buổi \"Rất cao\" sẽ bị ẩn khi tập theo sàng lọc sức khoẻ của bạn." : "Buổi \"Rất cao\" — với tình trạng của bạn nên hạ xuống \"Vừa\" hoặc \"Cao\"."}</span></div>`);
  }
}

/* --- Giáo án mẫu --- */
function tplHasVeryHigh(t){ return Object.values(t.days||{}).some(d=> d && d.intensity === "Rất cao"); }
function decorateTemplateList(){
  const f = curFlags(); if(!f.screened || !(f.hideNow || f.cautionVeryHigh)) return;
  $$("#sheet-content .tpl-card[data-tpl]").forEach(card=>{
    const t = (PROGRAM_TEMPLATES||[]).find(x=> x.id === card.dataset.tpl); if(!t || !tplHasVeryHigh(t)) return;
    const top = card.querySelector(".tpl-top"); if(!top || top.querySelector(".hs-tpl")) return;
    top.insertAdjacentHTML("beforeend", `<span class="tpl-lv hs-tpl ${f.hideNow?"hide":""}">${f.hideNow ? "Có buổi bị ẩn" : "Có buổi rất cao"}</span>`);
  });
}
function decorateTemplateDetail(id){
  const f = curFlags(); if(!f.screened) return;
  const t = (PROGRAM_TEMPLATES||[]).find(x=> x.id === id); if(!t) return;
  const dayEls = $$("#sheet-content .tpl-week .tpl-day");
  let n = 0;
  DAY_KEYS.forEach((k, i)=>{
    const d = t.days[k]; const el = dayEls[i]; if(!d || !el) return;
    if(d.intensity === "Rất cao" && (f.hideNow || f.cautionVeryHigh)){
      n++;
      const h = el.querySelector(".tpl-day-h"); if(h && !h.querySelector(".hs-chip")) h.insertAdjacentHTML("beforeend", `<span class="hs-chip ${f.hideNow?"hide":"warn"}"><span class="material-symbols-rounded">${f.hideNow?"lock":"favorite"}</span>${f.hideNow?"Sẽ ẩn":"Rất cao"}</span>`);
    }
  });
  const pr = document.querySelector("#sheet-content .tpl-principles");
  if(pr && (n || f.preg || f.postEarly || f.injuries.length) && !document.querySelector("#sheet-content .hs-tpl-note")){
    const msg = n && f.hideNow ? `${n} buổi cường độ rất cao trong giáo án này sẽ bị ẩn theo sàng lọc sức khoẻ của bạn.`
      : n ? `Giáo án có ${n} buổi cường độ rất cao — với tình trạng của bạn nên hạ cường độ.`
      : "Một số bài có thể được gắn cờ theo sàng lọc sức khoẻ (thai kỳ / chấn thương) khi thêm vào tuần tập.";
    pr.insertAdjacentHTML("afterend", `<div class="hs-nb ${n&&f.hideNow?"hide":"warn"} hs-tpl-note"><span class="material-symbols-rounded">health_and_safety</span><span>${msg}</span></div>`);
  }
}

/* --- Vòng 2: "Ẩn số calo" (lựa chọn lưu ở state.nutriPro.hideKcal — nutrition.js; mặc định BẬT khi khai tiền sử RLĂU) --- */
function hsHideK(){ try{ return typeof nuHideKcal === "function" && !!nuHideKcal(); }catch(e){ return false; } }
function hsKcalSwitchHTML(f){
  if(typeof nuSetHideKcal !== "function") return "";
  const on = hsHideK();
  return `<div class="hs-kcal-row"><span><b>Ẩn số calo</b><small>${f && f.ed ? "Bật sẵn vì bạn khai tiền sử rối loạn ăn uống. " : ""}Màn Dinh dưỡng hiển thị khẩu phần &amp; đĩa ăn cân bằng thay cho số calo.</small></span>
    <button type="button" class="hs-switch ${on ? "on" : ""}" id="hs-p-kcal" role="switch" aria-checked="${on}" aria-label="Ẩn số calo"><i></i></button></div>`;
}
/* --- Hồ sơ: thẻ "Sức khoẻ & an toàn" --- */
function profileCardHTML(){
  const h = H(), f = curFlags(), p = state.profile;
  if(!h.completedAt) return `
    <div class="card-title"><span class="material-symbols-rounded">health_and_safety</span>Sức khoẻ &amp; an toàn</div>
    <p class="small-note">Chưa sàng lọc. Mất khoảng 1 phút để TapEasy điều chỉnh calo, đạm và cảnh báo bài tập phù hợp với sức khoẻ của bạn.</p>
    <button class="btn btn-primary btn-block btn-sm" id="hs-p-start" style="margin-top:10px;"><span class="material-symbols-rounded">health_and_safety</span>Bắt đầu sàng lọc</button>
    <div class="hs-p-links"><button type="button" id="hs-p-disc">Miễn trừ trách nhiệm y tế</button><button type="button" id="hs-p-tips">Lưu ý an toàn chung</button></div>`;
  const chips = [];
  if(f.preg) chips.push(`Mang thai · tam cá nguyệt ${f.tri}${f.pregComp?" · có biến chứng":""}`);
  if(f.post) chips.push(`Sau sinh ${({lt6:"< 6 tuần","6to12":"6–12 tuần",gt12:"12 tuần – 6 tháng",gt26:"> 6 tháng"})[f.ppWeeks]||""}${h.cesarean?" · sinh mổ":""}`);
  if(f.bf) chips.push("Đang cho con bú");
  if(f.cardio !== "none") chips.push(({htn_ok:"Tăng huyết áp (đã kiểm soát)", htn_bad:"Huyết áp chưa kiểm soát", heart:"Bệnh tim"})[f.cardio]);
  if(f.diab !== "none") chips.push(({pre:"Tiền tiểu đường", type1:"Tiểu đường type 1", type2:"Tiểu đường type 2"})[f.diab] + (f.hypo && f.diab==="type2" ? " · nguy cơ hạ đường huyết" : ""));
  if(f.kidney !== "none") chips.push(f.kidney === "dialysis" ? "Đang lọc máu" : "Bệnh thận mạn");
  if(f.ed) chips.push("Tiền sử rối loạn ăn uống");
  if(f.injuries.length) chips.push("Chấn thương: " + f.injuries.map(k=>INJ[k].toLowerCase()).join(", "));
  if(f.minor) chips.push("Dưới 18 tuổi");
  if(f.symptom) chips.push("Đau ngực / choáng ngất");
  if(f.supervised) chips.push("Cần giám sát y tế");
  const adj = [];
  const a = p.hsAdjust;
  if(a && a.manual) adj.push(`<li class="warn">Bạn đang dùng mục tiêu dinh dưỡng tự chỉnh${a.warn.includes("kcal")?" thấp hơn mức duy trì":""}${a.warn.includes("protein")?" với lượng đạm vượt giới hạn cho bệnh thận":""} — không khuyến nghị. <button type="button" class="hs-link" id="hs-p-auto">Khôi phục theo công thức an toàn</button></li>`);
  else if(a){
    if(a.reasons.length) adj.push(hsHideK() ? `<li>Calo: <b>không thâm hụt</b> (${a.reasons.map(r=>REASON_LABEL[r]).join(", ")}).</li>`
      : `<li>Calo: <b>${(p.goalKcal||0).toLocaleString("vi-VN")} kcal</b> — không thâm hụt (${a.reasons.map(r=>REASON_LABEL[r]).join(", ")})${f.kcalExtra?`, đã cộng ${f.kcalExtra} kcal`:""}.</li>`);
    if(a.ppk != null) adj.push(`<li>Đạm: <b>${esc(p.protein)} g</b>/ngày (~${String(a.ppk).replace(".",",")} g/kg). <button type="button" class="hs-link" id="hs-p-why">Vì sao?</button></li>`);
  }
  if(f.hideVeryHigh) adj.push(`<li>Bài cường độ rất cao: <b>${f.hideNow ? "đang ẩn" : "đang hiện (bác sĩ đã cho phép " + fmtDate(h.clearedVigorous) + ")"}</b> <button type="button" class="hs-link" id="hs-p-clear">${f.hideNow ? "Bác sĩ đã cho phép" : "Ẩn lại"}</button></li>`);
  const stale = hsStale(h);
  return `
    <div class="card-title" style="justify-content:space-between;"><span style="display:flex;align-items:center;gap:8px;"><span class="material-symbols-rounded">health_and_safety</span>Sức khoẻ &amp; an toàn</span>
      <button class="icon-btn" id="hs-p-edit" aria-label="Sửa sàng lọc sức khoẻ" style="width:44px;height:44px;"><span class="material-symbols-rounded" style="font-size:18px;">edit</span></button></div>
    ${f.urgent ? `<div class="hs-banner hs-urgent"><span class="material-symbols-rounded">stethoscope</span><div><b>Nên đi khám trước khi tập.</b> Hãy mang kết quả sàng lọc này khi gặp bác sĩ.</div></div>` : ""}
    ${stale ? `<div class="hs-banner hs-warn"><span class="material-symbols-rounded">schedule</span><div>Sàng lọc đã cũ — hãy cập nhật để app điều chỉnh đúng tình trạng hiện tại.</div></div>` : ""}
    <div class="hs-chips">${chips.length ? chips.map(c=>`<span>${esc(c)}</span>`).join("") : `<span class="ok">Không có lưu ý đặc biệt</span>`}</div>
    ${adj.length ? `<ul class="hs-adj">${adj.join("")}</ul>` : ""}
    ${hsKcalSwitchHTML(f)}
    ${f.doctor.length ? `<p class="small-note hs-docline"><span class="material-symbols-rounded">stethoscope</span>Nên hỏi bác sĩ: ${f.doctor.map(k=>DOCTOR_LABEL[k]).join(" · ")}.</p>` : ""}
    <div class="hs-p-btns">
      <button class="btn btn-outline btn-sm" id="hs-p-tips"><span class="material-symbols-rounded">tips_and_updates</span>Lưu ý khi tập</button>
      <button class="btn btn-outline btn-sm" id="hs-p-edit2"><span class="material-symbols-rounded">edit</span>Cập nhật</button>
    </div>
    <div class="hs-p-links"><button type="button" id="hs-p-disc">Miễn trừ trách nhiệm y tế</button><button type="button" id="hs-p-del">Xoá dữ liệu sức khoẻ</button></div>
    <p class="small-note" style="margin-top:6px;">Cập nhật ${fmtDate(h.completedAt)} · chỉ lưu trên máy này.</p>`;
}
function renderProfileCard(){
  const acc = document.getElementById("profile-account-card"); if(!acc) return;
  let card = document.getElementById("hs-profile-card");
  if(!card){ card = document.createElement("div"); card.className = "card hs-card"; card.id = "hs-profile-card"; acc.parentNode.insertBefore(card, acc); }
  card.innerHTML = profileCardHTML();
  const on = (id, fn)=>{ const el = document.getElementById(id); if(el) el.addEventListener("click", fn); };
  on("hs-p-start", ()=> openScreening({ mode:"first" }));
  on("hs-p-edit", ()=> openScreening({ mode:"edit" }));
  on("hs-p-edit2", ()=> openScreening({ mode:"edit" }));
  on("hs-p-tips", openTipsSheet);
  on("hs-p-disc", openDisclaimer);
  on("hs-p-clear", ()=>{
    if(curFlags().hideNow) confirmClearance();
    else { H().clearedVigorous = null; saveState(); rerenderActive(); toast("Đã ẩn lại bài cường độ rất cao", "visibility_off"); }
  });
  on("hs-p-auto", ()=>{ state.profile.autoTargets = true; recomputeProfile(); saveState(); rerenderActive(); toast("Đã khôi phục mục tiêu theo công thức an toàn", "check_circle"); });
  on("hs-p-kcal", ()=>{ if(typeof nuSetHideKcal === "function"){ nuSetHideKcal(!hsHideK()); renderProfileCard(); } });
  on("hs-p-why", ()=>{ try{ NutriPro.ui.openProteinWhy(); }catch(e){} });
  on("hs-p-del", ()=> confirmDialog("Xoá dữ liệu sức khoẻ?", "Câu trả lời sàng lọc trên máy này sẽ bị xoá và các điều chỉnh an toàn sẽ tắt. Bạn có thể làm lại bất cứ lúc nào.", ()=>{
    state.health = { skippedAt: Date.now() };
    /* vòng 2: bộ nhớ thực đơn (localStorage riêng, khoá đã băm) được tính từ cờ sức khoẻ → xoá luôn */
    try{ if(typeof NutriPro !== "undefined" && NutriPro.clearPlanCache) NutriPro.clearPlanCache(); }catch(e){}
    recomputeProfile(); saveState(); closeSheet(); rerenderActive(); toast("Đã xoá dữ liệu sức khoẻ", "delete");
  }, "Xoá", "delete"));
}

/* --- Dinh dưỡng --- */
function decorateNutrition(){
  const el = document.getElementById("nu-content"); if(!el) return;
  const f = curFlags(), p = state.profile;
  if(!f.screened) return;
  // Không gợi ý chuyển sang "Giảm mỡ" khi không được thâm hụt
  if(f.noDeficit) $$('[data-switch-goal="lose"]', el).forEach(b=> b.remove());
  const a = p.hsAdjust;
  const lines = [];
  const hk = hsHideK();                        // vòng 2: đang ẩn số calo → lời giải thích không kèm con số kcal
  if(a && a.manual){
    lines.push(`Mục tiêu tự chỉnh của bạn ${a.warn.includes("kcal")?"<b>thấp hơn mức duy trì</b>":""}${a.warn.includes("kcal")&&a.warn.includes("protein")?" và ":""}${a.warn.includes("protein")?"có <b>lượng đạm vượt giới hạn</b> cho bệnh thận":""} — không khuyến nghị với tình trạng sức khoẻ bạn đã khai báo.`);
  } else if(a){
    const why = a.reasons.map(r=>REASON_LABEL[r]);
    if(f.preg) lines.push(hk ? `Đang mang thai (tam cá nguyệt ${f.tri}): app không đặt thâm hụt${f.kcalExtra ? " và đã cộng thêm năng lượng cho thai kỳ" : ""}. Tăng cân nên theo dõi cùng bác sĩ sản khoa.`
      : `Đang mang thai (tam cá nguyệt ${f.tri}): calo = mức duy trì${f.kcalExtra?` + ${f.kcalExtra} kcal`:""} = <b>${(p.goalKcal||0).toLocaleString("vi-VN")} kcal</b>. Tăng cân nên theo dõi cùng bác sĩ sản khoa.`);
    else if(f.bf) lines.push(hk ? "Đang cho con bú: app không đặt thâm hụt và đã cộng thêm năng lượng cho việc tạo sữa. Muốn giảm cân: đợi ≥ 6–8 tuần sau sinh khi sữa đã ổn định, giảm từ từ và hỏi bác sĩ."
      : `Đang cho con bú: calo = mức duy trì + ${f.kcalExtra} kcal = <b>${(p.goalKcal||0).toLocaleString("vi-VN")} kcal</b>. Muốn giảm cân: đợi ≥ 6–8 tuần sau sinh khi sữa đã ổn định, giảm ≤ 0,5 kg/tuần (thâm hụt ≤ 500 kcal/ngày) và hỏi bác sĩ.`);
    else if(why.length && !(why.length === 1 && f.minor && p.goalBlocked)) lines.push(`Không áp dụng thâm hụt calo vì ${why.join(", ")}.`);
    if(f.minor && a.eer) lines.push(`Dưới 18 tuổi: calo không thấp hơn nhu cầu cho tuổi đang lớn (EER, IOM 2005${hk ? "" : ` ≈ <b>${a.eer.toLocaleString("vi-VN")} kcal</b>`}); đạm ~${String(a.ppk).replace(".",",")} g/kg, không dùng bột đạm/whey khi chưa hỏi bác sĩ.`);
    if(a.ppk != null && f.kidney !== "none") lines.push(`Đạm giới hạn ~${String(a.ppk).replace(".",",")} g/kg (<b>${p.protein} g</b>/ngày) vì ${f.kidney==="dialysis"?"đang lọc máu":"bệnh thận mạn"} — lượng chính xác do bác sĩ thận quyết định.${f.proteinCap?" Thực đơn gợi ý giữ đạm <b>không vượt</b> mức này, phần năng lượng còn lại bù bằng tinh bột và chất béo tốt; không gợi ý bột đạm/whey.":""}`);
  }
  if(f.kidney !== "none") lines.push(`Thực đơn gợi ý <b>chưa tính</b> kali, phốt pho, natri, nước. ${f.kidney==="dialysis"?"Không theo mục tiêu nước của app nếu bác sĩ dặn hạn chế nước.":""}`);
  if(f.diab !== "none" && f.diab !== "pre") lines.push("Thực đơn chưa thiết kế riêng cho tiểu đường — chia đều tinh bột trong ngày, ưu tiên ngũ cốc nguyên hạt, hỏi bác sĩ về lượng tinh bột mỗi bữa.");
  if(f.preg) lines.push(`Tránh đồ sống / tái (bò tái, gỏi cá, sushi, trứng lòng đào), pate, phô mai mềm / sữa chưa tiệt trùng, rượu bia; caffeine ≤ 200 mg/ngày.${f.waterExtra ? " Mục tiêu nước đã cộng thêm 0,3 L." : ""} Thực đơn gợi ý đã bỏ các món tái.`);
  if(f.bf && !f.preg) lines.push("Mục tiêu nước đã cộng thêm ~0,7 L/ngày cho việc tạo sữa.");
  if(f.ed) lines.push(hk ? "Số calo đang được ẩn — màn này hiển thị khẩu phần và đĩa ăn cân bằng. Nếu việc ghi chép ăn uống khiến bạn căng thẳng, hãy tạm dừng và trao đổi với bác sĩ / chuyên gia tâm lý."
    : "Nếu việc ghi chép calo khiến bạn căng thẳng, hãy tạm dừng và trao đổi với bác sĩ / chuyên gia tâm lý. Bạn có thể bật <b>Ẩn số calo</b> (biểu tượng con mắt trên đồng hồ calo).");
  if(!lines.length) return;
  if(el.querySelector(".hs-nutri")) return;
  el.insertAdjacentHTML("afterbegin", `<div class="hs-nutri ${a&&a.manual?"warn":""}">
    <div class="hs-nutri-h"><span class="material-symbols-rounded">health_and_safety</span><b>Điều chỉnh theo sức khoẻ của bạn</b></div>
    <ul>${lines.map(l=>`<li>${l}</li>`).join("")}</ul>
    <div class="hs-nutri-f"><span>Hỏi bác sĩ / chuyên gia dinh dưỡng trước khi thay đổi chế độ ăn.</span>${a&&a.manual?`<button type="button" class="btn btn-primary btn-sm" id="hs-nu-auto">Dùng mức an toàn</button>`:`<button type="button" class="hs-link" id="hs-nu-more">Chi tiết</button>`}</div>
  </div>`);
  const m = document.getElementById("hs-nu-more"); if(m) m.addEventListener("click", openTipsSheet);
  const au = document.getElementById("hs-nu-auto"); if(au) au.addEventListener("click", ()=>{ p.autoTargets = true; recomputeProfile(); saveState(); rerenderActive(); toast("Đã chuyển về mục tiêu theo công thức an toàn", "check_circle"); });
}

/* --- Trang chủ --- */
/* Vòng 2 — "Ẩn số calo" trên Trang chủ: integrator đã chuyển về chỗ gốc (pt.js ô "Bữa đã ghi n/4" theo fkHideKcal(),
   ui-signature.js bỏ thẻ "kcal đã nạp") → bản tạm hsHomeKcal đã gỡ. */
function decorateHome(){
  const el = document.getElementById("home-content"); if(!el || el.querySelector(".hs-home")) return;
  const h = H(), f = curFlags();
  let html = "";
  if(f.urgent) html = `<button type="button" class="hs-home urgent" data-hs="tips"><span class="material-symbols-rounded">stethoscope</span><span><b>Nên đi khám trước khi tập</b><small>Theo sàng lọc sức khoẻ của bạn. Chạm để xem lưu ý.</small></span><span class="material-symbols-rounded">chevron_right</span></button>`;
  else if(!h.completedAt && !(h.homeHideUntil && Date.now() < h.homeHideUntil)) html = `<div class="hs-home"><button type="button" class="hs-home-main" data-hs="start"><span class="material-symbols-rounded">health_and_safety</span><span><b>Sàng lọc sức khoẻ (1 phút)</b><small>Để TapEasy điều chỉnh tập &amp; ăn an toàn cho bạn.</small></span></button><button type="button" class="hs-home-x" data-hs="hide" aria-label="Ẩn 7 ngày"><span class="material-symbols-rounded">close</span></button></div>`;
  else if(hsStale(h)) html = `<button type="button" class="hs-home" data-hs="edit"><span class="material-symbols-rounded">schedule</span><span><b>Cập nhật sàng lọc sức khoẻ</b><small>Tình trạng của bạn có thể đã thay đổi.</small></span><span class="material-symbols-rounded">chevron_right</span></button>`;
  if(!html) return;
  const first = el.firstElementChild;
  if(first) first.insertAdjacentHTML("afterend", html); else el.insertAdjacentHTML("afterbegin", html);
  $$("[data-hs]", el).forEach(b=> b.addEventListener("click", e=>{
    e.stopPropagation();
    const k = b.dataset.hs;
    if(k === "tips") openTipsSheet();
    else if(k === "start") openScreening({ mode:"first" });
    else if(k === "edit") openScreening({ mode:"edit" });
    else if(k === "hide"){ H().homeHideUntil = Date.now() + 7*DAY_MS; saveState(); const box = el.querySelector(".hs-home"); if(box) box.remove(); }
  }));
}

/* --- Chi tiết bài & màn đang tập: ghi chú an toàn --- */
function decorateExerciseSheet(item, intensity){
  const f = curFlags(); if(!f.screened || !item) return;
  const notes = hsNotesFor(hsItemTags(item, intensity), f);
  if(!notes.length) return;
  const sheet = document.getElementById("sheet-content"); if(!sheet || sheet.querySelector(".hs-notebox")) return;
  const h3 = sheet.querySelector("h3");
  if(h3) h3.insertAdjacentHTML("afterend", noteBoxHTML(notes)); else sheet.insertAdjacentHTML("beforeend", noteBoxHTML(notes));
}

function rerenderActive(){
  try{
    const cur = (document.querySelector(".screen.active")||{}).id || "";
    if(cur === "screen-profile") renderProfileScreen();
    else if(cur === "screen-nutrition") renderNutritionScreen();
    else if(cur === "screen-workout") renderWorkoutScreen();
    else if(cur === "screen-home" && typeof renderHomeScreen === "function") renderHomeScreen();
    else if(cur === "screen-plans" && typeof renderPlansScreen === "function") renderPlansScreen();
    if(cur !== "screen-profile") renderProfileCard();      // goto("profile") không render lại Hồ sơ → luôn giữ thẻ mới nhất
  }catch(e){ console.warn("[health-safety] rerender", e); }
}

/* =====================================================================
   10. GHI ĐÈ HÀM TOÀN CỤC (mỗi lớp bọc try/catch — lỗi không làm hỏng app)
   ===================================================================== */
/* Bảng getter/setter cho hàm toàn cục ở script khác (không dùng eval; hàm chưa tồn tại → bỏ qua) */
const G = {
  recomputeProfile:      [()=> recomputeProfile,      f=>{ recomputeProfile = f; }],
  renderProfileScreen:   [()=> renderProfileScreen,   f=>{ renderProfileScreen = f; }],
  renderNutritionScreen: [()=> renderNutritionScreen, f=>{ renderNutritionScreen = f; }],
  renderWorkoutScreen:   [()=> renderWorkoutScreen,   f=>{ renderWorkoutScreen = f; }],
  renderHomeScreen:      [()=> renderHomeScreen,      f=>{ renderHomeScreen = f; }],
  renderPlansScreen:     [()=> renderPlansScreen,     f=>{ renderPlansScreen = f; }],
  renderSessionStep:     [()=> renderSessionStep,     f=>{ renderSessionStep = f; }],
  openExerciseDetail:    [()=> openExerciseDetail,    f=>{ openExerciseDetail = f; }],
  openTemplateBrowser:   [()=> openTemplateBrowser,   f=>{ openTemplateBrowser = f; }],
  openTemplateDetail:    [()=> openTemplateDetail,    f=>{ openTemplateDetail = f; }],
  openPrivacySheet:      [()=> openPrivacySheet,      f=>{ openPrivacySheet = f; }],
  finishBoot:            [()=> finishBoot,            f=>{ finishBoot = f; }],
};
function wrapAfter(name, after){
  let old = null;
  try{ old = G[name][0](); }catch(e){ return; }            // chưa được khai báo (module khác chưa nạp)
  if(typeof old !== "function") return;
  try{
    G[name][1](function(){
      const r = old.apply(this, arguments);
      try{ after.apply(this, arguments); }catch(e){ console.warn("[health-safety] " + name, e); }
      return r;
    });
  }catch(e){ console.warn("[health-safety] wrap " + name, e); }
}

wrapAfter("recomputeProfile", ()=> hsApplyNutrition(state.profile, H()));
wrapAfter("renderProfileScreen", renderProfileCard);
wrapAfter("renderNutritionScreen", decorateNutrition);
wrapAfter("renderWorkoutScreen", decorateWorkout);
wrapAfter("renderHomeScreen", decorateHome);
wrapAfter("renderPlansScreen", decoratePlans);
wrapAfter("openTemplateBrowser", decorateTemplateList);
wrapAfter("openTemplateDetail", decorateTemplateDetail);
wrapAfter("renderSessionStep", ()=>{
  if(typeof session === "undefined" || !session || session.idx >= session.items.length) return;
  const day = getActivePlan().days[session.dayKey] || {};
  decorateExerciseSheet(session.items[session.idx], day.intensity);
});
wrapAfter("openExerciseDetail", itemUid=>{
  const day = getActivePlan().days[state.selectedDay]; if(!day) return;
  decorateExerciseSheet(day.items.find(it=> it.uid === itemUid), day.intensity);
});
wrapAfter("openPrivacySheet", ()=>{
  const box = document.querySelector("#sheet-content .policy-text"); if(!box || box.querySelector(".hs-pp")) return;
  box.insertAdjacentHTML("beforeend", `<p class="hs-pp"><b>Sàng lọc sức khoẻ:</b> câu trả lời (thai kỳ, tim mạch, tiểu đường, thận, chấn thương…) chỉ lưu trên máy bạn để điều chỉnh khuyến nghị, không gửi lên máy chủ. Xoá trong Hồ sơ → Sức khoẻ &amp; an toàn.</p>
    <p class="hs-pp"><button type="button" class="hs-link" id="hs-pp-full">Đọc chính sách bảo mật đầy đủ</button> · <button type="button" class="hs-link" id="hs-pp-disc">Miễn trừ trách nhiệm y tế</button></p>`);
  const full = document.getElementById("hs-pp-full");
  if(full) full.addEventListener("click", ()=> openExternal(PRIVACY_URL));
  const disc = document.getElementById("hs-pp-disc");
  if(disc) disc.addEventListener("click", openDisclaimer);
});
/* Sau khi vào app (đăng nhập xong / mở app): hỏi sàng lọc nếu chưa làm */
wrapAfter("finishBoot", ()=> setTimeout(maybePrompt, 700));

/* Onboarding lần đầu: chèn bước sàng lọc TRƯỚC khi hoàn tất (để recomputeProfile dùng ngay cờ sức khoẻ) */
try{
  const _finishOnboarding = finishOnboarding;
  finishOnboarding = function(){
    const self = this, args = arguments;
    const h = H();
    if(h.completedAt || h.skippedAt || isOpen()) return _finishOnboarding.apply(self, args);
    openScreening({ mode:"first", onDone: ()=> _finishOnboarding.apply(self, args) });
  };
}catch(e){ console.warn("[health-safety] finishOnboarding", e); }

/* Bắt đầu buổi tập: khoá buổi "Rất cao", bỏ bài rất cao, nhắc kiểm tra trước buổi */
try{
  const _startSession = startSession;
  startSession = function(dayKey){
    const self = this, args = arguments;
    try{
      if(typeof session !== "undefined" && session && session.dayKey === dayKey && session.paused) return _startSession.apply(self, args);
      const f = curFlags();
      const day = getActivePlan().days[dayKey];
      if(!f.screened || !day) return _startSession.apply(self, args);
      if(f.hideNow && day.intensity === "Rất cao"){ openLockSheet(); return; }
      const go = ()=>{
        if(f.hideNow){
          const keep = day.items.filter(it=> !hsItemTags(it, day.intensity).veryHigh);
          const removed = day.items.length - keep.length;
          if(removed && !keep.length){ openLockSheet(); return; }
          if(removed){
            const orig = day.items; day.items = keep;
            try{ _startSession.apply(self, args); } finally { day.items = orig; }
            toast(`Đã bỏ qua ${removed} bài cường độ rất cao theo sàng lọc sức khoẻ`, "visibility_off");
            return;
          }
        }
        _startSession.apply(self, args);
      };
      if(f.preCheck && H().lastPreCheck !== todayStr()){ openPreSession(go); return; }
      go();
    }catch(e){ console.warn("[health-safety] startSession", e); return _startSession.apply(self, args); }
  };
}catch(e){ console.warn("[health-safety] startSession wrap", e); }

/* Nút Back Android: lùi bước sàng lọc */
try{
  const _back = fkHandleBack;
  fkHandleBack = function(){
    if(isOpen()){
      if(document.getElementById("sheet-backdrop").classList.contains("open")) return _back.apply(this, arguments);
      if(step > (mode === "edit" ? 1 : 0)) go(step-1); else skip();
      return true;
    }
    return _back.apply(this, arguments);
  };
}catch(e){}

function maybePrompt(){
  try{
    const h = H();
    if(!state.onboarded || h.completedAt || h.skippedAt || isOpen()) return;
    const auth = document.getElementById("auth"), ob = document.getElementById("onboarding");
    if((auth && auth.classList.contains("open")) || (ob && ob.classList.contains("open"))) return;
    openScreening({ mode:"first" });
  }catch(e){}
}

/* =====================================================================
   11. KHỞI ĐỘNG MODULE
   ===================================================================== */
H();
if(state.onboarded){
  try{ recomputeProfile(); saveState(); }catch(e){}
  rerenderActive();
  setTimeout(maybePrompt, 900);
} else {
  try{ renderProfileCard(); }catch(e){}
}

/* API cho module khác + kiểm thử: window.FKHealth đã gán SỚM ở mục 6b. Khởi động xong → báo cho các module khác. */
window.openHealthSafety = ()=> openScreening({ mode: H().completedAt ? "edit" : "first" });
FKH.ready = true;
try{
  const ev = typeof Event === "function" ? new Event("fk:health-ready") : null;
  if(ev && document && typeof document.dispatchEvent === "function") document.dispatchEvent(ev);
}catch(e){ console.warn("[health-safety] fk:health-ready", e); }

}catch(err){ console.error("[health-safety] không khởi động được:", err); }
})();

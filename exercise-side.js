/* =========================================================================
   TapEasy — KIỂU TẬP HAI BÊN / TỪNG BÊN (exercise-side.js) · 22/11/2026
   Anh Thắng: "Check list lại hết các bài tập, có những bài có 2 option: tập cả 2 tay hoặc từng tay; chân cũng vậy."
   Mỗi bài thuộc 1 trong 3 nhóm:
     "uni"    luôn từng bên (một tay / một chân, Bulgarian, lunge, step-up, pistol, concentration curl…) → mặc định ghi T/P
     "either" làm được cả hai kiểu (phần lớn bài tạ đơn, cáp tay nắm đơn, máy đùi trước/sau, leg press, máy iso-lateral,
              nhón bắp chân, hip thrust / glute bridge, RDL tạ đơn…) → màn tập có bộ chọn "Hai tay | Từng tay"
     "bi"     chỉ hai bên (squat / bench / deadlift thanh đòn, kéo xà, xà kép, plank, máy thanh liền…) → không có bộ chọn
   Nguồn: bảng theo id (bài lõi EXERCISES + vài bài thư viện 800+ cần chỉnh tay) → luật theo dụng cụ + mẫu chuyển động + từ khoá
   (dùng cho bài thư viện và bài tự tạo). Danh sách đầy đủ + lý do: E:\khovideogym\clips\_side_audit\side.csv (scripts/side-audit.js).
   Nạp TRƯỚC app.js (index.html). Không phụ thuộc DOM. API toàn cục:
     fkExerciseSide(meta, item?) → "uni" | "either" | "bi"     fkExerciseSideWhy(meta, item?) → { side, why, src }
     fkSideKindOf(meta) → "leg" | "arm"                       fkLogMode(rec) → "uni" | "both" | null (dữ liệu cũ không rõ)
     fkLastForMode(rec, mode, cls) → { last, cross }           (setLog[key] — "lần trước" CÙNG kiểu tập; cross = lần gần nhất khác kiểu)
     fkStashLogMode(prev, next) → next có .other = bản ghi gần nhất của kiểu còn lại (giữ khi đổi kiểu tập)
   ========================================================================= */
(function(G){
"use strict";

/* ---------- 1. BẢNG THEO ID — bài lõi (EXERCISES: data.js + templates.js), duyệt tay từng bài ---------- */
const CORE = {
  benchpress:"bi", inclinedb:"either", pushup:"bi", cablefly:"either", pullup:"bi", bentoverrow:"bi", latpulldown:"bi", deadlift:"bi",
  overheadpress:"bi", lateralraise:"either", facepull:"bi", squat:"bi", legpress:"either", lunges:"uni", legcurl:"either", calfraise:"either",
  bicepcurl:"either", hammercurl:"either", tricepdip:"bi", tricepsdown:"bi", plank:"bi", hangingleg:"bi", russiantwist:"bi", crunch:"bi",
  running:"bi", jumprope:"bi", rowing:"bi", burpee:"bi", hipthrust:"either", glutebridge:"either", rdl:"either", gobletsquat:"bi",
  stepup:"uni", legext:"either", cablerow:"bi", dbrow:"uni", dbpress:"either", dbbench:"either", machinepress:"either", kickback:"uni",
  abduction:"bi", bwsquat:"bi", inclinepushup:"bi", invertedrow:"bi", deadbug:"bi", sideplank:"bi", mountainclimber:"bi", walking:"bi",
  kbswing:"bi", woodchop:"bi", skullcrusher:"either", frontsquat:"bi", pullover:"bi", stretch:"bi", bulgarian:"uni", hacksquat:"bi",
  smithsquat:"bi", csrow:"either", cablelateral:"either", ohtriext:"either", preacher:"either", sledpush:"bi", wallball:"bi",
  farmercarry:"bi", inclinewalk:"bi", zone2:"bi", intervalwalk:"bi", pecdeck:"bi",
};
const CORE_WHY = {
  hipthrust:"đẩy hông hai chân hoặc một chân (single-leg hip thrust)", glutebridge:"cầu mông hai chân hoặc một chân",
  rdl:"RDL hai chân, hoặc một chân với tạ đơn", machinepress:"nhiều máy tay đòn độc lập (iso-lateral) — đẩy từng tay được",
  skullcrusher:"bản tạ đơn làm được từng tay", preacher:"bản tạ đơn làm được từng tay", ohtriext:"dây thừng hai tay hoặc tay nắm đơn từng tay",
  cablerow:"tay nắm chữ V liền — hai tay", tricepsdown:"thanh / dây thừng — hai tay", pecdeck:"máy ép ngực hai tay liền",
  woodchop:"xoay từng bên trong cùng hiệp — ghi gộp", russiantwist:"xoay hai bên trong cùng hiệp — ghi gộp", sideplank:"giữ theo thời gian",
  kickback:"đá mông luôn từng chân", dbrow:"tên bài: một tay", farmercarry:"xách hai tay, tính theo quãng/thời gian",
};
/* ---------- bài thư viện 800+ (free-exercise-db) mà luật đoán chưa đúng — chỉnh tay sau khi rà side.csv ---------- */
const X = {
  "Dumbbell_Shrug":"bi", "Smith_Machine_Hip_Raise":"either", "Butt_Lift_Bridge":"either", "Barbell_Glute_Bridge":"either", "Barbell_Hip_Thrust":"either",
  "Seated_Calf_Raise":"either", "Standing_Calf_Raises":"either", "Calf_Press_On_The_Leg_Press_Machine":"either", "Calf_Press":"either",
  "Machine_Bench_Press":"either", "Machine_Shoulder_Military_Press":"either", "Leverage_Chest_Press":"either", "Leverage_Incline_Chest_Press":"either",
  "Leverage_Decline_Chest_Press":"either", "Leverage_Shoulder_Press":"either", "Leverage_High_Row":"either", "Leverage_Iso_Row":"either",
  "Leverage_Deadlift":"bi", "Leverage_Shrug":"bi", "Cable_Chest_Press":"either", "Cable_Shoulder_Press":"either", "Incline_Cable_Chest_Press":"either",
  "Cable_Crossover":"either", "Low_Cable_Crossover":"either", "Flat_Bench_Cable_Flyes":"either", "Butterfly":"bi",
  "Pull_Through":"bi", "Cable_Deadlifts":"bi", "Standing_Leg_Curl":"uni", "Thigh_Abductor":"bi", "Thigh_Adductor":"bi",
  "Side_Leg_Raises":"uni", "Goblet_Squat":"bi", "Dumbbell_Squat":"bi", "Bent_Over_Two-Dumbbell_Row":"either", "Dumbbell_Lying_Pronation":"uni", "Dumbbell_Lying_Supination":"uni",
  "Kettlebell_Windmill":"uni", "Kettlebell_Turkish_Get-Up_Lunge_style":"uni", "Kettlebell_Turkish_Get-Up_Squat_style":"uni",
  "Kettlebell_Pistol_Squat":"uni", "Kettlebell_Figure_8":"bi", "Kettlebell_Sumo_High_Pull":"bi", "Double_Kettlebell_Alternating_Hang_Clean":"either",
  "Cable_Internal_Rotation":"uni", "Cable_External_Rotation":"uni", "Cable_Hip_Adduction":"uni", "Cable_Iron_Cross":"bi",
  "Rocking_Standing_Calf_Raise":"either", "Standing_Dumbbell_Calf_Raise":"either", "Smith_Machine_Calf_Raise":"either",
  "Standing_Barbell_Calf_Raise":"bi", "Stiff-Legged_Dumbbell_Deadlift":"either", "Hyperextensions_Back_Extensions":"bi",
  "Split_Clean":"bi", "Split_Jerk":"bi", "Split_Snatch":"bi", "Scissor_Kick":"bi", "Calf-Machine_Shoulder_Shrug":"bi", "Lying_T-Bar_Row":"bi",
  "Prone_Manual_Hamstring":"bi", "Seated_Leg_Tucks":"bi", "Kettlebell_Halo":"bi", "Low_Pulley_Row_To_Neck":"bi", "Bent_Press":"uni", "London_Bridges":"bi",
  "Cross_Body_Hammer_Curl":"either", "Alternating_Deltoid_Raise":"either", "Zottman_Curl":"either", "Zottman_Preacher_Curl":"either",
  "Seated_Side_Lateral_Raise":"either", "Side_Laterals_to_Front_Raise":"either", "Lying_Rear_Delt_Raise":"either", "Seated_Bent-Over_Rear_Delt_Raise":"either",
  "Reverse_Flyes_With_External_Rotation":"either", "External_Rotation":"uni", "External_Rotation_with_Cable":"uni", "Cuban_Press":"either", "Tate_Press":"either",
  "Dumbbell_Side_Bend":"uni", "Standing_Dumbbell_Straight-Arm_Front_Delt_Raise_Above_Head":"either", "Incline_Hammer_Curls":"either", "Incline_Inner_Biceps_Curl":"either",
  "Standing_Inner-Biceps_Curl":"either", "Alternate_Hammer_Curl":"either",
  "Seated_Leg_Curl":"either", "Lying_Leg_Curls":"either", "Leg_Extensions":"either", "Leg_Press":"either", "Narrow_Stance_Leg_Press":"either",
};

/* ---------- 2. LUẬT (bài thư viện / bài tự tạo) ---------- */
const fold = s=> String(s == null ? "" : s).toLowerCase().replace(/[_]+/g, " ").replace(/\s+/g, " ");
const RE = {
  stretch: /stretch|giãn|\bsmr\b|foam roll|lăn giãn|massage|\byoga\b|\bpose\b|tư thế (em bé|rắn)|mobility|circles?\b|xoay khớp|\bwrist roll|rotations? with|lying (?:face down|prone) .*stretch/,
  rotate: /side plank|plank nghiêng|russian twist|woodchop|wood chop|chặt gỗ|\bwindmills?\b(?!.*kettlebell)|oblique twist|xoay người/,
  uni: /\b(one|single)[\s-]?(arm|leg|hand|legged|armed)|\bunilateral\b|một tay|một chân|(^|\s)1 (tay|chân)(\s|$)|bulgarian|split squat|tách chân|\blunges?\b|chùng chân|step[\s-]?ups?\b|bước bục|pistol|concentration curl|cuốn tạ tập trung|suitcase|từng tay|từng chân|mỗi tay|mỗi chân|glute kickback|kickback.*(glute|mông)|đá mông|đá chân sau|donkey kick|cossack|turkish get|side[\s-]?lying|kneeling single|scissors? kick|crossover reverse lunge|skater/,
  alt: /\balternat(e|ing)\b|luân phiên/,
  cardio: /\brun(ning)?\b|sprint|jog|\bwalk(ing)?\b(?!.*lunge)|đi bộ|chạy|cardio|zone 2|nhảy dây|jump rope|rope jumping|\browing\b|máy chèo|bicycl|cycling|\bbike\b|xe đạp|elliptical|stair|burpee|mountain climber|leo núi|sled|xe trượt|jumping jack|\bhops?\b|\bbound(s|ing)?\b|skipping|trail running|treadmill|recumbent|hiit|interval/,
  core: /\bplank\b|crunch|sit[\s-]?ups?|gập bụng|leg raise|nâng chân|knee raise|ab roller|rollout|lăn bụng|dead bug|bọ chết|hollow|v[\s-]?ups?\b|toe touch|flutter|heel touch|bicycle|air bike|cocoons?|jackknife|bird dog|superman/,
  shrug: /shrug|nhún vai/,
  biOnly: /squat(?!.*(split|bulgarian|pistol|one|single))|gánh tạ|goblet|deadlift(?!.*(stiff|romanian|single|one))|sumo|\bswing\b|vung tạ|carry|farmer|xách tạ|pullover|thruster|good morning|clean and (press|jerk)|push press|wall ball|ném bóng|\bjerk\b|two[\s-]?arm|hai tay|both arms|dips?\b|xà kép|nhún xà|pull[\s-]?ups?|chin[\s-]?ups?|kéo xà|muscle up|push[\s-]?ups?|chống đẩy|inverted row|kéo người|hyperextension|ưỡn lưng|back extension|nordic|glute ham|reverse hyper|pulldown|kéo xô|face pull|kéo cáp mặt|pushdown|ép tay sau cáp|ép cáp xuống|straight[\s-]?arm|pull through|abduct|adduct|mở hông|dạng đùi|khép đùi|pec deck|butterfly|hack squat|preacher.*(machine|máy)|upright row|kéo tạ thẳng đứng/,
  hip: /hip thrust|đẩy hông|glute bridge|cầu mông|hip raise|nâng hông|butt lift|bridge/,
  calf: /calf|bắp chân|nhón/,
  legMachine: /leg (extension|curl)|leg press|đạp đùi|đẩy chân|duỗi chân|duỗi đùi|cuốn đùi|cuốn gân kheo|gân kheo|hamstring curl/,
  isoMachine: /leverage|iso[\s-]?lateral|hammer strength|\blever\b|plate[\s-]?loaded/,
  machPressRow: /chest press|bench press|đẩy ngực|shoulder press|military press|đẩy vai|\brows?\b|kéo .*máy|chèo/,
  dbMove: /curl|cuốn|press|đẩy|raise|nâng|dang|fly|flye|ép|\brows?\b|kéo|kickback|đá tay sau|extension|duỗi|snatch|clean|giật|cử|rdl|romanian|stiff[\s-]?leg|chân thẳng|deadlift|tate|zottman|arnold|y[\s-]?raise|t[\s-]?raise|rear delt|vai sau|pronation|supination|wrist curl|cẳng tay/,
  cableHandle: /lateral raise|dang vai|side raise|front raise|crossover|fly|flye|ép ngực|chest press|shoulder press|đẩy vai|kickback|rear delt|reverse fly|vai sau|incline.*press|y[\s-]?raise|deltoid raise/,
};
function equipKind(eq, txt){
  const e = fold(eq) + " " + fold(txt);
  if(/thanh đòn|tạ đòn|đòn ez|\bez\b|e-z|barbell|\bbb\b|trap bar|đòn lục giác|smith|multipress|curl bar/.test(e) && !/tạ đơn|dumbbell|kettlebell|tạ ấm/.test(fold(eq))) return "bar";
  if(/tạ đơn|dumbbell|\bdb\b|tạ ấm|kettlebell/.test(e)) return "db";
  if(/cáp|cable|pulley|ròng rọc|dây kháng|bands?\b/.test(e)) return "cable";
  if(/máy(?!\s*(chạy|chèo))|machine|leverage|lever\b/.test(e)) return "machine";
  if(/thanh đòn|tạ đòn|barbell|smith|ez/.test(e)) return "bar";
  if(!fold(eq).trim() || /trọng lượng cơ thể|bodyweight|body only|không dụng cụ|^không$|thảm|xà|ghế|bàn|—|^-$/.test(fold(eq))) return "bw";
  return "other";
}
/** Phân loại theo luật: { side, why } */
function rule(text, eq){
  const s = fold(text), k = equipKind(eq, text);
  if(RE.stretch.test(s)) return { side:"bi", why:"giãn cơ / linh hoạt — không ghi kg từng bên" };
  if(RE.rotate.test(s)) return { side:"bi", why:"xoay / giữ hai bên trong cùng hiệp — ghi gộp" };
  if(RE.uni.test(s)) return { side:"uni", why:"tên bài: một tay / một chân / chùng chân / bước bục…" };
  if(RE.cardio.test(s)) return { side:"bi", why:"cardio / bật nhảy — không ghi kg từng bên" };
  if(RE.core.test(s)) return { side:"bi", why:"bài bụng / core — hai bên" };
  if(RE.shrug.test(s)) return { side:"bi", why:"nhún vai — luôn hai bên cùng lúc" };
  if(RE.hip.test(s)) return { side:"either", why:"đẩy hông / cầu mông: hai chân hoặc một chân" };
  if(RE.calf.test(s)) return { side:"either", why:"nhón bắp chân: hai chân hoặc một chân" };
  if(RE.alt.test(s) && (k === "db" || k === "cable")) return { side:"either", why:"luân phiên hai tay — ghi gộp hoặc ghi riêng T/P" };
  if(RE.legMachine.test(s)) return { side:"either", why:"máy đùi trước / đùi sau / đạp đùi: hai chân hoặc từng chân" };
  if(k === "bar") return { side:"bi", why:"thanh đòn / Smith — hai tay cầm một thanh" };
  if(RE.biOnly.test(s)) return { side:"bi", why:"mẫu chuyển động hai bên (squat, kéo xà, xà kép, máy thanh liền…)" };
  if(k === "db"){
    if(RE.dbMove.test(s)) return { side:"either", why:"tạ đơn: hai tay cùng lúc hoặc từng tay" };
    return { side:"bi", why:"tạ đơn — mẫu chuyển động hai bên" };
  }
  if(k === "cable"){
    if(/\brope\b|dây thừng|v[\s-]?bar|thanh chữ v/.test(s)) return { side:"bi", why:"cáp với dây thừng / thanh — hai tay" };
    if(RE.cableHandle.test(s)) return { side:"either", why:"cáp tay nắm đơn: hai tay hoặc từng tay" };
    return { side:"bi", why:"cáp với thanh / dây thừng — hai tay" };
  }
  if(k === "machine"){
    if(RE.isoMachine.test(s) && RE.machPressRow.test(s)) return { side:"either", why:"máy tay đòn độc lập (iso-lateral): hai tay hoặc từng tay" };
    if(RE.machPressRow.test(s)) return { side:"either", why:"máy đẩy / kéo — nhiều máy tay đòn độc lập, đẩy từng tay được" };
    return { side:"bi", why:"máy thanh liền — hai bên" };
  }
  return { side:"bi", why:"mặc định hai bên (trọng lượng cơ thể / không rõ dụng cụ)" };
}

const _cache = new Map();
function idsOf(meta, item){
  const id = (item && item.exerciseId) || (meta && (meta.exerciseId || meta.id)) || "";
  const x = (item && item.custom && item.custom.exDbId) || (meta && meta.exDbId) || "";
  return { id: String(id || ""), x: String(x || "") };
}
/** { side, why, src: "core" | "override" | "rule" } */
function fkExerciseSideWhy(meta, item){
  meta = meta || {};
  const { id, x } = idsOf(meta, item);
  if(id && CORE[id]) return { side: CORE[id], why: CORE_WHY[id] || rule(String(meta.name || "") + " " + id, meta.equipment).why, src:"core" };
  if(x && X[x]) return { side: X[x], why: "chỉnh tay khi rà: " + ({ uni:"luôn tập từng bên", either:"làm được hai bên hoặc từng bên", bi:"chỉ tập hai bên" })[X[x]], src:"override" };
  const ck = id + "|" + x + "|" + (meta.name || "") + "|" + (meta.nameEn || "") + "|" + (meta.equipment || "");
  if(_cache.has(ck)) return _cache.get(ck);
  const txt = [meta.name, meta.nameEn, x.replace(/[_-]+/g, " ")].filter(Boolean).join(" ");
  const r = Object.assign({ src:"rule" }, rule(txt, meta.equipment));
  if(_cache.size > 500) _cache.clear();
  _cache.set(ck, r);
  return r;
}
function fkExerciseSide(meta, item){ try{ return fkExerciseSideWhy(meta, item).side; }catch(e){ return "bi"; } }

/** Nhãn tay / chân cho bộ chọn và ô T/P */
const LEG = /leg press|leg curl|leg extension|đạp đùi|đẩy chân|duỗi chân|duỗi đùi|cuốn gân kheo|cuốn đùi|gân kheo|calf|bắp chân|hip thrust|đẩy hông|glute|mông|lunge|squat|step[\s-]?up|pistol|bulgarian|chùng|bục|abduct|adduct|romanian|\brdl\b|chân thẳng|stiff[\s-]?leg|cossack|một chân|single[\s-]?leg|one[\s-]?leg|đùi/;
function fkSideKindOf(meta){
  const n = fold(meta && meta.name), m = fold(meta && meta.muscle);
  if(/một tay|single[\s-]?arm|one[\s-]?arm|\bcurl\b(?!.*(leg|đùi|gân))|cuốn tay|tay trước|tay sau|đẩy vai|đẩy ngực|dang vai|\bvai\b/.test(n) && !/leg curl|cuốn đùi|gân kheo/.test(n)) return "arm";
  if(LEG.test(n)) return "leg";
  if(/chân|mông|đùi|\bleg\b|calf|glute/.test(m) && !/tay|arm\b|vai|ngực|lưng/.test(n)) return "leg";
  return "arm";
}

/* ---------- 3. DỮ LIỆU: kiểu tập của bản ghi + "lần trước" cùng kiểu ---------- */
/** Kiểu tập của 1 bản ghi setLog / setHist: mode lưu sẵn → theo đó; có L/R → "uni"; còn lại null (dữ liệu cũ, không rõ) */
function fkLogMode(rec){
  if(!rec || typeof rec !== "object") return null;
  if(rec.mode === "uni" || rec.mode === "both") return rec.mode;
  const sets = Array.isArray(rec.sets) ? rec.sets : [];
  if(sets.some(x=> x && x.L && x.R && typeof x.L === "object" && typeof x.R === "object")) return "uni";
  return null;
}
/** Bản ghi rec có dùng được làm "lần trước" cho kiểu `mode` không. Dữ liệu cũ không rõ kiểu: bài "uni" → dùng được cho mọi kiểu
    (ghi trước khi có tính năng T/P — vẫn là cùng bài), bài khác → coi là "hai bên". */
function sameMode(rec, mode, cls){
  const m = fkLogMode(rec);
  if(m) return m === mode;
  return cls === "uni" ? true : mode === "both";
}
/** setLog[key] → { last: lần gần nhất CÙNG kiểu (null nếu chưa có), cross: lần gần nhất KHÁC kiểu (khi không có cùng kiểu) } */
function fkLastForMode(rec, mode, cls){
  if(!rec || typeof rec !== "object") return { last:null, cross:null };
  mode = mode === "uni" ? "uni" : "both";
  if(sameMode(rec, mode, cls)) return { last: rec, cross: null };
  const o = rec.other && typeof rec.other === "object" && Array.isArray(rec.other.sets) ? rec.other : null;
  if(o && sameMode(o, mode, cls)) return { last: o, cross: null };
  return { last: null, cross: rec };
}
/** Trước khi ghi đè setLog[key] = next: next khác kiểu với prev → giữ prev (bỏ .other lồng) làm next.other; cùng kiểu → mang .other cũ sang */
function fkStashLogMode(prev, next){
  if(!next || typeof next !== "object") return next;
  if(!prev || typeof prev !== "object"){ return next; }
  const pm = fkLogMode(prev), nm = fkLogMode(next);
  if(pm && nm && pm !== nm){ const o = Object.assign({}, prev); delete o.other; if(!o.mode) o.mode = pm; next.other = o; }
  else if(prev.other && typeof prev.other === "object" && fkLogMode(prev.other) !== nm) next.other = prev.other;
  return next;
}
const modeLabel = (mode, kind)=> mode === "uni" ? (kind === "leg" ? "từng chân" : "từng tay") : (kind === "leg" ? "hai chân" : "hai tay");

const API = { CORE, X, rule, equipKind, fkExerciseSide, fkExerciseSideWhy, fkSideKindOf, fkLogMode, fkLastForMode, fkStashLogMode, modeLabel };
G.FKSide = API;
G.fkExerciseSide = fkExerciseSide; G.fkExerciseSideWhy = fkExerciseSideWhy; G.fkSideKindOf = fkSideKindOf;
G.fkLogMode = fkLogMode; G.fkLastForMode = fkLastForMode; G.fkStashLogMode = fkStashLogMode; G.fkSideModeLabel = modeLabel;
if(typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

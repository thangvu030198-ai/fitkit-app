/* =========================================================================
   TapEasy — CÔNG CỤ GIÁO ÁN (plan-tools.js) · 16/11/2026
   1) Giữ & kéo để đổi thứ tự bài tập trong buổi (màn Giáo án riêng).
   2) Lựa chọn DỤNG CỤ cho từng bài: cùng một động tác (nhóm cơ + kiểu chuyển động) nhưng tập bằng thanh đòn / tạ đơn /
      máy Smith / máy khối – đĩa / cáp / không tạ. Đổi 1 chạm, nhớ cho lần sau, hoặc đổi cả giáo án theo "phòng tập của tôi".
   Nạp SAU app.js, exdb.js, templates.js. app.js gọi: FKPlanTools.bind(plan) · FKEquip.mount(...) · FKEquip.applyPrefs(plan).
   Dữ liệu lưu trong state (đồng bộ theo tài khoản): state.equipPrefs { [nhóm]: mã bài } · state.equipProfile "free|modern|smith|home".
   API: window.FKEquip = { FAMILIES, EQ, PROFILES, familyOf, optionsOf, currentOf, swap, applyPrefs, convertPlan, mount, openGymSheet }
        window.FKPlanTools = { bind, reorder }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKEquip && G.FKEquip.__v) return;

const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));
const ST = ()=> (typeof state !== "undefined" ? state : (G.state || {}));
const save = ()=>{ try{ if(typeof saveState === "function") saveState(); }catch(e){} };
const say = (m, k)=>{ try{ if(typeof toast === "function") toast(m, k); }catch(e){} };
const haptic = k=>{ try{ if(G.fkPress && G.fkPress.haptic) G.fkPress.haptic(k || "light"); }catch(e){} };

/* ---------------------------------------------------------------------
   1. DỮ LIỆU: dụng cụ + nhóm động tác
   --------------------------------------------------------------------- */
const EQ = {
  barbell:  { label:"Thanh đòn", icon:"fitness_center", note:"Tải được nặng nhất; cần kỹ thuật và giữ thăng bằng tốt." },
  dumbbell: { label:"Tạ đơn",    icon:"fitness_center", note:"Biên độ tự do, sửa lệch hai bên; mức tạ thấp hơn thanh đòn." },
  smith:    { label:"Máy Smith", icon:"view_week",      note:"Thanh trượt cố định: dễ giữ thăng bằng, an toàn khi tập một mình." },
  machine:  { label:"Máy",       icon:"precision_manufacturing", note:"Quỹ đạo cố định, cô lập cơ tốt, dễ tăng tạ; hợp người mới và các hiệp cuối." },
  cable:    { label:"Cáp",       icon:"cable",          note:"Lực căng đều suốt biên độ, nhẹ cho khớp." },
  body:     { label:"Không tạ",  icon:"accessibility_new", note:"Không cần dụng cụ; tăng độ khó bằng số lần và nhịp chậm." },
};
const PROFILES = {
  free:   { label:"Truyền thống", sub:"Thanh đòn + tạ đơn",        order:["barbell", "dumbbell", "body", "cable", "machine", "smith"] },
  modern: { label:"Phòng hiện đại", sub:"Máy khối / đĩa + cáp",    order:["machine", "cable", "smith", "dumbbell", "barbell", "body"] },
  smith:  { label:"Smith + máy", sub:"Ưu tiên máy Smith",          order:["smith", "machine", "cable", "dumbbell", "barbell", "body"] },
  home:   { label:"Tập ở nhà", sub:"Tạ đơn + không tạ",            order:["dumbbell", "body", "barbell", "cable", "machine", "smith"] },
};
/* o = [mã free-exercise-db, dụng cụ, tên tiếng Việt dự phòng, (tuỳ chọn) mã bài lõi của app, (tuỳ chọn) ghi chú riêng] */
const F = (id, name, muscle, re, o, extra)=> ({ id, name, muscle, re, opts: o.map(a=> ({ x:a[0], eq:a[1], n:a[2], core:a[3] || null, note:a[4] || "" })), extra: extra || [] });
const FAMILIES = [
  F("splitsquat", "Chùng chân / squat tách chân", "Đùi trước · Mông", /split squat|bulgarian|lunge|chùng chân|tách chân/, [
    ["Dumbbell_Lunges", "dumbbell", "Chùng chân tạ đơn (Dumbbell Lunge)", "lunges"],
    ["Split_Squat_with_Dumbbells", "dumbbell", "Squat tách chân với tạ đơn (Split Squat)"],
    ["Smith_Single-Leg_Split_Squat", "smith", "Squat tách chân máy Smith (Split Squat)"],
    ["Barbell_Lunge", "barbell", "Chùng chân tạ đòn (Barbell Lunge)"],
    ["One_Leg_Barbell_Squat", "barbell", "Squat một chân tạ đòn (chân sau gác ghế)"],
    ["Bodyweight_Walking_Lunge", "body", "Chùng chân bước đi không tạ (Walking Lunge)"],
  ], ["Barbell_Walking_Lunge", "Dumbbell_Rear_Lunge"]),
  F("squat", "Squat / đạp đùi", "Đùi trước · Mông", /squat|leg press|đạp đùi|đẩy chân|gánh tạ/, [
    ["Barbell_Squat", "barbell", "Squat tạ đòn (Back Squat)", "squat"],
    ["Smith_Machine_Squat", "smith", "Squat máy Smith (Smith Squat)"],
    ["Hack_Squat", "machine", "Hack Squat trên máy", null, "Lưng tựa đệm: dồn lực vào đùi trước, ít áp lực lên lưng dưới."],
    ["Leg_Press", "machine", "Đạp đùi trên máy (Leg Press)", "legpress", "Không tải lên cột sống; dễ tăng tạ an toàn."],
    ["Goblet_Squat", "dumbbell", "Goblet Squat (squat ôm tạ trước ngực)"],
    ["Bodyweight_Squat", "body", "Squat không tạ (Bodyweight Squat)"],
  ], ["Barbell_Full_Squat", "Front_Barbell_Squat", "Dumbbell_Squat", "Lying_Machine_Squat", "Narrow_Stance_Leg_Press", "Narrow_Stance_Hack_Squats", "Narrow_Stance_Squats", "Olympic_Squat"]),
  F("rdl", "Gập hông (Romanian / chân thẳng)", "Đùi sau · Mông", /romanian|stiff.?leg|\brdl\b|deadlift chân thẳng|good morning|pull.?through|hyperext/, [
    ["Romanian_Deadlift", "barbell", "Romanian Deadlift (RDL)"],
    ["Stiff-Legged_Dumbbell_Deadlift", "dumbbell", "Deadlift chân thẳng tạ đơn (Stiff-Leg Deadlift)"],
    ["Smith_Machine_Stiff-Legged_Deadlift", "smith", "Deadlift chân thẳng máy Smith (Stiff-Leg Deadlift)"],
    ["Pull_Through", "cable", "Kéo cáp qua háng (Cable Pull Through)", null, "Học động tác gập hông mà gần như không tải lên lưng dưới."],
    ["Hyperextensions_Back_Extensions", "machine", "Ưỡn lưng trên ghế La Mã (Hyperextension)"],
  ], ["Stiff-Legged_Barbell_Deadlift", "Good_Morning"]),
  F("deadlift", "Deadlift", "Lưng dưới · Mông · Đùi sau", /deadlift/, [
    ["Barbell_Deadlift", "barbell", "Deadlift tạ đòn", "deadlift"],
    ["Trap_Bar_Deadlift", "barbell", "Deadlift đòn lục giác (Trap Bar Deadlift)", null, "Tạ nằm ngang trọng tâm: nhẹ cho lưng dưới hơn thanh đòn thẳng."],
    ["Leverage_Deadlift", "machine", "Deadlift trên máy đòn bẩy"],
    ["Cable_Deadlifts", "cable", "Deadlift cáp"],
  ], ["Sumo_Deadlift"]),
  F("legcurl", "Cuốn đùi sau", "Đùi sau", /leg curl|gân kheo|cuốn đùi sau/, [
    ["Seated_Leg_Curl", "machine", "Cuốn đùi sau ngồi trên máy (Seated Leg Curl)", null, "Tư thế ngồi kéo giãn đùi sau nhiều hơn — lựa chọn tốt để tăng cơ."],
    ["Lying_Leg_Curls", "machine", "Cuốn đùi sau nằm trên máy (Lying Leg Curl)", "legcurl"],
    ["Standing_Leg_Curl", "machine", "Cuốn đùi sau đứng trên máy (Standing Leg Curl)", null, "Tập từng chân: sửa lệch hai bên."],
  ]),
  F("hipthrust", "Đẩy hông / mông", "Mông", /hip thrust|đẩy hông|glute bridge|cầu mông|kickback|đá chân sau|hip raise/, [
    ["Barbell_Hip_Thrust", "barbell", "Đẩy hông tạ đòn (Hip Thrust)"],
    ["Smith_Machine_Hip_Raise", "smith", "Nâng hông nằm ngửa với máy Smith"],
    ["One-Legged_Cable_Kickback", "cable", "Đá chân sau một chân với cáp (Cable Kickback)"],
    ["Butt_Lift_Bridge", "body", "Cầu mông (Glute Bridge)"],
  ], ["Barbell_Glute_Bridge", "Glute_Kickback", "Single_Leg_Glute_Bridge"]),
  F("abduct", "Dạng đùi / mở hông", "Mông ngoài", /abduct|mở hông|dạng đùi/, [
    ["Thigh_Abductor", "machine", "Dạng đùi trên máy (Hip Abductor)"],
    ["Side_Leg_Raises", "body", "Đá chân sang ngang (Side Leg Raise)"],
  ]),
  F("calf", "Nhón bắp chân", "Bắp chân", /calf|bắp chân/, [
    ["Standing_Calf_Raises", "machine", "Nhón bắp chân đứng trên máy (Standing Calf Raise)", "calfraise"],
    ["Seated_Calf_Raise", "machine", "Nhón bắp chân ngồi trên máy (Seated Calf Raise)", null, "Gối gập: tập trung cơ dép (phần sâu của bắp chân)."],
    ["Calf_Press_On_The_Leg_Press_Machine", "machine", "Đạp bắp chân trên máy đạp đùi"],
    ["Smith_Machine_Calf_Raise", "smith", "Nhón bắp chân máy Smith"],
    ["Standing_Dumbbell_Calf_Raise", "dumbbell", "Nhón bắp chân đứng với tạ đơn"],
    ["Standing_Barbell_Calf_Raise", "barbell", "Nhón bắp chân đứng với tạ đòn"],
  ], ["Calf_Press"]),
  F("incline", "Đẩy ngực dốc lên", "Ngực trên", /incline|dốc lên|ghế nghiêng/, [
    ["Incline_Dumbbell_Press", "dumbbell", "Đẩy ngực dốc lên tạ đơn (Incline Dumbbell Press)", "inclinedb"],
    ["Barbell_Incline_Bench_Press_-_Medium_Grip", "barbell", "Đẩy ngực dốc lên tạ đòn (Incline Bench Press)"],
    ["Smith_Machine_Incline_Bench_Press", "smith", "Đẩy ngực dốc lên máy Smith (Incline Smith Press)"],
    ["Leverage_Incline_Chest_Press", "machine", "Đẩy ngực dốc lên trên máy đòn bẩy"],
    ["Incline_Cable_Chest_Press", "cable", "Đẩy ngực dốc lên với cáp"],
  ]),
  F("bench", "Đẩy ngực ngang", "Ngực", /bench press|chest press|đẩy ngực/, [
    ["Barbell_Bench_Press_-_Medium_Grip", "barbell", "Đẩy ngực tạ đòn (Bench Press)", "benchpress"],
    ["Dumbbell_Bench_Press", "dumbbell", "Đẩy ngực tạ đơn (Dumbbell Bench Press)"],
    ["Smith_Machine_Bench_Press", "smith", "Đẩy ngực máy Smith (Smith Bench Press)"],
    ["Leverage_Chest_Press", "machine", "Đẩy ngực trên máy đòn bẩy (Machine Chest Press)"],
    ["Machine_Bench_Press", "machine", "Đẩy ngực trên máy (Machine Bench Press)"],
    ["Cable_Chest_Press", "cable", "Đẩy ngực cáp đứng (Cable Chest Press)"],
  ], ["Wide-Grip_Barbell_Bench_Press"]),
  F("fly", "Ép ngực", "Ngực", /\bfly|flye|ép ngực|pec deck|crossover|butterfly/, [
    ["Cable_Crossover", "cable", "Ép ngực cáp chéo (Cable Crossover)", "cablefly"],
    ["Butterfly", "machine", "Ép ngực máy (Butterfly / Pec Deck)"],
    ["Dumbbell_Flyes", "dumbbell", "Ép ngực tạ đơn (Dumbbell Fly)"],
    ["Flat_Bench_Cable_Flyes", "cable", "Ép ngực cáp nằm ghế phẳng (Cable Fly)"],
  ], ["Incline_Dumbbell_Flyes", "Low_Cable_Crossover"]),
  F("shoulderpress", "Đẩy vai", "Vai", /overhead press|shoulder press|military|đẩy vai|\bohp\b|arnold/, [
    ["Standing_Military_Press", "barbell", "Đẩy vai tạ đòn đứng (Military Press / OHP)", "overheadpress"],
    ["Dumbbell_Shoulder_Press", "dumbbell", "Đẩy vai tạ đơn (Dumbbell Shoulder Press)"],
    ["Smith_Machine_Overhead_Shoulder_Press", "smith", "Đẩy vai máy Smith (Smith Shoulder Press)"],
    ["Machine_Shoulder_Military_Press", "machine", "Đẩy vai trên máy (Machine Military Press)"],
    ["Cable_Shoulder_Press", "cable", "Đẩy vai cáp (Cable Shoulder Press)"],
  ], ["Seated_Barbell_Military_Press", "Barbell_Shoulder_Press", "Seated_Dumbbell_Press", "Arnold_Dumbbell_Press", "Leverage_Shoulder_Press"]),
  F("lateral", "Dang tay vai giữa", "Vai giữa", /lateral raise|vai bên|dang tay sang ngang|deltoid raise/, [
    ["Side_Lateral_Raise", "dumbbell", "Dang tay sang ngang tạ đơn (Lateral Raise)", "lateralraise"],
    ["Standing_Low-Pulley_Deltoid_Raise", "cable", "Nâng vai với cáp thấp đứng", null, "Cáp giữ lực căng ngay từ đầu biên độ — vai giữa làm việc đều hơn tạ đơn."],
    ["Cable_Seated_Lateral_Raise", "cable", "Dang tay sang ngang cáp ngồi (Lateral Raise)"],
  ], ["Seated_Side_Lateral_Raise"]),
  F("reardelt", "Vai sau", "Vai sau", /reverse fl|rear delt|face pull|vai sau|kéo cáp mặt|kéo cáp về mặt/, [
    ["Face_Pull", "cable", "Kéo cáp về mặt (Face Pull)", "facepull"],
    ["Reverse_Machine_Flyes", "machine", "Dang tay vai sau trên máy (Reverse Pec Deck)"],
    ["Cable_Rear_Delt_Fly", "cable", "Dang tay vai sau với cáp (Rear Delt Fly)"],
    ["Reverse_Flyes", "dumbbell", "Dang tay vai sau tạ đơn (Reverse Fly)"],
  ]),
  F("row", "Kéo lưng ngang (row)", "Lưng giữa", /\brow\b|\brows\b|kéo tạ gập|kéo cáp ngồi|kéo tạ đòn cúi|kéo tạ đơn|t-bar/, [
    ["Bent_Over_Barbell_Row", "barbell", "Kéo tạ đòn cúi người (Barbell Row)", "bentoverrow"],
    ["One-Arm_Dumbbell_Row", "dumbbell", "Kéo tạ đơn một tay (One-Arm Dumbbell Row)"],
    ["Seated_Cable_Rows", "cable", "Kéo cáp ngồi (Seated Cable Row)"],
    ["Leverage_Iso_Row", "machine", "Kéo lưng từng tay trên máy đòn bẩy (Iso Row)"],
    ["Lying_T-Bar_Row", "machine", "Kéo T-bar nằm sấp trên máy (Chest-Supported T-Bar Row)", null, "Ngực tựa đệm: không mỏi lưng dưới, tập trung lưng giữa."],
    ["Smith_Machine_Bent_Over_Row", "smith", "Kéo cúi người máy Smith (Smith Row)"],
  ], ["Bent_Over_Two-Dumbbell_Row", "Dumbbell_Incline_Row", "T-Bar_Row_with_Handle"]),
  F("pulldown", "Kéo xô / kéo xà", "Xô (lưng rộng)", /pulldown|pull-?ups?|chin-?up|kéo xà|kéo xô/, [
    ["Wide-Grip_Lat_Pulldown", "cable", "Kéo xô xuống tay rộng (Wide-Grip Lat Pulldown)", "latpulldown"],
    ["Close-Grip_Front_Lat_Pulldown", "cable", "Kéo xô xuống tay hẹp (Lat Pulldown)"],
    ["Leverage_High_Row", "machine", "Kéo lưng cao trên máy đòn bẩy (High Row)"],
    ["Pullups", "body", "Kéo xà (Pull-up)", "pullup"],
    ["Band_Assisted_Pull-Up", "body", "Kéo xà có dây kháng lực hỗ trợ (Assisted Pull-up)"],
  ], ["Chin-Up", "V-Bar_Pulldown", "Underhand_Cable_Pulldowns", "Full_Range-Of-Motion_Lat_Pulldown"]),
  F("hammer", "Cuốn tay búa", "Tay trước · Cẳng tay", /hammer|tay búa|cuốn búa/, [
    ["Hammer_Curls", "dumbbell", "Cuốn búa tạ đơn (Hammer Curl)", "hammercurl"],
    ["Cable_Hammer_Curls_-_Rope_Attachment", "cable", "Cuốn búa cáp dây thừng (Rope Hammer Curl)"],
  ]),
  F("curl", "Cuốn tay trước", "Tay trước", /curl|cuốn tay|cuốn tạ/, [
    ["Dumbbell_Bicep_Curl", "dumbbell", "Cuốn tạ đơn (Dumbbell Curl)", "bicepcurl"],
    ["Barbell_Curl", "barbell", "Cuốn tạ đòn (Barbell Curl)"],
    ["EZ-Bar_Curl", "barbell", "Cuốn đòn EZ (EZ Bar Curl)", null, "Đòn cong: nhẹ cổ tay hơn thanh thẳng."],
    ["Standing_Biceps_Cable_Curl", "cable", "Cuốn tay cáp đứng (Cable Curl)"],
    ["Machine_Preacher_Curls", "machine", "Cuốn tay ghế Scott trên máy (Machine Preacher Curl)"],
    ["Machine_Bicep_Curl", "machine", "Cuốn tay trên máy (Machine Curl)"],
  ], ["Preacher_Curl", "Seated_Dumbbell_Curl"]),
  F("triceps", "Tay sau", "Tay sau", /pushdown|tricep|tay sau|skull|\bdips?\b/, [
    ["Triceps_Pushdown", "cable", "Đẩy cáp tay sau (Triceps Pushdown)", "tricepsdown"],
    ["Triceps_Pushdown_-_Rope_Attachment", "cable", "Đẩy cáp tay sau với dây thừng (Rope Pushdown)"],
    ["Machine_Triceps_Extension", "machine", "Duỗi tay sau trên máy (Machine Triceps Extension)"],
    ["EZ-Bar_Skullcrusher", "barbell", "Skull Crusher đòn EZ (duỗi tay sau nằm)"],
    ["Seated_Triceps_Press", "dumbbell", "Duỗi tay sau tạ đơn ngồi qua đầu (Overhead Extension)"],
    ["Dips_-_Triceps_Version", "body", "Dip xà kép – tay sau (Triceps Dips)", "tricepdip"],
  ], ["Cable_Rope_Overhead_Triceps_Extension", "Tricep_Dumbbell_Kickback"]),
  F("crunch", "Gập bụng", "Bụng", /crunch|gập bụng/, [
    ["Crunches", "body", "Gập bụng (Crunch)", "crunch"],
    ["Cable_Crunch", "cable", "Gập bụng cáp quỳ (Cable Crunch)", null, "Thêm được tạ cho cơ bụng — tăng dần như mọi nhóm cơ khác."],
    ["Ab_Crunch_Machine", "machine", "Gập bụng trên máy (Ab Crunch Machine)"],
    ["Decline_Crunch", "body", "Gập bụng ghế dốc xuống (Decline Crunch)"],
  ]),
  F("shrug", "Nhún vai", "Cầu vai", /shrug|nhún vai/, [
    ["Dumbbell_Shrug", "dumbbell", "Nhún vai tạ đơn (Dumbbell Shrug)"],
    ["Barbell_Shrug", "barbell", "Nhún vai tạ đòn (Shrug)"],
    ["Cable_Shrugs", "cable", "Nhún vai cáp (Cable Shrug)"],
    ["Leverage_Shrug", "machine", "Nhún vai trên máy đòn bẩy"],
  ]),
];
const NOT_STRENGTH = /máy chèo|rowing|stationary|chạy bộ|nhảy dây|burpee|plank|giãn|stretch|lăn giãn/;
const BY_X = {}, BY_CORE = {};
FAMILIES.forEach(f=>{ f.opts.forEach(o=>{ BY_X[o.x] = { f, o }; if(o.core) BY_CORE[o.core] = { f, o }; }); f.extra.forEach(x=>{ if(!BY_X[x]) BY_X[x] = { f, o:null }; }); });

/* ---------------------------------------------------------------------
   2. LOGIC
   --------------------------------------------------------------------- */
const viName = o=>{ try{ const v = G.EXDB_VI && G.EXDB_VI[o.x]; if(v && v.n) return v.n; }catch(e){} return o.n; };
const metaOf = item=>{ try{ return typeof getExerciseMeta === "function" ? getExerciseMeta(item) : { name: (item.custom && item.custom.name) || "" }; }catch(e){ return { name:"" }; } };
/** Bài này thuộc nhóm động tác nào? { f: nhóm, o: lựa chọn đang dùng (hoặc null nếu là biến thể khác trong nhóm) } hoặc null */
function familyOf(item){
  if(!item) return null;
  if(item.exerciseId && BY_CORE[item.exerciseId]) return BY_CORE[item.exerciseId];
  const x = item.custom && item.custom.exDbId;
  if(x && BY_X[x]) return BY_X[x];
  const name = String(metaOf(item).name || "").toLowerCase();
  if(!name || NOT_STRENGTH.test(name)) return null;
  for(const f of FAMILIES){ if(f.re.test(name)) return { f, o: f.opts.find(o=> viName(o).toLowerCase() === name) || null }; }
  return null;
}
const optionsOf = f=> f ? f.opts.slice() : [];
const currentOf = item=>{ const m = familyOf(item); return m ? m.o : null; };
function exdbRow(x){ try{ if(typeof _exdbCache !== "undefined" && Array.isArray(_exdbCache)) return _exdbCache.find(e=> e.id === x) || null; }catch(e){} return null; }
function imgOf(o){
  try{ if(o.core && typeof EXERCISES !== "undefined" && EXERCISES[o.core]) return EXERCISES[o.core].img; }catch(e){}
  const r = exdbRow(o.x);
  try{ if(r && typeof exdbImg === "function"){ const u = exdbImg(r, 0); if(u) return u; } }catch(e){}
  const base = (typeof EXDB_IMG_BASE !== "undefined" && EXDB_IMG_BASE) || "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
  return base + o.x + "/0.jpg";
}
/** Đổi bài trong giáo án sang lựa chọn `o` (giữ uid, số hiệp/lần/nghỉ). Trả true nếu có đổi. */
function setItem(item, f, o){
  if(!item || !o) return false;
  const cur = currentOf(item);
  if(cur && cur.x === o.x) return false;
  if(o.core && typeof EXERCISES !== "undefined" && EXERCISES[o.core]){ item.exerciseId = o.core; delete item.custom; }
  else {
    const r = exdbRow(o.x);
    let guide = ""; try{ const v = G.EXDB_VI && G.EXDB_VI[o.x]; guide = (v && v.g) || (r && (r.instructions || []).join("\n")) || ""; }catch(e){}
    item.exerciseId = null;
    item.custom = { name: viName(o), muscle: f.muscle, equipment: EQ[o.eq].label, guide, img: imgOf(o), exDbId: o.x };
  }
  delete item.stock; item.clipId = null;          // video cũ là của động tác cũ
  return true;
}
function swap(plan, dayKey, item, o, opts){
  opts = opts || {};
  const m = familyOf(item); if(!m || !o) return 0;
  const f = m.f, s = ST();
  let n = setItem(item, f, o) ? 1 : 0;
  item.eqLock = true;                              // người dùng tự chọn → applyPrefs không tự đổi lại
  if(opts.remember){ s.equipPrefs = s.equipPrefs && typeof s.equipPrefs === "object" ? s.equipPrefs : {}; s.equipPrefs[f.id] = o.x; }
  if(opts.wholePlan && plan && plan.days){
    Object.keys(plan.days).forEach(k=> (plan.days[k].items || []).forEach(it=>{
      if(it === item) return; const mm = familyOf(it);
      if(mm && mm.f === f && setItem(it, f, o)){ it.eqLock = true; n++; }
    }));
  }
  save(); return n;
}
/** Lựa chọn nên dùng cho nhóm f theo điều đã nhớ (ưu tiên: chọn riêng cho nhóm → phòng tập của tôi). null = giữ nguyên. */
function preferred(f){
  const s = ST(), p = s.equipPrefs && s.equipPrefs[f.id];
  if(p){ const o = f.opts.find(x=> x.x === p); if(o) return o; }
  const pr = PROFILES[s.equipProfile];
  if(pr){ for(const eq of pr.order){ const o = f.opts.find(x=> x.eq === eq); if(o) return o; } }
  return null;
}
/** Áp điều đã nhớ cho giáo án MỚI thêm (bỏ qua bài người dùng đã tự chọn). Trả số bài đã đổi. */
function applyPrefs(plan, force){
  if(!plan || !plan.days) return 0;
  const s = ST(); if(!(s.equipProfile && PROFILES[s.equipProfile]) && !(s.equipPrefs && Object.keys(s.equipPrefs).length)) return 0;
  let n = 0;
  Object.keys(plan.days).forEach(k=> (plan.days[k].items || []).forEach(it=>{
    if(it.eqLock && !force) return;
    const m = familyOf(it); if(!m) return;
    const o = preferred(m.f); if(o && setItem(it, m.f, o)) n++;
  }));
  return n;
}
function convertPlan(plan, profileId, remember){
  const s = ST();
  if(!PROFILES[profileId]) return 0;
  if(remember) s.equipProfile = profileId;
  const keep = s.equipProfile; s.equipProfile = profileId;
  let n = 0;
  try{ Object.keys(plan.days).forEach(k=> (plan.days[k].items || []).forEach(it=>{
    const m = familyOf(it); if(!m) return;
    const pick = (s.equipPrefs && m.f.opts.find(x=> x.x === s.equipPrefs[m.f.id])) || PROFILES[profileId].order.map(eq=> m.f.opts.find(x=> x.eq === eq)).find(Boolean);
    if(pick && setItem(it, m.f, pick)) n++;
  })); } finally { if(!remember) s.equipProfile = keep; }
  save(); return n;
}

/* ---------------------------------------------------------------------
   3. GIAO DIỆN: khối "Dụng cụ" trong tờ sửa bài + tờ "Phòng tập của tôi"
   --------------------------------------------------------------------- */
function css(){
  if(document.getElementById("fk-pt-css")) return;
  const st = document.createElement("style"); st.id = "fk-pt-css";
  st.textContent = `
.fk-eq{ margin:14px 0 4px; padding:12px; border-radius:16px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); }
html.fk-themed .fk-eq{ background:rgba(var(--fk-ov-rgb,255,255,255),.05); border-color:rgba(var(--fk-ov-rgb,255,255,255),.12); }
.fk-eq-h{ display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px; font-weight:600; font-size:14px; }
.fk-eq-h small{ font-weight:400; font-size:12px; color:var(--text-muted); }
.fk-eq-list{ display:flex; flex-direction:column; gap:8px; }
.fk-eq-o{ display:flex; align-items:center; gap:10px; width:100%; min-height:56px; padding:8px 10px; border-radius:12px; text-align:left; cursor:pointer;
  background:transparent; border:1px solid rgba(255,255,255,.12); color:inherit; font:inherit; }
html.fk-themed .fk-eq-o{ border-color:rgba(var(--fk-ov-rgb,255,255,255),.16); }
.fk-eq-o.sel{ border-color:var(--accent, var(--mint, #33D6C9)); background:rgba(51,214,201,.10); }
.fk-eq-o img{ width:44px; height:44px; border-radius:10px; object-fit:cover; flex:0 0 44px; background:rgba(128,128,128,.2); }
.fk-eq-o .t{ flex:1 1 auto; min-width:0; }
.fk-eq-o .t b{ display:block; font-size:13.5px; font-weight:600; line-height:1.3; overflow-wrap:anywhere; }
.fk-eq-o .t span{ display:block; font-size:12px; color:var(--text-muted); line-height:1.35; margin-top:2px; }
.fk-eq-tag{ flex:0 0 auto; font-size:11.5px; font-weight:600; padding:3px 8px; border-radius:99px; background:rgba(128,128,128,.22); white-space:nowrap; }
.fk-eq-o.sel .fk-eq-tag{ background:var(--accent, var(--mint, #33D6C9)); color:#062126; }
.fk-eq-star{ color:#F5C451; font-size:12px; margin-left:4px; }
.fk-eq-opts{ display:flex; flex-direction:column; gap:6px; margin-top:10px; font-size:13px; }
.fk-eq-opts label{ display:flex; gap:8px; align-items:flex-start; min-height:32px; cursor:pointer; }
.fk-eq-opts input{ width:20px; height:20px; flex:0 0 20px; margin-top:1px; }
.fk-eq-note{ font-size:12px; color:var(--text-muted); margin-top:8px; line-height:1.45; }
.fk-dnd-hint{ display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12px; color:var(--text-muted); margin:-4px 0 8px; }
.fk-dnd-hint button{ font:inherit; font-size:12.5px; font-weight:600; min-height:36px; padding:0 10px; border-radius:99px; border:1px solid rgba(128,128,128,.4); background:transparent; color:inherit; cursor:pointer; }
[data-item].fk-dnd-row{ -webkit-touch-callout:none; -webkit-user-select:none; user-select:none; transition:transform .16s ease; }
[data-item].fk-dragging{ position:relative; z-index:30; transition:none; transform-origin:center; box-shadow:0 14px 34px rgba(0,0,0,.38); opacity:.97; cursor:grabbing; }
[data-item].fk-dnd-row .fk-grip{ color:var(--text-dim); font-size:20px; margin-right:-2px; touch-action:none; cursor:grab; }
body.fk-dnd-on{ overscroll-behavior:none; }
.fk-gym-o{ display:flex; gap:12px; align-items:center; width:100%; min-height:60px; padding:10px 12px; margin-bottom:8px; border-radius:14px; border:1px solid rgba(128,128,128,.35); background:transparent; color:inherit; font:inherit; text-align:left; cursor:pointer; }
.fk-gym-o.sel{ border-color:var(--accent, var(--mint, #33D6C9)); background:rgba(51,214,201,.10); }
.fk-gym-o b{ display:block; font-size:14.5px; } .fk-gym-o span{ display:block; font-size:12.5px; color:var(--text-muted); }
@media (prefers-reduced-motion: reduce){ [data-item].fk-dnd-row{ transition:none; } }`;
  document.head.appendChild(st);
}
/** Chèn khối chọn dụng cụ vào tờ đang mở. ctx = { plan, dayKey, item, host (phần tử chèn sau), reopen() } */
function mount(ctx){
  try{
    css();
    const m = familyOf(ctx.item); if(!m || !ctx.host) return false;
    const old = document.getElementById("fk-eq"); if(old) old.remove();
    const f = m.f, s = ST(), pref = s.equipPrefs && s.equipPrefs[f.id];
    let pick = m.o ? m.o.x : null;
    const box = document.createElement("div"); box.className = "fk-eq"; box.id = "fk-eq";
    const paint = ()=>{
      const cur = m.o ? m.o.x : null, changed = pick && pick !== cur;
      box.innerHTML = `<div class="fk-eq-h"><span>Dụng cụ cho động tác này</span><small>${esc(f.name)}</small></div>
        <div class="fk-eq-list">${f.opts.map(o=> `<button type="button" class="fk-eq-o ${o.x === pick ? "sel" : ""}" data-eqx="${esc(o.x)}" aria-pressed="${o.x === pick}">
          <img src="${esc(imgOf(o))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
          <span class="t"><b>${esc(viName(o))}${o.x === pref ? `<i class="fk-eq-star" title="Đã nhớ cho lần sau">★</i>` : ""}</b><span>${esc(o.note || EQ[o.eq].note)}</span></span>
          <span class="fk-eq-tag">${o.x === cur ? "Đang dùng" : esc(EQ[o.eq].label)}</span></button>`).join("")}</div>
        ${changed ? `<div class="fk-eq-opts">
            <label><input type="checkbox" id="fk-eq-rem" checked> <span>Nhớ cho lần sau — giáo án mới thêm sẽ tự dùng bài này</span></label>
            <label><input type="checkbox" id="fk-eq-all"> <span>Đổi luôn ở các buổi khác trong giáo án này</span></label></div>
          <button type="button" class="btn btn-primary btn-block" style="margin-top:10px;" id="fk-eq-go">Đổi sang bài này</button>` : ""}
        <p class="fk-eq-note">Cùng nhóm cơ và kiểu chuyển động, chỉ khác dụng cụ. Số hiệp, số lần và thời gian nghỉ được giữ nguyên; mức tạ được ghi riêng cho từng bài.</p>`;
      box.querySelectorAll("[data-eqx]").forEach(b=> b.addEventListener("click", ()=>{ pick = b.dataset.eqx; haptic("light"); paint(); }));
      const go = box.querySelector("#fk-eq-go");
      if(go) go.addEventListener("click", ()=>{
        const o = f.opts.find(x=> x.x === pick); if(!o) return;
        const n = swap(ctx.plan, ctx.dayKey, ctx.item, o, { remember: box.querySelector("#fk-eq-rem").checked, wholePlan: box.querySelector("#fk-eq-all").checked });
        haptic("success"); say(n > 1 ? `Đã đổi ${n} bài sang ${EQ[o.eq].label.toLowerCase()}` : `Đã đổi sang: ${viName(o)}`, "check_circle");
        try{ ctx.reopen && ctx.reopen(); }catch(e){}
      });
    };
    paint();
    ctx.host.insertAdjacentElement("afterend", box);
    try{ if(typeof exdbLoad === "function" && !(typeof _exdbCache !== "undefined" && _exdbCache)) exdbLoad().then(()=>{ if(box.isConnected) paint(); }).catch(()=>{}); }catch(e){}
    return true;
  }catch(e){ return false; }
}
function openGymSheet(plan, after){
  css();
  const s = ST(); let pick = PROFILES[s.equipProfile] ? s.equipProfile : "";
  const draw = ()=>{
    openSheet(`<div class="sheet-header"><h3>Phòng tập của tôi</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
      <p class="small-note" style="margin-bottom:12px;">Chọn loại dụng cụ bạn hay dùng. TapEasy đổi các bài trong giáo án sang bài tương đương (cùng nhóm cơ, cùng kiểu chuyển động) và nhớ cho giáo án thêm sau này.</p>
      ${Object.keys(PROFILES).map(id=> `<button type="button" class="fk-gym-o ${id === pick ? "sel" : ""}" data-gym="${id}" aria-pressed="${id === pick}"><span style="flex:1"><b>${esc(PROFILES[id].label)}</b><span>${esc(PROFILES[id].sub)}</span></span>${id === pick ? `<span class="material-symbols-rounded">check_circle</span>` : ""}</button>`).join("")}
      <button class="btn btn-primary btn-block" style="margin-top:8px;" id="fk-gym-apply" ${pick ? "" : "disabled"}>Áp dụng cho giáo án này</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="fk-gym-clear">Bỏ ghi nhớ dụng cụ</button>
      <p class="small-note" style="margin-top:10px;">Bài bạn đã chọn riêng (có dấu ★) được giữ nguyên. Bài không có lựa chọn tương đương cũng giữ nguyên.</p>`);
    document.querySelectorAll("[data-gym]").forEach(b=> b.addEventListener("click", ()=>{ pick = b.dataset.gym; draw(); }));
    document.getElementById("fk-gym-apply").addEventListener("click", ()=>{
      if(!pick) return;
      const n = convertPlan(plan, pick, true);
      closeSheet(); say(n ? `Đã đổi ${n} bài sang “${PROFILES[pick].label}”` : "Giáo án đã đúng với dụng cụ này", "check_circle");
      try{ after && after(); }catch(e){}
    });
    document.getElementById("fk-gym-clear").addEventListener("click", ()=>{ const st = ST(); delete st.equipProfile; st.equipPrefs = {}; save(); closeSheet(); say("Đã bỏ ghi nhớ dụng cụ"); try{ after && after(); }catch(e){} });
  };
  draw();
}

/* ---------------------------------------------------------------------
   4. GIỮ & KÉO ĐỂ SẮP XẾP BÀI TẬP
   Giữ 320 ms trên một bài (hoặc kéo ngay ở biểu tượng ⋮⋮) → nhấc lên, kéo dọc; các bài khác tự dạt ra. Thả → lưu thứ tự mới.
   --------------------------------------------------------------------- */
function reorder(items, from, to){
  if(!Array.isArray(items) || from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return false;
  const [it] = items.splice(from, 1); items.splice(to, 0, it); return true;
}
const HOLD_MS = 320, MOVE_TOL = 9;
function bindDnD(plan, dayKey, list, rerender){
  const rows = ()=> Array.from(list.querySelectorAll(":scope > [data-item]"));
  if(rows().length < 2) return;
  let D = null, timer = null, startPt = null, suppressClick = false;
  rows().forEach(r=>{
    r.classList.add("fk-dnd-row");
    if(!r.querySelector(".fk-grip")){ const g = document.createElement("span"); g.className = "material-symbols-rounded fk-grip"; g.setAttribute("aria-hidden", "true"); g.textContent = "drag_indicator"; r.insertBefore(g, r.firstChild); }
  });
  const pt = e=>{ const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e; return { x: t.clientX, y: t.clientY }; };
  const scroller = ()=>{ let el = list.parentElement; while(el && el !== document.body){ const o = getComputedStyle(el).overflowY; if((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight + 4) return el; el = el.parentElement; } return document.scrollingElement || document.documentElement; };
  function begin(row, p){
    const all = rows(), idx = all.indexOf(row); if(idx < 0) return;
    const rects = all.map(r=> r.getBoundingClientRect());
    const gap = all.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 10;
    D = { row, all, idx, to: idx, y0: p.y, rects, step: rects[idx].height + gap, sc: scroller(), sc0: 0 };
    D.sc0 = D.sc.scrollTop;
    row.classList.add("fk-dragging"); document.body.classList.add("fk-dnd-on");
    row.style.transform = "scale(1.02)";
    haptic("medium"); suppressClick = true;
  }
  function move(p){
    if(!D) return;
    const dy = (p.y - D.y0) + (D.sc.scrollTop - D.sc0);
    D.row.style.transform = `translateY(${dy}px) scale(1.02)`;
    const mid = D.rects[D.idx].top + D.rects[D.idx].height / 2 + dy;
    let to = D.idx;
    D.all.forEach((r, i)=>{ if(i === D.idx) return; const c = D.rects[i].top + D.rects[i].height / 2; if(i < D.idx && mid < c) to = Math.min(to, i); if(i > D.idx && mid > c) to = Math.max(to, i); });
    if(to !== D.to){ D.to = to; haptic("light"); }
    D.all.forEach((r, i)=>{ if(i === D.idx) return; let sh = 0; if(D.idx < to && i > D.idx && i <= to) sh = -D.step; if(D.idx > to && i >= to && i < D.idx) sh = D.step; r.style.transform = sh ? `translateY(${sh}px)` : ""; });
    // tự cuộn khi kéo sát mép
    const vh = window.innerHeight, edge = 70;
    if(p.y < edge + 60) D.sc.scrollTop -= 10; else if(p.y > vh - edge) D.sc.scrollTop += 10;
  }
  function end(commit){
    clearTimeout(timer); timer = null; startPt = null;
    if(!D) return;
    const d = D; D = null;
    document.body.classList.remove("fk-dnd-on");
    d.all.forEach(r=>{ r.style.transform = ""; }); d.row.classList.remove("fk-dragging");
    if(commit && d.to !== d.idx && reorder(plan.days[dayKey].items, d.idx, d.to)){ save(); haptic("success"); rerender(); }
    setTimeout(()=>{ suppressClick = false; }, 350);
  }
  const onDown = e=>{
    if(D) return;
    const row = e.target.closest && e.target.closest("[data-item]"); if(!row || row.parentElement !== list) return;
    if(e.type === "mousedown" && e.button !== 0) return;
    const p = pt(e); startPt = p;
    const grip = !!(e.target.closest && e.target.closest(".fk-grip"));
    clearTimeout(timer);
    if(grip){ if(e.cancelable) e.preventDefault(); begin(row, p); }
    else timer = setTimeout(()=>{ timer = null; if(startPt) begin(row, startPt); }, HOLD_MS);
  };
  const onMove = e=>{
    const p = pt(e);
    if(D){ if(e.cancelable) e.preventDefault(); move(p); return; }
    if(timer && startPt && (Math.abs(p.x - startPt.x) > MOVE_TOL || Math.abs(p.y - startPt.y) > MOVE_TOL)){ clearTimeout(timer); timer = null; startPt = null; }   // đang cuộn trang → không nhấc
    else if(startPt) startPt = p;
  };
  const onUp = ()=> end(true), onCancel = ()=> end(false);
  list.addEventListener("touchstart", onDown, { passive:false });
  list.addEventListener("touchmove", onMove, { passive:false });
  list.addEventListener("touchend", onUp); list.addEventListener("touchcancel", onCancel);
  list.addEventListener("mousedown", onDown);
  const mm = e=>{ if(D || timer) onMove(e); }, mu = ()=>{ if(D || timer) onUp(); };
  window.addEventListener("mousemove", mm); window.addEventListener("mouseup", mu);
  list.addEventListener("contextmenu", e=>{ if(D || suppressClick) e.preventDefault(); });
  list.addEventListener("click", e=>{ if(suppressClick){ e.stopPropagation(); e.preventDefault(); } }, true);
  // gỡ trình nghe trên window khi danh sách bị vẽ lại
  const mo = new MutationObserver(()=>{ if(!list.isConnected){ window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", mu); mo.disconnect(); } });
  try{ mo.observe(document.body, { childList:true, subtree:true }); }catch(e){}
}
/** app.js gọi cuối bindPlanEditorEvents(plan) */
function bind(plan){
  try{
    css();
    const root = document.getElementById("plans-content"); if(!root) return;
    const first = root.querySelector("[data-item]"); const dayKey = (typeof plansUI !== "undefined" && plansUI.day) || null;
    const rerender = ()=>{ try{ renderPlansScreen(); }catch(e){} };
    const title = root.querySelector("#pd-add-exercise"); const sec = title && title.closest(".section-title");
    if(sec && !root.querySelector(".fk-dnd-hint")){
      const h = document.createElement("div"); h.className = "fk-dnd-hint";
      const hasFam = dayKey && (plan.days[dayKey].items || []).some(it=> familyOf(it));
      h.innerHTML = `<span>${first && first.parentElement.querySelectorAll(":scope > [data-item]").length > 1 ? "Giữ một bài rồi kéo để đổi thứ tự" : ""}</span>${hasFam || PROFILES[ST().equipProfile] ? `<button type="button" id="fk-gym-btn">Dụng cụ phòng tập</button>` : ""}`;
      sec.insertAdjacentElement("afterend", h);
      const gb = h.querySelector("#fk-gym-btn"); if(gb) gb.addEventListener("click", ()=> openGymSheet(plan, rerender));
    }
    if(first && dayKey) bindDnD(plan, dayKey, first.parentElement, rerender);
  }catch(e){ try{ console.warn("[plan-tools]", e); }catch(_){} }
}

G.FKEquip = { __v:1, FAMILIES, EQ, PROFILES, familyOf, optionsOf, currentOf, preferred, setItem, swap, applyPrefs, convertPlan, mount, openGymSheet, viName, imgOf };
G.FKPlanTools = { __v:1, bind, reorder, bindDnD };
})(typeof window !== "undefined" ? window : globalThis);

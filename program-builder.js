/* =========================================================================
   TapEasy — TẠO GIÁO ÁN RIÊNG (program-builder.js)
   Thuật toán luật chuyên môn chạy hoàn toàn trên máy — KHÔNG cần AI server.
   Nạp SAU pt.js (cần EXERCISES, DAY_KEYS, DAY_LABELS; UI dùng openSheet, toast,
   state, saveState, goto… của app.js).

   Nguyên tắc lập trình giáo án (tóm tắt):
   · Kiểu chia buổi theo số buổi/tuần + kinh nghiệm (Full body → Upper/Lower →
     ULPPL → PPL). Người mới tối đa 4 buổi tạ/tuần, buổi dư là cardio nhẹ.
   · Mỗi buổi chọn bài theo MẪU VẬN ĐỘNG (squat, gập hông, đẩy hông, lunge,
     đẩy/kéo ngang, đẩy/kéo dọc, core, cardio) phù hợp dụng cụ & tránh chấn thương.
   · Khối lượng 10–20 hiệp khó/nhóm cơ/tuần theo kinh nghiệm (hiệp chính = 1,
     hiệp phụ = 0,5), ≤ 10 hiệp/nhóm cơ/buổi, trần cứng 20.
   · Số lần/nghỉ theo mục tiêu; bài đa khớp trước, cô lập sau; kéo ≥ đẩy.
   · Ước lượng thời gian buổi (khởi động + hiệp × (thực hiện + nghỉ) + chuyển bài
     + hiệp làm nóng bài chính) khớp thời gian người dùng chọn.
   ========================================================================= */
(function(){
"use strict";
const G = (typeof window !== "undefined") ? window : globalThis;

/* =========================================================================
   1. NHÃN & HẰNG SỐ
   ========================================================================= */
const PB_GOALS = [
  { id:"lose",      label:"Giảm mỡ",   icon:"local_fire_department", desc:"Tạ giữ cơ + cardio Zone 2 / interval" },
  { id:"gain",      label:"Tăng cơ",   icon:"fitness_center",        desc:"10–20 hiệp/nhóm cơ/tuần, tăng tiến kép" },
  { id:"strength",  label:"Sức mạnh",  icon:"bolt",                  desc:"Squat, đẩy, kéo nặng 3–6 lần" },
  { id:"endurance", label:"Sức bền",   icon:"directions_run",        desc:"Tim mạch khoẻ, cơ bền, ít mệt" },
  { id:"tone",      label:"Săn chắc",  icon:"self_improvement",      desc:"Tạo dáng, siết cơ, đốt mỡ nhẹ" },
  { id:"hybrid",    label:"Hybrid",    icon:"pb_hybrid",             desc:"Vừa khoẻ vừa bền: tạ + chạy/chèo" },
];
const PB_EXPS = [
  { id:"beg", label:"Mới tập",     desc:"Dưới 6 tháng, hoặc nghỉ lâu mới quay lại" },
  { id:"int", label:"6–24 tháng",  desc:"Đã quen kỹ thuật các bài cơ bản" },
  { id:"adv", label:"Trên 2 năm",  desc:"Tập đều, biết tự chỉnh tạ theo cảm giác (còn ~N lần — RIR)" },
];
const PB_LV = { beg:0, int:1, adv:2 };
const PB_MINUTES = [30, 45, 60, 75];
const PB_DAY_PRESET = { 2:["T3","T6"], 3:["T2","T4","T6"], 4:["T2","T3","T5","T6"], 5:["T2","T3","T4","T6","T7"], 6:["T2","T3","T4","T5","T6","T7"] };
const PB_HOME_EQ = [
  { id:"db",      label:"Tạ đơn" },
  { id:"kb",      label:"Tạ ấm" },
  { id:"band",    label:"Dây kháng lực" },
  { id:"pullbar", label:"Xà đơn" },
  { id:"bench",   label:"Ghế tập" },
  { id:"rope",    label:"Dây nhảy" },
];
const PB_GYM_EQ = ["bw","db","kb","band","bar","bench","cable","machine","pullbar","rope","cardio","sled","ball"];
const PB_FOCUS = [
  { id:"glutes",    label:"Mông",  m:["glutes"] },
  { id:"chest",     label:"Ngực",  m:["chest"] },
  { id:"back",      label:"Lưng",  m:["back"] },
  { id:"shoulders", label:"Vai",   m:["shoulders"] },
  { id:"arms",      label:"Tay",   m:["biceps","triceps"] },
  { id:"core",      label:"Bụng",  m:["core"] },
];
const PB_INJ = [
  { id:"lowback",  label:"Lưng dưới" },
  { id:"knee",     label:"Gối" },
  { id:"shoulder", label:"Vai" },
  { id:"wrist",    label:"Cổ tay" },
];
/* Gợi ý ưu tiên theo giới tính — chỉ là GỢI Ý hiển thị, không tự áp đặt */
const PB_GENDER_SUGG = { female:["glutes","back"], male:["chest","back"] };

const PB_MUSCLES = [["chest","Ngực"],["back","Lưng"],["shoulders","Vai"],["quads","Đùi trước"],["hams","Đùi sau"],
  ["glutes","Mông"],["biceps","Tay trước"],["triceps","Tay sau"],["core","Bụng"],["calves","Bắp chân"]];
const PB_MK = PB_MUSCLES.map(x=>x[0]);
const PB_MLABEL = {}; PB_MUSCLES.forEach(([k,l])=> PB_MLABEL[k] = l);
const PB_PAT_LABEL = { squat:"Squat", hinge:"Gập hông", bridge:"Đẩy hông", lunge:"Lunge / 1 chân", hpush:"Đẩy ngang",
  vpush:"Đẩy dọc", hpull:"Kéo ngang", vpull:"Kéo dọc", fly:"Ép ngực", latraise:"Vai giữa", rear:"Vai sau",
  biceps:"Tay trước", triceps:"Tay sau", quadiso:"Đùi trước", hamcurl:"Đùi sau", gluteiso:"Mông cô lập",
  calf:"Bắp chân", core:"Core", cond:"Thể lực", cardio:"Cardio", mob:"Giãn cơ" };
const PB_PUSH = new Set(["hpush","vpush","fly"]);
const PB_PULL = new Set(["hpull","vpull","rear"]);
const PB_HARD_CAP = 20;          // trần cứng hiệp/nhóm cơ/tuần
const PB_SESS_MUSCLE_CAP = 10;   // trần hiệp/nhóm cơ/buổi
const PB_WARMUP_MIN = 5;         // khởi động chung mỗi buổi (phút)

/* =========================================================================
   2. BẢNG PHÂN LOẠI TOÀN BỘ BÀI TẬP TRONG EXERCISES
   pat   : mẫu vận động (nhóm "Đổi bài" tương đương)
   role  : c = đa khớp · i = cô lập · core · cond (thể lực) · cardio · mob
   m     : nhóm cơ → trọng số (1 = cơ chính, 0,5 = cơ phụ, 0,25 = hỗ trợ)
   eq    : các phương án dụng cụ, "a+b" = cần cả a và b. Token: bw (không dụng cụ
           — gồm ghế/bàn trong nhà), db, kb, band, pullbar, bench (ghế tập),
           rope, bar (tạ đòn/EZ), cable, machine, cardio (máy chạy/chèo/đạp),
           sled, ball (bóng tạ). Phòng gym đầy đủ = có tất cả.
   avoid : CHỐNG CHỈ ĐỊNH → loại hẳn khi người dùng chọn chấn thương đó
   caution: được giữ nhưng kèm ghi chú điều chỉnh kỹ thuật
   lvl   : kinh nghiệm tối thiểu (0 mới · 1 trung bình · 2 lâu năm); diff: độ khó kỹ thuật 1–3
   uni   : bài 1 bên ("chân"/"tay"/"bên") → thời gian ×2
   ========================================================================= */
const X = (pat, role, m, eq, o)=> Object.assign({ pat, role, m, eq, avoid:[], caution:{}, eqNote:{}, lvl:0, diff:1, pref:0 }, o||{});
const PB_EX = {
  /* ---- Đẩy ngang ---- */
  benchpress:    X("hpush","c",{chest:1,triceps:.5,shoulders:.5},["bar+bench"],{avoid:["shoulder","wrist"],diff:2,heavy:1}),
  dbbench:       X("hpush","c",{chest:1,triceps:.5,shoulders:.5},["db+bench","db"],{pref:.6,eqNote:{db:"không có ghế: nằm sàn (floor press)"},caution:{shoulder:"tay cầm trung lập, hạ tới ngang ngực"}}),
  inclinedb:     X("hpush","c",{chest:1,shoulders:.5,triceps:.5},["db+bench"],{pref:.5,avoid:["shoulder"]}),
  machinepress:  X("hpush","c",{chest:1,triceps:.5,shoulders:.5},["machine"],{pref:.4,caution:{shoulder:"biên độ không đau"}}),
  pushup:        X("hpush","c",{chest:1,triceps:.5,shoulders:.5,core:.25},["bw"],{pref:.3,caution:{wrist:"chống trên nắm tay hoặc tay cầm để cổ tay thẳng",shoulder:"khuỷu ~45°, biên độ không đau"}}),
  inclinepushup: X("hpush","c",{chest:1,triceps:.5,shoulders:.5},["bw"],{pref:.2,eqNote:{bw:"chống tay lên ghế/bàn chắc"},caution:{wrist:"chống trên nắm tay để cổ tay thẳng",shoulder:"khuỷu ~45°, biên độ không đau"}}),
  /* ---- Ép ngực ---- */
  cablefly:      X("fly","i",{chest:1},["cable","band"],{pref:.3,avoid:["shoulder"],eqNote:{band:"dây kháng lực neo sau lưng"}}),
  pecdeck:       X("fly","i",{chest:1},["machine","cable"],{pref:.4,avoid:["shoulder"]}),
  /* ---- Đẩy dọc ---- */
  overheadpress: X("vpush","c",{shoulders:1,triceps:.5},["bar"],{avoid:["shoulder","lowback","wrist"],diff:2,heavy:1}),
  dbpress:       X("vpush","c",{shoulders:1,triceps:.5},["db","kb"],{pref:.6,avoid:["shoulder"],caution:{lowback:"ngồi tựa lưng ghế"}}),
  /* ---- Kéo dọc ---- */
  pullup:        X("vpull","c",{back:1,biceps:.5},["pullbar"],{avoid:["shoulder"],lvl:1,diff:2,heavy:1}),
  latpulldown:   X("vpull","c",{back:1,biceps:.5},["cable","band"],{pref:1,eqNote:{band:"kéo dây kháng lực neo trên cao"},caution:{shoulder:"kéo trước ngực, tay cầm hẹp, biên độ không đau"}}),
  pullover:      X("vpull","i",{back:1,chest:.25,triceps:.25},["db+bench","cable","db"],{pref:-.3,avoid:["shoulder"],eqNote:{db:"nằm sàn"}}),
  /* ---- Kéo ngang ---- */
  bentoverrow:   X("hpull","c",{back:1,biceps:.5,hams:.25},["bar"],{avoid:["lowback"],diff:2,heavy:1}),
  cablerow:      X("hpull","c",{back:1,biceps:.5},["cable","band"],{pref:.6,eqNote:{band:"ngồi duỗi chân, kéo dây kháng lực"}}),
  dbrow:         X("hpull","c",{back:1,biceps:.5},["db","kb"],{pref:.5,uni:"tay",caution:{lowback:"tì tay và gối lên ghế, lưng phẳng"}}),
  csrow:         X("hpull","c",{back:1,biceps:.5},["db+bench"],{pref:1}),
  invertedrow:   X("hpull","c",{back:1,biceps:.5},["bw"],{pref:.3,eqNote:{bw:"nằm dưới bàn thật chắc hoặc xà thấp"}}),
  /* ---- Vai ---- */
  lateralraise:  X("latraise","i",{shoulders:1},["db","band"],{pref:.3,caution:{shoulder:"nâng tới ngang vai, không cao hơn"},eqNote:{band:"giẫm dây kháng lực"}}),
  cablelateral:  X("latraise","i",{shoulders:1},["cable","band"],{pref:.5,caution:{shoulder:"nâng tới ngang vai, không cao hơn"},eqNote:{band:"giẫm dây kháng lực"}}),
  facepull:      X("rear","i",{shoulders:.5,back:.5},["cable","band"],{pref:.5,eqNote:{band:"dây kháng lực neo ngang mặt"}}),
  /* ---- Squat ---- */
  squat:         X("squat","c",{quads:1,glutes:.5,core:.25},["bar"],{avoid:["lowback","knee"],diff:2,heavy:1}),
  frontsquat:    X("squat","c",{quads:1,glutes:.5,core:.25},["bar"],{avoid:["lowback","knee","wrist"],lvl:1,diff:3,heavy:1}),
  smithsquat:    X("squat","c",{quads:1,glutes:.5},["machine"],{pref:-.5,avoid:["lowback","knee"]}),
  hacksquat:     X("squat","c",{quads:1,glutes:.5},["machine"],{pref:.5,avoid:["knee"],caution:{lowback:"lưng áp sát đệm, không xuống quá sâu"}}),
  legpress:      X("squat","c",{quads:1,glutes:.5},["machine"],{pref:.4,caution:{knee:"biên độ không đau, gối gập không quá 90°",lowback:"hông không cuộn khỏi đệm"}}),
  gobletsquat:   X("squat","c",{quads:1,glutes:.5},["db","kb"],{pref:.5,caution:{knee:"ngồi tới ghế, biên độ không đau",lowback:"tạ vừa sức, lưng thẳng"}}),
  bwsquat:       X("squat","c",{quads:1,glutes:.5},["bw"],{caution:{knee:"ngồi tới ghế (box squat), biên độ không đau"}}),
  /* ---- Lunge / 1 chân ---- */
  lunges:        X("lunge","c",{quads:1,glutes:.5},["db","kb","bw"],{pref:.3,avoid:["knee"],uni:"chân",eqNote:{bw:"tay không"}}),
  bulgarian:     X("lunge","c",{quads:1,glutes:1},["db","kb","bw"],{pref:.5,avoid:["knee"],uni:"chân",diff:2,eqNote:{bw:"tay không, chân sau gác ghế"}}),
  stepup:        X("lunge","c",{quads:1,glutes:1},["db","kb","bw"],{pref:.2,avoid:["knee"],uni:"chân",eqNote:{bw:"tay không, bục hoặc bậc cầu thang"}}),
  /* ---- Gập hông ---- */
  deadlift:      X("hinge","c",{glutes:1,hams:.5,back:.5,quads:.25},["bar"],{avoid:["lowback"],lvl:1,diff:3,heavy:1}),
  rdl:           X("hinge","c",{hams:1,glutes:1,back:.25},["bar","db","kb"],{pref:1,avoid:["lowback"],diff:2}),
  kbswing:       X("hinge","c",{glutes:1,hams:.5},["kb","db"],{avoid:["lowback"],diff:2,cond:1,eqNote:{db:"vung 1 tạ đơn"}}),
  /* ---- Đẩy hông ---- */
  hipthrust:     X("bridge","c",{glutes:1,hams:.25},["bar+bench","db","kb"],{pref:1,caution:{lowback:"không ưỡn thắt lưng ở đỉnh"},eqNote:{db:"tạ đơn đặt trên hông, tựa sofa/ghế",kb:"tạ ấm đặt trên hông, tựa sofa/ghế"}}),
  glutebridge:   X("bridge","c",{glutes:1,hams:.25},["bw"],{pref:.3}),
  /* ---- Cô lập chân / mông ---- */
  legext:        X("quadiso","i",{quads:1},["machine"],{avoid:["knee"]}),
  legcurl:       X("hamcurl","i",{hams:1},["machine"]),
  kickback:      X("gluteiso","i",{glutes:1},["cable","machine","band"],{pref:.2,uni:"chân",eqNote:{band:"dây kháng lực ở cổ chân"}}),
  abduction:     X("gluteiso","i",{glutes:1},["machine","band"],{pref:.3,eqNote:{band:"dây quanh gối, ngồi mở hông"}}),
  calfraise:     X("calf","i",{calves:1},["machine","db","bw"],{eqNote:{bw:"đứng 1 chân trên bậc"}}),
  /* ---- Tay ---- */
  bicepcurl:     X("biceps","i",{biceps:1},["db","band","kb"],{pref:.3,eqNote:{band:"giẫm dây kháng lực"}}),
  hammercurl:    X("biceps","i",{biceps:1},["db"],{pref:.2}),
  preacher:      X("biceps","i",{biceps:1},["bar+bench","db+bench"],{pref:.3,avoid:["wrist"]}),
  tricepsdown:   X("triceps","i",{triceps:1},["cable","band"],{pref:.3,eqNote:{band:"dây kháng lực neo trên cao"}}),
  ohtriext:      X("triceps","i",{triceps:1},["cable","band","db"],{pref:.5,avoid:["shoulder"],eqNote:{db:"1 tạ đơn qua đầu"}}),
  skullcrusher:  X("triceps","i",{triceps:1},["bar+bench","db"],{avoid:["wrist"],eqNote:{db:"nằm sàn hoặc ghế"}}),
  tricepdip:     X("triceps","c",{triceps:1,chest:.5,shoulders:.25},["bw"],{pref:-.5,avoid:["shoulder","wrist"],eqNote:{bw:"chống tay trên ghế chắc"}}),
  /* ---- Core ---- */
  plank:         X("core","core",{core:1},["bw"],{pref:.5,timed:1}),
  sideplank:     X("core","core",{core:1},["bw"],{pref:.2,timed:1,uni:"bên",avoid:["shoulder"]}),
  deadbug:       X("core","core",{core:1},["bw"],{pref:.6,uni:"bên"}),
  crunch:        X("core","core",{core:1},["bw"],{pref:-.5,avoid:["lowback"]}),
  russiantwist:  X("core","core",{core:1},["db","kb","bw"],{pref:-.5,avoid:["lowback"]}),
  hangingleg:    X("core","core",{core:1},["pullbar"],{pref:.3,avoid:["lowback","shoulder"],lvl:1,diff:2}),
  woodchop:      X("core","core",{core:1},["cable","band"],{pref:.2,uni:"bên",avoid:["lowback"],eqNote:{band:"dây kháng lực neo cao"}}),
  /* ---- Thể lực (conditioning) ---- */
  mountainclimber: X("cond","cond",{core:.5},["bw"],{avoid:["wrist"],timed:1}),
  burpee:        X("cond","cond",{},["bw"],{avoid:["knee","wrist","lowback","shoulder"],diff:2}),
  farmercarry:   X("cond","cond",{core:.5},["db","kb"],{pref:.5,dist:1}),
  sledpush:      X("cond","cond",{quads:.5,glutes:.5},["sled"],{avoid:["knee","lowback"],dist:1}),
  wallball:      X("cond","cond",{quads:.5,shoulders:.25},["ball"],{avoid:["knee","shoulder","wrist","lowback"],diff:2}),
  /* ---- Cardio ---- */
  zone2:         X("cardio","cardio",{},["bw"],{caution:{knee:"ưu tiên đạp xe",lowback:"ưu tiên đạp xe hoặc đi bộ"}}),
  walking:       X("cardio","cardio",{},["bw"]),
  inclinewalk:   X("cardio","cardio",{},["cardio"]),
  running:       X("cardio","cardio",{},["bw"],{avoid:["knee"]}),
  rowing:        X("cardio","cardio",{},["cardio"],{avoid:["lowback"]}),
  jumprope:      X("cardio","cardio",{},["rope"],{avoid:["knee"]}),
  intervalwalk:  X("cardio","cardio",{},["bw"]),
  /* ---- Giãn cơ ---- */
  stretch:       X("mob","mob",{},["bw"]),
};
const PB_ORDER = {}; Object.keys(PB_EX).forEach((id,i)=> PB_ORDER[id] = i);

/* Interval: [phút mỗi vòng, mô tả] — Zone 2: mô tả theo số phút */
const PB_INT = {
  rowing:          [2, "1 phút nhanh / 1 phút chậm"],
  running:         [3, "1 phút chạy nhanh / 2 phút chạy chậm"],
  jumprope:        [1, "30s nhảy / 30s nghỉ"],
  mountainclimber: [1, "30 giây nhanh / 30 giây nghỉ"],
  intervalwalk:    [6, "3 phút đi nhanh + 3 phút đi chậm"],
};
const PB_INT_MAXR = { 1:16, 2:10, 3:8, 6:6 };   // số vòng interval tối đa theo độ dài vòng
const PB_Z2 = {
  zone2:       m=> `${m} phút · Zone 2: thở hơi nhanh nhưng vẫn nói được thành câu`,
  inclinewalk: m=> `${m} phút · dốc 8–12%, ~4,8 km/h`,
  walking:     m=> `${m} phút đi bộ nhanh`,
  running:     m=> `${m} phút chạy chậm Zone 2`,
  rowing:      m=> `${m} phút chèo đều Zone 2`,
};

/* Bài thay thế khi mẫu vận động không có bài phù hợp */
const PB_FALLBACK = {
  squat:["squat","lunge","bridge"], hinge:["hinge","bridge","hamcurl"], bridge:["bridge","hinge","gluteiso"],
  lunge:["lunge","squat","bridge"], hpush:["hpush","fly"], vpush:["vpush","hpush","latraise"], hpull:["hpull","vpull"],
  vpull:["vpull","hpull"], fly:["fly","hpush"], latraise:["latraise","vpush"], rear:["rear","hpull"],
  quadiso:["quadiso","lunge","squat"], hamcurl:["hamcurl","hinge","bridge"], gluteiso:["gluteiso","bridge"],
  biceps:["biceps"], triceps:["triceps"], calf:["calf"], core:["core"], cond:["cond"],
};
/* Thêm bài khi một nhóm cơ còn thiếu khối lượng */
const PB_ADD_PAT = { chest:["fly","hpush"], back:["hpull","vpull","rear"], shoulders:["latraise","rear","vpush"],
  quads:["quadiso","lunge","squat"], hams:["hamcurl","hinge"], glutes:["gluteiso","bridge"], biceps:["biceps"],
  triceps:["triceps"], core:["core"], calves:["calf"] };
const PB_COMPAT = { chest:["upper","push","fb"], triceps:["upper","push","fb"], shoulders:["upper","push","fb"],
  back:["upper","pull","fb"], biceps:["upper","pull","fb"], quads:["lower","fb"], hams:["lower","fb"],
  glutes:["lower","fb"], core:["upper","lower","push","pull","fb"], calves:["lower","fb"] };

/* =========================================================================
   3. MẪU BUỔI TẬP (slot = mẫu vận động + vai trò + độ quan trọng)
   ========================================================================= */
const S = (p, r, imp)=> ({ p, r, imp });
const PB_SESS = {
  FA:{ title:"Toàn thân A", kind:"fb", why:"Squat + đẩy ngang + kéo ngang làm chính, thêm gập hông.",
       slots:[S("squat","main",1),S("hpush","main",1.1),S("hpull","main",1.2),S("hinge","sec",2),S("latraise","acc",3),S("core","core",3.5),S("biceps","acc",4),S("triceps","acc",4.1)] },
  FB:{ title:"Toàn thân B", kind:"fb", why:"Gập hông + kéo dọc + đẩy dọc — bù các mẫu vận động của buổi A.",
       slots:[S("hinge","main",1),S("vpull","main",1.1),S("vpush","main",1.2),S("lunge","sec",2),S("hpush","sec",2.2),S("rear","acc",3.2),S("core","core",3.5),S("hamcurl","acc",4)] },
  FC:{ title:"Toàn thân C", kind:"fb", why:"Bài 1 chân + đẩy hông: vững gối/hông, cân bằng hai bên cơ thể.",
       slots:[S("lunge","main",1),S("hpull","main",1.1),S("hpush","sec",1.2),S("bridge","sec",2),S("vpull","sec",2.1),S("latraise","acc",3),S("core","core",3.5),S("calf","acc",4.5)] },
  FX:{ title:"Toàn thân", kind:"fb", why:"Đủ 6 mẫu vận động lớn trong một buổi.",
       slots:[S("squat","main",1),S("hpush","main",1.1),S("hpull","main",1.2),S("hinge","sec",2),S("vpull","sec",2.1),S("vpush","sec",2.2),S("core","core",3.5),S("latraise","acc",3.6)] },
  UA:{ title:"Thân trên A", kind:"upper", why:"Đẩy & kéo ngang làm chính, đẩy/kéo dọc bổ trợ — số hiệp đẩy:kéo 1:1.",
       slots:[S("hpush","main",1),S("hpull","main",1.1),S("vpush","sec",2),S("vpull","sec",2.1),S("latraise","acc",3),S("triceps","acc",3.3),S("biceps","acc",3.4),S("core","core",4.5)] },
  UB:{ title:"Thân trên B", kind:"upper", why:"Kéo dọc làm chính, biến thể khác buổi A để đủ góc tác động; thêm vai sau.",
       slots:[S("vpull","main",1),S("hpush","main",1.1),S("hpull","sec",2),S("rear","acc",3),S("fly","acc",3.1),S("biceps","acc",3.3),S("triceps","acc",3.4),S("core","core",4.5)] },
  LA:{ title:"Thân dưới A", kind:"lower", why:"Squat làm chính (đùi trước), gập hông & lunge bổ trợ.",
       slots:[S("squat","main",1),S("hinge","sec",2),S("lunge","sec",2.1),S("hamcurl","acc",3),S("core","core",3.5),S("calf","acc",3.6)] },
  LB:{ title:"Thân dưới B", kind:"lower", why:"Gập hông làm chính (đùi sau – mông), squat biến thể & đẩy hông bổ trợ.",
       slots:[S("hinge","main",1),S("squat","sec",2),S("bridge","sec",2.1),S("quadiso","acc",3),S("gluteiso","acc",3.2),S("core","core",3.5),S("calf","acc",3.8)] },
  PU:{ title:"Đẩy — Ngực · Vai · Tay sau", kind:"push", why:"Toàn bộ nhóm đẩy trong một buổi, đẩy ngang nặng trước.",
       slots:[S("hpush","main",1),S("vpush","sec",2),S("hpush","sec",2.1),S("fly","acc",3),S("latraise","acc",3.1),S("triceps","acc",3.2),S("triceps","acc",4)] },
  PL:{ title:"Kéo — Lưng · Vai sau · Tay trước", kind:"pull", why:"Kéo dọc + kéo ngang, vai sau và tay trước.",
       slots:[S("vpull","main",1),S("hpull","sec",2),S("hpull","sec",2.1),S("rear","acc",3),S("biceps","acc",3.1),S("core","core",3.5),S("biceps","acc",4)] },
  LG:{ title:"Chân — Đùi · Mông · Bắp chân", kind:"lower", why:"Squat, gập hông, 1 chân và các bài cô lập chân.",
       slots:[S("squat","main",1),S("hinge","sec",2),S("lunge","sec",2.1),S("quadiso","acc",3),S("hamcurl","acc",3.1),S("gluteiso","acc",3.3),S("calf","acc",3.5)] },
};
PB_SESS.U = Object.assign({}, PB_SESS.UA, { title:"Thân trên" });
PB_SESS.L = Object.assign({}, PB_SESS.LA, { title:"Thân dưới" });
const PB_REG = { fb:{U:1,L:1}, upper:{U:1}, lower:{L:1}, push:{U:1}, pull:{U:1} };

const PB_SPLITS = {
  fb1:   { name:"Toàn thân + cardio", seq:["FX"] },
  fb2:   { name:"Toàn thân A/B", seq:["FA","FB"] },
  fb3:   { name:"Toàn thân A/B/C", seq:["FA","FB","FC"] },
  ulf:   { name:"Upper / Lower / Full body", seq:["U","L","FX"] },
  ul4:   { name:"Upper / Lower ×2", seq:["UA","LA","UB","LB"] },
  ulppl: { name:"Trên–Dưới–Đẩy–Kéo–Chân (ULPPL)", seq:["U","L","PU","PL","LG"] },
  ppl6:  { name:"Push / Pull / Legs ×2", seq:["PU","PL","LG","PU","PL","LG"] },
  /* dùng khi dụng cụ hạn chế (không đủ bài cho buổi Đẩy/Kéo riêng) */
  ul5:   { name:"Upper / Lower ×2 + Toàn thân", seq:["UA","LA","UB","LB","FX"] },
  ul6:   { name:"Upper / Lower ×3", seq:["UA","LA","UB","LB","UA","LA"] },
};
/* Số buổi cardio riêng theo mục tiêu × số buổi/tuần */
const PB_CARDIO_DAYS = {
  gain:     {2:0,3:0,4:0,5:0,6:0}, strength:{2:0,3:0,4:0,5:1,6:2}, tone:{2:0,3:0,4:1,5:1,6:2},
  lose:     {2:0,3:0,4:1,5:2,6:2}, hybrid:  {2:0,3:1,4:2,5:2,6:2}, endurance:{2:1,3:1,4:2,5:3,6:3},
};
const PB_CARDIO_SEQ = { gain:["z2","z2"], strength:["z2","z2"], tone:["z2","int"], lose:["z2","int"], hybrid:["z2","int","long"], endurance:["z2","int","long"] };

/* =========================================================================
   4. TIỆN ÍCH THUẦN (chạy được cả trong Node để kiểm thử)
   ========================================================================= */
function pbFeasibleAlt(meta, eq){
  for(const alt of meta.eq){ if(alt.split("+").every(t=> eq.has(t))) return alt; }
  return null;
}
function pbFeasible(id, ctx){
  const m = PB_EX[id];
  if(!m || typeof EXERCISES==="undefined" || !EXERCISES[id]) return false;
  if(m.avoid.some(j=> ctx.inj.includes(j))) return false;
  if((m.lvl||0) > ctx.lv) return false;
  return !!pbFeasibleAlt(m, ctx.eq);
}
function pbRepTop(r){
  const s = String(r||"");
  const m = s.match(/(\d+)\s*[-–]\s*(\d+)/); if(m) return Number(m[2]);
  const n = s.match(/(\d+)/); return n ? Number(n[1]) : 0;
}
function pbNormalize(a){
  a = a || {};
  const pick = (v, list, def)=> list.some(x=> x.id===v) ? v : def;
  const days = (Array.isArray(a.days) ? a.days : []).filter(d=> DAY_KEYS.includes(d));
  const uniq = DAY_KEYS.filter(d=> days.includes(d));
  return {
    goal: pick(a.goal, PB_GOALS, "gain"),
    exp: pick(a.exp, PB_EXPS, "beg"),
    days: uniq.length>=2 ? uniq.slice(0,6) : PB_DAY_PRESET[3].slice(),
    minutes: PB_MINUTES.includes(Number(a.minutes)) ? Number(a.minutes) : 60,
    place: a.place==="home" ? "home" : "gym",
    equip: (a.equip||[]).filter(e=> PB_HOME_EQ.some(x=> x.id===e)),
    focus: (a.focus||[]).filter(f=> PB_FOCUS.some(x=> x.id===f)).slice(0,3),
    inj: (a.inj||[]).filter(j=> PB_INJ.some(x=> x.id===j)),
    gender: a.gender==="female"||a.gender==="male" ? a.gender : null,
  };
}
function pbCtx(a){
  const eq = new Set(a.place==="gym" ? PB_GYM_EQ : ["bw"].concat(a.equip));
  const lv = PB_LV[a.exp];
  const ctx = { goal:a.goal, exp:a.exp, lv, n:a.days.length, minutes:a.minutes, gym:a.place==="gym", eq, inj:a.inj.slice(),
    focus:a.focus.slice(), fm:new Set(), gender:a.gender };
  a.focus.forEach(f=> (PB_FOCUS.find(x=>x.id===f)||{m:[]}).m.forEach(k=> ctx.fm.add(k)));
  ctx.targets = pbTargets(ctx);
  return ctx;
}
function pbTargets(ctx){
  const base = [10,14,18][ctx.lv];
  const mult = { gain:1, tone:.9, strength:.8, lose:.8, hybrid:.75, endurance:.6 }[ctx.goal];
  const major = Math.round(base*mult);
  const T = { chest:major, back:major, shoulders:major, quads:major, hams:Math.round(major*.8), glutes:major,
    biceps:Math.round(major*.6), triceps:Math.round(major*.6), core:[6,8,9][ctx.lv],
    calves:(["gain","tone","strength"].includes(ctx.goal) && ctx.lv>0) ? 6 : 0 };
  ctx.fm.forEach(k=>{ T[k] = Math.min(PB_HARD_CAP, Math.max(T[k], major) + 4); });
  return T;
}

/* ---- Số lần / nghỉ theo mục tiêu × kinh nghiệm × vai trò ---- */
const PB_SCHEME = {
  gain:     { main:[["8-12",120],["6-10",150],["6-10",150]], sec:[["10-12",90],["8-12",90],["8-12",90]], acc:[["12-15",60],["10-15",60],["10-15",60]], core:[["10-15",45],["10-15",45],["12-15",45]] },
  strength: { main:[["5-6",150],["3-5 · RPE 7-8",180],["2-4 · RPE 8",210]], sec:[["8-10",120],["6-8",120],["5-8",120]], acc:[["10-12",75],["8-12",75],["8-12",75]], core:[["8-12",45],["8-12",45],["8-12",45]] },
  tone:     { main:[["10-12",75],["8-12",90],["8-12",90]], sec:[["12-15",60],["10-12",75],["10-12",75]], acc:[["12-15",45],["12-15",45],["12-15",45]], core:[["12-15",30],["12-15",40],["15-20",40]] },
  lose:     { main:[["10-12",75],["8-12",75],["8-12",90]], sec:[["12-15",60],["10-12",60],["10-12",60]], acc:[["12-15",45],["12-15",45],["12-15",45]], core:[["12-15",30],["12-15",30],["15-20",30]] },
  endurance:{ main:[["12-15",60],["12-15",60],["12-15",60]], sec:[["15",45],["15-20",45],["15-20",45]], acc:[["15-20",30],["15-20",30],["15-20",30]], core:[["15-20",30],["15-20",30],["20",30]] },
  hybrid:   { main:[["6-8",120],["5-8",150],["4-6",150]], sec:[["8-12",90],["8-12",75],["8-12",75]], acc:[["10-15",45],["10-15",45],["10-15",45]], core:[["10-15",30],["10-15",30],["12-15",30]] },
};
/* Bài thi đấu sức mạnh — chỉ các bài này dùng khoảng 2–5 lần nặng */
const PB_STR_MAIN = new Set(["squat","frontsquat","benchpress","deadlift","overheadpress"]);
const PB_BW_REPS = { strength:"6-12", gain:"8-15", tone:"12-20", lose:"12-20", endurance:"15-25", hybrid:"10-20" };

function pbRepsFor(id, role, ctx, wave, alt){
  const m = PB_EX[id], lv = ctx.lv, goal = ctx.goal;
  const tbl = PB_SCHEME[goal] || PB_SCHEME.gain;
  const rk = (role==="cond"||role==="fin") ? "acc" : (tbl[role] ? role : "acc");
  let [reps, rest] = tbl[rk][lv];
  if(lv>0 && wave==="heavy" && role==="main"){
    if(goal==="gain"){ reps = "5-8"; rest = 150; }
    if(goal==="tone"){ reps = "6-10"; rest = 120; }
  }
  if(lv>0 && wave==="volume"){
    if(goal==="gain"){ if(role==="main"){ reps="8-12"; rest=120; } else if(role==="sec"){ reps="10-15"; rest=90; } else if(role==="acc") reps="12-20"; }
    if(goal==="strength" && role==="main"){ reps = lv===1 ? "5-6" : "4-6"; rest = 180; }
  }
  const load = (alt||"bw").split("+")[0];
  const notes = [];
  if(m.timed){
    reps = ["20-30 giây","30-45 giây","45-60 giây"][lv]; rest = 40;
    if(id==="mountainclimber"){ reps = "30 giây"; rest = 30; }
  } else if(m.dist){
    reps = id==="sledpush" ? "20 m" : "30-40 m"; rest = 75;
  } else if(m.pat==="core"){
    reps = { deadbug:"8-10", woodchop:"10-12", russiantwist:"16-20", hangingleg:["8-12","8-12","10-15"][lv], crunch:"12-20" }[id] || reps;
    if(id==="russiantwist") notes.push("đếm cả hai bên");
  } else if(id==="kbswing"){
    reps = ["lose","endurance","hybrid"].includes(goal) ? "15-20" : "12-15"; rest = 60;
  } else if(id==="burpee"){ reps = "8-12"; rest = 45; }
  else if(id==="wallball"){ reps = "15-20"; rest = 60; }
  else if(m.pat==="calf"){ reps = ["lose","endurance"].includes(goal) ? "15-20" : "10-15"; rest = 45; }
  else if(load==="bw" && m.role==="c"){ reps = PB_BW_REPS[goal]; if(rest > 90) rest = 90; if(id==="pushup" && lv===0) notes.push("chống gối nếu chưa đủ số lần"); }
  else if(load==="band"){ reps = goal==="endurance" ? "15-25" : "12-20"; if(rest > 75) rest = 60; }
  else if(goal==="strength" && role==="main" && !PB_STR_MAIN.has(id)){
    if(m.uni || !["bar","machine"].includes(load)){ reps = "6-8"; rest = 120; }
    else { reps = lv===0 ? "6-8" : "5-8"; rest = Math.min(rest, 150); }
  }
  else if(goal==="hybrid" && role==="main" && (m.uni || ["db","kb"].includes(load))){ reps = "6-10"; rest = Math.min(rest, 120); }
  if(id==="deadlift" && pbRepTop(reps) > 8){ reps = "5-8"; rest = Math.max(rest, 150); }
  if(m.uni && !m.timed) reps += " mỗi " + m.uni;
  if(m.uni && m.timed) reps += " mỗi " + m.uni;
  /* Buổi ngắn: rút nghỉ để giữ đủ bài đa khớp */
  if(ctx.minutes <= 30){
    const cap = role==="main" ? (goal==="strength" ? 120 : 75) : role==="sec" ? 60 : 40;
    rest = Math.min(rest, cap);
  } else if(ctx.minutes <= 45 && role==="main"){
    rest = Math.min(rest, goal==="strength" ? 180 : 120);
  }
  return { reps, rest, notes };
}

function pbDefSets(role, ctx){
  const t = { main:[3,3,4], sec:[3,3,3], acc:[2,3,3], core:[2,3,3], cond:[3,3,3] }[role] || [2,3,3];
  let n = t[ctx.lv];
  if(ctx.goal==="strength" && role==="main") n = [3,4,5][ctx.lv];
  return n;
}
const PB_MAXSETS = { main:5, sec:4, acc:4, core:4, cond:4 };

function pbMkItem(id, slot, sets, ctx, sess){
  const m = PB_EX[id];
  const alt = pbFeasibleAlt(m, ctx.eq) || m.eq[0];
  const rr = pbRepsFor(id, slot.r, ctx, sess && sess.wave, alt);
  const adj = ctx.inj.filter(j=> m.caution[j]);
  /* bài cần điều chỉnh vì chấn thương: dùng tạ vừa, ≥ 10 lần (an toàn hơn tạ nặng) */
  if(adj.length && (slot.r==="main"||slot.r==="sec") && !m.timed && !m.dist && pbRepTop(rr.reps) < 12){
    rr.reps = "10-15" + (m.uni ? " mỗi " + m.uni : "");
  }
  /* ghi chú an toàn luôn đứng trước ghi chú dụng cụ */
  const notes = [];
  adj.forEach(j=>{ if(!notes.includes(m.caution[j])) notes.push(m.caution[j]); });
  rr.notes.forEach(n=> notes.push(n));
  if(m.eqNote[alt] && (!ctx.gym || alt!=="bw")) notes.push(m.eqNote[alt]);
  const it = { id, kind:"lift", pat:m.pat, slotPat:slot.p, role:slot.r, imp:slot.imp, focus:!!slot.focus,
    sets, reps:[rr.reps].concat(notes.slice(0,3)).join(" · "), restSec:rr.rest, alt, load:alt.split("+")[0], adj };
  return it;
}
function pbCardioItem(id, ck, min, opts){
  opts = opts || {};
  const m = PB_EX[id]; let sets = 1, reps, total = Math.max(3, Math.round(min));
  if(ck==="int" && PB_INT[id]){
    const [proto, txt] = PB_INT[id];
    sets = Math.min(PB_INT_MAXR[proto] || 8, Math.max(2, Math.round(total/proto))); total = sets*proto; reps = txt;
  } else {
    reps = (PB_Z2[id] || PB_Z2.zone2)(total);
    if(opts.light) reps = `${total} phút Zone 2 nhẹ · thả lỏng`;
  }
  const notes = [];
  if(opts.ctx) opts.ctx.inj.forEach(j=>{ if(m && m.caution[j]) notes.push(m.caution[j]); });
  if(notes.length) reps += " · " + notes[0];
  return { id, kind:"cardio", ck, pat:"cardio", slotPat:"cardio", role:"cardio", imp:6, sets, reps, restSec:0, min:total,
    fin:!!opts.fin, light:!!opts.light, load:"bw", adj:[] };
}
function pbStretchItem(min){
  const m = Math.max(3, Math.round(min));
  return { id:"stretch", kind:"mob", pat:"mob", slotPat:"mob", role:"mob", imp:7, sets:1, reps:`${m} phút`, restSec:0, min:m, load:"bw", adj:[] };
}

/* ---- Ước lượng thời gian ---- */
function pbWorkSec(it){
  const m = PB_EX[it.id] || {};
  const r = String(it.reps||"");
  let s;
  const g = r.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*giây/);
  const d = r.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*m(?:\s|$)/);
  if(g) s = Number(g[2]||g[1]);
  else if(d) s = Number(d[2]||d[1]) * (it.id==="sledpush" ? 1.5 : 0.9);
  else s = (pbRepTop(r) || 10) * (it.load==="bw" ? 2.6 : 3.2);
  if(m.uni) s *= 2;
  return Math.max(15, s);
}
function pbItemSec(it, ramp){
  if(it.kind==="cardio" || it.kind==="mob") return (it.min||5)*60 + 30;
  return it.sets*(pbWorkSec(it) + (it.restSec||0)*1.1) + 60 + (ramp||0);
}
const PB_RAMP = [120, 150, 180];
function pbSessSec(items, ctx){
  let sec = PB_WARMUP_MIN*60, first = true;
  items.forEach(it=>{
    let ramp = 0;
    if(it.kind==="lift" && it.role==="main" && !["bw","band"].includes(it.load)){
      ramp = first ? PB_RAMP[ctx.lv] + (ctx.goal==="strength" ? 60 : 0) : 45; first = false;
    }
    sec += pbItemSec(it, ramp);
  });
  return sec;
}
function pbSpare(s, ctx){ return ctx.minutes*60 - pbSessSec(s.items, ctx); }
function pbSetCost(it){ return pbWorkSec(it) + (it.restSec||0)*1.1; }

/* ---- Chấm điểm chọn bài ---- */
function pbScore(id, slot, ctx, week){
  const m = PB_EX[id], alt = pbFeasibleAlt(m, ctx.eq) || "", load = alt.split("+")[0];
  let s = m.pref || 0;
  const role = slot.r;
  if(ctx.goal==="strength"){ if(m.heavy) s += role==="main" ? 5 : 2; if(load==="bar") s += 2; else if(load==="machine") s += 1; }
  if(ctx.goal==="hybrid" && m.heavy && role==="main") s += 2.5;
  if((ctx.goal==="gain"||ctx.goal==="tone") && (load==="machine"||load==="cable")) s += 1;
  if((ctx.goal==="gain") && m.heavy && ctx.lv>=1 && role==="main") s += 1.5;
  if(slot.wave==="volume" && m.heavy && ctx.goal!=="strength") s -= 2.5;
  if(["lose","endurance","hybrid"].includes(ctx.goal) && (load==="db"||load==="kb")) s += .5;
  if(ctx.lv===0){ s -= (m.diff-1)*2.5; if(load==="machine") s += 1; if(id==="pushup") s -= 1; }
  else if(id==="inclinepushup") s -= 1.5;
  if(ctx.lv===2 && m.heavy) s += 1;
  if(Object.keys(m.m).some(k=> m.m[k]>=1 && ctx.fm.has(k))) s += 1.5;
  const u = (week && week.used[id]) || 0;
  if(u) s -= (ctx.goal==="strength" && role==="main" && m.heavy) ? 0 : (role==="main" ? 1.5 : 3)*u;
  if(m.cond && (role==="main"||role==="sec") && ["gain","strength","tone"].includes(ctx.goal)) s -= 3;
  if(id==="deadlift" && role!=="main") s -= 4;
  if(m.eqNote[alt] && (alt==="bw" ? !ctx.gym : true) && alt!==m.eq[0]) s -= 1;
  if(ctx.inj.some(j=> m.caution[j])) s -= .5;
  if(ctx.gym && load==="bw" && m.pat!=="core" && m.role!=="cardio" && m.role!=="cond") s -= 2;
  if((role==="main"||role==="sec") && m.role!=="c") s -= 2;
  return s;
}
function pbCands(pat, ctx, used){
  return Object.keys(PB_EX).filter(id=> PB_EX[id].pat===pat && !(used && used.has(id)) && pbFeasible(id, ctx));
}
function pbPick(slot, ctx, used, week, noFallback){
  const chain = noFallback ? [slot.p] : (PB_FALLBACK[slot.p] || [slot.p]);
  for(let ci=0; ci<chain.length; ci++){
    const c = pbCands(chain[ci], ctx, used);
    if(!c.length) continue;
    c.sort((a,b)=> (pbScore(b,slot,ctx,week) - pbScore(a,slot,ctx,week)) || (PB_ORDER[a]-PB_ORDER[b]));
    return { id:c[0], fb:ci>0 };
  }
  return null;
}
function pbPickCardio(kind, ctx, used, week, opts){
  opts = opts || {};
  const pool = kind==="int" ? Object.keys(PB_INT) : Object.keys(PB_Z2);
  const c = pool.filter(id=> !(used && used.has(id)) && pbFeasible(id, ctx) && (kind!=="int" || (opts.fin
    ? (id!=="intervalwalk" && PB_INT[id][0] <= Math.max(1, opts.max||3))
    : id!=="mountainclimber")));
  const sc = id=>{
    let s = 0, lv = ctx.lv, g = ctx.goal;
    if(kind==="int"){
      s += { rowing:2, running:(g==="endurance"||g==="hybrid") ? 2 : .8, jumprope:1, mountainclimber:.5, intervalwalk:lv===0 ? 3 : .3 }[id] || 0;
    } else {
      s += { zone2:2, inclinewalk:(g==="lose"||g==="tone") ? 1.8 : .5, walking:(lv===0 && !ctx.gym) ? 2.5 : (lv===0 ? 1 : .4),
             running:(g==="endurance"||g==="hybrid") && lv>0 ? 2.2 : 0, rowing:g==="hybrid" ? 1 : 0 }[id] || 0;
    }
    if(ctx.inj.some(j=> PB_EX[id].caution[j])) s -= .3;
    s -= ((week && week.cardio[id]) || 0) * 1.2;
    return s;
  };
  c.sort((a,b)=> sc(b)-sc(a) || PB_ORDER[a]-PB_ORDER[b]);
  return c[0] || null;
}

/* =========================================================================
   5. CHỌN KIỂU CHIA BUỔI & SẮP XẾP TUẦN
   ========================================================================= */
function pbSplit(a, ctx){
  const n = a.days.length, g = a.goal, lv = ctx.lv;
  let cd = PB_CARDIO_DAYS[g][n] || 0;
  let begCap = false;
  if(lv===0 && n - cd > 4){ cd = n - 4; begCap = true; }
  const s = n - cd;
  let key;
  if(s<=1) key = "fb1";
  else if(s===2) key = "fb2";
  else if(s===3) key = (lv===0 || ["lose","endurance","hybrid"].includes(g)) ? "fb3" : "ulf";
  else if(s===4) key = "ul4";
  else if(s===5) key = "ulppl";
  else key = "ppl6";
  /* Dụng cụ hạn chế: buổi Kéo/Đẩy riêng sẽ quá ít bài → chuyển sang Upper/Lower */
  let poor = false;
  if(key==="ulppl" || key==="ppl6"){
    const n = pats=> Object.keys(PB_EX).filter(id=> pats.includes(PB_EX[id].pat) && pbFeasible(id, ctx)).length;
    if(n(["hpull","vpull","rear","biceps"]) < 4 || n(["hpush","vpush","fly","triceps","latraise"]) < 4){ key = key==="ulppl" ? "ul5" : "ul6"; poor = true; }
  }
  const seqC = PB_CARDIO_SEQ[g];
  const cardio = Array.from({length:cd}, (_,i)=> seqC[i % seqC.length]);
  const strength = PB_SPLITS[key].seq.slice(0, Math.max(1, s));
  /* sóng nặng / khối lượng (người đã có kinh nghiệm) */
  const waves = strength.map((k,i)=>{
    if(lv===0 || !["gain","tone","strength"].includes(g)) return "normal";
    if(key==="ul4") return i<2 ? "heavy" : "volume";
    if(key==="ulppl") return i<2 ? "heavy" : "volume";
    if(key==="ul5") return i<2 ? "heavy" : i<4 ? "volume" : "normal";
    if(key==="ul6") return i%2===0 && i<4 ? "heavy" : i<4 ? "heavy" : "volume";
    if(key==="ppl6") return i<3 ? "heavy" : "volume";
    if(key==="fb3"||key==="ulf") return i===0 ? "heavy" : i===2 ? "volume" : "normal";
    if(key==="fb2") return i===0 ? "heavy" : "volume";
    return "normal";
  });
  return { key, name:PB_SPLITS[key].name, s:strength.length, cd, cardio, strength, waves, begCap, poor };
}
function pbAdjPen(a, b){
  if(!a || !b) return 0;
  if(a.type==="cardio" && b.type==="cardio") return (a.ck==="int" && b.ck==="int") ? 1 : .2;
  if(a.type==="cardio" || b.type==="cardio"){
    const c = a.type==="cardio" ? a : b, s = a.type==="cardio" ? b : a;
    const lower = PB_REG[s.kind].L;
    return c.ck==="int" ? (lower ? 1.2 : .4) : c.ck==="long" ? (lower ? .6 : .2) : .1;
  }
  const A = PB_REG[a.kind], B = PB_REG[b.kind];
  let p = .3;
  if(A.L && B.L) p += 3;
  if(A.U && B.U){
    const pp = (a.kind==="push" && b.kind==="pull") || (a.kind==="pull" && b.kind==="push");
    p += pp ? .3 : 2;
  }
  return p;
}
function pbCombos(n, k){
  const out = [];
  const rec = (start, acc)=>{ if(acc.length===k){ out.push(acc.slice()); return; } for(let i=start;i<n;i++){ acc.push(i); rec(i+1, acc); acc.pop(); } };
  rec(0, []); return out;
}
function pbPerms(arr){
  if(arr.length<=1) return [arr.slice()];
  const out = [], seen = new Set();
  arr.forEach((x,i)=>{ pbPerms(arr.slice(0,i).concat(arr.slice(i+1))).forEach(p=>{ const q=[x].concat(p), key=q.join(","); if(!seen.has(key)){ seen.add(key); out.push(q); } }); });
  return out;
}
function pbArrange(sp, days){
  const n = days.length, idx = days.map(d=> DAY_KEYS.indexOf(d));
  const sDefs = sp.strength.map((k,i)=> ({ type:"strength", key:k, kind:PB_SESS[k].kind, wave:sp.waves[i] }));
  const cDefs = sp.cardio.map(ck=> ({ type:"cardio", ck }));
  let best = null;
  const evalSlots = slots=>{
    let p = 0;
    for(let i=0;i<7;i++){
      const a = slots[i], b = slots[(i+1)%7];
      if(!a || !b) continue;
      p += pbAdjPen(a, b) * (i===6 ? .5 : 1);
    }
    let run = 0;
    for(let i=0;i<7;i++){ if(slots[i]){ run++; if(run>3) p += 1; } else run = 0; }
    return p;
  };
  const rotations = sDefs.length ? sDefs.map((_,r)=> sDefs.slice(r).concat(sDefs.slice(0,r))) : [[]];
  const cPerms = pbPerms(cDefs);
  pbCombos(n, sDefs.length).forEach(pos=>{
    const rest = Array.from({length:n},(_,i)=>i).filter(i=> !pos.includes(i));
    rotations.forEach((rot, ri)=>{
      cPerms.forEach(cp=>{
        const slots = new Array(7).fill(null);
        pos.forEach((pi,j)=> slots[idx[pi]] = rot[j]);
        rest.forEach((pi,j)=> slots[idx[pi]] = cp[j]);
        const pen = evalSlots(slots) + ri*.01;
        if(!best || pen < best.pen - 1e-9) best = { pen, slots };
      });
    });
  });
  const warnings = [];
  const sl = best.slots;
  for(let i=0;i<6;i++){
    const a = sl[i], b = sl[i+1];
    if(a && b && a.type==="strength" && b.type==="strength"){
      const A = PB_REG[a.kind], B = PB_REG[b.kind];
      if(A.L && B.L){ warnings.push(`${DAY_LABELS[DAY_KEYS[i]]} và ${DAY_LABELS[DAY_KEYS[i+1]]} đều tập chân liền nhau — nên xen 1 ngày nghỉ nếu có thể.`); }
      else if(A.U && B.U && !((a.kind==="push"&&b.kind==="pull")||(a.kind==="pull"&&b.kind==="push"))){ warnings.push(`${DAY_LABELS[DAY_KEYS[i]]} và ${DAY_LABELS[DAY_KEYS[i+1]]} cùng tập thân trên liền nhau — buổi sau giữ tạ vừa phải.`); }
    }
  }
  return { slots: sl, pen: best.pen, warnings };
}

/* =========================================================================
   6. DỰNG BUỔI TẬP
   ========================================================================= */
function pbApplyFocus(slots, kind, ctx){
  const has = p=> slots.find(s=> s.p===p);
  const bump = (p, imp, r)=>{ const s = has(p); if(s){ s.imp = Math.min(s.imp, imp); s.focus = true; } else slots.push({ p, r:r||"acc", imp, focus:true }); };
  const F = ctx.focus;
  if(F.includes("glutes")){
    if(kind==="lower"||kind==="fb"){ bump("bridge", 1.9, "sec"); bump("gluteiso", 2.6); }
    else if(kind==="upper") bump("gluteiso", 3.9);
  }
  if(F.includes("chest") && (kind==="upper"||kind==="push"||kind==="fb")) bump("fly", 2.5);
  if(F.includes("back") && (kind==="upper"||kind==="pull"||kind==="fb")){
    if(!has("vpull")) bump("vpull", 2.4, "sec"); else if(!has("hpull")) bump("hpull", 2.4, "sec");
    bump("rear", 2.7);
  }
  if(F.includes("shoulders")){
    if(kind==="upper"||kind==="push"||kind==="fb") bump("latraise", 2.4);
    if(kind==="upper"||kind==="pull") bump("rear", 2.6);
  }
  if(F.includes("arms")){
    if(kind==="upper"||kind==="fb"){ bump("biceps", 2.6); bump("triceps", 2.65); }
    if(kind==="push") bump("triceps", 2.5);
    if(kind==="pull") bump("biceps", 2.5);
  }
  if(F.includes("core")){
    bump("core", 1.95, "core");
    if(kind==="lower") slots.push({ p:"core", r:"core", imp:3.0, focus:true });
  } else if(["lose","tone","endurance"].includes(ctx.goal)){
    const c = has("core"); if(c) c.imp = Math.min(c.imp, 2.05);
  }
  slots.sort((a,b)=> a.imp-b.imp);
}
/* Số bài tạ tối đa/buổi (không tính core) theo thời lượng — tránh "nhiều bài × ít hiệp" */
function pbMaxLift(ctx){ return ({30:4, 45:5, 60:6, 75:7})[ctx.minutes] || 6; }
function pbFinMin(ctx){
  const m = ctx.minutes, g = ctx.goal;
  if(g==="lose")      return m>=60 ? 15 : m>=45 ? 10 : 6;
  if(g==="tone")      return m>=60 ? 10 : m>=45 ? 8 : 0;
  if(g==="endurance") return m>=60 ? 15 : m>=45 ? 10 : 6;
  if(g==="hybrid")    return m>=60 ? 12 : m>=45 ? 10 : 6;
  return 0;
}
function pbBuildStrength(def, ctx, day, week){
  const T = PB_SESS[def.key];
  const slots = T.slots.map(s=> Object.assign({}, s));
  pbApplyFocus(slots, T.kind, ctx);
  const waveLbl = def.wave==="heavy" ? " — nặng" : def.wave==="volume" ? " — khối lượng" : "";
  const sess = { day, key:def.key, type:"strength", kind:T.kind, wave:def.wave, title:T.title + waveLbl, why:T.why,
    items:[], finMin:pbFinMin(ctx) };
  let budget = (ctx.minutes - sess.finMin)*60;
  const used = new Set(), items = sess.items;
  const liftN = ()=> items.filter(i=> i.kind==="lift" && i.role!=="core").length;
  const maxLift = pbMaxLift(ctx), maxCore = ctx.fm.has("core") ? 2 : 1;
  /* Pha 1 — đủ mẫu vận động quan trọng trước: bài chính đủ hiệp, bài khác 2 hiệp */
  for(const slot of slots){
    const isCore = slot.r==="core";
    if(isCore ? items.filter(i=> i.role==="core").length >= maxCore : items.filter(i=> i.kind==="lift" && i.role!=="core").length >= maxLift) continue;
    const p = pbPick(Object.assign({ wave:sess.wave }, slot), ctx, used, week);
    if(!p) continue;
    const breadth = ["lose","tone","endurance"].includes(ctx.goal);
    const it = pbMkItem(p.id, slot, (slot.r==="main" && !breadth) ? pbDefSets("main", ctx) : 2, ctx, sess);
    it.fb = p.fb;
    while(it.sets > 2 && !pbSessFits(sess, p.id, it.sets)) it.sets--;
    if(!pbSessFits(sess, p.id, it.sets)) continue;
    items.push(it);
    while(it.sets > 2 && pbSessSec(items, ctx) > budget) it.sets--;
    /* buổi ngắn: luôn giữ ≥ 3 bài tạ — bớt hiệp bài trước, rồi rút phần cardio cuối buổi */
    if(pbSessSec(items, ctx) > budget && !isCore && liftN() <= 3){
      items.filter(x=> x!==it && x.sets>2).sort((a,b)=> b.sets-a.sets || b.imp-a.imp).forEach(o=>{ while(o.sets>2 && pbSessSec(items, ctx) > budget) o.sets--; });
      if(pbSessSec(items, ctx) > budget && sess.finMin > 0){
        const need = Math.ceil((pbSessSec(items, ctx) - budget)/60) + 1;
        sess.finMin = sess.finMin - need >= 4 ? sess.finMin - need : 0;
        budget = (ctx.minutes - sess.finMin)*60;
      }
    }
    if(pbSessSec(items, ctx) > budget){ items.pop(); continue; }
    used.add(p.id); week.used[p.id] = (week.used[p.id]||0) + 1;
  }
  /* Pha 2 — tăng hiệp theo độ quan trọng tới mức mặc định */
  let grew = true;
  while(grew){
    grew = false;
    items.slice().sort((a,b)=> a.imp-b.imp).forEach(it=>{
      if(it.sets >= pbDefSets(it.role, ctx) || !pbSessFits(sess, it.id, 1)) return;
      it.sets++;
      if(pbSessSec(items, ctx) > budget) it.sets--; else grew = true;
    });
  }
  pbAddFinisher(sess, ctx, week);
  return sess;
}
function pbAddFinisher(sess, ctx, week){
  const fm = sess.finMin; if(!fm) return;
  const used = new Set(sess.items.map(i=> i.id));
  const kind = ctx.goal==="hybrid" ? "cond" : (ctx.goal==="endurance" ? "int" : (ctx.lv===0 ? "z2" : "int"));
  if(kind==="cond"){
    const cands = Object.keys(PB_EX).filter(id=> (PB_EX[id].pat==="cond" || PB_EX[id].cond) && !used.has(id) && pbFeasible(id, ctx) && id!=="mountainclimber");
    const pr = { kbswing:3, farmercarry:2.5, sledpush:2.2, wallball:2, burpee:1 };
    cands.sort((a,b)=> (pr[b]||0)-(pr[a]||0) - ((week.used[b]||0)-(week.used[a]||0))*1.5 || PB_ORDER[a]-PB_ORDER[b]);
    let left = fm*60, added = 0;
    for(const id of cands){
      if(added>=2 || left < 150) break;
      const it = pbMkItem(id, { p:PB_EX[id].pat, r:"cond", imp:5 }, 3, ctx, sess);
      it.role = "cond"; it.fin = true;
      while(it.sets>2 && pbItemSec(it,0) > left) it.sets--;
      if(pbItemSec(it,0) > left + 30 || !pbSessFits(sess, id, it.sets)) continue;
      sess.items.push(it); left -= pbItemSec(it,0); added++; week.used[id] = (week.used[id]||0)+1;
    }
    if(added) return;
  }
  if(kind!=="z2"){
    const id = pbPickCardio("int", ctx, used, week, { fin:true, max: fm>=10 ? 3 : 2 });
    if(id){ sess.items.push(pbCardioItem(id, "int", fm, { fin:true, ctx })); week.cardio[id] = (week.cardio[id]||0)+1; return; }
  }
  const z = pbPickCardio("z2", ctx, used, week);
  if(z){ sess.items.push(pbCardioItem(z, "z2", fm, { fin:true, ctx })); week.cardio[z] = (week.cardio[z]||0)+1; }
}
function pbBuildCardio(def, ctx, day, week){
  const M = ctx.minutes, lv = ctx.lv;
  const gentle = ["gain","strength"].includes(ctx.goal);
  let stretchMin = M>=60 ? (gentle && M>=75 ? 10 : 8) : 5;
  /* buổi phục hồi chủ động (tăng cơ/sức mạnh) chỉ cần 30–40 phút Zone 2 */
  const main = gentle ? Math.min(40, M - PB_WARMUP_MIN - stretchMin - 1) : M - PB_WARMUP_MIN - stretchMin - 1;
  const titles = { z2: gentle ? "Cardio nhẹ · phục hồi chủ động" : "Cardio Zone 2", int:"Interval tim mạch", long:"Zone 2 dài — sức bền" };
  const whys = {
    z2: gentle ? "Ngày xen giữa các buổi tạ: Zone 2 nhẹ giúp hồi phục, tim mạch khoẻ mà không ảnh hưởng tăng cơ/sức mạnh."
               : "Nhịp tim 60–70% tối đa: xây nền tim mạch, đốt mỡ, hồi phục tốt và không làm mệt buổi tạ hôm sau.",
    int:"Xen kẽ nhanh/chậm: cải thiện VO2max và đốt năng lượng trong thời gian ngắn.",
    long:"Buổi bền dài nhất tuần — tăng sức bền nền, tập ở nhịp vẫn nói chuyện được." };
  const sess = { day, key:def.ck, type:"cardio", kind:"cardio", ck:def.ck, title:titles[def.ck], why:whys[def.ck], items:[], finMin:0,
    intensity: def.ck==="int" ? (lv===2 ? "Rất cao" : "Cao") : def.ck==="long" ? "Vừa" : "Thấp" };
  const used = new Set();
  if(def.ck==="int"){
    const id = pbPickCardio("int", ctx, used, week);
    if(id){
      const proto = PB_INT[id][0];
      const block = proto>=5 ? main : Math.min(main, [14,18,22][lv]);
      const rounds = Math.min(PB_INT_MAXR[proto] || 8, Math.max(2, Math.floor(block/proto)));
      const it = pbCardioItem(id, "int", rounds*proto, { ctx }); sess.items.push(it); used.add(id);
      week.cardio[id] = (week.cardio[id]||0)+1;
      let rem = main - it.min;
      if(rem >= 5){ const z = pbPickCardio("z2", ctx, used, week); if(z){ sess.items.push(pbCardioItem(z, "z2", rem, { ctx, light:true })); rem = 0; } }
      stretchMin += Math.max(0, rem);
    } else {
      const z = pbPickCardio("z2", ctx, used, week);
      if(z) sess.items.push(pbCardioItem(z, "z2", main, { ctx }));
      sess.title = titles.z2;
    }
  } else {
    const z = pbPickCardio("z2", ctx, used, week);
    if(z){ sess.items.push(pbCardioItem(z, "z2", main, { ctx })); week.cardio[z] = (week.cardio[z]||0)+1; }
  }
  sess.items.push(pbStretchItem(stretchMin));
  return sess;
}

/* =========================================================================
   7. CÂN BẰNG KHỐI LƯỢNG TUẦN, ĐẨY/KÉO, THỜI GIAN
   ========================================================================= */
function pbVolume(prog){
  const v = {}; PB_MK.forEach(k=> v[k] = 0);
  prog.sessions.forEach(s=> s.items.forEach(it=>{
    if(it.kind!=="lift") return;
    const m = PB_EX[it.id]; if(!m) return;
    Object.keys(m.m).forEach(k=>{ v[k] += m.m[k]*it.sets; });
  }));
  PB_MK.forEach(k=> v[k] = Math.round(v[k]*4)/4);
  return v;
}
function pbSessFits(s, id, n){
  const m = PB_EX[id]; if(!m) return false;
  return Object.keys(m.m).every(j=> pbSessMuscle(s, j) + m.m[j]*n <= PB_SESS_MUSCLE_CAP + 1e-9);
}
function pbSessMuscle(s, k){ let t = 0; s.items.forEach(it=>{ if(it.kind==="lift") t += ((PB_EX[it.id]||{m:{}}).m[k]||0)*it.sets; }); return t; }
function pbPushPull(prog){
  let push = 0, pull = 0;
  prog.sessions.forEach(s=> s.items.forEach(it=>{
    if(it.kind!=="lift") return;
    if(PB_PUSH.has(it.pat)) push += it.sets; else if(PB_PULL.has(it.pat)) pull += it.sets;
  }));
  return { push, pull, ratio: push ? Math.round(pull/push*100)/100 : null };
}
function pbCapsOk(meta, n, vol, k, T){
  for(const j of Object.keys(meta.m)){
    const nv = vol[j] + meta.m[j]*n;
    if(nv > PB_HARD_CAP + 1e-9) return false;
    if(j===k && T[k] && nv > T[k] + 4) return false;
  }
  return true;
}
function pbLiftCount(s){ return s.items.filter(i=> i.kind==="lift" && !i.fin).length; }

function pbRebalance(prog, ctx, week){
  const T = ctx.targets;
  const SS = prog.sessions.filter(s=> s.type==="strength");
  if(!SS.length) return;
  const trimMuscle = (k, limit, soft)=>{
    for(let guard=0; guard<60; guard++){
      const vol = pbVolume(prog);
      if(vol[k] <= limit + 1e-9) return;
      let best = null;
      SS.forEach(s=> s.items.forEach(it=>{
        if(it.kind!=="lift" || it.fin) return;
        const w = (PB_EX[it.id].m[k]||0); if(!w) return;
        const minS = 2;
        if(it.sets <= minS) return;
        if(soft){
          const harm = Object.keys(PB_EX[it.id].m).some(j=> j!==k && T[j] && vol[j] - PB_EX[it.id].m[j] < T[j] - .01);
          if(harm) return;
        }
        const key = (it.role==="main" ? 30 : it.role==="sec" ? 20 : 10) - it.sets - w*5;
        if(!best || key < best.key) best = { it, key };
      }));
      if(best){ best.it.sets--; continue; }
      /* không giảm hiệp được → bỏ 1 bài phụ của nhóm cơ này */
      let rm = null;
      SS.forEach(s=>{ if(pbLiftCount(s) <= 3) return; s.items.forEach((it,i)=>{
        if(it.kind!=="lift" || it.fin || it.role==="main") return;
        if((PB_EX[it.id].m[k]||0) < 1) return;
        if(soft && Object.keys(PB_EX[it.id].m).some(j=> j!==k && T[j] && vol[j] - PB_EX[it.id].m[j]*it.sets < T[j])) return;
        if(!rm || it.imp > rm.it.imp) rm = { s, i, it };
      }); });
      if(rm){ rm.s.items.splice(rm.i, 1); continue; }
      return;
    }
  };
  const tryAddSet = k=>{
    const vol = pbVolume(prog);
    let best = null;
    SS.forEach(s=>{
      const sp = pbSpare(s, ctx);
      s.items.forEach(it=>{
        if(it.kind!=="lift" || it.fin) return;
        const m = PB_EX[it.id]; if((m.m[k]||0) < 1) return;
        if(!pbSessFits(s, it.id, 1)) return;
        if(it.sets >= (PB_MAXSETS[it.role]||4)) return;
        if(sp < pbSetCost(it) + 15) return;
        if(!pbCapsOk(m, 1, vol, k, T)) return;
        const key = it.sets + (it.role==="main" && ctx.goal!=="strength" ? .5 : 0) - sp/6000;
        if(!best || key < best.key) best = { it, key };
      });
    });
    if(best){ best.it.sets++; return true; }
    return false;
  };
  const tryAddEx = k=>{
    const vol = pbVolume(prog);
    const kinds = PB_COMPAT[k].slice();
    if(k==="glutes" && ctx.fm.has("glutes")) kinds.push("upper");
    const order = SS.slice().sort((a,b)=> pbSpare(b, ctx) - pbSpare(a, ctx));
    for(const pat of PB_ADD_PAT[k]){
      for(const s of order){
        if(!kinds.includes(s.kind) || pbLiftCount(s) >= pbMaxLift(ctx) + 1) continue;
        const used = new Set(s.items.map(i=> i.id));
        const p = pbPick({ p:pat, r:"acc", imp:3.9 }, ctx, used, week, true);
        if(!p || !pbSessFits(s, p.id, 2)) continue;
        const m = PB_EX[p.id];
        const role = m.role==="c" ? "sec" : (m.role==="core" ? "core" : "acc");
        const it = pbMkItem(p.id, { p:pat, r:role, imp:3.9, focus:ctx.fm.has(k) }, 2, ctx, s);
        it.added = true;
        if(pbSpare(s, ctx) < pbItemSec(it, 0) + 15) continue;
        if(!pbCapsOk(m, 2, vol, k, T)) continue;
        s.items.push(it); week.used[p.id] = (week.used[p.id]||0)+1;
        return true;
      }
    }
    return false;
  };
  /* A. cắt phần vượt trần */
  PB_MK.forEach(k=> trimMuscle(k, PB_HARD_CAP, false));
  PB_MK.forEach(k=>{ if(T[k]) trimMuscle(k, T[k]+4, true); });
  /* B. bù nhóm cơ thiếu khối lượng (thiếu nhiều nhất trước) */
  for(let iter=0; iter<240; iter++){
    const vol = pbVolume(prog);
    const defs = PB_MK.filter(k=> T[k]>0 && T[k]-vol[k] >= 1).sort((a,b)=> (T[b]-vol[b])/T[b] - (T[a]-vol[a])/T[a]);
    let done = false;
    for(const k of defs){ if(tryAddSet(k) || tryAddEx(k)){ done = true; break; } }
    if(!done) break;
  }
  /* C. cân bằng đẩy / kéo: kéo/đẩy trong khoảng 0,9–1,5 */
  const addPat = (set)=>{
    const vol = pbVolume(prog);
    let best = null;
    SS.forEach(s=>{ const sp = pbSpare(s, ctx); s.items.forEach(it=>{
      if(it.kind!=="lift" || it.fin || !set.has(it.pat)) return;
      if(it.sets >= (PB_MAXSETS[it.role]||4) || sp < pbSetCost(it) + 15) return;
      if(!pbCapsOk(PB_EX[it.id], 1, vol, null, T) || !pbSessFits(s, it.id, 1)) return;
      const key = it.sets - sp/6000; if(!best || key < best.key) best = { it, key };
    }); });
    if(best){ best.it.sets++; return true; }
    for(const s of SS.slice().sort((a,b)=> pbSpare(b,ctx)-pbSpare(a,ctx))){
      if(pbLiftCount(s) >= pbMaxLift(ctx) + 1) continue;
      const kinds = set===PB_PULL ? ["upper","pull","fb"] : ["upper","push","fb"];
      if(!kinds.includes(s.kind)) continue;
      const used = new Set(s.items.map(i=> i.id));
      for(const pat of (set===PB_PULL ? ["hpull","rear","vpull"] : ["hpush","fly","vpush"])){
        const p = pbPick({ p:pat, r:"acc", imp:3.95 }, ctx, used, week, true); if(!p || !pbSessFits(s, p.id, 2)) continue;
        const m = PB_EX[p.id];
        const it = pbMkItem(p.id, { p:pat, r: m.role==="c" ? "sec" : "acc", imp:3.95 }, 2, ctx, s); it.added = true;
        if(pbSpare(s, ctx) < pbItemSec(it,0) + 15 || !pbCapsOk(m, 2, vol, null, T)) continue;
        s.items.push(it); week.used[p.id] = (week.used[p.id]||0)+1; return true;
      }
    }
    return false;
  };
  const cutPat = (set)=>{
    let best = null;
    SS.forEach(s=> s.items.forEach((it,i)=>{
      if(it.kind!=="lift" || it.fin || !set.has(it.pat)) return;
      if(it.sets > 2){ const key = (it.role==="main" ? 20 : 0) - it.sets + (it.role==="acc" ? -5 : 0); if(!best || key < best.key) best = { it, key }; }
    }));
    if(best){ best.it.sets--; return true; }
    let rm = null;
    SS.forEach(s=>{ if(pbLiftCount(s) <= 3) return; s.items.forEach((it,i)=>{ if(it.kind==="lift" && !it.fin && set.has(it.pat) && it.role!=="main" && (!rm || it.imp > rm.it.imp)) rm = { s, i, it }; }); });
    if(rm){ rm.s.items.splice(rm.i, 1); return true; }
    return false;
  };
  for(let iter=0; iter<60; iter++){
    const pp = pbPushPull(prog);
    if(!pp.push || !pp.pull) break;
    const r = pp.pull/pp.push;
    if(r < .9){ if(!addPat(PB_PULL) && !cutPat(PB_PUSH)) break; }
    else if(r > 1.5){ if(!addPat(PB_PUSH) && !cutPat(PB_PULL)) break; }
    else break;
  }
  PB_MK.forEach(k=> trimMuscle(k, PB_HARD_CAP, false));
}
function pbFillTime(prog, ctx, week){
  prog.sessions.filter(s=> s.type==="strength").forEach(s=>{
    let sp = pbSpare(s, ctx)/60;
    const used = new Set(s.items.map(i=> i.id));
    if(sp >= 4 && ["lose","endurance","hybrid","tone"].includes(ctx.goal)){
      const f = s.items.find(i=> i.kind==="cardio" && i.fin);
      if(f){
        const add = Math.min(Math.floor(sp - 3), 10);
        if(add >= 3){
          const idx = s.items.indexOf(f);
          const nf = pbCardioItem(f.id, f.ck, f.min + add, { fin:true, ctx });
          if(nf.min > f.min){ s.items[idx] = nf; sp -= (nf.min - f.min); }
        }
      }
    }
    /* còn dư nhiều: thêm hiệp cho bài tạ (trong trần an toàn) trước khi thêm cardio nhẹ */
    if(sp >= 8){
      const T = ctx.targets;
      for(let guard=0; guard<30 && sp >= 8; guard++){
        const vol = pbVolume(prog), pp = pbPushPull(prog);
        const ppOk = it=> PB_PUSH.has(it.pat) ? (!pp.pull || pp.pull/(pp.push+1) >= .95) : PB_PULL.has(it.pat) ? (!pp.push || (pp.pull+1)/pp.push <= 1.4) : true;
        const cand = s.items.filter(it=> it.kind==="lift" && !it.fin && it.sets < (PB_MAXSETS[it.role]||4) && pbSessFits(s, it.id, 1) && ppOk(it) &&
          Object.keys(PB_EX[it.id].m).every(j=> vol[j] + PB_EX[it.id].m[j] <= Math.min(PB_HARD_CAP, (T[j]||0) + 4) + 1e-9))
          .sort((a,b)=> a.sets - b.sets || a.imp - b.imp)[0];
        if(!cand) break;
        cand.sets++; sp = pbSpare(s, ctx)/60;
      }
    }
    if(sp >= 10){
      const z = pbPickCardio("z2", ctx, used, week);
      if(z){ const mins = Math.min(20, Math.floor(sp - 5)); s.items.push(pbCardioItem(z, "z2", mins, { fin:true, light:true, ctx })); sp -= mins + .5; }
    }
    if(sp >= 4){ const mins = Math.min(10, Math.floor(sp - .5)); if(mins >= 3) s.items.push(pbStretchItem(mins)); }
  });
}
/* Chốt cân bằng đẩy/kéo: chỉ bớt hiệp ở phía dư (không tốn thêm thời gian) */
function pbPPCut(prog){
  for(let guard=0; guard<40; guard++){
    const pp = pbPushPull(prog);
    if(!pp.push || !pp.pull) return;
    const r = pp.pull/pp.push;
    const set = r < .9 ? PB_PUSH : r > 1.5 ? PB_PULL : null;
    if(!set) return;
    const it = prog.sessions.flatMap(s=> s.items).filter(i=> i.kind==="lift" && !i.fin && set.has(i.pat) && i.sets > 2)
      .sort((a,b)=> (a.role==="main")-(b.role==="main") || b.sets-a.sets || b.imp-a.imp)[0];
    if(!it) return;
    it.sets--;
  }
}
function pbFinalTrim(prog, ctx){
  prog.sessions.filter(s=> s.type==="strength").forEach(s=>{
    for(let guard=0; guard<40 && pbSessSec(s.items, ctx) > (ctx.minutes+2)*60; guard++){
      const st = s.items.find(i=> i.kind==="mob");
      if(st){ if(st.min > 3){ const n = pbStretchItem(st.min-1); s.items[s.items.indexOf(st)] = n; } else s.items.splice(s.items.indexOf(st),1); continue; }
      const cf = s.items.filter(i=> i.kind==="cardio" && i.fin).sort((a,b)=> b.min-a.min)[0];
      if(cf && cf.min > 4){ s.items[s.items.indexOf(cf)] = pbCardioItem(cf.id, cf.ck, cf.min - (cf.ck==="int" ? (PB_INT[cf.id]||[1])[0] : 2), { fin:true, light:cf.light, ctx }); continue; }
      const lifts = s.items.filter(i=> i.kind==="lift" && i.sets > 2).sort((a,b)=> (a.role==="main")-(b.role==="main") || b.imp-a.imp);
      if(lifts.length){ lifts[0].sets--; continue; }
      const rmv = s.items.filter(i=> i.kind==="lift" && i.role!=="main").sort((a,b)=> b.imp-a.imp)[0];
      if(rmv && pbLiftCount(s) > 3){ s.items.splice(s.items.indexOf(rmv),1); continue; }
      if(cf){ s.items.splice(s.items.indexOf(cf),1); continue; }
      break;
    }
  });
}
function pbRank(it){
  if(it.kind==="mob") return 7;
  if(it.kind==="cardio") return 6;
  if(it.role==="cond" || it.fin) return 5;
  if(it.role==="main") return 0;
  const m = PB_EX[it.id];
  if(m.role==="c") return 1;
  if(m.role==="i") return 2;
  if(m.role==="core") return 3;
  return 4;
}
function pbSortItems(s){ s.items.sort((a,b)=> pbRank(a)-pbRank(b) || a.imp-b.imp); }
function pbStats(prog){
  const ctx = prog.ctx;
  prog.sessions.forEach(s=>{
    pbSortItems(s);
    s.est = Math.round(pbSessSec(s.items, ctx)/60);
    if(s.type==="strength") s.intensity = ctx.goal==="endurance" ? "Vừa" : s.wave==="heavy" ? "Cao" : ctx.lv===0 ? "Vừa" : (s.wave==="volume" ? "Vừa" : "Cao");
  });
  prog.volume = pbVolume(prog);
  prog.pp = pbPushPull(prog);
  prog.weekMin = prog.sessions.reduce((t,s)=> t + s.est, 0);
  return prog;
}

/* ---- Lý giải "vì sao" ---- */
function pbWhyItem(it, ctx){
  if(it.kind==="mob") return "Giãn cơ hạ nhịp tim, giảm cứng cơ sau buổi tập.";
  if(it.kind==="cardio"){
    if(it.light) return "Dùng thời gian còn dư: Zone 2 nhẹ tốt cho tim mạch & phục hồi.";
    if(it.fin) return it.ck==="int" ? "Interval cuối buổi: đốt thêm năng lượng, tăng sức bền." : "Zone 2 cuối buổi: đốt mỡ nhẹ nhàng, không ảnh hưởng hồi phục.";
    return it.ck==="int" ? "Bài interval chính của buổi." : "Bài cardio chính, giữ nhịp đều.";
  }
  const m = PB_EX[it.id];
  const parts = [PB_PAT_LABEL[m.pat] || ""];
  if(it.fin) parts.push("thể lực cuối buổi");
  else if(it.role==="main") parts.push("bài chính, tập khi còn sung sức");
  else if(m.role==="c") parts.push("đa khớp bổ trợ");
  else if(m.role==="i") parts.push("cô lập, bù khối lượng");
  else if(m.role==="core") parts.push("giữ thân vững");
  const fk = Object.keys(m.m).filter(k=> m.m[k]>=1 && ctx.fm.has(k));
  if(fk.length) parts.push("ưu tiên " + fk.map(k=> PB_MLABEL[k].toLowerCase()).join(", "));
  if(it.slotPat && it.slotPat!==m.pat && PB_PAT_LABEL[it.slotPat]) parts.push("thay " + PB_PAT_LABEL[it.slotPat].toLowerCase() + " (dụng cụ/chấn thương)");
  if(it.adj && it.adj.length) parts.push("đã chỉnh cho " + it.adj.map(j=> (PB_INJ.find(x=>x.id===j)||{}).label.toLowerCase()).join(", "));
  return parts.filter(Boolean).join(" · ");
}
function pbShortName(id){ const n = (EXERCISES[id]||{}).name || id; return n.replace(/\s*\(.*\)\s*$/, ""); }
function pbReasons(prog){
  const ctx = prog.ctx, a = prog.answers, sp = prog.split, T = ctx.targets, out = [];
  const nS = sp.s, nC = sp.cd;
  const splitWhy = {
    fb1:"1 buổi tạ toàn thân giữ sức mạnh nền, phần lớn thời gian dành cho cardio đúng mục tiêu sức bền.",
    fb2:"2 buổi tạ → Toàn thân A/B: mỗi nhóm cơ vẫn được tập 2 lần/tuần — tần suất tối thiểu nên có để tăng cơ & sức mạnh.",
    fb3:"3 buổi tạ → Toàn thân A/B/C: mỗi nhóm cơ 3 lần/tuần, mỗi buổi ít hiệp → học kỹ thuật nhanh, hồi phục tốt.",
    ulf:"3 buổi cho người đã có nền: Thân trên / Thân dưới / Toàn thân — mỗi nhóm cơ 2 lần/tuần, buổi nào cũng tập trung.",
    ul4:"4 buổi tạ → Thân trên/Thân dưới ×2: kiểu chia phổ biến nhất, mỗi nhóm cơ 2 lần/tuần" + (ctx.lv>0 && ["gain","tone","strength"].includes(ctx.goal) ? ", buổi A thiên nặng, buổi B thiên khối lượng." : "."),
    ulppl:"5 buổi tạ → Trên–Dưới–Đẩy–Kéo–Chân (ULPPL): 2 buổi nặng (Thân trên/Thân dưới) + 3 buổi khối lượng (Đẩy/Kéo/Chân), mỗi nhóm cơ 2 lần/tuần.",
    ppl6:"6 buổi tạ → Đẩy/Kéo/Chân ×2: khối lượng cao cho người tập lâu năm, mỗi nhóm cơ 2 lần/tuần, ngày nghỉ xen kẽ hợp lý.",
    ul5:"5 buổi tạ với dụng cụ hạn chế → Upper/Lower ×2 + Toàn thân: không đủ bài cho buổi Đẩy/Kéo riêng nên gộp thân trên để buổi nào cũng đủ bài.",
    ul6:"6 buổi tạ với dụng cụ hạn chế → Upper/Lower ×3: mỗi nhóm cơ 3 lần/tuần, mỗi buổi vừa sức.",
  }[sp.key];
  out.push({ icon:"event", text: splitWhy + (nC ? ` Thêm ${nC} buổi cardio riêng.` : "") });
  if(sp.begCap) out.push({ icon:"info", text:"Người mới: tối đa 4 buổi tạ/tuần để kịp hồi phục — các buổi còn lại là cardio nhẹ." });
  const scheme = {
    gain:"Tăng cơ: bài chính 6–10 lần" + (ctx.lv>0 ? " (buổi nặng 5–8, buổi khối lượng 8–12)" : "") + ", bài phụ 10–15 lần; nghỉ 1,5–2,5 phút bài đa khớp, ~1 phút bài cô lập.",
    strength:"Sức mạnh: bài chính nặng " + (ctx.lv===0 ? "5–6 lần" : "3–5 lần (độ nặng cảm nhận RPE 7–8, còn ~2–3 lần)") + ", nghỉ ~3 phút để hồi phục; bài phụ 6–12 lần.",
    lose:"Giảm mỡ: vẫn tập tạ 8–12 lần để GIỮ cơ khi ăn thâm hụt, nghỉ ngắn 45–90 giây, thêm cardio cuối buổi/ngày riêng.",
    tone:"Săn chắc = tăng chút cơ + giảm chút mỡ: 8–15 lần, nghỉ 45–90 giây, thêm cardio nhẹ.",
    endurance:"Sức bền: 12–20 lần, nghỉ 30–60 giây; phần lớn thời gian là Zone 2 + 1 buổi interval.",
    hybrid:"Hybrid: bài chính nặng 4–8 lần giữ sức mạnh + bài thể lực (tạ ấm, xách tạ…) + Zone 2/interval.",
  }[ctx.goal];
  /* GLOSSARY §8.2: RIR → "còn ~N lần (RIR)"; cấp Mới tập không hiện viết tắt */
  const rir = ["Người mới: dừng khi còn 2–3 lần nữa mới hết sức, ưu tiên kỹ thuật, máy & tạ đơn.",
               "Dừng khi còn 1–2 lần nữa mới hết sức (RIR 1–2), bài cô lập có thể tới còn 0–1 lần.",
               "Bài đa khớp dừng khi còn 1–2 lần (RIR 1–2), bài cô lập tới hết sức (RIR 0); theo dõi hồi phục, tuần giảm tải mỗi 5 tuần."][ctx.lv];
  out.push({ icon:"tune", text: scheme + " " + rir });
  const major = ["chest","back","shoulders","quads","glutes"].filter(k=> T[k]);
  const vol = prog.volume;
  const minMajor = Math.min.apply(null, major.map(k=> vol[k]));
  const baseT = Math.round([10,14,18][ctx.lv] * ({ gain:1, tone:.9, strength:.8, lose:.8, hybrid:.75, endurance:.6 }[ctx.goal]));
  let vt = `Khối lượng mục tiêu ~${baseT} hiệp/nhóm cơ/tuần (${PB_EXPS[ctx.lv].label.toLowerCase()}; khoảng hiệu quả 10–20)`;
  if(ctx.focus.length) vt += `, nhóm ưu tiên ${ctx.focus.map(f=> PB_FOCUS.find(x=>x.id===f).label.toLowerCase()).join(", ")} ~${Math.min(PB_HARD_CAP, baseT+4)} hiệp`;
  vt += ". Hiệp chính tính 1, hiệp phụ (VD tay sau khi đẩy ngực) tính 0,5.";
  if(minMajor < baseT - 2.5) vt += ` Với ${a.days.length} buổi × ${a.minutes} phút, vài nhóm cơ chỉ đạt ~${Math.floor(minMajor)} hiệp — vẫn hiệu quả${ctx.lv===0 ? " cho người mới" : " để duy trì"}; muốn nhiều hơn, thêm 1 buổi hoặc 15 phút/buổi.`;
  out.push({ icon:"insights", text: vt });
  const pp = prog.pp;
  if(pp.push && pp.pull) out.push({ icon:"swap_horiz", text:`Đẩy : kéo = ${pp.push} : ${pp.pull} hiệp/tuần (kéo/đẩy ${String(pp.ratio).replace(".", ",")}) — kéo ≥ đẩy giúp vai khoẻ, tư thế thẳng.` });
  if(ctx.gym) out.push({ icon:"fitness_center", text: ctx.lv===0 ? "Phòng gym: người mới ưu tiên máy, cáp & tạ đơn (ổn định, dễ học); tạ đòn sẽ thêm khi kỹ thuật vững." : "Phòng gym: bài chính dùng tạ đòn/máy để tăng tạ đều; bài phụ dùng cáp & tạ đơn." });
  else {
    const eqL = a.equip.map(e=> PB_HOME_EQ.find(x=>x.id===e).label.toLowerCase());
    out.push({ icon:"home", text:`Tại nhà (${eqL.length ? eqL.join(", ") : "không dụng cụ"}): chỉ chọn bài làm được với dụng cụ này${a.equip.includes("band") ? "; bài cáp được thay bằng dây kháng lực" : ""}. Khi làm dễ dàng hết số lần → chuyển biến thể khó hơn hoặc tạ nặng hơn.` });
  }
  if(ctx.inj.length){
    const excl = Object.keys(PB_EX).filter(id=> EXERCISES[id] && PB_EX[id].avoid.some(j=> ctx.inj.includes(j)) && pbFeasibleAlt(PB_EX[id], ctx.eq) && (PB_EX[id].lvl||0) <= ctx.lv);
    const lbl = ctx.inj.map(j=> PB_INJ.find(x=>x.id===j).label.toLowerCase()).join(", ");
    out.push({ icon:"shield", text:`Tránh chấn thương ${lbl}: đã loại ${excl.length} bài${excl.length ? " (" + excl.slice(0,4).map(pbShortName).join(", ") + (excl.length>4 ? "…" : "") + ")" : ""}; bài còn lại có ghi chú điều chỉnh. Đau tăng khi tập → dừng và hỏi bác sĩ/chuyên viên vật lý trị liệu.` });
  }
  if(ctx.gender && PB_GENDER_SUGG[ctx.gender] && ctx.focus.length && PB_GENDER_SUGG[ctx.gender].every(f=> ctx.focus.includes(f))){
    out.push({ icon:"lightbulb", text:`Ưu tiên ${PB_GENDER_SUGG[ctx.gender].map(f=> PB_FOCUS.find(x=>x.id===f).label.toLowerCase()).join(" & ")} theo gợi ý phổ biến — chỉ là gợi ý, bạn đổi bất cứ lúc nào.` });
  }
  { const cy = pbCycleFor(prog); out.push({ icon:"trending_up", text:`Tăng tiến kép: khi mọi hiệp chạm đỉnh khoảng lần → tăng mức tạ nhỏ nhất. Chu kỳ ${cy.weeks} tuần, cứ tuần thứ ${cy.every} giảm tải (bớt ~40% hiệp) — app tự đếm tuần và giảm tải giúp bạn.` }); }
  return out;
}

/* =========================================================================
   8. API THUẦN
   ========================================================================= */
function pbGenerate(answers){
  const a = pbNormalize(answers);
  const ctx = pbCtx(a);
  const sp = pbSplit(a, ctx);
  const arr = pbArrange(sp, a.days);
  const week = { used:{}, cardio:{} };
  const sessions = [];
  arr.slots.forEach((def, i)=>{
    if(!def) return;
    const day = DAY_KEYS[i];
    sessions.push(def.type==="cardio" ? pbBuildCardio(def, ctx, day, week) : pbBuildStrength(def, ctx, day, week));
  });
  const prog = { v:1, answers:a, ctx, split:sp, sessions, warnings:arr.warnings.slice(), week };
  pbRebalance(prog, ctx, week);
  pbFillTime(prog, ctx, week);
  pbPPCut(prog);
  pbFinalTrim(prog, ctx);
  pbStats(prog);
  prog.reasons = pbReasons(prog);
  return prog;
}
function pbAlternatives(prog, si, ii){
  const s = prog.sessions[si], it = s && s.items[ii]; if(!it) return [];
  const ctx = prog.ctx;
  if(it.kind==="mob") return [];
  const used = new Set(s.items.map(x=> x.id));
  if(it.kind==="cardio"){
    const pool = it.ck==="int" ? Object.keys(PB_INT) : Object.keys(PB_Z2);
    return pool.filter(id=> id!==it.id && !used.has(id) && pbFeasible(id, ctx) &&
      (it.ck!=="int" || (it.fin ? (id!=="intervalwalk" && PB_INT[id][0] <= Math.max(2, it.min)) : id!=="mountainclimber")));
  }
  const pat = PB_EX[it.id].pat;
  const slot = { p:pat, r:it.role, imp:it.imp };
  return Object.keys(PB_EX).filter(id=> PB_EX[id].pat===pat && id!==it.id && !used.has(id) && pbFeasible(id, ctx))
    .sort((a,b)=> pbScore(b, slot, ctx, null) - pbScore(a, slot, ctx, null) || PB_ORDER[a]-PB_ORDER[b]).slice(0, 8);
}
function pbSwap(prog, si, ii, newId){
  const s = prog.sessions[si], old = s && s.items[ii];
  if(!old || !PB_EX[newId] || !pbFeasible(newId, prog.ctx)) return null;
  let it;
  if(old.kind==="cardio") it = pbCardioItem(newId, old.ck, old.min, { fin:old.fin, light:old.light, ctx:prog.ctx });
  else {
    it = pbMkItem(newId, { p:old.slotPat, r:old.role, imp:old.imp, focus:old.focus }, old.sets, prog.ctx, s);
    it.fin = old.fin; it.added = old.added;
  }
  it.swapped = true;
  s.items[ii] = it;
  pbStats(prog);
  prog.reasons = pbReasons(prog);
  return it;
}
function pbUid(){ return (typeof uid==="function") ? uid() : ("u" + Date.now() + Math.floor(Math.random()*100000)); }
/* Chu kỳ theo kinh nghiệm: mới tập 10 tuần, giảm tải tuần 6 · trung bình 12 tuần, mỗi 5 tuần · lâu năm 12 tuần, mỗi 4 tuần */
function pbCycleFor(prog){
  const lv = prog && prog.ctx ? prog.ctx.lv : 0;
  return [{ weeks:10, every:6 }, { weeks:12, every:5 }, { weeks:12, every:4 }][lv] || { weeks:10, every:6 };
}
function pbToPlan(prog){
  const a = prog.answers, g = PB_GOALS.find(x=> x.id===a.goal), days = {};
  DAY_KEYS.forEach(k=>{
    const s = prog.sessions.find(x=> x.day===k);
    if(!s){ days[k] = { title: a.goal==="lose" ? "Nghỉ · đi bộ nhẹ 20–30 phút" : "Nghỉ ngơi", intensity:"Nghỉ", duration:0, items:[] }; return; }
    days[k] = { title:s.title, intensity:s.intensity || "Vừa", duration:s.est,
      items: s.items.map(it=> ({ uid: it.id + "_" + pbUid(), exerciseId: it.id, custom:null, sets: it.sets, reps: it.reps, restSec: it.restSec, clipId:null })) };
  });
  return { id:"plan_" + pbUid(), name:`Giáo án riêng · ${g.label} ${a.days.length} buổi`,
    tagline:(prog.split.name + " · " + PB_EXPS[prog.ctx.lv].label).toUpperCase(), builtin:false, fromBuilder:true,
    builder:{ v:1, answers:a, split:prog.split.key, createdAt: Date.now(), cycle: pbCycleFor(prog) }, days };
}

const PB = {
  EX: PB_EX, SESS: PB_SESS, SPLITS: PB_SPLITS, GOALS: PB_GOALS, EXPS: PB_EXPS, FOCUS: PB_FOCUS, INJ: PB_INJ, HOME_EQ: PB_HOME_EQ,
  MUSCLES: PB_MUSCLES, PUSH: PB_PUSH, PULL: PB_PULL, HARD_CAP: PB_HARD_CAP, DAY_PRESET: PB_DAY_PRESET,
  normalize: pbNormalize, ctx: pbCtx, generate: pbGenerate, alternatives: pbAlternatives, swap: pbSwap, toPlan: pbToPlan, cycleFor: pbCycleFor, healthInj: pbHealthInj, defaults: ()=> pbDefaults(),
  feasible: pbFeasible, sessSec: pbSessSec, volume: pbVolume, pushPull: pbPushPull, whyItem: pbWhyItem,
};
G.PB = PB;

/* =========================================================================
   9. GIAO DIỆN (chỉ chạy trong trình duyệt)
   ========================================================================= */
if(typeof document === "undefined") return;

try{
  if(typeof FK_LINE === "object" && FK_LINE){
    Object.assign(FK_LINE, {
      pb_spark: FK_LINE.pb_spark || "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z|M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z|M5 3l.5 1.3L7 5l-1.5.6L5 7l-.5-1.4L3 5l1.5-.7z",
      pb_next: FK_LINE.pb_next || "M5 12h14|M12 5l7 7-7 7",
      pb_hybrid: FK_LINE.pb_hybrid || "M2 12h2.5l2-4.5 3 9 2-4.5H14|M16.5 8.5v7|M20.5 8.5v7|M16.5 12h4",
    });
  }
}catch(e){}
try{
  if(!document.querySelector('link[href*="program-builder.css"],style[data-pb-css]')){
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "program-builder.css"; document.head.appendChild(l);
  }
}catch(e){}

const esc = s=> (typeof escapeHtml==="function") ? escapeHtml(String(s==null ? "" : s)) : String(s==null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const ic = n=> `<span class="material-symbols-rounded">${n}</span>`;
const PB_STEPS = ["goal","exp","sched","place","focus","inj"];
let pbUI = { step:0, a:null, prog:null, alt:null, busy:false };

/* QT-14: chấn thương đã khai ở Sàng lọc sức khoẻ (state.health.injuries) → mặc định ở bước 6.
   health-safety có thêm hông/cổ chân/cổ: hông, cổ chân → tránh bài chống chỉ định cho gối (cùng chuỗi chi dưới). */
const PB_HS_INJ = { knee:"knee", lowback:"lowback", shoulder:"shoulder", wrist:"wrist", hip:"knee", ankle:"knee" };
function pbHealthInj(st){
  const h = (st && st.health) || {};
  const list = Array.isArray(h.injuries) ? h.injuries : [];
  return Array.from(new Set(list.map(k=> PB_HS_INJ[k]).filter(Boolean)));
}
function pbDefaults(){
  const st = (typeof state==="object" && state) ? state : {};
  const last = st.programBuilder && st.programBuilder.last;
  const hInj = pbHealthInj(st);
  if(last){
    try{
      const a = JSON.parse(JSON.stringify(last));
      a.inj = Array.from(new Set((a.inj||[]).concat(hInj)));      // chấn thương mới khai sau lần tạo trước vẫn được áp
      a._hsInj = hInj.length ? hInj : null;
      return a;
    }catch(e){}
  }
  const p = st.profile || {};
  return { goal: p.goal==="lose" ? "lose" : p.goal==="gain" ? "gain" : null, exp:null, days:PB_DAY_PRESET[3].slice(), minutes:60,
    place:null, equip:[], focus:[], inj: hInj.slice(), _hsInj: hInj.length ? hInj : null, gender: p.gender==="female" ? "female" : p.gender==="male" ? "male" : null };
}
function pbValid(step){
  const a = pbUI.a;
  switch(PB_STEPS[step]){
    case "goal": return !!a.goal;
    case "exp": return !!a.exp;
    case "sched": return a.days.length>=2 && a.days.length<=6 && !!a.minutes;
    case "place": return a.place==="gym" || a.place==="home";
    default: return true;
  }
}
function pbOpt(k, v, label, desc, icon, on){
  return `<button type="button" class="pb-opt ${on?"on":""}" data-pb="set" data-k="${k}" data-v="${v}" aria-pressed="${on?"true":"false"}">
    ${icon ? ic(icon) : ""}<b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</button>`;
}
function pbChip(act, k, v, label, on){
  return `<button type="button" class="pb-chip ${on?"on":""}" data-pb="${act}" data-k="${k}" data-v="${v}" aria-pressed="${on?"true":"false"}">${esc(label)}</button>`;
}
function pbStepHTML(){
  const a = pbUI.a, st = pbUI.step, key = PB_STEPS[st];
  let body = "";
  if(key==="goal"){
    body = `<h4 class="pb-q">Mục tiêu chính của bạn?</h4>
      <p class="pb-hint">Chọn 1 mục tiêu — TapEasy sẽ chọn kiểu chia buổi, số lần, thời gian nghỉ và cardio phù hợp.</p>
      <div class="pb-grid">${PB_GOALS.map(g=> pbOpt("goal", g.id, g.label, g.desc, g.icon, a.goal===g.id)).join("")}</div>`;
  } else if(key==="exp"){
    body = `<h4 class="pb-q">Bạn đã tập tạ bao lâu?</h4>
      <p class="pb-hint">Kinh nghiệm quyết định khối lượng (10 → 20 hiệp/nhóm cơ/tuần) và độ khó kỹ thuật của bài.</p>
      <div class="pb-grid one">${PB_EXPS.map(x=> pbOpt("exp", x.id, x.label, x.desc, null, a.exp===x.id)).join("")}</div>`;
  } else if(key==="sched"){
    body = `<h4 class="pb-q">Lịch tập mỗi tuần</h4>
      <p class="pb-label">Số buổi/tuần</p>
      <div class="pb-chips">${[2,3,4,5,6].map(n=> pbChip("cnt","n",n, n+" buổi", a.days.length===n)).join("")}</div>
      <p class="pb-label">Chọn ngày cụ thể <span class="pb-sub">(${a.days.length} ngày · 2–6 ngày)</span></p>
      <div class="pb-days">${DAY_KEYS.map(k=> `<button type="button" class="pb-day ${a.days.includes(k)?"on":""}" data-pb="tog" data-k="days" data-v="${k}" aria-pressed="${a.days.includes(k)}" aria-label="${DAY_LABELS[k]}">${k}</button>`).join("")}</div>
      ${a.days.length>6 ? `<p class="pb-warn">Tối đa 6 buổi — cơ thể cần ít nhất 1 ngày nghỉ.</p>` : a.days.length<2 ? `<p class="pb-warn">Chọn ít nhất 2 ngày.</p>` : ""}
      <p class="pb-label">Thời gian mỗi buổi</p>
      <div class="pb-chips">${PB_MINUTES.map(m=> pbChip("set","minutes",m, m+" phút", a.minutes===m)).join("")}</div>
      <p class="pb-hint">Đã gồm ~5 phút khởi động. Nên xen ngày nghỉ giữa các buổi nếu được (VD T2 · T4 · T6).</p>`;
  } else if(key==="place"){
    const home = a.place==="home";
    body = `<h4 class="pb-q">Bạn tập ở đâu?</h4>
      <div class="pb-grid">${pbOpt("place","gym","Phòng gym đầy đủ","Tạ đòn, máy, cáp, tạ đơn…","fitness_center",a.place==="gym")}${pbOpt("place","home","Tại nhà","Chọn dụng cụ bạn có bên dưới","home",home)}</div>
      ${home ? `<p class="pb-label">Dụng cụ ở nhà <span class="pb-sub">(chọn nhiều)</span></p>
        <div class="pb-chips">${pbChip("noneq","equip","", "Không dụng cụ", !a.equip.length)}${PB_HOME_EQ.map(e=> pbChip("tog","equip",e.id, e.label, a.equip.includes(e.id))).join("")}</div>
        <p class="pb-hint">Không dụng cụ vẫn tập tốt với trọng lượng cơ thể + ghế/bàn chắc. Có dây kháng lực → app thay các bài cáp bằng dây.</p>` : ""}`;
  } else if(key==="focus"){
    const sugg = a.gender && PB_GENDER_SUGG[a.gender];
    const suggOn = sugg && sugg.every(f=> a.focus.includes(f));
    body = `<h4 class="pb-q">Nhóm cơ muốn ưu tiên</h4>
      <p class="pb-hint">Không bắt buộc. Tối đa 3 nhóm — nhóm ưu tiên được thêm ~4 hiệp/tuần và xếp sớm hơn trong buổi.</p>
      <div class="pb-chips">${PB_FOCUS.map(f=> pbChip("tog","focus",f.id, f.label, a.focus.includes(f.id))).join("")}</div>
      ${a.focus.length>=3 ? `<p class="pb-hint">Đã chọn 3 nhóm — ưu tiên quá nhiều sẽ làm loãng hiệu quả.</p>` : ""}
      <p class="pb-label">Giới tính <span class="pb-sub">(chỉ để gợi ý, không áp đặt)</span></p>
      <div class="pb-chips">${pbChip("set","gender","female","Nữ",a.gender==="female")}${pbChip("set","gender","male","Nam",a.gender==="male")}${pbChip("set","gender","none","Không nêu",!a.gender)}</div>
      ${sugg ? `<div class="pb-sugg">${ic("lightbulb")}<span>Gợi ý phổ biến: <b>${sugg.map(f=> PB_FOCUS.find(x=>x.id===f).label).join(" + ")}</b>${a.gender==="female" ? " — mông khoẻ bảo vệ gối & lưng, lưng giúp dáng thẳng." : " — ngực & lưng cân bằng, vai không gù."}</span>
        ${suggOn ? "" : `<button type="button" class="pb-chip sm" data-pb="sugg">Dùng gợi ý</button>`}</div>` : ""}`;
  } else if(key==="inj"){
    body = `<h4 class="pb-q">Chấn thương cần tránh?</h4>
      <p class="pb-hint">App sẽ loại hẳn bài chống chỉ định và ghi chú cách điều chỉnh cho bài còn lại.</p>
      <div class="pb-chips">${pbChip("noneinj","inj","","Không có",!a.inj.length)}${PB_INJ.map(j=> pbChip("tog","inj",j.id, j.label, a.inj.includes(j.id))).join("")}</div>
      ${a._hsInj && a._hsInj.length ? `<p class="pb-hint pb-hs-inj">${ic("health_and_safety")}Theo sàng lọc sức khoẻ của bạn: đã chọn sẵn ${esc(a._hsInj.map(k=> (PB_INJ.find(j=> j.id===k)||{}).label || k).join(", "))}.</p>` : ""}
      ${a.inj.length ? `<p class="pb-warn">${ic("warning")}Đang đau cấp tính, sưng, tê bì hoặc mới phẫu thuật → hãy hỏi bác sĩ/chuyên viên vật lý trị liệu trước khi tập.</p>` : ""}`;
  }
  const last = st===PB_STEPS.length-1;
  return `
    <div class="sheet-header"><h3>Tạo giáo án riêng</h3><button type="button" class="icon-btn" data-pb="close" aria-label="Đóng">${ic("close")}</button></div>
    <div class="pb-prog" role="progressbar" aria-valuemin="1" aria-valuemax="${PB_STEPS.length}" aria-valuenow="${st+1}"><i style="width:${Math.round((st+1)/PB_STEPS.length*100)}%"></i></div>
    <p class="pb-stepno">Bước ${st+1}/${PB_STEPS.length}</p>
    ${body}
    <div class="pb-foot">
      <button type="button" class="btn btn-outline" data-pb="back">${st===0 ? "Đóng" : "Quay lại"}</button>
      <button type="button" class="btn btn-primary" data-pb="${last ? "gen" : "next"}" ${pbValid(st) ? "" : "disabled"}>${last ? ic("pb_spark") + "Tạo giáo án" : "Tiếp tục"}</button>
    </div>`;
}
function pbFmtRest(s){ if(!s) return ""; if(s < 60) return `nghỉ ${s}s`; const m = s/60; return `nghỉ ${String(Math.round(m*10)/10).replace(".", ",")} phút`; }
function pbResultHTML(){
  const p = pbUI.prog, a = p.answers, ctx = p.ctx;
  const g = PB_GOALS.find(x=> x.id===a.goal);
  const avg = Math.round(p.sessions.reduce((t,s)=> t+s.est, 0) / Math.max(1, p.sessions.length));
  const T = ctx.targets;
  const vm = PB_MUSCLES.filter(([k])=> T[k] || p.volume[k]);
  const volRows = vm.map(([k,l])=>{
    const v = p.volume[k], t = T[k];
    const pct = Math.min(100, v/22*100), tp = t ? Math.min(100, t/22*100) : 0;
    const cls = !t ? "" : v >= t - 1 ? "ok" : v >= t*.6 ? "mid" : "low";
    return `<div class="pb-vrow"><span>${l}${ctx.fm.has(k) ? " ★" : ""}</span><div class="pb-vbar"><i class="${cls}" style="width:${pct}%"></i>${t ? `<em style="left:${tp}%"></em>` : ""}</div><b>${String(v).replace(".", ",")}</b></div>`;
  }).join("");
  const weekHTML = DAY_KEYS.map(k=>{
    const si = p.sessions.findIndex(s=> s.day===k);
    if(si<0) return `<div class="pb-rest"><b>${DAY_LABELS[k]}</b><span>${a.goal==="lose" ? "Nghỉ · đi bộ nhẹ" : "Nghỉ ngơi"}</span></div>`;
    const s = p.sessions[si];
    return `<div class="pb-dcard ${s.type}">
      <div class="pb-dh"><b>${DAY_LABELS[k]}</b><span>${esc(s.title)}</span><i>~${s.est} phút</i></div>
      <p class="pb-dwhy">${esc(s.why)}</p>
      <ol class="pb-items">${s.items.map((it, ii)=>{
        const alts = it.kind==="mob" ? [] : pbAlternatives(p, si, ii);
        const open = pbUI.alt && pbUI.alt[0]===si && pbUI.alt[1]===ii;
        const meta = EXERCISES[it.id] || { name: it.id };
        return `<li class="pb-item ${it.swapped?"sw":""}">
          <div class="pb-in"><b>${esc(meta.name)}</b>
            <small>${it.sets} × ${esc(it.reps)}${it.restSec ? " · " + pbFmtRest(it.restSec) : ""}</small>
            <em>${esc(pbWhyItem(it, ctx))}</em></div>
          ${alts.length ? `<button type="button" class="pb-swap ${open?"on":""}" data-pb="swap" data-s="${si}" data-i="${ii}" aria-expanded="${open}">${ic("swap_horiz")}<span>Đổi bài</span></button>` : ""}
          ${open ? `<div class="pb-alts"><p>Bài tương đương (${PB_PAT_LABEL[it.pat] || "cùng loại"}):</p>${alts.map(id=> `<button type="button" data-pb="pick" data-s="${si}" data-i="${ii}" data-id="${id}">${esc((EXERCISES[id]||{}).name || id)}</button>`).join("")}</div>` : ""}
        </li>`; }).join("")}</ol>
    </div>`;
  }).join("");
  return `
    <div class="sheet-header"><button type="button" class="icon-btn" data-pb="edit" aria-label="Sửa câu trả lời">${ic("arrow_back")}</button><h3 style="flex:1;margin-left:8px;">Giáo án riêng của bạn</h3><button type="button" class="icon-btn" data-pb="close" aria-label="Đóng">${ic("close")}</button></div>
    <div class="pb-res-top">
      <div class="pb-badges"><span class="pb-badge mint">${esc(p.split.name)}</span><span class="pb-badge">${esc(g.label)}</span><span class="pb-badge">${esc(PB_EXPS[ctx.lv].label)}</span>${a.place==="home" ? `<span class="pb-badge">Tại nhà</span>` : `<span class="pb-badge">Phòng gym</span>`}</div>
      <div class="pb-stats">
        <div><b>${p.sessions.length}</b><small>buổi/tuần${p.split.cd ? ` (${p.split.s} tạ + ${p.split.cd} cardio)` : ""}</small></div>
        <div><b>~${avg}</b><small>phút/buổi (bạn chọn ${a.minutes})</small></div>
        <div><b>${p.pp.ratio != null ? String(p.pp.ratio).replace(".", ",") : "—"}</b><small>tỉ lệ kéo/đẩy</small></div>
      </div>
    </div>
    ${p.warnings.length ? `<div class="pb-warnbox">${p.warnings.map(w=> `<p>${ic("warning")}${esc(w)}</p>`).join("")}</div>` : ""}
    <div class="pb-card"><p class="pb-ct">${ic("lightbulb")}Vì sao giáo án này?</p><ul class="pb-why">${p.reasons.map(r=> `<li>${ic(r.icon)}<span>${esc(r.text)}</span></li>`).join("")}</ul></div>
    <div class="pb-card"><p class="pb-ct">${ic("insights")}Hiệp/tuần theo nhóm cơ</p>${volRows}<p class="pb-hint" style="margin-top:6px;">Vạch trắng = mục tiêu của bạn · ★ = nhóm ưu tiên · khoảng hiệu quả 10–20 hiệp.</p></div>
    <p class="pb-label" style="margin-top:4px;">Lịch tuần · bấm <b>Đổi bài</b> để thay bài tương đương</p>
    <div class="pb-week">${weekHTML}</div>
    <div class="pb-foot">
      <button type="button" class="btn btn-outline" data-pb="edit">Sửa câu trả lời</button>
      <button type="button" class="btn btn-primary" data-pb="add" ${pbUI.busy ? "disabled" : ""}>${ic("add")}${pbUI.busy ? "Đang thêm…" : "Thêm vào tuần tập"}</button>
    </div>`;
}
function pbRender(toTop){
  const sc = $("#sheet-content");
  const keep = sc ? sc.scrollTop : 0;
  const html = pbUI.prog ? pbResultHTML() : pbStepHTML();
  openSheet(`<div class="pb-root" id="pb-root">${html}</div>`);
  const root = $("#pb-root");
  if(root) root.addEventListener("click", pbOnClick);
  const sc2 = $("#sheet-content");
  if(sc2) sc2.scrollTop = toTop ? 0 : keep;
}
function pbOnClick(e){
  const b = e.target.closest("[data-pb]"); if(!b || b.disabled) return;
  const act = b.dataset.pb, k = b.dataset.k, v = b.dataset.v, a = pbUI.a;
  try{
    if(act==="close"){ closeSheet(); return; }
    if(act==="set"){
      if(k==="minutes") a.minutes = Number(v);
      else if(k==="gender") a.gender = v==="none" ? null : v;
      else { a[k] = v; if(k==="place" && v==="gym") a.equip = []; }
      pbRender(false); return;
    }
    if(act==="tog"){
      const arr = a[k] = (a[k]||[]).slice(); const i = arr.indexOf(v);
      if(i>=0) arr.splice(i,1);
      else {
        if(k==="focus" && arr.length>=3){ toast("Tối đa 3 nhóm ưu tiên", "info"); return; }
        if(k==="days" && arr.length>=6){ toast("Tối đa 6 buổi/tuần — giữ ít nhất 1 ngày nghỉ", "info"); return; }
        arr.push(v);
      }
      if(k==="days") a.days = DAY_KEYS.filter(d=> a.days.includes(d));
      pbRender(false); return;
    }
    if(act==="cnt"){ a.days = PB_DAY_PRESET[Number(v)].slice(); pbRender(false); return; }
    if(act==="noneq"){ a.equip = []; pbRender(false); return; }
    if(act==="noneinj"){ a.inj = []; pbRender(false); return; }
    if(act==="sugg"){ const s = PB_GENDER_SUGG[a.gender] || []; a.focus = Array.from(new Set(s.concat(a.focus))).slice(0,3); pbRender(false); return; }
    if(act==="next"){ if(!pbValid(pbUI.step)) return; pbUI.step = Math.min(PB_STEPS.length-1, pbUI.step+1); pbRender(true); return; }
    if(act==="back"){ if(pbUI.step===0){ closeSheet(); return; } pbUI.step--; pbRender(true); return; }
    if(act==="gen"){
      pbUI.prog = pbGenerate(a); pbUI.alt = null;
      try{ state.programBuilder = state.programBuilder || {}; state.programBuilder.last = pbNormalize(a); saveState(); }catch(err){}
      pbRender(true); return;
    }
    if(act==="edit"){ pbUI.prog = null; pbUI.alt = null; pbUI.step = PB_STEPS.length-1; pbRender(true); return; }
    if(act==="swap"){
      const si = Number(b.dataset.s), ii = Number(b.dataset.i);
      pbUI.alt = (pbUI.alt && pbUI.alt[0]===si && pbUI.alt[1]===ii) ? null : [si, ii];
      pbRender(false); return;
    }
    if(act==="pick"){
      const si = Number(b.dataset.s), ii = Number(b.dataset.i), id = b.dataset.id;
      const it = pbSwap(pbUI.prog, si, ii, id); pbUI.alt = null; pbRender(false);
      if(it) toast(`Đã đổi sang ${pbShortName(id)}`, "swap_horiz");
      return;
    }
    if(act==="add"){ pbAddToWeek(); return; }
  }catch(err){
    console.error("[program-builder]", err);
    toast("Có lỗi khi tạo giáo án — thử lại nhé", "error");
  }
}
async function pbAddToWeek(){
  if(pbUI.busy || !pbUI.prog) return;
  pbUI.busy = true; pbRender(false);
  const prog = pbUI.prog;
  const plan = pbToPlan(prog);
  let res = null;
  if(typeof tplAttachVideos === "function"){
    try{ res = await Promise.race([ tplAttachVideos(plan), new Promise(r=> setTimeout(()=> r(null), 15000)) ]); }catch(e){ res = null; }
  }
  try{
    state.plans = state.plans || {};
    state.plans[plan.id] = plan; state.activePlanId = plan.id;
    if(typeof todayDayKey==="function") state.selectedDay = todayDayKey();
    const pbs = state.programBuilder = state.programBuilder || {};
    pbs.last = prog.answers; pbs.lastPlanId = plan.id;
    pbs.history = (pbs.history||[]).concat([{ id:plan.id, at:Date.now(), split:prog.split.key, goal:prog.answers.goal }]).slice(-10);
    // QT-09: giáo án riêng cũng có chu kỳ + tuần giảm tải (trước đây cycleInfo = null → 12 tuần không giảm tải)
    const cyc = pbCycleFor(prog);
    try{ if(typeof window !== "undefined" && window.FKTP && typeof window.FKTP.startCycle === "function") window.FKTP.startCycle(plan.id, { weeks: cyc.weeks, deloadEvery: cyc.every }); }catch(e){ console.warn("[program-builder] cycle", e); }
    saveState();
  }catch(e){ console.error("[program-builder] save", e); }
  pbUI.busy = false;
  closeSheet();
  if(typeof goto==="function") goto("workout");
  toast(`Đã thêm "${plan.name}" vào tuần tập${res ? ` · ${res.withVid}/${res.total} bài có video` : ""}`, "check_circle");
}
function openProgramBuilder(){
  pbUI = { step:0, a: pbDefaults(), prog:null, alt:null, busy:false };
  pbUI.a.days = (pbUI.a.days||[]).slice(); pbUI.a.equip = (pbUI.a.equip||[]).slice(); pbUI.a.focus = (pbUI.a.focus||[]).slice(); pbUI.a.inj = (pbUI.a.inj||[]).slice();
  pbRender(true);
}
G.openProgramBuilder = openProgramBuilder;
/* Móc kiểm thử (tests/suites/61-fix-training): thêm 1 giáo án đã sinh vào tuần tập như bấm nút "Thêm vào tuần tập" */
PB._ui = { addToWeek: (prog)=>{ pbUI = { step:0, a: prog.answers, prog, alt:null, busy:false }; return pbAddToWeek(); }, defaults: ()=> pbDefaults() };

/* ---- Điểm vào 1: thẻ trên Trang chủ ---- */
function pbHomeCardHTML(){
  let active = null, builtin = false;
  try{ const pl = (typeof getActivePlan==="function") ? getActivePlan() : null; if(pl && pl.fromBuilder) active = pl; builtin = !!(pl && pl.builtin); }catch(e){}
  const fresh = builtin && !(state && (Object.keys(state.setLog||{}).length || (state.finishedDates||[]).length));
  return `<button type="button" class="pb-home-card" data-pb-open="1">
    <span class="pb-hc-ic">${ic("pb_spark")}</span>
    <div><b>${active ? "Giáo án riêng của bạn" : "Tạo giáo án riêng cho bạn"}</b>
    <small>${active ? esc(active.name) + " · bấm để tạo lại" : fresh ? "Giáo án mặc định khá nặng cho người mới — 6 câu hỏi để có giáo án vừa sức" : "6 câu hỏi · ~1 phút · theo mục tiêu, dụng cụ & chấn thương"}</small></div>
    ${ic("chevron_right")}</button>`;
}
function pbInjectHome(){
  const el = document.getElementById("home-content"); if(!el || el.querySelector(".pb-home-card")) return;
  const anchor = el.querySelector(".metric-grid") || el.querySelector(".home-hero");
  if(anchor) anchor.insertAdjacentHTML("afterend", pbHomeCardHTML());
  else el.insertAdjacentHTML("afterbegin", pbHomeCardHTML());
  const btn = el.querySelector(".pb-home-card");
  if(btn) btn.addEventListener("click", openProgramBuilder);
}
if(typeof renderHomeScreen === "function"){
  const _pbOldHome = renderHomeScreen;
  renderHomeScreen = function(){
    const r = _pbOldHome.apply(this, arguments);
    try{ pbInjectHome(); }catch(e){ console.error("[program-builder] home", e); }
    return r;
  };
}

/* ---- Điểm vào 2: nút đầu màn Giáo án mẫu ---- */
function pbInjectTpl(){
  const root = document.getElementById("sheet-content"); if(!root || root.querySelector(".pb-tpl-cta")) return;
  const hdr = root.querySelector(".sheet-header"); if(!hdr) return;
  hdr.insertAdjacentHTML("afterend", `<button type="button" class="pb-tpl-cta">
    <span class="pb-hc-ic">${ic("pb_spark")}</span><div><b>Tạo giáo án riêng</b><small>Không hợp giáo án mẫu? Trả lời 6 câu hỏi — app tự soạn theo mục tiêu, lịch, dụng cụ & chấn thương của bạn.</small></div>${ic("chevron_right")}</button>`);
  root.querySelector(".pb-tpl-cta").addEventListener("click", openProgramBuilder);
}
if(typeof openTemplateBrowser === "function"){
  const _pbOldTpl = openTemplateBrowser;
  openTemplateBrowser = function(){
    const r = _pbOldTpl.apply(this, arguments);
    try{ pbInjectTpl(); }catch(e){ console.error("[program-builder] tpl", e); }
    return r;
  };
}

/* Module nạp sau appBoot(): nếu Trang chủ đang mở thì chèn thẻ ngay */
setTimeout(()=>{ try{ const h = document.getElementById("screen-home"); if(h && h.classList.contains("active")) pbInjectHome(); }catch(e){} }, 0);
})();

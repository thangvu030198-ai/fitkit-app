/* =========================================================================
   FIT KIT — Bài tập bổ sung + Giáo án mẫu quốc tế (Nam / Nữ / Chung × 3 cấp độ)
   Giáo án được xây theo CẤU TRÚC của các chương trình phổ biến, công khai miễn phí
   trên thế giới (StrongLifts 5×5, PHUL, Reddit PPL, r/bodyweightfitness, NHS Couch to 5K…).
   Bố cục buổi tập/hiệp/lần là ý tưởng huấn luyện phổ thông — FIT KIT tự biên soạn lại
   bằng tiếng Việt, không sao chép tài liệu gốc.
   Nạp NGAY SAU data.js.
   ========================================================================= */

/* ---------- 26 bài tập mới (tên tiếng Việt + tên quốc tế trong ngoặc) ---------- */
Object.assign(EXERCISES, {
  hipthrust: { name:"Đẩy hông tạ đòn (Hip Thrust)", muscle:"Mông", equipment:"Thanh đòn", sets:4, reps:"8-12", restSec:90, img:IMG.muscle_legs,
    guide:"Tựa lưng trên ghế ngang bả vai, tạ đòn đặt trên hông (lót đệm). Đẩy hông lên đến khi thân thẳng từ vai tới gối, siết mông 1 giây ở đỉnh, cằm hơi cúi, hạ có kiểm soát." },
  glutebridge: { name:"Cầu mông (Glute Bridge)", muscle:"Mông", equipment:"Trọng lượng cơ thể", sets:3, reps:"15", restSec:45, img:IMG.muscle_legs,
    guide:"Nằm ngửa, gối gập, bàn chân rộng bằng hông. Ép thắt lưng xuống sàn rồi đẩy hông lên bằng lực mông, giữ 1–2 giây, hạ chậm. Không ưỡn thắt lưng." },
  rdl: { name:"Deadlift chân thẳng (Romanian Deadlift)", muscle:"Đùi sau / Mông", equipment:"Thanh đòn / Tạ đơn", sets:3, reps:"8-10", restSec:90, img:IMG.muscle_legs,
    guide:"Đứng thẳng cầm tạ, gối hơi chùng. Đẩy hông ra sau, giữ lưng thẳng, cho tạ trượt sát đùi xuống đến giữa ống chân (cảm nhận căng đùi sau), rồi đẩy hông về trước để đứng lên." },
  gobletsquat: { name:"Squat tạ đơn trước ngực (Goblet Squat)", muscle:"Chân", equipment:"Tạ đơn / Tạ ấm", sets:3, reps:"10-12", restSec:75, img:IMG.muscle_legs,
    guide:"Ôm tạ sát ngực, chân rộng hơn vai, mũi chân hơi mở. Ngồi xuống giữa hai gót, ngực mở, khuỷu tay đi vào trong gối, xuống sâu tối đa còn giữ được lưng thẳng rồi đứng lên." },
  stepup: { name:"Bước bục tạ đơn (Dumbbell Step-up)", muscle:"Chân / Mông", equipment:"Tạ đơn + bục", sets:3, reps:"10 mỗi chân", restSec:60, img:IMG.muscle_legs,
    guide:"Đặt cả bàn chân lên bục cao ngang gối, dồn lực gót chân trước để đứng lên, không bật bằng chân sau. Hạ chậm, đổi chân." },
  legext: { name:"Duỗi chân máy (Leg Extension)", muscle:"Chân", equipment:"Máy", sets:3, reps:"12-15", restSec:60, img:IMG.muscle_legs,
    guide:"Chỉnh đệm ngay trên cổ chân, trục máy thẳng khớp gối. Duỗi chân lên hết tầm, siết đùi trước 1 giây, hạ chậm 2–3 giây." },
  cablerow: { name:"Kéo cáp ngồi (Seated Cable Row)", muscle:"Lưng", equipment:"Cáp", sets:3, reps:"10-12", restSec:75, img:IMG.muscle_back,
    guide:"Ngồi thẳng, gối hơi chùng. Kéo tay cầm về bụng, khép bả vai ra sau, khuỷu sát thân, không ngả người. Duỗi tay về có kiểm soát." },
  dbrow: { name:"Kéo tạ đơn một tay (Single Arm Dumbbell Row)", muscle:"Lưng", equipment:"Tạ đơn", sets:3, reps:"10-12 mỗi tay", restSec:60, img:IMG.muscle_back,
    guide:"Một tay và một gối chống trên ghế, lưng song song sàn. Kéo tạ về phía hông, khuỷu sát thân, siết lưng ở đỉnh, hạ chậm." },
  dbpress: { name:"Đẩy vai tạ đơn (Dumbbell Shoulder Press)", muscle:"Vai", equipment:"Tạ đơn", sets:3, reps:"8-12", restSec:75, img:IMG.muscle_shoulders,
    guide:"Ngồi lưng thẳng, tạ ngang tai, khuỷu hơi hướng trước. Đẩy tạ lên trên đầu theo đường cong nhẹ, không khoá cứng khuỷu, hạ về ngang tai." },
  dbbench: { name:"Đẩy ngực tạ đơn (Dumbbell Bench Press)", muscle:"Ngực", equipment:"Tạ đơn", sets:3, reps:"8-12", restSec:90, img:IMG.muscle_chest,
    guide:"Nằm ghế phẳng, khép bả vai. Hạ tạ đến hai bên ngực, khuỷu ~45°, đẩy lên chụm nhẹ ở đỉnh." },
  machinepress: { name:"Đẩy ngực máy (Machine Chest Press)", muscle:"Ngực", equipment:"Máy", sets:3, reps:"10-12", restSec:75, img:IMG.muscle_chest,
    guide:"Chỉnh ghế để tay cầm ngang giữa ngực. Đẩy ra, không khoá khuỷu, về chậm đến khi cảm thấy căng ngực." },
  kickback: { name:"Đá mông cáp (Glute Kickback)", muscle:"Mông", equipment:"Cáp / Máy", sets:3, reps:"12-15 mỗi chân", restSec:45, img:IMG.muscle_legs,
    guide:"Đeo dây cổ chân, hơi cúi người, siết bụng. Đá chân ra sau–lên bằng lực mông, không ưỡn lưng, giữ 1 giây rồi về chậm." },
  abduction: { name:"Mở hông máy (Hip Abduction)", muscle:"Mông", equipment:"Máy", sets:3, reps:"15-20", restSec:45, img:IMG.muscle_legs,
    guide:"Ngồi máy, đệm ở ngoài đùi. Đẩy hai chân mở ra, hơi nghiêng người trước để cảm nhận mông bên, về chậm." },
  bwsquat: { name:"Squat tay không (Bodyweight Squat)", muscle:"Chân", equipment:"Trọng lượng cơ thể", sets:3, reps:"15-20", restSec:45, img:IMG.muscle_legs,
    guide:"Chân rộng bằng vai, đẩy hông ra sau và ngồi xuống, gối theo hướng mũi chân, ngực mở. Đứng lên bằng gót chân." },
  inclinepushup: { name:"Chống đẩy nghiêng (Incline Push-up)", muscle:"Ngực", equipment:"Ghế / bàn", sets:3, reps:"8-12", restSec:60, img:IMG.muscle_chest,
    guide:"Chống tay lên ghế hoặc bàn chắc chắn, thân thẳng từ đầu tới gót. Hạ ngực sát mép ghế rồi đẩy lên. Ghế càng thấp càng khó." },
  invertedrow: { name:"Kéo người dưới xà thấp (Inverted Row)", muscle:"Lưng", equipment:"Xà thấp / bàn", sets:3, reps:"8-12", restSec:60, img:IMG.muscle_back,
    guide:"Nằm dưới xà thấp, nắm xà rộng hơn vai, thân thẳng. Kéo ngực lên chạm xà, khép bả vai, hạ chậm." },
  deadbug: { name:"Bọ chết (Dead Bug)", muscle:"Bụng", equipment:"Trọng lượng cơ thể", sets:3, reps:"10 mỗi bên", restSec:45, img:IMG.muscle_core,
    guide:"Nằm ngửa, tay thẳng lên trần, gối 90°. Ép thắt lưng xuống sàn, duỗi tay trái và chân phải ra xa rồi đổi bên. Thở ra khi duỗi." },
  sideplank: { name:"Plank nghiêng (Side Plank)", muscle:"Bụng", equipment:"Trọng lượng cơ thể", sets:3, reps:"30 giây mỗi bên", restSec:30, img:IMG.muscle_core,
    guide:"Chống khuỷu tay ngay dưới vai, thân thẳng một đường, hông nâng cao. Giữ, không để hông chùng xuống." },
  mountainclimber: { name:"Leo núi (Mountain Climber)", muscle:"Tim mạch / Bụng", equipment:"Trọng lượng cơ thể", sets:3, reps:"30 giây", restSec:30, img:IMG.muscle_cardio,
    guide:"Tư thế plank tay thẳng, kéo luân phiên từng gối về ngực nhanh, giữ hông thấp và vai trên cổ tay." },
  walking: { name:"Đi bộ nhanh (Brisk Walking)", muscle:"Tim mạch", equipment:"Không", sets:1, reps:"30 phút", restSec:0, img:IMG.muscle_cardio,
    guide:"Đi với tốc độ thở nhanh hơn nhưng vẫn nói được câu ngắn (cường độ vừa). Mục tiêu WHO: ≥150 phút/tuần." },
  kbswing: { name:"Vung tạ ấm (Kettlebell Swing)", muscle:"Toàn thân", equipment:"Tạ ấm", sets:4, reps:"15", restSec:60, img:IMG.muscle_cardio,
    guide:"Gập hông (không ngồi squat), vung tạ ra sau giữa hai chân rồi bật hông mạnh để tạ bay lên ngang ngực. Tay chỉ dẫn hướng, lực từ hông." },
  woodchop: { name:"Chặt gỗ cáp (Cable Woodchop)", muscle:"Bụng", equipment:"Cáp", sets:3, reps:"12 mỗi bên", restSec:45, img:IMG.muscle_core,
    guide:"Cáp đặt cao, kéo chéo xuống qua thân bằng cách xoay thân trên, tay gần thẳng, hông xoay theo. Về chậm." },
  skullcrusher: { name:"Nằm duỗi tay sau (Skullcrusher)", muscle:"Tay sau", equipment:"Đòn EZ / Tạ đơn", sets:3, reps:"10-12", restSec:60, img:IMG.muscle_arms,
    guide:"Nằm ghế, tay cầm tạ thẳng trên ngực. Gập khuỷu hạ tạ về sát trán, giữ khuỷu cố định, duỗi tay lên." },
  frontsquat: { name:"Squat tạ trước (Front Squat)", muscle:"Chân", equipment:"Thanh đòn", sets:4, reps:"6-8", restSec:120, img:IMG.muscle_legs,
    guide:"Tạ đặt trên vai trước, khuỷu nâng cao. Ngồi xuống thân thẳng đứng, gối đi về trước, đứng lên giữ khuỷu cao." },
  pullover: { name:"Kéo tay sau đầu (Lat Pullover)", muscle:"Lưng", equipment:"Tạ đơn / Cáp", sets:3, reps:"12", restSec:60, img:IMG.muscle_back,
    guide:"Nằm ghế, tạ trên ngực tay hơi chùng. Hạ tạ ra sau đầu đến khi căng lưng xô, kéo về trên ngực bằng lực lưng." },
  stretch: { name:"Giãn cơ toàn thân (Full Body Stretch)", muscle:"Giãn cơ", equipment:"Thảm", sets:1, reps:"10 phút", restSec:0, img:IMG.muscle_core,
    guide:"Giãn đùi trước, đùi sau, mông, ngực, vai và lưng, mỗi tư thế 30–45 giây, thở đều, không nhún." },
});

/* ---------- Giáo án mẫu ----------
   ex: [mãBài, hiệp, lần, nghỉ(giây)]  */
const TPL_R = (id, s, r, rest)=> [id, s, r, rest];
const TPL_REST = { title:"Nghỉ ngơi", intensity:"Nghỉ", duration:0, ex:[] };
const PROGRAM_TEMPLATES = [
  /* ===================== NAM ===================== */
  { id:"tpl-m-5x5", gender:"nam", level:"beginner", goal:"Sức mạnh nền tảng", weeks:12, perWeek:3,
    name:"Toàn thân 5×5 — 3 buổi/tuần",
    origin:"Dựa trên cấu trúc StrongLifts 5×5 / Starting Strength (miễn phí, phổ biến nhất thế giới cho người mới)",
    desc:"2 buổi A/B luân phiên. Mỗi buổi thành công tăng 2,5 kg (chân, lưng +5 kg). Đơn giản, tiến bộ sức mạnh rất nhanh 3 tháng đầu.",
    days:{
      T2:{ title:"Buổi A — Squat · Đẩy ngực · Kéo tạ", intensity:"Cao", duration:60, ex:[TPL_R("squat",5,"5",150),TPL_R("benchpress",5,"5",150),TPL_R("bentoverrow",5,"5",120),TPL_R("plank",3,"30 giây",45)] },
      T3:TPL_REST,
      T4:{ title:"Buổi B — Squat · Đẩy vai · Deadlift", intensity:"Cao", duration:60, ex:[TPL_R("squat",5,"5",150),TPL_R("overheadpress",5,"5",150),TPL_R("deadlift",1,"5",180),TPL_R("hangingleg",3,"10",60)] },
      T5:TPL_REST,
      T6:{ title:"Buổi A — Squat · Đẩy ngực · Kéo tạ", intensity:"Cao", duration:60, ex:[TPL_R("squat",5,"5",150),TPL_R("benchpress",5,"5",150),TPL_R("bentoverrow",5,"5",120),TPL_R("plank",3,"30 giây",45)] },
      T7:{ title:"Đi bộ phục hồi", intensity:"Thấp", duration:30, ex:[TPL_R("walking",1,"30 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-m-phul", gender:"nam", level:"intermediate", goal:"Tăng cơ + sức mạnh", weeks:12, perWeek:4,
    name:"Upper/Lower Sức mạnh & Cơ bắp — 4 buổi",
    origin:"Dựa trên cấu trúc PHUL (Power Hypertrophy Upper Lower) — chương trình miễn phí phổ biến",
    desc:"2 buổi nặng (3–5 lần) xây sức mạnh + 2 buổi khối lượng (8–12 lần) xây cơ. Phù hợp người đã tập đều 6–12 tháng.",
    days:{
      T2:{ title:"Thân trên — Sức mạnh", intensity:"Cao", duration:70, ex:[TPL_R("benchpress",4,"3-5",180),TPL_R("bentoverrow",4,"3-5",150),TPL_R("overheadpress",3,"5-8",120),TPL_R("latpulldown",3,"6-10",90),TPL_R("bicepcurl",2,"6-10",60),TPL_R("tricepsdown",2,"6-10",60)] },
      T3:{ title:"Thân dưới — Sức mạnh", intensity:"Cao", duration:70, ex:[TPL_R("squat",4,"3-5",180),TPL_R("deadlift",3,"3-5",180),TPL_R("legpress",3,"10-15",90),TPL_R("legcurl",3,"6-10",75),TPL_R("calfraise",4,"6-10",60)] },
      T4:TPL_REST,
      T5:{ title:"Thân trên — Cơ bắp", intensity:"Vừa", duration:65, ex:[TPL_R("inclinedb",3,"8-12",90),TPL_R("cablefly",3,"8-12",60),TPL_R("cablerow",3,"8-12",75),TPL_R("dbrow",3,"8-12",60),TPL_R("lateralraise",3,"10-15",45),TPL_R("hammercurl",3,"8-12",60),TPL_R("skullcrusher",3,"8-12",60)] },
      T6:{ title:"Thân dưới — Cơ bắp", intensity:"Vừa", duration:65, ex:[TPL_R("frontsquat",3,"8-12",120),TPL_R("lunges",3,"8-12",75),TPL_R("legext",3,"10-15",60),TPL_R("legcurl",3,"10-15",60),TPL_R("calfraise",4,"8-12",45),TPL_R("plank",3,"45 giây",45)] },
      T7:{ title:"Cardio nhẹ", intensity:"Thấp", duration:30, ex:[TPL_R("walking",1,"30 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-m-ppl", gender:"nam", level:"advanced", goal:"Tăng cơ tối đa", weeks:12, perWeek:6,
    name:"Push / Pull / Legs — 6 buổi",
    origin:"Dựa trên cấu trúc Reddit PPL (r/Fitness) — chương trình miễn phí cho người tập lâu năm",
    desc:"Mỗi nhóm cơ tập 2 lần/tuần với khối lượng cao. Bài chính 5×5 tăng tạ dần, bài phụ 8–12 lần. Cần ngủ đủ và ăn dư calo.",
    days:{
      T2:{ title:"Push — Ngực · Vai · Tay sau", intensity:"Cao", duration:75, ex:[TPL_R("benchpress",5,"5",150),TPL_R("overheadpress",3,"8-12",90),TPL_R("inclinedb",3,"8-12",90),TPL_R("tricepsdown",3,"8-12",60),TPL_R("lateralraise",3,"15-20",45),TPL_R("skullcrusher",3,"8-12",60)] },
      T3:{ title:"Pull — Lưng · Tay trước", intensity:"Cao", duration:75, ex:[TPL_R("deadlift",1,"5+",180),TPL_R("pullup",3,"8-12",90),TPL_R("cablerow",3,"8-12",75),TPL_R("facepull",5,"15-20",45),TPL_R("hammercurl",4,"8-12",60),TPL_R("bicepcurl",4,"8-12",60)] },
      T4:{ title:"Legs — Chân", intensity:"Cao", duration:75, ex:[TPL_R("squat",3,"5",180),TPL_R("rdl",3,"8-12",120),TPL_R("legpress",3,"8-12",90),TPL_R("legcurl",3,"8-12",60),TPL_R("calfraise",5,"8-12",45)] },
      T5:{ title:"Push — Ngực · Vai · Tay sau", intensity:"Cao", duration:75, ex:[TPL_R("overheadpress",5,"5",150),TPL_R("benchpress",3,"8-12",90),TPL_R("inclinedb",3,"8-12",90),TPL_R("tricepdip",3,"8-12",60),TPL_R("lateralraise",3,"15-20",45),TPL_R("cablefly",3,"12-15",60)] },
      T6:{ title:"Pull — Lưng · Tay trước", intensity:"Cao", duration:75, ex:[TPL_R("bentoverrow",5,"5",150),TPL_R("latpulldown",3,"8-12",90),TPL_R("dbrow",3,"8-12",60),TPL_R("facepull",5,"15-20",45),TPL_R("hammercurl",4,"8-12",60),TPL_R("bicepcurl",4,"8-12",60)] },
      T7:{ title:"Legs — Chân", intensity:"Cao", duration:75, ex:[TPL_R("squat",3,"5",180),TPL_R("rdl",3,"8-12",120),TPL_R("lunges",3,"8-12",75),TPL_R("legext",3,"12-15",60),TPL_R("calfraise",5,"8-12",45)] },
      CN:TPL_REST } },

  /* ===================== NỮ ===================== */
  { id:"tpl-f-start", gender:"nu", level:"beginner", goal:"Săn chắc · vòng 3", weeks:8, perWeek:3,
    name:"Toàn thân & Mông — 3 buổi (người mới)",
    origin:"Theo nguyên tắc tập mông phổ biến quốc tế: đẩy hông, gập hông, mở hông + toàn thân",
    desc:"3 buổi A/B/C khác nhau, tạ nhẹ–vừa, tập đúng kỹ thuật trước. Ngày nghỉ đi bộ 30 phút. Tăng dần 1–2 lần mỗi tuần.",
    days:{
      T2:{ title:"A — Squat · Cầu mông · Đẩy", intensity:"Vừa", duration:50, ex:[TPL_R("gobletsquat",3,"10-12",75),TPL_R("glutebridge",3,"15",45),TPL_R("inclinepushup",3,"8-12",60),TPL_R("dbrow",3,"10-12",60),TPL_R("deadbug",3,"10 mỗi bên",45)] },
      T3:{ title:"Đi bộ nhanh", intensity:"Thấp", duration:30, ex:[TPL_R("walking",1,"30 phút",0)] },
      T4:{ title:"B — Gập hông · Bước bục · Kéo", intensity:"Vừa", duration:50, ex:[TPL_R("rdl",3,"10-12",75),TPL_R("stepup",3,"10 mỗi chân",60),TPL_R("latpulldown",3,"10-12",60),TPL_R("dbpress",3,"10-12",60),TPL_R("sideplank",3,"30 giây mỗi bên",30)] },
      T5:{ title:"Đi bộ nhanh", intensity:"Thấp", duration:30, ex:[TPL_R("walking",1,"30 phút",0)] },
      T6:{ title:"C — Đẩy hông · Chùng chân · Mông bên", intensity:"Vừa", duration:50, ex:[TPL_R("hipthrust",3,"10-12",90),TPL_R("lunges",3,"10 mỗi chân",60),TPL_R("cablerow",3,"12",60),TPL_R("abduction",3,"15-20",45),TPL_R("plank",3,"30 giây",45)] },
      T7:{ title:"Giãn cơ", intensity:"Thấp", duration:15, ex:[TPL_R("stretch",1,"10 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-f-lu", gender:"nu", level:"intermediate", goal:"Mông · eo · săn chắc", weeks:10, perWeek:4,
    name:"Lower/Upper tập trung mông — 4 buổi",
    origin:"Dựa trên cấu trúc Upper/Lower 4 buổi, ưu tiên mông 2 buổi/tuần (khuyến nghị tần suất ≥2 lần/nhóm cơ của ACSM)",
    desc:"2 buổi chân–mông (1 buổi nặng, 1 buổi khối lượng) + 2 buổi thân trên giữ dáng cân đối. Phù hợp đã tập 3–6 tháng.",
    days:{
      T2:{ title:"Chân & Mông — Nặng", intensity:"Cao", duration:60, ex:[TPL_R("hipthrust",4,"8-10",120),TPL_R("squat",3,"6-8",150),TPL_R("rdl",3,"8-10",90),TPL_R("abduction",3,"15",45),TPL_R("calfraise",3,"12-15",45)] },
      T3:{ title:"Thân trên A", intensity:"Vừa", duration:50, ex:[TPL_R("dbbench",3,"10",75),TPL_R("cablerow",3,"10-12",60),TPL_R("dbpress",3,"10",60),TPL_R("lateralraise",3,"12-15",45),TPL_R("tricepsdown",3,"12",45),TPL_R("plank",3,"40 giây",45)] },
      T4:TPL_REST,
      T5:{ title:"Chân & Mông — Khối lượng", intensity:"Vừa", duration:55, ex:[TPL_R("legpress",3,"12",90),TPL_R("stepup",3,"10 mỗi chân",60),TPL_R("kickback",3,"15 mỗi chân",45),TPL_R("legcurl",3,"12",60),TPL_R("glutebridge",3,"20",45)] },
      T6:{ title:"Thân trên B", intensity:"Vừa", duration:50, ex:[TPL_R("latpulldown",3,"10",75),TPL_R("machinepress",3,"10-12",60),TPL_R("dbrow",3,"10",60),TPL_R("facepull",3,"15",45),TPL_R("bicepcurl",3,"12",45),TPL_R("woodchop",3,"12 mỗi bên",45)] },
      T7:{ title:"Cardio vừa", intensity:"Vừa", duration:35, ex:[TPL_R("walking",1,"35 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-f-glute5", gender:"nu", level:"advanced", goal:"Phát triển mông tối đa", weeks:12, perWeek:5,
    name:"Glute Split — 5 buổi (nâng cao)",
    origin:"Theo mô hình chia buổi tập mông phổ biến của các HLV nữ quốc tế (2 buổi mông + đùi trước + thân trên)",
    desc:"Mông tập 2–3 lần/tuần với cả tạ nặng và bài bơm máu. Cần nền kỹ thuật tốt hip thrust, RDL, squat.",
    days:{
      T2:{ title:"Mông — Nặng", intensity:"Cao", duration:65, ex:[TPL_R("hipthrust",5,"6-8",150),TPL_R("rdl",4,"8",120),TPL_R("stepup",3,"10 mỗi chân",75),TPL_R("abduction",4,"15",45)] },
      T3:{ title:"Thân trên — Đẩy", intensity:"Vừa", duration:50, ex:[TPL_R("dbbench",3,"10",75),TPL_R("dbpress",3,"10",60),TPL_R("lateralraise",4,"15",45),TPL_R("tricepsdown",3,"12",45),TPL_R("plank",3,"45 giây",45)] },
      T4:{ title:"Đùi trước & Bắp chân", intensity:"Cao", duration:60, ex:[TPL_R("squat",4,"6-8",150),TPL_R("legpress",4,"10",90),TPL_R("lunges",3,"12 mỗi chân",75),TPL_R("legext",3,"15",60),TPL_R("calfraise",4,"12-15",45)] },
      T5:{ title:"Thân trên — Kéo", intensity:"Vừa", duration:50, ex:[TPL_R("latpulldown",4,"10",75),TPL_R("cablerow",3,"12",60),TPL_R("facepull",3,"15",45),TPL_R("bicepcurl",3,"12",45),TPL_R("deadbug",3,"10 mỗi bên",45)] },
      T6:{ title:"Mông — Bơm máu", intensity:"Vừa", duration:45, ex:[TPL_R("glutebridge",4,"20",45),TPL_R("kickback",4,"15 mỗi chân",45),TPL_R("abduction",4,"20",30),TPL_R("kbswing",4,"15",60),TPL_R("mountainclimber",3,"30 giây",30)] },
      T7:{ title:"Cardio nhẹ & giãn cơ", intensity:"Thấp", duration:35, ex:[TPL_R("walking",1,"25 phút",0),TPL_R("stretch",1,"10 phút",0)] },
      CN:TPL_REST } },

  /* ===================== CHUNG ===================== */
  { id:"tpl-u-home", gender:"chung", level:"beginner", goal:"Khởi động thói quen", weeks:8, perWeek:3,
    name:"Tại nhà không dụng cụ — 3 buổi",
    origin:"Dựa trên cấu trúc Recommended Routine của cộng đồng r/bodyweightfitness",
    desc:"Không cần phòng gym. Mỗi buổi ~35 phút gồm đẩy, kéo, chân, bụng. Khi làm dễ dàng hết số lần thì chuyển sang bài khó hơn (VD chống đẩy nghiêng → chống đẩy).",
    days:{
      T2:{ title:"Toàn thân tại nhà", intensity:"Vừa", duration:35, ex:[TPL_R("bwsquat",3,"15-20",45),TPL_R("inclinepushup",3,"8-12",60),TPL_R("invertedrow",3,"8-12",60),TPL_R("glutebridge",3,"15",45),TPL_R("plank",3,"30 giây",30),TPL_R("deadbug",2,"10 mỗi bên",30)] },
      T3:TPL_REST,
      T4:{ title:"Toàn thân tại nhà", intensity:"Vừa", duration:35, ex:[TPL_R("lunges",3,"10 mỗi chân",45),TPL_R("pushup",3,"5-10",60),TPL_R("invertedrow",3,"8-12",60),TPL_R("glutebridge",3,"15",45),TPL_R("sideplank",2,"30 giây mỗi bên",30),TPL_R("mountainclimber",2,"30 giây",30)] },
      T5:TPL_REST,
      T6:{ title:"Toàn thân tại nhà", intensity:"Vừa", duration:35, ex:[TPL_R("bwsquat",3,"15-20",45),TPL_R("inclinepushup",3,"8-12",60),TPL_R("invertedrow",3,"8-12",60),TPL_R("burpee",3,"8",60),TPL_R("plank",3,"40 giây",30)] },
      T7:{ title:"Đi bộ & giãn cơ", intensity:"Thấp", duration:40, ex:[TPL_R("walking",1,"30 phút",0),TPL_R("stretch",1,"10 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-u-c25k", gender:"chung", level:"beginner", goal:"Chạy được 5 km", weeks:9, perWeek:3,
    name:"Chạy bộ từ số 0 lên 5 km — 9 tuần",
    origin:"Dựa trên cấu trúc Couch to 5K của NHS (Hệ thống Y tế Anh) — chương trình miễn phí",
    desc:"3 buổi/tuần xen kẽ chạy–đi bộ. Tuần 1: khởi động 5 phút đi bộ, rồi 8 lượt (chạy 60 giây + đi 90 giây). Mỗi tuần tăng thời gian chạy; tuần 9 chạy liền 30 phút. Sửa số lần trong giáo án theo tuần của bạn.",
    days:{
      T2:{ title:"Chạy xen kẽ — Tuần 1", intensity:"Vừa", duration:30, ex:[TPL_R("walking",1,"5 phút khởi động",0),TPL_R("running",8,"60 giây chạy + 90 giây đi",0),TPL_R("stretch",1,"5 phút",0)] },
      T3:TPL_REST,
      T4:{ title:"Chạy xen kẽ — Tuần 1", intensity:"Vừa", duration:30, ex:[TPL_R("walking",1,"5 phút khởi động",0),TPL_R("running",8,"60 giây chạy + 90 giây đi",0),TPL_R("stretch",1,"5 phút",0)] },
      T5:TPL_REST,
      T6:{ title:"Chạy xen kẽ — Tuần 1", intensity:"Vừa", duration:30, ex:[TPL_R("walking",1,"5 phút khởi động",0),TPL_R("running",8,"60 giây chạy + 90 giây đi",0),TPL_R("stretch",1,"5 phút",0)] },
      T7:TPL_REST, CN:TPL_REST } },
  { id:"tpl-u-fatloss", gender:"chung", level:"intermediate", goal:"Giảm mỡ giữ cơ", weeks:8, perWeek:4,
    name:"Giảm mỡ: Tạ toàn thân + HIIT — 4 buổi",
    origin:"Kết hợp tập tạ toàn thân + interval theo khuyến nghị ACSM (tạ ≥2 buổi + cardio 150 phút/tuần)",
    desc:"2 buổi tạ giữ cơ khi ăn thâm hụt calo + 2 buổi HIIT/cardio đốt năng lượng. Kết hợp với mục tiêu calo trong tab Dinh dưỡng.",
    days:{
      T2:{ title:"Tạ toàn thân A", intensity:"Cao", duration:55, ex:[TPL_R("gobletsquat",4,"10",75),TPL_R("dbbench",3,"10",75),TPL_R("dbrow",3,"10",60),TPL_R("rdl",3,"10",75),TPL_R("plank",3,"40 giây",30)] },
      T3:{ title:"HIIT 20 phút", intensity:"Rất cao", duration:25, ex:[TPL_R("kbswing",5,"20 giây / nghỉ 40 giây",40),TPL_R("mountainclimber",5,"20 giây / nghỉ 40 giây",40),TPL_R("burpee",5,"20 giây / nghỉ 40 giây",40)] },
      T4:TPL_REST,
      T5:{ title:"Tạ toàn thân B", intensity:"Cao", duration:55, ex:[TPL_R("lunges",3,"10 mỗi chân",60),TPL_R("dbpress",3,"10",60),TPL_R("latpulldown",3,"12",60),TPL_R("hipthrust",3,"12",75),TPL_R("woodchop",3,"12 mỗi bên",45)] },
      T6:{ title:"Cardio ổn định", intensity:"Vừa", duration:40, ex:[TPL_R("rowing",1,"15 phút",0),TPL_R("walking",1,"25 phút",0)] },
      T7:TPL_REST, CN:TPL_REST } },
  { id:"tpl-u-strength-adv", gender:"chung", level:"advanced", goal:"Sức mạnh 3 bài chính", weeks:12, perWeek:4,
    name:"Sức mạnh 4 buổi — Squat · Bench · Deadlift · Press",
    origin:"Dựa trên mô hình 4 buổi/tuần, mỗi buổi 1 bài chính (kiểu 5/3/1 & GZCLP) — tự quản lý % tạ",
    desc:"Mỗi buổi 1 bài chính nặng (3–5 lần) + bài phụ khối lượng. Tăng tạ theo chu kỳ 4 tuần, tuần 4 giảm tải 60%.",
    days:{
      T2:{ title:"Squat", intensity:"Cao", duration:70, ex:[TPL_R("squat",5,"3-5",180),TPL_R("frontsquat",3,"8",120),TPL_R("legcurl",3,"10",60),TPL_R("hangingleg",3,"10",60)] },
      T3:{ title:"Đẩy ngực", intensity:"Cao", duration:70, ex:[TPL_R("benchpress",5,"3-5",180),TPL_R("inclinedb",3,"10",90),TPL_R("dbrow",4,"10",60),TPL_R("tricepsdown",3,"12",45)] },
      T4:TPL_REST,
      T5:{ title:"Deadlift", intensity:"Cao", duration:70, ex:[TPL_R("deadlift",5,"3",180),TPL_R("rdl",3,"8",120),TPL_R("pullup",4,"6-8",90),TPL_R("plank",3,"60 giây",45)] },
      T6:{ title:"Đẩy vai", intensity:"Cao", duration:65, ex:[TPL_R("overheadpress",5,"3-5",150),TPL_R("dbbench",3,"10",75),TPL_R("latpulldown",3,"10",60),TPL_R("lateralraise",3,"15",45),TPL_R("facepull",3,"15",45)] },
      T7:{ title:"Đi bộ phục hồi", intensity:"Thấp", duration:30, ex:[TPL_R("walking",1,"30 phút",0)] },
      CN:TPL_REST } },
];
const TPL_LEVEL = { beginner:"Mới tập", intermediate:"Trung bình", advanced:"Nâng cao" };
const TPL_GENDER = { nam:"Nam", nu:"Nữ", chung:"Nam & Nữ" };

/* =========================================================================
   MÀN DUYỆT GIÁO ÁN MẪU
   ========================================================================= */
let tplUI = { gender:"all", level:"all" };
function tplToPlan(t){
  const days = {};
  DAY_KEYS.forEach(k=>{
    const d = t.days[k] || TPL_REST;
    days[k] = { title:d.title, intensity:d.intensity, duration:d.duration,
      items: d.ex.map(([id,sets,reps,rest])=>({ uid:id+"_"+uid(), exerciseId:id, custom:null, sets, reps, restSec:rest, clipId:null })) };
  });
  return { id:"plan_"+uid(), name:t.name, tagline:(TPL_GENDER[t.gender]+" · "+TPL_LEVEL[t.level]).toUpperCase(), builtin:false, fromTemplate:t.id, days };
}
function openTemplateBrowser(){
  const list = PROGRAM_TEMPLATES.filter(t=> (tplUI.gender==="all" || t.gender===tplUI.gender || (tplUI.gender!=="chung" && t.gender==="chung")) && (tplUI.level==="all" || t.level===tplUI.level));
  const chip = (k,v,label)=>`<button class="pill ${tplUI[k]===v?'active':''}" data-tf="${k}:${v}">${label}</button>`;
  openSheet(`
    <div class="sheet-header"><h3>Giáo án mẫu quốc tế</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="margin-bottom:10px;">Xây theo cấu trúc các chương trình miễn phí nổi tiếng thế giới, đã Việt hoá. Chọn 1 giáo án → app tạo bản riêng để bạn chỉnh tiếp.</p>
    <div class="exlib-chips">${chip("gender","all","Tất cả")}${chip("gender","nam","Nam")}${chip("gender","nu","Nữ")}${chip("gender","chung","Nam & Nữ")}</div>
    <div class="exlib-chips" style="margin:6px 0 12px;">${chip("level","all","Mọi cấp độ")}${chip("level","beginner","Mới tập")}${chip("level","intermediate","Trung bình")}${chip("level","advanced","Nâng cao")}</div>
    <div class="tpl-list">${list.map(t=>`
      <button class="tpl-card" data-tpl="${t.id}">
        <div class="tpl-top"><span class="tpl-g g-${t.gender}">${TPL_GENDER[t.gender]}</span><span class="tpl-lv lv-${t.level}">${TPL_LEVEL[t.level]}</span></div>
        <b>${escapeHtml(t.name)}</b>
        <small>${escapeHtml(t.goal)} · ${t.perWeek} buổi/tuần · ${t.weeks} tuần</small>
        <em>${escapeHtml(t.origin)}</em>
      </button>`).join("") || `<p class="empty-hint">Không có giáo án phù hợp bộ lọc.</p>`}</div>
  `);
  $$("[data-tf]").forEach(b=> b.addEventListener("click", ()=>{ const [k,v] = b.dataset.tf.split(":"); tplUI[k]=v; openTemplateBrowser(); }));
  $$("[data-tpl]").forEach(b=> b.addEventListener("click", ()=> openTemplateDetail(b.dataset.tpl)));
}
function openTemplateDetail(id){
  const t = PROGRAM_TEMPLATES.find(x=>x.id===id); if(!t) return;
  openSheet(`
    <div class="sheet-header"><button class="icon-btn" id="tpl-back"><span class="material-symbols-rounded">arrow_back</span></button><h3 style="flex:1;margin-left:8px;font-size:17px;">${escapeHtml(t.name)}</h3></div>
    <div class="tpl-top" style="margin-bottom:8px;"><span class="tpl-g g-${t.gender}">${TPL_GENDER[t.gender]}</span><span class="tpl-lv lv-${t.level}">${TPL_LEVEL[t.level]}</span><span class="tpl-lv">${t.perWeek} buổi/tuần</span><span class="tpl-lv">${t.weeks} tuần</span></div>
    <p class="small-note" style="line-height:1.55;">${escapeHtml(t.desc)}</p>
    <p class="small-note" style="margin-top:6px;color:var(--mint-2);">${escapeHtml(t.origin)}</p>
    <div class="tpl-week">${DAY_KEYS.map(k=>{ const d = t.days[k] || TPL_REST; return `
      <div class="tpl-day ${d.ex.length?'':'rest'}">
        <div class="tpl-day-h"><b>${DAY_LABELS[k]}</b><span>${escapeHtml(d.title)}</span>${d.duration?`<i>~${d.duration} phút</i>`:""}</div>
        ${d.ex.length ? `<ol>${d.ex.map(([id,s,r])=>`<li><span>${escapeHtml(EXERCISES[id].name)}</span><b>${s} × ${escapeHtml(String(r))}</b></li>`).join("")}</ol>` : ""}
      </div>`; }).join("")}</div>
    <button class="btn btn-primary btn-block" id="tpl-use" style="margin-top:14px;"><span class="material-symbols-rounded">check</span>Áp dụng giáo án này</button>
    <p class="small-note" style="text-align:center;margin-top:6px;">Giáo án đang dùng hiện tại vẫn được giữ trong "Chương trình của tôi".</p>
  `);
  $("#tpl-back").addEventListener("click", openTemplateBrowser);
  $("#tpl-use").addEventListener("click", ()=>{
    const plan = tplToPlan(t);
    state.plans[plan.id] = plan; state.activePlanId = plan.id; state.selectedDay = todayDayKey();
    saveState(); closeSheet(); goto("workout");
    toast(`Đã áp dụng: ${t.name}`, "check_circle");
  });
}

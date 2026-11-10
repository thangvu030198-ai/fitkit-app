/* =========================================================================
   FIT KIT — Bài tập bổ sung + Giáo án mẫu quốc tế (Nam / Nữ / Chung × 3 cấp độ)
   Giáo án theo xu hướng & nguyên tắc tập luyện hiện đại (RIR, tăng tiến kép, Upper/Lower,
   ULPPL, PPL, Powerbuilding, Hybrid/Hyrox, Zone 2, đi bộ dốc 12-3-30, glute focus).
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
  pullover: { name:"Pullover tạ đơn (Dumbbell Pullover)", muscle:"Lưng", equipment:"Tạ đơn / Cáp", sets:3, reps:"12", restSec:60, img:IMG.muscle_back,
    guide:"Nằm ghế, tạ trên ngực tay hơi chùng. Hạ tạ ra sau đầu đến khi căng lưng xô, kéo về trên ngực bằng lực lưng." },
  stretch: { name:"Giãn cơ toàn thân (Full Body Stretch)", muscle:"Giãn cơ", equipment:"Thảm", sets:1, reps:"10 phút", restSec:0, img:IMG.muscle_core,
    guide:"Giãn đùi trước, đùi sau, mông, ngực, vai và lưng, mỗi tư thế 30–45 giây, thở đều, không nhún." },
});

/* ---------- Bài tập bổ sung cho giáo án hiện đại ---------- */
Object.assign(EXERCISES, {
  bulgarian: { name:"Squat tách chân Bulgaria (Bulgarian Split Squat)", muscle:"Chân / Mông", equipment:"Tạ đơn + ghế", sets:3, reps:"8-12 mỗi chân", restSec:90, img:IMG.muscle_legs,
    guide:"Mu bàn chân sau gác lên ghế, chân trước cách ghế ~1 bước. Hạ thẳng xuống đến khi gối sau gần chạm sàn, thân hơi đổ trước để nhắm mông. Đẩy bằng cả bàn chân trước." },
  hacksquat: { name:"Squat máy Hack (Hack Squat)", muscle:"Chân", equipment:"Máy", sets:3, reps:"8-12", restSec:120, img:IMG.muscle_legs,
    guide:"Lưng áp sát đệm, chân giữa bàn đạp. Hạ sâu hết tầm có kiểm soát (2–3 giây), đẩy lên không khoá gối." },
  smithsquat: { name:"Squat máy Smith (Squats on Multipress)", muscle:"Chân", equipment:"Máy Smith", sets:3, reps:"8-12", restSec:120, img:IMG.muscle_legs,
    guide:"Thanh tạ trên vai, chân đặt hơi trước thân. Ngồi sâu, giữ lưng thẳng, đẩy lên bằng cả bàn chân." },
  csrow: { name:"Kéo tạ tì ngực (Chest Supported Row)", muscle:"Lưng", equipment:"Tạ đơn + ghế dốc", sets:3, reps:"8-12", restSec:90, img:IMG.muscle_back,
    guide:"Nằm sấp trên ghế dốc 30–45°. Để tay duỗi hết (căng lưng), kéo tạ về hông, khép bả vai, hạ chậm. Không giật người." },
  cablelateral: { name:"Dang vai cáp (Cable Lateral Raise)", muscle:"Vai", equipment:"Cáp", sets:3, reps:"12-15", restSec:45, img:IMG.muscle_shoulders,
    guide:"Đứng cạnh máy cáp, tay cầm ở thấp phía trước người. Nâng tay sang ngang tới vai, khuỷu hơi chùng, hạ chậm giữ căng cơ ở đầu động tác." },
  ohtriext: { name:"Duỗi tay sau qua đầu với cáp (Overhead Cable Tricep Extension)", muscle:"Tay sau", equipment:"Cáp", sets:3, reps:"10-15", restSec:60, img:IMG.muscle_arms,
    guide:"Quay lưng vào máy, dây thừng sau đầu, khuỷu hướng lên. Duỗi tay ra trước–lên, hạ sâu ra sau đầu để kéo giãn tay sau." },
  preacher: { name:"Cuốn tạ ghế Scott (Preacher Curls)", muscle:"Tay trước", equipment:"Đòn EZ / Tạ đơn", sets:3, reps:"10-12", restSec:60, img:IMG.muscle_arms,
    guide:"Cánh tay tì lên đệm ghế Scott. Hạ tạ gần duỗi hết (căng tay trước), cuốn lên không nhấc khuỷu khỏi đệm." },
  sledpush: { name:"Đẩy xe trượt (Sled Push)", muscle:"Toàn thân", equipment:"Xe trượt", sets:4, reps:"20 m", restSec:90, img:IMG.muscle_cardio,
    guide:"Tay nắm cột xe, thân nghiêng ~45°, bước ngắn nhanh, đẩy bằng chân trước. Giữ lưng thẳng, mắt nhìn xuống trước." },
  wallball: { name:"Ném bóng tường (Wall Ball)", muscle:"Toàn thân", equipment:"Bóng tạ", sets:4, reps:"15-20", restSec:60, img:IMG.muscle_cardio,
    guide:"Ôm bóng trước ngực, squat xuống sâu rồi bật lên ném bóng vào mục tiêu trên tường, bắt bóng và vào luôn lần squat tiếp theo." },
  farmercarry: { name:"Xách tạ đi bộ (Farmer's Carry)", muscle:"Toàn thân / Cẳng tay", equipment:"Tạ đơn / Tạ ấm", sets:4, reps:"40 m", restSec:60, img:IMG.muscle_cardio,
    guide:"Xách hai tạ nặng hai bên, vai kéo xuống, thân thẳng, siết bụng. Đi bước ngắn đều, không để tạ đung đưa." },
  inclinewalk: { name:"Đi bộ dốc 12-3-30 (Incline Treadmill Walk)", muscle:"Tim mạch", equipment:"Máy chạy bộ", sets:1, reps:"30 phút", restSec:0, img:IMG.muscle_cardio,
    guide:"Độ dốc 12%, tốc độ ~4,8 km/h (3 mph), 30 phút. Không vịn tay vào máy. Mới tập có thể bắt đầu dốc 6–8% và 15–20 phút." },
  zone2: { name:"Cardio Zone 2 (Zone 2 Cardio)", muscle:"Tim mạch", equipment:"Xe đạp / Chạy / Chèo", sets:1, reps:"30-45 phút", restSec:0, img:IMG.muscle_cardio,
    guide:"Cường độ nhẹ–vừa, nhịp tim ~60–70% tối đa: vẫn nói được thành câu. Chọn xe đạp, chạy chậm, máy chèo hoặc đi dốc." },
  intervalwalk: { name:"Đi bộ ngắt quãng (Interval Walking)", muscle:"Tim mạch", equipment:"Không", sets:5, reps:"3 phút nhanh + 3 phút chậm", restSec:0, img:IMG.muscle_cardio,
    guide:"Xen kẽ 3 phút đi rất nhanh (thở gấp) với 3 phút đi thong thả, 5 vòng. Phương pháp đi bộ ngắt quãng của Nhật Bản." },
  pecdeck: { name:"Ép ngực máy (Pec Deck / Cable Fly)", muscle:"Ngực", equipment:"Máy / Cáp", sets:3, reps:"12-15", restSec:60, img:IMG.muscle_chest,
    guide:"Mở tay ra sau đến khi ngực căng hết cỡ, ép về trước bằng lực ngực, khuỷu hơi chùng cố định." },
});

/* ---------- Giáo án mẫu ----------
   Nguyên tắc hiện đại dùng chung:
   · 10–20 hiệp khó / nhóm cơ / tuần, mỗi nhóm cơ ≥ 2 lần/tuần
   · Dừng cách thất bại 1–2 lần (RIR 1–2); bài cô lập có thể tới RIR 0
   · Tăng tiến kép (double progression): đạt đỉnh khoảng lần ở mọi hiệp → tăng tạ
   · Nhấn giai đoạn cơ bị kéo giãn (hạ chậm 2–3 giây, biên độ đầy đủ)
   · Giảm tải (deload) mỗi 5–6 tuần
   ex: [mãBài, hiệp, lần, nghỉ(giây)]  */
const TPL_R = (id, s, r, rest)=> [id, s, r, rest];
const TPL_REST = { title:"Nghỉ ngơi", intensity:"Nghỉ", duration:0, ex:[] };
const TPL_PRINCIPLES = "Nguyên tắc chung: dừng cách thất bại 1–2 lần (RIR 1–2) · đạt đỉnh khoảng lần ở mọi hiệp thì tăng tạ · hạ chậm 2–3 giây, biên độ đầy đủ · cứ 5–6 tuần giảm tải 1 tuần (bớt ~40% hiệp).";
const PROGRAM_TEMPLATES = [
  /* ===================== NAM ===================== */
  { id:"tpl-m-fb", gender:"nam", level:"beginner", goal:"Tăng cơ nền tảng", weeks:10, perWeek:3,
    name:"Full Body 3 buổi — tăng tiến kép",
    origin:"Theo nguyên tắc tăng cơ dựa trên nghiên cứu hiện nay: toàn thân 3 buổi, mỗi nhóm cơ 3 lần/tuần, dừng cách thất bại 1–2 lần",
    desc:"Máy + tạ đơn để học kỹ thuật nhanh và an toàn. Khoảng lần 8–12: khi mọi hiệp đều đạt 12 lần thì tăng tạ nhỏ nhất. Mỗi buổi ~55 phút.",
    days:{
      T2:{ title:"Full Body A", intensity:"Vừa", duration:55, ex:[TPL_R("hacksquat",3,"8-12",120),TPL_R("dbbench",3,"8-12",90),TPL_R("csrow",3,"8-12",90),TPL_R("legcurl",2,"10-15",60),TPL_R("cablelateral",2,"12-15",45),TPL_R("bicepcurl",2,"10-15",45)] },
      T3:TPL_REST,
      T4:{ title:"Full Body B", intensity:"Vừa", duration:55, ex:[TPL_R("rdl",3,"10 · tạ nhẹ, học kỹ thuật",120),TPL_R("machinepress",3,"8-12",90),TPL_R("latpulldown",3,"8-12",90),TPL_R("legpress",2,"10-15",90),TPL_R("ohtriext",2,"10-15",45),TPL_R("crunch",2,"12-15",45)] },
      T5:TPL_REST,
      T6:{ title:"Full Body C", intensity:"Vừa", duration:55, ex:[TPL_R("gobletsquat",3,"8-12",90),TPL_R("inclinedb",3,"8-12",90),TPL_R("cablerow",3,"10-12",75),TPL_R("dbpress",2,"8-12",75),TPL_R("legext",2,"12-15",45),TPL_R("hammercurl",2,"10-12",45)] },
      T7:{ title:"Đi bộ 8–10k bước", intensity:"Thấp", duration:40, ex:[TPL_R("walking",1,"40 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-m-ul", gender:"nam", level:"intermediate", goal:"Tăng cơ", weeks:12, perWeek:4,
    name:"Upper / Lower 4 buổi — hypertrophy RIR 1–2",
    origin:"Kiểu chia buổi phổ biến nhất hiện nay cho người tập 1–2 năm: Thân trên/Thân dưới, 12–16 hiệp/nhóm cơ/tuần",
    desc:"Buổi 1–2 thiên về tạ nặng (6–10 lần), buổi 3–4 thiên về khối lượng (10–15 lần), nhiều bài tập ở tư thế cơ bị kéo giãn.",
    days:{
      T2:{ title:"Upper — nặng", intensity:"Cao", duration:65, ex:[TPL_R("benchpress",3,"6-8",150),TPL_R("csrow",3,"6-10",120),TPL_R("dbpress",3,"8-10",90),TPL_R("latpulldown",3,"8-12",90),TPL_R("ohtriext",2,"10-12",60),TPL_R("preacher",2,"10-12",60)] },
      T3:{ title:"Lower — nặng", intensity:"Cao", duration:60, ex:[TPL_R("squat",3,"5-8",180),TPL_R("rdl",3,"6-10",120),TPL_R("legpress",2,"10-12",90),TPL_R("legcurl",3,"10-12",60),TPL_R("calfraise",3,"10-15",45)] },
      T4:TPL_REST,
      T5:{ title:"Upper — khối lượng", intensity:"Vừa", duration:65, ex:[TPL_R("inclinedb",3,"8-12",90),TPL_R("cablerow",3,"10-12",75),TPL_R("pecdeck",2,"12-15",60),TPL_R("pullup",3,"6-10",90),TPL_R("cablelateral",3,"12-15",45),TPL_R("tricepsdown",2,"12-15",45),TPL_R("hammercurl",2,"12-15",45)] },
      T6:{ title:"Lower — khối lượng", intensity:"Vừa", duration:60, ex:[TPL_R("hacksquat",3,"8-12",120),TPL_R("bulgarian",3,"8-12",90),TPL_R("legext",3,"12-15",60),TPL_R("legcurl",3,"12-15",60),TPL_R("calfraise",3,"12-15",45),TPL_R("hangingleg",3,"10-15",45)] },
      T7:{ title:"Zone 2", intensity:"Thấp", duration:35, ex:[TPL_R("zone2",1,"30 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-m-ulppl", gender:"nam", level:"intermediate", goal:"Tăng cơ tối đa", weeks:12, perWeek:5,
    name:"ULPPL 5 buổi — Upper · Lower · Push · Pull · Legs",
    origin:"Kết hợp Upper/Lower + Push/Pull/Legs — kiểu chia 5 buổi đang rất thịnh hành vì mỗi nhóm cơ được tập 2 lần/tuần",
    desc:"2 buổi đầu tập nặng, 3 buổi sau Push/Pull/Legs tập khối lượng. Phù hợp người có 5 buổi/tuần và đã tập ổn định.",
    days:{
      T2:{ title:"Upper", intensity:"Cao", duration:60, ex:[TPL_R("benchpress",3,"6-8",150),TPL_R("bentoverrow",3,"6-10",120),TPL_R("overheadpress",2,"6-10",120),TPL_R("pullup",3,"6-10",90),TPL_R("cablelateral",2,"12-15",45)] },
      T3:{ title:"Lower", intensity:"Cao", duration:60, ex:[TPL_R("squat",3,"5-8",180),TPL_R("rdl",3,"6-10",120),TPL_R("legcurl",2,"10-12",60),TPL_R("calfraise",3,"10-15",45),TPL_R("hangingleg",2,"10-15",45)] },
      T4:TPL_REST,
      T5:{ title:"Push", intensity:"Vừa", duration:60, ex:[TPL_R("inclinedb",3,"8-12",90),TPL_R("machinepress",3,"10-12",75),TPL_R("dbpress",2,"10-12",75),TPL_R("cablelateral",3,"12-15",45),TPL_R("ohtriext",3,"10-15",60)] },
      T6:{ title:"Pull", intensity:"Vừa", duration:60, ex:[TPL_R("latpulldown",3,"8-12",90),TPL_R("csrow",3,"8-12",90),TPL_R("pullover",2,"12-15",60),TPL_R("facepull",2,"15",45),TPL_R("preacher",3,"10-12",60),TPL_R("hammercurl",2,"12",45)] },
      T7:{ title:"Legs", intensity:"Vừa", duration:60, ex:[TPL_R("hacksquat",3,"8-12",120),TPL_R("bulgarian",2,"10-12",90),TPL_R("legext",3,"12-15",60),TPL_R("legcurl",3,"12-15",60),TPL_R("calfraise",3,"12-15",45)] },
      CN:TPL_REST } },
  { id:"tpl-m-ppl6", gender:"nam", level:"advanced", goal:"Tăng cơ nâng cao", weeks:12, perWeek:6,
    name:"PPL 6 buổi — volume cao, RIR 0–1",
    origin:"Push/Pull/Legs × 2 theo hướng bodybuilding hiện đại: 16–20 hiệp/nhóm cơ/tuần, tập sát thất bại ở bài cô lập",
    desc:"Dành cho người tập trên 2 năm, ngủ ≥7 giờ. Bài đa khớp dừng RIR 1–2, bài cô lập tới RIR 0. Theo dõi phục hồi, deload mỗi 5 tuần.",
    days:{
      T2:{ title:"Push 1 — nặng", intensity:"Cao", duration:70, ex:[TPL_R("benchpress",3,"5-8",180),TPL_R("dbpress",3,"8-10",90),TPL_R("pecdeck",3,"12-15",60),TPL_R("cablelateral",4,"12-15",45),TPL_R("ohtriext",3,"10-12",60)] },
      T3:{ title:"Pull 1 — nặng", intensity:"Cao", duration:70, ex:[TPL_R("deadlift",2,"4-6",180),TPL_R("pullup",3,"6-10",120),TPL_R("csrow",3,"8-10",90),TPL_R("facepull",3,"15",45),TPL_R("preacher",3,"10-12",60)] },
      T4:{ title:"Legs 1 — nặng", intensity:"Cao", duration:70, ex:[TPL_R("squat",3,"5-8",180),TPL_R("hipthrust",3,"8-10",120),TPL_R("legext",3,"12-15",60),TPL_R("legcurl",3,"10-12",60),TPL_R("calfraise",4,"10-15",45)] },
      T5:{ title:"Push 2 — khối lượng", intensity:"Vừa", duration:65, ex:[TPL_R("inclinedb",3,"8-12",90),TPL_R("machinepress",3,"10-12",75),TPL_R("tricepdip",3,"8-12",75),TPL_R("cablelateral",4,"15-20",45),TPL_R("tricepsdown",3,"12-15",45)] },
      T6:{ title:"Pull 2 — khối lượng", intensity:"Vừa", duration:65, ex:[TPL_R("latpulldown",3,"10-12",90),TPL_R("cablerow",3,"10-12",75),TPL_R("pullover",3,"12-15",60),TPL_R("hammercurl",3,"10-12",45),TPL_R("bicepcurl",2,"12-15",45)] },
      T7:{ title:"Legs 2 — khối lượng", intensity:"Vừa", duration:65, ex:[TPL_R("hacksquat",3,"8-12",120),TPL_R("bulgarian",3,"10-12",90),TPL_R("legcurl",3,"12-15",60),TPL_R("legext",2,"15-20",45),TPL_R("hangingleg",3,"12-15",45)] },
      CN:TPL_REST } },
  { id:"tpl-m-pb", gender:"nam", level:"advanced", goal:"Sức mạnh + cơ bắp", weeks:12, perWeek:4,
    name:"Powerbuilding 4 buổi — Squat · Bench · Deadlift · Press",
    origin:"Powerbuilding hiện đại: 1 bài chính nặng theo RPE 7–9 + bài phụ tăng cơ",
    desc:"Bài chính: 1 hiệp nặng nhất RPE 8 rồi 3 hiệp giảm 10% tạ. Bài phụ 8–15 lần, RIR 1–2. Chu kỳ 4 tuần, tuần 4 nhẹ.",
    days:{
      T2:{ title:"Squat", intensity:"Cao", duration:70, ex:[TPL_R("squat",4,"3-5 · RPE 8",180),TPL_R("rdl",3,"8",120),TPL_R("legpress",3,"10-12",90),TPL_R("legcurl",3,"12",60)] },
      T3:{ title:"Bench", intensity:"Cao", duration:70, ex:[TPL_R("benchpress",4,"3-5 · RPE 8",180),TPL_R("csrow",4,"8-10",90),TPL_R("inclinedb",3,"10",90),TPL_R("ohtriext",3,"12",60)] },
      T4:TPL_REST,
      T5:{ title:"Deadlift", intensity:"Cao", duration:70, ex:[TPL_R("deadlift",4,"2-4 · RPE 8",210),TPL_R("bulgarian",3,"8-10",90),TPL_R("pullup",4,"6-8",120),TPL_R("hangingleg",3,"10",45)] },
      T6:{ title:"Press", intensity:"Cao", duration:65, ex:[TPL_R("overheadpress",4,"4-6 · RPE 8",150),TPL_R("dbbench",3,"10",75),TPL_R("latpulldown",3,"10-12",75),TPL_R("cablelateral",3,"15",45),TPL_R("preacher",3,"12",45)] },
      T7:{ title:"Zone 2", intensity:"Thấp", duration:35, ex:[TPL_R("zone2",1,"30 phút",0)] },
      CN:TPL_REST } },

  /* ===================== NỮ ===================== */
  { id:"tpl-f-fb", gender:"nu", level:"beginner", goal:"Săn chắc, tăng cơ mông", weeks:10, perWeek:3,
    name:"Full Body cho nữ 3 buổi — mông · lưng · vai",
    origin:"Theo nguyên tắc tăng cơ hiện đại cho nữ mới tập: toàn thân 3 buổi, mông được tập mỗi buổi, tăng tiến kép",
    desc:"Không lo \"to cơ\": tập tạ giúp eo gọn, mông nâng, vai thon và đốt calo tốt hơn. Khoảng lần 10–15, khi đạt 15 lần mọi hiệp thì tăng tạ.",
    days:{
      T2:{ title:"Full Body A", intensity:"Vừa", duration:50, ex:[TPL_R("gobletsquat",3,"10-15",90),TPL_R("hipthrust",3,"10-15",90),TPL_R("latpulldown",3,"10-12",75),TPL_R("machinepress",2,"10-12",60),TPL_R("dbpress",3,"10-12",60),TPL_R("deadbug",2,"10 mỗi bên",30)] },
      T3:TPL_REST,
      T4:{ title:"Full Body B", intensity:"Vừa", duration:50, ex:[TPL_R("rdl",3,"10-12",90),TPL_R("legpress",3,"12-15",90),TPL_R("csrow",3,"10-12",75),TPL_R("inclinepushup",2,"8-12",60),TPL_R("cablelateral",2,"12-15",45),TPL_R("plank",3,"30-45 giây",30)] },
      T5:TPL_REST,
      T6:{ title:"Full Body C", intensity:"Vừa", duration:50, ex:[TPL_R("stepup",3,"10 mỗi chân",75),TPL_R("glutebridge",3,"15",60),TPL_R("abduction",3,"15-20",45),TPL_R("cablerow",3,"12",60),TPL_R("inclinepushup",2,"8-12",60),TPL_R("tricepsdown",2,"12-15",45)] },
      T7:{ title:"Đi bộ dốc 12-3-30", intensity:"Vừa", duration:30, ex:[TPL_R("inclinewalk",1,"30 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-f-home", gender:"nu", level:"beginner", goal:"Giảm mỡ tại nhà", weeks:8, perWeek:4,
    name:"Tại nhà cho nữ — tạ đơn + đi bộ ngắt quãng",
    origin:"Xu hướng tập tại nhà hiện nay: 3 buổi tạ đơn toàn thân + đi bộ ngắt quãng kiểu Nhật (3 phút nhanh / 3 phút chậm)",
    desc:"Chỉ cần 1 cặp tạ đơn (2–6 kg) và thảm. Không có tạ thì dùng chai nước hoặc balo sách. Mỗi buổi 30–40 phút.",
    days:{
      T2:{ title:"Mông & chân", intensity:"Vừa", duration:35, ex:[TPL_R("gobletsquat",3,"12-15",60),TPL_R("glutebridge",3,"15-20",45),TPL_R("lunges",2,"10 mỗi chân",60),TPL_R("rdl",3,"12",60),TPL_R("sideplank",2,"20-30 giây mỗi bên",30)] },
      T3:{ title:"Đi bộ ngắt quãng", intensity:"Vừa", duration:30, ex:[TPL_R("intervalwalk",5,"3 phút nhanh + 3 phút chậm",0)] },
      T4:{ title:"Thân trên & bụng", intensity:"Vừa", duration:35, ex:[TPL_R("inclinepushup",3,"8-12",60),TPL_R("dbrow",3,"12 mỗi tay",45),TPL_R("dbpress",3,"10-12",60),TPL_R("lateralraise",2,"15",45),TPL_R("deadbug",3,"10 mỗi bên",30)] },
      T5:TPL_REST,
      T6:{ title:"Toàn thân", intensity:"Vừa", duration:35, ex:[TPL_R("gobletsquat",3,"15",60),TPL_R("glutebridge",3,"20",45),TPL_R("dbrow",3,"12 mỗi tay",45),TPL_R("mountainclimber",3,"30 giây",30),TPL_R("plank",3,"30-45 giây",30)] },
      T7:{ title:"Đi bộ ngắt quãng", intensity:"Vừa", duration:30, ex:[TPL_R("intervalwalk",5,"3 phút nhanh + 3 phút chậm",0),TPL_R("stretch",1,"10 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-f-glute", gender:"nu", level:"intermediate", goal:"Phát triển mông", weeks:12, perWeek:4,
    name:"Glute Focus Upper/Lower 4 buổi",
    origin:"Theo hướng tập mông hiện đại: mông 3 buổi/tuần với cả bài đẩy hông, bài kéo giãn (RDL, Bulgarian) và bài mở hông",
    desc:"2 buổi Lower thiên mông + 1 buổi mông bổ sung trong Upper. Mông đặc biệt phát triển tốt ở bài kéo giãn sâu như RDL, Bulgarian — hạ chậm 3 giây.",
    days:{
      T2:{ title:"Lower — mông & đùi sau", intensity:"Cao", duration:60, ex:[TPL_R("hipthrust",4,"8-12",120),TPL_R("rdl",3,"8-10",120),TPL_R("bulgarian",3,"10-12",90),TPL_R("legcurl",3,"12-15",60),TPL_R("abduction",3,"15-20",45)] },
      T3:{ title:"Upper + mông", intensity:"Vừa", duration:55, ex:[TPL_R("latpulldown",3,"10-12",75),TPL_R("dbpress",3,"10-12",75),TPL_R("csrow",3,"10-12",75),TPL_R("machinepress",3,"10-12",60),TPL_R("cablelateral",3,"12-15",45)] },
      T4:TPL_REST,
      T5:{ title:"Lower — đùi trước & mông", intensity:"Cao", duration:60, ex:[TPL_R("hacksquat",3,"8-12",120),TPL_R("glutebridge",3,"12-15",60),TPL_R("stepup",3,"10 mỗi chân",75),TPL_R("legext",3,"12-15",60),TPL_R("abduction",3,"20",45)] },
      T6:{ title:"Upper & bụng", intensity:"Vừa", duration:50, ex:[TPL_R("inclinedb",3,"10-12",75),TPL_R("cablerow",3,"12",60),TPL_R("cablelateral",3,"15",45),TPL_R("ohtriext",2,"12-15",45),TPL_R("woodchop",3,"12 mỗi bên",45)] },
      T7:{ title:"Đi bộ dốc 12-3-30", intensity:"Vừa", duration:30, ex:[TPL_R("inclinewalk",1,"30 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-f-hybrid", gender:"nu", level:"intermediate", goal:"Giảm mỡ – khoẻ – bền", weeks:10, perWeek:5,
    name:"Hybrid cho nữ: 3 tạ + Zone 2 + Interval",
    origin:"Hybrid training — xu hướng nổi bật 2025–2026: kết hợp tạ và cardio trong cùng tuần",
    desc:"3 buổi tạ giữ và tạo dáng cơ, 1 buổi Zone 2 xây nền sức bền, 1 buổi interval đốt năng lượng. Ăn thâm hụt nhẹ 300–500 kcal (tab Dinh dưỡng).",
    days:{
      T2:{ title:"Lower", intensity:"Cao", duration:55, ex:[TPL_R("gobletsquat",3,"10-12",90),TPL_R("hipthrust",3,"10-12",90),TPL_R("rdl",3,"10",90),TPL_R("abduction",2,"20",45)] },
      T3:{ title:"Zone 2", intensity:"Thấp", duration:40, ex:[TPL_R("zone2",1,"35-40 phút",0)] },
      T4:{ title:"Upper", intensity:"Vừa", duration:50, ex:[TPL_R("latpulldown",3,"10-12",75),TPL_R("dbbench",3,"10",75),TPL_R("dbpress",3,"10",75),TPL_R("csrow",3,"10-12",75),TPL_R("cablelateral",3,"15",45)] },
      T5:TPL_REST,
      T6:{ title:"Full Body + conditioning", intensity:"Cao", duration:50, ex:[TPL_R("gobletsquat",3,"12",75),TPL_R("kbswing",4,"15",60),TPL_R("inclinepushup",3,"10",60),TPL_R("farmercarry",3,"30 m",60),TPL_R("mountainclimber",3,"30 giây",30)] },
      T7:{ title:"Interval", intensity:"Vừa", duration:30, ex:[TPL_R("rowing",6,"1 phút nhanh / 1 phút chậm",0),TPL_R("stretch",1,"10 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-f-lower3", gender:"nu", level:"advanced", goal:"Mông – chân nâng cao", weeks:12, perWeek:5,
    name:"Lower ×3 / Upper ×2 — 5 buổi chuyên mông chân",
    origin:"Phân chia nâng cao phổ biến của nữ tập lâu năm: 3 buổi thân dưới, 2 buổi thân trên, mông ~20–24 hiệp/tuần",
    desc:"Dành cho người tập trên 2 năm. Bài cô lập mông có thể tới thất bại (RIR 0). Deload mỗi 5 tuần.",
    days:{
      T2:{ title:"Lower A — mông nặng", intensity:"Cao", duration:65, ex:[TPL_R("squat",3,"6-8",180),TPL_R("hipthrust",4,"6-10",150),TPL_R("legcurl",3,"10-12",60)] },
      T3:{ title:"Upper A", intensity:"Vừa", duration:55, ex:[TPL_R("pullup",3,"4-8",120),TPL_R("dbbench",3,"8-10",90),TPL_R("dbpress",3,"8-10",90),TPL_R("csrow",3,"10-12",75),TPL_R("cablelateral",3,"15",45),TPL_R("ohtriext",2,"12",45)] },
      T4:{ title:"Lower B — đùi sau", intensity:"Cao", duration:60, ex:[TPL_R("rdl",4,"8-10",120),TPL_R("bulgarian",3,"8-12",90),TPL_R("legcurl",3,"12",60),TPL_R("kickback",3,"15 mỗi chân",45)] },
      T5:TPL_REST,
      T6:{ title:"Upper B", intensity:"Vừa", duration:55, ex:[TPL_R("latpulldown",3,"10-12",75),TPL_R("inclinedb",3,"8-12",90),TPL_R("machinepress",3,"10-12",60),TPL_R("cablerow",3,"12",60),TPL_R("cablelateral",3,"15-20",45),TPL_R("hammercurl",2,"12",45)] },
      T7:{ title:"Lower C — khối lượng", intensity:"Cao", duration:60, ex:[TPL_R("hacksquat",3,"10-12",120),TPL_R("glutebridge",3,"12-15",60),TPL_R("stepup",3,"10 mỗi chân",75),TPL_R("legext",3,"15",45),TPL_R("abduction",3,"20",45)] },
      CN:TPL_REST } },
  { id:"tpl-f-pb", gender:"nu", level:"advanced", goal:"Sức mạnh & vóc dáng", weeks:12, perWeek:4,
    name:"Powerbuilding cho nữ — 4 buổi",
    origin:"Xu hướng nữ tập tạ đòn ngày càng phổ biến: 1 bài chính nặng (RPE 7–9) + bài phụ tạo dáng",
    desc:"Squat, Bench, Deadlift, Overhead Press làm bài chính, Hip Thrust nặng đi kèm buổi Squat. Bài phụ 10–15 lần. Chu kỳ 4 tuần, tuần 4 giảm tải.",
    days:{
      T2:{ title:"Squat", intensity:"Cao", duration:65, ex:[TPL_R("squat",4,"3-5 · RPE 8",180),TPL_R("hipthrust",4,"6-8 · RPE 8",150),TPL_R("legcurl",3,"12",60),TPL_R("plank",3,"45 giây",30)] },
      T3:{ title:"Bench & lưng", intensity:"Cao", duration:60, ex:[TPL_R("benchpress",4,"4-6 · RPE 8",150),TPL_R("csrow",4,"8-10",90),TPL_R("dbpress",3,"10",75),TPL_R("facepull",3,"15",45)] },
      T4:TPL_REST,
      T5:{ title:"Deadlift", intensity:"Cao", duration:60, ex:[TPL_R("deadlift",4,"3 · RPE 8",210),TPL_R("hipthrust",3,"8-10",120),TPL_R("kickback",3,"15 mỗi chân",45),TPL_R("hangingleg",3,"10",45)] },
      T6:{ title:"Press & Upper", intensity:"Cao", duration:60, ex:[TPL_R("overheadpress",4,"5-8 · RPE 8",150),TPL_R("pullup",3,"3-6",120),TPL_R("inclinedb",3,"10",75),TPL_R("cablelateral",3,"15",45)] },
      T7:{ title:"Zone 2", intensity:"Thấp", duration:35, ex:[TPL_R("zone2",1,"30 phút",0)] },
      CN:TPL_REST } },

  /* ===================== NAM & NỮ ===================== */
  { id:"tpl-u-home", gender:"chung", level:"beginner", goal:"Khoẻ toàn thân, tối thiểu dụng cụ", weeks:8, perWeek:3,
    name:"Tại nhà tối thiểu dụng cụ — 3 buổi",
    origin:"Bài trọng lượng cơ thể theo cấp độ (dễ → khó), tập theo vòng",
    desc:"Không cần phòng gym — chỉ cần 1 ghế hoặc bàn thật chắc (cho chống đẩy nghiêng, kéo người dưới bàn). Khi làm dễ dàng hết số lần thì chuyển bài khó hơn (VD chống đẩy nghiêng → chống đẩy).",
    days:{
      T2:{ title:"Toàn thân A", intensity:"Vừa", duration:35, ex:[TPL_R("bwsquat",3,"15-20",45),TPL_R("inclinepushup",3,"8-12",60),TPL_R("invertedrow",3,"8-12",60),TPL_R("glutebridge",3,"15",45),TPL_R("plank",3,"30 giây",30)] },
      T3:TPL_REST,
      T4:{ title:"Toàn thân B", intensity:"Vừa", duration:35, ex:[TPL_R("lunges",3,"10 mỗi chân",45),TPL_R("pushup",3,"5-10",60),TPL_R("invertedrow",3,"8-12",60),TPL_R("sideplank",2,"30 giây mỗi bên",30),TPL_R("mountainclimber",2,"30 giây",30)] },
      T5:TPL_REST,
      T6:{ title:"Toàn thân C", intensity:"Vừa", duration:35, ex:[TPL_R("bwsquat",3,"20",45),TPL_R("pushup",3,"tối đa −2",60),TPL_R("glutebridge",3,"20",45),TPL_R("burpee",3,"8",60),TPL_R("deadbug",3,"10 mỗi bên",30)] },
      T7:{ title:"Đi bộ ngắt quãng", intensity:"Vừa", duration:30, ex:[TPL_R("intervalwalk",5,"3 phút nhanh + 3 phút chậm",0)] },
      CN:TPL_REST } },
  { id:"tpl-u-cardio", gender:"chung", level:"beginner", goal:"Giảm cân, tim mạch", weeks:8, perWeek:4,
    name:"Zone 2 + Đi bộ dốc 12-3-30 (tăng dần) + tạ nhẹ",
    origin:"Xu hướng cardio hiện đại: nền Zone 2 cường độ nhẹ, đi bộ dốc 12-3-30 và đi bộ ngắt quãng — dễ duy trì, ít chấn thương",
    desc:"Phù hợp người thừa cân hoặc mới bắt đầu: bắt đầu dốc 6–8% và 15–20 phút, tăng dần mỗi tuần. Có 1 buổi tạ nhẹ để giữ cơ khi giảm cân. Kết hợp 8–10k bước/ngày và ăn thâm hụt nhẹ.",
    days:{
      T2:{ title:"Đi bộ dốc (tăng dần)", intensity:"Vừa", duration:25, ex:[TPL_R("inclinewalk",1,"15-20 phút, dốc 6–8% · mỗi tuần +1–2% tới 12%",0),TPL_R("stretch",1,"5 phút",0)] },
      T3:TPL_REST,
      T4:{ title:"Zone 2", intensity:"Thấp", duration:40, ex:[TPL_R("zone2",1,"30-40 phút",0)] },
      T5:{ title:"Tạ toàn thân nhẹ", intensity:"Vừa", duration:25, ex:[TPL_R("bwsquat",2,"12",60),TPL_R("inclinepushup",2,"8",60),TPL_R("glutebridge",2,"12",45),TPL_R("plank",2,"20 giây",30)] },
      T6:{ title:"Đi bộ ngắt quãng", intensity:"Vừa", duration:30, ex:[TPL_R("intervalwalk",5,"3 phút nhanh + 3 phút chậm",0)] },
      T7:{ title:"Zone 2 dài", intensity:"Thấp", duration:50, ex:[TPL_R("zone2",1,"45 phút",0),TPL_R("stretch",1,"10 phút",0)] },
      CN:TPL_REST } },
  { id:"tpl-u-hyrox", gender:"chung", level:"intermediate", goal:"Hyrox / thể lực hybrid", weeks:10, perWeek:4,
    name:"Hybrid kiểu Hyrox — 4 buổi chạy + functional",
    origin:"Hyrox — giải thể lực đang bùng nổ toàn cầu: chạy xen kẽ các trạm sled, chèo, wall ball, farmer carry",
    desc:"2 buổi sức mạnh/functional, 1 buổi chạy Zone 2, 1 buổi mô phỏng Hyrox (chạy 1 km + 1 trạm). Không có xe trượt thì thay bằng đẩy máy chạy tắt điện hoặc lunge.",
    days:{
      T2:{ title:"Strength", intensity:"Cao", duration:60, ex:[TPL_R("squat",4,"5-6",150),TPL_R("rdl",3,"8",120),TPL_R("dbrow",3,"10 mỗi tay",60),TPL_R("farmercarry",4,"40 m",60)] },
      T3:{ title:"Chạy Zone 2", intensity:"Thấp", duration:40, ex:[TPL_R("running",1,"30-40 phút nhẹ",0)] },
      T4:TPL_REST,
      T5:{ title:"Functional", intensity:"Cao", duration:50, ex:[TPL_R("sledpush",4,"20 m",90),TPL_R("wallball",4,"20",60),TPL_R("lunges",3,"20 bước",60),TPL_R("burpee",3,"10",60),TPL_R("rowing",3,"500 m",90)] },
      T6:TPL_REST,
      T7:{ title:"Mô phỏng Hyrox", intensity:"Rất cao", duration:50, ex:[TPL_R("running",4,"1 km",0),TPL_R("rowing",1,"1000 m",0),TPL_R("sledpush",2,"25 m",0),TPL_R("farmercarry",2,"100 m",0),TPL_R("wallball",1,"50",0)] },
      CN:TPL_REST } },
  { id:"tpl-u-hybrid-adv", gender:"chung", level:"advanced", goal:"Vừa khoẻ vừa bền", weeks:12, perWeek:5,
    name:"Hybrid Athlete 5 buổi — tạ + chạy",
    origin:"Mô hình Hybrid Athlete hiện đại: 3 buổi tạ Upper/Lower/Full + 2 buổi chạy (1 Zone 2, 1 interval)",
    desc:"Buổi chân nặng và buổi chạy interval cách nhau ≥48 giờ (T2 → T5). Tổng quãng chạy tăng tối đa 10%/tuần.",
    days:{
      T2:{ title:"Lower strength", intensity:"Cao", duration:60, ex:[TPL_R("squat",4,"4-6",180),TPL_R("rdl",3,"6-8",120),TPL_R("bulgarian",3,"8",90),TPL_R("calfraise",3,"12",45)] },
      T3:{ title:"Chạy Zone 2 dài", intensity:"Thấp", duration:60, ex:[TPL_R("zone2",1,"50-60 phút chạy nhẹ",0)] },
      T4:{ title:"Upper", intensity:"Cao", duration:60, ex:[TPL_R("benchpress",4,"5-8",150),TPL_R("pullup",4,"6-10",120),TPL_R("dbpress",3,"10",75),TPL_R("csrow",3,"10",75)] },
      T5:{ title:"Chạy interval", intensity:"Rất cao", duration:45, ex:[TPL_R("running",6,"800 m nhanh / 2 phút đi bộ",0)] },
      T6:TPL_REST,
      T7:{ title:"Full Body power", intensity:"Cao", duration:55, ex:[TPL_R("deadlift",3,"3-5",180),TPL_R("kbswing",4,"15",60),TPL_R("farmercarry",3,"40 m",60),TPL_R("hangingleg",3,"12",45)] },
      CN:TPL_REST } },
];
/* Video tham khảo Pixabay cho bài cardio/tự do không có video hướng dẫn riêng */
const TPL_PB_QUERY = { walking:"walking", intervalwalk:"walking", running:"running" };
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
/* Gắn sẵn video hướng dẫn (YMove / wger) cho mọi bài trong giáo án */
async function tplAttachVideos(plan){
  const cache = {}; let total = 0, withVid = 0;
  const items = DAY_KEYS.flatMap(k=> plan.days[k].items);
  for(const it of items){
    total++;
    if(!(it.exerciseId in cache)){
      let v = null;
      try{ const meta = EXERCISES[it.exerciseId]; const r = meta ? await findFreeExerciseVideos(meta) : []; v = r[0] || null; }catch(e){}
      if(!v && TPL_PB_QUERY[it.exerciseId]) v = await tplPixabayFallback(TPL_PB_QUERY[it.exerciseId]);
      cache[it.exerciseId] = v ? Object.assign(stockFromVideo(v), { duration:v.duration||0 }) : null;
    }
    if(cache[it.exerciseId]){ it.stock = Object.assign({}, cache[it.exerciseId]); withVid++; }
  }
  return { total, withVid };
}
async function tplPixabayFallback(q){
  try{
    const key = (typeof mediaKeys==="function") ? mediaKeys().pixabay : "";
    if(!key) return null;
    const hits = await searchPixabay(q, key);
    // chỉ nhận video có đúng cụm từ khoá VÀ thẻ thể thao (tránh "plank" ra ván gỗ…)
    return hits.find(h=> h.tags.includes(q) && /exercise|workout|fitness|sport|jogging|run|walk|training|gym/.test(h.tags)) || null;
  }catch(e){ return null; }
}
const TPL_CARDIO = new Set(["walking","inclinewalk","zone2","intervalwalk","running","rowing","jumprope","stretch"]);
function tplWeekLabel(t){
  let lift=0, cardio=0;
  Object.values(t.days).forEach(d=>{ if(!d.ex.length) return; if(d.ex.every(e=>TPL_CARDIO.has(e[0]))) cardio++; else lift++; });
  return lift && cardio ? `${lift} tạ + ${cardio} cardio/tuần` : `${lift||cardio} buổi/tuần`;
}
const TPL_LV_ORDER = { beginner:0, intermediate:1, advanced:2 }, TPL_G_ORDER = { nam:0, nu:1, chung:2 };
async function tplAddToWeek(t){
  const plan = tplToPlan(t);
  toast("Đang thêm giáo án & gắn video…", "videocam");
  let res = { total:0, withVid:0 };
  try{ res = await tplAttachVideos(plan); }catch(e){}
  state.plans[plan.id] = plan; state.activePlanId = plan.id; state.selectedDay = todayDayKey();
  saveState(); closeSheet(); goto("workout");
  toast(`Đã thêm "${t.name}" vào tuần tập · ${res.withVid}/${res.total} bài có video hướng dẫn`, "check_circle");
}
function openTemplateBrowser(){
  const list = PROGRAM_TEMPLATES.filter(t=> (tplUI.gender==="all" || t.gender===tplUI.gender || (tplUI.gender!=="chung" && t.gender==="chung")) && (tplUI.level==="all" || t.level===tplUI.level))
    .slice().sort((a,b)=> (TPL_G_ORDER[a.gender]-TPL_G_ORDER[b.gender]) || (TPL_LV_ORDER[a.level]-TPL_LV_ORDER[b.level]));
  const chip = (k,v,label)=>`<button class="pill ${tplUI[k]===v?'active':''}" data-tf="${k}:${v}">${label}</button>`;
  openSheet(`
    <div class="sheet-header"><h3>Giáo án mẫu hiện đại</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="margin-bottom:10px;">Giáo án theo xu hướng tập hiện đại (RIR, Upper/Lower, ULPPL, Hybrid, Zone 2…). Bấm <b>Thêm vào tuần tập</b> → app tạo lịch tuần và tự gắn video cho từng bài.</p>
    <div class="exlib-chips">${chip("gender","all","Tất cả")}${chip("gender","nam","Nam")}${chip("gender","nu","Nữ")}${chip("gender","chung","Nam & Nữ")}</div>
    <div class="exlib-chips" style="margin:6px 0 12px;">${chip("level","all","Mọi cấp độ")}${chip("level","beginner","Mới tập")}${chip("level","intermediate","Trung bình")}${chip("level","advanced","Nâng cao")}</div>
    <div class="tpl-list">${list.map(t=>`
      <div class="tpl-card" data-tpl="${t.id}" role="button" tabindex="0">
        <div class="tpl-top"><span class="tpl-g g-${t.gender}">${TPL_GENDER[t.gender]}</span><span class="tpl-lv lv-${t.level}">${TPL_LEVEL[t.level]}</span></div>
        <b>${escapeHtml(t.name)}</b>
        <small>${escapeHtml(t.goal)} · ${tplWeekLabel(t)} · ${t.weeks} tuần</small>
        <em>${escapeHtml(t.origin)}</em>
        <div class="tpl-actions">
          <button class="tpl-add" type="button" data-tpl-add="${t.id}"><span class="material-symbols-rounded">add</span>Thêm vào tuần tập</button>
          <button class="tpl-view" type="button" data-tpl-view="${t.id}">Xem chi tiết</button>
        </div>
      </div>`).join("") || `<p class="empty-hint">Không có giáo án phù hợp bộ lọc.</p>`}</div>
  `);
  $$("[data-tf]").forEach(b=> b.addEventListener("click", ()=>{ const [k,v] = b.dataset.tf.split(":"); tplUI[k]=v; openTemplateBrowser(); }));
  $$("[data-tpl]").forEach(b=> b.addEventListener("click", ()=> openTemplateDetail(b.dataset.tpl)));
  $$("[data-tpl-add]").forEach(b=> b.addEventListener("click", e=>{ e.stopPropagation(); b.disabled = true; b.innerHTML = "Đang thêm…"; tplAddToWeek(PROGRAM_TEMPLATES.find(x=>x.id===b.dataset.tplAdd)); }));
}
function openTemplateDetail(id){
  const t = PROGRAM_TEMPLATES.find(x=>x.id===id); if(!t) return;
  openSheet(`
    <div class="sheet-header"><button class="icon-btn" id="tpl-back"><span class="material-symbols-rounded">arrow_back</span></button><h3 style="flex:1;margin-left:8px;font-size:17px;">${escapeHtml(t.name)}</h3></div>
    <div class="tpl-top" style="margin-bottom:8px;"><span class="tpl-g g-${t.gender}">${TPL_GENDER[t.gender]}</span><span class="tpl-lv lv-${t.level}">${TPL_LEVEL[t.level]}</span><span class="tpl-lv">${tplWeekLabel(t)}</span><span class="tpl-lv">${t.weeks} tuần</span></div>
    <p class="small-note" style="line-height:1.55;">${escapeHtml(t.desc)}</p>
    <p class="small-note tpl-principles">${escapeHtml(TPL_PRINCIPLES)}</p>
    <p class="small-note" style="margin-top:6px;color:var(--mint-2);">${escapeHtml(t.origin)}</p>
    <div class="tpl-week">${DAY_KEYS.map(k=>{ const d = t.days[k] || TPL_REST; return `
      <div class="tpl-day ${d.ex.length?'':'rest'}">
        <div class="tpl-day-h"><b>${DAY_LABELS[k]}</b><span>${escapeHtml(d.title)}</span>${d.duration?`<i>~${d.duration} phút</i>`:""}</div>
        ${d.ex.length ? `<ol>${d.ex.map(([id,s,r])=>`<li><span>${escapeHtml(EXERCISES[id].name)}</span><b>${s} × ${escapeHtml(String(r))}</b></li>`).join("")}</ol>` : ""}
      </div>`; }).join("")}</div>
    <button class="btn btn-primary btn-block" id="tpl-use" style="margin-top:14px;"><span class="material-symbols-rounded">add</span>Thêm giáo án vào tuần tập</button>
    <p class="small-note" style="text-align:center;margin-top:6px;">App tự gắn video hướng dẫn cho từng bài. Giáo án cũ vẫn được giữ trong "Chương trình của tôi".</p>
  `);
  $("#tpl-back").addEventListener("click", openTemplateBrowser);
  $("#tpl-use").addEventListener("click", e=>{ e.currentTarget.disabled = true; e.currentTarget.innerHTML = "Đang thêm & gắn video…"; tplAddToWeek(t); });
}

/* =========================================================================
   FIT KIT — Cơ sở dữ liệu khoa học
   Nguồn tham khảo:
   - Công thức năng lượng: Mifflin-St Jeor Equation (1990), được ACSM/Hiệp hội
     Dinh dưỡng Hoa Kỳ khuyến nghị là công thức ước tính BMR chính xác nhất
     cho người trưởng thành hiện nay.
   - Hệ số hoạt động (PAL): theo hướng dẫn của Harris-Benedict/ACSM mở rộng.
   - Khuyến nghị protein: 1.6–2.2 g/kg thể trọng cho người tập luyện sức đề
     kháng (Vị trí khuyến nghị của ISSN — International Society of Sports
     Nutrition, 2017).
   - Khuyến nghị chất béo: 20–35% tổng năng lượng (Viện Y học Hoa Kỳ - IOM).
   - Khuyến nghị giấc ngủ: 7–9 giờ/đêm cho người trưởng thành 18-64 tuổi
     (National Sleep Foundation, CDC).
   - Giá trị dinh dưỡng thực phẩm: số liệu trung bình tham khảo từ USDA
     FoodData Central — chỉ mang tính ước lượng, có thể chênh lệch theo
     nguồn gốc & cách chế biến thực tế.
   ========================================================================= */

/* ---------- Ảnh minh họa (Pexels — miễn phí bản quyền) ---------- */
const IMG = {
  heroWorkout1: "https://images.pexels.com/photos/38453108/pexels-photo-38453108/free-photo-of-powerful-male-bodybuilder-in-black-and-white.jpeg?auto=compress&cs=tinysrgb&w=1080",
  heroWorkout2: "https://images.pexels.com/photos/29825227/pexels-photo-29825227/free-photo-of-powerful-bodybuilder-at-the-gym-in-black-and-white.jpeg?auto=compress&cs=tinysrgb&w=1080",
  heroWorkout3: "https://images.pexels.com/photos/31783554/pexels-photo-31783554/free-photo-of-man-lifting-weights-in-gym-with-intensity.jpeg?auto=compress&cs=tinysrgb&w=1080",
  heroWorkout4: "https://images.pexels.com/photos/38453228/pexels-photo-38453228/free-photo-of-back-view-of-muscular-man-working-out-in-gym.jpeg?auto=compress&cs=tinysrgb&w=1080",
  heroNutrition: "https://images.pexels.com/photos/30635703/pexels-photo-30635703/free-photo-of-healthy-meal-prep-containers-with-grilled-chicken.jpeg?auto=compress&cs=tinysrgb&w=1080",
  cardNutrition2: "https://images.pexels.com/photos/30635714/pexels-photo-30635714/free-photo-of-healthy-meal-prep-with-rice-and-vegetables.jpeg?auto=compress&cs=tinysrgb&w=800",
  heroSleep: "https://images.pexels.com/photos/3465878/pexels-photo-3465878.jpeg?auto=compress&cs=tinysrgb&w=1080",
  cardSleep2: "https://images.pexels.com/photos/36933874/pexels-photo-36933874/free-photo-of-relaxing-woman-resting-on-a-cozy-bed.jpeg?auto=compress&cs=tinysrgb&w=800",
  avatar: "https://images.pexels.com/photos/36537691/pexels-photo-36537691/free-photo-of-fit-masculine-athlete-in-studio-portrait.jpeg?auto=compress&cs=tinysrgb&w=400",
  muscle_chest: "https://images.pexels.com/photos/17959564/pexels-photo-17959564/free-photo-of-muscular-man-training-with-dumbbells.jpeg?auto=compress&cs=tinysrgb&w=600",
  muscle_back: "https://images.pexels.com/photos/38453228/pexels-photo-38453228/free-photo-of-back-view-of-muscular-man-working-out-in-gym.jpeg?auto=compress&cs=tinysrgb&w=600",
  muscle_shoulders: "https://images.pexels.com/photos/31783554/pexels-photo-31783554/free-photo-of-man-lifting-weights-in-gym-with-intensity.jpeg?auto=compress&cs=tinysrgb&w=600",
  muscle_legs: "https://images.pexels.com/photos/36387535/pexels-photo-36387535/free-photo-of-woman-performing-squats-with-dumbbells-in-gym.jpeg?auto=compress&cs=tinysrgb&w=600",
  muscle_arms: "https://images.pexels.com/photos/37281143/pexels-photo-37281143/free-photo-of-hand-gripping-dumbbell-in-dimly-lit-gym.jpeg?auto=compress&cs=tinysrgb&w=600",
  muscle_core: "https://images.pexels.com/photos/4662331/pexels-photo-4662331.jpeg?auto=compress&cs=tinysrgb&w=600",
  muscle_cardio: "https://images.pexels.com/photos/28162956/pexels-photo-28162956/free-photo-of-a-black-and-white-photo-of-a-man-running-on-a-track.jpeg?auto=compress&cs=tinysrgb&w=600",
};

/* ---------- Hệ số hoạt động (PAL) ---------- */
const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Ít vận động", desc: "Công việc văn phòng, gần như không tập", factor: 1.2 },
  { id: "light", label: "Vận động nhẹ", desc: "Tập 1–3 buổi/tuần", factor: 1.375 },
  { id: "moderate", label: "Vận động vừa", desc: "Tập 3–5 buổi/tuần", factor: 1.55 },
  { id: "active", label: "Vận động nhiều", desc: "Tập 6–7 buổi/tuần", factor: 1.725 },
  { id: "veryActive", label: "Vận động rất nhiều", desc: "Vận động viên / lao động chân tay nặng", factor: 1.9 },
];

/* ---------- Mục tiêu ---------- */
const GOALS = [
  { id: "lose", label: "Giảm mỡ", desc: "Thâm hụt ~18% TDEE (~0,5 kg/tuần)", kcalAdjust: -0.18, program: "giam-mo" },
  { id: "maintain", label: "Duy trì vóc dáng", desc: "Giữ nguyên mức năng lượng TDEE", kcalAdjust: 0, program: "tang-co" },
  { id: "gain", label: "Tăng cơ", desc: "Thặng dư ~12% TDEE để tăng cơ nạc", kcalAdjust: 0.12, program: "tang-co" },
];

/* ---------- Cơ sở dữ liệu bài tập ---------- */
/* sets/reps là khuyến nghị mặc định — có thể chỉnh trong buổi tập.
   restSec: thời gian nghỉ giữa hiệp theo khuyến nghị NASM (compound 90-120s, isolation 45-60s, core 30-45s). */
const EXERCISES = {
  benchpress: { name: "Đẩy ngực nằm (Bench Press)", muscle: "Ngực", equipment: "Thanh đòn", sets: 4, reps: "6-8", restSec: 120, img: IMG.muscle_chest,
    guide: "Nằm trên ghế phẳng, giữ vai ép xuống ghế và siết bả vai. Hạ tạ chạm ngực có kiểm soát, giữ khuỷu tay góc ~45° so với thân, sau đó đẩy tạ lên hết tầm mà không khóa cứng khớp khuỷu." },
  inclinedb: { name: "Đẩy ngực trên ghế nghiêng (Incline DB Press)", muscle: "Ngực", equipment: "Tạ đơn", sets: 3, reps: "8-10", restSec: 90, img: IMG.muscle_chest,
    guide: "Đặt ghế nghiêng 30-45°. Đẩy hai tạ đơn lên trên theo hình vòng cung nhẹ, hạ xuống chậm đến khi khuỷu tay ngang vai, tập trung cảm nhận phần ngực trên." },
  pushup: { name: "Chống đẩy (Push-up)", muscle: "Ngực", equipment: "Trọng lượng cơ thể", sets: 3, reps: "12-15", restSec: 60, img: IMG.muscle_chest,
    guide: "Giữ thân người thành một đường thẳng từ đầu đến gót chân, hạ ngực gần chạm sàn, khuỷu tay hướng chéo 45°, đẩy lên hết tầm và siết cơ bụng suốt quá trình." },
  cablefly: { name: "Ép ngực cáp (Cable Fly)", muscle: "Ngực", equipment: "Cáp", sets: 3, reps: "12-15", restSec: 60, img: IMG.muscle_chest,
    guide: "Đứng giữa giàn cáp, hơi ngả người ra trước, kéo hai tay cáp vào giữa theo hình vòng cung, siết chặt ngực ở điểm cuối rồi thả chậm về vị trí ban đầu." },
  pullup: { name: "Kéo xà (Pull-up)", muscle: "Lưng", equipment: "Xà đơn", sets: 4, reps: "6-10", restSec: 120, img: IMG.muscle_back,
    guide: "Nắm xà rộng hơn vai, bắt đầu từ tư thế treo thẳng tay, kéo người lên đến khi cằm qua xà bằng lực lưng xô, hạ xuống có kiểm soát, tránh đung đưa thân." },
  bentoverrow: { name: "Kéo tạ gập người (Bent-over Row)", muscle: "Lưng", equipment: "Thanh đòn", sets: 4, reps: "8-10", restSec: 90, img: IMG.muscle_back,
    guide: "Gập hông ~45°, lưng thẳng tự nhiên, kéo thanh đòn về phía bụng dưới, siết bả vai ở điểm cuối, hạ tạ chậm để kiểm soát trọng lượng." },
  latpulldown: { name: "Kéo xô cáp (Lat Pulldown)", muscle: "Lưng", equipment: "Máy cáp", sets: 3, reps: "10-12", restSec: 75, img: IMG.muscle_back,
    guide: "Ngồi thẳng lưng, kéo thanh xuống ngang ngực trên bằng lực lưng chứ không phải tay, siết xô ở điểm cuối rồi thả lên có kiểm soát." },
  deadlift: { name: "Deadlift (Nâng tạ từ sàn)", muscle: "Lưng / Chân", equipment: "Thanh đòn", sets: 4, reps: "5-6", restSec: 150, img: IMG.muscle_back,
    guide: "Giữ thanh sát ống chân, lưng thẳng tự nhiên, đẩy hông về sau khi cúi xuống nắm tạ, đứng lên bằng lực đẩy của chân và hông, không cong lưng dưới." },
  overheadpress: { name: "Đẩy vai (Overhead Press)", muscle: "Vai", equipment: "Thanh đòn", sets: 4, reps: "6-8", restSec: 90, img: IMG.muscle_shoulders,
    guide: "Đứng thẳng, siết cơ bụng và mông, đẩy tạ thẳng lên trên đầu theo đường thẳng, tránh ưỡn lưng dưới quá mức khi tạ qua mặt." },
  lateralraise: { name: "Nâng tạ vai bên (Lateral Raise)", muscle: "Vai", equipment: "Tạ đơn", sets: 3, reps: "12-15", restSec: 60, img: IMG.muscle_shoulders,
    guide: "Nâng hai tạ đơn sang ngang đến khi ngang vai, khuỷu tay hơi gập, hạ xuống chậm, tránh dùng lực đà từ thân người." },
  facepull: { name: "Kéo cáp mặt (Face Pull)", muscle: "Vai", equipment: "Cáp", sets: 3, reps: "15", restSec: 45, img: IMG.muscle_shoulders,
    guide: "Kéo dây cáp về phía mặt, khuỷu tay cao ngang vai, xoay ngoài vai ở điểm cuối để kích hoạt cơ vai sau và chóp xoay, tốt cho tư thế." },
  squat: { name: "Gánh tạ (Back Squat)", muscle: "Chân", equipment: "Thanh đòn", sets: 4, reps: "6-8", restSec: 150, img: IMG.muscle_legs,
    guide: "Đặt chân rộng bằng vai, ngồi xuống bằng cách đẩy hông ra sau và gập gối, giữ ngực thẳng, xuống đến khi đùi song song sàn rồi đẩy mạnh qua gót chân để đứng lên." },
  legpress: { name: "Đẩy chân (Leg Press)", muscle: "Chân", equipment: "Máy", sets: 3, reps: "10-12", restSec: 90, img: IMG.muscle_legs,
    guide: "Đặt chân rộng bằng vai trên bệ đạp, hạ tạ đến khi gối tạo góc ~90°, đẩy qua gót chân, không khóa cứng khớp gối ở điểm cuối." },
  lunges: { name: "Lunge (Bước chùng chân)", muscle: "Chân", equipment: "Tạ đơn", sets: 3, reps: "10-12 mỗi chân", restSec: 75, img: IMG.muscle_legs,
    guide: "Bước một chân ra trước, hạ người đến khi cả hai gối tạo góc ~90°, giữ thân thẳng, đẩy qua gót chân trước để trở về vị trí ban đầu." },
  legcurl: { name: "Cuốn gân kheo (Leg Curl)", muscle: "Chân", equipment: "Máy", sets: 3, reps: "12-15", restSec: 60, img: IMG.muscle_legs,
    guide: "Nằm sấp trên máy, cuốn tạ về phía mông bằng lực gân kheo, siết chặt ở điểm cuối rồi hạ chậm về vị trí ban đầu." },
  calfraise: { name: "Nâng bắp chân (Calf Raise)", muscle: "Chân", equipment: "Máy / Tạ đơn", sets: 4, reps: "15-20", restSec: 45, img: IMG.muscle_legs,
    guide: "Đứng trên mũi bàn chân, nâng gót lên cao hết mức, giữ 1 giây ở đỉnh rồi hạ xuống chậm để căng giãn hết cỡ bắp chân." },
  bicepcurl: { name: "Cuốn tay trước (Bicep Curl)", muscle: "Tay trước", equipment: "Tạ đơn", sets: 3, reps: "10-12", restSec: 60, img: IMG.muscle_arms,
    guide: "Giữ khuỷu tay sát thân người, cuốn tạ lên bằng lực cơ tay trước, siết ở đỉnh rồi hạ chậm, tránh đung đưa vai để tạo đà." },
  hammercurl: { name: "Cuốn tay búa (Hammer Curl)", muscle: "Tay trước", equipment: "Tạ đơn", sets: 3, reps: "10-12", restSec: 60, img: IMG.muscle_arms,
    guide: "Cầm tạ theo chiều dọc (lòng bàn tay hướng vào thân), cuốn lên giữ cổ tay trung lập, động tác kích hoạt thêm cơ cánh tay quay." },
  tricepdip: { name: "Xà tay sau (Tricep Dip)", muscle: "Tay sau", equipment: "Ghế / Xà kép", sets: 3, reps: "10-12", restSec: 75, img: IMG.muscle_arms,
    guide: "Hạ người xuống bằng cách gập khuỷu tay ra sau, giữ khuỷu sát thân, xuống đến khi vai ngang khuỷu rồi đẩy lên hết tầm." },
  tricepsdown: { name: "Ép tay sau cáp (Tricep Pushdown)", muscle: "Tay sau", equipment: "Cáp", sets: 3, reps: "12-15", restSec: 60, img: IMG.muscle_arms,
    guide: "Giữ khuỷu tay cố định sát thân, đẩy thanh cáp xuống đến khi tay duỗi thẳng, siết tay sau ở điểm cuối rồi thả chậm." },
  plank: { name: "Plank", muscle: "Bụng", equipment: "Trọng lượng cơ thể", sets: 3, reps: "45-60 giây", restSec: 45, img: IMG.muscle_core,
    guide: "Chống khuỷu tay và mũi chân, giữ thân người thẳng từ đầu đến gót, siết chặt cơ bụng và mông, tránh võng lưng dưới." },
  hangingleg: { name: "Nâng chân treo xà (Hanging Leg Raise)", muscle: "Bụng", equipment: "Xà đơn", sets: 3, reps: "12-15", restSec: 60, img: IMG.muscle_core,
    guide: "Treo người trên xà, nâng hai chân thẳng lên đến ngang hông bằng lực cơ bụng dưới, hạ xuống có kiểm soát, tránh dùng lực đà." },
  russiantwist: { name: "Russian Twist", muscle: "Bụng", equipment: "Tạ đơn / Bóng tạ", sets: 3, reps: "20 (mỗi bên 1 lần)", restSec: 45, img: IMG.muscle_core,
    guide: "Ngồi nghiêng thân ra sau một góc, xoay thân sang hai bên luân phiên chạm tạ xuống sàn, giữ cơ bụng siết chặt suốt động tác." },
  crunch: { name: "Gập bụng (Crunch)", muscle: "Bụng", equipment: "Trọng lượng cơ thể", sets: 3, reps: "15-20", restSec: 45, img: IMG.muscle_core,
    guide: "Nằm ngửa, gối gập, cuộn phần vai trên khỏi sàn bằng lực cơ bụng, không kéo cổ bằng tay, siết bụng ở điểm cao nhất." },
  running: { name: "Chạy bộ (Cardio ổn định)", muscle: "Tim mạch", equipment: "Máy chạy / Ngoài trời", sets: 1, reps: "20-30 phút", restSec: 0, img: IMG.muscle_cardio,
    guide: "Duy trì nhịp tim ở vùng 60-70% nhịp tim tối đa (Zone 2), thở đều, giữ nhịp chạy ổn định suốt thời gian tập để tối ưu đốt mỡ và sức bền tim mạch." },
  jumprope: { name: "Nhảy dây (HIIT)", muscle: "Tim mạch", equipment: "Dây nhảy", sets: 6, reps: "30s nhảy / 30s nghỉ", restSec: 30, img: IMG.muscle_cardio,
    guide: "Nhảy nhịp nhàng bằng cổ tay xoay dây, giữ đầu gối hơi chùng để giảm chấn động khớp, luân phiên cường độ cao/nghỉ theo mô hình HIIT." },
  rowing: { name: "Máy chèo thuyền (Rowing)", muscle: "Tim mạch / Toàn thân", equipment: "Máy chèo", sets: 1, reps: "15-20 phút", restSec: 0, img: IMG.muscle_cardio,
    guide: "Đẩy chân trước, sau đó ngả thân ra sau và kéo tay về ngực; thứ tự ngược lại khi trả về, giữ nhịp thở đều toàn bộ quãng thời gian." },
  burpee: { name: "Burpee", muscle: "Toàn thân", equipment: "Trọng lượng cơ thể", sets: 4, reps: "10-12", restSec: 60, img: IMG.muscle_cardio,
    guide: "Từ tư thế đứng hạ xuống chống tay, bật chân ra sau thành plank, chống đẩy (tùy chọn), bật chân về rồi nhảy thẳng lên cao, lặp lại liên tục." },
};

/* ---------- Chương trình tập mẫu ---------- */
const PROGRAMS = {
  "tang-co": {
    name: "Sức Mạnh Toàn Thân — Tăng Cơ",
    tagline: "CHƯƠNG TRÌNH TẬP LUYỆN ELITE",
    days: {
      "T2": { title: "Ngực & Tay sau", intensity: "Cao", duration: 75, exercises: ["benchpress", "inclinedb", "cablefly", "tricepdip", "tricepsdown"] },
      "T3": { title: "Lưng & Tay trước", intensity: "Cao", duration: 70, exercises: ["pullup", "bentoverrow", "latpulldown", "bicepcurl", "hammercurl"] },
      "T4": { title: "Phục hồi & Cardio nhẹ", intensity: "Thấp", duration: 30, exercises: ["running"] },
      "T5": { title: "Vai & Bụng", intensity: "Vừa", duration: 60, exercises: ["overheadpress", "lateralraise", "facepull", "plank", "hangingleg"] },
      "T6": { title: "Chân — Sức Mạnh", intensity: "Cao", duration: 75, exercises: ["squat", "legpress", "lunges", "legcurl", "calfraise"] },
      "T7": { title: "Cardio & Vận động linh hoạt", intensity: "Vừa", duration: 40, exercises: ["rowing", "jumprope"] },
      "CN": { title: "Nghỉ ngơi hoàn toàn", intensity: "Nghỉ", duration: 0, exercises: [] },
    },
  },
  "giam-mo": {
    name: "Đốt Mỡ Toàn Thân",
    tagline: "CHƯƠNG TRÌNH ĐỐT MỠ HIỆU QUẢ",
    days: {
      "T2": { title: "Toàn thân A", intensity: "Cao", duration: 55, exercises: ["squat", "benchpress", "bentoverrow", "plank"] },
      "T3": { title: "Cardio HIIT", intensity: "Rất cao", duration: 30, exercises: ["jumprope", "burpee", "running"] },
      "T4": { title: "Toàn thân B", intensity: "Cao", duration: 55, exercises: ["deadlift", "overheadpress", "pullup", "russiantwist"] },
      "T5": { title: "Nghỉ ngơi hoàn toàn", intensity: "Nghỉ", duration: 0, exercises: [] },
      "T6": { title: "Toàn thân C", intensity: "Cao", duration: 55, exercises: ["legpress", "inclinedb", "latpulldown", "crunch"] },
      "T7": { title: "Cardio ổn định", intensity: "Vừa", duration: 35, exercises: ["running", "rowing"] },
      "CN": { title: "Nghỉ ngơi hoàn toàn", intensity: "Nghỉ", duration: 0, exercises: [] },
    },
  },
};

const DAY_KEYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_LABELS = { T2: "Thứ 2", T3: "Thứ 3", T4: "Thứ 4", T5: "Thứ 5", T6: "Thứ 6", T7: "Thứ 7", CN: "Chủ nhật" };

/* ---------- Cơ sở dữ liệu thực phẩm (kcal / protein / carbs / fat trên 100g) ---------- */
/* Giá trị trung bình tham khảo — theo USDA FoodData Central & Bảng thành phần thực phẩm Việt Nam. */
const FOODS = [
  { id: "com-trang", name: "Cơm trắng (đã nấu)", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: "com-gao-lut", name: "Cơm gạo lứt", kcal: 112, protein: 2.6, carbs: 23, fat: 0.9 },
  { id: "bun-pho", name: "Bún / Bánh phở", kcal: 109, protein: 2, carbs: 25, fat: 0.2 },
  { id: "banh-mi", name: "Bánh mì trắng", kcal: 265, protein: 9, carbs: 49, fat: 3.2 },
  { id: "yen-mach", name: "Yến mạch (khô)", kcal: 389, protein: 16.9, carbs: 66, fat: 6.9 },
  { id: "khoai-lang", name: "Khoai lang (luộc)", kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { id: "khoai-tay", name: "Khoai tây (luộc)", kcal: 87, protein: 1.9, carbs: 20, fat: 0.1 },
  { id: "bap", name: "Bắp / Ngô (luộc)", kcal: 96, protein: 3.4, carbs: 21, fat: 1.5 },
  { id: "uc-ga", name: "Ức gà (luộc, không da)", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "dui-ga", name: "Đùi gà (có da)", kcal: 209, protein: 26, carbs: 0, fat: 10.9 },
  { id: "uc-vit", name: "Ức vịt", kcal: 201, protein: 23, carbs: 0, fat: 11.2 },
  { id: "thit-bo-nac", name: "Thịt bò nạc", kcal: 250, protein: 26, carbs: 0, fat: 15 },
  { id: "thit-heo-nac", name: "Thịt heo nạc", kcal: 143, protein: 21, carbs: 0, fat: 6 },
  { id: "thit-heo-ba-chi", name: "Thịt heo ba chỉ", kcal: 518, protein: 9.3, carbs: 0, fat: 53 },
  { id: "ca-hoi", name: "Cá hồi", kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "ca-basa", name: "Cá basa / Cá tra", kcal: 90, protein: 17, carbs: 0, fat: 2 },
  { id: "ca-ngu", name: "Cá ngừ (đóng hộp, ráo nước)", kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { id: "tom-luoc", name: "Tôm (luộc)", kcal: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  { id: "trung-ga", name: "Trứng gà (luộc)", kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { id: "sua-tuoi-khong-duong", name: "Sữa tươi không đường", kcal: 42, protein: 3.4, carbs: 5, fat: 1 },
  { id: "sua-tuoi-co-duong", name: "Sữa tươi có đường", kcal: 61, protein: 3, carbs: 9.7, fat: 1 },
  { id: "sua-chua-khong-duong", name: "Sữa chua không đường", kcal: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  { id: "sua-chua-hy-lap", name: "Sữa chua Hy Lạp", kcal: 97, protein: 9, carbs: 3.6, fat: 5 },
  { id: "pho-mai", name: "Phô mai (Cheddar)", kcal: 403, protein: 25, carbs: 1.3, fat: 33 },
  { id: "dau-hu", name: "Đậu hũ", kcal: 76, protein: 8, carbs: 1.9, fat: 4.8 },
  { id: "dau-nanh-luoc", name: "Đậu nành luộc (Edamame)", kcal: 121, protein: 11, carbs: 10, fat: 5 },
  { id: "dau-den", name: "Đậu đen (đã nấu)", kcal: 132, protein: 8.9, carbs: 23, fat: 0.5 },
  { id: "bong-cai-xanh", name: "Bông cải xanh (luộc)", kcal: 35, protein: 2.4, carbs: 7, fat: 0.4 },
  { id: "rau-muong", name: "Rau muống (xào)", kcal: 45, protein: 2.5, carbs: 4, fat: 2.5 },
  { id: "ca-chua", name: "Cà chua", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { id: "dua-leo", name: "Dưa leo", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { id: "xa-lach", name: "Xà lách", kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  { id: "chuoi", name: "Chuối", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { id: "tao", name: "Táo", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { id: "cam", name: "Cam", kcal: 47, protein: 0.9, carbs: 12, fat: 0.1 },
  { id: "bo-avocado", name: "Bơ (trái bơ)", kcal: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  { id: "nho", name: "Nho", kcal: 69, protein: 0.7, carbs: 18, fat: 0.2 },
  { id: "bo-dau-phong", name: "Bơ đậu phộng", kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { id: "hanh-nhan", name: "Hạnh nhân", kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { id: "oc-cho", name: "Hạt óc chó", kcal: 654, protein: 15, carbs: 14, fat: 65 },
  { id: "dau-oliu", name: "Dầu ô liu", kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { id: "bo-dong-vat", name: "Bơ động vật (Butter)", kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  { id: "duong-trang", name: "Đường trắng", kcal: 387, protein: 0, carbs: 100, fat: 0 },
  { id: "mat-ong", name: "Mật ong", kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  { id: "sua-dau-nanh", name: "Sữa đậu nành không đường", kcal: 33, protein: 3.3, carbs: 1.8, fat: 1.8 },
  { id: "mi-goi", name: "Mì gói (khô, chưa nêm)", kcal: 436, protein: 9, carbs: 60, fat: 17 },
  { id: "khoai-mon", name: "Khoai môn (luộc)", kcal: 112, protein: 1.5, carbs: 26, fat: 0.2 },
  { id: "nuoc-cam", name: "Nước cam ép", kcal: 45, protein: 0.7, carbs: 10.4, fat: 0.2 },
  { id: "banh-quy", name: "Bánh quy", kcal: 480, protein: 6, carbs: 65, fat: 22 },
  { id: "chocolate-den", name: "Chocolate đen (70%)", kcal: 598, protein: 7.8, carbs: 45.9, fat: 42.6 },
];

/* ---------- Bữa ăn trong ngày ---------- */
const MEAL_TYPES = [
  { id: "breakfast", label: "Bữa sáng", defaultTime: "07:00", icon: "wb_twilight" },
  { id: "lunch", label: "Bữa trưa", defaultTime: "12:00", icon: "wb_sunny" },
  { id: "dinner", label: "Bữa tối", defaultTime: "19:00", icon: "dinner_dining" },
  { id: "snack", label: "Ăn vặt", defaultTime: "15:00", icon: "cookie" },
];

/* ---------- Danh mục kho video tập luyện ---------- */
const VIDEO_CATEGORIES = [
  { id: "home", label: "Trong nhà", icon: "home" },
  { id: "outdoor", label: "Ngoài trời", icon: "park" },
  { id: "gym", label: "Phòng gym", icon: "fitness_center" },
];

/* ---------- Nhóm cơ (dùng khi tạo bài tập tuỳ chỉnh) ---------- */
const MUSCLE_GROUPS = ["Ngực", "Lưng", "Vai", "Chân", "Tay trước", "Tay sau", "Bụng", "Tim mạch", "Toàn thân", "Tuỳ chỉnh"];
const INTENSITY_LEVELS = ["Nghỉ", "Thấp", "Vừa", "Cao", "Rất cao"];

/* ---------- Góc chụp ảnh tiến trình (giúp canh khung/khoảng cách nhất quán) ---------- */
const PHOTO_ANGLES = [
  { id: "front", label: "Chính diện", hint: "Đứng thẳng đối diện camera, hai tay để tự nhiên dọc thân, chân mở rộng bằng vai, cách camera 2–2.5m." },
  { id: "side", label: "Nghiêng 90°", hint: "Xoay người 90° sang một bên (khuyên chọn cùng một bên mỗi lần chụp), giữ lưng thẳng, mắt nhìn về phía trước." },
  { id: "back", label: "Sau lưng", hint: "Quay lưng lại camera, đứng thẳng tự nhiên, hai tay xuôi theo thân." },
];

/* ---------- Chỉ số cơ thể lưu trong kho InBody ---------- */
const INBODY_FIELDS = [
  { id: "weight", label: "Cân nặng", unit: "kg", icon: "monitor_weight" },
  { id: "bodyFatPct", label: "Tỉ lệ mỡ cơ thể", unit: "%", icon: "percent" },
  { id: "muscleMassKg", label: "Khối lượng cơ", unit: "kg", icon: "exercise" },
  { id: "bodyWaterPct", label: "Nước trong cơ thể", unit: "%", icon: "water_full" },
  { id: "visceralFat", label: "Mỡ nội tạng", unit: "cấp", icon: "warning" },
];

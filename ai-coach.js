/* =========================================================================
   TapEasy — TRỢ LÝ AI (ai-coach.js) · 16/11/2026 · docs/AI-COACH.md
   Nạp SAU app.js, meals.js, templates.js, program-builder.js, plan-tools.js.

   1. KHO KIẾN THỨC CỦA APP (FKCoach.lib): bài tập, món ăn, thực phẩm, giáo án mẫu, bài kiến thức, hướng dẫn dùng app
      → tìm không dấu, ghép thành ngữ cảnh gửi kèm câu hỏi để AI trả lời ĐÚNG thứ đang có trong app (kèm nút bấm mở thẳng).
   2. TRÒ CHUYỆN: hỏi tự do về tập luyện · ăn uống · ngủ nghỉ · sức khoẻ nhẹ · cách dùng app.
   3. KẾ HOẠCH 4 TAB: Tập luyện · Ăn uống · Ngủ & Nghỉ · Sức khỏe — từ form thông tin (mục tiêu, thiết bị, trình độ,
      cân nặng/chiều cao, giấc ngủ, chế độ ăn/dị ứng). Lịch tập ghép từ bài có trong app → "Thêm vào tuần tập" 1 chạm.
   4. CARDIO SAU BUỔI TẬP: thẻ gợi ý ở màn Tập luyện (LISS 15–30 phút; không HIIT sau buổi chân/lưng nặng; 8–10 nghìn bước).
   AI: Cloud Function aiChat (cần đăng nhập, quản trị viên bật trong Bảng quản trị → Trợ lý AI).
   Chưa đăng nhập / AI tắt / mất mạng → BỘ LUẬT TRÊN MÁY vẫn lập kế hoạch và trả lời từ kho kiến thức (ghi rõ nguồn).
   Mọi nội dung AI trả về đều được đối chiếu lại với thư viện của app (mã lạ bị bỏ), HTML được thoát an toàn.
   ========================================================================= */
(function(G){
"use strict";
if(G.FKCoach && G.FKCoach.__v) return;
const CL = ()=>{ try{ if(typeof cloud !== "undefined" && cloud) return cloud; }catch(e){} return G.cloud || null; };
const ST = ()=>{ try{ return typeof state !== "undefined" ? state : null; }catch(e){ return null; } };
const EX = ()=>{ try{ return typeof EXERCISES !== "undefined" ? EXERCISES : {}; }catch(e){ return {}; } };
const RC = ()=>{ try{ return typeof RECIPES !== "undefined" ? RECIPES : []; }catch(e){ return []; } };
const FD = ()=>{ try{ return typeof FOODS !== "undefined" ? FOODS : []; }catch(e){ return []; } };
const TP = ()=>{ try{ return typeof PROGRAM_TEMPLATES !== "undefined" ? PROGRAM_TEMPLATES : []; }catch(e){ return []; } };
const DK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DL = { T2:"Thứ 2", T3:"Thứ 3", T4:"Thứ 4", T5:"Thứ 5", T6:"Thứ 6", T7:"Thứ 7", CN:"Chủ nhật" };
const esc = s=> String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const fold = s=> String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const num = (v, lo, hi, d)=>{ if(v == null || String(v).trim() === "") return d; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const nf = n=> (Math.round(Number(n) || 0)).toLocaleString("vi-VN");
const save = ()=>{ try{ if(typeof saveState === "function") saveState(); }catch(e){} };
const say = (m, i)=>{ try{ if(typeof toast === "function") toast(m, i); }catch(e){} };
/* Ngôn ngữ: giao diện tĩnh do lớp FK_I18N dịch (từ điển i18n-en-7.js); câu DỰNG ĐỘNG (có số liệu, in đậm) viết sẵn 2 bản qua T(vi, en). */
const LANG = ()=>{ try{ return (G.FK_I18N && G.FK_I18N.lang) || "vi"; }catch(e){ return "vi"; } };
const EN = ()=> LANG() !== "vi";
const T = (vi, en)=> EN() ? en : vi;
const tr = s=>{ if(!EN()) return s; try{ return G.FK_I18N.t(String(s)) || s; }catch(e){ return s; } };
/** Tên bài tập "Tên Việt (English)" → tiếng Việt: bỏ ngoặc · English: lấy phần trong ngoặc */
const nm = name=>{ name = String(name == null ? "" : name); if(!EN()) return name.replace(/\s*\(.*\)$/, ""); const VI = /[\u00C0-\u1EF9]/, m = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(name);
  if(m && !VI.test(m[2])) return m[2]; if(m && !VI.test(m[1])) return m[1];           // "Deadlift (Nâng tạ từ sàn)" → phần không dấu
  const t = tr(name); return VI.test(t) && m ? tr(m[1]) : t; };
const dec = n=> EN() ? String(n) : String(n).replace(".", ",");
const DISCLAIMER = "Gợi ý dựa trên thông tin bạn cung cấp — không thay thế tư vấn của bác sĩ hay chuyên gia dinh dưỡng.";

/* =====================================================================
   1. KHO KIẾN THỨC
   ===================================================================== */
const GUIDE_EN = [
  ["create custom program build my own plan routine", "Build your own program: go to **Workout → My programs → Create custom program**, answer a few questions (goal, days, equipment, sore areas) and the app arranges the exercises by coaching rules."],
  ["template programs ready made ppl upper lower full body", "Program templates: **Workout → Program templates**, filter by gender and level, tap **Add to my week** — the app attaches guide videos automatically."],
  ["start workout session log sets weight reps", "Log a workout: in **Workout** tap **Start workout**, type kg and reps, then tap ✓ for each set; the rest timer starts by itself and the weight fills down to the next sets."],
  ["set type warm up drop set failure", "Set types: during a workout, **tap the set number** to mark it Warm-up (W), Drop set (D), Failure (F) or delete the set. Warm-up sets do not count toward records."],
  ["change equipment machine busy smith dumbbell cable swap exercise", "Change equipment: during a workout tap **Change equipment** (barbell / dumbbell / Smith / machine / cable). If the machine is taken, tap **Machine busy — do it last**."],
  ["add exercise mid workout during session", "Add an exercise mid-workout: tap **Add exercise** right in the logging screen and search the library (800+ exercises)."],
  ["reorder drag exercises change order", "Reorder exercises: in **My programs**, press and hold an exercise, then drag it up or down."],
  ["superset link pair exercises", "Supersets: in **My programs** tap the link icon between two neighbouring exercises to pair them."],
  ["records pr 1rm progress chart history", "Progress & records: the **Progress** menu shows weight, training volume and estimated 1RM charts; during a workout tap **History** on any exercise."],
  ["photo food scan calories camera ai", "Photo calorie scan: **Nutrition → Photo calorie scan**. Shoot straight from above in good light with chopsticks or a spoon for scale; add cooking oil by hand for accuracy."],
  ["log meal add food diary", "Log a meal: **Nutrition → + button**, pick the meal, search a food or dish and enter grams."],
  ["meal plan suggestion weekly menu", "Meal plan: in **Nutrition**, the meal-plan card follows your calorie target; tap ⇄ to swap a dish and **Log to today** to save it."],
  ["healthy recipes cooking see all dishes", "Recipes: **Nutrition → Healthy dishes → See all** to scroll every dish, search, and filter by Fat loss / Muscle gain / Vegetarian…"],
  ["water drink hydration reminder", "Water: the water card in **Nutrition** — tap to add a glass; the target is based on body weight (30–40 ml/kg)."],
  ["sleep log bedtime wake", "Sleep: the **Sleep** menu logs bed and wake times and quality, shows your weekly average and lets you set a sleep goal."],
  ["reminders notifications workout time meal time", "Reminders: the **Reminders** menu turns on workout, meal, water and bedtime reminders."],
  ["personal trainer coach find pt client connect", "Trainers: the **PT** tab lets you find a coach, view profiles and reviews and send a request; your coach can assign programs and follow your progress."],
  ["community posts challenges events", "Community & events: the **Community** menu for posts and challenges; **Events** to register and check in."],
  ["theme colour color appearance dark light", "Appearance: **Profile → Appearance** to choose a colour pack; text, buttons and logo follow."],
  ["language english vietnamese", "Language: **Profile → Language** switches between Vietnamese and English."],
  ["install app home screen phone", "Install: **Profile → Install TapEasy on your phone** shows picture steps for each device (iPhone, Android, Samsung)."],
  ["backup sync account lost data new phone", "Backup: sign in — programs, workout logs, meals and meal plans sync automatically; sign in on a new phone to get them back."],
  ["delete account privacy data", "Delete account: **Profile → Account → Delete account**; server data is removed as described in the privacy policy."],
  ["calorie target protein tdee bmr macros adjust", "Calorie target: **Profile → Body stats** — the app calculates BMR/TDEE and protein–carbs–fat for your goal; you can edit them by hand."],
  ["deload week cycle", "Deload week: the app suggests a lighter week on the program's cycle; weights are pre-filled lower for those sessions."],
];
const GUIDE = [
  ["tao giao an rieng lap lich tap moi", "Tạo giáo án riêng: vào **Tập luyện → Giáo án của tôi → Tạo giáo án riêng**, trả lời vài câu (mục tiêu, số buổi, dụng cụ, chỗ đau) — app tự xếp bài theo luật chuyên môn."],
  ["giao an mau chuong trinh co san ppl upper lower full body", "Giáo án mẫu: **Tập luyện → Giáo án mẫu**, lọc theo giới tính và trình độ, bấm **Thêm vào tuần tập** — app tự gắn video hướng dẫn."],
  ["bat dau buoi tap ghi hiep kg so lan", "Ghi buổi tập: ở **Tập luyện** bấm **Bắt đầu buổi tập**, gõ kg và số lần rồi bấm ✓ từng hiệp; đồng hồ nghỉ tự chạy, kg tự điền xuống hiệp sau."],
  ["loai hiep khoi dong drop set toi han warm up", "Loại hiệp: trong buổi tập, **chạm vào số hiệp** để đánh dấu Khởi động (W), Drop set (D), Tới hạn (F) hoặc xoá hiệp. Hiệp khởi động không tính kỷ lục."],
  ["doi dung cu may ban smith ta don cap thay bai", "Đổi dụng cụ: trong buổi tập bấm **Đổi dụng cụ** (đòn / tạ đơn / Smith / máy / cáp). Máy đang bận thì bấm **Máy đang bận — để cuối buổi**."],
  ["them bai giua buoi them bai tap", "Thêm bài giữa buổi: bấm **Thêm bài** ngay trong màn ghi buổi tập, tìm trong thư viện (có 800+ bài)."],
  ["keo doi thu tu sap xep bai tap", "Đổi thứ tự bài: ở **Giáo án của tôi**, giữ một bài rồi kéo lên/xuống."],
  ["superset sieu hiep ghep bai", "Superset: trong **Giáo án của tôi** bấm biểu tượng liên kết giữa hai bài liền nhau để ghép thành siêu hiệp."],
  ["ky luc 1rm tien do bieu do lich su", "Tiến độ & kỷ lục: menu **Tiến độ** xem biểu đồ cân nặng, khối lượng tập, 1RM ước tính; trong buổi tập bấm **Lịch sử** của từng bài."],
  ["chup anh mon an tinh calo ai quet", "Chụp ảnh tính calo: **Dinh dưỡng → Chụp ảnh tính calo**. Chụp thẳng từ trên xuống, đủ sáng, có đũa/thìa làm thước đo; dầu mỡ thêm tay cho chính xác."],
  ["ghi bua an them mon nhat ky an uong", "Ghi bữa ăn: **Dinh dưỡng → dấu +** chọn bữa, tìm thực phẩm hoặc món, nhập gam."],
  ["thuc don goi y ke hoach an tuan", "Thực đơn gợi ý: ở **Dinh dưỡng**, thẻ thực đơn theo mục tiêu calo của bạn; bấm ⇄ để đổi món, **Ghi vào hôm nay** để lưu."],
  ["mon healthy cong thuc nau an xem tat ca", "Công thức: **Dinh dưỡng → Món healthy → Xem tất cả** để cuộn toàn bộ món, tìm không dấu, lọc Giảm mỡ / Tăng cơ / Chay…"],
  ["uong nuoc nhac nuoc", "Nước: thẻ nước ở **Dinh dưỡng**, chạm để cộng từng cốc; mục tiêu tính theo cân nặng (30–40 ml/kg)."],
  ["ngu giac ngu ghi gio ngu", "Giấc ngủ: menu **Giấc ngủ** để ghi giờ ngủ–dậy, chất lượng và xem trung bình tuần; đặt mục tiêu giờ ngủ trong đó."],
  ["nhac nho thong bao gio tap gio an", "Nhắc nhở: menu **Nhắc nhở** bật giờ tập, giờ ăn, uống nước, giờ ngủ."],
  ["pt huan luyen vien tim pt hoc vien ket noi", "PT: thẻ **PT** để tìm huấn luyện viên, xem hồ sơ, đánh giá và gửi lời mời; PT giao giáo án và theo dõi tiến độ của bạn."],
  ["cong dong bai dang thu thach su kien", "Cộng đồng & sự kiện: menu **Cộng đồng** để đăng bài, tham gia thử thách; **Sự kiện** để đăng ký và check-in."],
  ["doi mau giao dien theme toi sang", "Giao diện: **Hồ sơ → Giao diện** chọn gói màu; chữ, nút và logo đổi theo."],
  ["ngon ngu tieng anh english", "Ngôn ngữ: **Hồ sơ → Ngôn ngữ** chuyển Việt / English."],
  ["cai app len dien thoai man hinh chinh", "Cài app: **Hồ sơ → Cài TapEasy lên điện thoại** có hình hướng dẫn theo từng máy (iPhone, Android, Samsung)."],
  ["sao luu dong bo tai khoan mat du lieu doi may", "Sao lưu: đăng nhập tài khoản — giáo án, nhật ký tập, bữa ăn, thực đơn tự đồng bộ; đổi máy đăng nhập lại là có."],
  ["xoa tai khoan quyen rieng tu du lieu", "Xoá tài khoản: **Hồ sơ → Tài khoản → Xoá tài khoản**; dữ liệu trên máy chủ bị xoá theo chính sách quyền riêng tư."],
  ["muc tieu calo dam tdee bmr chinh macro", "Mục tiêu calo: **Hồ sơ → Chỉ số cơ thể** — app tính BMR/TDEE và đạm–tinh bột–béo theo mục tiêu; có thể tự chỉnh tay."],
  ["tuan giam tai deload chu ky", "Tuần giảm tải: app tự gợi ý giảm khối lượng theo chu kỳ giáo án; buổi đó mức tạ được điền sẵn thấp hơn."],
].map(([k, a], i)=> ({ t: "guide", id: "g" + i, name: a.split(":")[0], text: fold(k + " " + a + " " + GUIDE_EN[i][0] + " " + GUIDE_EN[i][1]), line: a, lineEn: GUIDE_EN[i][1] }));

const TOPICS = [
  { re: /\b(cardio|chay bo|di bo|hiit|dot mo|buoc)\b/, reEn: /cardio|treadmill|walk|hiit|fat burn|steps|running|jog/, en: "**Cardio after lifting:** go low-to-moderate intensity (LISS) for **15–30 minutes** — incline treadmill walking, easy cycling or the stair climber.\n- Why: burns extra fat, boosts blood flow for recovery and less soreness, and builds heart health and endurance.\n- **No HIIT right after a heavy leg / back day** — move it to another day or at least 6 hours away from lifting.\n- Outside the gym: aim for **8,000–10,000 steps a day**.\n- After the whole session (cardio included) eat protein + carbs to recover.", a: "**Cardio sau buổi tạ:** ưu tiên cường độ thấp–vừa (LISS) **15–30 phút** — đi bộ dốc trên máy, đạp xe nhẹ hoặc leo cầu thang.\n- Lợi ích: đốt thêm mỡ, tăng lưu thông máu giúp phục hồi và giảm đau nhức cơ, tốt cho tim mạch và sức bền.\n- **Không HIIT ngay sau buổi chân / lưng nặng** — tách sang ngày khác hoặc cách buổi tạ ít nhất 6 giờ.\n- Ngoài phòng tập: giữ **8.000–10.000 bước/ngày**.\n- Sau cả buổi (kể cả cardio) nạp đạm + tinh bột để phục hồi.", ex: ["inclinewalk", "walking", "zone2"] },
  { re: /\b(dam|protein|whey)\b/, reEn: /protein|whey/, en: (p)=> `**Daily protein:** 1.6–2.2 g per kg of body weight${p.w ? ` → at ${p.w} kg that is about **${Math.round(p.w * 1.6)}–${Math.round(p.w * 2.2)} g**` : ""}, split over 3–5 meals (25–40 g each).\n- Good sources: chicken breast, fish, eggs, lean meat, tofu, Greek yogurt.\n- Whey is only a convenient top-up — not required if food already covers it.`, a: (p)=> `**Đạm mỗi ngày:** 1,6–2,2 g/kg cân nặng${p.w ? ` → với ${p.w} kg là khoảng **${Math.round(p.w * 1.6)}–${Math.round(p.w * 2.2)} g**` : ""}, chia 3–5 bữa (mỗi bữa 25–40 g).\n- Nguồn tốt: ức gà, cá, trứng, thịt nạc, đậu phụ, sữa chua Hy Lạp.\n- Whey chỉ là cách bù cho đủ — không bắt buộc nếu ăn đủ từ thức ăn.` },
  { re: /\b(calo|kcal|giam can|giam mo|tang can|tang co|tdee|tham hut)\b/, reEn: /calorie|kcal|lose weight|weight loss|fat loss|cut|bulk|gain weight|build muscle|tdee|deficit|surplus/, en: (p)=> `**Calories for your goal:**\n- Fat loss: eat **300–500 kcal** below maintenance (TDEE); losing 0.5–1% of body weight per week is right.\n- Muscle gain: eat **200–300 kcal** above; gaining 0.25–0.5% per week keeps fat gain low.${p.kcal ? `\n- The app's current target for you: **${p.kcal.toLocaleString("en-US")} kcal**, protein ${p.pro} g.` : ""}\n- Do not go below 1,200 kcal (women) / 1,500 kcal (men).`, a: (p)=> `**Calo theo mục tiêu:**\n- Giảm mỡ: ăn thấp hơn mức tiêu hao (TDEE) **300–500 kcal**, giảm 0,5–1% cân nặng/tuần.\n- Tăng cơ: ăn dư **200–300 kcal**, tăng 0,25–0,5% cân nặng/tuần.${p.kcal ? `\n- Mục tiêu app đang tính cho bạn: **${nf(p.kcal)} kcal**, đạm ${p.pro} g.` : ""}\n- Không ăn dưới 1.200 kcal (nữ) / 1.500 kcal (nam).` },
  { re: /\b(ngu|mat ngu|thuc khuya|buon ngu)\b/, reEn: /sleep|insomnia|tired|stay up|nap/, en: "**Sleep to recover:** 7–9 hours a night, same bed and wake time even on weekends.\n- Coffee / strong tea: stop 8 hours before bed.\n- Last big meal 2–3 hours before bed; screens off 60 minutes before.\n- Cool, dark, quiet room. Short sleep lowers strength and raises appetite.", a: "**Ngủ để phục hồi:** 7–9 giờ/đêm, giờ ngủ–dậy cố định cả cuối tuần.\n- Cà phê / trà đặc: dừng trước giờ ngủ 8 giờ.\n- Bữa lớn cuối: trước ngủ 2–3 giờ; tắt màn hình 60 phút trước ngủ.\n- Phòng mát, tối, yên tĩnh. Thiếu ngủ làm giảm sức mạnh và tăng thèm ăn." },
  { re: /\b(nuoc|uong bao nhieu)\b/, reEn: /water|hydrat|how much.*drink/, en: (p)=> `**Water:** 30–40 ml per kg per day${p.w ? ` → about **${(p.w * 0.035).toFixed(1)} litres**` : ""}; add 0.5–1 litre on training or hot days. Pale-yellow urine means you are drinking enough.`, a: (p)=> `**Nước:** 30–40 ml/kg/ngày${p.w ? ` → khoảng **${(p.w * 0.035).toFixed(1).replace(".", ",")} lít**` : ""}; ngày tập hoặc trời nóng cộng thêm 0,5–1 lít. Nước tiểu vàng nhạt là đủ.` },
  { re: /\b(dau co|doms|nhuc|moi co|phuc hoi)\b/, reEn: /sore|doms|ache|recover/, en: "**Muscle soreness (DOMS)** is normal for 24–72 hours after training.\n- Easy walking or cycling for 10–20 minutes, light stretching, enough sleep and protein.\n- You can still train other muscle groups; go lighter on the sore one.\n- **Sharp joint pain, swelling, numbness or pain that has not eased after 5–7 days → rest and see a doctor.**", a: "**Đau nhức cơ sau tập (DOMS)** bình thường trong 24–72 giờ.\n- Đi bộ nhẹ / đạp xe nhẹ 10–20 phút, giãn cơ nhẹ, ngủ đủ, ăn đủ đạm.\n- Vẫn tập được nhóm cơ khác; nhóm đang đau thì giảm tạ.\n- **Đau nhói ở khớp, sưng, tê hoặc đau không giảm sau 5–7 ngày → nghỉ và đi khám.**" },
  { re: /\b(ngay nghi|nghi may ngay|tap may buoi|bao nhieu buoi)\b/, reEn: /rest day|days off|how many (days|sessions|times)|how often/, en: "**Training days & rest:** beginners 3 sessions a week, experienced lifters 4–5; always keep **1–3 rest days**. Train each muscle group twice a week, 48 hours apart. Keep walking lightly on rest days.", a: "**Số buổi & ngày nghỉ:** người mới 3 buổi/tuần, đã quen 4–5 buổi; luôn có **1–3 ngày nghỉ**. Mỗi nhóm cơ tập 2 lần/tuần, cách nhau 48 giờ. Ngày nghỉ vẫn nên đi bộ nhẹ." },
  { re: /\b(creatine|thuc pham bo sung|bcaa|pre.?workout)\b/, reEn: /creatine|supplement|bcaa|pre.?workout/, en: "**Supplements:** the base is still eating enough, sleeping enough and training consistently. Creatine monohydrate 3–5 g a day is the most researched; whey helps you reach your protein. If you have a medical condition (kidney, heart…) or take medication → ask your doctor first.", a: "**Thực phẩm bổ sung:** nền tảng vẫn là ăn đủ – ngủ đủ – tập đều. Creatine monohydrate 3–5 g/ngày là loại được nghiên cứu nhiều nhất; whey để bù đạm. Có bệnh nền (thận, tim mạch…) hoặc đang dùng thuốc → hỏi bác sĩ trước." },
  { re: /\b(khoi dong|warm.?up|gian co)\b/, reEn: /warm.?up|stretch|mobility/, en: "**Warm-up:** 5–10 minutes of easy movement plus 1–3 ramp-up sets on the main lift (tap **Warm-up** during a workout and the app splits them for you). Save static stretching for after the session.", a: "**Khởi động:** 5–10 phút vận động nhẹ + 1–3 hiệp làm nóng tăng dần ở bài chính (trong buổi tập bấm **Khởi động** để app chia sẵn). Giãn cơ tĩnh để sau buổi tập." },
];
const MUSCLE_WORDS = [["chest", "Ngực"], ["pec", "Ngực"], ["back", "Lưng"], ["lats", "Lưng"], ["shoulder", "Vai"], ["delt", "Vai"], ["leg", "Chân"], ["quad", "Chân"], ["glute", "Mông"], ["biceps", "Tay trước"], ["triceps", "Tay sau"], ["abs", "Bụng"], ["cardio", "Tim mạch"], ["nguc", "Ngực"], ["lung", "Lưng"], ["xo", "Lưng"], ["vai", "Vai"], ["chan", "Chân"], ["dui", "Chân"], ["mong", "Mông"], ["tay truoc", "Tay trước"], ["bap tay", "Tay trước"], ["tay sau", "Tay sau"], ["bung", "Bụng"], ["core", "Bụng"], ["tim mach", "Tim mạch"]];

const MEAL_WORDS = [[/bua sang|an sang|buoi sang|breakfast/, "breakfast"], [/bua trua|an trua|lunch/, "lunch"], [/bua toi|an toi|dinner|supper/, "dinner"], [/an vat|bua phu|an nhe|snack/, "snack"]];
const EX_EN = [["Ngực", "chest pecs"], ["Lưng", "back lats"], ["Vai", "shoulders delts"], ["Chân", "legs quads"], ["Mông", "glutes"], ["Đùi sau", "hamstrings"], ["Tay trước", "biceps arms"], ["Tay sau", "triceps arms"], ["Bụng", "abs core"], ["Tim mạch", "cardio"], ["Toàn thân", "full body"], ["Giãn cơ", "stretch mobility"],
  ["Tạ đơn", "dumbbell"], ["Thanh đòn", "barbell"], ["Cáp", "cable"], ["Máy", "machine"], ["Xà đơn", "pull-up bar"], ["Xà kép", "dip bars"], ["Trọng lượng cơ thể", "bodyweight no equipment"], ["Tạ ấm", "kettlebell"], ["Dây kháng lực", "resistance band"], ["Ghế", "bench"], ["Dây nhảy", "jump rope"], ["Smith", "smith"]];
const exEn = e=> EX_EN.filter(([vi])=> String(e.muscle + " " + e.equipment).indexOf(vi) >= 0).map(x=> x[1]).join(" ");
/* Số lần / thời gian kiểu "8-10 mỗi bên", "20-30 giây" → tiếng Anh khi từ điển chưa có mẫu */
const REPS_EN = [["mỗi bên", "each side"], ["mỗi chân", "each leg"], ["mỗi tay", "each arm"], ["giây", "sec"], ["phút", "min"], ["lần", "reps"], ["bước", "steps"], ["tối đa", "max"], ["nhanh", "fast"], ["chậm", "slow"], ["nghỉ", "rest"], ["nhảy", "jump"], ["dốc", "incline"], ["mỗi tuần", "per week"], ["tới", "to"], ["tạ nhẹ", "light weight"], ["học kỹ thuật", "learn the technique"], ["đi bộ", "walk"]];
const repsTr = r=>{ if(!EN()) return String(r); let x = tr(String(r)); if(/[\u00C0-\u1EF9]/.test(x)) REPS_EN.forEach(([vi, en])=>{ x = x.split(vi).join(en); }); return x; };
/* Dị ứng gõ bằng tiếng Anh → từ khoá tiếng Việt để lọc món (lọc rộng tay: thà loại nhầm còn hơn sót) */
const ALLERGY_EN = { shrimp: "tom", prawn: "tom", prawns: "tom", shellfish: "tom,muc,ngheu", seafood: "tom,muc,ngheu,ca hoi,ca basa,ca ngu,ca thu,ca ro phi,ca nuc", squid: "muc", clam: "ngheu", clams: "ngheu",
  fish: "ca hoi,ca basa,ca ngu,ca thu,ca ro phi,ca nuc,nuoc mam", salmon: "ca hoi", tuna: "ca ngu", milk: "sua,pho mai,whey", dairy: "sua,pho mai,whey", lactose: "sua,pho mai,whey", cheese: "pho mai", yogurt: "sua chua", whey: "whey",
  egg: "trung,omelette", eggs: "trung,omelette", peanut: "dau phong", peanuts: "dau phong", nuts: "hanh nhan,hat dieu,oc cho,dau phong,mix hat", almond: "hanh nhan", almonds: "hanh nhan",
  soy: "dau nanh,dau hu,tempeh,edamame,tau hu", tofu: "dau hu,tau hu", gluten: "banh mi,mi y,mi goi,mi can,wrap,sandwich,yen mach", wheat: "banh mi,mi y,mi goi,mi can,wrap,sandwich", bread: "banh mi,sandwich",
  beef: "thit bo,bo xao,bo ap chao,bo luc lac,bo bam,bo tai,bun bo", pork: "heo,thit bam,cha lua,thit nac", chicken: "ga", meat: "ga,thit bo,bo xao,bo ap chao,bo luc lac,bo bam,bo tai,bun bo,heo,thit", oats: "yen mach", banana: "chuoi", avocado: "bo avocado,avocado,bo dam", mushroom: "nam", mushrooms: "nam", sesame: "me rang,rac me", corn: "bap" };
let _docs = null;
function docs(){
  if(_docs) return _docs;
  const out = [];
  const E = EX(); Object.keys(E).forEach(id=>{ const e = E[id];
    out.push({ t: "ex", id, name: e.name, text: fold(`${e.name} ${e.muscle} ${e.equipment} ${exEn(e)}`), line: `ex:${id} | ${e.name} | ${e.muscle} | ${e.equipment} | ${e.sets}×${e.reps}` }); });
  RC().forEach(r=>{ let m = { kcal: 0, protein: 0, carbs: 0, fat: 0 }; try{ m = recipeMacros(r); }catch(e){}
    out.push({ t: "recipe", id: r.id, name: r.name, meal: r.meal, tags: r.tags || [], items: (r.items || []).map(x=> x[0]), kcal: Math.round(m.kcal), pro: Math.round(m.protein),
      text: fold(`${r.name} ${EN() ? tr(r.name) : ""} ${(r.tags || []).join(" ")} ${r.meal} ${(r.items || []).map(x=> x[0]).join(" ")}`),
      line: `recipe:${r.id} | ${r.name} | ${Math.round(m.kcal)} kcal, đạm ${Math.round(m.protein)}g, bột ${Math.round(m.carbs)}g, béo ${Math.round(m.fat)}g | ${({ breakfast:"sáng", lunch:"trưa", dinner:"tối", snack:"phụ" })[r.meal] || ""} | ${(r.tags || []).join(",")} | ${r.min} phút` }); });
  FD().forEach(f=> out.push({ t: "food", id: f.id, name: f.name, text: fold(f.name + " " + f.id + (EN() ? " " + tr(f.name) : "")), line: `food | ${f.name} | ${f.kcal} kcal/100g, đạm ${f.protein}g, bột ${f.carbs}g, béo ${f.fat}g` }));
  TP().forEach(t=> out.push({ t: "tpl", id: t.id, name: t.name, text: fold(`${t.name} ${t.goal} ${t.level} ${t.gender} ${t.desc || ""}`), line: `tpl:${t.id} | ${t.name} | ${t.goal} | ${t.level} | ${t.perWeek} buổi/tuần | ${t.gender}` }));
  GUIDE.forEach(g=> out.push(g));
  _docs = out; return out;
}
const STOP = new Set("la gi nao the toi minh ban cho va co khong duoc nen hay can bao nhieu nhu cua trong mot cac nhung thi de ve o khi voi the an and or for with what how do does is are my me can should much many to of in on it some any best good give need want".split(" "));
const tokens = q=> fold(q).split(/[^a-z0-9]+/).filter(w=> w.length > 1 && !STOP.has(w)).map(w=> w.length > 4 && /[a-z]s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w).slice(0, 14);
/** Tìm trong kho: trả về tối đa `caps` mục mỗi loại, xếp theo điểm khớp (khớp tên nặng hơn). */
function retrieve(q, caps){
  caps = Object.assign({ ex: 12, recipe: 8, food: 8, tpl: 4, guide: 4 }, caps || {});
  const tk = tokens(q); if(!tk.length) return [];
  const fq = fold(q);
  const scored = [];
  docs().forEach(d=>{
    let s = 0; const nm = fold(d.name);
    tk.forEach(w=>{ if(d.text.indexOf(w) >= 0) s += 1; if(nm.indexOf(w) >= 0) s += 1.5; });
    if(d.t === "recipe"){                                                   // "bữa sáng nhiều đạm" → đúng bữa, ưu tiên món giàu đạm
      MEAL_WORDS.forEach(([re, meal])=>{ if(re.test(fq)) s += d.meal === meal ? 4 : -1.5; });
      if(/nhieu dam|giau dam|protein cao|tang co|high.protein|protein|muscle/.test(fq)) s += Math.min(3, (d.pro || 0) / 15);
      if(/it calo|giam mo|giam can|it beo|low.cal|fat loss|lose weight|light/.test(fq) && d.tags.indexOf("giam-mo") >= 0) s += 2;
      if(/\bchay\b|vegetarian|vegan|meatless/.test(fq)) s += d.tags.indexOf("chay") >= 0 || d.tags.indexOf("thuan-chay") >= 0 ? 3 : -3;
    }
    if(d.t === "ex") MUSCLE_WORDS.forEach(([w, m])=>{ if(fq.indexOf(w) >= 0 && d.text.indexOf(fold(m)) >= 0) s += 3; });
    if(d.t === "guide" ? s >= 4 : (s >= 2 || (s > 0 && tk.length === 1))) scored.push([s, d]);   // hướng dẫn app: phải khớp rõ mới đưa vào
  });
  scored.sort((a, b)=> b[0] - a[0]);
  const n = {}, out = [];
  scored.forEach(([s, d])=>{ n[d.t] = (n[d.t] || 0) + 1; if(n[d.t] <= (caps[d.t] || 0)) out.push(d); });
  return out;
}
function kbHits(q){
  try{ const K = G.TEKB || G.TE_KB; if(!K || !K.search || !(G.KB_ARTICLES && G.KB_ARTICLES.length)) return [];
    return ((K.search(q, { limit: 3 }) || {}).articles || []).slice(0, 3).map(a=>{ const x = a.article || a.a || a; return x && x.id ? { t: "kb", id: x.id, name: x.title || "", line: `kb:${x.id} | ${x.title || ""} | ${String(x.summary || x.desc || "").slice(0, 140)}` } : null; }).filter(Boolean);
  }catch(e){ return []; }
}

/* ---------------- hồ sơ rút gọn ---------------- */
function profile(){
  const st = ST() || {}, p = st.profile || {}, it = (st.aiCoach && st.aiCoach.intake) || {};
  const w = num(it.weight || p.weight, 30, 250, 0), h = num(it.height || p.height, 120, 230, 0);
  let sleepAvg = 0; try{ const L = Object.keys(st.sleepLog || {}).sort().slice(-7).map(d=> Number(st.sleepLog[d].hours) || 0).filter(Boolean); if(L.length) sleepAvg = Math.round(L.reduce((a, b)=> a + b, 0) / L.length * 10) / 10; }catch(e){}
  let wk = 0; try{ const since = Date.now() - 7 * 86400000; wk = (st.finishedDates || []).filter(d=> Date.parse(d) >= since).length; }catch(e){}
  return { gender: p.gender === "female" ? "nữ" : "nam", female: p.gender === "female", age: num(p.age, 10, 100, 0), w, h, goal: it.goal || p.goal || "",
    kcal: Math.round(num(p.goalKcal, 0, 6000, 0)), pro: Math.round(num(p.protein, 0, 400, 0)), carb: Math.round(num(p.carbs, 0, 900, 0)), fat: Math.round(num(p.fat, 0, 300, 0)),
    tdee: Math.round(num(p.tdee, 0, 6000, 0)), sleepGoal: num(p.sleepGoalHours, 4, 12, 8), sleepAvg, wk };
}
const GOALS = { lose: "Giảm mỡ", gain: "Tăng cơ", strength: "Sức mạnh", endurance: "Sức bền", tone: "Săn chắc" };
const GOALS_EN = { lose: "Fat loss", gain: "Muscle gain", strength: "Strength", endurance: "Endurance", tone: "Toning" };
const EXPS_EN = { beg: "beginner (under 6 months)", int: "6–24 months of training", adv: "2+ years of training" };
const DL_EN = { T2:"Monday", T3:"Tuesday", T4:"Wednesday", T5:"Thursday", T6:"Friday", T7:"Saturday", CN:"Sunday" };
const goalName = g=> (EN() ? GOALS_EN[g] : GOALS[g]) || "";
const dayName = k=> (EN() ? DL_EN[k] : DL[k]) || k;
const EXPS = { beg: "Mới tập (dưới 6 tháng)", int: "6–24 tháng", adv: "Trên 2 năm" };
const DIETS = { man: "Ăn bình thường", chay: "Ăn chay (có trứng, sữa)", "thuan-chay": "Thuần chay" };
function profileText(){
  const p = profile(), st = ST() || {}, lines = [];
  lines.push(`HỒ SƠ: ${p.gender}${p.age ? `, ${p.age} tuổi` : ""}${p.h ? `, cao ${p.h} cm` : ""}${p.w ? `, nặng ${p.w} kg` : ""}; mục tiêu: ${GOALS[p.goal] || p.goal || "chưa rõ"}.`);
  if(p.kcal) lines.push(`MỤC TIÊU APP TÍNH: ${p.kcal} kcal/ngày, đạm ${p.pro} g, tinh bột ${p.carb} g, béo ${p.fat} g (TDEE ~${p.tdee}).`);
  lines.push(`NGỦ: mục tiêu ${p.sleepGoal} giờ${p.sleepAvg ? `, trung bình 7 ngày gần đây ${p.sleepAvg} giờ` : ""}. TẬP 7 NGÀY QUA: ${p.wk} buổi.`);
  try{ const plan = getActivePlan(); if(plan && plan.days){ lines.push(`GIÁO ÁN ĐANG TẬP: ${plan.name}`);
    DK.forEach(k=>{ const d = plan.days[k]; if(d && d.items && d.items.length) lines.push(`- ${DL[k]}: ${d.title} — ${d.items.slice(0, 8).map(it=> getExerciseMeta(it).name.replace(/\s*\(.*\)$/, "")).join(", ")}`); }); } }catch(e){}
  const it = (st.aiCoach && st.aiCoach.intake) || null;
  if(it) lines.push(intakeText(it));
  try{ const h = st.health || {}; const inj = (it && it.inj) || []; if(inj.length) lines.push("VÙNG CẦN TRÁNH QUÁ TẢI: " + inj.join(", ")); if(h.under18) lines.push("LƯU Ý: người dùng dưới 18 tuổi."); }catch(e){}
  return lines.join("\n");
}
function intakeText(it){
  return `THÔNG TIN NGƯỜI DÙNG NHẬP: mục tiêu ${GOALS[it.goal] || "?"}; trình độ ${EXPS[it.exp] || "?"}; ${it.daysN} buổi/tuần, mỗi buổi ~${it.minutes} phút; tập ở ${it.place === "home" ? "nhà" + ((it.equip || []).length ? " (có: " + it.equip.join(", ") + ")" : " (không dụng cụ)") : "phòng gym đủ máy"}; ngủ trung bình ${it.sleepH} giờ, thường dậy lúc ${it.wake}; chế độ ăn: ${DIETS[it.diet] || "bình thường"}${it.allergy ? `; dị ứng / không ăn: ${it.allergy}` : ""}${it.note ? `; ghi chú: ${it.note}` : ""}.`;
}
/** Ngữ cảnh gửi kèm câu hỏi (≤ 13.500 ký tự). mode "plan" → kèm TOÀN BỘ bài tập + món hợp chế độ ăn. */
function buildContext(q, mode, intake){
  const parts = [profileText()];
  if(mode === "plan"){
    const ds = docs();
    parts.push("BÀI TẬP TRONG APP (mã | tên | nhóm cơ | dụng cụ | mặc định):\n" + ds.filter(d=> d.t === "ex").map(d=> d.line).join("\n"));
    parts.push("MÓN ĂN TRONG APP:\n" + ds.filter(d=> d.t === "recipe" && dietOk(d, intake || {})).slice(0, 46).map(d=> d.line).join("\n"));
  } else {
    const hit = retrieve(q).concat(kbHits(q));
    const by = t=> hit.filter(d=> d.t === t).map(d=> d.line);
    const sec = (title, arr)=> arr.length ? parts.push(title + "\n" + arr.join("\n")) : 0;
    sec("HƯỚNG DẪN DÙNG APP LIÊN QUAN:", by("guide")); sec("BÀI TẬP TRONG APP LIÊN QUAN (mã | tên | nhóm cơ | dụng cụ | mặc định):", by("ex"));
    sec("MÓN ĂN TRONG APP LIÊN QUAN:", by("recipe")); sec("THỰC PHẨM (trên 100 g):", by("food")); sec("GIÁO ÁN MẪU:", by("tpl")); sec("BÀI KIẾN THỨC:", by("kb"));
  }
  return parts.join("\n\n").slice(0, 13500);
}

/* =====================================================================
   2. BỘ LUẬT TRÊN MÁY (không cần AI) + ĐỐI CHIẾU KẾT QUẢ AI
   ===================================================================== */
const hhmm = (min)=>{ min = ((Math.round(min) % 1440) + 1440) % 1440; return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); };
const toMin = s=>{ const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "")); return m ? (Number(m[1]) % 24) * 60 + Number(m[2]) : 360; };
function dietOk(d, it){
  const tags = d.tags || [];
  if(it.diet === "thuan-chay" && tags.indexOf("thuan-chay") < 0) return false;
  if(it.diet === "chay" && tags.indexOf("chay") < 0 && tags.indexOf("thuan-chay") < 0) return false;
  const al = [];
  fold(it.allergy || "").split(/[,;\/\n]+/).map(s=> s.trim()).filter(s=> s.length > 1).forEach(a=>{ al.push(a); (ALLERGY_EN[a] || "").split(",").filter(Boolean).forEach(x=> al.push(x)); });
  if(al.length){                                                             // khớp NGUYÊN TỪ (không dính "ga" trong "gao", "ca" trong "cai")
    const hay = " " + String(d.text || fold(d.name)).replace(/[^a-z0-9]+/g, " ") + " ";
    if(al.some(a=>{ a = a === "ca" ? ALLERGY_EN.fish : a; return a.split(",").some(x=>{ x = x.replace(/[^a-z0-9]+/g, " ").trim(); return x && hay.indexOf(" " + x + " ") >= 0; }); })) return false;
  }
  return true;
}
const isLeg = m=> /Chân|Mông|Đùi/.test(m || ""), isBack = m=> /Lưng/.test(m || ""), isCardio = m=> /Tim mạch/.test(m || "");
/** Buổi nặng cho thân dưới / lưng? (≥ 2 bài chân-mông hoặc có bài kiểu deadlift "Lưng / Chân") */
function heavyDay(ids){
  const E = EX(); let leg = 0, back = 0, dl = false;
  (ids || []).forEach(id=>{ const e = E[id]; if(!e) return; if(isLeg(e.muscle)) leg++; if(isBack(e.muscle)) back++; if(/Lưng \/ Chân/.test(e.muscle) || /deadlift/i.test(e.name)) dl = true; });
  return leg >= 2 || dl || back >= 3;
}
/** Gợi ý cardio sau buổi tạ theo luật LISS. */
function cardioFor(ids, goal){
  if((ids || []).some(id=> isCardio((EX()[id] || {}).muscle))) return { id: "", type: "không", minutes: 0, note: T("Buổi này đã có bài cardio.", "This session already has cardio.") };
  const heavy = heavyDay(ids);
  if(heavy) return { id: "walking", type: T("Đi bộ nhẹ / đạp xe nhẹ", "Easy walk / easy cycling"), minutes: goal === "lose" ? 20 : 15, note: T("Buổi chân / lưng nặng: chỉ cardio nhẹ để tăng lưu thông máu, không HIIT.", "Heavy leg / back day: easy cardio only to boost blood flow — no HIIT.") };
  if(goal === "lose") return { id: "inclinewalk", type: T("Đi bộ dốc trên máy", "Incline treadmill walk"), minutes: 30, note: T("Cường độ thấp–vừa (còn nói chuyện được) để đốt thêm mỡ mà không ảnh hưởng phục hồi.", "Low-to-moderate intensity (you can still talk) to burn extra fat without hurting recovery.") };
  if(goal === "endurance") return { id: "zone2", type: T("Cardio Zone 2", "Zone 2 cardio"), minutes: 30, note: T("Nhịp tim vùng 2 xây nền sức bền.", "Zone 2 heart rate builds your endurance base.") };
  return { id: "inclinewalk", type: T("Đi bộ dốc trên máy", "Incline treadmill walk"), minutes: goal === "gain" || goal === "strength" ? 15 : 20, note: T("LISS ngắn sau tạ: tốt cho tim mạch, hỗ trợ phục hồi, không cản tăng cơ.", "Short LISS after lifting: good for the heart, helps recovery and does not get in the way of muscle gain.") };
}
const HIIT_RE = /hiit|interval|ngat quang|nhay day|sprint|nuoc rut|tabata|jump rope|burpee/;
function fixCardio(c, ids, goal){
  const d = cardioFor(ids, goal);
  if(!c || !c.type || /^(khong|none|no|rest|skip)$/.test(fold(c.type).trim())) return d.minutes && !heavyDay(ids) && goal !== "lose" ? { id: "", type: "không", minutes: 0, note: c && c.note || "" } : d;
  if(d.type === "không") return d;
  if(heavyDay(ids) && HIIT_RE.test(fold(c.type + " " + (c.note || "")))) return d;                 // AI xếp HIIT sau buổi chân/lưng nặng → thay bằng LISS
  const f = fold(c.type);
  const id = /doc|incline/.test(f) ? "inclinewalk" : /zone/.test(f) ? "zone2" : /di bo|walk/.test(f) ? "walking" : /cheo|\brow/.test(f) ? "rowing" : "";
  return { id: EX()[id] ? id : "", type: String(c.type).slice(0, 40), minutes: Math.min(heavyDay(ids) ? 20 : 40, Math.max(10, Math.round(num(c.minutes, 0, 60, d.minutes)))), note: String(c.note || d.note).slice(0, 160) };
}
function defaultIntake(){
  const st = ST() || {}, p = st.profile || {}, old = (st.aiCoach && st.aiCoach.intake) || {};
  let sleepH = 7; try{ const pr = profile(); sleepH = pr.sleepAvg || 7; }catch(e){}
  return Object.assign({ goal: p.goal === "lose" ? "lose" : p.goal === "gain" ? "gain" : "tone", exp: "beg", daysN: 3, minutes: 60, place: "gym", equip: [], inj: [],
    weight: num(p.weight, 30, 250, 65), height: num(p.height, 120, 230, 168), sleepH, wake: "06:00", diet: "man", allergy: "", note: "" }, old);
}
function cleanIntake(it){
  it = it || {}; const d = defaultIntake();
  const pick = (v, keys, def)=> keys.indexOf(v) >= 0 ? v : def;
  return { goal: pick(it.goal, Object.keys(GOALS), d.goal), exp: pick(it.exp, Object.keys(EXPS), "beg"), daysN: Math.round(num(it.daysN, 2, 6, 3)), minutes: pick(Number(it.minutes), [30, 45, 60, 75, 90], 60),
    place: it.place === "home" ? "home" : "gym", equip: (Array.isArray(it.equip) ? it.equip : []).filter(x=> typeof x === "string").slice(0, 8), inj: (Array.isArray(it.inj) ? it.inj : []).filter(x=> typeof x === "string").slice(0, 4),
    weight: num(it.weight, 30, 250, d.weight), height: num(it.height, 120, 230, d.height), sleepH: num(it.sleepH, 3, 12, 7), wake: /^\d{1,2}:\d{2}$/.test(it.wake || "") ? hhmm(toMin(it.wake)) : "06:00",
    diet: pick(it.diet, Object.keys(DIETS), "man"), allergy: String(it.allergy || "").replace(/[<>]/g, "").slice(0, 120), note: String(it.note || "").replace(/[<>]/g, "").slice(0, 200) };
}
const PRESET = { 2: ["T2", "T5"], 3: ["T2", "T4", "T6"], 4: ["T2", "T3", "T5", "T6"], 5: ["T2", "T3", "T4", "T6", "T7"], 6: ["T2", "T3", "T4", "T5", "T6", "T7"] };
function localWorkout(it){
  let days = [], split = "", summary = "";
  try{
    const PBx = G.PB; const eqIds = (PBx.HOME_EQ || []).filter(e=> it.equip.indexOf(e.label) >= 0 || it.equip.indexOf(e.id) >= 0).map(e=> e.id);
    const injIds = (PBx.INJ || []).filter(e=> it.inj.indexOf(e.label) >= 0 || it.inj.indexOf(e.id) >= 0).map(e=> e.id);
    const ans = PBx.normalize({ goal: it.goal, exp: it.exp, days: (PBx.DAY_PRESET && PBx.DAY_PRESET[it.daysN]) || PRESET[it.daysN], minutes: it.minutes, place: it.place, equip: eqIds, focus: [], inj: injIds, gender: profile().female ? "female" : "male" });
    const prog = PBx.generate(ans), plan = PBx.toPlan(prog);
    split = (prog.split && prog.split.name) || "";
    DK.forEach(k=>{ const d = plan.days[k]; if(d && d.items && d.items.length) days.push({ day: k, title: d.title, items: d.items.map(x=> ({ id: x.exerciseId, sets: x.sets, reps: String(x.reps), rest: x.restSec })) }); });
  }catch(e){ days = []; }
  if(!days.length){                                    // dự phòng: lấy giáo án mẫu gần nhất theo số buổi
    try{ const g = profile().female ? "nu" : "nam"; const t = TP().filter(x=> x.perWeek === it.daysN && (x.gender === g || x.gender === "chung"))[0] || TP().filter(x=> x.perWeek === it.daysN)[0] || TP()[0];
      const plan = tplToPlan(t); split = t.name;
      DK.forEach(k=>{ const d = plan.days[k]; if(d && d.items && d.items.length) days.push({ day: k, title: d.title, items: d.items.filter(x=> x.exerciseId && EX()[x.exerciseId]).map(x=> ({ id: x.exerciseId, sets: x.sets, reps: String(x.reps), rest: x.restSec })) }); });
    }catch(e){}
  }
  days.forEach(d=>{ d.items = d.items.filter(x=> !isCardio((EX()[x.id] || {}).muscle) || d.items.length <= 2); d.cardio = cardioFor(d.items.map(x=> x.id), it.goal); });
  summary = T(`${it.daysN} buổi/tuần${split ? " · " + split : ""}, mỗi buổi khoảng ${it.minutes} phút, hợp mục tiêu ${GOALS[it.goal].toLowerCase()} và trình độ ${EXPS[it.exp].toLowerCase()}.`,
    `${it.daysN} sessions a week${split ? " · " + tr(split) : ""}, about ${it.minutes} minutes each — built for ${GOALS_EN[it.goal].toLowerCase()} at ${EXPS_EN[it.exp]} level.`);
  return { summary, split, days, notes: EN() ? [
    "Stop each set with 1–3 reps left in the tank (RPE 7–9); do compound lifts first.",
    "When every set reaches the top of the rep range → add the smallest weight step next session (the app suggests it).",
    "After lifting prefer 15–30 minutes of low-intensity cardio; no HIIT right after a heavy leg / back day.",
    "Outside the gym keep 8,000–10,000 steps a day." ] : [
    "Dừng mỗi hiệp khi còn làm được 1–3 lần nữa (RPE 7–9); bài đa khớp tập trước.",
    "Khi tất cả hiệp đạt mốc số lần cao nhất → buổi sau tăng mức tạ nhỏ nhất (app tự gợi ý).",
    "Cardio sau tạ ưu tiên cường độ thấp 15–30 phút; không HIIT ngay sau buổi chân / lưng nặng.",
    "Ngoài buổi tập giữ 8.000–10.000 bước/ngày." ] };
}
function targets(it){
  const p = profile(); const w = it.weight || p.w || 65, h = it.height || p.h || 168, age = p.age || 28;
  let kcal = p.kcal, pro = p.pro, carb = p.carb, fat = p.fat;
  const profW = num((ST() || {}).profile && (ST().profile.weight), 0, 300, 0);
  const pg = String(((ST() || {}).profile || {}).goal || "");                      // mục tiêu trong HỒ SƠ (số calo của app tính theo mục tiêu này)
  const dir = g=> g === "lose" ? -1 : (g === "gain" || g === "strength") ? 1 : 0;
  if(!kcal || Math.abs(profW - w) > 3 || dir(it.goal) !== dir(pg)){
    const bmr = 10 * w + 6.25 * h - 5 * age + (p.female ? -161 : 5), tdee = bmr * (1.3 + Math.min(6, it.daysN || 3) * 0.06);
    kcal = tdee + (it.goal === "lose" ? -400 : it.goal === "gain" ? 250 : it.goal === "strength" ? 150 : 0);
    pro = w * (it.goal === "lose" ? 2.0 : 1.8); fat = w * 0.8; carb = (kcal - pro * 4 - fat * 9) / 4;
  }
  kcal = Math.max(p.female ? 1200 : 1500, Math.round(kcal / 10) * 10);
  return { kcal, protein: Math.round(pro), carbs: Math.max(50, Math.round(carb)), fat: Math.round(fat) };
}
function localMeals(it){
  const ds = docs().filter(d=> d.t === "recipe" && dietOk(d, it));
  const tag = it.goal === "lose" ? "giam-mo" : (it.goal === "gain" || it.goal === "strength") ? "tang-co" : "";
  const pick = (meal, n)=>{ const a = ds.filter(d=> d.meal === meal); const pref = tag ? a.filter(d=> d.tags.indexOf(tag) >= 0) : a; const src = (pref.length >= n ? pref : a).slice(); src.sort((x, y)=> (y.pro / Math.max(1, y.kcal)) - (x.pro / Math.max(1, x.kcal))); return src.slice(0, n).map(d=> d.id); };
  return (EN() ? [["Breakfast", "breakfast", "Get protein in early so you stay full."], ["Lunch", "lunch", "Main meal: protein + carbs + plenty of vegetables."], ["Dinner", "dinner", "Eat 2–3 hours before bed."], ["Snack", "snack", "After training (cardio included): protein + carbs."]]
    : [["Sáng", "breakfast", "Đủ đạm ngay bữa đầu để no lâu."], ["Trưa", "lunch", "Bữa chính: đạm + tinh bột + nhiều rau."], ["Tối", "dinner", "Ăn trước giờ ngủ 2–3 giờ."], ["Phụ", "snack", "Sau buổi tập (kể cả sau cardio): đạm + tinh bột."]])
    .map(([meal, k, note])=> ({ meal, recipe_ids: pick(k, 2), note }));
}
function localNutrition(it){
  const t = targets(it), w = it.weight || 65;
  let pr, avoid;
  if(EN()){
    pr = [`Protein ${t.protein} g a day (~${(t.protein / w).toFixed(1)} g/kg), spread over 3–5 meals of 25–40 g each.`,
      it.goal === "lose" ? "A 300–500 kcal deficit: losing about 0.5–1% of body weight per week is right." : it.goal === "gain" ? "A 200–300 kcal surplus: gaining 0.25–0.5% of body weight per week limits fat gain." : "Eat around maintenance; prioritise enough protein and vegetables.",
      "Each meal: a palm of protein, 1–2 cupped hands of carbs, half a plate of vegetables, a thumb of healthy fat.",
      `About ${(w * 0.035).toFixed(1)} litres of water a day; add 0.5 litre on training days.`,
      "After a long session (lifting + cardio) eat protein + carbs within 1–2 hours to recover."];
    avoid = ["Soft drinks, milk tea, alcohol — empty calories.", "Deep-fried food and salty processed food."];
    if(it.allergy) avoid.unshift(`Dishes containing: ${it.allergy} were removed (as you stated).`);
    if(it.diet !== "man") pr.push("Vegetarian: combine legumes + grains for complete amino acids; watch B12, iron and zinc (ask a doctor if you may need supplements).");
  } else {
    pr = [`Đạm ${t.protein} g/ngày (~${(t.protein / w).toFixed(1).replace(".", ",")} g/kg), chia đều 3–5 bữa, mỗi bữa 25–40 g.`,
      it.goal === "lose" ? "Thâm hụt 300–500 kcal: giảm khoảng 0,5–1% cân nặng mỗi tuần là vừa." : it.goal === "gain" ? "Dư 200–300 kcal: tăng 0,25–0,5% cân nặng mỗi tuần để hạn chế tăng mỡ." : "Ăn quanh mức duy trì, ưu tiên đủ đạm và rau.",
      "Mỗi bữa: 1 phần đạm bằng lòng bàn tay, 1–2 nắm tinh bột, nửa đĩa rau, 1 ngón cái chất béo tốt.",
      `Nước khoảng ${(w * 0.035).toFixed(1).replace(".", ",")} lít/ngày; ngày tập cộng thêm 0,5 lít.`,
      "Sau buổi tập kéo dài (tạ + cardio) nạp đạm + tinh bột trong 1–2 giờ để phục hồi."];
    avoid = ["Nước ngọt, trà sữa, rượu bia — calo rỗng.", "Đồ chiên ngập dầu, đồ chế biến sẵn nhiều muối."];
    if(it.allergy) avoid.unshift(`Đã loại món có: ${it.allergy} (theo bạn khai).`);
    if(it.diet !== "man") pr.push("Ăn chay: ghép đậu + ngũ cốc để đủ axit amin; chú ý B12, sắt, kẽm (hỏi bác sĩ nếu cần bổ sung).");
  }
  return Object.assign(t, { principles: pr, meals: localMeals(it), avoid });
}
function localSleep(it, trainDays){
  const need = it.sleepH < 6.5 ? Math.min(8, Math.round((it.sleepH + 1) * 2) / 2) : (it.daysN >= 5 || it.goal === "gain" || it.goal === "strength" ? 8 : 7.5);
  const wake = toMin(it.wake), bed = wake - need * 60 - 15;
  const tips = EN() ? [`Be in bed by ${hhmm(bed)} (allowing ~15 minutes to fall asleep) and wake at ${hhmm(wake)} — keep it the same on weekends.`,
    `Last coffee / strong tea before ${hhmm(bed - 8 * 60)}; last big meal before ${hhmm(bed - 150)}.`,
    `Screens off from ${hhmm(bed - 60)}; keep the room cool (24–26°C), dark and quiet.`,
    "On rest days still walk easily for 20–30 minutes and stretch — active recovery eases soreness."]
   : [`Lên giường lúc ${hhmm(bed)} (trừ hao ~15 phút để vào giấc), dậy ${hhmm(wake)} — giữ cố định cả cuối tuần.`,
    `Cà phê / trà đặc cuối cùng trước ${hhmm(bed - 8 * 60)}; bữa lớn cuối trước ${hhmm(bed - 150)}.`,
    `Tắt màn hình từ ${hhmm(bed - 60)}; phòng mát (24–26°C), tối và yên tĩnh.`,
    "Ngày nghỉ vẫn đi bộ nhẹ 20–30 phút và giãn cơ — phục hồi chủ động giúp bớt đau nhức."];
  if(it.sleepH < 6.5) tips.unshift(T(`Bạn đang ngủ ~${String(it.sleepH).replace(".", ",")} giờ — thiếu cho phục hồi. Tăng dần mỗi tuần 15–30 phút cho tới 7–8 giờ.`, `You sleep about ${it.sleepH} hours — not enough to recover. Add 15–30 minutes each week until you reach 7–8 hours.`));
  return { bedtime: hhmm(bed), wake: hhmm(wake), hours: need, rest_days: DK.filter(k=> trainDays.indexOf(k) < 0), tips };
}
function localHealth(it){
  const p = profile(), warnings = [];
  const tips = EN() ? ["Warm up for 5–10 minutes and do 1–3 ramp-up sets before the main lift; stretch lightly afterwards.", "Progress gradually: do not add more than ~10% total volume per week.",
    "Muscle soreness 24–72 hours after training is normal; sharp joint pain means stop that exercise.", "Keep 8,000–10,000 steps a day and stand up to move every 45–60 minutes of sitting.", "Every 4–8 weeks take a deload week (about 40% fewer sets) so your body can recover."]
   : ["Khởi động 5–10 phút và 1–3 hiệp làm nóng trước bài chính; giãn cơ nhẹ sau buổi.", "Tăng tải từ từ: mỗi tuần không tăng quá ~10% tổng khối lượng.",
    "Đau nhức cơ 24–72 giờ sau tập là bình thường; đau nhói ở khớp thì dừng bài đó.", "Vận động nền 8.000–10.000 bước/ngày, đứng dậy đi lại mỗi 45–60 phút ngồi.", "Mỗi 4–8 tuần có 1 tuần giảm tải (giảm ~40% số hiệp) để cơ thể hồi phục."];
  if(it.inj && it.inj.length) warnings.push(T(`Bạn khai vùng cần chú ý: ${it.inj.join(", ")} — app đã tránh bài gây áp lực; đau tăng lên thì dừng và đi khám.`, `You flagged these areas: ${it.inj.map(tr).join(", ")} — the app avoided exercises that load them; if pain gets worse, stop and see a doctor.`));
  if(p.age && p.age < 18) warnings.push(T("Dưới 18 tuổi: tập với mức tạ vừa, ưu tiên kỹ thuật, không ăn kiêng khắt khe; nên có người lớn / HLV hướng dẫn.", "Under 18: train with moderate weights, technique first, no strict dieting; have an adult or coach guide you."));
  if(p.age >= 55) warnings.push(T("Trên 55 tuổi hoặc lâu chưa vận động: nên khám sức khoẻ tổng quát trước khi tập nặng.", "Over 55 or inactive for a long time: get a general health check before training hard."));
  if(it.sleepH < 6) warnings.push(T("Ngủ dưới 6 giờ làm tăng nguy cơ chấn thương — tuần này giảm 1–2 hiệp mỗi bài cho tới khi ngủ đủ.", "Sleeping under 6 hours raises injury risk — drop 1–2 sets per exercise this week until you sleep enough."));
  warnings.push(T("Đau ngực, khó thở bất thường, choáng, ngất khi tập → dừng ngay và đi khám / gọi 115.", "Chest pain, unusual shortness of breath, dizziness or fainting while training → stop at once and get medical help / call emergency services (115 in Vietnam)."));
  return { tips, warnings };
}
function localPlan(intake){
  const it = cleanIntake(intake), workout = localWorkout(it);
  return { src: "local", lang: LANG(), at: Date.now(), intake: it, workout, nutrition: localNutrition(it), sleep: localSleep(it, workout.days.map(d=> d.day)), health: localHealth(it) };
}
/** Đối chiếu kế hoạch AI với thư viện app: bỏ mã lạ, sửa cardio sai luật, bù phần thiếu bằng bộ luật trên máy. */
function validatePlan(ai, intake){
  const it = cleanIntake(intake), base = localPlan(it), E = EX(), R = new Set(RC().map(r=> r.id));
  const o = ai && typeof ai === "object" ? ai : {};
  const list = (v, n)=> (Array.isArray(v) ? v : []).map(x=> String(x == null ? "" : x).replace(/\[\[[^\]]*\]\]/g, "").trim().slice(0, 220)).filter(Boolean).slice(0, n);
  const seen = new Set();
  let days = (Array.isArray(o.workout && o.workout.days) ? o.workout.days : []).map(d=>{
    if(!d || DK.indexOf(d.day) < 0 || seen.has(d.day)) return null;
    const items = (Array.isArray(d.items) ? d.items : []).filter(x=> x && E[x.id]).slice(0, 9).map(x=> ({ id: x.id, sets: Math.round(num(x.sets, 1, 8, E[x.id].sets || 3)), reps: String(x.reps || E[x.id].reps || "8-12").replace(/[<>]/g, "").slice(0, 40), rest: Math.round(num(x.rest, 0, 300, E[x.id].restSec || 90)) }));
    if(items.length < 3) return null; seen.add(d.day);
    const ids = items.map(x=> x.id);
    return { day: d.day, title: String(d.title || T("Buổi tập", "Workout")).replace(/[<>]/g, "").slice(0, 60), items, cardio: fixCardio(d.cardio, ids, it.goal) };
  }).filter(Boolean).sort((a, b)=> DK.indexOf(a.day) - DK.indexOf(b.day));
  const okWorkout = days.length >= 2;
  const workout = okWorkout ? { summary: String((o.workout || {}).summary || base.workout.summary).replace(/[<>]/g, "").slice(0, 320), split: String((o.workout || {}).split || "").replace(/[<>]/g, "").slice(0, 60), days, notes: list((o.workout || {}).notes, 6).length ? list(o.workout.notes, 6) : base.workout.notes } : base.workout;
  const n = o.nutrition || {}, t = targets(it), floor = profile().female ? 1200 : 1500;
  const kcal = num(n.kcal, 0, 6000, 0) >= floor ? Math.round(n.kcal) : t.kcal;
  const near = (v, ref, lo, hi)=>{ v = num(v, 0, 2000, 0); return v >= ref * lo && v <= ref * hi ? Math.round(v) : Math.round(ref); };
  let meals = (Array.isArray(n.meals) ? n.meals : []).map(m=> m ? ({ meal: String(m.meal || T("Bữa", "Meal")).replace(/[<>]/g, "").slice(0, 20), recipe_ids: (Array.isArray(m.recipe_ids) ? m.recipe_ids : []).filter(id=> R.has(id)).filter(id=> dietOk(docs().find(d=> d.t === "recipe" && d.id === id) || {}, it)).slice(0, 3), note: String(m.note || "").replace(/[<>]/g, "").slice(0, 200) }) : null).filter(m=> m && (m.recipe_ids.length || m.note));
  if(meals.filter(m=> m.recipe_ids.length).length < 2) meals = base.nutrition.meals;
  const nutrition = { kcal, protein: near(n.protein, t.protein, 0.7, 1.5), carbs: near(n.carbs, t.carbs, 0.4, 1.8), fat: near(n.fat, t.fat, 0.5, 1.8),
    principles: list(n.principles, 6).length ? list(n.principles, 6) : base.nutrition.principles, meals, avoid: list(n.avoid, 6).length ? list(n.avoid, 6) : base.nutrition.avoid };
  const s = o.sleep || {}, bs = localSleep(it, workout.days.map(d=> d.day));
  const hours = num(s.hours, 0, 12, 0) >= 7 && num(s.hours, 0, 12, 0) <= 9.5 ? Math.round(s.hours * 2) / 2 : bs.hours;
  const sleep = { wake: bs.wake, hours, bedtime: hhmm(toMin(bs.wake) - hours * 60 - 15), rest_days: bs.rest_days, tips: list(s.tips, 6).length ? list(s.tips, 6) : bs.tips };
  const h = o.health || {}, bh = base.health;
  const health = { tips: list(h.tips, 6).length ? list(h.tips, 6) : bh.tips, warnings: bh.warnings.concat(list(h.warnings, 4)).filter((x, i, a)=> a.indexOf(x) === i).slice(0, 7) };
  return { src: okWorkout ? "ai" : "mixed", lang: LANG(), at: Date.now(), intake: it, workout, nutrition, sleep, health };
}
/** Kế hoạch tập → giáo án của app (đủ 7 ngày, cardio thêm cuối buổi). */
function toAppPlan(P){
  const E = EX(), id = ()=> (typeof uid === "function" ? uid() : Math.random().toString(36).slice(2, 10));
  const days = {};
  DK.forEach(k=>{
    const d = P.workout.days.find(x=> x.day === k);
    if(!d){ days[k] = { title: T("Nghỉ · đi bộ nhẹ 20–30 phút", "Rest · easy 20–30 minute walk"), intensity: "Nghỉ", duration: 0, items: [] }; return; }
    const items = d.items.filter(x=> E[x.id]).map(x=> ({ uid: x.id + "_" + id(), exerciseId: x.id, custom: null, sets: x.sets, reps: x.reps, restSec: x.rest, clipId: null }));
    const c = d.cardio;
    if(c && c.minutes > 0){
      if(c.id && E[c.id]) items.push({ uid: c.id + "_" + id(), exerciseId: c.id, custom: null, sets: 1, reps: `${c.minutes} phút`, restSec: 0, clipId: null });
      else items.push({ uid: id(), exerciseId: null, custom: { name: T(`${c.type} (cardio nhẹ sau tập)`, `${c.type} (easy cardio after lifting)`), muscle: "Tim mạch", equipment: "Máy chạy / xe đạp", guide: T("Giữ cường độ thấp–vừa: vẫn nói được câu dài. ", "Keep it low-to-moderate: you can still speak full sentences. ") + (c.note || "") }, sets: 1, reps: `${c.minutes} phút`, restSec: 0, clipId: null });
    }
    const dur = Math.round(items.reduce((a, x)=> a + (x.sets * (45 + Number(x.restSec || 0))) / 60, 8) + (c && c.minutes || 0));
    days[k] = { title: d.title, intensity: heavyDay(d.items.map(x=> x.id)) ? "Cao" : "Vừa", duration: Math.min(150, dur), items };
  });
  return { id: "plan_ai_" + id(), name: T(`Kế hoạch ${P.src === "local" ? "TapEasy" : "AI"} · ${GOALS[P.intake.goal]} ${P.workout.days.length} buổi`, `${P.src === "local" ? "TapEasy" : "AI"} plan · ${GOALS_EN[P.intake.goal]} ×${P.workout.days.length}`), tagline: (P.workout.split || T("KẾ HOẠCH CÁ NHÂN", "PERSONAL PLAN")).toUpperCase(), builtin: false, fromCoach: true, days };
}

/** Trả lời từ kho trên máy (khi không có AI). */
function localAnswer(q){
  const fq = fold(q), p = profile(), parts = [], en = EN();
  const hit0 = retrieve(q, { ex: 5, recipe: 4, food: 4, tpl: 2, guide: 2 });
  const howto = /\b(how do i|how to|how can i|where|cach|lam sao|o dau|lam the nao|the nao de)\b/.test(fq) && hit0.some(d=> d.t === "guide");
  const tp = howto ? [] : TOPICS.filter(t=> t.re.test(fq) || t.reEn.test(fq)).slice(0, 2);
  tp.forEach(t=>{ const a = en ? t.en : t.a; parts.push(typeof a === "function" ? a(p) : a); if(t.ex) parts.push(T("Bài trong app: ", "In the app: ") + t.ex.filter(id=> EX()[id]).map(id=> `[[ex:${id}]]`).join(" ")); });
  const hit = howto ? hit0.filter(d=> d.t === "guide") : hit0;
  const g = hit.filter(d=> d.t === "guide"); if(g.length) parts.push(g.map(d=> "- " + (en ? d.lineEn : d.line)).join("\n"));
  const ex = hit.filter(d=> d.t === "ex"); if(ex.length && !tp.some(t=> t.ex)) parts.push(T("**Bài tập trong app:**\n", "**Exercises in the app:**\n") + ex.map(d=> `- [[ex:${d.id}]] — ${tr(EX()[d.id].muscle)}, ${EX()[d.id].sets} ${T("hiệp", "sets")} × ${repsTr(EX()[d.id].reps)}`).join("\n"));
  const rc = hit.filter(d=> d.t === "recipe"); if(rc.length) parts.push(T("**Món trong app:**\n", "**Dishes in the app:**\n") + rc.map(d=> `- [[recipe:${d.id}]] — ${d.kcal} kcal, ${T("đạm", "protein")} ${d.pro} g`).join("\n"));
  const fd = hit.filter(d=> d.t === "food"); if(fd.length && /calo|kcal|dam|bao nhieu|protein|beo|tinh bot|how much|how many|carb|fat/.test(fq)) parts.push(T("**Thực phẩm (trên 100 g):**\n", "**Foods (per 100 g):**\n") + fd.map(d=>{ const f = FD().find(x=> x.id === d.id) || {}; return en ? `- ${tr(d.name)}: ${f.kcal} kcal, protein ${f.protein} g, carbs ${f.carbs} g, fat ${f.fat} g` : "- " + d.line.replace(/^food \| /, "").replace(" | ", ": "); }).join("\n"));
  const tl = hit.filter(d=> d.t === "tpl"); if(tl.length) parts.push(T("**Giáo án mẫu:** ", "**Program templates:** ") + tl.map(d=> `[[tpl:${d.id}]]`).join(" "));
  if(!parts.length) parts.push(en ? "I could not find a match in the app's library. Try asking more specifically, for example:\n- \"Chest exercises with dumbbells\"\n- \"High-protein breakfast ideas\"\n- \"What cardio after leg day?\"\n- \"How do I change equipment during a workout?\"\nOr open the **My plan** tab and I will build your training – eating – sleep plan."
    : "Mình chưa tìm thấy nội dung khớp trong kho của app. Bạn thử hỏi cụ thể hơn, ví dụ:\n- \"Bài tập ngực với tạ đơn\"\n- \"Món nhiều đạm cho bữa sáng\"\n- \"Sau buổi chân nên cardio thế nào?\"\n- \"Cách đổi dụng cụ trong buổi tập\"\nHoặc mở tab **Kế hoạch** để mình lập lịch tập – ăn – ngủ cho bạn.");
  return parts.join("\n\n");
}

/* =====================================================================
   3. GỌI AI
   ===================================================================== */
let _status = { at: 0, enabled: false, left: null, limit: null, why: "" };
function signedIn(){ try{ const c = CL(); return !!(c && c.mode === "firebase" && c.user); }catch(e){ return false; } }
async function status(force){
  if(!force && Date.now() - _status.at < 5 * 60000) return _status;
  const c = CL();
  if(!c || c.mode !== "firebase"){ _status = { at: Date.now(), enabled: false, why: "demo" }; return _status; }
  if(!signedIn()){ _status = { at: Date.now(), enabled: false, why: "signin" }; return _status; }
  try{ const r = await c.fn("aiChat", { ping: true }); _status = { at: Date.now(), enabled: !!(r && r.enabled), left: r && r.left, limit: r && r.limit, why: r && r.enabled ? "" : "off" }; }
  catch(e){ _status = { at: Date.now() - 4 * 60000, enabled: false, why: "error" }; }
  return _status;
}
async function askAI(mode, messages, context){
  const c = CL(); const r = await c.fn("aiChat", { mode, messages, context, lang: EN() ? "en" : "vi" });
  if(r && typeof r.left === "number") _status.left = r.left;
  return r;
}

/* =====================================================================
   4. GIAO DIỆN
   ===================================================================== */
const CSS = `
#fk-coach-fab{ position:absolute; z-index:35; right:calc(var(--sar, 0px) + 14px); bottom:calc(var(--nav-h, 76px) + 18px + var(--sab, 0px)); width:56px; height:56px; border-radius:50%; border:0; cursor:pointer;
  display:none; align-items:center; justify-content:center; color:var(--navy,#061A24); background:linear-gradient(140deg, var(--primary,#5EE6C7), var(--mint,#33D6C9)); box-shadow:0 10px 28px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.18) inset; transition:transform .16s ease; }
#fk-coach-fab.on{ display:flex; } #fk-coach-fab:active{ transform:scale(.93); }
#fk-coach-fab .material-symbols-rounded{ font-size:28px; }
#fk-coach-fab i{ position:absolute; top:-4px; right:-4px; font:700 10px/1 inherit; font-style:normal; padding:4px 6px; border-radius:999px; background:#FF7A45; color:#fff; }
.fk-fb-fab{ bottom:calc(var(--nav-h, 76px) + 84px + var(--sab, 0px)) !important; }
#fk-coach{ position:absolute; inset:0; z-index:38; display:none; flex-direction:column; background:var(--bg, #061A24); color:var(--text, #fff); padding-top:var(--sat, 0px); }
#fk-coach.open{ display:flex; animation:fkcIn .22s ease; }
@keyframes fkcIn{ from{ opacity:0; transform:translateY(14px); } to{ opacity:1; transform:none; } }
.fkc-head{ display:flex; align-items:center; gap:10px; padding:12px 14px 8px; }
.fkc-head .av{ width:40px; height:40px; border-radius:50%; flex:0 0 40px; display:flex; align-items:center; justify-content:center; background:linear-gradient(140deg, var(--primary,#5EE6C7), var(--mint,#33D6C9)); color:var(--navy,#061A24); }
.fkc-head h2{ font-size:17px; margin:0; line-height:1.2; } .fkc-head small{ display:block; font-size:12px; color:var(--text-muted); margin-top:2px; }
.fkc-head .sp{ flex:1; min-width:0; }
.fkc-seg{ display:flex; gap:6px; margin:4px 14px 8px; padding:4px; border-radius:14px; background:rgba(128,128,128,.14); }
.fkc-seg button{ flex:1; height:38px; border-radius:11px; border:0; background:transparent; color:inherit; font:600 13.5px/1 inherit; cursor:pointer; }
.fkc-seg button.on{ background:var(--primary,#5EE6C7); color:var(--navy,#061A24); }
.fkc-body{ flex:1 1 auto; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:6px 14px 14px; }
.fkc-msg{ display:flex; margin:0 0 10px; } .fkc-msg.u{ justify-content:flex-end; }
.fkc-b{ max-width:88%; padding:10px 13px; border-radius:18px; font-size:14.5px; line-height:1.5; overflow-wrap:anywhere; }
.fkc-msg.u .fkc-b{ background:var(--primary,#5EE6C7); color:var(--navy,#061A24); border-bottom-right-radius:6px; white-space:pre-wrap; }
.fkc-msg.a .fkc-b{ background:rgba(128,128,128,.14); border:1px solid rgba(128,128,128,.2); border-bottom-left-radius:6px; }
.fkc-b p{ margin:0 0 8px; } .fkc-b p:last-child{ margin-bottom:0; } .fkc-b ul{ margin:0 0 8px; padding-left:18px; } .fkc-b li{ margin:2px 0; }
.fkc-b .src{ display:block; margin-top:8px; font-size:11.5px; color:var(--text-muted); }
.fkc-chip{ display:inline-flex; align-items:center; gap:4px; max-width:100%; margin:2px 2px 2px 0; padding:4px 10px; border-radius:999px; border:1px solid var(--primary,#5EE6C7); background:rgba(94,230,199,.1); color:inherit; font:600 12.5px/1.3 inherit; cursor:pointer; vertical-align:middle; text-align:left; }
.fkc-chip .material-symbols-rounded{ font-size:14px; flex:0 0 auto; }
.fkc-dots{ display:inline-flex; gap:4px; padding:4px 2px; } .fkc-dots i{ width:7px; height:7px; border-radius:50%; background:currentColor; opacity:.35; animation:fkcDot 1.1s infinite; } .fkc-dots i:nth-child(2){ animation-delay:.18s; } .fkc-dots i:nth-child(3){ animation-delay:.36s; }
@keyframes fkcDot{ 0%,80%,100%{ opacity:.25; transform:none; } 40%{ opacity:1; transform:translateY(-3px); } }
.fkc-sug{ display:flex; gap:8px; overflow-x:auto; padding:0 14px 8px; scrollbar-width:none; } .fkc-sug::-webkit-scrollbar{ display:none; }
.fkc-sug button{ flex:0 0 auto; min-height:36px; padding:0 12px; border-radius:999px; border:1px solid rgba(128,128,128,.35); background:transparent; color:inherit; font:500 13px/1 inherit; white-space:nowrap; cursor:pointer; }
.fkc-in{ display:flex; gap:8px; align-items:flex-end; padding:8px 14px 6px; border-top:1px solid rgba(128,128,128,.2); }
.fkc-in textarea{ flex:1; min-height:44px; max-height:120px; resize:none; padding:11px 14px; border-radius:22px; border:1px solid rgba(128,128,128,.35); background:rgba(128,128,128,.1); color:inherit; font:inherit; font-size:16px; line-height:1.35; }
.fkc-in textarea:focus{ outline:none; border-color:var(--primary,#5EE6C7); }
.fkc-in button{ flex:0 0 44px; width:44px; height:44px; border-radius:50%; border:0; background:var(--primary,#5EE6C7); color:var(--navy,#061A24); display:flex; align-items:center; justify-content:center; cursor:pointer; }
.fkc-in button[disabled]{ opacity:.45; }
.fkc-note{ font-size:11px; line-height:1.4; color:var(--text-muted); text-align:center; padding:0 16px calc(8px + var(--sab, 0px)); margin:0; }
.fkc-card{ padding:14px; border-radius:18px; background:rgba(128,128,128,.1); border:1px solid rgba(128,128,128,.2); margin-bottom:12px; }
.fkc-card h3{ font-size:15px; margin:0 0 8px; display:flex; align-items:center; gap:6px; } .fkc-card h3 .material-symbols-rounded{ font-size:18px; color:var(--primary,#5EE6C7); }
.fkc-card h4{ font-size:13px; margin:12px 0 6px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; }
.fkc-card ul{ margin:0; padding-left:18px; font-size:14px; line-height:1.5; } .fkc-card li{ margin:3px 0; }
.fkc-card p{ font-size:14px; line-height:1.5; margin:0 0 6px; }
.fkc-f label{ display:block; font-size:12.5px; font-weight:600; color:var(--text-muted); margin:12px 0 6px; }
.fkc-opts{ display:flex; flex-wrap:wrap; gap:6px; }
.fkc-opts button{ min-height:38px; padding:0 13px; border-radius:999px; border:1px solid rgba(128,128,128,.35); background:transparent; color:inherit; font:500 13.5px/1 inherit; cursor:pointer; }
.fkc-opts button.on{ background:var(--primary,#5EE6C7); color:var(--navy,#061A24); border-color:transparent; font-weight:700; }
.fkc-row{ display:flex; gap:10px; } .fkc-row > div{ flex:1; min-width:0; }
.fkc-f input[type=text], .fkc-f input[type=number], .fkc-f input[type=time]{ width:100%; height:44px; padding:0 12px; border-radius:12px; border:1px solid rgba(128,128,128,.35); background:rgba(128,128,128,.1); color:inherit; font:inherit; font-size:16px; }
.fkc-tabs{ display:flex; gap:6px; overflow-x:auto; margin:0 -2px 12px; padding:2px; scrollbar-width:none; position:sticky; top:-6px; z-index:2; background:var(--bg,#061A24); } .fkc-tabs::-webkit-scrollbar{ display:none; }
.fkc-tabs button{ flex:1 0 auto; min-height:40px; padding:0 12px; border-radius:12px; border:1px solid rgba(128,128,128,.3); background:transparent; color:inherit; font:600 13px/1 inherit; display:flex; align-items:center; justify-content:center; gap:5px; cursor:pointer; white-space:nowrap; }
.fkc-tabs button .material-symbols-rounded{ font-size:17px; } .fkc-tabs button.on{ background:var(--primary,#5EE6C7); color:var(--navy,#061A24); border-color:transparent; }
.fkc-day{ padding:12px; border-radius:14px; border:1px solid rgba(128,128,128,.22); margin-bottom:8px; }
.fkc-day b.t{ display:block; font-size:14.5px; margin-bottom:6px; } .fkc-day b.t span{ color:var(--primary,#5EE6C7); margin-right:6px; }
.fkc-day ol{ margin:0; padding-left:20px; font-size:13.5px; line-height:1.55; } .fkc-day ol small{ color:var(--text-muted); }
.fkc-cardio{ display:flex; gap:8px; align-items:flex-start; margin-top:8px; padding:8px 10px; border-radius:11px; background:rgba(255,122,69,.12); font-size:12.5px; line-height:1.4; } .fkc-cardio .material-symbols-rounded{ font-size:17px; color:#FF9D6E; flex:0 0 auto; }
.fkc-kpis{ display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:6px; } .fkc-kpis div{ padding:10px 4px; border-radius:12px; background:rgba(128,128,128,.14); text-align:center; }
.fkc-kpis b{ display:block; font-size:17px; font-variant-numeric:tabular-nums; } .fkc-kpis small{ font-size:11px; color:var(--text-muted); }
.fkc-warn{ display:flex; gap:10px; padding:12px; border-radius:14px; background:rgba(255,196,76,.12); border:1px solid rgba(255,196,76,.35); font-size:12.5px; line-height:1.45; margin-bottom:12px; } .fkc-warn .material-symbols-rounded{ color:#FFC44C; font-size:19px; flex:0 0 auto; }
.fkc-load{ text-align:center; padding:46px 10px; } .fkc-load p{ margin-top:14px; font-size:14px; color:var(--text-muted); }
.fkc-cd{ margin:10px 0 0; padding:12px 14px; border-radius:16px; border:1px solid rgba(255,122,69,.35); background:rgba(255,122,69,.08); }
.fkc-cd h4{ margin:0 0 6px; font-size:14.5px; display:flex; align-items:center; gap:6px; } .fkc-cd h4 .material-symbols-rounded{ font-size:18px; color:#FF9D6E; }
.fkc-cd p{ font-size:13px; line-height:1.45; margin:0 0 6px; } .fkc-cd details{ font-size:12.5px; line-height:1.5; margin-top:4px; } .fkc-cd summary{ cursor:pointer; font-weight:600; min-height:32px; display:flex; align-items:center; }
.fkc-cd ul{ margin:4px 0 0; padding-left:18px; } .fkc-cd .acts{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
@media (prefers-reduced-motion:reduce){ #fk-coach.open{ animation:none; } .fkc-dots i{ animation:none; } }
`;
function css(){ if(document.getElementById("fkc-css")) return; const s = document.createElement("style"); s.id = "fkc-css"; s.textContent = CSS; document.head.appendChild(s); }
const ic = n=> `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
const shell = ()=> document.getElementById("app-shell") || document.body;
function store(){ const st = ST(); if(!st) return { chat: [], intake: null, plan: null }; if(!st.aiCoach || typeof st.aiCoach !== "object") st.aiCoach = {}; const a = st.aiCoach; if(!Array.isArray(a.chat)) a.chat = []; return a; }

/** Văn bản AI → HTML an toàn: thoát HTML trước, rồi mới dựng **đậm**, gạch đầu dòng và nút [[loại:mã]] (mã không có trong app bị bỏ). */
function fmt(text){
  const E = EX(), R = RC(), TPL = TP();
  const chip = (t, id)=>{
    if(t === "ex" && E[id]) return `<button type="button" class="fkc-chip" data-fkc="ex:${esc(id)}">${ic("fitness_center")}${esc(nm(E[id].name))}</button>`;
    if(t === "recipe"){ const r = R.find(x=> x.id === id); if(r) return `<button type="button" class="fkc-chip" data-fkc="recipe:${esc(id)}">${ic("restaurant")}${esc(tr(r.name))}</button>`; }
    if(t === "tpl"){ const x = TPL.find(y=> y.id === id); if(x) return `<button type="button" class="fkc-chip" data-fkc="tpl:${esc(id)}">${ic("school")}${esc(tr(x.name))}</button>`; }
    if(t === "kb" && /^[A-Za-z0-9_-]{1,64}$/.test(id) && (G.TEKB || G.TE_KB)) return `<button type="button" class="fkc-chip" data-fkc="kb:${esc(id)}">${ic("menu_book")}${T("Bài kiến thức", "Article")}</button>`;
    return "";
  };
  const inline = s=> esc(s).replace(/\[\[(ex|recipe|tpl|kb|food):([A-Za-z0-9_-]{1,64})\]\]/g, (m, t, id)=> chip(t, id)).replace(/\[\[[^\]]*\]\]/g, "").replace(/\*\*([^*\n]{1,200})\*\*/g, "<b>$1</b>");
  const out = []; let ul = [];
  const flush = ()=>{ if(ul.length){ out.push("<ul>" + ul.map(x=> `<li>${x}</li>`).join("") + "</ul>"); ul = []; } };
  String(text == null ? "" : text).replace(/\r/g, "").split("\n").forEach(line=>{
    const l = line.trim(); if(!l){ flush(); return; }
    const m = /^(?:[-•*]|\d{1,2}[.)])\s+(.*)$/.exec(l);
    if(m) ul.push(inline(m[1])); else { flush(); out.push(`<p>${inline(l.replace(/^#{1,4}\s*/, ""))}</p>`); }
  });
  flush();
  return out.join("");
}

let ui = { tab: "chat", busy: false, ptab: "workout", form: null };
const SUGGEST_VI = ["Lập lịch tập 4 buổi/tuần tăng cơ", "Sau buổi chân nên cardio thế nào?", "Mình cần ăn bao nhiêu đạm?", "Gợi ý bữa sáng nhiều đạm", "Ngủ ít có ảnh hưởng tăng cơ không?", "Cách đổi dụng cụ khi máy bận"];
const SUGGEST_EN = ["Build me a 4-day muscle gain plan", "What cardio after leg day?", "How much protein do I need?", "High-protein breakfast ideas", "Does poor sleep hurt muscle gain?", "How do I change equipment when a machine is busy?"];
const suggest = ()=> EN() ? SUGGEST_EN : SUGGEST_VI;

function mount(){
  css();
  if(document.getElementById("fk-coach")) return;
  const fab = document.createElement("button"); fab.id = "fk-coach-fab"; fab.type = "button"; fab.setAttribute("aria-label", "Mở Trợ lý AI TapEasy");
  fab.innerHTML = `${ic("smart_toy")}<i>AI</i>`; fab.addEventListener("click", ()=> open());
  const ov = document.createElement("div"); ov.id = "fk-coach"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Trợ lý AI TapEasy");
  shell().appendChild(fab); shell().appendChild(ov);
  ov.addEventListener("click", onClick);
  syncFab();
}
const FAB_SCREENS = ["home", "workout", "nutrition", "sleep", "progress", "plans", "library"];
function syncFab(){
  const fab = document.getElementById("fk-coach-fab"); if(!fab) return;
  let on = false;
  try{ const a = document.querySelector(".screen.active"); const st = ST(); on = !!(a && FAB_SCREENS.indexOf(String(a.id).replace("screen-", "")) >= 0 && st && st.onboarded !== false); }catch(e){}
  fab.classList.toggle("on", on);
}
function open(opts){
  mount(); opts = opts || {};
  const ov = document.getElementById("fk-coach"); ui.tab = opts.tab || ui.tab || "chat";
  ov.classList.add("open"); render();
  status(false).then(()=>{ if(ov.classList.contains("open")) paintHead(); });
  try{ if(G.FKPulse && G.FKPulse.feature) G.FKPulse.feature("coach"); }catch(e){}
  if(opts.ask) send(opts.ask);
}
function close(){ const ov = document.getElementById("fk-coach"); if(ov) ov.classList.remove("open"); }
function statusLine(){
  if(_status.enabled) return T(`AI đang bật${typeof _status.left === "number" ? ` · còn ${_status.left} lượt hôm nay` : ""}`, `AI is on${typeof _status.left === "number" ? ` · ${_status.left} questions left today` : ""}`);
  if(_status.why === "signin") return T("Đăng nhập để hỏi AI — hiện trả lời từ kho của app", "Sign in to ask the AI — answering from the app's library for now");
  if(_status.why === "demo") return T("Bản dùng thử — trả lời từ kho của app", "Demo build — answering from the app's library");
  return T("Trả lời từ kho kiến thức của app", "Answering from the app's knowledge library");
}
function paintHead(){ const el = document.querySelector("#fk-coach .fkc-head small"); if(el) el.textContent = statusLine(); }
function render(){
  const ov = document.getElementById("fk-coach"); if(!ov) return;
  ov.innerHTML = `
    <div class="fkc-head"><span class="av">${ic("smart_toy")}</span><div class="sp"><h2>Trợ lý TapEasy</h2><small data-no-i18n>${esc(statusLine())}</small></div>
      ${ui.tab === "chat" && store().chat.length ? `<button type="button" class="icon-btn" data-fkc="clear" aria-label="Xoá cuộc trò chuyện">${ic("delete")}</button>` : ""}
      <button type="button" class="icon-btn" data-fkc="close" aria-label="Đóng">${ic("close")}</button></div>
    <div class="fkc-seg" role="tablist"><button type="button" role="tab" aria-selected="${ui.tab === "chat"}" class="${ui.tab === "chat" ? "on" : ""}" data-fkc="tab:chat">Trò chuyện</button><button type="button" role="tab" aria-selected="${ui.tab === "plan"}" class="${ui.tab === "plan" ? "on" : ""}" data-fkc="tab:plan">Kế hoạch của tôi</button></div>
    ${ui.tab === "chat" ? chatHTML() : `<div class="fkc-body" id="fkc-body">${planHTML()}</div><p class="fkc-note">${esc(DISCLAIMER)}</p>`}`;
  if(ui.tab === "chat"){ bindChat(); scrollEnd(); } else bindPlan();
}
/* ---------------- trò chuyện ---------------- */
function msgHTML(m){
  if(m.role === "user") return `<div class="fkc-msg u"><div class="fkc-b" data-no-i18n>${esc(m.content)}</div></div>`;
  return `<div class="fkc-msg a"><div class="fkc-b" data-no-i18n>${fmt(m.content)}${m.src === "local" ? `<span class="src">${T("Trả lời từ kho kiến thức của app", "Answered from the app's knowledge library")}${_status.why === "signin" ? T(" · đăng nhập để hỏi AI", " · sign in to ask the AI") : ""}</span>` : ""}</div></div>`;
}
function chatHTML(){
  const a = store();
  const hello = `<div class="fkc-msg a"><div class="fkc-b" data-no-i18n>${T(`<p>Chào bạn 👋 Mình là trợ lý của TapEasy. Hỏi mình về <b>tập luyện, ăn uống, ngủ nghỉ, sức khoẻ</b> hoặc cách dùng app — mình trả lời dựa trên đúng bài tập, món ăn và giáo án đang có trong app.</p><p>Muốn có lịch tập – ăn – ngủ riêng? Mở tab <b>Kế hoạch của tôi</b>.</p>`,
    `<p>Hi 👋 I'm the TapEasy assistant. Ask me about <b>training, eating, sleep and rest, general wellness</b> or how to use the app — I answer using the exercises, dishes and programs that are actually in the app.</p><p>Want your own training – eating – sleep plan? Open the <b>My plan</b> tab.</p>`)}</div></div>`;
  return `<div class="fkc-body" id="fkc-body" aria-live="polite">${hello}${a.chat.map(msgHTML).join("")}</div>
    <div class="fkc-sug" data-no-i18n>${suggest().map(s=> `<button type="button" data-fkc-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    <div class="fkc-in"><textarea id="fkc-q" rows="1" maxlength="1500" placeholder="${T("Hỏi về tập, ăn, ngủ, sức khoẻ…", "Ask about training, eating, sleep, health…")}" aria-label="${T("Câu hỏi của bạn", "Your question")}"></textarea><button type="button" id="fkc-send" aria-label="Gửi">${ic("arrow_upward")}</button></div>
    <p class="fkc-note">${esc(DISCLAIMER)}</p>`;
}
function scrollEnd(){ const b = document.getElementById("fkc-body"); if(b) b.scrollTop = b.scrollHeight; }
function bindChat(){
  const q = document.getElementById("fkc-q"), btn = document.getElementById("fkc-send"); if(!q) return;
  const grow = ()=>{ q.style.height = "auto"; q.style.height = Math.min(120, q.scrollHeight) + "px"; };
  q.addEventListener("input", grow);
  q.addEventListener("keydown", e=>{ if(e.key === "Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); btn.click(); } });
  btn.addEventListener("click", ()=>{ const v = q.value.trim(); if(!v || ui.busy) return; q.value = ""; grow(); send(v); });
  document.querySelectorAll("#fk-coach [data-fkc-sug]").forEach(b=> b.addEventListener("click", ()=>{ if(!ui.busy) send(b.dataset.fkcSug); }));
}
async function send(text){
  text = String(text || "").trim().slice(0, 1500); if(!text || ui.busy) return;
  if(ui.tab !== "chat"){ ui.tab = "chat"; render(); }
  const a = store(); a.chat.push({ role: "user", content: text, at: Date.now() });
  const body = document.getElementById("fkc-body");
  if(body){ body.insertAdjacentHTML("beforeend", msgHTML({ role: "user", content: text }) + `<div class="fkc-msg a" id="fkc-wait"><div class="fkc-b"><span class="fkc-dots" role="status" aria-label="${T("Đang trả lời", "Answering")}"><i></i><i></i><i></i></span></div></div>`); scrollEnd(); }
  ui.busy = true; const sb = document.getElementById("fkc-send"); if(sb) sb.disabled = true;
  let reply = null;
  try{
    const st = await status(false);
    if(st.enabled){
      const hist = a.chat.slice(-9).map(m=> ({ role: m.role, content: String(m.content).slice(0, 1800) }));
      const r = await askAI("chat", hist, buildContext(text, "chat"));
      if(r && r.text) reply = { role: "assistant", content: r.text, src: "ai", at: Date.now() };
    }
  }catch(e){
    const msg = String(e && e.message || "");
    if(/hết .* lượt|resource-exhausted/i.test(msg + (e && e.code || ""))) say(T(msg || "Đã hết lượt hỏi AI hôm nay", "You have used all of today's AI questions — try again tomorrow"), "info");
    if(/failed-precondition|chưa được bật/i.test(msg + (e && e.code || ""))) _status = { at: Date.now(), enabled: false, why: "off" };
  }
  if(!reply) reply = { role: "assistant", content: localAnswer(text), src: "local", at: Date.now() };
  a.chat.push(reply); if(a.chat.length > 40) a.chat = a.chat.slice(-40);
  save(); ui.busy = false;
  const w = document.getElementById("fkc-wait");
  if(w){ w.outerHTML = msgHTML(reply); scrollEnd(); paintHead(); const s2 = document.getElementById("fkc-send"); if(s2) s2.disabled = false; }
  else if(document.getElementById("fk-coach") && document.getElementById("fk-coach").classList.contains("open") && ui.tab === "chat") render();
}
/* ---------------- kế hoạch 4 tab ---------------- */
function optRow(key, opts, cur, multi){ return `<div class="fkc-opts" data-opt="${key}" ${multi ? 'data-multi="1"' : ""}>${opts.map(([v, l])=>{ const on = multi ? (cur || []).indexOf(v) >= 0 : String(cur) === String(v); return `<button type="button" data-v="${esc(v)}" class="${on ? "on" : ""}" aria-pressed="${on}">${esc(l)}</button>`; }).join("")}</div>`; }
function formHTML(){
  const f = ui.form = ui.form || defaultIntake();
  const eq = ((G.PB && G.PB.HOME_EQ) || []).map(e=> [e.label, e.label]), inj = ((G.PB && G.PB.INJ) || []).map(e=> [e.label, e.label]);
  return `<div class="fkc-card fkc-f">
      <h3>${ic("tune")}Thông tin của bạn</h3>
      <p style="color:var(--text-muted);font-size:13px;">Càng đúng, kế hoạch càng sát. Có thể sửa và lập lại bất cứ lúc nào.</p>
      <label>Mục tiêu</label>${optRow("goal", Object.keys(GOALS).map(k=> [k, GOALS[k]]), f.goal)}
      <label>Trình độ</label>${optRow("exp", [["beg", "Mới tập"], ["int", "6–24 tháng"], ["adv", "Trên 2 năm"]], f.exp)}
      <label>Số buổi mỗi tuần</label>${optRow("daysN", [2, 3, 4, 5, 6].map(n=> [n, n + " buổi"]), f.daysN)}
      <label>Thời gian mỗi buổi</label>${optRow("minutes", [30, 45, 60, 75, 90].map(n=> [n, n + " phút"]), f.minutes)}
      <label>Thiết bị có sẵn</label>${optRow("place", [["gym", "Phòng gym đủ máy"], ["home", "Tập ở nhà"]], f.place)}
      <div data-home ${f.place === "home" ? "" : "hidden"}><label>Ở nhà bạn có gì? (bỏ trống = không dụng cụ)</label>${optRow("equip", eq, f.equip, true)}</div>
      ${inj.length ? `<label>Vùng đang đau / cần tránh (nếu có)</label>${optRow("inj", inj, f.inj, true)}` : ""}
      <div class="fkc-row"><div><label for="fkc-w">Cân nặng (kg)</label><input id="fkc-w" type="number" inputmode="decimal" min="30" max="250" value="${esc(f.weight)}"></div><div><label for="fkc-h">Chiều cao (cm)</label><input id="fkc-h" type="number" inputmode="numeric" min="120" max="230" value="${esc(f.height)}"></div></div>
      <div class="fkc-row"><div><label for="fkc-s">Ngủ trung bình (giờ)</label><input id="fkc-s" type="number" inputmode="decimal" min="3" max="12" step="0.5" value="${esc(f.sleepH)}"></div><div><label for="fkc-k">Thường dậy lúc</label><input id="fkc-k" type="time" value="${esc(f.wake)}"></div></div>
      <label>Chế độ ăn</label>${optRow("diet", Object.keys(DIETS).map(k=> [k, DIETS[k]]), f.diet)}
      <label for="fkc-al">Dị ứng / món không ăn (cách nhau bằng dấu phẩy)</label><input id="fkc-al" type="text" maxlength="120" placeholder="VD: tôm, sữa, đậu phộng" value="${esc(f.allergy)}">
      <label for="fkc-nt">Ghi chú thêm (tuỳ chọn)</label><input id="fkc-nt" type="text" maxlength="200" placeholder="VD: làm ca đêm, muốn ưu tiên mông – đùi" value="${esc(f.note)}">
      <button type="button" class="btn btn-primary btn-block" style="margin-top:16px;" data-fkc="make">${ic("bolt")}Lập kế hoạch cho tôi</button>
      ${store().plan ? `<button type="button" class="btn btn-ghost btn-block" style="margin-top:6px;" data-fkc="form-cancel">Quay lại kế hoạch hiện tại</button>` : ""}
    </div>
    <div class="fkc-warn">${ic("info")}<span>AI gợi ý dựa trên thông tin bạn cung cấp. Đây không phải chẩn đoán hay chỉ định y tế. Có bệnh nền, đang mang thai hoặc đang điều trị chấn thương → hỏi bác sĩ trước khi áp dụng.</span></div>`;
}
const PTABS = [["workout", "Tập luyện", "fitness_center"], ["nutrition", "Ăn uống", "restaurant"], ["sleep", "Ngủ & Nghỉ", "bedtime"], ["health", "Sức khỏe", "shield"]];
const li = arr=> `<ul data-no-i18n>${(arr || []).map(x=> `<li>${fmt(x).replace(/^<p>|<\/p>$/g, "")}</li>`).join("")}</ul>`;
function planHTML(){
  if(ui.busy === "plan") return `<div class="fkc-load"><span class="fkc-dots" style="transform:scale(1.6);"><i></i><i></i><i></i></span><p id="fkc-step" data-no-i18n>${T("Đang đọc hồ sơ và kho bài tập của app…", "Reading your profile and the app's exercise library…")}</p></div>`;
  let P = store().plan;
  if(P && !ui.editing && P.src === "local" && (P.lang || "vi") !== LANG()){ P = store().plan = localPlan(P.intake); save(); }   // kế hoạch của bộ luật: đổi ngôn ngữ → dựng lại ngay (không tốn lượt AI)
  if(!P || ui.editing) return formHTML();
  const stale = (P.lang || "vi") !== LANG();
  const E = EX(), R = RC();
  const head = `<div class="fkc-tabs" role="tablist">${PTABS.map(([k, l, i])=> `<button type="button" role="tab" aria-selected="${ui.ptab === k}" class="${ui.ptab === k ? "on" : ""}" data-fkc="ptab:${k}">${ic(i)}${l}</button>`).join("")}</div>`;
  let body = "";
  if(ui.ptab === "workout"){
    body = `<div class="fkc-card"><h3 data-no-i18n>${ic("fitness_center")}${T(`Lịch tập ${P.workout.days.length} buổi/tuần`, `${P.workout.days.length}-day training week`)}</h3><p data-no-i18n>${esc(P.workout.summary)}</p>
      ${P.workout.days.map(d=> `<div class="fkc-day"><b class="t"><span data-no-i18n>${dayName(d.day)}</span>${esc(d.title)}</b><ol>${d.items.map(x=> E[x.id] ? `<li><button type="button" class="fkc-chip" data-no-i18n data-fkc="ex:${esc(x.id)}">${esc(nm(E[x.id].name))}</button> <small data-no-i18n>${x.sets} ${T("hiệp", "sets")} × ${esc(repsTr(x.reps))} · ${T("nghỉ", "rest")} ${x.rest}s</small></li>` : "").join("")}</ol>
        ${d.cardio && d.cardio.minutes > 0 ? `<div class="fkc-cardio" data-no-i18n>${ic("directions_run")}<span><b>${T("Cardio sau tập", "Cardio after lifting")}: ${esc(d.cardio.type)} ${d.cardio.minutes} ${T("phút", "min")}.</b> ${esc(d.cardio.note || "")}</span></div>` : ""}</div>`).join("")}
      <h4>Nguyên tắc</h4>${li(P.workout.notes)}
      <button type="button" class="btn btn-primary btn-block" style="margin-top:14px;" data-fkc="apply">${ic("event_available")}Thêm vào tuần tập</button></div>`;
  } else if(ui.ptab === "nutrition"){
    const n = P.nutrition;
    body = `<div class="fkc-card"><h3>${ic("restaurant")}Mục tiêu mỗi ngày</h3><div class="fkc-kpis"><div><b data-no-i18n>${EN() ? Math.round(n.kcal).toLocaleString("en-US") : nf(n.kcal)}</b><small>kcal</small></div><div><b>${n.protein}</b><small>g đạm</small></div><div><b>${n.carbs}</b><small>g tinh bột</small></div><div><b>${n.fat}</b><small>g béo</small></div></div>
      <h4>Nguyên tắc</h4>${li(n.principles)}</div>
      <div class="fkc-card"><h3>${ic("restaurant")}Gợi ý theo bữa (món có trong app)</h3>${n.meals.map(m=> `<div style="margin-bottom:10px;"><b style="font-size:14px;">${esc(m.meal)}</b><div style="margin-top:4px;">${m.recipe_ids.map(id=>{ const r = R.find(x=> x.id === id); return r ? `<button type="button" class="fkc-chip" data-no-i18n data-fkc="recipe:${esc(id)}">${ic("restaurant")}${esc(tr(r.name))}</button>` : ""; }).join("")}</div>${m.note ? `<p data-no-i18n style="font-size:12.5px;color:var(--text-muted);margin-top:4px;">${esc(m.note)}</p>` : ""}</div>`).join("")}
      <h4>Nên hạn chế</h4>${li(n.avoid)}
      <button type="button" class="btn btn-outline btn-block" style="margin-top:12px;" data-fkc="go:nutrition">${ic("restaurant")}Mở Dinh dưỡng để ghi bữa</button></div>`;
  } else if(ui.ptab === "sleep"){
    const s = P.sleep;
    body = `<div class="fkc-card"><h3>${ic("bedtime")}Giờ ngủ gợi ý</h3><div class="fkc-kpis" style="grid-template-columns:repeat(3,1fr);"><div><b>${esc(s.bedtime)}</b><small>lên giường</small></div><div><b>${esc(s.wake)}</b><small>thức dậy</small></div><div><b>${dec(s.hours)}</b><small>giờ ngủ</small></div></div>
      <h4>Ngày nghỉ trong tuần</h4><p data-no-i18n>${s.rest_days.length ? s.rest_days.map(dayName).join(" · ") : T("Không có ngày nghỉ hẳn — hãy để ít nhất 1 ngày chỉ đi bộ nhẹ.", "No full rest day — keep at least one day for easy walking only.")}</p>
      <h4>Thói quen</h4>${li(s.tips)}
      <button type="button" class="btn btn-outline btn-block" style="margin-top:12px;" data-fkc="sleepgoal" data-no-i18n>${ic("check_circle")}${esc(T(`Đặt mục tiêu ngủ ${dec(s.hours)} giờ trong app`, `Set a ${s.hours}-hour sleep goal in the app`))}</button></div>`;
  } else {
    const h = P.health;
    body = `<div class="fkc-warn">${ic("info")}<span><b>Chỉ là gợi ý lối sống, không thay thế bác sĩ.</b> Trợ lý không chẩn đoán bệnh, không kê thuốc. Có triệu chứng bất thường hãy đi khám.</span></div>
      <div class="fkc-card"><h3>${ic("shield")}Lời khuyên sức khỏe</h3>${li(h.tips)}</div>
      <div class="fkc-card"><h3>${ic("warning")}Cần lưu ý</h3>${li(h.warnings)}</div>`;
  }
  const when = new Date(P.at || Date.now());
  return head + (stale ? `<div class="fkc-warn" data-no-i18n>${ic("info")}<span>${T("Kế hoạch này được lập bằng tiếng Anh. Bấm “Sửa thông tin & lập lại” ở cuối để có bản tiếng Việt.", "This plan was written in Vietnamese. Tap “Edit details & rebuild” at the bottom to get it in English.")}</span></div>` : "") + body + `<p data-no-i18n style="font-size:12px;color:var(--text-muted);text-align:center;margin:4px 0 10px;">${P.src === "local" ? T("Lập bằng bộ luật chuyên môn của app", "Built with the app's coaching rules") : P.src === "mixed" ? T("AI gợi ý · lịch tập do bộ luật của app hoàn thiện", "AI suggestions · workout schedule completed by the app's rules") : T("AI gợi ý dựa trên thông tin bạn cung cấp", "AI suggestions based on the information you gave")} · ${EN() ? when.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : when.getDate() + "/" + (when.getMonth() + 1)}</p>
    <button type="button" class="btn btn-ghost btn-block" data-fkc="edit">${ic("edit")}Sửa thông tin &amp; lập lại</button>`;
}
function readForm(){
  const f = ui.form || defaultIntake(), v = id=>{ const el = document.getElementById(id); return el ? el.value : ""; };
  f.weight = v("fkc-w"); f.height = v("fkc-h"); f.sleepH = v("fkc-s"); f.wake = v("fkc-k") || f.wake; f.allergy = v("fkc-al"); f.note = v("fkc-nt");
  return f;
}
function bindPlan(){
  document.querySelectorAll("#fk-coach [data-opt]").forEach(box=> box.addEventListener("click", e=>{
    const b = e.target.closest ? e.target.closest("button[data-v]") : null; if(!b) return;
    const k = box.dataset.opt, f = ui.form; let v = b.dataset.v; if(k === "daysN" || k === "minutes") v = Number(v);
    if(box.dataset.multi){ const arr = f[k] = Array.isArray(f[k]) ? f[k] : []; const i = arr.indexOf(v); if(i >= 0) arr.splice(i, 1); else arr.push(v); b.classList.toggle("on", i < 0); b.setAttribute("aria-pressed", String(i < 0)); }
    else { f[k] = v; box.querySelectorAll("button").forEach(x=>{ const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); }); }
    if(k === "place"){ const h = document.querySelector("#fk-coach [data-home]"); if(h) h.hidden = v !== "home"; }
  }));
}
async function makePlan(){
  if(ui.busy) return;
  const it = cleanIntake(readForm()); const a = store(); a.intake = it; ui.form = it; save();
  ui.busy = "plan"; ui.editing = false; render();
  const step = t=>{ const el = document.getElementById("fkc-step"); if(el) el.textContent = t; };
  let P = null;
  try{
    const st = await status(false);
    if(st.enabled){
      step(T("AI đang ghép lịch tập, bữa ăn và giờ ngủ cho bạn… (có thể mất 20–60 giây)", "The AI is putting together your workouts, meals and sleep schedule… (this can take 20–60 seconds)"));
      const r = await askAI("plan", [{ role: "user", content: (EN() ? "Build my personal 4-part plan (training, nutrition, sleep & rest, health) from the information in <app_data>. Write every text value in English. " : "Hãy lập kế hoạch cá nhân 4 phần (tập luyện, ăn uống, ngủ & nghỉ, sức khỏe) cho tôi theo thông tin trong <app_data>. ") + intakeText(it) }], buildContext("", "plan", it));
      if(r && r.plan){ step(T("Đang đối chiếu với thư viện của app…", "Checking it against the app's library…")); P = validatePlan(r.plan, it); }
    }
  }catch(e){ const msg = String(e && e.message || ""); if(/hết .* lượt/i.test(msg)) say(T(msg, "You have used all of today's AI questions — building the plan with the app's own rules"), "info"); }
  if(!P){ step(T("Đang lập kế hoạch bằng bộ luật chuyên môn của app…", "Building your plan with the app's coaching rules…")); await new Promise(r=> setTimeout(r, 350)); P = localPlan(it); }
  a.plan = P; save(); ui.busy = false; ui.ptab = "workout";
  if(document.getElementById("fk-coach").classList.contains("open")){ ui.tab = "plan"; render(); const b = document.getElementById("fkc-body"); if(b) b.scrollTop = 0; }
  else say(T("Kế hoạch của bạn đã sẵn sàng — mở Trợ lý AI để xem", "Your plan is ready — open the AI assistant to view it"), "bolt");
}
async function applyPlan(){
  const P = store().plan, st = ST(); if(!P || !st) return;
  const plan = toAppPlan(P);
  say(T("Đang thêm lịch tập & gắn video…", "Adding your schedule and attaching videos…"), "videocam");
  let res = { total: 0, withVid: 0 };
  try{ if(typeof tplAttachVideos === "function") res = await tplAttachVideos(plan); }catch(e){}
  try{ if(G.FKEquip) G.FKEquip.applyPrefs(plan); }catch(e){}
  st.plans[plan.id] = plan; st.activePlanId = plan.id; try{ st.selectedDay = todayDayKey(); }catch(e){}
  save(); close();
  try{ goto("workout"); }catch(e){}
  say(T(`Đã thêm "${plan.name}" vào tuần tập${res.total ? ` · ${res.withVid}/${res.total} bài có video` : ""}`, `Added "${plan.name}" to your week${res.total ? ` · ${res.withVid}/${res.total} exercises have videos` : ""}`), "check_circle");
}
function openExercise(id){
  const e = EX()[id]; if(!e || typeof openSheet !== "function") return;
  openSheet(`<div class="sheet-header"><h3 style="font-size:18px;">${esc(e.name)}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    ${e.img ? `<img src="${esc(e.img)}" alt="" style="width:100%;height:170px;object-fit:cover;border-radius:16px;margin-bottom:12px;" onerror="this.style.display='none'">` : ""}
    <div class="chip-row" style="margin-bottom:10px;"><span class="pill hot">${esc(e.muscle)}</span><span class="pill">${esc(e.equipment)}</span><span class="pill">${esc(e.sets)} hiệp × ${esc(e.reps)}</span></div>
    <p class="small-note" style="font-size:14px;line-height:1.55;">${esc(e.guide || "")}</p>
    <button class="btn btn-primary btn-block" style="margin-top:14px;" id="fkc-add-ex" data-no-i18n>${ic("add")}${T("Thêm vào buổi ", "Add to ")}${esc(dayName((ST() || {}).selectedDay) || T("hôm nay", "today"))}</button>`);
  const b = document.getElementById("fkc-add-ex");
  if(b) b.addEventListener("click", ()=>{
    try{ const plan = getActivePlan(), st = ST(), k = DK.indexOf(st.selectedDay) >= 0 ? st.selectedDay : todayDayKey();
      plan.days[k].items.push({ uid: id + "_" + uid(), exerciseId: id, custom: null, sets: e.sets, reps: e.reps, restSec: e.restSec, clipId: null }); save(); closeSheet(); say(T(`Đã thêm ${e.name} vào ${DL[k]}`, `Added ${nm(e.name)} to ${DL_EN[k]}`), "check_circle");
      try{ if(document.querySelector("#screen-workout.active")) renderWorkoutScreen(); }catch(_){} }catch(err){ say(T("Chưa thêm được — mở Tập luyện rồi thử lại", "Could not add it — open Workout and try again"), "error"); }
  });
}
function onClick(e){
  const b = e.target.closest ? e.target.closest("[data-fkc]") : null; if(!b) return;
  const v = b.dataset.fkc, i = v.indexOf(":"), k = i < 0 ? v : v.slice(0, i), arg = i < 0 ? "" : v.slice(i + 1);
  if(k === "close") return close();
  if(k === "tab"){ ui.tab = arg; return render(); }
  if(k === "clear"){ if(confirm(T("Xoá toàn bộ cuộc trò chuyện trên máy này?", "Delete the whole conversation on this device?"))){ store().chat = []; save(); render(); } return; }
  if(k === "ptab"){ ui.ptab = arg; render(); const bd = document.getElementById("fkc-body"); if(bd) bd.scrollTop = 0; return; }
  if(k === "make") return makePlan();
  if(k === "edit"){ ui.editing = true; ui.form = cleanIntake(store().intake || defaultIntake()); return render(); }
  if(k === "form-cancel"){ ui.editing = false; return render(); }
  if(k === "apply") return applyPlan();
  if(k === "go"){ close(); try{ goto(arg); }catch(_){} return; }
  if(k === "sleepgoal"){ const P = store().plan, st = ST(); if(P && st){ st.profile.sleepGoalHours = P.sleep.hours; save(); say(T(`Đã đặt mục tiêu ngủ ${String(P.sleep.hours).replace(".", ",")} giờ`, `Sleep goal set to ${P.sleep.hours} hours`), "bedtime"); } return; }
  if(k === "ex") return openExercise(arg);
  if(k === "recipe"){ try{ openRecipe(arg); }catch(_){} return; }
  if(k === "tpl"){ try{ openTemplateBrowser(); }catch(_){} return; }
  if(k === "kb"){ try{ (G.TEKB || G.TE_KB).openArticle(arg); }catch(_){} return; }
}

/* =====================================================================
   5. THẺ CARDIO SAU BUỔI TẬP (màn Tập luyện)
   ===================================================================== */
function cardioCard(){
  try{
    const host = document.getElementById("exercise-list"); if(!host) return;
    const old = document.getElementById("fkc-cd"); if(old) old.remove();
    const st = ST(), plan = getActivePlan(); if(!st || !plan || !plan.days) return;
    const day = plan.days[st.selectedDay]; if(!day) return;
    css();
    const box = document.createElement("div"); box.className = "fkc-cd"; box.id = "fkc-cd";
    const goal = (st.aiCoach && st.aiCoach.intake && st.aiCoach.intake.goal) || (st.profile && st.profile.goal) || "";
    box.setAttribute("data-no-i18n", "");
    if(!day.items.length){
      box.innerHTML = `<h4>${ic("directions_run")}${T("Ngày nghỉ: vận động nhẹ", "Rest day: move lightly")}</h4><p>${T("Đi bộ thong thả 20–30 phút và giữ <b>8.000–10.000 bước</b> hôm nay — máu lưu thông tốt giúp cơ bớt đau nhức và hồi phục nhanh hơn.", "Take an easy 20–30 minute walk and keep <b>8,000–10,000 steps</b> today — good blood flow eases soreness and speeds up recovery.")}</p>`;
    } else {
      const metas = day.items.map(it=> getExerciseMeta(it));
      const hasCardio = metas.some(m=> isCardio(m.muscle));
      const ids = day.items.map(it=> it.exerciseId).filter(Boolean);
      const legs = metas.filter(m=> isLeg(m.muscle)).length, backs = metas.filter(m=> isBack(m.muscle)).length;
      const heavy = heavyDay(ids) || legs >= 2 || backs >= 3;
      const c = hasCardio ? null : cardioFor(ids, goal);
      const rec = c && heavy && c.id !== "walking" ? { id: "walking", type: T("Đi bộ nhẹ / đạp xe nhẹ", "Easy walk / easy cycling"), minutes: 15, note: T("Buổi chân / lưng nặng: chỉ cardio nhẹ, không HIIT.", "Heavy leg / back day: easy cardio only, no HIIT.") } : c;
      box.innerHTML = hasCardio
        ? `<h4>${ic("directions_run")}${T("Buổi này đã có cardio", "This session already has cardio")}</h4><p>${T(`Giữ cường độ thấp–vừa (vẫn nói được câu dài)${heavy ? "; hôm nay tập chân / lưng nặng nên <b>không HIIT</b>" : ""}. Ngoài phòng tập giữ 8.000–10.000 bước/ngày.`, `Keep it low-to-moderate (you can still speak full sentences)${heavy ? "; today is a heavy leg / back day, so <b>no HIIT</b>" : ""}. Outside the gym keep 8,000–10,000 steps a day.`)}</p>`
        : `<h4>${ic("directions_run")}${T("Nên cardio nhẹ sau buổi này", "Add easy cardio after this session")}</h4>
           <p><b>${esc(rec.type)} ${rec.minutes} ${T("phút", "min")}</b> — ${esc(rec.note)}</p>
           <details><summary>${T("Vì sao nên cardio sau tập?", "Why do cardio after lifting?")}</summary><ul>${(EN() ? ["It does not steal energy from your lifts — strength and muscle gain stay optimal.", "Burns extra fat and raises calories burned after training (EPOC).", "Boosts blood flow, helping recovery and reducing muscle soreness (DOMS).", "Good for heart health and overall endurance.", "Save HIIT for another day or at least 6 hours away from lifting" + (heavy ? " — especially after a heavy leg / back day like today." : "."), "When you finish (cardio included), eat protein + carbs to recover."]
             : ["Không lấy sức của bài tạ — vẫn tối ưu sức mạnh và tăng cơ.", "Đốt thêm mỡ và tăng lượng calo tiêu hao sau tập (EPOC).", "Tăng lưu thông máu, giúp phục hồi và giảm đau nhức cơ (DOMS).", "Tốt cho tim mạch và sức bền tổng thể.", "HIIT để ngày khác hoặc cách buổi tạ ít nhất 6 giờ" + (heavy ? " — nhất là sau buổi chân / lưng nặng như hôm nay." : "."), "Tập xong (cả cardio) nhớ nạp đạm + tinh bột để phục hồi."]).map(x=> `<li>${x}</li>`).join("")}</ul></details>
           <div class="acts"><button type="button" class="btn btn-outline btn-sm" id="fkc-cd-add">${ic("add")}${T("Thêm vào buổi này", "Add to this session")}</button><button type="button" class="btn btn-ghost btn-sm" id="fkc-cd-ask">${ic("smart_toy")}${T("Hỏi trợ lý", "Ask the assistant")}</button></div>`;
      host.insertAdjacentElement("afterend", box);
      const add = box.querySelector("#fkc-cd-add");
      if(add) add.addEventListener("click", ()=>{
        const E = EX(), id = rec.id && E[rec.id] ? rec.id : "";
        day.items.push(id ? { uid: id + "_" + uid(), exerciseId: id, custom: null, sets: 1, reps: `${rec.minutes} phút`, restSec: 0, clipId: null }
          : { uid: uid(), exerciseId: null, custom: { name: T(`${rec.type} (cardio nhẹ sau tập)`, `${rec.type} (easy cardio after lifting)`), muscle: "Tim mạch", equipment: "Máy chạy / xe đạp", guide: T("Giữ cường độ thấp–vừa: vẫn nói được câu dài.", "Keep it low-to-moderate: you can still speak full sentences.") }, sets: 1, reps: `${rec.minutes} phút`, restSec: 0, clipId: null });
        save(); say(T(`Đã thêm ${rec.type} ${rec.minutes} phút vào cuối buổi`, `Added ${rec.minutes} min of ${rec.type.toLowerCase()} to the end of the session`), "check_circle"); try{ renderWorkoutScreen(); }catch(e){}
      });
      const ask = box.querySelector("#fkc-cd-ask"); if(ask) ask.addEventListener("click", ()=> open({ tab: "chat", ask: T("Sau buổi " + (day.title || "tập hôm nay") + " mình nên cardio thế nào?", "What cardio should I do after my " + tr(day.title || "workout") + " session?") }));
      return;
    }
    host.insertAdjacentElement("afterend", box);
  }catch(e){}
}

/* ---------------- gắn vào app ---------------- */
function install(){
  if(install.done || typeof document === "undefined") return; install.done = true;
  try{ if(typeof renderWorkoutScreen === "function"){ const _r = renderWorkoutScreen; renderWorkoutScreen = function(){ const r = _r.apply(this, arguments); cardioCard(); return r; }; } }catch(e){}
  try{ if(typeof goto === "function"){ const _g = goto; goto = function(){ const r = _g.apply(this, arguments); try{ syncFab(); }catch(e){} return r; }; } }catch(e){}
  const boot = ()=>{ try{ mount(); syncFab(); if(document.querySelector("#screen-workout.active")) cardioCard(); }catch(e){} };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", ()=> setTimeout(boot, 600)); else setTimeout(boot, 600);
  try{ setInterval(syncFab, 4000); }catch(e){}
  try{ if(G.FK_I18N && G.FK_I18N.onChange) G.FK_I18N.onChange(()=>{ _docs = null;
    try{ const ov = document.getElementById("fk-coach"); if(ov && ov.classList.contains("open") && !ui.busy) render(); if(document.querySelector("#screen-workout.active")) cardioCard(); }catch(e){} }); }catch(e){}
}
G.FKCoach = { __v: 1, lang: LANG, suggest, nm, open, close, send, status, lib: { docs, retrieve, GUIDE, TOPICS }, buildContext, profileText, intakeText, cleanIntake, defaultIntake, localPlan, validatePlan, toAppPlan, localAnswer,
  cardioFor, fixCardio, heavyDay, dietOk, targets, fmt, cardioCard, syncFab, DISCLAIMER, _reset: ()=>{ _docs = null; _status = { at: 0, enabled: false }; } };
try{ install(); }catch(e){}
})(typeof window !== "undefined" ? window : globalThis);

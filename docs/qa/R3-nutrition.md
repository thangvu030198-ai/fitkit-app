# R3 — Mảng Dinh dưỡng / Sức khoẻ / Kho kiến thức · TapEasy (14/11/2026)

Agent **nutrition**. File sở hữu: `data.js`, `meals.js`, `meals-extra.js`, `nutrition.js`, `nutrition-pro.js/.css`, `health-safety.js/.css`,
`coach.js`, `kb.js/.css`, `kb-data-*.js`. Test hồi quy: `tests/suites/81-r3-nutrition.test.js` (16 test, xanh).
File đã sửa vòng này: `meals.js`, `meals-extra.js`, `nutrition.js`, `nutrition-pro.js`, `health-safety.js`. Không sửa CSS, không thêm file mới.

## 1. Phương pháp và giới hạn

- Đọc mã + **fuzz bằng harness Node** (`tests/lib/harness.js`): 20 hồ sơ phi lý (cân nặng âm/NaN/0/700 kg, cao 1,72 "cm"/300 cm, tuổi 0/5/150,
  mục tiêu tự đặt 600 / NaN / −500 / 99.999 kcal), nhật ký ăn/nước chứa null, chuỗi, số âm, `1e308`, `1e12`, payload `<img onerror>`,
  `state.nutriPro` hỏng (custom / recent / fav / swaps), bộ nhớ thực đơn `fitkit_np_plans_v1` hỏng.
- Rà nội dung: quét từ khoá khẳng định y khoa trong 6 file `kb-data-*.js` và mọi `tip` món ăn.
- **Chưa làm:** kiểm thử trình duyệt thật (Playwright) cho vòng này — mọi kiểm chứng là Node + DOM giả. Hai thay đổi ở trình xử lý sự kiện
  (trần nút cộng nước, kiểm tra mật độ năng lượng khi lưu món tự tạo) chỉ được test ở mức mã nguồn + logic làm sạch, chưa bấm thật.
- `coach.js` và `kb.js`: chỉ rà tĩnh các chỗ chèn `${…}` vào HTML (không thấy chỗ chèn thô dữ liệu cloud/người dùng), không fuzz sâu.

## 2. Bảng lỗi

Tổng: **Critical 0 · High 3 · Medium 8 · Low 2** — đã sửa 13/13 trong file của tôi; 5 mục chuyển giao.

| Mã | Mức | File:dòng | Mô tả | Tái hiện | Sửa | Trạng thái |
|---|---|---|---|---|---|---|
| R3-NUT-01 | High | `nutrition-pro.js:709-785` (`NPS`, `npCleanState`, `syncCustomFoods`) | 1 phần tử `null`/chuỗi trong `state.nutriPro.custom` làm `nutrition-pro.js` **ném lỗi ngay lúc nạp** → mất `NutriPro` (thực đơn Pro, đi chợ, đổi món); `recent`/`fav` có phần tử không phải chuỗi/object làm sheet "Thêm món" ném lỗi | state có `nutriPro:{custom:[null]}` (bản sao lưu Drive / đồng bộ / bản cũ) rồi mở app | `npCleanState` làm sạch `custom`/`recent`/`fav` 1 lần cho mỗi mảng (WeakSet); `syncCustomFoods` bọc `try` và bỏ phần tử hỏng | Đã sửa |
| R3-NUT-02 | High (bảo mật) | `nutrition.js:92-104` (`nuEmo`, `foodPic`) · `nutrition-pro.js:715-760, 778, 1310-1325, 1470` | **XSS lưu trữ** qua dữ liệu khôi phục: `emoji` của món tự tạo chèn thô vào HTML *và* vào chuỗi JS của `onerror`; `units[].g`, `recent[].g`, `recent[].f` chèn không escape; món tự tạo mang id trùng thực phẩm có sẵn (vd `uc-ga`) ghi đè dữ liệu gốc | khôi phục bản sao lưu có `custom:[{id:"cf-1", emoji:"<img src=x onerror=…>", units:[{label:"x", g:"<img…>"}]}]` → mở "Thêm món" | id món tự tạo phải khớp `^cf-[a-z0-9-]{1,40}$`, không ghi đè thực phẩm gốc; emoji luôn là 🍽️ + `nuEmo` lọc ký tự HTML/JS; số ép kiểu và kẹp khoảng; mọi chỗ in ra qua `esc` | Đã sửa |
| R3-NUT-03 | High | `nutrition.js:107-160, 178, 502` (`nuCleanEntry`, `nuCleanDay`, `nuCleanLogs`) | 1 dòng `null`/chuỗi trong `foodLog[ngày][bữa]` → `renderNutritionScreen` ném lỗi (màn Dinh dưỡng trắng) và thẻ Trang chủ của `ui-signature.js` cũng lỗi; ngày thiếu khoá bữa (`snack`) → `.push()` ném lỗi khi thêm món | `foodLog:{"2026-11-14":{breakfast:[null]}}` | làm sạch cả nhật ký 1 lần lúc nạp file (trước `appBoot`) và mỗi khi `state.foodLog` đổi; hôm nay luôn đủ 4 bữa; dòng hợp lệ giữ nguyên | Đã sửa |
| R3-NUT-04 | Medium | `nutrition.js:112-125` | kcal/macro/gam âm, NaN, chuỗi, Infinity, 1e12 trong nhật ký được cộng thẳng: kcal âm làm "Còn … kcal" tăng giả, hiện `∞`, `-500`, chuỗi số dài 300 ký tự phá bố cục | dòng `{kcal:-500, fat:1e308}` | kẹp: kcal 0–20.000, gam 0–10.000, macro/xơ 0–5.000; tên là chuỗi ≤ 120 ký tự | Đã sửa |
| R3-NUT-05 | Medium | `nutrition.js:150-158, 451, 480-495` | nước âm/NaN/cực lớn hiện nguyên ("-5 / 2,5 L"); nút +250/+500 ml cộng vô hạn, không cảnh báo uống quá nhiều | `waterLog:{hôm nay:-5}`; bấm +500 ml 60 lần | kẹp 0–15 L/ngày; nút có trần; vượt max(5 L, mục tiêu + 2 L) → nhắc 1 lần/ngày về hạ natri máu | Đã sửa |
| R3-NUT-06 | Medium | `nutrition.js:162-172` (`recipeMacros`) · `nutrition-pro.js:26-36` (`itemsMacros`) | `items` thiếu / dòng không phải mảng / gam âm, NaN → ném lỗi hoặc ra NaN (ảnh hưởng thẻ thực đơn, chi tiết món, đi chợ) | `recipeMacros({items:[null,["uc-ga",-5]]})` | bỏ qua dòng hỏng, chỉ nhận gam hữu hạn > 0 | Đã sửa |
| R3-NUT-07 | Medium | `nutrition-pro.js:44, 52-77` (`npTargets`) · `nutrition.js:507, 516` | mục tiêu phi lý từ hồ sơ hỏng/tự đặt cũ: 99.999 kcal → thực đơn 4.711 kcal, đạm 8.749 g; `goalKcal` NaN → đồng hồ calo và macro hiện `NaN`/`null g` | `profile:{autoTargets:false, goalKcal:99999, protein:9999}` | trần 6.000 kcal (bằng giới hạn ô nhập của `app.js`), NaN/Infinity/âm → mặc định; ghi chú trên thẻ thực đơn khi bị trần (`T.capped`); macro mục tiêu hỏng hiện "—" | Đã sửa |
| R3-NUT-08 | Medium | `meals.js:372-384` (`bodyAnalysis`) | số đo phi lý vẫn được xếp loại và khuyên ăn: cân nặng âm → "Thiếu cân"; cao nhập 1,72 → BMI 236.614 "Béo phì độ II — ăn THÂM HỤT 20 %" | `bodyAnalysis({weight:70,height:1.72})` | chỉ tính khi 80–250 cm, 10–400 kg, BMI 8–100; ngoài khoảng → "Chưa đủ thông tin" + nhắc kiểm tra đơn vị | Đã sửa |
| R3-NUT-09 | Medium | `meals.js:387-394` · `health-safety.js:108-121, 143, 160, 372-377, 404-406, 818, 1103` | BMI < 16 chỉ nhận lời khuyên "ăn dư + tập tạ", không khuyên đi khám; BMI ≥ 35 không nhắc theo dõi y tế; người lớn BMI < 18,5 tự đặt calo thấp không bị lớp an toàn cảnh báo | nữ 25 tuổi 165 cm 42 kg | `bodyAnalysis` thêm lời khuyên đi khám / tăng từ từ (BMI < 16) và giảm cân có bác sĩ theo dõi (≥ 35), trả `severe`; `hsFlags` thêm `underweight` (→ không thâm hụt, cảnh báo mục tiêu tự đặt) và `lowBmi` (→ "nên hỏi bác sĩ", thận trọng cường độ rất cao, khối lời khuyên riêng) | Đã sửa |
| R3-NUT-10 | Medium | `nutrition-pro.js:420-430` (`npStoreGet`) | bộ nhớ thực đơn ở `localStorage["fitkit_np_plans_v1"]` không được kiểm tra: 1 dòng hỏng → màn Dinh dưỡng ném lỗi **mỗi lần mở** (vì bản nhớ bền), gam kiểu chuỗi lọt vào HTML | sửa tay 1 dòng `items` thành `null` trong localStorage | kiểm từng dòng `[mã thực phẩm có thật, 0 < gam ≤ 5.000]`, món phụ, tên bữa, hệ số; sai → bỏ bản nhớ, tính lại | Đã sửa |
| R3-NUT-11 | Medium | `nutrition-pro.js:1604-1608` (`openCustomFood`) · `:722-737` | món tự tạo nhận giá trị bất khả thi: "1 đơn vị = 1 g, 450 kcal" → 45.000 kcal/100 g | Tự tạo món, nhập 1 g + 450 kcal | chặn > 9 kcal/g và tổng macro + xơ > khối lượng; dữ liệu cũ bị kẹp 900 kcal/100 g, macro ≤ 100 g/100 g | Đã sửa |
| R3-NUT-12 | Low | `meals.js:143` · `meals-extra.js:559` | 2 tip món ăn hàm ý công dụng với bệnh ("tốt cho tim mạch", "hợp người cần kiểm soát đường huyết") — rủi ro Luật Quảng cáo / NĐ 15/2018 nếu bị coi là quảng cáo thực phẩm có công dụng | đọc tip "Cá thu sốt cà", "Xôi bắp" | viết lại trung tính | Đã sửa |
| R3-NUT-13 | Low | `nutrition-pro.js:701` | `shopPeople` không phải số hợp lệ (chuỗi, 0, 9999) được dùng nhân khẩu phần đi chợ | `nutriPro:{shopPeople:"<b>"}` | kẹp 1–20, sai → 1 | Đã sửa |

### Đã rà, không thấy lỗi mới
- **Công thức** (trong `app.js`, đọc để đối chiếu): Mifflin-St Jeor đúng hệ số (10·kg + 6,25·cm − 5·tuổi, +5 nam / −161 nữ); PAL 1,2–1,9; sàn 1.200/1.500 kcal và không dưới BMR; chặn thâm hụt khi BMI < 18,5 hoặc < 18 tuổi; EER IOM cho 9–17 tuổi; đạm theo cân nặng điều chỉnh, trần 180 g và 35 % năng lượng.
- **health-safety**: thai kỳ (không thâm hụt, +kcal theo tam cá nguyệt, bỏ món tái, bỏ bột đạm), cho bú, < 18 tuổi, bệnh thận (trần đạm, lọc máu không đặt mục tiêu nước), tiểu đường, tim mạch, RLĂU (ẩn calo) — lời khuyên đều kèm "hỏi bác sĩ", số cấp cứu 115 đúng; không có chỉ định liều thuốc.
- **Kho kiến thức** (6 file): không có khẳng định chữa/điều trị bệnh hay cam kết kết quả; các bài nhạy cảm (thực phẩm bổ sung, giảm cân, chấn thương) có khung an toàn + nguồn; mỗi bài có dòng "không thay thế tư vấn y tế". Test R3-NUT-12 khoá lại.
- **Hiệu năng**: 300 món tự tạo + 400 dòng nhật ký: vẽ màn + mở "Thêm món" < 1,5 s trong Node (test R3-NUT-PERF); danh sách vẫn vẽ 30 dòng đầu rồi nạp dần.

## 3. Nâng cấp
Prompt không giao nâng cấp riêng ngoài trọng tâm rà soát. Phần thêm mới nằm trong các bản sửa: lớp làm sạch dữ liệu nhật ký / `nutriPro`, cờ `underweight` / `lowBmi` trong `FKHealth.flags`, khối lời khuyên "Thiếu cân nặng (BMI dưới 16)", cảnh báo uống quá nhiều nước, `NutriPro.cleanCustom` / `NutriPro.KCAL_MAX`.

## 4. Chuyển giao (file không thuộc tôi)

1. **core · `app.js` `normalizeState` (~dòng 142-146)**: chỉ bảo đảm `foodLog[ngày][bữa]` là mảng, chưa lọc phần tử. Đề xuất `day[m] = day[m].filter(isObj)` — hiện `nutrition.js` đã lọc lúc nạp, nhưng khôi phục Drive / đồng bộ cloud thay `state` sau đó thì Trang chủ có thể gặp dòng hỏng trước khi mở màn Dinh dưỡng.
2. **ux / core · `ui-signature.js` hoặc `pt.js` (thẻ calo ở Trang chủ — chưa xác định chính xác dòng)**: đọc `it.kcal` không kiểm `it` → log `renderHomeScreen TypeError: Cannot read properties of null (reading 'kcal')`. Đề xuất `Number(it && it.kcal) || 0`.
3. **core · `app.js` `recomputeProfile`**: tuổi < 9 (hồ sơ cũ/đồng bộ) rơi về công thức người lớn + 5 %; cân nặng 0/NaN cho đạm 0 g. Thấy core đang thêm `fkSanitizeProfile` (R3-CORE-04) — cần bao cả tuổi 14–90.
4. **integrator · `themes-modules.css`**: suite 50 đang đỏ "themes-modules.css cũ" — **không** do tôi (không sửa CSS vòng này); chạy lại `python3 scripts/gen_themes_layer.py --modules` sau khi các agent xong CSS.
5. **pt-pro.js:201**: bảng xếp loại BMI riêng của PT không có kiểm tra số đo phi lý như `bodyAnalysis` — nên gọi chung `bodyAnalysis`.

## 5. Kết quả test

- `81-r3-nutrition`: **16/16**; `62-fix-nutrition`: 39/39; `01-calc`: 24/24; `40-kb`: 17/17; `68-food-ai`: 4/4.
- Chạy từng suite (giới hạn thời gian của công cụ): 27/34 suite xanh. **Đỏ ở vùng agent khác** (đang sửa song song, không liên quan file của tôi): `05-cloud` (1 — thông báo sai mật khẩu), `20-social` (2), `30-rbac` (1), `50-theme-packs` (1 — xem Chuyển giao 4), `64-fix-commerce` (6), `75-shorts` (1 — regex đọc `calcBMR` trong `app.js` đã đổi), `80-r3-core` (2).
  → `node tests/run.js` toàn bộ **chưa xanh** tại thời điểm viết; cần chạy lại sau khi các agent kia xong.

## 6. Chuỗi cần dịch

- "Chiều cao / cân nặng trong hồ sơ có vẻ chưa đúng (chiều cao tính bằng cm, vd 165; cân nặng bằng kg). Hãy kiểm tra lại trong Hồ sơ để app gợi ý thực đơn phù hợp." → "The height / weight in your profile looks wrong (height in cm, e.g. 165; weight in kg). Please check your Profile so the app can suggest a suitable meal plan."
- "BMI dưới 16 là mức thiếu cân nặng — nên đi khám bác sĩ / chuyên gia dinh dưỡng để tìm nguyên nhân trước khi tự tăng cân. …" → "A BMI under 16 is severe underweight — see a doctor / dietitian to find the cause before trying to gain weight on your own. …"
- "Nên giảm cân CÓ BÁC SĨ THEO DÕI (kiểm tra huyết áp, đường huyết, khớp trước khi tập). …" → "Lose weight UNDER MEDICAL SUPERVISION (check blood pressure, blood sugar and joints before training). …"
- "Thiếu cân nặng (BMI dưới 16)" → "Severely underweight (BMI under 16)"
- "BMI rất thấp (dưới 16)" → "Very low BMI (under 16)"
- "đang thiếu cân (BMI dưới 18,5)" → "underweight (BMI under 18.5)"
- "Đã đạt mức ghi tối đa 15 L/ngày" → "Maximum of 15 L/day reached"
- "Bạn đã uống vượt xa mục tiêu. Uống quá nhiều nước trong thời gian ngắn có thể gây hạ natri máu — không cần uống thêm nếu không khát." → "You are well past your target. Drinking too much water in a short time can cause low blood sodium — no need to drink more unless you are thirsty."
- "Mục tiêu năng lượng trong hồ sơ cao bất thường — thực đơn gợi ý dùng mức tối đa của app. Hãy kiểm tra lại chiều cao, cân nặng trong Hồ sơ." → "The energy target in your profile is unusually high — the meal plan uses the app's maximum. Please check your height and weight in Profile."
- "Món ăn" (tên thay cho dòng nhật ký mất tên) → "Food item"

## 7. Việc còn lại cho chủ dự án

- Chạy lại toàn bộ `node tests/run.js` sau khi mọi agent xong; sinh lại `themes-modules.css`.
- Kiểm thử trên trình duyệt thật: nút +250/+500 ml tới trần, lưu món tự tạo với giá trị bất khả thi, khôi phục một bản sao lưu cũ.
- Nội dung sức khoẻ (lời khuyên thai kỳ, bệnh thận, tiểu đường, BMI < 16) nên được **bác sĩ / chuyên gia dinh dưỡng có chứng chỉ hành nghề tại Việt Nam duyệt** trước khi phát hành — tôi chỉ đối chiếu với hướng dẫn quốc tế đã dẫn trong mã.

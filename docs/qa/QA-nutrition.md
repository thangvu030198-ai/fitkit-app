# QA — Mảng Dinh dưỡng · TapEasy (11/11/2026)

Người kiểm thử: QA + chuyên gia dinh dưỡng thể thao. **Chỉ báo cáo, không sửa file app.**
Phạm vi: `data.js`, `meals.js`, `meals-extra.js` (FOODS, RECIPES, chất xơ, đơn vị), `nutrition.js` + `nutrition-pro.js` (thẻ BMI, thực đơn ngày/tuần, chay/thuần chay, đổi món, đi chợ, gần đây/yêu thích, tự tạo món, đơn vị, nước), `health-safety.js` (thai kỳ, cho bú, < 18 tuổi, RLĂU, bệnh thận), ảnh món (`media/food`), `app.js` calcBMR/TDEE/macro/sàn calo.

## 0. Tóm tắt & điểm

| Tiêu chí | Điểm | Lý do chính |
|---|---|---|
| **Logic** | **6,5/10** | Dữ liệu thực phẩm phần lớn đúng (99/106 mục đối chiếu khớp ± 15 %), thuật toán bám mục tiêu tốt với người khoẻ. Nhưng thực đơn **vượt trần đạm của người bệnh thận +14…+37 %**, lời khuyên BMI vẫn bảo thai phụ / người có tiền sử RLĂU **"ăn thâm hụt 20 %"**, gợi ý món bò **tái** cho thai phụ, gõ "1,5" thành **15**, mục tiêu tự chỉnh 600 kcal vẫn lưu được. |
| **Ổn định** | **8,5/10** | 658 ngày thực đơn (24 hồ sơ × 4 chế độ) không ném lỗi; 9 ngữ cảnh trình duyệt, **0 lỗi JS**; không lọt món mặn vào chế độ chay/thuần chay. Lỗi nhỏ: nước bị cộng dồn sai do làm tròn, đổi số người làm mất dấu ✓ khi đi chợ. |
| **Mượt** | **6/10** | Mỗi lần chạm (ly nước, chọn ngày, bật chay) vẽ lại **toàn bộ màn** (2.054 nút DOM) → 240–340 ms mới tới khung hình kế (máy bàn; điện thoại tầm trung chậm hơn khoảng 3–4 lần). Mở "Thêm món" mất 540 ms. Cuộn ổn (p95 14–21 ms). |
| **Dễ dùng** | **6,5/10** | Hay: chọn đơn vị (chén, quả, tô), tìm không dấu, Gần đây 1 chạm, Đổi món giữ calo, sao chép danh sách đi chợ. Chưa ổn: viết tắt Đ/TB/B, số kiểu Anh "0.3 L", vùng chạm 26–38 px, chữ 10–11,5 px, xoá món không hoàn tác, gõ cả cụm "ức gà luộc" thì không ra kết quả, nửa số món chỉ hiện emoji, ~20 ảnh món sai. |

**Bug: 27 (Cao 4 · Trung bình 11 · Thấp 12).** Ưu tiên sửa: QN-01, QN-02, QN-03, QN-04, rồi QN-05 → QN-09.

---

## 1. Cách kiểm thử

| Bước | Công cụ | Kết quả |
|---|---|---|
| (1a) Thực đơn | `_test/qa-nutrition/qn-plan.js`: nạp app thật bằng `tests/lib/harness.js` (đúng thứ tự `index.html`, gồm `meals-extra`, `nutrition-pro`, `health-safety`). **24 hồ sơ × 7 ngày × 4 chế độ** (Thường, Chay, Thuần chay, Việt) = 94 bộ, 658 ngày. Ghi lại sai lệch kcal/đạm/tinh bột/béo/xơ, bữa và món lớn nhất, số món khác nhau, món lặp, món sai chế độ, món tái, bột đạm. | `qn-plan-ketqua.txt`, `qn-plan-ketqua.json` |
| (1b) An toàn | `qn-safety.js`: thai phụ 3 mục tiêu × 3 tam cá nguyệt × 3 ẩm thực × 7 ngày; danh sách Đổi món; mục tiêu nước theo nhóm. | `qn-safety-ketqua.txt` |
| (1c) Dữ liệu | `dump.js` → `qn-data.js`: đối chiếu **106/148** thực phẩm với USDA FoodData Central (SR Legacy/Foundation) và Bảng thành phần thực phẩm Việt Nam 2007; kiểm Atwater, chất xơ, đơn vị; 90 món: nguyên liệu, tag chay/thuần chay, số bước, mẹo (tip) so với số tính ra, bước "tái". | `qn-data-ketqua.txt` |
| (1d) Giao diện bằng Node | `qn-ui-node.js`: tìm kiếm (20 câu), lưu mục tiêu tự chỉnh, thẻ BMI. | `qn-ui-node-ketqua.txt` |
| (2) Trình duyệt | Bản ghép `scripts/build-single-html.py` → `_test/qa-nutrition/qn-app.html` (4,3 MB). Playwright Chromium 157, **ngữ cảnh riêng `qa-nutrition`** (mỗi luồng 1 context mới, 390 × 844, DPR 2, vi-VN, cảm ứng). 9 luồng: ghi ăn cả ngày, đơn vị, tìm không dấu, Gần đây, thực đơn → chi tiết món → ghi, Đổi món, Đi chợ (đổi số người, sao chép), nước (ly, +250 ml, mục tiêu), mục tiêu tự chỉnh, tự tạo món (có HTML trong tên), thai phụ T3, thuần chay 3.541 kcal, chất xơ, cuộn, kích thước vùng chạm/chữ. | 27 ảnh `_test/qa-nutrition/shots/qn-*.png` |

Hồ sơ đặc biệt có: thai kỳ T1/T2/T3, cho con bú, nam 16 tuổi, nữ 16 tuổi, nam/nữ 60 tuổi, bệnh thận mạn, lọc máu, tiền sử RLĂU, tiểu đường type 2, nam thuần chay tăng cơ 3.541 kcal, nữ 42 kg giảm mỡ, nam 130 kg (giảm mỡ và vận động 4.004 kcal), nam thiếu cân muốn giảm, nữ 55 tuổi 48 kg (sàn 1.200 kcal), nữ béo phì 95 kg.

## 2. Kết quả thuật toán thực đơn (658 ngày)

| Chế độ | Calo ± 5 % | Đạm ± 15 % | Tinh bột ± 15 % | Béo ± 25 % | Xơ ≥ 80 % | Bữa lớn nhất | Món lớn nhất | Số món khác nhau / 28 suất (TB, thấp nhất) |
|---|---|---|---|---|---|---|---|---|
| Thường | 89 % | 88 % | 99 % | 100 % | 99 % | 895 g | 565 g (cơm) | 24,7 · 19 |
| Chay | 92 % | 92 % | 99 % | 98 % | 100 % | 890 g | 495 g | 18,7 · **12** |
| Thuần chay | 85 % | 86 % | 98 % | 95 % | 100 % | 895 g | 515 g | 19,2 · **12** |
| Việt | 86 % | 87 % | 96 % | 100 % | 99 % | 895 g | 560 g | 20,1 · **10** |
| **Tổng** | **88 %** | **88 %** | **98 %** | **98 %** | **100 %** | | | 20,7 |

- Người khoẻ, nhu cầu 1.200–2.900 kcal: calo nằm trong −4,6…+4,6 %, đạm trong −6…+13 %. **Rất tốt.**
- Ngày lệch đều rơi vào 3 nhóm: (a) **đạm mục tiêu thấp** (bệnh thận, cho con bú, 16 tuổi) → thừa đạm nhưng thiếu calo (QN-01); (b) **nhu cầu > 3.500 kcal** (QN-10); (c) chay/thuần chay cho người cần ít calo (P16 nữ 60 tuổi, 1.200 kcal, đạm 120 g: thuần chay thiếu đạm đến −16 % và béo vượt +41 %; nguyên nhân gốc là mục tiêu đạm quá cao, xem QN-08).
- **Không có** món thịt/cá trong chế độ chay, **không có** trứng/sữa/mật ong trong thuần chay (0/336 ngày). Các bước nấu của món thuần chay đều dùng nước tương / hạt nêm chay.
- Tốc độ: 11,7 ms/ngày (Node), 5–14 ms khi chưa có cache trong Chromium, 0,4 ms khi đã có cache.

Bảng chi tiết từng hồ sơ: `_test/qa-nutrition/qn-plan-ketqua.txt`.

---

## 3. Bảng bug

Mức độ: **Cao** = sai về an toàn sức khoẻ hoặc dữ liệu ghi sai lớn · **TB** = sai logic hoặc UX đáng kể · **Thấp** = nhỏ.

| ID | Mức | Mô tả | Tái hiện | File:dòng | Đề xuất sửa (giá trị đúng) |
|---|---|---|---|---|---|
| **QN-01** | **Cao** | Thực đơn **vượt trần đạm** khi mục tiêu đạm thấp: **bệnh thận mạn** (đạm 56 g = 0,8 g/kg) nhận 64–77 g/ngày (**+14…+37 %**, tức 0,91–1,10 g/kg) và vẫn thiếu calo −3…−9 %. **Cho con bú** (75 g): đạm +12…+26 %, calo **−2…−12 %**. **Nam 16 tuổi** (93 g): đạm +13…+25 %, calo −4…−13 %. | `node qn-plan.js` → các hồ sơ P17, P12, P13. Ví dụ ngày 1 của P17: Yến mạch chuối bơ đậu phộng + khoai lang, bún chay đậu hũ + 2 chuối, cà ri đậu gà… | `nutrition-pro.js:167-174` (`npErr`: đạm thừa chỉ bị phạt sau +13,5 %), `:82-125` (`NP_FILLERS` phần lớn là món phụ giàu đạm), `:146-158` (`npPool` ưu tiên món `giam-mo`/`tang-co` nhiều đạm) | Khi `p.hsAdjust.ppk` có giá trị và người dùng có bệnh thận: coi đạm là **trần cứng** (`t.p ≤ 1,05·T.P`). Loại các món phụ đạm (whey, ức gà, tôm, cá ngừ, trứng, sữa chua Hy Lạp, phô mai tươi, tempeh, mì căn, đạm thực vật, edamame). Thêm món phụ **giàu năng lượng, ít đạm**: ⅔ chén cơm cho mọi bữa chính, khoai lang 150 g, chuối, bánh mì 1 lát, dầu 5 g, trái cây. Sắp xếp món theo tỉ lệ kcal/đạm khi `T.P·4/T.K < 0,15`. Mục tiêu sau sửa: P17/P12/P13 có đạm ± 10 % và calo ± 5 %. |
| **QN-02** | **Cao** | Thẻ BMI vẫn ghi **"Nên ăn THÂM HỤT khoảng 20 % calo"** cho **thai phụ** (BMI 26,5 tính trên cân nặng lúc mang thai), **người cho con bú** và người có **tiền sử RLĂU** ("thâm hụt 15–20 %"), trong khi khối sức khoẻ ngay phía trên nói calo được **cộng thêm 452 kcal**. Thai phụ chọn mục tiêu "Giảm mỡ" vẫn thấy nhãn "Mục tiêu: **Giảm mỡ** 2.089 kcal" và câu "Thâm hụt ~18 % TDEE". | Ảnh `qn-20-thai-ky-bmi.png`, `qn-19-thai-ky-dau.png`. Sàng lọc → Đang mang thai T3, nặng 68 kg, cao 160 cm → mở Dinh dưỡng. | `meals.js:347-366` (`bodyAnalysis` không biết tình trạng sức khoẻ), `nutrition-pro.js:556-561` (thẻ BMI và nhãn mục tiêu), `health-safety.js:877-905` (`decorateNutrition` chỉ gỡ nút đổi mục tiêu) | Trong `decorateNutrition` (hoặc truyền cờ vào `bodyAnalysis`): **thai phụ** → thay lời khuyên bằng "BMI lúc mang thai không dùng để đánh giá. Tăng cân theo IOM 2009, dựa trên BMI **trước** mang thai: < 18,5 → 12,5–18 kg; 18,5–24,9 → 11,5–16 kg; 25–29,9 → 7–11,5 kg; ≥ 30 → 5–9 kg"; nhãn mục tiêu "Thai kỳ — không thâm hụt". **Cho con bú** → "Không thâm hụt > 500 kcal; giảm ≤ 0,5 kg/tuần sau 6–8 tuần khi đã ổn định sữa". **RLĂU** → ẩn xếp loại BMI và mọi lời khuyên thâm hụt. |
| **QN-03** | **Cao** | **Món tái** được gợi ý cho thai phụ: "Phở bò tái nạc" (bước: "chan nước dùng … để thịt tái"), "Bò áp chảo … (tái vừa)", "Bò lúc lắc … (tái vừa)". Xuất hiện trong thực đơn (3/189 ngày thai kỳ) và **luôn có** trong danh sách Đổi món; mở chi tiết món không có cảnh báo nào. Khối sức khoẻ lại dặn "Tránh đồ sống/tái". Ảnh "Cơm cá ngừ" là **sashimi cá sống**. | `qn-safety.js`; ảnh `qn-21-thai-ky-doi-mon-pho-tai.png`, `qn-22-thai-ky-pho-tai-chi-tiet.png` | `meals.js:97-104`, `meals.js:301`, `meals-extra.js:499`; `nutrition-pro.js:146` (`npPool`), `:633-640` (`openSwapSheet`) | Gắn `rare:true` cho 3 món này. `npPool` loại món `rare` khi `FKHealth.current().preg`. Hoặc đổi bước nấu cho thai phụ: "nấu chín kỹ: bò miếng ≥ 63 °C và nghỉ 3 phút, bò xay ≥ 71 °C, gà ≥ 74 °C (USDA FSIS)". `openRecipe` hiện thẻ cảnh báo màu cam cho thai phụ. Thay ảnh `ca-ngu-com`. |
| **QN-04** | **Cao** | Gõ số thập phân kiểu Việt **"1,5" thành "15"**: ô số lượng là `type=number`, Chromium bỏ dấu phẩy. Kết quả: 15 miếng ức gà = **2.250 g / 3.713 kcal**, và vẫn thêm được vì giới hạn là 3.000 g. Phần code `replace(",", ".")` không bao giờ chạy tới vì `input.value` không chứa dấu phẩy. | Ảnh `qn-08-go-1phay5-thanh-15.png`: Thêm món → "uc ga" → đơn vị "1 miếng" → gõ `1,5`. | `nutrition-pro.js:943` (input), `:962`; các ô cùng kiểu ở Tự tạo món `:1005-1013`, `app.js:2259-2263` | Đổi sang `type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*"`, rồi đọc `Number(v.replace(",", "."))`. Hỏi xác nhận khi một lần thêm > 1.000 g hoặc > 1.500 kcal. |
| **QN-05** | TB | **Mục tiêu tự chỉnh không được kiểm tra**: lưu được 600 kcal kèm đạm/tinh bột/béo 250/300/90 g (cộng lại = 3.010 kcal). Đồng hồ hiện 600 kcal nhưng thực đơn **âm thầm dùng 1.000 kcal** ("Calo 1.192 / 1.000"). Mục tiêu nước **−2 L** cũng lưu được ("0.3 / -2 L"). | Ảnh `qn-16-muc-tieu-600kcal.png`, `qn-15-nuoc-am.png` | `app.js:2266-2275`, `app.js:2299`; `nutrition-pro.js:44` (`K = max(1000, …)`) | Calo tối thiểu = max(1.200 nữ / 1.500 nam, BMR); nhập thấp hơn thì hiện cảnh báo đỏ và cần xác nhận. Tổng kcal tính từ macro phải nằm trong ± 10 % calo mục tiêu (gợi ý tự tính tinh bột). Nước giới hạn 0,5–6 L. Thực đơn dùng đúng con số người dùng thấy. |
| **QN-06** | TB | **Nước bị cộng sai do làm tròn**: mỗi lần +250 ml lưu thành 0,3 L. 250 + 250 + 500 ml = **1,1 L** (thực tế 1,0 L); 4 lần +250 ml = **1,2 L (+20 %)**. | Log luồng #5: `0.3 → 1.1 L` | `nutrition.js:241` (`fmt1` sau mỗi lần cộng), `:236` | Lưu theo **ml (số nguyên)** hoặc làm tròn tới 3 chữ số: `Math.round((x + 0.25) * 1000) / 1000`. Chỉ làm tròn khi hiển thị. |
| **QN-07** | TB | **Mục tiêu nước không điều chỉnh theo nhóm**: thai phụ 2,4 L (không cộng 0,3 L), cho con bú 2,0 L (không cộng 0,7 L; IOM khuyến nghị nước uống ≈ 3,1 L/ngày), lọc máu 1,9 L kèm 8 ly "cần hoàn thành" (người lọc máu thường bị **hạn chế dịch**), nam 130 kg 4,6 L. | `qn-safety-ketqua.txt` | `nutrition.js:121`, `app.js:2290`; `health-safety.js:896-897` (mới chỉ là chữ) | `mục tiêu = clamp(35 ml × cân nặng điều chỉnh, 1,5–3,7 L)`, + 0,3 L (thai T2–T3), + 0,7 L (cho bú). Lọc máu: ẩn mục tiêu, ghi "Theo chỉ định của bác sĩ thận". |
| **QN-08** | TB | **Đạm cố định 2 g/kg cho mọi người**: nữ 60 tuổi ít vận động 1.200 kcal → **120 g = 40 % năng lượng** (vượt ngưỡng AMDR 10–35 %). Nữ văn phòng duy trì → 100 g. Nữ 58 kg giảm mỡ → 116 g / 1.442 kcal (32 %). | `qn-plan.js`: P16, P03; ảnh `qn-01` | `app.js:119-128` (`calcMacros`) | g/kg theo mục tiêu và mức vận động: giảm mỡ có tập tạ 1,8–2,0; tăng cơ 1,6–2,0; duy trì hoặc ít vận động 1,2–1,4; ≥ 60 tuổi ≥ 1,2 (PROT-AGE). Trần `P ≤ 0,35·K/4`. |
| **QN-09** | TB | **Lặp món trong tuần** khi lọc chay / thuần chay / Việt / tăng cơ: **20/94 bộ** có 1 món xuất hiện ≥ 5/7 ngày. Ví dụ "Cà ri đậu gà" bữa tối 7/7 ngày (P13, P20 chay), "Mix hạt & táo" 7/7, "Yến mạch đạm thực vật" 7/7 (P07). P13: 13 lần trùng món với ngày hôm trước. | `qn-plan-ketqua.txt` cột "lặpMax / liền"; ảnh `qn-23-thuan-chay-3500.png` (bữa tối Cà ri 5/7 ngày) | `nutrition-pro.js:160-165` (`npCands`: khi kho món ≤ cửa sổ thì ngày nào cũng có đủ ứng viên giống nhau), `:302-309` (phạt `j·0,006` quá nhẹ) | Có "trí nhớ tuần": dựng các ngày trước (đã cache), phạt +0,03 cho mỗi lần món đã dùng ở cùng bữa trong tuần; hoặc khi `pool.length ≤ n` thì xoay vòng cố định `pool[(di + k) % L]`. Mục tiêu: ≤ 3 lần/tuần/bữa khi kho có ≥ 3 món. |
| **QN-10** | TB | **Thiếu calo** khi nhu cầu cao: nam 130 kg vận động nhiều (4.004 kcal) −4…−14 %; thuần chay 3.541 kcal −2,7…−5,6 %; cho con bú −2…−12 % (do QN-01). | `qn-plan.js` P07, P08, P12 | `nutrition-pro.js:62-66` (`npLimits`: 4 bữa, ≤ 900 g/bữa) | Khi K > 3.000 hoặc vẫn thiếu > 5 % thì thêm **bữa phụ thứ 2**. Cho phép món phụ đặc năng lượng: bơ đậu phộng 2 muỗng, dầu, sữa nguyên kem, chuối + yến mạch. |
| **QN-11** | TB | **Giá trị dinh dưỡng lệch > 15 %** (7/106 mục): **Xôi trắng 97 kcal → ≈ 182** (đạm 2 → 4,5; tinh bột 21,1 → 39,4) — tự mâu thuẫn với hệ số nở 1,9 ở SHOP_RAW. 97 kcal là nếp *luộc nhiều nước* của USDA. **Sữa tươi không đường 42 → 61 kcal, béo 1 → 3,3** (42 kcal là sữa 1 %; sữa tươi phổ biến ở VN là nguyên kem). Sữa có đường 61 → ≈ 77. **Ba chỉ 518 → 260 kcal** (Bảng TPTP VN: đạm 16,5, béo 21,5; 518 là mỡ bụng kiểu Mỹ). **Khoai môn "luộc" 112 → 142** (112 là khoai sống). **Cá thu nướng 262** là cá thu Đại Tây Dương; cá thu VN (USDA Spanish mackerel nấu chín) là 158 kcal, béo 6,3. **Mồng tơi**: tinh bột 1,4 < xơ 2,5 → nên là 3,4. | `qn-data-ketqua.txt` | `meals-extra.js:47` (xôi), `data.js:172-173` (sữa), `data.js:166` (ba chỉ), `data.js:199` (khoai môn), `meals.js:11` (cá thu), `meals-extra.js:54` (mồng tơi) | Thay bằng giá trị trong ngoặc. Nếu giữ 518 cho ba chỉ thì đổi tên thành "Mỡ ba chỉ (nhiều mỡ)" và thêm mục "Ba chỉ nạc xen mỡ" 260 kcal. Cá thu: đổi tên "Cá thu Nauy" hoặc dùng 158 kcal. Xôi sai thì kéo theo "Xôi đậu xanh & 2 trứng" bị tính thiếu ≈ 100 kcal. |
| **QN-12** | Thấp | Mẹo (tip) **ghi số không khớp** với số app tính: "200 g mực chỉ **~180 kcal**", trong khi chính chi tiết món ghi 160 g mực = 184 kcal (200 g = 230 kcal). "Shake tăng cân **~750 kcal**" nhưng tính ra 626 kcal. | Ảnh `qn-10-chi-tiet-mon-toi.png` | `meals.js:161`, `meals.js:329` | "200 g mực ≈ 230 kcal, 42 g đạm"; "~630 kcal". |
| **QN-13** | TB | **Ảnh món sai** (tiêu đề ảnh Pixabay trong `media/food/index.json`, đã xem tận mắt): **4 món chay/thuần chay có ảnh thịt/trứng** — Trứng hấp đậu hũ → sườn heo hấp + nghêu; Bowl đậu đen → hầm đậu **thịt xông khói**; Quinoa edamame → **ức gà nướng**; Đậu hũ sốt nấm → trứng ốp. Các ảnh sai khác: Đậu đen → hạt cà phê; Whey → cà phê; Sữa chua Hy Lạp → cà tím nướng; Phô mai → burger thịt xông khói; Đường → ảnh trắng; Rau thơm → củ tỏi; Bánh cuốn → sushi; Cơm cá ngừ → sashimi; **Gỏi cuốn → chả giò chiên**; Xôi mặn → xôi xoài (món ngọt); Mì Quảng → bột gia vị; Tôm & bắp, Đùi gà mật ong → hũ mật ong; Bia → lon trong ảnh "rác thải"; Trứng gà luộc → trứng Phục sinh tô màu; Mực → mực sống lộ mắt. **50 thực phẩm + 45 món mới (16 món thuần chay giàu đạm) chưa có ảnh** → thực đơn thuần chay hiện 4/4 emoji. | Ảnh `qn-26-anh-mon-sai.png`, `qn-23-thuan-chay-3500.png` | `scripts/food_sources.json`, `media/food/index.json`; `scripts/fetch_food_images.py` (`pick`) | Thêm `"pick": {id: pixabay_id}` chọn tay cho khoảng 20 mục trên (ưu tiên ảnh không có thịt cho món chay). Chạy workflow `media-food.yml` cho 95 từ khoá mới. Kiểm ảnh bằng `contact.jpg` trước khi phát hành. |
| **QN-14** | TB | **Xoá món 1 chạm, không xác nhận, không hoàn tác**. Nút × chỉ **26 × 26 px**, nằm sát số kcal → rất dễ chạm nhầm. | Luồng #9: xoá xong thì số dòng 2 → 1, không có toast | `nutrition.js:187`, `:231`; `style.css:916` | Vùng chạm 44 px. Sau khi xoá hiện toast "Đã xoá … · **Hoàn tác**" trong 5 giây. |
| **QN-15** | TB | **Tìm kiếm chỉ khớp nguyên chuỗi liền**: "ức gà luộc", "trung ga luoc", "ga uc" → **0 kết quả** (tên thật là "Ức gà (luộc, không da)"). Không có từ đồng nghĩa Bắc–Nam: "đậu phụ", "thịt lợn", "lạc" → 0 kết quả; "ngo" ra cả "Nước ngọt". | Ảnh `qn-05-tim-uc-ga-luoc-rong.png`; `qn-ui-node-ketqua.txt` | `nutrition-pro.js:842-843` | Tách từ: khớp khi mọi từ khoá đều có trong `fold(name + aliases)`. Thêm `aliases`: đậu phụ ↔ đậu hũ, lợn ↔ heo, lạc ↔ đậu phộng, ngô ↔ bắp, vừng ↔ mè, dứa ↔ thơm, dưa chuột ↔ dưa leo, mướp đắng ↔ khổ qua, bát ↔ chén. Ưu tiên kết quả khớp đầu từ. |
| **QN-16** | TB | **Món phụ là bột đạm** (whey, đạm thực vật) xuất hiện trong thực đơn của **người bệnh thận** (thuần chay), **< 18 tuổi** (P13: whey 3 ngày/tuần) và **thai phụ**, trái với lời dặn "Không tự dùng whey…" của chính health-safety. | `qn-plan-ketqua.txt` cột `suppl` | `nutrition-pro.js:88` + các món `shake-*`, `smoothie-*`, `yen-mach-protein-chay`, `sinh-to-bo-yen-mach` | `npPool`/`fillersFor`: khi có bệnh thận, < 18 tuổi hoặc đang mang thai thì loại món phụ và món có `whey` / `protein-thuc-vat`. |
| **QN-17** | Thấp | **Vùng chạm < 44 px, chữ < 12 px** (vi phạm AGENT-BRIEF): nút + của bữa 34 px (×4), "Chi tiết" 34, Xoá 26, sửa mục tiêu nước 32, 8 ly nước 36 × 48, "+250ml/+500ml" cao 35, menu/⚙ 38. Thẻ `small` 10–11,5 px (≈ 45 phần tử), nhãn "Việt/Âu" trên 90 thẻ món 11 px. | Luồng #9 | `style.css:906` (`.nu-mini`), `:916` (`.nu-del`), CSS `.nu-cups`, `.nu-water-btns`, `.nu-recipe-top .cz` | `min-width/min-height: 44px` (có thể giữ hình nhỏ, mở rộng vùng chạm bằng padding); chữ ≥ 12 px. |
| **QN-18** | Thấp | Tab **"Tự tạo" bị cắt** ở mép phải màn 390 px (scrollWidth 399 > 350), không có dấu hiệu cuộn ngang. | Ảnh `qn-02-them-mon-tat-ca.png` | `nutrition-pro.css:53-55` | `flex: 1 1 0` + rút ngắn nhãn, hoặc tab thứ 4 chỉ hiện biểu tượng ✎. |
| **QN-19** | Thấp | **Đi chợ**: đổi số người thì **mất các dấu ✓ đã mua**; tên hàng là đồ đã chín ("Bông cải xanh (luộc)", "Rau muống (xào)"); hiện "1000 g" thay vì "1 kg". Hệ số sống/chín lệch nên mua dư: gạo lứt 1/2,4 (USDA ≈ 1/3,3) → dư ~35 %; đậu xanh 1/2,4 (≈ 1/3,3); đậu lăng 1/2,5 (≈ 1/3,0); mì Ý 1/2,3 (≈ 1/2,8). | Ảnh `qn-13-di-cho.png`; log luồng #2 `rowDoneAfterPeople:false` | `nutrition-pro.js:704-712` (SHOP_RAW), `:724-731` (shopQty), `:767` (`done` cục bộ), `:745` (tên) | Lưu `done` vào `state.nutriPro.shopDone`. Thêm bảng `SHOP_NAME` cho tên đồ sống. Kiểm `g ≥ 950` → kg. Sửa hệ số: gạo lứt 1/3, đậu xanh 1/3,2, đậu lăng 1/3, mì Ý 1/2,8. |
| **QN-20** | Thấp | **Định dạng số kiểu Anh**: "Nước uống 0.3 / 2 L", BMI "22.6", "Mỗi 100 g: … B2.5 · Xơ 0.5", trong khi chỗ khác ghi "12,5g". | Ảnh `qn-04`, `qn-14` | `nutrition.js:194` (nước), `nutrition-pro.js:946`, thẻ BMI `nutrition-pro.js:556` | Dùng `toLocaleString("vi-VN")` / `vn()` thống nhất. |
| **QN-21** | Thấp | **Vẽ lại toàn màn** sau mỗi chạm (ly nước, chọn ngày, chay, thuần chay): 240–340 ms tới khung hình kế. Đồng hồ calo **đếm lại từ 0** mỗi lần chạm (ngay sau khi bấm +250 ml thì số calo hiện "0"). | Bảng §5 | `nutrition.js:221` (`nuCountUp`), `:233-243` | Chỉ cập nhật khối thay đổi (nước, thẻ thực đơn). Chỉ chạy hiệu ứng đếm khi số calo thay đổi. |
| **QN-22** | Thấp | Mở sheet "Thêm món" mất **540 ms** vì vẽ cả 148 dòng có ảnh. | Bảng §5 | `nutrition-pro.js:865` | Vẽ trước 30 dòng, phần còn lại dùng `content-visibility:auto` hoặc IntersectionObserver. |
| **QN-23** | Thấp | **Mục tiêu chất xơ không có trần**: 4.004 kcal → 56 g/ngày (AI của IOM cho nam là 38 g, nữ 25 g). Ăn nhiều xơ đột ngột dễ đầy bụng. | Ảnh `qn-24-chat-xo.png` (50 g/ngày) | `nutrition-pro.js:41`, `:490` | `min(14·K/1000, 38 nam / 25 nữ + 10)` hoặc trần 45 g. |
| **QN-24** | Thấp | **< 18 tuổi** dùng công thức người lớn (Mifflin): nữ 16 tuổi 60 kg/158 cm "nhẹ" → 1.852 kcal, trong khi EER IOM ≈ 2.075 (**−11 %**). Ngưỡng BMI người lớn (châu Á) cũng áp cho trẻ 16 tuổi. | Hồ sơ P13, P14 | `app.js:106-118`, `meals.js:347-366` | Dùng EER IOM 2005 cho 9–18 tuổi; BMI theo tuổi (WHO 2007, z-score). |
| **QN-25** | Thấp | Cho con bú luôn +330 kcal. IOM: +330 kcal ở 0–6 tháng, **+400 kcal ở 7–12 tháng**. | — | `health-safety.js:55`, `:108` | Tính theo tuần sau sinh (`postpartumWeeks`). |
| **QN-26** | Thấp | Món đã đổi được lưu **theo thứ** (`swaps[0..6]`) nên áp mãi cho mọi tuần sau. Người dùng tưởng chỉ đổi cho tuần này. | — | `nutrition-pro.js:673` | Lưu kèm tuần ISO, tự hết hạn sau Chủ nhật (hoặc có công tắc "Áp dụng mọi tuần"). |
| **QN-27** | Thấp | Sát ngưỡng thiếu cân vẫn đặt thâm hụt: nữ 42 kg/150 cm (BMI 18,6) → 1.209 kcal (−18 %), không cảnh báo. Giảm thêm 0,2 kg là thành thiếu cân. | P05 | `app.js:137` | Cảnh báo, hoặc giới hạn thâm hụt 10 % khi BMI < 19,5. Chặn khi dự báo BMI xuống < 18,5 trong 4 tuần. |

**Ngoài phạm vi (báo để biết):** `scripts/fetch_food_images.py:17` có khoá API Pixabay viết thẳng trong mã (nên chuyển sang secret của Actions). Thanh tiêu đề "Dinh dưỡng" có nền gradient trong suốt nên chữ tiêu đề đè lên nội dung khi cuộn (ảnh `qn-20`).

---

## 4. Đối chiếu dữ liệu (FOODS/RECIPES)

- **106/148** thực phẩm có mã chuẩn để đối chiếu → **99 khớp ± 15 %**, 7 lệch (QN-11). Không đối chiếu 42 mục là món ăn sẵn, đồ uống pha, mì căn, tàu hũ ky, rau VN chưa có mã: các con số này nằm trong khoảng hợp lý (phở bò 450 kcal/tô, bánh mì thịt 450 kcal/ổ, cơm tấm 680 kcal/đĩa, trà sữa 350 kcal/ly 500 ml).
- Atwater: chỉ có **bia** lệch (43 kcal so với 16), vì app không có cột cồn (7 kcal/g). Nên thêm `alcohol` để tổng macro khớp với kcal.
- Chất xơ: 148/148 thực phẩm có số liệu, giá trị đúng theo USDA. Riêng mồng tơi bị xơ > tinh bột (QN-11).
- Đơn vị: 148/148 thực phẩm có đơn vị, khối lượng hợp lý (1 quả trứng 50 g, 1 hộp sữa 180 ml = 185 g, 1 chén cơm 150 g, 1 tô phở 500 g, 1 quả chuối bỏ vỏ 100 g, 1 muỗng canh dầu 13 g).
- **90 món**: mọi nguyên liệu đều có trong FOODS. Tag chay/thuần chay đúng 100 %. Mẹo (tip) khớp số liệu, trừ 2 món (QN-12). 4 món chỉ có 1 bước (đồ ăn vặt kiểu "uống/ăn kèm", chấp nhận được). Món "Đậu hũ sốt nấm" có khẩu phần chuẩn 725 g (planner đã tự thu nhỏ còn ≤ 600 g).
- An toàn thực phẩm: chỉ món ức gà có ghi nhiệt độ lõi (≥ 74 °C). 3 món bò tái (QN-03). Món "Nghêu hấp" có ghi "bỏ con không mở miệng" (tốt). Món "Mì căn" có cảnh báo gluten. Thuần chay có nhắc bổ sung B12 (tốt).

## 5. Độ mượt (Chromium 157 trên máy bàn, 390 px, không giới hạn CPU)

| Thao tác | Thời gian (tới khung hình kế) |
|---|---|
| Mở bản 1 file 4,3 MB | load 2,7 s · DCL 2,6 s · long task 415–502 ms |
| Chuyển sang tab Dinh dưỡng | **686 ms** (long task 502 ms) |
| `renderNutritionScreen` (chỉ phần JS) | 17–21 ms · DOM 2.054 nút, 90 thẻ món, 47 ảnh |
| Chọn ngày T2…CN / bật chay | **275 ms** |
| +250 ml / chạm ly nước | **297–336 ms** / 238 ms |
| Mở "Thêm món" · gõ tìm · mở đơn vị · thêm | **540 ms** · 90 ms · 158 ms · 254 ms |
| Mở chi tiết món · Ghi thực đơn vào hôm nay | 464 ms · 371 ms |
| Đổi món: mở sheet · chọn món | 101 ms · 199 ms |
| Đi chợ: mở · đổi số người | 141 ms · 79 ms |
| Cuộn bằng JS (100 khung) | trung bình 8,8 ms · p95 14 ms · 0 khung > 50 ms |
| Cuộn bằng con lăn (80 bước) | p95 20,7 ms · 5 khung > 50 ms (tối đa 264 ms, do giải mã ảnh) |
| Thuật toán 1 ngày | 5–14 ms khi chưa cache · 0,4 ms khi đã cache |

Trên điện thoại tầm trung, các thao tác 240–540 ms có thể thành 0,8–2 s → cần làm QN-21 và QN-22.

## 6. Vấn đề UX & độ thân thiện với người không rành dinh dưỡng

**Dễ hiểu, làm tốt:**
- Thêm món theo **đơn vị đời thường** (1 tô phở, 1 chén cơm, 1 quả trứng) và tự quy ra gam/kcal.
- **Gần đây** để thêm lại 1 chạm. **Đổi món** có nhãn "Hợp nhất" và giữ nguyên calo của ngày.
- Danh sách đi chợ chia nhóm, quy ra đồ sống, sao chép được.
- "Món phụ +1 quả chuối" giải thích được vì sao khẩu phần không bị phóng to. Lời nhắc B12 cho người thuần chay.

**Khó hiểu hoặc dễ gây hiểu sai:**
1. Viết tắt **"Đ5 · TB12 · B2.5"**, "Đ… · TB… · B…" ở danh sách và nhật ký → nên ghi "đạm / tinh bột / béo".
2. Thuật ngữ: "Thâm hụt ~18 % **TDEE**", "Mifflin-St Jeor", "14 g / 1.000 kcal", "khẩu phần ×0,8" → nên thêm dòng giải thích ngắn hoặc nút (i).
3. Không giải thích **vì sao đạm 116 g** (nhiều gấp ~2 lần mức phổ thông). Nên ghi "≈ 2 g/kg vì bạn đang giảm mỡ và tập tạ".
4. 5 ô tổng (Calo/Đạm/Tinh bột/Béo/Xơ) đổi màu ok/lệch nhưng **không có chú thích** màu nghĩa là gì.
5. Thẻ BMI nói "Thừa cân — nên thâm hụt" với thai phụ, người có tiền sử RLĂU, trẻ vị thành niên (QN-02, QN-24) → **dễ gây hiểu sai nhất**.
6. Người có tiền sử RLĂU vẫn thấy đồng hồ calo đỏ "Đã vượt X kcal". Nên có tuỳ chọn **"Ẩn số calo"** (chỉ ghi món, không hiện con số).
7. Gõ "1,5" theo thói quen người Việt → thành 15 (QN-04). Nhập sai không có cảnh báo.
8. Nửa thực đơn chỉ là emoji, và ảnh sai (gỏi cuốn hiện thành chả giò chiên) làm người dùng mất tin vào con số calo.
9. Tìm bằng câu tự nhiên ("ức gà luộc", "đậu phụ", "thịt lợn") không ra kết quả (QN-15).
10. Xoá nhầm món không lấy lại được (QN-14). Tab "Tự tạo" bị khuất (QN-18).

## 7. File kiểm thử (`outputs/_test/qa-nutrition/`)

`qn-plan.js` (+ `qn-plan-ketqua.txt/.json`), `qn-safety.js` (+ `.txt`), `qn-data.js` (+ `.txt`), `dump.js` (+ `dump-foods.json`, `dump-recipes.json`), `qn-ui-node.js` (+ `.txt`), `qn-app.html` (bản ghép bằng `build-single-html.py`), `shots/qn-00…qn-26*.png` (27 ảnh, 390 px).
Chạy lại: `cd outputs/_test/qa-nutrition && node dump.js && node qn-data.js && node qn-plan.js && node qn-safety.js && node qn-ui-node.js`.
Lưu ý: DOM giả của harness không cập nhật `innerHTML` sau `insertAdjacentHTML`/`remove()`, nên các kiểm tra hiển thị của health-safety phải xác nhận lại bằng Playwright (đã làm).

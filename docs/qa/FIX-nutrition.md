# FIX — Mảng Dinh dưỡng · TapEasy (11/11/2026)

Fixer **nutrition** (kỹ sư + chuyên gia dinh dưỡng). Báo cáo gốc: `docs/qa/QA-nutrition.md` (27 bug: Cao 4 · TB 11 · Thấp 12).
File đã sửa (đúng quyền sở hữu): `data.js`, `meals.js`, `meals-extra.js`, `nutrition.js`, `nutrition-pro.js`, `nutrition-pro.css`,
`health-safety.js`, `scripts/food_sources.json`, `scripts/fetch_food_images.py`. Test hồi quy: `tests/suites/62-fix-nutrition.test.js` (30 test).

> **Việc chủ app phải làm (bảo mật):** khoá Pixabay cũ đã nằm trong mã trên repo công khai → **thu hồi / tạo khoá Pixabay mới**,
> đặt vào GitHub → Settings → Secrets and variables → Actions → secret **`PIXABAY_KEY`**. `scripts/fetch_food_images.py` giờ chỉ đọc
> biến môi trường `PIXABAY_KEY` và dừng nếu thiếu. Workflow `media-food.yml` cần truyền secret (xem mục Chuyển giao #1).
> Cùng khoá đó còn nằm ở `media-config.js:17` (tìm video phía người dùng, không thuộc file của tôi) — đổi khoá thì cập nhật luôn file này.

## 1. Kết quả tổng

| Đo | Trước (QA) | Sau |
|---|---|---|
| `qn-plan.js` 94 bộ / 658 ngày — calo ± 5 % | 88 % | **96 %** |
| — đạm ± 15 % · tinh bột ± 15 % · béo ± 25 % · xơ ≥ 80 % | 88 % · 98 % · 98 % · 100 % | **100 % · 100 % · 99 % · 100 %** |
| — bộ có 1 món ≥ 5/7 ngày (cùng bữa) · lần "trùng hôm qua" | 20/94 · 281 | **0/94 · 50** |
| — số món khác nhau / 28 suất (TB) | 20,7 | **22,9** |
| Bệnh thận mạn (P17, đạm 56 g) — Δđạm · Δcalo | +12,9…+37,3 % · −9,1…−0,7 % | **0,0…+3,3 % · −3,5…+2,0 %** |
| Cho con bú (P12) — Δđạm · Δcalo | +11,9…+25,8 % · −12,4…−1,5 % | **+0,4…+8,8 % · −3,9…0,0 %** |
| Nam 130 kg 4.004 kcal (P07) · thuần chay 3.541 kcal (P08) — Δcalo | −14,0…−2,2 % · −5,6…−1,8 % | **−5,0…−1,1 % · −3,1…−0,1 %** |
| Bột đạm trong thực đơn thai phụ / < 18 tuổi / bệnh thận | 19 | **0** |
| `qn-safety.js` — món tái trong 189 ngày thai kỳ · trong danh sách Đổi món | 3 · 3 món | **0 · 0** |
| — mục tiêu nước: thai T3 68 kg · cho bú 58 kg · lọc máu · nam 130 kg | 2,4 · 2,0 · 1,9 · 4,6 L | **2,6 · 2,7 · không đặt (theo bác sĩ) · 3,1 L** |
| `qn-data.js` — thực phẩm lệch > 15 % so với USDA / Bảng TPTP VN | 7/106 | **0/106** |
| — xơ > tinh bột · tip ghi sai số (QN-12) | 1 · 2 | **0 · 0** |
| `node tests/run.js` (chạy theo từng suite vì giới hạn 180 s của công cụ) | 329 test, 6 đỏ (security/pt/commerce) | **492/492 xanh** (24 suite, gồm 60–66) |

File đo: `outputs/_test/fix-nutrition/` — `before-qn-plan.txt`, `after-qn-plan.txt/.json`, `before-qn-safety.txt`, `after-qn-safety.txt`,
`after-qn-data.txt` (trước: `_test/qa-nutrition/qn-data-ketqua.txt`), `summary.js` (bảng so sánh).
Ghi chú `qn-data.js`: 3 dòng "tip ghi ~150/200 kcal" còn lại là **báo nhầm** (tip nói "giảm ~150 kcal", không phải tổng);
"bia Atwater" là do script QA không tính cồn — dữ liệu đã có `alcohol: 3,9` (0,5×4 + 3,6×4 + 3,9×7 ≈ 44 kcal);
3 dòng "bước để thịt TÁI" là chữ trong `steps` gốc — món đã có `rare:true` + `stepsPreg` (thai phụ thấy bản nấu chín kỹ).

## 2. Bảng bug

| ID | Mức | Trạng thái | File:dòng (chính) | Test (`62-fix-nutrition`) |
|---|---|---|---|---|
| QN-01 | Cao | **Đã sửa** — đạm là trần cứng khi bệnh thận (`npErr` phạt > +1 %), chế độ "ít đạm" (lowP) loại món phụ giàu đạm, thêm món phụ năng lượng cao/ít đạm (cơm, bánh mì, bánh gạo, dầu, táo), lọc món theo % năng lượng từ đạm; 6 món mới ít đạm (`meals-extra.js` mục F); health-safety: cho bú +500/+400, 13–17 tuổi 1,2–1,5 g/kg; ghi chú trên thẻ thực đơn | `nutrition-pro.js:109,126-185,214,238,368,732` · `meals-extra.js:536` · `health-safety.js:58,121,149` | QN-01 ×2 |
| QN-02 | Cao | **Đã sửa** — `bodyAnalysis` biết cờ sức khoẻ: thai phụ (ẩn BMI, mức tăng cân IOM 2009), RLĂU (ẩn xếp loại + mọi lời khuyên thâm hụt), cho bú (≤ 500 kcal, sau 6–8 tuần); `goalDisplay` "Thai kỳ — không thâm hụt"; không mời đổi sang Giảm mỡ | `meals.js:359-406` · `nutrition-pro.js:80,689,726` · `nutrition.js:295` | QN-02 ×2 |
| QN-03 | Cao | **Đã sửa** — `rare:true` + `stepsPreg` (bò ≥ 63 °C nghỉ 3 phút, USDA FSIS) cho 3 món; `npPool` loại món tái khi mang thai (cả danh sách Đổi món); chi tiết món/ chọn số lượng hiện cảnh báo cam + bước nấu chín kỹ; thêm món "nên tránh" phải xác nhận; `npPregRisk` (pate, sushi, gỏi sống, bia…). Ảnh sashimi "Cơm cá ngừ" bị gỡ (QN-13) | `meals.js:100` · `meals-extra.js:498` · `nutrition-pro.js:204,498,1182,1262,1367,1412` · `nutrition-pro.css:173` | QN-03 |
| QN-04 | Cao | **Đã sửa** — ô số lượng & 6 ô Tự tạo món: `type="text" inputmode="decimal"` + `npParseNum` ("1,5" = 1,5; "1.500,5" = 1500,5); > 1.000 g hoặc > 2.000 kcal một lần → cảnh báo + hỏi lại. Ô ở `app.js` do core sửa (`fkNum`) | `nutrition-pro.js:451,1237,1262,1307` | QN-04 |
| QN-05 | TB | **Đã sửa (phần thực đơn)** — `npTargets` dùng đúng số người dùng thấy; dưới sàn 1.200/1.500 → ghi chú rõ; macro lệch > 10 % hoặc đạm > 35 % → chuẩn hoá + ghi chú. Kiểm tra lúc nhập (calo, nước 0,5–6 L) do core làm ở `app.js` | `nutrition-pro.js:48`, thẻ ghi chú `:732` | QN-05 |
| QN-06 | TB | **Đã sửa** — nước lưu tới mililit (`nuMl`), chỉ làm tròn khi hiện: 4 × 250 ml = 1 L | `nutrition.js:126,244` | QN-06 |
| QN-07 | TB | **Đã sửa** — màn Dinh dưỡng dùng `waterTargetL` (core) / dự phòng `nuWaterGoal`: 35 ml × cân nặng điều chỉnh, kẹp 1,5–3,7 L, + 0,3 L thai T2–T3, + 0,7 L cho bú; **lọc máu: không đặt chỉ tiêu, ẩn 8 ly**, ghi "theo chỉ định bác sĩ thận" | `nutrition.js:128-140,245-283` · `health-safety.js:149` | QN-07 |
| QN-08 | TB | **Đã sửa** — lớp an toàn `hsGeneralTargets`: ≥ 60 tuổi 1,2 g/kg (PROT-AGE), đạm ≤ 35 % năng lượng (AMDR); core đổi `calcMacros` theo mục tiêu/vận động | `health-safety.js:253-307` (+ `app.js` core) | QN-08 |
| QN-09 | TB | **Đã sửa** — "trí nhớ tuần" (`npWeekMemory`) + phạt lặp tăng dần, từ lần thứ 5 gần như cấm; thêm món chay/ít đạm | `nutrition-pro.js:339-360` | QN-09 |
| QN-10 | TB | **Một phần** — > 3.300 kcal: bữa tới 1.000 g, thêm loại/đơn vị món phụ đặc năng lượng; P07/P08 đạt. **Còn**: nam 16 tuổi tăng cơ 3.922 kcal (EER × 1,12 của core) thiếu −5…−12 % vì 4 bữa × 1 kg; xem Chuyển giao #3 | `nutrition-pro.js:108-115,214` | QN-10 |
| QN-11 | TB | **Đã sửa** — xôi 182 kcal (nếp VN ÷ 1,9), sữa tươi nguyên kem 61/3,3 béo, sữa có đường 77, ba chỉ 260 (TPTP VN), khoai môn luộc 142, cá thu VN 158, mồng tơi carb 3,4, bánh tráng đạm 4, bia có cột cồn | `data.js:167,175,204` · `meals.js:11,18,66` · `meals-extra.js:47,56` | QN-11 |
| QN-12 | Thấp | **Đã sửa** — "200 g mực ≈ 230 kcal, ~42 g đạm"; shake "~680 kcal" (tính 683) | `meals.js:169,341` | QN-12 |
| QN-13 | TB | **Một phần (phía mã xong, ảnh mới cần chạy workflow)** — (a) 25 ảnh sai bị **gỡ ánh xạ theo mã Pixabay** (`FOOD_IMG_BAD`) → hiện emoji thay vì ảnh thịt cho món chay, sashimi, chả giò…; khi workflow tải ảnh mới (mã khác) ảnh tự hiện; chỉ nhận tên file an toàn; (b) `food_sources.json`: từ khoá cụ thể hơn cho 26 mục, thêm 6 món mới, danh sách `veg` (76 id) → script loại ảnh có thịt/cá/trứng cho món chay, trừ điểm ảnh lạc đề (cà phê, rác, người); (c) **gỡ khoá API khỏi `fetch_food_images.py`** (chỉ đọc `PIXABAY_KEY`) | `nutrition.js:47-70` (`FOOD_IMG_BAD`, `nuCleanImgIndex`) · `scripts/fetch_food_images.py:9-60,80` · `scripts/food_sources.json` | QN-13 ×2 |
| QN-14 | TB | **Đã sửa** — xoá món → thanh "Đã xoá … · **Hoàn tác**" 5 giây, khôi phục đúng vị trí; nút × 44 × 44 px | `nutrition.js:213-243` · `nutrition-pro.css:145,156` | QN-14 |
| QN-15 | TB | **Đã sửa** — tìm theo từ (mọi thứ tự, không dấu) + đồng nghĩa Bắc–Nam (đậu phụ/đậu hũ, lợn/heo, lạc/đậu phộng, ngô/bắp, vừng/mè, dứa/thơm, dưa chuột/dưa leo, mướp đắng/khổ qua…); ưu tiên khớp trọn từ; debounce 120 ms | `nutrition-pro.js:460-496,1061` | QN-15 |
| QN-16 | TB | **Đã sửa** — món phụ/món có whey, đạm thực vật bị loại khi < 18 tuổi, mang thai, bệnh thận (kể cả chưa sàng lọc nhưng < 18) | `nutrition-pro.js:127,184,204` | QN-16 |
| QN-17 | Thấp | **Đã sửa (phần của tôi)** — nút xoá, sửa mục tiêu nước, +250/+500, nút chay 44 px; ly nước 39 × 52 px (8 ly/350 px không thể đủ 44 ngang); chữ dòng nhật ký ≥ 12 px. `.nu-mini` 44 px do UX sửa ở `style.css` | `nutrition-pro.css:140-167` | QN-17/18 |
| QN-18 | Thấp | **Đã sửa** — 4 tab chia đều (`flex:1 1 0`), ẩn icon ở ≤ 420 px; đo: scrollWidth 350 = clientWidth 350 | `nutrition-pro.css:140-143` | QN-17/18 |
| QN-19 | Thấp | **Đã sửa** — dấu ✓ lưu `state.nutriPro.shopDone` theo tuần (đổi số người không mất); tên đồ sống; ≥ 950 g → kg; hệ số gạo lứt/đậu xanh/đậu lăng 1/3, mì Ý 1/2,8 | `nutrition-pro.js:912-960` | QN-19 |
| QN-20 | Thấp | **Đã sửa** — "0,25 / 2,5 L", BMI "22,6", "Mỗi 100 g … 2,5"; nhật ký & danh sách ghi "đạm / tinh bột / béo" thay "Đ/TB/B" | `nutrition.js:124,179` · `nutrition-pro.js:736,1228` | QN-20 |
| QN-21 | Thấp | **Đã sửa** — chạm ly/+250 ml chỉ vẽ lại khối nước; mở/đóng bữa chỉ vẽ lại thẻ bữa; chọn ngày/chay/ẩm thực/chọn món đổi chỉ vẽ lại thẻ thực đơn; đồng hồ calo đếm từ số đang hiện (không về 0), tôn trọng giảm chuyển động | `nutrition.js:143-210,245-283` · `nutrition-pro.js:784-800,882` | QN-21 |
| QN-22 | Thấp | **Đã sửa** — tab "Tất cả" vẽ 30 dòng đầu, phần còn lại vẽ dần (IntersectionObserver); uỷ quyền sự kiện 1 lần | `nutrition-pro.js:1086-1173` | QN-22 |
| QN-23 | Thấp | **Đã sửa** — trần xơ = AI IOM + 10 g (nam 48, nữ 35; > 50 tuổi 40/31) | `nutrition-pro.js:42,664` | QN-23 |
| QN-24 | Thấp | **Đã sửa** — 9–18 tuổi không dưới EER IOM 2005 (`hsTeenEER`; core cũng dùng EER); BMI người lớn không áp cho < 18 (hiện "Dưới 18 tuổi", hướng dẫn BMI-theo-tuổi WHO 2007) | `health-safety.js:227,286` · `meals.js:386` | QN-24 |
| QN-25 | Thấp | **Đã sửa** — cho bú: ≤ 6 tháng sau sinh +500 kcal, > 6 tháng +400; form thêm lựa chọn "> 6 tháng" | `health-safety.js:58,86,115` | QN-25 |
| QN-26 | Thấp | **Đã sửa** — món đổi lưu kèm tuần ISO (`wk`), sang tuần khác tự hết hạn; bản lưu cũ được gắn tuần hiện tại | `nutrition-pro.js:514,697` | QN-26 |
| QN-27 | Thấp | **Đã sửa** — BMI 18,5–19,5 muốn giảm: thâm hụt ≤ 10 %; dự báo 4 tuần tụt < 18,5 → duy trì; thẻ thực đơn giải thích | `health-safety.js:253-268` (+ `app.js` core) · ghi chú `nutrition-pro.js:732` | QN-27 |
| XSS | — | Mọi chuỗi người dùng / số chèn HTML trong phần mới qua `escapeHtml`/`esc` (tên món, gram, thanh Hoàn tác, nước) | `nutrition.js` | XSS |

Thêm ngoài danh sách: ghi chú thẻ thực đơn cho bệnh thận dùng đúng cờ (`npSafety`) và ô "Đạm" chỉ xanh khi ≤ +5 % (phát hiện khi chạy Playwright).

## 3. Kiểm thử trình duyệt (Playwright, ngữ cảnh riêng `fix-nutrition`)

Bản ghép `python3 scripts/build-single-html.py _test/fix-nutrition/fn-app.html --offline`; `browser.newContext` riêng 390 × 844, DPR 2, cảm ứng, vi-VN,
chặn service worker và mạng ngoài (ảnh món → emoji). Không đụng tab/ngữ cảnh của agent khác. Kịch bản: `_test/fix-nutrition/pw_fixnutrition.js`;
ảnh: `_test/fix-nutrition/shots/fn-01…fn-10*.png`. **0 lỗi JS** ở mọi luồng.

| Luồng | Kết quả |
|---|---|
| Ghi ăn cả ngày (sáng 2 trứng, trưa cơm + ức gà, tối đậu phụ, phụ chuối) | 924 kcal; tìm "trung ga", "ức gà luộc", "dau phu" đều ra đúng món |
| Gõ **"1,5"** miếng ức gà | 225 g / 371 kcal (trước: 2.250 g / 3.713 kcal). Ô là `type=text inputmode=decimal` |
| Gõ "15" | cảnh báo "Lượng khá lớn… 2.250 g · 3.713 kcal" + hộp "Kiểm tra lại khẩu phần" trước khi thêm |
| Nước 4 × 250 ml | lưu 1 L, hiện "1 / 2,5 L"; đồng hồ calo không bị vẽ lại/đếm lại |
| Xoá món → Hoàn tác | thanh "Đã xoá Cơm trắng… · Hoàn tác" hiện; bấm → khôi phục (2 → 1 → 2 dòng) |
| Đổi món (sáng/trưa/tối) | 3 bữa ghi "đã đổi", lưu `wk: 2026-W46` |
| Thai phụ T3 BMI 26,5 mục tiêu "giảm" | BMI "—", lời khuyên IOM 2009, nhãn "Thai kỳ — không thâm hụt", nước 2,6 L; Đổi món 3 bữa: 0 món tái; mở "Phở bò tái nạc": cảnh báo cam + "Cách làm (nấu chín kỹ cho thai phụ)", không còn bước "để thịt tái" |
| Bệnh thận mạn 70 kg | 7 ngày đạm 56–58 g / mục tiêu 56 g, calo 1.734–1.781 / 1.776; ghi chú "Đạm thực đơn được giữ không vượt 56 g…"; ô Đạm xanh |
| Lọc máu | khối nước: "không đặt mục tiêu nước — theo chỉ định của bác sĩ thận", 0 ly |
| Vùng chạm | nút xoá 44 × 44, sửa nước 44 × 44, +250 ml 104 × 44, nút + bữa 44 × 44, đổi món 44 × 44, ngày 41 × 44, ly nước 39 × 52 |

**Thời gian chạm → khung hình kế** (Chromium máy bàn, cùng cách đo QA §5):

| Thao tác | QA (trước) | Sau |
|---|---|---|
| +250 ml | 297–336 ms | **19–22 ms** |
| Chạm ly nước | 238 ms | **16–27 ms** |
| Chọn ngày T2…CN | 275 ms | **37–85 ms** |
| Bật/tắt chay | 275 ms | **87 ms** |
| Mở/đóng chi tiết bữa | (vẽ cả màn) | **17–41 ms** |
| Mở "Thêm món" (tab Tất cả, 30 dòng đầu) | 540 ms | **94–118 ms** (tối đa 193) |
| Thêm 1 món | 254 ms | 164 ms (vẽ lại cả màn — cần vì đồng hồ, macro, tuần đều đổi) |
| Đổi món: mở sheet · chọn món | 101 · 199 ms | 138–242 · **66–146 ms** (mở chậm hơn vì mỗi món thay thế được giải lại với "trí nhớ tuần" — xem Việc còn lại) |

## 4. Chuyển giao (file không thuộc fixer nutrition)

1. **`.github/workflows/media-food.yml:21-22`** (chưa có chủ trong bảng — integrator / security): bước "Tải ảnh & tách nền" phải truyền secret, nếu không script dừng với thông báo thiếu khoá:
   ```yaml
         - name: Tải ảnh & tách nền
           env: { PIXABAY_KEY: "${{ secrets.PIXABAY_KEY }}" }
           run: python scripts/fetch_food_images.py
   ```
   Sau khi đặt secret: chạy workflow (thủ công) → kiểm `media/food/contact.jpg` trước khi phát hành.
2. **`media-config.js:17`** (chưa có chủ — integrator): cùng khoá Pixabay đang được nhúng phía người dùng cho tìm video. Khi chủ app thu hồi/đổi khoá phải cập nhật dòng này (hoặc để trống — người dùng tự nhập trong Hồ sơ → Nguồn video).
3. **core · `app.js` `recomputeProfile` (~dòng 219–227)**: người < 18 tuổi chọn "tăng cơ" đang nhận EER × 1,12 (nam 16 tuổi 58 kg "năng động" → 3.922 kcal). EER IOM đã gồm năng lượng tăng trưởng; đề xuất cho < 18: `kcal = round(EER × 1,05)` (tối đa +5 %). Thực đơn 4 bữa ≤ 1 kg hiện chỉ đạt −5…−12 % cho hồ sơ này (QN-10 còn lại).
4. **ux · `style.css` `.topbar` màn Dinh dưỡng**: tiêu đề "Dinh dưỡng" nền trong suốt đè lên nội dung khi cuộn (QA "ngoài phạm vi", thấy lại ở ảnh `fn-07`).
5. **ux · `themes-modules.css`**: tệp SINH TỰ ĐỘNG từ CSS module. Vì `nutrition-pro.css` đổi, tôi đã chạy đúng lệnh tài liệu `python3 scripts/gen_themes_layer.py --modules` (không sửa tay) để suite 50 xanh. Nếu UX sửa CSS module sau đó, chạy lại lệnh này.

## 5. Việc còn lại

- **Ảnh món (QN-13)**: sau khi có secret, chạy `media-food.yml`; duyệt `contact.jpg`; điền `"pick": {id: pixabay_id}` cho mục nào vẫn chưa đạt.
  Nên duyệt thêm `goi-cuon-san` (ảnh "spring rolls chinese" có thể là chả giò chiên), `bun-bo-hue-to`, `com-tam-suon`, `mi-trung-rau`.
- **QN-10** hồ sơ dậy thì tăng cơ (Chuyển giao #3); nếu vẫn thiếu, cân nhắc bữa phụ thứ 2 cho nhu cầu > 3.500 kcal (đổi cấu trúc 4 bữa của `MEAL_TYPES`).
- Sheet "Đổi món" mở 140–240 ms trên máy bàn (~0,5–0,8 s điện thoại tầm trung): có thể tính các món thay thế lười (vẽ danh sách trước, tính kcal/đạm sau) hoặc bỏ "trí nhớ tuần" khi mọi bữa đã khoá.
- Góp ý UX §6 chưa làm: tuỳ chọn **"Ẩn số calo"** cho người có tiền sử RLĂU; nút (i) giải thích "vì sao đạm X g".

---

## Vòng 2 (11–12/11/2026) — xử lý Chuyển giao (`HANDOFF-ROUND-BRIEF.md` · mục nutrition)

File sửa: `health-safety.js/.css`, `nutrition.js`, `nutrition-pro.js/.css`, `tests/suites/62-fix-nutrition.test.js` (+9 test → 39).
`themes-modules.css` sinh lại bằng `python3 scripts/gen_themes_layer.py --modules` (không sửa tay; ux chạy lại lần cuối).

| # | Việc | Trạng thái | File:dòng | Test (62) |
|---|---|---|---|---|
| 1 | FIX-core §1 — `#hs-overlay` là hộp thoại thật | **Đã sửa** — mỗi lần mở đặt `role="dialog" aria-modal="true"`; focus vào hộp (tiêu đề bước, `tabindex=-1`, mỗi bước mới focus lại); nền `inert` (mọi anh em trên đường lên `<body>`, trừ `#toast`, `#sheet-backdrop`); Tab/Shift+Tab xoay vòng trong hộp; **Esc = "Để sau"** (chế độ sửa: "Đóng") ở pha capture, nhường sheet đang mở; chọn đáp án (vẽ lại bước) giữ focus đúng nút; thiếu câu trả lời → focus ô thiếu; đóng → gỡ inert, trả focus | `health-safety.js:518-595, 674, 743` | FIX-core§1 |
| 2 | FIX-training §4.3 — `FKHealth` sớm + `fk:health-ready` | **Đã sửa** — `window.FKHealth` gán ngay sau phần logic thuần (mục 6b), TRƯỚC khi bọc hàm và vẽ lại lúc khởi động; thêm `openPreSession` (achievements gọi), `onReady(cb)`, `ready`; khởi động xong phát `document.dispatchEvent(new Event("fk:health-ready"))`. File vẫn nạp CUỐI | `health-safety.js:422-440, 1316-1321` | FIX-training§4.3 |
| 3 | FIX-core §5 — `openFoodQuantity` đọc số bằng `fkNum` | **Đã sửa** — `npNum` = `fkNum` (app.js) nếu có, dự phòng `npParseNum`; số âm → không hợp lệ; dùng cho ô số lượng và 6 ô Tự tạo món | `nutrition-pro.js:547, 1447` | FIX-core§5 |
| 4 | QU-03 — ghi nhớ `buildDayPlan`, vẽ thực đơn / đi chợ lúc rảnh | **Đã sửa** — khoá (ngày, hồ sơ→mục tiêu + cờ an toàn, tuỳ chọn) tính rẻ (`npPlanCtx`); nhớ trong bộ nhớ + **bền** ở `localStorage["fitkit_np_plans_v1"]` (riêng, không vào `fitkit_state_v1`; chỉ mã món + gam; khoá băm cyrb53; ≤ 35 thực đơn ≈ 45 KB; dữ liệu/thuật toán đổi → bỏ). Vào Dinh dưỡng mà chưa có thực đơn → khung chờ, tính **từng ngày một** lúc rảnh (rIC / setTimeout cho Safari) rồi vẽ thẻ, sau đó tính sẵn 7 ngày cho "Đi chợ". "Món healthy" vẽ 12 thẻ đầu, phần còn lại thêm lúc rảnh; đổi thẻ lọc chỉ vẽ lại dải món. "Xoá dữ liệu sức khoẻ" xoá luôn bộ nhớ thực đơn | `nutrition-pro.js:363-450, 510, 870-915, 998` · `nutrition.js:161-210, 461` | QU-03 ×2 |
| 5 | Tuỳ chọn "Ẩn số calo" | **Đã sửa** — `state.nutriPro.hideKcal` (true/false khi người dùng chọn); chưa chọn → BẬT nếu sàng lọc khai tiền sử RLĂU; khai RLĂU mới → bỏ lựa chọn cũ để mặc định áp dụng. Khi bật: đồng hồ calo / "Còn … kcal" / biểu đồ 7 ngày → thẻ **"Đĩa ăn cân bằng"** (½ rau-trái cây · ¼ đạm · ¼ tinh bột + chất béo tốt; khẩu phần bàn tay: lòng bàn tay ≈ 25 g đạm, nắm tay khum ≈ 30 g tinh bột, ngón cái ≈ 10 g béo, nắm tay rau ≈ 80 g — WHO ≥ 5 phần; bữa đã ghi; không tô đỏ "vượt"); thẻ bữa: số món + phần thay kcal/gam; thẻ thực đơn, Thêm món, chi tiết món, chọn số lượng, Đổi món, Đi chợ (cả chữ sao chép), thông báo, khối "Điều chỉnh theo sức khoẻ", thẻ Hồ sơ: không còn số kcal; ẩn thẻ lọc "Giảm mỡ". Bật/tắt: nút con mắt trên đồng hồ calo, "Hiện số calo" trên đĩa ăn, công tắc trong Hồ sơ → Sức khoẻ & an toàn. **Trang chủ** (ô "Calo hôm nay" của `pt.js`, thẻ "kcal đã nạp" của `ui-signature.js` — không phải file của tôi): dự phòng tạm trong `decorateHome` → "Bữa đã ghi n/4", ẩn thẻ năng lượng (xem Chuyển giao) | `nutrition.js:94-160, 270-300, 425-480` · `nutrition-pro.js:700-708` + các sheet · `health-safety.js:985-995, 1075-1100, 1105-1135` · CSS `nutrition-pro.css:183+`, `health-safety.css:152+` | R2-KCAL ×2 |
| 6 | Nút (i) "Vì sao đạm X g?" | **Đã sửa** — `NutriPro.proteinWhy(p, h)` (hàm thuần) giải thích theo đúng logic đang tính số: cân nặng tham chiếu (BMI > 25 → cân nặng ứng BMI 25), g/kg theo mục tiêu & vận động (ISSN 2017, Morton 2018), ≥ 60 tuổi 1,2 (PROT-AGE), thai kỳ T1 1,2 / T2–3 1,5 (Stephens 2015), cho bú 1,3 (IOM), < 18 tuổi 1,2/1,5, bệnh thận mạn ≤ 0,8 (KDIGO 2024 / KDOQI 2020), lọc máu 1,2, nhiều tình trạng → mức thấp nhất; trần 180 g và ≤ 35 % năng lượng; chia bữa + "lòng bàn tay"; tự đặt → so với mức gợi ý. Nút ở đồng hồ calo, thẻ thực đơn, đĩa ăn, thẻ Hồ sơ | `nutrition-pro.js:612-680, 1644-1668` · `nutrition.js:123, 446` | R2-WHY ×2 (10 hồ sơ: giải thích = số app tính) |

Test cũ cập nhật (ghi chú trong file): QN-02/05/20/27 đọc nội dung thẻ thực đơn → gọi `NutriPro.ui.flushIdle()` sau khi vẽ (vì thẻ giờ vẽ lúc rảnh; Node không có rIC thật).

### Kiểm thử
- `node tests/run.js` (chạy từng suite `--only` vì giới hạn 180 s của công cụ): **546/546 xanh** (24 suite; suite 62: 39/39).
- Trình duyệt — Playwright, **ngữ cảnh riêng** (`browser.newContext`, 390×844, cảm ứng, vi-VN, chặn SW/mạng ngoài), bản ghép `_test/fix-nutrition/fn-app.html`; ảnh `_test/fix-nutrition/shots/r2-01…r2-09*.png`; **0 lỗi JS**:

| Luồng | Kết quả |
|---|---|
| Lớp sàng lọc tự mở sau khởi động | focus = tiêu đề bước (`#hs-title`, trong hộp); nền inert: skip-link, tiêu đề trang, `#auth`, `#onboarding`, `#app-scroll`, thanh dưới |
| Tab ×30 rồi Shift+Tab ×12 | 42/42 lần focus vẫn trong hộp |
| Space tick xác nhận → Enter "Bắt đầu" → Tab ×2 → Enter | sang bước 1, focus tiêu đề; Enter chọn "Không" câu 1 → focus giữ đúng nút (`aria-pressed=true`) |
| Esc | hộp đóng, `skippedAt` ghi, không còn phần tử inert |
| `fk:health-ready` | phát lúc ~406 ms, khi đó `FKHealth.ready = true` |
| Lần đầu vào Dinh dưỡng (chưa nhớ thực đơn) | khung hình kế **271 ms**, 543 nút DOM (trước: ~1.800–2.000), 12 thẻ món; ~2 s sau thẻ thực đơn tự vẽ, 96 thẻ món đủ |
| "Đi chợ tuần" (đã tính sẵn lúc rảnh) | 181 ms |
| Mở lại app → Dinh dưỡng | **86 ms**, thẻ thực đơn có ngay (không khung chờ) |
| Gõ "1,5" miếng ức gà | 225 g · 371 kcal (`fkNum`) |
| RLĂU (mặc định ẩn) | Trang chủ "1/4 bữa đã ghi", không còn chữ kcal; Dinh dưỡng: đĩa ăn cân bằng, 0 chữ kcal (màn + 4 sheet); công tắc Hồ sơ 52×44 px `aria-checked=true` → tắt → đồng hồ calo trở lại; nút con mắt & (i) 44×44 px |
| (i) bệnh thận mạn 70 kg | "Vì sao đạm 56 g? … 70 kg × 0,8 g/kg ≈ 56 g … KDIGO 2024 … do bác sĩ thận quyết định" |

### Chuyển giao (vòng 2)
1. **core · `pt.js:661-664` (`renderHomeScreen`, ô "Calo hôm nay")**: khi `typeof nuHideKcal === "function" && nuHideKcal()` vẽ ô "Bữa đã ghi n/4" (vòng = n/4, icon `restaurant`, aria "Bữa ăn đã ghi hôm nay: n trên 4"). Hiện `health-safety.js hsHomeKcal` đổi tạm sau khi vẽ; khi pt.js tự làm thì hàm này không còn gì để đổi.
2. **ux · `ui-signature.js:305-330` (`decorateHome`, thẻ "kcal đã nạp")**: bỏ qua thẻ khi `nuHideKcal()` đúng (hiện health-safety ẩn tạm bằng `style.display="none"`).
3. **core · `app.js` các chỗ còn số calo khi đang ẩn**: Hồ sơ (`:3086-3090` BMR/TDEE/mục tiêu kcal), sheet "Mục tiêu calo & macro" (`openEditNutritionTargets`), kết quả onboarding — nên rút gọn còn "khẩu phần" hoặc ẩn khi `nuHideKcal()`.
4. **core · `app.js:3122` (Đặt lại toàn bộ dữ liệu)**: xoá thêm `localStorage.removeItem("fitkit_np_plans_v1")` (bộ nhớ thực đơn — không chứa dữ liệu cá nhân đọc được, nhưng nên dọn cùng).
5. **training · `achievements.js:973-978`**: có thể thay chờ `DOMContentLoaded` bằng `FKHealth.onReady(...)` / `document.addEventListener("fk:health-ready", …)`.

### Việc còn lại
- Ô Tự tạo món vẫn hỏi kcal (cần để nhập nhãn bao bì) — chấp nhận được khi đang ẩn số calo vì do người dùng chủ động nhập.
- Góp ý chuyên môn: người khai RLĂU chọn mục tiêu "Giảm mỡ" vẫn nhận đạm 2,0 g/kg (theo `proteinPerKg` của app.js, calo đã giữ duy trì). Nên cân nhắc cho RLĂU dùng g/kg của "duy trì" (1,2–1,6) để không mang dáng dấp chế độ ăn kiêng — cần thống nhất với core (`app.js proteinPerKg`) trước khi đổi ở `hsFlags`.

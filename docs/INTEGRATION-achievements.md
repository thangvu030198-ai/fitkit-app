# Tích hợp module THÀNH TÍCH (`achievements.js` + `achievements.css`)

Huy hiệu (47) · Cấp độ & XP · Bức tường kỷ lục · Tổng kết tuần · Nhắc quay lại + buổi 20 phút.
Module tự chạy khi được nạp **sau `pt.js`**, không sửa file nào khác.

## 1. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="style.css">
+  <link rel="stylesheet" href="achievements.css">
 ...
   <script src="pt.js"></script>
+  <script src="achievements.js"></script>
```

- CSS đặt **sau** `style.css`.
- JS đặt **sau** `pt.js` (và sau các module khác cũng ghi đè `renderHomeScreen`/`renderProfileScreen` nếu muốn thẻ Thành tích nằm dưới thẻ của họ — thứ tự giữa các module không bắt buộc, mọi wrapper đều gọi lại hàm cũ).
- Nếu build bằng `scripts/prepare-www.sh` / service worker có danh sách file cache, thêm 2 file trên vào danh sách.

Không cần đổi `firestore.rules` (dữ liệu chỉ lưu cục bộ trong `state`).

## 2. Dữ liệu

`state.achievements` (tạo tự động, tương thích dữ liệu cũ):

| Khoá | Ý nghĩa |
|---|---|
| `earned` | `{ idHuyHiệu: { d:"YYYY-MM-DD", t:timestamp } }` — ngày đạt, **không bao giờ bị thu hồi** (kể cả khi `setHist` bị cắt bớt 120 buổi). |
| `init` | Ngày module chạy lần đầu (lần đầu: mở khoá hồi tố toàn bộ huy hiệu từ lịch sử, gộp thành 1 popup). |
| `firstSeen` | Ngày đầu tiên thấy người dùng (dùng nhắc người chưa từng tập). |
| `quick` | Danh sách ngày tập "buổi ngắn 20 phút" (luôn tính là 1 buổi tập + giữ chuỗi). |
| `level`, `xp` | Cấp/XP lần kiểm tra trước (phát hiện lên cấp). |
| `snooze` | Ngày bấm "Để mai" trên thẻ nhắc quay lại. |
| `seenWeek` | Thứ Hai của tuần đã xem tổng kết. |

Mọi chỉ số đều **tính lại** từ: `workoutLog`, `finishedDates`, `setHist`, `setLog`, `foodLog`, `waterLog`, `sleepLog`, `progressPhotos`, `inbodyLogs`, `profile`, `plans/activePlanId`.
Một "buổi tập" = ngày trong `finishedDates` ∪ ngày `workoutLog` có `finishedAt` và ≥ 1 bài ∪ `achievements.quick`.

## 3. Các điểm ghi đè (trong `integrate()`)

| Hàm toàn cục | Thêm gì |
|---|---|
| `renderHomeScreen` | Thẻ **Nhắc quay lại** (trước `.home-hero`), thẻ **Tổng kết tuần** (thứ Hai → hết thứ Tư nếu chưa xem), thẻ **Cấp độ + huy hiệu sắp đạt** (sau `.metric-grid`). |
| `renderProfileScreen` | Thẻ **Thành tích** sau `.stat-grid`; `#profile-badge`/`#profile-sub` chuyển sang hạng/cấp theo XP. |
| `startSession` | Chụp XP đầu buổi. |
| `finishSession` | Ghi buổi ngắn vào chuỗi, kiểm tra huy hiệu mới (popup + confetti), chèn "+XP · Cấp N" vào màn "Hoàn thành buổi tập". |
| `saveState` | Kiểm tra huy hiệu (debounce 1,2 s) → chúc mừng ngay cả khi đạt từ màn Dinh dưỡng/Giấc ngủ. Đang tập dở thì hoãn tới khi kết thúc buổi. |
| `goto` | Màn mới `#screen-achieve` (tạo động trong `#app-scroll`, thêm `"achieve"` vào `SUB_SCREENS` → ẩn thanh dưới). |
| `closeSheet` | Hiện popup đang chờ sau khi sheet đóng. |
| `fkHandleBack` | Nút Back Android: đóng popup / từ màn Thành tích về màn trước. |

API công khai `window.FKAch`: `open()`, `openWeekly("last"|"this")`, `check()`, `startQuick()`, và lõi thuần `evaluate(state, now)`, `weeklySummary(state, now, which)`, `comebackInfo(state, now)`, `quickPlan(state, now, EX)`, `prWall(state, now)`, `badgeSVG(badge, size)`, `levelFor(xp)`, `BADGES`, `XP_RULES`.

Gợi ý (không bắt buộc) thêm lối vào trong menu ☰ của `app.js`:
```diff
+      <div class="link-row" onclick="closeSheet();FKAch.open();"><div class="left"><span class="material-symbols-rounded">military_tech</span><div class="name">Thành tích &amp; huy hiệu</div></div><span class="material-symbols-rounded">chevron_right</span></div>
```

## 4. Nội dung chuyên môn

- **Huy hiệu (47)**, 5 nhóm, hạng Đồng/Bạc/Vàng: buổi tập 1/10/50/100 · khối lượng 10/100/1.000 tấn · buổi ≥ 10 tấn · tuần trọn giáo án 1/4/12 · 15/30 bài khác nhau · chim sớm/cú đêm · cuối tuần · chuỗi 7/30/100 · trở lại sau ≥ 7 ngày · ngày toàn diện · tuần hoàn hảo · kỷ lục 1/10/50 · 1RM Bench/Squat/Deadlift theo tỷ lệ cân nặng (nam 0,75/1/1,5 · 1/1,5/2 · 1,25/1,75/2,25 — nữ 0,5/0,75/1 · 0,75/1,25/1,5 · 1/1,5/2) · nhật ký ăn 7/30 liên tiếp, 100 ngày · đạm ≥ 90% 1 ngày/7 liên tiếp/30 ngày · nước 7/30 liên tiếp · calo ±10% 7 ngày · ngủ đủ 7 đêm liên tiếp/30 đêm · ảnh tiến trình · 3 lần đo InBody.
- **Kỷ lục** dùng đúng quy tắc của app (1RM Epley tăng > 0,4 kg so với tốt nhất trước đó).
- **Chuỗi** dùng quy tắc của `calcStreak` (ngày nghỉ theo giáo án không làm đứt chuỗi).
- **XP**: buổi +100 · mỗi 100 kg khối lượng +1 (tối đa 100/ngày) · kỷ lục +25 · ghi ăn +20 · đủ đạm +15 · đúng calo +10 · đủ nước +15 · ngủ đủ +10 · huy hiệu 50/150/400. Cấp L cần `60·(L−1)·(L+8)` XP (≈ cấp 14 sau 90 ngày tập đều).
- **Tổng kết tuần**: buổi (so với số buổi giáo án), khối lượng, kỷ lục, calo/đạm TB (ngày có ghi), nước TB, chênh lệch so với tuần trước (tab "Tuần này" so cùng số ngày), **1 lời khuyên** theo thứ tự ưu tiên: không tập → tuân thủ thấp → khối lượng tăng > 30% → đạm < 80% → calo lệch mục tiêu (giảm/tăng/giữ) → nước < 80% → ngủ < 7 giờ → ghi chép ít → 6+ tuần liền đủ buổi (gợi ý giảm tải) → khen kỷ lục → mặc định.
- **Nhắc quay lại**: không tập ≥ 3 ngày **và** đã lỡ ≥ 1 buổi theo lịch (nghỉ đúng lịch như T6 → T2 thì không nhắc; ≥ 5 ngày thì luôn nhắc). Lời nhắn thay đổi theo số ngày nghỉ (3–6 / 7–20 / ≥ 21), không trách móc. Buổi 20 phút = tối đa 4 bài của buổi giáo án kế tiếp × 2 hiệp, nghỉ ≤ 60 s (bỏ cardio dài); không có giáo án → 4 bài không dụng cụ. Nghỉ 7–20 ngày tự điền ~90% mức tạ cũ, ≥ 21 ngày ~80%. "Để mai" ẩn thẻ tới hết ngày.

## 5. Thiết kế & trợ năng

- Huy hiệu là SVG nét mảnh, glyph gradient mint → coral, khung theo hạng (Đồng: tròn, Bạc: lục giác, Vàng: hoa thị), chấm hạng + nhãn số. Bài nâng chính vẽ số đĩa tạ = hạng. Gradient dùng id duy nhất.
- Popup `role="dialog"`, focus vào nút chính, Esc/Back để đóng; confetti canvas ~2,3 s; **`prefers-reduced-motion: reduce` → không confetti, không rung, không animation**.
- Vùng chạm ≥ 44 px, chữ giao diện ≥ 12 px (nhãn số bên trong hình huy hiệu là đồ hoạ trang trí, `aria-hidden`), tên bài tập do người dùng nhập đều `escapeHtml`.
- Icon nét mảnh mới (thêm vào `FK_LINE`, tiền tố `ach_`): `ach_trophy, ach_lock, ach_spark, ach_up, ach_down, ach_flat, ach_arrow, ach_scale, ach_medal`.

## 6. Cách thử

```bash
# Cú pháp
node -e "new Function(require('fs').readFileSync('FitKit/achievements.js','utf8'))"
# Lõi logic (69 kiểm tra: oracle độc lập cho số buổi, khối lượng, PR, chuỗi, XP, tuần, nhắc quay lại, dữ liệu hỏng, hiệu năng 3 năm)
node outputs/_test/achievements-kit/test_core.js
# Harness giao diện (gen.js sinh dữ liệu giả 90 ngày ngay trong trang)
python3 outputs/_test/achievements-kit/build.py achievements-home.html t_home.js '{"days":90,"gapDays":5}'
```
Bộ kiểm thử (`gen.js` sinh dữ liệu giả, `common.js`, `build.py`, `test_core.js`, `t_home/screen/flow/week/profile.js`) nằm ở `outputs/_test/achievements-kit/` (`build.py` cần sửa biến `ROOT/OUT` nếu chạy ở máy khác).
File harness đã xuất ở `outputs/_test/achievements-*.html` (home 12/12, screen 13/13, flow 9/9, week 6/6, profile 7/7 — 0 lỗi JS), ảnh chụp ở `outputs/_test/shots/ach-*.png`.
Thử tay trong app: Hồ sơ → thẻ **Thành tích**; hoặc console: `FKAch.open()`, `FKAch.openWeekly()`.

## 7. Giới hạn

- Ngày nghỉ của chuỗi/"tuần trọn giáo án" dựa trên **giáo án đang dùng** (áp ngược cho quá khứ), giống `calcStreak`.
- Tỷ lệ sức mạnh dùng **cân nặng hiện tại** trong Hồ sơ.
- Tổng khối lượng tính từ `setHist` (app chỉ giữ 120 buổi gần nhất mỗi bài) — huy hiệu đã đạt vẫn được giữ nguyên.
- Buổi tập với PT (cloud) chưa được tính.
- Buổi ngắn được đẩy vào `finishedDates`; nếu sau đó người dùng bỏ tích bài trong màn Tập luyện, `updateFinishedDates()` có thể gỡ ngày đó khỏi chuỗi của app (thống kê của module vẫn giữ nhờ `achievements.quick`).
- Lịch sử tính tối đa ~3 năm (1.100 ngày) để luôn nhanh (≈ 4 ms với 90 ngày, ≈ 30–90 ms với 3 năm).

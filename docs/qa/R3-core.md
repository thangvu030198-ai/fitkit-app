# R3 — agent `core` (14/11/2026)

Phạm vi: `app.js`, `templates.js`, `library.js`, `video.js`, `freevideos.js`, `exdb*.js`, `training-pro.js/.css`, `program-builder.js/.css`, `achievements.js/.css`, `fk-lazy.js`, `press-feel.js/.css`.
Test: `tests/suites/80-r3-core.test.js` (26 test, đều xanh). Số dòng dưới đây là của `app.js` sau khi sửa.

**Mức độ đọc mã:** `app.js` đọc gần hết (trừ phần menu ☰, màn "Kế hoạch đã sẵn sàng", khung chụp ảnh, hướng dẫn Drive chỉ xem lướt). Các file còn lại **chưa đọc từng dòng** — chỉ quét theo mẫu rủi ro (timer / observer / listener, `localStorage`, `JSON.parse`, `fetch`, ngày giờ, chuỗi người dùng chèn HTML không qua `esc`) và đọc các đoạn liên quan đến buổi tập trong `training-pro.js`. Không thấy lỗi mới ở các file đó ngoài R3-CORE-05 (kẹp hiệp) và R3-CORE-16.

**Kiểm thử:** chỉ chạy bằng harness Node (DOM giả). Sandbox không có Playwright nên **chưa kiểm trên trình duyệt thật** — các mục liên quan đến canvas, IndexedDB thật, wake lock, sự kiện `storage`/`visibilitychange` cần thử tay (xem cuối file).

## Tổng hợp

| Mức | Số lỗi | Đã sửa |
|---|---|---|
| Critical | 0 | — |
| High | 5 | 5 |
| Medium | 9 | 9 |
| Low | 4 | 3 (1 không sửa) |

## Bảng lỗi

| Mã | Mức | File:dòng | Mô tả | Tái hiện | Cách sửa | Trạng thái |
|---|---|---|---|---|---|---|
| R3-CORE-01 | High | app.js:90–113 | JSON trong `fitkit_state_v1` hỏng → `loadState` trả state trống **âm thầm**, lần `saveState()` kế tiếp ghi đè, mất hẳn dữ liệu. | Đặt `localStorage.fitkit_state_v1 = '{"onboarded":true,'` rồi mở app. | Giữ nguyên văn bản hỏng ở key phụ `fitkit_state_v1_corrupt` (≤ 2 MB), đặt cờ `loadState.corrupt`, báo 1 lần lúc `init()` (`fkStorageNotice`). Key chính không đổi. | Đã sửa |
| R3-CORE-02 | High | app.js:3800–3850 | Ảnh đại diện lưu **nguyên cỡ** dạng base64 vào localStorage (ảnh chụp 3–8 MB vượt hạn mức ~5 MB) → lưu thất bại và mọi thay đổi sau đó cũng không lưu được. | Hồ sơ → chạm ảnh đại diện → chọn ảnh chụp từ máy ảnh. | `fkSetAvatar`: chỉ nhận ảnh ≤ 25 MB, thu nhỏ còn 256 px JPEG (`fkShrinkImage`), từ chối kết quả > 200.000 ký tự, lưu hỏng thì hoàn tác. `normalizeState` bỏ `avatarData` không phải `data:image`. | Đã sửa |
| R3-CORE-03 | High | app.js:4000–4050 | `restoreFromBackupZip` xoá kho video/ảnh **trước** khi kiểm tra bản sao lưu: `state.json` là `null`/mảng, manifest sai, hoặc localStorage đầy → mất dữ liệu cũ mà không khôi phục được gì. | Khôi phục từ file zip có `state.json` = `null`. | Kiểm tra + đọc hết blob trước, ghi state mới (giữ bản cũ), rồi mới thay kho; lỗi giữa chừng trả lại state cũ. Manifest chỉ nhận `clips`/`photos` + id số. | Đã sửa |
| R3-CORE-04 | High | app.js:113–131, 272–330 | Số đo hồ sơ sai kiểu / NaN / âm (dữ liệu cũ, sao lưu) → BMR/TDEE/calo/macro ra `NaN` hoặc âm trên Trang chủ, Hồ sơ, Dinh dưỡng. | State có `profile.weight = "abc"` hoặc `height = -5`. | `fkSanitizeProfile` (gọi trong `normalizeState` và `recomputeProfile`) ép về số trong khoảng hợp lý, ngoài khoảng dùng mặc định; `calcBMR/TDEE/GoalKcal/Macros` chịu được đầu vào xấu. | Đã sửa |
| R3-CORE-05 | High | app.js:497–503, 1620; training-pro.js:431 | Số hiệp không giới hạn: gõ `100000` (hoặc giáo án nhập từ PT/sao lưu) → màn buổi tập dựng 100.000 hàng, treo máy. Số âm, tên dài vô hạn cũng lưu nguyên; "0 giây nghỉ" không lưu được. | Giáo án → sửa bài → Số hiệp = 100000 → Bắt đầu buổi. | `fkClampSets` (1–20), `fkClampRest` (0–900), `fkCleanReps` (≤ 24), `fkCleanName` (≤ 60) ở mọi form giáo án; màn buổi tập và `FKTP` kẹp ≤ 20 hàng. | Đã sửa |
| R3-CORE-06 | Medium | app.js:1745–1790 | Đồng hồ nghỉ trừ dần theo `setInterval` → khoá màn hình/chuyển app thì bị bóp timer, nghỉ 90 giây thành vài phút. `restSec` dạng chuỗi + "+15s" ra `"6015"`. Wake lock không xin lại sau khi quay lại app. | Bấm ✓ hiệp, khoá máy 45 giây, mở lại. | Đếm theo mốc `window._restEnd` (`fkRestSync`), đồng bộ lại khi `visibilitychange`, ép số + kẹp ≤ 900, xin lại wake lock. Tương thích nút tạm dừng của `morph-icons.js` (`fkRestPaused`). | Đã sửa |
| R3-CORE-07 | Medium | app.js:160–200, 2857, 3112 và các chỗ vẽ | Trường số/chuỗi từ state chèn thô vào HTML (InBody, cân lúc chụp, id ảnh/video, giờ nhắc, nhà cung cấp AI, gram/kcal món) → bản sao lưu bị sửa tay chạy được HTML. | Khôi phục bản sao lưu có `inbodyLogs[0].weight = "<img src=x onerror=…>"`. | `normalizeState` ép kiểu toàn bộ; thêm `fkNumTxt`, escape tại nơi vẽ; `providerLabel` không trả chuỗi lạ; biểu đồ InBody chỉ nhận số hữu hạn; URL Gemini mã hoá model + key. | Đã sửa |
| R3-CORE-08 | Medium | app.js:545–575 | Mỗi lần vẽ lại Tập luyện / Giáo án / Tiến độ tạo `URL.createObjectURL` mới cho mọi video, ảnh và không thu hồi → rò bộ nhớ. Xoá video khỏi kho nhưng bài vẫn trỏ tới clip đã xoá. | Có 5 video gắn bài, đổi tab ngày nhiều lần. | `fkBlobUrl` giữ 1 URL cho mỗi clip/ảnh, `fkBlobUrlDrop` khi xoá; xoá clip gỡ `clipId` khỏi mọi bài; video không mở được có dòng giải thích. | Đã sửa |
| R3-CORE-09 | Medium | app.js:228–265 | Hết bộ nhớ không tự dọn; trình duyệt chặn lưu trữ (Safari riêng tư) lại báo "Bộ nhớ máy đầy". `_firedKeys` không bao giờ dọn. | Chặn cookie rồi mở app; hoặc dùng nhắc nhở vài tháng. | Dọn `_firedKeys` cũ + bản hỏng đã giữ rồi thử lại 1 lần; câu báo riêng cho `SecurityError`; `saveState.lastError`; `getItem` ném lỗi không làm vỡ lúc nạp. | Đã sửa |
| R3-CORE-10 | Medium | app.js:3549–3610 | Giấc ngủ: ô giờ trống → lưu `NaN` giờ, trung bình hiện "NaNh"; mục tiêu không kẹp; nhãn thứ dùng `new Date("YYYY-MM-DD")` (UTC) nên lệch 1 ngày ở múi giờ âm. | Xoá ô giờ ngủ rồi bấm Lưu. | Kiểm tra `HH:MM`, hỏi lại khi > 16 giờ, mục tiêu 4–12 giờ, nhãn thứ theo ngày địa phương, bỏ qua bản ghi cũ hỏng. | Đã sửa |
| R3-CORE-11 | Medium | app.js:3184–3215 | InBody nhận số âm, 9999 kg, mỡ 150 %, ngày tương lai, ngày không có thật; nút Xoá không hỏi lại. | Tiến độ → InBody → nhập cân nặng −5. | `fkInbodyRead` kiểm khoảng + ngày, lỗi hiện tại chỗ; nhận dấu phẩy thập phân; xoá có xác nhận. | Đã sửa |
| R3-CORE-12 | Medium | app.js:3722–3765 | Nhắc nhở so khớp **đúng phút** → tab nền bị bóp timer là trượt; không có giáo án thì ném lỗi mỗi 15 giây; giờ để trống vẫn lưu. | Bật nhắc bữa sáng 07:00, để tab ở nền. | `fkReminderDue` (trễ ≤ 3 phút vẫn bắn, 1 lần/ngày/giờ hẹn), có guard, kiểm giờ trước khi lưu, vòng lặp có `try/catch`. | Đã sửa |
| R3-CORE-13 | Medium | app.js:4180–4212 | Mở app ở 2 nơi (tab + PWA): nơi mở sau ghi đè dữ liệu nơi kia. | Mở 2 tab, ghi nước ở tab A, đổi gì đó ở tab B. | Nghe sự kiện `storage`, nạp lại state (`fkStorageAdopt`); đang tập / mở sheet / onboarding thì hoãn tới lúc quay lại app. | Đã sửa |
| R3-CORE-14 | Medium | app.js (openUploadClip, openCapturePhoto) | Lưu video/ảnh thất bại (đầy bộ nhớ, IndexedDB bị chặn) → nút im lặng, không báo gì; bấm 2 lần lưu trùng; nhận cả tệp không phải video. | Tải video khi máy gần đầy. | `try/catch` + câu báo rõ, khoá nút khi đang lưu, chỉ nhận video ≤ 300 MB. | Đã sửa |
| R3-CORE-15 | Low | app.js:545, 667, 3860, 4075 | Mỗi lần đọc/ghi mở 1 kết nối IndexedDB mới; `goto()` màn không tồn tại ném lỗi; "Xoá hết" kẹt khi IndexedDB bị chặn; tự sao lưu Drive không chạy khi Client ID cấu hình sẵn trong app; nhân bản giáo án không tồn tại ném lỗi. | — | Dùng lại 1 kết nối, guard từng chỗ. | Đã sửa |
| R3-CORE-16 | Low | training-pro.js:867 | Kỷ lục số lần (AMRAP) của buổi qua nửa đêm ghi theo ngày kết thúc, lệch với `setHist`. | Bắt đầu buổi 23:50, xong 00:10. | Dùng `session.date`. | Đã sửa |
| R3-CORE-17 | Low | app.js:4269, 4404 | `e1rm(-50, 5)` trả số âm; `fkNextKg` với kg âm trả số âm; `recordExerciseResult` ghi nguyên kg/lần âm, NaN từ module khác. | Gọi trực tiếp với số âm. | Trả 0 với đầu vào ≤ 0 / không hữu hạn; chuẩn hoá hiệp trước khi ghi (kg 0–500, lần 0–200). | Đã sửa |
| R3-CORE-18 | Low | app.js (buildBackupZip) | Bản sao lưu Drive chứa cả API key AI người dùng tự nhập (`aiSettings`). | Sao lưu rồi mở `state.json` trong zip. | Đề xuất: bỏ key khỏi bản sao lưu, hoặc hỏi người dùng. | **Không sửa** — file nằm trong Drive của chính người dùng; bỏ key sẽ làm mất cài đặt khi khôi phục. Cần chủ dự án quyết. |

## Thay đổi hành vi cần biết

- **Nhắc nhở:** bật một nhắc nhở có giờ hẹn vừa qua ≤ 3 phút sẽ bắn ngay. Khoá chống trùng đổi dạng thành `ngày_giờ_loại`.
- **Màn Dinh dưỡng (lõi):** số kcal/gram hiện kiểu Việt (`1.234 kcal`, `70,5`).
- **InBody:** ô nhập đổi từ `type=number` sang `type=text inputmode=decimal` để gõ được dấu phẩy.
- **Dữ liệu cũ:** `normalizeState` nay loại bản ghi không hợp lệ (ảnh/video không có id số, bản ghi giấc ngủ không có số giờ, ngày tập trùng). Dữ liệu hợp lệ không đổi.
- **Xoá số đo InBody** nay có hộp xác nhận.

## Chuyển giao

Không có lỗi nào cần agent khác sửa. Ghi nhận:

- `tests/suites/50-theme-packs.test.js` báo `themes-modules.css cũ` — thuộc agent `ux` (cần chạy lại `python3 scripts/gen_themes_layer.py --modules`). Tôi không sửa file CSS nào.
- `morph-icons.js` (nút tạm dừng nghỉ) tiếp tục chạy được với đồng hồ mới; nếu agent sở hữu đổi id `fk-rest-pause` hoặc `aria-pressed` thì `fkRestPaused()` cần sửa theo.

## Chuỗi cần dịch

- "Trình duyệt đang chặn lưu dữ liệu (chế độ riêng tư / tắt cookie) — thay đổi sẽ mất khi đóng app. Hãy mở bằng tab thường hoặc cài app." → "Your browser is blocking storage (private mode / cookies off) — changes will be lost when you close the app. Open in a normal tab or install the app."
- "Dữ liệu lưu trên máy bị hỏng nên app bắt đầu lại. Bản cũ đã được giữ riêng — hãy khôi phục từ bản sao lưu nếu có." → "Saved data was corrupted, so the app started fresh. The old copy was kept separately — restore from a backup if you have one."
- "Hãy chọn một tệp ảnh (JPG, PNG…)." → "Please choose an image file (JPG, PNG…)."
- "Ảnh lớn hơn 25 MB — hãy chọn ảnh nhỏ hơn." → "Image is larger than 25 MB — choose a smaller one."
- "Không đọc được ảnh này — hãy thử ảnh khác (JPG hoặc PNG)." → "Couldn't read this image — try another one (JPG or PNG)."
- "Đã đổi ảnh đại diện" → "Profile photo updated"
- "Hãy chọn một tệp video (MP4, MOV…)." → "Please choose a video file (MP4, MOV…)."
- "Video lớn hơn 300 MB — hãy cắt ngắn hoặc giảm chất lượng rồi tải lại." → "Video is larger than 300 MB — trim it or lower the quality and try again."
- "Bộ nhớ máy đầy — chưa lưu được video. Xoá bớt video cũ rồi thử lại." → "Device storage is full — video not saved. Delete some old videos and try again."
- "Bộ nhớ máy đầy — chưa lưu được ảnh. Xoá bớt video/ảnh cũ rồi thử lại." → "Device storage is full — photo not saved. Delete some old videos/photos and try again."
- "Đang lưu…" → "Saving…"
- "Không mở được video — có thể đã bị xoá khỏi bộ nhớ máy." → "Couldn't open the video — it may have been removed from device storage."
- "Không mở được ảnh — có thể đã bị xoá khỏi bộ nhớ máy." → "Couldn't open the photo — it may have been removed from device storage."
- "Không mở được ảnh để so sánh." → "Couldn't open the photos to compare."
- "Không tìm thấy giáo án để nhân bản" → "Couldn't find the plan to duplicate"
- "Cân nặng phải trong khoảng 20–350 kg." → "Weight must be between 20 and 350 kg."
- "Ngày đo không hợp lệ." → "Invalid measurement date."
- "Ngày đo không thể ở tương lai." → "Measurement date can't be in the future."
- "Ngày đo quá xa — hãy kiểm tra lại năm." → "Measurement date is too far back — check the year."
- "Khối lượng cơ phải nhỏ hơn cân nặng." → "Muscle mass must be less than body weight."
- "Xoá số liệu này?" → "Delete this entry?"
- "Lần đo sẽ bị xoá khỏi biểu đồ và không thể khôi phục." → "This measurement will be removed from the chart and can't be restored."
- "Chọn đủ giờ đi ngủ và giờ thức dậy." → "Pick both bedtime and wake-up time."
- "Mục tiêu giấc ngủ từ 4 đến 12 giờ/đêm." → "Sleep goal must be 4 to 12 hours per night."
- "Chọn giờ nhắc nhở hợp lệ (giờ:phút)." → "Pick a valid reminder time (hh:mm)."
- "File sao lưu bị hỏng (state.json không đọc được)." → "Backup file is corrupted (state.json can't be read)."
- "File sao lưu không hợp lệ (state.json sai định dạng)." → "Invalid backup file (state.json has the wrong format)."
- "File sao lưu bị hỏng (danh sách video/ảnh không đọc được)." → "Backup file is corrupted (video/photo list can't be read)."
- "Bộ nhớ máy đầy hoặc trình duyệt chặn lưu — chưa khôi phục được (dữ liệu hiện tại vẫn nguyên)." → "Storage is full or blocked by the browser — restore failed (your current data is untouched)."

## Cần thử tay trên thiết bị thật

1. Đổi ảnh đại diện bằng ảnh chụp từ máy ảnh (iOS Safari + Android Chrome): ảnh hiện đúng, cắt vuông ở giữa.
2. Đồng hồ nghỉ: bấm ✓, khoá máy 30–60 giây, mở lại — số giây còn lại đúng; nút tạm dừng / +15s vẫn chạy.
3. Mở app ở 2 tab: ghi nước ở tab A, chuyển sang tab B thấy số mới.
4. Safari riêng tư: app mở được và hiện câu báo "chặn lưu dữ liệu".
5. Sao lưu → khôi phục Drive với bản sao lưu thật có video.

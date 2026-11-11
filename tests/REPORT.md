# TapEasy (FitKit) — Báo cáo kiểm thử tự động (QA) — 11/11/2026

> **Cập nhật sau vòng tích hợp (11/11/2026):** cả 19 bug dưới đây ĐÃ SỬA — `node tests/run.js` → **160 test · 160 pass · 0 fail**
> (9 suite, thêm `07-program-builder` và `08-integration`). Kiểm thử trình duyệt thật (Chromium, ngữ cảnh riêng):
> `tests/browser/t_integrated.js` trên bản ghép 1 file → **41/41 PASS, 0 lỗi JS**. Chi tiết cách sửa: `docs/INTEGRATION-LOG.md`.
> Các test có mã BUG-xx được giữ nguyên làm test hồi quy. Danh sách gốc giữ lại bên dưới để tra cứu.


125 test · 95 pass · 30 fail (đều tái hiện bug thật) · 19 bug (Cao 2 · TB 6 · Thấp 11). Chạy: `node tests/run.js` (`--known-ok`, `--only <tên>`, `--verbose`), độ phủ: `node tests/coverage.js` (56 % dòng). Runner chỉ nạp script có trong index.html và suites trong `tests/suites/`.

## Danh sách bug (vị trí theo mã 11/11/2026)

- **BUG-01 · Cao · XSS qua `toast()`**: `app.js:18-20` gán innerHTML thô; caller chèn dữ liệu tài khoản khác: `pt.js:96-98` (nhắc buổi PT), `coach.js:311` (tên PT khi nhập mã); dữ liệu tự nhập: `app.js:456,1111,1258,1287,2255,2902`; lỗi API: `app.js:2706,2727,2782`. Sửa: icon escape, message dùng `textContent`. `confirmDialog` (`app.js:144-149`) chèn thô → escape ở caller `app.js:1095`.
- **BUG-02 · TB · Trường cloud chèn thô**: `coach.js:130,137,149,218,311,429,430,479,492(×2),542,544,573,587,643,645,752,779,819` · `ptprofile.js:75,98,99,100,124` · `pt.js:494` · `video.js:136-140` (href không chặn `javascript:`). Sửa: escape cả “số” (`escapeHtml(String(e.sets ?? "-"))`), whitelist `n.kind`, ảnh chỉ nhận `data:image/...;base64,` hoặc `https://`, thêm `safeUrl(u)` cho mọi href/src.
- **BUG-03 · Cao (Firebase) · firestore.rules**: dòng 15 `allow read: if signedIn()` cho list toàn bộ users (lộ email); dòng 52 notes không ràng `authorUid`. Sửa: `allow get` / `allow list: if false`; notes create yêu cầu `request.resource.data.authorUid == me()` và kind hợp lệ; update chỉ tác giả (sessions vẫn cho member); tách email khỏi hồ sơ công khai.
- **BUG-04 · TB · <18 tuổi vẫn được mời “Giảm mỡ”**: `meals.js:351-357`, `nutrition.js:312`. Sửa: `if(p.age<18 && rec==="lose") rec="maintain"`; mismatch bỏ qua khi <18.
- **BUG-05 · TB · Thực đơn chay thiếu 15–16 % calo mục tiêu cao**: `meals.js:388-399` (lưu ý nutrition-pro.js đã thay thuật toán — kiểm lại sau tích hợp).
- **BUG-06 · TB · Khẩu phần > 600 g/món, món phụ dồn 1 bữa tới +1 kg**: `meals.js:383,390-399`; `dau-hu-nam-af` 725 g gốc. Sửa: factor ≤ 600/g0, món phụ ≤ 400 g/bữa, chia bữa sáng/phụ (kiểm lại với nutrition-pro).
- **BUG-07 · TB · Màn chi tiết/buổi tập/thư viện/bài PT giao tìm video theo TÊN → mất lọc dụng cụ**: `video.js:243` + caller `video.js:314,324,335`, `library.js:196`, `coach.js:552`. Sửa: truyền `meta` (name + equipment) vào findFreeExerciseVideos.
- **BUG-08 · TB · joinByCode cho người thứ 2 chiếm form**: `cloud.js:350-360`, demo `updateClient` `cloud.js:117`. Sửa: chặn khi `studentUid` đã có và khác user; thông báo “Mã này đã có học viên dùng…”.
- **BUG-09 · Thấp · BMI làm tròn lệch nhãn ở ngưỡng**: `meals.js:349-358` — phân loại trên giá trị đã làm tròn.
- **BUG-10 · Thấp · Video sai dụng cụ/biến thể (wger không có dụng cụ)**: `freevideos.js:104-118`. Sửa: thêm `equip` cho index wger (Bench Press→barbell, Lateral Raises→dumbbell, Rowing seated→cable, Pull Ups on Machine→machine…) qua bảng map trong freevideos.js; thêm "side" vào FV_MOD; “Nâng bắp chân” (đứng) không lấy *Sitting* Calf Raises.
- **BUG-11 · Thấp · Tự tăng tạ**: `app.js:2874` hiệp tụt tạ vẫn “đạt” → kiểm `kg >= baseKg`; `app.js:2887` reset fails chỉ khi tạ thật sự giảm.
- **BUG-12 · Thấp · Khởi động thanh đòn < 20 kg**: `app.js:2905-2910` → sàn 20 kg cho thanh đòn, hiệp đầu “Thanh rỗng 20 kg × 10”, bỏ hiệp trùng.
- **BUG-13 · Thấp · `uid()` có thể trùng**: `app.js:163` → bộ đếm + random dài.
- **BUG-14 · Thấp · Chay + Âu bữa phụ rơi về món không chay**: `meals.js:375-376`.
- **BUG-15 · Thấp · Mất mạng lúc tải index video không thử lại**: `freevideos.js:58,77` → không cache mảng rỗng, reset `_loading`.
- **BUG-16 · Thấp · deleteAccount khi chưa đăng nhập ném TypeError**: `cloud.js:139,281` → `if(!user) throw dErr("auth/requires-recent-login")`.
- **BUG-17 · Thấp · perWeek lệch**: `templates.js:185,259` → đặt = tổng số ngày có bài.
- **BUG-18 · Thấp · Self-XSS dữ liệu tự nhập (26 chỗ)**: `app.js:456,512,515,540,575,719,884,1078,1095,1111,1120,1154,1169,1187,1253,1258,1287,1298,1945,2105,2197,2229,2255,2359,2902`, `nutrition.js:377` → bọc escapeHtml (value="" cũng escape).
- **BUG-19 · Thấp · searchPixabay ném TypeError**: `video.js:100` câu `if(!v||!v.url) return null;` nằm trong comment → tách dòng.

## Phát hiện khác
- Bài trong giáo án chưa có video: chỉ `invertedrow`.
- Ngực 8–9 hiệp/tuần ở tpl-m-ul, tpl-m-ulppl; Vai 6 ở tpl-m-ul (dưới 10).
- Món “chay” có trứng/sữa → dùng tag `thuan-chay` cho người kiêng.
- Alias `"Leo núi (Mountain"` bị cắt trong scripts/extra_sources.json.
- `calcMacros` đọc state.profile.height toàn cục.

# TapEasy — Ghi chú phát triển (cập nhật 22/11/2026, web v98)

Đọc file này trước khi sửa app. Nó ghi lại các quyết định, lỗi đã sửa và "bẫy" dễ làm sai.

## 1. Hạ tầng & cách đưa bản mới lên

- Web: https://tapeasy.app — JS thuần (không framework), Capacitor cho Android/iOS. Repo GitHub `thangvu030198-ai/fitkit-app`.
- Deploy web: nén file đã sửa thành `deploy-bundle.zip` → upload vào `github.com/thangvu030198-ai/fitkit-app/upload/main` → workflow "Giải nén gói mã nguồn" tự giải nén → "Web — build & đưa lên tapeasy.app" (~1–2 phút). Android/iOS tự build theo.
- **Mỗi lần đổi file web phải tăng số `CACHE = "fitkit-vNN"` trong `sw.js`** (hiện v98), nếu không máy người dùng vẫn chạy bản cũ. File JS/asset mới phải thêm vào danh sách `ASSETS` trong `sw.js` (test 08-integration kiểm tra) và `scripts/prepare-www.sh` nếu có danh sách.
- Kiểm tra bản mới đã lên: mở tapeasy.app, xem `caches.keys()` có `fitkit-vNN` và nội dung file trong cache đó (fetch thường có thể bị service worker cũ trả bản cũ).
- Cloud Functions (AI): workflow "Firebase — đẩy rules + Cloud Functions" → Run workflow, ô functions = `true` (~3 phút). Lỗi "Failed to list functions" là lỗi tạm của Google → chạy lại.
- Log máy chủ: Google Cloud Logging, project `tapeasy-2ce8f`, lọc `analyzeInbodyReport` / `analyzeFoodPhoto`.
- Test: `node tests/run.js` (≈1000 test, ~7 phút) hoặc `--only <số suite>`. **3 test đỏ CŨ, đã biết, không liên quan**: 06-security (quét library.js), 70-people-ai ×2. Không được để thêm test đỏ mới.
- Bảo mật: không ghi khoá API/mật khẩu vào code hay chat; khoá AI nằm ở Admin → Trợ lý AI (Firestore `ai_secret/main`) và secret `VISION_API_KEY`.

## 2. AI (Trợ lý, chụp món ăn, đọc InBody)

- Mọi chức năng AI dùng chung khoá + cấu hình của **Trợ lý AI** (Admin) và chung hạn mức **20 lượt/người/ngày** (`ai_rate`). Mỗi lần quét = 1 lượt; lỗi máy chủ thì hoàn lượt.
- Thứ tự model đọc ảnh (`functions/vision.js`): "Model đọc ảnh" trong Admin (nên ĐỂ TRỐNG trừ khi cổng apivn.vn có model đọc ảnh) → Gemini gọi thẳng Google: `gemini-3.5-flash-lite` → `gemini-flash-lite-latest` → `gemini-3.8-flash` → `gemini-flash-latest` → model chat còn lại.
- Bẫy đã gặp: model deepseek trên apivn **không xem được ảnh** (luôn trả "không có món"); Google đã khoá `gemini-2.5-*` với tài khoản mới (404); `gemini-3.8-flash` hay quá tải (503) và chậm → đã giảm suy luận (`reasoning_effort: low`), mỗi model chờ tối đa 40 s (InBody 55 s), tổng 115 s, app chờ 130 s.
- InBody: AI đọc đủ chỉ số (cân, cơ xương, mỡ kg/%, nước, protein, khoáng, nội tạng, BMR, điểm, BMI, FFM, SLM, ECW/TBW, SMI, eo/hông, cân mục tiêu, kiểm soát cân/mỡ/cơ, phân tích nạc & mỡ từng phần) + khối đánh giá `eval` (tóm tắt, trạng thái 4 chỉ số, điểm tốt, cần cải thiện, lời khuyên, so với lần trước, đo lại sau X ngày) trong CÙNG 1 lần gọi. App gửi kèm hồ sơ + ≤6 lần đo trước. Không có `eval` → app tự đánh giá bằng luật (không tốn lượt).
- InBody lưu ở `state.inbodyLogs` (trường camelCase: weight, bodyFatPct, muscleMassKg, ffmKg, segLean, segFat, eval…). Có xoá từng lần / xoá tất cả (thẻ "Thành phần cơ thể" trang chủ → Xoá kết quả). Trang chi tiết có hình cơ thể nam/nữ tự vẽ (SVG) 5 vùng.

## 3. Buổi tập — các lỗi nghiêm trọng đã sửa (đừng làm hỏng lại)

- **Mất buổi tập khi chuyển app** (iOS/Android tắt app nền): buổi đang dở giờ được chụp vào `localStorage` key `fk_active_session_v1` sau mỗi thao tác, mỗi 3 s, khi app xuống nền. Mở lại → hỏi "Tiếp tục / Kết thúc & lưu / Bỏ buổi". Hết hạn sau 20 giờ. Hàm: `fkSessSnapshot`, `fkSessRestore`, `fkSessRestoreSoon` (gọi từ `finishBoot` trong pt.js — lưu ý `init()` trong app.js KHÔNG được gọi khi chạy thật). Mọi trường mới thêm vào `session` phải là dữ liệu JSON được.
- Test harness: `setTimeout` > 1000 ms không chạy trong test → hẹn giờ khởi động phải ≤ 1000 ms.

## 4. Bài tập: một bên / hai bên

- Phân loại 944 bài trong `exercise-side.js` (`fkExerciseSide(meta)`): **uni** (luôn từng bên, 107 bài), **either** (làm được cả hai kiểu, 164), **bi** (chỉ hai bên, 673). Sửa nhóm: bảng `CORE` (bài lõi) / `X` (thư viện). Danh sách duyệt: `E:\khovideogym\clips\_side_audit\side.csv`.
- Bài "either" có bộ chọn "Hai tay | Từng tay" (chân: "Hai chân | Từng chân"), nhớ theo từng bài; giáo án có thể đặt sẵn. Bài "uni" mặc định ghi T/P, có "Ghi gộp".
- Dữ liệu hiệp từng bên: trái ở `r.kg/r.reps/r.rpe`, phải ở `r.R.{kg,reps,rpe}`; `fkRowRpe` lấy RPE cao hơn. setLog có `mode: "uni"|"both"`; "Lần trước" và gợi ý tăng tạ chỉ so với **cùng kiểu**. Khối lượng từng bên = cộng 2 bên; giữ quy ước kg/quả cho tạ đơn.
- Thanh hiệp ở đáy (`session-focus.js`) có tab T/P + RPE từng bên khi tập từng bên. Màn superset/circuit (`training-pro.js`) vẫn ghi gộp.

## 5. Video & ảnh bài tập

- Khớp video ↔ bài phải **chặt** (`freevideos.js`): một tay/hai tay, tư thế quỳ/ngồi/đứng/nằm, dụng cụ, cáp cao/thấp, biến thể đặc thù phải khớp. Không chắc → không gắn clip, hiện nút YouTube đúng tên bài. (Lỗi cũ: kéo cáp cao một tay quỳ hiện clip ngồi kéo cáp hai tay.) Báo cáo: `E:\khovideogym\clips\_video_audit\`.
- YouTube: `guide-links.js` + `yt-manual.json` (ID đã xác minh qua oEmbed). Bài chưa có ID → link tìm kiếm YouTube theo tên tiếng Anh. Không bịa ID.
- Ảnh bìa (`fkThumb` trong exdb.js): ưu tiên poster video 3D của chính bài (`media/ex3d`) → ảnh free-exercise-db đúng bài → ô minh hoạ trung tính `assets/ex-thumbs/*.svg`. **Không dùng ảnh nhóm cơ chung** (lỗi cũ: cả nhóm Đùi trước cùng 1 ảnh). Báo cáo: `E:\khovideogym\clips\_thumb_audit\`.
- Không dùng ảnh người thật/người nổi tiếng/thương hiệu mới; ảnh người dùng tự gửi thì được.

## 6. Giao diện & khác

- Theme qua token CSS (`--accent`, `--text`, `--fk-ov-rgb`, `--fk-sheet-2-rgb`…); mọi màn mới phải rõ ở theme Sáng & tối.
- "Chế độ gọn" (Hồ sơ) chỉ ẩn bớt khối phụ, không đổi bố cục.
- Bộ môn (`sport-picker.js`, `FKSport`): Fitness chạy; Hyrox / Running / Cycling đang "coming soon". Chọn lại ở menu ☰ → "Chọn bộ môn khác". Lựa chọn lưu `localStorage fk_sport`.
- Đã bỏ hiệu ứng mở app (lag). Màn tập toàn màn hình, có nút Quay lại; sheet không có header tự thêm nút Quay lại.
- Chụp món ăn: camera trực tiếp + chọn ảnh thư viện; InBody: chụp hoặc chọn ảnh có sẵn.

## 7. Việc còn treo

- iOS Live Activity / Dynamic Island: chờ tài khoản Apple Developer.
- ~400 bài thư viện chưa có ID YouTube xác minh (đang dùng link tìm kiếm).
- Superset/circuit chưa tách trái/phải.
- Ảnh free-exercise-db chưa được duyệt tận mắt từng bài.
- 3 test đỏ cũ (06-security library.js, 70-people-ai ×2).

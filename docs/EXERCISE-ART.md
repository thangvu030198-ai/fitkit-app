# Hình minh hoạ bài tập — phong cách riêng TapEasy

Mục tiêu: có bộ hình bài tập **của riêng TapEasy**, nhận ra ngay là của app, và **không giống** các thư viện hình bài tập thương mại
(người xám + cơ tô đỏ + nền trắng). Tạo bằng AI **chỉ từ mô tả chữ** — không đưa ảnh/clip của app hay thư viện khác vào AI.

## Bộ quy tắc hình (style bible)

| Thành phần | Quy định |
|---|---|
| Nhân vật | 1 người cách điệu 3D, chất liệu **graphite mờ `#3A4651`** như tượng điêu khắc; mặt không chi tiết, không tóc; trung tính giới tính |
| Cơ đang làm việc | **Phát sáng teal** từ bên trong: lõi `#33D6C9` → viền `#02BCB3`. Không tô đỏ/cam, không vẽ giải phẫu |
| Dụng cụ | Gốm trắng ngà mờ `#E9EEF0`, viền teal mảnh, không nhãn hiệu |
| Nền | Navy đặc `#061A24` (màu nền app) + quầng sáng mờ sau lưng + bóng đổ mềm dưới sàn; không phòng gym, không tường |
| Góc máy | 3/4 chính diện, hơi cao; thấy trọn người và dụng cụ, căn giữa, chừa lề |
| Ánh sáng | Studio mềm + viền sáng lạnh |
| Kỹ thuật | Đúng và an toàn: lưng trung lập, gối theo mũi chân, không khoá khớp |
| Cấm | Chữ, số, mũi tên, logo, watermark; mặt người thật; người khác trong hình; người xám cơ đỏ nền trắng |

Đoạn mô tả phong cách dùng chung nằm cuối mỗi prompt trong `scripts/ai_exercise_prompts.json` — **sửa ở `STYLE` rồi sinh lại cả bộ** để giữ nhất quán.

## Quy trình
1. Actions → **"Media — hình minh hoạ bài tập phong cách TapEasy (AI)"** → Run workflow, ô `ids` ghi vài bài để thử
   (vd `ex-benchpress,ex-squat,ex-pullup,ex-plank,ex-lateralraise,ex-deadlift`).
2. Tải artifact `exercise-ai-review` → xem `contact-XX.jpg`. Người có chuyên môn duyệt **kỹ thuật động tác** từng hình.
3. Đạt → chạy hết (để trống `ids`). Hình hỏng → sửa prompt bài đó, chạy lại với `force = 1` cho đúng id.
4. Gắn vào app: thay `img` của 68 bài trong thư viện lõi bằng `https://tapeasy.app/media/exercise-ai/ex-<mã>.webp` (bài chưa có hình mới giữ hình cũ).

## Chi phí ước tính
68 hình 1024×1024, chất lượng medium ≈ **25.000 ₫** (theo giá ~₫371/hình lần sinh ảnh người AI), cộng ~10–20 % sinh lại hình hỏng.

## Bản quyền
- Prompt chỉ mô tả động tác bằng chữ; không dùng ảnh tham chiếu của bên thứ ba.
- Lưu `index.json` + `_review/log.json` (prompt, model, ngày tạo) làm bằng chứng tự tạo.
- Kiểm tra điều khoản dùng thương mại của nhà cung cấp model ảnh trước khi phát hành.


## Duyệt chuyên môn (17/11/2026)
- 68/68 ảnh đạt sau 2 vòng sửa prompt (front squat, hip thrust, hanging leg raise, leg press, pec deck, Bulgarian split squat, walking, preacher curl).
- 67/68 clip 16:9 đạt. Clip preacher curl chưa đạt sau 3 lần render (model video không dựng được ghế preacher) → ẩn bằng `HOLD_VIDEO` trong exercise-art.js; app dùng ảnh minh hoạ + video nguồn gốc.
- Tiêu chí duyệt: đúng bài & dụng cụ, đúng tư thế/biên độ, đúng nhóm cơ phát sáng, an toàn khớp (lưng trung tính, gối theo mũi chân), dáng người mẫu fitness, không chữ/logo.
- Thêm bài vào HOLD dạng "key" (ẩn mọi bản) hoặc "key@hash" (chỉ ẩn bản lỗi đó).

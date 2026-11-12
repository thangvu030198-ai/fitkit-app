# Vòng phản hồi trong app — `feedback.js`

> 13/11/2026 · Góp ý · NPS · Có gì mới · bảng quản trị "Góp ý & NPS". Kiểm thử: `node tests/run.js --only 74-onboarding`.

## 1. Lối vào
| Lối vào | Hành vi |
|---|---|
| **Hồ sơ → Góp ý & quyền riêng tư** | Thẻ chèn trước thẻ Tài khoản: *Góp ý cho TapEasy*, *Có gì mới*, công tắc *Thống kê sử dụng ẩn danh*, *Xem dữ liệu thống kê trên máy*. |
| **Sau buổi tập** | Khi sheet "Hoàn thành buổi tập" đóng: nếu đủ điều kiện NPS → hỏi NPS; nếu không → nút nổi nhỏ "Buổi tập thế nào? Góp ý" (tự ẩn sau 20 s, có nút ẩn; không dùng cử chỉ lắc máy). |
| **Có gì mới** | Nút "Còn điều gì chưa ổn? Góp ý". |

## 2. Sheet góp ý
- Loại: **Lỗi / Ý tưởng / Nội dung / Khác** (radiogroup; không chọn → "Khác").
- Nội dung 5–2.000 ký tự (đếm ký tự trực tiếp).
- **Ảnh chụp màn hình (tuỳ chọn)**: dùng lại `TapEv.compressImage` (events.js) — JPEG ≤ 250 KB dạng data URL, lưu ngay trong tài liệu góp ý (không cần Storage rules mới). Không có helper → ẩn nút.
- **Cho phép liên hệ lại**: mặc định tắt; bật mới hiện ô email/SĐT (điền sẵn email tài khoản nếu có).
- Tự kèm: phiên bản app, màn hình đang mở, nguồn mở (`trigger`), thiết bị **không định danh** `{ platform, os, screen, lang, theme, mode }` — hiển thị rõ cho người dùng trước khi gửi.

## 3. NPS
- Câu hỏi 0–10 + "Điều gì khiến bạn chấm điểm này?" (không bắt buộc, ≤ 1.000 ký tự).
- **Lịch hỏi** (`FKFeedback.npsDue`): sau **buổi tập hoàn thành thứ 5** (đếm buổi được lưu; người dùng cũ dùng số ngày đã tập) **hoặc** sau **7 ngày** kể từ lần đầu dùng; **tối đa 1 lần / 90 ngày**; bấm "Để sau"/đóng cũng tính là đã hỏi. Mỗi phiên mở app tối đa 1 hộp thoại (Có gì mới ưu tiên trước NPS); không hiện khi đang onboarding / đăng nhập / có sheet khác.
- NPS = %(9–10) − %(0–6) (`FKFeedback.npsSummary`).

## 4. Lưu trữ
| Chế độ | Nơi lưu |
|---|---|
| Firebase | `feedback/{id}` — `cloud.feedback.submit()`. Đã đăng nhập → db chính. Chưa đăng nhập → app Firebase **phụ** `fk-feedback` đăng nhập **ẩn danh** (không đổi phiên chính, persistence NONE). |
| Demo | `localStorage["fitkit_cloud_demo_feedback"]` (máy chủ giả — bảng quản trị demo đọc được). |
| Offline / lỗi mạng | `localStorage["fk_feedback_queue"]` (≤ 20 bản, bỏ bản > 30 ngày) → tự gửi khi có sự kiện `online` / lần mở app sau. |

**Không lưu uid.** Tài liệu:
```
{ kind:"feedback"|"nps", category?, text?, score?, contact?, shot?, appVersion, device{platform,os,screen,lang,theme,mode},
  screen?, trigger?, status:"new", v:1, createdAt:<serverTimestamp> }
```
`firestore.rules → match /feedback/{id}`: **create** khi `signedIn() && notBanned()` + đúng tập khoá (`hasOnly`/`hasAll`), `createdAt == request.time`, `status == 'new'`, `v == 1`, text ≤ 2.000 (feedback ≥ 5), score int 0–10, contact ≤ 120, shot ≤ 250.000 ký tự đúng mẫu data:image/jpeg|webp; **read / update(status)** chỉ `hasPerm('support.tickets')`; **delete: false**.

## 5. Bảng quản trị — Hỗ trợ khách hàng → thẻ "Góp ý & NPS"
`admin.js` §6.9b · thẻ con trong mục **Hỗ trợ khách hàng** (không thêm mục mới vào thanh bên) · quyền `support.tickets` (Chủ sở hữu, Quản trị cấp cao, Quản trị viên, Hỗ trợ).
- KPI: NPS 90 ngày, số Ủng hộ / Trung lập / Phản đối, góp ý mới, NPS toàn thời gian; biểu đồ phân bố 0–10.
- Lọc: Tất cả / Góp ý / NPS · loại · trạng thái (Mới / Đã xem / Đã xử lý). Đánh dấu "Đã xem", "Đã xử lý".
- Liên hệ người dùng chỉ hiện khi có thêm quyền `users.pii`; ảnh chụp chỉ nhận data URL JPEG/WebP.

## 6. "Có gì mới" — đóng vòng phản hồi
- Danh sách `CHANGELOG` trong `feedback.js` (mới nhất trước; `id` = ngày `YYYY-MM-DD`; `fromFeedback:true` → nhãn **Từ góp ý**).
- Người dùng **cũ** cập nhật lên bản có mục mới → hiện 1 lần khi vào Trang chủ; cài **mới** không hiện. Luôn mở lại được ở Hồ sơ.
- Người đã gửi góp ý thấy dòng cảm ơn + số góp ý đã gửi.
- **Quy trình phát hành:** đọc góp ý (bảng quản trị) → sửa → thêm 1 mục vào đầu `CHANGELOG` (đánh dấu `fromFeedback` cho việc sửa theo góp ý) → đánh dấu góp ý "Đã xử lý".

## 7. Việc của chủ app
1. Deploy rules: `firebase deploy --only firestore:rules`.
2. Firebase Console → Authentication → Sign-in method → bật **Anonymous** (để người chưa có tài khoản gửi được góp ý; không bật thì góp ý của họ nằm trong hàng đợi trên máy cho đến khi đăng nhập).
3. (Khuyến nghị) Bật **App Check** cho Firestore để hạn chế spam; đặt cảnh báo ngân sách.
4. Xoá góp ý > 24 tháng (privacy-policy §3e) — ví dụ TTL policy của Firestore trên trường `createdAt` hoặc dọn định kỳ.
5. `functions/` (deleteMyAccount) **không cần** sửa: góp ý không gắn uid. Yêu cầu xoá liên hệ qua email → xoá thủ công trong Console.

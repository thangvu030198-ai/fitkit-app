# R3 — ux (i18n, PWA, auto-fit) — do integrator hoàn tất

Agent `ux` bị ngắt giữa chừng (hết hạn mức); integrator kiểm lại và hoàn tất phần còn dở.

## Đã xong
- **Đổi ngôn ngữ Việt ⇄ Anh**: `i18n.js` (lớp dịch DOM, MutationObserver, đổi qua lại không tải lại trang, không dịch nội dung người dùng nhập), từ điển `i18n-en.js` … `i18n-en-6.js` (≈ 4.130 mục). Nút chọn ngôn ngữ ở màn đăng nhập (góc trên) và Hồ sơ.
- **Độ phủ đo bằng `node scripts/i18n-extract.js`** (14/11): giao diện 56,6 % (shell 92 %, lõi 81 %, đăng nhập/PT cơ bản 77 %, tập luyện 75 %, dinh dưỡng 79 %, cộng đồng 64 %, cửa hàng 55 %, quản trị 54 %, sự kiện 33 %, PT Pro 28 %); nội dung dài (kho kiến thức, công thức) 18 %. Chuỗi chưa có bản dịch hiển thị nguyên tiếng Việt.
- **PWA** (`sw.js` v23): precache từng file với `cache:"reload"`, cache chạy-lúc-dùng có giới hạn, trang ngoại tuyến, dải "Có bản mới — tải lại", dọn cache cũ; manifest thêm icon maskable + shortcut.

## Chưa xong / giới hạn
- Kiểm thử auto-fit trên trình duyệt thật ở nhiều viewport: làm sau khi deploy web (xem báo cáo tổng).
- `scripts/i18n-check.js` chưa viết — dùng `FK_I18N.missing()` trong console để lấy chuỗi còn thiếu.

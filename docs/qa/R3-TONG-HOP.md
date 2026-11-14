# TapEasy — Tổng hợp vòng rà soát R3 (14/11/2026)

Làm theo `quy-trinh-ra-soat-fable-5.2.md`. Báo cáo chi tiết từng mảng: `R3-core.md`, `R3-nutrition.md`, `R3-cloud.md`, `R3-admin.md`, `R3-store.md`, `R3-ux.md`.

## 1. Lỗi tìm thấy theo mức độ

| Mảng | Critical | High | Medium | Low | Đã sửa |
|---|---|---|---|---|---|
| Lõi tập luyện (`app.js`…) | 0 | 5 | 9 | 4 | 17/18 |
| Dinh dưỡng & sức khoẻ | 0 | 3 | 8 | 2 | 13/13 |
| Tài khoản, cloud, bảo mật | 0 | 3 | 6 | 6 | 10 (4 chuyển giao, 1 không sửa) |
| Quản trị, cửa hàng, cộng đồng, sự kiện | 0 | 2 | 6 | 4 | 9 (2 chuyển giao, 1 không sửa) |
| Đóng gói Android / iOS | 1 | 6 | 8 | 8 | 20 (1 chuyển giao, 2 không sửa) |
| **Tổng** | **1** | **19** | **37** | **24** | **69 / 81** |

Lỗi nặng nhất đã sửa: bộ build Android không dựng được với API 36 (Critical); dữ liệu hỏng bị ghi đè mất; hồ sơ sai kiểu làm BMR/TDEE ra NaN; dữ liệu tập không được sao lưu theo tài khoản; sản phẩm mẫu đặt mua được như hàng thật; XSS qua bản sao lưu.

## 2. Kiểm thử

- 39 bộ test, 782 test — xanh toàn bộ trên máy soạn thảo (chạy từng bộ vì giới hạn thời gian).
- Trên GitHub Actions: 780/781 ở lần chạy #57; test còn lại (thiếu `media/shorts/.gitkeep`) đã sửa.
- Trình duyệt thật (Playwright, bản web đang chạy): 14 màn × 6 cỡ màn hình (320×568, 360×640, 390×844, 430×932, 768×1024; tiếng Việt và tiếng Anh ở 320 và 390) — không màn nào tràn ngang. Chưa kiểm: xoay ngang, cỡ chữ hệ thống lớn, bàn phím che ô nhập, máy thật.

## 3. Nâng cấp đã làm

- **Quản trị**: mục Bài đăng cộng đồng (duyệt/ẩn/gỡ/ghim, hàng đợi báo cáo có hạn 24 giờ, từ khoá cấm, cấm đăng 1–30 ngày), Cửa hàng (công tắc mở bán, sản phẩm), Sự kiện, Cài đặt (bật/tắt tính năng, banner toàn app), nhật ký thao tác.
- **Cửa hàng chưa có sản phẩm**: nền mờ + thẻ giữa màn hình "Chưa có sản phẩm nào mở bán", tự biến mất khi admin thêm hàng và bật mở bán.
- **Đổi ngôn ngữ Việt ⇄ Anh**: ≈ 4.130 mục từ điển; độ phủ giao diện 56,6 % (phần chưa dịch hiện tiếng Việt).
- **Tài khoản**: 3 ô đồng ý riêng khi đăng ký, sao lưu dữ liệu theo tài khoản, liên kết tài khoản, quên mật khẩu qua email, xuất dữ liệu, xoá tài khoản; OTP SMS / OTP email đã viết nhưng TẮT (cần gói trả phí).
- **Firebase thật**: project `tapeasy-2ce8f`, Firestore tại Singapore, đăng nhập Email + Google, rules đã xuất bản, tên miền web đã cho phép.
- **Pháp lý**: `docs/LEGAL-VN.md`, `terms.html`, `privacy-policy.html` song ngữ.
- **Store**: workflow Android (AAB ký) / iOS (TestFlight), `docs/RELEASE-CHECKLIST.md`, thư mục `store/` (mô tả, form Data safety, App Privacy, ghi chú reviewer).

## 4. Việc chỉ chủ dự án làm được

Xem `docs/RELEASE-CHECKLIST.md` §E và `docs/LEGAL-VN.md` (cuối file).

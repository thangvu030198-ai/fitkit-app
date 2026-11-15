# Mục "Phân tích" trong Bảng quản trị (15/11/2026)

Quyền xem: `analytics.view` (Chủ sở hữu, Quản trị, Phân tích, Quản lý nội dung/sự kiện/cửa hàng). Xuất CSV: `data.export`.

## Thành phần

| File | Vai trò |
|---|---|
| `pulse.js` | Trên máy người dùng: ghi nhịp "đang mở app" 60 giây/lần và nhãn đếm theo ngày/tuần/tháng |
| `admin-analytics.js` | Mục Phân tích: dựng chỉ số, biểu đồ, nhận định, xuất CSV |
| `functions/analytics.js` | Hàm `adminAnalytics`: đếm số thiết bị mang từng nhãn (không đọc từng tài liệu) |
| `firestore.rules` | `presence/{vid}`, `activity/{id}`: khoá hình dạng; không ai đọc từng tài liệu |

## Chỉ số

- **Đang trực tuyến**: thiết bị có nhịp trong 150 giây gần nhất; chia theo nền tảng, màn hình, khách / đã đăng nhập.
- **Hoạt động hôm nay / tuần / tháng**: số thiết bị có mở app (tuần tính từ thứ Hai, tháng theo lịch, giờ Việt Nam).
- **Độ gắn bó**: trung bình người dùng/ngày của 7 ngày trọn gần nhất ÷ người dùng tháng (trước ngày 7 dùng tháng trước).
- **Giữ chân ngày 1 / 7 / 30**: tỉ lệ người mới mở lại app đúng N ngày sau ngày đầu, tính trên 7 nhóm gần nhất đã qua trọn ngày đó.
- **Phễu kích hoạt**: người mới 7 ngày → hoàn tất khảo sát → bắt đầu buổi tập (trong ngày đầu); tạo tài khoản đếm riêng.
- **Tính năng được dùng**: số lượt người dùng/ngày có chạm tính năng trong 7 ngày.
- **Nguồn người mới**: `?utm_source=` hoặc trang giới thiệu ở lần mở đầu tiên.

## Giới hạn cần biết

- Đếm theo **thiết bị**, không theo người: một người dùng hai máy được đếm là hai; xoá dữ liệu trình duyệt là thành người mới.
- Người từ chối thống kê hoặc bật Do Not Track / Global Privacy Control **không được đếm** → số thực tế cao hơn số hiển thị.
- Dữ liệu chỉ có từ ngày bản app chứa `pulse.js` được phát hành; không có số liệu quá khứ.
- Khách chưa đăng nhập cũng ghi được nên rules không chặn được việc ai đó cố tình tạo số liệu giả. Khi có lưu lượng thật nên bật **Firebase App Check**.
- Chi phí: mỗi người đang mở app ≈ 1 lượt ghi Firestore/phút; mỗi lần mở mục Phân tích ≈ 280 truy vấn đếm (kết quả được giữ 5 phút).
- Tắt hẳn: `FK_FEATURES.metrics = false` trong `firebase-config.js`.

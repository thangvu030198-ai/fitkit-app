# VIỆC ĐANG CHỜ — iOS Live Activity / Dynamic Island (Giai đoạn 3, phần iPhone)

Ghi ngày 19/11/2026. Chủ app (anh Thắng) **chưa có tài khoản Apple Developer**, dự kiến được cấp khoảng 20–21/11/2026.
Khi có tài khoản → làm tiếp mục này TRƯỚC khi sang việc khác.

## Đã xong (Android, v57)
- `session-live.js`: thẻ "Đang tập" im lặng trên thanh thông báo / màn hình khoá Android (id 901, kênh `fk-session` mức thấp).
- iOS cố ý không dùng thông báo thường (mỗi lần cập nhật đều kêu) → chờ Live Activity.

## Việc chủ app phải tự làm (Claude chỉ hướng dẫn, không đăng nhập / nhập khoá hộ)
1. Apple Developer → Identifiers → tạo App ID mới: `vn.thangvu.fitkit.LiveActivity` (loại App, không cần capability đặc biệt).
2. App ID chính `vn.thangvu.fitkit`: không cần đổi (Live Activity không cần push/App Group ở bản đầu — cập nhật cục bộ từ app).
3. Profiles → tạo provisioning profile **App Store** cho `vn.thangvu.fitkit.LiveActivity`, tải file `.mobileprovision`.
4. GitHub repo → Settings → Secrets → thêm `IOS_LA_PROFILE_BASE64` (base64 của file profile) + `IOS_LA_PROFILE_NAME` (tên profile).

## Việc Claude làm sau khi có các bước trên
- Widget Extension (SwiftUI + ActivityKit): màn hình khoá + Dynamic Island (compact / expanded / minimal):
  tên bài, "Hiệp n/N", kg × lần tiếp theo, đồng hồ đếm ngược giờ nghỉ (`Text(timerInterval:)` — tự chạy, không cần app thức).
- Plugin Capacitor nhỏ `FKLiveActivity` (start / update / end) gọi từ `session-live.js` (nhánh iOS): bắt đầu khi vào buổi,
  cập nhật mỗi lần xong hiệp / bắt đầu nghỉ, kết thúc khi xong buổi hoặc thoát.
- `Info.plist` app: `NSSupportsLiveActivities = YES`.
- `scripts/native-ios-xcodeproj.rb`: thêm target extension, nhúng vào app (Embed App Extensions), ký tay bằng profile mới.
- Sửa `ios-appstore.yml` nhận 2 secret mới; build TestFlight; test trên máy thật (iOS 16.1+, Dynamic Island: iPhone 14 Pro trở lên).

## Sau đó: Giai đoạn 4 (đề xuất trước)
Link video YouTube hướng dẫn · bản đồ phục hồi cơ · nhiều phòng gym (bước tạ riêng) · giãn cơ có hẹn giờ · "Top x%".

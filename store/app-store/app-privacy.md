# App Store — App Privacy (“nutrition labels”) trả lời sẵn

App Store Connect → app → **App Privacy → Get Started**. Bảng gốc kèm lý do: `docs/STORE-COMPLIANCE.md` §1. Phải khớp `PrivacyInfo.xcprivacy` trong bản build (`store/native/ios/PrivacyInfo.xcprivacy`).

**Privacy Policy URL:** `https://thangvu030198-ai.github.io/fitkit-app/privacy-policy.html`
**Do you or your third-party partners collect data from this app?** → **Yes, we collect data from this app**

Với mỗi loại bên dưới: *Used for tracking?* → **No** (app không quảng cáo, không chia sẻ dữ liệu cho bên môi giới dữ liệu, không ghép dữ liệu với app/website khác ⇒ **không cần App Tracking Transparency**, bản build không có `NSUserTrackingUsageDescription`, `NSPrivacyTracking = false`).

| Nhóm → loại (tick) | Mục đích | Linked to the user’s identity? |
|---|---|---|
| Contact Info → **Name** | App Functionality | Yes |
| Contact Info → **Email Address** | App Functionality | Yes |
| Contact Info → **Phone Number** | App Functionality | Yes |
| Contact Info → **Physical Address** (giao hàng) | App Functionality | Yes |
| Health & Fitness → **Health** (PAR-Q/số đo khi học viên chia sẻ với PT) | App Functionality | Yes |
| Health & Fitness → **Fitness** | App Functionality | Yes |
| Purchases → **Purchase History** (đơn hàng vật lý, voucher, điểm) | App Functionality | Yes |
| User Content → **Emails or Text Messages** (chat PT ↔ học viên) | App Functionality | Yes |
| User Content → **Photos or Videos** | App Functionality | Yes |
| User Content → **Customer Support** | App Functionality | Yes |
| User Content → **Other User Content** (routine, đánh giá, bình luận, góp ý) | App Functionality | Yes |
| Identifiers → **User ID** (Firebase UID) | App Functionality | Yes |
| Usage Data → **Product Interaction** (chỉ khi người dùng bật thống kê ẩn danh) | Analytics | **No** |

**KHÔNG tick:** Financial Info (Payment Info, Credit Info) · Location (Precise/Coarse) · Sensitive Info · Contacts · Browsing History · Search History · Identifiers → Device ID (chưa bật push FCM; bật thì tick, App Functionality, Linked) · Usage Data → Advertising Data · Diagnostics (chưa dùng Crashlytics) · Surroundings · Body · Other Data.

Ghi chú để trả lời đúng: dữ liệu **chỉ lưu trên máy** (cân nặng, nhật ký ăn/ngủ, ảnh tiến trình chưa chia sẻ) không tính là “collected”. Ảnh gửi cho dịch vụ AI bằng API key của chính người dùng đi thẳng từ máy tới nhà cung cấp họ chọn — nhà phát triển không nhận.

## Khai báo khác trong App Store Connect

| Mục | Trả lời |
|---|---|
| **Export compliance** | Bản build có `ITSAppUsesNonExemptEncryption = false` → không bị hỏi mỗi lần upload. (App chỉ dùng HTTPS/TLS của hệ điều hành.) |
| **Content Rights** | *Does your app contain, show, or access third-party content?* **Yes** → *have all necessary rights* **Yes** (free-exercise-db: Public Domain; video Pexels/Pixabay/wger/YMove theo giấy phép, có ghi nguồn trong app → màn “Nguồn dữ liệu & bản quyền”). |
| **Age Rating** (bảng câu hỏi mới 2025) | Mọi mục bạo lực/tình dục/cờ bạc/chất kích thích: **None**. *Medical or Treatment Information*: **Infrequent/Mild** (thông tin sức khoẻ – thể hình chung). *Health or Wellness Topics*: **Yes**. *User-Generated Content*: **Yes**. *Messaging and Chat*: **Yes**. *Advertising*: **No**. *Parental controls / Age assurance*: No. Kết quả dự kiến 13+ (hoặc 12+ theo thang cũ). Không chọn Kids Category. |
| **Sign-in required** | Tick, điền tài khoản demo (xem `review-notes-en.md`) |
| **Pricing / Availability** | Free · chọn quốc gia: Việt Nam trước (và các nước khác nếu muốn) |
| **Digital Services Act (EU)** | Nếu phát hành ở EU: khai trạng thái trader. Chỉ phát hành ở Việt Nam thì bỏ chọn các nước EU để khỏi phải khai. |
| **App Category** | Primary **Health & Fitness** · Secondary **Food & Drink** |
| **iPad** | Bản build chỉ iPhone (`TARGETED_DEVICE_FAMILY = 1`) → không cần ảnh iPad. Reviewer vẫn có thể mở trên iPad ở chế độ iPhone — app phải dùng được ở đó. |

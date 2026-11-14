# Google Play — Data safety (trả lời sẵn)

Play Console → **Policy and programs → App content → Data safety → Start**. Bảng đầy đủ kèm lý do: `docs/STORE-COMPLIANCE.md` §2.2.
Nguyên tắc: chỉ khai dữ liệu **rời khỏi máy** (gửi lên Firebase của TapEasy). Dữ liệu chỉ nằm trên máy (hồ sơ cơ thể, nhật ký tập/ăn/ngủ, ảnh tiến trình chưa chia sẻ, InBody, sàng lọc sức khoẻ chưa chia sẻ) **không khai**.

## Bước 1 — Data collection and security

| Câu hỏi | Trả lời |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Which of the following methods of account creation does your app support? | **Username and password** + **OAuth** (Google, Apple) |
| Delete account URL | `https://thangvu030198-ai.github.io/fitkit-app/delete-account.html` |
| Do you provide a way for users to request that some or all of their data is deleted, without requiring them to delete their account? | **Yes** — cùng URL trên (mục “Xoá một phần dữ liệu”) |
| Has your app successfully completed an independent security review (MASA)? | No (không bắt buộc) |
| Committed to follow the Play Families Policy? | Không áp dụng — không nhắm trẻ em |

## Bước 2 — Data types (tick đúng các ô sau; mọi ô khác để trống)

Với **mọi** dòng: *Collected* = Yes · *Shared* = **No** (Firebase/Google Cloud là bên xử lý thay mặt nhà phát triển; gửi cho PT/đăng công khai là hành động do người dùng chủ động) · *Processed ephemerally* = No · *Required or optional* = **Optional** (dùng app không cần tài khoản).

| Nhóm | Loại | Mục đích (tick) |
|---|---|---|
| Personal info | **Name** | App functionality, Account management |
| Personal info | **Email address** | App functionality, Account management |
| Personal info | **User IDs** | App functionality, Account management |
| Personal info | **Address** (địa chỉ giao hàng, nhận quà) | App functionality |
| Personal info | **Phone number** (PT, đơn hàng, đăng ký sự kiện, liên hệ khẩn cấp) | App functionality |
| Personal info | **Other info** (hồ sơ PT: chuyên môn, khu vực, giá) | App functionality |
| Financial info | **Purchase history** (đơn hàng, voucher, điểm) | App functionality |
| Health and fitness | **Health info** (PAR-Q/số đo khi học viên chia sẻ với PT) | App functionality |
| Health and fitness | **Fitness info** (bài giao, kết quả buổi, thi đua) | App functionality |
| Messages | **Other in-app messages** (chat PT ↔ học viên) | App functionality |
| Photos and videos | **Photos** | App functionality |
| Photos and videos | **Videos** (clip Khoảnh khắc sự kiện) | App functionality |
| App activity | **App interactions** (chỉ khi người dùng bật “Thống kê sử dụng ẩn danh”) | Analytics |
| App activity | **Other user-generated content** (routine, đánh giá, bình luận, góp ý/NPS) | App functionality, Analytics |

**KHÔNG tick:** Location (approximate/precise) · Financial info → User payment info / Credit score / Other financial info (app không thu số thẻ/tài khoản — chuyển khoản do người dùng tự làm trong app ngân hàng) · Contacts · Calendar · Audio files / Voice or sound recordings / Music · Files and docs · Web browsing · App info and performance (Crash logs, Diagnostics — chưa dùng Crashlytics) · **Device or other IDs** (chưa bật thông báo đẩy FCM; bật thì tick thêm, mục đích App functionality).

## Bước 3 — câu hỏi kèm theo

| Câu hỏi | Trả lời |
|---|---|
| Advertising ID (App content → Advertising ID): Does your app use advertising ID? | **No** (bản build đã gỡ quyền `AD_ID`; workflow soát lại sau khi build) |
| Data deletion — dữ liệu nào được giữ lại sau khi xoá tài khoản? | Đơn hàng/quà tặng giữ dạng **ẩn danh** (bỏ tên, SĐT, địa chỉ) tối đa 10 năm theo luật kế toán; bản sao lưu hệ thống ≤ 30 ngày. Ghi đúng như `privacy-policy.html` §9–10 |

> Sai lệch giữa form này với hành vi thật của app là lý do gỡ app phổ biến. Thêm SDK mới (Crashlytics, FCM, quảng cáo…) → cập nhật form **trước** khi phát hành.

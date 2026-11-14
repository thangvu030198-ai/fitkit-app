# Hướng dẫn: Build file .ipa miễn phí cho TapEasy (không cần Mac) rồi cài lên iPhone qua AltStore

Tài liệu này dành cho máy tính **Windows**. Toàn bộ quy trình hoàn toàn miễn phí, không cần tài khoản Apple Developer (99 USD/năm).

> Đây là đường **cài thử miễn phí**. Nộp App Store thật (TestFlight, cần Apple Developer 99 USD/năm): xem `docs/RELEASE-CHECKLIST.md` §E bước 5–6 và workflow `ios-appstore.yml`. Bản thử chưa ký không có *Sign in with Apple* (Apple ID miễn phí không ký được capability này) — đăng nhập email vẫn dùng được.

Có 3 phần: (1) build file `.ipa` bằng GitHub Actions, (2) cài AltStore lên iPhone bằng máy tính Windows, (3) cài FitKit qua AltStore.

---

## Phần 1 — Build file .ipa bằng GitHub (không cần Mac)

### Bước 1.1 — Tạo tài khoản GitHub (nếu chưa có)
Vào [github.com](https://github.com) → Sign up, miễn phí.

### Bước 1.2 — Tạo repository mới
1. Bấm nút **"+"** góc trên phải → **New repository**.
2. Đặt tên (VD: `fitkit-app`).
3. Chọn **Public** (bắt buộc để chạy GitHub Actions trên máy ảo macOS hoàn toàn miễn phí, không giới hạn số phút). Vì `GOOGLE_DRIVE_CLIENT_ID` không phải thông tin bí mật (Client ID vốn được thiết kế để lộ ra ngoài công khai trong app), để Public là an toàn.
4. Bấm **Create repository**.

### Bước 1.3 — Đẩy (upload) toàn bộ thư mục FitKit lên repo đó
Cách dễ nhất nếu không quen dòng lệnh Git:
1. Trên trang repo vừa tạo, bấm **"uploading an existing file"**.
2. Kéo thả TOÀN BỘ nội dung bên trong thư mục `FitKit` (bao gồm cả thư mục ẩn `.github`) vào khung tải lên.
   - Lưu ý: GitHub web upload đôi khi không nhận thư mục `.github` khi kéo-thả trực tiếp. Nếu vậy, hãy dùng **GitHub Desktop** (app miễn phí, [desktop.github.com](https://desktop.github.com)) — cài vào, đăng nhập, chọn "Add local repository" trỏ tới thư mục FitKit, rồi bấm "Publish repository". Cách này đẩy được toàn bộ file kể cả thư mục ẩn, và dễ đẩy lại mỗi khi có bản code mới.
3. Bấm **Commit changes**.

### Bước 1.4 — Chạy build
1. Vào tab **Actions** trên repo.
2. Chọn workflow **"iOS — bản thử (unsigned .ipa cho AltStore)"** ở cột trái (file `.github/workflows/build-ios.yml`).
3. Bấm **Run workflow** → **Run workflow** (nút màu xanh).
4. Đợi khoảng 5–15 phút (máy ảo macOS của GitHub tự cài Capacitor, tạo project Xcode, build, đóng gói).
5. Nếu dòng chữ chuyển xanh + dấu tick ✅ là build thành công.

### Bước 1.5 — Tải file .ipa về
1. Bấm vào lần chạy vừa xong (dòng có dấu tick xanh).
2. Kéo xuống mục **Artifacts**, bấm tải **FitKit-ipa** (file `.zip` chứa file `.ipa` bên trong, giải nén ra là có `FitKit-unsigned.ipa`).

> Nếu build báo lỗi đỏ ❌: bấm vào để xem log chi tiết, copy đoạn lỗi gửi lại cho mình, mình sẽ chỉnh lại file workflow cho khớp (vì mình không có máy Mac để tự chạy thử trước, nên có thể cần chỉnh 1-2 lần đầu).

---

## Phần 2 — Cài AltServer + AltStore lên iPhone (làm 1 lần)

### Bước 2.1 — Cài driver USB cho iPhone
Cài **iTunes** từ trang chủ Apple (không phải bản Microsoft Store) HOẶC cài riêng **Apple Devices** từ Microsoft Store — cái nào cũng được, mục đích là để Windows nhận diện iPhone qua cáp USB.

### Bước 2.2 — Cài AltServer
1. Tải AltServer cho Windows tại [altstore.io](https://altstore.io).
2. Cài đặt và chạy — AltServer sẽ nằm ở khay hệ thống (system tray) cạnh đồng hồ Windows.

### Bước 2.3 — Cài AltStore lên iPhone
1. Cắm iPhone vào máy tính bằng cáp, mở khoá máy, bấm **Trust** khi điện thoại hỏi "Trust This Computer?".
2. Bấm chuột phải vào icon AltServer ở khay hệ thống → **Install AltStore** → chọn tên iPhone của bạn.
3. AltServer sẽ hỏi **Apple ID và mật khẩu** — đây là bước bạn tự nhập trực tiếp vào cửa sổ chính thức của AltServer trên máy bạn (không qua mình, không qua trang web nào khác). Nếu tài khoản bật xác thực 2 lớp, có thể cần tạo **App-Specific Password** tại [appleid.apple.com](https://appleid.apple.com) → Đăng nhập & bảo mật → Mật khẩu dành riêng cho ứng dụng.
4. Đợi 1-2 phút, icon **AltStore** sẽ tự xuất hiện trên màn hình chính iPhone.

### Bước 2.4 — Tin cậy (Trust) AltStore trên iPhone
1. Vào **Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị** (VPN & Device Management).
2. Bấm vào email Apple ID của bạn trong mục "Nhà phát triển đáng tin cậy" → **Trust**.
3. Mở app AltStore, đăng nhập lại bằng Apple ID nếu được hỏi.

---

## Phần 3 — Cài TapEasy qua AltStore

1. Chuyển file `FitKit-unsigned.ipa` vào iPhone — cách dễ nhất: gửi qua Zalo/Google Drive/AirDrop rồi tải về mục **Files** (Tệp) trên iPhone.
2. Trong app **Files**, bấm giữ vào file `.ipa` → **Share** (Chia sẻ) → chọn **AltStore**.
3. AltStore sẽ tự ký lại bằng Apple ID của bạn rồi cài đặt — chờ thanh tiến trình chạy xong.
4. Vào lại **Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị**, bấm Trust cho app TapEasy (tương tự bước 2.4, lần này là cho chính app TapEasy).
5. Mở app **TapEasy** từ màn hình chính — dùng như app thật, có icon riêng, không qua trình duyệt.

---

## Duy trì hàng tuần (giới hạn từ Apple, không tránh được nếu dùng miễn phí)

Apple ID miễn phí chỉ ký ứng dụng sống được **7 ngày**. Sau 7 ngày, mở app AltStore lên, vào tab **My Apps**, bấm **Refresh All** — cần iPhone cùng mạng Wi-Fi với máy tính đang chạy AltServer (hoặc bật tính năng "Background Refresh" trong AltStore để nó tự làm khi cắm sạc + có Wi-Fi). Nếu quá 7 ngày mà chưa refresh, app sẽ ngừng mở được, chỉ cần refresh lại là dùng tiếp bình thường, dữ liệu không mất.

---

## Khi có bản code TapEasy mới

Lặp lại từ Bước 1.3 (đẩy code mới lên GitHub) → Bước 1.4 (chạy lại Actions) → Bước 1.5 (tải .ipa mới) → Bước 3 (cài đè qua AltStore).

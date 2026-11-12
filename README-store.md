# TapEasy v2 — Hướng dẫn bật máy chủ & đưa app lên App Store / Google Play

> App đổi tên từ **FIT KIT** thành **TapEasy** (11/2026). Chỉ đổi tên hiển thị, logo, icon: Bundle ID / package `vn.thangvu.fitkit`, tên repo `fitkit-app`, tên file build `FitKit-*.apk/.aab/.ipa` và alias khoá ký `fitkit` **giữ nguyên** (đổi các thứ này = app mới, mất người dùng cũ). Hướng dẫn thương hiệu: `docs/BRAND.md`.

## 0. Bản v2 có gì

- **Đăng nhập / Đăng ký / Chọn vai trò** (Tập cá nhân · Tôi có PT · Tôi là PT · Tìm & Book PT *sắp ra mắt*). Vẫn có nút "Dùng ngay, không cần tài khoản" cho tập cá nhân. Apple yêu cầu điều này: tính năng không cần tài khoản thì không được bắt đăng nhập.
- **Trang chủ mới**: buổi hôm nay, buổi với PT, calo/nước/giấc ngủ, nhắc nhở tiếp theo, 3 lối vào chính.
- **Khu PT**: thêm học viên → app tạo **mã mời 6 ký tự** → học viên nhập mã là kết nối.
- **Form PT ↔ Học viên 7 mục**: Thông tin · Buổi này tập gì · Thời khoá biểu (lặp hằng tuần) · Lịch sử · Nhắc nhở · Ghi chú/Phản hồi (dạng chat) · Tiến độ (chuyên cần, gói buổi, biểu đồ 8 tuần).
- **Thư viện 800+ bài tập** (free-exercise-db, Public Domain), dùng được ở cả giáo án cá nhân lẫn khi PT giao bài.
- **Thông báo native**: trên điện thoại, nhắc nhở do hệ điều hành gửi, nên vẫn nhắc khi app đã đóng.
- **Đủ yêu cầu của store**: xoá tài khoản trong app, chính sách bảo mật, trang nguồn dữ liệu & bản quyền.
- Giữ nguyên toàn bộ tính năng cũ: dinh dưỡng + AI tính calo, giấc ngủ, ảnh tiến trình, InBody.

**Chế độ thử nghiệm (demo):** khi `firebase-config.js` còn để trống, tài khoản và dữ liệu PT/học viên chỉ lưu trên máy đang dùng. Muốn thử luồng PT ↔ học viên thì đăng ký tài khoản PT, thêm học viên, đăng xuất, rồi đăng ký tài khoản học viên và nhập mã. Muốn 2 điện thoại thấy cùng dữ liệu thì làm tiếp mục 1.

---

## 1. Bật máy chủ Firebase (miễn phí, ~15 phút)

1. Vào https://console.firebase.google.com → **Create a project** → đặt tên `fitkit`. Có thể tắt Google Analytics.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. **Build → Firestore Database → Create database** → chọn vị trí `asia-southeast1 (Singapore)` → **Start in production mode**.
4. Trong Firestore, mở tab **Rules**, xoá hết rồi dán toàn bộ nội dung file `firestore.rules`, bấm **Publish**.
5. **Project settings (bánh răng) → General → Your apps → biểu tượng `</>` (Web)** → đặt tên `fitkit-web` → Register. Firebase hiện một đoạn `firebaseConfig = { apiKey: ..., ... }`.
6. Copy 6 giá trị đó vào file `firebase-config.js` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
7. **Authentication → Settings → Authorized domains**: thêm `localhost` (thường đã có sẵn) và tên miền GitHub Pages của bạn nếu có chạy bản web.

Gói miễn phí (Spark) đủ cho vài nghìn người dùng: 50.000 lượt đọc và 20.000 lượt ghi mỗi ngày.

---

## 1b. Bật nguồn video minh hoạ (Pexels / Pixabay — miễn phí, dùng thương mại)

Theo tài liệu tổng hợp (mục 4B), app tìm video tập luyện từ **Pexels** và **Pixabay**:
1. **Pixabay (khuyên dùng):** https://pixabay.com/api/docs/ → đăng nhập/đăng ký → copy **key** trong mục Parameters.
2. Pexels: https://www.pexels.com/api/ — hiện (11/2026) Pexels **tạm dừng cấp key mới**; chỉ dùng nếu đã có key cũ.
3. Dán vào file `media-config.js` (`pexelsKey`, `pixabayKey`) rồi đẩy lên GitHub → mọi người dùng đều tìm được video.
   (Hoặc thử nhanh: trong app → Hồ sơ → **Nguồn video minh hoạ** → dán key, chỉ lưu trên máy đó.)

Video dùng ở: chi tiết bài tập & khi đang tập (nút **Tìm video mẫu**), trình soạn buổi của PT (nút **Tìm** cạnh mỗi bài — học viên xem video ngay trong app), thư viện 800+ bài (**Xem video minh hoạ**), và **video nền màn mở app** (tự tìm video dọc "gym workout"; muốn dùng clip riêng thì dán link .mp4 vào `welcomeVideo`). Tên tác giả + nguồn luôn hiện dưới video (điều kiện của Pexels/Pixabay).

## 1c. Đăng nhập Google / Facebook

Nút "Tiếp tục với Google / Facebook" đã có trên màn Đăng nhập & Đăng ký. Khi chưa có Firebase, app chạy chế độ demo (giả lập tài khoản). Để chạy thật:

**Google (≈5 phút)**
1. Firebase Console → Authentication → Sign-in method → **Google** → Enable → chọn email hỗ trợ → Save.
2. Authentication → Settings → **Authorized domains**: thêm tên miền web của app (VD `thangvu030198-ai.github.io`).

**Facebook (≈15 phút)**
1. Vào developers.facebook.com → My Apps → Create App → loại "Consumer" (hoặc "Authenticate and request data from users with Facebook Login").
2. Lấy **App ID** và **App Secret** (Settings → Basic).
3. Firebase → Authentication → Sign-in method → **Facebook** → Enable → dán App ID + App Secret → copy **OAuth redirect URI** Firebase đưa.
4. Facebook App → Facebook Login → Settings → dán URI đó vào "Valid OAuth Redirect URIs" → Save.
5. Điền Privacy Policy URL (link mục 5) và chuyển app sang chế độ **Live**.

**Trong app iOS / Android (bản cài từ store)**
Trên web dùng cửa sổ popup; trong app native cần plugin đăng nhập gốc (Google/Apple chặn đăng nhập trong WebView):
```
npm i @capacitor-firebase/authentication@^6 firebase
npx cap sync
```
- Android: tải `google-services.json` (Firebase → Project settings → app Android `vn.thangvu.fitkit`, nhớ thêm SHA-1 của keystore) đặt vào `android/app/`; thêm `facebook_app_id` + `facebook_client_token` vào `android/app/src/main/res/values/strings.xml`.
- iOS: tải `GoogleService-Info.plist` vào `ios/App/App/`; thêm URL Scheme `REVERSED_CLIENT_ID` và `fb<APP_ID>` trong Info.plist.
- `capacitor.config.json` → `"plugins": { "FirebaseAuthentication": { "skipNativeAuth": true, "providers": ["google.com", "facebook.com"] } }`
Code app (`cloud.js`) đã tự nhận plugin này; chưa cài thì nút báo "chưa cấu hình" thay vì lỗi.

**Apple (bắt buộc cho App Store — Guideline 4.8, nút đã có sẵn)**
1. developer.apple.com → Certificates, IDs & Profiles → App ID `vn.thangvu.fitkit` → bật **Sign In with Apple**.
2. Tạo **Services ID** (VD `vn.thangvu.fitkit.web`) → bật Sign In with Apple → Return URL = OAuth redirect URI mà Firebase đưa.
3. Tạo **Key** có quyền Sign In with Apple → tải file .p8, ghi Key ID + Team ID.
4. Firebase → Authentication → Sign-in method → **Apple** → Enable → điền Services ID, Team ID, Key ID, nội dung .p8.
5. App iOS: Xcode → Signing & Capabilities → + **Sign In with Apple**. Plugin `@capacitor-firebase/authentication` thêm `"apple.com"` vào `providers`.

## 2. Đẩy code lên GitHub

Repo `thangvu030198-ai/fitkit-app` → **Add file → Upload files** → kéo thả toàn bộ nội dung thư mục `FitKit` (kể cả thư mục `assets`, `scripts`, `.github`) → **Commit**. File trùng tên sẽ được thay bằng bản mới.

Mỗi lần commit, 2 workflow tự chạy (xem tab **Actions**):

| Workflow | Kết quả | Dùng để |
|---|---|---|
| Android — APK thử + AAB | `FitKit-debug.apk` (+ `FitKit-release.aab` nếu có khoá ký) | Cài thử trên Android, nộp Google Play |
| iOS — bản thử (unsigned) | `FitKit-unsigned.ipa` | Cài thử qua AltStore như trước |

> Mã định danh app đã đổi thành `vn.thangvu.fitkit` (bản cũ `com.fitkit.app` gần như chắc chắn đã có người dùng trên store). Vì vậy bản v2 cài lên iPhone sẽ là **một app mới**, không đè lên bản cũ. Dữ liệu tập của bản cũ nằm trong app cũ.

**Cài thử Android:** tải artifact `FitKit-android` → giải nén → gửi `FitKit-debug.apk` sang điện thoại → mở file → cho phép "Cài từ nguồn không xác định".

---

## 3. Google Play (phí 25 USD, trả 1 lần)

1. Đăng ký tại https://play.google.com/console (cần giấy tờ tuỳ thân, xác minh mất vài ngày).
2. **Tạo khoá ký app**, chỉ làm 1 lần. Giữ file này cẩn thận, mất là không cập nhật app được nữa. Trên máy có cài Java, chạy:
   ```
   keytool -genkey -v -keystore fitkit-release.keystore -alias fitkit -keyalg RSA -keysize 2048 -validity 10000
   ```
   Chuyển file sang base64 (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("fitkit-release.keystore")) | Set-Clipboard`
3. Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**, thêm 4 secret:
   `ANDROID_KEYSTORE_BASE64` (nội dung vừa copy), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (= `fitkit`), `ANDROID_KEY_PASSWORD`.
4. Chạy lại workflow Android để có `FitKit-release.aab`.
5. Trong Play Console: **Create app** → điền thông tin → **Testing → Closed testing** → upload file `.aab`.
   - Tài khoản cá nhân mới: Google yêu cầu chạy **thử nghiệm kín với ít nhất 12 người trong 14 ngày** trước khi được phát hành công khai. Hãy kiểm tra lại yêu cầu hiện tại trong Play Console, vì chính sách này có thể thay đổi.
6. Các mục bắt buộc: Privacy policy URL (xem mục 5), **Data safety** (xem mục 6), Content rating, Target audience (18+ hoặc 13+), ảnh chụp màn hình, mô tả.

---

## 3b. Icon & màn hình chờ (tự tạo khi build)

Workflow Android/iOS chạy `npm run assets` (`@capacitor/assets`), đọc đúng các file sau trong `assets/` — **giữ nguyên tên**:

| File | Kích thước | Dùng cho |
|---|---|---|
| `icon-only.png` | 1024 × 1024, không trong suốt | icon iOS + icon Android cũ |
| `icon-foreground.png` + `icon-background.png` | 1024 × 1024 | icon thích ứng Android (biểu tượng trắng trong vùng an toàn 66/108 + nền gradient teal) |
| `splash.png` / `splash-dark.png` | 2732 × 2732 | màn chờ chế độ sáng / tối (logo TapEasy giữa màn) |

Icon store: `assets/icon-1024.png` (App Store 1024, không alpha) và `assets/icon-512.png` (Google Play 512). Muốn vẽ lại sau khi chỉnh logo: `python3 scripts/gen_icons.py` (chỉ cần Pillow + numpy).

## 4. App Store (phí 99 USD/năm)

1. Đăng ký **Apple Developer Program** tại https://developer.apple.com/programs. Xét duyệt mất 1–2 ngày.
2. https://developer.apple.com/account → **Identifiers → +** → App IDs → Bundle ID `vn.thangvu.fitkit`.
3. https://appstoreconnect.apple.com → **My Apps → + New App** → chọn Bundle ID trên, tên `TapEasy: Tập Gym, Calo & PT` (27/30 ký tự). Nếu tên đã có người dùng, thử "TapEasy – Giáo án Gym & PT" (xem `docs/STORE-LISTING.md` mục 1).
4. **Users and Access → Integrations → App Store Connect API → +** → quyền **Admin** → tải file `AuthKey_XXXX.p8` (chỉ tải được 1 lần). Ghi lại **Key ID** và **Issuer ID**.
5. Thêm secret vào GitHub: `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_P8` (nội dung file .p8 chuyển base64 như bước Android), `APPLE_TEAM_ID` (Membership → Team ID).
6. Tab **Actions → "iOS — bản nộp App Store (TestFlight)" → Run workflow**. Bản build sẽ lên TestFlight sau ~15–30 phút. *Workflow này chưa chạy thử được vì cần tài khoản thật. Nếu báo lỗi, gửi log cho mình chỉnh.*
7. Trong App Store Connect: điền mô tả, ảnh chụp màn hình (iPhone 6.7" và 6.5"), Privacy Policy URL, **App Privacy** (mục 6). Ở mục **App Review Information → Sign-in required**, cung cấp 1 tài khoản demo (ví dụ một tài khoản PT có sẵn 1 học viên mẫu) để người duyệt đăng nhập được.
8. **Submit for Review**, thường được duyệt trong 1–3 ngày.

> Rủi ro bị từ chối: Apple có điều khoản 4.2 "chức năng tối thiểu" dành cho app chỉ bọc lại trang web. TapEasy có thông báo native, chia sẻ, chạy offline và dữ liệu riêng nên khả năng qua được là khá. Nếu bị từ chối, đọc lý do rồi gửi cho mình để bổ sung.

---

## 5. Link chính sách bảo mật (store bắt buộc)

**Link xoá tài khoản (Google Play bắt buộc — mục Data safety → "Delete account URL"):**
`https://<tên-miền-của-bạn>/delete-account.html` (file `delete-account.html` đã có trong repo; bật GitHub Pages hoặc Firebase Hosting để có link). Trang cho phép đăng nhập rồi xoá vĩnh viễn tài khoản + dữ liệu, và hướng dẫn xoá trong app.

File `privacy-policy.html` đã có sẵn. Cách lấy link miễn phí: repo GitHub → **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**. Link sẽ là:
`https://thangvu030198-ai.github.io/fitkit-app/privacy-policy.html`

Email liên hệ trong file đang là email của bạn. Có thể đổi sang email hỗ trợ riêng trước khi nộp.

---

## 6. Gợi ý trả lời "Data safety" (Google) / "App Privacy" (Apple)

- **Thu thập:** Email, Tên (để tạo tài khoản, chức năng app). Nội dung do người dùng tạo: ghi chú, lịch tập (chức năng app). Số điện thoại: chỉ khi PT tự nhập cho học viên.
- **Không** dùng cho quảng cáo, **không** bán, **không** theo dõi người dùng (tracking: No).
- **Thống kê sử dụng ẩn danh (13/11/2026):** tuỳ chọn, mặc định tắt, chỉ khi người dùng đồng ý → khai "App interactions / Product Interaction — Analytics, không liên kết danh tính" (chi tiết: docs/STORE-COMPLIANCE.md, docs/ANALYTICS.md).
- **Góp ý & NPS trong app:** khai "Other user-generated content" (không gắn tài khoản; liên hệ chỉ khi người dùng cho phép) — docs/FEEDBACK.md.
- Dữ liệu được mã hoá khi truyền: Yes (Firebase dùng HTTPS).
- Người dùng có thể yêu cầu xoá: Yes, có nút Xoá tài khoản trong app.
- Dữ liệu sức khoẻ (cân nặng, calo, giấc ngủ): **chỉ lưu trên máy, không thu thập lên máy chủ.**

---

## 7. Giới hạn hiện tại & việc của giai đoạn 2

- **Thông báo "có bài mới" khi app đang đóng:** hiện tại học viên thấy chấm đỏ khi mở app; nhắc giờ tập thì đã hoạt động cả khi đóng app. Muốn đẩy thông báo tức thì từ PT sang học viên cần Firebase Cloud Messaging + Cloud Functions, phải chuyển gói Blaze (trả theo dùng, gần như 0đ khi ít người).
- **Đồng bộ Google Drive** chỉ dùng được ở bản web, bị ẩn trong app điện thoại vì Google chặn đăng nhập Google bên trong app nhúng.
- **Tìm & Book PT, hồ sơ thương hiệu công khai:** giai đoạn 2. PT đã nhập được thông tin thương hiệu để dùng sau.
- Hướng dẫn trong thư viện 800+ bài đang là tiếng Anh. Tên nhóm cơ và dụng cụ đã dịch sang tiếng Việt.

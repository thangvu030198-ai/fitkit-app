# TapEasy — Checklist tuân thủ App Store & Google Play

> Đổi tên FIT KIT → TapEasy (11/2026): tên app trên store, tên hiển thị dưới icon (`capacitor.config.json` → `appName`), chính sách bảo mật và trang xoá tài khoản đã đổi đồng bộ. Bundle ID/package giữ nguyên nên **cập nhật bản cũ**, không phải app mới. Apple: đổi tên chỉ được khi nộp phiên bản mới; Google Play: đổi trong *Main store listing* — tên mới phải khớp tên trong ảnh chụp màn hình và icon (chính sách *Metadata*).

Đối chiếu với mã nguồn ngày **11/11/2026** (app.js, pt.js, cloud.js, coach.js, ptprofile.js, video.js, freevideos.js, exdb.js, nutrition.js, firestore.rules, workflow CI, privacy-policy.html, delete-account.html, health-safety.js).
Ký hiệu: **[CHẶN]** = gần như chắc bị từ chối / không upload được · **[CẦN LÀM]** = rủi ro bị từ chối hoặc sai khai báo · **[ĐẠT]** = đã đáp ứng · **[KHUYẾN NGHỊ]** = nên làm.
Chính sách của Apple/Google thay đổi thường xuyên — kiểm tra lại văn bản hiện hành trước khi nộp.

> **Vòng sửa bảo mật 11/11/2026** (docs/qa/FIX-security.md, theo docs/qa/QA-security.md §5): bảng App Privacy (§1) và Data safety (§2.2) đã **khai lại** theo dữ liệu thật của Cộng đồng, Tìm PT, Sự kiện, Cửa hàng, chat & ảnh (địa chỉ giao hàng, SĐT + liên hệ khẩn cấp, lịch sử mua, tin nhắn + ảnh, nội dung công khai). Xoá tài khoản = Cloud Function `deleteMyAccount` (dọn toàn bộ dữ liệu, ẩn danh đơn hàng, chặn Owner, thu hồi Apple) — app và `delete-account.html` đều gọi. Có **chặn người dùng** (App Store 1.2). Bảng quản trị **không còn lối vào ẩn** "chạm 7 lần" (2.3.1); app native chạy demo không có quản trị. Workflow Android đặt **targetSdk/compileSdk 36** + JDK 21. Còn lại cho chủ app: mục 0.2, 0.4, 0.6 và docs/qa/FIX-security.md §"Việc chủ app phải làm".

> **Vòng R3 (14/11/2026, agent store — docs/qa/R3-store.md):** danh sách kiểm theo từng store + các bước cho chủ dự án chuyển sang **`docs/RELEASE-CHECKLIST.md`**; câu trả lời dán sẵn ở `store/`. Thay đổi so với nội dung bên dưới: (1) Android giữ Capacitor 6 nhưng bộ vá `scripts/native-android-patch.py` nâng **AGP 8.9.1 + Gradle 8.11.1** để build được compileSdk/targetSdk 36, thêm xử lý **edge-to-edge**, quyền `VIBRATE`, gỡ `AD_ID`, tự soát quyền thừa sau build; secret mới `GOOGLE_SERVICES_JSON_BASE64` (tên cũ `ANDROID_GOOGLE_SERVICES_JSON` vẫn nhận). (2) iOS: **privacy manifest đã có** (`store/native/ios/PrivacyInfo.xcprivacy`), **chỉ iPhone**, chuỗi quyền Việt + Anh gồm Camera, **Microphone** (quay video Khoảnh khắc), Photo Library *Add*; **bỏ** `NSPhotoLibraryUsageDescription`; workflow nộp **dừng** nếu thiếu `GoogleService-Info.plist`. (3) `CapacitorHttp` tắt. (4) Cờ `window.FK_BUILD` cho module ẩn mục "Sắp ra mắt"/gian hàng trống/nút Facebook trên bản store.

---

## 0. Việc phải làm trước khi nộp (ưu tiên)

| # | Việc | Store | Mức |
|---|---|---|---|
| 1 | **Target API 36**: từ 31/08/2026 app mới & bản cập nhật trên Google Play phải target Android 16 (API 36). Capacitor 6 (package.json `^6.1.2`) mặc định target 34 → **bị từ chối upload**. Nâng Capacitor lên bản hỗ trợ API 36 (Capacitor 8; các plugin `@capacitor/*` và `@capacitor-firebase/authentication` cùng major) hoặc đặt `targetSdkVersion = 36`, `compileSdkVersion = 36` trong `android/variables.gradle` qua workflow rồi test lại (Android 15+ bắt buộc edge-to-edge — kiểm tra safe-area, thanh điều hướng). | Play | [CHẶN] |
| 2 | **Đăng nhập Google/Apple trên app native** — vòng 2 (11/2026): `package.json` đã có `@capacitor-firebase/authentication` **^6.0.0** (dòng 6.x = Capacitor 6) + peer `firebase ^10.9.0`; `capacitor.config.json` có `FirebaseAuthentication { skipNativeAuth: true, providers: ["apple.com", "google.com"] }`; `ios-appstore.yml` thêm entitlement *Sign in with Apple* (`com.apple.developer.applesignin`). **Còn lại cho chủ app**: tạo secret `IOS_GOOGLE_SERVICE_INFO_PLIST` / `ANDROID_GOOGLE_SERVICES_JSON` (mục 0.2a) — thiếu secret thì workflow **gỡ plugin** khỏi bản build (tránh crash) và nút social báo "chưa cấu hình" (= vẫn vi phạm 2.1 nếu nộp như vậy → hoặc tạo secret, hoặc ẩn nút social trên native). Facebook trên native chưa cấu hình (cần Facebook SDK — mục 0.2a). | Cả hai | [CẦN LÀM — secrets] |
| 3 | **Thu hồi token Apple + xoá TOÀN BỘ dữ liệu khi xoá tài khoản** (5.1.1(v)): `cloud.js` và `delete-account.html` đã gọi Cloud Function `deleteMyAccount` (11/2026). Chủ app: **deploy `functions/`** + đặt secret `APPLE_PRIVATE_KEY` và `functions/.env` (APPLE_TEAM_ID, APPLE_KEY_ID…). | App Store | [CHẶN tới khi deploy] |
| 4 | **Firebase phải được cấu hình** (`firebase-config.js` đang trống → "chế độ demo", tài khoản chỉ lưu trên máy). Reviewer sẽ thấy tính năng PT ↔ học viên không đồng bộ → 2.1. Điền config + publish `firestore.rules` + tạo tài khoản demo (PT có sẵn 1 học viên) cho mục *App Review Information*. | Cả hai | [CHẶN] |
| 5 | ~~Rules `users/{uid}` lộ email/SĐT~~ — [ĐẠT 11/2026]: email không lưu trong hồ sơ, `users` không `list`, SĐT PT chuyển sang `users/{uid}/private/contact` (chỉ học viên đang kết nối đọc — QS-17). PT không gắn được người lạ làm học viên (QS-02). **Publish `firestore.rules` + `storage.rules` + `firestore.indexes.json` mới.** | Cả hai | [ĐẠT khi publish] |
| 6 | **Điền email hỗ trợ + tên nhà phát triển** trong `privacy-policy.html`, bật GitHub Pages, dán URL vào App Store Connect & Play Console. | Cả hai | [CHẶN] |
| 7 | **Đồng ý trước khi gửi ảnh/dữ liệu cho AI bên thứ ba** (5.1.2(i), bản guideline 11/2025): hiện chỉ có ghi chú trong màn cài đặt key. Thêm hộp thoại đồng ý 1 lần trước lần phân tích đầu tiên, nêu rõ nhà cung cấp + dữ liệu gửi đi (ảnh, giới tính, tuổi, chiều cao, cân nặng, mục tiêu). | App Store | [CẦN LÀM] |
| 8 | **Nhãn "Phân tích AI (mô phỏng)"** (`renderAiFallback`) hiển thị khi KHÔNG có AI, và ghi chú lưu vào InBody "Ước tính AI qua ảnh…" dù không gọi AI → gây hiểu nhầm (2.3, 1.4.1). Đổi thành "Ước tính theo công thức (không dùng AI)". | Cả hai | [CẦN LÀM] |
| 9 | **Tính năng "Sắp ra mắt"** (vai trò "Tìm & Book PT", ô "Tìm PT" ở Trang chủ → toast "sẽ có ở bản cập nhật tiếp theo") = nội dung giữ chỗ → 2.1/2.2. Ẩn trên bản nộp store. | App Store | [CẦN LÀM] |
| 10 | Thêm module `health-safety` (sàng lọc + miễn trừ y tế) vào `index.html` — hỗ trợ 1.4.1 và *Health apps* của Play. | Cả hai | [CẦN LÀM] |
| 11 | **1.2 Nội dung người dùng tạo**: có báo cáo + kiểm duyệt; **chặn người dùng** đã có API `cloud.blockUser / unblockUser / listBlocked / isBlocked` + rules (người bị chặn không nhắn tin / gửi yêu cầu / bình luận). Cần gắn nút "Chặn người này" vào màn chat PT, hồ sơ PT, bình luận Khoảnh khắc (chuyển giao fixer PT/commerce) và ghi cam kết **xử lý báo cáo trong 24 giờ** trong Điều khoản / App Review Notes. | App Store | [CẦN LÀM — UI] |
| 12 | **2.3.1 Tính năng ẩn**: đã bỏ "chạm 7 lần"; lối vào quản trị = mục "Bảng quản trị" (chỉ tài khoản có vai trò) và "Thiết lập quản trị lần đầu" (chỉ khi chưa có Chủ sở hữu). Ghi trong *App Review Notes*: "Bảng quản trị dành cho nhân sự TapEasy; tài khoản demo nhân sự: …". | App Store | [ĐẠT + ghi chú review] |
| 13 | ~~Chuỗi mô tả quyền iOS còn ghi "FIT KIT"~~ — [ĐẠT vòng 2]: `build-ios.yml` và `ios-appstore.yml` đều "TapEasy"; `ios-appstore.yml` có entitlement Sign in with Apple. | App Store | [ĐẠT] |

### 0.2a Cài đăng nhập native (`@capacitor-firebase/authentication` 6.x) — vòng 2, 11/2026

Không cần Mac: workflow tự làm các bước dưới khi có secret. Làm tay (Mac / Android Studio) thì theo đúng thứ tự này.

1. **Firebase Console** → Project settings → *Your apps*: thêm app **iOS** `vn.thangvu.fitkit` (tải `GoogleService-Info.plist`) và app **Android** `vn.thangvu.fitkit` (thêm **SHA-1 + SHA-256** của khoá ký release **và** của *Play App Signing* — Play Console → Setup → App integrity — rồi tải `google-services.json`). Authentication → Sign-in method: bật Google, Apple.
2. **Secrets GitHub** (Settings → Secrets and variables → Actions):
   - `IOS_GOOGLE_SERVICE_INFO_PLIST` = `base64 -i GoogleService-Info.plist` · `ANDROID_GOOGLE_SERVICES_JSON` = `base64 -w0 google-services.json`.
   - Thiếu secret → bước "Firebase native" chạy `npm uninstall --no-save @capacitor-firebase/authentication` (plugin gọi `FirebaseApp.configure()` / `FirebaseAuth.getInstance()` khi mở app — thiếu file cấu hình là **crash ngay khi mở**), bản build vẫn chạy với đăng nhập email.
3. **iOS** (workflow `ios-appstore.yml` / `build-ios.yml` tự làm sau `npx cap add ios`, trước `npx cap sync ios`):
   - Chép `GoogleService-Info.plist` vào `ios/App/App/` **và thêm vào target App** (Copy Bundle Resources — đặt file vào thư mục thôi là chưa đủ; workflow dùng gem `xcodeproj`).
   - `ios/App/Podfile`, trong `target 'App' do` ngay sau `capacitor_pods`: `pod 'CapacitorFirebaseAuthentication/Google', :path => '../../node_modules/@capacitor-firebase/authentication'` (Apple không cần subspec). Nếu `pod install` báo deployment target, nâng `platform :ios` lên `'14.0'`.
   - `Info.plist` → `CFBundleURLTypes` thêm URL scheme = giá trị `REVERSED_CLIENT_ID` trong `GoogleService-Info.plist` (Google Sign-In quay lại app).
   - Entitlement `com.apple.developer.applesignin = [Default]` (`ios/App/App/App.entitlements`, `CODE_SIGN_ENTITLEMENTS` của target App) + bật *Sign In with Apple* cho App ID trên developer.apple.com.
4. **Android** (workflow `build-android.yml` tự làm sau `npx cap add android`):
   - Chép `google-services.json` vào `android/app/`. Gradle của Capacitor 6 đã có `classpath 'com.google.gms:google-services'` (`android/build.gradle`) và tự `apply plugin: 'com.google.gms.google-services'` khi có file (`android/app/build.gradle`) — nếu thiếu, thêm tay 2 dòng này.
   - `android/variables.gradle` → trong `ext { … }` thêm `rgcfaIncludeGoogle = true` (plugin chỉ kéo SDK Google Sign-In khi bật).
   - Apple trên Android đi qua luồng web OAuth của Firebase — kiểm thử trên máy thật; nếu không ổn định, ẩn nút Apple trên Android (Apple không bắt buộc trên Google Play).
5. **Facebook** (chưa bật trong `providers`): cần thêm `"facebook.com"` vào `capacitor.config.json`, iOS subspec `CapacitorFirebaseAuthentication/Facebook` + `FacebookAppID`/`FacebookClientToken`/`LSApplicationQueriesSchemes`/URL scheme `fb<APP_ID>` trong Info.plist; Android `rgcfaIncludeFacebook = true` + `facebook_app_id`, `facebook_client_token` trong `res/values/strings.xml`. Chưa làm → ẩn nút Facebook trên bản native (README-store.md §1).
6. Sau `npm install` trên máy có mạng: kiểm `npm ls @capacitor-firebase/authentication` ra 6.x và `@capacitor/core` 6.x (cùng major). Nâng Capacitor lên 7/8 thì nâng plugin cùng major.

---

## 1. App Store Review Guidelines

### 1.4.1 An toàn — nội dung y tế / sức khoẻ
- [ĐẠT sau khi tích hợp health-safety] Nhắc "hỏi bác sĩ" trước khi thay đổi tập/ăn; miễn trừ trách nhiệm y tế đầy đủ (sàng lọc bước 0, Hồ sơ, sheet chính sách); sàng lọc PAR-Q+; không thâm hụt calo cho thai kỳ / cho con bú / < 18 / RLĂU; ẩn bài rất cao khi có vấn đề tim mạch.
- [ĐẠT] Công thức có trích nguồn (Mifflin-St Jeor, ISSN, IOM, NSF/CDC — màn Nguồn dữ liệu, thẻ "Cơ sở khoa học").
- [CẦN LÀM] Mục 8 bảng trên (nhãn AI mô phỏng). Ước tính % mỡ (Deurenberg) và phân tích ảnh AI phải luôn ghi "ước lượng, không phải đo lường y khoa" — đã có ở kết quả AI, thiếu ở bản mô phỏng.
- [KHUYẾN NGHỊ] Mô tả App Store: thêm câu "TapEasy không phải thiết bị y tế…"; tránh từ "chẩn đoán", "điều trị", "chữa".

### 2.1 / 2.2 Hoàn chỉnh — [CHẶN] mục 2, 4 · [CẦN LÀM] mục 9
- Màn chào phát video nền từ Pexels/Pixabay; thư viện ảnh, video, food index tải từ mạng → khi mạng yếu reviewer thấy khung trống. Đảm bảo có placeholder/thông báo lỗi rõ ràng (video.js đã có "Không phát được video này").
- Liên kết "Điều khoản" ở màn đăng ký (`#au-privacy`, pt.js) chỉ mở chính sách bảo mật — chưa có Điều khoản sử dụng. Dùng EULA chuẩn của Apple hoặc viết trang Điều khoản riêng và đổi nhãn cho đúng.

### 4.2 Chức năng tối thiểu (app bọc web Capacitor)
Bằng chứng trong code giúp qua 4.2:
- [ĐẠT] Thông báo native lên lịch trên máy (`nativeNotif` + `@capacitor/local-notifications`), báo hết giờ nghỉ khi khoá màn hình, nút Back Android (`fkHandleBack`), chia sẻ native (`@capacitor/share`), mở link bằng `@capacitor/browser`, giữ màn hình sáng khi tập (`wakeLock`).
- [ĐẠT] Dữ liệu offline: localStorage + IndexedDB (video, ảnh tiến trình), thư viện 800+ bài đóng gói sẵn (`prepare-www.sh` tải `exercises.json` vào `www/vendor`).
- [ĐẠT] Chức năng thực chất: ghi kg × lần từng hiệp, tự tăng tạ, kỷ lục 1RM, dinh dưỡng, giấc ngủ, PT ↔ học viên.
- [CẦN LÀM] Không để màn nào là trang web bọc lại (không mở `thangvu030198-ai.github.io` trong WebView chính); `privacy-policy.html`/`delete-account.html` trong app nên mở qua Browser plugin (health-safety.js đã làm cho link chính sách đầy đủ).
- [KHUYẾN NGHỊ] Ghi chú cho reviewer (App Review Notes) liệt kê các tính năng native trên + tài khoản demo.

### 4.8 Dịch vụ đăng nhập
- [ĐẠT về giao diện] Có nút "Đăng nhập với Apple" cạnh Google/Facebook ở cả màn đăng nhập và đăng ký (pt.js, nút Apple đứng đầu).
- [CẦN LÀM — secrets] Mục 2 bảng trên — plugin + entitlement đã có trong package.json / `ios-appstore.yml` (vòng 2); nút Apple trên iOS chạy thật khi có secret `IOS_GOOGLE_SERVICE_INFO_PLIST` (mục 0.2a).
- [ĐẠT] Có "Dùng ngay, không cần tài khoản" cho tính năng cá nhân (5.1.1(iv)).

### 5.1.1 Thu thập & lưu trữ dữ liệu
- (i) [CẦN LÀM] Privacy policy: file đã cập nhật đầy đủ (dữ liệu sức khoẻ, Google/Facebook/Apple, nhà cung cấp nội dung, xoá, trẻ em, liên hệ, ngày hiệu lực) — chỉ còn điền placeholder & đăng URL. Trong app: sheet tóm tắt + link bản đầy đủ (health-safety.js).
- (ii) [ĐẠT] Sàng lọc sức khoẻ có "Để sau" và "Không muốn trả lời"; không bắt buộc.
- (iii) [CẦN LÀM] Mục 5 bảng trên (rules `users`).
- (v) Xoá tài khoản:
  - [ĐẠT] Trong app: Hồ sơ → Tài khoản → Xoá tài khoản (cloud.js xoá form PT, gỡ liên kết học viên, xoá `users/{uid}`, xoá Auth user, xác thực lại trước khi xoá).
  - [ĐẠT] Trang web `delete-account.html` (cần Firebase config).
  - [CHẶN → ĐẠT khi deploy] **Sign in with Apple: thu hồi token** bằng REST API `/auth/revoke` — `functions/index.js` → `revokeAppleToken` (client secret JWT ES256, khoá .p8 trong Secret Manager) + diff `cloud.js`.
  - [ĐẠT khi deploy] Dọn dữ liệu còn sót khi user bị xoá ở bất kỳ đâu: `cleanupDeletedUser`.

### 5.1.2 Sử dụng & chia sẻ dữ liệu
- [ĐẠT] Không quảng cáo. **13/11/2026:** có thống kê sử dụng ẩn danh **tuỳ chọn, mặc định tắt, chỉ bật khi người dùng đồng ý** (analytics.js · docs/ANALYTICS.md): không IDFA, không kết hợp dữ liệu bên thứ ba để quảng cáo, mã người dùng chỉ gửi dạng băm → **không phải "tracking"** theo định nghĩa của Apple → App Tracking Transparency **không cần**; vẫn trả lời "Tracking: No". Nếu chủ app bật Firebase Analytics trên iOS native, giữ `allow_ad_personalization_signals=false` và không thêm AdSupport.framework.
- [CẦN LÀM] (i) AI bên thứ ba — mục 7 bảng trên.

### 5.1.3 Sức khoẻ & nghiên cứu sức khoẻ
- [ĐẠT] Dữ liệu sức khoẻ (sàng lọc, cân nặng, InBody, ảnh tiến trình) chỉ lưu trên máy, không dùng cho quảng cáo/khai thác dữ liệu, không lưu iCloud, không chia sẻ cho PT.
- [ĐẠT] Không ghi dữ liệu sai vào hệ thống sức khoẻ (không dùng HealthKit).

### HealthKit — hiện **không dùng**
- Không bật capability HealthKit, không nhắc "Apple Health" trong mô tả/ảnh chụp (nếu có sẽ bị hỏi 2.5.1).
- Nếu thêm sau: entitlement HealthKit, `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription` tiếng Việt cụ thể, chỉ đọc loại dữ liệu cần thiết, không lưu dữ liệu HealthKit lên iCloud/máy chủ khi chưa có đồng ý rõ ràng, không dùng cho quảng cáo, cập nhật privacy policy và App Privacy (Health linked/not linked).

### Nội dung AI
- Hiện có: phân tích ảnh tiến trình bằng OpenAI / Gemini / xAI **với API key do người dùng tự nhập**, gọi thẳng từ máy (app.js `callVisionAI`).
- [ĐẠT] Kết quả ghi rõ "quan sát bằng AI, không phải chẩn đoán y khoa".
- [CẦN LÀM] 5.1.2(i) đồng ý trước khi gửi (mục 7); nhãn "mô phỏng" (mục 8).
- [KHUYẾN NGHỊ] Thêm nút "Báo cáo kết quả không phù hợp" ở sheet kết quả AI (bắt buộc với Google Play — xem 2.6) và chặn hiển thị nếu AI trả nhận xét về ngoại hình mang tính xúc phạm. Nếu module "AI soạn giáo án" gọi LLM: cùng các yêu cầu + đi qua `FKHealth.current()` để không sinh buổi "Rất cao" cho người có cờ tim mạch.
- [KHUYẾN NGHỊ] Bảng câu hỏi xếp hạng tuổi mới của App Store có câu về nội dung y tế/sức khoẻ và tính năng AI/chat — trả lời đúng thực tế (dự kiến 13+).

### Khác
- [ĐẠT — R3] **Privacy manifest** `PrivacyInfo.xcprivacy` cho target app (`store/native/ios/PrivacyInfo.xcprivacy`, workflow thêm vào target + kiểm trong bản archive): NSPrivacyTracking = false, NSPrivacyCollectedDataTypes theo bảng App Privacy dưới, required-reason API UserDefaults `CA92.1` + File timestamp `C617.1`. Capacitor/Firebase pod có manifest riêng; kiểm tra cảnh báo "ITMS-91053 Missing API declaration" sau khi upload TestFlight.
- [ĐẠT — R3] Info.plist: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryAddUsageDescription` (Việt + Anh), `ITSAppUsesNonExemptEncryption = false`; không có `NSPhotoLibraryUsageDescription` / `NSUserTrackingUsageDescription` (không cần ATT).
- [KHUYẾN NGHỊ] 1.2 Nội dung người dùng tạo: ghi chú PT ↔ học viên là kênh riêng (vào bằng mã mời). Đã có "rời PT" / PT xoá form; nên thêm "Báo cáo" để gửi email hỗ trợ.

### App Privacy (nhãn dinh dưỡng quyền riêng tư) — khai lại 11/2026 (QA-security §5)

| Loại dữ liệu | Thu thập? | Liên kết danh tính | Tracking | Mục đích |
|---|---|---|---|---|
| Contact Info → Name | Có (tài khoản, đơn hàng, đăng ký sự kiện) | Có | Không | App Functionality |
| Contact Info → Email Address | Có | Có | Không | App Functionality, Customer Support |
| Contact Info → Phone Number | Có (SĐT PT, PT nhập cho học viên, **đơn hàng**, **đăng ký sự kiện + liên hệ khẩn cấp**) | Có | Không | App Functionality |
| Contact Info → Physical Address | Có (**địa chỉ giao hàng**, nhận quà) | Có | Không | App Functionality |
| Purchases → Purchase History | Có (đơn hàng cửa hàng, voucher, TapEasy Points) | Có | Không | App Functionality |
| User Content → Photos or Videos | Có (ảnh PT/album niêm yết **công khai**, ảnh đánh giá, ảnh/clip Khoảnh khắc sự kiện **công khai**, ảnh trong chat, ảnh tiến trình **khi học viên chia sẻ với PT**) | Có | Không | App Functionality |
| User Content → Emails or Text Messages | Có (**chat PT ↔ học viên**, câu hỏi gửi PT) | Có | Không | App Functionality |
| User Content → Customer Support | Có (yêu cầu hỗ trợ) | Có | Không | Customer Support |
| User Content → Other User Content | Có (routine **công khai**, đánh giá PT, review & bình luận sự kiện, lịch buổi / ghi chú PT ↔ học viên) | Có | Không | App Functionality |
| Health & Fitness → Fitness | Có (bài giao, kết quả buổi tập, tiến độ thi đua, nhật ký đồng bộ cho PT) | Có | Không | App Functionality |
| Health & Fitness → Health | Có — PAR-Q / số đo **khi học viên chọn chia sẻ với PT**; và khi người dùng tự bật phân tích AI (gửi tới nhà cung cấp AI) | Có | Không | App Functionality |
| Identifiers → User ID | Có (Firebase UID) | Có | Không | App Functionality |
| Identifiers → Device ID | Chỉ khi bật thông báo đẩy FCM | Có | Không | App Functionality |
| Usage Data → Product Interaction | **Có — chỉ khi người dùng bật "Thống kê sử dụng ẩn danh"** và chủ app đã cấu hình Firebase Analytics / PostHog (13/11/2026) | **Không** (mã người dùng băm một chiều, không tên/email) | Không | Analytics |
| User Content → Other User Content (góp ý, điểm NPS 0–10, ảnh chụp màn hình tuỳ chọn) | Có — khi người dùng gửi Góp ý / đánh giá (13/11/2026) | **Không** (không lưu uid; email/SĐT chỉ khi người dùng cho phép liên hệ) | Không | App Functionality, Customer Support |
| Usage Data → Advertising Data / Other, Diagnostics, Location (chính xác/ước lượng), Financial Info (số thẻ/tài khoản), Contacts, Browsing | Không | — | — | — |

Ghi chú: thanh toán chuyển khoản/VietQR do người dùng tự chuyển — app **không** thu số thẻ/số tài khoản người mua. Dữ liệu chỉ nằm trên thiết bị (hồ sơ cơ thể, nhật ký, ảnh tiến trình chưa chia sẻ, sàng lọc sức khoẻ chưa chia sẻ) **không** tính là "thu thập".

---

## 2. Google Play

### 2.1 Target API — [ĐÃ CẤU HÌNH 11/2026 — kiểm bằng bản build]
Từ 31/08/2026: app mới & cập nhật phải target **API 36**. `build-android.yml` (11/2026) đặt `compileSdkVersion = targetSdkVersion = 36` trong `android/variables.gradle` sau `npx cap add android`, dùng **JDK 21**, và **dừng build nếu `firebase-config.js` trống** (bản store không được chạy chế độ demo — QS-16). Capacitor 6 chưa được Google kiểm định với API 36: nếu Gradle/AGP báo lỗi, nâng `@capacitor/*` lên 7/8 trong `package.json` (fixer ux/integrator) rồi chạy lại. Kiểm tra edge-to-edge trên Android 15+.

### 2.2 Data safety — điền sẵn theo dữ liệu thực tế

**Câu hỏi chung**
- App có thu thập hoặc chia sẻ loại dữ liệu người dùng bắt buộc nào không? → **Có**
- Mọi dữ liệu được mã hoá khi truyền? → **Có** (HTTPS: Firebase, các API)
- Cách tạo tài khoản → **Tên người dùng + mật khẩu; OAuth (Google, Facebook, Apple)**
- Người dùng có thể yêu cầu xoá dữ liệu? → **Có** — Delete account URL: `https://thangvu030198-ai.github.io/fitkit-app/delete-account.html`
- Xoá một phần dữ liệu mà không xoá tài khoản? → **Có** (xoá dữ liệu sức khoẻ, đặt lại dữ liệu trên máy, PT xoá form học viên) — dùng cùng URL hoặc email hỗ trợ
- Tuân thủ Families Policy? → Không áp dụng (không nhắm trẻ em)
- Đánh giá bảo mật độc lập (MASA)? → Không

**Loại dữ liệu** (Chia sẻ = Không cho mọi dòng: Firebase/Google Cloud là nhà cung cấp dịch vụ xử lý thay mặt nhà phát triển; gửi tới AI/đăng nhập xã hội là hành động do người dùng chủ động — ngoại lệ "user-initiated"). Cột "Công khai" để ghi trong mô tả / privacy policy (Play không có ô riêng nhưng *User Data policy* yêu cầu nêu rõ).

| Nhóm → loại | Thu thập | Bắt buộc/Tuỳ chọn | Xử lý tạm thời? | Mục đích | Công khai? |
|---|---|---|---|---|---|
| Personal info → Name | Có | Tuỳ chọn | Không | App functionality, Account management | Tên trên routine / đánh giá / bảng xếp hạng: có |
| Personal info → Email address | Có | Tuỳ chọn | Không | App functionality, Account management | Không |
| Personal info → User IDs | Có (Firebase UID, ID nhà cung cấp đăng nhập) | Tuỳ chọn | Không | App functionality, Account management | Không |
| Personal info → **Address** | Có (giao hàng, nhận quà) | Tuỳ chọn | Không | App functionality | Không |
| Personal info → **Phone number** | Có (hồ sơ PT, PT nhập cho học viên, **đơn hàng**, **đăng ký sự kiện + liên hệ khẩn cấp**) | Tuỳ chọn | Không | App functionality | Không |
| Personal info → Other info | Có (thương hiệu, chuyên môn, khu vực, giới thiệu, giá PT) | Tuỳ chọn | Không | App functionality | Niêm yết Tìm PT: có |
| Financial info → **Purchase history** | Có (đơn hàng, voucher, điểm) | Tuỳ chọn | Không | App functionality | Không |
| Health and fitness → Fitness info | Có (bài giao, kết quả buổi, tiến độ thi đua, nhật ký đồng bộ cho PT) | Tuỳ chọn | Không | App functionality | Điểm thi đua: có |
| Health and fitness → Health info | Có (PAR-Q / số đo khi học viên chia sẻ với PT; dữ liệu gửi AI khi người dùng tự bật) | Tuỳ chọn | Không | App functionality | Không |
| Photos and videos → Photos | Có (ảnh PT, album, ảnh đánh giá, ảnh Khoảnh khắc, ảnh trong chat, ảnh tiến trình chia sẻ với PT) | Tuỳ chọn | Không | App functionality | Album, đánh giá, Khoảnh khắc: có |
| Photos and videos → **Videos** | Có (clip Khoảnh khắc sự kiện) | Tuỳ chọn | Không | App functionality | Có |
| Messages → Other in-app messages | Có (**chat PT ↔ học viên + ảnh**, câu hỏi gửi PT, ghi chú) | Tuỳ chọn | Không | App functionality | Không |
| App activity → Other user-generated content | Có (routine, đánh giá, bình luận, review sự kiện, lịch tập, yêu cầu hỗ trợ, báo cáo) | Tuỳ chọn | Không | App functionality | Routine, đánh giá, bình luận, review: có |
| Device or other IDs | Chỉ khi bật thông báo đẩy FCM | Tuỳ chọn | Không | App functionality | Không |
| App activity → **App interactions** | Có — **chỉ khi người dùng bật Thống kê sử dụng ẩn danh** (mặc định tắt) và chủ app cấu hình Firebase Analytics / PostHog | Tuỳ chọn | Không | Analytics | Không |
| App activity → Other user-generated content (**góp ý, điểm NPS, ảnh chụp màn hình tự đính kèm**) | Có (13/11/2026) | Tuỳ chọn | Không | App functionality, Analytics (cải thiện sản phẩm) | Không |
| Location, Contacts, Calendar, Audio, Files & docs, Web browsing, App info & performance | **Không** | — | — | — | — |

**Xoá dữ liệu**: xoá tài khoản (app hoặc URL) xoá mọi dòng trên, **trừ** đơn hàng/quà được giữ dạng ẩn danh (bỏ tên, SĐT, địa chỉ) tối đa 10 năm cho kế toán — ghi đúng như vậy ở câu hỏi "Data deletion" và privacy-policy.html §9–10.
Không khai báo: dữ liệu chỉ lưu trên máy (hồ sơ cơ thể, nhật ký tập/ăn/ngủ, ảnh tiến trình chưa chia sẻ, InBody, sàng lọc sức khoẻ chưa chia sẻ). Sao lưu Google Drive bị ẩn trên bản Android (pt.js `renderAccountCard`) — nếu bật lại phải khai báo thêm.
Lưu ý: Firebase Analytics / PostHog (13/11/2026) đã khai ở dòng "App interactions" (tuỳ chọn, có đồng ý). Nếu thêm Crashlytics → khai báo thêm Crash logs.

### 2.3 Health apps declaration (App content → Health apps) — [CẦN LÀM]
- Chọn: **Activity and fitness** (tập luyện, theo dõi buổi tập), **Nutrition and weight management** (calo, macro, cân nặng), **Sleep management** (nhật ký giấc ngủ). Có màn sàng lọc an toàn có xét thai kỳ — nếu Play hỏi về sức khoẻ phụ nữ/thai kỳ, trả lời là lời khuyên an toàn khi tập, **không** phải công cụ theo dõi thai kỳ.
- **Không** dùng Health Connect → không khai báo quyền Health Connect.
- Không phải thiết bị y tế (SaMD) → trả lời Không; thêm câu miễn trừ vào **mô tả store**: "TapEasy không phải thiết bị y tế và không thay thế tư vấn của bác sĩ."
- Không đưa ra tuyên bố chữa bệnh trong mô tả (Health Content and Services policy).

### 2.4 Xoá tài khoản — [ĐẠT khi Firebase được cấu hình + deploy Functions]
- Trong app ✓, URL web ✓ — cả hai gọi Cloud Function `deleteMyAccount` (xoá toàn bộ dữ liệu liên quan, ẩn danh đơn hàng, chặn Owner chưa chuyển nhượng, thu hồi token Apple). `delete-account.html` liệt kê dữ liệu bị xoá / được giữ ẩn danh, thời gian giữ bản sao lưu ≤ 30 ngày.
- Trang web chỉ hoạt động khi `firebase-config.js` có giá trị → kiểm tra trước khi điền URL.

### 2.5 Quyền Android
- [ĐẠT — R3] `CAMERA` (uses-feature `required=false`), `POST_NOTIFICATIONS`, `VIBRATE` (bộ vá thêm vào manifest); `AD_ID` bị gỡ; bước "Soát quyền" của workflow đọc merged manifest và làm đỏ build nếu có quyền thừa (exact alarm, READ_MEDIA_*, vị trí, danh bạ…).
- [CẦN LÀM] Kiểm tra *merged manifest* sau `npx cap sync`: nếu có `USE_EXACT_ALARM` → Play chỉ cho app báo thức/lịch, phải gỡ; `SCHEDULE_EXACT_ALARM` cần khai báo lý do. Nếu xuất hiện `READ_MEDIA_IMAGES/VIDEO` → phải khai báo theo *Photo and Video Permissions policy* hoặc gỡ (app chọn ảnh bằng `<input type=file>` = trình chọn hệ thống, không cần quyền này).

### 2.6 AI-generated content — [KHUYẾN NGHỊ mạnh]
Play yêu cầu app có tính năng tạo nội dung bằng AI cho phép người dùng **báo cáo/gắn cờ** nội dung xúc phạm ngay trong app. Thêm nút "Báo cáo" ở kết quả phân tích AI (và ở giáo án do AI soạn nếu có).

### 2.7 Khác
- Target audience: chọn **13–15, 16–17, 18+** (onboarding chỉ cho ≥ 14 tuổi) hoặc chỉ 18+ để đơn giản; không chọn dưới 13.
- Content rating (IARC): không bạo lực/cờ bạc; có thông tin sức khoẻ → thường "Everyone/3+" hoặc tương đương.
- Ads: **Không có quảng cáo**. Financial features: Không. Government: Không.
- App access: cung cấp tài khoản demo PT + học viên.
- Tài khoản nhà phát triển cá nhân mới: closed testing ≥ 12 người trong 14 ngày (kiểm tra yêu cầu hiện hành).

---

## 3. Bảng đối chiếu nhanh tính năng ↔ code

| Yêu cầu | Vị trí trong code | Trạng thái |
|---|---|---|
| Xoá tài khoản trong app | `pt.js` `openDeleteAccountSheet` → `cloud.js` `deleteAccount` | ĐẠT |
| Xoá tài khoản ngoài app | `delete-account.html` | ĐẠT (cần Firebase) |
| Thu hồi token Apple | `functions/index.js` `revokeAppleToken` + diff cloud.js | Chờ deploy |
| Dọn dữ liệu khi xoá user | `functions/index.js` `cleanupDeletedUser` | Chờ deploy |
| Sign in with Apple | `pt.js` `data-social="apple"`, `cloud.js` `signInWithApple`, `package.json` plugin 6.x, `ios-appstore.yml` entitlement | Có; cần secret GoogleService (mục 0.2a) |
| Không bắt đăng nhập cho tính năng cá nhân | `pt.js` màn chào "Dùng ngay" | ĐẠT |
| Privacy policy trong app | `pt.js` `openPrivacySheet` + link đầy đủ (health-safety.js) | ĐẠT |
| Miễn trừ y tế + sàng lọc | `health-safety.js` | ĐẠT khi tích hợp |
| Không quảng cáo / tracking | Không SDK quảng cáo; thống kê ẩn danh (analytics.js) **mặc định tắt**, SDK chỉ tải sau khi đồng ý, tôn trọng Do Not Track/GPC, không PII | ĐẠT |
| AI bên thứ ba | `app.js` `openAiSettings`, `callVisionAI` | Thiếu đồng ý rõ ràng + báo cáo |
| Rules Firestore | `firestore.rules` `users/{uid}` chỉ `get`, không email / SĐT (QS-17) | ĐẠT khi publish |
| Target API Android | `build-android.yml` đặt compile/targetSdk 36 + JDK 21 | ĐẠT (kiểm bằng bản build) |

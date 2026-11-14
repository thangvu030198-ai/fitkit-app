# TapEasy — Danh sách kiểm trước khi nộp Google Play & App Store

> Vòng R3 · 14/11/2026 · agent `store`. Một mã web — một Firebase project — ba bản: **Web** (GitHub Pages), **Android** (AAB), **iOS** (TestFlight/App Store).
> Tài liệu liên quan: `README-store.md` (hướng dẫn dài), `docs/STORE-COMPLIANCE.md` (đối chiếu chính sách chi tiết), `docs/STORE-LISTING.md` (marketing), `store/` (nội dung dán sẵn), `docs/qa/R3-store.md` (lỗi đã sửa vòng này).
> **Giới hạn:** bộ đóng gói được kiểm tĩnh (YAML, cú pháp script, chạy thử bộ vá trên project mẫu) — CHƯA build thật vì môi trường soạn thảo không có Android SDK/Xcode/mạng. Lần chạy workflow đầu tiên trên GitHub là lần kiểm thật; lỗi (nếu có) gửi log để chỉnh. Chính sách store đổi thường xuyên: các mốc bên dưới đúng tại 11/2026, **kiểm lại lúc nộp**.

Ký hiệu trạng thái: ✅ **Đạt** · 🟡 **Chưa đạt — agent/module** (việc của đội mã, ghi rõ ai) · 🔴 **Việc chủ dự án** (không ai làm thay được) · 🔍 **Kiểm trên máy thật** sau bản build đầu.

---

## 0. Tóm tắt — còn chặn phát hành

| # | Việc | Ai |
|---|---|---|
| 1 | Điền `firebase-config.js` (đang trống ⇒ bản store bị workflow chặn; reviewer thấy “chế độ demo” ⇒ từ chối 2.1) + publish `firestore.rules`, `storage.rules`, indexes + deploy `functions/` (xoá tài khoản, thu hồi token Apple) | 🔴 Chủ dự án (§E bước 1) |
| 2 | Điền email hỗ trợ + tên nhà phát triển trong `privacy-policy.html` (còn 6 chỗ `[ĐIỀN …]`) | 🔴 Chủ dự án |
| 3 | Tài khoản Google Play Developer + Apple Developer, keystore, secrets, tạo app trên 2 console, điền form | 🔴 Chủ dự án (§E) |
| 4 | Ẩn mọi thứ “Sắp ra mắt”, gian hàng trống, nút mạng xã hội chưa cấu hình trên bản store — đọc cờ `FK_BUILD` (§D) | 🟡 pt / commerce / core / ux |
| 5 | Nhãn “Phân tích AI (mô phỏng)” + hộp thoại đồng ý trước khi gửi ảnh cho AI bên thứ ba | 🟡 core (`app.js`) |
| 6 | Thử nghiệm kín 12 người × 14 ngày (Google Play, tài khoản cá nhân mới) | 🔴 Chủ dự án (§E bước 4) |
| 7 | Chạy thử bản build đầu trên máy thật theo §F | 🔴 Chủ dự án + 🔍 |

---

## A. Pipeline 3 bản

### A1. Web (GitHub Pages) — ✅ đang chạy
- Nguồn: nhánh `main`, thư mục gốc. `deploy-bundle.yml` giải nén `deploy-bundle.zip` → commit → Pages tự cập nhật. Vòng này: gói không còn chép đè `.git/`, `www/`, `android/`, `ios/`; tự bỏ tệp bí mật (`*.keystore`, `*.p12`, `*.p8`, `google-services.json`, `GoogleService-Info.plist`, `.env`) khỏi repo công khai; từ chối symlink.
- Lưu ý: commit do `deploy-bundle` đẩy **không** tự kích hoạt build Android/iOS (giới hạn của `GITHUB_TOKEN`) → vào Actions bấm **Run workflow** khi cần bản native mới.
- Bản web không có `window.FK_BUILD` (= web, không ẩn gì).

### A2. Android — `.github/workflows/build-android.yml`

| Hạng mục | Cấu hình | Trạng thái |
|---|---|---|
| AAB ký release | Ký bằng Gradle (`-Pandroid.injected.signing.*`), kiểm lại bằng `jarsigner -verify`, kèm `FitKit-release.apk` cùng khoá để thử. Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Thiếu khoá → chỉ `FitKit-debug.apk` + cảnh báo vàng ở trang tổng kết. Có khoá nhưng sai mật khẩu/alias → dừng với thông báo rõ | ✅ (🔍 lần chạy đầu) |
| targetSdk | `compileSdk = targetSdk = 36` (Android 16). Yêu cầu Google Play tại 11/2026: app mới & bản cập nhật target **API 36** (tối thiểu tuyệt đối để còn hiển thị cho người dùng mới: 35). **Kiểm lại** https://developer.android.com/google/play/requirements/target-sdk lúc nộp; đổi nhanh bằng ô `target_sdk` khi Run workflow | ✅ |
| Công cụ build | Capacitor 6 mặc định AGP 8.2.1 **không đọc được SDK 35/36** ⇒ bộ vá nâng AGP 8.9.1 + Gradle 8.11.1 + google-services 4.4.2, JDK 21, `minSdk` 23 | ✅ (🔍) — nếu Gradle báo lỗi tương thích plugin: phương án dự phòng là nâng cả bộ `@capacitor/*` lên 7.x (xem `docs/qa/R3-store.md` §Rủi ro) |
| versionCode / versionName | `versionCode = run_number + ANDROID_VERSION_CODE_OFFSET` (biến repo, mặc định 0) · `versionName` = `package.json` → `version` | ✅ — nếu Play báo “Version code đã dùng”: đặt biến `ANDROID_VERSION_CODE_OFFSET` lớn hơn số đã upload |
| google-services.json | Secret `GOOGLE_SERVICES_JSON_BASE64` (tên cũ `ANDROID_GOOGLE_SERVICES_JSON` vẫn nhận). Workflow kiểm đúng package `vn.thangvu.fitkit`. Thiếu → build vẫn chạy, plugin đăng nhập native bị gỡ, `FK_BUILD.authProviders = []` | ✅ / 🔴 tạo secret |
| Quyền (manifest) | `INTERNET`, `POST_NOTIFICATIONS`, `VIBRATE`, `CAMERA` (uses-feature `required=false` — chụp ảnh tiến trình, quét QR) + `RECEIVE_BOOT_COMPLETED`/`WAKE_LOCK` của plugin thông báo. **Không** vị trí/danh bạ/micro/bộ nhớ/`AD_ID`. Bước “Soát quyền” đọc merged manifest và **làm đỏ build** nếu có quyền thừa | ✅ |
| `SCHEDULE_EXACT_ALARM` | Mặc định **không xin**: nhắc giờ tập/báo hết giờ nghỉ dùng báo thức thường (khi máy khoá có thể trễ; khi app đang mở thì đồng hồ trong app vẫn rung/kêu đúng giờ). Muốn đúng từng giây khi khoá máy: đặt biến repo `ANDROID_EXACT_ALARM=1` — khi đó phải (1) có màn hướng dẫn người dùng Android 14+ cấp quyền “Báo thức & lời nhắc”, (2) giải thích với Play: “user-set rest timer / workout reminders”. Không bao giờ dùng `USE_EXACT_ALARM` (chỉ cho app báo thức/lịch) | ✅ quyết định mặc định · 🔴 nếu muốn bật |
| Icon adaptive + splash | `@capacitor/assets` từ `assets/icon-foreground.png` + `icon-background.png` + `splash(-dark).png`. Bản phát hành: tạo icon lỗi → **dừng** (không nộp icon mặc định của Capacitor) | ✅ (🔍 xem icon tròn/vuông trên máy) |
| Edge-to-edge Android 15+ | `store/native/android/MainActivity.java`: đệm vùng nội dung theo inset thanh trạng thái/điều hướng/tai thỏ/bàn phím; nền vùng đệm `#061A24`, biểu tượng hệ thống màu sáng. Màn dọc trên điện thoại | ✅ (🔍 §F: bàn phím không che ô nhập, thanh dưới không đè nút) |
| Nút Back | `app.js` → `fkHandleBack()` qua `@capacitor/app` (đóng sheet → về màn trước → thoát) | ✅ |
| Deep link | **Chưa có** (không có App Links / custom scheme; mã mời PT nhập tay hoặc quét QR). GitHub Pages dạng project không đặt được `/.well-known/assetlinks.json` ở gốc tên miền ⇒ cần tên miền riêng mới làm App Links | 🟡 để sau (không chặn duyệt) |
| R8/ProGuard | `minifyEnabled false` (mặc định Capacitor) — không bật để không hỏng cầu nối plugin; kích thước AAB vẫn nhỏ vì phần lớn là tài nguyên web | ✅ |
| WebView | `webContentsDebuggingEnabled=false`, `allowMixedContent=false`, `androidScheme=https`. `CapacitorHttp` **tắt** (bật sẽ làm hỏng realtime Firestore + upload Storage — R3-STORE-01) | ✅ |
| Cờ nền tảng | `FK_PLATFORM=android`, `STORE_BUILD=1` khi có khoá ký → `window.FK_BUILD` | ✅ |

### A3. iOS — `.github/workflows/ios-appstore.yml` (nộp) · `build-ios.yml` (bản thử chưa ký)

| Hạng mục | Cấu hình | Trạng thái |
|---|---|---|
| Bundle id | `vn.thangvu.fitkit` (`capacitor.config.json`); workflow kiểm `GoogleService-Info.plist` và provisioning profile đúng bundle | ✅ |
| Ký + upload | Mặc định **ký tự động** bằng App Store Connect API key: secrets `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_P8` (base64 file .p8), `APPLE_TEAM_ID`. Tuỳ chọn **ký tay**: `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`. Ô `upload` (mặc định bật) → TestFlight; tắt → artifact `FitKit-appstore-ipa`. Khoá bị xoá khỏi máy ảo sau khi chạy | ✅ (🔍 lần chạy đầu) |
| Firebase iOS | Secret `IOS_GOOGLE_SERVICE_INFO_PLIST` (hoặc `GOOGLE_SERVICE_INFO_PLIST_BASE64`). **Thiếu → workflow nộp DỪNG** (không có thì nút Apple/Google chết ⇒ từ chối 2.1/4.8); thử nội bộ: ô `allow_no_social` | ✅ / 🔴 tạo secret |
| Info.plist — quyền | Chỉ 3 chuỗi, Việt + Anh, nêu rõ lý do: `NSCameraUsageDescription` (ảnh tiến trình, quét QR), `NSMicrophoneUsageDescription` (chỉ khi tự quay video đăng Khoảnh khắc — thiếu chuỗi này iOS đóng app khi chọn “Quay video”), `NSPhotoLibraryAddUsageDescription` (lưu ảnh). Đã **bỏ** `NSPhotoLibraryUsageDescription` (chọn ảnh qua trình chọn hệ thống, không cần quyền). Không vị trí/danh bạ/Bluetooth/HealthKit | ✅ |
| `ITSAppUsesNonExemptEncryption` | `false` | ✅ |
| Privacy manifest | `PrivacyInfo.xcprivacy` trong target App: `NSPrivacyTracking=false`, 13 loại dữ liệu khớp App Privacy, required-reason API: UserDefaults `CA92.1`, File timestamp `C617.1`. Workflow kiểm file có trong bản archive | ✅ (🔍 nếu Apple gửi email ITMS-91053 kể thêm API nào thì bổ sung vào file) |
| Sign in with Apple | Entitlement `com.apple.developer.applesignin` + `CODE_SIGN_ENTITLEMENTS`; ký tay: workflow kiểm profile có capability | ✅ mã · 🔴 bật capability cho App ID + cấu hình Apple trong Firebase Auth |
| App Tracking Transparency | App **không** theo dõi chéo ⇒ không có `NSUserTrackingUsageDescription`, không gọi ATT; App Privacy khai “Not used for tracking” | ✅ |
| Thiết bị | **Chỉ iPhone** (`TARGETED_DEVICE_FAMILY=1`), chỉ màn dọc — giao diện chưa tối ưu iPad. Reviewer vẫn có thể chạy trên iPad ở chế độ iPhone → §F kiểm | ✅ (🔍) |
| Xcode / SDK | Workflow tự chọn Xcode mới nhất trên máy ảo và cảnh báo nếu < 26 (Apple yêu cầu build bằng Xcode 26 / iOS 26 SDK từ 4/2026 — kiểm mức hiện hành) | ✅ (🔍) |
| Số phiên bản | `CFBundleShortVersionString` = `package.json` version · `CFBundleVersion` = `run_number` | ✅ |
| Cờ nền tảng | `FK_PLATFORM=ios STORE_BUILD=1` → `window.FK_BUILD = {platform:"ios", store:true, hide:{externalDigitalPay:true,…}}` | ✅ |

### Bảng secrets (Settings → Secrets and variables → Actions)

| Secret | Bản | Bắt buộc? | Lấy ở đâu |
|---|---|---|---|
| `ANDROID_KEYSTORE_BASE64` · `ANDROID_KEYSTORE_PASSWORD` · `ANDROID_KEY_ALIAS` · `ANDROID_KEY_PASSWORD` | Android | Cho AAB | §E bước 2 |
| `GOOGLE_SERVICES_JSON_BASE64` | Android | Cho đăng nhập Google | Firebase → Project settings → app Android |
| `APPSTORE_KEY_ID` · `APPSTORE_ISSUER_ID` · `APPSTORE_KEY_P8` · `APPLE_TEAM_ID` | iOS | Có | §E bước 6 |
| `IOS_GOOGLE_SERVICE_INFO_PLIST` | iOS | Có (bản nộp) | Firebase → Project settings → app iOS |
| `IOS_DIST_CERT_P12_BASE64` · `IOS_DIST_CERT_PASSWORD` · `IOS_PROVISIONING_PROFILE_BASE64` | iOS | Không (ký tay) | developer.apple.com → Certificates / Profiles |
| Biến (Variables): `ANDROID_VERSION_CODE_OFFSET`, `ANDROID_EXACT_ALARM` | Android | Không | — |

---

## B1. Google Play — đối chiếu chính sách

| Mục | Yêu cầu | Trạng thái |
|---|---|---|
| Target API | API 36 (kiểm lại lúc nộp) | ✅ workflow |
| **Data safety** | Điền đúng dữ liệu app thật sự thu — câu trả lời sẵn: `store/google-play/data-safety.md` | ✅ nội dung · 🔴 dán vào form |
| **Health apps declaration** | Activity & fitness + Nutrition & weight management + Sleep management; không phải thiết bị y tế — `store/google-play/declarations.md` | ✅ nội dung · 🔴 khai |
| Health Content & Services | Mô tả không có tuyên bố chữa bệnh; có câu miễn trừ y khoa (đã thêm vào 4 file mô tả trong `store/`); trong app có sàng lọc PAR-Q+ + miễn trừ (health-safety.js) | ✅ |
| **UGC** | Điều khoản cấm nội dung xấu, **Báo cáo** + **Chặn** trong app, kiểm duyệt (bảng quản trị), xử lý trong 24 giờ | ✅ API + giao diện chính (cloud-social, community, events, findpt, pt-connect) · 🔍 bấm thử từng nơi có nội dung người khác |
| **Xoá tài khoản** | Trong app (Hồ sơ → Tài khoản) **và** URL web `…/delete-account.html` khai ở Data safety | ✅ mã · 🔴 cần Firebase + deploy Functions thì mới chạy thật |
| Privacy policy | URL mở được, không còn chỗ trống | 🔴 điền `[ĐIỀN …]` |
| Content rating (IARC) | Trả lời sẵn trong `declarations.md` (có tương tác người dùng) | 🔴 khai |
| Target audience | **18+** (hoặc 13+), không nhắm trẻ em; không tick < 13 | 🔴 khai |
| Ads / Advertising ID | Không quảng cáo; quyền `AD_ID` bị gỡ | ✅ · 🔴 khai “No” |
| App access | 2 tài khoản thử (PT + học viên) cho reviewer | 🔴 tạo + khai |
| **Thử nghiệm kín** | Tài khoản developer **cá nhân** tạo sau 13/11/2023: ≥ **12 người** tham gia liên tục **14 ngày** trước khi xin quyền Production (kiểm con số hiện hành trong Play Console → Dashboard) | 🔴 §E bước 4 |
| Quyền nhạy cảm | Không ảnh/video (`READ_MEDIA_*`), không exact alarm, không vị trí nền, không All files | ✅ workflow soát |
| Minimum functionality / WebView | App có chức năng riêng, chạy offline, không chỉ là trang web | ✅ |
| Thanh toán (Payments policy) | Không bán nội dung số trong app. Gian hàng = hàng vật lý (COD/chuyển khoản) — được miễn Play Billing. Buổi PT trực tiếp = dịch vụ ngoài đời — được miễn | ✅ — 🟡 commerce: không thêm “gói Premium/giáo án trả tiền” thanh toán ngoài |
| AI-generated content | Có nút báo cáo ở kết quả AI | 🟡 core (STORE-COMPLIANCE §2.6) |
| Màn “Sắp ra mắt”/trống | Xem B2 mục 2.1 (Play cũng xét “broken/incomplete functionality”) | 🟡 |
| Tên, icon, ảnh | Tên ≤ 30, không chữ “free/#1/best”, icon 512, feature graphic 1024×500, ≥ 2 ảnh điện thoại | ✅ nội dung `store/` · 🔴 ảnh |

## B2. App Store — đối chiếu App Review Guidelines

| Guideline | Yêu cầu | Trạng thái |
|---|---|---|
| **1.2** UGC | Lọc/kiểm duyệt, **Báo cáo**, **Chặn người dùng**, thông tin liên hệ, xử lý ≤ 24 giờ, điều khoản không dung thứ nội dung xấu | ✅ (API `cloud.blockUser`, nút Báo cáo/Chặn ở Cộng đồng, Sự kiện, Tìm PT, chat) · 🔍 reviewer sẽ tìm nút này — ghi đường dẫn trong ghi chú review |
| **1.4.1** Sức khoẻ | Miễn trừ y khoa, khuyên hỏi bác sĩ, công thức có nguồn, không tuyên bố chẩn đoán/điều trị | ✅ health-safety.js + mô tả store · 🟡 core: đổi nhãn “Phân tích AI (mô phỏng)” (`app.js` ~dòng 3027) thành “Ước tính theo công thức (không dùng AI)” |
| **2.1** Hoàn thiện | Không nút chết, không “Sắp ra mắt”, không màn trống, không chế độ demo, đăng nhập mạng xã hội phải chạy | 🟡 **rủi ro lớn nhất**: (a) thẻ vai trò “Tìm & Book PT — Sắp ra mắt” (`pt.js` ~321) — bản store đã tự ẩn bằng CSS của `fk-build.js`; (b) thẻ “Sắp ra mắt” ở `coach.js` ~302 (findpt.js thay lúc chạy — kiểm); (c) **gian hàng chưa có sản phẩm thật / chưa có tài khoản nhận tiền** → khuyến nghị **ẩn lối vào gian hàng trên bản store** tới khi có hàng (`FK_BUILD.hide.emptyShop`); (d) chương/tính năng “Sắp ra mắt” (đồng hồ thông minh…) → ẩn (`FK_BUILD.hide.comingSoon`); (e) nút Facebook trên native chưa cấu hình → ẩn theo `FK_BUILD.authProviders`. 🔴 Firebase phải cấu hình |
| **2.3** Metadata chính xác | Mô tả/ảnh khớp app; không nhắc tính năng chưa có, store khác | ✅ `store/` (đã bỏ “Facebook” khỏi mô tả store) · 🔴 ảnh chụp từ bản thật |
| **2.3.1** Tính năng ẩn | Không lối vào ẩn; bảng quản trị ghi rõ trong ghi chú review | ✅ |
| **2.5.1 / HealthKit** | Không dùng HealthKit, không nhắc “Apple Health” | ✅ |
| **3.1.1** IAP | Không mở khoá nội dung/tính năng số bằng thanh toán ngoài. Hiện app miễn phí, không IAP | ✅ — 🟡 commerce/pt: trên iOS **không** hiện link/QR thanh toán cho hàng số (gói giáo án, gói Premium, khoá học video) → đọc `FK_BUILD.hide.externalDigitalPay` |
| **3.1.3(e)** Hàng vật lý/dịch vụ ngoài đời | Gian hàng quần áo/phụ kiện, buổi PT trực tiếp: **phải** thanh toán ngoài IAP (COD/chuyển khoản) | ✅ |
| **3.1.3(d)** Dịch vụ 1-1 | PT online 1 kèm 1 theo thời gian thực: được thanh toán ngoài. Lớp nhóm/1-nhiều trực tuyến: phải IAP | ✅ hiện không bán lớp nhóm online |
| **4.2** Minimum functionality | Không chỉ bọc web. Điểm native: thông báo cục bộ lên lịch (nhắc tập, hết giờ nghỉ khi khoá máy), haptics, share sheet, đăng nhập Apple/Google bằng SDK gốc, camera, giữ sáng màn hình, toàn bộ mã + 800 bài tập đóng gói offline | ✅ — liệt kê trong `store/app-store/review-notes-en.md` |
| **4.8** Login services | Có Google ⇒ phải có **Sign in with Apple** tương đương | ✅ nút + entitlement + plugin · 🔴 bật capability, cấu hình Apple provider trong Firebase, tạo secret plist |
| **5.1.1(i)** Privacy policy | Link trong App Store Connect **và** trong app | ✅ trong app · 🔴 điền chỗ trống |
| **5.1.1(ii)/(iii)** Quyền | Xin đúng lúc, chuỗi mô tả cụ thể, từ chối vẫn dùng được app | ✅ (🔍 từ chối camera → app không treo) |
| **5.1.1(iv)** | Không ép đăng nhập cho tính năng không cần tài khoản (“Dùng ngay, không cần tài khoản”) | ✅ |
| **5.1.1(v)** Xoá tài khoản | Xoá trong app, dễ tìm, xoá thật, thu hồi token Sign in with Apple | ✅ mã (`deleteMyAccount`) · 🔴 deploy Functions + secret `APPLE_PRIVATE_KEY` |
| **5.1.2(i)** Chia sẻ cho AI bên thứ ba | Hộp thoại đồng ý nêu tên nhà cung cấp trước lần gửi đầu | 🟡 core (`app.js` `callVisionAI`) |
| **App Privacy** | “Nutrition labels” khớp privacy manifest — `store/app-store/app-privacy.md` | ✅ nội dung · 🔴 dán |
| **ATT** | Không theo dõi ⇒ không khai tracking, không hiện ATT | ✅ |
| **Tài khoản demo + ghi chú review** | Tiếng Anh, đủ 2 vai trò — `store/app-store/review-notes-en.md` | ✅ nội dung · 🔴 tạo tài khoản, dán |
| iPad | Chỉ iPhone; vẫn phải chạy được trên iPad ở chế độ tương thích | ✅ (🔍) |
| Export compliance | `ITSAppUsesNonExemptEncryption=false` | ✅ |

---

## C. Metadata dán sẵn — thư mục `store/`
Xem `store/README.md`. Tên/phụ đề/mô tả ngắn-dài (Việt + Anh), từ khoá, ghi chú phát hành, ghi chú reviewer (Anh), Data safety, App Privacy, khai báo App content, hướng dẫn + script ảnh chụp (`scripts/store-screenshots.py`: 6.9"/6.7"/6.5"/5.5" iOS, điện thoại Android).

---

## D. Cờ nền tảng `window.FK_BUILD` (đã cài trong `scripts/prepare-www.sh`)

`prepare-www.sh` sinh `www/fk-build.js` và chèn làm **script đầu tiên** của `www/index.html` (tự vào danh sách precache của `www/sw.js`). Không cần sửa `index.html`/`sw.js` gốc.

```js
window.FK_BUILD = {
  platform: "web" | "android" | "ios",   // FK_PLATFORM
  store: true | false,                   // STORE_BUILD=1 (bản nộp store)
  version: "2.0.0", build: "57",
  authProviders: null | ["apple","google"] | [],   // null = web (không giới hạn); [] = plugin đăng nhập native bị gỡ
  hide: { comingSoon, emptyShop, externalDigitalPay }   // true/false — externalDigitalPay chỉ true trên iOS store
};
// <html data-fk-platform="ios" data-fk-store="1">
```

Cách dùng (bản web không có biến này → luôn viết `(window.FK_BUILD || {})`):
- JS: `const B = window.FK_BUILD || {}; if (B.hide && B.hide.comingSoon) return "";`
- Không cần JS: thêm thuộc tính `data-store-hide` (ẩn trên mọi bản store), `data-store-hide="ios"` hoặc `data-store-hide="android"` vào phần tử. `.role-card.soon` đã tự ẩn trên bản store.

**Chuyển giao — module cần đọc cờ:**

| Module (chủ) | Việc |
|---|---|
| `pt.js` (pt) | Ẩn nút mạng xã hội không có trong `FK_BUILD.authProviders` (Facebook trên native; cả 3 nút khi `[]`). Bỏ/ẩn vai trò “Tìm & Book PT — Sắp ra mắt” khi `hide.comingSoon` (đã có lớp CSS dự phòng) |
| `coach.js`, `findpt.js` (pt) | Thẻ “Sắp ra mắt” (`soon-badge`) không xuất hiện khi `hide.comingSoon` |
| `shop.js`, `shop-data.js` (commerce) | `hide.emptyShop` + chưa có sản phẩm thật/tài khoản nhận tiền → ẩn lối vào gian hàng (không hiện “Chưa có sản phẩm”). `hide.externalDigitalPay` → không hiện thanh toán ngoài cho hàng số trên iOS |
| `app.js`, `ui-signature.js`, `kb.js`… (core/ux) | Ẩn chương/tính năng “Sắp ra mắt” (đồng hồ thông minh…) khi `hide.comingSoon`; ẩn “Sao lưu Google Drive” khi `platform !== "web"` (đang dựa vào `isNative()` — giữ) |
| `themes.js` (ux) | Gọi `Capacitor.Plugins.StatusBar` nhưng plugin `@capacitor/status-bar` chưa có trong `package.json` ⇒ không tác dụng. Android: thanh trạng thái do `MainActivity` lo (nền tối, biểu tượng sáng). iOS: màu chữ thanh trạng thái theo chế độ sáng/tối của máy — nếu muốn theo theme app: thêm `@capacitor/status-bar@^6` (store sẽ thêm khi ux yêu cầu) |
| i18n (ux) | Chuỗi mới của vòng này: không có chuỗi giao diện trong app (chỉ tài liệu/metadata) |

---

## E. Việc chủ dự án BẮT BUỘC tự làm (theo thứ tự)

> Cần: thẻ Visa/Mastercard thanh toán quốc tế, giấy tờ tuỳ thân, 1 điện thoại Android + 1 iPhone để thử, máy tính Windows có cài Java (để chạy `keytool`; tải Temurin JDK tại adoptium.net).

**Bước 1 — Firebase (1 project dùng chung cho web + Android + iOS)**
1. https://console.firebase.google.com → mở (hoặc tạo) project TapEasy. Authentication → Sign-in method: bật **Email/Password**, **Google**, **Apple** (Apple làm sau bước 5.3).
2. Firestore: tạo database (asia-southeast1) → dán `firestore.rules` → Publish. Storage: dán `storage.rules`. Indexes: theo `firestore.indexes.json`. (Hoặc dùng Firebase CLI: `firebase deploy --only firestore,storage`.)
3. Project settings → Your apps → **Web app** → copy cấu hình vào `firebase-config.js` → đẩy lên GitHub.
4. Nâng gói **Blaze** rồi `firebase deploy --only functions` (thư mục `functions/`) — cần cho xoá tài khoản, kiểm duyệt. Đặt secret `APPLE_PRIVATE_KEY` + `functions/.env` theo `docs/STORE-COMPLIANCE.md` §0 mục 3.
5. Điền email hỗ trợ + tên nhà phát triển vào `privacy-policy.html` (tìm `[ĐIỀN`). Mở thử 2 link: `…/privacy-policy.html`, `…/delete-account.html`.
6. Tạo 2 tài khoản demo trong app web: **PT demo** và **Học viên demo**, nối mã mời, tạo vài buổi tập + tin nhắn. Ghi lại email/mật khẩu.

**Bước 2 — Khoá ký Android (làm 1 lần, GIỮ SUỐT ĐỜI app)**
1. Mở PowerShell tại một thư mục riêng, chạy (tự đặt mật khẩu, nhớ kỹ):
   `keytool -genkeypair -v -keystore fitkit-release.keystore -alias fitkit -keyalg RSA -keysize 2048 -validity 10000`
2. Chép `fitkit-release.keystore` + mật khẩu vào **2 nơi an toàn** (ổ cứng ngoài + trình quản lý mật khẩu). KHÔNG đưa lên GitHub, KHÔNG gửi qua chat.
3. Lấy vân tay: `keytool -list -v -keystore fitkit-release.keystore -alias fitkit` → ghi **SHA-1** và **SHA-256**.
4. Chuyển base64: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("fitkit-release.keystore")) | Set-Clipboard`
5. GitHub → repo `fitkit-app` → Settings → Secrets and variables → Actions → **New repository secret**, tạo 4 secret: `ANDROID_KEYSTORE_BASE64` (dán clipboard), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (= `fitkit`), `ANDROID_KEY_PASSWORD`.
6. Firebase → Project settings → Add app → **Android**, package `vn.thangvu.fitkit`, dán SHA-1 + SHA-256 ở bước 3 → tải `google-services.json` → base64 như bước 4 → secret `GOOGLE_SERVICES_JSON_BASE64`.
7. Actions → “Android — APK thử + AAB nộp Google Play” → **Run workflow** → tải artifact `FitKit-android` (có `FitKit-release.aab`). Cài `FitKit-release.apk` lên máy Android, thử theo §F.

**Bước 3 — Google Play Console**
1. https://play.google.com/console → đăng ký tài khoản nhà phát triển (**25 USD**, một lần), loại *Personal* (hoặc *Organization* nếu có công ty + mã D-U-N-S — tài khoản tổ chức **không** phải thử nghiệm kín 12 người). Xác minh danh tính + **xác minh thiết bị Android thật** bằng app Play Console trên điện thoại.
2. **Create app**: tên `TapEasy: Tập Gym, Calo & PT`, ngôn ngữ mặc định Tiếng Việt, loại App, Free. Tick 2 cam kết.
3. Dashboard → “Set up your app”: làm lần lượt Privacy policy, App access, Ads, Content rating, Target audience, Data safety, Health apps, Advertising ID, Government, Financial — chép từ `store/google-play/declarations.md` và `data-safety.md`.
4. Main store listing: dán từ `store/google-play/vi-VN/`; thêm bản dịch English từ `en-US/`; tải icon `assets/icon-512.png`, feature graphic 1024×500, ≥ 4 ảnh điện thoại 1080×1920 (`store/screenshots/README.md`).
5. Test and release → **App integrity** → bật Play App Signing (mặc định) → sau lần upload đầu, copy **SHA-1 + SHA-256 của “App signing key certificate”** → thêm vào app Android trong Firebase (nếu không, đăng nhập Google trên bản tải từ Play sẽ lỗi) → tải lại `google-services.json` → cập nhật secret → build lại.

**Bước 4 — Thử nghiệm kín (bắt buộc với tài khoản cá nhân mới)**
1. Testing → **Closed testing** → Create track → Create new release → upload `FitKit-release.aab` → dán `release-notes.txt` → Save → Review → Start rollout.
2. Testers → tạo danh sách email (Gmail) của **ít nhất 12 người** (nên mời 15–20 để trừ hao) → gửi họ link opt-in → họ phải **bấm tham gia và cài app từ Play**, giữ không rời nhóm **14 ngày liên tục**.
3. Trong 14 ngày: phát hành ít nhất 1–2 bản cập nhật sửa lỗi theo góp ý (Google hỏi về việc này).
4. Hết 14 ngày: Dashboard → **Apply for production access** → trả lời câu hỏi về quá trình thử → chờ duyệt (thường ≤ 7 ngày) → Production → Create release → dùng lại bản AAB mới nhất → gửi duyệt.

**Bước 5 — Apple Developer**
1. https://developer.apple.com/programs/enroll → đăng ký **Apple Developer Program (99 USD/năm)** bằng Apple ID đã bật xác thực 2 lớp; cá nhân: tên pháp lý sẽ hiện làm “Seller”.
2. developer.apple.com/account → Certificates, IDs & Profiles → **Identifiers → +** → App IDs → App → Bundle ID *Explicit* `vn.thangvu.fitkit` → tick **Sign In with Apple** → Register.
3. Cấu hình Apple cho Firebase (để nút Apple chạy trên web/Android và để thu hồi token): tạo **Services ID** + **Key** (Sign In with Apple) theo `README-store.md` §1c → Firebase → Authentication → Apple → Enable.
4. Firebase → Add app → **iOS**, bundle `vn.thangvu.fitkit` → tải `GoogleService-Info.plist` → base64 → secret `IOS_GOOGLE_SERVICE_INFO_PLIST`.

**Bước 6 — App Store Connect**
1. https://appstoreconnect.apple.com → Business: ký thoả thuận **Free Apps** (đủ cho app miễn phí).
2. Users and Access → Integrations → **App Store Connect API** → Generate API Key, quyền **Admin** → tải `AuthKey_XXXX.p8` (chỉ tải được 1 lần). Tạo secrets: `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_P8` (base64 của file .p8), `APPLE_TEAM_ID` (Membership details).
3. Apps → **+ New App**: iOS, tên `TapEasy: Tập Gym, Calo & PT`, ngôn ngữ chính Vietnamese, Bundle ID `vn.thangvu.fitkit`, SKU `tapeasy-ios`.
4. GitHub → Actions → “iOS — bản nộp App Store (TestFlight)” → Run workflow. 15–30 phút sau bản build hiện ở tab TestFlight → cài app **TestFlight** trên iPhone → thử theo §F.
5. Trang phiên bản 2.0.0: dán `store/app-store/vi/*` (+ English), tải ảnh 6.7"/6.9", điền Support URL/Marketing URL/Privacy Policy URL (`store/metadata.json`), **App Privacy** (`app-privacy.md`), Age Rating, Category, Content Rights, Pricing (Free), chọn build, **App Review Information** (tài khoản demo + Notes từ `review-notes-en.md`).
6. **Add for Review → Submit**. Bị từ chối: đọc lý do trong Resolution Center, sửa, trả lời bằng tiếng Anh lịch sự; đừng nộp lại y nguyên.

**Bước 7 — Sau khi lên store**
- Mỗi bản cập nhật: tăng `version` trong `package.json` (vd 2.0.1) → đẩy mã → Run workflow → upload/duyệt. versionCode/build tự tăng.
- Gia hạn Apple 99 USD mỗi năm (hết hạn = app bị gỡ). Trả lời email chính sách của Google/Apple trong hạn. Mỗi năm nâng target API theo yêu cầu mới của Google (thường hạn 31/8).

---

## F. Kiểm trên máy thật sau bản build đầu (30 phút)

| # | Kiểm | Android | iOS |
|---|---|---|---|
| 1 | Mở app lần đầu: splash → màn chào, không trắng màn, icon đúng (không phải logo Capacitor) | ☐ | ☐ |
| 2 | Không thấy chữ “demo”, “Sắp ra mắt”, gian hàng trống, nút bấm không phản hồi | ☐ | ☐ |
| 3 | Đăng ký email → đăng xuất → đăng nhập; **Google**; **Apple** (iOS bắt buộc chạy) | ☐ | ☐ |
| 4 | PT thêm học viên → học viên nhập mã trên máy kia → thấy bài giao, chat 2 chiều (realtime) | ☐ | ☐ |
| 5 | Vùng an toàn: thanh trên/dưới không đè nội dung; **bàn phím không che ô nhập** (chat, ghi kg); xoay ngang không vỡ (đã khoá dọc) | ☐ (Android 15/16 **và** 1 máy ≤ 14) | ☐ (máy có Dynamic Island + SE) |
| 6 | Bật nhắc nhở → hộp thoại xin quyền thông báo → đặt nhắc 2 phút sau → khoá máy → có thông báo | ☐ | ☐ |
| 7 | Vào tập → hết giờ nghỉ: rung + âm; khoá máy vẫn báo (Android không exact alarm: có thể trễ) | ☐ | ☐ |
| 8 | Chụp ảnh tiến trình: hộp thoại xin camera hiện đúng chuỗi; **từ chối** → app không treo; quét QR mã PT | ☐ | ☐ |
| 9 | Đăng ảnh + **quay video** vào Khoảnh khắc sự kiện (iOS: hộp thoại micro, không văng app) | ☐ | ☐ |
| 10 | Chia sẻ mã mời → mở share sheet hệ thống; link ngoài mở trình duyệt trong app | ☐ | ☐ |
| 11 | Nút Back Android: đóng sheet → về trước → thoát; không thoát đột ngột giữa buổi tập | ☐ | — |
| 12 | Tắt mạng (chế độ máy bay): app vẫn mở, tập + ghi nhật ký được; bật lại → đồng bộ | ☐ | ☐ |
| 13 | Báo cáo + Chặn một bài/người; **Xoá tài khoản** trong app → đăng nhập lại không được | ☐ | ☐ |
| 14 | Cài đặt máy → Ứng dụng → TapEasy → Quyền: chỉ Camera + Thông báo (Android) / Camera, Micro, Ảnh-chỉ thêm, Thông báo (iOS) | ☐ | ☐ |
| 15 | iPad (nếu có): app chạy ở khung iPhone, không lỗi bố cục | — | ☐ |

# R3 — agent `store`: đóng gói Web / Android / iOS + tuân thủ Google Play & App Store

Ngày 14/11/2026. Phạm vi file: `capacitor.config.json`, `package.json`, `.github/workflows/{build-android,build-ios,ios-appstore,tests,deploy-bundle}.yml`, `scripts/prepare-www.sh`, `scripts/build-single-html.py`, `scripts/native-*`, `scripts/store-*`, `README-store.md`, `README-ios-build.md`, `docs/STORE-COMPLIANCE.md`, `docs/STORE-LISTING.md`, `docs/RELEASE-CHECKLIST.md` (mới), `store/` (mới).
Test hồi quy: `tests/suites/85-r3-store.test.js` (16 test) — `node tests/run.js --only 85-r3-store`.

**Giới hạn kiểm chứng (đọc trước):** môi trường soạn thảo không có mạng, Android SDK, Xcode ⇒ **chưa build thật**. Đã kiểm: YAML của 5 workflow parse được, mọi khối `run:` qua `bash -n`, script Python/Ruby đúng cú pháp, JSON/plist hợp lệ, bộ vá Android/iOS **chạy thật trên project mẫu** dạng Capacitor 6 (test 02/03/04/09), khối sinh `fk-build.js` chạy thật (test 11), `prepare-www.sh` chạy trọn vẹn trên bản sao mã nguồn. Chưa kiểm được: Gradle/AGP với plugin thật, `xcodebuild`, gem `xcodeproj` trên project thật, ký/upload. Lần chạy workflow đầu tiên trên GitHub là phép thử thật — xem §Rủi ro.

## Bảng lỗi

| Mã | Mức | File:dòng (trước khi sửa) | Mô tả · tái hiện | Sửa | Trạng thái |
|---|---|---|---|---|---|
| R3-STORE-02 | **Critical** | `build-android.yml` bước “Target API 36” | Chỉ `sed` compileSdk/targetSdk = 36 trong khi Capacitor 6 dùng AGP 8.2.1 + Gradle 8.2.1 — AGP này không xử lý được `android.jar` của SDK 35/36 ⇒ `assembleDebug` nhiều khả năng lỗi ở bước tài nguyên, **không ra AAB**. Tái hiện: chạy workflow. | `scripts/native-android-patch.py`: AGP 8.9.1, Gradle 8.11.1, google-services 4.4.2, minSdk ≥ 23, `android.suppressUnsupportedCompileSdk`; chạy sau `cap sync` (vá cả `capacitor-cordova-android-plugins`); tự kiểm, sai → CI đỏ | Đã sửa (chờ build thật xác nhận) |
| R3-STORE-01 | High | `capacitor.config.json:24` | `CapacitorHttp.enabled: true` vá `fetch`/`XMLHttpRequest` toàn cục sang HTTP gốc (không stream) ⇒ kênh realtime của Firestore JS SDK và upload Storage trên app native dễ treo/lỗi; bản web không bị nên không ai thấy. | Tắt (`enabled:false`); mọi API app gọi đều đã có CORS (chạy được trên web) | Đã sửa |
| R3-STORE-03 | High | (thiếu) | Target 35+ trên Android 15/16 bị ép edge-to-edge; Capacitor 6 không xử lý inset ⇒ nội dung nằm dưới thanh trạng thái/điều hướng, bàn phím che ô nhập. | `store/native/android/MainActivity.java` (đệm theo inset system bars + cutout + IME, chỉ từ API 35), bộ vá chép đúng package | Đã sửa (cần xem trên máy thật) |
| R3-STORE-04 | High | `build-ios.yml`, `ios-appstore.yml` bước Info.plist | Thiếu `NSMicrophoneUsageDescription` trong khi `events-media.js:520` cho chọn `video/*` ⇒ trên iOS chọn “Quay video” là **app bị hệ thống đóng**. | Thêm chuỗi (Việt + Anh) qua `scripts/native-ios-patch.py` | Đã sửa |
| R3-STORE-05 | High | (thiếu) | Không có `PrivacyInfo.xcprivacy` (STORE-COMPLIANCE ghi [CẦN LÀM]) ⇒ cảnh báo/từ chối ITMS-91053, App Privacy không có căn cứ. | `store/native/ios/PrivacyInfo.xcprivacy` + thêm vào target bằng `native-ios-xcodeproj.rb` + kiểm trong bản archive | Đã sửa |
| R3-STORE-06 | High | project iOS mặc định | Capacitor tạo app universal (iPhone + iPad); giao diện 320–430 px chưa tối ưu iPad ⇒ rủi ro từ chối vì giao diện iPad + bắt buộc ảnh iPad. | `TARGETED_DEVICE_FAMILY = 1`, bỏ orientation iPad, khoá dọc | Đã sửa |
| R3-STORE-07 | High | `ios-appstore.yml` bước “Firebase native” | Thiếu secret plist thì workflow **vẫn upload** bản không có plugin đăng nhập ⇒ nút Apple/Google báo “chưa cấu hình” = từ chối 2.1/4.8. | Dừng sớm (trừ khi `allow_no_social`); kiểm bundle id của plist; Android kiểm package trong `google-services.json` | Đã sửa |
| R3-STORE-08 | Medium | `build-android.yml` “Build AAB”, `ios-appstore.yml` | `${{ secrets.* }}` nội suy thẳng vào lệnh shell (mật khẩu có `"`/`$`/`` ` `` làm hỏng lệnh, nguy cơ chèn lệnh); AAB ký bằng `jarsigner` sau build, không kiểm; sai alias/mật khẩu báo lỗi khó hiểu. | Secrets qua `env:`; ký bằng Gradle `android.injected.signing.*`, `jarsigner -verify`, kiểm keystore trước; in SHA-1/SHA-256; `permissions: contents: read`; xoá khoá sau khi dùng | Đã sửa |
| R3-STORE-09 | Medium | `build-android.yml` bước “Quyền camera/thông báo” | `CAMERA` không kèm `uses-feature required=false` (Play ẩn app với máy không camera); thiếu `VIBRATE` (rung báo hết giờ nghỉ không chạy trong WebView); không gỡ `AD_ID`; `sed '<application'` chèn trùng khi chạy lại; không soát quyền thư viện kéo vào. | Bộ vá idempotent + `--check-merged` làm đỏ build nếu có vị trí/danh bạ/bộ nhớ/micro/exact alarm/AD_ID | Đã sửa |
| R3-STORE-10 | Medium | 3 workflow, bước icon | `npm run assets … \|\| echo` ⇒ lỗi tạo icon thì bản **phát hành** dùng icon mặc định Capacitor. | Bản phát hành: dừng | Đã sửa |
| R3-STORE-11 | Medium | `scripts/prepare-www.sh` | Không có cách nào để module biết đang chạy bản store/nền tảng nào ⇒ “Sắp ra mắt”, gian hàng trống, nút Facebook chưa cấu hình vẫn hiện trên bản nộp. | Cờ `window.FK_BUILD` (`www/fk-build.js`, script đầu tiên, tự precache) + `data-store-hide` + tự ẩn `.role-card.soon` | Đã sửa phần hạ tầng · module: Chuyển giao |
| R3-STORE-12 | Medium | `deploy-bundle.yml:31` | Gói zip có thể chép đè `.git/`, đưa `www/ android/ ios/`, khoá ký, `google-services.json`, `.env` vào repo **công khai**; symlink. | Loại các thư mục, tự xoá tệp bí mật, từ chối symlink | Đã sửa |
| R3-STORE-13 | Medium | workflow iOS | Khai `NSPhotoLibraryUsageDescription` dù không dùng (chọn ảnh qua trình chọn hệ thống); chuỗi quyền chỉ tiếng Việt, camera không nhắc quét QR. | Chỉ 3 quyền thật dùng, Việt + Anh, đúng lý do | Đã sửa |
| R3-STORE-14 | Medium | `docs/STORE-LISTING.md` §3 | Mô tả store nói “đăng nhập Facebook” (native chưa có SDK) và “số liệu sức khoẻ chỉ lưu trên máy” (mâu thuẫn Data safety: có chia sẻ với PT); thiếu câu miễn trừ y khoa (Health apps / 1.4.1). | Bản dán sẵn trong `store/` đã chỉnh 3 điểm; ghi chú trong STORE-LISTING | Đã sửa |
| R3-STORE-22 | Medium | `scripts/prepare-www.sh` danh sách `cp` | File mới của vòng này (`i18n.js`, `i18n-en*.js`, `terms.html`) không nằm trong danh sách chép ⇒ khi integrator thêm thẻ script, bản native **dừng build** (“Thiếu www/…”) hoặc thiếu từ điển/Điều khoản. | Tự chép mọi JS/CSS mà `index.html` tham chiếu + `i18n*.js` + `terms.html`; từ điển vào precache | Đã sửa |
| R3-STORE-15 | Low | `README-ios-build.md:32`, `README-store.md` §1c | Tên workflow sai (“Build unsigned iOS .ipa (FitKit)”); hướng dẫn cấu hình provider/secret cũ. | Sửa + trỏ sang RELEASE-CHECKLIST | Đã sửa |
| R3-STORE-16 | Low | `build-android.yml` | `versionCode = run_number`: tạo lại workflow là số quay về 1 ⇒ Play từ chối. | `+ vars.ANDROID_VERSION_CODE_OFFSET`; bộ vá kiểm giới hạn 2.1 tỉ | Đã sửa |
| R3-STORE-17 | Low | manifest / Info.plist | Không khoá hướng màn ⇒ xoay ngang vỡ bố cục. | Portrait (Android activity, iOS `UISupportedInterfaceOrientations`) | Đã sửa |
| R3-STORE-18 | Low | workflow iOS | Không chọn/kiểm phiên bản Xcode (Apple yêu cầu Xcode 26 từ 4/2026); ExportOptions `method: app-store` đã lỗi thời; Xcode có thể tự đổi số build. | Chọn Xcode mới nhất + cảnh báo; `app-store-connect`; `manageAppVersionAndBuildNumber=false` | Đã sửa |
| R3-STORE-19 | Low | `tests.yml` | CI không kiểm cú pháp bộ đóng gói ⇒ lỗi chỉ lộ khi build 15 phút. | Thêm bước kiểm tĩnh (bash -n, py_compile, ruby -c, JSON, plist, YAML) | Đã sửa |
| R3-STORE-20 | Low | `themes.js:133` | Gọi `Capacitor.Plugins.StatusBar` nhưng `@capacitor/status-bar` không có trong `package.json` ⇒ không tác dụng; iOS: màu chữ thanh trạng thái theo chế độ máy, có thể kém tương phản với theme. | — | Chuyển giao (ux quyết định; store thêm dependency khi được yêu cầu — lưu ý Android đã cố định biểu tượng sáng trên nền tối) |
| R3-STORE-21 | Low | — | Chưa có deep link (App Links/Universal Links) cho link mời PT; GitHub Pages dạng project không đặt được `/.well-known/` ở gốc tên miền. | — | Không sửa (cần tên miền riêng; không chặn duyệt) |
| R3-STORE-23 | Low | `scripts/build-single-html.py` | Bản 1 file không nhúng từ điển `i18n-en*.js` (i18n.js nạp theo tên lúc chạy) ⇒ bản dùng thử 1 file chỉ có tiếng Việt. | — | Không sửa vòng này (chờ ux chốt cách đăng ký từ điển; bản store/web không ảnh hưởng) |

Tổng: **1 Critical · 6 High · 8 Medium · 8 Low** — đã sửa 20, chuyển giao 1, không sửa 2.

Rà theo 7 nhóm của brief: (a)(b) kiểm đầu vào của bộ vá (version, package, target < 35, plist sai) → thoát mã 1; (c) không đụng `fitkit_state_v1`; (d) `fk-build.js` + từ điển vào precache của `www/sw.js`, cache tự đổi băm; (e) không thêm listener/timer; (f) secrets, quyền tối thiểu, deploy-bundle, `contents: read`; (g) mọi nhánh thiếu secret có thông báo tiếng Việt + tổng kết lần chạy.

## Nâng cấp đã làm

- **A. Pipeline:** viết lại 3 workflow build (xem bảng trong `docs/RELEASE-CHECKLIST.md` §A); bộ vá dùng chung `scripts/native-android-patch.py`, `scripts/native-ios-patch.py`, `scripts/native-ios-xcodeproj.rb`; iOS thêm ký tay tuỳ chọn (p12 + profile), ô `upload`, kiểm bản archive. Bản sao workflow: `outputs/wf/` (5 file — test kiểm khớp).
- **B.** `docs/RELEASE-CHECKLIST.md`: Đạt / Chưa đạt (ai) / Việc chủ dự án cho từng mục Google Play & App Store.
- **C.** `store/`: tên, phụ đề, mô tả ngắn/dài, từ khoá, ghi chú phát hành (Việt + Anh), ghi chú reviewer (Anh), Data safety, App Privacy, khai báo App content, hướng dẫn ảnh + `scripts/store-screenshots.py` (6.9"/6.7"/6.5"/5.5" iOS, 1080×1920 Android; tự kiểm kích thước PNG).
- **D.** Cờ `window.FK_BUILD` (xem dưới).
- **E.** Các bước đánh số cho chủ dự án: RELEASE-CHECKLIST §E (7 bước) + §F (15 điểm thử máy thật).

## Chuyển giao

| Tới | Việc | Vì sao |
|---|---|---|
| **pt** (`pt.js`, `coach.js`, `findpt.js`) | Đọc `(window.FK_BUILD\|\|{}).authProviders`: mảng không có `"facebook"` → ẩn nút Facebook; mảng rỗng → ẩn cả 3 nút mạng xã hội. Khi `hide.comingSoon`: không hiện vai trò/thẻ “Sắp ra mắt” (`pt.js` ~321, `coach.js` ~302) | App Store 2.1 (nút chết, nội dung giữ chỗ) |
| **commerce** (`shop.js`) | `hide.emptyShop` + chưa có sản phẩm thật/tài khoản nhận tiền → ẩn lối vào gian hàng trên bản store; `hide.externalDigitalPay` (iOS) → không hiện thanh toán ngoài cho hàng số | 2.1, 3.1.1 |
| **core** (`app.js`) | (đã ghi từ vòng trước, vẫn mở) nhãn “Phân tích AI (mô phỏng)” ~dòng 3027; hộp thoại đồng ý trước `callVisionAI`; ẩn chương “Sắp ra mắt” khi `hide.comingSoon` | 1.4.1, 5.1.2(i), 2.1 |
| **ux** (`themes.js`, `i18n.js`) | R3-STORE-20 (StatusBar); cho biết khoá localStorage ngôn ngữ để chụp bộ ảnh tiếng Anh (`store-screenshots.py --local-storage`); R3-STORE-23 | — |
| **integrator** | **Không cần thêm thẻ `<script>/<link>` vào `index.html`, không cần thêm gì vào `sw.js` ASSETS** — `fk-build.js` chỉ tồn tại trong `www/` và do `prepare-www.sh` tự chèn + tự precache. Upload 5 workflow trong `outputs/wf/` vào `.github/workflows/` | deploy-bundle bỏ qua `.github/` |

## Chuỗi cần dịch
Không có chuỗi giao diện mới trong app (thay đổi nằm ở cấu hình, workflow, tài liệu, metadata store — đã có bản Việt + Anh riêng).

## Rủi ro còn lại ở lần build thật đầu tiên (và cách xử lý)

1. **AGP 8.9.1 với plugin Capacitor 6** (R3-STORE-02): nếu Gradle báo lỗi tương thích → thử ô `target_sdk` = 35 (vẫn cần AGP mới) hoặc nâng cả bộ `@capacitor/*` + `@capacitor-firebase/authentication` lên 7.x trong `package.json` (khi đó bỏ `MainActivity` tuỳ biến nếu dùng `adjustMarginsForEdgeToEdge`). Gửi log bước “Build APK thử”.
2. **`native-ios-xcodeproj.rb`** chưa chạy trên project thật: nếu lỗi nhóm/target → log bước “Vá project iOS”.
3. **Ký tay iOS** (p12 + profile) là đường tuỳ chọn, chưa thử; đường mặc định (API key, ký tự động) giữ như bản trước.
4. **Edge-to-edge**: chỉ xác nhận được trên máy Android 15/16 thật (RELEASE-CHECKLIST §F mục 5).
5. Mốc chính sách (API 36, Xcode 26, 12 người/14 ngày, kích thước ảnh) ghi theo hiểu biết tại 11/2026 — kiểm lại trang chính thức lúc nộp.

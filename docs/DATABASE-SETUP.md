# TapEasy — Bật cơ sở dữ liệu thật (Firebase) từ A đến Z

> Dành cho người **không rành kỹ thuật**. Làm lần lượt từ trên xuống, mỗi bước 2–10 phút. Tổng thời gian: khoảng 1,5–2 giờ.
> Web, Android và iOS dùng **CHUNG một Firebase project** → một mối dữ liệu: đăng ký trên web, đăng nhập trên điện thoại thấy đúng dữ liệu đó.
>
> Khi `firebase-config.js` còn để trống, app chạy **bản dùng thử** (dữ liệu chỉ nằm trên máy). Làm xong tài liệu này là app dùng dữ liệu thật — **không phải sửa dòng mã nào khác**.

Cập nhật: 14/11/2026 (vòng R3). Giá và giao diện Firebase Console có thể thay đổi — số liệu chi phí ở §14 là ước tính, hãy xem trang giá chính thức trước khi quyết định.

---

## 0. Cần chuẩn bị

| Thứ cần có | Ghi chú |
|---|---|
| Tài khoản Google | Dùng làm chủ Firebase project. Nên là email riêng của dự án, bật xác minh 2 bước. |
| Máy tính có Node.js 20+ | Chỉ cần để chạy vài lệnh deploy ở §6. Tải tại nodejs.org. |
| Thẻ Visa/Mastercard | Chỉ khi nâng gói **Blaze** (§14). Chưa cần ngay nếu chỉ thử. |
| Tài khoản Apple Developer / Google Play Console | Chỉ cần khi làm §8–9 (app điện thoại). |

---

## 1. Tạo Firebase project

1. Mở <https://console.firebase.google.com> → **Add project / Thêm dự án**.
2. Tên dự án: `tapeasy` (hoặc tên bạn muốn). Ghi lại **Project ID** (ví dụ `tapeasy-12345`) — dùng ở §6.
3. Google Analytics: **tắt cũng được** (app có công tắc thống kê riêng, mặc định tắt). Bấm **Create project**.

## 2. Bật đăng nhập (Authentication)

Vào **Build → Authentication → Get started → tab Sign-in method**, bật từng cách:

| Cách | Bật thế nào | Cần thêm |
|---|---|---|
| **Email/Password** | Bật công tắc đầu tiên (không cần "Email link"). | Không. Link "quên mật khẩu" hoạt động ngay, miễn phí. |
| **Google** | Bật → chọn email hỗ trợ → Save. | Không (web). Android/iOS: xem §8–9. |
| **Facebook** | Bật → dán **App ID** và **App secret** lấy từ <https://developers.facebook.com> (tạo app loại *Consumer*, thêm sản phẩm *Facebook Login*). Sao chép dòng **OAuth redirect URI** Firebase hiển thị, dán vào Facebook Login → Settings → *Valid OAuth Redirect URIs*. | App Facebook phải chuyển sang chế độ **Live** và có đường dẫn Chính sách bảo mật (`…/privacy-policy.html`) + trang xoá dữ liệu (`…/delete-account.html`). |
| **Apple** | Bật. Web/Android cần **Services ID** (`vn.thangvu.fitkit.web`), Team ID, Key ID và file khoá `.p8` tạo ở <https://developer.apple.com> → Certificates, Identifiers & Profiles. | Bắt buộc có khi app iOS có đăng nhập Google/Facebook (quy định App Store). |
| **Phone** (tuỳ chọn) | Bật. | **Tốn phí SMS, cần gói Blaze** — xem §10. Chưa cần thì bỏ qua. |
| **Anonymous** | Bật. | Dùng cho form Góp ý khi người dùng chưa đăng nhập. |

Tiếp theo, tab **Settings** của Authentication:

- **User actions → Email enumeration protection**: để **bật** (mặc định) — chống dò email đã đăng ký.
- **Authorized domains** → **Add domain**: thêm `thangvu030198-ai.github.io` (bản web). `localhost` có sẵn để thử trên máy.
- **Templates** → *Password reset*: đổi ngôn ngữ sang **Tiếng Việt**, đổi tên người gửi thành `TapEasy`.

## 3. Tạo Firestore (cơ sở dữ liệu)

1. **Build → Firestore Database → Create database**.
2. **Location: `asia-southeast1 (Singapore)`** — gần Việt Nam nhất. ⚠️ **Không đổi được sau khi tạo.**
3. Chọn **Start in production mode** (khoá kín; luật truy cập sẽ được nạp ở §6).

## 4. Tạo Storage (kho ảnh/clip sự kiện)

1. **Build → Storage → Get started** → chọn cùng vùng `asia-southeast1`.
2. Storage hiện **yêu cầu gói Blaze** để tạo bucket mới. Chưa nâng gói thì bỏ qua bước này — app vẫn chạy, chỉ riêng ảnh/clip "Khoảnh khắc" sự kiện chưa tải lên được.

## 5. Thêm app Web và điền `firebase-config.js`

1. Bấm biểu tượng ⚙ → **Project settings → General → Your apps → biểu tượng `</>` (Web)**.
2. Tên: `TapEasy Web` → **Register app** (không cần Firebase Hosting).
3. Firebase hiện đoạn `const firebaseConfig = { … }`. Mở file **`firebase-config.js`** trong mã nguồn và điền đúng 6 dòng:

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza…",                       // dán từ Firebase
  authDomain: "tapeasy-12345.firebaseapp.com",
  projectId: "tapeasy-12345",
  storageBucket: "tapeasy-12345.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef…",
  measurementId: "",                     // để trống nếu tắt Analytics
};
```

> Đây là cấu hình **công khai** (không phải mật khẩu) — để trong app là bình thường. Dữ liệu được bảo vệ bằng `firestore.rules` (§6) và App Check (§12). **Không** dán khoá dịch vụ (service account), khoá gửi mail hay mật khẩu vào file này.

4. Lưu file, đẩy mã lên GitHub như mọi khi. Mở web → màn Đăng nhập **không còn** dòng "Bản thử nghiệm" là đã chạy dữ liệu thật.

## 6. Nạp luật bảo mật, chỉ mục và Cloud Functions (lệnh cụ thể)

Mở Terminal (macOS) hoặc PowerShell (Windows) **tại thư mục mã nguồn** (nơi có file `firebase.json`):

```bash
npm install -g firebase-tools          # cài công cụ (1 lần)
firebase login                         # đăng nhập bằng tài khoản Google ở §0
firebase use --add                     # chọn Project ID ở §1, đặt bí danh: default

firebase deploy --only firestore:rules        # luật truy cập Firestore   (firestore.rules)
firebase deploy --only firestore:indexes      # chỉ mục truy vấn          (firestore.indexes.json)
firebase deploy --only storage                # luật Storage — chỉ khi đã làm §4
```

**Cloud Functions** (cần gói Blaze — §14):

```bash
cd functions && npm install && cd ..

# Khoá bí mật — nhập khi được hỏi, KHÔNG ghi vào mã:
firebase functions:secrets:set OWNER_BOOTSTRAP_CODE     # mã tự đặt để nhận quyền Chủ sở hữu lần đầu (docs/RBAC.md)
firebase functions:secrets:set APPLE_PRIVATE_KEY        # nội dung file .p8 (chỉ khi dùng Đăng nhập với Apple)
firebase functions:secrets:set OTP_PEPPER               # chuỗi ngẫu nhiên ≥ 32 ký tự (chỉ khi bật OTP email — §11)
firebase functions:secrets:set MAIL_API_KEY             # khoá dịch vụ gửi mail          (chỉ khi bật OTP email — §11)

firebase deploy --only functions
```

Tạo file `functions/.env` (không đưa lên GitHub công khai) cho các giá trị không bí mật:

```
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
MAIL_PROVIDER=resend
MAIL_FROM=TapEasy <no-reply@ten-mien-cua-ban.vn>
```

**Kiểm tra nhanh sau khi deploy**

- Firestore → tab **Rules**: thấy dòng đầu `// TapEasy — Firestore Security Rules`.
- Functions → thấy danh sách hàm ở vùng `asia-southeast1` (`joinByCode`, `deleteMyAccount`, `exportMyData`, …).
- Mở app → tạo tài khoản → Firestore → `users/{mã}` xuất hiện; tích ô "dữ liệu sức khoẻ" → `users/{mã}/appState/meta` xuất hiện sau ~10 giây.

### Tính năng nào cần Cloud Functions?

| Tính năng | Không có Functions (gói Spark) | Có Functions (gói Blaze) |
|---|---|---|
| Đăng ký / đăng nhập / quên mật khẩu bằng link email | ✅ | ✅ |
| Tài khoản liên kết (Google, Facebook, Apple, mật khẩu) | ✅ | ✅ |
| Sao lưu & đồng bộ dữ liệu tập luyện giữa các máy | ✅ | ✅ |
| Nhật ký đồng ý, Xuất dữ liệu (phần trên máy + form PT) | ✅ | ✅ đầy đủ (thêm cộng đồng, sự kiện, đơn hàng) |
| Xoá tài khoản | ✅ phần cơ bản (hồ sơ, sao lưu, form PT) | ✅ đầy đủ mọi dữ liệu |
| **Kết nối PT ↔ học viên bằng mã mời** | ❌ | ✅ |
| Đơn hàng, điểm, check-in sự kiện, bảng quản trị | ❌ | ✅ |
| OTP email, OTP SMS | ❌ | ✅ |

→ **Khuyến nghị: nâng Blaze ngay khi phát hành chính thức** và đặt cảnh báo ngân sách (§14).

## 7. Nhận quyền Chủ sở hữu (lần đầu)

Đăng nhập app bằng tài khoản của bạn → Hồ sơ → Bảng quản trị → nhập mã `OWNER_BOOTSTRAP_CODE` đã đặt ở §6. Chi tiết: `docs/RBAC.md`.

## 8. Thêm app Android (`vn.thangvu.fitkit`)

1. Project settings → Your apps → **Add app → Android**.
2. **Android package name**: `vn.thangvu.fitkit` (phải đúng từng ký tự).
3. **SHA-1 và SHA-256** — cần cho đăng nhập Google và OTP SMS. Cần thêm **cả hai bộ**:
   - *Khoá tải lên* (upload key): xem cuối nhật ký workflow **build-android** trên GitHub Actions (dòng `SHA1:` / `SHA256:`), hoặc chạy `keytool -list -v -keystore <file.jks> -alias <alias>`.
   - *Khoá Play App Signing*: Play Console → app → **Test and release → Setup → App integrity → App signing** → sao chép SHA-1 và SHA-256.
   - Dán từng dòng vào Firebase: Project settings → app Android → **Add fingerprint**.
4. Tải **`google-services.json`** → chuyển sang base64 và lưu vào GitHub → Settings → Secrets → `GOOGLE_SERVICES_JSON_BASE64` (workflow tự đặt file vào `android/app/`; xem `README-store.md`).
   - macOS/Linux: `base64 -i google-services.json | pbcopy` · Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("google-services.json")) | Set-Clipboard`
5. Mỗi lần thêm SHA mới hoặc bật thêm cách đăng nhập → **tải lại** `google-services.json` và cập nhật secret.

## 9. Thêm app iOS (`vn.thangvu.fitkit`)

1. Project settings → **Add app → iOS** → **Bundle ID**: `vn.thangvu.fitkit`.
2. Tải **`GoogleService-Info.plist`** → base64 → GitHub Secret `GOOGLE_SERVICE_INFO_PLIST_BASE64` (xem `README-ios-build.md`; workflow tự đặt vào `ios/App/App/` và khai báo URL scheme `REVERSED_CLIENT_ID`).
3. Apple Developer → Identifiers → `vn.thangvu.fitkit` → bật **Sign in with Apple**.
4. Kiểm tra trên máy thật: Đăng nhập với Apple và Google mở đúng hộp thoại hệ thống.

> **TODO cần App Store / Play Console (chưa làm được trong mã):**
> - Đăng nhập **Facebook trên app native** chưa bật (`capacitor.config.json → plugins.FirebaseAuthentication.providers` mới có `apple.com`, `google.com`). Muốn bật: thêm `facebook.com`, khai báo Facebook App ID/Client Token trong `AndroidManifest.xml` và `Info.plist` theo tài liệu plugin `@capacitor-firebase/authentication`. Trên web, Facebook hoạt động ngay sau §2.
> - Thu hồi token Apple khi xoá tài khoản cần `APPLE_PRIVATE_KEY` + `functions/.env` (§6).

## 10. (Tuỳ chọn) Bật OTP qua số điện thoại — `FK_FEATURES.phoneOtp`

**Mặc định TẮT** vì SMS tốn phí và cần gói Blaze. Khi tắt, mọi thứ liên quan số điện thoại **ẩn hoàn toàn** khỏi giao diện.

Để bật:

1. Nâng gói **Blaze** (§14). Authentication → Sign-in method → bật **Phone**.
2. Authentication → Settings → **SMS region policy** → *Allow* chỉ **Vietnam (VN)** — chặn lạm dụng gửi SMS quốc tế (rất quan trọng để không mất tiền).
3. Authentication → Settings → **Phone numbers for testing**: thêm 1 số thử (ví dụ `+84 900000001`, mã `123456`) để kiểm tra không tốn phí.
4. Web: giao diện dùng reCAPTCHA vô hình — nhờ integrator thêm vào CSP của `index.html`: `script-src … https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/` và `frame-src … https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/`.
5. Android: đã có SHA-256 ở §8; Google Cloud Console → bật **Play Integrity API**. iOS: Firebase → Project settings → Cloud Messaging → tải **APNs Authentication Key** (.p8).
6. `capacitor.config.json` → `plugins.FirebaseAuthentication.providers` thêm `"phone"` rồi build lại app.
7. Mở `firebase-config.js`, sửa `phoneOtp: true`.

Sau khi bật: Hồ sơ → Tài khoản → **Tài khoản liên kết** có mục *Số điện thoại*; màn **Quên mật khẩu** có thêm lựa chọn *Số điện thoại* (nhận mã → đặt mật khẩu mới). Đây cũng là cách đáp ứng yêu cầu **xác thực tài khoản bằng số điện thoại Việt Nam** cho tính năng Cộng đồng (xem `docs/LEGAL-VN.md` §4).

## 11. (Tuỳ chọn) Bật OTP 6 số qua email — `FK_FEATURES.emailOtp`

**Mặc định TẮT** → app dùng **link đặt lại mật khẩu** có sẵn của Firebase (miễn phí, không cần cấu hình). Chỉ bật khi bạn muốn người dùng nhập mã 6 số ngay trong app.

**Cách hoạt động:** app gọi Cloud Function `requestEmailOtp` → máy chủ sinh mã 6 số, **chỉ lưu bản băm** (HMAC-SHA256 + `OTP_PEPPER`), hạn **10 phút**, tối đa **5 lần nhập sai**, mỗi email 60 giây/lần và 5 lần/giờ, mỗi IP 20 lần/giờ → gửi email qua dịch vụ gửi mail → người dùng nhập mã + mật khẩu mới → `verifyEmailOtp` đặt mật khẩu và đăng xuất mọi phiên cũ. Email có hay không có tài khoản đều nhận cùng một câu trả lời (chống dò email).

Để bật:

1. Gói **Blaze** + đã deploy Functions (§6).
2. Đăng ký một dịch vụ gửi mail và **xác minh tên miền gửi**: [Resend](https://resend.com) (dễ nhất, có gói miễn phí), SendGrid, Brevo — hoặc SMTP bất kỳ.
3. Đặt khoá (không ghi vào mã):
   ```bash
   firebase functions:secrets:set MAIL_API_KEY     # khoá API của dịch vụ mail (hoặc mật khẩu SMTP)
   firebase functions:secrets:set OTP_PEPPER       # ví dụ tạo bằng: openssl rand -hex 32
   ```
4. `functions/.env`: `MAIL_PROVIDER=resend` (hoặc `sendgrid` / `brevo` / `smtp`), `MAIL_FROM=TapEasy <no-reply@ten-mien-cua-ban.vn>`. Với `smtp`: thêm `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` và chạy `cd functions && npm install nodemailer`.
5. `firebase deploy --only functions:requestEmailOtp,functions:verifyEmailOtp`
6. `firebase-config.js` → `emailOtp: true`.

## 12. App Check (khuyến nghị)

App Check chặn các chương trình lạ giả làm app của bạn để gọi vào cơ sở dữ liệu.

1. **Build → App Check → Apps**: Web → **reCAPTCHA Enterprise** (hoặc reCAPTCHA v3); Android → **Play Integrity**; iOS → **App Attest**.
2. Chạy ở chế độ **theo dõi (Monitor)** 1–2 tuần, xem tỉ lệ yêu cầu hợp lệ.
3. Khi tỉ lệ hợp lệ > 95% mới bấm **Enforce** cho Firestore, Storage, Functions.

> Mã client **chưa** khởi tạo App Check SDK — bật *Enforce* ngay sẽ chặn chính app. Đây là việc cho vòng sau: thêm `firebase-app-check-compat.js` + site key vào `firebase-config.js`. Trong lúc chờ, lớp bảo vệ chính vẫn là `firestore.rules` (đã kiểm thử) và giới hạn tần suất trong Cloud Functions.

## 13. Sao lưu & khôi phục

- **Sao lưu tự động của Firestore** (cần Blaze): Firestore → **Disaster recovery → Scheduled backups** → hằng ngày, giữ 7 ngày. Bật thêm **Point-in-time recovery** nếu muốn quay lại bất kỳ thời điểm nào trong 7 ngày.
- **Xuất thủ công** (trước mỗi lần thay đổi lớn):
  ```bash
  gcloud firestore export gs://<ten-bucket>/backup-$(date +%F) --project <project-id>
  ```
- **Người dùng tự sao lưu:** Hồ sơ → Tài khoản → *Xuất dữ liệu của tôi* (JSON) và *Sao lưu & đồng bộ*.
- Ghi vào sổ vận hành: ai có quyền Owner của Firebase project, email khôi phục, nơi cất file khoá ký Android (`.jks`) và khoá Apple (`.p8`). **Mất khoá ký = không cập nhật được app.**
- Lưu ý pháp lý: bản sao lưu cũng là dữ liệu cá nhân — giữ tối đa 30 ngày như đã công bố trong Chính sách bảo mật.

## 14. Chi phí: gói miễn phí Spark so với Blaze (ước tính)

| | **Spark (miễn phí)** | **Blaze (trả theo dùng)** |
|---|---|---|
| Authentication (email, Google, Facebook, Apple) | Miễn phí | Miễn phí tới ~50.000 người dùng hoạt động/tháng |
| OTP SMS | Không dùng được | Tính tiền theo từng tin (Việt Nam: khoảng vài trăm đến vài nghìn đồng/tin, tuỳ nhà mạng — xem bảng giá Identity Platform) |
| Firestore | 1 GiB lưu trữ · 50.000 lượt đọc · 20.000 lượt ghi · 20.000 lượt xoá **mỗi ngày** | Vẫn được miễn phí đúng mức trên, vượt mới tính tiền (rất rẻ ở quy mô nhỏ) |
| Cloud Functions | Không dùng được | 2 triệu lượt gọi/tháng miễn phí |
| Storage | Không tạo được bucket mới | 5 GB đầu gần như miễn phí |
| Sao lưu tự động, PITR | Không | Có (tính theo dung lượng) |

**Ước lượng mức dùng của TapEasy** (mỗi người dùng hoạt động/ngày): ~30–60 lượt đọc, ~10–25 lượt ghi (sao lưu được gom, ≥ 30 giây mới ghi 1 lần, mỗi lần 2 tài liệu).

- **≤ 300 người dùng hoạt động/ngày:** nằm trong hạn mức miễn phí của Firestore. Hoá đơn Blaze thường **0–50.000 đ/tháng**.
- **~2.000 người/ngày:** khoảng **100.000–400.000 đ/tháng** (chưa gồm SMS).
- **SMS OTP** là khoản dễ đội chi phí nhất → chỉ bật khi cần, luôn giới hạn vùng Việt Nam (§10 bước 2).

**Bắt buộc làm khi nâng Blaze:** Google Cloud Console → **Billing → Budgets & alerts** → tạo ngân sách (ví dụ 200.000 đ/tháng) với cảnh báo ở 50% / 90% / 100% gửi về email của bạn. Lưu ý: cảnh báo **không tự dừng** dịch vụ — bạn cần vào kiểm tra khi nhận được email.

Khi vượt hạn mức ở gói Spark, app báo: *"Hệ thống đang quá tải hoặc đã hết hạn mức trong ngày. Vui lòng thử lại sau ít phút."* — dữ liệu trên máy người dùng không mất, sẽ tự sao lưu lại khi có hạn mức.

## 15. Danh sách kiểm tra trước khi phát hành

- [ ] `firebase-config.js` đã điền; web mở lên không còn chữ "Bản thử nghiệm".
- [ ] Firestore vùng `asia-southeast1`; đã deploy `firestore:rules` + `firestore:indexes` (+ `storage`, `functions` nếu dùng).
- [ ] Authorized domains có `thangvu030198-ai.github.io`.
- [ ] Thử đủ: đăng ký email → nhận thư xác minh → đăng xuất → quên mật khẩu (nhận link) → đăng nhập Google → Tài khoản liên kết (thêm/gỡ) → bật Sao lưu → đăng nhập máy khác thấy dữ liệu → Xuất dữ liệu → Xoá tài khoản (kiểm tra Firestore không còn `users/{mã}`).
- [ ] Android: đủ SHA-1 + SHA-256 của **cả** khoá tải lên và khoá Play App Signing; secret `GOOGLE_SERVICES_JSON_BASE64` mới nhất.
- [ ] iOS: secret `GoogleService-Info.plist`; Sign in with Apple bật trong Identifier.
- [ ] `privacy-policy.html` và `terms.html`: đã thay các chỗ `[ĐIỀN …]` (tên đơn vị, email hỗ trợ, địa chỉ, mã số thuế).
- [ ] Đã đọc `docs/LEGAL-VN.md` và làm các việc "chủ dự án" ở đó.
- [ ] Budget alert đã đặt (nếu dùng Blaze). Tài khoản Google chủ project bật xác minh 2 bước.

## 16. Cấu trúc dữ liệu thêm ở vòng R3 (để tra cứu)

| Đường dẫn | Nội dung | Ai đọc/ghi |
|---|---|---|
| `users/{uid}/appState/meta` | `{ v, updatedAt, device, n, chars, app }` — thông tin bản sao lưu | Chỉ chủ tài khoản |
| `users/{uid}/appState/c0…c39` | `{ i, g, s }` — các khúc JSON ≤ 250.000 ký tự (dưới giới hạn 1 MiB/tài liệu của Firestore) | Chỉ chủ tài khoản |
| `users/{uid}/consents/{id}` | `{ type: terms\|health\|age, granted, version, at, clientAt, src, platform }` — nhật ký đồng ý, chỉ-thêm | Chỉ chủ tài khoản (không sửa được) |
| `email_otps/{băm email}` | Băm mã OTP, hạn, số lần thử | Chỉ Cloud Functions |
| `otp_rate/{id}` | Bộ đếm giới hạn tần suất | Chỉ Cloud Functions |

**Không** đưa lên máy chủ: video, ảnh tiến độ, khoá API AI cá nhân, cấu hình Google Drive.

## 17. Sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
|---|---|
| "Tên miền này chưa được cho phép trong Firebase Authentication." | Thiếu Authorized domain (§2). |
| "Chủ app chưa bật đăng nhập bằng hình thức này trong Firebase." | Chưa bật provider tương ứng (§2). |
| Đăng nhập Google trên Android báo lỗi 10 / không phản hồi | Thiếu SHA-1/SHA-256 của khoá Play App Signing, hoặc `google-services.json` cũ (§8). |
| "Bạn không có quyền thực hiện thao tác này." ngay sau khi điền config | Chưa deploy `firestore.rules` (§6) — production mode mặc định khoá hết. |
| "Máy chủ chưa bật chức năng kết nối PT…" | Chưa deploy Cloud Functions (§6). |
| "Chưa kết nối được máy chủ TapEasy…" | Máy mất mạng lúc mở app; có mạng lại app tự kết nối. Dữ liệu tập trên máy vẫn dùng bình thường. |
| Không nhận được thư đặt lại mật khẩu | Kiểm tra Thư rác; Authentication → Templates đổi tên người gửi; cân nhắc tên miền gửi riêng. |
| Sao lưu báo "Dữ liệu quá lớn…" | State vượt ~10 triệu ký tự — thường do ảnh đại diện rất lớn hoặc nhật ký nhiều năm; xoá bớt rồi thử lại. |

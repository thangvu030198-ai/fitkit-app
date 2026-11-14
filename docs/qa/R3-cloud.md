# R3 — agent `cloud` (14/11/2026)

Phạm vi: `cloud.js`, `cloud-social.js`, `cloud-pt-directory.js`, `rbac.js`, `firebase-config.js`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `functions/**`, `pt.js`, `pt-connect.*`, `pt-pro.*`, `ptprofile.js`, `findpt.*`, `analytics.js`, `feedback.js`, `privacy-policy.html`, `delete-account.html`, **mới:** `terms.html`, `functions/account.js`, `docs/LEGAL-VN.md`, `docs/DATABASE-SETUP.md`.
Test: `tests/suites/82-r3-cloud.test.js` (26 test) — chạy riêng `node tests/run.js --only 82-r3`.

**Cách rà:** đọc toàn bộ `cloud.js`, `pt.js` (phần tài khoản / khởi động), `functions/index.js`, `firebase-config.js`, `firebase.json`, `storage.rules`, `delete-account.html`, `privacy-policy.html`, khối `users/**` của `firestore.rules`. Các file PT/Tìm PT lớn (`pt-connect.js`, `pt-pro.js`, `findpt.js`, `cloud-social.js`, `cloud-pt-directory.js`, `rbac.js`, `analytics.js`, `feedback.js` — ~800 KB, đã qua 2 vòng QA + sửa) được rà **có trọng tâm** theo 7 nhóm bằng lưới dò: trình nghe `onSnapshot` / `addEventListener` / `setInterval` / Observer có được gỡ không, `JSON.parse` có `try`, đường lỗi mạng, và 109 kịch bản tấn công rules của vòng trước (vẫn xanh sau khi sửa rules). Không báo lại lỗi đã sửa ở `FIX-*.md`.

## 1. Bảng lỗi

Tổng: **Critical 0 · High 3 · Medium 6 · Low 6** (đã sửa 10, chuyển giao 4, không sửa 1).

| Mã | Mức | File:dòng | Mô tả | Tái hiện | Sửa | Trạng thái |
|---|---|---|---|---|---|---|
| R3-CLOUD-01 | **High** | `cloud.js` ~574 (`api.init`) | Đã điền `FIREBASE_CONFIG` nhưng SDK không tải được (mở app lúc mất mạng, gstatic bị chặn) → app **lặng lẽ chuyển sang động cơ demo**: người dùng "đăng ký/đăng nhập" được vào máy chủ giả trên máy, tưởng dữ liệu đã lên cloud; tài khoản thật thì báo sai mật khẩu. | Điền config, tắt mạng, mở app, bấm Tạo tài khoản. | Trạng thái `cloud.degraded`: chặn đăng ký/đăng nhập với câu "Chưa kết nối được máy chủ TapEasy…", không tạo tài khoản ma; `cloud.retryInit()` tự chạy khi có mạng (sự kiện `online`) và trước mỗi lần đăng nhập; `init` chạy lại được (không nạp trùng SDK / `initializeApp` 2 lần). | **Đã sửa** · test R3-CLOUD-01, -01b |
| R3-CLOUD-02 | **High** | `cloud.js`, `pt.js` (thiếu) | Dữ liệu tập luyện – dinh dưỡng (`fitkit_state_v1`) **không hề được sao lưu theo tài khoản**: đăng nhập máy khác / cài lại app là mất hết, dù có tài khoản. | Tạo tài khoản, ghi nhật ký, đăng nhập ở trình duyệt khác → trống. | Xây `cloud.sync` (mục 3.C). | **Đã sửa** · 6 test "C ·" |
| R3-CLOUD-05 | **High** (pháp lý) | `pt.js` ~281 (đăng ký), `bindSocialButtons` | Một ô tích gộp "Điều khoản & Chính sách"; không có đồng ý riêng cho dữ liệu sức khoẻ (nhạy cảm), không xác nhận tuổi; đăng nhập Google/Apple/Facebook **từ màn Đăng nhập** tạo tài khoản mà không qua ô đồng ý nào; không lưu bằng chứng đồng ý; link "Điều khoản" mở Chính sách bảo mật (chưa có điều khoản). | Màn Đăng nhập → Tiếp tục với Google. | 3 ô riêng không tích sẵn + màn "Trước khi bắt đầu" + nhật ký đồng ý có phiên bản + `terms.html`. | **Đã sửa** · 2 test "E ·" |
| R3-CLOUD-03 | Medium | `cloud.js` ERR, `resetPassword` | Dò được email đã đăng ký: quên mật khẩu trả "Không tìm thấy tài khoản với email này"; đăng nhập phân biệt "không có tài khoản" / "sai mật khẩu"; bấm gửi lại không giới hạn. | Quên mật khẩu với email lạ. | Trả lời trung tính `{ sent:true }`, màn "Nếu email đã đăng ký…", chờ 60 s/email (`cloud.resendWait`), kiểm định dạng email. | **Đã sửa** · test R3-CLOUD-03 |
| R3-CLOUD-04 | Medium | `cloud.js` `niceError` | Mã lỗi chưa có trong bảng → hiện nguyên văn tiếng Anh của Firebase ("Firebase: Error (auth/internal-error).", "Missing or insufficient permissions."); thiếu câu cho hết hạn mức (`resource-exhausted`), hết phiên, quá giờ; mã có tiền tố `firestore/…` không tra được. | Giả lập lỗi `auth/internal-error`. | +45 câu tiếng Việt; tra cả mã trần; thông báo lạ → câu chung + mã. | **Đã sửa** · test R3-CLOUD-04 |
| R3-CLOUD-06 | Medium | `firestore.rules` `match /users/{uid}` | Hồ sơ người dùng không kiểm kiểu / kích thước: ghi được `name` dài tuỳ ý hoặc là object, hàng trăm trường → phình tài liệu, vỡ giao diện người đọc hồ sơ PT. | `users/{uid}.set({ name: "A".repeat(1e5) })`. | `okUserDoc()`: tên chuỗi ≤ 120, `isPT` bool, ≤ 60 trường. | **Đã sửa** · test R3-CLOUD-06 (chạy thật trên bộ thông dịch rules + tĩnh) |
| R3-CLOUD-07 | Medium | `cloud.js` `isSocialUser`, `deleteAccount` | "Tài khoản mạng xã hội" suy từ `profile.provider` (cách đăng nhập lúc tạo) và xoá tài khoản xác thực lại theo `providerData[0]` → sai sau khi liên kết thêm / đặt mật khẩu (hỏi nhầm cách, tài khoản chỉ có SĐT gọi nhầm Google). | Đăng nhập Google → đặt mật khẩu → Xoá tài khoản. | Tính theo danh sách cách đăng nhập thực tế (`cloud.hasPassword`), có mật khẩu thì xác thực bằng mật khẩu. | **Đã sửa** · test R3-CLOUD-07 |
| R3-CLOUD-11 | Medium | `cloud.js` `firebaseEngine.deleteAccount` (đường dự phòng) | Khi chưa deploy Functions (gói Spark), xoá tài khoản phía client bỏ sót liên hệ riêng `users/{uid}/private`, danh sách chặn (và nay là bản sao lưu, nhật ký đồng ý). | Xoá tài khoản khi chưa có `deleteMyAccount`. | Đường dự phòng xoá thêm `appState`, `consents`, `private`, `blocks/{uid}/list`; máy chủ (`cleanupUserData`) dọn thêm OTP + bộ đếm. | **Đã sửa** · test "C · Rút đồng ý…" |
| R3-CLOUD-13 | Medium | `sw.js` (agent ux) | Service worker không cache SDK Firebase (`https://www.gstatic.com/firebasejs/10.12.2/*`) → mở PWA lúc **ngoại tuyến** không khởi động được Firebase (nay vào trạng thái `degraded`, tự nối lại khi có mạng; trước R3 là rơi sang demo). | Cài PWA, tắt mạng, mở lại. | Thêm cache-first cho đúng tiền tố URL trên. | **Chuyển giao** (ux) |
| R3-CLOUD-17 | Medium (pháp lý) | `community.js`, `events.js`, `findpt.js` | Đăng bài / bình luận / đánh giá chưa yêu cầu tài khoản đã xác thực số điện thoại (NĐ 147/2024). | — | Khi `FK_FEATURES.phoneOtp` bật: chặn nếu `!cloud.phoneVerified`, gọi `openLinkedSheet()`. | **Chuyển giao** (commerce; `findpt.js` để vòng sau cùng lúc cho nhất quán) |
| R3-CLOUD-08 | Low | `pt.js` ~858 | Lỗi khi đăng xuất bị nuốt (promise bị từ chối trong callback xác nhận) — người dùng không biết đã thoát chưa. | Giả lập `signOut` lỗi. | `try/catch` + toast; báo trước "sẽ sao lưu nốt". | **Đã sửa** · test R3-CLOUD-08/09 |
| R3-CLOUD-09 | Low | `pt.js` (màn Quên mật khẩu) | Màn cũ chỉ toast rồi quay về đăng nhập, không có trạng thái "đã gửi", không đếm ngược; bộ đếm mới phải được dừng khi rời màn. | — | Màn "đã gửi" + nút gửi lại đếm ngược; `stopAuthTick()` trong `showAuth`. | **Đã sửa** · test R3-CLOUD-08/09 |
| R3-CLOUD-10 | Low | `ptprofile.js:58` | Mỗi lần vẽ khối "Bạn đã chặn…" gắn thêm 1 trình nghe `fk:blocks-changed` (chỉ tự gỡ khi sự kiện bắn) → rò trình nghe, bỏ chặn gọi `onUnblocked` N lần. | Mở hồ sơ PT đã chặn 5 lần. | Gỡ trình nghe của lần vẽ trước. | **Đã sửa** · test R3-CLOUD-10 |
| R3-CLOUD-14 | Low | `index.html` CSP (agent ux) | CSP chưa cho reCAPTCHA của Phone Auth (chỉ cần khi bật `phoneOtp`). | Bật cờ, gửi mã trên web. | `script-src` + `https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`; `frame-src` + `https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/`. | **Chuyển giao** (ux) |
| R3-CLOUD-18 | Low | `capacitor.config.json` (agent store) | `FirebaseAuthentication.providers` chỉ có Apple, Google → Facebook và Phone trên app native chưa chạy. | Bấm Facebook trong app Android. | Thêm `"facebook.com"` / `"phone"` + cấu hình native (cần Facebook App ID, APNs key). | **Chuyển giao** (store + chủ dự án — DATABASE-SETUP §9–10) |
| R3-CLOUD-15 | Low | `cloud.js` (`cloud.sync`) | Sao lưu chỉ gồm `fitkit_state_v1`; vài bộ nhớ đệm riêng của module (`fitkit_np_plans_v1`…) và video/ảnh trong IndexedDB không đồng bộ. | — | Bộ nhớ đệm tự dựng lại từ state; ảnh/video cố ý không tải lên (dung lượng, dữ liệu nhạy cảm). "Xuất dữ liệu" vẫn gồm các khoá đó. | **Không sửa** (chủ ý, ghi trong chính sách) |

Không thấy lỗi mới ở: rò `onSnapshot` (`pt-connect.js` gỡ `watchClients/watchInvites/watchMessages` khi đổi tài khoản và đóng chat; nay cũng chạy lại sau `retryInit`), `setInterval` (đồng hồ buổi tập / nghỉ tự dừng khi mất phần tử), `IntersectionObserver` (`findpt.js`, `ptprofile.js` ngắt trước khi tạo mới), `JSON.parse` (đều trong `try`), `storage.rules`, `firestore.indexes.json` (truy vấn mới chỉ dùng chỉ mục đơn tự động), `firebase.json`.

## 2. Đối chiếu 7 nhóm

| Nhóm | Kết quả |
|---|---|
| (a) Logic nghiệp vụ | R3-CLOUD-01, -02, -07, -11 |
| (b) Edge case & đầu vào | Email/SĐT được chuẩn hoá + kiểm định dạng (số VN `0…`/`84…`/`+84…`); mã OTP chỉ nhận 6 số; state rỗng/khung rỗng của hôm nay không bị coi là "có dữ liệu"; bản cloud ghi dở → bỏ qua vòng |
| (c) State / localStorage / cloud | R3-CLOUD-02; không đổi key `fitkit_state_v1`; khoá mới: `fitkit_sync_meta_v1`, `fitkit_state_backup_v1`, `fitkit_consent_log_v1`, `fitkit_cooldown_v1`, `fitkit_device_id`, (demo) `fitkit_cloud_demo_state_v1` |
| (d) PWA | R3-CLOUD-13 (chuyển giao); ngoại tuyến: đánh dấu "chưa sao lưu", đẩy lại khi `online` / khi app xuống nền / lần mở sau; `terms.html` cần vào ASSETS |
| (e) Hiệu năng & rò rỉ | Đẩy cloud có debounce 8 s + cách nhau ≥ 30 s, không dùng `onSnapshot` cho sao lưu (không tốn lượt đọc nền); R3-CLOUD-09, -10 |
| (f) Bảo mật | R3-CLOUD-03, -06; rules mới cho `appState` / `consents` (chỉ chủ tài khoản, kể cả nhân sự cũng không đọc), `email_otps` / `otp_rate` đóng kín; OTP chỉ lưu băm; mọi chuỗi chèn HTML qua `escapeHtml`, URL qua `attrUrl`; không có khoá trong mã |
| (g) Lỗi & UX khi lỗi | R3-CLOUD-04, -08; trạng thái sao lưu hiện ngay trong thẻ Tài khoản (đã sao lưu / chưa / lỗi + lý do) |

## 3. Nâng cấp

### A. Quên mật khẩu
- **Link email** (mặc định): màn nhập → màn "đã gửi" trung tính → gửi lại sau 60 s. Demo ghi rõ "Bản dùng thử — không gửi thật".
- **OTP số điện thoại** — cờ `FK_FEATURES.phoneOtp` (mặc định tắt, ẩn hẳn): `cloud.phone.start/confirm`, web dùng reCAPTCHA vô hình, native dùng plugin (lấy `verificationId` rồi xác nhận ở lớp JS). Liên kết số vào tài khoản; đăng nhập bằng OTP → `cloud.setPassword`. Số chưa liên kết → không để lại tài khoản rỗng.
- **OTP 6 số qua email** — cờ `FK_FEATURES.emailOtp` (mặc định tắt): `functions/account.js` → `requestEmailOtp` / `verifyEmailOtp` (băm HMAC-SHA256 + muối + `OTP_PEPPER`, hạn 10 phút, ≤ 5 lần thử, 60 s/lần, 5 lần/giờ/email, 20 lần/giờ/IP, trả lời trung tính, đặt mật khẩu + thu hồi phiên cũ). Gửi mail qua Resend / SendGrid / Brevo (HTTP, không thêm thư viện) hoặc SMTP; khoá lấy từ Secret Manager.
- Demo mô phỏng trung thực cả 3 (mã hiện kèm chữ "không gửi thật").

### B. Tài khoản liên kết
Hồ sơ → Tài khoản → **Tài khoản liên kết**: mật khẩu, Google, Apple, Facebook (+ số điện thoại khi bật cờ). `cloud.linked.list/link/unlink`, luôn giữ ≥ 1 cách; `account-exists-with-different-credential` → giữ credential, tự liên kết sau lần đăng nhập đúng cách cũ (≤ 10 phút, cùng email) + toast. Native: lấy credential từ SDK gốc rồi `linkWithCredential` (hợp với `skipNativeAuth`).

### C. Sao lưu & đồng bộ `fitkit_state_v1` (`cloud.sync`)
- `users/{uid}/appState/meta` + `c0…c39`: JSON cắt khúc ≤ 250.000 ký tự (≤ ~750 KB UTF-8 < 1 MiB); ≤ 6 khúc ghi 1 lô nguyên tử; khúc mang thế hệ `g` để phát hiện ghi dở.
- Chỉ chạy khi: đăng nhập + **đồng ý dữ liệu sức khoẻ** + `cloudSync ≠ false`. Không tải: khoá API, cấu hình Drive, video/ảnh, cờ theo máy, ảnh đại diện > 60 KB.
- Xung đột: cloud đổi từ máy khác + máy này có thay đổi → **gộp** (hợp các ngày/bản ghi; trùng khoá → bên `updatedAt` mới hơn; hồ sơ & nhắc nhở lấy nguyên khối bên mới hơn).
- Dữ liệu trên máy của khách / tài khoản khác mà cloud đã có bản → **hỏi** (Gộp · Dùng cloud · Giữ máy này · Để sau); trước khi ghi đè lưu bản tạm, khôi phục được. Đăng xuất không xoá dữ liệu máy (và cố đẩy nốt ≤ 3 s).
- Giới hạn đã biết: xoá một ngày/bản ghi trên máy A trong lúc máy B cũng sửa → khi gộp bản ghi có thể xuất hiện lại (chọn "không mất dữ liệu" thay vì "xoá triệt để").

### D. `docs/LEGAL-VN.md` — 10 lĩnh vực, mỗi mục: văn bản, "cần kiểm tra lại", rủi ro, hiện trạng, việc trong mã / việc chủ dự án.
### E. Trong mã theo D
`privacy-policy.html` bản 2026-11-14 (song ngữ; dữ liệu nhạy cảm, bảng mục đích, thời hạn lưu, Firebase – Singapore – chuyển dữ liệu ra nước ngoài, rút đồng ý / xuất / xoá, dưới 16 tuổi) · `terms.html` mới (song ngữ) · 3 ô đồng ý · nhật ký đồng ý (`cloud.consent`, rules chỉ-thêm, giờ máy chủ) · **Xuất dữ liệu của tôi** (JSON; che khoá API; Function `exportMyData`) · **Xoá tài khoản** thật ở demo + firebase (thêm tuỳ chọn xoá cả dữ liệu trên máy).
### C'. `docs/DATABASE-SETUP.md` — 17 mục từng bước, lệnh cụ thể, bảng Spark/Blaze, danh sách kiểm tra.

## 4. Chuyển giao

| Cho | File | Việc |
|---|---|---|
| ux | `sw.js` | Thêm `terms.html` vào ASSETS; cache-first cho `https://www.gstatic.com/firebasejs/10.12.2/` (R3-CLOUD-13) |
| ux | `index.html` | CSP cho reCAPTCHA khi bật `phoneOtp` (R3-CLOUD-14). **Không cần thẻ `<script>`/`<link>` mới** — mã mới nằm trong `cloud.js`, `pt.js`, `firebase-config.js` đã nạp sẵn; CSS của phần mới chèn bằng `<style id="fk-acc-style">` từ `pt.js` |
| ux | `landing.html` | Thêm link `terms.html` cạnh Chính sách bảo mật ở chân trang |
| commerce | `community.js`, `events.js` | Chặn đăng bài/bình luận khi `FK_FEATURES.phoneOtp && !cloud.phoneVerified` (R3-CLOUD-17); chèn câu cảnh báo thực phẩm bổ sung; thông tin người bán ở bước xác nhận đơn (LEGAL-VN §5, §7) |
| store | `capacitor.config.json` | `providers` thêm `facebook.com` / `phone` khi chủ dự án cấu hình xong (R3-CLOUD-18) |
| admin | `cloud-admin.js`, `admin.js` | 2 test đỏ thoáng qua trong lúc chạy song song thuộc vùng này (`30-rbac` "tên người dùng phải được escape", `20-social` "admin/banned-word") — không do thay đổi của agent cloud |

## 5. Chuỗi cần dịch (Việt → Anh)

```
"Sao lưu & đồng bộ" → "Backup & sync"
"Tài khoản liên kết" → "Linked accounts"
"Xuất dữ liệu của tôi" → "Export my data"
"Tải toàn bộ dữ liệu về máy (tệp JSON)" → "Download all your data (JSON file)"
"Điều khoản sử dụng" → "Terms of Use"
"Chính sách bảo mật" → "Privacy Policy"
"Quên mật khẩu" → "Forgot password"
"Gửi link đặt lại" → "Send reset link"
"Gửi lại" → "Resend"
"Gửi mã" → "Send code"
"Gửi lại mã" → "Resend code"
"Mã 6 số" → "6-digit code"
"Mã qua email" → "Email code"
"Link qua email" → "Email link"
"Số điện thoại" → "Phone number"
"Mật khẩu mới (ít nhất 6 ký tự)" → "New password (at least 6 characters)"
"Đặt mật khẩu mới" → "Set new password"
"Xác nhận" → "Confirm"
"Quay lại đăng nhập" → "Back to sign in"
"Bản dùng thử — không gửi thật." → "Trial build — nothing is actually sent."
"Trước khi bắt đầu" → "Before you start"
"Đồng ý & tiếp tục" → "Agree & continue"
"Không đồng ý — đăng xuất" → "Decline — sign out"
"Cập nhật điều khoản" → "Terms updated"
"Tôi đã đủ 16 tuổi, hoặc đã có sự đồng ý của cha mẹ/người giám hộ." → "I am at least 16, or I have my parent's/guardian's consent."
"(bắt buộc)" → "(required)"
"Cho phép sao lưu dữ liệu sức khoẻ" → "Allow health-data backup"
"Sao lưu ngay" → "Back up now"
"Đã sao lưu" → "Backed up"
"Có thay đổi chưa sao lưu" → "Changes not backed up yet"
"Đang tắt — chạm để bật" → "Off — tap to turn on"
"Tạm dừng — chạm để chọn dữ liệu" → "Paused — tap to choose data"
"Chưa kết nối máy chủ" → "Not connected to server"
"Chọn dữ liệu muốn giữ" → "Choose which data to keep"
"Gộp cả hai (khuyên dùng)" → "Merge both (recommended)"
"Dùng bản trên cloud · thay dữ liệu máy này" → "Use cloud copy · replace this device's data"
"Giữ dữ liệu máy này · ghi đè bản cloud" → "Keep this device's data · overwrite cloud copy"
"Để sau — chưa sao lưu" → "Later — don't back up yet"
"Khôi phục bản tạm trước lần ghi đè gần nhất" → "Restore the copy saved before the last overwrite"
"Tắt sao lưu & rút đồng ý?" → "Turn off backup & withdraw consent?"
"Liên kết" → "Link"
"Huỷ" → "Unlink"
"Huỷ liên kết?" → "Unlink?"
"Đặt mật khẩu" → "Set password"
"Chưa liên kết" → "Not linked"
"Đã liên kết" → "Linked"
"Email & mật khẩu" → "Email & password"
"Gửi mã xác minh" → "Send verification code"
"Xoá luôn dữ liệu tập luyện trên máy này" → "Also delete workout data on this device"
"Email hoặc mật khẩu không đúng." → "Incorrect email or password."
"Mã không đúng hoặc đã hết hạn." → "The code is wrong or has expired."
"Chưa kết nối được máy chủ TapEasy. Kiểm tra mạng rồi thử lại — dữ liệu tập cá nhân trên máy vẫn dùng bình thường." → "Can't reach the TapEasy server. Check your connection and try again — your on-device workout data still works."
"Hệ thống đang quá tải hoặc đã hết hạn mức trong ngày. Vui lòng thử lại sau ít phút." → "The system is busy or today's quota is used up. Please try again in a few minutes."
"Đây là cách đăng nhập duy nhất của bạn. Hãy thêm một cách khác (mật khẩu, Google…) trước khi huỷ liên kết." → "This is your only sign-in method. Add another one (password, Google…) before unlinking."
```
(Câu có số động — "Vui lòng đợi N giây rồi gửi lại.", "Gửi lại (Ns)", "Đã sao lưu · giờ" — cần mẫu dịch có biến; 3 ô đồng ý và các sheet dài nên dịch theo khối.)

## 6. Việc chủ dự án phải tự làm

1. Làm theo `docs/DATABASE-SETUP.md` §1–9: tạo project (vùng `asia-southeast1`), bật Auth, tạo Firestore, điền `firebase-config.js`, `firebase deploy --only firestore:rules,firestore:indexes` (+ `functions` khi lên Blaze), thêm app Android (SHA-1/SHA-256, `google-services.json`) và iOS (`GoogleService-Info.plist`), Authorized domain `thangvu030198-ai.github.io`.
2. Điền các chỗ `[ĐIỀN …]` trong `privacy-policy.html` và `terms.html` (tên đơn vị, email hỗ trợ, địa chỉ, mã số thuế).
3. Quyết định gói: Spark chạy được đăng nhập + sao lưu + liên kết; **kết nối PT bằng mã mời, đơn hàng, quản trị, OTP cần Blaze** (đặt cảnh báo ngân sách).
4. Tuỳ chọn: bật `phoneOtp` (SMS tốn phí; giới hạn vùng VN) / `emailOtp` (cần dịch vụ gửi mail + `MAIL_API_KEY`, `OTP_PEPPER`).
5. Pháp lý (`docs/LEGAL-VN.md` cuối file): thuê luật sư rà; nộp 2 hồ sơ đánh giá tác động (xử lý dữ liệu + chuyển dữ liệu ra nước ngoài); thủ tục mạng xã hội trước khi mở Cộng đồng; thông báo Bộ Công Thương trước khi nhận đơn; phương án lưu bản sao dữ liệu tại Việt Nam; phân công trực kiểm duyệt 24 giờ.
6. Native cần App Store / Play Console: Facebook native, APNs key cho OTP SMS trên iOS, Play Integrity, App Check (chưa khởi tạo trong client — đừng bật *Enforce*).

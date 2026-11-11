# TapEasy — Thiết kế PHÂN QUYỀN QUẢN TRỊ (RBAC)

Tài liệu cho chủ app và người vận hành: ai được làm gì trong Bảng quản trị, vì sao, và quy trình an toàn. Mã nguồn: `rbac.js` (lõi), `cloud-admin.js` (dữ liệu), `admin.js` (giao diện), `functions/admin.js` (máy chủ). Cách gắn vào app: `docs/INTEGRATION-admin.md`.

## 1. Nguyên tắc

1. **Đặc quyền tối thiểu** — mỗi vai trò chỉ có quyền cho đúng việc của mình; Phân tích chỉ xem.
2. **Không leo thang** — chỉ gán được vai trò **thấp hơn cấp của mình**, và tập quyền của vai trò đó phải là **tập con** quyền của mình. Không ai sửa / khoá được người **ngang cấp hoặc cấp cao hơn**. Không ai tự đổi vai trò của chính mình.
3. **Chủ sở hữu được bảo vệ** — duy nhất 1 Owner; không ai hạ, thu hồi, khoá được Owner; quyền Owner chỉ trao bằng **Chuyển nhượng** do chính Owner thực hiện.
4. **Tách nhiệm vụ nhạy cảm** — 4 quyền nhạy cảm (`roles.assign`, `owner.transfer`, `settings.payment`, `users.delete`) **chỉ đi kèm vai trò**, không cấp lẻ, và cần **nhập lại mật khẩu** (≤ 5 phút). Tài khoản nhận tiền chỉ Owner sửa (chống nhân sự đổi số tài khoản để chiếm tiền khách chuyển khoản).
5. **Mọi thay đổi đều để lại dấu vết** — nhật ký kiểm toán **chỉ-thêm**, có chuỗi băm SHA-256.
6. **Máy chủ quyết định** — giao diện chỉ ẩn/hiện; quyền thật kiểm ở Cloud Functions + `firestore.rules` (`hasPerm()`), vai trò lấy từ `roles/{uid}` (không tin token cũ).

## 2. Vai trò

| Khoá | Vai trò | Cấp | Số quyền | Gán được | Phạm vi |
|---|---|:-:|:-:|---|---|
| `owner` | **Chủ sở hữu** (Owner) | 100 | 36 | Quản trị cấp cao, Quản trị viên, Quản lý nội dung, Quản lý sự kiện, Quản lý cửa hàng, Quản lý PT, Kiểm duyệt viên, Hỗ trợ khách hàng, Phân tích | Duy nhất · toàn quyền · chuyển nhượng được. Không ai hạ được vai trò này. |
| `super_admin` | **Quản trị cấp cao** (Super Admin) | 90 | 34 | Quản trị viên, Quản lý nội dung, Quản lý sự kiện, Quản lý cửa hàng, Quản lý PT, Kiểm duyệt viên, Hỗ trợ khách hàng, Phân tích | Toàn quyền vận hành, gán vai trò thấp hơn. Không sửa tài khoản nhận tiền, không chuyển nhượng. |
| `admin` | **Quản trị viên** (Admin) | 70 | 32 | — | Vận hành hằng ngày mọi mảng. Không gán vai trò, không xoá tài khoản, không sửa tài khoản nhận tiền. |
| `content_manager` | **Quản lý nội dung** (Content) | 50 | 9 | — | Kho kiến thức (soạn, xuất bản) và cộng đồng (kiểm duyệt, ghim bài). |
| `event_manager` | **Quản lý sự kiện** (Events) | 50 | 8 | — | Thử thách, sự kiện offline, check-in, trao quà. |
| `shop_manager` | **Quản lý cửa hàng** (Shop) | 50 | 11 | — | Sản phẩm, đơn hàng, hoàn tiền, voucher, giao quà. |
| `pt_manager` | **Quản lý PT** (PT) | 50 | 7 | — | Xác minh PT, niêm yết Tìm PT, đánh giá PT. |
| `moderator` | **Kiểm duyệt viên** (Moderator) | 40 | 6 | — | Hàng đợi báo cáo, đánh giá, bình luận / bài cộng đồng. |
| `support` | **Hỗ trợ khách hàng** (Support) | 40 | 6 | — | Tra cứu người dùng, đơn hàng; trả lời yêu cầu hỗ trợ; ghi chú. |
| `analyst` | **Phân tích** (Analyst) | 20 | 6 | — | Chỉ xem số liệu, xuất CSV không chứa dữ liệu cá nhân. |

Gợi ý phân công cho đội nhỏ: chủ app = Owner; đồng sáng lập = Super Admin; nhân viên vận hành chính = Admin; CTV viết bài = Quản lý nội dung; người đứng sự kiện = Quản lý sự kiện (cấp tạm theo mùa giải, thu hồi sau); nhân viên kho = Quản lý cửa hàng; CSKH = Hỗ trợ; nhà đầu tư / kế toán = Phân tích.

## 3. Danh mục quyền (36 quyền `nhóm.hành_động`)

| Quyền | Nhóm | Ý nghĩa | Nhạy cảm |
|---|---|---|:-:|
| `panel.access` | Bảng quản trị | Vào bảng quản trị |  |
| `analytics.view` | Phân tích | Xem số liệu tổng quan & thống kê |  |
| `data.export` | Dữ liệu | Xuất dữ liệu CSV |  |
| `users.view` | Người dùng | Xem danh sách & hồ sơ người dùng |  |
| `users.pii` | Người dùng | Xem email / SĐT / địa chỉ (dữ liệu cá nhân) |  |
| `users.note` | Người dùng | Ghi chú nội bộ trên hồ sơ người dùng |  |
| `users.ban` | Người dùng | Khoá / mở khoá tài khoản |  |
| `users.delete` | Người dùng | Xoá tài khoản theo yêu cầu | ● |
| `roles.view` | Phân quyền | Xem đội ngũ & vai trò |  |
| `roles.assign` | Phân quyền | Gán / thu hồi vai trò (thấp hơn mình) | ● |
| `owner.transfer` | Phân quyền | Chuyển nhượng quyền Chủ sở hữu | ● |
| `pt.view` | PT & niêm yết | Xem hồ sơ PT & yêu cầu xác minh |  |
| `pt.verify` | PT & niêm yết | Xác minh / thu hồi tích xanh PT |  |
| `listings.moderate` | PT & niêm yết | Ẩn / hiện niêm yết PT (Tìm PT) |  |
| `reports.view` | Kiểm duyệt | Xem hàng đợi báo cáo vi phạm |  |
| `reports.resolve` | Kiểm duyệt | Xử lý báo cáo vi phạm |  |
| `reviews.moderate` | Kiểm duyệt | Ẩn / xoá đánh giá (PT, sự kiện) |  |
| `community.moderate` | Kiểm duyệt | Ẩn / khôi phục / xoá bài cộng đồng, bình luận |  |
| `community.feature` | Kiểm duyệt | Ghim / nổi bật bài cộng đồng |  |
| `kb.edit` | Kho kiến thức | Soạn / sửa bài kho kiến thức |  |
| `kb.publish` | Kho kiến thức | Xuất bản / gỡ bài kho kiến thức |  |
| `events.manage` | Sự kiện & thi đua | Tạo / sửa / ẩn sự kiện offline |  |
| `events.checkin` | Sự kiện & thi đua | Check-in, quét vé, xem danh sách đăng ký |  |
| `challenges.manage` | Sự kiện & thi đua | Tạo / sửa thử thách, chốt kết quả |  |
| `gifts.manage` | Sự kiện & thi đua | Trao quà, cập nhật giao quà |  |
| `shop.products` | Cửa hàng | Sản phẩm, giá, tồn kho |  |
| `orders.view` | Cửa hàng | Xem đơn hàng (chỉ đọc) |  |
| `shop.orders` | Cửa hàng | Cập nhật trạng thái đơn hàng |  |
| `shop.refund` | Cửa hàng | Huỷ / hoàn tiền đơn đã xác nhận |  |
| `vouchers.manage` | Cửa hàng | Tạo / thu hồi mã giảm giá |  |
| `support.tickets` | Hỗ trợ khách hàng | Xem & trả lời yêu cầu hỗ trợ |  |
| `broadcast.send` | Thông báo | Gửi thông báo toàn hệ thống |  |
| `settings.view` | Cài đặt | Xem cài đặt app |  |
| `settings.edit` | Cài đặt | Sửa cài đặt chung (phí ship, hotline…) |  |
| `settings.payment` | Cài đặt | Sửa thông tin chuyển khoản nhận tiền | ● |
| `audit.view` | Kiểm toán | Xem nhật ký kiểm toán |  |

## 4. Ma trận vai trò × quyền

| Quyền | Owner | Super | Admin | Nội dung | Sự kiện | Cửa hàng | QL PT | Kiểm duyệt | Hỗ trợ | Phân tích |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Bảng quản trị** | | | | | | | | | | |
| `panel.access` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Phân tích** | | | | | | | | | | |
| `analytics.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ |
| **Dữ liệu** | | | | | | | | | | |
| `data.export` | ✓ | ✓ | ✓ | · | ✓ | ✓ | · | · | · | ✓ |
| **Người dùng** | | | | | | | | | | |
| `users.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `users.pii` | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | · |
| `users.note` | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | · |
| `users.ban` | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `users.delete` | ✓ | ✓ | · | · | · | · | · | · | · | · |
| **Phân quyền** | | | | | | | | | | |
| `roles.view` | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `roles.assign` | ✓ | ✓ | · | · | · | · | · | · | · | · |
| `owner.transfer` | ✓ | · | · | · | · | · | · | · | · | · |
| **PT & niêm yết** | | | | | | | | | | |
| `pt.view` | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · | ✓ |
| `pt.verify` | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · | · |
| `listings.moderate` | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · | · |
| **Kiểm duyệt** | | | | | | | | | | |
| `reports.view` | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | ✓ | · | · |
| `reports.resolve` | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · |
| `reviews.moderate` | ✓ | ✓ | ✓ | · | · | · | ✓ | ✓ | · | · |
| `community.moderate` | ✓ | ✓ | ✓ | ✓ | · | · | · | ✓ | · | · |
| `community.feature` | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| **Kho kiến thức** | | | | | | | | | | |
| `kb.edit` | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| `kb.publish` | ✓ | ✓ | ✓ | ✓ | · | · | · | · | · | · |
| **Sự kiện & thi đua** | | | | | | | | | | |
| `events.manage` | ✓ | ✓ | ✓ | · | ✓ | · | · | · | · | · |
| `events.checkin` | ✓ | ✓ | ✓ | · | ✓ | · | · | · | · | · |
| `challenges.manage` | ✓ | ✓ | ✓ | · | ✓ | · | · | · | · | · |
| `gifts.manage` | ✓ | ✓ | ✓ | · | ✓ | ✓ | · | · | · | · |
| **Cửa hàng** | | | | | | | | | | |
| `shop.products` | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | · |
| `orders.view` | ✓ | ✓ | ✓ | · | · | ✓ | · | · | ✓ | ✓ |
| `shop.orders` | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | · |
| `shop.refund` | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | · |
| `vouchers.manage` | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | · |
| **Hỗ trợ khách hàng** | | | | | | | | | | |
| `support.tickets` | ✓ | ✓ | ✓ | · | · | · | · | · | ✓ | · |
| **Thông báo** | | | | | | | | | | |
| `broadcast.send` | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| **Cài đặt** | | | | | | | | | | |
| `settings.view` | ✓ | ✓ | ✓ | · | · | ✓ | · | · | · | · |
| `settings.edit` | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| `settings.payment` | ✓ | · | · | · | · | · | · | · | · | · |
| **Kiểm toán** | | | | | | | | | | |
| `audit.view` | ✓ | ✓ | ✓ | · | · | · | · | · | · | · |
| **Tổng** | 36 | 34 | 32 | 9 | 8 | 11 | 7 | 6 | 6 | 6 |

**Quyền riêng từng người (px):** khi gán vai trò có thể *bớt* quyền của vai trò (`-shop.refund`) hoặc *cấp lẻ* (`+audit.view`) — tối đa 12 ngoại lệ; cấp lẻ chỉ được quyền **người gán đang có** và **không phải quyền nhạy cảm**; luôn giữ `panel.access`. Owner luôn đủ quyền, không nhận ngoại lệ. Ví dụ: Kiểm duyệt viên chỉ duyệt đánh giá + xem nhật ký = `moderator` + `["-community.moderate", "+audit.view"]`.

## 5. Khởi tạo Chủ sở hữu

- **Bản demo** (chưa cấu hình Firebase — chỉ để thử trên web): **không còn mã mặc định công khai** (QS-16, 11/2026). Mỗi máy có mã khởi tạo NGẪU NHIÊN riêng dạng `TE-XXXX-XXXX-XXXX`: người phát triển mở Console chạy `cloudAdmin.demoBootCode()`. Đăng ký tài khoản **email + mật khẩu** (tài khoản Google/Facebook/Apple giả lập không vào được quản trị) → Hồ sơ → **"Thiết lập quản trị lần đầu"** (chỉ hiện khi app chưa có Owner; hoặc mở `#admin` trên web) → nhập mã + mật khẩu. Đặt mã cố định: `window.TAPEASY_ADMIN_CONFIG = { bootstrapHash: TE_RBAC.core.sha256("tapeasy-owner:" + "MÃ-MỚI") }` trước `rbac.js`. **App native (store) chạy demo không có quản trị** (`allowDemoAdmin` chỉ dùng khi phát triển).
- Lối vào ẩn "chạm 7 lần dòng phiên bản" **đã bỏ** (App Store 2.3.1). Lối vào quản trị: Hồ sơ → "Bảng quản trị" / menu ☰ (chỉ tài khoản có vai trò).
- **Firebase**: mã là secret `OWNER_BOOTSTRAP_CODE` (≥ 12 ký tự, chỉ người triển khai biết; không nằm trong mã nguồn). Callable `bootstrapOwner` yêu cầu email đã xác minh, giới hạn 5 lần thử / giờ / tài khoản, transaction đảm bảo chỉ 1 lần. Xong thì **xoá secret** (đặt lại khi cần khôi phục). Callable `ownerStatus` cho app biết đã có Owner chưa (để ẩn "Thiết lập quản trị lần đầu").
- **Owner bị xoá tài khoản** bằng đường khác (Console / Admin SDK — app và `deleteMyAccount` đều chặn Owner tự xoá): `cleanupDeletedUser` đánh dấu `roles_meta/owner.orphaned` + audit `owner.deleted` → `bootstrapOwner` cho khởi tạo lại bằng secret (QS-21).

## 6. Phiên quản trị

| Cơ chế | Giá trị | Lý do |
|---|---|---|
| Vào bảng quản trị | nhập lại mật khẩu (Google/Apple/Facebook: xác thực lại bằng cửa sổ đăng nhập) | máy để quên / bị mượn không tự mở được quyền |
| Tự khoá khi không thao tác | 30 phút (`idleMin`) | |
| Thời hạn tối đa 1 phiên | 12 giờ (`maxHours`) | |
| Xác thực lại cho thao tác nhạy cảm | 5 phút (`stepUpMin`) — gán vai trò, chuyển nhượng, tài khoản nhận tiền | |
| Sai mật khẩu | 5 lần → khoá 5 phút, mỗi lần sai ghi audit `admin.login_failed` | chống dò mật khẩu |
| Lưu phiên | `sessionStorage` (đóng tab = hết phiên) | không lưu lâu dài trên máy |
| Có vai trò nhưng chưa vào phiên | `teCan()` = false — app hiển thị như người dùng thường | tránh thao tác nhầm khi dùng app cá nhân |
| Firebase | `setRole` cần đăng nhập ≤ 30 phút; `transferOwnership` ≤ 5 phút (`auth_time`) | máy chủ tự kiểm, không tin client |

## 7. Nhật ký kiểm toán

Mỗi bản ghi: `seq`, thời gian, người thực hiện (uid, tên, vai trò), hành động, đối tượng (loại, id, tên), chi tiết (trước → sau, lý do), `prev` (băm bản trước), `hash = SHA-256(prev | JSON chuẩn hoá)`.

- **Chỉ-thêm**: API không có hàm sửa/xoá; Firestore rules `update, delete: if false`; client chỉ được ghi bản ghi *của chính mình* với vai trò khớp token và `ts == request.time`; Function `chainAudit` gán `seq/prev/hash` phía máy chủ và đánh dấu `suspicious` nếu vai trò khai không khớp `roles/{uid}`.
- **Phát hiện sửa/xoá**: mục Nhật ký hiển thị "Toàn vẹn: N bản ghi" hoặc "PHÁT HIỆN SỬA ĐỔI tại #k".
- **Dữ liệu nhạy cảm được che**: số tài khoản chỉ còn 4 số cuối; mã vé check-in chỉ 2 ký tự cuối; email không ghi vào audit; mỗi lần xem / liệt kê dữ liệu cá nhân ghi `user.pii_view` / `user.pii_list`.
- Hành động được ghi: `owner.bootstrap(_failed)`, `owner.transfer`, `role.assign/revoke/denied`, `access.denied`, `admin.login/logout/login_failed`, `user.ban/unban/note/pii_view/pii_list`, `pt.verify/reject`, `listing.hide/show`, `mod.<routine|review|report>.<keep|hide|delete>`, `community.feature/unfeature`, `ticket.reply/close`, `broadcast.send/retract`, `settings.update/payment`, `voucher.save/revoke`, `data.export`, và mọi thao tác ghi sự kiện / cửa hàng (`challenge.*`, `event.*`, `product.*`, `order.update`, `gift.*`).
- Lưu giữ: không tự xoá. Khuyến nghị xuất CSV hằng quý và lưu ngoài app (Google Drive công ty) ≥ 2 năm.

## 8. Quy trình vận hành

- **Thêm nhân sự**: người đó tự đăng ký tài khoản → mở Bảng quản trị → chép UID gửi Owner → Owner/Super Admin *Đội ngũ → Thêm người* → chọn vai trò thấp nhất đủ dùng → ghi lý do.
- **Nghỉ việc / hết mùa sự kiện**: *Người dùng → chi tiết → Vai trò: Không có* (thu hồi ngay — firebase: rules so `roles/{uid}` nên mất quyền tức thì, không chờ token). Nếu nghi lộ tài khoản: khoá tài khoản (thu hồi mọi phiên đăng nhập).
- **Rà soát định kỳ (mỗi quý)**: mở *Đội ngũ*, xoá vai trò không còn dùng, kiểm các ngoại lệ px; mở *Nhật ký*, lọc `access.denied`, `role.denied`, `admin.login_failed`, `suspicious`.
- **Đổi tài khoản nhận tiền**: chỉ Owner, gõ "ĐÚNG TÀI KHOẢN" + nhập lại mật khẩu; thông báo cho đội ngũ qua kênh khác (điện thoại) để xác nhận — chống mạo danh.
- **Chuyển nhượng** (bán / bàn giao công ty): Owner → *Đội ngũ → Chuyển nhượng* → chọn người nhận (nên là Super Admin đã xác minh email) → gõ "CHUYỂN NHƯỢNG" → nhập lại mật khẩu. Owner cũ thành Super Admin; người nhận có thể hạ tiếp.
- **Owner xoá tài khoản**: bị chặn — phải chuyển nhượng trước (diff `pt.js` trong INTEGRATION §6.6).

## 9. Khôi phục khi mất tài khoản Owner (Firebase)

Chỉ người giữ service account của dự án (Firebase Console → Project settings → Service accounts) làm, trên máy tin cậy:
```js
// node recover-owner.js <uid-mới>   (cần: npm i firebase-admin; GOOGLE_APPLICATION_CREDENTIALS=khoá-service-account.json)
const admin = require("firebase-admin"); admin.initializeApp();
const uid = process.argv[2], db = admin.firestore(), ts = admin.firestore.FieldValue.serverTimestamp();
(async ()=>{
  const old = (await db.doc("roles_meta/owner").get()).data();
  await db.doc("roles_meta/owner").set({ uid, at: ts, prev: old ? old.uid : null, recovered: true });
  await db.doc("roles/" + uid).set({ role: "owner", px: [], by: "recovery", at: ts });
  if(old && old.uid && old.uid !== uid) await db.doc("roles/" + old.uid).delete();
  const u = await admin.auth().getUser(uid); await admin.auth().setCustomUserClaims(uid, Object.assign({}, u.customClaims, { role: "owner" }));
  await db.collection("admin_audit").add({ actorUid: "recovery", actorRole: "owner", action: "owner.recover", target: { type: "user", id: uid }, ts, client: "functions" });
})();
```
Sau đó thu hồi khoá service account đã dùng và tạo khoá mới.

## 10. Mô hình đe doạ (tóm tắt)

| Mối đe doạ | Biện pháp |
|---|---|
| Người dùng tự bật quản trị (sửa `state.isAdmin`, DevTools) | `state.isAdmin` chỉ đọc theo RBAC; không còn lối vào ẩn 7 lần chạm; firebase: rules + claims do máy chủ cấp |
| Script lạ (XSS) chạy trong máy nhân sự dùng token còn hạn (QS-05) | rules `hasPerm()` đòi `auth_time` ≤ 12 giờ; Functions quản trị `recentSec` 12 giờ; tài khoản nhận tiền chỉ qua callable `setPaymentInfo` (≤ 5 phút + audit + thư báo Owner); phiên client gắn `auth_time` thật của token (sửa sessionStorage không hồi sinh phiên) |
| Vai trò tên lạ (`__proto__`, `constructor`) (QS-18) | `isRole()` = thuộc tính riêng của bảng vai trò (client + Functions) |
| Nhân sự bị khoá / bị bớt quyền lẻ vẫn dùng token ≤ 1 giờ (QS-13) | `banUser` treo vai trò (`roles.suspended`) + gỡ claims; rules/storage so cả `px`, `suspended`, `bans/` |
| Ghi audit giả / cắt đuôi chuỗi (QS-15) | client không ghi `admin_audit` (rules `create: false`) — `logAdminAction` lấy người làm từ `roles/{uid}`, chỉ nhận hành động thuộc quyền; `verifyAudit` (máy chủ) tính lại SHA-256 + so `admin_audit_meta/head` |
| Nhân sự tự nâng quyền / nâng quyền cho đồng bọn | `checkAssign` (client + Function, cùng logic, test so khớp): thấp hơn cấp mình, tập con quyền, không cấp lẻ quyền nhạy cảm |
| Hạ / khoá Owner để chiếm app | Owner bảo vệ tuyệt đối; chuyển nhượng chỉ do Owner + xác thực lại ≤ 5 phút + cụm từ |
| Token cũ sau khi bị thu hồi vai trò | rules `staffFresh()` so `roles/{uid}.role` với claims; Function đọc `roles/{uid}` |
| Nhân sự bị khoá vẫn dùng phiên cũ | `banUser`: Auth disabled + `revokeRefreshTokens`; Function chặn tài khoản có `bans` |
| Đổi tài khoản nhận tiền | chỉ `settings.payment` (Owner) qua callable `setPaymentInfo`: xác thực lại ≤ 5 phút (máy chủ kiểm `auth_time`), audit che số, thư báo Owner (collection `mail`); rules cấm client ghi `settings/public.bank` |
| Xoá dấu vết | audit chỉ-thêm + chuỗi băm + `chainAudit` phía máy chủ |
| Lộ dữ liệu cá nhân | email/SĐT chỉ với `users.pii`; danh sách người dùng qua callable (rules vẫn cấm list users); mỗi lần xem PII ghi audit; CSV của người không có `users.pii` không chứa email |
| XSS qua tên người dùng / nội dung trong bảng quản trị | mọi dữ liệu qua `esc()`; test kiểm tên chứa `<img onerror>` |
| Dò mã khởi tạo / mật khẩu | băm SHA-256 + so sánh hằng thời gian (Function), giới hạn 5 lần/giờ; khoá 5 phút sau 5 lần sai |
| **Bản demo** | chỉ mô phỏng — ai sửa được `localStorage` thì sửa được quyền; chuỗi băm giúp phát hiện sửa vụng. Không dùng bản demo cho dữ liệu thật. |

## 11. Kiểm thử

`node tests/run.js --only rbac` — suite `30-rbac` (27 test): ma trận; **vét cạn chống leo thang** (11 người gán × 11 người bị gán × 12 vai trò mới × 11 bộ quyền lẻ × 2 = 31 944 tổ hợp, mọi ca được phép đều thoả bất biến); Owner bảo vệ; SHA-256 khớp `crypto` Node, chuỗi băm phát hiện sửa/xoá/đảo; `functions/admin.js` và `firestore.rules` đề xuất khớp ma trận `rbac.js`; Cloud Functions với Admin SDK giả lập (`bootstrapOwner`, `setRole`, `transferOwnership`, `banUser/unbanUser`, `adminGetUser`, `adminListUsers`, `sendBroadcast`, `chainAudit`); app thật động cơ demo (state.isAdmin cũ, 7 lần chạm, khởi tạo Owner, phân tầng, quyền lẻ, khoá, phiên/xác thực lại/khoá do sai mật khẩu, bọc cloudEvents, cài đặt & tài khoản nhận tiền, chuyển nhượng, kiểm duyệt/PT/hỗ trợ/thông báo, bảng điều khiển theo quyền, audit chỉ-thêm, teCan).
Trình duyệt thật: `python3 _test/admin-kit/build.py` → `_test/admin-flow.html` (Playwright, ngữ cảnh riêng `tapeasy-admin`): 29/29, 0 lỗi JS; ảnh `_test/shots/adm-*.png`.

# Tích hợp QUẢN TRỊ & PHÂN QUYỀN (`rbac.js`, `cloud-admin.js`, `admin.js/.css`, `functions/admin.js`)

Đáp ứng yêu cầu chủ app: *"tài khoản phân tầng quản lý app riêng cho chủ app, phân cấp độ quản lý, quyền hạn mỗi người khác nhau"*.
Thay chế độ quản trị tạm `state.isAdmin` (chạm 7 lần dòng phiên bản) bằng **tài khoản quản trị có vai trò** + phiên đăng nhập quản trị + nhật ký kiểm toán chỉ-thêm.
Không sửa file có sẵn — chỉ thêm 7 file + 2 tài liệu (thiết kế phân quyền chi tiết: `docs/RBAC.md`).

| File | Vai trò |
|---|---|
| `rbac.js` | Lõi phân quyền: 10 vai trò × 36 quyền `nhóm.hành_động`, hàm thuần chống leo thang / bảo vệ Owner / chuỗi băm SHA-256, phiên quản trị, `TE_RBAC`, `teCan()`, vô hiệu hoá `state.isAdmin` cũ. **Nạp ngay sau `cloud.js`.** |
| `cloud-admin.js` | Lớp dữ liệu quản trị (demo `localStorage` / Firebase + callable). Bọc quyền cho `cloudEvents` (events.js, shop.js), chặn tài khoản bị khoá đăng nhập, áp cài đặt vào gian hàng. |
| `admin.js` + `admin.css` | Bảng điều khiển (máy tính + điện thoại) · màn đăng nhập quản trị · phía người dùng: thông báo hệ thống trên Trang chủ, "Liên hệ hỗ trợ", "Xác minh PT (tích xanh)". |
| `functions/admin.js` | Cloud Functions: `bootstrapOwner`, `setRole`, `transferOwnership`, `banUser`, `unbanUser`, `adminGetUser`, `adminListUsers`, `sendBroadcast`, trigger `chainAudit`. |
| `tests/suites/30-rbac.test.js` | Kiểm thử Node (lõi, demo, Cloud Functions với Admin SDK giả, rules khớp ma trận). |

## 1. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="health-safety.css">
+  <link rel="stylesheet" href="admin.css">
   <link rel="stylesheet" href="brand.css">
 ...
   <script src="cloud.js"></script>
+  <script src="rbac.js"></script>          <!-- NGAY SAU cloud.js: trước app.js (vô hiệu isAdmin cũ trước khi state nạp) và trước events.js (chặn bộ đếm 7 lần chạm) -->
   <script src="data.js"></script>
 ...
   <script src="shop.js"></script>           <!-- (và community.js, findpt.js, kb.js nếu có) -->
+  <script src="cloud-admin.js"></script>   <!-- SAU cloud-events/events/shop/cloud-social/community: bọc quyền các API đó -->
+  <script src="admin.js"></script>
   <script src="health-safety.js"></script>   <!-- LUÔN CUỐI -->
```

- Thứ tự bắt buộc: `cloud.js → rbac.js → … → cloud-admin.js → admin.js`. Thiếu `cloud-admin.js`/`admin.js` thì `TE_RBAC` vẫn chạy (mọi `can()` = false, 7 lần chạm báo "chưa cài bảng quản trị").
- `admin.css` đặt sau CSS module, trước `brand.css`/`themes-modules.css` (bảng quản trị luôn tối, không bị theme sáng đè vì mọi lớp có tiền tố `.adm`).
- `scripts/prepare-www.sh`: thêm `admin.css` vào `cp` CSS; `rbac.js cloud-admin.js admin.js` vào `cp` JS.
- `sw.js`: thêm 4 file vào `ASSETS`, tăng `CACHE` (`fitkit-v6`).
- Tuỳ chọn, đặt **trước** `rbac.js`:
```html
<script>window.TAPEASY_ADMIN_CONFIG = { idleMin: 30, maxHours: 12, stepUpMin: 5, maxFails: 5, lockMin: 5,
  bootstrapHash: "<sha256('tapeasy-owner:' + MÃ_IN_HOA)>" };   // chỉ bản demo; Firebase dùng secret OWNER_BOOTSTRAP_CODE
</script>
```

Lối vào bảng quản trị: **Hồ sơ → thẻ "Hỗ trợ & quản trị" → Bảng quản trị** (chỉ hiện với tài khoản có vai trò) · **menu ☰ → Bảng quản trị** · **chạm 7 lần dòng "TapEasy v2.0.0"** (giờ mở màn *đăng nhập quản trị*, không còn bật quyền) · địa chỉ `…/index.html#admin` (dùng trên máy tính). Nút Back Android / Esc: đóng hộp thoại → đóng bảng quản trị.

## 2. Khởi tạo Chủ sở hữu & cấp vai trò

**Demo (chưa cấu hình Firebase):** đăng ký / đăng nhập tài khoản → mở bảng quản trị → "Khởi tạo Chủ sở hữu" → nhập mã **`TAPEASY-OWNER-2026`** + mật khẩu. Mã chỉ dùng được khi app chưa có Owner (lần thứ 2 bị từ chối). Đổi mã: đặt `TAPEASY_ADMIN_CONFIG.bootstrapHash` (băm SHA-256 của `tapeasy-owner:` + mã in hoa — tính bằng `TE_RBAC.core.sha256(...)`).

**Firebase:**
```bash
cd functions
firebase functions:secrets:set OWNER_BOOTSTRAP_CODE        # ≥ 12 ký tự ngẫu nhiên, VD: openssl rand -base64 18
firebase deploy --only functions,firestore:rules
```
1. Chủ app đăng ký tài khoản email/mật khẩu trong app → **xác minh email** (bắt buộc với tài khoản mật khẩu).
2. Mở bảng quản trị → nhập mã khởi tạo → callable `bootstrapOwner` đặt `roles/{uid}`, `roles_meta/owner`, custom claims `{ role:"owner" }` (transaction: chỉ 1 lần).
3. Sau khi có Owner: **xoá / đổi secret** (`firebase functions:secrets:destroy OWNER_BOOTSTRAP_CODE`) — mã cũ vô dụng nhưng không nên để lại.
4. Nhân sự: đăng ký tài khoản → mở bảng quản trị → chép **UID** gửi Owner → Owner/Super Admin: *Đội ngũ → Thêm người* hoặc *Người dùng → chi tiết → Vai trò* (gọi `setRole`).

Mất quyền truy cập tài khoản Owner: dùng Admin SDK trên máy tin cậy (service account) — quy trình ở `docs/RBAC.md §9`.

## 3. Cloud Functions — `functions/index.js` (KHÔNG sửa tay ngoài diff này)

```diff
 const apple = require("./apple");

 admin.initializeApp();
+
+/* Quản trị & phân quyền (functions/admin.js): bootstrapOwner, setRole, transferOwnership, banUser, unbanUser,
+   adminGetUser, adminListUsers, sendBroadcast, chainAudit — xem docs/INTEGRATION-admin.md */
+Object.assign(exports, require("./admin"));

 const REGION = "asia-southeast1";
 ...
-const USER_DOC_COLLECTIONS = ["users"];
+const USER_DOC_COLLECTIONS = ["users", "roles", "pt_verifications", "userSocial"];   // xoá tài khoản → xoá vai trò, hồ sơ xác minh
```
- Không cần thư viện mới (dùng `firebase-admin`, `firebase-functions` v6 sẵn có; trigger Firestore v2).
- Secret: `OWNER_BOOTSTRAP_CODE`. Không có biến `.env` mới.
- `functions/package.json` giữ nguyên. Node 22.
- **Owner xoá tài khoản**: `cleanupDeletedUser` xoá `roles/{uid}` → app mất Owner. Chặn ở client (diff `pt.js` §6.6) và quy trình: chuyển nhượng trước khi xoá.
- Thông báo đẩy (tuỳ chọn): app đăng ký FCM topic `all` và `aud_pt` / `aud_member` / `aud_staff`; gửi với `push:true` (bảng quản trị hiện chưa bật cờ này — bật khi đã có FCM trong app native).

## 4. `firestore.rules` đề xuất đầy đủ

Thay toàn bộ nội dung `firestore.rules` bằng bản dưới. Bản này **sinh từ `firestore.rules` hiện tại (vòng tích hợp 2)** và chỉ đổi:
- hàm `isAdmin()` (admins/{uid} + claim `admin`) → khối RBAC `rolePerms() / tokenRole() / tokenPx() / staffFresh() / hasPerm(p) / isStaff()`;
- mỗi chỗ `isAdmin()` → quyền cụ thể: routine `community.moderate` / `community.feature` / `reports.view`; thử thách `challenges.manage`; sự kiện `events.manage`, đăng ký & check-in `events.checkin`; đánh giá `reviews.moderate` (thêm nhánh ẩn/giữ, chặn tác giả tự sửa cờ kiểm duyệt); sản phẩm `shop.products`; đơn `shop.orders` (+ `shop.refund` khi huỷ đơn đã xác nhận, chỉ sửa trường trạng thái) / `orders.view`; quà `gifts.manage`;
- `users`: **giữ nguyên** `get` (chính mình / hồ sơ PT) và `list: if false` (BUG-03) — bảng quản trị đọc người dùng qua callable `adminListUsers` / `adminGetUser` (Admin SDK, kiểm `users.view`, che email nếu thiếu `users.pii`); trường `ptVerified*` / `listing*` / `role` người dùng không tự ghi được, staff có `pt.verify` / `listings.moderate` ghi đúng các trường đó;
- `admins/{uid}`: giữ dòng cũ nhưng không còn cấp quyền gì; thêm collection quản trị (roles, roles_meta, bans, admin_audit, settings, broadcasts, pt_verifications, support_tickets, user_notes, reports, vouchers, kb).

Ý nghĩa:

- `hasPerm(p)` = vai trò trong **custom claims** có quyền `p` (ngoại lệ `px` "+/-" như client, quyền nhạy cảm không cấp lẻ) **và** `roles/{uid}.role` hiện tại khớp claims (`staffFresh()` → hạ quyền có hiệu lực ngay, không chờ token 1 giờ).
- `roles/*`, `roles_meta/*`, `bans/*` chỉ Cloud Functions ghi. `admin_audit` **chỉ thêm** (create có kiểm tra `actorUid == me()`, `actorRole == token.role`, `ts == request.time`; update/delete: false). `settings/public`: ai cũng đọc; sửa cần `settings.edit`, đổi `bank` cần `settings.payment`.
- Bảng `rolePerms()` sinh từ `rbac.js` — test `30-rbac` đọc khối này và so khớp từng quyền.

```
// TapEasy — Firestore Security Rules ĐẦY ĐỦ + PHÂN QUYỀN QUẢN TRỊ (RBAC) — đề xuất trong docs/INTEGRATION-admin.md
// = firestore.rules vòng tích hợp 2, hàm quản trị cũ (admins/{uid}) thay bằng hasPerm('nhóm.hành_động') + collection quản trị.
// Dán toàn bộ nội dung này vào: Firebase Console → Firestore Database → Rules → Publish
// Vòng tích hợp 2: + PT Connect (chat, lời mời, đồng bộ nhật ký) · Cộng đồng (routine) · Sự kiện · Gian hàng · Quà.
// Nguyên tắc: KHÔNG mở lỏng luật cũ — vẫn cấm list users, ghi chú ràng authorUid, học viên chỉ ghi trường của mình.
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function me() { return request.auth.uid; }
    function onlyKeys(keys) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(keys);
    }
    // Email trong token (chữ thường) — dùng cho lời mời PT gửi theo email
    function myEmail() { return request.auth.token.email != null ? request.auth.token.email.lower() : ''; }
    /* ---------- RBAC: custom claims { role, px } do Cloud Function setRole cấp (functions/admin.js) ----------
       rolePerms() SINH TỪ rbac.js — tests/suites/30-rbac.test.js so khớp từng quyền. */
    function rolePerms() {
      return {
        'owner': ['panel.access', 'analytics.view', 'data.export', 'users.view', 'users.pii', 'users.note',
          'users.ban', 'users.delete', 'roles.view', 'roles.assign', 'owner.transfer', 'pt.view',
          'pt.verify', 'listings.moderate', 'reports.view', 'reports.resolve', 'reviews.moderate', 'community.moderate',
          'community.feature', 'kb.edit', 'kb.publish', 'events.manage', 'events.checkin', 'challenges.manage',
          'gifts.manage', 'shop.products', 'orders.view', 'shop.orders', 'shop.refund', 'vouchers.manage',
          'support.tickets', 'broadcast.send', 'settings.view', 'settings.edit', 'settings.payment', 'audit.view'],
        'super_admin': ['panel.access', 'analytics.view', 'data.export', 'users.view', 'users.pii', 'users.note',
          'users.ban', 'users.delete', 'roles.view', 'roles.assign', 'pt.view', 'pt.verify',
          'listings.moderate', 'reports.view', 'reports.resolve', 'reviews.moderate', 'community.moderate', 'community.feature',
          'kb.edit', 'kb.publish', 'events.manage', 'events.checkin', 'challenges.manage', 'gifts.manage',
          'shop.products', 'orders.view', 'shop.orders', 'shop.refund', 'vouchers.manage', 'support.tickets',
          'broadcast.send', 'settings.view', 'settings.edit', 'audit.view'],
        'admin': ['panel.access', 'analytics.view', 'data.export', 'users.view', 'users.pii', 'users.note',
          'users.ban', 'roles.view', 'pt.view', 'pt.verify', 'listings.moderate', 'reports.view',
          'reports.resolve', 'reviews.moderate', 'community.moderate', 'community.feature', 'kb.edit', 'kb.publish',
          'events.manage', 'events.checkin', 'challenges.manage', 'gifts.manage', 'shop.products', 'orders.view',
          'shop.orders', 'shop.refund', 'vouchers.manage', 'support.tickets', 'broadcast.send', 'settings.view',
          'settings.edit', 'audit.view'],
        'content_manager': ['panel.access', 'analytics.view', 'users.view', 'reports.view', 'reports.resolve', 'community.moderate',
          'community.feature', 'kb.edit', 'kb.publish'],
        'event_manager': ['panel.access', 'analytics.view', 'data.export', 'users.view', 'events.manage', 'events.checkin',
          'challenges.manage', 'gifts.manage'],
        'shop_manager': ['panel.access', 'analytics.view', 'data.export', 'users.view', 'gifts.manage', 'shop.products',
          'orders.view', 'shop.orders', 'shop.refund', 'vouchers.manage', 'settings.view'],
        'pt_manager': ['panel.access', 'users.view', 'pt.view', 'pt.verify', 'listings.moderate', 'reports.view',
          'reviews.moderate'],
        'moderator': ['panel.access', 'users.view', 'reports.view', 'reports.resolve', 'reviews.moderate', 'community.moderate'],
        'support': ['panel.access', 'users.view', 'users.pii', 'users.note', 'orders.view', 'support.tickets'],
        'analyst': ['panel.access', 'analytics.view', 'data.export', 'users.view', 'pt.view', 'orders.view']
      };
    }
    function sensitivePerms() { return ['roles.assign', 'owner.transfer', 'settings.payment', 'users.delete']; }
    function tokenRole() { return signedIn() ? request.auth.token.get('role', '') : ''; }
    function tokenPx() { return signedIn() ? request.auth.token.get('px', []) : []; }
    function roleDocPath() { return /databases/$(database)/documents/roles/$(request.auth.uid); }
    // Claims phải khớp roles/{uid} hiện tại → hạ / thu hồi vai trò có hiệu lực NGAY (không chờ ID token hết hạn)
    function staffFresh() { return exists(roleDocPath()) && get(roleDocPath()).data.role == tokenRole(); }
    function hasPerm(p) {
      return signedIn() && tokenRole() in rolePerms()
        && (tokenRole() == 'owner'
            || (!(('-' + p) in tokenPx())
                && (p in rolePerms()[tokenRole()] || (('+' + p) in tokenPx() && !(p in sensitivePerms())))))
        && staffFresh();
    }
    function isStaff() { return hasPerm('panel.access'); }

    /* ================= QUẢN TRỊ & PHÂN QUYỀN (rbac.js · cloud-admin.js · functions/admin.js) ================= */
    match /roles/{uid} {
      allow get: if signedIn() && (me() == uid || hasPerm('roles.view'));
      allow list: if hasPerm('roles.view');
      allow write: if false;                                  // chỉ Cloud Functions: bootstrapOwner / setRole / transferOwnership
    }
    match /roles_meta/{doc} { allow read: if isStaff(); allow write: if false; }
    match /bans/{uid} {
      allow get: if signedIn() && (me() == uid || hasPerm('users.view'));
      allow list: if hasPerm('users.view');
      allow write: if false;                                  // banUser / unbanUser (Auth disabled + thu hồi token)
    }
    match /admin_rate/{id} { allow read, write: if false; }
    match /admin_audit/{id} {
      allow read: if hasPerm('audit.view');
      allow create: if isStaff()
        && request.resource.data.keys().hasOnly(['actorUid', 'actorName', 'actorRole', 'action', 'target', 'details', 'ts', 'client'])
        && request.resource.data.actorUid == me()
        && request.resource.data.actorRole == tokenRole()
        && request.resource.data.ts == request.time
        && request.resource.data.action is string && request.resource.data.action.size() <= 60
        && request.resource.data.client == 'web';
      allow update, delete: if false;                         // CHỈ THÊM — chainAudit (Admin SDK) gán seq / prev / hash
    }
    match /admin_audit_meta/{doc} { allow read: if hasPerm('audit.view'); allow write: if false; }

    match /settings/public {
      allow read: if signedIn();                              // phí ship, hotline, tài khoản nhận tiền (người mua đã đăng nhập)
      allow create: if hasPerm('settings.edit') && (!('bank' in request.resource.data) || hasPerm('settings.payment'));
      allow update: if hasPerm('settings.edit')
        && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['bank']) || hasPerm('settings.payment'));
      allow delete: if false;
    }
    match /settings/{doc} {                                   // cài đặt nội bộ khác (không công khai)
      allow read: if hasPerm('settings.view');
      allow write: if doc != 'public' && hasPerm('settings.edit');
    }
    match /broadcasts/{id} {
      allow read: if signedIn();
      allow create, delete: if false;                         // sendBroadcast (giới hạn 5 / 24 giờ, FCM)
      allow update: if hasPerm('broadcast.send') && onlyKeys(['retracted', 'retractedBy', 'retractedAt'])
        && request.resource.data.retracted == true && request.resource.data.retractedBy == me();
    }
    match /pt_verifications/{uid} {
      allow get: if signedIn() && (me() == uid || hasPerm('pt.view'));
      allow list: if hasPerm('pt.view');
      allow create: if signedIn() && me() == uid && request.resource.data.uid == uid && request.resource.data.status == 'pending'
        && request.resource.data.certName is string && request.resource.data.certName.size() <= 120;
      allow update: if (signedIn() && me() == uid && resource.data.status != 'verified'
            && request.resource.data.status == 'pending' && request.resource.data.uid == uid
            && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['reviewNote', 'reviewedBy', 'reviewedAt']))
        || (hasPerm('pt.verify') && request.resource.data.status in ['verified', 'rejected']
            && onlyKeys(['status', 'reviewNote', 'reviewedBy', 'reviewedAt']) && request.resource.data.reviewedBy == me());
      allow delete: if hasPerm('pt.verify');
    }
    match /support_tickets/{id} {
      allow create: if signedIn() && request.resource.data.uid == me() && request.resource.data.status == 'open'
        && request.resource.data.text is string && request.resource.data.text.size() <= 2000
        && request.resource.data.replies.size() == 0;
      allow read: if signedIn() && (resource.data.uid == me() || hasPerm('support.tickets'));
      allow update: if hasPerm('support.tickets') && onlyKeys(['status', 'replies', 'updatedAt', 'assignee'])
        && request.resource.data.replies.size() >= resource.data.replies.size();
      allow delete: if false;
    }
    match /user_notes/{uid}/notes/{nid} {
      allow read: if hasPerm('users.note') || hasPerm('support.tickets');
      allow create: if hasPerm('users.note') && request.resource.data.by == me() && request.resource.data.ts == request.time
        && request.resource.data.text is string && request.resource.data.text.size() <= 1000;
      allow update, delete: if false;                         // ghi chú nội bộ chỉ-thêm
    }
    match /reports/{id} {
      allow create: if signedIn() && request.resource.data.by == me() && request.resource.data.status == 'open'
        && request.resource.data.type in ['routine', 'review', 'pt', 'listing', 'user', 'comment', 'kb', 'post']
        && request.resource.data.reason is string && request.resource.data.reason.size() <= 300;
      allow read: if hasPerm('reports.view');
      allow update: if hasPerm('reports.resolve') && onlyKeys(['status', 'resolution', 'resolvedBy', 'resolvedAt'])
        && request.resource.data.resolvedBy == me();
      allow delete: if false;
    }
    match /vouchers/{code} {
      allow get: if signedIn();                               // người mua tra đúng 1 mã
      allow list, create, update: if hasPerm('vouchers.manage');
      allow delete: if false;                                 // thu hồi = revoked:true (giữ lịch sử)
    }
    match /kb/{id} {                                          // Kho kiến thức (kb.js)
      allow read: if resource.data.status == 'published' || hasPerm('kb.edit') || hasPerm('kb.publish');
      allow create: if hasPerm('kb.edit') && (request.resource.data.status in ['draft', 'review'] || hasPerm('kb.publish'));
      allow update: if hasPerm('kb.edit')
        && (request.resource.data.status == resource.data.status
            || (request.resource.data.status in ['draft', 'review'] && resource.data.status in ['draft', 'review'])
            || hasPerm('kb.publish'));
      allow delete: if hasPerm('kb.publish');
    }

    // Hồ sơ người dùng (BUG-03): KHÔNG cho liệt kê (list) toàn bộ users.
    // Chỉ "get" đúng 1 hồ sơ: của chính mình, hoặc hồ sơ PT (trang giới thiệu PT công khai cho học viên).
    // Email KHÔNG còn lưu trong hồ sơ (cloud.js chỉ đọc email từ Firebase Auth) — hồ sơ cũ được xoá trường email khi đăng nhập.
    match /users/{uid} {
      allow get: if signedIn() && (me() == uid || resource.data.isPT == true);
      allow list: if false;
      // Trường do quản trị ghi (xác minh PT, niêm yết, vai trò) — người dùng không tự đặt; staff có quyền ghi đúng các trường đó.
      allow create: if signedIn() && me() == uid
        && !request.resource.data.keys().hasAny(['ptVerified', 'ptVerifiedAt', 'ptVerifiedBy', 'listingHidden', 'listingNote', 'listingBy', 'listingAt', 'role']);
      allow update: if (signedIn() && me() == uid
            && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['ptVerified', 'ptVerifiedAt', 'ptVerifiedBy', 'listingHidden', 'listingNote', 'listingBy', 'listingAt', 'role']))
        || (hasPerm('pt.verify') && onlyKeys(['ptVerified', 'ptVerifiedAt', 'ptVerifiedBy']))
        || (hasPerm('listings.moderate') && onlyKeys(['listingHidden', 'listingNote', 'listingBy', 'listingAt']));
      allow delete: if signedIn() && me() == uid;
    }

    // Mã mời 6 ký tự: học viên chỉ được "get" đúng 1 mã (không liệt kê được toàn bộ)
    match /joinCodes/{code} {
      allow get: if signedIn();
      allow list: if false;
      allow create: if signedIn() && request.resource.data.ptId == me();
      allow delete: if signedIn() && resource.data.ptId == me();
    }

    // Form quản lý PT ↔ học viên
    match /clients/{cid} {
      function isPT() { return resource.data.ptId == me(); }
      function isStudent() { return resource.data.studentUid == me(); }

      allow read: if signedIn() && (isPT() || isStudent());
      allow create: if signedIn() && request.resource.data.ptId == me();
      allow delete: if signedIn() && isPT();
      allow update: if signedIn() && (
        // PT sửa mọi thứ trừ chủ sở hữu
        (isPT() && request.resource.data.ptId == me())
        // Học viên nhập mã: chỉ khi form chưa có ai, chỉ ghi 3 trường của mình
        || (resource.data.studentUid == null
            && request.resource.data.studentUid == me()
            && onlyKeys(['studentUid', 'studentName', 'studentEmail', 'updatedAt']))
        // Học viên rời PT
        || (isStudent()
            && request.resource.data.studentUid == null
            && onlyKeys(['studentUid', 'studentName', 'studentEmail', 'updatedAt']))
        // PT Pro + Social: học viên tự cập nhật hồ sơ sức khoẻ / số đo / ảnh tiến trình, chat (đã đọc / bộ đếm)
        // và nhật ký đồng bộ (trainingSync) — không đụng gói, thanh toán, chủ sở hữu
        || (isStudent()
            && request.resource.data.studentUid == me()
            && onlyKeys(['health', 'measurements', 'photos', 'chat', 'trainingSync', 'updatedAt']))
      );

      // Buổi tập + ghi chú: PT và học viên của form đều đọc được.
      // - sessions: cả hai cùng tạo/sửa (đánh dấu đã tập, phản hồi, proxyLog/studentLog/proxyApplied); chỉ PT xoá.
      // - notes (BUG-03): người ghi phải là chính mình (authorUid == me()), chỉ PT được ghi vai "pt",
      //   kind thuộc danh sách hợp lệ; chỉ tác giả được sửa; PT hoặc tác giả được xoá.
      match /{sub}/{docId} {
        function parent() { return get(/databases/$(database)/documents/clients/$(cid)).data; }
        function member() { return parent().ptId == me() || parent().studentUid == me(); }
        function isPTof() { return parent().ptId == me(); }
        function validNote(d) {
          return d.authorUid == me()
            && d.authorRole in ['pt', 'student'] && (d.authorRole == 'student' || isPTof())
            && d.kind in ['note', 'reminder', 'feedback']
            && d.text is string && d.text.size() <= 4000;
        }
        allow read: if signedIn() && (sub == 'sessions' || sub == 'notes') && member();
        allow create, update: if signedIn() && sub == 'sessions' && member();
        allow create: if signedIn() && sub == 'notes' && member() && validNote(request.resource.data);
        allow update: if signedIn() && sub == 'notes' && member()
                      && resource.data.authorUid == me() && validNote(request.resource.data);
        allow delete: if signedIn() && (isPTof() || (sub == 'notes' && resource.data.authorUid == me()));
      }

      // Chat 1-1 PT ↔ học viên (PT Connect). Người gửi = chính mình, vai khớp với form, không sửa tin.
      match /messages/{mid} {
        function pc() { return get(/databases/$(database)/documents/clients/$(cid)).data; }
        allow read: if signedIn() && (pc().ptId == me() || pc().studentUid == me());
        allow create: if signedIn()
          && request.resource.data.from == me()
          && ((request.resource.data.role == 'pt' && pc().ptId == me())
              || (request.resource.data.role == 'student' && pc().studentUid == me()))
          && request.resource.data.kind in ['text', 'image', 'log', 'system']
          && request.resource.data.text is string && request.resource.data.text.size() <= 2000
          && (request.resource.data.img == null
              || (request.resource.data.img is string && request.resource.data.img.size() <= 140000));
        allow update: if false;
        allow delete: if signedIn() && pc().ptId == me();
      }
    }

    // Lời mời PT → học viên (email). Học viên chỉ đổi trạng thái của lời mời gửi đúng email của mình.
    match /invites/{iid} {
      allow create: if signedIn() && request.resource.data.ptId == me()
        && request.resource.data.status == 'pending'
        && request.resource.data.email is string && request.resource.data.email.size() >= 5
        && request.resource.data.email == request.resource.data.email.lower()
        && get(/databases/$(database)/documents/clients/$(request.resource.data.clientId)).data.ptId == me();
      allow read: if signedIn() && (resource.data.ptId == me() || (myEmail() != '' && resource.data.email == myEmail()));
      allow update: if signedIn() && (
        (resource.data.ptId == me() && request.resource.data.ptId == me())
        || (myEmail() != '' && resource.data.email == myEmail() && resource.data.status == 'pending'
            && request.resource.data.status in ['accepted', 'declined']
            && request.resource.data.studentUid == me()
            && onlyKeys(['status', 'respondedAt', 'studentUid', 'studentName'])));
      allow delete: if signedIn() && resource.data.ptId == me();
    }

    // Routine cộng đồng: ai cũng đọc được (bảng tin công khai); bộ đếm chỉ đổi ±1 kèm tài liệu đánh dấu của chính người đó
    match /routines/{rid} {
      function dlt(k) { return request.resource.data.get(k, 0) - resource.data.get(k, 0); }
      function mark(kind) { return /databases/$(database)/documents/routines/$(rid)/$(kind)/$(me()); }
      function validR() {
        let r = request.resource.data;
        return r.title is string && r.title.size() >= 4 && r.title.size() <= 80
          && r.get('desc', '').size() <= 1000 && r.days is map && r.authorUid == me();
      }
      allow read: if true;
      allow create: if signedIn() && validR()
        && request.resource.data.likes == 0 && request.resource.data.saves == 0
        && request.resource.data.copies == 0 && request.resource.data.reports == 0
        && request.resource.data.hidden == false
        && !request.resource.data.keys().hasAny(['approved', 'featured', 'moderatedBy', 'moderatedAt', 'modNote']);
      allow delete: if signedIn() && (resource.data.authorUid == me() || hasPerm('community.moderate'));
      allow update: if signedIn() && (
        (resource.data.authorUid == me() && validR()
          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['likes', 'saves', 'copies', 'reports', 'hidden', 'approved', 'authorUid', 'featured', 'featuredBy', 'featuredAt', 'moderatedBy', 'moderatedAt', 'modNote']))
        || (onlyKeys(['likes']) && ((dlt('likes') == 1 && !exists(mark('likes')) && existsAfter(mark('likes')))
                                 || (dlt('likes') == -1 && exists(mark('likes')) && !existsAfter(mark('likes')))))
        || (onlyKeys(['saves']) && ((dlt('saves') == 1 && !exists(mark('saves')) && existsAfter(mark('saves')))
                                 || (dlt('saves') == -1 && exists(mark('saves')) && !existsAfter(mark('saves')))))
        || (onlyKeys(['copies']) && dlt('copies') == 1 && !exists(mark('copies')) && existsAfter(mark('copies')))
        || (onlyKeys(['reports', 'hidden']) && dlt('reports') == 1 && !exists(mark('reports')) && existsAfter(mark('reports'))
            && request.resource.data.hidden == (request.resource.data.reports >= 3))
        // kiểm duyệt viên khôi phục / ẩn: chỉ các trường kiểm duyệt · quản lý nội dung ghim bài
        || (hasPerm('community.moderate') && onlyKeys(['approved', 'hidden', 'reports', 'updatedAt', 'moderatedBy', 'moderatedAt', 'modNote']))
        || (hasPerm('community.feature') && onlyKeys(['featured', 'featuredBy', 'featuredAt']))
      );
      match /likes/{uid}   { allow read: if signedIn(); allow create, delete: if signedIn() && uid == me(); }
      match /saves/{uid}   { allow read, create, delete: if signedIn() && uid == me(); }
      match /copies/{uid}  { allow read, create: if signedIn() && uid == me(); }
      match /reports/{uid} { allow read: if signedIn() && (uid == me() || hasPerm('reports.view'));
        allow create: if signedIn() && uid == me() && request.resource.data.reason is string && request.resource.data.reason.size() <= 200; }
    }

    match /userSocial/{uid} { allow read, write: if signedIn() && uid == me(); }

    // ---------------- Sự kiện · Thi đua · Gian hàng · Quà (cloud-events.js) ----------------
    // admins/{uid} (cơ chế cũ) — KHÔNG còn dùng để cấp quyền: quyền thật nằm ở roles/{uid} + custom claims (functions/admin.js).
    match /admins/{uid} { allow get: if signedIn() && me() == uid; allow list, write: if false; }

    match /challenges/{id} {
      allow read: if signedIn();
      allow write: if hasPerm('challenges.manage');
      match /entries/{uid} {
        allow read: if signedIn();      // bảng xếp hạng
        allow create, update: if signedIn() && me() == uid && request.resource.data.uid == uid
          && request.resource.data.value is number && request.resource.data.value >= 0
          && request.resource.data.value <= get(/databases/$(database)/documents/challenges/$(id)).data.target * 5;
        allow delete: if signedIn() && (me() == uid || hasPerm('challenges.manage'));
      }
    }
    // collectionGroup("entries").where("uid","==",me) — chỉ đọc bản ghi của chính mình
    match /{path=**}/entries/{uid} { allow read: if signedIn() && (resource.data.uid == me() || hasPerm('challenges.manage')); }

    match /events/{id} {
      function freeEvent() { let f = get(/databases/$(database)/documents/events/$(id)).data.get('fee', 0); return f == null || f == 0 || f == ''; }
      // Đăng ký mới (hoặc đăng ký lại sau khi huỷ): đúng chủ, trạng thái 'registered', chỉ sự kiện miễn phí mới tự đặt paid:true
      function validNewReg(uid) {
        let r = request.resource.data;
        return signedIn() && me() == uid && r.uid == uid && r.status == 'registered'
          && !('checkinCode' in r) && !('checkedInAt' in r)
          && (r.get('paid', false) == false || freeEvent());
      }
      allow read: if signedIn();
      allow write: if hasPerm('events.manage');
      match /private/{doc} { allow read: if hasPerm('events.manage') || hasPerm('events.checkin'); allow write: if hasPerm('events.manage'); }
      match /regs/{uid} {
        allow read: if signedIn() && (me() == uid || hasPerm('events.checkin') || hasPerm('events.manage'));
        allow create: if validNewReg(uid);
        allow update: if hasPerm('events.checkin')
          || (resource.data.status == 'cancelled' && validNewReg(uid))
          || (signedIn() && me() == uid && request.resource.data.status == 'cancelled'
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedAt']))
          || (signedIn() && me() == uid && resource.data.status == 'registered' && request.resource.data.status == 'checked_in'
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'checkinCode', 'checkedInAt'])
              && request.resource.data.checkinCode == get(/databases/$(database)/documents/events/$(id)/private/checkin).data.code);
        allow delete: if hasPerm('events.manage');
      }
      match /reviews/{uid} {
        function modKeys() { return ['hidden', 'modOk', 'moderatedBy', 'moderatedAt']; }
        function validRv() {
          return signedIn() && me() == uid && request.resource.data.uid == uid
            && request.resource.data.stars in [1, 2, 3, 4, 5]
            && request.resource.data.get('photos', []).size() <= 3
            && request.resource.data.get('text', '').size() <= 1000
            && get(/databases/$(database)/documents/events/$(id)/regs/$(uid)).data.status == 'checked_in';
        }
        allow read: if signedIn();
        allow create: if validRv() && !request.resource.data.keys().hasAny(modKeys());
        allow update: if (validRv() && !request.resource.data.diff(resource.data).affectedKeys().hasAny(modKeys()))
          || (hasPerm('reviews.moderate') && onlyKeys(modKeys()));      // kiểm duyệt: ẩn / giữ đánh giá
        allow delete: if hasPerm('reviews.moderate') || (signedIn() && me() == uid);
      }
    }
    // collectionGroup("regs").where("uid","==",me)
    match /{path=**}/regs/{uid} { allow read: if signedIn() && (resource.data.uid == me() || hasPerm('events.checkin')); }

    match /products/{id} { allow read: if true; allow write: if hasPerm('shop.products'); }

    // Đơn hàng: giá/tồn kho do client gửi → admin kiểm tra trước khi giao (khuyến nghị Cloud Function tính lại giá).
    match /orders/{id} {
      allow read: if signedIn() && (resource.data.uid == me() || hasPerm('shop.orders') || hasPerm('orders.view'));
      allow create: if signedIn() && request.resource.data.uid == me()
        && request.resource.data.status in ['pending', 'awaiting_payment'] && request.resource.data.total is number
        && request.resource.data.total >= 0;
      // shop.orders: chỉ trạng thái / lịch sử / ghi chú; huỷ đơn đã xác nhận (= hoàn tiền) cần thêm shop.refund
      allow update: if (hasPerm('shop.orders') && onlyKeys(['status', 'history', 'updatedAt', 'note', 'tracking'])
            && !(request.resource.data.status == 'cancelled' && resource.data.status in ['confirmed', 'shipping', 'delivered'] && !hasPerm('shop.refund')))
        || (signedIn() && resource.data.uid == me() && resource.data.status in ['pending', 'awaiting_payment']
            && request.resource.data.status == 'cancelled'
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'history', 'updatedAt']));
      allow delete: if false;
    }

    match /gifts/{id} {
      allow read: if signedIn() && (resource.data.uid == me() || hasPerm('gifts.manage'));
      allow create, delete: if hasPerm('gifts.manage');
      allow update: if hasPerm('gifts.manage')
        || (signedIn() && resource.data.uid == me() && resource.data.status == 'new' && request.resource.data.status == 'confirmed'
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'address', 'size', 'confirmedAt', 'updatedAt']));
    }
  }
}
```

Chỉ mục: truy vấn của bảng quản trị là 1 điều kiện hoặc `orderBy` 1 trường (`admin_audit.ts/seq`, `support_tickets.updatedAt`, `routines.reports > 0`, `reports.status`, `pt_verifications.at`) → chỉ mục đơn tự động. Riêng `adminListUsers` (Admin SDK) lọc PT: `users where isPT == true orderBy createdAt desc` → cần **chỉ mục ghép** `users(isPT ASC, createdAt DESC)` (Firebase báo link tạo ở log lần chạy đầu).

## 5. API

`window.TE_RBAC`: `role()`, `current()`, `active()`, `can(perm)`, `canAny([…])`, `require(perm, onDenied)`, `guard(perm, fn)`, `myPerms()`, `label(perm)`, `roles`, `perms`, `groups`, `matrix`, `order`, `sensitive`, `core` (thuần: `permsOf, hasPerm, assignable, grantable, checkAssign, checkBan, checkTransfer, sha256, canonical, auditHash, verifyChain, mask, maskEmail`), `login(pw)`, `logout()`, `stepUp(pw)`, `needsStepUp(perm)`, `lockedFor()`, `openLogin()`, `onChange(cb)`, `refresh(force)`, `audit(action, target, details)`, `legacyAdmin()`, `roleLabel(r)`.
`window.teCan(perm)` → `TE_RBAC.can(perm)`; `teCan.any([...])`. Module nào gán lại `window.teCan = …` thì bản đó bị giữ ở `teCan._legacy`, còn `teCan` vẫn gọi RBAC. **Không khai báo `const/let teCan`** ở phạm vi toàn cục trong module khác (sẽ che biến của RBAC).
`window.cloudAdmin`: `hasOwner, bootstrapOwner, listUsers, getUser, listStaff, setRole, transferOwnership, ban, unban, listNotes, addNote, requestVerify, myVerify, listPT, verifyPT, setListing, ptStatus(uid) (đồng bộ), report(type, refId, reason, extra), modQueue, moderate(item, action), setFeatured, featuredIds(), openTicket, myTickets, listTickets, replyTicket, broadcast, listBroadcasts, retractBroadcast, activeBroadcasts, getSettings, saveSettings, applySettings, listVouchers, saveVoucher, revokeVoucher, lookupVoucher(code), appendAudit, listAudit, verifyAudit, stats`.
`window.TE_ADMIN`: `open(section)`, `close()`, `render()`, `isOpen()`, `registerSection({ id, title, icon, order, perms:[…], badge, render(el) })`, `addHook("content", fn)`.

Bọc sẵn (không cần sửa module): `cloudEvents.saveChallenge/deleteChallenge` → `challenges.manage`; `saveEvent/deleteEvent` → `events.manage`; `getCheckinCode/listRegs` → `events.manage|events.checkin`; `adminCheckIn` → `events.checkin`; `saveProduct/deleteProduct` → `shop.products`; `allOrders` → `shop.orders|orders.view`; `updateOrder` → `shop.orders` (+ `shop.refund` khi huỷ đơn đã xác nhận); `allGifts/createGift/updateGift` → `gifts.manage` (trừ người dùng tự xác nhận quà, và bản demo tự trao quà cho chính mình khi hết tháng). Mỗi thao tác ghi thành công → 1 bản ghi audit. `cloudEvents.isAdminRemote()` → theo RBAC.

## 6. Thay đổi đề xuất ở module khác (chuyển sang `teCan('…')`)

Các diff dưới **không bắt buộc để chạy** (đã có lớp bọc dữ liệu + `state.isAdmin` tính từ RBAC), nhưng giúp giao diện chỉ hiện đúng nút theo quyền chi tiết. Mẫu an toàn khi module nạp không có rbac.js:
```js
const can = p=> (typeof teCan === "function" ? teCan(p) : false);
```

### 6.1 `events.js`
```diff
-const isAdmin = ()=> !!state.isAdmin;
+const can = p=> (typeof teCan === "function" ? teCan(p) : false);
+const isAdmin = ()=> ["challenges.manage", "events.manage", "events.checkin", "gifts.manage", "shop.products", "shop.orders", "orders.view"].some(can);
@@ mountAdmin(el)
-  const remote = await safe(cloudEvents.isAdminRemote(), false);
+  const remote = isAdmin();
-  box.innerHTML = `<div class="te-admin-head">${icon("te_admin")}<div><b>Chế độ quản trị · nhà sáng lập</b>…
+  box.innerHTML = `<div class="te-admin-head">${icon("te_admin")}<div><b>Công cụ sự kiện · ${esc(TE_RBAC.roleLabel(TE_RBAC.role()))}</b>…
-    <div class="section-title"><h3>Thử thách</h3><button class="btn btn-primary btn-sm" data-te="a-ch-edit" data-id="">…Tạo</button></div>
+    ${can("challenges.manage") ? `<div class="section-title"><h3>Thử thách</h3><button class="btn btn-primary btn-sm" data-te="a-ch-edit" data-id="">…Tạo</button></div> …` : ""}
-    <button … data-te="a-ch-award" …>Chốt &amp; trao quà</button>
+    ${can("challenges.manage") && can("gifts.manage") ? `<button … data-te="a-ch-award" …>Chốt &amp; trao quà</button>` : ""}
-    <div class="section-title"><h3>Sự kiện offline</h3><button … data-te="a-ev-edit" data-id="">…Tạo</button></div>
+    ${can("events.manage") ? `…Tạo / Sửa…` : ""} ${can("events.checkin") ? `…Đăng ký · Quét vé · Mã tại chỗ…` : ""}
-  const gifts = await safe(cloudEvents.allGifts(), []);
+  const gifts = can("gifts.manage") ? await safe(cloudEvents.allGifts(), []) : [];
@@ ADMIN_SECTIONS.map(...)
-  const secs = ADMIN_SECTIONS.map(s=> …
+  const secs = ADMIN_SECTIONS.filter(s=> !s.perm || [].concat(s.perm).some(can)).map(s=> …
@@ profileInject()
-    ${isAdmin() ? `<button class="link-row" data-te="hub" data-id="admin">…Quản trị (nhà sáng lập)…` : ""}
+    ${isAdmin() ? `<button class="link-row" data-te="hub" data-id="admin">…Công cụ sự kiện (quản trị)…` : ""}
@@ ACT
-  "admin-off": ()=>{ state.isAdmin = false; save(); _tab = "challenges"; say("Đã tắt chế độ quản trị", "te_admin"); loadAll(true).then(rerender); },
+  "admin-off": ()=>{ if(window.TE_RBAC) TE_RBAC.logout(); _tab = "challenges"; say("Đã khoá phiên quản trị", "te_admin"); loadAll(true).then(rerender); },
@@ Bật chế độ quản trị: chạm 7 lần — XOÁ (rbac.js thay bằng mở màn đăng nhập quản trị)
-let _taps = 0, _tapT = 0;
-function onVersionTap(e){ … state.isAdmin = !state.isAdmin; … }
-  document.addEventListener("click", onVersionTap, true);
```
Và đổi chú thích đầu file (dòng 8) "state.isAdmin (chạm 7 lần…)" → "quyền theo TE_RBAC (rbac.js)".

### 6.2 `shop.js`
```diff
-const isAdmin = ()=> !!state.isAdmin;
+const can = p=> (typeof teCan === "function" ? teCan(p) : false);
+const isAdmin = ()=> can("shop.products") || can("shop.orders") || can("orders.view");
-const visible = ()=> S.products.filter(p=> !p.hidden || isAdmin());
+const visible = ()=> S.products.filter(p=> !p.hidden || can("shop.products"));
-TapEv.addAdminSection({ id:"products", title:"Sản phẩm", render: async el=>{
+TapEv.addAdminSection({ id:"products", title:"Sản phẩm", perm:"shop.products", render: async el=>{
-TapEv.addAdminSection({ id:"orders", title:"Đơn hàng", render: async el=>{
+TapEv.addAdminSection({ id:"orders", title:"Đơn hàng", perm:["shop.orders", "orders.view"], render: async el=>{
@@ orders render
-      <div class="te-arow-a"><select data-sh-ost=…
+      <div class="te-arow-a">${can("shop.orders") ? `<select data-sh-ost=…>…</select>` : `<span class="pill">${esc(OST[o.status][0])}</span>`}
-    <div class="te-row-btns"><button class="btn btn-outline btn-sm" data-te="sh-a-csv">…Xuất CSV</button></div>
+    ${can("data.export") ? `<div class="te-row-btns"><button class="btn btn-outline btn-sm" data-te="sh-a-csv">…Xuất CSV</button></div>` : ""}
@@ CFG (đọc cài đặt do Chủ sở hữu nhập trong bảng quản trị — cloud-admin.js đã tự vá TapShop.core.CFG lúc chạy; dòng này cho lần vẽ đầu)
-}, G.TAPEASY_SHOP_CONFIG || {});
+}, G.TAPEASY_SHOP_CONFIG || {}, (()=>{ try{ const s = JSON.parse(localStorage.getItem("tapeasy_settings_cache_v1") || "null") || {}; const o = {}; ["shippingFee","freeShipFrom","giftFundPct","hotline"].forEach(k=>{ if(s[k] != null && s[k] !== "") o[k] = s[k]; }); if(s.bank && s.bank.accountNo) o.bank = s.bank; return o; }catch(e){ return {}; } })());
@@ openCart(): ô nhập mã giảm giá toàn hệ thống (mã do quản trị tạo ở Bảng quản trị → Cửa hàng)
       <div class="sh-vpick"><div class="card-title">${icon("te_voucher")}Voucher</div>
+        ${G.cloudAdmin ? `<div class="sh-vcode"><input id="sh-vcode" maxlength="16" placeholder="Nhập mã giảm giá" autocapitalize="characters" aria-label="Mã giảm giá"><button class="btn btn-outline btn-sm" data-te="sh-vcode">Áp dụng</button></div>` : ""}
@@ 8. HÀNH ĐỘNG
+A("sh-vcode", async ()=>{ const code = (q("#sh-vcode") || {}).value || "";
+  const gv = G.cloudAdmin ? await G.cloudAdmin.lookupVoucher(code).catch(()=> null) : null;
+  if(!gv){ say("Mã không hợp lệ hoặc đã hết hạn", "error"); return; }
+  const v = grantVoucher({ kind: gv.kind === "freeship" ? "ship" : gv.kind === "percent" ? "pct" : "amount", value: gv.kind === "freeship" ? 1e9 : gv.value,
+    min: gv.min, max: gv.cap, title: gv.title || ("Mã " + gv.code), src:"admin", ref:"adm_" + gv.code });
+  if(v) _voucherId = v.id; openCart(); });
```
(`addAdminSection` cần thêm 1 dòng ở events.js: `ADMIN_SECTIONS.filter(s=> !s.perm || [].concat(s.perm).some(can))` — đã có trong 6.1.)

### 6.3 `community.js`
```diff
+const can = p=> (typeof teCan === "function" ? teCan(p) : false);
@@ chi tiết routine (cạnh nút Báo cáo)
+  ${can("community.moderate") ? `<button type="button" class="cm-act" data-act="mod-hide">${ic(L.isHidden(r) ? "visibility" : "visibility_off")}<span>${L.isHidden(r) ? "Khôi phục" : "Ẩn (kiểm duyệt)"}</span></button>` : ""}
+  ${can("community.feature") ? `<button type="button" class="cm-act" data-act="feature">${ic("push_pin")}<span>${r.featured ? "Bỏ ghim" : "Ghim"}</span></button>` : ""}
@@ xử lý data-act
+    if(a === "mod-hide") cloudAdmin.moderate({ type:"routine", id, title:r.title }, L.isHidden(r) ? "keep" : "hide", "Từ màn Cộng đồng").then(()=> reload());
+    if(a === "feature") cloudAdmin.setFeatured(id, !r.featured).then(()=> reload());
@@ sortRoutines / bảng tin: routine được ghim lên đầu
+  const pinned = new Set((G.cloudAdmin && cloudAdmin.featuredIds()) || []);
+  list.sort((a,b)=> ((b.featured || pinned.has(b.id)) ? 1 : 0) - ((a.featured || pinned.has(a.id)) ? 1 : 0));
@@ openReport → cũng gửi vào hàng đợi chung để Kiểm duyệt viên thấy lý do
+      try{ if(G.cloudAdmin) cloudAdmin.report("routine", id, reason, { title: r.title }); }catch(e){}
```

### 6.4 `findpt.js` (Tìm PT — module song song; tên hàm minh hoạ)
```diff
+const can = p=> (typeof teCan === "function" ? teCan(p) : false);
+const ptBadge = uid=> (window.cloudAdmin ? cloudAdmin.ptStatus(uid) : { verified:false, listingHidden:false });
@@ lọc danh sách PT
-  const list = allPTs;
+  const list = allPTs.filter(p=> !(p.listingHidden || ptBadge(p.uid).listingHidden) || can("listings.moderate"));
@@ thẻ PT
-  <h3>${esc(p.name)}</h3>
+  <h3>${esc(p.name)} ${(p.ptVerified || ptBadge(p.uid).verified) ? ic("verified", "fp-ver") : ""}</h3>
@@ sắp xếp: PT đã xác minh lên trước khi điểm tương đương
+  score += (p.ptVerified || ptBadge(p.uid).verified) ? 5 : 0;
@@ đánh giá PT: nút kiểm duyệt + báo cáo
+  ${can("reviews.moderate") ? `<button data-fp="rv-hide" data-id="${esc(rv.id)}">Ẩn đánh giá</button>` : ""}
+  <button data-fp="rv-report" data-id="${esc(rv.id)}">Báo cáo</button>   // → cloudAdmin.report("review", rv.id, lý do, { parentId: ptUid })
@@ trang PT (quản trị)
+  ${can("listings.moderate") ? `<button data-fp="hide-listing">Ẩn khỏi Tìm PT</button>` : ""}   // → cloudAdmin.setListing(uid, true, lý do)
```
Firebase: findpt đọc trường `users/{uid}.ptVerified`, `listingHidden` (rules §4 chỉ cho `pt.verify` / `listings.moderate` ghi).

### 6.5 `kb.js` (Kho kiến thức) — **đã tương thích**: kb.js dùng `teCan("kb.edit"/"kb.publish")`, `TE_RBAC.audit/onChange` và xuất `TEKB/TE_KB.adminList/setPublished/open` mà mục "Nội dung" của bảng quản trị tự nhận. Diff dưới chỉ là mẫu tham chiếu nếu viết lại.
```diff
+const can = p=> (typeof teCan === "function" ? teCan(p) : false);
-  ${state.isAdmin ? `<button data-kb="edit">Sửa bài</button>` : ""}
+  ${can("kb.edit") ? `<button data-kb="edit">Sửa bài</button>` : ""}
+  ${can("kb.publish") ? `<button data-kb="publish">${a.status === "published" ? "Gỡ bài" : "Xuất bản"}</button>` : ""}
@@ lưu bài
-  article.status = "published";
+  article.status = can("kb.publish") ? (article.status || "draft") : (article.status === "published" ? "review" : article.status || "draft");
+  try{ TE_RBAC.audit(can("kb.publish") && article.status === "published" ? "kb.publish" : "kb.save", { type:"kb", id: article.id, name: article.title }); }catch(e){}
@@ danh sách: người không có kb.edit chỉ thấy bài published
+  const list = all.filter(a=> a.status === "published" || can("kb.edit"));
@@ API để bảng quản trị hiện danh sách & nút Xuất bản (mục "Nội dung")
+window.TE_KB = Object.assign(window.TE_KB || {}, { open, adminList: ()=> all, setPublished: (id, on)=> savePublished(id, on) });
```

### 6.6 `pt.js` (sheet Xoá tài khoản) — Owner phải chuyển nhượng trước
```diff
   $("#del-go").addEventListener("click", async ()=>{
+    if(window.TE_RBAC && TE_RBAC.role() === "owner"){ $("#del-err").textContent = "Bạn là Chủ sở hữu — chuyển nhượng quyền trong Bảng quản trị trước khi xoá tài khoản."; return; }
     const btn = $("#del-go"); btn.disabled = true; btn.textContent = "Đang xoá...";
```

### 6.7 `cloud-events.js` (tuỳ chọn, cho sạch)
```diff
-    async isAdmin(){ try{ return !!(typeof state !== "undefined" && state.isAdmin); }catch(e){ return false; } },
+    async isAdmin(){ return !!(window.TE_RBAC && TE_RBAC.legacyAdmin()); },
-    async isAdmin(){ try{ const u = cloud.user; if(!u) return false; return (await fs.collection("admins").doc(u.uid).get()).exists; }catch(e){ return false; } },
+    async isAdmin(){ return !!(window.TE_RBAC && TE_RBAC.legacyAdmin()); },     // collection admins/{uid} bỏ — rules dùng hasPerm()
```

## 7. Dữ liệu & di chuyển từ cơ chế cũ

- `state.isAdmin` cũ: `rbac.js` xoá cờ `"isAdmin":true` trong `fitkit_state_v1` **trước khi** `app.js` nạp, rồi biến `state.isAdmin` thành thuộc tính tính toán (không lưu): đọc = có phiên quản trị và có ít nhất 1 quyền sự kiện/cửa hàng; gán `true` = mở màn đăng nhập; gán `false` = khoá phiên.
- `admins/{uid}` (Firebase, events-shop): thay bằng `roles/{uid}` + claims. Người từng ở `admins` → Owner cấp vai trò tương ứng (VD `event_manager`) rồi xoá collection `admins`.
- Bản demo lưu ở `localStorage["tapeasy_admin_demo_v1"]` `{ owner, roles, bans, audit[], settings, broadcasts[], ptVerify, listings, notes, vouchers, tickets[], reports[], featured }` (+ 3 hồ sơ PT mẫu, 2 yêu cầu hỗ trợ mẫu, 1 báo cáo mẫu — gắn nhãn "mẫu"). Phiên quản trị: `sessionStorage["tapeasy_admin_session_v1"]` (đóng tab là hết). Khoá đăng nhập sai: `localStorage["tapeasy_admin_lock_v1"]`. Cài đặt đã áp: `localStorage["tapeasy_settings_cache_v1"]`.
- Phía người dùng (`state.teAdmin.seenBc`): thông báo đã đóng.

## 8. Khi gắn vào `index.html` — cập nhật kiểm thử vòng 2

Đã thử gắn trên **bản sao** của dự án (index.html + 4 thẻ ở §1): `node tests/run.js` → 236 test, chỉ 3 test cũ cần cập nhật (không phải lỗi):

1. `08-integration` — `sw.js` và `scripts/prepare-www.sh` thiếu `admin.css rbac.js cloud-admin.js admin.js` → thêm như §1.
2. `09-integration-r2` "teCan(perm): … không có/lỗi → state.isAdmin" — hợp đồng cũ cho phép *quay về `state.isAdmin`*; với RBAC, `state.isAdmin` không gán tay được nữa (đó chính là mục tiêu). Sửa test:
```diff
-    t.test("teCan(perm): dùng TE_RBAC.can nếu có; không có/lỗi → state.isAdmin", ()=>{
+    t.test("teCan(perm): dùng TE_RBAC.can; state.isAdmin không cấp được quyền", ()=>{
       assert.equal(app.ev(`typeof teCan`), "function");
-      app.run(`delete window.TE_RBAC; state.isAdmin = false;`);
-      assert.equal(app.ev(`teCan("events.manage")`), false);
-      app.run(`state.isAdmin = true;`);
-      assert.equal(app.ev(`teCan("events.manage")`), true);
+      app.run(`window.__rb = window.TE_RBAC; state.isAdmin = true;`);
+      assert.equal(app.ev(`teCan("events.manage")`), false, "gán state.isAdmin không cấp quyền");
       app.run(`window.TE_RBAC = { can: p=> p === "shop.orders" };`);
       assert.equal(app.ev(`teCan("shop.orders")`), true);
-      assert.equal(app.ev(`teCan("events.manage")`), false, "có RBAC → không dùng state.isAdmin");
+      assert.equal(app.ev(`teCan("events.manage")`), false);
       app.run(`window.TE_RBAC = { can(){ throw new Error("x"); } };`);
-      assert.equal(app.ev(`teCan("events.manage")`), true, "RBAC lỗi → quay về state.isAdmin");
-      app.run(`delete window.TE_RBAC; state.isAdmin = false;`);
+      assert.equal(app.ev(`teCan("events.manage")`), false, "RBAC lỗi → lõi rbac.js, không quay về cờ cục bộ");
+      app.run(`window.TE_RBAC = window.__rb;`);
     });
```
3. Khi **áp rules §4** vào `firestore.rules`, các khẳng định của `09-integration-r2` về `isAdmin()` đổi theo:
```diff
-      assert.deepEqual(pub, ["allow read: if true;", "match /products/{id} { allow read: if true; allow write: if isAdmin(); }"],
+      assert.deepEqual(pub, ["allow read: if true;", "match /products/{id} { allow read: if true; allow write: if hasPerm('shop.products'); }"],
-      assert.match(nc, /match \/admins\/\{uid\} \{ allow get: … \}/);          (giữ nguyên — dòng admins không đổi)
-      assert.match(rt, /isAdmin\(\) && onlyKeys\(\['approved', 'hidden', 'reports', 'updatedAt'\]\)/);
+      assert.match(rt, /hasPerm\('community\.moderate'\) && onlyKeys\(\['approved', 'hidden', 'reports', 'updatedAt', 'moderatedBy', 'moderatedAt', 'modNote'\]\)/);
-      assert.match(nc, /match \/\{path=\*\*\}\/entries\/\{uid\} \{ allow read: if signedIn\(\) && \(resource\.data\.uid == me\(\) \|\| isAdmin\(\)\); \}/);
+      assert.match(nc, /match \/\{path=\*\*\}\/entries\/\{uid\} \{ allow read: if signedIn\(\) && \(resource\.data\.uid == me\(\) \|\| hasPerm\('challenges\.manage'\)\); \}/);
```
(Các bất biến BUG-03 — `users` get/list, chỉ routines + products đọc công khai — rules §4 **giữ nguyên**, test 30-rbac kiểm lại.)

## 9. Kiểm thử đã chạy

```bash
cd FitKit
for f in rbac.js cloud-admin.js admin.js functions/admin.js; do node -e "new Function(require('fs').readFileSync('$f','utf8'))"; done
node tests/run.js --only rbac          # 27/27 — danh sách ở docs/RBAC.md §11 (vét cạn 31 944 tổ hợp gán vai trò, Functions với Admin SDK giả lập, rules khớp ma trận)
node tests/run.js                      # 237/237 — không ảnh hưởng suite cũ (module chưa gắn index.html)
# Bản sao dự án có gắn 4 thẻ §1: 236 test, 233 pass — 3 test cũ cần cập nhật như §8 (không phải lỗi)
python3 ../_test/admin-kit/build.py    # → _test/admin-flow.html (index.html + rbac/cloud-admin/admin + kịch bản t_flow.js)
```
Trình duyệt thật (Chromium qua Playwright, **ngữ cảnh riêng `tapeasy-admin`**, phục vụ file qua `route.fulfill` vì `file:` bị chặn, 1280×800 và 390×844): **29/29, 0 lỗi JS** — 7 lần chạm → màn đăng nhập quản trị; sai mã khởi tạo bị từ chối; khởi tạo Owner bằng giao diện; 12 mục; danh sách 9 tài khoản, tên `<img onerror>` được escape, tìm kiếm; gán vai trò qua hộp thoại (9 lựa chọn, kiểm tra trực tiếp); ma trận 36 × 10; hồ sơ PT chờ duyệt; hàng đợi kiểm duyệt; lưu phí ship → gian hàng dùng ngay; xem trước + gửi thông báo; nhật ký toàn vẹn; khoá phiên; người dùng thường thấy thông báo ở Trang chủ; Phân tích chỉ 4 mục, đơn hàng chỉ đọc; thẻ "Bảng quản trị" ở Hồ sơ.
Ảnh: `_test/shots/adm-d-overview.png`, `adm-d-user-role.png`, `adm-d-team.png`, `adm-d-audit.png`, `adm-d-settings.png` (máy tính) · `adm-m-overview.png`, `adm-m-drawer.png`, `adm-m-users.png`, `adm-m-login.png`, `adm-m-profile.png` (điện thoại).

## 10. Giới hạn / việc còn lại

- **Bản demo không an toàn thật**: vai trò, khoá, audit nằm trong `localStorage` của máy — ai mở DevTools sửa được (chuỗi băm chỉ giúp *phát hiện* sửa vụng). Bảo mật thật cần Firebase: claims do `setRole` cấp + rules §4 + `chainAudit`.
- Firebase engine của `cloud-admin.js` và `functions/admin.js` đã kiểm bằng Admin SDK giả lập trong Node; **chưa chạy trên Firebase Emulator / dự án thật** — chạy `firebase emulators:start --only functions,firestore,auth` và thử rules (đặc biệt `hasPerm`, `staffFresh`, `admin_audit` create) trước khi publish.
- `adminGetUser` / `adminListUsers` dùng quyền IAM mặc định của Functions (Admin SDK). `adminListUsers` trả tối đa 300–500 hồ sơ mới nhất và lọc chữ trên tập đó — app lớn hơn nên thêm tìm kiếm phía máy chủ (chỉ mục tên / Algolia) và phân trang.
- Voucher toàn hệ thống: shop.js cần diff §6.2 để khách nhập được mã; `used` chưa tăng ở máy chủ (nên làm trong Function tạo đơn).
- Thông báo đẩy FCM cần app native đăng ký topic; bản web chỉ hiện thẻ trên Trang chủ.
- `users.delete` (xoá tài khoản theo yêu cầu) mới có trong ma trận; luồng xoá hộ người dùng nên làm bằng callable riêng gọi `admin.auth().deleteUser` (trigger `cleanupDeletedUser` sẵn có sẽ dọn dữ liệu).
- Module `findpt.js`, `kb.js` đang được viết song song — diff §6.4–6.5 viết theo API dự kiến; bảng quản trị tự nhận `window.TE_KB` (`adminList`, `setPublished`, `open`) nếu có.

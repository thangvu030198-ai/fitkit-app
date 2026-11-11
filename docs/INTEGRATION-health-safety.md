# INTEGRATION — Sức khoẻ & an toàn + Thu hồi token Apple

Gồm 3 phần:

| Phần | File | Trạng thái |
|---|---|---|
| A. Module sàng lọc sức khoẻ | `health-safety.js`, `health-safety.css` | Mới — chỉ cần thêm thẻ vào `index.html` |
| B. Cloud Functions | `functions/index.js`, `functions/apple.js`, `functions/package.json`, `functions/.env.example`, `firebase.json` | Mới — cần deploy (gói Blaze) |
| C. Sửa client để gọi B | `cloud.js`, `delete-account.html` | **Chưa sửa** — làm theo diff ở mục C |

`privacy-policy.html` đã được cập nhật (mục dữ liệu sức khoẻ, đăng nhập Google/Facebook/Apple, nhà cung cấp nội dung, quyền xoá, trẻ em, liên hệ, ngày hiệu lực). **Chủ app phải điền** `[ĐIỀN EMAIL HỖ TRỢ]` (2 chỗ) và `[ĐIỀN TÊN NHÀ PHÁT TRIỂN]`.

---

## A. Module `health-safety`

### A1. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="style.css">
+  <link rel="stylesheet" href="health-safety.css">
 ...
   <script src="pt.js"></script>
+  <!-- các module khác của đội (nếu có) -->
+  <script src="health-safety.js"></script>   <!-- NÊN ĐỂ CUỐI CÙNG: lớp an toàn bọc mọi hàm render/startSession -->
 </body>
```

Để cuối cùng vì module bọc (wrap) `recomputeProfile`, `renderWorkoutScreen`, `startSession`… Nếu một module nạp SAU mà ghi đè hẳn các hàm này (không gọi lại hàm cũ) thì cờ an toàn sẽ mất.

### A2. Đóng gói & offline

```diff
 # scripts/prepare-www.sh
-cp index.html style.css ... pt.js privacy-policy.html delete-account.html www/
+cp index.html style.css ... pt.js health-safety.js health-safety.css privacy-policy.html delete-account.html www/
```

```diff
 // sw.js
-const CACHE = "fitkit-v3";
+const CACHE = "fitkit-v4";
-const ASSETS = [ ..., "./pt.js", "./manifest.json"];
+const ASSETS = [ ..., "./pt.js", "./health-safety.js", "./health-safety.css", "./manifest.json"];
```

### A3. Tính năng

- **Sàng lọc (lớp phủ 5 bước)**: giới thiệu + miễn trừ y tế (bắt buộc tick xác nhận) → PAR-Q+ rút gọn 7 câu → thai kỳ/sau sinh/cho con bú (chỉ hiện với nữ), tiểu đường (+ thuốc dễ hạ đường huyết), tim mạch & huyết áp, bệnh thận → tiền sử rối loạn ăn uống, chấn thương (7 vùng + ghi chú), tuổi < 18 (lấy từ hồ sơ) → kết quả.
  - **Onboarding lần đầu**: bọc `finishOnboarding` → sàng lọc hiện TRƯỚC khi hoàn tất (để `recomputeProfile` dùng ngay cờ sức khoẻ).
  - **Người dùng cũ / PT bỏ qua onboarding**: bọc `finishBoot` → tự hỏi 1 lần khi vào app.
  - "Để sau" được phép (Apple 5.1.1(ii): không ép nhập dữ liệu không cần thiết) → nhắc ở Trang chủ (ẩn 7 ngày được) và Hồ sơ.
- **Dinh dưỡng (bọc `recomputeProfile`)** — chỉ khi `autoTargets` bật; mục tiêu tự chỉnh thì chỉ cảnh báo + nút "Dùng mức an toàn":
  - Không thâm hụt calo khi mang thai / cho con bú / < 18 tuổi / tiền sử RLĂU.
  - Mang thai: TDEE + 0/340/452 kcal (tam cá nguyệt 1/2/3); cho con bú: TDEE + 330 kcal (IOM 2005). Không "bulk" thêm.
  - Đạm: thai kỳ 1,2 (T1) / 1,5 g/kg (T2–T3); cho bú 1,3; < 18 tuổi ≤ 1,6; bệnh thận mạn ≤ 0,8; lọc máu ≤ 1,2 g/kg (KDOQI 2020/KDIGO 2024). Chất béo giữ 25 %, carb bù phần còn lại.
  - Màn Dinh dưỡng: banner giải thích + ẩn nút gợi ý chuyển sang "Giảm mỡ" khi không được thâm hụt; cảnh báo thực đơn chưa tính kali/phốt pho/natri/nước (bệnh thận), chưa thiết kế cho tiểu đường; an toàn thực phẩm & caffeine khi mang thai.
- **Tập luyện**:
  - Bệnh tim, huyết áp chưa kiểm soát, đau ngực/ngất (PAR-Q), cần giám sát y tế, biến chứng thai kỳ → **ẩn buổi "Rất cao"** (khoá nút Bắt đầu, `startSession` mở sheet giải thích) và **bỏ bài rất cao** (HIIT, burpee, nhảy dây, sled push, wall ball, mountain climber, chạy interval…) khi bắt đầu buổi. Nút "Bác sĩ đã cho phép" để mở lại (bật/tắt trong Hồ sơ).
  - Gắn cờ (chip trên danh sách bài, giáo án, giáo án mẫu; ghi chú trong chi tiết bài và màn đang tập): nằm ngửa / nằm sấp từ tam cá nguyệt 2, bật nhảy khi mang thai / < 12 tuần sau sinh, gập bụng mạnh (tách cơ bụng), tạ nặng ≤ 6 lần → không nín thở (tim mạch, thai kỳ, tiểu đường, lọc máu), vùng chấn thương, < 18 tuổi + tạ nặng.
  - Nhắc "Kiểm tra nhanh trước khi tập" 1 lần/ngày khi có tim mạch, tiểu đường nguy cơ hạ đường huyết, thai kỳ/sau sinh, bệnh thận, triệu chứng.
- **Hồ sơ → thẻ "Sức khoẻ & an toàn"**: tóm tắt tình trạng, các điều chỉnh đang áp dụng, "Nên hỏi bác sĩ", Lưu ý khi tập, Cập nhật, Miễn trừ trách nhiệm y tế, Xoá dữ liệu sức khoẻ. Nhắc cập nhật khi sàng lọc > 12 tháng, mang thai > 12 tuần, sau sinh sớm > 6 tuần.
- **Chính sách bảo mật trong app** (bọc `openPrivacySheet`): thêm đoạn dữ liệu sức khoẻ + link "Đọc chính sách đầy đủ" (mở bằng `@capacitor/browser` trên app) + "Miễn trừ trách nhiệm y tế".
- Nút Back Android (bọc `fkHandleBack`): lùi bước sàng lọc.

### A4. Dữ liệu — `state.health` (chỉ localStorage, không đồng bộ lên Firestore)

```js
state.health = {
  v: 1, completedAt, skippedAt, ack,                 // ms
  parq: { heart, chestPain, dizzy, chronic, meds, joint, supervised },   // boolean
  pregnancy: "none"|"pregnant"|"postpartum", trimester: 1|2|3, pregComplication,
  postpartumWeeks: "lt6"|"6to12"|"gt12", cesarean, breastfeeding,
  diabetes: "none"|"pre"|"type2"|"type1", hypoRisk,
  cardio: "none"|"htn_ok"|"htn_bad"|"heart", kidney: "none"|"ckd"|"dialysis",
  edHistory: "no"|"yes"|"skip", injuries: ["shoulder","lowback","knee","wrist","hip","ankle","neck"], injuryNote,
  clearedVigorous, lastPreCheck: "YYYY-MM-DD", homeHideUntil
}
state.profile.hsAdjust = { from, to, ppk, reasons[] } | { manual:true, warn[] } | null
```

API cho module khác: `window.FKHealth.current()` (cờ hiện tại), `FKHealth.itemTags(item, intensity)`, `FKHealth.notesFor(tags, flags)`, `FKHealth.openScreening({mode})`, `FKHealth.openTipsSheet()`, `FKHealth.openDisclaimer()`, `window.openHealthSafety()`. Gợi ý cho agent "AI soạn giáo án"/"Training Pro": gọi `FKHealth.current()` để không sinh buổi "Rất cao" khi `hideNow === true`.

### A5. Cách thử

1. Cú pháp: `node -e "new Function(require('fs').readFileSync('health-safety.js','utf8'))"`.
2. Logic thuần (45 kiểm tra: calo/đạm theo thai kỳ, cho bú, < 18, RLĂU, thận, mục tiêu tự chỉnh; cờ tim mạch/tiểu đường; phân loại 28+ bài; ghi chú theo cờ) — đã chạy, đều OK.
3. Giao diện: 8 kịch bản HTML (`_test/health-safety-*.html`, ghép index.html + module + script test) chạy trong Chromium, 31 kiểm tra đều OK: tự mở sàng lọc, chặn khi thiếu câu trả lời, kết quả, thẻ Hồ sơ, khoá buổi "Rất cao" với bệnh tim, nhắc kiểm tra trước buổi + ghi chú trong màn đang tập, banner Dinh dưỡng, onboarding 16 tuổi, giáo án mẫu Hyrox.
4. Thử tay: Hồ sơ → Sức khoẻ & an toàn → Cập nhật → chọn "Bệnh tim" → tab Tập luyện → chọn ngày có buổi "Rất cao" (giáo án Đốt mỡ: Thứ 3).

### A6. Giới hạn

- Phân loại bài theo **từ khoá** (id + tên Việt/Anh + nhóm cơ + dụng cụ). Bài tự tạo / bài từ thư viện 800+ có tên lạ có thể không được gắn cờ.
- Buổi tập do **PT giao** (coach.js) chưa gắn cờ — dữ liệu sức khoẻ cố ý không chia sẻ cho PT.
- Calo thai kỳ tính trên cân nặng hiện tại (Mifflin không hiệu chỉnh cho thai kỳ) — đã ghi rõ là ước lượng, khuyên theo dõi cùng bác sĩ sản khoa.
- Không dùng HealthKit / Health Connect.
- PAR-Q+ được diễn đạt lại (rút gọn) và trích nguồn; nếu muốn dùng nguyên văn bảng PAR-Q+ đầy đủ, kiểm tra điều khoản sử dụng tại eparmedx.com.

---

## B. Cloud Functions — thu hồi token Apple + dọn dữ liệu

### B1. Có gì

| Function | Loại | Việc |
|---|---|---|
| `revokeAppleToken` | Callable 2nd gen, `asia-southeast1` | Nhận `{ authorizationCode? , accessToken?, refreshToken?, platform }`. Kiểm tra: đã đăng nhập, đăng nhập lại trong 15 phút gần nhất, user có provider `apple.com`. Tạo **client secret JWT ES256** (`iss`=Team ID, `kid`=Key ID, `sub`=client_id, `aud`=`https://appleid.apple.com`, sống 5 phút) bằng khoá `.p8` lấy từ **Secret Manager**. iOS: đổi `authorizationCode` tại `/auth/token` → `refresh_token` (đối chiếu `sub` trong `id_token` với Apple ID của user) → `/auth/revoke`. Web/Android: thu hồi `access_token`. Sai client_id (Bundle ID ↔ Services ID) thì tự thử cái còn lại. |
| `cleanupDeletedUser` | Auth `onDelete` 1st gen (2nd gen chưa có trigger này), `asia-southeast1` | Khi user Auth bị xoá theo **bất kỳ đường nào**: xoá form do PT tạo (`recursiveDelete` kèm `sessions`, `notes`), mã mời (kể cả mồ côi), gỡ liên kết học viên + xoá ghi chú người đó viết, xoá `users/{uid}`. Idempotent. Thêm tên collection vào `USER_DOC_COLLECTIONS` nếu module khác lưu doc theo uid. |

Không cần sửa `firestore.rules` (Admin SDK bỏ qua rules).

### B2. Runtime: Node **22** (không phải 20)

Theo bảng Runtime support của Google Cloud (cập nhật 02/11/2026): **Node.js 20 đã bị ngừng (decommission) từ 30/10/2026** — không thể tạo/cập nhật function Node 20 nữa. Node 22 là bản mới nhất còn hỗ trợ **cả 1st gen** (bắt buộc cho trigger `auth.user().onDelete`) lẫn 2nd gen; ngừng ngày 31/10/2027 (deprecation 30/04/2027). Code không dùng gì riêng của Node 22 — chạy được trên Node 20 (emulator) nếu cần. `functions/package.json` → `"engines": { "node": "22" }`, `firebase.json` → `"runtime": "nodejs22"`.

### B3. Deploy (khoảng 20 phút)

1. **Firebase Console → nâng lên gói Blaze** (Cloud Functions + Secret Manager bắt buộc Blaze; lượng dùng của FIT KIT gần như 0 đ). Nên đặt **Budget alert** 1–2 USD trong Google Cloud Billing.
2. Máy tính có Node 22: `npm i -g firebase-tools` → `firebase login`.
3. Trong thư mục `FitKit/`: `firebase use --add` → chọn project.
4. Apple Developer: dùng **cùng Key `.p8`** đã khai báo ở Firebase → Authentication → Apple (Key có bật *Sign in with Apple*, Primary App ID `vn.thangvu.fitkit`). Ghi lại **Team ID** (Membership) và **Key ID**.
5. Cấu hình:
   ```bash
   cd functions
   npm install
   cp .env.example .env          # điền APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_BUNDLE_ID, APPLE_SERVICES_ID
   cd ..
   firebase functions:secrets:set APPLE_PRIVATE_KEY --data-file ./AuthKey_XXXXXXXXXX.p8
   #   (CLI cũ không có --data-file: chạy lệnh không có cờ rồi dán toàn bộ nội dung file .p8)
   ```
   `functions/.env` không chứa bí mật nhưng vẫn **không** commit nếu repo công khai (thêm vào `.gitignore`). **Tuyệt đối không** commit file `.p8`.
6. `firebase deploy --only functions` — lần đầu CLI sẽ bật các API (Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Eventarc, Secret Manager) và hỏi quyền truy cập secret → chọn Yes.
7. Kiểm tra: Firebase Console → Functions có `revokeAppleToken` (v2) và `cleanupDeletedUser` (v1) ở `asia-southeast1`. Log: `firebase functions:log --only revokeAppleToken`.
8. Sau khi đổi Key Apple: `firebase functions:secrets:set APPLE_PRIVATE_KEY ...` rồi deploy lại.

**Thử dọn dữ liệu bằng emulator**: `cd functions && npm run serve` → Auth emulator tạo user, Firestore emulator thêm `users/{uid}`, `clients/{id}` với `ptId=uid` → xoá user → doc biến mất.
**Thử thu hồi Apple thật** (không làm được trong emulator): bản TestFlight → Đăng nhập với Apple → Xoá tài khoản → log có "Đã thu hồi token Apple" và FIT KIT biến khỏi *Cài đặt → [tên] → Đăng nhập bằng Apple*.

Đã kiểm thử bằng Node với stub firebase-functions/admin + khoá P-256 thật + endpoint Apple giả (23 kiểm tra): JWT đúng header/payload, chữ ký ES256 64 byte xác minh được bằng public key, chấp nhận khoá dán 1 dòng, luồng iOS code→refresh_token→revoke, luồng web access_token, tự thử client_id còn lại, chặn mã của Apple ID khác, chặn khi chưa đăng nhập/đăng nhập cũ/thiếu tham số, bỏ qua user Google, dọn đúng dữ liệu PT/học viên và chạy lại không lỗi.

Phương án thay thế (không cần function): Firebase iOS SDK có `Auth.auth().revokeToken(withAuthorizationCode:)` và plugin `@capacitor-firebase/authentication` ≥ 6.1 có `revokeAccessToken({ token })` — cả hai yêu cầu cấu hình "OAuth code flow" (Services ID + Key) cho Apple trong Firebase Console. Function ở trên vẫn nên giữ vì nó cũng phục vụ trang `delete-account.html` và dùng chung cho web/Android.

---

## C. Thay đổi cần làm ở file khác (chưa sửa — áp dụng thủ công)

### C1. `cloud.js` — gọi `revokeAppleToken` trong `deleteAccount`

```diff
   function isNative(){ return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
   function nativeAuthPlugin(){ return isNative() && window.Capacitor.Plugins ? Capacitor.Plugins.FirebaseAuthentication : null; }
+  /* Thông tin Apple của lần xác thực gần nhất → thu hồi token khi xoá tài khoản (App Store 5.1.1(v)) */
+  let lastAppleGrant = null;
   async function socialCredentialSignIn(kind, reauthUser){
     if(isNative()){
       const P = nativeAuthPlugin();
       if(!P) throw dErr("social/not-configured");
       const res = kind==="google" ? await P.signInWithGoogle() : kind==="apple" ? await P.signInWithApple() : await P.signInWithFacebook();
       const c = res && res.credential || {};
+      // iOS: plugin trả authorizationCode (dùng 1 lần, hết hạn 5 phút) — Firebase chỉ dùng idToken+nonce nên mã vẫn còn hiệu lực
+      if(kind==="apple") lastAppleGrant = { authorizationCode: c.authorizationCode || null, accessToken: c.accessToken || null, platform: Capacitor.getPlatform() };
       const credential = kind==="google"
 ...
     provider.addScope("email"); if(kind==="apple") provider.addScope("name");
     if(kind==="google") provider.setCustomParameters({ prompt:"select_account" });
-    if(reauthUser) return reauthUser.reauthenticateWithPopup(provider);
+    if(reauthUser){
+      const r = await reauthUser.reauthenticateWithPopup(provider);
+      if(kind==="apple") lastAppleGrant = { accessToken: (r && r.credential && r.credential.accessToken) || null, platform: "web" };
+      return r;
+    }
     try{ return await fb.auth.signInWithPopup(provider); }
 ...
+  /* Gọi Cloud Function thu hồi token Apple — lỗi KHÔNG chặn việc xoá tài khoản */
+  async function revokeAppleIfNeeded(){
+    const g = lastAppleGrant; lastAppleGrant = null;
+    if(!g || !(g.authorizationCode || g.accessToken)){ console.warn("Không có mã Apple để thu hồi token"); return false; }
+    try{
+      if(!firebase.functions) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-functions-compat.js`);
+      const res = await firebase.app().functions("asia-southeast1").httpsCallable("revokeAppleToken")(g);
+      return !!(res && res.data && res.data.revoked);
+    }catch(e){ console.warn("Thu hồi token Apple thất bại:", e); return false; }
+  }
+
   const firebaseEngine = {
 ...
     async deleteAccount(pw){
       const u = fb.auth.currentUser;
       const pid = (u.providerData[0] && u.providerData[0].providerId) || "password";
       if(pid === "password") await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw));
       else await socialCredentialSignIn(pid.startsWith("facebook") ? "facebook" : pid.startsWith("apple") ? "apple" : "google", u);   // xác thực lại bằng Google/Facebook
+      // Apple 5.1.1(v): thu hồi token Sign in with Apple TRƯỚC khi xoá user (callable cần user còn đăng nhập)
+      if(pid.startsWith("apple")) await revokeAppleIfNeeded();
       for(const c of await firebaseEngine.listClientsAsPT(u.uid)) await firebaseEngine.deleteClient(c.id);
```

Gợi ý thêm (không bắt buộc) trong `pt.js` → `openDeleteAccountSheet`: với tài khoản Apple, thêm dòng "FIT KIT cũng sẽ thu hồi quyền Đăng nhập với Apple".

### C2. `delete-account.html` — trang xoá trên web

```diff
-    await Promise.all([load(`${base}/firebase-auth-compat.js`), load(`${base}/firebase-firestore-compat.js`)]);
+    await Promise.all([load(`${base}/firebase-auth-compat.js`), load(`${base}/firebase-firestore-compat.js`), load(`${base}/firebase-functions-compat.js`)]);
 ...
-  async function wipe(u){
+  async function wipe(u, cred){
     if(!confirm("Xoá vĩnh viễn tài khoản " + (u.email||"") + "? Không thể hoàn tác.")) return;
+    // Apple 5.1.1(v): thu hồi token trước khi xoá user
+    const at = cred && cred.credential && cred.credential.accessToken;
+    if(at && u.providerData.some(p=> p.providerId==="apple.com")){
+      try{ await firebase.app().functions("asia-southeast1").httpsCallable("revokeAppleToken")({ accessToken: at, platform: "web" }); }
+      catch(e){ console.warn("Thu hồi token Apple thất bại:", e); }
+    }
     const asPT = await db.collection("clients").where("ptId","==",u.uid).get();
 ...
-    try{ const c = await auth.signInWithPopup(mk()); await wipe(c.user); }
+    try{ const c = await auth.signInWithPopup(mk()); await wipe(c.user, c); }
```

Khi `cleanupDeletedUser` đã chạy, phần xoá Firestore ở client (cloud.js và delete-account.html) vẫn nên giữ — hoạt động cả khi chưa nâng Blaze; function chỉ dọn phần còn sót.

### C3. `.gitignore` (gốc repo)

```diff
+functions/node_modules/
+functions/.env
+*.p8
```

---

## D. Việc còn lại cho chủ app

1. Thêm thẻ `<link>`/`<script>` (A1), cập nhật `prepare-www.sh` + `sw.js` (A2).
2. Nâng Blaze, deploy functions (B3), áp diff C1–C3.
3. Điền email hỗ trợ + tên nhà phát triển trong `privacy-policy.html`.
4. Xem `docs/STORE-COMPLIANCE.md` — có các mục **chặn nộp** (target API 36 cho Google Play, quyền đọc `users/{uid}` lộ email…).

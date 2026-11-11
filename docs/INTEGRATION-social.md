# Tích hợp TapEasy PT Connect + Cộng đồng

3 module mới (chỉ tạo file mới, không sửa file cũ):

| File | Vai trò |
|---|---|
| `cloud-social.js` | Lớp dữ liệu: mở rộng `cloud` bằng `cloud.social` (2 động cơ: **demo** = localStorage key `tapeasy_social_demo_v1`; **firebase** = `firebase.firestore()` khi `cloud.mode==="firebase"`). Lời mời, chat, đồng bộ nhật ký, PT log thay, routine công khai, kiểm duyệt. |
| `pt-connect.js` + `pt-connect.css` | Giao diện PT ↔ học viên: hộp thư lời mời, "tab PT" của học viên (Lịch · Chương trình · Chat · Tiến độ), mời học viên bằng email / mã / QR, chat realtime, **Tập cùng — log thay**, bảng tiến độ đồng bộ, huy hiệu số chưa đọc trên nav PT. |
| `community.js` + `community.css` | Màn **Cộng đồng**: bảng tin routine, tìm/lọc, chi tiết (tuần · bài · video), sao chép vào tuần tập, chia sẻ routine, hồ sơ người đăng, thích/lưu, báo cáo; 21 routine mẫu của "TapEasy Team". |
| `tests/suites/20-social.test.js` | 17 kiểm thử Node (động cơ demo + app thật). |
| `_test/social-kit/` | Harness giao diện: `run_dom.js` (DOM phân tích HTML trong Node), `build.py` (ghép 1 file HTML chạy trong trình duyệt), `fb_mock_test.js` (động cơ Firebase trên Firestore giả lập). |

## 1. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="pt-pro.css">
+  <link rel="stylesheet" href="pt-connect.css">
+  <link rel="stylesheet" href="community.css">
   <link rel="stylesheet" href="achievements.css">
 ...
   <script src="pt-pro.js"></script>
+  <script src="cloud-social.js"></script>   <!-- trước 2 module dưới -->
+  <script src="pt-connect.js"></script>
+  <script src="community.js"></script>
   <script src="achievements.js"></script>
   <script src="health-safety.js"></script>   <!-- vẫn LUÔN CUỐI -->
```

- Thứ tự bắt buộc: `cloud-social.js` → `pt-connect.js` → `community.js`, **sau `pt-pro.js`** (pt-connect bọc `renderClientForm` bên ngoài lớp của pt-pro; tab riêng của pt-pro vẫn chạy bình thường). Đã chạy thử cùng achievements / health-safety / training-pro / program-builder nạp sau.
- CSS đặt sau `style.css`/`themes.css`; dùng token `--mint`, `--coral`, `--navy`, `--*-rgb`, `--fk-*`, `--glass` (có giá trị dự phòng). Nếu dùng `scripts/gen_themes_layer.py --modules`, thêm 2 file CSS này vào danh sách.
- Logo: dùng `assets/brand/logo-mark.svg` nếu có; chưa có thì tự vẽ logo dự phòng (chữ T gradient mint→coral). Không cần sửa gì khi thêm file logo.
- Đóng gói: thêm 5 file vào `scripts/prepare-www.sh` và `sw.js`:

```diff
-cp ... pt-pro.js pt-pro.css ... www/
+cp ... pt-pro.js pt-pro.css cloud-social.js pt-connect.js pt-connect.css community.js community.css ... www/
```
```diff
-const ASSETS = [ ..., "./pt-pro.js", "./pt-pro.css", ...];
+const ASSETS = [ ..., "./pt-pro.js", "./pt-pro.css", "./cloud-social.js", "./pt-connect.js", "./pt-connect.css", "./community.js", "./community.css", ...];
```
(Tăng `CACHE` trong `sw.js` lên 1 bậc.)

- Link mời trong QR: mặc định `location.origin + đường dẫn hiện tại` (bản web) hoặc `https://thangvu030198-ai.github.io/fitkit-app/` (bản app). Đổi bằng `window.TAPEASY_JOIN_URL = "https://…/"` đặt trước module. App mở với `?join=MÃ` → tự hiện sheet xem trước PT (chưa đăng nhập thì giữ mã, mở sau khi đăng nhập). Deep link trong app native (Capacitor App Links) chưa cấu hình.

## 2. Điểm vào & ghi đè (luôn gọi lại hàm cũ, bọc try/catch)

| Hàm / DOM | Module | Thêm gì |
|---|---|---|
| `renderCoachScreen` | pt-connect | Học viên: **Hộp thư lời mời** + **tab PT** (hero PT, 4 tab). PT: nút **Mời học viên · email / mã / QR** + thẻ "Lời mời đã gửi". |
| `CF_TABS` + `renderClientForm` | pt-connect | Tab **Chat** (sau "Buổi này tập gì") và **Nhật ký tập** (sau "Tiến độ"). Tab "Buổi này tập gì": PT có nút **Tập cùng — log thay**; học viên có **Bắt đầu tập & ghi kg × lần**; thẻ kết quả buổi (PT ghi thay / học viên ghi). Tab "Thông tin" (chưa kết nối): nút mời. |
| `openJoinSheet`, `showInviteSheet`, `inviteText` | pt-connect | Thay bằng sheet mới: xem trước PT → Chấp nhận / Từ chối; mã + **QR** + email; lời mời kèm link `?join=`. |
| `clientRowHTML` | pt-connect | Hàng học viên: số tin chưa đọc, "Tập gần nhất: …" (từ dữ liệu đồng bộ). |
| `updateCoachBadge` | pt-connect | Huy hiệu **số** (tin chưa đọc + lời mời) trên nút PT ở thanh dưới. |
| `refreshCoachData` | pt-connect | Sau khi tải: lời mời, áp buổi PT "log thay" vào nhật ký học viên, đồng bộ nhật ký. |
| `finishSession`, `updateFinishedDates` | pt-connect | Buổi PT giao tập trong app → gửi kết quả (kg × lần) về PT; ngày có buổi PT luôn tính là đã tập (chuỗi ngày). |
| `goto`, `fkHandleBack` | community (+pt-connect dừng nghe chat khi rời màn) | Màn mới `#screen-community` (tự chèn vào `#app-scroll`, thêm vào `SUB_SCREENS`), nút back về màn trước. |
| `renderHomeScreen` | community | Thẻ **Cộng đồng TapEasy** (3 routine thịnh hành) sau hàng lối tắt. |
| `openTemplateBrowser` | community | Nút **Routine từ cộng đồng** đầu màn Giáo án mẫu. |
| Menu ☰ | community | Mục **Cộng đồng** ngay sau "PT & Học viên" (bắt sự kiện click trên `.btn-menu-trigger`). |
| `FK_LINE` | cả hai | Icon mới nếu chưa có: forum, qr_code_2, qr_code_scanner, inbox, done_all, favorite, bookmark, verified, public, ios_share, sync, how_to_reg, sports_gymnastics, … |

API cho module khác: `goto("community")`, `TECommunity.openDetail(id) / openShare(planId) / copyRoutine(id, {setActive, videos})`, `TEConnect.openInviteSheet(client) / openJoin(code) / openProxyLogger(cid, sid) / startPTSession(cid, sid) / syncNow()`.

## 3. Dữ liệu

### Firestore (động cơ firebase) — demo dùng cùng cấu trúc trong localStorage
| Đường dẫn | Nội dung |
|---|---|
| `invites/{id}` | `{ clientId, ptId, ptName, ptBrand, ptPhoto, ptSpecialty, email (chữ thường), code, name, message, status:"pending"/"accepted"/"declined", createdAt, respondedAt, studentUid, studentName }` |
| `clients/{cid}.chat` | `{ n:{pt,student} (số tin đã gửi), read:{pt,student} (số tin của bên kia đã đọc), readAt:{pt,student}, last:{ts,role,name,text} }` → chưa đọc = `n[bên kia] − read[tôi]`; "Đã xem" khi `readAt[bên kia] ≥ ts`. |
| `clients/{cid}.trainingSync` | Tóm tắt nhật ký do app học viên ghi (≤ 60 KB, tự rút gọn): `{ v, at, name, profile, streak, s7, s30, vol7, finished[], workouts[{d,t,n,tot,vol,dur,by:"self"/"pt"/"ptsess"}], weights[[date,kg]], ex:{key:{n, h:[[date,e1rm,top,vol]], last:{d, s:[[kg,reps]]}}} }`. Học viên tắt chia sẻ → `{ off:true }`. |
| `clients/{cid}/messages/{id}` | `{ from, role, name, text ≤ 2000, img (JPEG dataURL ≤ 140 KB) \| null, kind:"text"/"image"/"log"/"system", meta, ts }` |
| `clients/{cid}/sessions/{id}` | + `proxyLog { v, by, byName, at, startedAt, date, title, exercises[{key, exerciseId, name, muscle, reps, timed, img, sets[{kg,reps,rpe}]}], volume, sets, durationMin, note }`, `proxyApplied` (ms, học viên ghi khi đã nhận), `studentLog { date, at, exercises[], volume, durationMin }`, `exercises[i].result` ("60×8 · 60×7"). |
| `routines/{id}` | `{ authorUid, authorName, authorRole:"pt"/"member", authorPhoto, authorSpecialty, title, desc, goal:"lose/muscle/strength/glute/endurance/health", level, gender:"nam/nu/chung", equipment:"gym/home/minimal", weeks, perWeek, durationAvg, tags[], days:{T2..CN:{title,intensity,duration,ex:[{id (mã EXERCISES) \| null, name?, muscle?, guide?, sets, reps, rest}]}}, source, likes, saves, copies, reports, hidden, approved?, status, createdAt, updatedAt }` |
| `routines/{id}/likes\|saves\|copies\|reports/{uid}` | đánh dấu từng người (đếm 1 lần/người); `reports/{uid}` có `reason` |
| `userSocial/{uid}` | `{ liked[], saved[], copied[], reported[] }` |

Routine mẫu "TapEasy Team" (`seed-*`, 15 từ `PROGRAM_TEMPLATES` + 6 biến thể: PPL 3 buổi, giảm mỡ 30 phút trưa, tạ đơn tại nhà, 5×5, chạy 5 km, dân văn phòng) **không** ghi lên Firestore: luôn hiện (cả bản firebase), lượt thích/lưu/sao chép trên routine mẫu lưu cục bộ.

### Cục bộ (`saveState()`)
- `state.ptConnect = { applied:{sid:ts}, syncHash:{cid:hash}, syncAt, syncErr, hub, hubTab, share (mặc định true), draft (buổi log thay đang dở), pendingJoin, metric }`
- `state.community = { tab, sort, f:{goal, level, gender, perWeek, equipment, q} }`
- Nhận buổi "log thay": ghi `setLog` (chỉ khi mới hơn), `setHist` (theo đúng ngày, gộp nếu cùng ngày, phát hiện kỷ lục), `workoutLog[ngày].byPT`, `finishedDates`, và 1 dòng `trainingPro.log` (nếu có training-pro) có `byPT:true`.
- Sao chép routine: `state.plans[plan_xxx] = { …, fromRoutine:id, tagline:"CỘNG ĐỒNG · TÁC GIẢ" }` (bài lạ → `custom`), tuỳ chọn đặt làm giáo án đang tập + tự gắn video (`tplAttachVideos`).

## 4. Thay đổi `firestore.rules` (chỉ cần cho chế độ Firebase)

Gộp với nhánh của PT Pro. Trong `match /clients/{cid}` → `allow update`, thay nhánh học viên của PT Pro bằng:

```diff
-        || (isStudent()
-            && onlyKeys(['health', 'measurements', 'photos', 'updatedAt']))
+        // PT Pro + Social: học viên cập nhật hồ sơ sức khoẻ, chat (đã đọc / bộ đếm) và nhật ký đồng bộ
+        || (isStudent()
+            && onlyKeys(['health', 'measurements', 'photos', 'chat', 'trainingSync', 'updatedAt']))
```

Thêm vào trong `match /clients/{cid} { … }` (cạnh `match /{sub}/{docId}`):

```diff
+      // Chat 1-1 PT ↔ học viên
+      match /messages/{mid} {
+        function pc() { return get(/databases/$(database)/documents/clients/$(cid)).data; }
+        allow read: if signedIn() && (pc().ptId == me() || pc().studentUid == me());
+        allow create: if signedIn() && (pc().ptId == me() || pc().studentUid == me())
+          && request.resource.data.from == me()
+          && request.resource.data.text is string && request.resource.data.text.size() <= 2000
+          && (request.resource.data.img == null
+              || (request.resource.data.img is string && request.resource.data.img.size() <= 140000));
+        allow update: if false;
+        allow delete: if signedIn() && pc().ptId == me();
+      }
```
(`sessions` giữ nguyên: học viên ghi `proxyApplied`, `studentLog`, `status:"done"` qua nhánh `member()` sẵn có.)

Thêm ở cấp `match /databases/{database}/documents`:

```diff
+    function myEmail() { return request.auth.token.email != null ? request.auth.token.email.lower() : ''; }
+
+    // Lời mời PT → học viên (email)
+    match /invites/{iid} {
+      allow create: if signedIn() && request.resource.data.ptId == me()
+        && request.resource.data.status == 'pending'
+        && request.resource.data.email == request.resource.data.email.lower()
+        && get(/databases/$(database)/documents/clients/$(request.resource.data.clientId)).data.ptId == me();
+      allow read: if signedIn() && (resource.data.ptId == me() || resource.data.email == myEmail());
+      allow update: if signedIn() && (
+        (resource.data.ptId == me() && request.resource.data.ptId == me())
+        || (resource.data.email == myEmail() && resource.data.status == 'pending'
+            && request.resource.data.status in ['accepted', 'declined']
+            && request.resource.data.studentUid == me()
+            && onlyKeys(['status', 'respondedAt', 'studentUid', 'studentName'])));
+      allow delete: if signedIn() && resource.data.ptId == me();
+    }
+
+    // Routine cộng đồng: ai cũng đọc được; bộ đếm chỉ đổi ±1 kèm tài liệu đánh dấu của chính người đó
+    match /routines/{rid} {
+      function dlt(k) { return request.resource.data.get(k, 0) - resource.data.get(k, 0); }
+      function mark(kind) { return /databases/$(database)/documents/routines/$(rid)/$(kind)/$(me()); }
+      function validR() {
+        let r = request.resource.data;
+        return r.title is string && r.title.size() >= 4 && r.title.size() <= 80
+          && r.get('desc', '').size() <= 1000 && r.days is map && r.authorUid == me();
+      }
+      allow read: if true;
+      allow create: if signedIn() && validR()
+        && request.resource.data.likes == 0 && request.resource.data.saves == 0
+        && request.resource.data.copies == 0 && request.resource.data.reports == 0
+        && request.resource.data.hidden == false && !('approved' in request.resource.data);
+      allow delete: if signedIn() && resource.data.authorUid == me();
+      allow update: if signedIn() && (
+        (resource.data.authorUid == me() && validR()
+          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['likes', 'saves', 'copies', 'reports', 'hidden', 'approved', 'authorUid']))
+        || (onlyKeys(['likes']) && ((dlt('likes') == 1 && !exists(mark('likes')) && existsAfter(mark('likes')))
+                                 || (dlt('likes') == -1 && exists(mark('likes')) && !existsAfter(mark('likes')))))
+        || (onlyKeys(['saves']) && ((dlt('saves') == 1 && !exists(mark('saves')) && existsAfter(mark('saves')))
+                                 || (dlt('saves') == -1 && exists(mark('saves')) && !existsAfter(mark('saves')))))
+        || (onlyKeys(['copies']) && dlt('copies') == 1 && !exists(mark('copies')) && existsAfter(mark('copies')))
+        || (onlyKeys(['reports', 'hidden']) && dlt('reports') == 1 && !exists(mark('reports')) && existsAfter(mark('reports'))
+            && request.resource.data.hidden == (request.resource.data.reports >= 3))
+        || request.auth.token.admin == true      // kiểm duyệt viên (custom claim) khôi phục: approved:true, hidden:false
+      );
+      match /likes/{uid}   { allow read: if signedIn(); allow create, delete: if signedIn() && uid == me(); }
+      match /saves/{uid}   { allow read, create, delete: if signedIn() && uid == me(); }
+      match /copies/{uid}  { allow read, create: if signedIn() && uid == me(); }
+      match /reports/{uid} { allow read: if signedIn() && uid == me();
+        allow create: if signedIn() && uid == me() && request.resource.data.reason is string && request.resource.data.reason.size() <= 200; }
+    }
+
+    match /userSocial/{uid} { allow read, write: if signedIn() && uid == me(); }
```

Ghi chú:
- Chưa cập nhật rules thì PT Connect vẫn chạy được phần cũ; thao tác mới báo tiếng Việt "Máy chủ chưa cho phép thao tác này… (xem INTEGRATION-social.md)". Đồng bộ nhật ký lỗi được hiện ở tab Tiến độ của học viên.
- Truy vấn dùng: `invites where email== & status==` (2 điều kiện bằng – không cần composite index), `invites where ptId==`, `clients where ptId==/studentUid==` (onSnapshot), `routines orderBy createdAt desc limit 200`, `routines where authorUid==`, `messages orderBy ts desc limit 200`. Không cần tạo index thủ công.
- Giới hạn 1 MiB/doc của `clients/{cid}`: ảnh tiến trình PT Pro ≤ ~650 KB + `trainingSync` ≤ 60 KB + chat meta vài trăm byte → an toàn. Ảnh chat nằm trong `messages`, không ở client doc.
- Email Apple "ẩn email" (privaterelay) vẫn khớp nếu PT nhập đúng email relay; khuyến nghị dùng **mã / QR** cho trường hợp này.
- Chính sách bảo mật: nên bổ sung câu "Khi kết nối PT, tóm tắt nhật ký tập (buổi tập, mức tạ, cân nặng) được chia sẻ với PT của bạn; tắt được trong mục PT → Tiến độ" và "Routine bạn đăng lên Cộng đồng là công khai".

## 5. Kiểm duyệt
- Lọc từ thô tục tiếng Việt (có dấu, không dấu chỉ với dạng không gây nhầm, teencode `đm/dcm/vcl…`, tách chữ `v.c.l`, lặp chữ `dmmmm`) + tiếng Anh phổ biến. Chỉ khớp **nguyên từ** nên không bắt nhầm "buổi", "đeo đai", "lon nước", "các bài", "du lịch", "70 cm", "Đùi trước". Đăng routine có từ thô tục → bị chặn kèm lý do; nội dung cũ hiển thị qua `cleanText` (che `***`).
- Báo cáo: 5 lý do; mỗi người 1 lần; **≥ 3 báo cáo → `hidden:true`** (ẩn khỏi bảng tin, tác giả vẫn thấy ở "Của tôi" kèm nhãn). Kiểm duyệt viên có custom claim `admin` đặt `approved:true` để khôi phục.
- Đăng tối đa 10 routine / 24 giờ / người (kiểm ở client).

## 6. Cách thử

```bash
cd FitKit
for f in cloud-social.js pt-connect.js community.js; do node -e "new Function(require('fs').readFileSync('$f','utf8'))"; done
node tests/run.js --only social          # 17 test: mời/chấp nhận/từ chối, mã + link ?join=, chat & đã xem, polling, log thay → nhật ký,
                                         # đồng bộ ≤60 KB, buổi PT giao tập trong app, đăng/thích/lưu/sao chép/báo cáo, tìm & lọc, kiểm duyệt, XSS, QR
cd ../_test/social-kit
node run_dom.js t_tour.js                # 38 bước giao diện trên DOM thật (parse HTML): hộp thư, tab PT 4 mục, chat gửi qua UI, chấp nhận PT thứ 2,
                                         # PT mời (QR + email), Nhật ký tập, log thay (đồng hồ nghỉ, lưu), học viên nhận, Cộng đồng (tìm, thích, chi tiết,
                                         # sao chép qua UI, chia sẻ), thẻ Trang chủ, menu, Giáo án mẫu
node fb_mock_test.js                     # 23 kiểm tra động cơ Firebase trên Firestore giả lập (increment, arrayUnion, batch, transaction, onSnapshot)
python3 build.py social-tour.html t_tour.js   # → _test/social-tour.html: mở bằng trình duyệt, tự đi qua 17 cảnh (giữ 14 s/cảnh, #hold=ms để đổi)
```
Mã QR đã kiểm tra giải mã bằng OpenCV (phiên bản 1, 4, 6, 8, 10; có chữ tiếng Việt UTF-8).

Thử tay (demo, 1 máy): tạo tài khoản PT → bật chế độ PT → **Mời học viên** → Học viên mới → nhập email → Gửi. Đăng xuất, đăng ký bằng email đó → mục PT → **Hộp thư lời mời** → Chấp nhận → tab PT hiện. Nhắn tin, gửi ảnh; đăng nhập lại PT → huy hiệu số trên nút PT → form học viên → Chat ("Đã xem"), **Tập cùng — log thay** → ghi vài hiệp → Kết thúc. Đăng nhập học viên → toast "PT đã ghi buổi…", Tiến độ có 1RM mới. Menu ☰ → **Cộng đồng** → mở routine → Sao chép vào tuần tập.

## 7. Giới hạn / việc tiếp theo
- Thông báo đẩy (FCM) khi có tin nhắn / lời mời chưa có — hiện dựa vào realtime khi app mở + huy hiệu. Cần Cloud Function `onCreate(messages)` → FCM.
- Tìm kiếm cộng đồng lọc phía client trên 200 routine mới nhất; khi lớn hơn nên dùng Algolia/Typesense hoặc trường `searchTokens`.
- Đếm thích/lưu/sao chép dựa vào rules + tài liệu đánh dấu (chống cộng dồn), chưa có Cloud Function đối soát.
- Demo: chat/ảnh lưu localStorage (tự xoá ảnh cũ khi đầy); tương tác cộng đồng trên cùng máy giữa các tài khoản.
- Quét QR trong app dùng `BarcodeDetector` (Chrome/Android); iOS dùng camera hệ thống quét link `?join=` hoặc nhập mã.
- Học viên "Bắt đầu tập & ghi kg × lần" buổi PT giao: dùng màn ghi hiệp gốc (`renderSessionStep`); tuần giảm tải của giáo án cá nhân (training-pro) không áp cho buổi PT.

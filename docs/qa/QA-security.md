# QA-security — Phân quyền · Bảo mật · Tuân thủ store (TapEasy, 11/11/2026)

Người kiểm thử: AppSec + QA (agent `qa-security`). **Không sửa file app** — mọi công cụ/kết quả nằm ở `outputs/_test/qa-security/`.
Phạm vi: `rbac.js`, `cloud-admin.js`, `admin.js`, `functions/` (admin, index, apple, findpt), `firestore.rules`, `storage.rules`, `cloud.js` (xoá tài khoản, đăng nhập social), **mọi file JS** về XSS, `privacy-policy.html`, `delete-account.html`, khai báo Data safety / App Privacy trong `docs/STORE-COMPLIANCE.md`.

**Điểm tổng: 5,0 / 10** — lõi RBAC rất tốt (không tìm được đường leo thang nào qua 1,19 triệu tổ hợp, Owner được bảo vệ, Functions đọc vai trò từ `roles/`), nhưng **dữ liệu từ người dùng khác vẫn đi vào HTML không escape ở 13 chỗ** (2 chỗ chạy được trong phiên Owner/nhân sự), rules còn cho **gắn học viên không cần đồng ý / tự tính giá / tự cấp điểm**, "phiên quản trị 30 phút" và "xác thực lại 5 phút" **chỉ có ở client**, xoá tài khoản **không xoá hết** dữ liệu gắn với người dùng. Chi tiết chấm điểm ở §6.

---

## 1. Cách làm & kết quả đo được

| Hạng mục | Công cụ (trong `_test/qa-security/`) | Kết quả |
|---|---|---|
| Ma trận leo thang quyền | `rbac-attack.test.js` §1 — vét cạn **1 190 160 tổ hợp** (10 người gán × 4 bộ quyền lẻ × 12 vai trò bị gán × khoá/không × chính mình × 19 vai trò mới gồm `owner`, tên lạ, `__proto__`… × 85 bộ px gồm sai định dạng, nhạy cảm, >12), so với **chính sách viết lại độc lập từ bảng §4 docs/RBAC.md** và vi sai client ↔ Cloud Functions | 0 khác biệt client/server · **0 đường leo thang thật** · rules `hasPerm()` ≡ `permsOf()` (10×85×36) · ma trận docs = rbac.js = functions = rules = storage · **lỗi phụ: tên vai trò trùng thuộc tính nguyên mẫu JS được chấp nhận (QS-18)** |
| Owner, Cloud Functions | §2 — Admin SDK giả lập: `bootstrapOwner`, `setRole`, `transferOwnership`, `banUser`, `adminGetUser`, `sendBroadcast` | 46/48 đạt; trượt: `setRole` nhận vai trò `constructor` (QS-18), `banUser` không gỡ vai trò (QS-13) |
| Giả mạo audit | §3 — sửa / xoá giữa / đảo / **cắt đuôi** / **băm lại cả chuỗi** / `verifyAudit` bản Firebase | Phát hiện sửa-xoá-đảo; **không** phát hiện cắt đuôi, viết lại chuỗi, sửa nội dung giữ hash (QS-15) |
| Phiên 30 phút · 12 giờ · step-up · khoá 5 lần sai | §4–5 — `rbac.js` chạy trong `vm` với đồng hồ giả | Đúng như thiết kế ở client; nhưng sửa `sessionStorage` hồi sinh phiên, xoá `localStorage` bỏ khoá dò mật khẩu, bản demo thành Owner bằng sửa `localStorage`, tài khoản "Google" demo vào phiên không cần mật khẩu (QS-05, QS-16) |
| firestore.rules + storage.rules | `rules-engine.js` (bộ thông dịch mini — **không có mạng để cài `firebase-tools`/emulator**; đọc thẳng file rules của app, ngữ nghĩa lỗi/`&&`/`||` như Firestore) + `rules-attack.test.js` | **109 kịch bản, 109 khớp dự đoán, 25 lỗ hổng tái hiện**: đọc email/PII, sửa đơn người khác, tự cấp điểm, đánh giá giả, chat giả danh, xoá audit, leo thang, chiếm form, Storage. 8 ca đối chứng hợp lệ đều được cho phép (bộ thông dịch không "chặn hết") |
| Quét tĩnh XSS | `xss-ast-scan.js` (AST acorn, không regex): 52 file · 2 232 template HTML · **6 972 biểu thức `${…}`** → 3 924 an toàn tự động, 1 504 helper nội bộ, 1 573 cần đọc + 144 sink khác (`innerHTML=`, `insertAdjacentHTML`, `document.write`, `window.open`, `.src=`…) | Đọc tay theo **nguồn dữ liệu** (hằng / máy mình / người khác / nhân sự): **13 điểm chèn thật** dữ liệu của người khác (bảng QS-01…QS-06, QS-11); phần còn lại là số tính toán, hằng, hoặc dữ liệu chỉ trên máy mình (đã sửa ở BUG-18) |
| Trình duyệt thật | Playwright Chromium 157, **ngữ cảnh riêng `qa-security`** (`browser.newContext`, origin `https://qa-security.local`, file qua `route.fulfill`, chặn mọi mạng ngoài), bản ghép `scripts/build-single-html.py --offline --test t_qa_security.js` → `_test/qa-security/qa-security.html` | **138 ô/trường** (tên, ghi chú, routine, review, sự kiện, thử thách, sản phẩm, chat, bình luận, đơn hàng, hỗ trợ, báo cáo, xác minh PT, niêm yết, thông báo, cài đặt, voucher) — gõ thật + `locator.fill()` + API + tài liệu thô đúng hình dạng rules cho ghi → **11 payload THỰC THI**, 127 an toàn, 0 lỗi JS. Ảnh: `shots/qs01-…`, `qs02-…`, `qs03-…` |
| Store | Đối chiếu mã nguồn với App Store 1.2, 2.3.1, 4.8, 5.1.1(v), 5.1.2; Google Play Data safety, Account deletion URL, Health apps declaration, target API | §5 |

Chạy lại: `node _test/qa-security/rbac-attack.test.js` · `node _test/qa-security/rules-attack.test.js` · `node _test/qa-security/xss-ast-scan.js` · trình duyệt: build như trên rồi mở trong ngữ cảnh Playwright riêng, đọc `window.__qa` (xem đầu `t_qa_security.js`).

---

## 2. Điểm mạnh (giữ nguyên)

- `checkAssign` client = server, vét cạn không lọt; Owner không bị hạ/khoá/đổi; `owner.transfer` cần Owner + `auth_time` ≤ 5 phút + cụm từ; `setRole` cần `auth_time` ≤ 30 phút; vai trò lấy từ `roles/{uid}` (không tin claims); `staffFresh()` làm thu hồi vai trò có hiệu lực ngay.
- Quyền nhạy cảm không cấp lẻ được (kể cả nếu token bị cấp nhầm `+settings.payment` — ca G10).
- `admin_audit`: client không sửa/xoá được, không ghi đứng tên người khác/khai vai trò khác/lùi giờ/chèn `seq`,`hash` (F1–F7, F9).
- `users` không `list`, email không còn trong hồ sơ; đơn hàng/đăng ký sự kiện/ticket/ghi chú nội bộ chỉ đúng người đọc; PT không tự gắn tích xanh, không tự ẩn đánh giá xấu; Storage chặn SVG, ảnh > 3 MB, ghi đè, thư mục người khác.
- Escape tốt ở `admin.js`, `findpt.js`, `kb.js` (markdown escape trước rồi mới thêm thẻ), `events-media.js`, `community.js` (màn cộng đồng), chat `pt-connect.js`; `sendBroadcast` chỉ nhận link trong danh sách trắng; `bootstrapOwner` giới hạn 5 lần/giờ, so sánh hằng thời gian.

---

## 3. Bảng lỗ hổng

Mức: **Nghiêm trọng** (CVSS-ish ≥ 9) · **Cao** (7–8.9) · **TB** (4–6.9) · **Thấp** (< 4). "Tái hiện" = mã ca trong `rules-attack-result.json` (A1…I12), `rbac-attack-result.txt`, hoặc payload `#N` trong `browser-xss-result.txt`.

| Mã | Mức (≈CVSS) | Lỗ hổng | Tái hiện | Vị trí (file:dòng) |
|---|---|---|---|---|
| **QS-01** | **Nghiêm trọng (9.0)** | XSS lưu trữ từ **tên trên bảng xếp hạng** chạy trong **phiên Owner/Quản lý sự kiện** khi bấm "Chốt kết quả & trao quà" → script gọi `setRole`/đổi STK nhận tiền bằng quyền Owner | Trình duyệt #101 (ảnh `shots/qs01-award-confirm-owner.png`); rules C1 (entries nhận mọi trường) | `events.js:1806` (`r.name` vào `confirmDialog`), `app.js:149-154` (`confirmDialog` nhận HTML), `firestore.rules:325-327` |
| **QS-02** | **Nghiêm trọng (9.0)** | **Gắn bất kỳ ai làm học viên** không cần đồng ý + trường `id` trong dữ liệu **ghi đè** `doc.id` + id chèn thô vào thuộc tính → XSS **không cần bấm** khi nạn nhân mở "PT của tôi"; chỉ cần UID nạn nhân (UID lộ ở routine/đánh giá/bảng xếp hạng) | Rules E10–E11; trình duyệt #60 | `firestore.rules:192`; `cloud.js:162-163` (`Object.assign({id:d.id}, d.data())`), cùng mẫu ở `cloud-events.js:689-690`, `cloud-admin.js:54-55`; `coach.js:134` `data-open-client="${c.id}"`, `coach.js:414` `onclick="openPTProfile('${c.ptId}','${c.id}')"`, `pt.js:650`, `coach.js:277` |
| **QS-03** | Cao (8.0) | **Sao chép routine cộng đồng** đưa chuỗi thô của tác giả vào giáo án trên máy → XSS **lặp lại mỗi lần mở Trang chủ** và màn Tập luyện | Trình duyệt #91 #93 #96 (ảnh `shots/qs03-home-after-copy-alice.png`) | `cloud-social.js:324-338` (`planFromRoutine` không lọc `intensity`, `reps`, `muscle`…), `pt.js:618` `${day.intensity}`, `app.js:645` `${meta.muscle} · ${item.sets} hiệp × ${item.reps}` |
| **QS-04** | Cao (7.6) | PT ↔ học viên: trường buổi tập/form **ai trong 2 người cũng ghi được** chèn thô → XSS chéo (PT → học viên và ngược lại) | Trình duyệt #70 #77 #78 #66; rules E7 | `pt-connect.js:829` `class="sc-sess ${s.status}"`; `coach.js:574` `data-sopen="${s.id}"`, `coach.js:759`; `coach.js:863` `${total}` (packageTotal); `pt-connect.js:676-679` (`toPlanItem` giữ `e.img`, `e.stock` thô) → `app.js:815` (và 674, 1422) `<img src="${meta.img}">`; `firestore.rules:227` |
| **QS-05** | Cao (7.5) | "Phiên quản trị 30 phút / 12 giờ" và "nhập lại mật khẩu ≤ 5 phút" **chỉ kiểm ở client**. Rules/Functions (trừ `setRole`, `transferOwnership`) không đòi `auth_time` → bất kỳ script nào chạy trong app của nhân sự (QS-01…04) dùng token thường để **đổi tài khoản nhận tiền** (Owner), khoá người, xem PII… | Rules G4 (Owner đăng nhập 30 ngày trước vẫn đổi `bank`); RBAC §4 (sửa `sessionStorage` hồi sinh phiên) | `firestore.rules:94-100`, `59-65`; `cloud-admin.js:76`, `533-534`; `rbac.js:304-312`; `functions/admin.js:293-396` (ban, PII, broadcast không có `recentSec`) |
| **QS-06** | Cao (7.6) | XSS trong **chi tiết đơn hàng** — khách đặt `qty` là chuỗi HTML → chạy khi **nhân sự cửa hàng/Owner** mở đơn | Trình duyệt #112 (cả phiên Owner) ; rules B3–B4 (đơn không kiểm cấu trúc) | `shop.js:874` `<i>${i.qty}</i>`; `firestore.rules:409-411` |
| **QS-07** | TB (5.4) | **Đánh giá giả**: PT tạo form gắn tài khoản phụ (hoặc đánh dấu "done" buổi thử của tài khoản phụ) → tài khoản phụ đủ điều kiện `trained()` viết 5★ | Rules D2–D4 | `firestore.rules:192`, `460-467`, `507-508` |
| **QS-08** | TB (6.5) | **Tự tính giá**: client gửi `total`, `price`, `discount`, `paid`, `history` tuỳ ý (đơn 450 000 ₫ → 1 ₫, "đã thanh toán", lịch sử "confirmed" giả); voucher `used` không tăng ở máy chủ | Rules B3, B4 | `firestore.rules:409-411`; `cloud-events.js:809`; `cloud-admin.js:592-598` |
| **QS-09** | TB (5.3) | **Tự cấp điểm thử thách**: tự nhập tới `target×5`, cả khi thử thách **đã kết thúc** → lên top, nhận quà thật | Rules C1, C2 | `firestore.rules:325-327` |
| **QS-10** | Cao (7.0, tuân thủ) | **Xoá tài khoản không xoá hết dữ liệu**: còn routine công khai (tên tác giả), đánh giá PT/sự kiện + ảnh, tin nhắn, bình luận, đăng ký sự kiện (SĐT, **liên hệ khẩn cấp**), đơn hàng/quà (địa chỉ), ticket, báo cáo, lời mời theo email, bảng xếp hạng, yêu cầu Tìm PT, ảnh Khoảnh khắc trên Storage. Privacy policy & trang xoá nói "xoá vĩnh viễn" — không khớp. `delete-account.html` chưa thu hồi token Apple, không chặn Owner | Đọc mã | `functions/index.js:45`, `88-122`; `cloud.js:313-330`; `delete-account.html:57-85`; `privacy-policy.html` §3, §10 |
| **QS-11** | TB (6.1) | XSS từ **nội dung nhân sự cấp thấp** (Quản lý sự kiện) sang người dùng và **Owner**: ngày bắt đầu thử thách vào thuộc tính `min` không escape → leo thang trong nội bộ (Events → Owner) | Trình duyệt #16 | `events.js:927` `min="${ch.start}"`; `firestore.rules:321` (không kiểm định dạng ngày) |
| **QS-12** | TB (5.0) | **Giả danh trong chat/đơn**: học viên gửi tin `kind:'system'` (hiện như dòng hệ thống, không tên); trường `name` tuỳ ý; người hỏi PT **ghi đè cả mảng `msgs`** (chèn câu trả lời giả của PT); học viên sửa "PT dặn" (`ptNote`) và trạng thái buổi | Rules E3, E4, E6, E7; trình duyệt #84 hiện nguyên văn | `firestore.rules:238-245`, `506-510`, `227`; `pt-connect.js:348`, `357` |
| **QS-13** | TB (5.4) | **Khoá / hạ quyền không tức thì**: rules & storage không đọc `bans/`; `banUser` giữ `roles/{uid}` → nhân sự bị khoá vẫn kiểm duyệt bằng ID token còn hạn (≤ 1 giờ); `staffFresh()` chỉ so `role`, không so `px` → quyền lẻ đã thu hồi vẫn dùng được ≤ 1 giờ | Rules G6, G7, G8, I12; RBAC §2 | `firestore.rules:58`; `storage.rules:13-16`; `functions/admin.js:293-309` |
| **QS-14** | TB (5.3) | **Chiếm form / lời mời**: ai biết `clientId` (lấy từ `joinCodes/{mã 6 ký tự}` — dò được) tự gắn vào form chưa kết nối **không cần mã** và đọc SĐT/mục tiêu PT nhập; lời mời theo email chấp nhận được bằng tài khoản **chưa xác minh email** | Rules H1, H2, A7, A8 | `firestore.rules:198-200`, `180`, `17`, `258-264` |
| **QS-15** | Thấp (3.8) | **Audit**: nhân sự bất kỳ ghi được hành động tuỳ ý ("owner.transfer", `actorName` "Chủ sở hữu") gây nhiễu; `verifyAudit` (Firebase) chỉ so `seq/prev`, không tính lại SHA-256, không so `admin_audit_meta/head` (cắt đuôi không lộ), chỉ đọc 2 000 bản đầu; bản demo: băm không khoá → viết lại cả chuỗi không lộ; `appendAudit` công khai nhận `actor` do người gọi đưa | Rules F8; RBAC §3 | `firestore.rules:83-89`; `cloud-admin.js:601-633`; `rbac.js:229-242` |
| **QS-16** | TB (5.0, store) | **Chế độ demo** (firebase-config.js đang trống): mã khởi tạo mặc định công khai `TAPEASY-OWNER-2026` nằm trong mã; sửa `localStorage` thành Owner; tài khoản social demo vào phiên quản trị không cần mật khẩu; xoá `localStorage` bỏ khoá dò mật khẩu. Nếu bản store chạy demo → **bảng quản trị ẩn** (7 lần chạm / `#admin`) ai cũng mở được | RBAC §4–5 | `cloud-admin.js:33-35`; `rbac.js:320-322`, `339-340`; `firebase-config.js` |
| **QS-17** | Thấp (3.5) | SĐT riêng của PT trong `users/{uid}` đọc được bởi **mọi** người đã đăng nhập (không chỉ học viên của PT) | Rules A3 | `firestore.rules:166`; `coach.js:412` |
| **QS-18** | Thấp (2.7) | `ROLES[r]` tra trên object thường → `__proto__`, `constructor`, `toString`… qua kiểm tra; `level()` = `undefined` vượt mọi so sánh; `setRole` (máy chủ) ghi `role:"constructor"` vào `roles/` + claims, `actorOf` coi là vai trò hợp lệ (có `panel.access`). Không leo thang được nhưng phá bất biến | RBAC §1 (26 220 tổ hợp), §2 | `rbac.js:119`, `127`, `160`; `functions/admin.js:70`, `73`, `92`, `154`, `168` |
| **QS-19** | Thấp (3.1) | Bộ đếm: `commentCount` ±1 không cần bình luận thật (bơm vô hạn); `reported` tuỳ ý khi báo cáo; 3 tài khoản phụ tự ẩn được routine bất kỳ | Rules C10 | `firestore.rules:382-383`, `292-293` |
| **QS-20** | Thấp (3.1) | `safeUrl()` nhận URL **giao thức tương đối** `//evil.example/x.png` (qua nhánh đường dẫn nội bộ); `safeImg` của shop nhận mọi `https://` → pixel theo dõi IP | Đọc mã | `app.js:1802`; `shop.js:56` |
| **QS-21** | Thấp (3.5) | Owner xoá tài khoản qua **`delete-account.html`** (không qua chặn ở `pt.js`) → `cleanupDeletedUser` xoá `roles/{uid}` nhưng `roles_meta/owner` vẫn trỏ UID đã xoá → app **mất Owner**, chỉ khôi phục bằng service account | Đọc mã | `delete-account.html:57-85`; `functions/index.js:115-120` |
| **QS-22** | Thông tin | Không có CSP; nhiều `onclick="…"` nội tuyến; `confirmDialog`/`openSheet` nhận HTML theo mặc định → một chỗ quên escape là XSS | Đọc mã | `index.html`; `app.js:149`, `475` |

---

## 4. Chi tiết, tái hiện & đề xuất sửa

### QS-01 — Tên bảng xếp hạng → `confirmDialog` trong phiên Owner (Nghiêm trọng)
**Tái hiện (Firebase):** người dùng tham gia thử thách rồi ghi thẳng bằng SDK
`db.doc("challenges/CH/entries/"+uid).set({uid, value: target*5, name: "'\"><img src=x onerror=fetch(...)>"})` (rules C1 cho phép mọi trường). Owner/Quản lý sự kiện mở *Sự kiện → Quản trị → Chốt & trao quà* → `awardChallenge` ghép `r.name` vào chuỗi HTML của `confirmDialog` → script chạy với phiên Owner. Owner vừa đăng nhập bảng quản trị (đã reauth → `auth_time` mới) nên script gọi được `httpsCallable("setRole")({uid: attacker, role:"super_admin"})` hoặc ghi `settings/public.bank` (QS-05). Trình duyệt: payload #101 chạy (ảnh).
**Sửa:**
```js
// events.js:1806
confirmDialog("Chốt kết quả & trao quà?", `${top.length} người hạng 1–${Number(ch.giftTop)||0} sẽ nhận thông báo "Bạn nhận quà"…: ${top.slice(0,5).map(r=> "#" + r.rank + " " + esc(r.name)).join(", ")}${top.length > 5 ? "…" : ""}`, …);
// app.js:149 — an toàn theo mặc định, HTML phải xin phép rõ
function confirmDialog(title, message, onConfirm, confirmLabel, icon, opts){
  const msg = opts && opts.html ? message : escapeHtml(message);   // 5 nơi gọi đang tự escape (app.js:1199, coach.js:400, findpt.js:61, nutrition-pro.js:1050, pt-pro.js:844/1279) → bỏ esc() ở đó
  …<h3>${escapeHtml(title)}</h3><p class="small-note">${msg}</p>…
```
```
// firestore.rules — entries chỉ nhận đúng trường, tên ngắn
allow create, update: if signedIn() && me() == uid && request.resource.data.uid == uid
  && request.resource.data.keys().hasOnly(['uid','name','value','weekValue','week','joinedAt','updatedAt'])
  && request.resource.data.get('name','') is string && request.resource.data.get('name','').size() <= 40
  && … (value như cũ, xem QS-09)
```

### QS-02 — Gắn học viên không cần đồng ý + `id` ghi đè + id thô trong thuộc tính (Nghiêm trọng)
**Tái hiện:** kẻ tấn công (tài khoản thường, tự bật PT) ghi
`db.collection("clients").add({ ptId: me, studentUid: VICTIM_UID, name:"…", id: "\"><img src=x onerror=…>" })` (rules E10 cho phép). Nạn nhân mở tab PT → `listClientsAsStudent` → `qData` trả `id` = payload (dữ liệu đè `d.id`) → `coach.js:134` `data-open-client="${c.id}"` → **chạy ngay khi vẽ** (#60). Kẻ tấn công còn nhắn tin vào form đó (E11) — spam/lừa đảo.
**Sửa (3 lớp):**
```js
// cloud.js:162-163 (và cloud-events.js:689-690, cloud-admin.js:54-55, cloud-social/cloud-pt-directory nếu cùng mẫu)
const docData = d => d.exists ? Object.assign({}, d.data(), { id: d.id }) : null;   // id luôn là id thật
const qData  = q => q.docs.map(d => Object.assign({}, d.data(), { id: d.id }));
// coach.js:134, 574, 759 · pt.js:650: escape mọi id; bỏ onclick nội tuyến
`<div class="list-item client-row" data-open-client="${escapeHtml(c.id)}" data-role="${escapeHtml(role)}">`
`<button class="btn btn-soft btn-sm btn-block" data-open-pt="${escapeHtml(c.ptId)}" data-cid="${escapeHtml(c.id)}">` // + addEventListener
```
```
// firestore.rules:192 — PT không được tự điền học viên; liên kết chỉ qua mã mời / lời mời
allow create: if signedIn() && request.resource.data.ptId == me()
  && request.resource.data.get('studentUid', null) == null
  && !request.resource.data.keys().hasAny(['id', 'studentEmail', 'studentName']);
```

### QS-03 — Routine cộng đồng → giáo án trên máy (Cao)
**Tái hiện:** đăng routine bằng SDK với `days.T2.intensity = "<img src=x onerror=…>"`, `ex[0].reps`, `ex[0].muscle` tương tự (rules chỉ kiểm `days is map`). Nạn nhân bấm *Sao chép* (nút chính, mặc định "đặt làm giáo án đang dùng") → Trang chủ chạy #91 mỗi lần mở app; màn Tập luyện chạy #93, #96.
**Sửa:** chuẩn hoá khi nhập + escape ở chỗ vẽ.
```js
// cloud-social.js planFromRoutine
const INT_OK = ["Nhẹ","Vừa","Cao","Rất cao","Nghỉ"], clip = (s, n)=> String(s == null ? "" : s).slice(0, n);
days[k] = { title: clip(d.title || "Nghỉ ngơi", 60), intensity: INT_OK.includes(d.intensity) ? d.intensity : "Vừa",
  duration: Math.max(0, Math.min(240, Number(d.duration) || 30)),
  items: (Array.isArray(d.ex) ? d.ex : []).slice(0, 20).map(e=>{ const known = …;
    return { uid: …, exerciseId: known ? e.id : null, sets: Math.max(1, Math.min(10, Number(e.sets) || 3)),
      reps: clip(e.reps || "10", 20), restSec: Math.max(0, Math.min(600, Number(e.rest) || 60)), clipId: null,
      custom: known ? null : { name: clip(e.name || "Bài tập", 80), muscle: clip(e.muscle || "Tuỳ chỉnh", 40), equipment: clip(e.equip || "—", 40), guide: clip(e.guide, 500) } }; }) };
```
```js
// pt.js:618
<span>…bolt</span>${escapeHtml(day.intensity || "Vừa")}</span>
// app.js:645 (và 681, 821 cùng mẫu)
<div class="meta">${escapeHtml(meta.muscle)} · ${escapeHtml(String(item.sets))} hiệp × ${escapeHtml(String(item.reps))}</div>
```

### QS-04 — Trường PT ↔ học viên chèn thô (Cao)
**Tái hiện:** một bên ghi `clients/{cid}/sessions/{id}` với `status:"\"><img …>"` (rules: `sessions` cho cả hai ghi mọi trường) → hub PT Connect của bên kia chạy #70; id buổi tập lạ → `data-sopen` #78; PT đặt `packageTotal:"<img …>"` → tab Tiến độ của học viên #66; PT giao bài `img: 'x" onerror="…'` → học viên bấm *Bắt đầu* → `renderSessionStep` #77.
**Sửa:**
```js
// pt-connect.js:829
const ST_CLS = { scheduled:1, done:1, cancelled:1 };
`<button type="button" class="sc-sess ${ST_CLS[s.status] ? s.status : ""}" …>`
// coach.js:863 (+ :367, :856)
const total = Math.max(0, Math.round(Number(c.packageTotal) || 0));
// pt-connect.js:676-679 toPlanItem
reps: String(e.reps || "10").slice(0, 20), … custom: { …, img: safeUrl(e.img, { noBlob:true }) }, stock: e.stock ? { thumb: safeUrl(e.stock.thumb), url: safeUrl(e.stock.url) } : undefined
// app.js:640, 674, 815, 1422
<img src="${attrUrl((item.stock && item.stock.thumb) || meta.img)}" …>
```
```
// firestore.rules:227 — tách quyền buổi tập
allow create: if signedIn() && sub == 'sessions' && isPTof();
allow update: if signedIn() && sub == 'sessions' && (isPTof()
  || (parent().studentUid == me()
      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','feedback','completedAt','studentLog','exercises','updatedAt'])
      && request.resource.data.status in ['scheduled','done','cancelled']));
```

### QS-05 — Phiên quản trị / step-up chỉ ở client (Cao)
**Tái hiện:** rules G4 — token Owner `auth_time` 30 ngày trước vẫn ghi `settings/public.bank`. Trong app, `cloud-admin.saveSettings` có `stepUp("settings.payment")` nhưng gọi thẳng Firestore thì không có gì chặn. Kết hợp QS-01/02/03/04/06 (script chạy trong máy Owner khi đang dùng app bình thường) → đổi STK nhận tiền của khách.
**Sửa:**
```
// firestore.rules
function authAge() { return request.time.toMillis() / 1000 - request.auth.token.auth_time; }
function hasPerm(p) { return … && staffFresh() && authAge() < 12 * 3600; }          // = maxHours, buộc reauth khi mở bảng quản trị
match /settings/public {
  allow update: if hasPerm('settings.edit')
    && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['bank'])
        || (hasPerm('settings.payment') && authAge() < 300));                        // = stepUpMin 5 phút
}
```
Tốt hơn: chuyển đổi STK sang callable `setPaymentInfo` (`actorOf(request, { recentSec: 300 })`, ghi audit, **gửi email cho Owner** mỗi lần đổi) và rules `bank` chỉ Functions ghi. `banUser`, `adminGetUser` (PII), `sendBroadcast` thêm `recentSec: 12*3600`.

### QS-06 — Đơn hàng: XSS vào màn nhân sự (Cao)
**Tái hiện:** `db.collection("orders").add({uid: me, status:"pending", total: 1, items:[{pid:"p_tee", qty:"<img src=x onerror=…>"}]})` → nhân sự mở đơn → #112 (đã xác nhận cả ở phiên Owner).
**Sửa:** `shop.js:874` `<i>${Math.max(1, Math.round(Number(i.qty)) || 1)}</i>`; và QS-08 (máy chủ tạo đơn).

### QS-07 — Đánh giá giả bằng tài khoản phụ (TB)
**Sửa:** chặn tạo form có sẵn học viên (QS-02); `trained()` cần form do **học viên tự nhập mã** (`joinedAt` do học viên ghi) ≥ 7 ngày và ≥ 1 buổi `done`; buổi thử cần `slot.date` đã qua và yêu cầu tạo trước ≥ 24 giờ; `ptReviewAgg` gắn cờ đánh giá từ tài khoản < 7 ngày tuổi / cùng thiết bị (App Check), giảm trọng số.

### QS-08 — Client tự tính giá đơn (TB)
**Sửa:** callable `placeOrder` (Admin SDK): đọc `products/{pid}` lấy giá & tồn kho theo `màu|size`, tính phí ship từ `settings/public`, kiểm voucher + tăng `used` trong transaction, ghi `orders` với `status` phù hợp. Rules: `match /orders/{id} { allow create: if false; … }`. Tạm thời ít nhất:
```
allow create: if signedIn() && request.resource.data.uid == me()
  && request.resource.data.status in ['pending','awaiting_payment']
  && !request.resource.data.keys().hasAny(['paid','history','confirmedAt','refund'])
  && request.resource.data.items is list && request.resource.data.items.size() <= 20 && request.resource.data.total is int && request.resource.data.total >= 0;
```

### QS-09 — Tự cấp điểm thử thách (TB)
**Sửa:** lưu `endAt` (timestamp) trong thử thách, rules `request.time <= get(…/challenges/$(id)).data.endAt`; giới hạn mức tăng mỗi lần `request.resource.data.value - resource.data.get('value', 0) <= get(…).data.dailyCap`; tiến độ lấy từ nhật ký tập đã đồng bộ (Function tính) thay vì số tự khai; màn "Chốt & trao quà" hiện cảnh báo khi điểm vượt `target` bất thường.

### QS-10 — Xoá tài khoản chưa đủ (Cao — store)
**Sửa:** mở rộng `cleanupUserData` (`functions/index.js:88`):
```js
const cg = (col, f, v)=> db.collectionGroup(col).where(f, "==", v).get();
for(const s of [await db.collection("routines").where("authorUid","==",uid).get()]) for(const d of s.docs) await db.recursiveDelete(d.ref);
for(const col of ["likes","saves","copies","mlikes"]) (await db.collectionGroup(col).where(admin.firestore.FieldPath.documentId(), "==", uid).get()).docs.forEach(d=> writer.delete(d.ref)); // hoặc theo trường uid
for(const [col, f] of [["regs","uid"],["entries","uid"],["reviews","uid"],["requests","uid"],["mcomments","uid"],["messages","from"]]) (await cg(col, f, uid)).docs.forEach(d=> writer.delete(d.ref));
for(const col of ["support_tickets","reports"]) (await db.collection(col).where(col === "reports" ? "by" : "uid", "==", uid).get()).docs.forEach(d=> writer.delete(d.ref));
// orders / gifts: ẩn danh hoá (xoá address, phone, name) — giữ số tiền cho kế toán, NÊU RÕ trong privacy policy (thời hạn lưu)
await admin.storage().bucket().deleteFiles({ prefix: `media/moments/` /* lọc theo /${uid}/ */ });
if(user.email) (await db.collection("invites").where("email","==",user.email.toLowerCase()).get()).docs.forEach(d=> writer.delete(d.ref));
```
Cập nhật `privacy-policy.html` §3 (thêm: cộng đồng, Tìm PT, sự kiện, cửa hàng, chat & ảnh, đội ngũ quản trị xem được email/SĐT khi có quyền), §9–10 (dữ liệu nào xoá, dữ liệu nào ẩn danh & giữ bao lâu) và danh sách trong `delete-account.html`; áp diff C2 (thu hồi token Apple) vào `delete-account.html`.

### QS-11 — Nội dung nhân sự cấp thấp → Owner (TB)
**Sửa:** `events.js:927` `min="${escAttr(ch.start)}" max="${escAttr(max)}"`; rules thử thách/sự kiện kiểm `start.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')`, `end` tương tự. Nguyên tắc: nội dung do **nhân sự** nhập cũng là dữ liệu không tin cậy (RBAC.md §10 đã có "nhân sự tự nâng quyền").

### QS-12 — Giả danh trong chat / yêu cầu / buổi tập (TB)
**Sửa:**
```
// clients/{cid}/messages: bỏ 'system' (chỉ Function ghi), không nhận 'name'
&& request.resource.data.kind in ['text','image','log']
&& request.resource.data.keys().hasOnly(['from','role','kind','text','img','ts'])
// ptListings/{lid}/requests: msgs chỉ được NỐI THÊM 1 tin của chính mình
function appended() { let o = resource.data.msgs; let n = request.resource.data.msgs;
  return n.size() == o.size() + 1 && n[0:o.size()] == o && n[o.size()].from == me()
    && n[o.size()].role == (me() == lid ? 'pt' : 'student'); }        // khi đủ 30 tin: so n[0:29] == o[1:30]
```
UI lấy tên người gửi từ form (`c.ptName`/`c.studentName`), không từ tin nhắn. Buổi tập: xem rules ở QS-04.

### QS-13 — Khoá / hạ quyền không tức thì (TB)
**Sửa:** `banUser` (`functions/admin.js:304-306`) thêm `await db().collection("roles").doc(uid).set({ suspended: true }, { merge: true })` (hoặc xoá vai trò, ghi lại để mở khoá khôi phục) + `setClaims(uid, null)`. Rules:
```
function staffFresh() { return exists(roleDocPath()) && get(roleDocPath()).data.role == tokenRole()
  && get(roleDocPath()).data.get('px', []) == tokenPx() && get(roleDocPath()).data.get('suspended', false) == false; }
function notBanned() { return !exists(/databases/$(database)/documents/bans/$(request.auth.uid))
  || get(/databases/$(database)/documents/bans/$(request.auth.uid)).data.liftedAt != null; }
// thêm notBanned() vào create/update của routines, reviews, messages, mcomments, orders, requests, entries
```
`storage.rules` `fresh()` thêm điều kiện tương tự.

### QS-14 — Chiếm form chưa kết nối / lời mời email chưa xác minh (TB)
**Sửa:**
```
// clients update — học viên phải trình đúng mã
|| (resource.data.studentUid == null && request.resource.data.studentUid == me()
    && request.resource.data.joinProof == resource.data.joinCode
    && onlyKeys(['studentUid','studentName','studentEmail','joinProof','updatedAt']))
// lời mời theo email
function myEmail() { return request.auth.token.get('email_verified', false) == true && request.auth.token.get('email', null) != null
  ? request.auth.token.email.lower() : ''; }
```
Mã mời 8–10 ký tự + Firebase App Check để hạn chế dò `joinCodes/{code}`.

### QS-15 — Audit (Thấp)
**Sửa:** `verifyAudit` (Firebase) tính lại `sha256(prev + "|" + canonical({seq, prev, actorUid, actorRole, action, target, details, ts}))` như `chainOne`, so bản cuối với `admin_audit_meta/head` (phát hiện cắt đuôi), phân trang qua 2 000; rules giới hạn `action` client được ghi theo danh sách (`admin.login`, `admin.logout`, `admin.login_failed`, `data.export`, `user.pii_list`…) — hành động nhạy cảm chỉ Functions ghi; `appendAudit` bỏ nhận `entry.actor` từ người gọi. Bản demo: ghi rõ "chuỗi băm không chống được người sửa localStorage".

### QS-16 — Chế độ demo & bảng quản trị ẩn (TB — store)
**Sửa:** bản store **bắt buộc** có Firebase (thêm kiểm tra trong `prepare-www.sh`: `apiKey` rỗng → `exit 1`); khi `cloud.mode === "demo"` trên native: không nạp `admin.js`/`cloud-admin.js`, bỏ 7 lần chạm và `#admin`; xoá `BOOT_DEFAULT` khỏi mã (chỉ nhận `TAPEASY_ADMIN_CONFIG.bootstrapHash`); demo social cũng phải nhập lại mật khẩu demo.

### QS-17 → QS-22 (Thấp)
- **QS-17:** chuyển `phone` của PT sang `ptListings` (chỉ khi `showPhone`) hoặc `clients/{cid}` riêng cho học viên đã kết nối; `users/{uid}` công khai chỉ giữ `name`, `brandName`, `photo`, `isPT`.
- **QS-18:** `const isRole = r=> typeof r === "string" && Object.prototype.hasOwnProperty.call(ROLES, r);` dùng trong `level`, `permsOf`, `checkAssign` (`!isRole(newRole)` → `bad-role`), `actorOf`, `targetOf` (rbac.js + functions/admin.js); hoặc `ROLES = Object.create(null)`.
- **QS-19:** `commentCount` ±1 phải kèm `existsAfter/!exists` của `mcomments/{cid}` như `likeCount`; `reported == (reportCount >= ngưỡng)`; tự ẩn routine cần báo cáo từ tài khoản ≥ 7 ngày tuổi hoặc chờ kiểm duyệt.
- **QS-20:** `app.js:1798` thêm `if(/^\/\//.test(s)) return "";`; `safeImg` chỉ nhận host trong danh sách (Firebase Storage, `images.pexels.com`, `assets/`).
- **QS-21:** `delete-account.html` gọi callable `deleteMyAccount` (từ chối nếu `roles/{uid}.role == "owner"`, thu hồi Apple, rồi `admin.auth().deleteUser`); `cleanupDeletedUser`: nếu là Owner → không xoá `roles_meta`, ghi audit `owner.deleted` + cảnh báo.
- **QS-22:** thêm CSP ở `index.html` (`script-src 'self' https://www.gstatic.com https://accounts.google.com https://cdnjs.cloudflare.com; object-src 'none'; base-uri 'none'`) sau khi bỏ dần `onclick` nội tuyến (coach.js, pt.js, ptprofile.js…); đổi `openSheet`/`confirmDialog` sang API nhận chuỗi chữ mặc định.

---

## 5. Tuân thủ App Store / Google Play — rủi ro bị từ chối

| Hạng mục | Hiện trạng (mã nguồn 11/11/2026) | Rủi ro | Việc cần làm |
|---|---|---|---|
| Play **target API** | `package.json` Capacitor `^6.1.2` (target 34); workflow `build-android.yml` không đặt `targetSdkVersion` | **CHẶN** upload | Capacitor 8 / `targetSdkVersion = compileSdkVersion = 36`, JDK 21, kiểm edge-to-edge (STORE-COMPLIANCE 0.1) |
| **4.8 Sign in with Apple** | Nút có; thiếu plugin `@capacitor-firebase/authentication` trong `package.json` và entitlement `com.apple.developer.applesignin` trong `ios-appstore.yml` | **CHẶN** (2.1 nút hỏng) | Cài plugin + entitlement, hoặc ẩn nút social trên native |
| **5.1.1(v) xoá tài khoản** | Có trong app + `delete-account.html`; nhưng **dữ liệu liên quan còn sót** (QS-10), trang web chưa thu hồi token Apple, Owner xoá được qua web (QS-21) | **Cao** (Apple yêu cầu xoá cả dữ liệu gắn với tài khoản; Play "Data deletion" phải đúng mô tả) | Sửa QS-10/QS-21, cập nhật danh sách dữ liệu bị xoá/giữ lại ở 2 trang |
| Play **Account deletion URL** | `…/delete-account.html` — chỉ chạy khi `firebase-config.js` có giá trị (hiện trống → "chế độ demo") | **CHẶN** khi điền form | Cấu hình Firebase trước khi nộp URL |
| Play **Data safety** / App Store **App Privacy** | Bảng trong STORE-COMPLIANCE §1–2 viết trước vòng 2–3: ghi *Location, Financial: Không*, không có địa chỉ, tin nhắn ảnh, ảnh/video công khai, đánh giá công khai | **Cao** (khai sai = vi phạm chính sách *User Data*; Apple có thể yêu cầu sửa nhãn) | Thêm: Personal info → **Address** (giao hàng), **Phone** (đơn hàng, đăng ký sự kiện, **liên hệ khẩn cấp**); Financial info → **Purchase history**; Messages → in-app messages **+ ảnh**; Photos/Videos (Khoảnh khắc, đánh giá, album niêm yết — **công khai**); App activity → other UGC (routine, đánh giá, bình luận công khai); nếu bật FCM → Device IDs. Đánh dấu dữ liệu nào **công khai** |
| **Privacy policy** | Còn placeholder `[ĐIỀN EMAIL HỖ TRỢ]`, `[ĐIỀN TÊN NHÀ PHÁT TRIỂN]`; §3 chỉ mô tả tài khoản + PT↔học viên — thiếu Cộng đồng, Tìm PT, Sự kiện, Cửa hàng, chat, Firebase Storage, đội ngũ quản trị (vai trò `users.pii` xem email/SĐT, audit) | **CHẶN** (placeholder) / **Cao** (thiếu loại dữ liệu) | Điền thông tin; thêm mục cho từng tính năng mới, thời hạn lưu đơn hàng (kế toán), ai trong đội ngũ xem được gì |
| **1.2 Nội dung người dùng tạo** | Có báo cáo (routine, đánh giá, Khoảnh khắc), lọc từ ngữ, hàng đợi kiểm duyệt; **không có chặn người dùng** (block) trong chat/cộng đồng/bình luận | **TB** | Thêm "Chặn người này" (ẩn nội dung + ngừng tin nhắn), nêu rõ cam kết xử lý báo cáo trong 24 giờ trong Điều khoản |
| **2.3.1 tính năng ẩn** | Bảng quản trị mở bằng 7 lần chạm dòng phiên bản hoặc `#admin`; ở chế độ demo ai cũng khởi tạo Owner bằng mã công khai (QS-16) | **TB** | Ghi rõ trong *App Review Notes* (tài khoản demo nhân sự) hoặc loại bảng quản trị khỏi bản native (quản trị qua web); bắt buộc Firebase |
| **Health apps declaration** (Play) | STORE-COMPLIANCE §2.3 đã soạn (Activity & fitness, Nutrition & weight, Sleep; không SaMD) | Thấp | Điền form; thêm câu "không phải thiết bị y tế" vào mô tả |
| **5.1.2(i)** AI bên thứ ba | Đã nêu ở STORE-COMPLIANCE mục 7 (chưa có hộp đồng ý) | TB | Như STORE-COMPLIANCE |
| Chuỗi mô tả quyền iOS | `NSCameraUsageDescription`, `NSPhotoLibrary…` trong workflow vẫn ghi **"FIT KIT"** | Thấp (2.3.7/5.1.1 — tên không khớp app) | Đổi thành "TapEasy …" |
| Bảo mật dữ liệu ↔ cam kết | Privacy §9: "mỗi form chỉ PT tạo ra và học viên đã nhập đúng mã mời mới truy cập được" — **sai** do QS-02/QS-14 | **Cao** (tuyên bố sai về bảo mật) | Sửa rules (QS-02, QS-14) trước khi nộp |

---

## 6. Chấm điểm (/10)

| Hạng mục | Trọng số | Điểm | Ghi chú |
|---|:-:|:-:|---|
| Lõi RBAC (ma trận, chống leo thang, Owner, Functions) | 25 % | 8,5 | Vét cạn sạch; trừ QS-18, QS-13 |
| Firestore / Storage rules | 25 % | 5,0 | 25/109 ca tấn công thành công; nền tảng tốt (users, audit, PII) |
| XSS | 20 % | 3,5 | 13 điểm chèn dữ liệu người khác, 2 điểm chạy trong phiên Owner, 1 điểm không cần bấm |
| Phiên quản trị / step-up / audit | 10 % | 4,5 | Thiết kế client tốt nhưng máy chủ không áp dụng (QS-05, QS-15) |
| Xoá tài khoản & quyền riêng tư | 10 % | 4,0 | QS-10, QS-17, QS-21, privacy policy lệch |
| Sẵn sàng store | 10 % | 3,0 | 4 mục CHẶN còn mở + Data safety lỗi thời |
| **Tổng** | | **≈ 5,0** | Sửa QS-01→QS-06 + QS-10 + 4 mục CHẶN → ước tính 8/10 |

**Thứ tự sửa đề xuất:** (1) QS-02 `qData` id + rules `clients` create; (2) QS-01/QS-06/QS-03/QS-04/QS-11 escape + chuẩn hoá khi nhập; (3) QS-05 `authAge()` trong rules + callable đổi STK; (4) QS-10 + privacy/Data safety; (5) QS-08 Function đặt hàng; (6) QS-13/QS-14/QS-12/QS-07/QS-09; (7) thấp.

## 7. Tệp kết quả (`outputs/_test/qa-security/`)
`rbac-attack.test.js` → `rbac-attack-result.txt/.json` · `rules-engine.js` + `rules-attack.test.js` → `rules-attack-result.json` · `xss-ast-scan.js` → `xss-scan-result.json`, `xss-scan-summary.txt` · `t_qa_security.js` + `qa-security.html` (bản ghép) → `browser-xss-result.txt`, `shots/qs01-award-confirm-owner.png`, `shots/qs02-coach-forced-link-alice.png`, `shots/qs03-home-after-copy-alice.png`.
Giới hạn: chưa chạy Firebase Emulator (không có mạng cài `firebase-tools`) — bộ thông dịch mini không mô phỏng giới hạn 10 lần `get()`/truy vấn `list` theo `where`; nên chạy lại `rules-attack.test.js` trên emulator trước khi publish rules.

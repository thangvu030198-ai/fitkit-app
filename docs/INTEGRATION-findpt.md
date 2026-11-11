# Tích hợp TÌM PT — album PT công khai, bộ lọc, đánh giá & phản hồi

Yêu cầu chủ app: *"ấn vào Tìm PT thì có phần ALBUM (ảnh + thông tin cơ bản, mẫu travel-journal); chi tiết ấn vào ra hồ sơ PT đã làm; bộ lọc khu vực, địa điểm, giá tiền, giới tính; tất cả công khai minh bạch; trong profile mỗi người đều có phần đánh giá và phản hồi."*

Chỉ thêm file mới, không sửa file có sẵn:

| File | Vai trò |
|---|---|
| `cloud-pt-directory.js` | `cloud.ptdir`: niêm yết PT, đánh giá, báo cáo, kiểm duyệt, yêu cầu (buổi thử / kết nối / câu hỏi), nhận xét riêng tư PT→học viên. Động cơ demo (localStorage `tapeasy_ptdir_demo_v1`) + Firebase. Kèm 34 tỉnh/thành mới (phường/xã tiêu biểu), 20 PT minh hoạ, 79 đánh giá mẫu. |
| `findpt.js` | Giao diện: màn album `#screen-findpt`, bộ lọc / sắp xếp / khu vực, phần mở rộng trang hồ sơ PT (ptprofile.js), đánh giá, đặt buổi thử, kết nối, hộp yêu cầu PT, trình soạn niêm yết, thẻ nhận xét riêng tư trong form học viên, điểm vào. `window.TE_FINDPT` (= `TEFindPT`). |
| `findpt.css` | Kiểu riêng (tiền tố `.fp-`). Album & hồ sơ luôn tối (`.fk-dark-island`) ở mọi theme, sheet dùng token theme. |
| `tests/suites/40-findpt.test.js` | 9 test Node (logic, quyền, minh bạch, XSS, render). |

## 1. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="health-safety.css">
+  <link rel="stylesheet" href="findpt.css">        <!-- cạnh CSS module khác, TRƯỚC brand.css / themes-modules.css -->
   <link rel="stylesheet" href="brand.css">
 ...
   <script src="pt-pro.js"></script>
   <script src="cloud-social.js"></script>
   <script src="pt-connect.js"></script>
   <script src="community.js"></script>
+  <script src="cloud-pt-directory.js"></script>   <!-- SAU cloud-social (dùng bộ lọc từ ngữ thô tục) -->
+  <script src="findpt.js"></script>               <!-- SAU pt-connect / community; TRƯỚC cloud-admin.js / admin.js nếu có -->
   <script src="achievements.js"></script>
```
- Bắt buộc có trước: `ptprofile.js`, `pt.js` (dùng `openPTProfile`, `renderPTProfile`, `teHomeExplore`, `openFindPTSoon`). `cloud-social.js`/`pt-connect.js` tuỳ chọn (lọc từ ngữ, nút "Nhắn tin" mở chat PT Connect khi đã kết nối). `rbac.js` (teCan) + `cloud-admin.js`/`admin.js` tuỳ chọn — có thì tự nối (xem §5).
- `sw.js`: thêm `findpt.css`, `cloud-pt-directory.js`, `findpt.js` vào `ASSETS`, tăng tên cache. `scripts/prepare-www.sh`: thêm 3 file vào lệnh `cp`.
- `themes-modules.css`: không bắt buộc (album/hồ sơ luôn tối; sheet dùng `var(--text)`, `var(--surface…)`). Muốn đồng bộ thêm: `python3 scripts/gen_themes_layer.py --modules … findpt.css`.
- Tuỳ chọn (đặt trước `cloud-pt-directory.js`):
```html
<script>window.TAPEASY_FINDPT_CONFIG = { samples: "auto" };  // "auto" (mặc định): hồ sơ minh hoạ CHỈ hiện ở bản demo; true / false để ép</script>
```
  **Bản thật (Firebase) mặc định không hiện 20 hồ sơ minh hoạ** — tránh đưa PT giả lẫn với PT thật (yêu cầu minh bạch). Ở demo, album có dòng "Bản thử nghiệm: hồ sơ minh hoạ", hồ sơ có nhãn "Hồ sơ minh hoạ", trả lời tự động ghi rõ "(Trả lời tự động · hồ sơ minh hoạ)".

## 2. Hành vi & điểm vào

- **Trang chủ:** ô "Tìm PT" trong hàng Khám phá (`teHomeExplore.add({ id:"findpt", priority:88 })` thay ô "Sắp ra mắt"); bản pt.js cũ không có `teHomeExplore` → sửa nhãn ô `entry-tile`. `openFindPTSoon()` được ghi đè → mở album (ô trên Trang chủ, thẻ trong màn PT, mọi chỗ gọi cũ).
- **Menu ☰:** mục "Tìm PT" (sau "Cộng đồng"/"TapEasy PT").
- **Màn PT:** học viên **chưa có PT** → thẻ "Chưa có PT? Album PT công khai" ở đầu tab; PT → thẻ "Hồ sơ Tìm PT" (trạng thái, ★, tỉ lệ phản hồi, **Niêm yết hồ sơ Tìm PT** / Sửa, **Yêu cầu** + số chờ, Xem như học viên) thay thẻ "Hồ sơ công khai & nhận book — Sắp ra mắt".
- **Vai trò "Tìm & Book PT"** khi đăng ký: bỏ nhãn Sắp ra mắt; chọn → vào app như "Tập cá nhân" rồi mở album.
- **Liên kết:** `…/index.html?pt=<id>` mở thẳng hồ sơ (nút Chia sẻ tạo link này) · `#findpt` mở album. Bảng quản trị: `TE_ADMIN` nút "Mở Tìm PT" gọi `TE_FINDPT.open()`.
- **Nút Back Android / Esc:** đóng trình xem ảnh → hồ sơ về album (giữ vị trí cuộn) → album về màn trước.

### Album (kiểu tạp chí du lịch)
Học từ mẫu *travel-journal* (chỉ phong cách): thẻ ảnh tràn, bo 24 px, **tên cỡ lớn chồng lên ảnh, bị mép dưới cắt** như tiêu đề tạp chí, viên kính góc trên (★ điểm · số đánh giá), nút tim, chọn vùng kiểu "Toàn quốc ▾", thanh công cụ kính nổi ở đáy. Nhịp lưới bất đối xứng lặp: **ảnh lớn 4:5 → cặp lệch (cao | thấp, so le 56 px) → ảnh ngang → cặp đảo**; chen ô "Bảng giá công khai" (giá từ/buổi trung bình theo tỉnh, chạm để lọc) và ô "Minh bạch". Hiệu ứng: thẻ trượt lên + mở dần từ dưới (clip-path) + ảnh thu từ 1,14 → 1,03 + tên lớn trồi lên, so le 110 ms; parallax nhẹ ±14 px khi cuộn (chỉ `transform`); tiêu đề "Tìm / PT." trồi theo dòng. Tắt hết với `prefers-reduced-motion` / `html.lowfx`.

### Bộ lọc
Tìm **không dấu** (tên, thương hiệu, chuyên môn, phòng tập, phường, tỉnh, chứng chỉ, ngôn ngữ) · **Khu vực**: 34 tỉnh/thành mới (nhóm theo miền, ghi tỉnh sáp nhập) → phường/xã (tiêu biểu + nơi đang có PT) · **Địa điểm**: phòng tập / tại nhà / online / ngoài trời + **tên phòng tập** (gợi ý) · **Giá mỗi buổi**: thanh trượt 2 đầu 0–1,5 tr (bước 50k) + biểu đồ phân bố giá; so với buổi lẻ, gói 12/24 (chia đều), online · **Giới tính** · **Chuyên môn** (nhiều) · **Đánh giá tối thiểu** · **Chỉ PT đã xác minh** · **Ngôn ngữ**. Nút áp dụng đếm trực tiếp "Xem N PT". Lọc nhanh bằng chip; "Đã lưu" (tim). Sắp xếp: Phù hợp · Giá ↑ / ↓ · Đánh giá cao (Bayes) · Nhiều đánh giá · Phản hồi nhanh · Mới tham gia.

### Hồ sơ PT
Mở **trang hồ sơ F1 hero đã có** (`renderPTProfile`) rồi gắn thêm: huy hiệu (Đã xác minh / ★ / Hồ sơ minh hoạ), thẻ "Liên hệ" → Chat, thẻ thứ 2 → "Giá từ", logo TapEasy; phần mở rộng: chip minh bạch · **Album** (cuộn ngang, xem toàn màn, tên tác giả) · **Bảng giá công khai** (buổi lẻ, gói 12/24 + giá/buổi + % tiết kiệm, online, buổi thử, chính sách huỷ, ngày cập nhật giá, "TapEasy không cộng phí") · **Khu vực & địa điểm** · **Lịch trống** 7 ngày × 4 khung · **Chứng chỉ** (ảnh, trạng thái đối chiếu) · **Thông tin minh bạch** (tỉ lệ & thời gian phản hồi, học viên, buổi đã dạy, ngày cập nhật, báo cáo hồ sơ, công cụ quản trị) · **Đánh giá & phản hồi** · thanh nổi **Nhắn tin · Đặt buổi thử · Kết nối** (PT xem hồ sơ mình: Sửa niêm yết · Yêu cầu học viên). Cuộn đổi `scroll-snap` sang `proximity` (lớp `#app-scroll.fp-prox`) để đọc phần dài.
Hồ sơ PT **thật** mở từ màn PT (`openPTProfile(uid, cid)`) cũng được gắn phần mở rộng (nếu PT đã niêm yết) hoặc ít nhất phần **Đánh giá & phản hồi**.

### Đánh giá & phản hồi
- Điểm tổng = trung bình cộng đánh giá **đang hiển thị** (1 chữ số), phân bố 5→1★ (chạm để lọc), 4 tiêu chí **Chuyên môn · Đúng giờ · Thái độ · Hiệu quả**, lọc Có ảnh / ≤3★ / PT đã trả lời, sắp xếp mới / thấp / cao.
- **Chỉ người "Đã tập cùng"**: form PT↔học viên có ≥ 1 buổi `status:"done"` (nhãn "Đã tập cùng · N buổi") hoặc buổi thử PT bấm "Xác nhận đã tập" (nhãn "Đã tập buổi thử"). 1 đánh giá / người / PT (sửa được, ghi "đã sửa"); tên rút gọn "Long H."; 20–1500 ký tự, ≤ 3 ảnh (nén 900 px), chặn từ thô tục, chặn số điện thoại/email.
- **PT trả lời công khai, không xoá / không ẩn được** (API không có hàm xoá đánh giá của người khác; rules chặn).
- **Báo cáo** 6 lý do, 1 lần/người, **không tự ẩn** (tránh bị lợi dụng hạ PT/đánh giá). Gửi kèm vào hàng đợi chung `cloudAdmin.report("review", …)` nếu có.
- **Kiểm duyệt** `teCan("reviews.moderate")`: Ẩn (bắt buộc lý do — **hiển thị công khai** tại chỗ đánh giá, không tính điểm, đếm "1 đánh giá đã bị kiểm duyệt ẩn") · Khôi phục · Giữ nguyên. Ghi `TE_RBAC.audit` nếu có.
- Hồ sơ học viên: **nhận xét 2 chiều PT ↔ học viên, mặc định RIÊNG TƯ** (thẻ trong tab Thông tin của form học viên): PT chấm Chuyên cần · Nỗ lực · Trao đổi + lời nhận xét; học viên đọc, phản hồi, tự bật "Cho phép đính kèm tóm tắt điểm" khi gửi lời mời kết nối PT mới (chỉ điểm, không kèm lời). Lý do riêng tư (hiện trong app, "Vì sao riêng tư?"): dữ liệu gắn với sức khoẻ/cơ thể (NĐ 13/2023), cán cân quyền lực PT–học viên dễ dẫn tới kỳ thị, riêng tư giúp góp ý thẳng thắn.

### Yêu cầu & liên hệ
- **Nhắn tin**: đã kết nối → mở tab Chat PT Connect; chưa → "câu hỏi" gửi PT (trả lời hiện trong "Yêu cầu của tôi").
- **Đặt buổi thử**: 14 ngày tới, giờ gợi ý theo lịch trống, địa điểm, mục tiêu, lời nhắn; giá buổi thử hiển thị; PT: Nhận lịch / Từ chối / **Xác nhận đã tập** (mở quyền đánh giá).
- **Lời mời kết nối**: kèm mục tiêu, (tuỳ chọn) email để PT gửi lời mời trong app, (tuỳ chọn) thẻ học viên. PT **Chấp nhận & tạo form** → `cloud.createClient` + `cloud.social.sendInvite` (nếu có email) + tin nhắn chứa mã 6 ký tự.
- Chặn trùng yêu cầu đang chờ, ≤ 5 yêu cầu/24 giờ/PT, chặn số điện thoại trong câu hỏi trước khi PT nhận. **Tỉ lệ phản hồi** = yêu cầu PT trả lời trong 24 giờ ÷ tổng yêu cầu 90 ngày (≥ 3 yêu cầu mới công bố).

### Niêm yết (khu TapEasy PT)
Trình soạn trong sheet: ảnh bìa + album 3–9 (nén 720 px demo / 960 px Firebase, "Làm bìa"), tên, thương hiệu, giới tính, năm kinh nghiệm, ≤ 6 chuyên môn, giới thiệu ≤ 800, ngôn ngữ, tỉnh/thành → phường (gợi ý) + tên gọi quen, ≤ 6 địa điểm, bảng giá (giá/buổi & % tiết kiệm tự tính), buổi thử miễn phí / có phí / không nhận, chính sách huỷ (Linh hoạt / Tiêu chuẩn / Chặt) + ghi chú, lịch trống (7 ngày × 4 khung, ô ≥ 44 px), ≤ 6 chứng chỉ (ảnh, số hiệu), hiện số điện thoại (mặc định tắt). **Lưu nháp** (cho phép thiếu) / **Đăng công khai** (kiểm tra đủ) / Xem hồ sơ / Gỡ niêm yết / Gửi yêu cầu xác minh (`cloudAdmin.requestVerify`). PT **không** tự đặt được `verified`, điểm, số đánh giá, tỉ lệ phản hồi (API bỏ qua; rules chặn).

### Trạng thái cục bộ
`state.findpt = { f:{q, prov, ward, place, gym, priceMin, priceMax, gender, specs[], minRating, verified, langs[]}, sort, saved[], prov, onlySaved, seenReq, rvSort }`. Vai trò "find" dùng cờ tạm `state._fpOpenAfterBoot`.

## 3. Firestore rules (gộp vào bộ rules vòng 2 / INTEGRATION-admin.md)

Dùng `hasPerm()` của RBAC (INTEGRATION-admin.md). Chưa triển khai RBAC thì thay `hasPerm('x')` bằng `request.auth.token.admin == true`.

```
    // ===== TÌM PT (cloud-pt-directory.js) =====
    match /ptListings/{lid} {
      function isOwner() { return signedIn() && me() == lid; }               // 1 niêm yết / PT, id = uid
      function lockedKeys() { return ['verified', 'verifiedAt', 'verifiedBy', 'verifyNote',
                                      'hidden', 'hiddenReason', 'hiddenBy', 'hiddenAt',
                                      'ratingAvg', 'ratingCount', 'ratingDist', 'criteriaAvg', 'reviewHidden',
                                      'respRate', 'respMins', 'respN']; }
      function validListing(d) {
        return d.uid == lid && d.name is string && d.name.size() >= 2 && d.name.size() <= 60
          && d.status in ['public', 'draft'] && d.bio is string && d.bio.size() <= 800
          && (d.status == 'draft' || (
               d.gender in ['male', 'female'] && d.specs is list && d.specs.size() >= 1 && d.specs.size() <= 6
            && d.prices is map && d.prices.single is int && d.prices.single >= 50000 && d.prices.single <= 5000000
            && d.album is list && d.album.size() >= 3 && d.album.size() <= 9
            && d.places is list && d.places.size() >= 1 && d.places.size() <= 6
            && d.cancel in ['flex', 'moderate', 'strict']));
      }
      // Ai cũng xem được niêm yết công khai (kể cả chưa đăng nhập) — truy vấn phải có where status=='public' & hidden==false
      allow get, list: if (resource.data.status == 'public' && resource.data.hidden == false)
                       || isOwner() || hasPerm('listings.moderate') || hasPerm('pt.verify');
      allow create: if isOwner() && validListing(request.resource.data)
                    && request.resource.data.hidden == false && request.resource.data.verified == false
                    && !request.resource.data.keys().hasAny(lockedKeys().removeAll(['hidden', 'verified']));
      allow update: if (isOwner() && validListing(request.resource.data)
                        && !request.resource.data.diff(resource.data).affectedKeys().hasAny(lockedKeys()))
                    || (hasPerm('pt.verify') && onlyKeys(['verified', 'verifiedAt', 'verifiedBy', 'verifyNote']))
                    || (hasPerm('listings.moderate') && onlyKeys(['hidden', 'hiddenReason', 'hiddenBy', 'hiddenAt']));
      allow delete: if isOwner();

      // Đánh giá: id = uid người viết (1 đánh giá / người / PT). CÔNG KHAI.
      match /reviews/{ruid} {
        function trained(d) {
          return (d.basis.type == 'client'
                   && get(/databases/$(database)/documents/clients/$(d.basis.id)).data.ptId == lid
                   && get(/databases/$(database)/documents/clients/$(d.basis.id)).data.studentUid == me())
              || (d.basis.type == 'trial'
                   && get(/databases/$(database)/documents/ptListings/$(lid)/requests/$(d.basis.id)).data.uid == me()
                   && get(/databases/$(database)/documents/ptListings/$(lid)/requests/$(d.basis.id)).data.status == 'done');
        }
        function validReview(d) {
          return d.uid == me() && d.stars is int && d.stars >= 1 && d.stars <= 5
            && d.criteria.keys().hasOnly(['expertise', 'punctual', 'attitude', 'results'])
            && d.criteria.expertise >= 1 && d.criteria.expertise <= 5 && d.criteria.punctual >= 1 && d.criteria.punctual <= 5
            && d.criteria.attitude >= 1 && d.criteria.attitude <= 5 && d.criteria.results >= 1 && d.criteria.results <= 5
            && d.text is string && d.text.size() >= 20 && d.text.size() <= 1500
            && d.photos is list && d.photos.size() <= 3;
        }
        function modKeys() { return ['hidden', 'hiddenReason', 'modBy', 'modAt', 'flagged', 'modNote']; }
        allow read: if true;
        allow create: if signedIn() && ruid == me() && me() != lid && validReview(request.resource.data) && trained(request.resource.data)
                      && request.resource.data.reply == null && request.resource.data.hidden == false
                      && request.resource.data.reports == 0 && request.resource.data.flagged == false;
        allow update: if (signedIn() && ruid == me() && resource.data.hidden == false && validReview(request.resource.data)
                          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['reply', 'reports', 'createdAt', 'basis'].concat(modKeys())))
                      || (signedIn() && me() == lid && onlyKeys(['reply'])                              // PT chỉ trả lời
                          && request.resource.data.reply.by == me() && request.resource.data.reply.text is string
                          && request.resource.data.reply.text.size() <= 1000)
                      || (hasPerm('reviews.moderate') && onlyKeys(modKeys()))
                      || (signedIn() && onlyKeys(['reports', 'flagged'])                                  // +1 báo cáo kèm dấu của chính người đó
                          && request.resource.data.reports == resource.data.get('reports', 0) + 1 && request.resource.data.flagged == true
                          && !exists(/databases/$(database)/documents/ptListings/$(lid)/reviews/$(ruid)/reports/$(me()))
                          && existsAfter(/databases/$(database)/documents/ptListings/$(lid)/reviews/$(ruid)/reports/$(me())));
        allow delete: if signedIn() && ruid == me();                                                      // CHỈ người viết; PT không xoá được
        match /reports/{rid} {
          allow create: if signedIn() && rid == me() && request.resource.data.reason is string && request.resource.data.reason.size() <= 300;
          allow read: if signedIn() && (rid == me() || hasPerm('reviews.moderate'));
          allow update, delete: if false;
        }
      }

      // Yêu cầu buổi thử / kết nối / câu hỏi: chỉ người gửi và PT đọc
      match /requests/{qid} {
        allow create: if signedIn() && me() != lid && request.resource.data.uid == me()
                      && request.resource.data.status == 'pending' && request.resource.data.respondedAt == 0
                      && request.resource.data.kind in ['trial', 'connect', 'question']
                      && request.resource.data.msgs is list && request.resource.data.msgs.size() <= 1;
        allow read: if signedIn() && (resource.data.uid == me() || me() == lid);
        allow update: if signedIn() && request.resource.data.msgs.size() <= 30 && (
              (me() == lid && onlyKeys(['status', 'respondedAt', 'msgs', 'updatedAt', 'clientId'])
                 && request.resource.data.status in ['pending', 'accepted', 'declined', 'done'])
           || (resource.data.uid == me() && onlyKeys(['msgs', 'status', 'updatedAt'])
                 && request.resource.data.status in [resource.data.status, 'cancelled']));
        allow delete: if false;
      }
    }
    // "Yêu cầu của tôi" (collectionGroup) & hàng đợi kiểm duyệt
    match /{path=**}/requests/{qid} { allow read: if signedIn() && resource.data.uid == me(); }
    match /{path=**}/reviews/{ruid} { allow read: if true; }

    // Nhận xét PT → học viên: RIÊNG TƯ (thêm trong match /clients/{cid}, cạnh match /{sub}/{docId})
    match /clients/{cid}/feedback/{fid} {
      function pc() { return get(/databases/$(database)/documents/clients/$(cid)).data; }
      allow read: if signedIn() && (pc().ptId == me() || pc().studentUid == me());
      allow create: if signedIn() && fid == 'pt' && pc().ptId == me() && request.resource.data.by == me()
                    && request.resource.data.text.size() <= 1000;
      allow update: if signedIn() && fid == 'pt' && (
            (pc().ptId == me() && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['reply', 'shareable']))
         || (pc().studentUid == me() && onlyKeys(['reply', 'shareable'])));
      allow delete: if signedIn() && pc().ptId == me();
    }
```
Ghi chú rules:
- Rules không đếm được "≥ 1 buổi hoàn thành" trong subcollection → điều kiện `client` kiểm tra quan hệ PT↔học viên; app kiểm thêm buổi `done`. Muốn chặt tuyệt đối: Cloud Function ghi `clients/{cid}.doneCount` và rules đọc trường này.
- `users/{uid}.ptVerified` / `listingHidden` (cloud-admin.js) được đọc qua `cloudAdmin.ptStatus()` và hợp nhất với `ptListings.verified/hidden`.

### Chỉ mục (`firestore.indexes.json`)
```json
{ "fieldOverrides": [
  { "collectionGroup": "requests", "fieldPath": "uid",
    "indexes": [ { "order": "ASCENDING", "queryScope": "COLLECTION" }, { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" } ] },
  { "collectionGroup": "reviews", "fieldPath": "flagged",
    "indexes": [ { "order": "ASCENDING", "queryScope": "COLLECTION" }, { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" } ] }
] }
```
Truy vấn: `ptListings where status=='public' & hidden==false limit 400` (2 điều kiện bằng — không cần index ghép) · `ptListings where hidden==true` (quản trị) · `ptListings/{uid}/requests orderBy createdAt desc` · collectionGroup `requests where uid==` · collectionGroup `reviews where flagged==true`.

### Cloud Function tổng hợp điểm & tỉ lệ phản hồi (khuyến nghị)
Rules khoá các trường tổng hợp (PT không tự sửa). Ở Firebase cần function ghi chúng — nếu chưa có, album hiện "PT mới" cho tới khi function chạy; trang hồ sơ vẫn tính điểm trực tiếp từ đánh giá.
```js
// functions/index.js (Node 22, firebase-functions v2)
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin"); admin.initializeApp(); const db = admin.firestore();
exports.ptReviewAgg = onDocumentWritten({ document:"ptListings/{lid}/reviews/{ruid}", region:"asia-southeast1" }, async e=>{
  const lid = e.params.lid, snap = await db.collection(`ptListings/${lid}/reviews`).get();
  const all = snap.docs.map(d=> d.data()), vis = all.filter(r=> !r.hidden);
  const dist = {1:0,2:0,3:0,4:0,5:0}, K = ["expertise","punctual","attitude","results"], crit = {};
  vis.forEach(r=> dist[r.stars]++);
  K.forEach(k=> crit[k] = vis.length ? Math.round(vis.reduce((a,r)=> a + (r.criteria?.[k] || 0), 0) / vis.length * 10) / 10 : 0);
  const avg = vis.length ? Math.round(vis.reduce((a,r)=> a + r.stars, 0) / vis.length * 10) / 10 : 0;
  await db.doc(`ptListings/${lid}`).set({ ratingAvg:avg, ratingCount:vis.length, ratingDist:dist, criteriaAvg:crit, reviewHidden: all.length - vis.length }, { merge:true });
});
exports.ptRespAgg = onDocumentWritten({ document:"ptListings/{lid}/requests/{qid}", region:"asia-southeast1" }, async e=>{
  const lid = e.params.lid, since = Date.now() - 90*864e5;
  const qs = (await db.collection(`ptListings/${lid}/requests`).where("createdAt", ">", since).get()).docs.map(d=> d.data()).filter(q=> q.status !== "cancelled");
  const ok = qs.filter(q=> q.respondedAt && q.respondedAt - q.createdAt <= 864e5);
  await db.doc(`ptListings/${lid}`).set({ respN: qs.length, respRate: qs.length >= 3 ? Math.round(ok.length / qs.length * 100) : null,
    respMins: ok.length ? Math.round(ok.reduce((a,q)=> a + (q.respondedAt - q.createdAt) / 6e4, 0) / ok.length) : null }, { merge:true });
});
```
(Công thức giống hệt `cloud.ptdir.logic.aggregate` / `respStats` — dùng chung cho demo & kiểm thử.)

## 4. Ảnh & dung lượng
- Ảnh PT tải lên lưu **dataURL trong tài liệu niêm yết** (giới hạn ~900 KB/niêm yết, kiểm tra trước khi lưu, báo lỗi tiếng Việt). Khi có nhiều PT nên chuyển sang **Firebase Storage** (`ptListings/{uid}/album/*.jpg`) và chỉ lưu URL — trường `album[].src` đã nhận `https://`.
- 20 hồ sơ minh hoạ dùng ảnh Pexels (`images.pexels.com`, Pexels License, đã kiểm tra 127/127 URL trả 200) — tên tác giả ghi dưới từng ảnh, trong sheet "Nguồn ảnh minh hoạ" và mục "Nguồn dữ liệu & bản quyền". Người trong ảnh là người mẫu, không phải PT trong hồ sơ; không có ảnh người nổi tiếng. Tên phòng tập là tên minh hoạ.

## 5. Nối với phân quyền / bảng quản trị (nếu có `rbac.js`, `cloud-admin.js`, `admin.js`)
- Quyền: `pt.verify` (gắn/thu hồi Đã xác minh, gọi thêm `cloudAdmin.verifyPT` cho PT thật), `listings.moderate` (ẩn/hiện niêm yết, bắt buộc lý do, gọi `cloudAdmin.setListing`), `reviews.moderate` (ẩn/khôi phục/giữ đánh giá). Chỉ ẩn/hiện giao diện bằng `teCan()`; quyền ghi thật do rules.
- Tự đăng ký mục **"Tìm PT · đánh giá"** trong `TE_ADMIN.registerSection` (đánh giá bị báo cáo + danh sách niêm yết với nút Xác minh / Ẩn).
- Báo cáo đánh giá / hồ sơ cũng gửi vào `cloudAdmin.report("review" | "listing", …)` để hiện trong hàng đợi "Kiểm duyệt" chung.

## 6. Cách thử
```bash
cd FitKit
node -e "new Function(require('fs').readFileSync('cloud-pt-directory.js','utf8'))"; node -e "new Function(require('fs').readFileSync('findpt.js','utf8'))"
node tests/run.js --only findpt          # 9 test: dữ liệu mẫu, ảnh, lọc/sắp xếp, minh bạch điểm, điều kiện đánh giá, quyền PT/kiểm duyệt, niêm yết, nhận xét riêng tư, render + XSS
cd ../_test/findpt-kit
python3 build.py findpt-flow.html t_flow.js            # → _test/findpt-flow.html: 97 bước chạm thật, tự chạy (title "OK 97/97 ERR 0")
python3 build.py findpt-shot.html t_shot.js --skip=achievements.js   # cảnh chụp: ?stop=album|album2|album3|profile|price|price2|reviews|reviews2|filters|home|coach
```
Đã chạy: Chromium (Playwright, ngữ cảnh mới mỗi lần, 390 × 844): **97/97 PASS, 0 lỗi JS**; Node **9/9**; quét XSS tĩnh (06-security) không có mục mới từ findpt. Ảnh: `_test/shots/findpt-*.png` (album, album-strip, profile-strip, reviews-strip, entry-strip).

Thử tay (demo): Trang chủ → Khám phá → **Tìm PT** → lọc/sắp xếp → chạm thẻ → hồ sơ → **Đặt buổi thử** (cần tài khoản) → menu hộp thư (góc phải album) → chờ trả lời tự động → "Giả lập: buổi thử đã diễn ra" → **Viết đánh giá**. Tài khoản PT: Hồ sơ → bật Chế độ PT → màn PT → **Niêm yết hồ sơ Tìm PT**.

## 7. Giới hạn / việc tiếp theo
- Chưa có thanh toán/đặt cọc trong app (minh bạch: "thanh toán trực tiếp cho PT"); chưa có thông báo đẩy khi PT trả lời (hiện huy hiệu trong app). Cần Cloud Function → FCM.
- Phường/xã: danh sách tiêu biểu (≈ 200 / 3.321 đơn vị); PT gõ tên khác được, bộ lọc tự gom phường đang có PT. Nên nạp danh mục đầy đủ (Cục Thống kê, mã đơn vị mới) khi có.
- Chưa có bản đồ / khoảng cách (cần quyền vị trí + toạ độ phòng tập).
- Chính sách bảo mật nên bổ sung: "Niêm yết Tìm PT và đánh giá PT là công khai (tên người đánh giá được rút gọn). Khi gửi yêu cầu buổi thử / kết nối, PT nhận tên, mục tiêu, lời nhắn và email (nếu bạn đồng ý). Nhận xét PT về học viên là riêng tư."
- `docs/STORE-COMPLIANCE.md` mục 9 ("Sắp ra mắt" Tìm & Book PT): đã có tính năng thật → có thể đóng mục này sau khi tích hợp.

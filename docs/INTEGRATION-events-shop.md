# Tích hợp SỰ KIỆN · THI ĐUA · GIAN HÀNG (`cloud-events.js`, `events.js/.css`, `shop-data.js`, `shop.js/.css`, `assets/shop/`)

> **Cập nhật 11/2026 — TapEasy Store v2 (chuẩn giao diện thời trang quốc tế):** phần Gian hàng được làm lại hoàn toàn — xem **§9**. Các mục bên dưới đã sửa theo bản mới ở những chỗ liên quan tới Shop.
>
> **Cập nhật 11/2026 — Sự kiện bắt buộc ảnh/clip + nội dung** (yêu cầu chủ app: *"Các phần sự kiện đăng lên luôn phải kèm ảnh hoặc clip và nội dung"*): thêm `events-media.js` (`window.TapMedia`), tab **Khoảnh khắc**, phân quyền `teCan(...)` — xem **§10**. Các mục 1–8 đã sửa ở chỗ liên quan tới Sự kiện.

Đáp ứng mục **Sự kiện** trong `Muc_Su_Kien_App_Song_Khoe.md`: thi đua theo tháng (mục tiêu do nhà sáng lập đặt, tiến độ tự động, bảng xếp hạng tuần/tháng, huy hiệu, điểm, quà), sự kiện offline (đăng ký, vé QR, check-in, ảnh & review), gian hàng lưu niệm (giỏ hàng, COD / chuyển khoản), tặng quà thành viên tích cực, chế độ quản trị cho nhà sáng lập.
Không sửa file nào có sẵn — chỉ thêm file riêng (`cloud-events.js`, `events-media.js`, `events.js/.css`, `shop-data.js`, `shop.js/.css`) + tài liệu này.

## 1. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="achievements.css">
   <link rel="stylesheet" href="health-safety.css">
+  <link rel="stylesheet" href="events.css">
+  <link rel="stylesheet" href="shop.css">
   <link rel="stylesheet" href="themes-modules.css">  <!-- SAU CÙNG -->
 ...
   <script src="achievements.js"></script>
+  <script src="cloud-events.js"></script>   <!-- lớp dữ liệu (cần cloud.js) -->
+  <script src="events-media.js"></script>   <!-- MỚI: ảnh/clip bắt buộc — nén, IndexedDB/Storage, gallery, tự phát clip (window.TapMedia) -->
+  <script src="events.js"></script>         <!-- cần cloud-events.js (+ events-media.js); dùng FKAch nếu có -->
+  <script src="shop-data.js"></script>      <!-- danh mục mặc định (14 sản phẩm, bảng size, hero) — trước shop.js -->
+  <script src="shop.js"></script>           <!-- cần events.js -->
   <script src="health-safety.js"></script>   <!-- LUÔN CUỐI -->
```

- Thứ tự bắt buộc: `cloud-events.js` → `events-media.js` → `events.js` → `shop.js`, đặt **sau `pt.js`** (`index.html` hiện **còn thiếu dòng `events-media.js`** — thêm ngay sau `cloud-events.js`; thiếu file này app vẫn chạy nhưng form không thêm được ảnh/clip nên **không đăng được** sự kiện/thử thách/review mới) (nên sau `achievements.js` để dùng lại khung huy hiệu và cấp độ XP). Thiếu `achievements.js` vẫn chạy (khung huy hiệu dự phòng, quy tắc đếm buổi tương đương).
- `scripts/prepare-www.sh`: thêm `events.css shop.css` vào lệnh `cp` CSS, `cloud-events.js events-media.js events.js shop-data.js shop.js` vào lệnh `cp` JS module, và `mkdir -p www/assets/shop && cp assets/shop/*.webp www/assets/shop/` (**không** chép `assets/shop/_build/`). Cửa hàng còn dùng `assets/brand/logo-wordmark-dark.svg` (đã có trong danh sách brand).
- `sw.js`: thêm `shop-data.js` + 79 ảnh `assets/shop/*.webp` (hoặc để cache theo lượt xem — ảnh đã lazy-load) và tăng `CACHE`.
- Font (khuyến nghị): sửa link Google Fonts trong `index.html` thành `Inter+Tight:wght@300;400;500;600` (cửa hàng dùng Inter Tight 300/400). Nếu không sửa, `shop.js` tự chèn link font khi mở cửa hàng lần đầu (có mạng); offline thì rơi về Inter/Helvetica.
- Thiếu thẻ `shop-data.js` thì `shop.js` tự nạp `shop-data.js` (cùng thư mục) — vẫn chạy, chỉ chậm hơn một nhịp.
- `sw.js`: thêm 6 file (gồm `events-media.js`) vào `ASSETS` và tăng `CACHE`. **Không** cache ảnh/clip `images.pexels.com`, `videos.pexels.com`, `firebasestorage.googleapis.com` vào `ASSETS` (để trình duyệt cache HTTP; clip chỉ tải khi cuộn tới).
- (Tuỳ chọn) điền thông tin chuyển khoản **trước** `shop.js`:

```html
<script>
window.TAPEASY_SHOP_CONFIG = {
  bank: { bankName:"Vietcombank", bankBin:"970436", accountNo:"0011001234567", accountName:"CONG TY TAPEASY", branch:"" },
  shippingFee: 30000, freeShipFrom: 499000, giftFundPct: 10, hotline: "0900 000 000 (Zalo)"
};
</script>
```
`bankBin` = mã BIN NAPAS 6 số của ngân hàng (VD Vietcombank 970436, Techcombank 970407, MB 970422, ACB 970416, VietinBank 970415, BIDV 970418). Khi có BIN + số tài khoản, màn thanh toán tự sinh **mã VietQR (chuẩn EMVCo)** có sẵn số tiền + nội dung `TAPEASY <mã đơn>`. Chưa điền → hiển thị placeholder và cảnh báo "chủ app điền". **App không thu thập/xử lý thẻ ngân hàng.**

App native (Capacitor) — quét QR bằng camera cần quyền: Android `<uses-permission android:name="android.permission.CAMERA"/>`; iOS `NSCameraUsageDescription` = "TapEasy dùng camera để quét mã check-in sự kiện". (`BarcodeDetector` có trên Chrome/WebView Android; Safari/iOS chưa có → app tự chuyển sang nhập mã 6 ký tự.)

## 2. Điều hướng — lựa chọn & lý do

**Không thêm tab thứ 6 vào thanh dưới.** Thanh dưới đã đủ 5 mục (giới hạn khuyến nghị của Material/HIG cho màn điện thoại); thêm tab sẽ làm chữ nhỏ dưới 12 px và vùng chạm < 44 px. Sự kiện là tính năng "theo mùa" (đỉnh điểm đầu/cuối tháng), nên lối vào đặt ở nơi người dùng đi qua mỗi ngày:

1. **Trang chủ – thẻ "Sự kiện & Thi đua"** (ngay sau dải calo/nước/ngủ): 1–2 thử thách đang tham gia (thanh tiến độ + hạng #/tổng), vé sự kiện sắp tới (đến giờ thì nút đổi thành **Check-in** nhấp nháy), băng rôn **"Bạn nhận quà!"**, ví điểm. Chưa tham gia → lời mời "4 thử thách tháng 11 đang mở".
2. **Nút cúp trên thanh trên Trang chủ** (có chấm cam khi có quà chờ xác nhận).
3. **Menu ☰**: "Sự kiện & Thi đua", "Sự kiện offline & vé", "Gian hàng TapEasy".
4. **Hồ sơ – thẻ "Sự kiện, quà & gian hàng"**: TapEasy Points, thi đua, vé của tôi, quà của tôi, đơn hàng, (quản trị).

Màn `#screen-events` (tạo động, thêm `"events"` vào `SUB_SCREENS` → ẩn thanh dưới, nút Back/Esc về màn trước) có 5 tab: **Thi đua · Offline · Khoảnh khắc · Gian hàng · Quà** (+ **Quản trị** khi tài khoản có quyền — §10.5). Thanh tab cuộn ngang khi hẹp. Hồ sơ có thêm dòng "Khoảnh khắc sự kiện". Nếu sau này gộp PT + Cộng đồng thành một tab "Cộng đồng", màn này có thể thành một mục con của tab đó mà không đổi code (gọi `TapEv.open("challenges")`).

## 3. Dữ liệu

### 3.1 Trên máy (`state`, lưu bằng `saveState()`)
| Khoá | Nội dung |
|---|---|
| `state.tapEvents.joined[chId]` | `{ joinedAt, manual:[{id,d,v,note,ts}], baseline, baselineTs, baselineDate, lastPush, settled, rank, total, final, done }` |
| `state.tapEvents.points` | Sổ **TapEasy Points** `[{id, ts, delta, reason, ref}]` — `ref` chống cộng trùng (VD `ci_<sự kiện>`, `done_<thử thách>`, `rank_<thử thách>`, `rv_<sự kiện>`) |
| `state.tapEvents.badges[chId]` | Huy hiệu thử thách đã đạt `{ d, title, badge, metric }` |
| `state.tapEvents.contact / address / seenGifts / monthGifts / localId` | SĐT/tên đăng ký, địa chỉ nhận quà, quà đã thông báo, quà cộng đồng theo tháng, mã người dùng cục bộ (demo) |
| `state.tapShop` | `{ cart:[{key,pid,color,size,qty}], vouchers:[{id,code,kind,value,min,max,title,exp,used,usedOrder,src,ref}], addr, pay:"cod"\|"bank"\|"vietqr", ship:"standard"\|"express" }` — giỏ cũ tự chuẩn hoá (gộp dòng trùng, thêm `key`, bỏ dòng hỏng) |
| `state.tapEvents.mediaAutoplay` | `false` = người dùng tắt tự phát clip (công tắc ở tab Khoảnh khắc); mặc định bật |
| `state.isAdmin` | Chế độ quản trị cũ — chỉ dùng khi chưa có `rbac.js` (app.js: `teCan()` dự phòng = `state.isAdmin`), xem §10.5 |

**XP vs Points (không tính trùng):** XP/cấp độ vẫn do `achievements.js` tính lại từ nhật ký (đo mức chăm chỉ, không tiêu được). Module này **không cộng XP**; nó chỉ phát **TapEasy Points** — điểm thưởng tiêu được (đổi voucher) — cho các việc mà XP không đo: hoàn thành thử thách (+200–300), hạng 1/2/3 (+500/300/150), check-in sự kiện (+80–250), review (+30) + ảnh/clip (+20) — review luôn kèm ảnh/clip nên thường +50. Hero của màn Sự kiện hiển thị cả "Cấp N · XP" (từ `FKAch.evaluate`) và số điểm.

### 3.2 Dùng chung (`window.cloudEvents`)
Hai động cơ, cùng API async:
- **demo**: `localStorage["tapeasy_events_demo_v1"]` — tự gieo thử thách tháng trước/này/sau, 8 sự kiện mẫu (6 sắp tới + 2 đã qua; ngày tính theo hôm nay) **đều có ảnh/clip Pexels + nội dung đầy đủ**, review/bài BTC mẫu cho bảng tin Khoảnh khắc, 9 sản phẩm; ảnh/clip người dùng tải lên nằm trong **IndexedDB `tapeasy_media_v1`** (localStorage chỉ giữ chuỗi `idb:<khoá>`); dữ liệu demo cũ (v3) tự nâng cấp lên v4 (thêm ảnh + nội dung, không nhân đôi sự kiện); mỗi tháng mới tự thêm bộ mẫu mới, không xoá dữ liệu cũ. Bảng xếp hạng có **18–39 người chơi giả tất định** (cùng kết quả mỗi lần mở) với tiến độ hợp lý theo chỉ số: buổi tập ≤ 1/ngày, ít tập Chủ nhật; chạy 3–10,5 km/buổi ~3 buổi/tuần; giảm cân ≤ ~1%/tuần.
- **firebase**: khi `cloud.mode === "firebase"` và có `firebase.firestore()` toàn cục (cloud.js đã nạp SDK compat).

API: `init, mode, me, isAdminRemote, listChallenges, saveChallenge, deleteChallenge, joinChallenge, leaveChallenge, pushProgress, listEntries, myEntries, listEvents, saveEvent, deleteEvent, getCheckinCode, register, cancelReg, myRegs, listRegs, checkIn, adminCheckIn, addReview, listReviews,
**mới:** `addPost, deletePost, listMoments, toggleLike, listComments, addComment, deleteComment, report, moderate, newId, putMedia, deleteMedia, checkContent, cleanMedia, isHiddenPost` (§10.3), listProducts, saveProduct, deleteProduct, placeOrder, myOrders, allOrders, updateOrder, cancelOrder, myGifts, allGifts, createGift, updateGift`. Lỗi trả về tiếng Việt.

Cấu trúc Firestore:
```
challenges/{id}                 { title, desc(≥80), metric, target, unit, start, end, month, points, giftTop, gifts[{title,pid}], badge{tier,glyph,label}, color, hidden,
                                  media[≥1], coverId, cover, rules[], eligibility[], safety[] }
challenges/{id}/entries/{uid}   { uid, name, value, week:"2026-W46", weekValue, done, joinedAt, updatedAt, baseline? }
events/{id}                     { title, sport, desc(≥80), start:"YYYY-MM-DDTHH:mm", end, venue, address, city, capacity, fee, points, options[], bring[], organizer, hidden, regCount,
                                  media[≥1], coverId, cover(URL https ảnh bìa/poster — trường cũ, module khác vẫn đọc), agenda[{t,x}], requirements[], perks[], safety[] }
events/{id}/private/checkin     { code }      ← mã check-in tại chỗ, chỉ admin đọc
events/{id}/regs/{uid}          { uid, name, phone, option, sos, note, code, status:"registered|checked_in|cancelled", paid, checkinCode?, checkedInAt }
events/{id}/reviews/{rid}       { kind:"review"|"recap", uid, name, stars?, text(≥20), media[≥1], coverId, ts, likeCount, commentCount, reportCount, reported, hidden, modOk, moderatedBy, moderatedAt }
                                  rid = uid (review: 1 người 1 bài) · "recap_…" (bài sau sự kiện của BTC, staff:true)
events/{id}/reviews/{rid}/mlikes/{uid}     { uid, ts }
events/{id}/reviews/{rid}/mcomments/{cid}  { uid, name, text(1–300), ts }
events/{id}/reviews/{rid}/mreports/{uid}   { uid, reason, ts }
media[] = { id, kind:"image"|"video", src, thumb?, poster?, w, h, dur(giây), size, mime, alt, credit{by,site,url} }   ← src/thumb/poster: URL https (Storage/Pexels)
products/{id}                   { name, short, slug, type, cat, gender:"men|women|unisex|acc", art, price, compareAt, rank, isNew, badge, colors[{id,name,hex,images[]?}], sizes[],
                                  stockBy{"màu|size":n}, stock(=tổng), sizeChart, fit, desc, details[], material, care, related[], hidden, deleted?, edited?, catalogV }
orders/{id}                     { code:"TEddmm-XXXX", uid, items[{pid,name,size,color,colorName,qty,price,img?}], subtotal, shipping, discount, voucher, total, payment:"cod|bank", payVia:"cod|bank|vietqr",
                                  shipMethod:"standard|express", address{name,phone,province,ward,street,note}, status, history[{s,ts}], createdAt }
gifts/{id}                      { uid, name, title, item, pid, reason, month, source{type,id,rank}, status:"new|confirmed|shipping|delivered|cancelled", address, size, freeShip }
admins/{uid}                    { role:"founder" }   ← tạo tay trong Firebase Console
```
Chỉ mục cần bật (Firebase Console → Firestore → Indexes → *Single field* → thêm miễn trừ **Collection group**): `entries.uid`, `regs.uid` (cho `myEntries`/`myRegs`), **`reviews.ts` (giảm dần — bảng tin Khoảnh khắc `collectionGroup("reviews").orderBy("ts","desc")`), `mlikes.uid`** (đánh dấu "đã thích"). `orders` lọc `uid ==` và `orderBy createdAt` dùng chỉ mục đơn mặc định.

### 3.3 Đề xuất thêm vào `firestore.rules` (trong `match /databases/{database}/documents { … }`)
```
    function isAdmin() { return signedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid)); }

    match /admins/{uid} { allow get: if signedIn() && me() == uid; allow list, write: if false; }

    match /challenges/{id} {
      allow read: if signedIn();
      allow write: if isAdmin();
      match /entries/{uid} {
        allow read: if signedIn();
        allow create, update: if signedIn() && me() == uid && request.resource.data.uid == uid
          && request.resource.data.value is number && request.resource.data.value >= 0
          && request.resource.data.value <= get(/databases/$(database)/documents/challenges/$(id)).data.target * 5;
        allow delete: if signedIn() && (me() == uid || isAdmin());
      }
    }
    match /{path=**}/entries/{uid} { allow read: if signedIn(); }     // collectionGroup: myEntries

    match /events/{id} {
      allow read: if signedIn();
      allow write: if isAdmin();
      match /private/{doc} { allow read, write: if isAdmin(); }
      match /regs/{uid} {
        allow read: if signedIn() && (me() == uid || isAdmin());
        allow create: if signedIn() && me() == uid && request.resource.data.uid == uid && request.resource.data.status == 'registered';
        allow update: if isAdmin()
          || (signedIn() && me() == uid && request.resource.data.status == 'cancelled'
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','updatedAt']))
          || (signedIn() && me() == uid && resource.data.status == 'registered' && request.resource.data.status == 'checked_in'
              && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','checkinCode','checkedInAt'])
              && request.resource.data.checkinCode == get(/databases/$(database)/documents/events/$(id)/private/checkin).data.code);
      }
      match /reviews/{uid} { … }   // ĐÃ THAY bằng khối "reviews + Khoảnh khắc" ở §10.6 (bắt buộc media ≥ 1, bộ đếm thích/bình luận/báo cáo)
    }
    match /{path=**}/regs/{uid} { allow read: if signedIn() && (resource.data.uid == me() || isAdmin()); }   // collectionGroup: myRegs

    match /products/{id} { allow read: if true; allow write: if isAdmin(); }

    match /orders/{id} {
      allow read: if signedIn() && (resource.data.uid == me() || isAdmin());
      allow create: if signedIn() && request.resource.data.uid == me()
        && request.resource.data.status in ['pending','awaiting_payment'] && request.resource.data.total is number;
      allow update: if isAdmin()
        || (signedIn() && resource.data.uid == me() && resource.data.status in ['pending','awaiting_payment']
            && request.resource.data.status == 'cancelled'
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','history','updatedAt']));
    }

    match /gifts/{id} {
      allow read: if signedIn() && (resource.data.uid == me() || isAdmin());
      allow create, delete: if isAdmin();
      allow update: if isAdmin()
        || (signedIn() && resource.data.uid == me() && resource.data.status == 'new' && request.resource.data.status == 'confirmed'
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','address','size','confirmedAt','updatedAt']));
    }
```
Mã check-in tại chỗ nằm ở `events/{id}/private/checkin` (người dùng không đọc được); rules dùng `get()` để so khớp khi người dùng tự check-in.

**Cloud Functions nên thêm khi chạy thật** (thư mục `functions/` đã có): (1) `onWrite events/{id}/regs/{uid}` → cập nhật `events/{id}.regCount` (client không được ghi doc sự kiện); (2) `onCreate orders/{id}` → tính lại giá từ `products` + trừ tồn kho trong transaction (chống sửa giá phía client); (3) cuối tháng (scheduler) → chốt bảng xếp hạng, tạo `gifts` cho top N (hiện admin bấm "Chốt & trao quà"); (4) chuyển sổ điểm lên máy chủ nếu muốn điểm theo tài khoản giữa nhiều máy; (5) ~~ảnh review → Storage~~ **đã làm** (§10.4); thêm Function `onDelete events/{id}/reviews/{rid}` dọn `mlikes/mcomments/mreports` + tệp `media/moments/{id}/{uid}/…`; (6) Function đặt `hidden:true` khi `reportCount ≥ 3` (hiện client tự ẩn theo bộ đếm).

## 4. Tính năng & chuyên môn

**Thi đua tháng** — chỉ số: `sessions` (buổi tập, đúng quy tắc của achievements: `finishedDates` ∪ `workoutLog.finishedAt` có bài ∪ buổi 20 phút), `water_days` (nước ≥ 35 ml/kg hoặc mục tiêu tự đặt), `weight_loss`, `run_km` (bài chạy trong giáo án: theo km/m, bài ghi phút ước tính 7 phút/km, loại đi bộ/chèo thuyền), `food_days`, `sleep_days` (≥ mục tiêu − 30 phút, tối thiểu 7 h), `manual`. Nhập tay (buổi ngoài app, km từ Strava/đồng hồ) bắt buộc tích **xác nhận trung thực**, trần mỗi ngày (2 buổi, 60 km), không nhập ngày tương lai/ngoài kỳ.
**Giảm cân an toàn:** chặn tham gia khi BMI < 18,5 hoặc < 18 tuổi; bắt cân mốc (sáng, sau vệ sinh, trước ăn) lưu vào `inbodyLogs`; bảng xếp hạng chỉ tính tối đa **1% cân nặng/tuần** (ghi rõ lý do), nhắc mức an toàn 0,5–1%/tuần.
Bảng xếp hạng **Tuần này** (T2–CN, ISO week) / **Cả tháng**, bục 3 người, xếp hạng kiểu 1-2-2-4, dòng "Bạn" nổi bật. Hết tháng: tự **chốt kết quả** một lần (hạng, điểm hoàn thành + hạng, huy hiệu, voucher 15% cho người hoàn thành ngoài top, quà cho top `giftTop`), popup "Kết quả: hạng #…".

**Sự kiện offline** — 7 môn (chạy bộ, Hyrox/phối hợp, powerlifting với hạng cân theo IPF, tập nhóm, workshop dinh dưỡng, picnic, yoga & giãn cơ) + **ảnh/clip bắt buộc** (gallery vuốt, minh hoạ SVG theo môn làm lớp dự phòng khi chưa tải được ảnh) + lịch trình, điều kiện, quà & quyền lợi, quy định an toàn, ngày giờ, địa điểm, **Google Maps**, số chỗ/thanh lấp đầy, phí/miễn phí, điểm. Đăng ký: họ tên, SĐT VN (03/05/07/08/09), lựa chọn (cự ly/hạng cân), liên hệ khẩn cấp (môn thể lực), cam kết sức khoẻ. **Vé QR thật** (bộ mã hoá QR tự viết theo ISO/IEC 18004: byte UTF-8, phiên bản 1–40, L/M/Q/H, Reed–Solomon, chọn mặt nạ) + mã 6 ký tự, thêm vào lịch (.ics, nhắc trước 12 giờ). **Check-in** (mở từ 2 giờ trước đến 3 giờ sau): quét mã QR tại quầy bằng camera (`BarcodeDetector`) hoặc nhập mã 6 ký tự BTC đọc → +điểm. BTC: quét vé người tham gia, in **poster mã check-in tại chỗ**, danh sách + CSV. Sau sự kiện: review sao **bắt buộc kèm ảnh/clip + ≥ 20 ký tự** (ảnh nén ≤ 1600 px WebP/JPEG, tối đa 10; video ≤ 60 giây, ≤ 25 MB, 1 clip) + bài đăng của BTC → bảng tin **Khoảnh khắc** (§10).

**Gian hàng** — *(bản v1, đã thay bằng TapEasy Store v2 ở §9)* 9 sản phẩm (áo dry-fit 249k, mũ 159k, bình 750 ml 149k, dây kháng lực 129k, khăn 89k, sticker 39k, túi gym 199k, tất combo 79k, dây đeo 49k), ảnh SVG in **biểu tượng TapEasy chính thức** (hình học của `assets/brand/logo-mark.svg`, chỉ teal `#02BCB3` hoặc trắng — đúng `docs/BRAND.md`, không gõ lại chữ logo) + khẩu hiệu "Tập dễ dàng. Tiến bộ mỗi ngày." / "Chạm là tập". Biến thể màu/size (gợi ý size áo theo chiều cao/cân nặng trong hồ sơ, bảng size), tồn kho, giỏ hàng, miễn phí ship từ 499k, **đổi điểm → voucher** (200 điểm freeship · 400 → −20k · 800 → −50k · 1.500 → −15% · 2.500 → −120k, HSD 60 ngày), địa chỉ VN theo **34 tỉnh/thành mới (từ 01/07/2025, bỏ cấp huyện)**, COD hoặc chuyển khoản (thông tin placeholder + VietQR khi đã cấu hình), lịch sử đơn + tiến trình trạng thái, huỷ khi chưa xác nhận (hoàn tồn kho). Hiển thị "10% doanh thu dùng mua quà thành viên tích cực".

**Quà tặng** — top mỗi thử thách (áo/bình/khăn), hoàn thành mục tiêu (voucher), check-in ≥ 2 sự kiện/tháng (bộ quà cộng đồng). Thông báo **"Bạn nhận quà!"** (popup + băng rôn Trang chủ + chấm cam), trang **Quà của tôi**, form xác nhận địa chỉ + size, giao miễn phí.

## 5. Chế độ quản trị (nhà sáng lập)

Bật/tắt: **Hồ sơ → chạm 7 lần vào dòng phiên bản** ("TapEasy v2.0.0"), từ lần 3 hiện đếm ngược. Tab **Quản trị**: tạo/sửa/ẩn/xoá thử thách (chỉ số, mục tiêu, kỳ, điểm, số người nhận quà, quà theo hạng, hạng huy hiệu), **Chốt & trao quà**, CSV người tham gia; tạo/sửa sự kiện (mã check-in, đổi mã), danh sách đăng ký + CSV, quét vé, poster mã tại chỗ; sản phẩm (giá, màu, size, tồn kho, ảnh minh hoạ); đơn hàng (đổi trạng thái, thống kê doanh thu & quỹ quà, CSV); quà (đổi trạng thái giao, CSV). CSV có BOM UTF-8 (mở đúng tiếng Việt trong Excel) và chống CSV-injection.
Ở chế độ **firebase**, `state.isAdmin` chỉ mở giao diện; quyền ghi thật do `admins/{uid}` + rules quyết định (màn quản trị báo nếu tài khoản chưa có quyền).
**Khi có `rbac.js`** (xem `docs/RBAC.md`): giao diện theo quyền chi tiết `teCan(...)` — §10.5; 7 lần chạm do `rbac.js` xử lý (events.js bỏ qua), nút "Tắt" = khoá phiên quản trị.

## 6. Điểm ghi đè / API công khai

| Hàm | Thêm gì |
|---|---|
| `renderHomeScreen` | thẻ `.te-home` sau `.metric-grid`, nút cúp `.te-top-btn` trên thanh trên |
| `renderProfileScreen`, `goto("profile")` | thẻ `.te-prof` trước thẻ Tài khoản |
| `openSheet` | thêm 3 dòng vào menu ☰ (nhận diện menu qua link "Nhắc nhở") |
| `fkHandleBack` | đóng trình xem ảnh/clip toàn màn hình trước; rồi từ màn Sự kiện về màn trước |
| click (capture) | đếm 7 lần chạm dòng phiên bản |

`window.TapEv`: `open(tab)` (`"moments"` = bảng tin Khoảnh khắc), `render()`, `loadAll(force)`, `loadMoments(force)`, `can(perm)`, `openReview(evId)`, `openRecap(evId)`, `openComments("evId/postId")`, `momentCardHTML(post)`, `demoPhoto`, `points.{balance,add,list,has}`, `registerTab(def)`, `addAdminSection(def)`, `act(name, fn)`, `sheet(html)`, `addressFormHTML/readAddress/addrText`, `compressImage`, `downloadFile`, `toCSV`, `core` (hàm thuần: `progress, buildBoard, outcome, evPhase, parseQR, toICS, weekKey, validPhone, PROVINCES…`), `QR` (= `window.TapQR.encode/svg`).
`window.TapShop`: `open(view, params)`, `openProduct(id)`, `openCart`, `openOrders`, `openRedeem`, `close`, `isOpen`, `reload`, `grantVoucher`, `cartCount`, `art(product, color, size)` (SVG dự phòng), `artFor(pid, size)` (ảnh sản phẩm cho thẻ quà), `core.{totals, shipCfg, vietQR, crc16, REDEEM, CFG, vnd, mergeCatalog, stockOf, colorStock, applyStock, recommendSize, inCat, sortList, normCart, imagesFor}`.
Icon mới (tiền tố `te_` của events.js, `tm_` của events-media.js: left/right/close/play/star/heart/comment/flag/image/video/trash/eye/eye_off/shield/expand/send/gallery/autoplay/link): trophy, ticket, qr, scan, gift, coin, podium, map, cart, bag, truck, receipt, voucher, admin, download, plus, minus, cal_add, medal, people, runner…

## 7. Kiểm thử đã chạy

```bash
node -e "for(const f of ['cloud-events.js','events.js','shop.js']) new Function(require('fs').readFileSync('FitKit/'+f,'utf8'))"
node outputs/_test/events-kit/test_core.js          # 86/86 (11/2026: + review/sự kiện thiếu ảnh hoặc mô tả bị chặn ở lớp dữ liệu): tiến độ vs oracle (90 ngày dữ liệu giả), tuần ISO, nước/ăn/ngủ, cân nặng + trần 1%/tuần, km chạy, xếp hạng 1-2-2-4, quà/voucher, pha sự kiện, QR, CSV, ICS, SĐT, 34 tỉnh, demo engine (gieo, bot tất định & hợp lý, đăng ký/đủ chỗ, check-in sai/đúng mã, review 1 người 1 bài, đơn/tồn kho/huỷ, quà chống trùng, sang tháng), shop (tổng tiền, voucher, CRC16 = 29B1, VietQR EMVCo)
python3 outputs/_test/events-kit/qr_check.py /tmp/qr_cases*.json   # QR: 230/233 mẫu (v1–v40, L/M/Q/H, cả 8 mặt nạ) giải mã được bằng OpenCV; 3 mẫu v21+ chỉ lỗi ở bộ dò của OpenCV
python3 outputs/_test/events-kit/build.py events-flow.html t_flow.js '{"days":90}'   # 54/54, 0 lỗi JS (review/thử thách mới phải kèm ảnh)
# ảnh/clip bắt buộc + Khoảnh khắc + quyền — xem §10.7
# (t_shop.js của bản v1 đã thay bằng bộ kiểm thử Store v2 — xem §9.6)
```
Chạy harness trong Playwright (context riêng `tapeasy-events`, phục vụ file qua `page.route` vì `file:` bị chặn), khung 390 × 844. Ảnh chụp: `outputs/_test/shots/te-*.png` (home, hub, board, events, evd, ticket, shop, product, cart, gifts, admin, poster). Mã QR trên ảnh chụp vé và poster được OpenCV đọc đúng nội dung.

## 8. Giới hạn / việc còn lại

- **Điểm TapEasy lưu trên máy** (cả chế độ firebase) — đổi máy/xoá app mất điểm chưa dùng; nên chuyển sang Cloud Function (§3.3).
- Firebase: `regCount` cần Cloud Function; giá/tồn kho đơn hàng do client gửi → admin kiểm tra trước khi giao hoặc thêm Function. Ảnh/clip đã chuyển sang Firebase Storage (§10.4); giới hạn của bảng tin xem §10.8.
- Quét QR bằng camera cần `BarcodeDetector` (Chrome/Android WebView); iOS dùng nhập mã 6 ký tự (hoặc bổ sung plugin `@capacitor-mlkit/barcode-scanning` sau).
- Km chạy bộ: chỉ đọc bài chạy trong giáo án (km/m/phút); chưa đồng bộ Strava/Health Connect — dùng nhập tay có xác nhận.
- Cân nặng lấy từ `inbodyLogs` (không đổi `profile.weight` để không làm lệch mục tiêu calo); người dùng muốn cập nhật hồ sơ thì sửa ở Hồ sơ.
- Bản demo có người chơi giả (ghi chú rõ dưới bảng xếp hạng) và tự "trao quà" cho người dùng khi hết tháng để thử luồng; firebase thì chỉ admin trao.
- Địa điểm sự kiện mẫu gắn nhãn "(địa điểm mẫu)" — nhà sáng lập thay bằng địa điểm thật trong chế độ quản trị.


## 9. TapEasy Store v2 — gian hàng chuẩn giao diện quốc tế (11/2026)

Yêu cầu chủ app: *"Shop bán hàng chuẩn giao diện quốc tế, học ở các trang như Zara."* File: `shop.js` (viết lại), `shop.css` (viết lại), `shop-data.js` (mới), `assets/shop/*.webp` (79 ảnh), `assets/shop/_build/` (bộ sinh ảnh Pillow).

### 9.1 Nguyên tắc đã áp dụng (phân tích Zara · COS · Nike · Gymshark · Alo — không sao chép logo/ảnh/tên)
| Nguồn cảm hứng | Áp dụng trong TapEasy Store |
|---|---|
| Zara / COS: ảnh editorial toàn chiều rộng, chữ in hoa mảnh, menu bằng chữ, lưới ảnh sát nhau, tên + giá nhỏ dưới ảnh, không khung/bo | Hero 3 ảnh vuốt ngang; tiêu đề Inter Tight 300 in hoa, giãn chữ `.06–.24em`; menu chữ **MỚI · NAM · NỮ · PHỤ KIỆN · TẤT CẢ**; ảnh 3:4 tràn viền, khe 2 px (mobile), chữ 12 px dưới ảnh; nền trắng, nút đen vuông |
| Phê bình UX về Zara (tối giản quá → khó tìm, không sửa size trong giỏ) | Giữ icon tìm kiếm/tài khoản/giỏ có nhãn; tìm kiếm có gợi ý; **đổi size ngay trong giỏ**; xác nhận trước khi huỷ đơn/đổi điểm |
| Nike / Gymshark: nút thêm giỏ nổi trên mobile, "Size guide" sát ô size, thông tin fit | Nút **THÊM VÀO GIỎ** đen toàn chiều rộng, dính đáy màn khi cuộn (mobile); link *Hướng dẫn chọn size* ngay cạnh nhãn Size; dòng "Dáng regular, đúng size…" |
| Baymard (apparel): ô size dạng nút, bảng size có số đo cm + cách đo + liên hệ hỗ trợ, ảnh nhiều góc | Ô size dạng nút (hết hàng gạch chéo, khoá); bảng size cm theo **số đo cơ thể** + cách đo + hotline; gợi ý size theo chiều cao/cân nặng trong hồ sơ; 2 ảnh/màu (trước + sau/ảnh cận) |
| Alo: cảm giác tạp chí, studio-to-street | Ảnh flat-lay nền đá ấm, ánh nắng xuyên rèm; nhóm NỮ có hero riêng |

### 9.2 Màn hình & điều hướng
- **Cửa hàng là lớp phủ toàn màn hình** `#tsx` (nền sáng, `position:fixed`, z-index 1200) → thoát khung điện thoại 460 px khi mở trên màn rộng: **2 cột ở 390 px, 3 cột từ 761 px, 4 cột từ 1100 px**. Nút **← / "Quay lại app"** ở đầu trang + nút cuối trang; Back Android/Esc lùi từng màn trong cửa hàng rồi thoát (bộ bọc `fkHandleBack` được đặt lên đầu chuỗi mỗi lần mở).
- Lối vào: menu ☰ "Gian hàng TapEasy" (mở thẳng cửa hàng), tab **Gian hàng** trong màn Sự kiện (thẻ giới thiệu + 4 sản phẩm + Giỏ/Đơn/Đổi điểm), Hồ sơ → "Đơn hàng lưu niệm", nút giỏ trên màn Sự kiện, `TapShop.open()`.
- Màn: Trang đầu (hero, Mới về, 3 ô danh mục, Tất cả, cam kết) · Danh mục (lọc loại, sắp xếp) · Tìm kiếm · Sản phẩm · Giỏ hàng (ngăn kéo phải) · Hướng dẫn chọn size (ngăn kéo) · Thanh toán 3 bước · Hoàn tất · Đơn hàng + chi tiết (tiến trình 4 bước) · Voucher & điểm · Tài khoản · Quản trị (sản phẩm, sửa sản phẩm, đơn hàng).
- **Chạm giữ 0,3 s** (cảm ứng) hoặc **rê chuột / focus bàn phím** lên ô sản phẩm → ảnh thứ hai (ảnh 2 chỉ tải khi cần, `data-src`); thả tay không mở nhầm trang sản phẩm. Ảnh `loading="lazy"` + `decoding="async"`, có `width/height` chống nhảy bố cục.
- Giá dạng `350.000 ₫` (NBSP + ký hiệu ₫). Chữ ≥ 12 px, vùng chạm ≥ 44 px, ô nhập 16 px, hỗ trợ `prefers-reduced-motion`.

### 9.3 Danh mục & ảnh (`shop-data.js`, `assets/shop/`)
- **14 sản phẩm × 2–3 màu** (37 biến thể màu × 2 ảnh = 74 ảnh + 5 hero = 79 ảnh; tổng ≈ 1,3 MB WebP 720 × 960): áo thun Dry-fit, tank top racerback, áo bra, quần short 2 lớp, legging 7/8, áo khoác gió, mũ 6 mảnh, bình 750 ml, túi dây rút, bộ dây kháng lực, khăn microfiber, tất cổ trung, bộ 12 sticker, dây đeo thẻ. Mã sản phẩm/màu cũ giữ nguyên.
- Ảnh vẽ bằng **Pillow + numpy** (`assets/shop/_build/gen_shop_images.py`, ~2 phút): ghost mannequin / flat-lay trên nền xám nhạt studio, đổ bóng thể tích theo mép, nếp gấp, vân vải (jersey/knit/nylon/terry…), đường may, in **biểu tượng + wordmark đọc trực tiếp từ `assets/brand/*.svg`** (đúng BRAND.md: biểu tượng teal hoặc trắng; wordmark bản `-light` trên nền tối, `-dark` trên nền sáng; không gõ lại chữ logo). Sinh lại: `python3 assets/shop/_build/gen_shop_images.py [--only tee,cap] [--sheet xem.png]`.
- Bảng size (cm): áo unisex, áo khoác, short nam, áo nữ (bra/tank), legging nữ, tất — kèm cách đo; tồn kho mặc định theo `màu|size` (vài size hết để thấy trạng thái).
- **Gộp với máy chủ** (`core.mergeCatalog`): sản phẩm mẫu chưa bị quản trị sửa → nội dung theo `shop-data.js`, tồn kho theo máy chủ; đã sửa (`edited:true`, hoặc bản cũ có `updatedAt ≠ createdAt`) → máy chủ thắng; sản phẩm mẫu bị xoá được đánh dấu `deleted:true` (không tự hiện lại). Bản demo tự ghi danh mục mẫu vào "máy chủ" giả lập; Firebase: quản trị bấm **"Đồng bộ N sản phẩm mẫu lên máy chủ"**.

### 9.4 Mua hàng
- Trang sản phẩm: gallery vuốt (mobile) / lưới 2 ảnh + cột thông tin dính (desktop), chấm màu (màu hết hàng mờ + gạch), ô size, gợi ý size, cảnh báo "Chỉ còn N", accordion *Mô tả & dáng · Chất liệu & bảo quản · Giao hàng & đổi trả*, điểm TapEasy + link đổi voucher, **Gợi ý cho bạn**.
- Giỏ (ngăn kéo): thanh tiến độ miễn phí ship, đổi size/số lượng/xoá, chọn voucher (đổi điểm → voucher như v1), tổng.
- Thanh toán **3 bước**: (1) **Giao hàng** — form địa chỉ 34 tỉnh/thành (dùng chung `TapEv.addressFormHTML/readAddress`), tiêu chuẩn 30.000 ₫ (miễn phí từ 499.000 ₫) hoặc **hoả tốc 45.000 ₫** (chỉ nội thành Hà Nội/TP. HCM); (2) **Thanh toán** — COD / chuyển khoản / **VietQR**; (3) **Xác nhận** — sửa nhanh từng phần, đặt hàng. Không thu thập thẻ. Chuyển khoản & VietQR lưu `payment:"bank"` (giữ tương thích rules) + `payVia`.
- Đơn hàng: danh sách có ảnh thu nhỏ, chi tiết có **tiến trình Đặt hàng → Xác nhận → Đang giao → Đã giao** (giờ từng mốc), khối chuyển khoản/VietQR khi chờ thanh toán, huỷ khi chưa xác nhận (hoàn tồn kho theo biến thể).
- Cấu hình thêm trong `TAPEASY_SHOP_CONFIG`: `expressFee` (mặc định 45000), `dataSrc`, `logoWord`. `cloud-admin.js` vẫn ghi đè `shippingFee/freeShipFrom/giftFundPct/hotline/bank` qua `TapShop.core.CFG` như trước.

### 9.5 Quản trị & quyền
- Quyền: `typeof teCan==='function' ? teCan(p) : state.isAdmin` với `shop.products` (sửa sản phẩm, xem sản phẩm ẩn), `orders.view` (xem đơn chỉ đọc), `shop.orders` (đổi trạng thái), `shop.refund` (mới được chọn "Đã huỷ" cho đơn đã xác nhận), `data.export` (CSV). Đúng đề xuất §6.2 của `docs/INTEGRATION-admin.md` (không cần sửa thêm shop.js).
- **Sản phẩm**: bảng (ảnh, giá, tồn tổng, trạng thái); form thêm/sửa: tên, mô tả, giá/giá gạch, thứ tự nổi bật, nhóm Nam/Nữ/Unisex/Phụ kiện, loại, bảng size, size, **màu (tên + mã màu) × ảnh tải lên (tự cắt 3:4, nén WebP/JPEG ≤ ~150 KB, tối đa 3/màu)** × **tồn kho từng size**, nhãn, MỚI, dáng, chất liệu, bảo quản, ẩn, xoá. Firebase chặn lưu nếu ảnh > 850 KB/sản phẩm (giới hạn 1 MB/doc).
- **Đơn hàng**: thống kê (đơn, doanh thu, quỹ quà 10%), lọc theo trạng thái (có đếm), đổi trạng thái (hoàn kho theo biến thể khi huỷ), CSV (có cột giao hàng/thanh toán mới). Lối tắt từ tab Quản trị của màn Sự kiện (2 mục "Cửa hàng — …" có `perm`).
- Với `cloud-admin.js`: các ghi "hệ thống" (gieo danh mục mẫu, trừ/hoàn tồn theo biến thể sau khi đặt/huỷ) ở **bản demo** đi thẳng động cơ demo `cloudEvents._demo.saveProduct` (giống `cloud-events` tự gieo `seedProducts`); sửa sản phẩm của quản trị vẫn qua lớp bọc quyền + audit. **Firebase:** người dùng thường không ghi `products` → cần Cloud Function `onCreate/onUpdate orders` trừ/hoàn `stockBy` trong transaction (đã ghi ở §3.3, nay trừ theo khoá `màu|size`).

### 9.6 Kiểm thử đã chạy
```bash
node -e "for(const f of ['shop-data.js','shop.js']) new Function(require('fs').readFileSync('FitKit/'+f,'utf8'))"
node outputs/_test/shop-kit/test_core.js        # 50/50: 14 SP × 2–3 màu, đủ 12 loại yêu cầu, mã/màu/size cũ giữ nguyên, đủ 74 ảnh sản phẩm WebP thật (< 2 MB), hero, tồn kho màu|size,
                                                 # bảng size khớp size, tiền/voucher/hoả tốc, 350.000 ₫, CRC16 29B1, VietQR, SVG dự phòng, gộp danh mục (seed cũ/đã sửa/tự tạo/ảo/đã xoá),
                                                 # trừ/hoàn tồn, gợi ý size (175/75 → XL), NAM/NỮ/PHỤ KIỆN/MỚI, sắp xếp, giỏ cũ, chặn URL ảnh lạ
node outputs/_test/events-kit/test_core.js      # 83/83 (lõi cũ vẫn tương thích)
python3 outputs/_test/shop-kit/build.py shop-flow.html t_flow.js '{"days":90}'          # 64/64, 0 lỗi JS
RBAC=1 python3 outputs/_test/shop-kit/build.py shop-rbac.html t_rbac.js '{"days":90}'  # 8/8 với rbac.js + cloud-admin.js (người dùng thường mua được, tồn biến thể vẫn trừ, không thấy quản trị)
```
Playwright, context riêng **`tapeasy-shop`** (phục vụ file qua `route.fulfill({path})`), khung **390 × 844** (mobile, cảm ứng) và **1280 × 800**: ảnh `outputs/_test/shots/shop-390-*.png`, `shop-1280-*.png` (1 home, 2 mới về, 3 lưới, 4 NỮ + ảnh 2, 5–6 sản phẩm, 7 bảng size, 8 giỏ, 9–11 thanh toán 3 bước, 12 hoàn tất + VietQR, 13 đơn hàng, 14–15 quản trị). Bản xem nhanh: `outputs/_test/shop-view.html` (cần phục vụ qua http để thấy ảnh).

### 9.7 Giới hạn
- Ảnh là ảnh dựng (ghost mannequin/flat-lay) — Baymard khuyên có ảnh người mẫu thật; khi có ảnh chụp thật, tải lên trong Quản trị (theo màu) là thay ngay.
- Firebase: tồn kho theo biến thể chỉ chính xác khi có Cloud Function trừ kho; giá đơn vẫn do client gửi (Function nên tính lại). Ảnh quản trị lưu dataURL trong doc — nên chuyển Firebase Storage khi nhiều ảnh.
- Chưa có đánh giá sản phẩm/"fit score", danh sách yêu thích, so sánh — có thể nối với review của Cộng đồng sau.
- Font Inter Tight 300/400 cần mạng lần đầu (hoặc thêm vào link Google Fonts / tự host).

## 10. Sự kiện bắt buộc ảnh/clip + nội dung · bảng tin "Khoảnh khắc" (11/2026)

Yêu cầu chủ app: *"Các phần sự kiện đăng lên luôn phải kèm ảnh hoặc clip và nội dung."* File: `events-media.js` (mới, `window.TapMedia`), `events.js`, `events.css`, `cloud-events.js`.

### 10.1 Luật nội dung — áp ở 3 lớp (form · lớp dữ liệu · rules)
| Loại | Bắt buộc | Giới hạn |
|---|---|---|
| Sự kiện (`event`) | tên ≥ 4 ký tự · **mô tả ≥ 80 ký tự** · **≥ 1 ảnh hoặc 1 video** | ≤ 10 ảnh, ≤ 2 video |
| Thử thách (`challenge`) | như trên | ≤ 10 ảnh, ≤ 1 video |
| Review sau sự kiện (`review`) | 1–5 sao · **≥ 20 ký tự** · **≥ 1 ảnh/video** · đã check-in | ≤ 10 ảnh, ≤ 1 video |
| Bài đăng sau sự kiện của BTC (`recap`) | **≥ 20 ký tự** · **≥ 1 ảnh/video** · quyền `events.manage` | ≤ 10 ảnh, ≤ 2 video |
Video: ≤ 60 giây (sai số 0,5 s), ≤ 25 MB. Đếm ký tự sau khi gộp khoảng trắng.
- **Form** (tạo/sửa sự kiện, thử thách, review, bài BTC): khung "Chưa đăng được — cần bổ sung" liệt kê lỗi bằng lời thân thiện (VD *"Mô tả sự kiện cần ít nhất 80 ký tự (hiện có 14) — nêu rõ lịch trình, ai phù hợp, quà/quyền lợi và lưu ý an toàn."*), tô đỏ ô thiếu, cuộn tới ô đầu tiên, toast; bộ đếm ký tự dưới ô mô tả; đang nén/đọc video thì chặn đăng.
- **Lớp dữ liệu**: `saveEvent/saveChallenge/addReview/addPost` gọi `checkContent()` (= `TapMedia.validate`, có luật dự phòng khi thiếu file) + `cleanMedia()` (chỉ giữ nguồn bền: `https:`, `idb:`, `art:` — ảnh `blob:` chưa tải lên bị loại → báo thiếu ảnh). Bỏ các bộ đếm tính toán (`regCount, rating…`) trước khi ghi.
- **Rules**: §10.6.

### 10.2 Ảnh & clip (`events-media.js`)
- **Ảnh**: giải mã có xoay EXIF (`createImageBitmap(imageOrientation:"from-image")`), canvas ≤ **1600 px**, **WebP** nếu máy mã hoá được (không thì JPEG), q 0,82 → hạ dần tới ≤ ~900 KB; kèm ảnh nhỏ **640 px** (≤ 140 KB) cho thẻ/bảng tin. HEIC máy không đọc được → hướng dẫn chọn JPG / "Tương thích nhất".
- **Video**: MP4/MOV/WebM; kiểm tra ≤ 25 MB trước khi đọc, đọc thời lượng (sửa lỗi WebM thiếu thời lượng), ≤ 60 giây; **trích khung tại min(1 s, 25%) bằng canvas làm poster** (1280 px + 640 px); iOS chưa ra khung → phát/dừng 1 nhịp rồi lấy. Không chuyển mã (tải nguyên tệp).
- **Trình chọn trong form**: Thêm ảnh (nhiều tệp) / Thêm video; lưới ô có số thứ tự, nhãn "Bìa", thời lượng clip; chạm ô → thanh **Đặt làm bìa · ← · → · Bỏ** (nút ≥ 44 px; bàn phím Alt+←/→, Delete); quản trị có thêm "Thêm bằng đường dẫn https" (ảnh Pexels/Unsplash, video .mp4 — tự kiểm tra thời lượng, ghi nguồn). Bỏ ảnh đã lưu → xoá tệp sau khi lưu thành công.
- **Hiển thị**: thẻ sự kiện/thử thách có ảnh bìa (ảnh 640 px; số ảnh/clip ở góc); **clip bìa tự phát không tiếng, `playsinline`, lặp** khi thẻ hiện ≥ 60% (IntersectionObserver), dừng khi cuộn đi/ẩn tab, mỗi lúc 1 clip, chỉ nạp video khi cuộn tới (`preload="none"`). **Không tự phát** khi `prefers-reduced-motion`, Save-Data / mạng 2G, `html.lowfx`, hoặc người dùng tắt công tắc "Tự phát clip" (tab Khoảnh khắc) → hiện nút play. Chi tiết: **gallery vuốt** (scroll-snap, đếm 1/N, chấm, nút ‹ › khi có chuột), clip có thanh điều khiển, chạm ảnh/nút ⤢ → **trình xem toàn màn hình** (Esc, nút Back Android, ←/→, giữ focus trong hộp thoại). Mọi ảnh có **minh hoạ SVG theo môn nằm dưới** → mất mạng/ảnh lỗi vẫn đẹp.
- **Credit**: ảnh mẫu ghi "Ảnh: <tác giả> / Pexels" (link trang ảnh) trên từng ảnh; clip mẫu ghi "Video: Pexels".

### 10.3 Khoảnh khắc sự kiện (tab mới + chi tiết sự kiện)
- Nguồn: review của người **đã check-in** + bài sau sự kiện của BTC (nhãn "Ban tổ chức"); chỉ bài có ảnh/clip. Nút **Đăng** → chọn sự kiện đã check-in (BTC thấy thêm danh sách sự kiện để đăng bài).
- **Thả tim** (cập nhật ngay, lỗi thì hoàn tác), **bình luận** (1–300 ký tự, xoá bình luận của mình; kiểm duyệt xoá được mọi bình luận), **báo cáo** (6 lý do, mỗi người 1 lần, không tự báo cáo bài mình; gửi kèm sang hàng đợi `cloudAdmin.report` nếu có). **≥ 3 báo cáo → tạm ẩn** chờ kiểm duyệt (tác giả vẫn thấy bài kèm ghi chú).
- **Kiểm duyệt** (`teCan('community.moderate')` hoặc `'reviews.moderate'`): nút khiên trên mỗi bài + mục "Kiểm duyệt khoảnh khắc" trong tab Quản trị — **Giữ lại/khôi phục** (`modOk`), **Ẩn**, **Xoá vĩnh viễn**; ghi `cloudAdmin.appendAudit("mod.moment.*")` nếu có RBAC.
- Điểm: review +30, ảnh/clip +20 (chống cộng trùng theo `rv_`/`rvp_<sự kiện>`). Sửa review giữ nguyên id, lượt thích, bình luận; lệnh ẩn của kiểm duyệt không bị tác giả gỡ khi sửa.
- **Nội dung mẫu** (mọi sự kiện/thử thách đều có ảnh + lịch trình, điều kiện, quà, quy định an toàn): chạy Hồ Gươm (clip bìa + 4 ảnh), tập nhóm Thống Nhất, Hyrox Simulation (mức wall ball Open 6/4 kg · Pro 9/6 kg), Powerlifting (IPF classic: đai, băng cổ tay, ống gối; không băng quấn gối), workshop đạm kiểu Việt, picnic Ecopark, chạy 10 km Hồ Tây (đã qua: 4 review + bài BTC có clip), **yoga & giãn cơ Công viên Gia Định** (đã qua: 2 review). Ảnh Pexels (đã kiểm tra tải được và đúng chủ đề — `_test/shots/te2-pexels-contact.png`): Cara Denison, tu nguyen, Pexels LATAM, cottonbro studio, Ozan Yavuz, AirFit, Sarah Chai, Ardit Mbrati, TSquared Lab, TUBARONES PHOTOGRAPHY, Ketut Subiyanto, Victor Freitas, Jonathan, Youn Seung Jin, Ella Olsson, Yaroslav Shuraev, ready made, N Sopyan, Nadirsyah Nadirsyah, Rui Dias, Stephen Leonardi, RUN 4 FFWPU, Vitaly Gariev, Anastasia Shuraeva, Andres Ayrton, Bich Tran, Brett Sayles, Margo Evardson; clip Pexels #38667750, #5319351.

### 10.4 Lưu trữ
- **Demo**: IndexedDB `tapeasy_media_v1` / store `files` (Blob; Safari cũ → ArrayBuffer; không có IndexedDB → bộ nhớ tạm của phiên). Tài liệu chỉ giữ `idb:<khoá>`; hiển thị qua object URL. Đầy bộ nhớ → báo "Bộ nhớ máy đầy…".
- **Firebase**: Firebase Storage, SDK `firebase-storage-compat.js` tự nạp khi cần (cùng `firebase.SDK_VERSION`); cần `storageBucket` trong `firebase-config.js`. Đường dẫn: `media/events/{evId}/{mid}.webp|jpg|mp4` (+ `_t` ảnh nhỏ, `_p` poster), `media/events/{evId}/recap/…`, `media/challenges/{chId}/…`, `media/moments/{evId}/{uid}/…`; `cacheControl: public,max-age=31536000`. Lưu URL tải xuống (https) vào `media[]`.
- `firebase.json`: thêm `"storage": { "rules": "storage.rules" }`. File `storage.rules` đề xuất:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() { return request.auth != null; }
    function legacyAdmin() { return firestore.exists(/databases/(default)/documents/admins/$(request.auth.uid)); }
    // vai trò lấy từ custom claim `role` do Cloud Function RBAC cấp (docs/RBAC.md) — giữ khớp ma trận quyền
    function evStaff() { return signedIn() && (request.auth.token.role in ['owner','super_admin','admin','event_manager'] || legacyAdmin()); }
    function mod() { return signedIn() && (request.auth.token.role in ['owner','super_admin','admin','content_manager','moderator','pt_manager'] || legacyAdmin()); }
    function isImg() { return request.resource.contentType.matches('image/(jpeg|webp|png)'); }
    function isVid() { return request.resource.contentType.matches('video/(mp4|webm|quicktime)'); }
    function okFile() { return (isImg() && request.resource.size < 3 * 1024 * 1024) || (isVid() && request.resource.size <= 25 * 1024 * 1024); }

    match /media/events/{evId}/{rest=**}     { allow read: if true; allow create, update: if evStaff() && okFile(); allow delete: if evStaff(); }
    match /media/challenges/{chId}/{rest=**} { allow read: if true; allow create, update: if evStaff() && okFile(); allow delete: if evStaff(); }
    match /media/moments/{evId}/{uid}/{file} {
      allow read: if true;
      allow create: if signedIn() && request.auth.uid == uid && okFile()
        && firestore.get(/databases/(default)/documents/events/$(evId)/regs/$(uid)).data.status == 'checked_in';
      allow delete: if signedIn() && (request.auth.uid == uid || mod());
    }
    match /{all=**} { allow read, write: if false; }
  }
}
```

### 10.5 Quyền (giao diện) — `typeof teCan === 'function' ? teCan(perm) : state.isAdmin`
| Việc | Quyền |
|---|---|
| Tạo/sửa/ẩn/xoá sự kiện, đăng bài sau sự kiện, thấy sự kiện ẩn | `events.manage` |
| Danh sách đăng ký, quét vé, mã check-in tại chỗ | `events.checkin` (hoặc `events.manage`) |
| Tạo/sửa thử thách, thấy thử thách ẩn | `challenges.manage` |
| Chốt & trao quà, danh sách quà | `gifts.manage` (+ `challenges.manage` để chốt) |
| Xuất CSV | `data.export` |
| Kiểm duyệt khoảnh khắc/bình luận | `community.moderate` hoặc `reviews.moderate` |
| Mục quản trị của module khác (`addAdminSection({perm})`) | theo `perm` (chuỗi hoặc mảng) |
Tab **Quản trị** chỉ hiện khi có ít nhất 1 quyền trên (hoặc quyền cửa hàng). Thao tác thiếu quyền → toast "Tài khoản chưa có quyền …" và không mở form. `app.js` đã có `teCan()` dự phòng (= `state.isAdmin`); khi nạp `rbac.js` (`window.TE_RBAC`) thì 7 lần chạm do RBAC xử lý. Cùng quyền được kiểm ở lớp dữ liệu demo (`addPost` cần `events.manage`; `moderate` cần quyền kiểm duyệt) và ở rules (firebase).

### 10.6 `firestore.rules` — thay khối `match /reviews/{uid}` trong `match /events/{id}` (dùng `hasPerm()` của `docs/INTEGRATION-admin.md`; chưa áp RBAC thì thay `hasPerm('…')` bằng `isAdmin()`)
```
      // sự kiện / thử thách: bắt buộc ảnh/clip + mô tả ≥ 80 ký tự
      // (trong match /events/{id}:)  allow create, update: if hasPerm('events.manage') && okContent();  allow delete: if hasPerm('events.manage');
      // (trong match /challenges/{id}:) allow create, update: if hasPerm('challenges.manage') && okContent(); allow delete: if hasPerm('challenges.manage');
      //   function okContent() { return request.resource.data.get('media', []).size() >= 1 && request.resource.data.get('media', []).size() <= 12
      //                              && request.resource.data.get('desc', '').size() >= 80 && request.resource.data.get('title', '').size() >= 4; }
      match /reviews/{rid} {
        function isRecap() { return rid.matches('recap_.*'); }
        function okMedia() { return request.resource.data.media is list && request.resource.data.media.size() >= 1 && request.resource.data.media.size() <= 12; }
        function okText() { return request.resource.data.text is string && request.resource.data.text.size() >= 20 && request.resource.data.text.size() <= 2000; }
        function guarded() { return ['likeCount','commentCount','reportCount','reported','hidden','modOk','moderatedBy','moderatedAt']; }
        function delta(k) { return request.resource.data.get(k, 0) - resource.data.get(k, 0); }
        function only(keys) { return request.resource.data.diff(resource.data).affectedKeys().hasOnly(keys); }
        function likeDoc() { return /databases/$(database)/documents/events/$(id)/reviews/$(rid)/mlikes/$(request.auth.uid); }
        function reportDoc() { return /databases/$(database)/documents/events/$(id)/reviews/$(rid)/mreports/$(request.auth.uid); }
        function isMod() { return hasPerm('community.moderate') || hasPerm('reviews.moderate'); }
        allow read: if signedIn();
        allow create: if (!isRecap() && signedIn() && me() == rid && request.resource.data.uid == rid && request.resource.data.kind == 'review'
              && request.resource.data.stars in [1,2,3,4,5] && okText() && okMedia() && !request.resource.data.keys().hasAny(guarded())
              && get(/databases/$(database)/documents/events/$(id)/regs/$(rid)).data.status == 'checked_in')
          || (isRecap() && hasPerm('events.manage') && request.resource.data.kind == 'recap' && okText() && okMedia() && !request.resource.data.keys().hasAny(guarded()));
        allow update: if (!isRecap() && signedIn() && me() == rid && request.resource.data.stars in [1,2,3,4,5] && okText() && okMedia()
              && !request.resource.data.diff(resource.data).affectedKeys().hasAny(guarded()))
          || (isRecap() && hasPerm('events.manage') && okText() && okMedia() && !request.resource.data.diff(resource.data).affectedKeys().hasAny(guarded()))
          || (signedIn() && only(['likeCount']) && ((delta('likeCount') == 1 && !exists(likeDoc()) && existsAfter(likeDoc()))
                                                 || (delta('likeCount') == -1 && exists(likeDoc()) && !existsAfter(likeDoc()))))
          || (signedIn() && only(['commentCount']) && delta('commentCount') in [1, -1])
          || (signedIn() && only(['reportCount','reported']) && delta('reportCount') == 1 && !exists(reportDoc()) && existsAfter(reportDoc()))
          || (isMod() && only(['hidden','modOk','moderatedBy','moderatedAt']));
        allow delete: if (signedIn() && me() == resource.data.uid) || isMod() || (isRecap() && hasPerm('events.manage'));
        match /mlikes/{uid}    { allow read: if signedIn(); allow create: if signedIn() && me() == uid && request.resource.data.uid == uid; allow delete: if signedIn() && me() == uid; }
        match /mcomments/{cid} { allow read: if signedIn();
          allow create: if signedIn() && request.resource.data.uid == me() && request.resource.data.text is string && request.resource.data.text.size() >= 1 && request.resource.data.text.size() <= 300;
          allow delete: if signedIn() && (resource.data.uid == me() || hasPerm('community.moderate') || hasPerm('reviews.moderate')); }
        match /mreports/{uid}  { allow create: if signedIn() && me() == uid && request.resource.data.uid == uid; allow read: if hasPerm('community.moderate') || hasPerm('reviews.moderate'); }
      }
    // (ngoài match /events) collectionGroup: bảng tin + đánh dấu "đã thích"
    match /{path=**}/reviews/{rid} { allow read: if signedIn(); }
    match /{path=**}/mlikes/{uid}  { allow read: if signedIn() && resource.data.uid == me(); }
```
`cloud-admin.js` (RBAC) vẫn kiểm duyệt review qua `hidden/modOk/moderatedBy/moderatedAt` — cùng trường, không xung đột.

### 10.7 Kiểm thử (11/2026)
```bash
node -e "for(const f of ['cloud-events.js','events-media.js','events.js']) new Function(require('fs').readFileSync('FitKit/'+f,'utf8'))"
node outputs/_test/events-media-kit/test_media.js   # 71/71: luật (thiếu ảnh/clip, mô tả < 80 kèm số ký tự, review < 20, sao, 10 ảnh, video 60 s/25 MB, ảnh đang xử lý),
                                                   # nguồn an toàn (chặn javascript:/http:/data:text), tương thích photos[] cũ, ảnh bìa; mẫu: 8 sự kiện + 7 thử thách đều đạt luật,
                                                   # có lịch trình/điều kiện/quà/an toàn, credit Pexels; Khoảnh khắc: tim, bình luận, báo cáo → ẩn ở 3, kiểm duyệt (teCan) giữ/ẩn,
                                                   # bài BTC cần events.manage, blob: bị loại, sửa review giữ id + lượt thích; nâng cấp dữ liệu demo v3 → v4
node outputs/_test/events-kit/test_core.js          # 86/86
cd outputs/_test/events-media-kit && python3 build.py events-media-flow.html t_media.js '{"days":90}'   # 60/60, 0 lỗi JS
cd outputs/_test/events-kit && python3 build.py events-flow.html t_flow.js '{"days":90}'               # 54/54, 0 lỗi JS
```
`events-media-flow` (Playwright, context riêng **`tapeasy-events-2`**, 390 × 844, phục vụ qua `page.route`, có mạng tới Pexels): thẻ có ảnh bìa 640 px + clip bìa tự phát khi cuộn tới / dừng khi cuộn đi; Save-Data, 2G, tắt công tắc → không tự phát; gallery vuốt 2/N + chấm; trình xem toàn màn hình (Esc, Back); form tạo sự kiện chặn khi thiếu ảnh + mô tả (2 lỗi, tô đỏ, bộ đếm 14/80); nén ảnh PNG 2400 px → WebP ≤ 1600 px; video WebM (MediaRecorder, thiếu thời lượng) → đọc 0:01–0:02 + poster canvas; video 26 MB bị từ chối; đặt ảnh 2 làm bìa + đổi thứ tự; lưu → `idb:` + ảnh nhỏ + poster, localStorage không có dữ liệu ảnh; review thiếu ảnh/ngắn bị chặn → có ảnh lưu được (+50 điểm, escape HTML); bảng tin ≥ 8 bài, tim/bình luận/báo cáo; `teCan` giả lập: chỉ `community.moderate` → nút kiểm duyệt + hàng đợi, không có nút tạo; chỉ `events.checkin` → có quét vé, không sửa/đăng bài BTC; không quyền → ẩn tab Quản trị; không icon thiếu; nút bảng tin ≥ 44 px.
`shop-kit/t_flow.js` của Gian hàng (không nạp `events-media.js`) vẫn 64/64 — events.js tự lùi về ảnh bìa cũ khi thiếu TapMedia.
Ảnh chụp: `outputs/_test/shots/te2-*.png` (events, events2, challenges, evd, evd2, evd3, past, moments, moments2, review-err, review-ok, ev-form, ev-form2, admin, lightbox, pexels-contact).

### 10.8 Giới hạn / việc còn lại
- Firebase: bảng tin đọc cả bài đang ẩn rồi lọc ở client (rules cho đọc mọi review) — muốn chặn hẳn: Cloud Function đặt `hidden:true` khi đủ báo cáo + truy vấn `where("hidden","==",false)` (cần chỉ mục tổng hợp). `commentCount` chỉ kiểm ±1 (không đối chiếu doc bình luận).
- Không chuyển mã video phía máy chủ (tải nguyên tệp ≤ 25 MB); nên thêm Function/Transcoder → 720p H.264 + ảnh poster chuẩn khi chạy thật. Android không đọc được HEIC (đã báo cách xử lý).
- Ảnh/clip mẫu dùng trực tiếp CDN Pexels — khi chạy thật nên chép về Storage/CDN riêng (giữ credit). Clip mẫu ghi nguồn "Pexels" (chưa xác minh tên tác giả).
- Demo: ảnh/clip nằm trong IndexedDB của từng máy; "Xoá dữ liệu trang" sẽ mất. Lý do báo cáo chỉ xem được trong hàng đợi `cloudAdmin` (RBAC) — tab Quản trị của Sự kiện hiện số báo cáo + trạng thái.
- Ảnh bìa thẻ ở Trang chủ chưa đổi (vẫn dạng ngày/tháng gọn).

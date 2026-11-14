# R3 — agent `admin` (14/11/2026)

Phạm vi: `admin.js/.css`, `cloud-admin.js`, `shop.js/.css`, `shop-data.js`, `community.js/.css`, `events.js/.css`, `events-media.js`, `cloud-events.js`.
Test: `tests/suites/83-r3-admin.test.js` (22 test) · chạy riêng `node tests/run.js --only r3-admin`.

## 0. Giới hạn kiểm chứng (đọc trước)

- **Chưa kiểm bằng trình duyệt thật.** Sandbox không có Playwright (Node lẫn Python); trình duyệt MCP chặn `file://`. Mục D (320×568, 360×800, 390×844, 430×932) mới chỉ được kiểm **tĩnh** qua CSS (test `R3-ADMIN-D`) và qua DOM giả của harness. **Không có ảnh chụp** trong `_test/r3-admin/`; ở đó chỉ có bản ghép `app.html` (`python3 scripts/build-single-html.py _test/r3-admin/app.html --offline`) để integrator / agent `ux` mở và chụp.
- **Chưa đọc từng dòng** toàn bộ ~790 KB mã sở hữu. Đọc kỹ: `admin.js`, `cloud-admin.js`, phần danh mục / khung / quản trị / giỏ của `shop.js`, `shop-data.js`, phần kiểm duyệt – chia sẻ – chặn của `community.js`, động cơ demo + Firebase phần bài đăng / bình luận / sản phẩm / đơn của `cloud-events.js`, phần nén – kiểm tệp – autoplay của `events-media.js`. `events.js` (221 KB) chỉ rà theo điểm: báo cáo, chặn, bình luận, review. Bảng lỗi dưới đây vì vậy **không phải danh sách vét cạn**.
- Bộ test toàn cục chạy theo từng suite (lệnh `node tests/run.js` một lượt vượt giới hạn 120 giây của công cụ). Kết quả: mọi suite xanh **trừ 1 test của `82-r3-cloud`** (thiếu `docs/LEGAL-VN.md` — việc đang làm của agent `cloud`).

## 1. Bảng lỗi

| Mã | Mức | File:dòng (xấp xỉ) | Mô tả · tái hiện | Cách sửa | Trạng thái |
|---|---|---|---|---|---|
| R3-ADMIN-01 | **High** | `shop-data.js` (cả file), `shop.js` `visible()/sellable()/hubTeaser()`, `cloud-events.js:307` | 14 sản phẩm **mẫu** hiện và đặt mua được như hàng thật (tên, giá, tồn kho, ảnh dựng). Tái hiện: mở Cửa hàng ở bản mới cài → thêm "Áo thun Dry-fit Easy" vào giỏ → đặt COD thành công. | Cờ `demo:true` cho toàn bộ danh mục mẫu + sản phẩm gieo sẵn; `isReal()`/`storeStateOf()`; khách chỉ thấy hàng thật khi `shopOpen` bật; lớp phủ "chưa mở bán" (mục 2B). | Đã sửa |
| R3-ADMIN-02 | **High** | `admin.js` mục Kiểm duyệt, `cloud-admin.js` `modQueue` | Quản trị không rà được bài Khoảnh khắc / review / bình luận nếu chưa ai báo cáo; hàng đợi không cho biết **ai báo cáo**, không có hạn xử lý → không đáp ứng yêu cầu gỡ nội dung trong 24 giờ. | Mục mới "Bài đăng cộng đồng"; `modQueue` thêm `reporters`, `ageH`, `overdue` (xếp đầu, cảnh báo đỏ); KPI "quá hạn 24 giờ". | Đã sửa |
| R3-ADMIN-03 | Medium | `cloud-events.js:798` (`addComment`) | Bình luận chỉ kiểm độ dài — từ thô tục / quảng cáo lọt thẳng. Tái hiện: bình luận "đ.ị.t m.ẹ" → đăng được. | `cloud-admin.js` `guardPosting()` bọc `addComment/addReview/addPost`: lọc thô tục + từ khoá cấm, mã lỗi `admin/banned-word`. | Đã sửa (demo = thực thi; Firebase = lớp UX, xem Chuyển giao #2) |
| R3-ADMIN-04 | Medium | `community.js` `openShare`, `events.js` bình luận / review | Không ghi nhận người dùng đồng ý điều khoản nội dung (App Store 1.2); không có trang tiêu chuẩn cộng đồng. | `TERMS`, `openTerms()`, ô tick bắt buộc lần đầu đăng giáo án, dòng điều khoản cạnh nút gửi bình luận / review, lưu `state.community.termsAt`. | Đã sửa |
| R3-ADMIN-05 | Medium | — (thiếu tính năng) | Không có từ khoá cấm do quản trị nhập; không có cấm đăng có thời hạn (chỉ có khoá hẳn tài khoản). | `saveSettings({bannedWords})`, `MOD.setCustom()`; `mute/unmute/listMutes/muteOf`. | Đã sửa |
| R3-ADMIN-06 | Medium | `shop.js` `compressPhoto` | Ảnh sản phẩm nhận mọi `image/*` (kể cả SVG) và không giới hạn dung lượng trước khi giải mã → treo máy với tệp rất lớn. | Chỉ JPG/PNG/WebP/HEIC/GIF/BMP, ≤ 15 MB. (`events-media.js` đã kiểm loại + 40 MB ảnh / 25 MB – 60 giây video từ vòng trước.) | Đã sửa |
| R3-ADMIN-07 | Medium | `admin.js` người dùng / kiểm duyệt / nhật ký | Vẽ một lần tới 300 người dùng, 500 dòng nhật ký, toàn bộ hàng đợi → giật trên máy yếu. | `pageOf()/pager()`; 20 người dùng, 10 mục kiểm duyệt, 50 dòng nhật ký mỗi trang. | Đã sửa |
| R3-ADMIN-08 | Low | `admin.js` nhật ký | `esc(...).slice(0,400)` cắt sau khi escape → có thể cắt đôi `&amp;` (hiển thị xấu, không phải XSS). | Cắt trước, escape sau. | Đã sửa |
| R3-ADMIN-09 | Low | `shop.js` `saveEdit` | Không chặn giá quá lớn; giá gốc gạch thấp hơn giá bán vẫn lưu. | Trần 100.000.000 ₫; `compareAt ≥ price`. | Đã sửa |
| R3-ADMIN-10 | Low | `admin.css:169` | Nút trong `.adm-seg` cao 40 px (< 44). | 44 px. | Đã sửa |
| R3-ADMIN-11 | Medium | `functions/commerce.js` `placeOrder`, `firestore.rules` | Firebase: máy chủ chưa biết `shopOpen` / cờ `demo` → client sửa đổi vẫn đặt được hàng mẫu nếu sản phẩm mẫu đã được đồng bộ lên `products`. | Xem Chuyển giao #1. | **Chuyển giao** |
| R3-ADMIN-12 | Medium | `firestore.rules` | Cấm đăng (`mutes/{uid}`) và từ khoá cấm chưa được rules / Function thực thi. | Xem Chuyển giao #2. | **Chuyển giao** |
| R3-ADMIN-13 | Low | `cloud-admin.js` `api._raw`, `cloudEvents._demo` | Bản demo lộ hàm ghi chưa bọc quyền qua Console. | — | Không sửa: đã chấp nhận ở `docs/RBAC.md §10` (demo chỉ mô phỏng; Firebase do rules quyết định). |

Tổng: 0 Critical · 2 High · 6 Medium · 4 Low (+1 Low không sửa). Đã sửa 10, chuyển giao 2.

Các nhóm đã rà mà **không** thấy lỗi mới: XSS ở tên sản phẩm / bài / bình luận / sự kiện trong bảng quản trị và cửa hàng (mọi chỗ qua `esc`, có test với `<img onerror>`); `safeImg` của cửa hàng; rò rỉ `IntersectionObserver` và bảng `GAL` trong `events-media.js` (tự gỡ nút đã rời DOM, giới hạn 300); `setInterval` của bảng quản trị (gỡ khi đóng).

## 2. Nâng cấp

### A. Bảng quản trị theo từng mảng
Mỗi mảng có danh sách + tìm / lọc + phân trang + hành động (thao tác nguy hiểm đều qua hộp xác nhận, phần lớn bắt nhập lý do) + thẻ "Nhật ký …" của riêng mảng (ai · lúc nào · làm gì; chỉ hiện với `audit.view`).

1. **Tổng quan**: thêm ô Bài đăng cộng đồng, Báo cáo chờ xử lý (kèm số quá hạn 24 giờ), Sự kiện, Sản phẩm (kèm trạng thái mở bán), Phản hồi mới; việc cần làm tương ứng.
2. **Người dùng**: phân trang; trong hồ sơ thêm "Cấm đăng có thời hạn" và "Xác minh PT" (trước phải sang mục khác). Đổi vai trò / khoá giữ nguyên theo RBAC.
3. **Bài đăng cộng đồng** (mục mới, `community.moderate` / `reviews.moderate` / `community.feature`): thẻ *Bài đăng* (giáo án chia sẻ + Khoảnh khắc / review; duyệt-khôi phục, ẩn, gỡ, ghim, xem & gỡ bình luận, cấm đăng tác giả) · *Từ khoá cấm* (có ô thử) · *Cấm đăng* (1 / 3 / 7 / 30 ngày, gỡ cấm). Hàng đợi báo cáo vẫn ở mục *Kiểm duyệt*, nay có lý do, người báo cáo, nhãn "Quá 24 giờ".
4. **Cửa hàng**: thẻ trạng thái + nút *Mở bán… / Tạm đóng…*; danh sách sản phẩm (lọc Hàng thật / Mẫu / Đang ẩn / Sắp hết), *Sửa* (mở form sẵn có của `shop.js`: tên, giá, ảnh, mô tả, tồn kho, nhóm), *Ẩn / Hiện*, *Thêm sản phẩm*. Đơn hàng, voucher giữ như cũ.
5. **Sự kiện**: tìm + phân trang; *Người tham gia* (tìm, phân trang, CSV), *Ẩn / Hiện*, *Huỷ…* (kèm lý do), *Mở lại*. Sự kiện do đội ngũ tạo nên **không có bước "duyệt"** — không thêm.
6. **Cài đặt**: bật / tắt Cộng đồng · Cửa hàng · Sự kiện · Tìm PT; banner toàn app. Kho kiến thức, thông báo hệ thống, phản hồi người dùng đã có từ trước — chỉ thêm nhật ký theo mảng.

Hạn chế đã biết: banner được chèn đầu màn hình đang mở mỗi lần chuyển màn; màn nào tự vẽ lại toàn bộ nội dung sẽ mất banner tới lần chuyển màn kế. Tắt tính năng mới chặn `goto()` (Cộng đồng, Sự kiện, Tìm PT) và ẩn 3 lối vào của Cộng đồng; các lối vào khác vẫn hiện và báo "đang tạm tắt" khi bấm.

### B. Cửa hàng chưa mở bán
Khách mở cửa hàng → đầu trang, menu và lưới 8 ô xương vẫn hiển thị nhưng mờ + tối (`blur(7px) brightness(.82)`), `inert` + `aria-hidden`, không cuộn; giữa màn là thẻ kính: "Chưa có sản phẩm nào mở bán" · dòng phụ · nút "Nhận thông báo khi mở bán" (`aria-pressed`, lưu `state.tapShop.notifyOpen`) · nút "Quay lại". Tiêu điểm đặt vào tiêu đề để trình đọc màn hình đọc thẻ. Mọi lối vào (trang sản phẩm, thanh toán, đổi điểm, thẻ Cửa hàng ở màn Sự kiện) đều bị che. Khi có ≥ 1 sản phẩm thật đang hiện **và** bật mở bán → lớp phủ biến mất; người đã bấm nhận tin được báo đúng 1 lần.

**Hai điểm lệch so với đề bài — cần chủ dự án quyết:**
- Dòng phụ đang là "**Cửa hàng** TapEasy đang chuẩn bị. Quay lại sau nhé!" thay vì "Gian hàng…": `docs/GLOSSARY-vi.md §8.4` và test `R2-TERMS` (suite 64) cấm chữ "Gian hàng" trong `shop.js`. Muốn dùng "Gian hàng" phải sửa bảng thuật ngữ + test đó.
- "Nhận thông báo" hiện chỉ lưu **trên máy** và báo bằng toast trong app lần mở kế tiếp. Chưa có thông báo đẩy (cần FCM topic — Chuyển giao #4).

Suite 64 (`fix-commerce`) kiểm luồng giỏ / đơn bằng danh mục mẫu nên tôi bật cờ phát triển `TAPEASY_SHOP_CONFIG.demoCatalog = true` ở đầu suite đó (có ghi chú). Suite 30 (`rbac`): cập nhật danh sách mục của bảng quản trị (thêm `community`).

### C. Tuân thủ
- **Thanh toán**: cửa hàng chỉ có COD / chuyển khoản / VietQR, và danh mục chỉ gồm hàng vật lý (`cat` = wear / gear / souvenir) → hợp lệ ngoài IAP. Không có cổng thẻ, không bán nội dung số. Voucher lấy bằng điểm, không mua bằng tiền. Điều cần giữ về sau: **đừng thêm mặt hàng số** (gói tập, giáo án trả phí) vào kênh này. Trạng thái "chưa mở bán" cũng nên ghi trong ghi chú gửi duyệt store.
- **UGC (Guideline 1.2)**: Báo cáo + Chặn đã có ở giáo án chia sẻ, Khoảnh khắc, bình luận (vòng trước). Vòng này bổ sung phần thiếu: điều khoản phải đồng ý, bộ lọc cho bình luận, công cụ gỡ + cấm đăng, theo dõi hạn 24 giờ. Còn thiếu ở phía máy chủ — xem Chuyển giao #2.

### D. Bố cục
CSS mới dùng `min()`, `clamp()`, `flex-wrap`, `env(safe-area-inset-*)`, vùng chạm ≥ 44 px, chữ ≥ 12 px, input 16 px. **Chưa đo trên trình duyệt** (mục 0).

## 3. Chuyển giao

**#1 → agent `cloud` (`functions/commerce.js`, `firestore.rules`)** — máy chủ phải từ chối đơn khi cửa hàng đóng hoặc sản phẩm là mẫu. Trong `placeOrder`, sau khi đọc `settings/public`:
```js
if(settings.shopOpen !== true || (settings.features && settings.features.shop === false)) throw new HttpsError("failed-precondition", "Cửa hàng chưa mở bán.");
// khi duyệt từng dòng:
if(!p || p.deleted || p.hidden || p.demo === true) { dropped++; continue; }
```
Và cho quản lý cửa hàng bật công tắc (hiện rules đòi `settings.edit`):
```
allow update: if (hasPerm('settings.edit') && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['bank']))
  || (hasPerm('shop.products') && onlyKeys(['shopOpen', 'updatedAt', 'updatedBy']))
  || ((hasPerm('community.moderate')) && onlyKeys(['bannedWords', 'updatedAt', 'updatedBy']));
```
`settings/public` đang `allow read: if signedIn()` → khách chưa đăng nhập luôn thấy "chưa mở bán" (mặc định an toàn). Nếu muốn khách vãng lai xem được hàng: tách `shopOpen / features / banner / bannedWords` sang tài liệu đọc công khai (ví dụ `settings/app`, `allow read: if true`) — báo lại để tôi đổi đường dẫn trong `cloud-admin.js`.

**#2 → agent `cloud` (`firestore.rules`, Functions)** — cấm đăng + từ khoá cấm phía máy chủ:
```
match /mutes/{uid} {
  allow get: if signedIn() && (uid == me() || hasPerm('community.moderate'));
  allow list: if hasPerm('community.moderate') || hasPerm('users.view');
  allow create, update: if hasPerm('community.moderate') && uid != me();
  allow delete: if false;
}
function notMuted() {
  return !exists(/databases/$(database)/documents/mutes/$(me()))
    || get(/databases/$(database)/documents/mutes/$(me())).data.get('liftedAt', 0) > 0
    || get(/databases/$(database)/documents/mutes/$(me())).data.until < request.time.toMillis();
}
```
Thêm `&& notMuted()` vào `create` của `routines/{rid}`, `events/{id}/reviews/{rid}`, `…/mcomments/{cid}`. Từ khoá cấm không so được trong rules → Function `onCreate` (bình luận / review / routine) đối chiếu `settings/public.bannedWords` rồi đặt `hidden:true`.

**#3 → agent `cloud` (`functions/admin.js` `CLIENT_AUDIT`)** — cho phép các hành động mới, nếu không nhật ký Firebase thiếu dòng:
```js
[/^user\.(mute|unmute)$/, ["community.moderate"]], [/^(shop\.(open|close)|community\.keywords)$/, ["settings.edit", "shop.products", "community.moderate"]],
```
(`mod.post.*`, `mod.comment.delete`, `product.save`, `event.save` đã khớp mẫu sẵn có. Ở Firebase tôi tạm ghi mở/đóng bán và từ khoá cấm dưới tên `settings.update`.)

**#4 → agent `cloud` / `ux`** — thông báo đẩy "cửa hàng mở bán": đăng ký topic FCM `shop_open` khi `state.tapShop.notifyOpen.on`, gửi khi `shop.open`.

**#5 → agent `ux`** — `themes-modules.css` là file sinh tự động; tôi đã chạy lại `python3 scripts/gen_themes_layer.py --modules` vì test suite 50 yêu cầu sau khi đổi CSS module (9 dòng khác biệt). Nếu `ux` cũng sửa CSS thì chạy lại lần nữa. Nên có một khe cố định cho banner toàn app trong khung `index.html` (hiện `admin.js` tự chèn vào `.screen.active .content`).

## 4. Tích hợp

- **Không có file mới** → không cần thẻ `<script>/<link>` mới, không thêm mục vào `sw.js` ASSETS. Cần **tăng `CACHE`** trong `sw.js` vì 9 file đã đổi.
- Thứ tự nạp giữ nguyên (`shop-data.js → shop.js`, `community.js`, … → `cloud-admin.js → admin.js`).
- Firebase: collection mới `mutes/{uid}`; khoá mới trong `settings/public`: `shopOpen`, `features{}`, `banner{}`, `bannedWords[]`; trường mới `products.demo`, `events.cancelled / cancelReason`.

## 5. Chuỗi cần dịch

```
"Chưa có sản phẩm nào mở bán" → "No products on sale yet"
"Cửa hàng TapEasy đang chuẩn bị. Quay lại sau nhé!" → "The TapEasy store is getting ready. Check back soon!"
"Nhận thông báo khi mở bán" → "Notify me when it opens"
"Đã bật thông báo mở bán" → "Opening notification is on"
"Quay lại" → "Back"
"Xem cửa hàng" → "View store"
"Cửa hàng TapEasy đã mở bán — vào xem ngay nhé!" → "The TapEasy store is now open — take a look!"
"Tiêu chuẩn cộng đồng" → "Community guidelines"
"Xem tiêu chuẩn cộng đồng" → "View community guidelines"
"Tôi đồng ý" → "I agree"
"Tính năng này đang tạm tắt để bảo trì. Quay lại sau nhé!" → "This feature is temporarily off for maintenance. Check back soon!"
"Nội dung có từ ngữ không phù hợp" → "Your text contains words that are not allowed"
"Tài khoản đang bị tạm dừng đăng bài / bình luận đến" → "Posting and commenting are paused for this account until"
```
Năm mục `TERMS` trong `community.js` và hai dòng `.te-ugc-note` trong `events.js` cũng cần bản tiếng Anh (văn bản điều khoản — nên do người duyệt pháp lý chốt). Chuỗi trong bảng quản trị chưa liệt kê (chỉ nhân sự dùng).

## 6. Việc còn lại cho chủ dự án

1. Chốt "Cửa hàng" hay "Gian hàng" trên thẻ chưa mở bán (mục 2B).
2. Nhập sản phẩm thật (Bảng quản trị → Cửa hàng → Thêm sản phẩm, hoặc Sửa → Lưu một sản phẩm mẫu), điền tài khoản nhận tiền, rồi bấm **Mở bán**.
3. Phân công người trực hàng đợi Kiểm duyệt hằng ngày (hạn 24 giờ) và soạn danh sách từ khoá cấm ban đầu.
4. Duyệt 5 điều "Tiêu chuẩn cộng đồng" về mặt pháp lý.
5. Triển khai các mục Chuyển giao #1–#3 trước khi bật Firebase cho người dùng thật — cho tới lúc đó cấm đăng, từ khoá cấm và trạng thái đóng cửa hàng chỉ được thực thi ở phía client.
6. Mở `_test/r3-admin/app.html` trên máy thật / Playwright ở 4 khổ màn hình để xác nhận bố cục.

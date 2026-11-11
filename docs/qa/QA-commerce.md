# QA-commerce — Cộng đồng · Sự kiện & Thi đua · Gian hàng (TapEasy)

Người kiểm thử: QA lead thương mại điện tử + cộng đồng · 11/11/2026 · **chỉ báo cáo, không sửa file app**.
Phạm vi: `community.js` (+ `cloud-social.js` phần routine/kiểm duyệt), `cloud-events.js`, `events.js`, `events-media.js`, `shop-data.js`, `shop.js` (+ chỗ giao với `cloud-admin.js`, `ui-signature.js`).

## 0. Tóm tắt

| Hạng mục | Kết quả |
|---|---|
| Node (`FitKit/tests/lib/harness.js`, động cơ demo) | **61/84 PASS** · 23 FAIL = lỗi xác nhận (gắn mã QC) · 0 lỗi JS/bất đồng bộ — `_test/qa-commerce/qa_node.js`, `node-results.json` |
| Trình duyệt (Playwright, context riêng **`qa-commerce`**, 390 px & 1280 px, bản ghép `build-single-html.py --embed-shop`) | 4 luồng chính chạy trọn: **mua hàng → huỷ đơn**, **đăng sự kiện có ảnh**, **check-in bằng mã**, **đăng Khoảnh khắc**, **sao chép + chia sẻ routine**. 2 FAIL UX (QC-17, QC-20), **0 lỗi JS** — `browser-results.json`, 40+ ảnh `shots/` |
| Bug | **20 mục**: 5 Cao · 9 Trung bình · 6 Thấp |
| Điểm | **Logic 6,5 · Ổn định 8 · Mượt 8 · Dễ dùng 7,5** (/10) · cảm giác "chuẩn quốc tế" của Store **7,5/10** |

Kết luận ngắn: luồng người dùng **đúng và sạch** (tính tiền, ship, voucher, VietQR, chốt tháng, chống cộng trùng, bắt buộc ảnh/nội dung đều chạy đúng). Điểm yếu tập trung ở **lòng tin vào client**: tiến độ thi đua, điểm, giá đơn, tồn kho, lượt dùng mã giảm giá và check-in đều do máy người dùng quyết định → **chưa đủ an toàn để trao quà/bán hàng thật trên Firebase** khi chưa có Cloud Function đối soát.

---

## 1. Cách làm

1. **Node — `_test/qa-commerce/qa_node.js`** (chạy từ `outputs/`: `node _test/qa-commerce/qa_node.js`). Nạp app thật theo `index.html` qua `createApp()`, đồng hồ giả `setNow()`:
   - Tháng thi đua trọn vẹn: tham gia 3 thử thách → nhật ký 10 buổi/chạy 5 km + 30 phút/nước → tiến độ tự động (loại ngày tháng trước, ngày tương lai, trùng ngày) → nhập tay gian lận (ghi thẳng state) → đẩy tiến độ 999 → sang 01/12 chốt hạng, điểm, huy hiệu, quà → chốt lại lần 2 → rời/vào lại → tham gia hồi tố tháng 10.
   - Điểm: cộng/trừ, không âm, chống trùng ref, NaN/0,4/chuỗi, sửa localStorage, voucher cùng ref.
   - Giỏ & đơn: 8 ca `totals()` (biên 498k/499k, hoả tốc, freeship + hoả tốc, min, %, SL âm/thập phân), giỏ cũ, tồn về 0, đơn vượt tồn, giá giả, SL âm, vòng trạng thái đơn, VietQR, mã giảm giá `uses:1` qua 3 "máy".
   - Media bắt buộc ở lớp dữ liệu (thiếu ảnh, mô tả < 80, khoảng trắng, `blob:/javascript:/http:`, 11 ảnh/2 clip/61 s/26 MB, review < 20 ký tự, 0 sao, check-in), Khoảnh khắc (báo cáo, ẩn), tài khoản phụ review ảo.
   - IndexedDB **treo / thiếu / đầy (QuotaExceededError)**, localStorage đầy.
   - Cộng đồng: 13 ca thô tục + 10 ca không được bắt nhầm + 11 biến thể lách, thích/lưu/sao chép, báo cáo, brigading.
2. **Playwright** — `_test/qa-commerce/pw_shop.js` (kịch bản mua hàng; các luồng khác chạy trực tiếp cùng mẫu): 390×844 và 1280×800, ảnh ở `_test/qa-commerce/shots/`.
3. **Đọc mã + rules** cho các rủi ro chỉ xảy ra ở Firebase (không chạy được emulator).

---

## 2. Bảng bug

Mức độ: **Cao** = mất tiền/quà, gian lận quy mô; **TB** = sai dữ liệu hoặc UX hỏng rõ; **Thấp** = biên/thẩm mỹ.

| ID | Mức | Mô tả | Tái hiện | File:dòng | Đề xuất sửa |
|---|---|---|---|---|---|
| **QC-01** | **Cao** | Tiến độ thi đua do client tự khai → đứng hạng 1, nhận điểm hạng + quà top 3. Rules chỉ chặn `value ≤ target × 5` (20 buổi → cho 100). | `cloudEvents.pushProgress(id,{value:999})` → `listEntries` lưu 999, hạng 1 (Node). Firebase: ghi trực tiếp `entries/{uid}` với `value: 100`. | cloud-events.js:540-541, 722-724 · events.js:586-599 · firestore.rules:324-327 | Cloud Function tính lại tiến độ từ dữ liệu máy chủ (buổi tập đồng bộ, nhập tay có ảnh) hoặc **duyệt top N trước khi trao**; rules: `value ≤ số ngày đã qua × trần/ngày`, cấm ghi sau `end`. Màn "Chốt & trao quà" hiện cờ "nhập tay > 30 %". |
| **QC-02** | **Cao** | Sổ TapEasy Points nằm trong `localStorage` (cả bản Firebase), không chữ ký → sửa thành 50.000 điểm, đổi voucher 120k tuỳ ý. | `state.tapEvents.points.push({delta:50000})` → `balance()` = 50.000 → Store mở khoá mọi mức đổi. | events.js:539-550 · shop.js:914-922 | Chuyển sổ điểm lên máy chủ (`users/{uid}/points`, ghi bằng Function khi check-in/review/chốt tháng); đổi voucher = callable trừ điểm trong transaction. Tạm thời: không cho dùng voucher đổi bằng điểm cho đơn chuyển khoản khi chưa đối soát. |
| **QC-03** | **Cao** | Giá, tổng tiền, giảm giá của đơn do client gửi; mã giảm giá toàn hệ thống (`uses:1`) không bao giờ tăng `used`. | (a) `placeOrder({items:[{pid:"p_jacket",qty:2,price:1000}], total:1000})` → đơn **1.000 ₫** được nhận. (b) Mã `QAONE` uses:1 áp dụng thành công ở **3/3** "máy", `used` vẫn 0. | cloud-events.js:656-662, 809-812 · firestore.rules:407-411 · cloud-admin.js:592-597 · shop.js:339-358 | Function `onCreate orders`: tính lại giá từ `products`, kiểm voucher (`used < uses`, `transaction` tăng `used`), ghi `total` chuẩn; rules cấm client đặt `discount` > 0 khi không có `voucher.code` hợp lệ. Admin thấy cờ "lệch giá". |
| **QC-04** | TB | Trần nhập tay "2 buổi/ngày" chỉ có ở form; lớp tính `progress()` chỉ chặn từng mục ≤ 2 và **không tính buổi tự động** của cùng ngày. | (a) 6 mục ×2 buổi cùng ngày (sửa state/đồng bộ máy khác) → 12 buổi/ngày. (b) Ngày đã có buổi trong app + nhập tay 2 → 3 buổi/ngày (form cho phép). | events.js:298, 940-941 | Trong `progress()`: gộp theo ngày rồi `min(daily, cap)` (buổi: 2, km: 60) **sau khi cộng cả phần tự động**; form tính `sameDay` gồm `daily[d]` tự động. |
| **QC-05** | TB | Lớp dữ liệu cho tham gia thử thách **đã kết thúc** → tham gia hồi tố tháng 10 nhận ngay **+600 điểm** (+ quà nếu top) vì nhật ký cũ đủ chỉ tiêu. UI ẩn nút nhưng API/rules không chặn. | `cloudEvents.joinChallenge("ch_202610_sessions")` + `joined[...]` → `loadAll()` → `settled`, +600 (Node). | cloud-events.js:535-538, 717-720 · events.js:600-619 | Chặn join khi `today > end` (demo + rules: `request.time < end`); `settleAll` bỏ qua khi `joinedAt > end`; Function trao quà chỉ xét entry tạo trước `end`. |
| **QC-06** | **Cao** | Tồn kho không được máy chủ kiểm: đơn vượt tồn vẫn tạo; **SL âm làm tăng kho** (demo); Firebase người dùng thường **không trừ kho** (`writeStock` bỏ qua) → bán vượt. | (a) tồn p_tee navy\|M = 1, đặt 3 → `pending`. (b) đặt `qty:-50` → tồn mũ 51 → 101. (c) Firebase: shop.js:362 return sớm. | cloud-events.js:656-662 · shop.js:360-365 | Function `onCreate orders` trừ `stockBy["màu\|size"]` trong transaction, từ chối khi thiếu; validate `qty` nguyên 1–10 ở client + rules (`items[i].qty`); demo: `placeOrder` kiểm `stockOf` như shop.js:814. |
| **QC-07** | TB | Quản trị chuyển đơn **Đã huỷ → Chờ xác nhận → Đã huỷ**: kho được hoàn **2 lần** (tồn ảo +2 mỗi vòng), mở lại đơn không trừ kho. | Đặt 2 bình (77→75) → huỷ (77) → pending (77) → huỷ (**79**). | cloud-events.js:665-668 · shop.js:842-845, 1066-1070 | Khoá trạng thái cuối (`cancelled`, `delivered`) trong `ostSelect`; hoặc mở lại = trừ kho lại; Function đối soát `stockApplied` (cờ đơn đã trừ/hoàn). |
| **QC-08** | **Cao** | Check-in tự phục vụ dễ lạm dụng: (a) demo `listEvents()` trả kèm **`checkinCode`**; (b) lớp dữ liệu + rules **không kiểm khung giờ** (UI mới kiểm); (c) mã tại chỗ là **1 mã chung** chia sẻ được qua Zalo → điểm 80–250, mở khoá review 5 sao, quà "≥ 2 sự kiện/tháng". | Node: check-in thành công **5 ngày trước** sự kiện; **3 tài khoản phụ** lấy mã từ `listEvents` → check-in + review 5 sao (rating 5,0 · 4 review). | cloud-events.js:547-551, 575-580 · firestore.rules:353-356 · events.js:356 | Bỏ `checkinCode` khỏi `listEvents` demo; rules thêm `request.time` trong [start−2h, end+3h]; mã tại chỗ **xoay vòng 60 s** (QR TOTP) hoặc ưu tiên BTC quét vé cá nhân; giới hạn review theo tài khoản ≥ 7 ngày tuổi / đã xác minh SĐT; điểm check-in chỉ cộng khi BTC quét. |
| **QC-09** | Thấp | Thử thách giảm cân nhận **cân mốc tuỳ ý 30–250 kg**, không so với hồ sơ/lần cân gần nhất → ai khai mốc cao cũng chạm trần 1 %/tuần, bảng xếp hạng hoà ở đỉnh. | Hồ sơ 75 kg, khai mốc 90 → cân 75 → tính trần 1,8 kg (`capped`). | events.js:890-895 | Cảnh báo khi mốc lệch > 5 % so với `inbodyLogs`/hồ sơ gần nhất; mốc cần ảnh cân hoặc dùng lần cân trong app ≤ 3 ngày. |
| **QC-10** | TB | IndexedDB: (a) `indexedDB.open()` không phản hồi (lỗi WebKit đã biết) → `put()` **treo vô hạn**, nút "Đang tải ảnh…" kẹt; (b) không có IDB → lưu `mem` nhưng `putMedia` vẫn trả `idb:<key>` → đăng **thành công giả**, mở lại app mất ảnh. | Node: `put()` > 2,5 s không trả; `indexedDB=undefined` → `k:"mem"`. | events-media.js:154-164, 175-182 · cloud-events.js:649-650 | Timeout 3 s cho `open()` → `usable=false`; `put()` trả `"mem"` → `putMedia` ném lỗi tiếng Việt "Máy không lưu được ảnh lâu dài…" (hoặc lưu dataURL nhỏ). |
| **QC-11** | Thấp | localStorage đầy: `saveState()` ném lỗi bị nuốt → `Points.add` trả `true`, UI báo "+80 điểm" nhưng **không lưu**; tương tự `v.used` sau đặt hàng (voucher dùng lại được sau tải lại). | Giả lập QuotaExceededError → `ok:true`, điểm lưu được = 0. | app.js:98-101 · events.js:480, 543-548 · shop.js:277, 822 | `save()` trả boolean; Points.add hoàn tác khi lưu lỗi + toast "Bộ nhớ đầy"; đặt hàng: đánh dấu voucher trên máy chủ (QC-03). |
| **QC-12** | Thấp | Số trên biểu tượng giỏ đếm cả dòng sản phẩm **đã xoá/không còn bán** (giỏ cũ) trong khi ngăn kéo không hiện → "Giỏ (3)" nhưng chỉ thấy 1 món. | `cart=[p_tee×1, p_old_removed×2]` → `cartCount()=3`, giỏ hiện 1 dòng. | shop.js:318-324 | `cartCount` dựa trên `cartLines()` (khi đã tải danh mục) và dọn dòng mồ côi trong `SH()`; báo "1 sản phẩm không còn bán đã được bỏ khỏi giỏ". |
| **QC-13** | TB | Bộ lọc thô tục lọt các biến thể **dính liền/viết tắt** rất phổ biến: `ditme`, `d.i.t m.e`, `đjtmẹ`, `vailon`, `cc`, `clm`, `d!t me`, `ditmemay`. (Bắt tốt: dấu, teencode đm/vcl, lặp chữ, `f*ck`; 0 bắt nhầm trên 10 câu thường.) | `findProfanity("ditme")` → []. | cloud-social.js:85-120 | Thêm so khớp **chuỗi con** trên bản bỏ dấu cho danh sách gốc mạnh (`dit`, `djt`, `lon` sau `vai`, `dm`+`m`…), map ký tự `! 1 j → i`, danh sách `cc, clm, cl, vkl`; kèm danh sách cho phép (`các`, `lon nước`…) để giữ 0 bắt nhầm. |
| **QC-14** | TB | Báo cáo/kiểm duyệt dễ bị lạm dụng: tác giả **tự báo cáo** routine mình; **3 tài khoản mới** ẩn được routine bất kỳ (kể cả PT đối thủ); giới hạn "10 routine/24 h" chỉ ở client (Firebase spam được). | Node: tự báo cáo → `reports:1`; 3 tài khoản `rep0..2` → `hidden:true`. | cloud-social.js:353, 469-477, 773-778 · firestore.rules:269-301 | Chặn `uid == authorUid`; trọng số báo cáo theo tuổi tài khoản/uy tín, ẩn ở 3 báo cáo **từ tài khoản ≥ 7 ngày** hoặc ≥ 5 báo cáo; rate-limit đăng bằng rules (`userSocial.lastPosts`) hoặc Function. |
| **QC-15** | Thấp | Sao chép routine cũ có từ thô tục → tên giáo án mới giữ nguyên ("Giáo án **vcl** siêu nhanh"); sheet sao chép + toast cũng hiện thô (`esc` không `cleanText`). | `planFromRoutine({title:"Giáo án vcl…"}).name`. | cloud-social.js:337 · community.js:424, 435 | `name: cleanText(r.title)`; dùng `cleanText` ở openCopy/toast. |
| **QC-16** | TB | **Nút "Trượt để đặt hàng" trong Store bị vỡ** ở cả 390 & 1280 px: icon túi **vô hình** (chữ #111 trên nền #111) và núm lệch xuống 22 px (ô xám + khối đen). Lý do: `.tsx button{color:inherit; margin:0}` (0,1,1) thắng `.sig-slide-thumb` (0,1,0). | Checkout bước 3 → ảnh `shots/c390-13b-slide-zoom.png`, `c1280-08-ck3.png`. | shop.css:20 · ui-signature.css:32, 240 | Thêm `color:var(--sig-thumb-ink); margin-top:-22px` vào luật `.tsx .sig-slide-thumb` (ui-signature.css:240). Cân nhắc **bỏ trượt trong Store** (`data-sig-skip` cho `#tsx-place`) — xem §3. |
| **QC-17** | TB | Ô tìm kiếm Cộng đồng **bị vẽ lại** sau mỗi 280 ms dừng gõ (phần tử input bị thay, focus lại bằng JS) → iOS Safari/WebView **đóng bàn phím** giữa chừng, con trỏ nhảy về cuối khi sửa giữa chuỗi. | Playwright: gõ "ppl" rồi " 3" → `#cm-q` là phần tử mới. | community.js:281-282 | Chỉ vẽ lại vùng danh sách (`#cm-list`), giữ nguyên thanh tìm kiếm/bộ lọc. |
| **QC-18** | TB | Bước Thanh toán vẫn cho chọn **Chuyển khoản/VietQR khi chủ app chưa cấu hình ngân hàng** → khách nhận màn "[Số tài khoản]", "[TÊN CHỦ TÀI KHOẢN]" (chữ đỏ "Bản thử nghiệm…"). | Đặt hàng VietQR trên bản hiện tại → `shots/c390-14-done.png`. | shop.js:746-757, 779 | Ẩn 2 phương thức khi `!filled` (chỉ COD) + cảnh báo trong Quản trị; CI kiểm `TAPEASY_SHOP_CONFIG.bank` trước khi build store. |
| **QC-19** | TB | Firebase: sức chứa sự kiện **không có tác dụng** — `register()` so `regCount` nhưng client không được ghi `regCount` và chưa có Function → quá chỗ không giới hạn. | Đọc mã (không có emulator). | cloud-events.js:742-743 | Function `onWrite regs` cập nhật `regCount` + rules `create` kiểm `regCount < capacity` (hoặc callable `register` dùng transaction). |
| **QC-20** | Thấp | Toast lỗi cũ còn hiển thị đè hành động thành công: "Vui lòng chọn size" vẫn hiện khi giỏ đã mở; "Hoả tốc chỉ áp dụng…" còn ở bước 3; toast "Đăng ký thành công" che nút **Check-in ngay**. | Playwright 390 px — `c390-05-cart.png`, `c390-13-ck3.png`, `c390-24-ticket.png`. | shop.js:436-439, 640-650 · events.js:471 | Xoá toast khi thao tác thành công/khi chuyển bước; toast đặt trên vùng an toàn phía trên CTA dính đáy. |

Ghi chú: QC-01/02/03/06/08/19 là các giới hạn **đã được nhắc** trong INTEGRATION-events-shop §8, §9.7 và INTEGRATION-LOG vòng 3 §5 — báo cáo này xác nhận bằng tái hiện và đánh giá **chặn phát hành** cho bản Firebase có quà/bán hàng thật.

---

## 3. UX — nhận xét

### 3.1 Gian hàng so với nguyên tắc Zara / COS — **7,5/10**
Đạt:
- Nền trắng, chữ **Inter Tight 300 in hoa giãn chữ**, menu chữ MỚI · NAM · NỮ · PHỤ KIỆN · TẤT CẢ, lưới ảnh 3:4 khe 2 px, tên + giá 12 px dưới ảnh, nút đen góc vuông, hero editorial toàn chiều rộng — đúng ngôn ngữ Zara/COS (`c390-02`, `c1280-02`).
- 1280 px: header "QUAY LẠI APP · logo · tìm/tài khoản/giỏ" cân, lưới 4 cột, trang sản phẩm 2 ảnh + cột thông tin (`c1280-04`). Rê chuột → ảnh 2 (chỉ tải khi cần).
- Vượt Zara ở chỗ người ta hay chê: ô size dạng nút có trạng thái hết hàng, "Hướng dẫn chọn size" sát ô size, **gợi ý size theo hồ sơ** (175/75 → XL, 160/52 → M), **đổi size ngay trong giỏ**, xác nhận trước khi đổi điểm/huỷ đơn, thanh "Mua thêm … để freeship".
- Không có vùng chạm < 44 px, không chữ < 12 px (đo trên trang sản phẩm).

Chưa đạt:
- **Ảnh dựng ghost-mannequin** sạch nhưng còn "đồ hoạ" — Zara/COS bán bằng ảnh người mẫu; đây là khoảng cách lớn nhất về cảm giác cao cấp.
- **Trượt để đặt hàng** (từ ui-signature) không phải quy ước thương mại điện tử quốc tế, thêm ma sát ở bước chốt đơn, trên desktop lạ; lại đang vỡ hình (QC-16). Khuyến nghị: Store dùng nút đen "ĐẶT HÀNG · 513.000 ₫" như các bước trước.
- Nhãn màu teal "BÁN CHẠY/MỚI" trên lưới — Zara/COS gần như không dùng màu nhấn; nên để chữ đen/xám.
- Hàng chip loại ở NỮ bị ô "Sắp xếp" che ("ÁO KHO…", `c390-03`). Trang sản phẩm desktop: cột thông tin không dính khi cuộn (`.tsx-pd-in` static) dù tài liệu §9.4 ghi "dính".
- Giỏ: "Đổi 0 điểm lấy voucher" khi chưa có điểm (nên "Kiếm điểm khi tập & check-in"); đổi size sang size còn ít không tự hạ SL (chỉ cảnh báo) — nên tự kẹp SL và báo.
- Huỷ đơn: voucher đổi bằng điểm **mất luôn** (đã cảnh báo) — với quỹ điểm nhỏ thì nên hoàn voucher khi đơn chưa xác nhận.

### 3.2 Sự kiện & Thi đua
- Form "bắt buộc ảnh/clip + nội dung" rất tốt: lỗi tiếng Việt cụ thể (đếm 14/80), tô đỏ, cuộn tới ô lỗi, ảnh PNG 2400 px nén về 1600×1067 trước khi lưu (`c390-20`, `c390-21`). Ở 390 px ô ngày bị cắt ("11/11/20") và giờ 12h mất AM/PM nếu máy đặt en-US → nên xếp ngày một hàng, giờ một hàng.
- Vé QR + mã 6 ký tự đẹp, rõ; nhập mã chữ thường vẫn nhận (tự in hoa). Khoảnh khắc hiển thị ảnh lớn, escape đúng HTML người dùng.
- Thanh tab 5 mục cuộn ngang, mục "Quà" bị cắt ở 390 px mà không có gợi ý cuộn (bóng mờ mép phải).
- Trang chi tiết thử thách: bảng xếp hạng + "Nhập tay" rõ ràng; nên hiện **cảnh báo nhập tay chiếm X %** cho chính người dùng (minh bạch, giảm gian lận).

### 3.3 Cộng đồng
- Bảng tin, chi tiết routine, sao chép 2 bước (đặt làm giáo án đang tập / tự gắn video) → chuyển thẳng sang Tập luyện: mượt, đúng kỳ vọng. Xem trước khi đăng báo từ thô tục **ngay khi gõ** — tốt.
- QC-17 là lỗi cảm giác lớn nhất trên điện thoại thật.

### 3.4 Độ mượt (đo trong Chromium)
Mở Store 161–368 ms · mở sản phẩm 109–139 ms · cuộn lưới "Tất cả" ~109 khung/s, 0 khung > 50 ms (máy desktop; cần đo lại trên Android tầm trung) · ảnh lazy + `decoding=async` + kích thước cố định (không nhảy bố cục) · 0 lỗi JS trên mọi luồng.

---

## 4. Rủi ro gian lận / lạm dụng

| # | Kịch bản | Tác động | Mức | Liên quan |
|---|---|---|---|---|
| F1 | Sửa giá trị tiến độ gửi lên bảng xếp hạng | Chiếm top 3 → áo/bình/khăn + 500 điểm mỗi tháng | Cao | QC-01 |
| F2 | Nhập tay "trung thực" nhưng không có bằng chứng; trần/ngày lách qua đồng bộ | Leo hạng đều đặn, khó phát hiện | TB | QC-04 |
| F3 | Tham gia hồi tố thử thách đã kết thúc | +300–800 điểm/tháng "miễn phí" | TB | QC-05 |
| F4 | Sửa sổ điểm localStorage / dùng lại voucher sau khi xoá dữ liệu | Voucher 120k không giới hạn | Cao | QC-02, QC-11 |
| F5 | Sửa giá/tổng đơn, dùng mã `uses:1` nhiều lần, SL âm | Mất tiền hàng, tồn kho sai | Cao | QC-03, QC-06 |
| F6 | Chia sẻ mã check-in tại chỗ qua nhóm chat; check-in trước ngày | Điểm 80–250/sự kiện, đủ điều kiện "quà cộng đồng ≥ 2 sự kiện/tháng" | Cao | QC-08 |
| F7 | Tài khoản phụ check-in + review 5 sao (đánh giá ảo) | Sai lệch rating sự kiện, điểm review +50 mỗi tài khoản | Cao | QC-08 |
| F8 | 3 tài khoản mới báo cáo để ẩn routine/khoảnh khắc của đối thủ | Kiểm duyệt bị vũ khí hoá | TB | QC-14 |
| F9 | Spam routine qua API (rate-limit chỉ ở client), lách bộ lọc bằng viết dính | Bảng tin bẩn | TB | QC-13, QC-14 |
| F10 | Khai cân mốc cao | Hoà đỉnh bảng giảm cân | Thấp | QC-09 |

Đã chống tốt (đã thử, PASS): điểm không âm; cộng trùng theo `ref` (check-in, review, chốt tháng, voucher thưởng); đổi điểm bấm 2 lần chỉ trừ 1; đặt hàng bấm/trượt 2 lần chỉ 1 đơn; 1 người 1 review; báo cáo lặp không cộng; không tự báo cáo **khoảnh khắc** của mình; thích 2 lần chỉ +1; bài BTC cần `events.manage`; ảnh `javascript:/http:/blob:` bị loại; HTML trong review/routine được escape.

**Ưu tiên trước khi bật quà/bán hàng thật trên Firebase**: (1) Function `onCreate orders` (giá, voucher `used`, tồn kho) — QC-03/06; (2) sổ điểm + đổi voucher trên máy chủ — QC-02; (3) duyệt top N + chặn join sau `end` — QC-01/05; (4) check-in theo khung giờ + mã xoay vòng — QC-08; (5) `regCount` bằng Function — QC-19.

---

## 5. Điểm (/10)

| Tiêu chí | Điểm | Lý do |
|---|---|---|
| **Logic** | **6,5** | Tính toán đúng ở mọi ca biên (tổng tiền 498k/499k, hoả tốc, voucher, VietQR CRC, tiến độ 4 chỉ số, trần giảm cân 1 %/tuần, xếp hạng 1-2-2-4, chốt tháng 1 lần). Trừ điểm vì niềm tin vào client (QC-01/02/03/06/08) và các lỗ lớp dữ liệu (QC-04/05/07). |
| **Ổn định** | **8** | 0 lỗi JS / async trong Node và 4 luồng trình duyệt; dữ liệu giỏ cũ chuẩn hoá tốt; IDB đầy báo đúng. Trừ: IDB treo không timeout, "thành công giả" khi thiếu IDB/localStorage đầy (QC-10/11). |
| **Mượt** | **8** | Mở Store < 0,4 s, sản phẩm < 0,15 s, cuộn không khựng, ảnh lazy không nhảy bố cục, nén ảnh trên máy. Trừ: thanh tìm Cộng đồng vẽ lại (QC-17), trượt để đặt hàng thêm ma sát. |
| **Dễ dùng** | **7,5** | Thông báo tiếng Việt cụ thể, gợi ý size, đổi size trong giỏ, form sự kiện hướng dẫn rõ. Trừ: nút trượt vỡ (QC-16), VietQR placeholder (QC-18), toast cũ đè (QC-20), ô ngày bị cắt, tab "Quà" bị che. |

---

## 6. Tệp & cách chạy lại

- `outputs/_test/qa-commerce/qa_node.js` — `cd outputs && node _test/qa-commerce/qa_node.js` → `node-results.json` (84 kiểm tra; FAIL = QC đang mở).
- `outputs/_test/qa-commerce/pw_shop.js` — kịch bản Playwright mua hàng (hàm `async (page)=>{…}`; đặt `globalThis.__qaCommerceW = 1280` để chạy desktop).
- `outputs/_test/qa-commerce/browser-results.json` — kết quả 4 luồng trình duyệt.
- `outputs/_test/qa-commerce/qa-commerce.html` — bản ghép `python3 scripts/build-single-html.py ../_test/qa-commerce/qa-commerce.html --embed-shop`.
- Ảnh: `outputs/_test/qa-commerce/shots/` — Store 390: `c390-01…17`; slide vỡ: `c390-13b-slide-zoom`; Sự kiện: `c390-20…30`; Cộng đồng: `c390-40…45`; Store 1280: `c1280-01…10`.
- Lưu ý môi trường: trình duyệt Playwright dùng chung với các agent khác, context `qa-commerce` bị đóng 2 lần giữa chừng → mỗi kịch bản tự dựng lại trang (route + seed state) trước khi chạy.

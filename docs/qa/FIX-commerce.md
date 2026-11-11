# FIX-commerce — Cộng đồng · Sự kiện & Thi đua · Gian hàng (vòng sửa lỗi 11/11/2026)

Fixer **commerce**. File đã sửa: `shop.js`, `shop.css`, `cloud-events.js`, `events.js`, `events-media.js`, `community.js`, `community.css`, `tests/suites/64-fix-commerce.test.js` (mới). `shop-data.js`, `kb.js/.css`, `kb-data-*.js`, `events.css` **không cần sửa**.
Kit kiểm thử cập nhật (ghi chú bên dưới): `_test/events-media-kit/test_media.js`, `_test/qa-commerce/qa_node.js`.

## 0. Kết quả

| Hạng mục | Trước | Sau |
|---|---|---|
| `_test/qa-commerce/qa_node.js` (QA commerce, động cơ demo) | 61/84 | **83/84** — còn QC-14 phần *routine* (cloud-social.js, chuyển giao pt) |
| `_test/events-media-kit/test_media.js` | 68/71 | **72/72** |
| `_test/shop-kit/test_core.js` · `_test/events-kit/test_core.js` | 50/50 · 86/86 | 50/50 · 86/86 |
| `tests/suites/64-fix-commerce.test.js` | — | **23/23** |
| `node tests/run.js` | quét tĩnh đỏ `community.js:371` | **xanh ở mọi suite** (chạy từng suite: 00…66, 0 fail — lúc chạy cuối) |
| Playwright context riêng `fix-commerce`, 390 & 1280 px, bản ghép `_test/fix-commerce/fix-commerce.html --embed-shop` | — | **27/27 PASS, 0 lỗi JS** (bảng §3), ảnh `_test/fix-commerce/shots/` |

## 1. Bảng mã bug

| Mã | Mức | Trạng thái | Sửa ở (file:dòng) | Test |
|---|---|---|---|---|
| **QS-06** qty HTML trong đơn | Cao | Đã sửa | `shop.js:929` `qtyOf()` ép số 0–99 cho chi tiết đơn, danh sách đơn, CSV; ảnh đơn qua `safeImg` | 64 `QS-06` ×2; PW 1280 (`window.__pwned` = 0) |
| **QS-20** `safeImg` nhận mọi https | Thấp | Đã sửa | `shop.js:62` — chỉ `assets/` (không `..`/`//`), `data:image/*;base64`, `blob:`, https Firebase Storage + `TAPEASY_SHOP_CONFIG.imgHosts` | 64 `QS-20` |
| **QC-03 / QS-08** giá & voucher do client | Cao | Đã sửa (demo) · Firebase = Function | Máy chủ tính lại giá: `cloud-events.js:614` `priceOrder`, `:836` `placeOrder` (cờ `priceMismatch`). Client chỉ gửi món + SL (`shop.js:861` `orderPayload`). Mã toàn hệ thống: giữ chỗ 30 phút `claimVoucher` khi áp mã (`shop.js:380`), tiêu thụ khi đặt; voucher ví có chữ ký `signVoucher` (`shop.js` `grantVoucher`, `migrateVouchers:373`) | 64 `QC-03` ×2; qa_node QC-03 ×2 |
| **QC-06** tồn kho | Cao | Đã sửa | Kho trừ trong cùng lần ghi đơn (`cloud-events.js:836`), không âm, SL nguyên 1–10, vượt tồn → từ chối có lý do; **bỏ `writeStock` phía máy khách** (trước đây trừ/hoàn 2 lần sau bản sửa máy chủ) | 64 `QC-06`; PW 390/1280 (kho −1 đúng 1 lần dù bấm 2 lần) |
| **QC-07** huỷ → mở lại → huỷ | TB | Đã sửa | Cờ `stockApplied` (`cloud-events.js:862`); "Đã huỷ" là trạng thái cuối ở giao diện (`shop.js:933` `nextStatuses`/`ostSelect` chỉ hiện bước hợp lệ, khớp `firestore.rules`) và Firebase `updateOrder` (`cloud-events.js:~1089`); huỷ đơn chưa xác nhận **trả voucher** đúng 1 lần (`cloud-events.js:878`, `shop.js:988`) | 64 `QC-07` ×2; PW 390 |
| **QC-12** đếm giỏ gồm dòng mồ côi | Thấp | Đã sửa | `shop.js:336-352` `sellable`/`cartCount`/`pruneCart` + toast "1 sản phẩm không còn bán…" | 64 `QC-12`; qa_node; PW 390 |
| **QC-16** "Trượt để đặt hàng" vỡ hình | TB | Đã sửa | `shop.js:843` `#tsx-place data-sig-skip="1"` → nút đen "ĐẶT HÀNG · …"; bấm → hộp **xác nhận tóm tắt** (món, tổng, địa chỉ, thanh toán) `shop.js:870` `confirmOrder`; `shop.css` (cuối file) `.tsx-co` + phòng hờ ẩn `.sig-slide` trong Store | 64 `QC-16`; PW 390/1280 (ảnh `m-03-ck3`, `m-04-confirm`, `d-04-confirm`) |
| **QC-18** VietQR khi chưa có STK | TB | Đã sửa | `shop.js:354` `bankReady`/`payOf`; bước 2 chỉ COD + ghi chú khi chưa điền STK; `ACT.pay` chặn chọn bank | 64 `QC-18`; PW 390 (chỉ COD) / 1280 (có STK → 3 cách, đơn VietQR có QR) |
| **QC-20** toast cũ đè | Thấp | Đã sửa | `shop.js:489` `toastOff()` khi thêm giỏ thành công, chuyển bước, `nav()`; toast Store đặt trên CTA dính đáy (`shop.css`); vé sự kiện báo trong vé (`events.js:1182`) | 64 `QC-20`; PW 390/1280 |
| **QC-01/04/05** tiến độ thi đua | Cao/TB | Đã sửa (demo) · Firebase = `recordChallengeProgress` | `cloud-events.js` `sanitizeProgress`/`progressCap`; `events.js:197,298,667,1023` | 64 `QC-01`; qa_node |
| **QC-02/11** sổ điểm | Cao/Thấp | Một phần | Sổ cái băm nối chuỗi + báo lỗi khi bộ nhớ đầy (`events.js:553`); Firebase: đổi điểm qua callable `redeemPoints` (`shop.js:1016`, `cloud-events.js:1102`), chưa có → khoá đổi điểm (không trừ điểm). **Số dư hiển thị vẫn đọc sổ trên máy** (xem Việc còn lại) | qa_node QC-02/11 |
| **QC-08** check-in | Cao | Đã sửa | Bỏ `checkinCode` khỏi `listEvents`; khung giờ [−2 h, +6 h]; review chỉ sau check-in hợp lệ; Firebase: `checkInEvent` (`cloud-events.js:1012`). Đổi thứ tự: **sai mã → "không đúng" trước, đúng mã nhưng sớm → "Chưa tới giờ"** (`cloud-events.js:741`) | 64 `QC-08`; qa_node; PW 390/1280 |
| **QC-09** cân mốc khai cao | Thấp | Đã sửa | `events.js:311` (mốc ≤ 105 % lần cân/hồ sơ, ghi chú), `events.js:960` (cảnh báo + xác nhận) | 64 `QC-09`; qa_node (kiểm tra động) |
| **QC-10** IndexedDB treo/thiếu | TB | Đã sửa | `events-media.js:154` timeout `open()`; `cloud-events.js:823` `putMedia` báo lỗi khi chỉ lưu bộ nhớ tạm; nút tải ảnh trở lại "Thử lại" (`events.js:1748`) | 64 `QC-10`; qa_node (kiểm tra động) |
| **QC-13** lọc thô tục dính liền | TB | Đã sửa | `community.js:29` lớp `MOD` (chuẩn hoá + gốc mạnh + danh sách cho phép), cài lên `cloud.social.moderation` | 64 `QC-13`; qa_node |
| **QC-14** báo cáo bị lạm dụng | TB | Một phần | Khoảnh khắc: trọng số báo cáo theo tuổi tài khoản (< 3 ngày = 0) `cloud-events.js:510`; Routine: chặn tự báo cáo `community.js:114`. **Trọng số báo cáo routine → cloud-social.js (chuyển giao)** | 64 `QC-14` ×2; kit media |
| **QC-15** tên giáo án thô tục | Thấp | Đã sửa | `community.js:89` `sanitizePlan` (`MOD.clean`) + `cleanText` ở sheet/toast | 64 `QC-13` |
| **QC-17** ô tìm Cộng đồng bị vẽ lại | TB | Đã sửa (+ sửa lỗi phát sinh) | `community.js:393` `renderList()` chỉ vẽ `#cm-results`. **Lỗi mới tìm thấy khi viết test:** `st()` tạo bản sao trạng thái mỗi lần gọi → bộ lắng nghe ô tìm giữ bản cũ, từ khoá không lọc. Sửa `community.js:148` (một đối tượng duy nhất) + handler gọi `st()` lúc chạy | 64 `QC-17`; PW 390/1280 (cùng phần tử, giữ focus, con trỏ ở giữa chuỗi, "ppl" → 3/21) |
| **QC-19** sức chứa (Firebase) | TB | Đã sửa phía client | `register` gọi callable `registerEvent` (transaction); rules `hasRoom()` + `regCountAgg` (security) | đọc mã |
| **QS-01** tên bảng xếp hạng vào `confirmDialog` | Nghiêm trọng | Đã sửa (vòng trước, kiểm lại) | `events.js:1922`; `cleanName` `cloud-events.js` | qa_node / 06-security |
| **QS-02** (mẫu) `id` dữ liệu ghi đè `doc.id` | Nghiêm trọng | Đã sửa phần cloud-events | `cloud-events.js` `qData`/`docData`/collectionGroup → `Object.assign({}, d.data(), { id: d.id })` | 21-events, 64 |
| **QS-03** routine → giáo án | Cao | Đã sửa | `community.js:89` `sanitizePlan` | 64 `QS-03` |
| **QS-11** ngày thử thách vào thuộc tính | TB | Đã sửa | `events.js:1003,1010` (`isDs` + `escAttr`) | 64 `QU-19/QS-11` |
| Quét tĩnh `community.js:371` `${s.f.goal === v}` | — | Đã sửa | `community.js:379` → `aria-pressed="${… ? "true" : "false"}"`, `data-cm-goal="${esc(v)}"` | 06-security, 64 (quét 6 file) |
| **QU-05** cuộn giật | TB | Đã sửa (phần commerce) | `shop.css` `.tsx-grid > .tsx-tile{content-visibility:auto}`; `community.css` (cuối) thẻ không `backdrop-filter`, thẻ vẽ theo lô không animation | 64 `QU-05`; PW: 0 khung > 50 ms (Store 168 khung, Cộng đồng 174–176) |
| **QU-06** mở module chậm | TB | Đã sửa Cộng đồng · Một phần Sự kiện/KB/Store | Cộng đồng: khung + 8 thẻ đầu đồng bộ (28 ms), phần còn lại theo lô 16 ms (`community.js:348`). Sự kiện: skeleton có sẵn (`events.js:778`). KB: trang đầu chỉ ~8 thẻ, chi phí chính là nạp `kb-data` (QU-01 — index.html). Store: 14 sản phẩm + content-visibility, mở 93–114 ms | 64 `QC-17/QU-06`; PW |
| **QU-19** đăng sự kiện nhiều chạm | TB | Đã sửa (vòng trước, kiểm lại) | `events.js:1702,1807` nút "Tạo sự kiện"/"Tạo thử thách", Nhân bản, nháp tự lưu, "Thêm chi tiết" | 64 `QU-19`; PW (đăng sự kiện có ảnh) |

### Test cũ đã cập nhật (thay đổi hành vi có chủ đích)
- `_test/events-media-kit/test_media.js` (khối báo cáo): báo cáo từ tài khoản < 3 ngày tuổi **không** tự ẩn bài (QC-14/QS-19) — kit thêm 1 kiểm tra cho tài khoản mới, rồi đặt `global.cloud.profile.createdAt` = 30 ngày trước cho 3 người báo cáo; số đếm thô +1 tương ứng.
- `_test/qa-commerce/qa_node.js`: 2 kiểm tra **ghi cứng `false`** (QC-09, QC-10 — QA quan sát tĩnh) đổi thành kiểm tra động (ghi chú `fix-commerce` trong file, bản gốc giữ ý nghĩa). Không đổi kiểm tra nào khác.

## 2. Chuyển giao

| # | Cho | File:dòng | Đề xuất |
|---|---|---|---|
| 1 | **pt** | `cloud-social.js:524` (demo) và `:601` (Firebase) | QC-14 routine: `r.reports + 1; hidden = reports >= 3` → cộng **trọng số** (tài khoản ≥ 7 ngày = 1, mới = 0; lưu `reportWeight`), ẩn khi trọng số ≥ 3 (Firebase đã có Function `routineReportHeal`). Lưu ý: qa_node có 2 kiểm tra mâu thuẫn (dòng 334 "3 báo cáo → ẩn" dùng 3 tài khoản vừa tạo) — khi sửa, cho 3 tài khoản đó đủ tuổi như kit media. |
| 2 | **ux** | `ui-signature.js:178` | Bỏ mục `#tsx-place` khỏi `SLIDE_TARGETS` (Store dùng nút thường + xác nhận). Hiện đã tránh bằng `data-sig-skip`, CSS phòng hờ trong `shop.css`. |
| 3 | **ux** | `themes-modules.css` | Sau khi mọi fixer xong CSS: `python3 scripts/gen_themes_layer.py --modules` (community.css có thêm luật màu cho thẻ). Lúc chạy cuối suite 50 vẫn xanh. |
| 4 | **security** | `functions/commerce.js` | Đã khớp hợp đồng client: `placeOrder` (trả `{rejected}`), `claimVoucher`, `registerEvent`, `recordChallengeProgress` (số tổng → `capAggregate`), `checkInEvent`, `redeemPoints`, `orderStockSync` (hoàn kho + lượt voucher 1 lần). **Còn thiếu:** (a) **`momentReportHeal`** onCreate `events/{id}/reviews/{rid}/mreports/{uid}`: tính trọng số theo tuổi tài khoản (Auth `creationTime`, ≥ 3 ngày) → ghi `reportWeight`, `hidden` khi ≥ 3 — hiện client tự ghi `w` (`cloud-events.js` fire.report), rules nên cấm trường `w`/`reportWeight` từ client; (b) voucher do **settleChallenge / quà** cấp cho người ngoài top (voucher 15 %) phải tạo `vouchers/{code}` `owner=uid, uses:1` — client Firebase hiện từ chối voucher ví không có bản ghi máy chủ (`cloud-events.js` fire.placeOrder: "Voucher này chưa được máy chủ xác nhận"); (c) `claimVoucher` nên giữ chỗ thật (doc `voucherHolds/{code}_{uid}` 30 phút, đếm vào `used + holds < uses`) để mã `uses:1` không hiện "áp dụng thành công" ở nhiều giỏ; (d) rules `orders.update` (onlyKeys) — `admin.js:571` chỉ gửi `status` nên khớp; nếu sau này ghi `paid/carrier` cần mở thêm khoá. |
| 5 | **core** | `app.js` `saveState` | QC-11: trả boolean khi `QuotaExceededError` để module báo "Bộ nhớ đầy" (events.js đã tự kiểm). |

## 3. Kiểm thử trình duyệt (Playwright, context `fix-commerce`, tự đóng sau khi chạy)

| Luồng | 390 px | 1280 px |
|---|---|---|
| Mở Store / sản phẩm / chọn size (thiếu size → báo tại chỗ) / thêm giỏ — toast cũ không còn | PASS (93 ms) | PASS (114 ms) |
| Thanh toán: chưa có STK → chỉ COD · có STK → COD/CK/VietQR | PASS | PASS |
| Bước 3: nút "Đặt hàng · 279.000 ₫" (không trượt, chữ trắng/nền đen) → hộp xác nhận tóm tắt → đặt (bấm đúp) = 1 đơn, kho −1 | PASS | PASS (đơn VietQR có mã QR, chờ chuyển khoản) |
| Huỷ đơn chưa xác nhận → kho hoàn đúng 1 lần · giỏ mồ côi được dọn | PASS | — |
| QS-06: đơn có `qty` là HTML mở trong phiên quản trị → không chạy | — | PASS |
| Đăng sự kiện có ảnh qua form quản trị (PNG 2000–2400 px → nén 1600 px, lưu IndexedDB); thiếu ảnh bị chặn bằng tiếng Việt | PASS | PASS |
| Đăng ký qua form (tích xác nhận sức khoẻ) → vé → check-in bằng mã: sai mã "không đúng", đúng mã (chữ thường) → checked_in, +100 điểm | PASS | PASS |
| Cộng đồng: gõ "ppl", " 3", sửa giữa chuỗi → cùng phần tử `#cm-q`, giữ focus, con trỏ đúng; "ppl" lọc 3/21; lô đầu 8 thẻ trong 28 ms | PASS | PASS |
| Cuộn lưới Store / bảng tin Cộng đồng — khung > 50 ms | 0 | 0 |

## 4. Việc còn lại
- Firebase: số dư TapEasy Points hiển thị vẫn từ sổ trên máy (`events.js` `TapEv.points`) — nên đọc `myPoints` khi `cloudEvents.mode === "firebase"` và chỉ dùng sổ máy làm bộ đệm (cần quyết định UX khi offline).
- QU-06 Kho kiến thức / Sự kiện: phần lớn chi phí là nạp dữ liệu lúc khởi động (QU-01, nạp lười theo màn — `index.html`/`app.js`).
- Ảnh người mẫu cho Store (QA §3.1) và nhãn teal "BÁN CHẠY/MỚI" — việc thiết kế, chưa làm.

---

## Vòng 2 (12/11/2026) — xử lý "Chuyển giao" (`docs/qa/HANDOFF-ROUND-BRIEF.md` mục commerce)

File đã sửa: `kb.js`, `kb.css`, `events.js`, `events.css`, `cloud-events.js`, `community.js`, `community.css`, `shop.js`, `tests/suites/64-fix-commerce.test.js` (+7 test, 30/30). `shop-data.js`, `kb-data-*.js`, `events-media.js` không cần sửa.

### Kết quả kiểm thử
| Hạng mục | Kết quả |
|---|---|
| `node tests/run.js` (chạy từng suite `--only`, công cụ cắt 100 s) | **24 suite · 553/553 xanh** (00…66, lúc chạy cuối) |
| `tests/suites/64-fix-commerce.test.js` | 23 → **30/30** |
| `_test/qa-commerce/qa_node.js` | **84/84** (trước 83/84 — xem ghi chú test) |
| `_test/events-media-kit/test_media.js` · `_test/shop-kit/test_core.js` · `_test/events-kit/test_core.js` | **72/72 · 50/50 · 86/86** |
| Playwright context riêng `fix-commerce` — phục vụ THƯ MỤC FitKit thật (nhiều file, fk-lazy.js thật), 390 & 1280 px | **0 lỗi JS**; ảnh `_test/fix-commerce/shots/r2-m-*.png`, `r2-d-*.png`; kịch bản `_test/fix-commerce/pw_r2.js` |

### Bảng việc
| # | Việc | Trạng thái | Sửa ở (file:dòng) | Test |
|---|---|---|---|---|
| 1 | **fkLazy** — `kb.js` chờ `fkLazy.load('kb')` | Đã sửa | `kb.js:297` `DATA`/`ensureData()` (không bao giờ reject; gọi `G.fkLazy.load("kb")`, không có fkLazy → kiểm dữ liệu sẵn), `:329` khung chờ / lỗi "Không tải được Kho kiến thức" + **Thử lại** (`data-kb-act="retry"`, `:864`), `:733` `render()`, `:753` `openArticle()` chờ dữ liệu rồi mở đúng bài, `:1101` "Tìm hiểu thêm" ở chi tiết bài tập chèn sau khi nạp, `:1195` `adminList()` trả Promise khi chưa nạp (admin.js đã `await`), deep link `?kb=` qua `whenReady`, `:1133` nghe `fk:lazy:kb` (fk-lazy.js nạp trước lúc rảnh → ô "Kiến thức hôm nay" có bài). **Tương thích:** dữ liệu đã có (thẻ script thường / test Node / bản 1 file) → nạp đồng bộ như cũ; chưa có fkLazy → dùng dữ liệu sẵn, thiếu thì báo lỗi + Thử lại. API mới `TEKB.ready()`, `TEKB.whenReady(fn)`, `TEKB.dataState` | 64 `R2-LAZY`; PW: lúc mở app **0** file kb-data được tải; vào Kho → kb-data-3 lỗi mạng → màn lỗi + Thử lại → nạp tiếp (87 bài, không nhân đôi) |
| 2 | **"Chặn người này"** (App Store 1.2) — API thật `cloud.js:492–503`; rules đã chặn người bị chặn bình luận (`firestore.rules:527`) (`blockUser(uid,{name,reason})`, `unblockUser`, `listBlocked`, `isBlockedSync`) | Đã sửa | **Sự kiện** `events.js:1169` `ensureBlocks`/`blockedUid`/`blockUserFlow` (xác nhận `confirmDialog`, chưa đăng nhập → "Cần đăng nhập"); nút chặn ở thẻ Khoảnh khắc (`:1448`, không có ở bài của mình / bài BTC) và từng bình luận (`:1523`, kèm dòng "N bình luận của người bạn đã chặn được ẩn"); lọc ở `momentsListHTML`/`reviewsHTML`, tải danh sách chặn trước khi vẽ (`loadMoments`, `refreshEvPosts`, `openEvent`, `openComments`); ACT `mo-block`, `cmt-block` (`:2103`). **Cộng đồng** `community.js:269` `loadBlocks`/`blockAuthor`/`openBlocked`; nút "Chặn người này" ở chi tiết giáo án chia sẻ (`:570`, không có với TapEasy Team / của mình) và hồ sơ tác giả; lọc bảng tin (`:374`), thẻ Trang chủ (`:777`), mở chi tiết người đã chặn → thông báo; mục **"Người đã chặn (N)"** cuối màn Cộng đồng → danh sách + **Bỏ chặn** | 64 `R2-BLOCK` ×2; PW 390: chặn tác giả B → biến khỏi bảng tin, "Người đã chặn (1)", bỏ chặn → hiện lại; chặn bình luận C → ẩn + ghi chú; chặn tác giả Khoảnh khắc → 7 → 6 bài |
| 3 | **FIX-security #4** — đường dự phòng ghi thẳng ở Firebase | Đã sửa | `cloud-events.js:939` `SERVER_NEEDED = "Cần máy chủ — thử lại sau"`; `pushProgress` (`:984`) và `register` (`:1025`) ném lỗi thay vì `set()`; `placeOrder` (`:1105`) báo "Cần máy chủ — thử lại sau. Cửa hàng chưa nhận được đơn — giỏ hàng vẫn được giữ."; `saveEvent` (`:993`) gọi **`checkinCodeNow`** (mã xoay vòng 60 giây) và xoá trường `code` rõ cũ; Function chưa có → chỉ lưu `codeHash = sha256(id:code)` (WebCrypto, khớp `functions/commerce.js codeMatches`). Mới `checkinInfo(id)` (`:1012`, API `:1172` — demo đi qua `getCheckinCode` đã bọc RBAC). `events.js:2001` bảng mã tại quầy: chế độ xoay vòng tự làm mới mã + QR theo `expiresAt`, không in; `:1869` form sự kiện: mã băm/xoay vòng → ô mã để trống = giữ mã cũ | 64 `R2-SRV` (đọc mã nhánh Firebase — không có emulator) |
| 4 | **FIX-core §2 QC-11** — đọc giá trị `saveState()` | Đã sửa | `events.js:495` `save()` trả boolean; `settleAll` (`:666`) điểm/voucher không lưu được → **chưa chốt** thử thách, hoàn tác cờ `settled`, không chúc mừng, báo "Bộ nhớ máy đầy…" (ref chống cộng trùng lần sau); điểm danh (`:1288`) / review (`:1387`) không báo "+N điểm" khi chưa lưu. `shop.js:292` `save()` boolean; `grantVoucher(v,{noSave})` (`:361`) lưu lỗi → gỡ voucher; `redeemNow` (`:1030`) thêm voucher rồi `Points.add` lưu CẢ HAI trong 1 lần ghi, lỗi → hoàn tác voucher, điểm giữ nguyên, báo "Bộ nhớ máy đầy"; đặt hàng (`:918`) đơn đã ở máy chủ → giữ trạng thái, báo máy chưa lưu | 64 `R2-QC11` (giả lập `saveState` trả false) |
| 5a | **QU-36** lưới 2 cột ≥ 1024 px | Đã sửa | `events.css:617` `.te-list`/`.te-mo-list` (thi đua, sự kiện, Khoảnh khắc) `repeat(auto-fill, minmax(min(100%,320px),1fr))`; `community.css:276` `.cm-grid` 2 cột; `kb.css:309` `.kb-list`/`.kb-faqs` (trang đọc giữ 1 cột). Bám `html[data-screen=…]`; minmax 320 → khung điện thoại 460 px vẫn 1 cột. ux đã mở khung rộng (`ui-kit.css:149–151`) | 64 `R2-QU36`; PW 1280: kb/cm/sự kiện/thử thách/Khoảnh khắc đều **2 cột × ~388 px** trong khung 788 px; Trang chủ giữ 460 px |
| 5b | **Thuật ngữ §8.4** (chỉ chữ hiển thị) | Đã sửa | "Gian hàng"/"TapEasy Store"/"Store" → **Cửa hàng** (tab `shop.js` `label:"Cửa hàng"`, logo, aria, `events.js` menu Hồ sơ, `cloud-events.js` quà); "TapEasy Points" → **Điểm TapEasy**; "Check-in" → **Điểm danh** (nút, vé, quầy, CSV, lỗi máy chủ demo, nội dung sự kiện mẫu); "Routine" → **Giáo án chia sẻ** (~40 chuỗi `community.js`) + "Chương trình của tôi" → "Giáo án của tôi". Giữ nguyên id/khoá: `checked_in`, `data-te="checkin"`, `ci_*`, `type:"routine"`, `A.report("routine"…)`, `fromRoutine`, tên hàm | 64 `R2-TERMS`; PW: tab Quà có "Điểm TapEasy", 0 chuỗi cũ; logo Cửa hàng |

### Test cũ đã cập nhật (so chuỗi cũ — đổi có chủ đích theo GLOSSARY §8.4)
- `tests/suites/09-integration-r2.test.js:47` `/Gian hàng/` → `/Gian hàng|Cửa hàng/`.
- `tests/suites/21-events.test.js:97` "Sự kiện, quà &amp; gian hàng" → chấp nhận "gian|cửa hàng".
- `tests/suites/64-fix-commerce.test.js` QC-17: đếm "N routine" → "N (routine|giáo án chia sẻ)".
- `_test/events-kit/test_core.js:173`, `_test/qa-commerce/qa_node.js:238`: lỗi "review khi chưa check-in" so `/check-in|điểm danh/`.
- `_test/qa-commerce/qa_node.js:334`: kiểm tra "≥ 3 báo cáo → tạm ẩn" dùng 3 tài khoản VỪA TẠO, mâu thuẫn với kiểm tra kế tiếp (QC-14) sau khi pt áp trọng số theo tuổi tài khoản → đo lại bằng 3 tài khoản **đủ 7 ngày tuổi** (createdAt lùi 30 ngày trong kho demo). Kết quả 84/84.

### Chuyển giao (vòng 2)
| # | Cho | File:dòng | Đề xuất |
|---|---|---|---|
| 1 | **ux** | `themes-modules.css` | Chạy lại `python3 scripts/gen_themes_layer.py --modules` (community.css/events.css có luật mới: nút chặn, danh sách "Người đã chặn"). |
| 2 | **ux** | `tests/lib/harness.js:23` `scriptOrder()` | Regex vẫn nạp cả thẻ `type="text/fk-lazy"` → test Node chạy dữ liệu nạp sẵn (kb.js dùng nhánh "dữ liệu đã có"). Nhánh nạp lười đã có test riêng (64 `R2-LAZY`, fkLazy giả). Nếu muốn harness mô phỏng đúng trình duyệt: bỏ qua thẻ `text/fk-lazy` + cài `fkLazy._inject` chạy file trong vm. |
| 3 | **pt** | `pt-connect.js`/`ptprofile.js`/`findpt.js` | Mục "Người đã chặn" của pt (Hồ sơ/Tài khoản) và của Cộng đồng dùng chung `cloud.listBlocked/unblockUser` — có thể trỏ nhau; chữ hướng dẫn trong hộp xác nhận commerce đang ghi "Cộng đồng → Người đã chặn". |
| 4 | **core** | `app.js` (confirmDialog) | Không bắt buộc: `confirmDialog` gọi `onConfirm()` rồi `closeSheet()` ngay — callback async không giữ tấm được khi lỗi. Commerce đã tự báo lỗi bằng toast. |

### Việc còn lại
- Số dư Điểm TapEasy ở Firebase vẫn đọc sổ trên máy (như vòng 1, §4).
- Tên người bình luận ở chế độ demo lấy `state.profile.name` của máy (nhiều tài khoản trên 1 máy hiện cùng tên) — hành vi demo có sẵn, không ảnh hưởng Firebase.

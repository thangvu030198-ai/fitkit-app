# Vòng 2 sửa lỗi — xử lý "Chuyển giao" (11/11/2026, 23:00)

Hiện trạng: `node tests/run.js` **492/492 xanh**. Quy tắc làm việc, bảng sở hữu file: giữ nguyên `docs/qa/FIX-ROUND-BRIEF.md` (đọc lại). Mỗi agent ghi thêm mục **"Vòng 2"** vào cuối `docs/qa/FIX-<fixer>.md` của mình và thêm test vào suite của mình (60…66). Không sửa file của người khác.

Thuật ngữ hiển thị: theo `docs/GLOSSARY-vi.md` §8 (deload → "tuần giảm tải", Routine → "Giáo án chia sẻ", "Gian hàng"/"TapEasy Store" → "Cửa hàng", "TapEasy Points" → "Điểm TapEasy", Check-in → "Điểm danh"; RPE/RIR ẩn hoặc giải thích ở cấp Mới tập). Chỉ đổi CHỮ HIỂN THỊ, không đổi id/khóa dữ liệu/tên hàm; cập nhật test nếu test so chuỗi cũ.

## Hợp đồng nạp lười dữ liệu (fkLazy)
- **ux** thêm vào `ui-kit.js` (hoặc script nhỏ nạp sớm trong `<head>`): `window.fkLazy = { load(group) → Promise }`, nhóm: `exdbvi` = `exdb-vi*.js`, `kb` = `kb-data-*.js` (kiểm tên file thật). Nạp tuần tự, nhớ đã nạp, resolve ngay nếu dữ liệu đã có sẵn; lỗi mạng → reject để module hiện trạng thái lỗi + thử lại. Bản ghép 1 file (`build-single-html.py`) và `sw.js`/`prepare-www.sh` phải vẫn có các file này (nhúng/precache).
- **training** (`library.js`, `exdb*.js`…) và **commerce** (`kb.js`) gọi `await (window.fkLazy ? fkLazy.load('<nhóm>') : Promise.resolve())` trước khi dùng dữ liệu (tương thích cả khi thẻ script còn trong index.html).
- **ux** CHỈ gỡ thẻ `<script>` dữ liệu khỏi `index.html` SAU KHI `grep fkLazy.load library.js kb.js` thấy bên tiêu thụ đã cập nhật và test xanh. Nếu tới cuối việc bên kia chưa xong → giữ thẻ, ghi lại.

## Việc theo người
### core (`app.js`, `pt.js`)
1. QU-18 menu ☰ (`app.js:598 teMenuOrganize`) 22 → ≤ 12 mục theo đề xuất FIX-ux §3 (bỏ trùng thanh dưới, gộp "Giáo án", gộp "Sự kiện").
2. QU-21 màn Tiến độ: tab "Kỷ lục" (thẻ kỷ lục cá nhân), đổi nhãn menu "Ảnh tiến trình & InBody" → "Tiến độ".
3. QU-02 `appBoot` nhường luồng (việc phụ vào `requestIdleCallback`/`setTimeout` sau khung đầu); QU-04 `mountWelcomeVideo`: không gọi Pixabay API lúc mở, dùng poster tĩnh + video cục bộ/đã biết.
4. QN-10 `recomputeProfile`: < 18 tuổi "tăng cơ" → `round(EER × 1,05)`.
5. Training §4.4–4.5: `fkPrefillRows` gọi `FKTP.ensureRows` nếu có (một nguồn điền sẵn); `finishSession` chỉ ghi `finishedDates`/`workoutLog`/streak khi buổi ≥ 3 phút HOẶC ≥ 1 hiệp có số lần.
6. Thuật ngữ §8.4 phần app.js/pt.js; chữ < 12 px còn trong app.js (QU-31).

### training (`library.js`, `exdb*.js`, `training-pro.js`, `achievements.js`, …)
1. fkLazy: `library.js`/nơi dùng `exdb-vi` gọi `fkLazy.load('exdbvi')`.
2. Thuật ngữ: training-pro.js "deload" → "tuần giảm tải" (≈ 56 chỗ hiển thị), RPE/RIR giải thích ở cấp Mới tập.
3. Lắng nghe `fk:health-ready` (nutrition phát) thay cho dự phòng hiện có, nếu có.

### nutrition (`health-safety.js`, `nutrition*.js`, `meals*.js`, `data.js`)
1. FIX-core §1: `#hs-overlay` = `role="dialog" aria-modal="true"`, focus nút đầu, giữ focus/`inert` nền, Esc = "Để sau".
2. FIX-training §4.3: gán `window.FKHealth` (phần logic thuần `hsFlags`/`itemTags`) sớm + phát sự kiện `document.dispatchEvent(new Event('fk:health-ready'))`.
3. FIX-core §5: bản đè `openFoodQuantity` (`nutrition-pro.js:~1190`) đọc số bằng `fkNum` của app.js nếu có.
4. QU-03: ghi nhớ `buildDayPlan` theo (ngày, hồ sơ, tuỳ chọn); phần "Thực đơn gợi ý"/"Đi chợ" vẽ lúc rảnh.
5. Tuỳ chọn "Ẩn số calo" (người có tiền sử RLĂU — mặc định BẬT khi khai RLĂU): ẩn kcal/đồng hồ calo, giữ khẩu phần/nhóm thực phẩm.
6. Nút (i) "Vì sao đạm X g?" giải thích công thức theo hồ sơ.

### pt (`cloud-social.js`, `pt-connect.js`, `findpt.js`, `ptprofile.js`, `coach.js`, `pt-pro.js`, `cloud-pt-directory.js`)
1. FIX-security #1: `CODE_RE` nhận 6–10 ký tự, `normalizeCode(...).slice(0,10)` (security đổi `JOIN_CODE_LEN = 8` trong cloud.js — phối hợp: code của bạn phải chạy được với cả mã 6 lẫn 8).
2. FIX-security #2: ở Firebase không gọi `systemMessage()` từ client (Function đã ghi).
3. Nút **"Chặn người này"** (App Store 1.2): chat `pt-connect.js`, hồ sơ PT/yêu cầu (`ptprofile.js`/`findpt.js`) → `cloud.blockUser(uid,{name,reason})`; lọc bằng `cloud.isBlockedSync(uid)` sau `await cloud.listBlocked()`; mục "Người đã chặn" (bỏ chặn) — đặt trong màn PT/Tài khoản thuộc file bạn. Đọc API thật trong `cloud.js`.
4. QC-14: `cloud-social.js:524/601` báo cáo routine theo **trọng số** (tài khoản ≥ 7 ngày = 1, mới = 0), ẩn khi trọng số ≥ 3.
5. FIX-core §4: lọc dữ liệu lúc nhập `planFromRoutine` và `pt-connect.js toPlanItem` (whitelist intensity, cắt độ dài, ép số, `safeUrl(img,{noBlob:true})`).
6. QU-36: ≥ 1024 px lưới 2 cột thẻ PT (bám `html[data-screen="findpt"]`); thuật ngữ §8.4 phần của bạn.

### commerce (`events*.js`, `cloud-events.js`, `community.js`, `shop*.js`, `kb*.js`)
1. fkLazy: `kb.js` gọi `fkLazy.load('kb')`.
2. Nút "Chặn người này" ở bình luận/Khoảnh khắc (`events.js`) và routine (`community.js`) + ẩn nội dung người đã chặn.
3. FIX-security #4: đường dự phòng ghi thẳng khi Function chưa deploy (`placeOrder`, `pushProgress`, `register`) → ở chế độ Firebase báo "Cần máy chủ — thử lại sau" thay vì ghi; `saveEvent` dùng `checkinCodeNow` (mã xoay vòng) thay vì lưu mã rõ.
4. FIX-core §2 QC-11: đọc giá trị trả về `saveState()` (`events.js:480,543–548`, `shop.js:277,822`); `false` → hoàn tác cộng điểm/đánh dấu voucher, báo "Bộ nhớ đầy".
5. QU-36: lưới 2 cột ≥ 1024 px cho Sự kiện/Cộng đồng/Kho kiến thức; thuật ngữ §8.4 (Cửa hàng, Điểm TapEasy, Điểm danh, Giáo án chia sẻ).

### security (`functions/**`, `cloud.js`, rules, workflows `build-*.yml`)
1. `momentReportHeal` (onCreate `events/{id}/reviews/{rid}/mreports/{uid}`, trọng số theo tuổi tài khoản) và bản ghi máy chủ cho voucher ngoài top (FIX-commerce §2 #4).
2. FIX-pt §3: rules `clients/{cid}/sessions` nhận `statusLog` học viên nối khi scheduled→done; `ptListings/{lid}/reviews` cho `editedAt`, `editedAfterReply`; kiểm `cleanupUserData` đủ các mục FIX-pt liệt kê.
3. `cloud.js:43 JOIN_CODE_LEN = 8` (sau khi pt nhận 6–10 ký tự — kiểm `grep CODE_RE cloud-social.js`; nếu chưa → để 6, ghi lại).
4. Integrator việc chưa có chủ (giao cho bạn): `.github/workflows/media-food.yml` truyền `env: PIXABAY_KEY: ${{ secrets.PIXABAY_KEY }}`; `.github/workflows/ios-appstore.yml` đổi "FIT KIT" → "TapEasy" trong chuỗi quyền + entitlement `com.apple.developer.applesignin`; `package.json` thêm `@capacitor-firebase/authentication` (phiên bản tương thích Capacitor 6) — không chạy npm install nếu không có mạng; ghi chú.
5. Chạy lại 109 + 63 kịch bản rules.

### ux (`index.html`, `style.css`, `sw.js`, `ui-kit.*`, themes, scripts build, `docs/DESIGN-SYSTEM.md` mục màu)
1. fkLazy (xem hợp đồng trên) + gỡ thẻ dữ liệu khi bên tiêu thụ sẵn sàng; cập nhật `sw.js`, `prepare-www.sh`, `build-single-html.py`.
2. FIX-nutrition #4: `.topbar` màn Dinh dưỡng có nền khi cuộn (không đè nội dung).
3. FIX-pt §3: chuyển gốc `.pp-nav`, `.pp-chips span`, `.pp-cta` bỏ `backdrop-filter` trong `style.css`; `.stat-box .cap` ≥ 12 px; `.seg button` min-height 44 px.
4. FIX-commerce #2: bỏ `#tsx-place` khỏi `SLIDE_TARGETS` (`ui-signature.js:178`).
5. FIX-security #6: `prepare-www.sh` cảnh báo/dừng khi build store mà `firebase-config.js` trống (biến `STORE_BUILD=1`).
6. `docs/DESIGN-SYSTEM.md:34–37` cập nhật `--on-coral` #061A24 (6,9:1).
7. Thêm màn vào danh sách khung rộng ≥ 1024 px (`ui-kit.css:139`) khi pt/commerce đã có lưới 2 cột.
8. **Cuối cùng** (sau khi các agent khác báo xong hoặc tới cuối việc của bạn): `python3 scripts/gen_themes_layer.py --modules` và chạy lại `node tests/run.js`.

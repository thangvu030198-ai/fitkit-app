# FIX-integrator — cuối vòng sửa lỗi QA (12/11/2026)

Integrator xử lý mọi mục "Chuyển giao" của **Vòng 2** còn mở trong `FIX-core/training/nutrition/pt/commerce/security/ux.md`. Ở vòng này integrator là người duy nhất sửa code, nên được sửa mọi file.
Test: `tests/suites/67-fix-integrator.test.js` (**20/20**). Không đổi khoá `fitkit_state_v1`. Mọi file JS đã sửa đều qua `new Function` / `node --check`.

## 1. Kết quả

| Hạng mục | Kết quả |
|---|---|
| `node tests/run.js`, chạy theo nhóm `--only` vì công cụ cắt lệnh sau khoảng 100 s | **25 suite · 573/573 xanh**. Trước vòng: 553/553. Thêm 20 test của suite 67 |
| `python3 scripts/gen_themes_layer.py --modules` | 1 622 luật từ 13 file CSS. Kết quả **trùng byte** với `themes-modules.css` hiện có |
| `_test/qa-pt/qa_lifecycle.js` | **45/46**, như vòng trước. Ca còn đỏ là B01: kịch bản ghi cứng FAIL và cần quyết định nghiệp vụ |
| `_test/qa-commerce/qa_node.js` | **84/84** |
| `_test/qa-nutrition/qn-plan.js` (658 ngày) | kcal ±5 %: **96 %** (trước 88 %) · đạm ±15 %: **100 %** (trước 88 %) · carb 100 % · béo 100 % · xơ 100 % |
| `qn-safety.js` | Món tái trong thực đơn thai phụ: **0** (trước 3). Danh sách Đổi món không còn món tái |
| `qn-data.js` (chạy lại `dump.js` trước) | Dấu ✗ còn **12** (trước 22). Lệch so với bảng tham chiếu: 0 (trước 7). Còn lại: bia (Atwater), 3 món có bước để thịt tái, 4 món chỉ có 1 bước, 3 món có "tip" ghi số kcal cũ. Các món tái đã có cảnh báo thai kỳ ở `qn-safety` |
| Rules: `_test/fix-security/rerun-qa-109.js` (109 ca QA) | Khớp **85/109**, như vòng 2. Còn tái hiện 3 lỗ hổng A3/D4/H2, đã giải thích trong FIX-security |
| Rules: `_test/fix-security/rules-fix.test.js` | **85/85** |
| `_test/qa-security/rbac-attack.test.js` | ✓ 81 · ✗ 7. Cả 7 là ca đã biết: QS-05/13/15/16 thuộc bản demo hoặc phía máy chủ |
| Bản dùng thử `FitKit-dung-thu.html` (`--embed-shop`, 6,4 MB) | Playwright, ngữ cảnh riêng `integrator` (host `integrator.test`), 390×844, cảm ứng, chặn mạng ngoài. Đi 10 màn: Trang chủ, Tập luyện, Dinh dưỡng, Kho video, Tiến độ/Kỷ lục, PT, Sự kiện, Cộng đồng, Hồ sơ, Cửa hàng. **0 lỗi JS** (`pageerror`, `console.error`, `window.onerror`). Lúc 2,5 s không có popup thành tích. Trong 10 s đầu khi mất mạng chỉ có **3** request `index.json` (trước ~55). Tab Tiến độ: `records*` · `photos` · `inbody`. Thẻ Khối lượng tuần có ở Kỷ lục, không có ở Ảnh. Người khai RLĂU: Trang chủ hiện "0/4 bữa đã ghi", không có thẻ năng lượng; Hồ sơ "Theo khẩu phần", dòng BMR ẩn. Ảnh trong `_test/integrator/01…12-*.png` |

Kết quả QA chạy lại (bản ghi chữ) nằm trong `_test/integrator/`. Lưu ý: `rules-attack.test.js` gốc của QA ghi đè `rules-attack-result.json`. Integrator đã khôi phục file gốc và lưu bản chạy thô ở `_test/integrator/qa-rules-attack-raw.*`.

## 2. Bảng mục → trạng thái

| Mã | Nguồn | Trạng thái | File | Test (67) |
|---|---|---|---|---|
| I-01 | security §CG#1 → commerce | **Đã sửa**. Ở chế độ Firebase, `report` chỉ ghi `mreports/{uid}` = `{uid, reason, ts}` và cập nhật bài `{reportCount: +1, reported}`. Bỏ `w`/`reportWeight` vì trọng số do Function `momentReportHeal` tính. **Không đọc `mreports` trong transaction**: rules chỉ cho kiểm duyệt viên đọc, nên bản cũ bị từ chối với mọi người dùng. Báo cáo lần 2 bị rules từ chối, client hiểu là "đã báo cáo". Chế độ demo giữ nguyên | `cloud-events.js` fire.`report` | I-01 (Firestore giả, mô phỏng rules vòng 2) |
| I-02 | security §CG#2 → commerce | **Đã sửa**. API mới `cloudEvents.claimChallengeVoucher(id)` / `myVouchers()`. Firebase gọi callable; Function chưa triển khai thì trả `{ok:false, pending:true}` / `null`. Demo trả `null` / `[]`. Trong `events.js settleAll` (Firebase), voucher hoàn thành do **máy chủ** cấp (`claimFinVoucher`) và lưu bản sao `server:true` với ref `fin_<id>`. Máy chủ chưa sẵn sàng thì đánh dấu `j.finVoucher = "pending"` và thử lại ở lần tải sau, **không** cấp voucher trên máy. Máy chủ báo không đủ điều kiện thì đánh dấu `"none"`. `shop.js syncServerVouchers()` chạy khi mở Cửa hàng (Firebase, đã đăng nhập, tối đa 1 lần/60 s): gộp voucher máy chủ, khử trùng theo mã, bản trên máy chưa xác nhận thì thay bằng bản máy chủ, lưu lỗi thì hoàn tác | `cloud-events.js` (demo + fire + api), `events.js` `claimFinVoucher`, `settleAll`, `shop.js` `syncServerVouchers`, `openStore` | I-02a/b/c |
| I-03 | security §CG#3 → pt | **Đã sửa**. Bỏ `delete pol.patch.statusLog` cho học viên. `sessionPolicy` chỉ cho học viên chuyển scheduled → done, đúng dòng mà rules nhận | `cloud-social.js` `saveSession` | I-03 |
| I-04 | nutrition §CG#1 → core | **Đã sửa tại chỗ gốc**. Khi `fkHideKcal()`, `renderHomeScreen` vẽ ô "Bữa đã ghi n/4" (icon `restaurant`, aria tương ứng, `data-kcal-hidden`) thay cho "Calo hôm nay" | `pt.js` `renderHomeScreen`, `app.js` `fkHideKcal` | I-04/I-06 |
| I-05 | nutrition §CG#2 → ux | **Đã sửa**. `decorateHome` kiểm `nuHideKcal()` trước khi vẽ. Đang ẩn thì gỡ thẻ cũ và bỏ `sig-gauged` | `ui-signature.js` | I-05/I-08 |
| I-06 | nutrition §CG#3 → core | **Đã sửa**. Hồ sơ: ẩn dòng BMR/TDEE, mục tiêu ghi "Theo khẩu phần", thêm ghi chú. Sheet "Mục tiêu calo & macro" khi đang ẩn chỉ giải thích theo khẩu phần, có nút "Hiện số calo để tự chỉnh" và Đóng. `nuSetHideKcal` vẽ lại cả Hồ sơ. Kết quả onboarding không có số kcal nên không cần sửa | `app.js` `renderProfileScreen`, `openEditNutritionTargets`, `nutrition.js` `nuSetHideKcal` | I-04/I-06 |
| I-07 | nutrition §CG#4 → core | **Đã sửa**. Đặt lại dữ liệu sẽ gọi `NutriPro.clearPlanCache()` và xoá `fitkit_np_plans_v1` | `app.js` `#btn-confirm-reset` | I-07 |
| I-08 | nutrition | **Đã gỡ** bản tạm `hsHomeKcal` và 2 lời gọi trong `decorateHome` | `health-safety.js` | I-05/I-08 · 62 R2-KCAL (cập nhật) |
| I-09 | core §CG#5 → training | **Đã sửa**. `loadWgerIndex`/`loadExtraIndex` nhớ lỗi: sau lỗi chờ 60 s, lỗi tiếp theo thì lùi dần 120 s, 240 s, … tối đa 10 phút. Sự kiện `online` xoá nhớ lỗi. Khi `navigator.onLine === false` thì không gửi request. `fvIndexesReady()`: `refreshPlanVideos` dừng khi chưa có index, không xoá video cũ và không đánh dấu "đã làm hôm nay". `searchVideos` (Pexels/Pixabay) nhớ lỗi kết nối 60 s | `freevideos.js`, `templates.js` `refreshPlanVideos`, `video.js` | I-09, I-09b · 04 BUG-15 (cập nhật) |
| I-10 | core §CG#6 → training | **Đã sửa**. Popup và pháo giấy chỉ hiện khi đã vào app ≥ 6 s (`achQuietLeft`) và không có lớp phủ nào đang mở: auth, onboarding, `#hs-overlay`, Cửa hàng, tab ẩn, sheet. Huy hiệu **"cũ"** (đạt từ trước hôm qua, kể cả lần đầu bật module) được ghi nhận lặng lẽ. Tắt pháo giấy ở máy yếu: Save-Data, RAM ≤ 2 GB hoặc ≤ 2 nhân | `achievements.js` | I-10 |
| I-11 | core §CG#1 → ux | **Đã sửa**. Thêm nút tĩnh "Kỷ lục" đứng đầu và đang chọn, các nút có `aria-pressed`. `fkEnsureRecordsTab` vẫn giữ làm dự phòng | `index.html` `#progress-tabs` | I-11/I-12 |
| I-12 | core §CG#2 → ux | **Đã sửa**. Thêm `.link-row.te-mdeep[hidden]{display:none}` vào ui-kit.css (không đụng style.css nên không phải sinh lại themes.css). Màu chữ `.search-box input` đã theo theme qua `themes.css:189` (`--fk-ink`) nên không cần sửa | `ui-kit.css` | I-11/I-12 |
| I-13 | core §CG#3 → training | **Đã sửa**. `insertVolumeCard` chỉ chèn khi `progressUI.tab === "records"` | `training-pro.js` | I-13 |
| I-14 | core §CG#4 → training | **Đã sửa**. Nút "Ghi nhận tất cả" của siêu hiệp đặt `r._bulk = true`. Bỏ cờ khi hoàn tác AMRAP | `training-pro.js` | I-14/I-15, I-14b |
| I-15 | core §CG#7 → pt | **Đã sửa**. Buổi PT có `tooShort` sẽ không gọi `finishPTSession` | `pt-connect.js` | I-14/I-15 |
| I-16 | core §CG#8 → commerce | **Đã sửa**. Dòng menu đặt chữ tại nguồn: "Sự kiện", "Gặp mặt & vé", "Cửa hàng". `community.js` "Routine chia sẻ" và `findpt.js` "Album PT công khai" đã được commerce/pt đổi từ trước | `events.js` | I-16 |
| I-17 | security §CG#4 → pt | **Đã sửa**. Dấu báo cáo thêm `uid` (routine `{reason, ts, uid}`, đánh giá PT `{reason, at, uid: by}`) để `deleteMyAccount` dọn được | `cloud-social.js`, `cloud-pt-directory.js` | I-17/18/24 |
| I-18 | security §CG#5 → pt | **Đã sửa**. "mã 6 ký tự" đổi thành "mã mời", kể cả chú thích đầu `cloud-social.js` | `cloud-pt-directory.js`, `cloud-social.js` | I-17/18/24 |
| I-19 | security §CG#6 / core §CG#9 → integrator | **Đã sửa**. Gỡ khoá Pixabay đã lộ (`pixabayKey: ""`) và sửa chú thích `welcomeVideo` cho đúng QU-04 (không tìm video lúc chạy). **Chủ app** cần thu hồi khoá cũ; nếu muốn có video tham khảo Pixabay thì điền khoá mới có giới hạn lúc build | `media-config.js` | I-19 |
| I-20 | commerce §CG#3 → pt | **Đã sửa (chữ)**. Hộp xác nhận chặn ghi đúng 2 nơi bỏ chặn: "Cộng đồng hoặc màn PT → Người đã chặn", vì cả hai dùng chung `cloud.listBlocked` | `events.js`, `community.js`, `coach.js` | I-20/I-21 |
| I-21 | commerce §CG#4 → core | **Đã sửa**. Khi `onConfirm` trả Promise, `confirmDialog` giữ tấm và khoá nút ("Đang xử lý…") tới khi xong. Lỗi thì mở lại nút và giữ tấm. Nếu callback mở tấm khác trong lúc chờ thì không đóng tấm mới. Callback đồng bộ chạy như cũ | `app.js` `confirmDialog` | I-20/I-21 |
| I-24 | pt §CG → security | **Đã sửa**. `routineReportHeal` ghi `autoModWeight` cả khi `hidden` không đổi | `functions/commerce.js` | I-17/18/24 |
| I-25 | ux §CG → security | **Đã sửa**. `build-android.yml` gọi `prepare-www.sh` với `STORE_BUILD=1` khi có khoá ký; `ios-appstore.yml` dùng `STORE_BUILD=1`. YAML đã parse OK | `.github/workflows/` | I-25 |
| — | nutrition §CG#5 → training (`FKHealth.onReady`) | Training đã làm ở vòng 2 (`achievements.js` nghe `fk:health-ready`) | — | 61 R2-HEALTH |
| I-22 | ux §CG → pt: ghi đè CSS trùng ở `pt-connect.css:310`, `findpt.css:642` | **Giữ nguyên**. Các ghi đè này vô hại; xoá đi sẽ phải sinh lại lớp màu module mà không được lợi gì | — | — |
| I-23 | nutrition "việc còn lại": người khai RLĂU chọn "Giảm mỡ" vẫn nhận 2,0 g đạm/kg | **Ghi lại, chưa đổi**. Đây là quyết định chuyên môn dinh dưỡng. Nếu đổi `proteinPerKg` thì phải đổi đồng bộ `NutriPro.proteinWhy` (test R2-WHY). Đề xuất: khi có cờ RLĂU dùng g/kg của mục tiêu "duy trì" (1,2–1,6) | — | — |

Đóng gói: `sw.js` đổi cache thành `fitkit-v9` để người dùng PWA nhận bản JS mới.

**Test cũ cập nhật (có ghi chú tại chỗ):**
- `04-video` BUG-15: vì đã có nhớ lỗi 60 s, test giờ phát sự kiện `online` trước khi tìm lại. Ca chờ 60 s được kiểm ở 67 I-09.
- `62-fix-nutrition` R2-KCAL: thay khẳng định "có `hsHomeKcal`" bằng khẳng định Trang chủ ẩn số calo tại chỗ gốc (`pt.js` `fkHideKcal()`, `ui-signature.js` `nuHideKcal`).

Thêm API cho test: `TapEv._t.claimFinVoucher`; `FKAch._ui.achIsOld/achQuietLeft/lowEndDevice`; `TapShop.syncServerVouchers`.

## 3. Việc cần chủ app (chỉ ghi lại)
1. **Deploy lại toàn bộ `functions`**: có `claimChallengeVoucher`, `myVouchers`, `momentReportHeal` và `routineReportHeal` mới. Sau đó deploy `firestore:indexes`, rồi `firestore:rules,storage`, theo đúng thứ tự trong FIX-security §0. Nếu rules lên trước Functions thì báo cáo Khoảnh khắc, voucher và statusLog sẽ hỏng.
2. **Thu hồi khoá Pixabay cũ** (`5852…`). Đặt GitHub secret `PIXABAY_KEY` cho workflow ảnh món. Nếu muốn video tham khảo trong app, điền khoá mới có giới hạn vào `media-config.js` lúc build.
3. Secrets và cấu hình: `OWNER_BOOTSTRAP_CODE`, `APPLE_PRIVATE_KEY`, `IOS_GOOGLE_SERVICE_INFO_PLIST`, `ANDROID_GOOGLE_SERVICES_JSON`, khoá ký Android. `firebase-config.js` phải có giá trị thật: bản phát hành nay **dừng build** nếu trống (`STORE_BUILD=1`).
4. Kiểm thử trên **Firebase Emulator**: báo cáo Khoảnh khắc lần 1 và lần 2, `claimChallengeVoucher` sau khi thử thách kết thúc, học viên đánh dấu "Đã tập" (statusLog), `myVouchers` khi mở Cửa hàng.
5. Quyết định chuyên môn I-23 (đạm cho người có tiền sử RLĂU) và nghiệp vụ B01 (huỷ "Chặt" và buổi vắng có trừ gói hay không).

## 4. Việc còn lại (chưa làm, rủi ro cao hơn phạm vi vòng này)
- QU-01: nạp lười **module** theo màn (`fkLazy.define` + stub mở màn + `FKHealth.rewrap()`). Nút thắt khởi động còn lại nằm ở ~50 file JS chạy ngay lúc mở app.
- QU-11: gỡ DOM của màn module đã rời > 60 s. QS-22: chuyển `onclick` hằng số sang listener để bỏ `'unsafe-inline'`.
- `tests/lib/harness.js` vẫn nạp thẻ `text/fk-lazy` như thẻ thường (FIX-commerce §CG#2). Nhánh nạp lười đã có test riêng.

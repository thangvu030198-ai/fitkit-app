# FIX — fixer PT (11/11/2026)

Phạm vi file: `coach.js`, `ptprofile.js`, `pt-pro.js/.css`, `pt-connect.js/.css`, `cloud-social.js`, `findpt.js/.css`, `cloud-pt-directory.js`, `tests/suites/63-fix-pt.test.js`.
Nguồn bug: `docs/qa/QA-pt.md` (QP-01…23), phần PT của `QA-security.md` (QS-03/04/12/14/17), `QA-ux-performance.md` (QU-05/15/16/17/23).

## 1. Kết quả kiểm chứng

| Lớp | Trước | Sau |
|---|---|---|
| Vòng đời 8 tuần `qa_lifecycle.js` (bản sao `/tmp`, ghi `_test/fix-pt/lifecycle-after.json`) | **29 / 46 PASS** (`lifecycle-before.json`) | **45 / 46 PASS**. Chuyển FAIL→PASS: Q03 Q04 Q05 Q07 X02 Q08 F02 F04 F05 F06 R05 R06 U01 U02 U03 U04. Còn **B01**: kịch bản QA ghi cứng `check(…, false, …)` (không thể PASS); hành vi đã sửa (QP-13) được kiểm ở test 63. |
| `node tests/run.js` | 2 đỏ ở `20-social` (do QS-12) | **470 test · 469 pass**. Vùng PT xanh: 20-social 17/17, 40-findpt 9/9, 63-fix-pt **25/25**, 05/08/09/10 xanh. Đỏ còn lại 1: `50-theme-packs` "themes-modules.css cũ" — file sinh tự động của **ux** (xem Chuyển giao). |
| Playwright, ngữ cảnh riêng **`fix-pt`** (390×844 @2x, isMobile, vi-VN), bản ghép `_test/fix-pt/fix-pt.html` | — | 0 lỗi JS. 4 thẻ đầu album có `in`/opacity 1 ngay ở 400 ms. Hồ sơ minh hoạ: không còn "Đã xác minh/đã đối chiếu", logo TapEasy, thanh trên `fp-scrolled` có nền. Ảnh `_test/fix-pt/shots/fx-01…04`. |

Độ mượt (CPU 4×, cùng phép đo của QA `pw_fp2`):

| Màn | QA (trước) | Sau sửa |
|---|---|---|
| Hồ sơ PT — cuộn dọc (lần đầu, ảnh còn đang tải) | 19 fps · p95 97 ms · 18 long task ≤ 125 ms | **29 fps · p95 83 ms · 9 long task ≤ 114 ms** |
| Hồ sơ PT — cuộn dọc (lần 2) | — | **58–73 fps · p95 28–35 ms · 1 long task** |
| Hồ sơ PT — album ngang | 26 fps · p95 63 ms · 10 khung > 50 ms | **66–74 fps · p95 28 ms · 0–1 khung > 50 ms** |
| Album Tìm PT — cuộn dọc | 44 fps · p95 49 ms | 42 fps lần 2 (lần đầu sau tải lại 29 fps do ảnh Pexels đang tải/giải mã — phụ thuộc mạng) |

## 2. Bảng bug

| Mã | Mức | Trạng thái | File:dòng (sau sửa) | Test |
|---|---|---|---|---|
| QP-01 | Cao | Đã sửa (demo); Firebase = rules (security đã làm) | `cloud-social.js:913` `sessionPolicy`, `:1044` bọc `saveSession` (HV không tạo/xoá buổi, không done→cancelled, statusLog); `coach.js:531` chỉ PT mở sheet trạng thái | 63 "QP-01 · QP-18"; lifecycle Q08 |
| QP-02 | Cao | Đã sửa | `cloud-pt-directory.js:371` (đánh giá đã viết luôn sửa được), `:875` `recordRights` khi rời PT/PT xoá form, `:78`+`coachCtx` gọi Function `claimReviewRights`; `:1012` giữ `basis` khi sửa | 63 "QP-02" ×2; lifecycle R06 |
| QP-03 | Cao | Đã sửa (demo) · Firebase → Chuyển giao | `cloud-social.js:1009` `demoCleanupDeletedUser`, `:1102` bọc `deleteAccount` (sức khoẻ/ảnh/số đo/trainingSync/chat/tin nhắn HV/lời mời) | 63 "QP-03"; lifecycle U02 |
| QP-04 | TB | Đã sửa | `cloud-social.js:910` `canStudentComplete` (hôm nay/hôm qua); `coach.js:572`; `pt-connect.js:1037` nút "Bắt đầu tập & ghi kg×lần" chỉ buổi hôm nay/hôm qua | 63 "QP-04"; lifecycle Q05 |
| QP-05 | TB | Đã sửa | `pt-pro.js:167` `clients.parqClearance` (PT-only, gắn bộ trả lời PAR-Q); `cloud-social.js:971` HV ghi health giữ nguyên clearance | 63 "QP-05"; lifecycle Q07 |
| QP-06 | TB | Đã sửa | `cloud-social.js:812` `proxyLog.rev`, `:272` `revertProxyLog`/`proxySnapshot`; `pt-connect.js:758` HV gỡ bản cũ (ảnh chụp) rồi áp bản mới, không cộng dồn | 63 "QP-06"; lifecycle X02 |
| QP-07 | TB | Đã sửa | `pt-connect.js:1021` "log thay" gắn buổi HÔM NAY; buổi đang xem ở ngày khác → sheet hỏi "Dời về hôm nay / Ghi buổi riêng"; `cloud-social.js:817` dời `date` theo ngày tập thật | 63 "QP-07" |
| QP-08 | TB | Một phần | `cloud-pt-directory.js:883` `statsFrom` (form có HV thật + ≥ 1 buổi PT xác nhận); `ptprofile.js:233` `ppSyncMyStats` dùng cùng công thức; nhãn nguồn `ptprofile.js:53`, `findpt.js:600` ("PT tự đồng bộ" / "PT tự khai" / "TapEasy xác nhận" chỉ khi `statsVerified`). Số "đã xác nhận" thật cần Function → Chuyển giao | 63 "QP-08"; lifecycle F02 |
| QP-09 | TB | Đã sửa | `cloud-pt-directory.js:174` `pricesFor/priceInfo`; `findpt.js:242` `cardPrice` — thẻ & ô "Giá từ" ghi "online từ…"/"tập trực tiếp" theo hình thức lọc | 63 "QP-09"; lifecycle F05 |
| QP-10 / QS-17 | TB | Đã sửa (client) | `cloud-social.js:992` SĐT lưu riêng + `clients.ptPhone`, `:1111` `getUser` bỏ `phone` của người khác; `ptprofile.js:44` `ppPhoneFor` (chỉ SĐT PT gửi vào form HV đang kết nối); `coach.js:232` | 63 "QP-10 · QS-17"; lifecycle F04 |
| QP-11 | TB | Đã sửa | `coach.js:473` rời PT gỡ `trainingSync`, hỏi xoá ảnh/số đo/sức khoẻ | lifecycle U01 |
| QP-12 / QS-07 | TB | Đã sửa (client) | `cloud-pt-directory.js:347` `confirmedDone`, `:356` `trainedOk` (≥ 1 buổi PT xác nhận và ≥ 2 buổi hoặc ≥ 7 ngày); Firebase: `serverOnly` `:380` — chỉ nhận `reviewRights` do Function cấp | 63 "QP-02 · QP-12"; lifecycle R05 |
| QP-13 | TB | Đã sửa | `pt-pro.js:121` `chargedCount/usedCount/remaining`, `:641` sheet 3 loại huỷ (mặc định theo chính sách niêm yết, chỉnh được); tab Gói hiện "N vắng trừ gói"; `coach.js:421` | 63 "QP-13" (lifecycle B01 ghi cứng FAIL) |
| QP-14 | Thấp | Đã sửa | `cloud-pt-directory.js:196` mức nền 4,0 × 5 phiếu | 63 "QP-14"; lifecycle F06 |
| QP-15 | Thấp | Đã sửa | `cloud-pt-directory.js:1183` trả lời tự động bỏ qua khi yêu cầu không còn `pending` | 63 "QP-15" |
| QP-16 | Thấp | Đã sửa | `pt-connect.js:849` "Tuần 4/12" | 63 "QP-16" |
| QP-17 | TB | Đã sửa (demo) · Firebase → Chuyển giao | `cloud-pt-directory.js:955` `_cleanupUser` (niêm yết, đánh giá, yêu cầu, quyền); lời mời/tin nhắn qua `cloud-social.js:1009` | lifecycle U03/U04 |
| QP-18 | Thấp | Đã sửa | `cloud-social.js:952` `clientPolicy`, `:1064` bọc `updateClient` (HV chỉ ghi health/measurements/photos/chat/trainingSync; không gói/thanh toán) | 63 "QP-01 · QP-18"; lifecycle Q03/Q04 |
| QP-19 | Thấp | Đã sửa | `ptprofile.js:167` cọc mốc + IntersectionObserver bật `.pp-nav.fp-scrolled`; `findpt.css:634` nền thanh trên, ẩn logo, nút back kiểu kính | 63 "QP-19"; ảnh `fx-04` |
| QP-20 | Thấp | Một phần | `pt-connect.css:309` ghi đè cục bộ chữ ≥ 12 px, `.seg`/`.btn-sm` ≥ 44 px trong `#coach-content` | — (gốc ở `style.css` → Chuyển giao) |
| QP-21 | Thấp | Đã sửa | `findpt.js:598` `isVer()` — hồ sơ seed luôn "minh hoạ — không đối chiếu" (thẻ, huy hiệu, chứng chỉ, fact chips) | 63 "QP-21" |
| QP-22 | Thấp | Đã sửa | `cloud-social.js:181` tóm tắt gửi từng PT, bỏ buổi với PT khác | (20-social) |
| QP-23 / QU-05 | TB | Đã sửa | `ptprofile.js:175` IntersectionObserver thay bộ nghe scroll; `findpt.js:340` bỏ parallax theo cuộn (không còn listener scroll); `findpt.css:618/641` bỏ blur phần tử lặp & khối lớn, `content-visibility:auto` hàng album/section hồ sơ, bỏ `will-change`; thumb album 360 px (`cloud-pt-directory.js` seed) | 63 "QU-05 · QP-23"; bảng §1 |
| QU-23 | Thấp | Đã sửa | `findpt.js:253` 4 thẻ đầu `in fp-noanim` ngay khi vẽ | 63 "QU-23"; Playwright `firstCards` |
| QU-15 | TB | Đã sửa | `coach.js:86` tab mặc định theo vai trò (PT → "Học viên của tôi"); tab "PT của tôi" chỉ hiện khi PT có PT riêng/lời mời | 63 "QU-15 · QU-17" |
| QU-16 | TB | Đã sửa | `coach.js:269` 1 nút "Thêm học viên" (bên trong có lối mời mã/QR/email) + chip Nữ/Nam, Mới/Trung bình/Nâng cao → `health.gender/goal.level`; `pt-connect.js:962` bỏ nút "Mời học viên" thứ hai | 63 "QU-16" |
| QU-17 | TB | Đã sửa | `coach.js:170/179` ô số "Sắp hết gói (N)" ở hàng đầu (bấm là lọc), cùng tiêu chí ≤ 3 buổi | 63 "QU-15 · QU-17" |
| QS-12 | TB | Đã sửa | `cloud-social.js:744` người dùng không gửi được `kind:"system"` (ép text); `:631` `systemMessage()` — dòng hệ thống do HỆ THỐNG ghi (demo nội bộ, Firebase = Function `joinByCode`); `pt-connect.js:341` tên/vai lấy từ form, `:357` chỉ `from:"system"` mới vẽ `.sc-sys`; yêu cầu Tìm PT chỉ nối thêm tin | 63 "QS-12"; 20-social (giữ nguyên, không phải sửa test cũ) |
| QS-14 | TB | Đã sửa (client) | `cloud-social.js:685` demo: bằng chứng lời mời đúng email; `:680` Firebase: nhận lời mời qua Function `joinByCode({clientId})` | 20-social, 63 "Chuẩn bị" |
| QS-04 | Cao | Đã sửa | `coach.js:968` (packageTotal ép số), `coach.js` relDay/ids escape; `pt-connect.js:37` `ddmm`; `cloud-social.js:918` trạng thái theo danh sách trắng; `findpt.js` mọi số/ngày qua `esc`/`Math.round` | 63 "QS-04" |
| QS-03 (phần cloud-social) | Cao | Đã sửa | `cloud-social.js:367` chuẩn hoá routine khi sao chép | (60-fix-core hiển thị) |
| App Store 1.2 — chặn | — | Phía client sẵn sàng | `cloud-pt-directory.js:81` `blockedBy()` dùng `cloud.isBlockedBy`/`cloud.blockedBy` nếu có; lỗi `ptdir/blocked` rõ ràng; map `permission-denied` khi bị chặn | 63 "Chặn" |

Không sửa test cũ: `20-social.test.js` giữ nguyên (thiết kế: tin hệ thống do hệ thống sinh vẫn `kind:"system"`; chỉ cấm người dùng tự gửi).

## 3. Chuyển giao

| Cho | File:dòng | Đề xuất |
|---|---|---|
| **ux** | `themes-modules.css` (sinh tự động) | Chạy lại `python3 scripts/gen_themes_layer.py --modules` sau khi các fixer xong — test `50-theme-packs` đỏ vì `findpt.css`, `pt-connect.css` (+ CSS của fixer khác) có luật mới. |
| **ux** | `style.css:641-650` `.pp-nav`, `:646/673/704` | QP-19/23 đang ghi đè trong `findpt.css`; nên chuyển gốc: `.pp-chips span`, `.pp-cta` bỏ `backdrop-filter`; `.pp-light` đồng bộ kiểu kính. |
| **ux** | `style.css` `.stat-box .cap`, `.seg button` | QP-20: `.cap` ≥ 12 px, `.seg button` min-height 44 px (đang ghi đè cục bộ trong `pt-connect.css:309`). |
| **security** | `cloud.js:386-399` `joinByCode` | Firebase: gọi Function `joinByCode({code})` (rules đã bỏ đường HV tự ghi `studentUid`); Function đã ghi dòng hệ thống. `cloud-social.js` đã chuyển lời mời email sang `joinByCode({clientId})`. |
| **security** | `cloud.js` | Thêm `cloud.blockUser/unblockUser/isBlockedBy(a, b)` (rules `blocks/{uid}/list/{other}` đã có) — `cloud-pt-directory.js:81` và chat sẽ dùng ngay; thêm nút "Chặn người này" ở chat (`pt-connect.js`) khi API có. |
| **security** | `functions/social.js` `sessionAgg` / Function mới `ptStatsAgg` | QP-08: ghi `ptListings/{uid}.statsVerified = { students, sessions, at }` (đã nằm trong `lockedKeys`) từ buổi PT xác nhận; client đã hiển thị "TapEasy xác nhận" khi có trường này. |
| **security** | `functions/index.js` `cleanupDeletedUser` | QP-03/17: khi xoá HV — xoá `health, measurements, photos, trainingSync, chat` trong `clients` có `studentUid==uid`, `messages` có `from==uid`, `invites` theo `email`; khi xoá PT — `ptListings/{uid}` (+ reviews/requests), `invites where ptId==uid`, `reviewRights` liên quan. Demo đã mô phỏng (`cloud-social.js:1009`, `cloud-pt-directory.js:955`). |
| **security** | `firestore.rules` `clients/{cid}/sessions` | Nhận `statusLog` từ HV khi chuyển scheduled→done (hiện client bỏ `statusLog` ở Firebase, `cloud-social.js:1053`); `pendingConfirm`/`ptConfirmedAt` cho buổi HV tự báo nếu muốn PT xác nhận hai phía. |
| **security** | `firestore.rules` `ptListings/{lid}/reviews` | Cho phép trường `editedAt`, `editedAfterReply` khi người viết sửa (đang không bị chặn — chỉ xác nhận). |

## 4. Việc còn lại
- B01 trong `qa_lifecycle.js` ghi cứng FAIL — QA cập nhật kịch bản (dùng `PTP.openAbsentSheet` / `charged`) để đo đúng.
- Album Tìm PT lần cuộn đầu ở 4× vẫn ~29–44 fps tuỳ tốc độ tải ảnh Pexels — cần ảnh `coverThumb` nhỏ hơn cho thẻ cặp (đang 600–900 px) và `lowfx` tự bật trên máy yếu (ux).
- Bộ lọc "không tính giá gói" (`noPack`) đã có ở logic, chưa có công tắc trong sheet Bộ lọc.

## Vòng 2 (11–12/11/2026) — xử lý Chuyển giao (`docs/qa/HANDOFF-ROUND-BRIEF.md` mục pt)

API chặn đọc từ `cloud.js:492-503` (security): `blockUser(uid,{name,reason})`, `unblockUser(uid)`, `listBlocked()`, `isBlocked(uid)`, `isBlockedBy(a,b)` (chỉ trả lời khi `a` là chính mình), `isBlockedSync(uid)`. Không có `cloud.blockedBy` — đã bỏ tham chiếu cũ.

| # | Việc | Trạng thái | File:dòng | Test (suite 63) |
|---|---|---|---|---|
| 1 | FIX-security #1 — mã mời 6–10 ký tự | Đã sửa | `cloud-social.js:53-54` `CODE_MIN/MAX`, `CODE_RE = /^[A-Z0-9]{6,10}$/`; `:751` `normalizeCode(...).slice(0, CODE_MAX)` + `isCode`; lỗi cùng câu với `cloud.js` ("Mã gồm 6–10 ký tự chữ và số…"); ô nhập `maxlength="10"` `coach.js` / `pt-connect.js:640`; quét QR & link `?join=` nhận 6–10 (`pt-connect.js:~690, :1417`); bỏ chữ "mã 6 ký tự" ở coach/pt-connect/findpt. Security đã đổi `JOIN_CODE_LEN = 8` | "FIX-security #1" (mã 6 `Q9W3ZP` + mã 8 `K7M2QXAB`: xem trước + kết nối; 3 / 11 ký tự) |
| 2 | FIX-security #2 — không gọi `systemMessage()` ở Firebase | Đã sửa | `cloud-social.js:658` (hàm tự thoát khi `isFb()`), 2 lời gọi `:741`, `:770` bọc `if(!isFb())` | "FIX-security #2" |
| 3 | Nút **"Chặn người này"** + "Người đã chặn" (App Store 1.2) | Đã sửa | `coach.js:93` **`FKBlock`** (ready / is / confirm có hộp xác nhận / block / unblock / openList / btnHTML / blockedHTML; bắt sự kiện chung `data-fk-block`/`data-fk-unblock`, không onclick chuỗi; phát `fk:blocks-changed`); màn PT: nút "Người đã chặn (N)" `coach.js:227`, hàng học viên "Đã chặn", `unreadFor` = 0 `:63`. **Chat** `pt-connect.js:386` (đã chặn → khối "Bạn đã chặn…" + Bỏ chặn, không mở luồng tin), nút ở đầu khung chat, `unreadTotal`/đếm tab bỏ người đã chặn `:487`, lời mời của PT đã chặn ẩn. **Hồ sơ PT** `ptprofile.js:49` `ppBlockedView`, nút `pp-blockbtn` `:178`, mở hồ sơ người đã chặn → khối thay thế `:34`. **Tìm PT** `findpt.js:133` album bỏ PT đã chặn, `:529` hồ sơ niêm yết bị thay, `:790` ẩn đánh giá của người đã chặn, nút chặn trong "Yêu cầu của tôi" `:1052` / "Yêu cầu từ học viên" `:1090`. **Dữ liệu** `cloud-social.js:666-675` lọc tin nhắn (list/watch) + lời mời, không gửi cho người mình đã chặn, demo mô phỏng rules `blockedBy(người nhận, mình)` (`social/blocked`), Firebase `permission-denied` → thông báo rõ; `cloud-pt-directory.js:83` `blockedBy` dùng API thật (+ demo đọc `blocks` của cloud.js), `:1097-1099` `myRequests`/`inbox` ẩn người đã chặn. CSS `pt-connect.css:315`, `findpt.css:646`; icon `block/lock/lock_open` thêm vào `addIcons` | "App Store 1.2 · Chặn (Tìm PT)", "· Chặn (chat)", "· Chặn (hồ sơ / album / lời mời)" |
| 4 | QC-14 — báo cáo routine theo trọng số | Đã sửa | `cloud-social.js:405-421` `reportWeightOf` / `isHidden` (demo `reportWeight`, Firebase `autoModWeight` của Function `routineReportHeal`; `moderatedAt` → theo `hidden`; dữ liệu cũ → số thô); `:677-683` tuổi tài khoản (`cloud.js` demo `users[uid].createdAt` → `cloud.profile.createdAt` → Auth `creationTime`), ≥ 7 ngày = 1; demo `:537` lưu `w` từng báo cáo, ẩn khi tổng ≥ 3, chặn tự báo cáo; Firebase `:618` vẫn ghi `hidden == reports >= 3` (rules bắt buộc) + trả `weight` ước tính | "QC-14" |
| 5 | FIX-core §4 — lọc lúc nhập | Đã sửa | `pt-connect.js:705-725` `toPlanItem` + `cleanStock` (chữ bỏ `<>`/ký tự điều khiển + cắt độ dài, sets 1–10 / nghỉ 0–600 ép nguyên, `exId` chỉ khoá có thật (`hasOwnProperty`), `img`/`stock.*` qua `safeUrl(…, {noBlob:true})`); `planFromRoutine` đã lọc từ vòng 1 (`cloud-social.js:374`: whitelist intensity, `plain`, `clampN`) — thêm test | "FIX-core §4" |
| 6 | QU-36 — lưới 2 cột ≥ 1024 px | Đã sửa | `findpt.css:653-675` bám `html[data-screen="findpt"]`: khung `#app-shell` 1 120 px (riêng màn này), album `grid` 2 cột `minmax(0, 480px)`, thẻ ≤ 480 px, ảnh lớn 1:1 (≤ 480 px cao); đầu trang 2 cột, ô tìm ≤ 720 px | "QU-36" + Playwright |
| 6b | Thuật ngữ §8.4 (phần pt, chỉ chữ hiển thị) | Đã sửa | "Ảnh tiến trình" → "Ảnh tiến độ" (`pt-pro.js` 5, `coach.js`, `pt-connect.js`); "Album PT công khai" → "Hồ sơ PT công khai" (`findpt.js` 6); "Kết nối PT" → "PT & học viên" / sheet "Nhập mã PT"; tab hub "Chương trình" → "Giáo án"; "Sửa hồ sơ của tôi" → "Sửa hồ sơ PT"; lời mời `mục "TapEasy PT"` → `mục "PT"`; thông báo lỗi Cộng đồng "routine" → "giáo án chia sẻ" (`cloud-social.js` 14 chỗ). "deload" trong pt-pro.js chỉ còn ở tên biến/khoá (chữ hiển thị đã là "tuần giảm tải") | "Thuật ngữ §8.4" |

**Test cũ đã cập nhật (khẳng định hành vi cũ ở file của pt):** `20-social.test.js:83` (câu lỗi mã 6 → 6–10) và `:237` + `30-rbac.test.js:562` (3 người báo cáo được cho ≥ 7 ngày tuổi trước khi báo cáo — QC-14); `tests/browser/t_integrated.js:197` nhận tiêu đề "Nhập mã PT"; test "Chặn" vòng 1 của suite 63 (giả lập `isBlockedBy(PT, mình)` — sai ngữ nghĩa API thật) thay bằng luồng `blockUser` thật.

**Kiểm chứng**
- `node tests/run.js` (công cụ cắt ~90 s → chạy từng suite `--only`): suite 63 **33/33**; 00–05, 07–10, 20, 21, 30, 40×2, 60–62, 64–66 xanh; 06-security xanh (sau khi core sửa app.js:536). Còn đỏ 1: `50-theme-packs` "themes-modules.css cũ" — file sinh tự động của **ux** (findpt.css / pt-connect.css có luật mới) → ux chạy `gen_themes_layer.py --modules` ở bước cuối như brief.
- `_test/qa-pt/qa_lifecycle.js` (bản sao /tmp, ghi `_test/fix-pt/lifecycle-r2.json`): **45/46** — như vòng 1, chỉ B01 (kịch bản ghi cứng FAIL); S01 không lỗi JS.
- Playwright context riêng `fix-pt`, bản ghép `_test/fix-pt/fix-pt.html`: **390×844** — kết nối bằng mã 8 ký tự `k7m2-qxab`; chat có "Chặn người này" (44 px) → hộp xác nhận (chưa chặn trước khi bấm) → khối "Bạn đã chặn Phong Coaching" + Bỏ chặn, không còn `.sc-msgs`; "Người đã chặn (1)" → Bỏ chặn → "Bạn chưa chặn ai."; hồ sơ PT minh hoạ → chặn → khối thay thế, quay lại album không còn PT đó; album 1 cột. **1280×800** — `data-screen=findpt`, khung 1 120 px, album `grid` 480 px × 2, thẻ lớn nhất 480×480; màn PT có nút chặn + "Người đã chặn". 0 lỗi JS cả hai. Ảnh `_test/fix-pt/shots/r2-01…09`.

**Chuyển giao (vòng 2)**
| Cho | File | Đề xuất |
|---|---|---|
| **ux** | `themes-modules.css` | Chạy lại `python3 scripts/gen_themes_layer.py --modules` (luật mới ở `findpt.css`, `pt-connect.css`). |
| **ux** (tuỳ chọn) | `ui-kit.css:139-146` | Khung rộng màn Tìm PT đang đặt trong `findpt.css:656-657`; nếu muốn gom một chỗ thì thêm `findpt` vào danh sách rồi xoá 2 dòng đó. |
| **security** | `functions/commerce.js:548 routineReportHeal` | Client đọc `autoModWeight` làm nguồn trọng số (đã có); nên ghi cả `autoModWeight` khi `hidden` không đổi để giao diện có số mới nhất. |
| **QA** | `_test/qa-commerce/qa_node.js:334` | Kiểm tra "3 báo cáo → ẩn" dùng 3 tài khoản vừa tạo — nay đúng là KHÔNG ẩn (QC-14); cho 3 tài khoản ≥ 7 ngày tuổi như test 20-social. |

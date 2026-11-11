# FIX-training — vòng sửa lỗi sau QA (11/11/2026)

Fixer **training** · file sở hữu: `achievements.js/.css`, `training-pro.js/.css`, `program-builder.js/.css`, `templates.js`, `library.js`, `exdb*.js`, `video.js`, `freevideos.js`.
Test hồi quy: `tests/suites/61-fix-training.test.js` (**27 test, đều đạt**). Bản ghép kiểm thử trình duyệt: `outputs/_test/fix-training/app.html`, ảnh `outputs/_test/fix-training/shots/ft-*.png`.

Nhiều mã QT có phần nằm ở `app.js`/`pt.js`; fixer core đã sửa phần đó (xem `FIX-core.md`). Bảng dưới ghi phần thuộc file training; cột "Lõi" ghi nhận phần core đã làm để tiện đối chiếu.

## 1. Bảng mã → trạng thái

| Mã | Mức | Trạng thái | Phần training (file:dòng) | Lõi (core) | Test (61-fix-training) |
|---|---|---|---|---|---|
| QT-01 | Cao | **Đã sửa** | training-pro.js:451 `ensureRows` (buổi trước có hiệp 0 kg thì điền tạ chính), :688 `fillDown` (gõ kg ở hiệp 1 tự chép xuống), :695 `fillBlankKg`, :1533 bọc `recordExerciseResult` (hiệp trống kế thừa kg), :830 hộp xác nhận superset báo số hiệp chưa có kg | app.js:1192–1242, 3507 | QT-01 |
| QT-02 | Cao | **Đã sửa** | training-pro.js:77 `lighterKg` (tuần giảm tải luôn nhẹ hơn: 5 → 4,5 kg; không giảm được thì bớt ~20 % số lần, :507); achievements.js:1028 `lighterKg` (buổi quay lại) | app.js:3481–3555 (nấc tăng theo %, `fkDeloadKg`) | QT-02 ×2 |
| QT-03 | Cao | **Đã sửa** | achievements.js:588 `quickPlan` + :640 `quickSafety` (bỏ bài cường độ rất cao/nhảy, thay bằng bài tác động thấp, không tải lên khớp đã khai), :984 `startQuick` (kiểm tra trước buổi 1 lần/ngày, qua `FKHealth.openPreSession`). **Lỗi mới thấy trên trình duyệt:** thẻ "Quay lại tập" vẽ lúc khởi động, trước khi `health-safety.js` (nạp cuối) có mặt, nên vẫn liệt kê Burpee. Đã thêm dự phòng thận trọng :618 `healthFlags` và vẽ lại thẻ khi FKHealth sẵn :959 | — | QT-03 ×3 |
| QT-04 | Cao | Lõi đã sửa | buổi bù lưu vào hôm nay; nhật ký training-pro ghi `makeup` (:903) | app.js:1086, 1286–1304 | — |
| QT-05 | Cao | **Đã sửa** | templates.js:341 `tplRecommend`; training-pro.js:1196, 1290 thẻ "Giáo án vừa sức" cho người đang dùng giáo án mặc định cũ | app.js:325–352, 772 (onboarding hỏi kinh nghiệm) | QT-05 |
| QT-06 | TB | **Đã sửa** | achievements.js:68, 115, 381: số buổi và khối lượng lấy theo Nhật ký buổi tập, 2 buổi/ngày = 2 buổi (XP tối đa 2) → Thành tích khớp Nhật ký | app.js:3584–3630 (gộp setHist) | QT-06 |
| QT-07 | TB | **Đã sửa** | training-pro.js:903 `buildSummary` ghi theo `session.date` (+ `sid`); achievements.js:991 buổi nhanh có `date/sid/startedAt`, :1277 finishedDates theo ngày chốt | app.js:1094, 1292 | QT-07 |
| QT-08 | TB | **Đã sửa** | templates.js:109 `TPL_TB` (scheme `topback` cho tpl-m-pb); training-pro.js:435 `isTopBack` (nhận cả giáo án tạo trước bản sửa), :451 điền hiệp 1 nặng, các hiệp sau −10 %, :1561 bọc `progressionFor` (xét theo hiệp nặng, RPE vượt mục tiêu thì giữ tạ) | — | QT-08 |
| QT-09 | TB | **Đã sửa** | templates.js:162 `deloadEvery:4`; training-pro.js:87 regex "tuần 4 nhẹ"; program-builder.js:1464 giáo án riêng gọi `FKTP.startCycle` (mới 6 / TB 5 / lâu năm 4 tuần, 10–12 tuần) | — | QT-09 |
| QT-10 | TB | **Đã sửa** | training-pro.js:451 điền số lần buổi trước (tăng tạ thì về đáy khoảng lần), :491 `sameThreeTimes` 3 buổi y hệt thì nhắc | app.js:3532 | QT-10 |
| QT-11 | TB | Lõi đã sửa | — | app.js:101, 875, 3273 | — |
| QT-12 | TB | **Đã sửa** | video.js:346–420: chỉ phát khi `#auth.open`; vào app thì pause, bỏ `src`, gỡ thẻ; theo dõi bằng MutationObserver, IntersectionObserver, visibilitychange | pt.js:342, 352 | QT-12 |
| QT-13 | TB | **Đã sửa** | training-pro.js:1260 `cycleGap`, :1268 `shiftCycle` (nghỉ ≥ 7 ngày: đề nghị lùi chu kỳ, bỏ tuần giảm tải kế tiếp); :451 buổi thường đầu tiên ~90 % (≥ 21 ngày ~80 %) | — | QT-13 |
| QT-14 | TB | **Đã sửa** | program-builder.js:1244 `pbDefaults` lấy chấn thương từ sàng lọc (cả khi đã có câu trả lời cũ "Không có") | — | QT-14 |
| QT-15 | Thấp | Lõi đã sửa | — | app.js:3634 | — |
| QT-16 | Thấp | Lõi đã sửa | — | app.js:1153, 1166 | — |
| QT-17 | Thấp | **Đã sửa** (phần chuyển giao từ core) | achievements.js:440 `prWall` + :1079 `prWallHTML`: bài trọng lượng cơ thể có **kỷ lục số lần/hiệp**, tổng số lần, nhãn "Mới" khi phá kỷ lục trong 7 ngày | app.js:3560 (gợi ý biến thể khó hơn) | QT-17 |
| QT-18 | Thấp | Lõi đã sửa | — | app.js:3479 | — |
| QT-19 | Thấp | **Đã sửa** | training-pro.js:320 dùng chung bảng hệ số nhóm cơ `PB.EX[id].m`; :371 `plannedVolume`, :388 `volStatus` (vạch chuẩn theo giáo án), :1456 thẻ khối lượng | — | QT-19 |
| QT-20 | Thấp | **Đã sửa** | achievements.js:161, 470, 503: tổng kết tuần tính từ max(thứ Hai, firstSeen, ngày bắt đầu giáo án); tuần đầu chỉ động viên | app.js:354, pt.js:605 (Trang chủ) | QT-20 |
| QT-21 | Thấp | **Đã sửa** | training-pro.js:176 `nextTemplate(tplId, userGender)` | — | QT-21 |
| QT-22 | Thấp | **Đã sửa** | templates.js:315–335 ngày đi bộ/Zone 2 là `optional`, `planRequiredDays`; training-pro.js:71; achievements.js:79 (cả giáo án tạo trước bản sửa) | — | QT-22 |
| QS-03 | Cao | **Đã sửa** (phần training-pro) | training-pro.js:1368 `openSupersetEditor`, :717 `renderGroupStep`, :1318 `openCycleSheet`, nhật ký buổi: escape tên, sets, reps, rest, nhãn deload của giáo án chép từ routine | lọc lúc nhập: cloud-social.js (pt) | QS-03 |

### Mục khác trong QA-training / QA-ux-performance

| Mục | Trạng thái | File:dòng | Test |
|---|---|---|---|
| §2.9 Thư viện trùng bài ("Đẩy ngực tạ đơn" ×2) | Đã sửa | library.js:71 `libDedupe` | Thư viện |
| §2.7 Popup huy hiệu che màn "Hoàn thành buổi tập" | Đã sửa: huy hiệu mới hiện **trong** màn hoàn thành; popup đợi đóng sheet | achievements.js:761 `enqueue`, :1243 `finishXPHTML`; achievements.css (`.ach-finish-badges`) | UX-2.7 |
| §3 Thư viện > 1 s ở CPU 4× + cuộn giật | Đã sửa: vẽ lười 30 bài/lô (IntersectionObserver), bind sự kiện 1 lần, đổi chip không dựng lại khung, `content-visibility`, **hàng danh sách bỏ `backdrop-filter`** (dùng `--glass-solid`) | library.js:101–260, :127 | Thư viện |
| §3 Thành tích chạy `runCheck` khi chuyển màn | Đã sửa: kiểm tra huy hiệu chạy lúc rảnh (`requestIdleCallback`, tối đa 2 s); màn Thành tích dùng lại kết quả `runCheck`, không tính 2 lần | achievements.js:749, 1110 | UX-2.7 |
| QU-10 / QU-33 Ảnh lazy, alt | Đã sửa: danh sách Thư viện/exdb `loading="lazy" decoding="async"` + kích thước; ảnh chi tiết có `alt` = tên bài | library.js:148, 284; exdb.js:100, 141 | exdb/Thư viện |
| QU-34 Video màn chào | Đã sửa: không tự phát khi giảm chuyển động / tiết kiệm dữ liệu / 2G; nút tạm dừng 44 px | video.js:347–420 | QT-12 |
| QU-02 (phần training) | Đã sửa: làm mới video giáo án chạy lúc rảnh; `fvTokens` nhớ kết quả | templates.js:466; freevideos.js:122 | invertedrow |
| exdb: dữ liệu mạng chèn thô (id, URL ảnh, nhóm cơ, dụng cụ) | Đã sửa (escape mọi trường, `aria-label` nút) | exdb.js:99–104, 140–146 | exdb/Thư viện |
| Video sai bài "invertedrow" | Đã sửa: alias Australian pull-up / body row / TRX row, không khớp nhầm video chèo/kéo xà | freevideos.js:104 | invertedrow |
| Khối lượng tpl-m-ul / tpl-m-ulppl (ngực 8, vai 9 hiệp) | Đã sửa (≥ 10) | templates.js:126, 138 | Giáo án tpl-m-ul |
| **Lỗi mới thấy trên trình duyệt:** bài AMRAP (chống đẩy "tối đa −2") đã nhập số lần nhưng "Xong bài" vẫn báo "nhập số lần thật" và kẹt buổi | Đã sửa: đọc hàng hiệp hiện tại `session.sets[uid]` và số lần đang gõ trong ô | training-pro.js:606 `liveRows`, :634–655 | AMRAP |

## 2. Kiểm thử trình duyệt (Playwright, ngữ cảnh riêng `fix-training`, 390×844, DPR 2, chạm)

1. **Buổi nhanh, hồ sơ bệnh tim** (58 tuổi, `cardio:"heart"`, nghỉ 14 ngày, buổi có Burpee):
   - Thẻ Trang chủ liệt kê Squat, Chống đẩy, Cầu mông, Chống đẩy nghiêng, kèm dòng "Theo sàng lọc sức khoẻ: Burpee → Chống đẩy nghiêng". Lỗi vẽ lúc khởi động đã sửa; ảnh `ft-02`.
   - Bấm "Bắt đầu 20 phút" thì hiện "Kiểm tra nhanh trước khi tập" (`ft-03`). Xác nhận xong, buổi có 4 bài, không có Burpee (`ft-04`).
   - Tập hết 4 bài, bài cuối trượt để kết thúc. Màn hoàn thành có +150 XP và huy hiệu "Trở lại mạnh mẽ" ngay trong thẻ (`ft-06`). Popup chỉ hiện sau khi đóng sheet (`ft-07`).
   - Nhật ký ghi `date` và `sid`; `finishedDates` và `quick` có hôm nay. 0 lỗi JS.
2. **Thư viện ở CPU 4×** (915 bài, có exdb; đo trước → sau bản sửa bỏ blur hàng):
   - Mở màn: 891 → 554 ms.
   - Cuộn nhóm Ngực, khung > 34 ms: 134/203 (p95 125 ms) → 72/285 lần đầu (đang nạp lô và ảnh), 42/292 lần sau (p95 49 ms).
   - Gõ "day nguc": long task 865 → 117 ms. Kết quả đầu là "Đẩy ngực nằm", "Đẩy ngực máy", "Đẩy ngực tạ đơn", không trùng.
   - Lọc dụng cụ / cấp độ: 500–640 ms (long task ≤ 170 ms). 100 % ảnh danh sách lazy. Ảnh `ft-10…12`.
3. **Thêm giáo án mẫu** (nữ 27 tuổi, mới tập, đau gối): Tập luyện → Giáo án mẫu → lọc Nữ + Mới tập (4 giáo án) → "Thêm vào tuần tập" Full Body cho nữ.
   - Giáo án đang dùng là `tpl-f-fb`. Chu kỳ 10 tuần, giảm tải tuần 5. 3 ngày bắt buộc, khớp `perWeek` 3.
   - Ảnh `ft-20`, `ft-21`. "Tạo giáo án riêng" mặc định chấn thương `knee`.

## 3. `node tests/run.js`

Lần chạy cuối: 492 test, 490 đạt, 2 đỏ. **Không có test đỏ nào do file training.**

- `50-theme-packs` "Lớp màu module đã sinh lại": `themes-modules.css` (của ux) cũ hơn `community.css`, `findpt.css`, `nutrition-pro.css`. Phần `achievements/training-pro/program-builder` sinh lại giống hệt; luật CSS mới của training không thêm màu.
- `65-fix-security` "Rules — 109 kịch bản": đang được fixer security sửa.
- Lần chạy trước còn đỏ ở quét tĩnh `nutrition.js:261` (của nutrition). Lần cuối đã xanh.

## 4. Chuyển giao

1. **ux.** Chạy lại `python3 scripts/gen_themes_layer.py --modules` (sinh lại `themes-modules.css`) sau khi các fixer CSS xong.
   - Ghi chú DESIGN-SYSTEM §Kính mờ: hàng danh sách Thư viện bỏ `backdrop-filter` (đo CPU 4× ở trên). Nên áp tương tự cho `.list-item` trong danh sách dài (QA-ux bước 10).
2. **ux + training.** Nạp lười `exdb-vi-1..3.js` (≈ 177 KB, QA-ux bước 6) cần bỏ 3 thẻ `<script>` trong `index.html:520–522`, sửa `sw.js` và `build-single-html.py`.
   - Sau đó training thêm `exdbVi.ensure()` gọi từ `libLoad()`.
   - Chưa làm vì đụng 3 file của ux.
3. **nutrition** (`health-safety.js` nạp cuối, `index.html:550`). Các module vẽ lúc khởi động (thẻ "Quay lại tập") chưa thấy `FKHealth`; achievements đã tự dự phòng.
   - Đề xuất: health-safety phát sự kiện `fk:health-ready` hoặc gán `window.FKHealth` sớm (tách phần `hsFlags`/`itemTags` thuần logic lên đầu).
4. **core.** Có 2 lớp cùng điền sẵn hàng hiệp:
   - app.js:1141 `fkPrefillRows` và training-pro.js:1507 `ensureRows` (chạy trước; app.js chỉ điền khi chưa có).
   - Hiện khớp nhau (test QT-01/08/10/13 cả 2 suite đều đạt). Khi gộp nên giữ một nguồn, đề xuất `fkPrefillRows` gọi `FKTP.ensureRows` nếu có, để top set (QT-08) và quay lại sau nghỉ (QT-13) không bị bỏ qua.
5. **core** (QA-training §2.6). Buổi 6 giây (bấm Xong liên tục) vẫn tính chuỗi, XP, huy hiệu.
   - Đề xuất: `finishSession` chỉ ghi `finishedDates`/`workoutLog` khi buổi ≥ 3 phút **hoặc** ≥ 1 hiệp có số lần.
   - achievements đọc theo `workoutLog`/nhật ký nên sẽ tự theo.

## 5. Việc còn lại

- Đo lại Trang chủ / Hồ sơ ở CPU 4× sau khi ux giảm `backdrop-filter` toàn app. Giật ở 2 màn này chủ yếu do kính mờ và theme, không phải logic training.
- QA-training §2.10 (dấu (i) giải thích Superset/Deload/AMRAP/RIR trên từng nhãn) chưa làm. Mức đánh bóng.

---

## Vòng 2 (11/11/2026, 23:00): xử lý chuyển giao theo `HANDOFF-ROUND-BRIEF.md`

Test: `tests/suites/61-fix-training.test.js` thêm 8 test `R2-*`, suite còn **35/35 đạt**. Kiểm trình duyệt: `outputs/_test/fix-training/app-lazy.html` (bản ghép đã bỏ 3 khối `exdb-vi-1..3.js`, 3 file để cạnh để fkLazy tải), ảnh `shots/r2-*.png`.

### 1. Bảng việc → trạng thái

| Việc | Trạng thái | File:dòng | Test |
|---|---|---|---|
| **fkLazy `exdbvi`**: mọi nơi dùng `EXDB_VI` (biến toàn cục của `exdb-vi-1..3.js`) chờ `fkLazy.load('exdbvi')` | **Đã sửa** | exdb.js:58 `exdbViReady()` (nhớ promise; reject → xoá để thử lại; chưa có fkLazy → xong ngay). library.js:82 `libViReady()` (có chuỗi `fkLazy.load('exdbvi')` cho ux grep), :88 `libLoad` chờ bản Việt **song song** với tải 800+ bài rồi mới `map(libExdbItem)`, nhớ `_libLoading` (không dựng 2 lần) | R2-LAZY-01 |
| Thư viện khi nạp lỗi: vẫn mở (tên gốc) + "Thử lại" | **Đã sửa** | library.js:116 `libViNoteHTML`, :108 `libRetryVi`, :271 nút `[data-lib-retry]`, :111 nghe `fk:lazy:exdbvi` (nạp trước lúc rảnh thành công → bỏ danh sách tên gốc) | R2-LAZY-02 |
| Bảng chọn bài 800+ (PT soạn buổi, thêm bài vào giáo án) | **Đã sửa** | exdb-vi.js:268 `Promise.all([exdbLoad(), viReady()])` + nút "Thử lại" khi lỗi; exdb.js:98 nếu cả `exdb-vi.js` cũng nạp lười → nạp rồi gọi lại bảng đã Việt hoá | R2-LAZY-03 |
| Khoá tìm kiếm cũ khi dữ liệu tới muộn | **Đã sửa** | exdb-vi.js:73 `keyFresh()` (đổi số bản dịch → bỏ `_keyCache`), gọi ở `viRank` và bảng chọn | R2-LAZY-01 |
| Chi tiết bài / hướng dẫn bài 800+ trong buổi tập | **Đã sửa** | exdb-vi.js:203 sheet chi tiết Việt hoá khi dữ liệu tới; :381 `getExerciseMeta` gặp bài exdb chưa có bản dịch → nạp sẵn (không chặn vẽ) | — |
| Tương thích: thẻ script còn / dữ liệu có sẵn / không có fkLazy | **Đã kiểm** | Không chèn thẻ lần 2; `exdbViReady()` = `false` khi không có fkLazy | R2-LAZY-04 |
| Thuật ngữ §8: deload → "tuần giảm tải" | **Đã sửa** (chữ hiển thị; khoá `deload`, `deloadEvery`, `tp-dl*` giữ nguyên) | training-pro.js:577 banner, :617 "Giảm tải: x/y hiệp", :758 "(tuần giảm tải, gốc n)", :1197 "Chu kỳ & tuần giảm tải", :1243 "Giảm tải n hiệp", :1193 tagline "Tuần x/y · Tuần giảm tải", :1348 giải thích; templates.js:159, 233 ("tuần giảm tải mỗi 5 tuần", regex `deloadEveryFor` vẫn đọc ra 5) | R2-TERM-01, R2-TERM-03 |
| RPE/RIR: Việt trước, ẩn ở cấp Mới tập | **Đã sửa** | training-pro.js:31 `simpleMode()` (dùng `fkSimpleMode()` của app.js); :739/:780 bảng siêu hiệp ẩn cột RPE ở Mới tập, cấp khác có dòng "RPE = độ nặng cảm nhận"; :257 AMRAP bỏ "(RIR n)" ở Mới tập; :1479 "độ nặng cảm nhận (RPE)"; templates.js:112 `tplPrinciplesText` ("còn 1–2 lần nữa mới hết sức (RIR 1–2)", bỏ "(RIR…)" ở giáo án/hồ sơ Mới tập); program-builder.js:36, :1092, :1099 (lý do giáo án riêng: Mới tập không có "RIR"); achievements.js:553 mẹo tổng kết tuần (Mới tập: nói bằng số lần còn dư) | R2-TERM-02 |
| ULPPL / hypertrophy / volume / Upper-Lower | **Đã sửa** | templates.js:133 "Thân trên / Thân dưới 4 buổi — tăng cơ, còn 1–2 lần (RIR)", :145 "Trên–Dưới–Đẩy–Kéo–Chân 5 buổi (ULPPL)", :157 "Đẩy–Kéo–Chân 6 buổi (PPL) — khối lượng cao…", :405 dòng giới thiệu; program-builder.js:255, :1083 | R2-TERM-03 |
| Superset/circuit → "Siêu hiệp"/"Liên hoàn" (§8.2) | **Đã sửa** | training-pro.js:227 `groupLabel`, :1380 tiêu đề sheet "Siêu hiệp & liên hoàn" + giải thích "(superset)/(circuit)" lần đầu, :1418 nút ghép, nút "Siêu hiệp" ở danh sách | R2-TERM-01 |
| "Tiến trình", "chương trình mẫu", "Chương trình của tôi" | **Đã sửa** | training-pro.js:1171 "Mức tạ đã tăng được giữ nguyên…", :1307 "giáo án mẫu"; templates.js:438 "Giáo án của tôi"; program-builder.css:9 (chú thích) | R2-TERM-01, -03 |
| Nghe `fk:health-ready` thay dự phòng | **Đã sửa** | achievements.js:977–990: thẻ "Quay lại tập" vẽ lại 1 lần khi nhận `fk:health-ready` (`_reinjectDone`); `DOMContentLoaded` chỉ còn là dự phòng; dự phòng cờ sức khoẻ thô (`healthFlags`) giữ làm lưới an toàn | R2-HEALTH |

**Test cũ đã cập nhật (ghi chú):** `QT-03` (buổi nhanh) trước bấm `#ach-pre-go` (sheet dự phòng của achievements). Nay health-safety.js gán `FKHealth.openPreSession` sớm nên sheet kiểm tra là của health-safety (`#hs-pre-go`). Test bấm nút nào đang có. Hành vi không đổi. Không có test nào khác so chuỗi cũ ("deload", "Superset", "ULPPL…").

**Chữ chưa đổi (cố ý):**
- Chuỗi số lần trong dữ liệu giáo án, vd `"3-5 · RPE 8"`. Đây là dữ liệu được `repTop`/`progressionFor` đọc bằng regex, chỉ có ở giáo án Nâng cao.
- Tên buổi "Upper/Lower/Push/Pull/Legs" trong `days` của giáo án mẫu. Đây là dữ liệu đã chép vào giáo án người dùng.
- Chữ IN HOA trên thẻ ảnh chia sẻ (canvas) "TUẦN x/y · GIẢM TẢI". Đây là chữ trang trí, đã là tiếng Việt.

### 2. Kiểm trình duyệt

Playwright, context riêng `fix-training`, 390×844. Trang phục vụ qua `page.route` vì `file:` bị chặn.

1. **Bản ghép bỏ 3 khối `exdb-vi-1..3.js`.** Lúc khởi động: `EXDB_VI` = 0 khoá, chỉ tải `app-lazy.html`, 0 lỗi JS.
   - Mở Thư viện ngay (trước lượt nạp trước lúc rảnh ~4 s): tải `exdb-vi-1 → 2 → 3` tuần tự, rồi hiện 915 bài với tên Việt (`r2-01`).
   - Tìm "cuon ta zottman" ra "Cuốn tạ Zottman…" (`r2-02`). Chi tiết bài có hướng dẫn Việt và dòng tên gốc (`r2-03`).
2. **Chặn mạng 3 file.** Thư viện vẫn mở (860 bài, tên gốc) với dòng "Chưa tải được tên tiếng Việt… Thử lại" (`r2-04`).
   - Mở mạng, bấm Thử lại: 876 bản dịch, tên Việt, vẫn ở nhóm Tay trước (`r2-05`).
3. **Bảng chọn bài 800+ khi chưa nạp.** Gõ "hit dat" ra "Chống đẩy (Push-up)…" (`r2-06`).
4. **Buổi tập tuần giảm tải** (`tpl-m-fb`, chu kỳ 8 tuần, tuần 1 = giảm tải).
   - Màn Tập luyện: "Tuần 1/8 · Tuần giảm tải", nút "Chu kỳ & tuần giảm tải", thẻ chu kỳ "Tuần giảm tải", nhãn bài "Giảm tải 2 hiệp" (`r2-10`).
   - Buổi tập: banner "Tuần giảm tải — số hiệp đã giảm ~40%…", nhãn "Giảm tải: 2/3 hiệp" (`r2-11`).
   - Siêu hiệp ở cấp Mới tập: "Siêu hiệp A", không có cột RPE, "(tuần giảm tải, gốc 3)", nút "Xong siêu hiệp — bài tiếp" (`r2-12`).
   - Không còn chữ "deload" trên màn. 0 lỗi JS (chỉ 404 `vendor/exercises.json`: bản thử không có file này nên tải từ GitHub).

### 3. `node tests/run.js`

Lần chạy cuối toàn bộ: 508 test, 495 đạt. **Suite 61: 35/35** (chạy lại `--only 61` sau khi cập nhật QT-03).

Các test đỏ còn lại không thuộc file training. Các agent khác đang sửa song song:
- 02-workout / 60 QT-04: `finishSession`, tập bù (app.js).
- 06 quét tĩnh: app.js:536, ptprofile.js, pt-connect.js.
- 08 / 10: menu, Khám phá, "TapEasy PT".
- 50: `themes-modules.css` cần sinh lại. Phần training sinh lại không đổi.
- 62: nutrition. 63: Chặn.

### 4. Chuyển giao (vòng 2)

1. **ux.**
   - Đã thấy `fk-lazy.js` và thẻ `type="text/fk-lazy"` cho `exdb-vi-1..3.js`. Phía training sẵn sàng, `exdb-vi.js` (mã ghi đè) nên giữ nạp sẵn như hiện tại. Nếu sau này muốn đưa cả `exdb-vi.js` vào nhóm, code training vẫn chạy (exdb.js:98, exdb-vi.js mục 6/8 tự dựng lại), nhưng thứ tự bọc hàm sẽ đổi.
   - `tests/lib/harness.js` `scriptOrder()` hiện vẫn nạp cả thẻ `text/fk-lazy` (regex khớp `src=`), nên 08-integration "EXDB_VI ≥ 800" vẫn đúng. Nếu đổi harness để bỏ thẻ lười thì cần nạp nhóm trước test đó.
   - Chạy `gen_themes_layer.py --modules` ở cuối vòng.
2. **nutrition.** Phía training đã nghe `fk:health-ready` (achievements.js:977). `FKHealth.ready`/`onReady` mới không bắt buộc với achievements.

# FIX-core — vòng sửa lỗi sau QA (11/11/2026)

Fixer **core**. File sở hữu: `app.js`, `pt.js`. Test hồi quy: `tests/suites/60-fix-core.test.js` (35 test, mỗi test có mã lỗi trong tên).

## Kết quả kiểm thử
- `node tests/run.js`: **363/367**. 35/35 test của core xanh. 4 test đỏ không thuộc vùng core:
  - `06-security` quét tĩnh: `nutrition.js:261` (fixer nutrition).
  - `09-integration-r2` ×2: `firestore.rules`, phần chat và sự kiện (fixer security đang sửa).
  - `50-theme-packs`: cần sinh lại `themes-modules.css` (fixer ux).
- Đã kiểm tra cú pháp `app.js` và `pt.js` bằng `new Function`.
- Trình duyệt: Playwright, ngữ cảnh riêng `fix-core` (390×844, vi-VN, chặn service worker), chạy trên bản ghép `_test/fix-core/app.html` (`build-single-html.py --offline`). Không có lỗi JS. Ảnh chụp: `_test/fix-core/fc-01-home-nguoi-moi.png`, `fc-02-buoi-tap-sheet.png`.
  - **Màn chào → onboarding chỉ bằng bàn phím.** Nhấn Tab 3 lần là tới CTA "Bắt đầu ngay", Enter vào thẳng onboarding (không qua form tạo tài khoản).
    - Thẻ giới tính, vận động, mục tiêu và kinh nghiệm: Space hoặc Enter để chọn, phím mũi tên đổi lựa chọn. `aria-checked` và lớp `selected` luôn khớp nhau.
    - Xong onboarding (nữ, mới tập) thì nhận giáo án `tpl-f-fb` Full Body nữ, và `startDate` = hôm nay.
  - **Trang chủ của người mới (cài vào thứ Tư).** T2 không bị chấm "bỏ lỡ"; dòng chỉ tiêu ghi "Tuần này: 0/3".
    - "Bắt đầu tập" (focus rồi Enter) mở **ngay** buổi T4 "Bài 1/6 · Hôm nay"; vẫn còn link phụ "Xem buổi hôm nay".
  - **Sheet.** Có `role=dialog`, `aria-modal`, `aria-labelledby`, và focus vào trong sheet khi mở.
    - Tab/Shift+Tab 45 lần: 0 lần thoát ra ngoài. Nền (`#app-scroll`, `.bottom-nav`…) được đặt `inert`.
    - Esc đóng sheet, gỡ `inert`, trả focus về nút đã mở ("Bắt đầu tập", nút menu ☰). Buổi tập chuyển sang tạm dừng.
  - **Ô chỉ số và chip chuỗi ngày.** Enter trên ô chỉ số mở Dinh dưỡng (đúng 1 lần), Space trên chip chuỗi mở Tập luyện.
    - Màn Dinh dưỡng chỉ có 21 nút DOM trước khi vào, 2.185 nút sau khi vào: màn được vẽ lười.

## Bảng lỗi

| Mã | Mức | Trạng thái | Vị trí (app.js / pt.js) | Test (60-fix-core) |
|---|---|---|---|---|
| QS-01 | Nghiêm trọng | Đã sửa (phần lõi). `confirmDialog` an toàn theo mặc định: `fkSafeHtml` chỉ giữ thẻ định dạng, `opts.text` escape toàn bộ, chuỗi đã escape không bị escape 2 lần. Nhờ đó `events.js:1806` hết chạy script. | app.js:243 `fkSafeHtml`, :267 `confirmDialog` | QS-01/QS-22 |
| QS-02 | Nghiêm trọng | Đã sửa (phần pt.js). Hàng "Buổi với PT" dùng `data-pt-cid`/`data-pt-role` đã escape, và một listener click dùng chung cho cả Trang chủ thay cho `onclick` chèn id. | pt.js:680, :707–718 | QS-02 |
| QS-03 | Cao | Đã sửa (lớp hiển thị). Escape intensity/title/duration/sets/reps/muscle ở Trang chủ, màn Tập luyện, buổi tập, trình sửa giáo án (`value=` của hiệp/lần/nghỉ/thời lượng, `data-item`, `data-thumb-clip`). | pt.js:641–645; app.js:1672–1700, :1802–1828, :1161 | QS-03 |
| QS-04 | Cao | Đã sửa (lớp hiển thị). Ảnh bài do PT giao (`custom.img`, `stock.thumb`) đi qua `attrUrl` ở mọi chỗ vẽ (thẻ bài, chi tiết, buổi tập, trình sửa giáo án, sheet sửa bài). | app.js:935, 969, 1152, 1694, 1828 | QS-04 |
| QS-20 | Thấp | Đã sửa. `safeUrl` chặn `//host`, `/\host`, `\\host` và URL có ký tự điều khiển. | app.js:2202 | QS-20 |
| QS-22 | Thông tin | Một phần. `openSheet(html, {text:true})` cho chữ thuần, `confirmDialog` an toàn theo mặc định. Cũng escape thêm vài ô nhập (API key, Drive client id, cân nặng InBody). CSP và việc bỏ `onclick` nội tuyến thuộc index.html (ux). | app.js:650, 2250–2255, 3337 | QS-22 |
| QC-11 | Thấp | Đã sửa (lõi). `saveState()` trả `false` khi localStorage đầy và báo "Bộ nhớ máy đầy" (tối đa 1 lần/15 s). Hàm bọc ở pt.js giữ giá trị trả về; rbac.js vốn đã giữ. | app.js:151; pt.js:84 | QC-11 |
| QT-01 | Cao | Đã sửa. Gõ kg ở hiệp 1 thì tự điền xuống các hiệp sau. Bấm ✓ hoặc "Xong" thì hiệp trống kế thừa kg hiệp trước/buổi trước. `progressionFor` đọc dữ liệu cũ 0 kg như ô trống. | app.js:1192–1242, 3507 `fkFillBlankKg`, 3584 | QT-01 (+ 61-fix-training) |
| QT-02 | Cao | Đã sửa. Nấc tăng theo dụng cụ và % (`fkNextKg`). Giảm tải luôn nhẹ hơn ít nhất 1 nấc (`fkDeloadKg`); không giảm được nữa thì giữ tạ và hạ mục tiêu lần. | app.js:3481, 3492, 3555 | QT-02 · QT-18 |
| QT-04 | Cao | Đã sửa. Buổi của ngày khác hỏi "Tập buổi … hôm nay?". Chọn tập thì lưu vào hôm nay (`makeup`, `makeupFor`); ngày gốc không bị tính bỏ lỡ (chuỗi, dải tuần). | app.js:1086, 1286–1304, 1039 | QT-04 |
| QT-05 | Cao | Đã sửa. Onboarding hỏi kinh nghiệm tập tạ. Giáo án mặc định theo cấp độ, giới tính và sàng lọc (`fkDefaultTemplate`); vai trò PT cũng không bị gán giáo án 6 buổi. | app.js:325, 338, 772, 819; pt.js:365 | QT-05 |
| QT-06 | TB | Đã sửa (lõi). 2 buổi trong cùng ngày được gộp trong setHist (`parts` theo `sid`); workoutLog giữ `earlier`. | app.js:3584–3630, 1296 | QT-06 |
| QT-07 | TB | Đã sửa. `session.date` được chốt lúc bắt đầu; setLog/setHist/workoutLog/finishedDates ghi theo ngày đó. | app.js:1094, 1292, 3588 | QT-07 |
| QT-10 | TB | Đã sửa (lõi). Điền sẵn số lần của buổi trước; tăng tạ thì về đáy khoảng lần. | app.js:3532 | QT-10 |
| QT-11 | TB | Đã sửa. `normalizeState` chạy khi nạp, khôi phục sao lưu và khi giáo án vào lúc chạy (`fkEnsurePlanDays`). Sheet Lịch sử chịu được bản ghi thiếu trường. | app.js:101, 875, 3273, 3667 | QT-11 |
| QT-12 | TB | Đã sửa (pt.js). `hideAuth` dừng hẳn video nền (pause, bỏ src, `load()`). | pt.js:342, 352 | QT-12 |
| QT-15 | Thấp | Đã sửa. Khởi động theo khoảng lần: tăng cơ 2 hiệp, máy 1 hiệp, thanh rỗng 20 kg không cần khởi động. | app.js:3634 | QT-15 |
| QT-16 | Thấp | Đã sửa. Nút "Đĩa tạ" chỉ hiện với thanh đòn; tạ đơn ghi "Kg/quả". | app.js:1153, 1166 | QT-16 |
| QT-17 | Thấp | Một phần. Bài trọng lượng cơ thể đạt đỉnh lần thì gợi ý biến thể khó hơn hoặc đeo tạ. Kỷ lục số lần trong thẻ Kỷ lục thuộc achievements (training). | app.js:3560 | QT-17 |
| QT-18 | Thấp | Đã sửa. Thang tạ đơn chuẩn `DB_LADDER` (10 → 12 → 14). | app.js:3479 | QT-02 · QT-18 |
| QT-20 | Thấp | Đã sửa (phần Trang chủ). Chỉ tiêu tuần và chấm bỏ lỡ tính từ max(thứ Hai, `startDate`, ngày bắt đầu giáo án). | app.js:354 `fkStartDate`; pt.js:605–614 | QU-20 · QT-20 |
| QN-04 | Cao | Đã sửa (lõi). `fkNum` đọc "1,5" = 1,5 và "1.500" = 1500. Ô số lượng/mục tiêu là `type=text inputmode=decimal`; hỏi lại khi > 1.000 g hoặc > 1.500 kcal. | app.js:2664, 2805–2843, 2693–2697 | QN-04 · QN-20 |
| QN-05 | TB | Đã sửa (lõi). Calo 800–6.000. Tổng macro phải khớp calo ±10 % (có gợi ý tinh bột). Dưới sàn (nữ 1.200 / nam 1.500 / BMR) hoặc đạm > 35 % phải xác nhận lần 2. Nước 0,5–6 L. | app.js:2689–2741, 2745–2771 | QN-05 |
| QN-06 | TB | Đã sửa (lõi). Cộng nước chính xác tới ml (`fkAddWater`). | app.js:2847 | QN-06 |
| QN-07 | TB | Đã sửa (lõi). `waterTargetL`: 35 ml × cân điều chỉnh, kẹp 1,5–3,7 L; thai T2–T3 +0,3 L; cho bú +0,7 L; lọc máu thì không đặt chỉ tiêu ("theo bác sĩ"). | app.js:2674 | QN-07 |
| QN-08 | TB | Đã sửa. g đạm/kg theo mục tiêu, vận động và tuổi; trần 35 % năng lượng và 180 g. | app.js:185, 193 | QN-08 |
| QN-20 | Thấp | Một phần (lõi). `fmtVN`/`fmtKg` hiển thị kiểu Việt ở phần lõi. | app.js:2661 | QN-04 · QN-20 |
| QN-24 | Thấp | Đã sửa. EER IOM 2005 cho 9–17 tuổi. BMI theo tuổi (WHO) thuộc meals.js (nutrition). | app.js:207, 219 | QN-24 |
| QN-27 | Thấp | Đã sửa. BMI < 19,5 thì thâm hụt tối đa 10 %; BMI < 18,5 hoặc < 18 tuổi thì không cho thâm hụt. | app.js:222–227 | QN-27 |
| QU-02 | Cao | Một phần. Không vẽ trước các màn ẩn, `finishBoot`/`finishOnboarding` không gọi `renderAll()` trước `goto()`. Chưa làm: `appBoot` nhường luồng sau khi vẽ Trang chủ (rủi ro với hơn 30 module bọc hàm; cần đo lại cùng fixer ux). | app.js:3405; pt.js:384 | QU-02 · QU-03 |
| QU-03 | Cao | Đã sửa (lõi). Dinh dưỡng chỉ vẽ khi vào màn (đo được 21 → 2.185 nút). Ghi nhớ `buildDayPlan` thuộc nutrition. | app.js:3405, 517 | QU-02 · QU-03 |
| QU-07 | TB | Đã sửa. Bỏ `void sc.offsetWidth`; bấm lại màn đang mở không chạy lại hiệu ứng. | app.js:496 | QU-07 |
| QU-13 | Cao | Đã sửa. CTA lớn "Bắt đầu ngay" vào thẳng onboarding (khách). | pt.js:142, 212 | QU-13 |
| QU-14 | Cao | Đã sửa. "Bắt đầu tập" gọi `startSession(todayDayKey())` (đi qua mọi lớp bọc); "Xem buổi hôm nay" là link phụ. | pt.js:647–650, 707 | QU-14 |
| QU-15 | TB | Đã sửa (pt.js). Chọn "Tôi là PT" thì đặt `coachTab="clients"` và mở thẳng màn PT. | pt.js:368 | QU-15 |
| QU-20 | TB | Đã sửa. Không chấm bỏ lỡ trước ngày bắt đầu hoặc ngày đã tập bù. | pt.js:605–614, 632 | QU-20 · QT-20 |
| QU-22 | Thấp | Đã sửa. Người mới không thấy cột RPE, có thẻ "Cách ghi hiệp" và gợi ý mức nhẹ; nút "Hiện cột RPE" bật lại được. | app.js:1143–1180, 3528 | QU-22 |
| QU-29 | Cao | Đã sửa. Sheet là dialog: có nhãn, focus vào khi mở, bẫy Tab, nền `inert`, trả focus khi đóng. Lưới an toàn MutationObserver để module đóng sheet kiểu khác không làm app kẹt `inert`. | app.js:650–711 | QU-29 |
| QU-30 | Cao | Đã sửa. Thẻ onboarding là `role=radio` + `aria-checked` + `tabindex=0`; Enter/Space/mũi tên dùng được. Thẻ vai trò, ô chỉ số và chip chuỗi có `role=button` + phím. Bỏ qua nếu ui-kit đã xử lý (`defaultPrevented`), nên không bấm 2 lần. | app.js:712–733, 753–769, 800; pt.js:326, 628, 661–669 | QU-30 |

## Chuyển giao (file không thuộc core)
1. **health-safety.js** (nutrition). Lớp sàng lọc `#hs-overlay` mở sau onboarding nhưng **không nhận focus**: focus vẫn ở `#onboard-next`, phải Tab 23 lần mới tới "Để sau".
   - Đề xuất: khi mở overlay thì đặt `role="dialog" aria-modal="true"`, focus nút đầu tiên, `inert` các anh em, Esc = "Để sau".
   - Có thể dùng lại `fkSheetFocusables` của app.js.
2. **events.js:480, 543–548** và **shop.js:277, 822** (commerce), QC-11. Đọc giá trị trả về của `saveState()`; nếu `=== false` thì hoàn tác cộng điểm/đánh dấu voucher và không báo "+N điểm".
3. **events.js:1806** (commerce), QS-01. `confirmDialog` đã tự lọc, nhưng nên gọi `esc(r.name)` hoặc truyền `{ text:true }`. Các nơi tự escape (coach.js:400, findpt.js:61, nutrition-pro.js:1050, pt-pro.js:844/1279) vẫn hiển thị đúng; không cần sửa.
4. **cloud-social.js `planFromRoutine`** (pt), QS-03, và **pt-connect.js:676–679 `toPlanItem`** (pt), QS-04. Lõi đã escape ở lớp hiển thị. Cần lọc ngay lúc nhập: whitelist intensity, cắt độ dài, ép số cho sets/rest, `safeUrl(e.img, {noBlob:true})`.
5. **nutrition-pro.js:1190** (nutrition), QN-04. Hàm này đè `openFoodQuantity` của lõi; bản đè phải đọc số qua `fkNum` (đã có sẵn ở app.js).
6. **index.html** (ux), QS-22. CSP. app.js/pt.js vẫn còn `onclick="closeSheet()"` / `goto('…')` với **hằng số** (không có dữ liệu người dùng), nên CSP phải có `'unsafe-inline'` cho tới khi chuyển hết sang listener.

## Việc còn lại
- QU-02: cho `appBoot()` nhường luồng sau khi vẽ Trang chủ (`await new Promise(r=>setTimeout(r))`). Việc phụ của module chuyển sang `requestIdleCallback`. Cần đo lại TTI/TBT cùng fixer ux trước khi gộp.
- QT-17: kỷ lục số lần cho bài trọng lượng cơ thể trên thẻ Kỷ lục (achievements).
- Chuyển các `onclick` hằng số còn lại trong app.js/pt.js sang listener dùng chung để bật CSP chặt (QS-22).

## Vòng 2 (11–12/11/2026) — xử lý "Chuyển giao" (HANDOFF-ROUND-BRIEF mục core)

### Kết quả
- `node tests/run.js` theo từng suite (`--only`, công cụ cắt lệnh chạy cả bộ sau ~100 s): **24/24 suite xanh, 553/553 test** (00:35 ngày 12/11). Suite 60-fix-core: **44/44** (35 cũ + 9 mới).
- Cú pháp `app.js`, `pt.js`: `new Function` OK. Không đổi khoá `fitkit_state_v1`, không đổi tên/chữ ký hàm toàn cục (chỉ THÊM hàm mới).
- Trình duyệt: Playwright, **ngữ cảnh riêng tạo mới mỗi lần** (390×844, DPR 2, vi-VN, chặn SW, chặn mạng ngoài), phục vụ qua `route.fulfill`. Bản ghép `_test/fix-core/r2/before.html` (app.js/pt.js đầu vòng) và `after.html` (bản sửa) dựng bằng `build-single-html.py --offline` từ CÙNG ảnh chụp các file khác ⇒ chênh lệch chỉ do app.js/pt.js. **0 lỗi JS.** Ảnh: `_test/fix-core/r2/r2-01-menu.png`, `r2-02-menu-tim.png`, `r2-03-tien-do-ky-luc.png`, `r2-04-giao-an.png`, `r2-05-buoi-6-giay.png`.
  - **Menu ☰**: 12 mục hiện sẵn / 4 nhóm có tên (Tập luyện · Dinh dưỡng & sức khoẻ · PT & cộng đồng · Kiến thức & cửa hàng), 10 lối tắt ẩn; cao 1 125 px (trước 1 645 px ≈ 2,1 màn → 1,3 màn). Ô "Tìm trong TapEasy": "video" → Thư viện bài tập + Kho video của tôi; "đi chợ" → Đi chợ tuần; "gian hang" → Cửa hàng; không khớp → gợi ý "Tìm bài tập …" / "Tìm trong Kho kiến thức". Bàn phím: Enter ở ô tìm mở dòng đầu; mọi dòng hiện `tabindex=0`.
  - **Tiến độ → Kỷ lục**: chạm "Tiến độ" → tab đang chọn "Kỷ lục*" (Kỷ lục · Ảnh tiến độ · Chỉ số InBody), thẻ Kỷ lục cá nhân (1RM + số lần bài trọng lượng cơ thể) + thẻ Khối lượng tuần (training-pro chèn sau `.pr-card`); tab Ảnh không còn thẻ kỷ lục.
  - **Giáo án**: menu → màn "Giáo án" có nút Lịch tuần, banner Giáo án mẫu + Tạo giáo án riêng, mục "Giáo án của tôi".
  - **Buổi 6 giây** (bấm Xong liên tục + "Ghi nhận tất cả"): buổi kết thúc, `finishedDates`/`workoutLog` không đổi, màn hoàn thành báo "không tính".
- **Đo khởi động (CPU 4×, mỗi lần nạp 1 ngữ cảnh mới, before/after xen kẽ, trung vị 3 lần, ms).** Máy chủ dùng chung với 6 agent nên dao động ±30 %; lần nạp thứ 2 trong cùng ngữ cảnh luôn chậm hơn (bỏ, không dùng).

  | Người quay lại (Trang chủ) | FCP | Trang chủ hiện | LCP | DCL | TTI* | TBT | Long task dài nhất |
  |---|---|---|---|---|---|---|---|
  | Trước | 708 | 1 260 | 3 632 | 2 518 | 6 676 | 1 196 | 290 |
  | Sau | 692 | 1 239 | 3 608 | 2 469 | 4 201 | 1 066 | 290 |

  *TTI = cuối long task cuối cùng trong 9,5 s. Bản "Sau" đầu tiên (ghi hồ sơ lúc rảnh qua `saveState()`) **chậm hơn** (TBT 1,6–1,9 s, long task muộn ở 6–10 s) vì lần ghi trễ đi qua mọi lớp bọc saveState của module (đồng bộ, thành tích…) → đã đổi: chỉ ghi khi hồ sơ thật sự đổi và ghi bằng bản lưu gốc. Đường khởi động của lõi (appBoot → finishBoot → Trang chủ) chỉ ≈ 270 ms CPU (profile CDP, cả trước lẫn sau); phần còn lại của TBT nằm ở module (xem Chuyển giao vòng 2).

  | Mở lần đầu (màn chào) | Gọi API video | Ảnh nền | TBT (2 lần) |
  |---|---|---|---|
  | Trước | 1 (`pixabay.com/api/videos/?key=…`) | Pexels w=1080 | 2 177 · 884 |
  | Sau | **0** | Pexels **w=720** | 1 268 · 1 055 |

### Bảng lỗi vòng 2
| Mã | Mức | Trạng thái | Vị trí | Test (60-fix-core) |
|---|---|---|---|---|
| QU-18 | TB | Đã sửa. Menu ☰ 22 → **12 mục hiện sẵn** + ô "Tìm trong TapEasy" ở đầu; mục trùng thanh dưới / đã gộp thành **lối tắt ẩn** (vẫn trong menu, hiện khi tìm). Giữ mốc module dựa vào (dòng `goto('sleep')` đúng chuỗi, `goto('reminders');closeSheet();`, dòng `goto('coach')`). Dòng do module chèn: đổi chữ theo GLOSSARY (Thi đua → "Sự kiện", Gặp mặt & vé → lối tắt ẩn, "Gian hàng TapEasy" → "Cửa hàng"), thêm từ khoá tìm, `role=button`+`tabindex`. Chữ người dùng gõ chỉ qua `textContent`/closure. | app.js:526–572 `TE_MENU_DEEP`/`teMenuRowHTML`/`openMainMenu`, :583 `TE_MENU_GROUPS`, :594 `teMenuSlot`, :622 `teMenuKw`, :634 `teMenuRelabel`, :647 `teMenuOrganize`, :684 `teMenuFilter`, :717 `teMenuBindSearch`; màn Giáo án app.js:1704 `renderPlanListHTML` | QU-18 ×2 |
| QU-21 | Thấp | Đã sửa. Màn Tiến độ: tab **"Kỷ lục"** (mặc định, đứng đầu) — 1RM ước tính + **kỷ lục số lần** bài trọng lượng cơ thể (phần còn lại của QT-17), số buổi, lối sang Thành tích / Nhật ký buổi tập. Nút tab chèn bằng JS nếu index.html chưa có; 1 trình nghe uỷ quyền. `openProgress(tab)` cho module khác. Menu "Ảnh tiến trình & InBody" → **"Tiến độ"**. | app.js:2148 `renderProgressScreen`, :2158 `fkEnsureRecordsTab`, :2169 `openProgress`, :2174 `fkRepRecords`, :2183 `renderProgressRecordsTab`; `progressUI.tab="records"` | QU-21 |
| QU-02 | Cao | Đã sửa (phần lõi). `appBoot`: vẽ Trang chủ → `await fkYield()` (scheduler.yield / setTimeout 0) → `refreshCoachData`; lịch thông báo native + đăng ký service worker qua `fkIdle` (rIC + setTimeout dự phòng, chạy đúng 1 lần). `finishBoot` chỉ ghi khi hồ sơ tính lại thật sự đổi, ghi bằng `_saveStateV1` (không kích hoạt lớp bọc module lúc mở). Đo: trong nhiễu (bảng trên) — nút thắt còn lại ở module. | pt.js:374 `fkIdle`, :381 `fkYield`, :416 `finishBoot`, :895–910 `appBoot` | QU-02 |
| QU-04 | Cao | Đã sửa (pt.js). Màn chào **không gọi API video** (Pixabay/Pexels, khoá lộ ở client) — chỉ gắn video nền khi có URL cố định gán lúc build (`MEDIA_CONFIG.welcomeVideo` ≠ "auto", qua `safeUrl`), lúc rảnh. Nền = ảnh tĩnh nhỏ (Pexels w=720 thay 1080). | pt.js:128, :357 `welcomePoster`, :361 `welcomeVideoFixedSrc`, :368 `scheduleWelcomeVideo`, :233 | QU-04 |
| QN-10 | TB | Đã sửa. < 18 tuổi chọn "tăng cơ" → `round(EER × 1,05)` (16 tuổi 58 kg năng động: hết +12 %); người lớn giữ +12 %. | app.js:224–225 | QN-10 |
| Training §4.4 | — | Đã sửa. `fkPrefillRows` gọi `FKTP.ensureRows` (một nguồn điền sẵn: top set QT-08, quay lại sau nghỉ QT-13, tuần giảm tải) cho bài thuộc buổi đang tập; ngoài buổi / lỗi → logic lõi. | app.js:3723 | Training §4.4 |
| Training §4.5 | — | Đã sửa ("buổi < 3 phút"). Buổi chỉ ghi `workoutLog`/`finishedDates`/chuỗi (và vì thế XP, huy hiệu, nhật ký training-pro) khi ≥ 3 phút **hoặc** ≥ 1 hiệp người tập tự ghi số lần (✓ từng hiệp / sửa số lần). "Ghi nhận tất cả" đánh dấu `_bulk`. Chốt trong `renderSessionStep` trước `finishSession()` (`fkSessionGate` đặt `isToday=false`, `tooShort`) để MỌI lớp bọc (training-pro, achievements, pt-connect) cùng thấy. Phiên không có `startedAt` (dữ liệu cũ) → tính như trước. Lưu ý: kg × lần từng bài (setLog/setHist) vẫn ghi khi người tập xác nhận. | app.js:1230, :1340, :1389, :1428 `fkSessionCounts`, :1437 `fkSessionGate` | buổi < 3 phút |
| §8.4 / QU-31 | — | Đã sửa (app.js/pt.js). "Chương trình" → "Giáo án" (màn, nút, toast, tên mặc định); "ảnh tiến trình" → "ảnh tiến độ"; "Gian hàng" → "Cửa hàng" (ô Khám phá); "Album PT công khai" / "Routine của PT" / "Thi đua T…" → chữ mới; "ĐANG DÙNG" → "Đang dùng"; BMR/TDEE giải thích tiếng Việt. Chữ nội tuyến < 12 px: 0 (7 chỗ → 12 px). | app.js, pt.js | Thuật ngữ §8.4 + QU-31 |

### Ánh xạ menu ☰ cũ (22 mục) → mới
| Mục cũ | Mới |
|---|---|
| Trang chủ | Lối tắt ẩn "Trang chủ" (thanh dưới) |
| TapEasy PT — PT & Học viên | Lối tắt ẩn "PT" (thanh dưới "PT"); dòng giữ để community/findpt chèn |
| Giấc ngủ | Giấc ngủ (Dinh dưỡng & sức khoẻ) |
| Hồ sơ của tôi | Lối tắt ẩn "Hồ sơ" (thanh dưới) |
| Nhắc nhở | Nhắc nhở (Dinh dưỡng & sức khoẻ) |
| Lịch tập tuần này | Gộp vào **Giáo án** (nút "Lịch tuần") + lối tắt ẩn "Lịch tuần" + thanh dưới "Tập luyện" |
| Thực đơn & nhật ký ăn | Lối tắt ẩn (thanh dưới "Dinh dưỡng") |
| Đi chợ tuần | Lối tắt ẩn (nút "Đi chợ tuần" trong màn Dinh dưỡng) |
| Giáo án mẫu Nam / Nữ | Gộp vào **Giáo án** (banner) + lối tắt ẩn "Giáo án mẫu" |
| Thư viện bài tập theo nhóm cơ | Thư viện bài tập |
| Quản lý chương trình tập | **Giáo án** (màn Giáo án / "Giáo án của tôi") |
| Kho video của tôi | Lối tắt ẩn (tìm "video") + lối tắt "Kho video" ở màn Tập luyện |
| Ảnh tiến trình & InBody | **Tiến độ** (Kỷ lục · Số đo InBody · Ảnh tiến độ) |
| Tạo giáo án riêng | Gộp vào **Giáo án** (banner) + lối tắt ẩn |
| Thành tích & huy hiệu | Thành tích & huy hiệu (+ nút trong tab Kỷ lục) |
| Sức khoẻ & an toàn | Sức khoẻ & an toàn (chuyển sang nhóm Dinh dưỡng & sức khoẻ) |
| Cộng đồng (community.js) | Cộng đồng (PT & cộng đồng) |
| Tìm PT (findpt.js) | Tìm PT (PT & cộng đồng) |
| Sự kiện & Thi đua (events.js) | **Sự kiện** (chữ đổi bằng `teMenuRelabel`; màn Sự kiện có tab Thi đua/Offline/Quà…) |
| Sự kiện offline & vé (events.js) | Gộp vào Sự kiện + lối tắt ẩn "Gặp mặt & vé" |
| Gian hàng TapEasy (events.js) | **Cửa hàng** (Kiến thức & cửa hàng) |
| Kho kiến thức (kb.js) | Kho kiến thức (Kiến thức & cửa hàng) |
| Bảng quản trị (admin.js, chỉ khi có vai trò) | Giữ nhóm "Quản trị" |

### Test cũ cập nhật (hành vi đổi có chủ đích, có ghi chú trong file)
- `02-workout` "Buổi tập có hướng dẫn…": giả lập buổi đã bắt đầu 4 phút trước (buổi < 3 phút chỉ "Ghi nhận tất cả" không còn tính).
- `08-integration` "Khu PT gọi là 'TapEasy PT'": phần menu kiểm tên mới "PT · Học viên · PT của tôi" (GLOSSARY §8.1).
- `10-integration-r3`: nhóm menu mới + ánh xạ `teMenuSlot`; ô Khám phá "Gian hàng" → "Cửa hàng".
- `60-fix-core` QT-04: đặt giờ giả +40 phút trước khi kết thúc buổi bù.

### Chuyển giao vòng 2
1. **ux · index.html:253–256** — thêm nút tĩnh `<button type="button" class="day-tab" data-ptab="records">Kỷ lục</button>` ĐẦU `#progress-tabs` và bỏ `active` khỏi nút "Ảnh tiến độ" (app.js đang chèn bằng JS nếu thiếu — có nút tĩnh thì không chèn). Tuỳ chọn: `role="tablist"/"tab"` cho `.day-tabs`.
2. **ux · style.css** — ô tìm menu dùng `.search-box` (chữ `#fff` cứng ở `.search-box input` → theme Sáng cần `color:var(--text)`); dòng `.te-mdeep` đang ẩn bằng `style="display:none"` nội tuyến vì style.css không có luật `[hidden]` chung — nên thêm `.te-menu-list .te-mdeep[hidden]{display:none}`.
3. **training · training-pro.js:1482 `insertVolumeCard`** — chỉ chèn thẻ Khối lượng tuần khi `progressUI.tab === "records"` (hiện chèn cả ở tab Ảnh/InBody).
4. **training · training-pro.js:838** — nhánh "Ghi nhận tất cả" của siêu hiệp nên đặt `r._bulk = true` như app.js (để buổi < 3 phút chỉ bấm cả loạt không tính).
5. **training · freevideos.js:48–98 / templates.js:448 `refreshPlanVideos`** — khi mất mạng, mỗi bài gọi lại `loadWgerIndex`/`loadExtraIndex` → **55 request index.json trong 10 s** (đo ở bản ghép, mạng ngoài bị chặn). Đề xuất: nhớ lỗi 60 s (backoff) hoặc `refreshPlanVideos` dừng khi index rỗng / `navigator.onLine === false`.
6. **training · achievements.js** — popup huy hiệu + `confetti`/`tick` chạy ngay lúc mở app (~600 ms CPU ở 4×, mục lớn nhất của TBT khi khởi động trong profile). Đề xuất: hoãn popup tới sau tương tác đầu / lúc rảnh, tắt confetti khi `prefers-reduced-motion` hoặc máy yếu.
7. **pt · pt-connect.js:1352 `finishSession`** — buổi PT giao bị chặn "buổi < 3 phút" vẫn được gửi `finishPTSession`; nên bỏ qua khi `session.tooShort`.
8. **commerce · events.js:2265–2267** — đổi chữ dòng menu tại nguồn ("Sự kiện", "Cửa hàng"; bỏ dòng "Sự kiện offline & vé" hoặc để app.js gộp như hiện tại); community.js:756 sub "Routine chia sẻ…" → "Giáo án chia sẻ…"; findpt.js:1369 sub "Album PT công khai…" (pt).
9. **integrator** — `media-config.js:20` `welcomeVideo:"auto"` nay KHÔNG còn tìm video lúc chạy (QU-04): muốn có video nền, gán sẵn 1 URL .mp4 (CDN của app) lúc build.

### Việc còn lại
- QU-02: nút thắt khởi động nằm ở module (popup thành tích, freevideos, ~50 file JS chạy lúc mở) — cần nạp lười theo màn (QU-01, FIX-ux §3 `loadGroup`) — chưa làm (đụng index.html + thứ tự bọc của health-safety/cloud-admin; cần phối hợp ux).
- QU-11 (gỡ DOM màn module rời > 60 s) và chuyển `onclick` hằng số sang listener để bỏ `'unsafe-inline'` (QS-22) — chưa làm.

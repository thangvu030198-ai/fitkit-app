# INTEGRATION-LOG — Vòng tích hợp 1 (11/11/2026) · TapEasy

Người tích hợp: lead integrator. Phạm vi: tích hợp 10 module + sửa 19 bug QA (`tests/REPORT.md`) + đổi thương hiệu FIT KIT → **TapEasy**.

**Kết quả kiểm thử**
- `node tests/run.js` → **160 test · 160 pass · 0 fail** (9 suite; trước tích hợp: 125 test, 30 fail).
- Trình duyệt thật (Chromium qua Playwright, **ngữ cảnh riêng** `tapeasy-integrator`, 400×860): `_test/integrated.html` (ghép toàn bộ index.html + kịch bản `tests/browser/t_integrated.js`) → **41/41 PASS, 0 lỗi JS**: màn chào → Dùng ngay → onboarding 5 bước → sàng lọc sức khoẻ "Để sau" → 11 màn chính → menu → 10 sheet của module → bắt đầu buổi tập → theme Sáng. Ảnh: `_test/shots/integ-1-welcome.png`, `integ-2-home.png`, `integ-3-menu.png`, `integ-4-home-light.png`, `integ-5-coach.png`.
- Bản dùng thử 1 file: `outputs/FitKit-dung-thu.html` (2,4 MB, CSS/JS/ảnh logo nhúng sẵn) — đã mở thử: không lỗi JS, logo hiện đúng.

---

## 1. Đã tích hợp

### Thứ tự nạp (index.html)
```
<head>  style.css → themes.css → ui-kit.css → nutrition-pro.css → training-pro.css → program-builder.css → pt-pro.css
        → achievements.css → health-safety.css → brand.css → themes-modules.css      + <script themes.js> (áp theme trước khi vẽ)
<body>  icons, firebase-config, media-config, cloud, data, templates, exdb, app, meals, meals-extra, nutrition, freevideos,
        video, library, coach, ptprofile, pt
        → ui-kit → exdb-vi-1/2/3 → exdb-vi → nutrition-pro → training-pro → program-builder → pt-pro → achievements → health-safety (CUỐI)
```
- `brand.css` đặt **sau themes.css và sau CSS module, ngay trước themes-modules.css** — thoả yêu cầu "sau themes.css" và đúng khuyến nghị trong đầu file brand.css.
- Thêm `<link rel="icon">`, `apple-touch-icon`, meta `description` / `application-name` / `og:*` = TapEasy.

### File đóng gói
- `sw.js`: cache `fitkit-v3` → **`fitkit-v4`**; ASSETS gồm mọi JS/CSS cục bộ + icon + `assets/brand/*`. Cài đặt lưu **từng file** (`c.add(u).catch()`), 1 file 404 không làm hỏng cả bộ nhớ đệm như `addAll`.
- `scripts/prepare-www.sh`: chép đủ 11 CSS + 29 JS + `assets/brand/`, icon, shortcut; tự **kiểm tra mọi `src/href` của index.html đã có trong www/**.
- `themes-modules.css`: sinh lại bằng `gen_themes_layer.py --modules` cho **6** CSS module (bản cũ thiếu nutrition-pro.css, program-builder.css) — 557 luật.
- `scripts/food_sources.json`: thêm 95 từ khoá ảnh (50 thực phẩm + 45 món) theo INTEGRATION-nutrition-pro §9.
- `.gitignore` (mới): `functions/node_modules/`, `functions/.env`, `*.p8` (INTEGRATION-health-safety C3).
- `scripts/build-single-html.py` (mới): ghép index.html thành 1 file (nhúng CSS/JS, ảnh `assets/…` ≤ 400 KB thành base64, chặn đăng ký service worker; `--test <file>` chèn kịch bản kiểm thử, `--offline` bỏ font/CDN). Dùng để tạo `_test/integrated.html` và `FitKit-dung-thu.html`.

### Diff đề xuất trong INTEGRATION doc đã áp vào file lõi
| Nguồn | Thay đổi |
|---|---|
| health-safety C1 | `cloud.js`: lưu `lastAppleGrant` khi xác thực Apple (native: authorizationCode; web: accessToken), `revokeAppleIfNeeded()` gọi callable `revokeAppleToken` (asia-southeast1) **trước** `u.delete()`; lỗi không chặn xoá. `pt.js` sheet xoá tài khoản: dòng "thu hồi quyền Đăng nhập với Apple" cho tài khoản Apple. |
| pt-pro §2 | `firestore.rules`: học viên tự cập nhật `health`, `measurements`, `photos` (onlyKeys, vẫn phải là học viên của form). |
| achievements §3 | Menu ☰: "Thành tích & huy hiệu" (+ "Tạo giáo án riêng", "Sức khoẻ & an toàn"). |
| program-builder | `tests/program-builder.test.js` → **`tests/suites/07-program-builder.test.js`** (vừa chạy độc lập như cũ, vừa là 1 suite của run.js qua tiến trình con; 438 819/438 819 kiểm tra đạt). |

---

## 2. Bug đã sửa (BUG-xx → cách sửa)

| Bug | Sửa |
|---|---|
| **BUG-01** XSS `toast()` | `app.js toast()`: icon và nội dung đều `escapeHtml` (tương đương textContent). Mọi caller (pt.js nhắc buổi PT, coach.js "Đã kết nối với PT…", lỗi API, dữ liệu tự nhập) an toàn. `confirmDialog` vẫn nhận HTML → escape ở caller `app.js` (Khôi phục chương trình). |
| **BUG-02** trường cloud chèn thô | Thêm `safeUrl(u)` / `attrUrl(u)` / `richText(s)` (app.js). coach.js, ptprofile.js, pt.js: escape cả "số"/giờ (`escapeHtml(String(e.sets ?? "-"))`, `Math.max(0, Number(...))`), ảnh PT qua `attrUrl(…, {noBlob:true})` (chỉ https / data:image base64 / đường dẫn nội bộ), `NOTE_KINDS` whitelist cho class ghi chú, ảnh bài PT giao qua `attrUrl`. video.js: `vHref()` chỉ nhận http(s) cho mọi link credit; `src/poster` qua `attrUrl`. |
| **BUG-03** firestore.rules | users: `allow get` chỉ **chính mình hoặc hồ sơ PT** (`isPT == true`), `allow list: if false`. notes: `validNote()` — `authorUid == me()`, chỉ PT được ghi vai "pt", `kind` ∈ note/reminder/feedback, text ≤ 4000; chỉ tác giả sửa; PT hoặc tác giả xoá. sessions: PT & học viên tạo/sửa như cũ. **Tách email**: cloud.js (Firebase) không còn ghi `email` vào `users/{uid}`; hồ sơ cũ được xoá trường email khi đăng nhập (`stripEmail`). |
| **BUG-04** < 18 tuổi được mời "Giảm mỡ" | `bodyAnalysis`: tuổi < 18 → `rec` "lose" thành "maintain"; nutrition.js: không hiện gợi ý đổi mục tiêu khi < 18 (nutrition-pro dùng lại `bodyAnalysis` nên cũng đúng). |
| **BUG-05** chay thiếu calo | nutrition-pro (ghi đè buildDayPlan) đã đạt ±10 %. Bản dự phòng `meals.js` (`buildDayPlanBasic`) cũng sửa: món phụ chia nhiều bữa, ưu tiên món giàu năng lượng khi thiếu > 15 %, không trùng món giữa các bữa. |
| **BUG-06** khẩu phần > 600 g | nutrition-pro.js: `NP_MAIN_CAP = 600` g cho món chính sau khi phóng (trừ hao làm tròn) — **sửa trong module** (xem §3). meals.js dự phòng: hệ số ≤ (600 − 2,5·n)/g₀, món phụ ≤ 400 g/bữa, cơm/đậu hũ chỉ vào bữa chính. Kết quả np-plan-test 56 hồ sơ × 7 ngày: calo ±5 % 97 % (trước 96 %), món lớn nhất 565 g. |
| **BUG-07** video tìm theo TÊN | `findFreeExerciseVideos` nhận chuỗi → tra lại `EXERCISES` để lấy dụng cụ (`fvResolveMeta`); mọi caller truyền `meta` (video.js chi tiết bài / buổi tập / thư viện 800+, library.js, coach.js). |
| **BUG-08** joinByCode chiếm form | cloud.js: đọc form trước, đã có học viên khác → lỗi "Mã này đã có học viên dùng…"; học viên cũ nhập lại → trả form, không đổi; Firebase `permission-denied` → cùng thông báo. Demo `updateClient` giả lập rule. |
| **BUG-09** BMI lệch nhãn | BMI hiển thị **cắt** 1 số lẻ (18,48 → 18,4) và phân loại trên chính giá trị đó; Hồ sơ dùng cùng giá trị. |
| **BUG-10** video sai dụng cụ/biến thể | `WGER_EQUIP` gán dụng cụ cho 46 video wger; bài chỉ trọng lượng cơ thể (xà, thảm…) loại video máy/tạ; thêm "side" vào `FV_MOD`; tư thế đứng/ngồi/nằm lấy từ tên hoặc câu đầu hướng dẫn (+3 đúng / −6 sai) → Nâng bắp chân lấy "Standing Calf Raises". |
| **BUG-11** tự tăng tạ | Đạt đỉnh phải ở **đúng mức tạ chính** mọi hiệp (drop set không tính); bộ đếm trượt chỉ về 0 khi người dùng **thật sự giảm tạ** sau gợi ý giảm tải. |
| **BUG-12** khởi động < 20 kg | Thanh đòn: hiệp 1 "Thanh rỗng 20 kg × 10", bỏ mức < 20 kg, ≥ tạ chính và mức trùng (áp cả "Thanh đòn / Tạ đơn"). |
| **BUG-13** `uid()` trùng | Bộ đếm tuần tự + thời gian base36 + 6 ký tự ngẫu nhiên. |
| **BUG-14** chay rơi món mặn | Lọc chay **trước** lọc ẩm thực, thiếu thì mượn món chay bữa chính, không bao giờ lùi về món mặn (meals.js dự phòng; nutrition-pro vốn đúng). |
| **BUG-15** mất mạng không thử lại | freevideos.js: lỗi tải index không còn ghi `[]` vào cache, `_loading` được reset (`finally`). |
| **BUG-16** deleteAccount chưa đăng nhập | cloud.js (API + demo + Firebase): `auth/requires-recent-login` → "Vui lòng đăng nhập lại rồi thử lại." |
| **BUG-17** perWeek lệch | tpl-f-home 4 → 5, tpl-u-cardio 4 → 5 (= tổng số ngày có bài). |
| **BUG-18** self-XSS 26 chỗ | Bọc `escapeHtml` ở mọi chỗ trong danh sách (kể cả `value=""`), nutrition.js:377; `prog.msg` (chỉ chứa số) render qua `richText`. |
| **BUG-19** searchPixabay TypeError | Tách `if(!v||!v.url) return null;` ra khỏi dòng chú thích. |

Test mới: `tests/suites/08-integration.test.js` (20 test: module nạp đủ & mở được, end-to-end buổi tập, toast/safeUrl/richText, thực đơn dự phòng chay × 3 ẩm thực × 7 hồ sơ, món chính ≤ 600 g ở Thuần chay, khởi động thanh đòn, video Kéo xà, rules, cloud email/Apple revoke, joinByCode lặp, thương hiệu, khoá kỹ thuật không đổi, sw.js/prepare-www.sh đủ file, themes-modules.css đủ 6 module). `00-boot` cập nhật thứ tự script/CSS mới. `lib/xss-scan.js`: bỏ `toast(` khỏi ngữ cảnh HTML (đã tự escape), nhận `attrUrl/safeUrl/richText/NOTE_KINDS` là bộ lọc an toàn.

---

## 3. Xung đột giữa module & cách giải (có sửa file module — ghi rõ)

| Xung đột | Giải |
|---|---|
| BUG-01 làm `toast()` tự escape → **pt-pro.js** gọi `toast(esc(...))` sẽ hiện `&amp;`, `&quot;` | **Sửa pt-pro.js** (5 chỗ): bỏ `esc()` trong toast. Test chặn `toast(esc(` ở mọi file. |
| nutrition-pro ghi đè `buildDayPlan` → bản sửa BUG-06 trong meals.js không có tác dụng | **Sửa nutrition-pro.js** 2 dòng: hằng `NP_MAIN_CAP = 600` + giới hạn `smax` theo 600 g. Bản cũ meals.js vẫn sửa để làm dự phòng. |
| brand.css định nghĩa lớp tiện ích `.brand-logo` (ảnh nền + `font-size:0`) | Khung chứa logo của app đổi tên thành **`.tp-logo`**, ảnh dùng `.brand-wm` — không đè lớp của brand.css. |
| `themes-modules.css` là bản chụp thiếu 2 module | Sinh lại cho 6 CSS module. |
| program-builder.js tự chèn `<link program-builder.css>` khi không thấy CSS → 404 ở bản 1 file | Build script gắn `data-pb-css` cho `<style>` (module đã hỗ trợ). |
| health-safety bọc `finishOnboarding`/`startSession`/render… → phải nạp cuối | Đặt cuối; luồng onboarding → sàng lọc → Trang chủ đã chạy thật trong trình duyệt. |
| `PTP` là `const` toàn cục (không nằm trên `window`) | Chỉ ảnh hưởng kịch bản test → kiểm bằng `typeof` thay vì `window[k]`. |
| training-pro.js thẻ chia sẻ canvas | **Sửa chuỗi thương hiệu** (được phép): logo "Tap" trắng + "Easy" teal, chân thẻ "Tập cùng TapEasy", tên file `tapeasy-YYYY-MM-DD.png`, tiêu đề chia sẻ "TapEasy". |

Chuỗi "FIT KIT" → "TapEasy" cũng được thay trong các module khác (achievements, health-safety, nutrition-pro, program-builder, exdb-vi*, pt-pro, themes, ui-kit, meals-extra — chỉ chữ hiển thị/chú thích, không đổi logic).

---

## 4. Đổi thương hiệu TapEasy
- Chữ hiển thị/tiêu đề/meta/toast/chia sẻ/credit: "FIT KIT" → "TapEasy"; khu PT → **"TapEasy PT"** (tiêu đề màn PT, menu, lời mời "mình là PT … trên TapEasy PT", chia sẻ hồ sơ PT).
- Logo `<img alt="TapEasy">`: topbar (Trang chủ, Nhắc nhở: đổi `logo-wordmark-dark.svg` ở theme Sáng; Tập luyện/Dinh dưỡng/Giấc ngủ nằm trên ảnh: luôn `logo-wordmark-light.svg`), menu ☰, màn chào (`.wl-brand` + `logo-mark.svg` ở mục giới thiệu, © 2026 TapEasy), đăng nhập/đăng ký (`.auth-logo`), onboarding bước 1, splash (`logo-full.png`). Ảnh lỗi → tự thay chữ "Tap**Easy**" (`.brand-text`).
- **Giữ nguyên** khoá kỹ thuật: `fitkit_state_v1`, `fitkit_cloud_demo_v1`, IndexedDB `fitkit-db`, file Drive `fitkit-backup.zip`, tên cache `fitkit-v4`, email demo `@fitkit.local`, provider video `"FIT KIT"` (khoá dữ liệu cũ — hiển thị "TapEasy"), URL repo, appId. Có test kiểm.

---

## 5. Việc còn lại
1. **delete-account.html** (không thuộc quyền sửa của tôi): áp diff C2 trong INTEGRATION-health-safety (tải `firebase-functions-compat.js`, gọi `revokeAppleToken` trước khi xoá) + đổi chữ FIT KIT → TapEasy. Tương tự `landing.html`, `privacy-policy.html` (agent thương hiệu).
2. Deploy Cloud Functions (gói Blaze, Node 22) và **publish firestore.rules mới** lên Firebase Console; kiểm thử rules bằng emulator (đặc biệt `get` hồ sơ PT, ghi chú `validNote`).
3. `docs/INTEGRATION-program-builder.md` còn ghi đường dẫn test cũ → `node tests/suites/07-program-builder.test.js`.
4. Chạy workflow ảnh món ăn cho 95 từ khoá mới trong `scripts/food_sources.json`.
5. program-builder / training-pro chưa đọc `FKHealth.current().hideNow` để không sinh buổi "Rất cao" (health-safety vẫn chặn khi bắt đầu buổi).
6. Kiểm tra trên điện thoại thật (360 px, iOS/Android WebView): thẻ thực đơn nutrition-pro, thẻ chia sẻ canvas, StatusBar theo theme, icon maskable.
7. Trên màn chào, dòng credit video nền nằm sát dưới logo (có từ trước) — cân nhắc dời xuống đáy.

---
---

# Vòng tích hợp 2 (11/11/2026) · PT Connect · Cộng đồng · Sự kiện · Gian hàng · thương hiệu · phân quyền · Trang chủ

Người tích hợp: lead integrator (vòng 2). Lần chạy trước bị ngắt **trước khi ghi file nào** (mọi file lõi còn nguyên trạng vòng 1) → làm lại từ đầu, không mất gì.
Các agent khác chạy song song: Gian hàng đã thiết kế lại `shop.js/.css` + thêm `shop-data.js`, `assets/shop/` trong lúc tích hợp; RBAC (`rbac.js`, `admin*`, `cloud-admin.js`) và Kho kiến thức (`kb*`) đã có file + suite test riêng (`30-rbac`, `40-kb`) nhưng **chưa nạp vào index.html** (chưa có doc tích hợp — vòng sau).

**Kết quả kiểm thử**
- `node tests/run.js` → **251 test · 251 pass · 0 fail** (14 suite). Mới: `09-integration-r2` (15 test), `21-events` (8 test, gồm chạy `outputs/_test/events-kit/test_core.js` 83/83 bằng tiến trình con nếu có file). `20-social` (17), `30-rbac` (27), `40-kb` (17) của agent khác cũng xanh trong runner.
- Trình duyệt thật: Playwright, **ngữ cảnh riêng `tapeasy-integrator-2`** (400×860, vi-VN, file phục vụ qua `route.fulfill`), `_test/integrated.html` = index.html + `tests/browser/t_integrated.js` → **PASS 63/63, 0 lỗi JS**: màn chào → onboarding → sàng lọc → 11 màn → Trang chủ (Khám phá, thứ tự khối, ≤ 6 khối màn đầu, teal) → menu → 10 sheet vòng 1 → ô Khám phá "Cộng đồng" → chi tiết routine → đăng ký demo → Kết nối PT (mã sai báo lỗi tiếng Việt) → ô "Thi đua tháng" → 3 tab Sự kiện → ô "Gian hàng" (Store mới) → giỏ → Back → buổi tập → theme Sáng.
  Ảnh: `_test/shots/integ2-1-home.png`, `-2-home-explore`, `-3-home-personal` (đang thi đua + có buổi PT), `-4-community`, `-5-events`, `-6-shop`, `-7-coach`, `-8-home-light`, `-9-dungthu`.
- `outputs/FitKit-dung-thu.html` tạo lại (3,1 MB): mở thử không lỗi JS, đủ 6 module mới + `teHomeExplore` + `teCan`.

## 1. Tích hợp & đóng gói

**index.html** (đúng thứ tự trong INTEGRATION-social / INTEGRATION-events-shop):
```
CSS:  … pt-pro.css → pt-connect.css → community.css → achievements.css → health-safety.css → events.css → shop.css → brand.css → themes-modules.css
JS:   … pt-pro.js → cloud-social.js → pt-connect.js → community.js → achievements.js
          → cloud-events.js → events.js → shop-data.js → shop.js → health-safety.js (CUỐI)
```
- `shop-data.js` (file mới của agent Gian hàng, danh mục mặc định): nạp ngay trước `shop.js` — shop.js tự nạp nếu thiếu, nhưng bản 1 file/offline cần thẻ tĩnh (đã thấy lỗi `Unexpected token '<'` khi tự nạp trong bản 1 file).
- `<head>`: favicon SVG + PNG 32/16, `apple-touch-icon` 180 (sizes), `og:image` = og-tapeasy.jpg (URL tuyệt đối). Chưa thêm `TAPEASY_SHOP_CONFIG` (thông tin ngân hàng do chủ app điền — xem INTEGRATION-events-shop §1).
- **sw.js**: `fitkit-v4` → **`fitkit-v5`**; + 7 JS, 4 CSS, favicon ×4, icon maskable, shortcut, lockup/horizontal/mark-white. Ảnh sản phẩm (1,5 MB) không cache sẵn — cache khi tải (mạng trước).
- **prepare-www.sh**: + file module mới; `assets/brand/*.svg|*.png` (bỏ `source/`), favicon, `og-tapeasy.jpg`, `assets/shop/*.webp` (bỏ `_build/`); tự kiểm thêm **mọi ảnh** `assets/…` mà index.html / manifest.json / sw.js trỏ tới; thiếu file → `exit 1` (CI dừng). Chạy thử trong /tmp: ✅.
- **capacitor.config.json**: `backgroundColor` (gốc + ios + android) `#0a0a0a` → `#061A24`; `LocalNotifications.iconColor` `#FF3100` → `#02BCB3`. `package.json` (`npm run assets`): splash sáng `#F7FBFA`, splash tối/icon tối `#061A24`, icon `#02A69E`.

**firestore.rules** — gộp diff social + events, **không mở lỏng**:
- Giữ nguyên: `users` chỉ `get` (mình/PT), `list: false`; notes `validNote` (authorUid == me, vai PT chỉ PT ghi); sessions như cũ.
- Học viên: onlyKeys thêm `chat`, `trainingSync` (không có gói/thanh toán/chủ sở hữu) — test khoá đúng danh sách.
- **Siết thêm so với đề xuất**: chat — `role` phải khớp form (PT ↔ ptId, student ↔ studentUid), `kind ∈ text/image/log/system`; lời mời — email ≥ 5 ký tự, chỉ khớp khi token có email (`myEmail() != ''`); kiểm duyệt routine — admin chỉ sửa `approved/hidden/reports` (đề xuất cũ cho custom claim sửa mọi trường); collectionGroup `entries` chỉ đọc bản ghi của mình (đề xuất cũ: mọi người đọc mọi `entries` ở mọi nơi); đăng ký sự kiện — không tự đặt `paid:true` cho sự kiện có phí, không tự ghi `checkinCode/checkedInAt`, cho **đăng ký lại sau khi huỷ** (đề xuất cũ chặn → lỗi luồng `register()`); review — `photos/text` có thể thiếu mà không lỗi rule, text ≤ 1000; đơn hàng `total ≥ 0`, không ai xoá.
- `isAdmin()` = custom claim `admin` **hoặc** `admins/{uid}` — một hàm cho cả kiểm duyệt cộng đồng lẫn sự kiện/shop; agent RBAC thay thân hàm bằng `hasPerm()` (RBAC.md), giữ tên.
- Chỉ 2 chỗ đọc công khai: `routines` (bảng tin) và `products`. Chưa chạy emulator (máy không có firebase-tools) — kiểm bằng test tĩnh + cân ngoặc.

## 2. Thương hiệu
- `pt.js` splash: `logo-full.png` (chữ "Tap" màu than) → **`logo-lockup-light.svg`** trên nền tối; theme Sáng tự đổi `logo-lockup-dark.svg` (`.splash-brand` on-dark/on-light). Không còn `logo-full.png` trên nền tối.
- `themes.js`: `fk-themed` **bật cho mọi theme** (kể cả Mặc định) → ~50 mã mint cứng chuyển theo `--mint` = teal `#33D6C9`; ô mẫu "Navy · Teal · Coral". **Đã đo trong Chromium** (9 màn, bật/tắt lớp trên cùng DOM): **0 thay đổi bố cục** (chỉ khác `opacity` do hiệu ứng vào màn), 259 thay đổi màu = 159 mint→teal + vài sắc độ nhỏ (vòng nền chỉ số α .08→.11, chữ "Nay" ở dải ngày Dinh dưỡng coral→coral nhạt, nền bát nutri). Theme khác không đổi (vốn đã bật lớp này).
- Vì lớp màu giờ chạy cả ở theme Mặc định, bản sinh tự động phải **khớp CSS hiện tại**: chạy lại `gen_themes_layer.py --write` (themes.css 473 → 487 luật, thêm phần thương hiệu + Khám phá; phần cũ trùng khớp từng dòng) và `--modules` cho 8 file (557 → **816** luật, + `pt-connect.css`, `community.css` → 2 module này có theme Sáng). **Chưa gộp `events.css`, `shop.css`** (đang thiết kế lại; ảnh chụp cũ sẽ đè màu mới ở mọi theme). Khi agent Sự kiện/Gian hàng xong: `python3 scripts/gen_themes_layer.py --modules achievements.css,health-safety.css,nutrition-pro.css,program-builder.css,pt-pro.css,training-pro.css,pt-connect.css,community.css,events.css,shop.css`.

## 3. Hợp đồng phân quyền
`app.js`: `function teCan(perm){ try{ if(window.TE_RBAC && TE_RBAC.can) return TE_RBAC.can(perm); }catch(e){} return !!(state && state.isAdmin); }` — chỉ ẩn/hiện giao diện; quyền thật ở rules. Test: không RBAC → `state.isAdmin`; có RBAC → chỉ RBAC; RBAC ném lỗi → về `state.isAdmin`. `shop.js` mới đã gọi `teCan('shop.products'|'shop.orders')`.

## 4. Trang chủ: dọn trùng lối vào + hàng "Khám phá"
Trước: 6 module mỗi cái tự chèn thẻ lớn → Trang chủ 17 khối, "Tạo giáo án riêng", "Cộng đồng", "Sự kiện" nằm giữa các số liệu ngày; lưới "Bạn muốn làm gì?" (Tập cá nhân / PT của tôi trùng thanh dưới + hero) và hàng lối tắt (Giấc ngủ trùng ô chỉ số ngủ).

**Quy tắc** (pt.js `teHomeLayout()` — chạy ở microtask sau mỗi lần vẽ + MutationObserver khi module chèn thẻ muộn; chỉ **di chuyển** phần tử, không vẽ lại → giữ trình nghe sự kiện của module):
1. **Màn đầu ≤ 6 khối**: Chào + chuỗi ngày · **1** cảnh báo · Tuần · Buổi hôm nay · Chỉ số (calo/nước/ngủ) · **Khám phá**. Đo ở 400×860: Khám phá bắt đầu ở y = 738 (lọt màn đầu).
2. **Cảnh báo — chỉ 1 ở trên**, theo ưu tiên: "Nên đi khám" (health-safety, khẩn) > "Quay lại tập" (achievements, chỉ khi đã từng tập — người mới thì hero đã là lời mời) > "Sàng lọc 1 phút". Cảnh báo còn lại xuống dưới thẻ cá nhân. Lý do: an toàn trước, rồi giữ chân; hai banner liền nhau đẩy buổi tập xuống dưới màn.
3. **"Buổi với PT"** (khi có lịch) đứng **trước** Khám phá: việc có giờ hẹn quan trọng hơn khám phá.
4. **Khám phá** = hàng cuộn ngang ô 124×118 px (≥ 44 px chạm, chữ ≥ 12 px, snap): Cộng đồng 90 · Giáo án riêng 85 · Thi đua tháng 80 · (Kiến thức hôm nay 78 — kb.js tự thêm) · Giáo án mẫu 70 · Tiến độ 60 · Gian hàng 50 · Bài tập 40 · Tìm PT 30 ("Sắp ra mắt"). Lý do: tính năng mới/cộng đồng lên trước (người dùng chưa biết), lối đã có ở màn khác (Giáo án mẫu, Bài tập) ra sau, ô chưa có tính năng ở cuối.
5. **Thẻ trùng được gộp** (ẩn bằng `.te-merged`, không xoá để module không chèn lại): `.pb-home-card` (→ ô Giáo án riêng), `#cm-home` (→ ô Cộng đồng), thẻ Sự kiện **khi chỉ là lời mời** (→ ô Thi đua tháng). Thẻ mang **tiến độ cá nhân** giữ nguyên dưới Khám phá: Sự kiện khi đang thi đua/có vé/có quà, Tổng kết tuần, Cấp độ & huy hiệu; cuối cùng Nhắc nhở. Khối lạ của module sau: trên Nhắc nhở, giữ thứ tự gốc.

**API cho module sau** (`window.teHomeExplore`):
```js
teHomeExplore.add({ id:"findpt", title:"Tìm PT", sub:"Gần bạn · đánh giá", icon:"travel_explore", color:"#FFB08A",
                    priority:95, badge: ()=> n || "", when: ()=> true, onClick: ()=> openFindPT() });   // cùng id → thay ô tạm
teHomeExplore.remove(id); teHomeExplore.list(); teHomeExplore.refresh();
```
`priority` số **lớn đứng trước** (mặc định 50); `title/sub/badge/icon/color` nhận giá trị hoặc hàm; chữ được escape, `icon` chỉ nhận `[a-z0-9_]`, `color` chỉ hex/var()/rgb(). Khối tự chèn vào `#home-content` có thể khai báo `data-home-zone="alert|primary|personal|bottom|explore"` (`explore` = ẩn vì đã có ô). Đề xuất: findpt `priority:95` thay ô tạm; admin không lên Trang chủ (menu/Hồ sơ).

## 5. Xung đột & cách giải
| Xung đột | Giải |
|---|---|
| pt-connect, community, events, shop gọi `toast(esc(x))` (12 chỗ) → hiện `&amp;` từ khi toast tự escape (BUG-01) | **Không sửa module**: `toast()` giải mã 5 thực thể HTML rồi escape đúng 1 lần (`toastPlain`) → hiển thị đúng, vẫn không chạy HTML (test cả chuỗi `&lt;img …&gt;`). Test tĩnh cũ đổi thành test hành vi + danh sách tham khảo. |
| pt-connect thay sheet "Nhập mã PT" (xem trước PT → Chấp nhận) → test BUG-01 cũ không thấy toast | Test 06 đi theo luồng mới (`#jn-go` → `#pv-yes`) và kiểm thêm HTML xem trước. |
| Quét XSS tĩnh báo nhầm `escAttr()`, `avatarHTML()`, `brandMark("…")`, `ic(GOAL_IC[…])` | Đã đọc từng hàm (đều qua `esc` hoặc hằng) → thêm vào bộ lọc an toàn của `tests/lib/xss-scan.js`. |
| events.js in poster check-in bằng `w.document.write(…${p.innerHTML})` | Ngoại lệ hẹp duy nhất trong test (cửa sổ in about:blank, chỉ tuần tự hoá DOM đã escape). Khuyên agent Sự kiện chuyển sang `@media print`. |
| shop.js mới là Store toàn màn (`#tsx`), tab "Gian hàng" trong Sự kiện chỉ còn teaser | Ô Khám phá gọi `TapShop.open()` nếu có, không thì `TapEv.open("shop")`. Test trình duyệt nhận cả 2 kiểu. |
| Test cũ khoá `logo-full.png` ở splash và onlyKeys 3 trường | Cập nhật theo vòng 2 (khoá lockup-light; khoá đúng 5 trường học viên). |

## 6. Việc còn lại
1. **Vòng 3 — nạp `rbac.js`, `cloud-admin.js`, `admin.js/.css`, `kb-data-*.js`, `kb.js/.css`, findpt…** khi các agent có `INTEGRATION-*.md` (suite 30-rbac/40-kb đã chạy trong runner). RBAC: thay `isAdmin()` trong rules bằng `hasPerm()`.
2. Agent Sự kiện/Gian hàng: chạy lại `gen_themes_layer.py --modules` (10 file, lệnh ở §2); bỏ `esc()` trong `toast(...)`; poster in bằng CSS in; cập nhật `docs/INTEGRATION-events-shop.md` cho Store mới + `shop-data.js` + `assets/shop/`.
3. Publish `firestore.rules` + thử bằng emulator (chat role, lời mời, đếm like, đăng ký lại, check-in mã); bật chỉ mục collection-group `entries.uid`, `regs.uid`. Cân nhắc yêu cầu `email_verified` khi chấp nhận lời mời theo email (tài khoản email/mật khẩu chưa xác minh có thể đọc lời mời gửi tới email đó — hiện mã 6 ký tự vẫn là đường chính).
4. Bản 1 file: ảnh sản phẩm `assets/shop/*.webp` ghép tên động nên không nhúng được → Store trong `FitKit-dung-thu.html` dùng hình dự phòng; bản web/app đầy đủ ảnh.
5. Native: quyền camera (Android `CAMERA`, iOS `NSCameraUsageDescription`) cho quét QR; deep link `?join=`; FCM cho tin nhắn/lời mời.
6. Kiểm tra trên máy thật 360 px: hàng Khám phá (cuộn, snap), Store toàn màn, theme Sáng của Cộng đồng/PT Connect.

---
---

# Vòng tích hợp 3 (11/11/2026) · Quản trị & phân quyền · Tìm PT · Kho kiến thức · ảnh/clip sự kiện · Trang chủ & menu

Người tích hợp: lead integrator (vòng 3). Không đụng `themes.js`, `themes.css`, `themes-modules.css`, `scripts/gen_themes_layer.py`, `theme-packs.*`, `ui-signature.*` (agent Theme làm song song — 2 file mới `theme-packs.*`, `ui-signature.*` xuất hiện trong lúc tích hợp, **chưa gắn vào index.html**, chờ doc của agent Theme). Không chạy lại `gen_themes_layer`.

**Kết quả kiểm thử**
- `node tests/run.js` → **289 test · 289 pass · 0 fail** (16 suite, 134 s; vòng 2: 251). Mới: `10-integration-r3` (16 test, gồm chạy `_test/shop-kit/test_core.js` 50/50 và `_test/events-media-kit/test_media.js` 71/71 bằng tiến trình con nếu có). `30-rbac` 27/27, `40-findpt` 9/9, `40-kb` 17/17 chạy trên index.html thật.
- Trình duyệt: Playwright, **ngữ cảnh riêng `tapeasy-integrator-3`** (400×860, vi-VN, file phục vụ qua `route.fulfill`, xoá localStorage/IndexedDB trước lượt chạy), `_test/integrated.html` = index.html + `tests/browser/t_integrated.js` (`--embed-shop`) → **PASS 110/110, ERR 0**. Luồng mới: menu ☰ theo nhóm (chưa có quyền → không có nhóm Quản trị) → **bảng quản trị: sai mã khởi tạo bị từ chối, `TAPEASY-OWNER-2026` → Chủ sở hữu**, ≥ 10 mục (gồm "Tìm PT · đánh giá" do findpt tự đăng ký), Người dùng / Đội ngũ / Nhật ký (chuỗi băm khớp) → menu có nhóm Quản trị → **Tìm PT**: ô Khám phá → album 20 PT, tìm "cau giay", lọc PT nữ, bộ lọc Hà Nội + giá ≤ 600k (đếm "Xem N PT" khớp logic) → hồ sơ Khang → đặt buổi thử → giả lập đã tập → **viết đánh giá** (+1, nội dung escape) → **Kho kiến thức**: ô → "Kiến thức hôm nay" đầu trang, tìm "dau goi" (tô sáng) → đọc bài, Owner thấy nút Sửa → **Sự kiện đăng có ảnh**: form chặn khi thiếu ảnh + mô tả < 80 ký tự → thêm ảnh (nén) → lưu `idb:` + audit `event.save` → thẻ hiện ảnh bìa → **Gian hàng**: áo thun teal/L → giỏ (ảnh WebP thật) → mã giảm giá `VONG3GIAM` do quản trị tạo (−20.000 ₫) → checkout 3 bước COD → hoàn tất, đơn có giảm giá → thoát về app.
  Ảnh: `_test/shots/integ3-home.png`, `-explore`, `-menu`, `-menu2`, `-menu3` (nhóm Quản trị), `-admin`, `-findpt`, `-kb`, `-events`, `-cart`, `-shop-done`, `-dungthu`.
- `outputs/FitKit-dung-thu.html` tạo lại (5,8 MB, **nhúng 79 ảnh sản phẩm**): mở trong `tapeasy-integrator-3` không lỗi JS, đủ 7 module mới, Khám phá 7 ô.

## 1. Tích hợp & đóng gói

**index.html** (theo INTEGRATION-admin §1, INTEGRATION-findpt §1, INTEGRATION-kb §2, INTEGRATION-events-shop §1/§10):
```
CSS: … health-safety.css → events.css → shop.css → findpt.css → kb.css → admin.css → brand.css → themes-modules.css
JS:  icons, firebase-config, media-config, cloud.js → rbac.js → data.js … pt.js → ui-kit … pt-pro
     → cloud-social → pt-connect → community → cloud-pt-directory → findpt → achievements
     → cloud-events → events-media → events → shop-data → shop → kb-data-1…6 → kb → cloud-admin → admin → health-safety (CUỐI)
```
- Font: Google Fonts thêm `Inter Tight 300;400` (Store) + `JetBrains Mono 500`.
- **sw.js** `fitkit-v5` → **`fitkit-v6`** (+ 13 JS, 3 CSS). Ảnh `assets/shop/*.webp`, Pexels, Firebase Storage không cache sẵn.
- **prepare-www.sh**: + mọi file mới; vẫn chép `assets/shop/*.webp` (không `_build/`) và **kiểm từng ảnh sản phẩm** có trong `www/`. Chạy thử trong /tmp: ✅ 79 ảnh.
- **firebase.json**: `firestore.indexes`, `storage.rules`, emulator storage 9199. **firestore.indexes.json** (mới): `users(isPT, createdAt desc)` + collection-group `entries.uid`, `regs.uid`, `requests.uid`, `reviews.flagged`.
- **functions/index.js**: `Object.assign(exports, require("./admin"))` + `require("./findpt")` **sau** `initializeApp()`; `USER_DOC_COLLECTIONS = ["users","roles","pt_verifications","userSocial","ptListings"]`; thông báo lỗi Apple đổi "FIT KIT" → "TapEasy". **functions/findpt.js** (mới): trigger `ptReviewAgg`, `ptRespAgg` (công thức = `cloud.ptdir.logic`, có test).
- `scripts/build-single-html.py`: cờ `--embed-shop` → `window.__TE_INLINE_ASSETS` (shop.js tra qua `assetSrc()`); hết giới hạn "Store bản 1 file không có ảnh" của vòng 2.

**firestore.rules** = bản RBAC của INTEGRATION-admin §4 (thay `isAdmin()` bằng `hasPerm()` + collection quản trị, `admin_audit` chỉ-thêm, `users` vẫn `list: false`) **+** Tìm PT (§3: `ptListings` + reviews/requests/reports, `clients/{cid}/feedback` riêng tư, collection-group `requests`) **+** events §10.6 (sự kiện/thử thách `create, update` cần `okContent()` = ≥ 1 ảnh/clip ≤ 12, tên ≥ 4, mô tả ≥ 80; review/recap "Khoảnh khắc" + `mlikes/mcomments/mreports`). Gộp xung đột: 2 đề xuất collection-group `reviews` (`true` của findpt, `signedIn()` của events) → giữ bản **chặt** `signedIn()`; đánh giá PT vẫn công khai qua đường dẫn trực tiếp. Đọc công khai chỉ còn 3 chỗ (routines, products, ptListings/*/reviews) — test khoá. Cân ngoặc + mọi hàm gọi đều có định nghĩa (test).
**storage.rules** (mới, §10.4) — sửa so với đề xuất: bỏ `legacyAdmin()` (admins/{uid} không còn cấp quyền), thêm `fresh()` so claims với `roles/{uid}` (giống `staffFresh()`), tôn trọng `px "-events.manage"`.

## 2. Diff ở module (bây giờ được sửa)
| File | Thay đổi |
|---|---|
| events.js | Đã có `teCan` theo §6.1 (agent Sự kiện làm sẵn). Sửa lỗi suite 06: biểu thức chèn thô ở tab Khoảnh khắc tách thành `momentsBodyHTML()`; chú thích đầu file theo RBAC. |
| shop.js / shop.css | §6.2: đọc `tapeasy_settings_cache_v1` cho lần vẽ đầu; **ô nhập mã giảm giá** trong giỏ → `cloudAdmin.lookupVoucher` → ví voucher (1 lần/mã, đổi `freeship/percent/amount` → `ship/pct/amount`, hạn theo mã) — `TapShop.applyVoucherCode(code)`; `assetSrc()` cho ảnh nhúng. |
| community.js / .css | §6.3: nút **Ẩn (kiểm duyệt) / Khôi phục** (`community.moderate`) và **Ghim** (`community.feature`) trong chi tiết routine; routine ghim lên đầu bảng tin + nhãn "Ghim"; báo cáo gửi thêm vào hàng đợi `cloudAdmin.report`. |
| findpt.js | §6.4 đã có sẵn (teCan + `adminStatus`); chỉ đổi priority ô Khám phá. |
| kb.js | Ô Khám phá đổi tên **"Kho kiến thức"** (phụ đề "Hôm nay: …", mở trang đầu kho); trang đầu kho có khối **"Kiến thức hôm nay"**. |
| cloud-events.js | §6.7: `isAdmin()` theo `TE_RBAC.legacyAdmin()` khi có RBAC. |
| pt.js | §6.6: **Owner không tự xoá tài khoản** (báo ngay khi mở sheet + chặn trước `cloud.deleteAccount`). |

## 3. Trang chủ & menu
- **Khám phá gọn 7 ô** (pt.js): Kết nối — **Tìm PT 98 · Cộng đồng 95 · Sự kiện 92 · Kho kiến thức 86 · Gian hàng 84**; Giáo án — Giáo án riêng 70 · Giáo án mẫu 60. Bỏ ô Tiến độ, Bài tập (đã có ở menu → Tập luyện và màn Tập luyện). Admin không lên Trang chủ.
- **Menu ☰ nhóm theo khu vực** (app.js `teMenuOrganize`, style.css `.te-mgroup`): (chung) Trang chủ · Hồ sơ · Nhắc nhở → **Tập luyện** → **Dinh dưỡng** (+ dòng mới "Thực đơn & nhật ký ăn", "Đi chợ tuần", Giấc ngủ) → **Kết nối PT** → **Cộng đồng & Sự kiện** → **Kiến thức** → **Cửa hàng** → **Quản trị** (chỉ khi tài khoản có vai trò — admin.js chèn dòng). Module chèn dòng theo 3 cách khác nhau (chuỗi HTML / DOM khi mở / setTimeout 0) → gom sau khi mở + MutationObserver, chỉ di chuyển phần tử (giữ trình nghe), chạy lại không đổi kết quả. Giữ nguyên mốc `goto('reminders');closeSheet();` / `goto('sleep')` mà kb/events/admin dựa vào.

## 4. Kiểm thử đã sửa (theo INTEGRATION-admin §8)
`09-integration-r2`: hợp đồng `teCan` mới (state.isAdmin không cấp quyền), rules `hasPerm(...)`, cache ≥ v5, Khám phá 7 ô. `00-boot`: + module/CSS vòng 3, `rbac.js` ngay sau `cloud.js`. `30-rbac`: thử thách mẫu có ảnh + mô tả ≥ 80 (luật §10). `40-kb`, `40-findpt`: giả lập quyền qua `TE_RBAC.can` (rbac.js không cho gán đè `teCan`); 40-kb theo tên ô mới.

## 5. Việc còn lại
1. Agent Theme: gắn `theme-packs.*`, `ui-signature.*` khi có doc; chạy `gen_themes_layer.py --modules` thêm `events.css, shop.css, findpt.css, kb.css` (+ quy tắc mới `.cm-pin` trong community.css, `.te-mgroup` trong style.css dùng biến màu nên đã theo theme).
2. Firebase: `firebase functions:secrets:set OWNER_BOOTSTRAP_CODE`, deploy functions + `firestore:rules,indexes` + `storage`; thử bằng emulator (`hasPerm/staffFresh`, `okContent`, ptListings reviews `trained()`, storage `fresh()`); xoá secret sau khi có Owner.
3. Voucher toàn hệ thống: lượt dùng (`used`) chưa tăng ở máy chủ — cần Function khi tạo đơn (tính lại giá + trừ kho theo `màu|size`).
4. storage.rules chưa xét quyền lẻ `+events.manage` (chỉ vai trò); xoá tài khoản PT xoá luôn niêm yết + đánh giá (đúng quyền riêng tư, cân nhắc lưu ẩn danh).
5. Kiểm tra máy thật 360 px: menu nhóm, Store ảnh nhúng (bản 1 file 5,8 MB), bảng quản trị trên điện thoại.

---

# Vòng sửa lỗi QA (11–12/11/2026)

Gồm 7 fixer, chạy song song và mỗi người chỉ sửa file thuộc quyền của mình. Quy tắc ở `docs/qa/FIX-ROUND-BRIEF.md`. Vòng 2 xử lý các mục "Chuyển giao" theo `docs/qa/HANDOFF-ROUND-BRIEF.md`. Cuối cùng integrator đóng các mục chuyển giao còn mở (`docs/qa/FIX-integrator.md`).

## 1. Kết quả
- Test Node: **25 suite · 573/573 xanh**. Suite riêng của từng fixer: 60 core 44 · 61 training 35 · 62 nutrition 39 · 63 pt 33 · 64 commerce 30 · 65 security 29 · 66 ux 34 · 67 integrator 20.
- QA chạy lại:
  - PT lifecycle 45/46. Ca còn đỏ là B01, cần quyết định nghiệp vụ.
  - commerce 84/84.
  - nutrition: kcal ±5 % đạt 96 %, đạm 100 %, món tái cho thai phụ 0, dữ liệu ✗ từ 22 xuống 12.
  - Rules: 85/85 kịch bản mới; 109 kịch bản QA khớp 85, còn 3 lỗ hổng đã giải thích (A3/D4/H2).
- Bản dùng thử `outputs/FitKit-dung-thu.html` dựng bằng `build-single-html.py --embed-shop`, 6,4 MB. Chạy trên Playwright ở 390 px qua 10 màn: 0 lỗi JS. Ảnh ở `_test/integrator/`.

## 2. Thay đổi lớn theo mảng
- **Lõi** (`app.js`, `pt.js`):
  - Menu ☰ còn 12 mục chia 4 nhóm, có ô tìm.
  - Màn Tiến độ có tab Kỷ lục, nút tab tĩnh trong `index.html`.
  - Buổi tập < 3 phút không được tính.
  - `appBoot` nhường luồng; màn chào không gọi API video.
  - Có `fkHideKcal()`: khi "Ẩn số calo", Trang chủ, Hồ sơ và sheet mục tiêu không hiện kcal.
  - `confirmDialog` hỗ trợ callback async.
- **Dữ liệu nạp lười** `fk-lazy.js`: 9 file dữ liệu (exdb-vi, kb-data, khoảng 450 KB) nạp khi cần. Bản 1 file vẫn nhúng sẵn.
- **Tập luyện**:
  - Thuật ngữ §8: tuần giảm tải, siêu hiệp.
  - Thẻ Khối lượng chỉ hiện ở tab Kỷ lục.
  - Video: mất mạng thì nhớ lỗi 60 s (lùi dần) và nghe sự kiện `online`, không còn ~55 request.
  - Popup thành tích hoãn ≥ 6 s, không đè lớp phủ, không bật cho huy hiệu cũ.
- **Dinh dưỡng**:
  - `#hs-overlay` là hộp thoại thật.
  - `FKHealth` phát `fk:health-ready`.
  - Ghi nhớ thực đơn ở `fitkit_np_plans_v1`; "Đặt lại dữ liệu" xoá luôn bộ nhớ này.
  - Tuỳ chọn "Ẩn số calo" (mặc định bật khi khai RLĂU) và nút (i) "Vì sao đạm X g?".
- **PT**:
  - Mã mời 6–10 ký tự; mã mới dài 8.
  - Nút "Chặn người này" cùng danh sách "Người đã chặn".
  - Báo cáo routine tính theo trọng số tuổi tài khoản.
  - Học viên đánh dấu "Đã tập" thì ghi `statusLog`.
  - Buổi PT < 3 phút không gửi kết quả cho PT.
- **Thương mại**:
  - Chặn người dùng ở Khoảnh khắc, bình luận và giáo án chia sẻ.
  - Firebase: không còn đường ghi thẳng; báo cáo Khoảnh khắc chỉ ghi `{uid, reason, ts}`.
  - Voucher hoàn thành thử thách do máy chủ cấp (`claimChallengeVoucher`); ví gộp `myVouchers` khi mở Cửa hàng.
  - Hoàn tác khi bộ nhớ đầy (QC-11). Lưới 2 cột ≥ 1024 px.
- **Bảo mật**:
  - Rules vòng 2: mreports, statusLog, đánh giá PT, voucherHolds.
  - Functions: `momentReportHeal`, `claimChallengeVoucher`, `myVouchers`, giữ chỗ voucher 30 phút, `cleanupUserData` đủ mục.
  - Mã mời dài 8 ký tự. Gỡ khoá Pixabay lộ trong `media-config.js`.
  - Bản phát hành dùng `STORE_BUILD=1` (dừng build nếu `firebase-config.js` trống).
- **UX**:
  - Tương phản `--on-coral` 6,9:1; chữ ≥ 12 px; nút ≥ 44 px.
  - Thanh trên có nền khi cuộn; bỏ `backdrop-filter` ở thẻ PT.
  - Khung rộng ≥ 1024 px; sinh lại lớp màu module.

## 3. Việc của chủ app
Chi tiết ở FIX-integrator §3 và FIX-security §0:
- Deploy lại Functions, rồi indexes, rồi rules/storage, đúng thứ tự này.
- Thu hồi khoá Pixabay cũ.
- Điền secrets: Apple/Google native, Owner bootstrap, khoá ký.
- Điền `firebase-config.js`.
- Chạy Firebase Emulator.
- Quyết định chuyên môn về đạm cho người có tiền sử RLĂU, và nghiệp vụ B01 (huỷ "Chặt" và buổi vắng).

## 4. Còn lại
- QU-01: nạp lười module theo màn.
- QU-11: gỡ DOM của màn đã rời.
- QS-22: bỏ `'unsafe-inline'`.
- Kiểm bản build native thật (iOS/Android) với plugin `@capacitor-firebase/authentication`.

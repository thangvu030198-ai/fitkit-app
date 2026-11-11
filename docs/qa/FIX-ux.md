# FIX — Trải nghiệm · Hiệu năng · Khả năng truy cập (fixer ux, 11/11/2026)

Nguồn lỗi: `docs/qa/QA-ux-performance.md` (QU-01 … QU-36) + QS-22 (CSP, phần index.html).
File đã sửa (đúng quyền sở hữu): `index.html`, `style.css`, `themes.css`, `themes.js`, `brand.css`, `ui-kit.js`, `ui-kit.css`, `sw.js`, `themes-modules.css` (sinh lại), `scripts/prepare-www.sh`, `docs/GLOSSARY-vi.md` §8, `tests/suites/66-fix-ux.test.js`.
Không đổi: `icons.js`, `theme-packs.*`, `ui-signature.*`, `manifest.json`, `landing.html`, `scripts/build-single-html.py` (không cần sửa: bản ghép vẫn nạp đúng và không có lỗi JS).

Kiểm tra: `node tests/run.js` 492/492 xanh (66-fix-ux 22/22) · bản ghép `_test/fix-ux/single/index.html` 0 lỗi JS · bản `www/` (CSS gộp) 0 lỗi JS, ảnh chụp Hồ sơ giống hệt bản nguồn.

## 1. Bảng mã lỗi

| Mã | Mức | Trạng thái | Sửa ở (file:dòng) | Test (66-fix-ux) |
|---|---|---|---|---|
| QU-01 | Cao | **Một phần** | index.html:24–27 (font không chặn vẽ), :52 (JSZip lười) · scripts/prepare-www.sh:63–163 (gộp 20 CSS → 1 `app.<băm>.css`, bộ nén CSS, nén JS tuỳ chọn `MINIFY_JS=1` bằng esbuild, tự bỏ qua khi offline). **Nạp lười module theo màn chưa làm** — cần stub ở app.js/pt.js (§3). JS **không gộp**: ghép script cổ điển làm `typeof X` của `const` ở file sau ném TDZ (đã thử: `renderHomeScreen → teHomeExplore` hỏng). | QU-01 ×2 |
| QU-02 | Cao | Chuyển giao (core) | `appBoot` nhường luồng + việc phụ vào `requestIdleCallback` thuộc pt.js/module; phần ux (font, JSZip, hoạt ảnh) làm TBT −20 % (§2) | — |
| QU-03 | Cao | Chuyển giao (core đã làm phần lõi; nutrition: memo `buildDayPlan`) | — | — |
| QU-04 | Cao | Đã sửa (phần ux) | style.css:1535–1544 (hoạt ảnh vô hạn → 2–6 lượt, vệt tốc độ chạy transform) · ui-kit.js:383–440 (giảm chuyển động/tiết kiệm dữ liệu/máy yếu → bỏ video, dừng SMIL sau 14 s, dừng hẳn khi rời màn chào) · themes.js:260 (bật `lowfx`/`fk-lowmedia` trong `<head>`). Poster tĩnh + bỏ gọi Pixabay lúc chạy thuộc pt.js → core | QU-04/QU-34 |
| QU-05 | TB | Đã sửa (phần ux) | ui-kit.css:120–133 (máy yếu bỏ blur thẻ module; đang cuộn tạm bỏ blur; `content-visibility:auto` cho thẻ danh sách) · ui-kit.js:189–205 (RAM ≤ 4 GB / ≤ 4 lõi / Save-Data → lowfx), :504 (`fk-scrolling`). Parallax `findpt.js:1481` → pt | QU-05 |
| QU-06 | TB | Chuyển giao (owner module) | — | — |
| QU-07 | TB | Chuyển giao (core đã sửa app.js) | — | — |
| QU-08 | TB | Đã sửa | index.html:24–27 (4 họ font: Inter, Inter Tight, JetBrains Mono, Barlow Condensed 800; `media=print→all`, `display=swap`), :52 · ui-kit.js:444–476 (`loadJSZip()` CDN có SRI + `vendor/` dự phòng, bọc `buildBackupZip`/`restoreFromBackupZip`) · brand.css (bỏ Be Vietnam Pro) | QU-08 ×2 |
| QU-09 | TB | Đã sửa | sw.js:1–100 (HTML mạng trước + hạn 3 s; JS/CSS/ảnh SWR; font cache-first; lưu từng file) · prepare-www.sh:149–160 (sinh `ASSETS` từ `www/index.html` + băm phiên bản `fitkit-v7-<băm>` — hết sửa tay) | QU-09, QU-01 |
| QU-10 | Thấp | Đã sửa (ảnh chèn động) | ui-kit.js:371–381 (`loading=lazy decoding=async`, trừ hero/`fetchpriority=high`). Pexels `w=480` + thumbnail khi hiện → data.js/video.js/library.js | QU-10 |
| QU-11 | Thấp | Chuyển giao | localStorage → IndexedDB (cloud-*.js); gỡ DOM màn module sau 60 s (app.js `goto`) | — |
| QU-12 | Thấp | **Một phần** | style.css:1548–1551 (thẻ Hồ sơ ngoài khung nhìn `content-visibility:auto` → đổi theme chỉ tính phần đang thấy). Đo: 920 → 550 ms (4×, trung vị 4 lần). Mục tiêu < 150 ms cần "chỉ dùng biến" (DESIGN-SYSTEM §5 bước 4, ~7 000 luật, đụng mọi CSS module) — chưa làm. Nạp lười `theme-packs.css` không làm: chỉ 131 luật (≈ 2 %), đổi lấy rủi ro nháy giao diện ở người dùng gói | QU-12 |
| QU-13/14/15/16/17/19/20/22 | — | Chuyển giao (core / pt / commerce đã nhận) | — | — |
| QU-18 | TB | **Chuyển giao (core)** | Menu ☰ sinh trong `app.js:598 teMenuOrganize()` — không có trong index.html | — |
| QU-21 | Thấp | Một phần | index.html:245–255 màn đã tên "Tiến độ", tab "Ảnh tiến độ" / "Chỉ số InBody"; ui-kit.js SCREEN_NAMES `progress:"Tiến độ"`. Tab "Kỷ lục" + đổi mục menu "Ảnh tiến trình & InBody" → core (app.js) | QU-24/25 |
| QU-23 | Thấp | Chuyển giao (pt) | findpt.js/.css (pt đã gắn mã) | — |
| QU-24 | TB | Đã sửa (bảng thuật ngữ + phần ux) | docs/GLOSSARY-vi.md:158–212 §8 (một khái niệm = một tên, Anh → Việt, quy tắc chữ, danh sách thay chữ theo chủ file §8.4); index.html, ui-kit.js dùng đúng tên | QU-24/25 |
| QU-25 | Thấp | Một phần | §8.2–8.3 chốt cách viết RPE/RIR/deload/ULPPL/macro/IN HOA; thay chữ trong module → §8.4 (training, pt, commerce, core) | QU-24/25 |
| QU-26 | Thấp | Đã sửa (phần chung) | ui-kit.js:479–502 + ui-kit.css:101–110 (dải "Đang ngoại tuyến" `role=status`). Chuyển findpt/shop/kb/admin sang `fkLoad/fkEmpty/fkError` → owner | QU-26 |
| QU-27 | Cao | Đã sửa | index.html: 24/24 `.icon-btn` có `aria-label` · ui-kit.js:237–318 (tự gắn tên cho nút icon do module sinh, bảng ICON_LABELS ~110 icon) | QU-27 |
| QU-28 | Cao | **Đã sửa** | themes.css:20 `--on-coral:#061A24` (6,9:1) · style.css:1129–1133, 1206, 1209, 1330 dùng `var(--on-coral)`. Đo trong trình duyệt: CTA "Bắt đầu tập" 2,59 → 6,88:1; 10 theme còn lại 5,7–21:1 (Espresso/Alpine gradient: chữ tối ≥ 7:1) | QU-28 ×3 |
| QU-29 | Cao | Chuyển giao (core đã sửa `openSheet`) | — | — |
| QU-30 | Cao | Đã sửa (lớp chung) | ui-kit.js:320–352 (`.choice-card` → `role=radio`+`aria-checked`, `.toggle` → `switch`, `.role-card/.metric/.streak-chip` → `button`; `tabindex=0`; Enter/Space) — core sửa thêm tại nguồn app.js | QU-30 |
| QU-31 | TB | Đã sửa (style.css) | style.css:1532–1533 (dải tuần, chip chuỗi 12 px). Chữ < 12 px trong app.js (7) / CSS module → owner | QU-31/32 |
| QU-32 | TB | Đã sửa | style.css:1521–1530 (icon thanh trên, nút chỉnh, tab ngày, "Thêm" món, thanh dưới ≥ 44 px — giữ hình nhìn thấy bằng padding + `background-clip`) | QU-31/32 |
| QU-33 | TB | Đã sửa | ui-kit.js:241–300 (nhãn chung "Thêm/Sửa/CSV…" + ngữ cảnh thẻ: "Thêm – Bữa trưa"; ảnh thiếu alt) | QU-33 |
| QU-34 | TB | Đã sửa | ui-kit.js:383–440 + ui-kit.css:112–118 (nút Tạm dừng/Phát 44 px; reduced-motion/Save-Data → chỉ ảnh tĩnh) | QU-04/QU-34 |
| QU-35 | Thấp | Đã sửa | index.html:57–58 (link "Bỏ qua tới nội dung", h1 ẩn), :137 `<main id="app-scroll">` · ui-kit.js:354–369 (tiêu đề trang + `aria-current` theo màn) · ui-kit.css:91–99 (`:focus-visible` chung). `nested-interactive` trong thẻ bữa ăn/thành tích → owner | QU-35 |
| QU-36 | Thấp | **Một phần** | ui-kit.css:135–145 (≥ 1024 px: dashboard PT / học viên khung 1 120 px, nội dung ≤ 820 px; Cửa hàng lưới 4 cột) · ui-kit.js `data-screen`. Tìm PT/Sự kiện/Cộng đồng/Kho kiến thức cần lưới 2 cột trong CSS module (thẻ ảnh 1 cột kéo rộng quá to — đã thử, bỏ) | QU-36 |
| QS-22 | TB | Một phần (index.html) | index.html:5–6 CSP (`object-src 'none'`, `base-uri 'self'`, không `unsafe-eval`); còn `'unsafe-inline'` vì onclick nội tuyến hằng số trong module — bỏ được khi core/module chuyển sang `addEventListener` | QS-22 |

## 2. Đo trước / sau (Playwright, ngữ cảnh riêng `fix-ux`, CPU 4×, phục vụ http qua `route.fulfill`, 390×844)

- **"QA"** = số trong `QA-ux-performance.md` (máy khác thời điểm, ±20–30 %).
- **"Trước"** = bản chụp FitKit lúc bắt đầu vòng sửa (`_test/fix-ux/before`). **"Sau"** = "Trước" + **chỉ file của ux** (`_test/fix-ux/after`) → tách ảnh hưởng của ux khỏi các fixer khác. **"Sau + www"** = "Sau" chạy qua `prepare-www.sh` (CSS gộp + nén).
- Trước/sau chạy **xen kẽ** trong cùng một job (máy chủ dùng chung với 6 fixer khác nên tải CPU dao động mạnh; ở lần đo này mọi số đều cao hơn QA). Đọc theo chiều thay đổi, không theo giá trị tuyệt đối. Số thô: `_test/fix-ux/results.json`.

**Mở app — người dùng quay lại (Trang chủ), trung vị 3 lần, ms**

| Chỉ số | QA | Trước | Sau | Sau + www |
|---|---|---|---|---|
| FCP | 1 140 | 1 332 | 908 | **540** |
| Trang chủ hiện | 3 102 | 3 820 | 3 733 | 3 165 |
| LCP | 6 076 | 6 524 | 6 196 | 5 628 |
| DCL | 6 889 | 7 420 | 7 757 | 7 521 |
| TTI | 7 424 | 7 938 | 8 202 | 7 872 |
| TBT | 3 204 | 3 782 | **2 987** | 3 276 |
| Long task dài nhất | 1 401 | 1 889 | 1 293 | 1 199 |
| Request cục bộ / ngoài | 79 / 15–23 | 79 / 15 | 79 / 13 | **60** / 13 |

**Mở app lần đầu (màn chào), 2 lần**

| Chỉ số | QA | Trước | Sau |
|---|---|---|---|
| FCP | 1 756 | 1 152–1 184 | 856–1 112 |
| TTI | 23 609 | 18 216–18 875 | **10 817–14 546** |
| TBT | 8 184 | 5 487–6 448 | **4 498–4 816** |
| CLS | 0,142 | 0,142–0,150 | **0,095–0,097** |
| Long task (số lượng) | — | 37–46 | 22–26 |

**Mở từng màn — INP khi chạm thật (ms, 1 lượt mỗi bản, chạy liền nhau)**

| Thao tác | QA | Trước | Sau |
|---|---|---|---|
| Nav → Tập luyện | 608 | 1 024 | 744 |
| Nav → Dinh dưỡng lần đầu | 4 280 | 6 504 | 5 000 |
| Nav → Dinh dưỡng lần 2 | 744 | 2 432 | 2 448 |
| Nav → PT | 136 | 504 | 456 |
| Nav → Hồ sơ | 672 | 1 048 | 784 |
| Nav → Trang chủ | 384–432 | 1 112–1 384 | 776–1 224 |
| Khám phá → Tìm PT | 1 400 | 2 800 | 1 120 |
| Khám phá → Cộng đồng | 1 256 | 2 352 | 1 088 |
| Khám phá → Sự kiện | 1 176 | 1 640 | 984 |
| Khám phá → Kho kiến thức | 872 | 1 240 | 896 |
| Khám phá → Gian hàng | 776 | 1 040 | 808 |
| Đổi theme (Hồ sơ, trung vị 4 lần) | 723 | ~920 | **~550** |

Nhận xét:
- Phần của ux cải thiện rõ **vẽ lần đầu** (FCP −30 % nhờ font không chặn vẽ, bỏ JSZip đồng bộ; −60 % khi gộp CSS), **màn chào lần đầu** (TTI −30–40 %, CLS < 0,1, ít long task vì hoạt ảnh/video có giới hạn) và **mở module** (−30–60 %, chủ yếu do bỏ blur trên máy yếu + `content-visibility`).
- **TTI người quay lại gần như không đổi** — nút thắt là ~50 file JS module chạy lúc mở (QU-01/QU-02) ⇒ cần nạp lười theo màn (§3). Dinh dưỡng lần đầu vẫn chậm trong bản "Sau" vì bản sửa lõi của core/nutrition không nằm trong ảnh chụp này.
- Lần đo đầu phiên (máy rảnh hơn, 15:30) cho cùng xu hướng: Trước TTI 2,4–3,4 s / TBT 0,6–1,2 s.

**Tương phản CTA (`#screen-home .btn-primary`, đo bằng getComputedStyle):** Mặc định 2,59 → **6,88**; Đại dương 9,85 · Hoàng hôn 6,42 · Rừng 6,93 · Tím đêm 12,19 · Sáng 5,66 · Aurora 21 · Wellness 11,94 · Sanctuary 13,9 · Espresso/Alpine nền gradient, chữ tối ≥ 7:1.

**Bản www (prepare-www.sh):** 20 CSS 792 KB → `app.<băm>.css` 688 KB (bộ nén có sẵn; esbuild không tải được trong sandbox), 79 → 60 request cục bộ, 0 lỗi JS ở Trang chủ, 4 tab, 3 module, màn chào; ảnh chụp Hồ sơ (tối + Sáng) khác 0 điểm ảnh so với bản nguồn.

## 3. Chuyển giao

| Cho | File:dòng | Đề xuất cụ thể |
|---|---|---|
| **core** | app.js:598 `teMenuOrganize()` | **QU-18** Menu ☰ 22 → ≤ 12 mục: bỏ "Trang chủ", "Hồ sơ của tôi" (trùng thanh dưới); gộp "Lịch tập tuần này / Tạo giáo án riêng / Giáo án mẫu / Quản lý chương trình tập" → 1 mục **"Giáo án"**; gộp "Sự kiện & Thi đua" + "Sự kiện offline & vé" → **"Sự kiện"**; thêm ô "Tìm trong TapEasy" ở đầu menu. Tên theo GLOSSARY §8.1. |
| **core** | index.html (ux) + app.js/pt.js | **QU-01 nạp lười**: giữ trong index.html lõi (themes, icons, cloud, rbac, data, templates, exdb, app, meals, nutrition, video, library, coach, pt, ui-kit, achievements, health-safety). Chuyển 4 nhóm sang `loadGroup(name)` (chèn `<script>` tuần tự + `<link>` CSS, trả Promise, nhớ đã nạp): **pt** = ptprofile?, pt-pro, cloud-social, pt-connect, community, cloud-pt-directory, findpt · **events** = cloud-events, events-media, events, shop-data, shop · **kb** = kb-data-1..6, kb (cần `kb-index.js` ~5 KB cho "Kiến thức hôm nay") · **admin** = cloud-admin, admin. Stub ở `teHomeExplore` (pt.js) và menu (app.js): `onclick → loadGroup('findpt').then(()=>TE_FINDPT.open())`. Lưu ý thứ tự: cloud-admin bọc API events/shop/social/findpt/kb ⇒ nạp sau nhóm tương ứng; health-safety bọc hàm render ⇒ cần hàm `FKHealth.rewrap()` gọi lại sau mỗi nhóm. Khi xong, ux cập nhật index.html + test 00-boot/50-theme-packs (thứ tự) + prepare-www gộp JS theo nhóm. |
| core | app.js `renderProgressScreen` | **QU-21** thêm tab "Kỷ lục" (đưa thẻ Kỷ lục cá nhân sang), đổi mục menu "Ảnh tiến trình & InBody" → "Tiến độ". |
| core | pt.js `mountWelcomeVideo` | **QU-04** poster WebP tĩnh ≤ 60 KB + URL video gán lúc build (bỏ gọi Pixabay API có khoá ở client); `appBoot` nhường luồng (**QU-02**). |
| core | app.js `goto` | **QU-11** gỡ DOM màn module rời > 60 s. |
| pt | findpt.js:1481, findpt.css | **QU-05** bỏ parallax theo scroll; **QU-36** ≥ 1024 px: lưới 2 cột cho danh sách thẻ PT (ui-kit đã có `html[data-screen="findpt"]` để bám). |
| commerce | events.css, community.css, kb.css | **QU-36** lưới 2 cột ≥ 1024 px (bám `html[data-screen=…]`), sau đó ux thêm màn vào danh sách khung rộng ở ui-kit.css:139. |
| training / pt / commerce / security | xem GLOSSARY-vi.md §8.4 | **QU-24/25** thay chữ hiển thị: deload → "tuần giảm tải" (training-pro.js 56 chỗ), Routine → "Giáo án chia sẻ" (community.js), "Gian hàng"/"TapEasy Store" → "Cửa hàng", "TapEasy Points" → "Điểm TapEasy", Check-in → "Điểm danh", RPE/RIR ở cấp Mới tập. |
| nutrition | nutrition.js | **QU-03** ghi nhớ `buildDayPlan` theo ngày + hồ sơ; vẽ "Thực đơn gợi ý"/"Đi chợ" lúc rảnh. |
| mọi owner module | CSS module | **QU-31** chữ < 12 px còn trong CSS module; **QU-12** dùng biến thay màu cứng để có thể bỏ dần `themes-modules.css` (1 572 luật). |
| docs (integrator) | docs/DESIGN-SYSTEM.md:34–37 | Cập nhật: `--on-coral` theme Mặc định nay là `#061A24` (6,9:1), bỏ ghi chú ⚠ 2,6:1. |
| integrator | themes-modules.css | Đã sinh lại lúc 22:2x (`python3 scripts/gen_themes_layer.py --modules`, 1 572 luật). **Chạy lại sau khi mọi fixer xong** nếu có CSS module đổi tiếp (test 50-theme-packs sẽ báo). |

## 4. Việc còn lại (ux)

- QU-01 phần index.html + gộp JS theo nhóm — chờ core làm `loadGroup` + stub.
- QU-12 "chỉ dùng biến" (L): đổi màu cứng trong style.css sang token, rồi thu gọn themes.css §2 / themes-modules.css.
- `MINIFY_JS=1` (esbuild) chưa kiểm trên thiết bị thật — giữ mặc định tắt; bật trên CI có mạng sau khi chạy `node tests/run.js` + kiểm thử trình duyệt với `www/`.
- CSP: bỏ `'unsafe-inline'` ở `script-src` khi không còn `onclick=` nội tuyến.

## 5. Kết quả test

- `node tests/run.js --only fix-ux`: 22/22.
- Toàn bộ `node tests/run.js` lần 1: 469 test, 3 đỏ không thuộc ux (QC-16, QC-17 của commerce; 50-theme-packs "themes-modules.css cũ" do CSS module của fixer khác đổi → **ux đã sinh lại themes-modules.css**). Lần cuối: **492/492 xanh** (24 suite, gồm 66-fix-ux 22/22).
- Bản ghép `python3 scripts/build-single-html.py _test/fix-ux/single/index.html` (4,7 MB): 0 lỗi JS, 0 vi phạm CSP — người quay lại (Trang chủ, 4 tab, 5 module, đổi 3 theme) và lần đầu (màn chào). 404 duy nhất: ảnh `assets/shop/*.webp` (bản ghép không có `--embed-shop`, đúng thiết kế). Không ghi đè `outputs/FitKit-dung-thu.html`.

## Vòng 2 (11/11/2026, 23:00 — `docs/qa/HANDOFF-ROUND-BRIEF.md` mục ux)

File đã sửa: `fk-lazy.js` (**mới**, script nhỏ nạp sớm trong `<head>` — hợp đồng cho phép), `index.html`, `ui-kit.js`, `ui-kit.css`, `style.css`, `ui-signature.js`, `sw.js`, `scripts/prepare-www.sh`, `scripts/build-single-html.py`, `docs/DESIGN-SYSTEM.md`, `tests/suites/66-fix-ux.test.js` (+12 test: 22 → 34); `themes-modules.css` chạy lại generator (không đổi). Test cũ cập nhật có ghi chú: `tests/suites/50-theme-packs.test.js` "Tự bọc…" (khẳng định `#tsx-place` được bọc trượt — hành vi đã bỏ theo FIX-commerce #2).

| # | Việc | Trạng thái | File:dòng | Test (66) |
|---|---|---|---|---|
| 1 | **fkLazy** + gỡ dữ liệu khỏi lúc mở app | **Đã làm** | `fk-lazy.js` (166 dòng) · `index.html:51` (nạp trong `<head>` sau themes.js), `:521–526`, `:543–548` · `sw.js:8,22` (`fitkit-v8`, + `fk-lazy.js`) · `prepare-www.sh:15, 155–159` · `build-single-html.py:88–108` | R2-LAZY-01…06 |
| 2 | FIX-nutrition #4: thanh trên Dinh dưỡng đè nội dung khi cuộn | Đã sửa (mọi màn có `.topbar` dính) | `ui-kit.js:505–521` (`html.fk-scrolled` theo `#app-scroll.scrollTop > 6`, tính lại khi đổi màn `:368`) · `ui-kit.css:129–135` (nền `rgba(var(--fk-veil-rgb), .94)` theo theme/gói, không blur) | NU-4 |
| 3 | FIX-pt §3: chuyển gốc `.pp-*` bỏ blur; `.stat-box .cap`; `.seg button` | Đã sửa | `style.css:646` `.pp-glass`, `:673` `.pp-chips span`, `:704` `.pp-cta` (nền đặc, không `backdrop-filter`); `:529` `.seg button{min-height:44px}`; `.stat-box .cap` đã 12 px ở `:272` (đo trình duyệt: 12 px) — có thể bỏ ghi đè cục bộ `pt-connect.css:310–311` | PT-3 |
| 4 | FIX-commerce #2: bỏ `#tsx-place` khỏi `SLIDE_TARGETS` | Đã sửa | `ui-signature.js:178` | QC-16 (+ 50-theme-packs) |
| 5 | FIX-security #6: `STORE_BUILD=1` dừng khi `firebase-config.js` trống | Đã sửa | `prepare-www.sh:4–20` (thiếu file / `apiKey`/`projectId`/`appId` rỗng → `exit 1`; mặc định chỉ cảnh báo "CHẾ ĐỘ DEMO") | SEC-6 (chạy thật khối bash 4 ca) |
| 6 | `DESIGN-SYSTEM.md:34–37` `--on-coral` #061A24 (6,9:1) | Đã sửa | `docs/DESIGN-SYSTEM.md:34, 37` | DS-1 |
| 7 | Khung rộng ≥ 1024 px cho màn đã có lưới 2 cột | Đã sửa | `ui-kit.css:143–153` + `events`, `community`, `kb` (commerce: `events.css:617`, `community.css:276`, `kb.css:309`). **Tìm PT không thêm**: `findpt.css:655` (pt) tự mở khung 1 120 px + nội dung 1 080 px — giới hạn 820 px của ui-kit sẽ bó album | QU-36 (vòng 2) |
| 8 | Sinh lại `themes-modules.css` + chạy toàn bộ test | Xem cuối mục | — | 50-theme-packs |

### fkLazy — thiết kế
- **Khai báo trong index.html, không chạy**: `<script type="text/fk-lazy" data-group="exdbvi|kb" src="…">` ở ĐÚNG vị trí cũ. Trình duyệt không tải/chạy kiểu script lạ ⇒ 9 file (≈ 450 KB JS: exdb-vi-1..3 178 KB, kb-data-1..6 285 KB) ra khỏi đường khởi động. Vì vẫn là `src=` theo thứ tự cũ: `tests/lib/harness.js` vẫn nạp chúng (test cũ + test thứ tự 00-boot/10-integration không đổi), `prepare-www.sh` vẫn chép + kiểm + đưa vào `ASSETS` của `www/sw.js`, `build-single-html.py` nhận diện để nhúng.
- **Nhóm**: `exdbvi` = `exdb-vi-1..3.js` (dữ liệu). `exdb-vi.js` là **mã** ghi đè `exdbToItem/openExDbDetail/openExDbPicker/libExdbItem/openLibDetail/getExerciseMeta` và bị `kb.js`, `health-safety.js` bọc tiếp ⇒ **vẫn nạp sẵn** (22 KB) để giữ thứ tự bọc hàm; nó đọc `EXDB_VI` lúc gọi nên chạy được khi dữ liệu đến sau (training đã thêm `viReady()`/`exdbViReady()`). `kb` = `kb-data-1..6.js`.
- **Hành vi**: tuần tự, nhớ đã nạp, gọi trùng/song song = 1 Promise; dữ liệu có sẵn (thẻ thường, bản ghép, test) → resolve ngay **không tải lại** (kb-data push vào mảng — tải 2 lần sẽ nhân đôi bài); lỗi mạng/quá 20 s → reject, quên Promise lỗi, lần sau chỉ tải file còn thiếu (file đang treo không chèn thẻ thứ hai); xong → sự kiện `fk:lazy` + `fk:lazy:<nhóm>`; lúc rảnh ~4 s sau `load` tự nạp trước (trừ Save-Data / 2G). API phụ `loaded/files/groups/prefetch`, `_inject` (thay trong test).
- **Bên tiêu thụ đã cập nhật trước khi gỡ** (grep `fkLazy.load`): `exdb.js:58 exdbViReady`, `exdb-vi.js:22 viReady`, `library.js:80 libViReady` (training); `kb.js:299–320 ensureData` + `:1130 install` (commerce). Biến toàn cục `EXDB_VI` chỉ dùng ở `exdb-vi*.js`, `library.js`; `KB_ARTICLES/KB_GLOSSARY/KB_FAQ` chỉ ở `kb.js`, `kb-data-*`.
- **Bản 1 file**: `build-single-html.py` nhúng 9 file tại chỗ + `window.__fkLazyDone[src] = 1` ⇒ `fkLazy.load` resolve trong 2 ms, 0 request.

### Kiểm thử trình duyệt (Playwright, ngữ cảnh riêng `fix-ux`, http qua `route.fulfill`)
- Mở app (người quay lại): 0 lỗi JS, **0 request** exdb-vi-*/kb-data-* trước `load`; nạp trước lúc rảnh sau ~4 s.
- Vào Kho kiến thức khi chưa nạp → "Đang tải" rồi 87 bài · 147 thuật ngữ · 45 hỏi đáp. Giả mất mạng ở `kb-data-3.js` → "Không tải được Kho kiến thức" + nút **Thử lại**; thử lại → 87 bài (không nhân đôi), chỉ chèn 4 file còn thiếu.
- Thư viện bài tập → `EXDB_VI` 876 bản dịch, 915 bài · 14 nhóm.
- Dinh dưỡng cuộn 700 px: thanh trên nền `rgba(6,26,36,.94)`, về đầu → trong suốt như cũ (ảnh `_test/fix-ux/r2-nutrition-scrolled.png`).
- 1 280 px: Kho kiến thức / Cộng đồng / Sự kiện khung 1 120, nội dung 820, lưới 2 cột 388 px (ảnh `_test/fix-ux/r2-wide-*.png`).

### Đo khởi động trước / sau fkLazy (CPU 4×, 390×844, không cache, xen kẽ; số thô `_test/fix-ux/results-r2.json`)
"Trước" = mã nguồn hiện tại với 9 file chạy ngay; "Sau" = cùng mã, 9 file nạp lười (`_test/fix-ux/mk-r2.sh` dựng 2 bản) ⇒ chỉ khác đúng thay đổi này.

**Người dùng quay lại (Trang chủ), trung vị 3 lần, ms**

| Chỉ số | Trước | Sau | Δ |
|---|---|---|---|
| FCP | 448 | 436 | ≈ |
| Trang chủ hiện | 1 281 | 1 171 | −9 % |
| DCL | 3 251 | **2 632** | −19 % |
| LCP | 4 156 | 3 620 | −13 % |
| TTI | 4 138 | **3 597** | −13 % |
| TBT | 779 | **464** | −40 % |
| Tổng long task trước `load` | 1 312 | 825 | −37 % |
| Số long task | 13 | 10 | |

**Lần đầu (màn chào), 1 lần mỗi bản**: DCL 4 433 → 3 360, TBT 1 113 → 895, FCP 676 → 436; TTI 4 556 → 4 947 (1 mẫu, long task hoạt ảnh màn chào — nhiễu, không do nạp lười vì lượt nạp trước bắt đầu sau `load` + 4 s = 7,4 s).

### Chuyển giao (vòng 2)
| Cho | File:dòng | Đề xuất |
|---|---|---|
| security | `.github/workflows/build-android.yml:37`, `build-ios.yml:22`, `ios-appstore.yml:35` | Bản phát hành gọi `STORE_BUILD=1 bash scripts/prepare-www.sh` (bước kiểm `grep apiKey` hiện có ở build-android có thể giữ hoặc bỏ). |
| pt | `pt-connect.css:310–311`, `findpt.css:642–643` | Ghi đè cục bộ `.stat-box .cap`, `.seg button`, `.pp-chips span`, `.pp-cta` nay trùng gốc `style.css` → có thể xoá. |
| training | `exdb-vi.js:12` | Ghi chú "(và cả file này) có thể nạp sau" — hiện **không** nạp lười `exdb-vi.js` (mã bọc hàm, thứ tự với kb.js/health-safety.js); nếu muốn nạp lười cả file này cần cơ chế bọc lại. |
| core / mọi module | — | Bước tiếp QU-01: dùng chung `fkLazy` cho nhóm **module** (pt, events, admin) — cần `fkLazy.define(nhóm, files)` + stub mở màn ở `app.js`/`pt.js` + `FKHealth.rewrap()` (health-safety bọc hàm). |

### Việc #8 — sinh lại lớp màu module + chạy toàn bộ test (00:40, 12/11)
- Chờ `FIX-*.md` có mục "Vòng 2" từ 23:35: core ✓, training ✓, pt ✓ (00:04), nutrition ✓ (00:16); **commerce chưa ghi mục "Vòng 2" sau ~65 phút** (code + suite 64 đã cập nhật, sửa cuối 00:18) → chạy bước cuối theo giới hạn thời gian.
- `python3 scripts/gen_themes_layer.py --modules` → 1 622 luật từ 13 CSS module; kết quả **trùng byte** với `themes-modules.css` hiện có (đã có người chạy sau lần sửa CSS cuối). Nếu commerce sửa CSS sau 00:40 → chạy lại lệnh này (suite 50 sẽ báo).
- `node tests/run.js` (công cụ cắt ~90 s/lần gọi → chạy theo nhóm `--only`, cùng mã nguồn lúc 00:40–00:44): **24/24 suite xanh, 553/553** — 00 60/60 · 01 24 · 02 19 · 03 12 · 04 14 · 05 16 · 06 17 · 07 1 · 08 20 · 09 15 · 10 16 · 20 17 · 21 8 · 30 27 · 40-findpt 9 · 40-kb 17 · 50 17 · 60 44 · 61 35 · 62 39 · 63 33 · 64 30 · 65 29 · **66 34/34**.
- Kiểm lại trình duyệt lúc 00:45 (mã cuối): bản nguồn + bản 1 file (`_test/fix-ux/r2-single/index.html`, 4,8 MB): mở app → Kho kiến thức → Thư viện → Dinh dưỡng → Tập luyện → PT → Trang chủ: **0 lỗi JS**, 87 bài KB, 876 bản dịch; bản nguồn 0 request dữ liệu lúc mở (9 khi cần/lúc rảnh), bản 1 file 0 request.

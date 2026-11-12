# THEME-PACKS — 9 gói theme "học phong cách" (Aurora · Espresso · Thu Alpine · Sương Wellness · Sanctuary · Cam năng lượng · Volt · Tím Đêm Pro · Chanh sáng) + token accent theo theme

> Chủ sở hữu: design-system lead. File liên quan: `theme-packs.css/.js`, `theme-accent.css/.js` (vòng accent), `ui-signature.css/.js`,
> `themes.js`, `themes.css`, `themes-modules.css`, `scripts/gen_themes_layer.py`,
> `tests/suites/50-theme-packs.test.js`, `tests/suites/72-theme-accent.test.js`.

## Trạng thái (nhật ký tiến độ — cập nhật sau mỗi bước)

- [14:29] Lần chạy 3 bắt đầu. 2 lần trước bị ngắt. Doc này được tạo mới (trước đó chưa có).
  Đang đọc hiện trạng các file để đánh giá phần đã xong.
- [14:30] ĐÁNH GIÁ phần đã có (giữ nguyên, không làm lại):
  - `themes.js` — XONG: 6 theme cũ + 5 gói (`pack:true`, `pv` ảnh xem trước, font Google nạp lười, `fkTheme.register`).
  - `theme-packs.css` — XONG: token 5 gói + lớp chung `html.tp-pack` + chi tiết từng gói + lowfx/reduced-motion.
  - `theme-packs.js` — XONG: khúc xạ SVG `feDisplacementMap` (bản đồ SDF) cho Espresso, tự tắt khi lowfx/iOS/không Chromium.
  - `ui-signature.js/.css` — XONG: `teSlideConfirm`, stepper, hero+thẻ thống kê Hồ sơ, gauge Trang chủ, thẻ chọn số, typewriter.
  - `themes.css` (CSS ảnh xem trước gói) + `gen_themes_layer.py` (SKIP_SEL admin/shop) — XONG; chạy lại `--write` và
    `--modules` → KHÔNG khác bản đang có (489 luật lõi; 1545 luật / 13 module CSS) ⇒ lớp sinh đã cập nhật.
  - CHƯA làm: gắn index.html / sw.js / prepare-www.sh, suite test 50, chụp 11 theme × 4 màn, doc này, build HTML đơn.
- [14:31] `gen_themes_layer.py`: gộp `var(--x, var(--x))` thừa → `var(--x)`; sinh lại themes.css + themes-modules.css (13 CSS module).
- [14:32] Gắn: index.html (+2 `<link>` sau themes-modules.css, +2 `<script>` sau health-safety.js), sw.js ASSETS (+1 dòng),
  prepare-www.sh (+1 dòng `cp`). Kiểm cú pháp sw.js / bash -n: OK.
- [14:33] `node tests/run.js` lần 1: 287/291 — 4 lỗi do vị trí nạp (test 00-boot/10-r3 yêu cầu `health-safety.js` CUỐI,
  `brand.css` + `themes-modules.css` là 2 stylesheet cuối) + 1 mẫu chèn chưa phân loại ở gauge.
  Sửa: theme-packs.css/ui-signature.css chuyển lên NGAY TRƯỚC brand.css (thắng nhờ độ ưu tiên `html[data-theme]`),
  theme-packs.js/ui-signature.js NGAY TRƯỚC health-safety.js; gauge dùng `esc(remTxt)`. Chạy lại: **291/291 xanh**.
- [14:38] Viết `tests/suites/50-theme-packs.test.js` (17 test). Test tương phản (WCAG, trộn alpha, vùng sáng nhất của nền
  + thẻ) bắt 5 cặp chữ mờ < 4,5:1 → nâng `--text-muted/--text-dim` Espresso (.86/.85), Wellness (.90/.86, quầng nền .06),
  Sanctuary (.88/.86, đỉnh nền #4A3F37, quầng .09). Viết phần nội dung doc này (mục 1–7).

## 1. Tổng quan

Gói giao diện (theme pack) = **màu + chất liệu kính + font + bo góc + nền + chuyển động + thành phần chữ ký**.
Mỗi gói học *phong cách* của một mẫu tham khảo (motion site) — **không** dùng ảnh, video, font trả phí, logo hay tên
thương hiệu của mẫu. Nền/minh hoạ đều vẽ bằng CSS gradient hoặc SVG nội tuyến; font chỉ lấy từ Google Fonts (OFL):
Inter, Inter Tight, JetBrains Mono, Manrope.

| id | Tên trong app | Chế độ | Nét chính (đã hiện thực) |
|---|---|---|---|
| `aurora` | Aurora | tối | nền `#000`, thẻ `#1A1A1A`, chữ trắng, Inter; nút chính trắng chữ đen cao 56; input bo 12 cao ≥ 44; stepper 3 bước (đang làm: nền trắng/chữ đen); reveal so le 0,15 s; không kính, không vệt sáng |
| `espresso` | Espresso | tối | nâu `#180A06`, chữ kem `#EDE4D8`, nền nhiều quầng radial cam-nâu; thẻ kính bo 24; **kính lỏng có khúc xạ** (SVG `feDisplacementMap`, tắt trên máy yếu/iOS/không Chromium); hero mờ dần (scale + blur); easing `cubic-bezier(.16,1,.3,1)`; thẻ thống kê có minh hoạ ở Hồ sơ |
| `alpine` | Thu Alpine | **sáng** | kính kem `rgba(244,240,233,.94)` blur 14, panel `#EAE6DE`, mực `#2E2D2A`; hổ phách `#F6B733/#FBD06A`, cam `#F59E0B`, tím `#7C6CF2`; tiêu đề Inter Tight 300 tracking −.045em; nhãn JetBrains Mono 500 IN HOA tiền tố "::"; chip đào; gauge nửa vòng ở Trang chủ; **không đổ bóng**; dãy núi SVG nội tuyến ở nền |
| `wellness` | Sương Wellness | tối (sương) | xanh xám sương (gốc `#8A9AAA`, phủ tối để chữ trắng đạt AA); kính viền gradient bằng `::before` + `mask-composite: exclude`; thẻ chọn bo 32 cao 100 có số 01/02; nút tròn quầng vàng (nhịp thở 3,2 s); trượt để xác nhận chốt 85 % |
| `sanctuary` | Sanctuary | tối | nâu `#5A4C41` → tối `rgb(29,25,26)`, kem `#F1E5C6`, off-white `#F5F0E8`; Manrope Light; tiêu đề lớn mảnh (−.048em); sheet = thẻ kem ở đáy; thẻ ngày 68×90 ở Sự kiện; chữ dọc xoay; **typewriter** tiêu đề Sự kiện/Kho kiến thức |
| `ember` | Cam năng lượng | **sáng** | nền `#F4F4F2`/thẻ trắng bo 26, cam `#FF6A2B → #FF8A3D`; CTA viên thuốc gradient cam, chữ `#1B0F0A` (6,6:1), bóng cam mềm; số liệu Inter Tight 800, đơn vị/dòng 2 lời chào cam đậm `#C2410C` (5,2:1); ngày hôm nay = viên cam |
| `volt` | Volt | tối | nền `#0B0B0C`, thẻ `#1A1A1C` phẳng, chanh `#D4FF3A` (chữ trên chanh đen 17:1); tiêu đề IN HOA Inter Tight 800 (line-height 1,08 cho dấu), dòng 2 lời chào màu chanh; CTA khối = viên dài + nút tròn đen 44 px có mũi tên chanh |
| `violet` | Tím Đêm Pro | tối | nền `#15161C`, thẻ `#1F2029`, nút `#6C4CF5` chữ trắng (5,3:1), accent `#7254FA` (≈ `#7C5CFF` của mẫu, chỉnh để chữ trắng đạt AA); 3 màu chỉ số tím `#7C5CFF` / vàng `#FFC83D` / xanh `#3DD6F5` (thanh macro, số liệu thẻ) |
| `lime` | Chanh sáng | **sáng** | nền trắng, thẻ `#F3F4EF` bo 28, chip/CTA chanh `#DFFF4F` chữ đen; dock đen; thẻ ảnh bo lớn có nút tròn chanh 44 px mũi tên; CTA khối có nút tròn đen; chữ/link ô-liu `#4D6600` (6,5:1) |

6 theme cũ (Mặc định, Đại dương, Hoàng hôn, Rừng, Tím đêm, Sáng) + "Tự động" giữ nguyên id, tên, màu.
4 gói cuối học phong cách từ 4 ảnh mẫu chủ app gửi (vòng accent 12/11) — chỉ học bảng màu/bố cục/hình khối, không dùng ảnh, logo, tên thương hiệu của mẫu;
tên "Tím Đêm Pro" để khỏi trùng theme cũ "Tím đêm" (`midnight`).

### Sai khác có chủ đích so với mẫu (vì AA / hiệu năng)

- Espresso: chữ mờ của mẫu `rgba(235,220,205,.55)` chỉ ~3:1 → dùng `.85` (dim) / `.86` (muted).
- Sương Wellness: nền `#8A9AAA` với chữ trắng chỉ 2,9:1 → nền là dải `#384656 → #2C353F` có quầng sáng nhẹ (giữ cảm giác sương);
  `--fk-text-boost:.45` để chữ trắng-mờ viết cứng trong CSS module (.6–.72) lên .78–.85.
- Thu Alpine: tím `#7C6CF2` dùng cho thanh/biểu đồ; chữ/liên kết tím dùng `#5A49CF` (5,6:1); hổ phách cho chữ dùng `#A9520A`.
- Khúc xạ kính chỉ bật trên Chromium (`backdrop-filter:url()`), còn lại là kính mờ thường.

## 2. Kiến trúc & thứ tự nạp

```html
<!-- <head> -->
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="themes.css">          <!-- token 6 theme + lớp màu sinh tự động + CSS bộ chọn (ảnh xem trước gói) -->
… CSS module …
<link rel="stylesheet" href="theme-packs.css">     <!-- token + chất liệu 5 gói -->
<link rel="stylesheet" href="ui-signature.css">    <!-- thành phần chữ ký (chỉ đọc token) -->
<link rel="stylesheet" href="brand.css">
<link rel="stylesheet" href="themes-modules.css">  <!-- luôn cuối (tests/00-boot) -->
<script src="themes.js"></script>                  <!-- danh sách theme + gói, áp data-theme trước khi vẽ -->
<!-- cuối <body> -->
… module … admin.js
<script src="theme-packs.js"></script>             <!-- khúc xạ kính Espresso -->
<script src="ui-signature.js"></script>            <!-- bọc hàm render: slide, stepper, gauge, hồ sơ, typewriter -->
<script src="health-safety.js"></script>           <!-- luôn cuối -->
```

- `theme-packs.css` nạp **trước** brand.css/themes-modules.css nhưng vẫn thắng: mọi luật có tiền tố
  `:root[data-theme=…]` (0,2,0) / `html[data-theme=…] …` / `html.tp-pack …` — cao hơn `:root` của brand.css và
  `:where(html.fk-themed) .x` (= độ ưu tiên gốc) của themes-modules.css.
- `<html data-theme="espresso" data-pack="espresso" class="fk-themed fk-dark tp-pack [tp-refract] [lowfx]">`.
- Sự kiện `fk:themechange` có thêm `detail.pack`, `detail.light`.
- Font của gói nạp **lười** (chỉ khi chọn gói): `themes.js → ensureFonts()` thêm `<link>` Google Fonts `display=swap`.
  Tắt (offline/thử nghiệm): `window.TP_NO_REMOTE_FONTS = true` trước khi nạp themes.js.

### Token riêng của gói (`--tp-*`, đặt trong khối `:root[data-theme="<id>"]`)

`--tp-r-card · --tp-r-tile · --tp-r-btn · --tp-r-input · --tp-r-dock · --tp-btn-h · --tp-head-w · --tp-head-track ·
--tp-ease · --tp-stagger · --tp-rise · --tp-rise-dur · --tp-gauge-a/-b · --tp-hero-grad` và cho ui-signature:
`--sig-step-on-bg/-ink · --sig-step-off-bg · --sig-choice-r/-h · --sig-gauge-dur · --font-mono`.
Ngoài ra gói đặt lại token chung của themes.css (`--bg --navy* --mint* --coral* --on-mint --on-coral --fk-ink(-rgb)
--fk-ov-rgb --fk-text-boost --text-muted --text-dim --glass --glass-blur --glass-solid --fk-shell-bg --fk-dock-bg …`)
→ lớp màu sinh tự động (style.css + 13 CSS module) tự đổi theo.

## 3. Thành phần chữ ký (`ui-signature.js/.css`) — dùng chung mọi theme

| Thành phần | Học từ | Gắn vào app (qua wrapper, không sửa file lõi) |
|---|---|---|
| `teSlideConfirm(el, onConfirm, opts)` — trượt để xác nhận, chốt 85 %, thumb 44 px, Enter/→ dùng được bằng bàn phím | Wellness | Tự bọc `#btn-session-done` (Kết thúc buổi tập, app.js/training-pro), `#px-finish` (PT), `#tsx-place` (Đặt hàng, shop.js), `#del-go` (Xoá tài khoản, pt.js), `#btn-confirm-reset` (Xoá hết dữ liệu). Nút gốc chỉ bị ẩn; trượt xong gọi `orig.click()` → mọi kiểm tra cũ vẫn chạy; nút gốc bị disabled → không xác nhận |
| Stepper 3 chặng (Bạn · Cơ thể · Mục tiêu) + nội dung hiện so le | Aurora | bọc `renderOnboardProgress` |
| Hero mờ dần + 3 thẻ thống kê có minh hoạ SVG (cân, BMI, chuỗi ngày) | Espresso | bọc `renderProfileScreen` |
| Thẻ năng lượng: gauge nửa vòng + nhãn mono "::" + số đếm tăng + 3 thanh macro | Thu Alpine | bọc `renderHomeScreen` (chạm → Dinh dưỡng) |
| Thẻ chọn bo lớn có số 01/02 (`.sig-choices > .sig-choice`) | Wellness | tự áp cho `#goal-list`, `#activity-list` (onboarding), `.pb-grid` (program builder) |
| Typewriter + tiêu đề editorial | Sanctuary | chỉ khi theme = `sanctuary`, màn Sự kiện / Kho kiến thức (bọc `goto`) |

API: `window.teSig = { slideConfirm, slideTargets, scan, renderStepper, decorateProfile, decorateHome, typewrite, gaugeHTML }`.
Thêm nút cần trượt: `teSig.slideTargets.push({ sel:"#id", label:"Trượt để …", danger:true, icon:"delete_forever" }); teSig.scan();`
Tắt từng phần (đặt trước khi nạp): `window.TE_SIG_OFF = { slide:1, stepper:1, profile:1, gauge:1, typewriter:1 }`.

## 4. Khả năng tiếp cận & hiệu năng

- **AA**: chữ chính/mờ/CTA/chip của 5 gói ≥ 4,5:1 — kiểm tự động trong suite 50 (tính WCAG có trộn alpha ở vùng sáng
  nhất của nền + thẻ) và đo thật trên trình duyệt (mục 6).
- **Vùng chạm ≥ 44 px**: icon-btn topbar 44, input ≥ 44, thumb trượt 44, bước stepper ≥ 44, lựa chọn theme ≥ 56.
  Chữ ≥ 12 px (gói nâng nhãn ngày 9,5 px của style.css lên 12 px).
- **prefers-reduced-motion**: tắt reveal so le, hero reveal, quầng thở, ánh chữ trượt, typewriter (hiện chữ ngay), đếm số.
- **`.lowfx`** (máy yếu / giảm trong suốt / người dùng chọn "Giảm"): tắt khúc xạ + blur kính Espresso, bỏ viền
  gradient Wellness (thay viền đặc), rãnh trượt không blur, gauge dùng nền đặc. `prefers-reduced-transparency` cũng tắt kính.

## 5. Thêm gói mới khi chủ app gửi thêm mẫu

1. **Phân tích mẫu (chỉ phong cách)**: ghi bảng màu (nền, thẻ, chữ, chữ mờ, nhấn, CTA), font (tìm bản Google Fonts
   tương đương nếu font mẫu trả phí), bo góc, chất liệu (kính/phẳng/viền), chuyển động (easing, độ trễ), 1–2 thành phần
   đặc trưng. KHÔNG tải/nhúng ảnh, video, font, logo, tên thương hiệu của mẫu; đặt tên gói tiếng Việt/trung tính.
2. **Đăng ký** trong `themes.js` (mảng `THEMES`, sau các gói hiện có):
   ```js
   { id:"ten-goi", name:"Tên hiển thị", desc:"Mô tả ngắn", meta:"#màu-thanh-trạng-thái", pack:true, mode:"light"?,
     fonts:["Inter:wght@300;400;600"],   // chỉ Google Fonts
     pv:{ bg, card, ink, cardInk?, acc, cta, ctaInk, r:"12px", font:"'Inter',sans-serif", w:400 } }   // ảnh xem trước
   ```
   Hoặc từ file riêng nạp sau themes.js: `fkTheme.register({...})` (id `^[a-z][a-z0-9-]{1,23}$`, không trùng).
3. **Token** trong `theme-packs.css`: chép khối `:root[data-theme="aurora"]{…}` (gói tối) hoặc `alpine` (gói sáng —
   cần `mode:"light"` để bật mọi bản vá nền sáng), đổi giá trị. Bắt buộc có: `--bg --navy* --mint* --coral*
   --*-rgb --on-mint --on-coral --text-muted --text-dim --glass* --fk-shell-bg --fk-theme-color --tp-*`.
4. **Chi tiết gói** (mục 3–7 của file): chỉ viết luật có tiền tố `html[data-theme="ten-goi"]`; nút chính, chip đang
   chọn, nav đang chọn, `.wd.today`, sheet. Thành phần đặc trưng mới → thêm vào `ui-signature.js/.css` dạng lớp chung
   (đọc token), bọc hàm bằng `wrapGlobal(...)`, tôn trọng `RM()` và `html.lowfx`.
5. **Máy yếu/giảm chuyển động**: thêm luật vào mục 8 (`html.lowfx[data-theme=…]`, `@media (prefers-reduced-motion: reduce)`).
6. **Kiểm**: thêm id vào `PACKS` + cặp màu vào test tương phản ở `tests/suites/50-theme-packs.test.js`;
   `node tests/run.js`; chụp bảng (mục 6) và `__audit` đếm chữ < AA; nếu sửa CSS module thì
   `python3 scripts/gen_themes_layer.py --modules`. Ghi một dòng vào mục "Trạng thái" + bảng mục 1.

## 6. Cách thử

```bash
node tests/run.js                       # toàn bộ (gồm suite 50)
node tests/run.js --only theme-packs    # chỉ suite 50
python3 scripts/gen_themes_layer.py --write && python3 scripts/gen_themes_layer.py --modules   # sau khi sửa style.css / CSS module
# Playwright (context riêng "tapeasy-themes-4", 390 px): 11 theme × 4 màn → _test/shots/themes2-sheet-*.jpg + đo tương phản + lỗi JS
cd ../_test/themes2-harness
python3 build2.py ../themes4-test.html --preset preset.json --test t_themes4.js   # ghép app + kịch bản (__func, __show, __audit, __taps)
#   chạy shoot4.tpl.js (thay __THEMES__ bằng ["aurora","espresso"]…) trong Playwright: browser.newContext() mới mỗi lượt,
#   chụp _test/shots/t4/<màn>-<theme>.jpg, trả về số chữ < AA (__audit), vùng chạm < 44 (__taps), lỗi JS; __func() = 53 kiểm thử chức năng
python3 sheet4.py                        # ghép bảng themes2-sheet-home|workout|nutrition|profile.jpg
cd ../../FitKit && python3 scripts/build-single-html.py    # tạo lại ../FitKit-dung-thu.html
```

## 7. Giới hạn

- Khúc xạ kính chỉ Chromium/Android WebView; iOS/Safari/Firefox dùng kính mờ thường (đúng thiết kế, không lỗi).
- Font gói nạp từ Google Fonts khi có mạng; offline dùng font dự phòng hệ thống (Inter/Inter Tight/JetBrains Mono đã nạp sẵn ở index.html; Manrope chỉ nạp khi chọn Sanctuary).
- Màu viết cứng trong JS của module (style="") chỉ theo gói khi đã dùng `var(--…)` hoặc có bản vá ở themes.css §3.
- Cửa hàng (`.tsx`) và Bảng quản trị (`.adm`) giữ bảng màu riêng ở mọi theme (chủ đích).
## 8. Token accent theo theme (`theme-accent.css/.js`) — nút, chữ nhấn, logo đổi màu ăn khớp

**Vì sao:** trước vòng này nút chính/chip/tab/vòng/link/logo lấy `--mint`/`--coral` hoặc màu cứng (`#5EE6C7`, `#FF7A45`, logo teal
`#02BCB3` trong file SVG) → đổi theme vẫn còn teal/coral, logo luôn teal, mũi tên CTA màn chào biến mất (navy trên navy).

**Token (mỗi theme khai báo trong `:root[data-theme="…"]`, 15 theme):**

| Token | Dùng cho | Ràng buộc AA (kiểm ở suite 72) |
|---|---|---|
| `--accent` / `--accent-2` / `--accent-rgb` | chip/pill/segment đang chọn, tab dưới đang chọn, toggle, slider/checkbox (`accent-color`), thanh tiến độ, progress onboarding, stepper, tick hiệp, việc đã xong, vòng `ringSVG`, gạch dưới tab ngày | đồ hoạ ≥ 3:1 với nền (trừ 2 gói sáng dùng accent làm mảng nền) |
| `--on-accent` | chữ/icon trên nền accent | ≥ 4,5:1 với `--accent` |
| `--accent-soft` · `--accent-line` · `--accent-glow` | badge, hàng hiệp đã xong, nền nhạt, quầng (dẫn xuất từ `--accent-rgb`, tính lại ở "đảo tối") | — |
| `--cta-bg` (có thể gradient) · `--cta-solid` · `--cta-rgb` · `--cta-fg` · `--cta-shadow` | `.btn-primary` (kể cả coral cũ), `.nu-mini`, nút "+", số đếm `i.cnt`, chấm nav, CTA viên dài màn chào (SVG) | `--cta-fg` ≥ 4,5:1 với **cả 2 đầu** gradient |
| `--link` | "Xem tất cả" (`.section-title a`), icon tiêu đề thẻ, `.btn-soft`, số liệu nhấn (gauge, % thành tích), `.brand-name > span` | ≥ 4,5:1 với nền **và** thẻ |
| `--logo-mark` · `--logo-text` | "Easy" + biểu tượng · chữ "Tap" | biểu tượng ≥ 3:1, chữ ≥ 4,5:1 |
| `--gauge-a/-b` · `--ring-1/2/3` | gauge nửa vòng Trang chủ · 3 thanh macro (Tím Đêm Pro: tím/vàng/xanh) | — |

- **"Đảo tối"** (ảnh/video, màn chào) của theme sáng và **sheet kem Sanctuary** khai báo lại bộ token (mục 2 của file).
- Thành phần nằm ở mục 4–6 của `theme-accent.css`, chỉ đọc token (suite 72 cấm màu hex trong phần này). Bộ chọn
  `html[data-theme] …` = cùng độ ưu tiên với luật gói nhưng nạp **sau** `theme-packs.css` → thắng; nút trong sheet Sanctuary
  (`html[data-theme="sanctuary"] .sheet .btn-primary`, cao hơn) vẫn giữ nút mực.
- **Logo:** `theme-accent.js` thay `<img>` logo (thanh trên, màn chào, onboarding, menu, splash, trang đăng nhập, nhãn "TapEasy")
  bằng **SVG nội tuyến** cùng path của file gốc: nhóm `.ta-tap` → `fill:var(--logo-text)`, `.ta-easy`/`.ta-mark` →
  `fill:var(--logo-mark)`. File `assets/brand/*.svg` **không sửa**; JS lỗi/tắt → `<img>` gốc vẫn hiện (fallback).
  MutationObserver thay cả logo vẽ lại sau này; nhận diện theo tên file **và** theo lớp (`brand-wm`, `wl-brand-img`,
  `splash-logo`, `auth-logo`, `wl-tag-mark`) vì bản 1 file nhúng ảnh thành `data:` URI. Cửa hàng (`.tsx`), Quản trị (`.adm`),
  `[data-ta-keep]` giữ logo riêng. `.brand-mark` (mask CSS của brand.css) cũng đổi qua `--logo-mark`.
- **Đổi theme áp tức thì:** chỉ đổi `data-theme` → biến CSS → mọi thứ (kể cả logo) đổi ngay, không tải lại, không vẽ lại DOM.
- API: `window.teAccent = { logoSVG(kind, cls, label), swapLogos(root), tokens(), kindOf(src), kindOfImg(img) }`;
  tắt thử: `window.TE_ACCENT_OFF = { logo:1 }`.
- Thêm gói mới: ngoài mục 5, chép một khối `:root[data-theme="…"]` ở `theme-accent.css` §1 (đủ 17 token) + thêm id vào `THEMES`
  & `SURF` (nền + thẻ) của suite 72; gói sáng thêm khối "đảo tối" ở §2.

### Lỗi font slogan "Tập đúng, tiến bộ thật sự" (màn chào `.wl-head`)

Nguyên nhân (chụp trước: `_test/shots/slogan-before.jpg`): tiêu đề **IN HOA** dùng `line-height:.82` → dấu nặng của "TẬP"/"BỘ"
chạm dấu mũ+sắc của "TIẾN"/"THẬT" dòng dưới (dính/cắt dấu); gói Alpine/Sanctuary còn ép `h1` sang độ đậm 300 + `letter-spacing`
âm (Barlow Condensed chỉ nạp 800 → trình duyệt tổng hợp/đổi font, vỡ dấu); chuỗi dự phòng có `Arial Narrow` (thiếu dấu chồng trên
nhiều máy). Barlow Condensed **có** subset vietnamese (đã xác minh unicode-range U+0102-0103, U+1EA0-1EF9).
Sửa: `line-height:1.06` + `padding-top:.12em`, `font-synthesis:none`, `letter-spacing:.005em`, cỡ chữ `clamp(52px,15.5vw,80px)`;
chuỗi font `'Barlow Condensed','Inter Tight','Roboto Condensed','Segoe UI',Arial` (đều có tiếng Việt); áp cho mọi tiêu đề display
dùng `--cond` (`.wl-head`, `.wl-tag`, `.wl-brand`, `.wl-stat b`) và khoá lại ở `theme-accent.css §6` cho cả 15 theme; URL Google
Fonts (index.html, landing.html, font gói nạp lười trong themes.js) thêm `&subset=vietnamese`. Tiêu đề in hoa của gói Volt dùng
`line-height:1.08`. Chụp sau: `_test/shots/slogan-after.jpg`.

### Kiểm

```bash
node tests/run.js --only theme-accent      # suite 72: token 15 theme, AA, luật, logo SVG, slogan, 4 gói mới
node tests/run.js --only theme-packs       # suite 50 (đã nâng lên 9 gói / 16 lựa chọn)
# Playwright (context riêng "accent", 390 px): 15 theme × (màn chào, Trang chủ, Tập luyện) + window.__accent() đo computed style
cd ../_test/accent-harness && python3 build2.py ../accent-test.html --preset preset.json --test t_accent.js
#   chạy kịch bản trong shoot.tpl.js → _test/shots/acc/final-<màn>-<theme>.jpg ; python3 sheet.py → FitKit/_test/shots/accent-sheet-*.jpg
```

- [14:42] Suite 50: **17/17 xanh**. Doc mục 1–7 xong. Tiếp: Playwright 11 theme × 4 màn (context `tapeasy-themes-4`).
- [14:43] Playwright (Chromium 157, context mới `tapeasy-themes-4`, 390×844): harness `_test/themes4-test.html`
  (build2.py + t_themes4.js) — **53/53 kiểm thử chức năng PASS, 0 lỗi JS** (bộ chọn, gauge, stepper, thẻ chọn số, trượt 60 %/90 %/Enter,
  Kết thúc buổi thật, Xoá hết, Đặt hàng, khúc xạ/lowfx, register, typewriter). Tiếp: chụp 11 theme × 4 màn.
- [14:47] Chụp lượt 1 (navy, aurora, espresso, alpine, wellness): AA 0 lỗi ở Aurora/Espresso/Alpine; Wellness 11 chữ 3,9–4,4:1
  (nền đỉnh quá sáng khi đo trên chip/nút kính) → nền Wellness tối thêm (`#3A4859 → #2E3741`), `--fk-text-boost:.45`.
  Vùng chạm < 44 (ngày 36×26, nút +/– món 34×34, nút chỉnh mục tiêu 30×30) → gói nâng lên 44 (giữ hình 34 bằng padding
  + background-clip); ui-signature thêm aria-label cho nút chỉnh mục tiêu. Build lại harness, chụp lại.
- [14:49] Chụp lượt 2: Wellness còn 1 chữ 4,41:1, Sanctuary 10 chữ 4,1–4,4:1 (chữ kem-mờ viết cứng của module .6–.72) →
  Wellness nền `#384656 → #2C353F`; Sanctuary đỉnh nền `#3E342D` (nâu `#5A4C41` giữ ở hero/thẻ/ảnh xem trước), `--fk-text-boost:.35`.
- [14:51] Chụp lượt 3 (5 gói + Mặc định): **5 gói: 0 chữ dưới AA, 0 vùng chạm < 44, 0 lỗi JS** trên Trang chủ/Tập luyện/
  Dinh dưỡng/Hồ sơ. Mặc định giữ nguyên lỗi cũ đã ghi ở INTEGRATION-themes §5 (nút coral chữ trắng 2,6:1, nhãn 9,5 px).
- [14:54] Chụp xong 11 theme × 4 màn (44 ảnh, mỗi lượt một context Playwright mới) → `_test/shots/themes2-sheet-{home,workout,
  nutrition,profile}.jpg`. 0 lỗi JS ở mọi theme. 5 gói: 0 chữ < AA / 0 vùng chạm < 44. 6 theme cũ giữ nguyên (lỗi cũ: nhãn
  ngày 9,5 px, vài chữ .68 ≈ 4,0–4,4:1, chữ "22 % mục tiêu" màu nhấn Hoàng hôn/Rừng 2,6:1 — ngoài phạm vi, đề xuất vòng sau).
- [14:58] `node tests/run.js`: **308/308 xanh** (291 cũ + 17 suite 50). `prepare-www.sh` (chạy thử ở /tmp): ✅ đủ file, có 4 file gói.
  `build-single-html.py ../FitKit-dung-thu.html --embed-shop` → 5,8 MB; mở bằng Playwright (context mới): 12 lựa chọn theme,
  5 gói áp đúng `--bg`, Espresso bật khúc xạ, 0 lỗi JS.
- **HOÀN TẤT.** Việc còn lại (ngoài phạm vi): 6 theme cũ còn lỗi tương phản/vùng chạm cũ (xem dòng 14:54); thử trên máy thật
  (khúc xạ Android WebView, hiệu năng blur máy yếu); Manrope cần mạng lần đầu.
- [12/11 · vòng accent] Slogan màn chào: line-height .82 + chữ IN HOA làm dính/cắt dấu chồng (Ậ Ế Ộ Ự), gói ép h1 300/tracking âm,
  chuỗi dự phòng có Arial Narrow → sửa (mục 8). Thêm `theme-accent.css/.js` (17 token × 15 theme, logo SVG nội tuyến đổi màu) và
  4 gói `ember`/`volt`/`violet`/`lime`. Suite 72 (8 test) + suite 50 nâng lên 9 gói — **toàn bộ suite xanh** (chạy từng `--only`).
  Playwright (context riêng "accent", 390 px): 15 theme × 3 màn → `_test/shots/accent-sheet-{welcome,home,workout}.jpg`,
  `window.__accent()` = 0 sai lệch CTA/pill/tab/toggle/logo so với token ở cả 45 lượt, 0 lỗi JS, 0 vùng chạm < 44 (nút menu màn chào
  40 → 44). AA: 9 gói 0 chữ < AA (cảnh báo duy nhất ở màn chào là chữ CTA nằm trên SVG — công cụ không đọc được nền, đã kiểm token
  5,3–17:1); 6 theme cũ còn lỗi cũ (nhãn ngày .58/.68, ghi ở 14:54). Bản dùng thử `../FitKit-dung-thu.html` đã build lại.

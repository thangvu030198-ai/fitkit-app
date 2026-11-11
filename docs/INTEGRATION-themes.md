# INTEGRATION — Giao diện & theme (themes + ui-kit + icon app)

## 1. File đã tạo / sửa

| File | Loại | Nội dung |
|---|---|---|
| `themes.css` | mới | Token 6 theme trên `:root[data-theme=…]`, lớp màu sinh tự động từ style.css (473 luật, chỉ bật khi `html.fk-themed`), vá màu trong `style=""`/SVG do JS sinh, theme Sáng + "đảo tối", CSS bộ chọn giao diện |
| `themes.js` | mới | Đọc/lưu `state.theme`, áp `data-theme` + class, đổi `<meta name="theme-color">`, StatusBar Capacitor, "Tự động" theo `prefers-color-scheme` (nghe đổi trực tiếp), thẻ **Giao diện** trong Hồ sơ |
| `ui-kit.css` / `ui-kit.js` | mới | Token bo góc/khoảng cách/cỡ chữ; `fkEmpty`, `fkSkeleton`, `fkError`, `fkLoad`; tự nâng cấp `.empty-hint`; ảnh lỗi → placeholder; chế độ máy yếu `html.lowfx`; lối tắt PWA `?go=` |
| `themes-modules.css` | mới (sinh) | Lớp màu theo theme cho CSS module (achievements, health-safety, pt-pro, training-pro — bản chụp lúc 11/11, **phải sinh lại khi tích hợp**) |
| `scripts/gen_themes_layer.py` | mới | Sinh lớp màu (`--write`), lớp module (`--modules`), bảng màu cứng (`--inventory`) |
| `scripts/gen_icons.py` | mới | Vẽ icon bằng Pillow |
| `assets/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png`, `icon-1024.png`, `shortcut-workout-96.png`, `shortcut-meal-96.png` | mới | Icon app (quả tạ mint trong vòng tiến độ coral, nền navy gradient) |
| `manifest.json` | **sửa (được phép)** | icon PNG 192/512/maskable/180, `theme_color`/`background_color` `#061A24`, `display: standalone`, `lang: vi`, `scope`, `id`, 2 shortcuts "Bắt đầu tập", "Ghi bữa ăn" |
| `docs/DESIGN-SYSTEM.md` | mới | Token, quy tắc component, bảng màu cứng → biến, **kế hoạch gộp style.css** |

Không sửa: index.html, style.css, app.js, pt.js, … (các thay đổi cần làm ghi ở mục 2).

## 2. Thay đổi cần làm ở file khác

### 2.1 `index.html` (thứ tự quan trọng)

```diff
 <meta name="theme-color" content="#061A24">
 <link rel="manifest" href="manifest.json">
+<link rel="icon" type="image/png" sizes="192x192" href="assets/icon-192.png">
+<link rel="apple-touch-icon" href="assets/apple-touch-icon-180.png">
 …
 <link rel="stylesheet" href="style.css">
+<link rel="stylesheet" href="themes.css">      <!-- NGAY sau style.css, TRƯỚC css module -->
+<link rel="stylesheet" href="ui-kit.css">
+<!-- … các css module: training-pro.css, pt-pro.css, achievements.css, health-safety.css … -->
+<link rel="stylesheet" href="themes-modules.css"> <!-- SAU CÙNG trong các stylesheet -->
+<script src="themes.js"></script>               <!-- trong <head>: áp theme trước khi vẽ → không nháy màu -->
 …
 <script src="pt.js"></script>
+<script src="ui-kit.js"></script>               <!-- ngay sau pt.js để module sau dùng được fkEmpty/fkError -->
+<!-- … script module khác … -->
```

`themes.js` cũng chạy được nếu đặt sau pt.js (tự móc vào `renderProfileScreen`), nhưng khi đó theme ≠ Mặc định có thể nháy màu navy ~1 khung hình lúc mở app.

Vì sao `themes.css` phải đứng ngay sau style.css: lớp màu sinh tự động dùng tiền tố `:where(html.fk-themed)` (độ ưu tiên 0) nên mỗi luật có **đúng độ ưu tiên như luật gốc**; nó thắng style.css nhờ đứng sau, và CSS module đứng sau nữa vẫn thắng như trước.

### 2.2 `scripts/prepare-www.sh`

```diff
-cp index.html style.css manifest.json sw.js icons.js … pt.js privacy-policy.html delete-account.html www/
+cp index.html style.css themes.css ui-kit.css themes-modules.css themes.js ui-kit.js manifest.json sw.js icons.js … pt.js privacy-policy.html delete-account.html www/
-mkdir -p www/assets && cp assets/bg-storm.jpg www/assets/
+mkdir -p www/assets && cp assets/bg-storm.jpg assets/icon-*.png assets/apple-touch-icon-180.png assets/shortcut-*.png www/assets/
```

### 2.3 `sw.js`

```diff
-const CACHE = "fitkit-v3";
-const ASSETS = ["./index.html","./style.css", …,"./manifest.json"];
+const CACHE = "fitkit-v4";
+const ASSETS = ["./index.html","./style.css","./themes.css","./ui-kit.css","./themes-modules.css","./themes.js","./ui-kit.js", …,"./manifest.json",
+  "./assets/bg-storm.jpg","./assets/icon-192.png","./assets/icon-512.png"];
```

### 2.4 Tuỳ chọn

- **Thanh trạng thái app native:** `npm i @capacitor/status-bar && npx cap sync` → `themes.js` tự gọi `StatusBar.setStyle/ setBackgroundColor` theo theme (không có plugin thì bỏ qua).
- **Icon app native/store:** dùng `assets/icon-1024.png` làm nguồn cho `@capacitor/assets` (`icon-only.png` cũ là logo FK đỏ của bản v1).
- **Dọn JS:** thay hex trong pt.js (`--c:#FF7A45`, `ringSVG(…,"#5EE6C7")`, `color:rgba(255,255,255,.72)`), nutrition.js (`MEAL_TINT`, `macro(… "#FF7A45")`), meals.js (`bodyAnalysis().color`) bằng `var(--coral)`/`var(--mint)`/`var(--text-muted)` → xoá các dòng vá tương ứng ở `themes.css` mục 3.
- `firestore.rules`: không đổi.

## 3. Dữ liệu & API

- `state.theme`: `"auto" | "navy" | "ocean" | "sunset" | "forest" | "midnight" | "light"` (mặc định `navy` = giao diện hiện tại). `state.fxMode`: `"auto" | "full" | "low"`.
- `<html data-theme="ocean" data-theme-pref="auto" class="fk-themed fk-dark">`; sự kiện `window` `fk:themechange` `{id, pref, prev}`.
- `fkTheme.list / pref() / current() / set(id) / apply() / resolve(pref)`.
- `fkFx.mode() / set(m) / active() / weak()` — `html.lowfx` tự bật khi `prefers-reduced-transparency: reduce`, hoặc (trừ iPhone/iPad — WebKit cố ý báo ít lõi) khi `hardwareConcurrency ≤ 4` / `deviceMemory ≤ 2`.
- `fkEmpty(icon, title, desc, {label, icon, onClick}, {small})`, `fkSkeleton(n, "list"|"card"|"grid")`, `fkError(msg, retryFn, {title, retryLabel, small})`, `fkLoad(el, asyncLoader, {render, empty:[icon,title,desc], skeleton, count})` — đều trả HTML (tự `escapeHtml` chữ).
- Ảnh: mọi `<img>` lỗi → placeholder gradient + icon theo ngữ cảnh (đồ ăn/người/tạ/ảnh), tôn trọng `onerror` của app (`remove`, `replaceWith`, `display:none`, đổi nguồn dự phòng). Tắt cho 1 ảnh: `data-no-fallback`.
- Module mới: dùng token (`docs/DESIGN-SYSTEM.md` §2), khối nằm trên ảnh thêm class `fk-dark-island`, rồi chạy `python3 scripts/gen_themes_layer.py --modules`.
- Lối tắt PWA: `index.html?go=workout` mở màn Tập luyện; `?go=meal` mở Dinh dưỡng + sheet "Thêm món" (đợi đăng nhập/onboarding xong).

## 4. Cách thử

```bash
# cú pháp
node -e "new Function(require('fs').readFileSync('themes.js','utf8'))"; node -e "new Function(require('fs').readFileSync('ui-kit.js','utf8'))"
# sinh lại lớp màu khi style.css / css module đổi
python3 scripts/gen_themes_layer.py --write && python3 scripts/gen_themes_layer.py --modules
# harness (ghép 1 file HTML, ảnh nội bộ nhúng base64)
cd _test/themes-harness
python3 build.py ../themes-test.html --preset preset.json --css themes.css,ui-kit.css --js themes.js,ui-kit.js --test t_theme.js
#   mở ../themes-test.html?t=light&s=nutrition   (t = theme, s = màn, y = cuộn, sheet=err|menu, fx=low)
#   trong console: __audit()  → đếm chữ dưới chuẩn AA trên màn đang mở
python3 build.py ../themes-func.html --preset preset.json --css themes.css,ui-kit.css --js themes.js,ui-kit.js --test t_func.js   # 25 kiểm thử chức năng
```

Đã chạy (Chromium qua Playwright, 400×860):
- **25/25** kiểm thử chức năng ở cả hệ điều hành sáng và tối (chọn theme, lưu state, meta theme-color, "Tự động" + đổi sáng/tối trực tiếp, hiệu ứng kính, fkEmpty/fkError/fkSkeleton/fkLoad, nâng cấp `.empty-hint`, 3 kiểu ảnh lỗi), lối tắt `?go=meal|workout`, `themes.js` đặt trong `<head>` (theme có trước khi vẽ body); 0 lỗi JS.
- Theme **Mặc định giống từng pixel** bản gốc (Trang chủ, Dinh dưỡng; khác duy nhất ở Hồ sơ là thẻ Giao diện mới).
- Chụp 6 theme × Trang chủ / Tập luyện / Dinh dưỡng: `_test/shots/sheet-home.jpg`, `sheet-workout.jpg`, `sheet-nutrition.jpg` (+ Hồ sơ, PT, Giấc ngủ, Nhắc nhở, Thư viện, sheet, UI kit: `sheet-b/c/d.jpg`).
- Độ tương phản (`__audit`): theme Sáng **0 lỗi AA** trên Trang chủ, Dinh dưỡng, Tập luyện, Hồ sơ, PT, Giấc ngủ, Nhắc nhở, sheet UI kit. Theme tối mới: chỉ còn nhãn ngày 9,5 px mà style.css đặt sẵn (lỗi chung với Mặc định — cần tăng cỡ chữ khi gộp style.css).

## 5. Giới hạn / việc còn lại

- `themes-modules.css` là bản chụp CSS module lúc 11/11 → **chạy lại `--modules` sau khi gộp các module** (nếu không, phần module chỉ đổi màu ở chỗ đã dùng biến).
- Màu viết trong JS được vá bằng bộ chọn thuộc tính (`[style*="--c:#FF7A45"]`, `[stroke="#5EE6C7"]`) — màu JS mới thêm sẽ không đổi theo theme cho tới khi dùng `var(--…)`.
- Theme Sáng giữ **tối** cho màn chào, hồ sơ PT, hero ảnh, thẻ nhóm cơ, video (chủ ý — chữ trắng trên ảnh).
- Theme Mặc định giữ nguyên tương phản cũ (nút coral chữ trắng 2,6:1; `--text-dim` .58) để không đổi nhận diện — xem đề xuất ở DESIGN-SYSTEM §2.1.
- Cần trình duyệt hỗ trợ `:where()`/`:is()` (Chrome/WebView 88+, iOS 14+); máy cũ hơn chỉ đổi được token, không lỗi.
- `prefers-reduced-transparency` mới có trên Safari/Chromium mới; còn lại dựa vào `hardwareConcurrency`/`deviceMemory` hoặc người dùng chọn "Giảm".
- Chưa thử trên điện thoại thật (StatusBar, icon maskable trên launcher Android, lối tắt PWA khi cài).

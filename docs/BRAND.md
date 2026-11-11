# TapEasy — Hướng dẫn thương hiệu (v1, 11/2026)

> Thay cho tên cũ **FIT KIT**. Nguồn logo: file chủ app gửi (`assets/brand/source/logo-original.jpg`). Mọi file logo/icon sinh lại được bằng `python3 scripts/gen_icons.py` (chỉ cần Pillow + numpy).

---

## 1. Tên và câu chuyện

**TapEasy** = "**Tập**" (viết không dấu) + "**Easy**" → *tập dễ dàng*. Đọc theo tiếng Anh còn là *tap* (chạm): mở app, chạm một lần là có buổi tập, có thực đơn.

| Đúng | Sai |
|---|---|
| TapEasy (một từ, T và E viết hoa) | Tap Easy · TAPEASY · Tapeasy · tapEasy · Tap-Easy · Táp Easy |

Trong câu văn, viết chữ thường đúng như trên. Khi cần nhấn bằng màu (giao diện), dùng `<b class="brand-name">Tap<span>Easy</span></b>`.

---

## 2. Logo

### 2.1 Cấu tạo

```
   ▌█  ━━━━  █▐        ← quả tạ: 2 đĩa mỗi bên (đĩa trong cao 104, đĩa ngoài 72) + thanh đòn TÁCH RỜI (khe 6 đơn vị)
         ●             ← chấm tròn: đầu người tập
      ⁄     ⁀          ← 2 nét cong vuốt nhọn: vai/cánh tay, đồng thời là "nụ cười" → nâng tạ mà vẫn vui
   TapEasy             ← "Tap" than + "Easy" teal
```

Ý nghĩa: người tập (chấm + 2 nét cong, giống chữ 人) đang nâng quả tạ nhẹ nhàng; thanh đòn không chạm đĩa tạ tạo cảm giác "nhẹ", hợp với *Easy*.

### 2.2 Vẽ lại vector (cách làm và độ khớp)

- **Biểu tượng** (`viewBox 0 0 200 134`): đo trên ảnh gốc bằng Pillow/numpy — 5 hình viên thuốc (rx = nửa bề rộng), chấm r = 11, nét cong là dải nằm trên cung tròn bán kính 102,1 (khớp bình phương tối thiểu, sai số bán kính < 0,3 px), dày 7 → 0 theo hàm mũ 0,65, đầu trên bo tròn.
- **Chữ** (`viewBox 0 0 770.2 180.6`, chữ hoa cao 141,9): **T, E, y** dựng lại bằng toạ độ đo trên logo; **a, p** dùng đường viền Poppins Bold (SIL OFL 1.1) đã khớp tỉ lệ từng chữ, rút ngắn chân chữ p cho giống gốc; **s** vector hoá trực tiếp từ ảnh gốc (đường viền ×8, làm mượt, khớp Bézier bậc 3). Tất cả đã chuyển thành `<path>` nên **không cần font** khi hiển thị.
- **Sửa nhẹ so với ảnh gốc:** chữ T và E cùng chiều cao chữ hoa (bản gốc T cao hơn E 4 px), hai chữ "a" giống hệt nhau, biểu tượng đặt theo trọng tâm mực của chữ (giống gốc, lệch trái ≈ 8 đơn vị so với tâm hộp bao — chủ ý, cân thị giác).
- **Đo độ khớp** (cùng tỉ lệ, chồng lên ảnh gốc 1168 × 784): IoU biểu tượng **0,90**, "Easy" + biểu tượng **0,92**, "Tap" **0,88**; |Δα| trung bình 0,023. Chênh lệch chủ yếu: mép JPEG mờ, lòng chữ a/p của Poppins hơi nhỏ hơn (đậm hơn ~5 %), T thấp hơn 1,8 px. Ảnh so sánh: `_test/brand-compare.png` (gốc · vector · chồng lớp).

### 2.3 Các phiên bản & file

| File | Dùng khi |
|---|---|
| `assets/brand/logo-mark.svg` | Biểu tượng teal trên nền sáng hoặc tối |
| `assets/brand/logo-mark-white.svg` | Biểu tượng trắng trên nền teal / ảnh tối |
| `assets/brand/logo-wordmark-light.svg` | Chữ trên **nền tối**: "Tap" ngà `#F5F7F3` + "Easy" teal |
| `assets/brand/logo-wordmark-dark.svg` | Chữ trên **nền sáng**: "Tap" than `#242D33` + "Easy" teal |
| `assets/brand/logo-lockup-light.svg` / `-dark.svg` | Biểu tượng trên + chữ dưới (giống logo gốc) — màn chào, splash, ảnh chia sẻ |
| `assets/brand/logo-horizontal-light.svg` / `-dark.svg` | Biểu tượng trái + chữ phải — thanh điều hướng web, chữ ký email |
| `assets/brand/logo-full.png` (1200 px, trong suốt) | **Bản gốc đã tách nền** — chỉ đặt trên nền **sáng** (chữ "Tap" màu than) |
| `assets/brand/logo-lockup-light-1200.png` / `-dark-1200.png` | Bản PNG của lockup vector (nơi không nhận SVG) |
| `assets/brand/logo-mark-512.png` | Biểu tượng PNG 512 (trong suốt) — ảnh đại diện, Firebase, schema.org |
| `assets/brand/icon-alt-dark-1024.png` | Icon phương án nền tối (để A/B test trên store, không dùng mặc định) |
| `assets/brand/source/` | Ảnh gốc + biểu tượng cắt từ ảnh gốc (tham chiếu, không dùng trực tiếp) |

### 2.4 Vùng an toàn

Đơn vị **X = chiều cao chữ hoa "T"** của logo (= 78,6 % chiều cao file wordmark).

- Quanh chữ / lockup: tối thiểu **0,5 X** mỗi phía, khuyến nghị **1 X**. Không đặt chữ, icon, mép màn hình trong vùng này.
- Quanh biểu tượng đứng riêng: tối thiểu **25 % bề rộng biểu tượng**.
- Khoảng cách biểu tượng ↔ chữ trong lockup là cố định (0,15 X dọc; 0,36 X ngang) — không tự kéo giãn.

### 2.5 Kích thước tối thiểu

| Phiên bản | Màn hình | In |
|---|---|---|
| Chữ (wordmark) | rộng **72 px** (chữ hoa ≈ 13 px); thanh trên app dùng cao 28 px | rộng 20 mm |
| Biểu tượng | cao **20 px**; dưới 32 px dùng bản nét dày (favicon, icon ≤ 96 px — `gen_icons.py` tự chọn) | cao 6 mm |
| Lockup xếp chồng | rộng **120 px** | rộng 30 mm |
| Lockup ngang | cao **20 px** | cao 6 mm |

---

## 3. Màu

| Vai trò | Tên | HEX | RGB | Token CSS | Tương phản |
|---|---|---|---|---|---|
| Màu chính (logo, mảng thương hiệu) | Teal TapEasy | **`#02BCB3`** | 2, 188, 179 | `--brand-teal` | 7,5:1 trên navy · 5,9:1 với than · 2,4:1 trên trắng (*chỉ dùng cho logo/mảng lớn trên nền trắng*) |
| Chữ "Tap", chữ trên nền sáng | Than | **`#242D33`** | 36, 45, 51 | `--ink` | 14:1 trên trắng |
| Chữ/dữ liệu trên nền tối (thay mint cũ) | Teal sáng | `#33D6C9` | 51, 214, 201 | `--brand-teal-bright` = `--mint` | 9,8:1 navy · 5,3:1 kính trắng 20 % · 4,6:1 kính đặc |
| Chữ nhạt trên nền tối | Teal nhạt | `#A3F0E8` | 163, 240, 232 | `--brand-teal-soft` = `--mint-2` | 13,7:1 navy |
| Chữ teal trên nền sáng | Teal đậm | `#00756F` | 0, 117, 111 | `--brand-teal-deep` (= `--mint` theme Sáng) | 5,6:1 trắng · 4,9:1 `#EDF2F5` |
| Chữ nhỏ trên nền sáng | Teal rất đậm | `#02625D` | 2, 98, 93 | `--brand-teal-ink` | 7,2:1 trắng |
| "Tap" trên nền tối | Ngà | `#F5F7F3` | 245, 247, 243 | `--brand-ivory` | 16,5:1 navy |
| Nền app | Navy | `#061A24` | 6, 26, 36 | `--navy` | — |
| Hành động chính (giữ từ FIT KIT) | Coral | `#FF7A45` | 255, 122, 69 | `--coral` | bổ trợ với teal (màu đối) |
| Nền icon / mảng thương hiệu | Gradient teal | `#1CCFC1 → #02A69E → #027A74` (135°) | | `--brand-gradient` | chữ/biểu tượng trắng ≥ 3:1 từ giữa xuống |

**Màu đo như thế nào:** trung vị điểm ảnh vùng lõi (đã co mặt nạ 7 px để bỏ viền khử răng cưa và nhiễu JPEG) — teal `RGB(2,188,179)` trên 32 482 điểm, than `RGB(36,45,51)` trên 20 156 điểm, nền `RGB(254,254,254)`. Teal của biểu tượng và của chữ "Easy" trùng nhau.

**Tỉ lệ dùng màu trong app:** navy 70 % · trắng/ngà 18 % · teal 8 % · coral 4 % (chỉ cho nút chính, calo, chuỗi ngày).

### Theme trong app (`brand.css`)

- **Mặc định**: navy giữ nguyên, `--mint` cũ `#5EE6C7` → teal sáng `#33D6C9`, `--mint-3` = teal logo. Coral giữ làm CTA.
- **Sáng**: `--mint` = teal đậm `#00756F` (AA), nền sáng nhuộm teal logo; các khối "đảo tối" vẫn dùng teal sáng.
- **Đại dương / Hoàng hôn / Rừng / Tím đêm**: giữ bảng màu riêng (người dùng tự chọn); chỉ nhận token `--brand-*`, logo vẫn màu teal.

---

## 4. Chữ (font)

| Dùng cho | Font | Ghi chú |
|---|---|---|
| Logo | **Không gõ lại bằng font** — luôn dùng file SVG/PNG | Wordmark là đường viền tuỳ biến (gốc Poppins Bold, OFL) |
| Tiêu đề trong app | Inter Tight 600–800 (`--font-head`) | giữ như design system |
| Nội dung trong app | Inter 400–600 (`--font-ui`) | ô nhập 16 px, chữ ≥ 12 px |
| Tiêu đề marketing (ảnh store, banner, video) | **Be Vietnam Pro** 700–800 | hình học, dấu tiếng Việt chuẩn (bộ Poppins dùng để dựng logo không có đủ dấu tiếng Việt) |
| Tên thương hiệu trong câu (`.brand-name`) | Poppins/Outfit → Inter Tight 700 | chỉ là chữ "TapEasy", không có dấu |

---

## 5. Icon app

**Chọn: nền gradient teal (`#1CCFC1 → #02A69E → #027A74`, chéo 135°, có quầng sáng mềm góc trên-trái) + biểu tượng trắng chiếm 62 % bề ngang.**

Vì sao không chọn nền than/navy với biểu tượng teal (bản `icon-alt-dark-1024.png`):

1. **Nhận diện trên màn hình chính:** phần lớn app gym (và app cũ FIT KIT) là icon tối; teal sáng nổi bật giữa các icon tối, và teal là màu duy nhất của logo → người dùng nhớ màu = nhớ app.
2. **Đúng tinh thần "Easy":** nền sáng, mát, thân thiện; nền tối gợi phòng tập nặng nề.
3. **Đọc được:** biểu tượng trắng đạt ≥ 3:1 trên phần giữa–dưới gradient (vùng biểu tượng đặt), đủ cho đồ hoạ theo WCAG 1.4.11.
4. **Đồng bộ với app:** giao diện app là navy tối, nên icon teal mở ra "cửa" thương hiệu, còn splash tối nối liền vào app không bị chớp trắng.

| File | Kích thước | Ghi chú |
|---|---|---|
| `assets/icon-192.png`, `icon-512.png` | 192, 512 | PWA *any*, bo góc 22,4 % |
| `assets/icon-maskable-512.png` | 512 | tràn viền; biểu tượng 56 % → nằm gọn trong vòng an toàn 80 % |
| `assets/apple-touch-icon-180.png` | 180 | vuông kín, không alpha (iOS tự bo) |
| `assets/icon-1024.png`, `icon-only.png` | 1024 | App Store / nguồn `@capacitor/assets`, không alpha |
| `assets/icon-foreground.png` + `icon-background.png` | 1024 | icon thích ứng Android (biểu tượng 46 % ≤ vùng an toàn 66/108) |
| `assets/splash.png` / `splash-dark.png` | 2732 | lockup rộng 860 px giữa màn (≈ 68 % bề ngang khi cắt màn dọc); sáng: nền `#F7FBFA`; tối: navy + quầng teal |
| `assets/favicon.svg`, `favicon-32.png`, `favicon-16.png`, `favicon.ico` | 64/32/16/48 | bản nét dày, biểu tượng lớn hơn (74–86 %) |
| `assets/shortcut-workout-96.png`, `shortcut-meal-96.png` | 96 | lối tắt PWA: đĩa teal + quả tạ / bát cơm và đôi đũa |
| `assets/og-tapeasy.jpg` | 1200 × 630 | ảnh chia sẻ mạng xã hội (thay `og-fitkit.jpg`) |

Workflow `build-android.yml`, `build-ios.yml`, `ios-appstore.yml` chạy `npm run assets` → `@capacitor/assets` đọc **đúng các tên** `icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png` trong `assets/` — đã giữ nguyên tên.

---

## 6. Giọng điệu

**Thân thiện · Dễ hiểu · Khích lệ · Đáng tin.** Như một người bạn đã tập lâu năm: nói ngắn, chỉ việc cụ thể, không doạ, không khoe.

| Nên | Tránh |
|---|---|
| Xưng "bạn", câu ngắn, động từ trước: "Bấm **Bắt đầu tập**, app lo phần còn lại." | Thuật ngữ không giải thích, câu bị động dài |
| Khen nỗ lực: "Thêm 2,5 kg rồi. Bạn đang tiến bộ thật!" | Chê ngoại hình, so sánh cơ thể, "body chuẩn" |
| Nói rõ con số và lý do: "Nghỉ 90 giây để hiệp sau đủ sức." | Hứa hẹn y khoa: "chữa", "điều trị", "giảm 10 kg/tháng" |
| Nhẹ nhàng khi lỡ buổi: "Hôm qua bận à? Hôm nay tập 20 phút thôi cũng được." | Gây tội lỗi: "Bạn lại bỏ tập!" |
| Emoji tiết chế (tối đa 1, cuối câu) ở thông báo đẩy | Emoji cờ, chuỗi emoji, viết HOA cả câu |

Từ khoá thương hiệu: *dễ dàng, nhẹ nhàng, mỗi ngày, một chạm, tiến bộ, đúng cách, món Việt.*

---

## 7. Cách dùng sai cần tránh

1. Đổi màu logo ngoài các phiên bản ở mục 2.3 (ví dụ "Tap" teal + "Easy" than, logo coral, gradient lên chữ).
2. Kéo giãn / bóp méo, xoay, nghiêng, đổi khoảng cách chữ hoặc khoảng cách biểu tượng ↔ chữ.
3. Gõ lại "TapEasy" bằng font bất kỳ thay cho file logo.
4. Thêm bóng đổ, viền, phát sáng, hiệu ứng 3D, kính mờ lên logo.
5. Đặt `logo-full.png` / bản `-dark` (chữ than) trên nền tối, hoặc bản `-light` (chữ ngà) trên nền sáng.
6. Đặt logo trực tiếp trên ảnh/video rối mà không có lớp phủ tối ≥ 60 % (`--fk-scrim-rgb`).
7. Bỏ chấm tròn hoặc 2 nét cong khỏi biểu tượng (trừ favicon ≤ 16 px và icon lối tắt "Tập luyện" — đã có bản rút gọn chính thức).
8. Đóng khung logo trong hình tròn/ô vuông tự chế (icon app đã có khung chuẩn).
9. Ghép logo với tên/biểu tượng cũ FIT KIT trên cùng một ấn phẩm (trừ dòng "tên mới của FIT KIT" trong giai đoạn chuyển đổi).

---

## 8. Khẩu hiệu đề xuất

| # | Khẩu hiệu | Dùng ở |
|---|---|---|
| **1 (chính)** | **Tập dễ dàng. Tiến bộ mỗi ngày.** | ảnh chia sẻ, splash marketing, mô tả store |
| 2 | Tập dễ dàng. Ăn đúng. Tiến bộ thật. | tiêu đề landing, ảnh store số 1 |
| 3 | Chạm là tập. | quảng cáo ngắn, TikTok (chơi chữ *tap* = chạm) |
| 4 | Gym dễ hơn bạn nghĩ. | người mới tập |
| 5 | Mỗi ngày một chạm, khoẻ hơn từng tuần. | thông báo đẩy, email |
| 6 | Có PT bên cạnh, tập dễ dàng hơn. | khu PT ↔ học viên |

---

## 9. Ghi chú tích hợp (cho agent / dev)

- **CSS:** `<link rel="stylesheet" href="brand.css">` sau themes.css + CSS module, trước themes-modules.css. Lớp: `.brand-logo` (28 px; `--md` 40, `--lg` 56, `--xl` 72, `--hero` 56–72), `.brand-mark` (tô bằng `mask` → đổi màu qua `--brand-mark-color`; cần phục vụ qua http/https/capacitor — `mask` **không chạy với `file://`**), `.brand-lockup`, `.brand-name`, ép bản màu `--on-dark` / `--on-light`. `<img>` cũng nhận các lớp kích thước này.
- **Theme Mặc định trọn màu teal:** style.css còn ~50 mã mint cứng (`#5EE6C7`, `rgba(94,230,199,…)`). Chúng chỉ đổi theo biến khi `<html>` có lớp `fk-themed`. Đề xuất sửa 1 dòng `themes.js`: `root.classList.toggle("fk-themed", true)` (lớp màu sinh tự động giữ đúng độ ưu tiên nên giao diện không vỡ), và đổi ô màu mẫu theme navy thành `sw:["#061A24","#33D6C9","#FF7A45"]`, mô tả "Navy · Teal · Coral".
- **Logo trên nền tối dùng bản `-light`:** `logo-full.png` có chữ "Tap" màu than → **không** dùng trên màn chờ/đăng nhập nền navy; thay bằng `assets/brand/logo-lockup-light.svg`.
- **`scripts/prepare-www.sh`:** cần chép `assets/brand/*.svg`, `assets/brand/logo-full.png`, `assets/favicon*`, `assets/icon-*.png`, `assets/apple-touch-icon-180.png`, `assets/shortcut-*.png`, `assets/og-tapeasy.jpg` vào `www/assets/` (chính sách bảo mật / xoá tài khoản cũng hiển thị logo).
- **index.html `<head>`:** thêm `<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">` + `<link rel="icon" href="assets/favicon-32.png" sizes="32x32">`; `theme-color` giữ `#061A24`.
- **capacitor.config.json** (ngoài phạm vi agent thương hiệu, chỉ đã đổi `appName`): nên đổi `backgroundColor` `#0a0a0a` → `#061A24` (khớp splash tối) và `LocalNotifications.iconColor` `#FF3100` → `#02BCB3`. `appId` giữ nguyên.
- **Không đổi:** appId/package `vn.thangvu.fitkit`, tên repo/URL `fitkit-app`, khoá `localStorage` `fitkit_state_v1`, tên cache `fitkit-v*` — đều là định danh kỹ thuật, đổi sẽ mất dữ liệu/người dùng cũ.
- `assets/og-fitkit.jpg` không còn được tham chiếu (landing dùng `og-tapeasy.jpg`) — có thể xoá.

# FIT KIT — Design System (v1, 11/2026)

Tài liệu này là "nguồn chuẩn" cho màu, bo góc, khoảng cách, cỡ chữ và quy tắc component. Mọi CSS mới (kể cả của các module) phải dùng **token** dưới đây, không viết mã màu cứng.

File liên quan: `themes.css` (token màu 6 theme + lớp màu sinh tự động), `ui-kit.css` (token cấu trúc + trạng thái rỗng/tải/lỗi), `scripts/gen_themes_layer.py` (sinh lớp màu, in bảng màu cứng).

---

## 1. Nguyên tắc

1. **Ba tông, ba vai trò.** Nền tối (navy) · **Mint** = dữ liệu, tiến độ, trạng thái tốt, lựa chọn đang chọn, liên kết · **Coral** = hành động chính (CTA), năng lượng (calo, chuỗi ngày), cảnh báo. Trắng chỉ là màu trung tính cho chữ và kính.
2. **Kính có chủ đích.** `backdrop-filter` chỉ dùng cho: thanh dưới (dock), sheet, nút tròn trên thanh trên. Thẻ trong danh sách dùng kính *không blur* khi máy yếu (`html.lowfx`).
3. **Đọc được trước, đẹp sau.** Chữ ≥ 12 px, tương phản AA (4,5:1 chữ thường, 3:1 chữ ≥ 18,66 px đậm và icon), vùng chạm ≥ 44 px, ô nhập 16 px.
4. **Theme bằng biến.** Một component không biết mình đang ở theme nào; nó chỉ dùng `var(--mint)`, `rgba(var(--mint-rgb), .16)`, `var(--fk-ink)`…

---

## 2. Token màu

### 2.1 Bảng màu theo theme

| Token | Mặc định `navy` | Đại dương `ocean` | Hoàng hôn `sunset` | Rừng `forest` | Tím đêm `midnight` | Sáng `light` |
|---|---|---|---|---|---|---|
| `--navy` (nền) | `#061A24` | `#03142B` | `#1A0C1C` | `#071A12` | `#0E0A26` | `#0D2230` (mực in, nền là `--bg #EDF2F5`) |
| `--navy-2` / `-3` / `-4` | `#0B2A33` `#114650` `#1B6A68` | `#08254A` `#0E3A6B` `#155E96` | `#2A1430` `#45203F` `#6E2F4F` | `#0D2A1D` `#16402C` `#23603F` | `#1A1342` `#2B1F63` `#44308F` | `#133447` `#1B4A5E` `#1F6B6A` |
| `--mint` (dữ liệu) | `#5EE6C7` | `#4CC9F0` cyan | `#FFC46B` nắng | `#8BE07A` lá non | `#B49CFF` oải hương | `#0A7360` |
| `--mint-2` (chữ/nhạt) | `#9AF1DD` | `#A6E6FA` | `#FFE0AE` | `#C4F2B8` | `#DCD0FF` | `#08624F` |
| `--mint-3` (đậm) | `#2FB99A` | `#1E9BC6` | `#E89B35` | `#57B347` | `#8B6CF0` | `#0D8C73` |
| `--coral` (CTA) | `#FF7A45` | `#FFB547` cát | `#FF5C8A` hồng | `#FF6B6B` quả mọng | `#4FE3D6` ngọc | `#B83D0B` |
| `--coral-2` (chữ/nhạt) | `#FFB08A` | `#FFD596` | `#FFB8CB` | `#FFC2B8` | `#A8F3EC` | `#A9390B` |
| `--coral-3` / `-4` | `#E0582A` `#FF9466` | `#E08E1B` `#FFC870` | `#D93A68` `#FF7FA3` | `#E04848` `#FF8F80` | `#22BFB2` `#7FEDE3` | `#9A3412` `#D24E16` |
| `--coral-hot` (vượt mức) | `#FF5A2E` | `#FF7A3D` | `#FF3B5C` | `#FF4D4D` | `#FF6B9A` | `#B91C1C` |
| `--on-mint` (chữ trên mint) | `#061A24` | `#03142B` | `#1A0C1C` | `#071A12` | `#0E0A26` | `#fff` |
| `--on-coral` (chữ trên CTA) | `#061A24` 6,9:1 | `#2A1600` 9,9:1 | `#1A0C1C` 6,4:1 | `#1F0707` 6,9:1 | `#0E0A26` 12:1 | `#fff` 5,7:1 |
| `<meta theme-color>` | `#061A24` | `#03142B` | `#1A0C1C` | `#071A12` | `#0E0A26` | `#EDF2F5` |

Theme Mặc định: chữ trên nút coral `--on-coral: #061A24` (navy) — **6,9:1**, đạt AA cho mọi cỡ chữ (QU-28, `themes.css:20`; trước đây chữ trắng chỉ 2,6:1). Chữ/icon trên nền `--coral` luôn dùng `var(--on-coral)`, không viết `#fff`. 5 gói giao diện: xem `theme-packs.css` (≥ 4,5:1, test `66-fix-ux` "QU-28").

### 2.2 Token ngữ nghĩa (`--fk-*`, định nghĩa trong `themes.css`)

| Token | Ý nghĩa | Tối | Sáng |
|---|---|---|---|
| `--fk-ink` / `--fk-ink-rgb` | màu chữ chính | `#fff` | `#0D2230` |
| `--text` / `--text-muted` / `--text-dim` | chữ chính / phụ / mờ | trắng α 1 / .78 / .58 (theme mới .68) | navy α 1 / .76 / .70 |
| `--fk-ov-rgb` + `--fk-ov-k` | lớp phủ bề mặt (chip, ô nhập) | trắng × 1 | navy × 0,5 |
| `--fk-line-k` | hệ số viền | 1 | 0,75 |
| `--fk-text-boost` | nâng alpha chữ mờ | 0 | 0,25 |
| `--fk-veil-rgb` | màn mờ theo màu nền (thanh trên, ô nhập bảng hiệp) | = navy | `237,242,245` |
| `--fk-scrim-rgb` | màn tối trên ảnh/video — **luôn tối** | = navy | `6,26,36` |
| `--glass` / `--glass-solid` | kính thẻ / kính "đặc" khi `.lowfx` | trắng α .16–.20 | trắng α .80–.90 |
| `--fk-dock-bg`, `--fk-chip-bg` | dock dưới, nút tròn | | |
| `--fk-sheet-1-rgb`, `--fk-sheet-2-rgb` | gradient sheet | | |
| `--fk-toast-rgb`, `--fk-toast-ink`, `--fk-toast-accent` | toast (đảo màu ở theme sáng) | | |
| `--fk-shell-bg`, `--fk-shell-blend` | nền app (ảnh bão nhuộm màu theme bằng `luminosity`) | | gradient sáng, không ảnh |
| `--mint-rgb`, `--coral-rgb`, `--coral-2-rgb`, `--navy-rgb` | để viết `rgba(var(--mint-rgb), .16)` | | |

**Cách viết màu đúng:** `color: var(--mint-2)` · `background: rgba(var(--coral-rgb), .14)` · `border: 1px solid rgba(var(--fk-ov-rgb), calc(.16 * var(--fk-line-k)))` · chữ trên nút coral: `color: var(--on-coral)`.

### 2.3 "Đảo tối" ở theme Sáng

Phần tử nằm trên ảnh/video hoặc trang thương hiệu giữ giao diện tối: `.hero`, thanh trên trong suốt của màn Tập luyện, `.mg-card`, `.wl` (màn chào), `#screen-ptprofile`, `.vplayer`, `.clip-thumb`, `.vthumb`, `.vp-item`, `.ld-media`. Module mới có khối nằm trên ảnh → thêm class **`fk-dark-island`**.

### 2.4 Bảng màu cứng trong `style.css` → biến

Sinh bằng `python3 scripts/gen_themes_layer.py --inventory` (số dòng là dòng khai báo):

| Màu cứng | Số lần | Dòng trong style.css (đầu tiên) | Map sang |
|---|---|---|---|
| `rgba(255,255,255,·)` | 130 | 14, 15, 132, 542, 635, 646, 653 … (+93) | chữ → `rgba(var(--fk-ink-rgb), a + (1-a)·boost)`; nền → `rgba(var(--fk-ov-rgb), a·k)`; viền → `a·--fk-line-k` |
| `#fff` / `white` | 111 | 19, 141, 189, 193, 220, 237 … (+105) | chữ → `var(--fk-ink)`; chữ trên coral → `var(--on-coral)`; nền trắng đặc (chip ảnh, nút Google) giữ nguyên |
| `rgba(255,122,69,·)` | 52 | 190, 217, 312, 345, 365, 501 … (+46) | `rgba(var(--coral-rgb), a)` |
| `rgba(6,26,36,·)` | 34 | 670, 742, 986, 1017, 1031, 1071 … (+28) | trên ảnh/video → `--fk-scrim-rgb`; còn lại → `--fk-veil-rgb` |
| `rgba(94,230,199,·)` | 32 | 540, 541, 635, 746, 919 … (+27) | `rgba(var(--mint-rgb), a)` |
| `#061A24` | 30 | 10, 196, 203, 631, 635, 735 … (+24) | nền → `var(--navy)`; chữ → `var(--on-mint)` |
| `#5EE6C7` | 11 | 22, 631, 737, 798, 823, 1120 … | `var(--mint)` |
| `#9AF1DD` | 10 | 540, 561, 824, 921, 924 … | `var(--mint-2)` |
| `#FF7A45` | 8 | 16, 861, 1104, 1121, 1358 … | `var(--coral)` |
| `#0B2A33` | 8 | 588, 606, 740, 793, 849, 861, 937 | `var(--navy-2)` |
| `#FFB08A` | 6 | 18, 23, 494, 861, 1121, 1424 | `var(--coral-2)` |
| `rgba(255,176,138,·)` | 4 | 205, 505, 543, 603 | `rgba(var(--coral-2-rgb), a)` |
| `#FF9466` | 3 | 188, 219, 886 | `var(--coral-4)` |
| `#FF5A2E` | 3 | 868, 876, 886 | `var(--coral-hot)` |
| `#1B6A68` / `#114650` / `#0E3038` / `#1C4A52` | 3/2/1/2 | 793, 809, 937, 942, 1180, 1199 | `--navy-4` / `--navy-3` / `--navy-2` / `--navy-3` |
| `#E0582A` / `#2FB99A` | 2/2 | 17, 924, 1121 | `--coral-3` / `--mint-3` |
| `#D6ECEA` `#B0B8BC` `#6B7A80` | 2/2/1 | 795, 816, 820, 831, 835 | `rgba(var(--fk-ink-rgb), .84 / .72 / .5)` |
| `rgba(6,6,6)` `(8,8,8)` `(10,10,10)` `(12,12,12)` `(20,20,30)` `(2,10,16)` | 16 | 111, 146, 329, 489, 589, 607, 698, 704, 1061 | `rgba(var(--fk-scrim-rgb), a)` (tông đen của bản v1) |
| `rgba(34,52,62)` / `rgba(14,28,36)` | 1/1 | 1062 | `--fk-sheet-1-rgb` / `--fk-sheet-2-rgb` |
| `#000`, `rgba(0,0,0,·)`, `#111`, `#1F1F1F`, `#DADCE0`, `#1877F2`, `#9AA4AE` | 30 | 27, 74, 91, 440, 1213, 1269, 1340, 1341, 1435 … | giữ nguyên (nền video, bóng đổ, màu thương hiệu Google/Facebook, đĩa tạ) |
| `#161616 #1E1E1E #262626 #A8A4A4 #6F6B6B #050505 #101010 #0C0C0C #04210F #222` | 10 | 11–21, 36, 92, 293, 525, 897 | xám của bản v1 — đã bị `:root` dòng 965–980 ghi đè, xoá khi gộp |

Màu trong `style=""`/thuộc tính SVG do JS sinh ra (pt.js `--c:#FF7A45`, `ringSVG(…,"#5EE6C7")`, nutrition.js `--tint`, nền thanh macro, index.html `#water-fill`) được `themes.css` mục 3 ghi đè bằng bộ chọn thuộc tính. **Khi sửa JS, thay hex bằng `var(--coral)`/`var(--mint)`** rồi xoá các dòng vá đó.

---

## 3. Bo góc · Khoảng cách · Chữ (token trong `ui-kit.css`)

| Nhóm | Token | Giá trị | Dùng cho |
|---|---|---|---|
| Bo góc | `--fk-r-1` | 10 px | chip nhỏ, ảnh thumb, nút `btn-sm` |
| | `--fk-r-2` | 16 px | ô nhập, list-item, nút lớn, tile |
| | `--fk-r-3` | 22 px | thẻ (`.card`, `.nu-meal`), trạng thái rỗng |
| | `--fk-r-4` | 28 px | sheet, hero bo góc, dock |
| | `--fk-r-pill` | 999 px | pill, nút tròn dài |
| Khoảng cách | `--fk-s-1…5` | 4 · 8 · 12 · 16 · 24 px | gap/padding/margin chỉ lấy các bậc này |
| Cỡ chữ | `--fk-fs-1` | 12 px | chú thích, nhãn nhỏ nhất (sàn) |
| | `--fk-fs-2` | 13 px | chữ phụ, meta |
| | `--fk-fs-3` | 15 px | chữ thân, tên mục |
| | `--fk-fs-4` | 17 px | tiêu đề nhóm (`.section-title h3`) |
| | `--fk-fs-5` | 22 px | tiêu đề màn / sheet |
| | `--fk-fs-6` | 28 px | số lớn, lời chào |
| Vùng chạm | `--fk-tap` | 44 px | mọi nút/ô bấm |

Hiện trạng cần quy về token: bo góc đang có 19 giá trị (14 px ×18, 12 px ×18, 6 px ×13, 20/18/26/24/36…); cỡ chữ 30 giá trị, **67 chỗ < 12 px** (dòng 151, 198, 213, 220, 253, 262, 272, 297, 311, 338, 351, 360, 458, 464, 475, 505, 512, 518, 531, 539, 546, 562, 564, 573, 574, 594, 597, 600, 614, 619, 623, 729, 878, 879, 888, 899, 902, 905, 914, 915, 932, 940, 947, 958, 1001, 1214, 1221, 1230, 1249, 1255, 1263, 1264, 1280, 1281, 1293, 1298, 1309, 1314, 1316, 1323, 1355, 1356, 1365, 1379, 1383, 1403, 1446). Quy đổi: 8,5–11,5 px → 12 px; 12,5–13,5 → 13; 14–16 → 15; 18–20 → 17; 22–26 → 22; ≥ 28 giữ (số liệu hiển thị lớn).

---

## 4. Quy tắc component

| Component | Quy tắc |
|---|---|
| **Thẻ** `.card` | nền `var(--glass)`, viền 1 px `rgba(var(--fk-ov-rgb), calc(.14*var(--fk-line-k)))`, bo `--fk-r-3`, padding `--fk-s-4`. Tiêu đề `.card-title` 14 px/600 + icon 18 px màu `--mint`. Không lồng thẻ trong thẻ (dùng `.list-item`/`.link-row`). |
| **Nút** | `.btn-primary` (1 nút/vùng, nền `--coral`, chữ `--on-coral`) · `.btn-outline` (hành động phụ) · `.btn-ghost` (huỷ/đặt lại) · `.btn-soft` (nhấn nhẹ). Chiều cao ≥ 44 px, chữ 14–15 px/600, icon 18 px cách chữ 8 px. |
| **Pill / chip** | `.pill` cao ≥ 32 px (khi là nút lọc thì ≥ 44 px gồm vùng đệm), `.pill.active` = nền `--mint`, chữ `--on-mint`. |
| **Ô nhập** | `.field` > label 12–13 px + input 16 px, cao ≥ 44 px, `min`/`max` cho ô số. Focus: viền `--mint` (không chỉ đổi nền). |
| **Danh sách** | `.list-item` bo `--fk-r-2`, thumb 56 px bo `--fk-r-1`, toàn hàng bấm được → `role="button"`/`<button>`. |
| **Sheet** | `openSheet()` — tiêu đề `h3` 19–22 px + nút đóng `.icon-btn` có `aria-label="Đóng"`; nội dung cuộn trong sheet, nút chính ở cuối. Nên thêm `role="dialog" aria-modal="true"` cho `#sheet-content`. |
| **Trạng thái rỗng** | `fkEmpty(icon, tiêu đề, mô tả, {label, icon, onClick})`: icon tròn 56 px nền mint α .14, tiêu đề 15 px/600, mô tả 13 px ≤ 2 dòng, tối đa 1 CTA. Biến thể `.sm` cho chỗ hẹp. `.empty-hint` cũ được tự nâng cấp. |
| **Đang tải** | `fkSkeleton(n, "list"|"card"|"grid")` — giữ đúng bố cục nội dung thật, shimmer 1,25 s, tắt khi `prefers-reduced-motion`; có `aria-busy` + chữ ẩn "Đang tải…". Không dùng spinner cho danh sách. |
| **Lỗi** | `fkError(msg, retry)` — viền coral, icon `error_outline`/`wifi_off` (tự nhận biết mất mạng), nút "Thử lại" dạng outline. Thông điệp nói *chuyện gì xảy ra + làm gì tiếp*, không in mã lỗi kỹ thuật. Tiện ích `fkLoad(el, loader, {render, empty})` gói đủ 3 trạng thái. |
| **Ảnh** | luôn có `alt`; ảnh lỗi tự thành placeholder gradient + icon (đồ ăn / người / tạ / ảnh) theo theme. Muốn tắt: `data-no-fallback`. |
| **Toast** | ≤ 1 dòng, icon trạng thái; theme sáng tự đảo nền tối. |
| **Chuyển động** | vào màn 0,6–0,9 s `--e-out`; tương tác ≤ 0,25 s; mọi animation tôn trọng `prefers-reduced-motion`. |
| **Kính mờ** | Giữ blur cho: dock dưới, sheet, nền sheet, nút tròn thanh trên. Trong danh sách: `html.lowfx` (tự bật khi `prefers-reduced-transparency`, hoặc trên máy không phải iPhone/iPad có `hardwareConcurrency ≤ 4` / `deviceMemory ≤ 2`) thay bằng `--glass-solid`. Người dùng chỉnh ở Hồ sơ → Giao diện → Hiệu ứng kính mờ. |

**CSS của module:** dùng token; khối trên ảnh thêm `fk-dark-island`; không dùng `!important` trừ khi phải thắng các luật kính `!important` cũ của style.css (xem kế hoạch gộp). Sau khi thêm/sửa CSS module có màu cứng, chạy `python3 scripts/gen_themes_layer.py --modules` để cập nhật `themes-modules.css`.

---

## 5. Kế hoạch gộp `style.css` (KHÔNG làm trong đợt này)

### 5.1 Hiện trạng (1 448 dòng, 105 KB)

`style.css` là 8 lớp nối tiếp, lớp sau ghi đè lớp trước:

| Lớp | Dòng | Nội dung |
|---|---|---|
| A. v1 "Obsidian Kinetic" | 1–476 | token v1 (xám #161616…), Oswald/Hanken, mọi component cơ bản |
| B. v2 PT/Home | 477–626 | đăng nhập, trang chủ, PT, chat, tiến độ |
| C. Hồ sơ PT | 627–731 | trang hồ sơ PT (hero thể thao) |
| D. Màn chào | 732–857 | landing 3 phần |
| E. Dinh dưỡng v2 | 858–960 | đồng hồ calo, bữa ăn, công thức |
| F. Liquid glass v2.2 | 961–1110 | **ghi đè lại** token + gần như mọi component của A/B/E bằng kính, 30+ `!important` |
| G. Bảng 3 tông v2.3 | 1111–1210 | **ghi đè lần 3** màu của A/B/E/F bằng navy/mint/coral |
| H. Bổ sung theo tính năng | 1211–1448 | video, thư viện, giáo án, dinh dưỡng v3, bảng hiệp, vá vòng 2 |

Số liệu: **159 selector** được khai báo ≥ 2 lần với thuộc tính chồng nhau; 46 `!important`; 17 dòng `backdrop-filter`; 4 khối `:root`; `@keyframes spin` khai báo 2 lần (380, 487); 4 khối `prefers-reduced-motion` (723, 856, 1099, 1395); font Oswald ở 16 dòng (5, 50, 116, 170, 181, 234, 261, 271, 485, 511, 533, 536, 537, 551, 593, 737) + Hanken/Be Vietnam/Barlow (38, 631, 737) dù UI đã dùng Inter.

### 5.2 Các khối trùng / xung đột chính (số dòng)

| Nhóm | Dòng khai báo (cái sau thắng) | Ghi chú gộp |
|---|---|---|
| Token `:root` | 9–30 → 965–980 → 1118–1125 → 1448 (`--text-dim`) | gộp 1 khối; bỏ xám v1; `--radius-lg` 24 → `--fk-r-3` 22 |
| `html, body` nền/font | 34–40 → 981 → 1126 | 1 luật: `background:var(--bg); font-family:var(--font-ui)` |
| `#app-shell` nền | 67–78 → 579 → 982–984 (+ `::before` 985) | gom về `background:var(--fk-shell-bg)` |
| Tiêu đề `h1–h4,.headline` | 49–55 → 995 | bỏ Oswald/uppercase v1 |
| `.topbar` / `.logo` | 106–121 → 996, 1031 | 1031 có `!important` + bỏ blur |
| `.icon-btn` | 127–132 → 548–550 → 1032–1033 | |
| `.hero` + `::before` | 135–156 → 588–589 → 1070–1071 | 3 gradient khác nhau, chỉ 1071 còn hiệu lực |
| `.card` / `.card-title` + icon | 162–174 → 998, 1009–1016, 1024–1027 → 1109 → 1164 | màu icon đổi 3 lần |
| `.btn*` | 177–207 → 1000, 1044–1048 → 1129–1131 | `.btn-primary` 3 lần, 2 lần `!important` |
| `.pill`, `.pill.active` | 210–217 → 1049–1050 → 1144 | |
| `.badge-pro` | 218–223 → 1105 | |
| `.day-tab(s)` | 226–241 → 1055–1056 → 1148 | |
| `.progress-*`, `.ring-*` | 244–262 → 1057–1058 → 1143 | |
| `.stat-box`, `.list-item`, `.plan-card`, `.metric`, `.entry-tile`, `.wd`, `.seg`, `.role-card`, `.date-chip`, `.streak-chip`, `.quick-row button`, `.nu-*card`, `.pp-card` | khai báo gốc ở A/B/C/E → **ghi đè đồng loạt bằng 1 nhóm `!important` dòng 1009–1015** | tách thành class nền chung `.glass` + biến; bỏ `!important` |
| Form `.field input`, `.search-box`, `.fb-input`, `.join-input`, `.chat-input textarea` | 298–302, 384–388, 537, 552, 566 → 1051–1054 (`!important`) | 1 luật ô nhập chung |
| `.choice-card(.selected)` | 307–312 → 1066–1067 → 1147 | |
| `.toggle.on`, `.list-item .check.checked` | 322, 293 → 1153–1154 | |
| `.bottom-nav`, `.nav-item(.active)` | 326–348 → 580 → 990 → 1034–1041 → 1134–1135 | 5 nơi |
| `.sheet`, `.sheet-backdrop`, `#toast`, `#onboarding` | 368–378, 422–445 → 1061–1065 | |
| `.section-title a`, `.small-note` | 458, 464 → 1102–1103 → 1149 | `!important` 2 lần |
| `.seg button.active (i.cnt)`, `.avatar-ini`, `i.cnt` | 528–534 → 1106–1108 → 1137, 1145–1146, 1167 | |
| `.st-*`, `.soon-badge`, `.join-code`, `.bubble.*`, `.wk .bar` | 505, 536, 540–543, 559–561, 572 → 1155–1166 | |
| `.home-hero(::before)`, `.wd.today`, `.date-chip b` | 604–607 → 1017–1021 → 1152, 1168 | |
| Hồ sơ PT `#screen-ptprofile`, `.pp-bg/.pp-logo/.pp-ring/.pp-mono` | 631–682 → 992 → 1184–1192 | |
| Màn chào `.wl-*` | 735–849 → 1193–1209 | 17 luật chỉ đổi màu |
| Dinh dưỡng `.nu`, `.nu-*` | 861–959 → 1074–1077 → 1171–1181 → 1347–1390 → 1446 | `--card` đổi 2 lần |
| Bảng hiệp `.set-*` | 1398–1416 → 1424–1438 → 1443–1445 | |
| `@keyframes spin` | 380, 487 | xoá 1 |
| reduced-motion | 723, 856, 1099, 1395 | gộp 1 khối cuối file |

### 5.3 Thứ tự gộp đề xuất (mỗi bước 1 commit, chụp so sánh trước/sau)

1. **Đóng băng & đo:** dùng harness `_test/themes-harness/build.py` + Playwright chụp 6 màn × theme Mặc định làm ảnh chuẩn; chạy `gen_themes_layer.py --inventory` lưu bảng màu.
2. **Token trước:** gộp 4 khối `:root` thành 1 ở đầu file (giá trị cuối cùng hiện hành) + thêm token `--fk-*`, `--*-rgb`, `--on-*` từ `themes.css` mục 1a; bỏ xám v1.
3. **Xoá luật chết:** các khai báo bị ghi đè hoàn toàn (cùng selector + thuộc tính, phía sau có khai báo cùng/hơn `!important`) — script đã tính được (`dead` trong `gen_themes_layer.py`): **230 / 3 482 khai báo** là chết chỉ tính riêng trường hợp trùng selector. Xoá `@keyframes spin` thừa, gộp reduced-motion.
4. **Thay màu cứng bằng biến** theo bảng 2.4 ngay trong style.css (giữ nguyên selector) → khi đó lớp sinh tự động trong `themes.css` không còn cần: xoá đoạn `@generated`, chỉ giữ token theme + vá tay.
5. **Gộp từng component theo bảng 5.2**, đưa giá trị lớp G → F → A về một luật duy nhất, theo thứ tự: nền app/topbar/dock → card/glass (bỏ nhóm `!important` 1009) → nút/pill/form → tab/progress/ring → sheet/toast → trang chủ → PT → dinh dưỡng → hồ sơ PT/màn chào → bảng hiệp. Sau mỗi nhóm so ảnh với bước 1 (sai khác ≤ 1 %).
6. **Typography:** bỏ Oswald/Hanken/Be Vietnam/Barlow khỏi CSS và thẻ `<link>` Google Fonts; quy đổi 67 cỡ chữ < 12 px theo mục 3.
7. **Bo góc/khoảng cách:** thay giá trị lẻ bằng `--fk-r-*` / `--fk-s-*`.
8. **Kính:** chỉ giữ blur cho dock, sheet, backdrop, nút thanh trên; đưa phần còn lại vào `.glass` có nhánh `.lowfx`.
9. **Tách file** (tuỳ chọn, vẫn không cần bundler): `tokens.css`, `base.css`, `components.css`, `screens/*.css` — nạp theo thứ tự trong index.html.
10. Kiểm tra lại 6 theme bằng `__audit()` (độ tương phản) và chụp màn 360 px.

Mục tiêu sau gộp: ~800 dòng, ≤ 5 `!important`, 0 màu cứng ngoài token, ≤ 5 `backdrop-filter`.

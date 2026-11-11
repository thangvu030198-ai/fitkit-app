# QA — Trải nghiệm · Hiệu năng · Khả năng truy cập — TapEasy (11/11/2026)

Người đánh giá: agent UX research + hiệu năng web mobile + a11y. **Chỉ đọc mã app, không sửa file app.** Số liệu thô: `_test/qa-ux/results.json`; harness: `_test/qa-ux/qa-ux-harness.js`, `a11y-audit.js`; ảnh: `_test/qa-ux/ux-*.png`.

## 0. Tóm tắt

| Tiêu chí | Điểm /10 | Một câu |
|---|---|---|
| **Mượt** | **4** | Máy tính thì nhanh. Khi giả lập CPU chậm 4×: Trang chủ hiện sau 3,1 s nhưng 7,4 s mới bấm được; lần đầu mở Dinh dưỡng bị đơ 4,3 s; Tìm PT, Cộng đồng, Gian hàng cuộn chỉ được 22–29 fps. |
| **Dễ dùng** | **6** | Thao tác lõi gọn (ghi 1 hiệp 2 chạm, ghi 1 món 4 chạm, duyệt PT 5 chạm). Điểm vướng: nút "Bắt đầu" dẫn sang trang đăng ký, phải bấm "Bắt đầu" hai lần mới vào buổi tập, PT vào nhầm tab, menu ☰ có 22 mục. |
| **Truy cập** | **4** | Nút icon không có tên, nút CTA coral chỉ đạt 2,6:1, mỗi màn có 8–23 chữ nhỏ hơn 12 px, sheet không có ngữ nghĩa hộp thoại và không giữ focus, thẻ lựa chọn là div nên không chọn được bằng bàn phím. |
| **Nhất quán** | **5** | Cùng một chỗ có nhiều tên: Giáo án/Chương trình/Lịch tập, Gian hàng/Store/Cửa hàng, Tiến trình/Tiến độ. Tiếng Anh xen kẽ (Routine, RPE, deload). Có 3 kiểu trạng thái rỗng/tải/lỗi khác nhau. |

Ba việc lợi nhất:
1. Nạp lười theo màn cho các nhóm PT/Kết nối, Sự kiện/Gian hàng, Kho kiến thức, Quản trị. Bốn nhóm này chiếm khoảng 1,7 MB trong 2,9 MB JS và không cần lúc mở app.
2. Không vẽ trước các màn đang ẩn, bỏ `void offsetWidth` trong `goto()`, ghi nhớ (memo) thực đơn.
3. Thêm `aria-label` cho nút icon, đổi `--on-coral`, thêm role dialog + giữ focus cho sheet.

---

## 1. Phương pháp và giới hạn

- **Trình duyệt:** Chromium 157 qua Playwright MCP trên máy chủ Windows. Dùng **ngữ cảnh riêng `qa-ux`** (`browser.newContext`, chặn service worker, `vi-VN`). Viewport 390×844 khi đo hiệu năng; 360×780 và 1280×800 khi đo a11y.
- **Phục vụ qua http:** `http://tapeasy.test/*`, dùng `route.fulfill({path})` đọc thẳng từ `FitKit/`. Cách này tương đương một server tĩnh. Không dùng `python3 -m http.server` vì sandbox không có Playwright và không có mạng, còn trình duyệt chạy trên máy chủ không gọi được vào sandbox. Tài nguyên ngoài (Google Fonts, GSI, cdnjs, Pexels, Pixabay, GitHub Pages) đi qua mạng thật.
- **CPU chậm 4×:** dùng CDP `Emulation.setCPUThrottlingRate`.
- **Mạng chậm:** tự mô phỏng trong bộ định tuyến. Mỗi request chịu RTT, rồi chia chung một đường băng thông (kiểu HTTP/2). Kích thước tính theo bản gzip của từng file (`sizes.json`). Hai mức: "Slow 4G" 1,6 Mbps/150 ms và "4G" 9 Mbps/60 ms.
- **Chỉ số:**
  - Long task, FCP, LCP, CLS: đo bằng PerformanceObserver.
  - TTI: tính kiểu Lighthouse (cần khoảng lặng 5 s).
  - INP: đo bằng Event Timing API với cú chạm thật của Playwright.
  - FPS: đếm khung rAF khi cuộn bằng bánh xe; khung dài hơn 34 ms tính là giật.
  - Bộ nhớ: CDP `Performance.getMetrics`, đo sau khi chạy GC.
  - Độ phủ mã: `page.coverage`.
  - A11y: axe-core 4.10.2 cộng script `a11y-audit.js` (tương phản, cỡ chữ, vùng chạm).
- **Hồ sơ "người dùng quay lại":** Lan, nữ, 27 tuổi, 158 cm, 55 kg, mục tiêu giảm mỡ. Đi hết onboarding, bấm "Để sau" ở bước sàng lọc, rồi lưu localStorage làm hạt giống cho các lần đo sau.
- **Giới hạn:**
  - Trình duyệt MCP dùng chung với các agent QA khác chạy song song. Trong lúc làm, trình duyệt bị khởi động lại 3 lần. Vì vậy số liệu có nhiễu khoảng ±20–30 %; nên đọc theo bậc độ lớn.
  - Giả lập chỉ làm chậm CPU, không làm chậm GPU. Chi phí `backdrop-filter` trên Android tầm trung vì thế bị **đánh giá thấp**; cần đo trên máy thật (ví dụ Galaxy A1x, iPhone 11).
  - Bản native (Capacitor) đọc file ngay trên máy nên mạng gần như không ảnh hưởng. **Với bản này, CPU là nút thắt chính.**
  - Sự cố: một lần lệnh thiết lập của tôi gắn nhầm vào tab `qa-commerce` (tranh "tab hiện tại" giữa các agent). Tôi đã gỡ route của mình ngay, nhưng tab đó bị điều hướng một lần. Từ lần đó tôi chỉ dùng ngữ cảnh do mình tự tạo.

---

## 2. Hiệu năng

### 2.1 Gói tải khi mở app (theo `index.html` hiện tại, đã có `theme-packs.*` và `ui-signature.*`)

| Hạng mục | Số file | Dung lượng gốc | Gzip | Ghi chú |
|---|---|---|---|---|
| CSS cục bộ | 20 | 788 KB | 150 KB | Đều chặn render. Lúc mở chỉ dùng **6 %** luật CSS (46/785 KB). 13 file chỉ dùng 0–4 %. `themes-modules.css` nặng 176 KB nhưng chỉ dùng 2 %. |
| JS cục bộ | 51 | 2 934 KB | 911 KB | Đều đồng bộ, không có `defer`. Lúc mở mới **chạy 41 %** (1,1/2,7 MB). Riêng các file dữ liệu tính là "đã chạy" vì là literal được thực thi ở cấp đầu file. |
| ↳ File dữ liệu | 16 | 666 KB | 209 KB | exdb-vi-1..3, exdb-vi, kb-data-1..6, meals-extra, shop-data, templates, data, meals, exdb |
| ↳ PT / Kết nối | 7 | 596 KB | 181 KB | coach, ptprofile, pt-pro, pt-connect, cloud-social, findpt, cloud-pt-directory |
| ↳ Sự kiện / Gian hàng | 5 | 463 KB | 145 KB | events, events-media, cloud-events, shop, shop-data |
| ↳ Kho kiến thức | 7 | 362 KB | 126 KB | kb + kb-data-1..6 |
| ↳ Quản trị | 3 | 185 KB | 57 KB | admin, cloud-admin, rbac |
| Bên ngoài | 3 + font | — | — | Google Fonts **7 họ** (Oswald, Be Vietnam Pro, Barlow Condensed, Hanken Grotesk không còn dùng theo DESIGN-SYSTEM); **JSZip tải đồng bộ trong `<head>`** (chỉ cần khi sao lưu Drive); GSI tải async. |
| **Tổng khi mở** | **74 thẻ** | **3,72 MB** | **1,07 MB** | Đo được 79 request cục bộ + 15–23 request ngoài. Màn chào còn gọi Pixabay API **có khoá trong mã client** và phát video mp4. |
| Luật CSS | 22 stylesheet | 6 957 luật | — | `backdrop-filter`: 83 khai báo trong 14 file. Trang chủ có 40 phần tử đang blur. |
| localStorage | 7 khoá | 238 KB | — | 206 KB là dữ liệu demo (ptdir 102 KB, events 58 KB, social 46 KB). Ghi khi mở lần đầu, đọc lại mỗi lần mở. |
| Ảnh lúc mở | 17 `<img>` | — | — | 0 ảnh có `loading="lazy"` ở phần lõi. Thumbnail YMove 1080×1920 và ảnh Pexels `w=1080` JPEG vẫn tải dù màn đang ẩn. Ảnh Gian hàng đã là WebP, có width/height (tốt). |

### 2.2 Thời gian nạp

Đơn vị ms. "Sẵn sàng" là lúc màn chào mở (lần đầu) hoặc lúc Trang chủ có nội dung (quay lại).

| Kịch bản | CPU | Mạng | FCP | Sẵn sàng | LCP | DCL | **TTI** | **TBT** | Long task dài nhất | CLS |
|---|---|---|---|---|---|---|---|---|---|---|
| Lần đầu (màn chào) | 1× | cục bộ | 296 | 329 | 796 | 1 081 | 4 247 | 196 | 138 | **0,136** |
| Lần đầu (màn chào) | **4×** | cục bộ | 1 756 | 3 077 | 7 836 | 12 983 | **23 609** | **8 184** | 1 542 | 0,142 |
| Lần đầu (màn chào) | 4× | Slow 4G | 1 712 | 3 153 | 5 864 | 10 451 | 19 001 | 5 838 | 1 479 | 0,139 |
| Quay lại (Trang chủ) | 1× | cục bộ | 280 | 461 | 2 876 | 924 | 924 | 138 | 146 | 0,006 |
| Quay lại (Trang chủ) | **4×** | cục bộ | 1 140 | **3 102** | 6 076 | 6 889 | **7 424** | **3 204** | 1 401 | 0,042 |
| Quay lại (Trang chủ) | 4× | 4G | 1 852 | 3 623 | 6 448 | 7 528 | 7 944 | 3 776 | 1 453 | 0,042 |
| Quay lại (Trang chủ) | 4× | Slow 4G | 1 872 | 4 519 | 5 176 | 8 729 | 9 166 | 4 001 | 1 884 | 0,042 |

Cách đọc:
- **Có một khoảng "nhìn thấy nhưng chưa bấm được" dài khoảng 4 s** (CPU 4×). Lý do: `pt.js` gọi `appBoot()` khi mới nạp xong khoảng 1/3 số script, nên Trang chủ đã hiện ở 3,1 s. Sau đó hơn 30 module còn lại vẫn tiếp tục nạp, bọc lại hàm và vẽ lại tới khoảng 6,9–7,4 s. Chạm trong khoảng này sẽ bị trễ hoặc mất.
- Màn chào lần đầu nặng hơn rõ (TTI 19–24 s ở 4×) vì cùng lúc có video nền, 7 animation chạy vô hạn, gọi API Pixabay và ghi khoảng 206 KB dữ liệu demo vào localStorage.

**Profile CPU (self time, CPU 4×)**

| Kịch bản | Thời gian theo nguồn |
|---|---|
| Lần đầu | native (parse, style, layout, paint) 17,3 s · `freevideos.js` 1 066 · `kb.js` 542 · `cloud-events.js` 539 · `icons.js` 470 · `pt.js` 338 · GC 263 · GSI 224 |
| Quay lại | native 4,7 s · **`get offsetWidth` 901** (ép layout đồng bộ ở `app.js:335` trong `goto()`: `void sc.offsetWidth`) · `icons.js` 386 · `achievements.js` 372 · `kb.js` 176 · `pt.js` 151 · `cloud-events.js` 122 · `nutrition.js` 101 |

Toàn bộ mã nguồn không có chỗ nào dùng `requestIdleCallback`.

### 2.3 Chuyển màn và mở module (CPU 4×, INP đo bằng cú chạm thật)

| Thao tác | INP (ms) | Long task dài nhất | Đánh giá (tốt ≤ 200, kém > 500) |
|---|---|---|---|
| Nav → Tập luyện | 608 | 550 | kém |
| Nav → **Dinh dưỡng, lần đầu** | **4 280** | **4 033** | rất kém (ở CPU 1× là 272) |
| Nav → Dinh dưỡng, lần 2 | 744 | 658 | kém |
| Nav → PT | 136 | 94 | tốt |
| Nav → Hồ sơ | 672 | 588 | kém |
| Nav → Trang chủ | 384–432 | 320–388 | cần cải thiện |
| Menu ☰ | 208 | 132 | đạt |
| Giáo án của tôi / Thư viện / Tiến trình / Thư viện bài tập (exlib) / Giấc ngủ / Nhắc nhở (gọi `goto`) | 333 / 50 / 110 / 44 / 241 / 176 | ≤ 282 | đạt / cần cải thiện |
| Khám phá → **Tìm PT** | **1 400** | 1 306 | rất kém |
| Khám phá → **Cộng đồng** | **1 256** | 986 | rất kém |
| Khám phá → **Sự kiện** | **1 176** | 1 064 | rất kém |
| Khám phá → Kho kiến thức | 872 | 719 | kém |
| Khám phá → Gian hàng | 776 | 546 | kém |
| Khám phá → Giáo án riêng / Giáo án mẫu | 184 / 184 | ≤ 149 | tốt |
| Đổi theme sang Sáng | 723 | — | kém (phải tính lại 6 957 luật CSS) |

### 2.4 Cuộn (FPS ước lượng; màn hình 120 Hz)

| Màn | 1× fps / % giật / khung dài nhất | 4× fps / % giật / khung dài nhất |
|---|---|---|
| Trang chủ | 126 / 0 % / 22 ms | 138 / 0 % / 21 ms |
| Dinh dưỡng | 109 / 1 % / 48 ms | **44 / 32 % / 83 ms** |
| Thư viện bài tập | — | 97 / 3 % / 56 ms |
| Kho kiến thức | — | 110 / 2 % / 118 ms |
| **Tìm PT** | — | **23 / 57 % / 423 ms** (parallax dựa trên scroll + rAF ở `findpt.js:1481`, cộng IntersectionObserver hiện thẻ dần) |
| **Cộng đồng** | — | **22 / 75 % / 347 ms** (18 phần tử blur trong khung nhìn) |
| **Gian hàng** | — | **29 / 23 % / 264 ms** (16 phần tử blur) |

### 2.5 Bộ nhớ

| Thời điểm | JS heap (sau GC) | Nút DOM | Event listener |
|---|---|---|---|
| Sau khi mở | 5,7 MB | 7 646 | 406 |
| Sau 40 lần đổi tab + 10 lần mở module | 7,4 MB | 12 861 | 546 |

- **Không thấy rò rỉ đáng kể.** DOM phình ra vì các màn module được giữ lại sau khi rời.
- Lúc mở có 3 750 phần tử, trong đó **Dinh dưỡng chiếm 2 004 phần tử dù đang ẩn**: màn này được vẽ sẵn ngay khi khởi động.

---

## 3. UX và điều hướng

### 3.1 Năm nhiệm vụ chính cho mỗi nhóm người dùng

"Đo" là bấm thật trong `qa-ux`; "ước" là đếm theo mã nguồn và kịch bản tích hợp vòng 3.

**Người mới tập**

| # | Nhiệm vụ | Đường đi | Số chạm | Điểm mắc kẹt / chữ khó hiểu |
|---|---|---|---|---|
| N1 | Bắt đầu buổi tập đầu tiên (đo) | Theo nút CTA lớn: **"Bắt đầu ngay" → mở Tạo tài khoản** (tên, email, mật khẩu, tick đồng ý) → chọn 1 trong 4 vai trò → onboarding 5 bước → sàng lọc "Để sau" → Trang chủ "Bắt đầu tập" → **sang màn Tập luyện, bấm tiếp "Bắt đầu buổi tập"** → mở sheet buổi tập | **≈ 17 chạm + 7 ô nhập**. Nếu đi lối khách "Dùng ngay, không cần tài khoản": 12 chạm + 4 ô | CTA chính đẩy người mới đi đăng ký. Phải bấm "Bắt đầu" hai lần với hai nhãn khác nhau. Buổi đầu là **Deadlift 4×5–6, "Cường độ Cao"**, ô Kg để trống, cột **RPE** có 9 mức. Hero ghi "CHƯƠNG TRÌNH ĐỐT MỠ HIỆU QUẢ · CHINH PHỤC GIỚI HẠN" mà không nói hôm nay tập gì. |
| N2 | Ghi bữa trưa (đo) | Dinh dưỡng → nút "Thêm" ở thẻ Bữa trưa → gõ "com" (tìm không dấu chạy tốt) → chạm món → "Thêm vào bữa trưa · 195 kcal" | **4 chạm/món**; bữa 3 món ≈ 10 chạm. Lối tắt "Ghi vào hôm nay" từ thực đơn gợi ý: 2 chạm nhưng phải cuộn khoảng 3 màn | Nút "Thêm" chỉ 34 px, 4 nút cùng tên "Thêm". Chữ tắt "Đ2.7 · TB28 · B0.3 · Xơ 0.4". Lần đầu mở Dinh dưỡng đơ 4,3 s (4×). |
| N3 | Xem cách tập đúng một bài (đo) | Trong buổi tập: video ở đầu sheet | 1 chạm | Tốt. Riêng nút "Hướng dẫn kỹ thuật" nằm dưới bảng hiệp, phải cuộn. |
| N4 | Ghi nước uống (đo) | Dinh dưỡng → "+250ml" | 2 chạm + cuộn khoảng 2 màn | Khối nước nằm dưới 4 thẻ bữa ăn. |
| N5 | Tìm PT gần nhà (đo một phần, ước) | Trang chủ cuộn tới Khám phá → Tìm PT → Bộ lọc → khu vực → giá → "Xem N PT" → hồ sơ → Đặt buổi thử | ≈ 7 chạm | Ở 360×780, hàng Khám phá nằm dưới mép màn đầu. Mở Tìm PT mất 1,4 s (4×), sau đó dòng "20 PT" hiện ra trên **vùng trống** vì thẻ chỉ hiện khi cuộn tới. |

**Người tập lâu năm**

| # | Nhiệm vụ | Đường đi | Số chạm | Điểm mắc kẹt |
|---|---|---|---|---|
| L1 | Ghi kg × lần cho một hiệp (đo) | Ô Kg → gõ → ✓ (số lần đã điền sẵn) | **2 chạm** | Tốt. Có "Khởi động", "Đĩa tạ", "Lịch sử" ngay cạnh. |
| L2 | Xem kỷ lục / biểu đồ sức mạnh (đo) | Trong buổi: "Lịch sử" (1 chạm). Ngoài buổi: menu ☰ → "Ảnh tiến trình & InBody" → thẻ "Kỷ lục cá nhân" | 2–3 chạm | Kỷ lục nằm trong màn đặt tên theo ảnh. Ô "Tiến độ" đã bị bỏ khỏi Khám phá ở vòng 3. Màn này có tiêu đề "Tiến trình" nhưng doc gọi là "Tiến độ". |
| L3 | Tạo giáo án riêng (ước) | Khám phá → Giáo án riêng (6 câu hỏi) | ≈ 8 chạm | Mở nhanh (184 ms). |
| L4 | Vào chu kỳ / deload (đo) | Tập luyện → "Chu kỳ & deload" | 2 chạm | "deload" chưa được Việt hoá. |
| L5 | Đổi theme / tắt kính mờ (ước) | Hồ sơ → cuộn → Giao diện | ≈ 3 chạm | Đổi theme mất 723 ms (4×). |

**PT bận rộn**

| # | Nhiệm vụ | Đường đi | Số chạm | Điểm mắc kẹt |
|---|---|---|---|---|
| P1 | Giao giáo án cho học viên mới (đo) | Tab PT → **"Học viên của tôi"** (màn mở sẵn tab "PT của tôi", vẫn giữ tab cũ sau khi chọn "Tôi là PT") → "Thêm học viên" (tên, mục tiêu, gói) → "Tạo form & mã mời" → đóng sheet mời → "Giao giáo án" → chọn mẫu → "Tạo lịch & giao" | **8 chạm + 3 ô** | Có **2 nút cạnh nhau** "Thêm học viên" và "Mời học viên · email/mã/QR". Form thêm học viên không hỏi giới tính và trình độ, nên mẫu đứng đầu gợi ý là **"Nam · Mới tập"** cho một học viên nữ. Tên mẫu dùng thuật ngữ "RIR 1–2", "ULPPL", "hypertrophy", "tăng tiến kép". |
| P2 | Xem ai sắp hết gói (đo) | Tab PT → (Học viên của tôi) → cuộn qua khoảng 9 khối (thẻ hồ sơ, 6 ô số, lịch, việc cần làm) → chip **"Sắp hết gói"** | 2–3 chạm + cuộn khoảng 1,5 màn | Đầu trang không có ô số "Sắp hết gói", cũng không có thông báo đẩy. Sắp xếp "Còn ít buổi nhất" thì nằm trong một `<select>`. |
| P3 | Xếp lịch cho học viên chưa có buổi (đo) | Việc cần làm hôm nay → "Xếp lịch" | **1 chạm** | Tốt: dashboard chủ động gợi việc. |
| P4 | Gửi mã mời (đo) | Sheet hiện ngay sau khi tạo (Mã & QR, Sao chép, Gửi lời mời) | 1 chạm | Tốt. |
| P5 | Niêm yết hồ sơ trên Tìm PT (ước) | Cuối dashboard → "Niêm yết hồ sơ Tìm PT" → trình soạn | Cuộn khoảng 3 màn + nhiều ô | Lối vào nằm tận cuối trang. |

**Chủ app**

| # | Nhiệm vụ | Đường đi | Số chạm | Điểm mắc kẹt |
|---|---|---|---|---|
| O1 | Lần đầu trở thành Chủ sở hữu (đo) | Lối vào ẩn (chạm 7 lần vào dòng phiên bản, hoặc thêm `#admin` vào địa chỉ) → nhập mã khởi tạo + mật khẩu | 1 chạm sau khi đã tìm ra lối vào | Hồ sơ không hiện "Bảng quản trị" khi tài khoản chưa có vai trò. Ẩn như vậy là hợp lý về bảo mật, nhưng **cần ghi vào tài liệu bàn giao**. |
| O2 | Duyệt PT (đo) | Menu ☰ → cuộn → Bảng quản trị → (nhập lại mật khẩu cho phiên) → việc cần làm "2 hồ sơ PT chờ xác minh" → "Xác minh" → xác nhận | **5 chạm** | Tốt: có danh sách việc cần làm và hộp xác nhận. |
| O3 | Đăng sự kiện có ảnh (đo) | Menu ☰ → Bảng quản trị → ☰ quản trị → "Sự kiện & thử thách" → **"Mở công cụ Sự kiện đầy đủ"** (rời bảng quản trị, sang tab Quản trị của module Sự kiện) → cuộn qua phần Thử thách → **nút "Tạo" thứ hai** → Thêm ảnh → chọn file → điền form → Lưu | **≈ 10 chạm + ≥ 6 ô** (form có 20 trường, 8 ô văn bản dài) | Phải đổi qua lại giữa 2 giao diện. Có 2 nút cùng nhãn "Tạo". Không có lưu nháp và không có "Nhân bản sự kiện cũ". Lối ngắn hơn (Khám phá → Sự kiện → tab Quản trị) thì không ai chỉ ra. |
| O4 | Ẩn bài cộng đồng bị báo cáo (đo) | Tổng quan → "1 mục cần kiểm duyệt" | 1–2 chạm | Tốt. |
| O5 | Xem đơn hàng chờ xử lý (đo) | Tổng quan → ô "Đơn chờ xử lý" | 1 chạm | Tốt. |

### 3.2 Kiến trúc thông tin: có quá tải không?

| Lớp | Số mục | Nhận xét |
|---|---|---|
| Thanh dưới | 5 (Trang chủ · Tập luyện · Dinh dưỡng · PT · Hồ sơ) | Hợp lý. Nhãn chữ 10,5 px. |
| Thanh trên (Trang chủ) | 3 nút icon 38 px (☰, 🏆, avatar) | Avatar trùng với tab Hồ sơ. Cả 3 nút **không có tên** cho trình đọc màn hình. |
| Hàng Khám phá | 7 ô cuộn ngang | Ở 360 px chỉ thấy khoảng 2,7 ô; ô 124×118 px (đạt). |
| Menu ☰ | **22 mục / 7 nhóm**, cao 1 645 px (khoảng **2,1 màn**) | Trùng: 2 mục với thanh dưới (Trang chủ, "Hồ sơ của tôi"), **7 mục với Khám phá**, 4 mục với lối tắt ở màn Tập luyện. |
| Lối tắt ở màn Tập luyện | 6 nút | Giáo án mẫu · Thư viện bài tập · Chương trình của tôi · Kho video · Chu kỳ & deload · Nhật ký buổi tập |
| Tab trong Sự kiện | 6 | Thi đua · Offline · Khoảnh khắc · Gian hàng · Quà · Quản trị |

Đánh giá: **quá tải ở mức vừa.** Khoảng 40 lối vào ở cấp 1–2 cho khoảng 25 đích đến.
- "Giáo án mẫu" có **4 lối vào** (Khám phá, menu, màn Tập luyện, màn PT).
- "Tìm PT" có 4 lối (Khám phá, menu, tab "PT của tôi", màn chọn vai trò).
- "Gian hàng" có 3 lối (Khám phá, menu, tab trong Sự kiện).

Lối vào nhiều không hẳn là xấu. Vấn đề là **mỗi lối lại dùng một tên khác** (xem 3.3).

Đề xuất:
- Menu ☰ còn ≤ 12 mục: bỏ các mục trùng với thanh dưới.
- Gộp "Lịch tập tuần này / Tạo giáo án riêng / Giáo án mẫu / Quản lý chương trình tập" thành một mục **"Giáo án"** chia tab.
- Gộp "Sự kiện & Thi đua" với "Sự kiện offline & vé".
- Giữ Khám phá làm nơi khám phá chính. Menu ☰ chỉ là bản đồ toàn app.

### 3.3 Tên gọi và tiếng Việt

| Khái niệm | Các tên đang dùng | Nên thống nhất |
|---|---|---|
| Giáo án | "Giáo án mẫu", "Tạo giáo án riêng", "Giáo án riêng", "Quản lý chương trình tập", "Chương trình của tôi", "Lịch tập tuần này", hero "CHƯƠNG TRÌNH ĐỐT MỠ…" | **Giáo án** (mẫu / của tôi) · **Lịch tuần** |
| Tiến độ | "Ảnh tiến trình & InBody" (menu), "Tiến trình" (thanh trên), "Tiến độ" (doc, ô Khám phá cũ) | **Tiến độ** (ảnh · số đo · kỷ lục) |
| Cửa hàng | "Gian hàng", "Gian hàng TapEasy", "TapEasy Store", "Cửa hàng" (nhóm menu), "Cửa hàng & đơn hàng" (quản trị) | **Cửa hàng** |
| Sự kiện | "Sự kiện", "Sự kiện & Thi đua", "Sự kiện offline & vé", "Thi đua", "Thi đua tháng", "Sự kiện & thử thách" | **Sự kiện** (Thử thách · Gặp mặt) |
| PT | "PT" (thanh dưới), "TapEasy PT", "TapEasy PT — PT & Học viên", "Kết nối PT", "Album PT công khai", "Tìm PT" | **PT** (Học viên · PT của tôi) · **Tìm PT** |
| Hồ sơ | "Hồ sơ", "Hồ sơ của tôi" | **Hồ sơ** |
| Tên bài tập | "Deadlift (Nâng tạ từ sàn)" (Anh trước) lẫn "Đẩy vai (Overhead Press)" (Việt trước) | Theo GLOSSARY: **Tên Việt (English)** |

Tiếng Anh và thuật ngữ còn sót trong chuỗi hiển thị: Routine/routine (hàng chục chuỗi trong community.js, ví dụ "Routine của PT & bạn tập"; con số này có thể gồm cả chuỗi kỹ thuật), RPE (24), deload (20), RIR, ULPPL, hypertrophy, Superset, TapEasy Points, Check-in, CSV, Workshop, InBody, BMR/TDEE.

Đề xuất:
- Ẩn RPE và RIR ở cấp "Mới tập".
- Đổi "Routine" thành "Bài tập chia sẻ" hoặc "Lịch tập mẫu".
- Ghi đủ chữ "Đạm 2,7 g · Tinh bột 28 g".
- Bỏ chữ IN HOA kiểu khẩu hiệu ở các nhãn nhận diện: "VẬN ĐỘNG VIÊN ELITE", "HẠNG PRO", "CHÀO MỪNG VẬN ĐỘNG VIÊN".
- Khối "NĂNG LƯỢNG HÔM NAY" dùng font monospace (ui-signature), lệch với giọng chữ Inter của cả app.

### 3.4 Trạng thái rỗng / lỗi / đang tải

- **Ba kiểu khác nhau:**
  - `fkEmpty`, `fkSkeleton`, `fkError` (chuẩn trong DESIGN-SYSTEM): chỉ dùng ở events (8 skeleton, 4 rỗng), community, pt-connect.
  - Lõi (app, coach, nutrition, video) dùng `.empty-hint`; ui-kit tự nâng cấp lớp này.
  - findpt, shop, kb, admin tự làm kiểu riêng.
- Không có thông báo mất mạng chung cho toàn app (chỉ shop và events kiểm `offline`).
- Trạng thái rỗng tốt: Dinh dưỡng ("Chưa có món — chạm + để thêm…"), PT ("Chưa có học viên. Bấm 'Thêm học viên'…"), PT của tôi.
- **Sai lệch cho người mới:** dải tuần đánh dấu **T2/T3 là "bỏ lỡ" (chấm coral) ngay ngày đầu dùng app** (`pt.js:605`, `w.past && !w.done`). Lý do: app tính cả những ngày trước khi đăng ký.
- Tìm PT: sau dòng "20 PT" là vùng trống cho tới khi người dùng cuộn (hiệu ứng hiện dần), trông như đang lỗi hoặc không có kết quả.

### 3.5 Theme (tổng quát, agent Theme đang làm song song)

- Có 6 theme màu và 5 gói theme (`theme-packs.css` 36 KB + 10 khai báo `backdrop-filter`, `ui-signature.css` 22 KB).
- Gói theme nạp **luôn cả khi không dùng** (độ phủ lúc mở: theme-packs.css 0 %, ui-signature.css 18 %). Nên nạp khi người dùng chọn gói.
- Đổi theme mất 723 ms (4×). Cần kiểm tương phản CTA cho từng gói, vì `--on-coral` của theme Mặc định đang trượt AA.

---

## 4. Khả năng truy cập (360×780, theme Mặc định)

| Tiêu chí | Kết quả | Chi tiết |
|---|---|---|
| Tương phản AA | ❌ | CTA coral `#FF7A45` + chữ trắng = **2,59:1** ("Bắt đầu tập", "Bắt đầu buổi tập", "Bắt đầu ngay", "Tạo tài khoản"). axe báo "cần xem lại" 11–44 nút mỗi màn vì nằm trên kính/gradient. Phần chữ còn lại trên nền kính đặc thì đạt. |
| Vùng chạm ≥ 44 px | ❌ một phần | Icon thanh trên **38×38** ở mọi màn; tab ngày ở Tập luyện **36×26** ×7; "Thêm" món **34×34** ×4; nút chỉnh mục tiêu ở Hồ sơ **30×30**. Ô Khám phá, nút trong buổi tập và thanh dưới thì đạt. |
| `aria-label` / tên | ❌ | axe `button-name` (critical) ở mọi màn: **24/24 `.icon-btn` trong index.html không có aria-label**; coach.js 12/12, app.js 19/20, nutrition.js 6/6 cũng vậy. 4 ảnh bài tập thiếu `alt`. Nhãn trùng nhau: "Thêm" ×4, "Yêu thích" ×n, "Sửa"/"CSV" ×n. Ngược lại, training-pro (7/8) và bảng quản trị gắn nhãn tốt. |
| Sheet: role dialog + giữ focus | ❌ | `#sheet-content` không có `role="dialog"`, `aria-modal`, nhãn. Mở sheet không chuyển focus vào trong. Bấm Tab 40 lần: **21 lần đầu focus ở các phần tử phía sau sheet**, 7 lần trong sheet, rồi lại ra ngoài. Đóng không trả focus về nút đã mở. Esc thì đóng được ✓. Bảng quản trị (`#adm-root`) có `role="dialog" aria-modal` ✓. |
| Thứ tự tab và phần tử bấm được | ❌ | 29 phần tử bấm được là `div` không có role/tabindex: `.choice-card` (giới tính, mức vận động, mục tiêu ở onboarding), `.role-card`, `.streak-chip`, `.metric`. **Người dùng bàn phím hoặc TalkBack không làm xong được onboarding.** Thẻ món ăn (`.np-row`) có `role="button" tabindex=0` ✓. Lời chào trên Trang chủ nhận focus nhưng không có viền. |
| Cấu trúc trang | ⚠️ | Không có `<main>`, không có `h1`, axe báo `region`. `nested-interactive`: thẻ thành tích, 4 thẻ bữa ăn. `.nu-recipes` cuộn ngang nhưng không focus được. |
| Giảm chuyển động | ⚠️ | Khi bật `prefers-reduced-motion: reduce`, animation CSS ở màn chào giảm từ 7 xuống 0 ✓, Trang chủ 0 ✓. Nhưng **video nền màn chào vẫn tự phát và không có nút dừng** (WCAG 2.2.2). |
| Cỡ chữ ≥ 12 px | ❌ | Số phần tử chữ < 12 px đang hiện: Trang chủ 18, Tập luyện 15, **Dinh dưỡng 23**, PT 8, Hồ sơ 10. Nhãn thanh dưới 10,5 px, dải tuần 9,5 px. style.css còn 67 khai báo < 12 px, app.js 7 (đúng như DESIGN-SYSTEM §3 đã liệt kê). |
| 360 px | ✅ | Không tràn ngang ở 5 màn chính. Ô nhập 16 px. |
| 1280 px | ⚠️ | App bó trong khung 460 px ở giữa, **64 % màn hình bỏ trống**, kể cả Tìm PT và Gian hàng. Bảng quản trị dùng hết chiều rộng ✓. Không tràn ngang. |

---

## 5. Danh sách vấn đề (QU-xx)

Mức độ: **Cao** (chặn hoặc hỏng trải nghiệm, vi phạm WCAG A/AA quan trọng) · **TB** (gây khó chịu rõ) · **Thấp** (đánh bóng).

| ID | Mức | Màn | Vấn đề | Đề xuất cụ thể |
|---|---|---|---|---|
| QU-01 | Cao | Khởi động | 74 tài nguyên chặn render, 51 JS đồng bộ, 1,07 MB gzip. Lúc mở chỉ chạy 41 % JS và dùng 6 % CSS. | Nạp lười theo màn (§6 bước 5). Nhóm PT/Kết nối, Sự kiện/Gian hàng, Kho kiến thức, Quản trị (khoảng 1,6 MB gốc) nạp khi mở. |
| QU-02 | Cao | Khởi động | Trang chủ hiện ở 3,1 s nhưng 7,4 s mới bấm được (4×). TBT 3,2 s, long task 1,4 s. | `appBoot()` vẽ Trang chủ rồi nhường luồng (`await new Promise(r=>setTimeout(r))`). Các module làm việc phụ (freevideos index, `kb.todayPick`, sinh dữ liệu demo, icons quét lại) trong `requestIdleCallback`. |
| QU-03 | Cao | Dinh dưỡng | Lần đầu mở đơ **4,3 s** (4×). Màn này còn vẽ sẵn 2 004 phần tử lúc khởi động dù đang ẩn. | Không vẽ khi ẩn, chỉ vẽ lúc `goto` lần đầu. Ghi nhớ `buildDayPlan` theo ngày và hồ sơ (`state.npPlanCache`). Vẽ "Thực đơn gợi ý" và "Đi chợ" sau, trong lúc rảnh. |
| QU-04 | Cao | Màn chào (lần đầu) | TTI 19–24 s, TBT 5,8–8,2 s (4×), CLS 0,14. Cùng lúc chạy video nền, 7 animation vô hạn, gọi Pixabay API (khoá lộ ra ở client) và ghi 206 KB dữ liệu demo. | Dùng ảnh poster tĩnh (WebP ≤ 60 KB). Chỉ phát video khi không `saveData`, không reduced-motion, và sau khi đã vẽ xong. Gán URL video sẵn lúc build, bỏ gọi API khi chạy. Đặt kích thước cố định cho khối chữ để CLS < 0,1. Chỉ sinh dữ liệu demo khi mở module tương ứng. |
| QU-05 | TB | Tìm PT · Cộng đồng · Gian hàng | Cuộn chỉ 22–29 fps, 23–75 % khung giật, khung dài nhất 264–423 ms (4×). | Bỏ parallax dựa trên scroll ở `findpt.js:1481` (hoặc chuyển sang `animation-timeline: scroll()`). Thêm `content-visibility:auto; contain-intrinsic-size` cho thẻ trong danh sách. Thẻ không dùng blur. Bật `lowfx` khi phát hiện fps trung bình < 45. |
| QU-06 | TB | Mở module | INP: Tìm PT 1,4 s · Cộng đồng 1,26 s · Sự kiện 1,18 s · Kho kiến thức 0,87 s · Gian hàng 0,78 s. | Hiện `fkSkeleton` ngay, vẽ 8–12 thẻ đầu, phần còn lại vẽ theo lô trong `requestIdleCallback`. |
| QU-07 | TB | `goto()` (`app.js:335`) | `void sc.offsetWidth` ép layout đồng bộ: 901 ms khi khởi động (4×), và cộng thêm vào INP mỗi lần đổi tab. | Khởi động lại hiệu ứng bằng `sc.animate(...)` (WAAPI), hoặc gỡ class rồi gắn lại ở `requestAnimationFrame` kế tiếp. |
| QU-08 | TB | `<head>` | JSZip tải **đồng bộ** từ cdnjs, chặn render. Google Fonts nạp 7 họ, trong đó 4 họ không còn dùng. | Chỉ `import` JSZip khi bấm "Đồng bộ Google Drive". Font chỉ giữ Inter 400/500/600/700, Inter Tight 600, JetBrains Mono 500 (nếu vẫn giữ ui-signature). Thêm `<link rel=preload>` cho 1–2 file woff2. |
| QU-09 | TB | `sw.js` | Chiến lược "mạng trước" cho **mọi** file: mạng chậm thì lần mở nào cũng phải chờ. Lúc cài, precache khoảng 1,1 MB tranh băng thông với lần mở đầu. Danh sách file và số phiên bản do người sửa tay. | Dùng stale-while-revalidate (hoặc cache-first) cho JS/CSS/ảnh; chỉ `index.html` đi mạng trước, có timeout 3 s. Precache sau sự kiện `load` và lúc rảnh. Để `prepare-www.sh` sinh `ASSETS` và băm phiên bản. |
| QU-10 | Thấp | Ảnh | 17 ảnh lúc mở, 0 ảnh lazy. Thumbnail 1080×1920 và ảnh Pexels 1080 px JPEG cho màn đang ẩn. | Thêm `loading="lazy" decoding="async"` và `width/height` cho mọi ảnh dưới mép màn. Ảnh Pexels dùng `w=480/720` + `srcset`. Chỉ tải thumbnail video khi thẻ hiện. |
| QU-11 | Thấp | Lưu trữ / DOM | 238 KB localStorage đọc mỗi lần mở. DOM tăng từ 7,6k lên 12,9k nút sau khi dùng. | Chuyển dữ liệu demo và cache lớn sang IndexedDB, đọc lười. Gỡ DOM màn module khi rời đi quá 60 s. |
| QU-12 | Thấp | Đổi theme | 723 ms (4×), 6 957 luật CSS. | Làm theo DESIGN-SYSTEM §5 bước 4 (chỉ dùng biến). Nạp `theme-packs.css` khi người dùng chọn gói. |
| QU-13 | Cao | Màn chào | CTA lớn "Bắt đầu ngay" mở **Tạo tài khoản**. Lối khách nằm phía dưới hoặc trong menu, nên người mới phải thêm 4–5 chạm và 3 ô nhập trước khi tới onboarding. | CTA chính = "Bắt đầu ngay" đi thẳng onboarding (khách). Mời tạo tài khoản sau khi xong buổi tập đầu, hoặc khi cần PT/đồng bộ. |
| QU-14 | Cao | Trang chủ → Tập luyện | "Bắt đầu tập" không bắt đầu buổi tập mà chỉ chuyển màn; người dùng phải bấm tiếp "Bắt đầu buổi tập". | Nút ở Trang chủ gọi thẳng `startSession(todayDayKey())`. Muốn xem trước thì để link phụ "Xem buổi hôm nay". |
| QU-15 | TB | PT | Sau khi chọn "Tôi là PT", màn PT vẫn mở tab "PT của tôi" (góc nhìn học viên). | Nhớ vai trò: `isPT` → mặc định tab "Học viên của tôi". Chỉ hiện tab "PT của tôi" cho PT nào cũng đang có PT riêng. |
| QU-16 | TB | Dashboard PT | Hai nút cùng việc ("Thêm học viên" / "Mời học viên · email/mã/QR"). Form thêm học viên không hỏi giới tính và trình độ, nên gợi ý "Nam · Mới tập" cho học viên nữ. | Gộp thành 1 nút "Thêm học viên", bên trong có lựa chọn mời bằng mã/email/QR. Thêm 2 chip Nam/Nữ và Mới/Trung bình/Nâng cao vào form. |
| QU-17 | TB | Dashboard PT | "Sắp hết gói" chỉ là chip lọc nằm sau khoảng 9 khối. | Thêm ô số "Sắp hết gói (N)" ở hàng đầu (bấm là lọc). Gửi thông báo khi còn ≤ 2 buổi hoặc ≤ 7 ngày. |
| QU-18 | TB | Menu ☰ | 22 mục, cao 2,1 màn. Trùng 2 mục với thanh dưới, 7 mục với Khám phá, 4 mục với lối tắt màn Tập luyện. | Rút còn ≤ 12 mục theo §3.2. Thêm ô tìm nhanh "Tìm trong TapEasy" ở đầu menu. |
| QU-19 | TB | Quản trị → Sự kiện | Đăng một sự kiện mất khoảng 10 chạm qua 2 giao diện. Hai nút cùng nhãn "Tạo". Form 20 trường, không có lưu nháp. | Thêm nút "Tạo sự kiện" và "Tạo thử thách" ngay trong mục quản trị. Đổi nhãn thành "Tạo thử thách" / "Tạo sự kiện". Thêm "Nhân bản" và lưu nháp tự động. Gom các trường tuỳ chọn vào mục "Thêm chi tiết". |
| QU-20 | TB | Trang chủ (người mới) | T2/T3 đánh dấu "bỏ lỡ" ngay ngày đầu (`pt.js:605`). | Chỉ đánh dấu bỏ lỡ từ ngày bắt đầu (`state.startDate` hoặc ngày onboarding). |
| QU-21 | Thấp | Tiến độ | Kỷ lục cá nhân nằm trong màn "Ảnh tiến trình & InBody". Ô Tiến độ đã bị bỏ khỏi Khám phá. | Đổi tên màn thành "Tiến độ" (Kỷ lục · Số đo · Ảnh). Thêm lối vào trong tab Tập luyện → "Nhật ký & kỷ lục". |
| QU-22 | Thấp | Buổi tập đầu | Người mới gặp ngay ô Kg trống, cột RPE 9 mức, và Deadlift ở "Cường độ Cao". | Ở cấp Mới tập: ẩn RPE, gợi ý "chưa biết? chọn mức nhẹ", thêm thẻ 3 dòng "Cách ghi hiệp". Báo agent PT xem lại bài đầu tiên. |
| QU-23 | Thấp | Tìm PT | "20 PT" hiện trên vùng trống vì thẻ chỉ hiện khi cuộn tới. | Hiện ngay 4 thẻ đầu, không chạy hiệu ứng `in`. |
| QU-24 | TB | Toàn app | Tên gọi không thống nhất (bảng §3.3). | Chốt bảng thuật ngữ UI trong `GLOSSARY-vi.md` §UI; tìm và thay theo bảng đó. |
| QU-25 | Thấp | Toàn app | Tiếng Anh và viết tắt (Routine, RPE, deload, RIR, ULPPL, "Đ2.7 · TB28"). Tên bài lúc Anh trước, lúc Việt trước. In hoa kiểu khẩu hiệu. | Việt hoá theo §3.3. Tên bài hiển thị theo `exdbVi.name()` dạng "Tên Việt (English)". |
| QU-26 | Thấp | Toàn app | Ba kiểu trạng thái rỗng/tải/lỗi. Không có thông báo mất mạng chung. | Chuyển findpt, shop, kb, admin và lõi sang `fkLoad/fkEmpty/fkError`. Thêm dải "Đang ngoại tuyến" toàn app (sự kiện `online/offline`). |
| QU-27 | Cao | Mọi màn | Nút icon không có tên (24/24 trong index.html, coach.js 12/12…). | Thêm `aria-label` ("Mở menu", "Hồ sơ", "Làm mới", "Quay lại", "Chỉnh mục tiêu"). Có thể vá chung trong `icons.js`: tự gán `aria-label` từ bảng tên icon → nhãn Việt nếu nút chưa có tên. |
| QU-28 | Cao | CTA | Coral + chữ trắng = 2,59:1. | Đổi `--on-coral:#061A24` (≈ 8:1), hoặc dùng nền `#C2410C` với chữ trắng (5,2:1). DESIGN-SYSTEM §2.1 đã khuyến nghị việc này. |
| QU-29 | Cao | Sheet (`openSheet`) | Không có role dialog hay aria-modal; focus không vào sheet và không bị giữ trong sheet; không trả focus khi đóng. | Trong `openSheet`: `role="dialog" aria-modal="true" aria-labelledby` (h3 đầu tiên); lưu `document.activeElement`; focus phần tử đầu tiên; đặt `#app-scroll` và `.bottom-nav` thành `inert`. Trong `closeSheet`: bỏ `inert`, trả focus về chỗ cũ. |
| QU-30 | Cao | Onboarding · Đăng ký | `.choice-card`, `.role-card`, `.metric`, `.streak-chip` là div (29 phần tử), không chọn được bằng bàn phím hay TalkBack. | Đổi sang `<button>`, hoặc `role="radio"` + `aria-checked` + `tabindex=0` + xử lý Enter/Space. |
| QU-31 | TB | Mọi màn | Chữ < 12 px: 8–23 phần tử mỗi màn; thanh dưới 10,5 px; dải tuần 9,5 px. | Quy đổi theo DESIGN-SYSTEM §3 (sàn 12 px). Riêng thanh dưới và dải tuần dùng 12 px. |
| QU-32 | TB | Điều khiển nhỏ | Icon thanh trên 38×38; tab ngày 36×26; "Thêm" 34×34; nút chỉnh 30×30. | Đặt `min-width/min-height: var(--fk-tap)` (biểu tượng có thể giữ 38 px, mở rộng vùng chạm bằng padding hoặc `::after`). |
| QU-33 | TB | Nhãn trùng | "Thêm" ×4, "Yêu thích" ×n, "Sửa"/"CSV" ×n; 4 ảnh bài tập thiếu alt. | Nhãn có ngữ cảnh: `aria-label="Thêm món vào Bữa trưa"`, `"Sửa sự kiện {tên}"`. Ảnh bài tập: `alt` = tên bài. |
| QU-34 | TB | Màn chào | Video tự phát cả khi bật reduced-motion, không có nút dừng (WCAG 2.2.2). | Bật reduced-motion hoặc `saveData` thì chỉ hiện poster. Thêm nút "Tạm dừng video" 44 px. |
| QU-35 | Thấp | Cấu trúc | Không có `<main>` hay `h1`; `nested-interactive`; `.nu-recipes` không focus được; một số phần tử không có viền focus. | `<main id="app-scroll">`, mỗi màn có `h1` (có thể ẩn bằng visually-hidden). Tách nút con ra khỏi thẻ bấm được. Thêm `tabindex=0` + `aria-label` cho vùng cuộn. Thêm `:focus-visible{outline:2px solid var(--mint)}` chung. |
| QU-36 | Thấp | 1280 px | App bó trong khung 460 px, kể cả Tìm PT, Gian hàng, Kho kiến thức, dashboard PT. | Từ ≥ 1024 px: dùng 2 cột cho Tìm PT, Gian hàng, Kho kiến thức, dashboard PT (danh sách + chi tiết); giữ khung điện thoại cho buổi tập. |

---

## 6. Kế hoạch tối ưu hiệu năng (xếp theo lợi ích/chi phí)

Lợi ích ước tính tại CPU 4×, người dùng quay lại. Chi phí: S ≤ 0,5 ngày · M 1–2 ngày · L ≥ 3 ngày.

| Bước | Việc | File chạm | Lợi ích ước tính | Chi phí |
|---|---|---|---|---|
| 1 | Bỏ `void sc.offsetWidth` trong `goto()`, khởi động lại hiệu ứng bằng WAAPI | app.js | Khởi động −0,9 s; INP mỗi lần đổi tab −100 đến −300 ms | **S** |
| 2 | JSZip nạp khi cần; bớt Google Fonts còn 3 họ; preload woff2 | index.html, app.js (Drive) | Bỏ được 1 script bên thứ ba chặn render; bớt khoảng 20 file font; FCP −0,3 đến −0,6 s trên 4G | **S** |
| 3 | Không vẽ trước màn ẩn (Dinh dưỡng, Hồ sơ…); ghi nhớ `buildDayPlan`; vẽ thực đơn gợi ý lúc rảnh | app.js / nutrition.js / nutrition-pro.js | Dinh dưỡng lần đầu 4,3 s → < 0,8 s; khởi động −0,5 đến −1 s; bớt 2 000 nút DOM | **S–M** |
| 4 | Dữ liệu demo (ptdir, events, social: 206 KB) sinh khi mở module; việc phụ lúc khởi động (freevideos index, `kb.todayPick`, icons quét lại) chuyển vào `requestIdleCallback`; `appBoot` nhường luồng | cloud-*.js, freevideos.js, kb.js, icons.js, pt.js | TBT −1 đến −1,5 s; lần đầu còn khoảng 1/2 | **S–M** |
| 5 | **Nạp lười module theo màn**: `loadModule("findpt")` chèn `<script>`/`<link>` khi bấm ô Khám phá hoặc mục menu. Giữ trong lõi các "stub" nhỏ (ô Khám phá, dòng menu, `teCan`) | index.html, pt.js (`teHomeExplore`), app.js (menu) + 1 file `loader.js` mới | JS lúc mở 2,9 MB → khoảng 1,1 MB gốc (≈ 330 KB gzip); TBT 3,2 s → khoảng 1 s; DCL 6,9 s → khoảng 3 s. Mở module lần đầu tốn thêm 100–300 ms tải (đã có cache SW thì 0) | **M** |
| 6 | Dữ liệu lớn nạp lười: `kb-data-1..6` (cần thêm `kb-index.js` khoảng 5 KB cho "Kiến thức hôm nay"), `exdb-vi-1..3` (khi vào Thư viện bài tập / chi tiết bài), `meals-extra`, `shop-data` | kb.js, exdb-vi.js, nutrition.js, shop.js | −666 KB gốc, −209 KB gzip lúc mở | **S–M** |
| 7 | Service worker: SWR cho tài nguyên tĩnh, mạng trước + timeout chỉ cho HTML; precache sau `load`; `ASSETS` và băm phiên bản sinh tự động | sw.js, scripts/prepare-www.sh | Người quay lại trên web/PWA: mạng ≈ 0 (thường TTI −1 đến −2 s trên Slow 4G); bỏ lỗi quên tăng số cache | **S** |
| 8 | Cuộn mượt: bỏ parallax dựa trên scroll ở findpt; thêm `content-visibility:auto` cho danh sách thẻ (Tìm PT, Cộng đồng, Gian hàng, Thư viện bài tập); thẻ không blur; mở rộng điều kiện bật `lowfx` (Android `deviceMemory ≤ 4` hoặc `hardwareConcurrency ≤ 6`, hoặc fps đo được < 45) | findpt.js/.css, community.css, shop.css, themes.js | Cuộn 22–29 fps → ≥ 50 fps (4×); GPU nhẹ hơn rõ trên máy thật | **S–M** |
| 9 | Ảnh: lazy, kích thước đúng, WebP/AVIF qua `srcset`; Pexels `w=480/720`; poster màn chào; thumbnail video chỉ tải khi hiện | data.js, video.js, pt.js (màn chào), library.js | Lần đầu −0,5 đến −1,5 MB tải; LCP −1 s trên 4G | **S** |
| 10 | Giảm `backdrop-filter`: còn ≤ 5 nhóm (thanh dưới, sheet, nền sheet, nút tròn thanh trên, thẻ hero); thẻ trong danh sách dùng `--glass-solid` | style.css, CSS module, theme-packs.css | Giảm chi phí vẽ trên GPU di động (Trang chủ 40 → khoảng 6 phần tử blur) | **M** |
| 11 | **Gộp + minify** bằng bước build không cần framework (esbuild): `core.js` + `core.css` cùng các chunk theo module; tách `themes-modules.css` theo từng module; xoá luật chết (DESIGN-SYSTEM §5) | scripts/build.mjs mới, prepare-www.sh | Dung lượng gốc −35 đến −45 %, gzip −15 đến −20 %; bớt khoảng 60 lần biên dịch script; 74 request → khoảng 6 + chunk | **M–L** |
| 12 | Theme chỉ dùng biến; gói theme nạp khi chọn | themes.css, style.css, theme-packs.* | Đổi theme 723 → < 150 ms; CSS lúc mở −30 % | **L** |

Thứ tự đề xuất là bước 1 → 2 → 3 → 4 → 7 → 9 (1 sprint, toàn bước rẻ), sau đó bước 5 → 6 → 8, cuối cùng 10 → 11 → 12. Ước tính sau sprint đầu: TTI (4×) khoảng 7,4 → 4,5 s. Sau bước 5–6: khoảng 3 s.

### Ngân sách hiệu năng đề xuất (đưa vào `tests/` như một suite cảnh báo)

| Hạng mục | Ngân sách |
|---|---|
| JS lúc mở | ≤ 350 KB gzip, ≤ 12 script |
| CSS lúc mở | ≤ 60 KB gzip |
| Font | ≤ 4 file woff2 |
| Ảnh lúc mở | ≤ 300 KB |
| TTI (4× CPU, 4G) | ≤ 3,5 s |
| TBT | ≤ 600 ms |
| INP | ≤ 200 ms cho mọi tab chính và ≤ 300 ms khi mở module |
| CLS | ≤ 0,1 |
| Cuộn danh sách | ≥ 50 fps |
| `backdrop-filter` trong khung nhìn | ≤ 8 phần tử |

---

## 7. Điểm

| Tiêu chí | Điểm | Cơ sở |
|---|---|---|
| Mượt | **4/10** | CPU 1× tốt (TTI 0,9 s). CPU 4×: TTI 7,4 s, TBT 3,2 s, Dinh dưỡng 4,3 s, mở module 0,8–1,4 s, cuộn 22–29 fps ở 3 màn module. Không rò bộ nhớ (heap 5,7–7,4 MB). |
| Dễ dùng | **6/10** | Thao tác lõi ít chạm: ghi hiệp 2, ghi món 4, giao giáo án 8, duyệt PT 5, xếp lịch 1. Việc cần làm của PT và Quản trị chủ động gợi ý. Bị trừ điểm vì: CTA màn chào dẫn tới đăng ký, phải bấm "Bắt đầu" 2 lần, PT vào nhầm tab, menu 22 mục, đăng sự kiện 10 chạm, chấm "bỏ lỡ" cho người mới. |
| Truy cập | **4/10** | Điểm tốt: tôn trọng reduced-motion (CSS), Esc đóng sheet, bảng quản trị là dialog, thẻ món ăn có role, ô nhập 16 px, không tràn ở 360 px. Điểm trượt: nút không tên, CTA 2,6:1, sheet không giữ focus, onboarding không dùng được bằng bàn phím, chữ < 12 px, vùng chạm 30–38 px. |
| Nhất quán | **5/10** | Có token và ui-kit, nhưng module dùng 3 kiểu trạng thái; tên gọi lệch nhau ở 6 khái niệm; tiếng Anh xen kẽ; tên bài theo 2 thứ tự; style.css còn 4 họ font cũ. |

---

## 8. File kèm (`outputs/_test/qa-ux/`)

- `qa-ux-harness.js`: thiết lập ngữ cảnh `qa-ux`, phục vụ qua http, mô hình mạng, các hàm `load` / `tap` (INP) / `scrollFps` / `metrics`.
- `a11y-audit.js`: kiểm tương phản, cỡ chữ < 12 px, vùng chạm < 44 px, tràn ngang.
- `results.json`: toàn bộ số liệu thô trong báo cáo.
- `sizes.json`: kích thước gzip từng file; `blank.html`: trang trống để xoá storage.
- Ảnh: `ux-360-welcome.png`, `ux-360-home.png`, `ux-360-session.png`, `ux-360-menu.png`, `ux-360-pt-dash.png` (vào nhầm tab "PT của tôi"), `ux-360-pt-students.png`, `ux-360-pt-client.png`, `ux-360-admin.png`, `ux-360-events-admin.png`, `ux-1280-home.png`, `ux-1280-findpt.png`.

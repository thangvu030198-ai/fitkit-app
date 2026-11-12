# Icon biến hình — `morph-icons.js` + morphicons (MIT)

Icon nét của TapEasy (bảng `FK_LINE` trong `icons.js`) biến hình mượt kiểu lò xo khi đổi trạng thái, dùng thư viện
[morphicons](https://www.morphicons.com) (npm `morphicons`, MIT, không phụ thuộc gì; mọi instance dùng chung 1 `requestAnimationFrame`).

## Thành phần

| File | Vai trò |
|---|---|
| `morph-icons.js` | Module của app: đổi `FK_LINE` → `d`, API `fkMorph`, nạp lười thư viện, gắn vào các điểm chuyển trạng thái |
| `vendor/morphicons.min.js` | Thư viện tự host, IIFE, global `Morphicons` (`createMorph`, `setRegionLoader`, …) — **tạo bằng workflow**, chưa có trong repo cho tới lần chạy đầu |
| `vendor/morphicons.LICENSE`, `vendor/morphicons.VERSION` | Giấy phép MIT của gói + phiên bản / sha256 / thời điểm build |
| `.github/workflows/vendor-morphicons.yml` | Tải `morphicons@latest` (hoặc phiên bản chỉ định) + esbuild, đóng gói, kiểm, commit `vendor/` |
| `tests/suites/69-morph-icons.test.js` | Kiểm Node (11 test) |
| `tests/browser/t_morph.js` | Kịch bản trình duyệt thật với thư viện giả |

`index.html`: `<script src="morph-icons.js" defer>` ngay trước `health-safety.js` (health-safety vẫn là thẻ script cuối).
Vì `defer`, module chạy sau khi trang phân tích xong; nó **không bọc hàm render** nên thứ tự không ảnh hưởng lớp an toàn
(chỉ bọc `startSetRest`/`stopSetRest` để đặt lại nút tạm dừng nghỉ). CSP `script-src 'self'` đủ vì thư viện tự host.

## Cách hoạt động

1. **Nạp lười**: sau sự kiện `load` + 1,2 s + `requestIdleCallback`, hoặc ngay lần chạm đầu (`pointerdown`), chèn
   `vendor/morphicons.min.js` qua `fkLazy._inject` (nếu có, đăng ký `__fkLazyDone`) hoặc thẻ `<script>` riêng.
   Không tải khi `prefers-reduced-motion: reduce`. Lỗi tải (chưa vendor / offline) → nhớ lại, thử lại khi có sự kiện `online`.
2. **FK_LINE → d**: mỗi phần `|` được đọc thành lệnh **tuyệt đối** (m/l/h/v/c/s/q/t/a/z → hoa, cặp số sau M thành L, cờ cung viết dính
   `011` đọc đúng); `c:cx,cy,r` → 2 cung `A`; `r:x,y,w,h,rx` → `H/V` + 4 cung `A` bo góc. Gộp thành 1 chuỗi `d` cho 1 `<path>`.
   Biến thể dùng cho hiệu ứng: `_s:tên` (thu 50 % quanh tâm), `_m:tên` (80 %), `_ring` (vòng tròn). Bảng `EXTRA` dự phòng
   các icon module khác thêm (pause, visibility_off, favorite, bookmark, light/dark_mode, palette, chevron_left, expand_less/more).
3. **Biến hình**: tìm `<span class="material-symbols-rounded">` trong host (hoặc `<svg>` trực tiếp của host), thay bằng
   `<svg class="ln fk-mi" aria-hidden="true" …><path/></svg>` (nét 1,8 như icons.js), `createMorph(path, dCũ, { reducedMotion:"user", strokeWidth:1.8 })`
   rồi `morphTo(dĐích, spring)`. Bấm tiếp giữa chừng → dùng lại instance (bay tiếp từ hình đang có). `span.dataset.ic` luôn = tên đích.
   Instance có svg đã rời DOM được `destroy()` lúc tạo morph mới.
4. **Không biến hình được** (không có thư viện, reduced-motion, `fkMorph.disabled = true`, tên không có trong FK_LINE) → đổi icon
   **tức thì** bằng `fkIconSvg(tên)` như cũ; không bao giờ ném lỗi.

## API

```js
fkMorph(hostEl, "close", { spring: "snappy" | "smooth" | "bouncy", from: "menu" | "_s:menu", label: "Đóng menu" })  // → true nếu đang biến hình
fkMorph.d("favorite")          // chuỗi d (null nếu không có)
fkMorph.spec2d("c:12,12,3")    // "M9 12A3 3 0 1 0 15 12A3 3 0 1 0 9 12Z"
fkMorph.ready() · fkMorph.load() → Promise<bool> · fkMorph.reduced() · fkMorph.disabled = true
```
`label` đặt `aria-label` cho nút chứa icon (svg luôn `aria-hidden`).

## Điểm áp dụng (listener uỷ quyền `click` pha capture trên `document` + MutationObserver, không sửa file lõi)

| Trạng thái | Phần tử (file gốc) | Hiệu ứng |
|---|---|---|
| Mở / đóng menu | `.btn-menu-trigger`, `.btn-menu-trigger-nu` (index.html, nutrition.js) + lớp `open` của `#sheet-backdrop` | ☰ → ✕ (snappy), aria-label "Đóng menu"; đóng sheet → ☰, khôi phục nhãn |
| Video nền màn chào | `.wl-vid-toggle` (video.js), `.fk-vid-toggle` (ui-kit.js) | pause ↔ play_arrow |
| Đồng hồ nghỉ giữa hiệp | `#set-rest` (app.js, training-pro.js) — **thêm nút `#fk-rest-pause`** 44 px | Tạm dừng: dừng đếm + huỷ thông báo, pause → play_arrow, nhãn "Tiếp tục đếm nghỉ"; Tiếp tục: `startSetRest(giây còn lại)` |
| Tick hiệp xong | `.set-check` trong `.set-row.done` (app.js, training-pro.js, pt-connect.js) | vòng tròn → ✓ (bouncy); bỏ tick: nảy nhẹ |
| Bài xong trong danh sách | `#exercise-list .check.checked` (app.js) | ô vừa xong: vòng → ✓ |
| Đi chợ đã mua | `[data-np-done] .np-chk` (nutrition-pro.js) | vòng → ✓ |
| Yêu thích / lưu | `[data-np-fav]`, `#np-q-fav`, `#np-r-fav` (nutrition-pro.js), `[data-cm-like]`, `.cm-act[data-act=like]`, `[data-cm-save]`, `.cm-act[data-act=save]` (community.js), `[data-fp-save]` (findpt.js) | bật: tim/bookmark nảy từ dạng nhỏ; tắt: về dạng thường |
| Hiện / ẩn mật khẩu | mọi `input[type=password]` — **thêm nút mắt** `.fk-pw-eye` (44 px, `aria-pressed`, `aria-controls`) | visibility ↔ visibility_off, nhãn "Hiện/Ẩn mật khẩu" |
| Ẩn / hiện số calo | `[data-nu-kcal]` → `.nu-kcal-eye` (nutrition.js) | mắt ↔ mắt gạch |
| Mở rộng / thu gọn | `[data-toggle-meal]` (nutrition.js); mọi `<details>` có chevron trong `<summary>` (kb.js, events.js…) | chevron lật chiều |
| Theme sáng ↔ tối | lớp `fk-light`/`fk-dark` của `<html>` (themes.js) | icon tiêu đề thẻ Giao diện: mặt trời ↔ trăng, 1,6 s sau về bảng màu |
| Thêm món thành công | số món trong `state.foodLog` tăng → `.nu-mini[data-add-meal]` (nutrition.js) | "+" → ✓ (bouncy), 1,5 s sau về "+" |
| Thanh điều hướng dưới | `.bottom-nav .nav-item` vừa thành `active` | icon nảy từ dạng thu nhỏ (bouncy) |

Không áp dụng: nút `.vp-play` của trình phát video bài tập — nút bị ẩn (CSS) ngay khi phát, trình phát dùng điều khiển gốc
nên không có trạng thái tạm dừng nào hiển thị để biến hình.

## Tạo / cập nhật thư viện (workflow)

GitHub → **Actions → "Vendor — morphicons (icon biến hình, MIT)" → Run workflow** (ô *version* để trống = latest, hoặc vd `2.0.2`).
Workflow cũng tự chạy khi sửa chính file workflow. Các bước: `setup-node` 20 → `npm i morphicons@<v> esbuild` (thư mục tạm) →
entry `export * from "morphicons/dom"` → `esbuild --bundle --format=iife --global-name=Morphicons --minify` → kiểm chạy được
(createMorph trên path giả) → ghi `vendor/morphicons.min.js`, `vendor/morphicons.LICENSE` (LICENSE của gói, thiếu thì sinh MIT
từ `author`), `vendor/morphicons.VERSION` → commit + push.

Chunk "region" (chuẩn hoá vùng TÔ ĐẶC, `dom.js` nạp bằng `import()` động): esbuild IIFE không chia chunk nên gộp luôn vào bundle —
không có file rời, không cần `setRegionLoader`. App chỉ dùng icon nét nên phần này không bao giờ chạy.

Sau khi `vendor/` có file: `scripts/prepare-www.sh` chép vào `www/vendor/` và thêm vào ASSETS của `sw.js`;
`scripts/build-single-html.py` nhúng thư viện ngay trước `morph-icons.js` (không có file thì bỏ qua, in cảnh báo).
`sw.js` gốc liệt kê `morph-icons.js` (cache v11); không liệt kê tĩnh file vendor vì test kiểm mọi file trong ASSETS phải tồn tại.

## Kiểm thử

```bash
node tests/run.js --only 69-morph         # 11 test: d hợp lệ cho mọi icon FK_LINE + biến thể; thiếu thư viện; thư viện giả; reduced-motion; đóng gói
python3 scripts/build-single-html.py ../_test/morph/morph.html --offline --test tests/browser/t_morph.js
# Playwright, context riêng "morph", 390×844, phục vụ file qua route.fulfill → "PASS 19/19 ERR 0"
```
Bản không có thư viện (`_test/morph/nolib.html`): tải `vendor/morphicons.min.js` 1 lần (404), menu đổi icon tức thì, 0 lỗi JS.

## Giới hạn

- Thư viện thật chưa được chạy trong sandbox (không có mạng/npm) — kiểm bằng thư viện giả theo API chính thức
  (`createMorph(path, icon, { reducedMotion, strokeWidth })` → `morphTo/set/seek/progress/destroy`). Bước kiểm trong workflow chạy bundle thật.
- Trong lúc biến hình (và sau đó, tới khi app vẽ lại) icon là 1 `<path>` thay vì nhiều `<path>/<circle>`; CSS nhắm `svg circle` riêng sẽ không áp.
- Nút ✓ của "Thêm món" dựa vào số món trong nhật ký tăng — đồng bộ đám mây đổ thêm món cũng có thể làm nút nảy (vô hại).

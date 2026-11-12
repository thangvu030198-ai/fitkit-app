# Cảm giác bấm — press-feel.js / press-feel.css (12/11/2026)

Mục tiêu: mọi nút/thẻ phản hồi **ngay lúc ngón tay chạm** (không đợi `click`), lún có trọng lượng, thả ra bật lò xo, rung xúc giác đúng ngữ cảnh — và **không bao giờ nháy mờ lớp kính**.

## Gắn vào app
| Nơi | Thay đổi |
|---|---|
| `index.html` | `<link rel="stylesheet" href="press-feel.css">` **ngay trước** `brand.css` (brand.css → themes-modules.css vẫn là 2 stylesheet cuối) · `<script src="press-feel.js">` **ngay trước** `morph-icons.js` (health-safety.js vẫn cuối) |
| `sw.js` | ASSETS + `press-feel.css`, `press-feel.js`; cache `fitkit-v12` |
| `scripts/prepare-www.sh` | chép 2 file vào `www/` |
| `scripts/build-single-html.py` | nhúng như mọi file của index.html + in xác nhận/cảnh báo thiếu |
| `package.json` | `@capacitor/haptics ^6.0.2` (**chưa npm install** — CI `npm install` + `npx cap sync` sẽ cài; thiếu plugin → web dùng `navigator.vibrate`, iOS web không rung) |
| `themes-modules.css` | sinh lại bằng `python3 scripts/gen_themes_layer.py --modules` |
| `tests/suites/50-theme-packs.test.js` | cho phép `press-feel.js` xen giữa ui-signature.js và health-safety.js (như morph-icons.js) |

Không sửa file lõi: chỉ bọc theo tên toàn cục `toast`, `openSheet`, `closeSheet`, `finishSession`, `setAuthBusy`, `renderProfileScreen` và vá `addEventListener` cho listener `click`.

## Hành vi
1. **Nhấn lún tức thì** — 1 listener uỷ quyền (`pointerdown/move/up/cancel`, `scroll`, `dragstart`, pha capture trên `document`). Áp cho `.btn, .icon-btn, .pill, .chip, .choice-card, .role-card, .list-item[onclick|role=button], .card[onclick|role=button], .metric, .bottom-nav button, .seg button, [role=button|tab|switch], button, .nav-item, .entry-tile, .set-check, .toggle, .fk-theme-opt, .wl-cta, [data-press]`. Bỏ qua: `disabled`, `aria-disabled=true`, `fieldset[disabled]`, ô nhập, `[role=slider]`, `.sig-slide*` (trượt xác nhận), `[data-no-press]`.
   - Lún: `translateY(1px) scale(.96)` nút nhỏ · `.975` nút rộng > 200 px · `.98` thẻ lớn; lớp phủ inset `rgba(var(--fk-ink-rgb), .07)` (theme tối sáng lên, theme sáng tối đi) + bóng thu lại; CTA nền đặc thêm `brightness(.92)`.
   - Nhấn 70 ms `cubic-bezier(.2,0,0,1)` · thả **lò xo 220 ms** `cubic-bezier(.34,1.56,.64,1)`; chạm cực nhanh vẫn giữ lún tối thiểu 90 ms để mắt kịp thấy (không trễ click).
   - Kéo/cuộn > 8 px, `pointercancel`, cuộn, mất focus cửa sổ → huỷ (không lún khi vuốt danh sách).
2. **Chống nháy kính** (bài học onboarding 12/11): không bao giờ transform phần tử *đang* có `backdrop-filter`.
   - Nút nhỏ có kính (pill, icon-btn, btn-outline…) → `.pf-noblur` tắt blur trong lúc nhấn + lò xo (gỡ sau 280 ms khi đã đứng yên) rồi mới scale. Nếu luật khác vẫn giữ blur → `.pf-glass`.
   - Thẻ lớn còn kính, hoặc phần tử **chứa con có kính** → `.pf-glass`: chỉ phủ màu + sáng viền, không transform (ghi đè cả `:active` cũ như `.btn:active`, `.fk-theme-opt:active`).
   - Phần tử tự dùng transform để định vị → `.pf-still` (không ghi đè). `html.lowfx` không có kính → thẻ lún bình thường.
   - Thẻ onboarding (không kính từ bản sửa 12/11) được lún 0,98 an toàn.
3. **Gợn sóng** mảnh cho CTA (`.btn-primary, .wl-cta, .btn-cta, [data-ripple]`…) và `.list-item`: chấm tròn mép mềm `currentColor`/`--mint`, α .14, 460 ms; khung `.pf-rpl` tự cắt theo bo góc (không đổi `overflow` của nút).
4. **Rung**: `Capacitor.Plugins.Haptics` khi native — chạm thường `impact LIGHT`, CTA/tick hiệp/`.btn-fab` `impact MEDIUM`, tab dưới/seg/pill/chip/tab `selection`, toast ✓ sau một chạm (≤ 4 s) và `finishSession` ("Xong buổi tập") `notification SUCCESS`, toast lỗi `ERROR`. Web: `navigator.vibrate` 10/15/8 ms, success `[12,60,15]`. Chỉ rung với chạm thật (`isTrusted` + pointerdown ≤ 1,5 s). Ghi đè: `data-haptic="none|light|medium|selection|success"`.
   - Công tắc **Hồ sơ → Cảm giác chạm → "Rung khi chạm"** (`#pf-card` ngay sau thẻ Giao diện, `role=switch`, cao ≥ 44 px), lưu `state.pressFeel = { haptic: bool }`, **mặc định BẬT**; bật lại → rung thử MEDIUM.
5. **Bỏ trễ chạm**: `touch-action:manipulation`, `-webkit-tap-highlight-color:transparent`, `user-select:none` + `-webkit-touch-callout:none` trên nút, `cursor:pointer` (tất cả trong `:where()` → độ ưu tiên 0, không đè luật module).
6. **Trạng thái chờ** `fkBusy(btn, promise|fn)` → trả lại đúng promise; khoá bấm đôi ngay (click bị chặn ở pha capture), spinner 18 px theo màu chữ nút sau 120 ms (tác vụ nhanh không nháy), mở khi resolve/reject hoặc tối đa 20 s. Tự áp:
   - mọi listener `click` trả về Promise (`async ()=>{…}`) gắn **sau** khi file nạp (màn vẽ lười → phần lớn nút: sao lưu Drive, phân tích ảnh AI, gian hàng, cộng đồng…); bỏ qua uỷ quyền cấp `document`/`body`; tắt bằng `data-no-busy`;
   - nút `data-busy[="ms"]` (khi handler không trả promise): khoá đến lần `toast/openSheet/closeSheet` kế tiếp, `fkBusy.done(btn)` hoặc hết hạn;
   - đăng nhập/đăng ký/quên mật khẩu: bọc `setAuthBusy` → spinner trên `#au-submit`.
7. **Nảy công tắc/tick/tim** `.pf-pop` (340 ms, lò xo): `.toggle` (núm giãn), `[role=switch]` (nảy núm bên trong), checkbox, `.set-check`, `.list-item .check`, `[aria-pressed]`, `.np-fav`, `.cm-act`. Phối hợp morph-icons: morph đổi hình icon bên trong, press-feel chỉ nảy vỏ nút; phần tử có kính thì nảy lớp con.
8. **Giảm chuyển động** (`prefers-reduced-motion`): `.pf-still` — không scale/sóng/nảy, chỉ đổi màu nền nhẹ; spinner quay chậm 1,6 s.

API: `fkPress.haptic(kind)`, `fkPress.enabled()`, `fkPress.set(on)`, `fkPress.canVibrate()`, `fkBusy(btn, p)`, `fkBusy.done(btn)`, `fkBusy.isBusy(btn)`; nội bộ cho test `fkPress._h`.

## Kiểm thử
- `node tests/run.js --only 71-press` — 12 test (pointerdown → `.is-pressed`, thả → gỡ + dọn lớp, > 8 px huỷ, disabled/slider không áp, kính → `.pf-glass`/`.pf-noblur` + CSS mọi luật scale có `:not(.pf-glass):not(.pf-still)`, reduced-motion, gợn sóng, Capacitor giả đúng loại rung, tắt công tắc không rung, fkBusy/listener async/data-busy/setAuthBusy, nảy, CSS token/≥ 12 px). Toàn bộ suite 00–71 xanh (chạy từng `--only`).
- Trình duyệt: `python3 scripts/build-single-html.py _test/press.html --offline --test tests/browser/t_press.js` → Playwright context riêng 390 px: **PASS 12/12, 0 lỗi JS**.
  - Bất biến chống nháy: 11 theme × (kính | lowfx) × 3 màn = 66 tổ hợp, 785 phần tử bấm: 587 lún, 10 kính-chỉ-phủ-màu, 13 tắt-blur-tạm — **0 phần tử vừa transform vừa có kính**.
  - Độ trễ: chạm thật (Playwright mouse) `event.timeStamp` → khung hình đầu tiên đã đổi giao diện: trung vị ~12 ms, tối đa 14 ms sau lần đầu (lần đầu nguội 23 ms); bộ xử lý pointerdown (mọi listener) trung vị 2,6 ms.
  - Onboarding: thẻ chọn lún `matrix(.98…)`, `backdrop-filter: none`; chuỗi 12 ảnh khung khi nhấn/thả có năng lượng cạnh ổn định 9,4–10,6 (không có khung mờ).
  - Ảnh/video: `_test/press-truoc-sau-4-theme.png` (Mặc định · Sáng · Aurora · Alpine, trước/đang nhấn), `_test/press-onboarding-khung.png`, `_test/press-shots/`, `_test/press-video/press-feel-cham-that.webm`.

## Giới hạn
- Listener `click` async gắn **trước** khi press-feel.js nạp (màn đầu tiên lúc khởi động) không tự có spinner — dùng `fkBusy()`/`data-busy`. Đăng nhập đã xử lý qua `setAuthBusy`.
- Thẻ lớn còn kính (không lowfx) không lún vì lý do chống nháy — chỉ phủ màu + viền (giống ô danh sách iOS).
- Khi quay video Playwright, Chrome có thể bắn `blur` cửa sổ → nhấn bị huỷ; đo/chụp ở context không quay.
- iOS Safari web không hỗ trợ `navigator.vibrate` — rung chỉ có trong app Capacitor sau khi cài `@capacitor/haptics`.

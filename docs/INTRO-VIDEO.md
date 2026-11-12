# Video giới thiệu TapEasy (intro) — storyboard, cách dựng, cách sửa

Ra: `media/intro/tapeasy-intro-1080x1920.mp4` (dọc, TikTok/Reels), `media/intro/tapeasy-intro-1920x1080.mp4` (ngang),
kèm `*-poster.jpg`. H.264 CRF 20 (trần 3 Mbps để file < 100 MB), yuv420p, BT.709, `+faststart`, 30 fps (tuỳ chọn 60),
AAC 192k chuẩn hoá −14 LUFS / đỉnh thật ≤ −1 dBTP. Thời lượng **3:50** (111 ô nhịp ở 116 BPM).
**Video không hiện URL/tên miền nào** (không github.io/github): bản tải miễn phí gửi trong nhóm Zalo
**TapEasy Cộng Đồng** — đoạn kết là mã QR nhóm (`scripts/intro-video/assets/zalo-community-qr.jpg`).

## 1. Chạy

**GitHub Actions** (có mạng, thấy đủ ảnh AI/video): tab *Actions* → **Media — video giới thiệu TapEasy** → *Run workflow*.
Tham số: `app_url` (mặc định bản live — **chỉ để chụp app**, không hiện trên video), `fps` (30/60), `scale` (3 = @3x), `commit` (true → commit `media/intro`).
3 bước: `capture` (~15 phút + QA khít `qa_fit.py` dọc/ngang, chặn nếu còn URL trong timeline) → `render` 2 khổ × 3 phần song song (~30–60 phút/phần) → `publish` (ghép, nhạc, QA, commit).
Artifact **tapeasy-intro** chứa 2 MP4 + poster + ảnh QA (`build/qa/…`: contact sheet, dải quanh mỗi chuyển cảnh, báo cáo nháy sáng,
`qr_end.jpg` + dòng "QR cuối phim: ĐẠT"; `fit-v/`, `fit-h/`: báo cáo khít + `fit_corners.jpg` 4 góc màn phóng ×4).

**Máy có mạng** (Python 3.11, `pip install playwright numpy pillow opencv-python-headless`, `python -m playwright install chromium`, ffmpeg):
```bash
cd scripts/intro-video
python3 prep.py                                   # timeline.json → build/timeline.js (+ resolved.json, needs.json, qr-card.png)
python3 fetch_assets.py                           # ảnh nền people-ai + khung clip màn chào
python3 capture_app.py --url https://thangvu030198-ai.github.io/fitkit-app/
python3 qa_fit.py --fmt v && python3 qa_fit.py --fmt h   # ảnh app khít màn mockup ≤ 1 px (mã thoát 1 nếu trượt)
python3 render.py --fmt v --draft --end 20        # nháp 540p 20 s đầu (không nhoè)
python3 render.py --fmt v && python3 render.py --fmt h
python3 music.py && python3 finalize.py --fmt v --fmt h --dest ../../media/intro
python3 qa.py ../../media/intro/tapeasy-intro-1080x1920.mp4
```
Xem thử 1 khung: mở `scripts/intro-video/compose.html?w=1080&h=1920&t=63.5` (hoặc `&play=1&from=60` phát thời gian thực).
Không có `build/manifest.js` thì màn điện thoại hiện khung giả “SHOT …” — vẫn dựng được để thử chuyển động.
Máy **không có Playwright/Chromium**: `python3 preview_fit.py --fmt v --times 31.13,45.42 --corners 45.42 --out build/preview/v.html`
tạo 1 file HTML tự chứa (ảnh nhúng data-URI) dựng nhiều khung song song + bảng đo khít — mở bằng trình duyệt bất kỳ.

## 2. Kiến trúc (`scripts/intro-video/`)

| File | Việc |
|---|---|
| `timeline.json` | **Nguồn duy nhất**: chương, shot, cuộn, chạm, soi cận, phụ đề, chuyển cảnh — đơn vị *phách* |
| `prep.py` | Đổi phách → giây; sinh danh sách sự kiện âm thanh (whoosh/click/riser/impact) |
| `director.js` | Chạy **trong app** (addInitScript): vùng an toàn iPhone giả lập 47 px trên / 34 px dưới (viết lại mọi `env(safe-area-inset-*)` của app thành px, cảnh báo `SAFE` nếu chữ/nút lọt vào dải trạng thái/home), dữ liệu demo 4 tuần (`seedHistory`, tài khoản PT demo cục bộ `seedPT`), 70+ hàm dựng màn (`goto`, `openSheet`, `fkTheme.set`, `FKAch.open`…) |
| `capture_app.py` | Playwright 390×844 @3x (kiểm mỗi ảnh đúng 390·s×844·s px; ghi `manifest.safe`): mỗi shot = ảnh toàn màn + các **dải cuộn** của vùng cuộn + toạ độ điểm chạm → `build/shots`, `build/manifest.js` |
| `fetch_assets.py` | Ảnh nền (people-ai, đen trắng/teal khi dựng), clip màn chào → khung JPEG |
| `compose.html/.css/.js` | Bộ dựng `makeComposer()` → `window.__render(t)` thuần (không Date.now/random); điện thoại tự vẽ (khung titan CSS, dynamic island, nút cạnh, thanh trạng thái 9:41 SVG, thanh home — không logo/biểu tượng Apple). `window.__probe()` đo khít; `?qa=fit`/`?qa=scr` tô màu cho `qa_fit.py` |
| `qa_fit.py` | ~300 mốc (giữa shot, chuyển màn, ±0,03–0,45 s quanh mọi zoom/whip/xoay 3D/match/sweep/flood, soi cận): khung bao ảnh app (magenta) vs vùng màn (xanh) ≤ 1 px, 0 điểm hở trong màn, DOM probe, tỉ lệ ảnh 390:844 → `build/qa/fit-<fmt>/` |
| `preview_fit.py` | Trang HTML tự chứa để xem/đo khung khi không có Chromium |
| `render.py` | Chụp khung tuần tự → ffmpeg; nhoè chuyển động bằng khung con (màn trập 180°, không trộn qua mốc cắt); chia đoạn 600 khung, chạy lại tự bỏ qua đoạn đã xong |
| `music.py` | Nhạc tự tổng hợp 116 BPM La thứ (kick/hat/clap/bass/pad/arp) + SFX đặt theo đỉnh âm |
| `finalize.py` | Nối đoạn, ghép nhạc, loudnorm 2 lượt, poster, tự nén lại nếu > 95 MB |
| `qa.py`, `contact_sheet.py` | Contact sheet 0,3 s sau mỗi mốc, dải ±10 khung quanh mỗi chuyển cảnh, quét nháy sáng 1 khung, khung 0 không đen |

## 3. Storyboard (mốc giây ở 116 BPM)

| # | Thời gian | Chương | Màn app thật (shot) | Chuyển ra |
|---|---|---|---|---|
| — | 0:00–0:16 | Mở đầu: clip gym đen trắng, logo lộ bằng mặt nạ + vạch mint, “TẬP ĐÚNG / TIẾN BỘ / THẬT SỰ” đập theo phách (impact), điện thoại nổi lên lướt màn chào | welcome (cuộn 1320 px, chạm “Dùng ngay”) | **zoom xuyên** vào điểm chạm |
| 01 | 0:16–0:31 | Hồ sơ & sàng lọc sức khoẻ — đếm “5 bước” | ob0–ob4 (chạm từng lựa chọn), health, health2 (PAR-Q+), profile | **whip pan** liền mạch |
| 02 | 0:31–0:45 | Trang chủ, lịch tuần, chuỗi ngày — “18 ngày” | home0 (soi cận lịch tuần), workout, progress | **xoay 3D** điện thoại |
| 03 | 0:45–1:00 | Giáo án mẫu / tự tạo | templates, tplDetail, builder, plans | zoom xuyên |
| 04 | 1:00–1:20 | Buổi tập: kg×lần×RPE, nghỉ, tự tăng tạ, khởi động/đĩa tạ, 1RM, video — đếm “800+” | session (soi cận bảng hiệp, chạm ✓), sessionSets, rest, warmup, history, exdetail, exlib | **match cut** (điện thoại giữ nguyên) |
| 05 | 1:20–1:33 | Chu kỳ, tuần giảm tải, siêu hiệp, khối lượng nhóm cơ | cycle, superset, volume | **vệt sáng** quét |
| 06 | 1:33–1:45 | Thành tích & huy hiệu, tổng kết tuần | badgepop (popup huy hiệu thật), achieve, weekly | whip |
| 07 | 1:45–2:06 | Dinh dưỡng kiểu Việt: ảnh món thật, nồi chiên, chay, đổi món, đi chợ, nước, “Ẩn số calo” | nutrition, recipe, recipeVeg, swap, shopping, hidekcal | xoay 3D |
| 08 | 2:06–2:22 | TapEasy PT: học viên, giao giáo án, log thay, gói & doanh thu | coach, client, ptcal, ptassign, ptproxy, ptrevenue | match cut |
| 09 | 2:22–2:37 | Tìm PT: album, bộ lọc, đánh giá minh bạch | findpt, fpfilters, fpprofile | whip |
| 10 | 2:37–2:53 | Cộng đồng, Sự kiện & thi đua, điểm danh, Cửa hàng | community, events, gifts, shop | xoay 3D |
| 11 | 2:53–3:04 | Kho kiến thức | kb, kbarticle | **tràn màu** từ điện thoại |
| 12 | 3:04–3:20 | **Khoảnh khắc chính**: 16 giao diện — riser + 0,4 s lặng + impact; mỗi theme bật theo phách bằng vòng tràn màu (cả nền khung đổi màu), chip tên theme; icon biến hình & cảm giác bấm | themepicker, theme-ocean … theme-lime, theme-end | xoay 3D |
| 13 | 3:20–3:31 | Bảo mật & quyền riêng tư | privacy, account (cuộn tới xoá tài khoản) | zoom xuyên |
| — | 3:31–3:50 | Kết: “Thêm vào màn hình chính” (bảng chia sẻ tự vẽ, không URL → màn hình chính trừu tượng → icon TapEasy bật lò xo → chạm mở app). CTA ở 3:40: điện thoại lùi + mờ đi; logo + “Tham gia **TapEasy Cộng Đồng**” + “để nhận **bản tải miễn phí**” + **thẻ QR nhóm Zalo** + “Quét mã bằng Zalo để tham gia”. Thẻ QR bật vào 1,1 s rồi **khoá yên 8,3 s tới khung cuối**, nằm trên lớp riêng phía trên hạt phim/vignette, không tắt đen | theme-end | — |

Mỗi chương: số chương đếm 00→NN (mono), tiêu đề động luân phiên 3 kiểu (*rise* — chữ trồi qua mặt nạ 75 ms/từ;
*chars* — tách ký tự + nhoè 8 px; *wipe* — mặt nạ quét kèm vạch mint), 2–4 phụ đề (cũ rời sớm 0,12 s, mới bật lò xo
từ nhoè 10 px), thẻ số liệu kính đếm số. Trong điện thoại: cuộn mượt bằng dải chụp thật, ngón tay (chấm trắng, ấn
lún `1−0,16·e^…`, gợn 0,4 s), chuyển màn kiểu iOS (push / sheet / fade / tràn màu theme), soi cận (zoom log, khung dọc
làm mờ tiêu đề cho một tiêu điểm). Nền: ảnh AI đen trắng + phủ teal, lưới mảnh, quầng màu trôi, số chương rỗng cỡ lớn
(parallax), nhịp đẩy +1,2 % ở phách mạnh, hạt phim 0,09 đổi mỗi 2 khung, vignette.

### Điện thoại khít ảnh app (góp ý “giao diện phải khít mockup”)

- Màn mockup = **đúng khung chụp** 390×844 CSS px đặt tại (17,17) trong khung 424×878 — cùng tỉ lệ 390:844, không co giãn/crop;
  mọi số đo ở một chỗ (`PH_W…R_SCR` đầu `compose.js` → biến CSS `--scr-*`, `--r-*`). Bo góc đồng tâm: khung 72 px, viền 66, màn 55;
  màn và lớp kính dùng chung `clip-path: inset(0 round 55px)` nên góc ảnh app trùng góc màn, không lộ viền đen/góc vuông.
- Không `translateZ`/`will-change` bên trong điện thoại: ảnh app là con trực tiếp của cùng cây transform (rig → tilt → phone →
  screen) nên khi xoay 3D/zoom xuyên/whip/soi cận nó dán chặt màn, không trễ khung (khung con nhoè cũng dựng cùng t).
- Dải trạng thái: app được chụp với vùng an toàn 47 px trên/34 px dưới; mockup vẽ 9:41 + sóng/wifi/pin trong dải 0–47 px,
  dynamic island 120×34 tại y 11 (giữa dải, canh tâm), thanh home 134×5 cách đáy 8 px (đen trên theme sáng). Ảnh chụp cũ
  (trước bản này, chưa có `manifest.safe`) tự dùng 50/22.
- Kiểm: `qa_fit.py` (≤ 1 px, Actions chặn nếu trượt) + `fit_corners.jpg`; `preview_fit.py` khi không có Chromium.

### Đoạn kết QR

`prep.py` cắt thẻ trắng từ `assets/zalo-community-qr.jpg` (1260×1920 → thẻ 1020×1284, góc bo trong suốt, giữ nguyên độ phân giải)
→ `build/qr-card.png` và tự kiểm giải mã bằng OpenCV. Cỡ trên video: dọc thẻ 778×979 (QR ≈ 503 px ≈ 13,6 px/module),
ngang thẻ 721×907 (QR ≈ 466 px). Đã thử qua H.264 CRF 20: giải mã được ở 1080p dọc/ngang và nháp 540p (nháp ngang cần phóng ×1,5).
`qa.py` kiểm lại trên MP4 cuối: giải mã ở 5 mốc trong 5,2 s cuối + vùng QR đứng yên (chênh lệch TB < 2).
Đổi nhóm/QR: thay ảnh `assets/zalo-community-qr.jpg` (cùng kiểu thẻ trắng trên nền màu) rồi chạy lại `prep.py`.

## 4. Sửa nhanh

- **Đổi chữ / nhịp / thứ tự**: sửa `timeline.json` (phách; 1 phách = 0,517 s). `beats` của chương = tổng `beats` shot
  (+ `phone_in` ở mở đầu). `scroll: [[phách_bắt_đầu, phách_kết_thúc, y_px]]`, `taps: [[phách, "tên_target" | [x,y]]]`
  (toạ độ màn 390×844), `focus: [[a, b, [x,y,w,h] | "target", tỉ_lệ]]`, `enter`: `cut|push|sheet|fade|theme`,
  `out`: `zoom|whip|rotate|sweep|match|flood|end`. Chạy lại `prep.py` (+ `capture_app.py` nếu cần cuộn sâu hơn).
- **Thêm màn**: thêm `shot("id", { setup, scroller, targets })` vào `director.js` (đúng vị trí trong chuỗi vì trạng thái
  app nối tiếp), rồi dùng `id` trong `timeline.json`. Shot có sẵn chưa dùng: `home, libdetail, records, addfood, challenges, product, menu`.
- **Dọc/ngang**: bố cục trong `L()` của `compose.js` (dọc: điện thoại giữa 64 % chiều cao; ngang: điện thoại lệch trái/phải xen kẽ).
- **Nhạc**: `music.py` (BPM lấy từ timeline; đổi hợp âm ở `CHORDS/ROOTS`). Muốn không tiếng: bỏ bước `music.py` và
  xoá `-i music` trong `finalize.py`.
- **Dữ liệu demo**: `seedHistory()` (4 tuần tập, nước, ngủ, ăn, InBody) và `seedPT()` (5 học viên, buổi, thanh toán) —
  chỉ localStorage của trình duyệt tạm, không đăng nhập tài khoản thật, không gọi Firebase.

## 5. Kiểm thử đã làm (12/11/2026)

- Chụp đủ 77 shot từ bản live (qua Playwright cục bộ @2x), soát contact sheet từng màn; sửa: popup huy hiệu che màn
  (ẩn bằng CSS, chỉ hiện ở shot `badgepop`), bước “kinh nghiệm” bắt buộc ở onboarding, đồng hồ nghỉ, thư viện bài.
- Kết xuất nháp 540p **0:12–0:32** (màn chào → zoom xuyên → onboarding 5 bước → sàng lọc → whip): không nháy 1 khung,
  khung 0 không đen, −14,0 LUFS. Soát dải ±10 khung quanh 10 chuyển cảnh; sửa: zoom đi đúng điểm chạm, whip liền mạch
  hai cảnh cùng tốc độ, bỏ zoom từ màn trắng (Cửa hàng) để tránh loé sáng, nền tối dưới phụ đề khi soi cận.
- Hạn chế: sandbox không có mạng nên bản cuối phải dựng trên Actions; thời gian dựng phụ thuộc máy (≈ 3–6 khung/s).

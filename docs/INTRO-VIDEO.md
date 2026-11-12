# Video giới thiệu TapEasy (intro) — storyboard, cách dựng, cách sửa

Ra: `media/intro/tapeasy-intro-1080x1920.mp4` (dọc, TikTok/Reels), `media/intro/tapeasy-intro-1920x1080.mp4` (ngang),
kèm `*-poster.jpg`. H.264 CRF 20 (trần 3 Mbps để file < 100 MB), yuv420p, BT.709, `+faststart`, 30 fps (tuỳ chọn 60),
AAC 192k chuẩn hoá −14 LUFS / đỉnh thật ≤ −1 dBTP, **có giọng đọc tiếng Việt** (nam trầm ấm, `minimax-speech-2.8-turbo` qua apivn — §6; TTS lỗi → nhạc không lời). Thời lượng **4:31** (131 ô nhịp ở 116 BPM; v1 3:50 + hồ sơ PT dài hơn + chương 14 “Sắp ra mắt” 37 s).
**Video không hiện URL/tên miền nào** (không github.io/github): bản tải miễn phí gửi trong nhóm Zalo
**TapEasy Cộng Đồng** — đoạn kết là mã QR nhóm (`scripts/intro-video/assets/zalo-community-qr.jpg`).

## 1. Chạy

**GitHub Actions** (có mạng, thấy đủ ảnh AI/video): tab *Actions* → **Media — video giới thiệu TapEasy** → *Run workflow*.
Tham số: `app_url` (mặc định bản live — **chỉ để chụp app**, không hiện trên video), `fps` (30/60), `scale` (3 = @3x), `commit` (true → commit `media/intro`),
`voice` (true → giọng đọc), `tts_voice` (ép voice id, trống = tự dò), `safe_strict` (true → chữ/nút lọt dải trạng thái/thanh home thì dừng).
Khoá TTS: secret `TTS_API_KEY` nếu có, không thì `IMG_API_KEY` (cùng nhà cung cấp apivn, `https://apivn.vn/v1`).
3 bước: `capture` (~15 phút + QA khít `qa_fit.py` dọc/ngang, chặn nếu còn URL trong timeline) → `render` 2 khổ × 3 phần song song (~30–60 phút/phần) → `publish` (ghép, nhạc, QA, commit).
Artifact **tapeasy-intro** chứa 2 MP4 + poster + ảnh QA (`build/qa/…`: contact sheet, dải quanh mỗi chuyển cảnh, báo cáo nháy sáng,
`qr_end.jpg` + dòng "QR cuối phim: ĐẠT"; `fit-v/`, `fit-h/`: báo cáo khít + `fit_corners.jpg` 4 góc màn phóng ×4).

**Máy có mạng** (Python 3.11, `pip install playwright numpy pillow opencv-python-headless`, `python -m playwright install chromium`, ffmpeg):
```bash
cd scripts/intro-video
python3 prep.py                                   # timeline.json → build/timeline.js (+ resolved.json, needs.json, qr-card.png)
python3 tts.py --check                            # đếm từ/giây kịch bản lời đọc (không gọi API)
TTS_API_KEY=… python3 tts.py --fit-timeline       # giọng đọc → build/voice/voice.wav (lời dài → kéo dài chương + chạy lại prep.py)
python3 fetch_assets.py                           # ảnh nền people-ai + khung clip màn chào
python3 capture_app.py --url https://thangvu030198-ai.github.io/fitkit-app/
python3 qa_fit.py --fmt v && python3 qa_fit.py --fmt h   # ảnh app khít màn mockup ≤ 1 px (mã thoát 1 nếu trượt)
python3 render.py --fmt v --draft --end 20        # nháp 540p 20 s đầu (không nhoè)
python3 render.py --fmt v && python3 render.py --fmt h
python3 music.py && python3 mix_audio.py && python3 finalize.py --fmt v --fmt h --dest ../../media/intro
python3 qa.py ../../media/intro/tapeasy-intro-1080x1920.mp4
```
Không có Chromium: `node smoke_node.js` (DOM giả, gọi `render(t)` mọi khung 2 khổ, kiểm tính thuần, phụ đề, QR ≥ 6 s, chương “Sắp ra mắt”) và
`python3 preview_fit.py --fmt v --play 215.17,252.41 --times 219,229,241,250 --out ../../../preview/watch.html` (trang tự chứa: phát/tua đoạn A–B).
Xem thử 1 khung: mở `scripts/intro-video/compose.html?w=1080&h=1920&t=63.5` (hoặc `&play=1&from=60` phát thời gian thực).
Không có `build/manifest.js` thì màn điện thoại hiện khung giả “SHOT …” — vẫn dựng được để thử chuyển động.
Máy **không có Playwright/Chromium**: `python3 preview_fit.py --fmt v --times 31.13,45.42 --corners 45.42 --out build/preview/v.html`
tạo 1 file HTML tự chứa (ảnh nhúng data-URI) dựng nhiều khung song song + bảng đo khít — mở bằng trình duyệt bất kỳ.

## 2. Kiến trúc (`scripts/intro-video/`)

| File | Việc |
|---|---|
| `timeline.json` | **Nguồn duy nhất**: chương, shot, cuộn, chạm, soi cận, phụ đề, chuyển cảnh — đơn vị *phách* |
| `prep.py` | Đổi phách → giây; sinh danh sách sự kiện âm thanh (whoosh/click/riser/impact) |
| `director.js` | Chạy **trong app** (addInitScript): vùng an toàn iPhone 14/15 Pro giả lập **59 px trên / 34 px dưới** (viết lại mọi `env(safe-area-inset-*)` của app thành px + ép `--sat/--sab`; `TI.safeAudit()` = QA chữ/nút trong dải trạng thái/home + kiểm riêng sheet; dải cuộn của sheet bỏ viền/bo góc/tiêu đề dính — `stripInset`), dữ liệu demo 4 tuần (`seedHistory`, tài khoản PT demo cục bộ `seedPT`), 70+ hàm dựng màn (`goto`, `openSheet`, `fkTheme.set`, `FKAch.open`…) |
| `capture_app.py` | Playwright 390×844 @3x (kiểm mỗi ảnh đúng 390·s×844·s px; ghi `manifest.safe`): mỗi shot = ảnh toàn màn + các **dải cuộn** của vùng cuộn + toạ độ điểm chạm → `build/shots`, `build/manifest.js`; QA vùng an toàn → `build/qa/safe/` (mã thoát 3 nếu lỗi, `--safe-warn` để chỉ cảnh báo) |
| `voiceover.json` | Kịch bản lời đọc 17 đoạn (chương, start, end, text; neo `at`/`tail`/`until` theo chương), 2,3–2,6 từ/giây |
| `tts.py` | Gọi TTS apivn (tự dò cách gọi + giọng, log đã che khoá), 1 mp3/đoạn (cache), cắt lặng, −16 LUFS, đặt đúng `start`, khớp timeline → `build/voice/voice.wav` |
| `mix_audio.py` | Nhạc −18 LUFS, hạ còn −22…−26 LUFS khi có lời (sidechaincompress tự dò ngưỡng; dự phòng đường bao) + lời → `build/mix.wav` |
| `fetch_assets.py` | Ảnh nền (people-ai, đen trắng/teal khi dựng), clip màn chào → khung JPEG |
| `compose.html/.css/.js` | Bộ dựng `makeComposer()` → `window.__render(t)` thuần (không Date.now/random); điện thoại tự vẽ (khung titan CSS, dynamic island, nút cạnh, thanh trạng thái 9:41 SVG, thanh home — không logo/biểu tượng Apple). `window.__probe()` đo khít; `?qa=fit`/`?qa=scr` tô màu cho `qa_fit.py` |
| `qa_fit.py` | ~300 mốc (giữa shot, chuyển màn, ±0,03–0,45 s quanh mọi zoom/whip/xoay 3D/match/sweep/flood, soi cận): khung bao ảnh app (magenta) vs vùng màn (xanh) ≤ 1 px, 0 điểm hở trong màn, DOM probe, tỉ lệ ảnh 390:844 → `build/qa/fit-<fmt>/` |
| `preview_fit.py` | Trang HTML tự chứa để xem/đo khung khi không có Chromium |
| `render.py` | Chụp khung tuần tự → ffmpeg; nhoè chuyển động bằng khung con (màn trập 180°, không trộn qua mốc cắt); chia đoạn 600 khung, chạy lại tự bỏ qua đoạn đã xong |
| `music.py` | Nhạc tự tổng hợp 116 BPM La thứ (kick/hat/clap/bass/pad/arp) + SFX đặt theo đỉnh âm |
| `finalize.py` | Nối đoạn, ghép `build/mix.wav` (nhạc + lời) hoặc `music.wav`, loudnorm 2 lượt, poster, tự nén lại nếu > 95 MB |
| `smoke_node.js` | Kiểm logic compose.js không cần trình duyệt (chạy trong bước capture của Actions) |
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
| 09 | 2:22–2:41 | Tìm PT: album, bộ lọc, **hồ sơ PT kiểu F1** (cuộn tới “Thành tích huấn luyện”, số đếm 0 → 48 học viên / 1.920 buổi / 7 năm, vòng cung xoay — giữ 6 s, chuỗi khung thật), đánh giá | findpt, fpfilters, fpprofile (seq), fpdetails | whip |
| 10 | 2:41–2:57 | Cộng đồng, Sự kiện & thi đua, điểm danh, Cửa hàng | community, events, gifts, shop | xoay 3D |
| 11 | 2:57–3:08 | Kho kiến thức | kb, kbarticle | **tràn màu** từ điện thoại |
| 12 | 3:08–3:24 | **Khoảnh khắc chính**: 16 giao diện — riser + 0,4 s lặng + impact; mỗi theme bật theo phách bằng vòng tràn màu (cả nền khung đổi màu), chip tên theme; icon biến hình & cảm giác bấm | themepicker, theme-ocean … theme-lime, theme-end | xoay 3D |
| 13 | 3:24–3:35 | Bảo mật & quyền riêng tư | privacy, account (cuộn tới xoá tài khoản) | whip |
| 14 | 3:35–4:12 | **Sắp ra mắt** (nhãn cam): chạy bộ GPS (lộ trình vẽ dần, pace, km, splits), vùng tim Z1–5, HYROX (8 × 1 km + 8 trạm, bấm giờ trạm & Roxzone), nghỉ giữa hiệp (đếm ngược vòng), đồng bộ đồng hồ thông minh phổ biến (nhịp tim, HRV, SpO₂, giấc ngủ, VO₂max ước tính, cảnh báo nhịp tim cao), tự ghi buổi tập. Đồng hồ tự vẽ cạnh điện thoại, dữ liệu bay đồng hồ → điện thoại | mock:run, mock:hyrox, mock:rest, mock:health, mock:summary (tự vẽ, không phải ảnh chụp) | zoom xuyên |
| — | 4:12–4:31 | Kết: “Thêm vào màn hình chính” (bảng chia sẻ tự vẽ, không URL → màn hình chính trừu tượng → icon TapEasy bật lò xo → chạm mở app). CTA ở 3:40: điện thoại lùi + mờ đi; logo + “Tham gia **TapEasy Cộng Đồng**” + “để nhận **bản tải miễn phí**” + **thẻ QR nhóm Zalo** + “Quét mã bằng Zalo để tham gia”. Thẻ QR bật vào 1,1 s rồi **khoá yên 8,3 s tới khung cuối**, nằm trên lớp riêng phía trên hạt phim/vignette, không tắt đen | theme-end | — |

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
- Dải trạng thái: app được chụp với vùng an toàn **59 px trên**/34 px dưới (bản ≤ 12/11: 47); mockup vẽ 9:41 + sóng/wifi/pin trong dải 0–59 px,
  dynamic island 120×34 tại y 11 (giữa dải, canh tâm), thanh home 134×5 cách đáy 8 px (đen trên theme sáng). Ảnh chụp cũ
  (trước bản này, chưa có `manifest.safe`) tự dùng 50/22.
- Kiểm: `qa_fit.py` (≤ 1 px, Actions chặn nếu trượt) + `fit_corners.jpg`; `preview_fit.py` khi không có Chromium.

### Đoạn kết QR

`prep.py` cắt thẻ trắng từ `assets/zalo-community-qr.jpg` (1260×1920 → thẻ 1020×1284, góc bo trong suốt, giữ nguyên độ phân giải)
→ `build/qr-card.png` và tự kiểm giải mã bằng OpenCV. Cỡ trên video: dọc thẻ 778×979 (QR ≈ 503 px ≈ 13,6 px/module),
ngang thẻ 721×907 (QR ≈ 466 px). Đã thử qua H.264 CRF 20: giải mã được ở 1080p dọc/ngang và nháp 540p (nháp ngang cần phóng ×1,5).
`qa.py` kiểm lại trên MP4 cuối: giải mã ở 5 mốc trong 5,2 s cuối + vùng QR đứng yên (chênh lệch TB < 2).
Đổi nhóm/QR: thay ảnh `assets/zalo-community-qr.jpg` (cùng kiểu thẻ trắng trên nền màu) rồi chạy lại `prep.py`.

### v2 (12/11/2026) — sửa theo góp ý xem bản 3:50

- **Phụ đề**: “Giáo án · Dinh dưỡng · Kết nối PT trong 1 App”, “Tiếng Việt · Miễn phí”; bỏ mọi gạch dài “—”. `typo()` trong compose.js:
  dấu “· : ,” dính chữ trước (không mở đầu dòng), cụm giữa hai “·” ≤ 3 từ không ngắt, từ ≤ 2 ký tự (1, PT, &) dính chữ sau, 2 từ cuối
  luôn đi cùng, số dính chữ trước (“Zone 1–5”); `~` trong timeline = khoảng trắng không ngắt; CSS `text-wrap:balance`.
- **Khẩu hiệu** “TẬP ĐÚNG / TIẾN BỘ / THẬT SỰ”: line-height .92 → 1,12 + đệm trên .16em + khe .06em giữa dòng (dấu Ậ Ế Ộ Ự không chạm).
- **Bản đồ màn chào**: chụp sau khi vẽ xong (`TI.wlFinish()` → `wlMapFinish()` của app, hoặc tự gắn `.in.done`); ẩn mũi tên SMIL cũ;
  shot `welcome` có `"drag": false` (không vẽ chấm ngón tay kéo trôi qua bản đồ).
- **Chuỗi khung (seq)**: shot trong director.js có `seq:{dur,fps,prep,at(τ),end}` → capture_app.py chụp `q000…qNNN.jpg` theo thời gian ảo
  τ = k/fps (mọi CSS animation bị dừng + tua tới τ bằng Web Animations API, số đếm tính lại đúng công thức app) → manifest `seq`;
  timeline `"seq": {"at", "beats"}` đặt cửa sổ phát (sau cửa sổ giữ khung cuối). Dùng cho hồ sơ PT (`fpprofile`); `fpdetails`
  (`"from_capture": true`) cuộn tiếp từ đúng vị trí cuối chuỗi.
- **QA chữ** (qa_fit.py, chặn Actions): `__capCheck()` dựng thật mọi phụ đề ở đúng bề rộng (mồ côi, dấu đầu dòng, > 2 dòng, tràn) và
  `__textQA()` ở mọi mốc (kicker/tiêu đề/phụ đề/thẻ số/chip/CTA không đè nhau; sát mép < 12 px chỉ cảnh báo). `--text-warn` để không chặn.

### Chương 14 “Sắp ra mắt” (`kind:"soon"`)

- Bố cục `duo` trong `L()`: dọc điện thoại 50 % cao lệch trái + đồng hồ phải; ngang điện thoại 0,60 W + đồng hồ 0,835 W, chữ bên trái.
- **Đồng hồ** (`buildSoon`, CSS/SVG): mặt tròn 236 px trong vỏ kim loại 300 px, vành 60 vạch, 3 nút + núm khía, dây silicon có lỗ —
  kiểu chung, không logo/thiết kế hãng. Màn TapEasy (`timeline.watch`): `run` (nhịp tim lớn nhảy theo nhịp, vòng vùng tim 5 màu vẽ dần
  + điểm đánh dấu, pace, km, giờ), `hyrox` (trạm 4/8 Burpee Broad Jump → Chạy 5/8, giờ trạm, tổng, vòng 16 đoạn chạy/trạm),
  `rest` (vòng đếm ngược), `health` (đang đo → HR/HRV/SpO₂/giấc ngủ luân phiên, cảnh báo nhịp tim cao + rung), `summary`.
- **Điện thoại** (`buildMock`): mock:run (bản đồ GPS tự vẽ, lộ trình vẽ dần + mốc km, 4 chỉ số, thời gian trong vùng tim, splits),
  mock:hyrox (16 chặng, chặng hiện tại sáng mint), mock:rest, mock:health, mock:summary. Mọi màn có nhãn cam “Sắp ra mắt”.
- **Đồng bộ** (`timeline.sync`, phách): 8 hạt (có hình tim) bay theo đường cong đồng hồ → điện thoại + vòng sáng nơi chạm; âm “tách”.
- Nội dung: vùng tim Z1–Z5 = 50–60/60–70/70–80/80–90/90–100 % nhịp tim tối đa; HYROX = 8 × (1 km chạy + trạm): SkiErg 1000 m,
  Sled Push 50 m, Sled Pull 50 m, Burpee Broad Jump 80 m, Row 1000 m, Farmers Carry 200 m, Sandbag Lunges 100 m, Wall Balls 100 lần;
  Roxzone = vùng chuyển. Không nêu tên/logo hãng đồng hồ (“đồng hồ thông minh phổ biến”).

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

## 6. Giọng đọc (voiceover) — v3 (13/11/2026)

- **Kịch bản** `scripts/intro-video/voiceover.json`: 17 đoạn (mở đầu, 13 chương tính năng, “Sắp ra mắt”, 2 đoạn kết — đoạn 2 vào lúc hiện QR,
  kêu gọi tham gia **TapEasy Cộng Đồng**). Câu ngắn, tự nhiên, không đọc nguyên phụ đề; 619 từ, mỗi đoạn 2,34–2,59 từ/giây (`tts.py --check`).
  Neo theo chương: `start = t0 + at`, `end = t1 − tail` (hoặc `t0 + until`); đoạn Kho kiến thức dừng trước 0,4 s lặng của khoảnh khắc 16 giao diện (`hard_until`).
- **Giọng**: nam trầm ấm, tiếng Việt, tốc độ 1.0, `pitch −2`, `language_boost: Vietnamese` (biến `TTS_SPEED`, `TTS_PITCH`, `TTS_VOICE`).
- **Gọi API** (chưa rõ tham số giọng của apivn → tự dò, ghi `build/qa/voice/tts-log.json`, khoá đã che): `GET /audio/voices|/voices|/models`
  (chấm điểm giọng nam/trầm/tiếng Việt) → `POST /audio/speech {model,input,voice,response_format:"mp3",speed}` → thêm `voice_setting{voice_id,speed,vol,pitch}`
  → `POST /t2a_v2` kiểu MiniMax T2A v2 (audio hex, đọc `base_resp`) → `/audio/t2a_v2`. Voice thử: dò được + `Deep_Voice_Man, presenter_male,
  audiobook_male_1, male-qn-jingying, Vietnamese_male_1, Determined_Man, onyx`. Cách chạy được ghi ở `build/voice/report.json → recipe`;
  lần sau ép bằng `TTS_RECIPE`/`TTS_VOICE` (input `tts_voice` của workflow).
- **Khớp thời gian, không cắt lời**: lời dài hơn chỗ → `--fit-timeline` kéo dài chương trong `timeline.json` theo bội 4 phách (ghi `voice_ext_beats`,
  chạy lại `prep.py` — hình/nhạc/phụ đề theo timeline mới; trên Actions chỉ sửa bản checkout, muốn giữ thì chép số phách từ báo cáo vào repo);
  không dùng cờ → co `atempo ≤ 1,10`; vẫn dài → lấn khoảng lặng sau + dời đoạn kế (cảnh báo).
- **Trộn** (`mix_audio.py`): lời −16 LUFS; nhạc −18 LUFS khi không lời, dưới lời −22…−26 LUFS (đích −24) bằng `sidechaincompress` (tự dò ngưỡng/tỉ lệ,
  đo lại trong đúng các đoạn có lời); bản trộn → `finalize.py` chuẩn hoá −14 LUFS / −1 dBTP (tương quan lời–nhạc giữ nguyên).
  Báo cáo `build/qa/voice/report.txt`, `mix-report.txt`, nghe thử `mix-preview.mp3` (artifact *tapeasy-intro*).
- **TTS lỗi hoàn toàn** (thiếu khoá, 401, không cách nào chạy): bước TTS `continue-on-error`, không có `voice.wav` → `mix_audio.py` giữ nhạc nguyên
  bản + `::warning::`; video vẫn xuất bản.
- Kiểm cục bộ: máy chủ TTS giả (127.0.0.1, `/audio/speech` từ chối voice, chỉ `/t2a_v2` chạy) → dò ra `t2a_v2 · Deep_Voice_Man`, 17 mp3,
  kéo dài `kb` +4 & `soon` +12 phách khi lời giả dài hơn; trộn: lời −15,9 · nhạc dưới lời −25,1 · không lời −18,2 LUFS; MP4 thử −14,0 LUFS / −1,5 dBTP.
  Máy chủ tắt → cảnh báo, nhạc không lời. Log không chứa khoá.

## 7. App fit màn hình điện thoại (vùng an toàn) — v3

Góp ý: trong clip, sheet “Giáo án mẫu…” bị chui dưới dynamic island (tiêu đề bị che, viền trên mờ cắt ngang, chữ sát mép).
Nguyên nhân 2 lớp: (1) dải cuộn của sheet chụp cả viền trên + bo góc + tiêu đề → ghép lại thành vạch ngang và tiêu đề cuộn mất;
(2) app chỉ chừa vùng an toàn ở `#app-shell`/dock, lớp phủ khác (sheet, onboarding, đăng nhập, sàng lọc) và toast không chừa.

- **App** (`style.css` khối “FIT MÀN HÌNH ĐIỆN THOẠI”, `health-safety.css`): `--sat/--sab/--sal/--sar = env(safe-area-inset-*, 0px)`
  (meta viewport đã có `viewport-fit=cover`); sheet cao tối đa `min(88%, 100% − safe-top − 12px, 100dvh − safe-top − 12px)`, đệm đáy `20px + safe-bottom`,
  lề ngang ≥ 20 px, **tiêu đề sheet dính** (sticky, nền kế thừa theme + blur, nút đóng 44 px); dock cách đáy `max(10px, safe-bottom)`; toast trên dock;
  `#onboarding`, `#auth` (không phải màn chào), `#hs-overlay` đệm 4 phía theo vùng an toàn; khi ẩn dock `#app-scroll` chừa thanh home.
  Test `tests/suites/73-safe-area.test.js`: viewport-fit, biến, lớp chính, lề ≥ 16 px, tính bố cục ở 390×844 (59/34 và 47/34), 375×667 (SE, 20/0), 430×932.
- **Chụp**: director.js ép `--sat:59px; --sab:34px` + viết lại `env()`; bản app cũ (chưa `--fk-safe`) dùng CSS ép cũ. Dải cuộn: bỏ viền + bo góc của sheet
  và phần tiêu đề dính (`stripInset`), lớp phủ tràn viền thì cắt từ 59 px + nền thanh trạng thái hiện dần khi cuộn (`bandColor` → `.band` trong compose).
- **QA tự động** `TI.safeAudit()` mỗi shot: chữ/nút/icon (hình chữ nhật thấy được, đã cắt theo vùng cuộn) trong 0–59 px trên hoặc 34 px dưới = lỗi
  (nội dung vùng cuộn chưa cuộn hết được phép tràn dưới thanh home); sheet: mép trên ≥ 71 px, tiêu đề + nút đóng dưới dải, đệm đáy ≥ 34 px; mép ngang
  < 12 px = cảnh báo. `build/qa/safe/report.txt` (+ bảng riêng mọi cảnh có sheet mở, ảnh khoanh đỏ `<shot>.jpg`); Actions dừng nếu lỗi (`safe_strict`).
  Chưa chạy được Chromium trong sandbox → lần chạy Actions đầu là lần đo pixel thật đầu tiên.

## 5. Kiểm thử đã làm

**v3 (13/11/2026, sandbox):** `node tests/run.js --only 00|50|66|72|73` xanh (73 mới: 8 test vùng an toàn); `py_compile` + `node --check` mọi file;
`node smoke_node.js --step 0.25` ĐẠT (cả với timeline kéo dài 279 s + manifest có `bandColor`); luồng TTS giả → ghép → ducking → MP4 thử (§6).


**v2 (12/11/2026, sandbox không mạng, không Chromium):** `node smoke_node.js --step 0.1` — 2.711 khung × 2 khổ không lỗi JS, tính thuần ĐẠT,
53 phụ đề đạt luật chữ, QR đứng yên 8,0 s, chương “Sắp ra mắt” 37,2 s, chuỗi hồ sơ PT 6,0 s; `py_compile` + `node --check` mọi file;
app: `node tests/run.js --only 00|50|66|72` xanh. Preview tĩnh: `outputs/preview/watch.html`, `watch-h.html`, `fixes.html`.
Chưa đo bố cục thật (cần Chromium) → qa_fit.py trên Actions là cổng kiểm cuối.

**v1 (12/11/2026):**

- Chụp đủ 77 shot từ bản live (qua Playwright cục bộ @2x), soát contact sheet từng màn; sửa: popup huy hiệu che màn
  (ẩn bằng CSS, chỉ hiện ở shot `badgepop`), bước “kinh nghiệm” bắt buộc ở onboarding, đồng hồ nghỉ, thư viện bài.
- Kết xuất nháp 540p **0:12–0:32** (màn chào → zoom xuyên → onboarding 5 bước → sàng lọc → whip): không nháy 1 khung,
  khung 0 không đen, −14,0 LUFS. Soát dải ±10 khung quanh 10 chuyển cảnh; sửa: zoom đi đúng điểm chạm, whip liền mạch
  hai cảnh cùng tốc độ, bỏ zoom từ màn trắng (Cửa hàng) để tránh loé sáng, nền tối dưới phụ đề khi soi cận.
- Hạn chế: sandbox không có mạng nên bản cuối phải dựng trên Actions; thời gian dựng phụ thuộc máy (≈ 3–6 khung/s).

# TapEasy Shorts — chuỗi 14 video ngắn 9:16 (TikTok / Reels / Shorts)

Định hướng: **Tập đúng · Ăn đúng · Ngủ đúng** — mỗi video một kiến thức ngắn, có nguồn, rồi cho thấy TapEasy làm giúp trong 1 chạm.
CTA duy nhất ở cuối mọi video: **“Tải miễn phí trong cộng đồng TapEasy”** + QR nhóm Zalo *TapEasy Cộng Đồng*
(`scripts/intro-video/assets/zalo-community-qr.jpg`). Video không hiện URL/GitHub nào.

## Quy tắc biên tập

- Hook (câu hỏi/con số) hiện ngay khung đầu, trọn chữ trước 1,5 s; 3–6 nhịp; cứ ≤ 2,5 s có điều mới trên hình (cắt cảnh, bước thẻ, nhấn).
- Lời đọc giọng nam trầm ấm, ~2,4 từ/giây; số liệu viết bằng chữ trong lời (`say`), bằng chữ số trong phụ đề (`cap`).
- Số liệu sức khoẻ: câu chữ dè dặt, có dòng nguồn nhỏ + “Tham khảo, không thay tư vấn y tế”.
- Hành trình “trước–sau”: chỉ biểu đồ/màn app + chữ **ví dụ minh hoạ**; không ảnh người thật, không hứa kết quả.
- Ảnh người/món ăn: ảnh tạo bằng AI của app (`media/people-ai`, `media/food-ai`); nhạc tự tổng hợp (không bản quyền);
  không tên/ảnh người nổi tiếng hay thương hiệu (đồng hồ vẽ tay, không logo hãng).
- Số BMR/TDEE trong video tính đúng công thức app dùng: Mifflin–St Jeor (`app.js calcBMR`) × hệ số vận động (`data.js`),
  giảm mỡ −18 %, tăng cơ +12 % (`GOALS`). Ví dụ: nam 27 t, 172 cm, 70 kg → BMR 1.645 → TDEE 2.550 (× 1,55) → 2.091 / 2.856 kcal.

## Khung hình & vùng an toàn (1080×1920)

| y (px) | Nội dung |
|---|---|
| 0–10 | thanh tiến độ (không chữ) |
| 0–220 | trống chữ (giao diện TikTok/Reels) |
| 236–276 | kicker `TapEasy — KIẾN THỨC · 01` |
| 286–500 | tiêu đề động (≤ 2 dòng, chữ trồi từng từ) |
| 516–1272 | hình: thẻ đồ hoạ (số đếm, công thức, thanh, biểu đồ), mockup iPhone với màn app thật, ảnh AI |
| 1288–1440 | phụ đề karaoke (≤ 2 dòng, từ đang đọc màu mint) |
| 1450–1500 | dòng nguồn + lưu ý (chữ nhỏ) |
| 1500–1920 | trống chữ; x > 940 trống chữ (nút TikTok bên phải) |

Phong cách: navy `#061A24` / mint `#33D6C9` / teal logo `#02BCB3` / coral `#FF7A45`; Inter Tight + Barlow Condensed;
zoom-punch theo nhịp, chuyển cảnh zoom-through/trượt (nhoè chuyển động 3 khung con), số đếm tăng, hạt nhiễu nhẹ, vignette;
thẻ kết loang tròn rồi đứng yên ≥ 2 s cho quét QR.

## Cách chạy

**Trên GitHub Actions (khuyên dùng):** Actions → *Media — chuỗi video ngắn TapEasy* (`.github/workflows/media-shorts.yml`) → Run workflow.

| Input | Mặc định | Ý nghĩa |
|---|---|---|
| `ids` | trống = cả 14 | ví dụ `bmr-tdee,giac-ngu` |
| `app_url` | `https://thangvu030198-ai.github.io/fitkit-app/` | chỉ để chụp app (không hiện trên video) |
| `voice` | `true` | giọng đọc TTS; `false` = nhạc + phụ đề |
| `commit` | `true` | commit `media/shorts/` (tapeasy-bot, `git pull --rebase && git push`) |

Cần secret **`IMG_API_KEY`** (TTS qua apivn, model `minimax-speech-2.8-turbo`, giọng `Deep_Voice_Man`; không bao giờ in ra log).
Ba bước: `prepare` (smoke offline → TTS có cache → kế hoạch → ảnh AI → chụp app thật) → `render` ma trận ≤ 2 short/máy
(Playwright → H.264 high yuv420p 30 fps faststart, nhạc + giọng, −14 LUFS, bìa, SRT, QA) → `publish` (index.json, QA toàn bộ, commit).
Thời gian ước tính ~25–35 phút cho 14 short. Kết quả: `media/shorts/<id>.mp4`, `<id>.jpg` (bìa), `<id>.srt`, `index.json`;
artifact `tapeasy-shorts` (kèm báo cáo QA `scripts/shorts/build/qa/`).

**Máy cục bộ** (cần Python 3.11 + `pip install playwright==1.48.0 numpy pillow` + `python -m playwright install chromium` + ffmpeg + Node 20):

```bash
node scripts/shorts/smoke_node.js                 # kiểm offline, không mạng/trình duyệt
TTS_API_KEY=… python3 scripts/shorts/tts.py       # giọng đọc (bỏ qua được → chỉ nhạc + phụ đề)
node scripts/shorts/prep.js                       # kế hoạch dựng theo lời thật → build/plans
python3 scripts/shorts/fetch_assets.py            # ảnh AI + QR
python3 scripts/shorts/capture.py                 # chụp app thật (dùng bộ chụp của intro, không sửa intro)
python3 scripts/shorts/render.py --ids bmr-tdee   # khung → build/out/bmr-tdee.video.mp4 + bìa + layout QA
python3 scripts/shorts/audio.py --ids bmr-tdee    # nhạc tự tổng hợp + giọng, hạ nhạc dưới lời
python3 scripts/shorts/finalize.py --ids bmr-tdee --dest media/shorts && python3 scripts/shorts/finalize.py --index
python3 scripts/shorts/qa.py --media media/shorts # thoát 1 nếu lỗi
```

Xem thử 1 khung: phục vụ thư mục repo (`python3 -m http.server`) rồi mở `scripts/shorts/shorts.html?id=bmr-tdee&t=12.5`
(`&play=1` phát thử, `&cover=1` ảnh bìa).

### Các tệp

| Tệp | Vai trò |
|---|---|
| `scripts/shorts/series.json` | kịch bản 14 short: hook, nhịp (lời, phụ đề, tiêu đề, hình), nguồn, caption, hashtag, bìa |
| `engine.js` | tính kế hoạch thuần (Node + trình duyệt): thời lượng theo lời, phụ đề karaoke theo âm tiết, mốc nhấn, SRT |
| `shorts.html/.css/.js` | bộ dựng `render(t)` 1080×1920 (thẻ đồ hoạ, mockup iPhone, đồng hồ, thẻ kết QR, bìa) |
| `capture.py` + `shorts_director.js` | chụp app: nạp `capture_app.py` + `director.js` của intro, thêm shot `sleep`, `progressInbody` |
| `tts.py` | giọng đọc từng nhịp qua `scripts/intro-video/tts.py` (dò cách gọi, che khoá), cache theo hash |
| `prep.js` | kế hoạch + SRT; lời quá dài → tăng tempo ≤ 1,15 thay vì cắt |
| `audio.py` | nhạc 118 BPM tự tổng hợp từ khối âm của `music.py` intro + whoosh/tick/riser/impact + ducking |
| `render.py` / `finalize.py` / `qa.py` | khung → MP4; ghép + −14 LUFS + bìa + SRT + index; QA (thoát 1) |
| `smoke_node.js` | kiểm offline bằng DOM giả; `tests/suites/75-shorts.test.js` chạy trong `node tests/run.js` |

QA (`qa.py`): thời lượng 15–45 s & khớp kế hoạch, thẻ kết ≥ 2 s, hook ≤ 1,5 s, hộp chữ đo thật trong Chromium nằm trong vùng an toàn,
phụ đề ≤ 2 dòng, không tràn/chồng chữ, MP4 1080×1920 H.264 yuv420p có tiếng, −14 ± 1,5 LUFS, bìa 1080×1920, SRT.
TTS lỗi → video vẫn ra (nhạc + phụ đề) và báo rõ trong log + `build/qa/voice/report.txt`.

## Lịch đăng gợi ý (2 tuần, 1 video/ngày)

Xen kẽ kiến thức ↔ demo app ↔ phá bẫy để giữ nhịp; giờ vàng 11:30–12:30 và 19:30–21:00. Đăng cùng lúc TikTok + Reels + Shorts,
ghim bình luận “Tải miễn phí trong cộng đồng TapEasy (QR cuối video)”. Tuần 2 xem số liệu tuần 1: chủ đề nào giữ chân > 50 % thì làm phần 2.

| Ngày | Giờ | # | Short | Trụ cột |
|---|---|---|---|---|
| Tuần 1 · T2 | 20:00 | 01 | Cách tính BMR & TDEE chính xác (`bmr-tdee`) | kien-thuc |
| Tuần 1 · T3 | 12:00 | 06 | Ghi hiệp tập kg × lần + đồng hồ nghỉ (`demo-ghi-set`) | app-demo |
| Tuần 1 · T4 | 20:00 | 12 | Tập bụng có giảm mỡ bụng không? (`tap-bung-giam-mo`) | myth |
| Tuần 1 · T5 | 19:30 | 05 | Protein bao nhiêu là đủ? (`protein-bao-nhieu`) | kien-thuc |
| Tuần 1 · T6 | 12:00 | 07 | Thực đơn món Việt + công thức (`demo-thuc-don`) | app-demo |
| Tuần 1 · T7 | 10:00 | 10 | Trước – sau 12 tuần: hành trình bằng biểu đồ (ví dụ minh hoạ) (`hanh-trinh-12-tuan`) | hanh-trinh |
| Tuần 1 · CN | 20:00 | 09 | 16 giao diện, đổi trong 1 chạm (`demo-16-theme`) | app-demo |
| Tuần 2 · T2 | 20:00 | 04 | 4 sai lầm khi tính calo (`sai-lam-calo`) | kien-thuc |
| Tuần 2 · T3 | 12:00 | 08 | Tìm PT phù hợp & hồ sơ PT (`demo-tim-pt`) | app-demo |
| Tuần 2 · T4 | 20:00 | 03 | Tại sao giấc ngủ quan trọng khi tập (`giac-ngu`) | kien-thuc |
| Tuần 2 · T5 | 19:30 | 13 | Đổ mồ hôi nhiều = đốt mỡ nhiều? (`mo-hoi-dot-mo`) | myth |
| Tuần 2 · T6 | 12:00 | 02 | Lịch tập + ăn theo mục tiêu: tăng cơ vs giảm mỡ (`tang-co-giam-mo`) | kien-thuc |
| Tuần 2 · T7 | 10:00 | 11 | Người mới tập tạ: 12 tuần mạnh lên bao nhiêu? (ví dụ minh hoạ) (`suc-manh-12-tuan`) | hanh-trinh |
| Tuần 2 · CN | 20:00 | 14 | Sắp ra mắt: đồng hồ thông minh & HYROX (`sap-ra-mat`) | teaser |

## Danh sách 14 short

### 01. Cách tính BMR & TDEE chính xác — `bmr-tdee`

- **Trụ cột:** kien-thuc · **Thời lượng ước tính:** ~44 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Bạn cần ăn bao nhiêu calo?”
- **Tiêu đề bìa:** BMR & TDEE: tính đúng trong 30 giây
- **Lời đọc:** Bạn cần ăn bao nhiêu calo mỗi ngày? BMR là năng lượng đốt khi nghỉ, tính bằng công thức Mifflin St Jeor. Ví dụ nam hai bảy tuổi, cao một bảy hai, nặng bảy mươi ký: BMR một nghìn sáu trăm bốn lăm. Nhân hệ số vận động: tập ba đến năm buổi một tuần là một phẩy năm lăm. Ra TDEE khoảng hai nghìn năm trăm rưởi calo. Giảm mỡ ăn thấp hơn, tăng cơ cao hơn. Lười tính tay? Nhập số đo vào TapEasy, app tự tính trong một chạm. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Nguồn: Mifflin 1990; Frankenfield 2005
- **Lưu ý trên hình:** Công thức ước tính (sai số ~±10%) · Tham khảo, không thay tư vấn y tế
- **Caption đăng:** Bạn cần ăn bao nhiêu calo mỗi ngày? Tính BMR theo Mifflin–St Jeor, nhân hệ số vận động là ra TDEE. Lưu lại để tính cho cả nhà. Tham khảo, không thay tư vấn y tế.
- **Hashtag:** #TapEasy #TDEE #BMR #tinhcalo #giammo #tangco #kienthucgym

### 02. Lịch tập + ăn theo mục tiêu: tăng cơ vs giảm mỡ — `tang-co-giam-mo`

- **Trụ cột:** kien-thuc · **Thời lượng ước tính:** ~44 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Tăng cơ hay giảm mỡ: khác nhau ở đâu?”
- **Tiêu đề bìa:** Tăng cơ vs giảm mỡ: ăn & tập khác gì?
- **Lời đọc:** Tăng cơ hay giảm mỡ, khác nhau ở đâu? Tăng cơ: ăn dư năm đến mười lăm phần trăm, tăng chậm khoảng một ký mỗi tháng. Giảm mỡ: thiếu mười đến hai lăm phần trăm, giảm nửa đến một phần trăm cân nặng mỗi tuần. Cả hai cần một phẩy sáu đến hai phẩy hai gam đạm mỗi ký, giảm mỡ lấy mức cao. Lịch mẫu: bốn buổi tạ mỗi tuần. Giảm mỡ vẫn tập tạ để giữ cơ. TapEasy tự lên calo, đạm và giáo án theo mục tiêu của bạn. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Nguồn: ISSN 2017; Helms 2014; Iraki 2019
- **Lưu ý trên hình:** Tham khảo, không thay tư vấn y tế/dinh dưỡng
- **Caption đăng:** Tăng cơ: dư 5–15% calo. Giảm mỡ: thiếu 10–25%. Đạm 1,6–2,2 g/kg cho cả hai, và vẫn tập tạ khi giảm mỡ. Bạn đang ở giai đoạn nào? Comment nhé!
- **Hashtag:** #TapEasy #tangco #giammo #lichtap #dinhduong #gymvietnam

### 03. Tại sao giấc ngủ quan trọng khi tập — `giac-ngu`

- **Trụ cột:** kien-thuc · **Thời lượng ước tính:** ~41 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Tập chăm mà ngủ 5 tiếng?”
- **Tiêu đề bìa:** Ngủ 5 tiếng = phí công tập?
- **Lời đọc:** Tập chăm mà mỗi đêm chỉ ngủ năm tiếng? Bạn đang phí công đấy. Người lớn nên ngủ bảy đến chín tiếng mỗi đêm. Lúc ngủ là lúc cơ thể phục hồi. Ngủ thiếu, sức tập và sự tập trung đều giảm. Một nghiên cứu nhỏ: cùng ăn kiêng, ngủ năm tiếng rưỡi giảm ít mỡ hơn hẳn ngủ tám tiếng rưỡi. TapEasy giúp ghi giờ ngủ, chất lượng ngủ, xem xu hướng cả tuần. Mẹo: dậy đúng giờ mỗi ngày, tránh cà phê buổi chiều. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Nguồn: Watson 2015 (AASM/SRS); Fullagar 2015; Nedeltcheva 2010
- **Lưu ý trên hình:** Mất ngủ kéo dài hãy gặp bác sĩ · Tham khảo, không thay tư vấn y tế
- **Caption đăng:** Người lớn nên ngủ 7–9 giờ/đêm. Ngủ là lúc cơ thể phục hồi; ngủ thiếu khi ăn kiêng có thể làm giảm ít mỡ hơn. Tối nay bạn ngủ mấy tiếng? Tham khảo, không thay tư vấn y tế.
- **Hashtag:** #TapEasy #giacngu #phuchoi #suckhoe #gymvietnam #kienthucgym

### 04. 4 sai lầm khi tính calo — `sai-lam-calo`

- **Trụ cột:** kien-thuc · **Thời lượng ước tính:** ~41 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “4 sai lầm khi đếm calo”
- **Tiêu đề bìa:** Đếm calo mãi không giảm? 4 lỗi này
- **Lời đọc:** Đếm calo mà mãi không giảm? Kiểm tra bốn lỗi này. Một: quên dầu và đồ uống. Một muỗng canh dầu đã khoảng một trăm hai mươi calo. Hai: nhầm cân sống và chín. Một trăm gam gạo sống gần gấp ba cơm chín. Ba: chọn mức vận động quá cao, TDEE bị đội lên vài trăm calo. Bốn: ăn bù calo đồng hồ báo đốt. Con số đó chỉ là ước tính. Với TapEasy, tìm món Việt có sẵn, ghi bữa ăn chỉ vài chạm. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Nguồn: USDA FoodData Central; Shcherbina 2017
- **Lưu ý trên hình:** Số liệu làm tròn · Tham khảo, không thay tư vấn dinh dưỡng
- **Caption đăng:** Quên dầu ăn & đồ uống, nhầm sống/chín, khai vận động quá cao, ăn bù calo đồng hồ — bạn dính lỗi số mấy? Lưu lại để kiểm tra nhé.
- **Hashtag:** #TapEasy #demcalo #giammo #ankieng #dinhduong #meohay

### 05. Protein bao nhiêu là đủ? — `protein-bao-nhieu`

- **Trụ cột:** kien-thuc · **Thời lượng ước tính:** ~41 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Protein bao nhiêu là đủ?”
- **Tiêu đề bìa:** Protein: bao nhiêu gam là đủ?
- **Lời đọc:** Ăn bao nhiêu đạm mỗi ngày là đủ để lên cơ? Người tập tạ cần khoảng một phẩy sáu đến hai phẩy hai gam đạm mỗi ký. Nặng sáu mươi ký: chín mươi sáu đến một trăm ba hai gam mỗi ngày. Chia đều ba đến bốn bữa, mỗi bữa khoảng hai mươi đến bốn mươi gam. Nguồn dễ kiếm: trứng, cá, sữa chua, đậu. Một quả trứng khoảng sáu gam đạm. TapEasy tính sẵn lượng đạm theo cân nặng và mục tiêu của bạn. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Nguồn: ISSN 2017 (Jäger); Morton 2018; USDA
- **Lưu ý trên hình:** Bệnh thận: hỏi bác sĩ trước khi tăng đạm · Tham khảo
- **Caption đăng:** Người tập tạ: ~1,6–2,2 g đạm/kg/ngày, chia 3–4 bữa (20–40 g/bữa). Trứng, cá, sữa chua, đậu đều là nguồn tốt. Có bệnh thận hãy hỏi bác sĩ trước khi tăng đạm.
- **Hashtag:** #TapEasy #protein #damnaybaonhieu #tangco #dinhduong #kienthucgym

### 06. Ghi hiệp tập kg × lần + đồng hồ nghỉ — `demo-ghi-set`

- **Trụ cột:** app-demo · **Thời lượng ước tính:** ~41 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Ghi hiệp tập chỉ 1 chạm”
- **Tiêu đề bìa:** Ghi buổi tập trong 1 chạm
- **Lời đọc:** Vẫn ghi buổi tập vào sổ tay? Xem cách ghi trong một chạm. Mỗi hiệp có mức tạ, số lần, độ khó. Số buổi trước đã điền sẵn, đúng thì tích là xong. Tích xong, đồng hồ nghỉ tự chạy, báo cả khi tắt màn hình. Có hiệp khởi động và tính sẵn đĩa tạ mỗi bên, khỏi phải nhẩm. Xem lịch sử từng bài, một RM ước tính tăng dần qua từng tuần. Đủ sức là app gợi ý tăng tạ cho buổi sau. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Caption đăng:** Ghi kg × lần × RPE từng hiệp, số buổi trước điền sẵn, đồng hồ nghỉ tự chạy, có hiệp khởi động & tính đĩa tạ. Bỏ sổ tay được rồi! Tải miễn phí trong cộng đồng TapEasy.
- **Hashtag:** #TapEasy #apptapgym #nhatkytap #gymvietnam #tangco #fitness

### 07. Thực đơn món Việt + công thức — `demo-thuc-don`

- **Trụ cột:** app-demo · **Thời lượng ước tính:** ~35 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Ăn kiêng vẫn toàn món Việt”
- **Tiêu đề bìa:** Ăn kiêng toàn món Việt
- **Lời đọc:** Ăn kiêng mà vẫn muốn món Việt quen thuộc? Xem thực đơn này. TapEasy lên thực đơn theo đúng lượng calo và mục tiêu của bạn. Mỗi món có công thức chi tiết, có cả món nồi chiên không dầu. Ăn chay vẫn có thực đơn đủ đạm. Không thích món nào? Đổi sang món tương đương chỉ một chạm. Và danh sách đi chợ cho cả tuần đã có sẵn. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Caption đăng:** Thực đơn theo calo & mục tiêu, toàn món Việt quen thuộc, công thức từng bước (có món nồi chiên không dầu, món chay), đổi món 1 chạm, danh sách đi chợ cả tuần.
- **Hashtag:** #TapEasy #thucdon #monviet #ankieng #eatclean #giammo

### 08. Tìm PT phù hợp & hồ sơ PT — `demo-tim-pt`

- **Trụ cột:** app-demo · **Thời lượng ước tính:** ~30 s (5 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Tìm PT đúng người”
- **Tiêu đề bìa:** Tìm PT đúng người, không sợ chọn sai
- **Lời đọc:** Tìm huấn luyện viên cá nhân mà sợ chọn sai người? Lọc theo khu vực, chuyên môn và mức giá. Hồ sơ cho thấy số học viên, số buổi đã dạy, năm kinh nghiệm. Đánh giá chỉ đến từ học viên đã tập thật. Bạn là PT? Quản lý học viên, lịch dạy và doanh thu ngay trong app. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Lưu ý trên hình:** Ảnh & hồ sơ PT trong video là dữ liệu demo
- **Caption đăng:** Lọc PT theo khu vực, chuyên môn, mức giá; hồ sơ minh bạch (số học viên, số buổi, năm kinh nghiệm); đánh giá chỉ từ người đã tập thật. PT cũng quản lý học viên & lịch dạy ngay trong app.
- **Hashtag:** #TapEasy #timPT #personaltrainer #huanluyenvien #gymvietnam #PT

### 09. 16 giao diện, đổi trong 1 chạm — `demo-16-theme`

- **Trụ cột:** app-demo · **Thời lượng ước tính:** ~29 s (5 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “16 giao diện đổi trong 1 chạm”
- **Tiêu đề bìa:** 16 giao diện cho app tập của bạn
- **Lời đọc:** Chán giao diện cũ? TapEasy có mười sáu giao diện. Từ Đại dương, Hoàng hôn, Rừng, đến Tím đêm. Hay Sáng, Aurora, Espresso, Thu Alpine cho ai thích tối giản. Thêm Sương Wellness, Sanctuary, Cam năng lượng, Volt, Tím Đêm Pro và Chanh sáng. Icon biến hình, nút bấm có rung phản hồi. Chọn màu là chính bạn. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Caption đăng:** Navy, Đại dương, Hoàng hôn, Rừng, Tím đêm, Sáng, Aurora, Espresso, Thu Alpine, Sương Wellness, Sanctuary, Cam năng lượng, Volt, Tím Đêm Pro, Chanh sáng… Bạn chọn màu nào?
- **Hashtag:** #TapEasy #giaodien #appdep #apptapgym #theme #fitness

### 10. Trước – sau 12 tuần: hành trình bằng biểu đồ (ví dụ minh hoạ) — `hanh-trinh-12-tuan`

- **Trụ cột:** hanh-trinh · **Thời lượng ước tính:** ~41 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “12 tuần thay đổi được gì?”
- **Tiêu đề bìa:** 12 tuần thay đổi được gì? (minh hoạ)
- **Lời đọc:** Mười hai tuần tập đều và ăn đúng thì thay đổi được bao nhiêu? Xem ví dụ minh hoạ này. Cân nặng giảm từ từ, khoảng ba trăm rưởi gam mỗi tuần, không ép cân. Tỉ lệ mỡ giảm, cơ được giữ nhờ tập tạ và ăn đủ đạm. Mức tạ squat cũng tăng đều qua từng tuần. TapEasy vẽ sẵn biểu đồ cân nặng, chỉ số cơ thể và kỷ lục của bạn. Kết quả mỗi người khác nhau. Quan trọng là đều đặn. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Ví dụ minh hoạ — không phải kết quả của một người thật
- **Lưu ý trên hình:** Kết quả mỗi người khác nhau · Tham khảo, không thay tư vấn y tế
- **Caption đăng:** Ví dụ minh hoạ hành trình 12 tuần: cân nặng giảm ~0,35 kg/tuần, tỉ lệ mỡ giảm, sức mạnh tăng đều — tất cả nhìn thấy trên biểu đồ của app. Số liệu minh hoạ, kết quả mỗi người khác nhau.
- **Hashtag:** #TapEasy #hanhtrinh12tuan #truocsau #giammo #theodoitiendo #gymvietnam

### 11. Người mới tập tạ: 12 tuần mạnh lên bao nhiêu? (ví dụ minh hoạ) — `suc-manh-12-tuan`

- **Trụ cột:** hanh-trinh · **Thời lượng ước tính:** ~39 s (5 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Người mới tập tạ: 12 tuần mạnh cỡ nào?”
- **Tiêu đề bìa:** Người mới tập tạ: 12 tuần (minh hoạ)
- **Lời đọc:** Người mới tập tạ, sau mười hai tuần mạnh lên bao nhiêu? Đây là ví dụ minh hoạ. Bí quyết là tăng tải từ từ: thêm chút tạ hoặc thêm một lần mỗi tuần, giữ kỹ thuật chuẩn. Squat từ bốn mươi lên bảy mươi ký, đẩy ngực từ ba mươi lên bốn lăm. Ba buổi mỗi tuần là ba mươi sáu buổi. Chuỗi ngày tập giữ lửa cho bạn. TapEasy tự ghi kỷ lục, huy hiệu và tổng kết mỗi tuần. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Nguồn: ACSM 2009 (tăng tải tiến triển) · số liệu minh hoạ
- **Lưu ý trên hình:** Tốc độ tiến bộ mỗi người khác nhau · tập đúng kỹ thuật
- **Caption đăng:** Ví dụ minh hoạ: người mới, 3 buổi tạ/tuần, tăng tải từ từ (+2,5 kg hoặc +1 lần khi làm đủ số lần, đúng kỹ thuật). Kỷ lục & tổng kết tuần tự ghi trong app. Tiến độ mỗi người khác nhau.
- **Hashtag:** #TapEasy #nguoimoitapgym #progressiveoverload #squat #truocsau #gymvietnam

### 12. Tập bụng có giảm mỡ bụng không? — `tap-bung-giam-mo`

- **Trụ cột:** myth · **Thời lượng ước tính:** ~39 s (6 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Gập bụng mỗi ngày có giảm mỡ bụng?”
- **Tiêu đề bìa:** Gập bụng có tan mỡ bụng?
- **Lời đọc:** Gập bụng mỗi ngày có làm tan mỡ bụng không? Câu trả lời là không. Cơ thể không đốt mỡ đúng chỗ bạn tập. Một nghiên cứu sáu tuần chỉ tập bụng: mỡ bụng gần như không đổi. Muốn giảm mỡ bụng, cần thâm hụt calo, tập toàn thân và ngủ đủ. Nhưng vẫn nên tập core để khoẻ lưng và giữ tư thế tốt. TapEasy tính mức thâm hụt an toàn và lên lịch tập toàn thân cho bạn. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Nguồn: Vispute 2011; Ramírez-Campillo 2013
- **Lưu ý trên hình:** Tham khảo, không thay tư vấn y tế
- **Caption đăng:** Tập bụng không đốt mỡ “tại chỗ”. Mỡ bụng giảm khi thâm hụt calo, tập toàn thân và ngủ đủ — nhưng vẫn nên tập core cho lưng khoẻ, tư thế đẹp. Bạn từng tin điều này chưa?
- **Hashtag:** #TapEasy #mobung #giammobung #suthat #gymvietnam #kienthucgym

### 13. Đổ mồ hôi nhiều = đốt mỡ nhiều? — `mo-hoi-dot-mo`

- **Trụ cột:** myth · **Thời lượng ước tính:** ~34 s (5 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Đổ mồ hôi nhiều = đốt mỡ nhiều?”
- **Tiêu đề bìa:** Càng đổ mồ hôi càng giảm mỡ?
- **Lời đọc:** Tập ra càng nhiều mồ hôi thì càng đốt nhiều mỡ? Không hẳn. Mồ hôi giúp cơ thể làm mát, không phải thước đo mỡ bị đốt. Cân nhẹ đi sau buổi tập chủ yếu là nước, uống lại là về. Mất nước quá hai phần trăm cân nặng có thể làm giảm sức tập. Hãy uống nước đều. TapEasy giúp bạn ghi lại lượng nước uống mỗi ngày. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Nguồn trên hình:** Nguồn: ACSM 2007 (Sawka) – bù nước khi tập
- **Lưu ý trên hình:** Không dùng áo/bạt xông để giảm cân · Tham khảo
- **Caption đăng:** Mồ hôi là để làm mát, không phải thước đo mỡ bị đốt. Cân giảm sau buổi tập chủ yếu là nước. Mất nước > 2% cân nặng có thể giảm sức tập — nhớ uống nước đều nhé!
- **Hashtag:** #TapEasy #mohoi #giammo #suthat #uongnuoc #gymvietnam

### 14. Sắp ra mắt: đồng hồ thông minh & HYROX — `sap-ra-mat`

- **Trụ cột:** teaser · **Thời lượng ước tính:** ~29 s (5 nhịp + thẻ kết 3.2 s)
- **Hook (0–1,5 s):** “Sắp ra mắt trên cổ tay bạn”
- **Tiêu đề bìa:** Sắp ra mắt: TapEasy trên cổ tay
- **Lời đọc:** Sắp tới, TapEasy sẽ có mặt trên cổ tay bạn. Chạy bộ với bản đồ, tốc độ và từng cây số. Chế độ HYROX: tám chặng chạy, tám trạm, bấm giờ từng trạm. Đồng bộ nhịp tim và giấc ngủ từ đồng hồ thông minh phổ biến. Theo dõi cộng đồng TapEasy để cập nhật sớm nhất. *(+ thẻ kết: “Quét mã, tải miễn phí nhé!”)*
- **Lưu ý trên hình:** Tính năng đang phát triển, có thể thay đổi
- **Caption đăng:** Sắp ra mắt: chạy bộ (bản đồ, pace, từng km), chế độ HYROX (8 chặng chạy + 8 trạm), đồng bộ nhịp tim & giấc ngủ từ đồng hồ thông minh. Vào cộng đồng TapEasy để cập nhật sớm nhất!
- **Hashtag:** #TapEasy #sapramat #HYROX #chaybo #donghothongminh #fitness

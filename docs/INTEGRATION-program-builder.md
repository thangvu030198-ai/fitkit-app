# Tích hợp module "Tạo giáo án riêng" (program-builder)

Soạn giáo án cá nhân bằng **thuật toán luật chuyên môn**, chạy hoàn toàn trên máy (không cần AI server, không gọi mạng — trừ bước gắn video có sẵn của `tplAttachVideos`).

## 1. File mới

| File | Vai trò |
|---|---|
| `program-builder.js` | Logic thuần (`window.PB`) + giao diện bảng hỏi 6 bước, màn kết quả, 2 điểm vào |
| `program-builder.css` | Giao diện (tiền tố `.pb-`), liquid glass, vùng chạm ≥ 44 px, chữ ≥ 12 px |
| `tests/program-builder.test.js` | Kiểm thử Node: 38 tổ hợp thiết kế sẵn + 1500 tổ hợp ngẫu nhiên |
| `docs/INTEGRATION-program-builder.md` | Tài liệu này |

Không sửa file nào khác của dự án.

## 2. Thẻ cần thêm vào `index.html`

```diff
 <link rel="stylesheet" href="style.css">
+<link rel="stylesheet" href="program-builder.css">
 ...
 <script src="pt.js"></script>
+<script src="program-builder.js"></script>
 </body>
```

- `program-builder.js` phải nạp **sau** `data.js`, `templates.js`, `app.js`, `pt.js`. Thứ tự so với các module mới khác không quan trọng: module chỉ bọc (wrap) hàm toàn cục hiện có.
- Nếu quên thẻ `<link>`, module tự chèn `<link href="program-builder.css">` khi chạy.

## 3. Thay đổi ở file khác (đề xuất, dạng diff)

`scripts/prepare-www.sh` — chép file vào bản build Capacitor (bắt buộc, nếu không app iOS/Android sẽ thiếu module):

```diff
-cp index.html style.css manifest.json sw.js icons.js ... pt.js privacy-policy.html delete-account.html www/
+cp index.html style.css manifest.json sw.js icons.js ... pt.js program-builder.js program-builder.css privacy-policy.html delete-account.html www/
```

`sw.js` — tuỳ chọn, để dùng offline trên web/PWA:

```diff
-const ASSETS = [ ..., "./pt.js", "./manifest.json"];
+const ASSETS = [ ..., "./pt.js", "./program-builder.js", "./program-builder.css", "./manifest.json"];
```

`firestore.rules`: **không cần thay đổi** (dữ liệu chỉ lưu trong `state` cục bộ).

## 4. Điểm vào giao diện

1. **Trang chủ** — ghi đè `renderHomeScreen`: chèn thẻ `.pb-home-card` ngay dưới hàng chỉ số (kcal / nước / ngủ). Nếu giáo án đang dùng do module tạo ra, thẻ hiện "Giáo án riêng của bạn · bấm để tạo lại".
2. **Giáo án mẫu** — ghi đè `openTemplateBrowser`: chèn nút `.pb-tpl-cta` "Tạo giáo án riêng" ngay dưới tiêu đề sheet (nút vẫn còn khi bấm bộ lọc Nam/Nữ/cấp độ, và khi quay lại từ chi tiết giáo án mẫu).
3. Gọi trực tiếp: `openProgramBuilder()` (hàm toàn cục) — có thể gắn thêm vào menu hoặc màn "Quản lý chương trình" nếu muốn.

## 5. Luồng sử dụng

Bảng hỏi 6 bước trong sheet (nút Tiếp tục bị khoá đến khi đủ thông tin):

1. Mục tiêu: giảm mỡ / tăng cơ / sức mạnh / sức bền / săn chắc / hybrid (điền sẵn từ `state.profile.goal`).
2. Kinh nghiệm: mới tập / 6–24 tháng / trên 2 năm.
3. Lịch: số buổi 2–6 (chọn nhanh bộ ngày gợi ý) + bật/tắt từng ngày T2…CN (tối đa 6) + 30/45/60/75 phút.
4. Nơi tập: phòng gym đầy đủ, hoặc tại nhà với tạ đơn / tạ ấm / dây kháng lực / xà đơn / ghế tập / dây nhảy (hoặc không dụng cụ).
5. Nhóm cơ ưu tiên (tối đa 3: mông, ngực, lưng, vai, tay, bụng) + giới tính. Giới tính **chỉ để hiện gợi ý** ("Dùng gợi ý": Nữ → Mông + Lưng; Nam → Ngực + Lưng), không tự chọn sẵn, không đổi thuật toán.
6. Chấn thương cần tránh: lưng dưới, gối, vai, cổ tay (kèm cảnh báo hỏi bác sĩ/chuyên viên vật lý trị liệu).

Màn kết quả: huy hiệu kiểu chia buổi, số buổi, phút/buổi ước tính, tỉ lệ kéo/đẩy; khối "Vì sao giáo án này?" (6–8 ý ngắn); biểu đồ hiệp/tuần theo nhóm cơ (vạch mục tiêu); lịch 7 ngày với lý do từng buổi và từng bài; nút **Đổi bài** (danh sách bài tương đương cùng mẫu vận động, đã lọc dụng cụ + chấn thương); nút **Thêm vào tuần tập**.

"Thêm vào tuần tập": tạo plan mới trong `state.plans`, đặt `state.activePlanId`, gắn video bằng `tplAttachVideos(plan)` nếu hàm tồn tại (tối đa chờ 15 giây, sau đó video tiếp tục được gắn ngầm), `saveState()`, chuyển sang màn Tập luyện. Giáo án cũ vẫn giữ nguyên.

## 6. Dữ liệu

- `state.programBuilder = { last, lastPlanId, history:[{id, at, split, goal}] }` — `last` là câu trả lời gần nhất để điền sẵn lần sau. Luôn đọc bằng `state.programBuilder || {}`.
- Plan tạo ra theo đúng cấu trúc app: `{ id:"plan_…", name:"Giáo án riêng · Tăng cơ 4 buổi", tagline, builtin:false, fromBuilder:true, builder:{v, answers, split, createdAt}, days:{T2..CN:{title, intensity, duration, items:[{uid, exerciseId, custom:null, sets, reps, restSec, clipId:null}]}} }`. Ngày không tập: `{title:"Nghỉ ngơi", intensity:"Nghỉ", duration:0, items:[]}`.
- Chuỗi `reps` được kiểm tra để `isTimedReps`/`isMaxReps` của app hiểu đúng: bài đếm lần không chứa "giây/phút/m/s", không chứa "tối đa/max" (ghi chú như "gối gập không quá 90°" đã tránh từ này).

## 7. Thuật toán (tóm tắt)

**Bảng phân loại** `PB.EX` phủ **100% (68/68)** id trong `EXERCISES` (data.js + templates.js): mẫu vận động (squat, gập hông, đẩy hông, lunge/1 chân, đẩy ngang, đẩy dọc, kéo ngang, kéo dọc, ép ngực, vai giữa, vai sau, tay trước, tay sau, cô lập chân/mông, bắp chân, core, thể lực, cardio, giãn cơ), nhóm cơ chính/phụ (1 / 0,5 / 0,25), phương án dụng cụ (bài cáp có phương án dây kháng lực), chống chỉ định, ghi chú điều chỉnh, cấp độ tối thiểu, độ khó kỹ thuật.

Chống chỉ định (loại hẳn):

| Chấn thương | Bài bị loại |
|---|---|
| Lưng dưới | overheadpress, bentoverrow, squat, frontsquat, smithsquat, deadlift, rdl, kbswing, crunch, russiantwist, hangingleg, woodchop, burpee, sledpush, wallball, rowing |
| Gối | squat, frontsquat, smithsquat, hacksquat, lunges, bulgarian, stepup, legext, burpee, sledpush, wallball, running, jumprope |
| Vai | benchpress, inclinedb, cablefly, pecdeck, overheadpress, dbpress, pullup, pullover, ohtriext, tricepdip, sideplank, hangingleg, burpee, wallball |
| Cổ tay | benchpress, overheadpress, frontsquat, preacher, skullcrusher, tricepdip, mountainclimber, burpee, wallball |

Giữ nhưng kèm ghi chú điều chỉnh + tạ vừa ≥ 10 lần: legpress, gobletsquat, bwsquat, hacksquat, hipthrust, dbrow, dbpress (lưng dưới); dbbench, machinepress, pushup, inclinepushup, latpulldown, lateralraise, cablelateral (vai); pushup, inclinepushup (cổ tay: chống trên nắm tay).

**Kiểu chia buổi** theo số buổi tạ (= số buổi − số buổi cardio riêng theo mục tiêu; người mới tối đa 4 buổi tạ):
2 → Toàn thân A/B · 3 → Toàn thân A/B/C (người mới, giảm mỡ, sức bền, hybrid) hoặc Upper/Lower/Full · 4 → Upper/Lower ×2 · 5 → ULPPL · 6 → PPL ×2. Dụng cụ quá ít cho buổi Đẩy/Kéo riêng → Upper/Lower ×2 + Full hoặc Upper/Lower ×3. Người có kinh nghiệm (tăng cơ/săn chắc/sức mạnh) có sóng buổi **nặng** / **khối lượng**.
Sắp xếp tuần: thử mọi cách đặt buổi tạ/cardio vào ngày đã chọn, phạt hai buổi chân liền nhau, toàn thân liền nhau, interval sát buổi chân, chuỗi > 3 ngày liên tiếp → chọn phương án ít phạt nhất, cảnh báo nếu không tránh được.

**Mỗi buổi**: các "slot" (mẫu vận động + vai trò chính/bổ trợ/phụ/core) theo độ quan trọng; nhóm cơ ưu tiên được thêm slot/đẩy lên sớm. Chọn bài bằng điểm: mục tiêu (sức mạnh ưu tiên tạ đòn), kinh nghiệm (người mới ưu tiên máy/tạ đơn, tránh bài kỹ thuật khó), nhóm ưu tiên, đa dạng trong tuần, phạt bài cần điều chỉnh. Không có bài phù hợp → lùi theo chuỗi thay thế (VD squat → lunge → đẩy hông).
Pha 1 đủ mẫu vận động trong ngân sách thời gian (≤ 4/5/6/7 bài tạ cho 30/45/60/75 phút, luôn ≥ 3 bài), pha 2 tăng hiệp tới mặc định.

**Khối lượng**: mục tiêu = {10, 14, 18} hiệp/nhóm cơ/tuần × hệ số mục tiêu (tăng cơ 1 · săn chắc 0,9 · sức mạnh/giảm mỡ 0,8 · hybrid 0,75 · sức bền 0,6); nhóm ưu tiên +4. Trần cứng 20 hiệp/tuần, ≤ 10 hiệp/nhóm cơ/buổi. Bù nhóm thiếu bằng thêm hiệp rồi thêm bài (nếu còn thời gian), cắt phần vượt.
**Đẩy/kéo**: số hiệp (đẩy ngang + đẩy dọc + ép ngực) : (kéo ngang + kéo dọc + vai sau), giữ kéo/đẩy 0,9–1,5.
**Số lần/nghỉ** theo mục tiêu × kinh nghiệm × vai trò (VD tăng cơ bài chính 6–10, buổi nặng 5–8, nghỉ 150 s; sức mạnh 3–5 · RPE 7–8, nghỉ 180 s; giảm mỡ 8–12, nghỉ 75–90 s); buổi 30 phút rút ngắn nghỉ.
**Cardio**: giảm mỡ/săn chắc/sức bền/hybrid có Zone 2 + interval (ngày riêng và/hoặc cuối buổi tạ; hybrid dùng bài thể lực: vung tạ ấm, xách tạ, đẩy xe trượt, ném bóng tường). Người mới dùng đi bộ / đi bộ ngắt quãng; gối → đạp xe/đi bộ.
**Thời lượng ước tính** = 5′ khởi động + Σ[hiệp × (thời gian thực hiện + nghỉ × 1,1) + 60 s chuyển bài] + hiệp làm nóng bài chính; thời gian dư dùng cho hiệp thêm (trong trần), Zone 2 nhẹ, giãn cơ.

API thuần (dùng được cho module khác/PT): `PB.generate(answers)`, `PB.alternatives(prog, si, ii)`, `PB.swap(prog, si, ii, id)`, `PB.toPlan(prog)`, `PB.EX`, `PB.feasible(id, ctx)`.

## 8. Cách thử

```bash
cd FitKit
node -e "new Function(require('fs').readFileSync('program-builder.js','utf8'))"   # cú pháp
node tests/program-builder.test.js            # tóm tắt 38 tổ hợp + fuzz 1500
node tests/program-builder.test.js --verbose  # in từng buổi, từng bài
```

Kết quả lần chạy cuối: **438 819 / 438 819 kiểm tra đạt, 0 lỗi** — 6 095 buổi (4 565 buổi tạ), 674 lần Đổi bài; 0 bài chống chỉ định, 0 bài sai dụng cụ, ≤ 20 hiệp/nhóm cơ/tuần, mọi buổi ≤ thời gian chọn + 3′, tỉ lệ kéo/đẩy 0,9–1,5 (miễn khi tổng chênh ≤ 2 hiệp). 1 buổi ngắn hơn 12′ so với lựa chọn (ca 3 chấn thương, tại nhà — số bài an toàn có hạn).

Giao diện (harness ghép index.html + module, xuất ra `outputs/_test/program-builder-t_*.html`): kịch bản `t_flow` bấm qua toàn bộ luồng (Trang chủ → Giáo án mẫu → 6 bước → kết quả → Đổi bài → Sửa câu trả lời → Thêm vào tuần tập → Trang chủ) — **37/37 đạt, 0 lỗi JS**, gồm kiểm tra nút ≥ 44 px và chữ ≥ 12 px. Ảnh chụp ở `outputs/_test/shots/pb-visual_*.jpg`.

## 9. Giới hạn

- Giáo án 1 tuần lặp lại; tăng tiến (tăng tạ khi đạt đỉnh khoảng lần, deload 5–6 tuần) chỉ được hướng dẫn bằng chữ — chưa tự sinh chu kỳ nhiều tuần.
- Bài mới do module khác thêm vào `EXERCISES` sẽ **không được dùng** cho tới khi bổ sung vào `PB.EX` (kiểm thử Node báo "Thiếu phân loại" để nhắc).
- Bài cáp được thay bằng dây kháng lực khi tập tại nhà — khoảng lần 12–20 vì lực cản dây nhẹ.
- Ước lượng thời gian là trung bình (người nghỉ lâu hơn sẽ tập lâu hơn). Buổi cardio phục hồi của tăng cơ/sức mạnh cố ý ngắn hơn (≤ 40′ Zone 2).
- Chống chỉ định là sàng lọc chung, không thay chẩn đoán y khoa; luôn có lời khuyên hỏi bác sĩ/chuyên viên vật lý trị liệu khi đau.
- Nút "Thêm vào tuần tập" cần mạng để gắn video (qua `tplAttachVideos`); offline vẫn tạo giáo án, chỉ thiếu video.

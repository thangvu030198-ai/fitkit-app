# Tích hợp module TRAINING PRO (`training-pro.js` + `training-pro.css`)

Chu kỳ giáo án & tuần giảm tải · Superset / circuit · AMRAP & ước tính 1RM · Khối lượng theo nhóm cơ/tuần · Thẻ tổng kết chia sẻ 1080×1350 · Đồng hồ buổi tập, ghi chú & nhật ký buổi.
Module tự chạy khi được nạp **sau `pt.js`**, không sửa file nào khác. Mọi điểm ghi đè đều gọi lại hàm cũ và bọc `try/catch` (lỗi trong module không làm hỏng app).

## 1. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="style.css">
+  <link rel="stylesheet" href="training-pro.css">
 ...
   <script src="pt.js"></script>
+  <script src="training-pro.js"></script>
```

- CSS đặt **sau** `style.css`. JS đặt **sau** `pt.js`. Thứ tự với các module khác (achievements, health-safety, pt-pro, program-builder, nutrition-pro, meals-extra, themes, ui-kit) **không bắt buộc** — đã chạy thử cả hai thứ tự (nạp trước và nạp sau các module đó), không lỗi.
- Đóng gói app: thêm 2 file vào `scripts/prepare-www.sh` (và nên thêm vào danh sách cache của `sw.js`):

```diff
-cp index.html style.css manifest.json sw.js icons.js ... pt.js privacy-policy.html delete-account.html www/
+cp index.html style.css manifest.json sw.js icons.js ... pt.js training-pro.js training-pro.css privacy-policy.html delete-account.html www/
```
```diff
-const ASSETS = [..., "./pt.js","./manifest.json"];
+const ASSETS = [..., "./pt.js","./training-pro.js","./training-pro.css","./manifest.json"];
```

Không cần đổi `firestore.rules` (dữ liệu chỉ lưu cục bộ trong `state`, đi kèm bản sao lưu Drive vì nằm trong `state`).

## 2. Dữ liệu — `state.trainingPro` (tự tạo, tương thích dữ liệu cũ)

| Khoá | Ý nghĩa |
|---|---|
| `cycles[planId]` | `{ tplId, weeks, deloadEvery, startDate (thứ Hai, "YYYY-MM-DD"), round, base:{exKey:1RM đầu chu kỳ}, overrides:{tuần:true/false} }` |
| `links[planId][dayKey]` | `["uidA>uidB", …]` — cặp bài liền nhau được ghép. Nhóm = chuỗi cặp liền nhau (tối đa 5 bài). Xoá/chèn bài làm 2 bài không còn liền nhau → liên kết tự mất hiệu lực. |
| `amrapItems[uid]` | `true` = người dùng bật "Hiệp cuối AMRAP" cho bài đó. |
| `amrap[exKey]` | `[{date, kg, reps, e1rm}]` (≤ 60) — kết quả hiệp AMRAP, dùng cho kỷ lục số lần & gợi ý. |
| `log` | `[{id, date, dayKey, planId, planName, title, startedAt, endedAt, dur(giây), volume, sets, completed, total, exercises:[{key,name,muscle,sets,hard,timed,vol,best}], prs, week, weeks, deload, note}]` (≤ 300) — nhật ký buổi tập. Chỉ ghi buổi **hôm nay** có ≥ 1 bài hoàn thành (buổi "xem trước" không lưu, giống app gốc). |

Không ghi thêm trường nào vào `plans`, `setLog`, `setHist` (chỉ dùng như app gốc).

## 3. Các điểm ghi đè

| Hàm toàn cục | Thêm gì |
|---|---|
| `renderSessionStep` | Khởi tạo `session._tp` (giờ bắt đầu, tuần, deload, nhóm superset). Bài thuộc nhóm → **màn superset/circuit riêng** (luân phiên, con trỏ hiệp kế tiếp, chỉ nghỉ sau khi xong vòng = thời gian nghỉ dài nhất trong nhóm). Bài lẻ → gọi màn gốc rồi chèn: đồng hồ, "Tuần x/y", nút Ghi chú, banner deload, nhãn/ước tính AMRAP, chặn lưu khi hiệp AMRAP chưa ghi số lần. |
| `recordExerciseResult` | Tuần deload: vẫn ghi lịch sử (`setHist`) nhưng **khôi phục `setLog` trước deload** → tuần sau tăng tiến tiếp từ mức tạ cũ, không bị kéo tụt. Ghi kết quả AMRAP + phát hiện kỷ lục số lần. |
| `finishSession` | Lưu nhật ký buổi; màn "Hoàn thành" thêm Thời gian / Số hiệp / Khối lượng, tuần chu kỳ, kỷ lục số lần, ô **Ghi chú buổi tập** và nút **Tạo thẻ tổng kết để chia sẻ**. |
| `closeSheet` | Khi buổi bị tạm dừng → vẽ lại màn Tập luyện để hiện "đang tạm dừng · đồng hồ · Tiếp tục buổi tập". |
| `renderWorkoutScreen` | Thẻ chu kỳ (Tuần x/y, thanh tuần, tuần giảm tải; hết chu kỳ → kết quả 1RM, chuyên cần, nút *Lặp lại với tạ mới* / *Nâng cấp: giáo án gợi ý*); hero ghi "TUẦN x/y"; pill *Chu kỳ & deload*, *Nhật ký buổi tập*; nhóm superset/circuit + nhãn AMRAP/deload trong danh sách bài; nút **Superset** ở tiêu đề danh sách. |
| `renderPlansScreen` | Màn sửa giáo án: hiển thị nhóm + nút *Ghép superset / circuit*. |
| `openPlanItemEditor` | Công tắc **Hiệp cuối AMRAP**. |
| `renderProgressScreen` | Thẻ **Khối lượng theo nhóm cơ** (SVG, chuyển tuần, vạch "theo giáo án") ngay sau thẻ Kỷ lục cá nhân, có ở cả 2 tab. |
| `tplAddToWeek` | Sau khi áp dụng giáo án mẫu → tạo chu kỳ (`weeks` của giáo án, tuần giảm tải theo giáo án). |
| `openTemplateDetail` | Ghi chú "Chu kỳ N tuần · tuần giảm tải: …". |

Icon mới thêm vào `FK_LINE`: `link_off, download, edit_note, event_repeat, upgrade, stacks, history, image, trophy`.
API cho module khác/kiểm thử: `window.FKTP` (`cycleInfo`, `startCycle`, `groupsFor`, `weekVolume`, `openShareCard`, `openLogSheet`…).

## 4. Logic chuyên môn (HLV sức mạnh)

- **Tuần làm quen / tuần 1:** áp dụng giáo án từ T2–T5 → tuần này là tuần 1; từ T6–CN → tuần 1 bắt đầu T2 tuần sau, mấy ngày còn lại là "tuần làm quen".
- **Deload:** mặc định mỗi tuần thứ 5 (5, 10…); theo giáo án nếu có trường `deloadEvery` hoặc mô tả ghi "tuần 4 giảm tải" / "deload mỗi N tuần" (VD Powerbuilding nữ: tuần 4, 8, 12). Chỉnh trong sheet *Chu kỳ & deload*: tổng tuần, tần suất (tắt/4/5/6/8), tuần hiện tại, đổi riêng tuần này thành deload hoặc bỏ deload (tự điều chỉnh theo sức hồi phục).
  Trong tuần deload: số hiệp × 0,6 (làm tròn, tối thiểu 1 — "giảm ~40%"), tạ điền sẵn = 90% mức tạ buổi thường gần nhất (làm tròn theo bước tạ của app), ẩn thông báo tăng tạ, nhắc dừng xa thất bại (RIR 3–4). Bài cardio/tính giờ: gợi ý giảm ~1/3 thời gian hoặc tốc độ.
- **Hết chu kỳ:** bảng 1RM ước tính đầu chu kỳ → tốt nhất trong chu kỳ (%), chuyên cần (buổi đã tập/buổi theo lịch). *Lặp lại với tạ mới* = vòng mới, app giữ mức tạ đã đạt; *Nâng cấp* = giáo án cùng giới (hoặc chung), cấp độ kế tiếp, cùng kiểu (tạ/hybrid/cardio), số buổi gần nhau; giáo án nâng cao → gợi ý giáo án nâng cao khác.
- **Superset/circuit:** 2 bài = superset, 3–5 bài = circuit. Mẹo HLV trong sheet: ghép đối vận / bài chính + bài bụng-bắp chân; cảnh báo khi ghép 2 bài đa khớp nặng (Squat, Deadlift, Bench, OHP, RDL, Hip Thrust…). Không áp dụng nhóm cho "Buổi nhanh 20 phút" (achievements.js).
- **AMRAP:** số lần ghi "tối đa / max / AMRAP" → mọi hiệp; "8+" hoặc công tắc *Hiệp cuối AMRAP* → hiệp cuối. "tối đa −2" hiểu là RIR 2. Ô số lần để trống (gợi ý "≥ mốc cần vượt"), bắt buộc nhập số thật trước khi đánh dấu/lưu. Hiển thị 1RM ước tính (Epley, công thức `e1rm()` của app, giới hạn 12 lần — trên 12 lần app cảnh báo kém chính xác) và tạ gợi ý cho số lần mục tiêu còn 2 lần (RIR 2). Bài không tạ: theo dõi kỷ lục số lần.
- **Khối lượng nhóm cơ:** 10 nhóm (Ngực, Lưng, Vai, Tay trước, Tay sau, Đùi trước, Đùi sau, Mông, Bắp chân, Bụng). Hiệp hiệu quả = hiệp chính đã hoàn thành; nhóm cơ phụ của bài đa khớp tính 0,5 hiệp (VD Bench: Ngực 1, Tay sau 0,5, Vai 0,5); hiệp ghi RPE ≤ 6 tính nửa hiệp. Màu: < 10 cam, 10–20 mint (khuyến nghị), > 20 vàng; vạch trắng = số hiệp theo giáo án. Nguồn số liệu: nhật ký buổi (có cả bài tính giờ như plank) + `setHist` (dữ liệu cũ trước khi cài module), không đếm trùng.

## 5. Cách thử

```bash
# 1) Cú pháp
node -e "new Function(require('fs').readFileSync('training-pro.js','utf8'))"
# 2) Logic thuần (64 kiểm tra: tuần/deload/override, giáo án nâng cấp, nhóm superset, AMRAP, nhóm cơ, khối lượng tuần,
#    deload không làm tụt setLog, kỷ lục số lần, tổng kết, tplAddToWeek)
node _test/training-pro-harness/node_test.js
# 3) Chạy APP THẬT (index.html + toàn bộ script) trong mini-DOM Node — 55 + 16 kiểm tra luồng giao diện
node _test/training-pro-harness/run_dom.js _test/training-pro-harness/t_auto.js
node _test/training-pro-harness/run_dom.js _test/training-pro-harness/t_extra.js
#    kèm các module khác (nạp trước / sau training-pro):
node _test/training-pro-harness/run_dom.js _test/training-pro-harness/t_auto.js achievements.js health-safety.js pt-pro.js program-builder.js themes.js ui-kit.js [--after]
# 4) Trình duyệt: mở _test/training-pro-auto.html (1 file, chạy offline) → bảng PASS/FAIL
```
(Đường dẫn trong `run_dom.js`/`node_test.js` trỏ tới `/sessions/.../outputs/FitKit/` — sửa hằng `ROOT` nếu chạy chỗ khác.)

Thử tay nhanh: Giáo án mẫu → *Thêm vào tuần tập* → màn Tập luyện có thẻ "Tuần 1/12" → *Chu kỳ & deload* → chọn "Tuần hiện tại = 5" → bắt đầu buổi: thấy số hiệp/tạ giảm. Bấm **Superset** ở danh sách bài → ghép 2 bài → bắt đầu buổi → tập luân phiên. Kết thúc → *Tạo thẻ tổng kết* → Lưu ảnh / Chia sẻ. Vào *Ảnh tiến trình & InBody* → thẻ "Khối lượng theo nhóm cơ".

## 6. Giới hạn / việc còn lại

- Chỉ ghép được các bài **liền nhau**; muốn ghép bài xa nhau phải đổi thứ tự (app gốc chưa có kéo-thả sắp xếp).
- Màn superset có Lịch sử + Video & kỹ thuật cho từng bài, chưa có công cụ Khởi động/Đĩa tạ như màn bài lẻ.
- Đồng hồ buổi tập chạy liên tục từ lúc bắt đầu (kể cả lúc tạm dừng), giống Strong/Hevy.
- Chia sẻ ảnh: web dùng `navigator.share({files})` nếu trình duyệt hỗ trợ, nếu không thì tải PNG. Trong app native (Capacitor) chưa có plugin `@capacitor/filesystem` nên nút Lưu/Chia sẻ hiển thị ảnh để **nhấn giữ → Lưu ảnh** (+ chép nội dung). Muốn chia sẻ file trực tiếp: thêm `@capacitor/filesystem`, ghi PNG vào `Directory.Cache` rồi gọi `Share.share({ files:[uri] })`.
- Chữ trên thẻ dùng font đã tải của app (Inter Tight/Inter); chưa tải xong thì dùng font hệ thống.
- Ghi chú buổi và nhật ký chỉ lưu trên máy (chưa đồng bộ cho PT qua `cloud`).
- Thử trên trình duyệt thật bằng ảnh chụp chưa làm được trong phiên này (khung xem trước không mở được từ agent); bố cục thẻ chia sẻ & biểu đồ đã kiểm bằng cách vẽ lại lệnh canvas/SVG ra PNG (`_test/training-pro-card-preview.png`, `_test/training-pro-volume-preview.png`).

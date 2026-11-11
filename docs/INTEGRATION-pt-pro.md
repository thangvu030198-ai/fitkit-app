# Tích hợp module PT PRO (`pt-pro.js` + `pt-pro.css`)

Nâng cấp khu PT ↔ Học viên (`coach.js`):

1. **Hồ sơ sức khoẻ học viên** (tab mới **Sức khoẻ** trong form học viên, PT và học viên đều xem/cập nhật): PAR-Q 7 câu chuẩn + xác nhận bác sĩ, chấn thương/bệnh lý (gợi ý bài cần tránh theo vùng/bệnh), mục tiêu chi tiết (cân nặng/% mỡ mục tiêu, hạn, trình độ, buổi/tuần, động lực), thông tin cơ thể (ngày sinh, giới tính, chiều cao → tuổi, BMI ngưỡng châu Á, tỉ lệ eo/mông ngưỡng WHO), **số đo theo ngày** (cân nặng, eo, mông, ngực, tay, đùi, % mỡ) có biểu đồ xu hướng SVG + đường mục tiêu, **ảnh tiến trình** (chọn ảnh từ máy, nén ≤ 600 px JPEG ~40–90 KB, 3 góc, so sánh trước/sau kèm cân nặng gần ngày chụp).
2. **Cảnh báo & "Việc cần làm hôm nay"** trên màn PT: vắng ≥ 2 buổi liên tiếp, gói còn ≤ 3 buổi / hết gói / sắp hết hạn, chưa có buổi trong 7 ngày tới, buổi quá hạn chưa xác nhận, công nợ, sinh nhật (hôm nay / 7 ngày tới), PAR-Q có câu "Có", chưa làm PAR-Q, lâu chưa đo lại, **trùng giờ** 7 ngày tới. Danh sách buổi dạy hôm nay có nút nhanh **Đã tập / Vắng**. Mỗi việc có nút hành động (Gia hạn, Hỏi thăm, Chúc mừng sinh nhật – soạn sẵn tin nhắn, Xếp lịch, Thu tiền…) và nút ✓ "đã xử lý hôm nay".
3. **Lịch tổng hợp** (sheet): xem theo **ngày** (dòng thời gian, khối chồng giờ xếp làn cạnh nhau, vạch "bây giờ") hoặc **tuần** (7 ô ngày + danh sách), phát hiện và liệt kê cặp trùng giờ, chạm buổi → mở đúng buổi trong form học viên.
4. **Giao nguyên giáo án mẫu** (`PROGRAM_TEMPLATES`): chọn học viên → lọc Nam/Nữ/cấp độ (gắn nhãn "Phù hợp" theo hồ sơ) → chọn ngày bắt đầu, số tuần (mặc định khớp số buổi còn lại của gói), giờ tập, hình thức, ngày tập cùng PT (ngày cardio mặc định bỏ – học viên tự tập), tự **giảm tải tuần thứ 6** (−40% số hiệp). Xem trước số buổi, ngày đầu/cuối, cảnh báo vượt gói và **trùng giờ với lịch hiện có** → tạo hàng loạt qua `cloud.saveSession` (bài tập map từ `EXERCISES`: name, sets, reps, restSec, img, guide, muscle) + gửi ghi chú báo học viên. Tab **Thời khoá biểu** có nút "Giao nguyên giáo án mẫu" và thẻ "Giáo án đang giao" với nút **gỡ các buổi chưa tập** của đợt.
5. **Gói tập & doanh thu**: tab mới **Gói tập** (PT sửa, học viên chỉ xem): buổi còn lại / đã tập / ngày tới hạn, giá gói, đơn giá/buổi, đã thanh toán, công nợ; **Gia hạn / tạo gói** (preset 12/24/36/48 buổi, tự gợi ý hạn dùng), **Thu tiền** (trả góp / thu nợ), **Sửa gói** (tổng buổi, hạn, trạng thái Đang tập / Tạm nghỉ / Đã kết thúc – tạm nghỉ thì tắt nhắc vắng/xếp lịch), lịch sử thanh toán (xoá thanh toán gói sẽ trừ lại số buổi đã cộng). Sheet **Gói & doanh thu**: doanh thu đã thu theo tháng (chuyển tháng), biểu đồ 6 tháng, học viên đang hoạt động, buổi đã dạy trong tháng, đơn giá TB/buổi, tổng công nợ, danh sách sắp cần gia hạn + doanh thu tiềm năng, danh sách thanh toán trong tháng.
6. **Tìm kiếm / lọc / sắp xếp** danh sách học viên: tìm không dấu theo tên, SĐT, mục tiêu, email; lọc Tất cả / Cần chú ý / Đang hoạt động / Sắp hết gói / Chưa kết nối / Tạm nghỉ (kèm số lượng); sắp xếp theo buổi tới gần nhất, cần chú ý trước, tên A→Z, còn ít buổi nhất, mới cập nhật. Mỗi dòng học viên có nhãn cảnh báo, số buổi còn, chấn thương.

Các tab cũ được bổ sung: **Thông tin** (thẻ tóm tắt Sức khoẻ & gói tập), **Buổi này tập gì** (băng "Lưu ý sức khoẻ" khi có chấn thương / PAR-Q "Có" – cả PT và học viên đều thấy), **Tiến độ** (biểu đồ cân nặng).

Module tự chạy khi được nạp **sau `pt.js`**, không sửa file nào khác. Mọi điểm ghi đè đều gọi lại hàm gốc và bọc `try/catch`.

---

## 1. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="style.css">
+  <link rel="stylesheet" href="pt-pro.css">
 ...
   <script src="pt.js"></script>
+  <script src="pt-pro.js"></script>
 </body>
```

- CSS đặt **sau** `style.css` (nếu có `themes.css` thì đặt `pt-pro.css` trước hoặc sau đều được – module dùng biến `--mint`, `--coral`, `--navy`, `--glass`…; một số nền kính dùng `rgba(94,230,199,…)` / `rgba(255,122,69,…)` viết cứng theo bảng màu v2.3).
- JS đặt **sau** `pt.js`; thứ tự với các module khác không bắt buộc (mọi wrapper đều gọi lại hàm cũ).

### Danh sách file đóng gói / cache

`scripts/prepare-www.sh`:
```diff
-cp index.html style.css ... coach.js ptprofile.js pt.js privacy-policy.html delete-account.html www/
+cp index.html style.css ... coach.js ptprofile.js pt.js pt-pro.js pt-pro.css privacy-policy.html delete-account.html www/
```

`sw.js`:
```diff
-const CACHE = "fitkit-v3";
-const ASSETS = [ ..., "./pt.js", "./manifest.json"];
+const CACHE = "fitkit-v4";
+const ASSETS = [ ..., "./pt.js", "./pt-pro.js", "./pt-pro.css", "./manifest.json"];
```

## 2. Thay đổi `firestore.rules` (cần cho chế độ Firebase)

PT đã được sửa mọi trường của form học viên → **không cần đổi gì cho phía PT** (gói, thanh toán, sức khoẻ…).
Để **học viên tự cập nhật** PAR-Q, chấn thương, mục tiêu, số đo, ảnh tiến trình của chính mình, thêm 1 nhánh vào `allow update` của `match /clients/{cid}`:

```diff
       allow update: if signedIn() && (
         // PT sửa mọi thứ trừ chủ sở hữu
         (isPT() && request.resource.data.ptId == me())
         // Học viên nhập mã: chỉ khi form chưa có ai, chỉ ghi 3 trường của mình
         || (resource.data.studentUid == null
             && request.resource.data.studentUid == me()
             && onlyKeys(['studentUid', 'studentName', 'studentEmail', 'updatedAt']))
         // Học viên rời PT
         || (isStudent()
             && request.resource.data.studentUid == null
             && onlyKeys(['studentUid', 'studentName', 'studentEmail', 'updatedAt']))
+        // PT Pro: học viên cập nhật hồ sơ sức khoẻ / số đo / ảnh tiến trình của mình
+        || (isStudent()
+            && onlyKeys(['health', 'measurements', 'photos', 'updatedAt']))
       );
```

- Học viên **không** ghi được `pkg`, `payments`, `packageTotal` (chỉ PT).
- Chưa cập nhật rules thì học viên vẫn xem được mọi thứ; khi bấm lưu sẽ nhận thông báo tiếng Việt "Máy chủ chưa cho học viên tự cập nhật hồ sơ sức khoẻ…" (PT vẫn nhập thay được).
- Lưu ý quyền riêng tư: học viên đọc được cả `payments` của chính mình (giá gói, lịch sử thanh toán) – đây là chủ ý (minh bạch như hoá đơn). Dữ liệu sức khoẻ chỉ PT và học viên của form đọc được (rule `read` hiện có).
- **Giới hạn 1 MiB / document Firestore**: ảnh nén ~600 px JPEG (tự giảm chất lượng tới khi ≤ ~90 KB dataURL), tối đa **12 ảnh / ~475 KB** mỗi học viên, số đo giữ 120 lần gần nhất. Nếu sau này cần nhiều ảnh hơn, chuyển ảnh sang Firebase Storage (đường dẫn `clients/{cid}/photos/{id}.jpg`) và chỉ lưu URL trong `photos[]`.

## 3. Dữ liệu

### Trường mới trong `clients/{cid}` (ghi bằng `cloud.updateClient(id, partial)`)

| Trường | Cấu trúc |
|---|---|
| `health` | `{ dob:"YYYY-MM-DD", gender:"male"/"female"/"", height:cm, parq:{ answers:[bool×7], date, by:"pt"/"student", clearance:{ ok, date, note } \| null }, conditions:[{ id, kind:"injury"/"disease", name, since:"YYYY-MM", status:"active"/"recovered", avoid, note, by, at }], goal:{ main, targetWeight, targetFat, targetDate, level:"beginner"/"intermediate"/"advanced", daysPerWeek, why } }` |
| `measurements` | `[{ id, date, weight, waist, hip, chest, arm, thigh, fat, by, at }]` (kg / cm / %; trùng ngày thì gộp) |
| `photos` | `[{ id, date, pose:"front"/"side"/"back", data:"data:image/jpeg;base64,…", by, at }]` |
| `pkg` | `{ name, price, sessions, expiry:"YYYY-MM-DD", start, state:"active"/"paused"/"ended" }` – gói hiện tại |
| `payments` | `[{ id, date, amount (đã thu), price (giá gói – để tính công nợ), sessions, method, kind:"new"/"renew"/"current"/"debt", note, by, at }]` |
| `packageTotal` | Trường có sẵn – **gia hạn sẽ cộng thêm** số buổi (giữ tương thích "gói còn lại" của coach.js). |

Công nợ = Σ`price` − Σ`amount`. Doanh thu tháng = Σ`amount` có `date` trong tháng.
Ghi theo kiểu "đọc bản mới nhất → sửa → ghi các trường thay đổi" (`cloud.getClient` rồi `cloud.updateClient`) để hạn chế ghi đè khi PT và học viên cùng sửa; giá trị `undefined` được loại bỏ trước khi ghi Firestore.

### Trường mới trong buổi tập `clients/{cid}/sessions/{id}`
- Buổi tạo từ giáo án mẫu: `program:{ tplId, name, batch, week, weeks }`, `duration` (phút, từ giáo án), bài tập có thêm `exId` (mã `EXERCISES`).
- Nút "Vắng" nhanh: `status:"cancelled", absent:true, cancelledAt`.
- Trùng giờ tính theo `duration` (mặc định 60 phút cho buổi cũ không có trường này), bỏ qua buổi huỷ.

### `state.ptPro` (cục bộ, `saveState()`)
`{ q, filter, sort, done:{ "YYYY-MM-DD":[khoá việc đã xử lý] }, cal:"day"/"week" }` – chỉ giữ việc đã xử lý của hôm nay.

## 4. Các điểm ghi đè / chèn

| Hàm / dữ liệu toàn cục | Thêm gì |
|---|---|
| `renderCoachScreen` | Sau khi vẽ tab "Học viên của tôi": hàng KPI (doanh thu tháng, đang hoạt động, cần chú ý), 3 ô công cụ (Lịch tổng hợp, Giao giáo án, Gói & doanh thu), thẻ **Việc cần làm hôm nay**, thanh tìm/lọc/sắp xếp; danh sách học viên vẽ lại bằng `clientRowHTML` + nhãn cảnh báo. |
| `CF_TABS` | Chèn `{id:"ptp_health", label:"Sức khoẻ"}`, `{id:"ptp_pkg", label:"Gói tập"}` ngay sau "Thông tin". |
| `renderClientForm` | Tab của module: vẽ thanh tab bằng hàm gốc rồi thay nội dung; tab cũ: gọi hàm gốc rồi chèn thẻ (info / today / schedule / progress). |
| `FK_LINE` | Thêm icon nét mảnh (chỉ khi chưa có): `chevron_left, payments, cake, health_and_safety, healing, straighten, calendar_month, today, sort, receipt_long, checklist, account_balance_wallet, quiz, autorenew, inventory_2`. |

API công khai để module khác gọi: `PTP.openCalendar()`, `PTP.openAssign(cid)`, `PTP.openRevenue()`, `PTP.openRenewSheet(cid)`, `PTP.openPaySheet(cid)`, `PTP.openMeasureSheet(cid)`, `PTP.openParq(cid)`, `PTP.openPhotoAdd(cid)`, `PTP.openPhotoCompare(cid)`; hàm thuần ở `PTP.logic` (cảnh báo, trùng giờ, sinh buổi từ giáo án, biểu đồ…).

## 5. Cách thử (chế độ demo)

1. Thêm 2 thẻ ở mục 1, mở app, tạo tài khoản → chọn vai trò PT → thêm 2–3 học viên.
2. Mở form học viên → tab **Sức khoẻ**: làm PAR-Q (chọn 1 câu "Có" → cảnh báo + băng an toàn ở "Buổi này tập gì"), thêm chấn thương "Gối", nhập 2 lần số đo khác ngày (biểu đồ hiện), thêm 2 ảnh → **So sánh**.
3. Tab **Gói tập** → Gia hạn 12 buổi, giá 3.600.000, đã thu 2.000.000 → công nợ 1,6 tr xuất hiện trong "Việc cần làm".
4. Màn PT → **Giao giáo án** → chọn mẫu, đổi giờ trùng với buổi đã có → xem cảnh báo trùng giờ → Tạo lịch. **Lịch tổng hợp** → Ngày/Tuần.
5. Đăng xuất, đăng ký tài khoản học viên, nhập mã → form của PT → tab Sức khoẻ (sửa được), Gói tập (chỉ xem).

Kiểm thử tự động đã chạy:
- `node -e "new Function(…pt-pro.js…)"` – cú pháp OK.
- 15 nhóm kiểm thử logic thuần bằng Node (ngày, chuỗi vắng, gói, sinh nhật, PAR-Q, công nợ, BMI/WHR, cảnh báo, trùng giờ, xếp làn, sinh buổi từ giáo án + giảm tải, biểu đồ) – đạt hết; sinh buổi cho cả 15 giáo án mẫu (774 buổi) – mọi `exId` đều có trong `EXERCISES`.
- Harness giao diện (ghép index.html + toàn bộ script + module, dữ liệu mẫu 3 học viên): **37/37** bước đạt, 0 lỗi JS – gồm bảng điều khiển, tìm không dấu, lọc, sắp xếp, lịch ngày/tuần + trùng giờ, doanh thu, giao giáo án (tạo đúng 6 buổi, bài map đủ), tab Sức khoẻ, PAR-Q, số đo, gia hạn + công nợ, thẻ chèn tab cũ, gỡ đợt giáo án, và luồng học viên (xem, tự nhập số đo, gói chỉ đọc). Ảnh chụp màn hình ở `_test/shots/`.

## 6. Giới hạn / việc có thể làm tiếp

- "Vắng" dùng chung trạng thái `cancelled` với "Huỷ" của coach.js; chuỗi vắng đếm mọi buổi huỷ liên tiếp (buổi PT tự huỷ cũng tính). Nếu muốn tách, coach.js có thể ghi thêm `absent:true` khi chọn "vắng" và module sẽ dễ lọc theo cờ này.
- Trùng giờ chỉ xét lịch PT trong app (không đồng bộ lịch Google). Buổi tạo bằng trình soạn buổi của coach.js không được cảnh báo trùng ngay lúc lưu – xem trong Lịch tổng hợp / "Việc cần làm".
- Doanh thu tính theo tiền **đã thu** (cash basis), chưa phân bổ theo buổi đã dạy; chưa xuất Excel/PDF.
- Ảnh tiến trình lưu trong document (giới hạn 12 ảnh); chưa có Firebase Storage.
- Nhắc "đo lại" mặc định 28 ngày; PAR-Q hết hạn sau 12 tháng – chưa có tuỳ chỉnh.
- Sinh nhật chỉ hiện nếu đã nhập ngày sinh trong "Mục tiêu & thông tin cơ thể".

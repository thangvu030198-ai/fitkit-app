# INTEGRATION — Việt hoá thư viện 800+ bài (exdb-vi)

## 1. Các file mới

| File | Nội dung |
|---|---|
| `exdb-vi-1.js` | Dữ liệu dịch, phần 1/3 (id `3_4_Sit-Up` → `Front_Leg_Raises`): 292 tên, 218 hướng dẫn |
| `exdb-vi-2.js` | Dữ liệu dịch, phần 2/3 (`Front_Plate_Raise` → `Reverse_Band_Box_Squat`): 292 tên, 202 hướng dẫn |
| `exdb-vi-3.js` | Dữ liệu dịch, phần 3/3 (`Reverse_Band_Deadlift` → `Zottman_Preacher_Curl`): 292 tên, 196 hướng dẫn |
| `exdb-vi.js` | Phần tích hợp: ghi đè các hàm hiển thị và tìm kiếm của exdb.js / library.js |
| `docs/GLOSSARY-vi.md` | Bảng thuật ngữ Anh → Việt (động tác, dụng cụ, tư thế, nhóm cơ, cách gọi đời thường) |

**Tổng: 876/876 bài có tên tiếng Việt, 616/876 bài có hướng dẫn tiếng Việt** (gồm gần như toàn bộ bài strength dùng tạ đòn, tạ đơn, cáp, máy, không dụng cụ, tạ ấm, dây kháng lực ở cấp Mới tập và Trung bình, cùng các bài cardio, giãn cơ và lăn cơ phổ biến). Mỗi hướng dẫn dài 2–4 câu và có ít nhất một ý an toàn.

Định dạng dữ liệu (mỗi bài một dòng, sửa trực tiếp được):

```js
var EXDB_VI = window.EXDB_VI = window.EXDB_VI || {};
Object.assign(EXDB_VI, {
  "Barbell_Bench_Press_-_Medium_Grip":{n:"Đẩy ngực tạ đòn – tay vừa (Bench Press)",g:"Nằm ghế phẳng, …"},
  ...
});
```

## 2. Thẻ `<script>` cần thêm vào index.html

Thêm sau `pt.js` (và sau các module khác của đợt này cũng được). Thứ tự giữa 4 file không bắt buộc, nhưng nên để file dữ liệu trước:

```diff
 <script src="pt.js"></script>
+<script src="exdb-vi-1.js"></script>
+<script src="exdb-vi-2.js"></script>
+<script src="exdb-vi-3.js"></script>
+<script src="exdb-vi.js"></script>
```

Không cần CSS riêng: các style nhỏ được viết inline và dùng biến màu sẵn có.

## 3. Thay đổi ở file khác (chưa sửa, cần người tích hợp làm)

**scripts/prepare-www.sh** — chép thêm 4 file vào `www/` cho bản app Capacitor:

```diff
-cp index.html style.css manifest.json sw.js icons.js ... ptprofile.js pt.js privacy-policy.html delete-account.html www/
+cp index.html style.css manifest.json sw.js icons.js ... ptprofile.js pt.js exdb-vi-1.js exdb-vi-2.js exdb-vi-3.js exdb-vi.js privacy-policy.html delete-account.html www/
```

**sw.js** — thêm vào cache PWA và tăng phiên bản cache:

```diff
-const CACHE = "fitkit-v3";
-const ASSETS = [ ..., "./pt.js","./manifest.json"];
+const CACHE = "fitkit-v4";
+const ASSETS = [ ..., "./pt.js","./exdb-vi-1.js","./exdb-vi-2.js","./exdb-vi-3.js","./exdb-vi.js","./manifest.json"];
```

Không thay đổi `firestore.rules`. Không thêm khoá nào vào `state` (module chỉ đọc, không lưu gì).

## 4. Các hàm bị ghi đè (đều bọc try/catch, lỗi thì quay về bản gốc)

| Hàm (file gốc) | Cách ghi đè | Tác dụng |
|---|---|---|
| `exdbToItem` (exdb.js) | Bọc | Bài thêm vào giáo án hoặc buổi PT có `name = "Tên Việt (Tên gốc tiếng Anh)"` và `guide` = hướng dẫn Việt. Phần tiếng Anh trong ngoặc giúp video.js và freevideos.js vẫn tìm đúng video. |
| `openExDbDetail` (exdb.js, đã được video.js bọc) | Bọc thêm một lớp | Tiêu đề Việt, dòng tên gốc tiếng Anh, hướng dẫn Việt theo từng bước, ô "Xem bản gốc tiếng Anh" (mở/đóng). Video vẫn tìm theo tên Anh. |
| `openExDbPicker` (exdb.js) | **Viết lại toàn bộ** (bản gốc vẫn giữ để dùng khi lỗi) | Bảng chọn bài, dùng ở màn Thêm bài và ở PT soạn buổi tập (coach.js). Hiện tên Việt kèm tên Anh, tìm được tên Việt có dấu hoặc không dấu, tên Anh, cách gọi đời thường. Có xếp hạng kết quả và debounce 120 ms. |
| `libExdbItem` (library.js) | Bọc | `name` = tên Việt, `sub` = "Tên gốc tiếng Anh · nhóm cơ", `guide` = hướng dẫn Việt. Nếu thư viện đã được dựng trước khi module nạp thì dựng lại `_libAll.db`. |
| `openLibDetail` (library.js) | Bọc | Tạm đặt lại tên Anh trong lúc gọi bản gốc (để video tìm như cũ), sau đó đổi tiêu đề và hướng dẫn sang tiếng Việt. |
| `renderExLib` (library.js) | Bọc (async) | Khi có từ khoá, phần danh sách được thay bằng kết quả đã xếp hạng (khớp không dấu, theo đầu từ, ưu tiên bài chuẩn FIT KIT và bài phổ biến). Cập nhật dòng đếm và nút "Xem thêm". Placeholder ô tìm đổi thành gợi ý gõ không dấu. |
| `getExerciseMeta` (app.js) | Bọc | Với bài 800+ đã thêm từ trước, có `custom.exDbId` và hướng dẫn còn bằng tiếng Anh: thay hướng dẫn bằng bản Việt. **Tên giữ nguyên** vì `exKey()` lấy tên làm khoá lịch sử tạ. Hướng dẫn tiếng Việt do PT tự viết thì giữ nguyên. |

API nhỏ cho module khác: `window.exdbVi = { name(ex), guide(ex), storedName(ex), fold(str), rank(list, q, keyFn), keyOf(ex), stats() }`.

## 5. Tìm kiếm

- Bỏ dấu và đổi `đ` thành `d`, so khớp theo **đầu từ**: gõ "ta" không dính "tay", còn "curl" khớp cả "curls".
- Khoá tìm kiếm gồm: tên Việt, tên Anh, id, nhóm cơ (Việt và Anh), dụng cụ (Việt và Anh), category.
- Cách gọi đời thường (xem GLOSSARY mục 7): *hít đất* → chống đẩy; *hít xà / xà đơn* → kéo xà; *tạ tay* → dumbbell; *gánh* → squat; *đẩy đùi* → đạp đùi; *bắp tay* → tay trước; …
- Gõ có dấu thì kết quả khớp đúng dấu được ưu tiên, nhờ vậy "tạ đơn" và "tạ đòn" được phân biệt.
- Gõ liền vẫn khớp: "pushup" khớp "push up".

## 6. Cách thử

1. Kiểm tra cú pháp: `node -e "new Function(require('fs').readFileSync('<file>','utf8'))"` cho cả 4 file → OK.
2. Mô phỏng bằng Node với toàn bộ 876 bài (exdb.js + dữ liệu thật): 876/876 id có tên, không có id thừa, xếp hạng các truy vấn mẫu đúng (ví dụ "day nguc", "hít đất", "keo xa", "gánh", "tạ tay", "bench", "pushup").
3. Harness (đã ghép sẵn dữ liệu, không cần mạng):
   - `_test/exdb-vi-report.html` — chạy 27 bước kiểm thử và hiện bảng PASS/FAIL (tiêu đề tab hiện `PASS x/27 ERR n`).
   - `_test/exdb-vi-list.html` — chạy kiểm thử rồi dừng ở màn Thư viện với từ khoá "day nguc" (dải kết quả ở đáy).
4. Kiểm thử trên trình duyệt thật (Chromium qua Playwright): mở bản web đang chạy (index/app/exdb/library/video giống hệt bản local theo SHA-1), rồi nạp exdb-vi.js và một phần dữ liệu. Kết quả **29/29 PASS, 0 lỗi JS từ module**. Lỗi 503 của `vendor/exercises.json` là lỗi sẵn có trên bản web và app tự chuyển sang tải từ GitHub. Các bước đã kiểm:
   - `goto('exlib')`: lưới 14 nhóm cơ, placeholder mới.
   - Tìm "day nguc", "hít đất", "bench", "keo xa" (gõ thật vào ô, ô vẫn giữ focus); trường hợp không có kết quả; nút "Xem thêm".
   - Danh sách nhóm Ngực hiện tên Việt kèm dòng phụ tiếng Anh.
   - Sheet chi tiết: tiêu đề Việt, các bước Việt, bản gốc tiếng Anh, khối video vẫn hiện.
   - Thêm vào giáo án T2: tên dạng "Việt (English)", hướng dẫn Việt, `videoQueryFor` vẫn ra từ khoá tiếng Anh.
   - Bảng chọn bài: tìm "keo xa", chọn nhiều bài, `onPick`, xem chi tiết rồi quay lại vẫn giữ từ khoá.
   - `getExerciseMeta` với bài cũ: hướng dẫn Việt, tên giữ nguyên.

## 7. Giới hạn và việc còn lại

- **260 bài chưa có hướng dẫn Việt**, chủ yếu là bài cử tạ Olympic, strongman, plyometrics nâng cao và một số bài giãn cơ ít dùng. Các bài này hiện hướng dẫn tiếng Anh với tiêu đề "Hướng dẫn (tiếng Anh — đang được Việt hoá)". Để bổ sung, thêm khoá `g` vào dòng tương ứng trong `exdb-vi-N.js`.
- Bài 800+ **đã có trong giáo án từ trước** vẫn giữ tên tiếng Anh để không làm đứt lịch sử tạ (`state.setLog` và `setHist` lấy tên làm khoá). Chỉ phần hướng dẫn được hiện bằng tiếng Việt.
- Nếu free-exercise-db thêm bài mới, các bài đó sẽ hiện tên Anh kèm gợi ý `viHint` như cũ cho tới khi được dịch.
- Gõ không dấu "ta don" khớp cả tạ đơn lẫn tạ đòn. Gõ có dấu hoặc "tạ tay" thì phân biệt được.
- `openExDbPicker` được viết lại toàn bộ. Nếu sau này exdb.js thay đổi bảng chọn bài, cần cập nhật lại hàm `viOpenExDbPicker`.
- Bản dịch do biên tập viên FIT KIT soạn theo thuật ngữ thống nhất. Nên nhờ một PT có chứng chỉ duyệt nhanh khoảng 50 bài phổ biến nhất (danh sách `POPULAR` trong exdb-vi.js) trước khi phát hành.

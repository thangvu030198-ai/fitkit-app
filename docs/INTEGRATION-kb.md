# INTEGRATION — Kho kiến thức TapEasy (`kb.js`)

Module mới, **chỉ thêm file** — không sửa file lõi. Màn `#screen-kb` (kho bài viết cho người tập và PT), tìm kiếm không dấu, trang đọc, thuật ngữ A–Z, hỏi đáp, biên tập theo quyền.

## 1. File

| File | Nội dung |
|---|---|
| `kb-data-1.js` | Bắt đầu tập (10) · Kỹ thuật & an toàn (10) |
| `kb-data-2.js` | Tăng cơ & sức mạnh (8) · Giảm mỡ (8) |
| `kb-data-3.js` | Dinh dưỡng thể thao & món Việt (10) · Phục hồi – giấc ngủ – chấn thương (8) |
| `kb-data-4.js` | Phụ nữ tập luyện (6) · Cardio, chạy & Hyrox (6) · Tâm lý & thói quen (4) |
| `kb-data-5.js` | PT: Nghề & chứng chỉ (3) · Sàng lọc & đánh giá (3) · Lập trình giáo án (4) · Kinh doanh (5) · Giao tiếp & đạo đức (2) |
| `kb-data-6.js` | 147 thuật ngữ A–Z (`window.KB_GLOSSARY`) · 45 hỏi đáp (`window.KB_FAQ`) |
| `kb.js` | Logic + giao diện (≈ 85 KB) |
| `kb.css` | Giao diện, dùng token của DESIGN-SYSTEM |
| `tests/suites/40-kb.test.js` | 17 test Node (chạy cùng `node tests/run.js`) |
| `../_test/kb-kit/build.py`, `t_kb.js` | Bản 1 file + kịch bản kiểm thử trình duyệt |

**Tổng: 87 bài** (70 người tập + 17 PT) · ≈ 28.000 từ · 76 bảng · 256 trích dẫn nguồn · mỗi bài có hộp "Áp dụng ngay" và "Lưu ý an toàn" (bài kinh doanh PT dùng hộp "Lưu ý").

## 2. Thẻ cần thêm vào `index.html`

```diff
   <link rel="stylesheet" href="health-safety.css">
+  <link rel="stylesheet" href="kb.css">
   <link rel="stylesheet" href="brand.css">
   <link rel="stylesheet" href="themes-modules.css">
 …
   <script src="shop.js"></script>
+  <script src="kb-data-1.js"></script>
+  <script src="kb-data-2.js"></script>
+  <script src="kb-data-3.js"></script>
+  <script src="kb-data-4.js"></script>
+  <script src="kb-data-5.js"></script>
+  <script src="kb-data-6.js"></script>
+  <script src="kb.js"></script>          <!-- sau pt.js, teHomeExplore, coach/library/video; TRƯỚC health-safety.js -->
   <script src="health-safety.js"></script>
```

- `kb-data-*.js` phải nạp **trước** `kb.js` (đẩy vào `window.KB_ARTICLES`). Thứ tự giữa các file dữ liệu không quan trọng; trùng `id` thì bản nạp trước thắng.
- `kb.css` không có màu cứng ngoài gradient minh hoạ chuyên mục (đặt inline qua `--g1/--g2`, các khối này là `.fk-dark-island`). Nếu muốn lớp màu tự sinh: thêm `kb.css` vào danh sách của `scripts/gen_themes_layer.py --modules` rồi sinh lại `themes-modules.css`.
- `sw.js` (ASSETS) và `scripts/prepare-www.sh`: thêm 7 file JS + `kb.css`; tăng tên cache.
- `tests/suites/00-boot.test.js` (nếu kiểm thứ tự script): cập nhật danh sách.

Không cần sửa `app.js`, `pt.js`, `coach.js`, `library.js`, `video.js`, `firestore.rules` (rules `kb/{id}` đã có trong `INTEGRATION-admin.md`).

## 3. Cách tích hợp (tự chạy khi nạp)

| Điểm vào | Cách làm |
|---|---|
| Màn `#screen-kb` | Chèn vào `#app-scroll`, thêm `"kb"` vào `SUB_SCREENS` (ẩn thanh dưới). `goto("kb")` hoạt động. |
| Menu ☰ | Bọc `openSheet`: chèn dòng **Kho kiến thức** ngay trước dòng "Giấc ngủ" (nhận diện menu qua chuỗi `goto('reminders');closeSheet();`). Test Node báo lỗi nếu cấu trúc menu trong `app.js` đổi. |
| Trang chủ | `teHomeExplore.add({ id:"kb", title:"Kiến thức hôm nay", sub: tên bài hôm nay, badge: 1 khi chưa đọc, priority:78 })`. Không có `teHomeExplore` → bọc `renderHomeScreen`, chèn thẻ `#kb-home` (`data-home-zone="bottom"`) trước "Nhắc nhở tiếp theo". |
| Khu TapEasy PT | Bọc `renderCoachScreen`: thẻ `#kb-coach` "Kho kiến thức cho PT" cuối `#coach-content`, mở kho ở tab PT. |
| Chi tiết bài tập | Bọc `openExerciseDetail` (giáo án) và `openLibDetail("fk:<id>")` (thư viện): thêm khối **Tìm hiểu thêm** (≤ 3 bài) khi có bài liên kết tới bài tập đó. Bài tự tạo (không có `exerciseId`) không hiện. |
| Nút Back Android | Bọc `fkHandleBack`: lùi trong lịch sử kho, hết lịch sử thì về màn trước. |
| Liên kết sâu | `?kb=<id>` hoặc `#kb/<id>` mở thẳng bài (khi đã onboard). Nút Chia sẻ dùng `navigator.share`, không có thì sao chép liên kết. |
| Bảng quản trị | `window.TE_KB = TEKB` có `open()`, `adminList()`, `setPublished(id, on)` đúng hợp đồng trong `INTEGRATION-admin.md` §6.5. Ghi audit qua `TE_RBAC.audit("kb.publish" / "kb.save" / "kb.unpublish" / "kb.revert" / "kb.delete")`. |

## 4. Tính năng

- **Tab Người tập / PT / Tất cả** (mặc định PT nếu `cloud.profile.isPT`), lưu lựa chọn trong `state.kb.tab`.
- **Lưới 14 chuyên mục** với minh hoạ gradient + icon nét (14 icon `kb_*` thêm vào `FK_LINE`).
- **Tìm kiếm toàn văn không dấu**: chỉ mục đảo ngược (≈ 1.500 từ khoá) trên tiêu đề ×6, thẻ ×4, tóm tắt ×3, mục ×2, thân bài ×1, thuật ngữ, hỏi đáp; bỏ dấu giữ nguyên độ dài chuỗi nên tô sáng `<mark>` đúng chữ có dấu; tiền tố cho từ đang gõ ("creat" → creatine), vài từ đồng nghĩa (đạm ↔ protein, calo ↔ kcal, gánh → squat), thưởng cụm từ khớp tiêu đề, fallback khớp một phần. 300 lượt tìm ≈ 60 ms (Node).
- **Lọc thẻ** (chủ đề nổi bật, thẻ trong chuyên mục).
- **Trang đọc**: hero gradient, mục lục (≥ 2 mục), thanh tiến độ đọc dưới thanh trên, chữ 15,5 / 17 / 19 px (nút Cỡ chữ), dòng 1,72, tối đa 68 ký tự; bảng cuộn ngang; hộp Áp dụng ngay / Lưu ý an toàn / Mẹo / Lưu ý / Góc PT; chip bài tập (mở chi tiết bài tập) và giáo án mẫu (mở `openTemplateDetail`); nguồn có nút "Mở nguồn" (https) hoặc "Tra cứu" (Google Scholar); bài trước/tiếp; bài liên quan (cùng chuyên mục, thẻ chung, liên kết chéo).
- **Lưu bài, đã đọc** (tự đánh dấu khi đọc tới ~92 %), **đọc tiếp**, **Đã lưu**.
- **Gợi ý "Dành cho bạn"** theo `state.profile.goal`, giới tính, số buổi đã tập (< 6 → bài người mới) và vai trò PT; **Kiến thức hôm nay** cố định trong ngày, đổi theo ngày.
- **Thuật ngữ A–Z** (thanh chữ cái cuộn ngang, lọc không dấu) và **Hỏi đáp nhanh** (`<details>`, lọc theo tab).
- **Biên tập** (`teCan("kb.edit")`): nút Bài mới / Sửa, trình soạn markdown nhẹ có xem trước, kiểm tra hợp lệ (id bài tập/giáo án tồn tại, ≥ 1 nguồn, độ dài), Lưu nháp / Gửi duyệt. **Xuất bản / Gỡ / Bỏ bản sửa** cần `teCan("kb.publish")`. Bản nháp và bài chờ duyệt **không** hiện với người đọc.

### Markdown nhẹ (dữ liệu và trình soạn dùng chung)

`## mục` · `### mục con` · `- ` / `1. ` danh sách · `| bảng |` (dòng `|---|` bỏ qua) · `:::ap-dung` / `:::an-toan` / `:::meo` / `:::luu-y` / `:::pt [tiêu đề]` … `:::` · `**đậm**` · `*nghiêng*` · `[[ex:squat]]` · `[[kb:id-bai|chữ]]` · `[[tpl:tpl-m-fb]]`. Chuỗi được **escape toàn bộ trước** khi định dạng; id liên kết chỉ nhận `[a-z0-9_-]`; URL nguồn chỉ nhận `https://` không có dấu nháy.

## 5. Dữ liệu người dùng

`state.kb = { saved:[id], read:{id:ms}, recent:[id], custom:{id: bài}, fs:0|1|2, tab }` — lưu qua `saveState()`, tương thích dữ liệu cũ (tự tạo khi thiếu). `custom[id]` là bài sửa/mới: `{ …trường bài, status:"draft"|"review"|"published", hidden, updatedAt, by }`; bài gốc trùng id bị thay khi `status === "published"`, bị ẩn khi `hidden`.

**Firebase (tuỳ chọn):** khi `cloud.mode === "firebase"`, mỗi lần lưu/xuất bản ghi `kb/{id}`; khi đăng nhập tải về (`status == "published"`, hoặc tất cả nếu có quyền biên tập) và gộp theo `updatedAt`. Rules: dùng khối `match /kb/{id}` trong `INTEGRATION-admin.md` §4 — không cần thay đổi thêm.

## 6. API (`window.TEKB` = `window.TE_KB`)

`open({tab, view, cat, id, q})`, `openArticle(id)`, `openCat(id)`, `setTab(t)`, `back()`, `search(q, {tab})` → `{articles, glossary, faq, partial, tokens}`, `recommend(n, {pt, seed})`, `todayPick()`, `related(a, n)`, `forExercise(exId, n)`, `toggleSave(id)`, `setRead(id, on)`, `share(id)`, `shareUrl(id)`, `parseMd(md)`, `mdToHTML(md)`, `fold(s)`, `saveArticle(obj, "draft"|"review"|"publish")`, `setPublished(id, on)`, `revert(id)`, `openEditor(id)`, `adminList()`, `list({all})`, `byId(id)`, getter `articles`, `glossary`, `faq`, `index`, `state`, `ui`, `wrapped`.

## 7. Cách thử

```bash
node tests/run.js --only kb                       # 17 test: số bài/chuyên mục, trường bắt buộc, liên kết EXERCISES/PROGRAM_TEMPLATES,
                                                  # nguồn, tìm kiếm không dấu, escape XSS, giao diện, gợi ý, điểm vào, Back, phân quyền
python3 ../_test/kb-kit/build.py kb-flow.html t_kb.js   # → outputs/_test/kb-flow.html (1 file, không cần mạng)
```

Trình duyệt thật: Chromium qua Playwright, **ngữ cảnh riêng `tapeasy-kb`** (390 × 844, phục vụ file qua `route.fulfill`) → `kb-flow.html` **PASS 49/49, 0 lỗi JS**: menu → kho → tab → tìm "dau goi"/"hợp đồng" → chuyên mục + lọc thẻ → trang đọc (mục lục, cuộn hết → tiến độ 100 % + tự đánh dấu đã đọc, lưu, cỡ chữ) → chip bài tập → sheet có "Tìm hiểu thêm" → mở bài liên quan → thuật ngữ (lọc "rir") → hỏi đáp → Đã lưu → ô "Kiến thức hôm nay" trên Trang chủ → Back → khu PT → biên tập + xuất bản + khôi phục. `?stop=home|search|cat|article|read|exmore|glossary|faq|hometile|coach|editor` dừng để chụp. Ảnh: `_test/shots/kb-*.png`.

## 8. Giới hạn & việc còn lại

1. Bài sửa/mới chỉ đồng bộ khi chạy Firebase; chế độ demo lưu trên máy (đúng như các module khác).
2. "Tìm hiểu thêm" chỉ cho bài tập chuẩn (`EXERCISES`), chưa khớp bài free-exercise-db (`db:` key).
3. Thời gian đọc tính 200 từ/phút → đa số bài 2–3 phút.
4. Nội dung pháp lý/thuế (bài PT) cập nhật đến 11/2026; ngưỡng thuế hộ kinh doanh đang thay đổi trong 2026 nên bài chỉ hướng dẫn tra cứu, không nêu con số — nên rà lại mỗi 6 tháng.
5. Nên cho chuyên gia dinh dưỡng / bác sĩ thể thao đọc duyệt bộ bài trước khi quảng bá (đặc biệt nhóm mang thai, sau sinh, chấn thương).

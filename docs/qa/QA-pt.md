# QA — TapEasy PT ↔ Học viên & Tìm PT (11/11/2026)

Người kiểm thử: QA lead kiêm PT vận hành phòng tập. **Chỉ báo cáo, không sửa file app.**
Phạm vi: `cloud.js` (demo), `coach.js`, `ptprofile.js`, `pt-pro.js`, `cloud-social.js`, `pt-connect.js`, `cloud-pt-directory.js`, `findpt.js` (+ đối chiếu `firestore.rules`, `functions/index.js`).

## 1. Cách kiểm thử & kết quả tổng

| Lớp | Cách làm | Kết quả |
|---|---|---|
| Node — vòng đời 8 tuần | `node _test/qa-pt/qa_lifecycle.js` (chạy từ `outputs/`). Dùng `tests/lib/harness.js`: 1 "máy demo", đồng hồ giả 14/09 → 09/11/2026, 3 tài khoản **PT A · học viên B · học viên C** (+1 tài khoản phụ). Mời email / mã `?join=`, gói 12 buổi thu thiếu, giao giáo án 12 tuần (48 buổi), 56 ngày tập: PT log thay, PT bấm "Đã tập", học viên tự hoàn thành, 2 buổi vắng, chat mỗi tuần, đồng bộ nhật ký, gói hết → gia hạn 24 buổi + thu nợ, PT sửa log thay, niêm yết Tìm PT, đánh giá + PT trả lời + báo cáo, rời PT, xoá tài khoản HV rồi PT. Các thao tác gói/thu tiền đi qua đúng UI `PTP.openRenewSheet/openPaySheet`. | **46 kiểm tra: 29 PASS · 17 FAIL** (`_test/qa-pt/lifecycle-result.json`), 0 lỗi JS bất đồng bộ |
| Trình duyệt | Playwright, **ngữ cảnh riêng `qa-pt`** (`browser.newContext` 390×844 @2x, isMobile, hasTouch, vi-VN), bản ghép `scripts/build-single-html.py` → `_test/qa-pt/qa-pt.html`, phục vụ qua `route.fulfill`. Kịch bản: `pw_pt.js` (PT), `pw_st.js` (học viên), `pw_fp1-3.js` (Tìm PT). Log: `pw-log-*.json` (localStorage `__qa_log`). | 3 luồng chạy hết, **0 lỗi JS**, 34 ảnh `_test/qa-pt/shots/` |

**Đạt (đáng tin):** lời mời email chuẩn hoá + chống trùng; mã đã có học viên bị từ chối (BUG-08 giữ); xem trước PT bằng link `?join=`; học viên không log thay / không chat vào form người khác; tab Gói tập phía học viên chỉ xem; cảnh báo "gói còn 3 buổi" (02/10), "hết gói" (08/10), "vắng 2 buổi liên tiếp"; gia hạn cộng dồn 12 → 36 và trừ 2 buổi vượt gói; thu nợ về 0; **doanh thu T9 = 7,8 tr, T10 = 13,8 tr khớp từng đồng** (cả sheet "Gói & doanh thu"); PT và học viên thấy **cùng** 48 buổi / 30 đã tập / 2 vắng / 6 còn lại; phát hiện trùng giờ B 18:00 ↔ C 18:30 (dashboard, lịch, xem trước giao giáo án); giảm tải tuần 6 & 12 đúng −40% số hiệp; 10/10 buổi log thay vào nhật ký học viên đúng 1 lần; PT không ẩn/xoá được đánh giá, không tự đánh giá, không tự gắn "Đã xác minh"/điểm; báo cáo đánh giá 1 lần/người, không tự ẩn; nội dung đánh giá có `<b>` được escape; thanh trượt giá kéo bằng chuột đúng (0–250k, "Xem 8 PT").

## 2. Bảng bug

Mức độ: **Cao** (mất tiền / riêng tư / công bằng) · **TB** · **Thấp**. Mã kiểm tra (Q08, R06…) trỏ tới `lifecycle-result.json` / log Playwright.

| ID | Mức | Bug | Tái hiện | File:dòng | Đề xuất sửa |
|---|---|---|---|---|---|
| QP-01 | **Cao** | Học viên tự đổi buổi **"Đã tập" → "Huỷ/vắng"** (hoặc tạo buổi `done`) ⇒ gói được cộng lại buổi. Rules `sessions` cho *member* tạo/sửa mọi trường. | Q08: học viên B gọi `cloud.saveSession(cid,{id, status:"cancelled", absent:true})` cho 3 buổi đã tập → "buổi còn lại" 6 → **9**. | `firestore.rules:227`; `cloud.js:139` (demo không chặn) | Học viên chỉ được ghi `feedback*, seenByStudent, studentLog, proxyApplied, exercises[].done/result`; `status` chỉ `scheduled→done` cho buổi hôm nay; không được `create`; `cancelled/absent` chỉ PT. Demo mô phỏng y hệt. |
| QP-02 | **Cao** | Học viên **đã rời PT** (hoặc bị PT xoá form) **mất quyền viết/sửa đánh giá** dù đã tập 30 buổi → người không hài lòng (hay rời đi) không đánh giá được ⇒ điểm thiên lệch tích cực. | R06: B tập 30 buổi, đánh giá 4★, rời PT → sửa thành 2★ bị chặn `not-trained`. | `cloud-pt-directory.js:782-789` (`coachCtx` dùng `myCoaches()` = liên kết hiện tại), `:313-322`; rules `trained()` (§ptListings) | Lưu quyền "đã tập cùng" bền vững (Cloud Function ghi `reviewRights/{pt}_{uid}` khi có buổi done, hạn 12 tháng); luôn cho sửa đánh giá đã có. |
| QP-03 | **Cao** | Học viên **xoá tài khoản**: ảnh tiến trình (ảnh cơ thể), PAR-Q, bệnh lý, số đo, `trainingSync`, tin nhắn/ảnh chat **vẫn nằm trong form PT** (NĐ 13/2023, App Store 5.1.1(v)). | U02: C có 1 ảnh + sức khoẻ → xoá tài khoản → PT vẫn đọc `photos:1, health, measurements, 1 tin`. | `cloud.js:149` (demo), `:322-324` (Firebase); `functions/index.js:104-110` | Khi gỡ học viên: xoá `health, measurements, photos, trainingSync, chat` + `messages` do HV gửi + `invites` theo email; báo trước trong sheet xoá tài khoản. |
| QP-04 | TB | Học viên bấm **"Hoàn thành buổi tập" / "Bắt đầu tập & ghi kg×lần" cho buổi NGÀY MAI / tuần sau** → buổi thành `done`, trừ gói trước giờ tập, không cần PT xác nhận (doanh thu "buổi đã dạy" cũng tính sai tháng). | Q05 + ảnh `19-st-form-today.png`: 11/11 mở form, buổi 12/11 có cả 2 nút. Tab "Chương trình" cũng có "Tập buổi này" cho buổi tới. | `coach.js:498, 518-523`; `pt-connect.js:1001-1004, 878, 726` | Chỉ cho khi `s.date == hôm nay` (±1 ngày); buổi "tại phòng tập cùng PT" do HV hoàn thành → `pendingConfirm`, PT xác nhận mới trừ gói. |
| QP-05 | TB (an toàn) | Học viên tự ghi **"BS đã cho phép"** cho PAR-Q có câu "Có" → cảnh báo đỏ "cần ý kiến bác sĩ" của PT biến mất. UI chỉ ẩn nút, rules cho ghi cả `health`. | Q07: HV ghi `health.parq.clearance={ok:true}` → `parqStatus = "cleared"`. | `firestore.rules:207-209`; `pt-pro.js:1104` | Tách `clearance` thành trường PT-only (rules so sánh không đổi khi HV ghi) và lưu `by/at`. |
| QP-06 | TB | **PT sửa buổi "log thay" → học viên không bao giờ nhận bản sửa**; PT thấy mãi "Sẽ vào nhật ký khi học viên mở app". | X02: PT sửa kg +20 → nhật ký HV vẫn 40 kg (đúng: 60), server `proxyApplied:null` mãi. | `cloud-social.js:744`; `pt-connect.js:744, 1022` | Thêm `proxyLog.rev/at`; HV so `applied[sid] < proxyLog.at` → thay (không cộng dồn) kết quả ngày đó rồi áp lại. |
| QP-07 | TB | Nút **"Tập cùng — log thay"** ở tab "Buổi này tập gì" gắn vào **buổi kế tiếp kể cả ngày mai** → ghi hôm nay nhưng buổi ngày mai thành "Đã tập", `session.date ≠ proxyLog.date`. | Ảnh `08-pt-form-today.png` ("· Upper — khối lượng", buổi Ngày mai). Tab "Nhật ký tập" lại chỉ lấy buổi hôm nay (không nhất quán). | `pt-connect.js:996-999` (so với `pickProxySession` `:985-989`) | Dùng buổi hôm nay hoặc cho chọn buổi; nếu khác ngày thì hỏi & cập nhật `date`. |
| QP-08 | TB (minh bạch) | Ô **"Học viên · Buổi đã dạy — ghi trên TapEasy"** trên niêm yết là số **tự khai**: đếm cả form trống chưa kết nối, PT ghi tuỳ ý `users.stats` (rules không khoá), chỉ cập nhật khi lưu niêm yết. | F02: 2 học viên thật + 5 form "Khách ảo" → niêm yết hiện **7**. | `ptprofile.js:198-205`; `cloud-pt-directory.js:838`; `findpt.js:652-653`; `firestore.rules:171-172` | Chỉ đếm form có `studentUid` + ≥ 1 buổi PT xác nhận; Cloud Function ghi vào `ptListings` (thêm `stats` vào `lockedKeys`). |
| QP-09 | TB (bộ lọc) | Lọc **"Phòng tập" + "≤ 300k"** so với *mọi* mức giá (cả online, gói 24 chia đều) → PT 500k/buổi tại phòng tập lọt vào vì online 300k; thẻ ghi "từ 300k/buổi". | F05 + Playwright (`24/25-fp-filter*.png`): "Lý Thanh Tâm" buổi lẻ 500k, online 300k nằm trong "Xem 6 PT". | `cloud-pt-directory.js:212-216, 155-163` | Địa điểm gym/home/outdoor chỉ xét giá trực tiếp; online chỉ xét giá online; thẻ ghi rõ "online từ…/tại phòng từ…"; tuỳ chọn "không tính giá gói". |
| QP-10 | TB (riêng tư) | SĐT trong `users/{uid}.phone` (sheet "Hồ sơ PT" cũ) **đọc được bởi mọi tài khoản** và hiện "Gọi" trên hồ sơ, trong khi niêm yết mặc định **ẩn SĐT**. | F04: HV C đọc `getUser(PT).phone = 0901234567`; ảnh `14-pt-public-profile.png`. | `firestore.rules:166`; `ptprofile.js:118, 135, 138`; `coach.js:222` | Chuyển SĐT sang niêm yết (chỉ khi `showPhone`) hoặc subdoc riêng; hồ sơ thật tôn trọng cùng công tắc. |
| QP-11 | TB (riêng tư) | Học viên **rời PT**: `trainingSync`, sức khoẻ, ảnh vẫn ở form PT (PT tiếp tục xem nhật ký tự tập). | U01: sau `leaveCoach` form vẫn có `trainingSync`, `health`. | `cloud.js:402`; nhánh "rời PT" của rules chỉ cho 4 trường | `leaveCoach` ghi `trainingSync:{off:true}` (mở rules cho trường này) + hỏi giữ/xoá ảnh & sức khoẻ. |
| QP-12 | TB (công bằng) | **Đánh giá "đã tập cùng" dễ giả**: tài khoản phụ nhận mã, tự tạo 1 buổi `done` (rules cho member tạo session) → đăng 5★. Không giới hạn số tài khoản. | R05: "Bạn Của An" đăng 5★ cho PT A. | `cloud-pt-directory.js:313-322, 786-787`; `firestore.rules:227` | Chỉ tính buổi PT xác nhận (sau QP-01), yêu cầu ≥ 2 buổi hoặc ≥ 7 ngày; đánh dấu "tài khoản mới"; Cloud Function `doneCount`. |
| QP-13 | TB (nghiệp vụ) | **"Vắng" luôn "không trừ vào gói"** trong khi niêm yết công bố chính sách huỷ "Tiêu chuẩn/Chặt: huỷ muộn tính 1 buổi" → PT không áp được chính sách đã công khai. | B01: PT niêm yết "Chặt", 2 buổi vắng không trừ; hồ sơ Khang ghi "Huỷ muộn hơn tính 1 buổi". | `pt-pro.js:576`; `coach.js:593-600`; `pt-pro.js:119-120` (`remaining`) | 3 trạng thái: huỷ báo trước (không trừ) · vắng/huỷ muộn (trừ theo chính sách) · PT huỷ (bù buổi); `remaining = total − done − chargedAbsent`. |
| QP-14 | Thấp (xếp hạng) | "Phù hợp": PT **0 đánh giá** (Bayes nền 4,3 → 32 điểm) xếp **trên** PT 20 đánh giá 4,2★ (30) — trái lời giải thích trong sheet "Cách xếp hạng". | F06; ảnh `26-fp-how-ranking.png`. | `cloud-pt-directory.js:166-167, 229-240` | Mức nền = trung bình sàn (~4,0) hoặc cận dưới Wilson; PT mới hiển thị ở dải "Mới tham gia" riêng. |
| QP-15 | Thấp (demo) | Trả lời tự động hồ sơ minh hoạ **ghi đè "done" → "accepted"** nếu buổi thử được xác nhận trước 1,6 s → mất quyền đánh giá; hội thoại hiện sai thứ tự. | `pw_fp3`: xác nhận ngay sau khi gửi → 2,5 s sau trạng thái `accepted`, nút "Viết đánh giá" báo "Chưa thể đánh giá". | `cloud-pt-directory.js:1052-1060` | Chỉ đổi `status` khi `cur.status === "pending"`. |
| QP-16 | Thấp (UX) | Nhãn tuần giáo án **"· T4"** trên hàng buổi của học viên đọc thành "Thứ Tư" (ngay cạnh "T6, 13/11"). | Ảnh `15-st-hub.png`. | `pt-connect.js:828` | Ghi "Tuần 4/12". |
| QP-17 | TB | **PT xoá tài khoản**: (demo) niêm yết Tìm PT vẫn công khai, đánh giá treo; (demo + Firebase) `invites` chứa email học viên không bị dọn; tin nhắn demo còn. | U03/U04: sau xoá, `ptdir.list()` vẫn có PT A, còn 1 invite, 3 hộp tin. | `cloud.js:143-153`; `functions/index.js:45, 88-121` | Demo gọi `ptdir.deleteMyListing` + xoá invites/messages; Function thêm `invites where ptId==uid` và `email==email` của HV. |
| QP-18 | Thấp | Động cơ **demo không mô phỏng quyền**: học viên ghi được `packageTotal/payments`, ghi/xoá buổi trong form người khác (rules Firebase chặn). Bản dùng thử & test không phản ánh đúng. | Q03, Q04. | `cloud.js:131-140` | Thêm lớp kiểm tra giống rules trong `demo.updateClient/saveSession/deleteSession`. |
| QP-19 | Thấp (UI) | Thanh trên hồ sơ PT (nút back nền trắng, logo, nút chia sẻ) **dính và đè lên chữ** khi cuộn phần mở rộng (logo đè "TapEasy đã đối chiếu"). | Ảnh `30-fp-profile-transparency.png`. | `style.css:641-642` (`.pp-nav` sticky), `findpt.js:522` | Nền kính khi `scrollTop>0` hoặc ẩn logo sau phần hero; nút back đồng bộ kiểu kính. |
| QP-20 | Thấp (a11y) | Chữ **10–11 px** ("Học viên", "Buổi hôm nay", "Đã kết nối", chuyên môn) và vùng chạm **33–36 px** (seg "Học viên của tôi/PT của tôi", "Xem hồ sơ công khai") — trái quy tắc ≥ 12 px / ≥ 44 px. | Đo trong `pw_pt` (log "a11y PT"). | `coach.js:116-117, 156-161` (+ `.stat-box .cap`, `.seg` trong `style.css`) | Nâng `.cap` lên 12 px, `.seg button` min-height 44 px. |
| QP-21 | Thấp | Hồ sơ **minh hoạ** hiện "TapEasy đã đối chiếu" cho chứng chỉ của người không có thật. | Ảnh `30-fp-profile-transparency.png`. | `findpt.js:644`; seed `verified` trong `cloud-pt-directory.js` | Hồ sơ seed luôn "minh hoạ — không đối chiếu". |
| QP-22 | Thấp (riêng tư) | `syncNow` đẩy **cùng một** bản tóm tắt (buổi với PT khác, cân nặng, 1RM) cho **mọi** PT đang kết nối; công tắc chia sẻ là chung. | Đọc mã. | `pt-connect.js:764-777, 884-892` | Chia sẻ theo từng PT; lọc buổi `pt/ptsess` của PT khác. |
| QP-23 | TB (mượt) | Hồ sơ PT ở CPU 4× (máy tầm trung): cuộn dọc **19 fps** (p95 97 ms, 18 long task ≤ 125 ms); album ngang 26 fps. | `pw_fp2` (bảng §3). | `ptprofile.js:159` (scroll → `ppReveal`), `findpt.js:330-342` (parallax), blur kính | IntersectionObserver thay scroll handler; `content-visibility:auto` cho section mở rộng; giảm `backdrop-filter`; thumb album 360 px. |

## 3. Độ mượt (Chromium, 390×844 @2x, rAF + Long Tasks)

| Màn | CPU 1× | CPU 4× (mô phỏng máy tầm trung) |
|---|---|---|
| Dashboard PT (cuộn dọc) | 49 fps · p95 42 ms · 0 long task | — |
| Album Tìm PT (cuộn dọc, 20 thẻ ảnh Pexels) | **97 fps** · p95 21 ms | 44 fps · p95 49 ms · 6 long task (≤ 74 ms) |
| Hồ sơ PT — album ngang | 56 fps · p95 28 ms | 26 fps · p95 63 ms · 10 khung > 50 ms |
| Hồ sơ PT — cuộn dọc | — | **19 fps** · p95 97 ms · 18 long task (≤ 125 ms) |

Không tràn ngang (scrollWidth = 390) ở album và hồ sơ; 20/20 ảnh album tải được.

## 4. Vấn đề UX / nghiệp vụ PT còn thiếu

1. **Xác nhận buổi hai phía** (check-in QR/OTP tại phòng tập) + nhật ký thay đổi trạng thái buổi — nền tảng để giải quyết tranh chấp số buổi (liên quan QP-01/04/13).
2. **Học viên xin dời/huỷ buổi → PT duyệt**, đề xuất giờ bù; hiện chỉ có tin nhắn/nhắc nhở.
3. **Hạn gói**: không có quy tắc khi hết hạn còn buổi (bảo lưu, đóng băng có ngày, tự hết hạn); "Tạm nghỉ" không dời hạn dùng.
4. **Doanh thu**: chỉ tiền mặt đã thu; thiếu doanh thu đã thực hiện (buổi đã dạy × đơn giá), hoàn tiền, biên nhận gửi học viên, xuất Excel/hoá đơn, chia % phòng tập.
5. Phía học viên **không có nút "Gia hạn / thanh toán"** hay yêu cầu gia hạn khi còn 2 buổi (hero chỉ hiện "2 buổi còn lại").
6. Giáo án 12 tuần: vắng không tự dời/lùi lịch; ngày cardio "học viên tự tập" bị bỏ hẳn khỏi lịch HV; log thay không gợi ý tạ buổi sau.
7. Form học viên **11 tab** cuộn ngang ("Thông tin" bị khuất) → gom: Tổng quan · Lịch · Sức khoẻ · Gói · Chat; màn PT có **2 hàng chỉ số trùng** (coach.js + pt-pro).
8. Chưa có thông báo đẩy khi học viên ghi kết quả / nhắn tin / có đánh giá mới.
9. Tìm PT: thiếu bản đồ/khoảng cách, so sánh 2–3 PT, lịch trống lấy từ lịch thật của PT (đang tự khai), trạng thái "đã đủ học viên", đặt cọc buổi thử.
10. Đánh giá: không lưu lịch sử sửa — học viên sửa sau khi PT trả lời làm câu trả lời lệch ngữ cảnh; nên hiện "đã sửa sau phản hồi của PT".
11. Học viên < 18 tuổi: form PT chưa có cờ "cần phụ huynh đồng ý".

## 5. Minh bạch & công bằng — đánh giá nhanh

- **Giá**: bảng giá công khai, % tiết kiệm, ngày cập nhật giá, "TapEasy không cộng phí" — tốt. Lệch: "Giá từ" và bộ lọc trộn giá online/gói (QP-09).
- **Đánh giá không xoá được**: đạt với PT (API + rules); người viết tự xoá được (hợp lý). Lỗ hổng: điều kiện "đã tập cùng" giả được (QP-12) và người đã rời PT mất quyền (QP-02).
- **Xếp hạng "Phù hợp" công khai**: có sheet giải thích, không suất trả tiền — đạt; nhưng mức nền 4,3 làm PT 0 đánh giá vượt PT nhiều đánh giá (QP-14). Số liệu "học viên / buổi đã dạy" tự khai (QP-08).

## 6. Điểm (/10)

| Tiêu chí | Điểm | Lý do |
|---|---|---|
| Logic | **6,0** | Gói, công nợ, doanh thu, trùng giờ, giảm tải, đồng bộ hai phía đúng; nhưng lỗ hổng tiền (QP-01, 04, 13), log thay (QP-06/07), quyền đánh giá (QP-02/12). |
| Ổn định | **8,0** | 0 lỗi JS trong 46 kiểm tra Node + 3 luồng trình duyệt; demo lệch rules (QP-18), dữ liệu mồ côi sau xoá tài khoản (QP-03/17). |
| Mượt | **7,0** | Album 97 fps (1×) / 44 fps (4×); hồ sơ PT 19 fps ở 4× (QP-23). |
| Dễ dùng | **7,0** | Dashboard "Việc cần làm", lịch, giao giáo án rất hữu ích; trừ điểm 11 tab, chữ/chạm nhỏ, nhãn "T4", thanh hồ sơ đè chữ. |

## 7. File kiểm thử (chỉ trong `_test/qa-pt/`)
`qa_lifecycle.js` + `lifecycle-result.json` · `qa-pt.html` (bản ghép) · `pw_pt.js`, `pw_st.js`, `pw_fp1.js`, `pw_fp2.js`, `pw_fp3.js` + `pw-log-*.json` · `shots/00…34-*.png` (PT: 02–14, học viên: 15–20, Tìm PT: 21–34).
Ghi chú vận hành: trình duyệt Playwright dùng chung với các agent khác (có lúc bị khởi động lại) → kịch bản tách phần, mỗi phần tự tạo ngữ cảnh `qa-pt`, ghi log qua `context.storageState`.

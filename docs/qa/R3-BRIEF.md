# Vòng R3 (14/11/2026) — Rà soát sâu + nâng cấp trước khi đóng gói 3 nền tảng

Mã nguồn: `/sessions/quirky-magical-gauss/mnt/outputs/FitKit/` (vanilla JS SPA, tiếng Việt, Capacitor 6, web tại https://thangvu030198-ai.github.io/fitkit-app/).
Đọc trước: `docs/AGENT-BRIEF.md`, `docs/INTEGRATION-LOG.md`, `docs/DESIGN-SYSTEM.md`, `docs/qa/FIX-ROUND-BRIEF.md` (quy tắc sửa lỗi vẫn áp dụng), và các `docs/qa/FIX-*.md` để biết lỗi nào ĐÃ sửa ở vòng trước (đừng báo lại).

## Việc của MỖI agent (trong phạm vi file mình sở hữu)
1. **Đọc hết** các file mình sở hữu trước khi nhận xét.
2. Rà soát theo 7 nhóm: (a) logic nghiệp vụ, (b) edge case & kiểm tra đầu vào, (c) quản lý state / localStorage / đồng bộ cloud, (d) PWA (service worker, offline, thông báo, cài đặt), (e) hiệu năng & rò rỉ bộ nhớ (listener/timer/observer không gỡ, render lặp), (f) bảo mật (XSS, sanitization, rules), (g) xử lý lỗi & UX khi lỗi.
3. Ghi `docs/qa/R3-<agent>.md`: bảng lỗi theo mức **Critical / High / Medium / Low** — mã (`R3-<AGENT>-nn`), file:dòng, mô tả, cách tái hiện, đề xuất fix cụ thể, trạng thái (Đã sửa / Chuyển giao / Không sửa + lý do).
4. **Sửa** mọi lỗi Critical/High/Medium trong file mình sở hữu (Low: sửa nếu rẻ). Lỗi ở file người khác → mục "Chuyển giao".
5. **Viết test** hồi quy: `tests/suites/8x-r3-<agent>.test.js` (mỗi lỗi đã sửa ≥ 1 test mang mã). Xem mẫu `tests/suites/6*-fix-*.test.js`, `tests/lib/harness.js`.
6. Làm phần **nâng cấp riêng** ghi trong prompt của bạn.
7. Chạy `node tests/run.js` — phải XANH (đỏ ở vùng người khác: chờ 1–2 phút chạy lại).
8. Báo cáo cuối ≤ 300 từ tiếng Việt: số lỗi theo mức, đã sửa gì, nâng cấp gì, **thẻ `<script>/<link>` mới cần thêm vào index.html và file mới cần thêm vào `sw.js` ASSETS** (integrator sẽ thêm), việc còn lại cần chủ dự án làm.

## Quy tắc cứng
- **KHÔNG sửa file không thuộc mình.** Chỉ agent `ux` được sửa `index.html`, `sw.js`, `style.css`, `manifest.json`. Cần thẻ script/link mới → ghi trong báo cáo.
- Dùng công cụ Edit (thay chuỗi chính xác); không ghi đè cả file lớn. Kiểm cú pháp sau khi sửa: `node -e "new Function(require('fs').readFileSync('<f>','utf8'))"`.
- Không đổi key localStorage `fitkit_state_v1`; tương thích dữ liệu cũ.
- Mọi dữ liệu người dùng/cloud chèn HTML qua `escapeHtml`/`esc`; URL qua `safeUrl`.
- KHÔNG đặt khoá API/mật khẩu trong mã. KHÔNG dùng ảnh/tên người thật, logo hãng, nhạc/ảnh có bản quyền.
- Sandbox KHÔNG có mạng ra ngoài: không `npm install`, không tải gì; chỉ Node thuần + Playwright có sẵn (nếu có). Kiểm thử trình duyệt: `python3 scripts/build-single-html.py` ra thư mục riêng `_test/r3-<agent>/`.
- Chuỗi giao diện mới: viết tiếng Việt có dấu trong mã như cũ; agent `ux` cung cấp lớp dịch `i18n.js` (từ điển Việt→Anh, dịch DOM tự động) — nếu bạn thêm chuỗi giao diện quan trọng, liệt kê vào `docs/qa/R3-<agent>.md` mục "Chuỗi cần dịch" dạng `"Tiếng Việt" → "English"` để integrator nạp vào từ điển.
- Thiết kế: vùng chạm ≥ 44 px, chữ ≥ 12 px, input 16 px, tôn trọng safe-area (`env(safe-area-inset-*)`), bố cục co giãn 320–430 px rộng (iPhone SE → Pro Max, Android nhỏ → lớn), không tràn ngang.

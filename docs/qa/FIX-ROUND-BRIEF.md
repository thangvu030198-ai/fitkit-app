# Vòng sửa lỗi sau QA (11/11/2026) — brief chung cho 7 fixer

Mã nguồn: `/sessions/quirky-magical-gauss/mnt/outputs/FitKit/`. Đọc trước: `docs/AGENT-BRIEF.md`, `docs/INTEGRATION-LOG.md`, `docs/DESIGN-SYSTEM.md`, và 6 báo cáo trong `docs/qa/QA-*.md`.

## Quyền sở hữu file (KHÔNG sửa file không thuộc mình — 7 agent chạy song song)
| Fixer | File được sửa |
|---|---|
| **core** | `app.js`, `pt.js` |
| **training** | `achievements.js/.css`, `training-pro.js/.css`, `program-builder.js/.css`, `templates.js`, `library.js`, `exdb*.js`, `video.js`, `freevideos.js` |
| **nutrition** | `data.js`, `meals.js`, `meals-extra.js`, `nutrition.js`, `nutrition-pro.js/.css`, `health-safety.js/.css`, `scripts/food_sources.json`, `scripts/fetch_food_images.py`, ảnh trong `media/food/` (chỉ đổi ánh xạ) |
| **pt** | `coach.js`, `ptprofile.js`, `pt-pro.js/.css`, `pt-connect.js/.css`, `cloud-social.js`, `findpt.js/.css`, `cloud-pt-directory.js` |
| **commerce** | `community.js/.css`, `events.js/.css`, `events-media.js`, `cloud-events.js`, `shop.js/.css`, `shop-data.js`, `kb.js/.css`, `kb-data-*.js` |
| **security** | `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `functions/**`, `cloud.js`, `rbac.js`, `cloud-admin.js`, `admin.js/.css`, `privacy-policy.html`, `delete-account.html`, `docs/STORE-*.md`, `docs/RBAC.md`, `capacitor.config.json`, `.github/workflows/build-*.yml`, `firebase-config.js` |
| **ux** | `index.html`, `style.css`, `sw.js`, `ui-kit.js/.css`, `icons.js`, `brand.css`, `themes.js`, `themes.css`, `themes-modules.css`, `theme-packs.*`, `ui-signature.*`, `scripts/prepare-www.sh`, `scripts/build-single-html.py`, `manifest.json`, `landing.html` |

Bug nằm ở file không thuộc mình → KHÔNG sửa, ghi vào mục **"Chuyển giao"** trong file FIX của bạn (file:dòng, đề xuất cụ thể) để integrator xử lý sau.

## Quy tắc
1. Sửa theo thứ tự mức độ: Nghiêm trọng → Cao → TB → Thấp. Sửa gốc rễ, không vá bề mặt; giữ tương thích dữ liệu cũ (`|| {}`), không đổi key localStorage `fitkit_state_v1`.
2. Mọi dữ liệu người dùng/cloud chèn vào HTML phải qua `escapeHtml`/`esc` (kể cả số, id, thuộc tính); URL qua `safeUrl`. Không thêm `onclick` chèn chuỗi người dùng.
3. Thêm test hồi quy vào **file suite riêng**: `tests/suites/6x-fix-<fixer>.test.js` (core=60, training=61, nutrition=62, pt=63, commerce=64, security=65, ux=66). Mỗi bug đã sửa có ≥ 1 test mang mã (vd `QT-01`). Không sửa suite của người khác; nếu một test cũ khẳng định đúng hành vi lỗi trong file bạn sở hữu, được cập nhật và ghi chú.
4. Cuối việc chạy `node tests/run.js` — phải XANH. Do người khác đang sửa song song, nếu đỏ ở vùng không phải của bạn thì chờ 1–2 phút chạy lại; chỉ báo lại nếu vẫn đỏ.
5. Kiểm tra cú pháp mỗi file JS sau khi sửa: `node -e "new Function(require('fs').readFileSync('<f>','utf8'))"`. Dùng công cụ Edit (thay chuỗi chính xác), không ghi đè cả file đang có người khác đọc.
6. Kiểm thử trình duyệt nếu cần: tự dựng bản ghép bằng `python3 scripts/build-single-html.py` ra thư mục riêng `_test/fix-<fixer>/` và chạy Playwright trong **context riêng `fix-<fixer>`** — KHÔNG đóng/điều hướng tab của người khác.
7. Ghi `docs/qa/FIX-<fixer>.md`: bảng mã bug → trạng thái (Đã sửa / Một phần / Không sửa + lý do) → file:dòng → test; mục Chuyển giao; việc còn lại. Cập nhật thêm cột "Trạng thái" không cần thiết trong QA-*.md (để nguyên báo cáo gốc).
8. Báo cáo cuối ≤ 250 từ tiếng Việt.

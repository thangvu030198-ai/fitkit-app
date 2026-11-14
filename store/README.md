# store/ — bộ metadata sẵn sàng dán lên Google Play Console & App Store Connect

> Tạo ở vòng R3 (14/11/2026) bởi agent `store`. Quy trình và danh sách kiểm: `docs/RELEASE-CHECKLIST.md`.
> Nguồn gốc nội dung marketing (lý do chọn từ khoá, kịch bản ảnh, video): `docs/STORE-LISTING.md`.
> Chính sách thay đổi thường xuyên — mọi con số (giới hạn ký tự, kích thước ảnh, mức API) cần kiểm lại lúc nộp.

| Đường dẫn | Dán vào đâu |
|---|---|
| `metadata.json` | Bảng tổng hợp (tên, phụ đề, từ khoá, URL, danh mục) — test `85-r3-store` kiểm giới hạn ký tự |
| `google-play/vi-VN/` · `google-play/en-US/` | Play Console → Grow → Store presence → **Main store listing** (ngôn ngữ mặc định: Tiếng Việt – vi; thêm bản dịch English – en-US). `title.txt` ≤ 30 · `short-description.txt` ≤ 80 · `full-description.txt` ≤ 4000 · `release-notes.txt` ≤ 500 (ô *Release notes* khi tạo release) |
| `google-play/data-safety.md` | Play Console → Policy → App content → **Data safety** (trả lời sẵn từng câu) |
| `google-play/declarations.md` | App content: Privacy policy, Ads, App access, Content rating, Target audience, **Health apps**, Advertising ID, Government/Financial, UGC |
| `app-store/vi/` · `app-store/en-US/` | App Store Connect → app → *iOS App* → phiên bản 2.0.0. Ngôn ngữ chính: **Vietnamese**; thêm **English (U.S.)**. `name.txt` ≤ 30 · `subtitle.txt` ≤ 30 · `keywords.txt` ≤ 100 · `promotional-text.txt` ≤ 170 · `description.txt` ≤ 4000 · `release-notes.txt` (What's New) |
| `app-store/app-privacy.md` | App Store Connect → App Privacy (“nutrition labels”) — trả lời sẵn |
| `app-store/review-notes-en.md` | App Review Information → **Notes** + tài khoản demo (tiếng Anh) |
| `screenshots/README.md` | Kích thước ảnh từng store + cách chạy `scripts/store-screenshots.py` |
| `native/android/MainActivity.java` | KHÔNG dán — `scripts/native-android-patch.py` chép vào project Android (edge-to-edge Android 15+) |
| `native/ios/PrivacyInfo.xcprivacy` | KHÔNG dán — `scripts/native-ios-patch.py` chép vào project iOS (privacy manifest) |

**Khác với bản web:** mô tả trên store chỉ nhắc đăng nhập *email, Google, Apple* (Facebook chưa cấu hình SDK gốc trên app native — nhắc tới mà không có là sai metadata, Guideline 2.3). Khi bật Facebook native thì sửa lại 4 file mô tả + ghi chú phát hành.

**Trước khi dán:** thay mọi chỗ `[ĐIỀN …]` (email hỗ trợ, tài khoản demo). Không dán chữ “demo”, “beta”, “sắp ra mắt”, giá tiền, tên store khác (App Store cấm nhắc “Android/Google Play” trong mô tả — đã kiểm).

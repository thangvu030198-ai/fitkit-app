# Ảnh chụp màn hình store — kích thước & cách chụp tự động

Kịch bản 8 ảnh + tiêu đề marketing + phong cách khung: `docs/STORE-LISTING.md` §6. File này lo phần **kỹ thuật**: đúng kích thước, chụp tự động.
(Kích thước theo quy định tại 11/2026 — kiểm lại trang “Screenshot specifications” của Apple và “Add preview assets” của Google lúc nộp.)

## App Store (iPhone — app chỉ phát hành cho iPhone nên KHÔNG cần ảnh iPad)

| Bộ | Kích thước dọc (px) | Bắt buộc? | Preset của script |
|---|---|---|---|
| 6.9" (iPhone 16/17 Pro Max) | 1320 × 2868 (cũng nhận 1290 × 2796, 1260 × 2736) | **Cần 1 bộ 6.9" hoặc 6.7"** | `ios-6.9` |
| 6.7" (iPhone 15 Pro Max/Plus) | 1290 × 2796 | như trên | `ios-6.7` |
| 6.5" (iPhone 11 Pro Max, XS Max) | 1242 × 2688 (hoặc 1284 × 2778) | Tuỳ chọn — bỏ trống thì Apple thu nhỏ từ bộ lớn | `ios-6.5` |
| 5.5" (iPhone 8 Plus) | 1242 × 2208 | Tuỳ chọn — chỉ cần nếu muốn ảnh riêng cho máy có nút Home | `ios-5.5` |

- 1–10 ảnh mỗi bộ, PNG hoặc JPEG, **không có kênh alpha**, RGB. 3 ảnh đầu hiện trong kết quả tìm kiếm.
- Ảnh phải là giao diện thật của app (Guideline 2.3.3): không dùng ảnh minh hoạ không có trong app, không có thanh trạng thái Android, không nhắc store khác, không ghi giá.
- Mỗi ngôn ngữ (Vietnamese, English U.S.) một bộ riêng; chưa có ảnh tiếng Anh thì English dùng lại ảnh tiếng Việt (được phép).

## Google Play

| Loại | Kích thước | Ghi chú |
|---|---|---|
| Ảnh điện thoại | **1080 × 1920** (9:16) — preset `android-phone` | 2–8 ảnh (nên ≥ 4 ảnh ≥ 1080 px để được đề xuất). Mỗi cạnh 320–3840 px, cạnh dài ≤ 2 × cạnh ngắn ⇒ 1080 × 2400 **không hợp lệ**. PNG/JPEG 24-bit, không alpha, ≤ 8 MB |
| Icon | 512 × 512 PNG 32-bit, ≤ 1 MB | có sẵn: `assets/icon-512.png` |
| Feature graphic | 1024 × 500 PNG/JPEG, không alpha | **bắt buộc** — làm tay theo `docs/STORE-LISTING.md` §6 |
| Tablet 7"/10" | tuỳ chọn | bỏ qua (app tối ưu cho điện thoại) |

## Chụp tự động

```bash
pip install playwright && python -m playwright install chromium     # một lần
python3 scripts/store-screenshots.py --dry-run                       # xem kế hoạch + kích thước
python3 scripts/store-screenshots.py                                 # chụp mọi preset từ mã trong repo (tự mở máy chủ localhost)
python3 scripts/store-screenshots.py --only ios-6.7,android-phone --screens home,workout,nutrition,coach
python3 scripts/store-screenshots.py --url https://thangvu030198-ai.github.io/fitkit-app/    # chụp từ bản web đang chạy
python3 scripts/store-screenshots.py --color-scheme light --out store/screenshots/out-light
```

Ảnh ra ở `store/screenshots/out/<preset>/NN-<màn>.png`; script tự đọc lại header PNG và báo lỗi nếu sai kích thước.

- **Dữ liệu mẫu:** `seed-state.json` (hồ sơ “Minh, 26 tuổi, 172 cm, 74 kg, giảm mỡ”) được ghi vào `localStorage["fitkit_state_v1"]` trước khi app chạy. Muốn ảnh “có sức sống” (biểu đồ, kỷ lục, nhật ký ăn): dùng app thật vài buổi rồi xuất dữ liệu (Hồ sơ → Sao lưu) và dán đè vào `seed-state.json`. Không dùng tên/ảnh người thật.
- **Ngôn ngữ:** bộ tiếng Anh: thêm `--local-storage <khoá ngôn ngữ của i18n.js>=en --out store/screenshots/out-en` (khoá do agent `ux` định nghĩa — xem `i18n.js`).
- **Màn cần đăng nhập / thao tác** (đang tập, chi tiết bài + video, form học viên): chụp tay trên máy thật hoặc trình duyệt (DevTools → chế độ thiết bị, đặt đúng kích thước CSS: 430 × 932 @3x cho 6.7"; 360 × 640 @3x cho Android) rồi đặt cùng thư mục.
- Chạy trên GitHub Actions: thêm job `ubuntu-latest` chạy 3 lệnh đầu rồi `actions/upload-artifact` thư mục `store/screenshots/out` (chưa thêm sẵn để không tốn phút CI mỗi lần push).
- Ảnh thô → ghép khung + tiêu đề (Figma/Canva) theo §6 của STORE-LISTING; **giữ nguyên kích thước xuất** như bảng trên.

# Chụp ảnh tính calo (16/11/2026)

File: `food-scan.js` (giao diện + tính toán) · `functions/vision.js` (hàm `analyzeFoodPhoto`) · test `88-plan-tools-foodscan`.

## Cách giảm sai số

| Nguồn sai | Cách xử lý trong app |
|---|---|
| AI đoán sai khối lượng (sai số trung bình 35–40 % trong các nghiên cứu 2023–2026, hay đoán thiếu khi phần ăn lớn) | Vật tham chiếu (đũa, muỗng, thẻ, bàn tay) · chụp từ trên xuống · tuỳ chọn thêm ảnh nghiêng 45° · hiện khoảng thấp–cao · người dùng sửa gam trước khi lưu |
| AI tự bịa số calo | AI chỉ trả TÊN + GAM; calo do app tính từ bảng thực phẩm (`FOODS`). Món ngoài bảng mới dùng số AI, có nhãn "AI ước lượng" |
| Dầu mỡ, nước sốt không nhìn thấy | Ước lượng riêng, người dùng chọn mức dầu (không / ít / vừa / nhiều) |
| Ảnh tối, mờ | Kiểm ngay trên máy trước khi gửi, mời chụp lại |
| Món trộn | Lời nhắc buộc AI tách thành từng thành phần |

## Bật AI trên máy chủ

1. Lấy khoá AI đọc ảnh (mặc định Google Gemini: aistudio.google.com → Get API key).
2. GitHub → Settings → Secrets → Actions → thêm secret `VISION_API_KEY`.
3. Chạy workflow "Firebase — đẩy rules + Cloud Functions" với `functions = true`.

Đổi nhà cung cấp: biến repo `VISION_API_BASE` (gốc API tương thích OpenAI) và `VISION_MODEL`.
Chi phí: mỗi lượt chụp là một lần gọi AI có ảnh; giới hạn 40 lượt / tài khoản / ngày (`DAILY_MAX` trong `functions/vision.js`).
Chưa có khoá: app báo "chưa được bật"; người dùng có khoá AI riêng (Hồ sơ → Cài đặt AI) vẫn dùng được.

## Chưa làm

- Chưa đo sai số thực tế trên bộ ảnh món Việt có cân thật — nên thử 20–30 bữa có cân để biết mức sai của model đang dùng.
- Ảnh thứ hai (nghiêng 45°) chỉ được gửi khi gọi qua máy chủ; khoá AI riêng chỉ dùng 1 ảnh.

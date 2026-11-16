# Trợ lý AI TapEasy (ai-coach.js · admin-ai.js · functions/aicoach.js)

## Người dùng thấy gì
- Nút tròn **AI** ở góc phải (Trang chủ, Tập luyện, Dinh dưỡng, Giấc ngủ, Tiến độ…) → mở **Trợ lý TapEasy**.
- **Trò chuyện**: hỏi về tập luyện, ăn uống, ngủ nghỉ, sức khoẻ nhẹ, cách dùng app. Câu trả lời có nút bấm mở thẳng bài tập / món ăn / giáo án trong app.
- **Kế hoạch của tôi**: điền form (mục tiêu, trình độ, số buổi, thiết bị, cân nặng/chiều cao, giấc ngủ, chế độ ăn, dị ứng) → 4 tab **Tập luyện · Ăn uống · Ngủ & Nghỉ · Sức khỏe**. "Thêm vào tuần tập" đưa lịch vào giáo án (kèm cardio nhẹ cuối buổi).
- **Thẻ cardio sau buổi tập** ở màn Tập luyện: LISS 15–30 phút, không HIIT sau buổi chân/lưng nặng, 8–10 nghìn bước; nút "Thêm vào buổi này".
- Chưa đăng nhập / AI tắt / mất mạng: Trợ lý vẫn trả lời và lập kế hoạch bằng **bộ luật + kho kiến thức trên máy** (ghi rõ nguồn).

## Quản trị (Bảng quản trị → Trợ lý AI)
1. Dán **URL gốc** của nhà cung cấp (API tương thích OpenAI, thường kết thúc `/v1`) và **khoá API**.
2. Bấm **Quét toàn bộ model** → danh sách mọi model khoá dùng được, nhóm theo hãng, có nhãn *Nhanh & rẻ / Suy luận / Đọc được ảnh / Bản thử*.
3. Bấm **Thử** từng model để xem độ trễ + câu trả lời mẫu → chọn **Chính / Kế hoạch / Dự phòng**.
4. Chỉnh độ sáng tạo, độ dài, **giới hạn lượt / người / ngày**, ghi chú thêm → bật công tắc → **Lưu cấu hình**.

Quyền: `settings.view` (xem), `settings.edit` (sửa/quét/thử). Mọi lần lưu ghi nhật ký kiểm toán `settings.update` (không ghi khoá).

## Bảo mật
- Khoá API chỉ nằm ở Firestore `ai_secret/main` — `firestore.rules` chặn mọi client; chỉ Cloud Functions đọc. Client không bao giờ nhận lại khoá (chỉ 4 ký tự cuối).
- URL gốc phải là `https://tên-miền` công khai (chặn IP, localhost, mạng nội bộ, URL kèm tài khoản).
- Lời nhắc hệ thống do máy chủ viết; dữ liệu app/hồ sơ được bọc trong `<app_data>` và được coi là dữ liệu, không phải mệnh lệnh.
- Kết quả AI được app đối chiếu lại: mã bài tập / món lạ bị bỏ, cardio sai luật bị sửa, calo dưới ngưỡng an toàn bị thay; HTML luôn được thoát.
- Nội dung chat không lưu trên máy chủ; chỉ có bộ đếm `ai_rate/{uid}_{ngày}` và thống kê `ai_usage/{ngày}`.

## Triển khai
Sau khi cập nhật mã: chạy workflow **Firebase — đẩy rules + Cloud Functions** (hàm `aiChat`, `adminAiConfig` + rules mới).

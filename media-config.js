/* =========================================================================
   TapEasy — Nguồn video minh hoạ (miễn phí, dùng thương mại được)
   Theo tài liệu "Tổng hợp App Tập Luyện", mục 4B:
   - Pexels Videos  (Pexels License — không bắt buộc ghi nguồn, nhưng API yêu cầu
                     hiển thị chữ "Video từ Pexels" + tên tác giả — app đã làm sẵn)
   - Pixabay Videos (Pixabay License — dùng thương mại được)

   CHỦ APP điền API key 1 lần ở đây → mọi người dùng đều tìm được video.
   Lấy key miễn phí (khoảng 2 phút, cần đăng ký tài khoản):
   - Pixabay: https://pixabay.com/api/docs/ → đăng nhập → key nằm trong mục "Parameters → key"  (KHUYÊN DÙNG)
   - Pexels : https://www.pexels.com/api/  — lưu ý: tháng 11/2026 Pexels đang TẠM DỪNG cấp key mới,
              chỉ dùng được nếu bạn đã có key từ trước.
   Để trống thì người dùng vẫn có thể tự nhập key trong app (Hồ sơ → Nguồn video).
   ========================================================================= */
const MEDIA_CONFIG = {
  pexelsKey: "",
  /* integrator (FIX-security vòng 2 #6, 12/11): khoá Pixabay cũ đã lộ công khai trong mã client → gỡ. CHỦ APP: thu hồi khoá cũ trên
     pixabay.com, nếu muốn video tham khảo Pixabay cho bài chưa có video hướng dẫn thì điền khoá MỚI (giới hạn tên miền/ứng dụng) lúc build. */
  pixabayKey: "",
  // Video nền màn mở app (QU-04): "auto" = KHÔNG tìm video lúc chạy (không gọi API), chỉ dùng ảnh nền tĩnh.
  // Muốn có video nền: dán thẳng link .mp4 cố định (CDN của app) lúc build.
  welcomeVideo: "auto",
  welcomeQuery: "gym workout training",
};

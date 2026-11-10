/* =========================================================================
   FIT KIT — Nguồn video minh hoạ (miễn phí, dùng thương mại được)
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
  pixabayKey: "58526802-1bdd38af8d2196fe689410081",
  // Video nền màn mở app: để "auto" = tự tìm 1 video tập luyện dọc trên Pexels/Pixabay.
  // Hoặc dán thẳng link .mp4 của video bạn chọn (VD: video tự quay của bạn đã up lên đâu đó).
  welcomeVideo: "auto",
  welcomeQuery: "gym workout training",
};

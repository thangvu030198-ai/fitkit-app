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
  welcomeVideo: (typeof innerWidth !== "undefined" && innerWidth * (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1) > 900)
    ? "https://thangvu030198-ai.github.io/fitkit-app/media/welcome/welcome-bw-1080.mp4"
    : "https://thangvu030198-ai.github.io/fitkit-app/media/welcome/welcome-bw-720.mp4",   // clip Pexels 36184742, đen trắng (workflow media-welcome.yml)
  welcomePoster: "https://thangvu030198-ai.github.io/fitkit-app/media/welcome/welcome-bw-poster.jpg",
  welcomeQuery: "gym workout training",
  /* Thống kê sử dụng ẩn danh qua PostHog (analytics.js · docs/ANALYTICS.md) — TUỲ CHỌN, để trống = không dùng PostHog.
     Chỉ gửi khi người dùng bấm "Đồng ý"; SDK chỉ tải sau khi đồng ý. Khoá dự án PostHog (phc_…) là khoá công khai phía client.
     Host mặc định EU (https://eu.i.posthog.com) — đổi sang US thì phải thêm host đó vào CSP trong index.html. */
  posthogKey: "",
  posthogHost: "",
};

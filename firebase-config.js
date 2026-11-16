/* =========================================================================
   TapEasy — Cấu hình Firebase (máy chủ online cho phần PT ↔ Học viên)

   ĐỂ TRỐNG  → app chạy ở CHẾ ĐỘ DEMO: tài khoản & dữ liệu PT/học viên chỉ
               lưu trên máy này (dùng để thử luồng, không đồng bộ giữa 2 máy).
   ĐIỀN VÀO  → app dùng Firebase thật: PT và học viên ở 2 điện thoại khác
               nhau thấy cùng dữ liệu.

   Lấy các giá trị này tại: Firebase Console → Project settings → General →
   "Your apps" → Web app → SDK setup and configuration → Config.
   (Đây là cấu hình công khai, không phải mật khẩu — an toàn khi để trong app.
    Dữ liệu được bảo vệ bằng file firestore.rules.)
   ========================================================================= */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCTyzxlaM_yvL14P4A2e9XUmMFMPSbA6P0",
  authDomain: "tapeasy-2ce8f.firebaseapp.com",
  projectId: "tapeasy-2ce8f",
  storageBucket: "tapeasy-2ce8f.firebasestorage.app",
  messagingSenderId: "654220839822",
  appId: "1:654220839822:web:3c7a025ab731d1e92d72df",
  measurementId: "",   // TUỲ CHỌN: "G-…" để bật Firebase Analytics (chỉ gửi khi người dùng đồng ý — docs/ANALYTICS.md)
};

/* -------------------------------------------------------------------------
   CỜ TÍNH NĂNG (vòng R3) — hướng dẫn bật: docs/DATABASE-SETUP.md §10–11
   phoneOtp  : xác minh / quên mật khẩu bằng mã SMS (Firebase Phone Auth). SMS TỐN PHÍ, cần gói Blaze → mặc định TẮT (ẩn hẳn khỏi giao diện).
   emailOtp  : mã 6 số qua email để đặt lại mật khẩu (Cloud Function requestEmailOtp/verifyEmailOtp + dịch vụ gửi mail). Mặc định TẮT
               → app dùng link đặt lại mật khẩu có sẵn của Firebase (miễn phí, không cần cấu hình thêm).
   cloudSync : sao lưu dữ liệu tập luyện – dinh dưỡng theo tài khoản (chỉ chạy khi người dùng tích đồng ý dữ liệu sức khoẻ). Mặc định BẬT.
   ------------------------------------------------------------------------- */
const FK_FEATURES = {
  phoneOtp: false,
  emailOtp: false,
  cloudSync: true,
  // Nhịp sử dụng ẨN DANH cho mục "Phân tích" của bảng quản trị (pulse.js): không uid/email/IP. Đặt false để tắt hẳn.
  metrics: true,
  // Cách đăng nhập mạng xã hội ĐÃ bật trong Firebase Console → Authentication (bản web). Bật thêm Facebook/Apple trên Console xong thì thêm "facebook"/"apple" vào đây.
  authProviders: ["google"],
  /* 16/11: ĐĂNG NHẬP GOOGLE QUA TÊN MIỀN RIÊNG tapeasy.app (sửa lỗi "Unable to process request due to missing initial state").
     Trình duyệt mới (Chrome/Safari chặn chia sẻ bộ nhớ giữa các trang khác tên miền) làm hỏng đăng nhập khi trang đăng nhập nằm ở
     tapeasy-2ce8f.firebaseapp.com còn app ở tapeasy.app. true → khi chạy trên tapeasy.app, dùng trang đăng nhập tự host tại
     https://tapeasy.app/__/auth/handler (workflow "Firebase — trang đăng nhập tự host"). BẮT BUỘC trước khi bật:
     Google Cloud Console → APIs & Services → Credentials → OAuth client "Web client (auto created by Google Service)"
     → Authorized redirect URIs thêm https://tapeasy.app/__/auth/handler . App tự kiểm tra file /__/auth/handler.js có thật mới dùng. */
  ownAuthDomain: true,      // 16/11: đã thêm https://tapeasy.app/__/auth/handler vào OAuth client → BẬT
};

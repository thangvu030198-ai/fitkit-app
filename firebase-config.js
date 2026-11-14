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
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
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
};

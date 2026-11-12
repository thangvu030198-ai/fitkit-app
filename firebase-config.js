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

# Google Play — các khai báo trong “App content” (trả lời sẵn)

| Mục | Trả lời |
|---|---|
| **Privacy policy** | `https://thangvu030198-ai.github.io/fitkit-app/privacy-policy.html` (phải mở được, không còn chữ `[ĐIỀN …]`) |
| **Ads** | *No, my app does not contain ads* |
| **App access** | *All or some functionality is restricted* → thêm 2 bộ đăng nhập: `PT demo` và `Học viên demo` (email + mật khẩu; ghi chú tiếng Anh như `store/app-store/review-notes-en.md` §Accounts). Ghi rõ: “No 2FA. The app can also be used without an account (tap ‘Dùng ngay, không cần tài khoản’)”. |
| **Content rating** (IARC) | Category: *Utility, Productivity, Communication, or Other*. Violence/Sexuality/Language/Controlled substance/Gambling: **No**. *Does the app allow users to interact or exchange content?* **Yes** (chat PT ↔ học viên, bình luận, ảnh/clip sự kiện). *Does the app share the user’s current physical location?* **No**. *Does the app allow purchase of digital goods?* **No**. Kết quả dự kiến: Everyone / 3+ kèm nhãn “Users Interact”. |
| **Target audience and content** | Tuổi: **18 and over** (đơn giản nhất; app có thông tin sức khoẻ, mua hàng, chat). Nếu muốn 13+: tick 13–15, 16–17, 18+ và trả lời thêm bảng câu hỏi. **Không** tick nhóm dưới 13. *Could your store listing unintentionally appeal to children?* **No**. |
| **News app** | No |
| **Health apps** (bắt buộc với mọi app) | Tick: **Activity and fitness**, **Nutrition and weight management**, **Sleep management**. Không tick: Medical device apps, Disease prevention/public health, Clinical decision support, Healthcare services, Period tracking, Emergency… Mô tả ngắn (tiếng Anh): “Workout logging and plans, calorie/macro tracking with meal plans, sleep diary. General wellness only — not a medical device, no diagnosis or treatment. A pre-exercise screening (PAR-Q+) advises users to consult a doctor.” |
| **Health Connect** | Không dùng → không khai quyền |
| **Data safety** | Xem `data-safety.md` |
| **Advertising ID** | No |
| **Government apps** / **Financial features** | No / *My app doesn’t provide any financial features* |
| **User-generated content** (chính sách UGC) | App có: điều khoản cấm nội dung xấu, nút **Báo cáo** ở bài/bình luận/đánh giá/hồ sơ PT, **Chặn người dùng**, kiểm duyệt bởi quản trị viên, cam kết xử lý báo cáo trong 24 giờ. Giữ ảnh chụp các màn này để trả lời nếu Google hỏi. |
| **AI-generated content** | Phân tích ảnh bằng AI chỉ chạy khi người dùng tự nhập API key của họ; kết quả có nút báo cáo/ghi chú “không phải chẩn đoán y khoa”. |
| **Photo and video permissions** | App không xin `READ_MEDIA_IMAGES/VIDEO` (dùng trình chọn ảnh hệ thống) → không phải khai. |
| **Exact alarm / Foreground service / All files access** | Không dùng → không phải khai. |
| **Category · Tags** | Health & Fitness · Workout tracker, Calorie counter, Personal trainer, Diet & nutrition |
| **Contact details** | Email hỗ trợ `thangvu030198@gmail.com` · Website `https://thangvu030198-ai.github.io/fitkit-app/landing.html` |
| **Store settings → External marketing** | Tuỳ chọn |

## Quyền Android trong bản build (đối chiếu Play Console → App bundle explorer → Permissions)

| Quyền | Vì sao |
|---|---|
| `INTERNET`, `ACCESS_NETWORK_STATE` | đồng bộ Firebase, tải video/ảnh |
| `POST_NOTIFICATIONS` | nhắc giờ tập, báo hết giờ nghỉ (xin khi người dùng bật nhắc nhở) |
| `VIBRATE` | rung báo hết giờ nghỉ, phản hồi xúc giác |
| `CAMERA` (không bắt buộc phần cứng) | chụp ảnh tiến trình trong app, quét QR mã PT / điểm danh sự kiện (xin khi bấm chụp/quét) |
| `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK` | do plugin thông báo cục bộ: đặt lại lịch nhắc sau khi khởi động lại máy |

Không có: vị trí, danh bạ, micro, bộ nhớ/ảnh, điện thoại/SMS, `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` (nhắc tập dùng báo thức thường — có thể lệch vài phút khi máy ngủ sâu), `AD_ID`. Bước “Soát quyền” của workflow sẽ **làm đỏ build** nếu một thư viện kéo thêm các quyền này.

# TapEasy: kế hoạch ra mắt 30 ngày tại Việt Nam

> Thương hiệu: **TapEasy** (trước đây FIT KIT) — "Tập" + "Easy" = **tập dễ dàng**. Giọng điệu, logo, màu: `docs/BRAND.md`. Câu khẩu hiệu chính: *"Tập dễ dàng. Tiến bộ mỗi ngày."*

> Phạm vi: app v2.0.0 (web + iOS + Android). Chỉ quảng bá tính năng **đã có** (xem `docs/STORE-LISTING.md`). Số liệu thị trường lấy từ tìm kiếm web 11/2026, nguồn ở cuối file. Các con số **mục tiêu** và **ngân sách** là đề xuất, cần điều chỉnh theo dữ liệu thật sau tuần đầu.
> Quy đổi: **1 USD ≈ 26.000 đ** (Vietcombank bán ra ~25.940 đ đầu 11/2026). Làm tròn đến nghìn.

---

## 0. Tóm tắt một trang

| | |
|---|---|
| **Định vị** | App tập gym tiếng Việt **miễn phí cho người tập**, đồng thời là **công cụ quản lý học viên rẻ nhất cho PT** tại VN. |
| **Động cơ tăng trưởng** | PT là kênh phân phối: mỗi PT thêm học viên → app tạo **mã mời 6 ký tự** → học viên tải app miễn phí. 1 PT kích hoạt ≈ 4–10 người dùng mới. |
| **Kênh chính** | TikTok (nội dung PT + món Việt), nhóm Facebook gym/giảm cân, PT KOL micro, chương trình **PT Sáng lập** + **mã giới thiệu PT**. |
| **Giá** | Người tập & học viên: 0 đ mãi mãi. PT: miễn phí ≤ 3 học viên, **99.000 đ/tháng** ≤ 10 HV, **199.000 đ/tháng** ≤ 30 HV, **499.000 đ/tháng** ≤ 100 HV. Rẻ hơn 3–6 lần so với Trainerize/TrueCoach/Hevy Coach quy đổi. **30 ngày đầu chưa thu tiền**, chỉ đo mức sẵn sàng trả. |
| **North Star** | **Số buổi tập hoàn thành mỗi tuần** (cá nhân + buổi PT giao). |
| **Mục tiêu ngày 30** | 3.000 người dùng mới · 150 PT đăng ký · 80 PT kích hoạt · 400 học viên đã nối mã · D7 retention ≥ 15% · đánh giá store ≥ 4,5★. |
| **Ngân sách đề xuất** | ~30 triệu đ cho 30 ngày (chưa gồm phí tài khoản store). |

---

## 1. Thị trường và đối tượng

### 1.1 Bối cảnh 2026 (từ nguồn tìm được)

- **Giá PT cao:** phòng tầm trung 450.000–750.000 đ/buổi, cao cấp 600.000 đến hơn 1.000.000 đ/buổi, PT nổi tiếng 1–2,5 triệu đ/buổi (CareerLink). Citigym niêm yết 870.000–1,2 triệu đ/buổi (VnExpress 2026).
- **Chuỗi gym lớn co lại:** California Fitness & Yoga dừng 4 CLB ở Hà Nội và TP.HCM (07/2026), Citigym đóng 2 cơ sở ở TP.HCM từ 01/10/2026 (Tiền Phong, VnExpress). Người tập chuyển sang hình thức linh hoạt hơn → **PT tự do / PT phòng nhỏ tăng**, cần công cụ rẻ để quản lý học viên, lịch, gói buổi.
- **App cạnh tranh phía người tập** chủ yếu là app nước ngoài có tiếng Việt (Planfit, Muscle Booster, GymStreak…) hoặc app đếm calo (Caloer, Eatsy, MyFitnessPal), **không có app nào gộp giáo án + calo món Việt + kết nối PT**.
- **Công cụ cho PT** gần như toàn là phần mềm nước ngoài định giá bằng USD (Trainerize, TrueCoach, Hevy Coach, My PT Hub, Gymkee), không có giao diện/món ăn Việt.
- **Lưu ý:** các báo cáo quy mô thị trường fitness app VN chênh nhau hàng nghìn lần (BlueWeave vs Ken Research), **không dùng làm căn cứ**. Google Play chiếm ưu thế ở VN → ưu tiên Android khi ra mắt.

### 1.2 Phân khúc ưu tiên

| Ưu tiên | Phân khúc | Vấn đề | TapEasy giải quyết bằng | Thông điệp |
|---|---|---|---|---|
| **1** | **PT tự do, PT phòng gym nhỏ** (25–35 tuổi) | Lịch, gói buổi, bài tập nằm rải rác ở Zalo, Excel, sổ tay | Form 7 mục, lịch lặp tuần, gói buổi tự đếm, nhắc nhở 2 chiều, giao bài kèm video | "Quản lý 20 học viên không cần file Excel" |
| 2 | Người mới tập 18–30 (sinh viên, dân văn phòng) | Không biết tập gì, sợ sai kỹ thuật | 15 giáo án theo cấp độ, video hướng dẫn, ghi tạ tự tăng tiến | "Vào gym có giáo án sẵn, miễn phí" |
| 3 | Nữ giảm mỡ, tập mông | Ăn món Việt nhưng muốn kiểm soát calo | Glute Focus, tập tại nhà, calo món Việt, thực đơn theo BMI | "Ăn phở vẫn giảm mỡ, nếu biết tính" |
| 4 | Người tập lâu năm | Chững tạ | RPE, tự tăng/giảm tạ, 1RM, kỷ lục | "App tự quyết khi nào lên tạ" |

### 1.3 Vòng lặp tăng trưởng

```
PT tải app ──▶ thêm học viên ──▶ app tạo mã 6 ký tự ──▶ PT gửi qua Zalo
     ▲                                                     │
     │                                                     ▼
PT mới thấy app qua học viên/TikTok ◀── học viên dùng giáo án, calo, kể cho bạn bè
     │
     └── PT giới thiệu PT (mã giới thiệu PT, mục 4.4) ──▶ thêm tháng miễn phí
```

---

## 2. Việc phải xong TRƯỚC ngày ra mắt (D-14 → D-1)

| Hạn | Việc | Người làm | Ghi chú |
|---|---|---|---|
| D-14 | **Bật Firebase** (`firebase-config.js` đang trống = chế độ demo, PT và học viên trên 2 máy KHÔNG thấy nhau) | Dev | **Chặn ra mắt.** Xem `README-store.md` mục 1. |
| D-14 | Google Play: chạy **thử nghiệm kín ≥ 12 người trong 14 ngày** (tài khoản cá nhân mới) | Chủ app | Mời 12–20 PT Sáng lập làm tester luôn. |
| D-10 | Nộp App Store (TestFlight → Review) kèm tài khoản demo PT + học viên | Chủ app | |
| D-10 | Deploy `landing.html` + `assets/og-tapeasy.jpg` lên GitHub Pages; kiểm tra ảnh chia sẻ bằng Facebook Sharing Debugger | Dev | |
| D-10 | Email hỗ trợ riêng, fanpage, TikTok `@tapeasy.vn` (hoặc `@tapeasy.app` nếu đã có người dùng); giữ cùng một tên ở Facebook/Zalo OA/YouTube | Marketing | |
| D-7 | Đo lường (mục 7.3): UTM cho mọi link, script đếm Firestore hằng tuần, analytics cho landing | Dev | |
| D-7 | Kho nội dung: quay sẵn **20 video TikTok** (mục 4.1) | Marketing | |
| D-7 | Danh sách **50 PT** tiềm năng (bạn bè, PT phòng gần nhà, PT đang đăng TikTok < 50K follow) | Founder | Nhắn riêng, mời làm PT Sáng lập. |
| D-3 | Tài liệu "Hướng dẫn PT 5 phút" (PDF 1 trang + video 60 s): thêm học viên → gửi mã → soạn buổi lặp tuần | Marketing | |
| D-1 | Kiểm tra lại: đăng ký, nhập mã, xoá tài khoản, thông báo trên Android thật | QA | |

---

## 3. Mô hình giá

### 3.1 Nguyên tắc

1. **Người tập và học viên: 0 đ, không quảng cáo, mãi mãi.** Đây là lời hứa đã ghi trên landing và store; học viên miễn phí thì PT mới dám mời.
2. **PT trả theo số học viên đang hoạt động** (học viên có ≥ 1 buổi trong 30 ngày gần nhất). Không tính học viên đã nghỉ, để PT không phải xoá dữ liệu cũ.
3. **30 ngày ra mắt: chưa thu tiền.** App hiện **chưa có tính năng thanh toán**. Dùng 30 ngày để có PT, đo mức sử dụng và hỏi giá. Bật gói trả phí từ ngày 61–90 (mục 9).

### 3.2 Bảng giá đề xuất

| Gói | Học viên hoạt động | Giá tháng | Giá năm (tặng 2 tháng) | Giá / học viên / tháng |
|---|---|---|---|---|
| **PT Free** | ≤ 3 | 0 đ | 0 đ | 0 đ |
| **PT Starter** | ≤ 10 | **99.000 đ** | 990.000 đ | từ 9.900 đ |
| **PT Pro** | ≤ 30 | **199.000 đ** | 1.990.000 đ | từ 6.600 đ |
| **PT Studio** | ≤ 100, nhiều PT chung 1 phòng | **499.000 đ** | 4.990.000 đ | từ 5.000 đ |

- **Ưu đãi PT Sáng lập** (100 PT đầu tiên, cần có ≥ 3 học viên hoạt động trong 30 ngày): **PT Pro miễn phí 6 tháng**, sau đó **giữ giá 99.000 đ/tháng cho gói Pro trọn đời**, có huy hiệu "PT Sáng lập" trên hồ sơ PT.
- **Gói Studio** cần làm thêm tính năng nhiều PT dùng chung (chưa có), chỉ mở bán khi đã xây xong.
- **Vì sao 99.000 đ:** bằng khoảng 1/5 giá **một buổi** PT tầm trung (450.000–750.000 đ). Chỉ cần app giúp giữ 1 học viên gia hạn thêm 1 tháng (8–12 buổi ≈ 3,6–9 triệu đ doanh thu cho PT) là PT đã lời nhiều lần.

### 3.3 So sánh đối thủ (quy đổi ~26.000 đ/USD)

**Công cụ cho PT**

| Sản phẩm | Gói tương đương | Giá gốc | Quy đổi/tháng | TapEasy cùng mức |
|---|---|---|---|---|
| Trainerize | Free 1 khách · Grow ≤ 2 khách · Pro 5 khách → 200 khách | $0 · $9 · $23 → ~$135 | 0 · ~234.000 đ · ~598.000 đ → ~3,5 triệu đ | Free ≤ 3 HV · 99.000 đ ≤ 10 HV |
| TrueCoach | Starter ≤ 5 · Standard ≤ 20 · Pro ≤ 50 | $29,98 · $69,98 · $164,98 | ~780.000 đ · ~1,82 triệu đ · ~4,29 triệu đ | 99.000 đ · 199.000 đ · 499.000 đ |
| Hevy Coach | 1–10 khách → 501–1.000 khách | $25 → $700 | ~650.000 đ → ~18,2 triệu đ | 99.000 đ ≤ 10 HV |
| My PT Hub | tuỳ gói | $55–130 (theo FitBudd) | ~1,43–3,38 triệu đ | – |
| Gymkee | khởi điểm | $66 | ~1,72 triệu đ | – |

→ TapEasy **rẻ hơn 3–8 lần** ở mức 5–20 học viên, có sẵn **tiếng Việt, món Việt, mã mời qua Zalo**. Đối thủ mạnh hơn ở: thanh toán trong app, app thương hiệu riêng, tích hợp đồng hồ. Không cạnh tranh ở các điểm đó trong 90 ngày đầu.

**App cho người tập (để chứng minh "miễn phí" là lợi thế thật)**

| App | Giá trả phí | Quy đổi |
|---|---|---|
| Planfit | $11,99/tháng · $79,99/năm | ~312.000 đ/tháng · ~2,08 triệu đ/năm |
| Hevy Pro | $2,99/tháng · $23,99/năm | ~78.000 đ/tháng |
| MyFitnessPal Premium (App Store VN) | 219.000 đ / 1.119.000 đ (kỳ hạn chưa rõ) | – |
| Caloer | $7,99/3 tháng · $9,99/6 tháng · $17,99/năm | ~208.000 đ/3 tháng |

### 3.4 Thu tiền thế nào cho đúng quy định store (khi bật gói, ngày 61+)

- **iOS:** gói PT mở khoá tính năng số trong app → theo Guideline 3.1.1 phải dùng **In-App Purchase** (phí 15% nếu tham gia App Store Small Business Program). Không đặt nút/link mua ngoài trong app. Kiểm tra lại guideline hiện hành trước khi làm.
- **Android:** giao dịch trong app dùng **Google Play Billing** (gói thuê bao: phí 15%).
- **Web:** có thể bán qua chuyển khoản VietQR/MoMo trên trang web; tài khoản đã nâng cấp dùng được ở mọi nền tảng, nhưng trong app iOS không nhắc tới giá web.
- Giá trên store nên đặt mức tương đương sau phí (VD 99.000 đ web ≈ 109.000–119.000 đ trên store), hoặc giữ một giá và chấp nhận biên thấp hơn. Quyết định sau khi có số liệu chuyển đổi.
- Hộ kinh doanh/doanh nghiệp: hỏi kế toán về hoá đơn điện tử và thuế với doanh thu dịch vụ số.

---

## 4. Kênh và chiến thuật

### 4.1 TikTok (kênh số 1 cho người tập)

- **Tần suất:** 2 video/ngày trong 30 ngày (60 video), 15–35 giây, phụ đề tiếng Việt luôn bật, hook trong 1,5 giây đầu, CTA "link ở bio" (bio trỏ về `landing.html?utm_source=tiktok`).
- **3 trụ nội dung (tỉ lệ 40/30/30):**
  1. **Giáo án 60 giây** (người mới, nữ tập mông): "Lịch tập 3 buổi/tuần cho người mới", "Glute Focus 4 buổi: thứ tự bài", "Đi bộ dốc 12-3-30 cho người mới bắt đầu (tăng dần)".
  2. **Món Việt và calo**: "1 tô phở bò bao nhiêu calo?", "Cơm tấm vs bún bò: món nào hợp giảm mỡ?", "Thực đơn 2.000 kcal toàn món Việt", "Món rẻ cho sinh viên tập gym".
  3. **Đời PT / tập thông minh**: "Cách PT theo dõi 20 học viên không cần Excel", "Vì sao tạ không lên: bạn không ghi lại", "App tự tăng 2,5 kg khi nào?".
- **20 hook mẫu** (quay trước D-7):
  1. "Đi gym 3 tháng mà tạ không lên? Do bạn không ghi lại."
  2. "1 tô phở = 450 kcal. Vậy giảm mỡ có được ăn phở không?"
  3. "PT nói thật: người mới đừng tập 6 buổi/tuần."
  4. "Lịch tập mông 4 buổi chị em hay hỏi mình."
  5. "Đi bộ dốc 12-3-30 là gì, và người mới nên bắt đầu nhẹ hơn thế nào?"
  6. "RIR là gì? Vì sao không nên tập tới kiệt sức mọi hiệp."
  7. "Thực đơn giảm mỡ 7 ngày mà vẫn ăn bún bò."
  8. "3 món chay đủ đạm cho người tập."
  9. "Cách PT gửi bài cho học viên trong 10 giây."
  10. "Gói 12 buổi còn 2 buổi: PT nhắc học viên thế nào cho khéo?"
  11. "Lắp đĩa tạ 62,5 kg thế nào cho nhanh?"
  12. "Khởi động trước squat nặng: 4 hiệp này là đủ."
  13. "BMI 24 ở người châu Á là thừa cân, bạn có biết?"
  14. "Cơm văn phòng bao nhiêu calo?"
  15. "Trà sữa và mục tiêu giảm mỡ: một ly bằng bao nhiêu phút đi bộ?"
  16. "Tập tại nhà chỉ với 2 quả tạ đơn."
  17. "Upper/Lower hay PPL: chọn thế nào?"
  18. "PT của bạn có nhắc bạn trước giờ tập không?"
  19. "Học viên quên bài PT dặn? Đây là cách mình xử lý."
  20. "Mình để app tự quyết khi nào tăng tạ trong 30 ngày, và đây là kết quả."
- **Spark Ads** (tuần 3–4): chỉ đẩy 3 video có tỉ lệ xem hết cao nhất. Nhắm **18+**, không dùng ảnh trước/sau cơ thể, không hứa kết quả kiểu "giảm 5 kg/2 tuần" (TikTok hạn chế quảng cáo giảm cân; đọc chính sách quảng cáo hiện hành trước khi chạy).

### 4.2 Nhóm Facebook gym, giảm cân, PT

- **Chọn 20 nhóm** bằng cách tìm trên Facebook: "gym Việt Nam", "tập gym cho người mới", "giảm cân eat clean", "PT cá nhân", "huấn luyện viên thể hình", nhóm gym theo quận/thành phố, nhóm sinh viên tập gym. Ưu tiên nhóm có bài mới mỗi ngày và cho phép chia sẻ công cụ.
- **Luật chơi:** đọc nội quy; nhắn admin xin phép trước khi đăng có link; **80% giá trị, 20% nhắc app**; tối đa 3 nhóm/ngày; trả lời mọi bình luận trong 2 giờ. Không đăng cùng một nội dung y hệt ở nhiều nhóm (dễ bị chặn spam).
- **Mẫu bài 1 (người tập):** "Mình tổng hợp bảng calo 20 món Việt hay ăn (phở, bún bò, cơm tấm, bánh mì…) + thực đơn 2.000 kcal. Ai cần mình gửi ảnh ở dưới. Muốn tự tính theo cân nặng thì mình làm sẵn trong app miễn phí, link ở bình luận."
- **Mẫu bài 2 (PT):** "Các anh chị PT đang quản lý học viên bằng gì? Mình làm một app miễn phí cho PT: thêm học viên, gửi mã qua Zalo, soạn buổi lặp tuần, tự đếm gói buổi. Đang tìm 100 PT dùng thử và góp ý, PT Sáng lập được dùng gói Pro miễn phí 6 tháng."
- **Mồi giá trị:** PDF "15 giáo án hiện đại" (tóm tắt từ app), ảnh "Bảng calo món Việt", checklist "Khởi động trước bài nặng".

### 4.3 KOL là PT

- Tham khảo bảng xếp hạng Heepsy (cần kiểm tra lại số follow và tỉ lệ tương tác trước khi liên hệ): nhóm fitness có Quỳnh ami (~892K, chủ phòng gym TP.HCM), Anhsonn_fitness (~822K, đào tạo PT), Duy Đức (~677K); nhóm gym có David Minh Nhật (~1,7 triệu), HitFit (~1,3 triệu).
- **Chiến lược 30 ngày:** không đặt cược vào KOL triệu follow. Ưu tiên **10–15 PT micro (10K–100K follow) đang dạy học viên thật**, vì họ dùng app thật và kéo học viên vào app.
- **Đề nghị hợp tác:**
  - PT Pro miễn phí **trọn đời** + huy hiệu PT Sáng lập.
  - **Chia 30% doanh thu 12 tháng** từ các PT họ giới thiệu (qua mã giới thiệu PT, khi bật gói trả phí).
  - Đồng sáng tác 1 giáo án mang tên họ trong app (cần làm tính năng giáo án tác giả; hứa ở mức "giai đoạn 2").
  - Có thể trả phí video: **ước tính 2–5 triệu đ/video** với micro (chỉ là ước lượng, cần hỏi báo giá thật).
- **Brief cho KOL:** quay cảnh thật ở phòng tập: gửi mã cho học viên, học viên mở app thấy bài + video, app tự tăng tạ. Không đọc kịch bản quảng cáo, không hứa kết quả cơ thể.
- **Kiểm tra trước khi ký:** tỉ lệ tương tác ≥ 3%, bình luận thật, khán giả VN ≥ 70%.

### 4.4 Mã giới thiệu PT (cần làm thêm, ~2–3 ngày dev)

Hiện app **đã có** mã mời học viên 6 ký tự. Cần thêm **mã giới thiệu giữa các PT**:

| Thành phần | Đặc tả |
|---|---|
| Mã | Mỗi PT có 1 mã dạng `PT-XXXXX` (5 ký tự, không nhầm 0/O, 1/I), hiện trong Hồ sơ PT với nút Sao chép / Gửi. |
| Dùng mã | PT mới nhập mã khi chọn vai trò "Tôi là PT" (hoặc trong Hồ sơ PT trong 7 ngày đầu). |
| Thưởng | Khi PT mới có **≥ 3 học viên nối mã trong 14 ngày**: cả hai PT được **+1 tháng PT Pro**. Tối đa 12 tháng tích luỹ. Khi bật gói trả phí: người giới thiệu là KOL nhận 30% doanh thu 12 tháng. |
| Chống gian lận | Không thưởng khi học viên dùng cùng email/thiết bị với PT; học viên phải mở app ≥ 2 ngày khác nhau. |
| Dữ liệu (Firestore) | `users/{uid}.refCode`, `users/{uid}.referredBy`, `referrals/{id} {from, to, createdAt, qualifiedAt}`; cập nhật `firestore.rules` để PT chỉ đọc được referral của chính mình. |
| Bảng xếp hạng | "Top PT giới thiệu tháng" đăng trên fanpage/nhóm PT Sáng lập (xin phép PT trước khi công khai tên). |

### 4.5 ASO và đánh giá

- Dùng tên, phụ đề, từ khoá, 8 ảnh theo `docs/STORE-LISTING.md`.
- **Xin đánh giá** sau khi người dùng hoàn thành buổi tập thứ 3 (khoảnh khắc vui nhất). Cần thêm plugin đánh giá trong app (In-App Review của Google/Apple), chưa có trong bản hiện tại.
- Trả lời 100% review trong 24 giờ theo mẫu ở `STORE-LISTING.md` mục 8.
- Ngày 15: chạy thử nghiệm ảnh 1 (Google Play Store listing experiments).

### 4.6 Ngoại tuyến (chi phí thấp)

- **Poster QR A4** ở 10 phòng gym nhỏ có PT Sáng lập: "Quét để nhận giáo án miễn phí" → `landing.html?utm_source=poster&utm_campaign=<tên phòng>`.
- **Danh thiếp PT** in mã giới thiệu + QR tải app (PT tự in, TapEasy gửi file thiết kế).

### 4.7 Cộng đồng

- Nhóm Zalo **"TapEasy – PT Sáng lập"** (tối đa 100 người): báo lỗi, xin tính năng, livestream hỏi đáp 30 phút mỗi tối thứ 5.
- Mỗi tuần công bố "Đã sửa / Đã thêm theo góp ý" để PT thấy tiếng nói của mình có tác dụng.

---

## 5. Lịch 30 ngày

| Ngày | Trọng tâm | Việc cụ thể | Kết quả cần đạt |
|---|---|---|---|
| **1** | Ra mắt mềm | Mở landing + store; nhắn 50 PT trong danh sách; đăng video 1–2 | 20 PT đồng ý thử |
| 2 | Onboard PT | Gọi video 15 phút với từng PT: thêm 3 học viên đầu tiên | 10 PT có ≥ 1 HV nối mã |
| 3 | Nội dung | Video 3–4 (trụ món Việt); bài FB mẫu 1 ở 3 nhóm | 1.000 lượt xem/video |
| 4 | Sửa lỗi | Gom lỗi từ nhóm Zalo PT, phát bản vá nếu cần | Crash-free ≥ 99% |
| 5 | Nội dung | Video "PT gửi mã cho học viên"; bài FB mẫu 2 (PT) ở 3 nhóm PT | 10 PT mới đăng ký |
| 6 | Đo lường | Báo cáo tuần 1 (mục 7.4); chọn 3 video tốt nhất | Có số liệu phễu đầu tiên |
| 7 | Tổng kết tuần 1 | Livestream nhóm Zalo; cập nhật FAQ landing theo câu hỏi thật | 30 PT đăng ký |
| **8** | Mở rộng nội dung | Bắt đầu thử thách **"14 ngày tập đúng giáo án"** (hashtag riêng, người tham gia đăng ảnh màn ghi tạ) | 100 người tham gia |
| 9 | KOL đợt 1 | Gửi brief cho 5 PT micro; ký 3 | 3 video KOL lên trong tuần 2 |
| 10 | FB groups | 3 nhóm/ngày, PDF "15 giáo án hiện đại" làm mồi | 300 lượt tải PDF |
| 11 | Ngoại tuyến | In và dán poster QR ở 5 phòng gym của PT Sáng lập | 50 lượt quét |
| 12 | Nội dung | 2 video/ngày tiếp; video "app tự tăng tạ" | 1 video ≥ 10.000 lượt xem |
| 13 | Sản phẩm | Dev xong **mã giới thiệu PT** (mục 4.4) trên bản thử | Qua QA |
| 14 | Tổng kết tuần 2 | Báo cáo tuần; khảo sát PT về giá (mục 7.2) | 70 PT đăng ký, 40 kích hoạt |
| **15** | Giới thiệu PT | Phát hành mã giới thiệu PT; thông báo trong nhóm Zalo + fanpage | 15 lượt giới thiệu |
| 16 | ASO | Bật thử nghiệm ảnh 1 trên Google Play; trả lời toàn bộ review | ≥ 30 đánh giá |
| 17 | Quảng cáo thử | Spark Ads 3 video tốt nhất, 200.000 đ/ngày/video, nhắm 18–34, TP.HCM + Hà Nội + Đà Nẵng | CPI web/app < 15.000 đ |
| 18 | KOL đợt 2 | Ký thêm 5 PT micro; 1 PT mid-tier nếu tỉ lệ tương tác tốt | 5 video KOL |
| 19 | Nội dung | Series "Thực đơn món Việt 7 ngày" (7 video ngắn) | Lưu (save) ≥ 5% lượt xem |
| 20 | Sản phẩm | Sửa 3 điểm rơi lớn nhất trong phễu (theo số liệu tuần 2) | Onboarding hoàn tất ≥ 70% |
| 21 | Tổng kết tuần 3 | Báo cáo tuần; tắt quảng cáo kém (CPI > 25.000 đ) | 110 PT đăng ký, 60 kích hoạt |
| **22** | Dồn lực | Tăng ngân sách cho 1–2 kênh có chi phí/PT kích hoạt thấp nhất | |
| 23 | PR | Gửi câu chuyện "App miễn phí giúp PT tự do quản lý học viên khi chuỗi gym đóng cửa" cho 5 báo/trang lifestyle, startup | 1 bài được đăng |
| 24 | Cộng đồng | Công bố người thắng thử thách 14 ngày (quà: 3 tháng PT Pro hoặc phần quà nhỏ) | 50 bài đăng có hashtag |
| 25 | Giá | Hiện màn "Gói PT sắp ra mắt" cho PT có > 3 học viên, nút "Tôi quan tâm" (không thu tiền) | ≥ 30% PT bấm quan tâm |
| 26 | Nội dung | Video tổng hợp "30 ngày TapEasy: X buổi tập, Y học viên" | |
| 27 | Sản phẩm | Lên kế hoạch In-App Review + gói trả phí (IAP / Play Billing) | Đặc tả xong |
| 28 | ASO | Đọc kết quả thử nghiệm ảnh; áp dụng bản thắng | CVR trang store +10% |
| 29 | Tổng kết | Báo cáo 30 ngày, phỏng vấn 10 PT hoạt động nhiều nhất | |
| 30 | Kế hoạch tiếp | Chốt kế hoạch ngày 31–90 (mục 9) | |

---

## 6. Ngân sách đề xuất (30 ngày)

| Hạng mục | Số tiền | Ghi chú |
|---|---|---|
| PT KOL micro (8–10 video) | 15.000.000 đ | Ước tính 1,5–2 triệu đ/video sau thương lượng + quyền lợi Pro trọn đời |
| Spark Ads / boost bài | 8.000.000 đ | Chỉ chạy từ ngày 17, tắt nhóm quảng cáo kém sau 3 ngày |
| Quay/dựng video thuê ngoài | 4.000.000 đ | Hoặc tự quay bằng điện thoại để giảm |
| In poster QR, danh thiếp mẫu | 1.000.000 đ | |
| Quà thử thách 14 ngày + dự phòng | 2.000.000 đ | |
| **Tổng** | **30.000.000 đ** | |
| Chi phí cố định (ngoài ngân sách trên) | Apple Developer 99 USD/năm (~2,6 triệu đ), Google Play 25 USD một lần (~650.000 đ), Firebase gói Spark miễn phí | |

---

## 7. Chỉ số đo lường

### 7.1 North Star và chỉ số chính

**North Star: số buổi tập hoàn thành mỗi tuần** = buổi tập cá nhân bấm "kết thúc buổi" + buổi PT giao được đánh dấu "Hoàn thành". Chỉ số này tăng khi có thêm người dùng **và** khi họ tập đều, nên khó "làm đẹp" bằng lượt tải ảo.

| Tầng phễu | Chỉ số | Mục tiêu ngày 30 | Nguồn dữ liệu |
|---|---|---|---|
| Nhận biết | Lượt xem TikTok, lượt hiển thị trang store, lượt truy cập landing | 300.000 view TikTok; 15.000 hiển thị store | TikTok Analytics, Play Console, App Store Connect, analytics landing |
| Chuyển đổi | Trang store → cài đặt; landing → bấm "Dùng ngay trên web" | ≥ 25% (store) · ≥ 20% (landing) | Store consoles, UTM |
| Kích hoạt người tập | Hoàn tất onboarding; thêm giáo án ngày đầu; ghi buổi tập đầu trong 72 giờ | ≥ 70% · ≥ 50% · ≥ 35% | Sự kiện ẩn danh (mục 7.3) |
| Kích hoạt PT | PT có ≥ 1 học viên nối mã trong 7 ngày | ≥ 50% PT đăng ký | Firestore (`clients.studentUid`) |
| Chiều sâu PT | Học viên hoạt động / PT kích hoạt; buổi PT soạn / PT / tuần | ≥ 4 HV; ≥ 3 buổi | Firestore (`sessions`) |
| Lan truyền | Tỉ lệ mã mời được dùng; người dùng mới đến từ mã PT / PT kích hoạt (hệ số K PT) | ≥ 60%; K ≥ 3 | Firestore |
| Giữ chân | D1 / D7 / D30 của người dùng mới | ≥ 30% / ≥ 15% / ≥ 8% | Store consoles + sự kiện ẩn danh |
| Chất lượng | Điểm đánh giá; crash-free; thời gian trả lời review | ≥ 4,5★; ≥ 99,5%; ≤ 24 giờ | Store consoles |
| Sẵn sàng trả tiền | PT (> 3 HV) bấm "Tôi quan tâm" gói PT | ≥ 30% | Firestore |
| Hiệu quả kênh | Chi phí / PT kích hoạt; chi phí / người dùng mới | ≤ 200.000 đ/PT; ≤ 10.000 đ/người dùng | Bảng chi phí + UTM |

**Mục tiêu tổng ngày 30:** 3.000 người dùng mới (web + app) · 150 PT đăng ký · 80 PT kích hoạt · 400 học viên nối mã · 6.000 buổi tập hoàn thành cộng dồn.

### 7.2 Khảo sát giá (ngày 14 và 25, gửi PT có ≥ 3 học viên)

1. Bạn đang quản lý bao nhiêu học viên? (1–5 / 6–10 / 11–20 / 21–30 / > 30)
2. Hiện bạn trả bao nhiêu/tháng cho công cụ quản lý học viên? (0 đ / < 100K / 100–300K / > 300K)
3. Mức giá nào bạn thấy **quá rẻ đến mức nghi ngờ chất lượng**, **hợp lý**, **đắt nhưng vẫn cân nhắc**, **quá đắt**? (Van Westendorp, 4 câu)
4. Tính năng nào khiến bạn sẵn sàng trả tiền? (thanh toán gói từ học viên, nhắc gia hạn, báo cáo tiến độ gửi học viên, hồ sơ PT công khai, nhiều PT chung phòng)

### 7.3 Cách đo khi app chưa có analytics

App hiện **không gửi số liệu sử dụng** (chính sách bảo mật ghi rõ dữ liệu sức khoẻ chỉ lưu trên máy). Đề xuất theo mức độ xâm phạm tăng dần:

1. **Không cần sửa app:** Play Console + App Store Connect (lượt cài, giữ chân, crash, đánh giá); **script đếm Firestore** chạy tay mỗi thứ Hai (số `users`, `users.isPT`, `clients` có `studentUid`, `sessions` theo `status`); UTM cho mọi link ngoài.
2. **Landing:** công cụ analytics không cookie, chỉ gắn vào `landing.html` (không gắn vào app), để đo lượt truy cập và tỉ lệ bấm "Dùng ngay trên web".
3. **Sự kiện ẩn danh trong app (cần làm, nên làm trước ngày 1):** đếm 6 sự kiện không kèm dữ liệu sức khoẻ: `onboarding_done`, `template_added`, `workout_finished`, `pt_client_created`, `student_joined`, `pt_session_done`. Nếu dùng Firebase Analytics thì **phải cập nhật** `privacy-policy.html`, mục Data safety (Google) và App Privacy (Apple): khai báo "Analytics: Product interaction", không liên kết danh tính, không tracking.

### 7.4 Mẫu báo cáo tuần (mỗi thứ Hai)

| Chỉ số | Tuần này | Tuần trước | Δ | Ghi chú/hành động |
|---|---|---|---|---|
| Buổi tập hoàn thành (North Star) | | | | |
| Người dùng mới (web / Android / iOS) | | | | |
| PT đăng ký / PT kích hoạt | | | | |
| Học viên nối mã | | | | |
| D7 của nhóm người dùng 2 tuần trước | | | | |
| Đánh giá trung bình / số review mới | | | | |
| Chi phí / PT kích hoạt theo kênh | | | | |
| 3 lỗi/góp ý hàng đầu | | | | |

---

## 8. Rủi ro và cách xử lý

| Rủi ro | Dấu hiệu | Cách xử lý |
|---|---|---|
| Ra mắt khi Firebase còn chế độ demo | PT báo "học viên nhập mã không thấy gì" | Chặn ra mắt đến khi bật Firebase (mục 2). |
| Store từ chối | Apple 4.2 (chức năng tối thiểu), 3.1.1 (thanh toán) | Bản 2.0 có thông báo native, dữ liệu riêng, chia sẻ; chưa bán gì nên không dính 3.1.1. Trả lời reviewer kèm video demo luồng PT. |
| Nội dung bị coi là quảng cáo giảm cân sai lệch | Video bị hạn chế, quảng cáo bị từ chối | Không ảnh trước/sau, không hứa kết quả theo thời gian, nhắm 18+, luôn kèm câu "số liệu chỉ mang tính tham khảo". |
| Bị chặn ở nhóm Facebook vì spam | Bài bị xoá, tài khoản bị khoá đăng | Xin phép admin, nội dung giá trị trước, giới hạn 3 nhóm/ngày, dùng tài khoản cá nhân thật của founder. |
| KOL follow ảo | Tương tác < 1%, bình luận chung chung | Kiểm tra trước khi ký; trả theo hiệu quả (PT kích hoạt) nếu có thể. |
| Học viên ngại chia sẻ số điện thoại | PT phàn nàn | Số điện thoại vốn không bắt buộc; nhắc PT chỉ nhập khi học viên đồng ý. |
| Retention thấp sau tuần 1 | D7 < 10% | Nhắc nhở mặc định bật sau onboarding; thử thách 14 ngày; tin "buổi hôm nay" ở Trang chủ. |
| Firestore vượt gói miễn phí | Gần 50.000 lượt đọc/ngày | Theo dõi trong console; bật Blaze có hạn mức chi tiêu khi > 1.000 người dùng hoạt động/ngày. |

---

## 9. Sau ngày 30 (ngày 31–90)

1. **Ngày 31–45:** In-App Review, sự kiện ẩn danh (nếu chưa có), tối ưu phễu onboarding theo dữ liệu.
2. **Ngày 46–60:** Xây thanh toán gói PT (IAP + Google Play Billing + web), màn quản lý gói trong Hồ sơ PT.
3. **Ngày 61–90:** Bật gói trả phí theo giá đã kiểm chứng qua khảo sát; giữ ưu đãi PT Sáng lập; bắt đầu "Tìm & Book PT" (đang ghi *Sắp ra mắt* trong app) dùng hồ sơ PT có sẵn; đẩy thông báo tức thì PT → học viên (Firebase Cloud Messaging).

---

## Nguồn tham khảo (tìm kiếm 11/2026)

**Giá PT và thị trường gym VN**
- [CareerLink: PT gym là gì, mức giá thuê PT](https://www.careerlink.vn/cam-nang-viec-lam/tu-van-nghe-nghiep/pt-gym-la-gi-4-yeu-to-de-tro-thanh-pt-gym-chuyen-nghiep)
- [VnExpress: Phòng gym cao cấp hụt hơi](https://vnexpress.net/phong-gym-cao-cap-hut-hoi-5121139.html)
- [Tiền Phong: Chuyện gì đang xảy ra với chuỗi phòng gym?](https://tienphong.vn/chuyen-gi-dang-xay-ra-voi-chuoi-phong-gym-post1861949.tpo)
- [Tiền Phong: Gen Z thay đổi lựa chọn khi mua thẻ gym](https://tienphong.vn/mat-tien-ma-van-khong-co-cho-tap-khi-mua-the-gym-dai-han-gen-z-thay-doi-lua-chon-uu-tien-post1866987.tpo)
- [VnBusiness: Làn sóng đóng cửa gym](https://vnbusiness.vn/lan-song-dong-cua-gym-chuoi-lon-gap-bien-dong-gi.html)
- [Index.vn: The golden era of premium gym chains ends](https://index.vn/en/news/the-golden-era-of-premium-gym-chains-ends-as-costs-rise-and-demand-shifts)

**Giá công cụ cho PT**
- Trainerize: [Dupple review 11/2026](https://dupple.com/reviews/trainerize), [Costbench](https://www.costbench.com/software/gym-management/trainerize/), [G2](https://www.g2.com/products/abc-trainerize/pricing), [FitBudd](https://www.fitbudd.com/insights/trainerize-pricing-explained-what-it-actually-costs-trainers-in-2026-vs-better-alternatives)
- TrueCoach: [Coachway](https://coachway.io/articles/truecoach-pricing/), [Capterra](https://capterra.com/p/155784/truecoach/), [FitBudd](https://www.fitbudd.com/insights/truecoach-pricing-explained-plans-costs-and-what-coaches-actually-pay?c84a98fb_page=25)
- Hevy / Hevy Coach: [SensAI: Boostcamp vs Hevy](https://www.sensai.fit/blog/boostcamp-vs-hevy-2026), [Coachway: Hevy Coach pricing](https://coachway.io/articles/hevy-coach-pricing/), [SensAI: Hevy review](https://www.sensai.fit/blog/hevy-review-2026)
- My PT Hub, TrueCoach, Trainerize (tổng hợp): [FitBudd: Best CRM software for personal trainers](https://www.fitbudd.com/insights/best-crm-software-for-personal-trainers-top-10-compared)
- [Gymkee: so sánh phần mềm huấn luyện cá nhân](https://gymkee.com/vi/compare/alternatives/)

**App cho người tập**
- [Planfit trên App Store](https://apps.apple.com/us/app/%ED%94%8C%EB%9E%9C%ED%95%8F-%EC%9A%B4%EB%8F%99-%EB%A3%A8%ED%8B%B4-%EC%B6%94%EC%B2%9C%EA%B3%BC-%ED%97%AC%EC%8A%A4-%ED%99%88%ED%8A%B8-%EB%8B%A4%EC%9D%B4%EC%96%B4%ED%8A%B8-%EA%B8%B0%EB%A1%9D/id1511876936?l=vi), [App Pricing Lab: Planfit](https://apppricinglab.com/app/apple/1511876936)
- [Caloer trên App Store VN](https://apps.apple.com/vn/app/id6474173293), [MyFitnessPal trên App Store VN](https://apps.apple.com/vn/app/myfitnesspal/id341232718?l=vi), [Eatsy](https://apps.apple.com/app/id1537221492)

**KOL, ASO, tỉ giá**
- [Heepsy: TikTok fitness Việt Nam](https://www.heepsy.com/en/find-influencers/tiktok/fitness/vietnam), [Heepsy: TikTok gym Việt Nam](https://www.heepsy.com/en/find-influencers/tiktok/gym/vietnam)
- [AppDrift: ASO Health & Fitness Việt Nam](https://appdrift.co/app-store-optimization/vietnam/health-fitness)
- [Ken Research: Vietnam Digital Wellness & Fitness Apps Market](https://www.kenresearch.com/vietnam-digital-wellness-fitness-apps-market), [BlueWeave: Vietnam Fitness App Market](https://www.blueweaveconsulting.com/press-release/vietnam-fitness-app-market-size-zooming-4-4x-to-touch-usd-21-4-billion-by-2031)
- [Vietbao: tỷ giá USD 4/11](https://vietbao.vn/ty-gia-usd-hom-nay-411-ty-gia-trung-tam-o-muc-25630-dongusd-614443.html)

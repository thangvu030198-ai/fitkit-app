# TapEasy: nội dung đăng App Store và Google Play (v2.0.0)

> **Đổi thương hiệu 11/2026:** FIT KIT → **TapEasy** ("Tập" + "Easy" = tập dễ dàng). Logo, màu, icon: xem `docs/BRAND.md`; icon store `assets/icon-1024.png`, feature graphic dùng `assets/brand/logo-lockup-light.svg`. Bundle ID / package (`vn.thangvu.fitkit`) **giữ nguyên** — đổi tên hiển thị không cần tạo app mới.

> Bản tiếng Việt là bản chính (thị trường VN). Bản tiếng Anh dùng cho localization English (U.S.) và English (U.K.).
> Mọi tính năng nêu ở đây đều **đã có trong mã nguồn hiện tại** (index.html, app.js, templates.js, meals.js, nutrition.js, coach.js, pt.js, library.js, freevideos.js). Tính năng **chưa có thì không quảng bá**: "Tìm & Book PT" (đang ghi *Sắp ra mắt*), thanh toán/gói trả phí, đẩy thông báo tức thì từ PT sang học viên khi app đóng.
> Độ dài ký tự đã đếm bằng script (`len()` Python). Số trong ngoặc là số ký tự / giới hạn.

---

> **R3 (14/11/2026):** bản **dán sẵn từng ô** nằm ở thư mục `store/` (`store/README.md`), sinh từ tài liệu này với 3 chỉnh sửa cho bản store: bỏ “Facebook” khỏi câu đăng nhập (SDK Facebook native chưa cấu hình), sửa câu “số liệu sức khoẻ chỉ lưu trên máy” thành “…chỉ gửi cho PT khi bạn chọn chia sẻ” (khớp Data safety), thêm câu miễn trừ y khoa cuối mô tả. Kích thước ảnh + script chụp: `store/screenshots/README.md`. Danh sách kiểm: `docs/RELEASE-CHECKLIST.md`.

## 0. Kiểm tra trước khi nộp (chặn phát hành nếu chưa xong)

| # | Việc | Vì sao |
|---|---|---|
| 1 | Điền `firebase-config.js` (đang để trống, app chạy **chế độ demo**) | Ở chế độ demo, PT và học viên trên 2 máy **không thấy dữ liệu của nhau**. Mô tả store đang hứa tính năng kết nối PT nên bắt buộc phải bật Firebase. |
| 2 | Tạo tài khoản demo cho người duyệt Apple (1 PT + 1 học viên mẫu đã nối mã) | Mục *App Review Information → Sign-in required*. |
| 3 | URL chính sách bảo mật: `https://thangvu030198-ai.github.io/fitkit-app/privacy-policy.html` | Cả hai store đều bắt buộc. |
| 4 | URL xoá tài khoản: `https://thangvu030198-ai.github.io/fitkit-app/delete-account.html` | Google Play → Data safety → Delete account URL. |
| 5 | URL marketing / trang giới thiệu: `https://thangvu030198-ai.github.io/fitkit-app/landing.html` | App Store → Marketing URL; Google Play → Website. |
| 6 | Email hỗ trợ riêng (VD `support@…`) | Không nên dùng email cá nhân trên trang store công khai. |

---

## 1. Tên app, phụ đề, mô tả ngắn

### Tiếng Việt

| Trường | Nội dung | Ký tự |
|---|---|---|
| **Tên app** (App Store + Google Play) | `TapEasy: Tập Gym, Calo & PT` | 27/30 |
| Tên dự phòng (nếu trùng) | `TapEasy – Giáo án Gym & PT` | 26/30 |
| Tên dự phòng 2 (nhấn thông điệp thương hiệu) | `TapEasy – Tập gym dễ dàng` | 25/30 |
| **Phụ đề** (App Store) | `Giáo án, ghi tạ, thực đơn Việt` | 30/30 |
| Phụ đề phương án B (A/B test sau 2 tuần) | `Giảm mỡ, tăng cơ, tính TDEE` | 27/30 |
| **Mô tả ngắn** (Google Play) | `Giáo án gym hiện đại, ghi tạ tự tăng tiến, tính calo món Việt và kết nối PT.` | 76/80 |
| **Văn bản quảng cáo** (App Store, sửa được không cần duyệt) | `Miễn phí cho người tập. 15 giáo án hiện đại, app tự tăng tạ khi bạn đủ sức, thực đơn món Việt theo BMI và kết nối PT bằng mã 6 ký tự.` | 133/170 |

### English

| Field | Text | Chars |
|---|---|---|
| **App name** | `TapEasy: Gym Log, Diet & Coach` | 30/30 |
| **Subtitle** | `Workout plans, meals & lifts` | 28/30 |
| **Short description** (Google Play) | `Modern gym plans, auto-progressing lift log, Vietnamese meal plans & PT link.` | 77/80 |
| **Promotional text** | `Free for lifters. 15 modern programs, auto weight progression, Vietnamese meal plans by BMI, and a 6-character code to connect with your personal trainer.` | 154/170 |

**Lý do chọn tên:** "TapEasy" đứng đầu để người dùng nhận ra thương hiệu (trùng tên trên icon, 7 ký tự — vừa nhãn dưới icon iOS/Android không bị cắt). "Tập Gym", "Calo", "PT" là 3 cụm người Việt gõ nhiều nhất khi tìm app loại này (tập gym, tính calo, PT online). Apple lập chỉ mục cả tên lẫn phụ đề, nên không lặp lại các từ này trong ô từ khoá.

---

## 2. Từ khoá App Store (ô Keywords, ≤ 100 ký tự)

### Nghiên cứu (11/2026, thị trường VN)

Nguồn tham khảo: trang App Store VN của các app cạnh tranh (Planfit, Workout Planner Muscle Booster, Tập Thể Hình – Gym Workout, GymStreak, Caloer, Eatsy, MyFitnessPal), bảng xếp hạng nhà sáng tạo fitness/gym trên TikTok VN (Heepsy, 2026), bài báo về giá PT và thị trường gym VN (VnExpress, CareerLink, Tiền Phong 2026). Không có số liệu Google Trends 2026 công khai cho từng từ khoá, nên mức ưu tiên dưới đây là **ước lượng định tính**. Nên kiểm tra lại bằng Apple Search Ads (Search popularity) sau khi có tài khoản.

| Nhóm ý định | Cụm người dùng gõ | Đã có ở | Đưa vào Keywords |
|---|---|---|---|
| Tập gym | tập gym, lịch tập gym, giáo án gym, tập gym cho người mới | Tên (Tập, Gym) + Phụ đề (Giáo án) | `lịch` |
| Giảm cân / giảm mỡ | giảm cân, giảm mỡ, thực đơn giảm cân, eat clean | Phụ đề (thực đơn) | `giảm,cân,mỡ,eat,clean` |
| Tăng cơ | tăng cơ, tăng cân, thể hình | – | `tăng,cơ,thể,hình` |
| Calo | tính calo, đếm calo, TDEE, BMI, dinh dưỡng | Tên (Calo) | `tính,đếm,TDEE,BMI,dinh,dưỡng` |
| PT | PT, huấn luyện viên cá nhân, PT online | Tên (PT) | `huấn,luyện,viên` |
| Nữ / tại nhà | tập mông, tập tại nhà | Tên (Tập) | `mông,nhà` |

**Nguyên tắc:** viết từng âm tiết, phân cách bằng dấu phẩy, không dấu cách. Apple tự ghép từ giữa tên, phụ đề và ô từ khoá, nên `giảm` + `cân` khớp "giảm cân", còn `lịch` + "Tập" (ở tên) khớp "lịch tập". Không dùng tên thương hiệu đối thủ (vi phạm điều 2.3.7).

### Chuỗi đề xuất

| Localization | Keywords | Ký tự |
|---|---|---|
| **Tiếng Việt** (chính) | `giảm,cân,tăng,cơ,mỡ,tính,đếm,TDEE,BMI,dinh,dưỡng,huấn,luyện,viên,lịch,thể,hình,nhà,mông,eat,clean` | 97/100 |
| Tiếng Việt, bản rút gọn (nếu App Store Connect đếm theo byte và báo vượt) | `giảm,cân,tăng,cơ,mỡ,TDEE,BMI,dinh,dưỡng,lịch,thể,hình,nhà,mông,đếm,tính` | 71 ký tự / 92 byte |
| **English (U.S.)** | `workout,planner,tracker,calorie,counter,weight,loss,muscle,trainer,personal,macro,strength,1RM,home` | 99/100 |
| Phương án không dấu (đặt ở localization phụ nếu storefront VN có lập chỉ mục thêm ngôn ngữ đó; kiểm tra trong tài liệu "Localizations by storefront" của Apple) | `giam can,tang co,giam mo,tap gym,tinh calo,lich tap,giao an,thuc don,the hinh,huan luyen vien` | 93/100 |

> Google Play không có ô từ khoá: thuật toán đọc **tên + mô tả ngắn + mô tả đầy đủ**. Mô tả đầy đủ bên dưới đã lặp tự nhiên các cụm "giáo án gym", "tính calo", "món Việt", "giảm mỡ", "tăng cơ", "PT", "học viên" (3–5 lần mỗi cụm, không nhồi).

---

## 3. Mô tả đầy đủ

### 3.1 Tiếng Việt (3.344/4.000 ký tự)

```text
TapEasy là app tập gym tiếng Việt cho cả người tự tập và PT: giáo án gym hiện đại, ghi tạ từng hiệp, tính calo món Việt và kết nối PT với học viên trong cùng một app. Tập cá nhân miễn phí, không cần tạo tài khoản.

★ GIÁO ÁN GYM HIỆN ĐẠI: CHỌN LÀ TẬP
• 15 giáo án mẫu cho Nam, Nữ và Nam & Nữ, đủ 3 cấp độ: Mới tập, Trung bình, Nâng cao.
• Full Body, Upper/Lower, ULPPL, PPL 6 buổi, Powerbuilding, Glute Focus (tập mông), Hybrid tạ + chạy, Zone 2, đi bộ dốc 12-3-30, tập tại nhà với tạ đơn.
• Soạn theo nguyên tắc tập hiện đại: dừng cách thất bại 1–2 lần (RIR), tăng tiến kép, giảm tải mỗi 5–6 tuần.
• Bấm "Thêm vào tuần tập", app tạo lịch 7 ngày và tự gắn video hướng dẫn cho các bài có video.
• Muốn tự soạn? Tạo chương trình riêng, thêm bài, đổi số hiệp, số lần, thời gian nghỉ.

★ GHI TẠ THÔNG MINH, TỰ TĂNG TIẾN
• Ghi kg × số lần × RPE cho từng hiệp, số liệu buổi trước được điền sẵn.
• Đạt đỉnh khoảng lần ở mọi hiệp thì app tự tăng 1 nấc tạ. Trượt mục tiêu 2 buổi liền thì app giảm 10% để bạn lấy lại đà.
• Đồng hồ nghỉ giữa hiệp có rung và âm báo, vẫn báo khi điện thoại đã khoá màn hình.
• Tính sẵn các hiệp khởi động và cách lắp đĩa tạ cho thanh đòn 20 kg.
• Biểu đồ 1RM ước tính, kỷ lục cá nhân, chuỗi ngày tập liên tiếp.

★ TÍNH CALO MÓN VIỆT, THỰC ĐƠN THEO BMI
• Tính BMR (Mifflin-St Jeor), TDEE, calo mục tiêu và đạm, tinh bột, chất béo cho mục tiêu giảm mỡ, duy trì hoặc tăng cơ.
• Ghi bữa ăn với gần 100 thực phẩm và món quen thuộc: phở, bún bò, cơm tấm, bánh mì, xôi, trà sữa… Gõ không dấu cũng tìm được: "uc ga" ra "Ức gà".
• 45 công thức (27 món Việt, 18 món Âu) có định lượng theo gram và cách làm bằng nồi chiên không dầu, nồi cơm điện, hấp, luộc. Có món chay, thuần chay và món rẻ cho sinh viên.
• Thực đơn 7 ngày gợi ý theo BMI chuẩn người châu Á và mục tiêu của bạn. Chọn món Việt hoặc món Âu, lọc món chay, ghi cả ngày vào nhật ký chỉ bằng 1 chạm.
• Theo dõi nước uống và giấc ngủ 7 ngày.

★ PT VÀ HỌC VIÊN: GỌN TRONG MỘT FORM
Dành cho PT:
• Thêm học viên, app tạo mã mời 6 ký tự để gửi qua Zalo, Messenger.
• Mỗi học viên có một form 7 mục: Thông tin, Buổi này tập gì, Thời khoá biểu, Lịch sử, Nhắc nhở, Ghi chú, Tiến độ.
• Soạn buổi tập từ thư viện bài tập, lặp lịch hằng tuần đến 12 tuần, chọn tập tại phòng hoặc online.
• Theo dõi gói buổi (báo khi gói sắp hết), chuyên cần và biểu đồ số buổi 8 tuần.
Dành cho học viên:
• Nhập mã PT là thấy lịch tập, bài được giao kèm video, đánh dấu hoàn thành buổi và gửi phản hồi cho PT.

★ THƯ VIỆN 800+ BÀI TẬP VÀ VIDEO HƯỚNG DẪN
• Hơn 800 bài tập có hình minh hoạ, chia theo nhóm cơ, lọc theo dụng cụ và cấp độ.
• Video hướng dẫn kỹ thuật xem ngay trong bài tập. Bạn cũng có thể tải clip tự quay để gắn vào từng bài.

★ TIẾN TRÌNH VÀ NHẮC NHỞ
• Ảnh tiến trình có khung căn góc chụp, so sánh trước và sau. Lưu chỉ số InBody và xem biểu đồ.
• Nhắc giờ tập, giờ ăn, giờ ngủ và buổi với PT bằng thông báo của điện thoại, kể cả khi app đã đóng.

★ QUYỀN RIÊNG TƯ
• Số liệu sức khoẻ (cân nặng, calo, giấc ngủ, ảnh) chỉ lưu trên máy của bạn.
• Chỉ cần tài khoản khi kết nối PT. Đăng nhập bằng email, Google, Facebook hoặc Apple. Xoá tài khoản ngay trong app.
• Không quảng cáo, không bán dữ liệu.

TapEasy dùng công thức và khuyến nghị có cơ sở khoa học (Mifflin-St Jeor, ISSN, USDA). Các con số chỉ là ước lượng tham khảo, không thay thế tư vấn của bác sĩ hay chuyên gia dinh dưỡng.
```

### 3.2 English (3.504/4.000 characters)

```text
TapEasy is a gym app built for both self-trainers and personal trainers: modern workout programs, set-by-set lift logging, Vietnamese calorie tracking and a PT-to-client link, all in one app. Training on your own is free and needs no account.

★ MODERN GYM PROGRAMS, READY TO GO
• 15 programs for men, women and everyone, across 3 levels: Beginner, Intermediate, Advanced.
• Full Body, Upper/Lower, ULPPL, 6-day PPL, Powerbuilding, Glute Focus, Hybrid lifting + running, Zone 2, 12-3-30 incline walking, and home workouts with dumbbells.
• Built on current training principles: stop 1–2 reps short of failure (RIR), double progression, a deload every 5–6 weeks.
• Tap "Add to my week" and TapEasy builds your 7-day schedule and attaches technique videos where available.
• Prefer your own plan? Create programs, add exercises, set sets, reps and rest.

★ SMART LIFT LOG WITH AUTO PROGRESSION
• Log kg × reps × RPE for every set, pre-filled from your last session.
• Hit the top of the rep range on every set and the app adds one weight step. Miss your target two sessions in a row and it drops 10% so you can rebuild momentum.
• Rest timer with vibration and sound that still alerts you when the phone is locked.
• Warm-up set calculator and a barbell plate calculator (20 kg bar).
• Estimated 1RM chart, personal records and workout streaks.

★ VIETNAMESE FOOD CALORIES AND BMI-BASED MEAL PLANS
• BMR (Mifflin-St Jeor), TDEE, calorie target and protein, carbs and fat for fat loss, maintenance or muscle gain.
• Log meals from nearly 100 foods and everyday dishes: pho, bun bo, com tam, banh mi, sticky rice, bubble tea… Search works without Vietnamese accents.
• 45 recipes (27 Vietnamese, 18 Western) with gram-level portions and air fryer, rice cooker, steaming or boiling methods. Includes vegetarian, vegan and budget student options.
• A 7-day meal plan suggested from your BMI (Asian cut-offs) and your goal. Choose Vietnamese or Western dishes, filter vegetarian, and log a whole day in one tap.
• Water and 7-day sleep tracking.

★ PERSONAL TRAINER AND CLIENT IN ONE FORM
For trainers:
• Add a client and get a 6-character invite code to send via Zalo or Messenger.
• Each client has a 7-tab form: Info, Today's session, Schedule, History, Reminders, Notes, Progress.
• Build sessions from the exercise library, repeat weekly for up to 12 weeks, in the gym or online.
• Track session packages (with a low-balance warning), attendance and an 8-week chart.
For clients:
• Enter your trainer's code to see your schedule and assigned exercises with videos, mark sessions done and send feedback.

★ 800+ EXERCISE LIBRARY AND TECHNIQUE VIDEOS
• Over 800 illustrated exercises grouped by muscle, filterable by equipment and level.
• Technique videos play right inside the exercise. You can also upload your own clips and attach them to any exercise.

★ PROGRESS AND REMINDERS
• Progress photos with an angle guide and before/after comparison. Log InBody results and view the chart.
• Workout, meal, bedtime and PT-session reminders as native phone notifications, even when the app is closed.

★ PRIVACY
• Health data (weight, calories, sleep, photos) stays on your device.
• An account is only needed to connect with a trainer. Sign in with email, Google, Facebook or Apple, and delete your account in the app.
• No ads, no data selling.

TapEasy uses evidence-based formulas and guidelines (Mifflin-St Jeor, ISSN, USDA). All numbers are estimates and do not replace advice from a doctor or dietitian.
```

---

## 4. "Có gì mới" (What's New), phiên bản 2.0.0

### Tiếng Việt, bản App Store (giới hạn 4.000; bản này 636 ký tự)

```text
TapEasy 2.0 (tên mới của FIT KIT): bản lớn nhất từ trước đến nay
• Kết nối PT và học viên bằng mã 6 ký tự, form quản lý 7 mục, lịch lặp hằng tuần, gói buổi.
• 15 giáo án gym hiện đại cho Nam/Nữ, 3 cấp độ, thêm vào tuần tập bằng 1 chạm và tự gắn video.
• Ghi kg × lần × RPE từng hiệp, app tự tăng hoặc giảm tạ, đồng hồ nghỉ báo cả khi khoá màn hình.
• Thực đơn 7 ngày theo BMI với 45 món Việt và Âu, có món chay, ghi cả ngày bằng 1 chạm.
• Thư viện 800+ bài tập, biểu đồ 1RM và kỷ lục cá nhân.
• Đăng nhập Apple, Google, Facebook; xoá tài khoản ngay trong app.
Góp ý của bạn giúp TapEasy tốt hơn mỗi tuần. Cảm ơn bạn đã tập cùng TapEasy!
```

### English, App Store version (702 characters)

```text
TapEasy 2.0 (formerly FIT KIT): our biggest update yet
• Connect trainers and clients with a 6-character code, a 7-tab client form, weekly repeating schedules and session packages.
• 15 modern gym programs for men and women at 3 levels, added to your week in one tap with videos attached.
• Log kg × reps × RPE per set; the app raises or lowers the weight for you; the rest timer alerts you even on a locked screen.
• 7-day meal plans by BMI with 45 Vietnamese and Western recipes, vegetarian filter, log a full day in one tap.
• 800+ exercise library, estimated 1RM chart and personal records.
• Sign in with Apple, Google or Facebook; delete your account in the app.
Thanks for training with TapEasy!
```

### Bản Google Play (release notes giới hạn **500 ký tự** mỗi ngôn ngữ)

Tiếng Việt (428/500):

```text
TapEasy 2.0 — tên mới của FIT KIT
• Kết nối PT và học viên bằng mã 6 ký tự, form 7 mục, lịch lặp tuần.
• 15 giáo án gym hiện đại, thêm vào tuần tập 1 chạm, tự gắn video.
• Ghi kg × lần × RPE, app tự tăng/giảm tạ, đồng hồ nghỉ báo cả khi khoá màn hình.
• Thực đơn 7 ngày theo BMI với 45 món Việt và Âu, có món chay.
• Thư viện 800+ bài tập, biểu đồ 1RM, kỷ lục cá nhân.
• Đăng nhập Apple/Google/Facebook, xoá tài khoản trong app.
```

English (476/500):

```text
TapEasy 2.0 (formerly FIT KIT)
• Connect trainers and clients with a 6-character code, 7-tab form, weekly schedules.
• 15 modern gym programs, added to your week in one tap with videos.
• Log kg × reps × RPE; auto weight progression; rest alerts on a locked screen.
• 7-day BMI-based meal plans, 45 Vietnamese and Western recipes, vegetarian filter.
• 800+ exercises, estimated 1RM chart, personal records.
• Sign in with Apple/Google/Facebook; delete your account in the app.
```

Mẫu cho các bản cập nhật sau (giữ giọng ngắn, bắt đầu bằng lợi ích): `Mới: … · Cải thiện: … · Sửa lỗi: …` (3–5 dòng).

---

## 5. Danh mục, phân loại độ tuổi, thông tin khác

| Mục | App Store | Google Play |
|---|---|---|
| Danh mục chính | **Health & Fitness** (Sức khoẻ & Thể hình) | **Health & Fitness** |
| Danh mục phụ | **Food & Drink** (Đồ ăn & Đồ uống): thực đơn, công thức, calo là điểm khác biệt, ít đối thủ gym hơn ở danh mục này | Thẻ (tags): Workout tracker, Calorie counter, Personal trainer, Diet & nutrition, Exercise |
| Giá | Miễn phí, không mua trong app (bản 2.0 chưa có thanh toán) | Miễn phí, không quảng cáo → trả lời "No" cho *Contains ads* |
| Độ tuổi | Trả lời bảng câu hỏi trung thực: không bạo lực, không nội dung người lớn, không cờ bạc. Có **chủ đề sức khoẻ/thể hình**, **chat PT ↔ học viên** (chỉ 2 người đã nối mã) và **nội dung người dùng công khai** (routine, đánh giá, ảnh sự kiện — có báo cáo, chặn người dùng, kiểm duyệt). Kết quả dự kiến **13+**. Nếu hệ thống tính thấp hơn, dùng tuỳ chọn nâng mức tuổi lên **13+** cho khớp chính sách bảo mật (không dành cho trẻ dưới 13). | Bảng IARC: dự kiến **PEGI 3 / Everyone**, kèm mô tả tương tác *Users Interact*. **Target audience:** chọn 13–15, 16–17, 18+ (không chọn dưới 13 để tránh chính sách Families). |
| Quyền riêng tư | **Điền theo bảng đầy đủ ở `docs/STORE-COMPLIANCE.md` §1 "App Privacy" (khai lại 11/2026)**: Name, Email, Phone, Physical Address (giao hàng), Purchase History, Photos/Videos (một phần công khai), in-app messages (chat PT ↔ học viên + ảnh), Customer Support, Other User Content (routine, đánh giá, bình luận công khai), Fitness, Health (chỉ khi học viên chia sẻ với PT / tự bật AI), User ID. Không tracking. | Data safety: theo `STORE-COMPLIANCE.md` §2.2 (Address, Phone, Purchase history, Messages, Photos & Videos, UGC…) + *Data is encrypted in transit: Yes* + *Users can request deletion: Yes* + Delete account URL; nêu đơn hàng được giữ ẩn danh cho kế toán. |
| Bản quyền | © 2026 TapEasy | – |
| Liên hệ | Support URL: trang landing (mục FAQ) + email hỗ trợ | Email bắt buộc, website = landing.html |

---

## 6. Kịch bản 8 ảnh chụp màn hình

**Kích thước:** App Store iPhone 6.9" `1320 × 2868` (hoặc 6.7" `1290 × 2796`; Apple tự thu nhỏ cho máy nhỏ hơn). Google Play `1080 × 1920` trở lên (tỉ lệ 9:16), cộng **feature graphic** `1024 × 500`.
**Phong cách chung:** nền navy `#061A24`, 2 vệt sáng mờ teal `#02BCB3` (góc trên trái) và coral `#FF7A45` (góc dưới phải), khung điện thoại không viền, bo 56 px. Tiêu đề Inter Tight 700, cỡ 96–110 px, tối đa 2 dòng, đặt ở 1/4 trên. Phụ đề Inter 500, cỡ 44 px, màu `rgba(255,255,255,.72)`. **Từ khoá nhấn** tô mint. Không nhồi quá 7 từ ở tiêu đề.
**Dữ liệu mẫu cần chuẩn bị (máy chụp):** hồ sơ "Minh, Nam, 26 tuổi, 172 cm, 74 kg, mục tiêu Giảm mỡ"; giáo án "Upper / Lower 4 buổi" đang dùng; 3–4 buổi đã ghi tạ cho Đẩy ngực/Squat (để có biểu đồ + kỷ lục); nhật ký ăn hôm nay có Phở bò + Cơm tấm; tài khoản PT có 3 học viên, 1 học viên có 6/12 buổi.

| # | Màn hình (cách mở trong app) | Tiêu đề trên ảnh (VI) | Phụ đề (VI) | Tiêu đề (EN) | Ghi chú dàn trang |
|---|---|---|---|---|---|
| 1 | **Trang chủ** (`goto('home')`): lời chào, dải 7 ngày, thẻ "Buổi hôm nay" có vòng %, 3 vòng calo/nước/ngủ | Tập đúng. Ăn đúng. **Tiến bộ thật.** | Giáo án, calo, giấc ngủ và PT trong một app | Train right. Eat right. **Really progress.** | Ảnh mở đầu quyết định lượt tải: thêm huy hiệu nhỏ "Miễn phí · Tiếng Việt" ở góc trên. |
| 2 | **Giáo án mẫu** (Tập luyện → *Giáo án mẫu*), bộ lọc Nữ + Mới tập đang bật, 3 thẻ giáo án hiện rõ | **15 giáo án gym** hiện đại | Nam · Nữ · 3 cấp độ. 1 chạm là có lịch tuần | **15 modern** gym programs | Phóng to thẻ "Glute Focus Upper/Lower 4 buổi" tràn nhẹ khỏi khung để tạo chiều sâu. |
| 3 | **Đang tập** (Bắt đầu tập → bài Đẩy ngực): bảng hiệp kg/lần/RPE, khung xanh "app đã tự tăng lên 62,5 kg", đồng hồ nghỉ đang đếm | App **tự tăng tạ** khi bạn đủ sức | Ghi kg × lần × RPE, điền sẵn buổi trước | The app **adds weight** when you're ready | Thêm mũi tên chú thích chỉ vào dòng "+2,5 kg". |
| 4 | **Chi tiết bài + video** (chạm 1 bài → video đang phát) chồng lên **Thư viện bài tập** theo nhóm cơ | **800+ bài tập** có video hướng dẫn | Đúng kỹ thuật ngay trong buổi tập | **800+ exercises** with technique videos | Dùng video YMove/wger (có dòng ghi nguồn, giữ nguyên). |
| 5 | **Dinh dưỡng**: đồng hồ calo, thanh macro, bữa trưa có Phở bò + ảnh món thật; ô tìm kiếm gõ "com tam" | Tính calo **món Việt** | Phở, cơm tấm, bánh mì… gõ không dấu cũng ra | Calories for **Vietnamese food** | Hiện 2–3 ảnh món tách nền nổi ra ngoài khung. |
| 6 | **Thực đơn gợi ý** (Dinh dưỡng → thẻ BMI + thực đơn T2–CN) | Thực đơn **theo BMI** của bạn | Món Việt hoặc Âu, có món chay, ghi 1 chạm | Meal plans **based on your BMI** | Làm nổi nút "Ghi vào hôm nay" bằng viền coral. |
| 7 | **PT & Học viên**: bên trái danh sách học viên, bên phải form học viên tab "Tiến độ" (gói 6/12 buổi, biểu đồ 8 tuần) + thẻ mã mời `K7Q2PX` | **PT giao bài**, học viên tập theo | Mã mời 6 ký tự · lịch lặp tuần · gói buổi | **Trainers assign**, clients follow | Ghép 2 điện thoại lệch nhau; nhãn nhỏ "Dành cho PT" / "Dành cho học viên". |
| 8 | **Tiến trình**: thẻ Kỷ lục cá nhân + biểu đồ 1RM (sheet lịch sử bài), góc dưới là thông báo nhắc "Đến giờ tập rồi" | Thấy rõ **mình mạnh lên** | Biểu đồ 1RM, kỷ lục, ảnh trước/sau, nhắc tập | See yourself **get stronger** | Ảnh kết, thêm dòng nhỏ "Dữ liệu sức khoẻ lưu trên máy bạn". |

**Feature graphic Google Play (1024 × 500):** logo TapEasy xếp chồng bản nền tối (`assets/brand/logo-lockup-light.svg`) bên trái + câu "Tập dễ dàng. Ăn đúng. Tiến bộ thật." + 2 điện thoại (màn 1 và 3) bên phải. Không đặt chữ quan trọng ở 15% mép (Google có thể phủ nút Play).

**Thử nghiệm A/B (Google Play Store listing experiments / Apple Product Page Optimization), sau 2 tuần có dữ liệu:**
- Ảnh 1: "Tập đúng. Ăn đúng." *so với* "Tập gym có giáo án, **miễn phí**".
- Đổi thứ tự ảnh 3 ↔ 5 (người giảm cân quan tâm calo trước tạ).

---

## 7. Video preview 30 giây

### 7.1 Bản App Store (App Preview: chỉ dùng hình quay màn hình app, có thể thêm chữ; dọc 886 × 1920 hoặc 1080 × 1920)

| Thời điểm | Hình | Chữ trên màn | Âm thanh |
|---|---|---|---|
| 0–3 s | Trang chủ hiện ra, vòng "Buổi hôm nay" chạy từ 0 → 75% | **Tập gym có giáo án?** | Beat điện tử 110–120 BPM, vào trống ở 0,5 s |
| 3–7 s | Mở *Giáo án mẫu* → lọc Nữ → bấm "Thêm vào tuần tập" → toast "x/y bài có video" | 15 giáo án hiện đại · 1 chạm | Tiếng "tách" khi bấm |
| 7–12 s | Đang tập: nhập 60 kg × 10, đánh dấu hiệp → đồng hồ nghỉ đếm → khung "tự tăng lên 62,5 kg" | App **tự tăng tạ** cho bạn | Tiếng bíp nghỉ hết giờ (lấy từ app) |
| 12–15 s | Lịch sử bài: biểu đồ 1RM đi lên, toast "Kỷ lục mới" | Thấy rõ mình mạnh lên | Nhấn nhạc |
| 15–20 s | Dinh dưỡng: gõ "pho bo" không dấu → thêm → đồng hồ calo tăng; lướt thực đơn T2→T4 | Calo **món Việt** · thực đơn theo BMI | – |
| 20–26 s | Khu PT: tạo học viên → mã `K7Q2PX` → bấm Gửi (bảng chia sẻ) → form học viên tab Tiến độ | PT giao bài, học viên tập theo | – |
| 26–30 s | Màn logo TapEasy (`splash-dark.png`) trên nền navy, quầng teal | **Miễn phí · Tiếng Việt** · Tải ngay | Nhạc kết, 0,5 s im lặng cuối |

Ghi chú: Apple chọn khung "poster frame" (ảnh tĩnh khi chưa phát): đặt ở giây 8 (màn tự tăng tạ, nhiều chữ nhất). Không quay tay người, không ảnh ngoài app.

### 7.2 Bản Google Play / TikTok / Reels (được dùng người thật)

- **0–2 s, hook nói thẳng vào camera** (PT nam hoặc nữ, áo đồng phục phòng tập): *"Đi tập 3 tháng không lên tạ? Do bạn không ghi lại đó."*
- **2–10 s:** quay cận điện thoại giữa hiệp tạ, ghép màn hình app tự tăng 2,5 kg.
- **10–18 s:** cảnh ăn phở, cầm điện thoại ghi món, đồng hồ calo tăng.
- **18–26 s:** PT gửi mã cho học viên qua Zalo, học viên mở app thấy bài và video.
- **26–30 s:** logo + "Tải TapEasy miễn phí · link ở bio".
- Phụ đề tiếng Việt luôn bật (80% người xem lướt không bật tiếng). Tải lên YouTube (không công khai) để gắn vào Google Play.

---

## 8. Phản hồi đánh giá (mẫu trả lời review)

- **5★:** "Cảm ơn bạn! Nếu bạn đang tập cùng PT, thử gửi mã mời để PT giao bài ngay trong app nhé."
- **Lỗi/1–2★:** "Xin lỗi bạn vì trải nghiệm này. Bạn gửi giúp tên máy + bước gặp lỗi qua email hỗ trợ, team sẽ phản hồi trong 24 giờ và cập nhật bản sửa sớm nhất."
- **"Calo không chính xác":** "Số liệu calo lấy trung bình theo USDA nên phần ăn thực tế có thể khác. Bạn chỉnh được số gram khi thêm món để sát với khẩu phần của mình."

---

## Nguồn tham khảo dùng cho mục 2 và 6

- App Store VN, các app cạnh tranh: [Planfit](https://apps.apple.com/us/app/%ED%94%8C%EB%9E%9C%ED%95%8F-%EC%9A%B4%EB%8F%99-%EB%A3%A8%ED%8B%B4-%EC%B6%94%EC%B2%9C%EA%B3%BC-%ED%97%AC%EC%8A%A4-%ED%99%88%ED%8A%B8-%EB%8B%A4%EC%9D%B4%EC%96%B4%ED%8A%B8-%EA%B8%B0%EB%A1%9D/id1511876936?l=vi), [Workout Planner Muscle Booster](https://apps.apple.com/vn/app/id1446447749?l=vi), [Zing: Tập Luyện Tại Nhà & Gym](https://apps.apple.com/us/app/zing-t%E1%BA%ADp-luy%E1%BB%87n-t%E1%BA%A1i-nh%C3%A0-gym/id1552207792?l=vi), [Caloer – Tính Calo & Giảm Cân](https://apps.apple.com/vn/app/id6474173293), [Eatsy – Giảm cân Healthy](https://apps.apple.com/app/id1537221492), [MyFitnessPal VN](https://apps.apple.com/vn/app/myfitnesspal/id341232718?l=vi)
- Bài tổng hợp app tập ở VN: [Vietcetera](https://vietcetera.com/vn/4-ung-dung-suc-khoe-cho-mot-mua-he-rang-ro), [Viettablet](https://www.viettablet.com/app-tap-gym)
- Nhà sáng tạo nội dung gym/fitness trên TikTok VN: [Heepsy – fitness](https://www.heepsy.com/en/find-influencers/tiktok/fitness/vietnam), [Heepsy – gym](https://www.heepsy.com/en/find-influencers/tiktok/gym/vietnam)
- Thị trường ASO VN (Google Play chiếm ưu thế, cần dấu tiếng Việt đúng): [AppDrift – Health & Fitness Vietnam](https://appdrift.co/app-store-optimization/vietnam/health-fitness)

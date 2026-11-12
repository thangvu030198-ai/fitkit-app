# Ảnh có người → ảnh minh hoạ tạo bằng AI (TapEasy)

Mục tiêu: thay mọi ảnh tĩnh **có con người** lấy từ kho ảnh ngoài (Pexels) bằng ảnh tạo bằng AI (`gpt-image-2.5` qua API OpenAI-compatible), tránh rủi ro bản quyền / quyền hình ảnh của người mẫu.

**Không đụng:** video bài tập (YMove / wger / Pexels video + ảnh poster của video), ảnh bài tập free-exercise-db, ảnh món ăn, logo, ảnh sản phẩm Gian hàng (`assets/shop/*` — đã xem từng ảnh: chỉ sản phẩm, không có người), `assets/*.jpg|png` (logo, splash, og — không có người), poster clip màn chào (`media/welcome`, khung hình của video).

## Cách làm

- Danh sách prompt: `scripts/ai_people_prompts.json` (sinh ảnh: `scripts/gen_ai_images.py`, workflow `.github/workflows/media-people-ai.yml`).
- Ảnh ra: `media/people-ai/<id>.webp` (cạnh dài 1280) + `<id>-sm.webp` (cạnh dài 480) + `index.json` + `_review/contact-XX.jpg`.
- Gắn vào app: `people-ai.js` (nạp ngay sau `data.js`). Bảng `Pexels id → id ảnh AI`; `fkPeopleImg(urlCu, small)` trả URL `https://thangvu030198-ai.github.io/fitkit-app/media/people-ai/<id>(-sm).webp` khi `index.json` có id đó, ngược lại trả URL cũ. Khi index có ảnh: ghi đè `IMG.*`, `EXERCISES[*].img`, `HERO_CYCLE`, và đổi ảnh đang/ sắp hiển thị (thẻ `<img>`, `data-tm-src`, `background-image`) — dữ liệu seed giữ nguyên URL Pexels làm dự phòng; ảnh AI lỗi tải → tự quay về URL cũ.
- Credit: nơi trước ghi "Pexels" cho ảnh người (Tìm PT, Sự kiện/Khoảnh khắc) hiện **"Ảnh minh hoạ tạo bằng AI"** khi ảnh AI đang được dùng.

## Tổng hợp

| Nhóm | Số ảnh có người cần thay |
|---|---|
| Ảnh app (data.js IMG) | 12 |
| Sự kiện mẫu | 25 |
| Thử thách mẫu | 5 |
| Review sự kiện mẫu | 4 |
| Hồ sơ PT mẫu | 20 |
| Album PT mẫu | 98 |
| Ảnh đánh giá PT mẫu | 7 |
| **Tổng** | **171** |

| Khung | Số ảnh | Ước tính |
|---|---|---|
| 1024×1024 | 106 | 39.326 ₫ |
| 1536×1024 (ngang) | 40 | 22.260 ₫ |
| 1024×1536 (dọc, hero/bìa PT) | 25 | 13.912 ₫ |
| **Tổng** | **171** | **≈ 75.498 ₫** (≈ ₫371/ảnh 1024², ảnh 1536 ×1,5; chưa tính gen lại ảnh hỏng ~10–20%) |

Phong cách chung (chuỗi cuối mỗi prompt): ảnh thể thao chân thực kiểu điện ảnh, ánh sáng tự nhiên tương phản cao, tông lạnh teal/navy hợp UI tối; người Việt/Đông Nam Á, đa dạng giới tính, tuổi, vóc dáng (có người thừa cân, trung niên, cao tuổi); đồ tập trơn không logo/chữ; không người nổi tiếng; không chữ/watermark. `must_not` chung: không logo/chữ, không watermark, không giống người nổi tiếng, không ngón tay/tay chân biến dạng, không hình xăm chữ, không sai kỹ thuật (lưng cong khi deadlift, gối đổ vào trong), không hở hang.

## Bảng chi tiết

| id | Dùng ở đâu (file:dòng) | URL cũ (Pexels) | Có người? | Khung |
|---|---|---|---|---|
| `hero-workout-1` | Ảnh hero Tập luyện 1 (lực sĩ nam) — data.js:21; app.js (IMG.heroWorkout1 ×1); pt.js (IMG.heroWorkout1 ×1) | [38453108](https://images.pexels.com/photos/38453108/pexels-photo-38453108/free-photo-of-powerful-male-bodybuilder-in-black-and-white.jpeg?auto=compress&cs=tinysrgb&w=1080) | có | 1024×1536 |
| `hero-workout-2` | Ảnh hero Tập luyện 2 + bước 0 onboarding — data.js:22; app.js (IMG.heroWorkout2 ×2) | [29825227](https://images.pexels.com/photos/29825227/pexels-photo-29825227/free-photo-of-powerful-bodybuilder-at-the-gym-in-black-and-white.jpeg?auto=compress&cs=tinysrgb&w=1080) | có | 1024×1536 |
| `hero-workout-3` | Ảnh hero Tập luyện 3 + thẻ nhóm cơ Vai + nền màn chào dự phòng — data.js:23; app.js (IMG.heroWorkout3 ×1); pt.js (IMG.heroWorkout3 ×1); data.js:32; templates.js (IMG.muscle_shoulders ×2); data.js (IMG.muscle_shoulders ×3) | [31783554](https://images.pexels.com/photos/31783554/pexels-photo-31783554/free-photo-of-man-lifting-weights-in-gym-with-intensity.jpeg?auto=compress&cs=tinysrgb&w=1080) | có | 1024×1536 |
| `hero-workout-4` | Ảnh hero Tập luyện 4 + thẻ nhóm cơ Lưng — data.js:24; app.js (IMG.heroWorkout4 ×1); data.js:31; templates.js (IMG.muscle_back ×5); data.js (IMG.muscle_back ×4) | [38453228](https://images.pexels.com/photos/38453228/pexels-photo-38453228/free-photo-of-back-view-of-muscular-man-working-out-in-gym.jpeg?auto=compress&cs=tinysrgb&w=1080) | có | 1024×1536 |
| `sleep-hero` | Ảnh hero màn Giấc ngủ — data.js:27; app.js (IMG.heroSleep ×1) | [3465878](https://images.pexels.com/photos/3465878/pexels-photo-3465878.jpeg?auto=compress&cs=tinysrgb&w=1080) | có | 1024×1536 |
| `sleep-card` | Thẻ phụ màn Giấc ngủ — data.js:28 | [36933874](https://images.pexels.com/photos/36933874/pexels-photo-36933874/free-photo-of-relaxing-woman-resting-on-a-cozy-bed.jpeg?auto=compress&cs=tinysrgb&w=800) | có | 1536×1024 |
| `avatar-default` | Avatar mặc định hồ sơ — data.js:29; app.js (IMG.avatar ×1) | [36537691](https://images.pexels.com/photos/36537691/pexels-photo-36537691/free-photo-of-fit-masculine-athlete-in-studio-portrait.jpeg?auto=compress&cs=tinysrgb&w=400) | có | 1024×1024 |
| `muscle-chest` | Thẻ nhóm cơ Ngực (ảnh bài tập trong data.js/templates.js) — data.js:30; templates.js (IMG.muscle_chest ×4); data.js (IMG.muscle_chest ×4) | [17959564](https://images.pexels.com/photos/17959564/pexels-photo-17959564/free-photo-of-muscular-man-training-with-dumbbells.jpeg?auto=compress&cs=tinysrgb&w=600) | có | 1536×1024 |
| `muscle-legs` | Thẻ nhóm cơ Chân/Mông — data.js:33; templates.js (IMG.muscle_legs ×13); data.js (IMG.muscle_legs ×5) | [36387535](https://images.pexels.com/photos/36387535/pexels-photo-36387535/free-photo-of-woman-performing-squats-with-dumbbells-in-gym.jpeg?auto=compress&cs=tinysrgb&w=600) | có | 1536×1024 |
| `muscle-arms` | Thẻ nhóm cơ Tay — data.js:34; templates.js (IMG.muscle_arms ×3); data.js (IMG.muscle_arms ×4) | [37281143](https://images.pexels.com/photos/37281143/pexels-photo-37281143/free-photo-of-hand-gripping-dumbbell-in-dimly-lit-gym.jpeg?auto=compress&cs=tinysrgb&w=600) | có | 1536×1024 |
| `muscle-core` | Thẻ nhóm cơ Bụng/Core — data.js:35; app.js (IMG.muscle_core ×2); templates.js (IMG.muscle_core ×4); data.js (IMG.muscle_core ×4) | [4662331](https://images.pexels.com/photos/4662331/pexels-photo-4662331.jpeg?auto=compress&cs=tinysrgb&w=600) | có | 1536×1024 |
| `muscle-cardio` | Thẻ nhóm cơ Cardio — data.js:36; templates.js (IMG.muscle_cardio ×9); data.js (IMG.muscle_cardio ×4) | [28162956](https://images.pexels.com/photos/28162956/pexels-photo-28162956/free-photo-of-a-black-and-white-photo-of-a-man-running-on-a-track.jpeg?auto=compress&cs=tinysrgb&w=600) | có | 1536×1024 |
| `ev-run-dawn` | Sự kiện chạy Hồ Gươm — nhóm chạy bình minh — cloud-events.js:93 | [37191727](https://images.pexels.com/photos/37191727/pexels-photo-37191727.jpeg) | có | 1536×1024 |
| `ev-run-warmup` | Khởi động động cùng coach — cloud-events.js:95 | [17979277](https://images.pexels.com/photos/17979277/pexels-photo-17979277.jpeg) | có | 1536×1024 |
| `ev-run-bridge` | Nhóm chạy nhịp nhẹ trên cầu — cloud-events.js:96 | [5319396](https://images.pexels.com/photos/5319396/pexels-photo-5319396.jpeg) | có | 1536×1024 |
| `ev-group-outdoor` | Lớp tập nhóm ngoài trời có coach — cloud-events.js:105 | [31216262](https://images.pexels.com/photos/31216262/pexels-photo-31216262.jpeg) | có | 1536×1024 |
| `ev-group-jog` | Nhóm chạy tại chỗ khởi động — cloud-events.js:106 | [6150627](https://images.pexels.com/photos/6150627/pexels-photo-6150627.jpeg) | có | 1536×1024 |
| `ev-group-stretch` | Giãn cơ tay vai trong công viên — cloud-events.js:107 | [7266744](https://images.pexels.com/photos/7266744/pexels-photo-7266744.jpeg) | có | 1536×1024 |
| `ev-group-warmup` | Nhóm khởi động / giãn cơ sau buổi chạy — cloud-events.js:108; cloud-events.js:209 | [5319491](https://images.pexels.com/photos/5319491/pexels-photo-5319491.jpeg) | có | 1536×1024 |
| `ev-fit-row` | Thi thể lực trong nhà — chèo máy — cloud-events.js:117 | [29859465](https://images.pexels.com/photos/29859465/pexels-photo-29859465.jpeg) | có | 1536×1024 |
| `ev-fit-sled` | Đẩy xe trượt có HLV (sự kiện + album PT Kiều Anh Dũng) — cloud-events.js:118; cloud-pt-directory.js:553 (album seed_anhdung) | [32830368](https://images.pexels.com/photos/32830368/pexels-photo-32830368.jpeg) | có | 1536×1024 |
| `ev-fit-zone` | Khu máy SkiErg, chèo và tạ — cloud-events.js:119 | [9545914](https://images.pexels.com/photos/9545914/pexels-photo-9545914.jpeg) | có | 1536×1024 |
| `ev-fit-wallball` | Tập wall ball với bóng tạ — cloud-events.js:120 | [4853898](https://images.pexels.com/photos/4853898/pexels-photo-4853898.jpeg) | có | 1536×1024 |
| `ev-pl-deadlift` | Giải powerlifting — deadlift — cloud-events.js:129 | [16966303](https://images.pexels.com/photos/16966303/pexels-photo-16966303.jpeg) | có | 1536×1024 |
| `ev-pl-ready` | Vận động viên chuẩn bị, trọng tài theo dõi — cloud-events.js:130 | [16966307](https://images.pexels.com/photos/16966307/pexels-photo-16966307.jpeg) | có | 1536×1024 |
| `ev-pl-bar` | Deadlift với thanh đòn — cloud-events.js:131 | [841125](https://images.pexels.com/photos/841125/pexels-photo-841125.jpeg) | có | 1536×1024 |
| `ev-pl-woman` | Nữ vận động viên deadlift — cloud-events.js:132 | [13822300](https://images.pexels.com/photos/13822300/pexels-photo-13822300.jpeg) | có | 1536×1024 |
| `ev-ws-cooking` | Workshop dinh dưỡng — lớp thực hành nấu ăn — cloud-events.js:140 | [38939130](https://images.pexels.com/photos/38939130/pexels-photo-38939130.jpeg) | có | 1536×1024 |
| `ev-ws-menu` | Workshop — trao đổi thực đơn — cloud-events.js:142 | [8844379](https://images.pexels.com/photos/8844379/pexels-photo-8844379.jpeg) | có | 1536×1024 |
| `ev-picnic-group` | Picnic Ecopark — nhóm bạn trên bãi cỏ — cloud-events.js:151 | [35652755](https://images.pexels.com/photos/35652755/pexels-photo-35652755.jpeg) | có | 1536×1024 |
| `ev-picnic-lunch` | Picnic — bữa trưa cùng nhau — cloud-events.js:152 | [35773483](https://images.pexels.com/photos/35773483/pexels-photo-35773483.jpeg) | có | 1536×1024 |
| `ev-picnic-yoga` | Picnic — yoga nhẹ trên cỏ — cloud-events.js:153 | [1472887](https://images.pexels.com/photos/1472887/pexels-photo-1472887.jpeg) | có | 1536×1024 |
| `ev-run-mist` | Chạy Hồ Tây — runner trong sương sớm — cloud-events.js:161 | [29840338](https://images.pexels.com/photos/29840338/pexels-photo-29840338.jpeg) | có | 1536×1024 |
| `ev-yoga-park` | Yoga gia đình — nhóm tập ngoài trời — cloud-events.js:169 | [36715224](https://images.pexels.com/photos/36715224/pexels-photo-36715224.jpeg) | có | 1536×1024 |
| `ev-yoga-group` | Buổi yoga nhóm trong công viên — cloud-events.js:170 | [36715610](https://images.pexels.com/photos/36715610/pexels-photo-36715610.jpeg) | có | 1536×1024 |
| `ev-yoga-balance` | Tư thế thăng bằng bên hồ — cloud-events.js:171; cloud-events.js:211 | [8692128](https://images.pexels.com/photos/8692128/pexels-photo-8692128.jpeg) | có | 1536×1024 |
| `ev-yoga-autumn` | Review yoga — nhóm yoga mùa thu — cloud-events.js:210 | [36715608](https://images.pexels.com/photos/36715608/pexels-photo-36715608.jpeg) | có | 1536×1024 |
| `ch-gym-session` | Thử thách Buổi tập — tập tạ trong gym — cloud-events.js:180 | [703012](https://images.pexels.com/photos/703012/pexels-photo-703012.jpeg) | có | 1536×1024 |
| `ch-partners` | Thử thách — hai người tập cùng nhau — cloud-events.js:184 | [4944980](https://images.pexels.com/photos/4944980/pexels-photo-4944980.jpeg) | có | 1536×1024 |
| `ch-run-street` | Thử thách chạy — đoàn runner trên đường — cloud-events.js:162; cloud-events.js:185 | [2526885](https://images.pexels.com/photos/2526885/pexels-photo-2526885.jpeg) | có | 1536×1024 |
| `ch-water` | Thử thách uống nước — uống nước sau tập — cloud-events.js:189 | [4853255](https://images.pexels.com/photos/4853255/pexels-photo-4853255.jpeg) | có | 1536×1024 |
| `ch-scale` | Thử thách cân nặng — bước lên cân — cloud-events.js:193 | [6550832](https://images.pexels.com/photos/6550832/pexels-photo-6550832.jpeg) | có | 1536×1024 |
| `rv-medal` | Review chạy — khoe huy chương — cloud-events.js:206 | [1073101](https://images.pexels.com/photos/1073101/pexels-photo-1073101.jpeg) | có | 1536×1024 |
| `rv-finish-cheer` | Review chạy — ăn mừng vạch đích — cloud-events.js:207 | [17979591](https://images.pexels.com/photos/17979591/pexels-photo-17979591.jpeg) | có | 1536×1024 |
| `rv-crowd-warmup` | Review chạy — đông người khởi động — cloud-events.js:208 | [35812359](https://images.pexels.com/photos/35812359/pexels-photo-35812359.jpeg) | có | 1536×1024 |
| `rv-thumbs` | Review chạy — hai runner giơ ngón cái — cloud-events.js:208 | [2567044](https://images.pexels.com/photos/2567044/pexels-photo-2567044.jpeg) | có | 1536×1024 |
| `pt-khang` | PT Trần Minh Khang (nam · Tăng cơ,Sức mạnh,Giảm mỡ) — ảnh bìa + avatar — cloud-pt-directory.js:417 (cover seed_khang); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [6550865](https://images.pexels.com/photos/6550865/pexels-photo-6550865.jpeg) | có | 1024×1536 |
| `pt-khang-1` | Album PT Trần Minh Khang #1 — cloud-pt-directory.js:417 (album seed_khang) | [6550844](https://images.pexels.com/photos/6550844/pexels-photo-6550844.jpeg) | có | 1024×1024 |
| `pt-khang-2` | Album PT Trần Minh Khang #2 — cloud-pt-directory.js:417 (album seed_khang) | [6551087](https://images.pexels.com/photos/6551087/pexels-photo-6551087.jpeg) | có | 1024×1024 |
| `pt-khang-3` | Album PT Trần Minh Khang #3 — cloud-pt-directory.js:417 (album seed_khang) | [6550852](https://images.pexels.com/photos/6550852/pexels-photo-6550852.jpeg) | có | 1024×1024 |
| `pt-khang-4` | Album PT Trần Minh Khang #4 — cloud-pt-directory.js:417 (album seed_khang) | [6551437](https://images.pexels.com/photos/6551437/pexels-photo-6551437.jpeg) | có | 1024×1024 |
| `pt-khang-5` | Album PT Trần Minh Khang #5 — cloud-pt-directory.js:417 (album seed_khang) | [40371837](https://images.pexels.com/photos/40371837/pexels-photo-40371837.jpeg) | có | 1024×1024 |
| `pt-khang-6` | Album PT Trần Minh Khang #6 — cloud-pt-directory.js:417 (album seed_khang) | [6551078](https://images.pexels.com/photos/6551078/pexels-photo-6551078.jpeg) | có | 1024×1024 |
| `pt-khang-7` | Album PT Trần Minh Khang #7 — cloud-pt-directory.js:417 (album seed_khang) | [6550840](https://images.pexels.com/photos/6550840/pexels-photo-6550840.jpeg) | có | 1024×1024 |
| `pt-thuha` | PT Nguyễn Thu Hà (nữ · Yoga,Linh hoạt,Phục hồi) — ảnh bìa + avatar — cloud-pt-directory.js:425 (cover seed_thuha); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [7593038](https://images.pexels.com/photos/7593038/pexels-photo-7593038.jpeg) | có | 1024×1536 |
| `pt-thuha-1` | Album PT Nguyễn Thu Hà #1 — cloud-pt-directory.js:425 (album seed_thuha) | [7592348](https://images.pexels.com/photos/7592348/pexels-photo-7592348.jpeg) | có | 1024×1024 |
| `pt-thuha-2` | Album PT Nguyễn Thu Hà #2 — cloud-pt-directory.js:425 (album seed_thuha) | [7593040](https://images.pexels.com/photos/7593040/pexels-photo-7593040.jpeg) | có | 1024×1024 |
| `pt-thuha-3` | Album PT Nguyễn Thu Hà #3 — cloud-pt-directory.js:425 (album seed_thuha) | [7592357](https://images.pexels.com/photos/7592357/pexels-photo-7592357.jpeg) | có | 1024×1024 |
| `pt-thuha-4` | Album PT Nguyễn Thu Hà #4 — cloud-pt-directory.js:425 (album seed_thuha) | [7592425](https://images.pexels.com/photos/7592425/pexels-photo-7592425.jpeg) | có | 1024×1024 |
| `pt-thuha-5` | Album PT Nguyễn Thu Hà #5 — cloud-pt-directory.js:425 (album seed_thuha) | [7592757](https://images.pexels.com/photos/7592757/pexels-photo-7592757.jpeg) | có | 1024×1024 |
| `pt-phuc` | PT Lê Hoàng Phúc (nam · Giảm mỡ,Tăng cơ,Dinh dưỡng thể thao) — ảnh bìa + avatar — cloud-pt-directory.js:433 (cover seed_phuc); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [4854263](https://images.pexels.com/photos/4854263/pexels-photo-4854263.jpeg) | có | 1024×1536 |
| `pt-phuc-1` | Album PT Lê Hoàng Phúc #1 — cloud-pt-directory.js:433 (album seed_phuc) | [4853692](https://images.pexels.com/photos/4853692/pexels-photo-4853692.jpeg) | có | 1024×1024 |
| `pt-phuc-2` | Album PT Lê Hoàng Phúc #2 — cloud-pt-directory.js:433 (album seed_phuc) | [4853917](https://images.pexels.com/photos/4853917/pexels-photo-4853917.jpeg) | có | 1024×1024 |
| `pt-phuc-3` | Album PT Lê Hoàng Phúc #3 — cloud-pt-directory.js:433 (album seed_phuc) | [4853287](https://images.pexels.com/photos/4853287/pexels-photo-4853287.jpeg) | có | 1024×1024 |
| `pt-phuc-4` | Album PT Lê Hoàng Phúc #4 — cloud-pt-directory.js:433 (album seed_phuc) | [4853293](https://images.pexels.com/photos/4853293/pexels-photo-4853293.jpeg) | có | 1024×1024 |
| `pt-phuc-5` | Album PT Lê Hoàng Phúc #5 — cloud-pt-directory.js:433 (album seed_phuc) | [4854258](https://images.pexels.com/photos/4854258/pexels-photo-4854258.jpeg) | có | 1024×1024 |
| `pt-phuc-6` | Album PT Lê Hoàng Phúc #6 — cloud-pt-directory.js:433 (album seed_phuc) | [4853275](https://images.pexels.com/photos/4853275/pexels-photo-4853275.jpeg) | có | 1024×1024 |
| `pt-ngocanh` | PT Phạm Ngọc Anh (nữ · Pilates,Mẹ bầu & sau sinh,Tư thế & đau lưng) — ảnh bìa + avatar — cloud-pt-directory.js:441 (cover seed_ngocanh); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [18136887](https://images.pexels.com/photos/18136887/pexels-photo-18136887.jpeg) | có | 1024×1536 |
| `pt-ngocanh-1` | Album PT Phạm Ngọc Anh #1 — cloud-pt-directory.js:441 (album seed_ngocanh) | [18136882](https://images.pexels.com/photos/18136882/pexels-photo-18136882.jpeg) | có | 1024×1024 |
| `pt-ngocanh-2` | Album PT Phạm Ngọc Anh #2 — cloud-pt-directory.js:441 (album seed_ngocanh) | [8769175](https://images.pexels.com/photos/8769175/pexels-photo-8769175.jpeg) | có | 1024×1024 |
| `pt-ngocanh-3` | Album PT Phạm Ngọc Anh #3 — cloud-pt-directory.js:441 (album seed_ngocanh) | [6111610](https://images.pexels.com/photos/6111610/pexels-photo-6111610.jpeg) | có | 1024×1024 |
| `pt-ngocanh-4` | Album PT Phạm Ngọc Anh #4 — cloud-pt-directory.js:441 (album seed_ngocanh) | [6111607](https://images.pexels.com/photos/6111607/pexels-photo-6111607.jpeg) | có | 1024×1024 |
| `pt-ngocanh-5` | Album PT Phạm Ngọc Anh #5 — cloud-pt-directory.js:441 (album seed_ngocanh) | [31509844](https://images.pexels.com/photos/31509844/pexels-photo-31509844.jpeg) | có | 1024×1024 |
| `pt-ductai` | PT Võ Đức Tài (nam · Boxing,Giảm mỡ,Thể lực) — ảnh bìa + avatar — cloud-pt-directory.js:449 (cover seed_ductai); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [35168122](https://images.pexels.com/photos/35168122/pexels-photo-35168122.jpeg) | có | 1024×1536 |
| `pt-ductai-1` | Album PT Võ Đức Tài #1 — cloud-pt-directory.js:449 (album seed_ductai) | [35305754](https://images.pexels.com/photos/35305754/pexels-photo-35305754.jpeg) | có | 1024×1024 |
| `pt-ductai-2` | Album PT Võ Đức Tài #2 — cloud-pt-directory.js:449 (album seed_ductai) | [6740344](https://images.pexels.com/photos/6740344/pexels-photo-6740344.jpeg) | có | 1024×1024 |
| `pt-ductai-3` | Album PT Võ Đức Tài #3 — cloud-pt-directory.js:449 (album seed_ductai) | [6740342](https://images.pexels.com/photos/6740342/pexels-photo-6740342.jpeg) | có | 1024×1024 |
| `pt-ductai-4` | Album PT Võ Đức Tài #4 — cloud-pt-directory.js:449 (album seed_ductai) | [6740346](https://images.pexels.com/photos/6740346/pexels-photo-6740346.jpeg) | có | 1024×1024 |
| `pt-ductai-5` | Album PT Võ Đức Tài #5 — cloud-pt-directory.js:449 (album seed_ductai) | [8611244](https://images.pexels.com/photos/8611244/pexels-photo-8611244.jpeg) | có | 1024×1024 |
| `pt-ductai-6` | Album PT Võ Đức Tài #6 — cloud-pt-directory.js:449 (album seed_ductai) | [6740338](https://images.pexels.com/photos/6740338/pexels-photo-6740338.jpeg) | có | 1024×1024 |
| `pt-quynhnhu` | PT Đặng Quỳnh Như (nữ · Giảm mỡ,Tăng cơ,Người mới) — ảnh bìa + avatar — cloud-pt-directory.js:457 (cover seed_quynhnhu); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [40021619](https://images.pexels.com/photos/40021619/pexels-photo-40021619.jpeg) | có | 1024×1536 |
| `pt-quynhnhu-1` | Album PT Đặng Quỳnh Như #1 — cloud-pt-directory.js:457 (album seed_quynhnhu) | [40021609](https://images.pexels.com/photos/40021609/pexels-photo-40021609.jpeg) | có | 1024×1024 |
| `pt-quynhnhu-2` | Album PT Đặng Quỳnh Như #2 — cloud-pt-directory.js:457 (album seed_quynhnhu) | [40021611](https://images.pexels.com/photos/40021611/pexels-photo-40021611.jpeg) | có | 1024×1024 |
| `pt-quynhnhu-3` | Album PT Đặng Quỳnh Như #3 — cloud-pt-directory.js:457 (album seed_quynhnhu) | [40021296](https://images.pexels.com/photos/40021296/pexels-photo-40021296.jpeg) | có | 1024×1024 |
| `pt-quynhnhu-4` | Album PT Đặng Quỳnh Như #4 — cloud-pt-directory.js:457 (album seed_quynhnhu) | [9545911](https://images.pexels.com/photos/9545911/pexels-photo-9545911.jpeg) | có | 1024×1024 |
| `pt-giabao` | PT Huỳnh Gia Bảo (nam · Calisthenics,Thể lực,Chạy bộ) — ảnh bìa + avatar — cloud-pt-directory.js:465 (cover seed_giabao); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [13993574](https://images.pexels.com/photos/13993574/pexels-photo-13993574.jpeg) | có | 1024×1536 |
| `pt-giabao-1` | Album PT Huỳnh Gia Bảo #1 — cloud-pt-directory.js:465 (album seed_giabao) | [13993572](https://images.pexels.com/photos/13993572/pexels-photo-13993572.jpeg) | có | 1024×1024 |
| `pt-giabao-2` | Album PT Huỳnh Gia Bảo #2 — cloud-pt-directory.js:465 (album seed_giabao) | [13993540](https://images.pexels.com/photos/13993540/pexels-photo-13993540.jpeg) | có | 1024×1024 |
| `pt-giabao-3` | Album PT Huỳnh Gia Bảo #3 — cloud-pt-directory.js:465 (album seed_giabao) | [10021269](https://images.pexels.com/photos/10021269/pexels-photo-10021269.jpeg) | có | 1024×1024 |
| `pt-giabao-4` | Album PT Huỳnh Gia Bảo #4 — cloud-pt-directory.js:465 (album seed_giabao) | [10021280](https://images.pexels.com/photos/10021280/pexels-photo-10021280.jpeg) | có | 1024×1024 |
| `pt-giabao-5` | Album PT Huỳnh Gia Bảo #5 — cloud-pt-directory.js:465 (album seed_giabao) | [35703187](https://images.pexels.com/photos/35703187/pexels-photo-35703187.jpeg) | có | 1024×1024 |
| `pt-vanson` | PT Nguyễn Văn Sơn (nam · Thể hình thi đấu,Tăng cơ,Dinh dưỡng thể thao) — ảnh bìa + avatar — cloud-pt-directory.js:473 (cover seed_vanson); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [12890881](https://images.pexels.com/photos/12890881/pexels-photo-12890881.jpeg) | có | 1024×1536 |
| `pt-vanson-1` | Album PT Nguyễn Văn Sơn #1 — cloud-pt-directory.js:473 (album seed_vanson) | [12890817](https://images.pexels.com/photos/12890817/pexels-photo-12890817.jpeg) | có | 1024×1024 |
| `pt-vanson-2` | Album PT Nguyễn Văn Sơn #2 — cloud-pt-directory.js:473 (album seed_vanson) | [33188911](https://images.pexels.com/photos/33188911/pexels-photo-33188911.jpeg) | có | 1024×1024 |
| `pt-vanson-3` | Album PT Nguyễn Văn Sơn #3 — cloud-pt-directory.js:473 (album seed_vanson) | [5799855](https://images.pexels.com/photos/5799855/pexels-photo-5799855.jpeg) | có | 1024×1024 |
| `pt-vanson-4` | Album PT Nguyễn Văn Sơn #4 — cloud-pt-directory.js:473 (album seed_vanson) | [6388373](https://images.pexels.com/photos/6388373/pexels-photo-6388373.jpeg) | có | 1024×1024 |
| `pt-vanson-5` | Album PT Nguyễn Văn Sơn #5 — cloud-pt-directory.js:473 (album seed_vanson) | [40309468](https://images.pexels.com/photos/40309468/pexels-photo-40309468.jpeg) | có | 1024×1024 |
| `pt-mailinh` | PT Trịnh Mai Linh (nữ · Aerobic & nhảy,Giảm mỡ,Người mới) — ảnh bìa + avatar — cloud-pt-directory.js:481 (cover seed_mailinh); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [40428934](https://images.pexels.com/photos/40428934/pexels-photo-40428934.jpeg) | có | 1024×1536 |
| `pt-mailinh-1` | Album PT Trịnh Mai Linh #1 — cloud-pt-directory.js:481 (album seed_mailinh) | [40428947](https://images.pexels.com/photos/40428947/pexels-photo-40428947.jpeg) | có | 1024×1024 |
| `pt-mailinh-2` | Album PT Trịnh Mai Linh #2 — cloud-pt-directory.js:481 (album seed_mailinh) | [40428937](https://images.pexels.com/photos/40428937/pexels-photo-40428937.jpeg) | có | 1024×1024 |
| `pt-mailinh-3` | Album PT Trịnh Mai Linh #3 — cloud-pt-directory.js:481 (album seed_mailinh) | [4090012](https://images.pexels.com/photos/4090012/pexels-photo-4090012.jpeg) | có | 1024×1024 |
| `pt-mailinh-4` | Album PT Trịnh Mai Linh #4 — cloud-pt-directory.js:481 (album seed_mailinh) | [37156646](https://images.pexels.com/photos/37156646/pexels-photo-37156646.jpeg) | có | 1024×1024 |
| `pt-mailinh-5` | Album PT Trịnh Mai Linh #5 — cloud-pt-directory.js:481 (album seed_mailinh) | [8957662](https://images.pexels.com/photos/8957662/pexels-photo-8957662.jpeg) | có | 1024×1024 |
| `pt-thanhtam` | PT Lý Thanh Tâm (nữ · Phục hồi chức năng,Người cao tuổi,Tư thế & đau lưng) — ảnh bìa + avatar — cloud-pt-directory.js:489 (cover seed_thanhtam); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [6922174](https://images.pexels.com/photos/6922174/pexels-photo-6922174.jpeg) | có | 1024×1536 |
| `pt-thanhtam-1` | Album PT Lý Thanh Tâm #1 — cloud-pt-directory.js:489 (album seed_thanhtam) | [6922177](https://images.pexels.com/photos/6922177/pexels-photo-6922177.jpeg) | có | 1024×1024 |
| `pt-thanhtam-2` | Album PT Lý Thanh Tâm #2 — cloud-pt-directory.js:489 (album seed_thanhtam) | [6922122](https://images.pexels.com/photos/6922122/pexels-photo-6922122.jpeg) | có | 1024×1024 |
| `pt-thanhtam-3` | Album PT Lý Thanh Tâm #3 — cloud-pt-directory.js:489 (album seed_thanhtam) | [6922123](https://images.pexels.com/photos/6922123/pexels-photo-6922123.jpeg) | có | 1024×1024 |
| `pt-thanhtam-4` | Album PT Lý Thanh Tâm #4 — cloud-pt-directory.js:489 (album seed_thanhtam) | [6922165](https://images.pexels.com/photos/6922165/pexels-photo-6922165.jpeg) | có | 1024×1024 |
| `pt-thanhtam-5` | Album PT Lý Thanh Tâm #5 — cloud-pt-directory.js:489 (album seed_thanhtam) | [6922119](https://images.pexels.com/photos/6922119/pexels-photo-6922119.jpeg) | có | 1024×1024 |
| `pt-khanhvy` | PT Bùi Khánh Vy (nữ · Bơi lội,Thể lực,Người mới) — ảnh bìa + avatar — cloud-pt-directory.js:497 (cover seed_khanhvy); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [40719510](https://images.pexels.com/photos/40719510/pexels-photo-40719510.jpeg) | có | 1024×1536 |
| `pt-khanhvy-1` | Album PT Bùi Khánh Vy #1 — cloud-pt-directory.js:497 (album seed_khanhvy) | [40719514](https://images.pexels.com/photos/40719514/pexels-photo-40719514.jpeg) | có | 1024×1024 |
| `pt-khanhvy-2` | Album PT Bùi Khánh Vy #2 — cloud-pt-directory.js:497 (album seed_khanhvy) | [40719515](https://images.pexels.com/photos/40719515/pexels-photo-40719515.jpeg) | có | 1024×1024 |
| `pt-khanhvy-3` | Album PT Bùi Khánh Vy #3 — cloud-pt-directory.js:497 (album seed_khanhvy) | [37304029](https://images.pexels.com/photos/37304029/pexels-photo-37304029.jpeg) | có | 1024×1024 |
| `pt-khanhvy-4` | Album PT Bùi Khánh Vy #4 — cloud-pt-directory.js:497 (album seed_khanhvy) | [8028663](https://images.pexels.com/photos/8028663/pexels-photo-8028663.jpeg) | có | 1024×1024 |
| `pt-quanghuy` | PT Đỗ Quang Huy (nam · Chạy bộ,Thể lực,Giảm mỡ) — ảnh bìa + avatar — cloud-pt-directory.js:505 (cover seed_quanghuy); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [39322345](https://images.pexels.com/photos/39322345/pexels-photo-39322345.jpeg) | có | 1024×1536 |
| `pt-quanghuy-1` | Album PT Đỗ Quang Huy #1 — cloud-pt-directory.js:505 (album seed_quanghuy) | [29151594](https://images.pexels.com/photos/29151594/pexels-photo-29151594.jpeg) | có | 1024×1024 |
| `pt-quanghuy-2` | Album PT Đỗ Quang Huy #2 — cloud-pt-directory.js:505 (album seed_quanghuy) | [18715198](https://images.pexels.com/photos/18715198/pexels-photo-18715198.jpeg) | có | 1024×1024 |
| `pt-quanghuy-3` | Album PT Đỗ Quang Huy #3 — cloud-pt-directory.js:505 (album seed_quanghuy) | [31492040](https://images.pexels.com/photos/31492040/pexels-photo-31492040.jpeg) | có | 1024×1024 |
| `pt-quanghuy-4` | Album PT Đỗ Quang Huy #4 — cloud-pt-directory.js:505 (album seed_quanghuy) | [4853083](https://images.pexels.com/photos/4853083/pexels-photo-4853083.jpeg) | có | 1024×1024 |
| `pt-my` | PT Hoàng Thị Mỹ (nữ · Mẹ bầu & sau sinh,Yoga,Pilates) — ảnh bìa + avatar — cloud-pt-directory.js:513 (cover seed_my); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [13849172](https://images.pexels.com/photos/13849172/pexels-photo-13849172.jpeg) | có | 1024×1536 |
| `pt-my-1` | Album PT Hoàng Thị Mỹ #1 — cloud-pt-directory.js:513 (album seed_my) | [13849175](https://images.pexels.com/photos/13849175/pexels-photo-13849175.jpeg) | có | 1024×1024 |
| `pt-my-2` | Album PT Hoàng Thị Mỹ #2 — cloud-pt-directory.js:513 (album seed_my) | [13849171](https://images.pexels.com/photos/13849171/pexels-photo-13849171.jpeg) | có | 1024×1024 |
| `pt-my-3` | Album PT Hoàng Thị Mỹ #3 — cloud-pt-directory.js:513 (album seed_my) | [3984364](https://images.pexels.com/photos/3984364/pexels-photo-3984364.jpeg) | có | 1024×1024 |
| `pt-my-4` | Album PT Hoàng Thị Mỹ #4 — cloud-pt-directory.js:513 (album seed_my) | [3984362](https://images.pexels.com/photos/3984362/pexels-photo-3984362.jpeg) | có | 1024×1024 |
| `pt-my-5` | Album PT Hoàng Thị Mỹ #5 — cloud-pt-directory.js:513 (album seed_my) | [7055659](https://images.pexels.com/photos/7055659/pexels-photo-7055659.jpeg) | có | 1024×1024 |
| `pt-nhatnam` | PT Phan Nhật Nam (nam · Muay Thai,Giảm mỡ,Thể lực) — ảnh bìa + avatar — cloud-pt-directory.js:521 (cover seed_nhatnam); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [8612586](https://images.pexels.com/photos/8612586/pexels-photo-8612586.jpeg) | có | 1024×1536 |
| `pt-nhatnam-1` | Album PT Phan Nhật Nam #1 — cloud-pt-directory.js:521 (album seed_nhatnam) | [8611942](https://images.pexels.com/photos/8611942/pexels-photo-8611942.jpeg) | có | 1024×1024 |
| `pt-nhatnam-2` | Album PT Phan Nhật Nam #2 — cloud-pt-directory.js:521 (album seed_nhatnam) | [8612030](https://images.pexels.com/photos/8612030/pexels-photo-8612030.jpeg) | có | 1024×1024 |
| `pt-nhatnam-3` | Album PT Phan Nhật Nam #3 — cloud-pt-directory.js:521 (album seed_nhatnam) | [8611370](https://images.pexels.com/photos/8611370/pexels-photo-8611370.jpeg) | có | 1024×1024 |
| `pt-nhatnam-4` | Album PT Phan Nhật Nam #4 — cloud-pt-directory.js:521 (album seed_nhatnam) | [40608838](https://images.pexels.com/photos/40608838/pexels-photo-40608838.jpeg) | có | 1024×1024 |
| `pt-nhatnam-5` | Album PT Phan Nhật Nam #5 — cloud-pt-directory.js:521 (album seed_nhatnam) | [8611297](https://images.pexels.com/photos/8611297/pexels-photo-8611297.jpeg) | có | 1024×1024 |
| `pt-thuyduong` | PT Cao Thùy Dương (nữ · Tăng cơ,Sức mạnh,Người mới) — ảnh bìa + avatar — cloud-pt-directory.js:529 (cover seed_thuyduong); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [13673631](https://images.pexels.com/photos/13673631/pexels-photo-13673631.jpeg) | có | 1024×1536 |
| `pt-thuyduong-1` | Album PT Cao Thùy Dương #1 — cloud-pt-directory.js:529 (album seed_thuyduong) | [13673629](https://images.pexels.com/photos/13673629/pexels-photo-13673629.jpeg) | có | 1024×1024 |
| `pt-thuyduong-2` | Album PT Cao Thùy Dương #2 — cloud-pt-directory.js:529 (album seed_thuyduong) | [31500878](https://images.pexels.com/photos/31500878/pexels-photo-31500878.jpeg) | có | 1024×1024 |
| `pt-thuyduong-3` | Album PT Cao Thùy Dương #3 — cloud-pt-directory.js:529 (album seed_thuyduong) | [31500868](https://images.pexels.com/photos/31500868/pexels-photo-31500868.jpeg) | có | 1024×1024 |
| `pt-thuyduong-4` | Album PT Cao Thùy Dương #4 — cloud-pt-directory.js:529 (album seed_thuyduong) | [14502911](https://images.pexels.com/photos/14502911/pexels-photo-14502911.jpeg) | có | 1024×1024 |
| `pt-tuankiet` | PT Mai Tuấn Kiệt (nam · Kettlebell & chức năng,Sức mạnh,Giảm mỡ) — ảnh bìa + avatar — cloud-pt-directory.js:537 (cover seed_tuankiet); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [10942691](https://images.pexels.com/photos/10942691/pexels-photo-10942691.jpeg) | có | 1024×1536 |
| `pt-tuankiet-1` | Album PT Mai Tuấn Kiệt #1 — cloud-pt-directory.js:537 (album seed_tuankiet) | [10942689](https://images.pexels.com/photos/10942689/pexels-photo-10942689.jpeg) | có | 1024×1024 |
| `pt-tuankiet-2` | Album PT Mai Tuấn Kiệt #2 — cloud-pt-directory.js:537 (album seed_tuankiet) | [4804337](https://images.pexels.com/photos/4804337/pexels-photo-4804337.jpeg) | có | 1024×1024 |
| `pt-tuankiet-3` | Album PT Mai Tuấn Kiệt #3 — cloud-pt-directory.js:537 (album seed_tuankiet) | [6390225](https://images.pexels.com/photos/6390225/pexels-photo-6390225.jpeg) | có | 1024×1024 |
| `pt-tuankiet-4` | Album PT Mai Tuấn Kiệt #4 — cloud-pt-directory.js:537 (album seed_tuankiet) | [9545907](https://images.pexels.com/photos/9545907/pexels-photo-9545907.jpeg) | có | 1024×1024 |
| `pt-baotram` | PT Ngô Bảo Trâm (nữ · Giảm mỡ,Người mới,Linh hoạt) — ảnh bìa + avatar — cloud-pt-directory.js:545 (cover seed_baotram); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [4852739](https://images.pexels.com/photos/4852739/pexels-photo-4852739.jpeg) | có | 1024×1536 |
| `pt-baotram-1` | Album PT Ngô Bảo Trâm #1 — cloud-pt-directory.js:545 (album seed_baotram) | [8032754](https://images.pexels.com/photos/8032754/pexels-photo-8032754.jpeg) | có | 1024×1024 |
| `pt-baotram-2` | Album PT Ngô Bảo Trâm #2 — cloud-pt-directory.js:545 (album seed_baotram) | [7900680](https://images.pexels.com/photos/7900680/pexels-photo-7900680.jpeg) | có | 1024×1024 |
| `pt-baotram-3` | Album PT Ngô Bảo Trâm #3 — cloud-pt-directory.js:545 (album seed_baotram) | [8846574](https://images.pexels.com/photos/8846574/pexels-photo-8846574.jpeg) | có | 1024×1024 |
| `pt-baotram-4` | Album PT Ngô Bảo Trâm #4 — cloud-pt-directory.js:545 (album seed_baotram) | [6453430](https://images.pexels.com/photos/6453430/pexels-photo-6453430.jpeg) | có | 1024×1024 |
| `pt-baotram-5` | Album PT Ngô Bảo Trâm #5 — cloud-pt-directory.js:545 (album seed_baotram) | [4498454](https://images.pexels.com/photos/4498454/pexels-photo-4498454.jpeg) | ? | 1024×1024 |
| `pt-anhdung` | PT Kiều Anh Dũng (nam · Huấn luyện VĐV,Sức mạnh,Phục hồi chức năng) — ảnh bìa + avatar — cloud-pt-directory.js:553 (cover seed_anhdung); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [20523354](https://images.pexels.com/photos/20523354/pexels-photo-20523354.jpeg) | có | 1024×1536 |
| `pt-anhdung-1` | Album PT Kiều Anh Dũng #1 — cloud-pt-directory.js:553 (album seed_anhdung) | [13621289](https://images.pexels.com/photos/13621289/pexels-photo-13621289.jpeg) | có | 1024×1024 |
| `pt-anhdung-2` | Album PT Kiều Anh Dũng #2 — cloud-pt-directory.js:553 (album seed_anhdung) | [29224211](https://images.pexels.com/photos/29224211/pexels-photo-29224211.jpeg) | có | 1024×1024 |
| `pt-anhdung-3` | Album PT Kiều Anh Dũng #3 — cloud-pt-directory.js:553 (album seed_anhdung) | [40371850](https://images.pexels.com/photos/40371850/pexels-photo-40371850.jpeg) | có | 1024×1024 |
| `pt-anhdung-4` | Album PT Kiều Anh Dũng #4 — cloud-pt-directory.js:553 (album seed_anhdung) | [34794734](https://images.pexels.com/photos/34794734/pexels-photo-34794734.jpeg) | có | 1024×1024 |
| `pt-haiyen` | PT Lâm Hải Yến (nữ · Yoga,Linh hoạt,Phục hồi) — ảnh bìa + avatar — cloud-pt-directory.js:561 (cover seed_haiyen); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [39963095](https://images.pexels.com/photos/39963095/pexels-photo-39963095.jpeg) | có | 1024×1536 |
| `pt-haiyen-1` | Album PT Lâm Hải Yến #1 — cloud-pt-directory.js:561 (album seed_haiyen) | [40901922](https://images.pexels.com/photos/40901922/pexels-photo-40901922.jpeg) | có | 1024×1024 |
| `pt-haiyen-2` | Album PT Lâm Hải Yến #2 — cloud-pt-directory.js:561 (album seed_haiyen) | [40189494](https://images.pexels.com/photos/40189494/pexels-photo-40189494.jpeg) | có | 1024×1024 |
| `pt-haiyen-3` | Album PT Lâm Hải Yến #3 — cloud-pt-directory.js:561 (album seed_haiyen) | [40302221](https://images.pexels.com/photos/40302221/pexels-photo-40302221.jpeg) | có | 1024×1024 |
| `pt-haiyen-4` | Album PT Lâm Hải Yến #4 — cloud-pt-directory.js:561 (album seed_haiyen) | [40261672](https://images.pexels.com/photos/40261672/pexels-photo-40261672.jpeg) | có | 1024×1024 |
| `pt-haiyen-5` | Album PT Lâm Hải Yến #5 — cloud-pt-directory.js:561 (album seed_haiyen) | [40666375](https://images.pexels.com/photos/40666375/pexels-photo-40666375.jpeg) | có | 1024×1024 |
| `pt-minhtri` | PT Tạ Minh Trí (nam · Giảm mỡ,Thể lực,Người mới) — ảnh bìa + avatar — cloud-pt-directory.js:569 (cover seed_minhtri); findpt.js / ptprofile.js (bìa, avatar, thẻ danh sách) | [40219053](https://images.pexels.com/photos/40219053/pexels-photo-40219053.jpeg) | có | 1024×1536 |
| `pt-minhtri-1` | Album PT Tạ Minh Trí #1 — cloud-pt-directory.js:569 (album seed_minhtri) | [40302238](https://images.pexels.com/photos/40302238/pexels-photo-40302238.jpeg) | có | 1024×1024 |
| `pt-minhtri-2` | Album PT Tạ Minh Trí #2 — cloud-pt-directory.js:569 (album seed_minhtri) | [40302239](https://images.pexels.com/photos/40302239/pexels-photo-40302239.jpeg) | có | 1024×1024 |
| `pt-minhtri-3` | Album PT Tạ Minh Trí #3 — cloud-pt-directory.js:569 (album seed_minhtri) | [40219056](https://images.pexels.com/photos/40219056/pexels-photo-40219056.jpeg) | có | 1024×1024 |
| `pt-minhtri-4` | Album PT Tạ Minh Trí #4 — cloud-pt-directory.js:569 (album seed_minhtri) | [40646062](https://images.pexels.com/photos/40646062/pexels-photo-40646062.jpeg) | có | 1024×1024 |
| `pt-minhtri-5` | Album PT Tạ Minh Trí #5 — cloud-pt-directory.js:569 (album seed_minhtri) | [40261686](https://images.pexels.com/photos/40261686/pexels-photo-40261686.jpeg) | có | 1024×1024 |
| `rv-pt-progress` | Ảnh đánh giá PT — học viên nữ tập tạ — cloud-pt-directory.js:572 (RVP, ảnh trong đánh giá PT) | [4853876](https://images.pexels.com/photos/4853876/pexels-photo-4853876.jpeg) | có | 1024×1024 |
| `rv-pt-yoga-home` | Ảnh đánh giá PT — yoga online tại nhà — cloud-pt-directory.js:572 (RVP, ảnh trong đánh giá PT) | [4426296](https://images.pexels.com/photos/4426296/pexels-photo-4426296.jpeg) | có | 1024×1024 |
| `rv-pt-posture` | Ảnh đánh giá PT — tư thế thẳng — cloud-pt-directory.js:572 (RVP, ảnh trong đánh giá PT) | [4426317](https://images.pexels.com/photos/4426317/pexels-photo-4426317.jpeg) | có | 1024×1024 |
| `rv-pt-dance-home` | Ảnh đánh giá PT — nhảy tại nhà — cloud-pt-directory.js:572 (RVP, ảnh trong đánh giá PT) | [4426318](https://images.pexels.com/photos/4426318/pexels-photo-4426318.jpeg) | có | 1024×1024 |
| `rv-pt-hipthrust` | Ảnh đánh giá PT — hip thrust — cloud-pt-directory.js:572 (RVP, ảnh trong đánh giá PT) | [7690208](https://images.pexels.com/photos/7690208/pexels-photo-7690208.jpeg) | có | 1024×1024 |
| `rv-pt-trail-finish` | Ảnh đánh giá PT — về đích trail — cloud-pt-directory.js:572 (RVP, ảnh trong đánh giá PT) | [4436347](https://images.pexels.com/photos/4436347/pexels-photo-4436347.jpeg) | có | 1024×1024 |
| `rv-pt-first-lift` | Ảnh đánh giá PT — người mới tập — cloud-pt-directory.js:572 (RVP, ảnh trong đánh giá PT) | [4428991](https://images.pexels.com/photos/4428991/pexels-photo-4428991.jpeg) | có | 1024×1024 |

`?` = ảnh gốc có thể không có người (khu tập/đồ dùng) — vẫn thay để đồng bộ phong cách album; prompt ghi rõ không có người.

## Ảnh ngoài KHÔNG thay (không có người)

| Pexels id | Ở đâu | Lý do |
|---|---|---|
| [30635703](https://images.pexels.com/photos/30635703/pexels-photo-30635703/free-photo-of-healthy-meal-prep-containers-with-grilled-chicken.jpeg?auto=compress&cs=tinysrgb&w=1080) | data.js:25 | IMG.heroNutrition — ảnh món ăn, không có người (không đổi) |
| [30635714](https://images.pexels.com/photos/30635714/pexels-photo-30635714/free-photo-of-healthy-meal-prep-with-rice-and-vegetables.jpeg?auto=compress&cs=tinysrgb&w=800) | data.js:26 | IMG.cardNutrition2 — ảnh món ăn, không có người (không đổi) |
| [16211481](https://images.pexels.com/photos/16211481/pexels-photo-16211481.jpeg) | cloud-events.js:94 | Tháp Rùa (phong cảnh, không người) |
| [1640771](https://images.pexels.com/photos/1640771/pexels-photo-1640771.jpeg) | cloud-events.js:141 | hộp cơm (món ăn) |
| [3850841](https://images.pexels.com/photos/3850841/pexels-photo-3850841.jpeg) | cloud-events.js:143 | nguyên liệu (món ăn) |
| [760719](https://images.pexels.com/photos/760719/pexels-photo-760719.jpeg) | cloud-events.js:197 | sổ kế hoạch ăn uống (đồ vật) |
| [30635703](https://images.pexels.com/photos/30635703/pexels-photo-30635703.jpeg) | cloud-pt-directory.js:433 (album seed_phuc) | hộp cơm meal-prep (món ăn) — trùng IMG.heroNutrition |
| [30635703](https://images.pexels.com/photos/30635703/pexels-photo-30635703.jpeg) | cloud-pt-directory.js:572 (RVP) | hộp cơm (món ăn) |
| (video) | cloud-events.js `PXV(...)`, video.js, freevideos.js, media/welcome | video + ảnh poster của video — để nguyên theo yêu cầu |
| (ảnh người dùng tải lên) | events-media.js, findpt.js (PT thật), community.js | nội dung người dùng — không thuộc phạm vi |

Kiểm kê bằng: grep `pexels|pixabay|unsplash|wikimedia|randomuser|pravatar|picsum` trong `*.js|*.html|*.css` (trừ `www/`, `_test/`, `tests/`) + xem từng ảnh cục bộ trong `assets/**` (contact sheet). `community.js`, `kb-data-*.js`, `shop-data.js`, `landing.html`, `templates.js` (chỉ dùng `IMG.*`), `ptprofile.js`, `pt.js`, `app.js` không có URL ảnh người riêng — chúng dùng `IMG.*` hoặc dữ liệu seed ở trên.



## Bổ sung 12/11 — hero Tập luyện theo giới tính & phòng tập trống

| id | dùng ở |
|---|---|
| `hero-m-1` | app.js HERO_CYCLE theo giới tính |
| `hero-m-2` | app.js HERO_CYCLE theo giới tính |
| `hero-m-3` | app.js HERO_CYCLE theo giới tính |
| `hero-m-4` | app.js HERO_CYCLE theo giới tính |
| `hero-f-1` | app.js HERO_CYCLE theo giới tính |
| `hero-f-2` | app.js HERO_CYCLE theo giới tính |
| `hero-f-3` | app.js HERO_CYCLE theo giới tính |
| `hero-f-4` | app.js HERO_CYCLE theo giới tính |
| `ob-gym-empty` | index.html onboarding bước 0, app.js |

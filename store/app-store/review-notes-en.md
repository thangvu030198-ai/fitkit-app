# App Review Information — notes for the reviewer (English, paste into “Notes”)

> Chủ dự án: thay các chỗ `[ĐIỀN …]` bằng tài khoản thật đã tạo trên Firebase **của bản phát hành**, đăng nhập thử cả hai tài khoản trên bản TestFlight trước khi nộp. Cùng nội dung dùng cho Google Play → App content → App access. Giới hạn ô Notes: 4000 ký tự.

**Sign-in required:** Yes
**User name:** `[ĐIỀN EMAIL TÀI KHOẢN PT DEMO]`  **Password:** `[ĐIỀN MẬT KHẨU]`
**Contact:** `[ĐIỀN HỌ TÊN]` · `[ĐIỀN SỐ ĐIỆN THOẠI +84…]` · `thangvu030198@gmail.com`

```text
Thank you for reviewing TapEasy, a Vietnamese-language gym, nutrition and personal-trainer app.

ACCOUNTS (no 2FA, no verification code needed)
1) Trainer (PT) demo: [TRAINER EMAIL] / [PASSWORD] — already has one connected client with a schedule, assigned workouts and chat history.
2) Client demo: [CLIENT EMAIL] / [PASSWORD] — connected to the trainer above.
The app can also be used without any account: on the first screen tap “Dùng ngay, không cần tài khoản” (Use now, no account). Accounts are only needed for trainer–client and community features.
The UI language is Vietnamese; an English option is in Hồ sơ (Profile) → Ngôn ngữ (Language).

HOW TO TEST THE MAIN FLOWS
- Workout: Tập luyện tab → pick today’s session → “Bắt đầu tập” → log kg × reps per set; a native rest-timer notification fires when the phone is locked.
- Nutrition: Dinh dưỡng tab → add a food → daily calories/macros update.
- Trainer–client: sign in as the trainer → PT tab → open the demo client → assign a workout or send a message; sign in as the client on another device to see it.
- Report / block (Guideline 1.2): on any public post, comment, review or trainer profile tap “⋯” → “Báo cáo” (Report) or “Chặn” (Block). Reports go to our moderation queue and are handled within 24 hours; offending content is removed and the user is banned. Terms forbidding objectionable content are accepted at sign-up.
- Account deletion (5.1.1(v)): Hồ sơ (Profile) → Tài khoản → “Xoá tài khoản” deletes the account and all cloud data immediately (Sign in with Apple tokens are revoked). Also available at https://thangvu030198-ai.github.io/fitkit-app/delete-account.html

SIGN-IN OPTIONS (Guideline 4.8)
Email/password, Sign in with Apple and Google. Sign in with Apple is offered wherever Google is offered and supports “Hide My Email”.

NATIVE FUNCTIONALITY (Guideline 4.2)
TapEasy is built with Capacitor; all app code and the 800+ exercise library are bundled in the binary and work offline. Native features: scheduled local notifications (workout reminders, rest timer on the lock screen), haptic feedback, native share sheet, native Sign in with Apple / Google SDKs, camera capture for progress photos, hardware back handling, keep-screen-awake during workouts. It is not a wrapper around a website.

HEALTH (Guideline 1.4.1)
TapEasy gives general fitness and nutrition guidance only. It is not a medical device and makes no diagnosis or treatment claims. New users see a PAR-Q+ style safety screening and a medical disclaimer; calorie targets are never set below safe minimums and are disabled for pregnancy, under-18 and eating-disorder flags. Formulas are cited in-app (Mifflin-St Jeor, ISSN, etc.). No HealthKit.

PAYMENTS (Guideline 3.1)
The app is free with no in-app purchases and unlocks no digital content for money. The shop section sells physical goods only (gym apparel/accessories shipped to the buyer), paid by cash on delivery or bank transfer (3.1.3(e)). Personal-training sessions arranged between a trainer and a client are real-world, one-to-one, in-person services paid outside the app directly between them (3.1.3(d)/(e)); TapEasy takes no commission.

PRIVACY (5.1.1 / 5.1.2)
No tracking, no ads, no third-party advertising SDKs; the app does not show the ATT prompt because it does not track. Anonymous usage analytics are OFF by default and only run after explicit opt-in. Camera, microphone and “add to photos” are requested only when the user starts the related action. AI photo analysis runs only if the user enters their own API key and consents on a dialog naming the provider.

STAFF-ONLY AREA
“Bảng quản trị” (Admin panel) is visible only to TapEasy staff accounts for moderation; it is not accessible to regular users and has no hidden triggers.
```

## Trước khi dán — kiểm 6 điều (sai 1 điều là bị từ chối 2.1 / 2.3)

1. Hai tài khoản demo **đăng nhập được trên bản TestFlight** (không phải bản web), PT đã có sẵn học viên demo + vài buổi tập + vài tin nhắn.
2. Câu “English option is in Profile → Language” chỉ giữ nếu bản nộp đã có lớp dịch `i18n.js`; chưa có thì xoá câu đó.
3. Câu về AI consent chỉ giữ nếu hộp thoại đồng ý đã có (STORE-COMPLIANCE §0 mục 7).
4. Trên bản nộp **không còn** mục “Sắp ra mắt”, gian hàng trống, nút bấm không phản hồi (xem `docs/RELEASE-CHECKLIST.md` §B2 mục 2.1).
5. Gian hàng: nếu **ẩn** trên bản iOS (khuyến nghị cho lần nộp đầu) → xoá đoạn nói về shop trong PAYMENTS.
6. Đường dẫn các nút trong ghi chú đúng với giao diện hiện tại (tên tab, vị trí “Báo cáo”, “Xoá tài khoản”).

# Thống kê sử dụng ẩn danh — `analytics.js`

> 13/11/2026 · privacy-first, không phụ thuộc nhà cung cấp. Kiểm thử: `node tests/run.js --only 74-onboarding`.

## 1. Nguyên tắc

| Nguyên tắc | Cách làm trong code |
|---|---|
| **Mặc định TẮT** | `FKAnalytics.consent()` chỉ `true` khi người dùng bấm **Đồng ý** (thẻ hỏi lần đầu) hoặc bật công tắc trong **Hồ sơ → Góp ý & quyền riêng tư**. |
| **Tắt = không gì rời máy** | `fkTrack()` trả `false` ngay khi chưa đồng ý: không xếp hàng, không ghi nhật ký cục bộ, không tải SDK. Rút lại đồng ý → xoá hàng đợi + nhật ký cục bộ, `opt_out` PostHog, `setAnalyticsCollectionEnabled(false)` Firebase. |
| **Do Not Track / GPC** | `navigator.doNotTrack === "1"` hoặc `navigator.globalPrivacyControl === true` → không hiện thẻ hỏi, giữ tắt (người dùng vẫn tự bật được). |
| **Không PII** | `FKAnalytics.sanitize()`: chỉ nhận chuỗi ≤ 100 ký tự / số / boolean, tối đa 25 khoá; loại khoá có đoạn `email, phone, sdt, tel, name, ten, address, uid, user, token, password, ip, lat/lng, birth, contact, text, note, message, comment, search, query…`; giá trị trông như email / SĐT → `"[redacted]"`; object/mảng lồng bị bỏ. |
| **Mã người dùng băm** | `fkIdentify(uid)` gửi `u_` + 16 ký tự hex của SHA-256(`"tapeasy.analytics.v1:" + uid`) — không bao giờ gửi uid/email thật. |
| **SDK chỉ tải sau đồng ý** | PostHog `array.js` và `firebase-analytics-compat.js` chỉ được chèn sau `setConsent(true)`. |
| **Minh bạch** | Hồ sơ → Góp ý & quyền riêng tư → *Xem dữ liệu thống kê trên máy* hiện 50 sự kiện gần nhất đúng như đã ghi. |

## 2. API

```js
fkTrack(event, props)        // → true nếu đã ghi; false nếu chưa đồng ý / tên sự kiện sai
fkIdentify(userId, traits)   // async → mã băm hoặc null (chưa đồng ý)
fkScreen(name, props)        // = fkTrack("screen_view", { screen }) — bỏ trùng màn liên tiếp
FKAnalytics.consent() / setConsent(on, source) / dnt() / shouldAsk() / askConsent(force)
FKAnalytics.sanitize(props) / cleanEvent(name) / hashId(id) / providers() / log() / clearLog()
```

Tên sự kiện: `snake_case`, 2–40 ký tự (`cleanEvent("Workout Start!") → "workout_start"`).
Mọi sự kiện tự kèm: `app_version, platform (web|android|ios), lang, theme, backend (demo|firebase)`.

Gọi an toàn ở mọi nơi: `if(typeof fkTrack === "function") fkTrack("ten_su_kien", { ... })`.

## 3. Nhà cung cấp (chọn tự động, dùng được nhiều cùng lúc)

| Thứ tự | Nhà cung cấp | Bật khi | Ghi chú |
|---|---|---|---|
| a | **Firebase Analytics** | `FIREBASE_CONFIG.measurementId` có giá trị **và** app đang chạy Firebase thật (`cloud.mode === "firebase"`) **và** đã đồng ý | Tải `firebase-analytics-compat.js` (gstatic) → gtag từ googletagmanager.com. Đặt sẵn `allow_google_signals=false`, `allow_ad_personalization_signals=false`. |
| b | **PostHog** | `MEDIA_CONFIG.posthogKey` (hoặc `window.APP_CONFIG = { posthog: { key, host } }`) có giá trị **và** đã đồng ý | Host mặc định **EU** `https://eu.i.posthog.com`. Cấu hình: `autocapture:false, capture_pageview:false, disable_session_recording:true, disable_surveys:true, advanced_disable_decide:true, mask_all_text:true`, chặn `$current_url/$referrer`. |
| c | **Nhật ký cục bộ** | Luôn có khi đã đồng ý | Vòng đệm 200 sự kiện trong `localStorage["fk_analytics_log"]` — dùng để gỡ lỗi khi chưa có nhà cung cấp nào. |

### CSP (index.html) — đã thêm tối thiểu
- `script-src`: `https://www.googletagmanager.com https://eu-assets.i.posthog.com`
- `connect-src`: `https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://eu.i.posthog.com`

Dùng PostHog **US** (`https://us.i.posthog.com`) hoặc tự host → phải thêm host đó (và `us-assets.i.posthog.com`) vào CSP.

## 4. Chủ app bật thống kê như thế nào

**KHÔNG commit khoá thật vào repo công khai nếu không muốn** — khoá client của PostHog (`phc_…`) và `measurementId` (`G-…`) là định danh công khai phía client (không phải mật khẩu), nhưng nên điền lúc build (CI secret → sed) cho bản store.

1. **PostHog** (khuyên dùng, EU):
   - Tạo project tại PostHog Cloud **EU** → *Project settings* → copy *Project API key*.
   - Bật *Discard client IP data* trong Project settings (không lưu IP).
   - Điền `media-config.js`:
     ```js
     posthogKey: "<PROJECT_API_KEY>",
     posthogHost: "",            // để trống = https://eu.i.posthog.com
     ```
2. **Firebase Analytics**:
   - Firebase Console → Project settings → *Integrations* → **Google Analytics → Enable** → chọn tài khoản GA4.
   - Copy `measurementId` (dạng `G-XXXX`) vào `firebase-config.js` → `measurementId: "<G-…>"`.
   - Trong GA4: tắt *Google signals*, tắt *Ads personalization*, đặt *Data retention* = 14 tháng.
   - App native (Capacitor): gtag chạy trong WebView; nếu cần số liệu native đầy đủ hãy dùng plugin `@capacitor-firebase/analytics` (vẫn phải gọi sau khi `FKAnalytics.consent()`).
3. Không điền gì → chỉ có nhật ký cục bộ (vẫn cần người dùng đồng ý).
4. Cập nhật nhãn quyền riêng tư store theo `docs/STORE-COMPLIANCE.md` (App interactions / Product Interaction — Analytics, không liên kết danh tính).

## 5. Từ điển sự kiện (phễu chính)

| Sự kiện | Khi nào | Thuộc tính | Nơi gắn |
|---|---|---|---|
| `app_open` | Mở app (sau khi mọi module nạp), chỉ khi đã đồng ý | `first_open`, `days_since_install` | analytics.js `boot()` |
| `analytics_consent` | Ngay khi người dùng đồng ý | `granted`, `source` (banner / banner_custom / settings) | analytics.js |
| `screen_view` | Mỗi lần `goto(màn)` (bỏ trùng liên tiếp) | `screen` | analytics.js (bọc `goto`) |
| `onboarding_step_view` | Hiện 1 bước tạo hồ sơ | `step` (0–4), `step_name` (intro, sex_age, body, activity, goal), `edit` | app.js `showObStep` |
| `onboarding_step_complete` | Bấm "Tiếp tục" hợp lệ | `step`, `edit` | app.js |
| `onboarding_finish` | Hoàn tất onboarding lần đầu | `goal`, `level`, `activity`, `equipment`, `days_per_week`, `has_bodyfat` | app.js `finishOnboarding` |
| `profile_updated` | Lưu khi sửa lại câu trả lời | như trên + `plan_changed` | app.js |
| `plan_ready_view` | Hiện màn "Kế hoạch đã sẵn sàng" | `train_days`, `goal`, `has_first` | app.js `showPlanReady` |
| `first_workout_cta` | Bấm "Bắt đầu buổi đầu tiên" | `day_is_today`, `has_first` | app.js |
| `plan_ready_later` | Bấm "Xem Trang chủ trước" / Back | — | app.js |
| `signup` | Đăng ký email thành công | `method` (email) | cloud.js |
| `login` | Đăng nhập thành công | `method` (email, google, facebook, apple) | cloud.js |
| `plan_created` | Có giáo án mới | `source` (onboarding, default_template, template, blank), `template_id` | app.js `fkApplyDefaultPlan` / `createBlankPlan`, analytics.js (bọc `tplAddToWeek`) |
| `workout_start` | Bắt đầu buổi tập có hướng dẫn | `day_key`, `exercises`, `makeup`, `first_ever` | app.js `startSession` |
| `set_logged` | Bấm "Xong bài" (ghi các hiệp của 1 bài) | `sets`, `timed`, `weighted`, `exercise_index`, `saved` | app.js |
| `workout_finish` | Kết thúc buổi | `completed`, `total`, `saved`, `too_short`, `makeup`, `duration_min`, `volume_kg` (làm tròn 100) | app.js `finishSession` |
| `meal_logged` | Số món hôm nay của 1 bữa tăng (mọi đường thêm món) | `meal` (breakfast/lunch/dinner/snack), `items` | analytics.js (bọc `saveState`, so số món) |
| `recipe_view` | Mở công thức | `recipe_id` | analytics.js (bọc `openRecipe`) |
| `pt_profile_view` | Mở hồ sơ PT | `verified` | analytics.js (bọc `renderPTProfile`) |
| `pt_contact` | Gửi yêu cầu buổi thử / câu hỏi / kết nối PT, nhập mã PT | `type` | analytics.js (bọc `cloud.ptdir.sendRequest`, `cloud.joinByCode`) |
| `theme_change` | Đổi giao diện | `theme` | analytics.js (bọc `fkTheme.set`) |
| `share` | Gọi Web Share API ở bất kỳ đâu | `has_url`, `has_file`, `screen` | analytics.js (bọc `navigator.share`) |
| `feedback_submitted` | Gửi góp ý | `category`, `has_shot`, `has_contact`, `queued`, `trigger` | feedback.js |
| `nps_submitted` | Gửi điểm NPS | `score`, `has_reason`, `trigger`, `queued` | feedback.js |
| `nps_dismissed` | Bấm "Để sau" / đóng NPS | `trigger` | feedback.js |
| `whats_new_view` | Mở "Có gì mới" | `release`, `forced` | feedback.js |
| `$identify` (chỉ nhật ký cục bộ) | Đăng nhập khi đã đồng ý | `id: "hashed"` | analytics.js |

**Phễu gợi ý (PostHog Funnels / GA4 Explorations):**
`app_open(first_open=true) → onboarding_step_view(step=0) → … → onboarding_finish → plan_ready_view → first_workout_cta → workout_start → workout_finish(saved=true)`;
giữ chân: `workout_finish` ở tuần 1 / tuần 4; dinh dưỡng: `meal_logged` ≥ 3 ngày / tuần đầu.

## 6. Thêm sự kiện mới
1. Gọi `fkTrack("ten_moi", { khoa: giaTri })` — chỉ số / boolean / chuỗi ngắn, **không** nội dung người dùng gõ.
2. Thêm 1 dòng vào bảng §5.
3. Nếu sự kiện mới thu loại dữ liệu mới → cập nhật `privacy-policy.html` §3d và nhãn store.

# TapEasy — Rà soát tuân thủ pháp luật Việt Nam (vòng R3 · 14/11/2026)

> **Lưu ý quan trọng**
> - Tài liệu này là **rà soát nội bộ để định hướng sản phẩm, KHÔNG phải ý kiến pháp lý và không thay thế tư vấn của luật sư**. Trước khi phát hành thương mại, hãy nhờ luật sư/đơn vị tư vấn tuân thủ rà lại.
> - Số hiệu văn bản, ngưỡng, thời hạn, mức phạt dưới đây ghi theo hiểu biết tại thời điểm soạn và **có thể đã được sửa đổi, thay thế**. Mỗi mục có dòng **"Cần kiểm tra lại"** — hãy đối chiếu **bản hiện hành** trên Cổng thông tin điện tử Chính phủ / Cơ sở dữ liệu quốc gia về văn bản pháp luật. Đặc biệt giai đoạn 2025–2026 có nhiều luật mới (dữ liệu cá nhân, an ninh mạng, thương mại điện tử, quảng cáo, thuế) và sắp xếp lại bộ máy các Bộ, nên tên cơ quan tiếp nhận thủ tục có thể đã đổi.
> - Mức rủi ro: **Cao** = có thể bị phạt nặng / buộc dừng tính năng / gỡ app; **TB** = cần làm trước khi mở rộng; **Thấp** = nên làm.

## Bảng tổng hợp

| # | Lĩnh vực | Rủi ro | Trạng thái trong mã sau R3 | Việc lớn nhất còn lại (chủ dự án) |
|---|---|---|---|---|
| 1 | Bảo vệ dữ liệu cá nhân (đồng ý, dữ liệu nhạy cảm, quyền chủ thể) | **Cao** | Đã làm: ô đồng ý riêng, nhật ký đồng ý, xuất / xoá, rút đồng ý | Lập & nộp hồ sơ đánh giá tác động; chỉ định người phụ trách bảo vệ dữ liệu |
| 2 | Chuyển dữ liệu cá nhân ra nước ngoài (Firebase – Singapore) | **Cao** | Đã công bố trong chính sách + đồng ý | Lập & nộp hồ sơ đánh giá tác động chuyển dữ liệu ra nước ngoài |
| 3 | An ninh mạng — lưu trữ dữ liệu tại Việt Nam | **TB → Cao** khi có yêu cầu | Chưa có bản lưu tại VN | Phương án lưu bản sao tại VN; đầu mối tiếp nhận yêu cầu cơ quan chức năng |
| 4 | Mạng xã hội (Cộng đồng, bình luận, đánh giá, Khoảnh khắc) | **Cao** | Có báo cáo/chặn/lọc từ/ẩn tự động; xác thực SĐT đã có mã, đang tắt sau cờ | Thông báo / xin giấy phép MXH; bật xác thực SĐT; quy trình gỡ 24 giờ |
| 5 | Thương mại điện tử (Gian hàng) | **TB** (Cao nếu nhận đơn khi chưa làm thủ tục) | Gian hàng trống → "sắp ra mắt"; điều khoản đã nêu | Thông báo/đăng ký với Bộ Công Thương trước khi nhận đơn |
| 6 | Bảo vệ quyền lợi người tiêu dùng | **TB** | Điều khoản, chính sách, kênh khiếu nại đã có chỗ điền | Điền thông tin đơn vị; chính sách đổi trả cụ thể |
| 7 | Quảng cáo thực phẩm chức năng / tuyên bố sức khoẻ | **Cao** nếu bán TPBVSK | Điều khoản cấm + câu cảnh báo bắt buộc | Chỉ đăng sản phẩm có giấy tờ; duyệt nội dung trước |
| 8 | Dịch vụ PT & thanh toán | **TB** | App không giữ tiền; điều khoản đã nêu rõ | Không thêm ví/thu hộ khi chưa có đối tác thanh toán được cấp phép |
| 9 | Thuế | **TB** | Đơn hàng giữ ẩn danh 10 năm | Đăng ký kinh doanh, hoá đơn điện tử, nghĩa vụ cung cấp thông tin người bán |
| 10 | Trẻ em | **Cao** | Xác nhận ≥ 16 tuổi hoặc có đồng ý của cha mẹ | Quy trình xác minh đồng ý của cha mẹ khi có khiếu nại |

---

## 1. Bảo vệ dữ liệu cá nhân

**Văn bản:** Luật Bảo vệ dữ liệu cá nhân 2025 (Luật số 91/2025/QH15, hiệu lực **01/01/2026**) và nghị định quy định chi tiết; Nghị định 13/2023/NĐ-CP (văn bản nền trước đó — nhiều khái niệm, biểu mẫu vẫn được dùng để đối chiếu).
**Cần kiểm tra lại:** nghị định hướng dẫn Luật 2025 hiện hành (số hiệu, biểu mẫu hồ sơ, danh mục dữ liệu nhạy cảm, thời hạn nộp), việc NĐ 13/2023 còn hiệu lực phần nào; mức phạt (Luật 2025 có mức phạt theo % doanh thu đối với một số hành vi).

**Rủi ro: CAO.** TapEasy xử lý **dữ liệu sức khoẻ** (cân nặng, số đo, tỉ lệ mỡ, PAR-Q, mang thai, bệnh nền, nhật ký ăn – ngủ) — thuộc **dữ liệu cá nhân nhạy cảm**. Việc xử lý dữ liệu nhạy cảm kéo theo nghĩa vụ nặng hơn và thường **không được hưởng các miễn trừ** dành cho doanh nghiệp siêu nhỏ / hộ kinh doanh / khởi nghiệp.

| Yêu cầu | Hiện trạng trong app (sau R3) | Việc cần làm |
|---|---|---|
| **Đồng ý rõ ràng, tự nguyện, theo từng mục đích; không tích sẵn; im lặng không phải đồng ý** | ✅ Màn đăng ký có 3 ô tích riêng, không tích sẵn: (1) Điều khoản + Chính sách, (2) đủ 16 tuổi / có đồng ý của cha mẹ, (3) **tuỳ chọn** — xử lý dữ liệu sức khoẻ để sao lưu. Đăng nhập Google/Apple/Facebook lần đầu cũng bị hỏi (màn "Trước khi bắt đầu"). `pt.js` | — |
| **Dữ liệu nhạy cảm: phải thông báo cho chủ thể rằng đây là dữ liệu nhạy cảm** | ✅ Ô tích (3), sheet Sao lưu & đồng bộ, Chính sách bảo mật (hộp nổi bật + mục 2b) đều ghi rõ. Dữ liệu sức khoẻ **không lên máy chủ** nếu chưa đồng ý. `cloud.js` (cloud.sync) | — |
| **Chứng minh được sự đồng ý** | ✅ Nhật ký đồng ý chỉ-thêm: loại, có/không, **phiên bản chính sách**, thời điểm do máy chủ đóng dấu — `users/{uid}/consents`, `firestore.rules` cấm sửa | Khi sửa điều khoản: đổi `POLICY_VERSION` trong `cloud.js` + ngày trong 2 trang HTML → app tự hỏi đồng ý lại |
| **Rút lại sự đồng ý dễ như khi đồng ý** | ✅ Hồ sơ → Tài khoản → Sao lưu & đồng bộ → tắt: xoá ngay bản cloud, ghi dòng "rút đồng ý". Thống kê ẩn danh có công tắc riêng | — |
| **Quyền truy cập / cung cấp dữ liệu** | ✅ "Xuất dữ liệu của tôi" (JSON) — khách cũng dùng được; phần máy chủ qua Function `exportMyData` | Trả lời yêu cầu qua email trong thời hạn luật định (chính sách ghi 7 ngày làm việc) |
| **Quyền xoá** | ✅ Xoá tài khoản trong app + `delete-account.html`; máy chủ dọn toàn bộ (kể cả bản sao lưu, nhật ký đồng ý, OTP); đơn hàng ẩn danh hoá | Thời hạn thực hiện yêu cầu xoá theo luật (thường 72 giờ kể từ khi có yêu cầu) — quy trình hiện xoá ngay |
| **Quyền chỉnh sửa, hạn chế, phản đối** | ✅ Sửa trong Hồ sơ; hạn chế/phản đối = tắt sao lưu, tắt thống kê, chặn người dùng | — |
| **Thông báo xử lý dữ liệu (mục đích, loại dữ liệu, bên nhận, thời hạn lưu, quyền)** | ✅ `privacy-policy.html` bản 2026-11-14: bảng mục đích – căn cứ, bảng thời hạn lưu, bên xử lý, song ngữ | Điền `[ĐIỀN TÊN NHÀ PHÁT TRIỂN]`, `[ĐIỀN EMAIL HỖ TRỢ]` |
| **Tối thiểu hoá dữ liệu; bảo mật** | ✅ Không sao lưu ảnh/video/khoá API; bản sao lưu chỉ chủ tài khoản đọc (quản trị viên cũng không); email không nằm trong hồ sơ công khai; OTP chỉ lưu băm | Bật App Check, xác minh 2 bước cho tài khoản quản trị (docs/DATABASE-SETUP.md §12) |
| **Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân (DPIA)** | ❌ Ngoài mã | **Chủ dự án:** lập hồ sơ theo mẫu, lưu sẵn tại trụ sở và **nộp cho cơ quan chuyên trách bảo vệ dữ liệu cá nhân (Bộ Công an — Cục An ninh mạng và phòng, chống tội phạm sử dụng công nghệ cao)** trong thời hạn luật định (theo NĐ 13/2023 là 60 ngày kể từ ngày bắt đầu xử lý). Nội dung có thể lấy từ Chính sách bảo mật + `functions/index.js → CLEANUP_PLAN` + `docs/DATABASE-SETUP.md §16` |
| **Người / bộ phận phụ trách bảo vệ dữ liệu cá nhân** (bắt buộc khi xử lý dữ liệu nhạy cảm) | ❌ Ngoài mã | **Chủ dự án:** chỉ định (có thể thuê dịch vụ), ghi thông tin liên hệ vào hồ sơ và Chính sách bảo mật |
| **Thông báo vi phạm dữ liệu trong 72 giờ** | ❌ Ngoài mã | **Chủ dự án:** viết quy trình 1 trang: ai phát hiện → ai quyết định → mẫu thông báo cho cơ quan chức năng và người dùng |
| **Hợp đồng với bên xử lý** | Một phần | Chấp nhận/lưu bản *Firebase Data Processing and Security Terms* của Google; hợp đồng với dịch vụ gửi mail / SMS nếu bật OTP |

**Còn lại trong mã (chuyển giao):** dữ liệu sức khoẻ học viên chia sẻ với PT (PAR-Q, số đo) đã có bước đồng ý riêng trong luồng PT Connect — nên ghi thêm vào nhật ký đồng ý chung (`cloud.consent.record`) với loại riêng ở vòng sau.

## 2. Chuyển dữ liệu cá nhân ra nước ngoài

**Văn bản:** Luật BVDLCN 2025 (chương về chuyển dữ liệu xuyên biên giới); NĐ 13/2023 Điều 25; Luật Dữ liệu 2024 (dữ liệu quan trọng / cốt lõi).
**Cần kiểm tra lại:** mẫu hồ sơ, thời hạn nộp, các trường hợp miễn, mức phạt (Luật 2025 quy định mức phạt riêng, tính theo doanh thu, cho vi phạm về chuyển dữ liệu xuyên biên giới).

**Rủi ro: CAO.** Firebase đặt máy chủ ngoài Việt Nam: Firestore / Storage / Functions ở **Singapore (asia-southeast1)**, Firebase Authentication chạy trên hạ tầng toàn cầu của Google (gồm Hoa Kỳ). Lưu dữ liệu người dùng Việt Nam ở đó **là chuyển dữ liệu cá nhân ra nước ngoài**.

| Yêu cầu | Hiện trạng | Việc cần làm |
|---|---|---|
| Chủ thể dữ liệu được biết và đồng ý | ✅ Chính sách bảo mật mục 9b + hộp nổi bật đầu trang; sheet chính sách trong app; ô đồng ý | — |
| **Hồ sơ đánh giá tác động chuyển dữ liệu ra nước ngoài** | ❌ Ngoài mã | **Chủ dự án:** lập và nộp cho Bộ Công an trong thời hạn luật định (NĐ 13/2023: 60 ngày kể từ ngày xử lý). Nêu: bên nhận (Google Asia Pacific Pte. Ltd. / Google LLC), mục đích, loại dữ liệu (có dữ liệu nhạy cảm), biện pháp bảo vệ, văn bản ràng buộc trách nhiệm (điều khoản xử lý dữ liệu của Google) |
| Thông báo sau khi chuyển thành công; cập nhật khi thay đổi | ❌ Ngoài mã | Theo hướng dẫn hiện hành |
| Giảm lượng dữ liệu chuyển | ✅ Sao lưu là tuỳ chọn; ảnh/video/khoá API không chuyển | Cân nhắc lâu dài: nhà cung cấp có vùng dữ liệu tại Việt Nam |

## 3. An ninh mạng — lưu trữ dữ liệu, phối hợp cơ quan chức năng

**Văn bản:** Luật An ninh mạng 2018; Nghị định 53/2022/NĐ-CP (Điều 26–27: lưu trữ dữ liệu tại Việt Nam). Quốc hội đã thông qua **Luật An ninh mạng mới (2025)** hợp nhất với Luật An toàn thông tin mạng.
**Cần kiểm tra lại:** Luật An ninh mạng bản mới đã có hiệu lực chưa và nghị định thay thế NĐ 53/2022; phạm vi "doanh nghiệp trong nước phải lưu trữ dữ liệu tại Việt Nam"; thời gian lưu tối thiểu (NĐ 53: 24 tháng với dữ liệu người dùng, 12 tháng với nhật ký hệ thống phục vụ điều tra).

**Rủi ro: TB — thành Cao khi nhận được yêu cầu của cơ quan chức năng mà không đáp ứng.**

| Yêu cầu | Hiện trạng | Việc cần làm |
|---|---|---|
| Doanh nghiệp **trong nước** cung cấp dịch vụ trên không gian mạng có thu thập dữ liệu cá nhân, dữ liệu do người dùng tạo ra phải **lưu trữ dữ liệu đó tại Việt Nam** | ❌ Dữ liệu chỉ ở Singapore | **Chủ dự án:** hỏi luật sư về cách đáp ứng. Phương án thực tế thường dùng: giữ **một bản sao định kỳ tại Việt Nam** (xuất Firestore hằng ngày về máy chủ / kho lưu trữ đặt tại VN, mã hoá, giới hạn người truy cập). Lệnh xuất có ở `docs/DATABASE-SETUP.md §13` |
| Xác thực thông tin khi người dùng đăng ký tài khoản số; cung cấp thông tin người dùng khi có yêu cầu bằng văn bản | Một phần: email (thư xác minh), SĐT (sau cờ `phoneOtp`) | Quy trình tiếp nhận yêu cầu: 1 email đầu mối, sổ theo dõi |
| Ngăn chặn, gỡ thông tin vi phạm trong **24 giờ** kể từ khi có yêu cầu | ✅ Công cụ có sẵn: Bảng quản trị → Kiểm duyệt, khoá tài khoản | Phân công người trực (xem §4) |
| Lưu nhật ký hệ thống | Một phần: `admin_audit` (thao tác quản trị), nhật ký Cloud Functions (30 ngày mặc định) | Tăng thời gian lưu log trong Google Cloud Logging nếu luật sư xác định cần |

## 4. Mạng xã hội — tính năng Cộng đồng, bình luận, đánh giá, "Khoảnh khắc"

**Văn bản:** Nghị định 147/2024/NĐ-CP về quản lý, cung cấp, sử dụng dịch vụ Internet và thông tin trên mạng (hiệu lực 25/12/2024).
**Cần kiểm tra lại:** ngưỡng phân loại MXH "có lượng truy cập lớn" (theo NĐ 147: từ **10.000 lượt truy cập/tháng** tính trung bình 6 tháng liên tục, hoặc trên **1.000 người sử dụng thường xuyên/tháng**) → phải có **Giấy phép cung cấp dịch vụ mạng xã hội**; dưới ngưỡng → **thông báo** và nhận giấy xác nhận; cơ quan tiếp nhận hiện nay (trước là Bộ Thông tin và Truyền thông — sau sắp xếp bộ máy 2025 cần xác định lại Bộ/Sở tiếp nhận); điều kiện về tên miền `.vn`, nhân sự quản lý nội dung, máy chủ tại Việt Nam.

**Rủi ro: CAO.** Nơi người dùng tạo tài khoản, đăng bài công khai, bình luận, thích, theo dõi nhau **có khả năng bị coi là dịch vụ mạng xã hội** dù chỉ là một tính năng trong app tập luyện.

| Yêu cầu | Hiện trạng | Việc cần làm |
|---|---|---|
| **Thông báo / xin giấy phép MXH** trước khi cung cấp | ❌ Ngoài mã | **Chủ dự án:** quyết định 1 trong 2: **(a)** làm thủ tục thông báo (quy mô nhỏ) rồi xin giấy phép khi vượt ngưỡng; hoặc **(b)** tạm tắt đăng bài công khai (chỉ giữ routine do đội ngũ biên soạn) cho tới khi xong thủ tục. Hỏi luật sư trước khi mở Cộng đồng cho công chúng |
| **Xác thực tài khoản bằng số điện thoại di động tại Việt Nam** (không có SĐT thì bằng số định danh cá nhân); **chỉ tài khoản đã xác thực mới được đăng bài, bình luận, livestream, chia sẻ** | Một phần: mã xác thực SĐT (Firebase Phone Auth) **đã có**, tắt sau cờ `FK_FEATURES.phoneOtp`; `cloud.phoneVerified` trả về trạng thái | **Chủ dự án:** bật `phoneOtp` (cần gói Blaze, giới hạn vùng VN — DATABASE-SETUP §10). **Chuyển giao (community.js / events.js — agent commerce):** khi cờ bật, chặn đăng bài/bình luận/đánh giá nếu `!cloud.phoneVerified` và mở sheet liên kết SĐT |
| **Gỡ nội dung vi phạm pháp luật trong 24 giờ** kể từ khi có yêu cầu của cơ quan chức năng; xử lý khiếu nại của người dùng (NĐ 147: trong 48 giờ) | ✅ Nút Báo cáo ở mọi nội dung công khai, chặn người dùng, lọc từ ngữ, tự ẩn khi ≥ 3 báo cáo, Bảng quản trị có hàng chờ kiểm duyệt. `terms.html` §6 cam kết 24 giờ | **Chủ dự án:** phân công người trực kiểm duyệt hằng ngày (kể cả cuối tuần); ghi sổ xử lý |
| Khoá tạm thời / vĩnh viễn tài khoản vi phạm; gỡ ngay nội dung ảnh hưởng an ninh quốc gia | ✅ `banUser` (Functions), rules chặn người bị khoá ghi nội dung ngay lập tức | — |
| **Thoả thuận cung cấp và sử dụng dịch vụ MXH** công khai: nội dung cấm, cơ chế xử lý, quyền – trách nhiệm | ✅ `terms.html` §4–6 (quy tắc cộng đồng, nội dung bị cấm, kiểm duyệt) — người dùng phải tích đồng ý | Luật sư rà cho khớp mẫu yêu cầu của hồ sơ giấy phép |
| Bảo vệ trẻ em: tài khoản của người dưới 16 tuổi do cha mẹ/người giám hộ đăng ký và giám sát | Một phần: ô xác nhận ≥ 16 tuổi hoặc có đồng ý của cha mẹ | Cân nhắc **không cho** người tự khai dưới 16 tuổi đăng bài công khai (chuyển giao community.js) |
| Lưu thông tin tài khoản, nhật ký đăng nhập / đăng bài để cung cấp khi có yêu cầu | Một phần (Firebase Auth lưu thời điểm tạo / đăng nhập gần nhất; nội dung có `createdAt`, `authorUid`) | Xem §3 |

## 5. Thương mại điện tử — Gian hàng

**Văn bản:** Nghị định 52/2013/NĐ-CP, sửa đổi bởi Nghị định 85/2021/NĐ-CP; Luật Giao dịch điện tử 2023. Quốc hội đã thông qua **Luật Thương mại điện tử (2025)**.
**Cần kiểm tra lại:** Luật Thương mại điện tử mới đã có hiệu lực chưa và thay đổi gì về phân loại nền tảng (bán hàng trực tiếp / trung gian / mạng xã hội có hoạt động TMĐT), nghĩa vụ định danh người bán; thủ tục trên Cổng `online.gov.vn`.

**Rủi ro: TB — thành Cao nếu nhận đơn khi chưa làm thủ tục.**

| Tình huống | Nghĩa vụ | Hiện trạng / việc cần làm |
|---|---|---|
| Gian hàng **chỉ hiển thị, giới thiệu** sản phẩm, **không có chức năng đặt hàng trực tuyến** | Theo NĐ 85/2021: **không phải thông báo** với Bộ Công Thương (vẫn phải công bố thông tin chủ sở hữu, hàng hoá trung thực) | ✅ Khi chưa có sản phẩm, Gian hàng hiện "sắp ra mắt", không nhận đơn |
| Gian hàng **có chức năng đặt hàng trực tuyến**, chỉ bán hàng của **chính chủ app** | **Thông báo** website/ứng dụng TMĐT bán hàng với Bộ Công Thương (online.gov.vn) **trước khi** nhận đơn; gắn biểu tượng "đã thông báo" | ⚠️ Mã **có** chức năng đặt hàng (Cloud Function `createOrder`). **Chủ dự án:** làm thủ tục thông báo **trước khi đăng sản phẩm đầu tiên**; cần có đăng ký kinh doanh / mã số thuế |
| Cho **người bán khác** (PT, nhãn hàng) mở gian hàng | Là **sàn giao dịch TMĐT** → phải **đăng ký** (không chỉ thông báo), có quy chế hoạt động, cơ chế giải quyết tranh chấp, xác minh danh tính người bán | Hiện chưa mở cho bên thứ ba. **Không mở** khi chưa đăng ký |
| Thông tin bắt buộc hiển thị | Tên, địa chỉ, mã số thuế/số ĐKKD, liên hệ của thương nhân; giá gồm thuế – phí; điều kiện giao dịch; chính sách đổi trả, giao hàng, thanh toán; cho phép khách rà soát và xác nhận đơn | Một phần: `terms.html` §8 có khung, còn `[ĐIỀN ĐỊA CHỈ]`, `[ĐIỀN MÃ SỐ THUẾ / SỐ ĐKKD]`. **Chuyển giao (shop.js):** hiển thị thông tin người bán + chính sách ngay trên trang sản phẩm và bước xác nhận đơn |

## 6. Bảo vệ quyền lợi người tiêu dùng

**Văn bản:** Luật Bảo vệ quyền lợi người tiêu dùng 2023 (Luật số 19/2023/QH15, hiệu lực 01/7/2024); Nghị định 55/2024/NĐ-CP.
**Cần kiểm tra lại:** nghĩa vụ riêng của tổ chức thiết lập, vận hành **nền tảng số trung gian**; quy định giao dịch từ xa; danh mục hàng hoá – dịch vụ phải đăng ký hợp đồng theo mẫu / điều kiện giao dịch chung.

**Rủi ro: TB.**

| Yêu cầu | Hiện trạng | Việc cần làm |
|---|---|---|
| Thông tin minh bạch, chính xác về hàng hoá, dịch vụ, người cung cấp | ✅ Khung trong `terms.html`; nhãn "PT đã xác minh" được giải thích rõ không phải cam kết chất lượng | Điền thông tin đơn vị |
| Bảo vệ thông tin người tiêu dùng; không thu thập quá mức; xin đồng ý | ✅ Xem §1 | — |
| Điều kiện giao dịch chung không có điều khoản bất lợi không công bằng | ✅ `terms.html` §11 ghi rõ không loại trừ quyền mà luật không cho phép loại trừ | Luật sư rà mục Giới hạn trách nhiệm |
| Kênh tiếp nhận, giải quyết phản ánh – khiếu nại | Một phần: Góp ý & ticket hỗ trợ trong app, email hỗ trợ | Điền email; cam kết thời hạn phản hồi (đang ghi 7 ngày làm việc) |
| Đánh giá của người dùng trung thực; không thao túng đánh giá | ✅ Quyền đánh giá PT do máy chủ cấp sau buổi tập thật; 1 đánh giá/người | — |
| Giao dịch từ xa: cung cấp xác nhận đơn, quyền huỷ/đổi trả | Một phần | Viết chính sách đổi trả cụ thể trước khi bán |

## 7. Quảng cáo thực phẩm chức năng, tuyên bố sức khoẻ

**Văn bản:** Luật Quảng cáo 2012 (đã sửa đổi 2025); Luật An toàn thực phẩm 2010; Nghị định 15/2018/NĐ-CP; Nghị định 181/2013/NĐ-CP; Nghị định 38/2021/NĐ-CP (xử phạt).
**Cần kiểm tra lại:** quy định mới của Luật Quảng cáo sửa đổi về **người chuyển tải sản phẩm quảng cáo** (người có ảnh hưởng — có thể áp dụng cho PT đăng bài giới thiệu sản phẩm) và quảng cáo trên nền tảng số.

**Rủi ro: CAO nếu Gian hàng / Cộng đồng có thực phẩm bảo vệ sức khoẻ (whey, BCAA, vitamin, "đốt mỡ"…); Thấp nếu không có.**

| Yêu cầu | Hiện trạng | Việc cần làm |
|---|---|---|
| Thực phẩm bảo vệ sức khoẻ phải có **giấy tiếp nhận đăng ký bản công bố sản phẩm** và **giấy xác nhận nội dung quảng cáo** trước khi quảng cáo | Ngoài mã | **Chủ dự án:** chỉ đăng sản phẩm đã có đủ giấy tờ; lưu bản chụp |
| Bắt buộc có câu: **"Thực phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh."** | ✅ Có trong `terms.html` §8 và sheet Điều khoản trong app | **Chuyển giao (shop.js / shop-data.js):** tự chèn câu này trên trang chi tiết mọi sản phẩm thuộc nhóm thực phẩm bổ sung |
| Cấm quảng cáo gây hiểu nhầm là thuốc; cấm dùng hình ảnh, uy tín của cơ sở y tế, bác sĩ, thư cảm ơn của người bệnh | ✅ `terms.html` §5 cấm; bộ lọc từ ngữ của Cộng đồng | Bổ sung các cụm "chữa khỏi", "trị dứt điểm", "thay thế thuốc" vào bộ lọc (chuyển giao cloud-social / community) |
| Tuyên bố sức khoẻ của **chính app** | ✅ Miễn trừ y khoa ở Điều khoản, Chính sách, onboarding, màn Sức khoẻ & an toàn; app không tuyên bố chữa bệnh | Rà mô tả trên App Store / Google Play: không dùng "giảm X kg trong Y ngày", "điều trị" |
| Bài viết Kho kiến thức | Do đội ngũ biên soạn, có nguồn | Giữ ghi nguồn; không biến thành quảng cáo trá hình |

## 8. Dịch vụ PT & thanh toán

**Văn bản:** Bộ luật Dân sự 2015 (hợp đồng dịch vụ); Luật Các tổ chức tín dụng 2024 và Nghị định 52/2024/NĐ-CP về thanh toán không dùng tiền mặt (dịch vụ trung gian thanh toán phải có giấy phép của Ngân hàng Nhà nước); Luật Thể dục, thể thao.
**Cần kiểm tra lại:** điều kiện kinh doanh hoạt động thể thao đối với cơ sở/PT (chứng chỉ người hướng dẫn tập luyện) nếu TapEasy tự đứng ra cung cấp dịch vụ huấn luyện.

**Rủi ro: TB.**

| Vấn đề | Hiện trạng | Việc cần làm |
|---|---|---|
| **App KHÔNG giữ tiền** — không ví, không thu hộ – chi hộ học phí | ✅ Không có mã thu hộ; thanh toán PT ↔ học viên diễn ra ngoài app. `terms.html` §7–8 ghi rõ | **Không** thêm ví, số dư, thu hộ học phí khi chưa hợp tác với **trung gian thanh toán được cấp phép**. Nếu sau này thu tiền trong app: dùng cổng thanh toán có giấy phép, tiền đi thẳng về người bán |
| Vai trò của TapEasy với PT | ✅ Điều khoản: công cụ kết nối, không tuyển dụng / bảo lãnh PT, không là bên trong hợp đồng | Luật sư rà để tránh bị coi là bên cung cấp dịch vụ huấn luyện |
| Xác minh PT | ✅ Quy trình gửi chứng chỉ → quản trị duyệt; nhãn được giải thích | Lưu hồ sơ xác minh có thời hạn; chỉ nhân sự có quyền `pt.verify` xem |
| Dữ liệu sức khoẻ học viên PT nhìn thấy | ✅ Học viên chủ động chia sẻ, rút lại được; rules chỉ cho 2 bên đọc | Xem §1 |
| Mua trong ứng dụng (Apple/Google) | Chưa có nội dung số trả phí | Nếu bán gói số (giáo án trả phí, đăng ký Pro) phải dùng In-App Purchase của store; dịch vụ ngoài đời thực (buổi tập trực tiếp) thì không |

## 9. Thuế

**Văn bản:** Luật Quản lý thuế 2019 và các nghị định, thông tư hướng dẫn; Nghị định 123/2020/NĐ-CP (hoá đơn điện tử) và sửa đổi; Nghị định 117/2025/NĐ-CP về quản lý thuế đối với hoạt động kinh doanh trên nền tảng thương mại điện tử, nền tảng số của hộ, cá nhân; Luật Kế toán 2015 (lưu chứng từ tối thiểu 10 năm).
**Cần kiểm tra lại:** chính sách thuế hộ kinh doanh từ 2026 (bỏ thuế khoán, ngưỡng doanh thu chịu thuế mới); nghĩa vụ **khấu trừ, nộp thuế thay** của nền tảng **có chức năng đặt hàng và thanh toán**; nghĩa vụ cung cấp thông tin người bán cho cơ quan thuế.

**Rủi ro: TB.**

| Vấn đề | Hiện trạng | Việc cần làm (chủ dự án) |
|---|---|---|
| Đăng ký kinh doanh, mã số thuế | Ngoài mã | Có tư cách pháp lý (hộ kinh doanh / công ty) trước khi có doanh thu; ghi vào `terms.html` |
| Hoá đơn điện tử cho đơn hàng | Ngoài mã | Xuất hoá đơn theo quy định; đơn hàng trong hệ thống có mã, mặt hàng, số tiền, ngày để đối chiếu |
| Lưu chứng từ 10 năm | ✅ Đơn hàng được **ẩn danh hoá** (giữ số tiền, xoá tên/SĐT/địa chỉ) khi người dùng xoá tài khoản — cân bằng giữa quyền xoá và nghĩa vụ kế toán | — |
| Nền tảng có người bán là hộ, cá nhân | Chưa mở | Nếu mở cho PT/người bán khác **và** có thanh toán trong app → phát sinh nghĩa vụ khấu trừ, kê khai, nộp thay. Hiện app không có chức năng thanh toán → người bán tự kê khai; vẫn có thể phải cung cấp thông tin người bán khi cơ quan thuế yêu cầu |
| Thu nhập của PT | Điều khoản: PT tự chịu trách nhiệm thuế | — |
| Phí Apple / Google, dịch vụ nước ngoài (Firebase) | Ngoài mã | Hỏi kế toán về thuế nhà thầu / chứng từ chi phí |

## 10. Trẻ em và người chưa thành niên

**Văn bản:** Luật Trẻ em 2016 (trẻ em = dưới 16 tuổi); Luật BVDLCN 2025 và NĐ 13/2023 Điều 20 (xử lý dữ liệu cá nhân của trẻ em cần sự đồng ý của cha, mẹ hoặc người giám hộ; trẻ từ đủ 7 tuổi còn cần sự đồng ý của chính trẻ); NĐ 147/2024 (tài khoản MXH của trẻ dưới 16 tuổi).
**Cần kiểm tra lại:** yêu cầu **xác minh tuổi** và cách chứng minh sự đồng ý của cha mẹ theo nghị định hướng dẫn mới.

**Rủi ro: CAO** (dữ liệu trẻ em + dữ liệu sức khoẻ).

| Yêu cầu | Hiện trạng | Việc cần làm |
|---|---|---|
| Đồng ý của cha mẹ/người giám hộ với người dưới 16 tuổi | ✅ Ô tích bắt buộc "đã đủ 16 tuổi, hoặc đã có sự đồng ý của cha mẹ/người giám hộ"; ghi vào nhật ký đồng ý; Chính sách §11, Điều khoản §2 | Tự khai là mức tối thiểu. Nếu nhắm tới học sinh: thêm bước xác nhận qua email/SĐT của cha mẹ (vòng sau) |
| Cha mẹ yêu cầu xoá / rút đồng ý | ✅ Kênh email + xoá tài khoản | Quy trình xác minh quan hệ cha mẹ – con trước khi thực hiện |
| An toàn nội dung và sức khoẻ cho người dưới 18 | ✅ Không đặt thâm hụt calo cho người dưới 18, nhắc tập có giám sát (health-safety) | — |
| App Store / Google Play: phân loại độ tuổi | Ngoài mã | Khai đúng bảng câu hỏi nội dung; có nội dung do người dùng tạo → khai báo trung thực |

---

## Việc đã làm trong mã ở vòng R3 (thuộc file của agent cloud)

1. **Màn đồng ý khi đăng ký** — 3 ô riêng, không tích sẵn; màn "Trước khi bắt đầu" cho đăng nhập mạng xã hội; sheet "Cập nhật điều khoản" cho tài khoản cũ (`pt.js`).
2. **Nhật ký đồng ý** có phiên bản chính sách + thời điểm máy chủ, chỉ-thêm (`cloud.js → cloud.consent`, `firestore.rules`).
3. **Dữ liệu sức khoẻ chỉ lên máy chủ khi có đồng ý riêng**; rút đồng ý xoá ngay bản cloud (`cloud.js → cloud.sync`).
4. **Xuất dữ liệu của tôi** (JSON) cho cả khách; Function `exportMyData` gom phần máy chủ (`cloud.js`, `functions/account.js`).
5. **Xoá tài khoản thật** ở cả bản dùng thử và Firebase: thêm xoá bản sao lưu, nhật ký đồng ý, OTP; tuỳ chọn xoá cả dữ liệu trên máy (`cloud.js`, `pt.js`, `functions/index.js`).
6. **Chính sách bảo mật** bản 2026-11-14 song ngữ; **Điều khoản sử dụng** mới song ngữ (`privacy-policy.html`, `terms.html`).
7. **Chống dò email**, giới hạn gửi lại 60 giây, OTP chỉ lưu băm (`cloud.js`, `functions/account.js`).
8. **Xác thực số điện thoại Việt Nam** — đã có mã, bật bằng cờ `phoneOtp` (`cloud.js → cloud.phone`, `cloud.phoneVerified`).

## Việc của chủ dự án (ngoài mã) — xếp theo thứ tự nên làm

1. **Tư cách pháp lý:** đăng ký kinh doanh, mã số thuế; điền các chỗ `[ĐIỀN …]` trong `privacy-policy.html`, `terms.html`.
2. **Thuê luật sư rà** tài liệu này + 2 trang chính sách (ưu tiên §1, §2, §4).
3. **Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân** + **hồ sơ đánh giá tác động chuyển dữ liệu ra nước ngoài** → nộp Bộ Công an đúng hạn; chỉ định người phụ trách bảo vệ dữ liệu.
4. **Cộng đồng:** quyết định thông báo / xin giấy phép mạng xã hội **trước khi** mở đăng bài công khai; bật `phoneOtp`; phân công trực kiểm duyệt 24 giờ.
5. **Gian hàng:** thông báo với Bộ Công Thương **trước khi** nhận đơn đầu tiên; chỉ bán thực phẩm bảo vệ sức khoẻ có đủ giấy tờ.
6. **Lưu trữ tại Việt Nam:** phương án bản sao dữ liệu trong nước; đầu mối tiếp nhận yêu cầu cơ quan chức năng.
7. **Quy trình sự cố dữ liệu** (thông báo 72 giờ) và **quy trình trả lời yêu cầu của chủ thể dữ liệu**.
8. **Không** thêm ví / thu hộ tiền khi chưa có đối tác trung gian thanh toán được cấp phép.

## Chuyển giao cho agent khác (trong mã, không thuộc file của agent cloud)

| File | Việc | Lý do |
|---|---|---|
| `community.js`, `events.js` (bình luận, Khoảnh khắc), `findpt.js` (đánh giá) | Khi `FK_FEATURES.phoneOtp === true`: chặn đăng bài / bình luận / đánh giá nếu `!cloud.phoneVerified`, mở `openLinkedSheet()` để liên kết SĐT | NĐ 147/2024 — xác thực SĐT (§4) |
| `shop.js`, `shop-data.js` | Tự chèn câu "Thực phẩm này không phải là thuốc…" cho nhóm thực phẩm bổ sung; hiển thị thông tin người bán + chính sách đổi trả ở trang sản phẩm và bước xác nhận đơn | §5, §7 |
| `cloud-social.js` (bộ lọc từ ngữ) | Thêm cụm tuyên bố chữa bệnh: "chữa khỏi", "trị dứt điểm", "thay thế thuốc", "cam kết giảm … kg" | §7 |
| `index.html` (agent ux) | CSP cho reCAPTCHA khi bật `phoneOtp`; liên kết `terms.html` ở chân trang landing | §4, DATABASE-SETUP §10 |
| `sw.js` (agent ux) | Thêm `terms.html` vào ASSETS | Xem được điều khoản khi ngoại tuyến |

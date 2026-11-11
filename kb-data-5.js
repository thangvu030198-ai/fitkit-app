/* =========================================================================
   TapEasy — Kho kiến thức · DỮ LIỆU 5/6 — DÀNH CHO PT
   Chuyên mục: Nghề PT & chứng chỉ (3) · Sàng lọc & đánh giá (3) · Lập trình giáo án (4)
               · Kinh doanh PT (5) · Giao tiếp & đạo đức (2)
   Định dạng: xem đầu kb-data-1.js. Nội dung pháp lý mang tính tham khảo, cập nhật 11/2026.
   ========================================================================= */
(function(){
var A = (window.KB_ARTICLES = window.KB_ARTICLES || []);
var U = "2026-11-10";
var GETP = "American College of Sports Medicine. ACSM's Guidelines for Exercise Testing and Prescription, 11th ed. Wolters Kluwer, 2021.";
var NSCA = "Haff GG, Triplett NT (eds). Essentials of Strength Training and Conditioning, 4th ed. NSCA – Human Kinetics, 2016.";
var NSCAPT = "Schoenfeld BJ, Snarr RL (eds). NSCA's Essentials of Personal Training, 3rd ed. Human Kinetics, 2022.";
var ACE = "American Council on Exercise. ACE Personal Trainer Manual – các chương về kinh doanh, pháp lý và trách nhiệm nghề nghiệp.";
var RIEBE = "Riebe D, et al. Updating ACSM's recommendations for exercise preparticipation health screening. Med Sci Sports Exerc 2015;47(11):2473–2479.";
var BLDS = "Quốc hội. Bộ luật Dân sự 2015 (Luật số 91/2015/QH13) – hợp đồng dịch vụ (Điều 513–521); quyền của cá nhân đối với hình ảnh (Điều 32).";
var BVQLNTD = "Quốc hội. Luật Bảo vệ quyền lợi người tiêu dùng 2023 (Luật số 19/2023/QH15), hiệu lực từ 01/7/2024.";
var BVDLCN = "Quốc hội. Luật Bảo vệ dữ liệu cá nhân 2025 (Luật số 91/2025/QH15), hiệu lực từ 01/01/2026; Nghị định 356/2025/NĐ-CP hướng dẫn thi hành.";
var MI = "Miller WR, Rollnick S. Motivational Interviewing: Helping People Change, 3rd ed. Guilford Press, 2013.";
var TEIX = "Teixeira PJ, et al. Exercise, physical activity, and self-determination theory: a systematic review. Int J Behav Nutr Phys Act 2012;9:78.";
var VBPL = { t:"Cơ sở dữ liệu quốc gia về văn bản pháp luật.", u:"https://vbpl.vn/" };

A.push(
/* ======================= NGHỀ PT & CHỨNG CHỈ ======================= */
{ id:"pt-chung-chi", cat:"pt-nghe", audience:"pt", updated:U,
  title:"Chứng chỉ PT quốc tế: chọn chứng chỉ nào khi hành nghề ở Việt Nam",
  summary:"Tiêu chí chọn chứng chỉ có kiểm định độc lập, so sánh NASM, ACE, ACSM, NSCA và lộ trình 12 tháng cho PT mới.",
  tags:["chứng chỉ","NASM","ACE","ACSM","NSCA","CSCS","nghề PT"],
  sources:[{ t:"Institute for Credentialing Excellence – NCCA Accreditation.", u:"https://www.credentialingexcellence.org/" },
    { t:"National Strength and Conditioning Association – Certifications (CSCS, NSCA-CPT).", u:"https://www.nsca.com/" },
    { t:"American College of Sports Medicine – Certification.", u:"https://www.acsm.org/" },
    { t:"National Academy of Sports Medicine – CPT.", u:"https://www.nasm.org/" },
    { t:"American Council on Exercise – Certifications.", u:"https://www.acefitness.org/" }],
  body:`Thị trường Việt Nam có nhiều khoá "PT cấp tốc". Một chứng chỉ uy tín giúp bạn có **nền kiến thức chuẩn** và tạo dựng niềm tin với khách hàng.

## Tiêu chí chọn chứng chỉ

1. **Được kiểm định độc lập:** ở Mỹ, chuẩn phổ biến là **NCCA** (thuộc Institute for Credentialing Excellence). Chứng chỉ đạt kiểm định NCCA có quy trình thi độc lập và ngân hàng câu hỏi được thẩm định.
2. **Có yêu cầu tái chứng nhận** bằng tín chỉ đào tạo liên tục (CEU).
3. **Yêu cầu chứng nhận CPR/AED** còn hiệu lực.

## So sánh nhanh các chứng chỉ phổ biến

| Chứng chỉ | Tổ chức | Điểm mạnh | Hợp với |
|---|---|---|---|
| CPT | NASM | Mô hình OPT, chỉnh mất cân bằng tư thế | PT tại phòng gym thương mại |
| CPT | ACE | Thay đổi hành vi, kỹ năng coaching | PT cho khách mới, khách giảm cân |
| CPT, EP-C | ACSM | Gắn với y học thể thao, sàng lọc kỹ | Khách có bệnh mạn tính đã ổn định |
| NSCA-CPT, **CSCS** | NSCA | Nền khoa học sức mạnh; CSCS yêu cầu bằng cử nhân | PT sức mạnh, huấn luyện viên thể lực |

Trước khi đăng ký, hãy kiểm tra tình trạng kiểm định NCCA hiện hành của chứng chỉ trên trang của ICE.

## Ở Việt Nam

Nhiều tỉnh, thành tổ chức lớp **"Tập huấn chuyên môn cho người hướng dẫn tập luyện môn Thể dục thể hình và Fitness"** theo quy định của Bộ Văn hoá, Thể thao và Du lịch. Đọc [[kb:pt-phap-ly-viet-nam]].

:::ap-dung
Lập kế hoạch 12 tháng: 1 chứng chỉ nền tảng + CPR/AED + 1 chuyên đề sâu (dinh dưỡng thể thao, tập sau chấn thương, phụ nữ sau sinh…). Ghi chứng chỉ vào hồ sơ PT trên TapEasy.
:::

:::luu-y
Chứng chỉ không thay thế được kinh nghiệm. Trong 6–12 tháng đầu, hãy làm việc dưới sự kèm cặp của một PT nhiều kinh nghiệm.
:::` },

{ id:"pt-phap-ly-viet-nam", cat:"pt-nghe", audience:"pt", updated:U,
  title:"Pháp lý cơ bản cho PT tại Việt Nam: điều kiện, hợp đồng, thuế, dữ liệu",
  summary:"Các văn bản ngành thể thao liên quan đến fitness, hợp đồng dịch vụ, thay đổi về thuế từ 2026 và Luật Bảo vệ dữ liệu cá nhân.",
  tags:["pháp lý","thuế","hợp đồng","dữ liệu cá nhân","Việt Nam"],
  sources:["Quốc hội. Luật Thể dục, thể thao 2006 (Luật số 77/2006/QH11), sửa đổi, bổ sung 2018 (Luật số 26/2018/QH14).",
    "Chính phủ. Nghị định 36/2019/NĐ-CP quy định chi tiết một số điều của Luật sửa đổi, bổ sung một số điều của Luật Thể dục, thể thao.",
    "Bộ VHTTDL. Thông tư 10/2018/TT-BVHTTDL quy định về cơ sở vật chất, trang thiết bị và tập huấn nhân viên chuyên môn đối với môn Thể dục thể hình và Fitness.",
    "Bộ VHTTDL. Thông tư 07/2021/TT-BVHTTDL quy định về tập huấn chuyên môn thể thao đối với người hướng dẫn tập luyện thể thao.",
    BLDS, BVQLNTD, BVDLCN, VBPL],
  body:`:::luu-y
Bài viết mang tính **tham khảo, cập nhật đến 11/2026**, không phải tư vấn pháp lý. Quy định thay đổi thường xuyên. Hãy đối chiếu văn bản gốc trên Cơ sở dữ liệu quốc gia về văn bản pháp luật, hoặc hỏi luật sư, cơ quan thuế, Sở Văn hoá, Thể thao và Du lịch tại địa phương.
:::

## 1. Văn bản ngành thể thao

| Văn bản | Nội dung liên quan |
|---|---|
| Luật Thể dục, thể thao 2006, sửa đổi 2018 | Khung pháp lý cho kinh doanh hoạt động thể thao |
| Nghị định 36/2019/NĐ-CP | Điều kiện kinh doanh hoạt động thể thao |
| Thông tư 10/2018/TT-BVHTTDL | Cơ sở vật chất, trang thiết bị và **tập huấn nhân viên chuyên môn** môn Thể dục thể hình và Fitness |
| Thông tư 07/2021/TT-BVHTTDL | Tập huấn chuyên môn thể thao cho người hướng dẫn tập luyện |

PT làm việc tại phòng tập thường thuộc đội ngũ nhân viên chuyên môn của cơ sở đó. PT tự do mở lớp hoặc mở phòng tập riêng cần tìm hiểu điều kiện kinh doanh và thủ tục đăng ký phù hợp.

## 2. Hợp đồng

Dịch vụ PT là **hợp đồng dịch vụ** theo Bộ luật Dân sự 2015. Khi dùng hợp đồng mẫu cho nhiều khách, cần lưu ý quy định về hợp đồng theo mẫu và điều kiện giao dịch chung trong **Luật Bảo vệ quyền lợi người tiêu dùng 2023**. Đọc [[kb:pt-hop-dong]].

## 3. Thuế

Từ **01/01/2026**, phương pháp **thuế khoán** đối với hộ, cá nhân kinh doanh **đã bị bãi bỏ**, chuyển sang tự kê khai theo doanh thu thực tế. Ngưỡng doanh thu được miễn thuế và cách tính đã có nhiều thay đổi trong năm 2026, vì vậy hãy tra cứu quy định hiện hành hoặc hỏi cơ quan thuế, kế toán. PT làm công ăn lương tại phòng tập thì được phòng tập khấu trừ thuế thu nhập cá nhân theo quy định.

## 4. Dữ liệu khách hàng

**Luật Bảo vệ dữ liệu cá nhân 2025** (Luật số 91/2025/QH15) có hiệu lực từ **01/01/2026**, kèm Nghị định 356/2025/NĐ-CP hướng dẫn. Hồ sơ sức khoẻ, ảnh cơ thể, số đo của khách là dữ liệu cần được bảo vệ đặc biệt: chỉ thu thập khi cần, có sự đồng ý của khách, lưu trữ an toàn và không chia sẻ cho bên thứ ba.

:::ap-dung
Chuẩn bị "bộ hồ sơ pháp lý" gồm: hợp đồng dịch vụ, chính sách huỷ buổi, mẫu đồng ý xử lý dữ liệu và chụp ảnh, phiếu sàng lọc sức khoẻ. Lưu bản có chữ ký của khách cùng hồ sơ học viên trên TapEasy PT.
:::` },

{ id:"pt-pham-vi-hanh-nghe", cat:"pt-nghe", audience:"pt", updated:U,
  title:"Phạm vi hành nghề của PT: làm gì, không làm gì, khi nào chuyển tuyến",
  summary:"Ranh giới giữa huấn luyện và chẩn đoán, điều trị. Danh sách tình huống cần giới thiệu khách đến chuyên gia khác và cách nói.",
  tags:["phạm vi hành nghề","chuyển tuyến","an toàn","đạo đức"],
  sources:[GETP, NSCAPT, ACE],
  body:`PT là chuyên gia **vận động và tập luyện** cho người khoẻ mạnh, hoặc người có yếu tố nguy cơ đã được kiểm soát. Hiểu rõ ranh giới giúp bảo vệ khách hàng và chính bạn.

## Trong và ngoài phạm vi

| PT **nên** làm | PT **không** làm |
|---|---|
| Sàng lọc sức khoẻ (PAR-Q+), đánh giá thể lực | Chẩn đoán bệnh, chấn thương ("em bị thoát vị đĩa đệm rồi") |
| Thiết kế và hướng dẫn chương trình tập | Kê đơn thuốc, khuyên khách ngừng thuốc |
| Giáo dục dinh dưỡng chung theo hướng dẫn chính thống | Lập thực đơn **điều trị** bệnh (tiểu đường, bệnh thận, gout…) |
| Theo dõi, động viên, xây thói quen | Trị liệu tâm lý, điều trị rối loạn ăn uống |
| Phối hợp với bác sĩ, chuyên viên vật lý trị liệu | Xoa bóp trị liệu, nắn chỉnh khi không có chứng chỉ phù hợp |

## Khi nào nên chuyển tuyến?

- Khách trả lời "Có" ở PAR-Q+ nhưng chưa có ý kiến bác sĩ.
- Cơn đau không cải thiện sau 2–3 tuần điều chỉnh bài tập, đau về đêm, tê hoặc yếu chi.
- Có dấu hiệu rối loạn ăn uống hoặc trầm cảm.
- Thai kỳ có biến chứng; sau sinh có triệu chứng vùng sàn chậu.
- Huyết áp lúc nghỉ rất cao (ví dụ từ 160/100 mmHg trở lên): đề nghị khách được bác sĩ đánh giá trước khi tập.

## Cách nói với khách

"Mình thấy dấu hiệu này nằm ngoài chuyên môn của PT. Bạn nên gặp bác sĩ hoặc chuyên viên vật lý trị liệu để kiểm tra. Trong lúc chờ, mình sẽ điều chỉnh bài tập để bạn vẫn tập an toàn."

:::ap-dung
Lập danh bạ 3–5 chuyên gia uy tín gần bạn (bác sĩ y học thể thao, chuyên viên vật lý trị liệu, chuyên gia dinh dưỡng lâm sàng, chuyên gia tâm lý) để giới thiệu khi cần.
:::

:::an-toan
Tham gia lớp **CPR/AED** và biết vị trí máy AED, tủ sơ cứu tại phòng tập. Khi khách gặp sự cố, bạn thường là người có mặt đầu tiên.
:::` },

/* ======================= SÀNG LỌC & ĐÁNH GIÁ ======================= */
{ id:"pt-sang-loc-acsm", cat:"pt-sang-loc", audience:"pt", updated:U,
  title:"Sàng lọc trước tập theo ACSM: quy trình 3 câu hỏi",
  summary:"Cách ACSM sàng lọc từ năm 2015: tình trạng tập luyện, bệnh đã biết và triệu chứng. Bảng quyết định và mốc huyết áp.",
  tags:["sàng lọc","ACSM","PAR-Q+","huyết áp","an toàn"],
  ex:["walking"],
  sources:[RIEBE,
    "Warburton DER, Jamnik VK, Bredin SSD, Gledhill N. The Physical Activity Readiness Questionnaire for Everyone (PAR-Q+) and electronic Physical Activity Readiness Medical Examination (ePARmed-X+). Health Fit J Can 2011;4(2):3–23.",
    "Whelton PK, et al. 2017 ACC/AHA guideline for the prevention, detection, evaluation, and management of high blood pressure in adults. Hypertension 2018;71(6):e13–e115.", GETP],
  body:`Năm 2015, ACSM bỏ cách phân tầng nguy cơ dựa trên nhiều yếu tố và chuyển sang quy trình gọn hơn dựa trên **3 câu hỏi** (Riebe, 2015). Mục tiêu: không tạo rào cản không cần thiết, nhưng vẫn phát hiện được người cần bác sĩ đánh giá.

## 3 câu hỏi

1. Khách **có đang tập đều** không? (ít nhất 30 phút cường độ vừa, ít nhất 3 ngày/tuần, trong ít nhất 3 tháng qua)
2. Khách có **bệnh tim mạch, chuyển hoá (tiểu đường týp 1 hoặc 2) hoặc bệnh thận** đã được chẩn đoán không?
3. Khách có **dấu hiệu hoặc triệu chứng** gợi ý các bệnh trên không? (đau ngực, khó thở khi nghỉ hoặc khi gắng sức nhẹ, chóng mặt, ngất, phù cổ chân, hồi hộp đánh trống ngực, đau cách hồi, khó thở khi nằm)

## Bảng quyết định (tóm tắt)

| | Không bệnh, không triệu chứng | Có bệnh, **không** triệu chứng | **Có triệu chứng** |
|---|---|---|---|
| **Chưa tập đều** | Bắt đầu nhẹ đến vừa, tăng dần | Cần bác sĩ đồng ý, sau đó bắt đầu nhẹ đến vừa | Cần bác sĩ đồng ý |
| **Đang tập đều** | Tiếp tục, tăng dần | Tập vừa được; muốn lên cường độ cao cần bác sĩ đồng ý | **Ngừng tập**, cần bác sĩ đồng ý trước khi quay lại |

## Bổ sung khi tư vấn

- Làm **PAR-Q+** đầy đủ và lưu bản có chữ ký.
- Đo **huyết áp lúc nghỉ** sau khi khách ngồi yên khoảng 5 phút. Theo ACC/AHA (2017): từ 130/80 mmHg là tăng huyết áp độ 1, từ 140/90 mmHg là độ 2.
- Hỏi về thuốc đang dùng, chấn thương, phẫu thuật, thai kỳ.

:::ap-dung
Dùng phần sức khoẻ trong hồ sơ học viên của TapEasy PT để lưu kết quả sàng lọc. Ghi rõ ngày, kết quả và "cần / không cần bác sĩ đồng ý".
:::

:::an-toan
Khách xuất hiện triệu chứng khi đang tập: dừng buổi tập, cho khách nghỉ và theo dõi. Đau ngực kéo dài hoặc ngất thì gọi 115 và sẵn sàng thực hiện CPR/AED.
:::` },

{ id:"pt-danh-gia-the-luc", cat:"pt-sang-loc", audience:"pt", updated:U,
  title:"Đánh giá thể lực ban đầu: bộ bài kiểm tra gọn cho phòng gym",
  summary:"Bộ đánh giá 30 phút: hình thể, tim mạch, sức bền cơ, vận động, sức mạnh. Ước lượng 1RM an toàn và giới hạn của bài sàng lọc vận động.",
  tags:["đánh giá","1RM","BMI","vòng eo","FMS"],
  ex:["pushup","plank","bwsquat","gobletsquat"],
  sources:[GETP, "Moran RW, et al. Do Functional Movement Screen (FMS) composite scores predict subsequent injury? A systematic review with meta-analysis. Br J Sports Med 2017;51(23):1661–1669.",
    "WHO/IASO/IOTF. The Asia-Pacific perspective: redefining obesity and its treatment. Health Communications Australia, 2000.",
    "Zourdos MC, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res 2016;30(1):267–275.", NSCA],
  body:`Đánh giá ban đầu giúp bạn **chọn điểm xuất phát**, **đặt mục tiêu đo được** và **cho khách thấy tiến bộ** sau 8–12 tuần. Hãy chọn bài kiểm tra an toàn, lặp lại được và phù hợp với mục tiêu.

## Bộ đánh giá 30 phút gợi ý

| Nhóm | Bài | Ghi chú |
|---|---|---|
| Hình thể | Cân nặng, vòng eo, ảnh 3 góc | Người châu Á: vòng eo từ 90 cm (nam), 80 cm (nữ) là béo bụng |
| BMI | Cân nặng ÷ chiều cao² | Châu Á – Thái Bình Dương: 23–24,9 là thừa cân, từ 25 là béo phì; không chính xác với người nhiều cơ |
| Tim mạch | Nhịp tim nghỉ, huyết áp; test bước bục hoặc đi bộ nếu phù hợp | Ghi lại điều kiện test |
| Sức bền cơ | [[ex:pushup]] tối đa (nữ có thể chống gối), [[ex:plank]] giữ tối đa | Dừng khi kỹ thuật vỡ |
| Vận động | Quan sát [[ex:bwsquat]], gập người với tay chạm chân, nâng tay qua đầu | Ghi lại sự lệch hai bên, điểm đau |
| Sức mạnh | Ước lượng 1RM từ một hiệp 3–8 lần, ví dụ [[ex:gobletsquat]] | Không test 1RM thật với người mới |

## Ước lượng 1RM an toàn

Công thức **Epley**: 1RM ≈ kg × (1 + số lần ÷ 30). Ví dụ 60 kg × 6 lần: 60 × 1,2 = **72 kg**. Hiệp càng ít lần thì ước lượng càng sát. Nếu khách dừng trước giới hạn, có thể cộng thêm số RIR vào số lần đã làm (Zourdos, 2016).

## Đừng quá tin vào bài sàng lọc vận động

Phân tích gộp của Moran (2017) cho thấy điểm tổng **FMS** dự đoán chấn thương **kém**. Hãy dùng bài kiểm tra vận động để **chọn bài tập phù hợp**, chứ không phải để "chẩn đoán" khách.

:::ap-dung
Lưu kết quả vào hồ sơ học viên. Hẹn đánh giá lại sau 8–12 tuần, cùng khung giờ và điều kiện. Số liệu và ảnh trước – sau là công cụ giữ chân khách tốt nhất.
:::

:::an-toan
Không làm test tối đa (1RM, chạy hết sức) với khách chưa sàng lọc, khách mới tập hoặc khách tăng huyết áp chưa kiểm soát. Luôn có sẵn nước, chỗ ngồi và nắm rõ quy trình cấp cứu.
:::` },

{ id:"pt-phong-van-khach", cat:"pt-sang-loc", audience:"pt", updated:U,
  title:"Buổi tư vấn đầu tiên: hỏi gì để hiểu khách trong 30 phút",
  summary:"Cấu trúc buổi tư vấn, bộ câu hỏi mở hiệu quả và những điều nên tránh khi gặp khách lần đầu.",
  tags:["tư vấn","khách hàng mới","câu hỏi","phỏng vấn tạo động lực"],
  ex:["bwsquat","pushup"],
  sources:[MI, NSCAPT, ACE],
  body:`Buổi tư vấn đầu tiên quyết định khách có ký gói hay không, và quan trọng hơn, có **gắn bó lâu dài** hay không. Mục tiêu là **hiểu khách** trước khi đưa ra giải pháp.

## Cấu trúc 30 phút

| Phút | Nội dung |
|---|---|
| 0–5 | Làm quen, giới thiệu nội dung buổi tư vấn, xin phép ghi chép |
| 5–15 | Mục tiêu, lý do sâu xa, lịch sử tập luyện, rào cản |
| 15–20 | Sàng lọc sức khoẻ ([[kb:pt-sang-loc-acsm]]) |
| 20–27 | Đánh giá nhanh vận động và sức bền |
| 27–30 | Tóm tắt, đề xuất lộ trình, khách tự chọn bước tiếp theo |

## Câu hỏi mở hiệu quả

- "Điều gì khiến anh/chị quyết định tìm PT **vào lúc này**?"
- "Nếu 3 tháng tới mọi thứ suôn sẻ, điều gì sẽ khác đi?"
- "Trước đây anh/chị đã thử những cách nào? Cách nào hiệu quả, cách nào không?"
- "Một tuần bình thường của anh/chị thế nào: công việc, giấc ngủ, ăn uống?"
- "Điều gì có thể cản trở việc tập 3 buổi mỗi tuần?"
- "Trên thang 0 đến 10, việc này quan trọng với anh/chị ở mức nào? Vì sao không phải một số thấp hơn?"

Câu cuối là một kỹ thuật của **phỏng vấn tạo động lực**: để khách tự nói ra lý do thay đổi của chính mình.

## Nên tránh

- Nói nhiều hơn khách.
- "Chào gói" trước khi hiểu nhu cầu.
- Nhận xét về cơ thể khách ("chị hơi nhiều mỡ bụng").
- Hứa hẹn kết quả cụ thể ("giảm 10 kg trong 1 tháng").

:::ap-dung
In bộ câu hỏi ra một trang. Sau buổi tư vấn, gửi khách bản tóm tắt 5 dòng: mục tiêu, lý do, rào cản, kế hoạch 4 tuần đầu và lịch buổi tiếp theo.
:::

:::luu-y
Xin phép trước khi chụp ảnh, đo vòng hoặc chạm vào khách để chỉnh tư thế. Giải thích mục đích và tôn trọng quyền từ chối của khách. Đọc [[kb:pt-dao-duc]].
:::` },

/* ======================= LẬP TRÌNH GIÁO ÁN ======================= */
{ id:"pt-nguyen-tac-lap-trinh", cat:"pt-giao-an", audience:"pt", updated:U,
  title:"Nguyên tắc lập trình giáo án: FITT-VP và 5 nguyên lý nền tảng",
  summary:"Đặc thù, quá tải tăng tiến, cá nhân hoá, biến đổi, đảo ngược. Cấu trúc buổi tập và danh sách kiểm tra cân bằng tuần.",
  tags:["lập trình","giáo án","FITT-VP","nguyên lý tập luyện"],
  ex:["squat","legpress","benchpress","pullup","rdl"],
  sources:[GETP, "American College of Sports Medicine. Position stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009;41(3):687–708.", NSCA],
  body:`## 5 nguyên lý nền tảng

| Nguyên lý | Ý nghĩa | Ví dụ |
|---|---|---|
| **Đặc thù** | Cơ thể thích nghi với đúng thứ được tập | Muốn squat khoẻ thì phải tập squat |
| **Quá tải tăng tiến** | Tải tăng dần theo thời gian | Thêm 1 lần hoặc thêm 2,5 kg |
| **Cá nhân hoá** | Phù hợp với tuổi, lịch sống, chấn thương, sở thích | Thay [[ex:squat]] bằng [[ex:legpress]] khi khách đau lưng |
| **Biến đổi** | Thay đổi có kế hoạch để tránh chững và quá tải | Đổi biến thể sau 4–8 tuần |
| **Đảo ngược** | Ngừng tập thì mất dần thích nghi | Tuần nghỉ vẫn giữ 1–2 buổi ngắn |

## FITT-VP (ACSM)

**F**requency (tần suất) · **I**ntensity (cường độ) · **T**ime (thời gian) · **T**ype (loại hình) · **V**olume (khối lượng) · **P**rogression (tăng tiến). Mỗi phần của giáo án nên ghi đủ 6 yếu tố này.

## Cấu trúc một buổi tập

1. Khởi động chung và vận động khớp (5–10 phút).
2. Bài sức bật hoặc kỹ thuật (nếu có).
3. **Bài chính nhiều khớp** khi khách còn sung sức.
4. Bài phụ, bài cô lập.
5. Cơ thân giữa, cardio, hồi tĩnh.

## Kiểm tra cân bằng tuần

- Đẩy ngang và kéo ngang; đẩy dọc và kéo dọc.
- Gập gối (squat) và bản lề hông ([[ex:rdl]]).
- Số hiệp mỗi nhóm cơ trong tuần đúng mục tiêu ([[kb:tc-khoi-luong]]).
- Không xếp hai buổi nặng cho cùng một nhóm cơ vào hai ngày liền nhau.

:::ap-dung
Dùng tính năng **Tạo giáo án riêng** trong app để dựng khung nhanh, sau đó rà lại theo danh sách trên trước khi giao cho học viên.
:::

:::an-toan
Với khách mới, tuần đầu nên chỉ ở mức **khoảng 50–70 %** khối lượng dự kiến. Tiêu cơ vân hay gặp nhất ở buổi đầu tiên quá sức.
:::` },

{ id:"pt-chu-ky-hoa", cat:"pt-giao-an", audience:"pt", updated:U,
  title:"Chu kỳ hoá: tuyến tính, nhấp nhô hay theo khối?",
  summary:"Ba mô hình chu kỳ hoá phổ biến, bằng chứng từ phân tích gộp và cách chọn cho từng kiểu khách.",
  tags:["chu kỳ hoá","periodization","DUP","lập trình","sức mạnh"],
  ex:["squat","benchpress","deadlift"],
  sources:["Moesgaard L, et al. Effects of periodization on strength and muscle hypertrophy in volume-equated resistance training programs: a systematic review and meta-analysis. Sports Med 2022;52(7):1647–1666.",
    "Rhea MR, et al. A comparison of linear and daily undulating periodized programs with equated volume and intensity for strength. J Strength Cond Res 2002;16(2):250–255.", NSCA],
  body:`**Chu kỳ hoá** là sắp xếp có kế hoạch sự thay đổi của khối lượng và cường độ tập theo thời gian.

## Ba mô hình phổ biến

| Mô hình | Cách làm | Ví dụ 4 tuần (bài chính) |
|---|---|---|
| **Tuyến tính** | Cường độ tăng dần, khối lượng giảm dần qua các tuần | 3×10 → 4×8 → 4×6 → 5×4 |
| **Nhấp nhô hằng ngày (DUP)** | Đổi mức nặng nhẹ ngay trong tuần | T2: 4×10 · T4: 5×5 · T6: 4×8 |
| **Theo khối (block)** | Mỗi khối 3–6 tuần tập trung một phẩm chất | Khối tích luỹ → khối chuyển hoá → khối đỉnh |

## Bằng chứng

Phân tích gộp của Moesgaard (2022): khi tổng khối lượng bằng nhau, chương trình **có chu kỳ hoá** tăng **sức mạnh tối đa** nhỉnh hơn chương trình không chu kỳ hoá; còn **mức tăng cơ không khác biệt**. Nghiên cứu của Rhea (2002) cũng ghi nhận DUP tăng sức mạnh nhiều hơn mô hình tuyến tính ở người đã tập.

## Chọn mô hình cho khách

- **Người mới:** chưa cần chu kỳ hoá phức tạp, tăng tiến kép là đủ trong 3–6 tháng đầu.
- **Khách phong trào lâu năm:** DUP giúp buổi tập đa dạng, đỡ nhàm chán.
- **Khách có mục tiêu thi đấu** (powerlifting, Hyrox, chạy): chu kỳ theo khối, hướng tới ngày thi.
- Mô hình nào cũng cần **tuần giảm tải** sau 3–6 tuần tập nặng.

:::ap-dung
Với khách đã tập trên 6 tháng và đang chững tạ, thử chuyển bài chính như [[ex:squat]], [[ex:benchpress]] sang DUP 3 mức (nặng – vừa – nhẹ) trong 6 tuần. So 1RM ước lượng trước và sau.
:::

:::an-toan
Những tuần cường độ cao (từ 5 lần trở xuống) cần kỹ thuật vững và thiết bị an toàn. Đừng xếp tuần "đỉnh" vào giai đoạn khách đang bận rộn, thiếu ngủ.
:::` },

{ id:"pt-nhom-dac-biet", cat:"pt-giao-an", audience:"pt", updated:U,
  title:"Giáo án cho nhóm đặc biệt: người cao tuổi, tăng huyết áp, tiểu đường týp 2, thanh thiếu niên",
  summary:"Khuyến nghị cốt lõi từ NSCA, ACSM và đồng thuận quốc tế cho từng nhóm, kèm lưu ý an toàn khi PT làm việc cùng bác sĩ.",
  tags:["người cao tuổi","tăng huyết áp","tiểu đường","thanh thiếu niên","nhóm đặc biệt"],
  ex:["walking","gobletsquat","farmercarry"],
  sources:["Fragala MS, et al. Resistance training for older adults: position statement from the National Strength and Conditioning Association. J Strength Cond Res 2019;33(8):2019–2052.",
    "Pescatello LS, et al. Physical activity to prevent and treat hypertension: a systematic review. Med Sci Sports Exerc 2019;51(6):1314–1323.",
    "Kanaley JA, et al. Exercise/physical activity in individuals with type 2 diabetes: a consensus statement from the American College of Sports Medicine. Med Sci Sports Exerc 2022;54(2):353–368.",
    "Lloyd RS, et al. Position statement on youth resistance training: the 2014 International Consensus. Br J Sports Med 2014;48(7):498–505.", GETP],
  body:`:::luu-y
Các nhóm dưới đây cần **sàng lọc kỹ và có bác sĩ đồng ý** khi có chỉ định. PT làm việc trong phạm vi chuyên môn và phối hợp với bác sĩ điều trị.
:::

## Người cao tuổi (NSCA – Fragala, 2019)

- Tập kháng lực **2–3 buổi/tuần**, 1–3 hiệp cho mỗi bài, 8–10 bài chính, tăng dần lên cường độ 70–85 % 1RM khi phù hợp.
- Thêm **sức mạnh tốc độ**: làm nhanh ở pha đi lên (ví dụ đứng dậy khỏi ghế thật nhanh) để giúp phòng ngã.
- Tập thăng bằng ít nhất 3 ngày/tuần, ví dụ đứng một chân, [[ex:farmercarry]].

## Tăng huyết áp

- ACSM khuyến nghị vận động aerobic **hầu hết các ngày** trong tuần và tập tạ 2–3 ngày ở cường độ vừa. Tổng quan của Pescatello (2019) cho thấy tập luyện giúp giảm huyết áp lúc nghỉ.
- Tránh nín thở (Valsalva), hạn chế tư thế đầu thấp hơn tim trong thời gian dài.
- Đo huyết áp trước buổi tập. Huyết áp rất cao thì **hoãn buổi tập** và đề nghị khách đi khám.

## Tiểu đường týp 2 (ACSM – Kanaley, 2022)

- Ít nhất 150 phút/tuần vận động aerobic, không nghỉ quá 2 ngày liên tiếp. Tập tạ 2–3 buổi/tuần.
- [[ex:walking]] nhẹ sau bữa ăn giúp giảm đường huyết sau ăn.
- Khách dùng insulin hoặc thuốc nhóm sulfonylurea có nguy cơ **hạ đường huyết**: chuẩn bị sẵn đồ ngọt hấp thu nhanh, nắm rõ dấu hiệu (run tay, vã mồ hôi, đói cồn cào, lú lẫn).

## Thanh thiếu niên (Lloyd, 2014)

- Tập kháng lực **an toàn và có lợi** khi được hướng dẫn đúng. Tập tạ **không** làm trẻ bị "lùn".
- Ưu tiên kỹ thuật, vận động đa dạng và niềm vui. Tăng tải chậm, ví dụ bắt đầu từ [[ex:gobletsquat]] nhẹ.
- Không dùng thực phẩm bổ sung để tăng thành tích.

:::ap-dung
Tạo mẫu ghi chú buổi tập cho khách thuộc nhóm đặc biệt: huyết áp hoặc đường huyết trước buổi, mức gắng sức cảm nhận (RPE), triệu chứng, điều chỉnh đã làm. Lưu vào nhật ký buổi tập trong TapEasy PT.
:::

:::an-toan
Chuẩn bị sẵn kế hoạch xử trí hạ đường huyết, ngất và đau ngực. Đảm bảo phòng tập có máy AED và nhân viên biết cách sử dụng.
:::` },

{ id:"pt-tu-dieu-chinh", cat:"pt-giao-an", audience:"pt", updated:U,
  title:"Tự điều chỉnh theo RIR/RPE và theo dõi tiến độ học viên",
  summary:"Để mức tạ bám theo trạng thái thực tế của khách mỗi ngày. Thang RIR–RPE, cách viết giáo án tự điều chỉnh và 3 tín hiệu cần theo dõi.",
  tags:["RPE","RIR","tự điều chỉnh","autoregulation","theo dõi tiến độ"],
  ex:["squat","benchpress"],
  sources:["Helms ER, et al. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J 2016;38(4):42–49.",
    "Helms ER, et al. RPE vs. percentage 1RM loading in periodized programs matched for sets and repetitions. Front Physiol 2018;9:247.",
    "Zourdos MC, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res 2016;30(1):267–275."],
  body:`Giáo án cố định theo % 1RM không tính đến ngày khách chỉ ngủ 4 tiếng hay vừa đi công tác về. **Tự điều chỉnh** (autoregulation) giúp mức tạ bám theo trạng thái thực tế của khách.

## Thang RIR – RPE

| RPE | RIR | Mô tả |
|---|---|---|
| 10 | 0 | Không thể thêm lần nào |
| 9 | 1 | Còn 1 lần |
| 8 | 2 | Còn 2 lần |
| 7 | 3 | Còn 3 lần |
| 5–6 | 4–6 | Nhẹ, tốc độ thanh tạ nhanh |

Nghiên cứu của Helms (2018) ở người đã tập: nhóm chọn tạ theo **RPE** tăng sức mạnh tương đương hoặc nhỉnh hơn nhóm chọn tạ theo **% 1RM**, khi cùng số hiệp và số lần.

## Cách viết giáo án tự điều chỉnh

- **Hiệp đỉnh rồi giảm tải:** "[[ex:squat]] 1 × 5 @ RPE 8, sau đó 3 × 5 với mức tạ giảm 10 %."
- **Khoảng tạ:** "[[ex:benchpress]] 4 × 6–8 @ RIR 2", khách tự chọn mức tạ đạt yêu cầu.
- **Dừng theo độ mệt:** tiếp tục làm hiệp đến khi RPE vượt mức đỉnh 1 điểm.

## Theo dõi tiến độ

Mỗi tuần, nhìn 3 tín hiệu:

1. **1RM ước lượng** của bài chính (app tự tính từ kg × lần).
2. **Khối lượng** (tổng kg × lần) theo từng nhóm cơ.
3. **Cảm nhận** của khách: giấc ngủ, mức mệt, đau nhức, hứng thú.

1RM ước lượng giảm 2 tuần liền kèm cảm nhận xấu đi là lúc cần giảm tải.

:::ap-dung
Yêu cầu học viên nhập RPE cho hiệp cuối của mỗi bài. Trước mỗi buổi, xem biểu đồ 1RM ước lượng trong lịch sử bài tập để chọn mức tạ.
:::

:::an-toan
Người mới thường ước lượng RIR kém chính xác (Zourdos, 2016). Những tuần đầu, PT nên quan sát tốc độ thanh tạ và kỹ thuật để hiệu chỉnh cùng khách.
:::` },

/* ======================= KINH DOANH PT ======================= */
{ id:"pt-dinh-gia", cat:"pt-kinh-doanh", audience:"pt", updated:U,
  title:"Định giá gói PT: tính từ chi phí, giá trị và thị trường",
  summary:"Ba bước định giá: tính giá sàn từ chi phí, đối chiếu thị trường và giá trị khác biệt, thiết kế gói hợp lý.",
  tags:["định giá","gói tập","kinh doanh","thu nhập PT"],
  sources:[ACE, "Quốc hội. Luật Giá 2023 (Luật số 16/2023/QH15) – nghĩa vụ niêm yết giá hàng hoá, dịch vụ.", BVQLNTD],
  body:`:::luu-y
Các con số trong bài là **ví dụ giả định** để minh hoạ cách tính, không phải giá thị trường. Hãy thay bằng chi phí và số liệu khảo sát thực tế tại khu vực của bạn.
:::

## Bước 1: Tính "giá sàn" từ chi phí

| Khoản mỗi tháng (ví dụ) | Số tiền |
|---|---|
| Phí phòng tập hoặc phần chia doanh thu cho phòng | 4.000.000 đ |
| Đi lại, điện thoại, phần mềm, bảo hiểm | 1.500.000 đ |
| Học phí chứng chỉ, tái chứng nhận (chia đều 12 tháng) | 1.000.000 đ |
| Thu nhập mong muốn | 20.000.000 đ |
| **Tổng cần thu** | **26.500.000 đ** |

Giả sử bạn dạy được khoảng **80 buổi/tháng** (4 buổi/ngày × 20 ngày), trừ 15 % buổi bị huỷ hoặc dời thì còn khoảng 68 buổi. Giá sàn ≈ 26.500.000 ÷ 68 ≈ **390.000 đ/buổi**.

## Bước 2: Đối chiếu thị trường và giá trị

- Khảo sát 5–10 PT cùng khu vực, cùng phân khúc khách.
- Cộng thêm giá trị khác biệt: chứng chỉ, chuyên môn hẹp (sau sinh, phục hồi, Hyrox…), kết quả có bằng chứng, dịch vụ ngoài giờ (theo dõi qua app, nhắn tin hỗ trợ).

## Bước 3: Thiết kế gói

| Gói | Ý tưởng |
|---|---|
| Buổi lẻ | Giá cao nhất, làm "mỏ neo" so sánh |
| 12 buổi (4–6 tuần) | Gói khởi động, kèm đánh giá đầu và cuối gói |
| 24–36 buổi | Giảm giá mỗi buổi 5–15 %, có thời hạn sử dụng rõ ràng |
| Online, kèm theo dõi qua app | Giá thấp hơn, phục vụ được nhiều khách hơn |
| Nhóm nhỏ 2–4 người | Giá mỗi người thấp, thu nhập mỗi giờ cao |

## Nên tránh

- Giảm giá sâu liên tục: làm giảm giá trị cảm nhận của dịch vụ.
- Bán gói quá dài (ví dụ 100 buổi) mà không có điều khoản rõ ràng: dễ phát sinh tranh chấp và yêu cầu hoàn tiền.

:::ap-dung
Tính giá sàn của bạn bằng bảng trên. Nếu giá hiện tại thấp hơn giá sàn, hãy tăng giá cho **khách mới** trước và giữ giá cũ cho khách hiện tại thêm 1–3 tháng.
:::` },

{ id:"pt-hop-dong", cat:"pt-kinh-doanh", audience:"pt", updated:U,
  title:"Hợp đồng dịch vụ PT: 12 điều khoản không nên thiếu",
  summary:"Hợp đồng rõ ràng bảo vệ cả PT và khách. Danh sách điều khoản gợi ý theo Bộ luật Dân sự và Luật Bảo vệ quyền lợi người tiêu dùng.",
  tags:["hợp đồng","pháp lý","điều khoản","kinh doanh"],
  sources:[BLDS, BVQLNTD, BVDLCN, VBPL],
  body:`:::luu-y
Đây là gợi ý về cấu trúc, **không phải mẫu hợp đồng pháp lý**. Hãy nhờ luật sư rà soát trước khi dùng một hợp đồng chung cho nhiều khách.
:::

Hợp đồng rõ ràng bảo vệ cả hai bên và giảm tranh chấp. Dịch vụ PT là **hợp đồng dịch vụ** theo Bộ luật Dân sự 2015. Khi dùng hợp đồng theo mẫu với người tiêu dùng, **Luật Bảo vệ quyền lợi người tiêu dùng 2023** yêu cầu nội dung rõ ràng, dễ hiểu và không chứa điều khoản gây bất lợi một cách không công bằng cho người tiêu dùng.

## 12 điều khoản nên có

1. **Thông tin các bên:** PT hoặc đơn vị cung cấp dịch vụ, khách hàng, người liên hệ khẩn cấp.
2. **Dịch vụ:** số buổi, thời lượng mỗi buổi, địa điểm, nội dung (tập trực tiếp, theo dõi online, đánh giá định kỳ).
3. **Giá và thanh toán:** tổng tiền, các đợt thanh toán, hình thức, hoá đơn hoặc biên nhận.
4. **Thời hạn sử dụng gói** và điều kiện **bảo lưu** (ốm đau, thai sản, công tác).
5. **Chính sách huỷ, dời buổi** ([[kb:pt-chinh-sach-huy]]).
6. **Hoàn tiền, chuyển nhượng gói:** trường hợp được áp dụng và cách tính.
7. **Sức khoẻ:** khách cam kết khai báo trung thực (PAR-Q+) và thông báo khi sức khoẻ thay đổi.
8. **Rủi ro và trách nhiệm:** mô tả rủi ro vốn có của tập luyện. Không dùng điều khoản "miễn trừ mọi trách nhiệm" vì loại điều khoản này có thể bị vô hiệu.
9. **Không cam kết kết quả** cụ thể (số kg, số cm).
10. **Dữ liệu cá nhân và hình ảnh:** mục đích, nơi lưu, thời gian lưu; xin đồng ý **riêng** nếu muốn dùng ảnh để quảng bá.
11. **Quy tắc ứng xử:** khung giờ liên lạc, việc tiếp xúc cơ thể khi chỉnh tư thế (luôn xin phép trước).
12. **Giải quyết tranh chấp:** thương lượng, hoà giải, cơ quan có thẩm quyền.

:::ap-dung
Gửi hợp đồng cho khách **trước** buổi đầu ít nhất 24 giờ để khách có thời gian đọc kỹ. Tóm tắt 5 điểm chính ngay trang đầu: số buổi, hạn sử dụng, huỷ buổi, hoàn tiền, dữ liệu.
:::

:::an-toan
Không giữ giấy tờ tuỳ thân bản gốc của khách. Nhận tiền có biên nhận hoặc qua chuyển khoản, tránh nhận tiền mặt không có chứng từ.
:::` },

{ id:"pt-chinh-sach-huy", cat:"pt-kinh-doanh", audience:"pt", updated:U,
  title:"Chính sách huỷ, dời buổi và bảo lưu: công bằng mà vẫn giữ kỷ luật",
  summary:"Mẫu chính sách cho từng tình huống, nguyên tắc đối xứng giữa PT và khách, cách đặt thời hạn gói hợp lý.",
  tags:["huỷ buổi","bảo lưu","chính sách","kinh doanh"],
  sources:[BVQLNTD, ACE],
  body:`Huỷ buổi sát giờ làm bạn mất thu nhập và khiến khách mất nhịp tập. Một chính sách **rõ ràng, công bằng, nhất quán** giúp giảm tình trạng huỷ mà không làm khách khó chịu.

## Mẫu chính sách gợi ý

| Tình huống | Cách xử lý |
|---|---|
| Khách báo huỷ, dời trước **12–24 giờ** trở lên | Không trừ buổi |
| Khách báo **dưới 12 giờ** hoặc không đến | Trừ buổi (có thể miễn 1 lần cho mỗi gói) |
| Khách đến trễ | Tập đến hết giờ đã hẹn, không kéo dài thêm |
| PT huỷ hoặc dời | Không trừ buổi, ưu tiên khách chọn giờ bù; PT huỷ sát giờ thì tặng khách thêm buổi |
| Ốm có giấy khám, tai nạn, thai sản | Bảo lưu gói, gia hạn tương ứng |
| Thiên tai, dịch bệnh, phòng tập đóng cửa | Bảo lưu toàn bộ, không trừ buổi |

## Nguyên tắc

- **Đối xứng:** PT cũng chịu trách nhiệm khi huỷ sát giờ.
- **Ghi vào hợp đồng** và nhắc lại trong buổi đầu tiên. Không áp dụng "luật ngầm".
- **Nhất quán:** áp dụng như nhau cho mọi khách; linh hoạt có kiểm soát bằng "1 lần miễn trừ".
- **Nhắc lịch tự động** trước buổi 24 giờ và 2 giờ giúp giảm tình trạng vắng mặt.

## Thời hạn gói

Đặt thời hạn hợp lý theo số buổi (ví dụ 12 buổi trong 6–8 tuần, 24 buổi trong 3–4 tháng) và kèm quyền bảo lưu. Thời hạn quá ngắn, không có bảo lưu dễ bị xem là điều khoản không công bằng với người tiêu dùng.

:::ap-dung
Bật nhắc lịch cho học viên trong TapEasy PT. Ghi trạng thái từng buổi (đã tập, khách huỷ, PT huỷ, buổi bù) để cuối gói đối chiếu minh bạch với khách.
:::

:::luu-y
Khi khách yêu cầu hoàn tiền, hãy tính theo số buổi **chưa sử dụng** và đúng điều khoản đã ký. Giữ mọi trao đổi bằng văn bản (tin nhắn, email).
:::` },

{ id:"pt-giu-chan-khach", cat:"pt-kinh-doanh", audience:"pt", updated:U,
  title:"Giữ chân khách hàng: 90 ngày đầu quyết định tất cả",
  summary:"Vì sao khách rời đi, ba giai đoạn của hành trình khách hàng và hệ thống \"không để rơi khách\" áp dụng thuyết Tự quyết.",
  tags:["giữ chân khách","retention","chăm sóc khách","kinh doanh"],
  sources:[TEIX, "Ryan RM, Deci EL. Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. Am Psychol 2000;55(1):68–78.",
    "Lally P, et al. How are habits formed: modelling habit formation in the real world. Eur J Soc Psychol 2010;40(6):998–1009.", ACE],
  body:`Tìm khách mới tốn công hơn nhiều so với giữ khách cũ. Khách rời đi thường vì **không thấy tiến bộ, không thấy được quan tâm, hoặc lịch sống thay đổi**, hiếm khi chỉ vì giá.

## Ba giai đoạn

| Giai đoạn | Mục tiêu | Việc làm |
|---|---|---|
| **Tuần 1–4** | Thành công sớm, an toàn | Bài dễ làm đúng, ghi kỷ lục đầu tiên, khen nỗ lực cụ thể |
| **Tuần 5–12** | Hình thành thói quen | Lịch cố định, kế hoạch "Nếu… thì…", phiên bản tối thiểu cho tuần bận |
| **Sau 3 tháng** | Gắn bó | Đánh giá lại, mục tiêu mới, cộng đồng, thử thách |

## Áp dụng thuyết Tự quyết

- **Tự chủ:** cho khách lựa chọn (2 bài tương đương, khách chọn 1); hỏi ý kiến khi đổi giáo án.
- **Năng lực:** biểu đồ sức mạnh, ảnh trước – sau, so sánh số đo. Tiến bộ phải **nhìn thấy được**.
- **Kết nối:** nhớ những chi tiết trong cuộc sống của khách (con đi thi, chuyến công tác), nhắn hỏi thăm khi khách vắng mặt.

## Hệ thống "không để rơi khách"

- Khách vắng 1 buổi: nhắn hỏi thăm ngay trong ngày.
- Vắng 2 buổi liên tiếp: gọi điện, đề xuất giờ khác hoặc buổi ngắn hơn.
- Gói còn 3–4 buổi: tổ chức buổi đánh giá và đề xuất kế hoạch tiếp theo **trước khi** gói kết thúc.

:::ap-dung
Lên lịch đánh giá lại ở **tuần 4 và tuần 12** cho mọi khách. Gửi báo cáo 1 trang gồm: số liệu trước – sau, 3 điều khách đã làm tốt, mục tiêu tiếp theo.
:::

:::luu-y
Không gây áp lực bằng cảm giác tội lỗi hay chê ngoại hình để "giữ" khách. Cách đó phá vỡ niềm tin và đi ngược đạo đức nghề nghiệp.
:::` },

{ id:"pt-marketing", cat:"pt-kinh-doanh", audience:"pt", updated:U,
  title:"Marketing cho PT: định vị, nội dung, giới thiệu và quy định quảng cáo",
  summary:"Chọn nhóm khách mục tiêu, làm nội dung hữu ích, xây kênh giới thiệu, và những điều pháp luật yêu cầu khi dùng hình ảnh khách hàng.",
  tags:["marketing","nội dung","quảng cáo","thương hiệu cá nhân","kinh doanh"],
  sources:[BLDS, "Quốc hội. Luật Quảng cáo 2012 (Luật số 16/2012/QH13) và các văn bản sửa đổi, bổ sung.",
    "Chính phủ. Nghị định 15/2018/NĐ-CP quy định chi tiết thi hành một số điều của Luật An toàn thực phẩm (bao gồm quảng cáo thực phẩm bảo vệ sức khoẻ).", BVDLCN],
  body:`## 1. Định vị rõ ràng

"PT cho mọi người" rất khó nổi bật. Hãy chọn **một nhóm khách mà bạn giúp tốt nhất**: dân văn phòng đau lưng, mẹ sau sinh, người mới ngoài 30 tuổi, người chạy bộ muốn khoẻ hơn, người chuẩn bị thi Hyrox…

Câu định vị mẫu: "Tôi giúp **[nhóm khách]** đạt **[kết quả]** bằng **[cách làm riêng]** mà không **[nỗi lo của họ]**."

## 2. Nội dung hữu ích

| Dạng | Ví dụ |
|---|---|
| Giáo dục ngắn | "3 lỗi squat thường gặp của dân văn phòng" (video 30–60 giây) |
| Câu chuyện khách hàng | Hành trình thật, **có đồng ý bằng văn bản** của khách |
| Hậu trường | Cách bạn soạn giáo án, một buổi đánh giá |
| Trả lời câu hỏi | Mỗi tuần trả lời một câu hỏi của khách |

Bạn có thể dùng các bài trong **Kho kiến thức TapEasy** làm nguồn ý tưởng và chia sẻ đường dẫn cho khách.

## 3. Giới thiệu (referral)

Khách hài lòng là kênh tiếp thị tốt nhất. Hãy **hỏi đúng lúc**, ví dụ khi khách vừa đạt một cột mốc, và có quà cho cả người giới thiệu lẫn người mới (ví dụ thêm 1 buổi tập).

## 4. Tuân thủ pháp luật và đạo đức

- **Hình ảnh khách hàng:** theo Bộ luật Dân sự 2015, việc sử dụng hình ảnh của cá nhân phải được người đó **đồng ý**. Dùng cho mục đích thương mại thì càng cần thoả thuận rõ ràng.
- **Không hứa hẹn kết quả tuyệt đối** ("giảm 10 kg/tháng", "cam kết 100 %"). Không dùng các từ "chữa", "điều trị".
- **Quảng cáo thực phẩm bảo vệ sức khoẻ** có quy định riêng (Nghị định 15/2018/NĐ-CP và Luật Quảng cáo). Nếu bạn bán hoặc giới thiệu sản phẩm, hãy công khai việc mình nhận hoa hồng.
- Ảnh trước – sau phải **là ảnh thật, chụp trong cùng điều kiện** và ghi rõ khoảng thời gian.

:::ap-dung
Viết câu định vị của bạn và cập nhật vào hồ sơ PT trên TapEasy. Lên lịch 3 nội dung mỗi tuần trong 4 tuần tới.
:::

:::luu-y
Che mặt hoặc làm mờ ảnh nếu khách chỉ đồng ý chia sẻ ẩn danh. Khi khách rút lại sự đồng ý, hãy gỡ ảnh xuống.
:::` },

/* ======================= GIAO TIẾP & ĐẠO ĐỨC ======================= */
{ id:"pt-giao-tiep", cat:"pt-dao-duc", audience:"pt", updated:U,
  title:"Giao tiếp tạo động lực: kỹ thuật OARS cho PT",
  summary:"Phỏng vấn tạo động lực giúp khách tự tìm ra lý do thay đổi. Bốn kỹ thuật OARS, cạm bẫy \"phản xạ sửa sai\" và cách góp ý kỹ thuật.",
  tags:["giao tiếp","phỏng vấn tạo động lực","OARS","coaching"],
  sources:[MI, TEIX],
  body:`**Phỏng vấn tạo động lực** (Motivational Interviewing – Miller & Rollnick) là cách trò chuyện giúp khách **tự tìm ra lý do và cách thức thay đổi**, thay vì PT ra lệnh. Kỹ thuật cốt lõi được gọi tắt là **OARS**.

## OARS

| Kỹ thuật | Mục đích | Ví dụ |
|---|---|---|
| **O**pen questions – câu hỏi mở | Để khách nói nhiều hơn | "Tuần qua chuyện ăn uống của bạn thế nào?" |
| **A**ffirmations – ghi nhận | Ghi nhận nỗ lực cụ thể | "Tuần bận như vậy mà bạn vẫn đi đủ 3 buổi. Điều đó không dễ." |
| **R**eflections – phản ánh | Cho khách thấy bạn hiểu | "Nghe như bạn rất muốn tập đều, nhưng ca đêm làm bạn kiệt sức." |
| **S**ummaries – tóm tắt | Nối các ý, chuyển hướng câu chuyện | "Vậy là bạn muốn khoẻ hơn để chơi với con, và khó khăn lớn nhất là buổi tối…" |

## Cẩn thận với "phản xạ sửa sai"

Khi khách nói "Em biết phải bớt đồ ngọt nhưng khó quá", PT thường muốn đưa ngay 5 lời khuyên. Điều này dễ khiến khách **phản kháng**. Hãy phản ánh và hỏi trước: "Phần nào là khó nhất với bạn?"

## Góp ý kỹ thuật hiệu quả

- Mỗi lần chỉ sửa **một lỗi**, bắt đầu từ lỗi ảnh hưởng đến an toàn.
- Dùng gợi ý hướng ra bên ngoài cơ thể: "đẩy sàn ra xa" thay vì "duỗi gối".
- Bắt đầu bằng điểm khách làm tốt, sau đó sửa một điểm, rồi ghi nhận nỗ lực.

:::ap-dung
Trong buổi tới, đếm số câu hỏi mở so với câu hỏi đóng của bạn. Mục tiêu: ít nhất 2 câu mở cho mỗi câu đóng, và phản ánh nhiều hơn khuyên bảo.
:::

:::luu-y
Không bình luận về cân nặng, ngoại hình của khách trước mặt người khác. Giữ bí mật những điều khách chia sẻ.
:::` },

{ id:"pt-dao-duc", cat:"pt-dao-duc", audience:"pt", updated:U,
  title:"Đạo đức nghề PT: ranh giới, tiếp xúc cơ thể, bảo mật và xung đột lợi ích",
  summary:"Những nguyên tắc chung trong bộ quy tắc đạo đức của NSCA, ACE và các quy định pháp luật liên quan tại Việt Nam.",
  tags:["đạo đức","ranh giới","bảo mật","tiếp xúc cơ thể","xung đột lợi ích"],
  sources:[{ t:"NSCA Code of Ethics.", u:"https://www.nsca.com/" }, { t:"ACE Code of Ethics.", u:"https://www.acefitness.org/" }, BVDLCN,
    "Quốc hội. Bộ luật Lao động 2019 (Luật số 45/2019/QH14) – nghiêm cấm quấy rối tình dục tại nơi làm việc."],
  body:`Niềm tin là tài sản lớn nhất của PT. Bộ quy tắc đạo đức của NSCA và ACE có chung những nguyên tắc sau.

## 1. Tiếp xúc cơ thể khi chỉnh tư thế

- **Xin phép trước mỗi lần chạm:** "Mình chạm vào vai bạn để chỉnh nhé?"
- Ưu tiên chỉnh bằng lời nói, làm mẫu, dùng gương hoặc dụng cụ.
- Tránh vùng nhạy cảm. Khi cần (ví dụ hướng dẫn cảm nhận cơ mông), hãy giải thích và để khách **tự đặt tay**.
- Tôn trọng câu trả lời "không" và không hỏi lại nhiều lần.

## 2. Ranh giới trong mối quan hệ

- Giữ quan hệ **chuyên nghiệp**. Nếu nảy sinh tình cảm, hãy kết thúc quan hệ huấn luyện trước và giới thiệu khách cho PT khác.
- Nhắn tin trong khung giờ đã thống nhất, tránh nội dung riêng tư không liên quan đến tập luyện.

## 3. Bảo mật dữ liệu

- Hồ sơ sức khoẻ, số đo, ảnh của khách chỉ dùng cho mục đích huấn luyện.
- **Không** đăng ảnh hoặc số liệu khi chưa có đồng ý bằng văn bản.
- Bảo vệ điện thoại và tài khoản bằng mật khẩu và xác thực hai lớp. Luật Bảo vệ dữ liệu cá nhân 2025 quy định rõ trách nhiệm của bên xử lý dữ liệu.

## 4. Xung đột lợi ích

- Khi bán thực phẩm bổ sung hoặc dụng cụ: **công khai** việc bạn nhận hoa hồng, không ép mua, không bán sản phẩm không rõ nguồn gốc.
- Không giới thiệu khách đến dịch vụ y tế để nhận hoa hồng.

## 5. Năng lực chuyên môn

Chỉ nhận khách trong phạm vi chuyên môn của mình ([[kb:pt-pham-vi-hanh-nghe]]). Học tập liên tục, duy trì chứng chỉ và CPR/AED.

:::ap-dung
Thêm vào hợp đồng một mục "Quy tắc ứng xử" (cách chỉnh tư thế, khung giờ liên lạc, bảo mật) để khách biết quyền của mình ngay từ đầu.
:::

:::luu-y
Quấy rối tình dục tại nơi làm việc bị nghiêm cấm theo Bộ luật Lao động 2019. Khi chứng kiến hoặc nhận được phản ánh, hãy báo quản lý phòng tập và hỗ trợ người bị ảnh hưởng.
:::` }
);
})();

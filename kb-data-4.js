/* =========================================================================
   TapEasy — Kho kiến thức · DỮ LIỆU 4/6
   Chuyên mục: Phụ nữ tập luyện (6) · Cardio, chạy & Hyrox (6) · Tâm lý & thói quen (4)
   Định dạng: xem đầu kb-data-1.js
   ========================================================================= */
(function(){
var A = (window.KB_ARTICLES = window.KB_ARTICLES || []);
var U = "2026-11-10";
var ACOG = "ACOG Committee Opinion No. 804: Physical activity and exercise during pregnancy and the postpartum period. Obstet Gynecol 2020;135(4):e178–e188.";
var MOTTOLA = "Mottola MF, et al. 2019 Canadian guideline for physical activity throughout pregnancy. Br J Sports Med 2018;52(21):1339–1346.";
var MOUNTJOY = "Mountjoy M, et al. 2023 International Olympic Committee's (IOC) consensus statement on Relative Energy Deficiency in Sport (REDs). Br J Sports Med 2023;57(17):1073–1097.";
var FRAGALA = "Fragala MS, et al. Resistance training for older adults: position statement from the National Strength and Conditioning Association. J Strength Cond Res 2019;33(8):2019–2052.";
var SCHUMANN = "Schumann M, et al. Compatibility of concurrent aerobic and strength training for skeletal muscle size and function: an updated systematic review and meta-analysis. Sports Med 2022;52(3):601–612.";
var HYROX = { t:"HYROX. Official rulebook & race format (8 × 1 km chạy + 8 trạm). hyrox.com", u:"https://hyrox.com/" };
var LALLY = "Lally P, van Jaarsveld CHM, Potts HWW, Wardle J. How are habits formed: modelling habit formation in the real world. Eur J Soc Psychol 2010;40(6):998–1009.";
var TEIX = "Teixeira PJ, et al. Exercise, physical activity, and self-determination theory: a systematic review. Int J Behav Nutr Phys Act 2012;9:78.";

A.push(
/* ======================= PHỤ NỮ TẬP LUYỆN ======================= */
{ id:"pn-tap-ta-co-to", cat:"phu-nu", audience:"nguoi-tap", updated:U,
  title:"Phụ nữ tập tạ có bị \"to con\" không?",
  summary:"Nữ tăng cơ theo tỉ lệ tương đương nam và tăng sức mạnh thân trên còn nhanh hơn, nhưng \"to con\" thì không dễ như bạn nghĩ.",
  tags:["phụ nữ","tập tạ","săn chắc","tăng cơ","xương"],
  ex:["hipthrust","gobletsquat","rdl","latpulldown","dbrow","dbpress"],
  tpl:["tpl-f-fb","tpl-f-glute","tpl-f-home"],
  sources:["Roberts BM, Nuckols G, Krieger JW. Sex differences in resistance training: a systematic review and meta-analysis. J Strength Cond Res 2020;34(5):1448–1460.", FRAGALA,
    { t:"WHO (2020). WHO guidelines on physical activity and sedentary behaviour.", u:"https://www.who.int/publications/i/item/9789240015128" }],
  body:`Câu trả lời ngắn: **không, trừ khi bạn chủ đích theo đuổi và tập rất nhiều năm**. Phụ nữ có lượng testosterone thấp hơn nam nhiều lần, nên lượng cơ tăng thêm tính theo kg chậm hơn. Vóc dáng "săn chắc" mà nhiều người mong muốn thật ra chính là **có thêm cơ và bớt mỡ**.

## Nữ tiến bộ có chậm hơn nam?

Phân tích gộp của Roberts, Nuckols và Krieger (2020): khi tập cùng chương trình, nữ **tăng cơ theo tỉ lệ phần trăm tương đương nam**, và **sức mạnh thân trên tăng theo tỉ lệ còn nhiều hơn**. Vì vậy nữ tập theo đúng những nguyên tắc như nam: đủ khối lượng, tăng tiến, gần giới hạn.

## Lợi ích dành riêng cho phụ nữ

- **Xương chắc hơn**, giảm nguy cơ loãng xương sau mãn kinh.
- Cải thiện độ nhạy insulin, hỗ trợ kiểm soát cân nặng.
- Tự tin hơn, ít đau lưng hơn, khoẻ hơn khi mang thai và chăm con.

## Một tuần mẫu

| Ngày | Nội dung |
|---|---|
| T2 | Mông, đùi: [[ex:hipthrust]], [[ex:gobletsquat]], [[ex:rdl]] |
| T4 | Thân trên: [[ex:latpulldown]], [[ex:dbrow]], [[ex:dbpress]] |
| T6 | Toàn thân + đi bộ dốc |

:::ap-dung
Bắt đầu với giáo án [[tpl:tpl-f-fb|Full Body cho nữ]] hoặc [[tpl:tpl-f-home|Tại nhà cho nữ]]. Sau khoảng 3 tháng, chuyển sang [[tpl:tpl-f-glute|Glute Focus]] nếu muốn ưu tiên vòng ba.
:::

:::an-toan
Phụ nữ đang mang thai, mới sinh, có triệu chứng sa vùng chậu hoặc són tiểu khi gắng sức nên đọc [[kb:pn-mang-thai]] và [[kb:pn-sau-sinh]] trước khi tập nặng.
:::` },

{ id:"pn-chu-ky-kinh", cat:"phu-nu", audience:"ca-hai", updated:U,
  title:"Chu kỳ kinh nguyệt và tập luyện: có cần \"tập theo chu kỳ\"?",
  summary:"Bằng chứng hiện tại khiêm tốn hơn lời khuyên trên mạng. Lắng nghe cơ thể quan trọng hơn lịch tập theo pha.",
  tags:["kinh nguyệt","chu kỳ","phụ nữ","hiệu suất"],
  ex:["walking","machinepress","legpress"],
  sources:["McNulty KL, et al. The effects of menstrual cycle phase on exercise performance in eumenorrheic women: a systematic review and meta-analysis. Sports Med 2020;50(10):1813–1827.",
    "Colenso-Semple LM, et al. Current evidence shows no influence of women's menstrual cycle phase on acute strength performance or adaptations to resistance exercise training. Front Sports Act Living 2023;5:1054542.", MOUNTJOY],
  body:`Mạng xã hội có rất nhiều lời khuyên "tập theo chu kỳ". Bằng chứng khoa học hiện tại khiêm tốn hơn nhiều.

## Nghiên cứu nói gì

- Phân tích gộp của McNulty (2020): hiệu suất có thể **giảm rất nhẹ** trong giai đoạn đầu nang noãn (những ngày hành kinh). Mức chênh lệch **rất nhỏ** và khác nhau nhiều giữa từng người.
- Tổng quan của Colenso-Semple (2023): **chưa có bằng chứng** cho thấy giai đoạn chu kỳ ảnh hưởng đến sức mạnh hay kết quả tập tạ dài hạn.

Kết luận: **lắng nghe cơ thể bạn** quan trọng hơn một lịch tập "chuẩn" theo từng pha.

## Gợi ý thực tế

| Khi | Gợi ý |
|---|---|
| Đau bụng kinh, mệt | Giảm khối lượng, chọn bài máy như [[ex:machinepress]], [[ex:legpress]], hoặc [[ex:walking]] nhẹ. Nhiều người thấy vận động nhẹ giúp đỡ đau |
| Thấy khoẻ | Tập bình thường, kể cả tập nặng |
| Cân nặng nhích lên trước kỳ kinh | Thường do giữ nước, không phải tăng mỡ |

## Mất kinh không phải "dấu hiệu tập chăm"

Mất kinh từ 3 tháng trở lên, hoặc chu kỳ thưa dần khi tập nhiều và ăn ít, có thể là dấu hiệu **thiếu năng lượng tương đối (REDs)**. Đọc [[kb:pn-reds]].

:::ap-dung
Ghi ngày hành kinh và cảm giác buổi tập (thang 1–5) trong 3 chu kỳ. Bạn sẽ thấy quy luật riêng của mình, nếu có.
:::

:::an-toan
Đau bụng kinh dữ dội, ra máu rất nhiều hoặc rong kinh cần đi khám phụ khoa. Thiếu máu do mất nhiều máu kinh làm giảm sức bền rõ rệt.
:::` },

{ id:"pn-mang-thai", cat:"phu-nu", audience:"ca-hai", updated:U,
  title:"Tập luyện khi mang thai: an toàn và có lợi",
  summary:"Với thai kỳ không biến chứng, vận động giúp giảm nguy cơ tiểu đường thai kỳ, tiền sản giật. Khuyến nghị, điều chỉnh và dấu hiệu phải dừng.",
  tags:["mang thai","bà bầu","thai kỳ","sàn chậu","an toàn"],
  ex:["walking","bwsquat","glutebridge","dbrow","sideplank"],
  sources:[ACOG, MOTTOLA],
  body:`Với thai kỳ không biến chứng, tập luyện **an toàn và có lợi**: giảm nguy cơ tiểu đường thai kỳ, tiền sản giật, tăng cân quá mức và đau lưng. Hướng dẫn của Canada (Mottola, 2018) và ACOG (2020) đều khuyến khích phụ nữ mang thai vận động.

## Khuyến nghị

- **Ít nhất 150 phút/tuần** vận động cường độ vừa, chia ít nhất 3 ngày, tốt nhất là mỗi ngày.
- Kết hợp vận động aerobic và tập sức mạnh nhẹ đến vừa.
- Tập **cơ sàn chậu** hằng ngày.
- Thước đo cường độ đơn giản: vẫn **nói chuyện được** trong lúc tập.

## Điều chỉnh theo thai kỳ

| Giai đoạn | Lưu ý |
|---|---|
| 3 tháng đầu | Tiếp tục các bài đã quen, tránh để cơ thể quá nóng |
| Từ tháng thứ 4 | Hạn chế nằm ngửa lâu nếu thấy chóng mặt, buồn nôn; dùng ghế dốc |
| 3 tháng cuối | Giảm tạ, tránh bài dễ mất thăng bằng, tập trong biên độ thoải mái |

## Nên tránh

- Môn có nguy cơ va chạm hoặc té ngã: bóng đá, võ thuật, cưỡi ngựa.
- Lặn biển; tập ở độ cao lớn khi chưa thích nghi.
- Tập trong phòng quá nóng (hot yoga).

:::ap-dung
Tuần mẫu: 5 ngày [[ex:walking]] 30 phút + 2 buổi tạ nhẹ ([[ex:bwsquat]], [[ex:glutebridge]], [[ex:dbrow]], [[ex:sideplank]]) + bài sàn chậu mỗi ngày.
:::

:::an-toan
**Dừng tập và đi khám** nếu ra máu âm đạo, rỉ nước ối, co thắt tử cung đều và đau, chóng mặt, đau ngực, đau đầu dữ dội, khó thở trước khi gắng sức, đau và sưng bắp chân. Mọi phụ nữ mang thai nên hỏi bác sĩ sản khoa trước khi bắt đầu một chương trình tập mới.
:::` },

{ id:"pn-sau-sinh", cat:"phu-nu", audience:"ca-hai", updated:U,
  title:"Sau sinh quay lại tập: sàn chậu, tách cơ bụng và lộ trình",
  summary:"Sàn chậu trước, cơ bụng sau. Cách tập cơ sàn chậu, hiểu về tách cơ bụng và lộ trình gợi ý trở lại chạy nhảy.",
  tags:["sau sinh","sàn chậu","tách cơ bụng","mẹ bỉm"],
  ex:["walking","deadbug","glutebridge","bwsquat","sideplank"],
  sources:[ACOG,
    "Dumoulin C, Cacciari LP, Hay-Smith EJC. Pelvic floor muscle training versus no treatment, or inactive control treatments, for urinary incontinence in women. Cochrane Database Syst Rev 2018;10:CD005654.",
    "Benjamin DR, van de Water ATM, Peiris CL. Effects of exercise on diastasis of the rectus abdominis muscle in the antenatal and postnatal periods: a systematic review. Physiotherapy 2014;100(1):1–8.",
    "Goom T, Donnelly G, Brockwell E. Returning to running postnatal – guidelines for medical, health and fitness professionals managing this population. 2019."],
  body:`Cơ thể cần thời gian hồi phục sau sinh. Theo ACOG (2020), với ca sinh thường không biến chứng, nhiều phụ nữ có thể bắt đầu vận động nhẹ **sau vài ngày**, khi cảm thấy sẵn sàng. Sinh mổ hoặc có biến chứng thì cần bác sĩ đồng ý.

## Sàn chậu trước, cơ bụng sau

Cơ sàn chậu bị kéo giãn trong thai kỳ và khi sinh. Tổng quan Cochrane (Dumoulin, 2018) cho thấy **tập cơ sàn chậu** giúp giảm són tiểu ở phụ nữ.

Cách tập: thở ra, nhẹ nhàng thắt và kéo cơ sàn chậu lên (như đang nín tiểu), giữ 5–10 giây, rồi thả lỏng hoàn toàn 10 giây. Làm 8–12 lần, 3 lượt mỗi ngày.

## Tách cơ bụng

Khoảng cách giữa hai bó cơ thẳng bụng rộng ra là chuyện thường gặp sau sinh. Tổng quan của Benjamin (2014) gợi ý tập luyện có thể giúp thu hẹp khoảng cách, nhưng bằng chứng còn hạn chế. Điều quan trọng là học cách **kiểm soát áp lực ổ bụng**: thở ra khi gắng sức, tránh để bụng phồng thành "chóp" dọc đường giữa.

## Lộ trình gợi ý

| Mốc (tuỳ từng người) | Nội dung |
|---|---|
| Tuần đầu | Đi bộ nhẹ, tập thở, tập sàn chậu |
| 2–6 tuần | [[ex:deadbug]], [[ex:glutebridge]], đi bộ ([[ex:walking]]) lâu hơn |
| Sau tái khám (khoảng 6 tuần) | [[ex:bwsquat]], tạ nhẹ, [[ex:sideplank]] thời gian ngắn |
| Từ khoảng 12 tuần | Chạy, nhảy nếu không són tiểu, không thấy nặng vùng chậu (Goom, 2019) |

:::ap-dung
Mỗi lần cho con bú, tập 5 lần co sàn chậu. Gắn bài tập vào một thói quen có sẵn giúp bạn nhớ tập hơn.
:::

:::an-toan
Són tiểu khi ho hoặc nhảy, cảm giác nặng hay sa xuống vùng âm đạo, đau khi quan hệ, ra máu nhiều trở lại: hãy gặp bác sĩ sản khoa hoặc chuyên viên vật lý trị liệu sàn chậu trước khi tập nặng hoặc chạy.
:::` },

{ id:"pn-reds", cat:"phu-nu", audience:"ca-hai", updated:U,
  title:"Ăn quá ít, tập quá nhiều: thiếu năng lượng tương đối (REDs)",
  summary:"Khi năng lượng nạp vào không đủ cho cả tập luyện và chức năng sống, cơ thể bắt đầu cắt giảm. Dấu hiệu nhận biết và cách phòng tránh.",
  tags:["REDs","mất kinh","ăn kiêng","xương","phụ nữ"],
  ex:["running"],
  sources:[MOUNTJOY,
    "De Souza MJ, et al. 2014 Female Athlete Triad Coalition consensus statement on treatment and return to play of the female athlete triad. Br J Sports Med 2014;48(4):289."],
  body:`**REDs** (Relative Energy Deficiency in Sport) xảy ra khi năng lượng ăn vào không đủ cho cả tập luyện lẫn các chức năng sống. Cơ thể buộc phải "cắt giảm" hoạt động của hệ nội tiết, xương, miễn dịch, tim mạch và tâm lý. Đồng thuận IOC 2023 (Mountjoy) nhấn mạnh tình trạng này gặp ở **cả nữ và nam**, cả vận động viên chuyên nghiệp lẫn người tập phong trào.

## Dấu hiệu cần chú ý

| Nhóm | Dấu hiệu |
|---|---|
| Nội tiết | Mất kinh từ 3 tháng trở lên, chu kỳ thưa dần; ở nam giảm ham muốn |
| Xương | Gãy xương do mỏi, mật độ xương thấp |
| Hiệu suất | Sức mạnh, sức bền giảm dù vẫn tập chăm |
| Sức khoẻ | Hay ốm, chóng mặt, lạnh tay chân, táo bón, rụng tóc |
| Tâm lý | Lo âu về ăn uống, cáu gắt, mất tập trung |

## Ai có nguy cơ?

- Người giảm cân nhanh hoặc ăn kiêng khắt khe kéo dài.
- Môn đòi hỏi cân nặng thấp hoặc vóc dáng gọn: chạy đường dài, thể dục dụng cụ, múa, thi hình thể.
- Người tăng khối lượng tập đột ngột mà không ăn thêm.

## Phòng tránh

1. Tránh mức thâm hụt năng lượng sâu kéo dài nhiều tháng.
2. Ăn đủ tinh bột vào những ngày tập nặng.
3. Theo dõi chu kỳ kinh như một "dấu hiệu sinh tồn".

:::ap-dung
Nếu bạn đang ăn rất ít mà vẫn tập 6–7 buổi/tuần, hãy thử tăng thêm 200–300 kcal/ngày (chủ yếu từ tinh bột) trong 4 tuần và theo dõi năng lượng, giấc ngủ, chu kỳ kinh.
:::

:::an-toan
Mất kinh không phải chuyện "bình thường khi tập chăm". Hãy khám phụ khoa hoặc nội tiết. Nếu bạn sợ tăng cân, ăn uống mất kiểm soát hoặc nôn sau khi ăn, hãy tìm đến chuyên gia sức khoẻ tâm thần. Rối loạn ăn uống có thể điều trị được.
:::` },

{ id:"pn-tien-man-kinh", cat:"phu-nu", audience:"ca-hai", updated:U,
  title:"Tiền mãn kinh, mãn kinh: tập tạ để giữ xương và cơ",
  summary:"Sau mãn kinh, xương mất nhanh hơn. Thử nghiệm LIFTMOR cho thấy tập nặng có giám sát giúp tăng mật độ xương.",
  tags:["mãn kinh","loãng xương","xương","phụ nữ trung niên"],
  ex:["deadlift","squat","gobletsquat","rdl","dbpress","stepup","farmercarry","walking"],
  sources:["Watson SL, et al. High-intensity resistance and impact training improves bone mineral density and physical function in postmenopausal women with osteopenia and osteoporosis: the LIFTMOR randomized controlled trial. J Bone Miner Res 2018;33(2):211–220.", FRAGALA,
    { t:"WHO (2020). WHO guidelines on physical activity and sedentary behaviour.", u:"https://www.who.int/publications/i/item/9789240015128" }],
  body:`Sau mãn kinh, estrogen giảm khiến **xương mất nhanh hơn** và cơ dễ teo hơn. Tập kháng lực là một trong những cách hiệu quả nhất để làm chậm quá trình này.

## Bằng chứng từ LIFTMOR

Thử nghiệm LIFTMOR (Watson, 2018): phụ nữ sau mãn kinh có **mật độ xương thấp** tập tạ **nặng** (5 hiệp × 5 lần, khoảng 80–85 % 1RM với deadlift, squat, đẩy vai) kết hợp bài va chạm (bật nhảy đu xà), 2 buổi/tuần trong 8 tháng, **dưới sự giám sát chặt chẽ**. Kết quả: mật độ xương cột sống thắt lưng và cổ xương đùi **tăng** so với nhóm tập nhẹ, không có chấn thương nghiêm trọng.

Thông điệp: xương phản ứng với **tải đủ lớn**. Các bài nhẹ nhàng tốt cho sức khoẻ chung nhưng chưa đủ để kích thích xương.

## Gợi ý một tuần

| Thành phần | Liều |
|---|---|
| Tạ toàn thân (tăng dần tới mức nặng) | 2–3 buổi: [[ex:gobletsquat]] hoặc [[ex:squat]], [[ex:rdl]] hoặc [[ex:deadlift]], [[ex:dbpress]], [[ex:stepup]] |
| Va chạm nhẹ (nếu được bác sĩ cho phép) | Nhón gót rồi thả xuống, bật nhảy thấp |
| Thăng bằng | Ít nhất 3 ngày/tuần theo WHO cho người lớn tuổi: đứng một chân, [[ex:farmercarry]] |
| Aerobic | 150 phút [[ex:walking]] nhanh mỗi tuần |

## Các triệu chứng khác

Bốc hoả, mất ngủ, thay đổi tâm trạng có thể cải thiện phần nào nhờ vận động đều đặn. Hãy trao đổi với bác sĩ về các lựa chọn điều trị phù hợp.

:::ap-dung
Tập 8–12 tuần với tạ vừa để học kỹ thuật, sau đó mới tăng dần lên mức nặng (5–8 lần) dưới sự hướng dẫn của PT.
:::

:::an-toan
Người đã bị **loãng xương** hoặc từng gãy xương do loãng xương cần bác sĩ đánh giá trước khi tập nặng hoặc tập bài va chạm. Tránh gập lưng mang tải và gập bụng kiểu sit-up.
:::` },

/* ======================= CARDIO, CHẠY & HYROX ======================= */
{ id:"cd-vung-nhip-tim", cat:"cardio", audience:"ca-hai", updated:U,
  title:"Vùng nhịp tim và Zone 2: tính sao cho đúng",
  summary:"Công thức nhịp tim tối đa chính xác hơn \"220 trừ tuổi\", bảng 5 vùng và bài kiểm tra nói chuyện khi không có đồng hồ.",
  tags:["nhịp tim","Zone 2","HRmax","cardio","sức bền"],
  ex:["zone2","rowing","walking","running"],
  sources:["Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. J Am Coll Cardiol 2001;37(1):153–156.",
    "Foster C, et al. The talk test as a marker of exercise training intensity. J Cardiopulm Rehabil Prev 2008;28(1):24–30.",
    "Seiler S. What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform 2010;5(3):276–291."],
  body:`## Nhịp tim tối đa (HRmax)

Công thức "220 − tuổi" quen thuộc nhưng sai số lớn. Tanaka (2001) đề xuất **208 − 0,7 × tuổi**, chính xác hơn ở người trưởng thành. Ví dụ người 30 tuổi: 208 − 21 = **187 nhịp/phút**. Dù vậy, sai số với từng người vẫn có thể từ 10 nhịp trở lên.

## Vùng nhịp tim (theo % HRmax, mô hình 5 vùng phổ biến)

| Vùng | % HRmax | Cảm giác | Dùng cho |
|---|---|---|---|
| 1 | 50–60 % | Rất nhẹ | Hồi phục |
| 2 | 60–70 % | Nói chuyện được thành câu | Nền tảng sức bền |
| 3 | 70–80 % | Chỉ nói được từng cụm | Nhịp "tempo" |
| 4 | 80–90 % | Chỉ nói được vài từ | Quanh ngưỡng |
| 5 | 90–100 % | Không nói được | Ngắt quãng ngắn |

## Bài kiểm tra nói chuyện

Không có đồng hồ đo nhịp tim? Hãy dùng **bài kiểm tra nói chuyện** (talk test). Foster (2008) cho thấy mức bạn vẫn nói thoải mái thành câu thường nằm dưới ngưỡng thông khí, tương ứng với vùng Zone 2.

## Vì sao Zone 2 được ưa chuộng?

Các nghiên cứu mô tả cách tập của vận động viên sức bền hàng đầu (Seiler, 2010) cho thấy khoảng **80 % thời gian tập ở cường độ thấp**, 20 % còn lại ở cường độ cao. Với người tập phong trào, Zone 2 dễ duy trì, ít mệt và hồi phục nhanh.

:::ap-dung
Thử [[ex:zone2]] 30–45 phút trên xe đạp hoặc [[ex:rowing]], giữ mức vẫn nói chuyện được. Mỗi tuần tăng thêm 5–10 phút.
:::

:::an-toan
Người dùng thuốc chẹn beta, có bệnh tim hoặc rối loạn nhịp tim: công thức nhịp tim không còn chính xác. Hãy dùng thang cảm nhận gắng sức (RPE) và làm theo hướng dẫn của bác sĩ.
:::` },

{ id:"cd-chay-bo-nguoi-moi", cat:"cardio", audience:"nguoi-tap", updated:U,
  title:"Chạy bộ cho người mới: từ 0 đến 5 km trong 9 tuần",
  summary:"Khung 9 tuần theo chương trình Couch to 5K của NHS, tốc độ chạy phù hợp và cách phòng chấn thương khi mới chạy.",
  tags:["chạy bộ","5 km","người mới","Couch to 5K"],
  ex:["running","intervalwalk","walking","calfraise"],
  sources:[{ t:"NHS. Couch to 5K: week by week.", u:"https://www.nhs.uk/live-well/exercise/running-and-aerobic-exercises/get-running-with-couch-to-5k/" },
    "Nielsen RO, et al. Training errors and running related injuries: a systematic review. Int J Sports Phys Ther 2012;7(1):58–75.",
    "Buist I, et al. No effect of a graded training program on the number of running-related injuries in novice runners: a randomized controlled trial. Am J Sports Med 2008;36(1):33–39."],
  body:`Chương trình **Couch to 5K** của NHS (Anh) đã giúp rất nhiều người mới chạy được 5 km trong khoảng 9 tuần, với 3 buổi mỗi tuần xen kẽ chạy và đi bộ.

## Khung 9 tuần (rút gọn)

| Tuần | Mỗi buổi (sau 5 phút đi bộ nhanh khởi động) |
|---|---|
| 1 | 8 lượt: chạy 60 giây + đi bộ 90 giây |
| 2 | 6 lượt: chạy 90 giây + đi bộ 2 phút |
| 3 | 2 lượt: chạy 90 giây, đi 90 giây, chạy 3 phút, đi 3 phút |
| 4 | Chạy 3 – đi 1,5 – chạy 5 – đi 2,5 – chạy 3 – đi 1,5 – chạy 5 (phút) |
| 5 | Từ các đoạn chạy 5–8 phút tiến tới chạy liền 20 phút |
| 6 | Tiến tới chạy liền 25 phút |
| 7 | Chạy liền 25 phút |
| 8 | Chạy liền 28 phút |
| 9 | Chạy liền 30 phút |

Chưa theo kịp tuần nào thì **lặp lại tuần đó**. Đây là chuyện hoàn toàn bình thường.

## Chạy "chậm đến mức ngại"

Người mới thường chạy quá nhanh. Hãy chạy ở tốc độ vẫn **nói chuyện được**, có khi chỉ nhanh hơn đi bộ một chút.

## Phòng chấn thương

- Tổng quan về lỗi tập luyện (Nielsen, 2012): **tăng quãng đường quá nhanh** là yếu tố nguy cơ hay được nhắc đến.
- "Quy tắc tăng 10 % mỗi tuần" rất nổi tiếng nhưng chưa được chứng minh rõ (Buist, 2008). Điều quan trọng là tăng dần và lắng nghe cơ thể.
- Thêm 2 buổi tạ/tuần cho chân, mông và bắp chân ([[ex:calfraise]]).

:::ap-dung
Tuần này: 3 buổi [[ex:intervalwalk]] hoặc chạy xen đi bộ theo tuần 1. Ghi lại cảm giác sau mỗi buổi. Đau ống chân thì nghỉ thêm 1 ngày.
:::

:::an-toan
Đau khu trú tại một điểm trên xương (ống chân, bàn chân), đau tăng khi chạy và cả khi nghỉ có thể là **gãy xương do mỏi**. Hãy ngừng chạy và đi khám.
:::` },

{ id:"cd-giay-chay", cat:"cardio", audience:"nguoi-tap", updated:U,
  title:"Chọn giày chạy và tư thế chạy: bằng chứng nói gì",
  summary:"Chọn giày theo cảm giác thoải mái, tăng nhẹ nhịp bước chân để giảm tải lên gối, và mẹo mua giày.",
  tags:["giày chạy","tư thế chạy","nhịp bước","chấn thương chạy"],
  ex:["running","calfraise"],
  sources:["Nigg BM, et al. Running shoes and running injuries: mythbusting and a proposal for two new paradigms: 'preferred movement path' and 'comfort filter'. Br J Sports Med 2015;49(20):1290–1294.",
    "Heiderscheit BC, et al. Effects of step rate manipulation on joint mechanics during running. Med Sci Sports Exerc 2011;43(2):296–302."],
  body:`## Giày: chọn theo cảm giác thoải mái

Tổng quan của Nigg (2015) đưa ra hai nguyên tắc:

1. **Bộ lọc thoải mái:** chọn đôi giày bạn thấy **thoải mái nhất** khi chạy thử. Cách này gắn với nguy cơ chấn thương thấp hơn so với chọn theo "kiểu bàn chân".
2. **Đường chuyển động ưa thích:** giày tốt để cơ thể chạy theo cách tự nhiên của bạn, không ép vào một kiểu cố định.

Cách phân loại "bàn chân bẹt thì phải mua giày chống lật" **chưa có bằng chứng mạnh** về việc giảm chấn thương.

## Mẹo mua giày

- Thử giày vào buổi chiều (lúc chân hơi nở), mang tất chạy bộ.
- Chừa khoảng **một ngón tay cái** ở mũi giày.
- Chạy thử trên máy tại cửa hàng nếu được.
- Đổi giày mới từ từ, dùng xen kẽ với đôi cũ trong 1–2 tuần.

## Tư thế chạy

- **Tăng nhịp bước khoảng 5–10 %** (bước ngắn hơn, nhanh hơn) giúp giảm tải lên gối và hông (Heiderscheit, 2011). Đây là thay đổi đơn giản nhất cho người hay đau gối.
- Không cần ép đổi sang tiếp đất bằng mũi chân. Đổi kiểu tiếp đất đột ngột dễ chuyển chấn thương sang bắp chân và gân gót. Nếu muốn đổi, hãy tập thêm [[ex:calfraise]] và chuyển từ từ.
- Thân hơi đổ về trước, vai thả lỏng, tay đánh nhẹ nhàng.

:::ap-dung
Đếm số bước trong 1 phút ở tốc độ [[ex:running]] thoải mái. Thử tăng thêm 5 % (ví dụ 160 lên 168 bước/phút) bằng nhạc có nhịp tương ứng trong 2–3 buổi chạy ngắn.
:::

:::an-toan
Khi chạy trên vỉa hè, chú ý mặt đường gồ ghề, xe máy và chó thả rông. Chạy buổi tối thì mặc đồ phản quang, mang đèn. Chạy một mình nên báo lộ trình cho người thân.
:::` },

{ id:"cd-hyrox-la-gi", cat:"cardio", audience:"ca-hai", updated:U,
  title:"Hyrox là gì? Thể thức thi, 8 trạm và ai nên thử",
  summary:"8 lần chạy 1 km xen 8 trạm bài tập cố định. Bảng trạm, các hạng thi và yếu tố quyết định thành tích.",
  tags:["Hyrox","thi đấu","hybrid","fitness racing"],
  ex:["running","rowing","sledpush","bentoverrow","burpee","farmercarry","lunges","wallball"],
  tpl:["tpl-u-hyrox"],
  sources:[HYROX, SCHUMANN],
  body:`**Hyrox** là giải thi đấu thể lực tổng hợp dành cho mọi người. Thể thức **giống nhau ở mọi giải trên thế giới**: **8 lần chạy 1 km**, sau mỗi lần chạy là **1 trạm bài tập**.

## 8 trạm theo thứ tự

| # | Trạm | Khối lượng | Bài gần giống trong app |
|---|---|---|---|
| 1 | SkiErg | 1.000 m | Kéo cáp đứng, [[ex:rowing]] |
| 2 | Sled Push (đẩy xe trượt) | 50 m | [[ex:sledpush]] |
| 3 | Sled Pull (kéo xe trượt) | 50 m | Kéo dây thừng, [[ex:bentoverrow]] |
| 4 | Burpee Broad Jump (burpee bật xa) | 80 m | [[ex:burpee]] + bật xa |
| 5 | Rowing (chèo thuyền) | 1.000 m | [[ex:rowing]] |
| 6 | Farmers Carry (xách tạ đi bộ) | 200 m | [[ex:farmercarry]] |
| 7 | Sandbag Lunges (chùng chân vác bao cát) | 100 m | [[ex:lunges]] |
| 8 | Wall Balls (ném bóng tường) | 100 lần | [[ex:wallball]] |

Có nhiều hạng thi: **Open**, **Pro** (tạ nặng hơn), **Doubles** (2 người cùng chạy, chia nhau các trạm) và **Relay** (đồng đội 4 người). Mức tạ khác nhau theo hạng và giới tính. Hãy xem luật mới nhất trên trang chính thức trước mỗi mùa giải.

## Ai nên thử?

- Người thích có **mục tiêu cụ thể** để tập luyện.
- Người tập gym muốn thêm sức bền, người chạy bộ muốn thêm sức mạnh.
- Người mới hoàn toàn: bắt đầu với hạng **Doubles** hoặc **Relay**.

## Điều gì quyết định thành tích?

Tổng cộng 8 km chạy chiếm phần lớn thời gian thi của nhiều người. Các trạm cuối như Sandbag Lunges và Wall Balls thường gây mệt nhất vì đến khi chân đã mỏi. Nền tảng là **sức bền chạy tốt** cộng với **sức mạnh bền** của chân.

:::ap-dung
Đọc tiếp [[kb:cd-luyen-hyrox|cách luyện tập cho Hyrox]] và thử giáo án [[tpl:tpl-u-hyrox|Hybrid kiểu Hyrox 4 buổi]].
:::

:::an-toan
Một lượt Hyrox thường kéo dài hơn 1 giờ ở cường độ cao với người tập phong trào. Người có bệnh tim mạch hoặc chưa tập đều nên khám sức khoẻ trước. Tập quen dần việc chạy ngay sau bài tạ để tránh chuột rút và chấn thương.
:::` },

{ id:"cd-luyen-hyrox", cat:"cardio", audience:"ca-hai", updated:U,
  title:"Luyện tập cho Hyrox và thể thao hybrid: kết hợp chạy và tạ",
  summary:"Tập kết hợp không làm mất cơ nếu sắp xếp hợp lý. Nguyên tắc xếp lịch, tuần mẫu 4 buổi và bài \"chạy khi chân đã mỏi\".",
  tags:["Hyrox","hybrid","tập kết hợp","chạy và tạ"],
  ex:["squat","deadlift","running","sledpush","wallball","lunges","farmercarry","rowing"],
  tpl:["tpl-u-hyrox","tpl-u-hybrid-adv","tpl-f-hybrid"],
  sources:[SCHUMANN,
    "Wilson JM, et al. Concurrent training: a meta-analysis examining interference of aerobic and resistance exercises. J Strength Cond Res 2012;26(8):2293–2307.",
    "Seiler S. What is best practice for training intensity and duration distribution in endurance athletes? Int J Sports Physiol Perform 2010;5(3):276–291.", HYROX],
  body:`## Chạy và tạ có "ăn mòn" cơ bắp?

Phân tích gộp mới của Schumann (2022) cho thấy tập kết hợp **không làm giảm mức tăng cơ và sức mạnh tối đa**, nhưng có thể làm giảm **sức bật**, nhất là khi chạy và tạ nằm trong cùng một buổi. Kết luận thực tế: bạn hoàn toàn có thể làm cả hai, chỉ cần sắp xếp hợp lý.

## Nguyên tắc xếp lịch

1. Tách buổi chạy và buổi tạ chân nặng **ít nhất 6 giờ**, tốt nhất là khác ngày.
2. Nếu tập cùng buổi, làm **phần ưu tiên trước**.
3. Phần lớn buổi chạy ở **Zone 2**, chỉ 1–2 buổi cường độ cao mỗi tuần.
4. Tăng tổng khối lượng từ từ, có tuần giảm tải.

## Tuần mẫu 4 buổi

| Ngày | Buổi |
|---|---|
| T2 | Sức mạnh: [[ex:squat]], [[ex:deadlift]], đẩy, kéo (3–5 lần mỗi hiệp) |
| T3 | Chạy Zone 2, 40–50 phút |
| T5 | Ngắt quãng: 4–6 lượt chạy 1 km ở tốc độ thi, nghỉ 2 phút |
| T7 | "Mô phỏng thi": 4 lượt (chạy 1 km + 1 trạm như [[ex:sledpush]], [[ex:wallball]], [[ex:lunges]], [[ex:farmercarry]]) |

## Tập "chạy khi chân đã mỏi"

Bài **chạy ngay sau một trạm** giúp cơ thể quen với cảm giác chân nặng trịch khi thi. Bắt đầu với 2–3 cặp chạy + trạm, rồi tăng dần.

:::ap-dung
Chọn giáo án theo trình độ: [[tpl:tpl-f-hybrid|Hybrid cho nữ]], [[tpl:tpl-u-hyrox|Hybrid kiểu Hyrox]] hoặc [[tpl:tpl-u-hybrid-adv|Hybrid Athlete 5 buổi]].
:::

:::an-toan
Đau ống chân, đau gót và gân gót thường xuất hiện khi tăng chạy quá nhanh. Mỗi tuần chỉ tăng **một** yếu tố: hoặc quãng đường, hoặc cường độ.
:::` },

{ id:"cd-o-nhiem-khong-khi", cat:"cardio", audience:"nguoi-tap", updated:U,
  title:"Chạy và tập ngoài trời khi không khí ô nhiễm",
  summary:"Đọc chỉ số AQI, khi nào vẫn nên chạy, khi nào chuyển vào trong nhà, và cách giảm phơi nhiễm bụi mịn.",
  tags:["ô nhiễm","AQI","bụi mịn","chạy ngoài trời","PM2.5"],
  ex:["running","walking","zone2","rowing"],
  sources:[{ t:"WHO (2021). WHO global air quality guidelines: particulate matter (PM2.5 and PM10), ozone, nitrogen dioxide, sulfur dioxide and carbon monoxide.", u:"https://www.who.int/publications/i/item/9789240034228" },
    "Tainio M, et al. Can air pollution negate the health benefits of cycling and walking? Prev Med 2016;87:233–236.",
    "Tổng cục Môi trường. Quyết định 1459/QĐ-TCMT (2019) ban hành Hướng dẫn kỹ thuật tính toán và công bố chỉ số chất lượng không khí Việt Nam (VN_AQI)."],
  body:`Hà Nội, TP.HCM và nhiều đô thị có những ngày chỉ số chất lượng không khí (AQI) ở mức xấu, nhất là vào mùa khô. Bụi mịn **PM2.5** có thể đi sâu vào phổi và máu.

## Có nên bỏ hẳn chạy ngoài trời?

Mô hình của Tainio (2016) cho thấy ở **phần lớn đô thị trên thế giới**, lợi ích của đi bộ và đạp xe **vượt xa** tác hại của ô nhiễm. Chỉ khi ô nhiễm ở mức rất cao và vận động kéo dài nhiều giờ, lợi ích mới bắt đầu giảm. Tuy vậy, **người nhạy cảm** (hen, bệnh tim phổi, người cao tuổi, trẻ em, phụ nữ mang thai) cần thận trọng hơn.

## Hướng dẫn theo AQI (thang VN_AQI)

| AQI | Mức | Gợi ý tập ngoài trời |
|---|---|---|
| 0–50 | Tốt | Thoải mái |
| 51–100 | Trung bình | Người nhạy cảm nên rút ngắn buổi dài, buổi cường độ cao |
| 101–150 | Kém | Người nhạy cảm tập trong nhà; người khoẻ rút ngắn buổi tập |
| 151–200 | Xấu | Mọi người nên chuyển vào trong nhà |
| Trên 200 | Rất xấu, nguy hại | Tránh vận động ngoài trời |

## Mẹo giảm phơi nhiễm

- Chạy xa đường lớn và tránh giờ cao điểm; công viên, ven hồ thường thoáng hơn.
- Chạy vào sáng sớm hoặc sau cơn mưa.
- Ngày không khí xấu: chuyển sang máy chạy bộ, [[ex:rowing]] hoặc đạp xe trong nhà.

:::ap-dung
Cài một ứng dụng theo dõi AQI và kiểm tra trước giờ chạy. Chuẩn bị sẵn phương án "buổi [[ex:zone2]] trong nhà" cho những ngày không khí xấu.
:::

:::an-toan
Người bị hen nên mang theo thuốc cắt cơn. Nếu tức ngực, khò khè hoặc ho dai dẳng khi đang tập ngoài trời, hãy dừng ngay và vào trong nhà.
:::` },

/* ======================= TÂM LÝ & THÓI QUEN ======================= */
{ id:"tl-thoi-quen", cat:"tam-ly", audience:"ca-hai", updated:U,
  title:"Xây thói quen tập: vì sao cần khoảng 2 tháng và cách làm dễ hơn",
  summary:"Thói quen cần trung bình 66 ngày để thành tự động. 4 kỹ thuật có bằng chứng giúp bạn đi tập đều.",
  tags:["thói quen","động lực","kế hoạch","duy trì"],
  ex:["bwsquat","walking"],
  sources:[LALLY, "Gollwitzer PM, Sheeran P. Implementation intentions and goal achievement: a meta-analysis of effects and processes. Adv Exp Soc Psychol 2006;38:69–119."],
  body:`Nghiên cứu của Lally (2010) theo dõi người tham gia tạo một thói quen mới. Thời gian để hành vi trở nên "tự động" có **trung vị 66 ngày**, dao động rất rộng **từ 18 đến 254 ngày**. Tin vui: **lỡ một ngày không làm hỏng** quá trình hình thành thói quen.

## 4 kỹ thuật có bằng chứng

### 1. Kế hoạch "Nếu… thì…"

Phân tích gộp của Gollwitzer & Sheeran (2006) cho thấy câu dạng **"Nếu [tình huống], thì tôi sẽ [hành động]"** giúp tăng khả năng đạt mục tiêu với mức hiệu quả từ vừa đến lớn.

- "Nếu là 17 h 30 thứ Hai, Tư, Sáu, thì tôi đi thẳng đến phòng tập."
- "Nếu trời mưa, thì tôi tập giáo án tại nhà 25 phút."

### 2. Gắn với thói quen có sẵn

Sau khi đánh răng buổi sáng → 10 lần [[ex:bwsquat]]. Sau khi pha cà phê → [[ex:walking]] 10 phút.

### 3. Làm cho việc bắt đầu thật dễ

Chuẩn bị túi tập từ tối hôm trước. Đặt giày ngay cạnh cửa. Ngày lười, chỉ cam kết **10 phút**. Thường bạn sẽ tập tiếp.

### 4. Theo dõi và ghi nhận

Đánh dấu buổi tập, nhìn chuỗi ngày tăng lên. Đừng tự trách khi lỡ buổi, chỉ cần quay lại ở buổi kế tiếp.

:::ap-dung
Viết 2 câu "Nếu… thì…" cho tuần này: một câu cho lịch bình thường, một câu cho ngày bận. Đặt nhắc giờ tập trong **Menu → Nhắc nhở**.
:::

:::an-toan
Thói quen tốt là thói quen bền. Đừng đặt mục tiêu quá sức ngay tuần đầu, ví dụ 6 buổi/tuần khi trước đó chưa tập. Đau và kiệt sức là con đường nhanh nhất dẫn đến bỏ cuộc.
:::` },

{ id:"tl-dong-luc", cat:"tam-ly", audience:"ca-hai", updated:U,
  title:"Động lực: từ \"phải tập\" đến \"muốn tập\"",
  summary:"Thuyết Tự quyết giải thích vì sao động lực nội tại giúp tập lâu dài. Ba nhu cầu tâm lý và cách đặt mục tiêu quá trình.",
  tags:["động lực","tự quyết","mục tiêu","tâm lý"],
  ex:["walking"],
  tpl:["tpl-u-home"],
  sources:[TEIX, "Ryan RM, Deci EL. Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. Am Psychol 2000;55(1):68–78."],
  body:`Thuyết **Tự quyết** (Self-Determination Theory) của Deci và Ryan phân biệt động lực **bên ngoài** (vì người khác, vì được khen, vì cảm giác tội lỗi) với động lực **tự chủ, nội tại** (vì thích, vì thấy có giá trị với bản thân). Tổng quan của Teixeira (2012) cho thấy động lực tự chủ, nhất là động lực nội tại, gắn với việc **duy trì tập luyện lâu dài** tốt hơn.

## 3 nhu cầu tâm lý cần được đáp ứng

| Nhu cầu | Trong tập luyện | Cách nuôi dưỡng |
|---|---|---|
| **Tự chủ** | Được lựa chọn | Tự chọn bài, giờ tập, môn mình thích |
| **Năng lực** | Thấy mình tiến bộ | Ghi kg × lần, đạt được những mục tiêu nhỏ |
| **Kết nối** | Có người đồng hành | Bạn tập, PT, cộng đồng |

## Mục tiêu "quá trình" song song với "kết quả"

- Kết quả: "Giảm 5 kg." Một phần nằm ngoài kiểm soát của bạn.
- Quá trình: "Tập 3 buổi/tuần, ăn đủ đạm 5/7 ngày." Hoàn toàn nằm trong tay bạn.

Hãy đặt 1 mục tiêu kết quả kèm 2–3 mục tiêu quá trình.

## Khi mất hứng

- Đổi một điều nhỏ: bài mới, danh sách nhạc mới, giờ tập mới.
- Hẹn tập cùng bạn bè.
- Nhớ lại **lý do sâu xa** khiến bạn bắt đầu: khoẻ để chơi với con, bớt đau lưng, tự tin hơn.

:::ap-dung
Viết một câu "Tôi tập vì…" không liên quan đến ngoại hình, rồi ghim vào phần ghi chú của giáo án.
:::

:::an-toan
Mất hứng thú với mọi việc chứ không riêng tập luyện, kéo dài hơn 2 tuần, kèm buồn bã, mất ngủ có thể là dấu hiệu trầm cảm. Hãy tìm hỗ trợ từ chuyên gia sức khoẻ tâm thần.
:::` },

{ id:"tl-lo-buoi-tap", cat:"tam-ly", audience:"nguoi-tap", updated:U,
  title:"Lỡ buổi tập, phá kế hoạch ăn: thoát bẫy \"được ăn cả, ngã về không\"",
  summary:"Một lần lỡ không làm hỏng thói quen. Quy tắc \"không lỡ hai lần\" và phiên bản tối thiểu cho ngày bận.",
  tags:["lỡ buổi","tâm lý","thói quen","tự trắc ẩn"],
  ex:["bwsquat","pushup"],
  tpl:["tpl-u-home"],
  sources:[LALLY, "Sirois FM, Kitner R, Hirsch JK. Self-compassion, affect, and health-promoting behaviors. Health Psychol 2015;34(6):661–669."],
  body:`"Hôm nay ăn quá rồi, thôi mai tính." "Lỡ tuần này rồi, đầu tháng sau bắt đầu lại." Đây là **tư duy tất cả hoặc không gì cả**, lý do phổ biến khiến nhiều người bỏ cuộc.

## Sự thật nhỏ mà quan trọng

- Lally (2010): **lỡ một lần không ảnh hưởng đáng kể** đến quá trình hình thành thói quen.
- Sirois (2015): người có **lòng tự trắc ẩn** (self-compassion) cao hơn thực hiện các hành vi tốt cho sức khoẻ đều đặn hơn. Đối xử tử tế với bản thân không làm bạn "lười" mà giúp bạn **quay lại nhanh hơn**.

## Quy tắc "không lỡ hai lần"

Lỡ một buổi là chuyện bình thường của cuộc sống. Chỉ cần đảm bảo **buổi kế tiếp** vẫn diễn ra, dù chỉ 15–20 phút.

## Phiên bản "tối thiểu" cho ngày bận

| Kế hoạch đầy đủ | Phiên bản tối thiểu |
|---|---|
| 60 phút tạ | 20 phút: 3 bài chính × 2 hiệp |
| 45 phút cardio | 15 phút đi bộ nhanh |
| Ăn đúng thực đơn | Bữa tiếp theo có đạm và rau |

## Sau một bữa "quá đà"

Không cần nhịn bữa sau, cũng không cần "đốt bù" bằng 2 giờ cardio. Chỉ cần **quay lại bữa ăn bình thường tiếp theo**. Một bữa ăn không quyết định kết quả, cả chuỗi nhiều tuần mới quyết định.

:::ap-dung
Soạn sẵn "buổi tập 20 phút" của riêng bạn (3 bài và số hiệp) và lưu thành một ngày trong giáo án. Ngày bận, chỉ cần mở ra và tập.
:::

:::an-toan
Nếu bạn thường xuyên ăn mất kiểm soát rồi tự trừng phạt bản thân (nhịn đói, nôn, tập đến kiệt sức), hãy tìm sự hỗ trợ của chuyên gia. Đó có thể là dấu hiệu của rối loạn ăn uống và có thể điều trị được.
:::` },

{ id:"tl-hinh-anh-co-the", cat:"tam-ly", audience:"ca-hai", updated:U,
  title:"Hình ảnh cơ thể và mạng xã hội: tập vì sức khoẻ, không vì so sánh",
  summary:"Ảnh \"body chuẩn\" thường đã qua chọn lọc, chỉnh sửa. Cách bảo vệ hình ảnh bản thân và nhận biết ám ảnh cơ bắp.",
  tags:["hình ảnh cơ thể","mạng xã hội","tâm lý","so sánh"],
  ex:["pushup","walking"],
  sources:["Fardouly J, Vartanian LR. Social media and body image concerns: current research and future directions. Curr Opin Psychol 2016;9:1–5.",
    "Tiggemann M, Zaccardo M. \"Exercise to be fit, not skinny\": the effect of fitspiration imagery on women's body image. Body Image 2015;15:61–67."],
  body:`Ảnh "body chuẩn" trên mạng xã hội thường đã qua chọn góc, chỉnh ánh sáng, "bơm" cơ trước khi chụp, chỉnh sửa, đôi khi có cả dùng chất cấm. So sánh mình với những hình ảnh đó rất dễ khiến bạn thấy mình không đủ tốt.

## Nghiên cứu nói gì

- Tổng quan của Fardouly & Vartanian (2016): dùng mạng xã hội, đặc biệt là xem ảnh về ngoại hình, có liên quan đến **lo lắng về hình ảnh cơ thể**.
- Tiggemann & Zaccardo (2015): xem ảnh "fitspiration" (ảnh truyền cảm hứng tập luyện) làm phụ nữ **kém hài lòng với cơ thể hơn**.

## Cách bảo vệ bản thân

1. **Dọn bảng tin:** bỏ theo dõi những tài khoản khiến bạn thấy tệ, theo dõi tài khoản chia sẻ kiến thức và hành trình thật.
2. **So với chính mình** của 3 tháng trước, không so với người khác.
3. **Tập trung vào chức năng:** nâng được bao nhiêu, đi được bao xa, ngủ thế nào, năng lượng ra sao.
4. **Nói về cơ thể bằng ngôn ngữ tử tế:** cơ thể bạn không phải một "dự án sửa lỗi".

## Với nam giới

Áp lực "phải to, phải nét" có thể dẫn đến **ám ảnh cơ bắp** (muscle dysmorphia): luôn thấy mình nhỏ bé, tập bất chấp chấn thương, tìm đến steroid. Đây là vấn đề sức khoẻ tâm thần cần được hỗ trợ.

:::ap-dung
Thay hình ảnh "mục tiêu" trong đầu bằng 3 mục tiêu chức năng, ví dụ: [[ex:pushup]] 15 lần liên tục, [[ex:walking]] 10.000 bước một ngày, ngủ đủ 7 giờ.
:::

:::an-toan
Nếu suy nghĩ về ngoại hình chiếm nhiều giờ mỗi ngày và ảnh hưởng đến công việc, ăn uống, các mối quan hệ, hãy nói chuyện với chuyên gia tâm lý hoặc bác sĩ tâm thần.
:::` }
);
})();

/* =========================================================================
   TapEasy — Kho kiến thức · DỮ LIỆU 2/6
   Chuyên mục: Tăng cơ & sức mạnh (8) · Giảm mỡ (8)
   Định dạng: xem đầu kb-data-1.js
   ========================================================================= */
(function(){
var A = (window.KB_ARTICLES = window.KB_ARTICLES || []);
var U = "2026-11-10";
var ACSM2009 = "American College of Sports Medicine. Position stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009;41(3):687–708.";
var SCH2017V = "Schoenfeld BJ, Ogborn D, Krieger JW. Dose-response relationship between weekly resistance training volume and increases in muscle mass: a systematic review and meta-analysis. J Sports Sci 2017;35(11):1073–1082.";
var MORTON = "Morton RW, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med 2018;52(6):376–384.";
var ISSNPRO = "Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise. J Int Soc Sports Nutr 2017;14:20.";
var HELMS14 = "Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr 2014;11:20.";
var HALL = "Hall KD, et al. Quantification of the effect of energy imbalance on bodyweight. Lancet 2011;378(9793):826–837.";

A.push(
/* ======================= TĂNG CƠ & SỨC MẠNH ======================= */
{ id:"tc-co-che-tang-co", cat:"tang-co", audience:"ca-hai", updated:U,
  title:"Cơ tăng như thế nào? 4 yếu tố bạn kiểm soát được",
  summary:"Sức căng cơ học, khối lượng, tăng tiến và phục hồi: hiểu đúng để không tập \"cho mệt\" mà tập cho hiệu quả.",
  tags:["tăng cơ","phì đại cơ","hypertrophy","nguyên lý"],
  ex:["squat","rdl","benchpress","pullup"],
  sources:["Schoenfeld BJ. The mechanisms of muscle hypertrophy and their application to resistance training. J Strength Cond Res 2010;24(10):2857–2872.", SCH2017V, MORTON,
    "Lamon S, et al. The effect of acute sleep deprivation on skeletal muscle protein synthesis and the hormonal environment. Physiol Rep 2021;9(1):e14660."],
  body:`Tăng cơ (phì đại cơ) xảy ra khi tốc độ tổng hợp protein cơ cao hơn tốc độ phân giải trong nhiều tuần liên tục. Có 4 yếu tố bạn kiểm soát được:

| Yếu tố | Mức tham khảo | Đọc thêm |
|---|---|---|
| **Kích thích cơ học**: hiệp đủ gần giới hạn | RIR 0–3 | [[kb:tc-rir-gan-guc]] |
| **Khối lượng**: số hiệp cho mỗi nhóm cơ mỗi tuần | khoảng 10–20 hiệp | [[kb:tc-khoi-luong]] |
| **Tăng tiến**: khó hơn dần theo thời gian | thêm lần hoặc thêm tạ | [[kb:bd-tang-tien]] |
| **Phục hồi**: đạm, năng lượng, giấc ngủ | khoảng 1,6 g đạm/kg; ngủ ≥ 7 giờ | [[kb:dd-protein]] |

## Sức căng cơ học là chìa khoá

Cơ phát triển chủ yếu nhờ **sức căng** khi sợi cơ phải co mạnh để thắng lực cản. Những lần cuối của một hiệp, khi tốc độ chậm lại vì mệt, là lúc các sợi cơ lớn chịu sức căng nhiều nhất. Vì vậy cảm giác "căng phồng" hay đau nhức hôm sau **không phải** thước đo chính xác của hiệu quả.

## Tốc độ tăng cơ thực tế

Người mới tập đúng cách thường tăng cơ nhanh nhất trong năm đầu, sau đó chậm dần. Đây là quy luật bình thường, không phải bạn tập sai. Hãy dè chừng các lời hứa "tăng X kg cơ mỗi tháng" trên mạng: con số đó thường gộp cả nước, glycogen và mỡ.

## Đừng quên giấc ngủ

Một nghiên cứu (Lamon, 2021) cho thấy chỉ một đêm thức trắng đã làm tổng hợp protein cơ giảm khoảng 18 %.

:::ap-dung
Chọn 1 bài chính cho mỗi nhóm cơ lớn, ví dụ [[ex:squat]], [[ex:rdl]], [[ex:benchpress]], [[ex:pullup]]. Theo dõi kg × lần hằng tuần. Sau 3–4 tuần mà không tăng, hãy xem lại khối lượng tập, giấc ngủ và lượng ăn.
:::

:::an-toan
Không dùng steroid hay hormone tăng trưởng. Chúng gây nguy cơ nghiêm trọng cho tim, gan, nội tiết, và nhiều sản phẩm trôi nổi còn bị pha trộn chất cấm.
:::` },

{ id:"tc-khoi-luong", cat:"tang-co", audience:"ca-hai", updated:U,
  title:"Bao nhiêu hiệp mỗi tuần là đủ để tăng cơ?",
  summary:"Quan hệ liều – đáp ứng giữa số hiệp và mức tăng cơ, bảng gợi ý theo trình độ và cách đếm hiệp cho đúng.",
  tags:["khối lượng","volume","số hiệp","tăng cơ"],
  ex:["benchpress","pullup","lateralraise","squat"],
  sources:[SCH2017V, ACSM2009,
    "Baz-Valle E, et al. A systematic review of the effects of different resistance training volumes on muscle hypertrophy. J Hum Kinet 2022;81:199–210."],
  body:`Phân tích gộp của Schoenfeld (2017) cho thấy quan hệ **liều – đáp ứng**: càng nhiều hiệp mỗi tuần thì cơ càng tăng nhiều hơn, trong một giới hạn nhất định. Nhóm tập **từ 10 hiệp/nhóm cơ/tuần** tăng cơ rõ rệt hơn nhóm dưới 5 hiệp.

## Bảng gợi ý

| Kinh nghiệm | Hiệp khó/nhóm cơ/tuần | Ghi chú |
|---|---|---|
| Mới tập (dưới 6 tháng) | 6–10 | Đủ để tăng nhanh, dễ hồi phục |
| Trung bình (6 tháng – 2 năm) | 10–16 | Chia ra ít nhất 2 buổi/tuần |
| Tập lâu năm | 12–20 trở lên | Tăng dần, theo dõi khả năng hồi phục |

"Hiệp khó" là hiệp kết thúc ở **RIR 0–3**. Hiệp khởi động không tính.

## Cách đếm

- Bài nhiều khớp được tính cho các cơ chính tham gia. Ví dụ [[ex:benchpress]] tính 1 hiệp cho ngực, còn vai trước và tay sau tính khoảng nửa hiệp.
- [[ex:pullup]] tính cho xô và lưng giữa; tay trước tính khoảng nửa hiệp.

## Có phải càng nhiều càng tốt?

Không hẳn. Khi khối lượng vượt khả năng phục hồi, chất lượng từng hiệp giảm, khớp đau và sức mạnh đi xuống. Cách an toàn là **thêm 2–4 hiệp cho nhóm cơ ưu tiên** trong mỗi chu kỳ 4–6 tuần, còn các nhóm khác giữ ở mức duy trì.

:::ap-dung
Đếm số hiệp tuần này của nhóm cơ bạn muốn phát triển, ví dụ vai giữa với [[ex:lateralraise]]. Nếu dưới 10 hiệp, thêm 2 hiệp vào mỗi buổi tập phần thân trên trong 4 tuần tới.
:::

:::an-toan
Đau khớp kéo dài, ngủ kém, sức mạnh giảm 2 tuần liền là dấu hiệu khối lượng đã vượt khả năng phục hồi. Hãy giảm 30–50 % số hiệp trong một tuần. Đọc [[kb:ph-qua-tai-deload|quá tải và tuần giảm tải]].
:::` },

{ id:"tc-rir-gan-guc", cat:"tang-co", audience:"ca-hai", updated:U,
  title:"Tập gần giới hạn hay tập đến kiệt sức? Hiểu đúng về RIR",
  summary:"Bằng chứng mới nói gì về tập đến failure, bài nào nên dừng sớm và cách tập đoán RIR cho chuẩn.",
  tags:["RIR","failure","kiệt sức","cường độ","RPE"],
  ex:["squat","deadlift","machinepress","legext","bicepcurl","lateralraise"],
  sources:["Grgic J, et al. Effects of resistance training performed to repetition failure or non-failure on muscular strength and hypertrophy: a systematic review and meta-analysis. J Sport Health Sci 2022;11(2):202–211.",
    "Refalo MC, et al. Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy: a systematic review with meta-analysis. Sports Med 2023;53(3):649–665.",
    "Zourdos MC, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res 2016;30(1):267–275."],
  body:`**Tập đến kiệt sức** (failure) là làm đến khi không thể hoàn thành thêm một lần nào đúng kỹ thuật. Có cần làm vậy ở mọi hiệp không?

## Bằng chứng nói gì

- Phân tích gộp của Grgic (2022): tập đến kiệt sức **không giúp tăng sức mạnh hơn** so với dừng trước giới hạn. Về tăng cơ, hai cách gần như tương đương.
- Phân tích gộp của Refalo (2023): hiệp càng gần giới hạn thì tăng cơ càng nhiều, nhưng lợi ích **giảm dần** khi đã ở rất sát giới hạn.

Kết luận thực tế: phần lớn các hiệp nên dừng ở **RIR 1–3**, còn tập đến kiệt sức thì chỉ dùng có chọn lọc.

## Bài nào có thể tập đến giới hạn?

| Có thể tới giới hạn | Nên dừng ở RIR 2–3 |
|---|---|
| Bài máy, cáp: [[ex:machinepress]], [[ex:legext]] | [[ex:squat]], [[ex:deadlift]] thanh đòn |
| Bài cô lập nhẹ: [[ex:bicepcurl]], [[ex:lateralraise]] | Bench khi không có người hỗ trợ |
| Hiệp cuối cùng của bài | Bài kỹ thuật cao: clean, snatch |

## Tập đoán RIR cho chuẩn

Thỉnh thoảng làm 1 hiệp AMRAP với một bài máy an toàn. Trước hiệp, đoán xem "ở lần thứ 10 mình còn dư mấy lần". Sau hiệp, so với thực tế. Vài tuần sau, bạn sẽ đoán sát hơn hẳn. Nghiên cứu của Zourdos (2016) cũng ghi nhận người có kinh nghiệm đoán RIR chính xác hơn người mới.

:::ap-dung
Ghi **RPE** cho hiệp cuối mỗi bài trong app (RPE 8 tương đương RIR 2). Nếu RPE thường xuyên dưới 7, hãy tăng tạ.
:::

:::an-toan
Người mới tập, người có bệnh tim mạch hoặc tăng huyết áp không nên tập đến kiệt sức. Lúc đó người tập thường nín thở và gồng mạnh, làm huyết áp tăng vọt.
:::` },

{ id:"tc-khoang-lap", cat:"tang-co", audience:"ca-hai", updated:U,
  title:"Nặng ít lần hay nhẹ nhiều lần? Khoảng lặp cho tăng cơ và sức mạnh",
  summary:"Khung \"liên tục khoảng lặp\" mới nhất: cơ tăng trong khoảng rất rộng, còn sức mạnh cần có lúc tập nặng.",
  tags:["số lần","rep range","sức mạnh","tăng cơ","1RM"],
  ex:["squat","benchpress","legpress","cablelateral","bicepcurl"],
  tpl:["tpl-m-pb","tpl-f-pb"],
  sources:["Schoenfeld BJ, Grgic J, Van Every DW, Plotkin DL. Loading recommendations for muscle strength, hypertrophy, and local endurance: a re-examination of the repetition continuum. Sports (Basel) 2021;9(2):32.",
    "Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis. J Strength Cond Res 2017;31(12):3508–3523."],
  body:`Tổng quan "liên tục khoảng lặp" của Schoenfeld (2021) đưa ra khung tham khảo:

| Mục tiêu | Khoảng lặp | Mức tạ |
|---|---|---|
| **Sức mạnh tối đa** | 1–5 lần | ≥ 80–85 % 1RM |
| **Tăng cơ** | Rộng, khoảng 6–30 lần, miễn là hiệp gần giới hạn | 30–85 % 1RM |
| **Sức bền cơ** | Trên 15–20 lần | dưới 60 % 1RM |

## Điều quan trọng

- **Cơ tăng tương đương** trong một khoảng rất rộng: nhẹ nhiều lần hay nặng ít lần đều được, miễn là hiệp đủ khó (Schoenfeld, 2017).
- **Sức mạnh** tăng nhiều nhất khi tập nặng. Muốn 1RM [[ex:squat]] tăng thì phải có lúc tập nặng.
- Hiệp 25–30 lần rất mệt và khó chịu, nên **6–15 lần** là vùng tiện lợi nhất với đa số bài.

## Kết hợp theo từng bài

- Bài nhiều khớp như [[ex:squat]], [[ex:benchpress]]: 4–8 lần.
- Bài máy như [[ex:legpress]]: 8–15 lần.
- Bài cô lập như [[ex:cablelateral]], [[ex:bicepcurl]]: 10–20 lần.

:::ap-dung
Trong một buổi, bắt đầu bằng bài nặng ít lần khi còn sung sức, rồi chuyển dần sang bài nhẹ nhiều lần. Đây chính là cấu trúc của giáo án [[tpl:tpl-m-pb|Powerbuilding]] và [[tpl:tpl-f-pb|Powerbuilding cho nữ]].
:::

:::an-toan
Tập 1–3 lần với mức tạ gần tối đa đòi hỏi kỹ thuật vững, khung có chốt an toàn hoặc người hỗ trợ. Người mới chưa cần thử 1RM thật, có thể ước lượng từ một hiệp 5–8 lần.
:::` },

{ id:"tc-nghi-giua-hiep", cat:"tang-co", audience:"ca-hai", updated:U,
  title:"Nghỉ giữa hiệp bao lâu? 60 giây hay 3 phút",
  summary:"Nghỉ ngắn làm buổi tập mệt hơn nhưng chưa chắc hiệu quả hơn. Gợi ý thời gian nghỉ theo từng loại bài.",
  tags:["nghỉ giữa hiệp","thời gian nghỉ","superset"],
  ex:["squat","deadlift","benchpress","bicepcurl","lateralraise"],
  sources:["Schoenfeld BJ, et al. Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. J Strength Cond Res 2016;30(7):1805–1812.",
    "Grgic J, et al. The effects of short versus long inter-set rest intervals in resistance training on measures of muscle hypertrophy: a systematic review. Eur J Sport Sci 2017;17(8):983–993."],
  body:`Nghỉ ngắn giúp buổi tập nhanh hơn và mệt hơn. Nhưng mệt hơn không có nghĩa là hiệu quả hơn.

## Nghiên cứu nói gì

- Schoenfeld (2016): ở người đã tập lâu, nghỉ **3 phút** tăng sức mạnh và cơ đùi nhiều hơn nghỉ 1 phút khi cùng số hiệp.
- Tổng quan của Grgic (2017): nghỉ ngắn vẫn tăng cơ được ở người mới, nhưng với người đã tập lâu, **nghỉ từ 2 phút trở lên** có lợi hơn ở các bài nhiều khớp.

Lý do: nghỉ quá ngắn khiến bạn làm được ít lần hơn ở những hiệp sau, nên tổng khối lượng có ích bị giảm.

## Gợi ý thực hành

| Loại bài | Thời gian nghỉ |
|---|---|
| Bài nặng nhiều khớp: [[ex:squat]], [[ex:deadlift]], [[ex:benchpress]] | 2–3 phút (tập sức mạnh: 3–5 phút) |
| Bài máy, tạ đơn nhiều khớp | 90–120 giây |
| Bài cô lập: [[ex:bicepcurl]], [[ex:lateralraise]] | 60–90 giây |

## Tiết kiệm thời gian mà không mất hiệu quả

Ghép **superset hai bài không tranh cơ** với nhau, ví dụ ngực với lưng, tay trước với bắp chân. Nhóm cơ này làm việc thì nhóm kia được nghỉ.

:::ap-dung
Đồng hồ nghỉ trong app tự đếm theo giáo án. Nếu hiệp sau thường hụt hơn 2 lần so với hiệp trước, hãy nghỉ thêm 30–60 giây.
:::

:::an-toan
Khi nhịp thở chưa ổn định, tim còn đập mạnh, đừng bắt đầu hiệp nặng tiếp theo, nhất là trong phòng nóng.
:::` },

{ id:"tc-tan-suat", cat:"tang-co", audience:"ca-hai", updated:U,
  title:"Mỗi nhóm cơ nên tập mấy lần một tuần?",
  summary:"Tần suất là công cụ để chia khối lượng. Quy tắc đơn giản để chọn 2 hay 3 buổi cho mỗi nhóm cơ.",
  tags:["tần suất","lịch tập","tăng cơ"],
  ex:["squat","benchpress","pullup","hipthrust"],
  tpl:["tpl-m-fb","tpl-m-ul","tpl-f-lower3"],
  sources:["Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med 2016;46(11):1689–1697.",
    "Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis. J Sports Sci 2019;37(11):1286–1295."],
  body:`Hai phân tích gộp của Schoenfeld cho thấy:

1. **Năm 2016:** tập mỗi nhóm cơ **2 lần/tuần** tăng cơ nhiều hơn 1 lần/tuần.
2. **Năm 2019:** khi **tổng số hiệp mỗi tuần bằng nhau**, tập thường xuyên hơn không tạo khác biệt rõ.

Như vậy, tần suất chủ yếu là **công cụ để chia khối lượng**. Dồn 16 hiệp ngực vào 1 buổi thì nhiều hiệp cuối sẽ kém chất lượng. Chia ra 2–3 buổi thì hiệp nào cũng làm tốt.

## Quy tắc tiện dụng

- Dưới khoảng 10 hiệp/tuần cho một nhóm cơ: 2 buổi là đủ.
- 12–20 hiệp/tuần: chia 2–3 buổi.
- Mỗi buổi khoảng **6–8 hiệp khó** cho một nhóm cơ là mức đa số người giữ được chất lượng.

## Ví dụ

| Lịch | Mỗi nhóm cơ | Giáo án mẫu |
|---|---|---|
| Full body 3 buổi | 3 lần/tuần | [[tpl:tpl-m-fb]] |
| Upper/Lower 4 buổi | 2 lần/tuần | [[tpl:tpl-m-ul]] |
| Lower ×3 / Upper ×2 | Mông, chân 3 lần/tuần | [[tpl:tpl-f-lower3]] |

:::ap-dung
Muốn ưu tiên nhóm cơ nào thì cho nó tập **đầu buổi** và **thêm 1 buổi/tuần**, ví dụ thêm [[ex:hipthrust]] cho mông. Giữ các nhóm cơ khác ở mức duy trì.
:::

:::an-toan
Tần suất quá dày cho cùng một khớp (ví dụ bench 4 lần/tuần) dễ gây quá tải gân. Hãy xen kẽ biến thể và mức nặng nhẹ giữa các buổi.
:::` },

{ id:"tc-tang-can-nguoi-gay", cat:"tang-co", audience:"nguoi-tap", updated:U,
  title:"Người gầy khó tăng cân: ăn dư bao nhiêu là vừa?",
  summary:"Dư năng lượng vừa phải giúp tăng cơ mà không tích quá nhiều mỡ. 6 mẹo cho người \"ăn mãi không mập\".",
  tags:["tăng cân","người gầy","bulking","dư năng lượng"],
  ex:["squat","benchpress","rdl","bentoverrow"],
  tpl:["tpl-m-fb","tpl-m-ul"],
  sources:["Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports (Basel) 2019;7(7):154.", ISSNPRO,
    "Aragon AA, et al. International Society of Sports Nutrition position stand: diets and body composition. J Int Soc Sports Nutr 2017;14:16."],
  body:`Muốn tăng cơ nhanh nhất, bạn cần **dư năng lượng ở mức vừa phải**, không phải "càng ăn nhiều càng tốt". Dư quá nhiều thì phần cân tăng thêm chủ yếu là mỡ.

## Mức tăng cân gợi ý

Tổng quan của Iraki (2019) dành cho người tập thể hình gợi ý:

| Đối tượng | Tốc độ tăng cân |
|---|---|
| Người mới, gầy | Khoảng 0,25–0,5 % cân nặng/tuần (người 60 kg: khoảng 0,15–0,3 kg/tuần) |
| Người đã tập lâu | Chậm hơn, khoảng 0,25 %/tuần |

Mức này thường tương đương **dư khoảng 10–20 % TDEE**. Khi bạn chọn mục tiêu "Tăng cơ", app đặt sẵn mức dư khoảng 12 %.

## 6 mẹo cho người "ăn mãi không mập"

1. Ăn **4–5 bữa/ngày**, thêm bữa phụ như sữa, sữa chua, chuối, bánh mì trứng.
2. Thêm món **giàu năng lượng mà không quá no**: thêm nửa chén cơm, dầu ô liu, các loại hạt, bơ đậu phộng.
3. **Uống bớt calo**: sinh tố chuối + sữa + yến mạch + bơ đậu phộng.
4. Ăn đạm 1,6–2,2 g/kg, chia đều các bữa.
5. Cân 3–4 buổi sáng mỗi tuần. Nếu trung bình tuần không tăng, ăn thêm khoảng 200 kcal/ngày.
6. Ngủ đủ, tập đều 3–4 buổi/tuần với các bài lớn như [[ex:squat]], [[ex:benchpress]], [[ex:rdl]], [[ex:bentoverrow]].

:::ap-dung
Mở tab **Dinh dưỡng** và đặt mục tiêu "Tăng cơ", thực đơn sẽ tự cộng thêm năng lượng. Cứ 2 tuần, xem cân nặng trung bình và vòng eo. Nếu vòng eo tăng nhanh mà sức mạnh không tăng, hãy giảm bớt mức dư.
:::

:::an-toan
Gầy kèm sụt cân không rõ lý do, ăn nhiều mà vẫn sụt, hồi hộp, run tay, khát nhiều, tiểu nhiều là những dấu hiệu cần đi khám (ví dụ cường giáp, tiểu đường). Đừng chỉ tăng lượng ăn.
:::` },

{ id:"tc-recomposition", cat:"tang-co", audience:"ca-hai", updated:U,
  title:"Vừa giảm mỡ vừa tăng cơ (recomposition): ai làm được?",
  summary:"Recomp xảy ra được, kể cả ở người đã tập. Công thức ăn – tập – ngủ và cách đo khi cân nặng gần như không đổi.",
  tags:["recomposition","giảm mỡ","tăng cơ","đạm cao"],
  ex:["squat","pushup","pullup"],
  sources:["Barakat C, et al. Body recomposition: can trained individuals build muscle and lose fat at the same time? Strength Cond J 2020;42(5):7–21.",
    "Longland TM, et al. Higher compared with lower dietary protein during an energy deficit combined with intense exercise promotes greater lean mass gain and fat mass loss: a randomized trial. Am J Clin Nutr 2016;103(3):738–746."],
  body:`"Recomp" là giảm mỡ và tăng cơ cùng lúc, nên cân nặng có thể gần như không đổi. Tổng quan của Barakat (2020) cho thấy điều này **hoàn toàn xảy ra được**, kể cả ở người đã tập.

## Ai dễ recomp nhất

- Người **mới tập** hoặc quay lại sau thời gian nghỉ.
- Người có **tỉ lệ mỡ cao hơn**.
- Người trước đây ăn ít đạm, nay ăn đủ đạm.
- Người trước đây ngủ kém, nay ngủ đủ.

## Công thức

| Thành phần | Mức |
|---|---|
| Năng lượng | Khoảng mức duy trì hoặc thâm hụt nhẹ (khoảng 10 % TDEE) |
| Đạm | Cao: **1,6–2,4 g/kg/ngày** |
| Tập tạ | 3–4 buổi/tuần, tăng tiến đều |
| Ngủ | ≥ 7 giờ |

Thử nghiệm của Longland (2016): nam thanh niên ăn thiếu khoảng 40 % năng lượng kèm tập cường độ cao trong 4 tuần. Nhóm ăn **2,4 g đạm/kg** tăng khoảng 1,2 kg khối nạc, còn nhóm 1,2 g/kg gần như không tăng. Đây là nghiên cứu ngắn hạn, có giám sát chặt, không phải cách làm cho tất cả mọi người.

## Đo thế nào khi cân không đổi?

Theo dõi **vòng eo giảm** và **sức mạnh tăng**. Hai chỉ số này cùng tiến triển là dấu hiệu recomp đang diễn ra. Xem [[kb:bd-do-tien-bo|đo tiến bộ đúng cách]].

:::ap-dung
Ăn ở mức calo duy trì app đã tính, đạt đủ đạm mỗi ngày, tập theo giáo án và ghi kg × lần. Sau 8 tuần, so ảnh và số đo với lúc bắt đầu.
:::

:::an-toan
Đừng cắt giảm năng lượng quá sâu (trên 25–30 % TDEE) trong thời gian dài để "ép" recomp. Cách này dễ gây mệt mỏi, mất cơ và rối loạn kinh nguyệt ở nữ.
:::` },

/* ======================= GIẢM MỠ ======================= */
{ id:"gm-can-bang-nang-luong", cat:"giam-mo", audience:"ca-hai", updated:U,
  title:"Cân bằng năng lượng: vì sao \"7.700 kcal = 1 kg mỡ\" không đúng mãi",
  summary:"TDEE gồm những gì, vì sao giảm cân chậm dần theo thời gian và cách dùng con số app tính như một điểm xuất phát.",
  tags:["calo","TDEE","BMR","cân bằng năng lượng","giảm cân"],
  ex:["walking","inclinewalk"],
  tpl:["tpl-u-cardio"],
  sources:[HALL, "Mifflin MD, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 1990;51(2):241–247."],
  body:`Cơ thể tuân theo định luật bảo toàn năng lượng: ăn ít hơn mức tiêu hao thì phải dùng đến năng lượng dự trữ. Nhưng quy tắc "7.700 kcal = 1 kg mỡ" chỉ đúng một phần.

## Vì sao giảm cân chậm dần

Mô hình của Kevin Hall (2011) cho thấy khi bạn giảm cân:

- Cơ thể nhỏ đi nên **tiêu hao ít hơn**.
- Vận động không chủ ý (NEAT) có xu hướng giảm.
- Những tuần đầu giảm nhanh chủ yếu do mất **nước và glycogen**.

Theo mô hình này, khi cắt giảm một lượng calo cố định, bạn đạt khoảng **một nửa** tổng mức giảm sau khoảng 1 năm và gần hết sau khoảng 3 năm. Quy tắc 7.700 kcal vì vậy ước tính quá cao mức giảm dài hạn.

## TDEE gồm những gì

| Thành phần | Ghi chú |
|---|---|
| Chuyển hoá cơ bản (BMR) | Phần lớn nhất, khoảng 60–70 % ở người ít vận động |
| Tiêu hoá thức ăn (TEF) | Khoảng 10 % |
| Tập luyện | Thay đổi nhiều theo lịch tập |
| Vận động không chủ ý (NEAT) | Chênh lệch nhiều nhất giữa người này với người khác |

App ước tính BMR bằng **công thức Mifflin-St Jeor**, rồi nhân với hệ số hoạt động để ra TDEE. Con số này chỉ là điểm xuất phát. Mức thật của bạn sẽ lộ rõ sau 2–3 tuần theo dõi cân nặng trung bình.

:::ap-dung
Ăn theo mục tiêu calo của app trong 2 tuần, cân 4–7 buổi sáng mỗi tuần. Nếu trung bình tuần giảm ít hơn 0,25 % cân nặng, bớt 100–200 kcal/ngày hoặc thêm khoảng 2.000 bước/ngày.
:::

:::an-toan
Không ăn dưới mức BMR trong thời gian dài nếu không có chuyên gia theo dõi. Nhiều hướng dẫn coi khoảng 1.200 kcal/ngày với nữ và 1.500 kcal/ngày với nam là mức tối thiểu khi tự ăn kiêng.
:::` },

{ id:"gm-toc-do-giam", cat:"giam-mo", audience:"ca-hai", updated:U,
  title:"Giảm bao nhiêu mỗi tuần là an toàn và vẫn giữ được cơ?",
  summary:"Đặt mục tiêu theo % cân nặng mỗi tuần, không theo \"kg/tháng\". Bảng quy đổi nhanh theo cân nặng.",
  tags:["tốc độ giảm cân","giữ cơ","thâm hụt calo"],
  ex:["squat","walking"],
  tpl:["tpl-u-cardio"],
  sources:[HELMS14, "Garthe I, et al. Effect of two different weight-loss rates on body composition and strength and power-related performance in elite athletes. Int J Sport Nutr Exerc Metab 2011;21(2):97–104."],
  body:`Giảm cân càng nhanh thì càng dễ mất cơ, mệt mỏi và ăn bù.

## Bằng chứng

- **Garthe (2011):** vận động viên giảm **0,7 % cân nặng/tuần** giữ được khối nạc và tăng sức mạnh tốt hơn nhóm giảm **1,4 %/tuần**.
- **Helms (2014)** khuyến nghị người tập tạ giảm **0,5–1 % cân nặng mỗi tuần**.

| Cân nặng | 0,5 %/tuần | 1 %/tuần |
|---|---|---|
| 55 kg | 0,28 kg | 0,55 kg |
| 70 kg | 0,35 kg | 0,7 kg |
| 90 kg | 0,45 kg | 0,9 kg |

Người có nhiều mỡ có thể giảm nhanh hơn ở giai đoạn đầu. Người đã khá gọn nên giảm chậm (không quá 0,5 %/tuần) để giữ cơ.

## Mức thâm hụt trong app

Mục tiêu "Giảm mỡ" trong app đặt mức thâm hụt khoảng **18 % TDEE**, thường cho tốc độ giảm quanh 0,5 kg/tuần ở người trưởng thành. Sau 3–4 tuần, hãy điều chỉnh theo kết quả thực tế.

:::ap-dung
Đặt mục tiêu theo **% mỗi tuần**. Mỗi tuần, so trung bình 7 ngày với tuần trước. Hai tuần liền không đổi thì bớt thêm 100–200 kcal/ngày hoặc tăng vận động.
:::

:::an-toan
Không dùng thuốc giảm cân trôi nổi, trà "detox" hay thuốc lợi tiểu. Phụ nữ mang thai, đang cho con bú, người dưới 18 tuổi hoặc có tiền sử rối loạn ăn uống chỉ giảm cân khi có bác sĩ hướng dẫn.
:::` },

{ id:"gm-giu-co", cat:"giam-mo", audience:"ca-hai", updated:U,
  title:"Giữ cơ khi giảm mỡ: tạ, đạm và giấc ngủ",
  summary:"Ba việc giúp phần lớn số cân giảm đi là mỡ chứ không phải cơ, kèm bằng chứng cụ thể cho từng việc.",
  tags:["giữ cơ","đạm","giảm mỡ","giấc ngủ","tập tạ"],
  ex:["squat","benchpress","rdl","pullup","dbrow"],
  sources:["Cava E, Yeat NC, Mittendorfer B. Preserving healthy muscle during weight loss. Adv Nutr 2017;8(3):511–519.",
    "Helms ER, et al. A systematic review of dietary protein during caloric restriction in resistance trained lean athletes: a case for higher intakes. Int J Sport Nutr Exerc Metab 2014;24(2):127–138.",
    "Nedeltcheva AV, et al. Insufficient sleep undermines dietary efforts to reduce adiposity. Ann Intern Med 2010;153(7):435–441."],
  body:`Khi ăn thiếu năng lượng, cơ thể có thể lấy cả cơ làm nhiên liệu. Ba việc sau giúp phần lớn số cân giảm đi là **mỡ**.

| Việc cần làm | Mức gợi ý | Bằng chứng |
|---|---|---|
| Tập tạ | Giữ mức tạ ở bài chính; có thể bớt khoảng 1/3 số hiệp | Cava, 2017 |
| Ăn đạm | 1,8–2,2 g/kg cân nặng mỗi ngày | Helms, 2014 |
| Ngủ | Ít nhất 7 giờ mỗi đêm | Nedeltcheva, 2010 |

## 1. Tiếp tục tập tạ, giữ mức nặng

Tạ là tín hiệu báo cho cơ thể "cơ này vẫn còn cần dùng". Tổng quan của Cava (2017) cho thấy tập kháng lực trong lúc giảm cân giữ khối cơ tốt hơn hẳn so với chỉ ăn kiêng hoặc chỉ tập cardio. Nếu mệt, bạn có thể giảm khoảng 1/3 số hiệp, nhưng hãy **giữ mức tạ** ở các bài chính như [[ex:squat]], [[ex:benchpress]], [[ex:rdl]], [[ex:pullup]].

## 2. Ăn đạm cao hơn bình thường

Tổng quan của Helms (2014) gợi ý **2,3–3,1 g/kg khối nạc** cho người tập tạ đã khá gọn đang giảm mỡ. Với đa số người, cách tính đơn giản **1,8–2,2 g/kg cân nặng** là đủ.

## 3. Ngủ đủ giấc

Trong thử nghiệm của Nedeltcheva (2010), cùng một chế độ ăn kiêng nhưng ngủ 5,5 giờ thay vì 8,5 giờ thì lượng **mỡ giảm ít hơn khoảng 55 %**, còn **khối nạc mất nhiều hơn khoảng 60 %**.

:::ap-dung
- Mỗi bữa có một phần đạm cỡ lòng bàn tay: cá, thịt nạc, trứng, đậu phụ.
- Giữ 3 buổi tạ/tuần. Cardio là phần cộng thêm, không thay thế tạ.
- Đặt giờ đi ngủ và bật nhắc nhở trong app.
:::

:::an-toan
Người có bệnh thận mạn hoặc đã được dặn hạn chế đạm cần hỏi bác sĩ trước khi tăng lượng đạm.
:::` },

{ id:"gm-cardio-hiit", cat:"giam-mo", audience:"ca-hai", updated:U,
  title:"Cardio giảm mỡ: HIIT hay đi bộ đều đặn?",
  summary:"Cả hai đều giảm mỡ tương đương. Chọn loại bạn duy trì được và không cản trở buổi tập tạ.",
  tags:["cardio","HIIT","đi bộ dốc","giảm mỡ","Zone 2"],
  ex:["inclinewalk","zone2","intervalwalk","rowing","burpee","jumprope"],
  tpl:["tpl-u-cardio"],
  sources:["Wewege M, et al. The effects of high-intensity interval training vs. moderate-intensity continuous training on body composition in overweight and obese adults: a systematic review and meta-analysis. Obes Rev 2017;18(6):635–646.",
    "Donnelly JE, et al. ACSM position stand: Appropriate physical activity intervention strategies for weight loss and prevention of weight regain for adults. Med Sci Sports Exerc 2009;41(2):459–471."],
  body:`Cả hai đều giúp giảm mỡ. Câu hỏi đúng hơn là **bạn làm đều được loại nào** và loại nào không ảnh hưởng đến buổi tập tạ.

## So sánh

| | Liên tục cường độ vừa (MICT) | Ngắt quãng cường độ cao (HIIT) |
|---|---|---|
| Ví dụ | [[ex:inclinewalk]], [[ex:zone2]] đạp xe 30–60 phút | [[ex:intervalwalk]], [[ex:rowing]] 30 giây nhanh / 90 giây chậm |
| Giảm mỡ | Tương đương (Wewege, 2017) | Tương đương, tốn ít thời gian hơn khoảng 40 % |
| Mức mệt cho chân | Ít | Nhiều, có thể ảnh hưởng buổi tập chân |
| Hợp với | Người mới, thừa cân, khớp yếu | Người đã có nền thể lực, ít thời gian |

## Bao nhiêu là đủ?

Tuyên bố của ACSM (Donnelly, 2009): **150–250 phút/tuần** vận động vừa giúp giảm cân ở mức khiêm tốn. **Trên 250 phút/tuần** giúp giảm rõ hơn và **giữ cân** tốt hơn sau khi giảm.

## Gợi ý một tuần

- 3 buổi tạ để giữ cơ.
- 2–3 buổi đi bộ dốc hoặc Zone 2, mỗi buổi 30–45 phút.
- Tối đa 1–2 buổi HIIT ngắn, không xếp ngay trước ngày tập chân nặng.
- Đi bộ mỗi ngày. Đọc [[kb:gm-neat-buoc-chan|NEAT và bước chân]].

:::ap-dung
Thử giáo án [[tpl:tpl-u-cardio|Zone 2 + Đi bộ dốc]]: bắt đầu ở độ dốc thấp và tốc độ vừa phải, tăng dần đến giao thức 12-3-30 khi đã quen.
:::

:::an-toan
HIIT với [[ex:burpee]] hay [[ex:jumprope]] tạo áp lực lớn lên gối và cổ chân. Người thừa cân nhiều nên bắt đầu bằng đạp xe hoặc máy chèo. Người có bệnh tim cần bác sĩ đồng ý trước khi tập HIIT.
:::` },

{ id:"gm-neat-buoc-chan", cat:"giam-mo", audience:"nguoi-tap", updated:U,
  title:"NEAT và bước chân: vũ khí giảm mỡ hay bị bỏ quên",
  summary:"Năng lượng tiêu hao ngoài giờ tập có thể chênh nhau rất nhiều giữa hai người. 10 cách thêm bước chân không cần \"đi tập\".",
  tags:["NEAT","bước chân","đi bộ","giảm mỡ","ít vận động"],
  ex:["walking","intervalwalk"],
  sources:["Levine JA. Non-exercise activity thermogenesis (NEAT). Best Pract Res Clin Endocrinol Metab 2002;16(4):679–702.",
    "Paluch AE, et al. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health 2022;7(3):e219–e228."],
  body:`**NEAT** (non-exercise activity thermogenesis) là năng lượng tiêu hao cho mọi vận động *không phải tập luyện*: đi lại, đứng, làm việc nhà, cử động vặt. Theo Levine (2002), NEAT giữa hai người cùng cỡ người có thể **chênh nhau tới khoảng 2.000 kcal/ngày**, tuỳ công việc và lối sống.

## Vì sao NEAT quan trọng khi giảm mỡ

Khi ăn ít, cơ thể có xu hướng **tự giảm NEAT**: bạn ngồi nhiều hơn, đi chậm hơn mà không nhận ra. Giữ số bước chân ổn định giúp chặn bớt phần "tiết kiệm" này.

## Bao nhiêu bước là đủ?

Phân tích gộp của Paluch (2022) về sức khoẻ: lợi ích tăng dần đến khoảng **8.000–10.000 bước/ngày** với người dưới 60 tuổi và **6.000–8.000 bước** với người từ 60 tuổi. Với mục tiêu giảm mỡ, điều quan trọng là **tăng so với mức hiện tại** và giữ ổn định.

## 10 cách thêm bước chân

1. Đi bộ 10 phút sau mỗi bữa ăn.
2. Đứng dậy đi lại khi nghe điện thoại.
3. Gửi xe xa hơn một chút.
4. Đi cầu thang 2–3 tầng.
5. Họp đứng hoặc vừa đi vừa trao đổi.
6. Tự đi mua đồ ăn sáng thay vì đặt giao.
7. Đi dạo buổi tối cùng gia đình.
8. Xuống xe buýt sớm một trạm.
9. Làm việc nhà: lau nhà, phơi đồ, tưới cây.
10. Ngồi 45–60 phút thì đứng lên đi lại 2–3 phút.

:::ap-dung
Xem số bước trung bình 7 ngày qua trên điện thoại. Tuần này, đặt mục tiêu **cao hơn 1.500–2.000 bước/ngày**, giữ trong 2 tuần rồi mới tăng tiếp.
:::

:::an-toan
Nếu đau gót chân hoặc đau ống chân khi tăng số bước đột ngột, hãy giảm lại, mang giày êm hơn và tăng chậm hơn.
:::` },

{ id:"gm-khong-giam-mo-tai-cho", cat:"giam-mo", audience:"nguoi-tap", updated:U,
  title:"Giảm mỡ bụng tại chỗ: vì sao gập bụng không làm bụng nhỏ đi",
  summary:"Cơ thể lấy mỡ từ khắp nơi theo cách riêng. Điều thật sự làm bụng nhỏ đi và vai trò thật của bài tập bụng.",
  tags:["mỡ bụng","giảm mỡ tại chỗ","tập bụng","vòng eo"],
  ex:["crunch","plank","hangingleg","deadbug"],
  sources:["Vispute SS, et al. The effect of abdominal exercise on abdominal fat. J Strength Cond Res 2011;25(9):2559–2564.",
    "Ramírez-Campillo R, et al. Regional fat changes induced by localized muscle endurance resistance training. J Strength Cond Res 2013;27(8):2219–2224."],
  body:`Cơ thể lấy mỡ ra từ khắp nơi theo cách **do gen và hormone quyết định**, chứ không theo vùng cơ bạn đang tập.

## Bằng chứng

- **Vispute (2011):** tập bụng 5 ngày/tuần trong 6 tuần **không làm giảm mỡ bụng** so với nhóm không tập.
- **Ramírez-Campillo (2013):** tập riêng một chân không làm mỡ ở chân đó giảm nhiều hơn. Mỡ lại giảm nhiều ở phần thân trên.

## Vậy làm sao để bụng nhỏ đi?

1. **Giảm mỡ toàn thân** bằng mức thâm hụt năng lượng vừa phải. Đọc [[kb:gm-toc-do-giam]].
2. **Tập toàn thân** để giữ cơ và tăng tiêu hao năng lượng.
3. **Ngủ đủ, bớt rượu bia**: mỡ vùng bụng nhạy với cả hai yếu tố này.
4. **Kiên nhẫn**: những vùng mỡ "cứng đầu" (bụng dưới ở nam, đùi và hông ở nữ) thường giảm sau cùng.

## Có nên tập bụng không?

Có, nhưng vì lý do khác: cơ thân khoẻ giúp bạn nâng tạ tốt hơn và bảo vệ lưng. [[ex:plank]], [[ex:deadbug]], [[ex:hangingleg]] và [[ex:crunch]] đều là bài tốt. Chỉ cần đừng kỳ vọng chúng "đốt" được mỡ bụng.

:::ap-dung
Đo vòng eo 2 tuần/lần, cùng giờ, cùng vị trí thước dây. Vòng eo giảm dần là dấu hiệu rõ nhất cho thấy mỡ bụng đang giảm.
:::

:::an-toan
Đai nịt bụng, kem tan mỡ, máy rung không làm giảm mỡ thật. Chúng chỉ khiến vùng đó mất nước tạm thời.
:::` },

{ id:"gm-dao-dong-can-nang", cat:"giam-mo", audience:"ca-hai", updated:U,
  title:"Cân nặng dao động và chững cân: khi nào là thật?",
  summary:"Sáng nay tăng 0,8 kg gần như chắc chắn không phải mỡ. Cách nhận biết chững cân thật và xử lý theo thứ tự.",
  tags:["chững cân","plateau","dao động cân nặng","nghỉ ăn kiêng"],
  ex:["walking","legpress"],
  tpl:["tpl-u-cardio"],
  sources:["Byrne NM, et al. Intermittent energy restriction improves weight loss efficiency in obese men: the MATADOR study. Int J Obes 2018;42(2):129–138.",
    "Fernández-Elías VE, et al. Relationship between muscle water and glycogen recovery after prolonged exercise in the heat in humans. Eur J Appl Physiol 2015;115(9):1919–1926.", HALL],
  body:`Cân sáng nay tăng 0,8 kg so với hôm qua? Gần như chắc chắn **không phải mỡ**. Muốn tăng 0,8 kg mỡ trong một ngày, bạn phải ăn dư cả nghìn kcal.

## Những nguyên nhân gây dao động

| Nguyên nhân | Ảnh hưởng |
|---|---|
| Bữa nhiều muối (phở, lẩu, đồ ăn sẵn) | Giữ nước, cân tăng tạm thời 1–2 ngày |
| Ăn nhiều tinh bột sau thời gian ăn kiêng | Mỗi gam glycogen dự trữ kèm khoảng 3 g nước |
| Chu kỳ kinh nguyệt | Giữ nước trước kỳ kinh |
| Táo bón, bữa tối muộn | Tăng tạm thời |
| Buổi tập chân nặng | Cơ giữ nước để sửa chữa |

## Thế nào là chững cân thật?

Khi **trung bình 7 ngày** không thay đổi trong **2–3 tuần liên tục**, đồng thời vòng eo cũng không giảm. Hãy xử lý theo thứ tự:

1. Kiểm tra lại khẩu phần: dầu ăn, nước chấm, đồ uống thường bị ghi thiếu.
2. Kiểm tra số bước chân xem có giảm không.
3. Bớt thêm 100–200 kcal/ngày hoặc thêm khoảng 2.000 bước/ngày.
4. Cân nhắc **nghỉ ăn kiêng** 1–2 tuần ở mức calo duy trì.

## Nghỉ ăn kiêng có ích không?

Thử nghiệm MATADOR (Byrne, 2018): nhóm ăn kiêng **2 tuần rồi nghỉ 2 tuần** (ăn ở mức duy trì) giảm mỡ nhiều hơn và giữ cân tốt hơn sau 6 tháng so với nhóm ăn kiêng liên tục. Đổi lại, tổng thời gian kéo dài hơn.

:::ap-dung
Khi xem biểu đồ cân, hãy nhìn **trung bình tuần**. Chỉ điều chỉnh khẩu phần sau ít nhất 2 tuần có dữ liệu.
:::

:::an-toan
Tăng cân nhanh kèm phù chân, khó thở hoặc tiểu ít thì cần đi khám. Đó không phải chuyện ăn uống thông thường.
:::` },

{ id:"gm-che-do-an-nao", cat:"giam-mo", audience:"ca-hai", updated:U,
  title:"Keto, nhịn ăn gián đoạn, low-carb: chế độ nào giảm mỡ tốt nhất?",
  summary:"Các thử nghiệm lớn cho thấy chế độ tốt nhất là chế độ bạn duy trì được. Gợi ý chọn theo tính cách, không theo trào lưu.",
  tags:["keto","nhịn ăn gián đoạn","low-carb","chế độ ăn","IF"],
  tpl:["tpl-u-cardio","tpl-u-home"],
  sources:["Gardner CD, et al. Effect of low-fat vs low-carbohydrate diet on 12-month weight loss in overweight adults: the DIETFITS randomized clinical trial. JAMA 2018;319(7):667–679.",
    "Liu D, et al. Calorie restriction with or without time-restricted eating in weight loss. N Engl J Med 2022;386(16):1495–1504.",
    "Aragon AA, et al. International Society of Sports Nutrition position stand: diets and body composition. J Int Soc Sports Nutr 2017;14:16."],
  body:`Chế độ ăn giảm mỡ tốt nhất là chế độ **tạo được thâm hụt năng lượng mà bạn duy trì được lâu**, đủ đạm và đủ vi chất.

## Các nghiên cứu lớn nói gì

| Nghiên cứu | So sánh | Kết quả |
|---|---|---|
| DIETFITS (Gardner, 2018), 609 người, 12 tháng | Ít béo và ít tinh bột | Mức giảm cân **không khác biệt** có ý nghĩa |
| Liu (2022), 139 người, 12 tháng | Hạn chế calo **có** và **không** kèm ăn trong khung 8 giờ | **Không khác biệt** |
| ISSN (Aragon, 2017) | Tổng quan các chế độ ăn | Thâm hụt năng lượng là yếu tố chính; đạm cao giúp giữ cơ |

## Chọn theo tính cách, không theo trào lưu

- **Nhịn ăn gián đoạn (16:8):** hợp với người không đói buổi sáng, thích ăn ít bữa mà no. Không hợp nếu bạn tập sáng sớm mà không chịu được đói.
- **Low-carb:** hợp với người thích thịt, trứng, rau và hay ăn quá nhiều cơm, bánh. Hiệu suất buổi tập cường độ cao có thể giảm.
- **Đếm calo linh hoạt:** hợp với người thích con số, vẫn ăn được món Việt quen thuộc.
- **Ăn theo đĩa và bàn tay:** hợp với người không muốn cân đo. Đọc [[kb:dd-dia-com-viet]].

:::ap-dung
Chọn **một** cách và làm đúng 4 tuần trước khi đánh giá. Theo chế độ nào thì mỗi bữa cũng vẫn cần có đạm và rau.
:::

:::an-toan
Người tiểu đường đang dùng insulin hoặc thuốc nhóm sulfonylurea **không tự ý nhịn ăn hay ăn keto** vì có nguy cơ hạ đường huyết, cần bác sĩ điều chỉnh thuốc. Phụ nữ mang thai và người từng bị rối loạn ăn uống không nên nhịn ăn gián đoạn.
:::` }
);
})();

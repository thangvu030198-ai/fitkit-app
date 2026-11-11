/* =========================================================================
   TapEasy — Kho kiến thức · DỮ LIỆU 1/6
   Chuyên mục: Bắt đầu tập (10) · Kỹ thuật & an toàn (10)
   Mỗi bài: { id, title, summary, audience: "nguoi-tap"|"pt"|"ca-hai", cat, tags[], ex[] (id trong EXERCISES),
              tpl[] (id trong PROGRAM_TEMPLATES), sources[] (chuỗi trích dẫn hoặc {t,u}), updated, body }
   body = markdown nhẹ (kb.js phân tích):  ## mục · ### mục con · đoạn văn · "- " danh sách · "1. " đánh số
          · | bảng | (dòng 1 = tiêu đề, dòng |---| bỏ qua) · hộp :::ap-dung / :::an-toan / :::meo / :::luu-y / :::pt … :::
          · **đậm** · [[ex:id]] · [[kb:id|chữ]] · [[tpl:id|chữ]]
   Số liệu lấy từ hướng dẫn/tổng quan có trích nguồn cuối bài. Cập nhật: 11/2026.
   ========================================================================= */
(function(){
var A = (window.KB_ARTICLES = window.KB_ARTICLES || []);
var U = "2026-11-10";
var WHO2020 = { t:"WHO (2020). WHO guidelines on physical activity and sedentary behaviour. Geneva: World Health Organization.", u:"https://www.who.int/publications/i/item/9789240015128" };
var BULL2020 = "Bull FC, et al. World Health Organization 2020 guidelines on physical activity and sedentary behaviour. Br J Sports Med 2020;54(24):1451–1462.";
var ACSM2009 = "American College of Sports Medicine. Position stand: Progression models in resistance training for healthy adults. Med Sci Sports Exerc 2009;41(3):687–708.";
var GETP = "American College of Sports Medicine. ACSM's Guidelines for Exercise Testing and Prescription, 11th ed. Wolters Kluwer, 2021.";
var NSCA = "Haff GG, Triplett NT (eds). Essentials of Strength Training and Conditioning, 4th ed. NSCA – Human Kinetics, 2016.";

A.push(
/* ======================= BẮT ĐẦU TẬP ======================= */
{ id:"bd-4-tuan-dau", cat:"bat-dau", audience:"nguoi-tap", updated:U,
  title:"4 tuần đầu tiên: lộ trình cho người mới bắt đầu tập",
  summary:"Tháng đầu nên tập gì, mấy buổi, nặng cỡ nào để vừa tiến bộ vừa không chấn thương.",
  tags:["người mới","lộ trình","full body","tập tạ"],
  ex:["bwsquat","gobletsquat","glutebridge","rdl","inclinepushup","pushup","invertedrow","latpulldown","plank","deadbug","walking"],
  tpl:["tpl-m-fb","tpl-f-fb","tpl-u-home"],
  sources:[ACSM2009, WHO2020, GETP],
  body:`Tháng đầu tiên không phải để "đốt cháy" bản thân. Mục tiêu là **học động tác, tạo thói quen và cho gân, khớp làm quen với tải**. Cơ bắp thích nghi nhanh, còn gân và dây chằng cần nhiều thời gian hơn. Đây là lý do người mới hay đau khớp khi tăng tạ quá vội.

## Khung 4 tuần gợi ý

| Tuần | Số buổi | Mỗi bài | Cảm giác cuối hiệp |
|---|---|---|---|
| 1 | 2–3 buổi toàn thân | 2 hiệp × 10–12 lần | Còn dư 4–5 lần (rất nhẹ) |
| 2 | 3 buổi | 2–3 hiệp × 10–12 lần | Còn dư 3–4 lần |
| 3 | 3 buổi | 3 hiệp × 8–12 lần | Còn dư 2–3 lần |
| 4 | 3 buổi | 3 hiệp × 8–12 lần, tăng tạ nhẹ ở bài đã vững | Còn dư 2–3 lần |

ACSM khuyến nghị người mới tập kháng lực **2–3 buổi/tuần cho toàn thân**, mỗi bài 1–3 hiệp, mức tạ khoảng 60–70 % 1RM (tức là mức nâng được khoảng 8–12 lần).

## Mỗi buổi gồm 5 mẫu chuyển động

- **Gập gối (squat):** [[ex:bwsquat]] → [[ex:gobletsquat]]
- **Bản lề hông:** [[ex:glutebridge]] → [[ex:rdl]] với tạ nhẹ
- **Đẩy:** [[ex:inclinepushup]] → [[ex:pushup]]
- **Kéo:** [[ex:invertedrow]] hoặc [[ex:latpulldown]]
- **Thân giữa:** [[ex:plank]], [[ex:deadbug]]

Ngày nghỉ, thêm 20–30 phút [[ex:walking]] để đạt mốc vận động của WHO: 150–300 phút cường độ vừa mỗi tuần. Xem [[kb:bd-who-van-dong|khuyến nghị của WHO]].

:::ap-dung
- Chọn một giáo án mẫu 3 buổi: [[tpl:tpl-m-fb|Full Body cho nam]], [[tpl:tpl-f-fb|Full Body cho nữ]] hoặc [[tpl:tpl-u-home|tập tại nhà]].
- Đặt lịch cố định (ví dụ T2 – T4 – T6) ngay trong app.
- Ghi kg × lần mỗi hiệp. Buổi sau app sẽ gợi ý tăng tạ khi bạn làm đủ số lần.
:::

:::an-toan
- Nếu bạn có bệnh tim mạch, tiểu đường, tăng huyết áp, đang mang thai hoặc từng chấn thương, hãy làm bảng sàng lọc [[kb:bd-sang-loc-suc-khoe|PAR-Q+]] trước.
- Đau nhói, đau khớp hoặc chóng mặt là tín hiệu dừng lại. Mỏi cơ âm ỉ thì không sao.
:::` },

{ id:"bd-who-van-dong", cat:"bat-dau", audience:"ca-hai", updated:U,
  title:"Vận động bao nhiêu là đủ? Khuyến nghị của WHO cho người trưởng thành",
  summary:"150–300 phút vận động vừa, 2 buổi tập cơ mỗi tuần và bớt ngồi. Hiểu đúng các con số để xếp lịch tập thực tế.",
  tags:["WHO","sức khoẻ","bước chân","người mới"],
  ex:["walking","zone2","bwsquat","pushup"],
  sources:[WHO2020, BULL2020, "Paluch AE, et al. Daily steps and all-cause mortality: a meta-analysis of 15 international cohorts. Lancet Public Health 2022;7(3):e219–e228."],
  body:`Tổ chức Y tế Thế giới (WHO) cập nhật khuyến nghị vận động năm 2020. Với người 18–64 tuổi:

| Thành phần | Khuyến nghị mỗi tuần |
|---|---|
| Aerobic cường độ **vừa** | 150–300 phút |
| hoặc cường độ **cao** | 75–150 phút (hoặc kết hợp tương đương) |
| Tập tăng cường cơ bắp | ≥ 2 ngày, cho các nhóm cơ chính |
| Thời gian ngồi | Càng ít càng tốt, thay bằng vận động ở bất kỳ mức nào |

Người từ 65 tuổi được khuyên thêm bài **thăng bằng và vận động đa thành phần** ít nhất 3 ngày mỗi tuần để phòng ngã.

## "Vừa" và "cao" là thế nào?

- **Vừa:** thở nhanh hơn, vẫn nói được thành câu nhưng không hát được. Ví dụ: đi bộ nhanh, đạp xe thong thả.
- **Cao:** chỉ nói được vài từ là phải lấy hơi. Ví dụ: chạy, bơi nhanh, đạp xe lên dốc.

Thông thường, 1 phút vận động cường độ cao được tính tương đương khoảng 2 phút vận động vừa.

## Mọi vận động đều có ích

WHO đã bỏ yêu cầu "mỗi lần ít nhất 10 phút" của bản cũ. Đi cầu thang, đi bộ đến chỗ làm, dắt con đi chơi đều được tính. Phân tích gộp 15 nhóm nghiên cứu (Paluch, 2022) cho thấy nguy cơ tử vong giảm dần khi số bước tăng và chững lại quanh **6.000–8.000 bước/ngày với người từ 60 tuổi**, **8.000–10.000 bước/ngày với người dưới 60**.

:::ap-dung
- Ví dụ một tuần đạt chuẩn: 3 buổi tạ × 45 phút + 5 ngày đi bộ nhanh × 30 phút.
- Ngồi làm việc lâu? Cứ 30–60 phút đứng dậy đi lại 2–3 phút.
:::

:::an-toan
Bắt đầu từ mức bạn đang làm được rồi tăng dần. Người ít vận động lâu năm nên tăng thời gian trước, cường độ sau.
:::` },

{ id:"bd-doc-giao-an", cat:"bat-dau", audience:"ca-hai", updated:U,
  title:"Đọc hiểu giáo án: hiệp, lần, nghỉ, RIR và tempo",
  summary:"Giải mã dòng \"3 × 8–10 · RIR 2 · nghỉ 120 s · tempo 3-1-1-0\" để tập đúng ý người soạn giáo án.",
  tags:["thuật ngữ","RIR","RPE","người mới"],
  ex:["squat","deadlift","benchpress","gobletsquat"],
  sources:["Helms ER, et al. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J 2016;38(4):42–49.",
    "Zourdos MC, et al. Novel resistance training-specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res 2016;30(1):267–275.", NSCA],
  body:`Dòng "Squat 3 × 8–10 · RIR 2 · nghỉ 120 s · tempo 3-1-1-0" trông rối mắt, nhưng thực ra chỉ có 5 thông tin.

| Ký hiệu | Nghĩa | Ví dụ |
|---|---|---|
| **Hiệp (set)** | Một lượt thực hiện liên tục | 3 hiệp |
| **Lần (rep)** | Số lần lặp trong một hiệp | 8–10 lần |
| **Nghỉ** | Thời gian nghỉ giữa hai hiệp | 120 giây |
| **RIR** | Số lần *còn làm thêm được* lúc bạn dừng | RIR 2 = dừng khi còn sức làm thêm 2 lần |
| **Tempo** | Nhịp: hạ – dừng dưới – lên – dừng trên (giây) | 3-1-1-0 |

## Khoảng lần "8–10" dùng thế nào?

Chọn mức tạ để làm được ít nhất 8 lần. Khi làm đủ 10 lần ở mọi hiệp với kỹ thuật tốt, buổi sau tăng tạ. Cách này gọi là **tăng tiến kép**. Xem [[kb:bd-tang-tien|khi nào tăng tạ]].

## RIR và RPE

RPE là thang cảm nhận độ khó từ 1 đến 10. Với tập tạ, RPE 8 tương đương RIR 2. Người mới thường đoán RIR chưa chuẩn trong vài tuần đầu. Không sao, càng tập bạn sẽ đoán càng sát.

## Vài thuật ngữ khác

- **AMRAP:** làm nhiều lần nhất có thể mà vẫn đúng kỹ thuật.
- **Superset:** hai bài liền nhau, không nghỉ ở giữa.
- **Drop set:** hết hiệp thì giảm tạ và làm tiếp ngay.

Tra thêm trong mục **Thuật ngữ A–Z** của Kho kiến thức.

:::ap-dung
Mở tab Tập luyện → bấm vào một bài → đọc số hiệp × lần và thời gian nghỉ. Trong buổi tập, đồng hồ nghỉ tự đếm theo số giây ghi trong giáo án.
:::

:::an-toan
Người mới nên để RIR 2–3 ở các bài nhiều khớp như [[ex:squat]], [[ex:deadlift]], [[ex:benchpress]]. Tập sát giới hạn khi kỹ thuật chưa vững dễ làm form xấu đi ở những lần cuối.
:::` },

{ id:"bd-chon-lich-tap", cat:"bat-dau", audience:"ca-hai", updated:U,
  title:"Full body, Upper/Lower hay PPL: chọn lịch tập theo số buổi bạn có",
  summary:"Lịch tốt nhất là lịch bạn duy trì được. So sánh các kiểu chia buổi và giáo án mẫu phù hợp từng mức thời gian.",
  tags:["lịch tập","full body","upper lower","PPL","tần suất"],
  ex:["squat","benchpress","pullup"],
  tpl:["tpl-m-fb","tpl-f-fb","tpl-m-ul","tpl-f-glute","tpl-m-ulppl","tpl-m-ppl6"],
  sources:["Schoenfeld BJ, Ogborn D, Krieger JW. Effects of resistance training frequency on measures of muscle hypertrophy: a systematic review and meta-analysis. Sports Med 2016;46(11):1689–1697.",
    "Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to maximize muscle hypertrophy? A systematic review and meta-analysis. J Sports Sci 2019;37(11):1286–1295.", ACSM2009],
  body:`Không có lịch tập "tốt nhất". Lịch phù hợp là lịch **bạn giữ được nhiều tháng liền**. Nghiên cứu cho thấy tập mỗi nhóm cơ **ít nhất 2 lần/tuần** tăng cơ tốt hơn 1 lần/tuần (Schoenfeld, 2016). Còn khi tổng số hiệp mỗi tuần bằng nhau, chia làm 2 hay 3 lần cho kết quả gần như nhau (Schoenfeld, 2019). Vậy hãy chọn theo số buổi bạn thật sự có.

| Số buổi/tuần | Kiểu chia | Ưu điểm | Giáo án mẫu |
|---|---|---|---|
| 2–3 | Toàn thân (Full body) | Mỗi nhóm cơ 2–3 lần/tuần, lỡ một buổi cũng không sao | [[tpl:tpl-m-fb]], [[tpl:tpl-f-fb]] |
| 4 | Trên/Dưới (Upper/Lower) | Mỗi buổi tập trung hơn, đủ thời gian hồi phục | [[tpl:tpl-m-ul]], [[tpl:tpl-f-glute]] |
| 5 | ULPPL | Kết hợp Upper/Lower với Push/Pull/Legs | [[tpl:tpl-m-ulppl]] |
| 6 | Đẩy/Kéo/Chân × 2 | Khối lượng cao, hợp người đã tập lâu | [[tpl:tpl-m-ppl6]] |

## Người mới nên tránh lịch "mỗi buổi một nhóm cơ"

Lịch kiểu "thứ Hai ngực, thứ Ba lưng…" chỉ tập mỗi nhóm cơ 1 lần/tuần. Lỡ một buổi là nhóm cơ đó nghỉ tới 2 tuần. Người mới thường tiến bộ nhanh hơn với lịch toàn thân.

:::ap-dung
- Đếm số buổi bạn **chắc chắn** tập được trong tuần bận nhất, không phải tuần rảnh nhất.
- Chọn giáo án theo con số đó. Sau 8–12 tuần tập đều mới tính chuyện thêm buổi.
:::

:::an-toan
Không xếp hai buổi nặng cho cùng một nhóm cơ vào hai ngày liền nhau. Nên cách khoảng 48 giờ để cơ và gân kịp hồi phục.
:::` },

{ id:"bd-khoi-dong", cat:"bat-dau", audience:"ca-hai", updated:U,
  title:"Khởi động 8–10 phút: đúng cách mà không mất thời gian",
  summary:"Công thức 3 bước giúp cơ nóng lên, khớp trơn tru và hiệp đầu tiên đã ở trạng thái tốt nhất.",
  tags:["khởi động","giãn cơ","an toàn"],
  ex:["walking","rowing","bwsquat","glutebridge","stretch","squat"],
  sources:["Fradkin AJ, Zazryn TR, Smoliga JM. Effects of warming-up on physical performance: a systematic review with meta-analysis. J Strength Cond Res 2010;24(1):140–148.",
    "Behm DG, et al. Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review. Appl Physiol Nutr Metab 2016;41(1):1–11.",
    "Garber CE, et al. ACSM position stand: Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults. Med Sci Sports Exerc 2011;43(7):1334–1359."],
  body:`Phân tích tổng hợp của Fradkin (2010) ghi nhận khởi động giúp cải thiện thành tích ở khoảng 79 % các chỉ số được khảo sát. Khởi động tốt làm cơ ấm lên, tăng nhịp tim từ từ và giúp bạn "tập dượt" chính động tác sắp làm.

## Công thức 3 bước

1. **Làm nóng chung (3–5 phút):** [[ex:walking]] nhanh, đạp xe hoặc [[ex:rowing]] nhẹ đến khi hơi ấm người.
2. **Vận động khớp (2–3 phút):** xoay vai, mở hông, [[ex:bwsquat]], [[ex:glutebridge]], chùng chân kết hợp xoay người.
3. **Hiệp làm quen với tạ (2–4 hiệp):** làm chính bài đầu tiên với mức tạ tăng dần, số lần giảm dần. Ví dụ hiệp chính [[ex:squat]] 60 kg × 8: thanh rỗng × 10 → 40 kg × 5 → 50 kg × 3 → vào hiệp chính.

## Có nên giãn cơ tĩnh trước khi tập?

Tổng quan của Behm (2016) cho thấy giữ giãn tĩnh **dưới 60 giây mỗi nhóm cơ** gần như không làm giảm sức mạnh. Giữ lâu hơn có thể làm hiệu suất giảm nhẹ. Nếu muốn giãn trước buổi tập, hãy giữ ngắn và kết thúc bằng các động tác khởi động động.

:::ap-dung
- Trong lúc tập, app tự gợi ý các hiệp khởi động cho bài dùng thanh đòn.
- Để dành [[ex:stretch]] cho cuối buổi hoặc ngày nghỉ: mỗi tư thế giữ 10–30 giây, tổng khoảng 60 giây cho mỗi nhóm cơ, theo khuyến nghị của ACSM.
:::

:::an-toan
Trời lạnh, tập sáng sớm hoặc khi bạn trên 40 tuổi thì khởi động lâu hơn một chút. Khởi động không thay được kỹ thuật đúng và mức tạ hợp lý.
:::` },

{ id:"bd-tap-tai-nha", cat:"bat-dau", audience:"nguoi-tap", updated:U,
  title:"Tập tại nhà với ít dụng cụ: vẫn tăng cơ được",
  summary:"Cơ bắp phản ứng với độ khó, không phân biệt phòng gym hay phòng khách. 6 cách làm bài khó dần khi không có thêm tạ.",
  tags:["tại nhà","không dụng cụ","tạ đơn","dây kháng lực"],
  ex:["pushup","inclinepushup","bwsquat","bulgarian","glutebridge","invertedrow","plank","deadbug","dbrow","gobletsquat"],
  tpl:["tpl-u-home","tpl-f-home"],
  sources:["Schoenfeld BJ, Grgic J, Van Every DW, Plotkin DL. Loading recommendations for muscle strength, hypertrophy, and local endurance: a re-examination of the repetition continuum. Sports (Basel) 2021;9(2):32.",
    "Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis. J Strength Cond Res 2017;31(12):3508–3523.", WHO2020],
  body:`Cơ bắp phản ứng với **độ khó**, không phân biệt bạn tập ở đâu. Các tổng quan của Schoenfeld (2017, 2021) cho thấy tạ nhẹ, lặp nhiều lần vẫn tăng cơ tương đương tạ nặng, miễn là hiệp tập đủ gần giới hạn. Cái khó khi tập ở nhà là làm sao **tăng độ khó dần** khi không có thêm tạ.

## 6 cách làm bài khó hơn mà không thêm tạ

| Cách | Ví dụ |
|---|---|
| Tăng số lần, để ít lần dư | [[ex:pushup]] từ 12 lên 20 lần |
| Đổi đòn bẩy | [[ex:inclinepushup]] → chống đẩy thường → kê chân cao |
| Tập một bên | [[ex:bwsquat]] → [[ex:bulgarian]] |
| Hạ chậm | Hạ 3–4 giây mỗi lần |
| Dừng ở điểm khó | Dừng 2 giây ở đáy squat |
| Thêm dây kháng lực, ba lô đựng sách | [[ex:glutebridge]] đặt ba lô trên hông |

## Bộ dụng cụ tối thiểu đáng mua

- **Một cặp tạ đơn điều chỉnh được:** dùng cho [[ex:gobletsquat]], [[ex:dbrow]], đẩy vai.
- **Dây kháng lực:** rẻ, gọn, hợp cho các bài kéo.
- **Thảm tập** cho [[ex:plank]] và [[ex:deadbug]].
- Chưa có xà để tập kéo? Thử [[ex:invertedrow]] dưới một chiếc bàn thật chắc.

:::ap-dung
Thử giáo án [[tpl:tpl-u-home|Tại nhà tối thiểu dụng cụ]] hoặc [[tpl:tpl-f-home|Tại nhà cho nữ]]. Mỗi tuần ghi số lần tối đa của 1–2 bài để thấy mình tiến bộ.
:::

:::an-toan
Kiểm tra độ chắc của bàn, ghế, khung cửa trước khi tập kéo hoặc kê chân lên. Sàn gạch dễ trơn, nên tập trên thảm và mang giày.
:::` },

{ id:"bd-lan-dau-phong-gym", cat:"bat-dau", audience:"nguoi-tap", updated:U,
  title:"Lần đầu đến phòng gym: văn hoá, dụng cụ và cách bớt ngại",
  summary:"Mang gì, tập máy nào trước, những quy tắc ngầm giúp bạn tự tin ngay từ buổi đầu.",
  tags:["phòng gym","người mới","máy tập","văn hoá phòng tập"],
  ex:["legpress","latpulldown","cablerow","machinepress","gobletsquat"],
  sources:["American College of Sports Medicine. ACSM's Health/Fitness Facility Standards and Guidelines, 5th ed. Human Kinetics.", NSCA],
  body:`Ngại là cảm giác rất bình thường. Phần lớn người trong phòng tập chỉ đang lo cho hiệp tập của chính họ.

## Trước khi đi

- Mang **khăn, bình nước, giày đế phẳng bám tốt** (không đi dép).
- Xem trước giáo án hôm nay trong app để biết sẽ dùng máy nào.
- Vài buổi đầu nên chọn giờ vắng. Ở nhiều phòng tập, giờ đông nhất thường là sau giờ tan làm.

## Quy tắc ngầm của phòng tập

| Nên | Tránh |
|---|---|
| Lau ghế, tay cầm sau khi dùng | Để lại mồ hôi trên ghế |
| Trả tạ đơn, tháo đĩa về giá | Để đĩa nằm trên thanh đòn |
| Hỏi "Anh/chị còn mấy hiệp?" và xin tập xen kẽ | Chiếm máy để lướt điện thoại |
| Giữ khoảng cách khi người khác đang nâng | Đi ngang trước gương của người đang squat |

## Máy hay tạ tự do?

Máy như [[ex:legpress]], [[ex:latpulldown]], [[ex:cablerow]], [[ex:machinepress]] có quỹ đạo cố định, dễ học và an toàn khi tập một mình. Tạ tự do như [[ex:gobletsquat]] luyện thêm thăng bằng. Người mới có thể **bắt đầu bằng máy và tạ đơn**, sau đó chuyển dần sang thanh đòn.

:::ap-dung
- Nhờ nhân viên chỉ cách chỉnh ghế và chốt an toàn của từng máy. Đây là dịch vụ cơ bản, đừng ngại hỏi.
- Chụp lại vị trí chỉnh ghế (số lỗ) để lần sau chỉnh nhanh.
:::

:::an-toan
- Luôn kẹp khoá đĩa trên thanh đòn.
- Tập squat và bench bằng thanh đòn trong khung có chốt an toàn hoặc có người hỗ trợ.
- Thấy chóng mặt thì ngồi xuống ngay và báo nhân viên.
:::` },

{ id:"bd-sang-loc-suc-khoe", cat:"bat-dau", audience:"ca-hai", updated:U,
  title:"Trước khi tập: tự sàng lọc sức khoẻ với PAR-Q+",
  summary:"7 câu hỏi giúp bạn biết khi nào cứ tập, khi nào nên hỏi bác sĩ trước khi tập nặng.",
  tags:["PAR-Q+","sàng lọc","sức khoẻ","an toàn"],
  ex:["walking"],
  sources:["Warburton DER, Jamnik VK, Bredin SSD, Gledhill N. The Physical Activity Readiness Questionnaire for Everyone (PAR-Q+) and electronic Physical Activity Readiness Medical Examination (ePARmed-X+). Health Fit J Can 2011;4(2):3–23.",
    { t:"PAR-Q+ Collaboration. PAR-Q+ (phiên bản hiện hành).", u:"https://eparmedx.com/" },
    "Riebe D, et al. Updating ACSM's recommendations for exercise preparticipation health screening. Med Sci Sports Exerc 2015;47(11):2473–2479."],
  body:`Với hầu hết mọi người, lợi ích của vận động lớn hơn nhiều so với rủi ro. Dù vậy, một số tình trạng sức khoẻ cần bác sĩ xem trước khi bạn tập nặng. **PAR-Q+** là bảng câu hỏi quốc tế giúp bạn tự kiểm tra.

## 7 câu hỏi chính (tóm tắt ý)

1. Bác sĩ từng nói bạn có bệnh tim hoặc **tăng huyết áp**?
2. Bạn bị **đau ngực** khi nghỉ, khi sinh hoạt hằng ngày hoặc khi vận động?
3. Trong 12 tháng qua, bạn từng **mất thăng bằng vì chóng mặt** hoặc bị ngất?
4. Bạn được chẩn đoán một **bệnh mạn tính** khác ngoài tim mạch và huyết áp?
5. Bạn đang **dùng thuốc** điều trị bệnh mạn tính?
6. Bạn có vấn đề về **xương, khớp, mô mềm** có thể nặng hơn khi vận động?
7. Bác sĩ từng dặn bạn chỉ vận động khi có **giám sát y tế**?

Trả lời **"Không" cả 7 câu**: bạn có thể bắt đầu tập và tăng dần cường độ. Có **ít nhất một câu "Có"**: hãy làm tiếp phần câu hỏi mở rộng của PAR-Q+ hoặc hỏi bác sĩ trước khi tập nặng.

## Theo ACSM (2015)

ACSM đơn giản hoá việc sàng lọc dựa trên 3 yếu tố: bạn **đã tập đều chưa**, có **bệnh tim mạch, chuyển hoá hoặc thận** đã được chẩn đoán không, và có **triệu chứng** hay không. Người chưa tập đều, có bệnh nhưng chưa có triệu chứng nên được bác sĩ đồng ý, sau đó bắt đầu ở cường độ nhẹ đến vừa.

:::ap-dung
Vào **Menu → Sức khoẻ & an toàn** để làm bảng sàng lọc ngay trong app. Kết quả giúp app ẩn bớt các buổi cường độ rất cao nếu cần.
:::

:::an-toan
**Dừng tập và gọi cấp cứu 115** nếu bạn đau thắt ngực, khó thở bất thường, ngất hoặc tim đập loạn nhịp. Bảng sàng lọc không thay thế việc khám bệnh.
:::` },

{ id:"bd-tang-tien", cat:"bat-dau", audience:"ca-hai", updated:U,
  title:"Khi nào tăng tạ? Tăng tiến kép cho người mới",
  summary:"Tăng số lần trước, tăng tạ sau: cách đơn giản nhất để tiến bộ đều mà không vội vàng.",
  tags:["tăng tiến","quá tải tăng tiến","tăng tạ","người mới"],
  ex:["gobletsquat","squat","dbbench","latpulldown"],
  sources:[ACSM2009, "Plotkin D, et al. Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations. PeerJ 2022;10:e14142."],
  body:`Cơ bắp chỉ phát triển tiếp khi bài tập **khó dần theo thời gian**. Nguyên tắc này gọi là **quá tải tăng tiến**. Với người mới, cách đơn giản và hiệu quả nhất là **tăng tiến kép**: tăng số lần trước, tăng tạ sau.

## Ví dụ với [[ex:gobletsquat]] 3 × 8–12

| Buổi | Tạ | Số lần của 3 hiệp | Bước tiếp theo |
|---|---|---|---|
| 1 | 12 kg | 10 · 9 · 8 | Giữ tạ |
| 2 | 12 kg | 12 · 11 · 10 | Giữ tạ |
| 3 | 12 kg | 12 · 12 · 12 | Chạm mức trên → tăng tạ |
| 4 | 14 kg | 9 · 8 · 8 | Bắt đầu lại từ mức dưới |

ACSM gợi ý tăng **2–10 % mức tạ** khi bạn làm vượt số lần mục tiêu 1–2 lần ở hai buổi liên tiếp. Bài nhỏ như dang tay vai thì tăng ít, bài lớn như [[ex:squat]] có thể tăng nhiều hơn.

## Hết tạ để tăng thì sao?

Nghiên cứu năm 2022 của Plotkin so sánh hai nhóm: một nhóm tăng tạ, một nhóm giữ tạ và tăng số lần. Hai nhóm tăng cơ tương đương. Vậy bạn có thể tăng lần, tăng hiệp, hạ chậm hơn hoặc nghỉ ngắn hơn.

:::ap-dung
Ghi kg × lần cho từng hiệp trong buổi tập. App so với buổi trước và gợi ý **tăng tạ khi bạn chạm mức trên của khoảng lần ở mọi hiệp**. Khi app gợi ý giảm tạ, cũng đừng ngại làm theo.
:::

:::an-toan
Chỉ tăng tạ khi kỹ thuật vẫn đẹp ở **lần cuối** của hiệp. Nếu lưng cong, gối sụp vào trong hoặc phải vung người mới nâng được, hãy giữ nguyên mức tạ.
:::` },

{ id:"bd-do-tien-bo", cat:"bat-dau", audience:"ca-hai", updated:U,
  title:"Đo tiến bộ đúng cách: đừng chỉ nhìn cân nặng",
  summary:"Cân nặng dao động mỗi ngày. Kết hợp vòng eo, ảnh và sức mạnh để thấy rõ mình đang tiến hay lùi.",
  tags:["đo lường","vòng eo","InBody","ảnh tiến trình","cân nặng"],
  ex:["squat","pushup"],
  sources:["Burke LE, Wang J, Sevick MA. Self-monitoring in weight loss: a systematic review of the literature. J Am Diet Assoc 2011;111(1):92–102.",
    "WHO/IASO/IOTF. The Asia-Pacific perspective: redefining obesity and its treatment. Health Communications Australia, 2000.",
    "World Health Organization. Waist circumference and waist–hip ratio: report of a WHO expert consultation. Geneva, 2008 (công bố 2011).",
    "Kyle UG, et al. Bioelectrical impedance analysis – part II: utilization in clinical practice. Clin Nutr 2004;23(6):1430–1453."],
  body:`Cân nặng lên xuống 1–2 kg trong vài ngày là chuyện bình thường do nước, muối, thức ăn trong ruột và chu kỳ kinh nguyệt. Nếu chỉ nhìn cân, bạn dễ nản đúng lúc mình đang tiến bộ. Tổng quan của Burke (2011) cho thấy **tự theo dõi đều đặn** gắn với kết quả giảm cân tốt hơn. Điều quan trọng là theo dõi đúng chỉ số.

## 4 chỉ số nên theo dõi

| Chỉ số | Cách đo | Tần suất |
|---|---|---|
| Cân nặng | Buổi sáng, sau khi đi vệ sinh, trước khi ăn; xem **trung bình tuần** | 3–7 lần/tuần |
| Vòng eo | Thước dây đặt ở điểm giữa xương sườn cuối và mào chậu, đo lúc thở ra nhẹ | 2 tuần/lần |
| Ảnh | Cùng ánh sáng, góc chụp, trang phục: trước, nghiêng, sau | 2–4 tuần/lần |
| Sức mạnh | Kg × lần ở 2–3 bài chính như [[ex:squat]], [[ex:pushup]] | Mỗi buổi |

## Còn máy đo InBody?

Máy đo trở kháng điện sinh học (BIA) cho kết quả thay đổi theo lượng nước trong cơ thể. Nếu dùng, hãy đo **cùng máy, cùng giờ, cùng điều kiện ăn uống** và chỉ xem xu hướng, đừng tin tuyệt đối vào một con số.

## Người châu Á nên chú ý vòng eo

Theo khuyến nghị cho khu vực châu Á – Thái Bình Dương, vòng eo từ **90 cm ở nam** và **80 cm ở nữ** là ngưỡng béo bụng, cần chú ý nguy cơ tim mạch và chuyển hoá.

:::ap-dung
Vào **Menu → Ảnh tiến trình & InBody** để chụp ảnh có khung căn chỉnh và ghi số đo. So hai ảnh cách nhau 4–8 tuần sẽ rõ hơn nhiều so với soi gương mỗi ngày.
:::

:::an-toan
Nếu việc cân, đo hoặc chụp ảnh khiến bạn lo âu, ám ảnh, hãy giảm tần suất và tập trung vào sức mạnh, giấc ngủ, năng lượng. Đọc thêm [[kb:tl-hinh-anh-co-the|hình ảnh cơ thể và mạng xã hội]].
:::` },

/* ======================= KỸ THUẬT & AN TOÀN ======================= */
{ id:"kt-squat", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Squat đúng kỹ thuật: gối, hông, lưng và độ sâu",
  summary:"5 điểm kiểm tra, lộ trình học từ squat tay không đến thanh đòn và cách sửa 3 lỗi phổ biến.",
  tags:["squat","kỹ thuật","chân","mông","đau gối"],
  ex:["squat","gobletsquat","bwsquat","frontsquat","hacksquat","legpress","smithsquat"],
  sources:[NSCA, "Schoenfeld BJ. Squatting kinematics and kinetics and their application to exercise performance. J Strength Cond Res 2010;24(12):3497–3506.",
    "Kubo K, Ikebukuro T, Yata H. Effects of squat training with different depths on lower limb muscle volumes. Eur J Appl Physiol 2019;119(9):1933–1942."],
  body:`Squat là bài nền tảng cho chân và mông. Kỹ thuật tốt giúp bạn nâng nặng hơn và ít đau gối, đau lưng hơn.

## 5 điểm kiểm tra

1. **Bàn chân:** rộng bằng hoặc hơn vai một chút, mũi chân xoay ra ngoài khoảng 15–30°. Cả bàn chân bám sàn: ngón cái, ngón út và gót.
2. **Gối theo hướng mũi chân.** Gối vượt qua mũi chân là **bình thường** với nhiều người. Điều cần tránh là gối sụp vào trong.
3. **Siết bụng trước khi xuống:** hít sâu vào bụng rồi gồng như sắp bị đấm. Xem [[kb:kt-tho-siet-bung|thở và siết bụng]].
4. **Lưng trung tính:** ngực mở, mắt nhìn xuống sàn phía trước khoảng 2–3 m.
5. **Độ sâu:** xuống đến mức bạn vẫn giữ được lưng trung tính và gót chạm sàn. Với nhiều người, đó là khi đùi song song với sàn hoặc thấp hơn.

## Ngồi sâu có hại gối không?

Không, nếu mức tạ phù hợp. Nghiên cứu của Kubo (2019) cho thấy squat sâu làm cơ mông và cơ khép đùi phát triển nhiều hơn squat nông. Hãy tăng độ sâu dần theo độ linh hoạt của hông và cổ chân.

## Lộ trình học

[[ex:bwsquat]] → [[ex:gobletsquat]] (tạ ôm trước ngực giúp giữ thân thẳng) → [[ex:squat]] thanh đòn hoặc [[ex:frontsquat]]. Đau lưng khi tập thanh đòn? Thử [[ex:hacksquat]] hoặc [[ex:legpress]].

| Lỗi | Cách sửa |
|---|---|
| Gót nhấc khỏi sàn | Kê gót 1–2 cm, tập thêm độ linh hoạt cổ chân |
| Gối sụp vào trong | Giảm tạ, chủ động đẩy gối ra theo hướng mũi chân |
| Mông lên trước, ngực gục xuống khi đứng dậy | Giảm tạ, giữ ngực và hông đi lên cùng lúc |

:::ap-dung
Quay video ở góc nghiêng 45°, ngang tầm hông, trong hiệp cuối. Đối chiếu với 5 điểm kiểm tra rồi ghi chú vào buổi tập.
:::

:::an-toan
Tập [[ex:squat]] thanh đòn trong khung, đặt chốt an toàn thấp hơn điểm đáy 3–5 cm. Nếu không đứng lên được, hạ thanh xuống chốt rồi bước ra. Đừng cố gồng đứng dậy khi kỹ thuật đã vỡ.
:::` },

{ id:"kt-deadlift", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Deadlift và bản lề hông: nâng nặng mà lưng vẫn khoẻ",
  summary:"Học bản lề hông trong 2 phút, 6 bước deadlift chuẩn và khác biệt giữa deadlift với RDL.",
  tags:["deadlift","RDL","bản lề hông","lưng","đùi sau"],
  ex:["deadlift","rdl","kbswing","glutebridge","hipthrust"],
  sources:[NSCA, "Swinton PA, et al. A biomechanical analysis of straight and hexagonal barbell deadlifts using submaximal loads. J Strength Cond Res 2011;25(7):2000–2009."],
  body:`"Bản lề hông" nghĩa là gập ở hông, đẩy mông ra sau, lưng giữ thẳng. Kỹ năng này giúp bạn bê đồ nặng an toàn trong đời sống, đồng thời là nền tảng của [[ex:deadlift]], [[ex:rdl]] và [[ex:kbswing]].

## Học bản lề hông trong 2 phút

Đứng quay lưng vào tường, cách tường khoảng một bàn chân. Đẩy mông ra sau cho chạm tường, gối hơi chùng, cẳng chân gần như thẳng đứng. Bạn sẽ thấy đùi sau căng lên. Đó là cảm giác đúng.

## Deadlift: 6 bước

1. Thanh đòn nằm trên **giữa bàn chân**, hai chân rộng bằng hông.
2. Cúi xuống cầm thanh, hai tay ngay bên ngoài gối.
3. Hạ hông đến khi cẳng chân chạm thanh. Ngực mở, lưng trung tính.
4. Hít sâu, siết bụng, kéo nhẹ để "căng" người và thanh trước khi nhấc khỏi sàn.
5. Đạp sàn, giữ thanh sát người, hông và vai đi lên cùng nhịp.
6. Đứng thẳng, siết mông, **không ngả người ra sau**. Hạ thanh xuống theo đúng đường cũ.

## RDL khác deadlift ở đâu?

[[ex:rdl]] bắt đầu từ tư thế đứng, gối chùng nhẹ và giữ cố định. Bạn hạ tạ xuống đến khi đùi sau căng hết mức mà lưng vẫn chưa cong, thường quanh đầu gối hoặc giữa ống chân. Bài này tập trung vào đùi sau và mông.

:::meo
Đòn lục giác (trap bar) giúp thân người thẳng hơn và giảm lực tác động lên thắt lưng so với thanh đòn thẳng (Swinton, 2011). Đây là lựa chọn tốt khi mới học deadlift.
:::

:::ap-dung
Người mới: tập 3 tuần với [[ex:glutebridge]] và [[ex:rdl]] tạ đơn nhẹ, sau đó mới chuyển sang [[ex:deadlift]] thanh đòn. Mỗi buổi chỉ cần 3–4 hiệp × 5–8 lần.
:::

:::an-toan
- Lưng cong dần trong hiệp là dấu hiệu tạ quá nặng hoặc bạn đã mỏi. Hãy dừng hiệp.
- Đang đau lưng thì không deadlift nặng. Đọc [[kb:ph-dau-lung|đau lưng dưới khi tập]].
:::` },

{ id:"kt-bench", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Đẩy ngực an toàn: tư thế, quỹ đạo và người hỗ trợ",
  summary:"Bench press là bài dễ gặp tai nạn nhất khi tập một mình. Thói quen nào giúp bạn tập nặng mà vẫn an toàn.",
  tags:["bench press","đẩy ngực","an toàn","người hỗ trợ","vai"],
  ex:["benchpress","dbbench","inclinedb","machinepress","pushup"],
  sources:[NSCA, GETP],
  body:`[[ex:benchpress]] là bài để lại nhiều tai nạn nhất khi tập một mình, vì thanh đòn nằm ngay trên ngực và cổ. Những thói quen dưới đây giúp bạn tập nặng một cách an toàn.

## Tư thế 5 điểm tiếp xúc

Đầu, lưng trên và mông chạm ghế, **hai bàn chân** đặt chắc trên sàn. Kéo hai bả vai xuống và ra sau như đang kẹp một cây bút giữa hai bả vai. Lưng dưới có thể hơi cong tự nhiên, nhưng mông không nhấc khỏi ghế.

## Cách cầm và quỹ đạo

- Tay cầm rộng hơn vai một chút. Ở điểm thấp nhất, cẳng tay gần như thẳng đứng.
- Hạ thanh xuống khoảng **ngang hoặc hơi dưới đầu ti**. Khuỷu tay khép khoảng 45–70° so với thân, đừng bè ngang 90°.
- Đẩy lên theo đường hơi chéo về phía mặt, khoá khuỷu khi thanh ở trên vai.
- Cầm thanh bằng **cả năm ngón**, ngón cái vòng qua thanh. Cầm "tay khỉ" (ngón cái không vòng qua) dễ làm thanh tuột.

## Khi có người hỗ trợ

Người hỗ trợ đứng sau đầu, hai tay đặt hờ dưới thanh (một tay úp, một tay ngửa) và chỉ đỡ khi bạn nói "đỡ" hoặc thanh dừng lại. Hai người thống nhất **số lần dự kiến** trước khi bắt đầu.

:::ap-dung
Tập một mình? Hãy dùng [[ex:dbbench]], [[ex:machinepress]], hoặc bench trong khung có thanh chắn an toàn. Với tạ đơn, nếu không đẩy lên được thì chỉ cần hạ tạ xuống hai bên.
:::

:::an-toan
- Ngoại lệ duy nhất của quy tắc "luôn kẹp khoá đĩa": bench thanh đòn **một mình, không có thanh chắn**. Khi đó để trống khoá để có thể nghiêng thanh cho đĩa trượt ra nếu bị kẹt. Tốt nhất là đừng tập nặng trong hoàn cảnh này.
- Đau phía trước vai khi đẩy thì thu hẹp tay cầm và giảm biên độ. Đọc [[kb:ph-dau-vai|đau vai khi tập đẩy]].
:::` },

{ id:"kt-day-vai", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Đẩy vai và sức khoẻ khớp vai: tập sao cho bền",
  summary:"Kỹ thuật đẩy vai đứng, bài cho vai giữa và vai sau, cách cân bằng đẩy và kéo để khớp vai khoẻ lâu dài.",
  tags:["vai","đẩy vai","overhead press","vai sau","khớp vai"],
  ex:["overheadpress","dbpress","lateralraise","cablelateral","facepull"],
  sources:[NSCA, "Diercks R, et al. Guideline for diagnosis and treatment of subacromial pain syndrome: a multidisciplinary review by the Dutch Orthopaedic Association. Acta Orthop 2014;85(3):314–322."],
  body:`Khớp vai linh hoạt nhất cơ thể nên cũng dễ quá tải nhất. Muốn tập vai bền lâu, bạn cần **cân bằng giữa đẩy và kéo** và giữ kỹ thuật ổn định.

## Đẩy vai đứng ([[ex:overheadpress]])

1. Thanh đặt trước cổ, tay rộng hơn vai một chút, cẳng tay thẳng đứng.
2. Siết bụng và mông để thân không ưỡn ra sau.
3. Hơi ngả đầu ra sau cho thanh đi qua, rồi **đưa đầu về lại dưới thanh** khi thanh vượt qua trán.
4. Khoá tay khi thanh ở trên đỉnh đầu, thẳng hàng với tai.

Ngồi ghế có tựa lưng với [[ex:dbpress]] giúp lưng dưới ổn định hơn, rất hợp với người mới.

## Vai giữa và vai sau

- [[ex:lateralraise]] và [[ex:cablelateral]] giúp vai trông rộng hơn. Dùng tạ nhẹ, nâng tới ngang vai, khuỷu tay hơi chùng.
- [[ex:facepull]] tập vai sau và nhóm cơ xoay ngoài, giúp cân bằng với các bài đẩy.

## Tỉ lệ đẩy và kéo

Nhiều huấn luyện viên dùng tỉ lệ **từ 1 : 1 trở lên** cho số hiệp đẩy và kéo mỗi tuần. Đây là quy ước thực hành, chưa có nghiên cứu chứng minh một tỉ lệ tối ưu. Dù vậy, cách này giúp lịch tập không lệch hẳn về ngực và vai trước.

:::ap-dung
Thêm 2–3 hiệp [[ex:facepull]] × 12–15 lần vào cuối mỗi buổi có bài đẩy.
:::

:::an-toan
Đau nhói khi nâng tay trong khoảng 60–120°, đau làm thức giấc về đêm, hoặc yếu tay rõ rệt là lúc nên gặp bác sĩ hoặc chuyên viên vật lý trị liệu. Đừng cố tập xuyên qua cơn đau.
:::` },

{ id:"kt-keo-lung", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Bài kéo cho lưng: kéo xà, kéo xô và kéo cúi người",
  summary:"Hai kiểu kéo cần có mỗi tuần, lộ trình từ chưa kéo nổi xà đến kéo được nhiều lần, và mẹo kỹ thuật.",
  tags:["lưng","kéo xà","kéo xô","pull-up","tư thế"],
  ex:["pullup","latpulldown","invertedrow","bentoverrow","dbrow","cablerow","csrow"],
  sources:[NSCA, ACSM2009],
  body:`Lưng khoẻ giúp tư thế đẹp hơn và đẩy tốt hơn. Mỗi tuần, bạn nên có cả hai kiểu kéo:

| Kiểu kéo | Hướng | Bài tiêu biểu |
|---|---|---|
| Kéo dọc | Từ trên xuống | [[ex:pullup]], [[ex:latpulldown]] |
| Kéo ngang | Từ phía trước vào thân | [[ex:bentoverrow]], [[ex:dbrow]], [[ex:cablerow]], [[ex:csrow]] |

## Chưa kéo được xà đơn?

1. [[ex:invertedrow]] dưới xà thấp. Thân càng nằm ngang càng khó.
2. [[ex:latpulldown]] với mức tạ khoảng 60–70 % cân nặng cơ thể.
3. Kéo xà có dây kháng lực hỗ trợ, hoặc tập **pha hạ chậm**: bật lên vị trí cằm qua xà rồi hạ xuống trong 3–5 giây.
4. Kéo được 1 lần, rồi 2–3 lần mỗi hiệp, sau đó tăng dần số hiệp.

## Mẹo kỹ thuật

- Bắt đầu bằng **kéo bả vai xuống**, sau đó mới gập khuỷu.
- Hướng khuỷu tay về phía hông. Không giật người hay đung đưa lấy đà.
- Kéo cúi người: giữ tư thế bản lề hông như [[kb:kt-deadlift|deadlift]], thân nghiêng khoảng 30–45°, kéo tạ về phía rốn.

:::ap-dung
Mỗi buổi toàn thân nên có ít nhất 1 bài kéo. Đau lưng dưới khi kéo cúi người thì đổi sang [[ex:csrow]] hoặc [[ex:cablerow]]: lưng được tựa, không phải gồng giữ thân.
:::

:::an-toan
Không kéo xô ra sau gáy. Tư thế này đẩy khớp vai vào vị trí xoay ngoài tối đa mà không giúp lưng phát triển hơn kéo về trước ngực.
:::` },

{ id:"kt-tho-siet-bung", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Thở và siết bụng khi nâng tạ: nín thở có nguy hiểm không?",
  summary:"Kỹ thuật siết bụng 360°, khi nào nên nín thở, khi nào không, và ai cần tránh nghiệm pháp Valsalva.",
  tags:["siết bụng","thở","Valsalva","huyết áp","core"],
  ex:["squat","deadlift","plank","sideplank","deadbug"],
  sources:[NSCA, GETP, "MacDougall JD, et al. Arterial blood pressure response to heavy resistance exercise. J Appl Physiol 1985;58(3):785–790."],
  body:`Khi nâng nặng, cột sống cần được "bơm căng" như lốp xe để không bị gập. Cách làm là **hít sâu vào bụng rồi gồng cơ thân** (bracing).

## Cách siết bụng 360°

1. Đặt hai tay quanh eo. Hít vào bằng mũi sao cho bụng, hai bên eo và lưng dưới cùng phình ra. Ngực không nhô lên.
2. Gồng cơ bụng như sắp bị đấm, đồng thời giữ hơi.
3. Thực hiện phần khó nhất của lần nâng, thở ra khi đã qua điểm khó hoặc khi lên tới đỉnh.

## Nghiệm pháp Valsalva

Nín thở và gồng gọi là **nghiệm pháp Valsalva**. Nó giúp thân vững hơn nhưng làm **huyết áp tăng rất cao trong chốc lát**. Nghiên cứu kinh điển của MacDougall (1985) ghi nhận huyết áp lên tới hàng trăm mmHg khi đạp đùi nặng. Với người khoẻ mạnh, nín thở 1–3 giây trong mỗi lần nâng nặng là phổ biến, nhưng không nên nín suốt cả hiệp.

| Đối tượng | Gợi ý |
|---|---|
| Người khoẻ, tập nặng (≤ 5 lần) | Hít vào, giữ hơi qua điểm khó, thở ra |
| Tập mức vừa (8–15 lần) | Thở ra khi đẩy hoặc kéo, hít vào khi hạ |
| Tăng huyết áp, bệnh tim, glôcôm, mang thai | **Tránh nín thở**, dùng tạ vừa, thở đều |

## Tập cơ thân giữa

[[ex:plank]], [[ex:sideplank]] và [[ex:deadbug]] dạy bạn giữ thân ổn định trong lúc tay chân cử động. Đó chính là việc cơ thân phải làm khi bạn squat hay deadlift.

:::ap-dung
Tập siết bụng với [[ex:deadbug]]: lưng dưới áp sàn, thở ra hết rồi hạ tay và chân đối bên. Làm 3 hiệp × 8 lần mỗi bên trong phần khởi động.
:::

:::an-toan
Hoa mắt, đau đầu dữ dội hoặc "tối sầm" khi nâng nặng thì dừng ngay, ngồi nghỉ, và đi khám nếu tình trạng lặp lại.
:::` },

{ id:"kt-dung-cu-ho-tro", cat:"ky-thuat", audience:"nguoi-tap", updated:U,
  title:"Đai lưng, dây kéo, phấn, giày: khi nào thật sự cần?",
  summary:"Dụng cụ hỗ trợ là công cụ, không phải bùa hộ mệnh. Dùng đúng lúc để tập tốt hơn mà không che mất điểm yếu.",
  tags:["đai lưng","dây kéo","giày tập","dụng cụ"],
  ex:["squat","deadlift","rdl","pullup"],
  sources:[NSCA, "Zink AJ, Whiting WC, Vincent WJ, McLaine AJ. The effects of a weight belt on trunk and leg muscle activity and joint kinematics during the squat exercise. J Strength Cond Res 2001;15(2):235–240."],
  body:`Dùng dụng cụ hỗ trợ đúng lúc thì giúp bạn tập tốt hơn. Dùng sai lúc thì nó che mất điểm yếu của bạn.

| Dụng cụ | Tác dụng | Khi nào dùng |
|---|---|---|
| **Đai lưng** | Tạo điểm tựa để cơ bụng đẩy vào, tăng áp lực trong ổ bụng | Hiệp nặng (≥ 80 % 1RM) ở [[ex:squat]], [[ex:deadlift]] |
| **Dây kéo (strap)** | Bù cho lực nắm khi lưng vẫn còn kéo được | Hiệp nặng hoặc nhiều lần ở [[ex:rdl]], kéo cúi người |
| **Phấn** | Giảm trơn tay | Gần như mọi bài kéo |
| **Băng cổ tay** | Giữ cổ tay thẳng khi đẩy nặng | Bench, đẩy vai nặng |
| **Giày đế phẳng, cứng** | Ổn định khi squat, deadlift | Mọi buổi tập tạ |

## Đai lưng có làm yếu cơ bụng?

NSCA khuyên **không dùng đai** cho bài nhẹ hoặc bài không tạo tải lên cột sống, chỉ dùng cho các hiệp gần tối đa. Nghiên cứu của Zink (2001) không thấy đai làm giảm hoạt động cơ thân khi squat. Hãy học siết bụng không đai trước, rồi mới dùng đai cho hiệp nặng.

## Đi giày chạy để squat được không?

Đế giày chạy mềm và dày nên dễ làm bạn mất ổn định khi gánh nặng. Giày đế phẳng, cứng là tốt nhất. Giày cử tạ có gót nâng giúp người có cổ chân kém linh hoạt ngồi sâu hơn.

:::ap-dung
Mới tập dưới 6 tháng: chưa cần mua gì ngoài giày đế phẳng và phấn. Khi [[ex:deadlift]] vượt khoảng 1,5 lần cân nặng, hãy cân nhắc mua đai.
:::

:::an-toan
Đai không bảo vệ được lưng nếu kỹ thuật sai. NSCA lưu ý thắt đai chặt khi tập có thể làm tăng huyết áp, vì vậy đừng thắt đai suốt buổi, hãy nới đai giữa các hiệp.
:::` },

{ id:"kt-bien-do-va-ta-ao", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Biên độ đầy đủ và \"tạ ảo\": 6 lỗi kỹ thuật phổ biến",
  summary:"Chất tạ nặng nhưng chỉ làm nửa biên độ hoặc vung người: cơ phát triển kém hơn mà rủi ro chấn thương lại cao hơn.",
  tags:["biên độ","ROM","kỹ thuật","sai lầm"],
  ex:["legpress","bicepcurl","latpulldown","lateralraise","squat","rdl"],
  sources:["Schoenfeld BJ, Grgic J. Effects of range of motion on muscle development during resistance training interventions: a systematic review. SAGE Open Med 2020;8:2050312120901559.",
    "Pallarés JG, et al. Effects of range of motion on resistance training adaptations: a systematic review and meta-analysis. Scand J Med Sci Sports 2021;31(10):1866–1881."],
  body:`"Tạ ảo" là khi bạn chất tạ nặng nhưng chỉ làm nửa biên độ hoặc phải vung người. Nhìn thì ấn tượng, nhưng cơ phát triển kém hơn mà nguy cơ chấn thương lại cao hơn.

## Biên độ có quan trọng không?

Các tổng quan hệ thống (Schoenfeld & Grgic, 2020; Pallarés, 2021) cho thấy tập với **biên độ đầy đủ** thường tăng sức mạnh và kích thước cơ tốt hơn biên độ ngắn, nhất là ở các bài chân. Tập ở tư thế **cơ bị kéo dài** (ví dụ đáy squat, đáy [[ex:rdl]]) có vẻ đặc biệt có lợi.

## 6 lỗi hay gặp

| Lỗi | Hậu quả | Cách sửa |
|---|---|---|
| [[ex:legpress]] chỉ đạp 1/4 biên độ | Ít kích thích cơ, dồn tải vào gối | Hạ đến khi đùi gần chạm bụng mà lưng dưới chưa rời ghế |
| Vung người khi [[ex:bicepcurl]] | Lưng gánh tải, tay trước ít làm việc | Giảm tạ, tựa lưng vào tường |
| Kéo xô bằng cách ngả người ra sau | Biến thành bài kéo ngang | Thân chỉ nghiêng tối đa khoảng 15° |
| Nhún vai khi [[ex:lateralraise]] | Cầu vai làm thay vai giữa | Tạ nhẹ, giữ vai "xa tai" |
| Thả rơi tạ ở pha hạ | Mất nửa giá trị bài tập | Hạ có kiểm soát trong 2–3 giây |
| Đổi kỹ thuật mỗi lần tăng tạ | Không so được tiến bộ | Giữ một chuẩn kỹ thuật cố định |

:::ap-dung
Chọn 1 bài bạn hay "ăn gian" nhất. Giảm tạ 10–20 %, tập đúng biên độ trong 4 tuần, rồi so số lần với trước đây.
:::

:::an-toan
Biên độ đầy đủ nghĩa là đầy đủ **trong vùng bạn kiểm soát được**. Nếu khớp đang đau hoặc từng chấn thương, hãy giới hạn biên độ trong vùng không đau rồi tăng dần.
:::` },

{ id:"kt-tap-troi-nong", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Tập trong trời nóng ẩm: phòng say nóng khi gắng sức",
  summary:"Nhận biết 3 mức bệnh do nóng, nguyên tắc \"làm mát trước, chuyển viện sau\" và cách làm quen nhiệt.",
  tags:["trời nóng","say nóng","mất nước","an toàn","mùa hè"],
  ex:["running","walking","zone2"],
  sources:["Roberts WO, et al. ACSM expert consensus statement on exertional heat illness: recognition, management, and return to activity. Curr Sports Med Rep 2021;20(9):470–484.",
    "Casa DJ, et al. National Athletic Trainers' Association position statement: exertional heat illnesses. J Athl Train 2015;50(9):986–1000.",
    "Sawka MN, et al. ACSM position stand: Exercise and fluid replacement. Med Sci Sports Exerc 2007;39(2):377–390."],
  body:`Mùa hè ở nhiều tỉnh thành Việt Nam vừa nóng vừa ẩm. Mồ hôi khó bay hơi nên cơ thể khó tự làm mát. **Say nóng do gắng sức** là cấp cứu có thể gây tử vong, nhưng hoàn toàn **phòng tránh được**.

## Nhận biết sớm

| Mức độ | Dấu hiệu | Làm gì |
|---|---|---|
| Chuột rút do nóng | Co rút cơ gây đau, ra nhiều mồ hôi | Dừng, vào chỗ mát, uống nước có muối khoáng |
| Kiệt sức do nóng | Mệt lả, chóng mặt, buồn nôn, da ẩm lạnh, mạch nhanh | Dừng hẳn, nằm chỗ mát, kê chân cao, làm mát, uống nước |
| **Say nóng** | **Lú lẫn, nói lắp, hành vi bất thường**, ngã quỵ, thân nhiệt trên 40 °C | **Gọi 115** và làm mát ngay bằng nước lạnh, đá. Không chờ đợi |

Nguyên tắc của ACSM và NATA với say nóng là **"làm mát trước, chuyển viện sau"**: ngâm người vào nước lạnh hoặc dội nước đá liên tục, quạt mạnh, đắp khăn lạnh ở cổ, nách, bẹn.

## Phòng tránh

- Tập ngoài trời vào **sáng sớm hoặc chiều muộn**.
- **Làm quen nhiệt trong 10–14 ngày**: những ngày đầu giảm thời gian và cường độ, rồi tăng dần.
- Cân trước và sau buổi tập. Không để mất quá **2 % cân nặng** vì mất nước (Sawka, 2007).
- Mặc đồ sáng màu, thoáng khí. Phòng tập không có điều hoà thì bật quạt và nghỉ lâu hơn giữa các hiệp.

:::ap-dung
Cứ mỗi kg cân nặng mất đi sau buổi tập, hãy uống bù khoảng **1,25–1,5 lít** nước, kèm bữa ăn có muối. Đọc thêm [[kb:dd-nuoc-dien-giai|nước và điện giải]].
:::

:::an-toan
Người vừa ốm dậy, đang sốt, thiếu ngủ, uống rượu tối hôm trước hoặc đang dùng thuốc lợi tiểu có nguy cơ say nóng cao hơn. Hôm đó nên tập nhẹ trong phòng mát.
:::` },

{ id:"kt-dau-hieu-dung-tap", cat:"ky-thuat", audience:"ca-hai", updated:U,
  title:"Dấu hiệu phải dừng tập ngay: tim, đầu, cơ và nước tiểu sẫm màu",
  summary:"Phân biệt mệt bình thường với dấu hiệu nguy hiểm, và nhận biết sớm tiêu cơ vân do gắng sức.",
  tags:["an toàn","cấp cứu","tiêu cơ vân","đau ngực","người mới"],
  ex:["burpee","squat","walking"],
  sources:[GETP, "Uniformed Services University – CHAMP. Clinical Practice Guideline for the Management of Exertional Rhabdomyolysis in Warfighters, 2020.",
    "Riebe D, et al. Updating ACSM's recommendations for exercise preparticipation health screening. Med Sci Sports Exerc 2015;47(11):2473–2479."],
  body:`Mệt, thở dốc, mỏi cơ là chuyện bình thường khi tập. Nhưng có những dấu hiệu cho thấy cơ thể đang thật sự gặp nguy hiểm.

## Dừng ngay và gọi 115 nếu có

- Đau, tức, nặng ngực, lan ra tay trái, hàm hoặc lưng.
- Khó thở bất thường, không tương xứng với mức gắng sức.
- Ngất, gần ngất hoặc lú lẫn.
- Tim đập rất nhanh hoặc loạn nhịp, không chậm lại khi nghỉ.
- Yếu hoặc tê nửa người, méo miệng, nói khó.

## Tiêu cơ vân: hiếm nhưng nghiêm trọng

Tiêu cơ vân do gắng sức xảy ra khi cơ bị tổn thương nặng, giải phóng myoglobin vào máu và có thể gây suy thận. Tình trạng này hay gặp khi **người mới hoặc người nghỉ tập lâu tập quá sức ngay từ buổi đầu**, đặc biệt khi lặp rất nhiều lần, nhiều pha hạ chậm, trời nóng hoặc thiếu nước.

| Dấu hiệu | Khác với đau cơ thông thường (DOMS) |
|---|---|
| Cơ sưng, đau dữ dội, không gập duỗi được | DOMS chỉ ê ẩm, vẫn cử động được |
| **Nước tiểu màu nâu sẫm như nước trà** | DOMS không làm đổi màu nước tiểu |
| Đau tăng dần sau 2–3 ngày | DOMS đỡ dần sau 48–72 giờ |

Nước tiểu sẫm màu kèm đau cơ dữ dội: **đi khám ngay**.

:::ap-dung
Buổi đầu tiên, hoặc khi quay lại sau thời gian nghỉ dài, chỉ tập **khoảng một nửa** khối lượng bạn nghĩ mình làm được. Ví dụ giáo án ghi 4 hiệp thì bạn làm 2 hiệp.
:::

:::an-toan
Đau chói ở khớp, nghe tiếng "phựt" kèm đau, hoặc sưng nhanh sau chấn thương: ngừng tập vùng đó, chườm lạnh, nâng cao chi và đi khám nếu không đỡ sau 24–48 giờ.
:::` }
);
})();

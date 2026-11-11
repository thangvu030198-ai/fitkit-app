/* =========================================================================
   TapEasy — Kho kiến thức · DỮ LIỆU 3/6
   Chuyên mục: Dinh dưỡng thể thao & món Việt (10) · Phục hồi – giấc ngủ – chấn thương thường gặp (8)
   Định dạng: xem đầu kb-data-1.js. Giá trị dinh dưỡng là ước tính làm tròn (USDA FoodData Central,
   Bảng thành phần thực phẩm Việt Nam – Viện Dinh dưỡng), thay đổi theo cách chế biến.
   ========================================================================= */
(function(){
var A = (window.KB_ARTICLES = window.KB_ARTICLES || []);
var U = "2026-11-10";
var ISSNPRO = "Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise. J Int Soc Sports Nutr 2017;14:20.";
var ACSMNUT = "Thomas DT, Erdman KA, Burke LM. American College of Sports Medicine joint position statement: Nutrition and athletic performance. Med Sci Sports Exerc 2016;48(3):543–568.";
var KERK = "Kerksick CM, et al. International Society of Sports Nutrition position stand: nutrient timing. J Int Soc Sports Nutr 2017;14:33.";
var SAWKA = "Sawka MN, et al. ACSM position stand: Exercise and fluid replacement. Med Sci Sports Exerc 2007;39(2):377–390.";
var WHOSALT = { t:"WHO. Salt reduction – fact sheet (khuyến nghị dưới 5 g muối/ngày cho người trưởng thành).", u:"https://www.who.int/news-room/fact-sheets/detail/salt-reduction" };
var VNSALT = "Bộ Y tế – Cục Y tế dự phòng. Điều tra quốc gia yếu tố nguy cơ bệnh không lây nhiễm (STEPS) Việt Nam 2015 (lượng muối trung bình 9,4 g/ngày) và STEPS 2020.";
var NIN = { t:"Viện Dinh dưỡng Quốc gia. Bảng thành phần thực phẩm Việt Nam. NXB Y học, 2007; Cổng thông tin Dinh dưỡng Quốc gia.", u:"https://viendinhduong.vn/" };
var USDA = { t:"U.S. Department of Agriculture. FoodData Central.", u:"https://fdc.nal.usda.gov/" };
var CHEUNG = "Cheung K, Hume P, Maxwell L. Delayed onset muscle soreness: treatment strategies and performance factors. Sports Med 2003;33(2):145–164.";
var DUPUY = "Dupuy O, et al. An evidence-based approach for choosing post-exercise recovery techniques to reduce markers of muscle damage, soreness, fatigue, and inflammation: a systematic review with meta-analysis. Front Physiol 2018;9:403.";

A.push(
/* ======================= DINH DƯỠNG THỂ THAO & MÓN VIỆT ======================= */
{ id:"dd-tinh-calo-macro", cat:"dinh-duong", audience:"ca-hai", updated:U,
  title:"Tính calo và macro: hiểu các con số app đưa ra",
  summary:"BMR, TDEE, calo mục tiêu, đạm – béo – tinh bột: cách tính từng con số và khi nào nên tự chỉnh.",
  tags:["calo","macro","TDEE","BMR","Mifflin-St Jeor"],
  tpl:["tpl-m-fb","tpl-f-fb"],
  sources:["Mifflin MD, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 1990;51(2):241–247.", ACSMNUT, ISSNPRO],
  body:`App tính cho bạn 5 con số: **BMR, TDEE, calo mục tiêu, lượng đạm và tỉ lệ tinh bột – béo**. Hiểu cách tính giúp bạn tự điều chỉnh khi cần.

## 1. BMR theo công thức Mifflin-St Jeor

- Nam: 10 × cân nặng (kg) + 6,25 × chiều cao (cm) − 5 × tuổi + 5
- Nữ: 10 × cân nặng (kg) + 6,25 × chiều cao (cm) − 5 × tuổi − 161

Ví dụ nữ 28 tuổi, 55 kg, cao 158 cm: 550 + 987,5 − 140 − 161 ≈ **1.237 kcal**.

## 2. TDEE = BMR × hệ số vận động

| Mức vận động | Hệ số |
|---|---|
| Ít vận động | 1,2 |
| Nhẹ (1–3 buổi/tuần) | 1,375 |
| Vừa (3–5 buổi/tuần) | 1,55 |
| Nhiều (6–7 buổi/tuần) | 1,725 |
| Rất nhiều (vận động viên, lao động nặng) | 1,9 |

## 3. Calo mục tiêu

Giảm mỡ: khoảng −18 % TDEE. Duy trì: bằng TDEE. Tăng cơ: khoảng +12 % TDEE.

## 4. Chia macro

| Chất | Gợi ý | Năng lượng |
|---|---|---|
| Đạm | 1,6–2,2 g/kg cân nặng | 4 kcal/g |
| Béo | 20–35 % tổng năng lượng | 9 kcal/g |
| Tinh bột | Phần năng lượng còn lại; 3–5 g/kg nếu tập mức vừa | 4 kcal/g |

:::ap-dung
Coi TDEE app tính là **điểm xuất phát**. Sau 2–3 tuần, dựa vào cân nặng trung bình để tăng hoặc giảm 100–200 kcal. Bấm vào thẻ mục tiêu trong tab Dinh dưỡng để chỉnh tay.
:::

:::an-toan
Công thức có thể lệch khoảng ±10 % hoặc hơn so với thực tế, nhất là ở người rất nhiều cơ hoặc béo phì. Người có bệnh chuyển hoá (tuyến giáp, tiểu đường) nên hỏi bác sĩ hoặc chuyên gia dinh dưỡng.
:::` },

{ id:"dd-protein", cat:"dinh-duong", audience:"ca-hai", updated:U,
  title:"Đạm (protein) bao nhiêu là đủ? Ăn đủ với món Việt quen thuộc",
  summary:"Mức đạm theo mục tiêu, cách chia bữa và bảng đạm của các món quen thuộc. Ví dụ thực đơn cho người 60 kg.",
  tags:["đạm","protein","tăng cơ","thực phẩm","món Việt"],
  tpl:["tpl-m-fb","tpl-f-glute"],
  sources:["Morton RW, et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. Br J Sports Med 2018;52(6):376–384.", ISSNPRO, USDA, NIN],
  body:`## Mỗi ngày cần bao nhiêu?

| Đối tượng | Gợi ý |
|---|---|
| Người ít vận động (mức tối thiểu) | Khoảng 0,8 g/kg |
| Người tập tạ, muốn tăng cơ | **1,6 g/kg**, có thể đến 2,2 g/kg |
| Đang giảm mỡ, muốn giữ cơ | 1,8–2,2 g/kg (cao hơn nếu đã rất gọn) |
| Người trên 60 tuổi | Nên ở phía cao của khoảng, mỗi bữa ít nhất 25–30 g |

Phân tích gộp của Morton (2018) cho thấy lợi ích tăng cơ **chững lại quanh 1,6 g/kg/ngày** (khoảng tin cậy lên tới 2,2 g/kg). ISSN khuyến nghị **1,4–2,0 g/kg** cho người tập luyện.

## Chia bữa

ISSN gợi ý **0,25–0,4 g/kg mỗi bữa** (thường 20–40 g), cách nhau 3–4 giờ. Ăn một bữa lớn cơ thể vẫn sử dụng được, chỉ là chia đều thì dễ đạt tổng hơn.

## Đạm trong món quen thuộc (ước tính, làm tròn)

| Thực phẩm | Lượng | Đạm |
|---|---|---|
| Ức gà chín | 100 g | khoảng 30 g |
| Thịt heo nạc, bò nạc (sống) | 100 g | khoảng 20 g |
| Cá (sống) | 100 g | khoảng 18–20 g |
| Trứng gà | 1 quả (khoảng 50 g) | khoảng 6 g |
| Đậu phụ | 100 g | khoảng 8–12 g tuỳ loại |
| Sữa tươi | 250 ml | khoảng 8 g |
| Sữa chua Hy Lạp | 100 g | khoảng 9–10 g |
| Cơm trắng | 1 chén (khoảng 150 g) | khoảng 4 g |

:::ap-dung
Người 60 kg cần khoảng 100 g đạm/ngày. Ví dụ: sáng 2 trứng + 1 hộp sữa (khoảng 20 g), trưa 150 g thịt hoặc cá (khoảng 30 g), chiều 1 hũ sữa chua Hy Lạp (khoảng 10 g), tối 150 g cá hoặc đậu phụ kèm cơm (khoảng 30 g), cộng thêm đạm từ cơm và rau trong ngày (khoảng 10 g).
:::

:::an-toan
Người có bệnh thận mạn, gout nặng hoặc đã được bác sĩ dặn hạn chế đạm cần được tư vấn riêng. Với người khoẻ mạnh, ISSN chưa ghi nhận tác hại của mức 1,6–2,2 g/kg.
:::` },

{ id:"dd-tinh-bot", cat:"dinh-duong", audience:"ca-hai", updated:U,
  title:"Tinh bột không phải kẻ thù: người tập nên ăn bao nhiêu?",
  summary:"Tinh bột là nhiên liệu cho buổi tập cường độ cao. Lượng gợi ý theo mức tập, cách chọn loại tinh bột và chuyện \"ăn cơm tối gây béo\".",
  tags:["tinh bột","carb","đường","cơm","glycogen"],
  ex:["running","rowing"],
  tpl:["tpl-u-hybrid-adv"],
  sources:[ACSMNUT, { t:"WHO (2015). Guideline: Sugars intake for adults and children.", u:"https://www.who.int/publications/i/item/9789241549028" }, NIN],
  body:`Tinh bột (carbohydrate) là nguồn nhiên liệu chính cho các buổi tập cường độ cao. Glycogen dự trữ trong cơ giúp bạn làm được nhiều hiệp hơn và đỡ hụt sức ở cuối buổi.

## Bao nhiêu là đủ (ACSM/AND/DC, 2016)

| Mức tập | Tinh bột mỗi ngày |
|---|---|
| Nhẹ, chủ yếu kỹ thuật | 3–5 g/kg |
| Vừa (khoảng 1 giờ/ngày) | 5–7 g/kg |
| Nặng (1–3 giờ/ngày, sức bền) | 6–10 g/kg |

Người tập tạ 3–5 buổi/tuần vì vóc dáng thường đủ ở mức **3–5 g/kg**. Khi giảm mỡ, có thể ăn thấp hơn, nhưng nên dồn nhiều tinh bột hơn vào các bữa quanh buổi tập.

## Chọn loại tinh bột

| Nên ăn thường xuyên | Ăn vừa phải |
|---|---|
| Cơm (có thể trộn gạo lứt), khoai lang, khoai tây, yến mạch, bún, phở, ngô, các loại đậu, trái cây | Bánh ngọt, nước ngọt, trà sữa, bánh kẹo, đồ chiên |

WHO khuyến nghị **đường tự do dưới 10 % tổng năng lượng**, tốt nhất dưới 5 %. Với người ăn 2.000 kcal/ngày, 10 % là khoảng 50 g đường. Một lon nước ngọt có ga 330 ml thường đã chứa khoảng 35 g đường (hãy xem nhãn).

## "Ăn cơm buổi tối gây béo"?

Chưa có bằng chứng cho thấy giờ ăn tinh bột quyết định việc tăng mỡ. Tổng năng lượng cả ngày mới là yếu tố chính. Người tập buổi tối vẫn nên ăn tinh bột trong bữa tối để hồi phục.

:::ap-dung
Bữa ăn 2–3 giờ trước buổi tập: một chén cơm hoặc một tô bún, phở vừa, kèm phần đạm. Đọc [[kb:dd-truoc-sau-tap]].
:::

:::an-toan
Người tiểu đường cần cá nhân hoá lượng tinh bột cùng bác sĩ hoặc chuyên gia dinh dưỡng, và theo dõi đường huyết trước, sau buổi tập.
:::` },

{ id:"dd-truoc-sau-tap", cat:"dinh-duong", audience:"ca-hai", updated:U,
  title:"Ăn gì trước và sau buổi tập?",
  summary:"Gợi ý theo khung giờ, ví dụ món Việt, và sự thật về \"cửa sổ 30 phút\" sau tập.",
  tags:["trước tập","sau tập","bữa ăn","nutrient timing"],
  ex:["squat","running"],
  sources:[KERK, ACSMNUT,
    "Schoenfeld BJ, Aragon AA, Krieger JW. The effect of protein timing on muscle strength and hypertrophy: a meta-analysis. J Int Soc Sports Nutr 2013;10:53."],
  body:`## Trước buổi tập

| Thời điểm | Ăn gì | Ví dụ món Việt |
|---|---|---|
| 2–4 giờ trước | Bữa chính: tinh bột + đạm, ít dầu mỡ | Cơm + cá kho + rau; phở bò; bún thịt nướng ít mỡ |
| 30–60 phút trước | Bữa nhẹ, dễ tiêu, chủ yếu tinh bột | Chuối, bánh mì không, sữa chua, một ít xôi |
| Tập sáng sớm, bụng đói | Ăn nhẹ nếu thấy mệt | Nửa quả chuối, một hộp sữa |

ACSM/AND/DC (2016) gợi ý 1–4 g tinh bột/kg trong 1–4 giờ trước các buổi tập dài hoặc thi đấu. Với buổi tạ khoảng 60 phút, bạn không cần ăn nhiều đến thế.

## Sau buổi tập

- **Đạm 20–40 g** trong vài giờ sau tập (ISSN). "Cửa sổ 30 phút" rộng hơn nhiều so với lời đồn: phân tích gộp của Schoenfeld (2013) cho thấy tổng lượng đạm cả ngày quan trọng hơn thời điểm ăn.
- **Tinh bột** giúp nạp lại glycogen, đặc biệt khi bạn tập 2 buổi/ngày hoặc hôm sau tập tiếp.

## Tập tối, ăn tối muộn?

Cứ ăn bữa tối bình thường sau khi tập. Một bữa nhỏ có đạm trước khi ngủ (sữa, sữa chua) có thể hỗ trợ hồi phục qua đêm. ISSN gợi ý 30–40 g casein trước khi ngủ.

:::ap-dung
- Tập lúc 17 h: ăn trưa đầy đủ lúc 12 h, ăn chuối hoặc sữa chua lúc 16 h, ăn tối lúc 19 h.
- Tập lúc 6 h sáng: uống 1 hộp sữa hoặc ăn nửa quả chuối, sau tập ăn sáng đầy đủ.
:::

:::an-toan
Ăn no, nhiều dầu mỡ ngay trước khi tập dễ gây đau bụng, buồn nôn. Người tiểu đường dùng insulin cần kế hoạch ăn riêng để tránh hạ đường huyết khi tập.
:::` },

{ id:"dd-nuoc-dien-giai", cat:"dinh-duong", audience:"ca-hai", updated:U,
  title:"Nước và điện giải: uống bao nhiêu khi tập ở xứ nóng",
  summary:"Nhu cầu nước hằng ngày, cách uống quanh buổi tập, khi nào cần nước điện giải và cách tự kiểm tra.",
  tags:["uống nước","điện giải","mất nước","trời nóng"],
  ex:["running","zone2"],
  sources:["EFSA Panel on Dietetic Products, Nutrition and Allergies. Scientific opinion on dietary reference values for water. EFSA Journal 2010;8(3):1459.", SAWKA, ACSMNUT],
  body:`## Nhu cầu hằng ngày

EFSA (2010) khuyến nghị tổng lượng nước **khoảng 2,0 lít/ngày với nữ và 2,5 lít/ngày với nam**, tính cả nước từ thức ăn (khoảng 20–30 %). Tập luyện và trời nóng làm nhu cầu tăng thêm. App gợi ý mặc định khoảng **35 ml/kg cân nặng**, bạn có thể chỉnh lại.

## Quanh buổi tập (ACSM)

| Thời điểm | Gợi ý |
|---|---|
| Khoảng 4 giờ trước | 5–7 ml/kg. Nước tiểu vẫn sẫm màu thì uống thêm 3–5 ml/kg khoảng 2 giờ trước |
| Trong khi tập | Uống theo cảm giác khát và lượng mồ hôi; mục tiêu không mất quá 2 % cân nặng |
| Sau khi tập | 1,25–1,5 lít cho mỗi kg cân nặng đã mất |

## Khi nào cần nước điện giải?

- Tập **trên 60–90 phút**, ra nhiều mồ hôi, trời nóng ẩm.
- Mồ hôi nhiều muối: áo khô để lại vệt trắng.
- Tập tạ khoảng 60 phút trong phòng máy lạnh thì nước lọc và bữa ăn bình thường là đủ.

## Tự kiểm tra nhanh

- **Màu nước tiểu**: vàng nhạt là ổn, vàng sẫm là đang thiếu nước.
- **Cân trước và sau buổi tập**: giảm 1 kg tương đương mất khoảng 1 lít mồ hôi.

:::ap-dung
Bật nhắc uống nước trong app. Mang bình 1 lít đến phòng tập và uống hết trong những buổi tập dài hoặc khi trời nóng.
:::

:::an-toan
Uống quá nhiều nước lọc trong những buổi vận động rất dài như chạy marathon có thể gây **hạ natri máu**: buồn nôn, đau đầu, lú lẫn, cân nặng tăng trong lúc chạy. Người suy tim, suy thận cần uống theo mức bác sĩ chỉ định.
:::` },

{ id:"dd-mon-viet-ngoai-hang", cat:"dinh-duong", audience:"nguoi-tap", updated:U,
  title:"Ăn ngoài hàng kiểu Việt: phở, cơm tấm, bún, bánh mì cho người tập",
  summary:"Không cần bỏ món Việt, chỉ cần gọi món khéo. Bảng mẹo gọi món và chuyện muối trong bữa ăn người Việt.",
  tags:["món Việt","ăn ngoài","phở","cơm tấm","muối"],
  sources:[WHOSALT, VNSALT, NIN],
  body:`Ăn ngoài là chuyện hằng ngày. Bạn không cần từ bỏ món Việt, chỉ cần **gọi món khéo hơn**.

## Bảng gọi món nhanh

| Món | Gọi thế này | Thêm / bớt |
|---|---|---|
| **Phở, bún bò** | Tô vừa, **thêm thịt** (tái, nạm) | Ít nước béo, thêm rau, để lại bớt nước dùng nếu cần hạn chế muối |
| **Cơm tấm** | Sườn nướng hoặc gà nướng, thêm trứng | Ít mỡ hành, ít nước mắm ngọt, thêm dưa leo, cà chua |
| **Bún chả, bún thịt nướng** | Thêm thịt nạc | Bớt chả mỡ, chấm vừa phải, ăn nhiều rau sống |
| **Bánh mì** | Trứng ốp, gà xé, thịt nguội nạc | Ít bơ, ít pate, thêm dưa leo |
| **Cơm bình dân** | 1 món đạm nướng, luộc hoặc kho + 1 món rau + canh | Tránh chọn 2–3 món chiên cùng lúc |
| **Xôi** | Xôi gà hoặc xôi trứng | Ít mỡ hành, ruốc ngọt; xôi nhiều năng lượng nên ăn lượng vừa |

## Muối: điểm yếu của bữa ăn Việt

Điều tra STEPS 2015 của Bộ Y tế ghi nhận người Việt ăn trung bình **9,4 g muối/ngày**, gần gấp đôi khuyến nghị của WHO (**dưới 5 g/ngày**). Số liệu năm 2020 cho thấy đã giảm, còn khoảng 8 g, nhưng vẫn cao. Nước dùng, nước mắm, nước chấm, đồ kho và dưa muối là các nguồn muối chính.

:::ap-dung
- Nhớ quy tắc **"thêm đạm, thêm rau, bớt nước béo, chấm nhẹ tay"**.
- Trong tab Dinh dưỡng, chọn món ăn sẵn để ghi nhanh calo các món quen thuộc.
:::

:::an-toan
Người tăng huyết áp hoặc có bệnh thận nên hạn chế nước dùng và nước chấm. Nước dùng phở, bún chứa khá nhiều muối, không nên uống hết.
:::` },

{ id:"dd-dia-com-viet", cat:"dinh-duong", audience:"nguoi-tap", updated:U,
  title:"Đĩa ăn cân bằng và phương pháp bàn tay: ăn đúng mà không cần cân đo",
  summary:"Hai công cụ đơn giản để chia khẩu phần bữa cơm Việt: tỉ lệ đĩa ăn và đo bằng bàn tay.",
  tags:["khẩu phần","đĩa ăn","bàn tay","rau","bữa cơm"],
  sources:[{ t:"Harvard T.H. Chan School of Public Health. Healthy Eating Plate.", u:"https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/" },
    { t:"WHO. Healthy diet – fact sheet (ít nhất 400 g rau và trái cây mỗi ngày).", u:"https://www.who.int/news-room/fact-sheets/detail/healthy-diet" },
    "Precision Nutrition. Hand portion guide (ước lượng khẩu phần bằng bàn tay).",
    { t:"Viện Dinh dưỡng Quốc gia. Tháp dinh dưỡng hợp lý cho người trưởng thành.", u:"https://viendinhduong.vn/" }],
  body:`Không phải ai cũng muốn cân từng gam thức ăn. Hai công cụ dưới đây giúp bạn ăn đúng mà vẫn nhẹ nhàng.

## 1. Đĩa ăn cân bằng

| Phần đĩa | Gồm | Ví dụ |
|---|---|---|
| **1/2 rau và trái cây** | Rau nhiều màu, canh rau | Rau muống luộc, cải xào, canh bí, dưa leo |
| **1/4 đạm** | Cá, thịt nạc, trứng, đậu phụ, tôm | Cá kho, thịt luộc, đậu phụ sốt cà chua |
| **1/4 tinh bột** | Ưu tiên ngũ cốc nguyên hạt khi có thể | Cơm (trộn gạo lứt), khoai, bún |
| Thêm chất béo tốt | Dầu thực vật, cá, các loại hạt | Nấu bằng dầu, hạn chế chiên ngập dầu |

WHO khuyến nghị ăn **ít nhất 400 g rau và trái cây mỗi ngày**, không tính các loại củ nhiều tinh bột như khoai.

## 2. Phương pháp bàn tay (cho một bữa)

| Nhóm | Nữ | Nam |
|---|---|---|
| Đạm (cỡ lòng bàn tay, dày bằng bàn tay) | 1 phần | 2 phần |
| Rau (cỡ nắm tay) | 1–2 phần | 2 phần |
| Tinh bột (một vốc tay khum) | 1 phần | 2 phần |
| Chất béo (cỡ ngón tay cái) | 1 phần | 2 phần |

Bàn tay to lên theo vóc người nên cách này tự điều chỉnh khá tốt. Muốn giảm mỡ thì bớt 1 phần tinh bột hoặc chất béo ở 1–2 bữa. Muốn tăng cơ thì thêm vào.

:::ap-dung
Chụp ảnh bữa trưa hôm nay rồi so với đĩa ăn cân bằng. Thiếu phần nào thì bổ sung ở bữa tối.
:::

:::an-toan
Đây là cách ước lượng dành cho người khoẻ mạnh. Người có bệnh lý như tiểu đường, bệnh thận, gout cần thực đơn do chuyên gia dinh dưỡng lập.
:::` },

{ id:"dd-thuc-pham-bo-sung", cat:"dinh-duong", audience:"ca-hai", updated:U,
  title:"Thực phẩm bổ sung: cái nào đáng tiền, cái nào không",
  summary:"Xếp hạng whey, creatine, caffeine, BCAA, \"đốt mỡ\" theo bằng chứng. Cách mua an toàn tại Việt Nam.",
  tags:["thực phẩm bổ sung","creatine","whey","caffeine","pre-workout"],
  sources:["Maughan RJ, et al. IOC consensus statement: dietary supplements and the high-performance athlete. Br J Sports Med 2018;52(7):439–455.",
    "Kreider RB, et al. International Society of Sports Nutrition position stand: safety and efficacy of creatine supplementation in exercise, sport, and medicine. J Int Soc Sports Nutr 2017;14:18.",
    "Antonio J, et al. Common questions and misconceptions about creatine supplementation: what does the scientific evidence really show? J Int Soc Sports Nutr 2021;18:13.",
    "Guest NS, et al. International Society of Sports Nutrition position stand: caffeine and exercise performance. J Int Soc Sports Nutr 2021;18:1.",
    "EFSA NDA Panel. Scientific opinion on the safety of caffeine. EFSA Journal 2015;13(5):4102.",
    "Chính phủ. Nghị định 15/2018/NĐ-CP quy định chi tiết thi hành một số điều của Luật An toàn thực phẩm."],
  body:`Thực phẩm bổ sung chỉ là **phần nhỏ** đứng sau ăn uống, tập luyện và giấc ngủ. Đồng thuận của IOC (Maughan, 2018) chỉ xếp vài chất vào nhóm có bằng chứng tốt.

## Bảng xếp hạng thực dụng

| Chất | Bằng chứng | Cách dùng | Ghi chú |
|---|---|---|---|
| **Whey, đạm bột** | Tốt (tiện bổ sung đạm) | 20–40 g khi bữa ăn chưa đủ đạm | Là thực phẩm, không phải "thuốc tăng cơ" |
| **Creatine monohydrate** | Rất tốt | **3–5 g/ngày**, uống lúc nào trong ngày cũng được | Ban đầu có thể tăng 1–2 kg do nước trong cơ |
| **Caffeine** | Tốt | **3–6 mg/kg**, khoảng 60 phút trước tập | Hàm lượng trong cà phê thay đổi nhiều theo loại hạt và cách pha |
| Beta-alanine | Vừa | 3,2–6,4 g/ngày | Hợp với bài kéo dài 1–4 phút; gây ngứa ran vô hại |
| BCAA | Yếu nếu đã đủ đạm | Không cần | Tốn tiền |
| "Đốt mỡ", "detox" | Không có hoặc rất yếu | Không nên dùng | Nguy cơ chứa chất cấm |

## Creatine có hại thận, gây rụng tóc không?

Tổng quan của ISSN (Antonio, 2021) cho thấy người khoẻ mạnh dùng đúng liều khuyến nghị **không bị hại thận**. Lo ngại về rụng tóc chủ yếu xuất phát từ một nghiên cứu nhỏ năm 2009 và chưa được các nghiên cứu sau lặp lại.

## Mua hàng tại Việt Nam

Sản phẩm thuộc nhóm thực phẩm bảo vệ sức khoẻ phải có **giấy tiếp nhận đăng ký bản công bố sản phẩm** theo Nghị định 15/2018/NĐ-CP. Hãy kiểm tra tem nhãn tiếng Việt, thông tin nhà nhập khẩu và mua ở nơi uy tín.

:::ap-dung
Trước hết, ăn đủ đạm từ bữa ăn. Nếu vẫn thiếu, thêm 1 muỗng whey. Muốn có thêm lợi thế, creatine 3–5 g/ngày là lựa chọn rẻ và có nhiều bằng chứng nhất.
:::

:::an-toan
Theo EFSA, người lớn khoẻ mạnh dùng **tối đa 400 mg caffeine/ngày** (không quá 200 mg mỗi lần) là an toàn; phụ nữ mang thai tối đa 200 mg/ngày. Không dùng pre-workout liều cao nếu bạn có bệnh tim, tăng huyết áp, lo âu hoặc mất ngủ. Người dưới 18 tuổi không nên dùng.
:::` },

{ id:"dd-an-chay-tang-co", cat:"dinh-duong", audience:"nguoi-tap", updated:U,
  title:"Ăn chay vẫn tăng cơ: kết hợp đạm thực vật thông minh",
  summary:"Nghiên cứu cho thấy ăn thuần chay đủ đạm vẫn tăng cơ như ăn mặn. Nguồn đạm chay quen thuộc và vi chất cần chú ý.",
  tags:["ăn chay","đạm thực vật","đậu nành","thuần chay"],
  tpl:["tpl-m-fb","tpl-f-fb"],
  sources:["Hevia-Larraín V, et al. High-protein plant-based diet versus a protein-matched omnivorous diet to support resistance training adaptations: a comparison between habitual vegans and omnivores. Sports Med 2021;51(6):1317–1330.",
    "Messina M, et al. No difference between the effects of supplementing with soy protein versus animal protein on gains in muscle mass and strength in response to resistance exercise. Int J Sport Nutr Exerc Metab 2018;28(6):674–685.", ISSNPRO],
  body:`Người ăn chay hoàn toàn có thể tăng cơ. Trong nghiên cứu của Hevia-Larraín (2021), người ăn thuần chay và người ăn mặn cùng ăn **1,6 g đạm/kg** và tập cùng chương trình 12 tuần đã **tăng cơ và sức mạnh tương đương nhau**. Phân tích gộp của Messina (2018) cũng không thấy khác biệt giữa bổ sung đạm đậu nành và đạm động vật.

## Điểm cần lưu ý

- Đạm thực vật thường **ít leucine hơn** và hấp thu kém hơn một chút. Hãy ăn **nhiều hơn khoảng 10–20 %** hoặc chọn nguồn đạm đậm đặc.
- **Kết hợp** ngũ cốc với các loại đậu trong ngày (cơm với đậu, bánh mì với bơ đậu phộng) để đủ các axit amin thiết yếu.

## Nguồn đạm chay quen thuộc

| Thực phẩm | Ghi chú |
|---|---|
| Đậu phụ, tàu hũ ky, sữa đậu nành | Nguồn chính, rẻ, dễ nấu |
| Tempeh, đạm đậu nành khô | Nhiều đạm, ít béo |
| Đậu xanh, đậu đen, đậu đỏ, đậu gà | Nhiều chất xơ, ăn cùng gạo |
| Trứng, sữa (nếu ăn chay có trứng sữa) | Chất lượng đạm cao |
| Các loại hạt, bơ đậu phộng | Nhiều năng lượng, hợp khi muốn tăng cân |
| Đạm bột đậu nành, đạm đậu Hà Lan | Tiện khi khó ăn đủ |

## Vi chất cần chú ý khi ăn thuần chay

Vitamin **B12** (cần bổ sung), sắt, kẽm, canxi, i-ốt và omega-3. Nên xét nghiệm định kỳ.

:::ap-dung
Trong tab Dinh dưỡng, bật **"Chỉ món chay"** để thực đơn tự chọn món chay đủ năng lượng.
:::

:::an-toan
Ngày ăn chay (mùng 1, rằm) mà bớt đạm thì nên thêm đậu phụ, sữa đậu nành để không bị hụt đạm hôm đó. Người thiếu máu cần hỏi bác sĩ về việc bổ sung sắt.
:::` },

{ id:"dd-ruou-bia", cat:"dinh-duong", audience:"nguoi-tap", updated:U,
  title:"Rượu bia và tập luyện: ảnh hưởng thật sự đến cơ và mỡ",
  summary:"Rượu bia làm giảm tổng hợp cơ, thêm năng lượng rỗng và hại giấc ngủ. Cách ứng xử khi vẫn phải đi nhậu.",
  tags:["rượu bia","nhậu","phục hồi","giấc ngủ"],
  sources:["Parr EB, et al. Alcohol ingestion impairs maximal post-exercise rates of myofibrillar protein synthesis following a single bout of concurrent training. PLoS One 2014;9(2):e88384.",
    "Anderson BO, et al. Health and cancer risks associated with low levels of alcohol consumption. Lancet Public Health 2023;8(1):e6–e7.",
    "Quốc hội. Luật Phòng, chống tác hại của rượu, bia 2019 (Luật số 44/2019/QH14)."],
  body:`"Nhậu" là một phần trong văn hoá giao tiếp. Hiểu rõ tác động của rượu bia giúp bạn chọn cách ứng xử hợp lý.

## Tác động lên tập luyện

- **Giảm tổng hợp cơ:** nghiên cứu của Parr (2014) cho thấy uống nhiều rượu sau buổi tập làm tổng hợp protein cơ giảm khoảng 24–37 %, kể cả khi đã uống kèm đạm.
- **Năng lượng "rỗng":** mỗi gam cồn cung cấp khoảng **7 kcal**, chưa kể đồ nhắm chiên xào và nước ngọt pha.
- **Ngủ kém hơn** dù dễ ngủ, ảnh hưởng đến hồi phục hôm sau.
- **Mất nước**, càng nguy hiểm khi trời nóng.

## Không có mức uống "an toàn"

WHO châu Âu (2023) khẳng định **không có mức uống rượu bia nào an toàn** đối với nguy cơ ung thư. Uống ít hơn luôn tốt hơn.

## Nếu vẫn phải đi nhậu

1. Ăn một bữa có đạm và tinh bột trước.
2. Xen mỗi ly bia với một ly nước lọc.
3. Chọn đồ nhắm nướng, luộc, gỏi thay vì đồ chiên.
4. Không xếp buổi tập nặng vào sáng hôm sau.
5. **Đã uống rượu bia thì không lái xe.** Luật Phòng, chống tác hại của rượu, bia nghiêm cấm điều khiển phương tiện giao thông khi trong máu hoặc hơi thở có nồng độ cồn.

:::ap-dung
Ghi số ly mỗi tuần vào ghi chú. Đặt mục tiêu giảm dần, ví dụ từ 3 buổi nhậu/tuần xuống 1 buổi, rồi quan sát giấc ngủ và cân nặng thay đổi ra sao.
:::

:::an-toan
Không uống rượu bia khi đang dùng thuốc giảm đau, thuốc ngủ hoặc kháng sinh, khi mang thai, hoặc khi dưới 18 tuổi.
:::` },

/* ======================= PHỤC HỒI – GIẤC NGỦ – CHẤN THƯƠNG ======================= */
{ id:"ph-giac-ngu", cat:"phuc-hoi", audience:"ca-hai", updated:U,
  title:"Giấc ngủ: \"thực phẩm bổ sung\" miễn phí cho cơ bắp",
  summary:"Ngủ bao nhiêu là đủ, thiếu ngủ ảnh hưởng ra sao đến cơ và mỡ, và 8 thói quen giúp ngủ ngon hơn.",
  tags:["giấc ngủ","phục hồi","caffeine","thói quen"],
  sources:["Watson NF, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the AASM and Sleep Research Society. Sleep 2015;38(6):843–844.",
    "Hirshkowitz M, et al. National Sleep Foundation's sleep time duration recommendations: methodology and results summary. Sleep Health 2015;1(1):40–43.",
    "Lamon S, et al. The effect of acute sleep deprivation on skeletal muscle protein synthesis and the hormonal environment. Physiol Rep 2021;9(1):e14660.",
    "Nedeltcheva AV, et al. Insufficient sleep undermines dietary efforts to reduce adiposity. Ann Intern Med 2010;153(7):435–441.",
    "Drake C, et al. Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. J Clin Sleep Med 2013;9(11):1195–1200."],
  body:`## Ngủ bao nhiêu là đủ?

Viện Hàn lâm Y học Giấc ngủ Hoa Kỳ (AASM) khuyến nghị người trưởng thành ngủ **ít nhất 7 giờ mỗi đêm**. Quỹ Giấc ngủ Quốc gia Mỹ đưa ra khoảng **7–9 giờ** cho người 18–64 tuổi và **7–8 giờ** cho người từ 65 tuổi.

## Thiếu ngủ ảnh hưởng thế nào?

- **Cơ:** một đêm thức trắng làm tổng hợp protein cơ giảm khoảng **18 %** (Lamon, 2021).
- **Mỡ:** khi ăn kiêng mà chỉ ngủ 5,5 giờ, lượng mỡ giảm ít hơn hẳn so với ngủ 8,5 giờ (Nedeltcheva, 2010).
- **Cảm giác đói và thèm ăn** tăng, khả năng tự kiểm soát giảm.
- **Sức mạnh, sự tập trung** và hứng thú tập luyện đều đi xuống.

## 8 thói quen giúp ngủ ngon

1. Đi ngủ và thức dậy **cùng giờ**, kể cả cuối tuần.
2. Ra nắng buổi sáng 10–20 phút.
3. Ngừng cà phê, trà trước giờ ngủ **ít nhất 6 giờ**: nghiên cứu của Drake (2013) cho thấy caffeine uống 6 giờ trước khi ngủ vẫn làm giảm thời gian ngủ.
4. Phòng ngủ tối, mát, yên tĩnh.
5. Tắt màn hình 30–60 phút trước khi ngủ.
6. Không ăn quá no hay uống rượu sát giờ ngủ.
7. Tập muộn khiến khó ngủ thì dời buổi tập sớm hơn hoặc giảm cường độ.
8. Ngủ trưa ngắn 15–30 phút, trước 15 giờ.

:::ap-dung
Vào **Menu → Giấc ngủ** để ghi giờ ngủ và chất lượng giấc ngủ mỗi ngày. Sau 2 tuần, bạn sẽ thấy giấc ngủ liên quan thế nào đến những buổi tập tốt và kém.
:::

:::an-toan
Ngáy to, có lúc ngưng thở khi ngủ, buồn ngủ quá mức ban ngày có thể là dấu hiệu **ngưng thở khi ngủ**, nhất là ở người thừa cân. Hãy đi khám chuyên khoa.
:::` },

{ id:"ph-doms", cat:"phuc-hoi", audience:"ca-hai", updated:U,
  title:"Đau cơ sau tập (DOMS): bình thường đến mức nào?",
  summary:"DOMS kéo dài bao lâu, vì sao không phải thước đo hiệu quả, cách làm dịu và khi nào nên lo.",
  tags:["DOMS","đau cơ","phục hồi","người mới"],
  ex:["walking","stretch"],
  sources:[CHEUNG, DUPUY],
  body:`**DOMS** (đau cơ khởi phát muộn) là cảm giác ê ẩm cơ xuất hiện **12–24 giờ** sau buổi tập, nặng nhất trong khoảng **24–72 giờ**, rồi tự hết sau 5–7 ngày (Cheung, 2003). Tình trạng này hay gặp khi bạn mới tập, đổi sang bài mới hoặc tập nhiều pha hạ chậm.

## DOMS không phải thước đo hiệu quả

Đau nhiều không có nghĩa là cơ phát triển nhiều. Sau 1–2 buổi lặp lại, cơ thể **thích nghi** (gọi là hiệu ứng buổi tập lặp lại), nên những lần sau đau ít hơn dù bạn vẫn tiến bộ.

## Làm gì để đỡ đau?

| Cách | Hiệu quả theo tổng quan (Dupuy, 2018) |
|---|---|
| **Xoa bóp (massage)** | Giảm đau và mệt rõ nhất |
| Quần áo bó ép, ngâm nước lạnh | Có ích ở mức vừa phải |
| Vận động nhẹ: [[ex:walking]], đạp xe nhẹ | Giảm đau tạm thời |
| Giãn cơ: [[ex:stretch]] | Gần như không làm giảm DOMS |

## Có nên tập khi đang đau?

Được, nếu chỉ ê ẩm nhẹ: khởi động kỹ, tập nhẹ hơn, cơn đau thường dịu đi khi cơ ấm lên. Nếu đau đến mức đi lại khó khăn, hãy tập nhóm cơ khác hoặc chỉ vận động nhẹ.

:::ap-dung
Lần đầu tập một bài mới, chỉ làm **2 hiệp** thay vì 3–4 hiệp và để RIR 3. Tuần sau tăng dần.
:::

:::an-toan
Đau dữ dội, cơ sưng cứng, **nước tiểu màu nâu sẫm**: đi khám ngay vì có thể là tiêu cơ vân. Đọc [[kb:kt-dau-hieu-dung-tap]].
:::` },

{ id:"ph-phuc-hoi-chu-dong", cat:"phuc-hoi", audience:"ca-hai", updated:U,
  title:"Con lăn, massage, ngâm đá: phương pháp phục hồi nào đáng làm?",
  summary:"Đánh giá từng phương pháp theo bằng chứng, và vì sao ngâm nước lạnh sau mọi buổi tạ có thể làm chậm tăng cơ.",
  tags:["phục hồi","con lăn","massage","ngâm nước lạnh","foam roller"],
  ex:["stretch","walking"],
  sources:["Wiewelhove T, et al. A meta-analysis of the effects of foam rolling on performance and recovery. Front Physiol 2019;10:376.", DUPUY,
    "Roberts LA, et al. Post-exercise cold water immersion attenuates acute anabolic signalling and long-term adaptations in muscle to strength training. J Physiol 2015;593(18):4285–4301."],
  body:`Thứ tự ưu tiên khi phục hồi: **ngủ → ăn đủ → lịch tập hợp lý → các phương pháp hỗ trợ**. Phương pháp hỗ trợ giúp bạn *cảm thấy* dễ chịu hơn, nhưng không bù được cho việc thiếu ngủ.

## Đánh giá từng cách

| Phương pháp | Bằng chứng | Khi nào dùng |
|---|---|---|
| **Con lăn (foam roller)** | Giảm đau nhẹ, tăng linh hoạt ngắn hạn; ảnh hưởng đến hiệu suất rất nhỏ (Wiewelhove, 2019) | Khởi động hoặc cuối buổi, 30–60 giây mỗi vùng |
| **Massage** | Giảm DOMS và cảm giác mệt rõ nhất (Dupuy, 2018) | Sau tuần tập nặng, sau thi đấu |
| **Ngâm nước lạnh** | Giảm đau ngắn hạn; ngâm thường xuyên sau buổi tạ **làm giảm mức tăng cơ và sức mạnh** (Roberts, 2015) | Giữa hai trận đấu gần nhau; **không** dùng sau mọi buổi tạ |
| **Vận động nhẹ** | Giảm đau tạm thời, tốt cho tinh thần | Ngày nghỉ: đi bộ, đạp xe nhẹ 20–30 phút |
| **Xông hơi** | Giúp thư giãn; bằng chứng cho phục hồi cơ còn ít | Tuỳ sở thích, nhớ uống đủ nước |

## Bài con lăn đơn giản

Lăn đùi trước, đùi ngoài, bắp chân, lưng trên. Lăn chậm, dừng ở điểm căng 20–30 giây, thở đều. Không lăn trực tiếp lên lưng dưới hay lên khớp.

:::ap-dung
Thêm 5 phút con lăn và [[ex:stretch]] vào cuối buổi tập chân. Ngày nghỉ, đi bộ 30 phút.
:::

:::an-toan
Không lăn hay massage mạnh vùng đang sưng nóng, bầm tím, vừa bị chấn thương, hoặc nghi có cục máu đông (bắp chân sưng, đỏ, đau một bên). Người có bệnh tim không nên ngâm nước đá đột ngột.
:::` },

{ id:"ph-dau-lung", cat:"phuc-hoi", audience:"ca-hai", updated:U,
  title:"Đau lưng dưới khi tập: dấu hiệu nguy hiểm và lộ trình quay lại",
  summary:"Phần lớn đau lưng không nguy hiểm và cải thiện nhờ vận động. Nhận biết \"cờ đỏ\" và lộ trình 4 giai đoạn.",
  tags:["đau lưng","lưng dưới","chấn thương","phục hồi"],
  ex:["walking","deadbug","glutebridge","sideplank","gobletsquat","rdl"],
  sources:[{ t:"NICE guideline NG59. Low back pain and sciatica in over 16s: assessment and management (2016, cập nhật 2020).", u:"https://www.nice.org.uk/guidance/ng59" },
    "Hayden JA, et al. Exercise therapy for chronic low back pain. Cochrane Database Syst Rev 2021;9:CD009790."],
  body:`Đau lưng dưới rất phổ biến, kể cả ở người không tập luyện. Phần lớn là **đau không đặc hiệu**: không tìm thấy tổn thương nguy hiểm và cải thiện sau vài tuần.

## Dấu hiệu "cờ đỏ": đi khám ngay

- Tê vùng quanh hậu môn, bộ phận sinh dục; rối loạn tiểu tiện hoặc đại tiện.
- Yếu chân tăng dần, bàn chân bị rủ.
- Đau kèm sốt, sụt cân không rõ lý do, hoặc có tiền sử ung thư.
- Đau sau ngã hoặc tai nạn mạnh, đặc biệt ở người loãng xương.

## Không có cờ đỏ: vận động là một phần của điều trị

Hướng dẫn NICE (Anh) khuyến nghị **tập luyện** là một phần chính trong điều trị đau lưng dưới. Tổng quan Cochrane (Hayden, 2021) cho thấy tập luyện giúp giảm đau và cải thiện chức năng ở người đau lưng mạn tính so với không điều trị. Nằm nghỉ lâu không giúp ích.

## Lộ trình quay lại

| Giai đoạn | Việc làm |
|---|---|
| 1. Vài ngày đầu | [[ex:walking]] nhẹ nhiều lần trong ngày, tránh tư thế gây đau nhói |
| 2. Khi đã đỡ | [[ex:deadbug]], [[ex:glutebridge]], [[ex:sideplank]] thời gian ngắn, không gây đau |
| 3. Tăng tải dần | [[ex:gobletsquat]] nông, [[ex:rdl]] tạ nhẹ trong vùng không đau |
| 4. Trở lại | Tăng tạ từng chút nếu cơn đau không nặng hơn sau 24 giờ |

Đau trong lúc tập ở mức nhẹ, chịu được và không nặng hơn vào sáng hôm sau thường là chấp nhận được.

:::ap-dung
Xem lại kỹ thuật [[kb:kt-deadlift|bản lề hông]] và [[kb:kt-tho-siet-bung|siết bụng]]. Lưng thường đau khi tạ quá nặng hoặc khi mỏi khiến kỹ thuật xấu đi.
:::

:::an-toan
Bài viết không thay thế chẩn đoán. Đau quá 6 tuần không đỡ, hoặc đau lan xuống dưới gối kèm tê, yếu chân thì nên gặp bác sĩ hoặc chuyên viên vật lý trị liệu.
:::` },

{ id:"ph-dau-vai", cat:"phuc-hoi", audience:"ca-hai", updated:U,
  title:"Đau vai khi đẩy ngực, đẩy vai: điều chỉnh gì để vẫn tập được",
  summary:"Đau dưới mỏm cùng vai thường do quá tải. Bảng thay thế bài tập và các bài \"bảo dưỡng\" khớp vai.",
  tags:["đau vai","khớp vai","chóp xoay","chấn thương"],
  ex:["dbbench","pushup","dbpress","facepull","cablerow"],
  sources:["Diercks R, et al. Guideline for diagnosis and treatment of subacromial pain syndrome: a multidisciplinary review by the Dutch Orthopaedic Association. Acta Orthop 2014;85(3):314–322.",
    "Haff GG, Triplett NT (eds). Essentials of Strength Training and Conditioning, 4th ed. NSCA – Human Kinetics, 2016."],
  body:`Đau phía trước hoặc bên ngoài vai khi tập đẩy thường liên quan đến **hội chứng đau dưới mỏm cùng vai**: gân chóp xoay và túi hoạt dịch bị kích thích do quá tải. Hướng dẫn của Hội Chỉnh hình Hà Lan (Diercks, 2014) khuyến nghị **tập luyện có hướng dẫn** là phương pháp điều trị chính trong đa số trường hợp.

## Điều chỉnh để vẫn tập được

| Thay vì | Thử |
|---|---|
| Bench thanh đòn tay rộng | [[ex:dbbench]] lòng bàn tay hướng vào nhau, hoặc [[ex:pushup]] |
| Hạ thanh sâu chạm ngực | Giới hạn biên độ trong vùng không đau |
| Đẩy vai qua đầu | Tạm dừng, hoặc [[ex:dbpress]] trên ghế hơi ngả |
| Dip xà kép sâu | Tạm bỏ |
| Nhiều bài đẩy, ít bài kéo | Thêm [[ex:facepull]], [[ex:cablerow]], xoay ngoài với dây kháng lực |

## Bài tập "bảo dưỡng" vai

- Xoay ngoài khớp vai với dây kháng lực, khuỷu sát thân: 2–3 hiệp × 15 lần.
- [[ex:facepull]]: 3 hiệp × 12–15 lần.
- Nằm sấp trên ghế dốc, nâng tay hình chữ Y với tạ rất nhẹ: 2 hiệp × 10–12 lần.

:::ap-dung
Theo dõi bằng hai câu hỏi: "Trong lúc tập, đau có ở mức nhẹ không? Sáng hôm sau có nặng hơn không?" Nếu không nặng hơn thì tiếp tục, nếu nặng hơn thì giảm tải.
:::

:::an-toan
Gặp bác sĩ nếu không nâng được tay sau chấn thương, đau làm thức giấc ban đêm, yếu tay rõ, tê lan xuống bàn tay, hoặc không đỡ sau 4–6 tuần tự điều chỉnh.
:::` },

{ id:"ph-dau-goi", cat:"phuc-hoi", audience:"ca-hai", updated:U,
  title:"Đau gối trước khi squat, chạy: hội chứng đau bánh chè đùi",
  summary:"Nguyên nhân đau gối phổ biến ở người tập và người chạy. Chương trình 6–12 tuần kết hợp cơ hông và cơ đùi.",
  tags:["đau gối","bánh chè","chạy bộ","squat","chấn thương"],
  ex:["glutebridge","abduction","sideplank","legext","bwsquat","stepup"],
  sources:["Crossley KM, et al. 2016 Patellofemoral pain consensus statement from the 4th International Patellofemoral Pain Research Retreat, Manchester. Part 2. Br J Sports Med 2016;50(14):844–852.",
    "Collins NJ, et al. 2018 Consensus statement on exercise therapy and physical interventions (orthoses, taping and manual therapy) to treat patellofemoral pain. Br J Sports Med 2018;52(18):1170–1178.",
    "Heiderscheit BC, et al. Effects of step rate manipulation on joint mechanics during running. Med Sci Sports Exerc 2011;43(2):296–302."],
  body:`Đau âm ỉ quanh hoặc phía sau xương bánh chè, tăng khi squat, lên xuống cầu thang, ngồi lâu hoặc chạy xuống dốc, thường là **hội chứng đau bánh chè đùi**. Đây là nguyên nhân đau gối phổ biến ở người tập tạ và người chạy bộ.

## Điều trị chính là tập luyện

Các đồng thuận quốc tế (Crossley, 2016; Collins, 2018) cho thấy **kết hợp tập cơ hông và cơ đùi** là cách có bằng chứng tốt nhất. Băng dán hoặc lót giày có thể dùng ngắn hạn để giảm đau.

## Chương trình 6–12 tuần

| Nhóm | Bài | Liều |
|---|---|---|
| Hông | [[ex:glutebridge]], [[ex:abduction]], [[ex:sideplank]] | 3 hiệp × 10–15 lần |
| Đùi trước | [[ex:legext]] trong biên độ không đau, [[ex:bwsquat]] tới độ sâu không đau | 3 hiệp × 10–15 lần |
| Chức năng | [[ex:stepup]] bục thấp, tăng dần độ cao | 3 hiệp × 8–12 lần |

## Quản lý tải

- Tạm giảm chạy xuống dốc, nhảy, squat quá sâu khi đang đau.
- Với chạy bộ: giảm quãng đường và tăng nhẹ số bước chân mỗi phút. Nghiên cứu của Heiderscheit (2011) cho thấy cách này giảm tải lên gối.
- Tăng tải trở lại từ từ khi cơn đau đã ổn định.

:::ap-dung
Giảm độ sâu squat còn khoảng 2/3 trong 2–3 tuần, thêm bài cho hông 2 lần/tuần, rồi tăng độ sâu dần.
:::

:::an-toan
Gối sưng to, bị kẹt khớp, lỏng gối, không gập duỗi được, hoặc đau sau một cú vặn xoắn có thể là tổn thương dây chằng hay sụn chêm. Hãy đi khám.
:::` },

{ id:"ph-dau-khuyu-gan", cat:"phuc-hoi", audience:"ca-hai", updated:U,
  title:"Đau khuỷu tay và đau gân: tập thế nào để gân hồi phục",
  summary:"Gân không thích nghỉ hoàn toàn, cũng không thích tăng tải đột ngột. Kế hoạch 3 bước cho đau khuỷu tay khi tập kéo, cuốn.",
  tags:["đau khuỷu tay","gân","tennis elbow","chấn thương"],
  ex:["pullup","hammercurl","bicepcurl","farmercarry","tricepsdown"],
  sources:["Cook JL, Purdam CR. Is tendon pathology a continuum? A pathology model to explain the clinical presentation of load-induced tendinopathy. Br J Sports Med 2009;43(6):409–416.",
    "Coombes BK, Bisset L, Vicenzino B. Management of lateral elbow tendinopathy: one size does not fit all. J Orthop Sports Phys Ther 2015;45(11):938–949."],
  body:`Đau mặt ngoài khuỷu tay (hay gọi là "khuỷu tay tennis") hoặc mặt trong ("khuỷu tay golf") thường gặp khi bạn tăng đột ngột các bài kéo, cuốn tay, cầm nắm. Đây là **bệnh lý gân do quá tải**, không đơn thuần là "viêm" cấp tính.

## Gân cần tải phù hợp, không cần nghỉ hoàn toàn

Mô hình của Cook & Purdam (2009) cho thấy gân phản ứng xấu khi **tải thay đổi đột ngột**. Nghỉ hoàn toàn lại khiến gân yếu đi. Hướng xử lý đúng là **giảm tải về mức chịu được rồi tăng dần**.

## Kế hoạch 3 bước

1. **Giảm tải:** tạm bớt các bài gây đau như [[ex:pullup]] tay ngửa hay cuốn tạ nặng. Đổi cách cầm: tay trung tính với [[ex:hammercurl]], hoặc dùng dây kéo.
2. **Tập cho gân:** gồng tĩnh 5 lần × 30–45 giây (ví dụ giữ cổ tay ở tư thế ngửa với tạ nhẹ) để giảm đau. Sau đó tập cuốn cổ tay chậm 3 hiệp × 15 lần: lên 2 giây, xuống 3 giây.
3. **Trở lại:** tăng dần khối lượng bài kéo nếu cơn đau không tăng vào hôm sau.

## Theo dõi tiến triển

Coombes (2015) khuyến nghị đánh giá bằng **lực nắm không gây đau** và khả năng sinh hoạt hằng ngày. Gân thường cần **6–12 tuần hoặc lâu hơn** để hồi phục.

:::ap-dung
Trong giáo án, tạm thay [[ex:bicepcurl]] bằng [[ex:hammercurl]] và giảm 1/3 số hiệp kéo trong 2 tuần. Ghi mức đau mỗi sáng.
:::

:::an-toan
Tiêm corticoid có thể giảm đau ngắn hạn, nhưng với đau khuỷu tay ngoài, kết quả dài hạn có thể kém hơn. Hãy bàn kỹ với bác sĩ trước khi tiêm.
:::` },

{ id:"ph-qua-tai-deload", cat:"phuc-hoi", audience:"ca-hai", updated:U,
  title:"Quá tải, mệt mỏi kéo dài và tuần giảm tải (deload)",
  summary:"Phân biệt mệt có ích với quá tải, dấu hiệu cảnh báo, và cách làm một tuần giảm tải đúng nghĩa.",
  tags:["quá tải","deload","mệt mỏi","phục hồi","overtraining"],
  ex:["walking"],
  tpl:["tpl-m-ppl6","tpl-m-ul"],
  sources:["Meeusen R, et al. Prevention, diagnosis, and treatment of the overtraining syndrome: joint consensus statement of the ECSS and the ACSM. Med Sci Sports Exerc 2013;45(1):186–205.",
    "Haff GG, Triplett NT (eds). Essentials of Strength Training and Conditioning, 4th ed. NSCA – Human Kinetics, 2016."],
  body:`Tập luyện tạo ra mệt mỏi, phục hồi mới tạo ra tiến bộ. Khi mệt mỏi tích luỹ nhanh hơn khả năng phục hồi, bạn sẽ lần lượt trải qua:

| Mức | Đặc điểm | Thời gian hồi phục |
|---|---|---|
| Quá tải chức năng | Mệt vài ngày, sau đó khoẻ hơn | Vài ngày |
| Quá tải không chức năng | Hiệu suất giảm kéo dài nhiều tuần | Vài tuần |
| **Hội chứng quá tải (OTS)** | Sa sút kéo dài, rối loạn nhiều hệ cơ quan | Nhiều tháng hoặc lâu hơn |

Đồng thuận ECSS/ACSM (Meeusen, 2013) cho thấy hội chứng quá tải thật sự hiếm gặp ở người tập phong trào. Nguyên nhân hay gặp hơn là **ngủ ít, ăn thiếu, căng thẳng công việc** cộng thêm tập nhiều.

## Dấu hiệu cảnh báo

- Sức mạnh giảm từ 2 tuần trở lên dù vẫn ngủ đủ.
- Nhịp tim lúc nghỉ buổi sáng cao hơn bình thường nhiều ngày liền.
- Mất hứng tập, cáu gắt, khó ngủ.
- Đau khớp, đau gân lặt vặt ở nhiều chỗ.
- Hay ốm vặt.

## Tuần giảm tải (deload)

- Giảm **30–50 % số hiệp**, giữ nguyên hoặc giảm nhẹ mức tạ, dừng ở RIR 3–4.
- Thường làm sau 4–8 tuần tập nặng, hoặc khi có các dấu hiệu trên.
- Tuần bận, ốm, đi công tác có thể coi luôn là tuần giảm tải.

:::ap-dung
Mỗi sáng ghi 3 thứ: số giờ ngủ, mức mệt (1–5), mức đau nhức (1–5). Nếu 2 trong 3 chỉ số xấu đi 3 ngày liền, buổi kế tiếp hãy tập nhẹ.
:::

:::an-toan
Mệt mỏi kéo dài kèm sụt cân, hồi hộp, khó thở, chóng mặt hoặc mất kinh (ở nữ) cần đi khám để loại trừ thiếu máu, bệnh tuyến giáp hay tình trạng thiếu năng lượng tương đối (REDs).
:::` }
);
})();

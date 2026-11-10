/* =========================================================================
   FIT KIT — Cơ sở dữ liệu món ăn healthy (Việt & Âu) + thực phẩm bổ sung
   · Calo/macro mỗi 100 g lấy theo USDA FoodData Central (giá trị làm tròn, ước lượng)
   · Mỗi món có: nguyên liệu (gram), cách nấu gần gũi (nồi chiên không dầu, luộc, hấp,
     áp chảo, nồi cơm điện, không cần nấu), các bước làm và mẹo cho người tập.
   Nạp SAU data.js, TRƯỚC nutrition.js.
   ========================================================================= */

/* ---------- Thực phẩm bổ sung ---------- */
FOODS.push(
  { id:"ca-thu", name:"Cá thu (nướng)", kcal:262, protein:24, carbs:0, fat:18 },
  { id:"muc", name:"Mực (hấp)", kcal:92, protein:15.6, carbs:3.1, fat:1.4 },
  { id:"thit-bo-xay", name:"Bò xay nạc 90% (chín)", kcal:217, protein:26, carbs:0, fat:12 },
  { id:"dui-ga-bo-da", name:"Đùi gà bỏ da (chín)", kcal:177, protein:24, carbs:0, fat:8 },
  { id:"trung-trang", name:"Lòng trắng trứng", kcal:52, protein:11, carbs:0.7, fat:0.2 },
  { id:"banh-trang", name:"Bánh tráng (khô)", kcal:340, protein:6, carbs:78, fat:0.5 },
  { id:"mi-y-nguyen-cam", name:"Mì Ý nguyên cám (đã nấu)", kcal:149, protein:6, carbs:30, fat:1.7 },
  { id:"banh-mi-nguyen-cam", name:"Bánh mì nguyên cám", kcal:252, protein:12.4, carbs:43, fat:3.5 },
  { id:"tortilla", name:"Bánh tortilla nguyên cám", kcal:300, protein:9, carbs:50, fat:7 },
  { id:"quinoa", name:"Hạt diêm mạch Quinoa (đã nấu)", kcal:120, protein:4.4, carbs:21, fat:1.9 },
  { id:"granola", name:"Granola", kcal:471, protein:10, carbs:64, fat:20 },
  { id:"hat-chia", name:"Hạt chia", kcal:486, protein:17, carbs:42, fat:31 },
  { id:"whey", name:"Whey protein (bột)", kcal:400, protein:80, carbs:8, fat:6 },
  { id:"nam", name:"Nấm (rơm, đùi gà, kim châm)", kcal:22, protein:3.1, carbs:3.3, fat:0.3 },
  { id:"dau-que", name:"Đậu que", kcal:31, protein:1.8, carbs:7, fat:0.2 },
  { id:"cai-thia", name:"Cải thìa", kcal:13, protein:1.5, carbs:2.2, fat:0.2 },
  { id:"bi-do", name:"Bí đỏ", kcal:26, protein:1, carbs:6.5, fat:0.1 },
  { id:"ca-rot", name:"Cà rốt", kcal:41, protein:0.9, carbs:9.6, fat:0.2 },
  { id:"hanh-tay", name:"Hành tây", kcal:40, protein:1.1, carbs:9.3, fat:0.1 },
  { id:"ot-chuong", name:"Ớt chuông", kcal:26, protein:1, carbs:6, fat:0.3 },
  { id:"mang-tay", name:"Măng tây", kcal:20, protein:2.2, carbs:3.9, fat:0.1 },
  { id:"cai-bo-xoi", name:"Cải bó xôi (rau bina)", kcal:23, protein:2.9, carbs:3.6, fat:0.4 },
  { id:"rau-thom", name:"Rau thơm các loại", kcal:25, protein:2.5, carbs:4, fat:0.5 },
  { id:"gia-do", name:"Giá đỗ", kcal:30, protein:3, carbs:6, fat:0.2 },
  { id:"dau-tay", name:"Dâu tây", kcal:32, protein:0.7, carbs:7.7, fat:0.3 },
  { id:"viet-quat", name:"Việt quất", kcal:57, protein:0.7, carbs:14, fat:0.3 },
  { id:"xoai", name:"Xoài", kcal:60, protein:0.8, carbs:15, fat:0.4 },
  { id:"dua-hau", name:"Dưa hấu", kcal:30, protein:0.6, carbs:7.6, fat:0.2 },
  { id:"thit-heo-xay", name:"Thịt heo xay nạc (chín)", kcal:200, protein:25, carbs:0, fat:11 },
);

/* ---------- Cách nấu ---------- */
const COOK_METHODS = {
  airfryer: { label:"Nồi chiên không dầu", icon:"mode_fan" },
  boil:     { label:"Luộc / Nấu", icon:"soup_kitchen" },
  steam:    { label:"Hấp", icon:"cloud" },
  pan:      { label:"Áp chảo chống dính", icon:"skillet" },
  ricecooker:{ label:"Nồi cơm điện", icon:"rice_bowl" },
  nocook:   { label:"Không cần nấu", icon:"nutrition" },
  blender:  { label:"Máy xay sinh tố", icon:"blender" },
};

/* ---------- Món ăn ----------
   cuisine: "vn" | "au" · meal: breakfast | lunch | dinner | snack
   tags: giam-mo · tang-co · chay · an-vat
   items: [mã thực phẩm, gram] cho 1 khẩu phần chuẩn */
const RECIPES = [
  /* ===================== MÓN VIỆT ===================== */
  { id:"ga-sa-ot-af", name:"Ức gà sả ớt nồi chiên không dầu, cơm lứt, dưa leo", emoji:"🍗", cuisine:"vn", method:"airfryer", min:25, level:1, tags:["giam-mo","tang-co"], meal:"lunch",
    items:[["uc-ga",150],["com-gao-lut",150],["dua-leo",80],["dau-oliu",5]],
    steps:["Ức gà khứa vài đường, ướp 15 phút với sả băm, ớt, tỏi, 1 thìa nước mắm, ít tiêu và 1 thìa cà phê dầu ô liu.",
      "Làm nóng nồi chiên không dầu 180°C trong 3 phút.",
      "Cho gà vào, nướng 180°C trong 12 phút, lật mặt, nướng tiếp 6–8 phút đến khi thịt chín (bên trong không còn hồng).",
      "Để gà nghỉ 3 phút rồi thái lát, ăn cùng cơm gạo lứt và dưa leo."],
    tip:"Nấu sẵn 3–4 miếng ức gà cho 2 ngày, bảo quản tủ lạnh — meal prep tiết kiệm thời gian." },
  { id:"goi-cuon", name:"Gỏi cuốn tôm thịt", emoji:"🥢", cuisine:"vn", method:"boil", min:30, level:2, tags:["giam-mo","an-vat"], meal:"lunch",
    items:[["banh-trang",30],["tom-luoc",100],["thit-heo-nac",50],["bun-pho",80],["xa-lach",40],["rau-thom",20]],
    steps:["Luộc thịt heo nạc 20 phút, thái mỏng. Luộc tôm 3 phút, bóc vỏ, chẻ đôi.",
      "Nhúng bánh tráng qua nước ấm, trải ra đĩa.",
      "Xếp xà lách, rau thơm, bún, thịt rồi đặt tôm lên trên cùng, cuộn chặt tay.",
      "Chấm nước mắm chua ngọt pha loãng hoặc tương đen ít đường."],
    tip:"Ăn 3–4 cuốn là một bữa nhẹ ~400 kcal, nhiều đạm, gần như không dầu mỡ." },
  { id:"pho-bo-nac", name:"Phở bò tái nạc", emoji:"🍜", cuisine:"vn", method:"boil", min:20, level:1, tags:["giam-mo"], meal:"breakfast",
    items:[["bun-pho",200],["thit-bo-nac",100],["hanh-tay",30],["rau-thom",20],["gia-do",50]],
    steps:["Đun nước dùng phở (xương hầm sẵn hoặc gói gia vị phở ít muối).",
      "Trụng bánh phở và giá qua nước sôi, cho vào tô.",
      "Xếp thịt bò nạc thái thật mỏng lên trên, chan nước dùng đang sôi để thịt tái.",
      "Thêm hành tây, rau thơm, chanh, ớt."],
    tip:"Bỏ váng mỡ trên nước dùng và hạn chế tương đen, tương ớt để giảm đường và muối." },
  { id:"bun-ga-xe", name:"Bún gà xé rau thơm", emoji:"🍲", cuisine:"vn", method:"boil", min:30, level:1, tags:["giam-mo"], meal:"lunch",
    items:[["bun-pho",180],["uc-ga",120],["rau-thom",30],["gia-do",50],["hanh-tay",20]],
    steps:["Luộc ức gà với gừng, hành 15–18 phút, vớt ra để nguội rồi xé sợi.",
      "Dùng nước luộc gà nêm nhẹ làm nước dùng.",
      "Cho bún, giá, gà xé, hành tây và rau thơm vào tô, chan nước dùng."],
    tip:"Nước luộc gà đã vớt mỡ gần như không có calo — dùng làm canh rất tốt." },
  { id:"ca-basa-kho", name:"Cá basa kho tộ ít dầu, cơm lứt, rau muống", emoji:"🐟", cuisine:"vn", method:"pan", min:35, level:2, tags:["giam-mo"], meal:"dinner",
    items:[["ca-basa",150],["com-gao-lut",150],["rau-muong",120]],
    steps:["Cá cắt khúc, ướp 15 phút với nước mắm, tiêu, hành tím, 1 thìa cà phê đường thắng (nước màu).",
      "Cho cá vào nồi đất hoặc chảo chống dính, thêm nước xâm xấp, kho lửa nhỏ 20 phút (không cần dầu).",
      "Rau muống luộc hoặc xào với tỏi và rất ít dầu.",
      "Ăn kèm cơm gạo lứt."],
    tip:"Lóc bỏ phần mỡ vàng ở bụng cá basa để giảm chất béo." },
  { id:"canh-bi-do", name:"Canh bí đỏ thịt bằm, cơm, trứng luộc", emoji:"🎃", cuisine:"vn", method:"boil", min:25, level:1, tags:["tang-co"], meal:"dinner",
    items:[["bi-do",200],["thit-heo-xay",80],["com-trang",180],["trung-ga",50]],
    steps:["Phi thơm hành với vài giọt dầu, cho thịt heo xay vào xào săn.",
      "Thêm 600 ml nước, đun sôi rồi cho bí đỏ cắt miếng vào, nấu 10–12 phút đến khi bí mềm.",
      "Nêm nhẹ muối, thêm hành lá. Ăn cùng cơm và 1 quả trứng luộc."],
    tip:"Bữa no, dễ ăn — phù hợp người gầy cần tăng calo mà không ngấy." },
  { id:"dau-hu-sot-ca", name:"Đậu hũ sốt cà, cơm lứt, rau muống", emoji:"🍅", cuisine:"vn", method:"pan", min:25, level:2, tags:["chay","giam-mo"], meal:"dinner",
    items:[["dau-hu",200],["ca-chua",100],["com-gao-lut",150],["rau-muong",100]],
    steps:["Đậu hũ cắt miếng, chiên bằng nồi chiên không dầu 200°C trong 12 phút (hoặc áp chảo ít dầu) cho vàng mặt.",
      "Phi tỏi, cho cà chua băm vào đảo đến khi sệt, nêm nước tương/muối.",
      "Cho đậu vào rim với sốt 5 phút, rắc hành lá. Ăn cùng cơm lứt và rau muống luộc."],
    tip:"Đậu hũ là nguồn đạm thực vật rẻ — 200 g cho ~16 g đạm." },
  { id:"ca-thu-af", name:"Cá thu nướng nồi chiên không dầu, khoai lang, cải thìa", emoji:"🐠", cuisine:"vn", method:"airfryer", min:25, level:1, tags:["tang-co"], meal:"dinner",
    items:[["ca-thu",130],["khoai-lang",200],["cai-thia",150]],
    steps:["Cá thu rửa với nước muối loãng, thấm khô, ướp muối tiêu, gừng 10 phút.",
      "Lót giấy nến, nướng cá 190°C 15 phút, lật mặt nướng thêm 5 phút.",
      "Khoai lang luộc hoặc nướng chung (200°C, 20 phút).",
      "Cải thìa luộc hoặc hấp 3 phút."],
    tip:"Cá thu giàu omega-3 tốt cho tim mạch và phục hồi cơ sau tập." },
  { id:"bo-xao-cai", name:"Bò xào cải thìa nấm, cơm lứt", emoji:"🥩", cuisine:"vn", method:"pan", min:20, level:2, tags:["tang-co"], meal:"dinner",
    items:[["thit-bo-nac",130],["cai-thia",150],["nam",80],["com-gao-lut",180],["dau-oliu",7]],
    steps:["Thịt bò thái mỏng ngược thớ, ướp tỏi, tiêu, 1 thìa dầu hào trong 10 phút.",
      "Chảo thật nóng với 1 thìa dầu, xào bò lửa lớn 1 phút rồi trút ra.",
      "Xào nấm và cải thìa 2–3 phút, cho bò vào đảo đều, tắt bếp.",
      "Ăn cùng cơm gạo lứt."],
    tip:"Xào bò lửa thật lớn và nhanh để thịt mềm, không bị dai." },
  { id:"chao-yen-mach-ga", name:"Cháo yến mạch ức gà nấm", emoji:"🥣", cuisine:"vn", method:"boil", min:15, level:1, tags:["giam-mo"], meal:"breakfast",
    items:[["yen-mach",50],["uc-ga",80],["nam",50],["rau-thom",10]],
    steps:["Đun 400 ml nước (hoặc nước luộc gà) đến sôi.",
      "Cho yến mạch vào, khuấy đều 5 phút đến khi sánh.",
      "Thêm ức gà luộc xé và nấm, nấu thêm 3 phút, nêm nhẹ.",
      "Rắc hành lá, tiêu, gừng thái sợi."],
    tip:"Yến mạch giữ no lâu — bữa sáng lý tưởng khi đang giảm mỡ." },
  { id:"banh-mi-trung", name:"Bánh mì trứng & dưa leo", emoji:"🥖", cuisine:"vn", method:"pan", min:10, level:1, tags:["tang-co"], meal:"breakfast",
    items:[["banh-mi",80],["trung-ga",100],["dua-leo",50]],
    steps:["Ốp la 2 quả trứng bằng chảo chống dính, chỉ cần vài giọt dầu.",
      "Kẹp trứng, dưa leo, rau thơm vào bánh mì; thêm chút nước tương."],
    tip:"Đổi sang bánh mì nguyên cám để thêm chất xơ." },
  { id:"muc-hap-gung", name:"Mực hấp gừng hành, rau luộc", emoji:"🦑", cuisine:"vn", method:"steam", min:20, level:1, tags:["giam-mo"], meal:"dinner",
    items:[["muc",200],["bong-cai-xanh",150],["com-gao-lut",100]],
    steps:["Mực làm sạch, khứa vảy rồng, cắt miếng vừa ăn.",
      "Xếp mực lên đĩa cùng gừng thái sợi, sả đập dập, hành lá.",
      "Hấp cách thủy 7–8 phút (không hấp lâu kẻo mực dai).",
      "Ăn kèm bông cải luộc, ít cơm lứt, chấm muối tiêu chanh."],
    tip:"200 g mực chỉ ~180 kcal nhưng cho hơn 30 g đạm." },
  { id:"com-ga", name:"Cơm lứt gà luộc & bông cải", emoji:"🍱", cuisine:"vn", method:"boil", min:25, level:1, tags:["giam-mo","tang-co"], meal:"lunch",
    items:[["com-gao-lut",150],["uc-ga",150],["bong-cai-xanh",100]],
    steps:["Nấu cơm gạo lứt bằng nồi cơm điện (ngâm gạo 1–2 giờ trước, nước gấp 1,5 lần gạo).",
      "Luộc ức gà với gừng 15–18 phút, thái lát.",
      "Luộc bông cải 3 phút. Chấm nước mắm gừng."],
    tip:"Bữa 'kinh điển' của người tập — dễ chia hộp mang đi làm." },
  { id:"dui-ga-mat-ong-af", name:"Đùi gà nướng mật ong nồi chiên không dầu, cơm, salad", emoji:"🍯", cuisine:"vn", method:"airfryer", min:30, level:1, tags:["tang-co"], meal:"lunch",
    items:[["dui-ga-bo-da",180],["com-trang",200],["xa-lach",60],["ca-chua",60],["mat-ong",10]],
    steps:["Đùi gà bỏ da, khứa vài đường, ướp tỏi, nước tương, 2 thìa cà phê mật ong trong 30 phút.",
      "Nướng 180°C 15 phút, lật mặt, phết thêm sốt, nướng 200°C 8–10 phút.",
      "Ăn với cơm trắng và salad xà lách cà chua."],
    tip:"Bỏ da gà giúp giảm hơn nửa lượng chất béo mà vẫn giữ vị ngon." },
  { id:"bun-bo", name:"Bún bò nạc thanh đạm", emoji:"🍜", cuisine:"vn", method:"boil", min:30, level:2, tags:["giam-mo"], meal:"lunch",
    items:[["bun-pho",200],["thit-bo-nac",100],["xa-lach",50],["ca-chua",50]],
    steps:["Hầm nước dùng với sả đập dập và xương (hoặc dùng gói gia vị bún bò ít muối).",
      "Bò nạc thái mỏng, nhúng chín trong nồi nước dùng.",
      "Cho bún vào tô, thêm bò, rau sống, chan nước dùng; hạn chế sa tế."],
    tip:"Tự nấu ở nhà giúp kiểm soát dầu điều và muối tốt hơn hàng quán." },
  { id:"tom-bap", name:"Tôm luộc & bắp", emoji:"🍤", cuisine:"vn", method:"boil", min:15, level:1, tags:["giam-mo"], meal:"lunch",
    items:[["tom-luoc",150],["bap",150],["xa-lach",50]],
    steps:["Luộc bắp 15 phút. Luộc tôm với vài lát gừng 3–4 phút đến khi đỏ.",
      "Ăn kèm xà lách, chấm muối tiêu chanh."],
    tip:"Bữa trưa nhanh, nhiều đạm, rất ít béo." },
  { id:"khoai-lang-af", name:"Khoai lang que nồi chiên không dầu", emoji:"🍠", cuisine:"vn", method:"airfryer", min:20, level:1, tags:["an-vat","chay"], meal:"snack",
    items:[["khoai-lang",150],["dau-oliu",3]],
    steps:["Khoai lang gọt vỏ, cắt que dày ~1 cm, ngâm nước 10 phút rồi thấm thật khô.",
      "Trộn với ½ thìa cà phê dầu ô liu, chút muối, ớt bột.",
      "Nướng 200°C 15–18 phút, lắc giỏ 2 lần."],
    tip:"Món ăn vặt thay khoai tây chiên — ít dầu hơn ~80%." },

  /* ===================== MÓN ÂU ===================== */
  { id:"overnight-oats", name:"Overnight oats hạt chia & việt quất", emoji:"🫐", cuisine:"au", method:"nocook", min:5, level:1, tags:["giam-mo","chay"], meal:"breakfast",
    items:[["yen-mach",50],["sua-chua-hy-lap",100],["sua-tuoi-khong-duong",120],["hat-chia",10],["viet-quat",60]],
    steps:["Trộn yến mạch, sữa tươi, sữa chua Hy Lạp và hạt chia trong hũ thủy tinh.",
      "Đậy nắp, để tủ lạnh qua đêm (ít nhất 6 giờ).",
      "Sáng ra thêm việt quất (hoặc chuối, dâu) và ăn lạnh."],
    tip:"Làm sẵn 3 hũ cho 3 ngày — bữa sáng không tốn 1 phút nào." },
  { id:"parfait", name:"Sữa chua Hy Lạp granola dâu tây", emoji:"🍓", cuisine:"au", method:"nocook", min:5, level:1, tags:["an-vat","tang-co"], meal:"snack",
    items:[["sua-chua-hy-lap",170],["granola",30],["dau-tay",80],["mat-ong",5]],
    steps:["Cho sữa chua Hy Lạp vào ly, xen kẽ lớp granola và dâu tây.",
      "Rưới chút mật ong lên trên."],
    tip:"Sữa chua Hy Lạp có gấp đôi đạm so với sữa chua thường." },
  { id:"omelette-trang", name:"Omelette lòng trắng rau bina nấm, bánh mì nguyên cám", emoji:"🍳", cuisine:"au", method:"pan", min:12, level:1, tags:["giam-mo"], meal:"breakfast",
    items:[["trung-trang",150],["trung-ga",50],["cai-bo-xoi",50],["nam",50],["banh-mi-nguyen-cam",60]],
    steps:["Đánh 4 lòng trắng + 1 quả trứng nguyên với chút muối tiêu.",
      "Áp chảo chống dính nấm và rau bina 1–2 phút.",
      "Đổ trứng vào, để lửa nhỏ đến khi mặt trứng se lại, gập đôi.",
      "Ăn với 2 lát bánh mì nguyên cám nướng."],
    tip:"Nhiều đạm, ít béo — hợp giai đoạn siết mỡ." },
  { id:"salmon-af", name:"Cá hồi nồi chiên không dầu, măng tây, quinoa", emoji:"🍣", cuisine:"au", method:"airfryer", min:20, level:1, tags:["tang-co"], meal:"dinner",
    items:[["ca-hoi",150],["mang-tay",120],["quinoa",150]],
    steps:["Cá hồi thấm khô, rắc muối, tiêu, tỏi bột, chanh.",
      "Xếp cá và măng tây (trộn vài giọt dầu) vào nồi chiên, nướng 200°C 10–12 phút.",
      "Quinoa vo sạch, nấu với nước gấp đôi 15 phút (có thể nấu bằng nồi cơm điện).",
      "Bày ra đĩa, vắt chanh."],
    tip:"Không cần lật cá — da cá hồi tự giòn trong nồi chiên." },
  { id:"chicken-salad", name:"Salad ức gà, bơ & cà chua", emoji:"🥗", cuisine:"au", method:"pan", min:15, level:1, tags:["giam-mo"], meal:"lunch",
    items:[["uc-ga",130],["xa-lach",100],["ca-chua",80],["dua-leo",60],["bo-avocado",50],["dau-oliu",7]],
    steps:["Áp chảo ức gà (hoặc dùng gà nướng nồi chiên còn lại) 5–6 phút mỗi mặt, thái lát.",
      "Trộn xà lách, cà chua, dưa leo, bơ cắt hạt lựu.",
      "Sốt: 1 thìa dầu ô liu + nước cốt chanh + mù tạt + chút mật ong.",
      "Xếp gà lên trên, rưới sốt."],
    tip:"Chất béo tốt từ bơ và dầu ô liu giúp no lâu, hấp thu vitamin tốt hơn." },
  { id:"spaghetti-bo", name:"Mì Ý nguyên cám sốt bò bằm cà chua", emoji:"🍝", cuisine:"au", method:"boil", min:30, level:2, tags:["tang-co"], meal:"lunch",
    items:[["mi-y-nguyen-cam",220],["thit-bo-xay",120],["ca-chua",150],["hanh-tay",40],["ca-rot",40]],
    steps:["Luộc mì 9–10 phút trong nước có muối, vớt ráo.",
      "Áp chảo bò xay đến khi săn, chắt bớt mỡ.",
      "Cho hành tây, cà rốt băm, cà chua vào, nấu lửa nhỏ 15 phút thành sốt; nêm muối, tiêu, lá oregano.",
      "Trộn mì với sốt, rắc chút phô mai nếu thích."],
    tip:"Món bulking ngon miệng — dễ ăn nhiều calo khi cần tăng cân." },
  { id:"wrap-ga", name:"Wrap gà nguyên cám rau củ", emoji:"🌯", cuisine:"au", method:"pan", min:15, level:1, tags:["giam-mo","tang-co"], meal:"lunch",
    items:[["tortilla",65],["uc-ga",120],["xa-lach",40],["ot-chuong",50],["sua-chua-hy-lap",40]],
    steps:["Ức gà thái sợi, áp chảo với ớt bột, tỏi bột 6–7 phút.",
      "Làm nóng bánh tortilla trên chảo khô 20 giây mỗi mặt.",
      "Phết sữa chua Hy Lạp thay mayonnaise, xếp xà lách, ớt chuông, gà, cuộn chặt."],
    tip:"Gói giấy bạc mang đi — bữa trưa văn phòng gọn nhẹ." },
  { id:"steak-khoai", name:"Bò áp chảo, khoai tây nồi chiên, bông cải", emoji:"🥩", cuisine:"au", method:"pan", min:30, level:2, tags:["tang-co"], meal:"dinner",
    items:[["thit-bo-nac",180],["khoai-tay",200],["bong-cai-xanh",120],["dau-oliu",5]],
    steps:["Khoai tây cắt múi, trộn ít dầu, muối, hương thảo; nồi chiên không dầu 200°C 20 phút.",
      "Bò để nhiệt độ phòng 20 phút, thấm khô, rắc muối tiêu.",
      "Chảo thật nóng, áp bò 2–3 phút mỗi mặt (tái vừa), nghỉ 5 phút rồi thái.",
      "Bông cải hấp 4 phút."],
    tip:"Thịt bò cung cấp sắt và kẽm — quan trọng cho người tập nặng." },
  { id:"tuna-sandwich", name:"Sandwich cá ngừ nguyên cám", emoji:"🥪", cuisine:"au", method:"nocook", min:8, level:1, tags:["giam-mo"], meal:"lunch",
    items:[["banh-mi-nguyen-cam",80],["ca-ngu",100],["sua-chua-hy-lap",40],["xa-lach",30],["ca-chua",50]],
    steps:["Trộn cá ngừ ráo nước với sữa chua Hy Lạp, tiêu, nước cốt chanh, chút hành tây băm.",
      "Kẹp cùng xà lách, cà chua giữa 2 lát bánh mì nguyên cám."],
    tip:"Thay mayonnaise bằng sữa chua Hy Lạp — giảm ~150 kcal mỗi phần." },
  { id:"salad-ca-ngu", name:"Salad cá ngừ trứng", emoji:"🥗", cuisine:"au", method:"nocook", min:15, level:1, tags:["giam-mo"], meal:"dinner",
    items:[["ca-ngu",100],["trung-ga",100],["xa-lach",80],["ca-chua",80],["dua-leo",80],["dau-oliu",7]],
    steps:["Luộc trứng 9 phút, ngâm nước lạnh, bóc vỏ, cắt múi.",
      "Trộn rau với cá ngừ, rưới dầu ô liu + giấm táo + chanh."],
    tip:"Bữa tối nhẹ, nhiều đạm, ít tinh bột." },
  { id:"ca-hoi-khoai", name:"Cá hồi áp chảo & khoai lang", emoji:"🐟", cuisine:"au", method:"pan", min:30, level:2, tags:["tang-co"], meal:"dinner",
    items:[["ca-hoi",150],["khoai-lang",200],["bong-cai-xanh",100]],
    steps:["Khoai lang hấp hoặc luộc 20 phút.",
      "Cá hồi thấm khô, áp chảo phần da xuống trước 4 phút, lật 2–3 phút.",
      "Bông cải luộc 3 phút, vắt chanh."],
    tip:"Đặt cá vào chảo khi chảo đã thật nóng để da giòn, không dính." },
  { id:"yen-mach-chuoi", name:"Yến mạch chuối bơ đậu phộng", emoji:"🥣", cuisine:"au", method:"boil", min:10, level:1, tags:["tang-co"], meal:"breakfast",
    items:[["yen-mach",50],["sua-tuoi-khong-duong",200],["chuoi",100],["bo-dau-phong",15]],
    steps:["Nấu yến mạch với sữa tươi 4–5 phút (hoặc lò vi sóng 2 phút).",
      "Thêm chuối thái lát và 1 thìa bơ đậu phộng."],
    tip:"Thêm 1 muỗng whey sau khi tắt bếp để tăng thêm 24 g đạm." },
  { id:"shake-tang-can", name:"Sinh tố tăng cân: chuối, yến mạch, bơ đậu phộng, whey", emoji:"🥤", cuisine:"au", method:"blender", min:5, level:1, tags:["tang-co"], meal:"snack",
    items:[["sua-tuoi-khong-duong",300],["chuoi",120],["yen-mach",40],["bo-dau-phong",20],["whey",30]],
    steps:["Cho tất cả vào máy xay, xay 40–60 giây đến khi mịn.",
      "Uống sau tập hoặc giữa các bữa."],
    tip:"~750 kcal trong 1 ly — cách dễ nhất để người gầy ăn đủ calo." },
  { id:"smoothie-dau", name:"Sinh tố dâu sữa chua protein", emoji:"🍓", cuisine:"au", method:"blender", min:5, level:1, tags:["giam-mo","an-vat"], meal:"snack",
    items:[["dau-tay",120],["sua-chua-khong-duong",150],["whey",20]],
    steps:["Xay dâu tây, sữa chua và whey với vài viên đá trong 30 giây."],
    tip:"Ngọt nhẹ, mát, nhiều đạm — thay trà sữa khi thèm đồ ngọt." },
  { id:"sua-chua-hat", name:"Sữa chua Hy Lạp, hạnh nhân & nho", emoji:"🍇", cuisine:"au", method:"nocook", min:5, level:1, tags:["an-vat","giam-mo"], meal:"snack",
    items:[["sua-chua-hy-lap",170],["hanh-nhan",15],["nho",80]],
    steps:["Cho sữa chua ra bát, thêm hạnh nhân và nho."],
    tip:"Ăn vặt giàu đạm, giữ no tới bữa sau." },
  { id:"edamame-tao", name:"Edamame & táo", emoji:"🍏", cuisine:"vn", method:"boil", min:5, level:1, tags:["an-vat","chay"], meal:"snack",
    items:[["dau-nanh-luoc",100],["tao",150]],
    steps:["Luộc đậu nành Nhật 5 phút với chút muối.", "Ăn kèm 1 quả táo."],
    tip:"Ăn vặt chay nhiều đạm và chất xơ." },
];

/* ---------- Phân tích cơ thể → hướng ăn ----------
   Ngưỡng BMI cho người châu Á (WHO khu vực Tây Thái Bình Dương, 2000):
   < 18,5 thiếu cân · 18,5–22,9 bình thường · 23–24,9 thừa cân · ≥ 25 béo phì */
function bodyAnalysis(p){
  const h = (p.height||0)/100, w = p.weight||0;
  const bmi = h ? w/(h*h) : 0;
  let cat, rec, color, advice;
  if(!bmi){ cat="Chưa đủ thông tin"; rec=p.goal||"maintain"; color="#9AF1DD"; advice="Nhập chiều cao, cân nặng để app gợi ý thực đơn phù hợp."; }
  else if(bmi < 18.5){ cat="Thiếu cân"; rec="gain"; color="#FFB08A"; advice="Bạn cần ăn DƯ khoảng 10–15% calo mỗi ngày, ưu tiên đạm và tinh bột tốt, kết hợp tập tạ để tăng cơ – tăng cân lành mạnh."; }
  else if(bmi < 23){ cat="Bình thường"; rec=p.goal||"maintain"; color="#5EE6C7"; advice="Cân nặng đang khoẻ mạnh. Giữ calo quanh mức duy trì để siết dáng, hoặc dư nhẹ nếu muốn tăng cơ."; }
  else if(bmi < 25){ cat="Thừa cân"; rec="lose"; color="#FFB08A"; advice="Nên ăn THÂM HỤT khoảng 15–20% calo để giảm mỡ ~0,5 kg/tuần, giữ đạm cao để không mất cơ."; }
  else { cat="Béo phì"; rec="lose"; color="#FF7A45"; advice="Nên ăn THÂM HỤT khoảng 20% calo, tăng rau và đạm nạc, đi bộ nhiều hơn. Nếu có bệnh nền, hỏi ý kiến bác sĩ trước."; }
  return { bmi: Math.round(bmi*10)/10, cat, rec, color, advice };
}

/* ---------- Tạo thực đơn theo calo mục tiêu ---------- */
const MEAL_SPLIT = { lose:{breakfast:.25,lunch:.35,dinner:.30,snack:.10}, maintain:{breakfast:.25,lunch:.35,dinner:.30,snack:.10}, gain:{breakfast:.22,lunch:.30,dinner:.28,snack:.20} };
function recipeKcal(r){ return r.items.reduce((s,[id,g])=>{ const f=FOODS.find(x=>x.id===id); return s + (f? f.kcal*g/100 : 0); }, 0); }
function scaleRecipe(r, factor){
  return Object.assign({}, r, { items: r.items.map(([id,g])=>[id, Math.max(5, Math.round(g*factor/5)*5)]), factor });
}
function buildDayPlan(p, dayIndex, prefs={}){
  const goal = p.goal || "maintain";
  const target = p.goalKcal || 2000;
  const split = MEAL_SPLIT[goal] || MEAL_SPLIT.maintain;
  const want = goal==="lose" ? "giam-mo" : goal==="gain" ? "tang-co" : null;
  const plan = {};
  Object.keys(split).forEach((meal, mi)=>{
    let pool = RECIPES.filter(r=> r.meal===meal || (meal==="snack" && r.tags.includes("an-vat")) || (meal==="breakfast" && r.meal==="snack" && goal==="gain"));
    if(prefs.cuisine && prefs.cuisine!=="all") { const f = pool.filter(r=>r.cuisine===prefs.cuisine); if(f.length) pool = f; }
    if(prefs.veg){ const f = pool.filter(r=>r.tags.includes("chay")); if(f.length) pool = f; }
    if(want){ const f = pool.filter(r=>r.tags.includes(want)); if(f.length >= 2) pool = f; }
    if(!pool.length) pool = RECIPES.filter(r=>r.meal===meal);
    const r = pool[(dayIndex*3 + mi*5) % pool.length];
    const mealTarget = target * split[meal];
    const factor = Math.min(1.8, Math.max(0.6, mealTarget / recipeKcal(r)));
    plan[meal] = scaleRecipe(r, factor);
  });
  return plan;
}

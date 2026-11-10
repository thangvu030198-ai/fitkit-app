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
  { id:"muc", name:"Mực (hấp)", kcal:115, protein:21, carbs:3.5, fat:1.5 },
  { id:"thit-bo-xay", name:"Bò xay nạc 90% (chín)", kcal:217, protein:26, carbs:0, fat:12 },
  { id:"dui-ga-bo-da", name:"Đùi gà bỏ da (chín)", kcal:177, protein:24, carbs:0, fat:8 },
  { id:"trung-trang", name:"Lòng trắng trứng", kcal:52, protein:11, carbs:0.7, fat:0.2 },
  { id:"banh-trang", name:"Bánh tráng (khô)", kcal:340, protein:6, carbs:78, fat:0.5 },
  { id:"mi-y-nguyen-cam", name:"Mì Ý nguyên cám (đã nấu)", kcal:124, protein:5.3, carbs:27, fat:0.5 },
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


/* ---------- Món Việt ăn sẵn & đồ uống (ước lượng mỗi 100 g; portion = 1 phần thường gặp) ---------- */
FOODS.push(
  { id:"pho-bo-to", name:"Phở bò (tô)", kcal:90, protein:5, carbs:12, fat:2.5, portion:500, unit:"1 tô" },
  { id:"bun-bo-hue-to", name:"Bún bò Huế (tô)", kcal:95, protein:5.5, carbs:11, fat:3, portion:550, unit:"1 tô" },
  { id:"hu-tieu-to", name:"Hủ tiếu (tô)", kcal:95, protein:5, carbs:13, fat:2.5, portion:500, unit:"1 tô" },
  { id:"mi-quang-to", name:"Mì Quảng (tô)", kcal:120, protein:6, carbs:16, fat:3.5, portion:450, unit:"1 tô" },
  { id:"bun-cha-suat", name:"Bún chả (suất)", kcal:130, protein:7, carbs:15, fat:4.5, portion:450, unit:"1 suất" },
  { id:"com-tam-suon", name:"Cơm tấm sườn bì chả (đĩa)", kcal:170, protein:8, carbs:22, fat:5.5, portion:400, unit:"1 đĩa" },
  { id:"com-van-phong", name:"Cơm văn phòng gà/thịt (hộp)", kcal:150, protein:7, carbs:20, fat:4.5, portion:450, unit:"1 hộp" },
  { id:"com-chien", name:"Cơm chiên (đĩa)", kcal:170, protein:5, carbs:24, fat:6, portion:350, unit:"1 đĩa" },
  { id:"banh-mi-thit", name:"Bánh mì thịt (ổ)", kcal:260, protein:10, carbs:33, fat:9.5, portion:200, unit:"1 ổ" },
  { id:"xoi-man", name:"Xôi mặn / xôi gà (gói)", kcal:230, protein:6, carbs:40, fat:5, portion:200, unit:"1 gói" },
  { id:"banh-cuon-dia", name:"Bánh cuốn (đĩa)", kcal:140, protein:5, carbs:22, fat:3.5, portion:300, unit:"1 đĩa" },
  { id:"banh-xeo", name:"Bánh xèo (cái)", kcal:220, protein:6, carbs:22, fat:12, portion:200, unit:"1 cái" },
  { id:"banh-bao", name:"Bánh bao nhân thịt (cái)", kcal:230, protein:8, carbs:34, fat:6.5, portion:150, unit:"1 cái" },
  { id:"chao-ga-to", name:"Cháo gà (tô)", kcal:70, protein:4.5, carbs:9, fat:1.8, portion:400, unit:"1 tô" },
  { id:"goi-cuon-san", name:"Gỏi cuốn (cuốn)", kcal:140, protein:7, carbs:20, fat:3, portion:75, unit:"1 cuốn" },
  { id:"tra-sua", name:"Trà sữa trân châu (ly)", kcal:70, protein:0.8, carbs:12, fat:2.2, portion:500, unit:"1 ly 500 ml" },
  { id:"ca-phe-sua-da", name:"Cà phê sữa đá (ly)", kcal:75, protein:1.5, carbs:13, fat:2, portion:200, unit:"1 ly" },
  { id:"nuoc-ngot", name:"Nước ngọt có ga (lon)", kcal:42, protein:0, carbs:10.6, fat:0, portion:330, unit:"1 lon" },
  { id:"bia", name:"Bia (lon)", kcal:43, protein:0.5, carbs:3.6, fat:0, portion:330, unit:"1 lon" },
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
      "Cho gà vào, nướng 180°C trong 12 phút, lật mặt, nướng tiếp 6–8 phút đến khi chín hẳn (nhiệt độ lõi ≥ 74°C, nước thịt trong).",
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


  /* ===================== MÓN CHAY & MÓN RẺ ===================== */
  { id:"dau-hu-hap-nam", name:"Đậu hũ non hấp nấm, cơm lứt, cải thìa", emoji:"🍄", cuisine:"vn", method:"steam", min:20, level:1, tags:["chay","thuan-chay","giam-mo"], meal:"dinner",
    items:[["dau-hu",250],["nam",100],["com-gao-lut",150],["cai-thia",100]],
    steps:["Đậu hũ non cắt miếng vuông, xếp ra đĩa sâu lòng, rải nấm (đùi gà, kim châm) lên trên.",
      "Rưới 2 thìa nước tương + ít dầu mè + gừng băm, hấp cách thủy 10 phút.",
      "Cải thìa luộc 2 phút. Ăn cùng cơm gạo lứt."],
    tip:"Món chay thuần, mềm, ít calo nhưng vẫn ~20 g đạm." },
  { id:"bun-chay-dau-hu", name:"Bún chay đậu hũ chiên không dầu", emoji:"🥗", cuisine:"vn", method:"airfryer", min:20, level:1, tags:["chay","thuan-chay","giam-mo"], meal:"lunch",
    items:[["bun-pho",180],["dau-hu",150],["gia-do",50],["rau-thom",30],["dua-leo",60],["bo-dau-phong",10]],
    steps:["Đậu hũ cắt thanh, nồi chiên không dầu 200°C 12–15 phút đến vàng giòn.",
      "Xếp bún, rau thơm, dưa leo, giá vào tô; thêm đậu hũ.",
      "Nước chấm: nước tương + chanh + đường ăn kiêng + tỏi ớt; rắc chút đậu phộng giã."],
    tip:"Nhiều chất xơ, đủ đạm thực vật cho bữa trưa nhẹ bụng." },
  { id:"dau-hu-nam-af", name:"Đậu hũ sốt nấm nồi chiên, cơm lứt, bông cải (tăng cơ chay)", emoji:"🍱", cuisine:"vn", method:"airfryer", min:25, level:1, tags:["chay","thuan-chay","tang-co"], meal:"dinner",
    items:[["dau-hu",300],["nam",100],["com-gao-lut",200],["bong-cai-xanh",120],["dau-oliu",5]],
    steps:["Đậu hũ ép bớt nước, cắt miếng, nướng nồi chiên không dầu 200°C 15 phút.",
      "Xào nấm với tỏi, thêm nước tương + chút nước + bột năng thành sốt sệt.",
      "Rưới sốt lên đậu, ăn cùng cơm lứt và bông cải luộc."],
    tip:"300 g đậu hũ ≈ 24 g đạm — đủ cho bữa chính của người tập ăn chay." },
  { id:"sua-dau-yen-mach", name:"Yến mạch sữa đậu nành, chuối & hạt chia", emoji:"🥣", cuisine:"au", method:"boil", min:8, level:1, tags:["chay","thuan-chay"], meal:"breakfast",
    items:[["yen-mach",50],["sua-dau-nanh",250],["chuoi",100],["hat-chia",10]],
    steps:["Nấu yến mạch với sữa đậu nành 4–5 phút (hoặc ngâm qua đêm).", "Thêm chuối thái lát và hạt chia."],
    tip:"Bữa sáng chay thuần giàu chất xơ và đạm thực vật." },
  { id:"dau-den-bowl", name:"Bowl đậu đen, cơm lứt, bơ & salsa", emoji:"🌯", cuisine:"au", method:"nocook", min:15, level:1, tags:["chay","thuan-chay","tang-co"], meal:"lunch",
    items:[["dau-den",150],["com-gao-lut",150],["bo-avocado",50],["ca-chua",80],["ot-chuong",50],["hanh-tay",20]],
    steps:["Đậu đen nấu chín (hoặc đậu hộp rửa sạch), trộn chút muối, thì là, ớt bột.",
      "Cà chua, ớt chuông, hành tây thái hạt lựu trộn chanh thành salsa.",
      "Xếp cơm lứt, đậu đen, salsa và bơ vào bát."],
    tip:"Đậu + gạo kết hợp cho đạm thực vật đầy đủ axit amin hơn." },
  { id:"quinoa-edamame", name:"Salad quinoa edamame", emoji:"🥗", cuisine:"au", method:"boil", min:20, level:1, tags:["chay","thuan-chay","giam-mo"], meal:"dinner",
    items:[["quinoa",150],["dau-nanh-luoc",100],["dua-leo",80],["ca-chua",80],["dau-oliu",7]],
    steps:["Nấu quinoa với nước gấp đôi 15 phút, để nguội.", "Luộc edamame 5 phút, bóc vỏ.", "Trộn tất cả với dầu ô liu, chanh, muối tiêu."],
    tip:"Quinoa và edamame đều là đạm thực vật chất lượng cao." },
  { id:"com-trung-rau", name:"Cơm trứng rau muống (rẻ – sinh viên)", emoji:"🍳", cuisine:"vn", method:"pan", min:15, level:1, tags:["re","tang-co","chay"], meal:"lunch",
    items:[["com-trang",200],["trung-ga",100],["rau-muong",150]],
    steps:["Chiên 2 quả trứng bằng chảo chống dính (ốp la hoặc trứng chiên hành).", "Rau muống luộc, giữ nước làm canh với chút muối, chanh.", "Ăn cùng cơm trắng."],
    tip:"Khoảng 20–25 nghìn đồng mà vẫn đủ ~17 g đạm." },
  { id:"mi-trung-rau", name:"Mì gói nâng cấp: trứng + rau", emoji:"🍜", cuisine:"vn", method:"boil", min:8, level:1, tags:["re"], meal:"lunch",
    items:[["mi-goi",75],["trung-ga",100],["cai-thia",100]],
    steps:["Luộc vắt mì 2 phút, bỏ nước đầu để giảm dầu.", "Nấu nước mới với nửa gói gia vị, đập 2 quả trứng và cải thìa vào.", "Không dùng gói dầu để giảm béo và muối."],
    tip:"Bỏ nửa gói gia vị + gói dầu: giảm ~40% muối và ~8 g béo." },
  { id:"ca-ngu-com", name:"Cơm cá ngừ hộp sốt cà (rẻ)", emoji:"🐟", cuisine:"vn", method:"pan", min:12, level:1, tags:["re","tang-co"], meal:"dinner",
    items:[["ca-ngu",120],["ca-chua",100],["com-trang",200],["dua-leo",60]],
    steps:["Phi tỏi, cho cà chua băm vào nấu sệt.", "Cho cá ngừ hộp (đã chắt dầu/nước) vào đảo 2 phút, nêm nhẹ.", "Ăn với cơm và dưa leo."],
    tip:"1 hộp cá ngừ ≈ 25 g đạm, giá rẻ, để được lâu." },
  { id:"chao-yen-mach-dau-hu", name:"Cháo yến mạch đậu hũ nấm (chay)", emoji:"🥣", cuisine:"vn", method:"boil", min:15, level:1, tags:["chay","thuan-chay","giam-mo"], meal:"breakfast",
    items:[["yen-mach",50],["dau-hu",150],["nam",60],["rau-thom",10]],
    steps:["Đun 400 ml nước, cho yến mạch vào khuấy 5 phút đến khi sánh.", "Thêm đậu hũ cắt hạt lựu và nấm, nấu 3 phút, nêm nước tương/muối.", "Rắc rau thơm, tiêu."],
    tip:"Bữa sáng chay ấm bụng, ~20 g đạm thực vật." },
  { id:"sua-dau-chuoi-hat", name:"Sữa đậu nành, chuối & hạnh nhân", emoji:"🥛", cuisine:"vn", method:"nocook", min:2, level:1, tags:["chay","thuan-chay","an-vat"], meal:"snack",
    items:[["sua-dau-nanh",300],["chuoi",100],["hanh-nhan",20]],
    steps:["Uống 1 ly sữa đậu nành không đường, ăn kèm 1 quả chuối và một nắm hạnh nhân."],
    tip:"Bữa phụ chay tiện mua ở cửa hàng tiện lợi." },
  { id:"dau-hu-trung-hap", name:"Trứng hấp đậu hũ, cơm, rau luộc", emoji:"🍳", cuisine:"vn", method:"steam", min:20, level:1, tags:["chay","tang-co","re"], meal:"lunch",
    items:[["trung-ga",100],["dau-hu",150],["com-trang",180],["rau-muong",120]],
    steps:["Đánh 2 quả trứng với đậu hũ bóp nhuyễn, chút hành lá, nước tương.", "Hấp cách thủy 12–15 phút đến khi đông.", "Ăn với cơm và rau muống luộc."],
    tip:"Rẻ, nhiều đạm (~28 g), hợp người ăn chay có trứng." },

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
  { id:"shake-tang-can", gainOnly:true, name:"Sinh tố tăng cân: chuối, yến mạch, bơ đậu phộng, whey", emoji:"🥤", cuisine:"au", method:"blender", min:5, level:1, tags:["tang-co"], meal:"snack",
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
  else { cat = bmi < 30 ? "Béo phì độ I" : "Béo phì độ II"; rec="lose"; color="#FF7A45"; advice="Nên ăn THÂM HỤT khoảng 20% calo, tăng rau và đạm nạc, đi bộ nhiều hơn. Nếu có bệnh nền, hỏi ý kiến bác sĩ trước."; }
  if(bmi && bmi >= 23) advice += " (BMI không phân biệt cơ và mỡ — người tập tạ lâu năm có thể có BMI cao dù ít mỡ.)";
  if(p.age && p.age < 18) advice = "Bạn dưới 18 tuổi: nên ăn đủ năng lượng để phát triển, không tự ăn kiêng thâm hụt — hãy hỏi ý kiến bác sĩ/chuyên gia dinh dưỡng.";
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
    if(goal!=="gain"){ const f = pool.filter(r=>!r.gainOnly); if(f.length) pool = f; }
    // xoay vòng: mỗi ngày một món khác, các bữa lệch nhau
    const r = pool[(dayIndex + mi*2) % pool.length];
    const mealTarget = target * split[meal];
    const factor = Math.min(1.4, Math.max(0.6, mealTarget / recipeKcal(r)));   // không phóng to món quá 1,4 lần
    plan[meal] = scaleRecipe(r, factor);
  });
  // Còn thiếu calo → thêm "món phụ" thực tế (sữa, chuối, yến mạch, hạt…) vào bữa phụ thay vì phóng to món chính
  const total = ()=> Object.values(plan).reduce((s,r)=> s + recipeKcal(r), 0);
  const fillers = prefs.veg ? [["sua-dau-nanh",250],["chuoi",120],["yen-mach",40],["hanh-nhan",20],["com-gao-lut",150]]
                            : [["sua-tuoi-khong-duong",250],["chuoi",120],["yen-mach",40],["trung-ga",50],["bo-dau-phong",15],["com-gao-lut",150]];
  const snack = plan.snack || plan[Object.keys(plan).pop()];
  let guard = 0;
  while(total() < target*0.95 && guard < 18){
    const f = fillers[guard % fillers.length]; guard++;
    if(total() + FOODS.find(x=>x.id===f[0]).kcal*f[1]/100 > target*1.05) continue;
    const ex = snack.items.find(([id])=>id===f[0]);
    if(ex && ex[1] >= f[1]*1.5) continue;   // không dồn quá nhiều 1 món
    if(ex) ex[1] += f[1]; else snack.items.push([f[0], f[1]]);
    snack.extra = true;
  }
  if(snack.extra && !/\+ món phụ/.test(snack.name)) snack.name = snack.name + " + món phụ";
  return plan;
}

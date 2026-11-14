/* =========================================================================
   TapEasy STORE — dữ liệu danh mục (shop-data.js)
   - Nạp TRƯỚC shop.js (nếu quên, shop.js tự nạp file này khi mở cửa hàng).
   - Ảnh: assets/shop/<slug>-<màu>-1.webp (ảnh chính) và -2.webp (mặt sau / ảnh cận),
     sinh bằng assets/shop/_build/gen_shop_images.py (Pillow). id + hex màu PHẢI khớp file đó.
   - Mã sản phẩm p_tee, p_cap, p_bottle, p_band, p_towel, p_sticker, p_bag, p_socks, p_lanyard
     và mã màu cũ (navy, teal, white, coral, black, set, mix) được GIỮ NGUYÊN → giỏ/đơn/quà cũ vẫn khớp.
   - Sửa giá/tồn kho thật trong Quản trị cửa hàng (ghi vào cloudEvents.products); file này chỉ là mặc định.
   ========================================================================= */
(function(G){
"use strict";
const C = {
  navy:  { id:"navy",  name:"Xanh navy",    hex:"#1F2B3A" },
  teal:  { id:"teal",  name:"Teal TapEasy", hex:"#12A9A0" },
  white: { id:"white", name:"Trắng",        hex:"#F1F0EC" },
  black: { id:"black", name:"Đen",          hex:"#1C1D1F" },
  ivory: { id:"ivory", name:"Ngà",          hex:"#E8E2D5" },
  sage:  { id:"sage",  name:"Xanh xám",     hex:"#8DA394" },
  mocha: { id:"mocha", name:"Nâu mocha",    hex:"#6E5A4D" },
  stone: { id:"stone", name:"Xám đá",       hex:"#8C8F93" },
  olive: { id:"olive", name:"Xanh rêu",     hex:"#5B6250" },
  coral: { id:"coral", name:"Cam san hô",   hex:"#E9774C" },
  sand:  { id:"sand",  name:"Be cát",       hex:"#CBBDA4" },
};
/* Tồn kho theo biến thể (màu|size): phân bổ theo size phổ biến; một vài size hết để minh hoạ trạng thái */
const SIZE_W = { XS:0.6, S:1, M:1.4, L:1.2, XL:0.8, XXL:0.5, "35–39":1, "40–44":1 };
function stockBy(colors, sizes, base, out){
  const m = {}; out = out || [];
  colors.forEach((c, ci)=>{
    if(!sizes.length){ m[c.id + "|"] = Math.max(0, Math.round(base * (1 - ci * 0.15))); return; }
    sizes.forEach(z=>{ m[c.id + "|" + z] = out.includes(c.id + "|" + z) ? 0 : Math.max(1, Math.round(base * (SIZE_W[z] || 1) * (1 - ci * 0.12))); });
  });
  return m;
}
const P = [];
function add(p){
  p.stockBy = stockBy(p.colors, p.sizes || [], p._base || 10, p._out);
  p.stock = Object.values(p.stockBy).reduce((a, b)=> a + b, 0);
  delete p._base; delete p._out;
  p.demo = true;                 // R3-ADMIN-01: sản phẩm MẪU — shop.js không bán / không hiện cho khách như hàng thật
  P.push(p);
}

/* ---------------- NAM / UNISEX ---------------- */
add({ id:"p_tee", slug:"tee", name:"Áo thun Dry-fit Easy", short:"Thun lạnh 160 gsm, thoát ẩm nhanh", type:"Áo", cat:"wear", gender:"unisex",
  price:249000, compareAt:299000, badge:"Bán chạy", rank:1, colors:[C.navy, C.teal, C.white], sizes:["S","M","L","XL","XXL"], _base:6, _out:["white|XXL"],
  sizeChart:"top", fit:"Dáng regular, đúng size. Thích mặc rộng → tăng 1 size.",
  desc:"Chiếc áo bạn sẽ mặc nhiều nhất: vải thun lạnh nhẹ, mặt trong mịn, khô nhanh sau buổi tập. Logo TapEasy in nhỏ trước ngực, chữ TapEasy sau lưng.",
  material:"88% polyester tái chế · 12% spandex, 160 gsm, co giãn 4 chiều. In chuyển nhiệt không bong tróc.",
  care:"Giặt máy nước lạnh (≤ 30 °C), lộn trái, không dùng thuốc tẩy, không sấy nóng, phơi trong bóng râm.",
  details:["Cổ tròn bo rib 1,5 cm","Đường may phẳng ở vai, không cấn khi đeo balo","Nhãn in ở cổ — không ngứa gáy"], related:["p_short","p_cap","p_socks","p_bottle"] });
add({ id:"p_short", slug:"short", name:"Quần short chạy 2 lớp 5\"", short:"Lớp lót bó, túi khoá kéo sau", type:"Quần", cat:"wear", gender:"men",
  price:299000, rank:4, colors:[C.black, C.navy, C.stone], sizes:["S","M","L","XL","XXL"], _base:5, _out:["stone|S"],
  sizeChart:"mbottom", fit:"Ống 5 inch (12,7 cm), lưng thun có dây rút. Đúng size.",
  desc:"Quần short hai lớp: lớp ngoài vải dù siêu nhẹ, lớp lót bó chống cọ xát đùi khi chạy hoặc tập chân. Túi khoá kéo sau lưng vừa điện thoại 6,7\".",
  material:"Lớp ngoài 100% polyester dù nhẹ 85 gsm, chống thấm nhẹ · Lớp lót 84% nylon 16% spandex.",
  care:"Giặt máy nước lạnh, không dùng nước xả vải (giữ khả năng thoát ẩm), phơi khô tự nhiên.",
  details:["Xẻ tà hai bên, bước chạy thoải mái","Túi khoá kéo sau lưng","Logo phản quang ở ống trái"], related:["p_tee","p_jacket","p_socks","p_towel"] });
add({ id:"p_jacket", slug:"jacket", name:"Áo khoác gió siêu nhẹ", short:"190 g, cản gió, gấp gọn vào túi", type:"Áo khoác", cat:"wear", gender:"unisex",
  price:590000, badge:"Mới", isNew:true, rank:2, colors:[C.black, C.olive, C.ivory], sizes:["S","M","L","XL"], _base:4,
  sizeChart:"outer", fit:"Dáng regular, đủ rộng để mặc ngoài áo thun. Đúng size.",
  desc:"Áo khoác gió cho buổi chạy sáng sớm và tối muộn: cản gió, chống thấm nhẹ, nặng chỉ 190 g. Cổ đứng, gấu có dây rút, khe thông gió sau lưng.",
  material:"100% nylon ripstop 20D phủ chống thấm nhẹ (DWR không PFC). Bo tay thun.",
  care:"Giặt tay hoặc giặt máy chế độ nhẹ, kéo khoá trước khi giặt, không ủi, không sấy.",
  details:["Khoá kéo 2 chiều cổ đứng","Túi ngực khoá kéo","Khe thông gió lưng · gấu dây rút"], related:["p_tee","p_short","p_cap","p_bag"] });
add({ id:"p_socks", slug:"socks", name:"Tất thể thao cổ trung (2 đôi)", short:"Đệm gót và mũi, chống trượt", type:"Tất", cat:"wear", gender:"unisex",
  price:79000, rank:9, colors:[C.white, C.black], sizes:["35–39","40–44"], _base:30,
  sizeChart:"socks", fit:"Cổ trung (ngang bắp chân dưới). Chọn theo chiều dài bàn chân.",
  desc:"Combo 2 đôi tất cổ trung, đệm dày ở gót và mũi, bo cổ chống tuột, hai sọc teal TapEasy.",
  material:"75% cotton chải kỹ · 22% polyester · 3% spandex.",
  care:"Giặt máy, không sấy nóng.", details:["Đệm gót và mũi","Vòm ôm lòng bàn chân","Combo 2 đôi cùng màu"], related:["p_tee","p_short","p_legging","p_towel"] });

/* ---------------- NỮ ---------------- */
add({ id:"p_legging", slug:"legging", name:"Legging cạp cao 7/8", short:"Không lộ khi squat, túi sau lưng", type:"Quần", cat:"wear", gender:"women",
  price:389000, badge:"Bán chạy", rank:3, colors:[C.black, C.navy, C.mocha], sizes:["XS","S","M","L","XL"], _base:5, _out:["mocha|XS"],
  sizeChart:"wbottom", fit:"Ôm vừa (compression nhẹ), cạp cao 10 cm. Giữa 2 size → chọn size lớn.",
  desc:"Legging cạp cao giữ form khi squat, deadlift hay yoga. Vải dày vừa, không lộ khi gập người; túi nhỏ sau cạp vừa thẻ và chìa khoá.",
  material:"75% nylon · 25% spandex, 240 gsm, mặt vải mờ, thoát ẩm.",
  care:"Giặt máy nước lạnh, lộn trái, không dùng nước xả vải, không sấy.",
  details:["Đã thử squat — không lộ","Đường may phẳng chống cọ xát","Dài 7/8 (trên mắt cá)"], related:["p_bra","p_tank","p_towel","p_bottle"] });
add({ id:"p_bra", slug:"bra", name:"Áo bra hỗ trợ vừa", short:"Dây chéo lưng, mút tháo rời", type:"Áo", cat:"wear", gender:"women",
  price:319000, badge:"Mới", isNew:true, rank:5, colors:[C.black, C.mocha], sizes:["XS","S","M","L"], _base:5,
  sizeChart:"wtop", fit:"Hỗ trợ vừa — hợp gym, pilates, chạy nhẹ. Chọn theo vòng chân ngực.",
  desc:"Áo bra dây chéo lưng, cổ tròn khoét vừa, đai chân ngực in chữ TapEasy. Mút mỏng tháo rời được.",
  material:"78% nylon · 22% spandex; mút tháo rời.", care:"Giặt tay hoặc túi giặt, nước lạnh; tháo mút trước khi giặt.",
  details:["Dây chéo lưng","Đai chân ngực 4 cm","Mút tháo rời"], related:["p_legging","p_tank","p_bottle","p_towel"] });
add({ id:"p_tank", slug:"tank", name:"Tank top racerback", short:"Lưng chữ Y, thoáng khi tập nặng", type:"Áo", cat:"wear", gender:"women",
  price:229000, badge:"Mới", isNew:true, rank:6, colors:[C.black, C.sage, C.ivory], sizes:["XS","S","M","L"], _base:5,
  sizeChart:"wtop", fit:"Dáng ôm nhẹ, dài qua hông. Đúng size.",
  desc:"Tank top lưng chữ Y giải phóng bả vai khi đẩy, kéo, chèo. Vải gân mỏng, mát, ráo mồ hôi nhanh.",
  material:"92% modal gân · 8% spandex, 180 gsm.", care:"Giặt máy nước lạnh, phơi ngang để giữ form.",
  details:["Lưng racerback","Viền bọc mềm","Logo thêu nhỏ trước ngực"], related:["p_legging","p_bra","p_cap","p_bottle"] });

/* ---------------- PHỤ KIỆN ---------------- */
add({ id:"p_cap", slug:"cap", name:"Mũ lưỡi trai 6 mảnh", short:"Logo thêu nổi, quai chỉnh cỡ", type:"Mũ", cat:"wear", gender:"acc",
  price:159000, rank:7, colors:[C.navy, C.coral, C.black], sizes:[], _base:20,
  sizeChart:"", fit:"Một cỡ, quai sau chỉnh 54–60 cm.",
  desc:"Mũ 6 mảnh dáng thấp, lưỡi cong vừa, logo TapEasy thêu nổi trước trán. Che nắng khi chạy bộ, đi bộ, picnic.",
  material:"Vải cotton twill dày, lỗ thoáng khí thêu, quai sau khoá kim loại.", care:"Giặt tay nhẹ, không vắt, phơi trên khuôn tròn.",
  details:["Logo thêu nổi","Lỗ thoáng khí","Quai sau khoá kim loại"], related:["p_tee","p_jacket","p_bottle","p_lanyard"] });
add({ id:"p_bottle", slug:"bottle", name:"Bình nước 750 ml", short:"Vạch uống theo giờ 8:00 → 18:00", type:"Bình nước", cat:"gear", gender:"acc",
  price:149000, badge:"Mới", isNew:true, rank:8, colors:[C.teal, C.navy, C.coral], sizes:[], _base:30,
  sizeChart:"", fit:"750 ml · cao 26 cm · đường kính 7,4 cm, vừa hộc bình xe đạp.",
  desc:"Bình uống nước có vạch nhắc theo giờ ở mặt sau — uống đều cả ngày, đủ 2 lít chỉ với 3 lần đổ đầy. Nắp có quai xách.",
  material:"Nhựa Tritan™ không BPA, nắp PP, gioăng silicone thực phẩm.", care:"Rửa tay bằng nước ấm; không dùng máy rửa bát, không đựng nước sôi.",
  details:["Vạch giờ 8:00 → 18:00","Nắp vặn chống rò, có quai","Không BPA"], related:["p_towel","p_bag","p_band","p_tee"] });
add({ id:"p_bag", slug:"bag", name:"Túi gym dây rút", short:"Ngăn giày lưới riêng, túi khoá ngoài", type:"Túi", cat:"gear", gender:"acc",
  price:199000, rank:10, colors:[C.navy, C.black, C.sand], sizes:[], _base:15,
  sizeChart:"", fit:"45 × 35 cm, dung tích ~18 lít.",
  desc:"Túi dây rút gọn nhẹ cho buổi tập sau giờ làm: ngăn giày lưới thoáng ở đáy, túi khoá kéo ngoài cho điện thoại và ví.",
  material:"Polyester 600D chống thấm nhẹ, ngăn lưới thoáng khí, góc gia cố.", care:"Giặt tay, phơi khô tự nhiên.",
  details:["Ngăn giày lưới riêng","Túi khoá kéo ngoài","Dây rút êm vai"], related:["p_towel","p_bottle","p_band","p_socks"] });
add({ id:"p_band", slug:"band", name:"Bộ dây kháng lực mini (3 mức)", short:"Nhẹ · Vừa · Nặng — kèm 12 bài khởi động", type:"Dụng cụ", cat:"gear", gender:"acc",
  price:129000, rank:11, colors:[{ id:"set", name:"Bộ màu TapEasy", hex:"#33C4B9" }, { id:"earth", name:"Bộ màu trung tính", hex:"#93A897" }], sizes:[], _base:25,
  sizeChart:"", fit:"Vòng 60 × 5 cm. Kháng lực ~5 / 10 / 15 kg.",
  desc:"Ba vòng kháng lực cho khởi động mông, vai và phục hồi. Kèm túi đựng và thẻ hướng dẫn 12 bài khởi động 5 phút.",
  material:"Cao su latex tự nhiên dày 1,2 mm.", care:"Tránh nắng gắt, lau khô sau khi dùng. Người dị ứng latex không nên dùng.",
  details:["3 mức kháng lực","Kèm túi đựng","Thẻ 12 bài khởi động"], related:["p_bottle","p_towel","p_legging","p_bag"] });
add({ id:"p_towel", slug:"towel", name:"Khăn tập microfiber", short:"30 × 90 cm, khô nhanh, túi khoá nhỏ", type:"Khăn", cat:"gear", gender:"acc",
  price:89000, rank:12, colors:[C.navy, C.teal, C.stone], sizes:[], _base:30,
  sizeChart:"", fit:"30 × 90 cm.",
  desc:"Khăn sợi microfiber thấm hút gấp 3 lần cotton, khô nhanh, có túi khoá nhỏ ở góc đựng chìa khoá tủ đồ.",
  material:"80% polyester · 20% polyamide microfiber.", care:"Giặt máy, không dùng nước xả vải.",
  details:["Thấm nhanh, khô nhanh","Túi khoá ở góc","Logo thêu"], related:["p_bottle","p_bag","p_band","p_socks"] });
add({ id:"p_sticker", slug:"sticker", name:"Bộ sticker TapEasy (12 miếng)", short:"Chống nước, dán bình và laptop", type:"Lưu niệm", cat:"souvenir", gender:"acc",
  price:39000, rank:14, colors:[{ id:"mix", name:"Nhiều màu", hex:"#E9774C" }, { id:"mono", name:"Đen trắng", hex:"#242D33" }], sizes:[], _base:60,
  sizeChart:"", fit:"Tờ A6, 12 miếng cắt sẵn.",
  desc:"12 sticker cắt sẵn: biểu tượng TapEasy, \"Chạm là tập\", \"Tập dễ dàng\", +1 buổi, 2 lít nước… Dán bình nước, laptop, sổ tập.",
  material:"Decal vinyl cán màng mờ, chống nước.", care:"Dán lên bề mặt sạch, khô.",
  details:["12 miếng","Chống nước","Bóc không để keo"], related:["p_bottle","p_lanyard","p_cap","p_towel"] });
add({ id:"p_lanyard", slug:"lanyard", name:"Dây đeo thẻ & móc khoá", short:"In \"Tập dễ dàng · Chạm là tập\"", type:"Lưu niệm", cat:"souvenir", gender:"acc",
  price:49000, rank:13, colors:[C.teal, C.coral], sizes:[], _base:40,
  sizeChart:"", fit:"Dây bản 2 cm, dài 45 cm.",
  desc:"Dây đeo thẻ phòng tập in slogan TapEasy, móc xoay 360° và thẻ da nhỏ có biểu tượng.",
  material:"Polyester in nhiệt, móc kim loại mạ niken.", care:"Lau bằng khăn ẩm.",
  details:["Móc xoay 360°","Thẻ da nhỏ","In slogan hai mặt"], related:["p_sticker","p_cap","p_bottle","p_bag"] });

/* ---------------- BẢNG SIZE (cm, số đo CƠ THỂ trừ khi ghi "áo/quần") ---------------- */
const SIZE_CHARTS = {
  top: { title:"Áo thun unisex", cols:["Size","Vòng ngực","Ngang ngực áo","Dài áo","Chiều cao","Cân nặng"],
    rows:[["S","84–90","48","66","150–160","45–52"],["M","90–96","50","68","160–168","52–60"],["L","96–102","52","70","168–175","60–70"],["XL","102–108","54","72","175–180","70–80"],["XXL","108–114","56","74","180–188","80–90"]],
    fitKeys:{ h:4, w:5 }, how:["chest"] },
  outer: { title:"Áo khoác unisex", cols:["Size","Vòng ngực","Dài áo","Dài tay","Chiều cao","Cân nặng"],
    rows:[["S","86–92","68","60","152–162","45–55"],["M","92–98","70","61","162–170","55–64"],["L","98–104","72","62","170–177","64–74"],["XL","104–110","74","63","177–185","74–86"]],
    fitKeys:{ h:4, w:5 }, how:["chest","sleeve"] },
  mbottom: { title:"Quần short nam", cols:["Size","Vòng eo","Vòng mông","Dài quần","Chiều cao","Cân nặng"],
    rows:[["S","68–74","88–94","40","155–163","48–56"],["M","74–80","94–100","42","163–170","56–64"],["L","80–86","100–106","44","170–176","64–73"],["XL","86–92","106–112","46","176–182","73–82"],["XXL","92–98","112–118","48","182–188","82–92"]],
    fitKeys:{ h:4, w:5 }, how:["waist","hip"] },
  wtop: { title:"Áo nữ (bra · tank top)", cols:["Size","Vòng ngực","Vòng chân ngực","Chiều cao","Cân nặng"],
    rows:[["XS","76–80","63–67","148–155","38–44"],["S","80–84","67–71","153–160","44–50"],["M","84–89","71–76","158–165","50–56"],["L","89–94","76–81","163–170","56–63"]],
    fitKeys:{ h:3, w:4 }, how:["chest","underbust"] },
  wbottom: { title:"Legging nữ", cols:["Size","Vòng eo","Vòng mông","Dài trong","Chiều cao","Cân nặng"],
    rows:[["XS","58–62","82–86","61","148–155","38–44"],["S","62–66","86–90","62","153–160","44–50"],["M","66–71","90–95","63","158–165","50–56"],["L","71–76","95–100","64","163–170","56–63"],["XL","76–81","100–105","65","168–175","63–70"]],
    fitKeys:{ h:4, w:5 }, how:["waist","hip","inseam"] },
  socks: { title:"Tất", cols:["Size","Dài bàn chân","Cỡ giày VN"], rows:[["35–39","22–24,5","35–39"],["40–44","25–27,5","40–44"]], how:["foot"] },
};
const HOW = {
  chest:"Vòng ngực: vòng thước dây qua phần đầy nhất của ngực, ngang bả vai sau, giữ thước song song mặt đất.",
  underbust:"Vòng chân ngực: vòng sát ngay dưới bầu ngực, thở ra bình thường.",
  waist:"Vòng eo: chỗ nhỏ nhất của eo (trên rốn khoảng 2 cm), không hóp bụng.",
  hip:"Vòng mông: đứng chụm chân, đo qua phần đầy nhất của mông.",
  inseam:"Dài trong: từ đáy quần xuống mắt cá trong (đo trên một chiếc quần vừa ý).",
  sleeve:"Dài tay: từ đường may vai tới cổ tay, tay thả lỏng.",
  foot:"Bàn chân: đứng lên tờ giấy, đánh dấu gót và đầu ngón dài nhất, đo khoảng cách.",
};

/* R3 (14/11/2026): toàn bộ danh mục dưới đây là DỮ LIỆU MẪU (demo:true) để dựng giao diện / kiểm thử.
   Khách chỉ thấy sản phẩm do quản trị tạo hoặc "Sửa → Lưu" (demo:false) VÀ khi gian hàng được bật mở bán
   (Bảng quản trị → Cửa hàng → "Mở bán"). Giữ version = 4 để dữ liệu đã đồng bộ không bị ghi đè. */
G.TAPEASY_SHOP_DATA = {
  version: 4,
  demo: true,
  imgBase: "assets/shop/",
  products: P,
  sizeCharts: SIZE_CHARTS,
  howToMeasure: HOW,
  heroes: [
    { id:"h1", img:"hero-1.webp", imgM:"hero-1m.webp", align:"left", eyebrow:"Bộ sưu tập Thu — Đông 2026", title:"Tập dễ dàng.\nMặc nhẹ nhàng.", cta:"Khám phá", go:"new" },
    { id:"h2", img:"hero-2.webp", imgM:"hero-2m.webp", align:"right", eyebrow:"Nữ · Studio to street", title:"Ôm vừa.\nĐủ vững.", cta:"Xem đồ nữ", go:"women" },
    { id:"h3", img:"hero-3.webp", imgM:"hero-3.webp", align:"left", eyebrow:"Phụ kiện phòng tập", title:"Mang theo\nmỗi ngày.", cta:"Xem phụ kiện", go:"acc" },
  ],
  tiles: [
    { go:"men", label:"Nam", img:"jacket-black-1.webp" },
    { go:"women", label:"Nữ", img:"legging-black-1.webp" },
    { go:"acc", label:"Phụ kiện", img:"bag-sand-1.webp" },
  ],
  shipping: [
    "Giao toàn quốc. Nội thành Hà Nội, TP. Hồ Chí Minh 1–2 ngày; tỉnh/thành khác 2–5 ngày làm việc.",
    "Phí giao tiêu chuẩn 30.000 ₫ — miễn phí cho đơn từ 499.000 ₫.",
    "Hoả tốc trong ngày (nội thành Hà Nội, TP. Hồ Chí Minh, đặt trước 11:00): 45.000 ₫.",
    "COD: được kiểm tra hàng trước khi thanh toán cho người giao.",
  ],
  returns: [
    "Đổi size, đổi màu miễn phí trong 7 ngày kể từ khi nhận (sản phẩm chưa giặt, còn tem mác).",
    "Lỗi in, lỗi đường may: đổi mới hoặc hoàn tiền 100%, TapEasy chịu phí gửi lại.",
    "Tất và sticker không đổi trả vì lý do vệ sinh (trừ khi lỗi sản xuất).",
  ],
};
})(typeof window !== "undefined" ? window : globalThis);

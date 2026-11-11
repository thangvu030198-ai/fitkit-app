# Tích hợp — Dinh dưỡng Pro (`meals-extra.js` + `nutrition-pro.js` + `nutrition-pro.css`)

## 1. File mới
| File | Vai trò |
|---|---|
| `meals-extra.js` | Chỉ dữ liệu: +50 thực phẩm, cột `fiber` (g/100 g) cho **toàn bộ 148** thực phẩm, `units:[{label,g}]`, emoji sửa nhầm, +45 món, chỉnh kcal bánh mì thịt / bánh xèo / bắp. Dùng `FOODS.push` / `RECIPES.push`, nạp nhiều lần không trùng. |
| `nutrition-pro.js` | Thuật toán thực đơn mới (ghi đè `buildDayPlan`) + giao diện: Thuần chay, Đổi món, Đi chợ tuần, Gần đây & Yêu thích, chọn đơn vị, Tự tạo món, chất xơ. |
| `nutrition-pro.css` | Style riêng, tiền tố `.np-`. |
| `_test/np-plan-test.js` | Kiểm thử thuật toán: 14 hồ sơ × 7 ngày × 4 chế độ. Kết quả: `_test/np-plan-test-ketqua.txt`, bản cũ: `_test/np-plan-test-cu.txt`. |
| `_test/np-ui-test.js` + `_test/np-minidom.js` | Kiểm thử giao diện trong Node (DOM tối giản), nạp **thật** nutrition.js + 2 module. 61 bước. |

## 2. Thẻ cần thêm vào `index.html` (thứ tự)
```diff
   <link rel="stylesheet" href="style.css">
+  <link rel="stylesheet" href="nutrition-pro.css">
 ...
   <script src="meals.js"></script>
+  <script src="meals-extra.js"></script>
   <script src="nutrition.js"></script>
 ...
   <script src="pt.js"></script>
+  <script src="nutrition-pro.js"></script>
```
- Khuyên đặt `meals-extra.js` ngay sau `meals.js` (để lần render đầu đã có dữ liệu). Đặt sau `pt.js` (trước `nutrition-pro.js`) **cũng chạy đúng** — đã kiểm thử cả 2 thứ tự.
- `nutrition-pro.js` phải nạp **sau** `nutrition.js` (nên sau `pt.js`); tự render lại nếu đang mở màn Dinh dưỡng.

## 3. Thay đổi ở file khác (dạng diff)
`sw.js` — thêm vào cache và tăng phiên bản:
```diff
-const CACHE = "fitkit-v3";
-const ASSETS = [..., "./meals.js","./nutrition.js", ...];
+const CACHE = "fitkit-v4";
+const ASSETS = [..., "./meals.js","./meals-extra.js","./nutrition.js","./nutrition-pro.js","./nutrition-pro.css", ...];
```
`scripts/prepare-www.sh`:
```diff
-cp index.html style.css ... meals.js nutrition.js coach.js ...
+cp index.html style.css nutrition-pro.css ... meals.js meals-extra.js nutrition.js nutrition-pro.js coach.js ...
```
`scripts/food_sources.json` — thêm ảnh cần tạo (mục 9). Không đổi `firestore.rules` (dữ liệu nằm trong `state`).

## 4. Hàm toàn cục bị ghi đè / bọc (để agent khác tránh xung đột)
| Hàm | Cách | Ghi chú |
|---|---|---|
| `buildDayPlan(p, dayIndex, prefs)` | ghi đè (giữ bản cũ làm dự phòng khi lỗi) | `prefs`: `{cuisine, veg, vegan, swaps:{meal:recipeId}}`. Trả về `plan[meal]` như cũ + `baseItems`, `extras[{id,g,n,label}]`, `factor`; `plan._meta` không liệt kê được (an toàn với `Object.values`). |
| `nuPlanCardHTML`, `bindPlanCard` | ghi đè | Thẻ thực đơn mới (giữ nguyên phần BMI, gợi ý đổi mục tiêu, goalBlocked). |
| `openAddFood(mealId, opts)` | ghi đè | Tab Gần đây / Yêu thích / Tất cả / Tự tạo, tìm cả món có công thức. |
| `openFoodQuantity(food, mealId, preset)` | ghi đè | Chọn đơn vị + số lượng; tương thích chữ ký cũ của app.js. |
| `openRecipe(id, scaled, ctx)` | ghi đè | Thêm chất xơ, món phụ, khẩu phần ½–2, yêu thích, nút Đổi món (`ctx.fromPlan`). |
| `addRecipeToLog`, `recipeMacros`, `foodEmoji`, `renderNutritionScreen` | bọc | `recipeMacros` thêm `fiber`; `renderNutritionScreen` chèn thẻ chất xơ sau `.nu-macros`. |
| `RECIPE_TAGS` | chèn `{id:"thuan-chay"}` sau "chay" | |

API phụ: `window.NutriPro` (`buildDayPlan`, `pool`, `targets`, `planTotals`, `itemsMacros`, `ui.openShoppingList`, `ui.shoppingList`, `ui.shopText`…).

## 5. Dữ liệu lưu
`state.nutriPro` (luôn `|| {}` khi đọc, gọi `saveState()`):
```js
{ vegan:false, veg:false,                       // công tắc Thuần chay / Chỉ món chay (giữ sau khi mở lại app)
  swaps:{ "<0..6>": { sig, meals:{breakfast,lunch,dinner,snack}, changed:["lunch"] } },  // đổi món theo ngày T2..CN
  recent:[{t:"f"|"r", id, g, u?, q?, f?, ts}],  // ≤ 24 mục
  fav:["f:trung-ga","r:tempeh-sa-ot-af"],       // ≤ 60 mục
  custom:[{id:"cf-…", name, kcal, protein, carbs, fat, fiber, units:[{label,g}]}],  // giá trị /100 g
  shopPeople:1 }
```
Dòng nhật ký mới có thêm (tuỳ chọn): `foodId`, `fiber`, `unit`, `qty`, `fromPlan`. Dòng cũ không có `fiber` → ước tính từ `recipe`/tên thực phẩm.

## 6. Thuật toán thực đơn (tóm tắt)
1. Lọc món theo bữa → chế độ ăn (thuần chay = tag `thuan-chay`, không bao giờ "lùi" về món mặn) → ẩm thực → mục tiêu (`giam-mo`/`tang-co`). Người `goalBlocked` chọn món như duy trì.
2. Mỗi ngày một "cửa sổ" 4–6 ứng viên/bữa (vị trí d, d+7, d+14…) → 7 ngày ít lặp; liệt kê tổ hợp, xếp hạng nhanh, tối ưu kỹ 14–20 tổ hợp.
3. Tối ưu (leo đồi, bước 0,05): hệ số món chính **0,6–1,3** (tăng cân ≥ 0,8; > 3.000 kcal tới 1,4), mỗi bữa ≤ 700 g (người > 2.900 kcal tới 900 g); phần thiếu bù bằng **món phụ thật** theo đơn vị (1 quả trứng, 1 hũ sữa chua, ⅔ chén cơm, 1 quả chuối, 1 nắm hạnh nhân, 1 bìa đậu hũ…) có quy tắc hợp món (cơm chỉ thêm cho món ăn với cơm, không thêm khoai lang vào tô phở, không thêm táo vào món đã có táo…). Hàm sai số: calo (±3,5 %), đạm (−10 %/+13,5 %), tinh bột (±11 %), béo (±20 %), thiếu xơ, tỉ lệ calo giữa các bữa, món phụ không "lấn" món chính. Pha 2 thử bỏ từng loại món phụ để thoát cực tiểu địa phương.
4. Đổi món: khoá 4 món hiện tại, thay 1 món → chỉ tối ưu lại khẩu phần & món phụ ("giữ calo", các bữa khác giữ nguyên).

## 7. Cách thử
```bash
cd /sessions/quirky-magical-gauss/mnt/outputs/_test
node np-plan-test.js new all      # 14 hồ sơ × 7 ngày × (thường, chay, thuần chay, Việt)
node np-plan-test.js old          # thuật toán cũ để so sánh
node np-ui-test.js                # 61 bước giao diện (meals-extra nạp sau meals.js)
node np-ui-test.js late           # meals-extra nạp sau nutrition.js
```
Trang tự kiểm trong trình duyệt (đã ghép sẵn toàn bộ app + 2 module, hiện bảng PASS/FAIL): `_test/np-flow.html` (meals-extra sau meals.js) và `_test/np-flow-late.html` (meals-extra nạp muộn) — dựng lại bằng harness `build.py` (bản tại `/tmp/nutripro/`).

Thử tay: mở Dinh dưỡng → thẻ "Thực đơn gợi ý": bật 🌱 Thuần chay, bấm ⇄ ở 1 bữa, "Đi chợ tuần" → Sao chép; bấm + ở 1 bữa → tìm "trung" → chọn "1 quả" → +; "Tự tạo món".

## 8. Kết quả kiểm thử (11/11/2026)
Thuật toán — chế độ thường, 14 hồ sơ × 7 ngày (cùng bộ dữ liệu mới):

| Chỉ số | Thuật toán cũ | nutrition-pro |
|---|---|---|
| Ngày có calo trong ±5 % | 93 % (−12,9 … +14,2 %) | **96 %** (−10,4 … +2,0 %) |
| Đạm trong ±15 % | 35 % (−26 … **+103 %**) | **97 %** (−2 … +17 %) |
| Tinh bột trong ±15 % | 46 % (−40 … +50 %) | **100 %** (−12 … +6 %) |
| Béo trong ±25 % | 81 % | **100 %** |
| Chất xơ ≥ 80 % mục tiêu | 86 % | **100 %** |
| Bữa lớn nhất | 1.735 g | 705 g (≤ 2.800 kcal) · 760 g (3.166 kcal) · 900 g (4.007 kcal) |
| Số món khác nhau / tuần (28 suất) | 26,6 | 23,6 (min 19) |

Cả 4 chế độ (56 hồ sơ × 7 ngày): calo ±5 % 96 %, đạm ±15 % 96 %, tinh bột ±15 % 99 %, xơ đạt 100 %. Thời gian ~10 ms/ngày (Node). Giao diện: 61/61 bước đạt cả 2 thứ tự nạp, 0 lỗi JS; mở sheet Đổi món ~70 ms, lập danh sách đi chợ 7 ngày ~80 ms.

## 9. Ảnh cần tạo (thêm vào `scripts/food_sources.json`)
```json
{
 "foods": {
  "tempeh": "tempeh", "dau-lang": "cooked lentils bowl", "dau-ga": "chickpeas", "mi-can": "seitan",
  "dau-hu-ky": "dried tofu skin yuba", "dau-hu-non": "silken tofu", "tvp": "textured vegetable protein soy chunks",
  "dau-xanh": "mung beans", "dau-do": "adzuki red beans", "dau-phong": "roasted peanuts", "hat-dieu": "cashew nuts",
  "hat-bi": "pumpkin seeds", "me-vung": "sesame seeds", "hat-lanh": "flax seeds", "protein-thuc-vat": "plant protein powder scoop",
  "hummus": "hummus bowl", "sua-hanh-nhan": "almond milk glass", "dau-ha-lan": "green peas",
  "ca-ro-phi": "tilapia fillet", "ca-nuc": "mackerel scad fish", "trung-cut": "quail eggs", "gio-lua": "vietnamese pork sausage",
  "pho-mai-tuoi": "cottage cheese", "sua-tach-beo": "skim milk glass", "ngheu": "clams",
  "xoi-trang": "sticky rice", "mien-dong": "glass noodles", "khoai-mi": "cassava root", "banh-gao-lut": "brown rice cakes",
  "bap-cai": "cabbage", "cai-ngot": "choy sum", "mong-toi": "malabar spinach", "bi-dao": "winter melon", "muop": "luffa gourd",
  "kho-qua": "bitter melon", "ca-tim": "eggplant", "dau-bap": "okra", "sup-lo": "cauliflower", "nam-dong-co": "shiitake mushrooms",
  "su-su": "chayote", "kim-chi": "kimchi", "oi": "guava fruit", "du-du": "papaya", "thanh-long": "dragon fruit",
  "buoi": "pomelo", "dua-thom": "pineapple", "kiwi": "kiwi fruit", "nuoc-dua": "coconut water", "dau-an": "vegetable oil bottle",
  "dau-me": "sesame oil"
 },
 "recipes": {
  "tempeh-sa-ot-af": "tempeh rice bowl", "ca-ri-dau-ga": "chickpea tofu curry", "dau-lang-ham": "lentil stew",
  "mi-can-xao-sa": "seitan stir fry", "tau-hu-ky-cuon-nam": "tofu skin rolls", "bun-tron-tvp": "vegan noodle salad",
  "bowl-dau-ga-quinoa": "chickpea quinoa bowl", "yen-mach-protein-chay": "oatmeal banana seeds bowl", "banh-mi-dau-hu-chay": "tofu banh mi",
  "edamame-hat-bi": "edamame bowl", "smoothie-dam-thuc-vat": "banana peanut butter smoothie", "dau-hu-kho-nam-dong-co": "braised tofu mushrooms",
  "salad-tempeh-xoai": "tempeh mango salad", "chili-dau-do-tvp": "vegan bean chili", "com-dau-hu-sa-mong-toi": "fried tofu rice",
  "pho-chay-nam-dau-hu": "vegetarian pho", "sua-chua-oi": "yogurt guava", "trung-luoc-rau": "boiled eggs cucumber",
  "banh-gao-bo-dau-chuoi": "rice cake peanut butter banana", "pho-mai-tuoi-dua": "cottage cheese pineapple", "shake-whey-chuoi": "protein shake banana",
  "khoai-lang-trung": "sweet potato boiled egg", "banh-gao-ca-ngu": "tuna rice cake", "sinh-to-bo-yen-mach": "avocado smoothie",
  "hat-mix-tao": "mixed nuts apple", "sua-dau-banh-mi-bo-dau": "peanut butter toast soy milk", "xoi-dau-xanh-trung": "sticky rice mung bean",
  "banh-cuon-cha-lua": "banh cuon rice rolls", "chao-ca-ro-phi": "fish rice porridge", "banh-mi-ga-xe": "chicken sandwich",
  "pho-ga-nac": "chicken pho", "hu-tieu-tom-thit": "shrimp noodle soup", "khoai-lang-trung-sua-dau": "sweet potato eggs breakfast",
  "com-ca-nuc-kho": "braised fish rice", "canh-bi-dao-thit-trung": "winter melon soup rice", "dau-hu-nhoi-thit": "stuffed tofu tomato sauce",
  "ca-basa-ap-chao-nghe": "turmeric fish fillet rice", "trung-cut-kho-thit": "braised quail eggs pork", "mien-ga-nam": "glass noodle chicken soup",
  "ca-ro-phi-hap": "steamed fish soy sauce", "ngheu-hap-sa-bun": "steamed clams lemongrass", "bo-luc-lac-salad": "shaking beef salad",
  "ga-kho-gung": "ginger braised chicken", "canh-chua-ca-basa": "vietnamese sour fish soup", "kho-qua-nhoi-thit": "stuffed bitter melon soup"
 }
}
```
Chưa có ảnh → app tự dùng emoji (`f.emoji` / `r.emoji`), không vỡ giao diện.

## 10. Nội dung & nguồn số liệu
- Thực phẩm: USDA FoodData Central (SR Legacy/Foundation), món & thực phẩm Việt theo Bảng thành phần thực phẩm Việt Nam (Viện Dinh dưỡng). Chỉnh: bánh mì thịt 260 → 225 kcal/100 g (~450 kcal/ổ), bánh xèo 220 → 175 (~350 kcal/cái), bắp 96 → 110 (bắp nếp VN).
- Mục tiêu chất xơ 14 g/1.000 kcal (Institute of Medicine 2005 / Dietary Guidelines for Americans).
- 45 món mới: 16 thuần chay giàu đạm (20–44 g đạm/suất: tempeh, mì căn, tàu hũ ky, TVP, đậu lăng, đậu gà, đậu đỏ…), 12 bữa phụ (giảm mỡ & tăng cơ), 9 bữa sáng Việt, 13 món tag `re` (sinh viên), 6 món chính giàu đạm. Mì căn có cảnh báo gluten; ghi chú bổ sung B12 khi bật thuần chay.

## 11. Giới hạn / việc còn lại
- Người cần > 3.500 kcal (vd 88 kg, vận động rất nhiều, tăng cơ 4.007 kcal) còn thiếu 4–10 % calo vì giới hạn khẩu phần 900 g/bữa và trần đạm +15 % — nên thêm bữa phụ thứ 2 khi app hỗ trợ > 4 bữa.
- Thuần chay + mục tiêu đạm rất cao so với calo (1.200 kcal, 120 g đạm) có ngày thiếu đạm tới −16 %.
- Danh sách đi chợ là ước lượng (hệ số sống/chín theo USDA, gia vị không tính).
- Chưa chụp được giao diện thật: khung xem trước không mở được từ agent, sandbox không có trình duyệt. Đã kiểm tra logic bằng DOM giả lập; **cần xem lại trên màn 360 px** (thẻ thực đơn 5 ô tổng, hàng món có nút ⇄ 44 px).
- `navigator.clipboard` có thể bị chặn trong WebView cũ → đã có dự phòng `execCommand("copy")` và nút Chia sẻ.
- Ảnh thật cho 50 thực phẩm + 45 món mới cần chạy workflow `media-food.yml` sau khi thêm từ khoá ở mục 9.

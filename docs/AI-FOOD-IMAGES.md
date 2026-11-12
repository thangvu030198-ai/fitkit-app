# Ảnh món ăn AI — phong cách, thêm món, duyệt ảnh

Nguồn: `scripts/ai_food_targets.json` (244 mục, `reason`: missing / wrong / questionable / ok).
Prompt: `scripts/ai_food_prompts.json` — 159 mục (mọi mục `reason ≠ ok`): 86 thực phẩm + 73 món.
Ảnh xong được tách nền làm sticker → giữ đúng quy ước `media/food/<id>.webp` như `fetch_food_images.py`.

## 1. Phong cách chung (không sửa riêng từng món)

Mỗi `prompt` = `Professional food photography of {subject}.` + mô tả chi tiết (≤ ~90 từ) + **chuỗi phong cách cố định**:

```
Single serving, centered, three-quarter overhead view at about 45 degrees, the dish fills about 80% of the frame, isolated on a plain pure white background, soft diffused natural daylight, gentle soft shadow, realistic textures, appetizing, high detail. No text, no labels, no logos, no brand packaging, no hands, no people, no watermark.
```

- Bát/đĩa sứ trắng hoặc men đơn giản; món trắng (lòng trắng trứng, đậu hũ non) dùng đĩa men ngọc (celadon) để tách nền dễ.
- Thực phẩm thô: 1 khẩu phần tự nhiên, đúng trạng thái người Việt mua/ăn (phi lê basa sống, trứng luộc bổ đôi, khổ qua xanh nhạt…).
- Đồ uống/đồ đóng gói: ly trơn, lon/hộp trơn không chữ; không tên thương hiệu.
- Món chay (`tags: chay/thuan-chay`): `must_not` luôn có "no meat, poultry, fish, seafood or egg" (trừ món có trứng trong công thức).
- Nồi chiên không dầu: mô tả "golden, crisp, low-oil"; không bột chiên, không bóng dầu.
- Món Việt dễ bị nhầm (bún chả, mì Quảng, bánh cuốn, hủ tiếu, giò lụa, canh chua…) phải tả cụ thể bố cục và chi tiết nhận dạng.

## 2. Thêm món / thực phẩm mới

1. Thêm mục vào `ai_food_targets.json`: `{ "id", "name", "kind": "food|recipe", "reason": "missing" }` (id trùng id trong `FOODS`/`RECIPES`).
2. Đọc dữ liệu gốc: `items`, `steps`, `method`, `cuisine`, `tags` (meals.js / meals-extra.js) hoặc `units` của thực phẩm.
3. Thêm mục vào `ai_food_prompts.json` theo mẫu:
   ```json
   { "id": "...", "name": "...", "kind": "recipe", "reason": "missing",
     "subject": "noun phrase tiếng Anh ngắn",
     "prompt": "Professional food photography of <subject>. <mô tả> <chuỗi phong cách>",
     "must_have": ["3–5 chi tiết phải thấy"], "must_not": ["lỗi hay gặp"] }
   ```
4. Kiểm tra:
   ```bash
   python3 -c "import json;d=json.load(open('scripts/ai_food_prompts.json'));print(len(d))"
   ```
   (số mục = số mục `reason ≠ ok`; id không trùng; mọi `prompt` kết thúc bằng chuỗi phong cách).

## 3. Duyệt ảnh

- Xem contact sheet; với từng ảnh đối chiếu `must_have` (đủ hết) và `must_not` (không vi phạm mục nào).
- Loại ngay nếu: có chữ/logo/nhãn, có tay/người, nền không trắng trơn, nhiều hơn 1 suất, sai món (vd gỏi cuốn thành chả giò chiên, cơm cá ngừ thành sashimi), món chay có thịt/cá/trứng.
- Kiểm tra sau tách nền: viền sạch, bát/đĩa không bị cắt, bóng mềm không thành mảng xám.
- Ảnh đạt → đổi `reason` của mục đó trong `ai_food_targets.json` thành `ok`. Ảnh hỏng → gen lại; nếu hỏng ≥ 2 lần cùng lỗi, thêm chi tiết nhận dạng vào mô tả (không đụng chuỗi phong cách) và bổ sung lỗi đó vào `must_not`.

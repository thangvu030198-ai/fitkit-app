/* =========================================================================
   Ảnh món ăn tạo bằng AI (12/11/2026) — scripts/gen_ai_food_images.py + media-food-ai.yml + nutrition.js
   Chạy riêng: node tests/run.js --only 68-food
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const STYLE_END = "No text, no labels, no logos, no brand packaging, no hands, no people, no watermark.";

module.exports = {
  name: "Ảnh món ăn tạo bằng AI (API ảnh)",
  area: "scripts/ai_food_prompts.json · gen_ai_food_images.py · nutrition.js",
  async define(t){
    t.test("Prompt: 159 mục, id hợp lệ/không trùng, khớp danh sách món, cùng chuỗi phong cách, có tiêu chí duyệt", async ()=>{
      const P = JSON.parse(read("scripts/ai_food_prompts.json"));
      const T = JSON.parse(read("scripts/ai_food_targets.json"));
      const need = T.filter(x=> x.reason !== "ok").map(x=> x.id).sort();
      const ids = P.map(x=> x.id);
      assert.equal(new Set(ids).size, ids.length, "trùng id");
      assert.deepEqual(ids.slice().sort(), need);
      P.forEach(x=>{
        assert.ok(/^[a-z0-9-]+$/.test(x.id), "id lạ " + x.id);
        assert.ok(x.prompt.startsWith("Professional food photography of ") && x.prompt.trim().endsWith(STYLE_END), "phong cách " + x.id);
        assert.ok(Array.isArray(x.must_have) && x.must_have.length >= 3, "must_have " + x.id);
        assert.ok(!/coca|pepsi|heineken|tiger|nestl|vinamilk|th true|omachi|hảo hảo/i.test(x.prompt), "tên thương hiệu trong prompt " + x.id);
      });
    });

    t.test("Script & workflow: khoá chỉ đọc từ env/secret, không có khoá trong mã, che khoá trong log", async ()=>{
      const py = read("scripts/gen_ai_food_images.py");
      const yml = read(".github/workflows/media-food-ai.yml");
      assert.ok(/os\.environ\.get\("IMG_API_KEY"/.test(py) && /sys\.exit\(/.test(py), "phải đọc IMG_API_KEY và dừng khi thiếu");
      assert.ok(/def redact/.test(py), "phải che khoá trong log");
      [py, yml].forEach(s=> assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(s), "có khoá API trong mã!"));
      assert.ok(/IMG_API_KEY:\s*\$\{\{\s*secrets\.IMG_API_KEY\s*\}\}/.test(yml), "workflow phải lấy khoá từ secrets");
      assert.ok(/git add media\/food-ai/.test(yml), "workflow phải lưu media/food-ai");
    });

    t.test("nutrition.js: ảnh AI ưu tiên hơn ảnh Pixabay; ảnh Pixabay sai không quay lại; tên file/ id lạ bị loại", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const out = app.evj(`(()=>{
        const pix = nuCleanImgIndex({ "goi-cuon":{ file:"goi-cuon.webp", px:845676 }, "com-trang":{ file:"com-trang.webp", px:10370575 }, "tra-sua":{ file:"tra-sua.webp", px:1 } });
        const ai = nuCleanAiIndex({ "goi-cuon":{ file:"goi-cuon.webp" }, "tra-sua":{ file:"tra-sua.webp" }, "evil":{ file:"a.webp\\" onerror=\\"x" }, "Bad Id":{ file:"b.webp" } });
        const m = nuMergeImg(pix, ai);
        return { keys:Object.keys(m).sort(), goi:m["goi-cuon"], tra:m["tra-sua"], com:m["com-trang"] };
      })()`);
      assert.deepEqual(out.keys, ["com-trang","goi-cuon","tra-sua"]);
      assert.ok(out.goi.ai && /media\/food-ai\/$/.test(out.goi.base), "gỏi cuốn phải dùng ảnh AI");
      assert.ok(out.tra.ai, "trà sữa: AI ghi đè Pixabay");
      assert.ok(!out.com.ai, "cơm trắng giữ Pixabay");
    });

    t.test("foodPic: ảnh AI dùng đúng thư mục + nhãn 'tạo bằng AI'; ảnh Pixabay giữ thư mục cũ", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true } });
      const h = app.evj(`(()=>{ FOOD_IMG = nuMergeImg(nuCleanImgIndex({ "com-trang":{ file:"com-trang.webp", px:10370575 } }), nuCleanAiIndex({ "goi-cuon":{ file:"goi-cuon.webp" } }));
        return [foodPic("goi-cuon"), foodPic("com-trang")]; })()`);
      assert.ok(/media\/food-ai\/goi-cuon\.webp/.test(h[0]) && /data-ai="1"/.test(h[0]) && /tạo bằng AI/.test(h[0]), h[0]);
      assert.ok(/media\/food\/com-trang\.webp/.test(h[1]) && !/data-ai/.test(h[1]), h[1]);
    });
  }
};

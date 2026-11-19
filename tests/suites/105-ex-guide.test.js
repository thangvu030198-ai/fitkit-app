/* 19/11/2026 — ex-guide.js: video 3D tự chạy đầu màn tập + hướng dẫn 3 phần (chuẩn bị / thực hiện / hít thở) */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
module.exports = {
  name: "Video 3D đầu màn tập + hướng dẫn 3 phần",
  area: "ex-guide.js",
  async define(t){
    const app = await t.app();
    t.test("EXG-01: nạp sau guide-links.js/library.js/freevideos.js, có trong cache offline + bản native", ()=>{
      const idx = read("index.html");
      ["guide-links.js", "library.js", "freevideos.js", "app.js"].forEach(f=> assert.ok(idx.indexOf("ex-guide.js") > idx.indexOf(f), f));
      assert.ok(read("sw.js").includes("./ex-guide.js") && read("scripts/prepare-www.sh").includes("ex-guide.js"));
      assert.equal(app.ev(`typeof FKGuide`), "object");
    });
    t.test("EXG-02: hướng dẫn tách 3 phần — câu tư thế đầu đoạn là 'chuẩn bị'", ()=>{
      const P = app.evj(`FKGuide.parts(EXERCISES.benchpress, "6-8")`);
      assert.ok(/^Nằm trên ghế/.test(P.prep), P.prep);
      assert.ok(P.doIt.length > 10 && !P.doIt.startsWith("Nằm"));
      assert.ok(/đẩy lên/.test(P.breath), P.breath);
    });
    t.test("EXG-03: hít thở theo kiểu động tác (squat / kéo / plank / cardio)", ()=>{
      assert.ok(/gồng bụng TRƯỚC khi hạ/.test(app.ev(`FKGuide.breath(EXERCISES.squat, "8")`)));
      assert.ok(/kéo tạ về/.test(app.ev(`FKGuide.breath(EXERCISES.latpulldown, "10")`)));
      assert.ok(/giữ tư thế/.test(app.ev(`FKGuide.breath(EXERCISES.plank, "45 giây")`)));
      assert.ok(/nhịp bước/.test(app.ev(`FKGuide.breath(EXERCISES.running, "20 phút")`)));
    });
    t.test("EXG-04: HTML escape nội dung hướng dẫn (bài tự tạo)", ()=>{
      const h = app.ev(`FKGuide.html({ name:"x", guide:"<img src=x onerror=alert(1)>. Ngồi thẳng." }, "10")`);
      assert.ok(!/<img/.test(h) && /&lt;img/.test(h));
      assert.ok(/Khi thực hiện/.test(h) && /Hít thở/.test(h));
    });
    t.test("EXG-05: màn tập — clip 3D chỉ khi video là ex3d, giữ clip riêng của người dùng, lỗi tải → trả ảnh cũ", ()=>{
      const s = read("ex-guide.js");
      assert.ok(/if\(!item \|\| item\.clipId\) return;/.test(s) && /!v\.ex3d\) return;/.test(s));
      assert.ok(/autoplay muted loop playsinline/.test(s) && /addEventListener\("error"/.test(s));
    });
  }
};

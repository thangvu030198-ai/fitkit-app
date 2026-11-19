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
      assert.ok(/đẩy/.test(P.breath), P.breath);
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
    t.test("EXG-06: đủ hướng dẫn viết sẵn cho MỌI bài của app; bài thư viện tiếng Việt đều tách được 'chuẩn bị'", ()=>{
      assert.equal(app.ev(`Object.keys(EXERCISES).filter(k=> !EX_GUIDE_VI[k] || !EX_GUIDE_VI[k].p || !EX_GUIDE_VI[k].d || !EX_GUIDE_VI[k].b).length`), 0);
      const P = app.evj(`FKGuide.parts(EXERCISES.squat, "8")`);
      assert.ok(P.prep && P.doIt && P.breath && P.tip, JSON.stringify(P));
      const E = app.evj(`FKGuide.parts({ name:"Barbell Squat", guide:"Đặt tạ trên lưng trên, chân rộng bằng vai. Ngồi xuống đến khi đùi song song sàn rồi đứng lên. Tập trong khung có chốt an toàn." }, "8")`);
      assert.ok(/^Đặt tạ/.test(E.prep) && /^Ngồi xuống/.test(E.doIt) && /^Tập trong khung/.test(E.tip) && /gồng bụng/.test(E.breath));
      assert.ok(read("index.html").indexOf("ex-guide-data.js") < read("index.html").indexOf("ex-guide.js\""));
      assert.ok(read("sw.js").includes("./ex-guide-data.js") && read("scripts/prepare-www.sh").includes("ex-guide-data.js"));
    });
    t.test("EXG-05: màn tập — clip 3D chỉ khi video là ex3d, giữ clip riêng của người dùng, lỗi tải → trả ảnh cũ", ()=>{
      const s = read("ex-guide.js");
      assert.ok(/if\(!item \|\| item\.clipId\) return;/.test(s) && /if\(v && v\.ex3d\) slides\.push/.test(s));
      // 19/11: 1 khối media duy nhất (3D + Góc 1/2 YouTube) — video.js / guide-links.js không chèn khung thứ 2 trong màn tập
      assert.match(s, /data-exm-go/); assert.match(s, /youtube-nocookie\.com\/embed\//);
      assert.match(read("video.js"), /FKYT\.exKeyOf\(item, getExerciseMeta\(item\)\.name\)\) return;/);
      const h = app.ev(`FKGuide.mediaHTML([{k:"3d",label:"3D",url:"x.mp4"},{k:"yt",label:"Góc 1",id:"abcdefghijk"}], 0, 5)`);
      assert.match(h, /BÀI 1\/5/); assert.match(h, /data-exm-go="1"/); assert.doesNotMatch(h, /<iframe/);
      assert.ok(/autoplay muted loop playsinline/.test(s) && /addEventListener\("error"/.test(s));
    });
  }
};

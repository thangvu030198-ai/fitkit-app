/* 16/11/2026 — Ảnh minh hoạ bài tập phong cách TapEasy (exercise-art.js · media/exercise-ai) */
"use strict";
const { assert } = require("../lib/framework");
module.exports = {
  name: "Ảnh bài tập AI: gắn vào EXERCISES, ưu tiên ở danh sách, giữ ảnh cũ khi chưa có",
  area: "exercise-art.js",
  async define(t){
    const app = await t.app();
    t.test("EXART-01: module đã nạp; chưa có ảnh → thumb rỗng, ảnh cũ giữ nguyên", ()=>{
      assert.equal(app.ev(`typeof fkExArt`), "object");
      assert.equal(app.ev(`fkExArt.thumb("lunges")`), "");
      assert.ok(!/exercise-ai/.test(app.ev(`EXERCISES.lunges.img`)));
    });
    t.test("EXART-02: áp danh sách id → EXERCISES.img đổi sang ảnh AI; id lạ bị bỏ qua", ()=>{
      assert.equal(app.ev(`fkExArt._apply(["ex-benchpress","ex-squat","ex-khongco"])`), 2);
      assert.equal(app.ev(`EXERCISES.benchpress.img`), "https://tapeasy.app/media/exercise-ai/ex-benchpress.webp");
      assert.ok(app.ev(`!!EXERCISES.benchpress._origImg`));
      assert.equal(app.ev(`fkExArt.thumb({ exerciseId: "squat", custom: null })`), "https://tapeasy.app/media/exercise-ai/ex-squat-sm.webp");
      assert.equal(app.ev(`fkExArt.thumb({ exerciseId: "squat", custom: { name: "x" } })`), "", "bài tự tạo không đổi ảnh");
      assert.ok(app.ev(`fkExArt.isAi(EXERCISES.squat.img)`));
    });
    t.test("EXART-03: danh sách bài trong buổi dùng ảnh AI nhỏ thay ảnh bìa video kho", ()=>{
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "app.js"), "utf8");
      assert.ok((src.match(/fkExArt\.thumb\(/g) || []).length >= 2 && /fkExArt\.full\(/.test(src));
      assert.ok(/data-exart=/.test(src));
    });
    t.test("EXART-04: chi tiết thư viện — bài lõi không còn ảnh chung nhóm cơ ghi 'Ảnh động'; có video → video lặp; có ảnh → minh hoạ", ()=>{
      assert.equal(app.ev(`libTechMediaHTML({ src: "fitkit", id: "lunges", name: "Lunges" }, ["x.jpg"])`), "");
      assert.ok(/Minh hoạ kỹ thuật/.test(app.ev(`libTechMediaHTML({ src: "fitkit", id: "benchpress", name: "Bench" }, [])`)));
      assert.equal(app.ev(`fkExArt._applyVideos([{ id: "ex-squat", file: "ex-squat.mp4", poster: "ex-squat.jpg", ratio: "16:9", hash: "ab12" }, { id: "ex-x", file: "evil.mp4" }])`), 1);
      const h = app.ev(`libTechMediaHTML({ src: "fitkit", id: "squat", name: "Squat" }, [])`);
      assert.ok(/<video[^>]+autoplay muted loop playsinline/.test(h) && /exercise-ai-video\/ex-squat\.mp4/.test(h) && /Động tác mẫu/.test(h));
      assert.ok(/Ảnh động kỹ thuật/.test(app.ev(`libTechMediaHTML({ src: "exdb", name: "A" }, ["a.jpg","b.jpg"])`)));
      assert.ok(!/Ảnh động/.test(app.ev(`libTechMediaHTML({ src: "exdb", name: "A" }, ["a.jpg"])`)));
    });
    t.test("EXART-05: clip chưa đạt duyệt chuyên môn (HOLD) bị ẩn → khối kỹ thuật dùng ảnh minh hoạ", ()=>{
      assert.ok(app.ev(`fkExArt._hold.video.has("preacher")`));
      app.ev(`fkExArt._apply(["ex-preacher"])`);
      assert.equal(app.ev(`fkExArt._applyVideos([{ id: "ex-preacher", file: "ex-preacher.mp4", poster: "ex-preacher.jpg", ratio: "16:9", hash: "x1" }])`), 0);
      const h = app.ev(`libTechMediaHTML({ src: "fitkit", id: "preacher", name: "Preacher" }, [])`);
      assert.ok(!/<video/.test(h) && /Minh hoạ kỹ thuật/.test(h));
    });
  }
};

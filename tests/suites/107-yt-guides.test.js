/* 19/11/2026 — video hướng dẫn YouTube cụ thể cho từng bài (guide-links.js): 2 góc / bài, nhúng youtube-nocookie khi chạm */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const read = f=> fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
module.exports = {
  name: "Video hướng dẫn YouTube từng bài",
  area: "guide-links.js",
  async define(t){
    const app = await t.app();
    t.test("YTG-01: MỌI bài của app có ≥ 2 video, ID hợp lệ, không trùng giữa các bài", ()=>{
      const r = app.evj(`(()=>{ const miss = Object.keys(EXERCISES).filter(k=> FKYT.idsFor(k).length < 2); const all = Object.keys(FKYT.EX_YT).flatMap(k=> FKYT.EX_YT[k]);
        return { miss, n: all.length, uniq: new Set(all).size, bad: all.filter(x=> !/^[A-Za-z0-9_-]{11}$/.test(x)) }; })()`);
      assert.deepEqual(r.miss, []); assert.deepEqual(r.bad, []); assert.equal(r.n, r.uniq, "trùng ID");
    });
    t.test("YTG-02: khối video: ảnh bìa + 'Góc 1/2', chỉ nhúng khi chạm, link mở YouTube chỉ nhận URL hợp lệ", ()=>{
      const h = app.ev(`FKYT.stripHTML("squat", "Squat")`);
      assert.match(h, /i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/mqdefault\.jpg/); assert.match(h, /Góc 1/); assert.match(h, /Góc 2/);
      assert.doesNotMatch(h, /<iframe/);
      assert.equal(app.ev(`FKYT.open("https://www.youtube.com/watch?v=abc")`), false);
      assert.equal(app.ev(`FKYT.stripHTML("khong-co", "x")`), "");
      assert.match(read("guide-links.js"), /youtube-nocookie\.com\/embed\//);
      assert.match(read("index.html"), /frame-src[^;]*https:\/\/www\.youtube-nocookie\.com/);
    });
    t.test("YTG-03: nhận bài từ id / bài thư viện (exDbId) / tên tiếng Anh trong ngoặc", ()=>{
      assert.equal(app.ev(`FKYT.exKeyOf({ exerciseId:"plank" })`), "plank");
      assert.equal(app.ev(`FKYT.exKeyOf(null, EXERCISES.hipthrust.name)`), "hipthrust");
      assert.equal(app.ev(`FKYT.exKeyOf({ custom:{ name:"Xyz" } })`), "");
    });
  }
};

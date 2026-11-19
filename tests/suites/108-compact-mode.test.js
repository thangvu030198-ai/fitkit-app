/* 20/11/2026 — Chế độ gọn (góp ý người dùng) + video YouTube chọn tay (yt-manual.json) */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const read = f=> fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
module.exports = {
  name: "Chế độ gọn + video YouTube chọn tay",
  area: "pt.js / yt-manual.json",
  async define(t){
    const app = await t.app();
    t.test("CPT-01: mặc định TẮT; bật → lưu state.ui.compact + class html.fk-compact; tắt → bỏ", ()=>{
      assert.equal(app.ev(`fkCompactOn()`), false);
      app.ev(`fkCompactSet(true)`);
      assert.equal(app.ev(`state.ui.compact`), true);
      assert.equal(app.ev(`document.documentElement.classList.contains("fk-compact")`), true);
      app.ev(`fkCompactSet(false)`);
      assert.equal(app.ev(`fkCompactOn()`), false);
    });
    t.test("CPT-02: công tắc trong Hồ sơ + CSS ẩn khối phụ (không xoá phần tử)", ()=>{
      assert.match(read("index.html"), /id="fk-compact-row"[^>]*role="switch"/);
      assert.match(read("style.css"), /#home-content > \.fk-cpt-hide\{ display:none/);
      assert.match(read("pt.js"), /zone\.get\(n\) >= 7/);
    });
    t.test("CPT-03: yt-manual.json hợp lệ: id thư viện có thật, ID video 11 ký tự, ≤ 3/bài", ()=>{
      const j = JSON.parse(read("yt-manual.json")), items = j.items || j;
      const ids = new Set(fs.readdirSync(path.join(__dirname, "..", "..")).filter(f=> /^exdb-vi.*\.js$/.test(f))
        .flatMap(f=> [...read(f).matchAll(/^\s*"([^"]+)":\{n:/gm)].map(m=> m[1])));
      const bad = Object.keys(items).filter(k=> !ids.has(k) || !Array.isArray(items[k]) || !items[k].length || items[k].length > 3 || items[k].some(x=> !/^[A-Za-z0-9_-]{11}$/.test(x)));
      assert.deepEqual(bad, []);
    });
  }
};

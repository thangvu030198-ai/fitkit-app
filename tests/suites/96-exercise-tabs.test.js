/* 18/11/2026 — Chi tiết bài tập 3 tab (library.js): Hướng dẫn · Phân tích · Lịch sử */
"use strict";
const { assert } = require("../lib/framework");
module.exports = {
  name: "Chi tiết bài: 3 tab Hướng dẫn / Phân tích / Lịch sử",
  area: "library.js",
  async define(t){
    const app = await t.app();
    const X = `{ src:"fitkit", id:"benchpress", name:"Bench", muscleVi:"Ngực", equip:"barbell", level:"beginner", sub:"Ngực · Thanh đòn", sets:4, reps:"6-8", restSec:120,
      guide:"Nằm ghế phẳng, khép bả vai. Hạ tạ chạm ngực dưới, đẩy lên thẳng tay." }`;
    t.test("TAB-01: hướng dẫn chia 3 phần; bài giữ giờ có lời khuyên thở riêng", ()=>{
      const g = app.evj(`libGuideParts(Object.assign(${X}, { id:"" }))`);   // bài không có hướng dẫn viết sẵn → tự tách câu
      assert.ok(/mắt ngay dưới thanh đòn/.test(app.evj(`libGuideParts(${X})`).prep), "bài của app dùng hướng dẫn viết sẵn (ex-guide-data.js)");
      assert.equal(g.prep, "Nằm ghế phẳng, khép bả vai.");
      assert.ok(/Hạ tạ chạm ngực/.test(g.doIt));
      assert.ok(/[Tt]hở ra/.test(g.breath));   // 19/11: ex-guide.js — lời khuyên thở theo kiểu động tác
      const p = app.evj(`libGuideParts({ guide:"Giữ thân thẳng.", reps:"45 giây" })`);
      assert.ok(/không nín thở/.test(p.breath)); assert.equal(p.prep, ""); assert.equal(p.doIt, "Giữ thân thẳng.");
    });
    t.test("TAB-02: nhóm cơ chính/phụ lấy từ bảng hệ số của app", ()=>{
      const m = app.evj(`libMuscleSplit(${X})`);
      assert.ok(m.main.includes("Ngực"));
    });
    t.test("TAB-03: Phân tích + Lịch sử đọc lịch sử tạ của người dùng; chưa có thì báo rõ", ()=>{
      app.run(`state.setHist = state.setHist || {}; delete state.setHist.benchpress`);
      let h = app.ev(`libDetailTabsHTML(${X}, "fk:benchpress")`);
      assert.ok(/data-ld-tab="guide"/.test(h) && /data-ld-tab="ana"/.test(h) && /data-ld-tab="hist"/.test(h));
      assert.ok(/Chưa có dữ liệu/.test(h) && /Tư thế chuẩn bị/.test(h) && /Hít thở/.test(h));
      app.run(`state.setHist.benchpress = { name:"Bench", list:[{ date:"2026-11-01", sets:[{kg:60,reps:8}], vol:480, e1rm:76, top:60 }, { date:"2026-11-15", sets:[{kg:70,reps:6},{kg:70,reps:6}], vol:840, e1rm:84, top:70 }] }`);
      h = app.ev(`libDetailTabsHTML(${X}, "fk:benchpress")`);
      assert.ok(/>84</.test(h), "1RM tốt nhất"); assert.ok(/\+11% sức mạnh/.test(h));
      assert.ok(/15\/11/.test(h) && /70×6 · 70×6/.test(h)); assert.ok(/Lịch sử <em>2<\/em>/.test(h));
      app.run(`delete state.setHist.benchpress`);
    });
  }
};

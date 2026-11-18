/* 18/11/2026 — Tổng kết tháng (training-pro.js) */
"use strict";
const { assert } = require("../lib/framework");
module.exports = {
  name: "Tổng kết tháng: số buổi, tấn, kỷ lục, chuỗi ngày, theo tuần, nhóm cơ",
  area: "training-pro.js",
  async define(t){
    const app = await t.app();
    const LOG = `[
      { id:"a", date:"2026-10-30", volume:9000, dur:3600, sets:20, prs:[], exercises:[] },
      { id:"b", date:"2026-11-02", volume:5000, dur:3600, sets:20, prs:[{name:"x"}], exercises:[{ key:"benchpress", muscle:"Ngực", sets:4 }] },
      { id:"c", date:"2026-11-03", volume:6000, dur:1800, sets:15, prs:[{name:"y"},{name:"z"}], exercises:[{ key:"squat", muscle:"Đùi trước", sets:5 }] },
      { id:"d", date:"2026-11-04", volume:4000, dur:3600, sets:18, prs:[], exercises:[{ key:"benchpress", muscle:"Ngực", sets:4 }] },
      { id:"e", date:"2026-11-20", volume:7000, dur:3600, sets:22, prs:[], exercises:[] } ]`;
    t.test("MR-01: số liệu tháng 11 chỉ tính buổi trong tháng; chuỗi ngày dài nhất = 3", ()=>{
      const M = app.evj(`FKTP.monthStats(${LOG}, "2026-11")`);
      assert.equal(M.count, 4); assert.equal(M.volume, 22000); assert.equal(M.tonnes, 22); assert.equal(M.prs, 3);
      assert.equal(M.bestStreak, 3); assert.equal(M.days, 4); assert.equal(M.hours, 3.5);
      assert.equal(M.weeks.length, 5); assert.equal(M.weeks[0], 15000); assert.equal(M.weeks[2], 7000);
      assert.equal(M.top[0][0], "Ngực");
    });
    t.test("MR-02: chuyển tháng qua năm; tháng trống không lỗi", ()=>{
      assert.equal(app.ev(`FKTP.ymShift("2026-01", -1)`), "2025-12");
      assert.equal(app.ev(`FKTP.ymShift("2026-12", 1)`), "2027-01");
      const E = app.evj(`FKTP.monthStats([], "2026-02")`);
      assert.equal(E.count, 0); assert.equal(E.weeks.length, 4); assert.equal(E.bestStreak, 0);
    });
    t.test("MR-03: có lối vào ở Nhật ký buổi tập và tờ tổng kết có điều hướng tháng + lưu/chia sẻ", ()=>{
      const src = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "training-pro.js"), "utf8");
      assert.ok(/id="tp-mr-open"/.test(src) && /openMonthRecap\(null, openLogSheet\)/.test(src));
      assert.ok(/tp-mr-prev/.test(src) && /tp-mr-next/.test(src) && /tp-mr-save/.test(src) && /tp-mr-share/.test(src));
      const app_ = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "app.js"), "utf8");
      assert.ok(/data-prl="month"/.test(app_));
    });
  }
};

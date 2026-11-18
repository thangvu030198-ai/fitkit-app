/* 18/11/2026 — Tóm tắt buổi chi tiết (training-pro.js): nhóm cơ, bài theo khối lượng, % so với buổi trước */
"use strict";
const { assert } = require("../lib/framework");
module.exports = {
  name: "Tóm tắt buổi: nhóm cơ, bài theo khối lượng, so với buổi trước",
  area: "training-pro.js",
  async define(t){
    const app = await t.app();
    const SUM = `{ id:"tpX", endedAt: 2e12, planId:"p1", dayKey:"T2", title:"Ngực", date:"2026-11-18", dur:3600, volume:5500, sets:12, reps:120, completed:3, total:3,
      prs:[{ name:"Bench (BB)", text:"80 kg × 6" }],
      exercises:[{ key:"benchpress", name:"Bench (BB)", muscle:"Ngực / Tay sau", sets:4, vol:2000, best:{ kg:80, reps:6 } },
                 { key:"cablefly", name:"Fly", muscle:"Ngực", sets:4, vol:3000, best:{ kg:30, reps:12 } },
                 { key:"tricepsdown", name:"Pushdown", muscle:"Tay sau", sets:4, vol:500, best:{ kg:20, reps:12 } }] }`;
    t.test("FIN-01: số hiệp theo nhóm cơ — nhóm chính tính đủ, nhóm phụ tính nửa; xếp giảm dần", ()=>{
      const m = app.evj(`FKTP.muscleSets(${SUM})`);
      assert.equal(m[0][0], "Ngực");
      assert.ok(m.find(x=> x[0] === "Tay sau"), "có tay sau");
      for(let i = 1; i < m.length; i++) assert.ok(m[i-1][1] >= m[i][1]);
    });
    t.test("FIN-02: so với buổi trước cùng giáo án + cùng ngày tập; không có thì không hiện", ()=>{
      assert.equal(app.ev(`FKTP.pctChange(5500, 5000)`), 10);
      assert.equal(app.ev(`FKTP.pctChange(4500, 5000)`), -10);
      assert.equal(app.ev(`FKTP.pctChange(100, 0)`), null);
      const p = app.evj(`FKTP.prevSession(${SUM}, [{ id:"a", endedAt:1, planId:"p1", dayKey:"T4", title:"Lưng", volume:1 }, { id:"b", endedAt:2, planId:"p1", dayKey:"T2", title:"Ngực", volume:5000 }, { id:"c", endedAt:3, planId:"p2", dayKey:"T3", title:"Chân", volume:9 }])`);
      assert.equal(p.id, "b");
      assert.equal(app.ev(`FKTP.prevSession(${SUM}, [{ id:"c", endedAt:3, planId:"p2", dayKey:"T3", title:"Chân" }])`), null);
    });
    t.test("FIN-03: HTML tóm tắt có nhóm cơ, bài xếp theo khối lượng (Fly trước Bench), nhãn PR, chip số lần/kcal", ()=>{
      const h = app.ev(`FKTP.finishDetailHTML(${SUM})`);
      assert.ok(/Nhóm cơ đã tập/.test(h) && /Bài theo khối lượng/.test(h));
      assert.ok(h.indexOf("Fly") < h.indexOf("Bench"), "bài khối lượng lớn đứng trước");
      assert.ok(/Bench<\/b> <span class="tp-pr-tag">PR/.test(h));
      assert.ok(/120 lần/.test(h) && /3\/3 bài/.test(h) && /1 kỷ lục/.test(h));
    });
  }
};

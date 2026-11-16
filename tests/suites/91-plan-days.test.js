/* 16/11/2026 — Đổi ngày tập (plan-tools.js · FKDays): dời buổi 2-4-6 → 3-5-7, đổi chỗ, giữ superset */
"use strict";
const { assert } = require("../lib/framework");
module.exports = {
  name: "Đổi ngày tập: dời lịch, đổi chỗ, giữ bài & superset",
  area: "plan-tools.js",
  async define(t){
    const app = await t.app();
    const setup = ()=> app.run(`(()=>{ const mk = (t, ids)=> ({ title: t, intensity: "Vừa", duration: 50, items: ids.map(id=> ({ uid: id + "_u", exerciseId: id, custom: null, sets: 3, reps: "8-10", restSec: 90, clipId: null })) });
      const R = ()=> ({ title: "Nghỉ ngơi", intensity: "Nghỉ", duration: 0, items: [] });
      state.plans.tp = { id: "tp", name: "Full Body test", days: { T2: mk("Full Body A", ["squat","benchpress","bentoverrow"]), T3: R(), T4: mk("Full Body B", ["deadlift","overheadpress","pullup"]), T5: R(), T6: mk("Full Body C", ["lunges","dbbench","latpulldown"]), T7: R(), CN: R() } };
      state.trainingPro = state.trainingPro || {}; state.trainingPro.links = state.trainingPro.links || {}; state.trainingPro.links.tp = { T2: ["squat_u>benchpress_u"] }; })()`);
    const days = ()=> app.evj(`Object.fromEntries(Object.entries(state.plans.tp.days).map(([k,d])=> [k, d.items.length ? d.title : "-"]))`);
    t.test("DAYS-01: lùi 2-4-6 → 3-5-7 — buổi, bài và superset đi theo; ngày trống thành ngày nghỉ", ()=>{
      setup(); assert.equal(app.ev(`FKDays.shift(state.plans.tp, 1)`), 3);
      assert.deepEqual(days(), { T2:"-", T3:"Full Body A", T4:"-", T5:"Full Body B", T6:"-", T7:"Full Body C", CN:"-" });
      assert.deepEqual(app.evj(`state.plans.tp.days.T3.items.map(i=> i.exerciseId)`), ["squat","benchpress","bentoverrow"]);
      assert.deepEqual(app.evj(`state.trainingPro.links.tp`), { T3: ["squat_u>benchpress_u"] });
      assert.equal(app.evj(`Object.values(state.plans.tp.days).filter(d=> !d.items.length).length`), 4);
    });
    t.test("DAYS-02: chọn từng ngày + đổi chỗ; trùng ngày / ngày lạ bị từ chối; CN → T2 vòng tuần", ()=>{
      setup(); assert.equal(app.ev(`FKDays.assign(state.plans.tp, ["T6","T4","T2"])`), 2);
      assert.deepEqual(days(), { T2:"Full Body C", T3:"-", T4:"Full Body B", T5:"-", T6:"Full Body A", T7:"-", CN:"-" });
      setup(); assert.equal(app.ev(`FKDays.assign(state.plans.tp, ["T3","T3","T7"])`), 0); assert.equal(days().T2, "Full Body A", "không đổi gì khi trùng");
      assert.equal(app.ev(`FKDays.assign(state.plans.tp, ["T3","XX","T7"])`), 0); assert.equal(app.ev(`FKDays.assign(state.plans.tp, ["T3"])`), 0);
      setup(); app.ev(`FKDays.shift(state.plans.tp, -1)`); assert.deepEqual(days(), { T2:"-", T3:"Full Body B", T4:"-", T5:"Full Body C", T6:"-", T7:"-", CN:"Full Body A" });
    });
    t.test("DAYS-03: cảnh báo buổi liền nhau (kể cả CN → T2)", ()=>{
      setup(); app.ev(`FKDays.assign(state.plans.tp, ["T2","T3","CN"])`);
      const bb = app.evj(`FKDays.backToBack(state.plans.tp).map(x=> x.a + ">" + x.b)`); assert.deepEqual(bb.sort(), ["CN>T2", "T2>T3"]);
      assert.equal(app.evj(`FKDays.trainingDays(state.plans.tp)`).join(","), "T2,T3,CN");
    });
    t.test("DAYS-04: tờ Đổi ngày tập — bấm Lùi/Tiến, chọn ngày trùng thì 2 buổi đổi chỗ, Lưu áp vào giáo án", ()=>{
      setup(); app.run(`FKDays.open(state.plans.tp)`);
      let html = app.lastHtml("sheet-content"); assert.ok(/Đổi ngày tập/.test(html) && /Tiến 1 ngày/.test(html) && /T3 · T5 · T7/.test(html));
      assert.ok(/data-days-set="0:T3"/.test(html) && /data-days-shift="-1"/.test(html) && /fk-days-save/.test(html));
    });
  }
};

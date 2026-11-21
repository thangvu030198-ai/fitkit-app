/* 21/11/2026 — Lỗi user báo: "tập xong/lưu, chuyển sang app khác, vào lại thì mất" → buổi đang tập phải sống sót khi app bị đóng nền */
"use strict";
const { assert } = require("../lib/framework");
module.exports = {
  name: "Buổi tập đang dở được lưu & khôi phục khi app bị đóng nền",
  area: "app.js (session persist)",
  async define(t){
    const app = await t.app();
    let snap = null, st = null;

    t.test("SP-01: bắt đầu buổi + ✓ hiệp → bản chụp có trong localStorage (kể cả khi app xuống nền)", async ()=>{
      const r = app.evj(`(()=>{
        const plan = getActivePlan(); const k = Object.keys(plan.days).find(d=> (plan.days[d].items||[]).length);
        startSession(k); const go = document.getElementById("mk-go"); if(go) go.click();
        const rows = session.sets[session.items[session.idx].uid]; rows[0].kg = 42.5; rows[0].reps = 9; rows[0].done = true;
        fkSessSnapshot(); return { ok: !!session, k };
      })()`);
      assert.ok(r.ok);
      snap = app.ev(`localStorage.getItem("fk_active_session_v1")`);
      st = app.ev(`localStorage.getItem("fitkit_state_v1")`);
      assert.ok(snap && /42\.5/.test(snap), "có bản chụp buổi tập với hiệp đã ghi");
      app.ev(`localStorage.removeItem("fk_active_session_v1"); document.dispatchEvent(new Event("visibilitychange"))`);
      /* visibilityState trong harness có thể là "visible" → gọi trực tiếp đường pagehide */
      app.ev(`(globalThis.__winListeners && globalThis.__winListeners.pagehide || []).forEach(f=> f(new Event("pagehide")))`);
      assert.ok(app.ev(`!!localStorage.getItem("fk_active_session_v1")`), "pagehide ghi lại bản chụp");
    });

    t.test("SP-02: mở lại app (tiến trình mới) → khôi phục buổi + hiệp đã ghi, hỏi Tiếp tục", async ()=>{
      const app2 = await t.app({ storage: { fitkit_state_v1: st, fk_active_session_v1: snap, fk_sport: "fitness" } });
      await new Promise(r=> setTimeout(r, 1700));
      const r = app2.evj(`({ has: !!session, paused: session && session.paused, kg: session && session.sets[session.items[session.idx].uid][0].kg,
        txt: (document.getElementById("sheet-content")||{}).textContent || "" })`);
      assert.ok(r.has, "session được khôi phục"); assert.equal(r.kg, 42.5);
      assert.ok(/Buổi tập đang dở/.test(r.txt) && /1 hiệp đã ghi/.test(r.txt), r.txt.slice(0, 200));
      app2.ev(`document.getElementById("rs-go").click()`);
      assert.equal(app2.ev(`session.paused`), false);
      assert.ok(app2.ev(`!!document.querySelector("#btn-session-done")`), "vào lại màn tập");
    });

    t.test("SP-03: kết thúc buổi → xoá bản chụp; bản chụp quá cũ (>20 giờ) bị bỏ", async ()=>{
      const app3 = await t.app({ storage: { fitkit_state_v1: st, fk_active_session_v1: snap, fk_sport: "fitness" } });
      await new Promise(r=> setTimeout(r, 1700));
      app3.ev(`document.getElementById("rs-end").click()`);
      assert.equal(app3.ev(`session`), null);
      const saved = app3.evj(`(()=>{ const st = JSON.parse(localStorage.getItem("fitkit_state_v1")); const k = Object.keys(st.setLog||{}).find(x=> /bench/.test(x));
        return { log: !!st.workoutLog[todayStr()], kg: k ? (st.setLog[k].sets||[]).map(r=> Number(r.kg)) : [] }; })()`);
      assert.ok(saved.log, "buổi được ghi vào nhật ký hôm nay"); assert.ok(saved.kg.includes(42.5), "hiệp 42,5 kg được lưu: " + JSON.stringify(saved.kg));
      assert.equal(app3.ev(`localStorage.getItem("fk_active_session_v1")`), null);
      const old = JSON.parse(snap); old.savedAt = Date.now() - 21 * 3600000;
      const app4 = await t.app({ storage: { fitkit_state_v1: st, fk_active_session_v1: JSON.stringify(old), fk_sport: "fitness" } });
      await new Promise(r=> setTimeout(r, 1700));
      assert.equal(app4.ev(`session`), null);
    });
  }
};

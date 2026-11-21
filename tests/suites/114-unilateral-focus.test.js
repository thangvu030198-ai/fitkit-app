/* 21/11/2026 — Phản hồi anh Thắng (kèm ảnh): "đoạn dưới chỉnh cũng phải có trái phải, và có RPE của từng bên".
   (1) Bảng hiệp: dòng P (bên phải) có ô RPE riêng → lưu r.R.rpe; bản ghi lưu L.rpe / R.rpe, rpe chung = bên nặng hơn.
   (2) Thanh hiệp ở đáy (session-focus.js): bộ chọn bên T | P, −/+ KG, −/+ LẦN, RPE nhanh điều khiển ĐÚNG ô của bên đang chọn;
       "Tiếp: Tay phải" khi đang ở T và chưa chỉnh P; XONG HIỆP = ✓ của hàng (cả 2 bên). Bài thường → thanh như cũ.
   (3) Dữ liệu cũ (không có RPE phải / không có L/R) vẫn chạy; bản chụp buổi dở giữ RPE phải. */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
module.exports = {
  name: "Ghi trái/phải: RPE từng bên + thanh hiệp đáy theo bên",
  area: "app.js, session-focus.js, session-plus.js, session-review.js, training-pro.js, style.css",
  async define(t){
    const setup = a=> a.evj(`(()=>{
      const plan = getActivePlan(); const k = todayDayKey();
      plan.days[k] = plan.days[k] || { title:"x", items:[] };
      plan.days[k].items = [
        { uid:"uni1", exerciseId:"dbrow", sets:2, reps:"10-12 mỗi tay", restSec:0 },
        { uid:"bi1", exerciseId:"squat", sets:2, reps:"6-8", restSec:0 } ];
      startSession(k); return { k };
    })()`);
    /* hàng hiệp giả lập (DOM thử nghiệm không phân tích HTML): ô thật của shim, querySelector theo bảng chọn */
    const mkRows = (a, sided)=> a.run(`(()=>{
      const mk = (v)=>{ const el = document.createElement("input"); el.value = v; el.ev = []; const d = el.dispatchEvent.bind(el); el.dispatchEvent = e=>{ el.ev.push(e.type); return d(e); }; return el; };
      const row = (i)=>{
        const r = document.createElement("div"); r.classList.add("set-row"); if(${!!sided}) r.classList.add("uni");
        const chk = document.createElement("button"); chk.clicks = 0; chk.click = ()=>{ chk.clicks++; r.classList.toggle("done"); };
        const m = { "input[data-kg]": mk("70"), "input[data-reps]": mk("12"), "select.rpe": mk(""), "[data-done]": chk };
        if(${!!sided}) Object.assign(m, { "input[data-kg-r]": mk("70"), "input[data-reps-r]": mk("12"), "select.rpe-r": mk("") });
        r.querySelector = sel=> m[sel] || null; r.m = m; return r;
      };
      window.__R = [row(0), row(1)];
      return true;
    })()`);
    const C = `({ list: window.__R, i: 0, row: window.__R[0] })`;
    const btn = (a, attrs)=> a.run(`(()=>{ const b = document.createElement("button"); const at = ${JSON.stringify(attrs)};
      b.getAttribute = n=> n in at ? at[n] : null; b.hasAttribute = n=> n in at; b.dataset = { sf: at["data-sf"] }; return b; })()`);
    const act = (a, attrs)=> { a.run(`window.__B = null`); const b = btn(a, attrs); a.ctx.__B = b; a.run(`FKFocus.act(window.__B || __B, ${C})`); };

    t.test("UF-01: bảng hiệp — dòng P có select RPE riêng (data-rpe-r), dòng T có nhãn bên; bài 2 bên không có", async ()=>{
      const a = await t.app();
      a.run(`state.profile.showRpe = true; state.profile.simple = false;`);
      setup(a);
      const h = a.ev(`document.getElementById("sheet-content").innerHTML`);
      if(/class="rpe"/.test(h)){
        assert.match(h, /class="rpe rpe-r" data-rpe-r="0"/); assert.match(h, /aria-label="RPE hiệp 1 — Tay phải"/);
        assert.doesNotMatch(h, /side-rpe-pad/);
      } else assert.match(h, /set-show-rpe/, "chế độ đơn giản: không cột RPE ở cả 2 bên");
      a.ev(`session.idx = 1; renderSessionStep();`);
      assert.doesNotMatch(a.ev(`document.getElementById("sheet-content").innerHTML`), /data-rpe-r=/);
    });
    t.test("UF-02: RPE phải lưu riêng — fkSideSetR('rpe'), fkRowRecord L.rpe/R.rpe + rpe chung = bên nặng hơn; setLog/setHist giữ", async ()=>{
      const a = await t.app();
      setup(a);
      a.run(`(()=>{ const rows = session.sets.uni1; rows.forEach(r=>{ r.kg = 20; r.reps = 12; }); fkSideSync(rows, 0);
        rows[0].rpe = "8"; fkSideSetR(rows, 0, "rpe", "9"); fkSideSetR(rows, 1, "rpe", "abc"); rows[1].rpe = "7"; })()`);
      assert.equal(a.ev(`session.sets.uni1[0].R.rpe`), "9"); assert.equal(a.ev(`session.sets.uni1[1].R.rpe`), "", "RPE hỏng → trống");
      assert.equal(a.ev(`session.sets.uni1[0].R.kg`), 20, "RPE không phá kg/lần theo trái");
      const rec = a.evj(`fkRowRecord(session.sets.uni1[0], false)`);
      assert.deepEqual([rec.rpe, rec.L.rpe, rec.R.rpe], [9, 8, 9]);
      assert.equal(a.ev(`fkRowRpe(session.sets.uni1[0])`), 9);
      assert.equal(a.ev(`fkRowRpe({ kg:20, reps:10, rpe:"7" })`), 7, "hàng thường");
      a.ev(`fkSessSnapshot()`);
      const snap = JSON.parse(a.ev(`localStorage.getItem("fk_active_session_v1")`));
      assert.equal(snap.s.sets.uni1[0].R.rpe, "9", "bản chụp buổi dở giữ RPE phải");
      a.run(`session.sets.uni1.forEach(r=> r.done = true)`);
      a.ev(`document.getElementById("btn-session-done").click()`);
      const log = a.evj(`state.setLog.dbrow`);
      assert.deepEqual(log.sets[0].L, { kg:20, reps:12, rpe:8 }); assert.deepEqual(log.sets[0].R, { kg:20, reps:12, rpe:9 });
      assert.equal(log.sets[0].rpe, 9); assert.equal(log.sets[1].rpe, 7); assert.ok(!("rpe" in log.sets[1].R));
      const h = a.evj(`state.setHist.dbrow.list.slice(-1)[0].sets`);
      assert.equal(h[0].R.rpe, 9); assert.equal(h[0].L.rpe, 8); assert.equal(h[0].rpe, 9);
      // "lần trước" theo bên có RPE
      assert.match(a.ev(`fkSideTxt(state.setLog.dbrow.sets[0], false)`), /T 20(,0)?kg×12@8 \/ P 20(,0)?kg×12@9/);
    });
    t.test("UF-03: dữ liệu cũ — không RPE phải / không L/R vẫn chạy (bản ghi, tăng tạ, hiệp nặng training-pro)", async ()=>{
      const a = await t.app();
      const rec = a.evj(`fkRowRecord({ kg:20, reps:10, rpe:"8", R:{ kg:20, reps:10 } }, false)`);
      assert.equal(rec.rpe, 8); assert.ok(!("rpe" in rec.R));
      assert.equal(a.evj(`fkRowRecord({ kg:20, reps:10, type:"f", R:{ kg:20, reps:9 } }, false)`).rpe, 10, "tới hạn không RPE → 10 như cũ");
      assert.equal(a.evj(`fkRowRecord({ kg:20, reps:10 }, false)`).rpe, undefined);
      a.run(`recordExerciseResult("old1", "Old", "10-12", [{ kg:20, reps:12, rpe:8 }, { kg:20, reps:12, L:{ kg:20, reps:12, rpe:"x" }, R:{ kg:20, reps:12, rpe:11 } }], false)`);
      const z = a.evj(`state.setLog.old1.sets`);
      assert.deepEqual(z[1].L, { kg:20, reps:12 }); assert.deepEqual(z[1].R, { kg:20, reps:12 }, "RPE hỏng → bỏ");
      assert.equal(a.ev(`FKTP.hardSets([{ rpe:6 }, { rpe:"", R:{ rpe:"6" } }, { rpe:"6", R:{ rpe:"9" } }, {}])`), 0.5 + 0.5 + 1 + 1);
      // hiệp RPE ≥ 9.5 ở bên phải → không tự tăng tạ
      const d = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
      a.run(`state.setLog.dbrow = { date:"${d}", reps:"10-12 mỗi tay", fails:0, prevFails:0, sets:[{ kg:20, reps:12, L:{ kg:20, reps:12 }, R:{ kg:20, reps:12, rpe:10 } }, { kg:20, reps:12 }] };`);
      assert.equal(a.evj(`progressionFor({ reps:"10-12" }, EXERCISES.dbrow, state.setLog.dbrow, false, 2)`).delta, 0, "RPE phải 10 → giữ tạ");
      a.run(`delete state.setLog.dbrow.sets[0].R.rpe`);
      assert.equal(a.evj(`progressionFor({ reps:"10-12" }, EXERCISES.dbrow, state.setLog.dbrow, false, 2)`).delta, 1, "dữ liệu cũ vẫn tự tăng");
      // session-plus: lần trước có RPE từng bên
      const W = {}; W.window = W;
      new Function("window", read("session-plus.js").replace('typeof window !== "undefined" ? window : globalThis', "window"))(W);
      const p = W.FKSessionPlus.prevFor({ sets:[{ kg:20, reps:12, L:{ kg:20, reps:12, rpe:8 }, R:{ kg:20, reps:11 } }] }, [{}], 0);
      assert.equal(p.side.L.rpe, 8); assert.ok(!("rpe" in p.side.R));
    });
    t.test("UF-04: thanh đáy — bài ghi 2 bên có bộ chọn T | P, tóm tắt cả 2 bên, 'Tiếp: Tay phải'; bài thường như cũ", async ()=>{
      const a = await t.app();
      setup(a); mkRows(a, true);
      a.run(`window.__R[0].m["select.rpe"].value = "8"`);
      const h = a.ev(`FKFocus.barHTML(${C})`);
      assert.match(h, /data-sf-side="L" class="on"/); assert.match(h, /data-sf-side="R" class=""/);
      assert.match(h, /Tay trái/); assert.match(h, /Tay phải/);
      assert.match(h, /T 70×12 · P 70×12/); assert.match(h, /XONG HIỆP 1/);
      assert.match(h, /data-sf-sidenext[^>]*>Tiếp: Tay phải/);
      assert.match(h, /@8/, "tab bên trái hiện RPE");
      mkRows(a, false);
      const h2 = a.ev(`FKFocus.barHTML(${C})`);
      assert.doesNotMatch(h2, /data-sf-side|Tiếp:/); assert.match(h2, /XONG HIỆP 1<small>70 kg × 12 lần/);
    });
    t.test("UF-05: thanh đáy đổi bên → −/+ KG, −/+ LẦN, RPE cập nhật ĐÚNG ô (set value + input/change); XONG HIỆP bấm ✓ của hàng", async ()=>{
      const a = await t.app();
      setup(a); mkRows(a, true);
      const v = sel=> a.ev(`window.__R[0].m[${JSON.stringify(sel)}].value`);
      act(a, { "data-sf": "kg+" });
      assert.equal(v("input[data-kg]"), "72.5"); assert.equal(v("input[data-kg-r]"), "70", "đang ở T → không đụng P");
      assert.deepEqual(a.evj(`window.__R[0].m["input[data-kg]"].ev`), ["input", "change"]);
      act(a, { "data-sf-sidenext": "" });
      assert.equal(a.ev(`FKFocus.side`), "R");
      const h = a.ev(`FKFocus.barHTML(${C})`);
      assert.match(h, /data-sf-side="R" class="on"/); assert.doesNotMatch(h, /Tiếp: Tay phải/, "đang ở P → chỉ còn XONG HIỆP");
      assert.match(h, /T 72,5×12 · P 70×12/);
      act(a, { "data-sf": "kg-" }); act(a, { "data-sf": "r-" }); act(a, { "data-sf-rpe": "9" });
      assert.equal(v("input[data-kg-r]"), "67.5"); assert.equal(v("input[data-reps-r]"), "11"); assert.equal(v("select.rpe-r"), "9");
      assert.equal(v("input[data-kg]"), "72.5"); assert.equal(v("input[data-reps]"), "12"); assert.equal(v("select.rpe"), "", "RPE trái không đổi");
      act(a, { "data-sf-side": "L" }); act(a, { "data-sf-rpe": "8" });
      assert.equal(v("select.rpe"), "8"); assert.equal(v("select.rpe-r"), "9");
      // về T rồi nhưng P đã chỉnh → không còn gợi ý "Tiếp"
      assert.doesNotMatch(a.ev(`FKFocus.barHTML(${C})`), /Tiếp: Tay phải/);
      // bên phải trống → −/+ bắt đầu từ bên trái cùng hiệp
      a.run(`window.__R[0].m["input[data-kg-r]"].value = ""; window.__R[0].m["input[data-reps-r]"].value = "";`);
      act(a, { "data-sf-side": "R" }); act(a, { "data-sf": "kg+" }); act(a, { "data-sf": "r+" });
      assert.equal(v("input[data-kg-r]"), "75"); assert.equal(v("input[data-reps-r]"), "13");
      act(a, { "data-sf-done": "" });
      assert.equal(a.ev(`window.__R[0].m["[data-done]"].clicks`), 1, "XONG HIỆP = ✓ của hàng (cả 2 bên)");
      assert.equal(a.ev(`FKFocus.side`), "L", "xong hiệp → về T");
    });
    t.test("UF-06: một chạm XONG HIỆP ở T vẫn được (P theo T như bảng) + CSS gọn, dùng token theme", async ()=>{
      const a = await t.app();
      setup(a); mkRows(a, true);
      act(a, { "data-sf-done": "" });
      assert.equal(a.ev(`window.__R[0].m["[data-done]"].clicks`), 1);
      const css = read("style.css");
      assert.match(css, /\.sf-side > button\.on\{[^}]*var\(--accent/); assert.match(css, /\.sf-next\{/); assert.match(css, /\.set-row\.uni select\.rpe-r\{/);
      const src = read("session-focus.js");
      assert.ok(!/state\.[\w.\[\]"]+\s*=[^=]|saveState/.test(src), "thanh vẫn chỉ đọc state");
      assert.match(read("app.js"), /data-rpe-r/);
    });
  }
};

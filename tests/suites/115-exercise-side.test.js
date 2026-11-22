/* 22/11/2026 — Anh Thắng: "Check list lại hết các bài tập, có những bài có 2 option: tập cả 2 tay hoặc từng tay; chân cũng vậy."
   exercise-side.js phân loại mọi bài: "uni" (luôn từng bên) · "either" (hai bên hoặc từng bên) · "bi" (chỉ hai bên).
   Màn tập: bài either có bộ chọn "Hai tay | Từng tay" (bài chân: "Hai chân | Từng chân"), nhớ lựa chọn theo bài; đổi giữa chừng giữ số
   & hiệp ✓; "lần trước" / tự tăng tạ theo CÙNG kiểu tập; bài bi không có bộ chọn; dữ liệu cũ vẫn chạy; bản chụp buổi dở giữ kiểu tập. */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
module.exports = {
  name: "Kiểu tập hai bên / từng bên (exercise-side.js) + bộ chọn trong màn tập",
  area: "exercise-side.js, app.js, session-plus.js, session-focus.js, style.css, index.html",
  async define(t){
    const S = require(path.join(ROOT, "exercise-side.js"));
    const side = (name, eq, extra)=> S.fkExerciseSide(Object.assign({ name, equipment: eq || "" }, extra || {}), extra && extra.item);

    t.test("ES-01: phân loại mẫu đúng 3 nhóm (bài lõi theo id + bài thư viện / tự tạo theo luật)", ()=>{
      const core = { dbrow:"uni", bulgarian:"uni", lunges:"uni", stepup:"uni", kickback:"uni",
        bicepcurl:"either", hammercurl:"either", dbpress:"either", lateralraise:"either", legext:"either", legcurl:"either", legpress:"either",
        calfraise:"either", hipthrust:"either", glutebridge:"either", rdl:"either", cablelateral:"either", inclinedb:"either",
        squat:"bi", benchpress:"bi", deadlift:"bi", pullup:"bi", tricepdip:"bi", plank:"bi", latpulldown:"bi", sideplank:"bi", running:"bi" };
      for(const [id, want] of Object.entries(core)) assert.equal(S.fkExerciseSide({ name: "x" }, { exerciseId: id }), want, id);
      // luật — bài tự tạo / thư viện
      assert.equal(side("One-Arm Dumbbell Row", "Tạ đơn"), "uni");
      assert.equal(side("Single-Leg Romanian Deadlift", "Tạ đơn"), "uni");
      assert.equal(side("Concentration Curls", ""), "uni");
      assert.equal(side("Cuốn tạ đơn đứng (Dumbbell Bicep Curl)", "Tạ đơn"), "either");
      assert.equal(side("Đá tay sau tạ đơn (Tricep Dumbbell Kickback)", "Tạ đơn"), "either");
      assert.equal(side("Dang vai cáp (Cable Lateral Raise)", "Cáp"), "either");
      assert.equal(side("Duỗi đùi máy (Leg Extensions)", "Máy"), "either");
      assert.equal(side("Leverage Iso Row", "Máy"), "either");
      assert.equal(side("Squat tạ đòn (Barbell Squat)", "Thanh đòn"), "bi");
      assert.equal(side("Kéo xà (Pullups)", ""), "bi");
      assert.equal(side("Ép tay sau cáp dây thừng (Triceps Pushdown - Rope Attachment)", "Cáp"), "bi");
      assert.equal(side("Nhún vai tạ đơn (Dumbbell Shrug)", "Tạ đơn"), "bi");
      assert.equal(side("Russian Twist", "Tạ đơn"), "bi", "xoay hai bên trong cùng hiệp");
      assert.equal(side("Bài tự tạo lạ", "—"), "bi", "không rõ → hai bên, không hiện bộ chọn");
      // bảng chỉnh tay cho bài thư viện
      assert.equal(S.fkExerciseSide({ name: "Split Jerk" }, { custom: { exDbId: "Split_Jerk" } }), "bi");
      assert.equal(S.fkExerciseSide({ name: "Dumbbell Shrug", equipment: "Tạ đơn" }, { custom: { exDbId: "Dumbbell_Shrug" } }), "bi");
      // nhãn tay / chân
      assert.equal(S.fkSideKindOf({ name: "Đẩy chân (Leg Press)", muscle: "Chân" }), "leg");
      assert.equal(S.fkSideKindOf({ name: "Cuốn gân kheo (Leg Curl)", muscle: "Chân" }), "leg");
      assert.equal(S.fkSideKindOf({ name: "Đẩy hông tạ đòn (Hip Thrust)", muscle: "Mông" }), "leg");
      assert.equal(S.fkSideKindOf({ name: "Cuốn tay trước (Bicep Curl)", muscle: "Tay trước" }), "arm");
      // mọi bài lõi trong EXERCISES có trong bảng id (đã duyệt tay)
      const ids = [...(read("data.js") + read("templates.js")).matchAll(/^\s{2}([a-z0-9]+)\s*:\s*\{\s*name\s*:/gm)].map(m=> m[1]);
      assert.ok(ids.length >= 60, "đọc được danh sách bài lõi");
      assert.deepEqual(ids.filter(id=> !S.CORE[id]), [], "bài lõi chưa phân loại tay");
    });
    t.test("ES-02: script rà toàn bộ bài chạy được và đủ 3 nhóm; index.html nạp exercise-side.js TRƯỚC app.js; prepare-www.sh chép file", ()=>{
      const out = require("child_process").execFileSync(process.execPath, [path.join(ROOT, "scripts", "side-audit.js")], { encoding: "utf8" });
      const m = /Tổng (\d+): uni (\d+) · either (\d+) · bi (\d+)/.exec(out); assert.ok(m, out);
      assert.ok(Number(m[1]) > 900 && Number(m[2]) > 50 && Number(m[3]) > 100 && Number(m[4]) > 300, out);
      const html = read("index.html");
      const i = html.indexOf('src="exercise-side.js"'), j = html.indexOf('src="app.js"'), k = html.indexOf('src="session-plus.js"');
      assert.ok(i > 0 && i < j && j < k, "thứ tự nạp");
      assert.match(read("scripts/prepare-www.sh"), /exdb\.js exercise-side\.js app\.js/);
    });

    const setup = (a, items)=> a.evj(`(()=>{
      const plan = getActivePlan(); const k = todayDayKey();
      plan.days[k] = plan.days[k] || { title:"x", items:[] };
      plan.days[k].items = ${JSON.stringify(items)};
      startSession(k); return { k };
    })()`);
    const html = a=> a.ev(`document.getElementById("sheet-content").innerHTML`);
    const click = (a, sel)=> a.ev(`(()=>{ const el = document.querySelector('#sheet-content ${sel}'); if(!el) return false; el.click(); return true; })()`);
    const CURL = { uid:"c1", exerciseId:"bicepcurl", sets:3, reps:"10-12", restSec:0 };
    const LEGX = { uid:"l1", exerciseId:"legext", sets:2, reps:"12-15", restSec:0 };
    const SQ = { uid:"s1", exerciseId:"squat", sets:2, reps:"6-8", restSec:0 };
    const ROW = { uid:"r1", exerciseId:"dbrow", sets:2, reps:"10-12", restSec:0 };
    const spyToast = a=> a.run(`window.__T = []; toast = (m)=>{ window.__T.push(String(m)); };`);

    t.test("ES-03: bài either có bộ chọn 'Hai tay | Từng tay' (bài chân: 'Hai chân | Từng chân'), mặc định Hai tay; bài bi không có bộ chọn", async ()=>{
      const a = await t.app();
      setup(a, [CURL, LEGX, SQ]);
      let h = html(a);
      assert.match(h, /data-side-mode="both"[^>]*aria-checked="true"[^>]*>.*Hai tay/s); assert.match(h, /data-side-mode="uni"[^>]*aria-checked="false"[^>]*>.*Từng tay/s);
      assert.doesNotMatch(h, /data-kg-r=/, "mặc định hai tay → không có dòng P"); assert.doesNotMatch(h, /set-side-tg/, "không trùng công tắc cũ");
      a.ev(`session.idx = 1; renderSessionStep();`); h = html(a);
      assert.match(h, /Hai chân/); assert.match(h, /Từng chân/);
      a.ev(`session.idx = 2; renderSessionStep();`); h = html(a);
      assert.doesNotMatch(h, /data-side-mode=/); assert.doesNotMatch(h, /set-side-tg/); assert.doesNotMatch(h, /data-kg-r=/);
    });
    t.test("ES-04: chọn Từng tay → ghi T/P + gợi ý 1 dòng + toast; nhớ lựa chọn cho bài này ở buổi sau; đặt sẵn trong giáo án được ưu tiên", async ()=>{
      const a = await t.app();
      setup(a, [CURL]); spyToast(a);
      assert.ok(click(a, "#set-side-uni"));
      const h = html(a);
      assert.match(h, /data-kg-r="0"/); assert.match(h, /Ghi riêng T\/P — kg mỗi bên/); assert.match(h, /data-side-mode="uni"[^>]*aria-checked="true"/);
      assert.equal(a.ev(`state.sideMode.bicepcurl`), 1); assert.equal(a.ev(`session.sideSel.c1`), "uni");
      assert.match(a.ev(`window.__T.join("|")`), /Đã chuyển sang từng tay/);
      // buổi sau: mặc định = lựa chọn lần trước
      a.run(`session = null;`); setup(a, [CURL]);
      assert.match(html(a), /data-kg-r="0"/, "nhớ Từng tay");
      // giáo án đặt sẵn hai tay → ưu tiên
      a.run(`session = null;`); setup(a, [Object.assign({}, CURL, { side:"both" })]);
      assert.doesNotMatch(html(a), /data-kg-r=/);
      // chỗ sửa bài trong giáo án có bộ chọn 3 nút
      assert.match(a.ev(`fkPlanSideHTML({ exerciseId:"bicepcurl", reps:"10" }, getExerciseMeta({ exerciseId:"bicepcurl" }))`), /Theo lần trước.*Hai tay.*Từng tay/s);
      assert.equal(a.ev(`fkPlanSideHTML({ exerciseId:"squat", reps:"8" }, getExerciseMeta({ exerciseId:"squat" }))`), "");
    });
    t.test("ES-05: đổi chế độ giữa chừng GIỮ số & không mất hiệp ✓ (hai → từng: T=P=số đang có; từng → hai: bên tốt hơn)", async ()=>{
      const a = await t.app();
      setup(a, [CURL]); spyToast(a);
      a.run(`(()=>{ const r = session.sets.c1; r[0].kg = 12; r[0].reps = 11; r[0].done = true; r[1].kg = 12; r[1].reps = 10; })()`);
      assert.ok(click(a, "#set-side-uni"));
      let rows = a.evj(`session.sets.c1.map(r=> ({ kg:r.kg, reps:r.reps, done:!!r.done, R:r.R && { kg:r.R.kg, reps:r.R.reps } }))`);
      assert.deepEqual([rows[0].kg, rows[0].reps, rows[0].done, rows[0].R], [12, 11, true, { kg:12, reps:11 }]);
      assert.deepEqual(rows[1].R, { kg:12, reps:10 });
      // bên phải mạnh hơn ở hiệp 2 → về hai tay lấy bên tốt hơn
      a.run(`(()=>{ const r = session.sets.c1; r[1].R.kg = 14; r[1].R.reps = 10; r[0].R.kg = 10; })()`);
      assert.ok(click(a, "#set-side-both"));
      rows = a.evj(`session.sets.c1.map(r=> ({ kg:r.kg, reps:r.reps, done:!!r.done, R:!!r.R }))`);
      assert.deepEqual(rows[0], { kg:12, reps:11, done:true, R:false }, "T tốt hơn → giữ T, vẫn ✓");
      assert.deepEqual([rows[1].kg, rows[1].reps], [14, 10], "P tốt hơn → lấy P");
      assert.equal(a.ev(`state.sideMode.bicepcurl`), 0);
      assert.match(a.ev(`window.__T.join("|")`), /hai tay — giữ số bên tốt hơn/);
      assert.doesNotMatch(html(a), /data-kg-r=/);
    });
    t.test("ES-06: lưu kiểu tập; 'lần trước' + tự tăng tạ theo CÙNG kiểu; khác kiểu → điền sẵn + ghi chú 'Lần trước tập hai tay'", async ()=>{
      let a = await t.app();
      const ago = `(()=>{ const d = new Date(); d.setDate(d.getDate() - 3); return todayStr(d); })()`;
      // lần trước: hai tay, đạt đỉnh mọi hiệp → buổi này hai tay thì tăng tạ
      a.run(`state.setLog = state.setLog || {}; state.setLog.bicepcurl = { date:${ago}, reps:"10-12", fails:0, prevFails:0, mode:"both", sets:[{ kg:20, reps:12 }, { kg:20, reps:12 }, { kg:20, reps:12 }] };`);
      setup(a, [CURL]);
      assert.ok(Number(a.ev(`session.sets.c1[0].kg`)) > 20, "cùng kiểu → tự tăng tạ");
      // chọn từng tay: chưa có buổi từng tay → không tự tăng, điền sẵn cùng mức tạ mỗi bên + ghi chú
      // (app mới: DOM thử nghiệm giữ nút cũ theo id nên mỗi buổi dùng 1 app)
      a = await t.app();
      a.run(`state.setLog = state.setLog || {}; state.setLog.bicepcurl = { date:${ago}, reps:"10-12", fails:0, prevFails:0, mode:"both", sets:[{ kg:20, reps:12 }, { kg:20, reps:12 }, { kg:20, reps:12 }] };
        state.sideMode = { bicepcurl: 1 };`);
      setup(a, [CURL]);
      const rows = a.evj(`session.sets.c1.map(r=> ({ kg:r.kg, R:r.R && r.R.kg }))`);
      assert.deepEqual([rows[0].kg, rows[0].R], [20, 20], "khác kiểu: giữ 20 kg mỗi bên, không tăng");
      const txt = a.ev(`document.getElementById("sheet-content").textContent`);
      assert.match(txt, /Lần trước tập hai tay/); assert.match(txt, /tự tăng tạ khi đã có buổi từng tay/);
      // lưu buổi từng tay → setLog.mode = uni, bản ghi hai tay giữ ở .other
      a.run(`session.sets.c1.forEach(r=>{ r.kg = 10; r.reps = 12; r.R.kg = 10; r.R.reps = 12; r.done = true; })`);
      assert.ok(click(a, "#btn-session-done"));
      const log = a.evj(`state.setLog.bicepcurl`);
      assert.equal(log.mode, "uni"); assert.ok(log.sets[0].L && log.sets[0].R);
      assert.equal(log.other && log.other.mode, "both"); assert.equal(log.other.sets[0].kg, 20);
      assert.equal(a.evj(`state.setHist.bicepcurl.list.slice(-1)[0].mode`), "uni", "lịch sử có nhãn kiểu");
      // quay lại hai tay → lấy đúng lần hai tay (20 kg, đạt đỉnh → tăng), không lấy buổi từng tay 10 kg
      const lf = a.evj(`fkLastForMode(state.setLog.bicepcurl, "both", "either")`);
      assert.equal(lf.last.sets[0].kg, 20); assert.equal(lf.cross, null);
      const lu = a.evj(`fkLastForMode(state.setLog.bicepcurl, "uni", "either")`);
      assert.equal(lu.last.sets[0].L.kg, 10);
      // lịch sử bài hiển thị nhãn T/P
      a.ev(`openExerciseHistory("bicepcurl", "Cuốn tay")`);
      assert.match(html(a), /class="hist-mode"/);
    });
    t.test("ES-07: bài uni — mặc định T/P, liên kết 'Ghi gộp' (một điều khiển, không trùng); dữ liệu cũ không có mode vẫn tự tăng tạ", async ()=>{
      const a = await t.app();
      a.run(`state.setLog = state.setLog || {}; state.setLog.dbrow = { date:(()=>{ const d = new Date(); d.setDate(d.getDate() - 2); return todayStr(d); })(), reps:"10-12", fails:0, prevFails:0, sets:[{ kg:20, reps:12 }, { kg:20, reps:12 }] };`);
      setup(a, [ROW]);
      const h = html(a);
      assert.match(h, /data-kg-r="0"/); assert.match(h, /id="set-side-tg"[^>]*>Ghi gộp</); assert.doesNotMatch(h, /data-side-mode=/);
      assert.ok(Number(a.ev(`session.sets.r1[0].kg`)) > 20, "dữ liệu cũ (không mode, không L/R) của bài uni vẫn dùng để tăng tạ");
      assert.ok(click(a, "#set-side-tg"));
      assert.match(html(a), /id="set-side-tg"[^>]*>Ghi riêng T\/P</); assert.doesNotMatch(html(a), /data-kg-r=/);
      // fkLogMode: dữ liệu cũ
      assert.equal(a.ev(`fkLogMode({ sets:[{ kg:10, reps:8, L:{ kg:10, reps:8 }, R:{ kg:10, reps:8 } }] })`), "uni");
      assert.equal(a.ev(`fkLogMode({ sets:[{ kg:10, reps:8 }] })`), null);
      assert.equal(a.evj(`fkLastForMode({ sets:[{ kg:10, reps:8 }] }, "uni", "either")`).last, null, "bài either: dữ liệu cũ = hai tay");
    });
    t.test("ES-08: bản chụp buổi dở lưu kiểu tập; khôi phục → vẫn từng tay (thanh đáy có tab T/P), session-plus 'lần trước' cùng kiểu", async ()=>{
      const a = await t.app();
      setup(a, [CURL, SQ]);
      assert.ok(click(a, "#set-side-uni"));
      a.run(`session.sets.c1[0].kg = 9; session.sets.c1[0].R.kg = 11; session.sets.c1[0].done = true;`);
      a.ev(`fkSessSnapshot()`);
      const snap = JSON.parse(a.ev(`localStorage.getItem("fk_active_session_v1")`));
      assert.equal(snap.s.sideSel.c1, "uni"); assert.equal(snap.s.sets.c1[0].R.kg, 11);
      // đổi ghi nhớ toàn cục sang hai tay → buổi đang dở vẫn giữ lựa chọn của buổi
      a.run(`state.sideMode.bicepcurl = 0; session = null;`);
      assert.ok(a.ev(`fkSessRestore()`));
      a.ev(`document.getElementById("rs-go").click()`);
      const h = html(a);
      assert.match(h, /data-kg-r="0"/); assert.match(h, /set-row done uni|set-row uni done|class="set-row done uni"/);
      assert.match(h, /data-side-mode="uni"[^>]*aria-checked="true"/);
      // session-plus / session-focus đọc "lần trước" cùng kiểu
      assert.match(read("session-plus.js"), /lastOf\(st, key, item\)/); assert.match(read("session-focus.js"), /fkSessLast\(curKey\(\), it\)/);
      assert.equal(a.ev(`typeof fkSessLast`), "function");
    });
    t.test("ES-09: giao diện — CSS bộ chọn dùng token theme (accent / on-accent / fk-ov-rgb), nút cao ≥ 40px", ()=>{
      const css = read("style.css");
      assert.match(css, /\.sseg\{[^}]*rgba\(var\(--fk-ov-rgb/); assert.match(css, /\.sseg-b\.on\{[^}]*var\(--accent[^}]*var\(--on-accent/);
      assert.match(css, /\.sseg-b\{[^}]*min-height:40px/);
    });
  }
};

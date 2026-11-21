/* 21/11/2026 — Phản hồi anh Thắng:
   (1) "Kéo cáp cao một tay tư thế quỳ (Kneeling Single-Arm High Pulley Row)" hiện clip Your Move "Seated Cable Row" (ngồi, 2 tay) → khớp video
       phải đúng thuộc tính (một tay/hai tay, quỳ/ngồi, cáp cao/thấp, dụng cụ, biến thể); không chắc → không gắn clip, dùng YouTube đúng tên bài.
   (2) Bổ sung link YouTube đã kiểm (yt-manual.json) cho bài thiếu.
   (3) Bài một bên (từng tay / từng chân) → ghi riêng TRÁI / PHẢI mỗi hiệp, lưu được, khối lượng cộng 2 bên, dữ liệu cũ vẫn chạy. */
"use strict";
const { assert } = require("../lib/framework");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");
const KNEEL = "Kéo cáp cao một tay tư thế quỳ (Kneeling Single-Arm High Pulley Row)";
module.exports = {
  name: "Khớp video đúng động tác + ghi trái/phải cho bài một bên",
  area: "freevideos.js, guide-links.js, yt-manual.json, media/ex3d/index.json, app.js, session-plus.js",
  async define(t){
    const app = await t.app({ fixtures: { "media/ex3d/index.json": "../../media/ex3d/index.json" } });
    const find = async expr=> JSON.parse(JSON.stringify(await app.ev(`findFreeExerciseVideos(${expr})`))).map(v=> v.name);

    t.test("VM-01: Kneeling Single-Arm High Pulley Row KHÔNG còn gán clip Seated Cable Row (giáo án lẫn thư viện)", async ()=>{
      const a = await find(JSON.stringify({ name: KNEEL, equipment: "Cáp", exDbId: "Kneeling_Single-Arm_High_Pulley_Row" }));
      const b = await find(JSON.stringify({ name: "Kneeling Single-Arm High Pulley Row", equipment: "cable" }));
      const c = await find(JSON.stringify({ name: "Kneeling High Pulley Row", equipment: "cable", exDbId: "Kneeling_High_Pulley_Row" }));
      for(const r of [a, b, c]) assert.ok(!r.some(n=> /seated|rowing seated|single arm dumbbell row/i.test(n)), "còn clip sai: " + r.join(", "));
      assert.equal(app.call("fvScore", KNEEL + " cable", { name: "Seated Cable Row" }), 0);
    });
    t.test("VM-02: thuộc tính phải khớp — một tay ↔ hai tay, quỳ/nằm ↔ ngồi/đứng, cáp cao/thấp, biến thể đặc thù", ()=>{
      const S = (a, b, e)=> app.call("fvScore", a, Object.assign({ name: b }, e || {}));
      assert.equal(S("Bent Over Two-Dumbbell Row dumbbell", "Single Arm Dumbbell Row"), 0, "2 tay ≠ clip 1 tay");
      assert.equal(S("Seated One-arm Cable Pulley Rows cable", "Seated Cable Row"), 0, "1 tay ≠ clip 2 tay");
      assert.equal(S("Standing Dumbbell Upright Row dumbbell", "Single Arm Dumbbell Row"), 0, "Upright Row ≠ Row");
      assert.equal(S("Low Cable Crossover cable", "Cable Crossover"), 0, "cáp thấp phải ghi rõ");
      assert.equal(S("Weighted Jump Squat", "Jump Rope"), 0, "Jump Squat ≠ Jump Rope");
      assert.equal(S("Car Deadlift", "Barbell Deadlift"), 0, "biến thể khác động tác");
      assert.equal(S("Mở hông máy (Hip Abduction) machine", "Hip Abduction", { equip: "bodyweight" }), 0, "máy ≠ clip tay không");
      assert.ok(S("Kéo cáp ngồi (Seated Cable Row) cable", "Seated Cable Row") > 10, "bài đúng vẫn khớp");
      assert.ok(S("Kéo tạ đơn một tay (Single Arm Dumbbell Row)", "Single Arm Dumbbell Row") > 10);
      assert.ok(S("Gánh tạ (Back Squat) barbell", "Barbell Back Squat") > 10);
      // alias tiếng Việt: chỉ nhận TRỌN tên bài của app, không ăn chuỗi con
      assert.equal(S("Kéo tạ gập người một tay (One-Arm Row)", "Bent-over Row", { alias: ["kéo tạ gập người"] }), 0);
    });
    t.test("VM-03: mọi bài giáo án mẫu có clip đều đúng thuộc tính (script rà scripts/video-audit.js ≤ 3 cảnh báo đã duyệt)", async ()=>{
      const { run } = require(path.join(ROOT, "scripts", "video-audit.js"));
      const rows = await run();
      const bad = rows.filter(r=> r.why.length && !["walking", "intervalwalk", "Standing_Low-Pulley_Deltoid_Raise"].includes(r.id));
      assert.deepEqual(bad.map(r=> r.id + " → " + r.clip.name), []);
      const k = rows.find(r=> r.id === "Kneeling_Single-Arm_High_Pulley_Row"); assert.equal(k.clip, null);
    });
    t.test("VM-04: video 3D — tên/id đúng động tác (clip 1 tay không mang tên 2 tay, quỳ ≠ ngồi, OHP đứng ≠ military ngồi)", ()=>{
      const idx = JSON.parse(read("media/ex3d/index.json"));
      const by = s=> idx.find(x=> x.slug === s);
      assert.equal(by("dumbbell-bent-over-row").name, "One-Arm Dumbbell Row");
      assert.ok(!by("cable-seated-high-row-v-bar").ids.includes("Kneeling_High_Pulley_Row"));
      assert.ok(!by("military-press").core.includes("overheadpress"));
      assert.ok(!by("lever-leg-extension").ids.includes("Single-Leg_Leg_Extension"));
      assert.equal(app.ev("FV_CORE_EXDB.overheadpress"), "Standing_Military_Press");
    });
    t.test("YT-01: link YouTube đã kiểm cho bài thiếu (yt-manual.json) — ID hợp lệ, trỏ đúng id bài thư viện; alias sai tư thế đã gỡ", ()=>{
      const m = JSON.parse(read("yt-manual.json")).items;
      const need = ["Kneeling_Single-Arm_High_Pulley_Row", "Kneeling_High_Pulley_Row", "One_Arm_Lat_Pulldown", "One_Arm_Dumbbell_Bench_Press", "Dumbbell_One-Arm_Shoulder_Press", "One-Arm_Kettlebell_Swings"];
      const vi = read("exdb-vi-1.js") + read("exdb-vi-2.js") + read("exdb-vi-3.js");
      for(const k of need){ assert.ok(Array.isArray(m[k]) && m[k].length >= 1, "thiếu " + k); assert.ok(m[k].every(x=> /^[A-Za-z0-9_-]{11}$/.test(x))); assert.ok(vi.includes(`"${k}":{n:`), "không có bài " + k); }
      assert.equal(m["Kneeling_Single-Arm_High_Pulley_Row"][0], "83BT6B4v7T4");
      const A = app.evj("FKYT.EXDB_ALIAS");
      for(const k of ["Barbell_Shoulder_Press", "Seated_Barbell_Military_Press", "Bent_Over_Two-Dumbbell_Row", "Split_Squat_with_Dumbbells"]) assert.ok(!(k in A), "alias sai còn: " + k);
      // bài không có video → nút tìm YouTube đúng tên tiếng Anh
      assert.match(app.ev(`FKYT.url(${JSON.stringify(KNEEL)})`), /search_query=Kneeling%20Single-Arm%20High%20Pulley%20Row%20proper%20form/);
    });
    t.test("UNI-01: nhận diện bài một bên + nhãn Tay/Chân", ()=>{
      const U = (name, reps)=> app.call("fkIsUnilateral", { name }, reps || "");
      for(const n of [KNEEL, "Kéo tạ đơn một tay (Single Arm Dumbbell Row)", "Squat tách chân Bulgaria (Bulgarian Split Squat)", "Lunge (Bước chùng chân)",
        "Bước bục tạ đơn (Dumbbell Step-up)", "Single-Leg Romanian Deadlift", "Pistol Squat", "Concentration Curl", "One-Arm Kettlebell Swings"]) assert.ok(U(n), n);
      for(const n of ["Gánh tạ (Back Squat)", "Đẩy ngực nằm (Bench Press)", "Plank nghiêng (Side Plank)", "Russian Twist", "Kéo cáp ngồi (Seated Cable Row)"]) assert.ok(!U(n), n);
      assert.ok(U("Đá mông cáp (Glute Kickback)", "12-15 mỗi chân"));
      assert.deepEqual(app.evj(`fkSideLabels({ name:"Squat tách chân Bulgaria (Bulgarian Split Squat)", muscle:"Chân / Mông" })`), ["Chân trái", "Chân phải"]);
      assert.deepEqual(app.evj(`fkSideLabels(EXERCISES.dbrow)`), ["Tay trái", "Tay phải"]);
    });
    t.test("UNI-02: khối lượng / 1RM / bản ghi gộp 2 bên; dữ liệu cũ (không L/R) như trước", ()=>{
      assert.equal(app.ev(`fkSetVol({ kg:20, reps:10, R:{ kg:20, reps:8 } })`), 360);
      assert.equal(app.ev(`fkSetVol({ kg:22, reps:8, L:{ kg:20, reps:10 }, R:{ kg:22, reps:8 } })`), 376);
      assert.equal(app.ev(`fkSetVol({ kg:20, reps:10 })`), 200);
      assert.equal(app.ev(`fkSetVol({ kg:"", reps:10, R:{ kg:"", reps:9 } }, 15)`), 285);
      const rec = app.evj(`fkRowRecord({ kg:20, reps:10, R:{ kg:22, reps:8 }, rpe:"8" }, false)`);
      assert.deepEqual([rec.kg, rec.reps, rec.L, rec.R, rec.rpe], [22, 8, { kg:20, reps:10 }, { kg:22, reps:8 }, 8]);
      assert.ok(app.ev(`fkSetE1rm({ kg:22, reps:8, L:{ kg:20, reps:12 }, R:{ kg:22, reps:8 } })`) > app.ev(`e1rm(22, 8)`) - 0.01);
      assert.equal(app.ev(`fkSetE1rm({ kg:60, reps:5 })`), app.ev(`e1rm(60, 5)`));
    });

    /* ---- luồng thật trong màn tập ---- */
    const setup = a=> a.evj(`(()=>{
      const plan = getActivePlan(); const k = todayDayKey();
      plan.days[k] = plan.days[k] || { title:"x", items:[] };
      plan.days[k].items = [
        { uid:"uni1", exerciseId:"dbrow", sets:2, reps:"10-12 mỗi tay", restSec:0 },
        { uid:"uni2", exerciseId:null, custom:{ name:${JSON.stringify(KNEEL)}, muscle:"Lưng", equipment:"Cáp", guide:"Quỳ một gối…", exDbId:"Kneeling_Single-Arm_High_Pulley_Row" }, sets:2, reps:"10-12", restSec:0 },
        { uid:"bi1", exerciseId:"squat", sets:2, reps:"6-8", restSec:0 } ];
      startSession(k); return { k };
    })()`);
    const typeIn = (a, sel, v)=> a.ev(`(()=>{ const el = document.querySelector('#sheet-content ${sel}'); if(!el) return false; el.value = ${JSON.stringify(String(v))}; el.dispatchEvent(new Event("change")); return true; })()`);
    const click = (a, sel)=> a.ev(`(()=>{ const el = document.querySelector('#sheet-content ${sel}'); if(!el) return false; el.click(); return true; })()`);

    t.test("UNI-03: màn ghi hiệp bài một bên có ô TRÁI (T) / PHẢI (P), công tắc 'Ghi riêng trái / phải'; bài 2 bên không có", async ()=>{
      const a = await t.app();
      setup(a);
      const h = a.ev(`document.getElementById("sheet-content").innerHTML`);
      assert.match(h, /set-side-tg/); assert.match(h, /data-kg-r="0"/); assert.match(h, /data-reps-r="1"/);
      assert.match(h, /class="side-tag"[^>]*>T</); assert.match(h, /side-tag r"[^>]*>P</); assert.match(h, /Tay phải/);
      // bỏ qua 2 bài một bên → bài squat (2 bên)
      a.ev(`session.idx = 2; renderSessionStep();`);
      const h2 = a.ev(`document.getElementById("sheet-content").innerHTML`);
      assert.doesNotMatch(h2, /data-kg-r=/); assert.doesNotMatch(h2, /set-side-tg/);
    });
    t.test("UNI-04: gõ trái → phải tự theo; sửa phải riêng; ✓ hiệp; lưu L/R vào setLog/setHist; khối lượng cộng 2 bên; bản chụp buổi giữ bên phải", async ()=>{
      const a = await t.app();
      setup(a);
      /* DOM thử nghiệm không dựng ô nhập từ HTML → gọi đúng các hàm mà ô nhập gọi (setKg của app + fkSideSync / fkSideSetR) */
      a.run(`(()=>{ const rows = session.sets.uni1; rows[0].kg = 20; rows[0]._edited = true; rows[1].kg = 20; fkSideSync(rows, 0); rows[0].reps = 12; fkSideSync(rows, 0, true); })()`);
      assert.equal(a.ev(`session.sets.uni1[0].R.kg`), 20, "phải theo trái"); assert.equal(a.ev(`session.sets.uni1[0].R.reps`), 12);
      assert.equal(a.ev(`session.sets.uni1[1].R.kg`), 20, "điền xuống hiệp sau");
      a.run(`(()=>{ const rows = session.sets.uni1; fkSideSetR(rows, 0, "reps", "10"); fkSideSetR(rows, 1, "kg", "22"); fkSideSetR(rows, 1, "reps", "9");
        rows[1].reps = 12; rows[0].kg = 18; fkSideSync(rows, 0); })()`);
      assert.equal(a.ev(`session.sets.uni1[0].R.reps`), 10, "bên phải đã sửa tay thì không bị ghi đè");
      assert.equal(a.ev(`session.sets.uni1[0].R.kg`), 18, "kg phải chưa sửa tay → theo trái");
      assert.equal(a.ev(`session.sets.uni1[1].R.kg`), 22);
      a.ev(`fkSessSnapshot()`);
      const snap = JSON.parse(a.ev(`localStorage.getItem("fk_active_session_v1")`));
      assert.equal(snap.s.sets.uni1[1].R.kg, 22, "bản chụp buổi tập giữ dữ liệu bên phải");
      a.run(`session.sets.uni1.forEach(r=> r.done = true)`);
      assert.ok(click(a, "#btn-session-done"));
      const log = a.evj(`state.setLog.dbrow`);
      assert.equal(log.sets.length, 2, "1 bản ghi / hiệp (không nhân đôi số hiệp)");
      assert.deepEqual(log.sets[0].L, { kg:18, reps:12 }); assert.deepEqual(log.sets[0].R, { kg:18, reps:10 });
      assert.deepEqual(log.sets[1].L, { kg:20, reps:12 }); assert.deepEqual(log.sets[1].R, { kg:22, reps:9 });
      assert.deepEqual([log.sets[1].kg, log.sets[1].reps], [22, 9], "gộp: kg lớn nhất, lần ít nhất (tự tăng tạ cần đủ lần CẢ 2 bên)");
      const h = a.evj(`state.setHist.dbrow.list.slice(-1)[0]`);
      assert.equal(h.vol, 18*12 + 18*10 + 20*12 + 22*9, "khối lượng cộng cả 2 bên");
      assert.ok(h.sets[1].L && h.sets[1].R);
    });
    t.test("UNI-05: buổi sau — 'Lần trước' theo từng bên + điền sẵn từng bên; tắt công tắc → ghi như cũ", async ()=>{
      const st = { onboarded:true };
      const a = await t.app();
      setup(a);
      a.run(`state.setLog = state.setLog || {}; state.setLog.dbrow = { date:"2026-11-01", reps:"10-12 mỗi tay", fails:0, prevFails:0, sets:[{ kg:20, reps:10, L:{ kg:18, reps:12 }, R:{ kg:20, reps:10 } }, { kg:22, reps:9, L:{ kg:18, reps:12 }, R:{ kg:22, reps:9 } }] };
        delete session.sets.uni1; renderSessionStep();`);
      const txt = a.ev(`document.getElementById("sheet-content").textContent`);
      assert.match(txt, /T 18(,0)?kg×12 \/ P 20(,0)?kg×10|T 18×12 · P 20×10/, "lần trước theo từng bên");
      const rows = a.evj(`session.sets.uni1.map(r=> ({ kg:r.kg, reps:r.reps, R:r.R }))`);
      assert.ok(rows[0].R && Number(rows[0].R.kg) > 0, "điền sẵn bên phải");
      // công tắc: tắt ghi riêng
      assert.ok(click(a, "#set-side-tg"));
      assert.equal(a.ev(`state.sideMode.dbrow`), 0);
      assert.doesNotMatch(a.ev(`document.getElementById("sheet-content").innerHTML`), /data-kg-r=/);
      a.run(`session.sets.uni1[0].kg = 20; session.sets.uni1[0].done = true`); assert.ok(click(a, "#btn-session-done"));
      const log = a.evj(`state.setLog.dbrow`);
      assert.ok(!log.sets[0].L && !log.sets[0].R, "tắt → bản ghi kiểu cũ");
      void st;
    });
    t.test("UNI-06: dữ liệu cũ (setLog/setHist không có L/R) vẫn đọc, gợi ý tăng tạ + kỷ lục chạy; recordExerciseResult loại L/R hỏng", async ()=>{
      const a = await t.app();
      a.run(`state.setLog = state.setLog || {}; state.setHist = state.setHist || {}; state.setLog.dbrow = { date:(()=>{ const d = new Date(); d.setDate(d.getDate() - 2); return todayStr(d); })(), reps:"10-12", fails:0, prevFails:0, sets:[{ kg:20, reps:12 }, { kg:20, reps:12 }] };
        state.setHist.dbrow = { name:"x", list:[{ date:(()=>{ const d = new Date(); d.setDate(d.getDate() - 2); return todayStr(d); })(), e1rm:28, top:20, vol:480, sets:[{ kg:20, reps:12 }, { kg:20, reps:12 }] }] };`);
      setup(a);
      const rows = a.evj(`session.sets.uni1.map(r=> ({ kg:r.kg, R:r.R }))`);
      assert.ok(Number(rows[0].kg) > 20, "đạt đỉnh mọi hiệp → tự tăng tạ: " + JSON.stringify(rows));
      assert.equal(String(rows[0].R.kg), String(rows[0].kg), "bên phải theo mức mới");
      a.run(`recordExerciseResult("zz", "Z", "8-10", [{ kg:30, reps:8, L:{ kg:30, reps:8 }, R:"hỏng" }, { kg:30, reps:8, L:{ kg:"x", reps:-3 }, R:{ kg:32, reps:7, junk:1 } }], false)`);
      const z = a.evj(`state.setLog.zz.sets`);
      assert.ok(!z[0].L && !z[0].R, "L/R hỏng → bỏ"); assert.deepEqual(z[1].L, { kg:30, reps:0 }); assert.deepEqual(z[1].R, { kg:32, reps:7 });
    });
    t.test("UNI-07: session-plus — 'Lần trước' từng bên, thêm hiệp giữ bên phải, số liệu trực tiếp cộng 2 bên", ()=>{
      const W = {}; W.window = W;
      new Function("window", read("session-plus.js").replace('typeof window !== "undefined" ? window : globalThis', "window"))(W);
      const P = W.FKSessionPlus;
      const last = { sets:[{ kg:22, reps:9, L:{ kg:20, reps:10 }, R:{ kg:22, reps:9 } }] };
      assert.deepEqual(P.prevFor(last, [{}], 0).side, { L:{ kg:20, reps:10 }, R:{ kg:22, reps:9 } });
      assert.equal(P.prevFor({ sets:[{ kg:20, reps:10 }] }, [{}], 0).side, undefined, "dữ liệu cũ");
      const rows = [{ kg:20, reps:10, R:{ kg:22, reps:9 }, done:true }];
      assert.ok(P.addRow(rows)); assert.deepEqual(rows[1].R, { kg:22, reps:9 });
      assert.equal(P.stats({ sets:{ a: rows } }).vol, 20*10 + 22*9);
    });
    t.test("UNI-08: giao diện — CSS ô trái/phải, video khung trống mời xem YouTube; migration gỡ clip đã gắn sai", async ()=>{
      const css = read("style.css");
      assert.match(css, /\.set-row\.uni\{ flex-wrap:wrap/); assert.match(css, /\.vb-msg\.vb-yt/);
      assert.match(read("video.js"), /FKYT\.button\(nm, "in-vblock"\)/);
      const a = await t.app({ fixtures: { "media/ex3d/index.json": "../../media/ex3d/index.json" } });
      const r = JSON.parse(JSON.stringify(await a.ev(`(async()=>{
        state.videoMatchV = 0;
        state.plans.__m = { id:"__m", name:"m", days:{ T2:{ title:"x", items:[
          { uid:"k1", exerciseId:null, custom:{ name:${JSON.stringify(KNEEL)}, equipment:"Cáp", exDbId:"Kneeling_Single-Arm_High_Pulley_Row" }, stock:{ provider:"YMove", url:"https://ymove.app/api/free/77976f52-b13a-4fd0-addf-f4404e3a8e95" } },
          { uid:"k2", exerciseId:"cablerow", stock:{ provider:"YMove", url:"https://ymove.app/api/free/77976f52-b13a-4fd0-addf-f4404e3a8e95" } } ] },
          T3:{items:[]},T4:{items:[]},T5:{items:[]},T6:{items:[]},T7:{items:[]},CN:{items:[]} } };
        await refreshPlanVideos(true);
        const it = state.plans.__m.days.T2.items; return { k1: it[0].stock || null, k2: it[1].stock && it[1].stock.url, v: state.videoMatchV };
      })()`)));
      assert.equal(r.k1, null, "clip Seated Cable Row gắn cho bài quỳ 1 tay bị gỡ");
      assert.match(r.k2 || "", /77976f52/, "bài Seated Cable Row giữ clip đúng"); assert.equal(r.v, 2);
    });
  }
};

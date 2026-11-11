/* Buổi tập: phân tích chuỗi reps, tự tăng/giảm tạ, 1RM, chuỗi ngày tập, khởi động & đĩa tạ (app.js) */
"use strict";
const { assert, approx, expectNone } = require("../lib/framework");

/* [chuỗi reps thực tế trong EXERCISES/PROGRAM_TEMPLATES, repTop, repBottom, isTimedReps, isMaxReps] — đã rà tay từng dòng */
const REPS = [
  ["6-8",8,6,false,false], ["8-10",10,8,false,false], ["12-15",15,12,false,false], ["6-10",10,6,false,false], ["10-12",12,10,false,false],
  ["5-6",6,5,false,false], ["15",15,15,false,false], ["10-12 mỗi chân",12,10,false,false], ["15-20",20,15,false,false],
  ["45-60 giây",60,45,true,false], ["20 (mỗi bên 1 lần)",20,20,false,false], ["20-30 phút",30,20,true,false],
  ["30s nhảy / 30s nghỉ",30,30,true,false], ["15-20 phút",20,15,true,false], ["8-12",12,8,false,false], ["10 mỗi chân",10,10,false,false],
  ["10-12 mỗi tay",12,10,false,false], ["12-15 mỗi chân",15,12,false,false], ["10 mỗi bên",10,10,false,false],
  ["30 giây mỗi bên",30,30,true,false], ["30 giây",30,30,true,false], ["30 phút",30,30,true,false], ["12 mỗi bên",12,12,false,false],
  ["12",12,12,false,false], ["10 phút",10,10,true,false], ["8-12 mỗi chân",12,8,false,false], ["10-15",15,10,false,false],
  ["20 m",20,20,true,false], ["40 m",40,40,true,false], ["30-45 phút",45,30,true,false], ["3 phút nhanh + 3 phút chậm",3,3,true,false],
  ["10 · tạ nhẹ, học kỹ thuật",10,10,false,false], ["40 phút",40,40,true,false], ["5-8",8,5,false,false], ["4-6 · RPE 7",6,4,false,false],
  ["3-5 · RPE 8",5,3,false,false], ["2-4 · RPE 8",4,2,false,false], ["30-45 giây",45,30,true,false], ["20-30 giây mỗi bên",30,20,true,false],
  ["35-40 phút",40,35,true,false], ["1 phút nhanh / 1 phút chậm",1,1,true,false], ["4-8",8,4,false,false], ["6-8 · RPE 8",8,6,false,false],
  ["45 giây",45,45,true,false], ["3 · RPE 8",3,3,false,false], ["3-6",6,3,false,false], ["tối đa −2",0,0,false,true],
  ["15-20 phút, dốc 6–8% · mỗi tuần +1–2% tới 12%",20,15,true,false], ["20 giây",20,20,true,false], ["20 bước",20,20,false,false],
  ["500 m",500,500,true,false], ["1 km",1,1,true,false], ["1000 m",1000,1000,true,false], ["50",50,50,false,false],
  ["50-60 phút chạy nhẹ",60,50,true,false], ["800 m nhanh / 2 phút đi bộ",800,800,true,false], ["30-40 phút nhẹ",40,30,true,false],
  /* biến thể người dùng/PT hay gõ */
  ["8–12",12,8,false,false], ["AMRAP",0,0,false,true], ["Max",0,0,false,true], ["60s",60,60,true,false], ["12 lần",12,12,false,false], ["",0,0,true,false],
];

module.exports = {
  name: "Buổi tập: reps, tự tăng tạ, 1RM, streak, khởi động",
  area: "Buổi tập (app.js §Guided session, TIẾN TRÌNH TỰ ĐỘNG)",
  async define(t){
    const app = await t.app();
    const C = (fn, ...a)=> app.call(fn, ...a);
    const BENCH = { equipment:"Thanh đòn" }, DB = { equipment:"Tạ đơn" };

    /* ---------- reps ---------- */
    t.test(`repTop/repBottom/isTimedReps/isMaxReps: ${REPS.length} chuỗi (≥ 40 chuỗi thực tế)`, ()=>{
      const bad = [];
      for(const [r, top, bot, timed, max] of REPS){
        const got = [C("repTop", r), C("repBottom", r), C("isTimedReps", r), C("isMaxReps", r)];
        if(JSON.stringify(got) !== JSON.stringify([top, bot, timed, max])) bad.push(`"${r}": ${JSON.stringify(got)} ≠ ${JSON.stringify([top,bot,timed,max])}`);
      }
      expectNone(bad, "Phân tích reps sai");
      assert.ok(REPS.length - 6 >= 40);
    });
    t.test("Mọi chuỗi reps trong EXERCISES + PROGRAM_TEMPLATES thoả bất biến (bottom ≤ top, có số lần nếu không phải tính giờ/tối đa)", ()=>{
      const all = app.evj(`(()=>{ const s=new Set(); Object.values(EXERCISES).forEach(e=>s.add(String(e.reps))); PROGRAM_TEMPLATES.forEach(t=>Object.values(t.days).forEach(d=>d.ex.forEach(e=>s.add(String(e[2]))))); return [...s]; })()`);
      const bad = [];
      for(const r of all){
        const top = C("repTop", r), bot = C("repBottom", r), timed = C("isTimedReps", r), max = C("isMaxReps", r);
        if(bot > top) bad.push(`"${r}": bottom ${bot} > top ${top}`);
        if(timed && max) bad.push(`"${r}": vừa tính giờ vừa tối đa`);
        if(!timed && !max && !(top > 0)) bad.push(`"${r}": không có số lần`);
        if(/giây|phút|\bkm\b|\d\s*m(\s|$|\/)/.test(r) && !timed) bad.push(`"${r}": có đơn vị thời gian/quãng đường nhưng không tính giờ`);
      }
      expectNone(bad, "Chuỗi reps bất thường");
      assert.ok(all.length >= 40, `chỉ có ${all.length} chuỗi`);
    });
    t.test("exKey: bài có sẵn → exerciseId; bài tuỳ chỉnh → 'c:' + tên", ()=>{
      assert.equal(C("exKey", { exerciseId:"squat" }), "squat");
      assert.equal(C("exKey", { custom:{ name:"Kéo dây kháng lực" } }), "c:Kéo dây kháng lực");
    });

    /* ---------- e1rm ---------- */
    t.test("e1rm: Epley kg×(1+lần/30), 1 lần = kg, trần 12 lần, dữ liệu rỗng → 0", ()=>{
      approx(C("e1rm", 100, 5), 116.667, 0.01);
      assert.equal(C("e1rm", 100, 1), 100);
      approx(C("e1rm", 100, 20), 140, 1e-9);            // tính như 12 lần
      approx(C("e1rm", "80", "8"), 101.333, 0.01);
      assert.equal(C("e1rm", 0, 10), 0); assert.equal(C("e1rm", 60, 0), 0); assert.equal(C("e1rm", undefined, undefined), 0);
    });

    /* ---------- progressionFor (đơn vị) ---------- */
    const last = (date, sets, fails=0)=> ({ date, sets, fails });
    const S = (kg, reps, rpe)=> ({ kg, reps, rpe });
    t.test("progressionFor: không có buổi trước / bài tính giờ / đã tập hôm nay → giữ nguyên", ()=>{
      app.setNow("2026-03-02T10:00");
      const item = { reps:"6-8" };
      assert.equal(C("progressionFor", item, BENCH, null, false, 3).delta, 0);
      assert.equal(C("progressionFor", item, BENCH, last("2026-02-27", [S(60,8),S(60,8),S(60,8)]), true, 3).delta, 0);
      assert.equal(C("progressionFor", item, BENCH, last("2026-03-02", [S(60,8),S(60,8),S(60,8)]), false, 3).delta, 0);
    });
    t.test("progressionFor: đạt đỉnh mọi hiệp → +2,5 kg (thanh đòn); tạ đơn ≤ 10 kg → +1, > 10 kg → +2", ()=>{
      app.setNow("2026-03-02T10:00");
      let p = C("progressionFor", { reps:"6-8" }, BENCH, last("2026-02-27", [S(60,8),S(60,8),S(60,9)]), false, 3);
      assert.equal(p.delta, 1); assert.equal(p.kg, 62.5);
      p = C("progressionFor", { reps:"10-12" }, DB, last("2026-02-27", [S(8,12),S(8,12),S(8,12)]), false, 3);
      assert.equal(p.kg, 9);
      p = C("progressionFor", { reps:"10-12" }, DB, last("2026-02-27", [S(14,12),S(14,12),S(14,12)]), false, 3);
      assert.equal(p.kg, 16);
    });
    t.test("progressionFor: RPE ≥ 9,5 hoặc thiếu hiệp → không tăng; trượt 2 buổi → giảm ~10% theo nấc tạ", ()=>{
      app.setNow("2026-03-02T10:00");
      assert.equal(C("progressionFor", { reps:"6-8" }, BENCH, last("2026-02-27", [S(60,8,8),S(60,8,9),S(60,8,10)]), false, 3).delta, 0);
      assert.equal(C("progressionFor", { reps:"6-8" }, BENCH, last("2026-02-27", [S(60,8),S(60,8)]), false, 3).delta, 0);
      const d = C("progressionFor", { reps:"6-8" }, BENCH, last("2026-02-27", [S(100,4),S(100,4),S(100,3)], 2), false, 3);
      assert.equal(d.delta, -1); assert.equal(d.kg, 90);
      const d2 = C("progressionFor", { reps:"6-8" }, BENCH, last("2026-02-27", [S(2.5,4)], 2), false, 1);
      assert.equal(d2.kg, 2.5, "không giảm dưới 1 nấc tạ");
    });
    t.test("progressionFor: hiệp tụt tạ (drop set) không được tính là 'đạt đỉnh ở mọi hiệp'", ()=>{
      app.setNow("2026-03-02T10:00");
      const p = C("progressionFor", { reps:"6-8" }, BENCH, last("2026-02-27", [S(60,8),S(60,8),S(40,8)]), false, 3);
      assert.equal(p.delta, 0, `app tăng lên ${p.kg} kg dù hiệp 3 chỉ tập 40 kg`);
    }, { bug:"BUG-11", severity:"Thấp" });

    /* ---------- Mô phỏng 8 tuần (16 buổi, T2 + T5) ---------- */
    t.test("Mô phỏng 8 tuần bench press 3×6-8: đạt → tăng, trượt 2 buổi → giảm tải, RPE 10 → giữ, ghi 2 lần/ngày không đếm trùng", ()=>{
      app.run("state.setLog = {}; state.setHist = {}; session = null;");
      const key = "benchpress", item = { exerciseId:key, reps:"6-8", sets:3 };
      const days = []; const d0 = new Date(2026, 2, 2);            // T2 02/03/2026
      for(let w = 0; w < 8; w++){ for(const off of [0, 3]){ const d = new Date(d0); d.setDate(d0.getDate() + w*7 + off); days.push(d); } }
      /* kịch bản: [số lần mỗi hiệp, rpe] — kg do app gợi ý (prefill) như trên màn buổi tập */
      const plan = [
        [[8,8,8]], [[8,8,7]], [[8,8,8]], [[6,5,5]], [[5,5,5]],          // 60 → 62.5 (giữ) → 62.5 đạt → 65 trượt, trượt
        [[8,8,8]], [[8,8,8]], [[8,8,8], 10], [[8,8,8]], [[8,8,8]],      // giảm tải 57.5 → 60 → 62.5 (RPE10 giữ) → 62.5 → 65
        [[8,8,7]], [[8,8,8]], [[7,7,6]], [[8,8,8]], [[6,6,6]], [[8,8,8]],
      ];
      const want = [60, 62.5, 62.5, 65, 65, 57.5, 60, 62.5, 62.5, 65, 67.5, 67.5, 70, 70, 72.5, 72.5];
      const got = [], msgs = [];
      let kg = 60;
      plan.forEach(([reps, rpe], i)=>{
        app.setNow(days[i].getTime() + 9*3600e3);
        const lastRec = app.ev(`state.setLog[${JSON.stringify(key)}]`);
        const prog = C("progressionFor", item, BENCH, lastRec, false, 3);
        if(lastRec) kg = prog.delta ? prog.kg : Math.max(...lastRec.sets.map(s=> s.kg));
        got.push(kg); if(prog.msg) msgs.push(`buổi ${i+1}: ${prog.delta > 0 ? "+" : "−"} ${prog.kg}`);
        const sets = reps.map(r=> ({ kg, reps:r, rpe: rpe || undefined }));
        C("recordExerciseResult", key, "Đẩy ngực nằm (Bench Press)", "6-8", sets, false);
        if(i === 3) C("recordExerciseResult", key, "Đẩy ngực nằm (Bench Press)", "6-8", sets, false);   // bấm lưu 2 lần cùng ngày
      });
      assert.deepEqual(got, want, "Quỹ đạo mức tạ:\n      " + msgs.join(" · "));
      const h = app.evj(`state.setHist[${JSON.stringify(key)}]`);
      assert.equal(h.list.length, 16, "mỗi ngày đúng 1 bản ghi lịch sử");
      assert.ok(h.list.every((x, i, a)=> !i || a[i-1].date < x.date), "lịch sử phải sắp theo ngày");
      approx(h.list[h.list.length-1].e1rm, Math.round(72.5*(1+8/30)*10)/10, 0.05, "e1rm buổi cuối");
    });
    t.test("recordExerciseResult: trượt 3 buổi liền ở CÙNG mức tạ (không nhận giảm tải) → buổi 4 vẫn phải gợi ý giảm tải", ()=>{
      app.run("state.setLog = {}; state.setHist = {};");
      const item = { reps:"6-8" }; let p;
      ["2026-04-06","2026-04-09","2026-04-13"].forEach(d=>{ app.setNow(d + "T09:00"); C("recordExerciseResult", "squat", "Squat", "6-8", [S(100,4),S(100,4),S(100,4)], false); });
      app.setNow("2026-04-16T09:00");
      p = C("progressionFor", item, BENCH, app.ev("state.setLog.squat"), false, 3);
      assert.equal(p.delta, -1, `sau 3 buổi trượt liền: fails = ${app.ev("state.setLog.squat.fails")}, không gợi ý giảm tải`);
    }, { bug:"BUG-11", severity:"Thấp" });
    t.test("recordExerciseResult: bài tính giờ chỉ lưu setLog, không tạo lịch sử 1RM; tạ 0 kg (bodyweight) không bị tính trượt", ()=>{
      app.run("state.setLog = {}; state.setHist = {};"); app.setNow("2026-05-04T09:00");
      C("recordExerciseResult", "plank", "Plank", "45-60 giây", [S(0,0),S(0,0)], true);
      assert.ok(app.ev("state.setLog.plank")); assert.equal(app.ev("state.setHist.plank"), undefined);
      C("recordExerciseResult", "pullup", "Pull-up", "6-10", [S(0,3),S(0,3),S(0,2)], false);
      assert.equal(app.ev("state.setLog.pullup.fails"), 0);
    });
    t.test("recordExerciseResult: kỷ lục mới (e1rm > cũ + 0,4) → ghi session.prs; lịch sử giữ tối đa 120 buổi", ()=>{
      app.run("state.setLog = {}; state.setHist = {}; session = { items:[], idx:0 };");
      app.setNow("2026-06-01T09:00"); C("recordExerciseResult", "deadlift", "Deadlift", "5-6", [S(100,5)], false);
      app.setNow("2026-06-04T09:00"); C("recordExerciseResult", "deadlift", "Deadlift", "5-6", [S(110,5)], false);
      assert.equal(app.ev("session.prs.length"), 1); assert.equal(app.ev("session.prs[0].e1rm"), Math.round(110*(1+5/30)));
      for(let i = 0; i < 130; i++){ app.setNow(new Date(2026, 6, 1 + i, 9).getTime()); C("recordExerciseResult", "deadlift", "Deadlift", "5-6", [S(100,5)], false); }
      assert.equal(app.ev("state.setHist.deadlift.list.length"), 120);
      app.run("session = null;");
    });

    /* ---------- calcStreak ---------- */
    const planDays = active => JSON.stringify(Object.fromEntries(["T2","T3","T4","T5","T6","T7","CN"].map(k=> [k, { title:k, items: active.includes(k) ? [{ uid:k+"1", exerciseId:"squat" }] : [] }])));
    const setPlan = active => app.run(`state.plans.__t = { id:"__t", name:"t", days:${planDays(active)} }; state.activePlanId = "__t";`);
    t.test("calcStreak: tập đủ T2–T7, hôm nay CN (nghỉ) → 6; bỏ 1 buổi có lịch → đứt chuỗi", ()=>{
      setPlan(["T2","T3","T4","T5","T6","T7"]);
      app.setNow("2026-03-08T20:00");                                     // CN 08/03/2026
      app.run(`state.finishedDates = ["2026-03-02","2026-03-03","2026-03-04","2026-03-05","2026-03-06","2026-03-07"];`);
      assert.equal(C("calcStreak"), 6);
      app.run(`state.finishedDates = ["2026-03-02","2026-03-03","2026-03-05","2026-03-06","2026-03-07"];`);   // bỏ T4
      assert.equal(C("calcStreak"), 3);
    });
    t.test("calcStreak: hôm nay là ngày tập nhưng chưa xong → vẫn giữ chuỗi tính tới hôm qua", ()=>{
      setPlan(["T2","T4","T6"]);
      app.setNow("2026-03-13T07:00");                                     // T6, chưa tập
      app.run(`state.finishedDates = ["2026-03-09","2026-03-11"];`);
      assert.equal(C("calcStreak"), 2);
    });
    t.test("calcStreak: giáo án rỗng (không có ngày tập) không treo, trả về nhanh", ()=>{
      setPlan([]);
      app.setNow("2026-03-13T07:00"); app.run(`state.finishedDates = [];`);
      const t0 = Date.now(); const v = C("calcStreak"); const ms = Date.now() - t0;
      assert.equal(v, 0); assert.ok(ms < 200, `mất ${ms} ms`);
      app.run(`state.plans.__t.days = {};`);                              // thiếu hẳn các ngày
      assert.equal(C("calcStreak"), 0);
    });

    /* ---------- Khởi động & đĩa tạ ---------- */
    t.test("warmupHTML: < 20 kg → hướng dẫn chung; 100 kg thanh đòn → 40×8, 60×5, 80×3, 90×1", ()=>{
      assert.match(C("warmupHTML", 15, BENCH), /≥ 20 kg/);
      const h = C("warmupHTML", 100, BENCH);
      for(const s of ["40 kg × 8","60 kg × 5","80 kg × 3","90 kg × 1"]) assert.ok(h.includes(s), `thiếu "${s}"`);
      const d = C("warmupHTML", 30, DB);                                 // tạ đơn: bước 2 kg
      assert.ok(d.includes("12 kg × 8") && d.includes("18 kg × 5"), d);
    });
    t.test("warmupHTML (thanh đòn): không gợi ý mức tạ nhẹ hơn thanh đòn rỗng 20 kg", ()=>{
      const bad = [];
      for(const kg of [25, 30, 40, 45]){
        const h = C("warmupHTML", kg, BENCH);
        [...h.matchAll(/<b>([\d.]+) kg ×/g)].map(m=> Number(m[1])).filter(x=> x < 20).forEach(x=> bad.push(`hiệp chính ${kg} kg → khởi động ${x} kg`));
      }
      expectNone(bad, "Mức tạ khởi động không lắp được trên thanh 20 kg");
    }, { bug:"BUG-12", severity:"Thấp" });
    t.test("plateHTML: lắp đĩa mỗi bên đúng & báo phần lẻ", ()=>{
      assert.match(C("plateHTML", 20), /20 kg/);
      const side = kg => (C("plateHTML", kg).match(/Mỗi bên<\/span><b>([^<]*)<\/b>/) || [])[1];
      assert.equal(side(100), "25 + 15");
      assert.equal(side(60), "20");
      assert.equal(side(142.5), "25 + 25 + 10 + 1.25");
      assert.equal(side(22.5), "1.25");
      assert.equal(side(300), "25 + 25 + 25 + 25 + 25 + 15");
      assert.match(C("plateHTML", 61), /Còn lẻ 0.5 kg/);
      assert.match(C("plateHTML", 0), /Thanh đòn tiêu chuẩn/);
      assert.match(C("plateHTML", NaN), /Thanh đòn tiêu chuẩn/);
    });
    t.test("Buổi tập có hướng dẫn: hoàn thành cả buổi → ghi workoutLog + finishedDates hôm nay", async ()=>{
      app.setNow(null);
      app.run(`state.plans.__s = { id:"__s", name:"s", days:${planDays(["T2","T3","T4","T5","T6","T7","CN"])} }; state.activePlanId = "__s"; state.finishedDates = []; state.workoutLog = {}; state.setLog = {}; session = null;`);
      app.run("startSession(todayDayKey())");
      // fix-core vòng 2 ("buổi < 3 phút", FIX-training §4.5): buổi < 3 phút chỉ bấm "Ghi nhận tất cả" không còn tính vào nhật ký/chuỗi
      // → giả lập buổi đã bắt đầu 4 phút trước (hành vi đổi có chủ đích; ca < 3 phút kiểm ở 60-fix-core "buổi < 3 phút")
      app.run("session.startedAt = Date.now() - 4 * 60 * 1000");
      app.dom.registry.get("btn-session-done").click();                  // chưa đánh dấu hiệp → confirm() = true → ghi hết
      assert.equal(app.ev("session"), null, "buổi tập chưa kết thúc");
      assert.ok(app.ev("state.finishedDates.includes(todayStr())"));
      assert.equal(app.ev("state.workoutLog[todayStr()].completedExerciseIds.length"), 1);
    });
  },
};

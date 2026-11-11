/* =========================================================================
   Vòng sửa lỗi sau QA (11/11/2026) — fixer TRAINING
   Hồi quy cho docs/qa/QA-training.md (QT-xx), QS-03 (phần training-pro), hiệu năng Thư viện, video nền,
   video invertedrow. File sở hữu: achievements.js, training-pro.js, program-builder.js, templates.js,
   library.js, exdb*.js, video.js, freevideos.js.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { assert, expectNone } = require("../lib/framework");
const { scriptOrder } = require("../lib/harness");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

/* ---- Vòng 2: giả lập dữ liệu exdb-vi nạp lười (bỏ thẻ <script> exdb-vi-1..3.js, nạp qua fkLazy) ---- */
const VI_FILES = ["exdb-vi-1.js", "exdb-vi-2.js", "exdb-vi-3.js"];
const RAW_EX = [
  { id:"Zottman_Curl", name:"Zottman Curl", equipment:"dumbbell", level:"beginner", category:"strength", primaryMuscles:["biceps"], instructions:["Stand up with a dumbbell in each hand."], images:["Zottman_Curl/0.jpg"] },
  { id:"Wrist_Roller", name:"Wrist Roller", equipment:"other", level:"beginner", category:"strength", primaryMuscles:["forearms"], instructions:["Hold the roller."], images:["Wrist_Roller/0.jpg"] },
  { id:"3_4_Sit-Up", name:"3/4 Sit-Up", equipment:"body only", level:"beginner", category:"strength", primaryMuscles:["abdominals"], instructions:["Lie down on the floor."], images:["3_4_Sit-Up/0.jpg"] },
];
async function lazyViApp(t, opts){
  const app = await t.app(Object.assign({ scripts: scriptOrder().filter(f=> !VI_FILES.includes(f)),
    state:{ onboarded:true, authDone:true, profile: PROF() } }, opts || {}));
  app.injected = []; app.failInject = false;
  /* fkLazy chèn thẻ <script> → ở đây chạy file thật trong vm (lỗi mạng: app.failInject = true) */
  app.ctx.__fkTestInject = (src)=>{
    app.injected.push(src);
    if(app.failInject) return Promise.reject(new Error("offline " + src));
    new vm.Script(read(src), { filename: path.join(ROOT, src) }).runInContext(app.ctx);
    return Promise.resolve();
  };
  app.run(`(()=>{ const W = globalThis;
    if(W.fkLazy && typeof W.fkLazy._inject === "function"){ W.fkLazy._inject = src=> __fkTestInject(src); return; }
    const done = {};   // fk-lazy.js chưa có → bản giả theo hợp đồng (tuần tự, nhớ đã nạp, lỗi → reject)
    W.fkLazy = { __fake:true, load(g){ if(g !== "exdbvi") return Promise.reject(new Error("nhóm " + g));
      return ${JSON.stringify(VI_FILES)}.reduce((c, f)=> c.then(()=> done[f] ? 0 : __fkTestInject(f).then(()=>{ done[f] = 1; })), Promise.resolve()); } };
  })()`);
  app.run(`_exdbCache = ${JSON.stringify(RAW_EX)};`);   // 800+ bài (thay cho tải mạng)
  return app;
}

const PROF = (o)=> Object.assign({ name:"Tester", gender:"male", age:30, height:172, weight:72, activity:"moderate", goal:"gain", autoTargets:true }, o||{});
const HEART = { completedAt: Date.parse("2026-08-01"), cardio:"heart", parq:{ heart:true } };

module.exports = {
  name: "Vòng sửa lỗi QA — Tập luyện (fix-training)",
  area: "achievements / training-pro / program-builder / templates / library / video",
  async define(t){

    /* ---------- QT-03: buổi nhanh 20 phút qua sàng lọc sức khoẻ ---------- */
    t.test("QT-03: buổi nhanh 20 phút — người khai bệnh tim KHÔNG nhận Burpee/HIIT, thay bằng bài tác động thấp; có 'Kiểm tra nhanh trước khi tập'", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ age:58, goal:"maintain" }), health: HEART } });
      app.setNow("2026-08-07T18:00");   // T6 → buổi "Toàn thân C" của tpl-u-home có burpee
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-u-home")); state.plans[p.id]=p; state.activePlanId=p.id; })()`);
      const q = app.evj("FKAch.quickPlan(state, new Date())");
      const ids = q.items.map(i=> i.exerciseId);
      assert.ok(!ids.includes("burpee"), "vẫn có burpee: " + ids.join(","));
      const vh = app.evj(`FKAch.quickPlan(state, new Date()).items.filter(i=> FKHealth.itemTags(i, "Vừa").veryHigh || FKHealth.itemTags(i, "Vừa").impact).map(i=>i.exerciseId)`);
      assert.deepEqual(vh, [], "còn bài cường độ rất cao / nhảy: " + vh.join(","));
      assert.equal(q.items.length, 4, "buổi nhanh phải đủ 4 bài (thay thế, không chỉ xoá)");
      assert.ok(q.swapped.length >= 1 && /Burpee/i.test(q.swapped[0].from), JSON.stringify(q.swapped));
      // Thẻ "Quay lại tập" trên Trang chủ hiện đúng danh sách đã lọc
      const card = app.ev("FKAch._ui && typeof FKAch._ui.homeInject === 'function'");
      assert.ok(card);
      // Bấm "Bắt đầu 20 phút" → hiện kiểm tra trước buổi, CHƯA bắt đầu
      app.run("session = null; FKAch.startQuick()");
      assert.ok(app.lastHtml("sheet-content").includes("Kiểm tra nhanh trước khi tập"), "không hiện kiểm tra trước buổi");
      assert.equal(app.ev("session"), null, "buổi đã bắt đầu trước khi xác nhận kiểm tra");
      // Vòng 2: health-safety.js gán FKHealth sớm → dùng sheet kiểm tra của health-safety (#hs-pre-go); chưa có thì sheet dự phòng (#ach-pre-go)
      const preBtn = /id="hs-pre-go"/.test(app.lastHtml("sheet-content")) ? "hs-pre-go" : "ach-pre-go";
      app.ev(`document.getElementById('${preBtn}').click()`);
      const sess = app.evj("session ? session.items.map(i=>i.exerciseId) : null");
      assert.ok(Array.isArray(sess) && !sess.includes("burpee"), "buổi nhanh sau xác nhận: " + JSON.stringify(sess));
      assert.equal(app.ev("state.health.lastPreCheck"), "2026-08-07");
      // Lần 2 trong ngày: không hỏi lại
      app.run("session = null; FKAch.startQuick()");
      assert.ok(app.ev("!!session"), "lần 2 trong ngày vẫn hỏi kiểm tra");
    });
    t.test("QT-03: thai kỳ / đau gối → không bài nhảy (mountain climber, burpee), bài thay thế không tải lên khớp đã khai; chưa sàng lọc → giữ nguyên", async ()=>{
      const mk = async (health, gender)=>{
        const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ gender: gender || "male" }), health } });
        app.setNow("2026-08-05T18:00");   // T4 → "Toàn thân B": lunges, pushup, invertedrow, sideplank, mountainclimber
        app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-u-home")); p.days.T4.items = p.days.T4.items.filter(i=> i.exerciseId!=="lunges"); state.plans[p.id]=p; state.activePlanId=p.id; })()`);
        return app.evj("FKAch.quickPlan(state, new Date())");
      };
      const preg = await mk({ completedAt: Date.now(), pregnancy:"pregnant", trimester:2 }, "female");
      assert.ok(!preg.items.some(i=> i.exerciseId === "mountainclimber"), "thai kỳ vẫn có leo núi");
      const knee = await mk({ completedAt: Date.now(), injuries:["knee"] });
      assert.ok(!knee.items.some(i=> ["mountainclimber","burpee","bwsquat","lunges"].includes(i.exerciseId)), "đau gối: " + knee.items.map(i=>i.exerciseId));
      const none = await mk({});
      assert.ok(none.items.some(i=> i.exerciseId === "mountainclimber"), "chưa sàng lọc thì không đổi bài");
      assert.equal(none.swapped.length, 0);
    });

    t.test("QT-03 (trình duyệt): thẻ 'Quay lại tập' vẽ lúc khởi động TRƯỚC khi health-safety.js nạp vẫn lọc Burpee (dự phòng từ dữ liệu sàng lọc) + vẽ lại khi FKHealth sẵn", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ age:58, goal:"maintain" }), health: HEART } });
      app.setNow("2026-08-07T18:00");
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-u-home")); state.plans[p.id]=p; state.activePlanId=p.id; })()`);
      const r = app.evj(`(()=>{ const W = (typeof window !== "undefined" ? window : globalThis); const H = W.FKHealth; W.FKHealth = undefined;
        try{ const q = FKAch.quickPlan(state, new Date()); return { ids: q.items.map(i=> i.exerciseId), fb: !!(q.flags && q.flags.fallback), pre: !!(q.flags && q.flags.preCheck) }; } finally { W.FKHealth = H; } })()`);
      assert.ok(!r.ids.includes("burpee"), "chưa có FKHealth vẫn liệt kê burpee: " + r.ids.join(","));
      assert.equal(r.ids.length, 4); assert.ok(r.fb && r.pre, JSON.stringify(r));
      assert.ok(/_reinjectWait = true/.test(read("achievements.js")) && /DOMContentLoaded/.test(read("achievements.js")), "không vẽ lại thẻ khi FKHealth sẵn");
      // chưa sàng lọc → dự phòng không đổi gì
      const none = app.evj(`(()=>{ const W = (typeof window !== "undefined" ? window : globalThis); const H = W.FKHealth; W.FKHealth = undefined; const h = state.health; state.health = {};
        try{ return FKAch.quickPlan(state, new Date()).items.map(i=> i.exerciseId); } finally { W.FKHealth = H; state.health = h; } })()`);
      assert.ok(none.includes("burpee"));
    });
    t.test("AMRAP (trình duyệt): nút 'Xong bài' đọc hàng hiệp HIỆN TẠI + số lần đang gõ — không kẹt 'nhập số lần thật' khi đã nhập", async ()=>{
      const src = read("training-pro.js");
      assert.ok(/const liveRows = \(\)=> \(\(s\.sets\|\|\{\}\)\[item\.uid\]\) \|\| rows;/.test(src), "chưa đọc hàng hiệp hiện tại");
      assert.ok(/const L = liveRows\(\);\s*\n\s*L\.forEach\(\(r, i\)=>\{ const inp = sheet\.querySelector\(`\[data-reps="\$\{i\}"\]`\)/.test(src), "chưa lấy số lần đang gõ trong ô");
    });

    /* ---------- QT-02: giảm tải ở mức tạ nhỏ ---------- */
    t.test("QT-02: lighterKg luôn nhẹ hơn tạ cũ (5 → 4,5; 2,5 → 2; 12,5 → 11; 60 → 55); không giảm được → null", async ()=>{
      const app = await t.app();
      const r = app.evj("[5,2.5,12.5,10,60,1].map(k=> FKTP.lighterKg(k, 0.9, 2.5))");
      assert.deepEqual(r, [4.5, 2, 11, 9, 55, null]);
      assert.deepEqual(app.evj("[5,7.5].map(k=> FKAch.lighterKg(k, 0.9, 2.5))"), [4.5, 6.5]);
    });
    t.test("QT-02: tuần giảm tải (training-pro) với Dang vai cáp 5 kg → điền sẵn < 5 kg (trước đây giữ nguyên 5 kg)", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-10T18:00");
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-fb")); state.plans[p.id]=p; state.activePlanId=p.id;
        FKTP.startCycle(p.id, { weeks:8, deloadEvery:1, startDate:"2026-11-09" });
        state.setLog = { cablelateral:{ date:"2026-11-06", sets:[{kg:5,reps:15},{kg:5,reps:15}], fails:0 } };
        state.finishedDates = ["2026-11-06"];
        const it = p.days.T2.items.find(i=> i.exerciseId==="cablelateral");
        session = { dayKey:"T2", idx:0, items:[it], isToday:true, completed:[] }; renderSessionStep(); })()`);
      const rows = app.evj("Object.values(session.sets)[0]");
      assert.ok(app.ev("session._tp.deload"), "không vào tuần giảm tải");
      assert.ok(rows.every(r=> r.kg > 0 && r.kg < 5), "kg deload: " + JSON.stringify(rows));
    });

    /* ---------- QT-01: ô kg để trống ---------- */
    t.test("QT-01: lưu hiệp kg trống ở bài có tạ → kế thừa kg hiệp trước; bài trọng lượng cơ thể giữ 0; fillDown chép kg xuống hiệp trống", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-10T18:00");
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-u-home")); state.plans[p.id]=p; state.activePlanId=p.id; state.setLog = {};
        const it = { uid:"g1", exerciseId:"gobletsquat", sets:3, reps:"8-12", restSec:60 }, bw = { uid:"p1", exerciseId:"pushup", sets:2, reps:"5-10", restSec:60 };
        session = { dayKey:"T2", idx:0, items:[it, bw], isToday:true, completed:[] }; renderSessionStep();
        recordExerciseResult("gobletsquat", "Goblet", "8-12", [{kg:8,reps:12},{kg:0,reps:12},{kg:0,reps:12}], false);
        session.idx = 1; renderSessionStep();
        recordExerciseResult("pushup", "Push-up", "5-10", [{kg:0,reps:8},{kg:0,reps:7}], false); })()`);
      assert.deepEqual(app.evj("state.setLog.gobletsquat.sets.map(s=>s.kg)"), [8, 8, 8]);
      assert.deepEqual(app.evj("state.setLog.pushup.sets.map(s=>s.kg)"), [0, 0]);
      const rows = [{ kg:10, done:false }, { kg:"", done:false }, { kg:"", done:true }, { kg:"", done:false }];
      const n = app.call("FKTP.fillDown", rows, 0, 10);
      assert.equal(n, 2); assert.deepEqual(JSON.parse(JSON.stringify(rows)).map(r=> r.kg), [10, 10, "", 10]);
      // Dữ liệu cũ đã lưu 0 kg → buổi sau điền tạ chính, không điền 0
      app.run(`state.setLog.legacy = { date:"2026-11-07", sets:[{kg:8,reps:10},{kg:0,reps:10},{kg:0,reps:10}], fails:0 }; state.finishedDates=["2026-11-07"];
        session = { dayKey:"T2", idx:0, items:[{ uid:"l1", exerciseId:null, custom:{ name:"legacy", muscle:"Chân", equipment:"Tạ đơn" }, sets:3, reps:"8-12", restSec:60 }], isToday:true, completed:[] };`);
      app.run(`(()=>{ const it = session.items[0]; const k = exKey(it); state.setLog[k] = state.setLog.legacy; renderSessionStep(); })()`);
      assert.deepEqual(app.evj("session.sets.l1.map(r=> r.kg)"), [8, 8, 8]);
    });

    /* ---------- QT-10: số lần điền sẵn = buổi trước ---------- */
    t.test("QT-10: điền sẵn số lần buổi trước (11/10/10) thay vì đáy khoảng (8/8/8); tăng tạ thì về đáy; 3 buổi y hệt → nhắc", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-10T18:00");
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-fb")); state.plans[p.id]=p; state.activePlanId=p.id;
        state.finishedDates = ["2026-11-06"];
        state.setLog = { benchpress:{ date:"2026-11-06", sets:[{kg:60,reps:11},{kg:60,reps:10},{kg:60,reps:10}], fails:0 },
                         dbbench:{ date:"2026-11-06", sets:[{kg:20,reps:12},{kg:20,reps:12},{kg:20,reps:12}], fails:0 } };
        session = { dayKey:"T2", idx:0, items:[{ uid:"b1", exerciseId:"benchpress", sets:3, reps:"8-12", restSec:90 }, { uid:"d1", exerciseId:"dbbench", sets:3, reps:"8-12", restSec:90 }], isToday:true, completed:[] };
        renderSessionStep(); session.idx = 1; renderSessionStep(); })()`);
      assert.deepEqual(app.evj("session.sets.b1.map(r=> [r.kg, r.reps])"), [[60,11],[60,10],[60,10]]);
      const d = app.evj("session.sets.d1.map(r=> [r.kg, r.reps])");
      assert.ok(d.every(([kg, reps])=> kg > 20 && reps === 8), "tăng tạ → về đáy khoảng lần: " + JSON.stringify(d));
      app.run(`state.setHist = state.setHist || {}; state.setHist.x3 = { name:"x", list:[1,2,3].map(i=>({ date:"2026-11-0"+i, sets:[{kg:20,reps:10},{kg:20,reps:10}] })) };`);
      assert.equal(app.call("FKTP.sameThreeTimes", "x3"), true);
    });

    /* ---------- QT-08: top set + back-off ---------- */
    t.test("QT-08: Powerbuilding — hiệp 1 nặng, hiệp sau −10%; tăng tạ theo hiệp nặng (RPE ≤ mục tiêu); RPE vượt mục tiêu → giữ tạ", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-10T18:00");
      app.run(`(()=>{ const t = PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-pb"); const p = tplToPlan(t); state.plans[p.id]=p; state.activePlanId=p.id; globalThis.__pb = p; })()`);
      assert.equal(app.ev("__pb.days.T3.items[0].scheme"), "topback");
      const item = app.ev("__pb.days.T3.items[0]");
      const last = { date:"2026-11-03", sets:[{kg:100,reps:5,rpe:8},{kg:90,reps:5},{kg:90,reps:5},{kg:90,reps:4}], fails:0 };
      const p = app.call("progressionFor", item, { equipment:"Thanh đòn" }, last, false, 4);
      assert.equal(p.delta, 1, "trước đây delta 0 vì hiệp back-off < tạ chính"); assert.equal(p.kg, 102.5);
      const hard = Object.assign({}, last, { sets:[{kg:100,reps:5,rpe:10}].concat(last.sets.slice(1)) });
      assert.equal(app.call("progressionFor", item, { equipment:"Thanh đòn" }, hard, false, 4).delta, 0);
      app.run(`state.finishedDates = ["2026-11-06"]; state.setLog = { benchpress: ${JSON.stringify(last)} }; session = { dayKey:"T3", idx:0, items:[__pb.days.T3.items[0]], isToday:true, completed:[] }; renderSessionStep();`);
      const rows = app.evj("session.sets[session.items[0].uid].map(r=> r.kg)");
      assert.equal(rows[0], 102.5); assert.ok(rows.slice(1).every(k=> k === 92.5), JSON.stringify(rows));
      // giáo án tạo TRƯỚC bản sửa (không có scheme) vẫn nhận ra top set
      app.run(`delete __pb.days.T3.items[0].scheme;`);
      assert.equal(app.call("FKTP.isTopBack", app.ev("__pb.days.T3.items[0]")), true);
    });

    /* ---------- QT-09: chu kỳ / deload ---------- */
    t.test("QT-09: tpl-m-pb giảm tải tuần 4 (deloadEvery + regex 'tuần 4 nhẹ'); giáo án riêng có chu kỳ khi thêm vào tuần", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      assert.equal(app.ev(`FKTP.deloadEveryFor(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-pb"))`), 4);
      assert.equal(app.call("FKTP.deloadEveryFor", { desc:"Chu kỳ 4 tuần, tuần 4 nhẹ." }), 4);
      await app.ev(`(async()=>{ const prog = PB.generate({ goal:"gain", exp:"beg", days:["T2","T4","T6"], minutes:45, place:"gym", equip:[], focus:[], inj:[], gender:"female" }); await PB._ui.addToWeek(prog); })()`);
      const c = app.evj("FKTP.store().cycles[state.activePlanId]");
      assert.ok(c, "giáo án riêng không có chu kỳ");
      assert.equal(c.deloadEvery, 6); assert.equal(c.weeks, 10);
      assert.ok(app.ev("getActivePlan().fromBuilder"));
    });

    /* ---------- QT-14: chấn thương từ sàng lọc ---------- */
    t.test("QT-14: Tạo giáo án riêng mặc định theo chấn thương đã khai (đau gối) → không có bài chống chỉ định gối", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ gender:"female" }), health:{ completedAt: Date.now(), injuries:["knee"] } } });
      const a = app.evj("PB._ui.defaults()");
      assert.ok(a.inj.includes("knee"), JSON.stringify(a.inj));
      const bad = app.evj(`(()=>{ const a = PB._ui.defaults(); Object.assign(a, { goal:"gain", exp:"beg", place:"gym" }); const p = PB.generate(a);
        return p.sessions.flatMap(s=> s.items.map(i=> i.id)).filter(id=> (PB.EX[id]||{avoid:[]}).avoid.includes("knee")); })()`);
      expectNone(bad, "Bài chống chỉ định gối");
      // đã từng tạo (có answers cũ "Không có") → chấn thương mới khai vẫn được áp
      app.run(`state.programBuilder = { last:{ goal:"gain", exp:"beg", days:["T2","T4","T6"], minutes:45, place:"gym", equip:[], focus:[], inj:[] } };`);
      assert.ok(app.evj("PB._ui.defaults()").inj.includes("knee"));
    });

    /* ---------- QT-05: giáo án mặc định theo cấp độ ---------- */
    t.test("QT-05: tplRecommend — người mới: nam → Full Body 3 buổi, nữ → Full Body nữ, không rõ → tại nhà; thẻ gợi ý trên màn Tập luyện khi đang dùng giáo án mặc định", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ gender:"female", age:27, goal:"maintain" }) } });
      assert.equal(app.ev(`tplRecommend({ gender:"male" }).id`), "tpl-m-fb");
      assert.equal(app.ev(`tplRecommend({ gender:"female" }).id`), "tpl-f-fb");
      assert.equal(app.ev(`tplRecommend({}).id`), "tpl-u-home");
      assert.equal(app.ev(`tplRecommend({ gender:"male" }, {}, "intermediate").level`), "intermediate");
      assert.ok(app.ev("getActivePlan().builtin"), "harness: giáo án mặc định phải là builtin");
      app.run("goto('workout')"); await app.settle(5);
      const html = app.dom.htmlLog.filter(h=> /tp-reco/.test(h.html)).map(h=> h.html).join("");
      assert.ok(html.includes("Full Body cho nữ"), "không có thẻ gợi ý giáo án");
    });

    /* ---------- QT-06: nhất quán số buổi / khối lượng ---------- */
    t.test("QT-06: Thành tích đếm 2 buổi/ngày và khối lượng theo Nhật ký buổi tập (không mất buổi sáng khi setHist bị ghi đè)", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-10T21:00");
      app.run(`state.trainingPro = { cycles:{}, links:{}, amrapItems:{}, amrap:{}, log:[
          { id:"a", date:"2026-11-10", completed:5, total:5, volume:4000, sets:15 }, { id:"b", date:"2026-11-10", completed:4, total:4, volume:3000, sets:12 } ] };
        state.workoutLog = { "2026-11-10": { dayKey:"T3", completedExerciseIds:["x"], finishedAt: Date.now() } };
        state.setHist = { squat:{ name:"Squat", list:[{ date:"2026-11-10", e1rm:80, top:60, vol:1200, sets:[] }] } };`);
      const ev = app.evj("(()=>{ const e = FKAch.evaluate(state, new Date()); return { s:e.stats.sessions, v:e.stats.totalVol, xp:e.xp.train }; })()");
      assert.equal(ev.s, 2); assert.equal(ev.v, 7000);
      const wk = app.evj("FKTP.weekVolume('2026-11-09','2026-11-15')");
      assert.equal(wk.sessions, ev.s, "số buổi Nhật ký ≠ Thành tích"); assert.equal(wk.tonnage, ev.v, "tấn Nhật ký ≠ Thành tích");
    });

    /* ---------- QT-20 · QT-22: tổng kết tuần ---------- */
    t.test("QT-20: tổng kết tuần tính từ ngày bắt đầu (cài thứ Tư) — không chấm 1/4 buổi, không khuyên 'giảm còn 2 buổi'", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF(), achievements:{ firstSeen:"2026-11-11", earned:{}, quick:[] } } });
      app.setNow("2026-11-11T20:00");   // thứ Tư
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-ul")); state.plans[p.id]=p; state.activePlanId=p.id; state.finishedDates = ["2026-11-11"]; })()`);
      const ws = app.evj("FKAch.weeklySummary(state, new Date(), 'this')");
      assert.equal(ws.cur.from, "2026-11-11");
      assert.equal(ws.cur.planned, 2, "tpl-m-ul: T5, T6 còn lại (T7 Zone 2 tuỳ chọn) — " + ws.cur.planned);
      assert.ok(!/giảm còn/.test(ws.tip.text) && ws.tip.title !== "Làm lịch tập dễ giữ hơn", ws.tip.title);
    });
    t.test("QT-22: ngày đi bộ/Zone 2 là tuỳ chọn — Full Body 3 buổi đòi 3/tuần (không phải 4), cả giáo án tạo trước bản sửa", async ()=>{
      const app = await t.app();
      const n = app.evj(`["tpl-m-fb","tpl-m-ul","tpl-m-pb","tpl-f-fb","tpl-f-glute","tpl-f-pb","tpl-u-home","tpl-f-home","tpl-u-cardio","tpl-u-hyrox"].map(id=>{ const t = PROGRAM_TEMPLATES.find(x=>x.id===id); const p = tplToPlan(t); Object.values(p.days).forEach(d=> delete d.optional); return [id, planRequiredDays(p).length, t.perWeek]; })`);
      const bad = n.filter(([id, req, pw])=> req !== pw).map(x=> x.join(" "));
      expectNone(bad, "Số ngày bắt buộc ≠ perWeek");
    });

    /* ---------- QT-17 (phần achievements): kỷ lục số lần bài trọng lượng cơ thể ---------- */
    t.test("QT-17: thẻ Kỷ lục có bài trọng lượng cơ thể (kéo xà/chống đẩy) theo KỶ LỤC SỐ LẦN; tên bài chứa HTML được escape", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-10T18:00");
      app.run(`state.setHist = {
        pullup:{ name:"Kéo xà (Pull-up)", list:[ { date:"2026-11-02", e1rm:0, top:0, vol:0, sets:[{kg:0,reps:5},{kg:0,reps:4}] }, { date:"2026-11-09", e1rm:0, top:0, vol:0, sets:[{kg:0,reps:7},{kg:0,reps:6}] } ] },
        "c:x":{ name:"<img src=x onerror=alert(1)> (Push)", list:[ { date:"2026-11-09", e1rm:0, top:0, vol:0, sets:[{kg:0,reps:12}] } ] },
        squat:{ name:"Squat", list:[ { date:"2026-11-09", e1rm:80, top:60, vol:1200, sets:[{kg:60,reps:10}] } ] } };`);
      const W = app.evj("FKAch.prWall(state, new Date())");
      const pu = W.rows.find(r=> r.key === "pullup");
      assert.ok(pu && pu.bw && pu.maxReps === 7 && pu.totalReps === 22 && pu.prCount === 1 && pu.isNew, JSON.stringify(pu));
      assert.equal(W.rows[0].key, "squat", "bài có tạ (1RM) vẫn đứng trước");
      const html = app.ev("FKAch._ui.prWallHTML ? FKAch._ui.prWallHTML() : ''");
      assert.ok(/7<small> lần<\/small>/.test(html) && /Kỷ lục số lần/.test(html), "không hiện kỷ lục số lần");
      assert.ok(!/<img src=x onerror/.test(html), "tên bài chèn thô");
    });

    /* ---------- QT-21 ---------- */
    t.test("QT-21: gợi ý nâng cấp sau chu kỳ theo giới tính người dùng (nữ không nhận giáo án nam)", async ()=>{
      const app = await t.app();
      const f = app.ev(`FKTP.nextTemplate("tpl-u-hybrid-adv", "female")`); const m = app.ev(`FKTP.nextTemplate("tpl-u-hybrid-adv", "male")`);
      assert.ok(!f || f.gender !== "nam", "nữ nhận " + (f && f.id));
      assert.ok(!m || m.gender !== "nu");
      const all = app.evj(`PROGRAM_TEMPLATES.map(t=> { const x = FKTP.nextTemplate(t.id, "female"); return x ? x.gender : "-"; })`);
      assert.ok(!all.includes("nam"), JSON.stringify(all));
    });

    /* ---------- QT-19: khối lượng theo giáo án, 1 bảng hệ số ---------- */
    t.test("QT-19: training-pro dùng chung bảng hệ số nhóm cơ với program-builder; vạch chuẩn theo giáo án (người mới < 10, chuyên mông 22 không bị 'quá cao')", async ()=>{
      const app = await t.app();
      const cmp = app.evj(`(()=>{ const prog = PB.generate({ goal:"gain", exp:"beg", days:["T2","T4","T6"], minutes:60, place:"gym", equip:[], focus:[], inj:[], gender:"male" });
        const tp = FKTP.plannedVolume(PB.toPlan(prog)); const pb = prog.volume; return { tp: tp["Mông"], pb: pb.glutes, tpC: tp["Ngực"], pbC: pb.chest }; })()`);
      assert.equal(cmp.tp, cmp.pb, "Mông: TP " + cmp.tp + " / PB " + cmp.pb);
      assert.equal(cmp.tpC, cmp.pbC);
      assert.equal(app.call("FKTP.volStatus", 6, 6), "ok", "giáo án người mới 6 hiệp ngực → đạt");
      assert.equal(app.call("FKTP.volStatus", 22, 22), "ok", "giáo án chuyên mông 22 hiệp → đạt");
      assert.equal(app.call("FKTP.volStatus", 2, 6), "low2");
      assert.equal(app.call("FKTP.volStatus", 12), "ok", "không có giáo án → chuẩn chung 10–20");
    });

    /* ---------- Templates: khối lượng ngực/vai ---------- */
    t.test("Giáo án tpl-m-ul / tpl-m-ulppl: ngực & vai ≥ 10 hiệp hiệu quả/tuần (trước: ngực 8, vai 9)", async ()=>{
      const app = await t.app();
      const v = app.evj(`["tpl-m-ul","tpl-m-ulppl"].map(id=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id===id)); const a = FKTP.plannedVolume(p); return [id, a["Ngực"], a["Vai"]]; })`);
      const bad = v.filter(([, c, s])=> c < 10 || s < 10).map(x=> x.join(" "));
      expectNone(bad, "Dưới 10 hiệp");
      const direct = app.evj(`["tpl-m-ul","tpl-m-ulppl"].map(id=>{ const t = PROGRAM_TEMPLATES.find(x=>x.id===id); let c = 0; Object.values(t.days).forEach(d=> d.ex.forEach(e=>{ if(EXERCISES[e[0]].muscle === "Ngực") c += e[1]; })); return c; })`);
      assert.ok(direct.every(c=> c >= 10), "hiệp ngực trực tiếp: " + direct);
    });

    /* ---------- QT-13: nghỉ dài giữa chu kỳ ---------- */
    t.test("QT-13: nghỉ 12 ngày → đề nghị lùi chu kỳ, bỏ tuần giảm tải kế tiếp; buổi thường đầu tiên tạ ~90%", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-25T18:00");   // T4
      app.run(`(()=>{ const t = PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-fb"); const p = tplToPlan(t); state.plans[p.id]=p; state.activePlanId=p.id; globalThis.__fb = p;
        FKTP.startCycle(p.id, { weeks:10, deloadEvery:5, startDate:"2026-10-26" });         // tuần 5 = giảm tải
        state.finishedDates = ["2026-11-13"]; state.setLog = { hacksquat:{ date:"2026-11-13", sets:[{kg:60,reps:10},{kg:60,reps:10},{kg:60,reps:9}], fails:0 } }; })()`);
      const info = app.evj("FKTP.cycleInfo(__fb.id)");
      const g = app.evj("FKTP.cycleGap(FKTP.cycleInfo(__fb.id))");
      assert.ok(g && g.gap === 12 && g.weeks === 1, JSON.stringify(g));
      app.run("FKTP.shiftCycle(__fb.id, 1)");
      const info2 = app.evj("FKTP.cycleInfo(__fb.id)");
      assert.equal(info2.week, info.week - 1);
      assert.equal(info2.deload, false, "tuần giảm tải ngay sau khi quay lại phải được bỏ");
      app.run(`session = { dayKey:"T2", idx:0, items:[__fb.days.T2.items[0]], isToday:true, completed:[] }; renderSessionStep();`);
      const rows = app.evj("session.sets[session.items[0].uid].map(r=> r.kg)");
      assert.ok(rows.every(k=> k === 55), "tạ quay lại: " + JSON.stringify(rows));
      // bài tập 1 lần/tuần (cách 7 ngày) mà người tập vẫn tập đều → KHÔNG giảm
      app.run(`state.finishedDates = ["2026-11-24"]; state.setLog.hacksquat.date = "2026-11-18"; session = { dayKey:"T2", idx:0, items:[Object.assign({}, __fb.days.T2.items[0], { uid:"h2" })], isToday:true, completed:[] }; renderSessionStep();`);
      assert.ok(app.evj("session.sets.h2.map(r=> r.kg)").every(k=> k === 60));
    });

    /* ---------- QS-03 (phần training-pro): dữ liệu routine cộng đồng ---------- */
    t.test("QS-03: giáo án sao chép từ routine (sets/reps/nghỉ/tên chứa HTML) — Superset editor, buổi superset, nhãn deload không chèn thô", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      const X = `"><img src=x onerror=alert(1)>`;
      app.run(`(()=>{ const X = ${JSON.stringify(X)}; const p = { id:"plan_x", name:X, tagline:"CỘNG ĐỒNG", builtin:false, days:{} };
        DAY_KEYS.forEach(k=> p.days[k] = { title:X, intensity:"Vừa", duration:30, items:[] });
        p.days.T2.items = [ { uid:"u1", exerciseId:null, custom:{ name:X, muscle:X, equipment:X, guide:X }, sets:X, reps:X, restSec:X },
                            { uid:"u2", exerciseId:null, custom:{ name:X+"2", muscle:X, equipment:X, guide:X }, sets:X, reps:X, restSec:X } ];
        state.plans[p.id] = p; state.activePlanId = p.id; state.selectedDay = "T2"; })()`);
      const before = app.dom.htmlLog.length;
      app.run(`FKTP.openSupersetEditor("plan_x", "T2")`);
      app.run(`FKTP.toggleLink("plan_x", "T2", state.plans.plan_x.days.T2.items, 0); FKTP.openSupersetEditor("plan_x", "T2");`);
      app.run(`FKTP.openCycleSheet()`);
      app.run(`session = { dayKey:"T2", idx:0, items: state.plans.plan_x.days.T2.items.slice(), isToday:true, completed:[] }; renderSessionStep();`);
      app.run(`FKTP.openLogSheet(); renderWorkoutScreen();`);
      const leaks = app.dom.htmlLog.slice(before).filter(h=> /<img src=x onerror/i.test(h.html)).map(h=> (h.id || "?") + ": " + h.html.slice(Math.max(0, h.html.indexOf("<img src=x") - 80), h.html.indexOf("<img src=x") + 40));
      expectNone(leaks, "Chèn thô dữ liệu routine");
    });

    /* ---------- Thư viện: hiệu năng + trùng ---------- */
    t.test("Thư viện: bỏ bài 800+ trùng bài chuẩn (Đẩy ngực tạ đơn), ảnh lazy+async, xếp hạng tìm không dấu, vẽ lười theo lô", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      const r = app.evj(`(()=>{ const b = libBuiltinItems(); const db = [{ key:"db:Dumbbell_Bench_Press", src:"exdb", ex:{ name:"Dumbbell Bench Press" }, name:"Đẩy ngực tạ đơn (Dumbbell Bench Press)", sub:"", groups:[] },
          { key:"db:Zercher_Squat", src:"exdb", ex:{ name:"Zercher Squat" }, name:"Squat Zercher", sub:"", groups:[] }];
        return libDedupe(b, db).map(x=> x.key); })()`);
      assert.deepEqual(r, ["db:Zercher_Squat"]);
      const row = app.call("libRowHTMLBase", { key:"fk:x", src:"fitkit", name:"<b>x</b>", sub:"s", level:"beginner", img:"https://a/b.jpg" });
      assert.ok(/loading="lazy"/.test(row) && /decoding="async"/.test(row) && !/<b>x<\/b>/.test(row), row);
      await app.ev("libLoad()");
      app.run(`exLib.q = "day nguc"; exLib.group = null;`);
      const list = app.evj("libQueryList().slice(0,3).map(x=> x.name)");
      assert.ok(list.length && /Đẩy ngực/i.test(list[0]), JSON.stringify(list));
      const src = read("library.js");
      assert.ok(/IntersectionObserver/.test(src) && /LIB_BATCH\s*=\s*30/.test(src), "không vẽ lười");
      assert.ok(/libBindOnce/.test(src) && /libSyncChips/.test(src), "lọc vẫn dựng lại toàn bộ khung");
    });

    /* ---------- QT-12: video nền màn chào ---------- */
    t.test("QT-12: video nền màn chào chỉ phát khi #auth mở — vào app thì dừng + bỏ src; tôn trọng giảm chuyển động/tiết kiệm dữ liệu", async ()=>{
      const app = await t.app();
      app.run(`document.getElementById("auth").classList.remove("open")`);
      assert.equal(app.ev("welcomeOpen()"), false);
      await app.ev("mountWelcomeVideo()");
      const src = read("video.js");
      assert.ok(/new MutationObserver\(\(\)=>\{ if\(!welcomeOpen\(\)\) stopWelcomeVideo\(\); \}\)/.test(src), "không theo dõi #auth");
      assert.ok(/removeAttribute\("src"\)/.test(src) && /prefers-reduced-motion/.test(src) && /saveData/.test(src));
      // giả lập: video đang chạy → gọi stopWelcomeVideo → bị gỡ
      app.run(`(()=>{ const v = document.createElement("video"); v.className = "wl-hero-video"; v.setAttribute("src", "https://x/v.mp4"); globalThis.__v = v;
        const qa = document._queryAll; document._queryAll = (sel)=> String(sel).includes("wl-hero-video") ? [v] : qa.call(document, sel); try{ stopWelcomeVideo(); } finally { document._queryAll = qa; } })()`);
      assert.equal(app.ev("__v.getAttribute('src')"), null);
    });

    /* ---------- invertedrow ---------- */
    t.test("invertedrow: alias Australian pull-up / body row / TRX row cùng mẫu chuyển động; KHÔNG gắn nhầm video chèo/kéo xà hiện có", async ()=>{
      const app = await t.app();
      const S = (a, b)=> app.call("fvScore", a, { name:b });
      const target = app.ev("fvMatchName(EXERCISES.invertedrow)");
      for(const n of ["Australian Pull-up", "Inverted Row", "Body Row", "TRX Row", "Bodyweight Row"]) assert.ok(S(target, n) > 0, "không khớp " + n);
      for(const n of ["Rowing seated, narrow grip", "Pull-ups", "Bent-over Row", "Lateral Rows on Cable, One Armed", "Rowing Machine"]) assert.equal(S(target, n), 0, "khớp nhầm " + n);
      assert.equal(S("Seated Cable Row", "Australian Pull-up"), 0, "bài khác khớp nhầm video inverted row");
      const vids = JSON.parse(JSON.stringify(await app.ev("findFreeExerciseVideos(EXERCISES.invertedrow)")));
      assert.deepEqual(vids.map(v=> v.name), [], "index hiện có KHÔNG có video đúng động tác → không gắn");
      // fvTokens nhớ kết quả nhưng trả bản sao (fvScore sửa mảng equip)
      const a1 = app.call("fvScore", "Cable Lateral Raise", { name:"Lateral Raises", equip:"dumbbell" }), a2 = app.call("fvScore", "Cable Lateral Raise", { name:"Lateral Raises", equip:"dumbbell" });
      assert.equal(a1, a2);
    });

    /* ---------- QT-07 (phần training): buổi qua nửa đêm — nhật ký buổi tập + buổi nhanh dùng ngày chốt lúc bắt đầu ---------- */
    t.test("QT-07: Nhật ký buổi tập (training-pro) & buổi nhanh ghi vào ngày CHỐT lúc bắt đầu (session.date), không tách đôi qua 0 h", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-11T00:20");   // đã qua nửa đêm, buổi bắt đầu hôm trước 23:40
      const sum = app.evj(`FKTP.buildSummary({ dayKey:"T3", idx:1, items:[], completed:[], isToday:true, date:"2026-11-10", sid:"s1", _tp:{} })`);
      assert.equal(sum.date, "2026-11-10"); assert.equal(sum.sid, "s1");
      const sum2 = app.evj(`FKTP.buildSummary({ dayKey:"T4", idx:0, items:[], completed:[], isToday:true, _tp:{} })`);
      assert.equal(sum2.date, "2026-11-11", "phiên cũ không có date → ngày hiện tại");
      // buổi nhanh: session có date/sid/startedAt như startSession của app.js
      app.setNow("2026-11-10T23:40");
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-u-home")); state.plans[p.id]=p; state.activePlanId=p.id; session = null; FKAch.startQuick(); })()`);
      assert.equal(app.ev("session && session._quick && session.date"), "2026-11-10");
      assert.ok(app.ev("!!(session.sid && session.startedAt)"));
    });

    /* ---------- QA-training UX §2.7: popup huy hiệu không che màn Hoàn thành ---------- */
    t.test("UX-2.7: huy hiệu mới sau buổi tập hiện TRONG màn 'Hoàn thành buổi tập'; popup chúc mừng đợi đóng sheet", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app.setNow("2026-11-10T18:00");
      app.run(`const ev = FKAch.evaluate(state, new Date()); const b = ev.badges.find(x=> x.id === "s1"); globalThis.__res = { ev, newly:[b] };`);
      const html = app.ev(`FKAch._ui.finishXPHTML(__res, 156)`);
      assert.ok(/\+156 XP/.test(html));
      assert.ok(/ach-finish-badges/.test(html) && /Bước chân đầu tiên/.test(html), "không hiện huy hiệu trong màn hoàn thành: " + html.slice(0, 200));
      // popup do buổi tập (fromSession) không ép hiện khi sheet đang mở
      const src = read("achievements.js");
      assert.ok(/tryShow\(!!\(opt && opt\.force && !opt\.fromSession\)\)/.test(src), "popup sau buổi tập vẫn ép hiện đè sheet");
      assert.ok(/requestIdleCallback\(go, \{ timeout:2000 \}\)/.test(src), "kiểm tra huy hiệu chưa chạy lúc rảnh");
    });

    /* ---------- exdb: dữ liệu tải từ mạng không chèn thô; ảnh có alt / lazy ---------- */
    t.test("exdb/Thư viện: id/ảnh/nhóm cơ/dụng cụ từ free-exercise-db được escape; ảnh chi tiết có alt = tên bài (QU-33), danh sách lazy+async (QU-10)", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      const X = `"><img src=x onerror=alert(1)>`;
      const before = app.dom.htmlLog.length;
      app.run(`(()=>{ const X = ${JSON.stringify(X)}; openExDbDetail({ id:X, name:"Bench "+X, images:[X], primaryMuscles:[X], equipment:X, level:X, instructions:[X] }, ()=>{}); })()`);
      const leaks = app.dom.htmlLog.slice(before).filter(h=> /<img src=x onerror/i.test(h.html)).map(h=> (h.id || "?") + ": " + h.html.slice(Math.max(0, h.html.indexOf("<img src=x") - 80), h.html.indexOf("<img src=x") + 30));
      expectNone(leaks, "Chèn thô dữ liệu exdb");
      const src = read("exdb.js");
      assert.ok(/data-exdb="\$\{escapeHtml\(ex\.id\)\}"/.test(src) && /loading="lazy" decoding="async"/.test(src) && /alt="\$\{escapeHtml\(ex\.name\)\} — ảnh kỹ thuật"/.test(src));
      assert.ok(/id="ld-anim"[^>]*alt="\$\{escapeHtml\(x\.name\)\} — ảnh kỹ thuật"/.test(read("library.js")), "ảnh chi tiết Thư viện thiếu alt");
    });

    /* =====================================================================
       VÒNG 2 (HANDOFF-ROUND-BRIEF): fkLazy exdb-vi · thuật ngữ §8 · fk:health-ready
       ===================================================================== */
    t.test("R2-LAZY-01: Thư viện CHỜ fkLazy.load('exdbvi') khi exdb-vi-1..3.js nạp lười — nạp tuần tự 1 lần, tên Việt + tìm không dấu theo tên Việt", async ()=>{
      const app = await lazyViApp(t);
      assert.equal(app.ev("Object.keys(EXDB_VI).length"), 0, "giả lập: dữ liệu exdb-vi chưa nạp");
      assert.equal(app.ev("typeof exdbVi"), "object", "exdb-vi.js (mã ghi đè) vẫn nạp sẵn");
      await app.ev("renderExLib()");
      assert.deepEqual(app.injected, VI_FILES, "phải nạp đúng 3 file theo thứ tự");
      assert.ok(app.ev("Object.keys(EXDB_VI).length") >= 800);
      assert.equal(app.ev("_libAll.viOk"), true);
      const names = app.evj("Object.fromEntries(_libAll.db.map(x=> [x.key, x.name]))");
      assert.equal(names["db:Zottman_Curl"], app.ev("EXDB_VI.Zottman_Curl.n"), JSON.stringify(names));
      assert.equal(names["db:3_4_Sit-Up"], app.ev('EXDB_VI["3_4_Sit-Up"].n'));
      app.run(`exLib.q = "cuon ta zottman"; exLib.group = null;`);
      assert.equal(app.ev("libQueryList()[0] && libQueryList()[0].key"), "db:Zottman_Curl", "khoá tìm kiếm chưa làm mới sau khi dữ liệu tới");
      const n0 = app.dom.htmlLog.length; app.run("libRefresh()");
      assert.ok(app.dom.htmlLog.slice(n0).some(h=> /Cuốn tạ Zottman/.test(h.html)), "danh sách không hiện tên Việt");
      // gọi lại: không tải lại; chi tiết bài có hướng dẫn Việt nếu có
      await app.ev("libViReady()"); await app.ev("libLoad()");
      assert.equal(app.injected.length, 3, "nạp lặp: " + app.injected.join(","));
      // hợp đồng (ux grep): library.js gọi fkLazy.load('exdbvi'); exdb-vi.js / exdb.js chờ trước khi dùng EXDB_VI
      assert.ok(/fkLazy\.load\('exdbvi'\)/.test(read("library.js")), "library.js chưa gọi fkLazy.load('exdbvi')");
      assert.ok(/Promise\.all\(\[exdbLoad\(\), viReady\(\)/.test(read("exdb-vi.js")) && /function exdbViReady\(\)/.test(read("exdb.js")));
    });
    t.test("R2-LAZY-02: nạp exdb-vi lỗi mạng → Thư viện VẪN mở (tên gốc) + 'Thử lại'; Thử lại thành công → tên Việt; sự kiện fk:lazy:exdbvi dựng lại", async ()=>{
      const app = await lazyViApp(t);
      app.failInject = true;
      await app.ev("renderExLib()");
      assert.equal(app.ev("_libAll.viOk"), false);
      assert.equal(app.ev("_libAll.db.length"), 3, "Thư viện không mở được khi bản Việt lỗi");
      assert.equal(app.evj("_libAll.db.find(x=> x.key==='db:Zottman_Curl').name"), "Zottman Curl");
      const h = app.lastHtml("exlib-body");
      assert.ok(/data-lib-retry/.test(h) && /Thử lại/.test(h) && /Chưa tải được tên tiếng Việt/.test(h), h.slice(0, 300));
      app.failInject = false;
      await app.ev("libRetryVi()");
      assert.equal(app.ev("_libAll.viOk"), true);
      assert.equal(app.evj("_libAll.db.find(x=> x.key==='db:Zottman_Curl').name"), app.ev("EXDB_VI.Zottman_Curl.n"));
      assert.ok(!/data-lib-retry/.test(app.lastHtml("exlib-body")), "vẫn còn thông báo lỗi sau khi nạp được");
      // nạp trước lúc rảnh (fk-lazy.js phát fk:lazy:exdbvi) sau 1 lần lỗi → bộ nhớ đệm tên gốc bị bỏ
      app.run(`_libAll.viOk = false; (document._listeners["fk:lazy:exdbvi"] || []).forEach(fn=> fn({ type:"fk:lazy:exdbvi" }));`);
      assert.equal(app.ev("_libAll"), null, "không bỏ danh sách tên gốc khi bản Việt đã nạp");
    });
    t.test("R2-LAZY-03: bảng chọn bài 800+ (PT/giáo án) chờ exdbvi rồi mới vẽ tên Việt; lỗi → vẫn chọn được + nút Thử lại", async ()=>{
      const app = await lazyViApp(t);
      app.run(`openExDbPicker(()=>{}, {})`);
      await app.settle(30);
      assert.deepEqual(app.injected, VI_FILES);
      assert.ok(/Cuốn tạ Zottman/.test(app.lastHtml("exdb-list")), app.lastHtml("exdb-list").slice(0, 200));
      const app2 = await lazyViApp(t); app2.failInject = true;
      app2.run(`openExDbPicker(()=>{}, {})`);
      await app2.settle(30);
      assert.ok(/Zottman Curl/.test(app2.lastHtml("exdb-list")), "lỗi bản Việt làm hỏng bảng chọn");
      assert.ok(app2.dom.htmlLog.some(x=> /exdb-vi-retry/.test(x.html)), "thiếu nút Thử lại");
    });
    t.test("R2-LAZY-04: tương thích — dữ liệu có sẵn (thẻ script) KHÔNG tải lại; chưa có fkLazy → xong ngay (exdbViReady = false)", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      assert.ok(app.ev("Object.keys(EXDB_VI).length") >= 800);
      const injected = [];
      app.ctx.__rec = src=> { injected.push(src); return Promise.resolve(); };
      app.run(`if(globalThis.fkLazy && fkLazy._inject) fkLazy._inject = src=> __rec(src);`);
      await app.ev("libLoad()");
      assert.deepEqual(injected, [], "dữ liệu đã có mà vẫn chèn thẻ: " + injected.join(","));
      assert.equal(app.ev("_libAll.viOk"), true);
      const app2 = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() } });
      app2.run("delete globalThis.fkLazy;");
      assert.equal(await app2.ev("exdbViReady()"), false);
      await app2.ev("renderExLib()");
      assert.equal(app2.ev("_libAll.viOk"), true);
    });

    t.test("R2-TERM-01: buổi tập tuần giảm tải — mọi chữ hiển thị là 'tuần giảm tải'/'Giảm tải', không còn 'deload' (GLOSSARY §8.2)", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ level:"intermediate" }) } });
      app.setNow("2026-11-10T18:00");
      const before = app.dom.htmlLog.length;
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-fb")); state.plans[p.id]=p; state.activePlanId=p.id; state.selectedDay = "T2";
        FKTP.startCycle(p.id, { weeks:8, deloadEvery:1, startDate:"2026-11-09" });
        renderWorkoutScreen(); FKTP.decorateWorkout(); FKTP.openCycleSheet();                                         // màn Tập luyện + sheet chu kỳ
        const its = p.days.T2.items; FKTP.toggleLink(p.id, "T2", its, 0);
        session = { dayKey:"T2", idx:0, items: its.slice(0, 3), isToday:true, completed:[] }; renderSessionStep();   // siêu hiệp
        session.idx = 2; renderSessionStep(); })()`);                                                                 // bài lẻ
      assert.ok(app.ev("session._tp.deload"), "không vào tuần giảm tải");
      const html = app.dom.htmlLog.slice(before).map(h=> h.html).join("\n");
      const bad = (html.match(/[^\n]{0,60}\bdeload\b[^\n]{0,40}/gi) || []);
      expectNone(bad, "Chữ 'deload' hiển thị");
      assert.ok(/Tuần giảm tải<\/b>/.test(html), "thiếu banner Tuần giảm tải");
      assert.ok(/Giảm tải: \d+\/\d+ hiệp/.test(html) || /tuần giảm tải, gốc \d+/.test(html), "thiếu nhãn số hiệp tuần giảm tải");
      assert.ok(/Chu kỳ &amp; tuần giảm tải<\/button>/.test(read("training-pro.js")), "nút 'Chu kỳ & tuần giảm tải'");   // DOM giả không chèn được nút vào hàng chip
      assert.ok(/Siêu hiệp/.test(html), "superset → 'Siêu hiệp'");
      const tag = app.ev(`document.getElementById("workout-tagline").textContent`);
      assert.ok(!/deload|GIẢM TẢI/.test(tag), "tagline: " + tag);
      // nguồn: chuỗi hiển thị trong training-pro.js / templates.js / program-builder.js không còn 'deload'
      const stripExpr = x=> { let out = "", d = 0; for(let i = 0; i < x.length; i++){ if(x[i] === "$" && x[i+1] === "{"){ d++; i++; continue; }
        if(d){ if(x[i] === "{") d++; else if(x[i] === "}") d--; continue; } out += x[i]; } return out; };
      const vis = f=> read(f).replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter(l=> !/^\s*\/\//.test(l) && !/\.match\(\/|deloadEveryFor\(t\)/.test(l))
        .map(l=> stripExpr(l).replace(/[\w$]+\.deload\b|\bdeload[A-Z]\w*|\w+Deload\w*/g, ""))
        .flatMap(l=> (l.match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) || [])).filter(x=> /\bdeload\b/i.test(x) && !/^["'`][\w.$]*["'`]$/.test(x));
      for(const f of ["training-pro.js", "templates.js", "program-builder.js", "achievements.js"]) expectNone(vis(f), f + ": chuỗi còn 'deload'");
      assert.ok(!/Tiến trình|chương trình mẫu/.test(read("training-pro.js").replace(/\/\*[\s\S]*?\*\//g, "")), "training-pro.js còn 'Tiến trình'/'chương trình mẫu'");
    });
    t.test("R2-TERM-02: cấp Mới tập — ẩn RPE (bảng siêu hiệp), ẩn '(RIR …)' (AMRAP, nguyên tắc giáo án, giáo án riêng, tổng kết tuần); cấp khác giải thích 'độ nặng cảm nhận'", async ()=>{
      const mk = async (level)=>{
        const app = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ level }) } });
        app.setNow("2026-11-10T18:00");
        app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-fb")); state.plans[p.id]=p; state.activePlanId=p.id;
          const its = p.days.T2.items; FKTP.toggleLink(p.id, "T2", its, 0);
          session = { dayKey:"T2", idx:0, items: its.slice(0, 2), isToday:true, completed:[] }; renderSessionStep(); })()`);
        return app;
      };
      const beg = await mk("beginner");
      assert.equal(beg.ev("FKTP.simpleMode()"), true);
      const hb = beg.lastHtml("sheet-content");
      assert.ok(/Siêu hiệp/.test(hb), "không vẽ bảng siêu hiệp: " + hb.slice(0, 200));
      assert.ok(!/class="rpe"/.test(hb) && !/>RPE</.test(hb), "người mới vẫn thấy cột RPE trong siêu hiệp");
      assert.ok(!/RIR/.test(beg.call("FKTP.amrapRule", { reps:"tối đa −2" })), "AMRAP người mới còn RIR");
      assert.ok(!/RIR/.test(beg.ev(`tplPrinciplesText(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-ul"))`)), "nguyên tắc giáo án: người mới còn RIR");
      const mid = await mk("intermediate");
      const hm = mid.lastHtml("sheet-content");
      assert.ok(/class="rpe"/.test(hm) && /RPE = độ nặng cảm nhận/.test(hm), "cấp trung bình phải có cột RPE + giải thích");
      assert.ok(/còn khoảng 2 lần.*\(RIR 2\)/.test(mid.call("FKTP.amrapRule", { reps:"tối đa −2" })));
      assert.ok(/còn 1–2 lần nữa mới hết sức \(RIR 1–2\)/.test(mid.ev(`tplPrinciplesText(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-ul"))`)));
      assert.ok(!/RIR/.test(mid.ev(`tplPrinciplesText(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-fb"))`)), "giáo án Mới tập còn RIR");
      // Tạo giáo án riêng: lý do theo cấp
      const why = exp=> mid.evj(`PB.generate({ goal:"gain", exp:"${exp}", days:["T2","T4","T6"], minutes:60, place:"gym" }).reasons.map(r=> r.text).join(" | ")`);
      assert.ok(!/RIR/.test(why("beg")) && /còn 2–3 lần nữa/.test(why("beg")), why("beg"));
      assert.ok(/còn 1–2 lần.*\(RIR 1–2\)/.test(why("adv")), why("adv"));
      // tổng kết tuần (achievements): người mới không bị bảo "ghi RPE"
      const src = read("achievements.js");
      assert.ok(/c\.P\.level === "beginner" && !c\.P\.showRpe/.test(src) && /độ nặng cảm nhận \(RPE 1–10\)/.test(src));
    });
    t.test("R2-TERM-03: tên giáo án mẫu / kiểu chia theo §8 (không 'hypertrophy', ULPPL → Trên–Dưới–Đẩy–Kéo–Chân, 'Giáo án của tôi'); chu kỳ giảm tải đọc từ mô tả KHÔNG đổi", async ()=>{
      const app = await t.app();
      const names = app.evj("PROGRAM_TEMPLATES.map(t=> t.name + ' ' + t.desc + ' ' + t.origin)").join(" ");
      assert.ok(!/hypertrophy|\bdeload\b|volume cao/i.test(names), "còn thuật ngữ tiếng Anh: hypertrophy/deload/volume");
      assert.ok(/Trên–Dưới–Đẩy–Kéo–Chân 5 buổi \(ULPPL\)/.test(names));
      assert.equal(app.ev("PB.SPLITS.ulppl.name"), "Trên–Dưới–Đẩy–Kéo–Chân (ULPPL)");
      assert.ok(!/Chương trình của tôi/.test(read("templates.js")) && /"Giáo án của tôi"/.test(read("templates.js")));
      const dl = app.evj("Object.fromEntries(PROGRAM_TEMPLATES.map(t=> [t.id, FKTP.deloadEveryFor(t)]))");
      assert.deepEqual([dl["tpl-m-ppl6"], dl["tpl-f-lower3"], dl["tpl-m-pb"], dl["tpl-f-pb"], dl["tpl-m-fb"]], [5, 5, 4, 4, 5], JSON.stringify(dl));
    });

    t.test("R2-HEALTH: thẻ 'Quay lại tập' vẽ lại khi nhận sự kiện fk:health-ready (health-safety.js nạp sau) — chỉ 1 lần", async ()=>{
      const app = await t.app({ scripts: scriptOrder().filter(f=> f !== "health-safety.js"),
        state:{ onboarded:true, authDone:true, profile: PROF({ age:58, goal:"maintain" }), health: HEART, finishedDates:["2026-09-01"] } });
      app.run(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-u-home")); state.plans[p.id]=p; state.activePlanId=p.id; })()`);
      assert.equal(app.ev("typeof FKHealth"), "undefined");
      app.run("renderHomeScreen()");
      await app.settle(5);
      const L = app.ev(`(document._listeners["fk:health-ready"] || []).length`);
      assert.ok(L >= 1, "achievements không nghe fk:health-ready");
      const cards = ()=> app.dom.htmlLog.filter(h=> /data-ach-quick/.test(h.html)).length;
      new vm.Script(read("health-safety.js"), { filename: path.join(ROOT, "health-safety.js") }).runInContext(app.ctx);
      assert.equal(app.ev("typeof FKHealth"), "object");
      const c0 = cards();
      app.run(`(document._listeners["fk:health-ready"] || []).forEach(fn=> fn({ type:"fk:health-ready" }))`);
      await app.settle(5);
      const c1 = cards();
      assert.ok(c1 > c0, "không vẽ lại thẻ khi FKHealth sẵn");
      app.run(`(document._listeners["fk:health-ready"] || []).forEach(fn=> fn({ type:"fk:health-ready" }))`);
      await app.settle(5);
      assert.equal(cards(), c1, "vẽ lại nhiều lần");
    });
  },
};

/* =========================================================================
   Vòng sửa lỗi sau QA (11/11/2026) — fixer CORE (app.js, pt.js)
   Hồi quy cho phần lõi của QA-training (QT), QA-nutrition (QN), QA-ux-performance (QU),
   QA-security (QS) và QA-commerce (QC-11). Mỗi test mang mã lỗi trong tên.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert, approx, expectNone } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

const PROF = o=> Object.assign({ name:"Tester", gender:"male", age:30, height:172, weight:72, activity:"moderate", goal:"gain", autoTargets:true }, o || {});
const WED = "2026-11-11T09:00";            // thứ Tư (T4)
const XSS = `"><img src=x onerror=alert(1)>`;
const XSS_ATTR = `x" onerror="alert(1)`;
/* HTML nguy hiểm thật sự (thẻ/thuộc tính chạy được) — chuỗi đã escape (&lt;img…) không khớp */
const DANGER = /<img src=x onerror=alert|" onerror="alert|<svg onload=alert|javascript:alert/i;
const htmlSince = (app, n)=> app.dom.htmlLog.slice(n).map(x=> x.html).join("\n");

/* giáo án 3 ngày T2/T3/T4 (bài có trong EXERCISES) */
const PLAN3 = `(()=>{ const p = createBlankPlan("Ba ngày"); ["T2","T3","T4"].forEach(k=>{ p.days[k].title = "Buổi " + k;
  p.days[k].items = [{ uid:k+"-a", exerciseId:"pushup", sets:3, reps:"10-12", restSec:60, clipId:null }, { uid:k+"-b", exerciseId:"benchpress", sets:3, reps:"8-12", restSec:90, clipId:null }]; });
  state.activePlanId = p.id; saveState(); return p.id; })()`;

module.exports = {
  name: "Vòng sửa lỗi QA — Lõi app.js / pt.js (fix-core)",
  area: "app.js / pt.js",
  async define(t){

    /* ======================= BẢO MẬT ======================= */
    t.test("QS-01/QS-22: confirmDialog an toàn theo mặc định — thẻ định dạng giữ, <img onerror>/<svg onload> thành chữ, chuỗi đã escape không bị escape 2 lần; opts.text escape toàn bộ", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.run(`confirmDialog("Chốt <b>kết quả</b>", "#1 <b>An</b> ${XSS.replace(/"/g, '\\"')} &lt;i&gt; <svg onload=alert(1)>", ()=>{}, "Trao <img src=x onerror=alert(2)>", "emoji_events")`);
      const h = app.lastHtml("sheet-content");
      assert.ok(!DANGER.test(h), "còn HTML chạy được: " + h);
      assert.ok(h.includes("<b>An</b>") && h.includes("<b>kết quả</b>"), "thẻ <b> phải giữ định dạng");
      assert.ok(h.includes("&lt;img src=x onerror=alert(1)&gt;"), "payload phải hiện thành chữ");
      assert.ok(h.includes("&lt;i&gt;") && !h.includes("&amp;lt;i"), "chuỗi đã escape bị escape 2 lần");
      app.run(`confirmDialog("<b>T</b>", "<b>đậm</b>", ()=>{}, "OK", "x", { text:true })`);
      const h2 = app.lastHtml("sheet-content");
      assert.ok(h2.includes("&lt;b&gt;đậm&lt;/b&gt;") && !h2.includes("<b>đậm"), "opts.text phải escape toàn bộ");
      // icon không chèn được thuộc tính
      app.run(`confirmDialog("T", "m", ()=>{}, "OK", '"><img src=x onerror=alert(3)>')`);
      assert.ok(!DANGER.test(app.lastHtml("sheet-content")));
    });
    t.test("QS-22: openSheet(…, {text:true}) escape toàn bộ nội dung chữ thuần", async ()=>{
      const app = await t.app();
      app.call("openSheet", `<img src=x onerror=alert(1)> & chữ`, { text:true });
      const h = app.lastHtml("sheet-content");
      assert.ok(!DANGER.test(h) && h.includes("&lt;img") && h.includes("&amp; chữ"), h);
    });
    t.test("QS-20: safeUrl chặn URL giao thức tương đối (//host, /\\host, \\\\host) — vẫn nhận https, đường dẫn nội bộ, blob, data:image", async ()=>{
      const app = await t.app();
      const bad = ["//evil.example/x.png", "/\\evil.example/x.png", "\\\\evil.example/x", "\\/evil.example", "/\t/evil.example", "javascript:alert(1)", " //evil.example"];
      bad.forEach(u=> assert.equal(app.call("safeUrl", u), "", "phải chặn: " + JSON.stringify(u)));
      const good = ["https://images.pexels.com/a.jpg", "assets/brand/logo.svg", "./media/food/pho.webp", "/assets/x.png", "blob:https://test.local/1", "data:image/png;base64,AAAA"];
      good.forEach(u=> assert.equal(app.call("safeUrl", u), u, "phải nhận: " + u));
      assert.equal(app.call("attrUrl", `https://a.b/x.png" onerror="alert(1)`).includes('"'), false);
    });
    t.test("QS-02: hàng 'Buổi với PT' trên Trang chủ — id/tên escape, không onclick chèn id; bấm mở form qua data-* đúng id gốc", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED);
      app.run(`state.coachUpcoming = [{ cid: ${JSON.stringify(XSS)}, role:"student", time:"18:00", date: todayStr(), title: ${JSON.stringify(XSS)}, who: "<b>PT</b>", mode:"offline" }];`);
      const n = app.dom.htmlLog.length;
      app.call("renderHomeScreen");
      const h = htmlSince(app, n);
      assert.ok(h.includes("data-pt-cid="), "không vẽ hàng Buổi với PT");
      assert.ok(!DANGER.test(h), "XSS ở Trang chủ");
      assert.ok(!/onclick="openClientForm/.test(h), "còn onclick chèn id");
      // uỷ quyền click (pt.js) → openClientForm(id gốc, vai trò, "today")
      const got = app.run(`(()=>{ let got = null; const o = window.openClientForm; window.openClientForm = (...a)=>{ got = a; };
        const row = { getAttribute: k=> k === "data-pt-cid" ? ${JSON.stringify(XSS)} : (k === "data-pt-role" ? "student" : null) };
        const target = { closest: sel=> /data-pt-cid/.test(sel) ? row : null };
        (document._listeners.click || []).forEach(fn=>{ try{ fn({ target, preventDefault(){} }); }catch(e){} });
        window.openClientForm = o; return JSON.stringify(got); })()`);
      assert.deepEqual(JSON.parse(got), [XSS, "student", "today"]);
    });
    t.test("QS-03: dữ liệu giáo án sao chép (routine cộng đồng) — cường độ/tên buổi/số lần/nhóm cơ chứa HTML không chạy ở Trang chủ, màn Tập luyện, trình sửa giáo án", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED);
      app.run(`(()=>{ const id = ${PLAN3}; const d = state.plans[id].days.T4; d.intensity = ${JSON.stringify(XSS)}; d.title = ${JSON.stringify(XSS)}; d.duration = ${JSON.stringify(XSS)};
        d.items.push({ uid:${JSON.stringify(XSS)}, exerciseId:null, sets:${JSON.stringify(XSS)}, reps:${JSON.stringify(XSS)}, restSec:${JSON.stringify(XSS)}, clipId:null,
          custom:{ name:${JSON.stringify(XSS)}, muscle:${JSON.stringify(XSS)}, equipment:"Tạ đơn", guide:${JSON.stringify(XSS)} } }); plansUI = { mode:"edit", day:"T4" }; })()`);
      const n = app.dom.htmlLog.length;
      app.call("renderHomeScreen");
      app.call("renderWorkoutScreen");
      const plan = app.ev("getActivePlan()");
      const ed = app.call("renderPlanEditorHTML", plan);
      app.run(`openPlanItemEditor(getActivePlan(), "T4", ${JSON.stringify(XSS)})`);
      const all = htmlSince(app, n) + "\n" + ed;
      assert.ok(!DANGER.test(all), "còn chèn thô: " + (all.match(DANGER) || [])[0]);
      assert.ok(!/value="[^"]*"><img/.test(all), "thuộc tính value bị phá");
    });
    t.test("QS-04: ảnh bài do PT giao (custom.img / stock.thumb) qua attrUrl — không phá thuộc tính src, không nhận javascript:", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED);
      app.run(`(()=>{ const id = ${PLAN3}; const d = state.plans[id].days.T4;
        d.items = [{ uid:"pt1", exerciseId:null, sets:3, reps:"10", restSec:60, clipId:null, stock:{ thumb:"javascript:alert(1)" },
          custom:{ name:"Bài PT", muscle:"Ngực", equipment:"Tạ đơn", img:${JSON.stringify(XSS_ATTR)} } }]; plansUI = { mode:"edit", day:"T4" }; })()`);
      const n = app.dom.htmlLog.length;
      app.call("renderWorkoutScreen");
      const ed = app.call("renderPlanEditorHTML", app.ev("getActivePlan()"));
      app.run(`openPlanItemEditor(getActivePlan(), "T4", "pt1")`);
      app.run(`session = { dayKey:"T4", idx:0, items: getActivePlan().days.T4.items.slice(), isToday:true, completed:[], date: todayStr(), sid:"s1" }; renderSessionStep();`);
      const all = htmlSince(app, n) + "\n" + ed;
      assert.ok(!DANGER.test(all), "src bị phá / javascript: — " + (all.match(DANGER) || [])[0]);
    });

    /* ======================= LƯU TRỮ ======================= */
    t.test("QC-11: localStorage đầy → saveState() trả false + báo 'Bộ nhớ máy đầy' (không nuốt lỗi); bình thường trả true", async ()=>{
      const app = await t.app();
      assert.equal(app.ev("saveState()"), true);
      const r = app.run(`(()=>{ const o = localStorage.setItem; localStorage.setItem = ()=>{ const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; };
        let v; try{ v = saveState(); } finally { localStorage.setItem = o; } return v; })()`);
      assert.equal(r, false);
      assert.ok(app.lastHtml("toast").includes("Bộ nhớ máy đầy"), app.lastHtml("toast"));
    });
    t.test("QT-11: dữ liệu cũ/hỏng (finishedDates null, workoutLog thiếu completedExerciseIds, giáo án thiếu ngày, setHist thiếu list, lịch sử thiếu sets) không làm vỡ app", async ()=>{
      const today = "2026-11-11";
      const app = await t.app({ state:{ profile: PROF(), finishedDates: null,
        workoutLog: { [today]: { dayKey:"T4" }, "2026-11-10": null },
        plans: { p1: { id:"p1", name:"Cũ", days: { T2: { title:"A", items:[{ uid:"a", exerciseId:"pushup", sets:3, reps:"10", restSec:60 }] }, T4: { title:"B" } } } }, activePlanId:"p1",
        setHist: { benchpress: { name:"Bench" }, pushup: { name:"Push", list:[{ date:"2026-11-01" }, null] } },
        setLog: { benchpress: { date:"2026-11-01" } } } });
      app.setNow(WED);
      assert.deepEqual(app.loadErrors.map(e=> e.file), []);
      assert.equal(app.ev("Array.isArray(state.finishedDates)"), true);
      assert.deepEqual(app.evj(`state.workoutLog["${today}"].completedExerciseIds`), []);
      assert.equal(app.ev("Object.keys(state.plans.p1.days).length"), 7);
      assert.deepEqual(app.evj("state.setHist.benchpress.list"), []);
      app.call("renderHomeScreen"); app.call("renderWorkoutScreen"); app.call("calcStreak");
      app.run(`openExerciseHistory("pushup", "Push")`);
      app.run(`session = { dayKey:"T2", idx:0, items:[state.plans.p1.days.T2.items[0]], isToday:true, completed:[], date:"${today}", sid:"s" }; renderSessionStep();
        recordExerciseResult("benchpress", "Bench", "8-12", [{kg:60,reps:10}], false);`);
      // bản sao lưu cũ đi qua cùng bộ chuẩn hoá
      assert.equal(app.ev(`normalizeState({ finishedDates:"x", plans:{ q:{ days:null } }, setHist:[] }).plans.q.days.CN.items.length`), 0);
    });

    /* ======================= TẬP LUYỆN ======================= */
    t.test("QT-05: giáo án mặc định theo cấp độ/giới — người mới nam Full Body 3 buổi, nữ Full Body nữ, trung bình Upper/Lower; chấn thương / ≥ 60 tuổi → người mới; nâng cao giữ theo mục tiêu", async ()=>{
      const app = await t.app();
      const tpl = (p, f)=> app.ev(`(fkDefaultTemplate(${JSON.stringify(p)}, ${JSON.stringify(f || {})}) || {}).id || null`);
      assert.equal(tpl({ gender:"male", level:"beginner", age:27 }), "tpl-m-fb");
      assert.equal(tpl({ gender:"female", level:"beginner", age:27 }), "tpl-f-fb");
      assert.equal(tpl({ gender:"male", level:"intermediate", age:27 }), "tpl-m-ul");
      assert.equal(tpl({ gender:"female", level:"intermediate", age:27 }), "tpl-f-glute");
      assert.equal(tpl({ gender:"male", level:"advanced", age:27 }), null);
      assert.equal(tpl({ gender:"female", level:"intermediate", age:27 }, { injuries:["knee"] }), "tpl-f-fb");
      assert.equal(tpl({ gender:"male", level:"advanced", age:64 }), "tpl-m-fb");
      assert.equal(tpl({ gender:"male", age:27 }), "tpl-m-fb", "chưa khai cấp độ → coi là người mới");
      // Onboarding lần đầu: nữ mới tập → giáo án Full Body nữ 3 buổi (không phải 'elite' 6 buổi)
      const app2 = await t.app({ state:{ onboarded:false, authDone:true, health:{ completedAt: Date.now(), ack:true, parq:{} } } });
      app2.run(`tempProfile = { gender:"female", activity:"light", goal:"maintain", level:"beginner" };
        document.getElementById("in-age").value = "27"; document.getElementById("in-height").value = "160"; document.getElementById("in-weight").value = "55"; finishOnboarding();`);
      assert.equal(app2.ev("getActivePlan().fromTemplate"), "tpl-f-fb");
      const days = app2.ev(`DAY_KEYS.filter(k=> getActivePlan().days[k].items.length).length`);
      assert.ok(days <= 4, "người mới nhận " + days + " buổi/tuần");
      assert.ok(app2.ev("typeof state.startDate === 'string' && state.startDate.length === 10"), "chưa ghi ngày bắt đầu");
    });
    t.test("QT-04: tập bù buổi T2 vào thứ Tư — hỏi trước, chọn 'Tập & lưu' thì LƯU vào hôm nay (dayKey gốc, makeupFor = thứ Hai); 'Chỉ xem trước' không lưu", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED);
      app.run(PLAN3);
      app.run(`session = null; document.getElementById("mk-go")._listeners = {}; document.getElementById("mk-preview")._listeners = {}; startSession("T2");`);
      assert.ok(app.lastHtml("sheet-content").includes("hôm nay?"), "không hỏi tập bù");
      assert.equal(app.ev("session"), null, "chưa chọn đã bắt đầu");
      app.ev(`document.getElementById("mk-go").click()`);
      assert.deepEqual(app.evj("[session.dayKey, session.isToday, session.makeup, session.date]"), ["T2", true, true, "2026-11-11"]);
      app.setNow("2026-11-11T09:40");   // vòng 2 ("buổi < 3 phút"): buổi thật kéo dài ≥ 3 phút mới tính vào nhật ký
      app.run(`session.completed = session.items.map(i=> i.uid); session.idx = session.items.length; renderSessionStep();`);
      const log = app.evj(`state.workoutLog["2026-11-11"]`);
      assert.equal(log.dayKey, "T2"); assert.equal(log.makeup, true); assert.equal(log.makeupFor, "2026-11-09");
      assert.ok(app.ev(`state.finishedDates.includes("2026-11-11")`), "buổi bù không tính hoàn thành");
      assert.ok(app.ev(`fkCoveredDates().has("2026-11-09")`), "thứ Hai vẫn bị tính bỏ lỡ");
      // Xem trước: không lưu
      app.run(`document.getElementById("mk-go")._listeners = {}; document.getElementById("mk-preview")._listeners = {}; startSession("T3"); document.getElementById("mk-preview").click();`);
      assert.deepEqual(app.evj("[session.isToday, session.makeup]"), [false, false]);
    });
    t.test("QT-07: buổi tập bắt đầu 23:40 thứ Ba, kết thúc sau 0 h — mọi ghi nhận về ngày bắt đầu (setLog, setHist, workoutLog, finishedDates)", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow("2026-11-10T23:40");
      app.run(PLAN3);
      app.run(`session = null; startSession("T3");`);
      assert.equal(app.ev("session.date"), "2026-11-10");
      app.setNow("2026-11-11T00:25");
      app.run(`recordExerciseResult("benchpress", "Bench", "8-12", [{kg:60,reps:10},{kg:60,reps:10}], false);
        session.completed = session.items.map(i=> i.uid); session.idx = session.items.length; renderSessionStep();`);
      assert.equal(app.ev("state.setLog.benchpress.date"), "2026-11-10");
      assert.equal(app.ev("state.setHist.benchpress.list.slice(-1)[0].date"), "2026-11-10");
      assert.equal(app.ev(`state.workoutLog["2026-11-10"] && state.workoutLog["2026-11-10"].dayKey`), "T3");
      assert.ok(!app.ev(`state.workoutLog["2026-11-11"]`), "bị tách sang ngày mới");
      assert.ok(app.ev(`state.finishedDates.includes("2026-11-10")`));
    });
    t.test("QT-06: 2 buổi cùng ngày cùng bài → GỘP (nối hiệp, e1RM = max, khối lượng cộng dồn) thay vì ghi đè buổi sáng", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED);
      app.run(`session = { sid:"am", date:"2026-11-11" }; recordExerciseResult("squat", "Squat", "5", [{kg:100,reps:5},{kg:100,reps:5}], false);
        session = { sid:"pm", date:"2026-11-11" }; recordExerciseResult("squat", "Squat", "10", [{kg:50,reps:10}], false);
        session = { sid:"pm", date:"2026-11-11" }; recordExerciseResult("squat", "Squat", "10", [{kg:50,reps:10}], false); session = null;`);
      const h = app.evj("state.setHist.squat.list");
      assert.equal(h.length, 1);
      assert.equal(h[0].sets.length, 3, "nối hiệp 2 buổi (buổi chiều lưu lại không đếm trùng)");
      assert.equal(h[0].vol, 1500);
      approx(h[0].e1rm, 100*(1+5/30), 0.2, "e1RM phải là max của 2 buổi");
    });
    t.test("QT-01: ô kg trống kế thừa kg hiệp trước / buổi trước; bài trọng lượng cơ thể giữ 0; dữ liệu cũ 8·0·0 kg vẫn tự tăng tạ", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      assert.deepEqual(app.evj(`fkFillBlankKg([{kg:8},{kg:0},{kg:""},{kg:10},{kg:null}], 0).map(x=>x.kg)`), [8,8,8,10,10]);
      assert.deepEqual(app.evj(`fkFillBlankKg([{kg:""},{kg:0}], 12).map(x=>x.kg)`), [12,12]);
      assert.deepEqual(app.evj(`fkFillBlankKg([{kg:0,reps:10},{kg:0,reps:9}], 0).map(x=>x.kg)`), [0,0]);
      app.setNow(WED);
      const p = app.evj(`progressionFor({ reps:"8-12", exerciseId:"gobletsquat" }, { equipment:"Tạ đơn", muscle:"Chân" }, { date:"2026-11-09", sets:[{kg:8,reps:12},{kg:0,reps:12},{kg:0,reps:12}], fails:0 }, false, 3)`);
      assert.equal(p.delta, 1, "dữ liệu cũ 0 kg chặn tự tăng tạ: " + JSON.stringify(p));
      assert.ok(p.kg > 8);
    });
    t.test("QT-02 · QT-18: nấc tạ theo dụng cụ — tạ đơn 10→12→14 (không 11/13), giảm tải luôn nhẹ hơn ≥ 1 nấc, thanh đòn thân dưới +5 %", async ()=>{
      const app = await t.app();
      const DB = `{ equipment:"Tạ đơn", muscle:"Ngực" }`, CABLE = `{ equipment:"Cáp", muscle:"Vai" }`, BB_LEG = `{ equipment:"Thanh đòn", muscle:"Chân" }`, BB_UP = `{ equipment:"Thanh đòn", muscle:"Ngực" }`;
      assert.equal(app.ev(`fkNextKg(${DB}, 10)`), 12);
      assert.equal(app.ev(`fkNextKg(${DB}, 12)`), 14);
      assert.equal(app.ev(`fkNextKg(${BB_LEG}, 100)`), 105);
      assert.equal(app.ev(`fkNextKg(${BB_UP}, 60)`), 62.5);
      [[CABLE, 5], [CABLE, 2.5], [DB, 10], [DB, 6], [BB_UP, 12.5], [BB_UP, 60]].forEach(([m, kg])=>{
        const d = app.ev(`fkDeloadKg(${m}, ${kg})`);
        assert.ok(d === null || (d > 0 && d < kg), `giảm tải ${kg} kg → ${d}`);
      });
      assert.ok(app.ev(`fkDeloadKg(${CABLE}, 5)`) < 5, "cáp 5 kg phải giảm được");
      // trượt 2 buổi ở nấc nhỏ nhất → giữ tạ + hạ mục tiêu lần (không báo 'giảm còn 1 kg' khi đang 1 kg)
      const p = app.evj(`progressionFor({ reps:"8-12" }, ${DB}, { date:"2026-11-01", sets:[{kg:1,reps:5},{kg:1,reps:5}], fails:2 }, false, 2)`);
      assert.ok(p.hold && /giữ tạ/.test(p.msg), JSON.stringify(p));
    });
    t.test("QT-10: số lần điền sẵn = số lần buổi trước (11/10/10), không về đáy khoảng (8/8/8); tăng tạ thì về đáy", async ()=>{
      const app = await t.app();
      const rows = app.evj(`fkPrefillRows({ reps:"8-12", sets:3 }, { last:{ sets:[{kg:60,reps:11},{kg:60,reps:10},{kg:60,reps:10}] }, timed:false, nSets:3, prog:{ delta:0 } })`);
      assert.deepEqual(rows.map(r=> [r.kg, r.reps]), [[60,11],[60,10],[60,10]]);
      const up = app.evj(`fkPrefillRows({ reps:"8-12", sets:2 }, { last:{ sets:[{kg:60,reps:12},{kg:60,reps:12}] }, timed:false, nSets:2, prog:{ delta:1, kg:62.5 } })`);
      assert.deepEqual(up.map(r=> [r.kg, r.reps]), [[62.5,8],[62.5,8]]);
    });
    t.test("QT-15: khởi động theo khoảng lần — tăng cơ (≥ 8 lần) 2 hiệp 50 %×10 · 75 %×5; máy 1 hiệp; sức mạnh (3–5) giữ thang 4 hiệp; thanh đòn 20 kg không cần khởi động riêng", async ()=>{
      const app = await t.app();
      const rows = h=> (h.match(/class="tb-row"/g) || []).length;
      const hyp = app.call("warmupHTML", 30, { equipment:"Tạ đơn" }, "8-12");
      assert.equal(rows(hyp), 2); assert.ok(/50%/.test(hyp) && /75%/.test(hyp), hyp);
      assert.equal(rows(app.call("warmupHTML", 150, { equipment:"Máy" }, "12-15")), 1);
      assert.ok(rows(app.call("warmupHTML", 140, { equipment:"Thanh đòn" }, "3-5")) >= 4);
      assert.ok(/không cần hiệp khởi động riêng/.test(app.call("warmupHTML", 20, { equipment:"Thanh đòn" }, "8-10")));
    });
    t.test("QT-16: nút 'Đĩa tạ' chỉ hiện với thanh đòn; tạ đơn ghi 'Kg/quả'", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ level:"intermediate" }) } });
      app.setNow(WED);
      app.run(`session = { dayKey:"T4", idx:0, items:[{ uid:"d", exerciseId:"dbbench", sets:3, reps:"8-12", restSec:60 }], isToday:true, completed:[], date: todayStr(), sid:"s" }; renderSessionStep();`);
      const db = app.lastHtml("sheet-content");
      assert.ok(!db.includes('data-tool="plate"'), "tạ đơn vẫn có nút Đĩa tạ");
      assert.ok(db.includes("Kg/quả"), "thiếu nhãn Kg/quả");
      app.run(`session = { dayKey:"T4", idx:0, items:[{ uid:"b", exerciseId:"benchpress", sets:3, reps:"6-8", restSec:90 }], isToday:true, completed:[], date: todayStr(), sid:"s2" }; renderSessionStep();`);
      assert.ok(app.lastHtml("sheet-content").includes('data-tool="plate"'), "thanh đòn mất nút Đĩa tạ");
    });
    t.test("QT-17 (một phần): bài trọng lượng cơ thể đạt đỉnh mọi hiệp → gợi ý thêm lần / biến thể khó hơn", async ()=>{
      const app = await t.app();
      app.setNow(WED);
      const p = app.evj(`progressionFor({ reps:"8-12" }, { equipment:"Trọng lượng cơ thể", muscle:"Ngực" }, { date:"2026-11-09", sets:[{kg:0,reps:12},{kg:0,reps:12},{kg:0,reps:13}], fails:0 }, false, 3)`);
      assert.ok(p.bw && /biến thể khó hơn/.test(p.msg), JSON.stringify(p));
    });
    t.test("QT-12: rời màn chào (hideAuth) dừng hẳn video nền — pause + bỏ src (pt.js)", async ()=>{
      const app = await t.app();
      const src = read("pt.js");
      assert.ok(/function hideAuth\(\)\{[^}]*stopAuthVideos\(\)/.test(src), "hideAuth không gọi stopAuthVideos");
      const r = app.run(`(()=>{ const v = { paused:false, src:"a.mp4", _a:{ src:"a.mp4" }, pause(){ this.paused = true; }, removeAttribute(k){ delete this._a[k]; }, querySelectorAll(){ return []; }, load(){} };
        const box = document.getElementById("auth"); const o = box.querySelectorAll; box.querySelectorAll = sel=> sel === "video" ? [v] : [];
        try{ hideAuth(); } finally { box.querySelectorAll = o; } return JSON.stringify([v.paused, "src" in v._a]); })()`);
      assert.deepEqual(JSON.parse(r), [true, false]);
    });

    /* ======================= DINH DƯỠNG (phần lõi) ======================= */
    t.test("QN-04 · QN-20: đọc số kiểu Việt — '1,5' = 1,5 (không thành 15), '1.500' = 1500; ô số lượng là text + inputmode=decimal; hiển thị 2,5", async ()=>{
      const app = await t.app();
      assert.equal(app.call("fkNum", "1,5"), 1.5);
      assert.equal(app.call("fkNum", " 2.5 "), 2.5);
      assert.equal(app.call("fkNum", "1.500"), 1500);
      assert.equal(app.call("fkNum", "1.500,5"), 1500.5);
      assert.ok(Number.isNaN(app.call("fkNum", "abc")));
      assert.equal(app.call("fmtVN", 2.5), "2,5");
      // bản lõi của openFoodQuantity (nutrition-pro.js bọc lại — phần đó thuộc fixer nutrition)
      const src = read("app.js"); const f = src.slice(src.indexOf("function openFoodQuantity("), src.indexOf("function fkAddWater("));
      assert.ok(/type="text" inputmode="decimal" id="qty-input"/.test(f), "ô số lượng lõi còn type=number");
      assert.ok(/fkNum\(\$\("#qty-input"\)\.value\)/.test(f), "ô số lượng lõi không đọc qua fkNum");
      assert.ok(/fkNum\(\$\("#water-goal-input"\)\.value\)/.test(src) && /fkNum\(\$\("#nt-kcal"\)\.value\)/.test(src), "mục tiêu nước/calo không đọc qua fkNum");
    });
    t.test("QN-05: mục tiêu tự chỉnh được kiểm tra — macro lệch calo > 10 % bị chặn; dưới sàn an toàn phải xác nhận lần 2; nước âm/0/> 6 L không lưu", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ gender:"female", weight:58, height:160 }) } });
      app.run("recomputeProfile()");
      const before = app.ev("state.profile.goalKcal");
      const save = (k, P, C, F)=> app.run(`(()=>{ openEditNutritionTargets(); const s = (i, v)=> document.getElementById(i).value = v;
        s("nt-kcal", "${k}"); s("nt-protein", "${P}"); s("nt-carbs", "${C}"); s("nt-fat", "${F}");
        document.getElementById("btn-save-targets")._listeners.click.slice(-1)[0](); })()`);
      save(600, 250, 300, 90);
      assert.equal(app.ev("state.profile.goalKcal"), before, "600 kcal + macro 3.010 kcal vẫn lưu");
      assert.ok(/800/.test(app.ev(`document.getElementById("nt-err").textContent`)));
      save(2000, 250, 300, 90);         // macro 3.010 kcal ≠ 2.000 kcal
      assert.equal(app.ev("state.profile.goalKcal"), before);
      assert.ok(/lệch quá 10/.test(app.ev(`document.getElementById("nt-err").textContent`)));
      save(1000, 75, 100, 33);          // khớp macro nhưng dưới sàn nữ 1.200
      assert.equal(app.ev("state.profile.goalKcal"), before, "dưới sàn an toàn lưu ngay không hỏi");
      assert.ok(/mức an toàn/.test(app.ev(`document.getElementById("nt-err").textContent`)));
      app.run(`document.getElementById("btn-save-targets")._listeners.click.slice(-1)[0]();`);   // xác nhận lần 2
      assert.equal(app.ev("state.profile.goalKcal"), 1000);
      assert.equal(app.ev("state.profile.autoTargets"), false);
      ["-2", "0", "7", "abc"].forEach(v=>{
        app.run(`openEditWaterTarget(); document.getElementById("water-goal-input").value = "${v}"; document.getElementById("btn-save-water-goal")._listeners.click.slice(-1)[0]();`);
        assert.ok(app.ev("state.profile.waterTargetOverride == null"), "nước " + v + " L vẫn lưu");
      });
      app.run(`openEditWaterTarget(); document.getElementById("water-goal-input").value = "2,5"; document.getElementById("btn-save-water-goal")._listeners.click.slice(-1)[0]();`);
      assert.equal(app.ev("state.profile.waterTargetOverride"), 2.5);
    });
    t.test("QN-06: cộng nước chính xác tới ml (10 lần 0,25 L = 2,5 L), đặt lại = 0", async ()=>{
      const app = await t.app();
      app.setNow(WED);
      app.run(`fkAddWater("reset"); for(let i = 0; i < 10; i++) fkAddWater(0.25); fkAddWater(0.33); fkAddWater(0.33); fkAddWater(0.33);`);
      assert.equal(app.ev(`state.waterLog[todayStr()]`), 3.49);
      assert.equal(app.ev(`fkAddWater("reset")`), 0);
    });
    t.test("QN-07: mục tiêu nước — 35 ml/kg cân điều chỉnh kẹp 1,5–3,7 L; thai T2–T3 +0,3 L; cho bú +0,7 L; lọc máu → không đặt chỉ tiêu; tự đặt kẹp 0,5–6 L", async ()=>{
      const app = await t.app();
      const W = (p, f)=> app.ev(`(()=>{ const o = FKHealth.current; FKHealth.current = ()=> (${JSON.stringify(f || {})}); try{ return waterTargetL(${JSON.stringify(p)}); } finally { FKHealth.current = o; } })()`);
      assert.equal(W({ weight:60, height:165 }), 2.1);
      assert.equal(W({ weight:130, height:175 }), 3.1, "nam 130 kg phải dùng cân điều chỉnh (không 4,6 L)");
      assert.equal(W({ weight:35, height:150 }), 1.5);
      assert.equal(W({ weight:60, height:165 }, { preg:true, tri:2 }), 2.4);
      assert.equal(W({ weight:60, height:165 }, { bf:true }), 2.8);
      assert.equal(W({ weight:60, height:165 }, { kidney:"dialysis" }), null);
      assert.equal(W({ weight:60, height:165, waterTargetOverride:9 }), 6);
    });
    t.test("QN-08: đạm theo mục tiêu + vận động, ≤ 35 % năng lượng — nữ 60 tuổi ít vận động 1.200 kcal không còn 120 g (40 %)", async ()=>{
      const app = await t.app();
      const m = app.evj(`calcMacros(60, 1200, { gender:"female", age:60, height:158, weight:60, activity:"sedentary", goal:"maintain" })`);
      assert.ok(m.protein * 4 <= 1200 * 0.35 + 1, "đạm " + m.protein + " g vượt 35 %");
      assert.ok(m.protein >= 60 && m.protein <= 75, "≈ 1,2 g/kg: " + m.protein);
      assert.equal(app.call("proteinPerKg", { goal:"maintain", activity:"moderate", age:30 }), 1.4);
      assert.equal(app.call("proteinPerKg", { goal:"lose", activity:"active", age:30 }), 2.0);
      assert.equal(app.call("proteinPerKg", { goal:"gain", activity:"sedentary", age:30 }), 1.6);
    });
    t.test("QN-24: 9–17 tuổi dùng EER IOM 2005 — nữ 16 tuổi 60 kg/158 cm vận động nhẹ ≈ 2.075 kcal (không 1.852)", async ()=>{
      const app = await t.app({ state:{ profile: { name:"Teen", gender:"female", age:16, height:158, weight:60, activity:"light", goal:"maintain", autoTargets:true } } });
      app.run("recomputeProfile()");
      approx(app.ev("state.profile.tdee"), 2075, 40, "EER");
      const adult = await t.app({ state:{ profile: { name:"A", gender:"female", age:25, height:158, weight:60, activity:"light", goal:"maintain", autoTargets:true } } });
      adult.run("recomputeProfile()");
      assert.ok(adult.ev("state.profile.tdee") < 2000, "người lớn vẫn dùng Mifflin");
    });
    t.test("QN-27: BMI < 19,5 mà chọn giảm mỡ → thâm hụt tối đa 10 %; BMI < 18,5 → không cho thâm hụt", async ()=>{
      const app = await t.app({ state:{ profile: { name:"S", gender:"female", age:30, height:150, weight:42, activity:"moderate", goal:"lose", autoTargets:true } } });
      app.run("recomputeProfile()");
      const p = app.evj("state.profile");
      assert.equal(p.goalCapped, true);
      assert.ok(p.goalKcal >= Math.round(p.tdee * 0.9), `${p.goalKcal} < 90 % của ${p.tdee}`);
      app.run(`state.profile.weight = 40; recomputeProfile();`);
      assert.equal(app.ev("state.profile.goalBlocked"), true);
      assert.ok(app.ev("state.profile.goalKcal >= state.profile.tdee"));
    });

    /* ======================= UX / HIỆU NĂNG / TRUY CẬP ======================= */
    t.test("QU-07: goto() không còn ép layout đồng bộ (void sc.offsetWidth); đổi màn vẫn gắn hiệu ứng vào màn, bấm lại màn đang mở không chạy lại", async ()=>{
      const app = await t.app();
      const src = app.ev("goto.toString()");
      assert.ok(!/offsetWidth/.test(src), "goto còn đọc offsetWidth");
      app.call("goto", "workout");
      assert.ok(app.ev(`document.getElementById("screen-workout").classList.contains("enter")`));
      app.ev(`document.getElementById("screen-workout").classList.remove("enter")`);
      app.call("goto", "workout");
      assert.ok(!app.ev(`document.getElementById("screen-workout").classList.contains("enter")`), "bấm lại màn đang mở vẫn chạy hiệu ứng");
    });
    t.test("QU-02 · QU-03: renderAll() chỉ vẽ màn đang mở — Dinh dưỡng/Hồ sơ không vẽ trước khi ẩn; vào màn mới vẽ", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      const r = app.run(`(()=>{ const cnt = { n:0, p:0 }; const oN = renderNutritionScreen, oP = renderProfileScreen;
        renderNutritionScreen = function(){ cnt.n++; return oN.apply(this, arguments); };
        renderProfileScreen = function(){ cnt.p++; return oP.apply(this, arguments); };
        try{ goto("home"); cnt.n = 0; cnt.p = 0; renderAll(); const a = [cnt.n, cnt.p]; goto("nutrition"); a.push(cnt.n); return JSON.stringify(a); }
        finally { renderNutritionScreen = oN; renderProfileScreen = oP; } })()`);
      assert.deepEqual(JSON.parse(r), [0, 0, 1]);
      const pt = read("pt.js");
      const fb = pt.slice(pt.indexOf("function finishBoot("), pt.indexOf("function afterFirstOnboarding("));
      assert.ok(fb && !/renderAll\(\)/.test(fb.replace(/\/\/.*$/gm, "")), "finishBoot còn renderAll() trước goto()");
    });
    t.test("QU-13: CTA lớn màn chào 'Bắt đầu ngay' vào thẳng onboarding (khách), không mở form tạo tài khoản", async ()=>{
      const app = await t.app({ state:{ onboarded:false, authDone:false } });
      app.run(`showAuth("welcome")`);
      const h = app.lastHtml("auth-body");
      assert.ok(/id="wl-start"[^>]*aria-label="Bắt đầu ngay — dùng thử không cần tài khoản"/.test(h), "CTA chính không phải dùng thử");
      app.run(`document.getElementById("onboarding").classList.remove("open"); document.getElementById("wl-start")._listeners.click.slice(-1)[0]();`);
      assert.equal(app.ev("state.authDone"), true);
      assert.ok(app.ev(`document.getElementById("onboarding").classList.contains("open")`), "không vào onboarding");
      assert.ok(!app.ev(`document.getElementById("auth").classList.contains("open")`), "màn chào/đăng ký vẫn mở");
    });
    t.test("QU-14: Trang chủ 'Bắt đầu tập' bắt đầu NGAY buổi hôm nay (startSession), 'Xem buổi hôm nay' là link phụ", async ()=>{
      const app = await t.app({ state:{ profile: PROF(), health:{ completedAt: Date.parse("2026-11-01"), ack:true, parq:{} } } });
      app.setNow(WED);
      app.run(PLAN3);
      app.call("renderHomeScreen");
      const h = app.lastHtml("home-content");
      assert.ok(/data-home-act="start"[^>]*>[\s\S]*Bắt đầu tập/.test(h), "thiếu nút Bắt đầu tập");
      assert.ok(/data-home-act="view"[^>]*>Xem buổi hôm nay/.test(h), "thiếu link phụ");
      assert.ok(!/Bắt đầu tập<\/button>/.test(h) || !/onclick="goto\('workout'\)"[^>]*>[^<]*<span[^>]*>play_arrow/.test(h));
      // bấm qua uỷ quyền click của Trang chủ
      app.run(`session = null; (()=>{ const btn = { getAttribute: k=> k === "data-home-act" ? "start" : null };
        const target = { closest: sel=> /data-home-act/.test(sel) ? btn : null };
        (document._listeners.click || []).forEach(fn=>{ try{ fn({ target, preventDefault(){} }); }catch(e){} }); })()`);
      const started = app.evj("session ? [session.dayKey, session.isToday] : null");
      const sheet = app.lastHtml("sheet-content");
      assert.ok((started && started[0] === "T4" && started[1] === true) || /Kiểm tra nhanh|sàng lọc/i.test(sheet),
        "Bắt đầu tập không bắt đầu buổi: " + JSON.stringify(started));
    });
    t.test("QU-15: chọn 'Tôi là PT' → mở thẳng màn PT ở tab 'Học viên của tôi'", async ()=>{
      const app = await t.app({ state:{ onboarded:true, authDone:false } });
      await app.run(`(async ()=>{ cloud.updateMyProfile = async ()=>{}; coachTab = "coaches"; await pickRole("pt"); })()`);
      assert.equal(app.ev("coachTab"), "clients");
      assert.ok(app.ev(`document.getElementById("screen-coach").classList.contains("active")`), "không mở màn PT");
    });
    t.test("QU-20 · QT-20: người mới cài thứ Tư — T2/T3 không bị chấm 'bỏ lỡ', chỉ tiêu tuần chỉ tính từ ngày bắt đầu; người dùng cũ vẫn thấy ngày bỏ lỡ", async ()=>{
      const mk = async startDate=>{
        const app = await t.app({ state:{ profile: PROF(), startDate } });
        app.setNow(WED); app.run(PLAN3); app.call("renderHomeScreen");
        const h = app.lastHtml("home-content");
        return { miss: (h.match(/class="wd [^"]*\bmiss\b/g) || []).length, week: (h.match(/Tuần này: <b[^>]*>(\d+\/\d+)<\/b>/) || [])[1] };
      };
      const fresh = await mk("2026-11-11");
      assert.equal(fresh.miss, 0, "người mới bị chấm bỏ lỡ");
      assert.equal(fresh.week, "0/1");
      const old = await mk("2026-10-01");
      assert.equal(old.miss, 2, "người dùng cũ phải thấy T2/T3 bỏ lỡ");
      assert.equal(old.week, "0/3");
      // người dùng cũ chưa có startDate → lấy ngày sớm nhất có dữ liệu tập
      const app = await t.app({ state:{ profile: PROF(), finishedDates:["2026-10-20"] } });
      assert.equal(app.ev("(delete state.startDate, fkStartDate())"), "2026-10-20");
    });
    t.test("QU-22: người mới (cấp Mới tập) — ẩn cột RPE, có thẻ 'Cách ghi hiệp' + gợi ý mức nhẹ; bật lại được; cấp khác giữ RPE", async ()=>{
      const app = await t.app({ state:{ profile: PROF({ level:"beginner" }) } });
      app.setNow(WED);
      const run = ()=>{ app.run(`session = { dayKey:"T4", idx:0, items:[{ uid:"g", exerciseId:"benchpress", sets:3, reps:"8-12", restSec:60 }], isToday:true, completed:[], date: todayStr(), sid:"s" }; state.setLog = {}; renderSessionStep();`); return app.lastHtml("sheet-content"); };
      const h = run();
      assert.ok(!/class="rpe"/.test(h), "người mới vẫn thấy cột RPE");
      assert.ok(h.includes("Cách ghi hiệp") && h.includes("Hiện cột RPE") && /mức <b>nhẹ<\/b>/.test(h), "thiếu hướng dẫn người mới");
      app.run(`state.profile.showRpe = true;`);
      assert.ok(/class="rpe"/.test(run()), "bật lại RPE không được");
      app.run(`state.profile.showRpe = false; state.profile.level = "intermediate";`);
      assert.ok(/class="rpe"/.test(run()));
    });
    t.test("QU-29: sheet là hộp thoại — role=dialog, aria-modal, nhãn theo tiêu đề; nền inert khi mở và gỡ khi đóng; trả focus; Tab bị giữ trong sheet", async ()=>{
      const app = await t.app();
      const r = app.run(`(()=>{ const bd = document.getElementById("sheet-backdrop"); const host = document.createElement("div"); const main = document.createElement("main");
        host.appendChild(main); host.appendChild(bd); const opener = { focus(){ opener.f = (opener.f||0) + 1; }, isConnected:true, closest(){ return null; } };
        document.activeElement = opener; bd.classList.remove("open");
        openSheet('<div class="sheet-header"><h3>Tiêu đề</h3></div><button>OK</button>');
        const sc = document.getElementById("sheet-content");
        const a = [sc.getAttribute("role"), sc.getAttribute("aria-modal"), !!sc.getAttribute("aria-labelledby"), main.hasAttribute("inert"), bd.hasAttribute("inert")];
        closeSheet(); document.activeElement = document.body;
        a.push(main.hasAttribute("inert"), opener.f || 0); return JSON.stringify(a); })()`);
      assert.deepEqual(JSON.parse(r), ["dialog", "true", true, true, false, false, 1]);
      const src = read("app.js");
      assert.ok(/e\.key !== "Tab"/.test(src) && /fkSheetFocusables/.test(src), "thiếu bẫy focus Tab");
    });
    t.test("QU-30: thẻ chọn onboarding / thẻ vai trò / ô chỉ số dùng được bằng bàn phím — role + aria-checked + tabindex; Enter/Space bấm; mũi tên đổi lựa chọn", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.run(`renderChoiceList("#goal-list", GOALS, "goal")`);
      const h = app.lastHtml("goal-list");
      const cards = h.match(/<div class="choice-card"[^>]*>/g) || [];
      assert.ok(cards.length >= 3 && cards.every(c=> /role="radio"/.test(c) && /aria-checked="false"/.test(c) && /tabindex="0"/.test(c) && /data-fk-key/.test(c)), cards[0]);
      assert.equal(app.ev(`document.getElementById("goal-list").getAttribute("role")`), "radiogroup");
      // Enter / Space trên phần tử data-fk-key → click()
      const r = app.run(`(()=>{ let n = 0; const el = { getAttribute: k=> k === "role" ? "button" : null, click(){ n++; } }; el.closest = ()=> el;
        ["Enter", " ", "a"].forEach(key=>{ const ev = { key, target: el, defaultPrevented:false, preventDefault(){ this.defaultPrevented = true; } };
          (document._listeners.keydown || []).forEach(fn=>{ try{ fn(ev); }catch(e){} }); });
        return n; })()`);
      assert.equal(r, 2);
      // fkChoiceSelect cập nhật aria-checked
      const ac = app.run(`(()=>{ const mk = ()=>{ const e = document.createElement("div"); return e; }; const a = mk(), b = mk(); fkChoiceSelect([a, b], b); return JSON.stringify([a.getAttribute("aria-checked"), b.getAttribute("aria-checked")]); })()`);
      assert.deepEqual(JSON.parse(ac), ["false", "true"]);
      // Trang chủ + màn vai trò
      app.call("renderHomeScreen");
      const home = app.lastHtml("home-content");
      assert.ok((home.match(/class="metric"[^>]*role="button"[^>]*tabindex="0"[^>]*data-fk-key/g) || []).length === 3, "ô chỉ số chưa dùng được bằng bàn phím");
      assert.ok(/class="streak-chip"[^>]*role="button"[^>]*tabindex="0"/.test(home));
      assert.ok(/class="role-card[^"]*"[^>]*role="button" tabindex="0" data-fk-key/.test(read("pt.js")), "thẻ vai trò");
    });

    /* =====================================================================
       VÒNG 2 (docs/qa/HANDOFF-ROUND-BRIEF.md — mục core)
       ===================================================================== */
    /* mô phỏng #sheet-content của menu ☰ (DOM giả của harness không phân tích HTML) */
    const MENU_MOCK = `(rows)=>{
      const mk = ([oc, text, deep, kw])=>({ _a: Object.assign({ onclick: oc }, kw ? { "data-kw": kw } : {}), hidden: !!deep, style:{ display: deep ? "none" : "" },
        textContent: text, dataset:{}, classList:{ _s: new Set(["link-row"].concat(deep ? ["te-mdeep"] : [])), contains(c){ return this._s.has(c); }, add(c){ this._s.add(c); } },
        getAttribute(k){ return k in this._a ? this._a[k] : null; }, hasAttribute(k){ return k in this._a; }, setAttribute(k, v){ this._a[k] = String(v); }, click(){ this.clicked = (this.clicked||0) + 1; } });
      const R = rows.map(mk);
      const grp = { hidden:false, style:{}, querySelectorAll: ()=> R };
      const list = { _a:{}, setAttribute(k, v){ this._a[k] = v; }, getAttribute(k){ return k in this._a ? this._a[k] : null; },
        querySelectorAll: sel=> sel === ".link-row" ? R : sel === ".te-mgroup" ? [grp] : [] };
      const empty = document.createElement("p");
      const sc = { querySelector: sel=> sel === "[data-te-menu]" ? list : sel === ".te-menu-empty" ? empty : null,
        querySelectorAll: sel=> /link-row/.test(sel) ? R : [] };
      return { R, grp, list, empty, sc };
    }`;
    t.test("QU-18: menu ☰ ≤ 12 mục hiện sẵn (5 nhóm, tên theo GLOSSARY §8.1); mục trùng thanh dưới / đã gộp thành lối tắt ẩn — không mất lối vào nào; giữ mốc cho kb/events/admin/community/findpt", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.call("openMainMenu");
      const h = app.lastHtml("sheet-content");
      // ô tìm ở đầu menu
      assert.ok(/<input id="te-menu-q" type="search" placeholder="Tìm trong TapEasy"/.test(h) && h.indexOf("te-menu-q") < h.indexOf("data-te-menu"), "thiếu ô Tìm trong TapEasy ở đầu menu");
      // mốc module dựa vào
      assert.ok(h.includes(`<div class="link-row" onclick="goto('sleep');closeSheet();">`) && h.includes(`goto('reminders');closeSheet();`) && /onclick="goto\('coach'\);closeSheet\(\);"/.test(h), "mất mốc menu");
      assert.ok(h.includes("data-kb-menu") && h.indexOf("data-kb-menu") < h.indexOf(`goto('sleep')`), "kb.js không chèn được Kho kiến thức");
      // ánh xạ cũ → mới: MỌI đích của menu 22 mục cũ vẫn có trong menu (trực tiếp hoặc lối tắt ẩn)
      const OLD = ["goto('home')","goto('coach')","goto('sleep')","goto('profile')","goto('reminders')","goto('workout')","goto('nutrition')","NutriPro.ui.openShoppingList()",
        "openTemplateBrowser()","openExLib()","goto('plans')","goto('library')","goto('progress')","openProgramBuilder()","FKAch.open()","openHealthSafety()","TEKB.open()"];
      expectNone(OLD.filter(x=> !h.includes(x)), "lối vào bị mất khỏi menu");
      // đếm mục hiện sẵn = dòng lõi không ẩn + kb + 4 dòng module (Tìm PT, Cộng đồng, Sự kiện, Cửa hàng; "Gặp mặt & vé" gộp vào Sự kiện)
      const rows = [...h.matchAll(/<div class="link-row([^"]*)"([^>]*)>/g)].map(m=> ({ cls: m[1], attrs: m[2], oc: (m[2].match(/onclick="([^"]*)"/) || [])[1] || "" }));
      const slot = (o)=> app.evj(`(()=>{ const a = ${JSON.stringify(o)}; return teMenuSlot({ getAttribute: k=> k === "onclick" ? (a.oc || null) : null, dataset: a.dataset || {},
        classList: { contains: c=> (a.cls || []).includes(c) } }); })()`);
      const mods = [{ dataset:{ fpMenu:"" } }, { dataset:{ cmMenu:"" } }, { cls:["te-menu"], dataset:{ te:"hub", id:"challenges" } }, { cls:["te-menu"], dataset:{ te:"hub", id:"events" } }, { cls:["te-menu"], dataset:{ te:"hub", id:"shop" } }];
      const visible = rows.filter(r=> !/te-mdeep/.test(r.cls) && !/\bhidden\b/.test(r.attrs)).map(r=> ({ oc: r.oc, cls: r.cls.trim().split(/\s+/).filter(Boolean) }))
        .concat(mods).filter(o=> !slot(o)[2]);
      assert.ok(visible.length <= 12, "menu còn " + visible.length + " mục hiện sẵn");
      assert.equal(visible.length, 12, "đếm mục: " + JSON.stringify(visible.map(v=> v.oc || JSON.stringify(v.dataset))));
      // lối tắt ẩn trong HTML phải đúng là mục slot đánh dấu ẩn (đồng bộ HTML ↔ teMenuSlot)
      const deepHtml = rows.filter(r=> /te-mdeep/.test(r.cls)).map(r=> r.oc);
      expectNone(deepHtml.filter(oc=> !slot({ oc })[2]), "dòng ẩn trong HTML nhưng slot không ẩn");
      assert.ok(deepHtml.length >= 8, "thiếu lối tắt ẩn: " + deepHtml.join(" | "));
      expectNone(rows.filter(r=> !/te-mdeep/.test(r.cls) && slot({ oc:r.oc })[2]).map(r=> r.oc), "dòng hiện sẵn nhưng slot đánh dấu ẩn");
      // nhóm + tên (GLOSSARY §8.1)
      assert.deepEqual(app.evj("TE_MENU_GROUPS.filter(g=> g.title).map(g=> g.title)"), ["Tập luyện","Dinh dưỡng & sức khoẻ","PT & cộng đồng","Kiến thức & cửa hàng","Khác","Quản trị"]);
      for(const bad of ["Hồ sơ của tôi","Lịch tập tuần này","Quản lý chương trình","Ảnh tiến trình","TapEasy PT — PT","Kết nối PT"]) assert.ok(!h.includes(bad), "menu còn tên cũ: " + bad);
      for(const good of [">Giáo án<",">Tiến độ<",">Lịch tuần<",">Hồ sơ<"]) assert.ok(h.includes(good), "thiếu " + good);
      // Sự kiện gộp: dòng "Thi đua" của events.js hiện là "Sự kiện", "Gặp mặt & vé" thành lối tắt ẩn; "Gian hàng TapEasy" → "Cửa hàng"
      const rl = app.run(`(()=>{ const out = []; for(const id of ["challenges","events","shop"]){ const row = document.createElement("div"); row.className = "link-row te-menu"; row.dataset.id = id;
        const left = document.createElement("div"), nm = document.createElement("div"); nm.className = "name"; left.appendChild(nm); row.appendChild(left);
        row.querySelector = sel=> sel === ".name" ? nm : null; teMenuRelabel(row); const w = left.children[0]; out.push(w && w.children ? w.children.map(c=> c.textContent).join("|") : ""); } return JSON.stringify(out); })()`);
      assert.deepEqual(JSON.parse(rl), ["Sự kiện|Thử thách · Gặp mặt · Vé · Quà", "Gặp mặt & vé|Sự kiện offline", "Cửa hàng|Đồ tập · quà · đơn hàng"]);
      assert.equal(app.evj(`teMenuSlot({ getAttribute: ()=> null, dataset:{ id:"events" }, classList:{ contains: c=> c === "te-menu" } })[2]`), true);
    });
    t.test("QU-18: ô 'Tìm trong TapEasy' — bỏ dấu, tìm cả lối tắt ẩn (tên cũ / từ khoá), không khớp → gợi ý tìm bài tập (chữ người dùng qua textContent, không chèn HTML); Enter mở dòng đầu", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      assert.equal(app.call("teMenuNorm", "  Đi CHỢ  tuần "), "di cho tuan");
      const r = app.run(`(()=>{ const M = (${MENU_MOCK})([["goto('plans');closeSheet();","Giáo án Lịch tuần · Giáo án mẫu",false,"giao an chuong trinh"],
          ["goto('sleep');closeSheet();","Giấc ngủ",false,""], ["goto('library');closeSheet();","Kho video của tôi",true,"kho video"],
          ["closeSheet();NutriPro.ui.openShoppingList();","Đi chợ tuần",true,"di cho tuan mua sam"], ["goto('profile');closeSheet();","Hồ sơ Tài khoản",true,"ho so cua toi"]]);
        const o = document.getElementById; document.getElementById = id=> id === "sheet-content" ? M.sc : o.call(document, id);
        const vis = ()=> M.R.filter(x=> !x.hidden).map(x=> x.textContent.split(" ")[0] + (x.style.display === "none" ? "!" : ""));
        const out = {};
        try{
          out.empty = [teMenuFilter(""), vis()];
          out.video = [teMenuFilter("video"), vis()];
          out.cho = [teMenuFilter("đi chợ"), vis()];
          out.chuongtrinh = [teMenuFilter("Chương trình"), vis()];
          out.hoso = [teMenuFilter("hồ sơ của tôi"), vis()];
          out.none = [teMenuFilter(${JSON.stringify(XSS)}), vis(), M.grp.hidden, M.empty.innerHTML, M.empty.children.length];
          out.reset = [teMenuFilter(""), vis(), M.grp.hidden, M.empty.hidden];
        } finally { document.getElementById = o; }
        return JSON.stringify(out); })()`);
      const o = JSON.parse(r);
      assert.deepEqual(o.empty, [2, ["Giáo", "Giấc"]], "mặc định chỉ hiện mục chính");
      assert.deepEqual(o.video, [1, ["Kho"]], "tìm 'video' phải ra Kho video (lối tắt ẩn)");
      assert.deepEqual(o.cho, [1, ["Đi"]]);
      assert.deepEqual(o.chuongtrinh, [1, ["Giáo"]], "tên cũ 'Chương trình' → Giáo án");
      assert.deepEqual(o.hoso, [1, ["Hồ"]]);
      assert.equal(o.none[0], 0); assert.equal(o.none[2], true, "nhóm rỗng phải ẩn");
      assert.ok(!DANGER.test(o.none[3]) && o.none[3].includes("&lt;img"), "chuỗi tìm phải hiện thành chữ: " + o.none[3]);
      assert.ok(o.none[4] >= 1, "thiếu nút gợi ý tìm bài tập");
      assert.deepEqual(o.reset, [2, ["Giáo", "Giấc"], false, true]);
      const src = read("app.js");
      assert.ok(/inp\.addEventListener\("keydown"[\s\S]{0,200}e\.key === "Enter"[\s\S]{0,260}first\.click\(\)/.test(src), "Enter chưa mở dòng đầu");
      assert.ok(/fkKeyable\(r, "button"\)/.test(src), "dòng menu chưa dùng được bằng bàn phím");
    });
    t.test("QU-21: màn Tiến độ có tab 'Kỷ lục' (mặc định) — 1RM ước tính + kỷ lục số lần bài trọng lượng cơ thể (QT-17), escape tên bài; tab Ảnh không còn thẻ kỷ lục; menu 'Tiến độ'", async ()=>{
      const app = await t.app({ state:{ profile: PROF(), finishedDates:["2026-11-09","2026-11-10"], setHist:{
        benchpress:{ name:"Đẩy ngực <b>x</b>", list:[{ date:"2026-11-03", e1rm:72, sets:[{kg:60,reps:6}] }, { date:"2026-11-10", e1rm:80, sets:[{kg:60,reps:10}] }] },
        pushup:{ name: XSS, list:[{ date:"2026-11-09", e1rm:0, sets:[{kg:0,reps:15},{kg:0,reps:18}] }] } } } });
      assert.equal(app.ev("progressUI.tab"), "records", "tab mặc định phải là Kỷ lục");
      app.call("goto", "progress");
      const h = app.lastHtml("progress-content");
      assert.ok(/class="card pr-card"/.test(h) && /Kỷ lục cá nhân/.test(h) && /80 kg/.test(h), "thiếu thẻ Kỷ lục cá nhân");
      assert.ok(/Kỷ lục số lần/.test(h) && /18 lần/.test(h), "thiếu kỷ lục số lần bài trọng lượng cơ thể");
      assert.ok(!DANGER.test(h) && h.includes("Đẩy ngực &lt;b&gt;x&lt;/b&gt;"), "tên bài chưa escape");
      assert.deepEqual(app.evj("fkRepRecords().map(x=> [x.k, x.best])"), [["pushup", 18]]);
      app.call("openProgress", "photos");
      assert.equal(app.ev("progressUI.tab"), "photos");
      assert.ok(!/pr-card/.test(app.lastHtml("progress-content")), "thẻ kỷ lục vẫn chèn vào tab Ảnh");
      app.call("openProgress", "khong-co"); assert.equal(app.ev("progressUI.tab"), "photos", "tab lạ không được nhận");
      // nút tab "Kỷ lục" được chèn khi index.html chưa có; 1 trình nghe uỷ quyền cho mọi nút tab
      const src = read("app.js");
      assert.ok(/function fkEnsureRecordsTab\(\)/.test(src) && /\$\("#progress-tabs"\)\.addEventListener\("click"/.test(src), "tab Kỷ lục chưa gắn được");
      app.call("openMainMenu");
      assert.ok(/>Tiến độ<\/div><div class="sub">Kỷ lục · Số đo InBody · Ảnh tiến độ</.test(app.lastHtml("sheet-content")), "mục menu chưa đổi tên 'Tiến độ'");
    });
    t.test("QU-02: appBoot vẽ Trang chủ rồi nhường luồng; đồng bộ PT / thông báo / service worker / lưu hồ sơ chạy sau (fkYield, fkIdle chạy đúng 1 lần)", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      assert.ok(app.ev(`document.getElementById("screen-home").classList.contains("active")`) && app.lastHtml("home-content").length > 200, "Trang chủ chưa vẽ sau khi khởi động");
      const src = read("pt.js");
      const boot = src.slice(src.indexOf("async function appBoot()"), src.indexOf("appBoot();", src.indexOf("async function appBoot()")));
      const iF = boot.indexOf("finishBoot();"), iY = boot.indexOf("await fkYield()"), iR = boot.lastIndexOf("refreshCoachData(true)");
      assert.ok(iF > 0 && iY > iF && iR > iY, "phải: finishBoot → nhường luồng → refreshCoachData");
      assert.ok(/fkIdle\(\(\)=> nativeNotif\.syncSoon\(\)/.test(boot) && /fkIdle\(\(\)=>\{ try\{ navigator\.serviceWorker\.register/.test(boot), "việc phụ chưa chuyển sang lúc rảnh");
      assert.ok(/recomputeProfile\(\);\s*\n\s*if\(JSON\.stringify\(state\.profile \|\| \{\}\) !== _prof0\) _saveStateV1\(\);/.test(src), "finishBoot vẫn ghi state qua mọi lớp bọc lúc khởi động");
      // hồ sơ không đổi → finishBoot không ghi; đổi → ghi đúng 1 lần, không qua lớp bọc module
      const fb = app.run(`(()=>{ let raw = 0, wrapped = 0; const ls = localStorage.setItem; localStorage.setItem = function(k){ if(k === "fitkit_state_v1") raw++; return ls.apply(this, arguments); };
        const o2 = saveState; saveState = ()=>{ wrapped++; return true; }; const g = goto; goto = ()=>{};
        try{ recomputeProfile(); finishBoot("home"); const a = raw; state.profile.weight = Number(state.profile.weight) + 3; finishBoot("home"); return JSON.stringify([a, raw, wrapped]); }
        finally { localStorage.setItem = ls; saveState = o2; goto = g; } })()`);
      assert.deepEqual(JSON.parse(fb), [0, 1, 0]);
      // fkIdle: rIC gọi ngay → setTimeout dự phòng KHÔNG chạy lại lần 2
      app.run(`globalThis.__n = 0; globalThis.__ric = globalThis.requestIdleCallback; globalThis.requestIdleCallback = (fn)=>{ fn(); return 1; }; fkIdle(()=> __n++, 5); globalThis.requestIdleCallback = __ric;`);
      await app.settle(30);
      assert.equal(app.ev("__n"), 1);
      // không có rIC → setTimeout vẫn chạy
      app.run(`globalThis.__n2 = 0; globalThis.__ric2 = globalThis.requestIdleCallback; globalThis.requestIdleCallback = undefined; fkIdle(()=> __n2++, 5); globalThis.requestIdleCallback = __ric2;`);
      await app.settle(30);
      assert.equal(app.ev("__n2"), 1);
      assert.equal(await app.ev("fkYield().then(()=> 7)"), 7);
      assert.equal(app.asyncErrors.length, 0, app.asyncErrors.map(e=> e.message).join("; "));
    });
    t.test("QU-04: màn chào KHÔNG gọi API video (Pixabay/Pexels) lúc mở — nền ảnh tĩnh ~720 px; video nền chỉ khi có URL cố định (gắn lúc rảnh)", async ()=>{
      const app = await t.app({ state:{ profile: PROF(), authDone:false, onboarded:false } });
      app.run(`globalThis.__sv = 0; globalThis.__mw = 0; searchVideos = async ()=>{ __sv++; return []; }; mountWelcomeVideo = ()=>{ __mw++; return Promise.resolve(); };
        globalThis.requestIdleCallback = (fn)=>{ fn(); return 1; }; MEDIA_CONFIG.welcomeVideo = "auto"; MEDIA_CONFIG.pixabayKey = MEDIA_CONFIG.pixabayKey || "k";`);
      const n0 = app.fetchLog.length;
      app.call("showAuth", "welcome"); await app.settle(40);
      assert.equal(app.ev("__sv"), 0, "vẫn gọi API tìm video lúc mở màn chào");
      assert.equal(app.ev("__mw"), 0, "không có URL cố định thì không gắn video");
      assert.ok(!app.fetchLog.slice(n0).some(u=> /pixabay\.com\/api|api\.pexels\.com/.test(u)), "có request API video");
      const h = app.lastHtml("auth-body");
      assert.ok(/wl-hero-bg" style="background-image:url\('(https:\/\/images\.pexels\.com[^']*w=720|[^']*media\/welcome\/welcome-bw-poster\.jpg)/.test(h), "nền màn chào chưa dùng ảnh tĩnh nhỏ");   // 12/11: poster đen trắng tự host
      app.run(`MEDIA_CONFIG.welcomeVideo = "https://cdn.example.com/welcome.mp4"; document.getElementById("auth").classList.add("open");`);
      app.call("showAuth", "welcome"); await app.settle(40);
      assert.equal(app.ev("__mw"), 1, "có URL cố định → gắn video (lúc rảnh) đúng 1 lần");
      assert.equal(app.ev("__sv"), 0);
      app.run(`MEDIA_CONFIG.welcomeVideo = "javascript:alert(1)"`);
      assert.equal(app.ev("welcomeVideoFixedSrc()"), "", "URL video phải qua safeUrl");
    });
    t.test("QN-10: < 18 tuổi chọn 'tăng cơ' → calo = round(EER × 1,05) (không +12 % như người lớn); người lớn giữ +12 %", async ()=>{
      const app = await t.app({ state:{ profile: { name:"Teen", gender:"male", age:16, height:172, weight:58, activity:"active", goal:"gain", autoTargets:true } } });
      app.run("recomputeProfile()");
      const p = app.evj("state.profile");
      assert.equal(p.tdee, app.ev("calcEER(state.profile)"), "16 tuổi phải dùng EER");
      assert.equal(p.goalKcal, Math.max(Math.round(p.tdee * 1.05), p.bmr || 0, 1500));
      assert.ok(p.goalKcal < Math.round(p.tdee * 1.1), `${p.goalKcal} vẫn dư > 10 %`);
      app.run(`state.profile.gender = "female"; state.profile.age = 15; state.profile.weight = 50; state.profile.height = 158; recomputeProfile();`);
      assert.equal(app.ev("state.profile.goalKcal"), Math.max(Math.round(app.ev("state.profile.tdee") * 1.05), 1200, app.ev("state.profile.bmr")));
      app.run(`state.profile.age = 30; state.profile.gender = "male"; state.profile.weight = 72; state.profile.height = 172; recomputeProfile();`);
      assert.equal(app.ev("state.profile.goalKcal"), app.ev("calcGoalKcal(state.profile.tdee, 'gain')"), "người lớn phải giữ +12 %");
      app.run(`state.profile.age = 16; state.profile.goal = "maintain"; recomputeProfile();`);
      assert.equal(app.ev("state.profile.goalKcal"), Math.max(app.ev("state.profile.tdee"), 1500, app.ev("state.profile.bmr")), "duy trì không đổi");
    });
    t.test("buổi < 3 phút: bấm Xong liên tục ('Ghi nhận tất cả') < 3 phút → KHÔNG ghi workoutLog/finishedDates/nhật ký training-pro; ≥ 3 phút hoặc ≥ 1 hiệp tự ghi → tính", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      app.setNow(WED);
      app.run(`(()=>{ const p = createBlankPlan("Một bài"); p.days.T4.items = [{ uid:"q1", exerciseId:"benchpress", sets:2, reps:"8-12", restSec:60, clipId:null }]; state.activePlanId = p.id;
        state.finishedDates = []; state.workoutLog = {}; saveState(); })()`);
      const tpLen = ()=> app.ev("(state.trainingPro && Array.isArray(state.trainingPro.log)) ? state.trainingPro.log.length : 0");
      const L0 = tpLen();
      const fresh = ()=> app.run(`session = null; document.getElementById("btn-session-done")._listeners = {}; startSession("T4");`);
      // (a) 6 giây, chỉ bấm "Xong bài" → confirm "Ghi nhận tất cả"
      fresh(); app.setNow("2026-11-11T09:00:06");
      app.dom.registry.get("btn-session-done").click();
      assert.equal(app.ev("session"), null, "buổi chưa kết thúc");
      assert.ok(!app.ev(`state.workoutLog["2026-11-11"]`), "buổi 6 giây vẫn ghi workoutLog");
      assert.ok(!app.ev(`state.finishedDates.includes("2026-11-11")`), "buổi 6 giây vẫn tính chuỗi");
      assert.equal(tpLen(), L0, "buổi 6 giây vẫn vào nhật ký training-pro (XP)");
      assert.ok(/không tính/.test(app.lastHtml("sheet-content")), "không báo buổi quá ngắn");
      // (b) < 3 phút nhưng có hiệp tự ghi (✓ từng hiệp) → tính
      app.setNow(WED);
      fresh(); app.run(`session.sets.q1 = [{ kg:40, reps:10, rpe:"", done:true }, { kg:40, reps:9, rpe:"", done:false }]; session.completed = ["q1"]; session.idx = 1; renderSessionStep();`);
      assert.equal(app.ev(`state.workoutLog["2026-11-11"] && state.workoutLog["2026-11-11"].dayKey`), "T4", "hiệp tự ghi phải được tính");
      assert.ok(app.ev(`state.finishedDates.includes("2026-11-11")`));
      // (c) "Ghi nhận tất cả" nhưng buổi ≥ 3 phút → tính
      app.run(`state.workoutLog = {}; state.finishedDates = [];`);
      app.setNow(WED); fresh(); app.setNow("2026-11-11T09:03:30");
      app.dom.registry.get("btn-session-done").click();
      assert.ok(app.ev(`state.finishedDates.includes("2026-11-11")`), "buổi 3,5 phút phải tính");
      // logic thuần
      assert.equal(app.ev(`fkSessionCounts({ items:[], completed:[] })`), true, "phiên cũ không có startedAt → tính như trước");
      assert.equal(app.ev(`fkSessionCounts({ startedAt: Date.now() - 5000, sets:{ a:[{ done:true, reps:10, _bulk:true }] } })`), false);
      assert.equal(app.ev(`fkSessionCounts({ startedAt: Date.now() - 5000, sets:{ a:[{ done:true, reps:10, _bulk:true, _repsEdited:true }] } })`), true);
      assert.equal(app.ev(`fkSessionCounts({ startedAt: Date.now() - 5000, sets:{ a:[{ done:true, reps:0 }] } })`), false, "hiệp tính giờ/0 lần không đủ");
      assert.equal(app.ev(`fkSessionCounts({ startedAt: Date.now() - 181000, sets:{} })`), true);
    });
    t.test("Training §4.4: fkPrefillRows dùng FKTP.ensureRows (một nguồn điền sẵn) cho bài của buổi đang tập; ngoài buổi / không có training-pro → logic lõi", async ()=>{
      const app = await t.app({ state:{ profile: PROF() } });
      const r = app.run(`(()=>{ const it = { uid:"e1", exerciseId:"benchpress", sets:3, reps:"8-12", restSec:90 };
        let n = 0; const o = FKTP.ensureRows; FKTP.ensureRows = function(){ n++; return o.apply(this, arguments); };
        const ctx = { meta: getExerciseMeta(it), last:{ date:"2026-11-04", sets:[{kg:60,reps:12},{kg:60,reps:12},{kg:60,reps:12}] }, timed:false, nSets:3, top:12, prog:{ delta:0 } };
        try{
          session = { dayKey:"T4", idx:0, items:[it], isToday:true, completed:[], sets:{} };
          const a = fkPrefillRows(it, ctx);
          const same = a === session.sets.e1;
          session = null;
          const b = fkPrefillRows(it, ctx);
          return JSON.stringify({ n, same, a: a.map(x=> [x.kg, x.reps]), b: b.map(x=> [x.kg, x.reps]) });
        } finally { FKTP.ensureRows = o; session = null; } })()`);
      const o = JSON.parse(r);
      assert.equal(o.n, 1, "chưa gọi FKTP.ensureRows");
      assert.equal(o.same, true, "hàng điền sẵn phải là 1 mảng duy nhất trong session.sets");
      assert.equal(o.a.length, 3); assert.equal(o.b.length, 3);
      assert.deepEqual(o.b[0], [60, 12], "ngoài buổi tập → logic lõi (QT-10)");
    });
    t.test("Thuật ngữ §8.4 (app.js/pt.js) + QU-31: không còn tên cũ ở chữ hiển thị; không còn chữ < 12 px nội tuyến", async ()=>{
      const strip = src=> src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
      const a = strip(read("app.js")), p = strip(read("pt.js"));
      for(const [src, f] of [[a, "app.js"], [p, "pt.js"]]){
        expectNone([..."Quản lý chương trình|Lịch tập tuần này|Hồ sơ của tôi|Ảnh tiến trình|ảnh tiến trình|So sánh tiến trình|Dùng chương trình|Tạo chương trình mới|title:\"Gian hàng\"|Album PT công khai|Routine của PT|TapEasy PT — PT|\"CHƯƠNG TRÌNH\"|ĐANG DÙNG".split("|")].filter(x=> src.includes(x)), f + " còn tên cũ");
        const small = src.match(/font-size:\s*(?:[0-9]|1[01])(?:\.\d+)?px/g) || [];
        expectNone(small, f + " còn chữ < 12 px");
      }
    });
  }
};

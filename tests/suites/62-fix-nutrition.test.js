/* =========================================================================
   Vòng sửa lỗi sau QA (11/11/2026) — fixer NUTRITION
   Hồi quy cho docs/qa/QA-nutrition.md (QN-01 … QN-27). File sở hữu: data.js, meals.js, meals-extra.js,
   nutrition.js, nutrition-pro.js/.css, health-safety.js/.css, scripts/food_sources.json, scripts/fetch_food_images.py.
   Một số mục có phần lõi ở app.js (fixer core: QN-05/07/08/24/27) — test ở đây kiểm KẾT QUẢ người dùng thấy.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert, expectNone } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

const NOW = Date.parse("2026-11-11T09:00:00");
const PROF = (o)=> Object.assign({ name:"Tester", gender:"male", age:30, height:172, weight:72, activity:"moderate", goal:"gain", autoTargets:true }, o||{});
const HS = (o)=> Object.assign({ v:1, completedAt: NOW - 86400000, parq:{}, pregnancy:"none", diabetes:"none", cardio:"none", kidney:"none", edHistory:"no", injuries:[] }, o||{});
const mk = async (t, profile, health, extra)=>{
  const app = await t.app({ state: Object.assign({ onboarded:true, authDone:true, profile: PROF(profile), health: health === undefined ? {} : health }, extra || {}) });
  app.setNow(NOW);
  app.run("recomputeProfile()");
  return app;
};
/* Vòng 2 (QU-03): thẻ "Thực đơn gợi ý" chưa có trong bộ nhớ được vẽ LÚC RẢNH (khung chờ trước) — trong Node không có
   requestIdleCallback thật, nên các test đọc nội dung thẻ thực đơn chạy hết việc chờ bằng NutriPro.ui.flushIdle() (cập nhật vòng 2). */
const NU_RENDER = "renderNutritionScreen(); NutriPro.ui.flushIdle();";
/* tổng 7 ngày thực đơn: [{k,p,ids,meals}] */
const week = (app, prefs)=> app.evj(`(()=>{ const out = []; for(let d=0; d<7; d++){ const pl = buildDayPlan(state.profile, d, ${JSON.stringify(prefs || {})});
  const t = NutriPro.planTotals(pl); out.push({ k:t.k, p:t.p, meals: Object.keys(pl).map(m=> m+":"+pl[m].id), ids: Object.values(pl).flatMap(r=> r.items.map(i=>i[0])) }); } return out; })()`);

module.exports = {
  name: "Vòng sửa lỗi QA — Dinh dưỡng (fix-nutrition)",
  area: "data / meals / nutrition / nutrition-pro / health-safety / ảnh món",
  async define(t){

    /* ---------- QN-01 · Cao: trần đạm bệnh thận, đạm thấp nhưng đủ calo ---------- */
    t.test("QN-01: bệnh thận mạn — 7 ngày × 2 chế độ: đạm ≤ +5 % (trần cứng), calo ±5 %; không món phụ giàu đạm / bột đạm", async ()=>{
      const app = await mk(t, { gender:"male", age:55, height:168, weight:70, activity:"sedentary", goal:"maintain" }, HS({ kidney:"ckd" }));
      const T = app.evj("NutriPro.targets(state.profile)");
      assert.equal(T.P, 56, "đạm mục tiêu 0,8 g/kg × 70 kg");
      const bad = [];
      for(const pr of [{}, { vegan:true, veg:true }]) week(app, pr).forEach((d, i)=>{
        if(d.p > T.P*1.05) bad.push(`${JSON.stringify(pr)} ngày ${i+1}: đạm ${d.p.toFixed(1)} > ${T.P}×1,05`);
        if(Math.abs(d.k - T.K)/T.K > 0.05) bad.push(`${JSON.stringify(pr)} ngày ${i+1}: calo ${Math.round(d.k)} vs ${T.K}`);
        if(d.ids.some(id=> ["whey","protein-thuc-vat"].includes(id))) bad.push(`ngày ${i+1}: có bột đạm`);
      });
      expectNone(bad, "thực đơn bệnh thận");
    });
    t.test("QN-01: cho con bú & 16 tuổi — đạm không vượt > +15 %, calo cho bú ±5,5 % (trước: −12 % / +26 %)", async ()=>{
      const bf = await mk(t, { gender:"female", age:30, height:160, weight:58, activity:"light", goal:"lose" }, HS({ pregnancy:"postpartum", postpartumWeeks:"gt12", breastfeeding:true }));
      const T = bf.evj("NutriPro.targets(state.profile)");
      const bad = [];
      week(bf).forEach((d,i)=>{ if(d.p > T.P*1.15) bad.push(`cho bú ngày ${i+1}: đạm ${d.p.toFixed(0)}/${T.P}`); if(Math.abs(d.k-T.K)/T.K > 0.055) bad.push(`cho bú ngày ${i+1}: calo ${Math.round(d.k)}/${T.K}`); });
      const teen = await mk(t, { gender:"female", age:16, height:158, weight:60, activity:"light", goal:"lose" }, HS());
      const T2 = teen.evj("NutriPro.targets(state.profile)");
      week(teen).forEach((d,i)=>{ if(d.p > T2.P*1.15) bad.push(`16 tuổi ngày ${i+1}: đạm ${d.p.toFixed(0)}/${T2.P}`); });
      expectNone(bad, "đạm thấp");
    });

    /* ---------- QN-02 · Cao: lời khuyên BMI / nhãn mục tiêu cho thai phụ, cho bú, RLĂU ---------- */
    t.test("QN-02: thai phụ T3 (BMI 26,5) — không 'THÂM HỤT', không 'Giảm mỡ'; BMI ẩn, có mức tăng cân IOM 2009", async ()=>{
      const app = await mk(t, { gender:"female", age:31, height:160, weight:68, activity:"sedentary", goal:"lose" }, HS({ pregnancy:"pregnant", trimester:3 }));
      const a = app.evj("bodyAnalysis(state.profile)");
      assert.ok(a.hideBmi, "BMI khi mang thai phải ẩn");
      assert.ok(!/THÂM HỤT|Nên ăn thâm hụt/.test(a.advice) && /IOM 2009/.test(a.advice), a.advice);
      assert.equal(app.evj("goalDisplay(state.profile)").label, "Thai kỳ — không thâm hụt");
      app.run(NU_RENDER);
      const html = app.lastHtml("nu-content");
      assert.ok(/nu-plan-goal/.test(html), "thẻ thực đơn chưa vẽ");
      assert.ok(!/THÂM HỤT/.test(html), "màn Dinh dưỡng còn chữ THÂM HỤT");
      assert.ok(!/Mục tiêu: <b>Giảm mỡ/.test(html) && !/Mục tiêu: Giảm mỡ/.test(html), "nhãn mục tiêu vẫn 'Giảm mỡ'");
      assert.ok(!/data-switch-goal="lose"/.test(html));
    });
    t.test("QN-02: tiền sử RLĂU → ẩn xếp loại BMI + lời khuyên thâm hụt; cho bú → 'không thâm hụt > 500 kcal'", async ()=>{
      const ed = await mk(t, { gender:"female", age:20, height:160, weight:52, activity:"light", goal:"lose" }, HS({ edHistory:"yes" }));
      const a = ed.evj("bodyAnalysis(state.profile)");
      assert.ok(a.hideBmi && !/thâm hụt/i.test(a.advice.replace("không gợi ý ăn thâm hụt","")), a.advice);
      const bf = await mk(t, { gender:"female", age:30, height:160, weight:70, activity:"light", goal:"lose" }, HS({ pregnancy:"postpartum", breastfeeding:true }));
      const b = bf.evj("bodyAnalysis(state.profile)");
      assert.equal(b.rec, "maintain"); assert.ok(/500 kcal/.test(b.advice), b.advice);
      assert.equal(bf.evj("goalDisplay(state.profile)").label, "Cho con bú — không thâm hụt");
    });

    /* ---------- QN-03 · Cao: món tái với thai phụ ---------- */
    t.test("QN-03: thai phụ — 0 món tái trong thực đơn & danh sách Đổi món; chi tiết món hiện cảnh báo + cách nấu chín kỹ", async ()=>{
      const app = await mk(t, { gender:"female", age:28, height:158, weight:60, activity:"light", goal:"maintain" }, HS({ pregnancy:"pregnant", trimester:2 }));
      const rare = app.evj(`RECIPES.filter(r=>r.rare).map(r=>r.id)`);
      assert.ok(["pho-bo-nac","steak-khoai","bo-luc-lac-salad"].every(id=> rare.includes(id)), "thiếu cờ rare: " + rare);
      const hit = [];
      for(const cz of ["all","vn","au"]) week(app, { cuisine:cz }).forEach((d,i)=> d.meals.forEach(m=>{ if(rare.includes(m.split(":")[1])) hit.push(cz+"/"+(i+1)+"/"+m); }));
      ["breakfast","lunch","dinner"].forEach(m=> app.evj(`NutriPro.pool("${m}", "maintain", {}, { all:true }).map(r=>r.id)`).forEach(id=>{ if(rare.includes(id)) hit.push("đổi món " + id); }));
      expectNone(hit, "món tái cho thai phụ");
      app.run(`openRecipe("pho-bo-nac")`);
      const sh = app.lastHtml("sheet-content");
      assert.ok(/np-preg/.test(sh) && /Thai phụ nên tránh/.test(sh), "không có cảnh báo thai phụ");
      assert.ok(/nấu chín kỹ cho thai phụ/.test(sh) && !/để thịt tái/.test(sh), "vẫn hiện bước để thịt tái");
      assert.equal(app.evj(`NutriPro.pregRisk({ name:"Sushi cá hồi" }).level`), "avoid");
    });

    /* ---------- QN-04 · Cao: "1,5" thành 15 ---------- */
    t.test("QN-04: đọc số kiểu Việt; ô số lượng & Tự tạo món là ô chữ inputmode=decimal (không type=number)", async ()=>{
      const app = await mk(t, {});
      assert.deepEqual(["1,5","1.5","15","1.500,5"," 2 ","abc",""].map(v=> app.ev(`NutriPro.parseNum(${JSON.stringify(v)})`)), [1.5,1.5,15,1500.5,2,NaN,NaN]);
      app.run(`openFoodQuantity(NutriPro.food("uc-ga"), "lunch")`);
      const q = app.lastHtml("sheet-content");
      assert.ok(/id="qty-input" inputmode="decimal"/.test(q.replace('type="text" ', "")) && !/type="number"[^>]*qty-input/.test(q), "ô số lượng vẫn là type=number");
      app.run(`NutriPro.ui.openCustomFood("lunch")`);
      const c = app.lastHtml("sheet-content");
      assert.ok(!/type="number"/.test(c), "Tự tạo món còn type=number");
      assert.ok(/NP_MAX_G = 1000, NP_MAX_KCAL = 2000/.test(read("nutrition-pro.js")), "thiếu ngưỡng hỏi lại khẩu phần lớn");
    });

    /* ---------- QN-05 · TB: mục tiêu tự chỉnh 600 kcal ---------- */
    t.test("QN-05: thực đơn dùng đúng số người dùng thấy; dưới sàn → báo rõ; macro không khớp calo → chuẩn hoá + ghi chú", async ()=>{
      const app = await mk(t, { gender:"female", autoTargets:false, goalKcal:600, protein:250, carbs:300, fat:90 });
      const T = app.evj("NutriPro.targets(state.profile)");
      assert.equal(T.K, 1200); assert.equal(T.floored, 600); assert.ok(T.macroFixed && T.P*4 <= T.K*0.35, JSON.stringify(T));
      app.run(NU_RENDER);
      assert.ok(/thấp hơn mức an toàn tối thiểu/.test(app.lastHtml("nu-content")), "không báo mục tiêu dưới sàn");
      const ok = await mk(t, { gender:"male", autoTargets:false, goalKcal:2300, protein:150, carbs:250, fat:75 });
      const T2 = ok.evj("NutriPro.targets(state.profile)");
      assert.equal(T2.K, 2300); assert.ok(!T2.floored && !T2.macroFixed);
    });

    /* ---------- QN-06 · TB: nước cộng dồn sai do làm tròn ---------- */
    t.test("QN-06: 4 × 250 ml = 1,0 L; 250+250+500 = 1,0 L (lưu tới mililit, chỉ làm tròn khi hiện)", async ()=>{
      const app = await mk(t, {});
      assert.equal(app.ev("(()=>{ let x = 0; for(let i=0;i<4;i++) x = nuMl(x + 0.25); return x; })()"), 1);
      assert.equal(app.ev("nuMl(nuMl(nuMl(0.25) + 0.25) + 0.5)"), 1);
      assert.ok(!/fmt1\(\(state\.waterLog\[k\]\|\|0\) \+ Number\(b\.dataset\.w\)\)/.test(read("nutrition.js")), "còn fmt1 sau mỗi lần cộng");
      app.run(`state.waterLog[todayStr()] = 0.25; renderNutritionScreen()`);
      assert.ok(/0,25 \/ /.test(app.lastHtml("nu-content")), "không hiện 0,25 L");
    });

    /* ---------- QN-07 · TB: mục tiêu nước theo nhóm ---------- */
    t.test("QN-07: nước — thai T3 +0,3 L, cho bú +0,7 L, lọc máu không đặt chỉ tiêu, 130 kg ≤ 3,7 L", async ()=>{
      const g = async (p, h)=> (await mk(t, p, h)).ev("nuWaterGoal(state.profile)");
      const preg = await g({ gender:"female", age:31, height:160, weight:68 }, HS({ pregnancy:"pregnant", trimester:3 }));
      const base = await g({ gender:"female", age:31, height:160, weight:68 }, HS());
      assert.equal(Math.round((preg - base)*10)/10, 0.3, `thai T3 ${preg} vs ${base}`);
      const bf = await g({ gender:"female", age:30, height:160, weight:58 }, HS({ pregnancy:"postpartum", breastfeeding:true }));
      assert.ok(bf >= 2.6, "cho bú " + bf);
      assert.equal(await g({ gender:"female", age:50, height:155, weight:55 }, HS({ kidney:"dialysis" })), null);
      const big = await g({ gender:"male", age:35, height:175, weight:130 });
      assert.ok(big <= 3.7 && big >= 3, "130 kg: " + big);
      const dial = await mk(t, { gender:"female", age:50, height:155, weight:55 }, HS({ kidney:"dialysis" }));
      dial.run("renderNutritionScreen()");
      const h = dial.lastHtml("nu-content");
      assert.ok(/không đặt mục tiêu nước/.test(h) && !/data-cup=/.test(h), "lọc máu vẫn hiện 8 ly cần hoàn thành");
    });

    /* ---------- QN-08 · TB: đạm 2 g/kg cho mọi người ---------- */
    t.test("QN-08: nữ 60 tuổi ít vận động — đạm ≤ 35 % năng lượng & ≈ 1,2 g/kg (trước: 120 g = 40 %)", async ()=>{
      const app = await mk(t, { gender:"female", age:60, height:155, weight:62, activity:"sedentary", goal:"lose" });
      const p = app.evj("({ k: state.profile.goalKcal, p: state.profile.protein })");
      assert.ok(p.p*4 <= p.k*0.35 + 2, JSON.stringify(p));
      assert.ok(p.p <= Math.round(Math.min(62, 25*1.55*1.55)*1.2) + 1, "đạm " + p.p);
    });

    /* ---------- QN-09 · TB: lặp món trong tuần ---------- */
    t.test("QN-09: chay / thuần chay / Việt / tăng cơ — không món nào ≥ 5/7 ngày ở cùng bữa", async ()=>{
      const bad = [];
      const cases = [[{ gender:"male", age:16, height:170, weight:58, activity:"active", goal:"gain" }, HS(), { veg:true }],
        [{ gender:"female", age:28, height:170, weight:60, activity:"veryActive", goal:"gain" }, undefined, { veg:true }],
        [{ gender:"male", age:22, height:182, weight:80, activity:"active", goal:"gain" }, undefined, { vegan:true, veg:true }],
        [{ gender:"male", age:30, height:175, weight:85, activity:"light", goal:"lose" }, undefined, { cuisine:"vn" }]];
      for(const [p, h, pr] of cases){
        const app = await mk(t, p, h);
        const cnt = {};
        week(app, pr).forEach(d=> d.meals.forEach(m=> cnt[m] = (cnt[m]||0) + 1));
        Object.entries(cnt).forEach(([m, n])=>{ if(n >= 5) bad.push(`${JSON.stringify(pr)} ${m} ${n}/7`); });
      }
      expectNone(bad, "món lặp");
    });

    /* ---------- QN-10 · TB: thiếu calo khi nhu cầu cao ---------- */
    t.test("QN-10: 4.004 kcal (130 kg vận động) & thuần chay 3.541 kcal — calo trong −6 %…+5 % mọi ngày", async ()=>{
      const bad = [];
      for(const [p, pr] of [[{ gender:"male", age:28, height:185, weight:130, activity:"active", goal:"maintain" }, {}],
                            [{ gender:"male", age:22, height:182, weight:80, activity:"active", goal:"gain" }, { vegan:true, veg:true }]]){
        const app = await mk(t, p);
        const T = app.evj("NutriPro.targets(state.profile)");
        week(app, pr).forEach((d,i)=>{ const e = (d.k - T.K)/T.K; if(e < -0.06 || e > 0.05) bad.push(`${T.K} kcal ngày ${i+1}: ${(e*100).toFixed(1)} %`); });
      }
      expectNone(bad, "calo nhu cầu cao");
    });

    /* ---------- QN-11 · TB: giá trị dinh dưỡng lệch ---------- */
    t.test("QN-11: xôi 182 · sữa tươi 61/3,3 béo · sữa có đường ≈ 77 · ba chỉ 260 · khoai môn luộc 142 · cá thu 158 · mồng tơi carb ≥ xơ", async ()=>{
      const app = await mk(t, {});
      const f = id=> app.evj(`NutriPro.food(${JSON.stringify(id)})`);
      const near = (v, x, tol, l)=> assert.ok(Math.abs(v - x) <= tol, `${l}: ${v} ≉ ${x}`);
      near(f("xoi-trang").kcal, 182, 6, "xôi"); near(f("sua-tuoi-khong-duong").kcal, 61, 3, "sữa tươi"); near(f("sua-tuoi-khong-duong").fat, 3.3, 0.3, "béo sữa");
      near(f("sua-tuoi-co-duong").kcal, 77, 6, "sữa có đường"); near(f("thit-heo-ba-chi").kcal, 260, 10, "ba chỉ"); near(f("khoai-mon").kcal, 142, 6, "khoai môn");
      near(f("ca-thu").kcal, 158, 10, "cá thu"); const m = f("mong-toi"); assert.ok(m.carbs >= m.fiber, `mồng tơi carb ${m.carbs} < xơ ${m.fiber}`);
      const atw = app.evj(`FOODS.filter(x=> x.kcal > 30 && Math.abs((x.protein*4 + x.carbs*4 + x.fat*9 + (x.alcohol||0)*7) - x.kcal) > Math.max(20, 0.15*x.kcal)).map(x=>x.id)`);
      assert.deepEqual(atw, [], "Atwater lệch: " + atw);
    });

    /* ---------- QN-12 · Thấp: tip ghi số sai ---------- */
    t.test("QN-12: tip mực 200 g ≈ 230 kcal; shake tăng cân ≈ 680 kcal khớp số tính (±10 %)", async ()=>{
      const app = await mk(t, {});
      const r = app.evj(`["muc-hap-gung","shake-tang-can"].map(id=>{ const r = RECIPES.find(x=>x.id===id); return { tip:r.tip, k: Math.round(NutriPro.itemsMacros(r.items).k), muc: Math.round(NutriPro.food("muc").kcal*2) }; })`);
      assert.ok(/230 kcal/.test(r[0].tip) && Math.abs(r[0].muc - 230) <= 12, JSON.stringify(r[0]));
      const m = r[1].tip.match(/~(\d+) kcal/); assert.ok(m && Math.abs(Number(m[1]) - r[1].k)/r[1].k <= 0.1, JSON.stringify(r[1]));
    });

    /* ---------- QN-13 · TB: ảnh món sai + khoá Pixabay ---------- */
    t.test("QN-13: ảnh sai (theo mã Pixabay) bị bỏ ánh xạ → emoji; ảnh đúng giữ; tên file lạ bị loại", async ()=>{
      const app = await mk(t, {});
      const out = app.evj(`nuCleanImgIndex({ "dau-den-bowl":{ file:"dau-den-bowl.webp", px:5181831 }, "goi-cuon":{ file:"goi-cuon.webp", px:845676 },
        "ca-ngu-com":{ file:"ca-ngu-com.webp", px:354628 }, "dau-den-bowl-x":{ file:"x.webp", px:1 }, "com-trang":{ file:"com-trang.webp", px:10370575 },
        "goi-cuon-2":{ file:"goi-cuon.webp", px:999 }, "evil":{ file:"a.webp\\" onerror=\\"alert(1)", px:1 } })`);
      assert.deepEqual(Object.keys(out).sort(), ["com-trang","dau-den-bowl-x","goi-cuon-2"]);
      const bad = app.evj("Object.keys(FOOD_IMG_BAD)");
      ["dau-hu-trung-hap","dau-den-bowl","quinoa-edamame","dau-hu-nam-af","whey","dau-den","goi-cuon","ca-ngu-com","bia","trung-ga","muc"].forEach(id=> assert.ok(bad.includes(id), "thiếu " + id));
    });
    t.test("QN-13: scripts — không còn khoá Pixabay trong mã (đọc env PIXABAY_KEY); food_sources có 'veg' + đủ id món", async ()=>{
      const py = read("scripts/fetch_food_images.py");
      assert.ok(!/\b\d{6,}-[0-9a-f]{20,}\b/.test(py), "còn khoá API trong fetch_food_images.py");
      assert.ok(/os\.environ\.get\("PIXABAY_KEY"/.test(py) && /sys\.exit\(/.test(py), "phải đọc PIXABAY_KEY và dừng khi thiếu");
      assert.ok(/MEATTAGS/.test(py) && /VEG = set\(SRC\.get\("veg"/.test(py), "chưa lọc ảnh có thịt cho món chay");
      const src = JSON.parse(read("scripts/food_sources.json"));
      const app = await mk(t, {});
      const ids = app.evj("FOODS.filter(f=>!f.custom).map(f=>f.id).concat(RECIPES.map(r=>r.id))");
      const miss = ids.filter(id=> !(id in src.foods) && !(id in src.recipes));
      assert.deepEqual(miss, [], "thiếu từ khoá ảnh: " + miss);
      ["dau-hu-trung-hap","dau-den-bowl","quinoa-edamame","dau-hu-nam-af"].forEach(id=> assert.ok(src.veg.includes(id), "veg thiếu " + id));
    });

    /* ---------- QN-14 · TB: xoá món không hoàn tác ---------- */
    t.test("QN-14: xoá món → thanh 'Hoàn tác' → khôi phục đúng vị trí", async ()=>{
      const app = await mk(t, {});
      app.run(`(()=>{ const L = getDayFoodLog(); L.lunch.push({ name:"Cơm trắng", grams:150, kcal:195, protein:4, carbs:42, fat:0.5 }, { name:"Ức gà", grams:100, kcal:165, protein:31, carbs:0, fat:3.6 }); })()`);
      app.run("nuDeleteFood('lunch', 0)");
      assert.deepEqual(app.evj("getDayFoodLog().lunch.map(x=>x.name)"), ["Ức gà"]);
      assert.ok(app.ev("!!_nuUndo") && /Hoàn tác/.test(app.ev("_nuUndo.el.innerHTML")), "không có thanh Hoàn tác");
      app.run("_nuUndo.undo()");
      assert.deepEqual(app.evj("getDayFoodLog().lunch.map(x=>x.name)"), ["Cơm trắng","Ức gà"]);
      assert.ok(/\.nu-del\{[^}]*padding:7px/.test(read("nutrition-pro.css")), "nút xoá chưa đủ vùng chạm 44 px");
    });

    /* ---------- QN-15 · TB: tìm kiếm ---------- */
    t.test("QN-15: tìm theo từ + đồng nghĩa Bắc–Nam: 'ức gà luộc', 'ga uc', 'đậu phụ', 'thịt lợn', 'lạc'", async ()=>{
      const app = await mk(t, {});
      const first = q=> app.evj(`NutriPro.search(${JSON.stringify(q)}).foods.slice(0,5).map(f=>f.id)`);
      assert.ok(first("ức gà luộc").includes("uc-ga")); assert.ok(first("ga uc").includes("uc-ga"));
      assert.ok(first("đậu phụ").includes("dau-hu")); assert.ok(first("thịt lợn").some(id=> /^thit-heo/.test(id)));
      assert.ok(first("lạc").some(id=> /dau-phong/.test(id)));
      const ngo = first("ngo"); assert.equal(ngo[0], "bap", "'ngo' (ngô) phải ra Bắp đầu tiên: " + ngo);
    });

    /* ---------- QN-16 · TB: bột đạm cho nhóm nhạy cảm ---------- */
    t.test("QN-16: không whey / đạm thực vật trong thực đơn của < 18 tuổi, thai phụ, bệnh thận (kể cả thuần chay)", async ()=>{
      const bad = [];
      const cases = [[{ gender:"male", age:16, height:170, weight:58, activity:"active", goal:"gain" }, HS()],
        [{ gender:"female", age:28, height:158, weight:60, activity:"light", goal:"maintain" }, HS({ pregnancy:"pregnant", trimester:2 })],
        [{ gender:"female", age:50, height:155, weight:55, activity:"sedentary", goal:"maintain" }, HS({ kidney:"dialysis" })]];
      for(const [p, h] of cases){
        const app = await mk(t, p, h);
        for(const pr of [{}, { vegan:true, veg:true }]) week(app, pr).forEach((d,i)=>{ if(d.ids.some(id=> ["whey","protein-thuc-vat"].includes(id))) bad.push(`${p.age}t ${JSON.stringify(pr)} ngày ${i+1}`); });
      }
      expectNone(bad, "bột đạm");
    });

    /* ---------- QN-17 / QN-18 · Thấp: vùng chạm, tab bị cắt ---------- */
    t.test("QN-17/18: CSS — nút nước/ly/sửa nước ≥ 44 px; 4 tab Thêm món chia đều (flex 1 1 0), ẩn icon ở màn hẹp", async ()=>{
      const css = read("nutrition-pro.css");
      assert.ok(/\.nu-cups \.cup\{ min-height:44px; \}/.test(css) && /\.nu-water-btns button\{ min-height:44px/.test(css), "ly / +250 ml < 44 px");
      assert.ok(/\.nu-water-head \.nu-water-edit\{ width:44px; height:44px/.test(css), "nút sửa mục tiêu nước < 44 px");
      assert.ok(/\.np-tabs button\{ flex:1 1 0; min-width:0/.test(css), "tab vẫn flex:1 0 auto (bị cắt)");
      assert.ok(/@media \(max-width:420px\)\{ \.np-tabs svg/.test(css));
      const js = read("nutrition.js");
      assert.ok(!/style="width:32px;height:32px;"/.test(js), "nút sửa nước còn cố định 32 px");
    });

    /* ---------- QN-19 · Thấp: đi chợ ---------- */
    t.test("QN-19: đi chợ — tên đồ sống, '1 kg' thay '1000 g', dấu ✓ lưu theo tuần trong state, hệ số gạo lứt ≈ 1/3", async ()=>{
      const app = await mk(t, {});
      const L = app.evj("NutriPro.ui.shoppingList(2)");
      const rows = [].concat(...(Array.isArray(L) ? L : (L.groups || L.cats || Object.values(L))).map(g=> g.items || g.rows || []));
      const names = rows.map(r=> r.name || "");
      assert.ok(!names.some(n=> /\((luộc|xào|đã nấu)\)/.test(n)), "còn tên đồ chín: " + names.filter(n=>/\(/.test(n)).slice(0,5));
      const js = read("nutrition-pro.js");
      assert.ok(/"com-gao-lut":\{ name:"Gạo lứt", k:1\/3 \}/.test(js) && /"dau-lang":\{ name:"Đậu lăng \(khô\)", k:1\/3 \}/.test(js));
      assert.ok(/g >= 950\) return \{ text:`\$\{vn\(Math\.ceil\(g\/100\)\/10\)\} kg`/.test(js), "chưa đổi sang kg");
      assert.ok(/S\.shopDone = \{ wk, ids:\[\] \}/.test(js), "dấu ✓ chưa lưu vào state.nutriPro.shopDone");
    });

    /* ---------- QN-20 · Thấp: định dạng số ---------- */
    t.test("QN-20: số kiểu Việt — nước '0,3 / 2,4 L', BMI '22,6', nhật ký ghi 'đạm/tinh bột/béo' thay 'Đ/TB/B'", async ()=>{
      const app = await mk(t, { gender:"male", height:172, weight:67 });
      app.run(`(()=>{ state.waterLog[todayStr()] = 0.3; getDayFoodLog().lunch.push({ name:"Bánh mì", grams:60, kcal:160, protein:4.6, carbs:30.4, fat:2.5 }); nuUI.open.lunch = true; ${NU_RENDER} })()`);
      const h = app.lastHtml("nu-content");
      assert.ok(/0,3 \/ \d+(,\d)? L/.test(h), "nước chưa định dạng Việt");
      assert.ok(/<b>22,6<\/b><small>BMI/.test(h), "BMI chưa định dạng Việt");
      assert.ok(/đạm 4,6 · tinh bột 30,4 · béo 2,5/.test(h) && !/Đ4\.6|TB30/.test(h), "nhật ký còn viết tắt");
    });

    /* ---------- QN-21 / QN-22 · Thấp: hiệu năng ---------- */
    t.test("QN-21: đồng hồ calo không đếm lại từ 0; nước/ly/ngày/chay chỉ vẽ lại khối liên quan", async ()=>{
      const app = await mk(t, {});
      app.run(`(()=>{ getDayFoodLog().lunch.push({ name:"Cơm", grams:150, kcal:500, protein:4, carbs:42, fat:1 }); nuUI.shownKcal = 500; renderNutritionScreen(); })()`);
      assert.ok(/id="nu-kcal-num">500</.test(app.lastHtml("nu-content")), "đồng hồ calo bắt đầu lại từ 0");
      const js = read("nutrition.js"), np = read("nutrition-pro.js");
      assert.ok(/function nuRefreshWater\(\)/.test(js) && /saveState\(\); nuRefreshWater\(\);/.test(js), "nước vẫn vẽ lại cả màn");
      assert.ok(/function nuRefreshMeal\(/.test(js), "mở/đóng bữa vẫn vẽ lại cả màn");
      assert.ok(/nuUI\.planDay = Number\(b\.dataset\.planDay\); rerenderPlanCard\(\);/.test(np), "chọn ngày vẫn vẽ lại cả màn");
    });
    t.test("QN-22: Thêm món tab 'Tất cả' vẽ trước ≤ 30 dòng; gõ tìm có debounce", async ()=>{
      const app = await mk(t, {});
      app.run(`openAddFood("lunch", { tab:"all" })`);
      const n = (app.lastHtml("food-results").match(/data-np-food=/g) || []).length;
      assert.ok(n > 0 && n <= 30, "số dòng vẽ ngay: " + n);
      assert.ok(/qTimer = setTimeout\(paint, 120\)/.test(read("nutrition-pro.js")));
    });

    /* ---------- QN-23 · Thấp: trần chất xơ ---------- */
    t.test("QN-23: chất xơ — 4.004 kcal nam ≤ 48 g (AI 38 + 10), nữ ≤ 35 g; 1.500 kcal vẫn 14 g/1.000 kcal", async ()=>{
      const app = await mk(t, {});
      assert.equal(app.ev(`NutriPro.targets({ gender:"male", age:28, goalKcal:4004, protein:150, carbs:550, fat:111 }).FB`), 48);
      assert.equal(app.ev(`NutriPro.targets({ gender:"female", age:28, goalKcal:3000, protein:120, carbs:420, fat:83 }).FB`), 35);
      assert.equal(app.ev(`NutriPro.targets({ gender:"female", age:28, goalKcal:1500, protein:90, carbs:180, fat:42 }).FB`), 21);
    });

    /* ---------- QN-24 · Thấp: < 18 tuổi ---------- */
    t.test("QN-24: nữ 16 tuổi 60 kg/158 cm 'nhẹ' — calo ≥ EER IOM (~2.075), không xếp loại BMI người lớn", async ()=>{
      const app = await mk(t, { gender:"female", age:16, height:158, weight:60, activity:"light", goal:"lose" }, HS());
      assert.ok(app.ev("state.profile.goalKcal") >= 2050, "goalKcal " + app.ev("state.profile.goalKcal"));
      assert.ok(app.ev("FKHealth.teenEER(state.profile)") > 2000);
      const a = app.evj("bodyAnalysis(state.profile)");
      assert.ok(!/Thừa cân|Béo phì/.test(a.cat) && /BMI-theo-tuổi/.test(a.advice), JSON.stringify(a));
    });

    /* ---------- QN-25 · Thấp: cho con bú theo tháng ---------- */
    t.test("QN-25: cho con bú — ≤ 6 tháng sau sinh +500 kcal, > 6 tháng +400 kcal", async ()=>{
      const app = await mk(t, {});
      const ex = h=> app.ev(`FKHealth.flags(${JSON.stringify(h)}, { gender:"female", age:30 }).kcalExtra`);
      assert.equal(ex({ completedAt:1, pregnancy:"postpartum", postpartumWeeks:"6to12", breastfeeding:true }), 500);
      assert.equal(ex({ completedAt:1, pregnancy:"postpartum", postpartumWeeks:"gt26", breastfeeding:true }), 400);
      assert.ok(/gt26/.test(read("health-safety.js").match(/postpartumWeeks","gt12".{0,200}/)[0]), "form sàng lọc thiếu lựa chọn > 6 tháng");
    });

    /* ---------- QN-26 · Thấp: món đổi áp mãi mọi tuần ---------- */
    t.test("QN-26: món đổi lưu kèm tuần ISO — sang tuần khác tự hết hạn", async ()=>{
      const app = await mk(t, {});
      assert.equal(app.ev(`NutriPro.weekKey("2026-11-11")`), "2026-W46");
      assert.equal(app.ev(`NutriPro.weekKey("2027-01-01")`), "2026-W53");
      app.run(`(()=>{ nuUI.planDay = 2; state.nutriPro = state.nutriPro || {}; state.nutriPro.swaps = { 2: { sig:"x", wk:"2026-W01", meals:{ lunch:"pho-bo-nac" }, changed:["lunch"] } }; nuPlanCardHTML(); })()`);
      assert.equal(app.ev("state.nutriPro.swaps[2]"), undefined, "món đổi tuần cũ vẫn còn");
    });

    /* ---------- QN-27 · Thấp: sát ngưỡng thiếu cân ---------- */
    t.test("QN-27: nữ 42 kg/150 cm (BMI 18,6) giảm mỡ — thâm hụt ≤ 10 % hoặc duy trì; thẻ thực đơn có giải thích", async ()=>{
      const app = await mk(t, { gender:"female", age:25, height:150, weight:42, activity:"light", goal:"lose" });
      const p = app.evj("({ k: state.profile.goalKcal, tdee: state.profile.tdee })");
      assert.ok(p.k >= Math.round(p.tdee*0.9) - 1, JSON.stringify(p));
      app.run(NU_RENDER);
      assert.ok(/sát ngưỡng thiếu cân/.test(app.lastHtml("nu-content")), "không giải thích vì sao giới hạn thâm hụt");
    });

    /* ---------- An toàn chèn HTML (quy tắc 2 của brief) ---------- */
    t.test("XSS: tên món trong nhật ký / thanh Hoàn tác được escape", async ()=>{
      const app = await mk(t, {});
      app.run(`(()=>{ getDayFoodLog().dinner.push({ name:'<img src=x onerror=alert(1)>', grams:"<b>1</b>", kcal:10, protein:1, carbs:1, fat:1 }); nuUI.open.dinner = true; renderNutritionScreen(); })()`);
      const h = app.lastHtml("nu-content");
      assert.ok(!/<img src=x/.test(h) && /&lt;img src=x/.test(h), "tên món chưa escape");
      app.run("nuDeleteFood('dinner', 0)");
      assert.ok(!/<img src=x/.test(app.ev("_nuUndo.el.innerHTML")), "thanh Hoàn tác chưa escape");
    });

    /* =====================================================================
       VÒNG 2 (HANDOFF-ROUND-BRIEF.md · mục nutrition) — 6 việc
       ===================================================================== */
    const txt = h=> String(h || "").replace(/<[^>]*>/g, " ");
    const fire = (app, type, ev)=> app.run(`(document._listeners[${JSON.stringify(type)}]||[]).forEach(fn=> fn(Object.assign({ preventDefault(){ globalThis.__prev = (globalThis.__prev||0) + 1; }, stopPropagation(){} }, ${JSON.stringify(ev)})))`);

    /* ---------- 1 · FIX-core §1: #hs-overlay là hộp thoại thật ---------- */
    t.test("FIX-core§1: lớp sàng lọc — role=dialog aria-modal; nền inert (trừ #toast); Tab không thoát; Esc = 'Để sau'; đóng gỡ inert", async ()=>{
      const app = await mk(t, {}, {});
      const r = app.evj(`(()=>{ const shell = document.getElementById("app-shell"), sib = document.createElement("div"), tt = document.createElement("div");
        tt.id = "toast"; shell.appendChild(sib); shell.appendChild(tt); shell.appendChild(document.getElementById("hs-overlay"));
        FKHealth.openScreening({ mode:"first" });
        const el = document.getElementById("hs-overlay");
        return { open: FKHealth.isOpen(), role: el.getAttribute("role"), modal: el.getAttribute("aria-modal"), inert: sib.hasAttribute("inert"), toast: tt.hasAttribute("inert") }; })()`);
      assert.deepEqual(r, { open:true, role:"dialog", modal:"true", inert:true, toast:false });
      app.run("globalThis.__prev = 0"); fire(app, "keydown", { key:"Tab", shiftKey:false });
      assert.ok(app.ev("globalThis.__prev") >= 1, "Tab không bị giữ trong hộp thoại");
      assert.ok(app.ev("FKHealth.isOpen()"), "Tab làm đóng hộp?");
      fire(app, "keydown", { key:"Escape" });
      assert.ok(!app.ev("FKHealth.isOpen()") && app.ev("!!state.health.skippedAt"), "Esc phải = 'Để sau' (đóng + ghi skippedAt)");
      assert.ok(!app.ev(`document.getElementById("app-shell").children.some(c=> c.hasAttribute("inert"))`), "đóng mà nền vẫn inert");
      const src = read("health-safety.js");
      assert.ok(/addEventListener\("keydown", e=>\{[\s\S]{0,400}sheet-backdrop[\s\S]{0,900}\}, true\)/.test(src), "Esc/Tab phải ở pha capture và nhường sheet đang mở");
      assert.ok(/function hsFocusStep\(\)/.test(src) && /if\(isOpen\(\)\) hsFocusStep\(\);/.test(src), "mỗi bước phải đưa focus vào hộp (tiêu đề bước)");
      assert.ok(/\.hs-opt\[data-k="\$\{key\}"\]\[data-v="\$\{val\}"\]/.test(src), "chọn đáp án (vẽ lại bước) phải giữ focus ở lựa chọn vừa bấm");
    });

    /* ---------- 2 · FIX-training §4.3: FKHealth gán sớm + fk:health-ready ---------- */
    t.test("FIX-training§4.3: FKHealth có TRƯỚC lần recomputeProfile/vẽ lại lúc khởi động của health-safety; phát fk:health-ready khi xong; health-safety vẫn nạp CUỐI", async ()=>{
      const app = await mk(t, {}, HS());
      app.run(`(()=>{ globalThis.__seen = []; const W = globalThis; W.FKHealth = undefined;
        document.dispatchEvent = function(e){ __seen.push("event:" + (e && e.type) + ":" + !!(W.FKHealth && W.FKHealth.ready)); return true; };
        const oR = recomputeProfile; recomputeProfile = function(){ __seen.push("recompute:" + !!W.FKHealth); return oR.apply(this, arguments); }; })()`);
      app.run(read("health-safety.js"), "health-safety-rerun.js");
      assert.deepEqual(app.evj("__seen"), ["recompute:true", "event:fk:health-ready:true"]);
      assert.equal(app.ev("typeof FKHealth.openPreSession"), "function", "achievements.js gọi FKHealth.openPreSession");
      assert.equal(app.ev("(()=>{ let n = 0; FKHealth.onReady(()=> n++); return n; })()"), 1, "onReady sau khi sẵn phải chạy ngay");
      const html = read("index.html"), order = [...html.matchAll(/<script\s+[^>]*src="([^"]+)"/g)].map(m=> m[1]);
      assert.equal(order[order.length - 1], "health-safety.js");
    });

    /* ---------- 3 · FIX-core §5: openFoodQuantity đọc số bằng fkNum ---------- */
    t.test("FIX-core§5: ô số lượng (bản đè openFoodQuantity) đọc số qua fkNum của app.js — '1,5' = 1,5 phần; fkNum bị thay → ô dùng đúng hàm đó", async ()=>{
      const app = await mk(t, {});
      const r = app.evj(`(()=>{ const f = NutriPro.food("uc-ga"); openFoodQuantity(f, "lunch"); const inp = document.getElementById("qty-input");
        const put = v=>{ inp.value = v; inp.dispatchEvent({ type:"input", target: inp }); return document.getElementById("np-q-btn").textContent; };
        const a = put("1,5"); const o = fkNum; fkNum = ()=> 2; const b = put("abc"); fkNum = o; const c = put("-3");
        return { a, b, c, g: f.units[0].g, k: f.kcal }; })()`);
      assert.ok(r.a.includes(`${Math.round(r.k*r.g*1.5/100)} kcal`), "1,5 phần: " + r.a);
      assert.ok(r.b.includes(`${Math.round(r.k*r.g*2/100)} kcal`), "không dùng fkNum: " + r.b);
      assert.ok(/ · 0 kcal/.test(r.c), "số âm phải thành 0: " + r.c);
      assert.deepEqual(["1,5","1.500","1.500,5","abc","-2"].map(v=> app.ev(`NutriPro.num(${JSON.stringify(v)})`)), [1.5, 1500, 1500.5, NaN, NaN]);
    });

    /* ---------- 4 · QU-03: ghi nhớ buildDayPlan + vẽ thực đơn / đi chợ lúc rảnh ---------- */
    t.test("QU-03: thực đơn nhớ BỀN theo (ngày, hồ sơ, tuỳ chọn) — mở app lần sau dùng lại y hệt, không tính lại; khoá băm, không lộ cờ sức khoẻ", async ()=>{
      const pr = { cuisine:"all", veg:false, vegan:false };
      const a = await mk(t, { gender:"male", age:55, height:168, weight:70, activity:"sedentary", goal:"maintain" }, HS({ kidney:"ckd" }));
      const sig = app=> app.evj(`(()=>{ const o = []; for(let d=0; d<7; d++){ const pl = buildDayPlan(state.profile, d, ${JSON.stringify(pr)}); o.push(Object.keys(pl).map(m=> pl[m].id + ":" + pl[m].items.map(x=> x.join("x")).join(","))); } return o; })()`);
      const s1 = sig(a); a.run("NutriPro.flushStore()");
      const stored = a.localStorage.getItem("fitkit_np_plans_v1");
      assert.ok(stored && JSON.parse(stored).keys.length === 7, "chưa lưu 7 ngày");
      assert.ok(stored.length < 16000, "bộ nhớ quá lớn: " + stored.length);
      assert.ok(!/kidney|ckd|pCap|noRare|noSuppl|goalKcal|"K":/.test(stored), "lộ cờ sức khoẻ / mục tiêu trong khoá");
      assert.ok(!/fitkit_np_plans_v1/.test(a.localStorage.getItem("fitkit_state_v1")), "không được nằm trong fitkit_state_v1");
      const b = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF({ gender:"male", age:55, height:168, weight:70, activity:"sedentary", goal:"maintain" }), health: HS({ kidney:"ckd" }) },
        storage:{ fitkit_np_plans_v1: stored } });
      b.setNow(NOW); b.run("recomputeProfile()");
      assert.ok(b.ev(`NutriPro.planCached(state.profile, 6, ${JSON.stringify(pr)})`), "mở lại app: thực đơn CN chưa có sẵn");
      assert.ok(!b.ev(`NutriPro.planCached(Object.assign({}, state.profile, { weight: 80, protein: 64 }), 6, ${JSON.stringify(pr)})`), "đổi hồ sơ mà vẫn dùng thực đơn cũ");
      assert.deepEqual(sig(b), s1, "thực đơn đọc lại khác bản đã tính");
      b.run("NutriPro.clearPlanCache()");
      assert.equal(b.localStorage.getItem("fitkit_np_plans_v1"), null, "clearPlanCache (Xoá dữ liệu sức khoẻ) phải xoá bộ nhớ thực đơn");
      assert.ok(/NutriPro\.clearPlanCache\(\)/.test(read("health-safety.js")), "Xoá dữ liệu sức khoẻ chưa xoá bộ nhớ thực đơn");
    });
    t.test("QU-03: lần đầu vào Dinh dưỡng KHÔNG chạy thuật toán thực đơn đồng bộ (khung chờ → tính từng ngày lúc rảnh); 'Món healthy' vẽ trước ≤ 12 thẻ", async ()=>{
      const app = await mk(t, {});
      const n0 = app.evj(`(()=>{ let n = 0; const o = buildDayPlan; buildDayPlan = function(){ n++; return o.apply(this, arguments); };
        try{ renderNutritionScreen(); } finally { buildDayPlan = o; } return n; })()`);
      assert.equal(n0, 0, "renderNutritionScreen vẫn tính thực đơn đồng bộ");
      let h = app.lastHtml("nu-content");
      assert.ok(/np-wait/.test(h) && /aria-busy="true"/.test(h) && /class="nu-plan /.test(h), "thiếu khung chờ thẻ thực đơn");
      const nRc = (h.match(/data-recipe=/g) || []).length;
      assert.ok(nRc > 0 && nRc <= 12, "số thẻ món vẽ ngay: " + nRc);
      assert.ok(app.ev("NutriPro.ui.flushIdle()") >= 3, "không có việc chờ (các ngày + vẽ thẻ)");
      h = app.lastHtml("nu-content");
      assert.ok(!/np-wait/.test(h) && /nu-plan-goal/.test(h), "sau lúc rảnh thẻ thực đơn chưa vẽ");
      assert.ok([0,1,2,3,4,5,6].every(d=> app.ev(`NutriPro.planCached(state.profile, ${d}, { cuisine:"all", veg:false, vegan:false })`)), "chưa tính sẵn 7 ngày cho 'Đi chợ'");
      app.run("renderNutritionScreen()");
      assert.ok(!/np-wait/.test(app.lastHtml("nu-content")), "đã nhớ mà vẫn vẽ khung chờ");
      assert.ok(/data-fk-key/.test(app.lastHtml("nu-recipes")) || /data-fk-key>/.test(app.lastHtml("nu-content")), "thẻ món phải bấm được bằng bàn phím");
    });

    /* ---------- 5 · Ẩn số calo (người có tiền sử RLĂU) ---------- */
    t.test("R2-KCAL: tiền sử RLĂU → mặc định ẨN số calo: Dinh dưỡng / thực đơn / thêm món / chi tiết món / đi chợ không còn kcal; hiện 'Đĩa ăn cân bằng' (khẩu phần bàn tay)", async ()=>{
      const app = await mk(t, { gender:"female", age:20, height:160, weight:52, activity:"light", goal:"lose" }, HS({ edHistory:"yes" }));
      assert.equal(app.ev("nuHideKcal()"), true);
      app.run(`(()=>{ const L = getDayFoodLog(); L.lunch.push({ name:"Cơm trắng (đã nấu)", foodId:"com-trang", grams:150, kcal:195, protein:4, carbs:42, fat:0.5 },
        { name:"Bông cải xanh", foodId:"bong-cai-xanh", grams:160, kcal:55, protein:4, carbs:11, fat:0.6 }); nuUI.open.lunch = true; ${NU_RENDER} })()`);
      const h = app.lastHtml("nu-content");
      assert.ok(!/kcal/i.test(txt(h)), "màn Dinh dưỡng còn chữ kcal: " + (txt(h).match(/.{30}kcal.{20}/i) || [""])[0]);
      assert.ok(!/id="nu-kcal-num"|nu-gauge-svg|class="nu-week"/.test(h), "còn đồng hồ / biểu đồ calo");
      assert.ok(/Đĩa ăn cân bằng/.test(h) && /lòng bàn tay/.test(h) && /nắm tay/.test(h) && /2 \/ 5<\/span>|2 \/ 5 phần/.test(h), "thiếu đĩa ăn cân bằng (160 g rau = 2 phần)");
      assert.ok(/nu-plan-goal/.test(h) && /Đủ năng lượng cả ngày/.test(h), "thẻ thực đơn chưa đổi sang không số calo");
      assert.ok(!/data-tag="giam-mo"/.test(h), "vẫn đẩy thẻ lọc 'Giảm mỡ'");
      for(const c of [`openFoodQuantity(NutriPro.food("uc-ga"), "lunch")`, `openRecipe("pho-bo-nac")`, `NutriPro.ui.openSwapSheet(2, "lunch")`, `NutriPro.ui.openShoppingList()`, `NutriPro.ui.openProteinWhy()`]){
        app.run(c); assert.ok(!/kcal/i.test(txt(app.lastHtml("sheet-content"))), c + " còn kcal");
      }
      app.run(`openAddFood("lunch", { tab:"all" })`);
      assert.ok(!/kcal/i.test(txt(app.lastHtml("food-results")) + txt(app.lastHtml("sheet-content"))), "danh sách Thêm món còn kcal");
      assert.ok(!/kcal/.test(app.ev("NutriPro.ui.shopText(NutriPro.ui.shoppingList(1), 1)")), "chữ đi chợ (sao chép) còn kcal");
      app.run(`document.getElementById("hs-profile-card"); renderProfileScreen();`);
      const pc = app.lastHtml("hs-profile-card");
      assert.ok(/id="hs-p-kcal" role="switch" aria-checked="true"/.test(pc) && !/kcal/.test(txt(pc)), "Hồ sơ: thiếu công tắc Ẩn số calo / còn số kcal");
    });
    t.test("R2-KCAL: người dùng tắt được (lưu state.nutriPro.hideKcal); không khai RLĂU → mặc định hiện; khai RLĂU mới → bỏ lựa chọn cũ để mặc định BẬT", async ()=>{
      const app = await mk(t, { gender:"female", age:20, height:160, weight:52, activity:"light", goal:"lose" }, HS({ edHistory:"yes" }));
      app.run(`nuSetHideKcal(false); ${NU_RENDER}`);
      assert.equal(app.ev("state.nutriPro.hideKcal"), false);
      const h = app.lastHtml("nu-content");
      assert.ok(/id="nu-kcal-num"/.test(h) && /data-nu-kcal="hide"/.test(h) && /kcal/.test(txt(h)), "tắt rồi mà không hiện lại số calo");
      assert.ok(/fitkit_state_v1/.test(Object.keys(Object.fromEntries(app.localStorage._map)).join(",")) && /"hideKcal":false/.test(app.localStorage.getItem("fitkit_state_v1")), "lựa chọn chưa được lưu");
      const plain = await mk(t, {}, HS());
      assert.equal(plain.ev("nuHideKcal()"), false);
      plain.run("nuSetHideKcal(true)"); assert.equal(plain.ev("nuHideKcal()"), true, "người không khai RLĂU cũng bật được");
      const hs = read("health-safety.js");
      assert.ok(/h\.edHistory === "yes" && prev\.edHistory !== "yes"[^\n]*delete state\.nutriPro\.hideKcal/.test(hs), "khai RLĂU mới phải trả về mặc định BẬT");
      assert.ok(/Ẩn số calo<\/b> trên màn Dinh dưỡng/.test(hs), "kết quả sàng lọc chưa báo sẽ ẩn số calo");
      /* integrator (12/11): bản tạm hsHomeKcal đã gỡ — Trang chủ ẩn số calo tại CHỖ GỐC (pt.js ô "Bữa đã ghi", ui-signature.js bỏ thẻ năng lượng);
         kiểm thật ở suite 67-fix-integrator "I-04/I-05" */
      assert.ok(/fkHideKcal\(\)/.test(read("pt.js")) && /nuHideKcal/.test(read("ui-signature.js")), "Trang chủ: ô 'Calo hôm nay' (pt.js) / thẻ năng lượng (ui-signature.js) chưa ẩn số calo");
    });

    /* ---------- 6 · (i) Vì sao đạm X g? ---------- */
    t.test("R2-WHY: giải thích đạm khớp ĐÚNG số app tính cho 10 hồ sơ (BMI > 25, ≥ 60 tuổi, thai kỳ, cho bú, < 18, bệnh thận, lọc máu, tự đặt)", async ()=>{
      const cases = [
        [{ gender:"male", age:30, height:172, weight:72, activity:"moderate", goal:"gain" }, undefined, { perKg:2 }],
        [{ gender:"male", age:35, height:175, weight:110, activity:"active", goal:"lose" }, undefined, { refAdjusted:true, ref:76.6 }],
        [{ gender:"male", age:55, height:168, weight:70, activity:"sedentary", goal:"maintain" }, HS({ kidney:"ckd" }), { perKg:0.8, grams:56, kidney:"ckd" }],
        [{ gender:"female", age:28, height:158, weight:60, activity:"light", goal:"maintain" }, HS({ pregnancy:"pregnant", trimester:2 }), { perKg:1.5 }],
        [{ gender:"female", age:65, height:155, weight:62, activity:"sedentary", goal:"lose" }, undefined, { perKg:1.2 }],
        [{ gender:"female", age:16, height:158, weight:60, activity:"light", goal:"lose" }, HS(), { perKg:1.2 }],
        [{ gender:"female", age:30, height:160, weight:58, activity:"light", goal:"lose" }, HS({ pregnancy:"postpartum", postpartumWeeks:"gt12", breastfeeding:true }), { perKg:1.3 }],
        [{ gender:"female", age:50, height:155, weight:55, activity:"sedentary", goal:"maintain" }, HS({ kidney:"dialysis" }), { perKg:1.2, kidney:"dialysis" }],
        [{ gender:"male", age:25, height:190, weight:120, activity:"veryActive", goal:"gain" }, undefined, { grams:180 }],
        [{ gender:"female", age:25, height:150, weight:42, activity:"light", goal:"lose" }, undefined, {}],
      ];
      const bad = [];
      for(const [p, h, exp] of cases){
        const app = await mk(t, p, h);
        const W = app.evj("NutriPro.proteinWhy(state.profile, state.health)");
        if(W.expected !== W.grams) bad.push(`${p.age}t ${p.weight}kg: giải thích ${W.expected} g ≠ app ${W.grams} g`);
        Object.keys(exp).forEach(k=>{ if(W[k] !== exp[k]) bad.push(`${p.age}t ${p.weight}kg: ${k} = ${W[k]} (mong ${exp[k]})`); });
        if(!W.reasons.length) bad.push(`${p.age}t: không có lý do g/kg`);
      }
      const man = await mk(t, { gender:"male", autoTargets:false, goalKcal:2300, protein:200, carbs:250, fat:70 });
      const M = man.evj("NutriPro.proteinWhy(state.profile, state.health)");
      if(!(M.manual && M.grams === 200 && M.expected > 0 && M.expected < 200)) bad.push("tự đặt: " + JSON.stringify({ m:M.manual, g:M.grams, e:M.expected }));
      expectNone(bad, "giải thích đạm");
    });
    t.test("R2-WHY: nút (i) cạnh số đạm (đồng hồ calo, thẻ thực đơn, đĩa ăn) → sheet 'Vì sao đạm X g?' theo hồ sơ (bệnh thận: 0,8 g/kg, KDIGO)", async ()=>{
      const app = await mk(t, { gender:"male", age:55, height:168, weight:70, activity:"sedentary", goal:"maintain" }, HS({ kidney:"ckd" }));
      app.run(NU_RENDER);
      const h = app.lastHtml("nu-content");
      assert.equal((h.match(/data-nu-why="protein" aria-label="Vì sao đạm 56 g\?"/g) || []).length, 2, "thiếu nút (i) ở đồng hồ calo + thẻ thực đơn");
      app.run("NutriPro.ui.openProteinWhy()");
      const sh = app.lastHtml("sheet-content");
      assert.ok(/Vì sao đạm 56 g\?/.test(sh) && /70 kg × 0,8 g\/kg ≈ 56 g/.test(sh) && /KDIGO 2024/.test(sh) && /bác sĩ thận/.test(sh), "nội dung giải thích sai: " + txt(sh).slice(0, 300));
      const big = await mk(t, { gender:"male", age:35, height:175, weight:110, activity:"active", goal:"lose" });
      big.run("NutriPro.ui.openProteinWhy()");
      const s2 = big.lastHtml("sheet-content");
      assert.ok(/BMI 35,9, trên 25/.test(s2) && /76,6 kg/.test(s2), "chưa giải thích cân nặng điều chỉnh: " + txt(s2).slice(0, 300));
      const ed = await mk(t, { gender:"female", age:20, height:160, weight:52, activity:"light", goal:"lose" }, HS({ edHistory:"yes" }));
      ed.run(NU_RENDER);
      assert.ok(/nu-plate[\s\S]*data-nu-why="protein"/.test(ed.lastHtml("nu-content")), "đĩa ăn (ẩn số calo) thiếu nút (i)");
    });
  },
};

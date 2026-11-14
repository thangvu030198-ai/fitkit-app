/* =========================================================================
   Vòng R3 (14/11/2026) — agent NUTRITION
   Hồi quy cho docs/qa/R3-nutrition.md (R3-NUT-01 … R3-NUT-12). File sở hữu: data.js, meals.js, meals-extra.js, nutrition.js,
   nutrition-pro.js/.css, health-safety.js/.css, coach.js, kb.js/.css, kb-data-*.js.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");
const { assert, expectNone } = require("../lib/framework");
const ROOT = path.resolve(__dirname, "..", "..");
const read = f=> fs.readFileSync(path.join(ROOT, f), "utf8");

const NOW = Date.parse("2026-11-14T09:00:00");
const DAY = "2026-11-14";
const XSS = `"><img src=x onerror=alert(1)>'`;
const PROF = (o)=> Object.assign({ name:"Tester", gender:"male", age:30, height:172, weight:72, activity:"moderate", goal:"gain", autoTargets:true }, o||{});
const HS = (o)=> Object.assign({ v:1, completedAt: NOW - 86400000, parq:{}, pregnancy:"none", diabetes:"none", cardio:"none", kidney:"none", edHistory:"no", injuries:[] }, o||{});
const mk = async (t, extra, profile)=>{
  const app = await t.app({ state: Object.assign({ onboarded:true, authDone:true, profile: PROF(profile) }, extra || {}) });
  app.setNow(NOW);
  return app;
};
const NU_RENDER = "renderNutritionScreen(); NutriPro.ui.flushIdle();";
const allHtml = app=> app.dom.htmlLog.map(h=> h.html).join("\n");

module.exports = {
  name: "R3 — Dinh dưỡng / sức khoẻ (r3-nutrition)",
  area: "data / meals / nutrition / nutrition-pro / health-safety / kb",
  async define(t){

    /* ---------- R3-NUT-01 · High ---------- */
    t.test("R3-NUT-01: nutriPro.custom / recent / fav chứa null, chuỗi, số → nutrition-pro.js vẫn nạp, mọi sheet vẫn mở", async ()=>{
      const app = await mk(t, { nutriPro:{ custom:[null, "x", 5, { id:"cf-ok1", name:"Cơm nhà", kcal:150, protein:5, carbs:30, fat:1, units:[{ label:"1 bát", g:200 }] }],
        recent:[null, 7, { t:"f", id:"cf-ok1", g:200 }, { t:"zz", id:"x" }], fav:[null, 5, "f:cf-ok1", "nope"] } });
      expectNone(app.loadErrors.map(e=> e.file + ": " + e.error.message), "lỗi nạp file");
      assert.equal(app.ev("typeof NutriPro"), "object");
      app.run(NU_RENDER);
      for(const tab of ["recent","fav","all","mine"]) app.run(`openAddFood('lunch',{tab:'${tab}'})`);
      app.run("openFoodQuantity(FOODS.find(f=>f.custom),'lunch'); NutriPro.ui.openCustomFood('lunch','cf-ok1'); NutriPro.ui.openShoppingList();");
      const np = app.evj("state.nutriPro");
      assert.equal(np.custom.length, 1); assert.equal(np.custom[0].id, "cf-ok1");
      assert.deepEqual(np.fav, ["f:cf-ok1"]);
      assert.equal(np.recent.length, 1);
      assert.equal(app.evj("FOODS.filter(f=>f.custom).length"), 1);
    });

    /* ---------- R3-NUT-02 · High (bảo mật) ---------- */
    t.test("R3-NUT-02: món tự tạo / gần đây từ bản sao lưu có payload HTML ở emoji, units[].g, recent.g, kcal → không chèn thô vào HTML", async ()=>{
      const app = await mk(t, { nutriPro:{
        custom:[{ id:"cf-x1", name:XSS, kcal:XSS, protein:XSS, carbs:-5, fat:1e400, fiber:XSS, emoji:XSS, units:[{ label:XSS, g:XSS }, { label:"1 hộp", g:"250" }, null] }],
        recent:[{ t:"f", id:"cf-x1", g:XSS, u:XSS, q:XSS }, { t:"r", id:"pho-bo", f:XSS, g:XSS }], fav:["f:cf-x1"] } });
      expectNone(app.loadErrors.map(e=> e.file + ": " + e.error.message), "lỗi nạp file");
      app.run("nuUI.open = { breakfast:true, lunch:true, dinner:true, snack:true };" + NU_RENDER);
      for(const tab of ["recent","fav","all","mine"]) app.run(`openAddFood('lunch',{tab:'${tab}'})`);
      app.run("openFoodQuantity(FOODS.find(f=>f.custom),'lunch'); NutriPro.ui.openCustomFood('lunch','cf-x1');");
      const html = allHtml(app);
      assert.ok(!/<img src=x/i.test(html), "payload <img onerror> bị chèn thô");
      assert.ok(!/NaN|Infinity/.test(app.dom.htmlLog.slice(-6).map(h=> h.html).join("")), "NaN/Infinity trong sheet");
      const c = app.evj("state.nutriPro.custom[0]");
      assert.equal(c.kcal, 0); assert.equal(c.carbs, 0); assert.equal(c.fat, 0);
      assert.deepEqual(c.units.map(u=> u.g), [250]);
      assert.equal(app.ev("FOODS.find(f=>f.custom).emoji"), "🍽️");
    });
    t.test("R3-NUT-02: món tự tạo không được trùng mã thực phẩm có sẵn (ghi đè 'uc-ga' bằng dữ liệu giả); nuEmo bỏ ký tự HTML/JS", async ()=>{
      const app = await mk(t, { nutriPro:{ custom:[{ id:"uc-ga", name:"Giả", kcal:1, protein:0, carbs:0, fat:0, emoji:"');alert(1)//" }] } });
      assert.equal(app.ev("FOODS.find(f=>f.id==='uc-ga').kcal"), 165);
      assert.ok(!app.ev("!!FOODS.find(f=>f.id==='uc-ga').custom"));
      assert.equal(app.evj("state.nutriPro.custom.length"), 0);
      assert.equal(app.ev(`nuEmo("');alert(1)//<b>")`), "alert1//");      // tối đa 8 ký tự
      assert.equal(app.ev(`nuEmo(null)`), "🍽️");
      assert.equal(app.ev(`nuEmo("🥗")`), "🥗");
      assert.equal(app.ev(`NutriPro.cleanCustom({ id:"cf-a", name:" A  b ", kcal:"abc", protein:500, carbs:10, fat:-1 }).protein`), 100);
      assert.equal(app.ev(`NutriPro.cleanCustom({ id:"../x", name:"a" })`), null);
    });

    /* ---------- R3-NUT-03 · High ---------- */
    t.test("R3-NUT-03: nhật ký ăn có dòng null / chuỗi / thiếu bữa → màn Dinh dưỡng không sập, dòng hỏng bị loại, đủ 4 bữa", async ()=>{
      const app = await mk(t, { foodLog:{ [DAY]:{ breakfast:[null, "str", 5, { name:"Trứng", grams:50, kcal:78, protein:6.5, carbs:0.6, fat:5.5 }], dinner:[[1,2]] },
        "2026-11-13":{ lunch:[null, { name:"Cơm", kcal:200 }] }, "2026-11-12":"hỏng" } });
      expectNone(app.loadErrors.map(e=> e.file + ": " + e.error.message), "lỗi nạp file");
      app.run(NU_RENDER);
      const log = app.evj("state.foodLog");
      assert.deepEqual(Object.keys(log[DAY]).sort(), ["breakfast","dinner","lunch","snack"]);
      assert.equal(log[DAY].breakfast.length, 1); assert.equal(log[DAY].dinner.length, 0);
      assert.equal(log["2026-11-13"].lunch.length, 1);
      assert.ok(!("2026-11-12" in log));
      app.run("NutriPro.ui.openShoppingList(); addRecipeToLog(RECIPES[0], 'snack');");
      assert.equal(app.evj(`state.foodLog["${DAY}"].snack.length`) >= 1, true);
    });
    t.test("R3-NUT-03: dòng hợp lệ giữ nguyên từng trường (không sửa dữ liệu đúng, không tạo thay đổi giả)", async ()=>{
      const good = { name:"Ức gà", foodId:"uc-ga", grams:150, kcal:248, protein:46.5, carbs:0, fat:5.4, fiber:0, unit:"1 miếng", qty:1, fromPlan:true };
      const app = await mk(t, { foodLog:{ [DAY]:{ breakfast:[good], lunch:[], dinner:[], snack:[] } }, waterLog:{ [DAY]:1.25 } });
      assert.equal(app.ev("nuCleanLogs(true)"), 0);
      assert.deepEqual(app.evj(`state.foodLog["${DAY}"].breakfast[0]`), good);
      assert.equal(app.ev(`state.waterLog["${DAY}"]`), 1.25);
    });

    /* ---------- R3-NUT-04 · Medium ---------- */
    t.test("R3-NUT-04: kcal/macro/gam âm, NaN, chuỗi, Infinity, 1e12 trong nhật ký → kẹp 0…trần; không còn '∞', 'NaN', số âm trên màn", async ()=>{
      const app = await mk(t, { foodLog:{ [DAY]:{ breakfast:[
        { name:XSS, grams:"<b>1</b>", kcal:-500, protein:-20, carbs:"abc", fat:1e308 }, { name:null, grams:0, kcal:NaN },
        { name:"to", grams:1e12, kcal:1e12, protein:1e12, carbs:1e12, fat:1e12 }], lunch:[], dinner:[{ name:"a", kcal:"1e999" }], snack:[] } } });
      app.run("nuUI.open = { breakfast:true, lunch:true, dinner:true, snack:true };" + NU_RENDER);
      const b = app.evj(`state.foodLog["${DAY}"].breakfast`);
      assert.deepEqual([b[0].kcal, b[0].protein, b[0].carbs, b[0].grams], [0, 0, 0, 0]);
      assert.equal(b[0].fat, 5000); assert.equal(b[1].name, "Món ăn"); assert.equal(b[1].kcal, 0);
      assert.deepEqual([b[2].kcal, b[2].grams, b[2].protein], [20000, 10000, 5000]);
      assert.equal(app.evj(`state.foodLog["${DAY}"].dinner[0].kcal`), 0);
      const html = app.lastHtml("nu-content");
      expectNone(html.match(/NaN|undefined|Infinity|∞|<img src=x|-\d[\d.]* ?kcal|>-\d+</g) || [], "giá trị rác trên màn Dinh dưỡng");
    });

    /* ---------- R3-NUT-05 · Medium ---------- */
    t.test("R3-NUT-05: nước âm / NaN / cực lớn → 0…15 L; nút cộng nước có trần và cảnh báo uống quá nhiều", async ()=>{
      const app = await mk(t, { waterLog:{ [DAY]:-5, "2026-11-13":"abc", "2026-11-12":999, "2026-11-11":"1.5" } });
      app.run(NU_RENDER);
      const wl = app.evj("state.waterLog");
      assert.equal(wl[DAY], 0); assert.equal(wl["2026-11-13"], 0); assert.equal(wl["2026-11-11"], 1.5);
      assert.ok(wl["2026-11-12"] >= 0 && wl["2026-11-12"] <= 15, "999 L phải bị kẹp ≤ 15 L (app.js có thể đã đưa về 0)");
      app.run(`state.waterLog["2026-11-10"] = 999; nuCleanLogs(true);`);
      assert.equal(app.ev(`state.waterLog["2026-11-10"]`), 15);
      const w = app.ev("nuWaterHTML()");
      assert.ok(!/-5|NaN/.test(w), "khối nước còn số rác");
      const src = read("nutrition.js");
      assert.match(src, /Math\.min\(NU_LIM\.waterL, cur \+ add\)/, "nút +250/+500 ml phải có trần");
      assert.match(src, /hạ natri máu/, "phải có cảnh báo uống quá nhiều nước");
      assert.equal(app.ev("NU_LIM.waterL"), 15);
    });

    /* ---------- R3-NUT-06 · Medium ---------- */
    t.test("R3-NUT-06: recipeMacros / itemsMacros chịu được items hỏng (thiếu, null, gam âm/NaN/chuỗi, mã lạ)", async ()=>{
      const app = await mk(t);
      const m = app.evj(`recipeMacros({ items:[["uc-ga",100], null, "x", ["khong-co",50], ["com-trang",-20], ["com-trang","abc"], ["com-trang","100"]] })`);
      assert.equal(m.kcal, 165 + 130); assert.equal(m.lines.length, 2);
      assert.equal(app.evj("recipeMacros({}).kcal"), 0);
      assert.equal(app.evj("recipeMacros(null).kcal"), 0);
      const im = app.evj(`NutriPro.itemsMacros([["uc-ga",100], null, ["uc-ga",NaN], ["uc-ga",-5], 7])`);
      assert.equal(Math.round(im.k), 165); assert.equal(im.g, 100);
      assert.equal(app.evj("NutriPro.itemsMacros('abc').k"), 0);
    });

    /* ---------- R3-NUT-07 · Medium ---------- */
    t.test("R3-NUT-07: mục tiêu calo/macro phi lý (99.999 kcal, NaN, âm, Infinity) → thực đơn dùng 1.200/1.500…6.000 kcal, macro hữu hạn", async ()=>{
      const app = await mk(t);
      const T = e=> app.evj(`NutriPro.targets(${e})`);
      const huge = T(`{ gender:"male", goalKcal:99999, protein:9999, carbs:1, fat:1 }`);
      assert.equal(huge.K, 6000); assert.equal(huge.capped, 99999); assert.ok(huge.P <= 525, "đạm ≤ 35 % của 6.000 kcal");
      for(const bad of [`{ goalKcal:NaN, protein:NaN, carbs:NaN, fat:NaN }`, `{ goalKcal:-500, protein:-3 }`, `{ goalKcal:Infinity, protein:Infinity, carbs:Infinity, fat:Infinity }`, `{ goalKcal:"abc" }`, `null`]){
        const x = T(bad);
        assert.ok([x.K, x.P, x.C, x.F, x.FB].every(v=> Number.isFinite(v) && v > 0), bad + " → " + JSON.stringify(x));
        assert.ok(x.K >= 1200 && x.K <= 6000, bad + " K=" + x.K);
      }
      app.run(`Object.assign(state.profile, { autoTargets:false, goalKcal:NaN, protein:null, carbs:undefined, fat:"x" }); ${NU_RENDER}`);
      expectNone(app.lastHtml("nu-content").match(/NaN|undefined|null ?g|Infinity/g) || [], "mục tiêu hỏng lộ ra màn Dinh dưỡng");
      const pl = app.evj(`(()=>{ const t = NutriPro.planTotals(buildDayPlan({ gender:"male", goalKcal:99999, protein:9999, carbs:1, fat:1, goal:"gain" }, 0, {})); return { k:t.k, p:t.p }; })()`);
      assert.ok(pl.p < 600, "thực đơn không còn đạm hàng nghìn gam: " + pl.p);
    });

    /* ---------- R3-NUT-08 · Medium ---------- */
    t.test("R3-NUT-08: bodyAnalysis với số đo phi lý (âm, NaN, cao 1,72 'cm', 700 kg, chuỗi rác) → 'Chưa đủ thông tin', không khuyên thâm hụt", async ()=>{
      const app = await mk(t);
      const ba = e=> app.evj(`bodyAnalysis(${e}, null)`);
      for(const bad of [`{ weight:-70, height:172 }`, `{ weight:70, height:1.72 }`, `{ weight:700, height:170 }`, `{ weight:NaN, height:170 }`, `{ weight:"abc", height:"x" }`, `{ weight:70, height:300 }`, `{ weight:5, height:170 }`]){
        const a = ba(bad);
        assert.equal(a.cat, "Chưa đủ thông tin", bad); assert.equal(a.bmi, 0, bad);
        assert.ok(!/THÂM HỤT|ăn DƯ/.test(a.advice), bad + ": " + a.advice);
        assert.match(a.advice, /kiểm tra lại/i, bad);
      }
      assert.equal(ba(`{}`).advice, "Nhập chiều cao, cân nặng để app gợi ý thực đơn phù hợp.");
      assert.equal(ba(`{ weight:"70", height:"172" }`).cat, "Thừa cân");          // chuỗi số hợp lệ vẫn tính
      assert.equal(ba(`{ weight:70, height:172 }`).bmi, 23.6);
    });

    /* ---------- R3-NUT-09 · Medium ---------- */
    t.test("R3-NUT-09: BMI < 16 → khuyên đi khám + tăng từ từ (severe); BMI ≥ 35 → giảm cân có bác sĩ theo dõi; < 18 tuổi / thai kỳ không gắn 'severe'", async ()=>{
      const app = await mk(t);
      const ba = e=> app.evj(`bodyAnalysis(${e}, null)`);
      const low = ba(`{ weight:38, height:172, age:28 }`);
      assert.equal(low.cat, "Thiếu cân"); assert.equal(low.rec, "gain"); assert.equal(low.severe, true);
      assert.match(low.advice, /khám bác sĩ/); assert.match(low.advice, /từ từ/);
      const mild = ba(`{ weight:52, height:172, age:28 }`);
      assert.equal(mild.severe, false); assert.match(mild.advice, /ăn DƯ/);
      const ob = ba(`{ weight:110, height:165, age:40 }`);
      assert.equal(ob.severe, true); assert.match(ob.advice, /BÁC SĨ THEO DÕI/); assert.match(ob.advice, /không nhịn ăn/);
      assert.equal(ba(`{ weight:38, height:172, age:16 }`).severe, false);
      assert.equal(app.evj(`bodyAnalysis({ weight:110, height:165, age:30, gender:"female" }, { preg:true, screened:true })`).severe, false);
    });
    t.test("R3-NUT-09: health-safety — BMI < 18,5 (người lớn) → không thâm hụt kể cả mục tiêu tự đặt; BMI < 16 → 'nên hỏi bác sĩ' + thận trọng cường độ rất cao", async ()=>{
      const app = await mk(t, { health: HS() }, { gender:"female", age:25, height:165, weight:42, activity:"light", goal:"lose" });
      const f = app.evj("FKHealth.flags(state.health, state.profile)");
      assert.equal(f.underweight, true); assert.equal(f.lowBmi, true);
      assert.ok(f.noDeficitReasons.includes("underweight")); assert.ok(f.doctor.includes("lowBmi")); assert.equal(f.cautionVeryHigh, true);
      app.run("recomputeProfile()");
      assert.ok(app.ev("state.profile.goalKcal >= state.profile.tdee"), "tự động: không thâm hụt");
      app.run("Object.assign(state.profile, { autoTargets:false, goalKcal:1000, protein:60, carbs:120, fat:30 }); recomputeProfile();");
      const adj = app.evj("state.profile.hsAdjust");
      assert.ok(adj && adj.manual && adj.warn.includes("kcal"), "tự đặt 1.000 kcal khi BMI 15,4 phải có cảnh báo: " + JSON.stringify(adj));
      // không ảnh hưởng người bình thường, người < 18 (đã có cờ minor), thai phụ (BMI không áp dụng), số đo rác
      const ok = app.evj(`FKHealth.flags(state.health, { gender:"male", age:30, height:172, weight:70 })`);
      assert.equal(ok.underweight, false); assert.equal(ok.noDeficit, false); assert.equal(ok.any, false);
      assert.equal(app.evj(`FKHealth.flags(state.health, { gender:"male", age:16, height:172, weight:45 })`).underweight, false);
      assert.equal(app.evj(`FKHealth.flags(Object.assign({}, state.health, { pregnancy:"pregnant" }), { gender:"female", age:28, height:165, weight:42 })`).underweight, false);
      assert.equal(app.evj(`FKHealth.flags(state.health, { gender:"male", age:30, height:1.72, weight:-5 })`).underweight, false);
      assert.match(app.evj("FKHealth.TIPS.lowBmi").join(" "), /đi khám/);
      app.run("FKHealth.openTipsSheet()");
      assert.match(app.dom.htmlLog.slice(-3).map(h=> h.html).join(""), /Thiếu cân nặng \(BMI dưới 16\)/);
    });

    /* ---------- R3-NUT-10 · Medium ---------- */
    t.test("R3-NUT-10: bộ nhớ thực đơn (localStorage fitkit_np_plans_v1) bị hỏng → bỏ bản nhớ, tính lại; không ném lỗi, không chèn HTML", async ()=>{
      const app = await mk(t);
      app.run("recomputeProfile(); buildDayPlan(state.profile, 0, {}); NutriPro.flushStore();");
      const key = app.ev("NutriPro._storeKey");
      const raw = JSON.parse(app.localStorage.getItem(key));
      assert.ok(raw && raw.keys.length >= 1, "phải có thực đơn đã nhớ");
      const good = app.evj("NutriPro.planTotals(buildDayPlan(state.profile, 0, {}))");
      const variants = [
        m=>{ m.lunch[1] = [null, "x"]; }, m=>{ m.lunch[1] = [["uc-ga", XSS]]; }, m=>{ m.lunch[1] = [[XSS, 100]]; },
        m=>{ m.lunch[1] = [["uc-ga", -100]]; }, m=>{ m.lunch[3] = [{ id:XSS, g:XSS }]; }, m=>{ m.lunch[1] = []; }, m=>{ m[XSS] = m.lunch; },
      ];
      for(const [i, mut] of variants.entries()){
        const o = JSON.parse(JSON.stringify(raw));
        Object.values(o.plans).forEach(pl=> mut(pl.m));
        const app2 = await t.app({ state:{ onboarded:true, authDone:true, profile: PROF() }, storage:{ [key]: JSON.stringify(o) } });
        app2.setNow(NOW);
        app2.run("recomputeProfile(); nuUI.planDay = 0;" + NU_RENDER);
        const tot = app2.evj("NutriPro.planTotals(buildDayPlan(state.profile, 0, {}))");
        assert.ok(Number.isFinite(tot.k) && Math.abs(tot.k - good.k) < 1, `biến thể ${i}: thực đơn tính lại phải giống bản gốc (${tot.k} vs ${good.k})`);
        assert.ok(!/<img src=x/i.test(allHtml(app2)), `biến thể ${i}: payload lọt vào HTML`);
      }
    });

    /* ---------- R3-NUT-11 · Medium ---------- */
    t.test("R3-NUT-11: món tự tạo — chặn mật độ năng lượng > 9 kcal/g và macro nặng hơn khẩu phần; dữ liệu cũ bị kẹp 900 kcal/100 g", async ()=>{
      const src = read("nutrition-pro.js");
      assert.match(src, /kcal > g\*9 \+ 0\.5/, "thiếu kiểm tra 9 kcal/g khi lưu món tự tạo");
      assert.match(src, /P \+ C \+ F \+ FB > g\*1\.02 \+ 0\.5/, "thiếu kiểm tra tổng macro ≤ khối lượng");
      const app = await mk(t, { nutriPro:{ custom:[{ id:"cf-old", name:"Món cũ nhập sai", kcal:45000, protein:900, carbs:20, fat:10, units:[{ label:"1 phần", g:1 }] }] } });
      const f = app.evj("FOODS.find(f=>f.id==='cf-old')");
      assert.equal(f.kcal, 900); assert.equal(f.protein, 100);
    });

    /* ---------- R3-NUT-12 · Low: nội dung không hàm ý chữa / kiểm soát bệnh ---------- */
    t.test("R3-NUT-12: lời khuyên món ăn & kho kiến thức không có khẳng định chữa bệnh / cam kết kết quả (Luật Quảng cáo, NĐ 15/2018)", async ()=>{
      const app = await mk(t);
      const tips = app.evj("RECIPES.map(r=> [r.id, (r.tip||'') + ' ' + (r.steps||[]).join(' ')])");
      const RX = /chữa (khỏi|bệnh|được)|điều trị|đặc trị|thần dược|kiểm soát đường huyết|tốt cho tim mạch|hạ huyết áp|giảm cholesterol|ngừa ung thư|chống ung thư|thải độc|giải độc|tan mỡ|cam kết/i;
      expectNone(tips.filter(([, s])=> RX.test(s)).map(([id, s])=> id + ": " + s.match(RX)[0]), "tip món ăn có khẳng định sức khoẻ rủi ro");
      const bad = [];
      const CLAIM = /(chữa khỏi|đặc trị|thần dược|trị dứt|tận gốc|không tác dụng phụ|an toàn tuyệt đối|cam kết (giảm|tăng)|đảm bảo (giảm|tăng)|thay thế thuốc)/i;
      const NEG = /không|đừng|tránh|chưa|cảnh giác|vô hiệu/i;
      for(const f of fs.readdirSync(ROOT).filter(x=> /^kb-data-\d+\.js$/.test(x))){
        read(f).split(/(?<=[.!?:|\n])/).forEach(sen=>{ if(CLAIM.test(sen) && !NEG.test(sen)) bad.push(f + ": " + sen.trim().slice(0, 120)); });
      }
      expectNone(bad, "kho kiến thức có khẳng định chữa bệnh / cam kết");
      assert.match(read("kb.js"), /không thay thế tư vấn y tế/, "bài viết phải có dòng miễn trừ y tế");
    });

    /* ---------- hiệu năng: danh sách lớn ---------- */
    t.test("R3-NUT-PERF: 300 món tự tạo + 400 dòng nhật ký — vẽ màn Dinh dưỡng & mở 'Thêm món' < 1,5 s, làm sạch chỉ chạy 1 lần", async ()=>{
      const custom = Array.from({ length:300 }, (_, i)=> ({ id:"cf-p" + i, name:"Món " + i, kcal:100 + i % 300, protein:5, carbs:10, fat:3, units:[{ label:"1 phần", g:150 }] }));
      const day = { breakfast:[], lunch:[], dinner:[], snack:[] };
      for(let i = 0; i < 400; i++) day[["breakfast","lunch","dinner","snack"][i % 4]].push({ name:"Món " + i, foodId:"cf-p" + (i % 300), grams:150, kcal:200, protein:8, carbs:20, fat:6 });
      const app = await mk(t, { nutriPro:{ custom }, foodLog:{ [DAY]: day } });
      assert.equal(app.ev("FOODS.filter(f=>f.custom).length"), 300);
      app.run("nuUI.open = { breakfast:true, lunch:true, dinner:true, snack:true };" + NU_RENDER);
      const t0 = Date.now();
      app.run(NU_RENDER + "openAddFood('lunch',{tab:'all'}); openAddFood('lunch',{tab:'mine'});");
      const ms = Date.now() - t0;
      assert.ok(ms < 1500, "quá chậm: " + ms + " ms");
      assert.equal(app.ev("nuCleanLogs()"), 0);
    });
  },
};

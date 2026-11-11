/* Tính toán năng lượng (app.js), phân tích cơ thể & thực đơn (meals.js), macro món (nutrition.js) */
"use strict";
const { assert, approx, expectNone } = require("../lib/framework");

/* 12 hồ sơ đại diện (giới tính × mục tiêu × thể trạng, gồm ca biên: thiếu cân, béo phì, dưới 18, cao tuổi) */
const PROFILES = [
  { key:"nam-25-tang-co",      gender:"male",   age:25, height:172, weight:68,  activity:"moderate",   goal:"gain" },
  { key:"nam-30-giam-mo",      gender:"male",   age:30, height:175, weight:85,  activity:"light",      goal:"lose" },
  { key:"nam-19-gay-duytri",   gender:"male",   age:19, height:165, weight:52,  activity:"sedentary",  goal:"maintain" },
  { key:"nam-45-to-tang-co",   gender:"male",   age:45, height:180, weight:95,  activity:"active",     goal:"gain" },
  { key:"nam-35-beophi",       gender:"male",   age:35, height:170, weight:110, activity:"sedentary",  goal:"lose" },
  { key:"nam-16-giam-mo",      gender:"male",   age:16, height:168, weight:75,  activity:"moderate",   goal:"lose" },
  { key:"nu-24-duytri",        gender:"female", age:24, height:158, weight:50,  activity:"light",      goal:"maintain" },
  { key:"nu-30-giam-mo",       gender:"female", age:30, height:162, weight:68,  activity:"moderate",   goal:"lose" },
  { key:"nu-22-thieucan-giam", gender:"female", age:22, height:155, weight:42,  activity:"sedentary",  goal:"lose" },
  { key:"nu-40-to-tang-co",    gender:"female", age:40, height:165, weight:90,  activity:"active",     goal:"gain" },
  { key:"nu-28-vdv-tang-co",   gender:"female", age:28, height:170, weight:60,  activity:"veryActive", goal:"gain" },
  { key:"nu-55-nho-giam-mo",   gender:"female", age:55, height:150, weight:48,  activity:"sedentary",  goal:"lose" },
];
/* Thực phẩm "mặn" (thịt, cá, hải sản, món ăn sẵn có thịt) — không được xuất hiện khi bật "Chỉ món chay" */
const MEAT_IDS = new Set(["uc-ga","dui-ga","uc-vit","thit-bo-nac","thit-heo-nac","thit-heo-ba-chi","ca-hoi","ca-basa","ca-ngu","tom-luoc",
  "ca-thu","muc","thit-bo-xay","dui-ga-bo-da","thit-heo-xay","pho-bo-to","bun-bo-hue-to","hu-tieu-to","mi-quang-to","bun-cha-suat",
  "com-tam-suon","com-van-phong","com-chien","banh-mi-thit","xoi-man","banh-cuon-dia","banh-xeo","banh-bao","chao-ga-to","goi-cuon-san"]);

module.exports = {
  name: "Tính toán năng lượng, phân tích cơ thể & thực đơn",
  area: "Tính toán / Dinh dưỡng (app.js §2, meals.js, nutrition.js)",
  async define(t){
    const app = await t.app();
    const prof = p => app.run(`(()=>{ state.profile = Object.assign(defaultState().profile, ${JSON.stringify(p)}, { autoTargets:true }); recomputeProfile(); return JSON.parse(JSON.stringify(state.profile)); })()`);
    const kcalOf = plan => Object.values(plan).reduce((s,r)=> s + app.call("recipeKcal", r), 0);

    /* ---------- BMR / TDEE / mục tiêu / macro ---------- */
    t.test("calcBMR theo Mifflin-St Jeor (nam +5, nữ −161), làm tròn", ()=>{
      assert.equal(app.call("calcBMR", { gender:"male", weight:70, height:175, age:25 }), 1674);     // 700+1093.75−125+5
      assert.equal(app.call("calcBMR", { gender:"female", weight:60, height:165, age:30 }), 1320);   // 600+1031.25−150−161
      assert.equal(app.call("calcBMR", { gender:"male", weight:"80", height:"180", age:"40" }), 1730); // chuỗi số vẫn đúng: 800+1125−200+5
    });
    t.test("calcTDEE: 5 mức PAL 1.2/1.375/1.55/1.725/1.9, id lạ → 'moderate'", ()=>{
      const f = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, veryActive:1.9 };
      for(const [id, k] of Object.entries(f)) assert.equal(app.call("calcTDEE", 1600, id), Math.round(1600*k), id);
      assert.equal(app.call("calcTDEE", 1600, "khong-co"), Math.round(1600*1.55));
    });
    t.test("calcGoalKcal: giảm −18%, duy trì 0, tăng +12%, id lạ → duy trì", ()=>{
      assert.equal(app.call("calcGoalKcal", 2500, "lose"), 2050);
      assert.equal(app.call("calcGoalKcal", 2500, "maintain"), 2500);
      assert.equal(app.call("calcGoalKcal", 2500, "gain"), 2800);
      assert.equal(app.call("calcGoalKcal", 2500, "?"), 2500);
    });
    t.test("calcMacros: đạm 2 g/kg theo cân nặng điều chỉnh (BMI 25), trần 180 g; béo 25%; carb phần còn lại", ()=>{
      // fix-core (QN-08): đạm g/kg nay theo mục tiêu + mức vận động (ít vận động / duy trì < 2 g/kg) — test này kiểm nhánh
      // "tăng cơ, vận động vừa" = 2 g/kg. Trước đây state.profile còn sót hồ sơ cuối (nữ 55 tuổi ít vận động) mà vẫn 2 g/kg = lỗi QN-08.
      app.run("state.profile.height = 170; state.profile.activity = 'moderate'; state.profile.goal = 'gain'; state.profile.age = 30;");
      let m = app.call("calcMacros", 60, 2200);                 // 60 kg < 25×1,7² = 72,25 → đạm 120 g
      assert.equal(m.protein, 120); assert.equal(m.fat, Math.round(2200*0.25/9));
      approx(m.protein*4 + m.carbs*4 + m.fat*9, 2200, 12, "tổng kcal từ macro");
      m = app.call("calcMacros", 100, 2600);                    // thừa cân → tính theo 72,25 kg → 145 g
      assert.equal(m.protein, 145);
      app.run("state.profile.height = 200");
      m = app.call("calcMacros", 120, 3500);                    // 240 g → trần 180 g
      assert.equal(m.protein, 180);
      m = app.call("calcMacros", 120, 900);                     // calo quá thấp → carb không âm
      assert.ok(m.carbs >= 0);
    });
    t.test("Sàn calo an toàn: nữ ≥ 1.200, nam ≥ 1.500 và không dưới BMR (12 hồ sơ)", ()=>{
      const bad = [];
      for(const p of PROFILES){
        const r = prof(p);
        const floor = Math.max(p.gender === "male" ? 1500 : 1200, r.bmr);
        if(!(r.goalKcal >= floor)) bad.push(`${p.key}: goalKcal ${r.goalKcal} < sàn ${floor}`);
        if(!Number.isFinite(r.goalKcal)) bad.push(`${p.key}: goalKcal không hữu hạn`);
      }
      expectNone(bad, "Vi phạm sàn calo");
      assert.equal(prof(PROFILES[11]).goalKcal, 1200, "nữ 55 tuổi 48 kg ít vận động giảm mỡ phải chạm sàn 1.200");
    });
    t.test("Chặn thâm hụt khi thiếu cân (BMI < 18,5) hoặc dưới 18 tuổi → calo về mức duy trì", ()=>{
      const under = prof(PROFILES[8]);                          // nữ 42 kg / 155 cm, BMI 17,5, muốn giảm
      assert.equal(under.goalBlocked, true);
      assert.equal(under.goalKcal, Math.max(1200, under.tdee, under.bmr));
      const teen = prof(PROFILES[5]);                           // nam 16 tuổi muốn giảm
      assert.equal(teen.goalBlocked, true);
      assert.equal(teen.goalKcal, Math.max(1500, teen.tdee));
      const adult = prof(Object.assign({}, PROFILES[5], { age:18 }));
      assert.equal(adult.goalBlocked, false);
      assert.ok(adult.goalKcal < adult.tdee, "18 tuổi được thâm hụt");
    });
    t.test("autoTargets=false: không ghi đè mục tiêu calo/macro người dùng tự chỉnh", ()=>{
      app.run(`state.profile = Object.assign(defaultState().profile, { autoTargets:false, goalKcal:1777, protein:111, carbs:222, fat:55 }); recomputeProfile();`);
      assert.deepEqual(app.evj("[state.profile.goalKcal, state.profile.protein, state.profile.carbs, state.profile.fat]"), [1777,111,222,55]);
    });

    /* ---------- bodyAnalysis ---------- */
    t.test("bodyAnalysis: ngưỡng BMI châu Á (18,5 / 23 / 25 / 30) đúng ở mọi biên", ()=>{
      const cat = w => app.call("bodyAnalysis", { height:100, weight:w, age:30, goal:"maintain" }).cat;   // h = 1 m → BMI = cân nặng
      const cases = [[15,"Thiếu cân"],[18.49,"Thiếu cân"],[18.5,"Bình thường"],[22.99,"Bình thường"],[23,"Thừa cân"],[24.99,"Thừa cân"],
        [25,"Béo phì độ I"],[29.99,"Béo phì độ I"],[30,"Béo phì độ II"],[45,"Béo phì độ II"]];
      for(const [w, c] of cases) assert.equal(cat(w), c, `BMI ${w}`);
      const rec = w => app.call("bodyAnalysis", { height:100, weight:w, age:30, goal:"gain" }).rec;
      assert.equal(rec(17), "gain"); assert.equal(rec(21), "gain"); assert.equal(rec(24), "lose"); assert.equal(rec(31), "lose");
    });
    t.test("bodyAnalysis: thiếu chiều cao/cân nặng → 'Chưa đủ thông tin', BMI 0", ()=>{
      for(const p of [{ height:0, weight:70 }, { height:170, weight:0 }, {}]){
        const a = app.call("bodyAnalysis", p); assert.equal(a.bmi, 0); assert.equal(a.cat, "Chưa đủ thông tin");
      }
    });
    t.test("bodyAnalysis: BMI hiển thị (làm tròn 1 số) phải khớp nhãn phân loại", ()=>{
      const bad = [];
      for(const [h, w] of [[170,53.4],[170,66.4],[170,72.2],[170,86.6],[160,47.3],[180,74.5]]){
        const a = app.call("bodyAnalysis", { height:h, weight:w, age:30 });
        const shown = a.bmi;
        const expect = shown < 18.5 ? "Thiếu cân" : shown < 23 ? "Bình thường" : shown < 25 ? "Thừa cân" : shown < 30 ? "Béo phì độ I" : "Béo phì độ II";
        if(expect !== a.cat) bad.push(`${h} cm/${w} kg: hiện "BMI ${shown}" nhưng nhãn "${a.cat}" (đúng ra "${expect}")`);
      }
      expectNone(bad, "BMI hiển thị mâu thuẫn nhãn");
    }, { bug:"BUG-09", severity:"Thấp" });
    t.test("bodyAnalysis: dưới 18 tuổi → lời khuyên riêng, KHÔNG khuyến nghị 'lose'", ()=>{
      const a = app.call("bodyAnalysis", { height:160, weight:70, age:16, goal:"maintain" });
      assert.match(a.advice, /dưới 18 tuổi/);
      assert.notEqual(a.rec, "lose", `rec = "${a.rec}" mâu thuẫn lời khuyên "không tự ăn kiêng thâm hụt"`);
    }, { bug:"BUG-04", severity:"Trung bình" });
    t.test("Thẻ thực đơn (nuPlanCardHTML) không mời người dưới 18 tuổi chuyển sang 'Giảm mỡ'", ()=>{
      app.run(`state.profile = Object.assign(defaultState().profile, { gender:"male", age:16, height:160, weight:70, goal:"maintain", activity:"moderate", autoTargets:true }); recomputeProfile();`);
      const html = app.call("nuPlanCardHTML");
      assert.ok(!/data-switch-goal="lose"/.test(html), 'Có nút data-switch-goal="lose" cho học sinh 16 tuổi');
    }, { bug:"BUG-04", severity:"Trung bình" });

    /* ---------- buildDayPlan ---------- */
    const runPlans = (veg, cuisine="all")=>{
      const out = [];
      for(const p of PROFILES){
        const r = prof(p);
        for(let d = 0; d < 7; d++){ const plan = app.call("buildDayPlan", r, d, { veg, cuisine }); out.push({ p, r, d, plan, kcal: kcalOf(plan) }); }
      }
      return out;
    };
    const normal = runPlans(false), veg = runPlans(true);

    t.test("buildDayPlan: 12 hồ sơ × 7 ngày — tổng calo lệch ≤ 10% mục tiêu", ()=>{
      expectNone(normal.filter(x=> Math.abs(x.kcal - x.r.goalKcal) > x.r.goalKcal*0.10)
        .map(x=> `${x.p.key} ngày ${x.d}: ${Math.round(x.kcal)} / ${x.r.goalKcal} kcal (${((x.kcal/x.r.goalKcal-1)*100).toFixed(1)}%)`), "Lệch calo > 10%");
    });
    t.test("buildDayPlan (Chỉ món chay): 12 hồ sơ × 7 ngày — tổng calo lệch ≤ 10% mục tiêu", ()=>{
      expectNone(veg.filter(x=> Math.abs(x.kcal - x.r.goalKcal) > x.r.goalKcal*0.10)
        .map(x=> `${x.p.key} ngày ${x.d}: ${Math.round(x.kcal)} / ${x.r.goalKcal} kcal (${((x.kcal/x.r.goalKcal-1)*100).toFixed(1)}%)`), "Thực đơn chay thiếu calo");
    }, { bug:"BUG-05", severity:"Trung bình" });
    t.test("buildDayPlan (chay): không lọt món mặn — 12 hồ sơ × 7 ngày × ẩm thực Tất cả/Việt/Âu", ()=>{
      const bad = [];
      for(const cz of ["all","vn","au"]) for(const x of (cz === "all" ? veg : runPlans(true, cz)))
        for(const [meal, r] of Object.entries(x.plan)) r.items.forEach(([id])=>{ if(MEAT_IDS.has(id)) bad.push(`${cz}/${x.p.key}/ngày ${x.d}/${meal}: ${r.id} chứa ${id}`); });
      expectNone([...new Set(bad)], "Món mặn trong thực đơn chay");
    });
    t.test("buildDayPlan (chay): mọi món chính đều có tag 'chay' (kể cả khi lọc 'Chỉ món Âu')", ()=>{
      const bad = new Set();
      for(const cz of ["all","vn","au"]) for(const x of runPlans(true, cz))
        for(const [meal, r] of Object.entries(x.plan)){ const tags = app.ev(`RECIPES.find(z=>z.id===${JSON.stringify(r.id)}).tags`); if(!tags.includes("chay")) bad.add(`${cz}/${meal}: ${r.id} [${tags}]`); }
      expectNone([...bad], "Món không gắn tag chay lọt vào thực đơn chay");
    }, { bug:"BUG-14", severity:"Thấp" });
    t.test("buildDayPlan: mỗi nguyên liệu ≤ 600 g", ()=>{
      const bad = new Set();
      for(const x of normal.concat(veg)) for(const [meal, r] of Object.entries(x.plan)) r.items.forEach(([id, g])=>{ if(g > 600) bad.add(`${x.p.key}/${meal}: ${id} ${g} g`); });
      expectNone([...bad], "Nguyên liệu > 600 g");
    });
    t.test("buildDayPlan: khẩu phần mỗi món chính (sau khi nhân hệ số) ≤ 600 g", ()=>{
      const bad = new Map();
      for(const x of normal.concat(veg)) for(const [meal, r] of Object.entries(x.plan)){
        const base = app.ev(`scaleRecipe(RECIPES.find(z=>z.id===${JSON.stringify(r.id)}), ${r.factor})`);
        const g = base.items.reduce((s, [, q])=> s + q, 0);
        if(g > 600){ const k = `${r.id} ×${r.factor.toFixed(2)}`; bad.set(k, Math.max(bad.get(k) || 0, g)); }
      }
      const total = normal.length*4 + veg.length*4;
      expectNone([...bad].sort((a,b)=> b[1]-a[1]).map(([k, g])=> `${k} = ${g} g`), `Món > 600 g (trên ${total} bữa sinh ra)`);
    }, { bug:"BUG-06", severity:"Trung bình" });
    t.test("buildDayPlan: 'món phụ' bù calo dồn vào 1 bữa ≤ 600 g", ()=>{
      const bad = [];
      for(const x of normal.concat(veg)) for(const [meal, r] of Object.entries(x.plan)){
        if(!r.extra) continue;
        const base = app.ev(`scaleRecipe(RECIPES.find(z=>z.id===${JSON.stringify(r.id)}), ${r.factor})`);
        const add = r.items.reduce((s, [, q])=> s + q, 0) - base.items.reduce((s, [, q])=> s + q, 0);
        if(add > 600) bad.push(`${x.p.key} ngày ${x.d} (${x.r.goalKcal} kcal) ${meal}: +${add} g món phụ`);
      }
      expectNone(bad, "Bữa phụ bị nhồi > 600 g món phụ");
    }, { bug:"BUG-06", severity:"Trung bình" });
    t.test("buildDayPlan: đủ 4 bữa, xác định (cùng input → cùng output), không sửa RECIPES gốc", ()=>{
      const before = JSON.stringify(app.ev("RECIPES"));
      const r = prof(PROFILES[3]);
      const a = app.call("buildDayPlan", r, 2, {}), b = app.call("buildDayPlan", r, 2, {});
      assert.deepEqual(Object.keys(a).sort(), ["breakfast","dinner","lunch","snack"]);
      assert.equal(JSON.stringify(a), JSON.stringify(b));
      for(let d=0; d<7; d++) app.call("buildDayPlan", r, d, { veg: d%2===0 });
      assert.equal(JSON.stringify(app.ev("RECIPES")), before, "RECIPES bị thay đổi");
    });
    t.test("buildDayPlan: thực đơn xoay vòng — 7 ngày không trùng hệt nhau", ()=>{
      const r = prof(PROFILES[0]);
      const sig = new Set(); for(let d=0; d<7; d++){ const p = app.call("buildDayPlan", r, d, {}); sig.add(Object.values(p).map(x=> x.id).join("|")); }
      assert.ok(sig.size >= 5, `chỉ có ${sig.size} thực đơn khác nhau / 7 ngày`);
    });

    /* ---------- recipeMacros & toàn vẹn dữ liệu ---------- */
    t.test("recipeMacros: cộng đúng từng dòng (100 g quy đổi), làm tròn, khớp recipeKcal", ()=>{
      const m = app.call("recipeMacros", { items:[["uc-ga",150],["com-gao-lut",150],["dua-leo",80],["dau-oliu",5]] });
      assert.equal(m.lines.length, 4);
      assert.equal(m.lines[0].kcal, 248); assert.equal(m.lines[0].protein, 46.5);       // 165×1,5 ; 31×1,5
      assert.equal(m.kcal, m.lines.reduce((s,l)=> s + l.kcal, 0));
      assert.equal(m.protein, Math.round(46.5 + 2.6*1.5 + 0.7*0.8));
      const all = app.ev("RECIPES");
      for(const r of all){ const mm = app.call("recipeMacros", r); approx(mm.kcal, app.call("recipeKcal", r), r.items.length*0.5 + 0.01, r.id); }
      const empty = app.call("recipeMacros", { items:[["khong-ton-tai", 100]] });
      assert.equal(empty.kcal, 0); assert.equal(empty.lines.length, 0);
    });
    t.test("Toàn vẹn dữ liệu: FOODS/RECIPES id duy nhất, nguyên liệu tồn tại, meal/method hợp lệ", ()=>{
      const r = app.run(`(()=>{ const bad=[]; const fid = FOODS.map(f=>f.id); fid.forEach((x,i)=>{ if(fid.indexOf(x)!==i) bad.push("FOODS trùng "+x); });
        const rid = RECIPES.map(r=>r.id); rid.forEach((x,i)=>{ if(rid.indexOf(x)!==i) bad.push("RECIPES trùng "+x); });
        RECIPES.forEach(r=>{ r.items.forEach(([id,g])=>{ if(!fid.includes(id)) bad.push(r.id+": thiếu "+id); if(!(g>0)) bad.push(r.id+": gram "+g); });
          if(!["breakfast","lunch","dinner","snack"].includes(r.meal)) bad.push(r.id+": meal "+r.meal);
          if(!COOK_METHODS[r.method]) bad.push(r.id+": method "+r.method); if(!Array.isArray(r.steps)||!r.steps.length) bad.push(r.id+": không có bước nấu"); });
        return bad; })()`);
      expectNone(r, "Dữ liệu lỗi");
    });
    t.test("FOODS: kcal khớp 4P + 4C + 9F trong ±35% (bỏ qua đồ uống có cồn)", ()=>{
      const bad = app.ev("FOODS").filter(f=> f.id !== "bia").filter(f=>{ const at = 4*f.protein + 4*f.carbs + 9*f.fat; return Math.abs(f.kcal - at) > 0.35*Math.max(f.kcal, 1); })
        .map(f=> `${f.id}: ${f.kcal} kcal vs Atwater ${(4*f.protein+4*f.carbs+9*f.fat).toFixed(0)}`);
      expectNone(bad, "Giá trị dinh dưỡng nghi sai");
    });

    t.info("Calo mục tiêu 12 hồ sơ", PROFILES.map(p=>{ const r = prof(p); return `${p.key.padEnd(22)} BMR ${r.bmr} · TDEE ${r.tdee} · mục tiêu ${r.goalKcal}${r.goalBlocked?" (chặn thâm hụt)":""} · P${r.protein}/C${r.carbs}/F${r.fat}`; }));
  },
};

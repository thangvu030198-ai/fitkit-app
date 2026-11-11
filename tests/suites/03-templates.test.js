/* Giáo án mẫu (templates.js) + chương trình mặc định (data.js PROGRAMS) */
"use strict";
const { assert, expectNone } = require("../lib/framework");

const DAY_KEYS = ["T2","T3","T4","T5","T6","T7","CN"];
const PUSH = new Set("benchpress inclinedb pushup cablefly overheadpress tricepdip tricepsdown dbpress dbbench machinepress inclinepushup skullcrusher ohtriext pecdeck".split(" "));
const PULL = new Set("pullup bentoverrow latpulldown facepull bicepcurl hammercurl cablerow dbrow invertedrow pullover csrow preacher".split(" "));
const CARDIO = new Set(["walking","inclinewalk","zone2","intervalwalk","running","rowing","jumprope","stretch"]);

module.exports = {
  name: "Giáo án mẫu & chương trình tập",
  area: "Giáo án (templates.js, data.js PROGRAMS, app.js plans)",
  async define(t){
    const app = await t.app();
    const T = app.evj("PROGRAM_TEMPLATES");
    const EX = app.evj("EXERCISES");

    t.test(`Mọi exerciseId trong ${T.length} giáo án mẫu tồn tại trong EXERCISES`, ()=>{
      const bad = [];
      for(const tp of T) for(const [k, d] of Object.entries(tp.days)) d.ex.forEach(([id], i)=>{ if(!EX[id]) bad.push(`${tp.id}/${k}#${i}: "${id}"`); });
      expectNone(bad, "Bài tập không tồn tại");
    });
    t.test("Mọi bài trong PROGRAMS mặc định (data.js) tồn tại; seedPlansFromPrograms() tạo đủ 7 ngày", ()=>{
      const bad = app.evj(`Object.entries(PROGRAMS).flatMap(([pid,p])=>Object.entries(p.days).flatMap(([k,d])=>d.exercises.filter(id=>!EXERCISES[id]).map(id=>pid+"/"+k+": "+id)))`);
      expectNone(bad, "Bài không tồn tại");
      const plans = app.evj("seedPlansFromPrograms()");
      for(const p of Object.values(plans)) assert.deepEqual(Object.keys(p.days), DAY_KEYS);
    });
    t.test("Cấu trúc giáo án: id duy nhất, đủ 7 ngày, giới/cấp độ hợp lệ, số tuần 4–16", ()=>{
      const bad = [];
      const ids = T.map(x=> x.id); ids.forEach((x, i)=>{ if(ids.indexOf(x) !== i) bad.push("trùng id " + x); });
      for(const tp of T){
        if(JSON.stringify(Object.keys(tp.days)) !== JSON.stringify(DAY_KEYS)) bad.push(`${tp.id}: ngày ${Object.keys(tp.days)}`);
        if(!["nam","nu","chung"].includes(tp.gender)) bad.push(`${tp.id}: gender ${tp.gender}`);
        if(!["beginner","intermediate","advanced"].includes(tp.level)) bad.push(`${tp.id}: level ${tp.level}`);
        if(!(tp.weeks >= 4 && tp.weeks <= 16)) bad.push(`${tp.id}: weeks ${tp.weeks}`);
        for(const f of ["name","goal","origin","desc"]) if(!tp[f] || typeof tp[f] !== "string") bad.push(`${tp.id}: thiếu ${f}`);
      }
      expectNone(bad, "Giáo án sai cấu trúc");
    });
    t.test("Mỗi bài trong giáo án: 1–6 hiệp nguyên, nghỉ 0–300 s, reps không rỗng", ()=>{
      const bad = [];
      for(const tp of T) for(const [k, d] of Object.entries(tp.days)) for(const [id, s, r, rest] of d.ex){
        if(!(Number.isInteger(s) && s >= 1 && s <= 6)) bad.push(`${tp.id}/${k}/${id}: ${s} hiệp`);
        if(!(rest >= 0 && rest <= 300)) bad.push(`${tp.id}/${k}/${id}: nghỉ ${rest}s`);
        if(!String(r).trim()) bad.push(`${tp.id}/${k}/${id}: reps rỗng`);
      }
      expectNone(bad, "Thông số bài bất thường");
    });
    t.test("Khối lượng/nhóm cơ/tuần: không nhóm nào > 30 hiệp; giáo án tạ có cả thân dưới, đẩy và kéo", ()=>{
      const bad = [];
      for(const tp of T){
        const vol = {}; let push = 0, pull = 0, lower = 0, lift = false;
        for(const d of Object.values(tp.days)) for(const [id, s] of d.ex){
          const m = EX[id].muscle; vol[m] = (vol[m] || 0) + s;
          if(PUSH.has(id)) push += s; if(PULL.has(id)) pull += s; if(/Chân|Mông|Đùi/.test(m)) lower += s;
          if(!CARDIO.has(id)) lift = true;
        }
        for(const [m, v] of Object.entries(vol)) if(v > 30) bad.push(`${tp.id}: ${m} ${v} hiệp/tuần`);
        if(lift && tp.id !== "tpl-u-cardio" && !(lower > 0 && push > 0 && pull > 0)) bad.push(`${tp.id}: thiếu nhóm (dưới ${lower}, đẩy ${push}, kéo ${pull})`);
      }
      expectNone(bad, "Phân bổ khối lượng bất thường");
    });
    t.test("Cân bằng đẩy/kéo: hiệp kéo ≥ 0,6 × hiệp đẩy (giáo án có ≥ 6 hiệp đẩy)", ()=>{
      const bad = [];
      for(const tp of T){
        let push = 0, pull = 0;
        for(const d of Object.values(tp.days)) for(const [id, s] of d.ex){ if(PUSH.has(id)) push += s; if(PULL.has(id)) pull += s; }
        if(push >= 6 && pull < 0.6*push) bad.push(`${tp.id}: đẩy ${push} / kéo ${pull}`);
      }
      expectNone(bad, "Lệch đẩy/kéo");
    });
    t.test("tplWeekLabel: đếm đúng buổi tạ/cardio cho giáo án tiêu biểu + tổng = số ngày có bài", ()=>{
      const L = id => app.call("tplWeekLabel", app.ev(`PROGRAM_TEMPLATES.find(x=>x.id==="${id}")`));
      assert.equal(L("tpl-m-fb"), "3 tạ + 1 cardio/tuần");
      assert.equal(L("tpl-m-ulppl"), "5 buổi/tuần");
      assert.equal(L("tpl-u-cardio"), "1 tạ + 4 cardio/tuần");
      assert.equal(L("tpl-f-home"), "3 tạ + 2 cardio/tuần");
      assert.equal(app.call("tplWeekLabel", { days:{ T2:{ ex:[] } } }), "0 buổi/tuần");
      const bad = [];
      for(const tp of T){
        const days = Object.values(tp.days).filter(d=> d.ex.length).length;
        const m = app.call("tplWeekLabel", tp).match(/^(\d+)(?: tạ \+ (\d+) cardio)?/);
        const sum = Number(m[1]) + Number(m[2] || 0);
        if(sum !== days) bad.push(`${tp.id}: nhãn "${app.call("tplWeekLabel", tp)}" nhưng có ${days} ngày tập`);
      }
      expectNone(bad, "Nhãn buổi/tuần sai");
    });
    t.test("perWeek trong dữ liệu khớp nhãn (= số buổi tạ HOẶC = tổng số buổi)", ()=>{
      const bad = [];
      for(const tp of T){
        let lift = 0, cardio = 0;
        Object.values(tp.days).forEach(d=>{ if(!d.ex.length) return; if(d.ex.every(e=> CARDIO.has(e[0]))) cardio++; else lift++; });
        if(tp.perWeek !== lift && tp.perWeek !== lift + cardio) bad.push(`${tp.id}: perWeek ${tp.perWeek} nhưng ${lift} tạ + ${cardio} cardio ("${app.call("tplWeekLabel", tp)}")`);
      }
      expectNone(bad, "perWeek không nhất quán");
    }, { bug:"BUG-17", severity:"Thấp" });
    t.test("tplToPlan: 7 ngày, giữ hiệp/lần/nghỉ, uid duy nhất, không sửa giáo án gốc", ()=>{
      const before = JSON.stringify(app.ev("PROGRAM_TEMPLATES"));
      const bad = [];
      for(const tp of T){
        const p = app.evj(`tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="${tp.id}"))`);
        if(JSON.stringify(Object.keys(p.days)) !== JSON.stringify(DAY_KEYS)) bad.push(`${tp.id}: thiếu ngày`);
        if(p.fromTemplate !== tp.id || p.name !== tp.name || p.builtin !== false || !/^plan_/.test(p.id)) bad.push(`${tp.id}: thông tin plan sai`);
        const uids = [];
        for(const k of DAY_KEYS){
          const src = tp.days[k].ex, items = p.days[k].items;
          if(items.length !== src.length) bad.push(`${tp.id}/${k}: ${items.length}/${src.length} bài`);
          items.forEach((it, i)=>{ const [id, s, r, rest] = src[i]; uids.push(it.uid);
            if(it.exerciseId !== id || it.sets !== s || it.reps !== r || it.restSec !== rest || it.clipId !== null) bad.push(`${tp.id}/${k}/${id}: sai thông số`); });
          if(p.days[k].title !== tp.days[k].title) bad.push(`${tp.id}/${k}: title`);
        }
        if(new Set(uids).size !== uids.length) bad.push(`${tp.id}: trùng uid`);
      }
      expectNone(bad, "tplToPlan lỗi");
      assert.equal(JSON.stringify(app.ev("PROGRAM_TEMPLATES")), before, "PROGRAM_TEMPLATES bị thay đổi");
      assert.equal(app.call("tplToPlan", T[0]).tagline, "NAM · MỚI TẬP");
    });
    t.test("Sửa ngày nghỉ trong plan tạo từ giáo án không làm hỏng TPL_REST dùng chung", ()=>{
      const p = app.ev(`tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-fb"))`);
      p.days.T3.items.push({ uid:"x", exerciseId:"squat" }); p.days.T3.title = "Đã sửa";
      assert.equal(app.ev("TPL_REST.ex.length"), 0); assert.equal(app.ev("TPL_REST.title"), "Nghỉ ngơi");
    });
    t.test("uid(): không trùng khi tạo nhiều bài cùng 1 mili-giây (tplToPlan × 500, đồng hồ đứng yên, RNG cố định)", ()=>{
      app.setNow("2026-01-05T08:00");
      app.run(`(()=>{ let s = 12345; globalThis.__rnd = Math.random; Math.random = ()=>{ s = (s*1103515245 + 12345) % 2147483648; return s/2147483648; }; })()`);
      let dup = 0, plans = 0;
      try{
        for(let i = 0; i < 500; i++){
          const ids = app.evj(`(()=>{ const p = tplToPlan(PROGRAM_TEMPLATES[${i % T.length}]); return Object.values(p.days).flatMap(d=>d.items.map(x=>x.uid)); })()`);
          plans++; if(new Set(ids).size !== ids.length) dup++;
        }
        assert.equal(dup, 0, `${dup}/${plans} lần thêm giáo án sinh uid bài trùng nhau (uid = exerciseId + Date.now() + random 0–999)`);
      } finally { app.run("Math.random = globalThis.__rnd"); app.setNow(null); }
    }, { bug:"BUG-13", severity:"Thấp" });
    t.test("duplicatePlan: bản sao độc lập (sửa bản sao không ảnh hưởng bản gốc)", ()=>{
      app.run(`state.plans["tang-co"] = state.plans["tang-co"] || seedPlansFromPrograms()["tang-co"];`);
      const id = app.ev(`duplicatePlan("tang-co").id`);
      app.run(`state.plans["${id}"].days.T2.items[0].sets = 99; state.plans["${id}"].days.T2.items.pop();`);
      assert.notEqual(app.ev(`state.plans["tang-co"].days.T2.items[0].sets`), 99);
      assert.equal(app.ev(`state.plans["tang-co"].days.T2.items.length`), app.ev(`PROGRAMS["tang-co"].days.T2.exercises.length`));
    });

    t.info("Khối lượng hiệp/nhóm cơ/tuần (hiệp × số buổi)", T.map(tp=>{
      const vol = {}, freq = {};
      for(const d of Object.values(tp.days)){ const seen = new Set(); for(const [id, s] of d.ex){ const m = EX[id].muscle; vol[m] = (vol[m]||0) + s; seen.add(m); } seen.forEach(m=> freq[m] = (freq[m]||0) + 1); }
      return `${tp.id.padEnd(17)} ${Object.entries(vol).sort((a,b)=>b[1]-a[1]).map(([m,v])=> `${m} ${v}×${freq[m]}`).join(", ")}`;
    }));
  },
};

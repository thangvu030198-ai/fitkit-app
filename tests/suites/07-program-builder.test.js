/* =========================================================================
   Kiểm thử Node cho program-builder.js (không cần trình duyệt)
   Chạy:  node tests/suites/07-program-builder.test.js            (từ thư mục FitKit)
          node tests/suites/07-program-builder.test.js --verbose  (in chi tiết từng buổi)
          (tests/run.js tự chạy file này như 1 suite ở tiến trình con)
   Kiểm tra:
   - Bảng phân loại phủ 100% id trong EXERCISES (data.js + templates.js)
   - ≥ 30 tổ hợp đầu vào thiết kế sẵn + 1500 tổ hợp ngẫu nhiên:
     · KHÔNG có bài chống chỉ định với chấn thương đã chọn
     · bài phù hợp dụng cụ & cấp độ, không trùng bài trong 1 buổi
     · bài đa khớp đứng trước bài cô lập
     · thời lượng ước tính ≤ thời gian chọn + 3 phút (buổi tạ ≥ thời gian chọn − 12)
     · khối lượng ≤ 20 hiệp/nhóm cơ/tuần; tỉ lệ kéo/đẩy 0,9–1,5
     · chuỗi "lần" đúng loại (bài đếm lần không bị app hiểu nhầm là bài tính giờ)
     · Đổi bài: chỉ ra bài cùng mẫu vận động, an toàn, đúng dụng cụ
   ========================================================================= */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..", "..");

/* Khi tests/run.js nạp file này (require) → đăng ký 1 suite chạy chính file này ở tiến trình con
   (giữ nguyên kịch bản 438k kiểm tra + đầu ra chi tiết khi chạy trực tiếp bằng node). */
if(require.main !== module && !process.env.PB_STANDALONE){
  const { assert } = require("../lib/framework");
  module.exports = {
    name: "Tạo giáo án riêng (program-builder.js): 38 tổ hợp + fuzz 1500",
    area: "Program builder (program-builder.js, PB.generate / PB.swap)",
    async define(t){
      t.test("PB: phủ 100% EXERCISES, không chống chỉ định, đúng dụng cụ, ≤ 20 hiệp/nhóm cơ, kéo/đẩy 0,9–1,5, đổi bài an toàn", ()=>{
        const r = require("child_process").spawnSync(process.execPath, [__filename], { encoding:"utf8", env: Object.assign({}, process.env, { PB_STANDALONE:"1" }), timeout: 120000 });
        const out = String(r.stdout||"") + String(r.stderr||"");
        const summary = (out.match(/=== KẾT QUẢ:[^\n]*/) || ["(không có dòng KẾT QUẢ)"])[0];
        const fails = out.split("\n").filter(l=> /^\s*✗/.test(l)).slice(0, 12).join("\n      ");
        assert.equal(r.status, 0, summary + (fails ? "\n      " + fails : ""));
        t.info("program-builder", [summary]);
      }, { timeout: 130000 });
    },
  };
  return;
}

const VERBOSE = process.argv.includes("--verbose");

const src = ["data.js", "templates.js", "program-builder.js"].map(f=> fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n;\n")
  + "\n;return { EXERCISES, DAY_KEYS, PB: globalThis.PB };";
const { EXERCISES, DAY_KEYS, PB } = new Function("setTimeout", src)(()=>0);

let fails = 0, checks = 0;
const fail = (msg)=>{ fails++; if(fails <= 40) console.log("  ✗ " + msg); };
const ok = (cond, msg)=>{ checks++; if(!cond) fail(msg); };

/* Bản sao regex app.js isTimedReps/repTop để chắc app hiểu đúng chuỗi "lần" */
function repTop(reps){ const m = String(reps||"").match(/(\d+)\s*[-–]\s*(\d+)/); if(m) return Number(m[2]); const n = String(reps||"").match(/^\s*(\d+)/); return n ? Number(n[1]) : 0; }
function isMaxReps(reps){ return /tối đa|max|amrap/i.test(String(reps||"")); }
function isTimedReps(reps){ const r = String(reps||""); if(isMaxReps(r)) return false; return /giây|phút|(^|\s)\d*\s*m(\s|$|\/)|km|vòng|\d+\s*s(\s|$|\/)/i.test(r) || !repTop(r); }

/* ---------- 1. Phủ bảng phân loại ---------- */
console.log("\n=== 1. BẢNG PHÂN LOẠI MẪU VẬN ĐỘNG / DỤNG CỤ / CHỐNG CHỈ ĐỊNH ===");
const ids = Object.keys(EXERCISES);
const missing = ids.filter(id=> !PB.EX[id]);
const extra = Object.keys(PB.EX).filter(id=> !EXERCISES[id]);
ok(missing.length===0, "Thiếu phân loại cho: " + missing.join(", "));
ok(extra.length===0, "Phân loại thừa (không có trong EXERCISES): " + extra.join(", "));
const byPat = {};
Object.keys(PB.EX).forEach(id=>{ (byPat[PB.EX[id].pat] = byPat[PB.EX[id].pat] || []).push(id); });
console.log(`EXERCISES: ${ids.length} bài · đã phân loại: ${ids.length - missing.length} (${Math.round((ids.length-missing.length)/ids.length*100)}%)`);
Object.keys(byPat).forEach(p=> console.log(`  ${p.padEnd(9)} ${String(byPat[p].length).padStart(2)}: ${byPat[p].join(", ")}`));
const avoidCount = {}; PB.INJ.forEach(j=> avoidCount[j.id] = Object.keys(PB.EX).filter(id=> PB.EX[id].avoid.includes(j.id)).length);
console.log("  Số bài chống chỉ định theo chấn thương:", JSON.stringify(avoidCount));

/* ---------- 2. Bộ kiểm tra 1 giáo án ---------- */
const MK = PB.MUSCLES.map(m=> m[0]);
const ABBR = { chest:"Ng", back:"Lg", shoulders:"Va", quads:"ĐT", hams:"ĐS", glutes:"Mô", biceps:"TT", triceps:"TS", core:"Bụ", calves:"BC" };
const RANK = it=> it.kind==="mob" ? 7 : it.kind==="cardio" ? 6 : (it.role==="cond"||it.fin) ? 5 : it.role==="main" ? 0 : ({ c:1, i:2, core:3 }[PB.EX[it.id].role] ?? 4);
const stat = { underfill:0, sessions:0, strengthSess:0, ratioOut:0, swaps:0 };

function checkProgram(label, A, prog){
  const a = prog.answers, ctx = prog.ctx;
  ok(prog.sessions.length === a.days.length, `${label}: số buổi ${prog.sessions.length} ≠ số ngày ${a.days.length}`);
  prog.sessions.forEach(s=>{
    stat.sessions++;
    ok(a.days.includes(s.day), `${label}: buổi rơi vào ngày không chọn ${s.day}`);
    const seen = new Set();
    let lastRank = -1;
    s.items.forEach(it=>{
      const m = PB.EX[it.id];
      ok(!!EXERCISES[it.id] && !!m, `${label}: bài không tồn tại ${it.id}`);
      if(!m) return;
      const bad = m.avoid.filter(j=> a.inj.includes(j));
      ok(bad.length===0, `${label} ${s.day}: CHỐNG CHỈ ĐỊNH ${it.id} (${bad.join(",")})`);
      ok(PB.feasible(it.id, ctx), `${label} ${s.day}: ${it.id} không hợp dụng cụ/cấp độ`);
      ok(!seen.has(it.id), `${label} ${s.day}: trùng bài ${it.id}`); seen.add(it.id);
      const r = RANK(it);
      ok(r >= lastRank, `${label} ${s.day}: thứ tự sai — ${it.id} (hạng ${r}) sau hạng ${lastRank}`); lastRank = Math.max(lastRank, r);
      ok(Number.isInteger(it.sets) && it.sets >= 1 && it.sets <= 18, `${label}: số hiệp lạ ${it.id} ${it.sets}`);
      ok(it.kind!=="lift" || (it.sets >= 2 && it.sets <= 5), `${label}: ${it.id} ${it.sets} hiệp ngoài 2–5`);
      const timedEx = m.timed || m.dist || it.kind!=="lift";
      ok(isTimedReps(it.reps) === !!timedEx, `${label}: chuỗi lần sai loại "${it.reps}" (${it.id})`);
      ok(!isMaxReps(it.reps), `${label}: chuỗi lần bị app hiểu là "tối đa" (AMRAP): "${it.reps}"`);
      ok(typeof it.restSec==="number" && it.restSec>=0 && it.restSec<=240, `${label}: nghỉ lạ ${it.id} ${it.restSec}`);
    });
    ok(s.est <= a.minutes + 3, `${label} ${s.day}: ${s.title} ~${s.est}′ > ${a.minutes}′+3`);
    if(s.type==="strength"){
      stat.strengthSess++;
      const lifts = s.items.filter(i=> i.kind==="lift" && !i.fin);
      ok(lifts.length >= 3, `${label} ${s.day}: buổi tạ chỉ có ${lifts.length} bài`);
      if(s.est < a.minutes - 12){
        stat.underfill++;
        /* ≥ 2 chấn thương: số bài an toàn có hạn → buổi ngắn hơn là chấp nhận được (chỉ cảnh báo) */
        if(a.inj.length >= 2) stat.underfillOk = (stat.underfillOk||0) + 1;
        else fail(`${label} ${s.day}: buổi tạ ~${s.est}′ quá ngắn so với ${a.minutes}′`);
      }
      MK.forEach(k=>{ const t = s.items.reduce((x,it)=> x + (it.kind==="lift" ? (PB.EX[it.id].m[k]||0)*it.sets : 0), 0); ok(t <= 10 + 1e-9, `${label} ${s.day}: ${k} ${t} hiệp/buổi > 10`); });
    } else {
      ok(s.est >= Math.min(a.minutes, 50) - 6, `${label} ${s.day}: buổi cardio ~${s.est}′ quá ngắn`);
    }
  });
  MK.forEach(k=> ok(prog.volume[k] <= PB.HARD_CAP + 1e-9, `${label}: ${k} ${prog.volume[k]} hiệp/tuần > 20`));
  const pp = prog.pp;
  if(pp.push && pp.pull){
    const r = pp.pull/pp.push;
    /* giáo án rất ít hiệp (≤ 2 hiệp chênh) được miễn vì tỉ lệ bị "lượng tử hoá" */
    if((r < .9 - 1e-9 || r > 1.5 + 1e-9) && Math.abs(pp.pull - pp.push) > 2){ stat.ratioOut++; fail(`${label}: tỉ lệ kéo/đẩy ${r.toFixed(2)} (${pp.pull}/${pp.push}) ngoài 0,9–1,5`); }
  }
  /* Chuyển thành plan của app */
  const plan = PB.toPlan(prog);
  ok(DAY_KEYS.every(k=> plan.days[k] && Array.isArray(plan.days[k].items)), `${label}: plan thiếu ngày`);
  ok(DAY_KEYS.filter(k=> plan.days[k].items.length).length === a.days.length, `${label}: plan sai số ngày tập`);
  DAY_KEYS.forEach(k=> plan.days[k].items.forEach(it=> ok(it.uid && EXERCISES[it.exerciseId] && it.sets>0 && typeof it.reps==="string", `${label}: item plan lỗi ${JSON.stringify(it)}`)));
  ok(typeof plan.name==="string" && plan.fromBuilder===true && plan.builder && plan.builder.answers, `${label}: plan thiếu metadata`);
}
function checkSwaps(label, prog, limit){
  let n = 0;
  prog.sessions.forEach((s, si)=> s.items.forEach((it, ii)=>{
    if(n >= limit) return;
    const alts = PB.alternatives(prog, si, ii);
    alts.forEach(id=>{
      ok(PB.feasible(id, prog.ctx), `${label}: Đổi bài gợi ý ${id} không an toàn/không đủ dụng cụ`);
      if(it.kind==="lift") ok(PB.EX[id].pat === PB.EX[it.id].pat, `${label}: Đổi bài ${it.id}→${id} khác mẫu vận động`);
      ok(!s.items.some(x=> x.id===id), `${label}: Đổi bài gợi ý bài đã có trong buổi ${id}`);
    });
    if(alts.length){
      const before = JSON.stringify(prog.sessions[si].items[ii].id);
      const r = PB.swap(prog, si, ii, alts[0]); n++; stat.swaps++;
      ok(r && r.id===alts[0] && before!==JSON.stringify(r.id), `${label}: swap thất bại`);
      ok(!PB.EX[alts[0]].avoid.some(j=> prog.answers.inj.includes(j)), `${label}: swap ra bài chống chỉ định`);
    }
  }));
}

/* ---------- 3. ≥ 30 tổ hợp thiết kế sẵn ---------- */
const D = n=> PB.DAY_PRESET[n];
const CASES = [
  ["gain","beg",2,30,"gym",[],[],[],"female"],
  ["gain","beg",3,60,"gym",[],[],[],"male"],
  ["gain","int",4,60,"gym",[],["glutes"],[],"female"],
  ["gain","int",4,75,"gym",[],["chest","back"],[],"male"],
  ["gain","adv",5,60,"gym",[],["shoulders"],[],"male"],
  ["gain","adv",6,75,"gym",[],["arms"],[],"male"],
  ["gain","beg",6,45,"gym",[],[],[],null],
  ["gain","int",3,45,"home",["db","bench"],["chest"],[],"male"],
  ["gain","int",4,60,"home",["db","band","pullbar"],[],["shoulder"],"male"],
  ["strength","beg",3,60,"gym",[],[],[],"male"],
  ["strength","int",4,75,"gym",[],[],[],"female"],
  ["strength","adv",5,75,"gym",[],[],["wrist"],"male"],
  ["strength","adv",6,60,"gym",[],[],[],"male"],
  ["strength","int",3,45,"home",["kb"],[],[],null],
  ["lose","beg",3,45,"home",["db"],[],["knee"],"female"],
  ["lose","beg",4,30,"home",[],[],[],"female"],
  ["lose","int",5,60,"gym",[],["glutes","core"],[],"female"],
  ["lose","adv",6,45,"gym",[],[],["lowback"],"male"],
  ["lose","int",2,30,"home",["band"],[],["wrist"],null],
  ["tone","beg",3,45,"gym",[],["glutes"],[],"female"],
  ["tone","int",4,60,"home",["db","kb","band"],["glutes","back"],["knee"],"female"],
  ["tone","adv",5,75,"gym",[],["shoulders","arms"],[],"male"],
  ["tone","beg",2,60,"home",[],["core"],["shoulder"],null],
  ["endurance","beg",3,30,"home",[],[],[],null],
  ["endurance","int",4,45,"gym",[],[],["knee"],"male"],
  ["endurance","adv",6,75,"gym",[],[],[],"female"],
  ["endurance","int",5,60,"home",["rope","db"],[],["lowback"],null],
  ["hybrid","beg",3,60,"gym",[],[],[],"male"],
  ["hybrid","int",4,60,"gym",[],[],["lowback"],"female"],
  ["hybrid","int",5,75,"home",["kb","pullbar","rope"],[],[],"male"],
  ["hybrid","adv",6,60,"gym",[],["back"],["shoulder"],"male"],
  ["gain","int",4,60,"gym",[],[],["lowback","knee","shoulder","wrist"],null],
  ["lose","beg",3,30,"home",[],[],["lowback","knee","shoulder","wrist"],"female"],
  ["gain","adv",5,45,"home",["db","bench","pullbar","band"],["glutes","chest","back"],[],"female"],
  ["strength","int",4,60,"gym",[],[],["knee"],"male"],
  ["tone","int",3,30,"gym",[],["glutes"],["lowback"],"female"],
  ["hybrid","beg",2,45,"home",["kb"],[],["knee"],null],
  ["endurance","beg",6,30,"home",[],[],["knee","wrist"],null],
];
/* một số ca dùng ngày "khó": các ngày liền nhau */
const ODD_DAYS = { 1:["T2","T3","T4"], 9:["T5","T6","T7"], 26:["T2","T3","T4","T5","T6"] };

console.log(`\n=== 2. ${CASES.length} TỔ HỢP THIẾT KẾ SẴN ===`);
console.log("Ký hiệu khối lượng (hiệp/tuần, hiệp phụ = 0,5): " + MK.map(k=> ABBR[k]+"="+PB.MUSCLES.find(m=>m[0]===k)[1]).join(" · "));
CASES.forEach((c, i)=>{
  const [goal, exp, n, minutes, place, equip, focus, inj, gender] = c;
  const A = { goal, exp, days: (ODD_DAYS[i] || D(n)).slice(), minutes, place, equip, focus, inj, gender };
  const label = `#${String(i+1).padStart(2,"0")}`;
  const prog = PB.generate(A);
  checkProgram(label, A, prog);
  const ests = prog.sessions.map(s=> (s.type==="strength" ? "" : "c") + s.est).join("/");
  const vol = MK.filter(k=> prog.volume[k] || prog.ctx.targets[k]).map(k=> `${ABBR[k]}${String(prog.volume[k]).replace(".5","½").replace(".25","¼").replace(".75","¾")}${prog.ctx.fm.has(k) ? "★" : ""}`).join(" ");
  console.log(`${label} ${goal.padEnd(9)} ${exp} ${A.days.length}×${String(minutes).padEnd(2)}′ ${(place==="gym" ? "gym" : "nhà:" + (equip.join("+")||"0")).padEnd(20)} ưu tiên:${(focus.join("+")||"-").padEnd(19)} tránh:${(inj.join("+")||"-").padEnd(28)}`);
  console.log(`     → ${prog.split.name} | phút/buổi ${ests} | kéo:đẩy ${prog.pp.pull}:${prog.pp.push} = ${prog.pp.ratio ?? "—"}`);
  console.log(`     → ${vol}`);
  if(prog.warnings.length) console.log("     ! " + prog.warnings.join(" | "));
  if(VERBOSE) prog.sessions.forEach(s=>{ console.log(`       ${s.day} ${s.title} ~${s.est}′`); s.items.forEach(it=> console.log(`          ${it.id.padEnd(14)} ${String(it.sets).padStart(2)} × ${it.reps}${it.restSec ? " · nghỉ " + it.restSec + "s" : ""}`)); });
  checkSwaps(label, PB.generate(A), 6);
});

/* ---------- 4. Fuzz ngẫu nhiên ---------- */
const N_FUZZ = 1500;
console.log(`\n=== 3. FUZZ ${N_FUZZ} TỔ HỢP NGẪU NHIÊN ===`);
let seed = 20261111;   // mulberry32 — tái lập được
const rnd = ()=>{ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pickN = (arr, k)=>{ const a = arr.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a.slice(0, k); };
const agg = { minVolMajor:[], ratio:[], overTime:0, n:0 };
const fuzzFailsBefore = fails;
for(let i=0; i<N_FUZZ; i++){
  const n = 2 + Math.floor(rnd()*5);
  const A = {
    goal: PB.GOALS[Math.floor(rnd()*PB.GOALS.length)].id,
    exp: PB.EXPS[Math.floor(rnd()*3)].id,
    days: (sel=> DAY_KEYS.filter(k=> sel.includes(k)))(pickN(DAY_KEYS, n)),
    minutes: [30,45,60,75][Math.floor(rnd()*4)],
    place: rnd()<.5 ? "gym" : "home",
    equip: pickN(PB.HOME_EQ.map(e=>e.id), Math.floor(rnd()*4)),
    focus: pickN(PB.FOCUS.map(f=>f.id), Math.floor(rnd()*4)),
    inj: rnd()<.45 ? [] : pickN(PB.INJ.map(j=>j.id), 1 + Math.floor(rnd()*4)),
    gender: [null,"male","female"][Math.floor(rnd()*3)],
  };
  let prog;
  try{ prog = PB.generate(A); }catch(e){ fail(`fuzz ${i}: lỗi ${e.message}\n${e.stack}`); continue; }
  checkProgram(`fuzz${i}`, A, prog);
  if(i % 10 === 0) checkSwaps(`fuzz${i}`, prog, 3);
  agg.n++;
  if(prog.pp.ratio != null) agg.ratio.push(prog.pp.ratio);
}
const q = (arr, p)=>{ const s = arr.slice().sort((a,b)=>a-b); return s[Math.floor((s.length-1)*p)]; };
console.log(`Đã sinh ${agg.n} giáo án · lỗi fuzz: ${fails - fuzzFailsBefore}`);
console.log(`Tỉ lệ kéo/đẩy: min ${q(agg.ratio,0)} · p50 ${q(agg.ratio,.5)} · max ${q(agg.ratio,1)}`);

/* ---------- 5. Kiểm tra chuyên biệt ---------- */
console.log("\n=== 4. KIỂM TRA CHUYÊN BIỆT ===");
{ // Người mới 6 buổi → tối đa 4 buổi tạ
  const p = PB.generate({ goal:"gain", exp:"beg", days:D(6), minutes:60, place:"gym" });
  ok(p.split.s <= 4 && p.split.cd === 2, "Người mới 6 buổi phải có ≤4 buổi tạ");
  console.log(`Người mới 6 buổi: ${p.split.s} tạ + ${p.split.cd} cardio ✓`);
}
{ // Kiểu chia theo số buổi
  const exp = { 2:"fb2", 3:"fb3", 4:"ul4", 5:"ulppl", 6:"ppl6" };
  [2,3,4,5,6].forEach(n=>{ const p = PB.generate({ goal:"gain", exp: n===3 ? "beg" : "adv", days:D(n), minutes:60, place:"gym" }); ok(p.split.key===exp[n], `Tăng cơ ${n} buổi → ${p.split.key} (mong đợi ${exp[n]})`); });
  console.log("Kiểu chia tăng cơ 2→6 buổi: fb2 · fb3 · ul4 · ulppl · ppl6 ✓");
}
{ // Mục tiêu cần cardio có Zone 2 / interval
  ["lose","endurance","hybrid"].forEach(g=>{
    const p = PB.generate({ goal:g, exp:"int", days:D(5), minutes:60, place:"gym" });
    const z2 = p.sessions.some(s=> s.items.some(i=> i.kind==="cardio" && i.ck==="z2"));
    const it = p.sessions.some(s=> s.items.some(i=> i.kind==="cardio" && i.ck==="int"));
    ok(z2 && it, `${g}: thiếu Zone 2 hoặc interval`);
  });
  console.log("Giảm mỡ / sức bền / hybrid đều có Zone 2 + interval ✓");
}
{ // Tránh gối: không có squat tạ đòn, lunge, nhảy dây, chạy
  const p = PB.generate({ goal:"lose", exp:"int", days:D(5), minutes:60, place:"gym", inj:["knee"] });
  const all = p.sessions.flatMap(s=> s.items.map(i=> i.id));
  ["squat","lunges","bulgarian","jumprope","running","legext","burpee"].forEach(id=> ok(!all.includes(id), `Gối: còn ${id}`));
  console.log("Chấn thương gối: không có squat tạ đòn, lunge, leg extension, nhảy dây, chạy, burpee ✓");
}
{ // Không dụng cụ: chỉ bài trọng lượng cơ thể
  const p = PB.generate({ goal:"tone", exp:"beg", days:D(3), minutes:45, place:"home", equip:[] });
  const bad = p.sessions.flatMap(s=> s.items).filter(i=> !PB.EX[i.id].eq.includes("bw"));
  ok(bad.length===0, "Không dụng cụ nhưng có bài cần dụng cụ: " + bad.map(i=>i.id).join(","));
  console.log("Tại nhà không dụng cụ: 100% bài trọng lượng cơ thể ✓");
}
{ // Sức mạnh: bài chính tạ đòn, nghỉ dài
  const p = PB.generate({ goal:"strength", exp:"int", days:D(4), minutes:75, place:"gym" });
  const mains = p.sessions.flatMap(s=> s.items.filter(i=> i.role==="main"));
  ok(mains.filter(i=> ["squat","benchpress","deadlift","overheadpress","frontsquat"].includes(i.id)).length >= 3, "Sức mạnh: thiếu bài thi đấu làm bài chính");
  ok(mains.every(i=> i.restSec >= 120), "Sức mạnh: bài chính nghỉ < 2 phút");
  console.log("Sức mạnh: bài chính = " + mains.map(i=> i.id).join(", ") + " ✓");
}
{ // Swap giữ nguyên số hiệp, đổi chuỗi lần phù hợp bài mới
  const p = PB.generate({ goal:"gain", exp:"int", days:D(4), minutes:60, place:"gym" });
  const si = 0, ii = 0, before = p.sessions[si].items[ii];
  const alts = PB.alternatives(p, si, ii);
  ok(alts.length > 0, "Không có bài thay thế cho bài chính buổi 1");
  const r = PB.swap(p, si, ii, alts[0]);
  ok(r.sets === before.sets && r.role === before.role, "Đổi bài làm thay đổi số hiệp/vai trò");
  console.log(`Đổi bài: ${before.id} → ${r.id} (${alts.length} lựa chọn) ✓`);
}

console.log(`\n=== KẾT QUẢ: ${checks - fails}/${checks} kiểm tra đạt · ${fails} lỗi · ${stat.sessions} buổi (${stat.strengthSess} buổi tạ) · ${stat.swaps} lần đổi bài · buổi tạ ngắn hơn 12′ so với lựa chọn: ${stat.underfill} (do ≥2 chấn thương: ${stat.underfillOk||0}) · tỉ lệ kéo/đẩy lệch: ${stat.ratioOut} ===`);
process.exit(fails ? 1 : 0);

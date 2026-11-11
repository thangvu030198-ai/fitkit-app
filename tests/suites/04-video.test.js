/* Video hướng dẫn miễn phí (freevideos.js) + gắn video vào giáo án (templates.js) + UI video (video.js)
   Fixture media/wger|extra/index.json = bản chụp 11/2026 của https://thangvu030198-ai.github.io/fitkit-app/ */
"use strict";
const { assert, expectNone } = require("../lib/framework");

/* Dụng cụ thật của từng video (gán tay theo tên/nguồn) */
const VIDEO_EQUIP = {
  // YMove
  "Barbell Back Squat":"barbell","Barbell Bench Press":"barbell","Barbell Deadlift":"barbell","Dumbbell Lateral Raise":"dumbbell","Hammer Curls":"dumbbell",
  "Single Arm Dumbbell Row":"dumbbell","Dumbbell Goblet Squat":"dumbbell","Kettlebell Swing":"kettlebell","Kettlebell Push Press":"kettlebell",
  "Kettlebell Romanian Deadlift":"kettlebell","Kettlebell Goblet Squat":"kettlebell","Cable Crossover":"cable","Lying Cable Leg Curl":"cable",
  "Cable Woodchop":"cable","Lat Pulldown":"cable","Seated Cable Row":"cable","Seated Machine Chest Press":"machine","Cable Lateral Raise":"cable",
  "Cable Face Pull":"cable","Cable Bicep Curl":"cable","Cable Tricep Pushdown":"cable","Overhead Cable Tricep Extension":"cable","Leg Extension":"machine",
  "Leg Press":"machine","Glute Kickback Machine":"machine",
  // wger
  "Seated Hip Adduction":"machine","Barbell Lunges Standing":"barbell","Bench Press":"barbell","Benchpress Dumbbells":"dumbbell","Bent-over Lateral Raises":"dumbbell",
  "Biceps Curls With Barbell":"barbell","Biceps Curls With Dumbbell":"dumbbell","Biceps Curl With Cable":"cable","Dips":"bodyweight","Dumbbell Lunges Standing":"dumbbell",
  "Dumbbell Lunges Walking":"dumbbell","Dumbbell Triceps Extension":"dumbbell","Facepull":"cable","Skullcrusher Dumbbells":"dumbbell","Skullcrusher SZ-bar":"barbell",
  "Front Squats":"barbell","Hammercurls on Cable":"cable","Hip Thrust":"barbell","Squats on Multipress":"smith","Lateral Raises":"dumbbell",
  "Lateral Rows on Cable, One Armed":"cable","Leg Curls (laying)":"machine","Leg Curls (sitting)":"machine","Leg Curls (standing)":"machine","Leg Presses (wide)":"machine",
  "Leg Press on Hackenschmidt Machine":"machine","Preacher Curls":"barbell","Pull-ups":"bodyweight","Pull Ups on Machine":"machine","Romanian Deadlift":"barbell",
  "Rowing seated, narrow grip":"cable","Incline Bench Press - Dumbbell":"dumbbell","Incline Bench Press - Barbell":"barbell","Shoulder Press, on Machine":"machine",
  "Shoulder Press, Dumbbells":"dumbbell","Shoulder Shrug":"dumbbell","Shrugs on Multipress":"smith","Single-arm Preacher Curl":"dumbbell","Sitting Calf Raises":"machine",
  "Standing Calf Raises":"machine","Tricep Dumbbell Kickback":"dumbbell","Triceps Extensions on Cable":"cable","Barbell Lunges Walking":"barbell","One Arm Triceps Extensions on Cable":"cable",
};
/* Video bổ sung (media/extra) được chọn tay cho đúng 1 bài (theo key) */
const EXTRA_FOR = { "inclinewalk":["inclinewalk","walking","intervalwalk"], "ai-bentoverrow":["bentoverrow"], "ai-overheadpress":["overheadpress"] };
const extraTargets = file => { const k = file.replace(/\.mp4$/, "").replace(/-\d+$/, ""); return EXTRA_FOR[k] || [k.replace(/^ai-/, "")]; };
/* Dụng cụ chấp nhận được của bài (theo trường equipment tiếng Việt) */
function allowedEquip(eq){
  const s = new Set();
  if(/thanh đòn|đòn ez|tạ đòn/i.test(eq)) s.add("barbell");
  if(/tạ đơn/i.test(eq)) s.add("dumbbell");
  if(/tạ ấm/i.test(eq)) s.add("kettlebell");
  if(/cáp/i.test(eq)) s.add("cable");
  if(/máy smith/i.test(eq)) s.add("smith");
  else if(/máy/i.test(eq)) s.add("machine");
  if(/trọng lượng cơ thể|xà|ghế|bàn|không|thảm/i.test(eq)) s.add("bodyweight");
  return s;
}

module.exports = {
  name: "Video hướng dẫn miễn phí (wger / YMove / extra)",
  area: "Video (freevideos.js, video.js, templates.js tplAttachVideos)",
  async define(t){
    const app = await t.app();
    const ids = app.evj("[...new Set(PROGRAM_TEMPLATES.flatMap(t=>Object.values(t.days).flatMap(d=>d.ex.map(e=>e[0]))))]");
    const EX = app.evj("EXERCISES");
    const find = async (expr)=> JSON.parse(JSON.stringify(await app.ev(`findFreeExerciseVideos(${expr})`)));
    const results = {};
    for(const id of Object.keys(EX)) results[id] = await find(`EXERCISES[${JSON.stringify(id)}]`);

    t.test("Nạp fixture index: wger 46 video, extra 39 video, URL phát qua FV_REPO_CDN, alias viết thường", async ()=>{
      const wg = JSON.parse(JSON.stringify(await app.ev("loadWgerIndex()")));
      const ex = JSON.parse(JSON.stringify(await app.ev("loadExtraIndex()")));
      assert.equal(wg.length, 46); assert.equal(ex.length, 39);
      assert.ok(wg.every(v=> v.provider === "wger" && v.url.startsWith(app.ev("FV_REPO_CDN") + "media/wger/") && /CC BY-SA/.test(v.author)));
      assert.ok(ex.every(v=> v.url.startsWith(app.ev("FV_REPO_CDN") + "media/extra/") && v.alias.every(a=> a === a.toLowerCase())));
      assert.ok(app.fetchLog.some(u=> u.endsWith("media/wger/index.json")) && app.fetchLog.some(u=> u.endsWith("media/extra/index.json")));
      assert.equal(app.fetchLog.filter(u=> u.endsWith("media/wger/index.json")).length, 1, "index phải được cache, chỉ tải 1 lần");
    });
    t.test("fvTokens: tách phần tiếng Anh trong ngoặc, gộp từ đồng nghĩa, bỏ stop-word, tách dụng cụ", ()=>{
      const T = s=> app.evj(`fvTokens(${JSON.stringify(s)})`);
      assert.ok(T("Đẩy ngực nằm (Bench Press)").core.includes("benchpress"));
      assert.deepEqual(T("Barbell Bench Press"), { core:["benchpress"], equip:["barbell"] });
      assert.deepEqual(T("Pull-ups"), { core:["pullup"], equip:[] });
      assert.deepEqual(T("Lat Pulldown").core, ["pulldown"]);
      assert.deepEqual(T("Incline DB Press"), { core:["incline","benchpress"], equip:["dumbbell"] });
      assert.deepEqual(T("Seated Cable Row"), { core:["row"], equip:["cable"] });
      assert.deepEqual(T("Romanian Deadlift").core, ["rdl"]);
      assert.deepEqual(T(""), { core:[], equip:[] });
    });
    t.test("fvScore: khác dụng cụ → 0, thiếu biến thể đặc thù → 0, thiếu từ chính → 0, alias → 60", ()=>{
      const S = (target, name, alias)=> app.call("fvScore", target, { name, alias });
      assert.equal(S("Dumbbell Bench Press dumbbell", "Barbell Bench Press"), 0);
      assert.equal(S("Front Squat barbell", "Barbell Back Squat"), 0);
      assert.equal(S("Squat barbell", "Front Squats"), 0);
      assert.equal(S("Leg Press", "Leg Press on Hackenschmidt Machine"), 0);
      assert.ok(S("Gánh tạ (Back Squat) barbell", "Barbell Back Squat") > 10);
      assert.equal(S("Nâng chân treo xà (Hanging Leg Raise)", "Hanging Leg Raise", ["nâng chân treo xà"]), 60);
      assert.equal(S("x", "", []), 0);
    });
    t.test("fvMatchName: thêm dụng cụ tiếng Anh từ meta.equipment khi tên chưa nói rõ", ()=>{
      assert.equal(app.call("fvMatchName", { name:"Gánh tạ (Back Squat)", equipment:"Thanh đòn" }), "Gánh tạ (Back Squat) barbell");
      assert.equal(app.call("fvMatchName", { name:"Đẩy ngực tạ đơn (Dumbbell Bench Press)", equipment:"Tạ đơn" }), "Đẩy ngực tạ đơn (Dumbbell Bench Press)");
      assert.equal(app.call("fvMatchName", { name:"Cuốn gân kheo (Leg Curl)", equipment:"Máy" }), "Cuốn gân kheo (Leg Curl) machine");
      assert.equal(app.call("fvMatchName", { name:"Kéo xô cáp (Lat Pulldown)", equipment:"Máy cáp" }), "Kéo xô cáp (Lat Pulldown) cable machine");
      assert.equal(app.call("fvMatchName", { name:"Squat máy Smith (Squats on Multipress)", equipment:"Máy Smith" }), "Squat máy Smith (Squats on Multipress)");
      assert.equal(app.call("fvMatchName", "Plank"), "Plank");
    });
    t.test("Video đầu tiên (được gắn vào giáo án) đúng bài cho 24 bài tiêu biểu", ()=>{
      const want = { benchpress:"Barbell Bench Press", squat:"Barbell Back Squat", deadlift:"Barbell Deadlift", dbbench:"Benchpress Dumbbells",
        inclinedb:"Incline Bench Press - Dumbbell", rdl:"Romanian Deadlift", gobletsquat:"Dumbbell Goblet Squat", legpress:"Leg Press", legext:"Leg Extension",
        latpulldown:"Lat Pulldown", cablerow:"Seated Cable Row", dbrow:"Single Arm Dumbbell Row", dbpress:"Shoulder Press, Dumbbells", lateralraise:"Dumbbell Lateral Raise",
        cablelateral:"Cable Lateral Raise", facepull:"Cable Face Pull", tricepsdown:"Cable Tricep Pushdown", ohtriext:"Overhead Cable Tricep Extension",
        bicepcurl:"Biceps Curls With Dumbbell", hipthrust:"Hip Thrust", machinepress:"Seated Machine Chest Press", kbswing:"Kettlebell Swing", pullup:"Pull-ups", legcurl:"Leg Curls (laying)" };
      const bad = Object.entries(want).filter(([id, n])=> (results[id][0]||{}).name !== n).map(([id, n])=> `${id}: "${(results[id][0]||{}).name}" ≠ "${n}"`);
      expectNone(bad, "Video đầu tiên sai");
    });
    t.test("Không khớp sai dụng cụ/bài: mọi video gợi ý (hiện ở dải thumbnail) phải đúng dụng cụ & đúng bài", ()=>{
      const bad = [];
      for(const id of ids){
        const allow = allowedEquip(EX[id].equipment);
        for(const v of results[id]){
          if(v.provider === "YMove" || v.provider === "wger"){
            const eq = VIDEO_EQUIP[v.name];
            if(!eq) bad.push(`${id}: video "${v.name}" chưa gán nhãn dụng cụ trong test`);
            else if(!allow.has(eq)) bad.push(`${id} (${EX[id].equipment}): "${v.name}" [${v.provider}, ${eq}]`);
          } else {
            const file = v.url.split("/").pop();
            if(!extraTargets(file).includes(id)) bad.push(`${id}: video bổ sung "${v.name}" (${file}) làm cho bài khác`);
          }
        }
      }
      expectNone(bad, "Video gợi ý sai dụng cụ/bài");
    }, { bug:"BUG-10", severity:"Thấp" });
    t.test("Không khớp sai biến thể: Nâng bắp chân (hướng dẫn ĐỨNG) → video đứng; Leg Curl (NẰM sấp) → video nằm", ()=>{
      assert.match(EX.calfraise.guide, /Đứng/); assert.match(EX.legcurl.guide, /Nằm sấp/);
      const bad = [];
      if(!/standing/i.test((results.calfraise[0]||{}).name || "")) bad.push(`calfraise → "${(results.calfraise[0]||{}).name}"`);
      if(!/laying|lying/i.test((results.legcurl[0]||{}).name || "")) bad.push(`legcurl → "${(results.legcurl[0]||{}).name}"`);
      expectNone(bad, "Video đầu tiên sai biến thể");
    }, { bug:"BUG-10", severity:"Thấp" });
    t.test("Màn chi tiết bài/buổi tập/thư viện (video.js gọi bằng TÊN) phải cho cùng kết quả như khi gọi bằng meta (có dụng cụ)", async ()=>{
      const bad = [];
      for(const id of ids){
        const byName = await find(`EXERCISES[${JSON.stringify(id)}].name`);
        const a = results[id].map(v=> v.name), b = byName.map(v=> v.name);
        const extra = b.filter(n=> !a.includes(n));
        if(a[0] !== b[0] || extra.length) bad.push(`${id} (${EX[id].equipment}): theo meta "${a[0]}" · theo tên "${b[0]}"${extra.length ? " · thêm sai dụng cụ: " + extra.join(", ") : ""}`);
      }
      expectNone(bad, "mountVideoBlock(…, { name }) mất bộ lọc dụng cụ");
    }, { bug:"BUG-07", severity:"Trung bình" });
    t.test("Số bài trong giáo án chưa có video hướng dẫn không tăng (hiện tại: invertedrow)", ()=>{
      const missing = ids.filter(id=> !results[id].length);
      assert.ok(missing.length <= 1, "Thiếu video: " + missing.join(", "));
    });
    t.test("Mất mạng khi tải index: vẫn trả video YMove, không ném lỗi", async ()=>{
      const off = await t.app({ fixtures:{ "media/wger/index.json":"__offline__", "media/extra/index.json":"__404__" } });
      const r = JSON.parse(JSON.stringify(await off.ev(`findFreeExerciseVideos(EXERCISES.squat)`)));
      assert.equal(r[0].provider, "YMove");
      assert.equal(JSON.parse(JSON.stringify(await off.ev(`findFreeExerciseVideos(EXERCISES.hipthrust)`))).length, 0);
    });
    t.test("Mất mạng lúc đầu rồi có mạng lại → lần tìm sau phải tải lại index (không cache lỗi vĩnh viễn)", async ()=>{
      const a = await t.app({ fixtures:{ "media/wger/index.json":"__offline__", "media/extra/index.json":"__offline__" } });
      await a.ev(`findFreeExerciseVideos(EXERCISES.hipthrust)`);          // mất mạng
      a.fixtures["media/wger/index.json"] = "wger-index.json"; a.fixtures["media/extra/index.json"] = "extra-index.json";   // có mạng lại
      /* integrator (12/11, FIX-core vòng 2 #5): nhớ lỗi 60 s (chống ~55 request index.json khi mất mạng) → thử lại sau ≥ 60 s HOẶC khi có sự kiện "online".
         Test cũ gọi lại NGAY sau lỗi — nay mô phỏng trình duyệt báo có mạng lại (sự kiện "online"). Ca 60 s: suite 67-fix-integrator "I-09". */
      a.run(`(globalThis.__winListeners && globalThis.__winListeners.online || []).forEach(f=> f({ type:"online" }))`);
      const r = JSON.parse(JSON.stringify(await a.ev(`findFreeExerciseVideos(EXERCISES.hipthrust)`)));
      assert.ok(r.length > 0, `vẫn 0 video wger cho Hip Thrust (đã gọi index wger ${a.fetchLog.filter(u=>u.endsWith("wger/index.json")).length} lần)`);
    }, { bug:"BUG-15", severity:"Thấp" });
    t.test("tplAttachVideos: gắn video cho mọi bài có video, stock đủ provider/url/license/duration", async ()=>{
      const res = JSON.parse(JSON.stringify(await app.ev(`(async()=>{ const p = tplToPlan(PROGRAM_TEMPLATES.find(x=>x.id==="tpl-m-ul")); const r = await tplAttachVideos(p); globalThis.__p = p; return r; })()`)));
      assert.equal(res.total, 25); assert.equal(res.withVid, 25);
      const items = app.evj("Object.values(__p.days).flatMap(d=>d.items)");
      const bad = items.filter(it=> !it.stock || !it.stock.url || !it.stock.provider || it.stock.license === undefined || !(it.stock.duration > 0)).map(it=> it.exerciseId);
      expectNone(bad, "Bài thiếu stock");
    });
    t.test("refreshPlanVideos: bỏ video Pixabay cũ không đúng bài, thay bằng video hướng dẫn; giữ video người dùng tự quay", async ()=>{
      app.run(`state.plans.__v = { id:"__v", name:"v", days:{ T2:{ title:"x", items:[
        { uid:"a", exerciseId:"squat", stock:{ provider:"Pixabay", url:"https://pixabay/x.mp4" } },
        { uid:"b", exerciseId:"invertedrow", stock:{ provider:"Pixabay", url:"https://pixabay/y.mp4" } },
        { uid:"c", exerciseId:"benchpress", clipId:"clip1", stock:{ provider:"Pixabay", url:"https://pixabay/z.mp4" } } ] },
        T3:{items:[]},T4:{items:[]},T5:{items:[]},T6:{items:[]},T7:{items:[]},CN:{items:[]} } };`);
      await app.ev("refreshPlanVideos(true)");
      const it = app.evj("state.plans.__v.days.T2.items");
      assert.equal(it[0].stock.provider, "YMove");
      assert.equal(it[1].stock, undefined);
      assert.equal(it[2].stock.provider, "Pixabay");
      app.run("delete state.plans.__v");
    });
    t.test("searchPixabay: bỏ qua kết quả không có file video thay vì ném TypeError", async ()=>{
      const a = await t.app({ fixtures:{ "pixabay.com/api/videos/":"pixabay-videos.json" } });
      let r, err = null;
      try{ r = JSON.parse(JSON.stringify(await a.ev(`searchPixabay("walking", "k")`))); }catch(e){ err = e; }
      assert.ok(!err, "ném lỗi: " + (err && err.message));
      assert.equal(r.length, 1); assert.equal(r[0].url, "https://cdn.pixabay.com/video/101-tiny.mp4");
    }, { bug:"BUG-19", severity:"Thấp" });

    t.info("Bài trong giáo án CHƯA có video hướng dẫn", ids.filter(id=> !results[id].length).map(id=> `${id} — ${EX[id].name} (${EX[id].equipment})`));
    t.info("Video đầu tiên của mọi bài trong giáo án", ids.map(id=> `${id.padEnd(15)} → ${results[id].slice(0,3).map(v=> `${v.provider}: ${v.name}`).join(" | ") || "(không có)"}`));
  },
};

/* =========================================================================
   FIT KIT — Video HƯỚNG DẪN BÀI TẬP miễn phí, dùng thương mại được
   1. YMove — 25 video quay thật, miễn phí thương mại, BẮT BUỘC ghi
      "Exercise video by Your Move" + link ymove.app (https://ymove.app/free-exercise-videos)
   2. wger.de — video bài tập của cộng đồng mã nguồn mở, giấy phép CC BY-SA 4.0
      (đã nén nhẹ bằng workflow "Media — video wger", lưu trong repo, phát qua jsDelivr)
   Khi mở 1 bài, app ưu tiên video khớp tên bài từ 2 nguồn này; chỉ khi không có mới
   dùng kho Pixabay làm video tham khảo.
   ========================================================================= */
const FV_REPO_CDN = "https://cdn.jsdelivr.net/gh/thangvu030198-ai/fitkit-app@main/";

const YMOVE_FREE = [
  ["fd0eaa34-d14b-4421-b41c-1669f93253b3","Barbell Back Squat"],
  ["dd7e706c-2086-4f4b-867f-d7fece2f720d","Barbell Bench Press"],
  ["b59952ca-1551-4c07-835d-ab78bfe9953c","Barbell Deadlift"],
  ["a16f0235-20eb-4306-b9cc-c01ae51b3b9b","Dumbbell Lateral Raise"],
  ["b11e6c6f-b2e8-44ca-95dc-adf0dcd34426","Hammer Curls"],
  ["d3fece95-c7e2-4794-ba8f-65a5b3e30a28","Single Arm Dumbbell Row"],
  ["a2a797d0-f6f6-436e-8616-6c1d93e73d67","Dumbbell Goblet Squat"],
  ["13263f92-5fe2-4d92-bec0-808f8b315620","Kettlebell Swing"],
  ["3880aaa4-e1c0-4153-95d0-da44ea01e099","Kettlebell Push Press"],
  ["e7175536-9d7d-4f5d-8d49-26c3411eac80","Kettlebell Romanian Deadlift"],
  ["198d4a7d-bc23-41f8-ad67-4fe9ab876b89","Kettlebell Goblet Squat"],
  ["e2b1d801-055a-4dc5-ad6e-486e3dbfcfb7","Cable Crossover"],
  ["856b4128-b57d-4b08-b0de-7f19b4553020","Lying Cable Leg Curl"],
  ["02f17b45-d37d-4452-9082-4679e06f8c03","Cable Woodchop"],
  ["5971eaa2-5264-49cc-99c2-1310305c5342","Lat Pulldown"],
  ["77976f52-b13a-4fd0-addf-f4404e3a8e95","Seated Cable Row"],
  ["20cc4825-dd52-4887-99db-c492546741dc","Seated Machine Chest Press"],
  ["710d4aa4-e4ea-4fad-8930-a7b9bf582cae","Cable Lateral Raise"],
  ["d9b9cf47-c5ff-4672-b8a8-2fe5f4845231","Cable Face Pull"],
  ["f32940f7-7da6-4741-a72f-13e52c56a79c","Cable Bicep Curl"],
  ["3875dae4-14a6-4533-84d3-ef9acbadbaea","Cable Tricep Pushdown"],
  ["a1c3384e-62db-4595-9b97-df2e7f131234","Overhead Cable Tricep Extension"],
  ["af0c3d19-5ee2-4a19-8688-f8504bb33e3c","Leg Extension"],
  ["d0bc669e-0d78-46f0-95f1-86503ab746e1","Leg Press"],
  ["5611abf4-57f7-4153-b29d-a17cd7e2907d","Glute Kickback Machine"],
].map(([id, name])=>({
  provider:"YMove", name, url:`https://ymove.app/api/free/${id}`, thumb:`https://ymove.app/api/free/${id}?type=thumbnail`,
  author:"Exercise video by Your Move", authorUrl:"https://ymove.app/exercise-api", pageUrl:"https://ymove.app/free-exercise-videos",
  license:"YMove free licence", tags:"", duration:15, portrait:true,
}));

/* 3. Video bổ sung chọn tay (Pexels License / Wikimedia Commons CC BY, CC BY-SA, Public domain) */
let _extraIdx = null, _extraLoading = null;
async function loadExtraIndex(){
  if(_extraIdx) return _extraIdx;
  if(_extraLoading) return _extraLoading;
  _extraLoading = (async ()=>{
    try{
      const r = await fetch(FV_REPO_CDN + "media/extra/index.json");
      if(!r.ok) throw 0;
      _extraIdx = (await r.json()).map(x=>({
        provider:x.provider, name:x.name, alias:(x.alias||[]).map(a=>a.toLowerCase()), url:FV_REPO_CDN+"media/extra/"+x.file, thumb:FV_REPO_CDN+"media/extra/"+x.thumb,
        author:x.author, authorUrl:x.licenseUrl, pageUrl:x.source, license:x.license, duration:x.duration, tags:"",
      }));
    }catch(e){ _extraIdx = []; }
    return _extraIdx;
  })();
  return _extraLoading;
}

let _wgerIdx = null, _wgerLoading = null;
async function loadWgerIndex(){
  if(_wgerIdx) return _wgerIdx;
  if(_wgerLoading) return _wgerLoading;
  _wgerLoading = (async ()=>{
    try{
      const r = await fetch(FV_REPO_CDN + "media/wger/index.json");
      if(!r.ok) throw 0;
      const arr = await r.json();
      _wgerIdx = arr.map(x=>({
        provider:"wger", name:x.name, url:FV_REPO_CDN+"media/wger/"+x.file, thumb:FV_REPO_CDN+"media/wger/"+x.thumb,
        author:`${x.author} · ${x.license}`, authorUrl:x.licenseUrl, pageUrl:x.source, license:x.license, duration:x.duration, tags:"",
      }));
    }catch(e){ _wgerIdx = []; }
    return _wgerIdx;
  })();
  return _wgerLoading;
}

/* ---- So khớp tên bài ---- */
const FV_SYN = [
  [/rowing seated|seated rowing/g,"row"], [/incline (db|dumbbells?) press/g,"incline dumbbell benchpress"],
  [/bench ?press|benchpress/g,"benchpress"], [/pull[- ]?ups?|chin[- ]?ups?/g,"pullup"], [/push[- ]?ups?/g,"pushup"],
  [/lat ?pull ?downs?|pulldowns?/g,"pulldown"], [/sit[- ]?ups?/g,"situp"], [/face ?pulls?|facepull/g,"facepull"],
  [/push ?downs?/g,"pushdown"], [/skull ?crushers?/g,"skullcrusher"], [/hammer ?curls?|hammercurls/g,"hammercurl"],
  [/leg ?press(es)?/g,"legpress"], [/leg ?curls?/g,"legcurl"], [/leg ?extensions?/g,"legextension"],
  [/hip ?thrusts?/g,"hipthrust"], [/calf ?raises?/g,"calfraise"], [/lateral ?raises?|side ?raises?/g,"lateralraise"],
  [/romanian ?deadlifts?|\brdl\b/g,"rdl"], [/goblet ?squats?/g,"gobletsquat"], [/front ?squats?/g,"frontsquat"],
  [/kettlebell ?swings?/g,"kbswing"], [/cable ?crossovers?|cable ?fl(y|ies)/g,"cablefly"], [/wood ?chops?/g,"woodchop"],
  [/shoulder ?press|overhead ?press|military ?press/g,"ohpress"], [/push ?press/g,"pushpress"], [/kick ?backs?/g,"kickback"],
  [/triceps?/g,"tricep"], [/biceps?/g,"bicep"], [/curls/g,"curl"], [/lunges/g,"lunge"], [/squats/g,"squat"], [/shrugs/g,"shrug"],
  [/deadlifts/g,"deadlift"], [/rows/g,"row"], [/\bdips\b/g,"dip"], [/\bdb\b/g,"dumbbell"], [/\bbb\b/g,"barbell"], [/\bkb\b/g,"kettlebell"], [/dumbbells/g,"dumbbell"], [/raises/g,"raise"], [/extensions/g,"extension"],
];
const FV_EQUIP = ["barbell","dumbbell","cable","machine","kettlebell","multipress","smith"];
const FV_STOP = new Set(["the","with","on","and","a","of","exercise","standing","sitting","seated","laying","lying","one","arm","single","two","close","wide","grip","narrow","medium","legs","apart","mid","high","to","low","v","bar","sz","rope","back"]);
const FV_MOD = new Set(["frontsquat","gobletsquat","rdl","bodyweight","inverted","incline","decline","bulgarian","split","hack","sumo","overhead","preacher","hipthrust","pushpress","supported"]);
function fvTokens(name){
  let s = " " + String(name||"").toLowerCase().replace(/\(.*?\)/g, m=> " "+m.slice(1,-1)+" ").replace(/[-_,/]+/g," ") + " ";
  FV_SYN.forEach(([re, rep])=>{ s = s.replace(re, " "+rep+" "); });
  const words = s.split(/\s+/).filter(w=> w && !FV_STOP.has(w));
  return { core: words.filter(w=> !FV_EQUIP.includes(w)), equip: words.filter(w=> FV_EQUIP.includes(w)) };
}
function fvScore(target, cand){
  if(cand.alias && cand.alias.length){ const low = String(target||"").toLowerCase(); if(cand.alias.some(a=> a && low.includes(a))) return 60; }
  const t = fvTokens(target), c = fvTokens(cand.name);
  if(!c.core.length) return 0;
  const hits = c.core.filter(w=> t.core.includes(w)), hit = hits.length;
  if(hit < c.core.length) return 0;                 // mọi từ chính của video phải có trong tên bài
  const cAll = c.core.concat(c.equip);
  if(t.core.some(w=> FV_MOD.has(w) && !cAll.includes(w))) return 0;   // bài có biến thể đặc thù (Front, Goblet, RDL…) → video phải đúng biến thể
  let s = 10 + hits.reduce((a,w)=> a + Math.min(w.length,12)/2, 0) - (t.core.length - hit)*0.5;   // từ ghép dài (gobletsquat) khớp → điểm cao hơn
  if(c.equip.length && t.equip.length) s += c.equip.some(e=> t.equip.includes(e)) ? 4 : -6;
  return s;
}
/* Tên dùng để so khớp: ưu tiên phần tiếng Anh trong ngoặc "Đẩy ngực (Bench Press)" */
function fvMatchName(meta){
  return String(meta && meta.name || meta || "");   // fvTokens tự tách phần trong ngoặc
}
async function findFreeExerciseVideos(meta){
  const target = fvMatchName(meta);
  const [wg, ex] = await Promise.all([loadWgerIndex(), loadExtraIndex()]);
  const pool = [...YMOVE_FREE, ...wg, ...ex];
  return pool.map(v=>({ v, s: fvScore(target, v) })).filter(x=> x.s > 0).sort((a,b)=> b.s-a.s).map(x=> x.v);
}

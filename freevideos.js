/* =========================================================================
   TapEasy — Video HƯỚNG DẪN BÀI TẬP miễn phí, dùng thương mại được
   1. YMove — 25 video quay thật, miễn phí thương mại, BẮT BUỘC ghi
      "Exercise video by Your Move" + link ymove.app (https://ymove.app/free-exercise-videos)
   2. wger.de — video bài tập của cộng đồng mã nguồn mở, giấy phép CC BY-SA 4.0
      (đã nén nhẹ bằng workflow "Media — video wger", lưu trong repo, phát qua jsDelivr)
   Khi mở 1 bài, app ưu tiên video khớp tên bài từ 2 nguồn này; chỉ khi không có mới
   dùng kho Pixabay làm video tham khảo.
   ========================================================================= */
/* Media lưu trong repo, phát qua GitHub Pages (cập nhật sau ~1–2 phút, không bị cache lâu như jsDelivr @main) */
const FV_REPO_CDN = "https://thangvu030198-ai.github.io/fitkit-app/";

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

/* integrator (FIX-core vòng 2 #5): mất mạng → mỗi bài trong giáo án gọi lại loadWgerIndex/loadExtraIndex → ~55 request index.json / 10 s.
   NHỚ LỖI + lùi dần: sau 1 lần lỗi KHÔNG tải lại trước 60 s (lỗi liên tiếp 60 → 120 → 240 s … ≤ 10 phút); trình duyệt báo có mạng lại
   (sự kiện "online") → xoá nhớ lỗi, lần sau tải ngay. navigator.onLine === false → không gửi request. Vẫn không cache mảng rỗng (BUG-15). */
const FV_IDX_FAIL = { extra:{ at:0, n:0 }, wger:{ at:0, n:0 } }, FV_BACKOFF_MIN = 60e3, FV_BACKOFF_MAX = 600e3;
function fvIdxWait(k){ const f = FV_IDX_FAIL[k]; return f && f.n ? Math.min(FV_BACKOFF_MAX, FV_BACKOFF_MIN * Math.pow(2, f.n - 1)) : 0; }
function fvIdxBlocked(k){
  try{ if(typeof navigator !== "undefined" && navigator && navigator.onLine === false) return true; }catch(e){}
  const f = FV_IDX_FAIL[k]; return !!(f && f.n && Date.now() - f.at < fvIdxWait(k));
}
function fvIdxFail(k){ const f = FV_IDX_FAIL[k]; f.n = Math.min(f.n + 1, 8); f.at = Date.now(); }
function fvIdxOk(k){ const f = FV_IDX_FAIL[k]; f.n = 0; f.at = 0; }
try{ if(typeof window !== "undefined" && typeof window.addEventListener === "function") window.addEventListener("online", ()=>{ fvIdxOk("extra"); fvIdxOk("wger"); }); }catch(e){}

/* 3. Video bổ sung chọn tay (Pexels License / Wikimedia Commons CC BY, CC BY-SA, Public domain) */
let _extraIdx = null, _extraLoading = null;
/* Lỗi mạng: KHÔNG ghi đè cache bằng mảng rỗng (BUG-15) → lần tìm sau tự tải lại index */
async function loadExtraIndex(){
  if(_extraIdx) return _extraIdx;
  if(_extraLoading) return _extraLoading;
  if(fvIdxBlocked("extra")) return [];
  _extraLoading = (async ()=>{
    try{
      const r = await fetch(FV_REPO_CDN + "media/extra/index.json");
      if(!r.ok) throw new Error("HTTP " + r.status);
      _extraIdx = (await r.json()).map(x=>({
        provider:x.provider, name:x.name, alias:(x.alias||[]).map(a=>String(a).toLowerCase()), url:FV_REPO_CDN+"media/extra/"+x.file, thumb:FV_REPO_CDN+"media/extra/"+x.thumb,
        author:x.author, authorUrl:x.licenseUrl, pageUrl:x.source, license:x.license, duration:x.duration, tags:"",
      }));
      fvIdxOk("extra");
      return _extraIdx;
    }catch(e){ fvIdxFail("extra"); return []; }
    finally{ _extraLoading = null; }
  })();
  return _extraLoading;
}

/* wger không ghi dụng cụ → gán tay theo tên video (BUG-10) để lọc đúng dụng cụ */
const WGER_EQUIP = {
  "Seated Hip Adduction":"machine", "Barbell Lunges Standing":"barbell", "Barbell Lunges Walking":"barbell", "Bench Press":"barbell",
  "Benchpress Dumbbells":"dumbbell", "Bent-over Lateral Raises":"dumbbell", "Biceps Curls With Barbell":"barbell", "Biceps Curls With Dumbbell":"dumbbell",
  "Biceps Curl With Cable":"cable", "Dips":"bodyweight", "Dumbbell Lunges Standing":"dumbbell", "Dumbbell Lunges Walking":"dumbbell",
  "Dumbbell Triceps Extension":"dumbbell", "Facepull":"cable", "Skullcrusher Dumbbells":"dumbbell", "Skullcrusher SZ-bar":"barbell",
  "Front Squats":"barbell", "Hammer Curls":"dumbbell", "Hammercurls on Cable":"cable", "Hip Thrust":"barbell", "Squats on Multipress":"smith",
  "Lateral Raises":"dumbbell", "Lateral Rows on Cable, One Armed":"cable", "Leg Curls (laying)":"machine", "Leg Curls (sitting)":"machine",
  "Leg Curls (standing)":"machine", "Leg Press":"machine", "Leg Presses (wide)":"machine", "Leg Press on Hackenschmidt Machine":"machine",
  "Preacher Curls":"barbell", "Pull-ups":"bodyweight", "Pull Ups on Machine":"machine", "Romanian Deadlift":"barbell",
  "Rowing seated, narrow grip":"cable", "Incline Bench Press - Dumbbell":"dumbbell", "Incline Bench Press - Barbell":"barbell",
  "Shoulder Press, on Machine":"machine", "Shoulder Press, Dumbbells":"dumbbell", "Shoulder Shrug":"dumbbell", "Shrugs on Multipress":"smith",
  "Single-arm Preacher Curl":"dumbbell", "Sitting Calf Raises":"machine", "Standing Calf Raises":"machine", "Tricep Dumbbell Kickback":"dumbbell",
  "Triceps Extensions on Cable":"cable", "One Arm Triceps Extensions on Cable":"cable",
};
let _wgerIdx = null, _wgerLoading = null;
async function loadWgerIndex(){
  if(_wgerIdx) return _wgerIdx;
  if(_wgerLoading) return _wgerLoading;
  if(fvIdxBlocked("wger")) return [];
  _wgerLoading = (async ()=>{
    try{
      const r = await fetch(FV_REPO_CDN + "media/wger/index.json");
      if(!r.ok) throw new Error("HTTP " + r.status);
      const arr = await r.json();
      _wgerIdx = arr.map(x=>({
        provider:"wger", name:x.name, equip: x.equip || WGER_EQUIP[x.name] || "", url:FV_REPO_CDN+"media/wger/"+x.file, thumb:FV_REPO_CDN+"media/wger/"+x.thumb,
        author:`${x.author} · ${x.license}`, authorUrl:x.licenseUrl, pageUrl:x.source, license:x.license, duration:x.duration, tags:"",
      }));
      fvIdxOk("wger");
      return _wgerIdx;
    }catch(e){ fvIdxFail("wger"); return []; }
    finally{ _wgerLoading = null; }
  })();
  return _wgerLoading;
}

/** integrator: cả 2 index đã tải được chưa (tải nếu cần — tôn trọng nhớ lỗi) → refreshPlanVideos chỉ chạy khi có đủ dữ liệu */
async function fvIndexesReady(){ await Promise.all([loadWgerIndex(), loadExtraIndex()]); return !!(_wgerIdx && _extraIdx); }

/* ---- So khớp tên bài ---- */
const FV_SYN = [
  /* Kéo người dưới xà thấp: cùng mẫu chuyển động với Australian pull-up / body row / TRX (suspension) row.
     Gom về 1 token "invertedrow" → chỉ khớp video ĐÚNG động tác này (không ăn theo "row"/"rowing"/"pull-up"). */
  [/inverted ?rows?|australian ?pull[- ]?ups?|australian ?chin[- ]?ups?|body ?weight ?rows?|bodyweight ?rows?|body ?rows?|trx ?rows?|suspension ?(trainer )?rows?|ring ?rows?|kéo người dưới xà( thấp)?/g,"invertedrow"],
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
const FV_MOD = new Set(["side","frontsquat","gobletsquat","rdl","bodyweight","inverted","incline","decline","bulgarian","split","hack","sumo","overhead","preacher","hipthrust","pushpress","supported","bent"]);
/* Hiệu năng (QU-02): tách từ là chuỗi ~40 regex — nhớ kết quả theo tên (mỗi lần mở bài/giáo án gọi lại cho ~100 video) */
const _fvTokCache = new Map();
function fvTokens(name){
  const key = String(name||"");
  const hit = _fvTokCache.get(key); if(hit) return { core: hit.core.slice(), equip: hit.equip.slice() };
  const r = fvTokensRaw(key);
  if(_fvTokCache.size > 2000) _fvTokCache.clear();
  _fvTokCache.set(key, r);
  return { core: r.core.slice(), equip: r.equip.slice() };
}
function fvTokensRaw(name){
  let s = " " + String(name||"").toLowerCase().replace(/\(.*?\)/g, m=> " "+m.slice(1,-1)+" ").replace(/[-_,/]+/g," ") + " ";
  FV_SYN.forEach(([re, rep])=>{ s = s.replace(re, " "+rep+" "); });
  const words = s.split(/\s+/).filter(w=> w && !FV_STOP.has(w));
  return { core: words.filter(w=> !FV_EQUIP.includes(w)), equip: words.filter(w=> FV_EQUIP.includes(w)) };
}
function fvScore(target, cand){
  if(cand.alias && cand.alias.length){ const low = String(target||"").toLowerCase(); if(cand.alias.some(a=> a && low.includes(a))) return 60; }
  const t = fvTokens(target), c = fvTokens(cand.name);
  if(cand.equip && cand.equip !== "bodyweight" && !c.equip.includes(cand.equip)) c.equip.push(cand.equip);
  if(!c.core.length) return 0;
  const hits = c.core.filter(w=> t.core.includes(w)), hit = hits.length;
  if(hit < c.core.length) return 0;                 // mọi từ chính của video phải có trong tên bài
  const cAll = c.core.concat(c.equip);
  if(t.core.some(w=> FV_MOD.has(w) && !cAll.includes(w))) return 0;   // bài có biến thể đặc thù (Front, Goblet, RDL…) → video phải đúng biến thể
  let s = 10 + hits.reduce((a,w)=> a + Math.min(w.length,12)/2, 0) - (t.core.length - hit)*0.5;   // từ ghép dài (gobletsquat) khớp → điểm cao hơn
  if(c.equip.length && t.equip.length){ if(!c.equip.some(e=> t.equip.includes(e))) return 0; s += 4; }   // khác dụng cụ → không dùng video
  return s;
}
/* Tên dùng để so khớp: ưu tiên phần tiếng Anh trong ngoặc "Đẩy ngực (Bench Press)" */
const FV_EQUIP_VI = [[/tạ đơn|\bdumbbells?\b/i,"dumbbell"],[/thanh đòn|đòn ez|tạ đòn|\bbarbell\b|e-z curl/i,"barbell"],[/cáp|\bcable\b/i,"cable"],[/máy smith|\bsmith\b/i,"smith"],[/\bmáy\b|^machine$/i,"machine"],[/tạ ấm|kettlebells?/i,"kettlebell"]];
/* Gọi bằng TÊN (chuỗi) → tra lại bài trong EXERCISES / bài tuỳ chỉnh để không mất dụng cụ (BUG-07) */
function fvResolveMeta(meta){
  if(meta && typeof meta === "object") return meta;
  const name = String(meta || "");
  if(!name) return null;
  try{
    if(typeof EXERCISES !== "undefined"){
      for(const id in EXERCISES){ const e = EXERCISES[id]; if(e && e.name === name) return e; }
    }
  }catch(e){}
  return null;
}
function fvMatchName(meta){
  const m = fvResolveMeta(meta);
  const name = String(m && m.name || meta || "");   // fvTokens tự tách phần trong ngoặc
  const eq = m && m.equipment ? FV_EQUIP_VI.filter(([re])=> re.test(m.equipment)).map(([,en])=>en) : [];
  // Thêm dụng cụ (theo tiếng Anh) nếu tên bài chưa nói rõ → loại video khác dụng cụ
  return eq.length && !/dumbbell|barbell|cable|machine|kettlebell|smith|\bdb\b|\bbb\b/i.test(name) ? name + " " + eq.join(" ") : name;
}
/* Bài chỉ dùng trọng lượng cơ thể (xà, thảm, ghế…) → không lấy video máy/tạ (vd Pull-up ≠ "Pull Ups on Machine") */
function fvBodyweightOnly(m){
  const eq = String(m && m.equipment || "");
  if(!eq) return false;
  return /trọng lượng cơ thể|xà|thảm|ghế|bàn|^không$|body only/i.test(eq) && !FV_EQUIP_VI.some(([re])=> re.test(eq));
}
/* Tư thế (đứng / ngồi / nằm) — tên video wger ghi "Sitting/Standing/Laying"; bài của app ghi trong hướng dẫn */
function fvPosture(text){
  const s = String(text || "").toLowerCase();
  if(/\b(sitting|seated)\b/.test(s)) return "seated";
  if(/\b(laying|lying)\b/.test(s)) return "lying";
  if(/\bstanding\b/.test(s)) return "standing";
  return "";
}
function fvTargetPosture(m, target){
  const p = fvPosture(target); if(p) return p;
  const g = String(m && m.guide || "").trim().toLowerCase();
  if(/^(đứng)/.test(g)) return "standing";
  if(/^(ngồi)/.test(g)) return "seated";
  if(/^(nằm)/.test(g)) return "lying";
  return "";
}
const FV_WEIGHTED = ["barbell","dumbbell","cable","machine","kettlebell","multipress","smith"];
async function findFreeExerciseVideos(meta){
  const m = fvResolveMeta(meta);
  const target = fvMatchName(m || meta);
  const bwOnly = fvBodyweightOnly(m);
  const posture = fvTargetPosture(m, target);
  const [wg, ex] = await Promise.all([loadWgerIndex(), loadExtraIndex()]);
  const pool = [...YMOVE_FREE, ...wg, ...ex];
  return pool.map(v=>{
    let s = fvScore(target, v);
    if(s > 0 && bwOnly && s < 60){
      const ce = fvTokens(v.name).equip.concat(v.equip && v.equip !== "bodyweight" ? [v.equip] : []);
      if(ce.some(e=> FV_WEIGHTED.includes(e))) s = 0;
    }
    if(s > 0 && posture && s < 60){ const vp = fvPosture(v.name); if(vp) s += vp === posture ? 3 : -6; }
    return { v, s };
  }).filter(x=> x.s > 0).sort((a,b)=> b.s-a.s).map(x=> x.v);
}

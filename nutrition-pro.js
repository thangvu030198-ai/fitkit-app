/* =========================================================================
   TapEasy — nutrition-pro.js · Dinh dưỡng Pro
   1. Thuật toán thực đơn mới (ghi đè buildDayPlan): bám calo ±5 %, đạm & tinh bột ±15 %,
      chất xơ 14 g/1.000 kcal; món chính chỉ phóng 0,6–1,3 lần, phần thiếu bù bằng "món phụ"
      thật (trứng, sữa chua, cơm, chuối, hạt…), không bữa nào quá 700 g.
   2. Công tắc "Thuần chay" · "Đổi món" từng bữa (giữ calo) · Danh sách đi chợ 7 ngày
   3. Thêm món: Gần đây & Yêu thích · chọn đơn vị (chén, quả, muỗng…) · Tự tạo món
   4. Chất xơ trên thẻ macro + mục tiêu 14 g/1.000 kcal (Institute of Medicine, 2005)
   Nạp SAU pt.js (cần meals-extra.js đã nạp trước để có đủ thực phẩm & món).
   ========================================================================= */
(function(){
"use strict";
const HAS_DOM = typeof document !== "undefined" && typeof document.getElementById === "function";
const G = typeof window !== "undefined" ? window : globalThis;
if(typeof FOODS === "undefined" || typeof RECIPES === "undefined") return;

/* =====================================================================
   1. TIỆN ÍCH DỮ LIỆU
   ===================================================================== */
let _fm = null, _fmN = -1;
function food(id){
  if(_fmN !== FOODS.length || !_fm){ _fm = new Map(); FOODS.forEach(f=> _fm.set(f.id, f)); _fmN = FOODS.length; }
  return _fm.get(id);
}
const r1 = n => Math.round(n*10)/10;
function itemsMacros(items){
  const o = { k:0, p:0, c:0, f:0, fb:0, g:0 };
  /* R3-NUT-06: dòng hỏng (không phải mảng), gam âm / NaN / chuỗi (bộ nhớ thực đơn, sao lưu) → bỏ qua, không ném lỗi / ra NaN */
  (Array.isArray(items) ? items : []).forEach(row=>{
    if(!Array.isArray(row)) return;
    const id = row[0], g = Number(row[1]);
    const f = food(id); if(!f || !Number.isFinite(g) || g <= 0) return;
    const k = g/100;
    o.k += f.kcal*k; o.p += f.protein*k; o.c += f.carbs*k; o.f += f.fat*k; o.fb += (f.fiber||0)*k; o.g += g;
  });
  return o;
}
const _baseCache = new WeakMap();
function recipeBase(r){
  let b = _baseCache.get(r);
  if(!b){ b = itemsMacros(r.items); _baseCache.set(r, b); }
  return b;
}
const NP_KCAL_MAX = 6000;                // R3-NUT-07: trần calo mục tiêu dùng cho thực đơn
const NP_FIBER_PER_1000 = 14;            // g chất xơ / 1.000 kcal (IOM 2005, Dietary Guidelines for Americans)
/* QN-23: trần chất xơ = AI của IOM (nam 38 / nữ 25 g; > 50 tuổi 30 / 21 g) + 10 g — 4.000 kcal không còn đòi 56 g/ngày */
function npFiberCap(p){
  p = p || {};
  const old = (Number(p.age) || 0) > 50;
  return (p.gender === "male" ? (old ? 30 : 38) : (old ? 21 : 25)) + 10;
}
/* QN-05: mục tiêu thực đơn = ĐÚNG số người dùng thấy, trừ khi dưới sàn an toàn (nữ 1.200 / nam 1.500 kcal — như app.js);
   macro tự chỉnh không khớp calo (> ±10 %) hoặc đạm > 35 % năng lượng → chuẩn hoá và báo cho người dùng (T.floored / T.macroFixed). */
function npTargets(p){
  p = p || {};
  /* R3-NUT-07: trần 6.000 kcal (= giới hạn ô "Mục tiêu calo" của app.js) — hồ sơ hỏng / đồng bộ ra 13.784 hay 99.999 kcal
     không còn sinh thực đơn 4.700 kcal + đạm 8.749 g; NaN / Infinity → 2.000 */
  const raw = Number.isFinite(Number(p.goalKcal)) && Number(p.goalKcal) > 0 ? Number(p.goalKcal) : 2000;
  const floor = p.gender === "male" ? 1500 : 1200;
  const K = Math.min(NP_KCAL_MAX, Math.max(floor, Math.round(raw)));
  const fin = v => Number.isFinite(Number(v)) && Number(v) > 0;
  let P = fin(p.protein) ? Number(p.protein) : Math.round(K*0.25/4);
  let F = fin(p.fat) ? Number(p.fat) : Math.round(K*0.25/9);
  let C = Number(p.carbs);
  if(!fin(C)) C = Math.max(60, Math.round((K - P*4 - F*9)/4));
  let macroFixed = false;
  const macroK = P*4 + C*4 + F*9;
  if(P*4 > K*0.35){ P = Math.floor(K*0.35/4); macroFixed = true; }
  if(macroFixed || Math.abs(macroK - K) > K*0.10){
    F = Math.round(Math.min(Math.max(F*9, K*0.20), K*0.35)/9);
    C = Math.max(Math.round(K*0.25/4), Math.round((K - P*4 - F*9)/4));
    macroFixed = true;
  }
  return { K, P, C, F, FB: Math.min(Math.round(K/1000*NP_FIBER_PER_1000), npFiberCap(p)),
    floored: raw < floor ? Math.round(raw) : 0, capped: raw > NP_KCAL_MAX ? Math.round(raw) : 0, macroFixed, macroK: Math.round(macroK) };
}
/* QN-01/03/16: cờ an toàn của người dùng hiện tại (health-safety.js). prefs.health ghi đè khi kiểm thử. */
function npSafety(prefs){
  let f = prefs && prefs.health;
  if(!f){ try{ if(typeof FKHealth !== "undefined" && FKHealth && typeof FKHealth.current === "function") f = FKHealth.current(); }catch(e){} }
  f = f || {};
  const scr = f.screened !== false;                     // chưa sàng lọc: chỉ biết tuổi (minor tính từ hồ sơ)
  return { noRare: scr && !!(f.noRare || f.preg),
    noSuppl: !!f.minor || (scr && !!(f.noSuppl || f.preg || (f.kidney && f.kidney !== "none"))),
    pCap: scr && !!(f.proteinCap || f.kidney === "ckd") };
}
/* Mục tiêu dùng để chọn món: "giảm" chỉ khi app thật sự cho thâm hụt (QN-02: thai kỳ / cho bú / RLĂU / < 18 / thiếu cân → duy trì) */
function npEffGoal(p){
  p = p || {};
  try{ if(typeof goalDisplay === "function"){ const g = goalDisplay(p); if(g && g.eff) return g.eff; } }catch(e){}
  if(p.goalBlocked) return "maintain";
  return typeof GOALS !== "undefined" && GOALS.some(g=>g.id===p.goal) ? p.goal : "maintain";
}
const NP_SUPPL = ["whey", "protein-thuc-vat"];
const hasSuppl = r => (r.items||[]).some(([id])=> NP_SUPPL.includes(id));
/* tỉ lệ năng lượng từ đạm của 1 món */
const pFrac = r => { const b = recipeBase(r); return b.k ? b.p*4/b.k : 0; };

/* =====================================================================
   2. THUẬT TOÁN THỰC ĐƠN
   ===================================================================== */
const NP_SPLIT = {
  lose:     { breakfast:.25, lunch:.35, dinner:.30, snack:.10 },
  maintain: { breakfast:.25, lunch:.35, dinner:.30, snack:.10 },
  gain:     { breakfast:.22, lunch:.30, dinner:.28, snack:.20 },
};
const NP_MEALS = ["breakfast","lunch","dinner","snack"];
const STEP = 0.05;
/* Giới hạn khẩu phần theo mức calo & mục tiêu:
   · món chính phóng 0,6–1,3 lần (người cần > 3.000 kcal: 1,4); người tăng cân không thu nhỏ món dưới 0,8
   · mỗi bữa ≤ 700 g (người cần nhiều calo: tới 900 g), số loại/đơn vị món phụ tăng dần theo calo */
const NP_MAIN_CAP = 600;               // g — khẩu phần tối đa của MÓN CHÍNH sau khi phóng (phần thiếu bù bằng món phụ)
function npLimits(K, goal, lowP){
  const big = K > 2800, mid = K > 2300, huge = K > 3300;
  /* QN-10: nhu cầu rất cao (> 3.300 kcal) → bữa tới 1.000 g, thêm loại/đơn vị món phụ đặc năng lượng
     QN-01: đạm mục tiêu thấp (lowP) → cho thu nhỏ món chính tới 0,5 và thêm nhiều phần tinh bột/béo hơn */
  return { SMIN: lowP ? 0.5 : goal==="gain" ? 0.8 : goal==="maintain" ? 0.7 : 0.6, SMAX: K > 3500 ? 1.5 : K > 3000 ? 1.4 : 1.3,
    CAP: Math.round(Math.max(700, Math.min(huge ? 1000 : 900, K*(huge ? 0.26 : 0.24)))),
    TYPES: huge ? 9 : big ? 7 : mid ? 6 : lowP ? 6 : 4, UNITS: huge ? 16 : big ? 12 : mid ? 10 : lowP ? 9 : 7, big, mid, huge };
}

/* Món phụ: 1 "đơn vị" thực tế, bữa ưu tiên, số đơn vị tối đa, chế độ ăn, phạt nhẹ (ưu tiên đồ ăn thật hơn bột).
   with: chỉ gắn vào món có sẵn 1 trong các nguyên liệu này (vd "thêm cơm" chỉ cho món ăn với cơm) — riêng bữa phụ (snack) luôn được.
   avoid: không gắn vào món có các nguyên liệu này (vd khoai lang không đi với tô phở). */
const NP_RICE = ["com-trang","com-gao-lut"];
const NP_NOODLE = ["bun-pho","mien-dong","mi-goi","mi-y-nguyen-cam","banh-cuon-dia"];
const NP_BOWL = ["yen-mach","granola","sua-chua-hy-lap","sua-chua-khong-duong","sua-tuoi-khong-duong","sua-dau-nanh","sua-tach-beo","pho-mai-tuoi"];
const NP_BREAD = ["banh-mi","banh-mi-nguyen-cam","tortilla","banh-gao-lut"];
const NP_VEG = ["xa-lach","ca-chua","dua-leo","cai-bo-xoi","mang-tay","bong-cai-xanh","rau-muong","cai-thia","cai-ngot","bap-cai","dau-que","nam","nam-dong-co",
  "mong-toi","bi-do","bi-dao","ca-tim","dau-bap","su-su","sup-lo","ot-chuong","quinoa","dau-den","dau-lang","dau-ga","dau-do","kho-qua"];
const NP_FILLERS = [
  /* đạm */
  /* prot:true = món phụ GIÀU ĐẠM → bị loại khi đạm mục tiêu thấp (bệnh thận, cho bú, < 18 tuổi — QN-01);
     suppl:true = bột đạm → bị loại khi bệnh thận / < 18 tuổi / mang thai (QN-16) */
  { id:"sua-chua-hy-lap", g:100, label:"1 hũ sữa chua Hy Lạp", to:["snack","breakfast"], max:2, diet:"veg", prot:true },
  { id:"trung-ga", g:50, label:"1 quả trứng luộc", to:["breakfast","snack","lunch"], max:2, diet:"veg", prot:true },
  { id:"trung-trang", g:66, label:"2 lòng trắng trứng", to:["breakfast","dinner"], max:2, diet:"veg", pen:.002, avoid:NP_BOWL, prot:true },
  { id:"sua-tuoi-khong-duong", g:185, dupOk:true, label:"1 hộp sữa tươi không đường", to:["snack","breakfast"], max:2, maxBig:3, diet:"veg" },
  { id:"pho-mai-tuoi", g:110, label:"½ chén phô mai tươi", to:["snack"], max:1, diet:"veg", pen:.003, prot:true },
  { id:"whey", g:30, label:"1 muỗng whey (pha nước/sữa)", to:["snack"], max:1, diet:"veg", pen:.006, prot:true, suppl:true },
  { id:"uc-ga", g:100, label:"100 g ức gà luộc", to:["lunch","dinner"], max:2, diet:"omni", avoid:NP_BOWL, prot:true },
  { id:"ca-ngu", g:60, label:"½ hộp cá ngừ", to:["dinner","lunch"], max:1, diet:"omni", pen:.002, with:NP_RICE.concat(NP_BREAD, NP_VEG), prot:true },
  { id:"tom-luoc", g:100, label:"100 g tôm luộc", to:["dinner","lunch"], max:1, diet:"omni", pen:.002, avoid:NP_BOWL, prot:true },
  { id:"dau-hu", g:150, label:"1 bìa đậu hũ", to:["dinner","lunch"], max:1, diet:"vegan", avoid:NP_BOWL, prot:true },
  { id:"dau-nanh-luoc", g:100, label:"1 chén edamame", to:["snack","lunch"], max:1, diet:"vegan", prot:true },
  { id:"sua-dau-nanh", g:205, dupOk:true, label:"1 hộp sữa đậu nành không đường", to:["snack","breakfast"], max:2, diet:"vegan" },
  { id:"tempeh", g:100, label:"100 g tempeh áp chảo", to:["lunch","dinner"], max:1, diet:"veganOnly", pen:.002, avoid:NP_BOWL, prot:true },
  { id:"mi-can", g:100, label:"100 g mì căn", to:["dinner","lunch"], max:1, diet:"veganOnly", pen:.003, avoid:NP_BOWL, prot:true },
  { id:"protein-thuc-vat", g:30, label:"1 muỗng đạm thực vật (pha nước)", to:["snack","breakfast"], max:1, diet:"veganOnly", pen:.005, prot:true, suppl:true },
  /* tinh bột */
  { id:"com-trang", g:100, dupOk:true, label:"thêm ⅔ chén cơm", to:["lunch","dinner"], max:2, maxBig:3, diet:"vegan", with:["com-trang"] },
  { id:"com-gao-lut", g:100, dupOk:true, label:"thêm ⅔ chén cơm gạo lứt", to:["dinner","lunch"], max:2, maxBig:3, diet:"vegan", with:["com-gao-lut"] },
  { id:"chuoi", g:100, label:"1 quả chuối", to:["snack","breakfast","lunch"], max:2, maxBig:3, diet:"vegan" },
  /* QN-01: món phụ GIÀU NĂNG LƯỢNG, ÍT ĐẠM — chỉ dùng khi đạm mục tiêu thấp (lowPOnly) */
  { id:"banh-mi", g:40, label:"½ ổ bánh mì", to:["breakfast","snack","dinner"], max:1, maxBig:2, diet:"vegan", lowPOnly:true, avoid:NP_NOODLE.concat(NP_RICE, ["xoi-trang"]) },
  { id:"com-trang", g:100, dupOk:true, label:"⅔ chén cơm trắng", to:["lunch","dinner"], max:2, maxBig:3, diet:"vegan", lowPOnly:true, avoid:NP_NOODLE.concat(NP_BREAD, NP_BOWL, ["com-trang","com-gao-lut","xoi-trang","khoai-lang","khoai-tay"]) },
  { id:"banh-gao-lut", g:20, label:"2 bánh gạo lứt", to:["snack","breakfast"], max:2, maxBig:3, diet:"vegan", lowPOnly:true, avoid:NP_NOODLE.concat(NP_RICE) },
  { id:"tao", g:180, label:"1 quả táo", to:["breakfast","lunch"], max:1, diet:"vegan", lowPOnly:true },
  { id:"dau-oliu", g:5, dupOk:true, label:"1 muỗng cà phê dầu (xào/trộn)", to:["lunch","dinner","breakfast"], max:2, maxBig:4, diet:"vegan", pen:.001, lowPOnly:true, avoid:NP_NOODLE.concat(NP_BOWL) },
  { id:"khoai-lang", g:150, label:"1 củ khoai lang luộc", to:["snack","breakfast","dinner"], max:1, maxBig:2, diet:"vegan", avoid:NP_NOODLE.concat(NP_RICE, NP_BREAD, ["xoi-trang","khoai-mi"]) },
  { id:"yen-mach", g:40, dupOk:true, label:"thêm 40 g yến mạch", to:["breakfast","snack"], max:2, diet:"vegan", with:NP_BOWL },
  { id:"granola", g:40, label:"1 nắm granola (40 g)", to:["snack","breakfast"], max:1, diet:"veg", pen:.002, bigOnly:true, with:NP_BOWL },
  { id:"banh-mi-nguyen-cam", g:30, label:"1 lát bánh mì nguyên cám", to:["breakfast","snack"], max:2, diet:"vegan", avoid:NP_NOODLE.concat(NP_RICE) },
  { id:"bap", g:150, label:"1 trái bắp luộc", to:["snack"], max:1, diet:"vegan", pen:.002 },
  /* trái cây & rau (chất xơ) */
  { id:"oi", g:180, label:"1 quả ổi", to:["snack","lunch"], max:1, diet:"vegan" },
  { id:"tao", g:180, label:"1 quả táo", to:["snack","dinner"], max:1, diet:"vegan" },
  { id:"bong-cai-xanh", g:100, label:"1 chén bông cải luộc", to:["dinner","lunch"], max:1, diet:"vegan", avoid:NP_BOWL },
  { id:"cai-ngot", g:150, label:"1 đĩa cải ngọt luộc", to:["lunch","dinner"], max:1, diet:"vegan", avoid:NP_BOWL },
  /* chất béo tốt */
  { id:"hanh-nhan", g:15, label:"1 nắm nhỏ hạnh nhân (15 g)", to:["snack","breakfast"], max:2, maxBig:3, diet:"vegan", with:NP_BOWL.concat(NP_BREAD) },
  { id:"bo-dau-phong", g:16, label:"1 muỗng bơ đậu phộng", to:["breakfast","snack"], max:2, maxBig:3, diet:"vegan", with:NP_BOWL.concat(NP_BREAD, ["chuoi"]) },
  { id:"dau-phong", g:20, label:"1 nắm đậu phộng rang (20 g)", to:["snack","lunch"], max:1, diet:"vegan", pen:.001, bigOnly:true, with:["bun-pho","xa-lach","rau-thom"] },
  { id:"bo-avocado", g:50, label:"¼ quả bơ", to:["lunch","breakfast"], max:1, diet:"vegan", pen:.002, with:NP_BREAD.concat(["xa-lach","quinoa","dau-den","com-gao-lut","yen-mach"]) },
  { id:"dau-oliu", g:5, dupOk:true, label:"1 muỗng cà phê dầu ô liu (trộn/xào rau)", to:["dinner","lunch"], max:2, maxBig:4, diet:"vegan", pen:.002, with:NP_VEG, avoid:NP_NOODLE, notLowP:true },
];
/* món phụ f có hợp với món r ở bữa meal không */
function fillerFits(f, r, meal){
  const ids = r.items.map(x=>x[0]);
  if(ids.includes(f.id) && !f.dupOk) return false;                    // món đã có chuối/táo/trứng… thì không "thêm 1 quả" nữa
  if(f.avoid && f.avoid.some(id=> ids.includes(id))) return false;
  if(meal === "snack") return true;
  if(f.with && !f.with.some(id=> ids.includes(id))) return false;
  return true;
}
function fillersFor(prefs, lim, S, lowP){
  S = S || {};
  return NP_FILLERS.filter(f=>{
    if(!food(f.id)) return false;
    if(f.bigOnly && !(lim && lim.big)) return false;
    if(f.suppl && S.noSuppl) return false;                               // QN-16
    if(lowP && (f.prot || f.notLowP)) return false;                      // QN-01: không thêm món phụ giàu đạm
    if(!lowP && f.lowPOnly) return false;
    if(prefs.vegan) return f.diet === "vegan" || f.diet === "veganOnly";
    if(f.diet === "veganOnly") return false;
    if(prefs.veg) return f.diet === "veg" || f.diet === "vegan";
    return true;
  }).map(f=> Object.assign({}, f, { max: (lim && lim.big && f.maxBig) || f.max, m: itemsMacros([[f.id, f.g]]) }));
}

function dietOk(r, prefs){
  const t = r.tags || [];
  if(prefs.vegan) return t.includes("thuan-chay");
  if(prefs.veg) return t.includes("chay") || t.includes("thuan-chay");
  return true;
}
/* Danh sách món ứng viên cho 1 bữa (lọc chế độ ăn → ẩm thực → mục tiêu) */
function npPool(meal, goal, prefs, opt){
  opt = opt || {}; prefs = prefs || {};
  const S = opt.safety || npSafety(prefs);
  /* QN-03: thai phụ → bỏ món tái/sống; QN-16: bệnh thận / < 18 tuổi / thai phụ → bỏ món có whey, bột đạm */
  const safeOk = r => !(S.noRare && r.rare) && !(S.noSuppl && hasSuppl(r));
  let pool = RECIPES.filter(r=> r.items && r.items.length && (r.meal===meal || (meal==="snack" && (r.tags||[]).includes("an-vat"))) && safeOk(r));
  if(goal !== "gain") pool = pool.filter(r=>!r.gainOnly);
  pool = pool.filter(r=> dietOk(r, prefs));
  if(!pool.length && (prefs.vegan || prefs.veg) && meal !== "snack")       // chay: mượn món chay của bữa chính khác
    pool = RECIPES.filter(r=> (r.meal==="lunch"||r.meal==="dinner") && dietOk(r, prefs) && safeOk(r));
  if(opt.all) return pool;
  if(prefs.cuisine && prefs.cuisine !== "all"){ const f = pool.filter(r=>r.cuisine===prefs.cuisine); if(f.length >= 2) pool = f; }
  if(opt.lowP != null){
    /* QN-01: đạm mục tiêu thấp → bỏ lọc "giảm mỡ/tăng cơ" (các món này nhiều đạm), giữ món có % năng lượng từ đạm thấp */
    const lim = opt.lowP + (S.pCap ? 0.10 : 0.14);          // không có trần đạm y khoa (vd tuổi dậy thì) → nới để có món đặc năng lượng hơn
    const f = pool.filter(r=> pFrac(r) <= lim);
    if(f.length >= 3) pool = f;
    else pool = pool.slice().sort((a,b)=> pFrac(a) - pFrac(b)).slice(0, Math.max(3, Math.ceil(pool.length*0.6)));
    return pool;
  }
  const want = goal==="lose" ? "giam-mo" : goal==="gain" ? "tang-co" : null;
  if(want){ const f = pool.filter(r=>(r.tags||[]).includes(want)); if(f.length >= 3) pool = f; }
  return pool;
}
/* Ứng viên theo ngày: mỗi ngày một "cửa sổ" khác nhau (d, d+7, d+14…) → 7 ngày ít lặp món */
function npCands(pool, di, n){
  const out = [], L = pool.length;
  for(let j=0; out.length < n && j < L*2; j++){ const r = pool[(di + 7*j) % L]; if(!out.includes(r)) out.push(r); }
  return out;
}

/* Hàm sai số: calo quan trọng nhất, rồi đạm, tinh bột, béo; thiếu xơ phạt nhẹ */
function npErr(t, T){
  const eK = (t.k - T.K)/T.K, eP = (t.p - T.P)/T.P, eC = (t.c - T.C)/T.C, eF = (t.f - T.F)/T.F;
  const eFb = Math.min(0, (t.fb - T.FB)/T.FB);
  const over = (e, lim)=> Math.max(0, Math.abs(e) - lim);
  /* đạm: thiếu phạt nặng, dư nhẹ hơn (ISSN cho phép tới 2,2 g/kg) nhưng vẫn giữ trong +15 %.
     QN-01: bệnh thận mạn (T.pCap) → đạm là TRẦN cứng (> +5 % phạt rất nặng); đạm thấp (T.lowP) → dư > +8 % phạt nặng */
  const pOverW = T.pCap ? 3 : T.lowP ? 2.5 : 1.5;
  const pOverLim = T.pCap ? .01 : T.lowP ? .08 : .135;
  return 8*eK*eK + (eP < 0 ? 5 : pOverW)*eP*eP + 2*eC*eC + 1*eF*eF + 1*eFb*eFb
    + 70*over(eK,.035)**2 + 50*Math.max(0, -eP - .10)**2 + (T.pCap ? 400 : 60)*Math.max(0, eP - pOverLim)**2 + 25*over(eC,.11)**2 + 6*over(eF,.20)**2;
}

/* Tối ưu 1 tổ hợp món: hệ số khẩu phần từng bữa + món phụ (leo đồi tham lam, bước 0,05; tính gia số O(số bữa))
   Món phụ được tách thành "biến thể" theo bữa (vd chuối ở bữa sáng / chuối ở bữa phụ).
   init: trạng thái khởi đầu (pha 2) · banned: loại món phụ bị cấm (thử thay loại khác) */
function npSolve(combo, T, split, fillers, goal, init, banned){
  const M = combo.length, L = npLimits(T.K, goal, T.lowP), SMIN = L.SMIN, CAP = L.CAP;
  const mealIdx = {}; combo.forEach((c,i)=> mealIdx[c.meal] = i);
  const V = [];
  fillers.forEach((f, fi)=> f.to.forEach((ml, pri)=>{
    const i = mealIdx[ml]; if(i == null || !fillerFits(f, combo[i].r, ml)) return;
    V.push({ fi, i, pri, f });
  }));
  const nV = V.length;
  /* mỗi NGUYÊN LIỆU trong 1 bữa (phần của món chính + món phụ cùng loại, vd cơm) ≤ 595 g (trừ hao làm tròn) */
  V.forEach(x=>{ const it = combo[x.i].r.items.find(([id])=> id === x.f.id); x.baseG = it ? it[1] : 0; x.key = x.i + "|" + x.f.id; });
  const idG = {};
  const itemOk = (x, ds, dn)=> (s[x.i] + ds)*x.baseG + (idG[x.key] || 0) + dn*x.f.g <= 595;
  /* [Tích hợp · BUG-06] món chính sau khi nhân hệ số ≤ 600 g (trừ hao làm tròn 5 g/nguyên liệu) */
  const smax = combo.map(c=> Math.max(SMIN, Math.min(L.SMAX, CAP / Math.max(1, c.b.g), (NP_MAIN_CAP - 2.5*c.r.items.length) / Math.max(1, c.b.g))));
  const tgtK = combo.map(c=> T.K * (split[c.meal]||.25));
  const s = new Array(M).fill(0), cnt = new Array(nV).fill(0), foodCnt = new Array(fillers.length).fill(0);
  const tot = { k:0, p:0, c:0, f:0, fb:0 }, rk = new Array(M).fill(0), fk = new Array(M).fill(0), mg = new Array(M).fill(0);
  let cost = 0, types = 0, units = 0;
  const addR = (i, ds)=>{ const b = combo[i].b; s[i]+=ds; tot.k+=ds*b.k; tot.p+=ds*b.p; tot.c+=ds*b.c; tot.f+=ds*b.f; tot.fb+=ds*b.fb; rk[i]+=ds*b.k; mg[i]+=ds*b.g; };
  const addV = (v, dn)=>{
    const x = V[v], m = x.f.m;
    if(cnt[v]===0 && dn>0) types++;
    cnt[v]+=dn; if(cnt[v]===0 && dn<0) types--;
    tot.k+=dn*m.k; tot.p+=dn*m.p; tot.c+=dn*m.c; tot.f+=dn*m.f; tot.fb+=dn*m.fb;
    fk[x.i]+=dn*m.k; mg[x.i]+=dn*x.f.g; foodCnt[x.fi]+=dn; units+=dn; idG[x.key] = (idG[x.key] || 0) + dn*x.f.g;
    cost += dn*(0.0015 + (x.f.pen||0) + x.pri*0.0008);
  };
  combo.forEach((c,i)=> addR(i, init ? init.s[i] : Math.min(smax[i], Math.max(SMIN, Math.round(tgtK[i]/Math.max(1,c.b.k)/STEP)*STEP))));
  if(init) init.cnt.forEach((n, v)=>{ if(n && v < nV) addV(v, n); });
  const score = ()=>{
    let e = npErr(tot, T) + cost;
    for(let i=0;i<M;i++){
      const d = (rk[i] + fk[i] - tgtK[i])/T.K; e += 1.2*d*d;                           // giữ tỉ lệ calo giữa các bữa
      const ov = fk[i]/Math.max(1, rk[i]) - (combo[i].meal === "snack" ? (T.lowP ? 1.8 : 1.2) : (T.lowP ? 0.9 : 0.6));     // món phụ không "lấn" món chính (đạm thấp: nới vì món chính bị thu nhỏ)
      if(ov > 0) e += 0.08*ov*ov + 0.02*ov;
    }
    return e;
  };
  let best = score();
  for(let it=0; it<70; it++){
    let mv = null, bestE = best - 1e-6, e;
    for(let i=0;i<M;i++){
      if(s[i] + STEP <= smax[i] + 1e-9 && mg[i] + STEP*combo[i].b.g <= CAP && V.every(x=> x.i !== i || !x.baseG || !idG[x.key] || itemOk(x, STEP, 0))){ addR(i, STEP); e = score(); addR(i, -STEP); if(e < bestE){ bestE = e; mv = [0, i, STEP]; } }
      if(s[i] - STEP >= SMIN - 1e-9){ addR(i, -STEP); e = score(); addR(i, STEP); if(e < bestE){ bestE = e; mv = [0, i, -STEP]; } }
    }
    for(let v=0; v<nV; v++){
      const x = V[v];
      if(!(banned && banned[x.fi]) && foodCnt[x.fi] < x.f.max && units < L.UNITS && (cnt[v] || types < L.TYPES) && mg[x.i] + x.f.g <= CAP && itemOk(x, 0, 1)){
        addV(v, 1); e = score(); addV(v, -1); if(e < bestE){ bestE = e; mv = [1, v, 1]; }
      }
      if(cnt[v] > 0){ addV(v, -1); e = score(); addV(v, 1); if(e < bestE){ bestE = e; mv = [1, v, -1]; } }
    }
    if(!mv) break;
    if(mv[0] === 0) addR(mv[1], mv[2]); else addV(mv[1], mv[2]);
    best = bestE;
  }
  return { s: s.map(x=> Math.round(x*100)/100), cnt: cnt.slice(), V, foodCnt: foodCnt.slice(), err: best, t: Object.assign({}, tot) };
}
/* Pha 2: thử bỏ hẳn từng loại món phụ rồi tối ưu lại — thoát "cực tiểu địa phương" khi đã hết lượt loại món phụ */
function npRefine(combo, T, split, fillers, goal, sol){
  for(let round=0; round<2; round++){
    let improved = false;
    sol.foodCnt.forEach((n, fi)=>{
      if(!n) return;
      const init = { s: sol.s, cnt: sol.cnt.map((c, v)=> sol.V[v].fi === fi ? 0 : c) };
      const banned = {}; banned[fi] = true;
      const alt = npSolve(combo, T, split, fillers, goal, init, banned);
      if(alt.err < sol.err - 1e-5){ sol = alt; improved = true; }
    });
    if(!improved) break;
  }
  return sol;
}

/* Gộp kết quả thành thực đơn (định dạng tương thích nutrition.js: plan[meal] = món đã scale) */
function npAssemble(combo, sol){
  const plan = {};
  combo.forEach((c, i)=>{
    const f = sol.s[i];
    const baseItems = c.r.items.map(([id,g])=>[id, Math.max(5, Math.round(g*f/5)*5)]);
    const extras = [];
    sol.V.forEach((x, v)=>{ const n = sol.cnt[v]; if(n && x.i === i) extras.push({ id:x.f.id, g:x.f.g*n, n, label: n>1 ? `${n} × ${x.f.label}` : x.f.label }); });
    const items = baseItems.map(x=>x.slice());
    extras.forEach(e=>{ const ex = items.find(x=>x[0]===e.id); if(ex) ex[1] += e.g; else items.push([e.id, e.g]); });
    plan[c.meal] = Object.assign({}, c.r, { items, baseItems, extras, factor: f, forced: !!c.forced });
  });
  return plan;
}

const _planCache = new Map();
/* QN-09: "trí nhớ tuần" — đếm món đã dùng ở các ngày TRƯỚC trong tuần (cùng hồ sơ, cùng bộ lọc; các ngày này đã cache) */
function npWeekMemory(p, di, prefs){
  const mem = { cnt:{}, prev:{}, any:{} };
  if(!(di > 0) || prefs.noMemory) return mem;
  const base = Object.assign({}, prefs, { swaps:null });
  for(let d = 0; d < di; d++){
    const pl = npBuildDayPlan(p, d, base);
    Object.keys(pl).forEach(m=>{
      const id = pl[m].id;
      (mem.cnt[m] = mem.cnt[m] || {})[id] = (mem.cnt[m][id] || 0) + 1;
      mem.any[id] = (mem.any[id] || 0) + 1;
      if(d === di - 1) mem.prev[m] = id;
    });
  }
  return mem;
}
/* phạt lặp: mỗi lần đã dùng ở cùng bữa +0,014; trùng hôm qua +0,02; từ lần thứ 3 trở đi phạt mạnh,
   lần thứ 5 trở đi gần như cấm (mục tiêu ≤ 3–4 lần/tuần/bữa — QN-09) */
function npRepeatPen(mem, meal, id){
  const n = (mem.cnt[meal] && mem.cnt[meal][id]) || 0, other = (mem.any[id] || 0) - n;
  return 0.014*n + (mem.prev[meal] === id ? 0.02 : 0) + (n >= 2 ? 0.05*(n - 1) : 0) + (n >= 4 ? 0.6*(n - 3) : 0) + 0.006*other;
}
/* QU-03 (vòng 2): khoá ghi nhớ thực đơn = (ngày trong tuần, hồ sơ → mục tiêu calo/macro + cờ an toàn + mục tiêu hiệu dụng,
   tuỳ chọn → ẩm thực / chay / thuần chay / món đổi). Tính khoá rẻ (không chạy thuật toán) để biết thực đơn đã có sẵn chưa. */
function npPlanCtx(p, dayIndex, prefs){
  prefs = prefs || {};
  p = p || {};
  /* thiếu cân / dưới 18 tuổi / thai kỳ, cho bú, RLĂU (goalDisplay): app không áp thâm hụt → chọn món như "duy trì" */
  const goal = npEffGoal(p);
  const S = npSafety(prefs);
  const T = npTargets(p);
  T.pCap = S.pCap; T.lowP = T.P*4/T.K < 0.15 ? Math.round(T.P*4/T.K*1000)/1000 : 0;   // QN-01
  const di = ((Number(dayIndex)||0) % 7 + 7) % 7;
  const forced = prefs.swaps || {};
  const key = JSON.stringify([T, goal, di, prefs.cuisine||"all", !!prefs.veg, !!prefs.vegan, forced, RECIPES.length, FOODS.length, prefs.k||0, S, !!prefs.noMemory]);
  return { goal, S, T, di, forced, key };
}

/* QU-03: bộ nhớ BỀN cho thực đơn (localStorage riêng "fitkit_np_plans_v1", KHÔNG nằm trong fitkit_state_v1 → không làm nặng mỗi lần
   saveState / sao lưu). Chỉ lưu mã món + gam; khoá được BĂM (không lộ mục tiêu calo hay cờ sức khoẻ). Dữ liệu món/thực phẩm
   hoặc thuật toán đổi → chữ ký khác → bỏ hết bản cũ. Mở app lần sau: thẻ "Thực đơn gợi ý" và "Đi chợ" có ngay, không tính lại. */
const NP_STORE_KEY = "fitkit_np_plans_v1", NP_STORE_MAX = 35, NP_ALGO_V = "np3";
let _store = null, _storeDirty = false, _dataSig = "", _dataSigN = "";
function npHash(s){                                     // cyrb53 — băm 53 bit, đủ tránh trùng cho vài chục khoá
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i = 0; i < s.length; i++){ const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function npDataSig(){
  const n = FOODS.length + ":" + RECIPES.length;
  if(_dataSig && _dataSigN === n) return _dataSig;
  let s = NP_ALGO_V + JSON.stringify(NP_FILLERS);
  FOODS.forEach(f=>{ s += `${f.id},${f.kcal},${f.protein},${f.carbs},${f.fat},${f.fiber||0};`; });
  s += JSON.stringify(RECIPES.map(r=> [r.id, r.meal, r.cuisine, r.tags, r.items, !!r.rare, !!r.gainOnly]));
  _dataSig = npHash(s); _dataSigN = n;
  return _dataSig;
}
const npLS = ()=>{ try{ return typeof localStorage !== "undefined" && localStorage && typeof localStorage.getItem === "function" ? localStorage : null; }catch(e){ return null; } };
function npStore(){
  if(_store && _store.sig === npDataSig()) return _store;
  let o = null;
  try{ const ls = npLS(); const raw = ls && ls.getItem(NP_STORE_KEY); o = raw ? JSON.parse(raw) : null; }catch(e){ o = null; }
  _store = (o && o.v === 1 && o.sig === npDataSig() && o.plans && typeof o.plans === "object" && Array.isArray(o.keys)) ? o : { v:1, sig: npDataSig(), keys:[], plans:{} };
  return _store;
}
let _rmap = null, _rmapN = -1;
const recipeById = id=>{ if(_rmapN !== RECIPES.length || !_rmap){ _rmap = new Map(RECIPES.map(r=> [r.id, r])); _rmapN = RECIPES.length; } return _rmap.get(id); };
function npStoreGet(key){
  if(!npLS()) return null;
  const c = npStore().plans[npHash(key)];
  if(!c || !c.m || typeof c.m !== "object") return null;
  const plan = {};
  for(const meal of Object.keys(c.m)){
    const x = c.m[meal], r = Array.isArray(x) && recipeById(x[0]);
    if(!r || !Array.isArray(x[1])) return null;
    /* R3-NUT-10: bộ nhớ thực đơn nằm ở localStorage (người dùng / tiện ích / bản lỗi có thể làm hỏng) → kiểm từng dòng:
       [mã thực phẩm có thật, gam 0–5.000]; sai bất kỳ dòng nào → bỏ bản nhớ này, tính lại (trước: màn Dinh dưỡng ném lỗi mãi) */
    const okRows = a => Array.isArray(a) && a.every(row=> Array.isArray(row) && typeof row[0] === "string" && !!food(row[0]) && Number.isFinite(row[1]) && row[1] > 0 && row[1] <= 5000);
    const okExtras = a => Array.isArray(a) && a.every(e=> e && typeof e === "object" && typeof e.id === "string" && !!food(e.id) && Number.isFinite(e.g) && e.g > 0 && e.g <= 5000);
    if(!x[1].length || !okRows(x[1]) || !okRows(x[2] || []) || !okExtras(x[3] || [])) return null;
    if(!MEAL_TYPES.some(mt=> mt.id === meal)) return null;
    plan[meal] = Object.assign({}, r, { items: x[1], baseItems: x[2] || [], extras: x[3] || [], factor: Math.min(5, Math.max(0.1, Number(x[4]) || 1)), forced: !!x[5] });
  }
  Object.defineProperty(plan, "_meta", { value:{ err: c.e, cached:true }, enumerable:false });
  return plan;
}
function npStorePut(key, plan){
  if(!npLS()) return;
  const S = npStore(), hk = npHash(key), m = {};
  Object.keys(plan).forEach(meal=>{ const r = plan[meal]; m[meal] = [r.id, r.items, r.baseItems || [], r.extras || [], r.factor || 1, r.forced ? 1 : 0]; });
  S.plans[hk] = { m, e: plan._meta ? Math.round(plan._meta.err*1e4)/1e4 : null };
  S.keys = S.keys.filter(k=> k !== hk).concat(hk);
  while(S.keys.length > NP_STORE_MAX) delete S.plans[S.keys.shift()];
  if(!_storeDirty){ _storeDirty = true; npIdle(npStoreSave); }
}
function npStoreSave(){
  _storeDirty = false;
  const ls = npLS(); if(!ls || !_store) return;
  try{ ls.setItem(NP_STORE_KEY, JSON.stringify(_store)); }
  catch(e){ try{ _store.keys.splice(0, Math.ceil(_store.keys.length/2)).forEach(k=> delete _store.plans[k]); ls.setItem(NP_STORE_KEY, JSON.stringify(_store)); }catch(_){} }   // bộ nhớ đầy → bỏ nửa cũ
}
function npStoreClear(){ _store = null; _planCache.clear(); try{ const ls = npLS(); if(ls) ls.removeItem(NP_STORE_KEY); }catch(e){} }
/* đã có thực đơn (trong bộ nhớ / bộ nhớ bền) cho (hồ sơ, ngày, tuỳ chọn) chưa — không tính */
function npPlanCached(p, dayIndex, prefs){
  const c = npPlanCtx(p, dayIndex, prefs);
  if(_planCache.has(c.key)) return true;
  const hit = npStoreGet(c.key);
  if(hit){ _planCache.set(c.key, hit); return true; }
  return false;
}
/* Việc lúc rảnh: requestIdleCallback (Chromium/Android WebView) · setTimeout ngắn (Safari / WKWebView chưa có rIC) */
function npIdle(fn){
  try{ if(typeof requestIdleCallback === "function") return requestIdleCallback(()=> fn(), { timeout: 600 }); }catch(e){}
  return setTimeout(fn, 24);
}

function npBuildDayPlan(p, dayIndex, prefs){
  prefs = prefs || {};
  p = p || {};
  const { goal, S, T, di, forced, key } = npPlanCtx(p, dayIndex, prefs);
  const split = NP_SPLIT[goal] || NP_SPLIT.maintain;
  if(_planCache.has(key)) return clonePlan(_planCache.get(key));
  { const hit = npStoreGet(key); if(hit){ _planCache.set(key, hit); return clonePlan(hit); } }

  const LIM = npLimits(T.K, goal, T.lowP), SMAX = LIM.SMAX, SMIN = LIM.SMIN;
  const fillers = fillersFor(prefs, LIM, S, !!T.lowP);
  const mem = npWeekMemory(p, di, prefs);
  const slots = [];
  NP_MEALS.forEach(meal=>{
    if(!split[meal]) return;
    const pool = npPool(meal, goal, prefs, { safety:S, lowP: T.lowP ? T.lowP : null });
    let cands;
    const fr = forced[meal] && RECIPES.find(r=>r.id===forced[meal]);
    if(fr && dietOk(fr, prefs) && (goal==="gain" || !fr.gainOnly)) cands = [{ r:fr, j:0, forced:true }];
    else cands = npCands(pool, di + (prefs.k||0), prefs.width || (LIM.mid ? 6 : 5)).map((r,j)=>({ r, j }));
    if(cands.length) slots.push({ meal, cands });
  });
  if(!slots.length) return {};

  /* liệt kê tổ hợp, xếp hạng nhanh bằng hệ số calo, chỉ tối ưu kỹ 14 tổ hợp tốt nhất */
  const combos = [];
  const rec = (i, acc)=>{
    if(i === slots.length){
      const ids = acc.map(a=>a.r.id); if(new Set(ids).size < ids.length) return;
      combos.push(acc.slice()); return;
    }
    slots[i].cands.forEach(c=>{ acc.push({ meal:slots[i].meal, r:c.r, j:c.j, forced:c.forced, b:recipeBase(c.r), rp: c.forced ? 0 : npRepeatPen(mem, slots[i].meal, c.r.id) }); rec(i+1, acc); acc.pop(); });
  };
  rec(0, []);
  if(!combos.length) return {};
  const pW = T.pCap ? 14 : T.lowP ? 8 : 3;
  const quick = combo=>{
    const t = { k:0, p:0, c:0, f:0, fb:0 };
    combo.forEach(c=>{ const s = Math.min(SMAX, Math.max(SMIN, T.K*(split[c.meal]||.25)/Math.max(1,c.b.k))); t.k+=s*c.b.k; t.p+=s*c.b.p; t.c+=s*c.b.c; t.f+=s*c.b.f; t.fb+=s*c.b.fb; });
    /* món phụ sẽ bù phần thiếu → chỉ phạt mạnh khi THỪA */
    const eP = (t.p - T.P)/T.P, eK = (t.k - T.K)/T.K, eC = (t.c - T.C)/T.C, eF = (t.f - T.F)/T.F;
    return (eK>0?8:1)*eK*eK + (eP>0?pW:2)*eP*eP + (eC>0?3:1)*eC*eC + (eF>0?2:.5)*eF*eF + combo.reduce((a,c)=>a + c.j*0.004 + c.rp, 0);
  };
  combos.forEach(c=> c.q = quick(c));
  combos.sort((a,b)=> a.q - b.q);
  const primary = combos.find(c=> c.every(x=>x.j===0));
  const shortlist = combos.slice(0, LIM.mid ? 20 : 16); if(primary && !shortlist.includes(primary)) shortlist.push(primary);
  let best = null;
  shortlist.forEach(combo=>{
    const sol = npSolve(combo, T, split, fillers, goal);
    const e = sol.err + combo.reduce((a,c)=>a + c.j*0.006 + c.rp, 0);    // ưu tiên nhẹ món "chính" của ngày + tránh lặp trong tuần
    if(!best || e < best.e) best = { e, combo, sol };
  });
  const vpen = best.e - best.sol.err;
  best.sol = npRefine(best.combo, T, split, fillers, goal, best.sol);
  best.e = best.sol.err + vpen;
  const plan = npAssemble(best.combo, best.sol);
  Object.defineProperty(plan, "_meta", { value:{ targets:T, totals:best.sol.t, err:best.e, safety:S }, enumerable:false });
  _planCache.set(key, plan);
  if(_planCache.size > 240) _planCache.delete(_planCache.keys().next().value);
  npStorePut(key, plan);                                                 // QU-03: nhớ bền cho lần mở app sau
  return clonePlan(plan);
}
function clonePlan(plan){
  const out = {};
  Object.keys(plan).forEach(k=>{ const r = plan[k]; out[k] = Object.assign({}, r, { items:r.items.map(x=>x.slice()), baseItems:(r.baseItems||[]).map(x=>x.slice()), extras:(r.extras||[]).map(e=>Object.assign({}, e)) }); });
  if(plan._meta) Object.defineProperty(out, "_meta", { value: plan._meta, enumerable:false });
  return out;
}
function planTotals(plan){
  const t = { k:0, p:0, c:0, f:0, fb:0, maxMealG:0, maxItemG:0 };
  Object.values(plan).forEach(r=>{ const m = itemsMacros(r.items); t.k+=m.k; t.p+=m.p; t.c+=m.c; t.f+=m.f; t.fb+=m.fb; t.maxMealG = Math.max(t.maxMealG, m.g); r.items.forEach(([,g])=> t.maxItemG = Math.max(t.maxItemG, g)); });
  return t;
}

/* Ghi đè buildDayPlan toàn cục (giữ bản cũ làm dự phòng) */
const _origBuildDayPlan = typeof buildDayPlan === "function" ? buildDayPlan : null;
try{
  buildDayPlan = function(p, dayIndex, prefs){
    try{ return npBuildDayPlan(p, dayIndex, prefs || {}); }
    catch(e){ if(typeof console!=="undefined") console.warn("nutrition-pro: planner lỗi, dùng bản cũ", e); return _origBuildDayPlan ? _origBuildDayPlan(p, dayIndex, prefs) : {}; }
  };
}catch(e){}

/* ---------- Tiện ích thuần (kiểm thử được bằng Node) ---------- */
const npFold = s => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
/* QN-04: đọc số kiểu Việt — "1,5" = 1,5 (không phải 15); "1.500,5" = 1500,5; "1.5" vẫn hiểu là 1,5 */
function npParseNum(v){
  let s = String(v == null ? "" : v).trim().replace(/\s+/g, "");
  if(!s) return NaN;
  if(s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if(!/^(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}
/* FIX-core §5 (vòng 2): MỘT bộ đọc số cho cả app — dùng fkNum của app.js ("1,5" = 1,5; "1.500" = 1500; "1.500,5" = 1500,5);
   app.js cũ chưa có fkNum → npParseNum. Số âm không hợp lệ cho khẩu phần → NaN. */
function npNum(v){
  let n = NaN;
  try{ n = typeof fkNum === "function" ? fkNum(v) : npParseNum(v); }catch(e){ n = npParseNum(v); }
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : NaN;
}
/* QN-15: tìm kiếm theo TỪ (không cần đúng thứ tự, không dấu) + từ đồng nghĩa Bắc–Nam; ưu tiên khớp trọn từ / đầu từ */
const NP_SYN = [["dau phu","dau hu"],["thit lon","thit heo"],["lon","heo"],["lac","dau phong"],["ngo","bap"],["vung","me"],["dua","thom"],
  ["dua chuot","dua leo"],["muop dang","kho qua"],["bat","chen"],["sua dau","sua dau nanh"],["rau ngot","cai ngot"],["san","khoai mi"],["cha lua","gio lua"]];
const npWords = s => npFold(s).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
function npQueryVariants(q){
  const base = npWords(q).join(" ");
  if(!base) return [];
  const out = new Set([base]);
  NP_SYN.forEach(([a, b])=> [...out].forEach(v=>{
    [[a, b], [b, a]].forEach(([x, y])=>{ const re = new RegExp("(^| )" + x + "( |$)"); if(re.test(v)) out.add(v.replace(re, "$1" + y + "$2")); });
  }));
  return [...out].map(v=> v.split(" "));
}
function npMatchScore(name, variants){
  const words = npWords(name); if(!words.length) return 0;
  const joined = words.join(" ");
  let best = 0;
  variants.forEach(toks=>{
    let sc = 0;
    for(let k = 0; k < toks.length; k++){
      const t = toks[k], last = k === toks.length - 1;
      if(words.includes(t)) sc += 3;
      else if((last || t.length >= 4) && words.some(w=> w.startsWith(t))) sc += 2;      // đang gõ dở: từ cuối khớp đầu từ
      else if(last && t.length >= 4 && joined.includes(t)) sc += 1;
      else return;                                   // một từ khoá không khớp → biến thể này trượt
    }
    if(words[0].startsWith(toks[0])) sc += 1;
    best = Math.max(best, sc);
  });
  return best;
}
function npSearch(q, limF, limR){
  const V = npQueryVariants(q);
  if(!V.length) return { foods:[], recipes:[] };
  const rank = (arr, nameOf, lim)=> arr.map((x, i)=>({ x, i, s: npMatchScore(nameOf(x), V) })).filter(o=> o.s > 0)
    .sort((a, b)=> b.s - a.s || a.i - b.i).slice(0, lim).map(o=> o.x);
  return { foods: rank(FOODS, f=> f.name + " " + (f.aliases || ""), limF || 60), recipes: rank(RECIPES, r=> r.name, limR || 10) };
}
/* QN-03: món/thực phẩm thai phụ nên tránh (USDA FSIS, NHS "Foods to avoid in pregnancy", Bộ Y tế) */
const NP_PREG_FOOD = {
  "banh-mi-thit": { level:"avoid", why:"thường có pate gan và thịt nguội (chả, xá xíu) để sẵn — nguy cơ vi khuẩn Listeria. Chọn bánh mì trứng/thịt nướng nóng, không pate." },
  "bia": { level:"avoid", why:"có cồn — không có mức rượu bia nào được xem là an toàn khi mang thai." },
  "goi-cuon-san": { level:"note", why:"có rau sống, giá — chỉ mua nơi sạch, rau rửa kỹ; tránh nếu có giá sống." },
  "ca-phe-sua-da": { level:"note", why:"có caffeine — giới hạn ≤ 200 mg/ngày (khoảng 1–2 ly cà phê)." },
  "tra-sua": { level:"note", why:"có caffeine và nhiều đường — giới hạn caffeine ≤ 200 mg/ngày." },
};
const NP_PREG_RX = /(\b(bo|be|thit)\b[^,()]*\btai\b)|\btai (vua|nac|chin|lan|chanh)\b|sushi|sashimi|\bgoi (ca|song|tom song|sua)\b|\bhau song\b|tiet canh|nem chua|long dao|trung chan|\bpate\b|\bpa te\b|thit nguoi|pho mai mem|\bbrie\b|camembert|chua tiet trung|\bruou\b|\bbia\b/;
function npPregRisk(item){
  if(!item) return null;
  if(item.rare) return { level:"avoid", why:"có bước để thịt TÁI / tái vừa — thai phụ cần nấu chín kỹ (bò miếng ≥ 63 °C và nghỉ 3 phút, bò xay ≥ 71 °C, gia cầm ≥ 74 °C — USDA FSIS).", cooked: !!item.stepsPreg };
  if(NP_PREG_FOOD[item.id]) return NP_PREG_FOOD[item.id];
  if(NP_PREG_RX.test(npFold(item.name))) return { level:"avoid", why:"có thể là đồ sống / tái / chưa tiệt trùng (gỏi sống, sushi, trứng lòng đào, pate, phô mai mềm…) — thai phụ nên tránh hoặc nấu chín kỹ." };
  return null;
}
/* QN-26: món đổi chỉ áp cho TUẦN hiện tại (khoá tuần ISO 8601) */
function npWeekKey(d){
  d = d ? new Date(d) : new Date();
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const wd = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - wd);
  const y = t.getUTCFullYear(), wk = Math.ceil(((t - Date.UTC(y, 0, 1))/86400000 + 1)/7);
  return y + "-W" + String(wk).padStart(2, "0");
}

/* (i) "Vì sao đạm X g?" (vòng 2) — giải thích công thức đạm THEO HỒ SƠ, dùng đúng logic đang tính số người dùng thấy:
   app.js calcMacros (cân nặng tham chiếu BMI ≤ 25 × g/kg theo mục tiêu & vận động, trần 180 g, ≤ 35 % năng lượng)
   + health-safety.js (≥ 60 tuổi 1,2 g/kg; thai kỳ / cho bú / < 18 tuổi / bệnh thận → g/kg riêng, lấy mức THẤP nhất). Hàm thuần. */
const vnN = n => (Math.round(Number(n)*10)/10).toLocaleString("vi-VN");
function npProteinWhy(p, h){
  p = p || {}; h = h || {};
  const w = Number(p.weight) || 0, hm = (Number(p.height) || 0)/100, age = Number(p.age) || 0;
  const kcal = Number(p.goalKcal) || 0, grams = Math.round(Number(p.protein) || 0);
  const bmi = hm && w ? w/(hm*hm) : 0, cap25 = hm ? 25*hm*hm : w, ref = hm ? Math.min(w, cap25) : w;
  let f = null;
  try{ if(typeof FKHealth !== "undefined" && FKHealth && typeof FKHealth.flags === "function") f = FKHealth.flags(h, p); }catch(e){}
  const W = { grams, weight:w, ref: Math.round(ref*10)/10, refAdjusted: !!(hm && w > cap25 + 0.05), bmi: Math.round(bmi*10)/10, age,
    manual: p.autoTargets === false, perKg:null, raw:0, expected:null, reasons:[], caps:[], health:false, kidney: (f && f.screened && f.kidney) || "none" };
  const amdr = kcal > 0 ? Math.floor(kcal*0.35/4) : Infinity;
  if(f && f.screened && f.ppk != null){
    W.health = true; W.perKg = f.ppk;
    if(f.kidney === "ckd") W.reasons.push("Bệnh thận mạn (chưa lọc máu): giữ TỐI ĐA 0,8 g/kg — KDIGO 2024 khuyên không vượt 0,8 g/kg; bác sĩ thận có thể chỉ định thấp hơn (0,55–0,6 g/kg, KDOQI 2020). Đây là trần cứng của thực đơn gợi ý.");
    if(f.kidney === "dialysis") W.reasons.push("Đang lọc máu: 1,0–1,2 g/kg (KDOQI 2020) vì lọc máu làm mất đạm — app dùng 1,2 g/kg; lượng chính xác theo bác sĩ thận.");
    if(f.preg) W.reasons.push(f.tri === 1 ? "Mang thai tam cá nguyệt 1: ~1,2 g/kg (đo bằng phương pháp IAAO, Stephens 2015)." : `Mang thai tam cá nguyệt ${f.tri}: ~1,5 g/kg — nhu cầu đạm tăng cho thai và nhau (Stephens 2015; IOM: +25 g/ngày).`);
    if(f.bf) W.reasons.push("Đang cho con bú: 1,3 g/kg (IOM 2005 — đạm đi vào sữa mẹ).");
    if(f.minor) W.reasons.push(`Dưới 18 tuổi: ${(p.goal === "gain" || ["moderate","active","veryActive"].includes(p.activity)) ? "1,5 g/kg (tập nhiều / tăng cơ)" : "1,2 g/kg (ít vận động)"} — tuổi đang lớn cần đủ năng lượng; không dùng bột đạm khi chưa hỏi bác sĩ.`);
    if(W.reasons.length > 1) W.reasons.push("Có nhiều tình trạng cùng lúc → app lấy mức THẤP nhất cho an toàn.");
    W.raw = Math.round(ref * f.ppk);
    W.expected = Math.min(W.raw, amdr);
  } else {
    const act = p.activity || "moderate", goal = p.goal || "gain";
    const sed = act === "sedentary", hard = act === "active" || act === "veryActive";
    let g = typeof proteinPerKg === "function" ? Number(proteinPerKg(p)) : (goal === "maintain" ? (sed ? 1.2 : hard ? 1.6 : 1.4) : (sed ? 1.6 : 2.0));
    const actL = ((typeof ACTIVITY_LEVELS !== "undefined" && ACTIVITY_LEVELS.find(a=> a.id === act)) || {}).label || "";
    const actTxt = actL ? ` (${actL.toLowerCase()})` : "";
    if(goal === "maintain") W.reasons.push(`Duy trì${actTxt}: ${vnN(g)} g/kg — trên mức tối thiểu 0,8 g/kg của người không tập; người tập 1,2–1,6 g/kg giúp giữ và phục hồi cơ (ISSN 2017).`);
    else if(goal === "lose" && npEffGoal(p) !== "lose") W.reasons.push(`Mục tiêu bạn chọn là giảm mỡ${actTxt}: ${vnN(g)} g/kg giúp giữ cơ (ISSN 2017) — calo vẫn được giữ ở mức duy trì cho an toàn.`);
    else if(goal === "lose") W.reasons.push(sed ? `Giảm mỡ, ít vận động: ${vnN(g)} g/kg — đạm cao hơn bình thường giúp giữ cơ và no lâu khi ăn thiếu calo.` : `Giảm mỡ + tập luyện${actTxt}: ${vnN(g)} g/kg — khi ăn thiếu calo cần nhiều đạm hơn để không mất cơ (ISSN 2017; Helms 2014).`);
    else W.reasons.push(sed ? `Tăng cơ, ít vận động: ${vnN(g)} g/kg.` : `Tăng cơ + tập tạ${actTxt}: ${vnN(g)} g/kg — trong khoảng 1,6–2,2 g/kg giúp tăng cơ tối đa (Morton 2018).`);
    if(age >= 60){ g = 1.2; W.reasons.push("Từ 60 tuổi: app dùng 1,2 g/kg (PROT-AGE 2013: tối thiểu 1,0–1,2 g/kg mỗi ngày để chống mất cơ do tuổi; vẫn giữ đạm ≤ 35 % năng lượng)."); }
    W.perKg = g;
    W.raw = Math.round(ref * g);
    let e = W.raw;
    if(e > 180){ e = 180; W.caps.push("Trần 180 g/ngày — nhiều hơn không giúp tăng cơ thêm."); }
    W.expected = Math.min(e, amdr);
  }
  if(W.expected != null && W.raw > amdr && amdr < Infinity) W.caps.push("Đạm không quá 35 % tổng năng lượng (khoảng khuyến nghị 10–35 %, IOM 2005).");
  W.perMeal = Math.round(grams/4);
  W.palms = Math.max(0.5, Math.round(grams/25*2)/2);             // 1 lòng bàn tay thịt / cá / đậu hũ ≈ 20–30 g đạm
  return W;
}

G.NutriPro = { buildDayPlan:npBuildDayPlan, pool:npPool, targets:npTargets, itemsMacros, planTotals, fillers:NP_FILLERS, food,
  safety:npSafety, effGoal:npEffGoal, parseNum:npParseNum, num:npNum, search:npSearch, pregRisk:npPregRisk, weekKey:npWeekKey, fiberCap:npFiberCap,
  planCtx:npPlanCtx, planCached:npPlanCached, clearPlanCache:npStoreClear, flushStore:npStoreSave, proteinWhy:npProteinWhy, _storeKey:NP_STORE_KEY,
  cleanCustom: c=> npCleanCustom(c), KCAL_MAX: NP_KCAL_MAX };

/* =====================================================================
   3. GIAO DIỆN (chỉ chạy trong trình duyệt, sau khi app đã khởi động)
   ===================================================================== */
if(!HAS_DOM || typeof state === "undefined" || typeof openSheet !== "function") return;

/* ---------- 3.0 Icon mới (nét 24×24) ---------- */
try{
  if(typeof FK_LINE !== "undefined") Object.assign(FK_LINE, {
    shopping_cart:"M3 4h2.2l2.3 10.6a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6|c:10,20,1.4|c:17,20,1.4",
    favorite:"M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2.1 0 3.6 1.2 5 3.1 1.4-1.9 2.9-3.1 5-3.1 3.4 0 5.6 3.3 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z",
    history:"M3.5 12a8.5 8.5 0 1 0 2.6-6.1|M3 4v4.5h4.5|M12 7.5V12l3 2",
    eco:"M5 19C5 10.5 10.5 5 20 4c-.6 9.6-6 15-15 15z|M5 19l7.5-7.5",
    remove:"M5 12h14",
    egg_alt:"M12 3c3.6 0 6.5 5.4 6.5 10a6.5 6.5 0 0 1-13 0C5.5 8.4 8.4 3 12 3z",
  });
}catch(e){}

/* ---------- 3.1 Trạng thái riêng: state.nutriPro ---------- */
function NPS(){
  if(!state.nutriPro || typeof state.nutriPro !== "object") state.nutriPro = {};
  const s = state.nutriPro;
  if(!s.swaps || typeof s.swaps !== "object") s.swaps = {};
  if(!Array.isArray(s.recent)) s.recent = [];
  if(!Array.isArray(s.fav)) s.fav = [];
  if(!Array.isArray(s.custom)) s.custom = [];
  if(!(Number(s.shopPeople) >= 1 && Number(s.shopPeople) <= 20)) s.shopPeople = 1;
  if(!_npCleaned.has(s.custom) || !_npCleaned.has(s.recent) || !_npCleaned.has(s.fav)) npCleanState(s);
  return s;
}
/* =====================================================================
   R3-NUT-01/02 (14/11/2026) — LÀM SẠCH state.nutriPro (món tự tạo, gần đây, yêu thích)
   Nguồn: localStorage cũ, khôi phục Google Drive, đồng bộ cloud → KHÔNG tin kiểu dữ liệu.
   Trước: 1 phần tử null trong `custom` làm nutrition-pro.js ném lỗi NGAY LÚC NẠP (mất cả thực đơn Pro);
   `emoji`, `units[].g`, `recent[].g` kiểu chuỗi được chèn thô vào HTML (XSS lưu trữ qua bản sao lưu).
   Quy ước món tự tạo: id "cf-…" (không được trùng mã thực phẩm có sẵn), tên ≤ 60 ký tự, /100 g: kcal 0–900,
   đạm/tinh bột/béo/xơ 0–100 g; đơn vị ≤ 6, nhãn ≤ 24 ký tự, 1–3.000 g. Mỗi mảng chỉ làm sạch 1 lần (WeakSet).
   ===================================================================== */
const _npCleaned = new WeakSet();
const NP_CF_ID = /^cf-[a-z0-9-]{1,40}$/;
function npClampNum(v, min, max, dflt){
  const n = typeof v === "number" ? v : (typeof v === "string" && v.trim() !== "" ? Number(v.trim().replace(",", ".")) : NaN);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}
function npCleanCustom(c){
  if(!c || typeof c !== "object" || Array.isArray(c)) return null;
  if(typeof c.id !== "string" || !NP_CF_ID.test(c.id)) return null;
  const name = String(c.name == null ? "" : c.name).replace(/\s+/g, " ").trim().slice(0, 60);
  if(!name) return null;
  const out = { id: c.id, name,
    kcal: npClampNum(c.kcal, 0, 900, 0), protein: npClampNum(c.protein, 0, 100, 0), carbs: npClampNum(c.carbs, 0, 100, 0),
    fat: npClampNum(c.fat, 0, 100, 0), fiber: npClampNum(c.fiber, 0, 100, 0) };
  const units = (Array.isArray(c.units) ? c.units : []).filter(u=> u && typeof u === "object")
    .map(u=> ({ label: String(u.label == null ? "" : u.label).replace(/\s+/g, " ").trim().slice(0, 24), g: npClampNum(u.g, 1, 3000, NaN) }))
    .filter(u=> u.label && Number.isFinite(u.g)).slice(0, 6);
  out.units = units.length ? units : [{ label:"1 phần", g:100 }];
  return out;
}
function npCleanState(s){
  /* món tự tạo: sửa TẠI CHỖ (giữ tham chiếu `ex` đang mở trong form), bỏ phần tử hỏng / trùng id */
  const seen = new Set();
  for(let i = s.custom.length - 1; i >= 0; i--){
    const c = s.custom[i], ok = npCleanCustom(c);
    if(!ok || seen.has(ok.id)){ s.custom.splice(i, 1); continue; }
    seen.add(ok.id);
    Object.keys(c).forEach(k=>{ if(!(k in ok)) delete c[k]; });
    Object.assign(c, ok);
  }
  if(s.custom.length > 300) s.custom.length = 300;
  s.recent = s.recent.filter(e=> e && typeof e === "object" && (e.t === "f" || e.t === "r") && typeof e.id === "string" && e.id.length <= 80).slice(0, 24).map(e=>{
    const o = { t: e.t, id: e.id, ts: npClampNum(e.ts, 0, 4e12, 0), g: Math.round(npClampNum(e.g, 0, 10000, 0)) };
    if(e.t === "r") o.f = npClampNum(e.f, 0.1, 5, 1);
    else { const q = npClampNum(e.q, 0, 1000, 0); if(typeof e.u === "string" && e.u && q > 0){ o.u = e.u.slice(0, 24); o.q = q; } else { o.u = null; o.q = null; } }
    return o;
  });
  s.fav = s.fav.filter(k=> typeof k === "string" && /^[fr]:.{1,80}$/.test(k)).slice(0, 60);
  if(s.shopDone != null && (typeof s.shopDone !== "object" || Array.isArray(s.shopDone))) delete s.shopDone;
  if(s.hideKcal != null && typeof s.hideKcal !== "boolean") delete s.hideKcal;
  _npCleaned.add(s.custom); _npCleaned.add(s.recent); _npCleaned.add(s.fav);
}
function save(){ try{ saveState(); }catch(e){} }
const esc = s => (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])));
const fold = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
const vn = n => (Math.round(n*10)/10).toLocaleString("vi-VN");
const DAYS = ["T2","T3","T4","T5","T6","T7","CN"];
const mealLabel = id => (MEAL_TYPES.find(m=>m.id===id)||{label:id}).label;
const ICON = n => `<span class="material-symbols-rounded">${n}</span>`;
/* Vòng 2 — "Ẩn số calo" (nuHideKcal ở nutrition.js: mặc định BẬT khi sàng lọc khai tiền sử rối loạn ăn uống, người dùng tắt được):
   mọi chỗ hiện kcal trong thực đơn / thêm món / chi tiết món / đi chợ / thông báo đi qua 2 hàm này */
const hideK = ()=>{ try{ return typeof nuHideKcal === "function" && !!nuHideKcal(); }catch(e){ return false; } };
const kcalTxt = n => hideK() ? "" : ` · ${Math.round(Number(n)||0).toLocaleString("vi-VN")} kcal`;
/* (i) cạnh số đạm — mở giải thích "Vì sao đạm X g?" */
const whyBtn = g => `<button type="button" class="nu-why" data-nu-why="protein" aria-label="Vì sao đạm ${esc(g)} g?">${ICON("info")}</button>`;

/* Món tự tạo → đưa vào FOODS để tìm kiếm & tính toán như thực phẩm thường */
function syncCustomFoods(){
  const list = NPS().custom;
  for(let i=FOODS.length-1; i>=0; i--) if(FOODS[i].custom && !list.some(c=>c.id===FOODS[i].id)) FOODS.splice(i, 1);
  list.forEach(c=>{
    if(!c || typeof c !== "object" || !NP_CF_ID.test(String(c.id))) return;          // R3-NUT-02: không ghi đè thực phẩm có sẵn
    const obj = Object.assign({}, c, { emoji:"🍽️", custom:true });
    const ex = FOODS.find(f=>f.id===c.id);
    if(ex && !ex.custom) return;
    if(ex) Object.assign(ex, obj); else FOODS.push(obj);
  });
}
try{ syncCustomFoods(); }catch(e){ try{ console.warn("nutrition-pro: món tự tạo", e); }catch(_){} }   // R3-NUT-01: không để dữ liệu hỏng chặn cả file

/* Thẻ lọc "Thuần chay" trong danh sách món */
try{
  if(typeof RECIPE_TAGS !== "undefined" && !RECIPE_TAGS.some(t=>t.id==="thuan-chay")){
    const i = RECIPE_TAGS.findIndex(t=>t.id==="chay");
    RECIPE_TAGS.splice(i >= 0 ? i+1 : RECIPE_TAGS.length, 0, { id:"thuan-chay", label:"Thuần chay", emoji:"🌱" });
  }
}catch(e){}

/* Emoji riêng của thực phẩm mới (cà tím không phải cá 🐟, đậu gà không phải gà 🍗…) */
try{
  if(typeof foodEmoji === "function"){
    const _fe = foodEmoji;
    foodEmoji = function(x){ const f = food(x) || FOODS.find(f=>f.name===x); return f && f.emoji ? f.emoji : _fe(x); };
  }
}catch(e){}

/* recipeMacros: thêm chất xơ */
try{
  if(typeof recipeMacros === "function"){
    const _rm = recipeMacros;
    recipeMacros = function(r){ const m = _rm(r); m.fiber = r1(itemsMacros(r && r.items).fb); return m; };
  }
}catch(e){}

/* ---------- 3.2 Tiện ích ghi nhật ký ---------- */
function macrosOf(items){ const m = itemsMacros(items); return { kcal:Math.round(m.k), protein:r1(m.p), carbs:r1(m.c), fat:r1(m.f), fiber:r1(m.fb), grams:Math.round(m.g) }; }
function entryFiber(it){
  if(typeof it.fiber === "number") return it.fiber;
  if(it.recipe){ const r = RECIPES.find(x=>x.id===it.recipe); if(r){ const b = recipeBase(r); return b.g ? b.fb*(it.grams||b.g)/b.g : 0; } }
  const f = (it.foodId && food(it.foodId)) || FOODS.find(x=>x.name===it.name);
  return f ? (f.fiber||0)*(Number(it.grams)||0)/100 : 0;
}
function pushRecent(e){
  const s = NPS();
  s.recent = [Object.assign({ ts:Date.now() }, e)].concat(s.recent.filter(x=> !(x.t===e.t && x.id===e.id))).slice(0, 24);
}
const favKey = (t, id)=> t + ":" + id;
const isFav = (t, id)=> NPS().fav.includes(favKey(t, id));
function toggleFav(t, id){
  const s = NPS(), k = favKey(t, id);
  s.fav = s.fav.includes(k) ? s.fav.filter(x=>x!==k) : [k].concat(s.fav).slice(0, 60);
  save(); return s.fav.includes(k);
}
function logFood(f, grams, mealId, unit){
  const m = macrosOf([[f.id, grams]]);
  const L = getDayFoodLog()[mealId];
  L.push({ name:f.name, foodId:f.id, grams:Math.round(grams), kcal:m.kcal, protein:m.protein, carbs:m.carbs, fat:m.fat, fiber:m.fiber, unit: unit ? unit.label : undefined, qty: unit ? unit.q : undefined });
  pushRecent({ t:"f", id:f.id, g:Math.round(grams), u: unit ? unit.label : null, q: unit ? unit.q : null });
  if(typeof nuUI !== "undefined") nuUI.open[mealId] = true;
  return m;
}
function scaleItems(items, k){ return items.map(([id,g])=>[id, Math.max(1, Math.round(g*k))]); }
/* Ghi 1 món (đã scale) + các món phụ đi kèm thành từng dòng riêng trong nhật ký */
function logRecipe(r, mealId, mult, extra){
  mult = mult || 1;
  const base = scaleItems(r.baseItems || r.items, mult);
  const m = macrosOf(base);
  const L = getDayFoodLog()[mealId];
  L.push(Object.assign({ name:r.name, recipe:r.id, grams:m.grams, kcal:m.kcal, protein:m.protein, carbs:m.carbs, fat:m.fat, fiber:m.fiber }, extra||{}));
  let total = m.kcal;
  (r.extras || []).forEach(e=>{
    const f = food(e.id); if(!f) return;
    const g = Math.round(e.g*mult), em = macrosOf([[e.id, g]]);
    L.push(Object.assign({ name:f.name, foodId:f.id, grams:g, kcal:em.kcal, protein:em.protein, carbs:em.carbs, fat:em.fat, fiber:em.fiber }, extra||{}));
    total += em.kcal;
  });
  const bg = (RECIPES.find(x=>x.id===r.id)||r);
  const fct = r1((r.factor||1)*mult);
  pushRecent({ t:"r", id:r.id, f:fct, g:Math.round(recipeBase(bg).g*fct) });
  if(typeof nuUI !== "undefined") nuUI.open[mealId] = true;
  return total;
}
try{
  if(typeof addRecipeToLog === "function"){
    addRecipeToLog = function(r, meal){ logRecipe(r, meal, 1); save(); };
  }
}catch(e){}

/* Gợi ý đơn vị thân thiện: 100 g trứng → "2 quả"; 195 g cơm → "≈ 1,3 chén (bát) cơm" */
function unitHint(id, g){
  const f = food(id); if(!f || !f.units || !g) return "";
  for(const u of f.units){
    const n = g/u.g; if(n < 0.5 || n > 12) continue;
    if(Math.abs(n*2 - Math.round(n*2)) < 0.12) return `${vn(Math.round(n*2)/2)} ${u.label.replace(/^1 /,"")}`;
  }
  const u = f.units[0], n = g/u.g;
  return n >= 0.3 && n <= 10 ? `≈ ${vn(n)} ${u.label.replace(/^1 /,"")}` : "";
}

/* ---------- 3.3 Chất xơ trên thẻ macro ---------- */
function fiberTarget(){ return npTargets(state.profile).FB; }     // QN-23: cùng công thức (có trần) với thực đơn
function injectFiber(){
  const box = $("#nu-content .nu-macros"); if(!box || !box.parentNode || box.parentNode.querySelector(".np-fiber")) return;   // ẩn số calo: không có thẻ macro
  let fb = 0; Object.values(getDayFoodLog()).forEach(l=> l.forEach(it=> fb += entryFiber(it)));
  const tgt = fiberTarget(), pct = Math.min(100, fb/tgt*100);
  box.insertAdjacentHTML("afterend", `
    <button class="np-fiber" id="np-fiber" aria-label="Chất xơ: ${Math.round(fb)} trên ${tgt} gam — xem gợi ý">
      <div class="np-fiber-top"><span>Chất xơ</span><b>${Math.round(fb)}<small>/${tgt}g</small></b><em>≈ 14 g cho mỗi 1.000 kcal</em></div>
      <div class="nu-bar"><i style="width:${pct}%;background:#9AF1DD"></i></div>
    </button>`);
  $("#np-fiber").addEventListener("click", openFiberTips);
}
function openFiberTips(){
  const tgt = fiberTarget();
  const picks = [["oi",180],["dau-lang",150],["dau-den",150],["hat-chia",12],["yen-mach",40],["bong-cai-xanh",100],["khoai-lang",150],["tao",180],["com-gao-lut",150],["banh-mi-nguyen-cam",60]]
    .filter(([id])=>food(id)).map(([id,g])=>({ f:food(id), g, fb:(food(id).fiber||0)*g/100 })).sort((a,b)=>b.fb-a.fb);
  openSheet(`
    <div class="sheet-header"><h3>Chất xơ mỗi ngày</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ICON("close")}</button></div>
    <p class="np-p">Mục tiêu của bạn: <b>${tgt} g/ngày</b> (14 g cho mỗi 1.000 kcal, tối đa ${npFiberCap(state.profile)} g — khuyến nghị của Viện Y học Hoa Kỳ). Chất xơ giúp no lâu, ổn định đường huyết và tốt cho đường ruột — rất có lợi khi giảm mỡ.</p>
    <div class="card-title" style="font-size:13px;margin-top:12px;">Nguồn chất xơ dễ tìm (1 phần thường ăn)</div>
    ${picks.map(x=>`<div class="nu-item"><span class="e">${foodPic(x.f.id)}</span><div class="t"><b>${esc(x.f.name)}</b><small>${x.g} g${unitHint(x.f.id, x.g) ? " · "+esc(unitHint(x.f.id, x.g)) : ""}</small></div><b class="np-fbv">${vn(x.fb)} g</b></div>`).join("")}
    <div class="nu-tip"><span class="material-symbols-rounded">lightbulb</span><span>Tăng chất xơ từ từ trong 1–2 tuần và uống đủ nước để tránh đầy bụng.</span></div>`);
}

/* ---------- 3.4 Thẻ "Thực đơn gợi ý" ---------- */
const effGoal = p => npEffGoal(p);                          // QN-02: thai kỳ / cho bú / RLĂU / < 18 / thiếu cân → "duy trì"
const curDay = ()=> (typeof nuUI !== "undefined" && nuUI.planDay != null) ? nuUI.planDay : (new Date().getDay()+6)%7;
function dietPrefs(){
  const s = NPS();
  const vegan = !!s.vegan;
  return { cuisine: (typeof nuUI !== "undefined" && nuUI.planCuisine) || "all", veg: vegan || !!(typeof nuUI !== "undefined" && nuUI.planVeg), vegan };
}
const prefSig = pr => [pr.veg?1:0, pr.vegan?1:0, pr.cuisine, effGoal(state.profile)].join("|");
/* QN-26: món đã đổi chỉ áp cho tuần hiện tại — bản lưu cũ (chưa có wk) được gắn tuần này rồi tự hết hạn sau Chủ nhật */
function activeSwaps(di, pr){
  const S = NPS(), x = S.swaps[di], wk = npWeekKey();
  if(x && !x.wk){ x.wk = wk; }
  if(x && x.wk !== wk){ delete S.swaps[di]; return null; }
  return x && x.sig === prefSig(pr) && x.meals ? x.meals : null;
}
function planPrefs(di){ const pr = dietPrefs(); const sw = activeSwaps(di, pr); if(sw) pr.swaps = sw; return pr; }
let _lastPlan = null;
let _rerenderPlan = null;            // QN-21: trỏ tới rerenderPlanCard (khai báo trong khối try bên dưới)
function getPlan(di){
  const pr = planPrefs(di);
  const plan = buildDayPlan(state.profile, di, pr);
  _lastPlan = { di, plan, sig: JSON.stringify(pr) };
  return plan;
}
/* đồng bộ "Chỉ món chay" (nuUI, bộ nhớ tạm) với state để giữ sau khi mở lại app */
if(typeof nuUI !== "undefined" && NPS().veg) nuUI.planVeg = true;

function sumChip(label, val, tgt, unit, okLo, okHi){
  const r = tgt ? val/tgt : 0, ok = r >= okLo && r <= okHi;
  return `<div class="np-sum-i ${ok?'ok':'off'}"><small>${label}</small><b>${Math.round(val).toLocaleString("vi-VN")}<i>/${Math.round(tgt).toLocaleString("vi-VN")}${unit}</i></b></div>`;
}
/* QU-03 (vòng 2): lần đầu mở Dinh dưỡng không còn đơ vì thuật toán thực đơn.
   · Thực đơn (ngày, hồ sơ, tuỳ chọn) đã nhớ (bộ nhớ / localStorage) → vẽ thẻ ngay.
   · Chưa có → vẽ khung chờ, rồi lúc RẢNH tính từng ngày một (các ngày trước — "trí nhớ tuần" — rồi ngày đang xem), vẽ thẻ;
     sau đó tiếp tục tính sẵn các ngày còn lại để "Đi chợ tuần" và chuyển ngày mở tức thì. Mỗi bước 1 ngày → luồng chính không bị chiếm lâu. */
let _planPending = false, _warm = null, _warmSeq = 0;
function npWarmRun(steps){
  const seq = ++_warmSeq;
  _warm = { seq, steps: steps.slice() };
  const pump = ()=>{
    if(!_warm || _warm.seq !== seq) return;                   // đã có lượt vẽ mới thay thế
    const st = _warm.steps.shift();
    if(st){ try{ st(); }catch(e){ console.warn("nutrition-pro: tính thực đơn lúc rảnh", e); } }
    if(_warm && _warm.seq === seq){ if(_warm.steps.length) npIdle(pump); else _warm = null; }
  };
  npIdle(pump);
}
/* chạy ngay mọi việc còn chờ (kiểm thử / trước khi mở "Đi chợ") */
function npFlushIdle(){
  let n = 0;
  while(_warm && _warm.steps.length && n < 64){ const w = _warm, st = w.steps.shift(); try{ st(); }catch(e){} n++; if(_warm !== w) continue; }
  _warm = null;
  return n;
}
function weekWarmSteps(skipDi){
  const out = [];
  for(let d = 0; d < 7; d++) if(d !== skipDi) out.push(()=>{ buildDayPlan(state.profile, d, planPrefs(d)); });
  return out;
}
function npPlanSlotHTML(){
  const di = curDay(), pr = planPrefs(di);
  if(npPlanCached(state.profile, di, pr)){
    _planPending = false;
    const html = nuPlanCardHTML();
    const rest = []; for(let d = 0; d < 7; d++) if(d !== di && !npPlanCached(state.profile, d, planPrefs(d))) rest.push(d);
    if(rest.length) npWarmRun(rest.map(d=> ()=>{ buildDayPlan(state.profile, d, planPrefs(d)); }));   // "Đi chợ" sẵn sàng lúc rảnh
    return html;
  }
  _planPending = true;
  const base = Object.assign({}, pr, { swaps:null });
  const steps = [];
  for(let d = 0; d < di; d++) steps.push(()=>{ buildDayPlan(state.profile, d, base); });      // "trí nhớ tuần" của ngày đang xem
  steps.push(()=>{ buildDayPlan(state.profile, di, pr); });                                   // ngày đang xem (đã có "trí nhớ tuần")
  steps.push(()=>{ if(typeof _rerenderPlan === "function") _rerenderPlan(); else { _planPending = false; renderNutritionScreen(); } });
  npWarmRun(steps.concat(weekWarmSteps(di)));
  return `<div class="nu-plan np-plan np-wait" aria-busy="true" aria-live="polite">
    <div class="np-wait-h">${ICON("restaurant")}<span><b>Thực đơn gợi ý cho bạn</b><small>Đang soạn thực đơn theo hồ sơ của bạn…</small></span></div>
    <div class="np-skel"></div><div class="np-skel"></div><div class="np-skel"></div><div class="np-skel"></div>
  </div>`;
}
G.nuPlanSlotHTML = npPlanSlotHTML;

try{
nuPlanCardHTML = function(){
  const p = state.profile;
  const a = bodyAnalysis(p);
  const gd = typeof goalDisplay === "function" ? goalDisplay(p) : { label:(GOALS.find(g=>g.id===p.goal)||GOALS[1]).label, safe:false };
  const goalDef = GOALS.find(g=>g.id===p.goal) || GOALS[1];
  const recDef = GOALS.find(g=>g.id===a.rec);
  /* QN-02: không mời đổi mục tiêu khi app đã chặn thâm hụt (thai kỳ, cho bú, RLĂU, < 18) */
  const mismatch = recDef && a.rec !== p.goal && a.cat !== "Bình thường" && !gd.safe && !(p.age && p.age < 18) && !a.hideBmi;
  const di = curDay();
  const pr = dietPrefs();
  const plan = getPlan(di);
  const T = npTargets(p), t = planTotals(plan);
  const SF = npSafety(pr); T.pCap = SF.pCap;                          // QN-01: trần đạm bệnh thận → ô Đạm chỉ "đạt" khi ≤ +5 %
  const swapped = !!activeSwaps(di, pr);
  const changed = swapped ? (NPS().swaps[di].changed || []) : [];
  const cz = pr.cuisine;
  const bmiTxt = a.bmi && !a.hideBmi ? vn(a.bmi) : "—";                // QN-20: 22,6 thay vì 22.6
  const hk = hideK();                                                   // vòng 2: "Ẩn số calo"
  const notes = [];
  if(T.capped) notes.push(hk ? "Mục tiêu năng lượng trong hồ sơ cao bất thường — thực đơn gợi ý dùng mức tối đa của app. Hãy kiểm tra lại chiều cao, cân nặng trong Hồ sơ." : `Mục tiêu <b>${vn(T.capped)} kcal</b> cao bất thường — thực đơn gợi ý dùng tối đa <b>${vn(T.K)} kcal</b>. Hãy kiểm tra lại chiều cao, cân nặng trong Hồ sơ.`);
  if(T.floored) notes.push(hk ? "Mục tiêu bạn tự đặt thấp hơn mức an toàn tối thiểu — thực đơn gợi ý dùng mức an toàn." : `Mục tiêu bạn tự đặt (<b>${vn(T.floored)} kcal</b>) thấp hơn mức an toàn tối thiểu — thực đơn gợi ý dùng <b>${vn(T.K)} kcal</b>.`);
  if(T.macroFixed) notes.push(hk ? "Đạm/tinh bột/béo tự chỉnh chưa cân đối — thực đơn dùng tỉ lệ cân bằng." : `Đạm/tinh bột/béo tự chỉnh cộng lại ≈ ${vn(T.macroK)} kcal, không khớp ${vn(T.K)} kcal — thực đơn dùng đạm ${T.P} g · tinh bột ${T.C} g · béo ${T.F} g.`);
  const nn = p.nutriNotes || [];
  if(nn.includes("age60")) notes.push(`Đạm ${p.protein} g ≈ 1,2 g/kg — mức khuyến nghị cho người từ 60 tuổi (PROT-AGE).`);
  if(nn.includes("nearUnderBlock")) notes.push("BMI của bạn sát ngưỡng thiếu cân — giảm tiếp có thể xuống dưới 18,5 trong 4 tuần, nên app giữ calo ở mức duy trì.");
  else if(nn.includes("nearUnder") || p.goalCapped) notes.push("BMI của bạn sát ngưỡng thiếu cân — app chỉ cho ăn thiếu tối đa 10 % để an toàn.");
  if(SF.pCap) notes.push(`Đạm thực đơn được giữ <b>không vượt ${T.P} g</b> (giới hạn cho bệnh thận); năng lượng còn lại bù bằng cơm, khoai, bánh mì, trái cây và dầu thực vật.`);
  return `
  <div class="nu-plan np-plan">
    <div class="nu-plan-head">
      <div class="nu-bmi" style="--c:${esc(a.color)}"><b>${bmiTxt}</b><small>BMI</small></div>
      <div class="nu-plan-txt"><b>${esc(a.cat)}${a.bmi?` · ${esc(vn(p.weight))} kg, ${esc(vn(p.height))} cm`:""}</b><small>${esc(a.advice)}</small></div>
    </div>
    ${mismatch ? `<button class="nu-plan-switch" data-switch-goal="${esc(a.rec)}"><span class="material-symbols-rounded">swap_horiz</span>Mục tiêu hiện tại là "${esc(goalDef.label)}". Chuyển sang "${esc(recDef.label)}"?</button>` : ""}
    ${p.goalBlocked ? `<div class="nu-tip" style="margin-top:10px;"><span class="material-symbols-rounded">lightbulb</span><span>Bạn đang thiếu cân hoặc dưới 18 tuổi nên app <b>không áp dụng thâm hụt calo</b> — calo được giữ ở mức duy trì để an toàn.</span></div>` : ""}
    ${notes.length ? `<div class="np-notes">${notes.map(n=>`<p>${n}</p>`).join("")}</div>` : ""}
    <div class="nu-plan-goal"><span>Mục tiêu: <b>${esc(gd.label)}</b></span><span class="np-goal-k">${hk ? "Đủ năng lượng cả ngày" : `<b>${vn(T.K)}</b> kcal/ngày`} · đạm ${esc(T.P)} g${whyBtn(T.P)}</span></div>
    <div class="section-title" style="margin:12px 0 6px;"><h3 style="font-size:16px;">Thực đơn gợi ý cho bạn</h3>
      <a data-plan-cz="${cz==="all"?"vn":(cz==="vn"?"au":"all")}" role="button" tabindex="0">${cz==="all"?"Việt + Âu":(cz==="vn"?"Chỉ món Việt":"Chỉ món Âu")} ⇄</a></div>
    <div class="nu-plan-opts np-opts">
      <button class="${pr.veg && !pr.vegan ?'on':''}" data-plan-veg aria-pressed="${pr.veg && !pr.vegan}">🥬 Chỉ món chay</button>
      <button class="${pr.vegan?'on':''}" data-np-vegan aria-pressed="${pr.vegan}">🌱 Thuần chay</button>
      <button class="np-shop-btn" data-np-shop>${ICON("shopping_cart")}Đi chợ tuần</button>
    </div>
    ${pr.vegan ? `<p class="np-note">Thuần chay: không thịt cá, trứng, sữa, mật ong. Đạm đến từ đậu hũ, tempeh, mì căn, đậu các loại; nhớ bổ sung vitamin B12.</p>` : ""}
    <div class="nu-plan-days">${DAYS.map((d,i)=>`<button class="${i===di?'on':''}" data-plan-day="${i}" aria-pressed="${i===di}">${d}</button>`).join("")}</div>
    <div class="nu-plan-meals">${MEAL_TYPES.map(mt=>{ const r = plan[mt.id]; if(!r) return ""; const m = macrosOf(r.items); const cm = COOK_METHODS[r.method] || COOK_METHODS.boil; return `
      <div class="nu-plan-meal np-pm" data-plan-open="${mt.id}" role="button" tabindex="0">
        <div class="ph">${foodPic(r.id)}</div>
        <div class="t"><small>${mt.label} · ${cm.label}${changed.includes(mt.id) ? " · đã đổi" : ""}</small><b>${esc(r.name)}</b>
          ${r.extras && r.extras.length ? `<em class="np-extra">+ ${r.extras.map(e=>esc(e.label)).join(" · ")}</em>` : ""}</div>
        ${hk ? "" : `<div class="k"><b>${m.kcal}</b><small>kcal</small><small>${Math.round(m.protein)}g đạm</small></div>`}
        <button class="np-swap" data-np-swap="${mt.id}" aria-label="Đổi món ${mt.label.toLowerCase()}">${ICON("swap_horiz")}</button>
      </div>`; }).join("")}</div>
    ${hk ? `<p class="np-note np-plate-note">Thực đơn đã cân đủ <b>đạm, tinh bột, rau – trái cây và chất béo tốt</b> cho nhu cầu của bạn — ăn đều các bữa, không cần đếm số.</p>` : `
    <div class="np-sum" aria-label="Tổng thực đơn so với mục tiêu">
      ${sumChip("Calo", t.k, T.K, "", .95, 1.05)}${sumChip("Đạm", t.p, T.P, "g", .85, T.pCap ? 1.05 : 1.15)}${sumChip("Tinh bột", t.c, T.C, "g", .85, 1.15)}${sumChip("Béo", t.f, T.F, "g", .75, 1.25)}${sumChip("Xơ", t.fb, T.FB, "g", .8, 9)}
    </div>
    <p class="np-sum-legend"><i class="ok"></i>trong khoảng mục tiêu <i class="off"></i>lệch nhiều</p>`}
    ${swapped ? `<button class="np-reset" data-np-reset>${ICON("restart_alt")}Khôi phục gợi ý gốc của ${DAYS[di]}</button>` : ""}
    <div class="nu-plan-foot"><span>Món phụ <b>+</b> được thêm để đủ đạm &amp; calo thay vì phóng to khẩu phần. Món đổi chỉ áp cho tuần này.</span>
      <button class="btn btn-primary btn-sm" id="nu-plan-apply"><span class="material-symbols-rounded">playlist_add</span>${di===(new Date().getDay()+6)%7 ? "Ghi vào hôm nay" : `Ghi thực đơn ${DAYS[di]} vào hôm nay`}</button></div>
  </div>`;
};

/* QN-21: chỉ vẽ lại THẺ THỰC ĐƠN (không vẽ cả màn ~2.000 nút) khi đổi ngày / chay / thuần chay / ẩm thực */
function rerenderPlanCard(){
  _planPending = false;
  const box = document.querySelector("#nu-content .nu-plan");
  if(!box || typeof box.insertAdjacentHTML !== "function" || !box.parentNode){ renderNutritionScreen(); return; }
  const tmp = document.createElement("div");
  tmp.innerHTML = nuPlanCardHTML();
  const fresh = tmp.firstElementChild;
  if(!fresh){ renderNutritionScreen(); return; }
  box.replaceWith(fresh);
  bindPlanCard(fresh);
}
_rerenderPlan = rerenderPlanCard;


bindPlanCard = function(el){
  if(_planPending) return;                                     // QU-03: khung chờ — chưa có nút để gắn, không tính thực đơn đồng bộ
  const p = state.profile;
  const di = curDay();
  const pr = planPrefs(di);
  const plan = (_lastPlan && _lastPlan.di === di && _lastPlan.sig === JSON.stringify(pr)) ? _lastPlan.plan : buildDayPlan(p, di, pr);
  const rerender = ()=> renderNutritionScreen();
  const q = sel => (el && el.querySelectorAll) ? [...el.querySelectorAll(sel)] : $$(sel, el);
  q("[data-plan-day]").forEach(b=> b.addEventListener("click", ()=>{ nuUI.planDay = Number(b.dataset.planDay); rerenderPlanCard(); }));
  q("[data-plan-veg]").forEach(b=> b.addEventListener("click", ()=>{
    const s = NPS();
    if(s.vegan){ s.vegan = false; nuUI.planVeg = true; }        // đang thuần chay → chuyển về chay (có trứng sữa)
    else nuUI.planVeg = !nuUI.planVeg;
    s.veg = !!nuUI.planVeg; save(); rerenderPlanCard();
  }));
  q("[data-np-vegan]").forEach(b=> b.addEventListener("click", ()=>{
    const s = NPS(); s.vegan = !s.vegan; if(s.vegan){ nuUI.planVeg = true; s.veg = true; }
    save(); rerenderPlanCard();
    toast(s.vegan ? "Đã bật thực đơn thuần chay" : "Đã tắt thuần chay", "eco");
  }));
  q("[data-plan-cz]").forEach(b=> b.addEventListener("click", ()=>{ nuUI.planCuisine = b.dataset.planCz; rerenderPlanCard(); }));
  q("[data-plan-open]").forEach(b=> b.addEventListener("click", e=>{
    if(e.target.closest("[data-np-swap]")) return;
    const meal = b.dataset.planOpen; if(plan[meal]) openRecipe(plan[meal].id, plan[meal], { meal, di, fromPlan:true });
  }));
  q("[data-np-swap]").forEach(b=> b.addEventListener("click", e=>{ e.stopPropagation(); openSwapSheet(di, b.dataset.npSwap); }));
  q("[data-np-shop]").forEach(b=> b.addEventListener("click", openShoppingList));
  q(".nu-plan [data-nu-why], .nu-plan-goal [data-nu-why]").forEach(b=> b.addEventListener("click", e=>{ e.stopPropagation(); openProteinWhy(); }));
  q("[data-np-reset]").forEach(b=> b.addEventListener("click", ()=>{ delete NPS().swaps[di]; save(); rerenderPlanCard(); toast("Đã khôi phục thực đơn gợi ý", "restart_alt"); }));
  q("[data-switch-goal]").forEach(b=> b.addEventListener("click", ()=>{
    p.goal = b.dataset.switchGoal; p.autoTargets = true; recomputeProfile(); save(); rerender();
    toast(`Đã đổi mục tiêu: ${GOALS.find(g=>g.id===p.goal).label} · ${p.goalKcal} kcal/ngày`, "check_circle");
  }));
  const ap = (el && el.querySelector && el.querySelector("#nu-plan-apply")) || $("#nu-plan-apply");
  if(ap) ap.addEventListener("click", ()=>{
    const L = getDayFoodLog();
    const already = Object.values(L).some(list=> list.some(it=> it.fromPlan));
    const go = ()=>{
      ap.disabled = true;
      let total = 0;
      Object.entries(plan).forEach(([meal, r])=>{ total += logRecipe(r, meal, 1, { fromPlan:true }); });
      save(); rerender(); toast(`Đã ghi thực đơn vào nhật ký HÔM NAY${kcalTxt(total)}`, "restaurant");
    };
    if(already) confirmDialog("Ghi thêm thực đơn?", "Hôm nay bạn đã ghi một thực đơn gợi ý rồi. Ghi thêm sẽ cộng dồn calo.", go, "Ghi thêm", "playlist_add"); else go();
  });
};
}catch(e){ console.warn("nutrition-pro: thẻ thực đơn", e); }

/* ---------- 3.5 Đổi món (giữ calo bữa đó, các bữa khác giữ nguyên) ---------- */
function openSwapSheet(di, meal){
  const p = state.profile, pr = planPrefs(di);
  const cur = buildDayPlan(p, di, pr);
  if(!cur[meal]) return;
  const lock = {}; Object.keys(cur).forEach(m=> lock[m] = cur[m].id);
  const goal = effGoal(p), T = npTargets(p);
  const prefPool = npPool(meal, goal, pr).filter(r=> r.id !== cur[meal].id);
  const allPool = npPool(meal, goal, pr, { all:true }).filter(r=> r.id !== cur[meal].id && !prefPool.includes(r));
  const evalAlt = r=>{
    const pl = buildDayPlan(p, di, Object.assign({}, pr, { swaps: Object.assign({}, lock, { [meal]: r.id }) }));
    const t = planTotals(pl), m = pl[meal] ? macrosOf(pl[meal].items) : { kcal:0, protein:0 };
    const dev = Math.abs(t.k-T.K)/T.K*2 + Math.abs(t.p-T.P)/T.P + Math.abs(t.c-T.C)/T.C*0.5;
    return { r, m, dev, extras: pl[meal] ? pl[meal].extras : [] };
  };
  const A = prefPool.map(evalAlt).sort((a,b)=> a.dev - b.dev);
  const B = allPool.map(evalAlt).sort((a,b)=> a.dev - b.dev);
  const goalName = goal==="lose" ? "giảm mỡ" : goal==="gain" ? "tăng cơ" : "duy trì";
  const row = (x, i, best)=> `
    <button class="np-row np-alt" data-np-pick="${x.r.id}" data-q="${esc(fold(x.r.name))}">
      <span class="np-pic">${foodPic(x.r.id, "fr-img")}</span>
      <span class="np-rt"><b>${esc(x.r.name)}</b><small>${hideK() ? "" : `${x.m.kcal} kcal · `}${Math.round(x.m.protein)}g đạm${x.extras.length ? " · có món phụ" : ""}${(x.r.tags||[]).includes("thuan-chay") ? " · 🌱" : ""}</small></span>
      ${best && i < 3 ? `<span class="np-badge">Hợp nhất</span>` : ""}
    </button>`;
  const curM = macrosOf(cur[meal].items);
  openSheet(`
    <div class="sheet-header"><h3>Đổi ${mealLabel(meal).toLowerCase()} · ${DAYS[di]}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ICON("close")}</button></div>
    <div class="np-cur"><span class="np-pic">${foodPic(cur[meal].id, "fr-img")}</span><span class="np-rt"><small>Đang chọn</small><b>${esc(cur[meal].name)}</b><small>${hideK() ? "" : `${curM.kcal} kcal · `}${Math.round(curM.protein)}g đạm</small></span></div>
    <p class="np-note">Món mới được chỉnh khẩu phần để <b>giữ calo</b> của bữa; món phụ tự cân lại cho đủ đạm. Các bữa khác giữ nguyên.</p>
    <div class="search-box" style="margin:8px 0 6px;"><span class="material-symbols-rounded" style="color:var(--text-dim);">search</span><input type="search" id="np-swap-q" placeholder="Tìm món…" autocomplete="off"></div>
    <div class="np-sec">Hợp mục tiêu ${goalName}${pr.vegan ? " · thuần chay" : pr.veg ? " · chay" : ""}</div>
    <div class="np-list">${A.map((x,i)=>row(x,i,true)).join("") || `<p class="empty-hint">Chưa có món khác phù hợp.</p>`}</div>
    ${B.length ? `<div class="np-sec">Món ${mealLabel(meal).toLowerCase()} khác</div><div class="np-list">${B.map((x,i)=>row(x,i,false)).join("")}</div>` : ""}
  `);
  $("#np-swap-q").addEventListener("input", e=>{
    const q = fold(e.target.value.trim());
    $$(".np-alt").forEach(b=> b.style.display = !q || b.dataset.q.includes(q) ? "" : "none");
  });
  $$("[data-np-pick]").forEach(b=> b.addEventListener("click", ()=>{
    const id = b.dataset.npPick;
    const prev = activeSwaps(di, pr) ? (NPS().swaps[di].changed || []) : [];
    NPS().swaps[di] = { sig: prefSig(pr), wk: npWeekKey(), meals: Object.assign({}, lock, { [meal]: id }), changed: prev.includes(meal) ? prev : prev.concat(meal) };
    save(); closeSheet();
    if(typeof _rerenderPlan === "function") _rerenderPlan(); else renderNutritionScreen();     // QN-21: chỉ vẽ lại thẻ thực đơn
    const nr = RECIPES.find(r=>r.id===id);
    toast(`Đã đổi sang ${nr ? nr.name : "món mới"} — khẩu phần đã cân lại`, "swap_horiz");
  }));
}

/* ---------- 3.6 Danh sách đi chợ 7 ngày ---------- */
const SHOP_CATS = [
  { id:"rau", label:"Rau củ & nấm", emoji:"🥬" }, { id:"trai-cay", label:"Trái cây", emoji:"🍎" },
  { id:"dam", label:"Thịt, cá, trứng", emoji:"🥩" }, { id:"chay", label:"Đậu & đạm thực vật", emoji:"🌱" },
  { id:"tinh-bot", label:"Tinh bột & ngũ cốc", emoji:"🍚" }, { id:"sua", label:"Sữa & chế phẩm", emoji:"🥛" },
  { id:"hat", label:"Hạt, dầu & gia vị", emoji:"🥜" }, { id:"mua-san", label:"Mua sẵn", emoji:"🛍️" }, { id:"khac", label:"Khác", emoji:"🧺" },
];
const SHOP_CAT_IDS = {
  rau:["rau-muong","cai-thia","cai-ngot","cai-bo-xoi","mong-toi","bap-cai","xa-lach","rau-thom","gia-do","dau-que","bong-cai-xanh","sup-lo","mang-tay","bi-do","bi-dao","muop","kho-qua","ca-tim","dau-bap","su-su","nam","nam-dong-co","ca-chua","dua-leo","ot-chuong","hanh-tay","ca-rot","kim-chi","dau-ha-lan"],
  "trai-cay":["chuoi","tao","cam","oi","kiwi","bo-avocado","nho","xoai","dua-hau","dau-tay","viet-quat","du-du","thanh-long","buoi","dua-thom","nuoc-dua","nuoc-cam"],
  chay:["dau-hu","dau-hu-non","dau-hu-ky","tempeh","mi-can","tvp","dau-nanh-luoc","dau-den","dau-lang","dau-ga","dau-xanh","dau-do","hummus"],
  "tinh-bot":["com-trang","com-gao-lut","xoi-trang","bun-pho","mien-dong","mi-goi","mi-y-nguyen-cam","banh-mi","banh-mi-nguyen-cam","banh-trang","tortilla","yen-mach","granola","quinoa","khoai-lang","khoai-tay","khoai-mon","khoai-mi","bap","banh-gao-lut"],
  sua:["sua-tuoi-khong-duong","sua-tuoi-co-duong","sua-tach-beo","sua-chua-khong-duong","sua-chua-hy-lap","pho-mai","pho-mai-tuoi","whey","protein-thuc-vat","sua-dau-nanh","sua-hanh-nhan"],
  hat:["hanh-nhan","oc-cho","hat-dieu","hat-bi","hat-chia","hat-lanh","me-vung","dau-phong","bo-dau-phong","dau-oliu","dau-an","dau-me","bo-dong-vat","mat-ong","duong-trang"],
};
function shopCat(id){
  for(const k in SHOP_CAT_IDS) if(SHOP_CAT_IDS[k].includes(id)) return k;
  const f = food(id);
  if(f && f.portion) return "mua-san";
  if(/^(uc-|dui-|thit-|ca-|tom|muc|ngheu|trung|gio-)/.test(id)) return "dam";
  return "khac";
}
/* Đồ đã nấu → lượng sống cần mua (hệ số theo USDA: gạo nở ~2,5 lần, thịt hao ~25–30 % khi nấu…) */
const SHOP_RAW = {
  /* QN-19: hệ số sống → chín theo tỉ lệ kcal USDA (khô ÷ chín): gạo lứt 367/112 ≈ 3,3 → 1/3; đậu xanh 347/105 ≈ 3,3;
     đậu lăng 352/116 ≈ 3,0; mì Ý nguyên cám 352/124 ≈ 2,8 (bản cũ 1/2,3–2,5 → mua dư ~20–35 %) */
  "com-trang":{ name:"Gạo trắng", k:1/2.5 }, "com-gao-lut":{ name:"Gạo lứt", k:1/3 }, "xoi-trang":{ name:"Gạo nếp", k:1/1.9 },
  "mi-y-nguyen-cam":{ name:"Mì Ý nguyên cám (khô)", k:1/2.8 }, "quinoa":{ name:"Hạt quinoa (khô)", k:1/2.8 },
  "dau-lang":{ name:"Đậu lăng (khô)", k:1/3 }, "dau-ga":{ name:"Đậu gà (khô)", k:1/2.4 }, "dau-den":{ name:"Đậu đen (khô)", k:1/2.4 },
  "dau-do":{ name:"Đậu đỏ (khô)", k:1/2.4 }, "dau-xanh":{ name:"Đậu xanh cà vỏ (khô)", k:1/3.3 },
  "uc-ga":{ name:"Ức gà (sống)", k:1.3 }, "dui-ga-bo-da":{ name:"Đùi gà bỏ da (thịt sống)", k:1.35 }, "dui-ga":{ name:"Đùi gà (sống)", k:1.3 },
  "thit-bo-nac":{ name:"Thịt bò nạc (sống)", k:1.35 }, "thit-bo-xay":{ name:"Bò xay nạc (sống)", k:1.3 }, "thit-heo-xay":{ name:"Thịt heo xay nạc (sống)", k:1.3 },
  "ca-thu":{ name:"Cá thu (khúc, sống)", k:1.25 }, "ca-ro-phi":{ name:"Cá rô phi phi lê (sống)", k:1.25 }, "ca-nuc":{ name:"Cá nục (cả con)", k:1.6 },
  "tom-luoc":{ name:"Tôm tươi (cả vỏ)", k:1.6 }, "muc":{ name:"Mực tươi", k:1.3 }, "ngheu":{ name:"Nghêu cả vỏ", k:8 },
};
const SHOP_COUNT = {
  "trung-ga":[50,"quả"], "trung-cut":[10,"quả"], "trung-trang":[33,"quả (lấy lòng trắng)"],
  "chuoi":[100,"quả"], "tao":[180,"quả"], "cam":[150,"quả"], "oi":[180,"quả"], "kiwi":[75,"quả"], "bo-avocado":[200,"quả"],
  "dua-leo":[150,"quả"], "ca-chua":[100,"quả"], "ot-chuong":[150,"quả"], "hanh-tay":[100,"củ"], "ca-rot":[80,"củ"],
  "khoai-lang":[150,"củ"], "khoai-tay":[150,"củ"], "bap":[150,"trái"], "thanh-long":[300,"quả"], "nuoc-dua":[300,"trái"],
  "banh-mi":[80,"ổ"], "banh-mi-nguyen-cam":[30,"lát"], "tortilla":[50,"cái"], "banh-gao-lut":[10,"cái"], "banh-trang":[10,"cái"], "mi-goi":[75,"gói"],
  "sua-tuoi-khong-duong":[185,"hộp 180 ml"], "sua-tach-beo":[185,"hộp 180 ml"], "sua-tuoi-co-duong":[185,"hộp 180 ml"], "sua-dau-nanh":[205,"hộp 200 ml"],
  "sua-chua-hy-lap":[100,"hũ 100 g"], "sua-chua-khong-duong":[100,"hũ 100 g"], "dau-hu":[150,"bìa"], "dau-hu-non":[300,"hộp"],
  "ca-ngu":[120,"hộp"], "whey":[30,"muỗng"], "protein-thuc-vat":[30,"muỗng"],
};
const SPOON = ["dau-oliu","dau-an","dau-me","mat-ong","bo-dau-phong","hummus","hat-chia","hat-lanh","me-vung"];
function shopQty(id, g){
  const c = SHOP_COUNT[id];
  if(c){ const n = Math.max(1, Math.ceil(g/c[0] - 0.15)); return { text:`${n} ${c[1]}`, sub:`≈ ${Math.round(g)} g` }; }
  if(SPOON.includes(id)){ const u = id.startsWith("dau-") ? 13 : 15; const n = Math.max(1, Math.ceil(g/u)); return { text:`${n} muỗng canh`, sub:`≈ ${Math.round(g)} g` }; }
  if(g >= 950) return { text:`${vn(Math.ceil(g/100)/10)} kg`, sub:"" };           // QN-19: 1 kg thay vì "1000 g"
  if(g >= 100) return { text:`${Math.ceil(g/50)*50} g`, sub:"" };
  return { text:`${Math.max(10, Math.ceil(g/10)*10)} g`, sub:"" };
}
/* QN-19: tên hàng cần MUA (đồ sống): bỏ chú thích cách nấu "(luộc)", "(xào)", "(đã nấu)"… */
function shopName(n){ return String(n||"").replace(/\s*\((?:[^()]*?)(luộc|xào|hấp|nướng|chín|đã nấu|đã đồ|kho)(?:[^()]*?)\)/i, "").trim() || n; }
/* dấu ✓ đã mua lưu theo tuần (không mất khi đổi số người / đóng sheet) */
function shopDone(){
  const S = NPS(), wk = npWeekKey();
  if(!S.shopDone || typeof S.shopDone !== "object" || S.shopDone.wk !== wk || !Array.isArray(S.shopDone.ids)) S.shopDone = { wk, ids:[] };
  return S.shopDone;
}
function npShoppingList(people){
  const p = state.profile, agg = {};
  let kcalWeek = 0;
  for(let d=0; d<7; d++){
    const plan = buildDayPlan(p, d, planPrefs(d));
    Object.values(plan).forEach(r=> r.items.forEach(([id, g])=>{ agg[id] = (agg[id]||0) + g*people; }));
    kcalWeek += planTotals(plan).k;
  }
  const rows = Object.keys(agg).map(id=>{
    const f = food(id); if(!f) return null;
    const raw = SHOP_RAW[id];
    const g = raw ? agg[id]*raw.k : agg[id];
    const q = shopQty(id, g);
    return { id, cat: shopCat(id), name: raw ? raw.name : shopName(f.name), q, g, cooked: raw && raw.k < 1 ? `nấu ra ≈ ${vn(agg[id]/1000)} kg` : "" };
  }).filter(Boolean);
  const groups = SHOP_CATS.map(c=> Object.assign({}, c, { rows: rows.filter(r=>r.cat===c.id).sort((a,b)=> b.g - a.g) })).filter(c=>c.rows.length);
  return { groups, count: rows.length, kcalDay: Math.round(kcalWeek/7) };
}
function shopText(L, people){
  const pr = dietPrefs(), goalDef = typeof goalDisplay === "function" ? goalDisplay(state.profile) : GOALS.find(g=>g.id===state.profile.goal);
  const head = `🛒 DANH SÁCH ĐI CHỢ 7 NGÀY (T2–CN) · ${people} người\nThực đơn TapEasy · ${goalDef ? goalDef.label : ""}${hideK() ? "" : ` · ~${L.kcalDay.toLocaleString("vi-VN")} kcal/người/ngày`}${pr.vegan ? " · thuần chay" : pr.veg ? " · chay" : ""}\n`;
  return head + L.groups.map(gr=> `\n${gr.emoji} ${gr.label.toUpperCase()}\n` + gr.rows.map(r=> `☐ ${r.name}: ${r.q.text}${r.q.sub ? ` (${r.q.sub})` : ""}`).join("\n")).join("\n")
    + `\n\n(Lượng đã quy ra đồ sống/khô cần mua; gia vị, hành tỏi tự bổ sung.)`;
}
async function copyText(txt){
  try{ if(navigator.clipboard && window.isSecureContext !== false){ await navigator.clipboard.writeText(txt); return true; } }catch(e){}
  try{
    const ta = document.createElement("textarea"); ta.value = txt; ta.setAttribute("readonly",""); ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  }catch(e){ return false; }
}
function openShoppingList(){
  const s = NPS();
  const people = Math.min(6, Math.max(1, Number(s.shopPeople)||1));
  const L = npShoppingList(people);
  const SD = shopDone(), done = new Set(SD.ids);
  openSheet(`
    <div class="sheet-header"><h3>Đi chợ cho 7 ngày</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ICON("close")}</button></div>
    <p class="np-note">Gộp nguyên liệu thực đơn gợi ý T2–CN (đã tính món phụ và các món bạn đổi), quy ra lượng <b>sống/khô</b> cần mua và làm tròn theo đơn vị.</p>
    <div class="np-people"><span>Số người ăn</span>${[1,2,3,4].map(n=>`<button class="${n===people?'on':''}" data-np-people="${n}" aria-pressed="${n===people}">${n}</button>`).join("")}</div>
    <div class="np-shop">${L.groups.map(gr=>`
      <div class="np-sec">${gr.emoji} ${gr.label} <i>${gr.rows.length}</i></div>
      ${gr.rows.map(r=>`<button class="np-shop-row${done.has(r.id) ? " done" : ""}" data-np-done="${esc(r.id)}" aria-pressed="${done.has(r.id)}">
        <span class="np-chk">${ICON("check")}</span>
        <span class="np-rt"><b>${esc(r.name)}</b>${r.cooked ? `<small>${esc(r.cooked)}</small>` : ""}</span>
        <span class="np-q"><b>${esc(r.q.text)}</b>${r.q.sub ? `<small>${esc(r.q.sub)}</small>` : ""}</span>
      </button>`).join("")}`).join("") || `<p class="empty-hint">Chưa có thực đơn để lập danh sách.</p>`}
    </div>
    <div class="np-shop-actions">
      <button class="btn btn-primary btn-block" id="np-shop-copy">${ICON("content_copy")}Sao chép danh sách</button>
      ${navigator.share ? `<button class="btn btn-outline btn-block" id="np-shop-share">${ICON("share")}Chia sẻ</button>` : ""}
    </div>
    <p class="small-note" style="text-align:center;margin-top:8px;">${L.count} nguyên liệu${hideK() ? "" : ` · ~${L.kcalDay.toLocaleString("vi-VN")} kcal/người/ngày`}. Lượng chỉ là ước tính — mua dư 5–10 % cho phần bỏ đi.</p>
  `);
  $$("[data-np-people]").forEach(b=> b.addEventListener("click", ()=>{ NPS().shopPeople = Number(b.dataset.npPeople); save(); openShoppingList(); }));
  $$("[data-np-done]").forEach(b=> b.addEventListener("click", ()=>{
    const id = b.dataset.npDone; if(done.has(id)) done.delete(id); else done.add(id);
    b.classList.toggle("done", done.has(id)); b.setAttribute("aria-pressed", done.has(id));
    SD.ids = [...done]; save();
  }));
  $("#np-shop-copy").addEventListener("click", async ()=>{
    const ok = await copyText(shopText(L, people));
    toast(ok ? "Đã sao chép danh sách đi chợ" : "Không sao chép được — hãy thử nút Chia sẻ", ok ? "content_copy" : "error");
  });
  const sh = $("#np-shop-share"); if(sh) sh.addEventListener("click", ()=>{ navigator.share({ title:"Danh sách đi chợ TapEasy", text: shopText(L, people) }).catch(()=>{}); });
}

/* ---------- 3.7 Thêm món: Gần đây · Yêu thích · Tất cả · Món tự tạo ---------- */
function foodSub(f){
  const u = f.units && f.units[0];
  if(hideK()) return u ? `${esc(u.label)} ≈ ${esc(vn(Number(u.g) || 0))} g` : "100 g";
  return u ? `${esc(u.label)} ≈ ${esc(vn(Number(u.g) || 0))}g · ${Math.round(f.kcal*u.g/100) || 0} kcal` : `100 g · đạm ${vn(f.protein)} · tinh bột ${vn(f.carbs)} · béo ${vn(f.fat)}`;
}
function foodRow(f, opt){
  opt = opt || {};
  const fav = isFav("f", f.id);
  const kc = opt.g ? Math.round(f.kcal*opt.g/100) : (f.units && f.units[0] ? Math.round(f.kcal*f.units[0].g/100) : f.kcal);
  return `<div class="np-row" data-np-food="${esc(f.id)}"${opt.ri != null ? ` data-np-ri="${opt.ri}"` : ""} role="button" tabindex="0">
    <span class="np-pic">${foodPic(f.id, "fr-img")}</span>
    <span class="np-rt"><b>${esc(f.name)}${f.custom ? ` <i class="np-tag">tự tạo</i>` : ""}</b><small>${opt.sub || foodSub(f)}</small></span>
    ${hideK() ? "" : `<span class="np-k"><b>${kc}</b><small>kcal</small></span>`}
    ${opt.quick ? `<button class="np-ib np-qadd" data-np-qadd="${opt.ri}" aria-label="Thêm nhanh ${esc(f.name)}">${ICON("add")}</button>` : ""}
    ${opt.edit ? `<button class="np-ib" data-np-edit="${esc(f.id)}" aria-label="Sửa ${esc(f.name)}">${ICON("edit")}</button>` : ""}
    <button class="np-ib np-fav ${fav?'on':''}" data-np-fav="f:${esc(f.id)}" aria-pressed="${fav}" aria-label="${fav?'Bỏ yêu thích':'Yêu thích'}">${ICON("favorite")}</button>
  </div>`;
}
function recipeRow(r, opt){
  opt = opt || {};
  const fav = isFav("r", r.id), b = recipeBase(r), k = opt.f || 1;
  return `<div class="np-row" data-np-recipe="${esc(r.id)}"${opt.ri != null ? ` data-np-ri="${opt.ri}"` : ""} role="button" tabindex="0">
    <span class="np-pic">${foodPic(r.id, "fr-img")}</span>
    <span class="np-rt"><b>${esc(r.name)}</b><small>${opt.sub || `Món · ${Math.round(b.g*k)} g · ${Math.round(b.p*k)}g đạm`}</small></span>
    ${hideK() ? "" : `<span class="np-k"><b>${Math.round(b.k*k)}</b><small>kcal</small></span>`}
    ${opt.quick ? `<button class="np-ib np-qadd" data-np-qadd="${opt.ri}" aria-label="Thêm nhanh ${esc(r.name)}">${ICON("add")}</button>` : ""}
    <button class="np-ib np-fav ${fav?'on':''}" data-np-fav="r:${esc(r.id)}" aria-pressed="${fav}" aria-label="${fav?'Bỏ yêu thích':'Yêu thích'}">${ICON("favorite")}</button>
  </div>`;
}
function recentSub(e, f){
  const eg = esc(Math.round(Number(e.g) || 0));                                    // R3-NUT-02
  if(e.u && e.q) return `${esc(vn(Number(e.q) || 0))} × ${esc(e.u)} · ${eg} g`;
  return `${eg} g${f && unitHint(f.id, e.g) ? " · " + esc(unitHint(f.id, e.g)) : ""}`;
}
try{
openAddFood = function(mealId, opts){
  opts = opts || {};
  const mt = MEAL_TYPES.find(m=>m.id===mealId) || MEAL_TYPES[0];
  mealId = mt.id;
  const S = NPS();
  let tab = opts.tab || (S.recent.length ? "recent" : "all");
  let q = opts.q || "";
  const listHTML = ()=>{
    const qq = fold(q.trim());
    if(qq){
      const found = npSearch(q, 60, 10);                       // QN-15: tách từ + đồng nghĩa Bắc–Nam
      const fs = found.foods, rs = found.recipes;
      return (fs.length ? fs.map(f=>foodRow(f)).join("") : "")
        + (rs.length ? `<div class="np-sec">Món ăn có công thức</div>` + rs.map(r=>recipeRow(r)).join("") : "")
        || `<p class="empty-hint">Không tìm thấy "${esc(q)}". Bạn có thể <b>tự tạo món</b> bên dưới.</p>`;
    }
    if(tab === "recent"){
      const list = S.recent.map((e, i)=>{
        if(e.t === "r"){ const r = RECIPES.find(x=>x.id===e.id); return r ? recipeRow(r, { ri:i, quick:true, f:Number(e.f)||1, sub:`Món · ${esc(Math.round(Number(e.g) || recipeBase(r).g*(Number(e.f)||1)))} g${(Number(e.f)||1)!==1 ? ` · khẩu phần ×${esc(vn(Number(e.f)||1))}` : ""}` }) : ""; }
        const f = food(e.id); return f ? foodRow(f, { ri:i, quick:true, g:e.g, sub: recentSub(e, f) }) : "";
      }).join("");
      return list || `<p class="empty-hint">Chưa có món gần đây — món bạn thêm sẽ hiện ở đây để thêm lại 1 chạm.</p>`;
    }
    if(tab === "fav"){
      const list = S.fav.map(k=>{ const [t, ...rest] = String(k).split(":"); const id = rest.join(":");
        if(t === "r"){ const r = RECIPES.find(x=>x.id===id); return r ? recipeRow(r) : ""; }
        const f = food(id); return f ? foodRow(f) : ""; }).join("");
      return list || `<p class="empty-hint">Chạm ${ICON("favorite")} ở món bất kỳ để lưu vào Yêu thích.</p>`;
    }
    if(tab === "mine"){
      const list = S.custom.map(c=>{ const f = food(c.id); return f ? foodRow(f, { edit:true }) : ""; }).join("");
      return list || `<p class="empty-hint">Chưa có món tự tạo. Nhập món nhà làm, đồ đóng gói (theo nhãn dinh dưỡng)… để lần sau thêm nhanh.</p>`;
    }
    return ALL_MARK;
  };
  /* QN-22: tab "Tất cả" (~150 dòng có ảnh) vẽ 30 dòng đầu, phần còn lại vẽ dần khi cuộn tới (IntersectionObserver) / lúc rảnh */
  const ALL_MARK = "<!--np-all-->";
  const allList = ()=> FOODS.slice().sort((a,b)=> (a.custom?0:1) - (b.custom?0:1));
  const FIRST = 30, CHUNK = 40;
  const tabs = [["recent","Gần đây","history"],["fav","Yêu thích","favorite"],["all","Tất cả","restaurant"],["mine","Tự tạo","edit"]];
  openSheet(`
    <div class="sheet-header"><h3>Thêm vào ${mt.label}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ICON("close")}</button></div>
    <div class="search-box" style="margin-bottom:10px;">
      <span class="material-symbols-rounded" style="color:var(--text-dim);">search</span>
      <input type="search" id="food-search" placeholder="Tìm: ức gà, cơm, phở, tempeh…" autocomplete="off" value="${esc(q)}">
    </div>
    <div class="np-tabs" role="tablist">${tabs.map(([id,l,ic])=>`<button role="tab" data-np-tab="${id}" aria-selected="${tab===id}" class="${tab===id?'on':''}">${ICON(ic)}${l}</button>`).join("")}</div>
    <div id="food-results" class="np-af-list"></div>
    <button class="btn btn-outline btn-block" id="np-af-custom" style="margin-top:10px;">${ICON("add")}${hideK() ? "Tự tạo món (tên, đơn vị, dinh dưỡng)" : "Tự tạo món (tên, kcal, macro, đơn vị)"}</button>
  `);
  const box = $("#food-results");
  let io = null, paintSeq = 0, qTimer = null;
  const stopLazy = ()=>{ if(io){ try{ io.disconnect(); }catch(e){} io = null; } };
  const watch = (list, from, seq)=>{
    const sen = box.querySelector && box.querySelector(".np-more");
    if(!sen || from >= list.length) return;
    if(typeof IntersectionObserver === "function"){
      stopLazy();
      io = new IntersectionObserver(es=>{ if(es.some(e=> e.isIntersecting)){ stopLazy(); appendRows(list, from, seq); } }, { rootMargin:"600px 0px" });
      io.observe(sen);
    } else setTimeout(()=> appendRows(list, from, seq), 50);
  };
  const appendRows = (list, from, seq)=>{
    if(seq !== paintSeq || from >= list.length) return;
    const old = box.querySelector && box.querySelector(".np-more"); if(old && old.remove) old.remove();
    const end = Math.min(list.length, from + CHUNK);
    box.insertAdjacentHTML("beforeend", list.slice(from, end).map(f=>foodRow(f)).join("") + (end < list.length ? `<div class="np-more" aria-hidden="true"></div>` : ""));
    watch(list, end, seq);
  };
  const paint = ()=>{
    paintSeq++; stopLazy();
    let html = listHTML(), list = null;
    if(html === ALL_MARK){
      list = allList();
      html = list.slice(0, FIRST).map(f=>foodRow(f)).join("") + (list.length > FIRST ? `<div class="np-more" aria-hidden="true"></div>` : "");
    }
    box.innerHTML = html;
    $$("[data-np-tab]").forEach(b=>{ const on = b.dataset.npTab === tab && !q.trim(); b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    if(list) watch(list, FIRST, paintSeq);
  };
  /* uỷ quyền sự kiện 1 lần cho cả danh sách (dòng vẽ lười vẫn bấm được; không gắn hàng trăm listener mỗi lần gõ) */
  const onPick = e=>{
    const t = e.target; if(!t || !t.closest) return;
    const fav = t.closest("[data-np-fav]");
    if(fav && fav.dataset && fav.dataset.npFav){
      e.stopPropagation();
      const [ft, ...rest] = fav.dataset.npFav.split(":"); const on = toggleFav(ft, rest.join(":"));
      fav.classList.toggle("on", on); fav.setAttribute("aria-pressed", on);
      toast(on ? "Đã thêm vào Yêu thích" : "Đã bỏ khỏi Yêu thích", "favorite");
      if(tab === "fav" && !q.trim()) paint();
      return;
    }
    const qa = t.closest("[data-np-qadd]");
    if(qa && qa.dataset && qa.dataset.npQadd != null){
      e.stopPropagation();
      const rec = S.recent[Number(qa.dataset.npQadd)]; if(!rec) return;
      let kc = 0, name = "";
      if(rec.t === "r"){ const r = RECIPES.find(x=>x.id===rec.id); if(!r) return; kc = logRecipe(Object.assign({}, r, { factor:1 }), mealId, rec.f||1); name = r.name; }
      else { const f = food(rec.id); if(!f) return; kc = logFood(f, rec.g, mealId, rec.u ? { label:rec.u, q:rec.q } : null).kcal; name = f.name; }
      save(); closeSheet(); renderNutritionScreen();
      toast(`Đã thêm ${name}${kcalTxt(kc)}`, "restaurant");
      return;
    }
    const ed = t.closest("[data-np-edit]");
    if(ed && ed.dataset && ed.dataset.npEdit){ e.stopPropagation(); openCustomFood(mealId, ed.dataset.npEdit); return; }
    const fr = t.closest("[data-np-food]");
    if(fr && fr.dataset && fr.dataset.npFood){
      const f = food(fr.dataset.npFood); if(!f) return;
      const ri = fr.dataset.npRi; const rec = ri != null ? S.recent[Number(ri)] : null;
      openFoodQuantity(f, mealId, rec && rec.t==="f" ? rec : null);
      return;
    }
    const rr = t.closest("[data-np-recipe]");
    if(rr && rr.dataset && rr.dataset.npRecipe){
      const r = RECIPES.find(x=>x.id===rr.dataset.npRecipe); if(!r) return;
      const ri = rr.dataset.npRi; const rec = ri != null ? S.recent[Number(ri)] : null;
      openRecipe(r.id, rec && rec.f && rec.f !== 1 ? Object.assign({}, r, { items: scaleItems(r.items, rec.f), factor: rec.f }) : null, { meal: mealId, back: true });
    }
  };
  box.addEventListener("click", onPick);
  box.addEventListener("keydown", e=>{ if((e.key === "Enter" || e.key === " ") && e.target && e.target.matches && e.target.matches("[role=button]")){ e.preventDefault(); e.target.click(); } });
  $$("[data-np-tab]").forEach(b=> b.addEventListener("click", ()=>{ tab = b.dataset.npTab; q = ""; $("#food-search").value = ""; paint(); }));
  /* QN-22: gõ tìm có debounce 120 ms — không vẽ lại danh sách sau mỗi phím */
  $("#food-search").addEventListener("input", e=>{ q = e.target.value; clearTimeout(qTimer); qTimer = setTimeout(paint, 120); });
  $("#np-af-custom").addEventListener("click", ()=> openCustomFood(mealId));
  paint();
};
}catch(e){ console.warn("nutrition-pro: thêm món", e); }

/* ---------- 3.8 Chọn đơn vị & số lượng ---------- */
const NP_MAX_G = 1000, NP_MAX_KCAL = 2000;          // QN-04: ngưỡng hỏi xác nhận 1 lần thêm
/* QN-03: cảnh báo thai phụ (dùng cờ sức khoẻ hiện tại) */
function pregRiskNow(item){
  try{ const f = typeof FKHealth !== "undefined" && FKHealth.current ? FKHealth.current() : null; if(!f || !f.screened || !f.preg) return null; }catch(e){ return null; }
  return npPregRisk(item);
}
function pregWarnHTML(item){
  const r = pregRiskNow(item); if(!r) return "";
  return `<div class="np-preg ${r.level === "avoid" ? "avoid" : ""}" role="note"><span class="material-symbols-rounded">pregnant_woman</span><span><b>${r.level === "avoid" ? "Thai phụ nên tránh" : "Lưu ý khi mang thai"}:</b> ${esc(r.why)}${r.cooked ? " Cách làm bên dưới đã đổi sang <b>nấu chín kỹ</b>." : ""}</span></div>`;
}
try{
openFoodQuantity = function(f, mealId, preset){
  if(!f) return;
  const units = [{ label:"gram", g:1, gram:true }].concat((Array.isArray(f.units) ? f.units : []).filter(u=> u && typeof u === "object" && typeof u.label === "string" && Number(u.g) > 0));
  let ui = 0, qty = 100;
  if(preset && preset.u){ const k = units.findIndex(u=>u.label===preset.u); if(k > 0){ ui = k; qty = preset.q || 1; } else qty = preset.g || 100; }
  else if(preset && preset.g){ qty = preset.g; }
  else if(units.length > 1){ ui = 1; qty = 1; }
  const grams = ()=> units[ui].gram ? qty : qty*units[ui].g;
  const render = ()=>{
    const g = grams(), m = macrosOf([[f.id, g]]), fav = isFav("f", f.id), hk = hideK();
    openSheet(`
      <div class="sheet-header">
        <button class="icon-btn" id="np-q-back" aria-label="Quay lại">${ICON("arrow_back")}</button>
        <h3 class="np-q-title">${esc(f.name)}</h3>
        <button class="icon-btn np-fav ${fav?'on':''}" id="np-q-fav" aria-pressed="${fav}" aria-label="Yêu thích">${ICON("favorite")}</button>
      </div>
      <div class="np-q-hero"><span class="np-pic big">${foodPic(f.id, "fr-img")}</span>
        <div>${hk ? `<b>${Math.round(g)}</b><small>gam</small>` : `<b>${m.kcal}</b><small>kcal · ${Math.round(g)} g</small>`}</div></div>
      ${pregWarnHTML(f)}
      <div class="np-sec">Đơn vị</div>
      <div class="np-units" role="radiogroup">${units.map((u,i)=>`<button role="radio" aria-checked="${i===ui}" class="${i===ui?'on':''}" data-np-unit="${i}">${esc(u.label)}${u.gram ? "" : `<small>${esc(vn(Number(u.g) || 0))} g</small>`}</button>`).join("")}</div>
      <div class="np-qty">
        <button class="np-step" data-np-step="-1" aria-label="Giảm">${ICON("remove")}</button>
        <label class="np-qty-in"><input type="text" id="qty-input" inputmode="decimal" autocomplete="off" pattern="[0-9]*[.,]?[0-9]*" value="${esc(units[ui].gram ? Math.round(qty) : vn(qty))}" aria-label="Số lượng (có thể gõ 1,5)"><span>${units[ui].gram ? "g" : esc(units[ui].label.replace(/^1 /,""))}</span></label>
        <button class="np-step" data-np-step="1" aria-label="Tăng">${ICON("add")}</button>
      </div>
      <div class="np-macros4">
        <div><b id="np-q-p">${vn(m.protein)}g</b><small>Đạm</small></div>
        <div><b id="np-q-c">${vn(m.carbs)}g</b><small>Tinh bột</small></div>
        <div><b id="np-q-f">${vn(m.fat)}g</b><small>Béo</small></div>
        <div><b id="np-q-fb">${vn(m.fiber)}g</b><small>Chất xơ</small></div>
      </div>
      <p class="small-note" id="np-q-warn" role="status" style="margin-top:6px;"></p>
      ${hk ? "" : `<p class="small-note" style="margin-top:8px;">Mỗi 100 g: ${vn(f.kcal)} kcal · đạm ${vn(f.protein)} g · tinh bột ${vn(f.carbs)} g · béo ${vn(f.fat)} g · xơ ${vn(f.fiber||0)} g${f.custom ? " · món tự tạo" : ""}</p>`}
      <button class="btn btn-primary btn-block" style="margin-top:14px;" id="btn-confirm-food">${ICON("add")}<span id="np-q-btn">Thêm vào ${mealLabel(mealId).toLowerCase()}${kcalTxt(m.kcal)}</span></button>
    `);
    const inp = $("#qty-input");
    const refresh = ()=>{
      const gg = grams(), mm = macrosOf([[f.id, gg]]);
      const w = $("#np-q-warn");
      if(w) w.textContent = gg > NP_MAX_G || mm.kcal > NP_MAX_KCAL ? `Lượng khá lớn cho 1 lần ăn (${vn(Math.round(gg))} g${hk ? "" : ` · ${vn(mm.kcal)} kcal`}) — kiểm tra lại số lượng/đơn vị.` : "";
      if(hk){ $(".np-q-hero b").textContent = Math.round(gg); }
      else { $(".np-q-hero b").textContent = mm.kcal; $(".np-q-hero small").textContent = `kcal · ${Math.round(gg)} g`; }
      $("#np-q-p").textContent = vn(mm.protein)+"g"; $("#np-q-c").textContent = vn(mm.carbs)+"g"; $("#np-q-f").textContent = vn(mm.fat)+"g"; $("#np-q-fb").textContent = vn(mm.fiber)+"g";
      $("#np-q-btn").textContent = `Thêm vào ${mealLabel(mealId).toLowerCase()}${kcalTxt(mm.kcal)}`;
    };
    /* QN-04: ô chữ + bàn phím số thập phân → "1,5" đọc là 1,5 (type=number của Chromium bỏ dấu phẩy thành 15).
       FIX-core §5 (vòng 2): đọc bằng fkNum của app.js (npNum) — cùng một cách hiểu số với mọi ô nhập khác của app */
    inp.addEventListener("input", ()=>{ const v = npNum(inp.value); qty = Number.isFinite(v) ? v : 0; refresh(); });
    $$("[data-np-unit]").forEach(b=> b.addEventListener("click", ()=>{
      const g0 = grams(); ui = Number(b.dataset.npUnit);
      qty = units[ui].gram ? Math.round(g0||100) : Math.max(0.5, Math.round((g0/units[ui].g)*2)/2 || 1);
      render();
    }));
    $$("[data-np-step]").forEach(b=> b.addEventListener("click", ()=>{
      const st = units[ui].gram ? 10 : 0.5;
      qty = Math.max(units[ui].gram ? 0 : 0.5, Math.round((qty + st*Number(b.dataset.npStep))*100)/100);
      inp.value = units[ui].gram ? String(Math.round(qty)) : vn(qty); refresh();
    }));
    $("#np-q-back").addEventListener("click", ()=> openAddFood(mealId));
    $("#np-q-fav").addEventListener("click", e=>{ const on = toggleFav("f", f.id); e.currentTarget.classList.toggle("on", on); e.currentTarget.setAttribute("aria-pressed", on); });
    $("#btn-confirm-food").addEventListener("click", ()=>{
      const g = grams();
      if(!(g > 0)){ toast("Nhập số lượng lớn hơn 0", "error"); return; }
      if(g > 3000){ toast("Tối đa 3.000 g mỗi lần thêm", "error"); return; }
      const u = units[ui].gram ? null : { label: units[ui].label, q: qty };
      const mm = macrosOf([[f.id, g]]);
      const add = ()=>{
        const m = logFood(f, g, mealId, u);
        save(); closeSheet(); renderNutritionScreen();
        toast(`Đã thêm ${f.name}${kcalTxt(m.kcal)}`, "restaurant");
      };
      /* QN-04: khẩu phần phi lý (> 1.000 g hoặc > 2.000 kcal một lần) → hỏi lại; QN-03: thai phụ thêm món nên tránh → hỏi lại */
      const risk = pregRiskNow(f);
      const big = g > NP_MAX_G || mm.kcal > NP_MAX_KCAL;
      if(big || (risk && risk.level === "avoid")){
        const why = [big ? `Bạn sắp thêm <b>${esc(vn(Math.round(g)))} g${hk ? "" : ` · ${esc(vn(mm.kcal))} kcal`}</b> ${esc(f.name)} trong 1 lần — nhiều hơn một khẩu phần thường gặp. Bạn có gõ nhầm (vd 15 thay vì 1,5)?` : "",
          risk && risk.level === "avoid" ? `Đang mang thai: món này ${esc(risk.why)}` : ""].filter(Boolean).join("<br><br>");
        confirmDialog(big ? "Kiểm tra lại khẩu phần" : "Lưu ý khi mang thai", why, ()=> setTimeout(add, 0), "Vẫn thêm", big ? "scale" : "pregnant_woman");
        return;
      }
      add();
    });
  };
  render();
};
}catch(e){ console.warn("nutrition-pro: đơn vị", e); }

/* ---------- 3.9 Tự tạo món ---------- */
function openCustomFood(mealId, editId){
  const S = NPS();
  const ex = editId ? S.custom.find(c=>c.id===editId) : null;
  const u0 = ex && ex.units && ex.units[0] ? ex.units[0] : { label:"1 phần", g:100 };
  const per = (v)=> ex ? Math.round(v*u0.g/100*10)/10 : "";
  openSheet(`
    <div class="sheet-header">
      <button class="icon-btn" id="np-c-back" aria-label="Quay lại">${ICON("arrow_back")}</button>
      <h3 class="np-q-title">${ex ? "Sửa món tự tạo" : "Tự tạo món"}</h3>
      <button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ICON("close")}</button>
    </div>
    <p class="np-note">Nhập theo nhãn dinh dưỡng trên bao bì hoặc ước lượng. Giá trị tính cho <b>1 đơn vị</b> bạn đặt bên dưới.</p>
    <div class="field"><label for="np-c-name">Tên món</label><input id="np-c-name" maxlength="60" placeholder="VD: Cơm gà mẹ nấu, Bánh protein X" value="${ex ? esc(ex.name) : ""}"></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label for="np-c-unit">Đơn vị</label><input id="np-c-unit" maxlength="24" placeholder="1 phần / 1 hộp / 1 thanh" value="${esc(u0.label)}"></div>
      <div class="field"><label for="np-c-g">1 đơn vị = (g)</label><input id="np-c-g" type="text" inputmode="decimal" autocomplete="off" min="1" max="3000" value="${esc(vn(Number(u0.g) || 100))}"></div>
    </div>
    <div class="field" style="margin-top:10px;"><label for="np-c-kcal">Năng lượng (kcal / 1 đơn vị)</label><input id="np-c-kcal" type="text" inputmode="decimal" autocomplete="off" min="0" max="5000" value="${per(ex ? ex.kcal : 0)}" placeholder="VD: 450"></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label for="np-c-p">Đạm (g)</label><input id="np-c-p" type="text" inputmode="decimal" autocomplete="off" min="0" max="500" value="${per(ex ? ex.protein : 0)}"></div>
      <div class="field"><label for="np-c-c">Tinh bột (g)</label><input id="np-c-c" type="text" inputmode="decimal" autocomplete="off" min="0" max="800" value="${per(ex ? ex.carbs : 0)}"></div>
      <div class="field"><label for="np-c-f">Béo (g)</label><input id="np-c-f" type="text" inputmode="decimal" autocomplete="off" min="0" max="500" value="${per(ex ? ex.fat : 0)}"></div>
    </div>
    <div class="field" style="margin-top:10px;"><label for="np-c-fb">Chất xơ (g, không bắt buộc)</label><input id="np-c-fb" type="text" inputmode="decimal" autocomplete="off" min="0" max="200" value="${ex && ex.fiber ? per(ex.fiber) : ""}"></div>
    <p class="small-note" id="np-c-check" style="margin-top:8px;"></p>
    <button class="btn btn-primary btn-block" style="margin-top:12px;" id="np-c-save">${ICON("check")}${ex ? "Lưu thay đổi" : "Lưu & thêm vào " + mealLabel(mealId).toLowerCase()}</button>
    ${ex ? `<button class="btn btn-ghost btn-block" style="margin-top:6px;" id="np-c-del">${ICON("delete")}Xoá món này</button>` : `<button class="btn btn-ghost btn-block" style="margin-top:6px;" id="np-c-only">Chỉ lưu, chưa thêm</button>`}
  `);
  const num = id=> npNum($(id).value) || 0;      // QN-04: ô chữ + bàn phím số → "12,5" = 12,5 (type=number bỏ dấu phẩy); vòng 2: fkNum của app.js
  const check = ()=>{
    const k = num("#np-c-kcal"), est = num("#np-c-p")*4 + num("#np-c-c")*4 + num("#np-c-f")*9;
    const el = $("#np-c-check");
    if(!k && !est){ el.textContent = "Calo tính từ macro = đạm×4 + tinh bột×4 + béo×9."; return; }
    el.textContent = `Calo tính từ macro ≈ ${Math.round(est)} kcal` + (k && est && Math.abs(est-k)/Math.max(k,1) > 0.25 ? " — lệch nhiều so với kcal bạn nhập, kiểm tra lại nhé." : "");
  };
  ["#np-c-kcal","#np-c-p","#np-c-c","#np-c-f"].forEach(id=> $(id).addEventListener("input", check)); check();
  $("#np-c-back").addEventListener("click", ()=> openAddFood(mealId, { tab:"mine" }));
  const doSave = addNow=>{
    const name = $("#np-c-name").value.trim().replace(/\s+/g, " ").slice(0, 60);
    const label = ($("#np-c-unit").value.trim() || "1 phần").slice(0, 24);
    const g = Math.min(3000, num("#np-c-g"));
    let kcal = num("#np-c-kcal"); const P = num("#np-c-p"), C = num("#np-c-c"), F = num("#np-c-f"), FB = num("#np-c-fb");
    if(!name){ toast("Nhập tên món", "error"); return; }
    if(!(g >= 1)){ toast("Khối lượng 1 đơn vị phải ≥ 1 g", "error"); return; }
    if(!kcal) kcal = P*4 + C*4 + F*9;
    if(!(kcal > 0)){ toast("Nhập kcal hoặc macro", "error"); return; }
    if(kcal > 5000 || P > 500 || C > 800 || F > 500){ toast("Giá trị quá lớn — kiểm tra lại", "error"); return; }
    /* R3-NUT-11: kiểm tra tính hợp lý vật lý — 1 g thức ăn tối đa 9 kcal (chất béo nguyên chất); đạm + tinh bột + béo + xơ không thể nặng hơn
       chính khẩu phần. Trước: "1 đơn vị = 1 g, 450 kcal" được nhận → 45.000 kcal/100 g, làm hỏng tổng ngày và thực đơn. */
    if(kcal > g*9 + 0.5){ toast(`${vn(g)} g thức ăn không thể chứa quá ${vn(Math.round(g*9))} kcal — kiểm tra lại khối lượng 1 đơn vị hoặc số kcal`, "error"); return; }
    if(P + C + F + FB > g*1.02 + 0.5){ toast(`Tổng đạm + tinh bột + béo + xơ (${vn(P+C+F+FB)} g) lớn hơn khối lượng 1 đơn vị (${vn(g)} g) — kiểm tra lại`, "error"); return; }
    const k = 100/g;
    const obj = { id: ex ? ex.id : "cf-" + Date.now().toString(36) + Math.random().toString(36).slice(2,5), name,
      kcal: Math.round(kcal*k*10)/10, protein: r1(P*k), carbs: r1(C*k), fat: r1(F*k), fiber: r1(FB*k), units:[{ label: /^\d/.test(label) ? label : "1 " + label, g }] };
    if(ex) Object.assign(ex, obj); else S.custom.unshift(obj);
    syncCustomFoods(); save();
    if(addNow){
      const f = food(obj.id); const m = logFood(f, g, mealId, { label: obj.units[0].label, q:1 });
      save(); closeSheet(); renderNutritionScreen(); toast(`Đã tạo & thêm ${name}${kcalTxt(m.kcal)}`, "restaurant");
    } else { toast(ex ? "Đã lưu thay đổi" : `Đã lưu "${name}" vào Món tự tạo`, "check_circle"); openAddFood(mealId, { tab:"mine" }); }
  };
  $("#np-c-save").addEventListener("click", ()=> doSave(!ex));
  const only = $("#np-c-only"); if(only) only.addEventListener("click", ()=> doSave(false));
  const del = $("#np-c-del"); if(del) del.addEventListener("click", ()=>{
    confirmDialog("Xoá món tự tạo?", `"${esc(ex.name)}" sẽ bị xoá khỏi danh sách. Các bữa đã ghi trước đó vẫn giữ nguyên.`, ()=>{
      S.custom = S.custom.filter(c=>c.id!==ex.id); S.fav = S.fav.filter(k=>k!=="f:"+ex.id); S.recent = S.recent.filter(r=>r.id!==ex.id);
      syncCustomFoods(); save();
      setTimeout(()=> openAddFood(mealId, { tab:"mine" }), 260);
    }, "Xoá", "delete");
  });
}

/* ---------- 3.10 Chi tiết món: chất xơ, món phụ, khẩu phần, đổi món, yêu thích ---------- */
try{
openRecipe = function(id, scaled, ctx){
  ctx = ctx || {};
  const base = RECIPES.find(x=>x.id===id); if(!base) return;
  const r = scaled || base;
  let meal = ctx.meal || r.meal || "lunch";
  if(!MEAL_TYPES.some(m=>m.id===meal)) meal = "lunch";
  let serv = 1;
  const render = ()=>{
    const bItems = scaleItems(r.baseItems || r.items, serv);
    const extras = (r.extras || []).map(e=> Object.assign({}, e, { g: Math.round(e.g*serv) }));
    const all = bItems.concat(extras.map(e=>[e.id, e.g]));
    const m = macrosOf(all);
    const cm = COOK_METHODS[r.method] || COOK_METHODS.boil;
    const fav = isFav("r", base.id), hk = hideK();
    const tags = base.tags || [];
    const line = ([fid, g])=>{ const f = food(fid); if(!f) return ""; const h = unitHint(fid, g);
      return `<div class="nu-item"><span class="e">${foodPic(fid)}</span><div class="t"><b>${esc(f.name)}</b><small>${g} g${h ? " · " + esc(h) : ""}</small></div>${hk ? "" : `<b class="k">${Math.round(f.kcal*g/100)}</b>`}</div>`; };
    const fct = (r.factor||1)*serv;
    /* QN-03: thai phụ → cảnh báo + bước nấu chín kỹ (stepsPreg) thay cho bước để thịt tái */
    const pregR = pregRiskNow(base);
    const steps = pregR && (base.stepsPreg || r.stepsPreg) ? (base.stepsPreg || r.stepsPreg) : r.steps;
    openSheet(`
      <div class="sheet-header">
        ${ctx.back ? `<button class="icon-btn" id="np-r-back" aria-label="Quay lại">${ICON("arrow_back")}</button>` : ""}
        <h3 style="font-size:18px;flex:1;margin:0 8px;">${esc(r.name)}</h3>
        <button class="icon-btn np-fav ${fav?'on':''}" id="np-r-fav" aria-pressed="${fav}" aria-label="Yêu thích">${ICON("favorite")}</button>
        <button class="icon-btn" onclick="closeSheet()" aria-label="Đóng" style="margin-left:6px;">${ICON("close")}</button>
      </div>
      <div class="nu-recipe-hero"><div class="nu-bowl big">${foodPic(base.id)}</div>
        <div class="nu-recipe-kcal">${hk ? `<b>${vn(m.grams)}</b><small>gam${Math.abs(fct-1)>0.05 ? ` · khẩu phần ×${vn(fct)}` : ""}</small>` : `<b>${m.kcal}</b><small>kcal${Math.abs(fct-1)>0.05 ? ` · khẩu phần ×${vn(fct)}` : ""}</small>`}</div></div>
      <div class="chip-row" style="margin:6px 0 2px;">
        <span class="pill"><span class="material-symbols-rounded" style="font-size:15px;">${cm.icon}</span>${cm.label}</span>
        <span class="pill">${r.min} phút</span><span class="pill">${r.cuisine==="vn"?"Món Việt":"Món Âu"}</span><span class="pill">${["Dễ","Vừa","Khó"][(r.level||1)-1]}</span>
        ${tags.includes("thuan-chay") ? `<span class="pill">🌱 Thuần chay</span>` : tags.includes("chay") ? `<span class="pill">🥬 Chay</span>` : ""}
        ${tags.includes("re") ? `<span class="pill">💰 Rẻ</span>` : ""}
      </div>
      ${pregWarnHTML(base)}
      <div class="np-macros4" style="margin:12px 0;">
        <div><b>${Math.round(m.protein)}g</b><small>Đạm</small></div><div><b>${Math.round(m.carbs)}g</b><small>Tinh bột</small></div>
        <div><b>${Math.round(m.fat)}g</b><small>Béo</small></div><div><b>${vn(m.fiber)}g</b><small>Chất xơ</small></div>
      </div>
      <div class="card-title" style="font-size:13px;">Nguyên liệu (1 người)</div>
      ${bItems.map(line).join("")}
      ${extras.length ? `<div class="card-title" style="font-size:13px;margin-top:14px;">Món phụ đi kèm <small class="np-mini">để đủ đạm &amp; calo</small></div>${extras.map(e=>line([e.id, e.g])).join("")}` : ""}
      ${steps ? `<div class="card-title" style="font-size:13px;margin-top:14px;">Cách làm${steps !== r.steps ? " (nấu chín kỹ cho thai phụ)" : ""}</div><ol class="nu-steps">${steps.map(t=>`<li>${esc(t)}</li>`).join("")}</ol>` : ""}
      ${r.tip ? `<div class="nu-tip"><span class="material-symbols-rounded">lightbulb</span><span>${esc(r.tip)}</span></div>` : ""}
      <div class="card-title" style="font-size:13px;margin-top:14px;">Thêm vào nhật ký</div>
      <div class="chip-row">${MEAL_TYPES.map(mt=>`<button class="pill ${meal===mt.id?'active':''}" data-rm="${mt.id}">${mt.label}</button>`).join("")}</div>
      <div class="np-serv"><span>Khẩu phần</span>${[0.5,1,1.5,2].map(x=>`<button class="${x===serv?'on':''}" data-np-serv="${x}" aria-pressed="${x===serv}">${x===0.5?"½":vn(x)}</button>`).join("")}</div>
      <button class="btn btn-primary btn-block" id="rc-add" style="margin-top:14px;"><span class="material-symbols-rounded">add</span>Thêm vào ${mealLabel(meal).toLowerCase()}${kcalTxt(m.kcal)}</button>
      ${ctx.fromPlan ? `<button class="btn btn-outline btn-block" id="np-r-swap" style="margin-top:8px;">${ICON("swap_horiz")}Đổi món khác cho bữa này</button>` : ""}
    `);
    $$("[data-rm]").forEach(b=> b.addEventListener("click", ()=>{ meal = b.dataset.rm; render(); }));
    $$("[data-np-serv]").forEach(b=> b.addEventListener("click", ()=>{ serv = Number(b.dataset.npServ); render(); }));
    $("#np-r-fav").addEventListener("click", e=>{ const on = toggleFav("r", base.id); e.currentTarget.classList.toggle("on", on); e.currentTarget.setAttribute("aria-pressed", on); toast(on ? "Đã thêm vào Yêu thích" : "Đã bỏ khỏi Yêu thích", "favorite"); });
    const bk = $("#np-r-back"); if(bk) bk.addEventListener("click", ()=> openAddFood(meal));
    const sw = $("#np-r-swap"); if(sw) sw.addEventListener("click", ()=> openSwapSheet(ctx.di != null ? ctx.di : curDay(), ctx.meal || meal));
    $("#rc-add").addEventListener("click", ()=>{
      const add = ()=>{
        const kc = logRecipe(r, meal, serv);
        save(); closeSheet(); renderNutritionScreen();
        toast(`Đã thêm ${r.name}${kcalTxt(kc)}`, "restaurant");
      };
      /* QN-03: món thai phụ nên tránh mà không có cách nấu chín thay thế → hỏi lại */
      if(pregR && pregR.level === "avoid" && steps === r.steps){
        confirmDialog("Lưu ý khi mang thai", `Món này ${esc(pregR.why)}`, ()=> setTimeout(add, 0), "Vẫn thêm", "pregnant_woman");
        return;
      }
      add();
    });
  };
  render();
};
}catch(e){ console.warn("nutrition-pro: chi tiết món", e); }

/* ---------- 3.11 Gắn chất xơ vào màn Dinh dưỡng ---------- */
try{
  const _renderNu = renderNutritionScreen;
  renderNutritionScreen = function(){
    const out = _renderNu.apply(this, arguments);
    try{ injectFiber(); }catch(e){ console.warn("nutrition-pro: chất xơ", e); }
    return out;
  };
}catch(e){}

/* ---------- 3.12 (vòng 2) (i) "Vì sao đạm X g?" ---------- */
function openProteinWhy(){
  const p = state.profile || {}, W = npProteinWhy(p, state.health);
  const li = (b, smalls)=> `<li><b>${b}</b>${(smalls||[]).map(x=>`<small>${esc(x)}</small>`).join("")}</li>`;
  const steps = [
    li(`Cân nặng tham chiếu: ${esc(vnN(W.ref))} kg`, [W.refAdjusted
      ? `Cân nặng hiện tại ${vnN(W.weight)} kg (BMI ${vnN(W.bmi)}, trên 25) — app tính theo cân nặng ứng với BMI 25 để không đặt đạm theo phần mỡ thừa.`
      : "Bằng cân nặng trong hồ sơ của bạn."]),
    li(`${esc(vnN(W.perKg))} g đạm cho mỗi kg`, W.reasons),
    li(`${esc(vnN(W.ref))} kg × ${esc(vnN(W.perKg))} g/kg ≈ ${esc(W.raw)} g`, W.caps),
    li(`Mục tiêu: ${esc(W.grams)} g đạm mỗi ngày`, [`≈ ${W.perMeal} g mỗi bữa nếu chia 4 bữa — cả ngày khoảng ${vnN(W.palms)} lòng bàn tay thịt, cá, trứng, đậu hũ (1 lòng bàn tay ≈ 20–30 g đạm).`]),
  ];
  const warn = [];
  if(W.manual) warn.push(`Bạn đang <b>tự đặt</b> đạm ${esc(W.grams)} g. Theo công thức của app (các bước trên), mức gợi ý là khoảng <b>${esc(W.expected)} g</b>.`);
  if(W.kidney !== "none") warn.push("Lượng đạm chính xác khi có bệnh thận do <b>bác sĩ thận</b> quyết định — hãy mang con số này khi đi khám.");
  else if(W.health) warn.push("Đây là mức tham khảo theo tình trạng bạn khai trong sàng lọc sức khoẻ — hỏi bác sĩ / chuyên gia dinh dưỡng nếu cần điều chỉnh.");
  openSheet(`
    <div class="sheet-header"><h3>Vì sao đạm ${esc(W.grams)} g?</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ICON("close")}</button></div>
    <p class="np-note">Tính theo hồ sơ của bạn${W.age ? ` (${esc(W.age)} tuổi, ${esc(vnN(W.weight))} kg)` : ""}:</p>
    <ol class="np-why">${steps.join("")}</ol>
    ${warn.length ? `<div class="np-notes">${warn.map(x=>`<p>${x}</p>`).join("")}</div>` : ""}
    <p class="small-note" style="margin-top:10px;">Nguồn: ISSN Position Stand 2017 (Jäger), Morton 2018 (BJSM), PROT-AGE 2013, IOM DRI 2005, KDOQI 2020 / KDIGO 2024, Stephens 2015. Chỉ là ước lượng tham khảo, không thay thế tư vấn y tế.</p>
    ${typeof openEditNutritionTargets === "function" ? `<button class="btn btn-outline btn-block" id="np-why-edit" style="margin-top:10px;">${ICON("tune")}Chỉnh mục tiêu dinh dưỡng</button>` : ""}
  `);
  const ed = $("#np-why-edit"); if(ed) ed.addEventListener("click", ()=> openEditNutritionTargets());
}

/* ---------- 3.13 (vòng 2) Rau & trái cây đã ăn hôm nay (gam) — cho "Đĩa ăn cân bằng" khi ẩn số calo ---------- */
function npVegFruitGrams(log){
  let g = 0;
  const isVF = id => !!id && !/^nuoc-/.test(id) && ["rau","trai-cay"].includes(shopCat(id));
  Object.values(log || {}).forEach(list=> (Array.isArray(list) ? list : []).forEach(it=>{
    if(!it) return;
    const grams = Number(it.grams) || 0;
    if(it.recipe){
      const r = RECIPES.find(x=> x.id === it.recipe); if(!r) return;
      const b = recipeBase(r), k = b.g ? grams/b.g : 1;
      r.items.forEach(([id, gi])=>{ if(isVF(id)) g += gi*k; });
      return;
    }
    const fid = it.foodId || (FOODS.find(x=> x.name === it.name) || {}).id;
    if(isVF(fid)) g += grams;
  }));
  return Math.round(g);
}

G.NutriPro.ui = { openShoppingList, openSwapSheet, openCustomFood, shoppingList: npShoppingList, shopText, entryFiber, unitHint,
  openProteinWhy, vegFruitGrams: npVegFruitGrams, planSlotHTML: npPlanSlotHTML, flushIdle: npFlushIdle, planPending: ()=> _planPending };
try{ if($("#screen-nutrition.active")) renderNutritionScreen(); }catch(e){ console.warn("nutrition-pro: render", e); }

})();

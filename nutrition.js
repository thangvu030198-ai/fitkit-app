/* =========================================================================
   TapEasy — Màn Dinh dưỡng v2 (thiết kế lại)
   - Đồng hồ calo dạng cung phân đoạn, số calo đếm tăng
   - Thanh macro (đạm / tinh bột / béo) so với mục tiêu
   - Thẻ bữa ăn: ảnh món (emoji), giờ ăn, kcal lớn + % mục tiêu, macro
   - Nước uống dạng 8 ly bấm được
   - Thực đơn gợi ý: thẻ cuộn ngang, lọc theo mục tiêu, thêm vào bữa 1 chạm
   Nạp SAU app.js (ghi đè renderNutritionScreen của app.js).
   ========================================================================= */

const FOOD_EMOJI = [
  [/^com/, "🍚"], [/^bun|^mi-goi/, "🍜"], [/^banh-mi/, "🥖"], [/^yen-mach/, "🥣"], [/^khoai/, "🍠"], [/^bap/, "🌽"],
  [/ga$|^dui-ga|^uc-ga/, "🍗"], [/vit/, "🍗"], [/^thit-bo/, "🥩"], [/^thit-heo/, "🥓"], [/^ca-hoi/, "🍣"], [/^ca-chua/, "🍅"],
  [/^ca-/, "🐟"], [/^tom/, "🍤"], [/^trung/, "🥚"], [/^pho-mai/, "🧀"], [/^sua/, "🥛"], [/^dau-hu/, "🍢"],
  [/^dau-nanh|^dau-den|^bo-dau-phong|^hanh-nhan|^oc-cho/, "🥜"], [/^bong-cai/, "🥦"], [/^rau|^xa-lach/, "🥬"],
  [/^dua-leo/, "🥒"], [/^chuoi/, "🍌"], [/^tao/, "🍎"], [/cam$/, "🍊"], [/avocado/, "🥑"], [/^nho/, "🍇"],
  [/^mat-ong/, "🍯"], [/^duong/, "🍬"], [/^banh-quy/, "🍪"], [/^chocolate/, "🍫"], [/^dau-oliu|^bo-dong-vat/, "🧈"],
];
function foodEmoji(idOrName){
  let id = idOrName;
  if(!FOODS.some(f=>f.id===id)){ const f = FOODS.find(f=>f.name===idOrName); id = f ? f.id : ""; }
  const hit = FOOD_EMOJI.find(([re])=> re.test(id));
  return hit ? hit[1] : "🍽️";
}

const MEAL_EMOJI = { breakfast:"🍳", lunch:"🍱", dinner:"🍲", snack:"🍪" };
const MEAL_TINT = { breakfast:"#FFB08A", lunch:"#FF7A45", dinner:"#5EE6C7", snack:"#9AF1DD" };

/* Món ăn & thực đơn: xem meals.js (RECIPES, COOK_METHODS, bodyAnalysis, buildDayPlan) */
const RECIPE_TAGS = [
  { id:"all", label:"Tất cả", emoji:"🍽️" }, { id:"plan", label:"Hợp với bạn", emoji:"🎯" },
  { id:"giam-mo", label:"Giảm mỡ", emoji:"🔥" }, { id:"tang-co", label:"Tăng cơ", emoji:"💪" },
  { id:"vn", label:"Món Việt", emoji:"🍜" }, { id:"au", label:"Món Âu", emoji:"🥗" },
  { id:"airfryer", label:"Nồi chiên KD", emoji:"🌀" }, { id:"chay", label:"Ăn chay", emoji:"🥬" }, { id:"re", label:"Rẻ – SV", emoji:"💰" }, { id:"an-vat", label:"Ăn vặt", emoji:"🍪" },
];
function recipeMatchesTag(r, tag){
  if(tag==="all") return true;
  if(tag==="vn" || tag==="au") return r.cuisine===tag;
  if(tag==="airfryer") return r.method==="airfryer";
  if(tag==="plan"){ const g = state.profile.goal; return g==="lose" ? r.tags.includes("giam-mo") : g==="gain" ? r.tags.includes("tang-co") : true; }
  return r.tags.includes(tag);
}

/* ---- Ảnh thật đã tách nền (media/food, phát qua jsDelivr). Chưa có ảnh → dùng emoji ---- */
const FOOD_IMG_BASE = "https://thangvu030198-ai.github.io/fitkit-app/media/food/";
let FOOD_IMG = {};
/* QN-13: ảnh Pixabay tự chọn bị SAI món (đã duyệt tay 11/2026: món chay hiện thịt/trứng, đậu đen/whey hiện cà phê, gỏi cuốn hiện
   chả giò chiên, cơm cá ngừ hiện sashimi sống…) → bỏ ánh xạ, hiện emoji. Khoá = id món → mã ảnh Pixabay (px) sai: khi chạy lại
   media-food.yml với từ khoá mới (scripts/food_sources.json) thì px đổi và ảnh mới tự hiện, không cần sửa lại danh sách này. */
const FOOD_IMG_BAD = {
  "dau-hu-trung-hap":916629, "dau-den-bowl":5181831, "quinoa-edamame":1334632, "dau-hu-nam-af":1832922, "quinoa":1334632,
  "dau-den":2714970, "whey":5959810, "sua-chua-hy-lap":1468416, "pho-mai":7580676, "duong-trang":2697904, "rau-thom":1239422,
  "banh-cuon-dia":2853382, "ca-ngu-com":354628, "goi-cuon":845676, "xoi-man":2208517, "mi-quang-to":1191945, "tom-bap":1329684,
  "dui-ga-mat-ong-af":823614, "bia":1679022, "trung-ga":3255115, "muc":1261432, "muc-hap-gung":1261432,
  "banh-trang":3506194, "dua-hau":846357, "ca-basa":4028046,
};
function nuCleanImgIndex(idx){
  const out = {};
  if(!idx || typeof idx !== "object") return out;
  Object.keys(idx).forEach(id=>{
    const e = idx[id];
    if(!e || typeof e.file !== "string" || !/^[a-z0-9-]+\.(webp|png|jpe?g)$/i.test(e.file)) return;      // chỉ nhận tên file an toàn
    if(FOOD_IMG_BAD[id] != null && Number(e.px) === FOOD_IMG_BAD[id]) return;
    out[id] = e;
  });
  return out;
}
/* Ảnh món tạo bằng AI (media/food-ai, workflow media-food-ai.yml) — đúng món, cùng phong cách; ƯU TIÊN hơn ảnh Pixabay. */
const FOOD_AI_BASE = "https://thangvu030198-ai.github.io/fitkit-app/media/food-ai/";
let FOOD_IMG_AI = {};
function nuCleanAiIndex(idx){
  const out = {};
  if(!idx || typeof idx !== "object") return out;
  Object.keys(idx).forEach(id=>{
    const e = idx[id];
    if(!/^[a-z0-9-]+$/.test(id) || !e || typeof e.file !== "string" || !/^[a-z0-9-]+\.(webp|png|jpe?g)$/i.test(e.file)) return;
    out[id] = { file:e.file, ai:true, base:FOOD_AI_BASE };
  });
  return out;
}
function nuMergeImg(pix, ai){ return Object.assign({}, pix || {}, ai || {}); }
(async ()=>{
  let pix = {}, ai = {};
  await Promise.all([
    fetch(FOOD_IMG_BASE + "index.json").then(r=> r.ok ? r.json() : {}).then(j=>{ pix = nuCleanImgIndex(j); }).catch(()=>{}),
    fetch(FOOD_AI_BASE + "index.json").then(r=> r.ok ? r.json() : {}).then(j=>{ ai = nuCleanAiIndex(j); FOOD_IMG_AI = ai; }).catch(()=>{}),
  ]);
  FOOD_IMG = nuMergeImg(pix, ai);
  try{ if(Object.keys(FOOD_IMG).length && typeof renderNutritionScreen==="function" && $("#screen-nutrition.active")) renderNutritionScreen(); }catch(e){}
})();
function foodIdOf(idOrName){ if(FOODS.some(f=>f.id===idOrName)) return idOrName; const f = FOODS.find(f=>f.name===idOrName); return f ? f.id : ""; }
/* R3-NUT-02: emoji của món TỰ TẠO đến từ state (sao lưu / đồng bộ) và được chèn vào HTML + vào chuỗi JS của onerror →
   chỉ giữ tối đa 8 ký tự, bỏ mọi ký tự có nghĩa với HTML/JS (< > & " ' ` \ và xuống dòng). Rỗng → 🍽️. */
function nuEmo(s){
  const t = Array.from(String(s == null ? "" : s).replace(/[<>&"'`\\\s(){};=]/g, "")).slice(0, 8).join("");
  return t || "🍽️";
}
function foodPic(idOrName, cls="fp"){
  const id = RECIPES.some(r=>r.id===idOrName) ? idOrName : foodIdOf(idOrName);
  const hit = FOOD_IMG[id];
  cls = String(cls || "fp").replace(/[^a-zA-Z0-9 _-]/g, "");
  if(hit) return `<img class="${cls}" src="${escapeHtml((hit.base || FOOD_IMG_BASE)+hit.file)}" alt=""${hit.ai ? ' data-ai="1" title="Ảnh minh hoạ tạo bằng AI"' : ""} loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${nuEmo(foodEmoji(id))}'}))">`;
  const r = RECIPES.find(x=>x.id===id);
  return `<span class="${cls} emo">${nuEmo(r ? r.emoji : foodEmoji(id))}</span>`;
}

/* =====================================================================
   R3-NUT-03/04/05 (14/11/2026) — LÀM SẠCH NHẬT KÝ ĂN / NƯỚC
   Dữ liệu cũ, bản sao lưu Drive, đồng bộ cloud có thể chứa dòng null / chuỗi, số âm, NaN, Infinity, số cực lớn:
   trước đây 1 dòng null làm cả màn Dinh dưỡng (và Trang chủ) ném lỗi; kcal âm làm "Còn … kcal" tăng giả; 1e12 phá bố cục.
   Quy ước: mỗi dòng là object; kcal 0–20.000; gam 0–10.000; đạm/tinh bột/béo/xơ 0–5.000 g; tên là chuỗi ≤ 120 ký tự.
   Chỉ GHI lại khi giá trị sai (dòng hợp lệ giữ nguyên từng bit) → không tạo thay đổi giả cho sao lưu / đồng bộ.
   ===================================================================== */
const NU_LIM = { kcal:20000, grams:10000, macro:5000, waterL:15 };
function nuFix(v, max){
  const n = typeof v === "number" ? v : (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
}
function nuCleanEntry(it){
  if(!it || typeof it !== "object" || Array.isArray(it)) return null;
  const fix = (k, max)=>{ const v = it[k]; if(v === undefined && k !== "kcal") return; const n = nuFix(v, max); if(v !== n) it[k] = n; };
  fix("kcal", NU_LIM.kcal); fix("grams", NU_LIM.grams);
  fix("protein", NU_LIM.macro); fix("carbs", NU_LIM.macro); fix("fat", NU_LIM.macro); fix("fiber", NU_LIM.macro);
  if(typeof it.name !== "string" || it.name.length > 120) it.name = String(it.name == null ? "Món ăn" : it.name).slice(0, 120);
  if(it.recipe != null && typeof it.recipe !== "string") delete it.recipe;
  if(it.foodId != null && typeof it.foodId !== "string") delete it.foodId;
  return it;
}
/* Làm sạch 1 ngày (sửa tại chỗ, giữ nguyên mảng để nơi khác đang giữ tham chiếu vẫn đúng). full=true → bảo đảm đủ 4 bữa. */
function nuCleanDay(day, full){
  if(!day || typeof day !== "object" || Array.isArray(day)) return 0;
  let n = 0;
  if(full) MEAL_TYPES.forEach(mt=>{ if(!Array.isArray(day[mt.id])){ day[mt.id] = []; n++; } });
  Object.keys(day).forEach(m=>{
    const L = day[m];
    if(!Array.isArray(L)){ day[m] = []; n++; return; }
    for(let i = L.length - 1; i >= 0; i--){ if(!nuCleanEntry(L[i])){ L.splice(i, 1); n++; } }
  });
  return n;
}
let _nuCleanedLog = null, _nuCleanedWater = null;
function nuCleanLogs(force){
  let n = 0;
  try{
    if(!state.foodLog || typeof state.foodLog !== "object" || Array.isArray(state.foodLog)){ state.foodLog = {}; n++; }
    if(force || _nuCleanedLog !== state.foodLog){                       // cả nhật ký: 1 lần cho mỗi bản state (nạp máy / khôi phục / đồng bộ)
      Object.keys(state.foodLog).forEach(k=>{ const d = state.foodLog[k];
        if(!d || typeof d !== "object" || Array.isArray(d)){ delete state.foodLog[k]; n++; } else n += nuCleanDay(d); });
      _nuCleanedLog = state.foodLog;
    }
    const today = state.foodLog[todayStr()];
    if(today) n += nuCleanDay(today, true);                              // hôm nay: mỗi lần vẽ (rẻ) + đủ 4 bữa để .push() không ném lỗi
    if(!state.waterLog || typeof state.waterLog !== "object" || Array.isArray(state.waterLog)){ state.waterLog = {}; n++; }
    if(force || _nuCleanedWater !== state.waterLog){
      Object.keys(state.waterLog).forEach(k=>{ const v = state.waterLog[k], c = nuMl(nuFix(v, NU_LIM.waterL)); if(v !== c){ state.waterLog[k] = c; n++; } });
      _nuCleanedWater = state.waterLog;
    } else { const k = todayStr(), v = state.waterLog[k]; if(v !== undefined){ const c = nuMl(nuFix(v, NU_LIM.waterL)); if(v !== c){ state.waterLog[k] = c; n++; } } }
  }catch(e){ try{ console.warn("[nutrition] nuCleanLogs", e); }catch(_){} }
  return n;
}

function recipeMacros(r){
  const out = { kcal:0, protein:0, carbs:0, fat:0, lines:[] };
  /* R3-NUT-06: món thiếu items / dòng hỏng / gam âm, NaN → bỏ qua dòng đó thay vì ném lỗi hoặc ra NaN */
  (r && Array.isArray(r.items) ? r.items : []).forEach(row=>{
    if(!Array.isArray(row)) return;
    const id = row[0], g = Number(row[1]);
    const f = FOODS.find(x=>x.id===id); if(!f || !Number.isFinite(g) || g <= 0) return;
    const k = g/100;
    const line = { name:f.name, grams:g, kcal:Math.round(f.kcal*k), protein:fmt1(f.protein*k), carbs:fmt1(f.carbs*k), fat:fmt1(f.fat*k) };
    out.kcal += line.kcal; out.protein += f.protein*k; out.carbs += f.carbs*k; out.fat += f.fat*k; out.lines.push(line);
  });
  out.protein = Math.round(out.protein); out.carbs = Math.round(out.carbs); out.fat = Math.round(out.fat);
  return out;
}

let nuUI = { tag:"all", open:{} };
/* R3-NUT-03: làm sạch nhật ký 1 lần ngay khi nạp file (trước appBoot) → Trang chủ / thẻ của module khác cũng không gặp dòng hỏng */
try{ if(typeof state !== "undefined" && state && nuCleanLogs(true) > 0 && typeof saveState === "function") saveState(); }catch(e){}

/* =====================================================================
   Vòng 2 (11/11/2026) — "ẨN SỐ CALO" cho người có tiền sử rối loạn ăn uống (RLĂU)
   state.nutriPro.hideKcal = true/false khi người dùng tự chọn. Chưa chọn → BẬT nếu sàng lọc sức khoẻ khai "Có" tiền sử RLĂU.
   Khi bật: màn Dinh dưỡng / thực đơn / thêm món / chi tiết món không hiện kcal, đồng hồ calo, "Còn … kcal", biểu đồ calo 7 ngày;
   thay bằng "Đĩa ăn cân bằng" — khẩu phần theo bàn tay (lòng bàn tay đạm ≈ 25 g đạm, nắm tay khum tinh bột ≈ 30 g,
   ngón cái chất béo ≈ 10 g, nắm tay rau/trái cây ≈ 80 g — WHO ≥ 5 phần/ngày) + bữa đã ghi. Không tô đỏ "vượt".
   ===================================================================== */
function nuHideKcal(){
  try{
    const s = state.nutriPro;
    if(s && typeof s.hideKcal === "boolean") return s.hideKcal;
    const h = state.health;
    return !!(h && h.completedAt && h.edHistory === "yes");
  }catch(e){ return false; }
}
function nuSetHideKcal(on){
  if(!state.nutriPro || typeof state.nutriPro !== "object") state.nutriPro = {};
  state.nutriPro.hideKcal = !!on;
  nuUI.shownKcal = undefined;
  saveState();
  try{
    const cur = (document.querySelector(".screen.active") || {}).id || "";
    if(cur === "screen-nutrition") renderNutritionScreen();
    else if(cur === "screen-home" && typeof renderHomeScreen === "function") renderHomeScreen();
    else if(cur === "screen-profile" && typeof renderProfileScreen === "function") renderProfileScreen();   // integrator: thẻ năng lượng Hồ sơ (app.js fkHideKcal)
  }catch(e){}
  toast(on ? "Đã ẩn số calo — hiển thị khẩu phần & đĩa ăn cân bằng" : "Đã hiện lại số calo", on ? "visibility_off" : "visibility");
}
const NU_PORTION = { p:25, c:30, f:10, v:80 };
const nuHalf = x => Math.round((Number(x) || 0)*2)/2;
const nuWhyBtn = g => `<button type="button" class="nu-why" data-nu-why="protein" aria-label="Vì sao đạm ${escapeHtml(g)} g?"><span class="material-symbols-rounded">info</span></button>`;
/* Thẻ "Đĩa ăn cân bằng" (thay đồng hồ calo khi ẩn số calo) */
function nuPlateCardHTML(log, tot, p){
  let T = null; try{ T = NutriPro.targets(p); }catch(e){}
  T = T || { P: Number(p.protein) || 100, C: Number(p.carbs) || 250, F: Number(p.fat) || 60 };
  let veg = null; try{ veg = NutriPro.ui.vegFruitGrams(log); }catch(e){}
  const rows = [
    { cls:"v", label:"Rau & trái cây", unit:"nắm tay", done: veg == null ? null : nuHalf(veg/NU_PORTION.v), tgt: 5 },
    { cls:"p", label:"Đạm", unit:"lòng bàn tay", done: nuHalf(tot.protein/NU_PORTION.p), tgt: Math.max(2, Math.round(T.P/NU_PORTION.p)), why: T.P },
    { cls:"c", label:"Tinh bột", unit:"nắm tay khum", done: nuHalf(tot.carbs/NU_PORTION.c), tgt: Math.max(2, Math.round(T.C/NU_PORTION.c)) },
    { cls:"f", label:"Chất béo tốt", unit:"ngón cái", done: nuHalf(tot.fat/NU_PORTION.f), tgt: Math.max(2, Math.round(T.F/NU_PORTION.f)) },
  ];
  const fr = r => r.done == null ? 0 : Math.min(1, r.done / r.tgt);
  const op = r => (0.24 + 0.76*fr(r)).toFixed(2);
  const meals = MEAL_TYPES.map(mt=> ({ l: mt.label, on: ((log[mt.id] || []).length > 0) }));
  return `
    <div class="nu-gauge-card nu-plate" role="group" aria-label="Đĩa ăn cân bằng hôm nay">
      <div class="nu-plate-top">
        <svg viewBox="0 0 120 120" class="nu-plate-svg" aria-hidden="true">
          <circle cx="60" cy="60" r="57" class="rim"/>
          <path d="M60 60 L60 10 A50 50 0 0 0 60 110 Z" class="seg v" style="opacity:${op(rows[0])}"/>
          <path d="M60 60 L60 10 A50 50 0 0 1 110 60 Z" class="seg p" style="opacity:${op(rows[1])}"/>
          <path d="M60 60 L110 60 A50 50 0 0 1 60 110 Z" class="seg c" style="opacity:${op(rows[2])}"/>
          <circle cx="106" cy="106" r="9" class="seg f" style="opacity:${op(rows[3])}"/>
        </svg>
        <div class="nu-plate-txt"><b>Đĩa ăn cân bằng</b><small>½ đĩa rau &amp; trái cây · ¼ đạm · ¼ tinh bột · thêm chút chất béo tốt. Ăn đều các bữa — không cần đếm calo.</small></div>
      </div>
      <div class="nu-plate-rows">${rows.map(r=>`
        <div class="nu-pr ${r.cls}"><i aria-hidden="true"></i><span class="nu-pr-l"><b>${r.label}</b><small>${r.unit}</small></span>
          <span class="nu-pr-v">${r.done == null ? "—" : `${escapeHtml(nuVN(r.done))} / ${escapeHtml(r.tgt)}`} phần</span>${r.why != null ? nuWhyBtn(r.why) : ""}
          <span class="nu-bar"><i style="width:${Math.round(fr(r)*100)}%"></i></span></div>`).join("")}
      </div>
      <div class="nu-plate-meals" aria-label="Bữa đã ghi hôm nay">${meals.map(m=>`<span class="${m.on ? "on" : ""}">${m.on ? "✓ " : ""}${m.l}</span>`).join("")}</div>
      <div class="nu-plate-foot"><span>Số calo đang được ẩn theo lựa chọn của bạn.</span><button type="button" class="hs-link nu-kcal-toggle" data-nu-kcal="show">Hiện số calo</button></div>
    </div>`;
}

/* QU-03 (vòng 2): "Món healthy" (~100 thẻ ≈ 1.200 nút DOM) — vẽ 12 thẻ đầu, phần còn lại thêm dần lúc rảnh; bấm qua uỷ quyền 1 lần */
const NU_RC_FIRST = 12, NU_RC_CHUNK = 24;
let _nuRcSeq = 0;
function nuIdle(fn){
  try{ if(typeof requestIdleCallback === "function") return requestIdleCallback(()=> fn(), { timeout: 800 }); }catch(e){}
  return setTimeout(fn, 40);
}
function nuRecipeList(hk){
  if(hk && nuUI.tag === "giam-mo") nuUI.tag = "all";
  return RECIPES.filter(r=> recipeMatchesTag(r, nuUI.tag));
}
function nuRecipeCardHTML(r, i, hk){
  const m = recipeMacros(r);
  return `
        <div class="nu-recipe" data-recipe="${escapeHtml(r.id)}" style="--i:${Math.min(i, 12)}" role="button" tabindex="0" data-fk-key>
          <div class="nu-recipe-top"><span class="time"><span class="material-symbols-rounded">schedule</span>${escapeHtml(r.min)} phút</span><span class="cz">${r.cuisine==="vn"?"Việt":"Âu"}</span></div>
          <div class="nu-bowl">${foodPic(r.id)}</div>
          <div class="nu-method">${(COOK_METHODS[r.method] || {}).label || ""}</div>
          <div class="nu-recipe-name">${escapeHtml(r.name)}</div>
          <div class="nu-recipe-foot">
            <span class="lvl">${["Dễ","Vừa","Khó"][r.level-1] || ""}<i class="${r.level>=1?'on':''}"></i><i class="${r.level>=2?'on':''}"></i><i class="${r.level>=3?'on':''}"></i></span>
            ${hk ? "" : `<b>${m.kcal.toLocaleString("vi-VN")} kcal</b>`}
          </div>
        </div>`;
}
function nuRecipesMore(list, from, hk){
  const seq = ++_nuRcSeq;
  const step = ()=>{
    if(seq !== _nuRcSeq) return;
    const box = document.getElementById("nu-recipes");
    if(!box || typeof box.insertAdjacentHTML !== "function") return;
    const end = Math.min(list.length, from + NU_RC_CHUNK);
    box.insertAdjacentHTML("beforeend", list.slice(from, end).map((r, k)=> nuRecipeCardHTML(r, from + k, hk)).join(""));
    from = end;
    if(from < list.length) nuIdle(step);
  };
  if(from < list.length) nuIdle(step);
}
function nuRefreshRecipes(){
  const box = document.getElementById("nu-recipes");
  if(!box || !box.parentNode){ renderNutritionScreen(); return; }
  const hk = nuHideKcal(), list = nuRecipeList(hk);
  box.innerHTML = list.slice(0, NU_RC_FIRST).map((r, i)=> nuRecipeCardHTML(r, i, hk)).join("") || `<p class="empty-hint">Chưa có món phù hợp.</p>`;
  box.scrollLeft = 0;
  $$("#nu-content [data-tag]").forEach(b=>{ const on = b.dataset.tag === nuUI.tag; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  nuRecipesMore(list, NU_RC_FIRST, hk);
}

/* ---- Khung màn hình (thay phần HTML tĩnh cũ) ---- */
(function mountNutrition(){
  const sec = $("#screen-nutrition"); if(!sec) return;
  sec.innerHTML = `
    <div class="topbar">
      <button class="icon-btn btn-menu-trigger-nu"><span class="material-symbols-rounded">menu</span></button>
      <div class="logo">Dinh dưỡng</div>
      <button class="icon-btn" id="nu-targets-btn"><span class="material-symbols-rounded">tune</span></button>
    </div>
    <div class="content nu" id="nu-content"></div>`;
  $(".btn-menu-trigger-nu").addEventListener("click", ()=> $("#btn-menu").click());
  $("#nu-targets-btn").addEventListener("click", openEditNutritionTargets);
})();

function nuGaugeSVG(pct){
  // 13 đoạn trên cung 180°, đoạn được tô theo % mục tiêu
  const N = 13, cx = 150, cy = 150, r1 = 92, r2 = 136, gap = 3.2;
  const filled = Math.round(Math.min(1, pct) * N);
  const over = pct > 1;
  let out = "";
  for(let i=0;i<N;i++){
    const a0 = Math.PI + (i/N)*Math.PI + (gap/180*Math.PI)/2, a1 = Math.PI + ((i+1)/N)*Math.PI - (gap/180*Math.PI)/2;
    const p = (r,a)=> `${(cx + r*Math.cos(a)).toFixed(1)} ${(cy + r*Math.sin(a)).toFixed(1)}`;
    const d = `M${p(r2,a0)} A${r2} ${r2} 0 0 1 ${p(r2,a1)} L${p(r1,a1)} A${r1} ${r1} 0 0 0 ${p(r1,a0)} Z`;
    const on = i < filled;
    out += `<path d="${d}" class="seg ${on?'on':''} ${on&&over?'over':''}" style="--i:${i}"/>`;
  }
  return `<svg viewBox="0 0 300 160" class="nu-gauge-svg">${out}</svg>`;
}

/* QN-20: số kiểu Việt (0,25 thay vì 0.25) */
function nuVN(n, d){ const x = Number(n) || 0; return x.toLocaleString("vi-VN", { maximumFractionDigits: d == null ? 1 : d }); }
/* QN-06: nước lưu theo LÍT với 3 chữ số (= mililit) — không làm tròn 0,1 L sau mỗi lần cộng; chỉ làm tròn khi hiển thị */
function nuMl(L){ return Math.round((Number(L) || 0) * 1000) / 1000; }
/* QN-07: mục tiêu nước dùng chung với app.js (waterTargetL: 35 ml × cân nặng điều chỉnh, kẹp 1,5–3,7 L, + thai kỳ T2–T3 / cho bú;
   đang lọc máu → null = không đặt chỉ tiêu). Dự phòng khi app.js cũ chưa có hàm này. */
function nuWaterGoal(p){
  p = p || state.profile || {};
  if(typeof waterTargetL === "function"){ try{ return waterTargetL(p); }catch(e){} }
  let f = null; try{ f = typeof FKHealth !== "undefined" && FKHealth.current ? FKHealth.current() : null; }catch(e){}
  if(f && f.screened && f.fluidLimit) return null;
  const ov = p.waterTargetOverride == null ? NaN : Number(p.waterTargetOverride);
  if(Number.isFinite(ov) && ov > 0) return fmt1(Math.min(6, Math.max(0.5, ov)));
  const h = (Number(p.height) || 0)/100, w = Number(p.weight) || 65, cap = h ? 25*h*h : w;
  const ref = w > cap ? cap + 0.25*(w - cap) : w;
  return fmt1(Math.min(3.7, Math.max(1.5, ref * 0.035)) + (f && f.screened ? (f.waterExtra || 0) : 0));
}

/* QN-21: đồng hồ calo chỉ "đếm" khi số calo ĐỔI (từ số đang hiện → số mới), không đếm lại từ 0 sau mỗi chạm */
function nuCountUp(el, target, dur=900){
  if(!el) return;
  target = Math.round(Number(target) || 0);
  const from = Number.isFinite(nuUI.shownKcal) ? nuUI.shownKcal : 0;
  nuUI.shownKcal = target;
  const reduce = (()=>{ try{ return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){ return false; } })();
  if(from === target || reduce || typeof requestAnimationFrame !== "function"){ el.textContent = target.toLocaleString("vi-VN"); return; }
  const t0 = performance.now();
  const step = now=>{ const t = Math.min(1,(now-t0)/dur), v = 1-Math.pow(1-t,3); el.textContent = Math.round(from + (target-from)*v).toLocaleString("vi-VN"); if(t<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(()=>{ if(nuUI.shownKcal === target) el.textContent = target.toLocaleString("vi-VN"); }, dur+200);
}

/* ---- Thẻ 1 bữa ăn (QN-21: vẽ lại riêng thẻ khi mở/đóng chi tiết) ---- */
function nuMealCardHTML(mt, log, goal){
  const items = log[mt.id] || [];
  const mk = items.reduce((s,i)=>s+(Number(i.kcal)||0),0);
  const mp = items.reduce((s,i)=>s+(Number(i.protein)||0),0), mc = items.reduce((s,i)=>s+(Number(i.carbs)||0),0), mf = items.reduce((s,i)=>s+(Number(i.fat)||0),0);
  const time = state.reminders.meal[mt.id].time;
  const open = !!nuUI.open[mt.id];
  const thumbs = items.slice(0,3).map(it=> it.recipe ? foodPic(it.recipe) : foodPic(it.name));
  const hk = nuHideKcal();                                   // vòng 2: ẩn số calo → số món + khẩu phần thay cho kcal / gam macro
  const por = (g, per)=> `${escapeHtml(nuVN(nuHalf(g/per)))} phần`;
  return `
      <div class="nu-meal" data-meal="${escapeHtml(mt.id)}" style="--tint:${MEAL_TINT[mt.id]}">
        <div class="nu-meal-head" data-toggle-meal="${escapeHtml(mt.id)}">
          <div class="nu-thumb">${thumbs.length ? thumbs.map((e,i)=>`<span style="--k:${i}">${e}</span>`).join("") : `<span class="solo">${MEAL_EMOJI[mt.id]}</span>`}</div>
          <div class="nu-meal-name"><b>${mt.label}</b><small data-edit-time="meal:${escapeHtml(mt.id)}">${escapeHtml(time)} · đổi giờ</small></div>
          <div class="nu-meal-kcal">${hk ? `<b>${items.length ? `${items.length} món` : "—"}</b><small>${items.length ? "đã ghi" : "chưa ghi"}</small>` : `<b>${Math.round(mk).toLocaleString("vi-VN")} kcal</b><small>${Math.round(mk/goal*100)}% mục tiêu</small>`}</div>
        </div>
        <div class="nu-meal-macros">
          <div><small>Đạm</small><b>${hk ? por(mp, NU_PORTION.p) : Math.round(mp)+"g"}</b></div>
          <div><small>Tinh bột</small><b>${hk ? por(mc, NU_PORTION.c) : Math.round(mc)+"g"}</b></div>
          <div><small>Béo</small><b>${hk ? por(mf, NU_PORTION.f) : Math.round(mf)+"g"}</b></div>
          <button class="nu-mini" data-add-meal="${escapeHtml(mt.id)}" aria-label="Thêm món vào ${mt.label.toLowerCase()}"><span class="material-symbols-rounded">add</span></button>
          ${items.length ? `<button class="nu-mini ghost" data-toggle-meal="${escapeHtml(mt.id)}" aria-expanded="${open}" aria-label="${open ? "Ẩn" : "Xem"} chi tiết ${mt.label.toLowerCase()}"><span class="material-symbols-rounded" style="transform:rotate(${open?-90:90}deg)">chevron_right</span></button>` : ""}
        </div>
        ${open && items.length ? `<div class="nu-items">${items.map((it,i)=>`
          <div class="nu-item"><span class="e">${foodPic(it.name)}</span><div class="t"><b>${escapeHtml(it.name)}</b><small>${escapeHtml(nuVN(it.grams,0))} g${hk ? "" : ` · đạm ${escapeHtml(nuVN(it.protein))} · tinh bột ${escapeHtml(nuVN(it.carbs))} · béo ${escapeHtml(nuVN(it.fat))}`}</small></div>${hk ? "" : `<b class="k">${escapeHtml(Math.round(Number(it.kcal)||0))}</b>`}
          <button class="nu-del" data-del-food="${escapeHtml(mt.id)}:${i}" aria-label="Xoá ${escapeHtml(it.name)}"><span class="material-symbols-rounded">close</span></button></div>`).join("")}</div>` : ""}
        ${!items.length ? `<p class="nu-empty">Chưa có món — chạm <b>+</b> để thêm, hoặc chọn từ thực đơn gợi ý bên dưới.</p>` : ""}
      </div>`;
}
function nuBindMealCard(card){
  $$("[data-add-meal]", card).forEach(b=> b.addEventListener("click", e=>{ e.stopPropagation(); openAddFood(b.dataset.addMeal); }));
  $$("[data-toggle-meal]", card).forEach(b=> b.addEventListener("click", e=>{
    if(e.target.closest("[data-edit-time]") || e.target.closest("[data-add-meal]")) return;
    e.stopPropagation();
    const id = b.dataset.toggleMeal; nuUI.open[id] = !nuUI.open[id]; nuRefreshMeal(id);
  }));
  $$("[data-edit-time]", card).forEach(t=> t.addEventListener("click", e=>{ e.stopPropagation(); openEditReminderTime(...t.dataset.editTime.split(":")); }));
  $$("[data-del-food]", card).forEach(b=> b.addEventListener("click", e=>{
    e.stopPropagation();
    const [mealId, i] = b.dataset.delFood.split(":");
    nuDeleteFood(mealId, Number(i));
  }));
}
/* Thay 1 nút cũ trong #nu-content bằng HTML mới (không vẽ lại cả màn ~2.000 nút). Không làm được (DOM giả / chưa vẽ) → vẽ lại cả màn. */
function nuSwapBlock(old, html, bind){
  if(!old || typeof old.replaceWith !== "function" || !old.parentNode){ renderNutritionScreen(); return null; }
  const tmp = document.createElement("div"); tmp.innerHTML = html;
  const fresh = tmp.firstElementChild;
  if(!fresh){ renderNutritionScreen(); return null; }
  old.replaceWith(fresh); bind(fresh);
  return fresh;
}
function nuRefreshMeal(id){
  const mt = MEAL_TYPES.find(m=> m.id === id); if(!mt) return;
  const old = document.querySelector(`#nu-content .nu-meal[data-meal="${id}"]`);
  nuSwapBlock(old, nuMealCardHTML(mt, getDayFoodLog(), state.profile.goalKcal || 2000), nuBindMealCard);
}

/* QN-14: xoá 1 món → hiện thanh "Hoàn tác" 5 giây (trước đây xoá 1 chạm, không lấy lại được) */
let _nuUndo = null;
function nuUndoBar(msg, onUndo, ms){
  ms = ms || 5000;
  try{
    if(_nuUndo){ clearTimeout(_nuUndo.t); if(_nuUndo.el && _nuUndo.el.remove) _nuUndo.el.remove(); _nuUndo = null; }
    const el = document.createElement("div");
    el.className = "nu-undo"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
    el.innerHTML = `<span class="material-symbols-rounded">delete</span><span class="nu-undo-t">${escapeHtml(msg)}</span><button type="button" class="nu-undo-b">Hoàn tác</button>`;
    document.body.appendChild(el);
    const close = ()=>{ if(!_nuUndo || _nuUndo.el !== el) return; clearTimeout(_nuUndo.t); _nuUndo = null; el.classList.remove("show"); setTimeout(()=>{ if(el.remove) el.remove(); }, 260); };
    const btn = el.querySelector ? el.querySelector(".nu-undo-b") : null;
    if(btn) btn.addEventListener("click", ()=>{ close(); onUndo(); });
    _nuUndo = { el, t: setTimeout(close, ms), undo: ()=>{ close(); onUndo(); } };
    if(typeof requestAnimationFrame === "function") requestAnimationFrame(()=> el.classList.add("show")); else el.classList.add("show");
  }catch(e){ toast(msg, "delete"); }
}
function nuDeleteFood(mealId, i){
  const day = todayStr();
  const L = getDayFoodLog(day)[mealId];
  if(!L || !L[i]) return;
  const [removed] = L.splice(i, 1);
  saveState(); renderNutritionScreen();
  nuUndoBar(`Đã xoá ${removed.name}`, ()=>{
    const LL = getDayFoodLog(day)[mealId];
    LL.splice(Math.min(i, LL.length), 0, removed);
    nuUI.open[mealId] = true; saveState(); renderNutritionScreen();
    toast(`Đã khôi phục ${removed.name}`, "undo");
  });
}

/* ---- Khối nước uống (QN-06/07/20/21) ---- */
function nuWaterHTML(){
  const p = state.profile;
  const water = nuMl(nuFix(state.waterLog[todayStr()], NU_LIM.waterL));      // R3-NUT-05: không hiện số âm / NaN / cực lớn
  const goal = nuWaterGoal(p);
  const btns = `<div class="nu-water-btns"><button data-w="0.25">+250 ml</button><button data-w="0.5">+500 ml</button><button data-w="reset">Đặt lại</button></div>`;
  const edit = `<button class="icon-btn nu-water-edit" id="nu-water-edit" aria-label="Đặt mục tiêu nước uống"><span class="material-symbols-rounded">tune</span></button>`;
  if(goal == null) return `
    <div class="nu-water" id="nu-water">
      <div class="nu-water-head"><div><b>Nước uống</b><small>${escapeHtml(nuVN(water, 2))} L hôm nay</small></div>${edit}</div>
      <p class="nu-water-note">Bạn đang lọc máu nên app <b>không đặt mục tiêu nước</b> — lượng dịch mỗi ngày theo chỉ định của bác sĩ thận (tính cả canh, sữa, trái cây mọng nước). Vẫn có thể ghi lại để đối chiếu.</p>
      ${btns}
    </div>`;
  const cups = 8, cupSize = goal/cups, cupsDone = Math.min(cups, Math.round(water/cupSize + 1e-9));
  return `
    <div class="nu-water" id="nu-water">
      <div class="nu-water-head">
        <div><b>Nước uống</b><small>${escapeHtml(nuVN(water, 2))} / ${escapeHtml(nuVN(goal, 1))} L</small></div>${edit}
      </div>
      <div class="nu-cups">${Array.from({length:cups},(_,i)=>`<button class="cup ${i<cupsDone?'on':''}" data-cup="${i}" aria-pressed="${i<cupsDone}" aria-label="Ly ${i+1} (${Math.round(cupSize*1000)} ml)"><span class="material-symbols-rounded">water_drop</span></button>`).join("")}</div>
      ${btns}
    </div>`;
}
function nuBindWater(box){
  const ed = $$("#nu-water-edit", box)[0] || $("#nu-water-edit");
  if(ed) ed.addEventListener("click", openEditWaterTarget);
  $$("[data-cup]", box).forEach(b=> b.addEventListener("click", ()=>{
    const k = todayStr(), goal = nuWaterGoal(state.profile); if(!goal) return;
    const cupSize = goal/8, i = Number(b.dataset.cup);
    const done = Math.min(8, Math.round(nuFix(state.waterLog[k], NU_LIM.waterL)/cupSize + 1e-9));
    state.waterLog[k] = nuMl((i < done && i === done-1 ? i : i+1) * cupSize);
    saveState(); nuRefreshWater();
  }));
  $$("[data-w]", box).forEach(b=> b.addEventListener("click", ()=>{
    const k = todayStr();
    if(b.dataset.w === "reset"){ state.waterLog[k] = 0; saveState(); nuRefreshWater(); return; }
    /* R3-NUT-05: trần 15 L/ngày (trước đây cộng vô hạn); vượt xa mục tiêu → nhắc 1 lần/ngày về nguy cơ uống quá nhiều nước */
    const cur = nuFix(state.waterLog[k], NU_LIM.waterL), add = nuFix(b.dataset.w, 2), next = nuMl(Math.min(NU_LIM.waterL, cur + add));
    if(next <= cur){ toast(`Đã đạt mức ghi tối đa ${NU_LIM.waterL} L/ngày`, "error"); return; }
    state.waterLog[k] = next;
    const goal = nuWaterGoal(state.profile), hi = Math.max(5, (Number(goal) || 0) + 2);
    if(goal != null && cur < hi && next >= hi && nuUI.waterWarn !== k){
      nuUI.waterWarn = k;
      toast("Bạn đã uống vượt xa mục tiêu. Uống quá nhiều nước trong thời gian ngắn có thể gây hạ natri máu — không cần uống thêm nếu không khát.", "water_drop");
    }
    saveState(); nuRefreshWater();
  }));
}
function nuRefreshWater(){ nuSwapBlock(document.getElementById("nu-water"), nuWaterHTML(), nuBindWater); }

renderNutritionScreen = function(){
  ensureReminderDefaults();
  const el = $("#nu-content"); if(!el) return;
  const p = state.profile;
  if(nuCleanLogs() > 0){ try{ saveState(); }catch(e){} }                    // R3-NUT-03/04: dòng hỏng không làm sập màn
  const log = getDayFoodLog();
  nuCleanDay(log, true);
  let kcal=0, protein=0, carbs=0, fat=0;
  Object.values(log).forEach(list=> list.forEach(it=>{ kcal+=Number(it.kcal)||0; protein+=Number(it.protein)||0; carbs+=Number(it.carbs)||0; fat+=Number(it.fat)||0; }));
  const goal = Number(p.goalKcal) > 0 && Number.isFinite(Number(p.goalKcal)) ? Number(p.goalKcal) : 2000, pct = kcal/goal;     // R3-NUT-07: mục tiêu NaN/âm → 2.000
  const left = Math.round(goal - kcal);
  const now = new Date();
  const goalLabel = typeof goalDisplay === "function" ? goalDisplay(p).label : ((GOALS.find(g=>g.id===p.goal)||{}).label || "");   // QN-02

  // 7 ngày gần nhất
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); const k=todayStr(d);
    const L = state.foodLog[k]; let s=0; if(L && typeof L === "object") Object.values(L).forEach(l=>{ if(Array.isArray(l)) l.forEach(it=>{ s += nuFix(it && it.kcal, NU_LIM.kcal); }); });
    return { k, s, lab: i===6 ? "Nay" : WD_SHORT[d.getDay()] }; });
  const maxDay = Math.max(goal, ...days.map(d=>d.s));

  const macro = (label, val, tgt, color, extra)=>{ tgt = Math.round(nuFix(tgt, 99999)); return `
    <div class="nu-macro">
      <div class="nu-macro-top"><span>${label}${extra||""}</span><b>${Math.round(val)}<small>/${tgt ? escapeHtml(tgt) : "—"}g</small></b></div>
      <div class="nu-bar"><i style="width:${tgt?Math.min(100,val/tgt*100):0}%;background:${color}"></i></div>
    </div>`; };

  const hk = nuHideKcal();                                           // vòng 2: "Ẩn số calo"
  const recipes = nuRecipeList(hk);
  const shown = Number.isFinite(nuUI.shownKcal) ? nuUI.shownKcal : 0;
  const tags = hk ? RECIPE_TAGS.filter(t=> t.id !== "giam-mo") : RECIPE_TAGS;     // không đẩy khung "giảm mỡ" khi đang ẩn số calo

  el.innerHTML = `
    <div class="nu-date">${now.getDay()===0?"Chủ nhật":"Thứ "+(now.getDay()+1)}, ${pad2(now.getDate())}/${pad2(now.getMonth()+1)}${goalLabel?` · Mục tiêu: ${escapeHtml(goalLabel)}`:""}</div>

    ${hk ? nuPlateCardHTML(log, { protein, carbs, fat }, p) : `
    <div class="nu-gauge-card">
      <button type="button" class="nu-kcal-toggle nu-kcal-eye" data-nu-kcal="hide" aria-label="Ẩn số calo (hiện khẩu phần thay thế)"><span class="material-symbols-rounded">visibility_off</span></button>
      <div class="nu-gauge">
        ${nuGaugeSVG(pct)}
        <div class="nu-gauge-center">
          <span class="material-symbols-rounded">bolt</span>
          <div class="nu-kcal"><b id="nu-kcal-num">${Math.round(shown).toLocaleString("vi-VN")}</b> kcal</div>
          <div class="nu-goal">Mục tiêu ${goal.toLocaleString("vi-VN")} kcal</div>
        </div>
      </div>
      <div class="nu-left ${left<0?'over':''}">${left>=0 ? `Còn <b>${left.toLocaleString("vi-VN")}</b> kcal cho hôm nay` : `Đã vượt <b>${(-left).toLocaleString("vi-VN")}</b> kcal`}</div>
      <div class="nu-macros">
        ${macro("Đạm", protein, p.protein, "#FF7A45", nuWhyBtn(p.protein))}
        ${macro("Tinh bột", carbs, p.carbs, "#5EE6C7")}
        ${macro("Chất béo", fat, p.fat, "#9AF1DD")}
      </div>
      <div class="nu-week">
        ${days.map(d=>`<div class="nu-day ${d.k===todayStr()?'today':''}"><div class="col"><i style="height:${Math.max(4, d.s/maxDay*100)}%" class="${d.s>goal?'over':''}"></i><em style="bottom:${goal/maxDay*100}%"></em></div><small>${d.lab}</small></div>`).join("")}
      </div>
    </div>`}

    <button class="nu-add" id="nu-add"><span class="material-symbols-rounded">add</span><span>Thêm món ăn</span></button>

    ${MEAL_TYPES.map(mt=> nuMealCardHTML(mt, log, goal)).join("")}

    ${nuWaterHTML()}

    ${typeof nuPlanSlotHTML === "function" ? nuPlanSlotHTML() : nuPlanCardHTML()}

    <div class="section-title" style="margin-top:6px;"><h3>Món healthy</h3><a id="nu-see-all" role="button" tabindex="0">Xem tất cả</a></div>
    <div class="nu-tags">${tags.map(t=>`<button class="nu-tag ${nuUI.tag===t.id?'on':''}" data-tag="${t.id}" aria-pressed="${nuUI.tag===t.id}"><span>${t.emoji}</span><small>${t.label}</small></button>`).join("")}</div>
    <div class="nu-recipes" id="nu-recipes">${recipes.slice(0, NU_RC_FIRST).map((r,i)=> nuRecipeCardHTML(r, i, hk)).join("")}</div>
    <p class="small-note" style="text-align:center;margin-top:4px;">${hk ? "Khẩu phần theo bàn tay chỉ là ước lượng — lắng nghe cảm giác đói/no của cơ thể." : "Calo tính theo bảng USDA FoodData Central &amp; Bảng thành phần thực phẩm Việt Nam — chỉ mang tính ước lượng."}</p>
  `;

  if(!hk) nuCountUp($("#nu-kcal-num"), kcal);
  $("#nu-add").addEventListener("click", openQuickAddMeal);
  $$(".nu-meal", el).forEach(nuBindMealCard);
  nuBindWater($$("#nu-water", el)[0] || el);
  $$("[data-tag]", el).forEach(b=> b.addEventListener("click", ()=>{ nuUI.tag = b.dataset.tag; nuRefreshRecipes(); }));     // QU-03: chỉ vẽ lại dải món
  const rbox = $$("#nu-recipes", el)[0] || $("#nu-recipes");
  if(rbox) rbox.addEventListener("click", e=>{ const c = e.target && e.target.closest && e.target.closest("[data-recipe]"); if(c) openRecipe(c.dataset.recipe); });
  nuRecipesMore(recipes, NU_RC_FIRST, hk);
  $("#nu-see-all").addEventListener("click", ()=>{ nuUI.tag = "all"; nuRefreshRecipes(); });
  $$(".nu-gauge-card [data-nu-why]", el).forEach(b=> b.addEventListener("click", e=>{ e.stopPropagation(); try{ NutriPro.ui.openProteinWhy(); }catch(_){} }));
  $$("[data-nu-kcal]", el).forEach(b=> b.addEventListener("click", ()=> nuSetHideKcal(b.dataset.nuKcal === "hide")));
  bindPlanCard(el);
};

/* Nút "+" lớn: tự chọn bữa gần giờ hiện tại nhất */
function openQuickAddMeal(){
  const h = new Date().getHours();
  const guess = h < 10 ? "breakfast" : h < 14 ? "lunch" : h < 17 ? "snack" : "dinner";
  openSheet(`
    <div class="sheet-header"><h3>Thêm vào bữa nào?</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="nu-pick">${MEAL_TYPES.map(mt=>`<button data-pick="${mt.id}" class="${mt.id===guess?'on':''}" style="--tint:${MEAL_TINT[mt.id]}"><span>${MEAL_EMOJI[mt.id]}</span><b>${mt.label}</b><small>${state.reminders.meal[mt.id].time}</small></button>`).join("")}</div>
  `);
  $$("[data-pick]").forEach(b=> b.addEventListener("click", ()=> openAddFood(b.dataset.pick)));
}

function openRecipe(id, scaled){
  const base = RECIPES.find(x=>x.id===id); if(!base) return;
  let r = scaled || base;
  let meal = r.meal;
  const render = ()=>{
    const m = recipeMacros(r);
    const cm = COOK_METHODS[r.method] || COOK_METHODS.boil;
    openSheet(`
      <div class="sheet-header"><h3 style="font-size:18px;">${escapeHtml(r.name)}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
      <div class="nu-recipe-hero"><div class="nu-bowl big">${foodPic(r.id)}</div>
        <div class="nu-recipe-kcal"><b>${m.kcal}</b><small>kcal${r.factor && Math.abs(r.factor-1)>0.05 ? ` · khẩu phần ×${(Math.round(r.factor*10)/10).toString().replace(".",",")}` : ""}</small></div></div>
      <div class="chip-row" style="margin:6px 0 2px;">
        <span class="pill"><span class="material-symbols-rounded" style="font-size:15px;">${cm.icon}</span>${cm.label}</span>
        <span class="pill">${r.min} phút</span><span class="pill">${r.cuisine==="vn"?"Món Việt":"Món Âu"}</span><span class="pill">${["Dễ","Vừa","Khó"][r.level-1]}</span>
      </div>
      <div class="stat-grid" style="margin:12px 0;">
        <div class="stat-box"><div class="num">${m.protein}g</div><div class="cap">Đạm</div></div>
        <div class="stat-box"><div class="num">${m.carbs}g</div><div class="cap">Tinh bột</div></div>
        <div class="stat-box"><div class="num">${m.fat}g</div><div class="cap">Béo</div></div>
      </div>
      <div class="card-title" style="font-size:13px;">Nguyên liệu (1 người)</div>
      ${m.lines.map(l=>`<div class="nu-item"><span class="e">${foodPic(l.name)}</span><div class="t"><b>${escapeHtml(l.name)}</b><small>${l.grams}g</small></div><b class="k">${l.kcal}</b></div>`).join("")}
      ${r.steps ? `<div class="card-title" style="font-size:13px;margin-top:14px;">Cách làm</div>
      <ol class="nu-steps">${r.steps.map(t=>`<li>${escapeHtml(t)}</li>`).join("")}</ol>` : ""}
      ${r.tip ? `<div class="nu-tip"><span class="material-symbols-rounded">lightbulb</span><span>${escapeHtml(r.tip)}</span></div>` : ""}
      <div class="card-title" style="font-size:13px;margin-top:14px;">Thêm vào nhật ký</div>
      <div class="chip-row">${MEAL_TYPES.map(mt=>`<button class="pill ${meal===mt.id?'active':''}" data-rm="${mt.id}">${mt.label}</button>`).join("")}</div>
      <button class="btn btn-primary btn-block" id="rc-add" style="margin-top:14px;"><span class="material-symbols-rounded">add</span>Thêm món vào ${MEAL_TYPES.find(x=>x.id===meal).label.toLowerCase()} · ${m.kcal} kcal</button>
    `);
    $$("[data-rm]").forEach(b=> b.addEventListener("click", ()=>{ meal = b.dataset.rm; render(); }));
    $("#rc-add").addEventListener("click", ()=>{
      addRecipeToLog(r, meal);
      closeSheet(); renderNutritionScreen();
      toast(`Đã thêm ${r.name} · ${m.kcal} kcal`, "restaurant");
    });
  };
  render();
}
function addRecipeToLog(r, meal){
  const m = recipeMacros(r);
  const L = getDayFoodLog()[meal];
  L.push({ name:r.name, recipe:r.id, grams: r.items.reduce((s,[,g])=>s+g,0), kcal:m.kcal, protein:m.protein, carbs:m.carbs, fat:m.fat });
  nuUI.open[meal] = true; saveState();
}

/* ---------------- Thực đơn tự động theo thể trạng ---------------- */
function nuPlanCardHTML(){
  const p = state.profile;
  const a = bodyAnalysis(p);
  const goalDef = GOALS.find(g=>g.id===p.goal) || GOALS[1];
  const recDef = GOALS.find(g=>g.id===a.rec);
  const mismatch = recDef && a.rec !== p.goal && a.cat !== "Bình thường" && !(p.age && p.age < 18);   // BUG-04: không mời người < 18 tuổi đổi mục tiêu
  const di = nuUI.planDay != null ? nuUI.planDay : (new Date().getDay()+6)%7;
  const plan = buildDayPlan(p, di, { cuisine: nuUI.planCuisine||"all", veg: !!nuUI.planVeg });
  const total = Object.values(plan).reduce((s,r)=> s + recipeMacros(r).kcal, 0);
  const prot = Object.values(plan).reduce((s,r)=> s + recipeMacros(r).protein, 0);
  const DAYS = ["T2","T3","T4","T5","T6","T7","CN"];
  return `
  <div class="nu-plan">
    <div class="nu-plan-head">
      <div class="nu-bmi" style="--c:${a.color}"><b>${a.bmi && !a.hideBmi ? escapeHtml(nuVN(a.bmi)) : "—"}</b><small>BMI</small></div>
      <div class="nu-plan-txt"><b>${a.cat}${a.bmi?` · ${p.weight} kg, ${p.height} cm`:""}</b><small>${escapeHtml(a.advice)}</small></div>
    </div>
    ${mismatch ? `<button class="nu-plan-switch" data-switch-goal="${a.rec}"><span class="material-symbols-rounded">swap_horiz</span>Mục tiêu hiện tại là "${goalDef.label}". Chuyển sang "${recDef.label}"?</button>` : ""}
    ${p.goalBlocked ? `<div class="nu-tip" style="margin-top:10px;"><span class="material-symbols-rounded">lightbulb</span><span>Bạn đang thiếu cân hoặc dưới 18 tuổi nên app <b>không áp dụng thâm hụt calo</b> — calo được giữ ở mức duy trì để an toàn.</span></div>` : ""}
    <div class="nu-plan-goal"><span>Mục tiêu: <b>${goalDef.label}</b></span><span><b>${(p.goalKcal||0).toLocaleString("vi-VN")}</b> kcal/ngày · đạm ${p.protein}g</span></div>
    <div class="section-title" style="margin:12px 0 6px;"><h3 style="font-size:16px;">Thực đơn gợi ý cho bạn</h3>
      <a data-plan-cz="${(nuUI.planCuisine||"all")==="all"?"vn":(nuUI.planCuisine==="vn"?"au":"all")}">${(nuUI.planCuisine||"all")==="all"?"Việt + Âu":(nuUI.planCuisine==="vn"?"Chỉ món Việt":"Chỉ món Âu")} ⇄</a></div>
    <div class="nu-plan-opts"><button class="${nuUI.planVeg?'on':''}" data-plan-veg>🥬 Chỉ món chay</button></div>
    <div class="nu-plan-days">${DAYS.map((d,i)=>`<button class="${i===di?'on':''}" data-plan-day="${i}">${d}</button>`).join("")}</div>
    <div class="nu-plan-meals">${MEAL_TYPES.map(mt=>{ const r = plan[mt.id]; if(!r) return ""; const m = recipeMacros(r); return `
      <div class="nu-plan-meal" data-plan-open="${mt.id}">
        <div class="ph">${foodPic(r.id)}</div>
        <div class="t"><small>${mt.label} · ${COOK_METHODS[r.method].label}</small><b>${escapeHtml(r.name)}</b></div>
        <div class="k"><b>${m.kcal}</b><small>kcal</small></div>
      </div>`; }).join("")}</div>
    <div class="nu-plan-foot"><span>Tổng <b>${total.toLocaleString("vi-VN")}</b> kcal · đạm <b>${Math.round(prot)}g</b></span>
      <button class="btn btn-primary btn-sm" id="nu-plan-apply"><span class="material-symbols-rounded">playlist_add</span>${di===(new Date().getDay()+6)%7 ? "Ghi vào hôm nay" : `Ghi thực đơn ${DAYS[di]} vào hôm nay`}</button></div>
  </div>`;
}
function bindPlanCard(el){
  const p = state.profile;
  const di = nuUI.planDay != null ? nuUI.planDay : (new Date().getDay()+6)%7;
  const plan = buildDayPlan(p, di, { cuisine: nuUI.planCuisine||"all", veg: !!nuUI.planVeg });
  $$("[data-plan-day]", el).forEach(b=> b.addEventListener("click", ()=>{ nuUI.planDay = Number(b.dataset.planDay); renderNutritionScreen(); }));
  $$("[data-plan-veg]", el).forEach(b=> b.addEventListener("click", ()=>{ nuUI.planVeg = !nuUI.planVeg; renderNutritionScreen(); }));
  $$("[data-plan-cz]", el).forEach(b=> b.addEventListener("click", ()=>{ nuUI.planCuisine = b.dataset.planCz; renderNutritionScreen(); }));
  $$("[data-plan-open]", el).forEach(b=> b.addEventListener("click", ()=> openRecipe(plan[b.dataset.planOpen].id, plan[b.dataset.planOpen])));
  $$("[data-switch-goal]", el).forEach(b=> b.addEventListener("click", ()=>{
    p.goal = b.dataset.switchGoal; p.autoTargets = true; recomputeProfile(); saveState(); renderNutritionScreen();
    toast(`Đã đổi mục tiêu: ${GOALS.find(g=>g.id===p.goal).label} · ${p.goalKcal} kcal/ngày`, "check_circle");
  }));
  const ap = $("#nu-plan-apply"); if(ap) ap.addEventListener("click", ()=>{
    const L = getDayFoodLog();
    const already = Object.values(L).some(list=> list.some(it=> it.fromPlan));
    const go = ()=>{
      ap.disabled = true;
      Object.entries(plan).forEach(([meal, r])=>{ addRecipeToLog(r, meal); const l = L[meal]; l[l.length-1].fromPlan = true; });
      saveState(); renderNutritionScreen(); toast("Đã ghi thực đơn vào nhật ký HÔM NAY", "restaurant");
    };
    if(already) confirmDialog("Ghi thêm thực đơn?", "Hôm nay bạn đã ghi một thực đơn gợi ý rồi. Ghi thêm sẽ cộng dồn calo.", go); else go();
  });
}

/* Tìm không dấu: "uc ga" → "Ức gà" */
function viFold(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase(); }

/* Danh sách thực phẩm khi thêm món: có ảnh thật */
openAddFood = function(mealId){
  const mt = MEAL_TYPES.find(m=>m.id===mealId);
  const render = (query="") => {
    const q = query.trim().toLowerCase();
    const results = FOODS.filter(f=> viFold(f.name).includes(viFold(q))).slice(0,60);
    return results.map(f=>`
      <div class="food-result fr-pic" data-pick="${f.id}">
        ${foodPic(f.id, "fr-img")}
        <div class="fr-t"><div class="name">${escapeHtml(f.name)}</div><div class="kcal">${f.portion ? `${f.unit} ≈ ${f.portion}g` : "/100g"} · đạm ${escapeHtml(nuVN(f.protein))} · tinh bột ${escapeHtml(nuVN(f.carbs))} · béo ${escapeHtml(nuVN(f.fat))} /100 g</div></div>
        <b>${f.portion ? Math.round(f.kcal*f.portion/100) : f.kcal} kcal</b>
      </div>`).join("") || `<p class="empty-hint">Không tìm thấy món ăn phù hợp</p>`;
  };
  openSheet(`
    <div class="sheet-header"><h3>Thêm vào ${mt.label}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="search-box" style="margin-bottom:10px;">
      <span class="material-symbols-rounded" style="color:var(--text-dim);">search</span>
      <input type="text" id="food-search" placeholder="Tìm thực phẩm — VD: ức gà, cơm, chuối...">
    </div>
    <div id="food-results" style="max-height:52vh;overflow-y:auto;">${render()}</div>
  `);
  $("#food-search").addEventListener("input", (e)=>{ $("#food-results").innerHTML = render(e.target.value); bindFoodPick(mealId); });
  bindFoodPick(mealId);
};

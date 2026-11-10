/* =========================================================================
   FIT KIT — Màn Dinh dưỡng v2 (thiết kế lại)
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
  { id:"airfryer", label:"Nồi chiên KD", emoji:"🌀" }, { id:"chay", label:"Ăn chay", emoji:"🥬" }, { id:"an-vat", label:"Ăn vặt", emoji:"🍪" },
];
function recipeMatchesTag(r, tag){
  if(tag==="all") return true;
  if(tag==="vn" || tag==="au") return r.cuisine===tag;
  if(tag==="airfryer") return r.method==="airfryer";
  if(tag==="plan"){ const g = state.profile.goal; return g==="lose" ? r.tags.includes("giam-mo") : g==="gain" ? r.tags.includes("tang-co") : true; }
  return r.tags.includes(tag);
}

/* ---- Ảnh thật đã tách nền (media/food, phát qua jsDelivr). Chưa có ảnh → dùng emoji ---- */
const FOOD_IMG_BASE = "https://cdn.jsdelivr.net/gh/thangvu030198-ai/fitkit-app@main/media/food/";
let FOOD_IMG = {};
(async ()=>{
  try{ const r = await fetch(FOOD_IMG_BASE + "index.json"); if(r.ok){ FOOD_IMG = await r.json(); if(typeof renderNutritionScreen==="function" && $("#screen-nutrition.active")) renderNutritionScreen(); } }catch(e){}
})();
function foodIdOf(idOrName){ if(FOODS.some(f=>f.id===idOrName)) return idOrName; const f = FOODS.find(f=>f.name===idOrName); return f ? f.id : ""; }
function foodPic(idOrName, cls="fp"){
  const id = RECIPES.some(r=>r.id===idOrName) ? idOrName : foodIdOf(idOrName);
  const hit = FOOD_IMG[id];
  if(hit) return `<img class="${cls}" src="${FOOD_IMG_BASE+hit.file}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${foodEmoji(id)}'}))">`;
  const r = RECIPES.find(x=>x.id===id);
  return `<span class="${cls} emo">${r ? r.emoji : foodEmoji(id)}</span>`;
}

function recipeMacros(r){
  const out = { kcal:0, protein:0, carbs:0, fat:0, lines:[] };
  r.items.forEach(([id,g])=>{
    const f = FOODS.find(x=>x.id===id); if(!f) return;
    const k = g/100;
    const line = { name:f.name, grams:g, kcal:Math.round(f.kcal*k), protein:fmt1(f.protein*k), carbs:fmt1(f.carbs*k), fat:fmt1(f.fat*k) };
    out.kcal += line.kcal; out.protein += f.protein*k; out.carbs += f.carbs*k; out.fat += f.fat*k; out.lines.push(line);
  });
  out.protein = Math.round(out.protein); out.carbs = Math.round(out.carbs); out.fat = Math.round(out.fat);
  return out;
}

let nuUI = { tag:"all", open:{} };

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

function nuCountUp(el, target, dur=1200){
  const t0 = performance.now();
  const step = now=>{ const t = Math.min(1,(now-t0)/dur), v = 1-Math.pow(1-t,3); el.textContent = Math.round(target*v).toLocaleString("vi-VN"); if(t<1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(()=> el.textContent = Math.round(target).toLocaleString("vi-VN"), dur+200);
}

renderNutritionScreen = function(){
  ensureReminderDefaults();
  const el = $("#nu-content"); if(!el) return;
  const p = state.profile;
  const log = getDayFoodLog();
  let kcal=0, protein=0, carbs=0, fat=0;
  Object.values(log).forEach(list=> list.forEach(it=>{ kcal+=it.kcal; protein+=it.protein; carbs+=it.carbs; fat+=it.fat; }));
  const goal = p.goalKcal || 2000, pct = kcal/goal;
  const left = Math.round(goal - kcal);
  const now = new Date();
  const water = state.waterLog[todayStr()] || 0;
  const waterGoal = p.waterTargetOverride != null ? p.waterTargetOverride : fmt1(p.weight * 0.035);
  const cups = 8, cupSize = waterGoal/cups, cupsDone = Math.min(cups, Math.round(water/cupSize));
  const goalDef = GOALS.find(g=>g.id===p.goal);

  // 7 ngày gần nhất
  const days = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); const k=todayStr(d);
    const L = state.foodLog[k]; let s=0; if(L) Object.values(L).forEach(l=>l.forEach(it=>s+=it.kcal));
    return { k, s, lab: i===6 ? "Nay" : WD_SHORT[d.getDay()] }; });
  const maxDay = Math.max(goal, ...days.map(d=>d.s));

  const macro = (label, val, tgt, color)=>`
    <div class="nu-macro">
      <div class="nu-macro-top"><span>${label}</span><b>${Math.round(val)}<small>/${tgt}g</small></b></div>
      <div class="nu-bar"><i style="width:${tgt?Math.min(100,val/tgt*100):0}%;background:${color}"></i></div>
    </div>`;

  const recipes = RECIPES.filter(r=> recipeMatchesTag(r, nuUI.tag));

  el.innerHTML = `
    <div class="nu-date">${now.getDay()===0?"Chủ nhật":"Thứ "+(now.getDay()+1)}, ${pad2(now.getDate())}/${pad2(now.getMonth()+1)}${goalDef?` · Mục tiêu: ${goalDef.label}`:""}</div>

    <div class="nu-gauge-card">
      <div class="nu-gauge">
        ${nuGaugeSVG(pct)}
        <div class="nu-gauge-center">
          <span class="material-symbols-rounded">bolt</span>
          <div class="nu-kcal"><b id="nu-kcal-num">0</b> kcal</div>
          <div class="nu-goal">Mục tiêu ${goal.toLocaleString("vi-VN")} kcal</div>
        </div>
      </div>
      <div class="nu-left ${left<0?'over':''}">${left>=0 ? `Còn <b>${left.toLocaleString("vi-VN")}</b> kcal cho hôm nay` : `Đã vượt <b>${(-left).toLocaleString("vi-VN")}</b> kcal`}</div>
      <div class="nu-macros">
        ${macro("Đạm", protein, p.protein, "#FF7A45")}
        ${macro("Tinh bột", carbs, p.carbs, "#5EE6C7")}
        ${macro("Chất béo", fat, p.fat, "#9AF1DD")}
      </div>
      <div class="nu-week">
        ${days.map(d=>`<div class="nu-day ${d.k===todayStr()?'today':''}"><div class="col"><i style="height:${Math.max(4, d.s/maxDay*100)}%" class="${d.s>goal?'over':''}"></i><em style="bottom:${goal/maxDay*100}%"></em></div><small>${d.lab}</small></div>`).join("")}
      </div>
    </div>

    <button class="nu-add" id="nu-add"><span class="material-symbols-rounded">add</span><span>Thêm món ăn</span></button>

    ${MEAL_TYPES.map(mt=>{
      const items = log[mt.id];
      const mk = items.reduce((s,i)=>s+i.kcal,0);
      const mp = items.reduce((s,i)=>s+i.protein,0), mc = items.reduce((s,i)=>s+i.carbs,0), mf = items.reduce((s,i)=>s+i.fat,0);
      const time = state.reminders.meal[mt.id].time;
      const open = !!nuUI.open[mt.id];
      const thumbs = items.slice(0,3).map(it=> it.recipe ? foodPic(it.recipe) : foodPic(it.name));
      return `
      <div class="nu-meal" style="--tint:${MEAL_TINT[mt.id]}">
        <div class="nu-meal-head" data-toggle-meal="${mt.id}">
          <div class="nu-thumb">${thumbs.length ? thumbs.map((e,i)=>`<span style="--k:${i}">${e}</span>`).join("") : `<span class="solo">${MEAL_EMOJI[mt.id]}</span>`}</div>
          <div class="nu-meal-name"><b>${mt.label}</b><small data-edit-time="meal:${mt.id}">${time} · đổi giờ</small></div>
          <div class="nu-meal-kcal"><b>${Math.round(mk)} kcal</b><small>${Math.round(mk/goal*100)}% mục tiêu</small></div>
        </div>
        <div class="nu-meal-macros">
          <div><small>Đạm</small><b>${Math.round(mp)}g</b></div>
          <div><small>Tinh bột</small><b>${Math.round(mc)}g</b></div>
          <div><small>Béo</small><b>${Math.round(mf)}g</b></div>
          <button class="nu-mini" data-add-meal="${mt.id}" aria-label="Thêm"><span class="material-symbols-rounded">add</span></button>
          ${items.length ? `<button class="nu-mini ghost" data-toggle-meal="${mt.id}" aria-label="Chi tiết"><span class="material-symbols-rounded" style="transform:rotate(${open?-90:90}deg)">chevron_right</span></button>` : ""}
        </div>
        ${open && items.length ? `<div class="nu-items">${items.map((it,i)=>`
          <div class="nu-item"><span class="e">${foodPic(it.name)}</span><div class="t"><b>${escapeHtml(it.name)}</b><small>${it.grams}g · Đ${it.protein} · TB${it.carbs} · B${it.fat}</small></div><b class="k">${it.kcal}</b>
          <button class="nu-del" data-del-food="${mt.id}:${i}" aria-label="Xoá"><span class="material-symbols-rounded">close</span></button></div>`).join("")}</div>` : ""}
        ${!items.length ? `<p class="nu-empty">Chưa có món — chạm <b>+</b> để thêm, hoặc chọn từ thực đơn gợi ý bên dưới.</p>` : ""}
      </div>`;
    }).join("")}

    <div class="nu-water">
      <div class="nu-water-head">
        <div><b>Nước uống</b><small>${fmt1(water)} / ${waterGoal} L</small></div>
        <button class="icon-btn" id="nu-water-edit" style="width:32px;height:32px;"><span class="material-symbols-rounded" style="font-size:16px;">tune</span></button>
      </div>
      <div class="nu-cups">${Array.from({length:cups},(_,i)=>`<button class="cup ${i<cupsDone?'on':''}" data-cup="${i}" aria-label="Ly ${i+1}"><span class="material-symbols-rounded">water_drop</span></button>`).join("")}</div>
      <div class="nu-water-btns"><button data-w="0.25">+250ml</button><button data-w="0.5">+500ml</button><button data-w="reset">Đặt lại</button></div>
    </div>

    ${nuPlanCardHTML()}

    <div class="section-title" style="margin-top:6px;"><h3>Món healthy</h3><a id="nu-see-all">Xem tất cả</a></div>
    <div class="nu-tags">${RECIPE_TAGS.map(t=>`<button class="nu-tag ${nuUI.tag===t.id?'on':''}" data-tag="${t.id}"><span>${t.emoji}</span><small>${t.label}</small></button>`).join("")}</div>
    <div class="nu-recipes">
      ${recipes.map((r,i)=>{ const m = recipeMacros(r); return `
        <div class="nu-recipe" data-recipe="${r.id}" style="--i:${i}">
          <div class="nu-recipe-top"><span class="time"><span class="material-symbols-rounded">schedule</span>${r.min} phút</span><span class="cz">${r.cuisine==="vn"?"Việt":"Âu"}</span></div>
          <div class="nu-bowl">${foodPic(r.id)}</div>
          <div class="nu-method">${COOK_METHODS[r.method].label}</div>
          <div class="nu-recipe-name">${escapeHtml(r.name)}</div>
          <div class="nu-recipe-foot">
            <span class="lvl">${["Dễ","Vừa","Khó"][r.level-1]}<i class="${r.level>=1?'on':''}"></i><i class="${r.level>=2?'on':''}"></i><i class="${r.level>=3?'on':''}"></i></span>
            <b>${m.kcal} kcal</b>
          </div>
        </div>`; }).join("")}
    </div>
    <p class="small-note" style="text-align:center;margin-top:4px;">Calo tính theo bảng USDA FoodData Central — chỉ mang tính ước lượng.</p>
  `;

  nuCountUp($("#nu-kcal-num"), kcal);
  $("#nu-add").addEventListener("click", openQuickAddMeal);
  $$("[data-add-meal]", el).forEach(b=> b.addEventListener("click", e=>{ e.stopPropagation(); openAddFood(b.dataset.addMeal); }));
  $$("[data-toggle-meal]", el).forEach(b=> b.addEventListener("click", e=>{
    if(e.target.closest("[data-edit-time]") || e.target.closest("[data-add-meal]")) return;
    const id = b.dataset.toggleMeal; nuUI.open[id] = !nuUI.open[id]; renderNutritionScreen();
  }));
  $$("[data-edit-time]", el).forEach(t=> t.addEventListener("click", e=>{ e.stopPropagation(); openEditReminderTime(...t.dataset.editTime.split(":")); }));
  $$("[data-del-food]", el).forEach(b=> b.addEventListener("click", ()=>{
    const [mealId, i] = b.dataset.delFood.split(":");
    getDayFoodLog()[mealId].splice(Number(i),1); saveState(); renderNutritionScreen();
  }));
  $("#nu-water-edit").addEventListener("click", openEditWaterTarget);
  $$("[data-cup]", el).forEach(b=> b.addEventListener("click", ()=>{
    const i = Number(b.dataset.cup);
    state.waterLog[todayStr()] = fmt1((i < cupsDone && i === cupsDone-1 ? i : i+1) * cupSize);
    saveState(); renderNutritionScreen();
  }));
  $$("[data-w]", el).forEach(b=> b.addEventListener("click", ()=>{
    const k = todayStr();
    state.waterLog[k] = b.dataset.w==="reset" ? 0 : fmt1((state.waterLog[k]||0) + Number(b.dataset.w));
    saveState(); renderNutritionScreen();
  }));
  $$("[data-tag]", el).forEach(b=> b.addEventListener("click", ()=>{ nuUI.tag = b.dataset.tag; renderNutritionScreen(); }));
  $$("[data-recipe]", el).forEach(c=> c.addEventListener("click", ()=> openRecipe(c.dataset.recipe)));
  $("#nu-see-all").addEventListener("click", ()=>{ nuUI.tag = "all"; renderNutritionScreen(); });
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
  const mismatch = recDef && a.rec !== p.goal && a.cat !== "Bình thường";
  const di = nuUI.planDay != null ? nuUI.planDay : (new Date().getDay()+6)%7;
  const plan = buildDayPlan(p, di, { cuisine: nuUI.planCuisine||"all" });
  const total = Object.values(plan).reduce((s,r)=> s + recipeMacros(r).kcal, 0);
  const prot = Object.values(plan).reduce((s,r)=> s + recipeMacros(r).protein, 0);
  const DAYS = ["T2","T3","T4","T5","T6","T7","CN"];
  return `
  <div class="nu-plan">
    <div class="nu-plan-head">
      <div class="nu-bmi" style="--c:${a.color}"><b>${a.bmi || "—"}</b><small>BMI</small></div>
      <div class="nu-plan-txt"><b>${a.cat}${a.bmi?` · ${p.weight} kg, ${p.height} cm`:""}</b><small>${escapeHtml(a.advice)}</small></div>
    </div>
    ${mismatch ? `<button class="nu-plan-switch" data-switch-goal="${a.rec}"><span class="material-symbols-rounded">swap_horiz</span>Mục tiêu hiện tại là "${goalDef.label}". Chuyển sang "${recDef.label}"?</button>` : ""}
    <div class="nu-plan-goal"><span>Mục tiêu: <b>${goalDef.label}</b></span><span><b>${(p.goalKcal||0).toLocaleString("vi-VN")}</b> kcal/ngày · đạm ${p.protein}g</span></div>
    <div class="section-title" style="margin:12px 0 6px;"><h3 style="font-size:16px;">Thực đơn gợi ý cho bạn</h3>
      <a data-plan-cz="${(nuUI.planCuisine||"all")==="all"?"vn":(nuUI.planCuisine==="vn"?"au":"all")}">${(nuUI.planCuisine||"all")==="all"?"Việt + Âu":(nuUI.planCuisine==="vn"?"Chỉ món Việt":"Chỉ món Âu")} ⇄</a></div>
    <div class="nu-plan-days">${DAYS.map((d,i)=>`<button class="${i===di?'on':''}" data-plan-day="${i}">${d}</button>`).join("")}</div>
    <div class="nu-plan-meals">${MEAL_TYPES.map(mt=>{ const r = plan[mt.id]; if(!r) return ""; const m = recipeMacros(r); return `
      <div class="nu-plan-meal" data-plan-open="${mt.id}">
        <div class="ph">${foodPic(r.id)}</div>
        <div class="t"><small>${mt.label} · ${COOK_METHODS[r.method].label}</small><b>${escapeHtml(r.name)}</b></div>
        <div class="k"><b>${m.kcal}</b><small>kcal</small></div>
      </div>`; }).join("")}</div>
    <div class="nu-plan-foot"><span>Tổng <b>${total.toLocaleString("vi-VN")}</b> kcal · đạm <b>${Math.round(prot)}g</b></span>
      <button class="btn btn-primary btn-sm" id="nu-plan-apply"><span class="material-symbols-rounded">playlist_add</span>Ghi cả ngày</button></div>
  </div>`;
}
function bindPlanCard(el){
  const p = state.profile;
  const di = nuUI.planDay != null ? nuUI.planDay : (new Date().getDay()+6)%7;
  const plan = buildDayPlan(p, di, { cuisine: nuUI.planCuisine||"all" });
  $$("[data-plan-day]", el).forEach(b=> b.addEventListener("click", ()=>{ nuUI.planDay = Number(b.dataset.planDay); renderNutritionScreen(); }));
  $$("[data-plan-cz]", el).forEach(b=> b.addEventListener("click", ()=>{ nuUI.planCuisine = b.dataset.planCz; renderNutritionScreen(); }));
  $$("[data-plan-open]", el).forEach(b=> b.addEventListener("click", ()=> openRecipe(plan[b.dataset.planOpen].id, plan[b.dataset.planOpen])));
  $$("[data-switch-goal]", el).forEach(b=> b.addEventListener("click", ()=>{
    p.goal = b.dataset.switchGoal; p.autoTargets = true; recomputeProfile(); saveState(); renderNutritionScreen();
    toast(`Đã đổi mục tiêu: ${GOALS.find(g=>g.id===p.goal).label} · ${p.goalKcal} kcal/ngày`, "check_circle");
  }));
  const ap = $("#nu-plan-apply"); if(ap) ap.addEventListener("click", ()=>{
    Object.entries(plan).forEach(([meal, r])=> addRecipeToLog(r, meal));
    renderNutritionScreen(); toast("Đã ghi thực đơn cả ngày vào nhật ký", "restaurant");
  });
}

/* Danh sách thực phẩm khi thêm món: có ảnh thật */
openAddFood = function(mealId){
  const mt = MEAL_TYPES.find(m=>m.id===mealId);
  const render = (query="") => {
    const q = query.trim().toLowerCase();
    const results = FOODS.filter(f=> f.name.toLowerCase().includes(q)).slice(0,60);
    return results.map(f=>`
      <div class="food-result fr-pic" data-pick="${f.id}">
        ${foodPic(f.id, "fr-img")}
        <div class="fr-t"><div class="name">${f.name}</div><div class="kcal">/100g · Đ${f.protein} · TB${f.carbs} · B${f.fat}</div></div>
        <b>${f.kcal} kcal</b>
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

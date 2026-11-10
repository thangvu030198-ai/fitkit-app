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
const MEAL_TINT = { breakfast:"#ffb36b", lunch:"#ff8a5c", dinner:"#ff6b6b", snack:"#c59bff" };

/* Thực đơn gợi ý — tính calo thật từ bảng FOODS (USDA) theo gram */
const RECIPES = [
  { id:"com-ga", name:"Cơm lứt gà luộc & bông cải", emoji:"🍱", min:25, level:1, tags:["giam-mo","tang-co"], meal:"lunch",
    items:[["com-gao-lut",150],["uc-ga",150],["bong-cai-xanh",100]] },
  { id:"ca-hoi-khoai", name:"Cá hồi áp chảo & khoai lang", emoji:"🐟", min:30, level:2, tags:["tang-co"], meal:"dinner",
    items:[["ca-hoi",150],["khoai-lang",200],["bong-cai-xanh",100]] },
  { id:"salad-ca-ngu", name:"Salad cá ngừ trứng", emoji:"🥗", min:15, level:1, tags:["giam-mo"], meal:"dinner",
    items:[["ca-ngu",100],["trung-ga",100],["xa-lach",80],["ca-chua",80],["dua-leo",80],["dau-oliu",7]] },
  { id:"yen-mach-chuoi", name:"Yến mạch chuối bơ đậu phộng", emoji:"🥣", min:10, level:1, tags:["tang-co"], meal:"breakfast",
    items:[["yen-mach",50],["sua-tuoi-khong-duong",200],["chuoi",100],["bo-dau-phong",15]] },
  { id:"bun-bo", name:"Bún bò nạc thanh đạm", emoji:"🍜", min:30, level:2, tags:["giam-mo"], meal:"lunch",
    items:[["bun-pho",200],["thit-bo-nac",100],["xa-lach",50],["ca-chua",50]] },
  { id:"dau-hu-sot-ca", name:"Đậu hũ sốt cà, cơm lứt, rau muống", emoji:"🍲", min:25, level:2, tags:["chay","giam-mo"], meal:"dinner",
    items:[["dau-hu",200],["ca-chua",100],["com-gao-lut",150],["rau-muong",100]] },
  { id:"banh-mi-trung", name:"Bánh mì trứng & dưa leo", emoji:"🥖", min:10, level:1, tags:["tang-co"], meal:"breakfast",
    items:[["banh-mi",80],["trung-ga",100],["dua-leo",50]] },
  { id:"tom-bap", name:"Tôm luộc & bắp", emoji:"🍤", min:15, level:1, tags:["giam-mo"], meal:"lunch",
    items:[["tom-luoc",150],["bap",150],["xa-lach",50]] },
  { id:"sua-chua-hat", name:"Sữa chua Hy Lạp, hạnh nhân & nho", emoji:"🍇", min:5, level:1, tags:["an-vat","giam-mo"], meal:"snack",
    items:[["sua-chua-hy-lap",170],["hanh-nhan",15],["nho",80]] },
  { id:"edamame-tao", name:"Edamame & táo", emoji:"🍏", min:5, level:1, tags:["an-vat","chay"], meal:"snack",
    items:[["dau-nanh-luoc",100],["tao",150]] },
];
const RECIPE_TAGS = [
  { id:"all", label:"Tất cả", emoji:"🍽️" }, { id:"giam-mo", label:"Giảm mỡ", emoji:"🔥" }, { id:"tang-co", label:"Tăng cơ", emoji:"💪" },
  { id:"chay", label:"Ăn chay", emoji:"🥬" }, { id:"an-vat", label:"Ăn vặt", emoji:"🍪" },
];
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

  const recipes = RECIPES.filter(r=> nuUI.tag==="all" || r.tags.includes(nuUI.tag));

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
        ${macro("Đạm", protein, p.protein, "#ff8a5c")}
        ${macro("Tinh bột", carbs, p.carbs, "#ffc15c")}
        ${macro("Chất béo", fat, p.fat, "#9b8cff")}
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
      const thumbs = items.slice(0,3).map(it=>foodEmoji(it.name));
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
          <div class="nu-item"><span class="e">${foodEmoji(it.name)}</span><div class="t"><b>${escapeHtml(it.name)}</b><small>${it.grams}g · Đ${it.protein} · TB${it.carbs} · B${it.fat}</small></div><b class="k">${it.kcal}</b>
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

    <div class="section-title" style="margin-top:6px;"><h3>Thực đơn gợi ý</h3><a id="nu-see-all">Xem tất cả</a></div>
    <div class="nu-tags">${RECIPE_TAGS.map(t=>`<button class="nu-tag ${nuUI.tag===t.id?'on':''}" data-tag="${t.id}"><span>${t.emoji}</span><small>${t.label}</small></button>`).join("")}</div>
    <div class="nu-recipes">
      ${recipes.map((r,i)=>{ const m = recipeMacros(r); return `
        <div class="nu-recipe" data-recipe="${r.id}" style="--i:${i}">
          <div class="nu-recipe-top"><span class="time"><span class="material-symbols-rounded">schedule</span>${r.min} phút</span></div>
          <div class="nu-bowl"><span>${r.emoji}</span></div>
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

function openRecipe(id){
  const r = RECIPES.find(x=>x.id===id); if(!r) return;
  const m = recipeMacros(r);
  let meal = r.meal;
  const render = ()=>{
    openSheet(`
      <div class="sheet-header"><h3 style="font-size:18px;">${escapeHtml(r.name)}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
      <div class="nu-recipe-hero"><div class="nu-bowl big"><span>${r.emoji}</span></div>
        <div class="nu-recipe-kcal"><b>${m.kcal}</b><small>kcal</small></div></div>
      <div class="stat-grid" style="margin:12px 0;">
        <div class="stat-box"><div class="num">${m.protein}g</div><div class="cap">Đạm</div></div>
        <div class="stat-box"><div class="num">${m.carbs}g</div><div class="cap">Tinh bột</div></div>
        <div class="stat-box"><div class="num">${m.fat}g</div><div class="cap">Béo</div></div>
      </div>
      <div class="card-title" style="font-size:13px;">Thành phần (${r.min} phút)</div>
      ${m.lines.map(l=>`<div class="nu-item"><span class="e">${foodEmoji(FOODS.find(f=>f.name===l.name)?.id||"")}</span><div class="t"><b>${escapeHtml(l.name)}</b><small>${l.grams}g</small></div><b class="k">${l.kcal}</b></div>`).join("")}
      <div class="card-title" style="font-size:13px;margin-top:14px;">Thêm vào</div>
      <div class="chip-row">${MEAL_TYPES.map(mt=>`<button class="pill ${meal===mt.id?'active':''}" data-rm="${mt.id}">${mt.label}</button>`).join("")}</div>
      <button class="btn btn-primary btn-block" id="rc-add" style="margin-top:14px;"><span class="material-symbols-rounded">add</span>Thêm ${m.lines.length} món vào ${MEAL_TYPES.find(x=>x.id===meal).label.toLowerCase()}</button>
    `);
    $$("[data-rm]").forEach(b=> b.addEventListener("click", ()=>{ meal = b.dataset.rm; render(); }));
    $("#rc-add").addEventListener("click", ()=>{
      const L = getDayFoodLog()[meal];
      m.lines.forEach(l=> L.push({ name:l.name, grams:l.grams, kcal:l.kcal, protein:l.protein, carbs:l.carbs, fat:l.fat }));
      nuUI.open[meal] = true;
      saveState(); closeSheet(); renderNutritionScreen();
      toast(`Đã thêm ${r.name} · ${m.kcal} kcal`, "restaurant");
    });
  };
  render();
}

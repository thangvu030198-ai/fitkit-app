/* =========================================================================
   FIT KIT — Ứng dụng logic (SPA, lưu trữ cục bộ)
   ========================================================================= */

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH CHUNG
   --------------------------------------------------------------------- */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function pad2(n){ return String(n).padStart(2,"0"); }
function todayStr(d=new Date()){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function dateStrOffset(offsetDays){ const d=new Date(); d.setDate(d.getDate()+offsetDays); return todayStr(d); }
function todayDayKey(d=new Date()){
  const map = ["CN","T2","T3","T4","T5","T6","T7"]; // getDay(): 0=Sun
  return map[d.getDay()];
}
function toast(msg, icon="check_circle"){
  const el = $("#toast");
  el.innerHTML = `<span class="material-symbols-rounded">${icon}</span><span>${msg}</span>`;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(()=> el.classList.remove("show"), 2600);
}
function fmt1(n){ return Math.round(n*10)/10; }

/* ---------------------------------------------------------------------
   1. STATE — lưu trong localStorage
   --------------------------------------------------------------------- */
const STORAGE_KEY = "fitkit_state_v1";

function defaultState(){
  return {
    onboarded: false,
    profile: {
      name: "", gender: "male", age: 25, height: 170, weight: 65, bodyfat: null,
      activity: "moderate", goal: "gain", program: "tang-co",
      bmr: 0, tdee: 0, goalKcal: 0, protein: 0, carbs: 0, fat: 0,
      autoTargets: true,        // true = tự tính theo công thức khoa học, false = người dùng đã tự chỉnh
      waterTargetOverride: null, // null = tự tính theo cân nặng, số = người dùng tự đặt (lít)
      sleepGoalHours: 8,         // mục tiêu giờ ngủ cá nhân hoá (mặc định 8h)
      avatarData: null,
    },
    selectedDay: todayDayKey(),
    plans: {},          // { planId: { id, name, tagline, builtin, days:{ T2:{title,intensity,duration,items:[...]}, ... } } }
    activePlanId: null,
    workoutLog: {},   // { 'YYYY-MM-DD': { dayKey, completedExerciseIds:[uid...], finishedAt } }
    finishedDates: [], // dùng tính streak
    foodLog: {},      // { 'YYYY-MM-DD': { breakfast:[...], lunch:[...], dinner:[...], snack:[...] } }
    waterLog: {},     // { 'YYYY-MM-DD': liters }
    sleepLog: {},     // { 'YYYY-MM-DD': { start, end, hours, quality } }
    reminders: {
      master: false,
      workout: {},   // { T2:{enabled:true,time:"06:00"}, ... }
      meal: {},      // { breakfast:{enabled:true,time:"07:00"}, ... }
      bedtimeEnabled: false,
      bedtimeTime: "22:30",
    },
    videoLibrary: [], // { id, name, category, createdAt } — blob thật lưu ở IndexedDB
    progressPhotos: [], // { id, ts, angle, weightAtCapture, note } — ảnh thật lưu ở IndexedDB
    inbodyLogs: [],   // { id, ts, source:'manual'|'ai', weight, bodyFatPct, muscleMassKg, bodyWaterPct, visceralFat, note }
    aiSettings: {     // API key do người dùng tự nhập, chỉ lưu trên trình duyệt này
      provider: "openai",       // 'openai' | 'gemini' | 'grok'
      openaiKey: "", openaiModel: "gpt-4o-mini",
      geminiKey: "", geminiModel: "gemini-1.5-flash",
      grokKey: "", grokModel: "grok-2-vision-1212",
    },
    driveSettings: {  // Đồng bộ sao lưu lên Google Drive cá nhân của người dùng
      clientId: "",     // OAuth Client ID do người dùng tự tạo trên Google Cloud Console
      autoSync: true,
      lastSyncAt: null,
      fileId: null,     // id file backup trên Drive (drive.file scope) sau lần đầu đồng bộ
    },
    _firedKeys: {},  // chống bắn trùng thông báo trong cùng phút
  };
}

let state = loadState();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed, {
      profile: Object.assign(defaultState().profile, parsed.profile||{}),
      reminders: Object.assign(defaultState().reminders, parsed.reminders||{}),
      aiSettings: Object.assign(defaultState().aiSettings, parsed.aiSettings||{}),
      driveSettings: Object.assign(defaultState().driveSettings, parsed.driveSettings||{}),
    });
  }catch(e){ return defaultState(); }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if(typeof driveDirty !== "undefined") driveDirty = true;
}

/* ---------------------------------------------------------------------
   2. TÍNH TOÁN KHOA HỌC: BMR / TDEE / MACRO
   --------------------------------------------------------------------- */
function calcBMR(p){
  // Mifflin-St Jeor Equation (1990)
  const base = 10*p.weight + 6.25*p.height - 5*p.age;
  return Math.round(p.gender === "male" ? base + 5 : base - 161);
}
function calcTDEE(bmr, activityId){
  const level = ACTIVITY_LEVELS.find(a=>a.id===activityId) || ACTIVITY_LEVELS[2];
  return Math.round(bmr * level.factor);
}
function calcGoalKcal(tdee, goalId){
  const goal = GOALS.find(g=>g.id===goalId) || GOALS[1];
  return Math.round(tdee * (1 + goal.kcalAdjust));
}
function calcMacros(weight, goalKcal){
  const protein = Math.round(weight * 2.0);               // 2 g/kg — mức cao trong khuyến nghị ISSN 1.6-2.2g/kg
  const fatKcal = goalKcal * 0.25;                         // 25% tổng năng lượng
  const fat = Math.round(fatKcal / 9);
  const proteinKcal = protein * 4;
  const carbs = Math.max(0, Math.round((goalKcal - proteinKcal - fatKcal) / 4));
  return { protein, carbs, fat };
}
function recomputeProfile(){
  const p = state.profile;
  p.bmr = calcBMR(p);
  p.tdee = calcTDEE(p.bmr, p.activity);
  if(p.autoTargets !== false){
    p.goalKcal = calcGoalKcal(p.tdee, p.goal);
    const m = calcMacros(p.weight, p.goalKcal);
    p.protein = m.protein; p.carbs = m.carbs; p.fat = m.fat;
  }
  const goalDef = GOALS.find(g=>g.id===p.goal);
  p.program = goalDef ? goalDef.program : "tang-co";
}

/* ---------------------------------------------------------------------
   1b. HỘP THOẠI XÁC NHẬN DÙNG CHUNG (đặc biệt cho các nút "Khôi phục mặc định")
   --------------------------------------------------------------------- */
function confirmDialog(title, message, onConfirm, confirmLabel, icon){
  openSheet(`
    <div style="text-align:center;padding:10px 0;">
      <span class="material-symbols-rounded" style="font-size:44px;color:var(--warn);">${icon || "restart_alt"}</span>
      <h3 style="margin-top:10px;">${title}</h3>
      <p class="small-note" style="margin-top:6px;">${message}</p>
      <div style="display:flex;gap:10px;margin-top:18px;">
        <button class="btn btn-outline btn-block" id="cd-cancel">Huỷ</button>
        <button class="btn btn-primary btn-block" id="cd-confirm">${confirmLabel || "Khôi phục mặc định"}</button>
      </div>
    </div>
  `);
  $("#cd-cancel").addEventListener("click", ()=> closeSheet());
  $("#cd-confirm").addEventListener("click", ()=>{ onConfirm(); closeSheet(); });
}

/* ---------------------------------------------------------------------
   2b. CHƯƠNG TRÌNH TẬP CÁ NHÂN HÓA (plans)
   --------------------------------------------------------------------- */
function uid(){ return `u${Date.now()}${Math.floor(Math.random()*1000)}`; }

function seedPlansFromPrograms(){
  const plans = {};
  Object.entries(PROGRAMS).forEach(([id,p])=>{
    const days = {};
    DAY_KEYS.forEach(k=>{
      const d = p.days[k];
      days[k] = {
        title: d.title, intensity: d.intensity, duration: d.duration,
        items: d.exercises.map(exId => ({
          uid: exId, exerciseId: exId, custom: null,
          sets: EXERCISES[exId].sets, reps: EXERCISES[exId].reps, restSec: EXERCISES[exId].restSec,
          clipId: null,
        })),
      };
    });
    plans[id] = { id, name: p.name, tagline: p.tagline, builtin: true, days };
  });
  return plans;
}
function ensurePlans(){
  if(!state.plans || Object.keys(state.plans).length===0){
    state.plans = seedPlansFromPrograms();
  }
  if(!state.activePlanId || !state.plans[state.activePlanId]){
    const goalDef = GOALS.find(g=>g.id===state.profile.goal);
    state.activePlanId = (goalDef && state.plans[goalDef.program]) ? goalDef.program : Object.keys(state.plans)[0];
  }
  saveState();
}
function getActivePlan(){ return state.plans[state.activePlanId]; }
function blankDay(){ return { title:"Chưa đặt tên", intensity:"Vừa", duration: 30, items: [] }; }
function createBlankPlan(name){
  const id = "plan_"+uid();
  const days = {};
  DAY_KEYS.forEach(k=> days[k] = blankDay());
  const plan = { id, name: name || "Chương trình mới", tagline: "CHƯƠNG TRÌNH CÁ NHÂN HOÁ", builtin:false, days };
  state.plans[id] = plan;
  saveState();
  return plan;
}
function duplicatePlan(planId){
  const src = state.plans[planId];
  const id = "plan_"+uid();
  const days = {};
  DAY_KEYS.forEach(k=>{
    days[k] = { title: src.days[k].title, intensity: src.days[k].intensity, duration: src.days[k].duration,
      items: src.days[k].items.map(it=> Object.assign({}, it, { uid: it.exerciseId ? it.exerciseId+"_"+uid() : uid() })) };
  });
  const plan = { id, name: src.name + " (bản sao)", tagline: src.tagline, builtin:false, days };
  state.plans[id] = plan;
  saveState();
  return plan;
}
function getExerciseMeta(item){
  if(item.custom) return {
    name: item.custom.name, muscle: item.custom.muscle || "Tuỳ chỉnh",
    equipment: item.custom.equipment || "—",
    guide: item.custom.guide || "Chưa có hướng dẫn kỹ thuật — hãy xem lại video bạn đã tải lên để nhớ đúng form thực hiện.",
    img: item.custom.img || IMG.muscle_core,
  };
  const ex = EXERCISES[item.exerciseId] || { name:"Bài tập đã bị xoá", muscle:"—", equipment:"—", guide:"", img: IMG.muscle_core };
  return { name: ex.name, muscle: ex.muscle, equipment: ex.equipment, guide: ex.guide, img: ex.img };
}

/* ---------------------------------------------------------------------
   3. INDEXEDDB — lưu video clip tập luyện & ảnh tiến trình
   --------------------------------------------------------------------- */
const DB_NAME = "fitkit-db", DB_STORE = "clips", DB_STORE_PHOTOS = "photos";
function openDB(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
      if(!db.objectStoreNames.contains(DB_STORE_PHOTOS)) db.createObjectStore(DB_STORE_PHOTOS, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbAddClip(file, name){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, "readwrite");
    const req = tx.objectStore(DB_STORE).add({ name, blob: file, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGetClip(id){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const req = db.transaction(DB_STORE,"readonly").objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbDeleteClip(id){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const req = db.transaction(DB_STORE,"readwrite").objectStore(DB_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
async function dbAddPhoto(file, name){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE_PHOTOS, "readwrite");
    const req = tx.objectStore(DB_STORE_PHOTOS).add({ name, blob: file, createdAt: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGetPhoto(id){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const req = db.transaction(DB_STORE_PHOTOS,"readonly").objectStore(DB_STORE_PHOTOS).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbDeletePhoto(id){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const req = db.transaction(DB_STORE_PHOTOS,"readwrite").objectStore(DB_STORE_PHOTOS).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
/* ---- Tiện ích chung dùng cho sao lưu/khôi phục toàn bộ IndexedDB ---- */
async function dbGetAll(storeName){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const req = db.transaction(storeName,"readonly").objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
async function dbClear(storeName){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const req = db.transaction(storeName,"readwrite").objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
async function dbPutRaw(storeName, record){
  const db = await openDB();
  return new Promise((resolve,reject)=>{
    const req = db.transaction(storeName,"readwrite").objectStore(storeName).put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------------------------------------------------------------------
   4. ĐIỀU HƯỚNG
   --------------------------------------------------------------------- */
const SUB_SCREENS = ["library","plans","progress","client","ptprofile"];
function goto(screen){
  $$(".screen").forEach(s=>s.classList.remove("active"));
  $(`#screen-${screen}`).classList.add("active");
  { const sc = $(`#screen-${screen}`); sc.classList.remove("enter"); void sc.offsetWidth; sc.classList.add("enter");
    clearTimeout(sc._enterT); sc._enterT = setTimeout(()=> sc.classList.remove("enter"), 2400); }
  const navKey = ["sleep","reminders"].includes(screen) ? "home" : screen;
  $$(".nav-item").forEach(b=>b.classList.toggle("active", b.dataset.goto===navKey));
  $(".bottom-nav").classList.toggle("hidden", SUB_SCREENS.includes(screen));
  if(screen==="library") renderLibraryScreen();
  if(screen==="plans"){ plansUI = { mode:"list" }; renderPlansScreen(); }
  if(screen==="progress") renderProgressScreen();
  if(screen==="home" && typeof renderHomeScreen==="function") renderHomeScreen();
  if(screen==="coach" && typeof renderCoachScreen==="function") renderCoachScreen(true);
  if(screen==="workout") renderWorkoutScreen();
  if(screen==="nutrition") renderNutritionScreen();
  if(screen==="sleep") renderSleepScreen();
  if(screen==="reminders") renderRemindersScreen();
  $("#app-scroll").scrollTo(0,0);
}
$$("[data-goto]").forEach(el=> el.addEventListener("click", ()=> goto(el.dataset.goto)));
$$("[data-back]").forEach(el=> el.addEventListener("click", ()=> goto(el.dataset.back)));
$$(".btn-menu-trigger").forEach(btn=> btn.addEventListener("click", ()=>{
  openSheet(`
    <div class="sheet-header"><h3>FIT KIT</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div class="link-row" onclick="goto('home');closeSheet();"><div class="left"><span class="material-symbols-rounded">home</span><div class="name">Trang chủ</div></div><span class="material-symbols-rounded">chevron_right</span></div>
      <div class="link-row" onclick="goto('coach');closeSheet();"><div class="left"><span class="material-symbols-rounded">groups</span><div class="name">PT &amp; Học viên</div></div><span class="material-symbols-rounded">chevron_right</span></div>
      <div class="link-row" onclick="goto('sleep');closeSheet();"><div class="left"><span class="material-symbols-rounded">bedtime</span><div class="name">Giấc ngủ</div></div><span class="material-symbols-rounded">chevron_right</span></div>
      <div class="link-row" onclick="goto('profile');closeSheet();"><div class="left"><span class="material-symbols-rounded">person</span><div class="name">Hồ sơ của tôi</div></div><span class="material-symbols-rounded">chevron_right</span></div>
      <div class="link-row" onclick="goto('reminders');closeSheet();"><div class="left"><span class="material-symbols-rounded">notifications_active</span><div class="name">Nhắc nhở</div></div><span class="material-symbols-rounded">chevron_right</span></div>
      <div class="link-row" onclick="goto('plans');closeSheet();"><div class="left"><span class="material-symbols-rounded">edit_calendar</span><div class="name">Quản lý chương trình tập</div></div><span class="material-symbols-rounded">chevron_right</span></div>
      <div class="link-row" onclick="goto('library');closeSheet();"><div class="left"><span class="material-symbols-rounded">video_library</span><div class="name">Kho video của tôi</div></div><span class="material-symbols-rounded">chevron_right</span></div>
      <div class="link-row" onclick="goto('progress');closeSheet();"><div class="left"><span class="material-symbols-rounded">insights</span><div class="name">Ảnh tiến trình &amp; InBody</div></div><span class="material-symbols-rounded">chevron_right</span></div>
    </div>
    <p class="small-note" style="margin-top:14px;text-align:center;">FIT KIT — Huấn luyện &amp; dinh dưỡng khoa học</p>
  `);
}));

/* ---------------------------------------------------------------------
   5. SHEET (modal đáy màn hình) DÙNG CHUNG
   --------------------------------------------------------------------- */
let onSheetCloseHook = null; // hàm dọn dẹp (vd: tắt camera) khi sheet đóng bằng bất kỳ cách nào
function openSheet(html){
  $("#sheet-content").innerHTML = `<div class="sheet-handle"></div>` + html;
  $("#sheet-backdrop").classList.add("open");
}
function closeSheet(){
  $("#sheet-backdrop").classList.remove("open");
  if(onSheetCloseHook){ const fn = onSheetCloseHook; onSheetCloseHook = null; fn(); }
}
$("#sheet-backdrop").addEventListener("click", (e)=>{ if(e.target.id==="sheet-backdrop") closeSheet(); });

/* =========================================================================
   6. ONBOARDING
   ========================================================================= */
let obStep = 0;
const OB_STEPS = 5;
let tempProfile = {};

function renderOnboardProgress(){
  $("#onboard-progress").innerHTML = Array.from({length:OB_STEPS}).map((_,i)=>
    `<div class="${i<=obStep?'done':''}"></div>`).join("");
}
function showObStep(i){
  obStep = i;
  $$(".onboard-step").forEach(s=> s.classList.toggle("active", Number(s.dataset.step)===i));
  $("#onboard-back").style.display = i===0 ? "none" : "flex";
  $("#onboard-next").textContent = i===OB_STEPS-1 ? "Bắt đầu hành trình" : "Tiếp tục";
  renderOnboardProgress();
}
function renderChoiceList(containerId, items, field, labelFn){
  const el = $(containerId);
  el.innerHTML = items.map(it => `
    <div class="choice-card" data-field="${field}" data-value="${it.id}" style="width:100%;text-align:left;display:flex;flex-direction:column;">
      <span>${it.label}</span><small>${it.desc}</small>
    </div>`).join("");
  $$(`[data-field="${field}"]`, el).forEach(card=>{
    card.addEventListener("click", ()=>{
      $$(`[data-field="${field}"]`, el).forEach(c=>c.classList.remove("selected"));
      card.classList.add("selected");
      tempProfile[field] = card.dataset.value;
    });
  });
}
function validateStep(i){
  if(i===1) return tempProfile.gender && Number($("#in-age").value) >= 14 && Number($("#in-age").value) <= 90;
  if(i===2){
    const h = Number($("#in-height").value), w = Number($("#in-weight").value);
    const bf = $("#in-bodyfat").value;
    const bfOk = bf==="" || (Number(bf) >= 3 && Number(bf) <= 60);
    return h>=80 && h<=250 && w>=25 && w<=300 && bfOk;
  }
  if(i===3) return !!tempProfile.activity;
  if(i===4) return !!tempProfile.goal;
  return true;
}
$$('[data-field="gender"]').forEach(card=>{
  card.addEventListener("click", ()=>{
    $$('[data-field="gender"]').forEach(c=>c.classList.remove("selected"));
    card.classList.add("selected");
    tempProfile.gender = card.dataset.value;
  });
});
$("#onboard-next").addEventListener("click", ()=>{
  if(!validateStep(obStep)){ toast("Vui lòng nhập đầy đủ thông tin", "error"); return; }
  if(obStep === OB_STEPS-1){ finishOnboarding(); return; }
  showObStep(obStep+1);
});
$("#onboard-back").addEventListener("click", ()=> showObStep(Math.max(0,obStep-1)));

function finishOnboarding(){
  const p = state.profile;
  const wasOnboarded = state.onboarded;
  p.name = ($("#onboard-form input#in-name")?.value) || p.name || "Vận Động Viên";
  p.gender = tempProfile.gender || "male";
  p.age = Number($("#in-age").value) || 25;
  p.height = Number($("#in-height").value) || 170;
  p.weight = Number($("#in-weight").value) || 65;
  p.bodyfat = $("#in-bodyfat").value ? Number($("#in-bodyfat").value) : null;
  p.activity = tempProfile.activity || "moderate";
  p.goal = tempProfile.goal || "gain";
  recomputeProfile();
  state.onboarded = true;
  if(!wasOnboarded){ state.activePlanId = null; ensurePlans(); }
  saveState();
  $("#onboarding").classList.remove("open");
  renderAll();
  if(!wasOnboarded && typeof afterFirstOnboarding==="function") afterFirstOnboarding(); else goto("home");
  toast(`Chào mừng ${p.name || "bạn"} đến với FIT KIT!`, "celebration");
}

function openOnboarding(prefill){
  tempProfile = {};
  if(prefill){
    tempProfile.gender = state.profile.gender;
    tempProfile.activity = state.profile.activity;
    tempProfile.goal = state.profile.goal;
    $("#in-age").value = state.profile.age;
    $("#in-height").value = state.profile.height;
    $("#in-weight").value = state.profile.weight;
    $("#in-bodyfat").value = state.profile.bodyfat || "";
    $("#in-name").value = state.profile.name || "";
  }
  renderChoiceList("#activity-list", ACTIVITY_LEVELS, "activity");
  renderChoiceList("#goal-list", GOALS, "goal");
  if(tempProfile.gender){
    $$('[data-field="gender"]').forEach(c=>c.classList.toggle("selected", c.dataset.value===tempProfile.gender));
  }
  if(tempProfile.activity){ $$('[data-field="activity"]').forEach(c=>c.classList.toggle("selected", c.dataset.value===tempProfile.activity)); }
  if(tempProfile.goal){ $$('[data-field="goal"]').forEach(c=>c.classList.toggle("selected", c.dataset.value===tempProfile.goal)); }
  $('.onboard-step[data-step="0"]').querySelector("img").src = IMG.heroWorkout2;
  showObStep(0);
  $("#onboarding").classList.add("open");
}

/* =========================================================================
   7. MÀN HÌNH LUYỆN TẬP (dựa trên chương trình cá nhân hoá — state.plans)
   ========================================================================= */
const HERO_CYCLE = [IMG.heroWorkout1, IMG.heroWorkout2, IMG.heroWorkout3, IMG.heroWorkout4];

function renderWorkoutScreen(){
  const plan = getActivePlan();
  $("#workout-tagline").textContent = plan.tagline;
  const idx = DAY_KEYS.indexOf(state.selectedDay);
  $("#workout-hero").style.backgroundImage = `url('${HERO_CYCLE[idx % HERO_CYCLE.length]}')`;

  // day tabs
  $("#day-tabs").innerHTML = DAY_KEYS.map(k=>{
    const isRest = plan.days[k].items.length===0;
    return `<button class="day-tab ${k===state.selectedDay?'active':''} ${isRest?'rest':''}" data-day="${k}">${DAY_LABELS[k]}</button>`;
  }).join("");
  $$("#day-tabs .day-tab").forEach(b=> b.addEventListener("click", ()=>{ state.selectedDay=b.dataset.day; saveState(); renderWorkoutScreen(); }));

  const day = plan.days[state.selectedDay];
  const isToday = state.selectedDay === todayDayKey();
  const log = state.workoutLog[todayStr()];
  const doneIds = (isToday && log) ? log.completedExerciseIds : [];
  const isRestDay = day.items.length === 0;

  $("#workout-heroTitle").innerHTML = isRestDay
    ? `NGÀY<br><span class="accent">PHỤC HỒI</span>`
    : `CHINH PHỤC<br><span class="accent">GIỚI HẠN</span>`;

  $("#today-card").innerHTML = isRestDay ? `
    <h3 style="font-size:19px;">${day.title}</h3>
    <p class="small-note" style="margin-top:8px;">Phục hồi là một phần của quá trình phát triển cơ bắp. Hãy ngủ đủ giấc, uống đủ nước và giãn cơ nhẹ nhàng hôm nay.</p>
  ` : `
    <h3 style="font-size:19px;">${day.title}</h3>
    <div class="chip-row" style="margin:10px 0 14px;">
      <span class="pill hot">Cường độ ${day.intensity}</span>
      <span class="pill">${day.duration} phút</span>
      <span class="pill">${day.items.length} bài tập</span>
    </div>
    <button class="btn btn-primary btn-block" id="btn-start-session">
      <span class="material-symbols-rounded">play_arrow</span>
      ${isToday && doneIds.length===day.items.length ? "Tập lại buổi tập" : "Bắt đầu buổi tập"}
    </button>
    ${!isToday ? `<p class="small-note" style="text-align:center;margin-top:8px;">Đang xem trước — tiến trình sẽ không được lưu</p>` : ""}
  `;
  if(!isRestDay){ $("#btn-start-session").addEventListener("click", ()=> startSession(state.selectedDay)); }

  $("#link-exercise-count").textContent = `${day.items.length} bài`;
  $("#exercise-list").innerHTML = day.items.map(item=>{
    const meta = getExerciseMeta(item);
    const done = doneIds.includes(item.uid);
    return `
    <div class="list-item ${done?'done':''}" data-ex="${item.uid}">
      <div class="thumb-wrap">
        ${item.clipId ? `<video muted preload="metadata" data-thumb-clip="${item.clipId}"></video>` : `<img src="${meta.img}">`}
        ${item.clipId ? `<div class="cam-badge"><span class="material-symbols-rounded">videocam</span></div>` : ""}
      </div>
      <div class="info">
        <div class="name">${meta.name}</div>
        <div class="meta">${meta.muscle} · ${item.sets} hiệp × ${item.reps}</div>
      </div>
      <div class="check ${done?'checked':''}"><span class="material-symbols-rounded" style="font-size:16px;">check</span></div>
    </div>`;
  }).join("") || `<p class="empty-hint">Không có bài tập — đây là ngày nghỉ.<br><a id="link-add-rest-exercise" style="color:var(--primary-soft);text-decoration:underline;cursor:pointer;">+ Thêm bài tập cho ngày này</a></p>`;

  $$("#exercise-list .list-item").forEach(row=>{
    row.addEventListener("click", ()=> openExerciseDetail(row.dataset.ex, isToday));
  });
  $$("#exercise-list [data-thumb-clip]").forEach(async v=>{
    const rec = await dbGetClip(Number(v.dataset.thumbClip));
    if(rec) v.src = URL.createObjectURL(rec.blob);
  });
  const linkAdd = $("#link-add-rest-exercise");
  if(linkAdd) linkAdd.addEventListener("click", ()=>{ plansUI = { mode:"edit", planId: plan.id, day: state.selectedDay }; goto("plans"); });

  renderClips();
  renderStreak();
}

function openExerciseDetail(itemUid, isToday){
  const plan = getActivePlan();
  const item = plan.days[state.selectedDay].items.find(it=>it.uid===itemUid);
  if(!item) return;
  const meta = getExerciseMeta(item);
  const log = state.workoutLog[todayStr()];
  const done = isToday && log && log.completedExerciseIds.includes(itemUid);
  const mediaHtml = item.clipId
    ? mediaVideoHTML(item.clipId, "ex-detail-video")
    : `<img src="${meta.img}" style="width:100%;height:170px;object-fit:cover;border-radius:16px;margin-bottom:14px;">`;
  openSheet(`
    ${mediaHtml}
    ${item.clipId ? `<button class="btn btn-outline btn-block" id="btn-fit-toggle-detail" style="margin-bottom:14px;">${fitToggleLabel(getClipFit(item.clipId))}</button>` : ""}
    <div class="pill" style="margin-bottom:8px;">${meta.muscle}</div>
    <h3 style="font-size:20px;">${meta.name}</h3>
    <div class="chip-row" style="margin:10px 0;">
      <span class="pill">${item.sets} hiệp</span><span class="pill">${item.reps} lần</span><span class="pill">Nghỉ ${item.restSec}s</span><span class="pill">${meta.equipment}</span>
    </div>
    <div class="card-title" style="margin-top:6px;"><span class="material-symbols-rounded">menu_book</span>Hướng dẫn kỹ thuật</div>
    <p style="font-size:13.5px;line-height:1.6;color:var(--text-muted);">${meta.guide}</p>
    <button class="btn btn-outline btn-block" style="margin-top:14px;" id="btn-attach-clip-detail">
      <span class="material-symbols-rounded">videocam</span>${item.clipId?'Đổi video cho bài này':'Gắn video cho bài này'}
    </button>
    ${isToday ? `<button class="btn ${done?'btn-outline':'btn-primary'} btn-block" style="margin-top:10px;" id="btn-toggle-done">
        <span class="material-symbols-rounded">${done?'close':'check'}</span>${done?'Bỏ đánh dấu hoàn thành':'Đánh dấu hoàn thành'}
      </button>` : `<p class="small-note" style="margin-top:14px;">Chuyển sang hôm nay để đánh dấu hoàn thành bài tập này.</p>`}
  `);
  if(item.clipId){
    mountClipVideo("#ex-detail-video", item.clipId);
    attachFitToggle($("#btn-fit-toggle-detail"), "#ex-detail-video", item.clipId);
  }
  $("#btn-attach-clip-detail").addEventListener("click", ()=>{
    openClipPicker((clipId)=>{
      item.clipId = clipId;
      saveState();
      openExerciseDetail(itemUid, isToday);
      renderWorkoutScreen();
    }, {});
  });
  if(isToday){
    $("#btn-toggle-done").addEventListener("click", ()=>{
      toggleExerciseDone(itemUid);
      closeSheet();
      renderWorkoutScreen();
    });
  }
}

function toggleExerciseDone(uidVal){
  const dateKey = todayStr();
  if(!state.workoutLog[dateKey]) state.workoutLog[dateKey] = { dayKey: todayDayKey(), completedExerciseIds: [] };
  const arr = state.workoutLog[dateKey].completedExerciseIds;
  const i = arr.indexOf(uidVal);
  if(i>=0) arr.splice(i,1); else arr.push(uidVal);
  saveState();
  updateFinishedDates();
}

function updateFinishedDates(){
  const dateKey = todayStr();
  const dayItems = getActivePlan().days[todayDayKey()].items;
  const log = state.workoutLog[dateKey];
  const fullyDone = log && dayItems.length>0 && dayItems.every(it=>log.completedExerciseIds.includes(it.uid));
  const has = state.finishedDates.includes(dateKey);
  if(fullyDone && !has) state.finishedDates.push(dateKey);
  if(!fullyDone && has) state.finishedDates = state.finishedDates.filter(d=>d!==dateKey);
  saveState();
}

function calcStreak(){
  // Ngày nghỉ theo lịch tập (không có bài tập nào) không được tính là "gãy chuỗi" —
  // chỉ những ngày có lịch tập nhưng bị bỏ lỡ mới làm ngắt streak.
  const plan = getActivePlan();
  const isRestDay = (d)=>{
    const day = plan.days[todayDayKey(d)];
    return !day || day.items.length===0;
  };
  let streak = 0;
  let cursor = new Date();
  if(!isRestDay(cursor) && !state.finishedDates.includes(todayStr())) cursor.setDate(cursor.getDate()-1);
  while(true){
    const dateKey = todayStr(cursor);
    if(state.finishedDates.includes(dateKey)) streak++;
    else if(!isRestDay(cursor)) break;
    cursor.setDate(cursor.getDate()-1);
  }
  return streak;
}

function renderStreak(){
  const streak = calcStreak();
  const total = state.finishedDates.length;
  const thisWeek = state.finishedDates.filter(d=>{
    const diff = (new Date(todayStr())-new Date(d))/86400000;
    return diff>=0 && diff<7;
  }).length;
  $("#streak-stats").innerHTML = `
    <div class="stat-box"><div class="num">${streak}🔥</div><div class="cap">Liên tiếp</div></div>
    <div class="stat-box"><div class="num">${thisWeek}</div><div class="cap">Tuần này</div></div>
    <div class="stat-box"><div class="num">${total}</div><div class="cap">Tổng buổi</div></div>
  `;
}

/* ---- Guided session (buổi tập có hướng dẫn) ---- */
let session = null;
function startSession(dayKey){
  const plan = getActivePlan();
  const day = plan.days[dayKey];
  session = { dayKey, idx:0, items: day.items.slice(), isToday: dayKey===todayDayKey(), completed: [] };
  renderSessionStep();
}
function renderSessionStep(){
  if(session.idx >= session.items.length){ return finishSession(); }
  const item = session.items[session.idx];
  const meta = getExerciseMeta(item);
  const mediaHtml = item.clipId
    ? mediaVideoHTML(item.clipId, "session-video", { maxHeight: "40vh" })
    : `<img src="${meta.img}" style="width:100%;height:170px;object-fit:cover;border-radius:16px;margin-bottom:14px;">`;
  openSheet(`
    <div class="progress-row"><span class="label">Bài ${session.idx+1}/${session.items.length}</span><span class="value">${session.dayKey===todayDayKey()?'Hôm nay':'Xem trước'}</span></div>
    <div class="progress-track" style="margin-bottom:14px;"><div class="progress-fill" style="width:${(session.idx/session.items.length)*100}%"></div></div>
    ${mediaHtml}
    <h3 style="font-size:20px;">${meta.name}</h3>
    <div class="chip-row" style="margin:10px 0;"><span class="pill hot">${item.sets} hiệp × ${item.reps}</span><span class="pill">Nghỉ ${item.restSec}s</span></div>
    <p style="font-size:13.5px;line-height:1.6;color:var(--text-muted);margin-bottom:16px;">${meta.guide}</p>
    <button class="btn btn-primary btn-block" id="btn-session-done"><span class="material-symbols-rounded">check</span>Hoàn thành bài này</button>
    <button class="btn btn-ghost btn-block" id="btn-session-skip" style="margin-top:8px;">Bỏ qua</button>
  `);
  if(item.clipId){
    mountClipVideo("#session-video", item.clipId);
  }
  $("#btn-session-done").addEventListener("click", ()=>{
    session.completed.push(item.uid);
    if(item.restSec>0 && session.idx < session.items.length-1) restCountdown(item.restSec);
    else { session.idx++; renderSessionStep(); }
  });
  $("#btn-session-skip").addEventListener("click", ()=>{ session.idx++; renderSessionStep(); });
}
function restCountdown(sec){
  let remain = sec;
  openSheet(`
    <div style="text-align:center;padding:20px 0;">
      <div class="card-title" style="justify-content:center;"><span class="material-symbols-rounded">timer</span>Nghỉ giữa hiệp</div>
      <div class="headline" style="font-size:52px;color:var(--primary);margin:14px 0;" id="rest-num">${remain}</div>
      <p class="small-note">Hít thở sâu, uống một ngụm nước.</p>
      <button class="btn btn-outline btn-block" style="margin-top:20px;" id="btn-skip-rest">Bỏ qua nghỉ</button>
    </div>
  `);
  const timer = setInterval(()=>{
    remain--;
    const numEl = $("#rest-num");
    if(numEl) numEl.textContent = remain;
    if(remain<=0){ clearInterval(timer); session.idx++; renderSessionStep(); }
  },1000);
  $("#btn-skip-rest").addEventListener("click", ()=>{ clearInterval(timer); session.idx++; renderSessionStep(); });
}
function finishSession(){
  if(session.isToday){
    const dateKey = todayStr();
    state.workoutLog[dateKey] = { dayKey: session.dayKey, completedExerciseIds: Array.from(new Set(session.completed)), finishedAt: Date.now() };
    saveState();
    updateFinishedDates();
  }
  openSheet(`
    <div style="text-align:center;padding:16px 0;">
      <span class="material-symbols-rounded" style="font-size:56px;color:var(--success);">military_tech</span>
      <h3 style="font-size:22px;margin-top:10px;">Hoàn thành buổi tập!</h3>
      <p class="small-note" style="margin-top:6px;">${session.completed.length}/${session.items.length} bài tập đã hoàn thành${session.isToday ? " · Đã lưu vào nhật ký" : " · Chế độ xem trước, chưa lưu"}</p>
      <button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="closeSheet();renderWorkoutScreen();">Xong</button>
    </div>
  `);
  session = null;
}

/* ---- Kho video tập luyện (thư viện video do người dùng tải lên) ---- */
function catLabel(catId){ return (VIDEO_CATEGORIES.find(c=>c.id===catId)||{}).label || ""; }

function renderClips(){
  const grid = $("#clip-grid");
  const list = state.videoLibrary.slice(0,6);
  $("#clip-empty").style.display = state.videoLibrary.length ? "none" : "block";
  $("#link-view-library").style.display = state.videoLibrary.length ? "block" : "none";
  grid.innerHTML = list.map(m=> clipThumbHTML(m)).join("");
  bindClipGrid(grid, renderClips);
}
function clipThumbHTML(m){
  return `
    <div class="clip-thumb" data-clip="${m.id}">
      <video muted preload="metadata" data-src-id="${m.id}"></video>
      <div class="cat-badge">${catLabel(m.category)}</div>
      <div class="play-badge"><span class="material-symbols-rounded">play_circle</span></div>
      <button class="del-btn" data-del="${m.id}"><span class="material-symbols-rounded" style="font-size:14px;">close</span></button>
    </div>`;
}
function bindClipGrid(grid, onChange){
  grid.querySelectorAll("video[data-src-id]").forEach(async v=>{
    const rec = await dbGetClip(Number(v.dataset.srcId));
    if(rec) v.src = URL.createObjectURL(rec.blob);
  });
  grid.querySelectorAll("[data-clip]").forEach(el=>{
    el.addEventListener("click", (e)=>{
      if(e.target.closest("[data-del]")) return;
      openClipPlayer(Number(el.dataset.clip));
    });
  });
  grid.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const id = Number(btn.dataset.del);
      confirmDialog("Xoá video này?", "Video sẽ bị xoá vĩnh viễn khỏi thiết bị và khỏi mọi bài tập đang gắn video này.", async ()=>{
        await dbDeleteClip(id);
        state.videoLibrary = state.videoLibrary.filter(m=>m.id!==id);
        saveState();
        onChange();
        toast("Đã xoá video", "delete");
      }, "Xoá video", "delete_forever");
    });
  });
}
async function openClipPlayer(id){
  const rec = await dbGetClip(id);
  if(!rec) return;
  const meta = state.videoLibrary.find(m=>m.id===id);
  const url = URL.createObjectURL(rec.blob);
  openSheet(`
    <video id="player-video" src="${url}" controls autoplay playsinline style="width:100%;aspect-ratio:16/9;max-height:65vh;object-fit:${getClipFit(id)};border-radius:14px;background:#000;"></video>
    <button class="btn btn-outline btn-block" id="player-fit-toggle" style="margin-top:10px;">${fitToggleLabel(getClipFit(id))}</button>
    <div class="chip-row" style="margin-top:12px;">${meta?`<span class="pill hot">${catLabel(meta.category)}</span>`:""}</div>
    <h3 style="margin-top:8px;font-size:16px;">${rec.name}</h3>
    <p class="small-note">${new Date(rec.createdAt).toLocaleString("vi-VN")}</p>
  `);
  const playerVideo = $("#player-video");
  playerVideo.addEventListener("loadedmetadata", ()=>{
    if(playerVideo.videoWidth && playerVideo.videoHeight){
      playerVideo.style.aspectRatio = `${playerVideo.videoWidth} / ${playerVideo.videoHeight}`;
    }
  }, { once:true });
  attachFitToggle($("#player-fit-toggle"), "#player-video", id);
}
function openUploadClip(onDone, defaultCategory){
  let pickedFile = null;
  openSheet(`
    <h3 style="margin-bottom:14px;">Tải video tập luyện</h3>
    <div class="video-drop">
      <span class="material-symbols-rounded">upload</span>
      <b>Chạm để chọn video</b>
      <span style="font-size:11px;">MP4, MOV, dọc hoặc ngang đều được — lưu ngay trên thiết bị của bạn</span>
      <input type="file" accept="video/*" id="clip-input">
    </div>
    <div id="upload-preview-wrap" style="display:none;margin-top:14px;">
      <video id="upload-preview" muted playsinline style="width:100%;max-height:38vh;border-radius:14px;background:#000;aspect-ratio:16/9;object-fit:contain;"></video>
      <p class="small-note" id="upload-orientation-note" style="margin-top:6px;"></p>
    </div>
    <div class="field" style="margin-top:14px;">
      <label>Đặt tên clip</label>
      <input type="text" id="clip-name" placeholder="VD: Bench press hôm nay">
    </div>
    <div class="field" style="margin-top:10px;">
      <label>Thể loại tập</label>
      <select id="clip-cat">${VIDEO_CATEGORIES.map(c=>`<option value="${c.id}" ${c.id===defaultCategory?'selected':''}>${c.label}</option>`).join("")}</select>
    </div>
    <div class="field" style="margin-top:10px;">
      <label>Chế độ hiển thị</label>
      <select id="clip-fit">
        <option value="contain">Vừa khung hình — giữ nguyên video, không cắt (khuyên dùng)</option>
        <option value="cover">Lấp đầy khung hình — có thể cắt bớt viền video</option>
      </select>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-confirm-upload" disabled>Chọn video để tiếp tục</button>
  `);
  const confirmBtn = $("#btn-confirm-upload");
  $("#clip-input").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    pickedFile = file;
    const preview = $("#upload-preview");
    preview.src = URL.createObjectURL(file);
    $("#upload-preview-wrap").style.display = "block";
    preview.addEventListener("loadedmetadata", ()=>{
      preview.style.aspectRatio = `${preview.videoWidth} / ${preview.videoHeight}`;
      const isPortrait = preview.videoHeight > preview.videoWidth;
      const isSquare = Math.abs(preview.videoWidth - preview.videoHeight) < 4;
      const label = isSquare ? "vuông" : (isPortrait ? "dọc" : "ngang");
      $("#upload-orientation-note").textContent = `Đã nhận diện video ${label} (${preview.videoWidth}×${preview.videoHeight}) — sẽ hiển thị đúng tỉ lệ, không bị bóp méo hay crop.`;
    }, { once:true });
    if(!$("#clip-name").value) $("#clip-name").value = file.name.replace(/\.[^/.]+$/, "");
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Lưu video";
  });
  confirmBtn.addEventListener("click", async ()=>{
    if(!pickedFile) return;
    const name = $("#clip-name").value || pickedFile.name;
    const category = $("#clip-cat").value;
    const fit = $("#clip-fit").value;
    const id = await dbAddClip(pickedFile, name);
    state.videoLibrary.push({ id, name, category, createdAt: Date.now(), fit });
    saveState();
    closeSheet();
    toast("Đã lưu video tập luyện!");
    if(onDone) onDone(id);
  });
}

/* ---- Hiển thị video đúng tỉ lệ thật (chống crop/bóp méo) ---- */
function fitToggleLabel(fit){
  return `<span class="material-symbols-rounded" style="font-size:15px;">aspect_ratio</span>&nbsp;${fit==='cover' ? 'Lấp đầy khung hình (bấm để đổi sang Vừa khung)' : 'Vừa khung hình (bấm để đổi sang Lấp đầy)'}`;
}
function getClipFit(clipId){
  const meta = state.videoLibrary.find(v=>v.id===clipId);
  return (meta && meta.fit) || "contain";
}
function mediaVideoHTML(clipId, elId, opts={}){
  const maxH = opts.maxHeight || "60vh";
  return `<video id="${elId}" controls playsinline style="width:100%;aspect-ratio:16/9;max-height:${maxH};object-fit:${getClipFit(clipId)};border-radius:16px;background:#000;margin-bottom:${opts.noMarginBottom?'0':'14px'};"></video>`;
}
function mountClipVideo(elId, clipId){
  const videoEl = $(elId);
  if(!videoEl) return;
  videoEl.style.objectFit = getClipFit(clipId);
  dbGetClip(clipId).then(rec=>{
    if(rec && videoEl) videoEl.src = URL.createObjectURL(rec.blob);
  });
  videoEl.addEventListener("loadedmetadata", ()=>{
    if(videoEl.videoWidth && videoEl.videoHeight){
      videoEl.style.aspectRatio = `${videoEl.videoWidth} / ${videoEl.videoHeight}`;
    }
  }, { once:true });
}
function attachFitToggle(btnEl, elId, clipId){
  if(!btnEl) return;
  btnEl.addEventListener("click", ()=>{
    const meta = state.videoLibrary.find(v=>v.id===clipId);
    if(!meta) return;
    meta.fit = meta.fit==="cover" ? "contain" : "cover";
    saveState();
    const videoEl = $(elId);
    if(videoEl) videoEl.style.objectFit = meta.fit;
    btnEl.innerHTML = fitToggleLabel(meta.fit);
  });
}
$("#btn-add-clip").addEventListener("click", ()=> openUploadClip(()=> renderClips(), "gym"));
$("#btn-add-clip-2").addEventListener("click", ()=> openUploadClip(()=> renderLibraryScreen(), libraryCat!=="all"?libraryCat:"gym"));
$("#link-view-library").addEventListener("click", ()=> goto("library"));

/* ---- Màn hình Kho video (đầy đủ, có bộ lọc thể loại) ---- */
let libraryCat = "all";
function renderLibraryScreen(){
  $("#library-cat-tabs").innerHTML = [{id:"all",label:"Tất cả"}].concat(VIDEO_CATEGORIES).map(c=>
    `<button class="day-tab ${libraryCat===c.id?'active':''}" data-lcat="${c.id}">${c.label}</button>`).join("");
  $$("[data-lcat]").forEach(b=> b.addEventListener("click", ()=>{ libraryCat=b.dataset.lcat; renderLibraryScreen(); }));

  const list = libraryCat==="all" ? state.videoLibrary : state.videoLibrary.filter(v=>v.category===libraryCat);
  $("#library-empty").style.display = list.length ? "none" : "block";
  const grid = $("#library-grid");
  grid.innerHTML = list.map(m=> clipThumbHTML(m)).join("");
  bindClipGrid(grid, renderLibraryScreen);
}

/* ---- Chọn video từ kho để gắn vào một bài tập (dùng chung nhiều nơi) ---- */
function openClipPicker(onSelect){
  let cat = "all";
  const render = ()=>{
    const filtered = cat==="all" ? state.videoLibrary : state.videoLibrary.filter(v=>v.category===cat);
    openSheet(`
      <div class="sheet-header"><h3>Chọn video</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
      <div class="day-tabs" style="margin:0 0 12px;padding:0 0 10px;">
        <button class="day-tab ${cat==='all'?'active':''}" data-pcat="all">Tất cả</button>
        ${VIDEO_CATEGORIES.map(c=>`<button class="day-tab ${cat===c.id?'active':''}" data-pcat="${c.id}">${c.label}</button>`).join("")}
      </div>
      <button class="btn btn-soft btn-block" id="picker-upload" style="margin-bottom:12px;"><span class="material-symbols-rounded">upload</span>&nbsp;Tải video mới</button>
      <div class="clip-grid" id="picker-grid">${filtered.length ? filtered.map(v=>`
        <div class="clip-thumb" data-pick-clip="${v.id}">
          <video muted preload="metadata" data-thumb-clip="${v.id}"></video>
          <div class="cat-badge">${catLabel(v.category)}</div>
          <div class="play-badge"><span class="material-symbols-rounded">play_circle</span></div>
        </div>`).join("") : `<p class="empty-hint">Chưa có video nào trong danh mục này. Hãy tải video mới!</p>`}</div>
    `);
    $$("[data-pcat]").forEach(b=> b.addEventListener("click", ()=>{ cat=b.dataset.pcat; render(); }));
    $$("#picker-grid [data-thumb-clip]").forEach(async v=>{
      const rec = await dbGetClip(Number(v.dataset.thumbClip));
      if(rec) v.src = URL.createObjectURL(rec.blob);
    });
    $$("[data-pick-clip]").forEach(el=> el.addEventListener("click", ()=> onSelect(Number(el.dataset.pickClip))));
    $("#picker-upload").addEventListener("click", ()=> openUploadClip((newId)=> onSelect(newId), cat!=="all"?cat:"gym"));
  };
  render();
}

/* =========================================================================
   7b. QUẢN LÝ CHƯƠNG TRÌNH TẬP (tạo / sửa / xoá / nhân bản plan cá nhân hoá)
   ========================================================================= */
let plansUI = { mode: "list" };

function renderPlansScreen(){
  const back = $("#btn-plans-back"), action = $("#btn-plans-action"), title = $("#plans-topbar-title");
  if(plansUI.mode === "list"){
    title.textContent = "CHƯƠNG TRÌNH";
    action.innerHTML = `<span class="material-symbols-rounded">add</span>`;
    back.onclick = ()=> goto("workout");
    action.onclick = ()=> promptCreatePlan();
    $("#plans-content").innerHTML = renderPlanListHTML();
    bindPlanListEvents();
  } else {
    const plan = state.plans[plansUI.planId];
    title.textContent = plan.name.length>16 ? plan.name.slice(0,16)+"…" : plan.name;
    action.innerHTML = `<span class="material-symbols-rounded">drive_file_rename_outline</span>`;
    back.onclick = ()=>{ plansUI = { mode:"list" }; renderPlansScreen(); };
    action.onclick = ()=> renamePlanPrompt(plan.id);
    $("#plans-content").innerHTML = renderPlanEditorHTML(plan);
    bindPlanEditorEvents(plan);
  }
}
function renderPlanListHTML(){
  return `<p class="small-note" style="margin-bottom:12px;">Tạo nhiều chương trình khác nhau, thêm bài tập của riêng bạn và chọn chương trình đang áp dụng.</p>` +
    Object.values(state.plans).map(plan=>{
    const activeDays = Object.values(plan.days).filter(d=>d.items.length).length;
    const isActive = plan.id === state.activePlanId;
    return `
    <div class="plan-card ${isActive?'active':''}" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div>
          <h3 style="font-size:16px;">${plan.name}</h3>
          <p class="small-note" style="margin-top:2px;">${activeDays} buổi/tuần · ${plan.builtin?'Mẫu có sẵn':'Tự tạo'}</p>
        </div>
        ${isActive ? `<span class="badge-pro" style="font-size:9px;padding:4px 10px;white-space:nowrap;">ĐANG DÙNG</span>` : ""}
      </div>
      <div class="chip-row" style="margin-top:12px;">
        ${!isActive ? `<button class="btn btn-primary btn-sm" data-plan-use="${plan.id}">Dùng chương trình</button>` : ""}
        <button class="btn btn-outline btn-sm" data-plan-edit="${plan.id}">Sửa</button>
        <button class="btn btn-outline btn-sm" data-plan-dup="${plan.id}">Nhân bản</button>
        ${!plan.builtin ? `<button class="btn btn-ghost btn-sm" data-plan-del="${plan.id}">Xoá</button>` : `<button class="btn btn-ghost btn-sm" data-plan-reset="${plan.id}">Khôi phục mặc định</button>`}
      </div>
    </div>`;
  }).join("");
}
function resetPlanToDefault(planId){
  const original = seedPlansFromPrograms()[planId];
  if(!original) return;
  confirmDialog("Khôi phục chương trình mặc định?", `Toàn bộ chỉnh sửa của bạn cho "${state.plans[planId].name}" (bài tập, video đã gắn, cường độ...) sẽ mất, quay về nội dung gốc.`, ()=>{
    state.plans[planId] = original;
    saveState(); renderPlansScreen(); renderWorkoutScreen();
    toast("Đã khôi phục chương trình mặc định");
  });
}
function bindPlanListEvents(){
  $$("#plans-content [data-plan-use]").forEach(b=> b.addEventListener("click", ()=>{
    state.activePlanId=b.dataset.planUse; saveState(); renderPlansScreen(); renderWorkoutScreen();
    toast("Đã chuyển chương trình tập luyện");
  }));
  $$("#plans-content [data-plan-edit]").forEach(b=> b.addEventListener("click", ()=>{
    plansUI = { mode:"edit", planId:b.dataset.planEdit, day: todayDayKey() }; renderPlansScreen();
  }));
  $$("#plans-content [data-plan-reset]").forEach(b=> b.addEventListener("click", ()=> resetPlanToDefault(b.dataset.planReset)));
  $$("#plans-content [data-plan-dup]").forEach(b=> b.addEventListener("click", ()=>{
    const p = duplicatePlan(b.dataset.planDup); toast(`Đã nhân bản: ${p.name}`); renderPlansScreen();
  }));
  $$("#plans-content [data-plan-del]").forEach(b=> b.addEventListener("click", ()=>{
    if(Object.keys(state.plans).length<=1){ toast("Cần giữ lại ít nhất 1 chương trình", "error"); return; }
    const id = b.dataset.planDel;
    openSheet(`
      <div style="text-align:center;padding:10px 0;">
        <span class="material-symbols-rounded" style="font-size:44px;color:var(--warn);">warning</span>
        <h3 style="margin-top:10px;">Xoá chương trình này?</h3>
        <p class="small-note" style="margin-top:6px;">${state.plans[id].name} sẽ bị xoá vĩnh viễn.</p>
        <div style="display:flex;gap:10px;margin-top:18px;">
          <button class="btn btn-outline btn-block" onclick="closeSheet()">Huỷ</button>
          <button class="btn btn-primary btn-block" id="btn-confirm-del-plan">Xoá</button>
        </div>
      </div>
    `);
    $("#btn-confirm-del-plan").addEventListener("click", ()=>{
      delete state.plans[id];
      if(state.activePlanId===id) state.activePlanId = Object.keys(state.plans)[0];
      saveState(); closeSheet(); renderPlansScreen(); renderWorkoutScreen();
      toast("Đã xoá chương trình");
    });
  }));
}
function promptCreatePlan(){
  openSheet(`
    <h3 style="margin-bottom:14px;">Tạo chương trình mới</h3>
    <div class="field"><label>Tên chương trình</label><input type="text" id="new-plan-name" placeholder="VD: Kế hoạch của tôi"></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-create-plan">Tạo &amp; bắt đầu thêm bài tập</button>
  `);
  $("#btn-create-plan").addEventListener("click", ()=>{
    const name = $("#new-plan-name").value.trim() || "Chương trình mới";
    const plan = createBlankPlan(name);
    closeSheet();
    plansUI = { mode:"edit", planId: plan.id, day: todayDayKey() };
    renderPlansScreen();
    toast("Đã tạo chương trình — giờ hãy thêm bài tập cho từng ngày!");
  });
}
function renamePlanPrompt(planId){
  const plan = state.plans[planId];
  openSheet(`
    <h3 style="margin-bottom:14px;">Đổi tên chương trình</h3>
    <div class="field"><input type="text" id="rename-plan-input" value="${plan.name}"></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-rename">Lưu</button>
  `);
  $("#btn-save-rename").addEventListener("click", ()=>{
    plan.name = $("#rename-plan-input").value.trim() || plan.name;
    saveState(); closeSheet(); renderPlansScreen();
  });
}
function renderPlanEditorHTML(plan){
  if(!plansUI.day) plansUI.day = todayDayKey();
  const day = plan.days[plansUI.day];
  const dayTabs = DAY_KEYS.map(k=> `<button class="day-tab ${k===plansUI.day?'active':''} ${plan.days[k].items.length===0?'rest':''}" data-pday="${k}">${DAY_LABELS[k]}</button>`).join("");
  return `
    <div class="day-tabs" style="margin:0 0 14px;padding:0 0 10px;">${dayTabs}</div>
    <div class="card">
      <div class="field"><label>Tên buổi tập</label><input type="text" id="pd-title" value="${day.title}"></div>
      <div class="field-row" style="margin-top:10px;">
        <div class="field"><label>Cường độ</label>
          <select id="pd-intensity">${INTENSITY_LEVELS.map(x=>`<option ${x===day.intensity?'selected':''}>${x}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Thời lượng (phút)</label><input type="number" id="pd-duration" value="${day.duration}"></div>
      </div>
      ${plan.builtin ? `<button class="btn btn-ghost btn-block" style="margin-top:10px;" id="pd-reset-day">Khôi phục ngày này về mặc định</button>` : ""}
    </div>
    <div class="section-title" style="margin-top:14px;"><h3>Bài tập (${day.items.length})</h3><a id="pd-add-exercise">+ Thêm bài tập</a></div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${day.items.map(it=>{
        const meta = getExerciseMeta(it);
        return `<div class="list-item" data-item="${it.uid}">
          <div class="thumb-wrap">
            ${it.clipId ? `<video muted preload="metadata" data-thumb-clip="${it.clipId}"></video>` : `<img src="${meta.img}">`}
            ${it.clipId ? `<div class="cam-badge"><span class="material-symbols-rounded">videocam</span></div>` : ""}
          </div>
          <div class="info"><div class="name">${meta.name}</div><div class="meta">${meta.muscle} · ${it.sets} hiệp × ${it.reps}</div></div>
          <span class="material-symbols-rounded" style="color:var(--text-dim);">chevron_right</span>
        </div>`;
      }).join("") || `<p class="empty-hint">Chưa có bài tập nào cho ngày này.</p>`}
    </div>
  `;
}
function bindPlanEditorEvents(plan){
  $$("#plans-content [data-pday]").forEach(b=> b.addEventListener("click", ()=>{ plansUI.day=b.dataset.pday; renderPlansScreen(); }));
  $("#pd-title").addEventListener("change", ()=>{ plan.days[plansUI.day].title=$("#pd-title").value || plan.days[plansUI.day].title; saveState(); });
  $("#pd-intensity").addEventListener("change", ()=>{ plan.days[plansUI.day].intensity=$("#pd-intensity").value; saveState(); });
  $("#pd-duration").addEventListener("change", ()=>{ plan.days[plansUI.day].duration=Number($("#pd-duration").value)||0; saveState(); });
  $("#pd-add-exercise").addEventListener("click", ()=> openAddExerciseSheet(plan, plansUI.day));
  const resetDayBtn = $("#pd-reset-day");
  if(resetDayBtn){
    resetDayBtn.addEventListener("click", ()=>{
      const original = seedPlansFromPrograms()[plan.id];
      if(!original) return;
      confirmDialog("Khôi phục ngày này về mặc định?", `Bài tập, cường độ và thời lượng của ${DAY_LABELS[plansUI.day]} sẽ quay về nội dung gốc.`, ()=>{
        plan.days[plansUI.day] = original.days[plansUI.day];
        saveState(); renderPlansScreen();
        toast("Đã khôi phục ngày về mặc định");
      });
    });
  }
  $$("#plans-content [data-thumb-clip]").forEach(async v=>{
    const rec = await dbGetClip(Number(v.dataset.thumbClip));
    if(rec) v.src = URL.createObjectURL(rec.blob);
  });
  $$("#plans-content [data-item]").forEach(row=> row.addEventListener("click", ()=> openPlanItemEditor(plan, plansUI.day, row.dataset.item)));
}
function openAddExerciseSheet(plan, dayKey){
  let tab = "lib";
  const render = ()=>{
    openSheet(`
      <div class="sheet-header"><h3>Thêm bài tập</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
      <div class="chip-row" style="margin-bottom:12px;">
        <button class="pill ${tab==='lib'?'active':''}" id="tab-lib">Từ thư viện</button>
        <button class="pill" id="tab-exdb"><span class="material-symbols-rounded" style="font-size:14px;">library_books</span>&nbsp;800+ bài</button>
        <button class="pill ${tab==='custom'?'active':''}" id="tab-custom">Tạo bài tập mới</button>
      </div>
      <div id="add-ex-body"></div>
    `);
    $("#tab-lib").addEventListener("click", ()=>{ tab="lib"; render(); });
    $("#tab-custom").addEventListener("click", ()=>{ tab="custom"; render(); });
    $("#tab-exdb").addEventListener("click", ()=>{
      openExDbPicker((items)=>{
        items.forEach(it=> plan.days[dayKey].items.push({
          uid: uid(), exerciseId: null,
          custom: { name: it.name, muscle: it.muscle, equipment: it.equipment, guide: it.guide, img: it.img, exDbId: it.exDbId },
          sets: it.sets, reps: it.reps, restSec: it.restSec, clipId: null,
        }));
        saveState(); renderPlansScreen(); toast(`Đã thêm ${items.length} bài tập`);
      }, { multi:true });
    });
    if(tab==="lib") renderLibTab(); else renderCustomTab();
  };
  const renderLibTab = ()=>{
    const body = $("#add-ex-body");
    body.innerHTML = `
      <div class="search-box" style="margin-bottom:10px;"><span class="material-symbols-rounded" style="color:var(--text-dim);">search</span><input type="text" id="ex-search" placeholder="Tìm bài tập — VD: đẩy ngực, gánh tạ..."></div>
      <div id="ex-search-results" style="max-height:44vh;overflow-y:auto;"></div>
    `;
    const list = (q)=> Object.entries(EXERCISES).filter(([id,ex])=> ex.name.toLowerCase().includes(q.toLowerCase()));
    const renderResults = (q)=>{
      $("#ex-search-results").innerHTML = list(q).map(([id,ex])=>`
        <div class="food-result" data-pick-ex="${id}" style="cursor:pointer;"><div><div class="name">${ex.name}</div><div class="kcal">${ex.muscle}</div></div><span class="material-symbols-rounded" style="color:var(--text-dim);">add_circle</span></div>
      `).join("") || `<p class="empty-hint">Không tìm thấy bài tập phù hợp</p>`;
      $$("[data-pick-ex]").forEach(el=> el.addEventListener("click", ()=>{
        const exId = el.dataset.pickEx, ex = EXERCISES[exId];
        plan.days[dayKey].items.push({ uid: exId+"_"+uid(), exerciseId: exId, custom:null, sets:ex.sets, reps:ex.reps, restSec:ex.restSec, clipId:null });
        saveState(); closeSheet(); renderPlansScreen(); toast(`Đã thêm ${ex.name}`);
      }));
    };
    renderResults("");
    $("#ex-search").addEventListener("input", (e)=> renderResults(e.target.value));
  };
  const renderCustomTab = ()=>{
    const body = $("#add-ex-body");
    body.innerHTML = `
      <div class="field"><label>Tên bài tập*</label><input type="text" id="cex-name" placeholder="VD: Đẩy tạ máy Smith"></div>
      <div class="field" style="margin-top:10px;"><label>Nhóm cơ</label><select id="cex-muscle">${MUSCLE_GROUPS.map(m=>`<option>${m}</option>`).join("")}</select></div>
      <div class="field" style="margin-top:10px;"><label>Dụng cụ</label><input type="text" id="cex-equip" placeholder="VD: Máy Smith"></div>
      <div class="field-row" style="margin-top:10px;">
        <div class="field"><label>Số hiệp</label><input type="number" id="cex-sets" value="3"></div>
        <div class="field"><label>Số lần / thời gian</label><input type="text" id="cex-reps" value="12"></div>
        <div class="field"><label>Nghỉ (giây)</label><input type="number" id="cex-rest" value="60"></div>
      </div>
      <div class="field" style="margin-top:10px;"><label>Hướng dẫn kỹ thuật (không bắt buộc)</label><textarea id="cex-guide" rows="3" placeholder="Mô tả cách thực hiện đúng..."></textarea></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" id="btn-add-custom-ex">Thêm vào buổi tập</button>
    `;
    $("#btn-add-custom-ex").addEventListener("click", ()=>{
      const name = $("#cex-name").value.trim();
      if(!name){ toast("Vui lòng nhập tên bài tập", "error"); return; }
      plan.days[dayKey].items.push({
        uid: uid(), exerciseId: null,
        custom: { name, muscle: $("#cex-muscle").value, equipment: $("#cex-equip").value, guide: $("#cex-guide").value },
        sets: Number($("#cex-sets").value)||3, reps: $("#cex-reps").value||"12", restSec: Number($("#cex-rest").value)||60,
        clipId: null,
      });
      saveState(); closeSheet(); renderPlansScreen(); toast(`Đã thêm ${name}`);
    });
  };
  render();
}
function openPlanItemEditor(plan, dayKey, itemUid){
  const item = plan.days[dayKey].items.find(it=>it.uid===itemUid);
  if(!item) return;
  const meta = getExerciseMeta(item);
  const render = ()=>{
    openSheet(`
      <div class="sheet-header"><h3>${meta.name}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
      <div id="pie-media" style="margin-bottom:12px;"></div>
      <button class="btn btn-outline btn-block" id="pie-attach"><span class="material-symbols-rounded">videocam</span>${item.clipId?'Đổi video':'Gắn video cho bài này'}</button>
      ${item.clipId ? `<button class="btn btn-ghost btn-block" style="margin-top:8px;" id="pie-remove-clip">Gỡ video</button>` : ""}
      <div class="field-row" style="margin-top:16px;">
        <div class="field"><label>Số hiệp</label><input type="number" id="pie-sets" value="${item.sets}"></div>
        <div class="field"><label>Số lần</label><input type="text" id="pie-reps" value="${item.reps}"></div>
        <div class="field"><label>Nghỉ (giây)</label><input type="number" id="pie-rest" value="${item.restSec}"></div>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" id="pie-save">Lưu thay đổi</button>
      ${item.exerciseId ? `<button class="btn btn-ghost btn-block" style="margin-top:8px;" id="pie-reset-defaults">Đặt lại hiệp/lần/nghỉ mặc định</button>` : ""}
      <button class="btn btn-ghost btn-block" style="margin-top:8px;color:var(--primary-soft);" id="pie-delete">Xoá bài tập khỏi buổi tập</button>
    `);
    const mediaEl = $("#pie-media");
    if(item.clipId){
      mediaEl.innerHTML = mediaVideoHTML(item.clipId, "pie-video", { maxHeight: "42vh", noMarginBottom: true }) +
        `<button class="btn btn-outline btn-block" id="pie-fit-toggle" style="margin-top:8px;">${fitToggleLabel(getClipFit(item.clipId))}</button>`;
      mountClipVideo("#pie-video", item.clipId);
      attachFitToggle($("#pie-fit-toggle"), "#pie-video", item.clipId);
    } else {
      mediaEl.innerHTML = `<img src="${meta.img}" style="width:100%;height:150px;object-fit:cover;border-radius:14px;">`;
    }
    $("#pie-attach").addEventListener("click", ()=>{
      openClipPicker((clipId)=>{ item.clipId = clipId; saveState(); render(); renderPlansScreen(); });
    });
    if(item.clipId){
      $("#pie-remove-clip").addEventListener("click", ()=>{ item.clipId=null; saveState(); render(); renderPlansScreen(); });
    }
    $("#pie-save").addEventListener("click", ()=>{
      item.sets = Number($("#pie-sets").value)||item.sets;
      item.reps = $("#pie-reps").value||item.reps;
      item.restSec = Number($("#pie-rest").value)||item.restSec;
      saveState(); closeSheet(); renderPlansScreen(); toast("Đã lưu thay đổi");
    });
    if(item.exerciseId){
      $("#pie-reset-defaults").addEventListener("click", ()=>{
        confirmDialog("Đặt lại về mặc định?", "Số hiệp, số lần và thời gian nghỉ của bài tập này sẽ quay về giá trị gốc.", ()=>{
          const ex = EXERCISES[item.exerciseId];
          if(ex){ item.sets = ex.sets; item.reps = ex.reps; item.restSec = ex.restSec; }
          saveState(); render(); renderPlansScreen();
          toast("Đã đặt lại về mặc định");
        });
      });
    }
    $("#pie-delete").addEventListener("click", ()=>{
      plan.days[dayKey].items = plan.days[dayKey].items.filter(it=>it.uid!==itemUid);
      saveState(); closeSheet(); renderPlansScreen(); toast("Đã xoá bài tập");
    });
  };
  render();
}

/* =========================================================================
   7c. ẢNH TIẾN TRÌNH & KHO CHỈ SỐ INBODY
   ========================================================================= */
let progressUI = { tab: "photos", compareSel: [] };

function angleLabel(id){ return (PHOTO_ANGLES.find(a=>a.id===id)||{}).label || id; }
function angleHint(id){ return (PHOTO_ANGLES.find(a=>a.id===id)||{}).hint || ""; }

function guideSvgFor(angle){
  const grid = `
    <line x1="150" y1="0" x2="150" y2="400" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-dasharray="4 6"/>
    <line x1="0" y1="133" x2="300" y2="133" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4 6"/>
    <line x1="0" y1="267" x2="300" y2="267" stroke="rgba(255,255,255,0.2)" stroke-width="1" stroke-dasharray="4 6"/>
    <rect x="18" y="18" width="264" height="364" rx="18" fill="none" stroke="rgba(255,122,69,0.85)" stroke-width="2" stroke-dasharray="10 8"/>
  `;
  if(angle==="side"){
    return grid + `
      <circle cx="160" cy="60" r="26" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.85"/>
      <path d="M160 86 C 140 120, 130 200, 150 260 C 158 300, 150 340, 145 380" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.85"/>
      <path d="M160 100 C 185 130, 190 160, 175 190" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.7"/>
    `;
  }
  return grid + `
    <circle cx="150" cy="58" r="27" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.85"/>
    <path d="M150 85 L150 235" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.85"/>
    <path d="M110 100 L150 92 L190 100" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.85"/>
    <path d="M108 102 L92 190" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.7"/>
    <path d="M192 102 L208 190" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.7"/>
    <path d="M112 150 L150 158 L188 150" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.6"/>
    <path d="M150 235 L118 375" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.85"/>
    <path d="M150 235 L182 375" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.85"/>
  `;
}

/* ---- Chụp ảnh tiến trình: mở camera + khung canh chuẩn góc/khoảng cách ---- */
const CAP_BOX_RATIO = 3/4; // khớp với khung hiển thị (aspect-ratio:3/4) và khung canh silhouette

function openCapturePhoto(onDone, defaultAngle){
  let angle = defaultAngle || PHOTO_ANGLES[0].id;
  let facingMode = "environment"; // mặc định camera sau (chất lượng tốt hơn, phù hợp dựng máy chụp toàn thân)
  let capturedBlob = null;
  let camStream = null;
  let multiCam = true; // giả định có nhiều camera cho tới khi phát hiện ngược lại

  function stopCamera(){ if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null; } }

  async function startCamera(){
    stopCamera();
    const video = $("#cap-video");
    if(!video) return;
    try{
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio:false });
      video.srcObject = camStream;
      video.style.display = "block";
      video.style.transform = facingMode==="user" ? "scaleX(-1)" : "none"; // soi gương cho camera trước, tự nhiên hơn
      $("#cap-fallback-note").textContent = "";
      $("#cap-shutter").style.display = "block";
      $("#cap-shutter").disabled = false;
      // Kiểm tra thiết bị có từ 2 camera trở lên hay không để quyết định có hiện nút đổi cam không
      try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        multiCam = devices.filter(d=>d.kind==="videoinput").length > 1;
      }catch(e){ multiCam = true; }
      const flipBtn = $("#cap-flip-cam");
      if(flipBtn) flipBtn.style.display = multiCam ? "flex" : "none";
    }catch(err){
      video.style.display = "none";
      $("#cap-shutter").style.display = "none";
      $("#cap-flip-cam").style.display = "none";
      $("#cap-fallback-note").textContent = "Không mở được camera trên trình duyệt/thiết bị này (cần cấp quyền camera cho trang web, hoặc trình duyệt/thiết bị không hỗ trợ). Hãy dùng nút thư viện ảnh ở góc trên bên trái khung hình để chọn ảnh có sẵn.";
      $("#cap-shutter").disabled = true;
    }
  }

  function showPreview(url){
    stopCamera();
    $("#cap-video").style.display = "none";
    $("#cap-flip-cam").style.display = "none";
    $("#cap-file-fallback").style.display = "none";
    $("#cap-shutter").style.display = "none";
    $("#cap-preview-img").style.display = "block";
    $("#cap-preview-img").src = url;
    $("#cap-confirm-row").style.display = "flex";
  }

  function render(){
    openSheet(`
      <div class="sheet-header"><h3>Chụp ảnh tiến trình</h3><button class="icon-btn" id="cap-close"><span class="material-symbols-rounded">close</span></button></div>
      <div class="day-tabs" id="cap-angle-tabs" style="margin-bottom:8px;padding-bottom:6px;">
        ${PHOTO_ANGLES.map(a=>`<button class="day-tab ${a.id===angle?'active':''}" data-capangle="${a.id}">${a.label}</button>`).join("")}
      </div>
      <div id="cap-box" style="position:relative;border-radius:16px;overflow:hidden;background:#000;aspect-ratio:3/4;isolation:isolate;">
        <video id="cap-video" autoplay playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;"></video>
        <img id="cap-preview-img" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;">
        <svg id="cap-guide" viewBox="0 0 300 400" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;">${guideSvgFor(angle)}</svg>
        <button id="cap-file-fallback" class="icon-btn" style="position:absolute;top:10px;left:10px;z-index:3;background:rgba(0,0,0,0.55);color:#fff;width:38px;height:38px;">
          <span class="material-symbols-rounded">photo_library</span>
        </button>
        <button id="cap-flip-cam" class="icon-btn" style="display:none;position:absolute;top:10px;right:10px;z-index:3;background:rgba(0,0,0,0.55);color:#fff;width:38px;height:38px;">
          <span class="material-symbols-rounded">cameraswitch</span>
        </button>
        <!-- Nút chụp nổi ngay trong khung tham chiếu, luôn hiện sẵn, không cần cuộn xuống -->
        <button id="cap-shutter" style="display:none;position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:4;width:66px;height:66px;border-radius:50%;background:#fff;border:5px solid rgba(255,255,255,0.35);padding:0;"></button>
        <div id="cap-confirm-row" style="display:none;position:absolute;left:0;right:0;bottom:14px;z-index:4;gap:12px;justify-content:center;">
          <button class="btn btn-outline btn-sm" id="cap-retake">Chụp lại</button>
          <button class="btn btn-primary btn-sm" id="cap-save">Lưu ảnh</button>
        </div>
        <canvas id="cap-canvas" style="display:none;"></canvas>
      </div>
      <p class="small-note" style="margin-top:8px;">${angleHint(angle)}</p>
      <p class="small-note" id="cap-fallback-note" style="margin-top:4px;color:var(--warn);"></p>
      <input type="file" accept="image/*" id="cap-file-input" style="display:none;">
    `);
    onSheetCloseHook = stopCamera;
    $("#cap-close").addEventListener("click", ()=> closeSheet());
    $$("#cap-angle-tabs [data-capangle]").forEach(b=> b.addEventListener("click", ()=>{ angle=b.dataset.capangle; render(); }));
    startCamera();
    $("#cap-flip-cam").addEventListener("click", ()=>{
      facingMode = facingMode==="environment" ? "user" : "environment";
      startCamera();
    });
    $("#cap-shutter").addEventListener("click", ()=>{
      const video = $("#cap-video");
      if(!video.videoWidth) return;
      // Cắt đúng theo khung 3:4 đang hiển thị (giống object-fit:cover) để ảnh lưu khớp với khung đã canh
      const vw = video.videoWidth, vh = video.videoHeight;
      const videoRatio = vw/vh;
      let sx, sy, sw, sh;
      if(videoRatio > CAP_BOX_RATIO){ sh = vh; sw = vh*CAP_BOX_RATIO; sy = 0; sx = (vw-sw)/2; }
      else { sw = vw; sh = vw/CAP_BOX_RATIO; sx = 0; sy = (vh-sh)/2; }
      const canvas = $("#cap-canvas");
      canvas.width = Math.round(sw); canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d");
      if(facingMode==="user"){ ctx.translate(canvas.width,0); ctx.scale(-1,1); } // khớp với ảnh soi gương lúc xem trước
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob=>{ capturedBlob = blob; showPreview(URL.createObjectURL(blob)); }, "image/jpeg", 0.92);
    });
    $("#cap-file-fallback").addEventListener("click", ()=> $("#cap-file-input").click());
    $("#cap-file-input").addEventListener("change", (e)=>{
      const file = e.target.files[0]; if(!file) return;
      capturedBlob = file;
      showPreview(URL.createObjectURL(file));
    });
    $("#cap-retake").addEventListener("click", ()=> render());
    $("#cap-save").addEventListener("click", async ()=>{
      if(!capturedBlob) return;
      const id = await dbAddPhoto(capturedBlob, `progress_${angle}_${Date.now()}`);
      state.progressPhotos.push({ id, ts: Date.now(), angle, weightAtCapture: state.profile.weight, note:"" });
      saveState();
      stopCamera();
      closeSheet();
      toast("Đã lưu ảnh tiến trình!");
      if(onDone) onDone(id);
    });
  }
  render();
}

/* ---- Màn hình Ảnh tiến trình & InBody ---- */
function renderProgressScreen(){
  $$("#progress-tabs .day-tab").forEach(b=> b.classList.toggle("active", b.dataset.ptab===progressUI.tab));
  if(progressUI.tab==="photos") renderProgressPhotosTab();
  else renderProgressInbodyTab();
}

function photoRowHTML(p){
  const checked = progressUI.compareSel.includes(p.id);
  return `
    <div class="card" style="padding:10px;display:flex;gap:12px;align-items:center;" data-prow="${p.id}">
      <div class="thumb-wrap" style="width:64px;height:84px;">
        <img data-pimg="${p.id}" style="object-fit:cover;">
        <div class="cam-badge" style="background:var(--surface-3);"><span class="material-symbols-rounded" style="font-size:11px;">photo_camera</span></div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="pill hot" style="padding:3px 8px;">${angleLabel(p.angle)}</span>
          <span class="small-note">${new Date(p.ts).toLocaleDateString("vi-VN")}</span>
        </div>
        <p class="small-note" style="margin-top:4px;">${p.weightAtCapture ? `Cân nặng lúc chụp: ${p.weightAtCapture}kg` : ""}</p>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center;">
          <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted);">
            <input type="checkbox" data-pcompare="${p.id}" ${checked?'checked':''}> So sánh
          </label>
          <button class="btn btn-ghost btn-sm" data-pai="${p.id}" style="padding:4px 10px;">Phân tích AI</button>
          <button class="btn btn-ghost btn-sm" data-pdel="${p.id}" style="padding:4px 10px;color:var(--warn);">Xoá</button>
        </div>
      </div>
    </div>`;
}

function renderProgressPhotosTab(){
  const list = state.progressPhotos.slice().sort((a,b)=> b.ts-a.ts);
  const compareBar = progressUI.compareSel.length===2 ? `
    <button class="btn btn-primary btn-block" id="btn-do-compare" style="margin-bottom:12px;"><span class="material-symbols-rounded">compare</span>&nbsp;So sánh 2 ảnh đã chọn</button>
  ` : "";
  const hasKey = !!getActiveProviderKey();
  $("#progress-content").innerHTML = `
    <p class="small-note">Chụp ảnh cùng góc, cùng ánh sáng, cùng khoảng cách mỗi lần để so sánh chính xác nhất. Chọn 2 ảnh bất kỳ (tick "So sánh") để xem trước/sau.</p>
    <div style="display:flex;gap:8px;margin:10px 0;">
      <button class="btn btn-soft" style="flex:1;" id="btn-capture-inline"><span class="material-symbols-rounded">photo_camera</span>&nbsp;Chụp ảnh mới</button>
      <button class="btn btn-outline" id="btn-ai-settings" style="flex:0 0 auto;padding:0 14px;"><span class="material-symbols-rounded">key</span></button>
    </div>
    <p class="small-note" style="margin-bottom:12px;">${hasKey ? `Đang dùng <b style="color:var(--primary-soft);">${providerLabel(state.aiSettings.provider)}</b> để phân tích ảnh thật.` : `Chưa cấu hình API key AI — phân tích sẽ dùng ước tính mô phỏng. Bấm nút <span class="material-symbols-rounded" style="font-size:12px;vertical-align:middle;">key</span> để thêm key ChatGPT/Gemini/Grok.`}</p>
    ${compareBar}
    ${list.length===0 ? `<p class="empty-hint">Chưa có ảnh tiến trình nào. Hãy chụp ảnh đầu tiên!</p>` : `
    <div style="display:flex;flex-direction:column;gap:10px;" id="progress-photo-list">
      ${list.map(p=> photoRowHTML(p)).join("")}
    </div>`}
  `;
  bindProgressPhotoEvents();
  $("#btn-capture-inline").addEventListener("click", ()=> openCapturePhoto(()=> renderProgressScreen()));
  $("#btn-ai-settings").addEventListener("click", ()=> openAiSettings());
  if(progressUI.compareSel.length===2){
    $("#btn-do-compare").addEventListener("click", ()=> openComparePhotos(progressUI.compareSel[0], progressUI.compareSel[1]));
  }
}

function bindProgressPhotoEvents(){
  $$("#progress-photo-list [data-pimg]").forEach(async imgEl=>{
    const rec = await dbGetPhoto(Number(imgEl.dataset.pimg));
    if(rec && imgEl) imgEl.src = URL.createObjectURL(rec.blob);
  });
  $$("#progress-photo-list [data-pcompare]").forEach(cb=>{
    cb.addEventListener("change", (e)=>{
      e.stopPropagation();
      const id = Number(cb.dataset.pcompare);
      if(cb.checked){
        if(progressUI.compareSel.length>=2){ progressUI.compareSel.shift(); }
        progressUI.compareSel.push(id);
      } else {
        progressUI.compareSel = progressUI.compareSel.filter(x=>x!==id);
      }
      renderProgressPhotosTab();
    });
  });
  $$("#progress-photo-list [data-pai]").forEach(btn=> btn.addEventListener("click", (e)=>{ e.stopPropagation(); openAiAnalysis(Number(btn.dataset.pai)); }));
  $$("#progress-photo-list [data-pdel]").forEach(btn=> btn.addEventListener("click", (e)=>{
    e.stopPropagation();
    const id = Number(btn.dataset.pdel);
    confirmDialog("Xoá ảnh tiến trình này?", "Ảnh sẽ bị xoá vĩnh viễn khỏi thiết bị và không thể khôi phục.", async ()=>{
      await dbDeletePhoto(id);
      state.progressPhotos = state.progressPhotos.filter(p=>p.id!==id);
      progressUI.compareSel = progressUI.compareSel.filter(x=>x!==id);
      saveState();
      renderProgressPhotosTab();
      toast("Đã xoá ảnh", "delete");
    }, "Xoá ảnh", "delete_forever");
  }));
  $$("#progress-photo-list [data-prow]").forEach(row=>{
    row.addEventListener("click", (e)=>{
      if(e.target.closest("input,button,label")) return;
      openPhotoViewer(Number(row.dataset.prow));
    });
  });
}

async function openPhotoViewer(photoId){
  const p = state.progressPhotos.find(x=>x.id===photoId);
  const rec = await dbGetPhoto(photoId);
  if(!p || !rec) return;
  const url = URL.createObjectURL(rec.blob);
  openSheet(`
    <div class="sheet-header"><h3>Ảnh tiến trình</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <img src="${url}" style="width:100%;max-height:58vh;object-fit:contain;border-radius:14px;background:#000;">
    <div class="chip-row" style="margin-top:12px;">
      <span class="pill hot">${angleLabel(p.angle)}</span>
      <span class="pill">${new Date(p.ts).toLocaleDateString("vi-VN")}</span>
      ${p.weightAtCapture ? `<span class="pill">${p.weightAtCapture}kg</span>` : ""}
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:14px;" id="pv-analyze">Phân tích AI</button>
  `);
  $("#pv-analyze").addEventListener("click", ()=> openAiAnalysis(photoId));
}

/* ---- So sánh ảnh trước/sau bằng thanh trượt ---- */
async function openComparePhotos(idA, idB){
  const pa = state.progressPhotos.find(x=>x.id===idA);
  const pb = state.progressPhotos.find(x=>x.id===idB);
  if(!pa || !pb) return;
  const [before, after] = pa.ts <= pb.ts ? [pa,pb] : [pb,pa];
  const recBefore = await dbGetPhoto(before.id);
  const recAfter = await dbGetPhoto(after.id);
  if(!recBefore || !recAfter) return;
  const urlBefore = URL.createObjectURL(recBefore.blob);
  const urlAfter = URL.createObjectURL(recAfter.blob);
  const wDelta = (before.weightAtCapture && after.weightAtCapture) ? fmt1(after.weightAtCapture - before.weightAtCapture) : null;
  const days = Math.round((after.ts-before.ts)/86400000);
  openSheet(`
    <div class="sheet-header"><h3>So sánh tiến trình</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div id="cmp-wrap" style="position:relative;width:100%;aspect-ratio:3/4;border-radius:16px;overflow:hidden;background:#000;">
      <img src="${urlBefore}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
      <div id="cmp-after-wrap" style="position:absolute;top:0;left:0;bottom:0;width:50%;overflow:hidden;">
        <img src="${urlAfter}" id="cmp-after-img" style="position:absolute;top:0;left:0;object-fit:cover;">
      </div>
      <div id="cmp-handle" style="position:absolute;top:0;bottom:0;left:50%;width:3px;background:var(--primary);"></div>
      <div style="position:absolute;bottom:8px;left:8px;font-size:10px;background:rgba(0,0,0,0.6);color:#fff;padding:3px 8px;border-radius:6px;">${new Date(before.ts).toLocaleDateString("vi-VN")}</div>
      <div style="position:absolute;bottom:8px;right:8px;font-size:10px;background:rgba(0,0,0,0.6);color:#fff;padding:3px 8px;border-radius:6px;">${new Date(after.ts).toLocaleDateString("vi-VN")}</div>
    </div>
    <input type="range" id="cmp-slider" min="0" max="100" value="50" style="width:100%;margin-top:12px;">
    <div class="stat-grid cols-2" style="margin-top:12px;">
      <div class="stat-box"><div class="num">${before.weightAtCapture ?? "--"}kg</div><div class="cap">Trước</div></div>
      <div class="stat-box"><div class="num">${after.weightAtCapture ?? "--"}kg</div><div class="cap">Sau</div></div>
    </div>
    ${wDelta!==null ? `<p class="small-note" style="margin-top:10px;text-align:center;">Chênh lệch cân nặng: <b style="color:${wDelta<=0?'var(--success)':'var(--primary-soft)'}">${wDelta>0?'+':''}${wDelta}kg</b>${days>0?` sau ${days} ngày`:""}</p>` : ""}
  `);
  const wrap = $("#cmp-wrap");
  const setAfterSize = ()=>{
    const r = wrap.getBoundingClientRect();
    const img = $("#cmp-after-img");
    if(!img) return;
    img.style.width = r.width+"px";
    img.style.height = r.height+"px";
  };
  setAfterSize();
  $("#cmp-after-img").addEventListener("load", setAfterSize, { once:true });
  $("#cmp-slider").addEventListener("input", (e)=>{
    const v = e.target.value;
    $("#cmp-after-wrap").style.width = v+"%";
    $("#cmp-handle").style.left = v+"%";
  });
}

/* ---- Phân tích AI: gọi thật API của ChatGPT/Gemini/Grok nếu đã cấu hình key,
       nếu chưa có key hoặc gọi lỗi thì dùng ước tính mô phỏng theo công thức khoa học ---- */
function estimateBodyFatPct(){
  const p = state.profile;
  if(!p.height || !p.weight || !p.age) return null;
  const bmi = p.weight / ((p.height/100)**2);
  const genderFactor = p.gender==="male" ? 1 : 0;
  // Công thức Deurenberg và cộng sự (1991): BF% = 1.20×BMI + 0.23×Tuổi − 10.8×giới tính(nam=1,nữ=0) − 5.4
  const bf = 1.20*bmi + 0.23*p.age - 10.8*genderFactor - 5.4;
  return Math.max(3, Math.min(60, fmt1(bf)));
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function blobToDataURL(blob){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function providerLabel(id){
  return { openai:"ChatGPT (OpenAI)", gemini:"Google Gemini", grok:"Grok (xAI)" }[id] || id;
}
function getActiveProviderKey(){
  const s = state.aiSettings;
  if(s.provider==="openai") return s.openaiKey;
  if(s.provider==="gemini") return s.geminiKey;
  if(s.provider==="grok") return s.grokKey;
  return "";
}

/* ---- Cài đặt API key AI (chỉ lưu trên trình duyệt này) ---- */
function openAiSettings(){
  const s = state.aiSettings;
  openSheet(`
    <div class="sheet-header"><h3>Cài đặt trợ lý AI</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="color:var(--warn);">API key chỉ được lưu trên trình duyệt này (localStorage) và gửi thẳng tới máy chủ của nhà cung cấp bạn chọn khi phân tích — không qua máy chủ nào khác của FIT KIT. Không dùng chung thiết bị/app này với người khác nếu không muốn lộ key. Khi phân tích, ảnh chụp của bạn sẽ được gửi tới nhà cung cấp AI đang chọn.</p>
    <div class="field" style="margin-top:12px;">
      <label>Nhà cung cấp AI đang dùng để phân tích</label>
      <select id="ai-provider">
        <option value="openai" ${s.provider==='openai'?'selected':''}>ChatGPT (OpenAI GPT-4o Vision)</option>
        <option value="gemini" ${s.provider==='gemini'?'selected':''}>Google Gemini</option>
        <option value="grok" ${s.provider==='grok'?'selected':''}>Grok (xAI)</option>
      </select>
    </div>
    <div class="field" style="margin-top:12px;"><label>OpenAI API key</label><input type="password" id="key-openai" placeholder="sk-..." value="${s.openaiKey||""}"></div>
    <div class="field" style="margin-top:8px;"><label>Model OpenAI (nâng cao)</label><input type="text" id="model-openai" value="${s.openaiModel||"gpt-4o-mini"}"></div>
    <div class="field" style="margin-top:14px;"><label>Google Gemini API key</label><input type="password" id="key-gemini" placeholder="AIza..." value="${s.geminiKey||""}"></div>
    <div class="field" style="margin-top:8px;"><label>Model Gemini (nâng cao)</label><input type="text" id="model-gemini" value="${s.geminiModel||"gemini-1.5-flash"}"></div>
    <div class="field" style="margin-top:14px;"><label>xAI Grok API key</label><input type="password" id="key-grok" placeholder="xai-..." value="${s.grokKey||""}"></div>
    <div class="field" style="margin-top:8px;"><label>Model Grok (nâng cao)</label><input type="text" id="model-grok" value="${s.grokModel||"grok-2-vision-1212"}"></div>
    <p class="small-note" style="margin-top:10px;">Nếu nhà cung cấp báo lỗi "model không tồn tại", tên model có thể đã được cập nhật — hãy chỉnh lại ô "Model (nâng cao)" tương ứng theo tài liệu mới nhất của họ.</p>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-ai-settings">Lưu cài đặt</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-clear-ai-keys">Xoá toàn bộ API key đã lưu</button>
  `);
  $("#btn-save-ai-settings").addEventListener("click", ()=>{
    s.provider = $("#ai-provider").value;
    s.openaiKey = $("#key-openai").value.trim();
    s.openaiModel = $("#model-openai").value.trim() || "gpt-4o-mini";
    s.geminiKey = $("#key-gemini").value.trim();
    s.geminiModel = $("#model-gemini").value.trim() || "gemini-1.5-flash";
    s.grokKey = $("#key-grok").value.trim();
    s.grokModel = $("#model-grok").value.trim() || "grok-2-vision-1212";
    saveState();
    closeSheet();
    renderProgressScreen();
    toast("Đã lưu cài đặt AI");
  });
  $("#btn-clear-ai-keys").addEventListener("click", ()=>{
    confirmDialog("Xoá toàn bộ API key?", "Các key ChatGPT, Gemini và Grok đã lưu trên trình duyệt này sẽ bị xoá.", ()=>{
      s.openaiKey=""; s.geminiKey=""; s.grokKey="";
      saveState(); closeSheet(); renderProgressScreen();
      toast("Đã xoá API key");
    }, "Xoá key", "key_off");
  });
}

/* ---- Gọi API vision thật của từng nhà cung cấp ---- */
async function callOpenAIVision(apiKey, model, dataUrl, promptText){
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role:"user", content:[
        { type:"text", text: promptText },
        { type:"image_url", image_url:{ url: dataUrl } },
      ]}],
      max_tokens: 700,
    }),
  });
  if(!res.ok){ const t = await res.text().catch(()=>""); throw new Error(`OpenAI lỗi ${res.status} — ${t.slice(0,200)}`); }
  const data = await res.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "(Không có phản hồi)";
}
async function callGeminiVision(apiKey, model, dataUrl, promptText){
  const base64 = dataUrl.split(",")[1];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({
      contents: [{ parts: [ { text: promptText }, { inlineData: { mimeType:"image/jpeg", data: base64 } } ] }],
    }),
  });
  if(!res.ok){ const t = await res.text().catch(()=>""); throw new Error(`Gemini lỗi ${res.status} — ${t.slice(0,200)}`); }
  const data = await res.json();
  const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return (parts ? parts.map(p=>p.text).join("\n") : "") || "(Không có phản hồi)";
}
async function callGrokVision(apiKey, model, dataUrl, promptText){
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role:"user", content:[
        { type:"text", text: promptText },
        { type:"image_url", image_url:{ url: dataUrl } },
      ]}],
      max_tokens: 700,
    }),
  });
  if(!res.ok){ const t = await res.text().catch(()=>""); throw new Error(`Grok lỗi ${res.status} — ${t.slice(0,200)}`); }
  const data = await res.json();
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "(Không có phản hồi)";
}
async function callVisionAI(dataUrl, promptText){
  const s = state.aiSettings;
  if(s.provider==="openai") return callOpenAIVision(s.openaiKey, s.openaiModel||"gpt-4o-mini", dataUrl, promptText);
  if(s.provider==="gemini") return callGeminiVision(s.geminiKey, s.geminiModel||"gemini-1.5-flash", dataUrl, promptText);
  if(s.provider==="grok") return callGrokVision(s.grokKey, s.grokModel||"grok-2-vision-1212", dataUrl, promptText);
  throw new Error("Chưa chọn nhà cung cấp AI hợp lệ.");
}
function buildAnalysisPrompt(p){
  const prof = state.profile;
  const goalDef = GOALS.find(g=>g.id===prof.goal);
  return `Bạn là một huấn luyện viên thể hình giàu kinh nghiệm đang xem ảnh tiến trình tập luyện (góc chụp: ${angleLabel(p.angle)}) của một người tập gym. Thông tin: giới tính ${prof.gender==='male'?'nam':'nữ'}, ${prof.age} tuổi, cao ${prof.height}cm, nặng ${p.weightAtCapture||prof.weight}kg, mục tiêu: ${goalDef?goalDef.label:'—'}. Hãy trả lời bằng tiếng Việt, ngắn gọn, tôn trọng và mang tính xây dựng, gồm: (1) ấn tượng chung về vóc dáng qua ảnh, (2) 2-3 vùng cơ thể có vẻ nổi bật/tiến bộ, (3) 2-3 vùng nên chú trọng cải thiện thêm dựa theo mục tiêu, (4) một lời khuyên tập luyện hoặc dinh dưỡng cụ thể. Kết thúc bằng một câu nói rõ đây chỉ là quan sát hình ảnh mang tính tham khảo, không phải chẩn đoán y khoa hay đo lường chính xác.`;
}

function renderAiResultSheet(p, text){
  const estBf = estimateBodyFatPct();
  openSheet(`
    <div class="sheet-header"><h3>Phân tích AI · ${providerLabel(state.aiSettings.provider)}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">smart_toy</span>Nhận xét từ AI</div>
      <p class="small-note" style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(text)}</p>
    </div>
    <p class="small-note" style="color:var(--warn);">Đây là quan sát hình ảnh bằng AI, không phải chẩn đoán y khoa hay đo lường chính xác — chỉ mang tính tham khảo.</p>
    ${estBf ? `
    <div class="stat-grid" style="margin-top:8px;">
      <div class="stat-box"><div class="num">${estBf}%</div><div class="cap">Mỡ ước tính (Deurenberg)</div></div>
      <div class="stat-box"><div class="num">${p.weightAtCapture ?? '--'}kg</div><div class="cap">Cân nặng</div></div>
      <div class="stat-box"><div class="num" style="font-size:13px;">${angleLabel(p.angle)}</div><div class="cap">Góc ảnh</div></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:14px;" id="ai-save-inbody">Lưu ước tính vào kho InBody</button>` : ""}
  `);
  if(estBf){
    $("#ai-save-inbody").addEventListener("click", ()=>{
      state.inbodyLogs.push({
        id: uid(), ts: Date.now(), source:"ai",
        weight: p.weightAtCapture || state.profile.weight,
        bodyFatPct: estBf, muscleMassKg:null, bodyWaterPct:null, visceralFat:null,
        note: `Ước tính AI (${providerLabel(state.aiSettings.provider)} + công thức Deurenberg) — chỉ mang tính tham khảo, không thay thế máy đo InBody chuyên dụng.`,
      });
      saveState();
      closeSheet();
      toast("Đã lưu vào kho InBody");
    });
  }
}

function renderAiFallback(p, errorNote){
  const history = state.progressPhotos.filter(x=>x.id!==p.id).sort((a,b)=>a.ts-b.ts);
  const earliest = history[0];
  const estBf = estimateBodyFatPct();
  let trendNote = "Chưa đủ dữ liệu để so sánh xu hướng — hãy chụp thêm ảnh theo thời gian để thấy rõ tiến trình.";
  if(earliest && earliest.weightAtCapture && p.weightAtCapture){
    const delta = fmt1(p.weightAtCapture - earliest.weightAtCapture);
    const days = Math.round((p.ts - earliest.ts)/86400000);
    if(days>0){
      trendNote = `So với ảnh đầu tiên (${days} ngày trước): cân nặng ${delta===0?'không đổi':(delta>0?`tăng ${delta}`:`giảm ${Math.abs(delta)}`)+'kg'}.`;
    }
  }
  const goalDef = GOALS.find(g=>g.id===state.profile.goal);
  const focusAreas = goalDef && goalDef.id==="lose"
    ? "vùng bụng, eo và đùi trong — đây thường là nơi thể hiện rõ nhất kết quả giảm mỡ sau 4–6 tuần kiên trì."
    : goalDef && goalDef.id==="gain"
    ? "vai, ngực và tay — nên tăng tạ dần (progressive overload) để thấy rõ sự phát triển ở các vùng này."
    : "duy trì cân đối toàn thân — tiếp tục theo dõi để giữ vững thành quả hiện tại.";
  openSheet(`
    <div class="sheet-header"><h3>Phân tích AI (mô phỏng)</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    ${errorNote ? `<p class="small-note" style="color:var(--warn);">${escapeHtml(errorNote)}</p>` : `
    <p class="small-note" style="color:var(--warn);">Chưa cấu hình API key AI thật — đây là ước tính dựa trên số liệu cơ thể bạn đã nhập (công thức Deurenberg, 1991) và lịch sử ảnh. <span id="link-open-ai-settings" style="color:var(--primary-soft);text-decoration:underline;cursor:pointer;">Cài đặt API key ngay</span> để dùng ChatGPT/Gemini/Grok phân tích ảnh thật.</p>`}
    <div class="card" style="margin-top:12px;">
      <div class="card-title"><span class="material-symbols-rounded">insights</span>Ước tính chỉ số cơ thể</div>
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${p.weightAtCapture ?? '--'}kg</div><div class="cap">Cân nặng</div></div>
        <div class="stat-box"><div class="num">${estBf ?? '--'}%</div><div class="cap">Mỡ ước tính</div></div>
        <div class="stat-box"><div class="num" style="font-size:14px;">${angleLabel(p.angle)}</div><div class="cap">Góc ảnh</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">trending_up</span>Xu hướng</div>
      <p class="small-note">${trendNote}</p>
    </div>
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">flag</span>Gợi ý cải thiện theo mục tiêu</div>
      <p class="small-note">Nên chú trọng ${focusAreas}</p>
      <p class="small-note" style="margin-top:6px;">Nhắc nhở khoa học: ngủ đủ 7–9h/đêm, nạp đủ đạm (1.6–2.2g/kg), uống đủ nước và duy trì thâm hụt/thặng dư calo hợp lý sẽ quyết định phần lớn kết quả.</p>
    </div>
    ${estBf ? `<button class="btn btn-primary btn-block" id="ai-save-inbody">Lưu ước tính vào kho InBody</button>` : ""}
  `);
  if(!errorNote){
    const link = $("#link-open-ai-settings");
    if(link) link.addEventListener("click", ()=> openAiSettings());
  }
  if(estBf){
    $("#ai-save-inbody").addEventListener("click", ()=>{
      state.inbodyLogs.push({
        id: uid(), ts: Date.now(), source:"ai",
        weight: p.weightAtCapture || state.profile.weight,
        bodyFatPct: estBf, muscleMassKg:null, bodyWaterPct:null, visceralFat:null,
        note: "Ước tính AI qua ảnh & chỉ số cơ thể (công thức Deurenberg) — chỉ mang tính tham khảo, không thay thế máy đo InBody chuyên dụng.",
      });
      saveState();
      closeSheet();
      toast("Đã lưu vào kho InBody");
    });
  }
}

async function openAiAnalysis(photoId){
  const p = state.progressPhotos.find(x=>x.id===photoId);
  if(!p) return;
  const activeKey = getActiveProviderKey();
  if(!activeKey){
    renderAiFallback(p, null);
    return;
  }
  openSheet(`
    <div class="sheet-header"><h3>Phân tích AI</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div style="text-align:center;padding:34px 0;">
      <span class="material-symbols-rounded" style="font-size:38px;color:var(--primary);display:inline-block;animation:spin 1.1s linear infinite;">progress_activity</span>
      <p class="small-note" style="margin-top:12px;">Đang gửi ảnh tới ${providerLabel(state.aiSettings.provider)} để phân tích…</p>
    </div>
  `);
  try{
    const rec = await dbGetPhoto(photoId);
    if(!rec) throw new Error("Không tìm thấy ảnh trong bộ nhớ thiết bị.");
    const dataUrl = await blobToDataURL(rec.blob);
    const text = await callVisionAI(dataUrl, buildAnalysisPrompt(p));
    renderAiResultSheet(p, text);
  }catch(err){
    renderAiFallback(p, `Không gọi được ${providerLabel(state.aiSettings.provider)}: ${(err && err.message) || err}. Có thể do key sai/hết hạn mức, tên model không đúng, hoặc trình duyệt chặn kết nối trực tiếp (CORS). Tạm hiển thị ước tính mô phỏng bên dưới.`);
  }
}

/* ---- Kho chỉ số InBody: nhập tay + biểu đồ ---- */
function inbodyRowHTML(l){
  return `
    <div class="card" style="padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="pill ${l.source==='manual'?'hot':''}">${l.source==='manual' ? 'Đo thực tế' : 'AI ước tính'}</span>
        <span class="small-note">${new Date(l.ts).toLocaleDateString("vi-VN")}</span>
      </div>
      <div class="stat-grid" style="margin-top:10px;">
        <div class="stat-box"><div class="num">${l.weight ?? '--'}</div><div class="cap">Cân nặng (kg)</div></div>
        <div class="stat-box"><div class="num">${l.bodyFatPct ?? '--'}</div><div class="cap">% mỡ</div></div>
        <div class="stat-box"><div class="num">${l.muscleMassKg ?? '--'}</div><div class="cap">Cơ (kg)</div></div>
      </div>
      ${l.note ? `<p class="small-note" style="margin-top:8px;">${l.note}</p>` : ""}
      <button class="btn btn-ghost btn-sm" data-idel="${l.id}" style="margin-top:8px;color:var(--warn);">Xoá</button>
    </div>`;
}

function renderInbodyChart(containerId, rawLogs){
  const el = $(containerId);
  if(!el) return;
  const logs = rawLogs.slice().sort((a,b)=>a.ts-b.ts);
  if(logs.length<1){ el.innerHTML = ""; return; }
  const W = 300, H = 140, PAD = 24;
  const weights = logs.map(l=>l.weight).filter(v=>v!=null);
  const bfs = logs.map(l=>l.bodyFatPct).filter(v=>v!=null);
  const wMin = weights.length ? Math.min(...weights)-1 : 0, wMax = weights.length ? Math.max(...weights)+1 : 1;
  const bfMin = bfs.length ? Math.min(...bfs)-2 : 0, bfMax = bfs.length ? Math.max(...bfs)+2 : 1;
  const xStep = logs.length>1 ? (W-2*PAD)/(logs.length-1) : 0;
  const xFor = (i)=> PAD + i*xStep;
  const yForWeight = (v)=> H-PAD - ((v-wMin)/((wMax-wMin)||1))*(H-2*PAD);
  const yForBf = (v)=> H-PAD - ((v-bfMin)/((bfMax-bfMin)||1))*(H-2*PAD);
  const weightPts = logs.map((l,i)=> l.weight!=null ? `${xFor(i)},${yForWeight(l.weight)}` : null).filter(Boolean).join(" ");
  const bfPts = logs.map((l,i)=> l.bodyFatPct!=null ? `${xFor(i)},${yForBf(l.bodyFatPct)}` : null).filter(Boolean).join(" ");
  const weightDots = logs.map((l,i)=> l.weight!=null ? `<circle cx="${xFor(i)}" cy="${yForWeight(l.weight)}" r="${l.source==='manual'?3.5:3}" fill="var(--primary)" ${l.source==='ai'?'stroke="#fff" stroke-width="1"':''}/>` : "").join("");
  const bfDots = logs.map((l,i)=> l.bodyFatPct!=null ? `<circle cx="${xFor(i)}" cy="${yForBf(l.bodyFatPct)}" r="${l.source==='manual'?3.5:3}" fill="#5EE6C7" ${l.source==='ai'?'stroke="#fff" stroke-width="1"':''}/>` : "").join("");
  el.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:150px;">
      <line x1="${PAD}" y1="${H-PAD}" x2="${W-PAD}" y2="${H-PAD}" stroke="var(--border)" stroke-width="1"/>
      ${weightPts ? `<polyline points="${weightPts}" fill="none" stroke="var(--primary)" stroke-width="2"/>` : ""}
      ${bfPts ? `<polyline points="${bfPts}" fill="none" stroke="#5EE6C7" stroke-width="2"/>` : ""}
      ${weightDots}${bfDots}
    </svg>`;
}

function renderProgressInbodyTab(){
  const logs = state.inbodyLogs.slice().sort((a,b)=> b.ts-a.ts);
  const sortedAsc = state.inbodyLogs.slice().sort((a,b)=>a.ts-b.ts);
  const latest = logs[0];
  const first = sortedAsc[0];
  const weightDelta = (latest && first && latest.id!==first.id) ? fmt1(latest.weight-first.weight) : null;
  $("#progress-content").innerHTML = `
    <p class="small-note">Lưu số liệu đo InBody thật từ phòng gym/phòng khám, hoặc ước tính nhanh qua AI ở tab Ảnh tiến trình. Biểu đồ dưới đây theo dõi cả hai nguồn.</p>
    <button class="btn btn-soft btn-block" id="btn-add-inbody" style="margin:10px 0 14px;"><span class="material-symbols-rounded">add</span>&nbsp;Thêm số liệu đo thực tế</button>
    ${logs.length===0 ? `<p class="empty-hint">Chưa có số liệu InBody nào.</p>` : `
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">show_chart</span>Biểu đồ cân nặng &amp; % mỡ theo thời gian</div>
      <div id="inbody-chart"></div>
      <div class="chip-row" style="margin-top:8px;">
        <span class="pill" style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:var(--primary);display:inline-block;"></span>Cân nặng</span>
        <span class="pill" style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:#5EE6C7;display:inline-block;"></span>% mỡ</span>
      </div>
    </div>
    <div class="stat-grid" style="margin-top:2px;">
      <div class="stat-box"><div class="num">${latest.weight ?? '--'}kg</div><div class="cap">Mới nhất</div></div>
      <div class="stat-box"><div class="num">${weightDelta!==null ? (weightDelta>0?'+':'')+weightDelta+'kg' : '--'}</div><div class="cap">So với lần đầu</div></div>
      <div class="stat-box"><div class="num">${logs.length}</div><div class="cap">Lần đo</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
      ${logs.map(l=> inbodyRowHTML(l)).join("")}
    </div>`}
  `;
  if(logs.length) renderInbodyChart("#inbody-chart", state.inbodyLogs);
  $("#btn-add-inbody").addEventListener("click", ()=> openAddInbodyLog());
  $$("#progress-content [data-idel]").forEach(btn=> btn.addEventListener("click", ()=>{
    const id = btn.dataset.idel;
    state.inbodyLogs = state.inbodyLogs.filter(l=>l.id!==id);
    saveState(); renderProgressInbodyTab(); toast("Đã xoá số liệu", "delete");
  }));
}

function openAddInbodyLog(){
  openSheet(`
    <div class="sheet-header"><h3>Thêm số liệu InBody</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="margin-bottom:10px;">Nhập số liệu từ máy đo InBody thật ở phòng gym/phòng khám để theo dõi chính xác nhất.</p>
    <div class="field-row">
      <div class="field"><label>Ngày đo</label><input type="date" id="ib-date" value="${todayStr()}"></div>
      <div class="field"><label>Cân nặng (kg)</label><input type="number" id="ib-weight" value="${state.profile.weight}"></div>
    </div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Tỉ lệ mỡ (%)</label><input type="number" id="ib-bf" placeholder="VD: 18"></div>
      <div class="field"><label>Khối lượng cơ (kg)</label><input type="number" id="ib-muscle" placeholder="VD: 32"></div>
    </div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Nước cơ thể (%)</label><input type="number" id="ib-water" placeholder="VD: 55"></div>
      <div class="field"><label>Mỡ nội tạng (cấp)</label><input type="number" id="ib-visceral" placeholder="VD: 8"></div>
    </div>
    <div class="field" style="margin-top:10px;">
      <label>Ghi chú</label>
      <input type="text" id="ib-note" placeholder="VD: Đo tại California Fitness">
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="ib-save">Lưu số liệu</button>
  `);
  $("#ib-save").addEventListener("click", ()=>{
    let dateVal = Date.now();
    if($("#ib-date").value){
      const [y,m,d] = $("#ib-date").value.split("-").map(Number);
      dateVal = new Date(y, m-1, d, 12).getTime(); // giờ trưa local — tránh lệch ngày do múi giờ
    }
    state.inbodyLogs.push({
      id: uid(), ts: dateVal, source: "manual",
      weight: Number($("#ib-weight").value) || state.profile.weight,
      bodyFatPct: $("#ib-bf").value ? Number($("#ib-bf").value) : null,
      muscleMassKg: $("#ib-muscle").value ? Number($("#ib-muscle").value) : null,
      bodyWaterPct: $("#ib-water").value ? Number($("#ib-water").value) : null,
      visceralFat: $("#ib-visceral").value ? Number($("#ib-visceral").value) : null,
      note: $("#ib-note").value || "",
    });
    saveState();
    closeSheet();
    renderProgressInbodyTab();
    toast("Đã lưu số liệu InBody!");
  });
}

$$("#progress-tabs [data-ptab]").forEach(b=> b.addEventListener("click", ()=>{ progressUI.tab = b.dataset.ptab; renderProgressScreen(); }));
$("#btn-progress-back").addEventListener("click", ()=> goto("profile"));
$("#btn-progress-camera").addEventListener("click", ()=> openCapturePhoto(()=> renderProgressScreen()));

/* =========================================================================
   8. MÀN HÌNH DINH DƯỠNG
   ========================================================================= */
const KCAL_RING_CIRC = 2*Math.PI*56;
$("#kcal-ring").style.strokeDasharray = `${KCAL_RING_CIRC}`;
const SLEEP_RING_CIRC = 2*Math.PI*42;
$("#sleep-ring").style.strokeDasharray = `${SLEEP_RING_CIRC}`;

function getDayFoodLog(dateKey=todayStr()){
  if(!state.foodLog[dateKey]) state.foodLog[dateKey] = { breakfast:[], lunch:[], dinner:[], snack:[] };
  return state.foodLog[dateKey];
}
function renderNutritionScreen(){
  ensureReminderDefaults();
  $("#nutrition-hero").style.backgroundImage = `url('${IMG.heroNutrition}')`;
  const p = state.profile;
  const log = getDayFoodLog();
  let kcal=0, protein=0, carbs=0, fat=0;
  Object.values(log).forEach(list=> list.forEach(it=>{ kcal+=it.kcal; protein+=it.protein; carbs+=it.carbs; fat+=it.fat; }));

  const pct = p.goalKcal ? Math.min(100, Math.round(kcal/p.goalKcal*100)) : 0;
  $("#kcal-current").textContent = Math.round(kcal);
  $("#kcal-target-label").textContent = `/ ${p.goalKcal} kcal`;
  $("#kcal-percent").textContent = `${pct}%`;
  $("#kcal-progress-fill").style.width = `${pct}%`;
  $("#kcal-ring").style.strokeDashoffset = `${KCAL_RING_CIRC*(1-pct/100)}`;
  const goalDef = GOALS.find(g=>g.id===p.goal);
  $("#kcal-goal-note").textContent = goalDef ? `Mục tiêu: ${goalDef.label} — ${goalDef.desc}` : "";
  $("#macro-protein").textContent = `${Math.round(protein)}g`;
  $("#macro-carbs").textContent = `${Math.round(carbs)}g`;
  $("#macro-fat").textContent = `${Math.round(fat)}g`;

  $("#meal-sections").innerHTML = MEAL_TYPES.map(mt=>{
    const items = log[mt.id];
    const mealKcal = items.reduce((s,i)=>s+i.kcal,0);
    const mealTime = state.reminders.meal[mt.id].time;
    return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="card-title" style="margin-bottom:0;"><span class="material-symbols-rounded">${mt.icon}</span>${mt.label} <span data-edit-time="meal:${mt.id}" style="color:var(--primary-soft);font-weight:600;text-transform:none;letter-spacing:0;cursor:pointer;text-decoration:underline;">· ${mealTime}</span></div>
        <button class="btn btn-soft btn-sm" data-add-meal="${mt.id}"><span class="material-symbols-rounded" style="font-size:15px;">add</span></button>
      </div>
      ${items.length ? items.map((it,i)=>`
        <div class="food-result">
          <div><div class="name">${it.name}</div><div class="kcal">${it.grams}g · P${it.protein}g C${it.carbs}g F${it.fat}g</div></div>
          <div style="display:flex;align-items:center;gap:10px;">
            <b>${it.kcal} kcal</b>
            <button class="icon-btn" data-del-food="${mt.id}:${i}" style="width:26px;height:26px;"><span class="material-symbols-rounded" style="font-size:16px;color:var(--text-dim);">close</span></button>
          </div>
        </div>`).join("") : `<p class="empty-hint" style="padding:6px 0;">Chưa có món ăn nào · ${mealKcal} kcal</p>`}
    </div>`;
  }).join("");

  $$("[data-add-meal]").forEach(b=> b.addEventListener("click", ()=> openAddFood(b.dataset.addMeal)));
  $$("[data-del-food]").forEach(b=> b.addEventListener("click", ()=>{
    const [mealId, i] = b.dataset.delFood.split(":");
    getDayFoodLog()[mealId].splice(Number(i),1);
    saveState(); renderNutritionScreen();
  }));
  $$("#meal-sections [data-edit-time]").forEach(el=> el.addEventListener("click", ()=> openEditReminderTime(...el.dataset.editTime.split(":"))));

  // nước uống
  const water = state.waterLog[todayStr()] || 0;
  const target = p.waterTargetOverride != null ? p.waterTargetOverride : fmt1(p.weight * 0.035);
  $("#water-target").textContent = target;
  $("#water-current").textContent = `${fmt1(water)}L`;
  $("#water-fill").style.width = `${Math.min(100, Math.round(water/target*100))}%`;
}

/* ---- Chỉnh sửa & khôi phục mục tiêu dinh dưỡng / nước ---- */
function openEditNutritionTargets(){
  const p = state.profile;
  openSheet(`
    <h3 style="margin-bottom:6px;">Mục tiêu calo &amp; macro</h3>
    <p class="small-note" style="margin-bottom:12px;">${p.autoTargets!==false ? "Hiện đang tự động tính theo công thức Mifflin-St Jeor." : "Bạn đang dùng mục tiêu tự chỉnh."}</p>
    <div class="field"><label>Mục tiêu calo (kcal)</label><input type="number" id="nt-kcal" value="${p.goalKcal}"></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Protein (g)</label><input type="number" id="nt-protein" value="${p.protein}"></div>
      <div class="field"><label>Carbs (g)</label><input type="number" id="nt-carbs" value="${p.carbs}"></div>
      <div class="field"><label>Fat (g)</label><input type="number" id="nt-fat" value="${p.fat}"></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-targets">Lưu mục tiêu tự chỉnh</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-reset-targets">Khôi phục theo công thức khoa học</button>
  `);
  $("#btn-save-targets").addEventListener("click", ()=>{
    p.goalKcal = Number($("#nt-kcal").value) || p.goalKcal;
    p.protein = Number($("#nt-protein").value) || p.protein;
    p.carbs = Number($("#nt-carbs").value) || p.carbs;
    p.fat = Number($("#nt-fat").value) || p.fat;
    p.autoTargets = false;
    saveState(); closeSheet(); renderNutritionScreen(); renderProfileScreen();
    toast("Đã lưu mục tiêu tự chỉnh");
  });
  $("#btn-reset-targets").addEventListener("click", ()=>{
    confirmDialog("Khôi phục theo công thức khoa học?", "Mục tiêu calo & macro tự chỉnh sẽ mất, quay về tính toán tự động dựa trên hồ sơ của bạn (Mifflin-St Jeor).", ()=>{
      p.autoTargets = true;
      recomputeProfile();
      saveState(); closeSheet(); renderNutritionScreen(); renderProfileScreen();
      toast("Đã khôi phục mục tiêu theo công thức khoa học");
    });
  });
}
$("#btn-edit-targets").addEventListener("click", openEditNutritionTargets);

function openEditWaterTarget(){
  const p = state.profile;
  const auto = fmt1(p.weight * 0.035);
  openSheet(`
    <h3 style="margin-bottom:6px;">Mục tiêu uống nước</h3>
    <p class="small-note" style="margin-bottom:12px;">Mặc định tính theo cân nặng (~35ml/kg): ${auto}L/ngày. Bạn có thể tự đặt mục tiêu khác.</p>
    <div class="field"><label>Mục tiêu (lít/ngày)</label><input type="number" id="water-goal-input" step="0.1" value="${p.waterTargetOverride != null ? p.waterTargetOverride : auto}"></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-water-goal">Lưu mục tiêu</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-reset-water-goal">Khôi phục tính theo cân nặng</button>
  `);
  $("#btn-save-water-goal").addEventListener("click", ()=>{
    p.waterTargetOverride = Number($("#water-goal-input").value) || auto;
    saveState(); closeSheet(); renderNutritionScreen();
    toast("Đã lưu mục tiêu nước uống");
  });
  $("#btn-reset-water-goal").addEventListener("click", ()=>{
    confirmDialog("Khôi phục mặc định?", `Mục tiêu nước uống sẽ tự tính lại theo cân nặng (~35ml/kg = ${auto}L).`, ()=>{
      p.waterTargetOverride = null;
      saveState(); closeSheet(); renderNutritionScreen();
      toast("Đã khôi phục tính theo cân nặng");
    });
  });
}
$("#btn-edit-water").addEventListener("click", openEditWaterTarget);

function openAddFood(mealId){
  const mt = MEAL_TYPES.find(m=>m.id===mealId);
  const render = (query="") => {
    const q = query.trim().toLowerCase();
    const results = FOODS.filter(f=> f.name.toLowerCase().includes(q)).slice(0,40);
    return results.map(f=>`
      <div class="food-result" data-pick="${f.id}" style="cursor:pointer;">
        <div><div class="name">${f.name}</div><div class="kcal">/100g</div></div>
        <b>${f.kcal} kcal</b>
      </div>`).join("") || `<p class="empty-hint">Không tìm thấy món ăn phù hợp</p>`;
  };
  openSheet(`
    <div class="sheet-header"><h3>Thêm vào ${mt.label}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="search-box" style="margin-bottom:10px;">
      <span class="material-symbols-rounded" style="color:var(--text-dim);">search</span>
      <input type="text" id="food-search" placeholder="Tìm món ăn — VD: ức gà, cơm...">
    </div>
    <div id="food-results" style="max-height:44vh;overflow-y:auto;">${render()}</div>
  `);
  $("#food-search").focus();
  $("#food-search").addEventListener("input", (e)=>{
    $("#food-results").innerHTML = render(e.target.value);
    bindFoodPick(mealId);
  });
  bindFoodPick(mealId);
}
function bindFoodPick(mealId){
  $$("#food-results [data-pick]").forEach(el=>{
    el.addEventListener("click", ()=> openFoodQuantity(FOODS.find(f=>f.id===el.dataset.pick), mealId));
  });
}
function openFoodQuantity(food, mealId){
  const calc = (g)=> ({
    kcal: Math.round(food.kcal*g/100),
    protein: fmt1(food.protein*g/100),
    carbs: fmt1(food.carbs*g/100),
    fat: fmt1(food.fat*g/100),
  });
  openSheet(`
    <div class="sheet-header"><h3>${food.name}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="field"><label>Khối lượng (gram)</label><input type="number" id="qty-input" value="100" min="1"></div>
    <div class="stat-grid" style="margin-top:14px;">
      <div class="stat-box"><div class="num" id="qty-kcal">${food.kcal}</div><div class="cap">Kcal</div></div>
      <div class="stat-box"><div class="num" id="qty-protein">${food.protein}g</div><div class="cap">Protein</div></div>
      <div class="stat-box"><div class="num" id="qty-carbs">${food.carbs}g</div><div class="cap">Carbs</div></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-confirm-food">Thêm vào nhật ký</button>
  `);
  const update = ()=>{
    const g = Number($("#qty-input").value)||0;
    const c = calc(g);
    $("#qty-kcal").textContent = c.kcal;
    $("#qty-protein").textContent = c.protein+"g";
    $("#qty-carbs").textContent = c.carbs+"g";
  };
  $("#qty-input").addEventListener("input", update);
  $("#btn-confirm-food").addEventListener("click", ()=>{
    const g = Number($("#qty-input").value)||100;
    const c = calc(g);
    getDayFoodLog()[mealId].push({ name: food.name, grams: g, ...c });
    saveState();
    closeSheet();
    renderNutritionScreen();
    toast(`Đã thêm ${food.name}`);
  });
}
$$("[data-water]").forEach(b=>{
  b.addEventListener("click", ()=>{
    const key = todayStr();
    if(b.dataset.water==="reset") state.waterLog[key]=0;
    else state.waterLog[key] = (state.waterLog[key]||0) + Number(b.dataset.water);
    saveState(); renderNutritionScreen();
  });
});

/* =========================================================================
   9. MÀN HÌNH GIẤC NGỦ
   ========================================================================= */
let selectedSleepQuality = 3;
$$("#sleep-quality .pill").forEach(b=>{
  b.addEventListener("click", ()=>{
    $$("#sleep-quality .pill").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    selectedSleepQuality = Number(b.dataset.q);
  });
});
function sleepHours(start,end){
  const [sh,sm] = start.split(":").map(Number);
  const [eh,em] = end.split(":").map(Number);
  let mins = (eh*60+em) - (sh*60+sm);
  if(mins<=0) mins += 24*60;
  return mins/60;
}
$("#btn-save-sleep").addEventListener("click", ()=>{
  const start = $("#sleep-start").value, end = $("#sleep-end").value;
  const hours = fmt1(sleepHours(start,end));
  state.sleepLog[todayStr()] = { start, end, hours, quality: selectedSleepQuality };
  saveState();
  renderSleepScreen();
  toast("Đã lưu nhật ký giấc ngủ!");
});
function renderSleepScreen(){
  $("#sleep-hero").style.backgroundImage = `url('${IMG.heroSleep}')`;
  const goalHours = state.profile.sleepGoalHours || 8;
  $("#sleep-goal-label").textContent = `Mục tiêu cá nhân: ${goalHours} giờ/đêm`;
  const days = Array.from({length:7}).map((_,i)=> dateStrOffset(-6+i));
  const logs = days.map(d=> state.sleepLog[d]);
  const validHours = logs.filter(Boolean).map(l=>l.hours);
  const avg = validHours.length ? fmt1(validHours.reduce((a,b)=>a+b,0)/validHours.length) : 0;
  const pct = Math.min(100, Math.round(avg/goalHours*100));
  $("#sleep-avg").textContent = `${avg}h`;
  $("#sleep-ring").style.strokeDashoffset = `${SLEEP_RING_CIRC*(1-pct/100)}`;
  const max = 10;
  $("#sleep-bars").innerHTML = days.map((d,i)=>{
    const h = logs[i] ? logs[i].hours : 0;
    const barH = Math.max(4, Math.round(h/max*80));
    const inGoal = h >= goalHours-1;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div style="width:100%;max-width:18px;height:${barH}px;border-radius:4px;background:${h?(inGoal?'var(--success)':'var(--primary-soft)'):'var(--surface-3)'};"></div>
      <span style="font-size:9px;color:var(--text-dim);">${["T2","T3","T4","T5","T6","T7","CN"][new Date(d).getDay()===0?6:new Date(d).getDay()-1]}</span>
    </div>`;
  }).join("");
}
$("#btn-edit-sleep-goal").addEventListener("click", ()=>{
  openSheet(`
    <h3 style="margin-bottom:14px;">Mục tiêu giờ ngủ mỗi đêm</h3>
    <p class="small-note" style="margin-bottom:10px;">National Sleep Foundation khuyến nghị 7–9 giờ/đêm cho người trưởng thành — bạn có thể tự đặt mục tiêu phù hợp với cơ địa của mình.</p>
    <div class="field"><input type="number" id="sleep-goal-input" value="${state.profile.sleepGoalHours||8}" min="4" max="12" step="0.5"></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-sleep-goal">Lưu mục tiêu</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-reset-sleep-goal">Đặt lại mặc định (8 giờ)</button>
  `);
  $("#btn-save-sleep-goal").addEventListener("click", ()=>{
    const v = Number($("#sleep-goal-input").value) || 8;
    state.profile.sleepGoalHours = v;
    saveState(); closeSheet(); renderSleepScreen();
    toast("Đã lưu mục tiêu giấc ngủ");
  });
  $("#btn-reset-sleep-goal").addEventListener("click", ()=>{
    confirmDialog("Đặt lại mục tiêu mặc định?", "Mục tiêu giấc ngủ sẽ quay về 8 giờ/đêm.", ()=>{
      state.profile.sleepGoalHours = 8;
      saveState(); closeSheet(); renderSleepScreen();
      toast("Đã đặt lại mục tiêu mặc định");
    });
  });
});

/* =========================================================================
   10. MÀN HÌNH NHẮC NHỞ
   ========================================================================= */
function ensureReminderDefaults(){
  DAY_KEYS.forEach(k=>{ if(!state.reminders.workout[k]) state.reminders.workout[k] = { enabled:false, time:"06:00" }; });
  MEAL_TYPES.forEach(m=>{ if(!state.reminders.meal[m.id]) state.reminders.meal[m.id] = { enabled:false, time:m.defaultTime }; });
}
function renderRemindersScreen(){
  ensureReminderDefaults();
  $("#master-toggle").classList.toggle("on", state.reminders.master);
  $("#notif-permission-note").textContent =
    (state.reminders.master && "Notification" in window && Notification.permission==="denied")
      ? "Trình duyệt đang chặn thông báo — hãy bật quyền thông báo cho trang này trong cài đặt trình duyệt."
      : "";

  $("#reminder-workout-list").innerHTML = DAY_KEYS.map(k=>{
    const r = state.reminders.workout[k];
    const day = getActivePlan().days[k];
    if(day.items.length===0) return "";
    return `<div class="link-row">
      <div class="left"><span class="material-symbols-rounded">event</span>
        <div><div class="name">${DAY_LABELS[k]} — ${day.title}</div><div class="sub" data-edit-time="workout:${k}" style="cursor:pointer;text-decoration:underline;">${r.time}</div></div>
      </div>
      <div class="toggle ${r.enabled?'on':''}" data-toggle="workout:${k}"></div>
    </div>`;
  }).join("");

  $("#reminder-meal-list").innerHTML = MEAL_TYPES.map(m=>{
    const r = state.reminders.meal[m.id];
    return `<div class="link-row">
      <div class="left"><span class="material-symbols-rounded">${m.icon}</span>
        <div><div class="name">${m.label}</div><div class="sub" data-edit-time="meal:${m.id}" style="cursor:pointer;text-decoration:underline;">${r.time}</div></div>
      </div>
      <div class="toggle ${r.enabled?'on':''}" data-toggle="meal:${m.id}"></div>
    </div>`;
  }).join("");

  $("#reminder-bedtime-label").textContent = state.reminders.bedtimeTime || "22:30";
  $("#toggle-bedtime").classList.toggle("on", state.reminders.bedtimeEnabled);

  $$("[data-toggle]").forEach(t=>{
    t.addEventListener("click", ()=>{
      const [type,key] = t.dataset.toggle.split(":");
      state.reminders[type][key].enabled = !state.reminders[type][key].enabled;
      saveState(); renderRemindersScreen();
    });
  });
  $$("#screen-reminders [data-edit-time]").forEach(t=>{
    t.addEventListener("click", ()=> openEditReminderTime(...t.dataset.editTime.split(":")));
  });
}
function defaultReminderTime(type, key){
  if(type==="workout") return "06:00";
  if(type==="meal") return (MEAL_TYPES.find(m=>m.id===key)||{}).defaultTime || "07:00";
  return "22:30";
}
function getReminderTime(type, key){
  if(type==="workout") return state.reminders.workout[key].time;
  if(type==="meal") return state.reminders.meal[key].time;
  return state.reminders.bedtimeTime;
}
function setReminderTime(type, key, v){
  if(type==="workout") state.reminders.workout[key].time = v;
  else if(type==="meal") state.reminders.meal[key].time = v;
  else state.reminders.bedtimeTime = v;
}
function openEditReminderTime(type, key){
  ensureReminderDefaults();
  const cur = getReminderTime(type, key);
  openSheet(`
    <h3 style="margin-bottom:14px;">Chọn giờ nhắc nhở</h3>
    <input type="time" id="time-picker" value="${cur}" style="background:var(--surface-2);border:1px solid var(--border-strong);border-radius:12px;padding:14px;color:#fff;width:100%;font-size:16px;">
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-time">Lưu</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-reset-time">Đặt lại giờ mặc định (${defaultReminderTime(type,key)})</button>
  `);
  $("#btn-save-time").addEventListener("click", ()=>{
    setReminderTime(type, key, $("#time-picker").value);
    saveState(); closeSheet(); renderRemindersScreen(); renderNutritionScreen();
    toast("Đã lưu giờ nhắc nhở");
  });
  $("#btn-reset-time").addEventListener("click", ()=>{
    confirmDialog("Đặt lại giờ mặc định?", `Giờ nhắc nhở sẽ quay về mặc định là ${defaultReminderTime(type,key)}.`, ()=>{
      setReminderTime(type, key, defaultReminderTime(type,key));
      saveState(); closeSheet(); renderRemindersScreen(); renderNutritionScreen();
      toast("Đã đặt lại giờ mặc định");
    });
  });
}
$("#master-toggle").addEventListener("click", async ()=>{
  state.reminders.master = !state.reminders.master;
  if(state.reminders.master && typeof nativeNotif!=="undefined" && nativeNotif.available()){
    await nativeNotif.requestPermission();
  } else if(state.reminders.master && "Notification" in window && Notification.permission==="default"){
    await Notification.requestPermission();
  }
  saveState(); renderRemindersScreen();
});
$("#toggle-bedtime").addEventListener("click", ()=>{
  state.reminders.bedtimeEnabled = !state.reminders.bedtimeEnabled;
  saveState(); renderRemindersScreen();
});

/* ---- Vòng lặp kiểm tra & bắn thông báo (hoạt động khi tab đang mở) ---- */
function checkReminders(){
  if(!state.reminders.master) return;
  const now = new Date();
  const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const minuteKey = `${todayStr()}_${hhmm}`;
  const fire = (title, body, uniqueKey)=>{
    const fireKey = `${minuteKey}_${uniqueKey}`;
    if(state._firedKeys[fireKey]) return;
    state._firedKeys[fireKey] = true;
    if("Notification" in window && Notification.permission==="granted"){
      try{ new Notification(title, { body, icon: undefined }); }catch(e){}
    }
    toast(body, "notifications_active");
    saveState();
  };
  const todayKey = todayDayKey();
  const wr = state.reminders.workout[todayKey];
  if(wr && wr.enabled && wr.time===hhmm){
    const day = getActivePlan().days[todayKey];
    fire("Đến giờ tập luyện!", `Hôm nay: ${day.title} — cùng FIT KIT chinh phục giới hạn!`, "workout");
  }
  MEAL_TYPES.forEach(m=>{
    const mr = state.reminders.meal[m.id];
    if(mr && mr.enabled && mr.time===hhmm) fire("Đến giờ ăn!", `Đừng quên ${m.label.toLowerCase()} và ghi lại vào nhật ký dinh dưỡng nhé.`, "meal_"+m.id);
  });
  if(state.reminders.bedtimeEnabled){
    const bedtime = state.reminders.bedtimeTime || "22:30";
    if(bedtime===hhmm) fire("Đến giờ ngủ!", "Tắt thiết bị điện tử và chuẩn bị cho một giấc ngủ chất lượng.", "bedtime");
  }
}
setInterval(checkReminders, 15000);

/* =========================================================================
   11. MÀN HÌNH HỒ SƠ
   ========================================================================= */
function renderProfileScreen(){
  const p = state.profile;
  $("#profile-avatar").src = p.avatarData || IMG.avatar;
  $("#profile-name").textContent = (p.name || "Vận Động Viên").toUpperCase();
  const total = state.finishedDates.length;
  const level = Math.floor(total/5)+1;
  const tierNames = ["Đồng","Bạc","Vàng","Bạch Kim","Kim Cương","Huyền Thoại"];
  const tier = tierNames[Math.min(tierNames.length-1, Math.floor(level/3))];
  $("#profile-badge").textContent = `HẠNG ${tier.toUpperCase()}`;
  $("#profile-sub").textContent = `Cấp độ ${level} · ${total} buổi tập đã hoàn thành`;

  $("#stat-weight").textContent = p.weight;
  const bmi = p.height ? fmt1(p.weight/((p.height/100)**2)) : "--";
  $("#stat-bmi").textContent = bmi;
  $("#stat-streak").textContent = calcStreak();

  $("#profile-bmr").textContent = `${p.bmr} kcal`;
  $("#profile-tdee").textContent = `${p.tdee} kcal`;
  const goalDef = GOALS.find(g=>g.id===p.goal);
  $("#profile-goal-label").textContent = goalDef ? goalDef.label : "--";
  $("#profile-goal-kcal").textContent = `${p.goalKcal} kcal`;
  $("#profile-targets-mode").textContent = p.autoTargets!==false
    ? "Đang dùng: tự động tính theo công thức khoa học."
    : "Đang dùng: mục tiêu tự chỉnh (bấm ⚙ để khôi phục công thức).";
}
$("#btn-edit-profile").addEventListener("click", ()=> openOnboarding(true));
$("#btn-edit-targets-profile").addEventListener("click", openEditNutritionTargets);
$("#profile-avatar").addEventListener("click", ()=>{
  const input = document.createElement("input");
  input.type = "file"; input.accept = "image/*";
  input.onchange = (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{ state.profile.avatarData = reader.result; saveState(); renderProfileScreen(); };
    reader.readAsDataURL(file);
  };
  input.click();
});
$("#btn-reset-app").addEventListener("click", ()=>{
  openSheet(`
    <div style="text-align:center;padding:10px 0;">
      <span class="material-symbols-rounded" style="font-size:44px;color:var(--warn);">warning</span>
      <h3 style="margin-top:10px;">Đặt lại toàn bộ dữ liệu?</h3>
      <p class="small-note" style="margin-top:6px;">Toàn bộ hồ sơ, nhật ký &amp; video sẽ bị xoá vĩnh viễn khỏi thiết bị này.</p>
      <div style="display:flex;gap:10px;margin-top:18px;">
        <button class="btn btn-outline btn-block" onclick="closeSheet()">Huỷ</button>
        <button class="btn btn-primary btn-block" id="btn-confirm-reset">Xoá hết</button>
      </div>
    </div>
  `);
  $("#btn-confirm-reset").addEventListener("click", async ()=>{
    localStorage.removeItem(STORAGE_KEY);
    indexedDB.deleteDatabase(DB_NAME);
    location.reload();
  });
});
$("#btn-open-plans").addEventListener("click", ()=> goto("plans"));
$("#btn-open-library").addEventListener("click", ()=> goto("library"));
$("#btn-open-progress").addEventListener("click", ()=> goto("progress"));

/* =========================================================================
   11b. ĐỒNG BỘ SAO LƯU LÊN GOOGLE DRIVE CÁ NHÂN
   (dùng Google Identity Services + Drive API v3, phạm vi 'drive.file' — app
   chỉ đọc/ghi được đúng 1 file backup do chính app tạo ra, không đụng tới
   các file khác trong Drive của người dùng)

   QUAN TRỌNG CHO CHỦ APP: điền Client ID bạn tự tạo (xem hướng dẫn trong
   openDriveSettings bên dưới) vào GOOGLE_DRIVE_CLIENT_ID rồi deploy lại.
   Sau đó MỌI người dùng tải app về chỉ cần bấm "Đăng nhập Google" bằng tài
   khoản của họ — không ai phải tự tạo Client ID riêng. Mỗi người đăng nhập
   bằng tài khoản nào thì dữ liệu tự sao lưu vào đúng Drive của người đó.

   Lưu ý: khi OAuth consent screen còn ở chế độ "Testing" (mặc định, miễn
   phí, không cần Google duyệt), chỉ tối đa 100 email được thêm sẵn vào mục
   "Test users" trong Google Cloud Console mới đăng nhập được. Muốn MỌI
   người dùng bất kỳ trên internet đều đăng nhập được mà không cần thêm tay
   từng email, cần đưa OAuth consent screen lên "Production" (Google sẽ yêu
   cầu bạn có trang chính sách bảo mật + duyệt hồ sơ, miễn phí nhưng mất
   vài ngày).
   ========================================================================= */
const GOOGLE_DRIVE_CLIENT_ID = ""; // ← Dán Client ID (dạng xxxx.apps.googleusercontent.com) vào đây, dùng chung cho mọi người dùng app
const DRIVE_BACKUP_NAME = "fitkit-backup.zip";
let driveTokenClient = null;
let driveAccessToken = null;
let driveTokenExpiry = 0;
let driveAuthPendingResolve = null;
let driveSyncBusy = false;
let driveDirty = false;

function driveIsSignedIn(){ return !!driveAccessToken && Date.now() < driveTokenExpiry; }
function getDriveClientId(){ return GOOGLE_DRIVE_CLIENT_ID || state.driveSettings.clientId || ""; }

function ensureDriveTokenClient(){
  const clientId = getDriveClientId();
  if(!clientId) throw new Error("Chưa cấu hình Google OAuth Client ID.");
  if(typeof google === "undefined" || !google.accounts || !google.accounts.oauth2){
    throw new Error("Chưa tải được thư viện đăng nhập Google — kiểm tra kết nối mạng rồi thử lại.");
  }
  if(!driveTokenClient || driveTokenClient._fitkitClientId !== clientId){
    driveTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp)=>{
        if(resp && resp.access_token){
          driveAccessToken = resp.access_token;
          driveTokenExpiry = Date.now() + ((resp.expires_in || 3600) * 1000) - 60000;
        }
        if(driveAuthPendingResolve){ const r = driveAuthPendingResolve; driveAuthPendingResolve = null; r(resp); }
      },
      error_callback: ()=>{
        if(driveAuthPendingResolve){ const r = driveAuthPendingResolve; driveAuthPendingResolve = null; r(null); }
      },
    });
    driveTokenClient._fitkitClientId = clientId;
  }
  return driveTokenClient;
}
function driveSignIn(){
  return new Promise((resolve)=>{
    try{
      const client = ensureDriveTokenClient();
      driveAuthPendingResolve = resolve;
      client.requestAccessToken({ prompt: driveIsSignedIn() ? "" : "consent" });
    }catch(e){ resolve(null); }
  });
}
async function driveEnsureToken(){
  if(driveIsSignedIn()) return driveAccessToken;
  const resp = await driveSignIn();
  if(!resp || !resp.access_token) throw new Error("Đăng nhập Google không thành công hoặc đã bị huỷ.");
  return driveAccessToken;
}

async function driveFindBackupFile(token){
  const q = encodeURIComponent(`name='${DRIVE_BACKUP_NAME}' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name,modifiedTime)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if(!res.ok) throw new Error(`Không tra được danh sách file trên Drive (mã lỗi ${res.status}).`);
  const data = await res.json();
  return (data.files && data.files[0]) || null;
}
async function driveUploadZip(token, blob, existingFileId){
  const metadata = { name: DRIVE_BACKUP_NAME, mimeType: "application/zip" };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", blob);
  const url = existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
  const res = await fetch(url, {
    method: existingFileId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if(!res.ok){ const t = await res.text().catch(()=>""); throw new Error(`Tải lên Drive lỗi ${res.status} — ${t.slice(0,200)}`); }
  return res.json();
}
async function driveDownloadFile(token, fileId){
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if(!res.ok) throw new Error(`Tải file từ Drive lỗi ${res.status}.`);
  return res.blob();
}

/* ---- Đóng gói / bung toàn bộ dữ liệu app thành 1 file .zip ---- */
async function buildBackupZip(){
  if(typeof JSZip === "undefined") throw new Error("Chưa tải được thư viện nén file — kiểm tra kết nối mạng rồi thử lại.");
  const zip = new JSZip();
  zip.file("state.json", JSON.stringify(state));
  const manifest = [];
  const clips = await dbGetAll(DB_STORE);
  clips.forEach(rec=>{
    manifest.push({ store:"clips", id:rec.id, name:rec.name, createdAt:rec.createdAt, mimeType:(rec.blob && rec.blob.type) || "video/mp4" });
    zip.file(`blobs/clips/${rec.id}`, rec.blob);
  });
  const photos = await dbGetAll(DB_STORE_PHOTOS);
  photos.forEach(rec=>{
    manifest.push({ store:"photos", id:rec.id, name:rec.name, createdAt:rec.createdAt, mimeType:(rec.blob && rec.blob.type) || "image/jpeg" });
    zip.file(`blobs/photos/${rec.id}`, rec.blob);
  });
  zip.file("db-manifest.json", JSON.stringify(manifest));
  return zip.generateAsync({ type:"blob", compression:"DEFLATE", compressionOptions:{ level:6 } });
}
async function restoreFromBackupZip(blob){
  if(typeof JSZip === "undefined") throw new Error("Chưa tải được thư viện nén file — kiểm tra kết nối mạng rồi thử lại.");
  const zip = await JSZip.loadAsync(blob);
  const stateFile = zip.file("state.json");
  if(!stateFile) throw new Error("File sao lưu không hợp lệ (thiếu state.json).");
  const parsedState = JSON.parse(await stateFile.async("string"));
  const manifestFile = zip.file("db-manifest.json");
  const manifest = manifestFile ? JSON.parse(await manifestFile.async("string")) : [];
  await dbClear(DB_STORE);
  await dbClear(DB_STORE_PHOTOS);
  for(const m of manifest){
    const f = zip.file(`blobs/${m.store}/${m.id}`);
    if(!f) continue;
    const arr = await f.async("arraybuffer");
    const blobRec = new Blob([arr], { type: m.mimeType });
    await dbPutRaw(m.store==="clips" ? DB_STORE : DB_STORE_PHOTOS, { id:m.id, name:m.name, blob:blobRec, createdAt:m.createdAt });
  }
  const merged = Object.assign(defaultState(), parsedState, {
    profile: Object.assign(defaultState().profile, parsedState.profile||{}),
    reminders: Object.assign(defaultState().reminders, parsedState.reminders||{}),
    aiSettings: Object.assign(defaultState().aiSettings, parsedState.aiSettings||{}),
    driveSettings: Object.assign(defaultState().driveSettings, parsedState.driveSettings||{}),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
}

async function driveBackupNow(showToast=true){
  if(driveSyncBusy) return;
  driveSyncBusy = true;
  try{
    const token = await driveEnsureToken();
    const zipBlob = await buildBackupZip();
    let fileId = state.driveSettings.fileId;
    if(!fileId){
      const existing = await driveFindBackupFile(token);
      if(existing) fileId = existing.id;
    }
    const result = await driveUploadZip(token, zipBlob, fileId);
    state.driveSettings.fileId = result.id || fileId || null;
    state.driveSettings.lastSyncAt = Date.now();
    driveDirty = false;
    saveState();
    if(showToast) toast("Đã sao lưu lên Google Drive");
  }catch(err){
    if(showToast) toast(`Sao lưu Drive lỗi: ${(err && err.message) || err}`, "error");
  }finally{
    driveSyncBusy = false;
  }
}
async function driveRestoreNow(){
  if(driveSyncBusy) return;
  driveSyncBusy = true;
  try{
    const token = await driveEnsureToken();
    let fileId = state.driveSettings.fileId;
    if(!fileId){
      const existing = await driveFindBackupFile(token);
      if(!existing) throw new Error("Chưa tìm thấy bản sao lưu nào trên Drive.");
      fileId = existing.id;
    }
    const blob = await driveDownloadFile(token, fileId);
    await restoreFromBackupZip(blob);
    toast("Đã khôi phục dữ liệu từ Google Drive — đang tải lại app...");
    setTimeout(()=> location.reload(), 1200);
  }catch(err){
    toast(`Khôi phục từ Drive lỗi: ${(err && err.message) || err}`, "error");
  }finally{
    driveSyncBusy = false;
  }
}
// Tự động kiểm tra định kỳ — chỉ âm thầm sao lưu khi đã đăng nhập sẵn (không tự bật popup đăng nhập)
setInterval(()=>{
  const s = state.driveSettings;
  if(driveDirty && s.autoSync && s.clientId && driveIsSignedIn()){
    driveBackupNow(false);
  }
}, 120000);

function openDriveSettings(){
  const s = state.driveSettings;
  const signedIn = driveIsSignedIn();
  const appConfigured = !!GOOGLE_DRIVE_CLIENT_ID; // true = chủ app đã cấu hình sẵn, người dùng cuối không cần biết Client ID là gì
  openSheet(`
    <div class="sheet-header"><h3>Đồng bộ Google Drive</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="color:var(--warn);">Dữ liệu (hồ sơ, nhật ký, video, ảnh...) sẽ được nén thành 1 file và lưu vào Google Drive CỦA RIÊNG BẠN — không qua máy chủ nào khác của FIT KIT.</p>
    ${appConfigured ? "" : `
    <div class="field" style="margin-top:12px;">
      <label>Google OAuth Client ID (dành cho chủ app cấu hình 1 lần)</label>
      <input type="text" id="drive-client-id" placeholder="xxxx.apps.googleusercontent.com" value="${s.clientId||""}">
    </div>
    <button class="btn btn-outline btn-block" style="margin-top:10px;" id="drive-save-clientid">Lưu Client ID</button>
    `}
    <div class="divider" style="margin:16px 0;"></div>
    <p class="small-note">Trạng thái: <b style="color:${signedIn?'var(--success)':'var(--text-muted)'};">${signedIn ? "Đã đăng nhập Google" : "Chưa đăng nhập"}</b>${s.lastSyncAt ? ` · Lần đồng bộ gần nhất: ${new Date(s.lastSyncAt).toLocaleString("vi-VN")}` : " · Chưa từng đồng bộ"}</p>
    <button class="btn btn-primary btn-block" style="margin-top:10px;" id="drive-signin">${signedIn ? "Đăng nhập lại" : "Đăng nhập Google"}</button>
    <div style="display:flex;gap:10px;margin-top:10px;">
      <button class="btn btn-outline btn-block" id="drive-backup-now">Sao lưu ngay</button>
      <button class="btn btn-outline btn-block" id="drive-restore-now">Khôi phục từ Drive</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;">
      <div><div style="font-weight:600;font-size:14px;">Tự động đồng bộ</div><p class="small-note">Tự sao lưu định kỳ khi có thay đổi và đang đăng nhập.</p></div>
      <div class="toggle ${s.autoSync?'on':''}" id="drive-autosync-toggle"></div>
    </div>
    ${appConfigured ? "" : `
    <p class="small-note" style="margin-top:16px;">Cách lấy Client ID (miễn phí, làm 1 lần cho cả app): vào <b>console.cloud.google.com</b> → tạo project mới → vào "APIs & Services" bật <b>Google Drive API</b> → vào "OAuth consent screen" chọn <b>External</b>, thêm email Google của những người sẽ dùng thử vào mục "Test users" (tối đa 100 email nếu chưa gửi Google duyệt) → vào "Credentials" tạo <b>OAuth client ID</b> loại <b>Web application</b>, thêm đúng domain đang chạy app (VD: https://ten-app.netlify.app) vào "Authorized JavaScript origins" → copy Client ID, dán vào hằng số <code>GOOGLE_DRIVE_CLIENT_ID</code> trong file app.js rồi deploy lại. Từ lúc đó, mọi người tải app về chỉ cần bấm "Đăng nhập Google" như bình thường, không ai phải nhập Client ID nữa.</p>`}
  `);
  if(!appConfigured){
    $("#drive-save-clientid").addEventListener("click", ()=>{
      s.clientId = $("#drive-client-id").value.trim();
      saveState();
      toast("Đã lưu Client ID (chỉ dùng để bạn tự thử trước khi gắn cứng vào code)");
      openDriveSettings();
    });
  }
  $("#drive-signin").addEventListener("click", async ()=>{
    if(!getDriveClientId()){ toast("Chưa cấu hình Google Client ID cho app này", "error"); return; }
    try{
      await driveEnsureToken();
      toast("Đăng nhập Google thành công");
    }catch(e){
      toast(`Đăng nhập thất bại: ${(e && e.message) || e}`, "error");
    }
    openDriveSettings();
  });
  $("#drive-backup-now").addEventListener("click", async ()=>{
    if(!getDriveClientId()){ toast("Chưa cấu hình Google Client ID cho app này", "error"); return; }
    toast("Đang sao lưu lên Drive...");
    await driveBackupNow();
    openDriveSettings();
  });
  $("#drive-restore-now").addEventListener("click", ()=>{
    if(!getDriveClientId()){ toast("Chưa cấu hình Google Client ID cho app này", "error"); return; }
    confirmDialog("Khôi phục từ Google Drive?", "Toàn bộ dữ liệu hiện tại trên máy này (hồ sơ, nhật ký, video, ảnh) sẽ bị THAY THẾ bằng bản sao lưu trên Drive. Hành động này không thể hoàn tác.", ()=>{
      driveRestoreNow();
    }, "Khôi phục", "cloud_download");
  });
  $("#drive-autosync-toggle").addEventListener("click", ()=>{
    s.autoSync = !s.autoSync;
    saveState();
    openDriveSettings();
  });
}
$("#btn-open-drive").addEventListener("click", ()=> openDriveSettings());

/* =========================================================================
   12. KHỞI TẠO
   ========================================================================= */
function renderAll(){
  if(typeof renderHomeScreen==="function") renderHomeScreen();
  renderWorkoutScreen();
  renderNutritionScreen();
  renderSleepScreen();
  renderRemindersScreen();
  renderProfileScreen();
}

function init(){
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }
  state.selectedDay = todayDayKey();
  ensureReminderDefaults();
  ensurePlans();
  if(!state.onboarded){
    openOnboarding(false);
  } else {
    recomputeProfile(); saveState();
    renderAll();
  }
}
// init() được gọi từ pt.js (appBoot) sau khi kiểm tra đăng nhập

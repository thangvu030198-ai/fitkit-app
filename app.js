/* =========================================================================
   TapEasy — Ứng dụng logic (SPA, lưu trữ cục bộ)
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
/* toast(): luôn escape đúng 1 lần (BUG-01). Một số module cũ gọi toast(esc(x)) → giải mã 5 thực thể HTML cơ bản
   trước rồi escape lại: hiển thị đúng chữ gốc thay vì "&amp;", vẫn không bao giờ chạy HTML. */
function toastPlain(s){
  return String(s == null ? "" : s).replace(/&(amp|lt|gt|quot|#39|#x27|#96);/g, (m, k)=> ({ amp:"&", lt:"<", gt:">", quot:'"', "#39":"'", "#x27":"'", "#96":"`" }[k]));
}
function toast(msg, icon="check_circle"){
  const el = $("#toast");
  el.innerHTML = `<span class="material-symbols-rounded">${escapeHtml(toastPlain(icon))}</span><span>${escapeHtml(toastPlain(msg))}</span>`;
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

const STORAGE_CORRUPT_KEY = STORAGE_KEY + "_corrupt";      // khai báo TRƯỚC loadState() (const không được dùng trước khi khai báo)
const FK_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
let state = loadState();

/* R3-CORE-01: dữ liệu lưu bị hỏng (JSON cụt do hết pin giữa lúc ghi, tiện ích dọn rác…) trước đây bị thay âm thầm bằng
   trạng thái trống rồi lần saveState() kế tiếp GHI ĐÈ mất hẳn. Nay giữ bản gốc ở key phụ (1 bản, ≤ 2 MB) để còn cứu được
   và báo người dùng 1 lần lúc khởi động (fkStorageNotice). Không đổi key chính. */
function fkKeepCorrupt(raw){
  loadState.corrupt = true;
  try{ if(typeof raw === "string" && raw.length <= 2000000) localStorage.setItem(STORAGE_CORRUPT_KEY, JSON.stringify({ at: Date.now(), raw })); }catch(e){}
}
function loadState(){
  let raw = null;
  try{ raw = localStorage.getItem(STORAGE_KEY); }
  catch(e){ loadState.blocked = true; return defaultState(); }      // Safari riêng tư / cookie bị chặn: localStorage ném SecurityError
  try{
    if(!raw) return defaultState();
    let parsed;
    try{ parsed = JSON.parse(raw); }catch(e){ fkKeepCorrupt(raw); return defaultState(); }
    if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)){ fkKeepCorrupt(raw); return defaultState(); }
    return normalizeState(Object.assign(defaultState(), parsed, {
      profile: Object.assign(defaultState().profile, parsed.profile||{}),
      reminders: Object.assign(defaultState().reminders, parsed.reminders||{}),
      aiSettings: Object.assign(defaultState().aiSettings, parsed.aiSettings||{}),
      driveSettings: Object.assign(defaultState().driveSettings, parsed.driveSettings||{}),
    }));
  }catch(e){ fkKeepCorrupt(raw); return defaultState(); }
}
/* R3-CORE-04: số đo hồ sơ sai kiểu / NaN / âm / phi lý (bản cũ, sao lưu, đồng bộ) → BMR/TDEE/macro ra NaN khắp app.
   Ép về số hữu hạn trong khoảng hợp lý; ngoài khoảng → giá trị mặc định. Không đụng trường khác của hồ sơ. */
function fkCleanNum(v, min, max, dflt){
  const n = typeof v === "number" ? v : (typeof v === "string" && v.trim() !== "" ? Number(v.trim().replace(",", ".")) : NaN);
  return Number.isFinite(n) && n >= min && n <= max ? n : dflt;
}
function fkSanitizeProfile(p){
  if(!p || typeof p !== "object") return p;
  p.age = Math.round(fkCleanNum(p.age, 5, 120, 25));
  p.height = fkCleanNum(p.height, 50, 260, 170);
  p.weight = fkCleanNum(p.weight, 15, 400, 65);
  p.bodyfat = p.bodyfat == null || p.bodyfat === "" ? null : fkCleanNum(p.bodyfat, 2, 75, null);
  if(p.gender !== "male" && p.gender !== "female") p.gender = "male";
  ["bmr","tdee","goalKcal","protein","carbs","fat"].forEach(k=>{ p[k] = fkCleanNum(p[k], 0, 20000, 0); });
  p.sleepGoalHours = fkCleanNum(p.sleepGoalHours, 4, 12, 8);
  if(p.waterTargetOverride != null) p.waterTargetOverride = fkCleanNum(p.waterTargetOverride, 0.5, 6, null);
  if(typeof p.name !== "string") p.name = p.name == null ? "" : String(p.name);
  if(p.name.length > 60) p.name = p.name.slice(0, 60);
  if(p.avatarData != null && !(typeof p.avatarData === "string" && /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(p.avatarData))) p.avatarData = null;
  return p;
}
/* QT-11: dữ liệu cũ / thiếu trường / sai kiểu (bản cũ, khôi phục sao lưu, đồng bộ) không được làm vỡ app.
   Chỉ VÁ chỗ hỏng (mảng/đối tượng mặc định) — không xoá dữ liệu hợp lệ, không đổi key. Gọi lại nhiều lần không đổi kết quả. */
function normalizeState(s){
  if(!s || typeof s !== "object") return s;
  const isObj = v=> !!v && typeof v === "object" && !Array.isArray(v);
  const keys = (typeof DAY_KEYS !== "undefined" && Array.isArray(DAY_KEYS)) ? DAY_KEYS : ["T2","T3","T4","T5","T6","T7","CN"];
  ["plans","workoutLog","foodLog","waterLog","sleepLog","_firedKeys"].forEach(k=>{ if(!isObj(s[k])) s[k] = {}; });
  ["setLog","setHist"].forEach(k=>{ if(s[k] != null && !isObj(s[k])) s[k] = {}; });
  ["videoLibrary","progressPhotos","inbodyLogs"].forEach(k=>{ if(!Array.isArray(s[k])) s[k] = []; });
  s.finishedDates = Array.isArray(s.finishedDates) ? s.finishedDates.filter(d=> typeof d === "string") : [];
  if(!isObj(s.profile)) s.profile = defaultState().profile;
  if(!isObj(s.reminders)) s.reminders = defaultState().reminders;
  if(!isObj(s.reminders.workout)) s.reminders.workout = {};
  if(!isObj(s.reminders.meal)) s.reminders.meal = {};
  /* R3-CORE-04 / R3-CORE-07: số đo hồ sơ + các trường số/chuỗi được chèn vào HTML (giờ nhắc, InBody, ảnh, video, nhật ký ăn,
     nhà cung cấp AI) phải đúng kiểu — bản sao lưu/dữ liệu cũ bị sửa tay không thể mang HTML vào app. */
  fkSanitizeProfile(s.profile);
  /* R3 (chuyển giao từ nutrition): lọc dòng nhật ký ăn hỏng (null/không phải object) — khôi phục Drive/đồng bộ cloud có thể mang vào */
  Object.keys(s.foodLog).forEach(d=>{ const day = s.foodLog[d]; if(!isObj(day)){ delete s.foodLog[d]; return; } Object.keys(day).forEach(m=>{ if(Array.isArray(day[m])) day[m] = day[m].filter(isObj); }); });
  const numOrNull = (v, min, max)=> v == null || v === "" ? null : fkCleanNum(v, min, max, null);
  ["workout","meal"].forEach(g=> Object.keys(s.reminders[g]).forEach(k=>{
    const r = s.reminders[g][k];
    if(!isObj(r)){ delete s.reminders[g][k]; return; }
    r.enabled = !!r.enabled;
    if(typeof r.time !== "string" || !FK_TIME_RE.test(r.time)) r.time = g === "workout" ? "06:00" : "07:00";
  }));
  if(typeof s.reminders.bedtimeTime !== "string" || !FK_TIME_RE.test(s.reminders.bedtimeTime)) s.reminders.bedtimeTime = "22:30";
  s.reminders.master = !!s.reminders.master; s.reminders.bedtimeEnabled = !!s.reminders.bedtimeEnabled;
  s.inbodyLogs = s.inbodyLogs.filter(isObj).map(l=>{
    l.id = String(l.id == null ? "" : l.id).replace(/[^\w-]/g, "").slice(0, 64) || ("ib" + Math.random().toString(36).slice(2, 10));
    l.ts = fkCleanNum(l.ts, 0, 8.64e15, Date.now());
    l.source = l.source === "ai" ? "ai" : "manual";
    l.weight = numOrNull(l.weight, 15, 400); l.bodyFatPct = numOrNull(l.bodyFatPct, 2, 75); l.muscleMassKg = numOrNull(l.muscleMassKg, 5, 150);
    l.bodyWaterPct = numOrNull(l.bodyWaterPct, 20, 85); l.visceralFat = numOrNull(l.visceralFat, 1, 60);
    l.note = typeof l.note === "string" ? l.note.slice(0, 300) : "";
    return l;
  });
  s.progressPhotos = s.progressPhotos.filter(p=> isObj(p) && Number.isFinite(Number(p.id))).map(p=>{
    p.id = Number(p.id); p.ts = fkCleanNum(p.ts, 0, 8.64e15, Date.now()); p.weightAtCapture = numOrNull(p.weightAtCapture, 15, 400);
    p.angle = String(p.angle == null ? "" : p.angle).replace(/[^\w-]/g, "").slice(0, 24);
    return p;
  });
  s.videoLibrary = s.videoLibrary.filter(m=> isObj(m) && Number.isFinite(Number(m.id))).map(m=>{
    m.id = Number(m.id); m.name = typeof m.name === "string" ? m.name.slice(0, 120) : "";
    m.category = String(m.category == null ? "" : m.category).replace(/[^\w-]/g, "").slice(0, 24);
    m.fit = m.fit === "cover" ? "cover" : "contain";
    return m;
  });
  if(isObj(s.aiSettings) && !["openai","gemini","grok"].includes(s.aiSettings.provider)) s.aiSettings.provider = "openai";
  s.finishedDates = Array.from(new Set(s.finishedDates.filter(d=> /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
  Object.keys(s.sleepLog).forEach(d=>{
    const l = s.sleepLog[d];
    if(!isObj(l) || !Number.isFinite(Number(l.hours)) || Number(l.hours) <= 0 || Number(l.hours) > 24){ delete s.sleepLog[d]; return; }
    l.hours = Number(l.hours); l.quality = fkCleanNum(l.quality, 1, 5, 3);
  });
  Object.keys(s.waterLog).forEach(d=>{ s.waterLog[d] = fkCleanNum(s.waterLog[d], 0, 30, 0); });
  fkPruneFired(s);
  Object.keys(s.workoutLog).forEach(d=>{
    const l = s.workoutLog[d];
    if(!isObj(l)){ delete s.workoutLog[d]; return; }
    if(!Array.isArray(l.completedExerciseIds)) l.completedExerciseIds = [];
  });
  Object.keys(s.plans).forEach(id=>{
    const pl = s.plans[id];
    if(!isObj(pl)){ delete s.plans[id]; return; }
    if(!isObj(pl.days)) pl.days = {};
    keys.forEach(k=>{
      const d = pl.days[k];
      if(!isObj(d)) pl.days[k] = blankDay();
      else d.items = Array.isArray(d.items) ? d.items.filter(isObj) : [];
    });
    if(typeof pl.name !== "string") pl.name = String(pl.name == null ? "Giáo án" : pl.name);
  });
  if(s.activePlanId != null && !s.plans[s.activePlanId]) s.activePlanId = null;
  if(isObj(s.setHist)) Object.keys(s.setHist).forEach(k=>{
    const h = s.setHist[k];
    if(!isObj(h)){ delete s.setHist[k]; return; }
    h.list = Array.isArray(h.list) ? h.list.filter(isObj) : [];
    h.list.forEach(e=>{ if(!Array.isArray(e.sets)) e.sets = []; if(typeof e.date !== "string") e.date = ""; });
    if(typeof h.name !== "string") h.name = String(h.name == null ? k : h.name);
  });
  if(isObj(s.setLog)) Object.keys(s.setLog).forEach(k=>{
    const l = s.setLog[k];
    if(!isObj(l)){ delete s.setLog[k]; return; }
    if(!Array.isArray(l.sets)) l.sets = [];
  });
  Object.keys(s.foodLog).forEach(d=>{
    const day = s.foodLog[d];
    if(!isObj(day)){ delete s.foodLog[d]; return; }
    Object.keys(day).forEach(m=>{
      if(!Array.isArray(day[m])){ day[m] = []; return; }
      day[m] = day[m].filter(isObj);
      day[m].forEach(it=>{ ["kcal","protein","carbs","fat","grams"].forEach(k=>{ if(it[k] != null && typeof it[k] !== "number") it[k] = fkCleanNum(it[k], 0, 100000, 0); else if(typeof it[k] === "number" && !Number.isFinite(it[k])) it[k] = 0; }); });   // R3-CORE-07
    });
  });
  return s;
}
/* R3-CORE-09: _firedKeys (chống bắn trùng thông báo) trước đây không bao giờ dọn → lớn dần mãi. Chỉ giữ khoá của hôm nay. */
function fkPruneFired(s){
  s = s || state; if(!s || !s._firedKeys || typeof s._firedKeys !== "object") return 0;
  const today = todayStr(); let n = 0;
  Object.keys(s._firedKeys).forEach(k=>{ if(k.slice(0, 10) !== today){ delete s._firedKeys[k]; n++; } });
  return n;
}
/* QC-11: localStorage đầy → không ném lỗi ra ngoài (trước đây bị nuốt âm thầm), trả false + báo người dùng 1 lần/15 giây.
   Module cần biết đã lưu thật chưa (cộng điểm, voucher…) kiểm giá trị trả về: if(saveState() === false) hoàn tác. */
/* R3-CORE-09: trước khi báo đầy → dọn phần không quan trọng (khoá thông báo cũ, bản JSON hỏng đã giữ) rồi thử lại 1 lần.
   Trình duyệt CHẶN lưu trữ (Safari riêng tư, tắt cookie → SecurityError) báo câu khác với "đầy bộ nhớ". */
function saveState(){
  let err = null;
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){ err = e; }
  if(err){
    try{
      fkPruneFired(state);
      try{ localStorage.removeItem(STORAGE_CORRUPT_KEY); }catch(_){}
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      err = null;
    }catch(e2){ err = e2; }
  }
  if(err){
    const e = err;
    const now = Date.now();
    const blocked = !!(e && (e.name === "SecurityError" || e.code === 18)) || loadState.blocked === true;
    if(!saveState._warnAt || now - saveState._warnAt > 15000){
      saveState._warnAt = now;
      try{ toast(blocked ? "Trình duyệt đang chặn lưu dữ liệu (chế độ riêng tư / tắt cookie) — thay đổi sẽ mất khi đóng app. Hãy mở bằng tab thường hoặc cài app."
        : "Bộ nhớ máy đầy — chưa lưu được thay đổi. Xoá bớt video/ảnh hoặc sao lưu rồi dọn dữ liệu.", "error"); }catch(_){}
    }
    try{ console.warn("[saveState]", e && e.name); }catch(_){}
    saveState.lastError = (e && e.name) || "Error";
    return false;
  }
  saveState.lastError = null;
  if(typeof driveDirty !== "undefined") driveDirty = true;
  return true;
}

/* ---------------------------------------------------------------------
   2. TÍNH TOÁN KHOA HỌC: BMR / TDEE / MACRO
   --------------------------------------------------------------------- */
function calcBMR(p){
  // Mifflin-St Jeor Equation (1990)
  // R3-CORE-04: đầu vào sai kiểu / NaN / âm → dùng giá trị mặc định thay vì trả NaN hay BMR âm
  p = p || {};
  p = { gender: p.gender, weight: fkCleanNum(p.weight, 15, 400, 65), height: fkCleanNum(p.height, 50, 260, 170), age: fkCleanNum(p.age, 5, 120, 25) };
  const base = 10*p.weight + 6.25*p.height - 5*p.age;
  return Math.max(0, Math.round(p.gender === "male" ? base + 5 : base - 161));
}
function calcTDEE(bmr, activityId){
  const level = ACTIVITY_LEVELS.find(a=>a.id===activityId) || ACTIVITY_LEVELS[2];
  return Math.round((Number(bmr) || 0) * level.factor);
}
function calcGoalKcal(tdee, goalId){
  const goal = GOALS.find(g=>g.id===goalId) || GOALS[1];
  return Math.round((Number(tdee) || 0) * (1 + goal.kcalAdjust));
}
/* QN-08: g đạm/kg theo mục tiêu + mức vận động (ISSN 2017, Morton 2018; PROT-AGE ≥ 60 tuổi ≥ 1,2) thay vì 2 g/kg cho mọi người.
   Giảm mỡ / tăng cơ có vận động: 2,0 · ít vận động: 1,6 · duy trì: 1,2 (ít vận động) – 1,4 – 1,6 (vận động nhiều). */
function proteinPerKg(p){
  p = p || {};
  const act = p.activity || "moderate", goal = p.goal || "gain", age = Number(p.age) || 0;
  const sedentary = act === "sedentary", hard = act === "active" || act === "veryActive";
  let g = goal === "maintain" ? (sedentary ? 1.2 : hard ? 1.6 : 1.4) : (sedentary ? 1.6 : 2.0);
  if(age >= 60) g = Math.max(g, 1.2);
  return g;
}
function calcMacros(weight, goalKcal, prof){
  // g/kg theo cân nặng điều chỉnh: người thừa cân tính theo ~BMI 25, trần 180 g và ≤ 35 % năng lượng (AMDR 10–35 %)
  const p = prof || state.profile || {};
  weight = fkCleanNum(weight, 15, 400, 65); goalKcal = fkCleanNum(goalKcal, 0, 20000, 0);   // R3-CORE-04
  const h = (Number(p.height) || 0)/100;
  const ref = h ? Math.min(weight, 25*h*h) : weight;
  const capAmdr = goalKcal > 0 ? Math.floor(0.35 * goalKcal / 4) : 180;
  const protein = Math.max(0, Math.min(180, capAmdr, Math.round(ref * proteinPerKg(p))));
  const fatKcal = goalKcal * 0.25;                         // 25% tổng năng lượng
  const fat = Math.round(fatKcal / 9);
  const proteinKcal = protein * 4;
  const carbs = Math.max(0, Math.round((goalKcal - proteinKcal - fatKcal) / 4));
  return { protein, carbs, fat };
}
/* QN-24: 9–17 tuổi dùng EER của IOM 2005 (gồm năng lượng tăng trưởng 25 kcal) thay cho Mifflin × PAL của người lớn */
function calcEER(p){
  const male = p.gender === "male", age = Number(p.age) || 16, w = Number(p.weight) || 0, hm = (Number(p.height) || 0)/100;
  const PA = male ? { sedentary:1.0, light:1.13, moderate:1.26, active:1.42, veryActive:1.42 }
                  : { sedentary:1.0, light:1.16, moderate:1.31, active:1.56, veryActive:1.56 };
  const pa = PA[p.activity] || PA.moderate;
  return Math.round(male ? 88.5 - 61.9*age + pa*(26.7*w + 903*hm) + 25 : 135.3 - 30.8*age + pa*(10*w + 934*hm) + 25);
}
function recomputeProfile(){
  const p = fkSanitizeProfile(state.profile);   // R3-CORE-04
  /* Sàn calo an toàn: nữ ≥1.200, nam ≥1.500 kcal và không dưới BMR */
  p.bmr = calcBMR(p);
  const age = Number(p.age) || 0;
  p.tdee = age >= 9 && age < 18 && Number(p.height) > 0 && Number(p.weight) > 0 ? calcEER(p) : calcTDEE(p.bmr, p.activity);
  if(p.autoTargets !== false){
    const hh = (p.height||0)/100, bmi = hh ? p.weight/(hh*hh) : 22;
    p.goalBlocked = p.goal==="lose" && (bmi < 18.5 || (p.age && p.age < 18));   // không cho thâm hụt khi thiếu cân / dưới 18 tuổi
    let kcal = calcGoalKcal(p.tdee, p.goalBlocked ? "maintain" : p.goal);
    // QN-10: < 18 tuổi "tăng cơ" — EER (IOM) đã gồm năng lượng tăng trưởng → chỉ dư tối đa +5 % (không +12 % như người lớn)
    if(p.goal === "gain" && age > 0 && age < 18) kcal = Math.round(p.tdee * 1.05);
    // QN-27: sát ngưỡng thiếu cân (BMI < 19,5) → thâm hụt tối đa 10 % để không tụt xuống BMI < 18,5
    p.goalCapped = p.goal==="lose" && !p.goalBlocked && bmi < 19.5;
    if(p.goalCapped) kcal = Math.max(kcal, Math.round(p.tdee * 0.9));
    p.goalKcal = Math.max(kcal, p.gender==="male" ? 1500 : 1200, p.bmr||0);
    const m = calcMacros(p.weight, p.goalKcal, p);
    p.protein = m.protein; p.carbs = m.carbs; p.fat = m.fat;
  }
  const goalDef = GOALS.find(g=>g.id===p.goal);
  p.program = goalDef ? goalDef.program : "tang-co";
}

/* ---------------------------------------------------------------------
   1b. HỘP THOẠI XÁC NHẬN DÙNG CHUNG (đặc biệt cho các nút "Khôi phục mặc định")
   --------------------------------------------------------------------- */
/* QS-22 / QS-01: HTML "an toàn theo mặc định" cho hộp thoại dùng chung.
   Chỉ giữ thẻ định dạng cơ bản (b, strong, i, em, u, br, small, span, p, ul, ol, li, code, div), bỏ mọi thuộc tính trừ class
   (và style không chứa url()/expression). Mọi thứ khác (img, svg, a, script, on*=…) bị escape thành chữ; thực thể đã escape
   sẵn (&amp;, &lt;…) được giữ nguyên → caller cũ tự esc() vẫn hiển thị đúng 1 lần. */
const FK_SAFE_TAGS = /^(b|strong|i|em|u|br|small|span|p|ul|ol|li|code|div)$/;
function fkSafeHtml(s){
  s = String(s == null ? "" : s);
  const escText = t=> t.replace(/&(?!(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const re = /<(\/?)([a-z][a-z0-9]*)((?:\s+[a-z-]+(?:\s*=\s*(?:"[^"<>]*"|'[^'<>]*'))?)*)\s*\/?>/gi;
  let out = "", last = 0, m;
  while((m = re.exec(s))){
    out += escText(s.slice(last, m.index)); last = re.lastIndex;
    const tag = m[2].toLowerCase();
    if(!FK_SAFE_TAGS.test(tag)){ out += escText(m[0]); continue; }
    if(m[1]){ out += `</${tag}>`; continue; }
    let attrs = "", a;
    const ar = /\s+(class|style)\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)')/gi;
    while((a = ar.exec(m[3] || ""))){
      const v = a[2] != null ? a[2] : a[3];
      if(a[1].toLowerCase() === "style" && /url\s*\(|expression|javascript:|@import|behavior/i.test(v)) continue;
      attrs += ` ${a[1].toLowerCase()}="${v.replace(/"/g, "&quot;")}"`;
    }
    out += `<${tag}${attrs}>`;
  }
  return out + escText(s.slice(last));
}
/* confirmDialog(title, message, onConfirm, confirmLabel, icon, opts)
   opts.text = true → message là CHỮ THUẦN (escape toàn bộ — dùng cho mọi chuỗi có dữ liệu người dùng/đám mây).
   Mặc định vẫn nhận định dạng cơ bản nhưng đã lọc qua fkSafeHtml (không còn chạy được HTML/JS). */
function confirmDialog(title, message, onConfirm, confirmLabel, icon, opts){
  opts = opts || {};
  const msg = opts.text ? escapeHtml(toastPlain(message)) : fkSafeHtml(message);
  const ic = String(icon || "restart_alt").replace(/[^a-z0-9_]/gi, "") || "restart_alt";
  openSheet(`
    <div style="text-align:center;padding:10px 0;">
      <span class="material-symbols-rounded" style="font-size:44px;color:var(--warn);">${ic}</span>
      <h3 style="margin-top:10px;">${opts.text ? escapeHtml(toastPlain(title)) : fkSafeHtml(title)}</h3>
      <p class="small-note" style="margin-top:6px;">${msg}</p>
      <div style="display:flex;gap:10px;margin-top:18px;">
        <button class="btn btn-outline btn-block" id="cd-cancel">Huỷ</button>
        <button class="btn btn-primary btn-block" id="cd-confirm">${fkSafeHtml(confirmLabel || "Khôi phục mặc định")}</button>
      </div>
    </div>
  `);
  $("#cd-cancel").addEventListener("click", ()=> closeSheet());
  /* integrator (FIX-commerce vòng 2 #4): onConfirm trả Promise → giữ tấm (nút khoá, "Đang xử lý…") tới khi xong; lỗi → mở lại nút, tấm vẫn mở
     (bên gọi tự báo lỗi). Callback mở tấm khác trong lúc chờ → không đóng tấm mới. onConfirm đồng bộ → như cũ (gọi rồi đóng). */
  $("#cd-confirm").addEventListener("click", ()=>{
    const btn = $("#cd-confirm");
    let r; try{ r = onConfirm(); }catch(e){ closeSheet(); throw e; }
    if(!r || typeof r.then !== "function"){ closeSheet(); return; }
    const label = btn ? btn.innerHTML : "";
    if(btn){ btn.disabled = true; btn.textContent = "Đang xử lý…"; }        // "Huỷ" vẫn bấm được (đóng tấm, việc nền vẫn chạy)
    const still = ()=> !!btn && btn.isConnected !== false && document.getElementById("cd-confirm") === btn;
    Promise.resolve(r).then(()=>{ if(still()) closeSheet(); }, ()=>{ if(still()){ btn.disabled = false; btn.innerHTML = label; } });
  });
}

/* ---------------------------------------------------------------------
   2b. CHƯƠNG TRÌNH TẬP CÁ NHÂN HÓA (plans)
   --------------------------------------------------------------------- */
/* BUG-13: bộ đếm + chuỗi ngẫu nhiên dài → không trùng kể cả khi tạo nhiều bài trong cùng 1 mili-giây */
let _uidSeq = 0;
function uid(){ _uidSeq = (_uidSeq + 1) % 1679616; return `u${Date.now().toString(36)}${_uidSeq.toString(36).padStart(4,"0")}${Math.random().toString(36).slice(2,8)}`; }

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
/* QT-05: giáo án mặc định theo cấp độ / giới tính / sàng lọc — người mới không bị gán giáo án "elite" 6 buổi.
   Mới tập (hoặc ≥ 60 / < 18 tuổi, đang mang thai/sau sinh, có chấn thương, bị ẩn bài cường độ rất cao) → Full Body 3 buổi;
   trung bình → Upper/Lower (nam) · Glute Upper/Lower (nữ); nâng cao → giữ chương trình theo mục tiêu như trước. */
function fkDefaultTemplate(p, f){
  if(typeof PROGRAM_TEMPLATES === "undefined" || !Array.isArray(PROGRAM_TEMPLATES)) return null;
  p = p || {}; f = f || {};
  const age = Number(p.age) || 0;
  let lv = ["beginner","intermediate","advanced"].includes(p.level) ? p.level : "beginner";
  if(age >= 60 || (age && age < 18) || f.preg || f.post || f.hideNow || f.supervised || (Array.isArray(f.injuries) && f.injuries.length)) lv = "beginner";
  const g = p.gender === "female" ? "nu" : "nam";
  const days = Number(p.daysPerWeek) || 0;                    // 13/11: số buổi/tuần + nơi tập (onboarding) — chưa khai → giữ cách chọn cũ
  const home = p.equipment === "home" || p.equipment === "none";
  if(home){                                                   // không có phòng gym → giáo án tối thiểu dụng cụ (nữ tập được 5 buổi → bản tại nhà 5 buổi)
    const ids = g === "nu" && days >= 5 && lv === "beginner" ? ["tpl-f-home","tpl-u-home"] : ["tpl-u-home"];
    for(const id of ids){ const t = PROGRAM_TEMPLATES.find(x=> x && x.id === id); if(t) return t; }
  }
  if(lv === "advanced"){
    if(days && days <= 4){ const t = PROGRAM_TEMPLATES.find(x=> x && x.id === (g === "nu" ? "tpl-f-pb" : "tpl-m-pb")); if(t) return t; }
    return null;
  }
  if(lv === "intermediate" && days && days <= 3) lv = "beginner";   // chỉ tập được ≤ 3 buổi → Full Body 3 buổi hợp hơn Upper/Lower 4 buổi
  const order = lv === "beginner" ? (g === "nu" ? ["tpl-f-fb","tpl-u-home"] : ["tpl-m-fb","tpl-u-home"])
                                  : (g === "nu" ? ["tpl-f-glute","tpl-f-fb"] : ["tpl-m-ul","tpl-m-fb"]);
  for(const id of order){ const t = PROGRAM_TEMPLATES.find(x=> x && x.id === id); if(t) return t; }
  return PROGRAM_TEMPLATES.find(t=> t && t.level === lv && (t.gender === g || t.gender === "chung")) || null;
}
function fkApplyDefaultPlan(){
  try{
    let f = null; try{ f = window.FKHealth && typeof FKHealth.current === "function" ? FKHealth.current() : null; }catch(e){}
    const t = fkDefaultTemplate(state.profile, f);
    if(!t || typeof tplToPlan !== "function") return null;
    const exist = Object.values(state.plans || {}).find(pl=> pl && pl.autoDefault && pl.fromTemplate === t.id);
    const plan = exist || tplToPlan(t);
    plan.autoDefault = true; plan.startedAt = plan.startedAt || todayStr();
    state.plans[plan.id] = plan; state.activePlanId = plan.id; state.selectedDay = todayDayKey();
    saveState();
    try{ if(!exist && typeof fkTrack === "function") fkTrack("plan_created", { source: state.onboarded ? "default_template" : "onboarding", template_id: t.id }); }catch(e){}
    if(!exist && typeof tplAttachVideos === "function"){ Promise.resolve().then(()=> tplAttachVideos(plan)).then(()=> saveState()).catch(()=>{}); }
    return plan;
  }catch(e){ try{ console.warn("[plan] default", e); }catch(_){} return null; }
}
/* Ngày bắt đầu dùng app (QU-20 / QT-20): không chấm "bỏ lỡ" / không tính chỉ tiêu cho những ngày trước đó.
   Người dùng cũ chưa có startDate → ngày sớm nhất có dữ liệu tập, nếu không có thì hôm nay. */
function fkStartDate(){
  if(typeof state.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(state.startDate)) return state.startDate;
  const ds = [].concat(state.finishedDates || [], Object.keys(state.workoutLog || {})).filter(d=> /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  state.startDate = ds[0] || todayStr();
  return state.startDate;
}
/* Ngày bắt đầu của giáo án đang dùng (giáo án mới chọn giữa tuần không bị tính bỏ lỡ các ngày trước) */
function fkPlanStartDate(){
  const s = fkStartDate(), pl = getActivePlan(), ps = pl && typeof pl.startedAt === "string" ? pl.startedAt : "";
  return ps > s ? ps : s;
}
function getActivePlan(){ return state.plans[state.activePlanId]; }
/* R3-CORE-05: giới hạn đầu vào giáo án (gõ tay / nhập từ PT, cộng đồng, sao lưu). Số hiệp 1–20 (gõ 100000 từng làm màn buổi tập
   dựng 100.000 hàng → treo máy), nghỉ 0–900 giây, thời lượng 0–600 phút, chuỗi số lần ≤ 24 ký tự, tên ≤ 60 ký tự. */
const FK_MAX_SETS = 20, FK_MAX_REST = 900, FK_MAX_NAME = 60;
function fkClampSets(v, dflt){ const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(FK_MAX_SETS, n) : (dflt != null ? dflt : 3); }
function fkClampRest(v, dflt){ const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && String(v).trim() !== "" ? Math.min(FK_MAX_REST, n) : (dflt != null ? dflt : 60); }
function fkCleanReps(v, dflt){ const t = String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 24); return t || (dflt != null ? dflt : "12"); }
function fkCleanName(v, dflt){ const t = String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, FK_MAX_NAME); return t || (dflt || ""); }
function blankDay(){ return { title:"Chưa đặt tên", intensity:"Vừa", duration: 30, items: [] }; }
function createBlankPlan(name){
  const id = "plan_"+uid();
  const days = {};
  DAY_KEYS.forEach(k=> days[k] = blankDay());
  const plan = { id, name: fkCleanName(name, "Giáo án mới"), tagline: "Giáo án cá nhân hoá", builtin:false, days };
  state.plans[id] = plan;
  saveState();
  try{ if(typeof fkTrack === "function") fkTrack("plan_created", { source: "blank" }); }catch(e){}
  return plan;
}
function duplicatePlan(planId){
  const src = fkEnsurePlanDays(state.plans[planId]);
  if(!src) return null;
  const id = "plan_"+uid();
  const days = {};
  DAY_KEYS.forEach(k=>{
    days[k] = { title: src.days[k].title, intensity: src.days[k].intensity, duration: src.days[k].duration,
      items: src.days[k].items.map(it=> Object.assign({}, it, { uid: it.exerciseId ? it.exerciseId+"_"+uid() : uid() })) };
  });
  const plan = { id, name: fkCleanName(String(src.name || "Giáo án").slice(0, FK_MAX_NAME - 10) + " (bản sao)"), tagline: src.tagline, builtin:false, days };
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
/* R3-CORE-15: dùng lại 1 kết nối IndexedDB (trước đây mỗi lần đọc/ghi mở 1 kết nối mới và không bao giờ đóng).
   IndexedDB không có / bị chặn (một số chế độ riêng tư) → Promise bị từ chối với thông báo tiếng Việt, nơi gọi tự xử lý. */
let _dbPromise = null;
function openDB(){
  if(_dbPromise) return _dbPromise;
  const p = fkOpenDBRaw().then(db=>{
    try{ db.onversionchange = ()=>{ try{ db.close(); }catch(e){} if(_dbPromise === p) _dbPromise = null; }; db.onclose = ()=>{ if(_dbPromise === p) _dbPromise = null; }; }catch(e){}
    return db;
  });
  _dbPromise = p;
  p.catch(()=>{ if(_dbPromise === p) _dbPromise = null; });
  return p;
}
/* R3-CORE-08: 1 URL blob cho mỗi video/ảnh (dùng lại giữa các lần vẽ) — trước đây mỗi lần vẽ lại màn Tập luyện / Giáo án / Tiến độ
   tạo URL mới cho MỌI video, ảnh và không thu hồi → rò bộ nhớ (video hàng chục MB). Xoá clip/ảnh thì thu hồi URL. */
const _fkBlobUrls = new Map();
async function fkBlobUrl(kind, id){
  const key = kind + ":" + id;
  if(_fkBlobUrls.has(key)) return _fkBlobUrls.get(key);
  let rec = null;
  try{ rec = kind === "photo" ? await dbGetPhoto(id) : await dbGetClip(id); }catch(e){ return null; }
  if(!rec || !rec.blob) return null;
  if(_fkBlobUrls.has(key)) return _fkBlobUrls.get(key);
  let u = null; try{ u = URL.createObjectURL(rec.blob); }catch(e){ return null; }
  _fkBlobUrls.set(key, u);
  return u;
}
function fkBlobUrlDrop(kind, id){
  const key = kind + ":" + id, u = _fkBlobUrls.get(key);
  if(u){ try{ URL.revokeObjectURL(u); }catch(e){} _fkBlobUrls.delete(key); }
}
function fkOpenDBRaw(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB === "undefined" || !indexedDB){ reject(new Error("Trình duyệt này không cho lưu video/ảnh trên máy (IndexedDB bị tắt).")); return; }
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
      if(!db.objectStoreNames.contains(DB_STORE_PHOTOS)) db.createObjectStore(DB_STORE_PHOTOS, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("Kho video/ảnh đang bị một tab TapEasy khác giữ — đóng tab đó rồi thử lại."));
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
const SUB_SCREENS = ["library","plans","progress","client","ptprofile","exlib"];
function goto(screen){
  let sc = $(`#screen-${screen}`);
  if(!sc){ screen = "home"; sc = $("#screen-home"); if(!sc) return; }   // R3-CORE-15: màn không tồn tại (liên kết cũ / module chưa nạp) → về Trang chủ thay vì ném lỗi
  /* QU-07: bỏ `void sc.offsetWidth` (ép layout đồng bộ ~0,9 s lúc khởi động ở CPU 4×).
     Màn vừa chuyển từ ẩn (display:none) sang hiện thì CSS animation tự chạy lại khi gắn lớp "enter";
     bấm lại đúng màn đang mở → không chạy lại hiệu ứng vào màn (tránh nháy). */
  const was = !!(sc && sc.classList.contains("active") && sc._fkShown);
  $$(".screen").forEach(s=>{ if(s !== sc) s.classList.remove("active"); });
  sc.classList.add("active"); sc._fkShown = true;
  if(!was){
    sc.classList.add("enter");
    clearTimeout(sc._enterT); sc._enterT = setTimeout(()=> sc.classList.remove("enter"), 2400);
  }
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
  if(screen==="exlib" && typeof renderExLib==="function") renderExLib();
  if(screen==="sleep") renderSleepScreen();
  if(screen==="reminders") renderRemindersScreen();
  if(screen==="profile") renderProfileScreen();   // QU-02/03: màn được vẽ lười khi vào (renderAll không vẽ trước màn ẩn)
  $("#app-scroll").scrollTo(0,0);
}
$$("[data-goto]").forEach(el=> el.addEventListener("click", ()=> goto(el.dataset.goto)));
$$("[data-back]").forEach(el=> el.addEventListener("click", ()=> goto(el.dataset.back)));
/* QU-18 (vòng 2): menu ☰ ≤ 12 mục hiện sẵn (GLOSSARY §8.1) + ô "Tìm trong TapEasy".
   - Bỏ mục trùng thanh dưới (Trang chủ, Hồ sơ, Lịch tuần, Thực đơn, PT) và gộp "Giáo án" (Lịch tuần · Giáo án mẫu ·
     Tạo giáo án riêng · Giáo án của tôi → màn Giáo án), "Sự kiện" (Thi đua + Gặp mặt/vé → màn Sự kiện có tab).
   - Mục bị gộp KHÔNG mất: giữ thành "lối tắt ẩn" (class te-mdeep, hidden) — ô tìm hiện ra khi gõ (vd "video", "đi chợ").
   - Giữ nguyên các mốc mà module dựa vào: dòng `goto('sleep')` đúng chuỗi (kb.js chèn trước), chuỗi `goto('reminders');closeSheet();`
     (events/admin/kb nhận diện menu), dòng có `goto('coach')` (community/findpt chèn sau). */
const TE_MENU_DEEP = ` te-mdeep" hidden style="display:none`;   // ghép vào class="link-row…" → dòng lối tắt ẩn (style.css không có [hidden] chung)
/* label / sub / kw = CHỮ THUẦN (escape ở đây); onclick + icon = hằng số trong mã (không bao giờ từ dữ liệu người dùng) */
function teMenuRowHTML(onclick, icon, label, sub, kw, deep){
  return `<div class="link-row${deep ? TE_MENU_DEEP : ""}" onclick="${onclick}"${kw ? ` data-kw="${escapeHtml(kw)}"` : ""}><div class="left"><span class="material-symbols-rounded">${escapeHtml(icon)}</span><div><div class="name">${escapeHtml(label)}</div>${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ""}</div></div><span class="material-symbols-rounded">chevron_right</span></div>`;
}
function openMainMenu(){
  const hasShop = typeof NutriPro==="object" && NutriPro && NutriPro.ui && typeof NutriPro.ui.openShoppingList==="function";
  const hasPB = typeof openProgramBuilder==="function";
  const hasAch = typeof FKAch==="object" && FKAch && FKAch.open;
  const hasHS = typeof openHealthSafety==="function";
  const R = teMenuRowHTML;
  openSheet(`
    <div class="sheet-header"><h3 class="tp-logo brand-swap" aria-label="TapEasy"><img class="brand-wm on-dark" src="assets/brand/logo-wordmark-light.svg" alt="TapEasy" data-no-fallback onerror="this.onerror=null;this.outerHTML='<span class=&quot;brand-text&quot;>Tap<b>Easy</b></span>'"><img class="brand-wm on-light" src="assets/brand/logo-wordmark-dark.svg" alt="" aria-hidden="true" data-no-fallback onerror="this.onerror=null;this.remove()"></h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <label class="search-box te-menu-q" role="search" style="margin-bottom:10px;"><span class="material-symbols-rounded" aria-hidden="true">search</span><input id="te-menu-q" type="search" placeholder="Tìm trong TapEasy" aria-label="Tìm trong TapEasy" autocomplete="off" enterkeyhint="search" spellcheck="false"></label>
    <div class="te-menu-list" data-te-menu style="display:flex;flex-direction:column;gap:4px;">
      ${R("goto('plans');closeSheet();", "edit_calendar", "Giáo án", "Lịch tuần · Giáo án mẫu · Tạo giáo án riêng", "giao an chuong trinh quan ly chuong trinh tap lich tap tuan nay giao an cua toi")}
      ${R("openExLib();closeSheet();", "library_books", "Thư viện bài tập", "Theo nhóm cơ · hướng dẫn · video", "thu vien bai tap nhom co dong tac")}
      ${R("goto('progress');closeSheet();", "insights", "Tiến độ", "Kỷ lục · Số đo InBody · Ảnh tiến độ", "tien do tien trinh anh tien trinh inbody so do ky luc pr 1rm can nang")}
      ${hasAch ? R("closeSheet();FKAch.open();", "military_tech", "Thành tích & huy hiệu", "", "thanh tich huy hieu xp cap do chuoi ngay") : ""}
      ${R("goto('workout');closeSheet();", "fitness_center", "Lịch tuần", "Buổi hôm nay · tập luyện", "lich tuan lich tap tuan nay buoi hom nay tap luyen", true)}
      ${R("openTemplateBrowser();", "school", "Giáo án mẫu", "Nam / Nữ theo cấp độ", "giao an mau nam nu cap do", true)}
      ${hasPB ? R("closeSheet();openProgramBuilder();", "pb_spark", "Tạo giáo án riêng", "", "tao giao an rieng tu dong ai soan", true) : ""}
      ${R("goto('library');closeSheet();", "video_library", "Kho video của tôi", "", "kho video cua toi video tai len", true)}
      <div class="link-row" onclick="goto('sleep');closeSheet();"><div class="left"><span class="material-symbols-rounded">bedtime</span><div class="name">Giấc ngủ</div></div><span class="material-symbols-rounded">chevron_right</span></div>
      ${hasHS ? R("closeSheet();openHealthSafety();", "health_and_safety", "Sức khoẻ & an toàn", "", "suc khoe an toan sang loc benh ly chan thuong") : ""}
      ${R("goto('reminders');closeSheet();", "notifications_active", "Nhắc nhở", "", "nhac nho thong bao bao thuc gio tap gio an")}
      ${R("goto('nutrition');closeSheet();", "restaurant", "Thực đơn & nhật ký ăn", "Dinh dưỡng", "thuc don nhat ky an dinh duong calo mon an", true)}
      ${hasShop ? R("closeSheet();NutriPro.ui.openShoppingList();", "shopping_cart", "Đi chợ tuần", "", "di cho tuan mua sam thuc pham danh sach", true) : ""}
      ${R("goto('coach');closeSheet();", "groups", "PT", "Học viên · PT của tôi", "pt huan luyen vien hoc vien pt cua toi ket noi pt tapeasy pt", true)}
      ${R("goto('home');closeSheet();", "home", "Trang chủ", "", "trang chu", true)}
      ${R("goto('profile');closeSheet();", "person", "Hồ sơ", "Tài khoản · cài đặt", "ho so cua toi tai khoan cai dat giao dien", true)}
    </div>
    <p class="small-note te-menu-empty" role="status" aria-live="polite" hidden style="display:none;margin-top:8px;"></p>
    <p class="small-note" style="margin-top:14px;text-align:center;">TapEasy — Huấn luyện &amp; dinh dưỡng khoa học</p>
  `);
  teMenuWatch();
  teMenuBindSearch();
}
$$(".btn-menu-trigger").forEach(btn=> btn.addEventListener("click", ()=> openMainMenu()));

/* ---------------------------------------------------------------------
   4b. MENU ☰ NHÓM THEO KHU VỰC (vòng tích hợp 3)
   Module chèn dòng vào menu theo nhiều cách (sửa chuỗi HTML trước khi mở: kb.js; chèn DOM ngay sau khi mở: events.js,
   admin.js; chèn ở setTimeout 0: community.js, findpt.js). → Sau khi mở, gom MỌI .link-row vào nhóm cố định; MutationObserver
   gom lại khi module chèn muộn. Chỉ DI CHUYỂN phần tử (giữ trình nghe sự kiện), chạy lại nhiều lần không đổi kết quả.
   Nhóm "Quản trị" chỉ có dòng "Bảng quản trị" do admin.js chèn khi tài khoản CÓ vai trò → không có quyền thì nhóm không hiện.
   --------------------------------------------------------------------- */
/* QU-18 (vòng 2): 5 nhóm có tên (≤ 12 mục hiện sẵn) — "PT & cộng đồng" gộp Kết nối PT + Cộng đồng & Sự kiện;
   "Kiến thức & cửa hàng" gộp Kiến thức + Cửa hàng. Nhóm "main" (không tên) chỉ còn lối tắt ẩn Trang chủ / Hồ sơ. */
const TE_MENU_GROUPS = [
  { id:"main",   title:"" },
  { id:"train",  title:"Tập luyện" },
  { id:"nutri",  title:"Dinh dưỡng & sức khoẻ" },
  { id:"pt",     title:"PT & cộng đồng" },
  { id:"kb",     title:"Kiến thức & cửa hàng" },
  { id:"other",  title:"Khác" },
  { id:"admin",  title:"Quản trị" },
];
/* [nhóm, thứ tự trong nhóm, ẩn-sẵn?] của 1 dòng menu — nhận diện qua onclick / data-* / lớp do từng module đặt.
   Phần tử thứ 3 = true → "lối tắt ẩn" (trùng thanh dưới hoặc đã gộp vào mục khác) — chỉ hiện khi tìm. */
function teMenuSlot(row){
  const oc = (row.getAttribute && row.getAttribute("onclick")) || "", d = row.dataset || {}, cl = row.classList || { contains(){ return false; } };
  const go = k=> oc.indexOf("goto('" + k + "')") >= 0;
  if(cl.contains("adm-menu") || /TE_ADMIN\.open/.test(oc)) return ["admin", 1, false];
  if(d.kbMenu != null || /TEKB\./.test(oc)) return ["kb", 1, false];
  if(cl.contains("te-menu")) return d.id === "shop" ? ["kb", 2, false] : d.id === "events" ? ["pt", 5, true] : ["pt", 3, false];   // Sự kiện: Thi đua = mục chính, Gặp mặt & vé gộp vào
  if(/TapShop/.test(oc)) return ["kb", 3, false];
  if(d.fpMenu != null || /openFindPT|TE_FINDPT/.test(oc)) return ["pt", 1, false];
  if(d.cmMenu != null || go("community")) return ["pt", 2, false];
  if(go("coach")) return ["pt", 4, true];                       // thanh dưới có "PT"
  if(go("home")) return ["main", 1, true];
  if(go("profile")) return ["main", 2, true];
  if(go("plans")) return ["train", 1, false];
  if(/openExLib/.test(oc)) return ["train", 2, false];
  if(go("progress")) return ["train", 3, false];
  if(/FKAch/.test(oc)) return ["train", 4, false];
  if(go("workout")) return ["train", 5, true];                  // gộp vào "Giáo án" (+ thanh dưới "Tập luyện")
  if(/openTemplateBrowser/.test(oc)) return ["train", 6, true];
  if(/openProgramBuilder/.test(oc)) return ["train", 7, true];
  if(go("library")) return ["train", 8, true];
  if(go("sleep")) return ["nutri", 1, false];
  if(/openHealthSafety/.test(oc)) return ["nutri", 2, false];
  if(go("reminders")) return ["nutri", 3, false];
  if(go("nutrition")) return ["nutri", 4, true];                // thanh dưới có "Dinh dưỡng"
  if(/openShoppingList/.test(oc)) return ["nutri", 5, true];    // có nút "Đi chợ tuần" trong màn Dinh dưỡng
  return ["other", 50, false];
}
/* Từ khoá tìm cho dòng do module chèn (tên cũ vẫn tìm ra — GLOSSARY §8.1 "Không dùng nữa") */
function teMenuKw(row){
  const d = row.dataset || {}, cl = row.classList || { contains(){ return false; } };
  if(cl.contains("te-menu")) return d.id === "shop" ? "cua hang gian hang tapeasy store mua sam don hang qua" : d.id === "events" ? "su kien offline gap mat ve dang ky diem danh check in" : "su kien thi dua thu thach thang qua diem tapeasy";
  if(d.kbMenu != null) return "kho kien thuc bai viet thuat ngu hoi dap";
  if(d.fpMenu != null) return "tim pt huan luyen vien album pt dat lich";
  if(d.cmMenu != null) return "cong dong giao an chia se routine sao chep";
  return "";
}
/* Chuẩn hoá để tìm: bỏ dấu, chữ thường ("đi chợ" = "di cho") */
function teMenuNorm(s){ return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().replace(/\s+/g, " ").trim(); }
function teMenuShow(el, on){ if(!el) return; el.hidden = !on; if(el.style) el.style.display = on ? "" : "none"; }
/* Đổi chữ hiển thị dòng do module chèn theo GLOSSARY §8.1 (chỉ CHỮ — giữ phần tử, trình nghe, data-*) */
function teMenuRelabel(row){
  try{
    if(!row.classList || !row.classList.contains("te-menu") || row.getAttribute("data-te-relabel")) return;
    const id = (row.dataset || {}).id, nm = row.querySelector && row.querySelector(".name");
    const L = id === "challenges" ? ["Sự kiện", "Thử thách · Gặp mặt · Vé · Quà"] : id === "events" ? ["Gặp mặt & vé", "Sự kiện offline"] : id === "shop" ? ["Cửa hàng", "Đồ tập · quà · đơn hàng"] : null;
    if(!L || !nm || !nm.parentNode) return;
    row.setAttribute("data-te-relabel", "1");
    const wrap = document.createElement("div"), n2 = document.createElement("div"), sub = document.createElement("div");
    n2.className = "name"; n2.textContent = L[0]; sub.className = "sub"; sub.textContent = L[1];
    wrap.appendChild(n2); wrap.appendChild(sub);
    nm.parentNode.replaceChild(wrap, nm);
  }catch(e){}
}
function teMenuOrganize(){
  try{
    const sc = document.getElementById("sheet-content");
    const list = sc && sc.querySelector ? sc.querySelector("[data-te-menu]") : null;
    if(!list || !list.querySelectorAll) return false;
    const rows = [...list.querySelectorAll(".link-row")];
    if(!rows.length) return false;
    const byG = {};
    rows.forEach((r, i)=>{
      const [g, k, deep] = teMenuSlot(r);
      teMenuRelabel(r);
      if(deep && !r.classList.contains("te-mdeep")){ r.classList.add("te-mdeep"); teMenuShow(r, false); }
      if(!r.hasAttribute("data-kw")){ const kw = teMenuKw(r); if(kw) r.setAttribute("data-kw", kw); }
      if(!r.hasAttribute("tabindex") && typeof fkKeyable === "function") fkKeyable(r, "button");   // QU-30: dòng menu dùng được bằng bàn phím
      (byG[g] = byG[g] || []).push({ r, k, i });
    });
    const boxes = [...list.children].filter(n=> n.classList && n.classList.contains("te-mgroup"));
    let pos = 0;
    TE_MENU_GROUPS.forEach(G=>{
      const items = (byG[G.id] || []).sort((a, b)=> a.k - b.k || a.i - b.i).map(x=> x.r);
      let box = boxes.find(b=> b.getAttribute("data-g") === G.id) || null;
      if(!items.length){ if(box && box.parentNode) box.parentNode.removeChild(box); return; }
      if(!box){
        box = document.createElement("div"); box.className = "te-mgroup"; box.setAttribute("data-g", G.id); box.setAttribute("role", "group");
        if(G.title){ box.setAttribute("aria-label", G.title); const h = document.createElement("div"); h.className = "te-mgroup-h"; h.textContent = G.title; box.appendChild(h); }
      }
      if(list.children[pos] !== box) list.insertBefore(box, list.children[pos] || null);
      pos++;
      const off = G.title ? 1 : 0;
      items.forEach((r, j)=>{ if(box.children[off + j] !== r) box.insertBefore(r, box.children[off + j] || null); });
    });
    teMenuFilter(list.getAttribute("data-q") || "");
    return true;
  }catch(e){ try{ console.warn("[menu]", e); }catch(_){} return false; }
}
/* Ô "Tìm trong TapEasy": lọc mọi dòng (kể cả lối tắt ẩn) theo tên + mô tả + từ khoá; không khớp → gợi ý tìm bài tập / kiến thức.
   Trả số dòng đang hiện. Chuỗi người dùng chỉ đi qua textContent / closure (không chèn HTML, không onclick). */
function teMenuFilter(q){
  const sc = document.getElementById("sheet-content");
  const list = sc && sc.querySelector ? sc.querySelector("[data-te-menu]") : null;
  if(!list || !list.querySelectorAll) return 0;
  const raw = String(q == null ? "" : q).slice(0, 60), nq = teMenuNorm(raw);
  list.setAttribute("data-q", raw);
  const words = nq ? nq.split(" ") : [];
  let shown = 0;
  [...list.querySelectorAll(".link-row")].forEach(r=>{
    const deep = r.classList.contains("te-mdeep");
    let on;
    if(!words.length) on = !deep;
    else { const hay = teMenuNorm((r.textContent || "") + " " + (r.getAttribute("data-kw") || "")); on = words.every(w=> hay.indexOf(w) >= 0); }
    teMenuShow(r, on); if(on) shown++;
  });
  [...list.querySelectorAll(".te-mgroup")].forEach(b=>{
    const any = [...b.querySelectorAll(".link-row")].some(r=> !r.hidden);
    teMenuShow(b, any);
  });
  const empty = sc.querySelector(".te-menu-empty");
  const emptyKey = words.length && !shown ? nq : "";
  if(empty && empty._teQ !== emptyKey){   // vẽ lại gợi ý chỉ khi từ khoá đổi (MutationObserver gọi lại teMenuOrganize → không dựng nút 2 lần)
    empty._teQ = emptyKey;
    if(emptyKey){
      empty.textContent = "Không thấy mục nào khớp “" + raw + "”. ";
      const mk = (label, fn)=>{ const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-ghost btn-sm"; b.textContent = label; b.addEventListener("click", fn); empty.appendChild(b); };
      mk("Tìm bài tập “" + raw + "”", ()=>{ closeSheet(); try{ openExLib(); exLib.q = raw; const i = $("#exlib-q"); if(i) i.value = raw; renderExLib(); }catch(e){} });
      try{ if(window.TEKB && typeof TEKB.open === "function") mk("Tìm trong Kho kiến thức", ()=>{ closeSheet(); try{ TEKB.open({ q: raw }); }catch(e){} }); }catch(e){}
      teMenuShow(empty, true);
    } else { empty.textContent = ""; teMenuShow(empty, false); }
  }
  return shown;
}
function teMenuBindSearch(){
  const inp = document.getElementById("te-menu-q");
  if(!inp || !inp.addEventListener || inp._teBound) return;
  inp._teBound = true;
  inp.addEventListener("input", ()=> teMenuFilter(inp.value));
  inp.addEventListener("keydown", e=>{
    if(e.key === "Enter"){ e.preventDefault(); const sc = document.getElementById("sheet-content"); const first = sc && sc.querySelector ? [...sc.querySelectorAll("[data-te-menu] .link-row")].find(r=> !r.hidden) : null; if(first) first.click(); }
    else if(e.key === "Escape" && inp.value){ e.preventDefault(); e.stopPropagation(); inp.value = ""; teMenuFilter(""); }
  });
}
let _teMenuObs = null;
function teMenuWatch(){
  teMenuOrganize();
  try{
    if(_teMenuObs){ _teMenuObs.disconnect(); _teMenuObs = null; }
    const sc = document.getElementById("sheet-content");
    if(!sc || typeof MutationObserver !== "function") return;
    let busy = false;
    _teMenuObs = new MutationObserver(()=>{
      if(busy) return;
      if(!sc.querySelector("[data-te-menu]")){ _teMenuObs.disconnect(); _teMenuObs = null; return; }   // đã mở sheet khác
      busy = true; teMenuOrganize(); _teMenuObs.takeRecords(); busy = false;
    });
    _teMenuObs.observe(sc, { childList:true, subtree:true });
  }catch(e){}
}

/* ---------------------------------------------------------------------
   5. SHEET (modal đáy màn hình) DÙNG CHUNG
   --------------------------------------------------------------------- */
let onSheetCloseHook = null; // hàm dọn dẹp (vd: tắt camera) khi sheet đóng bằng bất kỳ cách nào
/* openSheet(html, opts) — opts.text = true → nội dung là CHỮ THUẦN (escape toàn bộ, QS-22).
   QU-29: sheet là hộp thoại thật — role="dialog" aria-modal, nhãn = tiêu đề đầu tiên, đưa focus vào sheet,
   giữ focus trong sheet (Tab/Shift+Tab), nền phía sau `inert`, Esc đóng, đóng xong trả focus về nút đã mở. */
let _sheetReturnFocus = null, _sheetInert = [];
function openSheet(html, opts){
  const sc = $("#sheet-content"), bd = $("#sheet-backdrop");
  const body = opts && opts.text ? `<p class="small-note">${escapeHtml(toastPlain(html))}</p>` : html;
  const wasOpen = bd.classList.contains("open");
  sc.innerHTML = `<div class="sheet-handle"></div>` + body;
  bd.classList.add("open");
  try{ fkSheetA11yOpen(sc, bd, wasOpen); }catch(e){}
}
function fkSheetFocusables(sc){
  if(!sc || !sc.querySelectorAll) return [];
  return [...sc.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,video[controls],[tabindex]:not([tabindex="-1"])')]
    .filter(el=> !el.hidden && !(el.closest && el.closest("[hidden],[inert]")) && (el.offsetParent !== null || (el.getClientRects && el.getClientRects().length)));
}
function fkSheetA11yOpen(sc, bd, wasOpen){
  sc.setAttribute("role", "dialog"); sc.setAttribute("aria-modal", "true"); sc.setAttribute("tabindex", "-1");
  const h = sc.querySelector && sc.querySelector("h1, h2, h3");
  if(h && h.tagName){ if(!h.id) h.id = "fk-sheet-title"; sc.setAttribute("aria-labelledby", h.id); sc.removeAttribute("aria-label"); }
  else { sc.removeAttribute("aria-labelledby"); sc.setAttribute("aria-label", "Hộp thoại"); }
  if(!wasOpen){
    const ae = document.activeElement;
    _sheetReturnFocus = ae && ae !== document.body && !(sc.contains && sc.contains(ae)) ? ae : null;
    _sheetInert = [];
    const host = bd.parentNode;
    if(host && host.children) [...host.children].forEach(el=>{
      if(el === bd || el.id === "toast" || !el.setAttribute || (el.hasAttribute && el.hasAttribute("inert"))) return;
      el.setAttribute("inert", ""); _sheetInert.push(el);
    });
    fkSheetWatch(bd);
  }
  const ae2 = document.activeElement;
  if(!(sc.contains && sc.contains(ae2)) || ae2 === document.body){ try{ sc.focus({ preventScroll:true }); }catch(e){ try{ sc.focus(); }catch(_){} } }
}
function fkSheetA11yClose(){
  _sheetInert.forEach(el=>{ try{ el.removeAttribute("inert"); }catch(e){} });
  _sheetInert = [];
  const rf = _sheetReturnFocus; _sheetReturnFocus = null;
  if(rf && rf.focus && rf.isConnected !== false && !(rf.closest && rf.closest("[inert]"))){ try{ rf.focus({ preventScroll:true }); }catch(e){} }
}
/* Lưới an toàn: module nào đóng sheet bằng cách gỡ lớp "open" trực tiếp vẫn trả lại nền (không để app kẹt inert) */
let _sheetObs = null;
function fkSheetWatch(bd){
  if(_sheetObs || typeof MutationObserver !== "function") return;
  try{ _sheetObs = new MutationObserver(()=>{ if(!bd.classList.contains("open") && _sheetInert.length) fkSheetA11yClose(); });
       _sheetObs.observe(bd, { attributes:true, attributeFilter:["class"] }); }catch(e){}
}
function closeSheet(){
  $("#sheet-backdrop").classList.remove("open");
  try{ fkSheetA11yClose(); }catch(e){}
  if(onSheetCloseHook){ const fn = onSheetCloseHook; onSheetCloseHook = null; fn(); }
}
$("#sheet-backdrop").addEventListener("click", (e)=>{ if(e.target.id==="sheet-backdrop") closeSheet(); });
/* Giữ focus trong sheet khi đang mở */
document.addEventListener("keydown", e=>{
  if(e.key !== "Tab") return;
  const bd = $("#sheet-backdrop"); if(!bd || !bd.classList.contains("open")) return;
  const sc = $("#sheet-content"), f = fkSheetFocusables(sc), a = document.activeElement;
  if(!f.length){ e.preventDefault(); try{ sc.focus(); }catch(_){} return; }
  const first = f[0], last = f[f.length - 1];
  if(!(sc.contains && sc.contains(a))){ e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
  if(e.shiftKey && (a === first || a === sc)){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && a === last){ e.preventDefault(); first.focus(); }
});
/* QU-30: phần tử không phải <button> nhưng bấm được (thẻ chọn onboarding, thẻ vai trò, chip/ô chỉ số Trang chủ…) gắn
   data-fk-key + role + tabindex=0 → Enter/Space = bấm; nhóm role="radiogroup" đi bằng phím mũi tên. */
document.addEventListener("keydown", e=>{
  if(e.defaultPrevented) return;              // ui-kit ([data-fk-kbd]) đã xử lý → không bấm 2 lần
  const t = e.target; if(!t || !t.closest) return;
  const el = t.closest("[data-fk-key]"); if(!el || el !== t) return;
  if(e.key === "Enter" || e.key === " " || e.key === "Spacebar"){ e.preventDefault(); el.click(); return; }
  if(el.getAttribute("role") === "radio" && /^Arrow(Up|Down|Left|Right)$/.test(e.key)){
    const grp = el.closest('[role="radiogroup"]') || el.parentNode;
    const all = grp && grp.querySelectorAll ? [...grp.querySelectorAll('[role="radio"][data-fk-key]')] : [];
    if(all.length < 2) return;
    e.preventDefault();
    const i = all.indexOf(el), n = /Up|Left/.test(e.key) ? (i - 1 + all.length) % all.length : (i + 1) % all.length;
    all[n].focus(); all[n].click();
  }
});
function fkKeyable(el, role, label){
  if(!el || !el.setAttribute) return el;
  el.setAttribute("role", role || "button"); el.setAttribute("tabindex", "0"); el.setAttribute("data-fk-key", "");
  if(label) el.setAttribute("aria-label", label);
  return el;
}

/* =========================================================================
   6. ONBOARDING
   ========================================================================= */
let obStep = 0;
const OB_STEPS = 5;
let tempProfile = {};
/* 13/11 (onboarding hoàn chỉnh — docs/ANALYTICS.md §phễu): tên từng bước cho bộ đếm "Bước 2/5 · …" + thanh tiến độ có aria;
   obEditMode = đang SỬA câu trả lời (mở từ Hồ sơ / màn "Kế hoạch đã sẵn sàng") — bước đầu "Quay lại" đóng, không về màn chào. */
const OB_STEP_NAMES = ["Bạn", "Giới tính & tuổi", "Chiều cao & cân nặng", "Vận động & lịch tập", "Mục tiêu & kinh nghiệm"];
let obEditMode = false, obReturnToReady = false, obPrevAnswers = null;

function renderOnboardProgress(){
  const el = $("#onboard-progress");
  el.innerHTML = Array.from({length:OB_STEPS}).map((_,i)=>
    `<div class="${i<=obStep?'done':''}"></div>`).join("");
  try{
    el.setAttribute("role", "progressbar"); el.setAttribute("aria-label", "Tiến độ tạo hồ sơ");
    el.setAttribute("aria-valuemin", "1"); el.setAttribute("aria-valuemax", String(OB_STEPS)); el.setAttribute("aria-valuenow", String(obStep + 1));
    el.setAttribute("aria-valuetext", `Bước ${obStep + 1}/${OB_STEPS}: ${OB_STEP_NAMES[obStep] || ""}`);
  }catch(e){}
  const c = $("#onboard-count");
  if(c) c.textContent = `Bước ${obStep + 1}/${OB_STEPS} · ${OB_STEP_NAMES[obStep] || ""}`;
}
function showObStep(i, focus){
  obStep = i;
  $$(".onboard-step").forEach(s=> s.classList.toggle("active", Number(s.dataset.step)===i));
  $("#onboard-back").style.display = (i===0 && typeof showAuth !== "function" && !obEditMode) ? "none" : "flex";   // 12/11: bước 0 → quay về màn chào (slogan)
  try{ $("#onboard-back").setAttribute("aria-label", i===0 ? (obEditMode ? "Huỷ chỉnh sửa, về Hồ sơ" : "Quay lại màn chào") : "Quay lại bước trước"); }catch(e){}
  $("#onboard-next").textContent = i===OB_STEPS-1 ? (obEditMode ? "Lưu thay đổi" : "Tạo kế hoạch của tôi") : "Tiếp tục";
  obClearError(i);
  renderOnboardProgress();
  if(focus){ try{ const h = $(`.onboard-step[data-step="${i}"] .onboard-hero`); if(h && h.setAttribute){ h.setAttribute("tabindex", "-1"); h.focus({ preventScroll:true }); } }catch(e){} }
  try{ if(typeof fkTrack === "function") fkTrack("onboarding_step_view", { step: i, step_name: ["intro","sex_age","body","activity","goal"][i] || "", edit: obEditMode }); }catch(e){}
}
/* Thẻ chọn onboarding (QU-30): role="radio" + aria-checked + tabindex=0, Enter/Space/mũi tên chọn được bằng bàn phím */
function fkChoiceSelect(cards, card){
  cards.forEach(c=>{ const on = c === card; c.classList.toggle("selected", on); if(c.setAttribute) c.setAttribute("aria-checked", on ? "true" : "false"); });
}
function renderChoiceList(containerId, items, field, labelFn){
  const el = $(containerId);
  if(el.setAttribute){ el.setAttribute("role", "radiogroup"); }
  el.innerHTML = items.map(it => `
    <div class="choice-card" role="radio" aria-checked="false" tabindex="0" data-fk-key data-field="${escapeHtml(field)}" data-value="${escapeHtml(it.id)}" style="width:100%;text-align:left;display:flex;flex-direction:column;">
      <span>${escapeHtml(it.label)}</span><small>${escapeHtml(it.desc || "")}</small>
    </div>`).join("");
  $$(`[data-field="${field}"]`, el).forEach(card=>{
    card.addEventListener("click", ()=>{
      fkChoiceSelect($$(`[data-field="${field}"]`, el), card);
      tempProfile[field] = card.dataset.value;
      try{ obClearError(obStep); }catch(e){}
    });
  });
}
/* QT-05: hỏi kinh nghiệm tập tạ ở bước Mục tiêu → chọn giáo án mặc định phù hợp (người mới: Full Body 3 buổi) */
const TRAIN_LEVELS = [
  { id:"beginner", label:"Mới tập / chưa đều", desc:"Dưới 6 tháng tập tạ, hoặc nghỉ lâu mới tập lại" },
  { id:"intermediate", label:"Đã tập 6 tháng – 2 năm", desc:"Biết kỹ thuật squat, đẩy, kéo cơ bản" },
  { id:"advanced", label:"Tập trên 2 năm", desc:"Tập đều 4–6 buổi/tuần, quen RPE/RIR" },
];
function ensureLevelChoices(){
  let box = document.getElementById("level-list");
  const goal = document.getElementById("goal-list");
  if((!box || !box.isConnected || box.parentNode == null) && goal && goal.parentNode && goal.parentNode.insertBefore){
    const wrap = document.createElement("div");
    wrap.className = "ob-level"; wrap.style.marginTop = "16px";
    wrap.innerHTML = `<h4 class="onboard-sub" style="margin:0 0 8px;font-weight:700;color:var(--text);" id="level-list-h">Kinh nghiệm tập tạ</h4><div id="level-list" aria-labelledby="level-list-h" style="display:flex;flex-direction:column;gap:8px;"></div>`;
    goal.parentNode.insertBefore(wrap, goal.nextSibling || null);
    box = document.getElementById("level-list");
  }
  if(box) renderChoiceList("#level-list", TRAIN_LEVELS, "level");
}
/* Nơi tập + số buổi/tuần (13/11): dùng để chọn giáo án gợi ý (fkDefaultTemplate) — có sẵn giá trị mặc định hợp lý */
const OB_EQUIP = [
  { id:"gym",  label:"Phòng gym", desc:"Đủ máy, tạ đòn, tạ đơn" },
  { id:"home", label:"Tại nhà có dụng cụ", desc:"Tạ đơn, dây kháng lực, xà đơn" },
  { id:"none", label:"Không dụng cụ", desc:"Chỉ dùng trọng lượng cơ thể" },
];
const OB_DAYS = [2, 3, 4, 5, 6];
const OB_DEFAULTS = { activity:"light", equipment:"gym", days:3 };
function renderDaysChoices(){
  const el = $("#days-list"); if(!el) return;
  if(el.setAttribute) el.setAttribute("role", "radiogroup");
  el.innerHTML = OB_DAYS.map(d=> `<div class="choice-card ob-day" role="radio" aria-checked="false" tabindex="0" data-fk-key data-field="days" data-value="${d}" aria-label="${d} buổi mỗi tuần"><span>${d}</span><small>buổi</small></div>`).join("");
  $$('[data-field="days"]', el).forEach(card=> card.addEventListener("click", ()=>{
    fkChoiceSelect($$('[data-field="days"]', el), card); tempProfile.days = Number(card.dataset.value) || OB_DEFAULTS.days; obClearError(3);
  }));
}
/* Kiểm từng bước → { text, field } (field = id ô cần sửa) hoặc null. validateStep() giữ nguyên chữ ký cũ. */
function obStepError(i){
  const num = id=>{ const v = String(($(id) || {}).value || "").trim().replace(",", "."); return v === "" ? NaN : Number(v); };
  if(i===1){
    if(!tempProfile.gender) return { text:"Chọn giới tính — dùng cho công thức tính năng lượng nghỉ (BMR).", field:null };
    const a = num("#in-age");
    if(!(a >= 14 && a <= 90)) return { text:"Nhập tuổi từ 14 đến 90.", field:"in-age" };
  }
  if(i===2){
    const h = num("#in-height"), w = num("#in-weight"), bfRaw = String(($("#in-bodyfat") || {}).value || "").trim();
    if(!(h >= 80 && h <= 250)) return { text:"Chiều cao từ 80 đến 250 cm.", field:"in-height" };
    if(!(w >= 25 && w <= 300)) return { text:"Cân nặng từ 25 đến 300 kg.", field:"in-weight" };
    if(bfRaw !== "" && !(num("#in-bodyfat") >= 3 && num("#in-bodyfat") <= 60)) return { text:"Tỉ lệ mỡ từ 3 đến 60 % — hoặc để trống nếu chưa đo.", field:"in-bodyfat" };
  }
  if(i===3 && !tempProfile.activity) return { text:"Chọn mức vận động gần đúng nhất với bạn.", field:null };
  if(i===4){
    if(!tempProfile.goal) return { text:"Chọn mục tiêu của bạn.", field:null };
    if(!tempProfile.level) return { text:"Chọn kinh nghiệm tập tạ để TapEasy gợi ý giáo án phù hợp", field:null };
  }
  return null;
}
function validateStep(i){ return !obStepError(i); }
function obClearError(i){
  try{ const e = $("#ob-err-" + i); if(e) e.textContent = "";
    ["in-age","in-height","in-weight","in-bodyfat"].forEach(id=>{ const el = document.getElementById(id); if(el && el.removeAttribute) el.removeAttribute("aria-invalid"); }); }catch(e){}
}
function obShowError(i, err){
  try{
    const box = $("#ob-err-" + i); if(box) box.textContent = err.text;
    if(err.field){ const el = document.getElementById(err.field); if(el){ el.setAttribute("aria-invalid", "true"); if(el.focus) el.focus(); } }
  }catch(e){}
}
$$('[data-field="gender"]').forEach(card=>{
  fkKeyable(card, "radio"); card.setAttribute("aria-checked", "false");
  if(card.parentNode && card.parentNode.setAttribute){ card.parentNode.setAttribute("role", "radiogroup"); card.parentNode.setAttribute("aria-label", "Giới tính"); }
  card.addEventListener("click", ()=>{
    fkChoiceSelect($$('[data-field="gender"]'), card);
    tempProfile.gender = card.dataset.value;
    try{ obClearError(1); }catch(e){}
  });
});
$("#onboard-next").addEventListener("click", ()=>{
  const err = obStepError(obStep);
  if(err){ obShowError(obStep, err); toast(err.text, "error"); return; }
  obClearError(obStep);
  try{ if(typeof fkTrack === "function") fkTrack("onboarding_step_complete", { step: obStep, edit: obEditMode }); }catch(e){}
  if(obStep === OB_STEPS-1){ finishOnboarding(); return; }
  showObStep(obStep+1, true);
});
$("#onboard-back").addEventListener("click", ()=>{
  if(obStep > 0) return showObStep(obStep-1, true);
  // đang SỬA hồ sơ: đóng, giữ nguyên dữ liệu cũ, về nơi đã mở (Hồ sơ / màn kế hoạch)
  if(obEditMode){
    $("#onboarding").classList.remove("open"); obEditMode = false;
    if(obReturnToReady){ obReturnToReady = false; showPlanReady(); } else goto("profile");
    return;
  }
  // bước đầu: đóng onboarding, về màn chào có slogan (chưa lưu gì)
  try{ $("#onboarding").classList.remove("open"); if(typeof showAuth === "function") showAuth("welcome"); }catch(e){}
});
/* Enter trong ô nhập = "Tiếp tục" (form không tự gửi / không tải lại trang) */
try{
  $("#onboard-form").addEventListener("submit", e=>{ e.preventDefault(); $("#onboard-next").click(); });
  $("#onboard-form").addEventListener("keydown", e=>{
    const t = e.target;
    if(e.key === "Enter" && t && t.tagName === "INPUT"){ e.preventDefault(); $("#onboard-next").click(); }
  });
}catch(e){}

const obPlanKey = p=> [p.gender, p.level, p.equipment, p.daysPerWeek, p.goal].join("|");
function finishOnboarding(){
  const p = state.profile;
  const wasOnboarded = state.onboarded;
  const numIn = id=>{ const v = String(($(id) || {}).value || "").trim().replace(",", "."); return v === "" ? NaN : Number(v); };
  const before = obPlanKey(p);
  p.name = String(($("#in-name") || {}).value || p.name || "Vận Động Viên").trim().slice(0, 40) || "Vận Động Viên";
  p.gender = tempProfile.gender || "male";
  p.age = Math.round(numIn("#in-age")) || 25;
  p.height = numIn("#in-height") || 170;
  p.weight = Math.round((numIn("#in-weight") || 65) * 10) / 10;
  p.bodyfat = Number.isFinite(numIn("#in-bodyfat")) ? numIn("#in-bodyfat") : null;
  p.activity = tempProfile.activity || "moderate";
  p.goal = tempProfile.goal || "gain";
  p.level = tempProfile.level || p.level || "beginner";
  p.equipment = OB_EQUIP.some(e=> e.id === tempProfile.equipment) ? tempProfile.equipment : (p.equipment || OB_DEFAULTS.equipment);
  p.daysPerWeek = OB_DAYS.includes(Number(tempProfile.days)) ? Number(tempProfile.days) : (Number(p.daysPerWeek) || OB_DEFAULTS.days);
  recomputeProfile();
  state.onboarded = true;
  let defPlan = null;
  const editing = obEditMode; obEditMode = false;
  const planChanged = wasOnboarded && before !== obPlanKey(p);
  if(!wasOnboarded){
    state.activePlanId = null; ensurePlans();
    defPlan = fkApplyDefaultPlan();            // QT-05: giáo án theo cấp độ / giới tính / sàng lọc sức khoẻ (+ nơi tập, số buổi)
    if(!state.startDate) state.startDate = todayStr();
  }
  saveState();
  $("#onboarding").classList.remove("open");
  try{ if(typeof fkTrack === "function") fkTrack(wasOnboarded ? "profile_updated" : "onboarding_finish", { goal: p.goal, level: p.level, activity: p.activity, equipment: p.equipment, days_per_week: p.daysPerWeek, has_bodyfat: p.bodyfat != null, plan_changed: planChanged }); }catch(e){}
  // Lần đầu → màn "Kế hoạch đã sẵn sàng" (BMR/TDEE/macro + tuần đầu + CTA "Bắt đầu buổi đầu tiên")
  if(!wasOnboarded){ showPlanReady(); return; }
  // Sửa từ màn kế hoạch → áp lại giáo án gợi ý theo câu trả lời mới rồi quay lại màn kế hoạch
  if(obReturnToReady){
    obReturnToReady = false;
    if(planChanged){ const pl = getActivePlan(); if(!pl || pl.autoDefault) fkApplyDefaultPlan(); }
    showPlanReady(); return;
  }
  // Sửa từ Hồ sơ → về Hồ sơ; câu trả lời ảnh hưởng giáo án đổi → hỏi có muốn đổi giáo án gợi ý không
  goto(editing ? "profile" : "home");
  toast(`Đã cập nhật hồ sơ · ${p.goalKcal} kcal/ngày`, "check_circle");
  if(planChanged){
    const t = fkDefaultTemplate(p, (window.FKHealth && typeof FKHealth.current === "function") ? FKHealth.current() : null);
    const cur = getActivePlan();
    if(t && !(cur && cur.fromTemplate === t.id)) setTimeout(()=> confirmDialog("Đổi giáo án gợi ý?", `Theo câu trả lời mới, giáo án phù hợp hơn là “${t.name}”. Giáo án hiện tại vẫn được giữ trong “Giáo án của tôi”.`,
      ()=>{ const pl = fkApplyDefaultPlan(); if(pl){ toast(`Đang dùng: ${pl.name}`, "check_circle"); fkRenderActive && fkRenderActive(); } }, "Dùng giáo án mới", "swap_horiz"), 350);
  }
}

/* =========================================================================
   6b. MÀN "KẾ HOẠCH ĐÃ SẴN SÀNG" (sau onboarding lần đầu)
   Số liệu lấy từ CHÍNH hàm tính của app (calcBMR / calcTDEE / calcGoalKcal / calcMacros / recomputeProfile)
   và nuWaterGoal (nutrition.js) — KHÔNG lặp lại công thức ở đây.
   ========================================================================= */
function fkPlanSummary(p){
  p = p || state.profile || {};
  const bmr = calcBMR(p);                                                  // Mifflin-St Jeor
  const tdee = Number(p.tdee) > 0 ? Number(p.tdee) : calcTDEE(bmr, p.activity);   // < 18 tuổi: recomputeProfile đã dùng EER
  const kcal = Number(p.goalKcal) > 0 ? Number(p.goalKcal) : calcGoalKcal(tdee, p.goal);
  const m = Number(p.protein) > 0 ? { protein: Number(p.protein), carbs: Number(p.carbs) || 0, fat: Number(p.fat) || 0 } : calcMacros(p.weight, kcal, p);
  let water = null; try{ water = typeof nuWaterGoal === "function" ? nuWaterGoal(p) : null; }catch(e){}
  const plan = getActivePlan();
  const keys = typeof DAY_KEYS !== "undefined" ? DAY_KEYS : ["T2","T3","T4","T5","T6","T7","CN"];
  const today = todayDayKey();
  const days = keys.map(k=>{
    const d = plan && plan.days ? plan.days[k] : null;
    const n = d && Array.isArray(d.items) ? d.items.length : 0;
    return { key:k, label: (typeof DAY_LABELS !== "undefined" && DAY_LABELS[k]) || k, title: n ? String(d.title || "Buổi tập") : "Nghỉ / hồi phục", n,
      duration: n ? Number(d.duration) || 0 : 0, today: k === today };
  });
  const ti = keys.indexOf(today);
  let first = null;
  for(let j = 0; j < 7 && !first; j++){ const d = days[(Math.max(0, ti) + j) % 7]; if(d && d.n) first = d; }
  const goalDef = GOALS.find(g=> g.id === p.goal);
  return { bmr, tdee, kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, water, planName: plan ? String(plan.name || "") : "",
    days, first, trainDays: days.filter(d=> d.n).length, goalLabel: goalDef ? goalDef.label : "", deltaKcal: kcal - tdee };
}
let _obReadyInert = [];
function hidePlanReady(){
  const el = $("#ob-ready"); if(!el) return;
  el.classList.remove("open"); el.hidden = true;
  _obReadyInert.forEach(n=>{ try{ n.removeAttribute("inert"); }catch(e){} }); _obReadyInert = [];
}
function showPlanReady(){
  const el = $("#ob-ready"), body = $("#ob-ready-body"); if(!el || !body){ if(typeof afterFirstOnboarding === "function") afterFirstOnboarding(); else goto("home"); return; }
  const p = state.profile, S = fkPlanSummary(p);
  const vn = n=> Math.round(Number(n) || 0).toLocaleString("vi-VN");
  const eq = OB_EQUIP.find(e=> e.id === p.equipment), lv = TRAIN_LEVELS.find(l=> l.id === p.level), act = ACTIVITY_LEVELS.find(a=> a.id === p.activity);
  const delta = S.deltaKcal === 0 ? "bằng mức tiêu hao" : (S.deltaKcal > 0 ? "+" : "−") + vn(Math.abs(S.deltaKcal)) + " kcal so với mức tiêu hao";
  const answers = [
    [4, "Mục tiêu", S.goalLabel], [4, "Kinh nghiệm", lv ? lv.label : ""], [3, "Vận động", act ? act.label : ""],
    [3, "Nơi tập", eq ? eq.label : ""], [3, "Số buổi/tuần", String(p.daysPerWeek || OB_DEFAULTS.days)], [2, "Cơ thể", `${vn(p.height)} cm · ${fmt1(p.weight)} kg`],
  ];
  body.innerHTML = `
    <div class="ob-ready-top">
      <span class="ob-ready-badge" aria-hidden="true"><span class="material-symbols-rounded">check_circle</span></span>
      <p class="ob-ready-eyebrow">Hồ sơ hoàn tất</p>
      <h2 class="onboard-hero" id="ob-ready-h" tabindex="-1">Kế hoạch của ${escapeHtml(p.name || "bạn")} đã sẵn sàng</h2>
      <p class="onboard-sub">Ước lượng theo công thức khoa học từ chỉ số bạn nhập — chỉnh được bất cứ lúc nào trong Hồ sơ.</p>
    </div>
    <section class="card ob-ready-card" aria-labelledby="ob-ready-en">
      <div class="card-title" id="ob-ready-en"><span class="material-symbols-rounded">bolt</span>Năng lượng mỗi ngày</div>
      <div class="stat-grid">
        <div class="stat-box"><div class="num">${vn(S.bmr)}</div><div class="cap">BMR · nghỉ ngơi</div></div>
        <div class="stat-box"><div class="num">${vn(S.tdee)}</div><div class="cap">TDEE · cả ngày</div></div>
        <div class="stat-box ob-hl"><div class="num">${vn(S.kcal)}</div><div class="cap">Mục tiêu kcal</div></div>
      </div>
      <p class="small-note" style="margin-top:8px;">${escapeHtml(S.goalLabel)}: ${escapeHtml(delta)}.</p>
      <div class="ob-macros" role="list" aria-label="Đạm, tinh bột, chất béo mỗi ngày">
        <div class="ob-mac p" role="listitem"><b>${vn(S.protein)} g</b><small>Đạm</small></div>
        <div class="ob-mac c" role="listitem"><b>${vn(S.carbs)} g</b><small>Tinh bột</small></div>
        <div class="ob-mac f" role="listitem"><b>${vn(S.fat)} g</b><small>Chất béo</small></div>
        ${S.water ? `<div class="ob-mac w" role="listitem"><b>${escapeHtml(String(S.water).replace(".", ","))} L</b><small>Nước</small></div>` : ""}
      </div>
    </section>
    <section class="card ob-ready-card" aria-labelledby="ob-ready-wk">
      <div class="card-title" id="ob-ready-wk"><span class="material-symbols-rounded">event</span>Tuần đầu tiên${S.planName ? " · " + escapeHtml(S.planName) : ""}</div>
      <ol class="ob-week">${S.days.map(d=> `<li class="ob-wd${d.n ? " on" : ""}${d.today ? " today" : ""}${S.first && S.first.key === d.key ? " first" : ""}">
        <span class="ob-wd-k">${escapeHtml(d.key)}</span><span class="ob-wd-t">${escapeHtml(d.title)}</span>
        <span class="ob-wd-m">${d.n ? `${d.n} bài${d.duration ? " · ~" + d.duration + "′" : ""}` : ""}${d.today ? `<em>Hôm nay</em>` : ""}</span></li>`).join("")}</ol>
      <p class="small-note">${S.trainDays} buổi/tuần · ngày nghỉ giúp cơ hồi phục và lớn lên.</p>
    </section>
    <section class="ob-answers" aria-label="Câu trả lời của bạn">
      ${answers.filter(a=> a[2]).map((a, i)=> `<button type="button" class="ob-ans" id="ob-ans-${i}" data-ob-edit="${a[0]}"><small>${escapeHtml(a[1])}</small><b>${escapeHtml(a[2])}</b><span class="ob-ans-e">Sửa</span></button>`).join("")}
    </section>
    <p class="small-note ob-ready-med">Không thay thế tư vấn y tế. Mang thai, bệnh tim mạch, tiểu đường, thận… hãy hỏi bác sĩ trước khi tập hoặc ăn kiêng.</p>`;
  const foot = $("#ob-ready-foot");
  if(foot) foot.innerHTML = `<button type="button" class="btn btn-primary btn-block ob-ready-go" id="ob-ready-go"><span class="material-symbols-rounded">play_arrow</span>Bắt đầu buổi đầu tiên</button>
    <small class="ob-ready-sub" id="ob-ready-sub">${S.first ? `${escapeHtml(S.first.label)}${S.first.today ? " (hôm nay)" : ""} · ${escapeHtml(S.first.title)}${S.first.duration ? " · ~" + S.first.duration + " phút" : ""}` : "Chọn buổi tập trong màn Tập luyện"}</small>
    <button type="button" class="btn btn-ghost btn-block" id="ob-ready-later">Xem Trang chủ trước</button>`;
  el.hidden = false; el.classList.add("open");
  // hộp thoại toàn màn: nền phía sau không nhận focus / trình đọc màn hình
  _obReadyInert = [];
  try{ const host = el.parentNode; if(host && host.children) [...host.children].forEach(n=>{ if(n === el || n.id === "toast" || !n.setAttribute || (n.hasAttribute && n.hasAttribute("inert"))) return; n.setAttribute("inert", ""); _obReadyInert.push(n); }); }catch(e){}
  try{ const h = $("#ob-ready-h"); if(h && h.focus) h.focus({ preventScroll:true }); }catch(e){}
  const later = ()=>{ hidePlanReady(); try{ if(typeof fkTrack === "function") fkTrack("plan_ready_later", {}); }catch(e){} if(typeof afterFirstOnboarding === "function") afterFirstOnboarding(); else goto("home"); };
  const go = $("#ob-ready-go"); if(go) go.onclick = ()=> fkStartFirstWorkout(S);
  const lt = $("#ob-ready-later"); if(lt) lt.onclick = later;
  answers.filter(a=> a[2]).forEach((a, i)=>{ const b = document.getElementById("ob-ans-" + i); if(b) b.onclick = ()=>{ hidePlanReady(); obReturnToReady = true; openOnboarding(true, a[0]); }; });
  el._later = later;
  try{ if(typeof fkTrack === "function") fkTrack("plan_ready_view", { train_days: S.trainDays, goal: p.goal, has_first: !!S.first }); }catch(e){}
}
/** CTA "Bắt đầu buổi đầu tiên": vào Tập luyện, chọn buổi đầu (hôm nay nếu có, không thì buổi gần nhất) và mở buổi tập có hướng dẫn */
function fkStartFirstWorkout(S){
  S = S || fkPlanSummary();
  hidePlanReady();
  try{ if(typeof fkTrack === "function") fkTrack("first_workout_cta", { day_is_today: !!(S.first && S.first.today), has_first: !!S.first }); }catch(e){}
  if(!S.first){ goto("workout"); return; }
  state.selectedDay = S.first.key; saveState();
  goto("workout");
  setTimeout(()=>{ try{ startSession(S.first.key); }catch(e){} }, 250);
}

function openOnboarding(prefill, startStep){
  tempProfile = {};
  obEditMode = !!prefill && !!state.onboarded;
  if(!obEditMode) obReturnToReady = false;
  if(prefill){
    tempProfile.gender = state.profile.gender;
    tempProfile.activity = state.profile.activity;
    tempProfile.goal = state.profile.goal;
    if(state.profile.level) tempProfile.level = state.profile.level;
    tempProfile.equipment = state.profile.equipment || OB_DEFAULTS.equipment;
    tempProfile.days = Number(state.profile.daysPerWeek) || OB_DEFAULTS.days;
    $("#in-age").value = state.profile.age;
    $("#in-height").value = state.profile.height;
    $("#in-weight").value = state.profile.weight;
    $("#in-bodyfat").value = state.profile.bodyfat || "";
    $("#in-name").value = state.profile.name || "";
  } else {
    // giá trị mặc định hợp lý (đổi được): vận động nhẹ, phòng gym, 3 buổi/tuần — giới tính / mục tiêu / kinh nghiệm phải tự chọn
    tempProfile.activity = OB_DEFAULTS.activity; tempProfile.equipment = OB_DEFAULTS.equipment; tempProfile.days = OB_DEFAULTS.days;
  }
  renderChoiceList("#activity-list", ACTIVITY_LEVELS, "activity");
  renderChoiceList("#goal-list", GOALS, "goal");
  ensureLevelChoices();
  if($("#equip-list")) renderChoiceList("#equip-list", OB_EQUIP, "equipment");
  renderDaysChoices();
  const mark = (field, v)=>{ const cs = $$(`[data-field="${field}"]`); const c = cs.find(x=> x.dataset.value === v); if(c) fkChoiceSelect(cs, c); else cs.forEach(x=>{ x.classList.remove("selected"); x.setAttribute && x.setAttribute("aria-checked", "false"); }); };
  mark("gender", tempProfile.gender); mark("activity", tempProfile.activity); mark("goal", tempProfile.goal); mark("level", tempProfile.level);
  mark("equipment", tempProfile.equipment); mark("days", String(tempProfile.days));
  { // 12/11: ảnh NGANG (chủ thể ở giữa) cho khung ngang — ảnh dọc bị cắt mất người
    const im = document.querySelector('.onboard-step[data-step="0"] .ob-hero-img') || $('.onboard-step[data-step="0"]').querySelector("img:not(.brand-wm)");
    if(im){ im.onerror = function(){ this.onerror = null; this.src = "https://thangvu030198-ai.github.io/fitkit-app/media/welcome/welcome-bw-poster.jpg"; this.style.objectPosition = "center 30%"; };
      im.src = "https://thangvu030198-ai.github.io/fitkit-app/media/people-ai/ob-gym-empty.webp"; im.style.objectPosition = "center 50%"; }
  }
  showObStep(Math.max(0, Math.min(OB_STEPS - 1, Number(startStep) || 0)));
  $("#onboarding").classList.add("open");
}

/* =========================================================================
   7. MÀN HÌNH LUYỆN TẬP (dựa trên chương trình cá nhân hoá — state.plans)
   ========================================================================= */
const HERO_CYCLE = [IMG.heroWorkout1, IMG.heroWorkout2, IMG.heroWorkout3, IMG.heroWorkout4];

/* QT-11: giáo án nhập lúc chạy (cộng đồng, PT, mẫu) thiếu ngày / items sai kiểu → vá tại chỗ, không vỡ màn Tập luyện */
function fkEnsurePlanDays(plan){
  if(!plan || typeof plan !== "object") return plan;
  if(!plan.days || typeof plan.days !== "object") plan.days = {};
  DAY_KEYS.forEach(k=>{
    const d = plan.days[k];
    if(!d || typeof d !== "object") plan.days[k] = blankDay();
    else if(!Array.isArray(d.items)) d.items = [];
  });
  return plan;
}
function renderWorkoutScreen(){
  let plan = getActivePlan();
  if(!plan){ ensurePlans(); plan = getActivePlan(); }
  fkEnsurePlanDays(plan);
  if(!DAY_KEYS.includes(state.selectedDay)) state.selectedDay = todayDayKey();
  $("#workout-tagline").textContent = plan.tagline || "";
  const idx = DAY_KEYS.indexOf(state.selectedDay);
  { // 12/11: ảnh hero theo giới tính (AI: hero-m-* / hero-f-*); lớp dưới = ảnh cũ nếu ảnh mới chưa có
    const g = (state.profile && state.profile.gender) === "female" ? "f" : "m";
    const ai = `https://thangvu030198-ai.github.io/fitkit-app/media/people-ai/hero-${g}-${(idx % 4) + 1}.webp`;
    $("#workout-hero").style.backgroundImage = `url('${ai}'), url('${HERO_CYCLE[idx % HERO_CYCLE.length]}')`;
  }

  // day tabs
  $("#day-tabs").innerHTML = DAY_KEYS.map(k=>{
    const isRest = plan.days[k].items.length===0;
    return `<button class="day-tab ${k===state.selectedDay?'active':''} ${isRest?'rest':''}" data-day="${k}">${DAY_LABELS[k]}</button>`;
  }).join("");
  $$("#day-tabs .day-tab").forEach(b=> b.addEventListener("click", ()=>{ state.selectedDay=b.dataset.day; saveState(); renderWorkoutScreen(); }));

  const day = plan.days[state.selectedDay];
  const isToday = state.selectedDay === todayDayKey();
  const log = state.workoutLog[todayStr()];
  const doneIds = (isToday && log && (!log.dayKey || log.dayKey === state.selectedDay)) ? (log.completedExerciseIds || []) : [];
  const isRestDay = day.items.length === 0;

  $("#workout-heroTitle").innerHTML = isRestDay
    ? `NGÀY<br><span class="accent">PHỤC HỒI</span>`
    : `CHINH PHỤC<br><span class="accent">GIỚI HẠN</span>`;

  $("#today-card").innerHTML = isRestDay ? `
    <h3 style="font-size:19px;">${escapeHtml(day.title)}</h3>
    <p class="small-note" style="margin-top:8px;">Phục hồi là một phần của quá trình phát triển cơ bắp. Hãy ngủ đủ giấc, uống đủ nước và giãn cơ nhẹ nhàng hôm nay.</p>
  ` : `
    <h3 style="font-size:19px;">${escapeHtml(day.title)}</h3>
    <div class="chip-row" style="margin:10px 0 14px;">
      <span class="pill hot">Cường độ ${escapeHtml(day.intensity || "Vừa")}</span>
      <span class="pill">${escapeHtml(String(day.duration || 0))} phút</span>
      <span class="pill">${day.items.length} bài tập</span>
    </div>
    <button class="btn btn-primary btn-block" id="btn-start-session">
      <span class="material-symbols-rounded">play_arrow</span>
      ${isToday && doneIds.length===day.items.length ? "Tập lại buổi tập" : isToday ? "Bắt đầu buổi tập" : "Tập buổi này hôm nay"}
    </button>
    ${!isToday ? `<p class="small-note" style="text-align:center;margin-top:8px;">Không phải buổi của hôm nay — bấm để tập bù / đổi ngày (vẫn lưu nhật ký) hoặc chỉ xem trước</p>` : ""}
  `;
  if(!isRestDay){ $("#btn-start-session").addEventListener("click", ()=> startSession(state.selectedDay)); }

  $("#link-exercise-count").textContent = `${day.items.length} bài`;
  $("#exercise-list").innerHTML = day.items.map(item=>{
    const meta = getExerciseMeta(item);
    const done = doneIds.includes(item.uid);
    return `
    <div class="list-item ${done?'done':''}" data-ex="${escapeHtml(item.uid)}">
      <div class="thumb-wrap">
        ${item.clipId ? `<video muted preload="metadata" data-thumb-clip="${escapeHtml(item.clipId)}"></video>` : `<img src="${attrUrl((item.stock && item.stock.thumb) || meta.img)}" alt="${escapeHtml(meta.name)}" loading="lazy" decoding="async" data-fallback="${attrUrl(meta.img)}" onerror="this.onerror=null;if(this.dataset.fallback)this.src=this.dataset.fallback">`}
        ${item.clipId ? `<div class="cam-badge"><span class="material-symbols-rounded">videocam</span></div>` : (item.stock && item.stock.url ? `<div class="cam-badge play"><span class="material-symbols-rounded">play_arrow</span></div>` : "")}
      </div>
      <div class="info">
        <div class="name">${escapeHtml(meta.name)}</div>
        <div class="meta">${escapeHtml(meta.muscle)} · ${escapeHtml(String(item.sets))} hiệp × ${escapeHtml(String(item.reps))}</div>
      </div>
      <div class="check ${done?'checked':''}"><span class="material-symbols-rounded" style="font-size:16px;">check</span></div>
    </div>`;
  }).join("") || `<p class="empty-hint">Không có bài tập — đây là ngày nghỉ.<br><a id="link-add-rest-exercise" style="color:var(--primary-soft);text-decoration:underline;cursor:pointer;">+ Thêm bài tập cho ngày này</a></p>`;

  $$("#exercise-list .list-item").forEach(row=>{
    row.addEventListener("click", ()=> openExerciseDetail(row.dataset.ex, isToday));
  });
  $$("#exercise-list [data-thumb-clip]").forEach(async v=>{
    const u = await fkBlobUrl("clip", Number(v.dataset.thumbClip));
    if(u) v.src = u;
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
  const done = isToday && log && (log.completedExerciseIds || []).includes(itemUid);
  const mediaHtml = item.clipId
    ? mediaVideoHTML(item.clipId, "ex-detail-video")
    : `<img src="${attrUrl(meta.img)}" alt="${escapeHtml(meta.name)}" style="width:100%;height:170px;object-fit:cover;border-radius:16px;margin-bottom:14px;">`;
  openSheet(`
    ${mediaHtml}
    ${item.clipId ? `<button class="btn btn-outline btn-block" id="btn-fit-toggle-detail" style="margin-bottom:14px;">${fitToggleLabel(getClipFit(item.clipId))}</button>` : ""}
    <div class="pill" style="margin-bottom:8px;">${escapeHtml(meta.muscle)}</div>
    <h3 style="font-size:20px;">${escapeHtml(meta.name)}</h3>
    <div class="chip-row" style="margin:10px 0;">
      <span class="pill">${escapeHtml(String(item.sets))} hiệp</span><span class="pill">${escapeHtml(String(item.reps))} lần</span><span class="pill">Nghỉ ${escapeHtml(String(item.restSec))}s</span><span class="pill">${escapeHtml(meta.equipment)}</span>
    </div>
    <div class="card-title" style="margin-top:6px;"><span class="material-symbols-rounded">menu_book</span>Hướng dẫn kỹ thuật</div>
    <p style="font-size:13.5px;line-height:1.6;color:var(--text-muted);">${escapeHtml(meta.guide || "")}</p>
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
  const cur = state.workoutLog[dateKey];
  // buổi bù/đổi ngày đã lưu hôm nay (dayKey khác) → đánh dấu tay theo buổi của hôm nay thì bắt đầu bản ghi mới cho hôm nay
  if(!cur || (cur.dayKey && cur.dayKey !== todayDayKey())) state.workoutLog[dateKey] = { dayKey: todayDayKey(), completedExerciseIds: [] };
  const arr = state.workoutLog[dateKey].completedExerciseIds = state.workoutLog[dateKey].completedExerciseIds || [];
  const i = arr.indexOf(uidVal);
  if(i>=0) arr.splice(i,1); else arr.push(uidVal);
  saveState();
  updateFinishedDates(dateKey);
}
function fkDateOf(ds){ const [y,m,d] = String(ds).split("-").map(Number); return new Date(y, (m||1)-1, d||1); }
/* QT-04/QT-07: xét "hoàn thành" theo ĐÚNG buổi đã ghi (log.dayKey — buổi bù/đổi ngày, buổi qua nửa đêm), không theo thứ của hôm nay.
   updateFinishedDates(dateKey?) — mặc định hôm nay (giữ tương thích nơi gọi không tham số). */
function updateFinishedDates(dateKey){
  dateKey = typeof dateKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : todayStr();
  if(!Array.isArray(state.finishedDates)) state.finishedDates = [];
  const log = state.workoutLog[dateKey];
  const plan = getActivePlan();
  const dk = (log && log.dayKey) || todayDayKey(fkDateOf(dateKey));
  const day = plan && plan.days ? plan.days[dk] : null;
  const dayItems = day && Array.isArray(day.items) ? day.items : [];
  const ids = log && Array.isArray(log.completedExerciseIds) ? log.completedExerciseIds : [];
  const fullyDone = !!log && dayItems.length>0 && dayItems.every(it=> ids.includes(it.uid));
  const has = state.finishedDates.includes(dateKey);
  if(fullyDone && !has) state.finishedDates.push(dateKey);
  if(!fullyDone && has) state.finishedDates = state.finishedDates.filter(d=>d!==dateKey);
  saveState();
}
/* Ngày có lịch tập đã được "tập bù" ở ngày khác (QT-04) → không tính là bỏ lỡ (chuỗi, dải tuần) */
function fkCoveredDates(){
  const out = new Set();
  Object.values(state.workoutLog || {}).forEach(l=>{ if(l && typeof l.makeupFor === "string") out.add(l.makeupFor); });
  return out;
}

function calcStreak(){
  // Ngày nghỉ theo lịch tập (không có bài tập nào) không được tính là "gãy chuỗi" —
  // chỉ những ngày có lịch tập nhưng bị bỏ lỡ mới làm ngắt streak. Ngày đã tập bù ở ngày khác cũng không ngắt chuỗi.
  const plan = getActivePlan();
  const fin = Array.isArray(state.finishedDates) ? state.finishedDates : [];
  const covered = fkCoveredDates();
  const isRestDay = (d)=>{
    const day = plan && plan.days ? plan.days[todayDayKey(d)] : null;
    return !day || !Array.isArray(day.items) || day.items.length===0;
  };
  let streak = 0;
  let cursor = new Date();
  if(!isRestDay(cursor) && !fin.includes(todayStr())) cursor.setDate(cursor.getDate()-1);
  for(let guard=0; guard<400; guard++){   // giới hạn: tránh treo khi giáo án không có ngày tập nào
    const dateKey = todayStr(cursor);
    if(fin.includes(dateKey)) streak++;
    else if(!isRestDay(cursor) && !covered.has(dateKey)) break;
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
/* QT-04: buổi của ngày khác (tập bù / đổi ngày) → hỏi "Tập buổi này hôm nay?" — chọn tập thì LƯU như buổi hôm nay
   (giữ dayKey của buổi gốc, ghi vào ngày hôm nay, đánh dấu ngày gốc đã được bù); chỉ "Xem trước" mới không lưu.
   QT-07: chốt session.date lúc bắt đầu → buổi tập qua nửa đêm ghi trọn vào 1 ngày. */
function startSession(dayKey){
  const plan = getActivePlan();
  const day = plan && plan.days ? plan.days[dayKey] : null;
  if(!day) return;
  if(session && session.dayKey===dayKey && session.paused){ session.paused = false; toast("Tiếp tục buổi tập", "play_arrow"); renderSessionStep(); return; }
  const items = (day.items || []).slice();   // chụp danh sách NGAY LÚC GỌI (health-safety có thể lọc tạm day.items)
  const begin = makeup=>{
    const today = todayDayKey();
    session = { dayKey, idx:0, items, isToday: dayKey===today || !!makeup, makeup: !!makeup && dayKey!==today,
      date: todayStr(), sid: uid(), startedAt: Date.now(), completed: [] };
    try{ if(typeof fkTrack === "function") fkTrack("workout_start", { day_key: dayKey, exercises: items.length, makeup: !!session.makeup, first_ever: !(state.finishedDates || []).length }); }catch(e){}
    renderSessionStep();
  };
  if(dayKey === todayDayKey()){ begin(false); return; }
  const lbl = k=> (typeof DAY_LABELS !== "undefined" && DAY_LABELS[k]) || k;
  openSheet(`
    <div style="text-align:center;padding:8px 0;">
      <span class="material-symbols-rounded" style="font-size:44px;color:var(--primary);">event_repeat</span>
      <h3 style="margin-top:8px;">Tập buổi ${escapeHtml(lbl(dayKey))} hôm nay?</h3>
      <p class="small-note" style="margin-top:6px;">Hôm nay là ${escapeHtml(lbl(todayDayKey()))}. Tập bù hoặc đổi ngày vẫn được <b>lưu vào nhật ký hôm nay</b> (kg × lần, kỷ lục, chuỗi ngày tập).</p>
      <button class="btn btn-primary btn-block" style="margin-top:16px;" id="mk-go"><span class="material-symbols-rounded">play_arrow</span>Tập &amp; lưu vào hôm nay</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="mk-preview">Chỉ xem trước (không lưu)</button>
    </div>`);
  $("#mk-go").addEventListener("click", ()=> begin(true));
  $("#mk-preview").addEventListener("click", ()=> begin(false));
}
/* ---- Buổi tập: ghi kg × lần từng hiệp, nghỉ giữa hiệp (rung + âm báo), điền sẵn buổi trước ---- */
function exKey(item){ return item.exerciseId || ("c:" + (getExerciseMeta(item).name||"")); }
function repTop(reps){ const m = String(reps||"").match(/(\d+)\s*[-–]\s*(\d+)/); if(m) return Number(m[2]); const n = String(reps||"").match(/^\s*(\d+)/); return n ? Number(n[1]) : 0; }
function isMaxReps(reps){ return /tối đa|max|amrap/i.test(String(reps||"")); }
function isTimedReps(reps){ const r = String(reps||""); if(isMaxReps(r)) return false; return /giây|phút|(^|\s)\d*\s*m(\s|$|\/)|km|vòng|\d+\s*s(\s|$|\/)/i.test(r) || !repTop(r); }
function beep(){
  try{ navigator.vibrate && navigator.vibrate([200,100,200]); }catch(e){}
  try{ const C = window.AudioContext || window.webkitAudioContext; const ctx = window._fkAudio || (window._fkAudio = new C());
    [0, .25].forEach(t=>{ const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(.0001, ctx.currentTime+t); g.gain.exponentialRampToValueAtTime(.3, ctx.currentTime+t+.02); g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime+t+.18);
      o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+.2); }); }catch(e){}
}
async function keepAwake(on){
  try{ if(on && "wakeLock" in navigator){ window._fkWake = await navigator.wakeLock.request("screen"); } else if(!on && window._fkWake){ await window._fkWake.release(); window._fkWake = null; } }catch(e){}
}
function renderSessionStep(){
  if(!session) return;
  if(session.idx >= session.items.length){ fkSessionGate(session); return finishSession(); }
  if(!session._awake){ session._awake = true; keepAwake(true); }
  onSheetCloseHook = ()=>{ if(session && !session.finished){ stopSetRest(); keepAwake(false); session._awake = false; session.paused = true; toast("Đã tạm dừng buổi tập — bấm Bắt đầu để tiếp tục", "pause"); } };
  const item = session.items[session.idx];
  const meta = getExerciseMeta(item);
  const key = exKey(item);
  state.setLog = state.setLog || {};
  const last = state.setLog[key];
  const timed = isTimedReps(item.reps);
  const nSets = Math.min(FK_MAX_SETS, Math.max(1, Math.round(Number(item.sets))||1));   // R3-CORE-05
  session.sets = session.sets || {};
  const top = repTop(item.reps);
  const prog = progressionFor(item, meta, last, timed, nSets);
  if(!session.sets[item.uid]) session.sets[item.uid] = fkPrefillRows(item, { meta, last, timed, nSets, top, prog });
  if(session.sets[item.uid].length > FK_MAX_SETS) session.sets[item.uid].length = FK_MAX_SETS;   // R3-CORE-05 (kể cả hàng do training-pro điền sẵn)
  const rows = session.sets[item.uid];
  const eqc = fkEquipClass(meta);
  const simple = fkSimpleMode();                                   // QU-22: người mới — ẩn cột RPE, có hướng dẫn ghi hiệp
  const lastSets = last && Array.isArray(last.sets) ? fkFillBlankKg(last.sets, 0) : [];
  const lastTxt = lastSets.length && typeof last.date === "string" && last.date.length >= 10
    ? `Lần trước (${last.date.slice(8,10)}/${last.date.slice(5,7)}): ${lastSets.map(x=> timed ? "✓" : `${fmtKg(Number(x.kg)||0)}kg×${Number(x.reps)||0}`).join(" · ")}` : "";
  const hasKg = rows.some(r=> Number(r.kg) > 0);
  const kgHint = !timed && !hasKg && !lastSets.length && eqc !== "bw"
    ? `Chưa biết mức tạ? Chọn mức <b>nhẹ</b> làm được khoảng ${(top || 10) + 3} lần mà vẫn đúng kỹ thuật, gõ kg ở hiệp 1 — các hiệp sau tự điền theo.` : "";
  const mediaHtml = item.clipId
    ? mediaVideoHTML(item.clipId, "session-video", { maxHeight: "34vh" })
    : `<img src="${attrUrl(meta.img)}" alt="${escapeHtml(meta.name)}" style="width:100%;height:150px;object-fit:cover;border-radius:16px;margin-bottom:12px;" onerror="this.style.display='none'">`;
  const kgLabel = eqc === "db" ? "Kg/quả" : "Kg";                  // QT-16: tạ đơn ghi kg của 1 quả
  const rpeOpts = r=> `<option value="">–</option>${[6,7,7.5,8,8.5,9,9.5,10].map(v=>`<option ${String(r.rpe)===String(v)?'selected':''}>${v}</option>`).join("")}`;
  const tagTxt = session.makeup ? "Tập bù · lưu hôm nay" : session.isToday ? "Hôm nay" : "Xem trước";
  openSheet(`
    <div class="progress-row"><span class="label">Bài ${session.idx+1}/${session.items.length}</span><span class="value">${tagTxt}</span></div>
    <div class="progress-track" style="margin-bottom:12px;"><div class="progress-fill" style="width:${(session.idx/session.items.length)*100}%"></div></div>
    ${mediaHtml}
    <h3 style="font-size:19px;">${escapeHtml(meta.name)}</h3>
    <div class="chip-row" style="margin:8px 0;"><span class="pill hot">${escapeHtml(String(item.sets))} hiệp × ${escapeHtml(String(item.reps))}</span><span class="pill">Nghỉ ${escapeHtml(String(item.restSec || 0))}s</span></div>
    ${lastTxt ? `<p class="small-note set-last">${escapeHtml(lastTxt)}</p>` : ""}
    ${prog.msg ? `<div class="set-up ${prog.delta<0||prog.hold?'down':''}"><span class="material-symbols-rounded">${prog.delta<0||prog.hold?'trending_down':'trending_up'}</span><span>${richText(prog.msg)}</span></div>` : ""}
    ${simple && !timed && (state.finishedDates||[]).length < 6 ? `<details class="set-guide" ${session.idx === 0 ? "open" : ""}><summary>Cách ghi hiệp</summary><p>1. Gõ <b>kg</b> và <b>số lần</b> bạn làm được (kg tự điền xuống các hiệp sau).<br>2. Xong mỗi hiệp bấm <b>✓</b> — đồng hồ nghỉ tự chạy.<br>3. Làm đủ đỉnh số lần ở mọi hiệp → buổi sau app tự tăng tạ.</p></details>` : ""}
    ${kgHint ? `<p class="small-note set-hint">${richText(kgHint)}</p>` : ""}
    ${!timed ? `<div class="set-tools"><button data-tool="warm"><span class="material-symbols-rounded">local_fire_department</span>Khởi động</button>${eqc === "barbell" ? `<button data-tool="plate"><span class="material-symbols-rounded">fitness_center</span>Đĩa tạ</button>` : ""}<button data-tool="hist"><span class="material-symbols-rounded">show_chart</span>Lịch sử</button></div><div class="set-toolbox" id="set-toolbox" hidden></div>` : ""}
    <div class="set-table${simple ? " simple" : ""}">
      <div class="set-head"><span>Hiệp</span>${timed ? `<span style="flex:2">Mục tiêu</span>` : `<span>${kgLabel}</span><span>Lần</span>${simple ? "" : `<span class="rpe-h">RPE</span>`}`}<span></span></div>
      ${rows.map((r,i)=>`
      <div class="set-row ${r.done?'done':''}" data-set="${i}">
        <b>${i+1}</b>
        ${timed ? `<span style="flex:2" class="small-note">${escapeHtml(String(item.reps))}</span>`
          : `<input type="text" inputmode="decimal" autocomplete="off" value="${escapeHtml(String(r.kg))}" data-kg="${i}" placeholder="kg" aria-label="${kgLabel} hiệp ${i+1}">
             <input type="number" inputmode="numeric" min="0" max="200" value="${escapeHtml(String(r.reps))}" data-reps="${i}" placeholder="lần" aria-label="Số lần hiệp ${i+1}">
             ${simple ? "" : `<select class="rpe" data-rpe="${i}" aria-label="RPE hiệp ${i+1}">${rpeOpts(r)}</select>`}`}
        <button class="set-check" data-done="${i}" aria-label="Xong hiệp ${i+1}"><span class="material-symbols-rounded">check</span></button>
      </div>`).join("")}
    </div>
    ${!timed ? (simple ? `<button type="button" class="btn btn-ghost btn-sm" id="set-show-rpe" style="margin-top:4px;">Hiện cột RPE (độ nặng cảm nhận)</button>`
      : `<p class="small-note" style="margin-top:4px;">RPE = độ nặng cảm nhận: 8 ≈ còn 2 lần nữa, 9 ≈ còn 1, 10 = hết sức.</p>`) : ""}
    <div class="set-rest" id="set-rest" hidden><span class="material-symbols-rounded">timer</span><b id="rest-num">0</b><small>giây nghỉ</small><button id="rest-plus">+15s</button><button id="rest-skip">Bỏ qua</button></div>
    <details class="set-guide"><summary>Hướng dẫn kỹ thuật</summary><p>${escapeHtml(meta.guide||"")}</p></details>
    <button class="btn btn-primary btn-block" id="btn-session-done" style="margin-top:12px;"><span class="material-symbols-rounded">check</span>${session.idx < session.items.length-1 ? "Xong bài — bài tiếp" : "Xong bài — kết thúc buổi"}</button>
    <button class="btn btn-ghost btn-block" id="btn-session-skip" style="margin-top:6px;">Bỏ qua bài này</button>
  `);
  if(item.clipId) mountClipVideo("#session-video", item.clipId);
  const clamp = (v,min,max)=> Math.min(max, Math.max(min, Number(v)||0));
  const kgInp = j=> $(`#sheet-content [data-kg="${j}"]`);
  const lastTopKg = Math.max(0, ...lastSets.map(x=> Number(x.kg)||0));
  const weighted = ()=> fkIsWeighted(meta, rows, last);
  /* QT-01: gõ kg ở 1 hiệp → tự điền xuống các hiệp sau chưa xong còn trống / chưa sửa tay / đang cùng giá trị cũ */
  const setKg = (i, raw)=>{
    const old = rows[i].kg;
    const v = Math.round(clamp(fkNum(raw), 0, 500) * 100) / 100;
    rows[i].kg = raw === "" ? "" : v; rows[i]._edited = true;
    if(!(v > 0)) return rows[i].kg;
    for(let j = i + 1; j < rows.length; j++){
      const r = rows[j]; if(r.done || r._edited) continue;
      if(r.kg === "" || r.kg == null || !(Number(r.kg) > 0) || String(r.kg) === String(old)){ r.kg = rows[i].kg; const n = kgInp(j); if(n && n.value !== undefined) n.value = r.kg; }
    }
    return rows[i].kg;
  };
  $$("#sheet-content [data-kg]").forEach(inp=>{
    inp.addEventListener("change", ()=>{ const v = setKg(Number(inp.dataset.kg), String(inp.value).trim()); inp.value = v; });
  });
  $$("#sheet-content [data-reps]").forEach(inp=> inp.addEventListener("change", ()=>{ const v = Math.round(clamp(inp.value,0,200)); inp.value = v; rows[inp.dataset.reps].reps = v; rows[inp.dataset.reps]._repsEdited = true; }));
  $$("#sheet-content [data-rpe]").forEach(sel=> sel.addEventListener("change", ()=>{ rows[sel.dataset.rpe].rpe = sel.value; }));
  const rpeBtn = $("#set-show-rpe");
  if(rpeBtn && rpeBtn.addEventListener) rpeBtn.addEventListener("click", ()=>{ state.profile.showRpe = true; saveState(); renderSessionStep(); });
  $$("#sheet-content [data-tool]").forEach(b=> b.addEventListener("click", ()=>{
    const box = $("#set-toolbox"); const k = b.dataset.tool;
    if(k==="hist"){ openExerciseHistory(key, meta.name, ()=>renderSessionStep()); return; }
    if(!box.hidden && box.dataset.k===k){ box.hidden = true; return; }
    box.dataset.k = k; box.hidden = false;
    const kg = Number((rows.find(r=>Number(r.kg)>0)||{}).kg)||0;
    box.innerHTML = k==="warm" ? warmupHTML(kg, meta, item.reps) : plateHTML(kg);
  }));
  $$("#sheet-content [data-done]").forEach(b=> b.addEventListener("click", ()=>{
    const i = Number(b.dataset.done); const r = rows[i];
    r.done = !r.done;
    // QT-01: bấm ✓ hiệp còn trống kg ở bài có tạ → lấy kg hiệp trước / buổi trước (hiện ngay trên ô)
    if(r.done && !timed && !(Number(r.kg) > 0) && weighted()){
      const prevKg = Number((rows.slice(0, i).reverse().find(x=> Number(x.kg) > 0) || {}).kg) || lastTopKg || Number((rows.find(x=> Number(x.kg) > 0) || {}).kg) || 0;
      if(prevKg > 0){ r.kg = prevKg; const n = kgInp(i); if(n && n.value !== undefined) n.value = prevKg; }
    }
    b.closest(".set-row").classList.toggle("done", r.done);
    if(r.done && i < rows.length-1 && Number(item.restSec) > 0) startSetRest(item.restSec);
  }));
  $("#btn-session-done").addEventListener("click", ()=>{
    let doneRows = rows.filter(r=>r.done);
    const isW = !timed && weighted();
    if(!doneRows.length){
      const miss = isW ? rows.filter(r=> !(Number(r.kg) > 0)).length : 0;
      const canFill = rows.some(r=> Number(r.kg) > 0) || lastTopKg > 0;
      const note = !miss ? "" : canFill ? `\n${miss} hiệp chưa có kg — app lấy theo hiệp trước / buổi trước.` : `\n${miss} hiệp chưa có kg — sẽ chỉ lưu số lần (không tính kỷ lục / tự tăng tạ).`;
      if(!confirm("Bạn chưa đánh dấu hiệp nào. Ghi nhận tất cả " + rows.length + " hiệp như đang hiển thị?" + note)) return;
      rows.forEach(r=>{ r.done = true; r._bulk = true; }); doneRows = rows;   // _bulk: ghi nhận cả loạt (không phải ✓ từng hiệp) — xem fkSessionCounts
    }
    if(isW){   // QT-01: hiệp trống kg kế thừa kg hiệp trước (hoặc buổi trước) — không bao giờ lưu 0 kg cho bài có tạ khi đã biết mức tạ
      const filled = fkFillBlankKg(rows, lastTopKg);
      rows.forEach((r, i)=>{ if(Number(filled[i].kg) > 0) r.kg = filled[i].kg; });
    }
    const keep = doneRows.map(r=>({ kg: Number(r.kg)||0, reps: timed ? 0 : Number(r.reps)||0, rpe: r.rpe ? Number(r.rpe) : undefined }));
    if(session.isToday) recordExerciseResult(key, meta.name, item.reps, keep, timed);
    try{ if(typeof fkTrack === "function") fkTrack("set_logged", { sets: keep.length, timed: !!timed, weighted: !!isW, exercise_index: session.idx, saved: !!session.isToday }); }catch(e){}
    session.completed.push(item.uid);
    stopSetRest(); saveState();
    session.idx++; renderSessionStep();
  });
  $("#btn-session-skip").addEventListener("click", ()=>{ stopSetRest(); session.idx++; renderSessionStep(); });
}
function stopSetRest(){ clearInterval(window._restTimer); window._restEnd = 0; cancelRestNotif(); const el = $("#set-rest"); if(el) el.hidden = true; }
/* R3-CORE-06: đồng hồ nghỉ đếm theo MỐC THỜI GIAN (Date.now) thay vì trừ dần mỗi nhịp setInterval — trình duyệt bóp timer khi
   khoá màn hình / chuyển app nên trước đây nghỉ 90 giây có thể kéo thành vài phút. Quay lại app → tính lại ngay (fkRestSync).
   Số giây ép về số (restSec dạng chuỗi "60" + 15 từng thành "6015"), kẹp 1–900. */
function fkRestLeft(){ return window._restEnd ? Math.max(0, Math.ceil((window._restEnd - Date.now()) / 1000)) : 0; }
function fkRestPaused(){ try{ const b = document.getElementById("fk-rest-pause"); return !!(b && b.getAttribute && b.getAttribute("aria-pressed") === "true"); }catch(e){ return false; } }
function fkRestSync(){
  const num = $("#rest-num"), box = $("#set-rest");
  if(!window._restEnd || fkRestPaused()) return false;
  if(!session || !num){ clearInterval(window._restTimer); window._restEnd = 0; return false; }
  const left = fkRestLeft();
  num.textContent = left;
  if(left <= 0){ clearInterval(window._restTimer); window._restEnd = 0; if(box) box.hidden = true; beep(); toast("Hết giờ nghỉ — vào hiệp tiếp!", "timer"); return false; }
  return true;
}
function startSetRest(sec){
  const box = $("#set-rest"); if(!box) return;
  sec = Math.min(FK_MAX_REST, Math.round(Number(sec)) || 0);
  if(!(sec > 0)) return;
  window._restEnd = Date.now() + sec * 1000;
  box.hidden = false; $("#rest-num").textContent = sec;
  scheduleRestNotif(sec);
  clearInterval(window._restTimer);
  window._restTimer = setInterval(fkRestSync, 1000);
  $("#rest-plus").onclick = ()=>{
    const paused = fkRestPaused();                                    // đang tạm dừng (morph-icons) → cộng vào số đang hiện, không chạy lại
    const left = (paused || !window._restEnd ? Math.max(0, parseInt($("#rest-num").textContent, 10) || 0) : fkRestLeft()) + 15;
    const capped = Math.min(FK_MAX_REST, left);
    if(!paused) window._restEnd = Date.now() + capped * 1000;
    $("#rest-num").textContent = capped; scheduleRestNotif(capped);
  };
  $("#rest-skip").onclick = stopSetRest;
}
/* Quay lại app sau khi khoá màn hình / chuyển tab: cập nhật ngay đồng hồ nghỉ + xin lại "giữ màn hình sáng" (wake lock tự nhả khi ẩn) */
try{ document.addEventListener("visibilitychange", ()=>{
  try{
    if(document.visibilityState && document.visibilityState !== "visible") return;
    if(window._restEnd) fkRestSync();
    if(session && !session.finished && !session.paused && session._awake) keepAwake(true);
    fkStorageAdopt();
  }catch(e){}
}); }catch(e){}
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
  clearInterval(window._restTimer); window._restEnd = 0;
  const endAt = Date.now() + (Math.max(0, Number(sec)) || 0) * 1000;   // R3-CORE-06: theo mốc thời gian
  const timer = window._restTimer = setInterval(()=>{
    if(!session || !$("#rest-num")){ clearInterval(timer); return; }   // đã đóng sheet → dừng đếm
    remain = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    const numEl = $("#rest-num");
    if(numEl) numEl.textContent = remain;
    if(remain<=0){ clearInterval(timer); session.idx++; renderSessionStep(); }
  },1000);
  $("#btn-skip-rest").addEventListener("click", ()=>{ clearInterval(timer); session.idx++; renderSessionStep(); });
}
function finishSession(){
  fkSessionGate(session);
  session.finished = true; onSheetCloseHook = null;
  keepAwake(false); clearInterval(window._restTimer); window._restEnd = 0; cancelRestNotif();
  // QT-01: khối lượng tính theo kg đã kế thừa (ô trống không còn = 0 kg)
  if(session.sets){ let vol=0; Object.values(session.sets).forEach(rs=>{ if(!Array.isArray(rs)) return; const anyKg = rs.some(r=> Number(r.kg) > 0); const f = anyKg ? fkFillBlankKg(rs, 0) : rs;
    rs.forEach((r, i)=>{ if(r.done) vol += (Number(f[i].kg)||0)*(Number(r.reps)||0); }); }); session.volume = Math.round(vol); }
  if(session.isToday){
    const dateKey = session.date || todayStr();          // QT-07: ngày chốt lúc bắt đầu buổi
    const prev = state.workoutLog[dateKey];
    const merged = (prev && prev.dayKey===session.dayKey ? (prev.completedExerciseIds || []) : []).concat(session.completed);
    const entry = { dayKey: session.dayKey, completedExerciseIds: Array.from(new Set(merged)), finishedAt: Date.now() };
    if(prev && prev.dayKey && prev.dayKey !== session.dayKey && prev.finishedAt){   // QT-06: buổi thứ 2 trong ngày — giữ dấu buổi trước
      entry.earlier = (Array.isArray(prev.earlier) ? prev.earlier : []).concat([{ dayKey: prev.dayKey, completedExerciseIds: prev.completedExerciseIds || [], finishedAt: prev.finishedAt }]).slice(-4);
    }
    if(session.makeup){ entry.makeup = true; const orig = fkMakeupOrigin(session.dayKey, dateKey); if(orig) entry.makeupFor = orig; }
    else if(prev && prev.dayKey === session.dayKey && prev.makeupFor){ entry.makeup = true; entry.makeupFor = prev.makeupFor; }
    state.workoutLog[dateKey] = entry;
    saveState();
    updateFinishedDates(dateKey);
  }
  try{
    const saved = !!session.isToday;
    if(typeof fkTrack === "function") fkTrack("workout_finish", { completed: session.completed.length, total: session.items.length, saved, too_short: !!session.tooShort,
      makeup: !!session.makeup, duration_min: Math.round((Date.now() - (Number(session.startedAt) || Date.now())) / 60000), volume_kg: Math.round((session.volume || 0) / 100) * 100 });
    if(window.FKFeedback && typeof FKFeedback.afterWorkout === "function") FKFeedback.afterWorkout(saved);   // nút "Góp ý" nổi + NPS (sau buổi thứ 5)
  }catch(e){}
  const saveNote = session.tooShort ? "" : session.makeup ? " · Đã lưu (tập bù) vào nhật ký hôm nay" : session.isToday ? " · Đã lưu vào nhật ký" : " · Chế độ xem trước, chưa lưu";
  openSheet(`
    <div style="text-align:center;padding:16px 0;">
      <span class="material-symbols-rounded" style="font-size:56px;color:var(--success);">military_tech</span>
      <h3 style="font-size:22px;margin-top:10px;">Hoàn thành buổi tập!</h3>
      <p class="small-note" style="margin-top:6px;">${session.completed.length}/${session.items.length} bài tập đã hoàn thành${saveNote}</p>
      ${session.tooShort ? `<p class="small-note set-hint" style="margin-top:10px;">Buổi dưới 3 phút và chưa ghi hiệp nào (✓ từng hiệp hoặc nhập số lần) — <b>không tính</b> vào nhật ký, chuỗi ngày tập và thành tích.</p>` : ""}
      ${session.volume ? `<p style="margin-top:10px;font-size:15px;">Tổng khối lượng: <b>${session.volume.toLocaleString("vi-VN")} kg</b></p>` : ""}
      ${session.prs && session.prs.length ? `<div class="pr-list">${session.prs.map(x=>`<div>🏆 <b>${escapeHtml(x.name)}</b> — kỷ lục mới ~${escapeHtml(String(x.e1rm))} kg (1RM ước tính)</div>`).join("")}</div>` : ""}
      <button class="btn btn-primary btn-block" style="margin-top:20px;" onclick="closeSheet();fkRenderActive();">Xong</button>
    </div>
  `);
  session = null;
}
/* "Buổi < 3 phút" (QA-training §2.6, FIX-training §4.5): buổi chỉ được ghi vào nhật ký (workoutLog), finishedDates / chuỗi ngày tập
   (và vì thế XP, huy hiệu, nhật ký training-pro) khi kéo dài ≥ 3 phút HOẶC có ≥ 1 hiệp người tập tự ghi số lần
   (✓ từng hiệp hoặc nhập số lần). Bấm "Xong bài" liên tục rồi "Ghi nhận tất cả" (r._bulk) trong < 3 phút → không tính.
   Buổi không có startedAt (dữ liệu/luồng cũ) → tính như trước. */
const FK_MIN_SESSION_SEC = 180;
function fkSessionCounts(s){
  if(!s) return false;
  const t0 = Number(s.startedAt) || 0;
  if(!(t0 > 0) || (Date.now() - t0) / 1000 >= FK_MIN_SESSION_SEC) return true;
  const sets = s.sets && typeof s.sets === "object" ? Object.values(s.sets) : [];
  return sets.some(rs=> Array.isArray(rs) && rs.some(r=> r && r.done && (!r._bulk || r._repsEdited) && Number(r.reps) > 0));
}
/* Chốt 1 lần trước finishSession (gọi trong renderSessionStep để MỌI lớp bọc finishSession — training-pro, achievements,
   pt-connect — đọc session.isToday = false): buổi quá ngắn → chuyển sang "không lưu" + đánh dấu tooShort. */
function fkSessionGate(s){
  try{
    if(!s || s._gated) return;
    s._gated = true;
    if(s.isToday && !fkSessionCounts(s)){ s.tooShort = true; s.isToday = false; s.makeup = false; }
  }catch(e){}
}
/* Ngày gốc của buổi tập bù: ngày gần nhất TRƯỚC hôm đó (≤ 6 ngày) có thứ = dayKey và chưa tập */
function fkMakeupOrigin(dayKey, dateKey){
  const base = fkDateOf(dateKey || todayStr());
  for(let back = 1; back <= 6; back++){
    const d = new Date(base); d.setDate(base.getDate() - back);
    if(todayDayKey(d) === dayKey){ const ds = todayStr(d); return (state.finishedDates || []).includes(ds) ? null : ds; }
  }
  return null;
}
/* Vẽ lại màn đang mở (sau khi đóng màn kết thúc buổi tập từ Trang chủ / Tập luyện) */
function fkRenderActive(){
  const cur = (($(".screen.active") || {}).id || "").replace("screen-", "");
  try{
    if(cur === "home" && typeof renderHomeScreen === "function") renderHomeScreen();
    else if(cur === "profile") renderProfileScreen();
    else if(cur === "nutrition") renderNutritionScreen();
    else if(cur === "coach" && typeof renderCoachScreen === "function") renderCoachScreen(false);
    else renderWorkoutScreen();
  }catch(e){ try{ console.warn("[render]", e); }catch(_){} }
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
    <div class="clip-thumb" data-clip="${Number(m.id)}">
      <video muted preload="metadata" data-src-id="${Number(m.id)}"></video>
      <div class="cat-badge">${escapeHtml(catLabel(m.category))}</div>
      <div class="play-badge"><span class="material-symbols-rounded">play_circle</span></div>
      <button class="del-btn" data-del="${Number(m.id)}" aria-label="Xoá video"><span class="material-symbols-rounded" style="font-size:14px;">close</span></button>
    </div>`;
}
function bindClipGrid(grid, onChange){
  grid.querySelectorAll("video[data-src-id]").forEach(async v=>{
    const u = await fkBlobUrl("clip", Number(v.dataset.srcId));
    if(u) v.src = u;
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
        try{ await dbDeleteClip(id); }catch(e){}
        fkBlobUrlDrop("clip", id);
        /* R3-CORE-08: gỡ luôn video khỏi các bài đang gắn (trước đây bài vẫn trỏ tới clip đã xoá → khung video đen) */
        Object.values(state.plans || {}).forEach(pl=> Object.values((pl && pl.days) || {}).forEach(d=> (Array.isArray(d && d.items) ? d.items : []).forEach(it=>{ if(it && Number(it.clipId) === id) it.clipId = null; })));
        state.videoLibrary = state.videoLibrary.filter(m=>m.id!==id);
        saveState();
        onChange();
        toast("Đã xoá video", "delete");
      }, "Xoá video", "delete_forever");
    });
  });
}
async function openClipPlayer(id){
  let rec = null;
  try{ rec = await dbGetClip(id); }catch(e){}
  const url = rec ? await fkBlobUrl("clip", id) : null;
  if(!rec || !url){ toast("Không mở được video — có thể đã bị xoá khỏi bộ nhớ máy.", "error"); return; }
  const meta = state.videoLibrary.find(m=>m.id===id);
  openSheet(`
    <video id="player-video" src="${attrUrl(url)}" controls autoplay playsinline style="width:100%;aspect-ratio:16/9;max-height:65vh;object-fit:${getClipFit(id)};border-radius:14px;background:#000;"></video>
    <button class="btn btn-outline btn-block" id="player-fit-toggle" style="margin-top:10px;">${fitToggleLabel(getClipFit(id))}</button>
    <div class="chip-row" style="margin-top:12px;">${meta?`<span class="pill hot">${catLabel(meta.category)}</span>`:""}</div>
    <h3 style="margin-top:8px;font-size:16px;">${escapeHtml(rec.name)}</h3>
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
      <span style="font-size:12px;">MP4, MOV, dọc hoặc ngang đều được — lưu ngay trên thiết bị của bạn</span>
      <input type="file" accept="video/*" id="clip-input">
    </div>
    <div id="upload-preview-wrap" style="display:none;margin-top:14px;">
      <video id="upload-preview" muted playsinline style="width:100%;max-height:38vh;border-radius:14px;background:#000;aspect-ratio:16/9;object-fit:contain;"></video>
      <p class="small-note" id="upload-orientation-note" style="margin-top:6px;"></p>
    </div>
    <div class="field" style="margin-top:14px;">
      <label>Đặt tên clip</label>
      <input type="text" id="clip-name" maxlength="80" placeholder="VD: Bench press hôm nay">
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
    /* R3-CORE-14: chỉ nhận video, ≤ 300 MB (video quá lớn làm đầy bộ nhớ máy và hỏng cả lần lưu khác) */
    if(file.type && !/^video\//i.test(file.type)){ toast("Hãy chọn một tệp video (MP4, MOV…).", "error"); e.target.value = ""; return; }
    if(Number(file.size) > 300 * 1024 * 1024){ toast("Video lớn hơn 300 MB — hãy cắt ngắn hoặc giảm chất lượng rồi tải lại.", "error"); e.target.value = ""; return; }
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
    const name = String($("#clip-name").value || pickedFile.name || "Video").trim().slice(0, 80) || "Video";
    const category = $("#clip-cat").value;
    const fit = $("#clip-fit").value;
    if(confirmBtn.disabled) return;                      // chống bấm 2 lần → lưu trùng
    confirmBtn.disabled = true; confirmBtn.textContent = "Đang lưu…";
    let id;
    try{ id = await dbAddClip(pickedFile, name); }
    catch(err){
      confirmBtn.disabled = false; confirmBtn.textContent = "Lưu video";
      toast(/quota/i.test(String(err && (err.name || err.message))) ? "Bộ nhớ máy đầy — chưa lưu được video. Xoá bớt video cũ rồi thử lại." : `Chưa lưu được video: ${(err && err.message) || "trình duyệt không cho lưu tệp trên máy"}`, "error");
      return;
    }
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
  fkBlobUrl("clip", clipId).then(u=>{
    if(u && videoEl) videoEl.src = u;
    else if(!u && videoEl && videoEl.insertAdjacentHTML){ try{ videoEl.insertAdjacentHTML("afterend", `<p class="small-note" style="margin:-8px 0 12px;">Không mở được video này trên máy (có thể đã bị xoá khi dọn bộ nhớ). Hãy gắn lại video cho bài tập.</p>`); videoEl.style.display = "none"; }catch(e){} }
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
        <div class="clip-thumb" data-pick-clip="${Number(v.id)}">
          <video muted preload="metadata" data-thumb-clip="${escapeHtml(String(v.id))}"></video>
          <div class="cat-badge">${escapeHtml(catLabel(v.category))}</div>
          <div class="play-badge"><span class="material-symbols-rounded">play_circle</span></div>
        </div>`).join("") : `<p class="empty-hint">Chưa có video nào trong danh mục này. Hãy tải video mới!</p>`}</div>
    `);
    $$("[data-pcat]").forEach(b=> b.addEventListener("click", ()=>{ cat=b.dataset.pcat; render(); }));
    $$("#picker-grid [data-thumb-clip]").forEach(async v=>{
      const u = await fkBlobUrl("clip", Number(v.dataset.thumbClip));
      if(u) v.src = u;
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
    title.textContent = "Giáo án";   // GLOSSARY §8.1: "Giáo án" (không dùng "Chương trình")
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
/* QU-18 (vòng 2): màn "Giáo án" = mục gộp của menu ☰ — Lịch tuần · Giáo án mẫu · Tạo giáo án riêng · Giáo án của tôi */
function renderPlanListHTML(){
  return `<div class="chip-row" style="margin-bottom:10px;"><button type="button" class="btn btn-outline btn-sm" onclick="goto('workout')"><span class="material-symbols-rounded">calendar_month</span>Lịch tuần</button></div>
    <button class="tpl-banner" onclick="openTemplateBrowser()"><span class="material-symbols-rounded">school</span><div><b>Giáo án mẫu</b><small>Nam · Nữ · Mới tập → Nâng cao (5×5, PHUL, PPL, Glute, Couch to 5K…)</small></div><span class="material-symbols-rounded">chevron_right</span></button>
    ${typeof openProgramBuilder === "function" ? `<button class="tpl-banner" style="margin-top:8px;" onclick="openProgramBuilder()"><span class="material-symbols-rounded">pb_spark</span><div><b>Tạo giáo án riêng</b><small>Trả lời vài câu — app soạn giáo án theo mục tiêu, lịch và dụng cụ của bạn</small></div><span class="material-symbols-rounded">chevron_right</span></button>` : ""}
    <h3 style="font-size:15px;margin:16px 0 4px;">Giáo án của tôi</h3>
    <p class="small-note" style="margin:0 0 12px;">Tạo nhiều giáo án, thêm bài tập của riêng bạn và chọn giáo án đang áp dụng.</p>` +
    Object.values(state.plans).map(plan=>{
    const activeDays = Object.values(plan.days).filter(d=>d.items.length).length;
    const isActive = plan.id === state.activePlanId;
    return `
    <div class="plan-card ${isActive?'active':''}" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div>
          <h3 style="font-size:16px;">${escapeHtml(plan.name)}</h3>
          <p class="small-note" style="margin-top:2px;">${activeDays} buổi/tuần · ${plan.builtin?'Mẫu có sẵn':'Tự tạo'}</p>
        </div>
        ${isActive ? `<span class="badge-pro" style="font-size:12px;padding:4px 10px;white-space:nowrap;">Đang dùng</span>` : ""}
      </div>
      <div class="chip-row" style="margin-top:12px;">
        ${!isActive ? `<button class="btn btn-primary btn-sm" data-plan-use="${escapeHtml(plan.id)}">Dùng giáo án</button>` : ""}
        <button class="btn btn-outline btn-sm" data-plan-edit="${escapeHtml(plan.id)}">Sửa</button>
        <button class="btn btn-outline btn-sm" data-plan-dup="${escapeHtml(plan.id)}">Nhân bản</button>
        ${!plan.builtin ? `<button class="btn btn-ghost btn-sm" data-plan-del="${escapeHtml(plan.id)}">Xoá</button>` : `<button class="btn btn-ghost btn-sm" data-plan-reset="${escapeHtml(plan.id)}">Khôi phục mặc định</button>`}
      </div>
    </div>`;
  }).join("");
}
function resetPlanToDefault(planId){
  const original = seedPlansFromPrograms()[planId];
  if(!original) return;
  confirmDialog("Khôi phục giáo án mặc định?", `Toàn bộ chỉnh sửa của bạn cho "${escapeHtml(state.plans[planId].name)}" (bài tập, video đã gắn, cường độ...) sẽ mất, quay về nội dung gốc.`, ()=>{
    state.plans[planId] = original;
    saveState(); renderPlansScreen(); renderWorkoutScreen();
    toast("Đã khôi phục giáo án mặc định");
  });
}
function bindPlanListEvents(){
  $$("#plans-content [data-plan-use]").forEach(b=> b.addEventListener("click", ()=>{
    state.activePlanId=b.dataset.planUse; saveState(); renderPlansScreen(); renderWorkoutScreen();
    toast("Đã chuyển giáo án");
  }));
  $$("#plans-content [data-plan-edit]").forEach(b=> b.addEventListener("click", ()=>{
    plansUI = { mode:"edit", planId:b.dataset.planEdit, day: todayDayKey() }; renderPlansScreen();
  }));
  $$("#plans-content [data-plan-reset]").forEach(b=> b.addEventListener("click", ()=> resetPlanToDefault(b.dataset.planReset)));
  $$("#plans-content [data-plan-dup]").forEach(b=> b.addEventListener("click", ()=>{
    const p = duplicatePlan(b.dataset.planDup); if(!p){ toast("Không tìm thấy giáo án để nhân bản", "error"); renderPlansScreen(); return; } toast(`Đã nhân bản: ${p.name}`); renderPlansScreen();
  }));
  $$("#plans-content [data-plan-del]").forEach(b=> b.addEventListener("click", ()=>{
    if(Object.keys(state.plans).length<=1){ toast("Cần giữ lại ít nhất 1 giáo án", "error"); return; }
    const id = b.dataset.planDel;
    openSheet(`
      <div style="text-align:center;padding:10px 0;">
        <span class="material-symbols-rounded" style="font-size:44px;color:var(--warn);">warning</span>
        <h3 style="margin-top:10px;">Xoá giáo án này?</h3>
        <p class="small-note" style="margin-top:6px;">${escapeHtml(state.plans[id].name)} sẽ bị xoá vĩnh viễn.</p>
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
      toast("Đã xoá giáo án");
    });
  }));
}
function promptCreatePlan(){
  openSheet(`
    <h3 style="margin-bottom:14px;">Tạo giáo án mới</h3>
    <div class="field"><label>Tên giáo án</label><input type="text" id="new-plan-name" maxlength="60" placeholder="VD: Giáo án của tôi"></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-create-plan">Tạo &amp; bắt đầu thêm bài tập</button>
  `);
  $("#btn-create-plan").addEventListener("click", ()=>{
    const name = fkCleanName($("#new-plan-name").value, "Giáo án mới");
    const plan = createBlankPlan(name);
    closeSheet();
    plansUI = { mode:"edit", planId: plan.id, day: todayDayKey() };
    renderPlansScreen();
    toast("Đã tạo giáo án — giờ hãy thêm bài tập cho từng ngày!");
  });
}
function renamePlanPrompt(planId){
  const plan = state.plans[planId];
  openSheet(`
    <h3 style="margin-bottom:14px;">Đổi tên giáo án</h3>
    <div class="field"><input type="text" id="rename-plan-input" maxlength="60" value="${escapeHtml(plan.name)}"></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-rename">Lưu</button>
  `);
  $("#btn-save-rename").addEventListener("click", ()=>{
    plan.name = fkCleanName($("#rename-plan-input").value, plan.name);
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
      <div class="field"><label>Tên buổi tập</label><input type="text" id="pd-title" maxlength="60" value="${escapeHtml(day.title)}"></div>
      <div class="field-row" style="margin-top:10px;">
        <div class="field"><label>Cường độ</label>
          <select id="pd-intensity">${INTENSITY_LEVELS.map(x=>`<option ${x===day.intensity?'selected':''}>${x}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Thời lượng (phút)</label><input type="number" inputmode="numeric" min="0" max="600" id="pd-duration" value="${escapeHtml(String(Number(day.duration)||0))}"></div>
      </div>
      ${plan.builtin ? `<button class="btn btn-ghost btn-block" style="margin-top:10px;" id="pd-reset-day">Khôi phục ngày này về mặc định</button>` : ""}
    </div>
    <div class="section-title" style="margin-top:14px;"><h3>Bài tập (${day.items.length})</h3><a id="pd-add-exercise">+ Thêm bài tập</a></div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${day.items.map(it=>{
        const meta = getExerciseMeta(it);
        return `<div class="list-item" data-item="${escapeHtml(String(it.uid))}">
          <div class="thumb-wrap">
            ${it.clipId ? `<video muted preload="metadata" data-thumb-clip="${escapeHtml(String(it.clipId))}"></video>` : `<img src="${attrUrl((it.stock && it.stock.thumb) || meta.img)}" alt="${escapeHtml(meta.name)}" loading="lazy">`}
            ${it.clipId ? `<div class="cam-badge"><span class="material-symbols-rounded">videocam</span></div>` : ""}
          </div>
          <div class="info"><div class="name">${escapeHtml(meta.name)}</div><div class="meta">${escapeHtml(meta.muscle||"")} · ${escapeHtml(String(it.sets))} hiệp × ${escapeHtml(String(it.reps))}</div></div>
          <span class="material-symbols-rounded" style="color:var(--text-dim);">chevron_right</span>
        </div>`;
      }).join("") || `<p class="empty-hint">Chưa có bài tập nào cho ngày này.</p>`}
    </div>
  `;
}
function bindPlanEditorEvents(plan){
  $$("#plans-content [data-pday]").forEach(b=> b.addEventListener("click", ()=>{ plansUI.day=b.dataset.pday; renderPlansScreen(); }));
  $("#pd-title").addEventListener("change", ()=>{ plan.days[plansUI.day].title = fkCleanName($("#pd-title").value, plan.days[plansUI.day].title); $("#pd-title").value = plan.days[plansUI.day].title; saveState(); });
  $("#pd-intensity").addEventListener("change", ()=>{ plan.days[plansUI.day].intensity=$("#pd-intensity").value; saveState(); });
  $("#pd-duration").addEventListener("change", ()=>{ const v = Math.min(600, Math.max(0, Math.round(Number($("#pd-duration").value) || 0))); plan.days[plansUI.day].duration = v; $("#pd-duration").value = v; saveState(); });
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
    const u = await fkBlobUrl("clip", Number(v.dataset.thumbClip));
    if(u) v.src = u;
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
        <div class="food-result" data-pick-ex="${id}" style="cursor:pointer;"><div><div class="name">${escapeHtml(ex.name)}</div><div class="kcal">${ex.muscle}</div></div><span class="material-symbols-rounded" style="color:var(--text-dim);">add_circle</span></div>
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
      <div class="field"><label>Tên bài tập*</label><input type="text" id="cex-name" maxlength="60" placeholder="VD: Đẩy tạ máy Smith"></div>
      <div class="field" style="margin-top:10px;"><label>Nhóm cơ</label><select id="cex-muscle">${MUSCLE_GROUPS.map(m=>`<option>${m}</option>`).join("")}</select></div>
      <div class="field" style="margin-top:10px;"><label>Dụng cụ</label><input type="text" id="cex-equip" maxlength="40" placeholder="VD: Máy Smith"></div>
      <div class="field-row" style="margin-top:10px;">
        <div class="field"><label>Số hiệp</label><input type="number" inputmode="numeric" min="1" max="20" id="cex-sets" value="3"></div>
        <div class="field"><label>Số lần / thời gian</label><input type="text" maxlength="24" id="cex-reps" value="12"></div>
        <div class="field"><label>Nghỉ (giây)</label><input type="number" inputmode="numeric" min="0" max="900" id="cex-rest" value="60"></div>
      </div>
      <div class="field" style="margin-top:10px;"><label>Hướng dẫn kỹ thuật (không bắt buộc)</label><textarea id="cex-guide" rows="3" maxlength="1000" placeholder="Mô tả cách thực hiện đúng..."></textarea></div>
      <button class="btn btn-primary btn-block" style="margin-top:14px;" id="btn-add-custom-ex">Thêm vào buổi tập</button>
    `;
    $("#btn-add-custom-ex").addEventListener("click", ()=>{
      const name = fkCleanName($("#cex-name").value);
      if(!name){ toast("Vui lòng nhập tên bài tập", "error"); try{ $("#cex-name").focus(); }catch(e){} return; }
      plan.days[dayKey].items.push({
        uid: uid(), exerciseId: null,
        custom: { name, muscle: $("#cex-muscle").value, equipment: fkCleanName($("#cex-equip").value).slice(0, 40), guide: String($("#cex-guide").value || "").slice(0, 1000) },
        sets: fkClampSets($("#cex-sets").value, 3), reps: fkCleanReps($("#cex-reps").value, "12"), restSec: fkClampRest($("#cex-rest").value, 60),
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
      <div class="sheet-header"><h3>${escapeHtml(meta.name)}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
      <div id="pie-media" style="margin-bottom:12px;"></div>
      <button class="btn btn-outline btn-block" id="pie-attach"><span class="material-symbols-rounded">videocam</span>${item.clipId?'Đổi video':'Gắn video cho bài này'}</button>
      ${item.clipId ? `<button class="btn btn-ghost btn-block" style="margin-top:8px;" id="pie-remove-clip">Gỡ video</button>` : ""}
      <div class="field-row" style="margin-top:16px;">
        <div class="field"><label>Số hiệp</label><input type="number" inputmode="numeric" min="1" max="20" id="pie-sets" value="${escapeHtml(String(item.sets))}"></div>
        <div class="field"><label>Số lần</label><input type="text" maxlength="24" id="pie-reps" value="${escapeHtml(String(item.reps))}"></div>
        <div class="field"><label>Nghỉ (giây)</label><input type="number" inputmode="numeric" min="0" max="900" id="pie-rest" value="${escapeHtml(String(item.restSec))}"></div>
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
      mediaEl.innerHTML = `<img src="${attrUrl((item.stock && item.stock.thumb) || meta.img)}" alt="${escapeHtml(meta.name)}" style="width:100%;height:150px;object-fit:cover;border-radius:14px;">`;   // QS-04
    }
    $("#pie-attach").addEventListener("click", ()=>{
      openClipPicker((clipId)=>{ item.clipId = clipId; saveState(); render(); renderPlansScreen(); });
    });
    if(item.clipId){
      $("#pie-remove-clip").addEventListener("click", ()=>{ item.clipId=null; saveState(); render(); renderPlansScreen(); });
    }
    $("#pie-save").addEventListener("click", ()=>{
      /* R3-CORE-05: kẹp 1–20 hiệp, 0–900 giây (trước đây "0 giây nghỉ" không lưu được, số âm / cực lớn lưu nguyên) */
      item.sets = fkClampSets($("#pie-sets").value, fkClampSets(item.sets, 3));
      item.reps = fkCleanReps($("#pie-reps").value, fkCleanReps(item.reps, "12"));
      item.restSec = fkClampRest($("#pie-rest").value, fkClampRest(item.restSec, 60));
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
let progressUI = { tab: "records", compareSel: [] };   // QU-21: mở Tiến độ ở tab Kỷ lục

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
      <div class="sheet-header"><h3>Chụp ảnh tiến độ</h3><button class="icon-btn" id="cap-close"><span class="material-symbols-rounded">close</span></button></div>
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
      let id;
      try{ id = await dbAddPhoto(capturedBlob, `progress_${angle}_${Date.now()}`); }
      catch(err){ toast(/quota/i.test(String(err && (err.name || err.message))) ? "Bộ nhớ máy đầy — chưa lưu được ảnh. Xoá bớt video/ảnh cũ rồi thử lại." : `Chưa lưu được ảnh: ${(err && err.message) || "trình duyệt không cho lưu tệp trên máy"}`, "error"); return; }
      state.progressPhotos.push({ id, ts: Date.now(), angle, weightAtCapture: state.profile.weight, note:"" });
      saveState();
      stopCamera();
      closeSheet();
      toast("Đã lưu ảnh tiến độ!");
      if(onDone) onDone(id);
    });
  }
  render();
}

/* ---- Màn hình Tiến độ: Kỷ lục · Ảnh tiến độ · Chỉ số InBody (QU-21) ---- */
function renderProgressScreen(){
  fkEnsureRecordsTab();
  if(!["records","photos","inbody"].includes(progressUI.tab)) progressUI.tab = "records";
  $$("#progress-tabs .day-tab").forEach(b=>{ const on = b.dataset.ptab===progressUI.tab; b.classList.toggle("active", on); try{ b.setAttribute("aria-pressed", on ? "true" : "false"); }catch(e){} });
  if(progressUI.tab==="records") renderProgressRecordsTab();
  else if(progressUI.tab==="photos") renderProgressPhotosTab();
  else renderProgressInbodyTab();
}
/* QU-21: tab "Kỷ lục" đứng đầu màn Tiến độ (Kỷ lục · Ảnh tiến độ · Chỉ số InBody). index.html (ux) chỉ có 2 tab tĩnh →
   chèn nút tab bằng JS nếu thiếu; bấm tab qua 1 trình nghe uỷ quyền trên #progress-tabs (nút tĩnh hay chèn đều chạy). */
function fkEnsureRecordsTab(){
  try{
    const tabs = document.getElementById("progress-tabs");
    if(!tabs || !tabs.querySelectorAll) return;
    if([...tabs.querySelectorAll("[data-ptab]")].some(b=> b.dataset && b.dataset.ptab === "records")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "day-tab"; b.setAttribute("data-ptab", "records"); b.textContent = "Kỷ lục";
    tabs.insertBefore(b, tabs.firstElementChild || null);
  }catch(e){}
}
/* Mở màn Tiến độ ở 1 tab ("records" | "photos" | "inbody") — cho module khác (Nhật ký & kỷ lục…) */
function openProgress(tab){
  if(["records","photos","inbody"].includes(tab)) progressUI.tab = tab;
  goto("progress");
}
/* Kỷ lục số lần cho bài trọng lượng cơ thể (QT-17 phần còn lại): bài trong setHist không có tạ (e1RM = 0) → số lần cao nhất/hiệp */
function fkRepRecords(){
  const H = state.setHist || {};
  return Object.entries(H).filter(([k, h])=> h && Array.isArray(h.list) && h.list.length).map(([k, h])=>{
    let best = 0, date = "";
    h.list.forEach(x=> (Array.isArray(x && x.sets) ? x.sets : []).forEach(s=>{ const r = Number(s && s.reps) || 0; if(!(Number(s && s.kg) > 0) && r > best){ best = r; date = x.date || ""; } }));
    const e1 = Math.max(0, ...h.list.map(x=> Number(x && x.e1rm) || 0));
    return { k, name: h.name || k, best, date, n: h.list.length, e1 };
  }).filter(x=> x.best > 0 && !(x.e1 > 0)).sort((a, b)=> b.best - a.best);
}
function renderProgressRecordsTab(){
  const box = $("#progress-content"); if(!box) return;
  const reps = fkRepRecords();
  const sessions = Array.isArray(state.finishedDates) ? state.finishedDates.length : 0;
  const nPR = Object.values(state.setHist || {}).filter(h=> h && Array.isArray(h.list) && h.list.some(x=> Number(x && x.e1rm) > 0)).length;
  const repRows = reps.length ? `<div class="card-title pr-rep-h" style="font-size:14px;margin-top:12px;"><span class="material-symbols-rounded">self_improvement</span>Kỷ lục số lần (trọng lượng cơ thể)</div>
    ${reps.slice(0, 12).map(x=> `<div class="tb-row" data-prr="${escapeHtml(x.k)}"><span>${escapeHtml(x.name)}</span><b>${Number(x.best) || 0} lần</b><small>${x.date && x.date.length >= 10 ? escapeHtml(x.date.slice(8,10) + "/" + x.date.slice(5,7)) : ""} ›</small></div>`).join("")}
    <p class="small-note">Số lần cao nhất trong 1 hiệp.</p>` : "";
  /* 1 thẻ "Kỷ lục cá nhân" (.pr-card — training-pro chèn thẻ Khối lượng tuần ngay sau): 1RM ước tính + số lần cao nhất */
  let pr = prCardHTML();
  if(pr && repRows) pr = pr.replace(/<\/div>\s*$/, repRows + "</div>");
  else if(!pr && repRows) pr = `<div class="card pr-card"><div class="card-title"><span class="material-symbols-rounded">military_tech</span>Kỷ lục cá nhân</div>${repRows}</div>`;
  const repCard = "";
  const links = [
    typeof FKAch === "object" && FKAch && typeof FKAch.open === "function" ? `<button type="button" class="btn btn-outline btn-sm" data-prl="ach"><span class="material-symbols-rounded">military_tech</span>Thành tích &amp; huy hiệu</button>` : "",
    typeof FKTP === "object" && FKTP && typeof FKTP.openLogSheet === "function" ? `<button type="button" class="btn btn-outline btn-sm" data-prl="log"><span class="material-symbols-rounded">history</span>Nhật ký buổi tập</button>` : "",
  ].join("");
  box.innerHTML = `
    <p class="small-note">Kỷ lục tự cập nhật sau mỗi buổi tập có ghi kg × lần. 1RM ước tính theo công thức Epley.</p>
    ${pr}${repCard}
    ${!pr && !repCard ? `<div class="card"><p class="empty-hint" style="margin:0;">Chưa có kỷ lục nào. Hoàn thành 1 buổi tập và ghi kg × lần từng hiệp — app tự tính 1RM ước tính và số lần cao nhất.</p></div>` : ""}
    <div class="stat-row" style="display:flex;gap:10px;margin:12px 0;">
      <div class="stat-box" style="flex:1;"><div class="num">${sessions}</div><div class="cap">Buổi đã tập</div></div>
      <div class="stat-box" style="flex:1;"><div class="num">${nPR}</div><div class="cap">Bài có kỷ lục tạ</div></div>
      <div class="stat-box" style="flex:1;"><div class="num">${reps.length}</div><div class="cap">Bài có kỷ lục số lần</div></div>
    </div>
    ${links ? `<div class="chip-row" style="margin-top:4px;">${links}</div>` : ""}`;
  $$("#progress-content [data-pr]").forEach(r=> r.addEventListener("click", ()=>{ const h = (state.setHist || {})[r.dataset.pr]; if(h) openExerciseHistory(r.dataset.pr, h.name); }));
  $$("#progress-content [data-prr]").forEach(r=> r.addEventListener("click", ()=>{ const h = (state.setHist || {})[r.dataset.prr]; if(h) openExerciseHistory(r.dataset.prr, h.name); }));
  $$("#progress-content [data-prl]").forEach(b=> b.addEventListener("click", ()=>{ try{ if(b.dataset.prl === "ach") FKAch.open(); else FKTP.openLogSheet(); }catch(e){} }));
}

function photoRowHTML(p){
  const checked = progressUI.compareSel.includes(p.id);
  return `
    <div class="card" style="padding:10px;display:flex;gap:12px;align-items:center;" data-prow="${Number(p.id)}">
      <div class="thumb-wrap" style="width:64px;height:84px;">
        <img data-pimg="${Number(p.id)}" alt="" style="object-fit:cover;">
        <div class="cam-badge" style="background:var(--surface-3);"><span class="material-symbols-rounded" style="font-size:12px;">photo_camera</span></div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <span class="pill hot" style="padding:3px 8px;">${escapeHtml(angleLabel(p.angle))}</span>
          <span class="small-note">${new Date(p.ts).toLocaleDateString("vi-VN")}</span>
        </div>
        <p class="small-note" style="margin-top:4px;">${p.weightAtCapture ? `Cân nặng lúc chụp: ${escapeHtml(fmtKg(p.weightAtCapture))}kg` : ""}</p>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center;">
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text-muted);">
            <input type="checkbox" data-pcompare="${Number(p.id)}" ${checked?'checked':''}> So sánh
          </label>
          <button class="btn btn-ghost btn-sm" data-pai="${Number(p.id)}" style="padding:4px 10px;">Phân tích AI</button>
          <button class="btn btn-ghost btn-sm" data-pdel="${Number(p.id)}" style="padding:4px 10px;color:var(--warn);">Xoá</button>
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
    ${list.length===0 ? `<p class="empty-hint">Chưa có ảnh tiến độ nào. Hãy chụp ảnh đầu tiên!</p>` : `
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
    const u = await fkBlobUrl("photo", Number(imgEl.dataset.pimg));
    if(u && imgEl) imgEl.src = u;
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
    confirmDialog("Xoá ảnh tiến độ này?", "Ảnh sẽ bị xoá vĩnh viễn khỏi thiết bị và không thể khôi phục.", async ()=>{
      try{ await dbDeletePhoto(id); }catch(e){}
      fkBlobUrlDrop("photo", id);
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
  const url = p ? await fkBlobUrl("photo", photoId) : null;
  if(!p || !url){ if(p) toast("Không mở được ảnh — có thể đã bị xoá khỏi bộ nhớ máy.", "error"); return; }
  openSheet(`
    <div class="sheet-header"><h3>Ảnh tiến độ</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <img src="${attrUrl(url)}" alt="Ảnh tiến độ ${escapeHtml(angleLabel(p.angle))}" style="width:100%;max-height:58vh;object-fit:contain;border-radius:14px;background:#000;">
    <div class="chip-row" style="margin-top:12px;">
      <span class="pill hot">${escapeHtml(angleLabel(p.angle))}</span>
      <span class="pill">${new Date(p.ts).toLocaleDateString("vi-VN")}</span>
      ${p.weightAtCapture ? `<span class="pill">${escapeHtml(fmtKg(p.weightAtCapture))}kg</span>` : ""}
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
  const urlBefore = attrUrl(await fkBlobUrl("photo", before.id));
  const urlAfter = attrUrl(await fkBlobUrl("photo", after.id));
  if(!urlBefore || !urlAfter){ toast("Không mở được ảnh để so sánh.", "error"); return; }
  const wDelta = (before.weightAtCapture && after.weightAtCapture) ? fmt1(after.weightAtCapture - before.weightAtCapture) : null;
  const days = Math.round((after.ts-before.ts)/86400000);
  openSheet(`
    <div class="sheet-header"><h3>So sánh tiến độ</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div id="cmp-wrap" style="position:relative;width:100%;aspect-ratio:3/4;border-radius:16px;overflow:hidden;background:#000;">
      <img src="${urlBefore}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
      <div id="cmp-after-wrap" style="position:absolute;top:0;left:0;bottom:0;width:50%;overflow:hidden;">
        <img src="${urlAfter}" id="cmp-after-img" style="position:absolute;top:0;left:0;object-fit:cover;">
      </div>
      <div id="cmp-handle" style="position:absolute;top:0;bottom:0;left:50%;width:3px;background:var(--primary);"></div>
      <div style="position:absolute;bottom:8px;left:8px;font-size:12px;background:rgba(0,0,0,0.6);color:#fff;padding:3px 8px;border-radius:6px;">${new Date(before.ts).toLocaleDateString("vi-VN")}</div>
      <div style="position:absolute;bottom:8px;right:8px;font-size:12px;background:rgba(0,0,0,0.6);color:#fff;padding:3px 8px;border-radius:6px;">${new Date(after.ts).toLocaleDateString("vi-VN")}</div>
    </div>
    <input type="range" id="cmp-slider" min="0" max="100" value="50" style="width:100%;margin-top:12px;">
    <div class="stat-grid cols-2" style="margin-top:12px;">
      <div class="stat-box"><div class="num">${before.weightAtCapture != null ? escapeHtml(fmtKg(before.weightAtCapture)) : "--"}kg</div><div class="cap">Trước</div></div>
      <div class="stat-box"><div class="num">${after.weightAtCapture != null ? escapeHtml(fmtKg(after.weightAtCapture)) : "--"}kg</div><div class="cap">Sau</div></div>
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
  return String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
/* Chữ có định dạng tối thiểu: escape toàn bộ rồi chỉ cho phép lại <b>, </b>, <br> (dùng cho thông điệp do app sinh) */
function richText(s){
  return escapeHtml(s).replace(/&lt;(\/?)b&gt;/g, "<$1b>").replace(/&lt;br\s*\/?&gt;/g, "<br>");
}
/* URL an toàn cho href/src: chỉ nhận http(s), đường dẫn tương đối, blob: và ảnh data:image/...;base64 */
function safeUrl(u, opts){
  const s = String(u == null ? "" : u).trim();
  if(!s) return "";
  if(/^[\/\\]{2}/.test(s) || /^\/[^\/]*\\/.test(s)) return "";   // QS-20: URL giao thức tương đối //evil.com, /\evil.com → host lạ
  if(/^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(s)) return s;
  if(/[\u0000-\u001f\u007f]/.test(s)) return "";
  if(/^https?:\/\//i.test(s)) return s;
  if(/^blob:/i.test(s) && !(opts && opts.noBlob)) return s;
  if(/^(\.{0,2}\/|[\w-]+\/)[^:]*$/.test(s) || /^[\w.-]+\.(png|jpe?g|gif|webp|svg|mp4|webm)$/i.test(s)) return s;   // đường dẫn nội bộ (assets/…, media/…)
  return "";
}
function attrUrl(u, opts){ return escapeHtml(safeUrl(u, opts)); }
/* Hợp đồng phân quyền (vòng tích hợp 2): mọi module hỏi quyền qua teCan("quyền").
   Có module phân quyền (window.TE_RBAC.can) → dùng nó; chưa có → chỉ chế độ quản trị cục bộ (state.isAdmin).
   CHỈ để ẩn/hiện giao diện — quyền ghi thật do firestore.rules quyết định. */
function teCan(perm){ try{ if(window.TE_RBAC && TE_RBAC.can) return TE_RBAC.can(perm); }catch(e){} return !!(state && state.isAdmin); }
function blobToDataURL(blob){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function providerLabel(id){
  return { openai:"ChatGPT (OpenAI)", gemini:"Google Gemini", grok:"Grok (xAI)" }[id] || "AI";   // R3-CORE-07: không trả nguyên chuỗi lạ từ state (được chèn vào HTML)
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
    <p class="small-note" style="color:var(--warn);">API key chỉ được lưu trên trình duyệt này (localStorage) và gửi thẳng tới máy chủ của nhà cung cấp bạn chọn khi phân tích — không qua máy chủ nào khác của TapEasy. Không dùng chung thiết bị/app này với người khác nếu không muốn lộ key. Khi phân tích, ảnh chụp của bạn sẽ được gửi tới nhà cung cấp AI đang chọn.</p>
    <div class="field" style="margin-top:12px;">
      <label>Nhà cung cấp AI đang dùng để phân tích</label>
      <select id="ai-provider">
        <option value="openai" ${s.provider==='openai'?'selected':''}>ChatGPT (OpenAI GPT-4o Vision)</option>
        <option value="gemini" ${s.provider==='gemini'?'selected':''}>Google Gemini</option>
        <option value="grok" ${s.provider==='grok'?'selected':''}>Grok (xAI)</option>
      </select>
    </div>
    <div class="field" style="margin-top:12px;"><label>OpenAI API key</label><input type="password" id="key-openai" placeholder="sk-..." value="${escapeHtml(s.openaiKey||"")}"></div>
    <div class="field" style="margin-top:8px;"><label>Model OpenAI (nâng cao)</label><input type="text" id="model-openai" value="${escapeHtml(s.openaiModel||"gpt-4o-mini")}"></div>
    <div class="field" style="margin-top:14px;"><label>Google Gemini API key</label><input type="password" id="key-gemini" placeholder="AIza..." value="${escapeHtml(s.geminiKey||"")}"></div>
    <div class="field" style="margin-top:8px;"><label>Model Gemini (nâng cao)</label><input type="text" id="model-gemini" value="${escapeHtml(s.geminiModel||"gemini-1.5-flash")}"></div>
    <div class="field" style="margin-top:14px;"><label>xAI Grok API key</label><input type="password" id="key-grok" placeholder="xai-..." value="${escapeHtml(s.grokKey||"")}"></div>
    <div class="field" style="margin-top:8px;"><label>Model Grok (nâng cao)</label><input type="text" id="model-grok" value="${escapeHtml(s.grokModel||"grok-2-vision-1212")}"></div>
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
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
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
  return `Bạn là một huấn luyện viên thể hình giàu kinh nghiệm đang xem ảnh tiến độ tập luyện (góc chụp: ${angleLabel(p.angle)}) của một người tập gym. Thông tin: giới tính ${prof.gender==='male'?'nam':'nữ'}, ${prof.age} tuổi, cao ${prof.height}cm, nặng ${p.weightAtCapture||prof.weight}kg, mục tiêu: ${goalDef?goalDef.label:'—'}. Hãy trả lời bằng tiếng Việt, ngắn gọn, tôn trọng và mang tính xây dựng, gồm: (1) ấn tượng chung về vóc dáng qua ảnh, (2) 2-3 vùng cơ thể có vẻ nổi bật/tiến bộ, (3) 2-3 vùng nên chú trọng cải thiện thêm dựa theo mục tiêu, (4) một lời khuyên tập luyện hoặc dinh dưỡng cụ thể. Kết thúc bằng một câu nói rõ đây chỉ là quan sát hình ảnh mang tính tham khảo, không phải chẩn đoán y khoa hay đo lường chính xác.`;
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
  let trendNote = "Chưa đủ dữ liệu để so sánh xu hướng — hãy chụp thêm ảnh theo thời gian để thấy rõ tiến độ.";
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
        <div class="stat-box"><div class="num">${fkNumTxt(l.weight)}</div><div class="cap">Cân nặng (kg)</div></div>
        <div class="stat-box"><div class="num">${fkNumTxt(l.bodyFatPct)}</div><div class="cap">% mỡ</div></div>
        <div class="stat-box"><div class="num">${fkNumTxt(l.muscleMassKg)}</div><div class="cap">Cơ (kg)</div></div>
      </div>
      ${l.note ? `<p class="small-note" style="margin-top:8px;">${escapeHtml(l.note)}</p>` : ""}
      <button class="btn btn-ghost btn-sm" data-idel="${escapeHtml(String(l.id))}" style="margin-top:8px;color:var(--warn);">Xoá</button>
    </div>`;
}
/* R3-CORE-07: số từ state chèn vào HTML luôn đi qua đây (số hữu hạn → kiểu Việt, còn lại "--") */
function fkNumTxt(v){ const n = typeof v === "number" ? v : (v == null || v === "" ? NaN : Number(v)); return Number.isFinite(n) ? escapeHtml(fmtVN(n)) : "--"; }

function renderInbodyChart(containerId, rawLogs){
  const el = $(containerId);
  if(!el) return;
  const fin = v=> typeof v === "number" && Number.isFinite(v);
  const logs = (Array.isArray(rawLogs) ? rawLogs : []).filter(l=> l && typeof l === "object")
    .map(l=> Object.assign({}, l, { ts: Number(l.ts) || 0, weight: fin(l.weight) ? l.weight : null, bodyFatPct: fin(l.bodyFatPct) ? l.bodyFatPct : null }))   // R3-CORE-07: chỉ số hữu hạn mới vào toạ độ SVG
    .sort((a,b)=>a.ts-b.ts);
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
  const weightDelta = (latest && first && latest.id!==first.id && Number.isFinite(Number(latest.weight)) && Number.isFinite(Number(first.weight)) && latest.weight != null && first.weight != null) ? fmt1(latest.weight-first.weight) : null;
  $("#progress-content").innerHTML = `
    <p class="small-note">Lưu số liệu đo InBody thật từ phòng gym/phòng khám, hoặc ước tính nhanh qua AI ở tab Ảnh tiến độ. Biểu đồ dưới đây theo dõi cả hai nguồn.</p>
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
      <div class="stat-box"><div class="num">${fkNumTxt(latest.weight)}kg</div><div class="cap">Mới nhất</div></div>
      <div class="stat-box"><div class="num">${weightDelta!==null ? (weightDelta>0?'+':'')+fkNumTxt(weightDelta)+'kg' : '--'}</div><div class="cap">So với lần đầu</div></div>
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
    /* R3-CORE-11: xoá số đo cần xác nhận (trước đây chạm nhầm là mất ngay, không hoàn tác được) */
    confirmDialog("Xoá số liệu này?", "Lần đo sẽ bị xoá khỏi biểu đồ và không thể khôi phục.", ()=>{
      state.inbodyLogs = state.inbodyLogs.filter(l=> String(l.id) !== String(id));
      saveState(); renderProgressInbodyTab(); toast("Đã xoá số liệu", "delete");
    }, "Xoá", "delete_forever");
  }));
}

/* Đọc + kiểm form InBody → { log } hoặc { error } (tách riêng để kiểm thử được) */
function fkInbodyRead(f){
  f = f || {};
  const opt = (raw, min, max, label)=>{
    const t = String(raw == null ? "" : raw).trim(); if(t === "") return { v: null };
    const n = fkNum(t); if(!Number.isFinite(n) || n < min || n > max) return { e: `${label} phải trong khoảng ${fmtVN(min)}–${fmtVN(max)} — hoặc để trống nếu chưa đo.` };
    return { v: Math.round(n * 10) / 10 };
  };
  const wRaw = String(f.weight == null ? "" : f.weight).trim();
  const w = wRaw === "" ? Number(state.profile.weight) : fkNum(wRaw);
  if(!Number.isFinite(w) || w < 20 || w > 350) return { error: "Cân nặng phải trong khoảng 20–350 kg." };
  let ts = Date.now();
  if(f.date){
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f.date));
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;   // giờ trưa địa phương — tránh lệch ngày do múi giờ
    if(!d || isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1) return { error: "Ngày đo không hợp lệ." };
    if(todayStr(d) > todayStr()) return { error: "Ngày đo không thể ở tương lai." };
    if(d.getFullYear() < 2000) return { error: "Ngày đo quá xa — hãy kiểm tra lại năm." };
    ts = d.getTime();
  }
  const bf = opt(f.bf, 3, 70, "Tỉ lệ mỡ (%)"); if(bf.e) return { error: bf.e };
  const mu = opt(f.muscle, 5, 120, "Khối lượng cơ (kg)"); if(mu.e) return { error: mu.e };
  const wa = opt(f.water, 25, 80, "Nước cơ thể (%)"); if(wa.e) return { error: wa.e };
  const vi = opt(f.visceral, 1, 59, "Mỡ nội tạng (cấp)"); if(vi.e) return { error: vi.e };
  if(mu.v != null && mu.v >= w) return { error: "Khối lượng cơ phải nhỏ hơn cân nặng." };
  return { log: { ts, weight: Math.round(w * 10) / 10, bodyFatPct: bf.v, muscleMassKg: mu.v, bodyWaterPct: wa.v, visceralFat: vi.v, note: String(f.note || "").trim().slice(0, 200) } };
}
function openAddInbodyLog(){
  openSheet(`
    <div class="sheet-header"><h3>Thêm số liệu InBody</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="margin-bottom:10px;">Nhập số liệu từ máy đo InBody thật ở phòng gym/phòng khám để theo dõi chính xác nhất.</p>
    <div class="field-row">
      <div class="field"><label>Ngày đo</label><input type="date" id="ib-date" max="${todayStr()}" value="${todayStr()}"></div>
      <div class="field"><label>Cân nặng (kg)</label><input type="text" inputmode="decimal" id="ib-weight" value="${escapeHtml(fmtVN(state.profile.weight))}"></div>
    </div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Tỉ lệ mỡ (%)</label><input type="text" inputmode="decimal" id="ib-bf" placeholder="VD: 18"></div>
      <div class="field"><label>Khối lượng cơ (kg)</label><input type="text" inputmode="decimal" id="ib-muscle" placeholder="VD: 32"></div>
    </div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Nước cơ thể (%)</label><input type="text" inputmode="decimal" id="ib-water" placeholder="VD: 55"></div>
      <div class="field"><label>Mỡ nội tạng (cấp)</label><input type="text" inputmode="decimal" id="ib-visceral" placeholder="VD: 8"></div>
    </div>
    <div class="field" style="margin-top:10px;">
      <label>Ghi chú</label>
      <input type="text" id="ib-note" maxlength="200" placeholder="VD: Đo tại phòng tập gần nhà">
    </div>
    <p class="auth-err" id="ib-err" role="alert"></p>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="ib-save">Lưu số liệu</button>
  `);
  $("#ib-save").addEventListener("click", ()=>{
    /* R3-CORE-11: kiểm tra đầu vào — số âm / phi lý / ngày tương lai không được lưu (dấu phẩy thập phân kiểu Việt dùng được) */
    const err = m=>{ const e = $("#ib-err"); if(e) e.textContent = m; toast(m, "error"); };
    const val = fkInbodyRead({ date: $("#ib-date").value, weight: $("#ib-weight").value, bf: $("#ib-bf").value, muscle: $("#ib-muscle").value,
      water: $("#ib-water").value, visceral: $("#ib-visceral").value, note: $("#ib-note").value });
    if(val.error) return err(val.error);
    state.inbodyLogs.push(Object.assign({ id: uid(), source: "manual" }, val.log));
    saveState();
    closeSheet();
    renderProgressInbodyTab();
    toast("Đã lưu số liệu InBody!");
  });
}

/* QU-21: 1 trình nghe uỷ quyền — nút tab tĩnh (index.html) và nút "Kỷ lục" chèn bằng JS đều chạy */
$("#progress-tabs").addEventListener("click", e=>{ const b = e.target && e.target.closest ? e.target.closest("[data-ptab]") : null; if(!b || !b.dataset || !b.dataset.ptab) return; progressUI.tab = b.dataset.ptab; renderProgressScreen(); });
$("#btn-progress-back").addEventListener("click", ()=> goto("profile"));
$("#btn-progress-camera").addEventListener("click", ()=> openCapturePhoto(()=>{ progressUI.tab = "photos"; renderProgressScreen(); }));

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
  const n0 = v=> Number(v) || 0;   // R3-CORE-07: món thiếu trường / sai kiểu không làm tổng thành NaN
  Object.values(log).forEach(list=> (Array.isArray(list) ? list : []).forEach(it=>{ if(!it) return; kcal+=n0(it.kcal); protein+=n0(it.protein); carbs+=n0(it.carbs); fat+=n0(it.fat); }));

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
    const items = Array.isArray(log[mt.id]) ? log[mt.id] : (log[mt.id] = []);
    const mealKcal = items.reduce((s,i)=>s+n0(i && i.kcal),0);
    const mealTime = escapeHtml(String(((state.reminders.meal || {})[mt.id] || {}).time || mt.defaultTime || ""));
    return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div class="card-title" style="margin-bottom:0;"><span class="material-symbols-rounded">${mt.icon}</span>${mt.label} <span data-edit-time="meal:${mt.id}" style="color:var(--primary-soft);font-weight:600;text-transform:none;letter-spacing:0;cursor:pointer;text-decoration:underline;">· ${mealTime}</span></div>
        <button class="btn btn-soft btn-sm" data-add-meal="${mt.id}"><span class="material-symbols-rounded" style="font-size:15px;">add</span></button>
      </div>
      ${items.length ? items.map((it,i)=>`
        <div class="food-result">
          <div><div class="name">${escapeHtml(it.name)}</div><div class="kcal">${fkNumTxt(it.grams)}g · P${fkNumTxt(it.protein)}g C${fkNumTxt(it.carbs)}g F${fkNumTxt(it.fat)}g</div></div>
          <div style="display:flex;align-items:center;gap:10px;">
            <b>${fkNumTxt(it.kcal)} kcal</b>
            <button class="icon-btn" data-del-food="${mt.id}:${i}" aria-label="Xoá món" style="width:26px;height:26px;"><span class="material-symbols-rounded" style="font-size:16px;color:var(--text-dim);">close</span></button>
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
  const water = Number(state.waterLog[todayStr()]) || 0;
  const target = waterTargetL(p);
  $("#water-target").textContent = target == null ? "theo bác sĩ" : fmtVN(target);
  $("#water-current").textContent = `${fmtVN(fmt1(water))} L`;
  $("#water-fill").style.width = `${target ? Math.min(100, Math.round(water/target*100)) : 0}%`;
}
/* integrator (FIX-nutrition vòng 2 #1–#3): "Ẩn số calo" (nutrition.js nuHideKcal — mặc định BẬT khi khai tiền sử rối loạn ăn uống).
   Lõi dùng 1 hàm chung: Trang chủ (pt.js), Hồ sơ, sheet "Mục tiêu calo & macro" không hiện số kcal khi đang bật. */
function fkHideKcal(){ try{ return typeof nuHideKcal === "function" && !!nuHideKcal(); }catch(e){ return false; } }
/* Số kiểu Việt: 2,5 thay vì 2.5 (QN-20 ở phần lõi) */
function fmtVN(n){ const x = Number(n); return Number.isFinite(x) ? x.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) : String(n == null ? "" : n); }
function fmtKg(n){ return fmtVN(Math.round((Number(n) || 0) * 100) / 100); }
/* Đọc số người dùng gõ: chấp nhận dấu phẩy thập phân kiểu Việt ("1,5" → 1.5) — QN-04 */
function fkNum(v){
  if(typeof v === "number") return v;
  const s = String(v == null ? "" : v).trim().replace(/\s/g, "");
  if(!s) return NaN;
  const t = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(",", ".");
  return /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN;
}
/* QN-07: mục tiêu nước (lít/ngày) dùng chung toàn app.
   Tự tính: 35 ml × cân nặng điều chỉnh (thừa cân → BMI 25 + 25 % phần dư), kẹp 1,5–3,7 L; + 0,3 L thai kỳ T2–T3; + 0,7 L cho con bú.
   Đang lọc máu → null (hạn chế dịch theo chỉ định bác sĩ thận, không đặt chỉ tiêu). Người dùng tự đặt → kẹp 0,5–6 L. */
function waterTargetL(p){
  p = p || state.profile || {};
  let f = null; try{ f = window.FKHealth && typeof FKHealth.current === "function" ? FKHealth.current() : null; }catch(e){}
  if(f && f.kidney === "dialysis") return null;
  const ov = p.waterTargetOverride == null ? NaN : Number(p.waterTargetOverride);
  if(Number.isFinite(ov) && ov > 0) return fmt1(Math.min(6, Math.max(0.5, ov)));
  const h = (Number(p.height) || 0)/100, w = Number(p.weight) || 65, cap = h ? 25*h*h : w;
  const ref = w > cap ? cap + 0.25*(w - cap) : w;
  let L = Math.min(3.7, Math.max(1.5, ref * 0.035));
  if(f && f.preg && Number(f.tri) >= 2) L += 0.3;
  if(f && f.bf) L += 0.7;
  return fmt1(L);
}

/* ---- Chỉnh sửa & khôi phục mục tiêu dinh dưỡng / nước ---- */
function openEditNutritionTargets(){
  const p = state.profile;
  if(fkHideKcal()){
    /* integrator (FIX-nutrition vòng 2 #3): đang ẩn số calo → không mở bảng nhập kcal/macro; giải thích + lối tắt hiện lại số calo */
    openSheet(`
      <h3 style="margin-bottom:6px;">Mục tiêu dinh dưỡng</h3>
      <p class="small-note" style="margin-bottom:12px;">Bạn đang <b>ẩn số calo</b>. TapEasy tự tính mục tiêu theo công thức an toàn và gợi ý theo <b>khẩu phần</b>: mỗi bữa ½ đĩa rau – trái cây, ¼ đạm (≈ 1 lòng bàn tay), ¼ tinh bột (≈ 1 nắm tay) và 1 chút chất béo tốt (≈ 1 ngón cái).</p>
      <p class="small-note" style="margin-bottom:12px;">Muốn tự chỉnh calo &amp; macro, hãy hiện lại số calo trước (Hồ sơ → Sức khoẻ &amp; an toàn).</p>
      <button class="btn btn-outline btn-block" id="btn-nt-showkcal">Hiện số calo để tự chỉnh</button>
      <button class="btn btn-primary btn-block" style="margin-top:8px;" id="btn-nt-close">Đóng</button>
    `);
    const sk = $("#btn-nt-showkcal"); if(sk) sk.addEventListener("click", ()=>{ closeSheet(); try{ if(typeof nuSetHideKcal === "function") nuSetHideKcal(false); }catch(e){} try{ if(((document.querySelector(".screen.active") || {}).id || "") === "screen-profile") renderProfileScreen(); }catch(e){} openEditNutritionTargets(); });
    const cl = $("#btn-nt-close"); if(cl) cl.addEventListener("click", ()=> closeSheet());
    return;
  }
  openSheet(`
    <h3 style="margin-bottom:6px;">Mục tiêu calo &amp; macro</h3>
    <p class="small-note" style="margin-bottom:12px;">${p.autoTargets!==false ? "Hiện đang tự động tính theo công thức Mifflin-St Jeor." : "Bạn đang dùng mục tiêu tự chỉnh."}</p>
    <div class="field"><label>Mục tiêu calo (kcal)</label><input type="text" inputmode="numeric" id="nt-kcal" value="${escapeHtml(String(p.goalKcal))}"></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Đạm (g)</label><input type="text" inputmode="decimal" id="nt-protein" value="${escapeHtml(String(p.protein))}"></div>
      <div class="field"><label>Tinh bột (g)</label><input type="text" inputmode="decimal" id="nt-carbs" value="${escapeHtml(String(p.carbs))}"></div>
      <div class="field"><label>Béo (g)</label><input type="text" inputmode="decimal" id="nt-fat" value="${escapeHtml(String(p.fat))}"></div>
    </div>
    <p class="small-note" id="nt-sum" style="margin-top:8px;"></p>
    <p class="auth-err" id="nt-err" role="alert"></p>
    <button class="btn btn-primary btn-block" style="margin-top:12px;" id="btn-save-targets">Lưu mục tiêu tự chỉnh</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-reset-targets">Khôi phục theo công thức khoa học</button>
  `);
  /* QN-05: kiểm tra mục tiêu tự chỉnh — sàn calo an toàn, tổng macro khớp calo ± 10 %, đạm ≤ 35 % năng lượng */
  const read = ()=> ({ k: fkNum($("#nt-kcal").value), P: fkNum($("#nt-protein").value), C: fkNum($("#nt-carbs").value), F: fkNum($("#nt-fat").value) });
  const sum = ()=>{ const v = read(); const t = Math.round(4*(v.P||0) + 4*(v.C||0) + 9*(v.F||0)); const el = $("#nt-sum"); if(el) el.textContent = `Tổng từ macro: ${fmtVN(t)} kcal (đạm 4 · tinh bột 4 · béo 9 kcal/g)`; };
  ["#nt-kcal","#nt-protein","#nt-carbs","#nt-fat"].forEach(s=>{ const el = $(s); if(el && el.addEventListener) el.addEventListener("input", sum); });
  sum();
  let lowOk = "";
  $("#btn-save-targets").addEventListener("click", ()=>{
    const v = read(), err = $("#nt-err");
    const floor = Math.max(p.gender === "male" ? 1500 : 1200, Number(p.bmr) || 0);
    const bad = m=>{ if(err) err.textContent = m; };
    if(![v.k, v.P, v.C, v.F].every(x=> Number.isFinite(x) && x >= 0)) return bad("Nhập số hợp lệ (không âm) cho calo và cả 3 macro.");
    if(v.k < 800 || v.k > 6000) return bad("Calo mục tiêu phải trong khoảng 800–6.000 kcal. Dưới 800 kcal/ngày chỉ dùng khi có bác sĩ theo dõi.");
    const t = 4*v.P + 4*v.C + 9*v.F;
    if(Math.abs(t - v.k) > v.k * 0.10){
      const autoC = Math.round((v.k - 4*v.P - 9*v.F) / 4);
      bad(`Tổng macro = ${fmtVN(Math.round(t))} kcal, lệch quá 10 % so với ${fmtVN(v.k)} kcal.` + (autoC >= 0 ? ` Gợi ý: tinh bột ${fmtVN(autoC)} g.` : " Giảm đạm hoặc béo."));
      if(autoC >= 0){ const c = $("#nt-carbs"); if(c) c.value = autoC; sum(); }
      return;
    }
    const warn = [];
    if(v.k < floor) warn.push(`${fmtVN(v.k)} kcal thấp hơn mức an toàn ${fmtVN(floor)} kcal (sàn ${p.gender === "male" ? "nam 1.500" : "nữ 1.200"} kcal và không dưới năng lượng nghỉ BMR) — ăn quá ít dễ mất cơ, thiếu vi chất.`);
    if(v.P * 4 > v.k * 0.35 + 1) warn.push(`Đạm ${fmtVN(v.P)} g = ${Math.round(v.P*400/v.k)} % năng lượng, vượt mức khuyến nghị 35 %.`);
    const sig = warn.join("|");
    if(warn.length && lowOk !== sig){ lowOk = sig; return bad(warn.join(" ") + ` Bấm "Lưu" lần nữa nếu vẫn muốn dùng.`); }
    p.goalKcal = Math.round(v.k); p.protein = Math.round(v.P); p.carbs = Math.round(v.C); p.fat = Math.round(v.F);
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
  const auto = waterTargetL(Object.assign({}, p, { waterTargetOverride: null }));
  const autoTxt = auto == null ? "theo chỉ định của bác sĩ thận (đang lọc máu)" : `${fmtVN(auto)} L/ngày`;
  openSheet(`
    <h3 style="margin-bottom:6px;">Mục tiêu uống nước</h3>
    <p class="small-note" style="margin-bottom:12px;">Mặc định tính theo cân nặng (~35 ml/kg, trong khoảng 1,5–3,7 L, cộng thêm khi mang thai/cho con bú): ${autoTxt}. Bạn có thể tự đặt từ 0,5 đến 6 L.</p>
    <div class="field"><label>Mục tiêu (lít/ngày)</label><input type="text" inputmode="decimal" id="water-goal-input" value="${escapeHtml(fmtVN(p.waterTargetOverride != null ? p.waterTargetOverride : (auto == null ? "" : auto)))}"></div>
    <p class="auth-err" id="water-goal-err" role="alert"></p>
    <button class="btn btn-primary btn-block" style="margin-top:12px;" id="btn-save-water-goal">Lưu mục tiêu</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-reset-water-goal">Khôi phục tính theo cân nặng</button>
  `);
  $("#btn-save-water-goal").addEventListener("click", ()=>{
    const v = fkNum($("#water-goal-input").value);           // QN-05: chặn mục tiêu âm / 0 / quá lớn
    if(!Number.isFinite(v) || v < 0.5 || v > 6){ const e = $("#water-goal-err"); if(e) e.textContent = "Nhập mục tiêu từ 0,5 đến 6 lít/ngày (có thể dùng dấu phẩy, VD 2,5)."; return; }
    p.waterTargetOverride = fmt1(v);
    saveState(); closeSheet(); renderNutritionScreen();
    toast("Đã lưu mục tiêu nước uống");
  });
  $("#btn-reset-water-goal").addEventListener("click", ()=>{
    confirmDialog("Khôi phục mặc định?", `Mục tiêu nước uống sẽ tự tính lại: ${autoTxt}.`, ()=>{
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
        <div><div class="name">${escapeHtml(f.name)}</div><div class="kcal">/100g</div></div>
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
    <div class="sheet-header"><h3>${escapeHtml(food.name)}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="field"><label>Khối lượng (gram)${food.portion ? ` · ${escapeHtml(food.unit)} ≈ ${escapeHtml(String(food.portion))}g` : ""}</label><input type="text" inputmode="decimal" id="qty-input" value="${escapeHtml(String(food.portion||100))}"></div>
    <div class="stat-grid" style="margin-top:14px;">
      <div class="stat-box"><div class="num" id="qty-kcal">${Math.round(food.kcal*(food.portion||100)/100)}</div><div class="cap">Kcal</div></div>
      <div class="stat-box"><div class="num" id="qty-protein">${food.protein}g</div><div class="cap">Protein</div></div>
      <div class="stat-box"><div class="num" id="qty-carbs">${food.carbs}g</div><div class="cap">Carbs</div></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-confirm-food">Thêm vào nhật ký</button>
  `);
  const update = ()=>{
    const g = fkNum($("#qty-input").value)||0;
    const c = calc(g);
    $("#qty-kcal").textContent = c.kcal;
    $("#qty-protein").textContent = c.protein+"g";
    $("#qty-carbs").textContent = c.carbs+"g";
  };
  $("#qty-input").addEventListener("input", update);
  update();
  $("#btn-confirm-food").addEventListener("click", ()=>{
    const raw = fkNum($("#qty-input").value);   // QN-04: "1,5" = 1,5 (không thành 15)
    if(!Number.isFinite(raw) || raw <= 0){ toast("Nhập khối lượng lớn hơn 0", "error"); return; }
    const g = Math.min(3000, Math.max(1, raw));
    const c0 = calc(g);
    if((g > 1000 || c0.kcal > 1500) && !confirm(`Thêm ${fmtVN(g)} g (${fmtVN(c0.kcal)} kcal) — số lượng khá lớn. Đúng chưa?`)) return;
    const c = calc(g);
    getDayFoodLog()[mealId].push({ name: food.name, grams: g, ...c });
    saveState();
    closeSheet();
    renderNutritionScreen();
    toast(`Đã thêm ${food.name}`);
  });
}
/* QN-06: cộng dồn chính xác tới mililit (không làm tròn 0,1 L sau mỗi lần cộng); chỉ làm tròn khi hiển thị.
   fkAddWater(lít | "reset") → tổng lít hôm nay. */
function fkAddWater(v){
  const key = todayStr();
  if(!state.waterLog || typeof state.waterLog !== "object") state.waterLog = {};
  if(v === "reset") state.waterLog[key] = 0;
  else state.waterLog[key] = Math.round(((Number(state.waterLog[key])||0) + (Number(v)||0)) * 1000) / 1000;
  return state.waterLog[key];
}
$$("[data-water]").forEach(b=>{
  b.addEventListener("click", ()=>{
    fkAddWater(b.dataset.water === "reset" ? "reset" : b.dataset.water);
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
  if(!FK_TIME_RE.test(String(start)) || !FK_TIME_RE.test(String(end))) return NaN;   // R3-CORE-10: ô giờ để trống / sai dạng
  const [sh,sm] = start.split(":").map(Number);
  const [eh,em] = end.split(":").map(Number);
  let mins = (eh*60+em) - (sh*60+sm);
  if(mins<=0) mins += 24*60;
  return mins/60;
}
$("#btn-save-sleep").addEventListener("click", ()=>{
  const start = $("#sleep-start").value, end = $("#sleep-end").value;
  const hours = fmt1(sleepHours(start,end));
  if(!Number.isFinite(hours) || hours <= 0){ toast("Chọn đủ giờ đi ngủ và giờ thức dậy.", "error"); return; }
  if(hours > 16 && !confirm(`Bạn ngủ ${fmtVN(hours)} giờ? Kiểm tra lại giờ đi ngủ / thức dậy nếu chưa đúng.`)) return;
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
  const validHours = logs.filter(Boolean).map(l=> Number(l.hours)).filter(h=> Number.isFinite(h) && h > 0);
  const avg = validHours.length ? fmt1(validHours.reduce((a,b)=>a+b,0)/validHours.length) : 0;
  const pct = Math.min(100, Math.round(avg/goalHours*100));
  $("#sleep-avg").textContent = `${avg}h`;
  $("#sleep-ring").style.strokeDashoffset = `${SLEEP_RING_CIRC*(1-pct/100)}`;
  const max = 10;
  $("#sleep-bars").innerHTML = days.map((d,i)=>{
    const h = logs[i] && Number.isFinite(Number(logs[i].hours)) ? Math.max(0, Number(logs[i].hours)) : 0;
    const barH = Math.min(80, Math.max(4, Math.round(h/max*80)));
    const inGoal = h >= goalHours-1;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div style="width:100%;max-width:18px;height:${barH}px;border-radius:4px;background:${h?(inGoal?'var(--success)':'var(--primary-soft)'):'var(--surface-3)'};"></div>
      <span style="font-size:12px;color:var(--text-dim);">${todayDayKey(fkDateOf(d))}</span>
    </div>`;
  }).join("");
}
$("#btn-edit-sleep-goal").addEventListener("click", ()=>{
  openSheet(`
    <h3 style="margin-bottom:14px;">Mục tiêu giờ ngủ mỗi đêm</h3>
    <p class="small-note" style="margin-bottom:10px;">National Sleep Foundation khuyến nghị 7–9 giờ/đêm cho người trưởng thành — bạn có thể tự đặt mục tiêu phù hợp với cơ địa của mình.</p>
    <div class="field"><input type="number" inputmode="decimal" id="sleep-goal-input" value="${Number(state.profile.sleepGoalHours)||8}" min="4" max="12" step="0.5"></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-sleep-goal">Lưu mục tiêu</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-reset-sleep-goal">Đặt lại mặc định (8 giờ)</button>
  `);
  $("#btn-save-sleep-goal").addEventListener("click", ()=>{
    const v = fkNum($("#sleep-goal-input").value);
    if(!Number.isFinite(v) || v < 4 || v > 12){ toast("Mục tiêu giấc ngủ từ 4 đến 12 giờ/đêm.", "error"); return; }
    state.profile.sleepGoalHours = Math.round(v * 2) / 2;
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
    const day = ((getActivePlan() || {}).days || {})[k];
    if(!day || !Array.isArray(day.items) || day.items.length===0) return "";
    return `<div class="link-row">
      <div class="left"><span class="material-symbols-rounded">event</span>
        <div><div class="name">${DAY_LABELS[k]} — ${escapeHtml(day.title)}</div><div class="sub" data-edit-time="workout:${k}" style="cursor:pointer;text-decoration:underline;">${escapeHtml(String(r.time))}</div></div>
      </div>
      <div class="toggle ${r.enabled?'on':''}" data-toggle="workout:${k}"></div>
    </div>`;
  }).join("");

  $("#reminder-meal-list").innerHTML = MEAL_TYPES.map(m=>{
    const r = state.reminders.meal[m.id];
    return `<div class="link-row">
      <div class="left"><span class="material-symbols-rounded">${m.icon}</span>
        <div><div class="name">${m.label}</div><div class="sub" data-edit-time="meal:${m.id}" style="cursor:pointer;text-decoration:underline;">${escapeHtml(String(r.time))}</div></div>
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
    <input type="time" id="time-picker" value="${escapeHtml(String(cur || ""))}" aria-label="Giờ nhắc nhở" style="background:var(--surface-2);border:1px solid var(--border-strong);border-radius:12px;padding:14px;color:#fff;width:100%;font-size:16px;">
    <button class="btn btn-primary btn-block" style="margin-top:16px;" id="btn-save-time">Lưu</button>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="btn-reset-time">Đặt lại giờ mặc định (${defaultReminderTime(type,key)})</button>
  `);
  $("#btn-save-time").addEventListener("click", ()=>{
    const tv = String($("#time-picker").value || "").slice(0, 5);
    if(!FK_TIME_RE.test(tv)){ toast("Chọn giờ nhắc nhở hợp lệ (giờ:phút).", "error"); return; }   // R3-CORE-12: để trống → nhắc nhở không bao giờ chạy
    setReminderTime(type, key, tv);
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
/* R3-CORE-12: (1) không còn so khớp ĐÚNG phút — tab nền bị trình duyệt bóp timer (≥ 1 phút/nhịp) nên dễ trượt mất phút hẹn:
   bắn khi đã tới giờ và trễ không quá FK_REMIND_GRACE phút, mỗi nhắc nhở 1 lần/ngày/giờ hẹn; (2) không có giáo án / ngày tập
   không còn ném lỗi mỗi 15 giây; (3) dọn khoá chống trùng của ngày cũ. */
const FK_REMIND_GRACE = 3;
function fkReminderDue(time, now){
  if(typeof time !== "string" || !FK_TIME_RE.test(time)) return false;
  now = now || new Date();
  const [h, m] = time.split(":").map(Number);
  const diff = (now.getHours()*60 + now.getMinutes()) - (h*60 + m);
  return diff >= 0 && diff <= FK_REMIND_GRACE;
}
function checkReminders(){
  if(!state.reminders || !state.reminders.master) return;
  const now = new Date();
  const today = todayStr(now);
  if(!state._firedKeys || typeof state._firedKeys !== "object") state._firedKeys = {};
  let dirty = fkPruneFired(state) > 0;
  const fire = (title, body, uniqueKey, time)=>{
    const fireKey = `${today}_${time}_${uniqueKey}`;
    if(state._firedKeys[fireKey]) return;
    state._firedKeys[fireKey] = true; dirty = true;
    if("Notification" in window && Notification.permission==="granted"){
      try{ new Notification(title, { body, icon: undefined }); }catch(e){}
    }
    toast(body, "notifications_active");
  };
  const todayKey = todayDayKey(now);
  const wr = (state.reminders.workout || {})[todayKey];
  if(wr && wr.enabled && fkReminderDue(wr.time, now)){
    const day = ((getActivePlan() || {}).days || {})[todayKey];
    if(day && Array.isArray(day.items) && day.items.length) fire("Đến giờ tập luyện!", `Hôm nay: ${day.title || "buổi tập"} — cùng TapEasy chinh phục giới hạn!`, "workout", wr.time);
  }
  MEAL_TYPES.forEach(m=>{
    const mr = (state.reminders.meal || {})[m.id];
    if(mr && mr.enabled && fkReminderDue(mr.time, now)) fire("Đến giờ ăn!", `Đừng quên ${m.label.toLowerCase()} và ghi lại vào nhật ký dinh dưỡng nhé.`, "meal_"+m.id, mr.time);
  });
  if(state.reminders.bedtimeEnabled){
    const bedtime = state.reminders.bedtimeTime || "22:30";
    if(fkReminderDue(bedtime, now)) fire("Đến giờ ngủ!", "Tắt thiết bị điện tử và chuẩn bị cho một giấc ngủ chất lượng.", "bedtime", bedtime);
  }
  if(dirty) saveState();
}
setInterval(()=>{ try{ checkReminders(); }catch(e){ try{ console.warn("[reminders]", e); }catch(_){} } }, 15000);

/* =========================================================================
   11. MÀN HÌNH HỒ SƠ
   ========================================================================= */
function renderProfileScreen(){
  const p = state.profile;
  $("#profile-avatar").src = safeUrl(p.avatarData) || IMG.avatar;
  $("#profile-name").textContent = (p.name || "Vận Động Viên").toUpperCase();
  const total = state.finishedDates.length;
  const level = Math.floor(total/5)+1;
  const tierNames = ["Đồng","Bạc","Vàng","Bạch Kim","Kim Cương","Huyền Thoại"];
  const tier = tierNames[Math.min(tierNames.length-1, Math.floor(level/3))];
  $("#profile-badge").textContent = `HẠNG ${tier.toUpperCase()}`;
  $("#profile-sub").textContent = `Cấp độ ${level} · ${total} buổi tập đã hoàn thành`;

  $("#stat-weight").textContent = p.weight;
  const bmi = p.height ? (typeof bodyAnalysis === "function" ? bodyAnalysis(p).bmi : fmt1(p.weight/((p.height/100)**2))) : "--";   // cùng cách hiển thị với thẻ phân tích (BUG-09)
  $("#stat-bmi").textContent = bmi;
  $("#stat-streak").textContent = calcStreak();

  /* integrator (FIX-nutrition vòng 2 #3): "Ẩn số calo" → ẩn dòng BMR/TDEE, mục tiêu hiện "Theo khẩu phần" (không có số kcal) */
  const hideK = fkHideKcal();
  [["#profile-bmr", `${p.bmr} kcal`], ["#profile-tdee", `${p.tdee} kcal`]].forEach(([sel, txt])=>{
    const el = $(sel); if(!el) return;
    el.textContent = hideK ? "" : txt;
    const row = el.closest ? el.closest(".link-row") : null; if(row && row.style) row.style.display = hideK ? "none" : "";
  });
  const goalDef = GOALS.find(g=>g.id===p.goal);
  $("#profile-goal-label").textContent = goalDef ? goalDef.label : "--";
  $("#profile-goal-kcal").textContent = hideK ? "Theo khẩu phần" : `${p.goalKcal} kcal`;
  $("#profile-targets-mode").textContent = hideK
    ? "Đang ẩn số calo — TapEasy gợi ý theo khẩu phần & đĩa ăn cân bằng. Bật/tắt ở thẻ Sức khoẻ & an toàn."
    : p.autoTargets!==false
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
    fkSetAvatar(file);
  };
  input.click();
});
/* R3-CORE-02: ảnh đại diện trước đây lưu NGUYÊN CỠ (ảnh chụp 3–8 MB → chuỗi base64 4–11 MB) vào localStorage (giới hạn ~5 MB):
   lưu thất bại và từ đó MỌI thay đổi khác cũng không lưu được. Nay thu nhỏ về ≤ 256 px JPEG (~15–30 KB), chỉ nhận ảnh,
   lưu không được thì hoàn tác và báo rõ. */
const FK_AVATAR_PX = 256, FK_AVATAR_MAX_CHARS = 200000;
function fkShrinkImage(file, px){
  return new Promise((resolve, reject)=>{
    let url = null;
    try{ url = URL.createObjectURL(file); }catch(e){ reject(e); return; }
    const img = new Image();
    const done = ()=>{ try{ URL.revokeObjectURL(url); }catch(e){} };
    img.onload = ()=>{
      try{
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if(!w || !h) throw new Error("empty");
        const side = Math.min(w, h), c = document.createElement("canvas");
        c.width = c.height = Math.min(px, side);
        c.getContext("2d").drawImage(img, (w - side)/2, (h - side)/2, side, side, 0, 0, c.width, c.height);   // cắt vuông ở giữa
        const out = c.toDataURL("image/jpeg", 0.85);
        done(); resolve(out);
      }catch(e){ done(); reject(e); }
    };
    img.onerror = ()=>{ done(); reject(new Error("decode")); };
    img.src = url;
  });
}
async function fkSetAvatar(file){
  if(!file || (file.type && !/^image\//i.test(file.type))){ toast("Hãy chọn một tệp ảnh (JPG, PNG…).", "error"); return false; }
  if(Number(file.size) > 25 * 1024 * 1024){ toast("Ảnh lớn hơn 25 MB — hãy chọn ảnh nhỏ hơn.", "error"); return false; }
  let data = null;
  try{ data = await fkShrinkImage(file, FK_AVATAR_PX); }catch(e){ data = null; }
  if(typeof data !== "string" || !/^data:image\/(png|jpe?g|webp);base64,/i.test(data) || data.length > FK_AVATAR_MAX_CHARS){
    toast("Không đọc được ảnh này — hãy thử ảnh khác (JPG hoặc PNG).", "error"); return false;
  }
  const prev = state.profile.avatarData;
  state.profile.avatarData = data;
  if(saveState() === false){ state.profile.avatarData = prev; try{ renderProfileScreen(); }catch(e){} return false; }
  try{ renderProfileScreen(); }catch(e){}
  toast("Đã đổi ảnh đại diện");
  return true;
}
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
    /* integrator (FIX-nutrition vòng 2 #4): xoá cả bộ nhớ thực đơn của nutrition-pro (localStorage riêng "fitkit_np_plans_v1") */
    try{ if(typeof NutriPro !== "undefined" && NutriPro && typeof NutriPro.clearPlanCache === "function") NutriPro.clearPlanCache(); }catch(e){}
    try{ localStorage.removeItem("fitkit_np_plans_v1"); }catch(e){}
    try{ localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_CORRUPT_KEY); }catch(e){}
    try{ if(_dbPromise){ const db = await _dbPromise.catch(()=> null); if(db && db.close) db.close(); _dbPromise = null; } }catch(e){}
    try{ indexedDB.deleteDatabase(DB_NAME); }catch(e){}       // R3-CORE-15: IndexedDB bị chặn không được làm kẹt nút "Xoá hết"
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
  /* R3-CORE-03: KIỂM TRA TRƯỚC — XOÁ SAU. Trước đây kho video/ảnh bị xoá sạch rồi mới đọc bản sao lưu: file hỏng / state không
     phải object / manifest sai / localStorage đầy → mất dữ liệu cũ mà không khôi phục được gì. Nay: đọc + kiểm toàn bộ, ghi
     state mới (giữ bản cũ để hoàn tác), rồi mới thay kho video/ảnh; lỗi giữa chừng → trả state cũ. */
  let parsedState, manifest;
  try{ parsedState = JSON.parse(await stateFile.async("string")); }catch(e){ throw new Error("File sao lưu bị hỏng (state.json không đọc được)."); }
  if(!parsedState || typeof parsedState !== "object" || Array.isArray(parsedState)) throw new Error("File sao lưu không hợp lệ (state.json sai định dạng).");
  const manifestFile = zip.file("db-manifest.json");
  try{ manifest = manifestFile ? JSON.parse(await manifestFile.async("string")) : []; }catch(e){ manifest = null; }
  if(!Array.isArray(manifest)) throw new Error("File sao lưu bị hỏng (danh sách video/ảnh không đọc được).");
  manifest = manifest.filter(m=> m && typeof m === "object" && (m.store === "clips" || m.store === "photos") && Number.isFinite(Number(m.id)));
  const merged = normalizeState(Object.assign(defaultState(), parsedState, {   // QT-11: chuẩn hoá bản sao lưu cũ/thiếu trường
    profile: Object.assign(defaultState().profile, parsedState.profile && typeof parsedState.profile === "object" ? parsedState.profile : {}),
    reminders: Object.assign(defaultState().reminders, parsedState.reminders && typeof parsedState.reminders === "object" ? parsedState.reminders : {}),
    aiSettings: Object.assign(defaultState().aiSettings, parsedState.aiSettings && typeof parsedState.aiSettings === "object" ? parsedState.aiSettings : {}),
    driveSettings: Object.assign(defaultState().driveSettings, parsedState.driveSettings && typeof parsedState.driveSettings === "object" ? parsedState.driveSettings : {}),
  }));
  // đọc trước toàn bộ blob (zip hỏng giữa chừng → dừng khi CHƯA xoá gì)
  const records = [];
  for(const m of manifest){
    const f = zip.file(`blobs/${m.store}/${m.id}`);
    if(!f) continue;
    const arr = await f.async("arraybuffer");
    records.push({ store: m.store === "clips" ? DB_STORE : DB_STORE_PHOTOS,
      rec: { id: Number(m.id), name: typeof m.name === "string" ? m.name.slice(0, 120) : "", blob: new Blob([arr], { type: /^(video|image)\/[\w.+-]+$/.test(String(m.mimeType)) ? m.mimeType : (m.store === "clips" ? "video/mp4" : "image/jpeg") }), createdAt: Number(m.createdAt) || Date.now() } });
  }
  let oldRaw = null;
  try{ oldRaw = localStorage.getItem(STORAGE_KEY); }catch(e){}
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); }
  catch(e){ throw new Error("Bộ nhớ máy đầy hoặc trình duyệt chặn lưu — chưa khôi phục được (dữ liệu hiện tại vẫn nguyên)."); }
  try{
    await dbClear(DB_STORE);
    await dbClear(DB_STORE_PHOTOS);
    _fkBlobUrls.forEach(u=>{ try{ URL.revokeObjectURL(u); }catch(e){} }); _fkBlobUrls.clear();
    for(const r of records) await dbPutRaw(r.store, r.rec);
  }catch(e){
    try{ if(oldRaw != null) localStorage.setItem(STORAGE_KEY, oldRaw); else localStorage.removeItem(STORAGE_KEY); }catch(_){}
    throw new Error("Không ghi được video/ảnh vào máy (bộ nhớ đầy?) — đã giữ lại dữ liệu nhật ký hiện tại. Giải phóng bộ nhớ rồi khôi phục lại.");
  }
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
  if(driveDirty && s.autoSync && getDriveClientId() && driveIsSignedIn()){   // R3-CORE-15: Client ID cấu hình sẵn trong app cũng tự sao lưu
    driveBackupNow(false);
  }
}, 120000);

function openDriveSettings(){
  const s = state.driveSettings;
  const signedIn = driveIsSignedIn();
  const appConfigured = !!GOOGLE_DRIVE_CLIENT_ID; // true = chủ app đã cấu hình sẵn, người dùng cuối không cần biết Client ID là gì
  openSheet(`
    <div class="sheet-header"><h3>Đồng bộ Google Drive</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="color:var(--warn);">Dữ liệu (hồ sơ, nhật ký, video, ảnh...) sẽ được nén thành 1 file và lưu vào Google Drive CỦA RIÊNG BẠN — không qua máy chủ nào khác của TapEasy.</p>
    ${appConfigured ? "" : `
    <div class="field" style="margin-top:12px;">
      <label>Google OAuth Client ID (dành cho chủ app cấu hình 1 lần)</label>
      <input type="text" id="drive-client-id" placeholder="xxxx.apps.googleusercontent.com" value="${escapeHtml(s.clientId||"")}">
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
/* QU-02/03: KHÔNG vẽ trước các màn đang ẩn lúc khởi động (Dinh dưỡng ~2.000 nút DOM, Hồ sơ…) — chỉ vẽ màn đang mở;
   goto() vẽ mỗi màn khi người dùng vào (home, workout, nutrition, sleep, reminders, profile, coach…). */
function renderAll(){
  const cur = (($(".screen.active") || {}).id || "").replace("screen-", "") || "home";
  if(cur === "home"){ if(typeof renderHomeScreen==="function") renderHomeScreen(); }
  else if(cur === "workout") renderWorkoutScreen();
  else if(cur === "nutrition") renderNutritionScreen();
  else if(cur === "sleep") renderSleepScreen();
  else if(cur === "reminders") renderRemindersScreen();
  else if(cur === "profile") renderProfileScreen();
  else if(cur === "coach" && typeof renderCoachScreen==="function") renderCoachScreen(false);
  else if(typeof renderHomeScreen==="function") renderHomeScreen();
}

/* R3-CORE-13: app mở ở 2 nơi (tab + PWA đã cài) — nơi mở sau ghi đè dữ liệu nơi kia vì mỗi nơi giữ 1 bản state riêng trong RAM.
   Nghe sự kiện "storage": nơi khác vừa lưu → nạp lại state mới nhất (không làm khi đang trong buổi tập / đang mở sheet / onboarding:
   khi đó đánh dấu chờ, nạp lúc quay lại app). */
let _fkStoragePending = false;
function fkStorageBusy(){
  try{
    if(typeof session !== "undefined" && session && !session.finished) return true;
    const bd = $("#sheet-backdrop"); if(bd && bd.classList.contains("open")) return true;
    const ob = $("#onboarding"); if(ob && ob.classList.contains("open")) return true;
  }catch(e){}
  return false;
}
function fkStorageAdopt(force){
  if(!_fkStoragePending && !force) return false;
  if(fkStorageBusy()) return false;
  _fkStoragePending = false;
  let raw = null; try{ raw = localStorage.getItem(STORAGE_KEY); }catch(e){ return false; }
  if(!raw) return false;
  let parsed = null; try{ parsed = JSON.parse(raw); }catch(e){ return false; }
  if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const keepDay = state.selectedDay;
  state = loadState();
  if(keepDay) state.selectedDay = keepDay;
  try{ ensureReminderDefaults(); if(state.onboarded) renderAll(); }catch(e){ try{ console.warn("[storage]", e); }catch(_){} }
  return true;
}
try{ window.addEventListener("storage", ev=>{
  try{
    if(!ev || ev.key !== STORAGE_KEY || ev.newValue == null) return;
    _fkStoragePending = true;
    fkStorageAdopt();
  }catch(e){}
}); }catch(e){}
/* R3-CORE-01 / R3-CORE-09: báo 1 lần lúc khởi động khi dữ liệu cũ bị hỏng hoặc trình duyệt chặn lưu trữ */
function fkStorageNotice(){
  try{
    if(fkStorageNotice._done) return; fkStorageNotice._done = true;
    if(loadState.blocked) setTimeout(()=> toast("Trình duyệt đang chặn lưu dữ liệu (chế độ riêng tư / tắt cookie) — dữ liệu sẽ mất khi đóng app.", "error"), 600);
    else if(loadState.corrupt) setTimeout(()=> toast("Dữ liệu lưu trên máy bị hỏng nên app bắt đầu lại. Bản cũ đã được giữ riêng — hãy khôi phục từ bản sao lưu nếu có.", "error"), 600);
  }catch(e){}
}
function init(){
  fkStorageNotice();
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

/* ---------------------------------------------------------------------
   NÚT QUAY LẠI (Android) / phím Esc (web)
   Thứ tự: đóng sheet → về màn trước (màn phụ) → về Trang chủ → thoát app
   --------------------------------------------------------------------- */
function fkHandleBack(){
  if($("#sheet-backdrop") && $("#sheet-backdrop").classList.contains("open")){ closeSheet(); return true; }
  const ready = $("#ob-ready"); if(ready && ready.classList.contains("open") && typeof ready._later === "function"){ ready._later(); return true; }
  const ob = $("#onboarding"); if(ob && ob.classList.contains("open")){ $("#onboard-back").click(); return true; }
  const auth = $("#auth"); if(auth && !auth.hidden && getComputedStyle(auth).display!=="none") return false;
  const cur = ($(".screen.active")||{}).id || "";
  const name = cur.replace("screen-","");
  if(SUB_SCREENS.includes(name)){ goto(name==="client" || name==="ptprofile" ? "coach" : name==="exlib" || name==="plans" || name==="library" ? "workout" : "home"); return true; }
  if(name && name!=="home"){ goto("home"); return true; }
  return false;
}
document.addEventListener("keydown", e=>{
  if(e.key==="Escape" && $("#sheet-backdrop").classList.contains("open")){ closeSheet(); return; }
  const ready = $("#ob-ready"); if(e.key==="Escape" && ready && ready.classList.contains("open") && typeof ready._later === "function") ready._later();
});
(function(){
  try{
    const App = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
    if(App && App.addListener) App.addListener("backButton", ()=>{ if(!fkHandleBack()) App.exitApp(); });
  }catch(e){}
})();


/* =====================================================================
   TIẾN TRÌNH TỰ ĐỘNG · KHỞI ĐỘNG · ĐĨA TẠ · LỊCH SỬ & KỶ LỤC · BÁO NGHỈ
   ===================================================================== */
function repBottom(reps){ const m = String(reps||"").match(/(\d+)\s*[-–]\s*(\d+)/); return m ? Number(m[1]) : repTop(reps); }
function e1rm(kg, reps){ kg = Number(kg)||0; reps = Math.min(12, Number(reps)||0); if(!(kg > 0) || !(reps > 0) || !Number.isFinite(kg)) return 0;   /* R3-CORE: kg/lần âm, NaN, vô cực → 0 */ return reps===1 ? kg : kg*(1+reps/30); }   // giới hạn 12 lần để tránh phóng đại   // công thức Epley
function roundTo(x, step){ return Math.round(x/step)*step; }
/* Loại dụng cụ: db (tạ đơn/tạ ấm) · barbell (thanh đòn, EZ, Smith) · machine (cáp/máy) · bw (trọng lượng cơ thể, xà, ghế…) · other */
function fkEquipClass(meta){
  const eq = String(meta && meta.equipment || "").toLowerCase().trim();
  if(/tạ đơn|tạ ấm|kettlebell|dumbbell/.test(eq) && !/thanh đòn/.test(eq)) return "db";
  if(/thanh đòn|tạ đòn|đòn ez|barbell|smith/.test(eq)) return "barbell";
  if(/cáp|cable|machine|máy(?!\s*(chạy|chèo))/.test(eq)) return "machine";
  if(!eq || eq === "—" || eq === "-" || /trọng lượng cơ thể|bodyweight|^không$|thảm|xà|ghế|bàn|dây|xe đạp|chạy|chèo|bục/.test(eq)) return "bw";
  return "other";
}
/* weightStep(meta, kg?) — nấc tạ nhỏ nhất. Tạ đơn 2 kg (≤ 10 kg: 1 kg) · cáp/máy nhẹ (< 20 kg) 1,25 kg · còn lại 2,5 kg.
   Gọi không có kg (module cũ) → giữ giá trị như trước (tạ đơn 2, còn lại 2,5). */
function weightStep(meta, kg){
  const c = fkEquipClass(meta);
  if(c === "db") return kg != null && Number(kg) <= 10 ? 1 : 2;
  if(c === "machine" && kg != null && Number(kg) < 20) return 1.25;
  return 2.5;
}
/* Mức tạ đơn phổ biến ở phòng tập (QT-18: 10 → 12 → 14…, không sinh 11, 13 kg) */
const DB_LADDER = [1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42.5,45,47.5,50,55,60];
/* QT-02: mức tạ kế tiếp theo dụng cụ + % (thân dưới ~5 %, thân trên ~2,5 %, tối thiểu 1 nấc dụng cụ) */
function fkNextKg(meta, kg){
  kg = Math.max(0, Number(kg) || 0);   // R3-CORE: kg âm / NaN → 0
  const c = fkEquipClass(meta);
  if(c === "db"){ const n = DB_LADDER.find(x=> x > kg + 1e-9); return n != null ? n : roundTo(kg + 2.5, 2.5); }
  const step = weightStep(meta, kg);
  const lower = /chân|mông|đùi/i.test(String(meta && meta.muscle || ""));
  const inc = Math.max(step, Math.floor(kg * (lower ? 0.05 : 0.025) / step) * step);
  return Math.round((kg + inc) * 100) / 100;
}
/* QT-02: giảm tải ~10 % NHƯNG luôn giảm ít nhất 1 nấc dụng cụ (tạ nhỏ không còn "giảm" về đúng mức cũ).
   Không thể giảm thêm (đã ở nấc nhỏ nhất) → null → giữ tạ, hạ mục tiêu lần / gợi ý đổi bài. */
function fkDeloadKg(meta, kg){
  kg = Number(kg) || 0; if(!(kg > 0)) return null;
  let out;
  if(fkEquipClass(meta) === "db"){
    const below = DB_LADDER.filter(x=> x <= kg * 0.9 + 1e-9);
    out = below.length ? below[below.length - 1] : null;
  } else {
    const step = weightStep(meta, kg * 0.9);
    out = Math.min(kg - step, roundTo(kg * 0.9, step));
  }
  if(out == null || !(out > 0) || out >= kg) return null;
  return Math.round(out * 100) / 100;
}
/* QT-01: hiệp để trống kg (0 / "") kế thừa kg hiệp trước; hiệp đầu trống lấy `fallback` (kg buổi trước) hoặc kg hiệp đầu tiên có số.
   Trả MẢNG MỚI (không sửa đầu vào). Bài trọng lượng cơ thể (mọi hiệp 0, không có fallback) giữ 0. */
function fkFillBlankKg(sets, fallback){
  const arr = (Array.isArray(sets) ? sets : []).map(x=> Object.assign({}, x));
  const first = Number((arr.find(x=> Number(x && x.kg) > 0) || {}).kg) || 0;
  let carry = 0;
  arr.forEach(x=>{
    const k = Number(x.kg);
    if(k > 0){ carry = k; x.kg = k; return; }
    const v = carry || (Number(fallback) > 0 ? Number(fallback) : 0) || first;
    if(v > 0){ x.kg = v; carry = v; }
    else x.kg = 0;
  });
  return arr;
}
/* Bài có tạ? (dụng cụ có tạ, hoặc đã từng ghi kg > 0) — chỉ bài trọng lượng cơ thể mới được lưu 0 kg */
function fkIsWeighted(meta, rows, last){
  if((rows || []).some(r=> Number(r && r.kg) > 0)) return true;
  if(last && Array.isArray(last.sets) && last.sets.some(x=> Number(x && x.kg) > 0)) return true;
  const c = fkEquipClass(meta);
  return c === "db" || c === "barbell" || c === "machine";
}
/* QU-22: chế độ đơn giản cho người mới (ẩn RPE; bật lại bằng nút "Hiện cột RPE") */
function fkSimpleMode(){ const p = state.profile || {}; return p.level === "beginner" && !p.showRpe; }
/* Điền sẵn bảng hiệp (dùng chung cho mọi màn buổi tập — training-pro có thể gọi lại):
   kg = kg buổi trước (ô trống ở dữ liệu cũ đã kế thừa) hoặc mức app tăng/giảm; số lần = số lần buổi trước (QT-10),
   về đáy khoảng lần khi đổi mức tạ; bài tối đa giữ số lần cũ. */
function fkPrefillRows(item, ctx){
  ctx = ctx || {};
  /* FIX-training §4.4: MỘT nguồn điền sẵn — có training-pro (FKTP.ensureRows: top set QT-08, quay lại sau nghỉ QT-13, tuần giảm tải)
     thì dùng nó cho bài thuộc buổi đang tập; không có (hoặc lỗi / gọi ngoài buổi tập) → logic lõi bên dưới. */
  try{
    const TP = typeof window !== "undefined" ? window.FKTP : null;
    const s = typeof session !== "undefined" ? session : null;
    if(TP && typeof TP.ensureRows === "function" && s && item && item.uid != null && Array.isArray(s.items) && s.items.some(x=> x && x.uid === item.uid)){
      const rows = TP.ensureRows(s, item, Object.assign({ top: repTop(item.reps), nSets: Math.max(1, Number(item.sets) || 1) }, ctx));
      if(Array.isArray(rows) && rows.length) return rows;
    }
  }catch(e){ try{ console.warn("[prefill] FKTP.ensureRows", e); }catch(_){} }
  const { last, timed, nSets, prog } = ctx;
  const top = ctx.top != null ? ctx.top : repTop(item.reps);
  const bottom = repBottom(item.reps) || top || "";
  const ls = last && Array.isArray(last.sets) && last.sets.length ? fkFillBlankKg(last.sets, 0) : null;
  const n = Math.max(1, Number(nSets) || Number(item.sets) || 1);
  return Array.from({ length: n }, (_, i)=>{
    const l = ls && (ls[i] || ls[ls.length - 1]);
    const lk = l && Number(l.kg) > 0 ? Number(l.kg) : "";
    const kg = l ? (prog && (prog.delta || prog.hold) && prog.kg ? prog.kg : lk) : "";
    let reps;
    if(timed || isMaxReps(item.reps)) reps = l && isMaxReps(item.reps) ? l.reps : "";
    else if(!l || (prog && prog.delta)) reps = bottom;
    else {
      const lr = Number(l.reps) || 0, hi = prog && prog.repsTarget ? prog.repsTarget : (top || lr);
      reps = lr ? Math.max(Number(bottom) || 0, Math.min(hi, lr)) : bottom;
    }
    return { kg, reps, rpe:"", done:false };
  });
}
/* Quy tắc: đạt ĐỈNH khoảng lần ở mọi hiệp → tăng 1 nấc theo dụng cụ / % (QT-02) — nấc kế tiếp nặng hơn > 15 % (tạ nhỏ, cáp/máy nhẹ)
   thì tăng số lần trước (đỉnh + 2) rồi mới tăng kg · trượt (dưới ĐÁY khoảng lần) 2 buổi liền → giảm ~10 %, ít nhất 1 nấc. */
function progressionFor(item, meta, last, timed, nSets){
  if(timed || !last || !Array.isArray(last.sets) || !last.sets.length || last.date === todayStr()) return { delta:0 };
  const top = repTop(item.reps), bottom = repBottom(item.reps);
  const sets = fkFillBlankKg(last.sets, 0);                     // QT-01: hiệp 0 kg ở dữ liệu cũ = ô bỏ trống → kg hiệp trước
  const baseKg = Math.max(0, ...sets.map(x=> Number(x.kg)||0));
  if(!baseKg){
    // QT-17 (một phần): bài trọng lượng cơ thể đạt đỉnh mọi hiệp → gợi ý cách khó hơn
    if(top && sets.length >= nSets && sets.every(x=> Number(x.reps) >= top))
      return { delta:0, bw:true, msg:`Đạt ${top} lần ở mọi hiệp — buổi này thử thêm 1–2 lần, hạ chậm 3 giây, hoặc chuyển sang biến thể khó hơn / đeo thêm tạ.` };
    return { delta:0 };
  }
  if((last.fails||0) >= 2){
    const kg = fkDeloadKg(meta, baseKg);
    if(kg != null) return { delta:-1, kg, msg:`Bạn đã trượt mục tiêu 2 buổi liền → app tự <b>giảm tải còn ${fmtKg(kg)} kg</b> (−${Math.round((1 - kg/baseKg)*100)} %) để lấy lại đà rồi tăng tiếp.` };
    return { delta:0, kg: baseKg, hold:true, msg:`Đã trượt 2 buổi liền ở mức tạ nhỏ nhất (${fmtKg(baseKg)} kg) → <b>giữ tạ</b>, tập ${Math.max(1, (bottom||1) - 2)}–${bottom||1} lần/hiệp cho chắc kỹ thuật, hoặc đổi sang biến thể dễ hơn.` };
  }
  const hardRpe = sets.some(x=> Number(x.rpe) >= 9.5);
  // BUG-11: "đạt đỉnh" phải ở ĐÚNG mức tạ chính — hiệp tụt tạ (drop set) không tính
  if(top && sets.length >= nSets && sets.every(x=> Number(x.reps) >= top && (Number(x.kg)||0) >= baseKg) && !hardRpe){
    const kg = fkNextKg(meta, baseKg), jump = (kg - baseKg) / baseKg;
    if(jump > 0.15){
      const ext = top + 2;
      if(!sets.every(x=> Number(x.reps) >= ext))
        return { delta:0, repsTarget: ext, msg:`Đạt ${top} lần ở mọi hiệp! Nấc tạ kế tiếp ${fmtKg(kg)} kg nặng hơn ${Math.round(jump*100)} % — hãy <b>thêm 1–2 lần/hiệp (mục tiêu ${ext} lần)</b> trước, đạt rồi app mới tăng tạ.` };
    }
    return { delta:1, kg, msg:`Lần trước đạt ${jump > 0.15 ? top + 2 : top} lần ở mọi hiệp → app đã <b>tự tăng lên ${fmtKg(kg)} kg</b> (+${fmtKg(kg - baseKg)} kg).` };
  }
  return { delta:0 };
}
function recordExerciseResult(key, name, reps, sets, timed){
  state.setLog = state.setLog || {}; state.setHist = state.setHist || {};
  /* R3-CORE: chuẩn hoá hiệp trước khi ghi — kg 0–500, lần 0–200 (module khác / dữ liệu PT gửi số âm, NaN, chuỗi không làm hỏng lịch sử) */
  sets = (Array.isArray(sets) ? sets : []).filter(x=> x && typeof x === "object").slice(0, FK_MAX_SETS * 2);
  sets.forEach(x=>{ const k = Number(x.kg), r = Number(x.reps); x.kg = Number.isFinite(k) && k > 0 ? Math.min(500, Math.round(k * 100) / 100) : 0; x.reps = Number.isFinite(r) && r > 0 ? Math.min(200, Math.round(r)) : 0; });
  const prev = state.setLog[key];
  const day = (typeof session !== "undefined" && session && typeof session.date === "string" && session.date) || todayStr();   // QT-07
  // QT-01: bài có tạ → hiệp trống kg lấy kg hiệp trước / mức tạ buổi trước (không lưu 0 kg, không kéo e1RM/khối lượng/tự tăng)
  if(!timed){
    const prevTop = prev && Array.isArray(prev.sets) ? Math.max(0, ...fkFillBlankKg(prev.sets, 0).map(x=> Number(x.kg)||0)) : 0;
    if(sets.some(x=> Number(x && x.kg) > 0) || prevTop > 0){
      const f = fkFillBlankKg(sets, prevTop);
      sets.forEach((x, i)=>{ if(x && typeof x === "object") x.kg = f[i].kg; });
    }
  }
  const bottom = repBottom(reps);
  // Trượt = từ 2 hiệp trở lên dưới đáy khoảng lần. Sau khi đã giảm tải thì đếm lại từ 0.
  const failed = !timed && bottom && sets.filter(x=> x.kg>0 && x.reps < bottom).length >= Math.min(2, sets.length);
  // BUG-11: chỉ đếm lại từ 0 khi người dùng THẬT SỰ giảm tạ sau gợi ý giảm tải; vẫn giữ mức cũ thì tiếp tục đếm (vẫn gợi ý giảm)
  const topOf = arr => Math.max(0, ...(arr||[]).map(x=> Number(x.kg)||0));
  const prevFails = prev && prev.date !== day
    ? (prev.fails >= 2 && topOf(sets) < topOf(prev.sets) ? 0 : (prev.fails||0))
    : ((prev && prev.prevFails)||0);
  state.setLog[key] = { date: day, sets, reps, fails: failed ? prevFails + 1 : 0, prevFails };
  if(timed) return;
  const h = state.setHist[key] = state.setHist[key] || { name, list:[] };
  if(!Array.isArray(h.list)) h.list = [];
  h.name = name;
  const prevBest = Math.max(0, ...h.list.map(x=> x.e1rm||0));
  /* QT-06: 2 buổi trong cùng ngày → GỘP (nối hiệp, e1RM = max, khối lượng cộng dồn) thay vì ghi đè buổi trước.
     Cùng 1 buổi lưu lại bài này (sid giống nhau) → thay phần của buổi đó, không đếm trùng. */
  const sid = (typeof session !== "undefined" && session && session.sid) || "_";
  const old = h.list.find(x=> x.date === day);
  const parts = old ? (old.parts && typeof old.parts === "object" ? Object.assign({}, old.parts) : { [old.sid || "_"]: Array.isArray(old.sets) ? old.sets : [] }) : {};
  parts[sid] = sets.map(x=> { const o = { kg: Number(x.kg)||0, reps: Number(x.reps)||0 }; if(x.rpe != null && x.rpe !== "") o.rpe = x.rpe; return o; });
  const pk = Object.keys(parts), all = pk.flatMap(k=> parts[k]);
  const best = Math.max(0, ...all.map(x=> e1rm(x.kg, x.reps)));
  const vol = all.reduce((a,x)=> a + (x.kg||0)*(x.reps||0), 0);
  h.list = h.list.filter(x=> x.date !== day);
  const entry = { date: day, e1rm: Math.round(best*10)/10, top: Math.max(0,...all.map(x=>x.kg||0)), vol: Math.round(vol), sets: all };
  if(pk.length > 1) entry.parts = parts; else if(sid !== "_") entry.sid = sid;
  h.list.push(entry);
  h.list.sort((a,b)=> a.date < b.date ? -1 : 1);
  if(h.list.length > 120) h.list = h.list.slice(-120);
  if(best > 0 && prevBest > 0 && best > prevBest + 0.4 && typeof session !== "undefined" && session){
    session.prs = session.prs || []; session.prs.push({ name, e1rm: Math.round(best) });
    toast(`🏆 Kỷ lục mới: ${name} ~${Math.round(best)} kg`, "military_tech");
  }
}
/* warmupHTML(kg, meta, reps?) — QT-15: theo khoảng lần. Có reps với đáy ≥ 8 lần (tăng cơ): 2 hiệp 50 %×10, 75 %×5;
   máy/cáp: 1 hiệp 50 %×10. Không có reps hoặc lần thấp (sức mạnh): thang 40–60–80–90 % như cũ.
   Thanh đòn ≤ 20 kg: không cần hiệp khởi động riêng. */
function warmupHTML(kg, meta, reps){
  const isBar = /thanh đòn|tạ đòn|đòn ez|barbell/i.test(String(meta && meta.equipment || ""));
  if(isBar && Number(kg) === 20) return `<p class="small-note">Mức tạ ${fmtKg(kg)} kg chỉ bằng thanh đòn rỗng — không cần hiệp khởi động riêng. Làm 1 hiệp nhẹ nhàng 8–10 lần để làm quen động tác rồi vào hiệp chính.</p>`;
  if(!kg || kg < 20) return `<p class="small-note">Nhập mức tạ hiệp chính (≥ 20 kg) để app chia hiệp khởi động. Tạ nhẹ: khởi động 1 hiệp 10–12 lần với ~50% mức tạ.</p>`;
  const step = weightStep(meta);
  const bottom = reps != null ? repBottom(reps) : 0;
  const scheme = bottom >= 8 ? (fkEquipClass(meta) === "machine" ? [[0.5,10]] : [[0.5,10],[0.75,5]]) : [[0.4,8],[0.6,5],[0.8,3],[0.9,1]];
  let rows = scheme.filter(([p])=> kg*p >= 10).map(([p,r])=> ({ kg: roundTo(kg*p, step), r, pct: Math.round(p*100) }));
  // BUG-12: thanh đòn nặng 20 kg → không gợi ý mức nhẹ hơn; hiệp đầu "Thanh rỗng 20 kg × 10", bỏ hiệp trùng mức tạ
  if(isBar){
    const seen = new Set([20]);
    rows = [{ kg:20, r:10, pct: Math.round(20/kg*100), label:"Thanh rỗng" }]
      .concat(rows.filter(x=> x.kg > 20 && x.kg < kg && !seen.has(x.kg) && seen.add(x.kg)));
  }
  return `<div class="tb-title">Khởi động trước hiệp chính ${kg} kg</div>` + rows.map((x,i)=>`<div class="tb-row"><span>Hiệp ${i+1}${x.label ? " · " + x.label : ""}</span><b>${x.kg} kg × ${x.r}</b><small>${x.pct}%</small></div>`).join("") + `<p class="small-note">Nghỉ 30–60 giây giữa các hiệp khởi động.</p>`;
}
function plateHTML(kg){
  const bar = 20, plates = [25,20,15,10,5,2.5,1.25];
  if(!kg || kg <= bar) return `<p class="small-note">Thanh đòn tiêu chuẩn nặng 20 kg. Nhập mức tạ lớn hơn 20 kg để xem cách lắp đĩa.</p>`;
  let side = (kg - bar)/2; const used = [];
  plates.forEach(p=>{ while(side >= p - 1e-6){ used.push(p); side -= p; } });
  const colors = {25:"#E5484D",20:"#3E7BFA",15:"#F5C542",10:"#3DBE7A",5:"#ECEDEE",2.5:"#9AA4AE",1.25:"#C6CCD2"};
  return `<div class="tb-title">${kg} kg = thanh 20 kg + mỗi bên ${roundTo((kg-bar)/2,0.25)} kg</div>
    <div class="plate-viz"><i class="bar"></i>${used.map(p=>`<i class="pl" style="--c:${colors[p]};--h:${30+p*1.6}px" title="${p} kg"></i>`).join("")}</div>
    <div class="tb-row"><span>Mỗi bên</span><b>${used.join(" + ") || "—"}</b></div>${side>0.01?`<p class="small-note">Còn lẻ ${roundTo(side,0.25)} kg mỗi bên — làm tròn tạ cho vừa đĩa.</p>`:""}`;
}
function sparkSVG(vals, w=300, h=110){
  if(vals.length < 2) return `<p class="small-note">Cần ít nhất 2 buổi để vẽ biểu đồ.</p>`;
  const mn = Math.min(...vals), mx = Math.max(...vals), pad = 10, rng = (mx-mn)||1;
  const pts = vals.map((v,i)=> [pad + i*(w-2*pad)/(vals.length-1), h-pad - (v-mn)/rng*(h-2*pad)]);
  const d = pts.map((p,i)=> (i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" class="spark"><path d="${d} L${pts[pts.length-1][0]} ${h} L${pts[0][0]} ${h} Z" class="area"/><path d="${d}" class="line"/>${pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3"/>`).join("")}</svg>`;
}
function openExerciseHistory(key, name, onBack){
  const h = (state.setHist||{})[key];
  // QT-11: bản ghi cũ thiếu list/sets/date không làm vỡ sheet Lịch sử
  const list = (h && Array.isArray(h.list) ? h.list : []).filter(x=> x && typeof x === "object")
    .map(x=> Object.assign({}, x, { date: String(x.date || ""), sets: Array.isArray(x.sets) ? x.sets : [], vol: Number(x.vol) || 0, e1rm: Number(x.e1rm) || 0 }));
  const best = list.reduce((a,x)=> x.e1rm > (a?a.e1rm:0) ? x : a, null);
  const heaviest = list.reduce((a,x)=> Math.max(a, Number(x.top)||0), 0);
  openSheet(`
    <div class="sheet-header">${onBack?`<button class="icon-btn" id="hist-back" aria-label="Quay lại"><span class="material-symbols-rounded">arrow_back</span></button>`:""}<h3 style="flex:1;margin-left:8px;font-size:17px;">${escapeHtml(name)}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    ${list.length ? `
    <div class="stat-grid" style="margin:4px 0 12px;">
      <div class="stat-box"><div class="num">${best ? Math.round(best.e1rm) : "–"}</div><div class="cap">1RM ước tính (kg)</div></div>
      <div class="stat-box"><div class="num">${heaviest||"–"}</div><div class="cap">Tạ nặng nhất</div></div>
      <div class="stat-box"><div class="num">${list.length}</div><div class="cap">Buổi đã tập</div></div>
    </div>
    <div class="card-title" style="font-size:13px;">1RM ước tính qua các buổi</div>
    ${sparkSVG(list.map(x=>x.e1rm))}
    <div class="card-title" style="font-size:13px;margin-top:12px;">Các buổi gần đây</div>
    ${list.slice(-8).reverse().map(x=>`<div class="tb-row"><span>${escapeHtml(x.date.slice(8,10))}/${escapeHtml(x.date.slice(5,7))}</span><b>${x.sets.map(s=>`${fmtKg(s && s.kg)}×${Number(s && s.reps)||0}`).join(" · ")}</b><small>${x.vol.toLocaleString("vi-VN")} kg</small></div>`).join("")}
    <p class="small-note" style="margin-top:8px;">1RM ước tính theo công thức Epley: tạ × (1 + lần/30).</p>`
    : `<p class="empty-hint">Chưa có dữ liệu — hoàn thành bài này trong buổi tập để bắt đầu theo dõi.</p>`}
  `);
  const b = $("#hist-back"); if(b) b.addEventListener("click", onBack);
}
/* Kỷ lục cá nhân: thẻ trong màn Tiến độ */
function prCardHTML(){
  const H = state.setHist || {};
  const rows = Object.entries(H).filter(([k,h])=> h && Array.isArray(h.list)).map(([k,h])=>({ k, name:h.name, best: Math.max(0,...h.list.map(x=>(x && x.e1rm)||0)), n:h.list.length, last:h.list[h.list.length-1] })).filter(x=>x.best>0).sort((a,b)=> b.best-a.best);
  if(!rows.length) return "";
  return `<div class="card pr-card"><div class="card-title"><span class="material-symbols-rounded">military_tech</span>Kỷ lục cá nhân</div>
    ${rows.slice(0,30).map(x=>`<div class="tb-row" data-pr="${escapeHtml(x.k)}"><span>${escapeHtml(x.name)}</span><b>${Math.round(x.best)} kg</b><small>${x.n} buổi ›</small></div>`).join("")}
    <p class="small-note">1RM ước tính · chạm vào một bài để xem biểu đồ.</p></div>`;
}
/* QU-21: thẻ Kỷ lục cá nhân nay nằm trong tab "Kỷ lục" (renderProgressRecordsTab) — không chèn vào tab Ảnh nữa */
/* Báo hết giờ nghỉ khi điện thoại khoá màn hình (thông báo cục bộ trên app cài từ store) */
async function scheduleRestNotif(sec){
  try{
    const P = window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.Plugins.LocalNotifications;
    if(!P) return;
    await P.cancel({ notifications:[{ id: 900 }] }).catch(()=>{});
    await P.schedule({ notifications:[{ id: 900, title:"Hết giờ nghỉ 💪", body:"Vào hiệp tiếp theo thôi!", schedule:{ at: new Date(Date.now()+sec*1000), allowWhileIdle:true } }] });
  }catch(e){}
}
async function cancelRestNotif(){
  try{ const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications; if(P && Capacitor.isNativePlatform()) await P.cancel({ notifications:[{ id: 900 }] }); }catch(e){}
}

/* =========================================================================
   TapEasy — Thư viện 800+ bài tập (free-exercise-db, giấy phép Unlicense /
   Public Domain — dùng thương mại thoải mái).
   Nguồn: https://github.com/yuhonas/free-exercise-db

   - Bản build app (GitHub Actions) tải sẵn file vào vendor/exercises.json
     → dùng được không cần mạng (trừ ảnh minh hoạ).
   - Khi chạy web/thử nghiệm mà chưa có file đó → tải trực tiếp từ GitHub.
   ========================================================================= */
const EXDB_REMOTE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const EXDB_IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

const EXDB_MUSCLE_VI = {
  abdominals:"Bụng", abductors:"Đùi ngoài", adductors:"Đùi trong", biceps:"Tay trước", calves:"Bắp chân",
  chest:"Ngực", forearms:"Cẳng tay", glutes:"Mông", hamstrings:"Đùi sau", lats:"Xô (lưng rộng)",
  "lower back":"Lưng dưới", "middle back":"Lưng giữa", neck:"Cổ", quadriceps:"Đùi trước",
  shoulders:"Vai", traps:"Cầu vai", triceps:"Tay sau",
};
const EXDB_EQUIP_VI = {
  barbell:"Tạ đòn", dumbbell:"Tạ đơn", "body only":"Không dụng cụ", machine:"Máy", cable:"Cáp",
  kettlebells:"Tạ ấm", bands:"Dây kháng lực", "medicine ball":"Bóng tạ", "exercise ball":"Bóng tập",
  "foam roll":"Con lăn", "e-z curl bar":"Đòn EZ", other:"Khác",
};
const EXDB_LEVEL_VI = { beginner:"Mới tập", intermediate:"Trung bình", expert:"Nâng cao" };
const EXDB_FILTERS = [
  { id:"all", label:"Tất cả" }, { id:"chest", label:"Ngực" }, { id:"back", label:"Lưng" },
  { id:"shoulders", label:"Vai" }, { id:"arms", label:"Tay" }, { id:"legs", label:"Chân" },
  { id:"abdominals", label:"Bụng" }, { id:"cardio", label:"Cardio" }, { id:"stretching", label:"Giãn cơ" },
];
const EXDB_GROUP = {
  back:["lats","middle back","lower back","traps"], arms:["biceps","triceps","forearms"],
  legs:["quadriceps","hamstrings","glutes","calves","adductors","abductors"],
};

let _exdbCache = null, _exdbLoading = null;
function exdbLoad(){
  if(_exdbCache) return Promise.resolve(_exdbCache);
  if(_exdbLoading) return _exdbLoading;
  _exdbLoading = (async ()=>{
    /* 20/11: bản web (tapeasy.app) không có vendor/ → bỏ qua để khỏi 404 + 1 vòng mạng thừa; bản app (Capacitor) vẫn đọc file đóng gói sẵn */
    const web = (()=>{ try{ return /(^|\.)tapeasy\.app$/.test(location.hostname); }catch(e){ return false; } })();
    for(const url of (web ? [EXDB_REMOTE] : ["vendor/exercises.json", EXDB_REMOTE])){
      try{
        const r = await fetch(url);
        if(!r.ok) continue;
        const data = await r.json();
        if(Array.isArray(data) && data.length){ _exdbCache = data; return data; }
      }catch(e){ /* thử nguồn tiếp theo */ }
    }
    _exdbLoading = null;
    throw new Error("Không tải được thư viện bài tập — kiểm tra kết nối mạng.");
  })();
  return _exdbLoading;
}
/* ---- Nạp lười bản Việt hoá exdb-vi*.js (hợp đồng fkLazy — docs/qa/HANDOFF-ROUND-BRIEF.md) ----
   Có window.fkLazy → chờ fkLazy.load('exdbvi') (ux: nạp tuần tự, nhớ đã nạp, resolve ngay khi dữ liệu có sẵn, lỗi mạng → reject).
   Chưa có fkLazy (thẻ <script> exdb-vi*.js còn trong index.html, bản cũ, môi trường test) → xong ngay.
   Nhớ promise đang chạy; bị reject thì xoá để lần sau "Thử lại" nạp lại. Kết quả: true = đã chờ fkLazy, false = không cần chờ. */
let _exdbViP = null;
function exdbViReady(){
  const W = typeof window !== "undefined" ? window : globalThis;
  const L = W.fkLazy;
  if(!L || typeof L.load !== "function") return Promise.resolve(false);
  if(!_exdbViP){
    _exdbViP = Promise.resolve().then(()=> L.load("exdbvi")).then(()=> true, e=>{ _exdbViP = null; throw e || new Error("Không tải được bản tiếng Việt"); });
  }
  return _exdbViP;
}
function exdbImg(ex, i=0){ return ex.images && ex.images[i] ? EXDB_IMG_BASE + ex.images[i] : ""; }
function exdbMuscleVi(ex){ return (ex.primaryMuscles||[]).map(m=>EXDB_MUSCLE_VI[m]||m).join(", ") || "Toàn thân"; }
function exdbMatches(ex, filter){
  if(filter==="all") return true;
  if(filter==="cardio" || filter==="stretching") return ex.category===filter;
  const muscles = ex.primaryMuscles||[];
  if(EXDB_GROUP[filter]) return muscles.some(m=>EXDB_GROUP[filter].includes(m));
  return muscles.includes(filter);
}
/* Chuyển 1 bài trong thư viện sang dạng dùng trong app */
function exdbToItem(ex){
  const isCardio = ex.category==="cardio", isStretch = ex.category==="stretching";
  return {
    exDbId: ex.id,
    name: ex.name,
    muscle: exdbMuscleVi(ex),
    equipment: EXDB_EQUIP_VI[ex.equipment] || ex.equipment || "—",
    guide: (ex.instructions||[]).join("\n"),
    img: exdbImg(ex, 0),
    sets: isCardio ? 1 : 3,
    reps: isCardio ? "10 phút" : isStretch ? "30 giây" : "10-12",
    restSec: isCardio || isStretch ? 30 : 75,
  };
}

/* Sheet chọn bài: onPick(item) nhận object từ exdbToItem.
   Nếu truyền opts.multi = true → chọn nhiều, onPick nhận mảng. */
function openExDbPicker(onPick, opts={}){
  /* fkLazy: nếu cả lớp Việt hoá (exdb-vi.js) cũng nạp lười và chưa có → nạp rồi gọi lại openExDbPicker toàn cục
     (khi đó đã được exdb-vi.js bọc: tên Việt + tìm không dấu). Lỗi nạp → dùng bảng gốc (tên tiếng Anh) bên dưới. */
  const W = typeof window !== "undefined" ? window : globalThis;
  if(!opts._viTried && !W.exdbVi && W.fkLazy && typeof W.fkLazy.load === "function"){
    const again = ()=>{   // đã đóng sheet / mở sheet khác trong lúc chờ → thôi
      const w = document.getElementById("exdb-vi-wait"), bd = document.getElementById("sheet-backdrop");
      if(w && (!bd || !bd.classList || bd.classList.contains("open"))) openExDbPicker(onPick, Object.assign({}, opts, { _viTried:true }));
    };
    openSheet(`<div class="sheet-header"><h3>Thư viện 800+ bài tập</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
      <p class="empty-hint" id="exdb-vi-wait" role="status">Đang tải thư viện bài tập…</p>`);
    exdbViReady().then(again, e=>{ console.warn("[exdb] exdbvi", e); again(); });
    return;
  }
  let filter = opts._filter || "all", q = opts._q || "", picked = opts._picked || [];
  openSheet(`
    <div class="sheet-header"><h3>Thư viện 800+ bài tập</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="search-box" style="margin-bottom:10px;"><span class="material-symbols-rounded" style="color:var(--text-dim);">search</span><input type="text" id="exdb-q" value="${escapeHtml(q)}" placeholder="Tìm theo tên tiếng Anh — VD: squat, bench, curl"></div>
    <div class="chip-row" id="exdb-filters" style="flex-wrap:nowrap;overflow-x:auto;margin-bottom:10px;padding-bottom:4px;">
      ${EXDB_FILTERS.map(f=>`<button class="pill ${f.id===filter?'active':''}" data-exf="${f.id}" style="flex-shrink:0;">${f.label}</button>`).join("")}
    </div>
    <div id="exdb-list" style="max-height:48vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
      <p class="empty-hint">Đang tải thư viện bài tập...</p>
    </div>
    ${opts.multi ? `<button class="btn btn-primary btn-block" id="exdb-done" style="margin-top:12px;">Thêm ${picked.length} bài đã chọn</button>` : ""}
    <p class="small-note" style="margin-top:8px;text-align:center;">Dữ liệu: free-exercise-db (Public Domain)</p>
  `);
  /* 20/11 (góp ý người dùng "không hiện hết bài"): trước cắt cứng 80 bài → giờ hiện theo lượt 60 bài, cuộn tới cuối tự nạp thêm
     + dòng "Đang hiện x / tổng"; tìm kiếm chờ 150 ms; chọn nhiều chỉ đổi ô vừa bấm (không vẽ lại cả danh sách → hết giật). */
  const STEP = 60; let shown = STEP, rowsAll = [];
  const rowHTML = ex=>{
      const sel = picked.some(p=>p.exDbId===ex.id);
      return `<div class="list-item" data-exdb="${escapeHtml(ex.id)}" style="cursor:pointer;${sel?'border-color:var(--primary);':''}">
        <img class="thumb" src="${escapeHtml(exdbImg(ex))}" loading="lazy" decoding="async" width="56" height="56" alt="" style="object-fit:cover;background:#fff;" onerror="this.style.visibility='hidden'">
        <div class="info"><div class="name">${escapeHtml(ex.name)}</div><div class="meta">${escapeHtml(exdbMuscleVi(ex))} · ${escapeHtml(EXDB_EQUIP_VI[ex.equipment]||ex.equipment||"—")} · ${escapeHtml(EXDB_LEVEL_VI[ex.level]||"")}</div></div>
        <span class="material-symbols-rounded" data-exdb-info="${escapeHtml(ex.id)}" role="button" aria-label="Xem hướng dẫn ${escapeHtml(ex.name)}" style="color:var(--text-dim);padding:6px;">info</span>
        <span class="material-symbols-rounded exdb-tick" style="color:${sel?'var(--primary)':'var(--text-dim)'};">${sel?'check_circle':'add_circle'}</span>
      </div>`;
  };
  const moreHTML = ()=> shown < rowsAll.length
    ? `<button type="button" class="btn btn-ghost btn-block btn-sm" id="exdb-more">Xem thêm · đang hiện ${shown}/${rowsAll.length} bài</button>`
    : (rowsAll.length > STEP ? `<p class="small-note" style="text-align:center;">Đã hiện đủ ${rowsAll.length} bài</p>` : "");
  const appendMore = ()=>{
    const box = $("#exdb-list"); if(!box) return;
    const from = shown; shown = Math.min(rowsAll.length, shown + STEP);
    const old = box.querySelector("#exdb-more, .small-note"); if(old) old.remove();
    box.insertAdjacentHTML("beforeend", rowsAll.slice(from, shown).map(rowHTML).join("") + moreHTML());
  };
  let wired = false;
  const renderList = (all)=>{
    const ql = q.trim().toLowerCase();
    rowsAll = all.filter(ex=> exdbMatches(ex, filter) && (!ql || ex.name.toLowerCase().includes(ql))); shown = STEP;
    const box = $("#exdb-list"); if(!box) return;
    box.scrollTop = 0;
    box.innerHTML = (rowsAll.slice(0, shown).map(rowHTML).join("") + moreHTML()) || `<p class="empty-hint">Không tìm thấy bài phù hợp.</p>`;
    if(wired) return; wired = true;
    /* uỷ quyền 1 lần cho cả danh sách (trước gắn 160 listener mỗi lần vẽ) */
    box.addEventListener("scroll", ()=>{ if(shown < rowsAll.length && box.scrollTop + box.clientHeight > box.scrollHeight - 300) appendMore(); }, { passive:true });
    box.addEventListener("click", e=>{
      const t = e.target;
      if(t.closest("#exdb-more")){ appendMore(); return; }
      const inf = t.closest("[data-exdb-info]");
      if(inf){ e.stopPropagation(); const ex = all.find(x=>x.id===inf.dataset.exdbInfo); openExDbDetail(ex, ()=> openExDbPicker(onPick, Object.assign({}, opts, { _picked: picked, _filter: filter, _q: q }))); return; }
      const el = t.closest("[data-exdb]"); if(!el) return;
      const ex = all.find(x=>x.id===el.dataset.exdb); if(!ex) return;
      const item = exdbToItem(ex);
      if(!opts.multi){ closeSheet(); onPick(item); return; }
      const i = picked.findIndex(p=>p.exDbId===ex.id);
      if(i>=0) picked.splice(i,1); else picked.push(item);
      const sel = i < 0, tick = el.querySelector(".exdb-tick");
      el.style.borderColor = sel ? "var(--primary)" : "";
      if(tick){ tick.textContent = sel ? "check_circle" : "add_circle"; tick.style.color = sel ? "var(--primary)" : "var(--text-dim)"; }
      $("#exdb-done").textContent = `Thêm ${picked.length} bài đã chọn`;
    });
  };
  exdbLoad().then(all=>{
    renderList(all);
    let tq = 0;
    $("#exdb-q").addEventListener("input", e=>{ q = e.target.value; clearTimeout(tq); tq = setTimeout(()=> renderList(all), 150); });
    $$("[data-exf]").forEach(b=> b.addEventListener("click", ()=>{
      filter = b.dataset.exf; $$("[data-exf]").forEach(x=>x.classList.toggle("active", x===b)); renderList(all);
    }));
    if(opts.multi) $("#exdb-done").addEventListener("click", ()=>{
      if(!picked.length){ toast("Chưa chọn bài nào", "error"); return; }
      closeSheet(); onPick(picked);
    });
  }).catch(err=>{
    const el = $("#exdb-list"); if(el) el.innerHTML = `<p class="empty-hint">${escapeHtml(err.message)}</p>`;
  });
}

function openExDbDetail(ex, onBack){
  let frame = 0;
  openSheet(`
    <div class="sheet-header"><h3 style="font-size:18px;">${escapeHtml(ex.name)}</h3><button class="icon-btn" id="exdb-back" aria-label="Quay lại"><span class="material-symbols-rounded">arrow_back</span></button></div>
    <img id="exdb-anim" src="${escapeHtml(exdbImg(ex,0))}" alt="${escapeHtml(ex.name)} — ảnh kỹ thuật" decoding="async" style="width:100%;max-height:34vh;object-fit:contain;background:#fff;border-radius:14px;">
    <div class="chip-row" style="margin:10px 0;">
      <span class="pill">${escapeHtml(exdbMuscleVi(ex))}</span>
      <span class="pill">${escapeHtml(EXDB_EQUIP_VI[ex.equipment]||ex.equipment||"—")}</span>
      <span class="pill">${escapeHtml(EXDB_LEVEL_VI[ex.level]||ex.level||"")}</span>
    </div>
    <div class="card-title" style="font-size:13px;">Hướng dẫn (tiếng Anh)</div>
    <ol style="padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--text-muted);">
      ${(ex.instructions||[]).map(s=>`<li>${escapeHtml(s)}</li>`).join("")}
    </ol>
  `);
  const timer = setInterval(()=>{
    const img = $("#exdb-anim"); if(!img){ clearInterval(timer); return; }
    frame = (frame+1) % Math.max(1,(ex.images||[]).length); img.src = exdbImg(ex, frame);
  }, 900);
  onSheetCloseHook = ()=> clearInterval(timer);
  $("#exdb-back").addEventListener("click", ()=>{ clearInterval(timer); onSheetCloseHook=null; onBack ? onBack() : closeSheet(); });
}

/* =========================================================================
   ẢNH BÌA ĐÚNG TỪNG BÀI (fkThumb) — 22/11/2026
   Lỗi cũ: 68 bài chuẩn (data.js + templates.js) dùng chung IMG.muscle_<nhóm> → mọi bài "Chân"
   (Leg Extension, Leg Press, Back Squat, Lunge, Calf Raise, Hack/Smith/Front/Goblet Squat, Bulgarian…)
   hiện cùng 1 ảnh người tập goblet squat (people-ai.js đổi ảnh Pexels nhóm cơ → ảnh AI nhóm cơ).
   Nay mỗi bài lấy ảnh theo thứ tự độ chuẩn:
     a) khung hình 3D của chính bài (media/ex3d/<slug>.jpg — poster sẵn của clip 3D, ghép theo id free-exercise-db / core);
     b) (clip hướng dẫn khớp chặt — chỉ dùng ở thẻ giáo án qua item.stock.thumb, sau a/c);
     c) ảnh của chính bài trong free-exercise-db (Public Domain / Unlicense — app đã credit);
     d) không có ảnh đúng → ô minh hoạ trung tính (icon dụng cụ + màu nhóm cơ + chữ viết tắt), KHÔNG dùng ảnh người tập bài khác.
   Bảng EX3D_SLUGS phải khớp media/ex3d/index.json (test 116 + scripts/thumb-audit.js kiểm tra).
   ========================================================================= */
const FK_THUMB_E3_BASE = "https://tapeasy.app/media/ex3d/";
const FK_THUMB_NEUTRAL_DIR = "assets/ex-thumbs/";
/* slug clip 3D → id free-exercise-db (phần tử đầu = bài chính của clip) */
const FK_EX3D_SLUGS = {
    "barbell-curl":["Barbell_Curl","Close-Grip_Standing_Barbell_Curl","Wide-Grip_Standing_Barbell_Curl"],
    "barbell-drag-curl":["Drag_Curl"],
    "barbell-front-chest-squat":["Front_Barbell_Squat","Front_Squat_Clean_Grip"],
    "barbell-lunge":["Barbell_Lunge","Barbell_Walking_Lunge"],
    "barbell-straight-leg-deadlift":["Stiff-Legged_Barbell_Deadlift","Romanian_Deadlift"],
    "barbell-underhand-bent-over-row":["Reverse_Grip_Bent-Over_Rows"],
    "cable-bar-lateral-pulldown-reverse-grip":["Underhand_Cable_Pulldowns"],
    "cable-bar-lateral-pulldown-wide-shoulder-grip":["Wide-Grip_Lat_Pulldown","Full_Range-Of-Motion_Lat_Pulldown"],
    "cable-close-grip-front-lat-pulldown":["Close-Grip_Front_Lat_Pulldown","V-Bar_Pulldown"],
    "cable-lateral-raise":["Cable_Seated_Lateral_Raise"],
    "cable-lying-fly-flat-bench-cable-fly":["Flat_Bench_Cable_Flyes"],
    "cable-one-arm-curl":["Standing_One-Arm_Cable_Curl"],
    "cable-one-arm-lateral-raise":["One-Arm_Side_Laterals","Standing_Low-Pulley_Deltoid_Raise"],
    "cable-standing-fly-crossover-fly":["Cable_Crossover"],
    "cable-standing-one-arm-triceps-extension":["Cable_One_Arm_Tricep_Extension"],
    "cable-straight-arm-pulldown":["Straight-Arm_Pulldown","Rope_Straight-Arm_Pulldown"],
    "cable-straight-back-seated-row-v-grip":["Seated_Cable_Rows"],
    "cable-triceps-pushdown":["Triceps_Pushdown","Triceps_Pushdown_-_V-Bar_Attachment"],
    "cambered-bar-lying-row":["Lying_Cambered_Barbell_Row"],
    "classic-barbell-squat":["Barbell_Squat","Barbell_Full_Squat"],
    "close-feet-leg-press":["Narrow_Stance_Leg_Press"],
    "decline-dumbbell-bench-press-45-degree":["Decline_Dumbbell_Bench_Press"],
    "dumbbell-arnold-press":["Arnold_Dumbbell_Press"],
    "dumbbell-bent-over-row":["One-Arm_Dumbbell_Row"],
    "dumbbell-biceps-curl":["Dumbbell_Bicep_Curl","Dumbbell_Alternate_Bicep_Curl"],
    "dumbbell-close-grip-press":["Close-Grip_Dumbbell_Press","Dumbbell_Bench_Press_with_Neutral_Grip"],
    "dumbbell-cross-body-hammer-curl":["Cross_Body_Hammer_Curl"],
    "dumbbell-deadlift":["Stiff-Legged_Dumbbell_Deadlift"],
    "dumbbell-fly":["Dumbbell_Flyes"],
    "dumbbell-front-raise":["Front_Dumbbell_Raise","Front_Two-Dumbbell_Raise"],
    "dumbbell-goblet-squat":["Goblet_Squat"],
    "dumbbell-incline-bench-press":["Incline_Dumbbell_Press"],
    "dumbbell-incline-row":["Dumbbell_Incline_Row"],
    "dumbbell-lateral-raise":["Side_Lateral_Raise","Seated_Side_Lateral_Raise"],
    "dumbbell-lunge":["Dumbbell_Lunges"],
    "dumbbell-lying-triceps-extension":["Lying_Dumbbell_Tricep_Extension"],
    "elliptical":["Elliptical_Trainer"],
    "ez-barbell-anti-gravity-press":["Anti-Gravity_Press"],
    "ez-barbell-biceps-curl":["EZ-Bar_Curl","Close-Grip_EZ_Bar_Curl"],
    "ez-barbell-lying-triceps-extension":["EZ-Bar_Skullcrusher","Lying_Triceps_Press"],
    "lever-high-row":["Leverage_High_Row"],
    "lever-leg-extension":["Leg_Extensions"],
    "lever-lying-chest-press":["Leverage_Chest_Press","Machine_Bench_Press"],
    "lever-lying-leg-curl":["Lying_Leg_Curls"],
    "lever-preacher-curl":["Machine_Preacher_Curls"],
    "lever-seated-dips":["Dip_Machine"],
    "lever-seated-hip-adduction":["Thigh_Adductor"],
    "lever-seated-reverse-fly":["Reverse_Machine_Flyes"],
    "lever-standing-rear-kick":["Glute_Kickback"],
    "military-press":["Seated_Barbell_Military_Press","Barbell_Shoulder_Press"],
    "sled-45-degree-calf-press":["Calf_Press_On_The_Leg_Press_Machine","Calf_Press"],
    "sled-45-degree-leg-wide-press":["Leg_Press"],
    "sled-hack-squat":["Hack_Squat"],
    "smith-chair-squat":["Smith_Machine_Squat"],
    "smith-leg-press":["Smith_Machine_Leg_Press"],
    "smith-seated-shoulder-press":["Smith_Machine_Overhead_Shoulder_Press"],
    "stationary-bike":["Bicycling_Stationary"],
    "treadmill-running":["Running_Treadmill","Jogging_Treadmill"],
    "walk-wave-machine":["Stairmaster"],
};
/* id clip 3D theo bài chuẩn (core) trong index.json */
const FK_EX3D_CORE = { latpulldown:"cable-bar-lateral-pulldown-wide-shoulder-grip", cablefly:"cable-standing-fly-crossover-fly", tricepsdown:"cable-triceps-pushdown",
  squat:"classic-barbell-squat", bicepcurl:"dumbbell-biceps-curl", inclinedb:"dumbbell-incline-bench-press", lateralraise:"dumbbell-lateral-raise",
  lunges:"dumbbell-lunge", legcurl:"lever-lying-leg-curl", legpress:"sled-45-degree-leg-wide-press", running:"treadmill-running" };
/* Bài chuẩn → id free-exercise-db ĐÚNG động tác (null = không có bài khớp chặt → ô trung tính).
   noE3: clip 3D có liệt kê id nhưng khác tư thế/dụng cụ của bài chuẩn → không dùng khung 3D. */
const FK_THUMB_EXDB = {
  benchpress:"Barbell_Bench_Press_-_Medium_Grip", inclinedb:"Incline_Dumbbell_Press", pushup:"Pushups", cablefly:"Cable_Crossover",
  pullup:"Pullups", bentoverrow:"Bent_Over_Barbell_Row", latpulldown:"Wide-Grip_Lat_Pulldown", deadlift:"Barbell_Deadlift",
  overheadpress:"Standing_Military_Press", lateralraise:"Side_Lateral_Raise", facepull:"Face_Pull", squat:"Barbell_Squat",
  legpress:"Leg_Press", lunges:"Dumbbell_Lunges", legcurl:"Lying_Leg_Curls", calfraise:"Standing_Calf_Raises",
  bicepcurl:"Dumbbell_Bicep_Curl", hammercurl:"Hammer_Curls", tricepdip:"Dips_-_Triceps_Version", tricepsdown:"Triceps_Pushdown",
  plank:"Plank", hangingleg:"Hanging_Leg_Raise", russiantwist:"Russian_Twist", crunch:"Crunches", running:"Running_Treadmill",
  jumprope:"Rope_Jumping", rowing:"Rowing_Stationary", burpee:null,
  hipthrust:"Barbell_Hip_Thrust", glutebridge:"Butt_Lift_Bridge", rdl:"Romanian_Deadlift", gobletsquat:"Goblet_Squat",
  stepup:"Dumbbell_Step_Ups", legext:"Leg_Extensions", cablerow:"Seated_Cable_Rows", dbrow:"One-Arm_Dumbbell_Row",
  dbpress:"Dumbbell_Shoulder_Press", dbbench:"Dumbbell_Bench_Press", machinepress:"Machine_Bench_Press", kickback:"Glute_Kickback",
  abduction:"Thigh_Abductor", bwsquat:"Bodyweight_Squat", inclinepushup:"Incline_Push-Up", invertedrow:"Inverted_Row",
  deadbug:"Dead_Bug", sideplank:"Side_Bridge", mountainclimber:"Mountain_Climbers", walking:null, kbswing:null,
  woodchop:"Standing_Cable_Wood_Chop", skullcrusher:"EZ-Bar_Skullcrusher", frontsquat:"Front_Barbell_Squat",
  pullover:"Bent-Arm_Dumbbell_Pullover", stretch:null, bulgarian:null, hacksquat:"Hack_Squat", smithsquat:"Smith_Machine_Squat",
  csrow:"Dumbbell_Incline_Row", cablelateral:"Standing_Low-Pulley_Deltoid_Raise", ohtriext:"Cable_Rope_Overhead_Triceps_Extension",
  preacher:"Preacher_Curl", sledpush:"Sled_Push", wallball:null, farmercarry:"Farmers_Walk", inclinewalk:"Walking_Treadmill",
  zone2:null, intervalwalk:null, pecdeck:"Butterfly",
};
const FK_THUMB_NOE3 = { machinepress:1 };   // máy đẩy ngực NGỒI ≠ clip 3D "lever lying chest press" (nằm)

/* Biểu tượng dụng cụ (SVG nét, viewBox 24) + sắc độ nền theo nhóm cơ */
const FK_THUMB_ICONS = {
  barbell:"M2 12h20M5 8.5v7M7.5 6.5v11M19 8.5v7M16.5 6.5v11",
  dumbbell:"M8 12h8M4.5 9.5v5M7 7.5v9M19.5 9.5v5M17 7.5v9",
  kettlebell:"M9.3 9.2V7.6a2.7 2.7 0 0 1 5.4 0v1.6M12 9.3a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2z",
  machine:"M5 21V3h14v18M3.5 21h17M9 7h6v3H9zM9 12h6v3H9zM12 3v4",
  cable:"M12 3.5v1.5M12 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 9v7.5M8.5 16.5h7M9.5 16.5v3.5M14.5 16.5v3.5",
  band:"M4 8c4-4 12-4 16 0M4 16c4 4 12 4 16 0M4 8v8M20 8v8",
  body:"M3 13h13.5M3 17.5h13.5M16.5 13a2.25 2.25 0 1 1 0 4.5M3 13v4.5",
  cardio:"M20.8 8.6a4.8 4.8 0 0 0-8.8-2.7 4.8 4.8 0 0 0-8.8 2.7c0 5 8.8 10.4 8.8 10.4s8.8-5.4 8.8-10.4zM3.5 12.5h4.5l2-3 3 6 2-3h5",
  stretch:"M4 18c4-10 12-10 16 0M8 14.5c2-3 6-3 8 0M12 4v4.5",
  other:"M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5l-5.3 2.9 1.2-6-4.5-4.1 6-.7z",
};
const FK_THUMB_KIND_HUE = { barbell:205, dumbbell:172, kettlebell:28, machine:228, cable:262, band:315, body:145, cardio:352, stretch:95, other:190 };
const FK_THUMB_GROUP_HUE = [
  [/ngực|chest/i,205], [/lưng|xô|lats|back|traps/i,228], [/vai|shoulder/i,262], [/tay trước|biceps/i,285], [/tay sau|triceps/i,300],
  [/cẳng tay|forearm/i,315], [/bụng|abdominal/i,28], [/đùi sau|hamstring/i,150], [/mông|glute|abductor|adductor/i,330],
  [/bắp chân|calves/i,120], [/chân|đùi|quadriceps/i,172], [/tim mạch|cardio/i,352], [/giãn cơ|stretch/i,95], [/toàn thân/i,45],
];

function fkThumbKind(equip, muscle, category){
  const e = String(equip || "").toLowerCase(), m = String(muscle || "").toLowerCase(), c = String(category || "").toLowerCase();
  if(/giãn cơ/.test(m) || c === "stretching") return "stretch";
  if(/^tim mạch/.test(m) || c === "cardio") return "cardio";
  if(/tạ ấm|kettlebell/.test(e)) return "kettlebell";
  if(/thanh đòn|tạ đòn|đòn ez|barbell|e-z/.test(e)) return "barbell";
  if(/tạ đơn|dumbbell/.test(e)) return "dumbbell";
  if(/cáp|cable/.test(e)) return "cable";
  if(/máy|machine|smith/.test(e)) return "machine";
  if(/dây kháng|band/.test(e)) return "band";
  if(/cơ thể|body|^không|xà|ghế|bàn|thảm/.test(e)) return "body";
  return "other";
}
function fkThumbHue(muscle, kind){
  const m = String(muscle || "");
  const g = FK_THUMB_GROUP_HUE.find(([re])=> re.test(m));
  return g ? g[1] : (FK_THUMB_KIND_HUE[kind] || 190);
}
/* Chữ viết tắt từ tên tiếng Anh: "Bulgarian Split Squat" → BSS; 1 từ → 3 chữ đầu */
function fkThumbAbbr(nameStr){
  const s = String(nameStr || "");
  const m = s.match(/\(([^()]*)\)\s*$/);
  const en = (m ? m[1] : s).replace(/[^A-Za-z0-9 ]+/g, " ").trim();
  const w = en.split(/\s+/).filter(x=> x && !/^(the|a|of|on|with|and|to)$/i.test(x));
  if(!w.length) return "";
  if(w.length === 1) return w[0].slice(0, 3).toUpperCase();
  return w.slice(0, 3).map(x=> /^\d/.test(x) ? x[0] : x[0].toUpperCase()).join("");
}
let _fkE3ById = null;
function fkThumbE3Maps(){
  if(_fkE3ById) return _fkE3ById;
  const any = {}, primary = {};
  Object.keys(FK_EX3D_SLUGS).forEach(slug=>{ (FK_EX3D_SLUGS[slug] || []).forEach((id, i)=>{ if(!any[id]) any[id] = slug; if(i === 0 && !primary[id]) primary[id] = slug; }); });
  return (_fkE3ById = { any, primary });
}
function fkThumbE3Url(slug){ return slug ? FK_THUMB_E3_BASE + slug + ".jpg" : ""; }
function fkThumbExdbUrl(id, i){ return id ? EXDB_IMG_BASE + id + "/" + (i || 0) + ".jpg" : ""; }
function fkThumbNeutral(meta){
  const kind = fkThumbKind(meta && meta.equipment, meta && meta.muscle, meta && meta.category);
  return { kind:"neutral", src: FK_THUMB_NEUTRAL_DIR + kind + ".svg", equip: kind, hue: fkThumbHue(meta && meta.muscle, kind), abbr: fkThumbAbbr(meta && meta.name) };
}
/** Bài chuẩn (khoá EXERCISES) → { kind:'ex3d'|'exdb'|'neutral', src, ref } */
function fkThumbForKey(key){
  const k = String(key || "");
  const E = (typeof EXERCISES !== "undefined" && EXERCISES) ? EXERCISES : {};
  const meta = E[k] || {};
  const id = FK_THUMB_EXDB[k] || "";
  const maps = fkThumbE3Maps();
  const slug = FK_THUMB_NOE3[k] ? "" : (FK_EX3D_CORE[k] || (id && maps.any[id]) || "");
  if(slug && FK_EX3D_SLUGS[slug]) return { kind:"ex3d", src: fkThumbE3Url(slug), ref: slug, exdb: id };
  if(id) return { kind:"exdb", src: fkThumbExdbUrl(id, 0), ref: id, exdb: id };
  return Object.assign(fkThumbNeutral(meta), { ref: k });
}
/* id free-exercise-db đã có bài chuẩn "nhận" (để bài exdb cùng id không lặp lại đúng ảnh đó) */
let _fkClaim = null;
function fkThumbClaims(){
  if(_fkClaim) return _fkClaim;
  const exdb = {}, e3 = {};
  Object.keys(FK_THUMB_EXDB).forEach(k=>{ const t = fkThumbForKey(k); if(t.kind === "exdb") exdb[t.ref] = k; if(t.kind === "ex3d") e3[t.ref] = k; });
  return (_fkClaim = { exdb, e3 });
}
/** Bài free-exercise-db (object có id/images, hoặc chỉ id) → ảnh đúng bài */
function fkThumbForExdb(ex){
  const id = String(ex && typeof ex === "object" ? ex.id || "" : ex || "");
  if(!id) return fkThumbNeutral(ex && typeof ex === "object" ? { name: ex.name, equipment: ex.equipment, muscle: (ex.primaryMuscles || []).join(" "), category: ex.category } : {});
  const cl = fkThumbClaims();
  const slug = fkThumbE3Maps().primary[id];
  if(slug && !cl.e3[slug]) return { kind:"ex3d", src: fkThumbE3Url(slug), ref: slug, exdb: id };
  const imgs = ex && typeof ex === "object" && Array.isArray(ex.images) ? ex.images : null;
  /* bài chuẩn đã dùng ảnh 0 của chính id này → bài exdb trùng id hiện ảnh 1 (tư thế kết thúc) cho khỏi trùng hệt */
  const i = cl.exdb[id] && (!imgs || imgs.length > 1) ? 1 : 0;
  const src = imgs ? (imgs[i] ? EXDB_IMG_BASE + imgs[i] : (imgs[0] ? EXDB_IMG_BASE + imgs[0] : "")) : fkThumbExdbUrl(id, i);
  if(src) return { kind:"exdb", src, ref: id + "#" + i, exdb: id };
  return fkThumbNeutral({ name: ex.name, equipment: ex.equipment, muscle: (ex.primaryMuscles || []).join(" "), category: ex.category });
}
/** Mục giáo án / buổi tập ({ exerciseId } hoặc { custom }) */
function fkThumbForItem(item){
  if(!item) return fkThumbNeutral({});
  if(!item.custom && item.exerciseId) return fkThumbForKey(item.exerciseId);
  const c = item.custom || {};
  if(c.exDbId) return fkThumbForExdb(String(c.exDbId));
  const u = String(c.img || "");
  if(u && !/images\.pexels\.com|\/media\/people-ai\//.test(u)) return { kind:"custom", src: u, ref: "custom" };   // ảnh PT/người dùng tự gắn
  return fkThumbNeutral({ name: c.name, equipment: c.equipment, muscle: c.muscle });
}
/** Mục thư viện (library.js: src fitkit | exdb) */
function fkThumbForLib(x){
  if(!x) return fkThumbNeutral({});
  if(x.src === "fitkit" && x.id && typeof EXERCISES !== "undefined" && EXERCISES[x.id]) return fkThumbForKey(x.id);
  if(x.src === "exdb") return fkThumbForExdb(x.ex || x.exDbId || "");
  return x.img ? { kind:"custom", src: x.img, ref: "custom" } : fkThumbNeutral(x);
}
/** Ảnh "chính xác" (3D / exdb / ảnh tự gắn) cho chỗ đang ưu tiên item.stock.thumb — trả "" nếu chỉ có ô trung tính */
function fkThumbExactSrc(item){ const t = fkThumbForItem(item); return t.kind === "neutral" ? "" : t.src; }
function fkThumbEsc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, ch=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch]); }
function fkThumbInjectCss(){
  try{
    if(typeof document === "undefined" || !document.head || document.getElementById("fk-thumb-css")) return;
    const st = document.createElement("style"); st.id = "fk-thumb-css";
    st.textContent = ".fk-thn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;overflow:hidden;color:#fff;"
      + "background:linear-gradient(135deg,hsl(var(--h,190) 42% 32%),hsl(var(--h,190) 48% 16%));"
      + "background:linear-gradient(135deg,color-mix(in srgb,var(--primary,#02A69E) 30%,hsl(var(--h,190) 42% 30%)),hsl(var(--h,190) 48% 15%))}"
      + ".fk-thn svg{width:46%;height:46%;max-width:72px;max-height:72px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}"
      + ".fk-thn b{font:700 10px/1 Inter,system-ui,sans-serif;letter-spacing:.06em;opacity:.92}"
      + ".thumb-wrap>.fk-thn{width:100%;height:100%}.fk-thn.lg{border-radius:16px;margin-bottom:12px}.fk-thn.lg b{font-size:14px}";
    document.head.appendChild(st);
  }catch(e){}
}
/** HTML ô ảnh: ảnh thật → <img>; trung tính → ô SVG (icon dụng cụ + chữ viết tắt).
    o: { cls, w, h, style, alt, lazy } — chuỗi do app tạo, mọi giá trị đều được thoát. */
function fkThumbHTML(t, o){
  o = o || {}; t = t || fkThumbNeutral({});
  const cls = fkThumbEsc(o.cls || "");
  const alt = fkThumbEsc(o.alt || "");
  if(t.kind !== "neutral" && t.src){
    const size = o.w ? ` width="${Number(o.w) || 56}" height="${Number(o.h || o.w) || 56}"` : "";
    return `<img${cls ? ` class="${cls}"` : ""} src="${fkThumbEsc(t.src)}" data-thumb-src="${fkThumbEsc(t.kind)}"${size} alt="${alt}"${o.lazy === false ? "" : ` loading="lazy" decoding="async"`}${o.style ? ` style="${fkThumbEsc(o.style)}"` : ""} onerror="this.style.visibility='hidden'">`;
  }
  fkThumbInjectCss();
  const path = FK_THUMB_ICONS[t.equip] || FK_THUMB_ICONS.other;
  return `<div class="${cls ? cls + " " : ""}fk-thn" data-thumb-src="neutral" data-equip="${fkThumbEsc(t.equip || "other")}" role="img" aria-label="${alt || "Minh hoạ dụng cụ"}" style="--h:${Number(t.hue) || 190};${o.style ? fkThumbEsc(o.style) : ""}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>${t.abbr ? `<b>${fkThumbEsc(t.abbr)}</b>` : ""}</div>`;
}
/* Gắn ảnh đúng bài vào EXERCISES[*].img (mọi màn đang đọc meta.img: chi tiết bài, màn tập, PT, Trợ lý AI…).
   Giữ ảnh cũ ở _groupImg. Chạy lại khi trang nạp xong (phòng module thêm bài muộn). */
function fkThumbApplyAll(){
  try{
    if(typeof EXERCISES === "undefined" || !EXERCISES) return 0;
    let n = 0;
    Object.keys(EXERCISES).forEach(k=>{
      const e = EXERCISES[k]; if(!e || typeof e !== "object") return;
      if(/\/media\/exercise-ai\//.test(String(e.img || ""))) return;   // exercise-art.js (đang tắt) đã gắn ảnh minh hoạ đã duyệt → giữ
      const t = fkThumbForKey(k);
      if(!("_groupImg" in e)) e._groupImg = e.img;
      if(e.img !== t.src){ e.img = t.src; n++; }
      e.thumbKind = t.kind;
    });
    return n;
  }catch(e){ return 0; }
}
fkThumbApplyAll();
try{ if(typeof document !== "undefined" && document.addEventListener) document.addEventListener("DOMContentLoaded", fkThumbApplyAll); }catch(e){}
try{
  const W = typeof window !== "undefined" ? window : globalThis;
  W.fkThumb = { forKey: fkThumbForKey, forExdb: fkThumbForExdb, forItem: fkThumbForItem, forLib: fkThumbForLib, exact: fkThumbExactSrc,
    html: fkThumbHTML, neutral: fkThumbNeutral, kindOf: fkThumbKind, abbr: fkThumbAbbr, apply: fkThumbApplyAll,
    ICONS: FK_THUMB_ICONS, KIND_HUE: FK_THUMB_KIND_HUE, EX3D: FK_EX3D_SLUGS, EX3D_CORE: FK_EX3D_CORE, MAP: FK_THUMB_EXDB, NOE3: FK_THUMB_NOE3,
    E3_BASE: FK_THUMB_E3_BASE, NEUTRAL_DIR: FK_THUMB_NEUTRAL_DIR };
}catch(e){}

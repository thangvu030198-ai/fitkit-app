/* =========================================================================
   FIT KIT — Thư viện 800+ bài tập (free-exercise-db, giấy phép Unlicense /
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
    for(const url of ["vendor/exercises.json", EXDB_REMOTE]){
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
  const renderList = (all)=>{
    const ql = q.trim().toLowerCase();
    const rows = all.filter(ex=> exdbMatches(ex, filter) && (!ql || ex.name.toLowerCase().includes(ql))).slice(0, 80);
    $("#exdb-list").innerHTML = rows.map(ex=>{
      const sel = picked.some(p=>p.exDbId===ex.id);
      return `<div class="list-item" data-exdb="${ex.id}" style="cursor:pointer;${sel?'border-color:var(--primary);':''}">
        <img class="thumb" src="${exdbImg(ex)}" loading="lazy" style="object-fit:cover;background:#fff;" onerror="this.style.visibility='hidden'">
        <div class="info"><div class="name">${escapeHtml(ex.name)}</div><div class="meta">${exdbMuscleVi(ex)} · ${EXDB_EQUIP_VI[ex.equipment]||ex.equipment||"—"} · ${EXDB_LEVEL_VI[ex.level]||""}</div></div>
        <span class="material-symbols-rounded" data-exdb-info="${ex.id}" style="color:var(--text-dim);padding:6px;">info</span>
        <span class="material-symbols-rounded" style="color:${sel?'var(--primary)':'var(--text-dim)'};">${sel?'check_circle':'add_circle'}</span>
      </div>`;
    }).join("") || `<p class="empty-hint">Không tìm thấy bài phù hợp.</p>`;
    $$("[data-exdb-info]").forEach(el=> el.addEventListener("click", (e)=>{
      e.stopPropagation();
      const ex = all.find(x=>x.id===el.dataset.exdbInfo);
      openExDbDetail(ex, ()=> openExDbPicker(onPick, Object.assign({}, opts, { _picked: picked, _filter: filter, _q: q })));
    }));
    $$("[data-exdb]").forEach(el=> el.addEventListener("click", ()=>{
      const ex = all.find(x=>x.id===el.dataset.exdb);
      const item = exdbToItem(ex);
      if(!opts.multi){ closeSheet(); onPick(item); return; }
      const i = picked.findIndex(p=>p.exDbId===ex.id);
      if(i>=0) picked.splice(i,1); else picked.push(item);
      $("#exdb-done").textContent = `Thêm ${picked.length} bài đã chọn`;
      renderList(all);
    }));
  };
  exdbLoad().then(all=>{
    renderList(all);
    $("#exdb-q").addEventListener("input", e=>{ q = e.target.value; renderList(all); });
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
    <div class="sheet-header"><h3 style="font-size:18px;">${escapeHtml(ex.name)}</h3><button class="icon-btn" id="exdb-back"><span class="material-symbols-rounded">arrow_back</span></button></div>
    <img id="exdb-anim" src="${exdbImg(ex,0)}" style="width:100%;max-height:34vh;object-fit:contain;background:#fff;border-radius:14px;">
    <div class="chip-row" style="margin:10px 0;">
      <span class="pill">${exdbMuscleVi(ex)}</span>
      <span class="pill">${EXDB_EQUIP_VI[ex.equipment]||ex.equipment||"—"}</span>
      <span class="pill">${EXDB_LEVEL_VI[ex.level]||ex.level||""}</span>
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

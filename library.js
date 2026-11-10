/* =========================================================================
   FIT KIT — Thư viện bài tập theo nhóm cơ
   Gộp: 28 bài chuẩn FIT KIT (tiếng Việt, data.js) + 800+ bài free-exercise-db
   (Public Domain, có ảnh minh hoạ). Chia 14 nhóm, lọc dụng cụ / cấp độ, tìm kiếm,
   xem chi tiết + video Pixabay, thêm thẳng vào giáo án theo ngày.
   Nạp SAU exdb.js, video.js, app.js.
   ========================================================================= */

const MUSCLE_GROUPS_UI = [
  { id:"chest",     label:"Ngực",         icon:"fitness_center", ex:["chest"],                                  vi:["Ngực"] },
  { id:"back",      label:"Lưng",         icon:"fitness_center", ex:["lats","middle back","lower back"],        vi:["Lưng"] },
  { id:"shoulders", label:"Vai & cầu vai",icon:"fitness_center", ex:["shoulders","traps","neck"],               vi:["Vai"] },
  { id:"biceps",    label:"Tay trước",    icon:"fitness_center", ex:["biceps"],                                 vi:["Tay trước"] },
  { id:"triceps",   label:"Tay sau",      icon:"fitness_center", ex:["triceps"],                                vi:["Tay sau"] },
  { id:"forearms",  label:"Cẳng tay",     icon:"fitness_center", ex:["forearms"],                               vi:[] },
  { id:"abs",       label:"Bụng",         icon:"fitness_center", ex:["abdominals"],                             vi:["Bụng"] },
  { id:"quads",     label:"Đùi trước",    icon:"fitness_center", ex:["quadriceps"],                             vi:["Chân"] },
  { id:"hams",      label:"Đùi sau",      icon:"fitness_center", ex:["hamstrings"],                             vi:[] },
  { id:"glutes",    label:"Mông & hông",  icon:"fitness_center", ex:["glutes","abductors","adductors"],         vi:[] },
  { id:"calves",    label:"Bắp chân",     icon:"fitness_center", ex:["calves"],                                 vi:[] },
  { id:"full",      label:"Toàn thân",    icon:"bolt",           cat:["plyometrics","strongman","olympic weightlifting"], vi:["Toàn thân"] },
  { id:"cardio",    label:"Cardio",       icon:"directions_run", cat:["cardio"],                                vi:["Tim mạch"] },
  { id:"stretch",   label:"Giãn cơ",      icon:"self_improvement", cat:["stretching"],                          vi:[] },
];
const EQUIP_FILTERS = [
  { id:"all", label:"Mọi dụng cụ" }, { id:"body only", label:"Không dụng cụ" }, { id:"dumbbell", label:"Tạ đơn" },
  { id:"barbell", label:"Tạ đòn" }, { id:"machine", label:"Máy" }, { id:"cable", label:"Cáp" },
  { id:"kettlebells", label:"Tạ ấm" }, { id:"bands", label:"Dây kháng lực" },
];
const LEVEL_FILTERS = [ { id:"all", label:"Mọi cấp độ" }, { id:"beginner", label:"Mới tập" }, { id:"intermediate", label:"Trung bình" }, { id:"expert", label:"Nâng cao" } ];

/* Gợi ý tên tiếng Việt cho bài tiếng Anh (động tác · dụng cụ) */
const EN_ACTION_VI = [
  [/bench press/i,"Đẩy ngực"], [/push-?ups?/i,"Chống đẩy"], [/pull-?ups?|chin-?ups?/i,"Kéo xà"], [/pulldown/i,"Kéo xô xuống"],
  [/deadlift/i,"Deadlift"], [/squat/i,"Squat / Gánh"], [/lunge/i,"Lunge / Chùng chân"], [/leg press/i,"Đạp đùi"],
  [/leg curl|hamstring curl/i,"Cuốn đùi sau"], [/leg extension/i,"Duỗi đùi trước"], [/calf raise|calf press/i,"Nhón bắp chân"],
  [/hip thrust|glute bridge|bridge/i,"Đẩy hông / Cầu mông"], [/curl/i,"Cuốn tay"], [/kickback/i,"Đá tay sau"],
  [/extension/i,"Duỗi"], [/pushdown/i,"Ép cáp xuống"], [/dip/i,"Nhún xà"], [/shrug/i,"Nhún vai"],
  [/lateral raise|side raise/i,"Nâng vai bên"], [/front raise/i,"Nâng vai trước"], [/rear delt|reverse fly/i,"Vai sau"],
  [/press/i,"Đẩy"], [/fly|flye/i,"Ép"], [/row/i,"Kéo / Chèo"], [/raise/i,"Nâng"], [/crunch|sit-?up/i,"Gập bụng"],
  [/plank/i,"Plank"], [/twist/i,"Xoay người"], [/stretch/i,"Giãn cơ"], [/jump|hop|bound/i,"Bật nhảy"],
  [/run|sprint|jog/i,"Chạy"], [/bike|cycling/i,"Đạp xe"], [/rope/i,"Nhảy dây / Dây"], [/carry|walk/i,"Mang vác / Đi bộ"],
  [/clean|snatch|jerk/i,"Cử tạ"], [/swing/i,"Vung tạ"], [/rollout/i,"Lăn bụng"], [/good morning/i,"Gập hông"],
];
function viHint(ex){
  const a = EN_ACTION_VI.find(([re])=> re.test(ex.name));
  const eq = EXDB_EQUIP_VI[ex.equipment] || "";
  return [a ? a[1] : null, eq].filter(Boolean).join(" · ");
}

/* Gom dữ liệu thành 1 danh sách thống nhất */
let _libAll = null;
function libBuiltinItems(){
  return Object.entries(EXERCISES).map(([id, e])=>({
    key:"fk:"+id, src:"fitkit", id, name:e.name, sub:`${e.muscle} · ${e.equipment}`, muscleVi:e.muscle,
    equip:/tạ đơn/i.test(e.equipment)?"dumbbell":/đòn/i.test(e.equipment)?"barbell":/cáp/i.test(e.equipment)?"cable":/máy/i.test(e.equipment)?"machine":/cơ thể|không/i.test(e.equipment)?"body only":"other",
    level:"beginner", img:e.img, guide:e.guide, sets:e.sets, reps:e.reps, restSec:e.restSec,
    groups: MUSCLE_GROUPS_UI.filter(g=> (g.vi||[]).some(v=> e.muscle.split("/").map(s=>s.trim()).includes(v))).map(g=>g.id),
  }));
}
function libExdbItem(ex){
  const it = exdbToItem(ex);
  return {
    key:"db:"+ex.id, src:"exdb", ex, name:ex.name, sub:[viHint(ex), exdbMuscleVi(ex)].filter(Boolean).join(" · "), muscleVi:exdbMuscleVi(ex),
    equip:ex.equipment||"other", level:ex.level||"beginner", img:exdbImg(ex,0), guide:it.guide, sets:it.sets, reps:it.reps, restSec:it.restSec,
    groups: MUSCLE_GROUPS_UI.filter(g=> (g.cat && g.cat.includes(ex.category)) || (g.ex && !["cardio","stretching"].includes(ex.category) && (ex.primaryMuscles||[]).some(m=>g.ex.includes(m)))).map(g=>g.id),
  };
}
async function libLoad(){
  if(_libAll) return _libAll;
  let db = [];
  try{ db = (await exdbLoad()).map(libExdbItem); }catch(e){ db = []; }
  _libAll = { builtin: libBuiltinItems(), db, dbOk: db.length > 0 };
  return _libAll;
}
function libItems(groupId){
  const L = _libAll || { builtin: libBuiltinItems(), db: [] };
  const all = [...L.builtin, ...L.db];
  return groupId ? all.filter(x=> x.groups.includes(groupId)) : all;
}

/* ---------------------------------------------------------------------
   MÀN HÌNH
   --------------------------------------------------------------------- */
let exLib = { group:null, q:"", equip:"all", level:"all", limit:40 };

(function mountExLib(){
  const anchor = $("#screen-library"); if(!anchor || $("#screen-exlib")) return;
  const sec = document.createElement("section");
  sec.id = "screen-exlib"; sec.className = "screen";
  sec.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" id="exlib-back"><span class="material-symbols-rounded">arrow_back</span></button>
      <div class="logo" id="exlib-title">Thư viện bài tập</div>
      <button class="icon-btn" id="exlib-search-btn"><span class="material-symbols-rounded">search</span></button>
    </div>
    <div class="content" id="exlib-content"></div>`;
  anchor.parentNode.insertBefore(sec, anchor);
  $("#exlib-back").addEventListener("click", ()=>{ if(exLib.group || exLib.q){ exLib.group = null; exLib.q = ""; exLib.limit = 40; renderExLib(); } else goto("workout"); });
  $("#exlib-search-btn").addEventListener("click", ()=>{ const i = $("#exlib-q"); if(i){ i.focus(); i.scrollIntoView({ block:"center" }); } });
})();

function openExLib(groupId){ exLib = { group: groupId || null, q:"", equip:"all", level:"all", limit:40 }; goto("exlib"); }

async function renderExLib(){
  const el = $("#exlib-content"); if(!el) return;
  const L = await libLoad();
  const g = MUSCLE_GROUPS_UI.find(x=> x.id===exLib.group);
  $("#exlib-title").textContent = g ? g.label : "Thư viện bài tập";

  const filterBar = `
    <div class="search-box"><span class="material-symbols-rounded" style="color:var(--text-dim);">search</span>
      <input id="exlib-q" value="${escapeHtml(exLib.q)}" placeholder="${g?`Tìm trong nhóm ${g.label.toLowerCase()}…`:"Tìm bài: squat, đẩy ngực, plank…"}"></div>
    <div class="exlib-chips">${EQUIP_FILTERS.map(f=>`<button class="pill ${exLib.equip===f.id?'active':''}" data-eq="${f.id}">${f.label}</button>`).join("")}</div>
    <div class="exlib-chips">${LEVEL_FILTERS.map(f=>`<button class="pill ${exLib.level===f.id?'active':''}" data-lv="${f.id}">${f.label}</button>`).join("")}</div>`;

  const showList = !!(g || exLib.q.trim());
  if(!showList){
    el.innerHTML = `
      <div class="exlib-hero">
        <div class="hero-eyebrow">${L.builtin.length + L.db.length} bài tập · ${MUSCLE_GROUPS_UI.length} nhóm</div>
        <h2 style="font-size:26px;margin-top:4px;">Chọn nhóm cơ<br>muốn tập</h2>
        ${L.dbOk ? "" : `<p class="small-note" style="margin-top:6px;color:var(--coral-2);">Đang offline — mới hiện ${L.builtin.length} bài chuẩn. Có mạng sẽ hiện thêm 800+ bài.</p>`}
      </div>
      ${filterBar}
      <div class="mg-grid">
        ${MUSCLE_GROUPS_UI.map((m,i)=>{
          const items = libItems(m.id).filter(libFilterOk);
          const cover = items.find(x=> x.src==="exdb" && x.img) || items.find(x=>x.img);
          return `<button class="mg-card" data-group="${m.id}" style="--i:${i}">
            ${cover ? `<img src="${escapeHtml(cover.img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
            <span class="mg-shade"></span>
            <span class="mg-ic"><span class="material-symbols-rounded">${m.icon}</span></span>
            <span class="mg-name">${m.label}</span>
            <span class="mg-count">${items.length} bài</span>
          </button>`; }).join("")}
      </div>
      <p class="small-note" style="text-align:center;margin-top:6px;">Bài chuẩn FIT KIT (tiếng Việt) + free-exercise-db (Public Domain). Video minh hoạ từ Pixabay.</p>`;
  } else {
    const q = exLib.q.trim().toLowerCase();
    const list = libItems(exLib.group).filter(libFilterOk).filter(x=> !q || x.name.toLowerCase().includes(q) || x.sub.toLowerCase().includes(q));
    list.sort((a,b)=> (a.src===b.src?0:a.src==="fitkit"?-1:1) || a.name.localeCompare(b.name));
    el.innerHTML = `
      ${filterBar}
      <div class="small-note" style="margin:2px 2px 0;">${list.length} bài${g?` · nhóm ${g.label.toLowerCase()}`:""}${q?` · khớp "${escapeHtml(exLib.q)}"`:""}</div>
      <div class="exlib-list">
        ${list.slice(0, exLib.limit).map(x=>`
          <div class="list-item exlib-row" data-ex="${escapeHtml(x.key)}">
            ${x.img ? `<img class="thumb" src="${escapeHtml(x.img)}" loading="lazy" alt="" onerror="this.style.visibility='hidden'">` : `<div class="thumb ex-num"><span class="material-symbols-rounded">fitness_center</span></div>`}
            <div class="info"><div class="name">${escapeHtml(x.name)}</div><div class="meta">${escapeHtml(x.sub)}</div>
              <div class="exlib-tags">${x.src==="fitkit"?`<span class="tg fk">Bài chuẩn</span>`:""}<span class="tg">${EXDB_LEVEL_VI[x.level]||"Mới tập"}</span></div></div>
            <button class="nu-mini" data-add="${escapeHtml(x.key)}" aria-label="Thêm vào giáo án"><span class="material-symbols-rounded">add</span></button>
          </div>`).join("") || `<p class="empty-hint">Không có bài phù hợp bộ lọc.</p>`}
      </div>
      ${list.length > exLib.limit ? `<button class="btn btn-outline btn-block" id="exlib-more">Xem thêm ${Math.min(40, list.length-exLib.limit)} bài</button>` : ""}`;
    $$("[data-ex]", el).forEach(r=> r.addEventListener("click", e=>{ if(e.target.closest("[data-add]")) return; openLibDetail(r.dataset.ex); }));
    $$("[data-add]", el).forEach(b=> b.addEventListener("click", e=>{ e.stopPropagation(); openAddToPlan(b.dataset.add); }));
    const more = $("#exlib-more"); if(more) more.addEventListener("click", ()=>{ exLib.limit += 40; renderExLib(); });
  }
  const qi = $("#exlib-q");
  let t; qi.addEventListener("input", ()=>{ clearTimeout(t); t = setTimeout(()=>{ exLib.q = qi.value; exLib.limit = 40; const pos = qi.selectionStart; renderExLib().then(()=>{ const n=$("#exlib-q"); if(n){ n.focus(); n.setSelectionRange(pos,pos); } }); }, 250); });
  $$("[data-eq]", el).forEach(b=> b.addEventListener("click", ()=>{ exLib.equip = b.dataset.eq; exLib.limit = 40; renderExLib(); }));
  $$("[data-lv]", el).forEach(b=> b.addEventListener("click", ()=>{ exLib.level = b.dataset.lv; exLib.limit = 40; renderExLib(); }));
  $$("[data-group]", el).forEach(b=> b.addEventListener("click", ()=>{ exLib.group = b.dataset.group; exLib.limit = 40; renderExLib(); $("#app-scroll").scrollTo(0,0); }));
}
function libFilterOk(x){
  if(exLib.equip!=="all" && x.equip!==exLib.equip) return false;
  if(exLib.level!=="all" && x.level!==exLib.level) return false;
  return true;
}
function libFind(key){ return libItems(null).find(x=>x.key===key); }

/* ---- Chi tiết bài ---- */
function openLibDetail(key){
  const x = libFind(key); if(!x) return;
  const imgs = x.src==="exdb" ? (x.ex.images||[]).map((_,i)=>exdbImg(x.ex,i)) : [x.img];
  let frame = 0;
  const vb = videoBlockHTML();
  openSheet(`
    <div class="sheet-header"><h3 style="font-size:18px;">${escapeHtml(x.name)}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    ${vb.html}
    ${imgs[0] ? `<div class="ld-media"><img id="ld-anim" src="${escapeHtml(imgs[0])}" class="ld-img ${x.src==="exdb"?"white":""}" alt=""><span>Ảnh động kỹ thuật</span></div>` : ""}
    <div class="chip-row" style="margin:10px 0;">
      <span class="pill">${escapeHtml(x.muscleVi)}</span><span class="pill">${escapeHtml(EXDB_EQUIP_VI[x.equip]||x.sub.split(" · ").pop())}</span><span class="pill">${EXDB_LEVEL_VI[x.level]||"Mới tập"}</span>
    </div>
    <div class="stat-grid"><div class="stat-box"><div class="num">${x.sets}</div><div class="cap">Hiệp</div></div><div class="stat-box"><div class="num">${escapeHtml(String(x.reps))}</div><div class="cap">Lần</div></div><div class="stat-box"><div class="num">${x.restSec}s</div><div class="cap">Nghỉ</div></div></div>
    <div class="card-title" style="margin-top:14px;font-size:13px;">${x.src==="exdb" ? "Hướng dẫn (tiếng Anh)" : "Hướng dẫn kỹ thuật"}</div>
    ${x.src==="exdb" ? `<ol class="ld-steps">${(x.ex.instructions||[]).map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ol>` : `<p class="small-note" style="line-height:1.6;">${escapeHtml(x.guide)}</p>`}
    <button class="btn btn-primary btn-block" id="ld-add" style="margin-top:14px;"><span class="material-symbols-rounded">add</span>Thêm vào giáo án</button>
  `);
  if(imgs.length > 1){
    const timer = setInterval(()=>{ const im = $("#ld-anim"); if(!im){ clearInterval(timer); return; } frame=(frame+1)%imgs.length; im.src = imgs[frame]; }, 900);
    onSheetCloseHook = ()=> clearInterval(timer);
  }
  $("#ld-add").addEventListener("click", ()=> openAddToPlan(key));
  mountVideoBlock(vb.id, videoQueryFor({ name:x.name, muscle:x.muscleVi }), {});
}

/* ---- Thêm vào giáo án: chọn ngày ---- */
function openAddToPlan(key){
  const x = libFind(key); if(!x) return;
  const plan = getActivePlan();
  openSheet(`
    <div class="sheet-header"><h3>Thêm vào ngày nào?</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="margin-bottom:10px;">"${escapeHtml(x.name)}" → giáo án <b>${escapeHtml(plan.name)}</b></p>
    <div class="atp-grid">${DAY_KEYS.map(k=>{ const d = plan.days[k]; return `
      <button class="atp-day ${k===todayDayKey()?'today':''}" data-day="${k}">
        <b>${DAY_LABELS[k]}</b><small>${escapeHtml(d.title)}</small><i>${d.items.length} bài</i>
      </button>`; }).join("")}</div>
  `);
  $$("[data-day]").forEach(b=> b.addEventListener("click", ()=>{
    const k = b.dataset.day, day = plan.days[k];
    if(x.src==="fitkit") day.items.push({ uid: x.id+"_"+uid(), exerciseId:x.id, custom:null, sets:x.sets, reps:x.reps, restSec:x.restSec, clipId:null });
    else { const it = exdbToItem(x.ex); day.items.push({ uid: uid(), exerciseId:null, custom:{ name:it.name, muscle:it.muscle, equipment:it.equipment, guide:it.guide, img:it.img, exDbId:it.exDbId }, sets:it.sets, reps:it.reps, restSec:it.restSec, clipId:null }); }
    if(day.title==="Chưa đặt tên" || /nghỉ/i.test(day.title)) day.title = x.muscleVi.split(",")[0];
    saveState(); closeSheet(); renderWorkoutScreen();
    toast(`Đã thêm vào ${DAY_LABELS[k]} · ${day.items.length} bài`, "check_circle");
  }));
}

/* =========================================================================
   TapEasy — Thư viện bài tập theo nhóm cơ
   Gộp: 28 bài chuẩn TapEasy (tiếng Việt, data.js) + 800+ bài free-exercise-db
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
  { id:"hams",      label:"Đùi sau",      icon:"fitness_center", ex:["hamstrings"],                             vi:["Đùi sau"] },
  { id:"glutes",    label:"Mông & hông",  icon:"fitness_center", ex:["glutes","abductors","adductors"],         vi:["Mông"] },
  { id:"calves",    label:"Bắp chân",     icon:"fitness_center", ex:["calves"],                                 vi:[] },
  { id:"full",      label:"Toàn thân",    icon:"bolt",           cat:["plyometrics","strongman","olympic weightlifting"], vi:["Toàn thân"] },
  { id:"cardio",    label:"Cardio",       icon:"directions_run", cat:["cardio"],                                vi:["Tim mạch"] },
  { id:"stretch",   label:"Giãn cơ",      icon:"self_improvement", cat:["stretching"],                          vi:["Giãn cơ"] },
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
/* Bỏ bài 800+ trùng với bài chuẩn TapEasy (vd "Đẩy ngực tạ đơn" xuất hiện 2 lần — QA-training §2.9) */
function libFold(s){ return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
function libDedupe(builtin, db){
  const en = new Set(), vi = new Set();
  builtin.forEach(b=>{ const m = String(b.name).match(/^(.*?)\s*\(([^()]*)\)\s*$/); if(m){ vi.add(libFold(m[1])); en.add(libFold(m[2])); } else vi.add(libFold(b.name)); });
  return db.filter(x=>{
    const e = libFold(x.ex && x.ex.name || x.nameEn || x.name);
    const v = libFold(String(x.name).replace(/\s*\([^()]*\)\s*$/, ""));
    return !(en.has(e) || (v && vi.has(v)));
  });
}
/* fkLazy (HANDOFF vòng 2): tên/hướng dẫn tiếng Việt (EXDB_VI, exdb-vi*.js) có thể nạp lười → CHỜ trước khi dựng danh sách:
   await (window.fkLazy ? fkLazy.load('exdbvi') : Promise.resolve()). Dữ liệu đã có sẵn / chưa có fkLazy → xong ngay. */
function libViReady(){
  if(typeof exdbViReady === "function") return exdbViReady();          // exdb.js: nhớ promise, lỗi thì cho thử lại
  const W = typeof window !== "undefined" ? window : globalThis;
  return (W.fkLazy && typeof W.fkLazy.load === "function") ? W.fkLazy.load('exdbvi') : Promise.resolve();
}
let _libLoading = null;
function libLoad(){
  if(_libAll) return Promise.resolve(_libAll);
  if(_libLoading) return _libLoading;
  _libLoading = (async ()=>{
    let raw = [], viErr = null;
    const viP = Promise.resolve().then(libViReady).catch(e=>{ viErr = e || new Error("exdbvi"); });   // song song với tải 800+ bài
    try{ raw = await exdbLoad(); }catch(e){ raw = []; }
    await viP;
    /* map SAU khi bản Việt hoá đã nạp: nếu exdb-vi.js cũng nạp lười, lúc này libExdbItem toàn cục đã được nó bọc (tên Việt) */
    const db = (raw || []).map(x=> libExdbItem(x));
    const builtin = libBuiltinItems();
    _libAll = { builtin, db: libDedupe(builtin, db), dbOk: db.length > 0, viOk: !viErr };
    if(viErr) try{ console.warn("[library] chưa nạp được exdb-vi", viErr); }catch(e){}
    _libGroupCache = {};
    return _libAll;
  })();
  _libLoading.then(()=>{ _libLoading = null; }, ()=>{ _libLoading = null; });
  return _libLoading;
}
/* "Thử lại" khi bản tiếng Việt chưa nạp được: dựng lại danh sách (giữ nhóm / bộ lọc / từ khoá đang chọn) */
function libRetryVi(){ _libAll = null; _libGroupCache = {}; for(const k in _libCountCache) delete _libCountCache[k]; return renderExLib(); }
/* fk-lazy.js phát "fk:lazy:exdbvi" khi nhóm nạp xong (vd lần nạp trước lỗi, sau đó nạp trước lúc rảnh thành công) →
   danh sách đang hiện tên gốc thì tự dựng lại; đang đóng màn thì chỉ bỏ bộ nhớ đệm để lần mở sau dựng lại */
try{ document.addEventListener("fk:lazy:exdbvi", ()=>{
  if(!_libAll || _libAll.viOk !== false) return;
  const sc = document.getElementById("screen-exlib");
  if(sc && sc.classList && sc.classList.contains("active")) libRetryVi(); else { _libAll = null; _libGroupCache = {}; }
}); }catch(e){}
function libViNoteHTML(L){
  if(!L || L.viOk !== false || !L.dbOk) return "";
  return `<div class="small-note exlib-vi-err" role="status" style="margin:6px 2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    <span>Chưa tải được tên tiếng Việt của 800+ bài — đang hiện tên gốc tiếng Anh.</span>
    <button type="button" class="btn btn-outline btn-sm" data-lib-retry>Thử lại</button></div>`;
}
let _libGroupCache = {};
function libItems(groupId){
  const L = _libAll || { builtin: libBuiltinItems(), db: [] };
  const k = (groupId || "*") + (_libAll ? "" : "~");
  if(_libGroupCache[k]) return _libGroupCache[k];
  const all = [...L.builtin, ...L.db];
  const out = groupId ? all.filter(x=> x.groups.includes(groupId)) : all;
  if(_libAll) _libGroupCache[k] = out;
  return out;
}

/* ---------------------------------------------------------------------
   MÀN HÌNH — hiệu năng (QA-training §3: Thư viện > 1 s ở CPU 4×):
   · khung (ô tìm + bộ lọc) dựng 1 lần; lọc / gõ tìm chỉ cập nhật phần thân, giữ nguyên ô nhập (không mất focus)
   · danh sách vẽ lười theo lô 30 bài khi cuộn tới (IntersectionObserver), không dựng lại toàn bộ DOM
   · 1 trình nghe uỷ quyền cho cả màn, ảnh loading="lazy" decoding="async" có kích thước cố định
   · số bài theo nhóm tính 1 lần cho mỗi bộ lọc
   --------------------------------------------------------------------- */
let exLib = { group:null, q:"", equip:"all", level:"all", limit:40 };
const LIB_BATCH = 30;
let _libView = { list:[], shown:0, io:null, token:0 };
const _libCountCache = {};

(function mountExLib(){
  const anchor = $("#screen-library"); if(!anchor || $("#screen-exlib")) return;
  const sec = document.createElement("section");
  sec.id = "screen-exlib"; sec.className = "screen";
  sec.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" id="exlib-back" aria-label="Quay lại"><span class="material-symbols-rounded">arrow_back</span></button>
      <div class="logo" id="exlib-title">Thư viện bài tập</div>
      <button class="icon-btn" id="exlib-search-btn" aria-label="Tìm bài tập"><span class="material-symbols-rounded">search</span></button>
    </div>
    <div class="content" id="exlib-content"></div>`;
  anchor.parentNode.insertBefore(sec, anchor);
  $("#exlib-back").addEventListener("click", ()=>{ if(exLib.group || exLib.q){ exLib.group = null; exLib.q = ""; exLib.limit = 40; const i = $("#exlib-q"); if(i) i.value = ""; renderExLib(); } else goto("workout"); });
  $("#exlib-search-btn").addEventListener("click", ()=>{ const i = $("#exlib-q"); if(i){ i.focus(); i.scrollIntoView({ block:"center" }); } });
  try{
    if(!document.getElementById("exlib-perf-css")){
      const st = document.createElement("style"); st.id = "exlib-perf-css";
      /* Cuộn mượt (QA-training §3 / QA-ux bước 8–10): hàng trong danh sách dài KHÔNG dùng backdrop-filter (đo CPU 4×: 60 hàng
         blur(22px) → 65/173 khung > 34 ms) — dùng kính "đặc" --glass-solid như html.lowfx (DESIGN-SYSTEM §Kính mờ) */
      st.textContent = ".exlib-list .exlib-row{content-visibility:auto;contain-intrinsic-size:auto 76px;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;background:var(--glass-solid,rgba(255,255,255,.08))}"
        + ".mg-grid .mg-card{content-visibility:auto;contain-intrinsic-size:auto 120px}.exlib-sentinel{height:1px}";
      document.head.appendChild(st);
    }
  }catch(e){}
})();

function openExLib(groupId){ exLib = { group: groupId || null, q:"", equip:"all", level:"all", limit:40 }; const i = $("#exlib-q"); if(i) i.value = ""; goto("exlib"); }

function libShellHTML(){
  return `
    <div class="search-box"><span class="material-symbols-rounded" style="color:var(--text-dim);">search</span>
      <input id="exlib-q" value="${escapeHtml(exLib.q)}" placeholder="Tìm bài: squat, đẩy ngực, plank…" autocomplete="off" enterkeyhint="search" aria-label="Tìm bài tập"></div>
    <div class="exlib-chips" role="group" aria-label="Dụng cụ">${EQUIP_FILTERS.map(f=>`<button type="button" class="pill ${exLib.equip===f.id?'active':''}" data-eq="${escapeHtml(f.id)}" aria-pressed="${exLib.equip===f.id}">${escapeHtml(f.label)}</button>`).join("")}</div>
    <div class="exlib-chips" role="group" aria-label="Cấp độ">${LEVEL_FILTERS.map(f=>`<button type="button" class="pill ${exLib.level===f.id?'active':''}" data-lv="${escapeHtml(f.id)}" aria-pressed="${exLib.level===f.id}">${escapeHtml(f.label)}</button>`).join("")}</div>
    <div id="exlib-body"></div>`;
}
function libRowHTMLBase(x){
  return `<div class="list-item exlib-row" data-ex="${escapeHtml(x.key)}">
    ${x.img ? `<img class="thumb" src="${escapeHtml(x.img)}" loading="lazy" decoding="async" width="56" height="56" alt="" onerror="this.style.visibility='hidden'">` : `<div class="thumb ex-num"><span class="material-symbols-rounded">fitness_center</span></div>`}
    <div class="info"><div class="name">${escapeHtml(x.name)}</div><div class="meta">${escapeHtml(x.sub)}</div>
      <div class="exlib-tags">${x.src==="fitkit"?`<span class="tg fk">Bài chuẩn</span>`:""}<span class="tg">${escapeHtml(EXDB_LEVEL_VI[x.level]||"Mới tập")}</span></div></div>
    <button type="button" class="nu-mini" data-add="${escapeHtml(x.key)}" aria-label="Thêm ${escapeHtml(x.name)} vào giáo án"><span class="material-symbols-rounded">add</span></button>
  </div>`;
}
/* Danh sách đã lọc + xếp hạng (tìm có/không dấu nhờ exdb-vi.js nếu có) */
function libQueryList(){
  const base = libItems(exLib.group).filter(libFilterOk);
  const raw = String(exLib.q || "").trim();
  if(!raw){ return base.slice().sort((a,b)=> (a.src===b.src?0:a.src==="fitkit"?-1:1) || a.name.localeCompare(b.name)); }
  try{ if(window.exdbVi && typeof exdbVi.rank === "function" && typeof exdbVi.itemKeyOf === "function") return exdbVi.rank(base, raw, exdbVi.itemKeyOf); }catch(e){}
  const q = raw.toLowerCase();
  return base.filter(x=> x.name.toLowerCase().includes(q) || x.sub.toLowerCase().includes(q))
    .sort((a,b)=> (a.src===b.src?0:a.src==="fitkit"?-1:1) || a.name.localeCompare(b.name));
}
function libGroupStats(){
  const ck = exLib.equip + "|" + exLib.level + "|" + (_libAll ? _libAll.db.length : 0);
  if(_libCountCache[ck]) return _libCountCache[ck];
  const out = {};
  MUSCLE_GROUPS_UI.forEach(m=>{
    const items = libItems(m.id).filter(libFilterOk);
    const cover = items.find(x=> x.src==="exdb" && x.img) || items.find(x=> x.img);
    out[m.id] = { n: items.length, img: cover ? cover.img : "" };
  });
  return (_libCountCache[ck] = out);
}
function libAppendBatch(){
  const box = $("#exlib-listbox"); if(!box) return;
  const v = _libView, from = v.shown, to = Math.min(v.list.length, from + LIB_BATCH);
  if(to <= from) return;
  box.insertAdjacentHTML("beforeend", v.list.slice(from, to).map(x=> (window.exdbVi && exdbVi.rowHTML ? exdbVi.rowHTML(x) : libRowHTMLBase(x))).join(""));
  v.shown = to;
  exLib.limit = Math.max(40, to);
  const more = $("#exlib-more");
  if(more){ if(v.shown >= v.list.length) more.remove(); else more.textContent = `Xem thêm ${Math.min(LIB_BATCH, v.list.length - v.shown)} bài`; }
}
function libRenderBody(L){
  const body = $("#exlib-body"); if(!body) return;
  if(_libView.io){ try{ _libView.io.disconnect(); }catch(e){} _libView.io = null; }
  const g = MUSCLE_GROUPS_UI.find(x=> x.id===exLib.group);
  const showList = !!(g || String(exLib.q||"").trim());
  if(!showList){
    const stats = libGroupStats();
    body.innerHTML = `
      <div class="exlib-hero">
        <div class="hero-eyebrow">${L.builtin.length + L.db.length} bài tập · ${MUSCLE_GROUPS_UI.length} nhóm</div>
        <h2 style="font-size:26px;margin-top:4px;">Chọn nhóm cơ<br>muốn tập</h2>
        ${L.dbOk ? "" : `<p class="small-note" style="margin-top:6px;color:var(--coral-2);">Đang offline — mới hiện ${L.builtin.length} bài chuẩn. Có mạng sẽ hiện thêm 800+ bài.</p>`}
      </div>
      ${libViNoteHTML(L)}
      <div class="mg-grid">
        ${MUSCLE_GROUPS_UI.map((m,i)=>{ const st = stats[m.id] || { n:0, img:"" };
          return `<button type="button" class="mg-card" data-group="${escapeHtml(m.id)}" style="--i:${i}" aria-label="${escapeHtml(m.label)}, ${st.n} bài">
            ${st.img ? `<img src="${escapeHtml(st.img)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
            <span class="mg-shade"></span>
            <span class="mg-ic"><span class="material-symbols-rounded">${escapeHtml(m.icon)}</span></span>
            <span class="mg-name">${escapeHtml(m.label)}</span>
            <span class="mg-count">${st.n} bài</span>
          </button>`; }).join("")}
      </div>
      <p class="small-note" style="text-align:center;margin-top:6px;">Bài chuẩn TapEasy (tiếng Việt) + free-exercise-db (Public Domain). Video minh hoạ từ Pixabay.</p>`;
    return;
  }
  const raw = String(exLib.q||"").trim();
  _libView = { list: libQueryList(), shown: 0, io: null, token: _libView.token + 1 };
  body.innerHTML = `${libViNoteHTML(L)}
    <div class="small-note exlib-count" style="margin:2px 2px 0;">${_libView.list.length} bài${g?` · nhóm ${escapeHtml(g.label.toLowerCase())}`:""}${raw?` · khớp "${escapeHtml(raw)}"`:""}</div>
    <div class="exlib-list" id="exlib-listbox">${_libView.list.length ? "" : `<p class="empty-hint">Không có bài phù hợp. Thử bỏ dấu hoặc dùng tên tiếng Anh (VD: "bench", "curl").</p>`}</div>
    ${_libView.list.length > LIB_BATCH ? `<div class="exlib-sentinel" id="exlib-sentinel"></div><button type="button" class="btn btn-outline btn-block" id="exlib-more">Xem thêm ${Math.min(LIB_BATCH, _libView.list.length - LIB_BATCH)} bài</button>` : ""}`;
  libAppendBatch();
  const sen = $("#exlib-sentinel");
  if(sen && typeof IntersectionObserver === "function"){
    const root = document.getElementById("app-scroll") || null;
    const io = new IntersectionObserver(es=>{ if(es.some(e=> e.isIntersecting)) libAppendBatch(); if(_libView.shown >= _libView.list.length){ try{ io.disconnect(); }catch(e){} } }, { root, rootMargin:"600px 0px" });
    io.observe(sen); _libView.io = io;
  }
}
function libBindOnce(el){
  if(el.dataset.libBound) return; el.dataset.libBound = "1";
  el.addEventListener("click", e=>{
    const t = e.target.closest ? e.target : null; if(!t) return;
    const add = t.closest("[data-add]"); if(add){ e.stopPropagation(); openAddToPlan(add.dataset.add); return; }
    const row = t.closest("[data-ex]"); if(row){ openLibDetail(row.dataset.ex); return; }
    const eq = t.closest("[data-eq]"); if(eq){ exLib.equip = eq.dataset.eq; exLib.limit = 40; libSyncChips(); libRefresh(); return; }
    const lv = t.closest("[data-lv]"); if(lv){ exLib.level = lv.dataset.lv; exLib.limit = 40; libSyncChips(); libRefresh(); return; }
    const gr = t.closest("[data-group]"); if(gr){ exLib.group = gr.dataset.group; exLib.limit = 40; libRefresh(); const sc = $("#app-scroll"); if(sc && sc.scrollTo) sc.scrollTo(0,0); return; }
    if(t.closest("#exlib-more")){ libAppendBatch(); return; }
    if(t.closest("[data-lib-retry]")){ libRetryVi(); return; }
  });
  let tmr;
  el.addEventListener("input", e=>{
    if(!e.target || e.target.id !== "exlib-q") return;
    const v = e.target.value; clearTimeout(tmr);
    tmr = setTimeout(()=>{ exLib.q = v; exLib.limit = 40; libRefresh(); }, 200);
  });
}
function libSyncChips(){
  $$("#exlib-content [data-eq]").forEach(b=>{ const on = b.dataset.eq === exLib.equip; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
  $$("#exlib-content [data-lv]").forEach(b=>{ const on = b.dataset.lv === exLib.level; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
}
function libRefresh(){
  const g = MUSCLE_GROUPS_UI.find(x=> x.id===exLib.group);
  const t = $("#exlib-title"); if(t) t.textContent = g ? g.label : "Thư viện bài tập";
  const qi = $("#exlib-q");
  if(qi){ qi.placeholder = g ? `Tìm trong nhóm ${g.label.toLowerCase()}…` : "Tìm tên Việt/Anh: đẩy ngực, day nguc, squat…"; if(document.activeElement !== qi && qi.value !== exLib.q) qi.value = exLib.q; }
  libRenderBody(_libAll || { builtin: libBuiltinItems(), db: [], dbOk: false });
}
async function renderExLib(){
  const el = $("#exlib-content"); if(!el) return;
  if(!el.querySelector("#exlib-body")){ el.innerHTML = libShellHTML(); }
  libBindOnce(el);
  libSyncChips();
  if(!_libAll){
    const body = $("#exlib-body");
    if(body && !body.childElementCount) body.innerHTML = `<div class="vp-loading" style="padding:28px 0;text-align:center;"><div class="spinner"></div><p class="small-note" style="margin-top:8px;">Đang tải thư viện bài tập…</p></div>`;
    await libLoad();
  }
  libRefresh();
}
function libFilterOk(x){
  if(exLib.equip!=="all" && x.equip!==exLib.equip) return false;
  if(exLib.level!=="all" && x.level!==exLib.level) return false;
  return true;
}
function libFind(key){ return libItems(null).find(x=>x.key===key); }


/* ---- Chi tiết bài: 3 tab Hướng dẫn · Phân tích · Lịch sử (18/11/2026) ----
   Hướng dẫn: nhóm cơ chính/phụ, hiệp–lần–nghỉ, kỹ thuật chia "Chuẩn bị / Khi thực hiện / Hít thở".
   Phân tích + Lịch sử: đọc state.setHist của chính người dùng (1RM ước tính Epley, tạ nặng nhất, biểu đồ, các buổi). */
function libHistKey(x){ return x.src === "fitkit" ? x.id : "c:" + x.name; }
function libHist(x){
  const h = (state.setHist || {})[libHistKey(x)];
  return (h && Array.isArray(h.list) ? h.list : []).filter(r=> r && typeof r === "object")
    .map(r=> ({ date: String(r.date || ""), sets: Array.isArray(r.sets) ? r.sets : [], vol: Number(r.vol) || 0, e1rm: Number(r.e1rm) || 0, top: Number(r.top) || 0 }));
}
function libMuscleSplit(x){
  let w = {};
  try{ if(window.FKTP && FKTP.muscleWeights) w = FKTP.muscleWeights(x.src === "fitkit" ? x.id : "", x.muscleVi) || {}; }catch(e){ w = {}; }
  const main = [], side = [];
  Object.keys(w).forEach(g=> (w[g] >= 1 ? main : side).push(g));
  if(!main.length && !side.length && x.muscleVi) main.push(x.muscleVi);
  return { main, side };
}
/** câu hướng dẫn → 3 phần; câu đầu là tư thế chuẩn bị, phần còn lại là khi thực hiện */
function libGuideParts(x){
  const timed = typeof isTimedReps === "function" ? isTimedReps(x.reps) : /giây|phút/.test(String(x.reps||""));
  const sentences = String(x.guide || "").split(/(?<=[.!?])\s+/).map(t=> t.trim()).filter(Boolean);
  const prep = sentences.length > 1 ? sentences[0] : "";
  const doIt = sentences.length > 1 ? sentences.slice(1).join(" ") : (sentences[0] || "");
  const breath = timed ? "Thở đều, sâu bằng mũi — không nín thở trong lúc giữ tư thế."
    : "Thở ra ở pha gắng sức (lúc đẩy, kéo hoặc nâng tạ), hít vào ở pha hạ về có kiểm soát. Không nín thở kéo dài.";
  return { prep, doIt, breath };
}
function libDetailTabsHTML(x, key){
  const ms = libMuscleSplit(x), H = libHist(x), exdb = x.src === "exdb";
  const best = H.reduce((a,r)=> r.e1rm > a ? r.e1rm : a, 0), heaviest = H.reduce((a,r)=> Math.max(a, r.top), 0);
  const last = H[H.length-1], first = H[0];
  const trend = H.length >= 2 && first.e1rm > 0 ? Math.round((last.e1rm - first.e1rm) / first.e1rm * 100) : null;
  const G = libGuideParts(x);
  const kg = (n)=> typeof fmtKg === "function" ? fmtKg(n) : String(n);
  const guide = `
    <div class="ld-mg">${ms.main.map(g=> `<span class="ld-mg-chip main"><i></i>${escapeHtml(g)}<small>Chính</small></span>`).join("")}${ms.side.map(g=> `<span class="ld-mg-chip"><i></i>${escapeHtml(g)}<small>Phụ</small></span>`).join("")}</div>
    <div class="chip-row" style="margin:10px 0;"><span class="pill">${escapeHtml(EXDB_EQUIP_VI[x.equip]||x.sub.split(" · ").pop())}</span><span class="pill">${escapeHtml(EXDB_LEVEL_VI[x.level]||"Mới tập")}</span></div>
    <div class="stat-grid"><div class="stat-box"><div class="num">${escapeHtml(String(x.sets))}</div><div class="cap">Hiệp</div></div><div class="stat-box"><div class="num">${escapeHtml(String(x.reps))}</div><div class="cap">Lần</div></div><div class="stat-box"><div class="num">${escapeHtml(String(x.restSec))}s</div><div class="cap">Nghỉ</div></div></div>
    ${exdb ? `<div class="card-title" style="margin-top:14px;font-size:13px;">Hướng dẫn (tiếng Anh)</div><ol class="ld-steps">${(x.ex.instructions||[]).map(t=>`<li>${escapeHtml(t)}</li>`).join("")}</ol>`
      : `<div class="ld-guide">
        ${G.prep ? `<div><h5>Tư thế chuẩn bị</h5><p>${escapeHtml(G.prep)}</p></div>` : ""}
        <div><h5>Khi thực hiện</h5><p>${escapeHtml(G.doIt || "Chưa có hướng dẫn chi tiết.")}</p></div>
        <div><h5>Hít thở</h5><p>${escapeHtml(G.breath)}</p></div>
      </div>`}
    ${typeof FKYT === "object" && FKYT && FKYT.button ? `<div style="margin-top:12px;">${FKYT.button(x.name)}</div>` : ""}`;
  const analysis = H.length ? `
    <div class="stat-grid"><div class="stat-box"><div class="num">${best ? Math.round(best) : "–"}</div><div class="cap">1RM ước tính (kg)</div></div><div class="stat-box"><div class="num">${heaviest ? escapeHtml(kg(heaviest)) : "–"}</div><div class="cap">Tạ nặng nhất</div></div><div class="stat-box"><div class="num">${H.length}</div><div class="cap">Buổi đã tập</div></div></div>
    ${trend !== null ? `<p class="ld-trend ${trend >= 0 ? "up" : "down"}">${trend >= 0 ? "▲ +" : "▼ "}${trend}% sức mạnh ước tính so với buổi đầu (${escapeHtml(first.date.slice(8,10))}/${escapeHtml(first.date.slice(5,7))})</p>` : ""}
    <div class="card-title" style="font-size:13px;margin-top:10px;">1RM ước tính qua các buổi</div>
    ${typeof sparkSVG === "function" ? sparkSVG(H.map(r=> r.e1rm)) : ""}
    ${last ? `<p class="small-note" style="margin-top:6px;">Buổi gần nhất: ${escapeHtml(kg(last.vol))} kg khối lượng · ${last.sets.length} hiệp.</p>` : ""}`
    : `<p class="empty-hint">Chưa có dữ liệu — tập bài này và ghi kg × lần để app tính 1RM ước tính, tạ nặng nhất và xu hướng tiến bộ.</p>`;
  const history = H.length ? H.slice(-15).reverse().map(r=> `
    <div class="ld-hist"><span>${escapeHtml(r.date.slice(8,10))}/${escapeHtml(r.date.slice(5,7))}</span><b>${r.sets.map(t=> `${escapeHtml(kg(t && t.kg))}×${Number(t && t.reps)||0}`).join(" · ") || "—"}</b><small>${r.e1rm ? "1RM ~" + Math.round(r.e1rm) : ""}</small></div>`).join("")
    : `<p class="empty-hint">Chưa có buổi nào cho bài này.</p>`;
  return `
    <div class="ld-tabs" role="tablist">
      <button class="ld-tab active" data-ld-tab="guide" role="tab" aria-selected="true">Hướng dẫn</button>
      <button class="ld-tab" data-ld-tab="ana" role="tab" aria-selected="false">Phân tích</button>
      <button class="ld-tab" data-ld-tab="hist" role="tab" aria-selected="false">Lịch sử${H.length ? ` <em>${H.length}</em>` : ""}</button>
    </div>
    <div class="ld-pane" data-ld-pane="guide">${guide}</div>
    <div class="ld-pane" data-ld-pane="ana" hidden>${analysis}</div>
    <div class="ld-pane" data-ld-pane="hist" hidden>${history}</div>`;
}
function libBindDetailTabs(){
  $$("[data-ld-tab]").forEach(b=> b.addEventListener("click", ()=>{
    const t = b.dataset.ldTab;
    $$("[data-ld-tab]").forEach(x=>{ const on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-selected", on ? "true" : "false"); });
    $$("[data-ld-pane]").forEach(p=> p.hidden = p.dataset.ldPane !== t);
  }));
}
/* ---- Chi tiết bài ---- */
/** Khối kỹ thuật dưới video hướng dẫn:
 *  - bài thư viện mở (exdb): chuỗi ảnh tách khung → chạy như ảnh động
 *  - bài lõi TapEasy: video minh hoạ phong cách TapEasy (lặp) → ảnh minh hoạ riêng của bài → ẩn
 *    (KHÔNG dùng ảnh chung của nhóm cơ — trước đây mọi bài ngực đều ra cùng 1 ảnh tĩnh mà ghi "Ảnh động"). */
function libTechMediaHTML(x, imgs){
  if(x.src === "exdb"){
    if(!imgs[0]) return "";
    return `<div class="ld-media"><img id="ld-anim" src="${escapeHtml(imgs[0])}" class="ld-img white" alt="${escapeHtml(x.name)} — ảnh kỹ thuật" decoding="async"><span>${escapeHtml(imgs.length > 1 ? "Ảnh động kỹ thuật" : "Ảnh kỹ thuật")}</span></div>`;
  }
  const A = window.fkExArt;
  const v = A && A.video ? A.video(x.id) : null;
  if(v) return `<div class="ld-media"><video class="ld-img ld-vid${v.ratio === "9:16" ? " tall" : ""}" src="${escapeHtml(v.src)}" poster="${escapeHtml(v.poster || "")}" autoplay muted loop playsinline preload="metadata" aria-label="${escapeHtml(x.name)} — động tác mẫu"></video><span>${escapeHtml("Động tác mẫu")}</span></div>`;
  const art = A && A.full ? A.full(x.id) : "";
  if(art) return `<div class="ld-media"><img src="${escapeHtml(art)}" class="ld-img ld-art" alt="${escapeHtml(x.name)} — minh hoạ kỹ thuật" decoding="async"><span>${escapeHtml("Minh hoạ kỹ thuật")}</span></div>`;
  return "";
}
function openLibDetail(key){
  const x = libFind(key); if(!x) return;
  const imgs = x.src==="exdb" ? (x.ex.images||[]).map((_,i)=>exdbImg(x.ex,i)) : [x.img];
  let frame = 0;
  const vb = videoBlockHTML();
  openSheet(`
    <div class="sheet-header"><h3 style="font-size:18px;">${escapeHtml(x.name)}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    ${vb.html}
    ${libTechMediaHTML(x, imgs)}
    ${libDetailTabsHTML(x, key)}
    <button class="btn btn-primary btn-block" id="ld-add" style="margin-top:14px;"><span class="material-symbols-rounded">add</span>Thêm vào giáo án</button>
  `);
  if(imgs.length > 1){
    const timer = setInterval(()=>{ const im = $("#ld-anim"); if(!im){ clearInterval(timer); return; } frame=(frame+1)%imgs.length; im.src = imgs[frame]; }, 900);
    onSheetCloseHook = ()=> clearInterval(timer);
  }
  $("#ld-add").addEventListener("click", ()=> openAddToPlan(key));
  libBindDetailTabs();
  const vMeta = { name:x.name, guide:x.guide, equipment: x.src==="fitkit" ? ((EXERCISES[x.id]||{}).equipment || "") : (x.ex && x.ex.equipment || x.equip || "") };   // có dụng cụ → lọc đúng video (BUG-07)
  mountVideoBlock(vb.id, videoQueryFor({ name:x.name, muscle:x.muscleVi }), { name:x.name, meta:vMeta });
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

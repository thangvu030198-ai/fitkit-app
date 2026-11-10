/* =========================================================================
   FIT KIT — Thư viện video minh hoạ (Pexels + Pixabay)
   - Tìm video theo tên bài tập, xem trước, chọn để gắn vào:
       · bài trong giáo án cá nhân (item.stock)
       · bài PT giao cho học viên (exercise.stock + videoUrl)
       · xem nhanh trong thư viện 800+ bài
   - Video nền cho màn mở app
   - Luôn hiển thị nguồn + tác giả (điều kiện của Pexels/Pixabay API)
   Nạp SAU app.js / exdb.js, TRƯỚC coach.js.
   ========================================================================= */

state.mediaSettings = Object.assign({ pexelsKey:"", pixabayKey:"" }, state.mediaSettings || {});
const VID_CACHE_KEY = "fitkit_video_cache_v1";

function mediaKeys(){
  const cfg = (typeof MEDIA_CONFIG !== "undefined") ? MEDIA_CONFIG : {};
  return {
    pexels: (state.mediaSettings.pexelsKey || cfg.pexelsKey || "").trim(),
    pixabay: (state.mediaSettings.pixabayKey || cfg.pixabayKey || "").trim(),
  };
}
function hasVideoSource(){ const k = mediaKeys(); return !!(k.pexels || k.pixabay); }

/* ---- Tạo từ khoá tiếng Anh cho bài tập ---- */
const VID_MUSCLE_EN = {
  "Ngực":"chest workout", "Lưng":"back workout", "Vai":"shoulder press workout", "Chân":"leg workout squat",
  "Tay trước":"bicep curl", "Tay sau":"tricep workout", "Bụng":"abs workout", "Tim mạch":"cardio workout",
  "Toàn thân":"full body workout", "Đùi trước":"squat", "Đùi sau":"hamstring workout", "Mông":"glute workout",
  "Xô (lưng rộng)":"lat pulldown", "Bắp chân":"calf raise", "Cẳng tay":"forearm workout", "Cầu vai":"shrug workout",
};
const VID_VI_EN = [
  [/đẩy ngực|bench/i,"bench press"], [/chống đẩy|push/i,"push up"], [/kéo xà|pull-?up/i,"pull up"], [/gánh tạ|squat/i,"squat"],
  [/deadlift|nâng tạ từ sàn/i,"deadlift"], [/plank/i,"plank"], [/nhảy dây/i,"jump rope"], [/chạy/i,"running"],
  [/đạp xe/i,"cycling"], [/burpee/i,"burpee"], [/lunge|chùng chân/i,"lunges"], [/gập bụng|crunch/i,"crunches"],
  [/chèo|row/i,"rowing workout"], [/cuốn tay|curl/i,"bicep curl"], [/yoga|giãn cơ/i,"stretching"],
];
function videoQueryFor(meta){
  const name = String(meta && meta.name || "");
  const inParen = (name.match(/\(([A-Za-z][A-Za-z0-9 \-]+)\)/) || [])[1];
  if(inParen) return inParen.replace(/\b(DB|BB)\b/g,"").trim() + " exercise";
  if(/^[\x00-\x7F]+$/.test(name) && name.trim()) return name.trim() + " exercise";   // tên tiếng Anh (thư viện 800+)
  const hit = VID_VI_EN.find(([re])=> re.test(name)); if(hit) return hit[1];
  const m = String(meta && meta.muscle || "").split(",")[0].trim();
  return VID_MUSCLE_EN[m] || "gym workout";
}

/* ---- Gọi API ---- */
function pickPexelsFile(files){
  const mp4 = (files||[]).filter(f=> (f.file_type||"").includes("mp4") && f.link);
  mp4.sort((a,b)=> Math.abs(Math.max(a.width,a.height)-1280) - Math.abs(Math.max(b.width,b.height)-1280));
  return mp4[0];
}
async function searchPexels(q, key, orientation){
  const u = `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&per_page=15${orientation?`&orientation=${orientation}`:""}`;
  const r = await fetch(u, { headers:{ Authorization: key } });
  if(r.status===401 || r.status===403) throw new Error("Pexels: API key không hợp lệ");
  if(!r.ok) throw new Error("Pexels: lỗi " + r.status);
  const j = await r.json();
  return (j.videos||[]).map(v=>{ const f = pickPexelsFile(v.video_files); if(!f) return null;
    return { provider:"Pexels", id:"px"+v.id, url:f.link, thumb:v.image, w:f.width, h:f.height, duration:v.duration,
      author:(v.user&&v.user.name)||"Pexels", authorUrl:(v.user&&v.user.url)||"https://www.pexels.com", pageUrl:v.url }; }).filter(Boolean);
}
async function searchPixabay(q, key){
  const u = `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&per_page=15&safesearch=true`;
  const r = await fetch(u);
  if(r.status===400 || r.status===401) throw new Error("Pixabay: API key không hợp lệ");
  if(!r.ok) throw new Error("Pixabay: lỗi " + r.status);
  const j = await r.json();
  return (j.hits||[]).map(h=>{ const V = h.videos || {}; const v = [V.tiny, V.small, V.medium].find(x=> x && x.url);   // "tiny" của Pixabay thường là 720p, 1–5MB — nhẹ cho điện thoại if(!v || !v.url) return null;
    return { provider:"Pixabay", id:"pb"+h.id, url:v.url, thumb: v.thumbnail || (h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_640x360.jpg` : ""),
      w:v.width, h:v.height, duration:h.duration, author:h.user||"Pixabay", authorUrl:`https://pixabay.com/users/${h.user}-${h.user_id}/`, pageUrl:h.pageURL }; }).filter(Boolean);
}
function vidCacheGet(k){ try{ const c = JSON.parse(localStorage.getItem(VID_CACHE_KEY)||"{}")[k]; if(c && Date.now()-c.t < 7*86400000) return c.v; }catch(e){} return null; }
function vidCacheSet(k, v){ try{ const all = JSON.parse(localStorage.getItem(VID_CACHE_KEY)||"{}"); all[k] = { t:Date.now(), v }; const keys = Object.keys(all); if(keys.length>60) delete all[keys[0]]; localStorage.setItem(VID_CACHE_KEY, JSON.stringify(all)); }catch(e){} }

async function searchVideos(q, opts={}){
  const keys = mediaKeys();
  if(!keys.pexels && !keys.pixabay) throw new Error("NO_KEY");
  const ck = `${q}|${opts.orientation||""}|${keys.pexels?1:0}${keys.pixabay?1:0}`;
  const cached = vidCacheGet(ck); if(cached) return cached;
  const jobs = [];
  if(keys.pexels) jobs.push(searchPexels(q, keys.pexels, opts.orientation).catch(e=>({ err:e.message })));
  if(keys.pixabay) jobs.push(searchPixabay(q, keys.pixabay).catch(e=>({ err:e.message })));
  const res = await Promise.all(jobs);
  const errs = res.filter(r=>r && r.err).map(r=> /failed to fetch|networkerror|load failed/i.test(r.err) ? "Không kết nối được tới máy chủ video — kiểm tra mạng" : r.err);
  const lists = res.filter(Array.isArray);
  const out = [];   // xen kẽ 2 nguồn
  for(let i=0; i<15; i++) lists.forEach(l=>{ if(l[i]) out.push(l[i]); });
  if(!out.length && errs.length) throw new Error(errs.join(" · "));
  vidCacheSet(ck, out);
  return out;
}

/* ---- HTML video + dòng ghi nguồn ---- */
function stockVideoHTML(stock, opts={}){
  if(!stock || !stock.url) return "";
  return `<div class="stock-wrap" style="${opts.noMargin?"":"margin-bottom:14px;"}">
    <video class="stock-video" src="${escapeHtml(stock.url)}" ${stock.thumb?`poster="${escapeHtml(stock.thumb)}"`:""} autoplay muted loop playsinline preload="metadata" style="max-height:${opts.maxHeight||"38vh"}"></video>
    ${stockCreditHTML(stock)}
  </div>`;
}
function stockCreditHTML(s){
  if(!s) return "";
  return `<div class="stock-credit">Video: <a href="${escapeHtml(s.authorUrl||s.pageUrl||"#")}" target="_blank" rel="noopener">${escapeHtml(s.author||"")}</a> / <a href="${escapeHtml(s.pageUrl||"#")}" target="_blank" rel="noopener">${escapeHtml(s.provider||"")}</a></div>`;
}
function stockFromVideo(v){ return { url:v.url, thumb:v.thumb, provider:v.provider, author:v.author, authorUrl:v.authorUrl, pageUrl:v.pageUrl }; }

/* ---- Sheet chọn video ---- */
function openVideoPicker(query, onPick, opts={}){
  let q = query || "gym workout", preview = null;
  const render = (bodyHtml)=>{
    openSheet(`
      <div class="sheet-header"><h3>${opts.title || "Video minh hoạ"}</h3><button class="icon-btn" id="vp-close"><span class="material-symbols-rounded">${opts.onBack?"arrow_back":"close"}</span></button></div>
      <div class="search-box" style="margin-bottom:10px;"><span class="material-symbols-rounded" style="color:var(--text-dim);">search</span>
        <input id="vp-q" value="${escapeHtml(q)}" placeholder="Từ khoá tiếng Anh — VD: squat, push up"></div>
      <div id="vp-body">${bodyHtml||`<div class="vp-loading"><div class="spinner"></div></div>`}</div>
      <p class="small-note" style="text-align:center;margin-top:8px;">Video miễn phí từ Pexels &amp; Pixabay · luôn ghi nguồn tác giả</p>
    `);
    $("#vp-close").addEventListener("click", ()=> opts.onBack ? opts.onBack() : closeSheet());
    $("#vp-q").addEventListener("keydown", e=>{ if(e.key==="Enter"){ q = e.target.value.trim() || q; load(); } });
  };
  const load = async ()=>{
    render();
    try{
      const list = await searchVideos(q, { orientation: opts.orientation });
      if(!$("#vp-body")) return;
      $("#vp-body").innerHTML = list.length ? `<div class="vp-grid">${list.map((v,i)=>`
        <button class="vp-item" data-vi="${i}">
          <img src="${escapeHtml(v.thumb||"")}" loading="lazy" alt="" onerror="this.style.opacity=0">
          <span class="vp-dur">${Math.round(v.duration||0)}s</span><span class="vp-src">${v.provider}</span>
        </button>`).join("")}</div>` : `<p class="empty-hint">Không tìm thấy video cho "${escapeHtml(q)}". Thử từ khoá khác.</p>`;
      $$("[data-vi]").forEach(b=> b.addEventListener("click", ()=>{ preview = list[Number(b.dataset.vi)]; showPreview(); }));
    }catch(e){
      if(!$("#vp-body")) return;
      if(e.message==="NO_KEY"){ $("#vp-body").innerHTML = noKeyHTML(); bindNoKey(); }
      else $("#vp-body").innerHTML = `<p class="empty-hint">${escapeHtml(e.message)}<br>Kiểm tra kết nối mạng hoặc API key.</p>`;
    }
  };
  const showPreview = ()=>{
    $("#vp-body").innerHTML = `
      ${stockVideoHTML(stockFromVideo(preview), { maxHeight:"46vh" })}
      ${onPick ? `<button class="btn btn-primary btn-block" id="vp-use"><span class="material-symbols-rounded">check</span>Dùng video này</button>` : ""}
      <button class="btn btn-ghost btn-block" id="vp-back" style="margin-top:6px;">Chọn video khác</button>`;
    $("#vp-back").addEventListener("click", load);
    const use = $("#vp-use"); if(use) use.addEventListener("click", ()=>{ onPick(stockFromVideo(preview)); });
  };
  const bindNoKey = ()=>{ const b = $("#vp-setkey"); if(b) b.addEventListener("click", ()=> openMediaSettings(()=> openVideoPicker(query, onPick, opts))); };
  load();
}
function noKeyHTML(){
  return `<div class="card" style="text-align:center;">
    <span class="material-symbols-rounded" style="font-size:36px;color:var(--mint);">video_library</span>
    <p style="margin-top:8px;">Chưa kết nối nguồn video.</p>
    <p class="small-note" style="margin-top:6px;">Thêm API key miễn phí của Pexels hoặc Pixabay để tìm hàng nghìn video tập luyện dùng thương mại được.</p>
    <button class="btn btn-primary btn-block" id="vp-setkey" style="margin-top:12px;">Kết nối nguồn video</button>
  </div>`;
}

/* ---- Cài đặt nguồn video ---- */
function openMediaSettings(onSaved){
  const cfg = (typeof MEDIA_CONFIG !== "undefined") ? MEDIA_CONFIG : {};
  const ms = state.mediaSettings;
  openSheet(`
    <div class="sheet-header"><h3>Nguồn video minh hoạ</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note">Theo tài liệu của bạn: Pexels &amp; Pixabay cho phép dùng thương mại miễn phí. Mỗi nguồn cần 1 API key. Hiện nên dùng <b>Pixabay</b> (đăng ký miễn phí ~2 phút) vì Pexels đang tạm dừng cấp key mới.</p>
    ${cfg.pexelsKey || cfg.pixabayKey ? `<p class="small-note" style="color:var(--mint);margin-top:6px;">Chủ app đã cài sẵn key cho mọi người dùng. Ô dưới chỉ để ghi đè trên máy này.</p>` : ""}
    <div class="field" style="margin-top:12px;"><label>Pixabay API key — lấy tại pixabay.com/api/docs</label><input id="ms-pb" value="${escapeHtml(ms.pixabayKey)}" placeholder="${cfg.pixabayKey?"(đang dùng key của chủ app)":"Dán key Pixabay"}" autocomplete="off"></div>
    <div class="field" style="margin-top:10px;"><label>Pexels API key (Pexels đang tạm dừng cấp key mới)</label><input id="ms-px" value="${escapeHtml(ms.pexelsKey)}" placeholder="${cfg.pexelsKey?"(đang dùng key của chủ app)":"Dán key Pexels"}" autocomplete="off"></div>
    <p class="auth-err" id="ms-err"></p>
    <button class="btn btn-primary btn-block" id="ms-save" style="margin-top:6px;">Lưu &amp; thử tìm video</button>
    <p class="small-note" style="margin-top:10px;">Key chỉ lưu trên máy này. Video luôn hiển thị tên tác giả và nguồn theo điều khoản của Pexels/Pixabay.</p>
  `);
  $("#ms-save").addEventListener("click", async ()=>{
    ms.pexelsKey = $("#ms-px").value.trim(); ms.pixabayKey = $("#ms-pb").value.trim();
    saveState();
    if(!hasVideoSource()){ closeSheet(); toast("Đã xoá key nguồn video"); return; }
    const btn = $("#ms-save"); btn.disabled = true; btn.textContent = "Đang thử...";
    try{
      localStorage.removeItem(VID_CACHE_KEY);
      const r = await searchVideos("squat exercise");
      toast(`Kết nối thành công · ${r.length} video mẫu`, "check_circle");
      if(onSaved) onSaved(); else closeSheet();
    }catch(e){ $("#ms-err").textContent = e.message==="NO_KEY" ? "Chưa có key." : e.message; btn.disabled = false; btn.textContent = "Lưu & thử tìm video"; }
  });
}

/* =====================================================================
   GẮN VÀO CÁC MÀN HIỆN CÓ
   ===================================================================== */

/* ---- Khối video phát ngay: ảnh bìa + nút play + dải video khác ----
   opts.stock   : video đã gắn sẵn (ưu tiên)
   opts.onSave  : (stock)=>{} — hiện nút "Gắn video này cho bài"
   opts.compact : bớt khoảng cách                                        */
let _vbSeq = 0;
function videoBlockHTML(){ const id = "vb" + (++_vbSeq); return { id, html:`<div class="vblock" id="${id}"><div class="vplayer skeleton"><div class="spinner"></div></div></div>` }; }
function fmtDur(s){ s = Math.round(s||0); return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }

async function mountVideoBlock(id, query, opts={}){
  const host = document.getElementById(id); if(!host) return;
  let list = [];
  if(opts.stock && opts.stock.url) list.push(Object.assign({ duration:opts.stock.duration||0 }, opts.stock, { _saved:true }));
  try{
    if(hasVideoSource()){ const found = await searchVideos(query); found.forEach(v=>{ if(!list.some(x=>x.url===v.url)) list.push(v); }); }
  }catch(e){ if(!list.length){ host.innerHTML = `<div class="vb-msg"><span class="material-symbols-rounded">videocam</span>${escapeHtml(e.message==="NO_KEY" ? "Chưa kết nối nguồn video." : e.message)}</div>`; return; } }
  if(!document.getElementById(id)) return;
  if(!list.length){ host.innerHTML = hasVideoSource() ? `<div class="vb-msg"><span class="material-symbols-rounded">videocam</span>Chưa tìm thấy video cho bài này.</div>` : `<div class="vb-msg"><span class="material-symbols-rounded">videocam</span>Chưa kết nối nguồn video.</div>`; return; }
  let cur = 0;
  const draw = ()=>{
    const v = list[cur];
    host.innerHTML = `
      <div class="vplayer" data-state="idle">
        <video playsinline preload="metadata" ${v.thumb?`poster="${escapeHtml(v.thumb)}"`:""} src="${escapeHtml(v.url)}"></video>
        <button class="vp-play" aria-label="Phát video"><span class="material-symbols-rounded">play_arrow</span></button>
        <span class="vp-time">${fmtDur(v.duration)}</span>
        ${v._saved ? `<span class="vp-saved">Đã gắn cho bài</span>` : ""}
      </div>
      <div class="vb-foot">${stockCreditHTML(v)}${opts.onSave && !v._saved ? `<button class="vb-save" type="button"><span class="material-symbols-rounded">check</span>Gắn video này</button>` : ""}</div>
      ${list.length > 1 ? `<div class="vthumbs">${list.slice(0,8).map((x,i)=>`
        <button class="vthumb ${i===cur?'on':''}" data-vt="${i}" aria-label="Video ${i+1}">
          ${x.thumb ? `<img src="${escapeHtml(x.thumb)}" alt="" loading="lazy">` : ""}<span class="material-symbols-rounded">play_arrow</span><i>${fmtDur(x.duration)}</i>
        </button>`).join("")}</div>` : ""}`;
    const box = host.querySelector(".vplayer"), vid = box.querySelector("video");
    const start = ()=>{
      box.dataset.state = "playing"; vid.controls = true; vid.muted = false;
      const p = vid.play(); if(p && p.catch) p.catch(()=>{ vid.muted = true; vid.play().catch(()=>{}); });
    };
    box.querySelector(".vp-play").addEventListener("click", start);
    vid.addEventListener("click", ()=>{ if(box.dataset.state==="idle") start(); });
    vid.addEventListener("error", ()=>{
      box.dataset.state = "error";
      box.insertAdjacentHTML("beforeend", `<div class="vp-err">Không phát được video này. <a href="${escapeHtml(v.pageUrl||v.url)}" target="_blank" rel="noopener">Mở trên ${escapeHtml(v.provider||"web")}</a></div>`);
    });
    $$("[data-vt]", host).forEach(b=> b.addEventListener("click", ()=>{ cur = Number(b.dataset.vt); draw(); const nb = host.querySelector(".vplayer"); if(nb) nb.querySelector(".vp-play").click(); }));
    const sv = host.querySelector(".vb-save");
    if(sv) sv.addEventListener("click", ()=>{ const st = stockFromVideo(list[cur]); st.duration = list[cur].duration; opts.onSave(st); list.forEach(x=>delete x._saved); list[cur]._saved = true; draw(); toast("Đã gắn video cho bài", "videocam"); });
  };
  draw();
}
/* Dừng video khi đóng bảng trượt */
const _closeSheetV1 = closeSheet;
closeSheet = function(){ $$("#sheet-content video").forEach(v=>{ try{ v.pause(); }catch(e){} }); _closeSheetV1(); };

/* 1. Giáo án cá nhân: chi tiết bài + khi đang tập */
const _openExerciseDetailV1 = openExerciseDetail;
openExerciseDetail = function(itemUid, isToday){
  _openExerciseDetailV1(itemUid, isToday);
  const item = getActivePlan().days[state.selectedDay].items.find(it=>it.uid===itemUid); if(!item) return;
  const meta = getExerciseMeta(item);
  const sheet = $("#sheet-content");
  const vb = videoBlockHTML();
  const wrap = document.createElement("div"); wrap.innerHTML = vb.html;
  if(!item.clipId){ const img = sheet.querySelector("img"); if(img) img.replaceWith(wrap.firstElementChild); else sheet.prepend(wrap.firstElementChild); }
  else { const after = $("#btn-fit-toggle-detail") || sheet.querySelector("video"); (after||sheet.firstElementChild).after(wrap.firstElementChild); }
  mountVideoBlock(vb.id, videoQueryFor(meta), { stock:item.stock, onSave: st=>{ item.stock = st; saveState(); renderWorkoutScreen(); } });
};
const _renderSessionStepV1 = renderSessionStep;
renderSessionStep = function(){
  _renderSessionStepV1();
  if(!session || session.idx >= session.items.length) return;
  const item = session.items[session.idx];
  if(item && !item.clipId){
    const img = $("#sheet-content img"); if(!img) return;
    const vb = videoBlockHTML(); const w = document.createElement("div"); w.innerHTML = vb.html; img.replaceWith(w.firstElementChild);
    mountVideoBlock(vb.id, videoQueryFor(getExerciseMeta(item)), { stock:item.stock, onSave: st=>{ item.stock = st; saveState(); } });
  }
};

/* 2. Thư viện 800+ bài (bảng chọn bài): video ngay dưới ảnh */
const _openExDbDetailV1 = openExDbDetail;
openExDbDetail = function(ex, onBack){
  _openExDbDetailV1(ex, onBack);
  const anim = $("#exdb-anim"); if(!anim) return;
  const vb = videoBlockHTML(); anim.insertAdjacentHTML("beforebegin", vb.html);
  anim.classList.add("exdb-anim-small");
  mountVideoBlock(vb.id, ex.name + " exercise", {});
};

/* 3. Màn mở app: video nền */
async function mountWelcomeVideo(){
  const hero = $(".wl-hero"); if(!hero || hero.querySelector(".wl-hero-video")) return;
  const cfg = (typeof MEDIA_CONFIG !== "undefined") ? MEDIA_CONFIG : {};
  let src = "", credit = null;
  if(cfg.welcomeVideo && cfg.welcomeVideo !== "auto") src = cfg.welcomeVideo;
  else if(hasVideoSource()){
    try{
      const list = await searchVideos(cfg.welcomeQuery || "gym workout training", { orientation:"portrait" });
      const v = list.find(x=> x.h > x.w) || list[0];
      if(v){ src = v.url; credit = stockFromVideo(v); }
    }catch(e){}
  }
  if(!src || !$(".wl-hero")) return;
  const vid = document.createElement("video");
  vid.className = "wl-hero-video"; vid.src = src; vid.muted = true; vid.loop = true; vid.autoplay = true; vid.playsInline = true;
  vid.setAttribute("playsinline",""); vid.setAttribute("muted","");
  vid.addEventListener("canplay", ()=> vid.classList.add("on"), { once:true });
  hero.insertBefore(vid, hero.querySelector(".wl-hero-shade"));
  vid.play().catch(()=>{});
  if(credit){ const c = document.createElement("div"); c.className = "wl-credit"; c.innerHTML = stockCreditHTML(credit); hero.appendChild(c); }
}

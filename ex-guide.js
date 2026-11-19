/* =========================================================================
   TapEasy — VIDEO 3D ĐẦU MÀN TẬP + HƯỚNG DẪN 3 PHẦN (ex-guide.js) · 19/11/2026
   (a) Màn đang tập (renderSessionStep): nếu bài có video 3D (media/ex3d) → thay ảnh đầu màn bằng clip 3D tự chạy lặp,
       không tiếng, có nhãn "Bài i/N" — người tập nhìn là thấy động tác, không phải bấm gì.
   (b) Hướng dẫn kỹ thuật chia 3 phần: Tư thế chuẩn bị · Khi thực hiện · Hít thở (+ ô nhóm cơ Chính/Phụ)
       — ở màn tập, chi tiết bài (openExerciseDetail) và Thư viện (bài free-exercise-db dùng bản dịch tiếng Việt).
   Nạp SAU app.js, freevideos.js, library.js, guide-links.js. API: window.FKGuide = { parts(meta, reps), html(meta, reps), breath(meta, reps) }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKGuide) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));
const timedOf = reps=> typeof isTimedReps === "function" ? isTimedReps(reps) : /giây|phút|s$/i.test(String(reps || ""));

/* Hít thở theo kiểu chuyển động (tên + hướng dẫn) */
const BR = [
  [/chạy bộ|chạy nhẹ|running|jogging|treadmill|đạp xe|xe đạp|bicycl|cycling|\bbike\b|elliptical|máy chèo|\browing\b|stationary|nhảy dây|rope jump|jumping|burpee|cardio|stair|step mill|đi bộ|walking|zone 2|sprint/i,
    "Thở theo nhịp bước/đạp: hít 2 nhịp, thở 2 nhịp. Thở hổn hển không nói được câu ngắn → giảm tốc."],
  [/plank|giữ tư thế|wall sit|hollow|isometric|\bhold\b|bridge hold|dead hang|treo người giữ/i,
    "Thở đều, sâu bằng mũi — không nín thở trong lúc giữ tư thế; gồng bụng nhẹ suốt thời gian giữ."],
  [/squat|gánh|deadlift|nâng tạ từ sàn|\brdl\b|romanian|lunge|chùng|leg press|đẩy chân|hack|good morning|clean|snatch|thruster|step-?up|split/i,
    "Hít sâu và gồng bụng TRƯỚC khi hạ xuống, giữ hơi ở đáy; thở ra khi đứng lên/đẩy lên qua điểm khó. Tạ nặng: không thở hết hơi giữa chừng."],
  [/\brow\b|rows|pull|chin|lat |pulldown|kéo|face pull|shrug/i,
    "Thở ra khi kéo tạ về phía người (siết bả vai), hít vào khi duỗi tay trả tạ về chậm có kiểm soát."],
  [/press|push|đẩy|chống đẩy|\bdips?\b|xà kép/i,
    "Hít vào khi hạ tạ/hạ người xuống chậm, thở ra khi đẩy lên. Không khoá cứng khớp ở đỉnh."],
  [/curl|cuốn|raise|nâng|fly|flye|ép|extension|duỗi|kickback|crunch|gập bụng|sit-?up|twist|xoay/i,
    "Thở ra khi co cơ (nâng/cuốn/ép), hít vào khi trả về chậm. Không lấy đà bằng hơi thở."],
];
/* Hít thở theo kiểu chuyển động: xét TÊN bài trước (chính xác hơn), không khớp mới xét câu hướng dẫn */
function breath(meta, reps){
  const name = String(meta && meta.name || ""), guide = String(meta && meta.guide || "");
  for(const src of [name, guide]){
    if(src === guide && timedOf(reps)) return BR[1][1];
    for(const [re, txt] of BR) if(re.test(src)) return txt;
  }
  if(timedOf(reps)) return BR[1][1];
  return "Thở ra ở pha gắng sức (đẩy, kéo hoặc nâng), hít vào ở pha hạ về có kiểm soát. Không nín thở kéo dài.";
}
/* Hướng dẫn → các phần. Ưu tiên dữ liệu viết sẵn (ex-guide-data.js · 68 bài của app); không có thì tự tách câu:
   câu đầu = tư thế chuẩn bị, câu cuối bắt đầu bằng "Không/Tránh/Luôn…" = lưu ý, còn lại = khi thực hiện.
   Chỉ có 1 câu → tách theo mệnh đề: các mệnh đề đầu mô tả tư thế (Nằm/Ngồi/Đặt/Giữ…) = chuẩn bị. */
const PREP_RE = /^(nằm (sấp|ngửa|trên|dưới|nghiêng|ghế)|ngồi (trên|vào|thẳng|máy|ghế|xuống sàn)|đứng (thẳng|giữa|trên|cạnh|trước|chân|tấn)|đặt|chỉnh|cầm|nắm|giữ thanh|giữ thân|tựa|bám|treo|quỳ|chống|kẹp|điều chỉnh|tư thế|từ tư thế|hai chân|bàn chân|chân rộng|mu bàn chân|tay cầm|móc|gác|bước lên máy|lên máy|gắn|đeo|ôm|xách|quay lưng|tạ đặt|thanh tạ|lưng áp|cánh tay tì|một tay|khởi động|chọn|trải)/i;
const TIP_RE = /^(không |tránh|luôn|tập trong|dừng|nên |bắt đầu|đừng|lưu ý|mới tập|chưa |nếu )/i;
function idOf(meta){
  if(meta && meta._id) return meta._id;
  try{ if(meta && meta.name && typeof EXERCISES !== "undefined") for(const k in EXERCISES){ if(EXERCISES[k] && EXERCISES[k].name === meta.name) return k; } }catch(e){}
  return "";
}
function parts(meta, reps){
  const id = idOf(meta), V = id && G.EX_GUIDE_VI && G.EX_GUIDE_VI[id];
  if(V) return { prep: V.p || "", doIt: V.d || "", breath: V.b || breath(meta, reps), tip: V.l || "" };
  const raw = String(meta && meta.guide || "").replace(/\s+/g, " ").trim();
  let ss = raw.split(/(?<=[.!?])\s+/).map(t=> t.trim()).filter(Boolean);
  let prep = "", tip = "";
  if(ss.length > 2 && TIP_RE.test(ss[ss.length - 1])) tip = ss.pop();
  if(ss.length > 1){ prep = ss.shift(); }
  else if(ss.length === 1){
    // 1 câu dài: lấy các mệnh đề đầu mô tả tư thế
    const cl = ss[0].replace(/[.!?]$/, "").split(/,\s*|;\s*/);
    let k = 0; while(k < cl.length - 1 && PREP_RE.test(cl[k])) k++;
    if(k > 0){ prep = cl.slice(0, k).join(", ") + "."; const rest = cl.slice(k).join(", "); ss = [rest.charAt(0).toUpperCase() + rest.slice(1) + "."]; }
  }
  let doIt = ss.join(" ");
  if(!doIt && prep){ doIt = prep; prep = ""; }
  return { prep, doIt: doIt || "Chưa có hướng dẫn chi tiết — xem video phía trên và giữ chuyển động chậm, có kiểm soát.", breath: breath(meta, reps), tip };
}
function musclesOf(meta){
  let w = {};
  try{ if(G.FKTP && FKTP.muscleWeights) w = FKTP.muscleWeights(meta && meta._id || "", meta && meta.muscle) || {}; }catch(e){ w = {}; }
  const main = [], side = [];
  Object.keys(w).forEach(g=> (w[g] >= 1 ? main : side).push(g));
  if(!main.length && !side.length && meta && meta.muscle && meta.muscle !== "—") String(meta.muscle).split(/\s*[\/,·]\s*/).filter(Boolean).forEach(g=> main.push(g));
  return { main: main.slice(0, 4), side: side.slice(0, 4) };
}
function html(meta, reps, opts){
  opts = opts || {};
  const P = parts(meta, reps), M = musclesOf(meta);
  const chips = (M.main.length || M.side.length) && !opts.noChips ? `<div class="ld-mg exg-mg">${M.main.map(g=> `<span class="ld-mg-chip main"><i></i>${esc(g)}<small>Chính</small></span>`).join("")}${M.side.map(g=> `<span class="ld-mg-chip"><i></i>${esc(g)}<small>Phụ</small></span>`).join("")}</div>` : "";
  return `${chips}<div class="ld-guide exg">
    ${P.prep ? `<div><h5>Tư thế chuẩn bị</h5><p>${esc(P.prep)}</p></div>` : ""}
    <div><h5>Khi thực hiện</h5><p>${esc(P.doIt)}</p></div>
    <div><h5>Hít thở</h5><p>${esc(P.breath)}</p></div>
    ${P.tip ? `<div class="exg-tip"><h5>Lưu ý</h5><p>${esc(P.tip)}</p></div>` : ""}
  </div>`;
}

/* ---- meta của bài đang tập (kèm id để tra video 3D + nhóm cơ) ---- */
function itemMeta(item){
  if(!item) return null;
  if(item.custom){
    const vi = item.custom.exDbId && G.EXDB_VI && EXDB_VI[item.custom.exDbId];   // bài thư viện: ưu tiên bản tiếng Việt
    return { name: item.custom.name, equipment: item.custom.equipment, guide: (vi && vi.g) || item.custom.guide, muscle: item.custom.muscle, exDbId: item.custom.exDbId || null };
  }
  const ex = typeof EXERCISES !== "undefined" ? EXERCISES[item.exerciseId] : null;
  return ex ? Object.assign({ _id: item.exerciseId }, ex) : null;
}

/* (a) KHỐI MEDIA DUY NHẤT đầu màn tập (19/11 — làm lại theo góp ý "rối, quá nhiều video"):
   1 khung trên cùng, vuốt ngang / chạm tab để đổi: [3D] → [Góc 1] → [Góc 2] (video YouTube hướng dẫn, chỉ tải khi chạm).
   Không còn khối video thứ 2 / dải YouTube riêng bên dưới trong màn tập (video.js + guide-links.js bỏ qua khi bài có khối này).
   Bài có clip riêng của người dùng (item.clipId) → giữ nguyên clip đó. */
let seq = 0;
function ytIdsFor(item, meta){
  try{ if(!G.FKYT || !FKYT.exKeyOf) return []; const k = FKYT.exKeyOf(item, meta && meta.name); return k ? FKYT.idsFor(k) : []; }catch(e){ return []; }
}
function mediaHTML(slides, idx, total){
  return `<div class="exm-track" tabindex="0" aria-label="Video hướng dẫn — vuốt ngang để đổi góc xem">${slides.map((s, i)=> s.k === "3d"
      ? `<div class="exm-slide" data-i="${i}"><video src="${esc(s.url)}" ${s.thumb ? `poster="${esc(s.thumb)}"` : ""} autoplay muted loop playsinline preload="auto" aria-label="Video 3D động tác"></video></div>`
      : `<div class="exm-slide yt" data-i="${i}"><button type="button" class="exm-yt" data-exm-yt="${esc(s.id)}" aria-label="Phát ${esc(s.label)}"><img src="https://i.ytimg.com/vi/${esc(s.id)}/hqdefault.jpg" alt="" loading="lazy"><span class="exm-play"><span class="material-symbols-rounded">play_arrow</span></span></button></div>`).join("")}</div>
    <span class="exg-now">BÀI ${idx + 1}/${total}</span>
    ${slides.length > 1 ? `<div class="exm-tabs" role="tablist">${slides.map((s, i)=> `<button type="button" role="tab" class="exm-tab${i ? "" : " on"}" data-exm-go="${i}" aria-selected="${!i}">${esc(s.label)}</button>`).join("")}</div>` : `<span class="exg-tag">${esc(slides[0].label)}</span>`}`;
}
function wireMedia(box){
  const track = box.querySelector(".exm-track"); const tabs = Array.from(box.querySelectorAll("[data-exm-go]"));
  const setOn = i=>{ tabs.forEach((t, j)=>{ t.classList.toggle("on", j === i); t.setAttribute("aria-selected", j === i); });
    box.querySelectorAll(".exm-slide video").forEach(v=>{ const sl = v.closest(".exm-slide"); try{ if(+sl.dataset.i === i){ const p = v.play(); if(p && p.catch) p.catch(()=>{}); } else v.pause(); }catch(e){} }); };
  tabs.forEach(t=> t.addEventListener("click", ()=>{ const i = +t.dataset.exmGo; track.scrollTo({ left: track.clientWidth * i, behavior: "smooth" }); setOn(i); }));
  let tm = 0; track.addEventListener("scroll", ()=>{ clearTimeout(tm); tm = setTimeout(()=> setOn(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))), 90); }, { passive: true });
  box.querySelectorAll("[data-exm-yt]").forEach(b=> b.addEventListener("click", ()=>{
    const id = b.getAttribute("data-exm-yt"); if(!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    const f = D.createElement("iframe"); f.className = "exm-frame";
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
    f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen"); f.setAttribute("allowfullscreen", ""); f.setAttribute("title", "Video hướng dẫn");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    const sl = b.closest(".exm-slide"); b.replaceWith(f);
    sl.insertAdjacentHTML("beforeend", `<button type="button" class="exm-open" data-yt="https://www.youtube.com/watch?v=${id}"><span class="material-symbols-rounded">play_circle</span>YouTube</button>`);
    box.querySelectorAll(".exm-slide video").forEach(v=>{ try{ v.pause(); }catch(e){} });
  }));
}
async function mount3D(){
  const sc = D && D.getElementById("sheet-content");
  if(!sc || typeof session === "undefined" || !session || session.finished) return;
  const item = session.items && session.items[session.idx]; if(!item || item.clipId) return;   // bài có clip riêng của người dùng → giữ nguyên
  const my = ++seq;
  const meta = itemMeta(item); if(!meta) return;
  const yt = ytIdsFor(item, meta);
  let v = null;
  if(typeof findFreeExerciseVideos === "function"){ try{ v = (await findFreeExerciseVideos(meta.exDbId ? meta : (G.EXERCISES && EXERCISES[item.exerciseId]) || meta))[0]; }catch(e){ v = null; } }
  if(my !== seq) return;
  const slides = [];
  if(v && v.ex3d) slides.push({ k: "3d", label: "3D", url: v.url, thumb: v.thumb });
  yt.forEach((id, i)=> slides.push({ k: "yt", label: "Góc " + (i + 1), id }));
  if(!slides.length) return;
  const sc2 = D.getElementById("sheet-content"); if(!sc2 || sc2.querySelector(".exm")) return;
  const old = Array.from(sc2.children).find(el=> el.tagName === "IMG" || (el.classList && el.classList.contains("vblock")));
  const box = D.createElement("div");
  box.className = "exm exg-3d";
  box.innerHTML = mediaHTML(slides, session.idx, session.items.length);
  if(old) old.replaceWith(box); else sc2.insertBefore(box, sc2.children[2] || null);
  wireMedia(box);
  const vid = box.querySelector("video");
  if(vid){ try{ const p = vid.play(); if(p && p.catch) p.catch(()=>{}); }catch(e){}
    vid.addEventListener("error", ()=>{ const sl = vid.closest(".exm-slide"); if(slides.length > 1){ const t = box.querySelector('[data-exm-go="0"]'); if(t) t.remove(); sl.remove(); } else if(old) box.replaceWith(old); else box.remove(); }, { once: true }); }
}
/* (b) màn tập: khối "Hướng dẫn kỹ thuật" → 3 phần */
function upgradeSessionGuide(){
  const sc = D && D.getElementById("sheet-content"); if(!sc || typeof session === "undefined" || !session) return;
  const g = Array.from(sc.querySelectorAll("details.set-guide")).find(d=>{ const s = d.querySelector("summary"); return s && /Hướng dẫn kỹ thuật/.test(s.textContent); });
  if(!g || g.querySelector(".exg")) return;
  const item = session.items && session.items[session.idx]; const meta = itemMeta(item); if(!meta) return;
  const p = g.querySelector(":scope > p"); const wrap = D.createElement("div"); wrap.innerHTML = html(meta, item.reps);
  if(p) p.replaceWith(...wrap.childNodes); else g.querySelector("summary").after(...wrap.childNodes);
}
/* chi tiết bài trong buổi/giáo án */
function upgradeDetail(itemUid){
  const sc = D && D.getElementById("sheet-content"); if(!sc || sc.querySelector(".exg")) return;
  const t = Array.from(sc.querySelectorAll(".card-title")).find(x=> /Hướng dẫn kỹ thuật/.test(x.textContent)); if(!t) return;
  const p = t.nextElementSibling; if(!p || p.tagName !== "P") return;
  let item = null;
  try{ const days = (G.state && state.plan && state.plan.days) || []; for(const d of days){ item = (d.items || []).find(x=> x.uid === itemUid); if(item) break; } }catch(e){}
  if(!item && typeof session !== "undefined" && session && session.items) item = session.items.find(x=> x.uid === itemUid);
  const meta = item ? itemMeta(item) : { name: (sc.querySelector("h3") || {}).textContent || "", guide: p.textContent };
  if(!meta) return;
  const wrap = D.createElement("div"); wrap.innerHTML = html(meta, item && item.reps);
  p.replaceWith(...wrap.childNodes);
}
/* Thư viện: bài free-exercise-db → hướng dẫn tiếng Việt 3 phần (bản tiếng Anh thu gọn bên dưới) */
function upgradeLibraryHTML(out, x){
  if(x && x.src !== "exdb"){   // bài của app: thêm ô "Lưu ý" sau "Hít thở"
    const P = parts({ _id: x.src === "fitkit" ? x.id : "", name: x.name, guide: x.guide }, x.reps);
    if(P.tip && !/exg-tip/.test(out)) out = out.replace(/(<div><h5>Hít thở<\/h5><p>[\s\S]*?<\/p><\/div>)/, `$1<div class="exg-tip"><h5>Lưu ý</h5><p>${esc(P.tip)}</p></div>`);
    return out;
  }
  if(!x || !x.ex) return out;
  const re = /<div class="card-title"[^>]*>Hướng dẫn \(tiếng Anh\)<\/div>(<ol class="ld-steps">[\s\S]*?<\/ol>)/;
  const m = re.exec(out); if(!m) return out;
  const vi = G.EXDB_VI && EXDB_VI[x.ex.id];
  if(vi && vi.g){
    const meta = { name: x.name, guide: vi.g, muscle: x.muscleVi };
    return out.replace(re, html(meta, x.reps, { noChips: true }) + `<details class="exg-en"><summary>Hướng dẫn gốc (tiếng Anh)</summary>${m[1]}</details>`);
  }
  // chưa có bản dịch: vẫn chia mục (bước 1 = chuẩn bị, các bước sau = thực hiện), hít thở viết tiếng Việt theo kiểu động tác
  const steps = (x.ex.instructions || []).map(t=> String(t || "").trim()).filter(Boolean);
  if(!steps.length) return out;
  const prep = steps.length > 1 ? steps[0] : "", doIt = (steps.length > 1 ? steps.slice(1) : steps).join(" ");
  return out.replace(re, `<div class="ld-guide exg">
    ${prep ? `<div><h5>Tư thế chuẩn bị <small>(tiếng Anh)</small></h5><p>${esc(prep)}</p></div>` : ""}
    <div><h5>Khi thực hiện <small>(tiếng Anh)</small></h5><p>${esc(doIt)}</p></div>
    <div><h5>Hít thở</h5><p>${esc(breath({ name: x.name, guide: doIt }, x.reps))}</p></div>
  </div>`);
}

function install(){
  if(typeof renderSessionStep === "function" && !renderSessionStep.__exg){
    const f = renderSessionStep;
    renderSessionStep = function(){ const o = f.apply(this, arguments); try{ upgradeSessionGuide(); }catch(e){} try{ mount3D(); }catch(e){} return o; };
    renderSessionStep.__exg = true;
  }
  if(typeof openExerciseDetail === "function" && !openExerciseDetail.__exg){
    const f = openExerciseDetail;
    openExerciseDetail = function(itemUid){ const o = f.apply(this, arguments); try{ upgradeDetail(itemUid); }catch(e){} return o; };
    openExerciseDetail.__exg = true;
  }
  if(typeof libDetailTabsHTML === "function" && !libDetailTabsHTML.__exg){
    const f = libDetailTabsHTML;
    libDetailTabsHTML = function(x){ const o = f.apply(this, arguments); try{ return upgradeLibraryHTML(o, x); }catch(e){ return o; } };
    libDetailTabsHTML.__exg = true;
  }
  if(typeof libGuideParts === "function" && !libGuideParts.__exg){
    libGuideParts = function(x){ return parts({ _id: x && x.src === "fitkit" ? x.id : "", name: x && x.name, guide: x && x.guide }, x && x.reps); };
    libGuideParts.__exg = true;
  }
}
install();
if(D && D.readyState === "loading") D.addEventListener("DOMContentLoaded", install);
G.FKGuide = { parts, html, breath, musclesOf, _mount3D: mount3D, ytIdsFor, mediaHTML };
})(typeof window !== "undefined" ? window : globalThis);

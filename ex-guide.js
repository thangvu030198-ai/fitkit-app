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
function breath(meta, reps){
  const t = (String(meta && meta.name || "") + " " + String(meta && meta.guide || "")).toLowerCase();
  if(/chạy|running|treadmill|đạp|bike|cycl|elliptical|rowing|chèo|nhảy dây|jump|burpee|cardio|stair/.test(t)) return "Thở theo nhịp bước/đạp: hít 2 nhịp, thở 2 nhịp. Thở hổn hển không nói được câu ngắn → giảm tốc.";
  if(timedOf(reps) || /plank|giữ tư thế|wall sit|hollow|isometric/.test(t)) return "Thở đều, sâu bằng mũi — không nín thở trong lúc giữ tư thế; gồng bụng nhẹ suốt thời gian giữ.";
  if(/squat|gánh|deadlift|nâng tạ từ sàn|rdl|romanian|lunge|chùng|leg press|đẩy chân|hack|good morning/.test(t))
    return "Hít sâu và gồng bụng TRƯỚC khi hạ xuống, giữ hơi ở đáy; thở ra khi đứng lên/đẩy lên qua điểm khó. Tạ nặng: không thở hết hơi giữa chừng.";
  if(/kéo|pull|row|chin|lat|xô|face pull/.test(t)) return "Thở ra khi kéo tạ về phía người (siết bả vai), hít vào khi duỗi tay trả tạ về chậm có kiểm soát.";
  if(/đẩy|press|push|chống đẩy|dip|xà kép/.test(t)) return "Hít vào khi hạ tạ/hạ người xuống chậm, thở ra khi đẩy lên. Không khoá cứng khớp ở đỉnh.";
  if(/curl|cuốn|raise|nâng|fly|ép|extension|duỗi|kickback|crunch|gập/.test(t)) return "Thở ra khi co cơ (nâng/cuốn/ép), hít vào khi trả về chậm. Không lấy đà bằng hơi thở.";
  return "Thở ra ở pha gắng sức (đẩy, kéo hoặc nâng), hít vào ở pha hạ về có kiểm soát. Không nín thở kéo dài.";
}
/* Hướng dẫn → 3 phần: các câu mô tả tư thế/đặt người đầu đoạn = chuẩn bị; phần còn lại = thực hiện */
const PREP_RE = /^(nằm|ngồi|đứng|đặt|chỉnh|cầm|nắm|giữ|tựa|bám|treo|quỳ|chống|kẹp|điều chỉnh|tư thế|hai chân|bàn chân|chân rộng|lưng|vai|tay cầm|móc|gác|bước lên|lên máy|gắn)/i;
function parts(meta, reps){
  const raw = String(meta && meta.guide || "").replace(/\s+/g, " ").trim();
  const ss = raw.split(/(?<=[.!?;])\s+/).map(t=> t.trim()).filter(Boolean);
  let k = 0;
  while(k < ss.length - 1 && k < 2 && PREP_RE.test(ss[k])) k++;
  if(k === 0 && ss.length > 1) k = 1;
  const prep = ss.slice(0, k).join(" "), doIt = ss.slice(k).join(" ") || (k ? "" : raw);
  return { prep, doIt: doIt || "Chưa có hướng dẫn chi tiết — xem video phía trên và giữ chuyển động chậm, có kiểm soát.", breath: breath(meta, reps) };
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
  </div>`;
}

/* ---- meta của bài đang tập (kèm id để tra video 3D + nhóm cơ) ---- */
function itemMeta(item){
  if(!item) return null;
  if(item.custom) return { name: item.custom.name, equipment: item.custom.equipment, guide: item.custom.guide, muscle: item.custom.muscle, exDbId: item.custom.exDbId || null };
  const ex = typeof EXERCISES !== "undefined" ? EXERCISES[item.exerciseId] : null;
  return ex ? Object.assign({ _id: item.exerciseId }, ex) : null;
}

/* (a) clip 3D đầu màn tập */
let seq = 0;
async function mount3D(){
  const sc = D && D.getElementById("sheet-content");
  if(!sc || typeof session === "undefined" || !session || session.finished) return;
  const item = session.items && session.items[session.idx]; if(!item || item.clipId) return;   // bài có clip riêng của người dùng → giữ nguyên
  const my = ++seq;
  const meta = itemMeta(item); if(!meta || typeof findFreeExerciseVideos !== "function") return;
  let v = null;
  try{ v = (await findFreeExerciseVideos(meta.exDbId ? meta : (G.EXERCISES && EXERCISES[item.exerciseId]) || meta))[0]; }catch(e){ v = null; }
  if(my !== seq || !v || !v.ex3d) return;
  const sc2 = D.getElementById("sheet-content"); if(!sc2 || sc2.querySelector(".exg-3d")) return;
  const img = Array.from(sc2.children).find(el=> el.tagName === "IMG");
  const box = D.createElement("div");
  box.className = "exg-3d";
  box.innerHTML = `<video src="${esc(v.url)}" ${v.thumb ? `poster="${esc(v.thumb)}"` : ""} autoplay muted loop playsinline preload="auto" aria-label="Video 3D động tác ${esc(meta.name)}"></video>
    <span class="exg-now">BÀI ${session.idx + 1}/${session.items.length}</span><span class="exg-tag">3D</span>`;
  if(img) img.replaceWith(box); else sc2.insertBefore(box, sc2.children[2] || null);
  const vid = box.querySelector("video");
  try{ const p = vid.play(); if(p && p.catch) p.catch(()=>{}); }catch(e){}
  vid.addEventListener("error", ()=>{ if(img) box.replaceWith(img); else box.remove(); }, { once: true });
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
  if(!x || x.src !== "exdb" || !x.ex) return out;
  const vi = G.EXDB_VI && EXDB_VI[x.ex.id]; if(!vi || !vi.g) return out;
  const re = /<div class="card-title"[^>]*>Hướng dẫn \(tiếng Anh\)<\/div>(<ol class="ld-steps">[\s\S]*?<\/ol>)/;
  const m = re.exec(out); if(!m) return out;
  const meta = { name: x.name, guide: vi.g, muscle: x.muscleVi };
  return out.replace(re, html(meta, x.reps, { noChips: true }) + `<details class="exg-en"><summary>Hướng dẫn gốc (tiếng Anh)</summary>${m[1]}</details>`);
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
    libGuideParts = function(x){ const P = parts({ name: x && x.name, guide: x && x.guide }, x && x.reps); return P; };
    libGuideParts.__exg = true;
  }
}
install();
if(D && D.readyState === "loading") D.addEventListener("DOMContentLoaded", install);
G.FKGuide = { parts, html, breath, musclesOf, _mount3D: mount3D };
})(typeof window !== "undefined" ? window : globalThis);

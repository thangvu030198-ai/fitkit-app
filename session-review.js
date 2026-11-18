/* =========================================================================
   TapEasy — XEM LẠI & SỬA BUỔI TẬP (session-review.js) · 19/11/2026 (góp ý người dùng)
   Nạp SAU session-focus.js / session-live.js.
   1. Trong buổi: bài ĐÃ XONG trên dải bài (dấu ✓) bấm được → mở lại để sửa kg × lần. Bấm "Lưu sửa" → ghi đè đúng phần
      của buổi này (recordExerciseResult thay theo session.sid, không đếm trùng) rồi quay về bài đang tập.
   2. Nút "Buổi hôm nay": bảng tổng cả buổi — mỗi bài, từng hiệp kg × lần (đã ✓ / chưa), chạm để tới bài đó.
   3. Nhật ký buổi tập: nút "Chi tiết / sửa" — xem từng hiệp của buổi đã lưu và sửa kg × lần ghi sai
      (cập nhật lịch sử bài, 1RM ước tính, khối lượng buổi).
   API: window.FKReview = { openToday, openLogDetail, editDone, exitEdit, recompute }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKReview) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));
const say = (m, k)=>{ try{ if(typeof toast === "function") toast(m, k); }catch(e){} };
const S = ()=>{ try{ return typeof session !== "undefined" ? session : null; }catch(e){ return null; } };
const num = v=>{ const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const kgT = n=> String(Math.round(num(n) * 100) / 100).replace(".", ",");
const nameOf = it=>{ try{ return (getExerciseMeta(it).name || "").trim(); }catch(e){ return ""; } };
const short = s=> String(s || "").replace(/\s*\(.*\)\s*$/, "");
const grouped = (s, it)=>{ try{ return !!(s._tp && s._tp.groupOf && s._tp.groupOf[it.uid] !== undefined); }catch(e){ return false; } };

/* ---------------------------------------------------------------------
   1. SỬA BÀI ĐÃ XONG TRONG BUỔI
   --------------------------------------------------------------------- */
function editDone(j){
  const s = S(); if(!s || s.finished) return;
  const it = s.items[j]; if(!it || j >= (s._edit ? s._edit.ret : s.idx)) return;
  if(grouped(s, it)){ say("Bài nằm trong superset — sửa ở Nhật ký sau buổi nhé", "info"); return; }
  try{ stopSetRest(); }catch(e){}
  if(!s._edit) s._edit = { ret: s.idx };
  s._edit.j = j; s.idx = j;
  renderSessionStep();
}
function exitEdit(){
  const s = S(); if(!s || !s._edit) return;
  s.idx = s._edit.ret; s._edit = null;
  renderSessionStep();
}
function decorateSession(){
  const s = S(), sc = D.getElementById("sheet-content"); if(!s || !sc || !D.getElementById("btn-session-done")) return;
  /* chip bài đã xong → bấm được để sửa */
  sc.querySelectorAll(".sp-chip.ok").forEach(b=>{ b.disabled = false; b.setAttribute("data-rv-edit", b.getAttribute("data-sp-jump")); b.removeAttribute("data-sp-jump");
    b.setAttribute("aria-label", (b.getAttribute("aria-label") || "").replace(/ — đã (xong|bỏ qua)$/, "") + " — chạm để xem / sửa"); });
  /* nút "Buổi hôm nay" */
  if(!sc.querySelector("[data-rv-today]")){
    const strip = sc.querySelector(".sp-strip");
    const b = D.createElement("button"); b.type = "button"; b.className = "rv-today-btn"; b.setAttribute("data-rv-today", "1");
    b.innerHTML = `<span class="material-symbols-rounded">list_alt</span>Buổi hôm nay`;
    if(strip) strip.insertAdjacentElement("afterend", b); else sc.insertAdjacentElement("afterbegin", b);
  }
  /* đang sửa bài đã xong */
  if(s._edit && s.idx === s._edit.j){
    if(!sc.querySelector(".rv-edit")){
      const bn = D.createElement("div"); bn.className = "rv-edit";
      bn.innerHTML = `<span class="material-symbols-rounded">edit</span><div><b>Đang sửa bài đã tập</b><span>Sửa kg × lần rồi bấm "Lưu sửa". Bài đang tập dở vẫn giữ nguyên.</span></div><button type="button" class="btn btn-ghost btn-sm" data-rv-cancel>Huỷ</button>`;
      const anchor = sc.querySelector(".rv-today-btn") || sc.firstElementChild;
      if(anchor) anchor.insertAdjacentElement("afterend", bn); else sc.prepend(bn);
    }
    const done = D.getElementById("btn-session-done");
    if(done && !done.dataset.rvLbl){ done.dataset.rvLbl = "1"; done.innerHTML = `<span class="material-symbols-rounded">save</span>Lưu sửa — quay lại bài đang tập`; }
    const skip = D.getElementById("btn-session-skip"); if(skip) skip.hidden = true;
    try{ if(G.FKFocus && G.FKFocus.paint) G.FKFocus.paint(); }catch(e){}
  }
}
function install(){
  if(typeof renderSessionStep !== "function" || renderSessionStep.__rv) return false;
  const f = renderSessionStep;
  renderSessionStep = function(){
    const s = S();
    if(s && s._edit && s.idx !== s._edit.j){              // vừa "Lưu sửa" (app.js tăng idx) / bỏ qua → quay về bài đang tập
      const ret = s._edit.ret; s._edit = null; s.idx = ret;
      if(Array.isArray(s.completed)) s.completed = s.completed.filter((u, i, a)=> a.indexOf(u) === i);
      say("Đã lưu sửa", "check_circle");
    }
    const out = f.apply(this, arguments);
    try{ decorateSession(); }catch(e){ try{ console.warn("[review]", e); }catch(_){} }
    return out;
  };
  renderSessionStep.__rv = true;
  return true;
}

/* ---------------------------------------------------------------------
   2. BẢNG "BUỔI HÔM NAY"
   --------------------------------------------------------------------- */
function rowsTxt(rows, timed){
  const done = (rows || []).filter(r=> r && r.done);
  if(!done.length) return "";
  return done.map(r=> timed ? (r.reps ? `${esc(r.reps)}` : "✓") : `${num(r.kg) > 0 ? kgT(r.kg) + "×" : ""}${esc(r.reps || "–")}${r.rpe ? `<i>@${esc(r.rpe)}</i>` : ""}`).join(" · ");
}
function openToday(){
  const s = S(); if(!s || typeof openSheet !== "function") return;
  const cur = s._edit ? s._edit.ret : s.idx;
  let vol = 0, nSets = 0;
  const items = s.items.map((it, j)=>{
    const rows = (s.sets || {})[it.uid] || [], timed = (()=>{ try{ return isTimedReps(it.reps); }catch(e){ return false; } })();
    const done = rows.filter(r=> r && r.done && r.type !== "w");
    done.forEach(r=>{ vol += num(r.kg) * num(r.reps); nSets++; });
    const st = j < cur ? (s.completed.indexOf(it.uid) >= 0 ? "ok" : "skip") : j === cur ? "cur" : "next";
    const lbl = { ok:"Xong", skip:"Bỏ qua", cur:"Đang tập", next:"Chưa tập" }[st];
    const txt = rowsTxt(rows, timed);
    return `<button type="button" class="rv-row ${st}" data-rv-go="${j}">
      <span class="rv-n">${st === "ok" ? `<span class="material-symbols-rounded">check</span>` : j + 1}</span>
      <span class="rv-b"><b>${esc(short(nameOf(it)))}</b><small>${txt || `${esc(String(it.sets))} hiệp × ${esc(String(it.reps))}`}</small></span>
      <em>${lbl}</em></button>`;
  }).join("");
  const min = Math.max(0, Math.round((Date.now() - (s.startedAt || Date.now())) / 60000));
  openSheet(`<div class="sheet-header"><h3>Buổi hôm nay</h3><button class="icon-btn" data-rv-back aria-label="Quay lại bài đang tập"><span class="material-symbols-rounded">close</span></button></div>
    <div class="rv-sum"><span><b>${min}</b> phút</span><span><b>${nSets}</b> hiệp</span><span><b>${vol ? Math.round(vol).toLocaleString("vi-VN") : "–"}</b> kg</span><span><b>${s.completed.length}/${s.items.length}</b> bài</span></div>
    <div class="rv-list">${items}</div>
    <p class="small-note" style="margin-top:8px;">Chạm một bài để tới bài đó — bài đã xong mở ở chế độ sửa.</p>
    <button type="button" class="btn btn-primary btn-block" data-rv-back style="margin-top:10px;">Quay lại bài đang tập</button>`);
}
function goTo(j){
  const s = S(); if(!s) return;
  const cur = s._edit ? s._edit.ret : s.idx;
  if(j < cur){ editDone(j); return; }
  if(s._edit){ s.idx = s._edit.ret; s._edit = null; }
  if(j > cur){
    const it = s.items[j];
    if(grouped(s, it) || grouped(s, s.items[cur])){ say("Bài nằm trong superset — tập theo thứ tự nhóm nhé", "info"); renderSessionStep(); return; }
    const x = s.items.splice(j, 1)[0]; s.items.splice(cur, 0, x);
    say("Tập trước: " + short(nameOf(x)), "swap_vert");
  }
  renderSessionStep();
}

/* ---------------------------------------------------------------------
   3. NHẬT KÝ: CHI TIẾT + SỬA BUỔI ĐÃ LƯU
   --------------------------------------------------------------------- */
function histEntry(key, date){ try{ const h = state.setHist && state.setHist[key]; return h && Array.isArray(h.list) ? h.list.find(x=> x && x.date === date) : null; }catch(e){ return null; } }
function partOf(en, sid){
  if(!en) return null;
  if(en.parts && typeof en.parts === "object"){ const k = sid && en.parts[sid] ? sid : Object.keys(en.parts)[0]; return k ? { sets: en.parts[k], k } : null; }
  return { sets: Array.isArray(en.sets) ? en.sets : [], k: null };
}
/** tính lại 1RM / tạ nặng nhất / khối lượng của 1 mục lịch sử sau khi sửa */
function recompute(en){
  const all = en.parts && typeof en.parts === "object" ? Object.keys(en.parts).flatMap(k=> en.parts[k] || []) : (en.sets || []);
  if(en.parts) en.sets = all;
  const e1 = all.reduce((a, x)=> Math.max(a, (typeof e1rm === "function" ? e1rm(x.kg, x.reps) : 0)), 0);
  en.e1rm = Math.round(e1 * 10) / 10; en.top = all.reduce((a, x)=> Math.max(a, num(x.kg)), 0);
  en.vol = Math.round(all.reduce((a, x)=> a + num(x.kg) * num(x.reps), 0));
  return en;
}
function openLogDetail(id, onBack){
  const T = G.FKTP; if(!T || !T.store || typeof openSheet !== "function") return;
  const e = T.store().log.find(x=> x && x.id === id); if(!e) return;
  const blocks = (e.exercises || []).map((x, i)=>{
    const en = histEntry(x.key, e.date), p = partOf(en, e.sid);
    const sets = p ? p.sets : [];
    return `<div class="rv-ex" data-rv-ex="${i}"><div class="rv-ex-h"><b>${esc(short(x.name))}</b><small>${x.timed ? "Bài tính giờ" : `${x.sets} hiệp · ${x.vol ? Math.round(x.vol).toLocaleString("vi-VN") + " kg" : "—"}`}</small></div>
      ${x.timed || !sets.length ? `<p class="small-note">${x.timed ? "Không có kg × lần để sửa." : "Không tìm thấy chi tiết hiệp (buổi cũ)."}</p>` :
      `<div class="rv-sets">${sets.map((r, k)=> `<div class="rv-set"><span>${k + 1}</span><label><input type="text" inputmode="decimal" data-kg="${k}" value="${esc(kgT(r.kg))}" aria-label="Kg hiệp ${k + 1}"><i>kg</i></label><label><input type="text" inputmode="numeric" data-rp="${k}" value="${esc(r.reps)}" aria-label="Số lần hiệp ${k + 1}"><i>lần</i></label>${r.rpe ? `<em>RPE ${esc(r.rpe)}</em>` : ""}</div>`).join("")}</div>`}
    </div>`;
  }).join("");
  openSheet(`<div class="sheet-header"><h3>${esc(e.title || "Buổi tập")} · ${esc(String(e.date || "").slice(8, 10))}/${esc(String(e.date || "").slice(5, 7))}</h3><button class="icon-btn" data-rv-close aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note">Ghi sai thì sửa trực tiếp rồi bấm Lưu — lịch sử bài, 1RM ước tính và khối lượng buổi tự tính lại.</p>
    <div class="rv-detail">${blocks || `<p class="empty-hint">Buổi này chưa có bài nào được ghi.</p>`}</div>
    <p class="auth-err" id="rv-err" role="alert"></p>
    <div class="chip-row" style="margin-top:10px;"><button type="button" class="btn btn-primary" data-rv-save>Lưu thay đổi</button><button type="button" class="btn btn-outline" data-rv-close>Đóng</button></div>`);
  const sc = D.getElementById("sheet-content");
  const back = ()=>{ if(onBack) onBack(); else if(typeof closeSheet === "function") closeSheet(); };
  sc.querySelectorAll("[data-rv-close]").forEach(b=> b.addEventListener("click", back));
  const sv = sc.querySelector("[data-rv-save]");
  if(sv) sv.addEventListener("click", ()=>{
    let bad = "", changed = 0, dVol = 0;
    (e.exercises || []).forEach((x, i)=>{
      const box = sc.querySelector(`[data-rv-ex="${i}"]`); if(!box) return;
      const en = histEntry(x.key, e.date), p = partOf(en, e.sid); if(!p || !p.sets.length) return;
      const next = p.sets.map((r, k)=>{
        const kg = num((box.querySelector(`[data-kg="${k}"]`) || {}).value), rp = Math.round(num((box.querySelector(`[data-rp="${k}"]`) || {}).value));
        if(kg < 0 || kg > 1000 || rp < 0 || rp > 200) bad = bad || `${short(x.name)}: số không hợp lệ ở hiệp ${k + 1}.`;
        return Object.assign({}, r, { kg: Math.round(kg * 100) / 100, reps: rp });
      });
      if(JSON.stringify(next.map(r=> [r.kg, r.reps])) === JSON.stringify(p.sets.map(r=> [num(r.kg), num(r.reps)]))) return;
      if(bad) return;
      const oldVol = p.sets.reduce((a, r)=> a + num(r.kg) * num(r.reps), 0), newVol = next.reduce((a, r)=> a + num(r.kg) * num(r.reps), 0);
      if(p.k) en.parts[p.k] = next; else en.sets = next;
      recompute(en);
      x.vol = Math.max(0, Math.round(num(x.vol) - oldVol + newVol)); dVol += newVol - oldVol;
      const best = next.reduce((b, r)=> (typeof e1rm === "function" && e1rm(r.kg, r.reps) > (b ? e1rm(b.kg, b.reps) : 0)) ? r : b, null);
      x.best = best ? { kg: best.kg, reps: best.reps } : x.best;
      try{ const sl = state.setLog && state.setLog[x.key]; if(sl && sl.date === e.date) sl.sets = next.filter(r=> r.t !== "w").map(r=> ({ kg: r.kg, reps: r.reps, rpe: r.rpe })); }catch(err){}
      changed++;
    });
    if(bad){ const er = D.getElementById("rv-err"); if(er) er.textContent = bad; say(bad, "error"); return; }
    if(!changed){ say("Không có gì thay đổi", "info"); back(); return; }
    e.volume = Math.max(0, Math.round(num(e.volume) + dVol)); e.edited = Date.now();
    try{ if(typeof saveState === "function") saveState(); }catch(err){}
    say(`Đã sửa ${changed} bài`, "check_circle");
    back();
  });
}
function decorateLog(){
  const sc = D.getElementById("sheet-content"); if(!sc) return;
  sc.querySelectorAll(".tp-log-item[data-log]").forEach(it=>{
    const act = it.querySelector(".tp-log-act"); if(!act || act.querySelector("[data-rv-log]")) return;
    const b = D.createElement("button"); b.className = "btn btn-ghost btn-sm"; b.setAttribute("data-rv-log", it.getAttribute("data-log"));
    b.innerHTML = `<span class="material-symbols-rounded">edit</span>Chi tiết / sửa`;
    act.insertBefore(b, act.firstChild);
  });
}

/* ---------------------------------------------------------------------
   SỰ KIỆN
   --------------------------------------------------------------------- */
if(D && D.addEventListener){
  D.addEventListener("click", ev=>{
    const t = ev.target && ev.target.closest ? ev.target : null; if(!t) return;
    const ed = t.closest("[data-rv-edit]"); if(ed){ ev.preventDefault(); ev.stopPropagation(); editDone(Number(ed.getAttribute("data-rv-edit"))); return; }
    if(t.closest("[data-rv-today]")){ openToday(); return; }
    if(t.closest("[data-rv-cancel]")){ exitEdit(); return; }
    if(t.closest("[data-rv-back]")){ renderSessionStep(); return; }
    const go = t.closest("[data-rv-go]"); if(go){ goTo(Number(go.getAttribute("data-rv-go"))); return; }
    const lg = t.closest("[data-rv-log]"); if(lg){ const T = G.FKTP; openLogDetail(lg.getAttribute("data-rv-log"), T && T.openLogSheet ? ()=> T.openLogSheet() : null); return; }
  }, true);
  const obs = ()=>{ const sc = D.getElementById("sheet-content"); if(!sc || !G.MutationObserver) return false; new MutationObserver(()=>{ try{ decorateLog(); }catch(e){} }).observe(sc, { childList: true }); return true; };
  if(!obs()) D.addEventListener("DOMContentLoaded", obs, { once: true });
}
G.FKReview = { openToday, openLogDetail, editDone, exitEdit, recompute, goTo, install };
if(!install() && D) D.addEventListener("DOMContentLoaded", install, { once: true });
})(typeof window !== "undefined" ? window : globalThis);

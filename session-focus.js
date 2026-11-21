/* =========================================================================
   TapEasy — THANH HIỆP HIỆN TẠI (session-focus.js) · 18/11/2026
   Nạp SAU session-plus.js. Màn tập 1 bài (có nút #btn-session-done) được gắn một thanh
   cố định ở đáy: "Hiệp 2/4 · Lần trước 20 kg × 12", nút −/+ to cho kg và số lần, nút
   "XONG HIỆP 2" to. Thanh chỉ ĐIỀU KHIỂN các ô/nút sẵn có của hàng hiệp (gõ giá trị +
   phát sự kiện change, bấm nút ✓ của hàng) — toàn bộ logic lưu, tự điền kg, nghỉ giữa
   hiệp, kỷ lục vẫn do app.js / session-plus.js xử lý như cũ. Bảng hiệp phía trên giữ nguyên.
   ========================================================================= */
(function(G){
"use strict";
if(G.FKFocus) return;
const LS = "fk_focus_kgstep";
const STEPS = [1, 2, 2.5, 5];
let kgStep = 2.5;
let minimized = false, histOpen = false, lastDone = null;     // thu gọn thanh · mở lịch sử nhanh · hoàn tác hiệp vừa xong
try{ minimized = localStorage.getItem("fk_focus_min") === "1"; }catch(e){}
try{ const v = Number(localStorage.getItem(LS)); if(STEPS.includes(v)) kgStep = v; }catch(e){}

const esc = (s)=> (typeof escapeHtml === "function") ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const numv = (v)=>{ const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : 0; };
const fmt = (n)=> String(Math.round(n * 100) / 100).replace(".", ",");
function sheet(){ return document.getElementById("sheet-content"); }
function rows(){ const sc = sheet(); return sc ? Array.from(sc.querySelectorAll(".set-row[data-set]")) : []; }
function current(){
  const R = rows(); if(!R.length) return null;
  const i = R.findIndex(r=> !r.classList.contains("done"));
  return { list: R, i, row: i >= 0 ? R[i] : null };
}
/** dòng "Lần trước …" của session-plus (nếu có) */
function prevText(row){
  const n = row && row.nextElementSibling;
  if(!n || !n.classList || !n.classList.contains("sp-prev") || n.hidden) return "";
  const b = n.querySelector("button"); const t = (b ? b.textContent : n.textContent || "").replace(/\s+/g, " ").trim();
  return t.replace(/^history\s*/i, "");
}
function setVal(inp, v){
  if(!inp) return;
  inp.value = v;
  try{ inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new Event("change", { bubbles: true })); }catch(e){}
}
function buzz(){ try{ if(navigator.vibrate) navigator.vibrate(8); }catch(e){} }

/** 5 buổi gần nhất của bài đang tập (state.setHist) — xem nhanh ngay trên thanh, không đổi màn */
function curKey(){ try{ const ss = typeof session !== "undefined" ? session : null; const it = ss && ss.items && ss.items[ss.idx]; return it && typeof exKey === "function" ? exKey(it) : ""; }catch(e){ return ""; } }
function histHTML(){
  let L = [];
  try{ const h = state.setHist && state.setHist[curKey()]; L = h && Array.isArray(h.list) ? h.list.slice(-5).reverse() : []; }catch(e){}
  if(!L.length) return `<div class="sf-hist"><p>Chưa có buổi nào của bài này.</p></div>`;
  return `<div class="sf-hist">${L.map(x=> `<div><span>${esc(String(x.date || "").slice(8, 10))}/${esc(String(x.date || "").slice(5, 7))}</span><b>${(x.sets || []).filter(r=> r.t !== "w").map(r=> `${Number(r.kg) > 0 ? esc(fmt(r.kg)) + "×" : ""}${esc(r.reps)}`).join(" · ")}</b>${x.e1rm ? `<small>1RM ~${Math.round(x.e1rm)}</small>` : ""}</div>`).join("")}</div>`;
}
function undoHTML(){
  if(!lastDone || Date.now() - lastDone.at > 6000) return "";
  return `<button type="button" class="sf-undo" data-sf-undo><span class="material-symbols-rounded">undo</span>Hoàn tác hiệp ${lastDone.i + 1}</button>`;
}
function headTools(){
  return `<span class="sf-tools"><button type="button" data-sf-hist aria-expanded="${histOpen}" aria-label="Lịch sử nhanh bài này"><span class="material-symbols-rounded">history</span></button><button type="button" data-sf-min aria-label="${minimized ? "Mở rộng thanh hiệp" : "Thu gọn thanh hiệp"}"><span class="material-symbols-rounded">${minimized ? "expand_less" : "expand_more"}</span></button></span>`;
}
function barHTML(c){
  const total = c.list.length;
  if(!c.row){
    return `<div class="sf-head"><b>Đã xong ${total}/${total} hiệp</b><span>Chuyển sang bài tiếp theo khi sẵn sàng</span>${headTools()}</div>${histOpen ? histHTML() : ""}${undoHTML()}
      <button type="button" class="sf-done all" data-sf-next><span class="material-symbols-rounded">check</span>${esc(nextLabel())}</button>`;
  }
  if(isSided(c.row)) return sidedHTML(c);
  const kgIn = c.row.querySelector("input[data-kg]"), rpIn = c.row.querySelector("input[data-reps]");
  const kg = kgIn ? (kgIn.value !== "" ? kgIn.value : "") : null;
  const reps = rpIn ? rpIn.value : "";
  const prev = prevText(c.row);
  const n = c.i + 1;
  const step = stepNow(kg === "" || kg === null ? null : numv(kg));
  return `<div class="sf-head"><b>Hiệp ${n}/${total}</b>${prev ? `<span>${esc(prev)}</span>` : ""}${headTools()}</div>${histOpen ? histHTML() : ""}${undoHTML()}
    ${minimized ? "" : `<div class="sf-steppers">
      ${kg !== null ? `<div class="sf-step" aria-label="Kg hiệp ${n}">
        <button type="button" data-sf="kg-" aria-label="Giảm ${fmt(step)} kg">−</button>
        <div class="sf-val"><b data-sf-kg>${esc(kg === "" ? "–" : fmt(numv(kg)))}</b><small>KG <i data-sf-stepkg role="button" tabindex="0" aria-label="Đổi bước tạ, đang ${fmt(step)} kg">±${esc(fmt(step))}</i></small></div>
        <button type="button" data-sf="kg+" aria-label="Tăng ${fmt(step)} kg">+</button>
      </div>` : ""}
      ${rpIn ? `<div class="sf-step" aria-label="Số lần hiệp ${n}">
        <button type="button" data-sf="r-" aria-label="Bớt 1 lần">−</button>
        <div class="sf-val"><b data-sf-reps>${esc(reps === "" ? "–" : reps)}</b><small>LẦN</small></div>
        <button type="button" data-sf="r+" aria-label="Thêm 1 lần">+</button>
      </div>` : ""}
    </div>
    ${rpeHTML(c.row, n)}`}
    <button type="button" class="sf-done" data-sf-done><span class="material-symbols-rounded">check</span>XONG HIỆP ${n}<small>${kg !== null && kg !== "" ? `${esc(fmt(numv(kg)))} kg × ` : ""}${esc(reps || "–")} lần</small></button>`;
}
/* ===== 21/11/2026 (2) — BÀI GHI RIÊNG TRÁI / PHẢI =====
   Hàng hiệp có ô bên phải (.set-row.uni + input[data-kg-r]) → thanh có bộ chọn bên "T · Tay trái | P · Tay phải";
   −/+ KG, −/+ LẦN, RPE nhanh điều khiển ĐÚNG ô của bên đang chọn (data-kg / data-reps / select.rpe ↔ data-kg-r / data-reps-r / select.rpe-r).
   Nút XONG HIỆP vẫn bấm ✓ của hàng (✓ = xong CẢ HAI bên; bên phải trống → app lấy theo bên trái) → một chạm vẫn được.
   Đang ở T và chưa đụng tới P → có thêm nút "Tiếp: Tay phải". Đổi hiệp / đổi bài → tự về T. */
const SIDE_SEL = {
  L: { kg: "input[data-kg]", reps: "input[data-reps]", rpe: "select.rpe" },
  R: { kg: "input[data-kg-r]", reps: "input[data-reps-r]", rpe: "select.rpe-r" }
};
let side = "L", sideAt = "", sideSeen = {};
function isSided(row){
  if(!row || !row.querySelector) return false;
  const hasUni = row.classList && typeof row.classList.contains === "function" ? row.classList.contains("uni") : false;
  return !!(hasUni && row.querySelector("input[data-kg-r]"));
}
function sideNow(c){
  const k = curKey() + "|" + (c ? c.i : -1);
  if(k !== sideAt){ sideAt = k; side = "L"; }
  return side;
}
function sideLabels(){
  try{ const ss = typeof session !== "undefined" ? session : null; const it = ss && ss.items && ss.items[ss.idx];
    if(it && typeof fkSideLabels === "function" && typeof getExerciseMeta === "function"){ const L = fkSideLabels(getExerciseMeta(it)); if(L && L.length === 2) return L; } }catch(e){}
  return ["Bên trái", "Bên phải"];
}
function sideInp(row, sd, f){ return row && row.querySelector ? row.querySelector(SIDE_SEL[sd][f]) : null; }
/** giá trị đang hiện của 1 bên — bên phải để trống thì hiểu là THEO bên trái (đúng như app lưu khi bấm ✓) */
function sideVals(row, sd){
  const g = (x, f)=>{ const el = sideInp(row, x, f); return el && el.value != null ? String(el.value) : ""; };
  let kg = g(sd, "kg"), reps = g(sd, "reps"); const rpe = g(sd, "rpe");
  if(sd === "R"){ if(kg === "" || !(numv(kg) > 0)) kg = g("L", "kg"); if(reps === "") reps = g("L", "reps"); }
  return { kg, reps, rpe };
}
function sideTxt(v){ return `${numv(v.kg) > 0 ? fmt(numv(v.kg)) + "×" : ""}${v.reps === "" ? "–" : v.reps}`; }
/** dữ liệu hàng trong buổi (chỉ ĐỌC) — biết bên phải đã được chỉnh tay chưa */
function rowData(i){
  try{ const ss = typeof session !== "undefined" ? session : null; const it = ss && ss.items && ss.items[ss.idx];
    const L = it && ss.sets && ss.sets[it.uid]; return L ? L[i] || null : null; }catch(e){ return null; }
}
function rightTouched(c){
  if(sideSeen[curKey() + "|" + c.i]) return true;
  const r = rowData(c.i);
  return !!(r && r.R && typeof r.R === "object" && (r.R._e || r.R._er || (r.R.rpe !== "" && r.R.rpe != null)));
}
/** "Lần trước" theo bên đang chọn (session-plus.prevFor có .side khi buổi trước ghi 2 bên) */
function prevSide(c, sd){
  try{
    const P = G.FKSessionPlus, ss = typeof session !== "undefined" ? session : null, it = ss && ss.items && ss.items[ss.idx];
    const last = it && state.setLog ? state.setLog[curKey()] : null, data = it && ss.sets ? ss.sets[it.uid] : null;
    const p = P && typeof P.prevFor === "function" && last && data ? P.prevFor(last, data, c.i) : null;
    if(p && p.side && p.side[sd]){ const x = p.side[sd];
      return `Lần trước ${numv(x.kg) > 0 ? fmt(numv(x.kg)) + "×" : ""}${x.reps}${numv(x.rpe) > 0 ? " @" + fmt(numv(x.rpe)) : ""}`; }
  }catch(e){}
  return prevText(c.row);
}
function sidedHTML(c){
  const total = c.list.length, n = c.i + 1, sd = sideNow(c);
  const [lbL, lbR] = sideLabels(), lb = sd === "L" ? lbL : lbR;
  const vL = sideVals(c.row, "L"), vR = sideVals(c.row, "R"), v = sd === "L" ? vL : vR;
  const kgIn = sideInp(c.row, sd, "kg"), rpIn = sideInp(c.row, sd, "reps");
  const prev = prevSide(c, sd);
  const step = stepNow(v.kg === "" ? null : numv(v.kg));
  const both = `T ${sideTxt(vL)} · P ${sideTxt(vR)}`;
  const tab = (x, lab, val)=> `<button type="button" role="tab" data-sf-side="${x}" class="${sd === x ? "on" : ""}" aria-selected="${sd === x}" aria-label="${esc(lab)}: ${esc(sideTxt(val))}${val.rpe ? " RPE " + esc(val.rpe) : ""}"><i>${x === "L" ? "T" : "P"}</i><span><b>${esc(lab)}</b><small>${esc(sideTxt(val))}${val.rpe ? ` · @${esc(val.rpe)}` : ""}</small></span></button>`;
  const nextBtn = sd === "L" && !rightTouched(c)
    ? `<button type="button" class="sf-next" data-sf-sidenext aria-label="Chuyển sang ${esc(lbR)}">Tiếp: ${esc(lbR)}<span class="material-symbols-rounded">arrow_forward</span></button>` : "";
  return `<div class="sf-head"><b>Hiệp ${n}/${total}</b>${prev ? `<span>${esc(prev)}</span>` : ""}${headTools()}</div>${histOpen ? histHTML() : ""}${undoHTML()}
    ${minimized ? "" : `<div class="sf-side" role="tablist" aria-label="Chọn bên đang ghi — hiệp ${n}">${tab("L", lbL, vL)}${tab("R", lbR, vR)}</div>
    <div class="sf-steppers">
      ${kgIn ? `<div class="sf-step" aria-label="Kg hiệp ${n} — ${esc(lb)}">
        <button type="button" data-sf="kg-" aria-label="Giảm ${fmt(step)} kg — ${esc(lb)}">−</button>
        <div class="sf-val"><b data-sf-kg>${esc(v.kg === "" ? "–" : fmt(numv(v.kg)))}</b><small>KG ${sd === "L" ? "T" : "P"} <i data-sf-stepkg role="button" tabindex="0" aria-label="Đổi bước tạ, đang ${fmt(step)} kg">±${esc(fmt(step))}</i></small></div>
        <button type="button" data-sf="kg+" aria-label="Tăng ${fmt(step)} kg — ${esc(lb)}">+</button>
      </div>` : ""}
      ${rpIn ? `<div class="sf-step" aria-label="Số lần hiệp ${n} — ${esc(lb)}">
        <button type="button" data-sf="r-" aria-label="Bớt 1 lần — ${esc(lb)}">−</button>
        <div class="sf-val"><b data-sf-reps>${esc(v.reps === "" ? "–" : v.reps)}</b><small>LẦN ${sd === "L" ? "T" : "P"}</small></div>
        <button type="button" data-sf="r+" aria-label="Thêm 1 lần — ${esc(lb)}">+</button>
      </div>` : ""}
    </div>
    ${rpeHTML(c.row, n, sd, lb)}`}
    <div class="sf-done-row${nextBtn && !minimized ? " two" : ""}">${minimized ? "" : nextBtn}<button type="button" class="sf-done sided" data-sf-done aria-label="Xong hiệp ${n}, cả hai bên: ${esc(both)}"><span class="material-symbols-rounded">check</span><span class="sf-done-t">XONG HIỆP ${n}<small>${esc(both)}</small></span></button></div>`;
}

/* RPE: chỉ hiện khi bảng hiệp đang có cột RPE (tôn trọng chế độ đơn giản / nút "Hiện cột RPE") */
const RPE_CHIPS = ["6", "7", "8", "9", "10"];
function rpeHTML(row, n, sd, lb){
  const sel = sd ? sideInp(row, sd, "rpe") : row.querySelector("select.rpe"); if(!sel) return "";
  const cur = String(sel.value || "");
  return `<div class="sf-rpe" role="group" aria-label="RPE hiệp ${n}${lb ? " — " + esc(lb) : ""}"><span>RPE${sd ? ` ${sd === "L" ? "T" : "P"}` : ""}</span>${RPE_CHIPS.map(v=> `<button type="button" data-sf-rpe="${v}" class="${cur === v ? "on" : ""}" aria-pressed="${cur === v}">${v}</button>`).join("")}<em>${esc(rpeHint(cur))}</em></div>`;
}
function rpeHint(v){ return ({ "6":"còn 4", "7":"còn 3", "8":"còn 2", "9":"còn 1", "10":"hết sức" })[v] || (v ? "" : "tuỳ chọn"); }
function nextLabel(){ const b = document.getElementById("btn-session-done"); return b ? (b.textContent || "").replace(/^check\s*/i, "").trim() || "Xong bài" : "Xong bài"; }

let lastKey = "", stepOverride = null;
/* nấc −/+ : người dùng tự đổi (chạm ±) cho bài này → giữ; đang chọn phòng tập (gyms.js) → nấc theo dụng cụ của phòng; còn lại → nấc đã nhớ */
function stepNow(kg){
  if(stepOverride != null) return stepOverride;
  try{
    if(G.FKGyms && G.FKGyms.active()){ const ss = typeof session !== "undefined" ? session : null; const it = ss && ss.items && ss.items[ss.idx];
      const st = it && typeof getExerciseMeta === "function" ? G.FKGyms.stepFor(getExerciseMeta(it), kg) : null; if(st) return st; }
  }catch(e){}
  return kgStep;
}
function paint(){
  const sc = sheet(); if(!sc) return;
  const k = curKey(); if(k !== lastKey){ lastKey = k; histOpen = false; lastDone = null; stepOverride = null; }
  let bar = sc.querySelector(".sf-bar");
  if(!document.getElementById("btn-session-done") || !rows().length){ if(bar) bar.remove(); return; }
  const c = current(); if(!c) return;
  if(!bar){ bar = document.createElement("div"); bar.className = "sf-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Hiệp đang tập"); sc.appendChild(bar); bind(bar); }
  bar.classList.toggle("min", minimized);
  bar.innerHTML = barHTML(c);
}
function bind(bar){
  bar.addEventListener("click", (e)=>{
    const t = e.target.closest ? e.target.closest("button,[data-sf-stepkg]") : null; if(!t) return;
    const c = current(); if(!c) return;
    if(t.hasAttribute("data-sf-min")){ minimized = !minimized; try{ localStorage.setItem("fk_focus_min", minimized ? "1" : "0"); }catch(err){} paint(); return; }
    if(t.hasAttribute("data-sf-hist")){ histOpen = !histOpen; paint(); return; }
    if(t.hasAttribute("data-sf-undo")){
      const L = rows(), r = lastDone && L[lastDone.i]; lastDone = null;
      if(r && r.classList.contains("done")){ const chk = r.querySelector("[data-done]"); if(chk) chk.click(); try{ stopSetRest(); }catch(err){} }
      buzz(); setTimeout(paint, 30); return;
    }
    if(t.hasAttribute("data-sf-next")){ const b = document.getElementById("btn-session-done"); if(b) b.click(); return; }
    if(!c.row) return;
    act(t, c);
  });
}
/** Thao tác trên hàng hiệp hiện tại (t = nút được bấm trên thanh). Tách riêng để kiểm thử. */
function act(t, c){
    const ga = (n)=> t.getAttribute ? t.getAttribute(n) : null, has = (n)=> t.hasAttribute ? t.hasAttribute(n) : ga(n) != null;
    const sided = isSided(c.row), sd = sided ? sideNow(c) : "L";
    if(has("data-sf-side") || has("data-sf-sidenext")){
      if(!sided) return;
      side = has("data-sf-sidenext") ? "R" : (ga("data-sf-side") === "R" ? "R" : "L");
      if(side === "R") sideSeen[curKey() + "|" + c.i] = 1;
      buzz(); paint(); return;
    }
    if(has("data-sf-stepkg")){ const cur = stepNow(); const i = STEPS.indexOf(cur); kgStep = STEPS[(i + 1) % STEPS.length]; stepOverride = kgStep; try{ localStorage.setItem(LS, String(kgStep)); }catch(err){} buzz(); paint(); return; }
    const kgIn = sided ? sideInp(c.row, sd, "kg") : c.row.querySelector("input[data-kg]");
    const rpIn = sided ? sideInp(c.row, sd, "reps") : c.row.querySelector("input[data-reps]");
    const k = t.dataset ? t.dataset.sf : ga("data-sf");
    if(k === "kg+" || k === "kg-"){
      let base = numv(kgIn && kgIn.value);
      if(!base && kgIn && sd === "R") base = numv((sideInp(c.row, "L", "kg") || {}).value);     // bên phải trống → bắt đầu từ bên trái cùng hiệp
      if(!base && kgIn){ const p = c.list.slice(0, c.i).reverse().map(r=> numv((r.querySelector(sided ? SIDE_SEL[sd].kg : "input[data-kg]")||{}).value)).find(v=> v > 0); base = p || 0; }
      const sp = stepNow(base); const v = Math.max(0, Math.round((base + (k === "kg+" ? sp : -sp)) * 100) / 100);
      setVal(kgIn, v ? String(v) : ""); buzz(); paint(); return;
    }
    if(k === "r+" || k === "r-"){
      let base = numv(rpIn && rpIn.value);
      if(rpIn && sd === "R" && String(rpIn.value) === "") base = numv((sideInp(c.row, "L", "reps") || {}).value);
      const v = Math.max(0, Math.min(200, Math.round(base + (k === "r+" ? 1 : -1)))); setVal(rpIn, String(v)); buzz(); paint(); return;
    }
    if(has("data-sf-rpe")){
      const sel = sided ? sideInp(c.row, sd, "rpe") : c.row.querySelector("select.rpe"); if(!sel) return;
      const v = ga("data-sf-rpe");
      setVal(sel, String(sel.value) === v ? "" : v); buzz(); paint(); return;
    }
    if(has("data-sf-done")){
      const chk = c.row.querySelector("[data-done]"); if(chk){ chk.click(); buzz(); lastDone = { i: c.i, at: Date.now() }; setTimeout(paint, 6100); }
      side = "L";
      setTimeout(paint, 30);
    }
}
/* cập nhật khi người dùng gõ / bấm trực tiếp trên bảng hiệp */
let raf = 0;
function schedule(){ if(raf) return; raf = requestAnimationFrame(()=>{ raf = 0; paint(); }); }
document.addEventListener("change", (e)=>{ if(e.target && e.target.closest && e.target.closest("#sheet-content .set-row")) schedule(); }, true);
document.addEventListener("click", (e)=>{ if(e.target && e.target.closest && e.target.closest("#sheet-content [data-done], #sheet-content [data-sp-copy], #sheet-content [data-sp-add], #sheet-content [data-sp-type]")) setTimeout(schedule, 0); }, true);

function install(){
  if(typeof renderSessionStep !== "function") return false;
  const _r = renderSessionStep;
  renderSessionStep = function(){ const out = _r.apply(this, arguments); try{ paint(); }catch(e){ try{ console.warn("[focus]", e); }catch(_){} } return out; };
  return true;
}
G.FKFocus = { paint, current, prevText, barHTML, act, isSided, sideVals, STEPS, get kgStep(){ return kgStep; }, get side(){ return side; }, install };
if(!install()) document.addEventListener("DOMContentLoaded", install, { once: true });
})(typeof window !== "undefined" ? window : globalThis);

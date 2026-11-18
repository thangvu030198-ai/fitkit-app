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

function barHTML(c){
  const total = c.list.length;
  if(!c.row){
    return `<div class="sf-head"><b>Đã xong ${total}/${total} hiệp</b><span>Chuyển sang bài tiếp theo khi sẵn sàng</span></div>
      <button type="button" class="sf-done all" data-sf-next><span class="material-symbols-rounded">check</span>${esc(nextLabel())}</button>`;
  }
  const kgIn = c.row.querySelector("input[data-kg]"), rpIn = c.row.querySelector("input[data-reps]");
  const kg = kgIn ? (kgIn.value !== "" ? kgIn.value : "") : null;
  const reps = rpIn ? rpIn.value : "";
  const prev = prevText(c.row);
  const n = c.i + 1;
  return `<div class="sf-head"><b>Hiệp ${n}/${total}</b>${prev ? `<span>${esc(prev)}</span>` : ""}</div>
    <div class="sf-steppers">
      ${kg !== null ? `<div class="sf-step" aria-label="Kg hiệp ${n}">
        <button type="button" data-sf="kg-" aria-label="Giảm ${fmt(kgStep)} kg">−</button>
        <div class="sf-val"><b data-sf-kg>${esc(kg === "" ? "–" : fmt(numv(kg)))}</b><small>KG <i data-sf-stepkg role="button" tabindex="0" aria-label="Đổi bước tạ, đang ${fmt(kgStep)} kg">±${esc(fmt(kgStep))}</i></small></div>
        <button type="button" data-sf="kg+" aria-label="Tăng ${fmt(kgStep)} kg">+</button>
      </div>` : ""}
      ${rpIn ? `<div class="sf-step" aria-label="Số lần hiệp ${n}">
        <button type="button" data-sf="r-" aria-label="Bớt 1 lần">−</button>
        <div class="sf-val"><b data-sf-reps>${esc(reps === "" ? "–" : reps)}</b><small>LẦN</small></div>
        <button type="button" data-sf="r+" aria-label="Thêm 1 lần">+</button>
      </div>` : ""}
    </div>
    ${rpeHTML(c.row, n)}
    <button type="button" class="sf-done" data-sf-done><span class="material-symbols-rounded">check</span>XONG HIỆP ${n}<small>${kg !== null && kg !== "" ? `${esc(fmt(numv(kg)))} kg × ` : ""}${esc(reps || "–")} lần</small></button>`;
}
/* RPE: chỉ hiện khi bảng hiệp đang có cột RPE (tôn trọng chế độ đơn giản / nút "Hiện cột RPE") */
const RPE_CHIPS = ["6", "7", "8", "9", "10"];
function rpeHTML(row, n){
  const sel = row.querySelector("select.rpe"); if(!sel) return "";
  const cur = String(sel.value || "");
  return `<div class="sf-rpe" role="group" aria-label="RPE hiệp ${n}"><span>RPE</span>${RPE_CHIPS.map(v=> `<button type="button" data-sf-rpe="${v}" class="${cur === v ? "on" : ""}" aria-pressed="${cur === v}">${v}</button>`).join("")}<em>${esc(rpeHint(cur))}</em></div>`;
}
function rpeHint(v){ return ({ "6":"còn 4", "7":"còn 3", "8":"còn 2", "9":"còn 1", "10":"hết sức" })[v] || (v ? "" : "tuỳ chọn"); }
function nextLabel(){ const b = document.getElementById("btn-session-done"); return b ? (b.textContent || "").replace(/^check\s*/i, "").trim() || "Xong bài" : "Xong bài"; }

function paint(){
  const sc = sheet(); if(!sc) return;
  let bar = sc.querySelector(".sf-bar");
  if(!document.getElementById("btn-session-done") || !rows().length){ if(bar) bar.remove(); return; }
  const c = current(); if(!c) return;
  if(!bar){ bar = document.createElement("div"); bar.className = "sf-bar"; bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Hiệp đang tập"); sc.appendChild(bar); bind(bar); }
  bar.innerHTML = barHTML(c);
}
function bind(bar){
  bar.addEventListener("click", (e)=>{
    const t = e.target.closest ? e.target.closest("button,[data-sf-stepkg]") : null; if(!t) return;
    const c = current(); if(!c) return;
    if(t.hasAttribute("data-sf-next")){ const b = document.getElementById("btn-session-done"); if(b) b.click(); return; }
    if(!c.row) return;
    if(t.hasAttribute("data-sf-stepkg")){ kgStep = STEPS[(STEPS.indexOf(kgStep) + 1) % STEPS.length]; try{ localStorage.setItem(LS, String(kgStep)); }catch(err){} buzz(); paint(); return; }
    const kgIn = c.row.querySelector("input[data-kg]"), rpIn = c.row.querySelector("input[data-reps]");
    const k = t.dataset.sf;
    if(k === "kg+" || k === "kg-"){
      let base = numv(kgIn && kgIn.value);
      if(!base && kgIn){ const p = c.list.slice(0, c.i).reverse().map(r=> numv((r.querySelector("input[data-kg]")||{}).value)).find(v=> v > 0); base = p || 0; }
      const v = Math.max(0, Math.round((base + (k === "kg+" ? kgStep : -kgStep)) * 100) / 100);
      setVal(kgIn, v ? String(v) : ""); buzz(); paint(); return;
    }
    if(k === "r+" || k === "r-"){ const v = Math.max(0, Math.min(200, Math.round(numv(rpIn && rpIn.value) + (k === "r+" ? 1 : -1)))); setVal(rpIn, String(v)); buzz(); paint(); return; }
    if(t.hasAttribute("data-sf-rpe")){
      const sel = c.row.querySelector("select.rpe"); if(!sel) return;
      const v = t.getAttribute("data-sf-rpe");
      setVal(sel, String(sel.value) === v ? "" : v); buzz(); paint(); return;
    }
    if(t.hasAttribute("data-sf-done")){
      const chk = c.row.querySelector("[data-done]"); if(chk){ chk.click(); buzz(); }
      setTimeout(paint, 30);
    }
  });
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
G.FKFocus = { paint, current, prevText, barHTML, STEPS, get kgStep(){ return kgStep; }, install };
if(!install()) document.addEventListener("DOMContentLoaded", install, { once: true });
})(typeof window !== "undefined" ? window : globalThis);

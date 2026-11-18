/* =========================================================================
   TapEasy — NHIỀU PHÒNG TẬP (gyms.js) · 19/11/2026
   Nạp SAU app.js + training-pro.js. Mỗi phòng tập có dụng cụ khác nhau: thanh đòn 20/15 kg, đĩa nhỏ nhất 0,5/1,25/2,5 kg,
   tạ đơn tăng 1/2/2,5 kg, máy tăng theo nấc khối tạ (2,5/5/10 kg), cáp 1,25/2,5/5 kg.
   Chọn phòng đang tập → mọi chỗ dùng "nấc tạ" của app đổi theo:
   - weightStep() (gợi ý tăng/giảm tạ của app.js + training-pro, khởi động, thành tích) — bọc lại, KHÔNG sửa hàm gốc
   - plateHTML() (máy tính lắp đĩa) — dùng thanh đòn + bộ đĩa của phòng
   - nút −/+ trên thanh hiệp (session-focus.js) và gợi ý tăng tạ ngày mai (coach-tips.js)
   Chưa tạo phòng nào → app chạy y như cũ.
   state.gyms = { list:[{ id, name, bar, minPlate, maxPlate, db, machine, cable }], active: id|null }
   API: window.FKGyms = { active(), list(), stepFor(meta, kg), plates(gym), open(), clean(g) }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKGyms) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));
const say = (m, k)=>{ try{ if(typeof toast === "function") toast(m, k); }catch(e){} };
const ST = ()=>{ try{ return typeof state !== "undefined" ? state : null; }catch(e){ return null; } };
const vn = n=> String(n).replace(".", ",");
const ALL_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 1, 0.5];
const OPT = { bar:[20, 15, 10], minPlate:[0.5, 1.25, 2.5, 5], maxPlate:[25, 20], db:[1, 2, 2.5, 5], machine:[2.5, 5, 10], cable:[1.25, 2.5, 5] };
const DEF = { bar:20, minPlate:1.25, maxPlate:20, db:2, machine:5, cable:2.5 };

function pick(v, arr, d){ const n = Number(v); return arr.indexOf(n) >= 0 ? n : d; }
function clean(g){
  g = g && typeof g === "object" ? g : {};
  const o = { id: String(g.id || "").replace(/[^\w-]/g, "").slice(0, 24) || ("g" + Date.now().toString(36)),
    name: String(g.name == null ? "" : g.name).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 40) || "Phòng tập" };
  Object.keys(OPT).forEach(k=> o[k] = pick(g[k], OPT[k], DEF[k]));
  return o;
}
function store(){
  const st = ST(); if(!st) return { list: [], active: null };
  if(!st.gyms || typeof st.gyms !== "object" || !Array.isArray(st.gyms.list)) st.gyms = { list: [], active: null };
  st.gyms.list = st.gyms.list.slice(0, 8).map(clean);
  if(st.gyms.active && !st.gyms.list.some(g=> g.id === st.gyms.active)) st.gyms.active = null;
  return st.gyms;
}
function list(){ return store().list; }
function active(){ const s = store(); return s.list.find(g=> g.id === s.active) || null; }
function plates(g){ g = g || active() || DEF; return ALL_PLATES.filter(p=> p >= g.minPlate - 1e-9 && p <= g.maxPlate + 1e-9); }
function isCable(meta){ return /cáp|cable/i.test(String(meta && (meta.equipment || "")) + " " + String(meta && meta.name || "")); }
/** nấc tạ theo phòng đang chọn; không có phòng → null (dùng mặc định của app) */
function stepFor(meta, kg){
  const g = active(); if(!g) return null;
  const c = typeof fkEquipClass === "function" ? fkEquipClass(meta) : "other";
  if(c === "barbell") return Math.round(g.minPlate * 2 * 100) / 100;
  if(c === "db") return kg != null && Number(kg) <= 10 ? Math.min(g.db, 1) : g.db;
  if(c === "machine") return isCable(meta) ? g.cable : g.machine;
  return null;
}

/* ---------------------------------------------------------------------
   BỌC HÀM CŨ
   --------------------------------------------------------------------- */
function wrap(){
  if(typeof weightStep === "function" && !weightStep.__gym){
    const f = weightStep;
    weightStep = function(meta, kg){ try{ const s = stepFor(meta, kg); if(s) return s; }catch(e){} return f.apply(this, arguments); };
    weightStep.__gym = true;
  }
  if(typeof plateHTML === "function" && !plateHTML.__gym){
    const f = plateHTML;
    plateHTML = function(kg){
      const g = active(); if(!g) return f.apply(this, arguments);
      kg = Number(kg) || 0; const bar = g.bar, P = plates(g);
      if(!kg || kg <= bar) return `<p class="small-note">Thanh đòn ở ${esc(g.name)} nặng ${vn(bar)} kg. Nhập mức tạ lớn hơn ${vn(bar)} kg để xem cách lắp đĩa.</p>`;
      let side = (kg - bar) / 2; const used = [];
      P.forEach(p=>{ while(side >= p - 1e-6){ used.push(p); side -= p; } });
      const colors = { 25:"#E5484D", 20:"#3E7BFA", 15:"#F5C542", 10:"#3DBE7A", 5:"#ECEDEE", 2.5:"#9AA4AE", 1.25:"#C6CCD2", 1:"#B5BCC4", 0.5:"#D8DDE2" };
      return `<div class="tb-title">${vn(kg)} kg = thanh ${vn(bar)} kg + mỗi bên ${vn(Math.round((kg - bar) / 2 * 100) / 100)} kg <small>· ${esc(g.name)}</small></div>
        <div class="plate-viz"><i class="bar"></i>${used.map(p=> `<i class="pl" style="--c:${colors[p] || "#ccc"};--h:${30 + p * 1.6}px" title="${vn(p)} kg"></i>`).join("")}</div>
        <div class="tb-row"><span>Mỗi bên</span><b>${used.map(vn).join(" + ") || "—"}</b></div>${side > 0.01 ? `<p class="small-note">Còn lẻ ${vn(Math.round(side * 100) / 100)} kg mỗi bên — phòng này không có đĩa nhỏ hơn ${vn(g.minPlate)} kg, làm tròn tạ cho vừa.</p>` : ""}`;
    };
    plateHTML.__gym = true;
  }
  /* gợi ý tăng tạ ngày mai */
  try{ if(G.FKTips && !G.FKTips.__gym){ const f = G.FKTips.PROG_STEP; G.FKTips.__gym = true; G.FKTips.PROG_STEP = (key, meta)=> stepFor(meta) || f(key, meta); } }catch(e){}
}

/* ---------------------------------------------------------------------
   GIAO DIỆN
   --------------------------------------------------------------------- */
function chipHTML(){
  const g = active();
  return `<button type="button" class="gym-chip" data-gym-open><span class="material-symbols-rounded">location_on</span>${g ? `Phòng tập: <b>${esc(g.name)}</b>` : "Chọn phòng tập (bước tạ, đĩa)"}<span class="material-symbols-rounded">chevron_right</span></button>`;
}
function selHTML(id, label, k, val, unit){
  return `<div class="field"><label for="${id}">${esc(label)}</label><select id="${id}" data-gk="${k}">${OPT[k].map(v=> `<option value="${v}" ${v === val ? "selected" : ""}>${vn(v)} ${unit}</option>`).join("")}</select></div>`;
}
function open(onBack){
  if(typeof openSheet !== "function") return;
  const s = store();
  openSheet(`<div class="sheet-header"><h3>Phòng tập của bạn</h3><button class="icon-btn" data-gym-close aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note">Mỗi phòng có thanh đòn, đĩa và nấc tạ khác nhau. Chọn phòng đang tập — nút −/+, gợi ý tăng tạ và cách lắp đĩa sẽ theo đúng dụng cụ ở đó.</p>
    <div class="gym-list">
      <button type="button" class="gym-item ${!s.active ? "on" : ""}" data-gym-use=""><span class="material-symbols-rounded">${!s.active ? "check_circle" : "radio_button_unchecked"}</span><span><b>Mặc định của app</b><small>Đĩa 1,25 kg · tạ đơn 2 kg · máy/cáp 2,5 kg</small></span></button>
      ${s.list.map(g=> `<div class="gym-row"><button type="button" class="gym-item ${s.active === g.id ? "on" : ""}" data-gym-use="${esc(g.id)}"><span class="material-symbols-rounded">${s.active === g.id ? "check_circle" : "radio_button_unchecked"}</span><span><b>${esc(g.name)}</b><small>Thanh ${vn(g.bar)} kg · đĩa ${vn(g.minPlate)}–${vn(g.maxPlate)} kg · tạ đơn +${vn(g.db)} · máy +${vn(g.machine)} · cáp +${vn(g.cable)}</small></span></button><button type="button" class="icon-btn" data-gym-edit="${esc(g.id)}" aria-label="Sửa ${esc(g.name)}"><span class="material-symbols-rounded">edit</span></button></div>`).join("")}
    </div>
    ${s.list.length < 8 ? `<button type="button" class="btn btn-outline btn-block" data-gym-edit="" style="margin-top:12px;"><span class="material-symbols-rounded">add</span>Thêm phòng tập</button>` : ""}`);
  bind(onBack);
}
function edit(id, onBack){
  const s = store(), g = s.list.find(x=> x.id === id) || clean({ name: "" });
  const isNew = !s.list.some(x=> x.id === id);
  openSheet(`<div class="sheet-header"><h3>${isNew ? "Thêm phòng tập" : "Sửa phòng tập"}</h3><button class="icon-btn" data-gym-back aria-label="Quay lại"><span class="material-symbols-rounded">close</span></button></div>
    <div class="field"><label for="gym-name">Tên phòng</label><input type="text" id="gym-name" maxlength="40" value="${esc(isNew ? "" : g.name)}" placeholder="VD: California Q7, Gym nhà"></div>
    <div class="field-row" style="margin-top:10px;">${selHTML("gym-bar", "Thanh đòn", "bar", g.bar, "kg")}${selHTML("gym-min", "Đĩa nhỏ nhất", "minPlate", g.minPlate, "kg")}</div>
    <div class="field-row" style="margin-top:10px;">${selHTML("gym-max", "Đĩa lớn nhất", "maxPlate", g.maxPlate, "kg")}${selHTML("gym-db", "Tạ đơn tăng", "db", g.db, "kg")}</div>
    <div class="field-row" style="margin-top:10px;">${selHTML("gym-mc", "Máy (nấc khối tạ)", "machine", g.machine, "kg")}${selHTML("gym-cb", "Cáp tăng", "cable", g.cable, "kg")}</div>
    <p class="small-note" style="margin-top:8px;">Thanh đòn tăng tối thiểu = 2 × đĩa nhỏ nhất (lắp mỗi bên 1 đĩa).</p>
    <div class="chip-row" style="margin-top:12px;"><button type="button" class="btn btn-primary" data-gym-save>Lưu & dùng phòng này</button>${isNew ? "" : `<button type="button" class="btn btn-ghost" data-gym-del style="color:var(--warn);">Xoá</button>`}</div>`);
  const sc = D.getElementById("sheet-content");
  sc.querySelector("[data-gym-back]").addEventListener("click", ()=> open(onBack));
  sc.querySelector("[data-gym-save]").addEventListener("click", ()=>{
    const v = { id: isNew ? "" : g.id, name: (D.getElementById("gym-name") || {}).value };
    if(!String(v.name || "").trim()){ say("Đặt tên phòng tập nhé", "info"); return; }
    sc.querySelectorAll("[data-gk]").forEach(el=> v[el.dataset.gk] = Number(el.value));
    const n = clean(v), st = store();
    const i = st.list.findIndex(x=> x.id === n.id); if(i >= 0) st.list[i] = n; else st.list.push(n);
    st.active = n.id; try{ saveState(); }catch(e){}
    say(`Đang dùng: ${n.name}`, "location_on"); refresh(); open(onBack);
  });
  const del = sc.querySelector("[data-gym-del]");
  if(del) del.addEventListener("click", ()=>{
    const st = store(); st.list = st.list.filter(x=> x.id !== g.id); if(st.active === g.id) st.active = null;
    try{ saveState(); }catch(e){} say("Đã xoá phòng tập", "delete"); refresh(); open(onBack);
  });
}
function bind(onBack){
  const sc = D.getElementById("sheet-content"); if(!sc) return;
  sc.querySelectorAll("[data-gym-close]").forEach(b=> b.addEventListener("click", ()=>{ if(onBack) onBack(); else if(typeof closeSheet === "function") closeSheet(); }));
  sc.querySelectorAll("[data-gym-use]").forEach(b=> b.addEventListener("click", ()=>{
    const st = store(); st.active = b.getAttribute("data-gym-use") || null; try{ saveState(); }catch(e){}
    say(st.active ? `Đang dùng: ${(active() || {}).name}` : "Dùng nấc tạ mặc định", "location_on"); refresh(); open(onBack);
  }));
  sc.querySelectorAll("[data-gym-edit]").forEach(b=> b.addEventListener("click", ()=> edit(b.getAttribute("data-gym-edit"), onBack)));
}
function refresh(){ try{ if(G.FKFocus && G.FKFocus.paint) G.FKFocus.paint(); }catch(e){} }
function inSession(){ try{ return typeof session !== "undefined" && session && !session.finished && !!D.getElementById("btn-session-done"); }catch(e){ return false; } }

function decorateWorkout(){
  const tc = D.getElementById("today-card"); if(!tc) return;
  const old = D.getElementById("gym-chip-w"); if(old) old.remove();
  const w = D.createElement("div"); w.id = "gym-chip-w"; w.innerHTML = chipHTML();
  const after = D.getElementById("rcv-card") || tc;
  after.insertAdjacentElement("afterend", w);
}
function decorateSession(){
  const sc = D.getElementById("sheet-content"); if(!sc || !D.getElementById("btn-session-done") || sc.querySelector(".gym-chip")) return;
  const host = sc.querySelector(".rv-today-btn"); if(!host) return;
  const g = active();
  const b = D.createElement("button"); b.type = "button"; b.className = "rv-today-btn gym-chip-s"; b.setAttribute("data-gym-open", "s");
  b.innerHTML = `<span class="material-symbols-rounded">location_on</span>${g ? esc(g.name) : "Phòng tập"}`;
  host.insertAdjacentElement("afterend", b);
}
if(D && D.addEventListener){
  D.addEventListener("click", e=>{
    const b = e.target && e.target.closest ? e.target.closest("[data-gym-open]") : null; if(!b) return;
    open(inSession() || b.getAttribute("data-gym-open") === "s" ? ()=>{ try{ renderSessionStep(); }catch(err){} } : null);
  });
}
function install(){
  wrap();
  if(typeof renderWorkoutScreen === "function" && !renderWorkoutScreen.__gym){
    const f = renderWorkoutScreen; renderWorkoutScreen = function(){ const o = f.apply(this, arguments); try{ decorateWorkout(); }catch(e){} return o; }; renderWorkoutScreen.__gym = true;
  }
  if(typeof renderSessionStep === "function" && !renderSessionStep.__gym){
    const f = renderSessionStep; renderSessionStep = function(){ const o = f.apply(this, arguments); try{ decorateSession(); }catch(e){} return o; }; renderSessionStep.__gym = true;
  }
}
install(); if(D) D.addEventListener("DOMContentLoaded", install, { once: true });
G.FKGyms = { active, list, stepFor, plates, open, edit, clean, OPT, DEF };
})(typeof window !== "undefined" ? window : globalThis);

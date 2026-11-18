/* =========================================================================
   TapEasy — BẢN ĐỒ PHỤC HỒI CƠ (recovery.js) · 19/11/2026
   Nạp SAU training-pro.js. Ước tính mức mỏi từng nhóm cơ từ các buổi đã ghi (FKTP.store().log, 5 ngày gần nhất):
   - mỗi buổi: số HIỆP HIỆU QUẢ của nhóm cơ (hệ số cơ chính/phụ của app) → mức mỏi ban đầu f0 = min(1, hiệp / 6)
   - thời gian hồi: cơ lớn (ngực, lưng, đùi, mông) 72 giờ, cơ nhỏ 48 giờ — nhân (0,5 + 0,5·f0): tập ít thì hồi nhanh hơn
   - mỏi còn lại giảm tuyến tính theo giờ; nhiều buổi cộng dồn kiểu 1 − Π(1 − fᵢ)
   Đây là ƯỚC TÍNH theo khuyến nghị chung (48–72 giờ giữa 2 buổi nặng cùng nhóm cơ), không đo được cảm giác thật —
   thẻ luôn ghi rõ "ước tính" và gợi ý nghe cơ thể.
   Hiển thị: thẻ nhỏ ở màn Tập (dưới thẻ buổi hôm nay) + sheet bản đồ cơ thể trước/sau.
   API: window.FKRecovery = { compute(log, now), statusOf(f), mapSVG(res), open(), decorate(), BIG, HOURS }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKRecovery) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));
const TP = ()=> G.FKTP || null;
const MG = ["Ngực","Lưng","Vai","Tay trước","Tay sau","Đùi trước","Đùi sau","Mông","Bắp chân","Bụng"];
const BIG = new Set(["Ngực", "Lưng", "Đùi trước", "Đùi sau", "Mông"]);
const HOURS = g=> BIG.has(g) ? 72 : 48;
const FULL_SETS = 6;
const n = v=>{ const x = Number(v); return Number.isFinite(x) ? x : 0; };

function weightsFor(e){
  const T = TP();
  try{ if(T && T.muscleWeights) return T.muscleWeights(e.key, e.muscle) || {}; }catch(err){}
  return {};
}
/** { groups: { [g]: { f, readyAt, sets } }, sessions } */
function compute(log, now){
  now = now || Date.now();
  const since = now - 5 * 86400000;
  const out = {}; MG.forEach(g=> out[g] = { f: 0, readyAt: 0, sets: 0, last: 0 });
  let sessions = 0;
  (Array.isArray(log) ? log : []).forEach(e=>{
    const t = n(e && (e.endedAt || e.startedAt)); if(!t || t < since || t > now + 60000) return;
    sessions++;
    const per = {};
    (e.exercises || []).forEach(x=>{
      const hs = x.hard != null ? n(x.hard) : n(x.sets); if(!(hs > 0)) return;
      const w = weightsFor(x);
      for(const g in w){ if(out[g]) per[g] = (per[g] || 0) + hs * (w[g] >= 1 ? 1 : n(w[g])); }
    });
    for(const g in per){
      const f0 = Math.min(1, per[g] / FULL_SETS), need = HOURS(g) * (0.5 + 0.5 * f0) * 3600000;
      const rem = f0 * Math.max(0, 1 - (now - t) / need);
      const o = out[g];
      o.sets += per[g]; o.last = Math.max(o.last, t);
      if(rem > 0){ o.f = 1 - (1 - o.f) * (1 - rem); o.readyAt = Math.max(o.readyAt, t + need); }
    }
  });
  MG.forEach(g=>{ out[g].f = Math.round(out[g].f * 100) / 100; out[g].sets = Math.round(out[g].sets * 10) / 10; });
  return { groups: out, sessions, now };
}
function statusOf(f){ return f >= 0.6 ? { k:"tired", label:"Còn mỏi" } : f >= 0.25 ? { k:"mid", label:"Đang hồi" } : { k:"ready", label:"Sẵn sàng" }; }
const COL = { tired:"#FF8A5B", mid:"#FFC857", ready:"#5EE6C7", none:"rgba(255,255,255,.14)" };
function colorOf(o){ return !o || (!o.sets && !o.f) ? COL.none : COL[statusOf(o.f).k]; }
function whenTxt(ts, now){
  if(!ts || ts <= now) return "";
  const d = new Date(ts), today = new Date(now);
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const dd = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  return dd === 0 ? `đủ lúc ${hh} hôm nay` : dd === 1 ? `đủ lúc ${hh} ngày mai` : `đủ lúc ${hh} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ---- bản đồ cơ thể (hình khối đơn giản, tự vẽ) ---- */
function mapSVG(res, small){
  const g = res.groups, c = k=> colorOf(g[k]);
  const fig = (ox, parts)=> `<g transform="translate(${ox},0)">
    <circle cx="50" cy="14" r="10" fill="rgba(255,255,255,.22)"/>
    <rect x="45" y="24" width="10" height="6" rx="2" fill="rgba(255,255,255,.18)"/>
    ${parts}</g>`;
  const part = (k, el)=> `<g data-mg="${esc(k)}"><title>${esc(k)}</title>${el.replace(/FILL/g, c(k))}</g>`;
  const front = fig(0,
    part("Vai", `<ellipse cx="29" cy="36" rx="9" ry="7" fill="FILL"/><ellipse cx="71" cy="36" rx="9" ry="7" fill="FILL"/>`) +
    part("Ngực", `<rect x="34" y="31" width="15" height="17" rx="5" fill="FILL"/><rect x="51" y="31" width="15" height="17" rx="5" fill="FILL"/>`) +
    part("Tay trước", `<rect x="16" y="43" width="10" height="22" rx="5" fill="FILL"/><rect x="74" y="43" width="10" height="22" rx="5" fill="FILL"/>`) +
    `<rect x="13" y="67" width="9" height="22" rx="4.5" fill="rgba(255,255,255,.14)"/><rect x="78" y="67" width="9" height="22" rx="4.5" fill="rgba(255,255,255,.14)"/>` +
    part("Bụng", `<rect x="38" y="50" width="24" height="26" rx="6" fill="FILL"/>`) +
    part("Đùi trước", `<rect x="33" y="80" width="15" height="36" rx="7" fill="FILL"/><rect x="52" y="80" width="15" height="36" rx="7" fill="FILL"/>`) +
    part("Bắp chân", `<rect x="35" y="120" width="11" height="28" rx="5.5" fill="FILL" opacity=".55"/><rect x="54" y="120" width="11" height="28" rx="5.5" fill="FILL" opacity=".55"/>`));
  const back = fig(110,
    part("Vai", `<ellipse cx="29" cy="36" rx="9" ry="7" fill="FILL"/><ellipse cx="71" cy="36" rx="9" ry="7" fill="FILL"/>`) +
    part("Lưng", `<path d="M35 31 H65 L61 66 H39 Z" rx="6" fill="FILL"/>`) +
    part("Tay sau", `<rect x="16" y="43" width="10" height="22" rx="5" fill="FILL"/><rect x="74" y="43" width="10" height="22" rx="5" fill="FILL"/>`) +
    `<rect x="13" y="67" width="9" height="22" rx="4.5" fill="rgba(255,255,255,.14)"/><rect x="78" y="67" width="9" height="22" rx="4.5" fill="rgba(255,255,255,.14)"/>` +
    `<rect x="39" y="67" width="22" height="9" rx="4" fill="rgba(255,255,255,.14)"/>` +
    part("Mông", `<rect x="34" y="77" width="15" height="15" rx="7" fill="FILL"/><rect x="51" y="77" width="15" height="15" rx="7" fill="FILL"/>`) +
    part("Đùi sau", `<rect x="33" y="94" width="15" height="24" rx="7" fill="FILL"/><rect x="52" y="94" width="15" height="24" rx="7" fill="FILL"/>`) +
    part("Bắp chân", `<rect x="35" y="121" width="11" height="27" rx="5.5" fill="FILL"/><rect x="54" y="121" width="11" height="27" rx="5.5" fill="FILL"/>`));
  return `<svg viewBox="0 0 210 156" class="rcv-map${small ? " sm" : ""}" role="img" aria-label="Bản đồ phục hồi cơ: trước và sau">${front}${back}
    ${small ? "" : `<text x="50" y="155" text-anchor="middle" font-size="7" fill="currentColor" opacity=".55">TRƯỚC</text><text x="160" y="155" text-anchor="middle" font-size="7" fill="currentColor" opacity=".55">SAU</text>`}</svg>`;
}
function legend(){ return `<div class="rcv-legend"><span><i style="background:${COL.ready}"></i>Sẵn sàng</span><span><i style="background:${COL.mid}"></i>Đang hồi</span><span><i style="background:${COL.tired}"></i>Còn mỏi</span><span><i style="background:${COL.none}"></i>Chưa tập gần đây</span></div>`; }

/* ---- nhóm cơ của buổi đang chọn ở màn Tập ---- */
function dayGroups(){
  try{
    const plan = typeof getActivePlan === "function" ? getActivePlan() : null; const d = plan && plan.days && plan.days[state.selectedDay];
    if(!d || !d.items || !d.items.length) return [];
    const acc = {};
    d.items.forEach(it=>{
      const key = it.custom ? "c:" + (it.custom.name || "") : it.exerciseId;
      const meta = typeof getExerciseMeta === "function" ? getExerciseMeta(it) : {};
      const w = weightsFor({ key, muscle: meta && meta.muscle });
      for(const g in w) if(w[g] >= 1) acc[g] = (acc[g] || 0) + 1;
    });
    return Object.keys(acc);
  }catch(e){ return []; }
}
function cardHTML(res){
  const rows = MG.map(g=> [g, res.groups[g]]).filter(([, o])=> o.f >= 0.25).sort((a, b)=> b[1].f - a[1].f);
  const dg = dayGroups(), warn = dg.filter(g=> res.groups[g] && res.groups[g].f >= 0.6);
  const line = !res.sessions ? "Chưa có buổi nào trong 5 ngày qua — mọi nhóm cơ đều sẵn sàng."
    : rows.length ? "Đang hồi: " + rows.slice(0, 3).map(([g, o])=> `${g} ${Math.round((1 - o.f) * 100)}%`).join(" · ")
    : "Các nhóm cơ đã hồi phục — sẵn sàng tập nặng.";
  return `<div class="card rcv-card" id="rcv-card" role="button" tabindex="0" aria-label="Mở bản đồ phục hồi cơ">
    ${mapSVG(res, true)}
    <div class="rcv-txt"><b>Phục hồi cơ <small>ước tính</small></b><span>${esc(line)}</span>
      ${warn.length ? `<em>Buổi này có ${esc(warn.join(", "))} — còn mỏi: giảm tạ / số hiệp, hoặc đổi buổi.</em>` : ""}</div>
    <span class="material-symbols-rounded rcv-go">chevron_right</span></div>`;
}
function open(){
  if(typeof openSheet !== "function") return;
  const T = TP(); const res = compute(T && T.store ? T.store().log : [], Date.now());
  const list = MG.map(g=> [g, res.groups[g]]).sort((a, b)=> b[1].f - a[1].f);
  openSheet(`<div class="sheet-header"><h3>Phục hồi cơ</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <div class="rcv-big">${mapSVG(res, false)}</div>${legend()}
    <div class="rcv-list">${list.map(([g, o])=>{ const st = statusOf(o.f), has = o.sets > 0 || o.f > 0;
      return `<div class="rcv-row"><i style="background:${has ? COL[st.k] : COL.none}"></i><span>${esc(g)}</span>
        <div class="rcv-bar"><b style="width:${has ? Math.round((1 - o.f) * 100) : 100}%;background:${has ? COL[st.k] : COL.none}"></b></div>
        <small>${has ? `${Math.round((1 - o.f) * 100)}%${o.f >= 0.25 && o.readyAt ? " · " + esc(whenTxt(o.readyAt, res.now)) : ""}` : "—"}</small></div>`; }).join("")}</div>
    <p class="small-note" style="margin-top:10px;">Ước tính từ số hiệp hiệu quả 5 ngày qua: cơ lớn (ngực, lưng, đùi, mông) cần khoảng 48–72 giờ, cơ nhỏ khoảng 24–48 giờ tuỳ khối lượng. Giấc ngủ, ăn uống và cảm giác đau mỏi thật của bạn quan trọng hơn con số này.</p>`);
}
function decorate(){
  const host = D && D.getElementById("today-card"); if(!host) return;
  const old = D.getElementById("rcv-card"); if(old) old.remove();
  const T = TP(); if(!T || !T.store) return;
  const res = compute(T.store().log, Date.now());
  host.insertAdjacentHTML("afterend", cardHTML(res));
  const c = D.getElementById("rcv-card"); if(c){ c.addEventListener("click", open); c.addEventListener("keydown", e=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); open(); } }); }
}
function install(){
  if(typeof renderWorkoutScreen !== "function" || renderWorkoutScreen.__rcv) return false;
  const _r = renderWorkoutScreen;
  renderWorkoutScreen = function(){ const out = _r.apply(this, arguments); try{ decorate(); }catch(e){ try{ console.warn("[recovery]", e); }catch(_){} } return out; };
  renderWorkoutScreen.__rcv = true;
  try{ const w = D.getElementById("screen-workout"); if(w && w.classList.contains("active")) decorate(); }catch(e){}
  return true;
}
G.FKRecovery = { compute, statusOf, mapSVG, cardHTML, open, decorate, install, BIG, HOURS, MG };
if(!install() && D) D.addEventListener("DOMContentLoaded", install, { once: true });
})(typeof window !== "undefined" ? window : globalThis);

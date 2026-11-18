/* =========================================================================
   TapEasy — GỢI Ý CHO NGÀY MAI + NHẮC NGỦ / NGHỈ (coach-tips.js) · 19/11/2026 (góp ý người dùng)
   Nạp SAU recovery.js. Tính HOÀN TOÀN trên máy (không tốn lượt AI) từ dữ liệu người dùng đã ghi:
   - buổi theo giáo án của ngày mai, nhóm cơ nào sáng mai còn mỏi (FKRecovery), bài nào đủ điều kiện tăng tạ
     (buổi trước làm đủ đỉnh số lần ở mọi hiệp chính), giấc ngủ 3 đêm gần nhất so với mục tiêu, số ngày tập liền.
   - Thẻ "Gợi ý cho ngày mai" ở Trang chủ (sau 15:00 → ngày mai; trước đó → hôm nay).
   - Thông báo điện thoại (app cài từ store, cần bật trong thẻ): 07:00 mỗi sáng tóm tắt buổi hôm nay + lưu ý;
     tối (giờ đi ngủ trong Nhắc nhở − 30 phút) nhắc ngủ sớm khi đang thiếu ngủ. Lên lịch lại mỗi lần mở app.
   API: window.FKTips = { build(date), cardHTML(t), schedule(), PROG_STEP }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKTips) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));
const ST = ()=>{ try{ return typeof state !== "undefined" ? state : null; }catch(e){ return null; } };
const num = v=>{ const n = Number(v); return Number.isFinite(n) ? n : 0; };
const short = s=> String(s || "").replace(/\s*\(.*\)\s*$/, "");
const kgT = n=> String(Math.round(num(n) * 100) / 100).replace(".", ",");
const ds = d=> `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DK = ["CN","T2","T3","T4","T5","T6","T7"];
const ID_MORNING = 960, ID_SLEEP = 961;

function cfg(){ const st = ST() || {}; st.coachTips = st.coachTips && typeof st.coachTips === "object" ? st.coachTips : { notify: false }; return st.coachTips; }
function repTopOf(r){ const m = String(r || "").match(/(\d+)\s*[-–]\s*(\d+)/); if(m) return Number(m[2]); const n = String(r || "").match(/^\s*(\d+)/); return n ? Number(n[1]) : 0; }
function stepFor(key, meta){
  const t = String((meta && (meta.equipment || meta.name)) || "") + " " + key;
  if(/tạ đơn|dumbbell|db\b/i.test(t)) return 2;
  if(/máy|machine|cáp|cable/i.test(t)) return 5;
  return 2.5;
}
const PROG_STEP = stepFor;

/** gợi ý cho NGÀY `date` (Date) */
function build(date){
  const st = ST() || {}, out = { date: ds(date), dayKey: DK[date.getDay()], title: "", rest: true, items: [], tips: [], up: [], tired: [], sleep: null, streak: 0 };
  let plan = null; try{ plan = typeof getActivePlan === "function" ? getActivePlan() : null; }catch(e){}
  const day = plan && plan.days && plan.days[out.dayKey];
  out.rest = !day || !day.items || !day.items.length;
  out.title = day ? day.title || "" : "";
  /* mức hồi phục lúc 8 giờ sáng ngày đó */
  let R = null;
  try{ const at = new Date(date); at.setHours(8, 0, 0, 0); R = G.FKRecovery && G.FKTP ? G.FKRecovery.compute(G.FKTP.store().log, Math.max(Date.now(), at.getTime())) : null; }catch(e){}
  if(!out.rest){
    const groups = {};
    day.items.forEach(it=>{
      let meta = {}; try{ meta = getExerciseMeta(it) || {}; }catch(e){}
      const key = typeof exKey === "function" ? exKey(it) : (it.exerciseId || "");
      out.items.push(short(meta.name || ""));
      try{ const w = G.FKTP && G.FKTP.muscleWeights ? G.FKTP.muscleWeights(key, meta.muscle) : {}; Object.keys(w || {}).forEach(g=>{ if(w[g] >= 1) groups[g] = 1; }); }catch(e){}
      /* tăng tạ: buổi gần nhất làm đủ đỉnh số lần ở mọi hiệp chính */
      try{
        const top = repTopOf(it.reps); const h = st.setHist && st.setHist[key]; const last = h && Array.isArray(h.list) ? h.list[h.list.length - 1] : null;
        if(top && last && Array.isArray(last.sets)){
          const work = last.sets.filter(r=> r.t !== "w" && num(r.kg) > 0);
          if(work.length >= 2 && work.every(r=> num(r.reps) >= top)){
            const kg = Math.max(...work.map(r=> num(r.kg))), step = (G.FKTips && G.FKTips.PROG_STEP ? G.FKTips.PROG_STEP(key, meta) : stepFor(key, meta)) || stepFor(key, meta);
            out.up.push({ name: short(meta.name), from: kg, to: Math.round((kg + step) * 100) / 100, reps: top });
          }
        }
      }catch(e){}
    });
    if(R) out.tired = Object.keys(groups).filter(g=> R.groups[g] && R.groups[g].f >= 0.45).map(g=> ({ g, pct: Math.round((1 - R.groups[g].f) * 100) }));
  }
  /* giấc ngủ 3 đêm gần nhất */
  try{
    const goal = num(st.profile && st.profile.sleepGoalHours) || 8;
    const L = Object.keys(st.sleepLog || {}).sort().slice(-3).map(d=> num(st.sleepLog[d] && st.sleepLog[d].hours)).filter(h=> h > 0);
    if(L.length >= 2){ const avg = Math.round(L.reduce((a, b)=> a + b, 0) / L.length * 10) / 10; out.sleep = { avg, goal, debt: avg < goal - 0.75 }; }
  }catch(e){}
  /* số ngày tập liền tính tới hôm nay */
  try{
    const F = new Set(st.finishedDates || []); let n = 0; const d = new Date(); d.setHours(12, 0, 0, 0);
    if(!F.has(ds(d))) d.setDate(d.getDate() - 1);
    while(F.has(ds(d)) && n < 30){ n++; d.setDate(d.getDate() - 1); }
    out.streak = n;
  }catch(e){}
  /* lời khuyên */
  if(out.rest) out.tips.push("Ngày nghỉ theo giáo án — đi bộ nhẹ 20–30 phút hoặc giãn cơ để hồi phục nhanh hơn.");
  if(!out.rest && out.streak >= 5) out.tips.push(`Bạn đã tập ${out.streak} ngày liền — nên nghỉ 1 ngày hoặc tập thật nhẹ để cơ kịp hồi phục.`);
  if(out.tired.length) out.tips.push(`${out.tired.map(x=> x.g).join(", ")} chưa hồi hẳn — giảm 1 hiệp mỗi bài hoặc giữ RPE ≤ 7.`);
  if(out.sleep && out.sleep.debt) out.tips.push(`Ngủ trung bình ${String(out.sleep.avg).replace(".", ",")} giờ (mục tiêu ${out.sleep.goal}) — đi ngủ sớm hơn 30–45 phút${out.rest ? "" : ", buổi tập giữ tạ cũ, đừng cố tăng"}.`);
  if(!out.rest && out.up.length && !(out.sleep && out.sleep.debt) && !out.tired.length) out.tips.push("Sẵn sàng tăng tạ ở các bài bên dưới — làm đủ số lần thì giữ mức mới.");
  if(!out.tips.length && !out.rest) out.tips.push("Mọi thứ ổn — tập đúng giáo án, khởi động kỹ trước hiệp nặng.");
  return out;
}

/* ---------------------------------------------------------------------
   THẺ Ở TRANG CHỦ
   --------------------------------------------------------------------- */
function whenLabel(){ return new Date().getHours() >= 15 ? "ngày mai" : "hôm nay"; }
function targetDate(){ const d = new Date(); if(d.getHours() >= 15) d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; }
function native(){ try{ const C = G.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.LocalNotifications || null; }catch(e){ return null; } }
function cardHTML(t){
  const lbl = whenLabel(), c = cfg(), P = native();
  return `<div class="card tips-card" id="tips-card">
    <div class="card-title"><span class="material-symbols-rounded">lightbulb</span>Gợi ý cho ${esc(lbl)}</div>
    <p class="tips-plan">${t.rest ? "<b>Ngày nghỉ</b>" : `<b>${esc(t.title || "Buổi tập")}</b> · ${esc(t.items.slice(0, 4).join(", "))}${t.items.length > 4 ? "…" : ""}`}</p>
    <ul class="tips-list">${t.tips.map(x=> `<li>${esc(x)}</li>`).join("")}</ul>
    ${t.up.length && !t.tired.length && !(t.sleep && t.sleep.debt) ? `<div class="tips-up">${t.up.slice(0, 4).map(u=> `<span><b>${esc(u.name)}</b> ${esc(kgT(u.from))} → <em>${esc(kgT(u.to))} kg</em></span>`).join("")}</div>` : ""}
    <label class="tips-notify"><input type="checkbox" data-tips-notify ${c.notify ? "checked" : ""}> Nhắc qua thông báo điện thoại${P ? "" : " <small>(chỉ trên app cài từ store)</small>"}</label>
  </div>`;
}
function decorate(){
  const el = D && D.getElementById("home-content"); const st = ST();
  if(!el || !st || !st.onboarded) return;
  const old = D.getElementById("tips-card"); if(old) old.remove();
  let t; try{ t = build(targetDate()); }catch(e){ return; }
  const w = D.createElement("div"); w.innerHTML = cardHTML(t); const card = w.firstElementChild;
  const anchor = el.querySelector(".metric-grid");
  if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling); else el.appendChild(card);
  const cb = card.querySelector("[data-tips-notify]");
  if(cb) cb.addEventListener("change", async ()=>{
    const c = cfg(); c.notify = cb.checked;
    if(c.notify){
      const P = native();
      if(P){ try{ const r = P.requestPermissions ? await P.requestPermissions() : { display: "granted" }; if(r && r.display !== "granted"){ c.notify = false; cb.checked = false; try{ toast("Chưa được cấp quyền thông báo — bật trong Cài đặt điện thoại", "info"); }catch(e){} } }catch(e){} }
      else { try{ toast("Thông báo điện thoại chạy trên app cài từ store — trên web gợi ý vẫn hiện ở Trang chủ", "info"); }catch(e){} }
    }
    try{ saveState(); }catch(e){}
    schedule();
    if(c.notify) try{ toast("Đã bật nhắc: 07:00 gợi ý buổi tập, tối nhắc ngủ khi thiếu ngủ", "check_circle"); }catch(e){}
  });
}

/* ---------------------------------------------------------------------
   THÔNG BÁO (LocalNotifications — chỉ app native)
   --------------------------------------------------------------------- */
function bedtime(){ const st = ST() || {}; const s = st.reminders && st.reminders.bedtimeTime; return /^\d{2}:\d{2}$/.test(String(s || "")) ? s : "22:30"; }
async function schedule(){
  const P = native(); if(!P) return false;
  try{ await P.cancel({ notifications: [{ id: ID_MORNING }, { id: ID_SLEEP }] }); }catch(e){}
  const c = cfg(); if(!c.notify) return false;
  try{ const perm = P.checkPermissions ? await P.checkPermissions() : { display: "granted" }; if(perm && perm.display !== "granted") return false; }catch(e){ return false; }
  const list = [];
  /* sáng mai 07:00 */
  const m = new Date(); m.setDate(m.getDate() + (m.getHours() >= 7 ? 1 : 0)); m.setHours(7, 0, 0, 0);
  try{
    const t = build(m);
    const head = t.rest ? "Hôm nay nghỉ" : `Hôm nay: ${t.title || "buổi tập"}`;
    const body = [t.tips[0], t.up.length && !t.tired.length ? `Tăng tạ: ${t.up.slice(0, 2).map(u=> `${u.name} ${kgT(u.to)} kg`).join(", ")}` : ""].filter(Boolean).join(" · ");
    list.push({ id: ID_MORNING, title: head.slice(0, 80), body: body.slice(0, 180) || "Mở TapEasy xem gợi ý hôm nay", schedule: { at: m, allowWhileIdle: true }, extra: { fk: "tips" } });
  }catch(e){}
  /* tối nay nhắc ngủ (chỉ khi đang thiếu ngủ) */
  try{
    const t = build(new Date());
    if(t.sleep && t.sleep.debt){
      const [hh, mm] = bedtime().split(":").map(Number); const n = new Date(); n.setHours(hh, mm - 30, 0, 0);
      if(n.getTime() > Date.now() + 60000) list.push({ id: ID_SLEEP, title: "Chuẩn bị đi ngủ 😴", body: `3 đêm gần đây bạn ngủ ~${String(t.sleep.avg).replace(".", ",")} giờ (mục tiêu ${t.sleep.goal}). Tắt màn hình, đi ngủ trước ${bedtime()} để cơ hồi phục tốt hơn.`, schedule: { at: n, allowWhileIdle: true }, extra: { fk: "sleep" } });
    }
  }catch(e){}
  if(!list.length) return false;
  try{ await P.schedule({ notifications: list }); return true; }catch(e){ return false; }
}

function install(){
  if(typeof renderHomeScreen !== "function" || renderHomeScreen.__tips) return false;
  const f = renderHomeScreen;
  renderHomeScreen = function(){ const o = f.apply(this, arguments); try{ decorate(); }catch(e){ try{ console.warn("[tips]", e); }catch(_){} } return o; };
  renderHomeScreen.__tips = true;
  try{ const h = D.getElementById("screen-home"); if(h && h.classList.contains("active")) decorate(); }catch(e){}
  return true;
}
if(D){
  const go = ()=>{ install(); setTimeout(()=>{ schedule(); }, 1500); };
  if(D.readyState === "loading") D.addEventListener("DOMContentLoaded", go, { once: true }); else go();
  D.addEventListener("visibilitychange", ()=>{ if(D.visibilityState === "hidden") schedule(); });
}
G.FKTips = { build, cardHTML, schedule, decorate, PROG_STEP };
})(typeof window !== "undefined" ? window : globalThis);

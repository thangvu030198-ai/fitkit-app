/* =========================================================================
   TapEasy — GIÃN CƠ CÓ HẸN GIỜ (stretch.js) · 19/11/2026
   Nạp SAU recovery.js. Một bài giãn cơ tĩnh ngắn (≈ 4–7 phút), tự chọn động tác theo nhóm cơ vừa tập:
   - Sau buổi tập: nút "Giãn cơ 5 phút" trong màn Tổng kết (theo nhóm cơ của buổi vừa xong).
   - Ngày nghỉ: nút trong thẻ "Ngày phục hồi" ở màn Tập (toàn thân).
   - Sheet Phục hồi cơ: "Giãn cơ cho nhóm đang mỏi".
   Mỗi động tác giữ 30 giây (bài 2 bên: 30 giây mỗi bên, báo "Đổi bên"), rung + tiếng bíp ngắn khi chuyển.
   Giãn tĩnh SAU tập / ngày nghỉ (không thay khởi động trước tập). Chữ hướng dẫn do TapEasy tự viết.
   API: window.FKStretch = { LIB, pick(groups, n), plan(groups), open(groups, opts), totalSec(list) }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKStretch) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));
const HOLD = 30;
/* id, tên, nhóm cơ, 2 bên?, cách làm */
const LIB = [
  { id:"door-chest", name:"Giãn ngực ở khung cửa", g:["Ngực","Vai"], two:false, how:"Đặt hai cẳng tay lên khung cửa, khuỷu ngang vai. Bước nhẹ một chân lên trước đến khi thấy căng ở ngực, giữ lưng thẳng." },
  { id:"cross-arm", name:"Kéo tay ngang ngực", g:["Vai","Lưng"], two:true, how:"Đưa một tay ngang trước ngực, tay kia giữ ở khuỷu và kéo nhẹ về phía ngực. Vai hạ xuống, không nhún." },
  { id:"oh-tricep", name:"Giãn tay sau qua đầu", g:["Tay sau","Vai"], two:true, how:"Đưa một tay lên cao rồi gập khuỷu, bàn tay chạm giữa lưng. Tay kia đẩy nhẹ khuỷu về phía sau đầu." },
  { id:"wall-bicep", name:"Giãn tay trước áp tường", g:["Tay trước","Ngực"], two:true, how:"Duỗi thẳng tay, lòng bàn tay áp tường ngang vai, ngón tay chỉ ra sau. Xoay người nhẹ ra xa tường." },
  { id:"child", name:"Tư thế em bé", g:["Lưng","Vai"], two:false, how:"Quỳ, ngồi lùi về gót, cúi người và duỗi hai tay dài ra trước sát sàn. Thở chậm, để lưng thả lỏng." },
  { id:"cat-cow", name:"Mèo – bò chậm", g:["Lưng","Bụng"], two:false, how:"Chống tay và gối. Hít vào võng lưng, ngẩng nhẹ; thở ra cong lưng lên, cằm hướng ngực. Làm chậm theo nhịp thở." },
  { id:"cobra", name:"Rắn hổ mang", g:["Bụng","Lưng"], two:false, how:"Nằm sấp, hai tay đặt dưới vai, đẩy nhẹ ngực lên, hông vẫn sát sàn. Không ngửa cổ quá mức, dừng ở mức thoải mái." },
  { id:"quad-stand", name:"Kéo gót chân về mông", g:["Đùi trước"], two:true, how:"Đứng thẳng (vịn tường nếu cần), gập một gối, tay cầm cổ chân kéo gót về phía mông. Hai đầu gối sát nhau, hông đẩy nhẹ ra trước." },
  { id:"hip-flexor", name:"Giãn cơ gập hông tư thế quỳ", g:["Đùi trước","Mông"], two:true, how:"Quỳ một gối, chân kia bước trước tạo góc 90°. Siết mông, đẩy hông ra trước đến khi thấy căng phía trước hông của chân quỳ." },
  { id:"ham-seat", name:"Ngồi duỗi chân, gập người", g:["Đùi sau","Lưng"], two:true, how:"Ngồi, duỗi thẳng một chân, chân kia gập vào trong. Giữ lưng thẳng, gập từ hông về phía mũi chân duỗi." },
  { id:"fig4", name:"Hình số 4 nằm ngửa", g:["Mông","Đùi sau"], two:true, how:"Nằm ngửa, gác cổ chân lên gối chân kia. Ôm đùi chân dưới kéo về phía ngực đến khi thấy căng ở mông." },
  { id:"calf-wall", name:"Ép bắp chân vào tường", g:["Bắp chân"], two:true, how:"Chống tay vào tường, một chân lùi sau duỗi thẳng, gót sát sàn. Dồn hông về trước đến khi bắp chân sau căng." },
  { id:"side-reach", name:"Nghiêng người với tay", g:["Bụng","Lưng"], two:true, how:"Đứng rộng bằng vai, đưa một tay qua đầu và nghiêng người sang bên kia. Hông giữ yên, không xoay người." },
];
const ALL = ["Ngực","Lưng","Vai","Tay trước","Tay sau","Đùi trước","Đùi sau","Mông","Bắp chân","Bụng"];
function secOf(x){ return x.two ? HOLD * 2 : HOLD; }
function totalSec(list){ return (list || []).reduce((a, x)=> a + secOf(x), 0); }
/** chọn n động tác phủ nhiều nhóm cơ nhất (ưu tiên theo thứ tự groups) */
function pick(groups, n){
  const given = Array.isArray(groups) && groups.length > 0;
  const want = (given ? groups : ALL).filter(g=> ALL.includes(g));
  n = Math.max(3, Math.min(8, n || 6));
  const left = new Set(want), out = [];
  const pool = LIB.slice();
  while(out.length < n && pool.length){
    let best = -1, bi = -1;
    pool.forEach((x, i)=>{
      const cov = x.g.reduce((a, g)=> a + (left.has(g) ? (given ? want.length - want.indexOf(g) : 1) : 0), 0);
      if(cov > best){ best = cov; bi = i; }
    });
    if(best <= 0) break;
    const x = pool.splice(bi, 1)[0]; out.push(x); x.g.forEach(g=> left.delete(g));
    if(!left.size) want.forEach(g=> left.add(g));     // phủ hết rồi → vòng 2 cho nhóm ưu tiên
  }
  /* bài nằm/quỳ để cuối, bài đứng trước — đỡ phải lên xuống sàn nhiều lần */
  const floor = new Set(["child","cat-cow","cobra","hip-flexor","ham-seat","fig4"]);
  return out.filter(x=> !floor.has(x.id)).concat(out.filter(x=> floor.has(x.id)));
}
function plan(groups){
  const list = pick(groups, groups && groups.length ? (groups.length <= 3 ? 5 : 6) : 7);
  return { list, sec: totalSec(list) };
}

/* ---------------------------------------------------------------------
   PHÁT BÀI
   --------------------------------------------------------------------- */
let R = null;          // { list, i, side, end, paused, left, tick, onDone }
function beep(hi){
  try{ if(G.navigator && G.navigator.vibrate) G.navigator.vibrate(hi ? [60, 60, 60] : 40); }catch(e){}
  try{
    const AC = G.AudioContext || G.webkitAudioContext; if(!AC) return;
    R && (R.ac = R.ac || new AC()); const ac = R && R.ac; if(!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = hi ? 880 : 660; g.gain.value = .06;
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + .12);
  }catch(e){}
}
const mmss = s=> `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
function render(){
  const sc = D.getElementById("sheet-content"); if(!sc || !R) return;
  const x = R.list[R.i], left = Math.max(0, Math.ceil(R.paused ? R.left : (R.end - Date.now()) / 1000));
  const p = 1 - left / HOLD, C = 2 * Math.PI * 54;
  const done = R.list.slice(0, R.i).reduce((a, y)=> a + secOf(y), 0) + (x.two && R.side === 2 ? HOLD : 0) + (HOLD - left);
  const tot = totalSec(R.list);
  sc.querySelector(".stx-play").innerHTML = `
    <div class="stx-top"><span>Động tác ${R.i + 1}/${R.list.length}</span><span>Còn ${mmss(Math.max(0, tot - done))}</span></div>
    <div class="stx-dots">${R.list.map((y, k)=> `<i class="${k < R.i ? "done" : k === R.i ? "on" : ""}"></i>`).join("")}</div>
    <div class="stx-ring"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" class="bg"/><circle cx="60" cy="60" r="54" class="fg" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C * (1 - p)).toFixed(1)}"/></svg>
      <div><b>${left}</b><small>giây</small></div></div>
    <h3 class="stx-name">${esc(x.name)}${x.two ? `<em>${R.side === 1 ? "Bên trái" : "Bên phải"}</em>` : ""}</h3>
    <p class="stx-how">${esc(x.how)}</p>
    <p class="small-note stx-tip">Căng vừa phải, không đau nhói. Thở chậm, đều.</p>
    <div class="stx-ctl">
      <button type="button" class="btn btn-outline btn-sm" data-stx="prev" ${R.i === 0 && R.side === 1 ? "disabled" : ""} aria-label="Động tác trước"><span class="material-symbols-rounded">chevron_left</span></button>
      <button type="button" class="btn btn-primary" data-stx="pause"><span class="material-symbols-rounded">${R.paused ? "play_arrow" : "pause"}</span>${R.paused ? "Tiếp tục" : "Tạm dừng"}</button>
      <button type="button" class="btn btn-outline btn-sm" data-stx="next" aria-label="Bỏ qua"><span class="material-symbols-rounded">chevron_right</span></button>
    </div>
    ${R.i + 1 < R.list.length ? `<p class="small-note stx-next">Tiếp theo: ${esc(R.list[R.i + 1].name)}</p>` : ""}`;
}
function go(i, side){
  if(i >= R.list.length){ finish(); return; }
  R.i = Math.max(0, i); R.side = side || 1; R.paused = false; R.end = Date.now() + HOLD * 1000; render();
}
function advance(){
  const x = R.list[R.i];
  if(x.two && R.side === 1){ beep(false); R.side = 2; R.end = Date.now() + HOLD * 1000; render(); try{ if(typeof toast === "function") toast("Đổi bên", "swap_horiz"); }catch(e){} return; }
  beep(true); go(R.i + 1, 1);
}
function tick(){
  if(!R || R.paused) return;
  const sc = D.getElementById("sheet-content"); if(!sc || !sc.querySelector(".stx-play")){ stop(); return; }
  if(Date.now() >= R.end) advance(); else render();
}
function stop(){ if(R){ clearInterval(R.tick); try{ R.ac && R.ac.close && R.ac.close(); }catch(e){} } R = null; }
function finish(){
  const sc = D.getElementById("sheet-content"); const onDone = R && R.onDone; const n = R ? R.list.length : 0, s = R ? totalSec(R.list) : 0;
  stop();
  if(!sc) return;
  sc.querySelector(".stx-play").innerHTML = `<div class="stx-end"><span class="material-symbols-rounded">self_improvement</span><b>Xong giãn cơ!</b>
    <p class="small-note">${n} động tác · ${mmss(s)}. Uống nước và nghỉ ngơi tốt nhé.</p>
    <button type="button" class="btn btn-primary btn-block" data-stx="close">Xong</button></div>`;
  try{ const st = typeof state !== "undefined" ? state : null; if(st){ st.stretchLog = Array.isArray(st.stretchLog) ? st.stretchLog.slice(-60) : []; st.stretchLog.push({ ts: Date.now(), n, sec: s }); if(typeof saveState === "function") saveState(); } }catch(e){}
  R = { onDone, done: true };
}
function open(groups, opts){
  opts = opts || {};
  if(typeof openSheet !== "function") return;
  stop();
  const P = plan(groups);
  const label = groups && groups.length ? groups.slice(0, 4).join(", ") + (groups.length > 4 ? "…" : "") : "toàn thân";
  openSheet(`<div class="sheet-header"><h3>Giãn cơ ${Math.round(P.sec / 60)} phút</h3><button class="icon-btn" data-stx="close" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <div class="stx-play">
      <p class="small-note">Cho: <b>${esc(label)}</b> · ${P.list.length} động tác, giữ ${HOLD} giây (bài 2 bên: mỗi bên ${HOLD} giây).</p>
      <ol class="stx-list">${P.list.map(x=> `<li><b>${esc(x.name)}</b><small>${esc(x.g.join(" · "))}${x.two ? " · 2 bên" : ""}</small></li>`).join("")}</ol>
      <button type="button" class="btn btn-primary btn-block" data-stx="start"><span class="material-symbols-rounded">play_arrow</span>Bắt đầu</button>
      <p class="small-note" style="margin-top:8px;">Giãn tĩnh hợp nhất sau buổi tập hoặc ngày nghỉ. Trước buổi tập nên khởi động động (xoay khớp, hiệp nhẹ) thay vì giữ lâu.</p>
    </div>`);
  CUR = { P, opts };
}
let CUR = null;
if(D && D.addEventListener) D.addEventListener("click", e=>{
    const b = e.target && e.target.closest ? e.target.closest("#sheet-content [data-stx]") : null; if(!b || !CUR) return;
    const P = CUR.P, opts = CUR.opts;
    const k = b.dataset.stx;
    if(k === "close"){ const cb = (R && R.onDone) || opts.onDone; stop(); CUR = null; if(cb) cb(); else if(typeof closeSheet === "function") closeSheet(); return; }
    if(k === "start"){ R = { list: P.list, i: 0, side: 1, onDone: opts.onDone }; beep(true); go(0, 1); R.tick = setInterval(tick, 250); return; }
    if(!R || R.done) return;
    if(k === "pause"){ if(R.paused){ R.paused = false; R.end = Date.now() + R.left * 1000; } else { R.paused = true; R.left = Math.max(0, (R.end - Date.now()) / 1000); } render(); return; }
    if(k === "next"){ advance(); return; }
    if(k === "prev"){ if(R.side === 2) { R.side = 1; R.end = Date.now() + HOLD * 1000; render(); } else go(R.i - 1, 1); }
});

/* ---------------------------------------------------------------------
   LỐI VÀO
   --------------------------------------------------------------------- */
function lastGroups(){
  try{
    const T = G.FKTP; const L = T && T.store ? T.store().log : []; const e = L[L.length - 1];
    if(!e || !(Date.now() - (e.endedAt || 0) < 6 * 3600000)) return [];
    return (T.muscleSets(e) || []).map(r=> r[0]).slice(0, 5);
  }catch(e){ return []; }
}
function decorateFinish(){
  const sc = D && D.getElementById("sheet-content"); if(!sc) return;
  const fin = sc.querySelector(".tp-fin"); if(!fin || fin.querySelector("[data-stx-open]")) return;
  const html = `<button type="button" class="btn btn-soft btn-block stx-open" data-stx-open="fin"><span class="material-symbols-rounded">self_improvement</span>Giãn cơ 5 phút cho nhóm vừa tập</button>`;
  const share = fin.querySelector("#tp-share-open"); if(share) share.insertAdjacentHTML("afterend", html); else fin.insertAdjacentHTML("beforeend", html);
}
function decorateRest(){
  const tc = D && D.getElementById("today-card"); if(!tc || tc.querySelector("[data-stx-open]")) return;
  if(tc.querySelector("#btn-start-session")) return;           // chỉ thẻ ngày nghỉ
  tc.insertAdjacentHTML("beforeend", `<button type="button" class="btn btn-soft btn-block stx-open" data-stx-open="rest" style="margin-top:12px;"><span class="material-symbols-rounded">self_improvement</span>Giãn cơ toàn thân 6 phút</button>`);
}
function decorateRecovery(){
  const sc = D && D.getElementById("sheet-content"); if(!sc) return;
  const big = sc.querySelector(".rcv-list"); if(!big || sc.querySelector("[data-stx-open]")) return;
  big.insertAdjacentHTML("afterend", `<button type="button" class="btn btn-soft btn-block stx-open" data-stx-open="rcv" style="margin-top:12px;"><span class="material-symbols-rounded">self_improvement</span>Giãn cơ cho nhóm đang mỏi</button>`);
}
if(D && D.addEventListener){
  D.addEventListener("click", e=>{
    const b = e.target && e.target.closest ? e.target.closest("[data-stx-open]") : null; if(!b) return;
    const k = b.dataset.stxOpen;
    if(k === "fin"){
      const T = G.FKTP, L = T && T.store ? T.store().log : [], last = L[L.length - 1];
      open(lastGroups(), { onDone: last && T.reopenFinish ? ()=> T.reopenFinish(last, last) : null });
    }else if(k === "rcv"){
      let gs = [];
      try{ const R2 = G.FKRecovery.compute(G.FKTP.store().log, Date.now()); gs = Object.keys(R2.groups).filter(g=> R2.groups[g].f >= 0.25).sort((a, b)=> R2.groups[b].f - R2.groups[a].f); }catch(err){}
      open(gs, { onDone: ()=>{ try{ G.FKRecovery.open(); }catch(err){} } });
    }else open([], {});
  });
  const obs = ()=>{
    const sc = D.getElementById("sheet-content"); if(!sc || !G.MutationObserver) return false;
    new MutationObserver(()=>{ try{ decorateFinish(); decorateRecovery(); }catch(e){} }).observe(sc, { childList: true, subtree: false });
    return true;
  };
  if(!obs()) D.addEventListener("DOMContentLoaded", obs, { once: true });
}
function install(){
  if(typeof renderWorkoutScreen !== "function" || renderWorkoutScreen.__stx) return;
  const f = renderWorkoutScreen;
  renderWorkoutScreen = function(){ const o = f.apply(this, arguments); try{ decorateRest(); }catch(e){} return o; };
  renderWorkoutScreen.__stx = true;
}
install(); if(D) D.addEventListener("DOMContentLoaded", install, { once: true });
G.FKStretch = { LIB, pick, plan, open, totalSec, HOLD, _decorateFinish: decorateFinish };
})(typeof window !== "undefined" ? window : globalThis);

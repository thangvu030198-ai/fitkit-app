/* session-plus.js — 16/11: nâng cấp màn GHI BUỔI TẬP (bọc renderSessionStep, nạp SAU training-pro.js).
   1. Loại hiệp: chạm số hiệp → Khởi động (W) · Thường · Drop set (D) · Tới hạn (F) · Xoá hiệp.
      Hiệp khởi động không tính kỷ lục / khối lượng / tự tăng tạ; drop set không nghỉ; tới hạn = RPE 10.
   2. "Lần trước" theo TỪNG hiệp (chạm để chép) + chênh lệch so với lần trước ngay khi gõ.
   3. Thêm / xoá hiệp giữa buổi.
   4. Báo kỷ lục NGAY khi bấm ✓ (không đợi lưu bài).
   5. Dải bài tập: thấy cả buổi, chạm để tập bài khác trước; "Để cuối buổi" khi máy đang bận.
   6. Ghi chú dính theo bài (nấc ghế, tay nắm…) — hiện lại mọi buổi sau.
   7. Thanh số liệu trực tiếp: thời gian · số hiệp · khối lượng.
   8. Thêm bài (thư viện lõi / 800+ bài) và đổi dụng cụ NGAY GIỮA BUỔI — không phải thoát ra sửa giáo án.
   9. Màn superset / circuit cũng có loại hiệp, "lần trước" từng hiệp và kỷ lục tức thì.
   Không phụ thuộc mạng; dữ liệu nằm trong state (đồng bộ theo tài khoản như phần còn lại). */
(function(G){
"use strict";
const TYPES = { "": { s: "", n: "Hiệp thường", d: "Tính đầy đủ" },
  w: { s: "W", n: "Khởi động", d: "Không tính kỷ lục, khối lượng, tăng tạ" },
  d: { s: "D", n: "Drop set", d: "Hạ tạ làm tiếp ngay — không nghỉ" },
  f: { s: "F", n: "Tới hạn", d: "Làm hết sức — ghi RPE 10" } };
const MAX = 20;
const num = v => { const n = Number(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const tOf = r => (r && (r.type === "w" || r.type === "d" || r.type === "f")) ? r.type : "";
const esc = s => (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";"));
const kgTxt = n => (typeof fmtKg === "function" ? fmtKg(n) : String(Math.round(num(n) * 100) / 100));
const epley = (kg, reps) => { kg = num(kg); reps = Math.min(12, num(reps)); return kg > 0 && reps > 0 ? kg * (1 + reps / 30) : 0; };

/* ---------- hàm thuần (có kiểm thử) ---------- */
/* Nhãn ô số hiệp: hiệp khởi động / drop hiện chữ, hiệp chính đánh số riêng (không đếm khởi động). */
function label(rows, i){
  const t = tOf(rows[i]);
  if(t === "w" || t === "d") return TYPES[t].s;
  let n = 0; for(let j = 0; j <= i; j++){ const x = tOf(rows[j]); if(x !== "w" && x !== "d") n++; }
  return t === "f" ? n + "F" : String(n);
}
/* Giá trị lần trước cho ĐÚNG hiệp tương ứng (cùng loại, cùng thứ tự trong loại). */
function prevFor(last, rows, i){
  if(!last || !rows || !rows[i]) return null;
  const t = tOf(rows[i]), cls = x => (x === "w" || x === "d") ? x : "m";
  const c = cls(t); let k = -1;
  for(let j = 0; j <= i; j++) if(cls(tOf(rows[j])) === c) k++;
  let src;
  if(c === "m") src = Array.isArray(last.sets) ? last.sets : [];
  else src = (Array.isArray(last.all) ? last.all : []).filter(x => x && x.t === c);
  const p = src[k]; if(!p) return null;
  const kg = num(p.kg), reps = num(p.reps);
  return (kg > 0 || reps > 0) ? { kg, reps } : null;
}
/* Buổi trước có khởi động / drop → dựng lại đúng cấu trúc cho buổi này. */
function rebuild(rows, last){
  if(!Array.isArray(rows) || !last || !Array.isArray(last.all) || rows.some(r => tOf(r))) return false;
  const mk = (x, t) => ({ kg: num(x.kg) > 0 ? num(x.kg) : "", reps: num(x.reps) > 0 ? num(x.reps) : "", rpe: "", done: false, type: t, _edited: true });
  const w = last.all.filter(x => x && x.t === "w").map(x => mk(x, "w"));
  const d = last.all.filter(x => x && x.t === "d").map(x => mk(x, "d"));
  if(!w.length && !d.length) return false;
  const room = Math.max(0, MAX - rows.length);
  const w2 = w.slice(0, room), d2 = d.slice(0, Math.max(0, room - w2.length));
  rows.unshift(...w2); rows.push(...d2);
  return w2.length + d2.length > 0;
}
/* Kỷ lục e1RM ngay tại hiệp: so với mọi buổi đã lưu + mức đã báo trong buổi này. */
function prCheck(hist, kg, reps, shown){
  const list = hist && Array.isArray(hist.list) ? hist.list : [];
  const best = Math.max(0, ...list.map(x => num(x && x.e1rm)));
  const e = epley(kg, reps);
  if(!(best > 0) || !(e > best + 0.4) || !(e > num(shown) + 0.4)) return 0;
  return Math.round(e * 10) / 10;
}
function moveItem(items, from, to){
  if(!Array.isArray(items) || from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return false;
  items.splice(to, 0, items.splice(from, 1)[0]); return true;
}
function stats(s){
  let sets = 0, vol = 0;
  const all = (s && s.sets) || {};
  Object.keys(all).forEach(k => (all[k] || []).forEach(r => { if(r && r.done && tOf(r) !== "w"){ sets++; vol += num(r.kg) * num(r.reps); } }));
  return { sets, vol: Math.round(vol) };
}
function addRow(rows){
  if(!Array.isArray(rows) || rows.length >= MAX) return false;
  const src = rows.slice().reverse().find(r => tOf(r) !== "w") || rows[rows.length - 1] || {};
  rows.push({ kg: src.kg == null ? "" : src.kg, reps: src.reps == null ? "" : src.reps, rpe: "", done: false, _edited: true });
  return true;
}
function delta(prev, kg, reps){
  if(!prev) return "";
  kg = num(kg); reps = num(reps);
  if(!(reps > 0)) return "";
  const dk = Math.round((kg - prev.kg) * 100) / 100, dr = reps - prev.reps;
  if(dk > 0) return "+" + kgTxt(dk) + " kg";
  if(dk === 0 && dr > 0) return "+" + dr + " lần";
  if(dk === 0 && dr === 0) return "=";
  if(dk < 0) return "−" + kgTxt(-dk) + " kg";
  return "−" + (-dr) + " lần";
}

/* ---------- giao diện ---------- */
const CSS = `
.sp-strip{ display:flex; gap:6px; overflow-x:auto; margin:0 -4px 10px; padding:2px 4px 6px; scrollbar-width:none; -webkit-overflow-scrolling:touch; }
.sp-strip::-webkit-scrollbar{ display:none; }
.sp-chip{ flex:0 0 auto; max-width:150px; display:flex; align-items:center; gap:5px; padding:7px 11px; border-radius:999px; font:600 12px/1.1 inherit; color:inherit;
  background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); white-space:nowrap; }
.sp-chip span.t{ overflow:hidden; text-overflow:ellipsis; }
.sp-chip i{ font-style:normal; opacity:.6; }
.sp-chip.cur{ background:var(--primary,#5EE6C7); color:var(--navy,#061A24); border-color:transparent; }
.sp-chip.ok{ opacity:.5; }
.sp-chip .material-symbols-rounded{ font-size:14px; }
.sp-stats{ display:flex; gap:14px; justify-content:center; font-size:12.5px; font-weight:600; opacity:.85; margin:-4px 0 10px; font-variant-numeric:tabular-nums; }
.sp-stats span{ display:inline-flex; align-items:center; gap:4px; } .sp-stats .material-symbols-rounded{ font-size:15px; opacity:.7; }
.sp-note{ width:100%; height:38px; margin:2px 0 10px; padding:0 12px; border-radius:12px; border:1px dashed rgba(255,255,255,.22); background:transparent; color:inherit; font:500 13.5px/1 inherit; }
.sp-note:focus{ outline:none; border-style:solid; border-color:var(--primary,#5EE6C7); }
.set-row b.sp-badge{ cursor:pointer; height:36px; line-height:36px; border-radius:10px; background:rgba(255,255,255,.08); user-select:none; -webkit-user-select:none; transition:transform .12s; }
.set-row b.sp-badge:active{ transform:scale(.92); }
.set-row[data-sp-t="w"] b.sp-badge{ background:rgba(255,196,76,.2); color:#FFC44C; }
.set-row[data-sp-t="d"] b.sp-badge{ background:rgba(122,162,255,.22); color:#9DB8FF; }
.set-row[data-sp-t="f"] b.sp-badge{ background:rgba(255,107,107,.2); color:#FF8A8A; }
.set-row[data-sp-t="w"]{ opacity:.82; }
.set-row[data-sp-t="d"]{ margin-left:14px; }
.set-row.sp-pr{ box-shadow:0 0 0 2px #FFC44C inset; animation:spPr .7s ease; }
@keyframes spPr{ 0%{ transform:scale(1); } 35%{ transform:scale(1.025); } 100%{ transform:scale(1); } }
.sp-prev{ display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; margin:-3px 0 2px 48px; font-size:12px; min-height:20px; }
.sp-prev button{ background:none; border:0; padding:2px 0; color:inherit; opacity:.62; font:inherit; display:inline-flex; align-items:center; gap:3px; }
.sp-prev button .material-symbols-rounded{ font-size:13px; } .sp-prev button, .sp-prev em{ white-space:nowrap; }
.sp-prev em{ font-style:normal; font-weight:700; padding:1px 7px; border-radius:999px; background:rgba(255,255,255,.08); }
.sp-prev em.up{ background:rgba(94,230,199,.2); color:var(--mint,#5EE6C7); } .sp-prev em.dn{ background:rgba(255,107,107,.16); color:#FF8A8A; }
.sp-prev em.pr{ background:rgba(255,196,76,.22); color:#FFC44C; }
.sp-menu{ display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:8px; margin:0 0 4px; border-radius:14px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.12); animation:spIn .16s ease; }
@keyframes spIn{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
.sp-menu button{ text-align:left; padding:9px 10px; border-radius:11px; border:1px solid transparent; background:rgba(255,255,255,.06); color:inherit; font:inherit; }
.sp-menu button b{ display:block; font-size:13.5px; } .sp-menu button small{ display:block; font-size:11px; opacity:.65; margin-top:2px; line-height:1.25; }
.sp-menu button.on{ border-color:var(--primary,#5EE6C7); }
.sp-menu button.del{ grid-column:1 / -1; text-align:center; color:#FF8A8A; }
.sp-add{ width:100%; margin-top:6px; height:40px; border-radius:12px; border:1px dashed rgba(255,255,255,.25); background:transparent; color:inherit; font:600 13.5px/1 inherit; display:flex; align-items:center; justify-content:center; gap:6px; }
.sp-add .material-symbols-rounded{ font-size:18px; }
.sp-acts{ display:flex; gap:8px; margin:0 0 10px; }
.sp-acts button{ flex:1; height:38px; border-radius:12px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.05); color:inherit; font:600 13px/1 inherit; display:flex; align-items:center; justify-content:center; gap:6px; }
.sp-acts button .material-symbols-rounded{ font-size:17px; }
.sp-acts + .fk-eq{ margin-top:0; margin-bottom:12px; }
.sp-toplan{ display:flex; gap:8px; align-items:flex-start; font-size:13px; cursor:pointer; } .sp-toplan input{ width:20px; height:20px; flex:0 0 20px; }
.tp-ss-ex .sp-prev{ margin-left:42px; }
.sp-hint{ font-size:12px; opacity:.6; margin-top:6px; text-align:center; }
@media (prefers-reduced-motion:reduce){ .set-row.sp-pr, .sp-menu{ animation:none; } }
html[data-theme="light"] .sp-chip, body.light .sp-chip{ background:rgba(6,26,36,.06); border-color:rgba(6,26,36,.12); }
html[data-theme="light"] .sp-note, body.light .sp-note{ border-color:rgba(6,26,36,.25); }
html[data-theme="light"] .sp-menu, body.light .sp-menu{ background:rgba(6,26,36,.05); border-color:rgba(6,26,36,.12); }
html[data-theme="light"] .sp-menu button, body.light .sp-menu button{ background:rgba(6,26,36,.05); }
html[data-theme="light"] .sp-add, body.light .sp-add{ border-color:rgba(6,26,36,.28); }
html[data-theme="light"] .set-row b.sp-badge, body.light .set-row b.sp-badge{ background:rgba(6,26,36,.07); }
`;
function css(){ if(document.getElementById("sp-css")) return; const st = document.createElement("style"); st.id = "sp-css"; st.textContent = CSS; document.head.appendChild(st); }
const S = () => { try{ return typeof session !== "undefined" ? session : null; }catch(e){ return null; } };
const ST = () => { try{ return typeof state !== "undefined" ? state : null; }catch(e){ return null; } };
const save = () => { try{ if(typeof saveState === "function") saveState(); }catch(e){} };
const say = (m, i) => { try{ if(typeof toast === "function") toast(m, i); }catch(e){} };
const fmtTime = ms => { const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
const grouped = (s, it) => !!(s && s._tp && s._tp.groupOf && s._tp.groupOf[it.uid] !== undefined);
let tick = 0;

function rerender(){
  const sc = document.getElementById("sheet-content"), par = sc && sc.parentElement;
  const a = sc ? sc.scrollTop : 0, b = par ? par.scrollTop : 0;
  renderSessionStep();
  const sc2 = document.getElementById("sheet-content");
  if(sc2){ sc2.scrollTop = a; if(sc2.parentElement) sc2.parentElement.scrollTop = b; }
  try{ if(G._restEnd){ const box = document.getElementById("set-rest"); if(box) box.hidden = false; if(typeof fkRestSync === "function") fkRestSync(); } }catch(e){}
}

/* ---------- dải bài tập + số liệu trực tiếp (dùng chung cho bài đơn và superset) ---------- */
function topBar(s, sc, item){
  const head = sc.querySelector(".progress-row");
  const gset = s._tp && s._tp.groupOf && s._tp.groupOf[item.uid] !== undefined ? (s._tp.groups[s._tp.groupOf[item.uid]] || []) : [];
  const strip = document.createElement("div"); strip.className = "sp-strip"; strip.setAttribute("role", "list"); strip.setAttribute("aria-label", "Các bài trong buổi");
  strip.innerHTML = s.items.map((it, j) => {
    const cur = j === s.idx || (j > s.idx && gset.indexOf(it.uid) >= 0), done = !cur && j < s.idx, skipped = done && s.completed.indexOf(it.uid) < 0;
    const nm = getExerciseMeta(it).name || "Bài " + (j + 1);
    return `<button type="button" role="listitem" class="sp-chip ${cur ? "cur" : done ? "ok" : ""}" data-sp-jump="${j}" ${done || cur ? "disabled" : ""} aria-label="${esc(nm)}${cur ? " — đang tập" : done ? (skipped ? " — đã bỏ qua" : " — đã xong") : " — chạm để tập trước"}">${done ? `<span class="material-symbols-rounded">${skipped ? "remove" : "check"}</span>` : `<i>${j + 1}</i>`}<span class="t">${esc(nm)}</span></button>`;
  }).join("");
  const stat = document.createElement("div"); stat.className = "sp-stats"; stat.setAttribute("aria-live", "off");
  const paintStats = () => { const x = stats(s); stat.innerHTML = `${sc.querySelector(".tp-sbar") ? "" : `<span><span class="material-symbols-rounded">timer</span><b data-sp-time>${fmtTime(Date.now() - (s.startedAt || Date.now()))}</b></span>`}<span><span class="material-symbols-rounded">done_all</span>${x.sets} hiệp</span><span><span class="material-symbols-rounded">weight</span>${typeof fmtVN === "function" ? fmtVN(x.vol) : x.vol} kg</span>`; };
  paintStats();
  if(head && head.parentNode){ head.parentNode.insertBefore(strip, head); const tr = sc.querySelector(".progress-track"); (tr || head).insertAdjacentElement("afterend", stat); }
  const curChip = strip.querySelector(".cur"); if(curChip) try{ strip.scrollLeft = Math.max(0, curChip.offsetLeft - 60); }catch(e){}
  clearInterval(tick);
  tick = setInterval(() => { const el = document.querySelector("#sheet-content [data-sp-time]"); const ss = S(); if(!el || !ss || ss.finished){ clearInterval(tick); return; } el.textContent = fmtTime(Date.now() - (ss.startedAt || Date.now())); }, 1000);
  strip.addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("[data-sp-jump]") : null; if(!b || b.disabled) return;
    const j = Number(b.dataset.spJump), it = s.items[j];
    if(!(j > s.idx) || !it) return;
    if(grouped(s, it) || grouped(s, item)){ say("Bài nằm trong superset — tập theo thứ tự nhóm nhé", "info"); return; }
    try{ stopSetRest(); }catch(e2){}
    moveItem(s.items, j, s.idx);
    say("Tập trước: " + (getExerciseMeta(it).name || ""), "swap_vert");
    renderSessionStep();
  });
  return { stat, paintStats };
}

/* ---------- hàng hiệp: loại hiệp · lần trước · kỷ lục tức thì (bài đơn + superset) ---------- */
function rowsUI(o){
  const { s, st, sc, scope, rows, last, timed, key, meta } = o;
  const paint = () => {
    rows.forEach((r, i) => {
      const el = o.rowEl(i); if(!el) return;
      const t = tOf(r); el.dataset.spT = t;
      const b = el.querySelector("b");
      if(b){ if(b.dataset.spSfx === undefined) b.dataset.spSfx = /\+\s*$/.test(b.textContent) ? "+" : "";
        b.textContent = label(rows, i) + b.dataset.spSfx; b.className = "sp-badge"; b.setAttribute("role", "button"); b.tabIndex = 0; b.dataset.spI = i;
        b.setAttribute("aria-label", "Hiệp " + (i + 1) + " — " + TYPES[t].n + ". Chạm để đổi loại hiệp"); }
      if(timed) return;
      let line = el.nextElementSibling; if(!line || !line.classList.contains("sp-prev")){ line = document.createElement("div"); line.className = "sp-prev"; el.insertAdjacentElement("afterend", line); }
      const p = prevFor(last, rows, i);
      const d = p ? delta(p, r.kg, r.reps) : "";
      const cls = d.charAt(0) === "+" ? "up" : d.charAt(0) === "−" ? "dn" : "";
      line.innerHTML = (p ? `<button type="button" data-sp-copy="${i}" aria-label="Chép kết quả lần trước vào hiệp ${i + 1}"><span class="material-symbols-rounded">history</span>Lần trước ${p.kg > 0 ? kgTxt(p.kg) + " kg × " : ""}${p.reps}</button>` : "")
        + (d && r.done && t !== "w" ? `<em class="${cls}">${d === "=" ? "bằng lần trước" : d}</em>` : "")
        + (r._pr ? `<em class="pr">🏆 Kỷ lục</em>` : "");
      line.hidden = !line.innerHTML;
    });
  };
  paint();
  const closeMenu = () => { const m = scope.querySelector(".sp-menu"); if(m) m.remove(); };
  const openMenu = i => {
    const had = scope.querySelector(`.sp-menu[data-i="${i}"]`); closeMenu(); if(had) return;
    const el = o.rowEl(i); if(!el) return;
    const cur = tOf(rows[i]);
    const m = document.createElement("div"); m.className = "sp-menu"; m.dataset.i = i; m.setAttribute("role", "menu");
    m.innerHTML = (timed ? [] : o.types).map(t => `<button type="button" role="menuitemradio" aria-checked="${cur === t}" class="${cur === t ? "on" : ""}" data-sp-type="${t}"><b>${TYPES[t].s ? TYPES[t].s + " · " : ""}${TYPES[t].n}</b><small>${TYPES[t].d}</small></button>`).join("")
      + (o.allowDel && rows.length > 1 ? `<button type="button" role="menuitem" class="del" data-sp-del="1"><b>Xoá hiệp này</b></button>` : "");
    if(!m.innerHTML) return;
    const after = el.nextElementSibling && el.nextElementSibling.classList.contains("sp-prev") ? el.nextElementSibling : el;
    after.insertAdjacentElement("afterend", m);
    m.addEventListener("click", e => {
      const b = e.target.closest ? e.target.closest("button") : null; if(!b) return;
      if(b.dataset.spDel){ rows.splice(i, 1); rerender(); return; }
      const t = b.dataset.spType;
      if(t) rows[i].type = t; else delete rows[i].type;
      if(t === "f" && !rows[i].rpe){ rows[i].rpe = "10"; const sel = el.querySelector("select.rpe"); if(sel) sel.value = "10"; }
      if(!st.spHintDone){ st.spHintDone = 1; const h = sc.querySelector(".sp-hint"); if(h) h.remove(); }
      closeMenu(); paint(); if(o.onChange) o.onChange();
    });
  };
  scope.addEventListener("click", e => {
    const t = e.target; if(!t || !t.closest) return;
    const badge = t.closest("b.sp-badge");
    if(badge){ openMenu(Number(badge.dataset.spI)); return; }
    const cp = t.closest("[data-sp-copy]");
    if(cp){
      const i = Number(cp.dataset.spCopy), r = rows[i], p = prevFor(last, rows, i); if(!r || !p) return;
      if(r.done){ say("Hiệp đã ✓ — bỏ ✓ nếu muốn sửa", "info"); return; }
      const el = o.rowEl(i), k = el.querySelector(o.kgSel), rp = el.querySelector(o.repsSel);
      if(p.kg > 0){ r.kg = p.kg; if(k) k.value = p.kg; } r.reps = p.reps; if(rp) rp.value = p.reps; r._edited = true; r._repsEdited = true;
      paint();
    }
  });
  scope.addEventListener("keydown", e => { if((e.key === "Enter" || e.key === " ") && e.target && e.target.classList && e.target.classList.contains("sp-badge")){ e.preventDefault(); openMenu(Number(e.target.dataset.spI)); } });
  scope.addEventListener("change", () => setTimeout(paint, 0));
  /* ✓: kỷ lục ngay tại hiệp · drop set không nghỉ */
  o.doneBtns.forEach(([btn, i]) => btn.addEventListener("click", () => {
    const r = rows[i]; if(!r) return;
    if(r.done){
      const nx = rows[i + 1];
      if(o.allowDel && nx && tOf(nx) === "d"){ try{ stopSetRest(); }catch(e){} say("Drop set — hạ tạ, làm tiếp ngay!", "bolt"); }
      if(!timed && tOf(r) !== "w" && s.isToday){
        s._livePr = s._livePr || {};
        const e = prCheck((st.setHist || {})[key], r.kg, r.reps, s._livePr[key]);
        if(e){
          s._livePr[key] = e; rows.forEach(x => { delete x._pr; }); r._pr = 1;
          const el = o.rowEl(i); if(el){ el.classList.remove("sp-pr"); void el.offsetWidth; el.classList.add("sp-pr"); }
          say(`🏆 Kỷ lục mới ngay hiệp này: ${meta.name} ~${Math.round(e)} kg`, "military_tech");
          try{ if(navigator.vibrate) navigator.vibrate([30, 40, 60]); }catch(e2){}
        }
      }
    } else if(r._pr){ delete r._pr; }
    paint(); if(o.onChange) o.onChange();
  }));
}

/* ---------- thêm bài / đổi dụng cụ ngay giữa buổi ---------- */
/* Vị trí chèn bài mới: ngay sau bài đang tập (đang ở superset → sau bài cuối của nhóm, không cắt ngang nhóm). */
function insertPos(s){
  const it = s.items[s.idx]; let pos = s.idx;
  if(it && grouped(s, it)){ const g = s._tp.groups[s._tp.groupOf[it.uid]] || []; s.items.forEach((x, j) => { if(g.indexOf(x.uid) >= 0 && j > pos) pos = j; }); }
  return Math.min(s.items.length, pos + 1);
}
function newItem(src){
  const id = typeof uid === "function" ? uid() : String(Date.now()) + Math.random().toString(36).slice(2, 7);
  const sets = Math.min(MAX, Math.max(1, Math.round(num(src.sets)) || 3)), rest = Math.min(900, Math.max(0, Math.round(num(src.restSec)) || 60));
  if(src.exerciseId) return { uid: src.exerciseId + "_" + id, exerciseId: src.exerciseId, custom: null, sets, reps: src.reps || "10-12", restSec: rest, clipId: null };
  return { uid: id, exerciseId: null, custom: { name: String(src.name || "Bài tập").slice(0, 60), muscle: src.muscle || "", equipment: src.equipment || "", guide: src.guide || "", img: src.img || "", exDbId: src.exDbId }, sets, reps: src.reps || "10-12", restSec: rest, clipId: null };
}
function addToSession(s, srcs, toPlan){
  const st = ST(); let pos = insertPos(s); const made = [];
  srcs.forEach(src => { const it = newItem(src); s.items.splice(pos++, 0, it); made.push(it); });
  if(toPlan){ try{ const plan = getActivePlan(), day = plan && plan.days && plan.days[s.dayKey]; if(day && Array.isArray(day.items)) made.forEach(it => day.items.push(it)); }catch(e){} }
  if(st){ st.spAddToPlan = toPlan ? 1 : 0; } save();
  return made;
}
function openAddSheet(s, st, cur){
  const curMuscle = String((getExerciseMeta(cur) || {}).muscle || "");
  const lib = (typeof EXERCISES !== "undefined" && EXERCISES) || {};
  const norm = x => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  const inSession = new Set(s.items.map(it => it.exerciseId).filter(Boolean));
  const all = Object.keys(lib).map(id => ({ id, ex: lib[id], same: curMuscle && lib[id].muscle === curMuscle ? 0 : 1 })).sort((a, b) => a.same - b.same);
  openSheet(`
    <div class="sheet-header"><h3>Thêm bài vào buổi này</h3><button type="button" class="icon-btn" id="sp-add-back" aria-label="Quay lại buổi tập"><span class="material-symbols-rounded">arrow_back</span></button></div>
    <p class="small-note" style="margin:-4px 0 10px;">Bài mới sẽ nằm ngay sau bài bạn đang tập.</p>
    <label class="sp-toplan"><input type="checkbox" id="sp-add-plan" ${st.spAddToPlan ? "checked" : ""}> <span>Lưu luôn vào giáo án của ngày này (các tuần sau cũng có)</span></label>
    <div class="search-box" style="margin:10px 0;"><span class="material-symbols-rounded" style="color:var(--text-dim);">search</span><input type="text" id="sp-add-q" placeholder="Tìm bài — VD: đẩy ngực, kéo xà…" autocomplete="off"></div>
    ${typeof openExDbPicker === "function" ? `<button type="button" class="btn btn-ghost btn-block btn-sm" id="sp-add-exdb" style="margin-bottom:10px;"><span class="material-symbols-rounded">library_books</span>Tìm trong thư viện 800+ bài</button>` : ""}
    <div id="sp-add-list" style="max-height:46vh;overflow-y:auto;"></div>`);
  const sc = document.getElementById("sheet-content"), list = sc.querySelector("#sp-add-list");
  const toPlan = () => !!(sc.querySelector("#sp-add-plan") || {}).checked;
  const back = msg => { if(msg) say(msg, "add_circle"); renderSessionStep(); };
  const paint = q => {
    const nq = norm(q);
    const hit = all.filter(x => !nq || norm(x.ex.name).indexOf(nq) >= 0 || norm(x.ex.muscle).indexOf(nq) >= 0).slice(0, 60);
    list.innerHTML = hit.map(x => `<div class="food-result" role="button" tabindex="0" data-sp-pick="${esc(x.id)}" style="cursor:pointer;"><div><div class="name">${esc(x.ex.name)}${inSession.has(x.id) ? ` <small style="opacity:.6">· đã có trong buổi</small>` : ""}</div><div class="kcal">${esc(x.ex.muscle || "")}${!x.same && !nq ? " · cùng nhóm cơ đang tập" : ""}</div></div><span class="material-symbols-rounded" style="color:var(--text-dim);">add_circle</span></div>`).join("") || `<p class="empty-hint">Không thấy bài phù hợp — thử thư viện 800+ bài.</p>`;
  };
  paint("");
  sc.querySelector("#sp-add-q").addEventListener("input", e => paint(e.target.value));
  sc.querySelector("#sp-add-back").addEventListener("click", () => back());
  const pick = el => { const id = el.dataset.spPick, ex = lib[id]; if(!ex) return; addToSession(s, [{ exerciseId: id, sets: ex.sets, reps: ex.reps, restSec: ex.restSec }], toPlan()); back("Đã thêm: " + ex.name); };
  list.addEventListener("click", e => { const el = e.target.closest ? e.target.closest("[data-sp-pick]") : null; if(el) pick(el); });
  list.addEventListener("keydown", e => { if(e.key === "Enter" && e.target.dataset && e.target.dataset.spPick) pick(e.target); });
  const xb = sc.querySelector("#sp-add-exdb");
  if(xb) xb.addEventListener("click", () => {
    const plan = toPlan(); let picked = false;
    const pauseHook = typeof onSheetCloseHook === "function" ? onSheetCloseHook : null;
    /* thư viện 800+ tự đóng sheet khi chọn xong → hoãn "tạm dừng buổi" 1 nhịp; chọn được bài thì quay lại buổi tập luôn */
    const arm = () => { onSheetCloseHook = () => { setTimeout(() => { if(!picked && pauseHook) pauseHook(); }, 0); }; };
    try{
      openExDbPicker(items => { picked = true; const arr = Array.isArray(items) ? items : [items]; const made = addToSession(s, arr, plan); s.paused = false; back(made.length > 1 ? `Đã thêm ${made.length} bài` : "Đã thêm: " + ((arr[0] || {}).name || "bài mới")); }, { multi: true });
      arm();
    }catch(e){ back(); }
  });
}
function actsRow(s, st, sc, item, host, single){
  if(!host || sc.querySelector(".sp-acts")) return;
  const row = document.createElement("div"); row.className = "sp-acts";
  const fam = single && G.FKEquip && typeof G.FKEquip.familyOf === "function" ? G.FKEquip.familyOf(item) : null;
  row.innerHTML = (fam ? `<button type="button" data-sp-act="eq" aria-expanded="false"><span class="material-symbols-rounded">swap_horiz</span>Đổi dụng cụ</button>` : "")
    + `<button type="button" data-sp-act="add"><span class="material-symbols-rounded">add</span>Thêm bài</button>`;
  host.insertAdjacentElement("afterend", row);
  row.addEventListener("click", e => {
    const b = e.target.closest ? e.target.closest("[data-sp-act]") : null; if(!b) return;
    if(b.dataset.spAct === "add"){ try{ stopSetRest(); }catch(e2){} openAddSheet(s, st, item); return; }
    const old = document.getElementById("fk-eq");
    if(old){ old.remove(); b.setAttribute("aria-expanded", "false"); return; }
    let plan = null; try{ plan = getActivePlan(); }catch(e2){}
    const ok = G.FKEquip.mount({ plan, dayKey: s.dayKey, item, host: row, reopen: () => {
      const rows = s.sets && s.sets[item.uid];
      if(rows && !rows.some(r => r.done)){ delete s.sets[item.uid]; if(s._sp) delete s._sp[item.uid]; }   // chưa ghi hiệp nào → điền sẵn lại theo bài mới (mức tạ ghi riêng từng bài)
      renderSessionStep();
    } });
    b.setAttribute("aria-expanded", ok ? "true" : "false");
    if(!ok) say("Bài này chưa có lựa chọn dụng cụ khác", "info");
  });
}

/* ---------- màn superset / circuit của training-pro ---------- */
function enhanceGroup(s, st, sc){
  const item = s.items[s.idx]; if(!item || !grouped(s, item)) return;
  css();
  const uids = s._tp.groups[s._tp.groupOf[item.uid]] || [];
  const items = uids.map(u => s.items.find(it => it.uid === u)).filter(Boolean);
  const { stat, paintStats } = topBar(s, sc, item);
  sc.querySelectorAll("section.tp-ss-ex[data-k]").forEach(sec => {
    const k = Number(sec.dataset.k), it = items[k], rows = it && s.sets && s.sets[it.uid], table = sec.querySelector(".set-table");
    if(!it || !rows || !table) return;
    const key = exKey(it), meta = getExerciseMeta(it), timed = typeof isTimedReps === "function" && isTimedReps(it.reps);
    rowsUI({ s, st, sc, scope: table, rows, last: (st.setLog || {})[key], timed, key, meta, types: ["", "w", "f"], allowDel: false, onChange: paintStats,
      rowEl: i => table.querySelector(`[data-tp-row="${k}:${i}"]`), kgSel: "[data-tp-kg]", repsSel: "[data-tp-reps]",
      doneBtns: [...table.querySelectorAll("[data-tp-done]")].map(b => [b, Number(b.getAttribute("data-tp-done").split(":")[1])]) });
  });
  actsRow(s, st, sc, item, stat, false);
  /* 17/11: cấp "Mới tập" ẩn cột RPE — màn superset trước đây không có nút bật lại như màn bài đơn */
  try{
    const done = sc.querySelector("#tp-ss-done");
    if(done && !sc.querySelector("select.rpe") && !sc.querySelector("#set-show-rpe") && items.some(it=> !(typeof isTimedReps === "function" && isTimedReps(it.reps)))){
      const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-ghost btn-sm"; b.id = "set-show-rpe"; b.style.marginTop = "4px";
      b.textContent = "Hiện cột RPE (độ nặng cảm nhận)";
      b.addEventListener("click", ()=>{ st.profile.showRpe = true; save(); rerender(); });
      done.insertAdjacentElement("beforebegin", b);
    }
  }catch(e){}
}

function enhance(){
  const s = S(), st = ST(), sc = document.getElementById("sheet-content");
  if(!s || !st || !sc || s.finished || s.idx >= s.items.length) return;
  const table = sc.querySelector(".set-table");
  if(!table || sc.querySelector(".sp-strip")) return;   // không phải màn ghi hiệp / đã nâng cấp
  if(sc.querySelector("#tp-ss-done")){ enhanceGroup(s, st, sc); return; }
  if(!sc.querySelector("#btn-session-done")) return;
  css();
  const item = s.items[s.idx], rows = s.sets && s.sets[item.uid];
  if(!rows) return;
  const key = exKey(item), meta = getExerciseMeta(item);
  const last = (st.setLog || {})[key];
  const timed = typeof isTimedReps === "function" && isTimedReps(item.reps);

  /* buổi trước có khởi động / drop → dựng lại (1 lần cho mỗi bài) */
  s._sp = s._sp || {};
  if(!s._sp[item.uid]){
    s._sp[item.uid] = 1;
    if(!timed && rebuild(rows, last)){ rerender(); return; }
  }

  const { stat, paintStats } = topBar(s, sc, item);

  /* --- ghi chú dính theo bài --- */
  st.exNotes = (st.exNotes && typeof st.exNotes === "object") ? st.exNotes : {};
  const note = document.createElement("input");
  note.className = "sp-note"; note.type = "text"; note.maxLength = 160; note.autocomplete = "off";
  note.placeholder = "Ghi nhớ cho bài này: nấc ghế, tay nắm… (hiện lại mọi buổi)";
  note.setAttribute("aria-label", "Ghi chú cho bài này"); note.value = st.exNotes[key] || "";
  note.addEventListener("change", () => { const v = String(note.value || "").trim().slice(0, 160); if(v) st.exNotes[key] = v; else delete st.exNotes[key]; save(); });
  table.parentNode.insertBefore(note, sc.querySelector(".set-tools") || table);
  const lastLine = sc.querySelector(".set-last"); if(lastLine && !timed) lastLine.remove();   // đã có "Lần trước" theo từng hiệp

  rowsUI({ s, st, sc, scope: table, rows, last, timed, key, meta, types: ["", "w", "d", "f"], allowDel: true, onChange: paintStats,
    rowEl: i => table.querySelector(`.set-row[data-set="${i}"]`), kgSel: "[data-kg]", repsSel: "[data-reps]",
    doneBtns: [...table.querySelectorAll("[data-done]")].map(b => [b, Number(b.dataset.done)]) });
  actsRow(s, st, sc, item, sc.querySelector(".chip-row") || stat, true);

  /* --- thêm hiệp --- */
  if(rows.length < MAX){
    const add = document.createElement("button"); add.type = "button"; add.className = "sp-add";
    add.innerHTML = `<span class="material-symbols-rounded">add</span>Thêm hiệp`;
    add.addEventListener("click", () => { if(addRow(rows)) rerender(); });
    table.insertAdjacentElement("afterend", add);
    if(!st.spHintDone && !timed){ const h = document.createElement("p"); h.className = "sp-hint"; h.textContent = "Mẹo: chạm vào số hiệp để đánh dấu khởi động, drop set, tới hạn hoặc xoá hiệp."; add.insertAdjacentElement("afterend", h); }
  }

  /* --- để cuối buổi --- */
  const skip = sc.querySelector("#btn-session-skip");
  if(skip && s.idx < s.items.length - 1 && !grouped(s, item)){
    const later = document.createElement("button"); later.type = "button"; later.className = "btn btn-ghost btn-block"; later.id = "sp-later"; later.style.marginTop = "6px";
    later.innerHTML = `<span class="material-symbols-rounded">low_priority</span>Máy đang bận — để cuối buổi`;
    later.addEventListener("click", () => { try{ stopSetRest(); }catch(e){} moveItem(s.items, s.idx, s.items.length - 1); say("Đã chuyển bài xuống cuối buổi", "low_priority"); renderSessionStep(); });
    skip.insertAdjacentElement("beforebegin", later);
  }
}

function install(){
  if(typeof renderSessionStep !== "function" || install.done) return false;
  install.done = true;
  const _render = renderSessionStep;
  renderSessionStep = function(){
    const r = _render.apply(this, arguments);
    try{ enhance(); }catch(e){ try{ console.warn("[session-plus]", e); }catch(e2){} }
    return r;
  };
  return true;
}
G.FKSessionPlus = { insertPos, newItem, addToSession, TYPES, label, prevFor, rebuild, prCheck, moveItem, stats, addRow, delta, epley, install, enhance };
try{ if(typeof document !== "undefined") install(); }catch(e){}
})(typeof window !== "undefined" ? window : globalThis);

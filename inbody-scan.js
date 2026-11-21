/* =========================================================================
   TapEasy — CHỤP PHIẾU INBODY + THÀNH PHẦN CƠ THỂ (inbody-scan.js) · 19/11/2026
   Nạp SAU app.js. Bổ sung cho tab "Chỉ số InBody" ở màn Tiến độ (không thay phần cũ):
   1. Nút "Chụp phiếu InBody": chụp/chọn ảnh phiếu → AI CHÉP LẠI số in trên phiếu (Cloud Function analyzeInbodyReport,
      dự phòng khoá AI riêng của người dùng, bản demo: kết quả mẫu) → mở form "Thêm số liệu" đã điền sẵn, đánh dấu ô AI đọc
      và ô chưa đọc được → người dùng đối chiếu, sửa rồi mới lưu. App KHÔNG tự lưu.
   2. Form thêm số liệu có thêm 3 ô tuỳ chọn: Mỡ (kg), BMR (kcal), Điểm InBody.
   3. Thẻ "Thành phần cơ thể": so với lần đo trước (cơ ↑ tốt, mỡ ↓ tốt) + nhận xét ngắn + biểu đồ từng chỉ số.
   Ảnh phiếu không lưu trên máy chủ, không lưu trong app.
   4. (21/11) Chọn ảnh phiếu có sẵn trong thư viện: pick({ camera:false }) — không capture; pick({ camera:true }) mở camera.
      Ảnh HEIC (iPhone) không đọc được → báo cách xử lý (chụp trực tiếp / lưu JPG).
   5. (21/11) Thẻ "Thành phần cơ thể" trên Trang chủ (#home-content, data-home-zone="personal").
   API: window.FKInbody = { clean, compare, verdict, metricSeries, chartSVG, scan, pick, homeHTML, homeInject, openDetail, EXTRA }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKInbody) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));
const say = (m, k)=>{ try{ if(typeof toast === "function") toast(m, k); }catch(e){} };
const CL = ()=>{ try{ if(typeof cloud !== "undefined" && cloud) return cloud; }catch(e){} return G.cloud || null; };
const fin = v=> typeof v === "number" && Number.isFinite(v);
const r1 = n=> Math.round(n * 10) / 10;
const vn = n=> String(r1(n)).replace(".", ",");
const ST = ()=>{ try{ return typeof state !== "undefined" ? state : null; }catch(e){ return null; } };

/* ---------------------------------------------------------------------
   1. HÀM THUẦN
   --------------------------------------------------------------------- */
const FIELDS = { weight:[20, 350], smm:[5, 120], bfm:[1, 250], pbf:[3, 75], tbw:[10, 120], visceral:[1, 30], bmr:[600, 4500], score:[20, 120], bmi:[10, 80] };
/** chuẩn hoá kết quả AI (giống máy chủ — dùng cho đường khoá riêng / demo) */
function clean(raw, nowMs){
  const o = raw && typeof raw === "object" ? raw : {};
  const r = { is_report: o.is_report !== false, device: String(o.device == null ? "" : o.device).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 40), date: null,
    conf: fin(Number(o.conf)) ? Math.min(1, Math.max(0, Number(o.conf))) : 0.5, unreadable: [], simulated: o.simulated === true };
  Object.keys(FIELDS).forEach(k=>{ const [lo, hi] = FIELDS[k]; const n = Number(o[k]); r[k] = o[k] != null && o[k] !== "" && Number.isFinite(n) && n >= lo && n <= hi ? r1(n) : null; });
  if(r.smm != null && r.weight != null && r.smm >= r.weight) r.smm = null;
  if(r.bfm != null && r.weight != null && r.bfm >= r.weight) r.bfm = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(o.date || ""));
  if(m){ const d = Date.UTC(+m[1], +m[2] - 1, +m[3]); if(d > Date.UTC(2000, 0, 1) && d <= (nowMs || Date.now()) + 86400000) r.date = `${m[1]}-${m[2]}-${m[3]}`; }
  r.unreadable = (Array.isArray(o.unreadable) ? o.unreadable : []).map(x=> String(x)).filter(x=> Object.prototype.hasOwnProperty.call(FIELDS, x) || Object.prototype.hasOwnProperty.call(MORE, x)).slice(0, 12);
  if(r.weight == null && r.smm == null && r.pbf == null && r.bfm == null) r.is_report = false;
  /* 21/11/2026: chỉ số mở rộng + từng phần + đánh giá (hợp đồng analyzeInbodyReport mới) — thiếu/sai → null */
  Object.keys(MORE).forEach(k=>{ const [lo, hi, dp] = MORE[k]; r[k] = numR(o[k], lo, hi, dp); });
  if(r.ffm != null && r.weight != null && r.ffm >= r.weight) r.ffm = null;
  if(r.slm != null && r.weight != null && r.slm >= r.weight) r.slm = null;
  const seg = typeof fkInbodyCleanSeg === "function" ? fkInbodyCleanSeg : ()=> null;
  r.seg_lean = seg(o.seg_lean, 80, 400); r.seg_fat = seg(o.seg_fat, 80, 1000);
  r.eval = typeof fkInbodyCleanEval === "function" ? fkInbodyCleanEval(o.eval) : null;
  return r;
}
/* chỉ số mở rộng: [min, max, số lẻ] */
const MORE = { ffm:[10, 250, 1], slm:[10, 200, 1], protein:[2, 40, 1], minerals:[0.5, 15, 2], ecw_ratio:[0.3, 0.45, 3], smi:[3, 20, 1], whr:[0.5, 1.5, 2],
  obesity_degree:[50, 300, 0], target_weight:[20, 350, 1], weight_control:[-150, 150, 1], fat_control:[-150, 150, 1], muscle_control:[-50, 50, 1] };
function numR(v, lo, hi, dp){
  if(v == null || v === "" || typeof v === "boolean" || typeof v === "object") return null;
  const n = Number(v); if(!Number.isFinite(n) || n < lo || n > hi) return null;
  const k = Math.pow(10, dp == null ? 1 : dp); return Math.round(n * k) / k;
}
/* kết quả đọc phiếu (snake_case) → các trường mở rộng của bản ghi inbodyLogs (camelCase). formLog = bản ghi vừa lưu từ form:
   người dùng đã sửa cân/%mỡ/cơ khác số AI đọc > 0,3 → bỏ đánh giá AI (đánh giá dựa trên số cũ) — app tự đánh giá lại bằng luật. */
function scanToLog(res, formLog){
  if(!res || typeof res !== "object") return {};
  const f = formLog || {};
  const o = { scan: true, ffmKg: res.ffm, slmKg: res.slm, proteinKg: res.protein, mineralsKg: res.minerals, tbwL: res.tbw, ecwRatio: res.ecw_ratio, smi: res.smi, whr: res.whr,
    obesityDegree: res.obesity_degree, targetWeight: res.target_weight, weightControl: res.weight_control, fatControl: res.fat_control, muscleControl: res.muscle_control, bmi: res.bmi,
    segLean: res.seg_lean, segFat: res.seg_fat, eval: res.eval };
  const off = (a, b)=> a != null && b != null && fin(Number(a)) && fin(Number(b)) && Math.abs(Number(a) - Number(b)) > 0.3;
  if(off(res.weight, f.weight) || off(res.pbf, f.bodyFatPct) || off(res.smm, f.muscleMassKg)) delete o.eval;
  if(off(res.weight, f.weight)) delete o.tbwL;
  Object.keys(o).forEach(k=>{ if(o[k] == null) delete o[k]; });
  return o;
}
/** khối lượng mỡ (kg): có sẵn → dùng; không thì cân × % mỡ */
function fatKg(l){ if(!l) return null; if(fin(l.fatMassKg)) return l.fatMassKg; return fin(l.weight) && fin(l.bodyFatPct) ? r1(l.weight * l.bodyFatPct / 100) : null; }
const METRICS = [
  { k:"muscle", label:"Cơ xương", unit:"kg", good: +1, get: l=> fin(l.muscleMassKg) ? l.muscleMassKg : null },
  { k:"fat", label:"Mỡ", unit:"kg", good: -1, get: fatKg },
  { k:"pbf", label:"% mỡ", unit:"%", good: -1, get: l=> fin(l.bodyFatPct) ? l.bodyFatPct : null },
  { k:"weight", label:"Cân nặng", unit:"kg", good: 0, get: l=> fin(l.weight) ? l.weight : null },
  { k:"visceral", label:"Mỡ nội tạng", unit:"cấp", good: -1, get: l=> fin(l.visceralFat) ? l.visceralFat : null },
  { k:"bmr", label:"BMR", unit:"kcal", good: +1, get: l=> fin(l.bmr) ? l.bmr : null },
];
function sorted(logs){ return (Array.isArray(logs) ? logs : []).filter(l=> l && fin(Number(l.ts))).slice().sort((a, b)=> a.ts - b.ts); }
/** so sánh lần đo mới nhất với lần trước có cùng chỉ số */
function compare(logs){
  const L = sorted(logs); if(!L.length) return null;
  const last = L[L.length - 1];
  const rows = METRICS.map(m=>{
    const v = m.get(last); if(v == null) return null;
    let prev = null, prevTs = 0;
    for(let i = L.length - 2; i >= 0; i--){ const p = m.get(L[i]); if(p != null){ prev = p; prevTs = L[i].ts; break; } }
    const d = prev == null ? null : r1(v - prev);
    const tone = d == null || d === 0 || !m.good ? "flat" : (d * m.good > 0 ? "good" : "bad");
    return { k: m.k, label: m.label, unit: m.unit, v, prev, d, tone, prevTs };
  }).filter(Boolean);
  return { last, rows, n: L.length };
}
/** nhận xét 1 câu từ thay đổi cơ & mỡ */
function verdict(cmp){
  if(!cmp) return "";
  const g = k=> (cmp.rows.find(r=> r.k === k) || {}).d;
  const mu = g("muscle"), fa = g("fat");
  if(mu == null && fa == null) return cmp.n < 2 ? "Đo thêm lần nữa (cách 3–4 tuần, cùng giờ, trước khi ăn) để thấy thay đổi." : "";
  if(mu != null && fa != null){
    if(mu > 0 && fa < 0) return `Tăng ${vn(mu)} kg cơ và giảm ${vn(-fa)} kg mỡ — đang "recomp" rất tốt.`;
    if(mu > 0 && fa > 0) return mu >= fa ? `Tăng ${vn(mu)} kg cơ, mỡ tăng ít hơn (${vn(fa)} kg) — giai đoạn tăng cân sạch.` : `Mỡ tăng (${vn(fa)} kg) nhanh hơn cơ (${vn(mu)} kg) — cân nhắc giảm dư thừa calo.`;
    if(mu < 0 && fa < 0) return -mu <= -fa / 3 ? `Giảm ${vn(-fa)} kg mỡ mà gần như giữ được cơ — cắt mỡ đúng hướng.` : `Giảm cả cơ (${vn(-mu)} kg) lẫn mỡ — tăng đạm và giữ tạ nặng để bảo toàn cơ.`;
    if(mu < 0 && fa >= 0) return `Cơ giảm ${vn(-mu)} kg — kiểm tra lại lượng đạm, giấc ngủ và độ đều buổi tập.`;
    if(mu === 0 && fa < 0) return `Giảm ${vn(-fa)} kg mỡ, cơ giữ nguyên.`;
    if(mu >= 0 && fa === 0) return mu > 0 ? `Tăng ${vn(mu)} kg cơ, mỡ giữ nguyên.` : "Gần như không đổi so với lần trước.";
  }
  if(mu != null) return mu > 0 ? `Tăng ${vn(mu)} kg cơ so với lần trước.` : mu < 0 ? `Cơ giảm ${vn(-mu)} kg so với lần trước.` : "Cơ giữ nguyên.";
  return fa < 0 ? `Giảm ${vn(-fa)} kg mỡ so với lần trước.` : fa > 0 ? `Mỡ tăng ${vn(fa)} kg so với lần trước.` : "Mỡ giữ nguyên.";
}
function metricSeries(logs, k){ const m = METRICS.find(x=> x.k === k) || METRICS[0]; return sorted(logs).map(l=> ({ ts: l.ts, v: m.get(l) })).filter(p=> p.v != null); }
function chartSVG(series, color){
  if(!series.length) return `<p class="small-note" style="margin:8px 0;">Chưa có số đo cho chỉ số này.</p>`;
  const W = 320, H = 130, PX = 28, PY = 18;
  const vs = series.map(p=> p.v), lo = Math.min(...vs), hi = Math.max(...vs), pad = Math.max(0.5, (hi - lo) * 0.15);
  const y0 = lo - pad, y1 = hi + pad;
  const x = i=> series.length > 1 ? PX + i * (W - 2 * PX) / (series.length - 1) : W / 2;
  const y = v=> H - PY - (v - y0) / ((y1 - y0) || 1) * (H - 2 * PY);
  const pts = series.map((p, i)=> `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const dd = ts=>{ const d = new Date(ts); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const lab = series.map((p, i)=> (i === 0 || i === series.length - 1 || series.length <= 5) ? `<text x="${x(i).toFixed(1)}" y="${H - 2}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".6">${dd(p.ts)}</text>` : "").join("");
  const val = series.map((p, i)=> (i === series.length - 1 || series.length <= 4) ? `<text x="${x(i).toFixed(1)}" y="${(y(p.v) - 7).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">${esc(vn(p.v))}</text>` : "").join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="ibx-svg" role="img" aria-label="Biểu đồ theo thời gian">
    <line x1="${PX}" y1="${H - PY}" x2="${W - PX}" y2="${H - PY}" stroke="currentColor" opacity=".15"/>
    ${series.length > 1 ? `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
    ${series.map((p, i)=> `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" fill="${color}"/>`).join("")}${val}${lab}</svg>`;
}

/* ---------------------------------------------------------------------
   1b. ĐÁNH GIÁ BẰNG LUẬT (trên máy, không tốn lượt AI) — dùng khi phiếu không có eval từ AI / nhập tay,
       và cho phần "Lịch sử & so sánh". Khoảng chuẩn tham khảo (không phải chẩn đoán).
   --------------------------------------------------------------------- */
const PBF_RANGE = { male:[10, 20], female:[18, 28] };
const SMM_RATIO = { male:[0.40, 0.50], female:[0.33, 0.42] };   // cơ xương / cân nặng
const PROF = ()=>{ const s = ST(); return (s && s.profile) || {}; };
const sgn = (n, u)=> n == null ? "--" : `${n > 0 ? "+" : n < 0 ? "−" : "±"}${vn(Math.abs(n))}${u || ""}`;
function genderOf(l, p){ const g = (l && l.gender) || (p && p.gender); return g === "female" ? "female" : "male"; }
function bmiOf(l, p){
  if(l && fin(l.bmi)) return l.bmi;
  const h = Number(p && p.height);
  return l && fin(l.weight) && h >= 100 && h <= 250 ? r1(l.weight / Math.pow(h / 100, 2)) : null;
}
/** trạng thái 4 chỉ số theo khoảng chuẩn */
function statusOf(l, p){
  l = l || {}; const g = genderOf(l, p), [lo, hi] = PBF_RANGE[g], [mlo, mhi] = SMM_RATIO[g];
  const bmi = bmiOf(l, p), smr = fin(l.muscleMassKg) && fin(l.weight) ? l.muscleMassKg / l.weight : null;
  return { g, bmi, pbfRange: [lo, hi],
    weight: bmi == null ? null : bmi < 18.5 ? "low" : bmi >= 23 ? "high" : "normal",
    muscle: smr == null ? null : smr < mlo ? "low" : smr > mhi ? "high" : "normal",
    fat: fin(l.bodyFatPct) ? (l.bodyFatPct < lo ? "low" : l.bodyFatPct > hi ? "high" : "normal") : null,
    visceral: fin(l.visceralFat) ? (l.visceralFat >= 10 ? "high" : "normal") : null };
}
function diff(a, b){
  if(!a || !b) return null;
  const d = (x, y)=> x != null && y != null ? r1(x - y) : null;
  return { days: Math.round((a.ts - b.ts) / 86400000), dw: d(fin(a.weight) ? a.weight : null, fin(b.weight) ? b.weight : null),
    dsmm: d(fin(a.muscleMassKg) ? a.muscleMassKg : null, fin(b.muscleMassKg) ? b.muscleMassKg : null), dfat: d(fatKg(a), fatKg(b)),
    dpbf: d(fin(a.bodyFatPct) ? a.bodyFatPct : null, fin(b.bodyFatPct) ? b.bodyFatPct : null) };
}
const dTxt = x=> [x.dw != null ? "cân " + sgn(x.dw, " kg") : "", x.dsmm != null ? "cơ " + sgn(x.dsmm, " kg") : "", x.dpbf != null ? "% mỡ " + sgn(x.dpbf, " điểm") : ""].filter(Boolean).join(" · ");
/** tiến trình của lần đo `ref` (mặc định mới nhất) so với lần trước & lần đầu + lời khuyên theo mục tiêu (lose/gain/maintain) */
function progress(logs, p, ref){
  p = p || {};
  const L = sorted(logs), last = ref ? (L.find(l=> l === ref || (ref.id != null && l.id === ref.id)) || ref) : L[L.length - 1];
  if(!last) return null;
  const before = L.filter(l=> l !== last && l.ts < last.ts && !(last.id != null && l.id === last.id));
  const prev = before[before.length - 1] || null, first = before[0] || null;
  const dp = diff(last, prev), df = first && first !== prev ? diff(last, first) : null;
  const goal = p.goal === "lose" || p.goal === "gain" ? p.goal : "maintain";
  const w = fin(last.weight) ? last.weight : Number(p.weight) || null;
  const prot = w ? ` (≈ ${Math.round(w * 1.6)}–${Math.round(w * 2.2)} g/ngày với ${vn(w)} kg)` : "";
  const tdee = fin(Number(p.tdee)) && Number(p.tdee) > 800 ? Number(p.tdee) : null;
  const notes = [], advice = []; let plateau = false;
  const A = {
    deficit: `Tạo thâm hụt khoảng 300–500 kcal/ngày so với mức duy trì${tdee ? ` (≈ ${Math.round(tdee - 500)}–${Math.round(tdee - 300)} kcal/ngày)` : ""}; ghi nhật ký ăn đủ 2 tuần để biết mình ăn thật bao nhiêu.`,
    surplus: `Ăn dư khoảng 200–300 kcal/ngày${tdee ? ` (≈ ${Math.round(tdee + 200)}–${Math.round(tdee + 300)} kcal/ngày)` : ""} — dư nhiều hơn chủ yếu thành mỡ.`,
    protein: `Giữ đạm 1,6–2,2 g/kg/ngày${prot}, chia đều 3–5 bữa.`,
    load: "Tập kháng lực 3–4 buổi/tuần và tăng tải dần (thêm tạ hoặc số lần mỗi 1–2 tuần, hiệp cuối gần kiệt sức) — giữ cùng mức tạ quá lâu thì cơ thể không đổi.",
    steps: "Thêm vận động nhẹ: 7.000–10.000 bước/ngày hoặc 150 phút cardio vừa/tuần.",
    sleep: "Ngủ 7–9 giờ/đêm; thiếu ngủ làm tăng đói, giảm phục hồi và giữ nước.",
    same: "Đo lại cùng điều kiện: buổi sáng, sau khi đi vệ sinh, trước khi ăn uống và tập (nước dao động có thể làm lệch ±1 kg)."
  };
  if(dp && dp.days >= 21){
    const smallW = dp.dw == null || Math.abs(dp.dw) < 0.5, smallP = dp.dpbf == null || Math.abs(dp.dpbf) < 0.5, smallM = dp.dsmm == null || Math.abs(dp.dsmm) < 0.3;
    if(goal === "lose"){
      if(smallW && smallP){ plateau = true; notes.push(`Sau ${dp.days} ngày: ${dTxt(dp) || "chỉ số"} — gần như chững lại so với mục tiêu giảm mỡ.`); advice.push(A.deficit, A.protein, A.load, A.steps, A.sleep); }
      else if(dp.dw != null && dp.dw >= 0.5){ notes.push(`Cân tăng ${vn(dp.dw)} kg sau ${dp.days} ngày trong khi mục tiêu là giảm mỡ.`); advice.push(A.deficit, A.protein, A.steps); }
      else {
        if(dp.dw != null && w && -dp.dw / (dp.days / 7) > w * 0.01) { notes.push(`Giảm ${vn(-dp.dw)} kg trong ${dp.days} ngày — hơi nhanh (>1% cân nặng/tuần), dễ mất cơ.`); advice.push(A.protein, A.load); }
        else notes.push(`Đang giảm đúng hướng: ${dTxt(dp)} sau ${dp.days} ngày.`);
        if(dp.dsmm != null && dp.dsmm <= -0.5){ notes.push(`Cơ giảm ${vn(-dp.dsmm)} kg — cần giữ cơ khi giảm cân.`); advice.push(A.protein, A.load); }
      }
    } else if(goal === "gain"){
      if(smallM && smallW){ plateau = true; notes.push(`Sau ${dp.days} ngày: ${dTxt(dp) || "chỉ số"} — cơ gần như chưa tăng.`); advice.push(A.surplus, A.protein, A.load, A.sleep); }
      else if(dp.dfat != null && dp.dsmm != null && dp.dfat > 0.5 && dp.dfat > dp.dsmm * 2){ notes.push(`Mỡ tăng ${vn(dp.dfat)} kg, nhanh hơn cơ (${sgn(dp.dsmm, " kg")}).`); advice.push("Giảm phần ăn dư xuống ~200 kcal/ngày, bớt đồ ngọt/chiên.", A.load); }
      else if(dp.dsmm != null && dp.dsmm < 0){ notes.push(`Cơ giảm ${vn(-dp.dsmm)} kg dù mục tiêu tăng cơ.`); advice.push(A.surplus, A.protein, A.load, A.sleep); }
      else notes.push(`Đang tăng đúng hướng: ${dTxt(dp)} sau ${dp.days} ngày.`);
    } else {
      if(dp.dpbf != null && dp.dpbf >= 1){ notes.push(`% mỡ tăng ${vn(dp.dpbf)} điểm sau ${dp.days} ngày.`); advice.push(A.steps, A.protein, A.load); }
      else if(dp.dsmm != null && dp.dsmm <= -0.5){ notes.push(`Cơ giảm ${vn(-dp.dsmm)} kg sau ${dp.days} ngày.`); advice.push(A.protein, A.load); }
      else notes.push(`Giữ ổn định sau ${dp.days} ngày: ${dTxt(dp) || "không đổi"}.`);
    }
    if(plateau) advice.push(A.same);
  } else if(dp){
    notes.push(`Mới cách lần trước ${dp.days} ngày — nên đo lại sau 3–4 tuần mới thấy thay đổi thật.`);
  }
  return { last, prev, first, dPrev: dp, dFirst: df, goal, plateau, notes, advice: Array.from(new Set(advice)).slice(0, 6) };
}
/** đánh giá đầy đủ (cùng dạng eval của AI) cho 1 lần đo, dùng luật trên máy */
function ruleEval(log, logs, p){
  p = p || PROF(); log = log || {};
  const s = statusOf(log, p), [lo, hi] = s.pbfRange, good = [], improve = [], advice = [];
  const pbf = fin(log.bodyFatPct) ? log.bodyFatPct : null, vis = fin(log.visceralFat) ? log.visceralFat : null;
  if(s.fat === "normal") good.push(`% mỡ ${vn(pbf)}% nằm trong khoảng chuẩn (${lo}–${hi}%).`);
  if(s.fat === "high"){ improve.push(`% mỡ ${vn(pbf)}% cao hơn mức chuẩn ${hi}% — ưu tiên giảm mỡ.`); advice.push("Ưu tiên giảm mỡ: thâm hụt 300–500 kcal/ngày, giữ tập tạ để không mất cơ."); }
  if(s.fat === "low") improve.push(`% mỡ ${vn(pbf)}% thấp hơn mức chuẩn ${lo}% — không nên cắt thêm, ăn đủ năng lượng.`);
  if(s.muscle === "normal" || s.muscle === "high") good.push(`Khối cơ xương ${vn(log.muscleMassKg)} kg ${s.muscle === "high" ? "tốt hơn mức trung bình" : "ở mức chuẩn"} so với cân nặng.`);
  if(s.muscle === "low"){ improve.push(`Khối cơ xương ${vn(log.muscleMassKg)} kg thấp so với cân nặng.`); advice.push("Tăng cơ: tập kháng lực toàn thân 3 buổi/tuần, mỗi nhóm cơ chính 10–20 hiệp/tuần."); }
  if(s.visceral === "normal") good.push(`Mỡ nội tạng cấp ${vn(vis)} — an toàn (dưới 10).`);
  if(s.visceral === "high"){ improve.push(`Mỡ nội tạng cấp ${vn(vis)} (≥ 10) — liên quan nguy cơ tim mạch, tiểu đường.`); advice.push("Giảm mỡ nội tạng: bớt đường, nước ngọt, rượu bia; 150 phút cardio vừa/tuần + tập tạ."); }
  if(s.weight === "normal") good.push(`BMI ${vn(s.bmi)} trong khoảng khuyến nghị (18,5–22,9, chuẩn châu Á).`);
  if(s.weight === "high") improve.push(s.fat === "normal" || s.muscle === "high" ? `BMI ${vn(s.bmi)} cao nhưng % mỡ không cao — chủ yếu do cơ, không đáng lo.` : `BMI ${vn(s.bmi)} ở mức thừa cân (≥ 23, chuẩn châu Á).`);
  if(s.weight === "low"){ improve.push(`BMI ${vn(s.bmi)} thấp (< 18,5) — nên tăng cân lành mạnh.`); advice.push("Ăn đủ hoặc dư nhẹ 200–300 kcal/ngày, đủ đạm, tập tạ để cân tăng chủ yếu bằng cơ."); }
  const pr = progress(logs && logs.length ? logs : [log], p, log);
  const adv = Array.from(new Set((pr ? pr.advice : []).concat(advice))).slice(0, 6);
  if(!adv.length) adv.push("Duy trì: tập kháng lực 3–4 buổi/tuần, đạm 1,6–2,2 g/kg, ngủ 7–9 giờ; đo lại sau 4 tuần.");
  const cmp = pr && pr.dPrev ? `So với lần trước (${pr.dPrev.days} ngày): ${dTxt(pr.dPrev) || "không có số để so"}.` + (pr.dFirst ? ` So với lần đầu (${pr.dFirst.days} ngày): ${dTxt(pr.dFirst) || "--"}.` : "") : null;
  const WORD = { low:"thấp", normal:"chuẩn", high:"cao" };
  let summary;
  if(pr && pr.plateau) summary = pr.notes[0] + " Cần điều chỉnh ăn uống và tập luyện.";
  else {
    const bits = [s.fat ? `mỡ ${WORD[s.fat]}` : "", s.muscle ? `cơ ${WORD[s.muscle]}` : "", s.visceral === "high" ? "mỡ nội tạng cao" : ""].filter(Boolean);
    summary = bits.length ? `Thành phần cơ thể: ${bits.join(", ")}.` + (pr && pr.notes[0] ? " " + pr.notes[0] : "") : (pr && pr.notes[0]) || "Chưa đủ số liệu để đánh giá chi tiết — thêm % mỡ và khối cơ.";
  }
  return { summary, status: { weight: s.weight, muscle: s.muscle, fat: s.fat, visceral: s.visceral }, good: good.slice(0, 5), improve: improve.slice(0, 5), advice: adv,
    compare: cmp, nextCheckDays: 28, src: "rule", notes: pr ? pr.notes : [] };
}
/** đánh giá hiển thị cho 1 lần đo: AI đã lưu → dùng; không thì luật */
function evalFor(log, logs, p){ return log && log.eval && typeof log.eval === "object" && (log.eval.summary || (log.eval.advice || []).length) ? Object.assign({ src: "ai" }, log.eval) : ruleEval(log, logs, p); }

/* ---------------------------------------------------------------------
   2. GỌI AI
   --------------------------------------------------------------------- */
const PROMPT = `Bạn đọc ẢNH CHỤP PHIẾU KẾT QUẢ máy đo thành phần cơ thể (InBody, Tanita, Omron…). CHỈ CHÉP LẠI số IN TRÊN PHIẾU, KHÔNG tự tính, KHÔNG đoán; số không đọc rõ → null và ghi tên trường vào "unreadable".
weight = Cân nặng (kg; lb thì đổi ×0,4536) · smm = Khối lượng cơ xương / Skeletal Muscle Mass (kg, KHÔNG lấy Soft Lean Mass) · bfm = Khối lượng mỡ / Body Fat Mass (kg) · pbf = Tỉ lệ mỡ / Percent Body Fat (%) · tbw = Tổng lượng nước / Total Body Water (L) · visceral = Mức mỡ nội tạng / Visceral Fat Level (cấp 1–20; chỉ có cm² thì null) · bmr = Basal Metabolic Rate (kcal) · score = Điểm InBody · bmi · date = ngày đo YYYY-MM-DD hoặc null. Có nhiều lần đo → chỉ lấy lần MỚI NHẤT. Không phải phiếu đo → is_report=false.
Chỉ trả về MỘT JSON: {"is_report":true,"device":"","date":null,"weight":null,"smm":null,"bfm":null,"pbf":null,"tbw":null,"visceral":null,"bmr":null,"score":null,"bmi":null,"conf":0.0,"unreadable":[]}`;
/* 21/11/2026: phần mở rộng cho đường khoá AI riêng (máy chủ có lời nhắc riêng) — chép thêm chỉ số + từng phần + đánh giá */
const PROMPT_MORE = `
Chép thêm nếu có trên phiếu (không có → null): ffm (Fat Free Mass kg), slm (Soft Lean Mass kg), protein (kg), minerals (kg), ecw_ratio (ECW/TBW, vd 0.380), smi (kg/m²), whr (tỉ lệ eo/hông), obesity_degree (%), target_weight, weight_control, fat_control, muscle_control (kg, có dấu −/+), seg_lean và seg_fat = {"ra":{"kg":null,"pct":null},"la":…,"tr":…,"rl":…,"ll":…} (ra = tay PHẢI, la = tay TRÁI, tr = thân, rl = chân PHẢI, ll = chân TRÁI; pct = % so với chuẩn).
Sau đó ĐÁNH GIÁ ngắn bằng tiếng Việt trong "eval": {"summary":"","status":{"weight":"low|normal|high","muscle":"…","fat":"…","visceral":"…"},"good":[],"improve":[],"advice":[],"compare":null,"next_check_days":28} — dựa trên hồ sơ (profile) và các lần đo trước (history) dưới đây; compare = so với lần gần nhất (null nếu không có). Lời khuyên cụ thể (kcal, g đạm/kg, buổi tập), không chẩn đoán bệnh.`;
function promptFor(ctx){ return PROMPT + PROMPT_MORE + "\nprofile=" + JSON.stringify(ctx.profile) + "\nhistory=" + JSON.stringify(ctx.history); }
function demoResult(){
  const s = (kg, pct)=> ({ kg, pct });
  return { is_report:true, simulated:true, device:"InBody 570 (kết quả mẫu)", date:null, weight:72.4, smm:33.1, bfm:13.6, pbf:18.8, tbw:42.6, visceral:6, bmr:1685, score:78, bmi:23.1, conf:.9, unreadable:[],
    ffm:58.8, slm:55.4, protein:11.6, minerals:4.06, ecw_ratio:0.381, smi:7.8, whr:0.86, obesity_degree:105, target_weight:70.2, weight_control:-2.2, fat_control:-2.2, muscle_control:0,
    seg_lean:{ ra:s(3.42, 104.1), la:s(3.38, 102.6), tr:s(26.1, 99.4), rl:s(9.12, 96.3), ll:s(9.05, 95.6) },
    seg_fat:{ ra:s(0.8, 98.2), la:s(0.8, 99.0), tr:s(7.1, 121.5), rl:s(2.1, 104.7), ll:s(2.1, 105.3) },
    eval:{ summary:"Thành phần cơ thể khá cân đối (kết quả mẫu): khối cơ chuẩn, % mỡ sát ngưỡng trên, mỡ dồn nhiều ở thân.",
      status:{ weight:"normal", muscle:"normal", fat:"normal", visceral:"normal" },
      good:["Khối cơ xương 33,1 kg ở mức chuẩn.", "Mỡ nội tạng cấp 6 — an toàn.", "Tay/chân trái–phải cân đối."],
      improve:["Mỡ vùng thân 121% chuẩn — cao hơn các vùng khác.", "% mỡ 18,8% sát ngưỡng trên (20%)."],
      advice:["Thâm hụt nhẹ 300 kcal/ngày trong 6–8 tuần để giảm ~2 kg mỡ.", "Đạm 1,6–2,0 g/kg/ngày (≈ 115–145 g).", "Tập tạ 3–4 buổi/tuần, thêm 8.000 bước/ngày."],
      compare:null, next_check_days:28 } };
}
function parseJson(text){ const s = String(text || ""), a = s.indexOf("{"), b = s.lastIndexOf("}"); if(a < 0 || b <= a) throw new Error("AI không trả kết quả đọc được"); return JSON.parse(s.slice(a, b + 1)); }
const ymd = ts=>{ const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
/** ngữ cảnh gửi kèm: hồ sơ (giới tính, tuổi, cao, mục tiêu) + ≤ 6 lần đo gần nhất (cũ → mới) */
function scanContext(){
  const p = PROF(), st = ST();
  const num = (v, lo, hi)=>{ const n = Number(v); return v != null && v !== "" && Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  const profile = { gender: p.gender === "female" ? "female" : "male", age: num(p.age, 5, 110), height: num(p.height, 50, 260), goal: ["lose", "gain", "maintain"].includes(p.goal) ? p.goal : "maintain" };
  const history = sorted(st && st.inbodyLogs).slice(-6).map(l=> ({ date: ymd(l.ts), weight: fin(l.weight) ? l.weight : null, smm: fin(l.muscleMassKg) ? l.muscleMassKg : null,
    bfm: fatKg(l), pbf: fin(l.bodyFatPct) ? l.bodyFatPct : null, visceral: fin(l.visceralFat) ? l.visceralFat : null, bmr: fin(l.bmr) ? l.bmr : null, score: fin(l.score) ? l.score : null }));
  return { profile, history };
}
async function analyze(dataUrl){
  const c = CL(), isFb = !!(c && c.mode === "firebase");
  const ctx = scanContext();
  const ownKey = ()=>{ try{ return typeof getActiveProviderKey === "function" && getActiveProviderKey(); }catch(e){ return ""; } };
  const viaOwn = async ()=> clean(parseJson(await callVisionAI(dataUrl, promptFor(ctx))));
  if(!isFb){
    if(ownKey()) return viaOwn();
    await new Promise(r=> setTimeout(r, 1200));
    return clean(demoResult());
  }
  if(!(c.user && c.user.uid)){
    if(ownKey()) return viaOwn();
    const e = new Error("Đăng nhập để dùng đọc phiếu InBody."); e.code = "need-login"; throw e;
  }
  try{
    const r = await c.fn("analyzeInbodyReport", { image: dataUrl, profile: ctx.profile, history: ctx.history });
    return clean(r && r.result);
  }catch(e){
    const code = String(e && e.code || "");
    if(/failed-precondition|not-found|unimplemented/.test(code) && ownKey()) return viaOwn();
    if(/failed-precondition|not-found|unimplemented/.test(code)){ const x = new Error("Tính năng AI đọc phiếu chưa được bật trên máy chủ — tạm nhập tay."); x.code = "not-configured"; throw x; }
    throw e;
  }
}
/* ảnh phiếu: chữ nhỏ → giữ 1600 px, nén tới khi ≤ 1,35 triệu ký tự */
const isHeic = f=> !!f && (/image\/hei[cf]/i.test(String(f.type || "")) || /\.(heic|heif)$/i.test(String(f.name || "")));
const HEIC_MSG = "Máy này chưa đọc được ảnh HEIC của iPhone. Cách xử lý: bấm \"Chụp phiếu\" để chụp trực tiếp trong app, hoặc lưu ảnh dạng JPG (iPhone: Cài đặt › Camera › Định dạng › \"Tương thích nhất\"; hoặc chụp màn hình ảnh phiếu) rồi chọn lại.";
function heicErr(){ const e = new Error(HEIC_MSG); e.code = "heic"; return e; }
function prepare(file){
  return new Promise((ok, no)=>{
    if(!file || !(/^image\//.test(file.type || "image/") || isHeic(file))) return no(new Error("Hãy chọn một tấm ảnh (JPG, PNG…)."));
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = ()=>{
      try{
        const MAX = 1600, s = Math.min(1, MAX / Math.max(im.naturalWidth, im.naturalHeight));
        const cv = D.createElement("canvas"); cv.width = Math.max(1, Math.round(im.naturalWidth * s)); cv.height = Math.max(1, Math.round(im.naturalHeight * s));
        cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        let q = .86, u = cv.toDataURL("image/jpeg", q);
        while(u.length > 1350000 && q > .45){ q -= .1; u = cv.toDataURL("image/jpeg", q); }
        ok(u);
      }catch(e){ no(e); } finally { URL.revokeObjectURL(url); }
    };
    im.onerror = ()=>{ URL.revokeObjectURL(url); no(isHeic(file) ? heicErr() : new Error("Không đọc được ảnh này. Thử chụp trực tiếp hoặc chọn ảnh JPG/PNG.")); };
    im.src = url;
  });
}

/* ---------------------------------------------------------------------
   3. FORM THÊM SỐ LIỆU: thêm 3 ô + điền sẵn kết quả đọc phiếu
   --------------------------------------------------------------------- */
const EXTRA = [ ["ib-fatkg", "Mỡ (kg)", "VD: 13,6", "fatMassKg", 1, 250], ["ib-bmr", "BMR (kcal)", "VD: 1650", "bmr", 600, 4500], ["ib-score", "Điểm InBody", "VD: 78", "score", 20, 120] ];
const numIn = t=>{ const s = String(t == null ? "" : t).trim().replace(",", "."); if(s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
function injectExtra(){
  const sc = D.getElementById("sheet-content"); const err = D.getElementById("ib-err");
  if(!sc || !err || D.getElementById("ib-fatkg")) return;
  const box = D.createElement("div"); box.className = "ibx-extra";
  box.innerHTML = `<div class="field-row" style="margin-top:10px;">${EXTRA.map(([id, lab, ph])=> `<div class="field"><label for="${id}">${esc(lab)}</label><input type="text" inputmode="decimal" id="${id}" placeholder="${esc(ph)}"></div>`).join("")}</div>
    <p class="small-note" style="margin-top:6px;">Ô "Khối lượng cơ" = <b>cơ xương (SMM)</b> trên phiếu InBody. Ba ô trên là tuỳ chọn.</p>`;
  const noteField = D.getElementById("ib-note"); const anchor = noteField && noteField.closest ? noteField.closest(".field") : null;
  (anchor || err).parentNode.insertBefore(box, anchor || err);
  const save = D.getElementById("ib-save");
  if(save) save.addEventListener("click", (e)=>{
    const extra = {}; let bad = "";
    EXTRA.forEach(([id, lab, , key, lo, hi])=>{ const n = numIn((D.getElementById(id) || {}).value); if(n == null) return; if(!Number.isFinite(n) || n < lo || n > hi){ bad = bad || `${lab} phải trong khoảng ${lo}–${hi} — hoặc để trống.`; return; } extra[key] = key === "fatMassKg" ? r1(n) : Math.round(n); });
    if(bad){ e.stopImmediatePropagation(); e.preventDefault(); const er = D.getElementById("ib-err"); if(er) er.textContent = bad; say(bad, "error"); return; }
    const st = ST(); if(!st) return; const before = (st.inbodyLogs || []).length, dev = pendingDevice, res = pendingScan;
    setTimeout(()=>{
      const s2 = ST(); if(!s2 || !Array.isArray(s2.inbodyLogs) || s2.inbodyLogs.length <= before) return;
      const l = s2.inbodyLogs[s2.inbodyLogs.length - 1];
      attachExtra(l, extra, res, dev);
      pendingDevice = ""; pendingScan = null;
      try{ saveState(); }catch(_){}
      try{ if(typeof renderProgressInbodyTab === "function" && D.getElementById("progress-content")) renderProgressInbodyTab(); }catch(_){}
      homeRefresh();
      if(res) try{ openReport(l.id); }catch(e){ try{ console.warn("[inbody] report", e); }catch(_){} }
    }, 0);
  }, true);
}
/** gắn trường bổ sung vào bản ghi vừa lưu: 3 ô phụ + tên máy + (đọc phiếu) toàn bộ chỉ số mở rộng/đánh giá + giới tính lúc đo; làm sạch như khi nạp state */
function attachExtra(l, extra, res, dev){
  if(!l || typeof l !== "object") return l;
  Object.assign(l, extra || {}); if(dev) l.device = String(dev).replace(/[\u0000-\u001f]/g, " ").slice(0, 40);
  if(res) Object.assign(l, scanToLog(res, l));
  const g = PROF().gender; if(g === "male" || g === "female") l.gender = g;
  try{ if(typeof fkInbodyCleanExtra === "function") fkInbodyCleanExtra(l); }catch(_){}
  return l;
}
let pendingDevice = "", pendingScan = null;
function fill(res){
  const set = (id, v)=>{ const el = D.getElementById(id); if(!el) return; if(v == null){ return; } el.value = String(v).replace(".", ","); el.classList.add("ibx-ai"); };
  if(res.date){ const d = D.getElementById("ib-date"); if(d){ d.value = res.date; d.classList.add("ibx-ai"); } }
  set("ib-weight", res.weight); set("ib-bf", res.pbf); set("ib-muscle", res.smm);
  set("ib-water", res.tbw != null && res.weight ? r1(res.tbw / res.weight * 100) : null);
  set("ib-visceral", res.visceral); set("ib-fatkg", res.bfm); set("ib-bmr", res.bmr != null ? Math.round(res.bmr) : null); set("ib-score", res.score != null ? Math.round(res.score) : null);
  const miss = { weight:"ib-weight", pbf:"ib-bf", smm:"ib-muscle", tbw:"ib-water", visceral:"ib-visceral", bfm:"ib-fatkg", bmr:"ib-bmr", score:"ib-score" };
  Object.keys(miss).forEach(k=>{ if(res[k] == null){ const el = D.getElementById(miss[k]); if(el && res.unreadable.includes(k)) el.classList.add("ibx-miss"); } });
  const note = D.getElementById("ib-note"); if(note && !note.value) note.value = ("Đọc từ phiếu " + (res.device || "InBody")).slice(0, 200);
  pendingDevice = res.device || ""; pendingScan = res;
  const MORE_LAB = { ffm:"Khối nạc (FFM)", slm:"Cơ mềm (SLM)", protein:"Protein", minerals:"Khoáng", ecw_ratio:"ECW/TBW", smi:"SMI", whr:"Eo/hông", obesity_degree:"Độ béo phì", target_weight:"Cân mục tiêu" };
  const more = Object.keys(MORE_LAB).filter(k=> res[k] != null).map(k=> MORE_LAB[k]);
  if(res.seg_lean) more.push("nạc từng phần"); if(res.seg_fat) more.push("mỡ từng phần");
  const n = ["weight", "smm", "bfm", "pbf", "tbw", "visceral", "bmr", "score"].filter(k=> res[k] != null).length + more.length;
  /* thẻ đánh giá ngay trong màn duyệt (AI; không có → luật trên máy với số AI vừa đọc) + danh sách chỉ số mở rộng sẽ được lưu */
  try{
    const err = D.getElementById("ib-err");
    if(err && err.parentNode){
      injectCSS();
      const tmp = { ts: Date.now(), weight: res.weight, muscleMassKg: res.smm, bodyFatPct: res.pbf, fatMassKg: res.bfm, visceralFat: res.visceral, bmi: res.bmi, gender: PROF().gender };
      const st = ST(), ev = res.eval ? Object.assign({ src: "ai" }, res.eval) : ruleEval(tmp, ((st && st.inbodyLogs) || []).concat([tmp]), PROF());
      const box = D.createElement("div"); box.className = "ibx-review";
      box.innerHTML = (more.length ? `<p class="small-note" style="margin:10px 0 0;">Cũng sẽ lưu: ${esc(more.join(", "))}.</p>` : "") + evalCardHTML(ev, { compact: true });
      err.parentNode.insertBefore(box, err);
    }
  }catch(e){ try{ console.warn("[inbody] review", e); }catch(_){} }
  const head = D.querySelector("#sheet-content .sheet-header");
  if(head){
    const b = D.createElement("div"); b.className = "ibx-banner" + (res.simulated ? " demo" : "");
    b.innerHTML = `<span class="material-symbols-rounded">photo_camera</span><div><b>${res.simulated ? "Kết quả mẫu (bản demo)" : `AI đã đọc ${n} chỉ số${res.device ? " · " + esc(res.device) : ""}`}</b>
      <span>Ô viền xanh do AI điền${res.unreadable.length ? ", ô viền cam chưa đọc được" : ""}. Đối chiếu từng số với phiếu rồi mới lưu.</span></div>`;
    head.insertAdjacentElement("afterend", b);
  }
}

/* ---------------------------------------------------------------------
   4. LUỒNG CHỤP
   --------------------------------------------------------------------- */
/* pick({ camera:true }) → mở camera sau (capture="environment"); pick({ camera:false }) / pick() → chọn ảnh có sẵn trong thư viện (KHÔNG capture).
   Gắn thẳng làm trình nghe sự kiện cũng được (đối số Event bị bỏ qua → thư viện). */
let lastCamera = false;
function pick(opts){
  const camera = !!(opts && typeof opts === "object" && opts.camera === true);
  lastCamera = camera;
  if(!D || !D.body) return null;
  try{ if(D.querySelectorAll) D.querySelectorAll("input.ibx-file").forEach(n=>{ try{ n.remove(); }catch(_){} }); }catch(_){}
  const inp = D.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.className = "ibx-file"; inp.style.display = "none";
  if(camera) inp.setAttribute("capture", "environment");
  inp.addEventListener("change", ()=>{ const f = inp.files && inp.files[0]; try{ inp.remove(); }catch(_){} if(f) scan(f); });
  D.body.appendChild(inp);
  try{ inp.click(); }catch(_){}
  return inp;
}
async function scan(file){
  if(typeof openSheet !== "function") return;
  openSheet(`<div class="ibx-wait"><span class="material-symbols-rounded ibx-spin">photo_camera</span><b>Đang đọc phiếu…</b><p class="small-note">AI chỉ chép lại số in trên phiếu, bạn sẽ kiểm tra trước khi lưu.</p></div>`);
  try{
    const url = await prepare(file);
    const res = await analyze(url);
    if(!res.is_report){
      openSheet(`<div class="sheet-header"><h3>Chưa đọc được phiếu</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
        <p class="small-note">Ảnh này không giống phiếu kết quả máy đo thành phần cơ thể, hoặc chữ quá mờ.</p>
        <ul class="ibx-tips"><li>Đặt phiếu phẳng, chụp thẳng, đủ sáng, không loá.</li><li>Chụp trọn phần bảng số (cân nặng, cơ, mỡ).</li></ul>
        <div class="chip-row" style="margin-top:12px;"><button class="btn btn-primary btn-sm" data-ibx="camera">Chụp lại</button><button class="btn btn-outline btn-sm" data-ibx="gallery">Chọn ảnh khác</button><button class="btn btn-outline btn-sm" data-ibx="manual">Nhập tay</button></div>`);
      bindRetry(); return;
    }
    openAddInbodyLog(); fill(res);
  }catch(e){
    const heic = !!(e && e.code === "heic");
    openSheet(`<div class="sheet-header"><h3>${heic ? "Chưa mở được ảnh HEIC" : "Không đọc được phiếu"}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
      <p class="small-note">${esc((e && e.message) || "Có lỗi khi gửi ảnh. Thử lại sau ít phút.")}</p>
      <div class="chip-row" style="margin-top:12px;">${heic
        ? `<button class="btn btn-primary btn-sm" data-ibx="camera">Chụp trực tiếp</button><button class="btn btn-outline btn-sm" data-ibx="gallery">Chọn ảnh khác</button>`
        : `<button class="btn btn-primary btn-sm" data-ibx="again">Thử lại</button>`}<button class="btn btn-outline btn-sm" data-ibx="manual">Nhập tay</button></div>`);
    bindRetry();
  }
}
function bindRetry(){
  D.querySelectorAll("#sheet-content [data-ibx]").forEach(b=> b.addEventListener("click", ()=>{ const k = b.dataset.ibx;
    if(k === "again") pick({ camera: lastCamera }); else if(k === "camera") pick({ camera:true }); else if(k === "gallery") pick({ camera:false }); else openAddInbodyLog(); }));
}

/* ---------------------------------------------------------------------
   5. TAB INBODY: nút chụp + thẻ Thành phần cơ thể
   --------------------------------------------------------------------- */
let metric = "muscle";
const COLORS = { muscle:"#5EE6C7", fat:"#FF9F6B", pbf:"#FFC857", weight:"#8AB4FF", visceral:"#FF7A7A", bmr:"#C8F560" };
function compHTML(logs){
  const cmp = compare(logs); if(!cmp || !cmp.rows.length) return "";
  const vd = verdict(cmp);
  const has = METRICS.filter(m=> metricSeries(logs, m.k).length);
  if(!has.some(m=> m.k === metric)) metric = (has[0] || METRICS[0]).k;
  const arrow = r=> r.d == null ? "" : `<em class="ibx-d ${r.tone}">${r.d > 0 ? "▲ +" : r.d < 0 ? "▼ " : ""}${esc(vn(r.d))}</em>`;
  return `<div class="card ibx-card">
    <div class="card-title"><span class="material-symbols-rounded">monitor_weight</span>Thành phần cơ thể</div>
    ${vd ? `<p class="ibx-verdict">${esc(vd)}</p>` : ""}
    <div class="ibx-grid">${cmp.rows.map(r=> `<div class="ibx-cell"><small>${esc(r.label)}</small><b>${esc(r.k === "bmr" ? String(Math.round(r.v)) : vn(r.v))}<i>${esc(r.unit)}</i></b>${arrow(r)}</div>`).join("")}</div>
    <p class="small-note" style="margin:6px 0 10px;">▲▼ so với lần đo trước. Xanh = đúng hướng (cơ tăng, mỡ giảm).</p>
    <div class="ibx-chips" role="tablist">${has.map(m=> `<button type="button" role="tab" aria-selected="${m.k === metric}" class="${m.k === metric ? "on" : ""}" data-ibm="${m.k}">${esc(m.label)}</button>`).join("")}</div>
    <div class="ibx-chart">${chartSVG(metricSeries(logs, metric), COLORS[metric] || "#5EE6C7")}</div>
  </div>`;
}
function decorate(){
  const box = D.getElementById("progress-content"); const add = D.getElementById("btn-add-inbody"); const st = ST();
  if(!box || !add || !st) return;
  injectCSS();
  const host = add.parentNode;
  const there = id=>{ const n = D.getElementById(id); return !!(n && n.parentNode); };
  if(host && !there("btn-scan-inbody")){
    const b = D.createElement("button"); b.type = "button"; b.id = "btn-scan-inbody"; b.className = "btn btn-primary btn-block";
    b.style.margin = "10px 0 0"; b.innerHTML = `<span class="material-symbols-rounded">photo_camera</span>&nbsp;Chụp phiếu InBody — AI điền số`;
    host.insertBefore(b, add); add.style.marginTop = "8px";
    b.addEventListener("click", ()=> pick({ camera:true }));
  }
  if(host && !there("btn-pick-inbody")){
    const g = D.createElement("button"); g.type = "button"; g.id = "btn-pick-inbody"; g.className = "btn btn-outline btn-block ibx-pick";
    g.style.margin = "8px 0 0"; g.innerHTML = `<span class="material-symbols-rounded">photo_library</span>&nbsp;Chọn ảnh phiếu có sẵn`;
    host.insertBefore(g, add);
    g.addEventListener("click", ()=> pick({ camera:false }));
  }
  const old = box.querySelector(".ibx-card"); if(old) old.remove();
  const html = compHTML(st.inbodyLogs); if(!html) return;
  const chartCard = (D.getElementById("inbody-chart") || {}).closest ? D.getElementById("inbody-chart").closest(".card") : null;
  const wrap = D.createElement("div"); wrap.innerHTML = html; const card = wrap.firstElementChild;
  if(chartCard) chartCard.parentNode.insertBefore(card, chartCard); else add.parentNode.insertBefore(card, add.nextSibling);
  card.addEventListener("click", e=>{ const t = e.target.closest && e.target.closest("[data-ibm]"); if(!t) return; metric = t.dataset.ibm; decorate(); });
}

/* ---------------------------------------------------------------------
   6. TRANG CHỦ: thẻ "Thành phần cơ thể" (data-home-zone="personal" → pt.js teHomeLayout xếp dưới thẻ chỉ số;
      Chế độ gọn ẩn vùng này — chấp nhận). Bọc renderHomeScreen; vẽ lại khi lưu/xoá số đo.
   --------------------------------------------------------------------- */
const CSS = `
.ibh-card{ color:var(--text); }
.ibh-card .card-title{ display:flex; align-items:center; gap:6px; }
.ibh-card .ibh-when{ margin-left:auto; font-size:12px; font-weight:600; color:var(--text-muted); }
.ibh-row{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; margin-top:8px; }
.ibh-cell{ min-width:0; padding:10px; border-radius:12px; background:var(--surface, rgba(255,255,255,.05)); border:1px solid var(--border, rgba(255,255,255,.08)); }
.ibh-cell small{ display:block; font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ibh-cell b{ display:block; font-size:18px; font-weight:800; color:var(--text); margin-top:2px; }
.ibh-cell b i{ font-style:normal; font-size:12px; font-weight:600; color:var(--text-muted); margin-left:2px; }
.ibh-d{ display:flex; align-items:center; gap:1px; font-style:normal; font-size:12px; font-weight:700; margin-top:2px; color:var(--text-muted); }
.ibh-d .material-symbols-rounded{ font-size:16px; }
.ibh-d.good{ color:var(--ibh-good, #5EE6C7); } .ibh-d.bad{ color:var(--ibh-bad, #FFB08A); }
.ibh-spark{ display:flex; align-items:center; gap:10px; margin-top:10px; }
.ibh-spark svg{ flex:1 1 auto; width:100%; height:36px; display:block; }
.ibh-spark small{ flex:0 0 auto; font-size:12px; color:var(--text-muted); }
.ibh-lead{ margin:4px 0 0; font-size:13.5px; line-height:1.45; color:var(--text-muted); }
.ibh-acts{ display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
.ibh-acts .btn{ flex:1 1 0; min-width:96px; min-height:44px; display:inline-flex; align-items:center; justify-content:center; gap:4px; white-space:nowrap; }
.ibh-acts .material-symbols-rounded{ font-size:20px; }
.btn.ibx-pick{ min-height:44px; }
:root{ --ibh-good:#5EE6C7; --ibh-bad:#FFB08A; }
html.fk-light{ --ibh-good:#0A7360; --ibh-bad:#A9390B; }
.ibh-eval{ display:flex; gap:6px; align-items:flex-start; margin:10px 0 0; font-size:13px; line-height:1.45; color:var(--text); }
.ibh-eval .material-symbols-rounded{ font-size:18px; color:var(--accent, var(--mint, #5EE6C7)); flex:0 0 auto; }
/* 21/11/2026: phiếu chi tiết + hình giải phẫu + đánh giá */
:root{ --ibs-low:#FFC857; --ibs-ok:var(--accent, var(--mint, #5EE6C7)); --ibs-high:#FF7A7A; --ibs-na:rgba(var(--fk-ov-rgb,255,255,255),.16); }
html.fk-light{ --ibs-low:#D99A00; --ibs-high:#E04848; --ibs-na:rgba(0,0,0,.12); }
.ibr{ color:var(--text); }
.ibr-meta{ margin:0 0 10px; font-size:13px; color:var(--text-muted); }
.ibr-sec{ margin-top:14px; padding:12px; border-radius:14px; background:var(--surface, rgba(255,255,255,.05)); border:1px solid var(--border, rgba(255,255,255,.08)); }
.ibr-sec h4{ margin:0 0 8px; font-size:15px; font-weight:800; color:var(--text); }
.ibr-tbl{ width:100%; border-collapse:collapse; font-size:13.5px; }
.ibr-tbl td, .ibr-tbl th{ padding:6px 4px; border-bottom:1px solid var(--border, rgba(255,255,255,.08)); text-align:left; color:var(--text); }
.ibr-tbl td:last-child{ text-align:right; } .ibr-tbl th{ font-size:12px; color:var(--text-muted); font-weight:700; }
.ibr-hist td, .ibr-hist th{ text-align:right; } .ibr-hist td:first-child, .ibr-hist th:first-child{ text-align:left; }
.ibr-hist tr.on td{ font-weight:800; }
.ibr-dd{ display:block; font-style:normal; font-size:11px; color:var(--text-muted); font-weight:600; }
.ibr-stack{ display:flex; height:12px; border-radius:6px; overflow:hidden; margin-top:10px; background:var(--ibs-na); }
.ibr-stack i{ display:block; height:100%; }
.s-w{ background:#4CA8FF; } .s-p{ background:#A98BFF; } .s-m{ background:#B9B9B9; } .s-o{ background:#7FB8C9; } .s-f{ background:#FF9F6B; }
.ibr-leg{ display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; font-size:12px; color:var(--text-muted); }
.ibr-leg span{ display:inline-flex; align-items:center; gap:4px; } .ibr-leg i{ display:inline-block; width:10px; height:10px; border-radius:3px; }
.ibr-leg i.ibs-low{ background:var(--ibs-low); } .ibr-leg i.ibs-ok{ background:var(--ibs-ok); } .ibr-leg i.ibs-high{ background:var(--ibs-high); }
.ibr-bar{ display:grid; grid-template-columns:72px 1fr 78px; align-items:center; gap:8px; margin:8px 0; }
.ibr-bl{ font-size:13px; color:var(--text); font-weight:600; }
.ibr-track{ position:relative; height:14px; border-radius:7px; background:var(--ibs-na); overflow:hidden; }
.ibr-zone{ position:absolute; top:0; bottom:0; background:rgba(var(--fk-ov-rgb,255,255,255),.22); outline:1px dashed rgba(var(--fk-ov-rgb,255,255,255),.45); }
html.fk-light .ibr-zone{ background:rgba(0,0,0,.10); outline-color:rgba(0,0,0,.35); }
.ibr-fill{ position:absolute; left:0; top:3px; bottom:3px; border-radius:5px; }
.ibr-fill.ibs-low{ background:var(--ibs-low); } .ibr-fill.ibs-ok{ background:var(--ibs-ok); } .ibr-fill.ibs-high{ background:var(--ibs-high); } .ibr-fill.ibs-na{ background:var(--text-muted); }
.ibr-bv{ text-align:right; font-size:14px; font-weight:800; color:var(--text); white-space:nowrap; } .ibr-bv small{ font-size:11px; font-weight:600; color:var(--text-muted); margin-left:2px; }
.ibr-note{ margin:6px 0 0; font-size:12px; line-height:1.45; color:var(--text-muted); }
.ibr-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(96px, 1fr)); gap:8px; margin-top:10px; }
.ibr-grid div{ padding:8px; border-radius:10px; border:1px solid var(--border, rgba(255,255,255,.08)); min-width:0; }
.ibr-grid small{ display:block; font-size:11.5px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ibr-grid b{ font-size:16px; font-weight:800; color:var(--text); } .ibr-grid b i{ font-style:normal; font-size:11px; color:var(--text-muted); margin-left:2px; }
.ibr-body{ max-width:420px; margin:8px auto 0; color:var(--text); }
.ibs-svg{ width:100%; height:auto; display:block; }
.ibs-r{ stroke:currentColor; stroke-opacity:.45; stroke-width:1.2; stroke-linejoin:round; fill-opacity:.62; }
.ibs-low{ fill:var(--ibs-low); } .ibs-ok{ fill:var(--ibs-ok); } .ibs-high{ fill:var(--ibs-high); } .ibs-na{ fill:var(--ibs-na); }
.ibs-head{ fill:var(--ibs-na); stroke:currentColor; stroke-opacity:.35; } .ibs-hair{ fill:currentColor; fill-opacity:.35; }
.ibs-detail{ fill:none; stroke:currentColor; stroke-opacity:.3; stroke-width:1; }
.ibs-lead{ stroke:currentColor; stroke-opacity:.35; stroke-width:1; stroke-dasharray:2 2; }
.ibs-t1{ font-size:12px; font-weight:800; fill:currentColor; } .ibs-t2{ font-size:12px; font-weight:700; fill:currentColor; } .ibs-t3{ font-size:11px; font-weight:600; fill:currentColor; fill-opacity:.8; }
.ibs-side{ font-size:16px; font-weight:900; fill:currentColor; fill-opacity:.55; }
.ibr-eval{ padding:12px; border-radius:14px; border:1px solid rgba(var(--accent-rgb, 94,230,199),.45); background:rgba(var(--accent-rgb, 94,230,199),.08); color:var(--text); margin-top:10px; }
.ibr-eh{ display:flex; align-items:center; flex-wrap:wrap; gap:6px; } .ibr-eh b{ font-size:15px; } .ibr-eh small{ font-size:11.5px; color:var(--text-muted); }
.ibr-eh .material-symbols-rounded{ color:var(--accent, var(--mint, #5EE6C7)); }
html.fk-light .ibr-eh .material-symbols-rounded{ color:var(--text); }
.ibr-sum{ margin:6px 0 0; font-size:14px; line-height:1.5; }
.ibr-chips{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.ibr-chip{ font-size:12px; padding:4px 9px; border-radius:999px; border:1.5px solid; color:var(--text); background:transparent; }
.ibr-chip.ibs-c-ok{ border-color:var(--ibs-ok); } .ibr-chip.ibs-c-low{ border-color:var(--ibs-low); } .ibr-chip.ibs-c-high{ border-color:var(--ibs-high); }
.ibr-l{ margin-top:10px; } .ibr-l > b{ display:flex; align-items:center; gap:4px; font-size:13.5px; } .ibr-l > b .material-symbols-rounded{ font-size:18px; }
.ibr-l ul{ margin:4px 0 0; padding-left:20px; font-size:13.5px; line-height:1.5; } .ibr-l li{ margin:2px 0; }
.ibr-l.good > b .material-symbols-rounded{ color:var(--ibh-good); } .ibr-l.imp > b .material-symbols-rounded{ color:var(--ibh-bad); }
.ibr-cmp, .ibr-next{ margin:10px 0 0; font-size:13px; line-height:1.45; } .ibr-next{ display:flex; gap:4px; align-items:flex-start; } .ibr-next .material-symbols-rounded{ font-size:18px; }
.ibr-med{ margin:10px 0 0; font-size:11.5px; color:var(--text-muted); font-style:italic; }
.ibr-dboxes{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.ibr-dbox{ padding:8px; border-radius:10px; border:1px solid var(--border, rgba(255,255,255,.08)); } .ibr-dbox small{ display:block; font-size:11.5px; color:var(--text-muted); } .ibr-dbox b{ font-size:13px; }
.ibr-sps{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; margin:10px 0; }
.ibr-sp small{ display:block; font-size:11.5px; color:var(--text-muted); } .ibr-sp svg{ width:100%; height:32px; display:block; }
.ibx-review .ibr-eval{ margin-top:10px; }
`;
function injectCSS(){
  try{
    if(!D || !D.head || (D.getElementById("ibx-css") && D.getElementById("ibx-css").parentNode)) return;
    const st = D.createElement("style"); st.id = "ibx-css"; st.textContent = CSS; D.head.appendChild(st);
  }catch(_){}
}
const dd2 = ts=>{ const d = new Date(ts); return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`; };
/** sparkline nhỏ (không nhãn) — màu theo token accent của theme */
function sparkSVG(series){
  if(!series || series.length < 2) return "";
  const W = 200, H = 36, P = 4, vs = series.map(p=> p.v), lo = Math.min(...vs), hi = Math.max(...vs), rg = (hi - lo) || 1;
  const x = i=> P + i * (W - 2 * P) / (series.length - 1), y = v=> H - P - (v - lo) / rg * (H - 2 * P);
  const pts = series.map((p, i)=> `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" "), L = series.length - 1;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polyline points="${pts}" fill="none" style="stroke:var(--accent, var(--mint, #5EE6C7))" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="${x(L).toFixed(1)}" cy="${y(series[L].v).toFixed(1)}" r="3" style="fill:var(--accent, var(--mint, #5EE6C7))"/></svg>`;
}
const ACTS = `<button type="button" class="btn btn-primary btn-sm" data-ibh="camera"><span class="material-symbols-rounded">photo_camera</span>Chụp phiếu</button>
  <button type="button" class="btn btn-outline btn-sm" data-ibh="gallery"><span class="material-symbols-rounded">photo_library</span>Chọn ảnh</button>`;
/** HTML bên trong thẻ trang chủ (rỗng/đã có số liệu) */
function homeHTML(logs){
  const cmp = compare(logs);
  const title = `<div class="card-title"><span class="material-symbols-rounded">monitor_weight</span>Thành phần cơ thể`;
  if(!cmp || !cmp.rows.length){
    return `${title}</div>
      <p class="ibh-lead">Theo dõi thành phần cơ thể — chụp phiếu InBody, AI tự điền số.</p>
      <div class="ibh-acts">${ACTS}</div>`;
  }
  const pick3 = ["weight", "muscle", "pbf"].map(k=> cmp.rows.find(r=> r.k === k) || { k, label: (METRICS.find(m=> m.k === k) || {}).label, v:null, d:null, tone:"flat", unit: k === "pbf" ? "%" : "kg" });
  const LAB = { weight:"Cân nặng", muscle:"Cơ xương", pbf:"% mỡ" };
  const delta = r=>{
    if(r.d == null) return `<em class="ibh-d flat">—</em>`;
    const ic = r.d > 0 ? "arrow_upward" : r.d < 0 ? "arrow_downward" : "remove";
    const word = r.tone === "good" ? "tốt" : r.tone === "bad" ? "chưa tốt" : "";
    return `<em class="ibh-d ${r.tone}" aria-label="${r.d > 0 ? "tăng" : r.d < 0 ? "giảm" : "không đổi"} ${esc(vn(Math.abs(r.d)))} ${esc(r.unit)}${word ? ", " + word : ""}"><span class="material-symbols-rounded" aria-hidden="true">${ic}</span>${r.d > 0 ? "+" : ""}${esc(vn(r.d))}</em>`;
  };
  const sk = metricSeries(logs, "muscle").length >= 2 ? "muscle" : "weight";
  const ser = metricSeries(logs, sk).slice(-8);
  const sp = sparkSVG(ser);
  return `${title}<span class="ibh-when">Đo ${esc(dd2(cmp.last.ts))} · ${cmp.n} lần</span></div>
    <div class="ibh-row">${pick3.map(r=> `<div class="ibh-cell"><small>${esc(LAB[r.k])}</small><b>${r.v == null ? "--" : esc(vn(r.v))}<i>${esc(r.unit)}</i></b>${r.v == null ? "" : delta(r)}</div>`).join("")}</div>
    ${(()=>{ const ln = homeEvalLine(logs); return ln ? `<p class="ibh-eval"><span class="material-symbols-rounded" aria-hidden="true">psychology</span><span>${esc(ln)}</span></p>` : ""; })()}
    ${sp ? `<div class="ibh-spark">${sp}<small>${esc(LAB[sk])} · ${ser.length} lần gần nhất</small></div>` : `<p class="ibh-lead">Đo thêm lần nữa (cách 3–4 tuần) để thấy thay đổi.</p>`}
    <div class="ibh-acts">${ACTS}<button type="button" class="btn btn-soft btn-sm" data-ibh="detail"><span class="material-symbols-rounded">insights</span>Xem chi tiết</button><button type="button" class="btn btn-ghost btn-sm" data-ibh="manage"><span class="material-symbols-rounded">delete</span>Xoá kết quả</button></div>`;
}
/** mở màn Tiến độ ở tab "Chỉ số InBody" + phiếu chi tiết lần đo mới nhất (opts.report === false → chỉ mở tab) */
function openDetail(opts){
  try{ if(typeof progressUI !== "undefined" && progressUI) progressUI.tab = "inbody"; }catch(_){}
  try{ if(typeof goto === "function") goto("progress"); }catch(e){ try{ console.warn("[inbody] goto", e); }catch(_){} }
  try{ if(typeof progressUI !== "undefined" && progressUI && progressUI.tab !== "inbody"){ progressUI.tab = "inbody"; if(typeof renderProgressScreen === "function") renderProgressScreen(); } }catch(_){}
  if(opts && opts.report === false) return;
  const L = sorted((ST() || {}).inbodyLogs); if(L.length) try{ openReport(L[L.length - 1].id); }catch(e){ try{ console.warn("[inbody] report", e); }catch(_){} }
}

/* ---------------------------------------------------------------------
   7. PHIẾU CHI TIẾT LẦN ĐO (21/11/2026) — kiểu phiếu kết quả: thành phần cơ thể, cơ–mỡ, béo phì, HÌNH GIẢI PHẪU
      THEO GIỚI TÍNH (SVG tự vẽ, 5 vùng), lịch sử & so sánh, đánh giá (AI hoặc luật trên máy).
      Không dùng ảnh người thật / logo thương hiệu. Màu theo token theme.
   --------------------------------------------------------------------- */
const SEGS = [ { k:"ra", name:"Tay phải", short:"Tay P" }, { k:"la", name:"Tay trái", short:"Tay T" }, { k:"tr", name:"Thân", short:"Thân" },
  { k:"rl", name:"Chân phải", short:"Chân P" }, { k:"ll", name:"Chân trái", short:"Chân T" } ];
const toneOf = pct=> !fin(pct) ? "na" : pct < 90 ? "low" : pct > 110 ? "high" : "ok";
const TONE_TXT = { low:"Thấp", ok:"Chuẩn", high:"Cao", na:"--" };
/** SVG cơ thể người (nhìn trực diện) theo giới tính, 5 vùng tô màu theo % chuẩn. seg = { ra,la,tr,rl,ll:{kg,pct} } | null.
    Quy ước: tay/chân PHẢI của người nằm bên TRÁI hình. */
function bodySVG(gender, seg, kind){
  const fem = gender === "female", C = 170;
  const S = fem ? 37 : 45, Wst = fem ? 25 : 34, H = fem ? 42 : 36, a = fem ? 11 : 14;   // nửa vai, nửa eo, nửa hông, bề ngang cánh tay
  const kneeO = fem ? H - 12 : H - 7, ankO = fem ? H - 24 : H - 18;
  const X = (sg, dx)=> (C + sg * dx).toFixed(1);
  const P = pts=> pts.map((p, i)=> (i ? "L" : "M") + p[0] + "," + p[1]).join(" ") + " Z";
  const arm = sg=> P([[X(sg, S - 6), 58], [X(sg, S + a - 4), 64], [X(sg, S + a + 1), 80], [X(sg, S + a + 7), 120], [X(sg, S + a + 13), 166], [X(sg, S + a + 15), 184],
    [X(sg, S + a + 8), 192], [X(sg, S + a + 2), 184], [X(sg, S + a + 13 - a * 0.7), 166], [X(sg, S + a + 7 - a * 0.85), 122], [X(sg, S + 1), 86], [X(sg, S - 2), 70]]);
  const leg = sg=> P([[X(sg, 2), 160], [X(sg, H), 160], [X(sg, H + (fem ? 1 : 0)), 178], [X(sg, kneeO), 218], [X(sg, ankO), 268], [X(sg, ankO + 2), 284],
    [X(sg, 6), 284], [X(sg, 7), 268], [X(sg, 6), 218], [X(sg, 2), 172]]);
  const trunk = `M${X(-1, S - 6)},58 Q${C},50 ${X(1, S - 6)},58 L${X(1, S - 2)},70 L${X(1, S + 1)},86 L${X(1, Wst)},${fem ? 118 : 120} Q${X(1, H + (fem ? 3 : 1))},140 ${X(1, H)},160 L${X(-1, H)},160 Q${X(-1, H + (fem ? 3 : 1))},140 ${X(-1, Wst)},${fem ? 118 : 120} L${X(-1, S + 1)},86 L${X(-1, S - 2)},70 Z`;
  const shapes = { ra: arm(-1), la: arm(1), tr: trunk, rl: leg(-1), ll: leg(1) };
  const has = !!seg;
  const region = k=>{ const v = has && seg[k] ? seg[k] : {}; const t = has ? toneOf(v.pct) : "na";
    return `<path d="${shapes[k]}" class="ibs-r ibs-${t}" data-seg="${k}" data-tone="${t}"><title>${esc((SEGS.find(s=> s.k === k) || {}).name)}${fin(v.pct) ? ` · ${esc(vn(v.pct))}%` : ""}</title></path>`; };
  const lab = (k, x, y, anchor, lx, ly)=>{
    const s = SEGS.find(q=> q.k === k), v = has && seg[k] ? seg[k] : {}, t = has ? toneOf(v.pct) : "na";
    const kg = fin(v.kg) ? `${vn(v.kg)} kg` : "-- kg", pc = fin(v.pct) ? `${vn(v.pct)}% · ${TONE_TXT[t]}` : "--";
    const dotX = anchor === "start" ? x : x - 8;
    return `<g class="ibs-lab" data-lab="${k}"><line x1="${lx[0]}" y1="${ly[0]}" x2="${lx[1]}" y2="${ly[1]}" class="ibs-lead"/>
      <text x="${x}" y="${y}" text-anchor="${anchor}" class="ibs-t1">${esc(s.short)}</text>
      <text x="${x}" y="${y + 15}" text-anchor="${anchor}" class="ibs-t2">${esc(kg)}</text>
      <rect x="${anchor === "start" ? x : x - 8}" y="${y + 21}" width="8" height="8" rx="2" class="ibs-${t}"/><text x="${anchor === "start" ? dotX + 11 : x - 11}" y="${y + 29}" text-anchor="${anchor}" class="ibs-t3">${esc(pc)}</text></g>`;
  };
  const trV = has && seg.tr ? seg.tr : {};
  const armX = S + a + 6, legX = H - 4;
  return `<svg viewBox="0 0 340 300" class="ibs-svg" role="img" data-gender="${fem ? "female" : "male"}" aria-label="${esc(`Hình cơ thể ${fem ? "nữ" : "nam"} — ${kind === "fat" ? "mỡ" : "nạc"} từng phần`)}">
    <text x="14" y="18" class="ibs-side">P</text><text x="326" y="18" text-anchor="end" class="ibs-side">T</text>
    <circle cx="${C}" cy="30" r="${fem ? 16 : 17}" class="ibs-head"/>${fem ? `<path d="M${C - 16},30 Q${C - 18},8 ${C},10 Q${C + 18},8 ${C + 16},30 Q${C + 12},18 ${C},17 Q${C - 12},18 ${C - 16},30 Z" class="ibs-hair"/>` : ""}
    <rect x="${C - 6}" y="44" width="12" height="12" rx="3" class="ibs-head"/>
    ${["tr", "ra", "la", "rl", "ll"].map(region).join("")}
    ${fem ? `<path d="M${C - 18},92 Q${C - 10},100 ${C - 2},94 M${C + 2},94 Q${C + 10},100 ${C + 18},92" class="ibs-detail"/>` : `<path d="M${C},66 L${C},96" class="ibs-detail"/>`}
    <text x="${C}" y="112" text-anchor="middle" class="ibs-t1">${esc("Thân")}</text>
    <text x="${C}" y="127" text-anchor="middle" class="ibs-t2">${esc(fin(trV.kg) ? vn(trV.kg) + " kg" : "-- kg")}</text>
    <text x="${C}" y="141" text-anchor="middle" class="ibs-t3">${esc(fin(trV.pct) ? vn(trV.pct) + "%" : "--")}</text>
    ${lab("ra", 6, 92, "start", [62, C - armX + 2], [112, 118])}
    ${lab("la", 334, 92, "end", [278, C + armX - 2], [112, 118])}
    ${lab("rl", 6, 214, "start", [62, C - legX], [234, 222])}
    ${lab("ll", 334, 214, "end", [278, C + legX], [234, 222])}
  </svg>`;
}
/** thẻ đánh giá (AI hoặc luật) */
function evalCardHTML(ev, opts){
  if(!ev) return "";
  opts = opts || {};
  const ST4 = [["weight", "Cân nặng"], ["muscle", "Cơ"], ["fat", "Mỡ"], ["visceral", "Mỡ nội tạng"]], W = { low:"Thấp", normal:"Chuẩn", high:"Cao" };
  const tone = (k, v)=> v === "normal" || (k === "muscle" && v === "high") ? "ok" : v === "low" ? "low" : "high";
  const st = ev.status || {};
  const chips = ST4.filter(([k])=> st[k]).map(([k, lab])=> `<span class="ibr-chip ibs-c-${tone(k, st[k])}">${esc(lab)}: <b>${esc(W[st[k]] || "--")}</b></span>`).join("");
  const list = (arr, ic, title, cls)=> Array.isArray(arr) && arr.length ? `<div class="ibr-l ${cls}"><b><span class="material-symbols-rounded" aria-hidden="true">${ic}</span>${esc(title)}</b><ul>${arr.map(x=> `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
  const nd = fin(Number(ev.nextCheckDays != null ? ev.nextCheckDays : ev.next_check_days)) ? Number(ev.nextCheckDays != null ? ev.nextCheckDays : ev.next_check_days) : null;
  const ai = ev.src !== "rule";
  return `<div class="ibr-eval" data-src="${ai ? "ai" : "rule"}">
    <div class="ibr-eh"><span class="material-symbols-rounded" aria-hidden="true">${ai ? "psychology" : "rule"}</span><b>${ai ? "Đánh giá của AI" : "Đánh giá tự động"}</b>${ai ? "" : `<small>theo khoảng chuẩn · không tốn lượt AI</small>`}</div>
    ${ev.summary ? `<p class="ibr-sum">${esc(ev.summary)}</p>` : ""}
    ${chips ? `<div class="ibr-chips">${chips}</div>` : ""}
    ${list(ev.good, "check_circle", "Điểm tốt", "good")}${list(ev.improve, "trending_up", "Cần cải thiện", "imp")}${list(ev.advice, "lightbulb", "Lời khuyên", "adv")}
    ${ev.compare ? `<p class="ibr-cmp"><b>So với lần trước:</b> ${esc(ev.compare)}</p>` : ""}
    ${nd ? `<p class="ibr-next"><span class="material-symbols-rounded" aria-hidden="true">event</span><span>Đo lại sau khoảng <b>${esc(String(Math.round(nd)))} ngày</b>${opts.ts ? ` (≈ ${esc(dd2(opts.ts + nd * 86400000))})` : ""} — cùng giờ, trước khi ăn và tập.</span></p>` : ""}
    <p class="ibr-med">Thông tin tham khảo — không thay thế tư vấn y khoa.</p>
  </div>`;
}
/** thanh ngang kiểu phiếu: giá trị so với chuẩn (%), vùng chuẩn tô nền */
function barRow(label, val, unit, pct, lo, hi, scale){
  const [a, b] = scale || [40, 220];
  const pos = v=> Math.max(0, Math.min(100, (v - a) / (b - a) * 100));
  const t = !fin(pct) ? "na" : pct < lo ? "low" : pct > hi ? "high" : "ok";
  return `<div class="ibr-bar"><span class="ibr-bl">${esc(label)}</span><div class="ibr-track"><i class="ibr-zone" style="left:${pos(lo).toFixed(1)}%;width:${(pos(hi) - pos(lo)).toFixed(1)}%"></i>${fin(pct) ? `<i class="ibr-fill ibs-${t}" style="width:${pos(pct).toFixed(1)}%"></i>` : ""}</div><b class="ibr-bv">${val == null ? "--" : esc(vn(val))}<small>${esc(unit)}</small></b></div>`;
}
function reportHTML(log, logs, tab){
  const p = PROF(), g = genderOf(log, p), s = statusOf(log, p), h = Number(p.height) >= 100 && Number(p.height) <= 250 ? Number(p.height) / 100 : null;
  const v = x=> fin(x) ? x : null, W = v(log.weight), fat = fatKg(log), smm = v(log.muscleMassKg);
  const tbw = v(log.tbwL) != null ? log.tbwL : (v(log.bodyWaterPct) != null && W ? r1(W * log.bodyWaterPct / 100) : null);
  const ffm = v(log.ffmKg) != null ? log.ffmKg : (W != null && fat != null ? r1(W - fat) : null);
  const d = new Date(log.ts), dateTxt = isNaN(d) ? "--" : `${dd2(log.ts)}/${d.getFullYear()}`;
  const std = h ? 22 * h * h : null;
  const pctOf = (x, ref)=> x != null && ref ? x / ref * 100 : null;
  const comp = [["Tổng lượng nước", tbw, "L"], ["Protein", v(log.proteinKg), "kg"], ["Khoáng chất", v(log.mineralsKg), "kg"], ["Mỡ", fat, "kg"], ["Khối nạc (không mỡ)", ffm, "kg"], ["Cân nặng", W, "kg"]];
  const stack = W && tbw != null && fat != null ? (()=>{ const pr = v(log.proteinKg), mi = v(log.mineralsKg), rest = Math.max(0, W - tbw - fat - (pr || 0) - (mi || 0));
    const seg = (x, cls, lab)=> x ? `<i class="${cls}" style="width:${(x / W * 100).toFixed(1)}%" title="${esc(lab)}"></i>` : "";
    return `<div class="ibr-stack" aria-hidden="true">${seg(tbw, "s-w", "Nước")}${seg(pr, "s-p", "Protein")}${seg(mi, "s-m", "Khoáng")}${seg(pr || mi ? 0 : rest, "s-o", "Khác")}${seg(fat, "s-f", "Mỡ")}</div>
      <div class="ibr-leg"><span><i class="s-w"></i>Nước</span>${pr ? `<span><i class="s-p"></i>Protein</span>` : ""}${mi ? `<span><i class="s-m"></i>Khoáng</span>` : ""}<span><i class="s-f"></i>Mỡ</span></div>`; })() : "";
  const [plo, phi] = s.pbfRange;
  const others = [["Mỡ nội tạng", v(log.visceralFat), "cấp"], ["BMR", v(log.bmr), "kcal"], ["Điểm", v(log.score), "/100"], ["Tỉ lệ eo/hông", v(log.whr), ""], ["ECW/TBW", v(log.ecwRatio), ""],
    ["SMI", v(log.smi), "kg/m²"], ["Độ béo phì", v(log.obesityDegree), "%"], ["Cơ mềm (SLM)", v(log.slmKg), "kg"]].filter(r=> r[1] != null);
  const ctrl = [["Cân mục tiêu", v(log.targetWeight), "kg"], ["Điều chỉnh cân", v(log.weightControl), "kg"], ["Điều chỉnh mỡ", v(log.fatControl), "kg"], ["Điều chỉnh cơ", v(log.muscleControl), "kg"]].filter(r=> r[1] != null);
  const fmtV = (x, u)=> u === "kcal" ? String(Math.round(x)) : (u === "" && x < 2 ? String(x).replace(".", ",") : vn(x));
  const segData = tab === "fat" ? log.segFat : log.segLean;
  const ev = evalFor(log, logs, p);
  /* lịch sử & so sánh */
  const L = sorted(logs), upto = L.filter(l=> l.ts <= log.ts), pr = progress(logs, p, log);
  const hist = upto.slice(-8).reverse();
  const dCell = x=> x == null ? "" : `<em class="ibr-dd">${esc(sgn(x))}</em>`;
  const histRows = hist.map((l, i)=>{ const prev = upto[upto.length - 2 - i]; const dx = prev ? diff(l, prev) : null;
    return `<tr${l === log || l.id === log.id ? ` class="on"` : ""}><td>${esc(dd2(l.ts))}/${esc(String(new Date(l.ts).getFullYear()).slice(2))}</td><td>${fin(l.weight) ? esc(vn(l.weight)) : "--"}${dx ? dCell(dx.dw) : ""}</td><td>${fin(l.muscleMassKg) ? esc(vn(l.muscleMassKg)) : "--"}${dx ? dCell(dx.dsmm) : ""}</td><td>${fin(l.bodyFatPct) ? esc(vn(l.bodyFatPct)) : "--"}${dx ? dCell(dx.dpbf) : ""}</td></tr>`; }).join("");
  const dBox = (t, x)=> x ? `<div class="ibr-dbox"><small>${esc(t)} · ${esc(String(x.days))} ngày</small><b>${esc(dTxt(x) || "--")}</b></div>` : "";
  const spark = k=>{ const ser = metricSeries(upto, k).slice(-8); return ser.length >= 2 ? `<div class="ibr-sp"><small>${esc({ weight:"Cân nặng", muscle:"Cơ xương", pbf:"% mỡ" }[k])}</small>${sparkSVG(ser)}</div>` : ""; };
  const sparks = ["weight", "muscle", "pbf"].map(spark).join("");
  const canAsk = !!(G.FKCoach && typeof G.FKCoach.open === "function") && upto.length >= 2;
  return `<div class="sheet-header"><h3>Phiếu thành phần cơ thể</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
  <div class="ibr" data-ibr="${esc(String(log.id))}">
    <p class="ibr-meta">${esc(dateTxt)} · ${g === "female" ? "Nữ" : "Nam"}${log.device ? " · " + esc(log.device) : ""}${log.scan ? " · đọc từ phiếu" : ""}</p>
    ${evalCardHTML(ev, { ts: log.ts })}
    <section class="ibr-sec"><h4>Thành phần cơ thể</h4>
      <table class="ibr-tbl">${comp.map(([lab, x, u])=> `<tr><td>${esc(lab)}</td><td><b>${x == null ? "--" : esc(vn(x))}</b> ${esc(u)}</td></tr>`).join("")}</table>${stack}</section>
    <section class="ibr-sec"><h4>Phân tích cơ – mỡ</h4>
      ${barRow("Cân nặng", W, "kg", pctOf(W, std), 85, 115)}
      ${barRow("Cơ xương", smm, "kg", pctOf(smm, std ? std * (g === "female" ? 0.42 : 0.50) : null), 90, 110)}
      ${barRow("Khối mỡ", fat, "kg", pctOf(fat, std ? std * (g === "female" ? 0.23 : 0.15) : null), 80, 160)}
      <p class="ibr-note">Thanh = % so với mức chuẩn theo chiều cao ${h ? esc(vn(h * 100)) + " cm" : "(chưa có)"}; nền nhạt = vùng chuẩn.</p></section>
    <section class="ibr-sec"><h4>Chỉ số béo phì</h4>
      ${barRow("BMI", s.bmi, "kg/m²", s.bmi, 18.5, 22.9, [10, 40])}
      ${barRow("% mỡ", v(log.bodyFatPct), "%", v(log.bodyFatPct), plo, phi, [0, 50])}
      <p class="ibr-note">Chuẩn tham khảo: BMI 18,5–22,9 (châu Á) · % mỡ ${g === "female" ? "nữ" : "nam"} ${plo}–${phi}%.</p>
      ${others.length ? `<div class="ibr-grid">${others.map(([lab, x, u])=> `<div><small>${esc(lab)}</small><b>${esc(fmtV(x, u))}<i>${esc(u)}</i></b></div>`).join("")}</div>` : ""}
      ${ctrl.length ? `<div class="ibr-grid ctrl">${ctrl.map(([lab, x, u])=> `<div><small>${esc(lab)}</small><b>${esc(lab === "Cân mục tiêu" ? vn(x) : sgn(x))}<i>${esc(u)}</i></b></div>`).join("")}</div>` : ""}</section>
    <section class="ibr-sec"><h4>Phân tích từng phần</h4>
      <div class="ibx-chips" role="tablist"><button type="button" role="tab" data-ibr-tab="lean" aria-selected="${tab !== "fat"}" class="${tab !== "fat" ? "on" : ""}">Nạc từng phần</button><button type="button" role="tab" data-ibr-tab="fat" aria-selected="${tab === "fat"}" class="${tab === "fat" ? "on" : ""}">Mỡ từng phần</button></div>
      <div class="ibr-body">${bodySVG(g, segData || null, tab === "fat" ? "fat" : "lean")}</div>
      ${segData ? "" : `<p class="ibr-note ibr-noseg">Phiếu không có phân tích từng phần.</p>`}
      <div class="ibr-leg"><span><i class="ibs-low"></i>Thấp &lt;90%</span><span><i class="ibs-ok"></i>Chuẩn 90–110%</span><span><i class="ibs-high"></i>Cao &gt;110%</span></div>
      <p class="ibr-note">Nhìn trực diện: bên trái hình là bên <b>PHẢI (P)</b> cơ thể, bên phải hình là bên <b>TRÁI (T)</b>.</p></section>
    <section class="ibr-sec"><h4>Lịch sử &amp; so sánh</h4>
      ${upto.length < 2 ? `<p class="ibr-note">Mới có 1 lần đo. Tập đều 3–4 tuần rồi chụp phiếu lần nữa để app so sánh và đưa lời khuyên.</p>` : `
      <div class="ibr-dboxes">${dBox("So với lần trước", pr && pr.dPrev)}${dBox("So với lần đầu", pr && pr.dFirst)}</div>
      ${sparks ? `<div class="ibr-sps">${sparks}</div>` : ""}
      <table class="ibr-tbl ibr-hist"><thead><tr><th>Ngày</th><th>Cân (kg)</th><th>Cơ (kg)</th><th>% mỡ</th></tr></thead><tbody>${histRows}</tbody></table>
      ${pr && (pr.notes.length || pr.advice.length) ? `<div class="ibr-l adv"><b><span class="material-symbols-rounded" aria-hidden="true">route</span>Tiến trình</b><ul>${pr.notes.concat(ev.src === "rule" ? [] : pr.advice).map(x=> `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${canAsk ? `<button type="button" class="btn btn-outline btn-block" data-ibr-ai style="margin-top:10px;"><span class="material-symbols-rounded">smart_toy</span>&nbsp;Nhờ AI đánh giá tiến trình <small>(tốn 1 lượt AI)</small></button>` : ""}`}
    </section>
    <p class="ibr-med">Số liệu từ máy đo tại phòng tập có sai số; dùng để theo dõi xu hướng. Không thay thế tư vấn y khoa.</p>
  </div>`;
}
/** câu hỏi gửi Trợ lý AI (tốn 1 lượt) — tóm tắt các lần đo */
function coachQuestion(log, logs){
  const p = PROF(), L = sorted(logs).filter(l=> l.ts <= log.ts).slice(-6);
  const g = { lose:"giảm mỡ", gain:"tăng cơ", maintain:"giữ dáng" }[p.goal] || "giữ dáng";
  const rows = L.map(l=> `${ymd(l.ts)}: cân ${fin(l.weight) ? vn(l.weight) : "--"} kg, cơ ${fin(l.muscleMassKg) ? vn(l.muscleMassKg) : "--"} kg, mỡ ${fin(l.bodyFatPct) ? vn(l.bodyFatPct) : "--"}%`).join("; ");
  return `Đánh giá tiến trình thành phần cơ thể của tôi (mục tiêu ${g}). Các lần đo: ${rows}. Tôi nên điều chỉnh ăn uống và tập luyện thế nào?`.slice(0, 1400);
}
let reportTab = "lean";
function openReport(id, tab){
  const st = ST(); if(!st || typeof openSheet !== "function") return false;
  const logs = Array.isArray(st.inbodyLogs) ? st.inbodyLogs : [];
  const log = logs.find(l=> l && String(l.id) === String(id)); if(!log) return false;
  injectCSS();
  if(tab === "lean" || tab === "fat") reportTab = tab;
  openSheet(reportHTML(log, logs, reportTab));
  const sc = D.getElementById("sheet-content"); if(!sc) return true;
  sc.querySelectorAll("[data-ibr-tab]").forEach(b=> b.addEventListener("click", ()=>{
    reportTab = b.getAttribute("data-ibr-tab") === "fat" ? "fat" : "lean";
    const body = sc.querySelector(".ibr-body"); if(body) body.innerHTML = bodySVG(genderOf(log, PROF()), (reportTab === "fat" ? log.segFat : log.segLean) || null, reportTab);
    sc.querySelectorAll("[data-ibr-tab]").forEach(x=>{ const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", String(on)); });
  }));
  const ai = sc.querySelector("[data-ibr-ai]");
  if(ai) ai.addEventListener("click", ()=>{ const q = coachQuestion(log, logs); try{ if(typeof closeSheet === "function") closeSheet(); }catch(_){} try{ G.FKCoach.open({ tab: "chat", ask: q }); }catch(e){ say("Chưa mở được Trợ lý AI", "error"); } });
  return true;
}
/** 1 dòng tóm tắt đánh giá cho thẻ trang chủ */
function homeEvalLine(logs){
  const L = sorted(logs); if(!L.length) return "";
  const ev = evalFor(L[L.length - 1], L, PROF()); const s = String((ev && ev.summary) || "");
  return s.length > 150 ? s.slice(0, 147) + "…" : s;
}
let homeCard = null;
const inHome = el=>{ try{ return !!(homeCard && el && homeCard.parentNode === el && Array.prototype.indexOf.call(el.children || [], homeCard) >= 0); }catch(_){ return false; } };
function onHomeClick(e){
  const t = e && e.target && e.target.closest ? e.target.closest("[data-ibh]") : null;
  const k = t && (t.getAttribute ? t.getAttribute("data-ibh") : (t.dataset || {}).ibh);
  if(!k) return;
  if(k === "camera") pick({ camera:true }); else if(k === "gallery") pick({ camera:false }); else if(k === "detail") openDetail(); else if(k === "manage") openManage();
}
/* 21/11 (anh Thắng): xoá kết quả InBody ngay từ trang chủ (bỏ các lần chụp thử bằng phiếu mẫu) — từng lần hoặc tất cả, có xác nhận */
function openManage(){
  const st = ST(); if(!st || typeof openSheet !== "function") return;
  const logs = (Array.isArray(st.inbodyLogs) ? st.inbodyLogs : []).slice().sort((a, b)=> (b.ts || 0) - (a.ts || 0));
  const fmtD = ts=>{ const d = new Date(ts); return isNaN(d) ? "--" : `${dd2(ts)}/${d.getFullYear()}`; };
  const val = (v, u)=> v == null || v === "" || !Number.isFinite(Number(v)) ? "" : `${vn(Number(v))}${u}`;
  const row = l=>{
    const bits = [val(l.weight, " kg"), l.muscleMassKg != null ? "cơ " + val(l.muscleMassKg, " kg") : "", l.bodyFatPct != null ? "mỡ " + val(l.bodyFatPct, "%") : ""].filter(Boolean).join(" · ");
    return `<div class="ibm-row" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(var(--fk-ov-rgb,255,255,255),.1)">
      <div style="flex:1;min-width:0"><b style="display:block">${esc(fmtD(l.ts))}${l.source === "ai" ? ' <small class="pill" style="font-size:11px">AI</small>' : ""}</b><small class="small-note">${esc(bits || "Không có số")}${l.note ? " · " + esc(String(l.note).slice(0, 40)) : ""}</small></div>
      <button type="button" class="btn btn-ghost btn-sm" data-ibm-del="${esc(String(l.id))}" aria-label="Xoá lần đo ${esc(fmtD(l.ts))}" style="color:var(--warn)"><span class="material-symbols-rounded">delete</span>Xoá</button></div>`;
  };
  openSheet(`<div class="sheet-header"><h3>Kết quả InBody</h3></div>
    ${logs.length ? `<p class="small-note">Xoá các lần đo chụp thử / sai số. Đã xoá thì không khôi phục được.</p><div>${logs.map(row).join("")}</div>
    <button type="button" class="btn btn-outline btn-block" data-ibm-all style="margin-top:14px;color:var(--warn)"><span class="material-symbols-rounded">delete_sweep</span>Xoá tất cả (${logs.length})</button>` : `<p class="empty-hint">Chưa có kết quả nào.</p>`}`);
  const sc = D.getElementById("sheet-content"); if(!sc) return;
  const done = msg=>{ try{ if(typeof saveState === "function") saveState(); }catch(_){} homeRefresh();
    try{ if(typeof progressUI !== "undefined" && progressUI && progressUI.tab === "inbody" && D.getElementById("progress-content") && typeof renderProgressInbodyTab === "function") renderProgressInbodyTab(); }catch(_){}
    try{ if(typeof toast === "function") toast(msg, "delete"); }catch(_){}
    setTimeout(()=>{ const s2 = ST(); if(s2 && s2.inbodyLogs && s2.inbodyLogs.length) openManage(); else if(typeof closeSheet === "function") closeSheet(); }, 60); };
  const ask = (t, m, fn)=> typeof confirmDialog === "function" ? confirmDialog(t, m, fn, "Xoá", "delete_forever") : fn();
  sc.querySelectorAll("[data-ibm-del]").forEach(b=> b.addEventListener("click", ()=>{
    const id = b.getAttribute("data-ibm-del");
    ask("Xoá lần đo này?", "Lần đo sẽ bị xoá khỏi biểu đồ và không thể khôi phục.", ()=>{
      const s2 = ST(); s2.inbodyLogs = (s2.inbodyLogs || []).filter(l=> String(l.id) !== String(id)); done("Đã xoá lần đo");
    });
  }));
  const all = sc.querySelector("[data-ibm-all]");
  if(all) all.addEventListener("click", ()=> ask("Xoá tất cả kết quả InBody?", "Toàn bộ lần đo sẽ bị xoá và không thể khôi phục.", ()=>{ const s2 = ST(); s2.inbodyLogs = []; done("Đã xoá tất cả kết quả"); }));
}
/** chèn / vẽ lại thẻ trên #home-content (không chèn trùng) */
function homeInject(){
  if(!D) return null;
  const el = D.getElementById("home-content"), st = ST();
  if(!el || !st) return null;
  if(st.onboarded === false) return null;
  injectCSS();
  try{ if(el.querySelectorAll) el.querySelectorAll(".ibh-card").forEach(n=>{ if(n !== homeCard) try{ n.remove(); }catch(_){} }); }catch(_){}
  const html = homeHTML(st.inbodyLogs);
  if(inHome(el)){
    if(homeCard.__ibh !== html){ homeCard.innerHTML = html; homeCard.__ibh = html; }
    return homeCard;
  }
  const card = D.createElement("section");
  card.className = "card ibh-card";
  card.setAttribute("data-home-zone", "personal");
  card.setAttribute("aria-label", "Thành phần cơ thể");
  card.innerHTML = html; card.__ibh = html;
  card.addEventListener("click", onHomeClick);
  el.appendChild(card);
  homeCard = card;
  try{ if(typeof teHomeLayout === "function") teHomeLayout(); }catch(_){}
  return card;
}
/** vẽ lại thẻ trang chủ nếu đang có (dữ liệu đổi) */
function homeRefresh(){ try{ if(D && inHome(D.getElementById("home-content"))) homeInject(); }catch(e){ try{ console.warn("[inbody] home", e); }catch(_){} } }
function install(){
  let ok = false;
  if(typeof renderProgressInbodyTab === "function" && !renderProgressInbodyTab.__ibx){
    const _r = renderProgressInbodyTab;
    renderProgressInbodyTab = function(){ const out = _r.apply(this, arguments); try{ decorate(); }catch(e){ try{ console.warn("[inbody]", e); }catch(_){} } homeRefresh(); return out; };
    renderProgressInbodyTab.__ibx = true; ok = true;
  }
  if(typeof openAddInbodyLog === "function" && !openAddInbodyLog.__ibx){
    const _o = openAddInbodyLog;
    openAddInbodyLog = function(){ pendingDevice = ""; pendingScan = null; const out = _o.apply(this, arguments); try{ injectExtra(); }catch(e){} return out; };
    openAddInbodyLog.__ibx = true;
  }
  if(typeof renderHomeScreen === "function" && !renderHomeScreen.__ibx){
    const _h = renderHomeScreen;
    renderHomeScreen = function(){ const out = _h.apply(this, arguments); try{ homeInject(); }catch(e){ try{ console.warn("[inbody] home", e); }catch(_){} } return out; };
    renderHomeScreen.__ibx = true;
    try{ if(D && D.getElementById("home-content") && D.getElementById("home-content").children && D.getElementById("home-content").children.length) homeInject(); }catch(_){}
  }
  return ok;
}
G.FKInbody = { openReport, reportHTML, bodySVG, evalCardHTML, ruleEval, evalFor, progress, statusOf, scanToLog, scanContext, attachExtra, homeEvalLine, coachQuestion, fill, analyze, openManage, clean, compare, verdict, metricSeries, chartSVG, fatKg, scan, pick, decorate, EXTRA, PROMPT, demoResult, install,
  homeHTML, homeInject, homeRefresh, openDetail, sparkSVG, isHeic, HEIC_MSG };
if(!install() && D) D.addEventListener("DOMContentLoaded", install, { once: true });
})(typeof window !== "undefined" ? window : globalThis);

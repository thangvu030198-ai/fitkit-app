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
  r.unreadable = (Array.isArray(o.unreadable) ? o.unreadable : []).map(x=> String(x)).filter(x=> Object.prototype.hasOwnProperty.call(FIELDS, x)).slice(0, 9);
  if(r.weight == null && r.smm == null && r.pbf == null && r.bfm == null) r.is_report = false;
  return r;
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
   2. GỌI AI
   --------------------------------------------------------------------- */
const PROMPT = `Bạn đọc ẢNH CHỤP PHIẾU KẾT QUẢ máy đo thành phần cơ thể (InBody, Tanita, Omron…). CHỈ CHÉP LẠI số IN TRÊN PHIẾU, KHÔNG tự tính, KHÔNG đoán; số không đọc rõ → null và ghi tên trường vào "unreadable".
weight = Cân nặng (kg; lb thì đổi ×0,4536) · smm = Khối lượng cơ xương / Skeletal Muscle Mass (kg, KHÔNG lấy Soft Lean Mass) · bfm = Khối lượng mỡ / Body Fat Mass (kg) · pbf = Tỉ lệ mỡ / Percent Body Fat (%) · tbw = Tổng lượng nước / Total Body Water (L) · visceral = Mức mỡ nội tạng / Visceral Fat Level (cấp 1–20; chỉ có cm² thì null) · bmr = Basal Metabolic Rate (kcal) · score = Điểm InBody · bmi · date = ngày đo YYYY-MM-DD hoặc null. Có nhiều lần đo → chỉ lấy lần MỚI NHẤT. Không phải phiếu đo → is_report=false.
Chỉ trả về MỘT JSON: {"is_report":true,"device":"","date":null,"weight":null,"smm":null,"bfm":null,"pbf":null,"tbw":null,"visceral":null,"bmr":null,"score":null,"bmi":null,"conf":0.0,"unreadable":[]}`;
function demoResult(){ return { is_report:true, simulated:true, device:"InBody 570 (kết quả mẫu)", date:null, weight:72.4, smm:33.1, bfm:13.6, pbf:18.8, tbw:42.6, visceral:6, bmr:1685, score:78, bmi:23.1, conf:.9, unreadable:[] }; }
function parseJson(text){ const s = String(text || ""), a = s.indexOf("{"), b = s.lastIndexOf("}"); if(a < 0 || b <= a) throw new Error("AI không trả kết quả đọc được"); return JSON.parse(s.slice(a, b + 1)); }
async function analyze(dataUrl){
  const c = CL(), isFb = !!(c && c.mode === "firebase");
  const ownKey = ()=>{ try{ return typeof getActiveProviderKey === "function" && getActiveProviderKey(); }catch(e){ return ""; } };
  const viaOwn = async ()=> clean(parseJson(await callVisionAI(dataUrl, PROMPT)));
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
    const r = await c.fn("analyzeInbodyReport", { image: dataUrl });
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
    const st = ST(); if(!st) return; const before = (st.inbodyLogs || []).length, dev = pendingDevice;
    setTimeout(()=>{
      const s2 = ST(); if(!s2 || !Array.isArray(s2.inbodyLogs) || s2.inbodyLogs.length <= before) return;
      const l = s2.inbodyLogs[s2.inbodyLogs.length - 1];
      Object.assign(l, extra); if(dev) l.device = dev;
      pendingDevice = "";
      try{ saveState(); }catch(_){}
      try{ if(typeof renderProgressInbodyTab === "function" && D.getElementById("progress-content")) renderProgressInbodyTab(); }catch(_){}
    }, 0);
  }, true);
}
let pendingDevice = "";
function fill(res){
  const set = (id, v)=>{ const el = D.getElementById(id); if(!el) return; if(v == null){ return; } el.value = String(v).replace(".", ","); el.classList.add("ibx-ai"); };
  if(res.date){ const d = D.getElementById("ib-date"); if(d){ d.value = res.date; d.classList.add("ibx-ai"); } }
  set("ib-weight", res.weight); set("ib-bf", res.pbf); set("ib-muscle", res.smm);
  set("ib-water", res.tbw != null && res.weight ? r1(res.tbw / res.weight * 100) : null);
  set("ib-visceral", res.visceral); set("ib-fatkg", res.bfm); set("ib-bmr", res.bmr != null ? Math.round(res.bmr) : null); set("ib-score", res.score != null ? Math.round(res.score) : null);
  const miss = { weight:"ib-weight", pbf:"ib-bf", smm:"ib-muscle", tbw:"ib-water", visceral:"ib-visceral", bfm:"ib-fatkg", bmr:"ib-bmr", score:"ib-score" };
  Object.keys(miss).forEach(k=>{ if(res[k] == null){ const el = D.getElementById(miss[k]); if(el && res.unreadable.includes(k)) el.classList.add("ibx-miss"); } });
  const note = D.getElementById("ib-note"); if(note && !note.value) note.value = ("Đọc từ phiếu " + (res.device || "InBody")).slice(0, 200);
  pendingDevice = res.device || "";
  const n = ["weight", "smm", "bfm", "pbf", "tbw", "visceral", "bmr", "score"].filter(k=> res[k] != null).length;
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
    ${sp ? `<div class="ibh-spark">${sp}<small>${esc(LAB[sk])} · ${ser.length} lần gần nhất</small></div>` : `<p class="ibh-lead">Đo thêm lần nữa (cách 3–4 tuần) để thấy thay đổi.</p>`}
    <div class="ibh-acts">${ACTS}<button type="button" class="btn btn-soft btn-sm" data-ibh="detail"><span class="material-symbols-rounded">insights</span>Xem chi tiết</button></div>`;
}
/** mở màn Tiến độ ở tab "Chỉ số InBody" */
function openDetail(){
  try{ if(typeof progressUI !== "undefined" && progressUI) progressUI.tab = "inbody"; }catch(_){}
  try{ if(typeof goto === "function") goto("progress"); }catch(e){ try{ console.warn("[inbody] goto", e); }catch(_){} }
  try{ if(typeof progressUI !== "undefined" && progressUI && progressUI.tab !== "inbody"){ progressUI.tab = "inbody"; if(typeof renderProgressScreen === "function") renderProgressScreen(); } }catch(_){}
}
let homeCard = null;
const inHome = el=>{ try{ return !!(homeCard && el && homeCard.parentNode === el && Array.prototype.indexOf.call(el.children || [], homeCard) >= 0); }catch(_){ return false; } };
function onHomeClick(e){
  const t = e && e.target && e.target.closest ? e.target.closest("[data-ibh]") : null;
  const k = t && (t.getAttribute ? t.getAttribute("data-ibh") : (t.dataset || {}).ibh);
  if(!k) return;
  if(k === "camera") pick({ camera:true }); else if(k === "gallery") pick({ camera:false }); else if(k === "detail") openDetail();
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
    openAddInbodyLog = function(){ pendingDevice = ""; const out = _o.apply(this, arguments); try{ injectExtra(); }catch(e){} return out; };
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
G.FKInbody = { clean, compare, verdict, metricSeries, chartSVG, fatKg, scan, pick, decorate, EXTRA, PROMPT, demoResult, install,
  homeHTML, homeInject, homeRefresh, openDetail, sparkSVG, isHeic, HEIC_MSG };
if(!install() && D) D.addEventListener("DOMContentLoaded", install, { once: true });
})(typeof window !== "undefined" ? window : globalThis);

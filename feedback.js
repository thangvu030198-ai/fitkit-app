/* =========================================================================
   TapEasy — VÒNG PHẢN HỒI TRONG APP (feedback.js) · docs/FEEDBACK.md
   Nạp ngay SAU admin.js (mọi module dữ liệu / màn hình đã có; trước theme-packs/ui-signature/press-feel/morph-icons/health-safety)
   → bọc hàm + khởi động thống kê (FKAnalytics.boot()).

   1. "Góp ý" — Hồ sơ → thẻ "Góp ý & quyền riêng tư", nút nổi nhỏ sau khi xong buổi tập (không cần lắc máy).
      Sheet: loại (Lỗi / Ý tưởng / Nội dung / Khác), nội dung, ảnh chụp màn hình (tuỳ chọn — nén bằng TapEv.compressImage),
      cho phép liên hệ lại (tuỳ chọn, mặc định KHÔNG), tự kèm phiên bản app + thông tin máy KHÔNG định danh.
   2. NPS 0–10 + "vì sao" — sau buổi tập hoàn thành thứ 5 HOẶC sau 7 ngày dùng; tối đa 1 lần / 90 ngày; "Để sau" = đã hỏi.
   3. Lưu: cloud.feedback.submit() → Firestore `feedback` (chỉ tạo; rules kiểm trường/kích thước; chỉ quản trị đọc).
      Demo → "máy chủ giả" trên máy. Lỗi mạng / offline → hàng đợi localStorage, tự gửi lại khi có mạng / lần mở sau.
   4. "Có gì mới" — hiện 1 lần sau mỗi bản cập nhật (người dùng cũ), liệt kê việc đã sửa — đóng vòng phản hồi.
   API: window.FKFeedback = { open, openNps, openWhatsNew, validate, buildDoc, submit, flushQueue, queue, npsDue, npsSummary,
                              afterWorkout, deviceInfo, CATEGORIES, CHANGELOG, state }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKFeedback && G.FKFeedback.__v) return;

const ST_KEY = "fk_feedback_v1";        // { firstSeen, workouts, npsLastAt, npsLastScore, whatsNewSeen, sent }
const Q_KEY = "fk_feedback_queue";      // hàng đợi offline (tối đa 20)
const Q_MAX = 20;
const DAY = 86400000;
const NPS_EVERY_DAYS = 90, NPS_AFTER_WORKOUTS = 5, NPS_AFTER_DAYS = 7;
const TEXT_MIN = 5, TEXT_MAX = 2000, WHY_MAX = 1000, CONTACT_MAX = 120, SHOT_MAX = 250000;

const CATEGORIES = [
  { id:"bug",     label:"Lỗi",      icon:"info",      hint:"Có gì chạy sai, treo, hiển thị lỗi?" },
  { id:"idea",    label:"Ý tưởng",  icon:"lightbulb", hint:"Bạn muốn TapEasy có thêm gì?" },
  { id:"content", label:"Nội dung", icon:"school",    hint:"Bài tập, món ăn, video hay chữ chưa đúng?" },
  { id:"other",   label:"Khác",     icon:"send",      hint:"Điều gì khác bạn muốn nói với đội ngũ" },
];
const CAT_IDS = CATEGORIES.map(c=> c.id);

/* "Có gì mới": mục mới nhất ĐẦU danh sách; id = ngày phát hành (so sánh chuỗi YYYY-MM-DD). fromFeedback = sửa theo góp ý người dùng */
const CHANGELOG = [
  { id:"2026-11-13", title:"Bắt đầu dễ hơn, lắng nghe bạn nhiều hơn", items:[
    { type:"new", text:"Sau khi tạo hồ sơ: màn “Kế hoạch đã sẵn sàng” với năng lượng nghỉ (BMR), năng lượng cả ngày (TDEE), đạm – tinh bột – béo và lịch tuần đầu." },
    { type:"new", text:"Hỏi thêm nơi tập (phòng gym / tại nhà / không dụng cụ) và số buổi mỗi tuần để gợi ý giáo án sát hơn." },
    { type:"new", text:"Góp ý ngay trong app: Hồ sơ → Góp ý & quyền riêng tư (kèm ảnh chụp màn hình nếu muốn)." },
    { type:"new", text:"Thống kê sử dụng ẩn danh — mặc định TẮT, chỉ bật khi bạn đồng ý; tắt lại bất cứ lúc nào." },
    { type:"fix", text:"Sửa hồ sơ: nút Quay lại ở bước đầu không còn đưa bạn về màn chào.", fromFeedback:true },
    { type:"fix", text:"Ô tuổi, chiều cao, cân nặng mở bàn phím số và báo lỗi rõ ràng ngay dưới ô.", fromFeedback:true },
  ]},
  { id:"2026-11-12", title:"Đẹp hơn, bấm sướng hơn", items:[
    { type:"new", text:"Ảnh món ăn mới cho 159 món, nút bấm có độ nảy và rung nhẹ, màu nhấn đổi theo giao diện." },
    { type:"fix", text:"Ứng dụng vừa khít màn hình tai thỏ / Dynamic Island, không còn bị che nút.", fromFeedback:true },
  ]},
];

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH
   --------------------------------------------------------------------- */
const esc = s=> String(s == null ? "" : s).replace(/[&<>"'`]/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;", "`":"&#96;" }[c]));
const ic = n=> `<span class="material-symbols-rounded" aria-hidden="true">${esc(n)}</span>`;
const D = ()=> G.document;
const byId = id=>{ try{ return D().getElementById(id); }catch(e){ return null; } };
/* gán thuộc tính on<sự kiện> (không addEventListener) → vẽ lại nhiều lần không bị gắn trùng */
const on = (id, ev, fn)=>{ const el = byId(id); if(el) el["on" + ev] = fn; return el; };
const say = (m, i)=>{ try{ if(typeof toast === "function") toast(m, i || "check_circle"); }catch(e){} };
const track = (e, p)=>{ try{ if(typeof G.fkTrack === "function") G.fkTrack(e, p); }catch(_){} };
function ls(){ try{ return G.localStorage || null; }catch(e){ return null; } }
function readJSON(k, def){ try{ const v = JSON.parse((ls() && ls().getItem(k)) || "null"); return v == null ? def : v; }catch(e){ return def; } }
function writeJSON(k, v){ try{ ls() && ls().setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } }
function st(){ const o = readJSON(ST_KEY, {}); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
function save(o){ writeJSON(ST_KEY, o); }
function appVersion(){ try{ return typeof APP_VERSION !== "undefined" ? String(APP_VERSION).slice(0, 20) : "0"; }catch(e){ return "0"; } }
function curScreen(){ try{ const a = D().querySelector(".screen.active"); return a && a.id ? String(a.id).replace("screen-", "").slice(0, 40) : ""; }catch(e){ return ""; } }
function isOpen(id){ const el = byId(id); return !!(el && el.classList && el.classList.contains("open")); }
function busy(){ return isOpen("onboarding") || isOpen("auth") || isOpen("sheet-backdrop") || isOpen("ob-ready") || isOpen("fk-consent"); }

/** Thông tin máy KHÔNG định danh: nền tảng, họ hệ điều hành, cỡ màn hình, ngôn ngữ, giao diện, chế độ máy chủ (không gửi chuỗi UA đầy đủ) */
function deviceInfo(){
  const n = G.navigator || {}, ua = String(n.userAgent || "");
  let platform = "web"; try{ if(G.Capacitor && typeof G.Capacitor.getPlatform === "function") platform = String(G.Capacitor.getPlatform()); }catch(e){}
  const os = /android/i.test(ua) ? "Android" : /iphone|ipad|ipod/i.test(ua) ? "iOS" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "khác";
  const sw = Number(G.screen && G.screen.width) || Number(G.innerWidth) || 0, sh = Number(G.screen && G.screen.height) || Number(G.innerHeight) || 0;
  let theme = ""; try{ theme = G.fkTheme && G.fkTheme.current ? String(G.fkTheme.current() || "") : ""; }catch(e){}
  let mode = ""; try{ mode = typeof cloud !== "undefined" && cloud ? String(cloud.mode || "") : ""; }catch(e){}
  return { platform: platform.slice(0, 12), os, screen: `${sw}x${sh}`.slice(0, 12), lang: String(n.language || "vi").slice(0, 8), theme: theme.slice(0, 20), mode: mode.slice(0, 10) };
}

/* ---------------------------------------------------------------------
   1. KIỂM TRA & DỰNG BẢN GHI (khớp firestore.rules → match /feedback/{id})
   --------------------------------------------------------------------- */
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,100}\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[\d\s.\-()]{8,20}$/;
const SHOT_RE = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const ALLOWED = ["kind","category","text","score","contact","shot","appVersion","device","screen","status","v","trigger"];
/** validate(doc) → { ok, errors:[chuỗi tiếng Việt] } — dùng chung cho sheet, hàng đợi và kiểm thử */
function validate(doc){
  const e = [];
  if(!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok:false, errors:["Dữ liệu góp ý không hợp lệ."] };
  Object.keys(doc).forEach(k=>{ if(!ALLOWED.includes(k)) e.push("Trường không được phép: " + k); });
  if(doc.kind !== "feedback" && doc.kind !== "nps") e.push("Loại góp ý không hợp lệ.");
  if(doc.status !== "new" || doc.v !== 1) e.push("Phiên bản dữ liệu không hợp lệ.");
  if(typeof doc.appVersion !== "string" || !doc.appVersion || doc.appVersion.length > 20) e.push("Thiếu phiên bản ứng dụng.");
  if(doc.text != null && (typeof doc.text !== "string" || doc.text.length > TEXT_MAX)) e.push(`Nội dung tối đa ${TEXT_MAX} ký tự.`);
  if(doc.kind === "feedback"){
    if(!CAT_IDS.includes(doc.category)) e.push("Chọn loại góp ý.");
    if(typeof doc.text !== "string" || doc.text.trim().length < TEXT_MIN) e.push(`Viết ít nhất ${TEXT_MIN} ký tự để đội ngũ hiểu rõ hơn.`);
    if("score" in doc) e.push("Góp ý thường không có điểm NPS.");
  }
  if(doc.kind === "nps"){
    if(!Number.isInteger(doc.score) || doc.score < 0 || doc.score > 10) e.push("Chọn điểm từ 0 đến 10.");
    if(typeof doc.text === "string" && doc.text.length > WHY_MAX) e.push(`Lý do tối đa ${WHY_MAX} ký tự.`);
    if("category" in doc || "shot" in doc) e.push("NPS không kèm loại / ảnh.");
  }
  if("contact" in doc){
    const c = String(doc.contact || "").trim();
    if(typeof doc.contact !== "string" || !c || c.length > CONTACT_MAX || !(EMAIL_RE.test(c) || PHONE_RE.test(c))) e.push("Email hoặc số điện thoại liên hệ chưa đúng.");
  }
  if("shot" in doc && (typeof doc.shot !== "string" || doc.shot.length > SHOT_MAX || !SHOT_RE.test(doc.shot))) e.push("Ảnh chụp màn hình quá lớn hoặc sai định dạng.");
  if("device" in doc){
    const d = doc.device;
    if(!d || typeof d !== "object" || Array.isArray(d) || Object.keys(d).some(k=> !["platform","os","screen","lang","theme","mode"].includes(k))
       || Object.values(d).some(v=> typeof v !== "string" || v.length > 20)) e.push("Thông tin thiết bị không hợp lệ.");
  }
  if("screen" in doc && (typeof doc.screen !== "string" || doc.screen.length > 40)) e.push("Tên màn hình không hợp lệ.");
  if("trigger" in doc && (typeof doc.trigger !== "string" || doc.trigger.length > 30)) e.push("Nguồn mở không hợp lệ.");
  return { ok: !e.length, errors: e };
}
/** Dựng bản ghi chuẩn từ dữ liệu sheet (bỏ trường rỗng; liên hệ chỉ khi người dùng ĐÃ đồng ý) */
function buildDoc(kind, input){
  input = input || {};
  const doc = { kind, status:"new", v:1, appVersion: appVersion(), device: deviceInfo() };
  const scr = String(input.screen != null ? input.screen : curScreen()).slice(0, 40); if(scr) doc.screen = scr;
  if(input.trigger) doc.trigger = String(input.trigger).slice(0, 30);
  const text = String(input.text == null ? "" : input.text).replace(/\r\n?/g, "\n").trim();
  if(kind === "feedback"){
    doc.category = CAT_IDS.includes(input.category) ? input.category : "other";
    doc.text = text.slice(0, TEXT_MAX);
    if(input.shot) doc.shot = String(input.shot);
  } else {
    doc.score = Number.isInteger(input.score) ? input.score : Math.round(Number(input.score));
    if(text) doc.text = text.slice(0, WHY_MAX);
  }
  if(input.contactOk && String(input.contact || "").trim()) doc.contact = String(input.contact).trim().slice(0, CONTACT_MAX);
  return doc;
}

/* ---------------------------------------------------------------------
   2. GỬI + HÀNG ĐỢI OFFLINE
   --------------------------------------------------------------------- */
function queue(){ const q = readJSON(Q_KEY, []); return Array.isArray(q) ? q : []; }
function enqueue(doc){ const q = queue(); q.push({ doc, at: Date.now() }); while(q.length > Q_MAX) q.shift(); writeJSON(Q_KEY, q); }
function online(){ try{ return !G.navigator || G.navigator.onLine !== false; }catch(e){ return true; } }
function hasCloud(){ try{ return typeof cloud !== "undefined" && cloud && cloud.feedback && typeof cloud.feedback.submit === "function"; }catch(e){ return false; } }
/** submit(doc) → { ok, queued, id?, errors? } — không bao giờ ném lỗi */
async function submit(doc){
  const v = validate(doc);
  if(!v.ok) return { ok:false, errors: v.errors };
  const s = st(); s.sent = (s.sent || 0) + 1; save(s);
  if(!hasCloud() || !online()){ enqueue(doc); return { ok:true, queued:true }; }
  try{ const r = await cloud.feedback.submit(doc); return { ok:true, queued:false, id: r && r.id }; }
  catch(e){ enqueue(doc); return { ok:true, queued:true }; }
}
let _flushing = false;
async function flushQueue(){
  if(_flushing || !hasCloud() || !online()) return 0;
  const q = queue(); if(!q.length) return 0;
  _flushing = true; let sent = 0; const rest = [];
  try{
    for(const it of q){
      if(!it || !validate(it.doc).ok) continue;                         // bản ghi hỏng → bỏ
      if(Date.now() - (it.at || 0) > 30 * DAY) continue;                // quá 30 ngày → bỏ (không gửi dữ liệu cũ bất ngờ)
      try{ await cloud.feedback.submit(it.doc); sent++; }catch(e){ rest.push(it); }
    }
    writeJSON(Q_KEY, rest);
  }finally{ _flushing = false; }
  return sent;
}

/* ---------------------------------------------------------------------
   3. LỊCH HỎI NPS (hàm thuần — kiểm thử được)
   --------------------------------------------------------------------- */
/** npsDue({ firstSeen, workouts, npsLastAt }, now) — sau buổi thứ 5 HOẶC ≥ 7 ngày dùng; tối đa 1 lần / 90 ngày (kể cả khi bấm "Để sau") */
function npsDue(s, now){
  s = s || {}; now = Number(now) || Date.now();
  const last = Number(s.npsLastAt) || 0;
  if(last && now - last < NPS_EVERY_DAYS * DAY) return false;
  const first = Number(s.firstSeen) || 0;
  const daysUsed = first ? (now - first) / DAY : 0;
  return (Number(s.workouts) || 0) >= NPS_AFTER_WORKOUTS || daysUsed >= NPS_AFTER_DAYS;
}
function workoutsDone(){
  const s = st();
  let fd = 0; try{ fd = typeof state !== "undefined" && state && Array.isArray(state.finishedDates) ? state.finishedDates.length : 0; }catch(e){}
  return Math.max(Number(s.workouts) || 0, fd);
}
function npsDueNow(){ const s = st(); return npsDue(Object.assign({}, s, { workouts: workoutsDone() }), Date.now()); }
/** Tóm tắt NPS: % ủng hộ (9–10) − % phản đối (0–6), phân bố 0–10 */
function npsSummary(list, sinceMs){
  const rows = (Array.isArray(list) ? list : []).filter(x=> x && x.kind === "nps" && Number.isInteger(x.score) && x.score >= 0 && x.score <= 10
    && (!sinceMs || (Number(x.createdAt) || 0) >= sinceMs));
  const dist = Array.from({ length: 11 }, ()=> 0);
  rows.forEach(x=> dist[x.score]++);
  const n = rows.length, pro = rows.filter(x=> x.score >= 9).length, det = rows.filter(x=> x.score <= 6).length;
  return { n, promoters: pro, passives: n - pro - det, detractors: det, nps: n ? Math.round((pro - det) / n * 100) : null,
    avg: n ? Math.round(rows.reduce((a, x)=> a + x.score, 0) / n * 10) / 10 : null, dist };
}

/* ---------------------------------------------------------------------
   4. SHEET GÓP Ý
   --------------------------------------------------------------------- */
let _shot = "";
function open(opts){
  opts = opts || {};
  if(typeof openSheet !== "function") return false;
  _shot = "";
  let cat = CAT_IDS.includes(opts.category) ? opts.category : "";
  const canShot = !!(G.TapEv && typeof G.TapEv.compressImage === "function");
  const info = deviceInfo();
  const email = (()=>{ try{ return cloud && cloud.user && cloud.user.email ? String(cloud.user.email) : ""; }catch(e){ return ""; } })();
  openSheet(`<div class="sheet-header"><h3>Góp ý cho TapEasy</h3><button type="button" class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">Mỗi góp ý đều được đội ngũ đọc. Những gì đã sửa sẽ hiện ở mục <b>Có gì mới</b>.</p>
    <div class="fk-fb-cats" role="radiogroup" aria-label="Loại góp ý" id="fb-cats">
      ${CATEGORIES.map(c=> `<button type="button" class="pill fk-fb-cat${c.id === cat ? " on" : ""}" role="radio" aria-checked="${c.id === cat ? "true" : "false"}" id="fb-cat-${esc(c.id)}" data-fb-cat="${esc(c.id)}">${ic(c.icon)}${esc(c.label)}</button>`).join("")}
    </div>
    <div class="field" style="margin-top:12px;"><label for="fb-text" id="fb-text-l">Nội dung góp ý</label>
      <textarea id="fb-text" rows="5" maxlength="${TEXT_MAX}" aria-describedby="fb-text-hint fb-err" placeholder="VD: Ở màn Dinh dưỡng, bấm + Thêm món thì app bị treo…"></textarea>
      <small class="fk-fb-hint" id="fb-text-hint">${esc((CATEGORIES.find(c=> c.id === cat) || CATEGORIES[3]).hint)} · <span id="fb-count">0</span>/${TEXT_MAX}</small></div>
    ${canShot ? `<div class="fk-fb-shot"><button type="button" class="btn btn-outline btn-sm" id="fb-shot-btn">${ic("photo_camera")}Đính kèm ảnh chụp màn hình</button>
      <span class="small-note" id="fb-shot-st">Tuỳ chọn · tránh chụp thông tin cá nhân</span></div>` : ""}
    <label class="fk-fb-check"><input type="checkbox" id="fb-contact-ok"><span>Cho phép TapEasy liên hệ lại với tôi về góp ý này</span></label>
    <div class="field" id="fb-contact-wrap" hidden><label for="fb-contact">Email hoặc số điện thoại</label>
      <input type="email" id="fb-contact" maxlength="${CONTACT_MAX}" autocomplete="email" inputmode="email" value="${esc(email)}" placeholder="ban@vidu.vn"></div>
    <p class="small-note fk-fb-dim">Tự động kèm: phiên bản ${esc(appVersion())} · ${esc(info.platform)} · ${esc(info.os)} · màn hình ${esc(info.screen)}. Không kèm tên, email hay số đo cơ thể (trừ khi bạn tự viết hoặc cho phép liên hệ).</p>
    <p class="auth-err" id="fb-err" role="alert"></p>
    <button type="button" class="btn btn-primary btn-block" id="fb-send">${ic("send")}Gửi góp ý</button>`);
  const pick = id=>{
    cat = id;
    CATEGORIES.forEach(c=>{ const b = byId("fb-cat-" + c.id); if(b){ b.classList.toggle("on", c.id === id); b.setAttribute("aria-checked", c.id === id ? "true" : "false"); } });
    const h = byId("fb-text-hint"); const c = CATEGORIES.find(x=> x.id === id);
    if(h && c) h.innerHTML = `${esc(c.hint)} · <span id="fb-count">${esc(String(((byId("fb-text") || {}).value || "").length))}</span>/${TEXT_MAX}`;
  };
  CATEGORIES.forEach(c=> on("fb-cat-" + c.id, "click", ()=> pick(c.id)));
  on("fb-text", "input", ()=>{ const n = byId("fb-count"), t = byId("fb-text"); if(n && t) n.textContent = String((t.value || "").length); });
  on("fb-contact-ok", "change", ()=>{ const w = byId("fb-contact-wrap"), c = byId("fb-contact-ok"); if(w) w.hidden = !(c && c.checked); });
  if(canShot) on("fb-shot-btn", "click", ()=>{
    try{
      const inp = D().createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = async ()=>{
        const f = inp.files && inp.files[0]; if(!f) return;
        const s = byId("fb-shot-st");
        try{
          let d = await G.TapEv.compressImage(f, 900, 0.6);
          if(d && d.length > SHOT_MAX) d = await G.TapEv.compressImage(f, 640, 0.5);
          if(!d || d.length > SHOT_MAX || !SHOT_RE.test(d)) throw new Error("big");
          _shot = d; if(s) s.textContent = "Đã đính kèm 1 ảnh (" + Math.round(d.length / 1366) + " KB) · bấm lại để đổi";
        }catch(e){ _shot = ""; if(s) s.textContent = "Ảnh quá lớn hoặc không đọc được — thử ảnh khác."; }
      };
      inp.click();
    }catch(e){}
  });
  on("fb-send", "click", async ()=>{
    const btn = byId("fb-send"), err = byId("fb-err");
    const doc = buildDoc("feedback", { category: cat || "other", text: (byId("fb-text") || {}).value, shot: _shot,
      contactOk: !!(byId("fb-contact-ok") || {}).checked, contact: (byId("fb-contact") || {}).value, trigger: opts.trigger || "settings", screen: opts.screen });
    const v = validate(doc);
    if(!v.ok){ if(err) err.textContent = v.errors[0]; try{ const t = byId("fb-text"); if(t && t.setAttribute) t.setAttribute("aria-invalid", "true"); if(t && t.focus) t.focus(); }catch(e){} return; }
    if(btn) btn.disabled = true;
    const r = await submit(doc);
    if(btn) btn.disabled = false;
    if(!r.ok){ if(err) err.textContent = (r.errors || ["Chưa gửi được."])[0]; return; }
    track("feedback_submitted", { category: doc.category, has_shot: !!doc.shot, has_contact: !!doc.contact, queued: !!r.queued, trigger: doc.trigger || "" });
    try{ closeSheet(); }catch(e){}
    say(r.queued ? "Đã lưu góp ý — sẽ tự gửi khi có mạng. Cảm ơn bạn!" : "Đã gửi góp ý. Cảm ơn bạn!", "check_circle");
  });
  hideFab();
  return true;
}

/* ---------------------------------------------------------------------
   5. NPS
   --------------------------------------------------------------------- */
let _npsShownThisSession = false;
function openNps(trigger){
  if(typeof openSheet !== "function") return false;
  _npsShownThisSession = true;
  const s = st(); s.npsLastAt = Date.now(); save(s);                    // đã hỏi (kể cả khi "Để sau") → 90 ngày sau mới hỏi lại
  let score = null;
  openSheet(`<div class="sheet-header"><h3 id="nps-h">Bạn có muốn giới thiệu TapEasy cho bạn bè?</h3><button type="button" class="icon-btn" id="nps-x" aria-label="Đóng, để sau">${ic("close")}</button></div>
    <p class="small-note">Chấm từ 0 (chắc chắn không) đến 10 (chắc chắn có).</p>
    <div class="fk-nps" role="radiogroup" aria-labelledby="nps-h" id="nps-scale">
      ${Array.from({ length: 11 }, (_, i)=> `<button type="button" class="fk-nps-b" role="radio" aria-checked="false" id="nps-b-${i}" aria-label="${i} điểm">${i}</button>`).join("")}
    </div>
    <div class="fk-nps-ends" aria-hidden="true"><span>Không chắc</span><span>Chắc chắn</span></div>
    <div class="field" style="margin-top:12px;"><label for="nps-why">Điều gì khiến bạn chấm điểm này? (không bắt buộc)</label>
      <textarea id="nps-why" rows="3" maxlength="${WHY_MAX}" placeholder="VD: Giáo án dễ theo, nhưng muốn thêm món chay…"></textarea></div>
    <p class="auth-err" id="nps-err" role="alert"></p>
    <button type="button" class="btn btn-primary btn-block" id="nps-send" disabled>Gửi đánh giá</button>
    <button type="button" class="btn btn-ghost btn-block" id="nps-later" style="margin-top:6px;">Để sau</button>`);
  for(let i = 0; i <= 10; i++) on("nps-b-" + i, "click", ()=>{
    score = i;
    for(let j = 0; j <= 10; j++){ const b = byId("nps-b-" + j); if(b){ b.classList.toggle("on", j === i); b.setAttribute("aria-checked", j === i ? "true" : "false"); } }
    const go = byId("nps-send"); if(go) go.disabled = false;
  });
  const later = ()=>{ track("nps_dismissed", { trigger: trigger || "" }); try{ closeSheet(); }catch(e){} };
  on("nps-later", "click", later); on("nps-x", "click", later);
  on("nps-send", "click", async ()=>{
    const doc = buildDoc("nps", { score, text: (byId("nps-why") || {}).value, trigger: trigger || "auto" });
    const v = validate(doc), err = byId("nps-err");
    if(!v.ok){ if(err) err.textContent = v.errors[0]; return; }
    const r = await submit(doc);
    if(!r.ok){ if(err) err.textContent = (r.errors || ["Chưa gửi được."])[0]; return; }
    const s2 = st(); s2.npsLastScore = score; save(s2);
    track("nps_submitted", { score, has_reason: !!doc.text, trigger: doc.trigger, queued: !!r.queued });
    try{ closeSheet(); }catch(e){}
    say(score >= 9 ? "Cảm ơn bạn! Chia sẻ TapEasy với bạn bè nhé!" : "Cảm ơn bạn — đội ngũ sẽ đọc kỹ lý do để cải thiện.", "check_circle");
  });
  return true;
}

/* ---------------------------------------------------------------------
   6. CÓ GÌ MỚI
   --------------------------------------------------------------------- */
const latestId = ()=> CHANGELOG[0] ? CHANGELOG[0].id : "";
function fmtDate(id){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(id || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; }
function openWhatsNew(force){
  if(typeof openSheet !== "function") return false;
  const s = st();
  const seen = String(s.whatsNewSeen || "");
  const list = force ? CHANGELOG : CHANGELOG.filter(e=> e.id > seen);
  if(!list.length) return false;
  s.whatsNewSeen = latestId(); save(s);
  const sent = Number(s.sent) || 0;
  openSheet(`<div class="sheet-header"><h3>Có gì mới</h3><button type="button" class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    ${sent ? `<p class="small-note fk-wn-thanks">${ic("check_circle")}Cảm ơn bạn đã gửi ${esc(String(sent))} góp ý — những mục đánh dấu <b>Từ góp ý</b> được sửa nhờ người dùng như bạn.</p>` : ""}
    ${list.map(e=> `<section class="fk-wn">
      <h4 class="fk-wn-h">${esc(e.title)}<small>${esc(fmtDate(e.id))} · TapEasy ${esc(appVersion())}</small></h4>
      <ul class="fk-wn-list">${e.items.map(it=> `<li class="fk-wn-i ${it.type === "fix" ? "fix" : "new"}"><span class="fk-wn-tag">${it.type === "fix" ? "Đã sửa" : "Mới"}</span><span>${esc(it.text)}${it.fromFeedback ? ` <em class="fk-wn-fb">Từ góp ý</em>` : ""}</span></li>`).join("")}</ul>
    </section>`).join("")}
    <button type="button" class="btn btn-primary btn-block" onclick="closeSheet()" style="margin-top:8px;">Tuyệt, đã hiểu</button>
    <button type="button" class="btn btn-ghost btn-block" id="wn-fb" style="margin-top:6px;">${ic("lightbulb")}Còn điều gì chưa ổn? Góp ý</button>`);
  on("wn-fb", "click", ()=> open({ trigger:"whats_new" }));
  track("whats_new_view", { release: latestId(), forced: !!force });
  return true;
}

/* ---------------------------------------------------------------------
   7. SAU BUỔI TẬP: đếm buổi, nút "Góp ý" nổi, NPS khi đủ điều kiện
   --------------------------------------------------------------------- */
let _afterWorkout = false, _fabTimer = 0;
function afterWorkout(saved){
  if(saved){ const s = st(); s.workouts = (Number(s.workouts) || 0) + 1; save(s); }
  _afterWorkout = true;                                                 // chờ sheet "Hoàn thành buổi tập" đóng
}
function hideFab(){ const f = byId("fk-fb-fab"); if(f){ f.hidden = true; f.classList.remove("open"); } clearTimeout(_fabTimer); }
function showFab(){
  const d = D(); if(!d || !d.createElement) return false;
  let f = byId("fk-fb-fab");
  if(!f || f.isConnected === false){
    f = d.createElement("div"); f.id = "fk-fb-fab"; f.className = "fk-fb-fab";
    f.setAttribute("role", "complementary"); f.setAttribute("aria-label", "Góp ý sau buổi tập");
    (byId("app-shell") || d.body).appendChild(f);
  }
  f.innerHTML = `<button type="button" class="fk-fb-fab-go" id="fk-fb-fab-go">${ic("lightbulb")}<span>Buổi tập thế nào? Góp ý</span></button>
    <button type="button" class="fk-fb-fab-x" id="fk-fb-fab-x" aria-label="Ẩn nút góp ý">${ic("close")}</button>`;
  f.hidden = false; f.classList.add("open");
  on("fk-fb-fab-go", "click", ()=>{ hideFab(); open({ trigger:"post_workout", screen:"workout" }); });
  on("fk-fb-fab-x", "click", hideFab);
  clearTimeout(_fabTimer); _fabTimer = setTimeout(hideFab, 20000);
  return true;
}
function onSheetClosed(){
  if(!_afterWorkout) return;
  _afterWorkout = false;
  setTimeout(()=>{
    if(busy()) return;
    if(!_npsShownThisSession && npsDueNow()) openNps("post_workout"); else showFab();
  }, 450);
}
/** Vào Trang chủ: lần lượt (mỗi phiên tối đa 1 hộp thoại) "Có gì mới" → NPS theo số ngày dùng */
let _homePrompted = false;
function onHome(){
  if(_homePrompted) return;
  setTimeout(()=>{
    if(_homePrompted || busy() || curScreen() !== "home") return;
    if(openWhatsNew(false)){ _homePrompted = true; return; }
    if(!_npsShownThisSession && npsDueNow()){ _homePrompted = true; openNps("days_used"); }
  }, 900);
}

/* ---------------------------------------------------------------------
   8. HỒ SƠ: thẻ "Góp ý & quyền riêng tư" + bổ sung Chính sách bảo mật
   --------------------------------------------------------------------- */
function analyticsOn(){ try{ return !!(G.FKAnalytics && G.FKAnalytics.consent()); }catch(e){ return false; } }
function profileCard(){
  const d = D(); if(!d) return;
  const scr = d.querySelector ? d.querySelector("#screen-profile .content") : null; if(!scr || !scr.appendChild) return;
  const old = byId("fk-fb-card"); if(old && old.parentNode && old.parentNode.removeChild) try{ old.parentNode.removeChild(old); }catch(e){}
  const el = d.createElement("div"); el.className = "card fk-fb-card"; el.id = "fk-fb-card";
  const an = analyticsOn();
  const latest = CHANGELOG[0];
  el.innerHTML = `<div class="card-title">${ic("lightbulb")}Góp ý &amp; quyền riêng tư</div>
    <button type="button" class="link-row" id="fk-fb-open"><div class="left">${ic("send")}<div><div class="name">Góp ý cho TapEasy</div><div class="sub">Báo lỗi, đề xuất tính năng, nội dung chưa đúng</div></div></div>${ic("chevron_right")}</button>
    <button type="button" class="link-row" id="fk-wn-open"><div class="left">${ic("campaign")}<div><div class="name">Có gì mới</div><div class="sub">${latest ? esc(fmtDate(latest.id)) + " · " + esc(latest.title) : ""}</div></div></div>${ic("chevron_right")}</button>
    <div class="link-row"><div class="left">${ic("insights")}<div><div class="name" id="fk-an-l">Thống kê sử dụng ẩn danh</div><div class="sub">${an ? "Đang bật — không gửi tên, email, số đo" : "Đang tắt — không gì rời khỏi máy"}</div></div></div>
      <div class="toggle ${an ? "on" : ""}" id="fk-an-toggle" role="switch" tabindex="0" aria-checked="${an ? "true" : "false"}" aria-labelledby="fk-an-l"></div></div>
    ${an ? `<button type="button" class="link-row" id="fk-an-log"><div class="left">${ic("visibility")}<div><div class="name">Xem dữ liệu thống kê trên máy</div><div class="sub">50 sự kiện gần nhất đã ghi</div></div></div>${ic("chevron_right")}</button>` : ""}`;
  const acc = byId("profile-account-card");
  try{ if(acc && acc.parentNode && acc.parentNode.insertBefore && acc.isConnected !== false) acc.parentNode.insertBefore(el, acc); else scr.appendChild(el); }catch(e){ try{ scr.appendChild(el); }catch(_){} }
  on("fk-fb-open", "click", ()=> open({ trigger:"settings" }));
  on("fk-wn-open", "click", ()=> openWhatsNew(true));
  const tg = byId("fk-an-toggle");
  const flip = ()=>{ try{ G.FKAnalytics.setConsent(!analyticsOn(), "settings"); }catch(e){} profileCard(); say(analyticsOn() ? "Đã bật thống kê ẩn danh — cảm ơn bạn!" : "Đã tắt thống kê — không gì rời khỏi máy", "insights"); };
  if(tg){ tg.onclick = flip; tg.onkeydown = e=>{ if(e.key === "Enter" || e.key === " "){ e.preventDefault && e.preventDefault(); flip(); } }; }
  on("fk-an-log", "click", openLog);
}
function openLog(){
  if(typeof openSheet !== "function") return;
  const log = (G.FKAnalytics ? G.FKAnalytics.log() : []).slice(-50).reverse();
  const p2 = n=> String(n).padStart(2, "0");
  const t = ms=>{ const d = new Date(ms); return `${p2(d.getDate())}/${p2(d.getMonth()+1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  openSheet(`<div class="sheet-header"><h3>Dữ liệu thống kê trên máy</h3><button type="button" class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">Đây đúng là những gì TapEasy ghi (và gửi, nếu chủ app đã kết nối dịch vụ thống kê). Không có tên, email, số điện thoại hay số đo.</p>
    <div class="fk-an-log">${log.length ? log.map(ev=> `<div class="fk-an-row"><b>${esc(ev.e)}</b><small>${esc(t(ev.t))}</small><code>${esc(JSON.stringify(ev.p || {}))}</code></div>`).join("") : `<p class="small-note">Chưa có sự kiện nào.</p>`}</div>
    <button type="button" class="btn btn-ghost btn-block" id="fk-an-clear" style="margin-top:8px;">Xoá nhật ký trên máy</button>`);
  on("fk-an-clear", "click", ()=>{ try{ G.FKAnalytics.clearLog(); }catch(e){} openLog(); });
}
function privacyNote(){
  const sc = byId("sheet-content"); if(!sc) return;
  let box = sc.querySelector ? sc.querySelector(".policy-text") : null;
  if(!box || !box.parentNode) box = sc;                                   // không tìm thấy khối chính sách → chèn cuối sheet
  if(!box.insertAdjacentHTML || String(box.innerHTML || "").indexOf("fk-pp") >= 0) return;
  box.insertAdjacentHTML("beforeend", `<p class="fk-pp"><b>Thống kê sử dụng ẩn danh (tuỳ chọn, mặc định tắt):</b> chỉ khi bạn đồng ý, app ghi tên sự kiện (mở màn, bắt đầu/xong buổi tập, ghi món…) kèm phiên bản app, nền tảng, giao diện — không tên, email, SĐT, số đo; mã tài khoản chỉ gửi dạng băm. Tắt tại Hồ sơ → Góp ý &amp; quyền riêng tư.</p>
    <p class="fk-pp"><b>Góp ý &amp; đánh giá:</b> nội dung bạn viết, điểm 0–10, phiên bản app và thông tin máy không định danh được lưu trên máy chủ để đội ngũ cải thiện app; email/SĐT chỉ gửi khi bạn chọn "cho phép liên hệ lại".</p>`);
}

/* ---------------------------------------------------------------------
   9. GẮN VÀO APP + KHỞI ĐỘNG
   --------------------------------------------------------------------- */
function wrapGlobal(name, make){
  try{ const old = G[name]; if(typeof old !== "function" || old.__fkfb) return false; const f = make(old); f.__fkfb = true; G[name] = f; return true; }
  catch(e){ return false; }
}
function integrate(){
  wrapGlobal("renderProfileScreen", old=> function(){ const r = old.apply(this, arguments); try{ profileCard(); }catch(e){} return r; });
  wrapGlobal("goto", old=> function(s){ const r = old.apply(this, arguments); try{ if(s === "profile") profileCard(); if(s === "home") onHome(); if(s !== "workout") hideFab(); }catch(e){} return r; });
  wrapGlobal("closeSheet", old=> function(){ const r = old.apply(this, arguments); try{ onSheetClosed(); }catch(e){} return r; });
  wrapGlobal("openPrivacySheet", old=> function(){ const r = old.apply(this, arguments); try{ privacyNote(); }catch(e){} return r; });
  try{ G.addEventListener && G.addEventListener("online", ()=>{ flushQueue().catch(()=>{}); }); }catch(e){}
}
function boot(){
  const s = st();
  if(!s.firstSeen){
    // người dùng cũ (đã có dữ liệu trước bản này) → ngày bắt đầu dùng app; người mới → hôm nay
    let since = 0; try{ if(typeof state !== "undefined" && state && /^\d{4}-\d{2}-\d{2}$/.test(state.startDate || "")) since = new Date(state.startDate + "T00:00:00").getTime(); }catch(e){}
    s.firstSeen = since > 0 && since < Date.now() ? since : Date.now();
  }
  if(s.whatsNewSeen == null){
    // cài mới (chưa onboard) → không khoe "Có gì mới"; người dùng cũ cập nhật lên → thấy 1 lần
    let returning = false; try{ returning = typeof state !== "undefined" && !!(state && state.onboarded); }catch(e){}
    s.whatsNewSeen = returning ? "" : latestId();
  }
  save(s);
  integrate();
  try{ if(G.FKAnalytics) G.FKAnalytics.boot(); }catch(e){}
  setTimeout(()=>{ flushQueue().catch(()=>{}); }, 800);
  try{ if(curScreen() === "profile") profileCard(); }catch(e){}
}

G.FKFeedback = { __v:1, open, openNps, openWhatsNew, validate, buildDoc, submit, flushQueue, queue, npsDue, npsDueNow, npsSummary, afterWorkout,
  showFab, hideFab, deviceInfo, profileCard, CATEGORIES, CHANGELOG, state: st, ST_KEY, Q_KEY, limits:{ TEXT_MIN, TEXT_MAX, WHY_MAX, CONTACT_MAX, SHOT_MAX, NPS_EVERY_DAYS, NPS_AFTER_WORKOUTS, NPS_AFTER_DAYS } };
try{ boot(); }catch(e){ try{ console.warn("[feedback]", e); }catch(_){} }
})(typeof window !== "undefined" ? window : globalThis);

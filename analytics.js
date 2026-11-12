/* =========================================================================
   TapEasy — THỐNG KÊ SỬ DỤNG ẨN DANH (analytics.js) · docs/ANALYTICS.md
   Nạp SỚM: ngay sau rbac.js (trước data.js / app.js) để mọi module gọi được fkTrack().
   Gắn đo lường vào các hàm của module khác (instrument) chạy khi feedback.js (nạp ngay sau admin.js) gọi FKAnalytics.boot().

   Nguyên tắc (privacy-first, không phụ thuộc nhà cung cấp):
   - MẶC ĐỊNH TẮT. Chỉ gửi khi người dùng bấm "Đồng ý" ở thẻ hỏi (hoặc bật trong Hồ sơ → Quyền riêng tư).
     Trình duyệt bật Do Not Track / Global Privacy Control → không hỏi, coi như "không đồng ý" (người dùng vẫn tự bật được).
   - Khi tắt: KHÔNG gì rời khỏi máy — sự kiện bị bỏ ngay ở fkTrack(), không xếp hàng, không ghi nhật ký, không nạp SDK.
   - Không PII: thuộc tính chỉ nhận chuỗi ngắn / số / boolean; khoá chứa email/phone/name/uid/address… bị loại;
     giá trị trông như email / số điện thoại bị thay "[redacted]"; mã người dùng chỉ gửi dạng băm (SHA-256 + muối, cắt 16 ký tự).
   - Nhà cung cấp (chọn tự động, có thể nhiều cùng lúc):
       a) Firebase Analytics — khi FIREBASE_CONFIG.measurementId có giá trị và app đang chạy Firebase thật
       b) PostHog            — khi MEDIA_CONFIG.posthogKey hoặc APP_CONFIG.posthog.key có giá trị (host mặc định EU)
                               SDK chỉ được tải SAU khi đồng ý; tắt autocapture, ghi màn hình, khảo sát, cookie.
       c) Nhật ký cục bộ     — vòng đệm 200 sự kiện trên máy (luôn có khi đã đồng ý; xem trong Hồ sơ → Quyền riêng tư)
   API: fkTrack(event, props) · fkIdentify(userId, traits) · fkScreen(name, props)
        window.FKAnalytics = { consent(), setConsent(on, source), dnt(), shouldAsk(), askConsent(), track, identify, screen,
                               sanitize(props), cleanEvent(name), hashId(id), providers(), log(), clearLog(), boot(), instrument() }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKAnalytics && G.FKAnalytics.__v) return;

const KEY = "fk_analytics_v1";          // { consent:"granted"|"denied"|null, at, source, cats:{ usage:bool }, firstOpen, anon }
const LOG_KEY = "fk_analytics_log";     // vòng đệm cục bộ (chỉ khi đã đồng ý)
const LOG_MAX = 200;
const QUEUE_MAX = 50;
const SALT = "tapeasy.analytics.v1:";
const POSTHOG_EU = "https://eu.i.posthog.com";

/* ---------------------------------------------------------------------
   1. LƯU TRẠNG THÁI ĐỒNG Ý
   --------------------------------------------------------------------- */
function ls(){ try{ return G.localStorage || null; }catch(e){ return null; } }
function readSt(){
  try{ const raw = ls() && ls().getItem(KEY); const o = raw ? JSON.parse(raw) : null; if(o && typeof o === "object" && !Array.isArray(o)) return o; }catch(e){}
  return {};
}
function writeSt(o){ try{ ls() && ls().setItem(KEY, JSON.stringify(o)); }catch(e){} }

/** Do Not Track / Global Privacy Control đang bật? */
function dnt(){
  try{
    const n = G.navigator || {};
    const v = String(n.doNotTrack || G.doNotTrack || n.msDoNotTrack || "");
    return v === "1" || v === "yes" || n.globalPrivacyControl === true;
  }catch(e){ return false; }
}
/** true khi người dùng ĐÃ đồng ý mục "Thống kê sử dụng ẩn danh" */
function consent(){
  const s = readSt();
  return s.consent === "granted" && !(s.cats && s.cats.usage === false);
}
/** Cần hỏi? — chưa trả lời VÀ không bật DNT/GPC */
function shouldAsk(){ const s = readSt(); return s.consent !== "granted" && s.consent !== "denied" && !dnt(); }

function setConsent(on, source){
  const s = readSt();
  const was = consent();
  s.consent = on ? "granted" : "denied"; s.at = Date.now(); s.source = String(source || "settings").slice(0, 20);
  s.cats = { usage: !!on };
  writeSt(s);
  if(on && !was){
    startProviders();
    track("analytics_consent", { granted: true, source: s.source });
  }
  if(!on){
    Q.length = 0;
    stopProviders();
    clearLog();                                   // rút lại đồng ý → xoá luôn nhật ký cục bộ
  }
  try{ hideBanner(); }catch(e){}
  return consent();
}

/* ---------------------------------------------------------------------
   2. LÀM SẠCH DỮ LIỆU (không PII)
   --------------------------------------------------------------------- */
/* Khoá nhạy cảm: so TỪNG đoạn snake_case (để "recipe_id", "platform", "items" không bị nhầm) + vài chuỗi con chắc chắn là PII */
const PII_SEG = new Set(["email","mail","phone","sdt","tel","mobile","name","names","ten","hoten","fullname","firstname","lastname","address","diachi","street",
  "uid","userid","user","token","password","passwd","pw","pass","ip","lat","lng","lon","latitude","longitude","birth","birthday","dob","contact","text","note",
  "notes","message","msg","comment","search","query"]);
const PII_SUB = /(e_?mail|phone|password|address|dia_?chi|ho_?ten|full_?name|user_?id)/;
function piiKey(k){ return PII_SUB.test(k) || k.split("_").some(seg=> PII_SEG.has(seg)); }
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_VN = /(?:\+?84|\b0)[\s.\-]?\d(?:[\s.\-]?\d){7,9}\b/;
function looksPhone(s){
  if(PHONE_VN.test(s)) return true;
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return false;                 // ngày YYYY-MM-DD không phải SĐT
  const digits = s.replace(/\D/g, "");
  return /^[+\d\s.\-()]+$/.test(s) && digits.length >= 9 && digits.length <= 15;
}
function cleanEvent(name){
  const n = String(name == null ? "" : name).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  return /^[a-z][a-z0-9_]{1,39}$/.test(n) ? n : "";
}
function cleanValue(v){
  if(v == null) return undefined;
  if(typeof v === "boolean") return v;
  if(typeof v === "number") return Number.isFinite(v) ? Math.round(v * 1000) / 1000 : undefined;
  if(typeof v === "string"){
    let s = v.trim().slice(0, 100);
    if(EMAIL_RE.test(s) || looksPhone(s)) return "[redacted]";
    return s;
  }
  return undefined;                                // object / mảng / hàm → bỏ (tránh lọt dữ liệu lồng)
}
/** props → bản sao sạch: tối đa 25 khoá snake_case, bỏ khoá nhạy cảm, giá trị ngắn & phẳng */
function sanitize(props){
  const out = {};
  if(!props || typeof props !== "object" || Array.isArray(props)) return out;
  let n = 0;
  for(const k of Object.keys(props)){
    if(n >= 25) break;
    const key = cleanEvent(k);
    if(!key || piiKey(key)) continue;
    const v = cleanValue(props[k]);
    if(v === undefined) continue;
    out[key] = v; n++;
  }
  return out;
}
/** Băm mã người dùng (không gửi uid thật): SHA-256(muối + id) → 16 ký tự hex; không có WebCrypto → FNV-1a 2×32 bit */
function fnv(s){
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
  for(let i = 0; i < s.length; i++){ const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return ("00000000" + h1.toString(16)).slice(-8) + ("00000000" + h2.toString(16)).slice(-8);
}
async function hashId(id){
  const s = SALT + String(id == null ? "" : id);
  try{
    const sub = G.crypto && G.crypto.subtle;
    if(sub && typeof TextEncoder !== "undefined"){
      const buf = await sub.digest("SHA-256", new TextEncoder().encode(s));
      return "u_" + Array.from(new Uint8Array(buf)).map(b=> b.toString(16).padStart(2, "0")).join("").slice(0, 16);
    }
  }catch(e){}
  return "u_" + fnv(s);
}

/* ---------------------------------------------------------------------
   3. NGỮ CẢNH CHUNG (không định danh)
   --------------------------------------------------------------------- */
function platform(){
  try{ const C = G.Capacitor; if(C && typeof C.getPlatform === "function") return C.getPlatform(); }catch(e){}
  return "web";
}
function appVersion(){ try{ return typeof APP_VERSION !== "undefined" ? String(APP_VERSION) : "0"; }catch(e){ return "0"; } }
function baseProps(){
  let theme = "";
  try{ theme = G.fkTheme && typeof G.fkTheme.current === "function" ? String(G.fkTheme.current() || "") : ""; }catch(e){}
  let mode = "";
  try{ mode = typeof cloud !== "undefined" && cloud ? cloud.mode : ""; }catch(e){}
  return { app_version: appVersion(), platform: platform(), lang: String((G.navigator && G.navigator.language) || "vi").slice(0, 8), theme: theme.slice(0, 20), backend: mode };
}

/* ---------------------------------------------------------------------
   4. NHÀ CUNG CẤP
   --------------------------------------------------------------------- */
const Q = [];                         // sự kiện chờ nhà cung cấp sẵn sàng (chỉ khi đã đồng ý)
const P = { firebase:null, posthog:null, fbLoading:false, phLoading:false, started:false };
let _uidHash = null;

function loadScript(src){
  return new Promise((res, rej)=>{
    try{
      const d = G.document; if(!d || !d.createElement) return rej(new Error("no-dom"));
      const s = d.createElement("script"); s.src = src; s.async = true; s.crossOrigin = "anonymous";
      s.onload = ()=> res(); s.onerror = ()=> rej(new Error("load " + src));
      (d.head || d.body).appendChild(s);
    }catch(e){ rej(e); }
  });
}
function fbConfig(){ try{ return typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG ? FIREBASE_CONFIG : null; }catch(e){ return null; } }
function phConfig(){
  let key = "", host = "";
  try{ const A = G.APP_CONFIG && G.APP_CONFIG.posthog; if(A && A.key){ key = String(A.key); host = String(A.host || ""); } }catch(e){}
  try{ if(!key && typeof MEDIA_CONFIG !== "undefined" && MEDIA_CONFIG && MEDIA_CONFIG.posthogKey){ key = String(MEDIA_CONFIG.posthogKey); host = String(MEDIA_CONFIG.posthogHost || ""); } }catch(e){}
  key = key.trim(); host = (host.trim() || POSTHOG_EU).replace(/\/+$/, "");
  if(!/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(host)) host = POSTHOG_EU;
  return key ? { key, host } : null;
}
/** Danh sách nhà cung cấp ĐANG được cấu hình (không phụ thuộc đồng ý) */
function providers(){
  const out = [];
  const c = fbConfig();
  let fbMode = false; try{ fbMode = typeof cloud !== "undefined" && cloud && cloud.mode === "firebase"; }catch(e){}
  if(c && c.apiKey && c.measurementId && fbMode) out.push("firebase");
  if(phConfig()) out.push("posthog");
  out.push("local");
  return out;
}

function startProviders(){
  if(!consent()) return;
  P.started = true;
  const list = providers();
  if(list.includes("firebase") && !P.firebase && !P.fbLoading) startFirebase();
  if(list.includes("posthog") && !P.posthog && !P.phLoading) startPosthog();
  flush();
}
function stopProviders(){
  P.started = false;
  try{ if(P.firebase && P.firebase.setAnalyticsCollectionEnabled) P.firebase.setAnalyticsCollectionEnabled(false); }catch(e){}
  try{ if(P.posthog){ P.posthog.opt_out_capturing && P.posthog.opt_out_capturing(); P.posthog.reset && P.posthog.reset(); } }catch(e){}
}

/* (a) Firebase Analytics — gtag do SDK tải từ googletagmanager.com (CSP đã cho phép) */
async function startFirebase(){
  P.fbLoading = true;
  try{
    const fb = G.firebase;
    if(!fb || !fb.apps || !fb.apps.length) throw new Error("firebase-not-ready");
    // tắt tín hiệu quảng cáo / Google Signals TRƯỚC khi SDK chạy
    G.dataLayer = G.dataLayer || [];
    if(typeof G.gtag !== "function") G.gtag = function(){ G.dataLayer.push(arguments); };
    G.gtag("set", { allow_google_signals: false, allow_ad_personalization_signals: false });
    if(!fb.analytics) await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics-compat.js");
    if(!consent()) return;                        // người dùng tắt trong lúc tải
    const a = fb.analytics();
    try{ a.setAnalyticsCollectionEnabled(true); }catch(e){}
    try{ if(_uidHash) a.setUserId(_uidHash); }catch(e){}
    P.firebase = a;
    flush();
  }catch(e){ try{ console.warn("[analytics] firebase", e && e.message); }catch(_){} }
  finally{ P.fbLoading = false; }
}
/* (b) PostHog — SDK chính thức (array.js) chỉ tải SAU khi đồng ý; cấu hình tối thiểu dữ liệu */
async function startPosthog(){
  const c = phConfig(); if(!c) return;
  P.phLoading = true;
  try{
    const assets = c.host.replace("://eu.i.", "://eu-assets.i.").replace("://us.i.", "://us-assets.i.");
    if(!G.posthog || !G.posthog.__loaded) await loadScript(assets + "/static/array.js");
    if(!consent() || !G.posthog || typeof G.posthog.init !== "function") return;
    G.posthog.init(c.key, {
      api_host: c.host, autocapture: false, capture_pageview: false, capture_pageleave: false,
      disable_session_recording: true, disable_surveys: true, advanced_disable_decide: true,
      persistence: "localStorage", disable_persistence: false, ip: false, mask_all_text: true, mask_all_element_attributes: true,
      respect_dnt: true, opt_out_capturing_by_default: false, property_denylist: ["$current_url", "$referrer", "$referring_domain", "$initial_referrer", "$initial_referring_domain"],
    });
    try{ G.posthog.opt_in_capturing && G.posthog.opt_in_capturing(); }catch(e){}
    try{ if(_uidHash) G.posthog.identify(_uidHash); }catch(e){}
    P.posthog = G.posthog;
    flush();
  }catch(e){ try{ console.warn("[analytics] posthog", e && e.message); }catch(_){} }
  finally{ P.phLoading = false; }
}
/* (c) Nhật ký cục bộ — vòng đệm */
function readLog(){ try{ const a = JSON.parse((ls() && ls().getItem(LOG_KEY)) || "[]"); return Array.isArray(a) ? a : []; }catch(e){ return []; } }
function writeLocal(ev){
  const a = readLog(); a.push(ev);
  while(a.length > LOG_MAX) a.shift();
  try{ ls() && ls().setItem(LOG_KEY, JSON.stringify(a)); }catch(e){}
}
function clearLog(){ try{ ls() && ls().removeItem(LOG_KEY); }catch(e){} }

/** Gửi tới nhà cung cấp từ xa (nhật ký cục bộ đã ghi ngay lúc track) */
function send(ev){
  try{ if(P.firebase) P.firebase.logEvent(ev.e, ev.p); }catch(e){}
  try{ if(P.posthog) P.posthog.capture(ev.e, ev.p); }catch(e){}
}
function flush(){
  if(!consent()){ Q.length = 0; return; }
  const remoteWanted = providers().filter(x=> x !== "local");
  if(!remoteWanted.length){ Q.length = 0; return; }   // chỉ có nhật ký cục bộ → không cần hàng đợi
  const loading = (remoteWanted.includes("firebase") && !P.firebase && P.fbLoading) || (remoteWanted.includes("posthog") && !P.posthog && P.phLoading);
  if(loading) return;                              // còn đang tải SDK → giữ hàng đợi, tải xong gọi flush()
  while(Q.length) send(Q.shift());
}

/* ---------------------------------------------------------------------
   5. API CÔNG KHAI
   --------------------------------------------------------------------- */
const stats = { dropped: 0, sent: 0 };
function track(event, props){
  if(!consent()){ stats.dropped++; return false; }   // tắt → không gì rời máy (kể cả nhật ký cục bộ)
  const e = cleanEvent(event); if(!e){ stats.dropped++; return false; }
  const ev = { e, p: Object.assign(sanitize(baseProps()), sanitize(props)), t: Date.now() };
  writeLocal(ev);                                   // (c) nhật ký cục bộ — ghi ngay
  if(!P.started) startProviders();
  Q.push(ev); while(Q.length > QUEUE_MAX) Q.shift();
  flush();
  stats.sent++;
  return true;
}
async function identify(userId, traits){
  if(!consent()) return null;
  _uidHash = userId ? await hashId(userId) : null;
  const t = sanitize(traits);
  try{ if(P.firebase) P.firebase.setUserId(_uidHash); }catch(e){}
  try{ if(P.posthog){ if(_uidHash) P.posthog.identify(_uidHash, t); else P.posthog.reset(); } }catch(e){}
  writeLocal({ e: "$identify", p: Object.assign({ id: _uidHash ? "hashed" : "anon" }, t), t: Date.now() });
  return _uidHash;
}
let _lastScreen = "";
function screen(name, props){
  const n = cleanEvent(name); if(!n || n === _lastScreen) return false;
  _lastScreen = n;
  return track("screen_view", Object.assign({ screen: n }, props || {}));
}

/* ---------------------------------------------------------------------
   6. THẺ HỎI ĐỒNG Ý (lần mở đầu tiên, không chặn thao tác)
   --------------------------------------------------------------------- */
const esc = s=> String(s == null ? "" : s).replace(/[&<>"'`]/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;", "`":"&#96;" }[c]));
function isOpen(id){ try{ const el = G.document.getElementById(id); return !!(el && el.classList && el.classList.contains("open")); }catch(e){ return false; } }
function busy(){ return isOpen("onboarding") || isOpen("auth") || isOpen("sheet-backdrop") || isOpen("ob-ready"); }
let _bannerShown = false;
function hideBanner(){
  try{ const b = G.document.getElementById("fk-consent"); if(b){ b.classList.remove("open"); b.hidden = true; } }catch(e){}
}
/** Hiện thẻ hỏi nếu cần (gọi khi vào Trang chủ). force = mở lại từ Cài đặt */
function askConsent(force){
  if(!force && (!shouldAsk() || _bannerShown || busy())) return false;
  const d = G.document; if(!d || !d.createElement) return false;
  let b = d.getElementById("fk-consent");
  const host = d.getElementById("app-shell") || d.body;
  if(!b || !b.isConnected){
    b = d.createElement("section"); b.id = "fk-consent"; b.className = "fk-consent";
    b.setAttribute("role", "dialog"); b.setAttribute("aria-modal", "false"); b.setAttribute("aria-labelledby", "fk-consent-h");
    host.appendChild(b);
  }
  const on = consent();
  b.innerHTML = `<h2 id="fk-consent-h" class="fk-consent-h">Giúp TapEasy tốt hơn?</h2>
    <p class="fk-consent-p">Cho phép gửi <b>thống kê sử dụng ẩn danh</b> (bạn mở màn nào, dùng tính năng nào) để chúng tôi biết chỗ nào cần sửa. Không gửi tên, email, số điện thoại hay số đo cơ thể. Bạn đổi ý bất cứ lúc nào trong Hồ sơ → Quyền riêng tư.</p>
    <label class="fk-consent-row"><span><b>Thống kê sử dụng ẩn danh</b><small>Mặc định tắt cho đến khi bạn đồng ý</small></span>
      <input type="checkbox" id="fk-consent-usage" role="switch" ${on ? "checked" : ""} aria-describedby="fk-consent-h"></label>
    <p class="fk-consent-p fk-consent-dim">Luôn bật (cần để app chạy): lưu hồ sơ, giáo án, nhật ký trên máy bạn.</p>
    <div class="fk-consent-acts">
      <button type="button" class="btn btn-ghost btn-sm" id="fk-consent-no">Không, cảm ơn</button>
      <button type="button" class="btn btn-outline btn-sm" id="fk-consent-save">Lưu lựa chọn</button>
      <button type="button" class="btn btn-primary btn-sm" id="fk-consent-yes">Đồng ý</button>
    </div>`;
  b.hidden = false; b.classList.add("open");
  _bannerShown = true;
  const g = id=> d.getElementById(id);
  const yes = g("fk-consent-yes"), no = g("fk-consent-no"), save = g("fk-consent-save");
  if(yes) yes.onclick = ()=> setConsent(true, "banner");
  if(no) no.onclick = ()=> setConsent(false, "banner");
  if(save) save.onclick = ()=>{ const c = g("fk-consent-usage"); setConsent(!!(c && c.checked), "banner_custom"); };
  return true;
}

/* ---------------------------------------------------------------------
   7. GẮN ĐO LƯỜNG VÀO MODULE KHÁC (chạy 1 lần sau khi mọi file đã nạp)
   --------------------------------------------------------------------- */
function wrapGlobal(name, make){
  try{ const old = G[name]; if(typeof old !== "function" || old.__fka) return false; const f = make(old); f.__fka = true; G[name] = f; return true; }
  catch(e){ return false; }
}
function wrapMethod(obj, name, make){
  try{ if(!obj) return false; const old = obj[name]; if(typeof old !== "function" || old.__fka) return false; const f = make(old); f.__fka = true; obj[name] = f; return true; }
  catch(e){ return false; }
}
function foodCount(){
  try{
    const day = state && state.foodLog && state.foodLog[typeof todayStr === "function" ? todayStr() : ""];
    if(!day) return {};
    const o = {}; Object.keys(day).forEach(k=>{ o[k] = Array.isArray(day[k]) ? day[k].length : 0; }); return o;
  }catch(e){ return {}; }
}
let _instrumented = false;
function instrument(){
  if(_instrumented) return; _instrumented = true;
  // Màn hình
  wrapGlobal("goto", old=> function(s){ const r = old.apply(this, arguments); try{ screen(String(s || "")); if(s === "home") setTimeout(()=> askConsent(false), 600); }catch(e){} return r; });
  // Món ăn: so số món hôm nay trước/sau mỗi lần lưu → bắt được MỌI đường thêm món (thủ công, công thức, thực đơn, quét AI)
  let fc = foodCount();
  wrapGlobal("saveState", old=> function(){
    const r = old.apply(this, arguments);
    try{
      if(consent()){
        const now = foodCount();
        Object.keys(now).forEach(m=>{ const d = now[m] - (fc[m] || 0); if(d > 0) track("meal_logged", { meal: m, items: d }); });
        fc = now;
      }
    }catch(e){}
    return r;
  });
  wrapGlobal("tplAddToWeek", old=> function(t){ try{ track("plan_created", { source: "template", template_id: String((t && t.id) || "").slice(0, 40) }); }catch(e){} return old.apply(this, arguments); });
  wrapGlobal("openRecipe", old=> function(id){ try{ track("recipe_view", { recipe_id: String(id || "").slice(0, 60) }); }catch(e){} return old.apply(this, arguments); });
  wrapGlobal("renderPTProfile", old=> function(pr){ try{ track("pt_profile_view", { verified: !!(pr && pr.verified) }); }catch(e){} return old.apply(this, arguments); });
  // Liên hệ PT (Tìm PT: buổi thử / câu hỏi / kết nối)
  try{ if(typeof cloud !== "undefined" && cloud && cloud.ptdir) wrapMethod(cloud.ptdir, "sendRequest", old=> function(lid, data){
    const r = old.apply(this, arguments);
    Promise.resolve(r).then(()=> track("pt_contact", { type: String((data && (data.type || data.kind)) || "request").slice(0, 20) })).catch(()=>{});
    return r; }); }catch(e){}
  try{ if(typeof cloud !== "undefined" && cloud) wrapMethod(cloud, "joinByCode", old=> function(){
    const r = old.apply(this, arguments);
    Promise.resolve(r).then(()=> track("pt_contact", { type: "join_code" })).catch(()=>{});
    return r; }); }catch(e){}
  // Giao diện
  try{ if(G.fkTheme) wrapMethod(G.fkTheme, "set", old=> function(id){ const r = old.apply(this, arguments); try{ track("theme_change", { theme: String(id || "").slice(0, 20) }); }catch(e){} return r; }); }catch(e){}
  // Chia sẻ: mọi lần gọi Web Share API (training-pro, kb, findpt, nutrition-pro, coach…)
  try{
    const N = G.navigator;
    if(N && typeof N.share === "function" && !N.share.__fka){
      const orig = N.share;
      const f = function(data){ try{ track("share", { has_url: !!(data && data.url), has_file: !!(data && data.files && data.files.length), screen: _lastScreen }); }catch(e){} return orig.apply(N, arguments); };
      f.__fka = true;
      try{ N.share = f; }catch(e){ try{ Object.defineProperty(N, "share", { value: f, configurable: true, writable: true }); }catch(_){} }
    }
  }catch(e){}
  // Đăng nhập → gắn mã băm (không gửi uid thật)
  try{ if(typeof cloud !== "undefined" && cloud && typeof cloud.onAuth === "function") cloud.onAuth(u=>{ try{ if(consent()) identify(u && u.uid ? u.uid : null); }catch(e){} }); }catch(e){}
}

/* ---------------------------------------------------------------------
   8. KHỞI ĐỘNG (feedback.js gọi sau khi mọi module đã nạp)
   --------------------------------------------------------------------- */
let _booted = false;
function boot(){
  if(_booted) return; _booted = true;
  const s = readSt();
  const first = !s.firstOpen;
  if(first){ s.firstOpen = Date.now(); writeSt(s); }
  instrument();
  if(consent()){
    startProviders();
    track("app_open", { first_open: first, days_since_install: Math.max(0, Math.floor((Date.now() - (s.firstOpen || Date.now())) / 86400000)) });
    try{ if(typeof cloud !== "undefined" && cloud && cloud.user) identify(cloud.user.uid); }catch(e){}
  }
}

const api = { __v: 1, consent, setConsent, dnt, shouldAsk, askConsent, hideBanner, track, identify, screen, sanitize, cleanEvent, hashId,
  providers, log: readLog, clearLog, boot, instrument, stats, _P: P, _Q: Q, KEY, LOG_KEY, POSTHOG_EU };
G.FKAnalytics = api;
G.fkTrack = track;
G.fkIdentify = identify;
G.fkScreen = screen;
})(typeof window !== "undefined" ? window : globalThis);

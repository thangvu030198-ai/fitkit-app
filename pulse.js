/* =========================================================================
   TapEasy — NHỊP SỬ DỤNG ẨN DANH (pulse.js) · docs/ANALYTICS-ADMIN.md
   Phục vụ mục "Phân tích" trong Bảng quản trị: số người đang trực tuyến, DAU / WAU / MAU, người mới, giữ chân, phễu, tính năng.

   Nguyên tắc
   - KHÔNG gửi uid, email, tên, IP, nội dung. Chỉ một mã thiết bị ngẫu nhiên (vid) sinh tại máy + các NHÃN ĐẾM cố định.
   - Người đã bấm "Không đồng ý" thống kê, hoặc trình duyệt bật Do Not Track / Global Privacy Control → KHÔNG gửi gì.
   - Trình duyệt tự động hoá (navigator.webdriver) → không gửi (không làm bẩn số liệu).
   - Tắt toàn bộ: FK_FEATURES.metrics = false (firebase-config.js).
   - Ngày tính theo giờ Việt Nam (UTC+7) cho mọi người dùng → số liệu theo ngày nhất quán.

   Dữ liệu ghi (firestore.rules khoá chặt hình dạng):
     presence/{vid}                 { ts, p:"web|android|ios", s:"màn hình", l:"vi|en", a:bool }      — nhịp 60 giây khi app đang mở
     activity/{d|w|m}_{kỳ}_{vid}    { ts, t:[nhãn…] }                                                 — 1 tài liệu / thiết bị / ngày·tuần·tháng
   Nhãn:  d:NGÀY · d:NGÀY|p:web · d:NGÀY|l:vi · d:NGÀY|a:1 · d:NGÀY|ret · d:NGÀY|f:workout
          n:NGÀY (người mới) · n:NGÀY|s:facebook · n:NGÀY|p:web · n:NGÀY|f:onboard
          r:NGÀY_ĐẦU>SỐ_NGÀY (giữ chân) · w:THỨ_HAI · w:…|p:web · m:THÁNG · m:…|p:web
   API: window.FKPulse = { enabled(), mark(event, props), beat(), state(), tagsFor(now), day(t), week(t), month(t), demoStore(), FEATURES, SOURCES }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKPulse && G.FKPulse.__v) return;

const KEY = "fk_pulse_v1";            // { vid, first:"YYYY-MM-DD", src, sent:{ d, w, m, tags:[…] } }
const DEMO_KEY = "fk_pulse_demo";     // chế độ demo: mô phỏng trên máy để bảng quản trị demo có số liệu
const AN_KEY = "fk_analytics_v1";
const HB_MS = 60000, MIN_GAP_MS = 25000, TZ_MS = 7 * 3600000, DAY_MS = 86400000;
const FEATURES = ["onboard", "signup", "plan", "workout", "meal", "recipe", "pt", "community", "shop", "events", "share"];
const SOURCES = ["direct", "facebook", "tiktok", "instagram", "youtube", "zalo", "google", "store", "other"];
const EVENT_FEATURE = { plan_ready_view:"onboard", plan_created:"plan", workout_start:"workout", workout_finish:"workout", set_logged:"workout",
  meal_logged:"meal", recipe_view:"recipe", pt_contact:"pt", pt_profile_view:"pt", share:"share" };
const SCREEN_FEATURE = { community:"community", shop:"shop", events:"events", findpt:"pt" };

const ls = ()=>{ try{ return G.localStorage || null; }catch(e){ return null; } };
const readJ = k=>{ try{ const r = ls() && ls().getItem(k); const o = r ? JSON.parse(r) : null; return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }catch(e){ return {}; } };
const writeJ = (k, o)=>{ try{ ls() && ls().setItem(k, JSON.stringify(o)); }catch(e){} };
const day = t=> new Date((t == null ? Date.now() : t) + TZ_MS).toISOString().slice(0, 10);
const week = t=>{ const d = new Date((t == null ? Date.now() : t) + TZ_MS); const dow = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - dow * DAY_MS).toISOString().slice(0, 10); };
const month = t=> day(t).slice(0, 7);
const dayDiff = (a, b)=> Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);

function newVid(){
  let s = "";
  try{ const a = new Uint8Array(20); (G.crypto || G.msCrypto).getRandomValues(a); for(let i = 0; i < 20; i++) s += "abcdefghijklmnopqrstuvwxyz0123456789"[a[i] % 36]; }
  catch(e){ while(s.length < 20) s += Math.random().toString(36).slice(2); s = s.replace(/[^a-z0-9]/g, "").slice(0, 20); }
  return "v" + s;
}
function sourceOf(){
  let raw = "";
  try{ raw = (new URLSearchParams(G.location.search).get("utm_source") || "").toLowerCase(); }catch(e){}
  if(!raw){ try{ const r = G.document && G.document.referrer; if(r){ const h = new URL(r).hostname.toLowerCase(); if(h && h !== G.location.hostname) raw = h; } }catch(e){} }
  if(!raw) return platform() === "web" ? "direct" : "store";
  if(/facebook|fb\.|fb$|messenger/.test(raw)) return "facebook";
  if(/tiktok/.test(raw)) return "tiktok";
  if(/instagram|ig$/.test(raw)) return "instagram";
  if(/youtube|youtu\.be/.test(raw)) return "youtube";
  if(/zalo/.test(raw)) return "zalo";
  if(/google|bing|coccoc|duckduckgo/.test(raw)) return "google";
  if(/play\.google|apps\.apple|appstore|chplay/.test(raw)) return "store";
  return "other";
}
function platform(){
  try{ const C = G.Capacitor; if(C && C.isNativePlatform && C.isNativePlatform()){ const p = C.getPlatform ? C.getPlatform() : ""; return p === "ios" ? "ios" : "android"; } }catch(e){}
  return "web";
}
function lang(){ try{ return G.FK_I18N && G.FK_I18N.lang === "en" ? "en" : "vi"; }catch(e){ return "vi"; } }
function signedIn(){ try{ return !!(G.cloud && G.cloud.user && G.cloud.user.uid); }catch(e){ return false; } }
function mode(){ try{ return G.cloud && G.cloud.mode || "demo"; }catch(e){ return "demo"; } }

function state(){
  const s = readJ(KEY);
  let dirty = false;
  if(!/^v[a-z0-9]{20}$/.test(s.vid || "")){ s.vid = newVid(); dirty = true; }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s.first || "")){
    const an = readJ(AN_KEY);                               // người đã dùng app từ trước: lấy ngày mở app lần đầu đã lưu
    s.first = an.firstOpen ? day(Number(an.firstOpen)) : day(); dirty = true;
  }
  if(SOURCES.indexOf(s.src) < 0){ s.src = sourceOf(); dirty = true; }
  if(!s.sent || typeof s.sent !== "object") { s.sent = { tags: [] }; dirty = true; }
  if(!Array.isArray(s.sent.tags)) { s.sent.tags = []; dirty = true; }
  if(dirty) writeJ(KEY, s);
  return s;
}

/* Có được gửi không? */
function optedOut(){
  try{ if(readJ(AN_KEY).consent === "denied") return true; }catch(e){}
  try{ const N = G.navigator || {}; if(N.globalPrivacyControl === true || N.doNotTrack === "1" || G.doNotTrack === "1" || N.msDoNotTrack === "1") return true; }catch(e){}
  return false;
}
function enabled(){
  try{ if(typeof FK_FEATURES !== "undefined" && FK_FEATURES && FK_FEATURES.metrics === false) return false; }catch(e){}
  try{ if(G.navigator && G.navigator.webdriver && !G.__FK_PULSE_TEST) return false; }catch(e){}
  return !optedOut();
}

/* Nhãn của kỳ hiện tại (hàm thuần — test được) */
let _feats = {};                      // tính năng đã chạm trong ngày: { "2026-11-15": { workout:1 } }
let _screen = "home";
function tagsFor(now, st, ctx){
  st = st || state(); ctx = ctx || {};
  const d = day(now), w = week(now), m = month(now);
  const p = ctx.p || platform(), l = ctx.l || lang(), a = ctx.a == null ? signedIn() : !!ctx.a;
  const feats = Object.keys(ctx.feats || _feats[d] || {}).filter(f=> FEATURES.indexOf(f) >= 0);
  const isNew = st.first === d, diff = dayDiff(st.first, d);
  const D = [`d:${d}`, `d:${d}|p:${p}`, `d:${d}|l:${l}`];
  if(a) D.push(`d:${d}|a:1`);
  if(isNew){ D.push(`n:${d}`, `n:${d}|s:${st.src}`, `n:${d}|p:${p}`); }
  else { D.push(`d:${d}|ret`); if(diff > 0 && diff <= 30) D.push(`r:${st.first}>${diff}`); }
  feats.forEach(f=>{ D.push(`d:${d}|f:${f}`); if(isNew) D.push(`n:${d}|f:${f}`); });
  return { d, w, m, D, W: [`w:${w}`, `w:${w}|p:${p}`], M: [`m:${m}`, `m:${m}|p:${p}`] };
}

/* Ghi: Firebase thật → Firestore; demo → localStorage (chỉ máy này) */
function fdb(){ try{ return mode() === "firebase" && G.firebase && G.firebase.firestore ? G.firebase.firestore() : null; }catch(e){ return null; } }
function demoStore(){ const s = readJ(DEMO_KEY); s.presence = s.presence || {}; s.activity = s.activity || {}; return s; }
async function putActivity(id, tags){
  if(!tags.length) return;
  const db = fdb();
  if(db){
    const FV = G.firebase.firestore.FieldValue;
    await db.collection("activity").doc(id).set({ t: FV.arrayUnion.apply(FV, tags), ts: FV.serverTimestamp() }, { merge: true });
  } else if(mode() !== "firebase"){
    const s = demoStore(), cur = s.activity[id] || { t: [] };
    tags.forEach(x=>{ if(cur.t.indexOf(x) < 0) cur.t.push(x); }); cur.ts = Date.now(); s.activity[id] = cur; writeJ(DEMO_KEY, s);
  } else throw new Error("offline");
}
async function putPresence(vid, doc){
  const db = fdb();
  if(db){ await db.collection("presence").doc(vid).set(Object.assign({ ts: G.firebase.firestore.FieldValue.serverTimestamp() }, doc)); }
  else if(mode() !== "firebase"){ const s = demoStore(); s.presence[vid] = Object.assign({ ts: Date.now() }, doc); writeJ(DEMO_KEY, s); }
  else throw new Error("offline");
}

let _busy = false, _lastBeat = 0;
async function sync(now){
  if(!enabled() || _busy) return false;
  _busy = true;
  try{
    const st = state(), T = tagsFor(now, st);
    if(st.sent.d !== T.d){ st.sent = { d: T.d, w: st.sent.w, m: st.sent.m, tags: [] }; }
    const fresh = T.D.filter(x=> st.sent.tags.indexOf(x) < 0);
    if(fresh.length){ await putActivity(`d_${T.d}_${st.vid}`, fresh); st.sent.tags = st.sent.tags.concat(fresh).slice(-60); }
    if(st.sent.w !== T.w){ await putActivity(`w_${T.w}_${st.vid}`, T.W); st.sent.w = T.w; }
    if(st.sent.m !== T.m){ await putActivity(`m_${T.m}_${st.vid}`, T.M); st.sent.m = T.m; }
    writeJ(KEY, st);
    return true;
  }catch(e){ return false; }
  finally{ _busy = false; }
}
async function beat(force){
  const now = Date.now();
  if(!enabled()) return false;
  try{ if(G.document && G.document.visibilityState === "hidden") return false; }catch(e){}
  if(!force && now - _lastBeat < MIN_GAP_MS) return false;
  _lastBeat = now;
  try{ await putPresence(state().vid, { p: platform(), s: _screen, l: lang(), a: signedIn() }); }catch(e){}
  await sync(now);
  return true;
}

/* analytics.js gọi ở đầu track() / screen() — TRƯỚC khi xét đồng ý; ở đây chỉ lấy TÊN sự kiện + tên màn hình (không lấy thuộc tính khác) */
function mark(event, props){
  try{
    const e = String(event || "");
    let f = EVENT_FEATURE[e] || null;
    if(e === "screen_view" || e === "$screen"){
      const s = String(props && (props.screen || props.name) || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
      if(s){ _screen = s; f = SCREEN_FEATURE[s] || f; }
    }
    if(e === "onboarding_step_complete" && props && props.last) f = "onboard";
    if(f) feature(f);
  }catch(_){}
}
let _syncT = null;
function feature(f){
  if(FEATURES.indexOf(f) < 0) return;
  const d = day(); _feats[d] = _feats[d] || {};
  if(_feats[d][f]) return;
  _feats[d][f] = 1;
  try{ const st = state(); st.feats = { d, f: Object.keys(_feats[d]) }; writeJ(KEY, st); }catch(e){}
  clearTimeout(_syncT); _syncT = setTimeout(()=> sync(Date.now()), 4000);    // gộp nhiều nhãn vào 1 lần ghi
}

let _started = false;
function start(){
  if(_started) return; _started = true;
  try{ const st = state(); if(st.feats && st.feats.d === day()) { _feats[st.feats.d] = {}; (st.feats.f || []).forEach(f=>{ _feats[st.feats.d][f] = 1; }); } }catch(e){}
  // Màn hình mở dạng lớp phủ (không qua goto): cộng đồng / gian hàng / sự kiện / tìm PT
  const wrapOpen = (host, name, scr)=>{ try{ const h = G[host]; if(!h || typeof h[name] !== "function" || h[name].__pulse) return; const old = h[name];
    const f = function(){ try{ mark("screen_view", { screen: scr }); }catch(e){} return old.apply(this, arguments); }; f.__pulse = true; h[name] = f; }catch(e){} };
  wrapOpen("TECommunity", "open", "community"); wrapOpen("TapShop", "open", "shop"); wrapOpen("TapEv", "open", "events"); wrapOpen("TE_FINDPT", "open", "findpt");
  try{ const c = G.cloud; if(c && typeof c.signUp === "function" && !c.signUp.__pulse){ const old = c.signUp;
    const f = function(){ const r = old.apply(this, arguments); Promise.resolve(r).then(()=> feature("signup")).catch(()=>{}); return r; }; f.__pulse = true; c.signUp = f; } }catch(e){}
  try{ if(G.cloud && typeof G.cloud.onAuth === "function") G.cloud.onAuth(()=>{ setTimeout(()=> beat(false), 1500); }); }catch(e){}
  try{ G.document.addEventListener("visibilitychange", ()=>{ if(G.document.visibilityState === "visible") beat(false); }); }catch(e){}
  setTimeout(()=> beat(true), 3500);                       // sau khi cloud.init() kịp xong
  setInterval(()=> beat(false), HB_MS);
}

G.FKPulse = { __v: 1, enabled, optedOut, mark, feature, beat, sync, state, tagsFor, day, week, month, dayDiff, platform, sourceOf, demoStore, start,
  FEATURES, SOURCES, KEY, DEMO_KEY, HB_MS };
try{ if(G.document){ if(G.document.readyState === "complete") start(); else G.addEventListener("load", start); } }catch(e){}
})(typeof window !== "undefined" ? window : globalThis);

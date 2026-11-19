/* =========================================================================
   TapEasy — NÚT "XEM VIDEO HƯỚNG DẪN TRÊN YOUTUBE" (guide-links.js) · 19/11/2026
   Nạp SAU app.js / library.js. (1) Nút tìm kiếm YouTube; (2) từ 19/11: 2 video hướng dẫn cụ thể / bài, phát bằng trình phát nhúng
   chính thức của YouTube (youtube-nocookie) — app không tải, không lưu video của người khác.
   Gắn vào: chi tiết bài trong buổi (openExerciseDetail), khối "Hướng dẫn kỹ thuật" ở màn tập (renderSessionStep),
   tab Hướng dẫn ở Thư viện bài tập (library.js gọi FKYT.button()).
   API: window.FKYT = { query(name), url(name), button(name), open(url) }
   ========================================================================= */
(function(G){
"use strict";
if(G.FKYT) return;
const D = G.document;
const esc = s=> (typeof escapeHtml === "function" ? escapeHtml(String(s == null ? "" : s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])));

/** "Đẩy ngực máy (Machine Chest Press)" → "Machine Chest Press proper form"; tên chỉ tiếng Việt → "<tên> kỹ thuật đúng" */
function query(name){
  const s = String(name || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if(!s) return "";
  const m = /\(([^()]*[A-Za-z][^()]*)\)\s*$/.exec(s);
  if(m) return `${m[1].trim()} proper form`;
  if(/^[\x20-\x7E]+$/.test(s)) return `${s} proper form`;
  return `${s} kỹ thuật đúng`;
}
function url(name){ const q = query(name); return q ? "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) : ""; }
function button(name, cls){
  const u = url(name); if(!u) return "";
  return `<button type="button" class="btn btn-outline btn-sm yt-btn ${cls || ""}" data-yt="${esc(u)}"><span class="material-symbols-rounded">play_circle</span>Xem video hướng dẫn trên YouTube</button>`;
}

/* ---- VIDEO HƯỚNG DẪN CỤ THỂ (19/11): 2 video YouTube / bài (68 bài của app), đã kiểm bằng oEmbed: còn tồn tại + cho phép nhúng.
   Phát bằng trình phát nhúng chính thức youtube-nocookie (CSP frame-src đã cho phép) — chỉ tải khi người dùng chạm vào ảnh bìa.
   Bài không có trong bảng → vẫn có nút tìm kiếm YouTube như cũ. ---- */
const EX_YT = {
  pullup:["sIvJTfGxdFo", "9yVGh3XbJ34"], bentoverrow:["2NXnuTQXJA4", "l64i5zVjCu0"], deadlift:["ZaTM37cfiDs", "8np3vKDBJfc"], facepull:["eTCBSFlCJ_s", "wnPX6Fwe-Fg"],
  calfraise:["4HQ8Am9IuME", "k8ipHzKeAkQ"], hammercurl:["8EmVkgiUe3M", "3nqezx8BEv0"], plank:["hoeNgjheDHk", "v25dawSzRTM"], hangingleg:["0wSUjj5j1xo", "-LHetdLNhjI"],
  russiantwist:["wJrP-5ex8EA", "_d5cpAre7_w"], crunch:["TBZAdtsoGgw", "qZq9bNk1owk"], jumprope:["WA1xNoWA7yA", "FJmRQ5iTXKE"], rowing:["iBuUIBeN08k", "L4y5NSmsUhk"],
  hipthrust:["NDlzVV-UCHE", "23nVTEiO8iQ"], glutebridge:["omXcDmLBtzc", "KI6fjDqGZh4"], rdl:["5vopfuN6Wrk", "ZEnWV4kguKc"], gobletsquat:["nfX7IFK9UNI", "zsN2WvklwDk"],
  stepup:["9ZknEYboBOQ", "Zp7RG4jFScw"], legext:["Tae3aeJe5Ks", "2lvdnQg04PM"], cablerow:["8QuMq1GMMng", "iitCIXBgDCE"], dbrow:["fURsHPHgssI", "vbechsUCn24"],
  dbpress:["k6tzKisR3NY", "0FuzhFsGgSI"], dbbench:["QyuH_vFnQfI", "sTYWWaunX8o"], machinepress:["VHIlmOPMWWs", "Qu7-ceCvq7w"], kickback:["KMMnggkh5I0", "VSgMyiOu0uE"],
  abduction:["I4ApZY585nE", "5O_Y9l__iao"], bwsquat:["ZLJBfYF_oO0", "DlS-GAF8Edg"], inclinepushup:["0Se2aRFGWoQ", "0JUrOH--Kdk"], invertedrow:["VO-pt_XgFho", "sHeLHRd_nCs"],
  deadbug:["XcYtWYMz39w", "bxn9FBrt4-A"], sideplank:["rCxF2nG9vQ0", "44ND4bOB-T0"], mountainclimber:["DdDyAdYZOMw", "gW-q50V6Z_0"], kbswing:["DU4HHdW0uaA", "v3wnrSluDcw"],
  woodchop:["PCQCwP1Xy0g", "Gwcf4TOj1hc"], skullcrusher:["ZY7HEE_A-ns", "m3F6u1yYIjQ"], frontsquat:["7qUCbtm_f24", "6PLvU0rjw18"], pullover:["l0YnKjgikm0", "QZlxP3evaOY"],
  bulgarian:["or1frhkjBDc", "YFLHDXeekVc"], hacksquat:["fE5BWPy7uRc", "hglQExHCM9Q"], smithsquat:["jPrzu4kp47o", "fC5urG2CCr8"], csrow:["09wri23R4SU", "ro2vfHfD0DQ"],
  cablelateral:["ZZYpkGiPcgk", "f_OGBg2KxgY"], ohtriext:["NTk0Igxqcsk", "09gpiVqdpPM"], preacher:["WyAVZn6_PIY", "uqzHydRYHOg"], sledpush:["1PmO6kzBEc8", "eIuUCETBy9A"],
  wallball:["62dtjkUizn4", "D653dvXxg5k"], farmercarry:["VBobkldqqvk", "OalyeWGbRb0"], inclinewalk:["Ii71nAaRc_8", "NAsObfFJXvE"], zone2:["VcGMGIuVMFo", "taO8kKsx448"],
  pecdeck:["CRroep849bU", "ybi3NPUK47M"], burpee:["qLBImHhCXSw", "fZx6nxKMq4E"], walking:["2VVjeqedgQY", "_VPWUPSmGQc"], stretch:["t_YEUWe6Yn8", "COO2S7lPBzA"],
  intervalwalk:["oTnytejP9hw", "3hTYB-v_TJo"], benchpress:["gRVjAtPip0Y", "4Y2ZdHCOXok"], inclinedb:["8fXfwG4ftaQ", "ljyqdC4ydrM"], pushup:["-Oa88QNL1bc", "WDIpL0pjun0"],
  cablefly:["B-k90Me9o7g", "I-Ue34qLxc4"], latpulldown:["CAwf7n6Luuc", "trZQjegcRx0"], overheadpress:["afR3tPH6y_g", "4LBVP2Oe7fg"], lateralraise:["Y29xKcze8Ik", "3VcKaXpzqRo"],
  squat:["-bJIpOq-LWk", "_vNjV8teHW0"], legpress:["tRV9hBDT3us", "K5n2vg3oZa4"], lunges:["5smjqy11Ibc", "YYWhkctnP2o"], legcurl:["SbSNUXPRkc8", "NlZeAGZ_YJw"],
  bicepcurl:["MKWBV29S6c0", "6DeLZ6cbgWQ"], tricepdip:["l1itVZTVDDo", "6cRAes2lNNQ"], tricepsdown:["_w-HpW70nSQ", "IBGvZUzoQiQ"], running:["hMH1QYE8F7Q", "j2UmKxUANAE"]
};
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
/* Bài Thư viện 800+ (free-exercise-db) cùng động tác + cùng dụng cụ với bài của app → dùng chung video đã kiểm */
const EXDB_ALIAS = {
  Barbell_Full_Squat:"squat", Barbell_Squat:"squat", Olympic_Squat:"squat", Barbell_Deadlift:"deadlift", Romanian_Deadlift:"rdl",
  Barbell_Glute_Bridge:"glutebridge", Butt_Lift_Bridge:"glutebridge", Barbell_Hip_Thrust:"hipthrust", Smith_Machine_Hip_Raise:"hipthrust",
  Barbell_Lunge:"lunges", Barbell_Walking_Lunge:"lunges", Bodyweight_Walking_Lunge:"lunges", Dumbbell_Lunges:"lunges", Dumbbell_Rear_Lunge:"lunges",
  Barbell_Shoulder_Press:"overheadpress", Standing_Military_Press:"overheadpress", Seated_Barbell_Military_Press:"overheadpress",
  Bent_Over_Barbell_Row:"bentoverrow", Bodyweight_Squat:"bwsquat", Cable_Crossover:"cablefly", Low_Cable_Crossover:"cablefly", Flat_Bench_Cable_Flyes:"cablefly",
  Cable_Rope_Overhead_Triceps_Extension:"ohtriext", Triceps_Overhead_Extension_with_Rope:"ohtriext", Cable_Seated_Lateral_Raise:"cablelateral",
  Dumbbell_Bench_Press:"dbbench", Dumbbell_Incline_Row:"csrow", Dumbbell_Shoulder_Press:"dbpress", Seated_Dumbbell_Press:"dbpress", Face_Pull:"facepull",
  Front_Barbell_Squat:"frontsquat", Glute_Kickback:"kickback", Goblet_Squat:"gobletsquat", Hack_Squat:"hacksquat", Narrow_Stance_Hack_Squats:"hacksquat",
  Hammer_Curls:"hammercurl", Incline_Dumbbell_Press:"inclinedb", Leg_Press:"legpress", Narrow_Stance_Leg_Press:"legpress",
  Leverage_Chest_Press:"machinepress", Machine_Bench_Press:"machinepress", Lying_Leg_Curls:"legcurl", Machine_Preacher_Curls:"preacher", Preacher_Curl:"preacher",
  Seated_Cable_Rows:"cablerow", Side_Lateral_Raise:"lateralraise", Seated_Side_Lateral_Raise:"lateralraise", Smith_Machine_Squat:"smithsquat",
  Split_Squat_with_Dumbbells:"bulgarian", Standing_Calf_Raises:"calfraise", Standing_Barbell_Calf_Raise:"calfraise", Standing_Dumbbell_Calf_Raise:"calfraise",
  Smith_Machine_Calf_Raise:"calfraise", Thigh_Abductor:"abduction", Triceps_Pushdown:"tricepsdown", Ab_Crunch_Machine:"crunch", Crunches:"crunch",
  Dumbbell_Bicep_Curl:"bicepcurl", Smith_Machine_Bench_Press:"benchpress", "Barbell_Bench_Press_-_Medium_Grip":"benchpress", Pullups:"pullup",
  Plank:"plank", Pushups:"pushup", Russian_Twist:"russiantwist", Hanging_Leg_Raise:"hangingleg", Dead_Bug:"deadbug", Mountain_Climbers:"mountainclimber",
  Farmers_Walk:"farmercarry", Kettlebell_Sumo_High_Pull:"", "Wide-Grip_Lat_Pulldown":"latpulldown", "Dips_-_Triceps_Version":"tricepdip",
  Inverted_Row:"invertedrow", "Bent_Over_Two-Dumbbell_Row":"dbrow", "One-Arm_Dumbbell_Row":"dbrow", Skull_Crusher:"skullcrusher", "EZ-Bar_Skullcrusher":"skullcrusher",
  Bench_Dips:"tricepdip", Leg_Extensions:"legext", Dumbbell_Step_Ups:"stepup", Butterfly:"pecdeck", "Straight-Arm_Dumbbell_Pullover":"pullover",
};
/* Video tìm tự động cho Thư viện 800+ (workflow media-yt-guides.yml → media/yt/index.json), nạp nền khi mở app */
let YT_EXDB = {};
try{ const c = G.localStorage && localStorage.getItem("fk_yt_exdb"); if(c){ const j = JSON.parse(c); if(j && typeof j === "object") YT_EXDB = j; } }catch(e){}
function loadExdbIndex(){
  try{
    if(typeof fetch !== "function") return;
    const base = (G.location && /^https?:/.test(G.location.protocol) && !/tapeasy\.app$/.test(G.location.hostname)) ? "https://tapeasy.app/" : "";
    fetch(base + "media/yt/index.json", { cache: "no-cache" }).then(r=> r.ok ? r.json() : null).then(j=>{
      if(!j || !j.items || typeof j.items !== "object") return;
      const out = {}; Object.keys(j.items).forEach(k=>{ const a = j.items[k]; if(/^[A-Za-z0-9_().,'-]{2,90}$/.test(k) && Array.isArray(a)) out[k] = a.filter(x=> YT_ID.test(x)).slice(0, 3); });
      YT_EXDB = out; try{ localStorage.setItem("fk_yt_exdb", JSON.stringify(out)); }catch(e){}
    }).catch(()=>{});
  }catch(e){}
}
loadExdbIndex();
function idsFor(exId){
  exId = String(exId || "");
  if(exId.indexOf("x:") === 0){ const a = YT_EXDB[exId.slice(2)]; return Array.isArray(a) ? a.filter(x=> YT_ID.test(x)) : []; }
  const a = EX_YT[exId]; return Array.isArray(a) ? a.filter(x=> YT_ID.test(x)) : [];
}
/** khoá bài của item (bài app / bài thư viện qua bảng FV_CORE_EXDB / theo tên tiếng Anh trong ngoặc) */
function exKeyOf(item, name){
  try{
    if(item && item.exerciseId && EX_YT[item.exerciseId]) return item.exerciseId;
    const xid = item && item.custom && item.custom.exDbId;
    if(xid && Array.isArray(YT_EXDB[xid]) && YT_EXDB[xid].length) return "x:" + xid;          // video tìm riêng cho đúng bài thư viện
    if(xid && EXDB_ALIAS[xid] && EX_YT[EXDB_ALIAS[xid]]) return EXDB_ALIAS[xid];             // cùng động tác + dụng cụ với bài của app
    if(xid && typeof FV_CORE_EXDB !== "undefined"){ const k = Object.keys(FV_CORE_EXDB).find(k=> FV_CORE_EXDB[k] === xid); if(k && EX_YT[k]) return k; }
    const n = String(name || (item && item.custom && item.custom.name) || "").toLowerCase().trim();
    if(n && typeof EXERCISES !== "undefined"){
      const en = (/\(([^()]+)\)\s*$/.exec(n) || [])[1] || "";
      const k = Object.keys(EXERCISES).find(k=>{ const nm = String(EXERCISES[k].name || "").toLowerCase(); const e2 = (/\(([^()]+)\)\s*$/.exec(nm) || [])[1] || ""; return nm === n || (en && e2 && en === e2); });
      if(k && EX_YT[k]) return k;
    }
  }catch(e){}
  return "";
}
function stripHTML(exId, name){
  const ids = idsFor(exId); if(!ids.length) return "";
  return `<div class="ytg" data-ytg="${esc(exId)}"><div class="ytg-h"><span class="material-symbols-rounded">play_circle</span>Video hướng dẫn kỹ thuật<small>${ids.length} góc quay · YouTube</small></div>
    <div class="ytg-row">${ids.map((id, i)=> `<button type="button" class="ytg-card" data-ytid="${id}" aria-label="Phát video hướng dẫn ${i + 1}: ${esc(name || "")}">
      <img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy"><span class="ytg-play"><span class="material-symbols-rounded">play_arrow</span></span><span class="ytg-n">Góc ${i + 1}</span></button>`).join("")}</div>
    <button type="button" class="ytg-more" data-yt="${esc(url(name))}"><span class="material-symbols-rounded">search</span>Tìm thêm trên YouTube</button></div>`;
}
function playIn(card){
  const id = card && card.getAttribute("data-ytid"); if(!YT_ID.test(id || "")) return;
  const f = D.createElement("iframe");
  f.className = "ytg-frame"; f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  f.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen"); f.setAttribute("allowfullscreen", ""); f.setAttribute("title", "Video hướng dẫn");
  f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  const wrap = D.createElement("div"); wrap.className = "ytg-player"; wrap.appendChild(f);
  const open = D.createElement("button"); open.type = "button"; open.className = "ytg-open"; open.setAttribute("data-yt", "https://www.youtube.com/watch?v=" + id);
  open.innerHTML = `<span class="material-symbols-rounded">play_circle</span>Mở trên YouTube`;
  const box = card.closest(".ytg"); const old = box.querySelector(".ytg-player"); if(old) old.remove();
  box.querySelector(".ytg-row").after(wrap); wrap.after(open); const o2 = box.querySelectorAll(".ytg-open"); if(o2.length > 1) o2[0].remove();
  box.querySelectorAll(".ytg-card").forEach(c=> c.classList.toggle("on", c === card));
}
function open(u){
  if(!/^https:\/\/www\.youtube\.com\/(results\?search_query=|watch\?v=[A-Za-z0-9_-]{11}$)/.test(String(u || ""))) return false;
  try{
    const C = G.Capacitor, B = C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Browser;
    if(B){ B.open({ url: u }); return true; }
  }catch(e){}
  try{ G.open(u, "_blank", "noopener"); }catch(e){}
  return true;
}
if(D && D.addEventListener) D.addEventListener("click", e=>{
  const c = e.target && e.target.closest ? e.target.closest("[data-ytid]") : null; if(c){ e.preventDefault(); playIn(c); return; }
  const b = e.target && e.target.closest ? e.target.closest("[data-yt]") : null; if(!b) return;
  e.preventDefault(); open(b.getAttribute("data-yt"));
});

/* ---- gắn vào các màn có sẵn ---- */
function sheetName(){ const sc = D && D.getElementById("sheet-content"); const h = sc && sc.querySelector("h3"); return h ? h.textContent : ""; }
function curItem(){ try{ return typeof session !== "undefined" && session && session.items ? session.items[session.idx] : null; }catch(e){ return null; } }
function addStrip(sc, item, name, where){
  if(!sc || sc.querySelector(".ytg")) return true;
  const k = exKeyOf(item, name), html = k ? stripHTML(k, name) : ""; if(!html) return false;
  if(where) where.insertAdjacentHTML("beforebegin", html); else sc.insertAdjacentHTML("beforeend", html);
  return true;
}
function addToSession(){
  const sc = D && D.getElementById("sheet-content"); if(!sc) return;
  // 19/11: màn tập KHÔNG chèn dải video riêng nữa — video YouTube nằm trong khối media trên cùng (ex-guide.js), ở đây chỉ còn nút tìm thêm trong mục Hướng dẫn
  if(sc.querySelector(".yt-btn")) return;
  const g = Array.from(sc.querySelectorAll("details.set-guide")).find(d=>{ const sm = d.querySelector("summary"); return sm && /Hướng dẫn kỹ thuật/.test(sm.textContent); });
  if(!g) return;
  const name = sheetName(); const html = button(name, "in-guide"); if(!html) return;
  g.insertAdjacentHTML("beforeend", html);
}
function itemByUid(uid){
  try{ const days = (G.state && state.plan && state.plan.days) || []; for(const d of days){ const it = (d.items || []).find(x=> x.uid === uid); if(it) return it; } }catch(e){}
  try{ if(typeof session !== "undefined" && session && session.items) return session.items.find(x=> x.uid === uid) || null; }catch(e){}
  return null;
}
function addToDetail(uid){
  const sc = D && D.getElementById("sheet-content"); if(!sc) return;
  const t = Array.from(sc.querySelectorAll(".card-title")).find(x=> /Hướng dẫn kỹ thuật/.test(x.textContent)); if(!t) return;
  addStrip(sc, itemByUid(uid), sheetName(), t);
  if(sc.querySelector(".yt-btn")) return;
  const p = t.nextElementSibling; const html = button(sheetName(), "in-detail"); if(!html) return;
  (p || t).insertAdjacentHTML("afterend", html);
}
function install(){
  if(typeof renderSessionStep === "function" && !renderSessionStep.__yt){ const f = renderSessionStep; renderSessionStep = function(){ const o = f.apply(this, arguments); try{ addToSession(); }catch(e){} return o; }; renderSessionStep.__yt = true; }
  if(typeof openExerciseDetail === "function" && !openExerciseDetail.__yt){ const f = openExerciseDetail; openExerciseDetail = function(uid){ const o = f.apply(this, arguments); try{ addToDetail(uid); }catch(e){} return o; }; openExerciseDetail.__yt = true; }
}
G.FKYT = { query, url, button, open, install, idsFor, exKeyOf, stripHTML, playIn, EX_YT, EXDB_ALIAS, loadExdbIndex, get exdbCount(){ return Object.keys(YT_EXDB).length; } };
install();
if(D) D.addEventListener("DOMContentLoaded", install, { once: true });
})(typeof window !== "undefined" ? window : globalThis);

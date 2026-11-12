/* =========================================================================
   TapEasy — ẢNH CÓ NGƯỜI → ẢNH MINH HOẠ TẠO BẰNG AI (people-ai.js)
   Nạp NGAY SAU data.js (trước templates.js/app.js) để IMG.* đổi trước khi các file sau đọc.

   - Bảng MAP: Pexels photo id (ảnh có người cũ) → id ảnh AI (scripts/ai_people_prompts.json,
     docs/AI-PEOPLE-IMAGES.md). Ảnh sinh bởi workflow media-people-ai.yml → media/people-ai/.
   - fkPeopleImg(urlCu, small) → URL ảnh AI trên GitHub Pages khi media/people-ai/index.json có id
     đó; ngược lại trả NGUYÊN urlCu (app chạy bình thường khi chưa gen ảnh / mất mạng).
   - index.json tải 1 lần (cache localStorage → lần mở sau đổi ảnh đồng bộ ngay từ lúc nạp).
   - Khi có ảnh: ghi đè IMG.*, EXERCISES[*].img, HERO_CYCLE; ảnh đã/ sắp vẽ (img src, data-tm-src,
     background-image) đổi tại chỗ. Dữ liệu seed (PT, sự kiện) GIỮ URL Pexels làm dự phòng:
     ảnh AI tải lỗi → tự quay về URL cũ (không lặp lại).
   - Credit: fkPeopleAI.isAi(url) → nơi hiển thị ghi "Ảnh minh hoạ tạo bằng AI" thay cho Pexels.
   ========================================================================= */
(function(G){
"use strict";
if(G.fkPeopleAI) return;
const BASE = "https://thangvu030198-ai.github.io/fitkit-app/media/people-ai/";
const LS_KEY = "fk_people_ai_idx";
const LABEL = "Ảnh minh hoạ tạo bằng AI";
/*MAP-BEGIN — sinh từ scripts/ai_people_prompts.json (replaces_pexels) */
  const MAP = {
    "38453108":"hero-workout-1", "29825227":"hero-workout-2", "31783554":"hero-workout-3", "38453228":"hero-workout-4",
    "3465878":"sleep-hero", "36933874":"sleep-card", "36537691":"avatar-default", "17959564":"muscle-chest",
    "36387535":"muscle-legs", "37281143":"muscle-arms", "4662331":"muscle-core", "28162956":"muscle-cardio",
    "37191727":"ev-run-dawn", "17979277":"ev-run-warmup", "5319396":"ev-run-bridge", "31216262":"ev-group-outdoor",
    "6150627":"ev-group-jog", "7266744":"ev-group-stretch", "5319491":"ev-group-warmup", "29859465":"ev-fit-row",
    "32830368":"ev-fit-sled", "9545914":"ev-fit-zone", "4853898":"ev-fit-wallball", "16966303":"ev-pl-deadlift",
    "16966307":"ev-pl-ready", "841125":"ev-pl-bar", "13822300":"ev-pl-woman", "38939130":"ev-ws-cooking",
    "8844379":"ev-ws-menu", "35652755":"ev-picnic-group", "35773483":"ev-picnic-lunch", "1472887":"ev-picnic-yoga",
    "29840338":"ev-run-mist", "36715224":"ev-yoga-park", "36715610":"ev-yoga-group", "8692128":"ev-yoga-balance",
    "36715608":"ev-yoga-autumn", "703012":"ch-gym-session", "4944980":"ch-partners", "2526885":"ch-run-street",
    "4853255":"ch-water", "6550832":"ch-scale", "1073101":"rv-medal", "17979591":"rv-finish-cheer",
    "35812359":"rv-crowd-warmup", "2567044":"rv-thumbs", "6550865":"pt-khang", "6550844":"pt-khang-1",
    "6551087":"pt-khang-2", "6550852":"pt-khang-3", "6551437":"pt-khang-4", "40371837":"pt-khang-5",
    "6551078":"pt-khang-6", "6550840":"pt-khang-7", "7593038":"pt-thuha", "7592348":"pt-thuha-1",
    "7593040":"pt-thuha-2", "7592357":"pt-thuha-3", "7592425":"pt-thuha-4", "7592757":"pt-thuha-5",
    "4854263":"pt-phuc", "4853692":"pt-phuc-1", "4853917":"pt-phuc-2", "4853287":"pt-phuc-3",
    "4853293":"pt-phuc-4", "4854258":"pt-phuc-5", "4853275":"pt-phuc-6", "18136887":"pt-ngocanh",
    "18136882":"pt-ngocanh-1", "8769175":"pt-ngocanh-2", "6111610":"pt-ngocanh-3", "6111607":"pt-ngocanh-4",
    "31509844":"pt-ngocanh-5", "35168122":"pt-ductai", "35305754":"pt-ductai-1", "6740344":"pt-ductai-2",
    "6740342":"pt-ductai-3", "6740346":"pt-ductai-4", "8611244":"pt-ductai-5", "6740338":"pt-ductai-6",
    "40021619":"pt-quynhnhu", "40021609":"pt-quynhnhu-1", "40021611":"pt-quynhnhu-2", "40021296":"pt-quynhnhu-3",
    "9545911":"pt-quynhnhu-4", "13993574":"pt-giabao", "13993572":"pt-giabao-1", "13993540":"pt-giabao-2",
    "10021269":"pt-giabao-3", "10021280":"pt-giabao-4", "35703187":"pt-giabao-5", "12890881":"pt-vanson",
    "12890817":"pt-vanson-1", "33188911":"pt-vanson-2", "5799855":"pt-vanson-3", "6388373":"pt-vanson-4",
    "40309468":"pt-vanson-5", "40428934":"pt-mailinh", "40428947":"pt-mailinh-1", "40428937":"pt-mailinh-2",
    "4090012":"pt-mailinh-3", "37156646":"pt-mailinh-4", "8957662":"pt-mailinh-5", "6922174":"pt-thanhtam",
    "6922177":"pt-thanhtam-1", "6922122":"pt-thanhtam-2", "6922123":"pt-thanhtam-3", "6922165":"pt-thanhtam-4",
    "6922119":"pt-thanhtam-5", "40719510":"pt-khanhvy", "40719514":"pt-khanhvy-1", "40719515":"pt-khanhvy-2",
    "37304029":"pt-khanhvy-3", "8028663":"pt-khanhvy-4", "39322345":"pt-quanghuy", "29151594":"pt-quanghuy-1",
    "18715198":"pt-quanghuy-2", "31492040":"pt-quanghuy-3", "4853083":"pt-quanghuy-4", "13849172":"pt-my",
    "13849175":"pt-my-1", "13849171":"pt-my-2", "3984364":"pt-my-3", "3984362":"pt-my-4",
    "7055659":"pt-my-5", "8612586":"pt-nhatnam", "8611942":"pt-nhatnam-1", "8612030":"pt-nhatnam-2",
    "8611370":"pt-nhatnam-3", "40608838":"pt-nhatnam-4", "8611297":"pt-nhatnam-5", "13673631":"pt-thuyduong",
    "13673629":"pt-thuyduong-1", "31500878":"pt-thuyduong-2", "31500868":"pt-thuyduong-3", "14502911":"pt-thuyduong-4",
    "10942691":"pt-tuankiet", "10942689":"pt-tuankiet-1", "4804337":"pt-tuankiet-2", "6390225":"pt-tuankiet-3",
    "9545907":"pt-tuankiet-4", "4852739":"pt-baotram", "8032754":"pt-baotram-1", "7900680":"pt-baotram-2",
    "8846574":"pt-baotram-3", "6453430":"pt-baotram-4", "4498454":"pt-baotram-5", "20523354":"pt-anhdung",
    "13621289":"pt-anhdung-1", "29224211":"pt-anhdung-2", "40371850":"pt-anhdung-3", "34794734":"pt-anhdung-4",
    "39963095":"pt-haiyen", "40901922":"pt-haiyen-1", "40189494":"pt-haiyen-2", "40302221":"pt-haiyen-3",
    "40261672":"pt-haiyen-4", "40666375":"pt-haiyen-5", "40219053":"pt-minhtri", "40302238":"pt-minhtri-1",
    "40302239":"pt-minhtri-2", "40219056":"pt-minhtri-3", "40646062":"pt-minhtri-4", "40261686":"pt-minhtri-5",
    "4853876":"rv-pt-progress", "4426296":"rv-pt-yoga-home", "4426317":"rv-pt-posture", "4426318":"rv-pt-dance-home",
    "7690208":"rv-pt-hipthrust", "4436347":"rv-pt-trail-finish", "4428991":"rv-pt-first-lift",
  };
/*MAP-END*/
const IDS = new Set(Object.keys(MAP).map(k=> MAP[k]));
let avail = null;          // Set id ảnh AI đã có (theo index.json) — null = chưa có
const OLD = new Map();     // URL ảnh AI đã cấp → URL cũ (để quay về khi lỗi)
let loading = null, observer = null;

function pexelsId(u){ const m = /^https:\/\/images\.pexels\.com\/photos\/(\d+)\//.exec(String(u || "")); return m ? m[1] : ""; }
function aiId(u){ const p = pexelsId(u); return p && MAP[p] ? MAP[p] : ""; }
/** index.json → Set id hợp lệ (chỉ id có trong MAP, đúng tên file) */
function clean(j){
  const s = new Set();
  if(j && typeof j === "object" && !Array.isArray(j)) Object.keys(j).forEach(id=>{
    const e = j[id];
    if(IDS.has(id) && e && typeof e === "object" && e.file === id + ".webp") s.add(id);
  });
  return s;
}
function active(){ return !!(avail && avail.size); }
/** URL ảnh AI cho URL cũ (hoặc chính URL cũ nếu chưa có). small: true = bản 480 px; bỏ trống = theo tham số w= của URL cũ (≤ 400 → nhỏ) */
function fkPeopleImg(u, small){
  const id = aiId(u);
  if(!id || !avail || !avail.has(id)) return u;
  if(small == null){ const w = /[?&]w=(\d+)/.exec(String(u)); small = !!(w && +w[1] <= 400); }
  const n = BASE + id + (small ? "-sm" : "") + ".webp";
  if(!OLD.has(n)) OLD.set(n, u);
  return n;
}
/** url (cũ hoặc mới) đang/ sẽ hiển thị ảnh AI? */
function isAi(u){ u = String(u || ""); return u.indexOf(BASE) === 0 || (!!aiId(u) && fkPeopleImg(u) !== u); }

/* ---------- đổi ở nguồn dữ liệu ---------- */
function patchData(){
  if(!active()) return;
  try{ if(typeof IMG !== "undefined" && IMG) Object.keys(IMG).forEach(k=>{ IMG[k] = fkPeopleImg(IMG[k]); }); }catch(e){}
  try{ if(typeof EXERCISES !== "undefined" && EXERCISES) Object.keys(EXERCISES).forEach(k=>{ const x = EXERCISES[k]; if(x && typeof x.img === "string") x.img = fkPeopleImg(x.img); }); }catch(e){}
  try{ if(typeof HERO_CYCLE !== "undefined" && Array.isArray(HERO_CYCLE)) HERO_CYCLE.forEach((u, i)=>{ HERO_CYCLE[i] = fkPeopleImg(u); }); }catch(e){}
}

/* ---------- đổi ảnh trên màn hình (mọi nơi dùng URL Pexels cũ) ---------- */
const SEL = 'img[src*="images.pexels.com/photos/"],[data-tm-src*="images.pexels.com/photos/"],[style*="images.pexels.com/photos/"]';
function swapEl(el){
  if(!el || !el.getAttribute || el.getAttribute("data-fk-noai")) return;
  ["src", "data-tm-src"].forEach(a=>{ const s = el.getAttribute(a); if(s && pexelsId(s)){ const n = fkPeopleImg(s); if(n !== s) el.setAttribute(a, n); } });
  const st = el.getAttribute("style");
  if(st && st.indexOf("images.pexels.com/photos/") >= 0){
    const n = st.replace(/https:\/\/images\.pexels\.com\/photos\/\d+\/[^'")\s]*/g, m=> fkPeopleImg(m));
    if(n !== st) el.setAttribute("style", n);
  }
}
function scan(root){
  if(!active() || !root) return;
  try{ if(root.matches && root.matches(SEL)) swapEl(root); }catch(e){}
  try{ if(root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll(SEL), swapEl); }catch(e){}
}
function watch(){
  const D = G.document; if(!D || observer || typeof G.MutationObserver !== "function") return;
  try{
    observer = new G.MutationObserver(list=>{ if(!active()) return; list.forEach(r=>{ if(r.type === "attributes") swapEl(r.target); else Array.prototype.forEach.call(r.addedNodes || [], n=>{ if(n.nodeType === 1) scan(n); }); }); });
    observer.observe(D.documentElement || D.body, { subtree:true, childList:true, attributes:true, attributeFilter:["src", "style", "data-tm-src"] });
  }catch(e){ observer = null; }
}
/* ảnh AI lỗi tải → quay về URL cũ, đánh dấu để không đổi lại */
function onErr(ev){
  const t = ev && ev.target; if(!t || t.tagName !== "IMG") return;
  const s = t.getAttribute("src") || ""; if(s.indexOf(BASE) !== 0) return;
  const id = s.slice(BASE.length).replace(/(-sm)?\.webp.*$/, "");
  const old = OLD.get(s) || "";
  t.setAttribute("data-fk-noai", "1");
  if(avail) avail.delete(id);   // file thiếu trên Pages → bỏ id này cho các lần sau trong phiên
  if(old) t.setAttribute("src", old);
}

function apply(){ patchData(); if(!active()) return; try{ scan(G.document && (G.document.body || G.document.documentElement)); }catch(e){} watch(); }
function setIndex(j, persist){
  avail = clean(j);
  if(persist){ try{ G.localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), ids: Array.from(avail) })); }catch(e){} }
  apply();
  return avail.size;
}
/** tải index.json 1 lần mỗi phiên (cache promise) */
function load(){
  if(loading) return loading;
  if(typeof G.fetch !== "function") return (loading = Promise.resolve(avail ? avail.size : 0));
  loading = G.fetch(BASE + "index.json", { cache:"no-cache" }).then(r=> r && r.ok ? r.json() : null).then(j=>{
    if(j && typeof j === "object") return setIndex(j, true);
    return avail ? avail.size : 0;
  }).catch(()=> avail ? avail.size : 0);
  return loading;
}

/* nạp đồng bộ từ cache (lần mở trước) → IMG.* đổi ngay trước templates.js/app.js */
try{
  const c = JSON.parse((G.localStorage && G.localStorage.getItem(LS_KEY)) || "null");
  if(c && Array.isArray(c.ids)){ const o = {}; c.ids.forEach(id=>{ o[id] = { file: id + ".webp" }; }); avail = clean(o); patchData(); }
}catch(e){}
try{ if(G.document && G.document.addEventListener) G.document.addEventListener("error", onErr, true); }catch(e){}
try{
  const kick = ()=>{ load(); if(active()) apply(); };
  if(G.document && G.document.readyState === "loading" && G.addEventListener) G.addEventListener("DOMContentLoaded", ()=> setTimeout(kick, 600));
  else setTimeout(kick, 600);
}catch(e){}

G.fkPeopleImg = fkPeopleImg;
G.fkPeopleAI = { BASE, LABEL, MAP, ids: ()=> avail ? Array.from(avail) : [], aiId, isAi, active, load, setIndex, apply, clean,
  credit: u=> isAi(u) ? LABEL : "" };
if(typeof module !== "undefined" && module.exports) module.exports = G.fkPeopleAI;
})(typeof window !== "undefined" ? window : globalThis);

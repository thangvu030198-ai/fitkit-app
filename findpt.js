/* =========================================================================
   TapEasy — TÌM PT (findpt.js + findpt.css) · dữ liệu: cloud-pt-directory.js (cloud.ptdir)

   1. Màn "Tìm PT" kiểu ALBUM / tạp chí: lưới ảnh bất đối xứng, tên PT cỡ lớn chồng lên ảnh
      (bị mép thẻ cắt như tiêu đề tạp chí), hiện dần khi cuộn, parallax nhẹ; ô thông tin
      "Bảng giá công khai" chen giữa album. Tìm không dấu + bộ lọc: khu vực (34 tỉnh/thành →
      phường/xã), địa điểm (phòng tập / tại nhà / online / ngoài trời + tên phòng tập), khoảng giá
      (thanh trượt 2 đầu + biểu đồ phân bố giá), giới tính, chuyên môn, đánh giá tối thiểu,
      đã xác minh, ngôn ngữ. Sắp xếp: phù hợp (công thức công khai), giá, đánh giá, phản hồi, mới.
   2. Chạm thẻ → hồ sơ PT kiểu F1 hero (ptprofile.js) + phần mở rộng: album, bảng giá công khai,
      địa điểm, lịch trống, chứng chỉ, thông tin minh bạch, ĐÁNH GIÁ & PHẢN HỒI (điểm tổng,
      phân bố sao, 4 tiêu chí, bình luận có ảnh, PT trả lời công khai, báo cáo, kiểm duyệt).
   3. Nhắn tin (chat PT Connect nếu đã kết nối) · Đặt buổi thử · Gửi lời mời kết nối.
   4. Khu TapEasy PT: "Niêm yết hồ sơ Tìm PT" (soạn / sửa / nháp / gỡ), hộp yêu cầu học viên.
   5. Form học viên: nhận xét 2 chiều PT ↔ học viên, mặc định RIÊNG TƯ (có giải thích).
   Điểm vào: ô "Tìm PT" Trang chủ (teHomeExplore) · openFindPTSoon · menu ☰ · màn PT · vai trò
   "Tìm & Book PT" · ?pt=<id> / #findpt · bảng quản trị (TE_ADMIN) · window.TE_FINDPT.open().
   Trạng thái: state.findpt = { f, sort, saved[], prov, seenReq, rvSort }
   Nạp SAU pt-connect.js / community.js (và trước cloud-admin.js / admin.js nếu có).
   ========================================================================= */
(function(G){
"use strict";
if(G.TE_FINDPT && G.TE_FINDPT.installed) return;
if(typeof cloud === "undefined" || !cloud || !cloud.ptdir){ try{ console.warn("[findpt] cần nạp cloud-pt-directory.js trước"); }catch(e){} return; }
const FP = G.TE_FINDPT = G.TE_FINDPT || {};
const P = cloud.ptdir, L = P.logic, D = P.data;

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH
   --------------------------------------------------------------------- */
const esc = s=> (typeof escapeHtml === "function") ? escapeHtml(s == null ? "" : String(s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic = (n, cls)=> `<span class="material-symbols-rounded${cls ? " " + cls : ""}" aria-hidden="true">${n}</span>`;
const q = (s, r)=> (r || document).querySelector(s);
const qa = (s, r)=> Array.from((r || document).querySelectorAll(s));
const fpAi = ()=> !!(G.fkPeopleAI && G.fkPeopleAI.active());   // ảnh hồ sơ minh hoạ đã thay bằng ảnh AI (people-ai.js)
const url = u=>{ const s = String(u == null ? "" : u); if(typeof attrUrl === "function") return attrUrl(s, { noBlob:true }); return /^(https:\/\/|data:image\/(jpeg|png|webp);base64,)/i.test(s) ? esc(s) : ""; };
const warn = (...a)=>{ try{ console.warn("[findpt]", ...a); }catch(e){} };
const say = (m, i)=>{ try{ toast(m, i || "check"); }catch(e){} };
const save = ()=>{ try{ saveState(); }catch(e){} };
const p2 = n=> String(n).padStart(2, "0");
const dmy = t=>{ const d = new Date(t); return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`; };
const mY = t=>{ const d = new Date(t); return `${p2(d.getMonth()+1)}/${d.getFullYear()}`; };
const ago = t=>{ const s = (Date.now() - (Number(t)||0)) / 1000; if(s < 3600) return Math.max(1, Math.round(s/60)) + " phút trước"; if(s < 86400) return Math.round(s/3600) + " giờ trước"; if(s < 86400*31) return Math.round(s/86400) + " ngày trước"; return dmy(t); };
const n1 = v=> (Math.round((Number(v)||0) * 10) / 10).toLocaleString("vi-VN", { minimumFractionDigits:1, maximumFractionDigits:1 });
const mk = v=> L.moneyK(v), money = v=> L.moneyVN(v);
const reduced = ()=>{ try{ return G.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lowfx"); }catch(e){ return false; } };
const isActive = id=>{ const s = document.getElementById(id); return !!(s && s.classList.contains("active")); };
const amPT = ()=> !!(cloud.profile && cloud.profile.isPT);
const myUid = ()=> (cloud.user && cloud.user.uid) || null;
/* App Store 1.2 (vòng 2): người đã chặn — FKBlock (coach.js) bọc cloud.blockUser / listBlocked / isBlockedSync */
const isBlk = uid=>{ try{ return !!uid && (G.FKBlock ? G.FKBlock.is(uid) : (typeof cloud.isBlockedSync === "function" && cloud.isBlockedSync(String(uid)))); }catch(e){ return false; } };
const blkReady = ()=>{ try{ return G.FKBlock ? G.FKBlock.ready() : Promise.resolve([]); }catch(e){ return Promise.resolve([]); } };
const blkBtn = (uid, name, where)=>{ try{ return G.FKBlock && cloud.isLoggedIn() ? G.FKBlock.btnHTML(uid, name, where, "fp-act dim") : ""; }catch(e){ return ""; } };
const can = p=>{ try{ return typeof teCan === "function" && !!teCan(p); }catch(e){ return false; } };
const todayS = ()=> (typeof todayStr === "function" ? todayStr() : new Date().toISOString().slice(0,10));
const clone = o=> JSON.parse(JSON.stringify(o == null ? null : o));
const firstName = n=>{ const w = String(n||"").trim().split(/\s+/); return w[w.length-1] || n || "PT"; };
const scroller = ()=> q("#app-scroll");
const STAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.2l-5.8 3.2 1.2-6.5L2.6 9.4l6.5-.8z"/></svg>`;
function stars(v, cls){ const r = Math.round(Number(v)||0); return `<span class="fp-stars ${cls||""}" role="img" aria-label="${r} trên 5 sao">${[1,2,3,4,5].map(k=> `<i class="${k <= r ? "on" : ""}">${STAR}</i>`).join("")}</span>`; }
function starsAvg(v){ const p = Math.max(0, Math.min(100, (Number(v)||0) / 5 * 100)); const s = [1,2,3,4,5].map(()=> STAR).join(""); return `<span class="fp-sa" role="img" aria-label="${n1(v)} trên 5 sao"><span class="bg">${s}</span><span class="fg" style="width:${p}%">${s}</span></span>`; }
const GRADS = [["#0E3B47","#FF7A45"],["#123A5A","#33D6C9"],["#3A1F4A","#FF9466"],["#0B2A33","#9AF1DD"],["#2A1A12","#FFB08A"],["#062B2E","#02BCB3"]];
const gradOf = id=> GRADS[parseInt(L.hashStr(id), 36) % GRADS.length];
function needLogin(what){
  if(cloud.isLoggedIn()) return false;
  try{ confirmDialog("Cần đăng nhập", `Đăng nhập để ${esc(what)}. Xem album và đánh giá thì không cần tài khoản.`, ()=>{ try{ showAuth("login"); }catch(e){} }, "Đăng nhập", "person"); }catch(e){ say("Bạn cần đăng nhập", "person"); }
  return true;
}
function busy(btn, on, label){ if(!btn) return; if(on){ btn._t = btn.innerHTML; btn.disabled = true; btn.innerHTML = label || "Đang gửi..."; } else { btn.disabled = false; if(btn._t != null) btn.innerHTML = btn._t; } }
function pickFiles(multi, cb){
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; if(multi) inp.multiple = true;
  inp.onchange = ()=> cb(Array.from(inp.files || [])); inp.click();
}

/* Icon nét mảnh bổ sung (chỉ thêm nếu chưa có) */
function addIcons(){
  if(typeof FK_LINE !== "object" || !FK_LINE) return;
  const CHAT = "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.6-.8L3 21l1.9-4.8A8.4 8.4 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5z";
  const add = {
    fp_verified: "M12 2.5l2.3 1.7 2.9-.2.9 2.7 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.7-2.9-.2L12 21.5l-2.3-1.7-2.9.2-.9-2.7-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.7 2.9.2z|M8.7 12l2.3 2.3 4.3-4.6",
    favorite: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z",
    forum: CHAT + "|M8 11.5h.01|M12 11.5h.01|M16 11.5h.01", chat: CHAT,
    inbox: "M22 12h-6l-2 3h-4l-2-3H2|M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z",
    sort: "M3 6h13|M3 12h9|M3 18h5|M18 8v12|M15 17l3 3 3-3",
    laptop: "r:4,5,16,11,1.5|M2 19h20",
    park: "M12 2.5l5 7h-3l4 6H6l4-6H7z|M12 15.5v6",
    payments: "r:2,6,20,12,2|c:12,12,2.6|M6 10v4|M18 10v4",
    language: "c:12,12,9.5|M2.5 12h19|M12 2.5c2.6 2.7 3.9 5.9 3.9 9.5s-1.3 6.8-3.9 9.5|M12 2.5C9.4 5.2 8.1 8.4 8.1 12s1.3 6.8 3.9 9.5",
    reply: "M9 14L4 9l5-5|M4 9h10a6 6 0 0 1 6 6v4",
    lock: "r:5,11,14,10,2|M8 11V7a4 4 0 0 1 8 0v4",
    history: "M3 12a9 9 0 1 0 3-6.7|M3 4v4.5h4.5|M12 7.5V12l3 2",
    workspace_premium: "c:12,9,6|M8.5 13.5L7 22l5-3 5 3-1.5-8.5",
    sell: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z|c:7.5,7.5,1.5",
    calendar_month: "r:3,4.5,18,16.5,2|M3 9.5h18|M8 2.5v4|M16 2.5v4|M7.5 13.5h.01|M12 13.5h.01|M16.5 13.5h.01|M7.5 17h.01|M12 17h.01",
    help: "c:12,12,9.5|M9.2 9a3 3 0 0 1 5.6 1c0 2-3 2.5-3 4|M12 17.5h.01",
    fp_hourglass: "M6 2.5h12|M6 21.5h12|M7 2.5v3a5 5 0 0 0 10 0v-3|M7 21.5v-3a5 5 0 0 1 10 0v3",
    fp_eye_off: "M3 3l18 18|M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.5.9-1.5 2.3-2.9 3.6|M6.6 6.6C4.6 8 3.2 10 2.5 12c1 1.8 4.5 6 9.5 6 1.7 0 3.2-.5 4.5-1.2|M9.9 9.9a3 3 0 0 0 4.2 4.2",
    expand_more: "M6 9l6 6 6-6",
    close: "M6 6l12 12|M18 6L6 18",
    arrow_back: "M19 12H5|M11 6l-6 6 6 6",
    add: "M12 5v14|M5 12h14",
    photo_camera: "M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|c:12,13,3.5",
  };
  Object.keys(add).forEach(k=>{ if(!FK_LINE[k]) FK_LINE[k] = add[k]; });
}

/* ---------------------------------------------------------------------
   1. TRẠNG THÁI + TẢI DỮ LIỆU
   --------------------------------------------------------------------- */
function st(){
  if(typeof state === "undefined" || !state) return { f: clone(D.DEFAULT_FILTER), sort:"match", saved:[] };
  const s = state.findpt = Object.assign({ f: clone(D.DEFAULT_FILTER), sort:"match", saved:[], prov:"", seenReq:0, onlySaved:false, rvSort:"new" }, state.findpt || {});
  s.f = Object.assign(clone(D.DEFAULT_FILTER), s.f || {});
  if(!Array.isArray(s.saved)) s.saved = [];
  return s;
}
const C = { list:null, byId:{}, loading:null, prev:"home", ctx:null, scrollY:0, seen:new Set(), io:null, rv:{}, rvF:"all", myReqs:[], inbox:[], myListing:undefined, raf:0 };
function load(force){
  if(C.loading && !force) return C.loading;
  C.loading = P.list().then(list=>{
    C.list = list; C.byId = {}; list.forEach(l=> C.byId[l.id] = l);
    try{ if(G.teHomeExplore) G.teHomeExplore.refresh(); }catch(e){}
    return list;
  }).catch(e=>{ warn("list", e); C.list = C.list || []; C.loadErr = e.message; return C.list; });
  return C.loading;
}
function userCtx(){
  const s = st(), p = (typeof state !== "undefined" && state && state.profile) || {};
  return { goal: p.goal || "", prov: s.f.prov || s.prov || "" };
}
function visibleList(){
  const s = st(); let list = L.filterListings(C.list || [], Object.assign({}, s.f, { includeHidden: can("listings.moderate") || can("pt.verify") }));
  if(s.onlySaved) list = list.filter(l=> s.saved.includes(l.id));
  list = list.filter(l=> !isBlk(l.uid || l.id));          // ẩn hồ sơ PT mình đã chặn
  return L.sortListings(list, s.sort, userCtx());
}

/* ---------------------------------------------------------------------
   2. MÀN TÌM PT (ALBUM)
   --------------------------------------------------------------------- */
function ensureScreen(){
  try{ if(typeof SUB_SCREENS !== "undefined" && Array.isArray(SUB_SCREENS) && !SUB_SCREENS.includes("findpt")) SUB_SCREENS.push("findpt"); }catch(e){}
  if(document.getElementById("screen-findpt") && q("#findpt-content")) return;
  const host = scroller(); if(!host) return;
  host.insertAdjacentHTML("beforeend", `<section id="screen-findpt" class="screen fk-dark-island" aria-label="Tìm PT — hồ sơ PT công khai"><div id="findpt-content"></div></section>`);
  const root = q("#findpt-content");
  root.addEventListener("click", onAlbumClick);
  root.addEventListener("keydown", e=>{ if((e.key === "Enter" || e.key === " ") && e.target && e.target.matches && e.target.matches("[data-fp-open]")){ e.preventDefault(); openListing(e.target.dataset.fpOpen, { from:"findpt" }); } });
}
const SORTS = [["match","Phù hợp","Đánh giá, xác minh, phản hồi, đúng mục tiêu & khu vực của bạn"],["price_asc","Giá thấp → cao","Theo giá thấp nhất mỗi buổi"],["price_desc","Giá cao → thấp",""],
  ["rating","Đánh giá cao","Trung bình có điều chỉnh theo số đánh giá"],["reviews","Nhiều đánh giá nhất",""],["response","Phản hồi nhanh","Tỉ lệ trả lời trong 24 giờ"],["new","Mới tham gia",""]];
const sortLabel = k=> (SORTS.find(s=> s[0] === k) || SORTS[0])[1];
const QUICK = [
  ["verified","Đã xác minh", f=> f.verified, f=> f.verified = !f.verified],
  ["online","Online", f=> f.place === "online", f=> f.place = f.place === "online" ? "" : "online"],
  ["home","Tại nhà", f=> f.place === "home", f=> f.place = f.place === "home" ? "" : "home"],
  ["cheap","≤ 300k", f=> f.priceMax === 300000 && !f.priceMin, f=>{ if(f.priceMax === 300000 && !f.priceMin){ f.priceMax = 0; } else { f.priceMin = 0; f.priceMax = 300000; } }],
  ["r45","4,5★ trở lên", f=> f.minRating === 4.5, f=> f.minRating = f.minRating === 4.5 ? 0 : 4.5],
  ["female","PT nữ", f=> f.gender === "female", f=> f.gender = f.gender === "female" ? "" : "female"],
  ["male","PT nam", f=> f.gender === "male", f=> f.gender = f.gender === "male" ? "" : "male"],
];
function render(){
  ensureScreen();
  const root = q("#findpt-content"); if(!root) return;
  const s = st(), f = s.f;
  const nF = L.countFilters(f);
  const provLabel = f.prov ? (D.PROV[f.prov] ? D.PROV[f.prov].name : "Toàn quốc") + (f.ward ? " · " + f.ward.replace(/^(Phường|Xã|Đặc khu)\s+/, "") : "") : "Toàn quốc";
  const total = (C.list || []).filter(l=> !l.hidden && l.status === "public").length;
  const provN = new Set((C.list || []).map(l=> l.prov)).size;
  root.innerHTML = `
    <div class="fp-topbar">
      <button type="button" class="fp-round" data-fp="back" aria-label="Quay lại">${ic("arrow_back")}</button>
      <button type="button" class="fp-region" data-fp="region" aria-label="Chọn khu vực: ${esc(provLabel)}"><span>${esc(provLabel)}</span>${ic("expand_more")}</button>
      <div class="fp-top-r">
        ${amPT() ? `<button type="button" class="fp-round" data-fp="editor" aria-label="Niêm yết hồ sơ Tìm PT của tôi">${ic("storefront")}</button>` : ""}
        <button type="button" class="fp-round" data-fp="myreqs" aria-label="Yêu cầu của tôi">${ic("inbox")}<i class="fp-badge" data-fp-badge hidden></i></button>
      </div>
    </div>
    <header class="fp-head">
      <div class="fp-eyebrow">TapEasy · Hồ sơ PT công khai</div>
      <h1 class="fp-h1" aria-label="Tìm PT"><span class="l1">Tìm</span><span class="l2">PT<em>.</em></span></h1>
      <p class="fp-sub">${C.list ? `<b>${total}</b> huấn luyện viên · ${provN} tỉnh/thành. ` : ""}Giá, chứng chỉ và đánh giá từ người <b>đã tập cùng</b> — công khai cho mọi người.</p>
      ${P.showsSamples() && (C.list || []).some(l=> l.seed) ? `<p class="fp-demo">${ic("info")}Bản thử nghiệm: hồ sơ minh hoạ (${fpAi() ? "ảnh minh hoạ tạo bằng AI" : "ảnh Pexels"}, tên & đánh giá giả lập).</p>` : ""}
    </header>
    <label class="fp-search">${ic("search")}<input id="fp-q" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Tên, chuyên môn, phòng tập, phường… (không dấu cũng được)" value="${esc(f.q)}" aria-label="Tìm PT"><button type="button" class="fp-clear" data-fp="clearq" aria-label="Xoá từ khoá" ${f.q ? "" : "hidden"}>${ic("close")}</button></label>
    <div class="fp-chips" role="toolbar" aria-label="Lọc nhanh">
      <button type="button" class="fp-chip strong ${nF ? "on" : ""}" data-fp="filters">${ic("tune")}Bộ lọc${nF ? ` <i>${nF}</i>` : ""}</button>
      ${QUICK.map(([k, label, on])=> `<button type="button" class="fp-chip ${on(f) ? "on" : ""}" data-fp-quick="${k}" aria-pressed="${on(f)}">${label}</button>`).join("")}
    </div>
    <div class="fp-resbar"><span id="fp-count" aria-live="polite"></span>
      <button type="button" class="fp-link" data-fp="sort">${ic("sort")}<span>${esc(sortLabel(s.sort))}</span></button>
      <button type="button" class="fp-link dim" data-fp="how" aria-label="Cách xếp hạng & đánh giá">${ic("help")}</button></div>
    <div id="fp-album" class="fp-album"></div>
    <footer class="fp-foot">
      <p>Xếp hạng không có suất trả tiền. Giá do PT tự niêm yết, bạn thanh toán trực tiếp cho PT — TapEasy không cộng thêm phí.</p>
      <button type="button" class="fp-link" data-fp="how">${ic("shield")}Cách xếp hạng, đánh giá & kiểm duyệt</button>
      ${(C.list || []).some(l=> l.seed) ? `<button type="button" class="fp-link dim" data-fp="credits">${ic("photo_library")}Nguồn ảnh minh hoạ (${fpAi() ? "tạo bằng AI" : "Pexels"})</button>` : ""}
    </footer>
    <nav class="fp-dock" aria-label="Công cụ album">
      <button type="button" data-fp="filters">${ic("tune")}<span>Bộ lọc${nF ? ` (${nF})` : ""}</span></button>
      <button type="button" data-fp="sort">${ic("sort")}<span>${esc(sortLabel(s.sort))}</span></button>
      <button type="button" data-fp="saved" class="${s.onlySaved ? "on" : ""}" aria-pressed="${!!s.onlySaved}">${ic("favorite")}<span>Đã lưu${s.saved.length ? ` (${s.saved.length})` : ""}</span></button>
    </nav>`;
  const inp = q("#fp-q", root); let t = null;
  inp.addEventListener("input", ()=>{ clearTimeout(t); t = setTimeout(()=>{ st().f.q = inp.value; save(); q("[data-fp='clearq']", root).hidden = !inp.value; renderAlbum(); }, 160); });
  inp.addEventListener("keydown", e=>{ if(e.key === "Enter"){ inp.blur(); } });
  renderAlbum();
  paintBadges();
  try{ if(G.FKBlock && !G.FKBlock.loaded && cloud.isLoggedIn()) blkReady().then(l=>{ if(l && l.length && isActive("screen-findpt")) renderAlbum(); }); }catch(e){}
  if(!reduced()){ root.classList.remove("fp-enter"); void root.offsetWidth; root.classList.add("fp-enter"); }
}
function renderAlbum(){
  const box = q("#fp-album"); if(!box) return;
  stopReveal();
  if(!C.list){ box.innerHTML = skeleton(); load().then(()=>{ if(isActive("screen-findpt")) render(); }); return; }
  const list = visibleList(), s = st();
  const cnt = q("#fp-count"); if(cnt) cnt.innerHTML = `<b>${list.length}</b> PT${s.onlySaved ? " đã lưu" : ""}${L.countFilters(s.f) || s.f.q ? " khớp bộ lọc" : ""}`;
  if(!list.length){ box.innerHTML = emptyHTML(); return; }
  box.innerHTML = albumHTML(list);
  startReveal(box);
}
function skeleton(){ return `<div class="fp-row fp-r-hero"><div class="fp-card fp-k-hero fp-skel"></div></div><div class="fp-row fp-r-pairA"><div class="fp-card fp-k-tall fp-skel"></div><div class="fp-card fp-k-short fp-skel"></div></div>`; }
function emptyHTML(){
  const s = st();
  return `<div class="fp-empty">${ic("travel_explore")}<h3>${s.onlySaved ? "Chưa lưu PT nào" : "Chưa có PT khớp bộ lọc"}</h3>
    <p>${s.onlySaved ? "Chạm biểu tượng trái tim trên thẻ PT để lưu lại so sánh sau." : "Thử bỏ bớt điều kiện — ví dụ nới khoảng giá hoặc chọn \"Toàn quốc\". Nhiều PT nhận dạy online."}</p>
    <div class="fp-empty-act">${s.onlySaved ? `<button type="button" class="btn btn-outline btn-sm" data-fp="saved">Xem tất cả PT</button>` : `<button type="button" class="btn btn-outline btn-sm" data-fp="reset">Xoá bộ lọc</button><button type="button" class="btn btn-soft btn-sm" data-fp-quick="online">Chỉ PT online</button>`}</div></div>`;
}
/* Nhịp album kiểu tạp chí: 1 ảnh lớn → cặp lệch (cao | thấp) → ảnh ngang → cặp đảo (thấp | cao) … */
const PAT = ["hero","pairA","wide","pairB"];
function albumHTML(list){
  const out = []; let i = 0, k = 0;
  const notes = list.length >= 6 && !st().onlySaved;
  while(i < list.length){
    const t = PAT[k % PAT.length];
    if(t === "hero" || t === "wide" || list.length - i === 1){ out.push(`<div class="fp-row fp-r-${t === "hero" ? "hero" : "wide"}">${cardHTML(list[i], t === "hero" ? "hero" : "wide", 0, i)}</div>`); i++; }
    else { const a = list[i], b = list[i+1]; out.push(`<div class="fp-row fp-r-${t}">${cardHTML(a, t === "pairA" ? "tall" : "short", 0, i)}${cardHTML(b, t === "pairA" ? "short" : "tall", 1, i+1)}</div>`); i += 2; }
    if(notes && k === 1) out.push(notePriceHTML(list));
    if(notes && k === 5) out.push(noteTrustHTML(list));
    k++;
  }
  return out.join("");
}
const shortProv = id=> String(L.provName(id) || "").replace("TP. Hồ Chí Minh", "TP.HCM");
const wardShort = l=> String((l && l.ward) || "").replace(/^(Phường|Xã|Đặc khu)\s+/, "");
function placeLine(p){ const lab = (D.PLACE_TYPES[p.type] || {}).label || "", nm = String(p.name || "").trim(); if(!nm) return lab; return L.norm(nm).startsWith(L.norm(lab)) ? nm : `${lab} · ${nm}`; }
function placeIcons(l){ const seen = new Set(); return (l.places || []).filter(p=> !seen.has(p.type) && seen.add(p.type)).map(p=> `<i title="${esc((D.PLACE_TYPES[p.type]||{}).label||"")}">${ic((D.PLACE_TYPES[p.type]||{}).icon || "place")}</i>`).join(""); }
/* QP-09 (fix-pt): "từ X" theo HÌNH THỨC đang lọc (tại phòng tập / tại nhà / ngoài trời → giá trực tiếp; online → giá online) */
function cardPrice(l){
  const f = st().f || {};
  try{ if(L.priceInfo){ const r = L.priceInfo(l, f.place || "", !!f.noPack); if(r && r.v) return r; } }catch(e){}
  return { v: l.priceFrom || L.priceFrom(l), mode:"" };
}
function cardHTML(l, kind, j, idx){
  const g = gradOf(l.id), saved = st().saved.includes(l.id), rated = Number(l.ratingCount) > 0;
  const img = (kind === "hero" || kind === "wide") ? (l.cover || l.coverThumb) : (l.coverThumb || l.cover);
  const name = String(l.name || "PT");
  const pi = cardPrice(l);
  const label = `${name}, ${L.areaText(l)}, ${pi.mode === "online" ? "online " : pi.mode === "inperson" ? "tại chỗ " : ""}từ ${mk(pi.v)} mỗi buổi${rated ? `, ${n1(l.ratingAvg)} sao từ ${Math.round(Number(l.ratingCount)||0)} đánh giá` : ", chưa có đánh giá"}${l.verified && !l.seed ? ", đã xác minh" : ""}`;
  // QU-23 (fix-pt): 4 thẻ đầu hiện ngay (không chờ IntersectionObserver / hiệu ứng "in") — không còn "20 PT" trên vùng trống
  return `<article class="fp-card fp-k-${kind}${C.seen.has(l.id) || idx < 4 ? " in fp-noanim" : ""}" data-fp-open="${esc(l.id)}" tabindex="0" role="link" aria-label="${esc(label)}" style="--g1:${g[0]};--g2:${g[1]};--d:${j * 110}ms">
    <div class="fp-ph"><span class="fp-ini" aria-hidden="true">${esc(L.initials(name))}</span>${img ? `<img class="fp-img" src="${url(img)}" alt="" loading="${idx < 3 ? "eager" : "lazy"}" decoding="async">` : ""}</div>
    <div class="fp-scrim"></div>
    <div class="fp-top">
      <span class="fp-pill">${rated ? `${STAR}<b>${n1(l.ratingAvg)}</b><span class="fp-pl">· ${Math.round(Number(l.ratingCount)||0)} đánh giá</span><span class="fp-ps">(${Math.round(Number(l.ratingCount)||0)})</span>` : `<b>PT mới</b><span class="fp-pl">· chưa có đánh giá</span>`}</span>
      <button type="button" class="fp-save${saved ? " on" : ""}" data-fp-save="${esc(l.id)}" aria-pressed="${saved}" aria-label="${saved ? "Bỏ lưu" : "Lưu"} ${esc(name)}">${ic("favorite")}</button>
    </div>
    <div class="fp-bot">
      <div class="fp-meta">
        <span class="fp-nm">${esc(name)}${l.verified && !l.seed ? `<i class="fp-vchk" title="Đã xác minh chứng chỉ">${ic("fp_verified")}</i>` : ""}</span>
        <span class="fp-loc">${ic("location_on")}<span>${esc(wardShort(l) || shortProv(l.prov))}</span>${wardShort(l) ? `<span class="fp-pv">&nbsp;· ${esc(shortProv(l.prov))}</span>` : ""}</span>
        <span class="fp-pr">${pi.mode === "online" ? "online " : ""}từ <b>${esc(mk(pi.v))}</b>/buổi<span class="fp-pi">${placeIcons(l)}</span></span>
      </div>
      <div class="fp-giant" aria-hidden="true">${esc(firstName(name))}</div>
    </div>
    ${l.hidden ? `<span class="fp-flag">Đang ẩn khỏi Tìm PT</span>` : l.status === "draft" ? `<span class="fp-flag">Bản nháp</span>` : ""}
  </article>`;
}
function notePriceHTML(list){
  const ps = L.provinceStats(list).slice(0, 4); if(!ps.length) return "";
  const mx = Math.max(...ps.map(p=> p.avg));
  return `<aside class="fp-note fp-note-price fp-card fp-k-note" aria-label="Bảng giá trung bình theo tỉnh/thành">
    <div class="fp-note-k">${ic("sell")}Bảng giá công khai</div>
    <h3>Giá từ / buổi,<br><em>trung bình</em> theo nơi tập</h3>
    <ul>${ps.map(p=> `<li><button type="button" data-fp-prov="${esc(p.prov)}"><span>${esc(shortProv(p.prov))}</span><i style="--w:${Math.round(p.avg / mx * 100)}%"></i><b>${mk(p.avg)}</b><small>${p.n} PT</small></button></li>`).join("")}</ul>
    <small>Tính trên giá thấp nhất mỗi PT tự niêm yết · chạm để lọc theo tỉnh/thành.</small></aside>`;
}
function noteTrustHTML(list){
  const nv = list.filter(l=> l.verified).length, nr = list.reduce((a,l)=> a + (Number(l.ratingCount)||0), 0);
  return `<aside class="fp-note fp-note-trust fp-card fp-k-note">
    <div class="fp-note-k">${ic("shield")}Minh bạch</div>
    <div class="fp-note-nums"><div><b>${nv}</b><span>PT đã đối chiếu chứng chỉ</span></div><div><b>${nr}</b><span>đánh giá từ người đã tập cùng</span></div></div>
    <p>PT không xoá được đánh giá. Đánh giá chỉ bị ẩn khi vi phạm — kèm lý do công khai.</p>
    <button type="button" class="fp-link" data-fp="how">${ic("help")}Cách xếp hạng & kiểm duyệt</button></aside>`;
}
function onAlbumClick(e){
  const t = e.target; if(!t || !t.closest) return;
  const sv = t.closest("[data-fp-save]"); if(sv){ e.stopPropagation(); toggleSave(sv.dataset.fpSave, sv); return; }
  const pv = t.closest("[data-fp-prov]"); if(pv){ const f = st().f; f.prov = pv.dataset.fpProv; f.ward = ""; save(); render(); scrollTopAlbum(); return; }
  const qk = t.closest("[data-fp-quick]"); if(qk){ const it = QUICK.find(x=> x[0] === qk.dataset.fpQuick); if(it){ it[3](st().f); save(); render(); } return; }
  const a = t.closest("[data-fp]");
  if(a){
    const k = a.dataset.fp;
    if(k === "back") return goBack();
    if(k === "filters") return openFilters();
    if(k === "sort") return openSort();
    if(k === "region") return openRegion();
    if(k === "how") return openHow();
    if(k === "credits") return openPhotoCredits();
    if(k === "myreqs") return openMyRequests();
    if(k === "editor") return openEditor();
    if(k === "saved"){ const s = st(); s.onlySaved = !s.onlySaved; save(); render(); return; }
    if(k === "reset"){ st().f = clone(D.DEFAULT_FILTER); save(); render(); return; }
    if(k === "clearq"){ st().f.q = ""; save(); render(); const i = q("#fp-q"); if(i) i.focus(); return; }
    return;
  }
  const card = t.closest("[data-fp-open]"); if(card) openListing(card.dataset.fpOpen, { from:"findpt" });
}
function scrollTopAlbum(){ const a = q("#fp-album"), sc = scroller(); if(a && sc) sc.scrollTo({ top: Math.max(0, a.offsetTop - 140), behavior: reduced() ? "auto" : "smooth" }); }
function toggleSave(id, btn){
  const s = st(), i = s.saved.indexOf(id);
  if(i >= 0) s.saved.splice(i, 1); else s.saved.unshift(id);
  s.saved = s.saved.slice(0, 60); save();
  const on = i < 0;
  qa(`[data-fp-save="${(typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(id) : id}"]`).forEach(b=>{ b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  if(btn && !reduced()){ btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop"); }
  const dk = q(".fp-dock [data-fp='saved'] span"); if(dk) dk.textContent = `Đã lưu${s.saved.length ? ` (${s.saved.length})` : ""}`;
  say(on ? "Đã lưu PT vào danh sách so sánh" : "Đã bỏ lưu", "favorite");
}

/* Hiện dần khi cuộn (IntersectionObserver) + parallax nhẹ (rAF, chỉ transform) */
function startReveal(box){
  const cards = qa(".fp-card:not(.in)", box);
  if(reduced() || typeof IntersectionObserver !== "function"){ cards.forEach(c=> c.classList.add("in", "fp-noanim")); qa(".fp-card", box).forEach(c=> c.dataset.fpOpen && C.seen.add(c.dataset.fpOpen)); return; }
  C.io = new IntersectionObserver(ents=> ents.forEach(en=>{
    if(!en.isIntersecting) return;
    const el = en.target; el.classList.add("in"); if(el.dataset.fpOpen) C.seen.add(el.dataset.fpOpen);
    C.io.unobserve(el);
  }), { root: scroller(), rootMargin:"0px 0px -6% 0px", threshold:0.08 });
  cards.forEach(c=> C.io.observe(c));
  setTimeout(()=> qa(".fp-card:not(.in)", box).forEach(c=>{ const r = c.getBoundingClientRect(); if(r.top < (G.innerHeight || 800)) c.classList.add("in"); }), 1800);   // an toàn
  parallax();
}
function stopReveal(){ try{ if(C.io) C.io.disconnect(); }catch(e){} C.io = null; }
/* QU-05 / QP-23 (fix-pt): BỎ parallax theo cuộn (đọc getBoundingClientRect + ghi style mỗi khung → 19–26 fps ở CPU 4×).
   Ảnh thẻ đứng yên; chỉ còn hiệu ứng "in" 1 lần qua IntersectionObserver. Giữ hàm (no-op) cho tương thích nơi gọi. */
const PARALLAX = false;
function parallax(){
  if(!PARALLAX || reduced() || C.raf) return;
  C.raf = requestAnimationFrame(()=>{
    C.raf = 0;
    if(!isActive("screen-findpt")) return;
    const vh = (scroller() || {}).clientHeight || 800;
    qa("#fp-album .fp-card.in .fp-img").forEach(img=>{
      const r = img.parentNode.getBoundingClientRect(); if(r.bottom < -40 || r.top > vh + 40) return;
      const c = (r.top + r.height / 2) / vh - 0.5;
      img.style.setProperty("--py", (Math.max(-1, Math.min(1, c)) * -14).toFixed(1) + "px");
    });
  });
}
document.addEventListener("error", e=>{ const t = e.target; if(t && t.tagName === "IMG" && t.closest && t.closest(".fp-ph, .fp-al, .fp-rv-ph, .fp-lb-s, .fp-ed-ph")){ const ph = t.closest(".fp-ph, .fp-al, .fp-rv-ph a, .fp-lb-s, .fp-ed-ph"); if(ph) ph.classList.add("fp-broken"); t.remove(); } }, true);

/* ---------------------------------------------------------------------
   3. BỘ LỌC · SẮP XẾP · KHU VỰC · CÁCH XẾP HẠNG
   --------------------------------------------------------------------- */
const PMAX = 1500000, PSTEP = 50000;
function provOptions(sel){
  return Object.keys(D.REGIONS).map(r=> `<optgroup label="${esc(D.REGIONS[r])}">${D.PROVINCES.filter(p=> p.region === r).map(p=> `<option value="${p.id}" ${sel === p.id ? "selected" : ""}>${esc(p.name)}${p.merged ? ` (${esc(p.merged)})` : ""}</option>`).join("")}</optgroup>`).join("");
}
function wardsOf(prov){
  const set = new Set(((D.PROV[prov] || {}).wards || []));
  (C.list || []).forEach(l=>{ if(l.prov === prov && l.ward) set.add(l.ward); });
  return [...set].sort((a,b)=> a.localeCompare(b, "vi"));
}
function openFilters(){
  const F = clone(st().f);
  const list = C.list || [];
  const specs = (()=>{ const m = {}; list.forEach(l=> (l.specs||[]).forEach(s=> m[s] = (m[s]||0) + 1)); return Object.keys(m).sort((a,b)=> m[b] - m[a]); })();
  const langs = [...new Set(list.flatMap(l=> l.langs || []))];
  const gyms = [...new Set(list.flatMap(l=> (l.places||[]).filter(p=> p.type === "gym").map(p=> p.name)))].sort();
  const hist = L.histogram(list, 100000, PMAX);
  const hmax = Math.max(1, ...hist);
  const paint = ()=>{
    const sh = q("#sheet-content"); if(!sh) return;
    sh.innerHTML = `<div class="sheet-handle"></div>
    <div class="sheet-header"><h3>Bộ lọc</h3><button class="icon-btn" data-ff="close" aria-label="Đóng">${ic("close")}</button></div>
    <div class="fp-fs">
      <section><h4>${ic("location_on")}Khu vực</h4>
        <div class="fp-two"><label class="field"><span class="fp-lbl">Tỉnh / thành (34 đơn vị mới)</span><select id="ff-prov"><option value="">Toàn quốc</option>${provOptions(F.prov)}</select></label>
        <label class="field"><span class="fp-lbl">Phường / xã</span><select id="ff-ward" ${F.prov ? "" : "disabled"}><option value="">${F.prov ? "Toàn tỉnh/thành" : "Chọn tỉnh trước"}</option>${F.prov ? wardsOf(F.prov).map(w=> `<option ${F.ward === w ? "selected" : ""}>${esc(w)}</option>`).join("") : ""}</select></label></div>
        <p class="fp-hint">Theo địa giới mới từ 01/7/2025 (bỏ cấp quận/huyện). Danh sách phường/xã gồm nơi đang có PT và các phường tiêu biểu.</p></section>
      <section><h4>${ic("fitness_center")}Địa điểm tập</h4>
        <div class="fp-seg" role="radiogroup">${[["","Tất cả"],["gym","Phòng tập"],["home","Tại nhà"],["online","Online"],["outdoor","Ngoài trời"]].map(([k,l])=> `<button type="button" role="radio" aria-checked="${F.place === k}" class="${F.place === k ? "on" : ""}" data-ff-place="${k}">${l}</button>`).join("")}</div>
        <label class="field"><span class="fp-lbl">Tên phòng tập / studio</span><input id="ff-gym" list="ff-gyms" value="${esc(F.gym)}" placeholder="VD: Iron Lab, Lumi Pilates…" autocomplete="off"><datalist id="ff-gyms">${gyms.map(g=> `<option value="${esc(g)}">`).join("")}</datalist></label></section>
      <section><h4>${ic("payments")}Giá mỗi buổi <b id="ff-plabel" class="fp-plabel"></b></h4>
        <div class="fp-hist" aria-hidden="true">${hist.map((n, i)=> `<i data-b="${i}" style="--h:${Math.round(n / hmax * 100)}%"></i>`).join("")}</div>
        <div class="fp-range"><div class="fp-range-fill" id="ff-fill"></div>
          <input type="range" id="ff-pmin" min="0" max="${PMAX}" step="${PSTEP}" value="${F.priceMin || 0}" aria-label="Giá thấp nhất">
          <input type="range" id="ff-pmax" min="0" max="${PMAX}" step="${PSTEP}" value="${F.priceMax || PMAX}" aria-label="Giá cao nhất"></div>
        <div class="fp-range-ends"><span>0đ</span><span>1,5tr+</span></div>
        <p class="fp-hint">So với giá mỗi buổi của buổi lẻ, gói 12/24 buổi (chia đều) và online. Biểu đồ: số PT theo mức giá thấp nhất.</p></section>
      <section><h4>${ic("person")}Giới tính PT</h4>
        <div class="fp-seg">${[["","Tất cả"],["female","Nữ"],["male","Nam"]].map(([k,l])=> `<button type="button" class="${F.gender === k ? "on" : ""}" data-ff-gender="${k}" aria-pressed="${F.gender === k}">${l}</button>`).join("")}</div></section>
      <section><h4>${ic("bolt")}Chuyên môn <small>(chọn nhiều)</small></h4>
        <div class="fp-chipwrap">${specs.map(s=> `<button type="button" class="fp-chip sm ${F.specs.includes(s) ? "on" : ""}" data-ff-spec="${esc(s)}" aria-pressed="${F.specs.includes(s)}">${esc(s)}</button>`).join("")}</div></section>
      <section><h4>${ic("star")}Đánh giá tối thiểu</h4>
        <div class="fp-seg">${[[0,"Bất kỳ"],[4,"4,0+"],[4.5,"4,5+"],[4.8,"4,8+"]].map(([k,l])=> `<button type="button" class="${F.minRating === k ? "on" : ""}" data-ff-rating="${k}" aria-pressed="${F.minRating === k}">${l}</button>`).join("")}</div></section>
      <section class="fp-row2"><div><h4>${ic("fp_verified")}Chỉ PT đã xác minh</h4><p class="fp-hint">Chứng chỉ đã được TapEasy đối chiếu với đơn vị cấp.</p></div>
        <button type="button" class="toggle ${F.verified ? "on" : ""}" data-ff="verified" role="switch" aria-checked="${!!F.verified}" aria-label="Chỉ PT đã xác minh"></button></section>
      ${langs.length > 1 ? `<section><h4>${ic("language")}Ngôn ngữ</h4><div class="fp-chipwrap">${langs.map(k=> `<button type="button" class="fp-chip sm ${F.langs.includes(k) ? "on" : ""}" data-ff-lang="${k}" aria-pressed="${F.langs.includes(k)}">${esc(D.LANGS[k] || k)}</button>`).join("")}</div></section>` : ""}
    </div>
    <div class="fp-sheetbar"><button type="button" class="btn btn-ghost" data-ff="reset">Xoá lọc</button><button type="button" class="btn btn-primary" data-ff="apply" id="ff-apply"></button></div>`;
    bind();
  };
  const live = ()=>{
    const n = L.filterListings(list, F).length;
    const b = q("#ff-apply"); if(b) b.textContent = n ? `Xem ${n} PT` : "Không có PT khớp";
    const lo = F.priceMin || 0, hi = F.priceMax || PMAX;
    const pl = q("#ff-plabel"); if(pl) pl.textContent = (lo || hi < PMAX) ? `${mk(lo)} – ${hi >= PMAX ? "1,5tr+" : mk(hi)}` : "Mọi mức giá";
    const fill = q("#ff-fill"); if(fill){ fill.style.left = (lo / PMAX * 100) + "%"; fill.style.right = (100 - hi / PMAX * 100) + "%"; }
    qa(".fp-hist i").forEach(i=>{ const b0 = Number(i.dataset.b) * 100000; i.classList.toggle("in", b0 + 100000 > lo && b0 <= hi); });
  };
  const bind = ()=>{
    const sh = q("#sheet-content");
    sh.onclick = e=>{
      const t = e.target.closest ? e.target.closest("button") : null; if(!t) return;
      if(t.dataset.ff === "close") return closeSheet();
      if(t.dataset.ff === "reset"){ Object.assign(F, clone(D.DEFAULT_FILTER), { q: F.q }); paint(); return; }
      if(t.dataset.ff === "apply"){ readText(); st().f = F; save(); closeSheet(); render(); scrollTopAlbum(); return; }
      if(t.dataset.ff === "verified"){ F.verified = !F.verified; t.classList.toggle("on", F.verified); t.setAttribute("aria-checked", String(F.verified)); live(); return; }
      if(t.dataset.ffPlace != null){ F.place = t.dataset.ffPlace; segOn(t, "ffPlace"); live(); return; }
      if(t.dataset.ffGender != null){ F.gender = t.dataset.ffGender; segOn(t, "ffGender"); live(); return; }
      if(t.dataset.ffRating != null){ F.minRating = Number(t.dataset.ffRating); segOn(t, "ffRating"); live(); return; }
      if(t.dataset.ffSpec != null){ const s = t.dataset.ffSpec, i = F.specs.indexOf(s); if(i >= 0) F.specs.splice(i, 1); else F.specs.push(s); t.classList.toggle("on", i < 0); t.setAttribute("aria-pressed", String(i < 0)); live(); return; }
      if(t.dataset.ffLang != null){ const s = t.dataset.ffLang, i = F.langs.indexOf(s); if(i >= 0) F.langs.splice(i, 1); else F.langs.push(s); t.classList.toggle("on", i < 0); live(); return; }
    };
    q("#ff-prov").onchange = e=>{ readText(); F.prov = e.target.value; F.ward = ""; paint(); };
    q("#ff-ward").onchange = e=>{ F.ward = e.target.value; live(); };
    q("#ff-gym").oninput = e=>{ F.gym = e.target.value; live(); };
    const a = q("#ff-pmin"), b = q("#ff-pmax");
    const rng = src=>{ let lo = Number(a.value), hi = Number(b.value); if(lo > hi - PSTEP){ if(src === a){ lo = Math.max(0, hi - PSTEP); a.value = lo; } else { hi = Math.min(PMAX, lo + PSTEP); b.value = hi; } } F.priceMin = lo; F.priceMax = hi >= PMAX ? 0 : hi; live(); };
    a.oninput = ()=> rng(a); b.oninput = ()=> rng(b);
    live();
  };
  const segOn = (t, k)=> qa(`[data-${k.replace(/[A-Z]/g, m=> "-" + m.toLowerCase())}]`, t.parentNode).forEach(x=>{ x.classList.toggle("on", x === t); x.setAttribute(x.getAttribute("role") === "radio" ? "aria-checked" : "aria-pressed", String(x === t)); });
  const readText = ()=>{ const g = q("#ff-gym"); if(g) F.gym = g.value.trim(); };
  openSheet(""); paint();
}
function openSort(){
  const s = st();
  openSheet(`<div class="sheet-header"><h3>Sắp xếp</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <div class="fp-sortlist" role="radiogroup">${SORTS.map(([k, l, d])=> `<button type="button" role="radio" aria-checked="${s.sort === k}" class="fp-sortopt ${s.sort === k ? "on" : ""}" data-fp-sort="${k}"><span class="fp-radio"></span><span><b>${l}</b>${d ? `<small>${d}</small>` : ""}</span></button>`).join("")}</div>
    <button type="button" class="fp-link" data-fp-how style="margin-top:10px;">${ic("help")}Điểm "Phù hợp" được tính thế nào?</button>`);
  qa("[data-fp-sort]").forEach(b=> b.addEventListener("click", ()=>{ st().sort = b.dataset.fpSort; save(); closeSheet(); render(); scrollTopAlbum(); }));
  const h = q("[data-fp-how]"); if(h) h.addEventListener("click", openHow);
}
function openRegion(){
  const f = st().f, list = C.list || [];
  const cnt = {}; list.forEach(l=> cnt[l.prov] = (cnt[l.prov]||0) + 1);
  openSheet(`<div class="sheet-header"><h3>Khu vực</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="fp-hint" style="margin-top:-8px;">34 tỉnh/thành theo địa giới mới. Số bên phải = PT đang niêm yết.</p>
    <div class="fp-region-list">
      <button type="button" class="fp-regopt ${!f.prov ? "on" : ""}" data-fp-reg=""><span>Toàn quốc</span><b>${list.length}</b></button>
      ${Object.keys(D.REGIONS).map(r=> `<div class="fp-reg-h">${esc(D.REGIONS[r])}</div>${D.PROVINCES.filter(p=> p.region === r).sort((a,b)=> (cnt[b.id]||0) - (cnt[a.id]||0)).map(p=> `<button type="button" class="fp-regopt ${f.prov === p.id ? "on" : ""} ${cnt[p.id] ? "" : "dim"}" data-fp-reg="${p.id}"><span>${esc(p.name)}${p.merged ? `<small>${esc(p.merged)}</small>` : ""}</span><b>${cnt[p.id] || 0}</b></button>`).join("")}`).join("")}
    </div>`);
  qa("[data-fp-reg]").forEach(b=> b.addEventListener("click", ()=>{ const s = st(); s.f.prov = b.dataset.fpReg; s.f.ward = ""; if(s.f.prov) s.prov = s.f.prov; save(); closeSheet(); render(); }));
}
function openHow(){
  const ex = (C.list || []).find(l=> l.ratingCount) || null;
  const ms = ex ? L.matchScore(ex, userCtx()) : null;
  openSheet(`<div class="sheet-header"><h3>Cách xếp hạng & đánh giá</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
  <div class="fp-policy">
    <h4>${ic("sort")}Xếp hạng "Phù hợp" — không có suất trả tiền</h4>
    <p>TapEasy <b>không nhận tiền để đẩy hạng</b>. Điểm phù hợp cộng từ các phần công khai dưới đây:</p>
    <ul><li>Đánh giá: trung bình có điều chỉnh (mức nền 4,3★ tương đương ${L.PRIOR_M} phiếu) → 3★ = 0 điểm, 5★ = 50 điểm. PT ít đánh giá không bị đẩy lên quá cao chỉ nhờ 1–2 phiếu 5★.</li>
      <li>Đã xác minh chứng chỉ: +8 · Trả lời ≥ 90% yêu cầu trong 24 giờ: +6 (≥ 70%: +3)</li>
      <li>Chuyên môn hợp mục tiêu trong hồ sơ của bạn: +10 · Cùng tỉnh/thành bạn chọn: +12 · Album ≥ 5 ảnh: +2</li></ul>
    ${ms ? `<p class="fp-hint">Ví dụ ${esc(ex.name)}: ${ms.parts.map(p=> `${esc(p[0])} ${p[1] >= 0 ? "+" : ""}${p[1]}`).join(" · ")} = <b>${ms.score}</b></p>` : ""}
    <h4>${ic("star")}Điểm sao</h4>
    <p>Là trung bình cộng các đánh giá <b>đang hiển thị</b>, 1 chữ số thập phân. Mỗi người chỉ có 1 đánh giá cho 1 PT (sửa được, có ghi "đã sửa").</p>
    <h4>${ic("fp_verified")}Ai được đánh giá?</h4>
    <p>Chỉ người <b>đã tập cùng</b>: kết nối với PT qua TapEasy và có ít nhất 1 buổi được đánh dấu hoàn thành, hoặc buổi thử được PT xác nhận. Nhãn "Đã tập cùng · N buổi" ghi rõ căn cứ.</p>
    <h4>${ic("reply")}PT trả lời, không xoá được</h4>
    <p>PT được trả lời công khai dưới mỗi đánh giá. PT <b>không thể xoá</b> hay sửa đánh giá của học viên.</p>
    <h4>${ic("flag")}Báo cáo & kiểm duyệt</h4>
    <p>Ai cũng báo cáo được đánh giá sai sự thật. Kiểm duyệt viên chỉ <b>ẩn</b> khi vi phạm (xúc phạm, lộ thông tin cá nhân, không phải trải nghiệm thật, spam) và lý do được hiển thị công khai tại chỗ đánh giá đó. <b>Không ẩn đánh giá chỉ vì chê.</b> Báo cáo không tự động ẩn để tránh bị lợi dụng.</p>
    <h4>${ic("schedule")}Tỉ lệ & thời gian phản hồi</h4>
    <p>= số yêu cầu (buổi thử, kết nối, câu hỏi) PT trả lời trong 24 giờ ÷ tổng yêu cầu 90 ngày gần nhất. Dưới 3 yêu cầu thì hiện "Chưa đủ dữ liệu".</p>
    <h4>${ic("payments")}Giá</h4>
    <p>PT tự niêm yết, ngày cập nhật giá hiện trong hồ sơ. Bạn thanh toán trực tiếp cho PT; TapEasy không cộng thêm phí.</p>
    ${P.showsSamples() ? `<h4>${ic("info")}Hồ sơ minh hoạ</h4><p>Bản thử nghiệm có 20 hồ sơ PT minh hoạ: ${fpAi() ? "ảnh minh hoạ tạo bằng AI (nhân vật không có thật)" : "ảnh từ Pexels (tác giả ghi dưới ảnh)"}, tên, giá và đánh giá là giả lập để bạn thử tính năng.</p>` : ""}
  </div>`);
}
function openPhotoCredits(){
  const list = (C.list || []).filter(l=> l.seed);
  const all = [];
  list.forEach(l=>{ if(l.coverCredit && l.coverCredit.by) all.push(l.coverCredit.by); (l.album || []).forEach(a=> a.by && all.push(a.by)); });
  const by = {}; all.forEach(n=> by[n] = (by[n]||0) + 1);
  openSheet(`<div class="sheet-header"><h3>Nguồn ảnh minh hoạ</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    ${fpAi() ? `<p class="small-note"><b>Ảnh minh hoạ tạo bằng AI</b>: ảnh hồ sơ PT minh hoạ do AI tạo (TapEasy) — nhân vật trong ảnh không có thật, không phải PT có tên trong hồ sơ, không dùng hình người nổi tiếng. Ảnh nào chưa có bản AI vẫn hiện ảnh Pexels gốc (tác giả bên dưới).</p>` : ""}
    <p class="small-note">Ảnh hồ sơ PT minh hoạ lấy từ <b>Pexels</b> (pexels.com) theo Pexels License — dùng miễn phí, kể cả thương mại. Người trong ảnh là người mẫu ảnh, <b>không phải</b> PT có tên trong hồ sơ minh hoạ. Không dùng ảnh người nổi tiếng.</p>
    <div class="fp-credit-list">${Object.keys(by).sort((a,b)=> by[b] - by[a]).map(n=> `<span>${esc(n)} <i>${by[n]}</i></span>`).join("")}</div>
    <p class="small-note" style="margin-top:10px;">Chạm vào ảnh trong album của từng PT để xem tên tác giả và liên kết gốc.</p>`);
}

/* ---------------------------------------------------------------------
   4. HỒ SƠ PT: dựng trang F1 hero (ptprofile.js) + phần mở rộng
   --------------------------------------------------------------------- */
function toProfile(l){
  return { uid: l.uid || l.id, name: l.name, brandName: l.brandName || l.name, area: L.areaText(l), specialty: (l.specs || []).join(", "),
    years: l.years || 0, stats: Object.assign({}, l.stats || {}, l.seed ? { seed:true } : {}, l.statsVerified ? { verified:true } : {}), bio: l.bio || "", photo: l.cover || "", phone: l.showPhone ? (l.phone || "") : "" };
}
async function openListing(id, opts){
  opts = opts || {};
  const cur = (q(".screen.active") || {}).id || "";
  let from = opts.from || cur.replace("screen-", "") || "findpt";
  if(from === "ptprofile") from = (C.ctx && C.ctx.from) || "findpt";
  if(cur === "screen-findpt"){ const sc = scroller(); C.scrollY = sc ? sc.scrollTop : 0; }
  C.ctx = { id, from };
  let l = C.byId[id] || null;
  if(typeof goto === "function") goto("ptprofile");
  const pc = q("#pp-content"); if(!pc) return;
  if(!l) pc.innerHTML = `<div class="pp-loading"><div class="spinner"></div></div>`;
  try{ const fresh = await P.get(id); if(fresh) l = fresh; }catch(e){ warn("get", e); }
  if(!l){ pc.innerHTML = `<div class="pp-loading"><p class="small-note">Không tìm thấy hồ sơ PT này (có thể PT đã gỡ niêm yết).</p><button class="btn btn-outline" data-fp-back2>Quay lại</button></div>`; const b = q("[data-fp-back2]"); if(b) b.addEventListener("click", goBackFromProfile); return; }
  if(!l.id) l.id = id;
  C.byId[id] = l;
  const pr = toProfile(l);
  try{ ppCtx = { ptId: pr.uid, cid: null, profile: pr, back: goBackFromProfile, reopen: ()=> openListing(id, opts) }; }catch(e){}
  // App Store 1.2: hồ sơ của PT mình đã chặn → ẩn, chỉ hiện "Bạn đã chặn…" + Bỏ chặn
  try{ await blkReady(); if(pr.uid !== myUid() && isBlk(pr.uid) && typeof ppBlockedView === "function"){ pc.classList.remove("fp-has-dock"); ppBlockedView(pr.uid, l.brandName || l.name || "PT"); return; } }catch(e){ warn("block", e); }
  pc.classList.remove("fp-has-dock");
  try{ renderPTProfile(pr); }catch(e){ warn("renderPTProfile", e); pc.innerHTML = ""; }
  decorateProfile(l, { listing:true });
}
function goBackFromProfile(){
  const to = (C.ctx && C.ctx.from) || "findpt";
  C.ctx = null;
  if(to === "findpt") return FP.open({ restore:true });
  try{ goto(to); }catch(e){ goto("home"); }
}
function replaceBtn(sel, fn){ const b = q(sel); if(!b || !b.parentNode) return null; const nb = b.cloneNode(true); b.parentNode.replaceChild(nb, b); nb.addEventListener("click", fn); return nb; }
function fixLogo(){ const lg = q("#pp-content .pp-logo"); if(lg && /FIT/i.test(lg.textContent)) lg.innerHTML = `Tap<b>Easy</b>`; }
function shareListing(l){
  const link = (location.protocol.startsWith("http") ? location.origin + location.pathname : "https://thangvu030198-ai.github.io/fitkit-app/") + "?pt=" + encodeURIComponent(l.id);
  const text = `${l.name} — ${(l.specs || []).slice(0,2).join(", ")} · ${L.areaText(l)} · từ ${mk(l.priceFrom || L.priceFrom(l))}/buổi. Xem hồ sơ, bảng giá & đánh giá trên TapEasy: ${link}`;
  try{ if(typeof shareText === "function" && shareText.length === 2) return shareText(`${l.brandName || l.name} trên TapEasy`, text); }catch(e){}
  try{ if(navigator.share) return navigator.share({ title:"TapEasy — Tìm PT", text }).catch(()=>{}); }catch(e){}
  try{ navigator.clipboard.writeText(text); say("Đã sao chép liên kết hồ sơ", "content_copy"); }catch(e){}
}
function myConnection(l){
  try{ const list = (typeof ptData !== "undefined" && ptData && ptData.asStudent) || []; return list.find(c=> c.ptId === (l.uid || l.id)) || null; }catch(e){ return null; }
}
/** Gắn phần mở rộng vào trang hồ sơ đang mở. opts.listing: mở từ Tìm PT; opts.real: hồ sơ PT thật mở từ màn PT */
function decorateProfile(l, opts){
  opts = opts || {};
  const pc = q("#pp-content"); if(!pc) return;
  fixLogo();
  const sc = scroller(); if(sc) sc.classList.add("fp-prox");
  const isMe = !!(myUid() && l && (l.uid || l.id) === myUid());
  if(opts.listing){
    replaceBtn("#pp-back", goBackFromProfile);
    replaceBtn("#pp-share", ()=> shareListing(l));
    const hb = q("#pp-content .pp-hero-bottom");
    if(hb && !q(".fp-pp-badges", hb)) hb.insertAdjacentHTML("afterbegin", `<div class="fp-pp-badges anim up d7">${isVer(l) ? `<span class="ok">${ic("fp_verified")}Đã xác minh</span>` : l.seed ? "" : `<span>Chưa xác minh chứng chỉ</span>`}${Number(l.ratingCount) ? `<span>${STAR}${n1(l.ratingAvg)} · ${Math.round(Number(l.ratingCount)||0)} đánh giá</span>` : ""}${l.seed ? `<span class="demo">Hồ sơ minh hoạ — không đối chiếu</span>` : ""}</div>`);
    const cc = q("#pp-card-contact");
    if(cc && cc.parentNode && !(l.showPhone && l.phone)){
      const ncc = cc.cloneNode(true); cc.parentNode.replaceChild(ncc, cc);
      const sub = q(".pp-card-sub", ncc), big = q(".pp-card-big", ncc); if(sub) sub.textContent = "Nhắn qua TapEasy"; if(big) big.textContent = "Chat";
      ncc.addEventListener("click", ()=> actMessage(l));
    }
    const ppc = (typeof ppCtx !== "undefined" && ppCtx) || {};
    const nx = q("#pp-card-next");
    if(nx && nx.parentNode && !ppc.cid){
      const nn = nx.cloneNode(true); nx.parentNode.replaceChild(nn, nx);
      const hp = cardPrice(l);
      nn.innerHTML = `<div class="pp-label">Giá từ <span class="material-symbols-rounded">sell</span></div><div class="pp-card-sub">${hp.mode === "online" ? "online · " : hp.mode === "inperson" ? "tập trực tiếp · " : ""}mỗi buổi · bảng giá đầy đủ</div><div class="pp-card-big gold">${esc(mk(hp.v))}</div>`;
      nn.addEventListener("click", ()=>{ const t = q("#fp-sec-price"); if(t) t.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }); });
    }
  }
  const old = q("#fp-x", pc); if(old) old.remove();
  const od = q(".fp-ppdock", pc); if(od) od.remove();
  const dk = dockHTML(l, Object.assign({ isMe }, opts));
  pc.classList.toggle("fp-has-dock", !!dk);
  pc.insertAdjacentHTML("beforeend", extHTML(l, Object.assign({ isMe }, opts)) + dk);
  bindExt(l, Object.assign({ isMe }, opts));
  loadReviews(l.id);
  try{ if(typeof icons === "object" && icons.refresh) icons.refresh(); }catch(e){}
}
async function decorateReal(ptUid, cid){
  let l = null; try{ l = await P.get(ptUid); }catch(e){}
  if(!isActive("screen-ptprofile")) return;
  if(l && (l.status === "public" || l.uid === myUid()) && (!l.hidden || l.uid === myUid() || can("listings.moderate"))){ decorateProfile(l, { real:true, cid }); return; }
  // PT chưa niêm yết: vẫn có phần Đánh giá & phản hồi (đánh giá gắn với uid PT)
  const pc = q("#pp-content"); if(!pc) return;
  fixLogo();
  const sc = scroller(); if(sc) sc.classList.add("fp-prox");
  const old = q("#fp-x", pc); if(old) old.remove();
  const pr = (typeof ppCtx !== "undefined" && ppCtx && ppCtx.profile) || {};
  const stub = { id: ptUid, uid: ptUid, name: pr.name || "PT", stub:true };
  pc.insertAdjacentHTML("beforeend", `<div class="fp-x" id="fp-x"><section class="fp-xs" id="fp-sec-rv"><div id="fp-rv-box"></div></section>
    ${ptUid === myUid() ? `<section class="fp-xs"><div class="fp-card2"><b>${ic("storefront")}Bạn chưa niêm yết trên Tìm PT</b><p class="fp-hint">Niêm yết album, bảng giá, địa điểm để học viên mới tìm thấy bạn.</p><button type="button" class="btn btn-primary btn-block" data-fpx="editor">Niêm yết hồ sơ Tìm PT</button></div></section>` : ""}</div>`);
  C.byId[ptUid] = C.byId[ptUid] || stub;
  bindExt(stub, { real:true, cid, isMe: ptUid === myUid() });
  loadReviews(ptUid);
}
/* QP-21 (fix-pt): hồ sơ minh hoạ KHÔNG BAO GIỜ hiện "Đã xác minh / TapEasy đã đối chiếu" (người không có thật) */
const isVer = l=> !!(l && l.verified && !l.seed);
/* QP-08 (fix-pt): nguồn số liệu "Học viên · Buổi đã dạy" — chỉ ghi "TapEasy xác nhận" khi máy chủ ghi (statsVerified / stats.verified) */
function statsSrc(l){
  const s = (l && l.stats) || {};
  if(l && l.seed) return "số liệu minh hoạ";
  if(l && (l.statsVerified || s.verified)) return "TapEasy xác nhận từ buổi PT đã dạy";
  if(s.src === "app") return "đếm từ form có học viên thật · PT tự đồng bộ";
  return "PT tự khai — chưa đối chiếu";
}
function secHead(label, icon, title, extra){ return `<div class="fp-xh"><div class="pp-label">${esc(label)} <span class="material-symbols-rounded">${icon}</span></div><h2 class="fp-xt">${title}</h2>${extra || ""}</div>`; }
function extHTML(l, o){
  const ps = L.perSession(l), pr = l.prices || {};
  const pf = l.priceFrom || L.priceFrom(l);
  const album = [{ src: l.cover, by: (l.coverCredit || {}).by, link: (l.coverCredit || {}).link, thumb: l.coverThumb || l.cover }].concat(l.album || []).filter(a=> a && a.src);
  const trial = pr.trial === 0 ? "Miễn phí" : (pr.trial == null || pr.trial === "") ? "Không nhận" : money(pr.trial);
  const cancel = D.CANCEL[l.cancel] || D.CANCEL.moderate;
  const respR = l.respRate == null ? null : Number(l.respRate);
  const rows = [
    ["Buổi lẻ", ps.single ? money(pr.single) : "—", ""],
    ["Gói 12 buổi", pr.pack12 ? money(pr.pack12) : "Không có", pr.pack12 ? `≈ ${mk(ps.pack12)}/buổi${L.packSaving(l, "pack12") ? ` · tiết kiệm ${L.packSaving(l, "pack12")}%` : ""}` : ""],
    ["Gói 24 buổi", pr.pack24 ? money(pr.pack24) : "Không có", pr.pack24 ? `≈ ${mk(ps.pack24)}/buổi${L.packSaving(l, "pack24") ? ` · tiết kiệm ${L.packSaving(l, "pack24")}%` : ""}` : ""],
    ["Online / buổi", pr.online ? money(pr.online) : "Không nhận", ""],
    ["Buổi thử", trial, pr.trial === 0 ? "đánh giá thể trạng + tập thử" : ""],
  ];
  return `<div class="fp-x" id="fp-x">
    <section class="fp-xs fp-xs-facts">
      <div class="fp-factchips">
        ${isVer(l) ? `<span class="ok">${ic("fp_verified")}Đã xác minh${l.verifiedAt ? " · " + esc(mY(l.verifiedAt)) : ""}</span>` : `<span>${ic("info")}${l.seed ? "Hồ sơ minh hoạ — không đối chiếu" : "Chứng chỉ chưa đối chiếu"}</span>`}
        <span>${ic("history")}Tham gia ${l.joinedAt ? esc(mY(l.joinedAt)) : "—"}</span>
        <span>${ic("schedule")}${respR == null || !isFinite(respR) ? "Phản hồi: chưa đủ dữ liệu" : `Trả lời ${Math.round(respR)}% · ~${esc(L.fmtMins(l.respMins))}`}</span>
        <span>${ic("language")}${(l.langs || ["vi"]).map(k=> esc(D.LANGS[k] || k)).join(", ")}</span>
      </div>
    </section>

    <section class="fp-xs" id="fp-sec-album">
      ${secHead("Album", "photo_library", `${album.length} khoảnh khắc`)}
      <div class="fp-alrow" role="list">${album.map((a, i)=> `<button type="button" class="fp-al ${i === 0 ? "first" : ""}" role="listitem" data-fpx-photo="${i}" aria-label="Xem ảnh ${i+1}/${album.length}" style="--g1:${gradOf(l.id + i)[0]};--g2:${gradOf(l.id + i)[1]}"><img src="${url(a.thumb || a.src)}" alt="" loading="lazy" decoding="async">${a.by ? `<small>${esc(a.by)}</small>` : ""}</button>`).join("")}</div>
    </section>

    <section class="fp-xs" id="fp-sec-price">
      ${secHead("Bảng giá công khai", "sell", `Từ <em>${esc(mk(pf))}</em> / buổi`)}
      <div class="fp-ptable" role="table" aria-label="Bảng giá">
        ${rows.map(([k, v, s])=> `<div class="fp-prow" role="row"><span role="cell">${k}</span><b role="cell">${esc(v)}</b>${s ? `<small role="cell">${esc(s)}</small>` : ""}</div>`).join("")}
      </div>
      <div class="fp-cancel"><b>${ic("event")}Chính sách huỷ: ${esc(cancel.label)}</b><p>${esc(cancel.text)}${l.cancelNote ? " " + esc(l.cancelNote) : ""}</p></div>
      <p class="fp-hint">Cập nhật giá ${l.priceUpdatedAt ? esc(dmy(l.priceUpdatedAt)) : "—"}. Giá do PT tự niêm yết; bạn thanh toán trực tiếp cho PT, TapEasy không cộng thêm phí.</p>
    </section>

    <section class="fp-xs" id="fp-sec-place">
      ${secHead("Khu vực & địa điểm", "location_on", esc(L.provName(l.prov) || "—"))}
      <p class="fp-area">${esc(l.ward || "")}${l.areaHint ? ` <small>(${esc(l.areaHint)})</small>` : ""}</p>
      <div class="fp-places">${(l.places || []).map(p=> `<div class="fp-place"><span class="fp-pic">${ic((D.PLACE_TYPES[p.type] || {}).icon || "place")}</span><div><b>${esc(placeLine(p))}</b>${p.note ? `<small>${esc(p.note)}</small>` : ""}</div></div>`).join("")}</div>
    </section>

    <section class="fp-xs" id="fp-sec-avail">
      ${secHead("Lịch trống trong tuần", "calendar_month", "Khung giờ nhận học viên")}
      <div class="fp-avail" role="table" aria-label="Lịch trống">
        <div class="fp-av-r head" role="row"><span></span>${D.DAYS.map(d=> `<span role="columnheader">${d}</span>`).join("")}</div>
        ${D.SLOTS.map(([k, label, time])=> `<div class="fp-av-r" role="row"><span class="fp-av-l" role="rowheader">${label}<small>${time}</small></span>${D.DAYS.map(d=>{ const on = String((l.avail || {})[d] || "").split(",").includes(k); return `<span role="cell" class="${on ? "on" : ""}" aria-label="${d} ${label}: ${on ? "trống" : "kín"}">${on ? "" : ""}</span>`; }).join("")}</div>`).join("")}
      </div>
      <p class="fp-hint">PT tự cập nhật. Giờ chính xác được xác nhận khi đặt buổi thử.</p>
    </section>

    <section class="fp-xs" id="fp-sec-cert">
      ${secHead("Chứng chỉ & kinh nghiệm", "workspace_premium", `${Math.max(0, Math.round(Number(l.years) || 0))} năm kinh nghiệm`)}
      <div class="fp-certs">${(l.certs || []).map((c, i)=> `<div class="fp-cert">
        ${c.img ? `<button type="button" class="fp-cert-img" data-fpx-cert="${i}" aria-label="Xem ảnh chứng chỉ"><img src="${url(c.img)}" alt="Ảnh chứng chỉ ${esc(c.name)}" loading="lazy"></button>` : `<div class="fp-cert-ill" aria-hidden="true">${ic("workspace_premium")}<i></i><i></i></div>`}
        <div><b>${esc(c.name)}</b><small>${esc(c.issuer || "")}${c.year ? " · " + esc(c.year) : ""}</small>
        <span class="fp-cstat ${isVer(l) ? "ok" : ""}">${isVer(l) ? `${ic("fp_verified")}TapEasy đã đối chiếu` : l.seed ? "Minh hoạ — không đối chiếu" : "PT tự khai — chưa đối chiếu"}</span>${!c.img && l.seed ? `<small class="fp-dim">Hồ sơ minh hoạ — không có ảnh chứng chỉ</small>` : ""}</div></div>`).join("") || `<p class="fp-hint">PT chưa thêm chứng chỉ.</p>`}</div>
    </section>

    <section class="fp-xs" id="fp-sec-open">
      ${secHead("Thông tin minh bạch", "shield", "Số liệu công khai")}
      <div class="fp-facts">
        <div><span>Tỉ lệ phản hồi</span><b>${respR == null || !isFinite(respR) ? "—" : Math.round(respR) + "%"}</b><small>${respR == null ? "chưa đủ 3 yêu cầu" : `trong 24 giờ · ${Number(l.respN) || 0} yêu cầu/90 ngày`}</small></div>
        <div><span>Thời gian trả lời</span><b>${esc(L.fmtMins(l.respMins))}</b><small>trung bình</small></div>
        <div><span>Học viên</span><b>${Math.max(0, Math.round(Number((l.stats || {}).students) || 0))}</b><small>đã/đang theo tập · ${esc(statsSrc(l))}</small></div>
        <div><span>Buổi đã dạy</span><b>${Math.max(0, Math.round(Number((l.stats || {}).sessions) || 0)).toLocaleString("vi-VN")}</b><small>ghi trên TapEasy · ${esc(statsSrc(l))}</small></div>
        <div><span>Giới tính</span><b>${l.gender === "female" ? "Nữ" : l.gender === "male" ? "Nam" : "—"}</b><small>&nbsp;</small></div>
        <div><span>Cập nhật hồ sơ</span><b>${l.updatedAt ? esc(dmy(l.updatedAt)) : "—"}</b><small>&nbsp;</small></div>
      </div>
      ${l.hidden ? `<p class="fp-warnbox">${ic("fp_eye_off")}Niêm yết đang bị ẩn khỏi Tìm PT. Lý do: ${esc(l.hiddenReason || "—")}</p>` : ""}
      ${(can("pt.verify") || can("listings.moderate")) && !o.stub ? `<div class="fp-admin"><b>${ic("shield")}Quản trị</b><div>
        ${can("pt.verify") ? `<button type="button" class="btn btn-sm ${l.verified ? "btn-outline" : "btn-primary"}" data-fpx="verify">${l.verified ? "Thu hồi Đã xác minh" : "Gắn Đã xác minh"}</button>` : ""}
        ${can("listings.moderate") ? `<button type="button" class="btn btn-sm btn-outline" data-fpx="hide">${l.hidden ? "Hiện lại trên Tìm PT" : "Ẩn khỏi Tìm PT…"}</button>` : ""}</div></div>` : ""}
      ${!o.isMe ? `<button type="button" class="fp-link dim" data-fpx="report-listing">${ic("flag")}Báo cáo hồ sơ sai sự thật</button>` : ""}
    </section>

    <section class="fp-xs" id="fp-sec-rv"><div id="fp-rv-box"></div></section>
    ${l.seed ? `<footer class="fp-xs fp-xcredit"><small>${fpAi() && album.some(a=> G.fkPeopleAI.isAi(a.src)) ? "Hồ sơ minh hoạ: Ảnh minh hoạ tạo bằng AI — nhân vật không có thật, không phải PT có tên trong hồ sơ." : `Hồ sơ minh hoạ: ảnh từ Pexels (${esc([...new Set(album.map(a=> a.by).filter(Boolean))].join(", "))}). Người trong ảnh là người mẫu, không phải PT có tên trong hồ sơ.`}</small></footer>` : ""}
  </div>`;
}
function dockHTML(l, o){
  if(o.real && o.cid) return "";
  if(o.isMe) return `<div class="fp-ppdock"><button type="button" class="btn btn-outline" data-fpx="editor">${ic("edit")}Sửa niêm yết</button><button type="button" class="btn btn-primary" data-fpx="inbox">${ic("inbox")}Yêu cầu học viên</button></div>`;
  const conn = myConnection(l);
  return `<div class="fp-ppdock" role="toolbar" aria-label="Liên hệ PT">
    <button type="button" class="fp-dk" data-fpx="msg">${ic("forum")}<span>Nhắn tin</span></button>
    <button type="button" class="btn btn-primary fp-dk-main" data-fpx="trial">${ic("event")}<span>Đặt buổi thử</span></button>
    <button type="button" class="fp-dk" data-fpx="connect" ${conn ? "disabled" : ""}>${ic("person_add")}<span>${conn ? "Đã kết nối" : "Kết nối"}</span></button>
  </div>`;
}
function bindExt(l, o){
  const x = q("#fp-x"); const dock = q(".fp-ppdock");
  const handler = e=>{
    const t = e.target.closest ? e.target.closest("[data-fpx], [data-fpx-photo], [data-fpx-cert], [data-fprv], [data-fprv-f]") : null; if(!t) return;
    if(t.tagName === "A") e.preventDefault();
    if(t.dataset.fpxPhoto != null){ const album = [{ src: l.cover, by: (l.coverCredit || {}).by, link: (l.coverCredit || {}).link }].concat(l.album || []).filter(a=> a && a.src); openLightbox(album, Number(t.dataset.fpxPhoto), l.name); return; }
    if(t.dataset.fpxCert != null){ const c = (l.certs || [])[Number(t.dataset.fpxCert)]; if(c && c.img) openLightbox([{ src:c.img, caption: c.name }], 0, "Chứng chỉ"); return; }
    if(t.dataset.fprvF != null){ C.rvF = t.dataset.fprvF; paintReviews(l.id); return; }
    if(t.dataset.fprv){ return onReviewAction(l, t.dataset.fprv, t.dataset.uid, t); }
    const k = t.dataset.fpx;
    if(k === "msg") return actMessage(l);
    if(k === "trial") return openTrialSheet(l);
    if(k === "connect") return openConnectSheet(l);
    if(k === "editor") return openEditor();
    if(k === "inbox") return openInbox();
    if(k === "verify") return adminVerify(l);
    if(k === "hide") return adminHide(l);
    if(k === "report-listing") return reportListing(l);
  };
  if(x) x.addEventListener("click", handler);
  if(dock) dock.addEventListener("click", handler);
}
async function adminVerify(l){
  const on = !l.verified;
  openSheet(`<div class="sheet-header"><h3>${on ? "Gắn huy hiệu Đã xác minh" : "Thu hồi Đã xác minh"}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">${on ? "Chỉ gắn khi đã đối chiếu chứng chỉ gốc với đơn vị cấp (tra số chứng chỉ, tên khớp CCCD)." : "PT sẽ mất tích xanh trên Tìm PT."}</p>
    <label class="field" style="margin-top:10px;"><span class="fp-lbl">Ghi chú đối chiếu (lưu nhật ký)</span><input id="fpv-note" placeholder="VD: Đã tra số chứng chỉ NASM trên trang chính thức"></label>
    <button class="btn btn-primary btn-block" id="fpv-go" style="margin-top:12px;">${on ? "Xác minh" : "Thu hồi"}</button>`);
  q("#fpv-go").addEventListener("click", async e=>{ busy(e.currentTarget, true, "Đang lưu..."); try{ const r = await P.setVerified(l.id, on, q("#fpv-note").value); closeSheet(); say(on ? "Đã gắn Đã xác minh" : "Đã thu hồi", "fp_verified"); afterChange(r); }catch(err){ busy(e.currentTarget, false); say(err.message, "error"); } });
}
async function adminHide(l){
  const on = !l.hidden;
  if(!on){ try{ const r = await P.setHidden(l.id, false, ""); say("Đã hiện lại trên Tìm PT", "visibility"); afterChange(r); }catch(err){ say(err.message, "error"); } return; }
  openSheet(`<div class="sheet-header"><h3>Ẩn khỏi Tìm PT</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">Hồ sơ vẫn còn, chỉ không xuất hiện trong album. PT thấy lý do.</p>
    <label class="field" style="margin-top:10px;"><span class="fp-lbl">Lý do (bắt buộc)</span><input id="fph-r" placeholder="VD: Ảnh album không phải của PT"></label>
    <button class="btn btn-primary btn-block" id="fph-go" style="margin-top:12px;">Ẩn</button>`);
  q("#fph-go").addEventListener("click", async e=>{ busy(e.currentTarget, true, "Đang lưu..."); try{ const r = await P.setHidden(l.id, true, q("#fph-r").value); closeSheet(); say("Đã ẩn khỏi Tìm PT", "fp_eye_off"); afterChange(r); }catch(err){ busy(e.currentTarget, false); say(err.message, "error"); } });
}
function afterChange(l){
  if(l){ C.byId[l.id] = l; if(C.list){ const i = C.list.findIndex(x=> x.id === l.id); if(i >= 0) C.list[i] = l; } }
  if(isActive("screen-ptprofile") && l && C.ctx && C.ctx.id === l.id){ const sc = scroller(), y = sc ? sc.scrollTop : 0; decorateProfile(l, { listing:true }); if(sc) sc.scrollTop = y; }
}
function reportListing(l){
  if(needLogin("báo cáo hồ sơ")) return;
  openSheet(`<div class="sheet-header"><h3>Báo cáo hồ sơ PT</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <div class="fp-radios">${["Ảnh không phải của PT","Chứng chỉ / kinh nghiệm sai sự thật","Giá niêm yết khác giá thực tế","Hành vi không phù hợp","Khác"].map((r, i)=> `<label><input type="radio" name="fprl" value="${esc(r)}" ${i === 0 ? "checked" : ""}><span>${esc(r)}</span></label>`).join("")}</div>
    <label class="field"><span class="fp-lbl">Mô tả thêm (không bắt buộc)</span><textarea id="fprl-n" rows="2" maxlength="250"></textarea></label>
    <button class="btn btn-primary btn-block" id="fprl-go" style="margin-top:12px;">${ic("flag")}Gửi báo cáo</button>`);
  q("#fprl-go").addEventListener("click", async ()=>{
    const r = (qa('input[name="fprl"]').find(x=> x.checked) || {}).value || "Khác"; const n = q("#fprl-n").value.trim();
    try{ if(G.cloudAdmin && cloudAdmin.report) await cloudAdmin.report("listing", l.id, r + (n ? ": " + n : ""), { title: l.name }); closeSheet(); say("Cảm ơn bạn — đội kiểm duyệt TapEasy sẽ xem xét", "flag"); }
    catch(e){ say(e.message, "error"); }
  });
}

/* Trình xem ảnh toàn màn hình (vuốt ngang, có tên tác giả) */
function openLightbox(items, idx, title){
  closeLightbox();
  const host = q("#app-shell") || document.body;
  const el = document.createElement("div"); el.className = "fp-lb"; el.id = "fp-lb"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Ảnh " + (title || ""));
  el.innerHTML = `<div class="fp-lb-top"><span id="fp-lb-n">${idx+1}/${items.length}</span><b>${esc(title || "")}</b><button type="button" class="fp-round" data-lb="close" aria-label="Đóng">${ic("close")}</button></div>
    <div class="fp-lb-row" id="fp-lb-row">${items.map(a=> `<figure class="fp-lb-s"><img src="${url(a.src)}" alt="" decoding="async"><figcaption>${a.caption ? esc(a.caption) : ""}${G.fkPeopleAI && G.fkPeopleAI.isAi(a.src) ? esc(G.fkPeopleAI.LABEL) : a.by ? `Ảnh: ${esc(a.by)}${/pexels/.test(String(a.link||a.src)) ? " / Pexels" : ""}` : ""}</figcaption></figure>`).join("")}</div>`;
  host.appendChild(el);
  const row = q("#fp-lb-row", el);
  requestAnimationFrame(()=>{ row.scrollLeft = idx * row.clientWidth; el.classList.add("open"); });
  row.addEventListener("scroll", ()=>{ const n = Math.round(row.scrollLeft / Math.max(1, row.clientWidth)); const c = q("#fp-lb-n", el); if(c) c.textContent = `${n+1}/${items.length}`; }, { passive:true });
  el.addEventListener("click", e=>{ if(e.target.closest("[data-lb='close']") || e.target === el) closeLightbox(); });
  C.lbKey = e=>{ if(e.key === "Escape") closeLightbox(); if(e.key === "ArrowRight") row.scrollBy({ left: row.clientWidth }); if(e.key === "ArrowLeft") row.scrollBy({ left: -row.clientWidth }); };
  document.addEventListener("keydown", C.lbKey);
  const b = q("[data-lb='close']", el); if(b) b.focus();
}
function closeLightbox(){ const el = q("#fp-lb"); if(el) el.remove(); if(C.lbKey){ document.removeEventListener("keydown", C.lbKey); C.lbKey = null; } }

/* ---------------------------------------------------------------------
   5. ĐÁNH GIÁ & PHẢN HỒI
   --------------------------------------------------------------------- */
async function loadReviews(lid){
  const box = q("#fp-rv-box"); if(!box) return;
  box.innerHTML = `<div class="fp-xh"><div class="pp-label">Đánh giá & phản hồi <span class="material-symbols-rounded">star</span></div><h2 class="fp-xt">Đang tải…</h2></div>`;
  let list = [], el = { ok:false };
  try{ [list, el] = await Promise.all([P.reviews(lid), P.eligibility(lid).catch(()=> ({ ok:false })), blkReady()]); }catch(e){ warn("reviews", e); box.innerHTML = `<p class="fp-hint">Không tải được đánh giá: ${esc(e.message)}</p>`; return; }
  list = (list || []).filter(r=> !isBlk(r.uid));          // App Store 1.2: ẩn đánh giá của người mình đã chặn
  C.rv[lid] = { list, el };
  paintReviews(lid);
}
function paintReviews(lid){
  const box = q("#fp-rv-box"); const d = C.rv[lid]; if(!box || !d) return;
  const l = C.byId[lid] || { id: lid, uid: lid };
  const isOwner = myUid() && (l.uid || lid) === myUid();
  const ag = L.aggregate(d.list);
  const vis = d.list.filter(r=> !r.hidden), hid = d.list.filter(r=> r.hidden);
  const f = C.rvF || "all", sortK = st().rvSort || "new";
  let shown = d.list.slice();
  if(f === "photos") shown = vis.filter(r=> (r.photos || []).length);
  else if(f === "low") shown = vis.filter(r=> Number(r.stars) <= 3);
  else if(f === "replied") shown = vis.filter(r=> r.reply && r.reply.text);
  else if(/^s[1-5]$/.test(f)) shown = vis.filter(r=> Number(r.stars) === Number(f.slice(1)));
  if(sortK === "low") shown.sort((a,b)=> (a.hidden ? 9 : a.stars) - (b.hidden ? 9 : b.stars) || b.createdAt - a.createdAt);
  else if(sortK === "high") shown.sort((a,b)=> (b.hidden ? 0 : b.stars) - (a.hidden ? 0 : a.stars) || b.createdAt - a.createdAt);
  else shown.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
  const mx = Math.max(1, ...Object.values(ag.dist));
  const el = d.el || {};
  const cta = isOwner ? `<p class="fp-ownernote">${ic("reply")}Đây là hồ sơ của bạn: hãy <b>trả lời công khai</b> từng đánh giá. PT không thể xoá đánh giá — trả lời lịch sự, cụ thể giúp học viên sau tin bạn hơn.</p>`
    : el.ok ? `<button type="button" class="btn btn-primary btn-block" data-fprv="write">${ic("edit")}${el.existing ? "Sửa đánh giá của bạn" : "Viết đánh giá"} <small class="fp-basis">${esc(el.label || "")}</small></button>`
    : `<div class="fp-elig">${ic("lock")}<div><b>Chỉ người đã tập cùng mới đánh giá được</b><p>${esc(el.reason || "Kết nối với PT qua TapEasy và hoàn thành ít nhất 1 buổi, hoặc buổi thử được PT xác nhận.")}</p>
        ${el.code === "login" ? `<button type="button" class="btn btn-outline btn-sm" data-fprv="login">Đăng nhập</button>` : el.code === "self" ? "" : `<button type="button" class="btn btn-outline btn-sm" data-fprv="trial">Đặt buổi thử</button>`}</div></div>`;
  box.innerHTML = `
    ${secHead("Đánh giá & phản hồi", "star", ag.count ? `<em>${n1(ag.avg)}</em> / 5` : "Chưa có đánh giá")}
    ${ag.count ? `<div class="fp-rvsum">
      <div class="fp-rvbig">${starsAvg(ag.avg)}<small>${ag.count} đánh giá từ người đã tập cùng${ag.withPhotos ? ` · ${ag.withPhotos} có ảnh` : ""}${ag.replied ? ` · PT đã trả lời ${ag.replied}` : ""}</small></div>
      <div class="fp-dist">${[5,4,3,2,1].map(s=> `<button type="button" class="${f === "s" + s ? "on" : ""}" data-fprv-f="${f === "s" + s ? "all" : "s" + s}" aria-label="Lọc ${s} sao: ${ag.dist[s]} đánh giá"><span>${s}${STAR}</span><i><em style="width:${Math.round(ag.dist[s] / mx * 100)}%"></em></i><b>${ag.dist[s]}</b></button>`).join("")}</div>
      <div class="fp-crit">${D.CRITERIA.map(([k, label])=> `<div><span>${label}</span><i><em style="width:${(ag.criteria[k] || 0) / 5 * 100}%"></em></i><b>${ag.criteria[k] ? n1(ag.criteria[k]) : "—"}</b></div>`).join("")}</div>
    </div>` : `<p class="fp-hint">PT mới — chưa có đánh giá. Đánh giá chỉ đến từ người đã tập cùng, nên PT mới cần thời gian.</p>`}
    ${hid.length ? `<p class="fp-hidnote">${ic("fp_eye_off")}${hid.length} đánh giá đã bị kiểm duyệt ẩn vì vi phạm tiêu chuẩn — lý do hiển thị tại chỗ, không tính vào điểm.</p>` : ""}
    <div class="fp-rvcta">${cta}</div>
    ${d.list.length ? `<div class="fp-rvbar"><div class="fp-chips sm">${[["all","Tất cả"],["photos","Có ảnh"],["low","≤ 3★"],["replied","PT đã trả lời"]].map(([k, lb])=> `<button type="button" class="fp-chip sm ${f === k ? "on" : ""}" data-fprv-f="${k}">${lb}</button>`).join("")}</div>
      <select class="fp-rvsort" data-fprv-sort aria-label="Sắp xếp đánh giá"><option value="new" ${sortK === "new" ? "selected" : ""}>Mới nhất</option><option value="low" ${sortK === "low" ? "selected" : ""}>Điểm thấp trước</option><option value="high" ${sortK === "high" ? "selected" : ""}>Điểm cao trước</option></select></div>` : ""}
    <div class="fp-rvlist">${shown.map(r=> reviewHTML(r, l, isOwner)).join("") || (d.list.length ? `<p class="fp-hint">Không có đánh giá trong mục này.</p>` : "")}</div>
    <button type="button" class="fp-link dim" data-fprv="rules">${ic("help")}Quy tắc đánh giá & kiểm duyệt</button>`;
  const ss = q("[data-fprv-sort]", box); if(ss) ss.addEventListener("change", ()=>{ st().rvSort = ss.value; save(); paintReviews(lid); });
}
function reviewHTML(r, l, isOwner){
  const mine = myUid() && r.uid === myUid();
  const mod = can("reviews.moderate");
  const head = `<header><span class="fp-av" aria-hidden="true">${esc(L.initials(r.name))}</span><div class="fp-rvwho"><b>${esc(L.maskName(r.name))}${mine ? " (bạn)" : ""}</b><small><span class="fp-tag ok">${ic("check")}${esc(L.basisLabel(r.basis))}</span><span class="fp-rvdate">${esc(dmy(r.createdAt))}${r.editedAt ? (r.editedAfterReply ? " · đã sửa sau phản hồi của PT" : " · đã sửa") : ""}</span></small></div>${r.hidden ? "" : stars(r.stars, "sm")}</header>`;
  if(r.hidden) return `<article class="fp-rv is-hidden">${head}<p class="fp-rvhid">${ic("fp_eye_off")}Đánh giá đã bị ẩn bởi kiểm duyệt viên${r.modAt ? " ngày " + esc(dmy(r.modAt)) : ""}. <b>Lý do:</b> ${esc(r.hiddenReason || "Vi phạm tiêu chuẩn cộng đồng")}.</p>
    ${mod ? `<footer><button type="button" class="fp-act" data-fprv="restore" data-uid="${esc(r.uid)}">${ic("visibility")}Khôi phục</button></footer>` : ""}</article>`;
  const crit = D.CRITERIA.map(([k, label])=> `<span>${label} <b>${Number((r.criteria || {})[k]) || "—"}</b></span>`).join("");
  return `<article class="fp-rv">${head}
    <div class="fp-rvcrit">${crit}</div>
    <p class="fp-rvtext">${esc(r.text)}</p>
    ${(r.photos || []).length ? `<div class="fp-rv-ph">${r.photos.map((p, i)=> `<a href="#" data-fprv="photo" data-uid="${esc(r.uid)}" data-i="${i}" aria-label="Xem ảnh ${i+1}"><img src="${url(p)}" alt="Ảnh trong đánh giá" loading="lazy"></a>`).join("")}</div>` : ""}
    ${r.reply && r.reply.text ? `<div class="fp-reply"><b>${ic("reply")}Phản hồi công khai từ PT</b><small>${esc(dmy(r.reply.at))}</small><p>${esc(r.reply.text)}</p></div>` : ""}
    ${mod && r.flagged ? `<p class="fp-modflag">${ic("flag")}${Number(r.reports) || 0} báo cáo đang chờ xử lý</p>` : ""}
    <footer>
      ${isOwner ? `<button type="button" class="fp-act" data-fprv="reply" data-uid="${esc(r.uid)}">${ic("reply")}${r.reply && r.reply.text ? "Sửa trả lời" : "Trả lời công khai"}</button>` : ""}
      ${mine ? `<button type="button" class="fp-act" data-fprv="write">${ic("edit")}Sửa</button><button type="button" class="fp-act" data-fprv="delete">${ic("delete")}Xoá</button>` : ""}
      ${!mine ? `<button type="button" class="fp-act dim" data-fprv="report" data-uid="${esc(r.uid)}">${ic("flag")}Báo cáo</button>` : ""}
      ${mod ? `<button type="button" class="fp-act warn" data-fprv="hide" data-uid="${esc(r.uid)}">${ic("fp_eye_off")}Ẩn (kiểm duyệt)</button>${r.flagged ? `<button type="button" class="fp-act" data-fprv="dismiss" data-uid="${esc(r.uid)}">${ic("check")}Giữ nguyên</button>` : ""}` : ""}
    </footer></article>`;
}
function onReviewAction(l, k, ruid, btn){
  const lid = l.id, d = C.rv[lid] || { list:[] };
  if(k === "login"){ try{ showAuth("login"); }catch(e){} return; }
  if(k === "trial") return openTrialSheet(l);
  if(k === "write") return openReviewComposer(lid);
  if(k === "rules") return openHow();
  if(k === "photo"){ const r = d.list.find(x=> x.uid === ruid); if(r) openLightbox(r.photos.map((p, i)=> ({ src:p, by: ((r.photoCredits || [])[i] || {}).by, link: ((r.photoCredits || [])[i] || {}).link })), Number(btn.dataset.i) || 0, "Ảnh của " + L.maskName(r.name)); return; }
  if(k === "reply") return openReplySheet(lid, ruid);
  if(k === "report") return openReportSheet(lid, ruid);
  if(k === "delete") return confirmDialog("Xoá đánh giá của bạn?", "Bạn có thể viết lại sau nếu vẫn đủ điều kiện.", async ()=>{ try{ await P.deleteMyReview(lid); say("Đã xoá đánh giá", "delete"); refreshAfterReview(lid); }catch(e){ say(e.message, "error"); } }, "Xoá", "delete");
  if(k === "hide") return openModHide(lid, ruid);
  if(k === "restore" || k === "dismiss"){ P.moderateReview(lid, ruid, k, k === "dismiss" ? "Đã xem xét — không vi phạm" : "").then(()=>{ say(k === "restore" ? "Đã khôi phục đánh giá" : "Đã giữ nguyên đánh giá", "check"); refreshAfterReview(lid); }).catch(e=> say(e.message, "error")); return; }
}
async function refreshAfterReview(lid){
  await loadReviews(lid);
  try{ const l = await P.get(lid); if(l){ C.byId[lid] = l; if(C.list){ const i = C.list.findIndex(x=> x.id === lid); if(i >= 0) C.list[i] = l; } } }catch(e){}
}
const RV_PH_MAX = 3;
async function openReviewComposer(lid){
  if(needLogin("viết đánh giá")) return;
  let el; try{ el = await P.eligibility(lid); }catch(e){ say(e.message, "error"); return; }
  if(!el.ok){ openSheet(`<div class="sheet-header"><h3>Chưa thể đánh giá</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div><div class="fp-elig">${ic("lock")}<div><p>${esc(el.reason)}</p></div></div>`); return; }
  const ex = el.existing || {};
  const R = { stars: ex.stars || 0, criteria: Object.assign({ expertise:0, punctual:0, attitude:0, results:0 }, ex.criteria || {}), text: ex.text || "", photos: (ex.photos || []).slice() };
  const l = C.byId[lid] || {};
  const starRow = (key, val, big)=> `<div class="fp-starin ${big ? "big" : ""}" role="radiogroup" aria-label="${big ? "Điểm tổng thể" : esc((D.CRITERIA.find(c=> c[0] === key) || [])[1] || key)}">${[1,2,3,4,5].map(v=> `<button type="button" role="radio" aria-checked="${val === v}" aria-label="${v} sao" class="${v <= val ? "on" : ""}" data-rs="${key}" data-v="${v}">${STAR}</button>`).join("")}</div>`;
  const paint = ()=>{
    const sh = q("#sheet-content");
    sh.innerHTML = `<div class="sheet-handle"></div><div class="sheet-header"><h3>${ex.uid ? "Sửa đánh giá" : "Đánh giá"} ${esc(firstName(l.name || ""))}</h3><button class="icon-btn" data-rc="close" aria-label="Đóng">${ic("close")}</button></div>
      <p class="fp-tag ok big">${ic("check")}${esc(el.label || "Đã tập cùng")}</p>
      <div class="fp-rc-sec"><b>Tổng thể</b>${starRow("stars", R.stars, true)}</div>
      <div class="fp-rc-crit">${D.CRITERIA.map(([k, label])=> `<div><span>${label}</span>${starRow(k, R.criteria[k])}</div>`).join("")}</div>
      <label class="field"><span class="fp-lbl">Trải nghiệm của bạn (${L.validateReview ? "20–1500" : ""} ký tự)</span><textarea id="rc-text" rows="5" maxlength="1500" placeholder="Bạn tập gì, bao lâu, PT hướng dẫn thế nào, kết quả ra sao? Góp ý thẳng thắn nhưng lịch sự.">${esc(R.text)}</textarea><small class="fp-cnt" id="rc-cnt"></small></label>
      <div class="fp-rc-ph">${R.photos.map((p, i)=> `<div class="fp-ed-ph"><img src="${url(p)}" alt=""><button type="button" data-rc="rmph" data-i="${i}" aria-label="Bỏ ảnh">${ic("close")}</button></div>`).join("")}${R.photos.length < RV_PH_MAX ? `<button type="button" class="fp-addph" data-rc="addph">${ic("photo_camera")}<span>Thêm ảnh<br>(tối đa 3)</span></button>` : ""}</div>
      <p class="fp-hint">Tên hiển thị: <b>${esc(L.maskName((cloud.user || {}).name))}</b> (rút gọn để bảo vệ bạn). Không ghi số điện thoại, email, thông tin sức khoẻ chi tiết của người khác.</p>
      <label class="fp-check"><input type="checkbox" id="rc-ok" ${ex.uid ? "checked" : ""}><span>Tôi xác nhận đây là trải nghiệm thật của tôi với PT này.</span></label>
      <p class="auth-err" id="rc-err"></p>
      <button type="button" class="btn btn-primary btn-block" data-rc="send">${ic("send")}${ex.uid ? "Lưu thay đổi" : "Đăng đánh giá công khai"}</button>`;
    const ta = q("#rc-text"), cnt = q("#rc-cnt");
    const upd = ()=>{ R.text = ta.value; cnt.textContent = `${ta.value.trim().length}/1500`; };
    ta.addEventListener("input", upd); upd();
  };
  openSheet(""); paint();
  q("#sheet-content").onclick = async e=>{
    const b = e.target.closest ? e.target.closest("button") : null; if(!b) return;
    if(b.dataset.rs){ const k = b.dataset.rs, v = Number(b.dataset.v); R.text = (q("#rc-text") || {}).value || R.text; if(k === "stars") R.stars = v; else R.criteria[k] = v;
      if(k === "stars" && !Object.values(R.criteria).some(Boolean)) D.CRITERIA.forEach(([c])=> R.criteria[c] = v);
      const ok = (q("#rc-ok") || {}).checked; paint(); const c = q("#rc-ok"); if(c) c.checked = ok; return; }
    if(b.dataset.rc === "close") return closeSheet();
    if(b.dataset.rc === "rmph"){ R.text = q("#rc-text").value; R.photos.splice(Number(b.dataset.i), 1); paint(); return; }
    if(b.dataset.rc === "addph"){ R.text = q("#rc-text").value; pickFiles(true, async files=>{ for(const f of files.slice(0, RV_PH_MAX - R.photos.length)){ try{ R.photos.push(await P.compressImage(f, { max:900, q:0.72 })); }catch(err){ say(err.message, "error"); } } paint(); }); return; }
    if(b.dataset.rc === "send"){
      R.text = q("#rc-text").value;
      const er = q("#rc-err");
      if(!q("#rc-ok").checked){ er.textContent = "Hãy xác nhận đây là trải nghiệm thật của bạn."; return; }
      const bad = L.validateReview(R); if(bad){ er.textContent = bad; return; }
      busy(b, true, "Đang đăng...");
      try{ await P.submitReview(lid, R); closeSheet(); say(ex.uid ? "Đã cập nhật đánh giá" : "Cảm ơn bạn! Đánh giá đã được đăng công khai", "star"); refreshAfterReview(lid); }
      catch(err){ busy(b, false); er.textContent = err.message; }
    }
  };
}
function openReplySheet(lid, ruid){
  const r = ((C.rv[lid] || {}).list || []).find(x=> x.uid === ruid); if(!r) return;
  openSheet(`<div class="sheet-header"><h3>Trả lời công khai</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <blockquote class="fp-quote">${stars(r.stars, "sm")}<p>${esc(r.text)}</p><small>— ${esc(L.maskName(r.name))}</small></blockquote>
    <label class="field"><span class="fp-lbl">Trả lời của bạn (hiện công khai dưới đánh giá)</span><textarea id="rp-t" rows="4" maxlength="1000" placeholder="Cảm ơn góp ý, giải thích cụ thể bạn đã/ sẽ thay đổi gì…">${esc((r.reply || {}).text || "")}</textarea></label>
    <p class="fp-hint">${ic("lock")}PT không thể xoá hay sửa đánh giá của học viên. Nếu đánh giá sai sự thật, hãy dùng "Báo cáo" để kiểm duyệt viên xem xét.</p>
    <p class="auth-err" id="rp-err"></p>
    <button class="btn btn-primary btn-block" id="rp-go">${ic("send")}Đăng trả lời</button>`);
  q("#rp-go").addEventListener("click", async e=>{ const b = e.currentTarget; busy(b, true, "Đang đăng..."); try{ await P.replyReview(lid, ruid, q("#rp-t").value); closeSheet(); say("Đã đăng trả lời công khai", "reply"); refreshAfterReview(lid); }catch(err){ busy(b, false); q("#rp-err").textContent = err.message; } });
}
function openReportSheet(lid, ruid){
  if(needLogin("báo cáo đánh giá")) return;
  openSheet(`<div class="sheet-header"><h3>Báo cáo đánh giá</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">Kiểm duyệt viên xem xét mọi báo cáo. Đánh giá chỉ bị ẩn khi thật sự vi phạm — <b>không ẩn vì chê</b>.</p>
    <div class="fp-radios">${D.REPORT_REASONS.map((r, i)=> `<label><input type="radio" name="fprr" value="${esc(r)}" ${i === 0 ? "checked" : ""}><span>${esc(r)}</span></label>`).join("")}</div>
    <label class="field"><span class="fp-lbl">Mô tả thêm (không bắt buộc)</span><textarea id="fprr-n" rows="2" maxlength="250"></textarea></label>
    <button class="btn btn-primary btn-block" id="fprr-go" style="margin-top:12px;">${ic("flag")}Gửi báo cáo</button>`);
  q("#fprr-go").addEventListener("click", async e=>{
    const r = (qa('input[name="fprr"]').find(x=> x.checked) || {}).value || "Khác"; const n = q("#fprr-n").value.trim();
    busy(e.currentTarget, true, "Đang gửi...");
    try{ const res = await P.reportReview(lid, ruid, r + (n ? ": " + n : "")); closeSheet(); say(res.already ? "Bạn đã báo cáo đánh giá này trước đó" : "Cảm ơn bạn — kiểm duyệt viên sẽ xem xét", "flag"); refreshAfterReview(lid); }
    catch(err){ busy(e.currentTarget, false); say(err.message, "error"); }
  });
}
async function openModHide(lid, ruid){
  let reps = []; try{ reps = await P.reportsOf(lid, ruid); }catch(e){}
  openSheet(`<div class="sheet-header"><h3>Ẩn đánh giá (kiểm duyệt)</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    ${reps.length ? `<div class="fp-reps"><b>${reps.length} báo cáo:</b>${reps.map(r=> `<span>${esc(r.reason)}</span>`).join("")}</div>` : ""}
    <p class="small-note">Chỉ ẩn khi vi phạm: xúc phạm/quấy rối, lộ thông tin cá nhân, không phải trải nghiệm thật, spam. Lý do sẽ <b>hiển thị công khai</b> tại chỗ đánh giá.</p>
    <div class="fp-radios">${["Ngôn từ xúc phạm, quấy rối","Lộ thông tin cá nhân","Không phải trải nghiệm thật","Spam / quảng cáo"].map((r, i)=> `<label><input type="radio" name="fpmh" value="${esc(r)}" ${i === 0 ? "checked" : ""}><span>${esc(r)}</span></label>`).join("")}</div>
    <button class="btn btn-primary btn-block" id="fpmh-go" style="margin-top:12px;">${ic("fp_eye_off")}Ẩn đánh giá</button>`);
  q("#fpmh-go").addEventListener("click", async e=>{ const r = (qa('input[name="fpmh"]').find(x=> x.checked) || {}).value; busy(e.currentTarget, true, "Đang lưu..."); try{ await P.moderateReview(lid, ruid, "hide", r); closeSheet(); say("Đã ẩn đánh giá, lý do hiển thị công khai", "fp_eye_off"); refreshAfterReview(lid); }catch(err){ busy(e.currentTarget, false); say(err.message, "error"); } });
}

/* ---------------------------------------------------------------------
   6. NHẮN TIN · ĐẶT BUỔI THỬ · KẾT NỐI · HỘP YÊU CẦU
   --------------------------------------------------------------------- */
function actMessage(l){
  const c = myConnection(l);
  if(c){
    try{ if(G.TEConnect && G.TEConnect.state){ const s = G.TEConnect.state(); s.hub = c.id; s.hubTab = "chat"; save(); } }catch(e){}
    try{ if(typeof coachTab !== "undefined") coachTab = "coaches"; }catch(e){}
    goto("coach"); return;
  }
  openQuestionSheet(l);
}
function trialPriceText(l){ const t = (l.prices || {}).trial; return t === 0 ? "Miễn phí" : (t == null || t === "") ? null : money(t); }
const SLOT_TIMES = { m:["06:00","07:00","08:00"], n:["11:30","12:30"], a:["14:30","15:30","16:30"], e:["17:30","18:30","19:30","20:30"] };
function openTrialSheet(l){
  if(needLogin("đặt buổi thử")) return;
  if(myUid() && (l.uid || l.id) === myUid()) return say("Đây là hồ sơ của bạn", "info");
  const tp = trialPriceText(l);
  if(tp == null){ confirmDialog("PT không nhận buổi thử", "PT này chưa mở buổi thử. Bạn có thể gửi Lời mời kết nối hoặc nhắn câu hỏi trước.", ()=> openConnectSheet(l), "Gửi lời mời kết nối", "person_add"); return; }
  const days = Array.from({ length:14 }, (_, i)=>{ const d = new Date(); d.setDate(d.getDate() + i + 1); const k = ["CN","T2","T3","T4","T5","T6","T7"][d.getDay()]; return { ds: `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`, k, n: d.getDate(), m: d.getMonth()+1 }; });
  let pick = days.find(d=> String((l.avail || {})[d.k] || "")) || days[0], time = "";
  const timesFor = d=> String((l.avail || {})[d.k] || "").split(",").filter(Boolean).flatMap(s=> SLOT_TIMES[s] || []);
  const paint = ()=>{
    const ts = timesFor(pick); if(!ts.includes(time)) time = ts[0] || "";
    q("#sheet-content").innerHTML = `<div class="sheet-handle"></div><div class="sheet-header"><h3>Đặt buổi thử</h3><button class="icon-btn" data-tr="close" aria-label="Đóng">${ic("close")}</button></div>
      <div class="fp-trialhead"><img src="${url(l.coverThumb || l.cover)}" alt=""><div><b>${esc(l.name)}</b><small>Buổi thử: <b>${esc(tp)}</b> · thanh toán trực tiếp cho PT</small></div></div>
      <h4 class="fp-h4">Chọn ngày</h4>
      <div class="fp-days">${days.map(d=>{ const has = !!String((l.avail || {})[d.k] || ""); return `<button type="button" class="${d.ds === pick.ds ? "on" : ""} ${has ? "" : "dim"}" data-tr-d="${d.ds}" aria-pressed="${d.ds === pick.ds}"><small>${d.k}</small><b>${d.n}</b><i>${p2(d.m)}</i></button>`; }).join("")}</div>
      <h4 class="fp-h4">Chọn giờ</h4>
      ${ts.length ? `<div class="fp-times">${ts.map(t=> `<button type="button" class="${t === time ? "on" : ""}" data-tr-t="${t}" aria-pressed="${t === time}">${t}</button>`).join("")}</div>` : `<p class="fp-hint">PT không có khung trống ngày này. Bạn vẫn có thể đề xuất giờ:</p><input type="time" id="tr-time" value="18:00" class="fp-input">`}
      ${(l.places || []).length ? `<label class="field"><span class="fp-lbl">Địa điểm</span><select id="tr-place">${l.places.map(p=> `<option>${esc(placeLine(p))}</option>`).join("")}</select></label>` : ""}
      <label class="field"><span class="fp-lbl">Mục tiêu của bạn</span><input id="tr-goal" maxlength="200" placeholder="VD: giảm 5 kg, hết đau lưng, kéo xà được…" value="${esc(goalText())}"></label>
      <label class="field"><span class="fp-lbl">Lời nhắn (không bắt buộc)</span><textarea id="tr-note" rows="2" maxlength="500" placeholder="Tình trạng sức khoẻ cần PT lưu ý, kinh nghiệm tập…"></textarea></label>
      <p class="fp-hint">${ic("lock")}PT thấy tên, mục tiêu và lời nhắn của bạn. Số điện thoại chỉ trao đổi sau khi PT nhận lịch.</p>
      <p class="auth-err" id="tr-err"></p>
      <button type="button" class="btn btn-primary btn-block" data-tr="send">${ic("event")}Gửi yêu cầu buổi thử</button>`;
  };
  openSheet(""); paint();
  q("#sheet-content").onclick = async e=>{
    const b = e.target.closest ? e.target.closest("button") : null; if(!b) return;
    if(b.dataset.tr === "close") return closeSheet();
    if(b.dataset.trD){ const keep = { g: (q("#tr-goal")||{}).value, n: (q("#tr-note")||{}).value }; pick = days.find(d=> d.ds === b.dataset.trD) || pick; paint(); if(q("#tr-goal")) q("#tr-goal").value = keep.g; if(q("#tr-note")) q("#tr-note").value = keep.n; return; }
    if(b.dataset.trT){ time = b.dataset.trT; qa("[data-tr-t]").forEach(x=>{ x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); }); return; }
    if(b.dataset.tr === "send"){
      const t = q("#tr-time") ? q("#tr-time").value : time;
      busy(b, true, "Đang gửi...");
      try{
        await P.sendRequest(l.id, { kind:"trial", slot:{ date: pick.ds, time: t }, place: (q("#tr-place")||{}).value || "", goal: q("#tr-goal").value, text: q("#tr-note").value });
        closeSheet(); say("Đã gửi yêu cầu buổi thử — PT sẽ trả lời trong mục Yêu cầu của tôi", "event"); paintBadges(true);
      }catch(err){ busy(b, false); q("#tr-err").textContent = err.message; }
    }
  };
}
function goalText(){ try{ const g = state.profile.goal; return g === "lose" ? "Giảm mỡ" : g === "gain" ? "Tăng cơ" : g === "maintain" ? "Giữ dáng, khoẻ hơn" : ""; }catch(e){ return ""; } }
async function openConnectSheet(l){
  if(needLogin("gửi lời mời kết nối")) return;
  if(myUid() && (l.uid || l.id) === myUid()) return say("Đây là hồ sơ của bạn", "info");
  if(myConnection(l)) return say("Bạn đã kết nối với PT này — vào mục PT để chat", "check");
  let card = null; try{ card = await P.myStudentCard(); }catch(e){}
  const email = (cloud.user && cloud.user.email) || "";
  openSheet(`<div class="sheet-header"><h3>Gửi lời mời kết nối</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">Khi ${esc(firstName(l.name))} nhận lời, PT tạo form tập cho bạn: lịch buổi tập, giáo án, chat, theo dõi tiến độ trong mục <b>PT</b>.</p>
    <label class="field" style="margin-top:10px;"><span class="fp-lbl">Mục tiêu</span><input id="cn-goal" maxlength="200" value="${esc(goalText())}" placeholder="VD: tăng cơ, chuẩn bị chạy 10 km…"></label>
    <label class="field"><span class="fp-lbl">Lời nhắn cho PT</span><textarea id="cn-msg" rows="3" maxlength="800">Chào ${esc(l.gender === "female" ? "chị" : "anh")} ${esc(firstName(l.name))}, em muốn tập cùng ${esc(l.gender === "female" ? "chị" : "anh")}. Lịch em rảnh: </textarea></label>
    ${email ? `<label class="fp-check"><input type="checkbox" id="cn-email" checked><span>Cho PT thấy email <b>${esc(email)}</b> để gửi lời mời trong app (bỏ chọn thì PT gửi mã mời qua tin nhắn).</span></label>` : ""}
    ${card ? `<label class="fp-check"><input type="checkbox" id="cn-card"><span>Đính kèm thẻ học viên: chuyên cần ${n1(card.attendance)} · nỗ lực ${n1(card.effort)} · trao đổi ${n1(card.comms)} (từ ${card.n} PT). Chỉ gửi cho PT này.</span></label>` : ""}
    <p class="auth-err" id="cn-err"></p>
    <button class="btn btn-primary btn-block" id="cn-go">${ic("person_add")}Gửi lời mời</button>`);
  q("#cn-go").addEventListener("click", async e=>{
    const b = e.currentTarget; busy(b, true);
    try{
      await P.sendRequest(l.id, { kind:"connect", goal: q("#cn-goal").value, text: q("#cn-msg").value, shareEmail: !!(q("#cn-email") && q("#cn-email").checked), card: q("#cn-card") && q("#cn-card").checked ? card : null });
      closeSheet(); say("Đã gửi lời mời kết nối", "person_add"); paintBadges(true);
    }catch(err){ busy(b, false); q("#cn-err").textContent = err.message; }
  });
}
function openQuestionSheet(l){
  if(needLogin("nhắn tin cho PT")) return;
  if(myUid() && (l.uid || l.id) === myUid()) return say("Đây là hồ sơ của bạn", "info");
  openSheet(`<div class="sheet-header"><h3>Nhắn ${esc(firstName(l.name))}</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="small-note">Bạn chưa kết nối với PT này nên tin nhắn được gửi dạng <b>câu hỏi</b>; trả lời hiện trong "Yêu cầu của tôi". Sau khi kết nối, hai bên chat trực tiếp trong mục PT.</p>
    <div class="fp-chipwrap" style="margin:10px 0;">${["Anh/chị còn nhận học viên mới không?","Gói 12 buổi có tập được 2 người không?","Em bị đau gối, tập được không ạ?","Buổi tập kéo dài bao lâu?"].map(t=> `<button type="button" class="fp-chip sm" data-qs>${esc(t)}</button>`).join("")}</div>
    <label class="field"><span class="fp-lbl">Câu hỏi</span><textarea id="qs-t" rows="3" maxlength="1000"></textarea></label>
    <p class="fp-hint">${ic("schedule")}PT này thường trả lời trong ${esc(L.fmtMins(l.respMins))}.</p>
    <p class="auth-err" id="qs-err"></p>
    <button class="btn btn-primary btn-block" id="qs-go">${ic("send")}Gửi</button>`);
  qa("[data-qs]").forEach(b=> b.addEventListener("click", ()=>{ q("#qs-t").value = b.textContent; }));
  q("#qs-go").addEventListener("click", async e=>{ const b = e.currentTarget; busy(b, true); try{ await P.sendRequest(l.id, { kind:"question", text: q("#qs-t").value }); closeSheet(); say("Đã gửi câu hỏi cho PT", "send"); paintBadges(true); }catch(err){ busy(b, false); q("#qs-err").textContent = err.message; } });
}
function threadHTML(qq, meRole){
  return `<div class="fp-thread">${(qq.msgs || []).map(m=> `<div class="fp-msg ${m.role === meRole ? "me" : ""}"><p>${esc(m.text)}</p><small>${m.role === "pt" ? "PT" : "Học viên"} · ${esc(ago(m.ts))}</small></div>`).join("") || `<p class="fp-hint">Chưa có tin nhắn.</p>`}</div>`;
}
const KIND_IC = { trial:"event", connect:"person_add", question:"forum" };
async function openMyRequests(){
  if(needLogin("xem yêu cầu đã gửi")) return;
  openSheet(`<div class="sheet-header"><h3>Yêu cầu của tôi</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div><div id="mr-box"><div class="spinner"></div></div>`);
  let list = []; try{ list = await P.myRequests(); }catch(e){ q("#mr-box").innerHTML = `<p class="fp-hint">${esc(e.message)}</p>`; return; }
  C.myReqs = list; st().seenReq = Date.now(); save(); paintBadges();
  const box = q("#mr-box"); if(!box) return;
  if(!list.length){ box.innerHTML = `<div class="fp-empty sm">${ic("inbox")}<p>Chưa có yêu cầu nào. Mở hồ sơ PT để đặt buổi thử, gửi lời mời kết nối hoặc nhắn câu hỏi.</p></div>`; return; }
  box.innerHTML = list.map(r=>{ const l = C.byId[r.lid] || {}; return `<article class="fp-req" data-lid="${esc(r.lid)}" data-qid="${esc(r.id)}">
    <header>${l.coverThumb ? `<img src="${url(l.coverThumb)}" alt="">` : `<span class="fp-av">${esc(L.initials(l.name || "PT"))}</span>`}<div><b>${esc(l.name || "PT")}</b><small>${ic(KIND_IC[r.kind] || "forum")}${esc(D.KINDS[r.kind] || "")}${r.slot ? ` · ${esc(r.slot.time)} ${esc(r.slot.date.split("-").reverse().join("/"))}` : ""} · ${esc(ago(r.createdAt))}</small></div><span class="fp-st st-${esc(r.status)}">${esc(D.RSTATUS[r.status] || r.status)}</span></header>
    ${threadHTML(r, "student")}
    ${r.status !== "cancelled" && r.status !== "declined" ? `<div class="fp-replyin"><input placeholder="Nhắn thêm…" maxlength="1000" aria-label="Nhắn thêm"><button type="button" class="fp-round sm" data-mr="send" aria-label="Gửi">${ic("send")}</button></div>` : ""}
    <div class="fp-reqact">
      <button type="button" class="fp-act" data-mr="open">${ic("visibility")}Hồ sơ PT</button>
      ${blkBtn(l.uid || r.lid, l.brandName || l.name || "PT", "Yêu cầu Tìm PT")}
      ${r.status === "pending" ? `<button type="button" class="fp-act dim" data-mr="cancel">${ic("close")}Huỷ yêu cầu</button>` : ""}
      ${r.kind === "trial" && r.status === "accepted" && P.isSeed(r.lid) ? `<button type="button" class="fp-act" data-mr="simulate">${ic("check")}Giả lập: buổi thử đã diễn ra</button>` : ""}
      ${r.kind === "trial" && r.status === "done" ? `<button type="button" class="fp-act ok" data-mr="review">${ic("star")}Viết đánh giá</button>` : ""}
    </div></article>`; }).join("");
  box.onclick = async e=>{
    const b = e.target.closest ? e.target.closest("[data-mr]") : null; if(!b) return;
    const card = b.closest(".fp-req"), lid = card.dataset.lid, qid = card.dataset.qid;
    const k = b.dataset.mr;
    try{
      if(k === "open"){ closeSheet(); openListing(lid, { from: (q(".screen.active")||{}).id === "screen-ptprofile" ? ((C.ctx||{}).from || "findpt") : undefined }); return; }
      if(k === "cancel"){ await P.cancelRequest(lid, qid); say("Đã huỷ yêu cầu", "close"); }
      if(k === "simulate"){ await P.simulateTrialDone(lid, qid); say("Buổi thử đã được xác nhận — bạn có thể đánh giá", "check"); }
      if(k === "review"){ closeSheet(); openReviewComposer(lid); return; }
      if(k === "send"){ const inp = q("input", card); if(!inp.value.trim()) return; busy(b, true, "…"); await P.addMessage(lid, qid, inp.value); }
      openMyRequests();
    }catch(err){ busy(b, false); say(err.message, "error"); }
  };
}
async function openInbox(){
  if(needLogin("xem yêu cầu học viên")) return;
  openSheet(`<div class="sheet-header"><h3>Yêu cầu từ học viên</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <p class="fp-hint" style="margin-top:-8px;">Trả lời trong 24 giờ để giữ <b>tỉ lệ phản hồi</b> cao — chỉ số này hiển thị công khai trên hồ sơ.</p><div id="ib-box"><div class="spinner"></div></div>`);
  let list = []; try{ list = await P.inbox(); }catch(e){ q("#ib-box").innerHTML = `<p class="fp-hint">${esc(e.message)}</p>`; return; }
  C.inbox = list; paintBadges();
  const box = q("#ib-box"); if(!box) return;
  if(!list.length){ box.innerHTML = `<div class="fp-empty sm">${ic("inbox")}<p>Chưa có yêu cầu. Niêm yết đầy đủ album, bảng giá, lịch trống để học viên dễ chọn bạn.</p></div>`; return; }
  box.innerHTML = list.map(r=> `<article class="fp-req" data-qid="${esc(r.id)}">
    <header><span class="fp-av">${esc(L.initials(r.name))}</span><div><b>${esc(r.name)}</b><small>${ic(KIND_IC[r.kind] || "forum")}${esc(D.KINDS[r.kind] || "")}${r.slot ? ` · ${esc(r.slot.time)} ${esc(r.slot.date.split("-").reverse().join("/"))}` : ""} · ${esc(ago(r.createdAt))}</small></div><span class="fp-st st-${esc(r.status)}">${esc(D.RSTATUS[r.status] || r.status)}</span></header>
    ${r.goal ? `<p class="fp-reqline"><b>Mục tiêu:</b> ${esc(r.goal)}</p>` : ""}${r.place ? `<p class="fp-reqline"><b>Địa điểm:</b> ${esc(r.place)}</p>` : ""}
    ${r.email ? `<p class="fp-reqline"><b>Email (học viên đồng ý chia sẻ):</b> ${esc(r.email)}</p>` : ""}
    ${r.card ? `<p class="fp-reqline"><b>Thẻ học viên:</b> chuyên cần ${n1(r.card.attendance)} · nỗ lực ${n1(r.card.effort)} · trao đổi ${n1(r.card.comms)} (từ ${Number(r.card.n)||1} PT)</p>` : ""}
    ${threadHTML(r, "pt")}
    ${r.status !== "cancelled" ? `<div class="fp-replyin"><input placeholder="Trả lời…" maxlength="1000" aria-label="Trả lời"><button type="button" class="fp-round sm" data-ib="send" aria-label="Gửi">${ic("send")}</button></div>` : ""}
    <div class="fp-reqact">
      ${r.kind === "trial" && r.status === "pending" ? `<button type="button" class="fp-act ok" data-ib="accept">${ic("check")}Nhận lịch</button><button type="button" class="fp-act dim" data-ib="decline">${ic("close")}Từ chối</button>` : ""}
      ${r.kind === "trial" && r.status === "accepted" ? `<button type="button" class="fp-act ok" data-ib="done">${ic("check")}Xác nhận đã tập buổi thử</button>` : ""}
      ${r.kind === "connect" && r.status === "pending" ? `<button type="button" class="fp-act ok" data-ib="connect">${ic("person_add")}Chấp nhận & tạo form</button><button type="button" class="fp-act dim" data-ib="decline">${ic("close")}Từ chối</button>` : ""}
      ${blkBtn(r.uid, r.name || "Học viên", "Yêu cầu Tìm PT")}
    </div></article>`).join("");
  box.onclick = async e=>{
    const b = e.target.closest ? e.target.closest("[data-ib]") : null; if(!b) return;
    const card = b.closest(".fp-req"), qid = card.dataset.qid, r = C.inbox.find(x=> x.id === qid); if(!r) return;
    const lid = myUid(), k = b.dataset.ib;
    busy(b, true, "…");
    try{
      if(k === "send"){ const inp = q("input", card); if(!inp.value.trim()){ busy(b, false); return; } await P.addMessage(lid, qid, inp.value); }
      if(k === "accept") await P.respond(lid, qid, { status:"accepted", text:`Mình nhận lịch ${r.slot ? r.slot.time + " ngày " + r.slot.date.split("-").reverse().join("/") : ""}. Hẹn gặp bạn!` });
      if(k === "decline") await P.respond(lid, qid, { status:"declined", text:"Xin lỗi, mình chưa nhận được yêu cầu này. Bạn có thể chọn khung giờ khác hoặc PT khác nhé." });
      if(k === "done") await P.respond(lid, qid, { status:"done", text:"Cảm ơn bạn đã tập thử! Bạn có thể để lại đánh giá công khai trên hồ sơ của mình." });
      if(k === "connect"){
        const c = await cloud.createClient({ name: r.name, goal: r.goal || "", startDate: todayS(), packageTotal: 0 });
        let msg = `Mình đã tạo form tập cho bạn. Mã kết nối: ${c.joinCode} — vào mục PT → Nhập mã PT.`;
        if(r.email && cloud.social && cloud.social.sendInvite){ try{ await cloud.social.sendInvite({ clientId: c.id, email: r.email, message:"Chào bạn, mình đã nhận lời kết nối từ Tìm PT. Chấp nhận để bắt đầu nhé!" }); msg = `Mình đã gửi lời mời qua email bạn chia sẻ — mở mục PT → Hộp thư lời mời để chấp nhận. Mã dự phòng: ${c.joinCode}.`; }catch(err){ warn("invite", err); } }
        await P.respond(lid, qid, { status:"accepted", text: msg, clientId: c.id });
        try{ if(typeof refreshCoachData === "function") refreshCoachData(true); }catch(err){}
        say("Đã tạo form học viên và gửi mã kết nối", "person_add");
      }
      openInbox();
    }catch(err){ busy(b, false); say(err.message, "error"); }
  };
}
async function paintBadges(force){
  if(!cloud.isLoggedIn()) return;
  try{
    if(force || !C._badgeAt || Date.now() - C._badgeAt > 15000){ C._badgeAt = Date.now(); C.myReqs = await P.myRequests(); if(amPT()) C.inbox = await P.inbox(); }
  }catch(e){ return; }
  const seen = st().seenReq || 0;
  const n = (C.myReqs || []).filter(r=> (r.updatedAt || 0) > seen && (r.msgs || []).length && r.msgs[r.msgs.length-1].role === "pt").length;
  qa("[data-fp-badge]").forEach(b=>{ b.hidden = !n; b.textContent = n || ""; });
  const pend = (C.inbox || []).filter(r=> r.status === "pending").length;
  qa("[data-fp-inbox-n]").forEach(b=>{ b.hidden = !pend; b.textContent = pend || ""; });
}

/* ---------------------------------------------------------------------
   7. KHU TAPEASY PT: NIÊM YẾT HỒ SƠ TÌM PT
   --------------------------------------------------------------------- */
function guessSpecs(txt){ const n = L.norm(txt); return D.SPECS.filter(s=> n && n.includes(L.norm(s).split(" ")[0]) && n.includes(L.norm(s))).slice(0, 4); }
function guessProv(txt){ const n = L.norm(txt); const p = D.PROVINCES.find(p=> n.includes(L.norm(p.name.replace("TP. ", "")))); return p ? p.id : (/ho chi minh|hcm|sai gon/.test(n) ? "hcm" : ""); }
async function openEditor(){
  if(needLogin("niêm yết hồ sơ Tìm PT")) return;
  if(!amPT()){ confirmDialog("Bật Chế độ PT?", "Niêm yết Tìm PT dành cho tài khoản PT. Bật Chế độ PT miễn phí để quản lý học viên và nhận yêu cầu.", async ()=>{ try{ await cloud.updateMyProfile({ isPT:true }); openEditor(); }catch(e){ say(e.message, "error"); } }, "Bật Chế độ PT", "sports"); return; }
  let cur = null; try{ cur = await P.myListing(); }catch(e){}
  const pr = cloud.profile || {}, sp = (typeof state !== "undefined" && state && state.profile) || {};
  const E = C.ed = cur ? clone(cur) : {
    name: pr.name || (cloud.user || {}).name || "", brandName: pr.brandName || "", gender: sp.gender === "female" ? "female" : sp.gender === "male" ? "male" : "",
    years: pr.years || "", specs: guessSpecs(pr.specialty), bio: pr.bio || "", prov: guessProv(pr.area), ward:"", areaHint:"",
    places:[{ type:"gym", name:"", note:"" }], prices:{ single:"", pack12:"", pack24:"", online:"", trial:0 }, cancel:"moderate", cancelNote:"",
    langs:["vi"], avail:{}, certs:[], cover: pr.photo || "", album:[], showPhone:false, phone: pr.phone || "" };
  E.prices = Object.assign({ single:"", pack12:"", pack24:"", online:"", trial:0 }, E.prices || {});
  C.edCur = cur;
  paintEditor();
}
function edRead(){
  const E = C.ed; const v = id=> { const el = q("#" + id); return el ? el.value : undefined; };
  if(!q("#fe-name")) return;
  E.name = v("fe-name"); E.brandName = v("fe-brand"); E.years = v("fe-years"); E.bio = v("fe-bio");
  E.prov = v("fe-prov"); E.ward = v("fe-ward"); E.areaHint = v("fe-hint");
  E.places = qa(".fe-place").map(r=> ({ type: q("select", r).value, name: q(".fe-pn", r).value, note: q(".fe-pt", r).value }));
  const tm = v("fe-trialm");
  E.prices = { single: v("fe-single"), pack12: v("fe-p12"), pack24: v("fe-p24"), online: v("fe-online"), trial: tm === "free" ? 0 : tm === "none" ? null : v("fe-trial") };
  const cr = qa("input[name='fe-cancel']").find(x=> x.checked); if(cr) E.cancel = cr.value;
  E.cancelNote = v("fe-cnote");
  E.certs = qa(".fe-cert").map((r, i)=> ({ name: q(".fe-cn", r).value, issuer: q(".fe-ci", r).value, year: q(".fe-cy", r).value, no: q(".fe-cno", r).value, img: ((C.ed.certs || [])[i] || {}).img || "" }));
  E.showPhone = !!(q("#fe-sp") && q("#fe-sp").classList.contains("on")); E.phone = v("fe-phone");
}
function paintEditor(){
  const E = C.ed, cur = C.edCur;
  const ps = L.perSession({ prices: E.prices });
  const per = k=> ps[k] ? `≈ ${mk(ps[k])}/buổi${L.packSaving({ prices:E.prices }, k) ? ` · tiết kiệm ${L.packSaving({ prices:E.prices }, k)}%` : ""}` : "";
  const html = `<div class="sheet-handle"></div><div class="sheet-header"><h3>${cur ? "Sửa niêm yết Tìm PT" : "Niêm yết hồ sơ Tìm PT"}</h3><button class="icon-btn" data-fe="close" aria-label="Đóng">${ic("close")}</button></div>
    ${cur ? `<p class="fp-status ${cur.hidden ? "bad" : cur.status === "public" ? "ok" : ""}">${cur.hidden ? `${ic("fp_eye_off")}Đang bị ẩn khỏi Tìm PT · Lý do: ${esc(cur.hiddenReason || "—")}` : cur.status === "public" ? `${ic("visibility")}Đang hiển thị công khai${cur.verified ? " · Đã xác minh" : ""}` : `${ic("edit")}Bản nháp — chưa hiển thị`}</p>` : `<p class="small-note">Học viên mới sẽ thấy album, bảng giá, địa điểm và đánh giá của bạn. Mọi thông tin đều <b>công khai</b>, hãy ghi đúng sự thật.</p>`}
    <div class="fp-ed">
      <section><h4>${ic("photo_library")}Ảnh bìa & album <small>(3–9 ảnh)</small></h4>
        <div class="fp-ed-cover">${E.cover ? `<div class="fp-ed-ph big"><img src="${url(E.cover)}" alt="Ảnh bìa"><button type="button" data-fe="cover" aria-label="Đổi ảnh bìa">${ic("photo_camera")}</button></div>` : `<button type="button" class="fp-addph big" data-fe="cover">${ic("photo_camera")}<span>Ảnh bìa (dọc, nửa người)</span></button>`}</div>
        <div class="fp-ed-album">${(E.album || []).map((a, i)=> `<div class="fp-ed-ph"><img src="${url(a.thumb || a.src)}" alt=""><button type="button" data-fe="rmal" data-i="${i}" aria-label="Bỏ ảnh">${ic("close")}</button><button type="button" class="mk" data-fe="mkcover" data-i="${i}">Làm bìa</button></div>`).join("")}${(E.album || []).length < 9 ? `<button type="button" class="fp-addph" data-fe="addal">${ic("add")}<span>Thêm ảnh</span></button>` : ""}</div>
        <p class="fp-hint">Ảnh buổi tập, nơi tập, kết quả học viên (đã xin phép). Ảnh được nén còn ~${cloud.mode === "firebase" ? "960" : "720"} px. Không dùng ảnh lấy trên mạng không phải của bạn.</p></section>
      <section><h4>${ic("badge")}Thông tin</h4>
        <label class="field"><span class="fp-lbl">Tên hiển thị *</span><input id="fe-name" maxlength="60" value="${esc(E.name)}"></label>
        <label class="field"><span class="fp-lbl">Thương hiệu / tên lớp</span><input id="fe-brand" maxlength="80" value="${esc(E.brandName)}" placeholder="VD: Khang Strength Lab"></label>
        <div class="fp-two"><div class="field"><span class="fp-lbl">Giới tính *</span><div class="fp-seg">${[["male","Nam"],["female","Nữ"]].map(([k, l])=> `<button type="button" class="${E.gender === k ? "on" : ""}" data-fe-g="${k}">${l}</button>`).join("")}</div></div>
        <label class="field"><span class="fp-lbl">Năm kinh nghiệm</span><input id="fe-years" type="number" inputmode="numeric" min="0" max="60" value="${esc(E.years)}"></label></div>
        <div class="field"><span class="fp-lbl">Chuyên môn * (tối đa 6)</span><div class="fp-chipwrap">${D.SPECS.map(s=> `<button type="button" class="fp-chip sm ${(E.specs || []).includes(s) ? "on" : ""}" data-fe-spec="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>
        <label class="field"><span class="fp-lbl">Giới thiệu (≤ 800 ký tự)</span><textarea id="fe-bio" rows="4" maxlength="800" placeholder="Bạn giúp ai, theo cách nào, kết quả điển hình…">${esc(E.bio)}</textarea></label>
        <div class="field"><span class="fp-lbl">Ngôn ngữ</span><div class="fp-chipwrap">${Object.keys(D.LANGS).map(k=> `<button type="button" class="fp-chip sm ${(E.langs || []).includes(k) ? "on" : ""}" data-fe-lang="${k}">${esc(D.LANGS[k])}</button>`).join("")}</div></div></section>
      <section><h4>${ic("location_on")}Khu vực & địa điểm</h4>
        <label class="field"><span class="fp-lbl">Tỉnh / thành *</span><select id="fe-prov"><option value="">Chọn…</option>${provOptions(E.prov)}</select></label>
        <div class="fp-two"><label class="field"><span class="fp-lbl">Phường / xã</span><input id="fe-ward" list="fe-wards" maxlength="80" value="${esc(E.ward)}" placeholder="VD: Phường Cầu Giấy"><datalist id="fe-wards">${(E.prov ? wardsOf(E.prov) : []).map(w=> `<option value="${esc(w)}">`).join("")}</datalist></label>
        <label class="field"><span class="fp-lbl">Tên gọi quen</span><input id="fe-hint" maxlength="80" value="${esc(E.areaHint)}" placeholder="VD: Q. Cầu Giấy cũ"></label></div>
        <div class="fe-places">${(E.places || []).map((p, i)=> `<div class="fe-place"><select aria-label="Loại địa điểm">${Object.keys(D.PLACE_TYPES).map(k=> `<option value="${k}" ${p.type === k ? "selected" : ""}>${esc(D.PLACE_TYPES[k].label)}</option>`).join("")}</select><input class="fe-pn" maxlength="80" value="${esc(p.name)}" placeholder="Tên phòng tập / nền tảng / công viên"><input class="fe-pt" maxlength="120" value="${esc(p.note)}" placeholder="Ghi chú: khu vực, bán kính đến nhà…"><button type="button" class="icon-btn" data-fe="rmplace" data-i="${i}" aria-label="Bỏ địa điểm">${ic("delete")}</button></div>`).join("")}</div>
        ${(E.places || []).length < 6 ? `<button type="button" class="btn btn-soft btn-sm" data-fe="addplace">${ic("add")}Thêm địa điểm</button>` : ""}</section>
      <section><h4>${ic("payments")}Bảng giá công khai (đồng)</h4>
        <div class="fp-two"><label class="field"><span class="fp-lbl">Buổi lẻ *</span><input id="fe-single" type="number" inputmode="numeric" step="10000" min="50000" value="${esc(E.prices.single)}" placeholder="350000"></label>
        <label class="field"><span class="fp-lbl">Online / buổi</span><input id="fe-online" type="number" inputmode="numeric" step="10000" value="${esc(E.prices.online)}" placeholder="0 = không nhận"></label></div>
        <div class="fp-two"><label class="field"><span class="fp-lbl">Gói 12 buổi</span><input id="fe-p12" type="number" inputmode="numeric" step="50000" value="${esc(E.prices.pack12)}"><small class="fp-per">${per("pack12")}</small></label>
        <label class="field"><span class="fp-lbl">Gói 24 buổi</span><input id="fe-p24" type="number" inputmode="numeric" step="50000" value="${esc(E.prices.pack24)}"><small class="fp-per">${per("pack24")}</small></label></div>
        <div class="fp-two"><label class="field"><span class="fp-lbl">Buổi thử</span><select id="fe-trialm"><option value="free" ${E.prices.trial === 0 ? "selected" : ""}>Miễn phí</option><option value="paid" ${Number(E.prices.trial) > 0 ? "selected" : ""}>Có phí</option><option value="none" ${E.prices.trial == null || E.prices.trial === "" ? "selected" : ""}>Không nhận</option></select></label>
        <label class="field"><span class="fp-lbl">Giá buổi thử</span><input id="fe-trial" type="number" inputmode="numeric" step="10000" value="${Number(E.prices.trial) > 0 ? esc(E.prices.trial) : ""}" ${Number(E.prices.trial) > 0 ? "" : "disabled"}></label></div>
        <div class="field"><span class="fp-lbl">Chính sách huỷ *</span><div class="fp-radios">${Object.keys(D.CANCEL).map(k=> `<label><input type="radio" name="fe-cancel" value="${k}" ${E.cancel === k ? "checked" : ""}><span><b>${esc(D.CANCEL[k].label)}</b> — ${esc(D.CANCEL[k].text)}</span></label>`).join("")}</div></div>
        <label class="field"><span class="fp-lbl">Ghi chú thêm về huỷ / bảo lưu</span><input id="fe-cnote" maxlength="300" value="${esc(E.cancelNote)}"></label></section>
      <section><h4>${ic("calendar_month")}Lịch trống</h4>
        <div class="fp-avail edit">${`<div class="fp-av-r head"><span></span>${D.SLOTS.map(([k, label, time])=> `<span>${label}<small>${time}</small></span>`).join("")}</div>` + D.DAYS.map(d=> `<div class="fp-av-r"><span class="fp-av-l">${d}</span>${D.SLOTS.map(([k, label])=>{ const on = String((E.avail || {})[d] || "").split(",").includes(k); return `<button type="button" class="${on ? "on" : ""}" data-fe-av="${d}:${k}" aria-pressed="${on}" aria-label="${d} ${label}"></button>`; }).join("")}</div>`).join("")}</div>
        <p class="fp-hint">Chạm ô để bật/tắt khung giờ bạn nhận học viên.</p></section>
      <section><h4>${ic("workspace_premium")}Chứng chỉ</h4>
        ${(E.certs || []).map((c, i)=> `<div class="fe-cert"><div class="fp-two"><input class="fe-cn" maxlength="120" value="${esc(c.name)}" placeholder="Tên chứng chỉ" aria-label="Tên chứng chỉ"><input class="fe-ci" maxlength="120" value="${esc(c.issuer)}" placeholder="Đơn vị cấp" aria-label="Đơn vị cấp"></div>
          <div class="fp-two"><input class="fe-cy" type="number" inputmode="numeric" value="${esc(c.year || "")}" placeholder="Năm" aria-label="Năm cấp"><input class="fe-cno" maxlength="60" value="${esc(c.no || "")}" placeholder="Số hiệu (để admin đối chiếu)" aria-label="Số hiệu"></div>
          <div class="fe-cact">${c.img ? `<img src="${url(c.img)}" alt="">` : ""}<button type="button" class="btn btn-soft btn-sm" data-fe="certimg" data-i="${i}">${ic("photo_camera")}${c.img ? "Đổi ảnh" : "Ảnh chứng chỉ"}</button><button type="button" class="icon-btn" data-fe="rmcert" data-i="${i}" aria-label="Bỏ chứng chỉ">${ic("delete")}</button></div></div>`).join("")}
        ${(E.certs || []).length < 6 ? `<button type="button" class="btn btn-soft btn-sm" data-fe="addcert">${ic("add")}Thêm chứng chỉ</button>` : ""}
        <p class="fp-hint">Ảnh chứng chỉ hiển thị công khai (che số CCCD nếu có). Huy hiệu "Đã xác minh" do quản trị viên TapEasy gắn sau khi đối chiếu.</p>
        ${G.cloudAdmin && cloudAdmin.requestVerify && !(cur && cur.verified) ? `<button type="button" class="btn btn-outline btn-sm" data-fe="verify">${ic("fp_verified")}Gửi yêu cầu xác minh</button>` : ""}</section>
      <section class="fp-row2"><div><h4>${ic("call")}Hiện số điện thoại công khai</h4><p class="fp-hint">Mặc định tắt — học viên nhắn qua TapEasy.</p></div><button type="button" class="toggle ${E.showPhone ? "on" : ""}" id="fe-sp" data-fe="sp" role="switch" aria-checked="${!!E.showPhone}" aria-label="Hiện số điện thoại"></button></section>
      ${E.showPhone ? `<label class="field"><span class="fp-lbl">Số điện thoại / Zalo</span><input id="fe-phone" maxlength="20" inputmode="tel" value="${esc(E.phone)}"></label>` : ""}
    </div>
    <p class="auth-err" id="fe-err" role="alert"></p>
    <div class="fp-sheetbar col"><div><button type="button" class="btn btn-outline" data-fe="draft">Lưu nháp</button><button type="button" class="btn btn-primary" data-fe="publish">${ic("visibility")}${cur && cur.status === "public" ? "Lưu & hiển thị" : "Đăng công khai"}</button></div>
      ${cur ? `<div><button type="button" class="btn btn-ghost btn-sm" data-fe="preview">${ic("visibility")}Xem hồ sơ</button><button type="button" class="btn btn-ghost btn-sm" data-fe="delete">${ic("delete")}Gỡ niêm yết</button></div>` : ""}</div>`;
  const sh = q("#sheet-content");
  if(!q("#sheet-backdrop").classList.contains("open")) openSheet("");
  const y = sh.scrollTop; sh.innerHTML = html; sh.scrollTop = y;
  sh.onclick = onEditorClick;
  const prov = q("#fe-prov"); if(prov) prov.onchange = ()=>{ edRead(); paintEditor(); };
  const tm = q("#fe-trialm"); if(tm) tm.onchange = ()=>{ const t = q("#fe-trial"); t.disabled = tm.value !== "paid"; if(tm.value !== "paid") t.value = ""; };
  ["fe-p12","fe-p24","fe-single"].forEach(id=>{ const el = q("#" + id); if(el) el.addEventListener("change", ()=>{ edRead(); paintEditor(); }); });
}
async function onEditorClick(e){
  const b = e.target.closest ? e.target.closest("button") : null; if(!b) return;
  const E = C.ed;
  if(b.dataset.fe === "close") return closeSheet();
  edRead();
  const max = cloud.mode === "firebase" ? 960 : 720;
  if(b.dataset.feG){ E.gender = b.dataset.feG; return paintEditor(); }
  if(b.dataset.feSpec){ const s = b.dataset.feSpec; E.specs = E.specs || []; const i = E.specs.indexOf(s); if(i >= 0) E.specs.splice(i, 1); else if(E.specs.length < 6) E.specs.push(s); else say("Tối đa 6 chuyên môn", "info"); return paintEditor(); }
  if(b.dataset.feLang){ const s = b.dataset.feLang; E.langs = E.langs || []; const i = E.langs.indexOf(s); if(i >= 0) E.langs.splice(i, 1); else E.langs.push(s); return paintEditor(); }
  if(b.dataset.feAv){ const [d, k] = b.dataset.feAv.split(":"); E.avail = E.avail || {}; const set = new Set(String(E.avail[d] || "").split(",").filter(Boolean)); if(set.has(k)) set.delete(k); else set.add(k); E.avail[d] = D.SLOTS.map(s=> s[0]).filter(x=> set.has(x)).join(","); b.classList.toggle("on", set.has(k)); b.setAttribute("aria-pressed", String(set.has(k))); return; }
  const k = b.dataset.fe, i = Number(b.dataset.i);
  if(k === "sp"){ E.showPhone = !E.showPhone; return paintEditor(); }
  if(k === "cover") return pickFiles(false, async f=>{ if(!f[0]) return; try{ E.cover = await P.compressImage(f[0], { max, q:0.74 }); E.coverThumb = E.cover; E.coverCredit = {}; paintEditor(); }catch(err){ say(err.message, "error"); } });
  if(k === "addal") return pickFiles(true, async files=>{ for(const f of files.slice(0, 9 - (E.album || []).length)){ try{ const src = await P.compressImage(f, { max, q:0.72 }); (E.album = E.album || []).push({ src, thumb: src }); }catch(err){ say(err.message, "error"); } } paintEditor(); });
  if(k === "rmal"){ E.album.splice(i, 1); return paintEditor(); }
  if(k === "mkcover"){ const a = E.album[i]; if(a){ if(E.cover) E.album[i] = { src:E.cover, thumb:E.coverThumb || E.cover, by:(E.coverCredit||{}).by || "", link:(E.coverCredit||{}).link || "" }; else E.album.splice(i, 1); E.cover = a.src; E.coverThumb = a.thumb || a.src; E.coverCredit = { by:a.by || "", link:a.link || "" }; } return paintEditor(); }
  if(k === "addplace"){ (E.places = E.places || []).push({ type:"online", name:"", note:"" }); return paintEditor(); }
  if(k === "rmplace"){ E.places.splice(i, 1); return paintEditor(); }
  if(k === "addcert"){ (E.certs = E.certs || []).push({ name:"", issuer:"", year:"", no:"", img:"" }); return paintEditor(); }
  if(k === "rmcert"){ E.certs.splice(i, 1); return paintEditor(); }
  if(k === "certimg") return pickFiles(false, async f=>{ if(!f[0]) return; try{ E.certs[i].img = await P.compressImage(f[0], { max:640, q:0.7 }); paintEditor(); }catch(err){ say(err.message, "error"); } });
  if(k === "verify"){ const c = (E.certs || [])[0]; if(!c || !c.name){ q("#fe-err").textContent = "Thêm ít nhất 1 chứng chỉ (tên + đơn vị cấp) trước khi gửi xác minh."; return; }
    busy(b, true); try{ await cloudAdmin.requestVerify({ certName:c.name, certNo:c.no, issuer:c.issuer, years:E.years, note:"Gửi từ niêm yết Tìm PT" }); say("Đã gửi yêu cầu xác minh", "fp_verified"); }catch(err){ say(err.message, "error"); } busy(b, false); return; }
  if(k === "preview"){ closeSheet(); return openListing(myUid(), {}); }
  if(k === "delete") return confirmDialog("Gỡ niêm yết?", "Hồ sơ biến mất khỏi Tìm PT. Đánh giá của học viên vẫn được giữ và hiện lại nếu bạn niêm yết lại.", async ()=>{ try{ await P.deleteMyListing(); say("Đã gỡ niêm yết", "delete"); C.myListing = null; await load(true); afterListingSaved(); }catch(err){ say(err.message, "error"); } }, "Gỡ", "delete");
  if(k === "draft" || k === "publish"){
    const input = Object.assign({}, E, { prices: { single: Number(E.prices.single)||0, pack12: Number(E.prices.pack12)||0, pack24: Number(E.prices.pack24)||0, online: Number(E.prices.online)||0, trial: E.prices.trial === null ? null : Number(E.prices.trial)||0 } });
    const err = q("#fe-err");
    const bad = L.validateListing(Object.assign({ status:"public" }, input, { album:(input.album || []) }));
    if(bad && k === "publish"){ err.textContent = bad; err.scrollIntoView && err.scrollIntoView({ block:"center" }); return; }
    busy(b, true, "Đang lưu...");
    try{ const saved = await P.saveMyListing(input, { draft: k === "draft" }); C.myListing = saved; closeSheet(); say(k === "draft" ? "Đã lưu nháp" : "Hồ sơ đã hiển thị trên Tìm PT", "storefront"); await load(true); afterListingSaved(); }
    catch(e2){ busy(b, false); err.textContent = e2.message; }
  }
}
function afterListingSaved(){
  if(isActive("screen-findpt")) render();
  try{ if(isActive("screen-coach") && typeof renderCoachScreen === "function") renderCoachScreen(false); }catch(e){}
  try{ if(G.teHomeExplore) G.teHomeExplore.refresh(); }catch(e){}
}

/* ---------------------------------------------------------------------
   8. FORM HỌC VIÊN: NHẬN XÉT 2 CHIỀU, MẶC ĐỊNH RIÊNG TƯ
   --------------------------------------------------------------------- */
function openWhyPrivate(){
  openSheet(`<div class="sheet-header"><h3>Vì sao nhận xét học viên là riêng tư?</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
  <div class="fp-policy">
    <p>Đánh giá <b>PT</b> thì công khai, vì học viên cần thông tin để chọn người dạy và trả tiền. Nhận xét về <b>học viên</b> thì khác:</p>
    <ul><li><b>Dữ liệu nhạy cảm:</b> nhận xét thường gắn với cơ thể, sức khoẻ, cân nặng, chấn thương — loại dữ liệu cần bảo vệ theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.</li>
      <li><b>Cán cân quyền lực:</b> PT có nhiều học viên; một nhận xét công khai tiêu cực có thể khiến học viên bị PT khác từ chối hoặc kỳ thị (ví dụ người thừa cân, người mới).</li>
      <li><b>Thẳng thắn hơn:</b> khi riêng tư, PT góp ý cụ thể, mang tính xây dựng; học viên có quyền đọc và phản hồi.</li></ul>
    <p>Học viên <b>tự quyết</b>: bật "Cho phép đính kèm" thì có thể gửi kèm <b>tóm tắt điểm</b> (không kèm lời nhận xét) khi xin kết nối PT mới — chỉ PT nhận lời mời thấy.</p>
  </div>`);
}
function sfbStarsRow(key, val, editable){
  return `<span class="fp-starin sm" ${editable ? `role="radiogroup"` : ""}>${[1,2,3,4,5].map(v=> editable ? `<button type="button" class="${v <= val ? "on" : ""}" data-sf="${key}" data-v="${v}" aria-label="${v} sao">${STAR}</button>` : `<i class="${v <= val ? "on" : ""}">${STAR}</i>`).join("")}</span>`;
}
async function injectClientFeedback(){
  if(typeof cf === "undefined" || !cf || cf.tab !== "info") return;
  const body = q("#client-content"); if(!body || q("#fp-sfb", body)) return;
  const c = typeof cfClient === "function" ? cfClient() : null; if(!c) return;
  const role = cf.role === "pt" ? "pt" : "student";
  body.insertAdjacentHTML("beforeend", `<div class="card fp-sfb" id="fp-sfb" data-cid="${esc(c.id)}"><div class="card-title">${ic("lock")}${role === "pt" ? "Nhận xét học viên · riêng tư" : "PT nhận xét về bạn · riêng tư"}</div><p class="small-note">Đang tải…</p></div>`);
  let f = null; try{ f = await P.getFeedback(c.id); }catch(e){}
  paintSfb(c, role, f);
}
function paintSfb(c, role, f){
  const box = q("#fp-sfb"); if(!box || box.dataset.cid !== c.id) return;
  const rows = f ? D.SFB.map(([k, label])=> `<div class="fp-sfb-r"><span>${label}</span>${sfbStarsRow(k, Number((f.stars || {})[k]) || 0)}</div>`).join("") : "";
  box.innerHTML = `<div class="card-title">${ic("lock")}${role === "pt" ? "Nhận xét học viên · riêng tư" : "PT nhận xét về bạn · riêng tư"}</div>
    <p class="small-note">Chỉ PT và học viên của form này thấy. <a href="#" data-sfa="why">Vì sao riêng tư?</a></p>
    ${f ? `<div class="fp-sfb-box">${rows}<p>${esc(f.text)}</p><small>${esc(f.byName || "PT")} · ${esc(dmy(f.at))}</small>
      ${f.reply && f.reply.text ? `<div class="fp-reply"><b>${ic("reply")}Học viên phản hồi</b><small>${esc(dmy(f.reply.at))}</small><p>${esc(f.reply.text)}</p></div>` : ""}</div>` : `<p class="small-note" style="margin-top:6px;">${role === "pt" ? "Chưa có nhận xét. Ghi nhận chuyên cần, nỗ lực, cách trao đổi giúp học viên biết mình cần cải thiện gì." : "PT chưa nhận xét."}</p>`}
    ${role === "pt" ? `<button type="button" class="btn btn-outline btn-sm btn-block" data-sfa="edit" style="margin-top:10px;">${ic("edit")}${f ? "Sửa nhận xét" : "Viết nhận xét"}</button>` : ""}
    ${role === "student" && f ? `${!(f.reply && f.reply.text) ? `<div class="fp-replyin" style="margin-top:10px;"><input id="sfb-rep" maxlength="1000" placeholder="Phản hồi PT (chỉ PT thấy)…" aria-label="Phản hồi PT"><button type="button" class="fp-round sm" data-sfa="reply" aria-label="Gửi">${ic("send")}</button></div>` : ""}
      <div class="fp-row2" style="margin-top:10px;"><div><b style="font-size:13px;">Cho phép đính kèm tóm tắt điểm</b><p class="fp-hint">Khi bạn xin kết nối PT mới (không kèm lời nhận xét).</p></div><button type="button" class="toggle ${f.shareable ? "on" : ""}" data-sfa="share" role="switch" aria-checked="${!!f.shareable}" aria-label="Cho phép đính kèm tóm tắt"></button></div>` : ""}
    ${role === "student" ? `<button type="button" class="btn btn-soft btn-sm btn-block" data-sfa="review" style="margin-top:10px;">${ic("star")}Đánh giá công khai PT này</button>` : ""}`;
  box.onclick = async e=>{
    const t = e.target.closest ? e.target.closest("[data-sfa]") : null; if(!t) return; e.preventDefault();
    const k = t.dataset.sfa;
    try{
      if(k === "why") return openWhyPrivate();
      if(k === "edit") return openSfbEditor(c, f);
      if(k === "review") return openReviewComposer(c.ptId);
      if(k === "reply"){ const v = q("#sfb-rep").value; busy(t, true, "…"); const nf = await P.replyFeedback(c.id, v); say("Đã gửi phản hồi cho PT", "reply"); paintSfb(c, role, nf); }
      if(k === "share"){ const nf = await P.setFeedbackShareable(c.id, !f.shareable); say(nf.shareable ? "Đã cho phép đính kèm tóm tắt" : "Đã tắt đính kèm", "lock"); paintSfb(c, role, nf); }
    }catch(err){ busy(t, false); say(err.message, "error"); }
  };
}
function openSfbEditor(c, f){
  const S = { stars: Object.assign({ attendance:0, effort:0, comms:0 }, (f || {}).stars || {}), text: (f || {}).text || "" };
  const paint = ()=>{
    q("#sheet-content").innerHTML = `<div class="sheet-handle"></div><div class="sheet-header"><h3>Nhận xét ${esc(c.name || "học viên")}</h3><button class="icon-btn" data-sx="close" aria-label="Đóng">${ic("close")}</button></div>
      <p class="fp-hint">${ic("lock")}Riêng tư: chỉ bạn và học viên thấy. Học viên được phản hồi.</p>
      <div class="fp-rc-crit">${D.SFB.map(([k, label])=> `<div><span>${label}</span>${sfbStarsRow(k, S.stars[k], true)}</div>`).join("")}</div>
      <label class="field"><span class="fp-lbl">Nhận xét (mang tính xây dựng)</span><textarea id="sx-t" rows="4" maxlength="1000" placeholder="Điểm mạnh, điều cần cải thiện, gợi ý cho giai đoạn tới…">${esc(S.text)}</textarea></label>
      <p class="auth-err" id="sx-err"></p><button type="button" class="btn btn-primary btn-block" data-sx="save">Lưu nhận xét</button>`;
  };
  openSheet(""); paint();
  q("#sheet-content").onclick = async e=>{
    const b = e.target.closest ? e.target.closest("button") : null; if(!b) return;
    if(b.dataset.sx === "close") return closeSheet();
    if(b.dataset.sf){ S.text = q("#sx-t").value; S.stars[b.dataset.sf] = Number(b.dataset.v); paint(); return; }
    if(b.dataset.sx === "save"){ S.text = q("#sx-t").value; if(D.SFB.some(([k])=> !S.stars[k])){ q("#sx-err").textContent = "Chấm đủ 3 tiêu chí."; return; }
      busy(b, true, "Đang lưu..."); try{ const nf = await P.saveFeedback(c.id, S); closeSheet(); say("Đã lưu nhận xét riêng tư", "lock"); paintSfb(c, "pt", nf); }catch(err){ busy(b, false); q("#sx-err").textContent = err.message; } }
  };
}

/* ---------------------------------------------------------------------
   9. ĐIỂM VÀO
   --------------------------------------------------------------------- */
FP.open = function(opts){
  opts = opts || {};
  ensureScreen();
  const cur = (q(".screen.active") || {}).id || "";
  if(cur && cur !== "screen-findpt" && cur !== "screen-ptprofile") C.prev = cur.replace("screen-", "");
  goto("findpt");
  if(opts.restore && C.scrollY){ const sc = scroller(); requestAnimationFrame(()=>{ if(sc) sc.scrollTop = C.scrollY; }); }
};
function goBack(){ goto(C.prev && C.prev !== "findpt" && C.prev !== "ptprofile" ? C.prev : "home"); }
function promoHTML(student){
  const list = (C.list || []).slice().sort((a,b)=> (Number(b.ratingCount)||0) - (Number(a.ratingCount)||0)).slice(0, 3);
  return `<button type="button" class="fp-promo" data-fp-promo>
    <div class="fp-promo-ph">${list.map((l, i)=> `<span style="--i:${i};--g1:${gradOf(l.id)[0]};--g2:${gradOf(l.id)[1]}"><img src="${url(l.coverThumb || l.cover)}" alt="" loading="lazy"></span>`).join("")}</div>
    <div class="fp-promo-t"><small>${student ? "Chưa có PT?" : "Tìm PT"}</small><b>Hồ sơ PT công khai</b><span>Lọc theo khu vực, giá, giới tính · đánh giá từ người đã tập cùng</span></div>${ic("chevron_right")}</button>`;
}
async function enhanceCoach(){
  if(!isActive("screen-coach")) return;
  const body = q("#coach-tab-body"); if(!body) return;
  const tab = typeof coachTab !== "undefined" ? coachTab : null;
  // Học viên: thay ô "Tìm & Book PT — Sắp ra mắt"; chưa có PT → đưa lên đầu
  const soon = qa(".card", body).find(c=> /openFindPTSoon/.test(c.getAttribute("onclick") || "") || (q(".soon-badge", c) && /Tìm & Book PT/.test(c.textContent)));
  if(tab === "coaches" || (soon && !amPT())){
    if(!q("[data-fp-promo]", body)){
      const noPT = !((typeof ptData !== "undefined" && ptData && ptData.asStudent) || []).length;
      const html = promoHTML(noPT);
      if(noPT){ const join = q("#btn-join-pt", body); if(join) join.insertAdjacentHTML("beforebegin", html); else body.insertAdjacentHTML("afterbegin", html); if(soon) soon.remove(); }
      else if(soon) soon.outerHTML = html; else body.insertAdjacentHTML("beforeend", html);
    } else if(soon) soon.remove();
  }
  // PT: thay ô "Hồ sơ công khai & nhận book — Sắp ra mắt" bằng ô Niêm yết
  if(tab === "clients" && amPT() && !q("#fp-ptcard", body)){
    const old = qa(".card", body).find(c=> q(".soon-badge", c) && /Hồ sơ công khai/.test(c.textContent));
    let l = C.myListing;
    if(l === undefined){ try{ l = C.myListing = await P.myListing(); }catch(e){ l = null; } }
    if(!isActive("screen-coach") || q("#fp-ptcard", body)) return;
    const html = `<div class="card fp-ptcard" id="fp-ptcard">
      <div class="card-title">${ic("storefront")}Hồ sơ Tìm PT ${l ? (l.hidden ? `<span class="fp-st st-declined">Bị ẩn</span>` : l.status === "public" ? `<span class="fp-st st-accepted">Đang hiển thị</span>` : `<span class="fp-st">Bản nháp</span>`) : ""}</div>
      ${l ? `<p class="small-note">${l.ratingCount ? `${n1(l.ratingAvg)}★ · ${Math.round(Number(l.ratingCount)||0)} đánh giá · ` : "Chưa có đánh giá · "}${l.respRate == null ? "phản hồi: chưa đủ dữ liệu" : `trả lời ${l.respRate}% trong 24 giờ`}${l.verified ? " · Đã xác minh" : ""}</p>`
        : `<p class="small-note">Niêm yết album, bảng giá công khai, địa điểm, lịch trống — học viên mới tìm thấy bạn theo khu vực và đặt buổi thử.</p>`}
      <div class="fp-ptcard-act"><button type="button" class="btn btn-primary btn-sm" data-fpc="editor">${ic(l ? "edit" : "storefront")}${l ? "Sửa niêm yết" : "Niêm yết hồ sơ Tìm PT"}</button>
        <button type="button" class="btn btn-outline btn-sm" data-fpc="inbox">${ic("inbox")}Yêu cầu <i class="fp-badge" data-fp-inbox-n hidden></i></button>
        ${l ? `<button type="button" class="btn btn-ghost btn-sm" data-fpc="view">${ic("visibility")}Xem như học viên</button>` : ""}</div></div>`;
    if(old) old.outerHTML = html; else body.insertAdjacentHTML("beforeend", html);
    paintBadges();
  }
  qa("[data-fp-promo]", body).forEach(b=>{ if(!b._fp){ b._fp = 1; b.addEventListener("click", ()=> FP.open()); } });
  const pc = q("#fp-ptcard", body);
  if(pc && !pc._fp){ pc._fp = 1; pc.addEventListener("click", e=>{ const t = e.target.closest ? e.target.closest("[data-fpc]") : null; if(!t) return; const k = t.dataset.fpc; if(k === "editor") openEditor(); if(k === "inbox") openInbox(); if(k === "view") openListing(myUid(), { from:"coach" }); }); }
}
function injectMenu(){
  const sc = q("#sheet-content"); if(!sc || q("[data-fp-menu]", sc)) return;
  const coach = q(`[onclick*="goto('coach')"]`, sc) || q("[data-cm-menu]", sc); if(!coach) return;
  const anchor = q("[data-cm-menu]", sc) || coach;
  anchor.insertAdjacentHTML("afterend", `<div class="link-row" data-fp-menu role="button" tabindex="0"><div class="left">${ic("travel_explore")}<div><div class="name">Tìm PT</div><div class="sub">Hồ sơ PT công khai · giá, đánh giá thật</div></div></div>${ic("chevron_right")}</div>`);
  const row = q("[data-fp-menu]", sc); if(row) row.addEventListener("click", ()=>{ closeSheet(); FP.open(); });
}
function registerAdmin(){
  const A = G.TE_ADMIN; if(!A || typeof A.registerSection !== "function" || C.adminReg) return;
  C.adminReg = true;
  A.registerSection({ id:"findpt", title:"Tìm PT · đánh giá", icon:"adm_flag", order:45, perms:["reviews.moderate","pt.verify","listings.moderate"], render: async el=>{
    let queue = [], list = [];
    try{ queue = await P.modQueue(); }catch(e){}
    try{ list = await P.list(); }catch(e){}
    el.innerHTML = `<p class="adm-note">Đánh giá PT bị báo cáo (Tìm PT). Chỉ ẩn khi vi phạm — lý do hiển thị công khai. <b>Không ẩn vì chê.</b></p>
      <div class="adm-cards">${queue.map((r, i)=> `<article class="adm-card"><div class="adm-ch"><h3>${esc((C.byId[r.lid] || list.find(x=> x.id === r.lid) || {}).name || r.lid)} · ${Number(r.stars)}★</h3><span class="adm-pill bad">${Number(r.reports)||0} báo cáo</span></div>
        <p class="adm-quote">${esc(String(r.text || "").slice(0, 400))}</p><p class="adm-dim">${esc(L.maskName(r.name))} · ${esc(dmy(r.createdAt))}${r.hidden ? " · đang ẩn" : ""}</p>
        ${can("reviews.moderate") ? `<div class="adm-acts"><button class="adm-btn sm" data-fpa="dismiss" data-i="${i}">Giữ nguyên</button><button class="adm-btn sm" data-fpa="hide" data-i="${i}">Ẩn…</button><button class="adm-btn sm ghost" data-fpa="open" data-i="${i}">Mở hồ sơ</button></div>` : ""}</article>`).join("") || `<p class="adm-dim">Không có đánh giá nào đang bị báo cáo.</p>`}</div>
      <h3 style="margin:16px 0 8px;">Niêm yết (${list.length})</h3>
      <div class="adm-cards">${list.map(l=> `<article class="adm-card"><div class="adm-ch"><h3>${esc(l.name)}${l.seed ? ` <span class="adm-pill">mẫu</span>` : ""}</h3>${l.verified ? `<span class="adm-pill ok">Đã xác minh</span>` : ""}${l.hidden ? `<span class="adm-pill bad">Đang ẩn</span>` : ""}</div>
        <p class="adm-dim">${esc(L.areaText(l))} · từ ${esc(mk(l.priceFrom))} · ${l.ratingCount ? n1(l.ratingAvg) + "★/" + l.ratingCount : "chưa có đánh giá"}</p>
        <div class="adm-acts">${can("pt.verify") ? `<button class="adm-btn sm" data-fpa="verify" data-id="${esc(l.id)}">${l.verified ? "Thu hồi xác minh" : "Xác minh"}</button>` : ""}${can("listings.moderate") ? `<button class="adm-btn sm ghost" data-fpa="hidel" data-id="${esc(l.id)}">${l.hidden ? "Hiện lại" : "Ẩn…"}</button>` : ""}</div></article>`).join("")}</div>`;
    el.onclick = async e=>{
      const b = e.target.closest ? e.target.closest("[data-fpa]") : null; if(!b) return;
      const k = b.dataset.fpa, r = queue[Number(b.dataset.i)];
      try{
        if(k === "dismiss"){ await P.moderateReview(r.lid, r.uid, "dismiss"); }
        if(k === "hide"){ const why = G.prompt ? G.prompt("Lý do ẩn (hiển thị công khai):", "Ngôn từ xúc phạm, quấy rối") : ""; if(!why) return; await P.moderateReview(r.lid, r.uid, "hide", why); }
        if(k === "open"){ try{ A.close(); }catch(err){} openListing(r.lid, { from:"home" }); return; }
        if(k === "verify"){ const l = list.find(x=> x.id === b.dataset.id); await P.setVerified(l.id, !l.verified, "Từ bảng quản trị"); }
        if(k === "hidel"){ const l = list.find(x=> x.id === b.dataset.id); if(!l.hidden){ const why = G.prompt ? G.prompt("Lý do ẩn khỏi Tìm PT (PT thấy):", "") : ""; if(!why) return; await P.setHidden(l.id, true, why); } else await P.setHidden(l.id, false, ""); }
        say("Đã cập nhật", "check"); load(true); A.render();
      }catch(err){ say(err.message, "error"); }
    };
  } });
}
function deepLink(){
  try{
    const s = String(location.search || "") + String(location.hash || "");
    const m = s.match(/[?&#]pt=([A-Za-z0-9_-]{3,64})/);
    const open = m ? ()=> openListing(m[1], { from:"findpt" }) : /#findpt\b/.test(s) ? ()=> FP.open() : null;
    if(!open) return;
    let n = 0;
    const tick = ()=>{ n++; const auth = q("#auth"); if((auth && auth.classList.contains("open")) || !(typeof state !== "undefined" && state && state.onboarded)){ if(n < 60) setTimeout(tick, 500); return; }
      try{ history.replaceState(null, "", location.pathname); }catch(e){} open(); };
    setTimeout(tick, 600);
  }catch(e){}
}

/* ---------------------------------------------------------------------
   10. CÀI ĐẶT
   --------------------------------------------------------------------- */
function install(){
  addIcons();
  st();
  ensureScreen();
  // App Store 1.2: chặn / bỏ chặn → vẽ lại album (ẩn PT đã chặn), huy hiệu yêu cầu
  try{ document.addEventListener("fk:blocks-changed", ()=>{ try{ if(isActive("screen-findpt")) renderAlbum(); C._badgeAt = 0; paintBadges(true); }catch(e){ warn("block", e); } }); }catch(e){}
  // goto: vẽ màn Tìm PT · bỏ cuộn "gần" khi rời hồ sơ · đóng trình xem ảnh
  if(typeof goto === "function"){
    const _g = goto;
    goto = function(screen){
      if(screen === "findpt"){ ensureScreen(); const cur = (q(".screen.active") || {}).id || ""; if(cur && cur !== "screen-findpt" && cur !== "screen-ptprofile") C.prev = cur.replace("screen-", ""); }
      if(screen !== "ptprofile"){ const sc = scroller(); if(sc) sc.classList.remove("fp-prox"); }
      closeLightbox();
      const restore = screen === "findpt" && (q(".screen.active") || {}).id === "screen-ptprofile";
      const r = _g.apply(this, arguments);
      if(screen === "findpt"){ try{ render(); if(!C.list || Date.now() - (C.loadedAt || 0) > 60000){ C.loadedAt = Date.now(); load(true).then(()=>{ if(isActive("screen-findpt")) { const y = (scroller() || {}).scrollTop || 0; render(); const sc = scroller(); if(sc) sc.scrollTop = y; } }); } if(restore && C.scrollY){ const sc = scroller(); if(sc) sc.scrollTop = C.scrollY; } }catch(e){ warn("render", e); } }
      return r;
    };
  }
  // Sheet dùng chung: bỏ trình bắt sự kiện của sheet trước (findpt gán onclick cho #sheet-content)
  if(typeof openSheet === "function"){
    const _os = openSheet;
    openSheet = function(){ try{ const sc = q("#sheet-content"); if(sc) sc.onclick = null; }catch(e){} return _os.apply(this, arguments); };
  }
  // Hồ sơ PT thật (mở từ màn PT / hub học viên): thêm Đánh giá & phản hồi (+ niêm yết nếu có)
  if(typeof openPTProfile === "function"){
    const _o = openPTProfile;
    openPTProfile = async function(ptId, cid, opts){
      if(P.isSeed(ptId) || (opts && opts.listing)) return openListing(ptId, opts || {});
      C.ctx = null;
      try{ const pc = q("#pp-content"); if(pc) pc.classList.remove("fp-has-dock"); }catch(e){}
      const r = await _o.apply(this, arguments);
      try{ if(isActive("screen-ptprofile")) await decorateReal(ptId, cid); }catch(e){ warn("decorateReal", e); }
      return r;
    };
  }
  // Ô "Tìm PT — Sắp ra mắt" → mở album
  try{ if(typeof openFindPTSoon === "function") openFindPTSoon = function(){ FP.open(); }; }catch(e){}
  try{
    if(G.teHomeExplore && typeof G.teHomeExplore.add === "function"){
      G.teHomeExplore.add({ id:"findpt", title:"Tìm PT", icon:"travel_explore", color:"#FFB08A", priority:98,   // vòng 3: đứng đầu hàng Khám phá
        sub: ()=> C.list && C.list.length ? `${C.list.filter(l=> !l.hidden && l.status === "public").length} PT · giá công khai` : "Hồ sơ PT công khai", onClick: ()=> FP.open() });
    }
  }catch(e){ warn("explore", e); }
  if(typeof renderHomeScreen === "function"){
    const _h = renderHomeScreen;
    renderHomeScreen = function(){ const r = _h.apply(this, arguments); try{ const t = q('#home-content .entry-tile[onclick*="openFindPTSoon"] .soon-badge'); if(t){ t.classList.remove("soon-badge"); t.textContent = "Hồ sơ PT công khai"; } }catch(e){} return r; };
  }
  // Màn PT
  if(typeof renderCoachScreen === "function"){
    const _c = renderCoachScreen;
    renderCoachScreen = function(){ const r = _c.apply(this, arguments); try{ enhanceCoach(); }catch(e){ warn("coach", e); } return r; };
  }
  if(typeof renderClientForm === "function"){
    const _f = renderClientForm;
    renderClientForm = function(){ const r = _f.apply(this, arguments); try{ injectClientFeedback(); }catch(e){ warn("client", e); } return r; };
  }
  // Vai trò "Tìm & Book PT" khi đăng ký
  if(typeof showAuth === "function"){
    const _s = showAuth;
    showAuth = function(view){ const r = _s.apply(this, arguments); try{ if(view === "role"){ const c = q('[data-role="find"]'); if(c){ c.classList.remove("soon"); const b = q(".soon-badge", c); if(b) b.remove(); const sub = q(".sub", c); if(sub) sub.textContent = "Xem hồ sơ PT công khai, lọc theo khu vực, giá, giới tính; đặt buổi thử."; } } }catch(e){} return r; };
  }
  if(typeof pickRole === "function"){
    const _p = pickRole;
    pickRole = function(role){ if(role === "find"){ try{ state._fpOpenAfterBoot = true; saveState(); }catch(e){} return _p.call(this, "self"); } return _p.apply(this, arguments); };
  }
  ["finishBoot","afterFirstOnboarding"].forEach(fn=>{
    try{ if(typeof G[fn] === "function"){ const _x = G[fn]; G[fn] = function(){ const r = _x.apply(this, arguments); try{ if(state._fpOpenAfterBoot && state.onboarded){ delete state._fpOpenAfterBoot; saveState(); setTimeout(()=> FP.open(), 350); } }catch(e){} return r; }; } }catch(e){}
  });
  // Nút Back Android / Esc
  if(typeof fkHandleBack === "function"){
    const _b = fkHandleBack;
    fkHandleBack = function(){
      try{
        if(q("#fp-lb")){ closeLightbox(); return true; }
        const sb = q("#sheet-backdrop"); const open = sb && sb.classList.contains("open");
        if(!open && isActive("screen-findpt")){ goBack(); return true; }
        if(!open && isActive("screen-ptprofile") && C.ctx && C.ctx.from){ goBackFromProfile(); return true; }
      }catch(e){}
      return _b.apply(this, arguments);
    };
  }
  // Nguồn ảnh trong "Nguồn dữ liệu & bản quyền"
  if(typeof openCreditsSheet === "function"){
    const _cr = openCreditsSheet;
    openCreditsSheet = function(){ const r = _cr.apply(this, arguments); try{ const p = q("#sheet-content .policy-text"); if(p && !q("[data-fp-cr]", p)) p.insertAdjacentHTML("beforeend", `<p data-fp-cr><b>Ảnh hồ sơ PT minh hoạ (Tìm PT):</b> ${fpAi() ? "Ảnh minh hoạ tạo bằng AI (nhân vật không có thật); ảnh chưa có bản AI: " : ""}Pexels (pexels.com), theo Pexels License; tên tác giả hiển thị dưới từng ảnh. Người trong ảnh là người mẫu, không phải PT trong hồ sơ minh hoạ.</p>`); }catch(e){} return r; };
  }
  try{ document.addEventListener("click", e=>{ const t = e.target; if(t && t.closest && t.closest(".btn-menu-trigger, .btn-menu-trigger-nu")) setTimeout(()=>{ try{ injectMenu(); }catch(err){} }, 0); }, true); }catch(e){}
  // (QU-05 / QP-23) không còn nghe "scroll" cho parallax — cuộn album/hồ sơ không chạy JS mỗi khung
  try{ G.addEventListener("ptdir:request", ()=>{ C._badgeAt = 0; paintBadges(true).then(()=>{ say("PT vừa trả lời yêu cầu của bạn", "forum"); }); const mr = q("#mr-box"); if(mr && q("#sheet-backdrop").classList.contains("open")) openMyRequests(); }); }catch(e){}
  try{ cloud.onAuth(()=>{ C.myListing = undefined; C.myReqs = []; C.inbox = []; C.rv = {}; load(true); }); }catch(e){}
  registerAdmin(); try{ G.addEventListener("load", registerAdmin); setTimeout(registerAdmin, 1500); }catch(e){}
  load().then(()=>{ try{ if(isActive("screen-findpt")) render(); }catch(e){} });
  deepLink();
  // Module nạp sau appBoot(): vẽ lại màn đang mở
  try{ const a = q(".screen.active"); if(a && a.id === "screen-coach" && typeof renderCoachScreen === "function") renderCoachScreen(false); if(a && a.id === "screen-home" && typeof renderHomeScreen === "function") renderHomeScreen(); }catch(e){}
  return true;
}

Object.assign(FP, { render, load, openListing, openFilters, openSort, openHow, openEditor, openInbox, openMyRequests, openReviewComposer, openTrialSheet, openConnectSheet,
  openQuestionSheet, openLightbox, closeLightbox, decorateProfile, injectClientFeedback, visibleList, cardHTML, albumHTML, state: st, _C: C, _paintEditor: paintEditor });
G.TEFindPT = FP;
try{ FP.installed = install(); }catch(e){ warn("không cài được", e); }
})(typeof window !== "undefined" ? window : globalThis);

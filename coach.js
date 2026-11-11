/* =========================================================================
   TapEasy v2 — Khu PT ↔ Học viên
   - Màn hình "PT": danh sách học viên (vai trò PT) + PT của tôi (vai trò học viên)
   - Form quản lý riêng từng học viên, 7 mục:
     Thông tin · Buổi này tập gì · Thời khoá biểu · Lịch sử · Nhắc nhở · Ghi chú · Tiến độ
   Nạp SAU app.js, TRƯỚC pt.js (dùng hàm tiện ích của pt.js khi chạy, không khi nạp).
   ========================================================================= */

/* ---------------------------------------------------------------------
   1. BỘ NHỚ ĐỆM DỮ LIỆU PT
   --------------------------------------------------------------------- */
/* Loại ghi chú hợp lệ (whitelist — trường "kind" do tài khoản khác ghi, không được chèn thô vào class) */
const NOTE_KINDS = ["note","reminder","feedback"];
const EMPTY_PT = ()=>({ loaded:false, loading:null, at:0, error:null, asPT:[], asStudent:[], sessions:{}, notes:{} });
let ptData = EMPTY_PT();

function resetCoachData(){ ptData = EMPTY_PT(); coachTab = null; ptData.loaded = true; state.coachUpcoming = []; saveState(); updateCoachBadge(); }

function refreshCoachData(force){
  if(!cloud.isLoggedIn()){ resetCoachData(); return Promise.resolve(); }
  if(ptData.loading) return ptData.loading;
  if(!force && Date.now()-ptData.at < 30000) return Promise.resolve();
  ptData.loading = (async ()=>{
    try{
      const [asPT, asStudent] = await Promise.all([cloud.myClientsAsPT(), cloud.myCoaches()]);
      const sessions = {}, notes = {};
      await Promise.all([...asPT, ...asStudent].map(async c=>{
        const [s, n] = await Promise.all([cloud.listSessions(c.id), cloud.listNotes(c.id)]);
        sessions[c.id] = s; notes[c.id] = n;
      }));
      Object.assign(ptData, { asPT, asStudent, sessions, notes, loaded:true, at:Date.now(), error:null });
      rebuildCoachUpcoming();
      if(typeof ppSyncMyStats==="function") ppSyncMyStats();
    }catch(e){ ptData.error = e.message; ptData.loaded = true; }
    finally{
      ptData.loading = null; updateCoachBadge();
      const active = $(".screen.active");
      if(active && active.id==="screen-coach") renderCoachScreen(false);
      if(active && active.id==="screen-home") renderHomeScreen();
    }
  })();
  return ptData.loading;
}

/* Danh sách buổi sắp tới (30 ngày) — lưu vào state để nhắc kể cả khi offline */
function rebuildCoachUpcoming(){
  const out = [], now = Date.now(), limit = now + 30*86400000;
  const add = (c, role)=> (ptData.sessions[c.id]||[]).forEach(s=>{
    if(s.status!=="scheduled") return;
    const t = sessStart(s).getTime();
    if(t < now - 3*3600000 || t > limit) return;
    out.push({ cid:c.id, sid:s.id, role, date:s.date, time:s.time||"00:00", title:s.title||"", mode:s.mode,
      who: role==="pt" ? c.name : (c.ptName||"PT"), before: c.remindBefore || 60 });
  });
  ptData.asPT.forEach(c=> add(c, "pt"));
  ptData.asStudent.forEach(c=> add(c, "student"));
  state.coachUpcoming = out.sort((a,b)=> sessStart(a)-sessStart(b));
  saveState();
}

/* Số mục mới chưa xem cho 1 form */
function unreadFor(c, role){
  if(FKBlock.is(coachPeerOf(c, role))) return 0;          // App Store 1.2: không báo tin mới từ người đã chặn
  const other = role==="pt" ? "student" : "pt";
  const seen = state.coachSeen[c.id] || 0;
  let n = (ptData.notes[c.id]||[]).filter(x=> x.authorRole===other && (x.ts||0) > seen).length;
  if(role==="student") n += (ptData.sessions[c.id]||[]).filter(s=> s.status==="scheduled" && s.seenByStudent===false).length;
  return n;
}
function updateCoachBadge(){
  const dot = $("#nav-coach-dot"); if(!dot) return;
  const total = ptData.asPT.reduce((a,c)=>a+unreadFor(c,"pt"),0) + ptData.asStudent.reduce((a,c)=>a+unreadFor(c,"student"),0);
  dot.style.display = total ? "block" : "none";
}

function nextSessionOf(cid){
  const list = (ptData.sessions[cid]||[]).filter(s=>s.status==="scheduled");
  const now = Date.now() - 3*3600000;
  return list.find(s=> sessStart(s).getTime() >= now) || null;
}
function doneCountOf(cid){ return (ptData.sessions[cid]||[]).filter(s=>s.status==="done").length; }

/* ---------------------------------------------------------------------
   1b. CHẶN NGƯỜI DÙNG (App Store 1.2 · vòng 2 fix-pt)
   API thật trong cloud.js: blockUser(uid, {name, reason}) · unblockUser(uid) · listBlocked() · isBlocked(uid) ·
   isBlockedSync(uid) (đồng bộ, sau khi đã tải listBlocked) · isBlockedBy(a, b).
   - Nút "Chặn người này" (chat pt-connect.js, hồ sơ PT ptprofile.js, yêu cầu Tìm PT findpt.js) → hỏi xác nhận → blockUser.
   - Sau khi chặn: ẩn chat / yêu cầu / hồ sơ của người đó với mình, không nhận tin mới (lọc + bỏ đếm chưa đọc);
     máy chủ (rules blockedBy) / demo (cloud-social, cloud-pt-directory) không cho người bị chặn nhắn tin, gửi yêu cầu cho mình.
   - "Người đã chặn" (màn PT) → Bỏ chặn.
   Nút dùng thuộc tính data-fk-block (bắt sự kiện chung ở document) — không chèn chuỗi người dùng vào onclick.
   --------------------------------------------------------------------- */
const FKBlock = (()=>{
  let list = [], loaded = false, loading = null, who = null;
  const api = ()=> typeof cloud !== "undefined" && cloud && typeof cloud.blockUser === "function" && typeof cloud.listBlocked === "function";
  const meUid = ()=> (cloud && cloud.user && cloud.user.uid) || null;
  const fire = ()=>{ try{ document.dispatchEvent(new CustomEvent("fk:blocks-changed", { detail:{ n: list.length } })); }catch(e){} };
  const ic = n=> `<span class="material-symbols-rounded" aria-hidden="true">${n}</span>`;
  /** Tải danh sách đã chặn của tài khoản hiện tại (làm ấm bộ nhớ đệm cloud.isBlockedSync) */
  function ready(force){
    if(!api() || !cloud.isLoggedIn()){ list = []; loaded = false; who = null; return Promise.resolve(list); }
    if(who !== meUid()){ loaded = false; who = meUid(); }
    if(loaded && !force) return Promise.resolve(list);
    if(loading && !force) return loading;
    loading = cloud.listBlocked().then(l=>{ list = Array.isArray(l) ? l : []; loaded = true; return list; })
      .catch(()=> list).then(r=>{ loading = null; return r; });
    return loading;
  }
  const is = uid=>{ try{ return !!uid && typeof cloud !== "undefined" && typeof cloud.isBlockedSync === "function" && cloud.isBlockedSync(String(uid)); }catch(e){ return false; } };
  async function block(uid, name, where){
    uid = String(uid || ""); name = String(name || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60) || "Người dùng";
    await cloud.blockUser(uid, { name, reason: String(where || "").slice(0, 200) });
    await ready(true); fire(); return true;
  }
  async function unblock(uid){ await cloud.unblockUser(String(uid || "")); await ready(true); fire(); return true; }
  /** Hỏi xác nhận rồi chặn. after(true) khi đã chặn */
  function confirmBlock(uid, name, where, after){
    uid = String(uid || ""); const nm = String(name || "").trim().slice(0, 60) || "người này";
    if(!api()){ toast("Bản này chưa hỗ trợ chặn người dùng", "error"); return; }
    if(!cloud.isLoggedIn()){ if(typeof showAuth === "function") showAuth("login"); return; }
    if(!uid || uid === meUid()) return;
    confirmDialog(`Chặn ${nm}?`,
      `Bạn sẽ không còn thấy tin nhắn, yêu cầu và hồ sơ của ${nm}; người này không nhắn tin hay gửi yêu cầu cho bạn được nữa. Có thể bỏ chặn bất cứ lúc nào ở màn PT hoặc Cộng đồng → "Người đã chặn" (cùng một danh sách).`,
      async ()=>{
        try{ await block(uid, nm, where); toast(`Đã chặn ${nm}`, "block"); if(typeof after === "function") after(true); }
        catch(e){ toast((e && e.message) || "Không chặn được, thử lại sau", "error"); }
      }, "Chặn", "block", { text:true });
  }
  /** Nút "Chặn người này" — cls tuỳ chỉnh theo nơi đặt */
  function btnHTML(uid, name, where, cls){
    if(!uid || uid === meUid()) return "";
    return `<button type="button" class="${escapeHtml(cls || "btn btn-ghost btn-sm")} fk-block-btn" data-fk-block="${escapeHtml(uid)}" data-fk-block-name="${escapeHtml(String(name || "").slice(0, 60))}" data-fk-block-where="${escapeHtml(where || "")}">${ic("block")}Chặn người này</button>`;
  }
  /** Khối thay thế nội dung của người đã chặn (chat / hồ sơ) */
  function blockedHTML(uid, name, what){
    return `<div class="fk-blocked" role="status">${ic("block")}<b>Bạn đã chặn ${escapeHtml(String(name || "người này").slice(0, 60))}</b>
      <p class="small-note">${escapeHtml(what || "Tin nhắn, yêu cầu và hồ sơ của người này được ẩn với bạn; người này không nhắn tin hay gửi yêu cầu cho bạn được.")}</p>
      <button type="button" class="btn btn-outline btn-sm" data-fk-unblock="${escapeHtml(uid)}" data-fk-block-name="${escapeHtml(String(name || "").slice(0, 60))}">${ic("lock_open")}Bỏ chặn</button></div>`;
  }
  async function confirmUnblock(uid, name, after){
    const nm = String(name || "").trim().slice(0, 60) || "người này";
    try{ await unblock(uid); toast(`Đã bỏ chặn ${nm}`, "lock_open"); if(typeof after === "function") after(false); }
    catch(e){ toast((e && e.message) || "Không bỏ chặn được, thử lại sau", "error"); }
  }
  /** Sheet "Người đã chặn" — danh sách + nút Bỏ chặn */
  async function openList(){
    if(!api() || !cloud.isLoggedIn()){ if(typeof showAuth === "function") showAuth("login"); return; }
    openSheet(`<div class="sheet-header"><h3>Người đã chặn</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
      <p class="small-note">Người trong danh sách không nhắn tin, gửi yêu cầu hay lời mời cho bạn được; tin nhắn, yêu cầu và hồ sơ của họ được ẩn với bạn.</p>
      <div id="fkb-box" style="margin-top:10px;"><p class="empty-hint">Đang tải…</p></div>`);
    let l = []; try{ l = await ready(true); }catch(e){}
    const box = $("#fkb-box"); if(!box) return;
    box.innerHTML = l.length ? l.map(b=> `<div class="list-item fk-brow"><div class="avatar-ini">${escapeHtml(String(b.name || "?").trim().charAt(0).toUpperCase() || "?")}</div>
        <div class="info"><div class="name">${escapeHtml(b.name || "Người dùng")}</div><div class="meta">Đã chặn ${b.at ? escapeHtml(new Date(Number(b.at)).toLocaleDateString("vi-VN")) : ""}${b.reason ? " · " + escapeHtml(b.reason) : ""}</div></div>
        <button type="button" class="btn btn-outline btn-sm" data-fk-unblock="${escapeHtml(b.uid)}" data-fk-block-name="${escapeHtml(b.name || "")}" data-fk-reopen="1">Bỏ chặn</button></div>`).join("")
      : `<p class="empty-hint">Bạn chưa chặn ai.</p>`;
  }
  /* Bắt sự kiện chung: nút chặn / bỏ chặn ở bất kỳ màn nào thuộc khu PT / Tìm PT */
  try{
    document.addEventListener("click", e=>{
      const t = e && e.target && e.target.closest ? e.target.closest("[data-fk-block], [data-fk-unblock]") : null;
      if(!t || !t.dataset) return;
      try{ e.preventDefault(); e.stopPropagation(); }catch(err){}
      if(t.dataset.fkUnblock != null) return confirmUnblock(t.dataset.fkUnblock, t.dataset.fkBlockName, ()=>{ if(t.dataset.fkReopen) openList(); });
      confirmBlock(t.dataset.fkBlock, t.dataset.fkBlockName, t.dataset.fkBlockWhere);
    });
  }catch(e){}
  try{ cloud.onAuth(()=>{ list = []; loaded = false; who = null; ready(true).then(()=>{ if(list.length) fire(); }); }); }catch(e){}
  return { ready, is, block, unblock, confirm: confirmBlock, unblockNow: confirmUnblock, openList, btnHTML, blockedHTML,
    get list(){ return list.slice(); }, get loaded(){ return loaded; } };
})();
try{ window.FKBlock = FKBlock; }catch(e){}
try{ document.addEventListener("fk:blocks-changed", ()=>{
  try{ updateCoachBadge(); const a = $(".screen.active"); if(a && a.id === "screen-coach") renderCoachScreen(false); }catch(e){}
}); }catch(e){}
/* Người kia trong form (PT ↔ học viên) */
function coachPeerOf(c, role){ return c ? (role === "pt" ? c.studentUid : c.ptId) || null : null; }

/* ---------------------------------------------------------------------
   2. MÀN HÌNH "PT"
   --------------------------------------------------------------------- */
let coachTab = null; // 'clients' | 'coaches'
/* QU-15 (fix-pt): tab mặc định theo vai trò hiện tại — PT luôn vào "Học viên của tôi"; đổi vai trò (chọn "Tôi là PT") thì
   chọn lại tab trừ khi người dùng đã tự bấm tab. Chỉ hiện tab "PT của tôi" cho PT đang có PT riêng / lời mời. */
let coachTabAuto = true, coachTabPT = null;
function ptHasOwnCoach(){
  const inv = (typeof TEConnect !== "undefined" && TEConnect && TEConnect._C && Array.isArray(TEConnect._C.invites)) ? TEConnect._C.invites.length : 0;
  return ptData.asStudent.length > 0 || inv > 0;
}

function renderCoachScreen(fetch){
  const el = $("#coach-content"); if(!el) return;
  if(!cloud.isLoggedIn()){
    el.innerHTML = `
      <div class="card coach-intro">
        <span class="material-symbols-rounded" style="font-size:44px;color:var(--primary);">groups</span>
        <h3 style="margin-top:8px;">PT &amp; học viên</h3>
        <p class="small-note" style="margin-top:6px;">PT giao bài từng buổi, xếp thời khoá biểu, nhắc lịch. Học viên đánh dấu hoàn thành và phản hồi — tất cả trong một form riêng.</p>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-primary btn-block" onclick="showAuth('signup')">Tạo tài khoản</button>
          <button class="btn btn-outline btn-block" onclick="showAuth('login')">Đăng nhập</button>
        </div>
      </div>
      <div class="card"><div class="card-title"><span class="material-symbols-rounded">sports</span>Dành cho PT</div><p class="small-note">Miễn phí quản lý học viên: thông tin, gói buổi, thời khoá biểu, giao bài từ thư viện 800+ bài, nhắc nhở hai chiều, theo dõi tiến độ.</p></div>
      <div class="card"><div class="card-title"><span class="material-symbols-rounded">person</span>Dành cho học viên</div><p class="small-note">Nhập mã mời PT gửi (6–10 chữ và số) để xem buổi hôm nay tập gì, lịch tập, và gửi phản hồi cho PT.</p></div>`;
    return;
  }
  if(fetch) refreshCoachData(true);
  const isPT = !!(cloud.profile && cloud.profile.isPT);
  if(!coachTab || (coachTabAuto && coachTabPT !== isPT)){ coachTab = isPT ? "clients" : "coaches"; coachTabAuto = true; }
  coachTabPT = isPT;
  if(!isPT && coachTab==="clients") coachTab = "coaches";
  const showSeg = isPT && (ptHasOwnCoach() || coachTab==="coaches");

  const loading = !ptData.loaded ? `<p class="empty-hint">Đang tải dữ liệu...</p>` : "";
  const err = ptData.error ? `<p class="small-note" style="color:var(--warn);margin-bottom:8px;">${escapeHtml(ptData.error)}</p>` : "";
  const ptUnread = ptData.asPT.reduce((a,c)=>a+unreadFor(c,"pt"),0);
  const stUnread = ptData.asStudent.reduce((a,c)=>a+unreadFor(c,"student"),0);

  el.innerHTML = `
    ${showSeg ? `<div class="seg coach-seg" role="tablist">
      <button role="tab" aria-selected="${coachTab==='clients'}" class="${coachTab==='clients'?'active':''}" data-ctab="clients">Học viên của tôi${ptUnread?` <i class="cnt">${Number(ptUnread)}</i>`:""}</button>
      <button role="tab" aria-selected="${coachTab==='coaches'}" class="${coachTab==='coaches'?'active':''}" data-ctab="coaches">PT của tôi${stUnread?` <i class="cnt">${Number(stUnread)}</i>`:""}</button>
    </div>` : ""}
    ${err}${loading}
    <div id="coach-tab-body"></div>
    <button type="button" class="btn btn-ghost btn-sm btn-block fk-blocked-entry" id="btn-blocked-list" style="margin-top:14px;"><span class="material-symbols-rounded">block</span>Người đã chặn${FKBlock.list.length ? ` (${FKBlock.list.length})` : ""}</button>`;
  const bl = $("#btn-blocked-list"); if(bl) bl.addEventListener("click", ()=> FKBlock.openList());
  if(!FKBlock.loaded) FKBlock.ready().then(l=>{ if(l && l.length){ const a = $(".screen.active"); if(a && a.id === "screen-coach") renderCoachScreen(false); } });
  $$("[data-ctab]").forEach(b=> b.addEventListener("click", ()=>{ coachTab = b.dataset.ctab === "coaches" ? "coaches" : "clients"; coachTabAuto = false; renderCoachScreen(false); }));
  if(!ptData.loaded) return;
  const body = $("#coach-tab-body");
  if(coachTab==="clients") body.innerHTML = clientsTabHTML(); else body.innerHTML = coachesTabHTML(isPT);
  bindCoachTab();
}

function clientRowHTML(c, role){
  const nx = nextSessionOf(c.id), done = doneCountOf(c.id), un = unreadFor(c, role);
  const who = role==="pt" ? c.name : (c.ptName || "PT");
  const blocked = FKBlock.is(coachPeerOf(c, role));
  const sub = blocked ? `<span style="color:var(--warn);">● Đã chặn — chat & tin nhắn ẩn</span>` : role==="pt"
    ? `${c.studentUid ? '<span style="color:var(--success);">● Đã kết nối</span>' : '<span style="color:var(--warn);">● Chưa kết nối</span>'} · ${done}${Number(c.packageTotal)>0?`/${Math.round(Number(c.packageTotal))}`:""} buổi`
    : `${escapeHtml(c.goal||"")} · ${done} buổi đã tập`;
  return `<div class="list-item client-row" data-open-client="${escapeHtml(c.id)}" data-role="${role==="pt"?"pt":"student"}" style="cursor:pointer;">
    <div class="avatar-ini">${escapeHtml((who||"?").trim().charAt(0).toUpperCase())}</div>
    <div class="info">
      <div class="name">${escapeHtml(who)} ${un?`<i class="cnt">${un}</i>`:""}</div>
      <div class="meta">${sub}</div>
      <div class="meta" style="color:var(--primary-soft);">${nx ? `Buổi tới: ${escapeHtml(nx.time||"")} ${escapeHtml(relDay(nx.date))}` : "Chưa có buổi sắp tới"}</div>
    </div>
    <span class="material-symbols-rounded" style="color:var(--text-dim);">chevron_right</span>
  </div>`;
}

function clientsTabHTML(){
  const list = ptData.asPT;
  const pr = cloud.profile || {};
  return `
    <div class="card brand-card" data-brand style="cursor:pointer;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${pr.photo ? `<img class="avatar-ini big" src="${attrUrl(pr.photo, {noBlob:true})}" style="object-fit:cover;" alt="">` : `<div class="avatar-ini big">${escapeHtml(((pr.brandName||cloud.user.name)||"P").charAt(0).toUpperCase())}</div>`}
        <div style="flex:1;"><div class="headline" style="font-size:18px;">${escapeHtml(pr.brandName || cloud.user.name)}</div>
          <div class="small-note">${escapeHtml(pr.specialty || "Chạm để thêm thương hiệu & chuyên môn")}</div></div>
        <span class="material-symbols-rounded" style="color:var(--text-dim);">edit</span>
      </div>
      <button class="btn btn-soft btn-sm btn-block" id="btn-view-my-profile" style="margin-top:12px;"><span class="material-symbols-rounded" style="font-size:15px;">visibility</span>Xem hồ sơ công khai của tôi</button>
    </div>
    <div class="stat-grid coach-kpi">
      <button type="button" class="stat-box" data-ck="all"><div class="num">${list.length}</div><div class="cap">Học viên · ${list.filter(c=>c.studentUid).length} đã kết nối</div></button>
      <button type="button" class="stat-box" data-ck="today"><div class="num">${state.coachUpcoming.filter(u=>u.role==="pt" && u.date===todayStr()).length}</div><div class="cap">Buổi hôm nay</div></button>
      <button type="button" class="stat-box ${lowPkgCount(list)?"hot":""}" data-ck="low"><div class="num">${lowPkgCount(list)}</div><div class="cap">Sắp hết gói</div></button>
    </div>
    <button class="btn btn-primary btn-block" id="btn-add-client"><span class="material-symbols-rounded">person_add</span>Thêm học viên</button>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
      ${list.length ? list.map(c=>clientRowHTML(c,"pt")).join("") : `<p class="empty-hint">Chưa có học viên. Bấm "Thêm học viên": tạo form rồi mời bằng mã, QR hoặc email.</p>`}
    </div>
    ${ptHasOwnCoach() ? "" : `<button type="button" class="btn btn-ghost btn-sm btn-block" id="btn-own-pt" style="margin-top:12px;"><span class="material-symbols-rounded">key</span>Bạn cũng tập với PT khác? Nhập mã PT</button>`}`;
}

/* QU-17 (fix-pt): số học viên sắp hết gói (≤ 3 buổi) — đúng tiêu chí bộ lọc "Sắp hết gói" của PT Pro */
function lowPkgCount(list){
  return (list||[]).filter(c=>{
    if(c.pkg && c.pkg.state && c.pkg.state !== "active") return false;
    const ss = ptData.sessions[c.id] || [];
    const rem = (typeof PTP !== "undefined" && PTP.logic) ? PTP.logic.remaining(c, ss) : (Number(c.packageTotal) ? Number(c.packageTotal) - ss.filter(s=> s.status==="done").length : null);
    return rem !== null && rem <= 3;
  }).length;
}
function coachesTabHTML(isPT){
  const list = ptData.asStudent;
  return `
    <button class="btn btn-primary btn-block" id="btn-join-pt"><span class="material-symbols-rounded">key</span>Nhập mã PT</button>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
      ${list.length ? list.map(c=>clientRowHTML(c,"student")).join("") : `<p class="empty-hint">Bạn chưa kết nối PT nào. Xin PT mã mời rồi bấm "Nhập mã PT".</p>`}
    </div>
    ${isPT ? "" : `<div class="card" style="margin-top:12px;">
      <div class="card-title"><span class="material-symbols-rounded">sports</span>Bạn là PT?</div>
      <p class="small-note">Bật chế độ PT để quản lý học viên miễn phí.</p>
      <button class="btn btn-outline btn-sm" style="margin-top:10px;" id="btn-become-pt">Bật chế độ PT</button>
    </div>`}
    <div class="card" style="margin-top:12px;cursor:pointer;" onclick="openFindPTSoon()">
      <div class="card-title"><span class="material-symbols-rounded">travel_explore</span>Tìm &amp; Book PT <span class="soon-badge">Sắp ra mắt</span></div>
    </div>`;
}

function bindCoachTab(){
  $$("[data-open-client]").forEach(el=> el.addEventListener("click", ()=>{
    const role = el.dataset.role, cid = el.dataset.openClient;
    if(role==="student"){ const c = ptData.asStudent.find(x=>x.id===cid); if(c){ openPTProfile(c.ptId, cid); return; } }
    openClientForm(cid, role);
  }));
  const pv = $("#btn-view-my-profile"); if(pv) pv.addEventListener("click", (e)=>{ e.stopPropagation(); openPTProfile(cloud.user.uid); });
  const add = $("#btn-add-client"); if(add) add.addEventListener("click", openAddClientSheet);
  $$("[data-ck]").forEach(b=> b.addEventListener("click", ()=>{
    const k = b.dataset.ck;
    if(typeof PTP !== "undefined" && PTP.setFilter) PTP.setFilter(k === "low" ? "low" : "all");
    if(k === "today" && typeof PTP !== "undefined" && PTP.openCalendar) PTP.openCalendar();
  }));
  const own = $("#btn-own-pt"); if(own) own.addEventListener("click", ()=> openJoinSheet());
  const join = $("#btn-join-pt"); if(join) join.addEventListener("click", openJoinSheet);
  const brand = $("[data-brand]"); if(brand) brand.addEventListener("click", ()=> openBrandSheet());
  const be = $("#btn-become-pt"); if(be) be.addEventListener("click", async ()=>{
    try{ await cloud.updateMyProfile({ isPT:true }); coachTab = "clients"; renderCoachScreen(false); renderHomeScreen(); toast("Đã bật chế độ PT"); }
    catch(e){ toast(e.message, "error"); }
  });
}
$("#btn-coach-refresh").addEventListener("click", ()=>{ toast("Đang làm mới...", "refresh"); refreshCoachData(true); });

/* ---- Hồ sơ thương hiệu PT (chuẩn bị cho giai đoạn 2) ---- */
function openBrandSheet(onSaved){
  const pr = cloud.profile || {};
  let photo = pr.photo || null;
  // QP-10: SĐT không lưu ở hồ sơ công khai users/{uid}; chỉ gửi vào form của học viên đã kết nối (nếu bật)
  const S = cloud.social || {};
  const myPhone = (typeof S.myPhone === "function" ? S.myPhone() : "") || pr.phone || "";
  const sharePh = !(state.ptPrivate && state.ptPrivate.sharePhone === false);
  openSheet(`
    <div class="sheet-header"><h3>Hồ sơ PT</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note" style="margin-bottom:10px;">Hiện trên trang hồ sơ học viên xem khi chạm vào bạn. Bản sau dùng làm hồ sơ công khai để nhận book.</p>
    <div class="br-photo" id="br-photo">${photo ? `<img src="${attrUrl(photo, {noBlob:true})}" alt="">` : `<span class="material-symbols-rounded">photo_camera</span><small>Thêm ảnh chân dung</small>`}</div>
    <p class="small-note" style="text-align:center;margin:6px 0 10px;">Nên dùng ảnh dọc, nửa người, nền đơn giản.</p>
    <div class="field"><label>Tên thương hiệu</label><input id="br-name" value="${escapeHtml(pr.brandName||"")}" placeholder="VD: Thắng Fitness Coaching"></div>
    <div class="field" style="margin-top:10px;"><label>Chuyên môn (cách nhau bằng dấu phẩy)</label><input id="br-spec" value="${escapeHtml(pr.specialty||"")}" placeholder="VD: Giảm mỡ, Tăng cơ, Phục hồi chấn thương"></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Khu vực</label><input id="br-area" value="${escapeHtml(pr.area||"")}" placeholder="VD: Cầu Giấy, Hà Nội"></div>
      <div class="field" style="max-width:110px;"><label>Năm kinh nghiệm</label><input type="number" min="0" max="60" id="br-years" value="${escapeHtml(String(pr.years||""))}" placeholder="5"></div>
    </div>
    <div class="field" style="margin-top:10px;"><label>Số điện thoại / Zalo liên hệ</label><input id="br-phone" inputmode="tel" value="${escapeHtml(myPhone)}" placeholder="VD: 09xx xxx xxx"></div>
    <label class="ci-wipe"><input type="checkbox" id="br-share-ph" ${sharePh ? "checked" : ""}><span>Hiện SĐT cho học viên <b>đã kết nối</b> (không hiện trên hồ sơ công khai — muốn công khai, bật trong niêm yết Tìm PT)</span></label>
    <div class="field" style="margin-top:10px;"><label>Giới thiệu ngắn</label><textarea id="br-bio" rows="3" placeholder="Kinh nghiệm, chứng chỉ...">${escapeHtml(pr.bio||"")}</textarea></div>
    <button class="btn btn-primary btn-block" id="br-save" style="margin-top:14px;">Lưu</button>
  `);
  $("#br-photo").addEventListener("click", ()=> ppPickPhoto(data=>{ photo = data; $("#br-photo").innerHTML = `<img src="${attrUrl(data, {noBlob:true})}" alt="">`; }));
  $("#br-save").addEventListener("click", async ()=>{
    const btn = $("#br-save"); btn.disabled = true; btn.textContent = "Đang lưu...";
    try{
      const phone = $("#br-phone").value.trim().slice(0, 20), share = !!$("#br-share-ph").checked;
      await cloud.updateMyProfile({ brandName:$("#br-name").value.trim(), specialty:$("#br-spec").value.trim(), area:$("#br-area").value.trim(),
        years: Math.max(0, Number($("#br-years").value)||0), phone, bio:$("#br-bio").value.trim(), photo: photo || null });
      state.ptPrivate = Object.assign({}, state.ptPrivate || {}, { sharePhone: share }); saveState();
      const ptPhone = share && phone ? phone : null;
      for(const c of ptData.asPT){ if((c.ptPhone || null) !== ptPhone){ try{ await cloud.updateClient(c.id, { ptPhone }); c.ptPhone = ptPhone; }catch(e){} } }
      closeSheet(); toast("Đã lưu hồ sơ PT");
      if(onSaved) onSaved(); else renderCoachScreen(false);
    }catch(e){ toast(e.message, "error"); btn.disabled = false; btn.textContent = "Lưu"; }
  });
}

/* ---- PT thêm học viên ----
   QU-16 (fix-pt): 1 nút "Thêm học viên" duy nhất — trong sheet có lối mời học viên đã có form (mã / QR / email);
   hỏi giới tính + trình độ để gợi ý giáo án đúng (không còn "Nam · Mới tập" cho học viên nữ). */
function openAddClientSheet(){
  const unlinked = ptData.asPT.filter(c=> !c.studentUid).length;
  const canInvite = typeof TEConnect !== "undefined" && TEConnect && typeof TEConnect.openInvitePicker === "function";
  const pick = { gender:"", level:"" };
  openSheet(`
    <div class="sheet-header"><h3>Thêm học viên</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    ${unlinked && canInvite ? `<button type="button" class="btn btn-soft btn-sm btn-block" id="ac-invite" style="margin-bottom:12px;"><span class="material-symbols-rounded" style="font-size:16px;">qr_code_2</span>Mời ${unlinked} học viên đã có form · mã / QR / email</button>` : ""}
    <div class="field"><label>Tên học viên*</label><input id="ac-name" placeholder="VD: Nguyễn Văn A"></div>
    <div class="field" style="margin-top:10px;"><label>Giới tính</label><div class="chip-row ac-chips" data-ac-g>${[["female","Nữ"],["male","Nam"]].map(([v,l])=> `<button type="button" class="pill" data-v="${v}" aria-pressed="false">${l}</button>`).join("")}</div></div>
    <div class="field" style="margin-top:10px;"><label>Trình độ</label><div class="chip-row ac-chips" data-ac-l>${[["beginner","Mới tập"],["intermediate","Trung bình"],["advanced","Nâng cao"]].map(([v,l])=> `<button type="button" class="pill" data-v="${v}" aria-pressed="false">${l}</button>`).join("")}</div></div>
    <div class="field" style="margin-top:10px;"><label>Mục tiêu</label><input id="ac-goal" placeholder="VD: Giảm 8kg trong 3 tháng"></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Ngày bắt đầu</label><input type="date" id="ac-start" value="${todayStr()}"></div>
      <div class="field"><label>Gói (số buổi)</label><input type="number" id="ac-pkg" placeholder="VD: 24" min="0"></div>
    </div>
    <div class="field" style="margin-top:10px;"><label>Số điện thoại (không bắt buộc)</label><input id="ac-phone" placeholder="09xx xxx xxx"></div>
    <p class="auth-err" id="ac-err"></p>
    <button class="btn btn-primary btn-block" id="ac-save" style="margin-top:12px;">Tạo form &amp; mời học viên</button>
    <p class="small-note" style="margin-top:6px;">Bước sau: gửi mã mời, QR hoặc lời mời qua email.</p>
  `);
  [["[data-ac-g]","gender"],["[data-ac-l]","level"]].forEach(([sel, k])=> $$(`${sel} [data-v]`).forEach(b=> b.addEventListener("click", ()=>{
    pick[k] = pick[k] === b.dataset.v ? "" : b.dataset.v;
    $$(`${sel} [data-v]`).forEach(x=>{ const on = x.dataset.v === pick[k]; x.classList.toggle("active", on); x.setAttribute("aria-pressed", String(on)); });
  })));
  const ai = $("#ac-invite"); if(ai) ai.addEventListener("click", ()=> TEConnect.openInvitePicker());
  $("#ac-save").addEventListener("click", async ()=>{
    const name = $("#ac-name").value.trim();
    if(!name){ $("#ac-err").textContent = "Vui lòng nhập tên học viên."; return; }
    const btn = $("#ac-save"); btn.disabled = true;
    try{
      const health = {};
      if(pick.gender) health.gender = pick.gender;
      if(pick.level) health.goal = { level: pick.level };
      const ptPhone = ptPhoneForForms();
      const c = await cloud.createClient(Object.assign({ name, goal:$("#ac-goal").value.trim(), startDate:$("#ac-start").value||todayStr(),
        packageTotal:Math.max(0, Math.round(Number($("#ac-pkg").value)||0)), phone:$("#ac-phone").value.trim() }, Object.keys(health).length ? { health } : {}, ptPhone ? { ptPhone } : {}));
      await refreshCoachData(true);
      showInviteSheet(c);
    }catch(e){ $("#ac-err").textContent = e.message; btn.disabled = false; }
  });
}

function ptPhoneForForms(){
  const S = cloud.social || {}; const ph = typeof S.myPhone === "function" ? S.myPhone() : "";
  return ph && !(state.ptPrivate && state.ptPrivate.sharePhone === false) ? ph : null;
}
function inviteText(c){
  return `Chào ${c.name}, mình là PT ${c.ptName||""} trên TapEasy PT. Tải app TapEasy → mục "PT" → "Nhập mã PT" → nhập mã: ${c.joinCode} để xem lịch và bài tập mình giao nhé!`;
}
function showInviteSheet(c){
  openSheet(`
    <div class="sheet-header"><h3>Mã mời học viên</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note">Gửi mã này cho <b>${escapeHtml(c.name)}</b>. Học viên vào mục PT → Nhập mã PT.</p>
    <div class="join-code">${escapeHtml(c.joinCode)}</div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-outline btn-block" id="iv-copy"><span class="material-symbols-rounded">content_copy</span>Sao chép</button>
      <button class="btn btn-primary btn-block" id="iv-share"><span class="material-symbols-rounded">share</span>Gửi</button>
    </div>
    <button class="btn btn-ghost btn-block" style="margin-top:8px;" id="iv-open">Mở form học viên</button>
  `);
  $("#iv-open").addEventListener("click", ()=>{ closeSheet(); openClientForm(c.id, "pt", "schedule"); });
  $("#iv-copy").addEventListener("click", ()=> copyText(inviteText(c)));
  $("#iv-share").addEventListener("click", ()=> shareText("Mã mời TapEasy PT", inviteText(c)));
}
async function copyText(t){
  try{ await navigator.clipboard.writeText(t); toast("Đã sao chép"); }
  catch(e){ const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast("Đã sao chép"); }catch(_){ toast("Không sao chép được","error"); } ta.remove(); }
}
async function shareText(title, text){
  const sp = isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
  try{
    if(sp){ await sp.share({ title, text }); return; }
    if(navigator.share){ await navigator.share({ title, text }); return; }
  }catch(e){ if(e && /cancel|abort/i.test(e.message||e.name||"")) return; }
  copyText(text);
}

/* ---- Học viên nhập mã ---- */
function openJoinSheet(){
  if(!cloud.isLoggedIn()){ showAuth("signup"); return; }
  openSheet(`
    <div class="sheet-header"><h3>Nhập mã PT</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note">PT của bạn tạo mã mời (6–10 chữ và số) trong mục PT và gửi cho bạn.</p>
    <input id="jn-code" class="join-input" maxlength="10" placeholder="K7M2QXPA" autocomplete="off" autocapitalize="characters" aria-label="Mã mời của PT">
    <p class="auth-err" id="jn-err"></p>
    <button class="btn btn-primary btn-block" id="jn-go">Kết nối với PT</button>
  `);
  const inp = $("#jn-code");
  inp.addEventListener("input", ()=>{ inp.value = inp.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0, 10); });
  setTimeout(()=> inp.focus(), 200);
  $("#jn-go").addEventListener("click", async ()=>{
    const btn = $("#jn-go"); btn.disabled = true;
    try{
      const c = await cloud.joinByCode(inp.value);
      closeSheet(); await refreshCoachData(true);
      coachTab = "coaches"; toast(`Đã kết nối với PT ${c.ptName||""}`, "handshake");
      openClientForm(c.id, "student", "today");
    }catch(e){ $("#jn-err").textContent = e.message; btn.disabled = false; }
  });
}

/* ---------------------------------------------------------------------
   3. FORM QUẢN LÝ PT ↔ HỌC VIÊN
   --------------------------------------------------------------------- */
const CF_TABS = [
  { id:"info", label:"Thông tin" }, { id:"today", label:"Buổi này tập gì" }, { id:"schedule", label:"Thời khoá biểu" },
  { id:"history", label:"Lịch sử" }, { id:"remind", label:"Nhắc nhở" }, { id:"notes", label:"Ghi chú" }, { id:"progress", label:"Tiến độ" },
];
let cf = { cid:null, role:"pt", tab:"today", focusSid:null };

function cfClient(){ return [...ptData.asPT, ...ptData.asStudent].find(c=>c.id===cf.cid) || null; }
function cfSessions(){ return ptData.sessions[cf.cid] || []; }
function cfNotes(){ return ptData.notes[cf.cid] || []; }
const isPTView = ()=> cf.role==="pt";

function openClientForm(cid, role, tab){
  cf = { cid, role: role || "pt", tab: tab || "today", focusSid:null };
  goto("client");
  renderClientForm();
  reloadClient();
}
async function reloadClient(){
  try{
    const [c, s, n] = await Promise.all([cloud.getClient(cf.cid), cloud.listSessions(cf.cid), cloud.listNotes(cf.cid)]);
    if(!c){ toast("Form này không còn tồn tại", "error"); goto("coach"); refreshCoachData(true); return; }
    const arr = cf.role==="pt" ? ptData.asPT : ptData.asStudent;
    const i = arr.findIndex(x=>x.id===c.id); if(i>=0) arr[i] = c; else arr.push(c);
    ptData.sessions[cf.cid] = s; ptData.notes[cf.cid] = n;
    rebuildCoachUpcoming(); updateCoachBadge();
    if($("#screen-client").classList.contains("active")) renderClientForm();
  }catch(e){ toast(e.message, "error"); }
}
$("#btn-client-back").addEventListener("click", ()=>{ goto("coach"); });
$("#btn-client-refresh").addEventListener("click", ()=>{ toast("Đang làm mới...", "refresh"); reloadClient(); });

function renderClientForm(){
  const c = cfClient();
  if(!c){ $("#client-content").innerHTML = `<p class="empty-hint">Đang tải...</p>`; return; }
  $("#client-title").textContent = (isPTView() ? c.name : (c.ptName || "PT của tôi"));
  const un = unreadFor(c, cf.role);
  $("#client-tabs").innerHTML = CF_TABS.map(t=>`<button class="day-tab ${cf.tab===t.id?'active':''}" data-cft="${t.id}">${t.label}${t.id==="notes"&&un?` <i class="cnt">${un}</i>`:""}</button>`).join("");
  $$("[data-cft]").forEach(b=> b.addEventListener("click", ()=>{ cf.tab = b.dataset.cft; cf.focusSid = null; renderClientForm(); $("#app-scroll").scrollTo(0,0); }));
  const act = $(`[data-cft="${cf.tab}"]`); if(act) act.scrollIntoView({ inline:"center", block:"nearest" });
  const body = $("#client-content");
  ({ info:cfInfo, today:cfToday, schedule:cfSchedule, history:cfHistory, remind:cfRemind, notes:cfNotesTab, progress:cfProgress })[cf.tab](body, c);
}

/* ---- 3.1 Thông tin ---- */
function cfInfo(body, c){
  const done = doneCountOf(c.id), total = Math.max(0, Math.round(Number(c.packageTotal)||0));
  const used = (typeof PTP !== "undefined" && PTP.logic && PTP.logic.usedCount) ? PTP.logic.usedCount(cfSessions()) : done;   // QP-13: vắng trừ gói
  body.innerHTML = `
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">person</span>Thông tin học viên</div>
      ${row("badge","Tên", c.name)}
      ${row("flag","Mục tiêu", c.goal || "—")}
      ${row("event","Ngày bắt đầu", c.startDate ? fmtDay(c.startDate)+"/"+c.startDate.slice(0,4) : "—")}
      ${row("inventory_2","Gói còn lại", total ? `${Math.max(0,total-used)} / ${total} buổi` : `${done} buổi đã tập (không giới hạn)`)}
      ${isPTView() && c.phone ? row("call","Điện thoại", c.phone) : ""}
      ${total ? `<div class="progress-track" style="margin-top:10px;"><div class="progress-fill" style="width:${Math.min(100,Math.round(used/total*100))}%"></div></div>` : ""}
      ${isPTView() ? `<button class="btn btn-outline btn-block btn-sm" id="ci-edit" style="margin-top:12px;"><span class="material-symbols-rounded">edit</span>Sửa thông tin</button>` : ""}
    </div>
    ${isPTView() ? `
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">link</span>Kết nối học viên</div>
      ${c.studentUid
        ? `<p class="small-note"><span style="color:var(--success);">● Đã kết nối</span> với tài khoản ${escapeHtml(c.studentName||"")} (${escapeHtml(c.studentEmail||"")}).</p>`
        : `<p class="small-note">Học viên chưa nhập mã. Gửi mã này cho học viên:</p>
           <div class="join-code">${escapeHtml(c.joinCode)}</div>
           <div style="display:flex;gap:8px;"><button class="btn btn-outline btn-block btn-sm" id="ci-copy">Sao chép lời mời</button><button class="btn btn-primary btn-block btn-sm" id="ci-share">Gửi</button></div>`}
    </div>
    <button class="btn btn-ghost btn-block" id="ci-del" style="color:var(--primary-soft);"><span class="material-symbols-rounded">delete</span>Xoá học viên này</button>
    ` : `
    <div class="card" id="ci-pt-card">
      <div class="card-title"><span class="material-symbols-rounded">sports</span>PT của bạn</div>
      <p class="small-note">Đang tải hồ sơ PT...</p>
    </div>
    <button class="btn btn-ghost btn-block" id="ci-leave" style="color:var(--primary-soft);"><span class="material-symbols-rounded">logout</span>Ngừng kết nối với PT này</button>
    `}`;
  if(isPTView()){
    $("#ci-edit").addEventListener("click", ()=> openEditClientSheet(c));
    const cp = $("#ci-copy"); if(cp) cp.addEventListener("click", ()=> copyText(inviteText(c)));
    const sh = $("#ci-share"); if(sh) sh.addEventListener("click", ()=> shareText("Mã mời TapEasy PT", inviteText(c)));
    $("#ci-del").addEventListener("click", ()=> confirmDialog("Xoá học viên?", `Form của ${escapeHtml(c.name)} cùng toàn bộ buổi tập và ghi chú sẽ bị xoá vĩnh viễn. Đánh giá học viên đã viết cho bạn trên Tìm PT vẫn được giữ.`, async ()=>{
      try{ await cloud.deleteClient(c.id); await refreshCoachData(true); goto("coach"); toast("Đã xoá học viên"); }catch(e){ toast(e.message,"error"); }
    }, "Xoá", "delete"));
  } else {
    (async ()=>{
      try{
        const pr = await cloud.getUser(c.ptId);
        const card = $("#ci-pt-card"); if(!card) return;
        // QP-10: SĐT PT lấy từ form (PT chủ động chia sẻ cho học viên đã kết nối), không từ hồ sơ công khai
        card.innerHTML = `<div class="card-title"><span class="material-symbols-rounded">sports</span>PT của bạn</div>
          ${row("badge","Thương hiệu", (pr&&pr.brandName) || c.ptName || "—")}
          ${pr&&pr.specialty ? row("military_tech","Chuyên môn", pr.specialty) : ""}
          ${pr&&pr.area ? row("location_on","Khu vực", pr.area) : ""}
          ${c.ptPhone ? row("call","Liên hệ", c.ptPhone) : ""}
          ${pr&&pr.bio ? `<p class="small-note" style="margin-top:8px;">${escapeHtml(pr.bio)}</p>` : ""}
          <button class="btn btn-soft btn-sm btn-block" style="margin-top:10px;" id="ci-pt-view"><span class="material-symbols-rounded" style="font-size:15px;">visibility</span>Xem hồ sơ PT</button>`;
        const pv = $("#ci-pt-view"); if(pv) pv.addEventListener("click", ()=> openPTProfile(c.ptId, c.id));
      }catch(e){}
    })();
    // QP-11: rời PT → gỡ nhật ký đồng bộ; hỏi xoá ảnh / số đo / sức khoẻ tự nhập. Đánh giá đã viết vẫn sửa được (QP-02).
    $("#ci-leave").addEventListener("click", ()=>{
      openSheet(`
        <div class="sheet-header"><h3>Ngừng kết nối?</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
        <p class="small-note">Bạn sẽ không xem được lịch và bài tập PT giao nữa; PT không còn thấy nhật ký tự tập của bạn. Đánh giá bạn viết cho PT trên Tìm PT vẫn giữ và sửa được.</p>
        <label class="ci-wipe"><input type="checkbox" id="ci-wipe"><span>Xoá cả ảnh tiến độ, số đo và hồ sơ sức khoẻ tôi đã nhập trong form này</span></label>
        <div style="display:flex;gap:10px;margin-top:14px;">
          <button class="btn btn-outline btn-block" id="ci-leave-no">Huỷ</button>
          <button class="btn btn-primary btn-block" id="ci-leave-yes"><span class="material-symbols-rounded">logout</span>Ngừng kết nối</button>
        </div>`);
      $("#ci-leave-no").addEventListener("click", ()=> closeSheet());
      $("#ci-leave-yes").addEventListener("click", async ()=>{
        const wipe = !!($("#ci-wipe") && $("#ci-wipe").checked);
        $("#ci-leave-yes").disabled = true;
        try{ await cloud.leaveCoach(c.id, { wipeHealth: wipe }); closeSheet(); await refreshCoachData(true); goto("coach"); toast("Đã ngừng kết nối"); }
        catch(e){ toast(e.message,"error"); $("#ci-leave-yes").disabled = false; }
      });
    });
  }
}
function row(icon, label, value){
  return `<div class="link-row"><div class="left"><span class="material-symbols-rounded">${icon}</span><div><div class="sub">${label}</div><div class="name">${escapeHtml(String(value))}</div></div></div></div>`;
}
function openEditClientSheet(c){
  openSheet(`
    <div class="sheet-header"><h3>Sửa thông tin</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="field"><label>Tên học viên</label><input id="ec-name" value="${escapeHtml(c.name||"")}"></div>
    <div class="field" style="margin-top:10px;"><label>Mục tiêu</label><input id="ec-goal" value="${escapeHtml(c.goal||"")}"></div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Ngày bắt đầu</label><input type="date" id="ec-start" value="${escapeHtml(c.startDate||"")}"></div>
      <div class="field"><label>Gói (số buổi)</label><input type="number" id="ec-pkg" value="${escapeHtml(String(c.packageTotal||""))}"></div>
    </div>
    <div class="field" style="margin-top:10px;"><label>Số điện thoại</label><input id="ec-phone" value="${escapeHtml(c.phone||"")}"></div>
    <button class="btn btn-primary btn-block" id="ec-save" style="margin-top:14px;">Lưu</button>
  `);
  $("#ec-save").addEventListener("click", async ()=>{
    try{
      await cloud.updateClient(c.id, { name:$("#ec-name").value.trim()||c.name, goal:$("#ec-goal").value.trim(), startDate:$("#ec-start").value,
        packageTotal:Number($("#ec-pkg").value)||0, phone:$("#ec-phone").value.trim() });
      closeSheet(); await reloadClient(); toast("Đã lưu");
    }catch(e){ toast(e.message, "error"); }
  });
}

/* ---- 3.2 Buổi này tập gì ---- */
function statusPill(s){
  if(s.status==="done") return `<span class="st st-done">Đã tập${s.completedBy==="student" && !s.ptConfirmedAt ? " · HV tự báo" : ""}</span>`;
  if(s.status==="cancelled") return `<span class="st st-cancel">${s.cancelKind==="notice" ? "Huỷ báo trước" : s.cancelKind==="pt" ? "PT huỷ" : "Huỷ / vắng"}${s.charged===true ? " · trừ gói" : ""}</span>`;
  if(sessStart(s).getTime() < Date.now() - 3*3600000) return `<span class="st st-late">Quá hạn</span>`;
  return `<span class="st st-up">Sắp tới</span>`;
}
const STATUS_VI = { scheduled:"Sắp tới", done:"Đã tập", cancelled:"Huỷ / vắng" };
const CANCEL_VI = { notice:"báo trước", late:"vắng / huỷ muộn", pt:"PT huỷ" };
function studentCanComplete(date){
  const P = cloud.social && cloud.social.policy;
  if(P && typeof P.canStudentComplete === "function") return P.canStudentComplete(date, todayStr());
  return !!date && date <= todayStr() && date >= addDays(todayStr(), -1);
}
/* QP-01: chỉ PT đổi trạng thái buổi đã ghi (mọi lần đổi vào statusLog) */
function openSessionStatusSheet(cid, s){
  if(!isPTView()) return;
  if(s.status !== "done" && typeof PTP !== "undefined" && PTP.openAbsentSheet) return PTP.openAbsentSheet(cid, s.id);
  openSheet(`
    <div class="sheet-header"><h3>Đổi trạng thái buổi</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note">${escapeHtml(fmtDay(s.date))} · ${escapeHtml(s.time||"")} · hiện: ${escapeHtml(STATUS_VI[s.status]||"")}. Thay đổi được ghi vào lịch sử buổi, học viên thấy được.</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
      ${s.status!=="done" ? `<button class="btn btn-outline btn-block" id="ss-done"><span class="material-symbols-rounded">task_alt</span>Đã tập</button>` : ""}
      <button class="btn btn-outline btn-block" id="ss-cancel"><span class="material-symbols-rounded">event_busy</span>Huỷ / vắng…</button>
      <button class="btn btn-ghost btn-block" id="ss-sched"><span class="material-symbols-rounded">undo</span>Trả về "Sắp tới"</button>
    </div>`);
  const go = async patch=>{ try{ await cloud.saveSession(cid, Object.assign({ id:s.id }, patch)); closeSheet(); await reloadClient(); toast("Đã đổi trạng thái"); }catch(e){ toast(e.message,"error"); } };
  const d = $("#ss-done"); if(d) d.addEventListener("click", ()=> go({ status:"done", completedAt:Date.now(), completedBy:"pt", charged:false }));
  $("#ss-cancel").addEventListener("click", ()=>{ closeSheet(); if(typeof PTP !== "undefined" && PTP.openAbsentSheet) PTP.openAbsentSheet(cid, s.id); else go({ status:"cancelled" }); });
  $("#ss-sched").addEventListener("click", ()=> go({ status:"scheduled", charged:false }));
}
function cfToday(body, c){
  const sessions = cfSessions();
  let s = cf.focusSid ? sessions.find(x=>x.id===cf.focusSid) : null;
  if(!s){
    s = nextSessionOf(c.id);
    if(!s) s = sessions.filter(x=>x.status==="scheduled").slice(-1)[0] || null; // buổi quá hạn gần nhất
  }
  if(!s){
    body.innerHTML = `<div class="card" style="text-align:center;">
      <span class="material-symbols-rounded" style="font-size:40px;color:var(--text-dim);">event_busy</span>
      <p style="margin-top:8px;">Chưa có buổi tập nào được lên lịch.</p>
      ${isPTView() ? `<button class="btn btn-primary btn-block" style="margin-top:12px;" id="td-new"><span class="material-symbols-rounded">add</span>Tạo buổi tập</button>` : `<p class="small-note" style="margin-top:6px;">PT của bạn sẽ giao bài ở đây.</p>`}
    </div>`;
    const nb = $("#td-new"); if(nb) nb.addEventListener("click", ()=> openSessionEditor(null));
    return;
  }
  // Học viên mở xem → đánh dấu đã thấy bài mới
  if(!isPTView() && s.seenByStudent===false){
    s.seenByStudent = true;
    cloud.saveSession(c.id, { id:s.id, seenByStudent:true }).then(()=> updateCoachBadge()).catch(()=>{});
    updateCoachBadge();
  }
  const ex = s.exercises || [];
  const doneN = ex.filter(e=>e.done).length;
  // QP-04 (fix-pt): học viên chỉ hoàn thành buổi HÔM NAY / HÔM QUA; không tick trước buổi tương lai
  const stuCan = studentCanComplete(s.date);
  const canTick = s.status!=="cancelled" && (isPTView() || String(s.date||"") <= todayStr());
  const showDone = s.status==="scheduled" && (isPTView() || stuCan);
  const stLog = Array.isArray(s.statusLog) ? s.statusLog.slice(-6).reverse() : [];
  body.innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
        <div><div class="hero-eyebrow">${escapeHtml(relDay(s.date))} · ${escapeHtml(s.time||"")} · ${s.mode==="online"?"Online":"Tại phòng tập"}</div>
          <div class="headline" style="font-size:22px;margin-top:4px;">${escapeHtml(s.title||"Buổi tập")}</div></div>
        ${statusPill(s)}
      </div>
      ${s.ptNote ? `<p class="small-note" style="margin-top:8px;"><b>PT dặn:</b> ${escapeHtml(s.ptNote)}</p>` : ""}
      ${ex.length ? `<div class="progress-track" style="margin-top:12px;"><div class="progress-fill" style="width:${Math.round(doneN/ex.length*100)}%"></div></div>
      <div class="small-note" style="margin-top:6px;">${doneN}/${ex.length} bài đã xong</div>` : ""}
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${ex.length ? ex.map((e,i)=>`
        <div class="list-item ${e.done?'done':''}">
          ${(e.img||(e.stock&&e.stock.thumb)) ? `<img class="thumb" src="${attrUrl(e.img||e.stock.thumb)}" alt="" style="object-fit:cover;background:#fff;" data-exi="${i}" onerror="this.style.visibility='hidden'">` : `<div class="thumb ex-num" data-exi="${i}">${i+1}</div>`}
          <div class="info" data-exi="${i}" style="cursor:pointer;"><div class="name">${escapeHtml(e.name)}</div>
            <div class="meta">${escapeHtml(String(e.sets ?? "-"))} hiệp × ${escapeHtml(String(e.reps||"-"))} · nghỉ ${escapeHtml(String(e.restSec ?? 0))}s${e.videoUrl||e.stock?' · <span style="color:var(--mint-2);">▶ có video</span>':""}</div></div>
          ${canTick ? `<div class="check ${e.done?'checked':''}" data-tick="${i}" role="checkbox" aria-checked="${!!e.done}" aria-label="Đánh dấu xong bài ${i+1}" tabindex="0"><span class="material-symbols-rounded">check</span></div>` : ""}
        </div>`).join("") : `<p class="empty-hint">Buổi này chưa có bài tập.${isPTView()?" Bấm Sửa buổi để thêm.":""}</p>`}
    </div>
    ${showDone ? `<button class="btn btn-primary btn-block" id="td-done" style="margin-top:12px;"><span class="material-symbols-rounded">task_alt</span>Hoàn thành buổi tập</button>` : ""}
    ${s.status==="scheduled" && !isPTView() && !stuCan ? `<p class="small-note" style="margin-top:10px;">Buổi ${escapeHtml(relDay(s.date))} — bạn bấm "Hoàn thành" vào đúng ngày tập (PT cũng xác nhận được).</p>` : ""}
    ${isPTView() && s.status==="done" && s.completedBy==="student" && !s.ptConfirmedAt ? `<button class="btn btn-soft btn-block" id="td-confirm" style="margin-top:12px;"><span class="material-symbols-rounded">verified</span>Xác nhận buổi học viên tự báo đã tập</button>` : ""}
    ${isPTView() && s.status!=="scheduled" ? `<button class="btn btn-ghost btn-sm btn-block" id="td-status" style="margin-top:8px;"><span class="material-symbols-rounded">swap_horiz</span>Đổi trạng thái buổi (Huỷ / vắng · Đã tập)</button>` : ""}
    ${stLog.length ? `<details class="card td-hist" style="margin-top:12px;"><summary class="small-note">Lịch sử trạng thái (${Number(s.statusLog.length)})</summary>
      ${stLog.map(x=> `<div class="small-note">${escapeHtml(hhmm(new Date(Number(x.at)||0)))} ${escapeHtml(fmtDay(todayStr(new Date(Number(x.at)||0))))} · ${x.by==="pt"?"PT":"Học viên"}: ${escapeHtml(STATUS_VI[x.from]||"Mới")} → ${escapeHtml(STATUS_VI[x.to]||"?")}${x.kind && CANCEL_VI[x.kind] ? ` (${escapeHtml(CANCEL_VI[x.kind])})` : ""}</div>`).join("")}</details>` : ""}
    ${!isPTView() ? `
      <div class="card" style="margin-top:12px;">
        <div class="card-title"><span class="material-symbols-rounded">rate_review</span>Phản hồi cho PT</div>
        ${s.feedback ? `<p class="small-note" style="margin-bottom:8px;">Đã gửi: "${escapeHtml(s.feedback)}"</p>` : ""}
        <textarea id="td-fb" rows="2" class="fb-input" placeholder="Hôm nay tập thế nào? Bài nào khó, đau ở đâu..."></textarea>
        <button class="btn btn-soft btn-sm" id="td-fb-send" style="margin-top:8px;">Gửi phản hồi</button>
      </div>` : (s.feedback ? `<div class="card" style="margin-top:12px;"><div class="card-title"><span class="material-symbols-rounded">rate_review</span>Học viên phản hồi</div><p class="small-note">"${escapeHtml(s.feedback)}"</p></div>` : "")}
    ${isPTView() ? `<div style="display:flex;gap:8px;margin-top:12px;">
      <button class="btn btn-outline btn-block" id="td-edit"><span class="material-symbols-rounded">edit</span>Sửa buổi</button>
      <button class="btn btn-outline btn-block" id="td-new2"><span class="material-symbols-rounded">add</span>Buổi mới</button>
    </div>` : ""}
  `;
  $$("[data-exi]").forEach(el=> el.addEventListener("click", ()=> openSessionExerciseDetail(ex[Number(el.dataset.exi)])));
  $$("[data-tick]").forEach(el=> el.addEventListener("click", async ()=>{
    const i = Number(el.dataset.tick);
    ex[i].done = !ex[i].done;
    renderClientForm();
    try{ await cloud.saveSession(c.id, { id:s.id, exercises:ex }); }catch(e){ toast(e.message,"error"); }
  }));
  const dn = $("#td-done"); if(dn) dn.addEventListener("click", ()=> confirmDialog("Hoàn thành buổi tập?", ex.length && doneN<ex.length ? `Còn ${ex.length-doneN} bài chưa đánh dấu. Vẫn ghi nhận buổi này đã tập?` : "Buổi tập sẽ được ghi vào lịch sử và trừ vào gói.", async ()=>{
    try{
      const res = await cloud.saveSession(c.id, { id:s.id, status:"done", completedAt:Date.now(), completedBy:cf.role });
      await reloadClient();
      if(res && res.status === "done") toast("Đã hoàn thành buổi tập", "celebration");
      else toast("Chỉ hoàn thành được buổi hôm nay / hôm qua", "error");
    }catch(e){ toast(e.message,"error"); }
  }, "Hoàn thành", "task_alt"));
  const cfm = $("#td-confirm"); if(cfm) cfm.addEventListener("click", async ()=>{
    try{ await cloud.saveSession(c.id, { id:s.id, ptConfirmedAt: Date.now(), ptConfirmedBy: cloud.user.uid }); await reloadClient(); toast("Đã xác nhận buổi tập", "verified"); }
    catch(e){ toast(e.message, "error"); }
  });
  const tst = $("#td-status"); if(tst) tst.addEventListener("click", ()=> openSessionStatusSheet(c.id, s));
  const fb = $("#td-fb-send"); if(fb) fb.addEventListener("click", async ()=>{
    const text = $("#td-fb").value.trim(); if(!text){ toast("Nhập nội dung phản hồi","error"); return; }
    try{
      await cloud.saveSession(c.id, { id:s.id, feedback:text, feedbackAt:Date.now() });
      await cloud.addNote(c.id, `Phản hồi buổi ${fmtDay(s.date)}: ${text}`, "student", "feedback");
      await reloadClient(); toast("Đã gửi phản hồi cho PT", "send");
    }catch(e){ toast(e.message,"error"); }
  });
  const ed = $("#td-edit"); if(ed) ed.addEventListener("click", ()=> openSessionEditor(s));
  const n2 = $("#td-new2"); if(n2) n2.addEventListener("click", ()=> openSessionEditor(null));
}

function openSessionExerciseDetail(e){
  if(!e) return;
  const isMp4 = e.videoUrl && /\.(mp4|webm|mov)(\?|$)/i.test(e.videoUrl);
  const vb = videoBlockHTML();
  openSheet(`
    <div class="sheet-header"><h3 style="font-size:18px;">${escapeHtml(e.name)}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    ${vb.html}
    <div class="stat-grid" style="margin-top:10px;">
      <div class="stat-box"><div class="num">${escapeHtml(String(e.sets ?? "-"))}</div><div class="cap">Hiệp</div></div>
      <div class="stat-box"><div class="num">${escapeHtml(String(e.reps||"-"))}</div><div class="cap">Lần</div></div>
      <div class="stat-box"><div class="num">${escapeHtml(String(e.restSec ?? 0))}s</div><div class="cap">Nghỉ</div></div>
    </div>
    ${e.muscle ? `<p class="small-note" style="margin-top:8px;">Nhóm cơ: ${escapeHtml(e.muscle)}</p>` : ""}
    ${e.videoUrl && !e.stock && !isMp4 ? `<button class="btn btn-primary btn-block" style="margin-top:12px;" id="sx-video"><span class="material-symbols-rounded">play_circle</span>Xem video PT gửi</button>` : ""}
    ${e.img ? `<div class="ld-media" style="margin-top:12px;"><img src="${attrUrl(e.img)}" class="ld-img white" alt=""><span>Ảnh kỹ thuật</span></div>` : ""}
    ${e.guide ? `<div class="card-title" style="margin-top:12px;font-size:13px;">Hướng dẫn</div><p class="small-note" style="white-space:pre-line;">${escapeHtml(e.guide)}</p>` : ""}
  `);
  const stock = e.stock || (isMp4 ? { url:e.videoUrl, provider:"PT", author:"Video PT gửi", pageUrl:e.videoUrl } : null);
  mountVideoBlock(vb.id, videoQueryFor(e), { name:e.name, meta:e, stock });   // meta có dụng cụ (BUG-07)
  const v = $("#sx-video"); if(v) v.addEventListener("click", ()=> openExternal(e.videoUrl));
}
function openExternal(url){
  if(!/^https?:\/\//i.test(url)){ toast("Link video không hợp lệ","error"); return; }
  const b = isNative() && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
  if(b) b.open({ url }); else window.open(url, "_blank", "noopener");
}

/* ---- 3.3 Thời khoá biểu ---- */
function cfSchedule(body, c){
  const list = cfSessions().filter(s=> s.status==="scheduled");
  const groups = {};
  list.forEach(s=> (groups[s.date] = groups[s.date] || []).push(s));
  body.innerHTML = `
    ${isPTView() ? `<button class="btn btn-primary btn-block" id="sc-new"><span class="material-symbols-rounded">add</span>Thêm buổi tập</button>` : ""}
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;">
      ${Object.keys(groups).length ? Object.keys(groups).sort().map(d=>`
        <div class="small-note sched-day">${escapeHtml(relDay(d))}${["Hôm nay","Ngày mai","Hôm qua"].includes(relDay(d))?" · "+escapeHtml(fmtDay(d)):""}</div>
        ${groups[d].map(s=>`
          <div class="list-item" data-sopen="${escapeHtml(s.id)}" style="cursor:pointer;" role="button" tabindex="0">
            <div class="date-chip"><b>${escapeHtml(s.time||"--:--")}</b><small>${s.mode==="online"?"Online":"Offline"}</small></div>
            <div class="info"><div class="name">${escapeHtml(s.title||"Buổi tập")} ${!isPTView()&&s.seenByStudent===false?'<i class="cnt">Mới</i>':""}</div><div class="meta">${(s.exercises||[]).length} bài tập</div></div>
            ${statusPill(s)}
          </div>`).join("")}
      `).join("") : `<p class="empty-hint">Chưa có buổi nào trong thời khoá biểu.</p>`}
    </div>`;
  const nb = $("#sc-new"); if(nb) nb.addEventListener("click", ()=> openSessionEditor(null));
  $$("[data-sopen]").forEach(el=> el.addEventListener("click", ()=> openSessionActions(cfSessions().find(s=>s.id===el.dataset.sopen))));
}
function openSessionActions(s){
  if(!s) return;
  if(!isPTView()){ cf.tab="today"; cf.focusSid=s.id; renderClientForm(); return; }
  openSheet(`
    <div class="sheet-header"><h3>${escapeHtml(s.title||"Buổi tập")}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <p class="small-note">${escapeHtml(fmtDay(s.date))} · ${escapeHtml(s.time||"")} · ${s.mode==="online"?"Online":"Tại phòng tập"}</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
      <button class="btn btn-outline btn-block" id="sa-view"><span class="material-symbols-rounded">visibility</span>Xem buổi tập</button>
      <button class="btn btn-outline btn-block" id="sa-edit"><span class="material-symbols-rounded">edit</span>Sửa buổi / giao bài</button>
      <button class="btn btn-outline btn-block" id="sa-cancel"><span class="material-symbols-rounded">event_busy</span>Đánh dấu huỷ / vắng</button>
      <button class="btn btn-ghost btn-block" id="sa-del" style="color:var(--primary-soft);"><span class="material-symbols-rounded">delete</span>Xoá buổi</button>
    </div>
  `);
  $("#sa-view").addEventListener("click", ()=>{ closeSheet(); cf.tab="today"; cf.focusSid=s.id; renderClientForm(); });
  $("#sa-edit").addEventListener("click", ()=> openSessionEditor(s));
  $("#sa-cancel").addEventListener("click", async ()=>{
    if(typeof PTP !== "undefined" && PTP.openAbsentSheet){ PTP.openAbsentSheet(cf.cid, s.id); return; }
    try{ await cloud.saveSession(cf.cid, { id:s.id, status:"cancelled" }); closeSheet(); await reloadClient(); toast("Đã đánh dấu huỷ/vắng"); }catch(e){ toast(e.message,"error"); }
  });
  $("#sa-del").addEventListener("click", ()=> confirmDialog("Xoá buổi tập?", "Buổi tập sẽ bị xoá khỏi thời khoá biểu của cả PT và học viên.", async ()=>{
    try{ await cloud.deleteSession(cf.cid, s.id); await reloadClient(); toast("Đã xoá buổi"); }catch(e){ toast(e.message,"error"); }
  }, "Xoá", "delete"));
}

/* ---- Trình soạn buổi tập (PT) ---- */
function openSessionEditor(s, draftIn){
  const draft = draftIn || (s
    ? JSON.parse(JSON.stringify({ id:s.id, date:s.date, time:s.time||"18:00", mode:s.mode||"offline", title:s.title||"", ptNote:s.ptNote||"", exercises:s.exercises||[], repeat:1 }))
    : { id:null, date: todayStr(), time:"18:00", mode:"offline", title:"", ptNote:"", exercises:[], repeat:1 });
  const sync = ()=>{
    draft.date = $("#se-date").value || draft.date; draft.time = $("#se-time").value || draft.time;
    draft.mode = $("#se-mode").value; draft.title = $("#se-title").value; draft.ptNote = $("#se-note").value;
    const rp = $("#se-repeat"); if(rp) draft.repeat = Math.max(1, Math.min(12, Number(rp.value)||1));
    $$("[data-exf-i]").forEach(inp=>{ const [i,f] = inp.dataset.exfI.split(":"); const v = inp.value;
      draft.exercises[i][f] = (f==="sets"||f==="restSec") ? (Number(v)||0) : v;
      if(f==="videoUrl" && draft.exercises[i].stock && draft.exercises[i].stock.url!==v) delete draft.exercises[i].stock; });
  };
  openSheet(`
    <div class="sheet-header"><h3>${draft.id?"Sửa buổi tập":"Buổi tập mới"}</h3><button class="icon-btn" onclick="closeSheet()"><span class="material-symbols-rounded">close</span></button></div>
    <div class="field-row">
      <div class="field"><label>Ngày</label><input type="date" id="se-date" value="${escapeHtml(draft.date)}"></div>
      <div class="field"><label>Giờ</label><input type="time" id="se-time" value="${escapeHtml(draft.time)}"></div>
    </div>
    <div class="field-row" style="margin-top:10px;">
      <div class="field"><label>Hình thức</label><select id="se-mode"><option value="offline" ${draft.mode!=="online"?"selected":""}>Tại phòng tập</option><option value="online" ${draft.mode==="online"?"selected":""}>Online</option></select></div>
      ${draft.id ? "" : `<div class="field"><label>Lặp lại hằng tuần</label><select id="se-repeat">${[1,2,4,6,8,12].map(n=>`<option value="${n}" ${draft.repeat==n?"selected":""}>${n===1?"Không lặp":n+" tuần"}</option>`).join("")}</select></div>`}
    </div>
    <div class="field" style="margin-top:10px;"><label>Tên buổi</label><input id="se-title" value="${escapeHtml(draft.title)}" placeholder="VD: Ngực + Tay sau"></div>
    <div class="field" style="margin-top:10px;"><label>PT dặn học viên</label><textarea id="se-note" rows="2" placeholder="VD: Ăn nhẹ trước 1 tiếng, mang găng tay">${escapeHtml(draft.ptNote)}</textarea></div>

    <div class="section-title" style="margin-top:14px;"><h3 style="font-size:15px;">Bài tập (${draft.exercises.length})</h3></div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${draft.exercises.map((e,i)=>`
        <div class="ex-edit">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <b style="font-size:13px;">${i+1}. ${escapeHtml(e.name)}</b>
            <div style="display:flex;gap:2px;">
              <button class="icon-btn sm" data-exmv="${i}:-1" ${i===0?"disabled":""}><span class="material-symbols-rounded">arrow_upward</span></button>
              <button class="icon-btn sm" data-exdel="${i}"><span class="material-symbols-rounded">close</span></button>
            </div>
          </div>
          <div class="field-row" style="margin-top:6px;">
            <div class="field"><label>Hiệp</label><input type="number" data-exf-i="${i}:sets" value="${escapeHtml(String(e.sets||3))}"></div>
            <div class="field"><label>Lần</label><input data-exf-i="${i}:reps" value="${escapeHtml(String(e.reps||"10"))}"></div>
            <div class="field"><label>Nghỉ (s)</label><input type="number" data-exf-i="${i}:restSec" value="${escapeHtml(String(e.restSec||60))}"></div>
          </div>
          <div class="ex-video-row">
            ${e.stock ? `<img src="${attrUrl(e.stock.thumb||"")}" alt="" onerror="this.style.display='none'">` : ""}
            <div class="field" style="flex:1;margin:0;"><input data-exf-i="${i}:videoUrl" value="${escapeHtml(e.videoUrl||"")}" placeholder="Link video (YouTube, Drive...) hoặc bấm Tìm"></div>
            <button class="btn btn-soft btn-sm" data-exvid="${i}"><span class="material-symbols-rounded" style="font-size:15px;">video_library</span>Tìm</button>
          </div>
          ${e.stock ? stockCreditHTML(e.stock) : ""}
        </div>`).join("") || `<p class="empty-hint">Chưa có bài tập.</p>`}
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
      <button class="btn btn-soft btn-sm" id="se-add-db"><span class="material-symbols-rounded" style="font-size:16px;">library_books</span>800+ bài</button>
      <button class="btn btn-soft btn-sm" id="se-add-plan"><span class="material-symbols-rounded" style="font-size:16px;">edit_calendar</span>Từ giáo án</button>
      <button class="btn btn-soft btn-sm" id="se-add-manual"><span class="material-symbols-rounded" style="font-size:16px;">add</span>Tự nhập</button>
    </div>
    <p class="auth-err" id="se-err"></p>
    <button class="btn btn-primary btn-block" id="se-save" style="margin-top:12px;">${draft.id?"Lưu thay đổi":"Tạo buổi & giao cho học viên"}</button>
  `);
  const reopen = ()=> openSessionEditor(s, draft);
  const newEx = o=> Object.assign({ uid: uid(), name:"", sets:3, reps:"10", restSec:60, videoUrl:"", img:"", guide:"", muscle:"", done:false }, o);
  $$("[data-exdel]").forEach(b=> b.addEventListener("click", ()=>{ sync(); draft.exercises.splice(Number(b.dataset.exdel),1); reopen(); }));
  $$("[data-exvid]").forEach(b=> b.addEventListener("click", ()=>{
    sync(); const ex = draft.exercises[Number(b.dataset.exvid)];
    openVideoPicker(videoQueryFor(ex), stock=>{ ex.stock = stock; ex.videoUrl = stock.url; reopen(); toast("Đã gắn video", "videocam"); }, { onBack: reopen });
  }));
  $$("[data-exmv]").forEach(b=> b.addEventListener("click", ()=>{ sync(); const [i,d]=b.dataset.exmv.split(":").map(Number); const t=draft.exercises[i]; draft.exercises[i]=draft.exercises[i+d]; draft.exercises[i+d]=t; reopen(); }));
  $("#se-add-db").addEventListener("click", ()=>{
    sync();
    openExDbPicker(items=>{ items.forEach(it=> draft.exercises.push(newEx({ name:it.name, sets:it.sets, reps:it.reps, restSec:it.restSec, img:it.img, guide:it.guide, muscle:it.muscle, exDbId:it.exDbId }))); reopen(); }, { multi:true });
  });
  $("#se-add-plan").addEventListener("click", ()=>{ sync(); pickFromMyPlan(items=>{ items.forEach(it=> draft.exercises.push(newEx(it))); if(!draft.title && items._title) draft.title = items._title; reopen(); }, reopen); });
  $("#se-add-manual").addEventListener("click", ()=>{
    sync();
    openSheet(`
      <div class="sheet-header"><h3>Tự nhập bài tập</h3><button class="icon-btn" id="mx-back"><span class="material-symbols-rounded">arrow_back</span></button></div>
      <div class="field"><label>Tên bài tập*</label><input id="mx-name" placeholder="VD: Đẩy ngực máy"></div>
      <div class="field-row" style="margin-top:10px;">
        <div class="field"><label>Hiệp</label><input type="number" id="mx-sets" value="3"></div>
        <div class="field"><label>Lần</label><input id="mx-reps" value="12"></div>
        <div class="field"><label>Nghỉ (s)</label><input type="number" id="mx-rest" value="60"></div>
      </div>
      <div class="field" style="margin-top:10px;"><label>Link video (không bắt buộc)</label><input id="mx-video" placeholder="https://..."></div>
      <div class="field" style="margin-top:10px;"><label>Hướng dẫn (không bắt buộc)</label><textarea id="mx-guide" rows="2"></textarea></div>
      <button class="btn btn-primary btn-block" id="mx-add" style="margin-top:12px;">Thêm</button>
    `);
    $("#mx-back").addEventListener("click", reopen);
    $("#mx-add").addEventListener("click", ()=>{
      const name = $("#mx-name").value.trim(); if(!name){ toast("Nhập tên bài tập","error"); return; }
      draft.exercises.push(newEx({ name, sets:Number($("#mx-sets").value)||3, reps:$("#mx-reps").value||"12", restSec:Number($("#mx-rest").value)||60, videoUrl:$("#mx-video").value.trim(), guide:$("#mx-guide").value.trim() }));
      reopen();
    });
  });
  $("#se-save").addEventListener("click", async ()=>{
    sync();
    if(!draft.date || !draft.time){ $("#se-err").textContent = "Chọn ngày và giờ."; return; }
    const bad = draft.exercises.find(e=> e.videoUrl && !/^https?:\/\//i.test(e.videoUrl));
    if(bad){ $("#se-err").textContent = `Link video của "${bad.name}" phải bắt đầu bằng http:// hoặc https://`; return; }
    const btn = $("#se-save"); btn.disabled = true; btn.textContent = "Đang lưu...";
    try{
      const base = { time:draft.time, mode:draft.mode, title:draft.title.trim(), ptNote:draft.ptNote.trim(), seenByStudent:false };
      if(draft.id){
        await cloud.saveSession(cf.cid, Object.assign({ id:draft.id, date:draft.date, exercises:draft.exercises }, base));
      } else {
        for(let w=0; w<draft.repeat; w++){
          await cloud.saveSession(cf.cid, Object.assign({ date: addDays(draft.date, 7*w), status:"scheduled",
            exercises: draft.exercises.map(e=> Object.assign({}, e, { uid: uid(), done:false })) }, base));
        }
      }
      closeSheet(); await reloadClient();
      toast(draft.id ? "Đã lưu buổi tập" : (draft.repeat>1 ? `Đã tạo ${draft.repeat} buổi` : "Đã tạo buổi tập"), "event_available");
    }catch(e){ $("#se-err").textContent = e.message; btn.disabled=false; btn.textContent="Lưu"; }
  });
}

/* Lấy bài từ giáo án cá nhân của PT */
function pickFromMyPlan(onPick, onBack){
  const plans = Object.values(state.plans||{});
  openSheet(`
    <div class="sheet-header"><h3>Chọn từ giáo án</h3><button class="icon-btn" id="pp-back"><span class="material-symbols-rounded">arrow_back</span></button></div>
    ${plans.map(p=>`
      <div class="small-note sched-day">${escapeHtml(p.name)}</div>
      ${DAY_KEYS.filter(k=>p.days[k].items.length).map(k=>`
        <div class="list-item" data-ppick="${escapeHtml(p.id)}:${k}" style="cursor:pointer;">
          <div class="date-chip"><b>${k}</b></div>
          <div class="info"><div class="name">${escapeHtml(p.days[k].title)}</div><div class="meta">${p.days[k].items.length} bài</div></div>
          <span class="material-symbols-rounded" style="color:var(--text-dim);">add_circle</span>
        </div>`).join("")}
    `).join("") || `<p class="empty-hint">Chưa có giáo án.</p>`}
  `);
  $("#pp-back").addEventListener("click", onBack);
  $$("[data-ppick]").forEach(el=> el.addEventListener("click", ()=>{
    const [pid, k] = el.dataset.ppick.split(":");
    const day = state.plans[pid].days[k];
    const items = day.items.map(it=>{ const m = getExerciseMeta(it);
      return { name:m.name, muscle:m.muscle, img:m.img, guide:m.guide, sets:it.sets, reps:it.reps, restSec:it.restSec }; });
    items._title = day.title;
    onPick(items);
  }));
}

/* ---- 3.4 Lịch sử ---- */
function cfHistory(body, c){
  const list = cfSessions().filter(s=> s.status!=="scheduled").slice().reverse();
  body.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">
    ${list.length ? list.map(s=>{ const ex=s.exercises||[]; const d=ex.filter(e=>e.done).length; return `
      <div class="card" style="margin:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><b>${escapeHtml(s.title||"Buổi tập")}</b><div class="small-note">${escapeHtml(fmtDay(s.date))} · ${escapeHtml(s.time||"")}</div></div>${statusPill(s)}
        </div>
        ${ex.length ? `<div class="small-note" style="margin-top:6px;">${d}/${ex.length} bài hoàn thành: ${ex.map(e=>escapeHtml(e.name)).slice(0,4).join(", ")}${ex.length>4?"...":""}</div>` : ""}
        ${s.ptNote ? `<div class="small-note" style="margin-top:6px;"><b>PT:</b> ${escapeHtml(s.ptNote)}</div>` : ""}
        ${s.feedback ? `<div class="small-note" style="margin-top:4px;"><b>Học viên:</b> ${escapeHtml(s.feedback)}</div>` : ""}
        <button class="btn btn-ghost btn-sm" data-hview="${escapeHtml(s.id)}" style="margin-top:6px;padding-left:0;">Xem chi tiết</button>
      </div>`; }).join("") : `<p class="empty-hint">Chưa có buổi nào trong lịch sử.</p>`}
  </div>`;
  $$("[data-hview]").forEach(b=> b.addEventListener("click", ()=>{ cf.tab="today"; cf.focusSid=b.dataset.hview; renderClientForm(); }));
}

/* ---- 3.5 Nhắc nhở ---- */
function cfRemind(body, c){
  const before = c.remindBefore || 60;
  const upcoming = state.coachUpcoming.filter(u=> u.cid===c.id && sessStart(u) > new Date()).slice(0,5);
  const opts = [[15,"15 phút"],[30,"30 phút"],[60,"1 giờ"],[120,"2 giờ"],[1440,"1 ngày"]];
  body.innerHTML = `
    <div class="card">
      <div class="link-row"><div class="left"><span class="material-symbols-rounded">notifications_active</span><div><div class="name">Nhắc tôi trước mỗi buổi PT</div><div class="sub">Áp dụng trên điện thoại này</div></div></div>
        <div class="toggle ${state.coachPrefs.remind?'on':''}" id="rm-toggle"></div></div>
      <div class="field" style="margin-top:10px;"><label>Nhắc trước giờ tập</label>
        <select id="rm-before" ${isPTView()?"":"disabled"}>${opts.map(([v,l])=>`<option value="${v}" ${before==v?"selected":""}>${l}</option>`).join("")}</select></div>
      <p class="small-note" style="margin-top:6px;">${isPTView() ? "Áp dụng cho cả bạn và học viên." : "Do PT cài đặt cho cả hai bên."}</p>
    </div>
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">schedule</span>Lịch nhắc sắp tới</div>
      ${upcoming.length ? upcoming.map(u=>{ const at = new Date(sessStart(u).getTime()-(u.before||60)*60000); return `
        <div class="link-row"><div class="left"><span class="material-symbols-rounded">alarm</span><div><div class="name">${hhmm(at)} ${escapeHtml(relDay(todayStr(at)))}</div><div class="sub">cho buổi ${escapeHtml(u.time||"")} ${escapeHtml(relDay(u.date))}${u.title?" — "+escapeHtml(u.title):""}</div></div></div></div>`; }).join("")
        : `<p class="small-note">Chưa có buổi nào sắp tới.</p>`}
    </div>
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">campaign</span>Gửi lời nhắc cho ${isPTView()?"học viên":"PT"}</div>
      <div class="chip-row" style="margin-bottom:8px;">
        ${(isPTView() ? ["Nhớ tập đúng giờ nhé!","Đã có bài mới, xem trong app nhé","Nhớ ăn đủ đạm hôm nay","Ngủ đủ 7-8 tiếng nhé"] : ["Em sẽ đến muộn 10 phút","Em xin dời buổi","Em đã tập xong bài"]).map(t=>`<button class="pill" data-qr="${escapeHtml(t)}">${t}</button>`).join("")}
      </div>
      <textarea id="rm-text" rows="2" class="fb-input" placeholder="Nội dung nhắc nhở..."></textarea>
      <button class="btn btn-primary btn-sm" id="rm-send" style="margin-top:8px;"><span class="material-symbols-rounded" style="font-size:16px;">send</span>Gửi</button>
      <p class="small-note" style="margin-top:6px;">Lời nhắc hiện trong mục Ghi chú và báo chấm đỏ ở mục PT của người nhận.</p>
    </div>`;
  $("#rm-toggle").addEventListener("click", async ()=>{
    state.coachPrefs.remind = !state.coachPrefs.remind;
    if(state.coachPrefs.remind){
      if(nativeNotif.available()) await nativeNotif.requestPermission();
      else if("Notification" in window && Notification.permission==="default") await Notification.requestPermission();
    }
    saveState(); renderClientForm();
  });
  const sel = $("#rm-before");
  if(isPTView()) sel.addEventListener("change", async ()=>{
    try{ await cloud.updateClient(c.id, { remindBefore: Number(sel.value) }); await reloadClient(); toast("Đã cập nhật giờ nhắc"); }catch(e){ toast(e.message,"error"); }
  });
  $$("[data-qr]").forEach(b=> b.addEventListener("click", ()=>{ $("#rm-text").value = b.dataset.qr; }));
  $("#rm-send").addEventListener("click", async ()=>{
    const t = $("#rm-text").value.trim(); if(!t){ toast("Nhập nội dung","error"); return; }
    try{ await cloud.addNote(c.id, t, cf.role, "reminder"); await reloadClient(); toast("Đã gửi lời nhắc", "send"); }catch(e){ toast(e.message,"error"); }
  });
}

/* ---- 3.6 Ghi chú / Phản hồi ---- */
function cfNotesTab(body, c){
  state.coachSeen[c.id] = Date.now(); saveState(); updateCoachBadge();
  const notes = cfNotes();
  const me = cloud.user && cloud.user.uid;
  const kindIcon = { reminder:"campaign", feedback:"rate_review" };
  body.innerHTML = `
    <div class="chat">
      ${notes.length ? notes.map(n=>`
        <div class="bubble ${n.authorUid===me?'me':''} ${NOTE_KINDS.includes(n.kind)&&n.kind!=='note'?'k-'+n.kind:''}">
          <div class="who">${n.kind&&kindIcon[n.kind]?`<span class="material-symbols-rounded" style="font-size:13px;">${kindIcon[n.kind]}</span> `:""}${escapeHtml(n.authorName||"")} · ${n.authorRole==="pt"?"PT":"Học viên"}</div>
          <div class="txt">${escapeHtml(n.text)}</div>
          <div class="ts">${hhmm(new Date(Number(n.ts)||0))} · ${escapeHtml(fmtDay(todayStr(new Date(Number(n.ts)||0))))}</div>
        </div>`).join("") : `<p class="empty-hint">Chưa có ghi chú. ${isPTView()?"Ghi lại tình trạng, chấn thương, dặn dò cho học viên.":"Gửi câu hỏi hoặc phản hồi cho PT."}</p>`}
    </div>
    <div class="chat-input">
      <textarea id="nt-text" rows="1" placeholder="Viết ghi chú..."></textarea>
      <button class="btn btn-primary" id="nt-send"><span class="material-symbols-rounded">send</span></button>
    </div>`;
  $("#nt-send").addEventListener("click", async ()=>{
    const t = $("#nt-text").value.trim(); if(!t) return;
    $("#nt-send").disabled = true;
    try{ await cloud.addNote(c.id, t, cf.role, "note"); await reloadClient(); state.coachSeen[c.id] = Date.now(); saveState(); }
    catch(e){ toast(e.message,"error"); $("#nt-send").disabled = false; }
  });
  setTimeout(()=>{ const sc = $("#app-scroll"); sc.scrollTo(0, sc.scrollHeight); }, 50);
}

/* ---- 3.7 Tiến độ ---- */
function cfProgress(body, c){
  const all = cfSessions();
  const done = all.filter(s=>s.status==="done"), cancelled = all.filter(s=>s.status==="cancelled");
  const overdue = all.filter(s=>s.status==="scheduled" && sessStart(s).getTime() < Date.now()-3*3600000);
  const denom = done.length + cancelled.length + overdue.length;
  const rate = denom ? Math.round(done.length/denom*100) : 0;
  const exDone = done.reduce((a,s)=> a + (s.exercises||[]).filter(e=>e.done).length, 0);
  const exTotal = done.reduce((a,s)=> a + (s.exercises||[]).length, 0);
  // 8 tuần gần nhất
  const weeks = [];
  const monday = d=>{ const x=new Date(d); const k=(x.getDay()+6)%7; x.setDate(x.getDate()-k); x.setHours(0,0,0,0); return x; };
  const m0 = monday(new Date());
  for(let i=7;i>=0;i--){ const st=new Date(m0); st.setDate(st.getDate()-7*i); const en=new Date(st); en.setDate(en.getDate()+7);
    weeks.push({ label:`${pad2(st.getDate())}/${pad2(st.getMonth()+1)}`, n: done.filter(s=>{ const t=sessStart(s); return t>=st && t<en; }).length }); }
  const maxN = Math.max(1, ...weeks.map(w=>w.n));
  const total = Math.max(0, Math.round(Number(c.packageTotal)||0));      // QS-04: số do PT ghi → ép số trước khi chèn HTML
  const charged = cancelled.filter(s=> s.charged===true).length, used = done.length + charged;
  body.innerHTML = `
    <div class="stat-grid">
      <div class="stat-box"><div class="num">${done.length}</div><div class="cap">Buổi đã tập</div></div>
      <div class="stat-box"><div class="num">${rate}%</div><div class="cap">Chuyên cần</div></div>
      <div class="stat-box"><div class="num">${exTotal?Math.round(exDone/exTotal*100):0}%</div><div class="cap">Bài hoàn thành</div></div>
    </div>
    ${total ? `<div class="card"><div class="progress-row"><span class="label">Gói tập</span><span class="value">${used}/${total} buổi${charged ? ` (gồm ${charged} vắng trừ gói)` : ""}</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,Math.round(used/total*100))}%"></div></div>
      ${total-used<=3 && total>used ? `<p class="small-note" style="margin-top:8px;color:var(--warn);">Gói sắp hết — còn ${total-used} buổi.</p>` : ""}
      ${used>=total ? `<p class="small-note" style="margin-top:8px;color:var(--warn);">Đã dùng hết gói.</p>` : ""}</div>` : ""}
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">bar_chart</span>Số buổi theo tuần (8 tuần)</div>
      <div class="wk-bars">${weeks.map(w=>`<div class="wk"><div class="bar" style="height:${Math.round(w.n/maxN*100)}%"><span>${w.n||""}</span></div><small>${w.label}</small></div>`).join("")}</div>
    </div>
    <div class="card">
      <div class="card-title"><span class="material-symbols-rounded">summarize</span>Tổng kết</div>
      ${row("task_alt","Đã tập", `${done.length} buổi`)}
      ${row("event_busy","Huỷ / vắng", `${cancelled.length} buổi${charged ? ` · ${charged} trừ gói` : ""}`)}
      ${row("schedule","Quá hạn chưa xác nhận", `${overdue.length} buổi`)}
      ${row("event_upcoming","Sắp tới", `${all.filter(s=>s.status==="scheduled").length - overdue.length} buổi`)}
      ${row("fitness_center","Tổng số bài đã hoàn thành", `${exDone}`)}
    </div>`;
}

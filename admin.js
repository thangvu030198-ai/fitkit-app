/* =========================================================================
   TapEasy — BẢNG ĐIỀU KHIỂN QUẢN TRỊ (admin.js + admin.css)
   Cần: rbac.js (TE_RBAC), cloud-admin.js (cloudAdmin). Nạp SAU cloud-admin.js, trước health-safety.js.

   - Lớp phủ toàn màn hình #adm-root gắn vào <body> (ngoài khung điện thoại) → rộng rãi trên máy tính,
     thanh bên thu gọn thành ngăn kéo trên điện thoại.
   - Lối vào (HIỂN THỊ — QS-16 / App Store 2.3.1, đã bỏ "chạm 7 lần" ẩn): Hồ sơ → "Bảng quản trị" (chỉ tài khoản có vai trò)
     · menu ☰ · "Thiết lập quản trị lần đầu" (chỉ khi app CHƯA có Chủ sở hữu — máy chủ trả lời qua ownerStatus) · địa chỉ #admin (web).
     App native chạy chế độ demo (chưa cấu hình Firebase): KHÔNG có quản trị. Chưa có phiên → màn ĐĂNG NHẬP QUẢN TRỊ.
   - Mỗi mục chỉ hiện khi TE_RBAC.can(); mọi thao tác ghi đi qua cloudAdmin (kiểm quyền + audit).
   - Phía người dùng: thông báo hệ thống trên Trang chủ, "Liên hệ hỗ trợ", "Xác minh PT (tích xanh)".
   API: window.TE_ADMIN = { open(section), close(), render(), registerSection(def), sections, isOpen() }
   ========================================================================= */
(function(G){
"use strict";
if(!G.TE_RBAC || !G.cloudAdmin){ console.warn("[admin] Cần nạp rbac.js và cloud-admin.js trước admin.js."); return; }
if(G.TE_ADMIN && G.TE_ADMIN.__v) return;
const R = G.TE_RBAC, CA = G.cloudAdmin, core = R.core;

/* ---------------------------------------------------------------------
   0. TIỆN ÍCH
   --------------------------------------------------------------------- */
const esc = s=> String(s == null ? "" : s).replace(/[&<>"'`]/g, c=> ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;", "`":"&#96;" }[c]));
const nf = n=>{ n = Math.round(Number(n) || 0); try{ return n.toLocaleString("vi-VN"); }catch(e){ return String(n); } };
const money = v=> nf(v) + "đ";
const p2 = n=> String(n).padStart(2, "0");
const fdt = t=>{ if(!t) return "—"; const d = new Date(t); return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const fd = t=>{ if(!t) return "—"; const d = new Date(t); return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`; };
function ago(t){ const s = Math.round((Date.now() - (t || 0)) / 1000); if(!t) return "—"; if(s < 60) return "vừa xong"; if(s < 3600) return Math.floor(s/60) + " phút trước"; if(s < 86400) return Math.floor(s/3600) + " giờ trước"; if(s < 86400*30) return Math.floor(s/86400) + " ngày trước"; return fd(t); }
const ic = (n, cls)=> `<span class="material-symbols-rounded${cls ? " " + cls : ""}" aria-hidden="true">${n}</span>`;
const q = (s, r)=> (r || document).querySelector(s);
const qa = (s, r)=> Array.from((r || document).querySelectorAll(s));
const can = p=> R.can(p);
const any = list=> list.some(can);
const arr = a=> Array.isArray(a) ? a : [];
const obj = o=> (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
const warn = e=> console.warn("[admin]", e);
const initial = s=> (String(s || "?").trim()[0] || "?").toUpperCase();     // 1 ký tự — luôn bọc esc() khi chèn HTML
const roleBadge = r=> r ? (r === "?" ? `<span class="adm-role r-staff">Nhân sự</span>` : `<span class="adm-role r-${esc(r)}">${r === "owner" ? ic("adm_crown") : ""}${esc(core.ROLES[r] ? core.ROLES[r].label : r)}</span>`) : `<span class="adm-role r-none">Người dùng</span>`;
const cleanText = t=>{ try{ return cloud.social && cloud.social.moderation ? cloud.social.moderation.cleanText(t) : t; }catch(e){ return t; } };

function addIcons(){
  try{
    if(typeof FK_LINE === "undefined") return;
    const shield = "M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z|M9 12l2.2 2.2L15.5 10";
    const add = {
      adm_dash:"r:3,3,8,9,2|r:13,3,8,5,2|r:13,10,8,11,2|r:3,14,8,7,2",
      adm_users:"c:9,8,3.5|M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5|c:17,9,2.5|M16.5 14.6c2.4.2 4.2 1.9 4.9 4.4",
      adm_shield:shield, admin_panel_settings:shield,
      adm_pt:"M12 2.5l2.3 1.7 2.9-.2.9 2.7 2.4 1.7-.9 2.8.9 2.8-2.4 1.7-.9 2.7-2.9-.2L12 21.5l-2.3-1.7-2.9.2-.9-2.7-2.4-1.7.9-2.8-.9-2.8 2.4-1.7.9-2.7 2.9.2z|M8.7 12l2.3 2.3 4.3-4.6",
      adm_flag:"M5 21V4|M5 4h11l-2 4 2 4H5",
      adm_book:"M4 4.5A1.5 1.5 0 0 1 5.5 3H20v14H5.5A1.5 1.5 0 0 0 4 18.5z|M4 18.5A1.5 1.5 0 0 0 5.5 20H20|M8 7h8",
      adm_cal:"r:3,5,18,16,2|M3 10h18|M8 3v4|M16 3v4",
      adm_shop:"M5 8h14l-1 13H6z|M9 8V6a3 3 0 0 1 6 0v2",
      adm_bcast:"M3 10v4h3l6 4V6l-6 4z|M16 9a4 4 0 0 1 0 6|M18.5 6.5a7.5 7.5 0 0 1 0 11",
      adm_gear:"c:12,12,3|M12 2v3|M12 19v3|M2 12h3|M19 12h3|M4.9 4.9 7 7|M17 17l2.1 2.1|M4.9 19.1 7 17|M17 7l2.1-2.1",
      adm_log:"r:5,3,14,18,2|M9 8h6|M9 12h6|M9 16h4",
      adm_help:"c:12,12,9|M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6|M12 17h.01",
      adm_lock:"r:5,11,14,10,2|M8 11V8a4 4 0 0 1 8 0v3", adm_unlock:"r:5,11,14,10,2|M8 11V8a4 4 0 0 1 7.5-2",
      adm_menu:"M4 7h16|M4 12h16|M4 17h16", adm_x:"M6 6l12 12|M18 6 6 18",
      adm_copy:"r:8,8,12,12,2|M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3",
      adm_eye_off:"M3 3l18 18|M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6|M6.6 6.6C3.9 8.3 2.5 12 2.5 12s3.5 6 9.5 6c1.6 0 3-.4 4.2-1",
      adm_pin:"M9 4h6l-1 6 3 3H7l3-3z|M12 13v8", adm_down:"M12 4v11|M7 10l5 5 5-5|M5 20h14",
      adm_crown:"M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z", adm_chart:"M4 20V10|M10 20V4|M16 20v-7|M3 20h18",
      adm_voucher:"M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z|M9 9h.01|M15 15h.01|M15 9l-6 6",
      adm_back:"M15 5l-7 7 7 7",
    };
    if(!FK_LINE.lock) add.lock = add.adm_lock;
    Object.keys(add).forEach(k=>{ if(!FK_LINE[k]) FK_LINE[k] = add[k]; });
  }catch(e){ warn(e); }
}

/* ---------------------------------------------------------------------
   1. MỤC CỦA BẢNG ĐIỀU KHIỂN (mỗi mục chỉ hiện khi có ít nhất 1 quyền)
   --------------------------------------------------------------------- */
const SECTIONS = [];
function registerSection(def){
  if(!def || !def.id || typeof def.render !== "function") return false;
  const i = SECTIONS.findIndex(s=> s.id === def.id); if(i >= 0) SECTIONS.splice(i, 1);
  SECTIONS.push(Object.assign({ order: 100, perms:["panel.access"], icon:"adm_dash" }, def));
  SECTIONS.sort((a,b)=> a.order - b.order);
  if(A.open) renderShell();
  return true;
}
const visibleSections = ()=> SECTIONS.filter(s=> any(arr(s.perms)));

const A = { open:false, sec:"overview", root:null, users:[], uf:"all", uq:"", ptTab:"pending", ordSt:"", aq:"", ag:"", tkSt:"open", timer:null, lastTouch:0, prevHash:"" };

/* ---------------------------------------------------------------------
   2. KHUNG GIAO DIỆN
   --------------------------------------------------------------------- */
function ensureRoot(){
  if(A.root && document.body.contains(A.root)) return A.root;
  const el = document.createElement("div");
  el.id = "adm-root"; el.className = "adm"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Bảng quản trị TapEasy");
  document.body.appendChild(el);
  el.addEventListener("click", onClick);
  el.addEventListener("keydown", e=>{ if(e.key === "Escape"){ e.stopPropagation(); if(!closeModal()) close(); } touchSoon(); });
  el.addEventListener("input", touchSoon);
  A.root = el; return el;
}
function touchSoon(){ const n = Date.now(); if(n - A.lastTouch > 15000){ A.lastTouch = n; R.touch(); } }

function open(section){
  try{
    if(CA.demoAdminBlocked && CA.demoAdminBlocked()){ say("Bản cài đặt này chưa kết nối máy chủ nên không có chế độ quản trị.", "adm_lock"); return false; }   // QS-16
    addIcons(); ensureRoot();
    A.open = true; A.root.classList.add("open"); document.documentElement.classList.add("adm-lock");
    if(section) A.sec = section;
    if(R.active()) renderShell(); else renderLogin();
    clearInterval(A.timer); A.timer = setInterval(tick, 30000);
  }catch(e){ warn(e); }
  return true;
}
function close(){
  if(!A.root) return;
  A.open = false; A.root.classList.remove("open"); A.root.innerHTML = ""; document.documentElement.classList.remove("adm-lock");
  clearInterval(A.timer); A.timer = null;
  try{ if(location.hash === "#admin") history.replaceState(null, "", location.pathname + location.search); }catch(e){}
}
function tick(){
  if(!A.open) return;
  if(!R.active()){ if(q(".adm-shell", A.root)){ say("Phiên quản trị đã hết hạn", "adm_lock"); renderLogin(); } return; }
  const t = q("#adm-sess", A.root); if(t) t.textContent = sessText();
}
function sessText(){
  try{ const s = JSON.parse(sessionStorage.getItem(R.SESSION_KEY) || "null"); if(!s) return ""; const left = Math.max(0, R.config.idleMin * 60000 - (Date.now() - s.last)); return `Tự khoá sau ${Math.ceil(left/60000)} phút không thao tác`; }catch(e){ return ""; }
}
function say(msg, icon, kind){
  const t = A.root && q("#adm-toast", A.root);
  if(!t){ try{ toast(msg, icon); }catch(e){} return; }
  t.className = "adm-toast show " + (kind || ""); t.innerHTML = `${ic(icon || (kind === "err" ? "adm_x" : "check"))}<span>${esc(msg)}</span>`;
  clearTimeout(t._t); t._t = setTimeout(()=> t.classList.remove("show"), 3200);
}

function renderShell(){
  const root = ensureRoot();
  const secs = visibleSections();
  if(!secs.length){ renderLogin(); return; }
  if(!secs.find(s=> s.id === A.sec)) A.sec = secs[0].id;
  const c = R.current() || {}, sec = secs.find(s=> s.id === A.sec);
  root.innerHTML = `<div class="adm-shell">
    <aside class="adm-side" id="adm-side" aria-label="Mục quản trị">
      <div class="adm-brand">${brandMark()}<div><b>TapEasy</b><small>Bảng quản trị</small></div><button class="adm-ib adm-only-m" data-adm="side" aria-label="Đóng menu">${ic("adm_x")}</button></div>
      <div class="adm-me"><span class="adm-av">${esc(initial(c.name))}</span><div><b>${esc(c.name || "")}</b>${roleBadge(c.role)}</div></div>
      <nav class="adm-nav">${secs.map(s=> `<button class="adm-nav-i ${s.id === A.sec ? "on" : ""}" data-adm="nav" data-id="${esc(s.id)}" ${s.id === A.sec ? 'aria-current="page"' : ""}>${ic(s.icon)}<span>${esc(s.title)}</span>${s.badge ? `<i class="adm-nb" data-badge="${esc(s.id)}" hidden></i>` : ""}</button>`).join("")}</nav>
      <div class="adm-side-foot"><small id="adm-sess">${esc(sessText())}</small>
        <button class="adm-btn ghost" data-adm="logout">${ic("adm_lock")}Khoá phiên quản trị</button>
        <button class="adm-btn ghost" data-adm="close">${ic("adm_back")}Về ứng dụng</button></div>
    </aside>
    <div class="adm-scrim" data-adm="side"></div>
    <main class="adm-main">
      <header class="adm-top"><button class="adm-ib adm-only-m" data-adm="side" aria-label="Mở menu quản trị">${ic("adm_menu")}</button>
        <h1>${ic(sec.icon)}<span>${esc(sec.title)}</span></h1>
        <span class="adm-mode ${CA.mode}">${CA.mode === "firebase" ? "Máy chủ Firebase" : "Bản demo · lưu trên máy này"}</span>
        <button class="adm-ib" data-adm="close" aria-label="Đóng bảng quản trị">${ic("adm_x")}</button></header>
      <div class="adm-body" id="adm-body" tabindex="-1"><div class="adm-skel"></div><div class="adm-skel"></div></div>
    </main>
  </div>
  <div class="adm-modal-bd" id="adm-modal" hidden></div>
  <div class="adm-toast" id="adm-toast" role="status" aria-live="polite"></div>`;
  renderSection();
}
function brandMark(){ return `<span class="adm-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M9.5 10.5h13M16 10.5v12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><circle cx="16" cy="26" r="1.9" fill="currentColor"/></svg></span>`; }
async function renderSection(){
  const body = q("#adm-body", A.root); if(!body) return;
  const sec = visibleSections().find(s=> s.id === A.sec); if(!sec) return;
  const token = A.renderTok = Math.random();
  try{ await sec.render(body); }
  catch(e){ if(token === A.renderTok) body.innerHTML = errBox(e); }
  if(token !== A.renderTok) return;
  try{ body.focus({ preventScroll:true }); }catch(e){}
  try{ updateBadges(); }catch(e){}
}
const errBox = e=> `<div class="adm-card adm-err">${ic("adm_x")}<div><b>Không tải được dữ liệu</b><p>${esc(e && e.message || e)}</p>${e && e.code === "rbac/session" ? `<button class="adm-btn" data-adm="relogin">Đăng nhập lại</button>` : ""}</div></div>`;
async function updateBadges(){
  if(!A.open) return;
  const st = A.stats || null; if(!st) return;
  const set = (id, n)=>{ const b = q(`[data-badge="${id}"]`, A.root); if(b){ b.hidden = !n; b.textContent = n > 99 ? "99+" : String(n || ""); } };
  set("moderation", st.reportsOpen); set("pt", st.ptPending); set("support", st.ticketsOpen); set("shop", st.ordersPending);
}

/* ---------------------------------------------------------------------
   3. ĐĂNG NHẬP QUẢN TRỊ (thay "chạm 7 lần")
   --------------------------------------------------------------------- */
async function renderLogin(){
  const root = ensureRoot();
  const u = cloud.user, c = R.current(), lockS = R.lockedFor();
  let hasOwner = null; try{ hasOwner = await CA.hasOwner(); }catch(e){}
  const social = !!(cloud.profile && cloud.profile.provider && cloud.profile.provider !== "password");
  const demoSocial = CA.mode === "demo" && social;
  let body;
  if(!u){
    body = `<p class="adm-sub">Đăng nhập bằng tài khoản TapEasy đã được Chủ sở hữu cấp vai trò quản trị.</p>
      <div class="adm-f"><label for="adm-l-email">Email</label><input id="adm-l-email" type="email" autocomplete="username" inputmode="email" maxlength="120"></div>
      <div class="adm-f"><label for="adm-l-pw">Mật khẩu</label><input id="adm-l-pw" type="password" autocomplete="current-password" maxlength="128"></div>
      <button class="adm-btn pri block" data-adm="login-full">${ic("adm_lock")}Đăng nhập quản trị</button>`;
  } else if(c){
    body = `<div class="adm-who"><span class="adm-av lg">${esc(initial(u.name))}</span><div><b>${esc(u.name)}</b><small>${esc(u.email || "")}</small>${roleBadge(c.role)}</div></div>
      <p class="adm-sub">Vì an toàn, nhập lại mật khẩu mỗi khi mở bảng quản trị. Phiên tự khoá sau ${R.config.idleMin} phút không thao tác.</p>
      ${demoSocial ? `<p class="adm-note warn">Bản demo: tài khoản Google/Facebook giả lập không có mật khẩu nên không vào được bảng quản trị. Dùng tài khoản email + mật khẩu.</p>` :
        CA.mode === "firebase" && social ? `<p class="adm-note">Tài khoản đăng nhập bằng Google/Apple/Facebook — bấm xác nhận để xác thực lại trong cửa sổ đăng nhập.</p>` :
        `<div class="adm-f"><label for="adm-l-pw">Mật khẩu</label><input id="adm-l-pw" type="password" autocomplete="current-password" maxlength="128"></div>`}
      <button class="adm-btn pri block" data-adm="login">${ic("adm_unlock")}Vào bảng quản trị</button>`;
  } else {
    const boot = hasOwner === false || (hasOwner === null && CA.mode === "firebase");
    body = `<div class="adm-who"><span class="adm-av lg">${esc(initial(u.name))}</span><div><b>${esc(u.name)}</b><small>${esc(u.email || "")}</small>${roleBadge(null)}</div></div>
      <p class="adm-sub">Tài khoản này <b>chưa có vai trò quản trị</b>. Gửi mã tài khoản dưới đây cho Chủ sở hữu (hoặc Quản trị cấp cao) để được cấp quyền.</p>
      <div class="adm-uid"><code>${esc(u.uid)}</code><button class="adm-btn sm" data-adm="copy" data-v="${esc(u.uid)}">${ic("adm_copy")}Chép</button></div>
      ${boot ? `<div class="adm-boot"><b>${ic("adm_crown")}Khởi tạo Chủ sở hữu (chỉ dùng 1 lần)</b>
        <p class="adm-sub">${CA.mode === "firebase" ? "Ứng dụng chưa có Chủ sở hữu? Nhập mã khởi tạo do người triển khai đặt trong Secret Manager (OWNER_BOOTSTRAP_CODE)." : "Ứng dụng chưa có Chủ sở hữu. Bản demo: mã khởi tạo là mã ngẫu nhiên RIÊNG của máy này — người phát triển chạy cloudAdmin.demoBootCode() trong Console (docs/RBAC.md §5)."}</p>
        <div class="adm-f"><label for="adm-b-code">Mã khởi tạo</label><input id="adm-b-code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="80"></div>
        ${social ? "" : `<div class="adm-f"><label for="adm-l-pw">Mật khẩu tài khoản</label><input id="adm-l-pw" type="password" autocomplete="current-password" maxlength="128"></div>`}
        <button class="adm-btn pri block" data-adm="bootstrap">${ic("adm_crown")}Trở thành Chủ sở hữu</button></div>` : ""}`;
  }
  root.innerHTML = `<div class="adm-login"><div class="adm-login-card">
      <div class="adm-brand">${brandMark()}<div><b>TapEasy</b><small>Đăng nhập quản trị</small></div></div>
      ${lockS ? `<p class="adm-note warn">${ic("adm_lock")}Sai mật khẩu quá nhiều lần — thử lại sau ${Math.ceil(lockS/60)} phút.</p>` : ""}
      ${body}
      <p class="adm-fine">${ic("adm_shield")}Mọi thao tác quản trị đều được ghi vào nhật ký kiểm toán (không sửa, không xoá được). ${CA.mode === "demo" ? "Bản demo: quyền chỉ lưu trên máy này." : "Quyền được máy chủ kiểm tra bằng custom claims + firestore.rules."}</p>
      <button class="adm-btn ghost block" data-adm="close">${ic("adm_back")}Về ứng dụng</button>
    </div></div>
    <div class="adm-modal-bd" id="adm-modal" hidden></div><div class="adm-toast" id="adm-toast" role="status" aria-live="polite"></div>`;
  const f = q("#adm-l-email", root) || q("#adm-b-code", root) || q("#adm-l-pw", root); if(f) setTimeout(()=>{ try{ f.focus(); }catch(e){} }, 50);
  qa("input", root).forEach(i=> i.addEventListener("keydown", e=>{ if(e.key === "Enter"){ const b = q(".adm-login .adm-btn.pri", root); if(b) b.click(); } }));
}
async function doLogin(kind, btn){
  const pw = (q("#adm-l-pw", A.root) || {}).value || "";
  busy(btn, true);
  try{
    if(kind === "full"){ const em = (q("#adm-l-email", A.root) || {}).value || ""; await cloud.signIn(em, pw); }
    if(kind === "bootstrap"){ await CA.bootstrapOwner((q("#adm-b-code", A.root) || {}).value || ""); }
    await R.login(pw);
    A.sec = "overview"; renderShell(); say("Đã vào bảng quản trị", "adm_unlock");
  }catch(e){
    busy(btn, false);
    if(kind === "full" && cloud.user && e.code === "rbac/no-role"){ renderLogin(); return; }
    say(e.message, "adm_x", "err");
    const p = q("#adm-l-pw", A.root); if(p){ p.value = ""; try{ p.focus(); }catch(_){} }
  }
}
function busy(btn, on){ if(!btn) return; btn.disabled = !!on; btn.classList.toggle("busy", !!on); }

/* ---------------------------------------------------------------------
   4. HỘP THOẠI: xác nhận / nhập lý do / xác thực lại
   --------------------------------------------------------------------- */
function modal(html, opts){
  const bd = q("#adm-modal", A.root); if(!bd) return null;
  bd.hidden = false; bd.innerHTML = `<div class="adm-modal ${opts && opts.wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  bd.onclick = e=>{ if(e.target === bd) closeModal(); };
  const f = q("input, select, textarea, button.pri", bd); if(f) setTimeout(()=>{ try{ f.focus(); }catch(e){} }, 30);
  return q(".adm-modal", bd);
}
function closeModal(){ const bd = A.root && q("#adm-modal", A.root); if(!bd || bd.hidden) return false; bd.hidden = true; bd.innerHTML = ""; if(A._mres){ const r = A._mres; A._mres = null; r(null); } return true; }
const mHead = (t, sub)=> `<div class="adm-mh"><div><h2>${t}</h2>${sub ? `<small>${sub}</small>` : ""}</div><button class="adm-ib" data-adm="mclose" aria-label="Đóng">${ic("adm_x")}</button></div>`;
/** Xem trước thông báo hệ thống (mọi trường qua esc) */
function bcPreview(d){ return `<div class="adm-bc-prev ${d.level === "important" ? "imp" : ""}"><b>${esc(d.title)}</b><p>${esc(d.body)}</p>${d.link ? `<span>${esc(LINKS[d.link] || "")} ›</span>` : ""}</div><p class="adm-dim">Gửi tới: ${esc(AUD[d.audience] || "")}. Không sửa được sau khi gửi (chỉ thu hồi).</p>`; }
/** Hộp xác nhận: { title, msg (chữ thường — tự escape), preview (thông báo), label, danger, reason:{label, min}, typed:"CỤM TỪ" } → Promise<{reason}|null> */
function ask(o){
  return new Promise(res=>{
    A._mres = res;
    const m = modal(`${mHead(esc(o.title))}<p class="adm-sub">${esc(o.msg || "")}</p>${o.preview ? bcPreview(o.preview) : ""}
      ${o.reason ? `<div class="adm-f"><label for="adm-ask-r">${esc(o.reason.label || "Lý do")}</label><textarea id="adm-ask-r" rows="3" maxlength="300" placeholder="${esc(o.reason.ph || "")}"></textarea></div>` : ""}
      ${o.typed ? `<div class="adm-f"><label for="adm-ask-t">Gõ <b>${esc(o.typed)}</b> để xác nhận</label><input id="adm-ask-t" autocomplete="off" spellcheck="false"></div>` : ""}
      <div class="adm-mf"><button class="adm-btn ghost" data-adm="mclose">Huỷ</button><button class="adm-btn pri ${o.danger ? "danger" : ""}" id="adm-ask-ok">${esc(o.label || "Xác nhận")}</button></div>`);
    if(!m) return res(null);
    q("#adm-ask-ok", m).addEventListener("click", ()=>{
      const r = (q("#adm-ask-r", m) || {}).value || "", t = (q("#adm-ask-t", m) || {}).value || "";
      if(o.reason && r.trim().length < (o.reason.min || 4)){ say(`Nhập ${(o.reason.label || "lý do").toLowerCase()} (≥ ${o.reason.min || 4} ký tự)`, "adm_x", "err"); return; }
      if(o.typed && t.trim().toUpperCase() !== o.typed){ say(`Gõ đúng "${o.typed}"`, "adm_x", "err"); return; }
      A._mres = null; closeModal(); res({ reason: r.trim(), typed: t.trim() });
    });
  });
}
function askPassword(){
  const social = !!(cloud.profile && cloud.profile.provider && cloud.profile.provider !== "password");
  return new Promise(res=>{
    A._mres = res;
    const m = modal(`${mHead(ic("adm_lock") + "Xác nhận lại mật khẩu", "Thao tác nhạy cảm (phân quyền, chuyển nhượng, tài khoản nhận tiền)")}
      ${social ? `<p class="adm-sub">Tài khoản đăng nhập bằng mạng xã hội — bấm Xác nhận để xác thực lại.</p>` : `<div class="adm-f"><label for="adm-su-pw">Mật khẩu</label><input id="adm-su-pw" type="password" autocomplete="current-password" maxlength="128"></div>`}
      <div class="adm-mf"><button class="adm-btn ghost" data-adm="mclose">Huỷ</button><button class="adm-btn pri" id="adm-su-ok">Xác nhận</button></div>`);
    if(!m) return res(false);
    const go = async ()=>{ const b = q("#adm-su-ok", m); busy(b, true);
      try{ await R.stepUp((q("#adm-su-pw", m) || {}).value || ""); A._mres = null; closeModal(); res(true); }
      catch(e){ busy(b, false); say(e.message, "adm_x", "err"); } };
    q("#adm-su-ok", m).addEventListener("click", go);
    const pw = q("#adm-su-pw", m); if(pw) pw.addEventListener("keydown", e=>{ if(e.key === "Enter") go(); });
  });
}
/** Chạy thao tác ghi: tự hỏi xác thực lại khi cần, báo lỗi tiếng Việt, vẽ lại mục */
async function act(fn, okMsg, opts){
  opts = opts || {};
  for(let i = 0; i < 2; i++){
    try{ const r = await fn(); if(okMsg) say(okMsg, "check"); if(opts.rerender !== false) renderSection(); return r; }
    catch(e){
      if(e && e.code === "rbac/step-up" && i === 0){ if(await askPassword()) continue; return null; }
      if(e && e.code === "rbac/session"){ say(e.message, "adm_lock", "err"); renderLogin(); return null; }
      say(e && e.message || "Đã có lỗi", "adm_x", "err"); return null;
    }
  }
  return null;
}

/* ---------------------------------------------------------------------
   5. CSV (BOM UTF-8, chống CSV-injection) — ghi audit data.export
   --------------------------------------------------------------------- */
function toCSV(rows, cols){
  const cell = v=>{ let s = String(v == null ? "" : v); if(/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return "﻿" + [cols.map(c=> cell(c.label)).join(",")].concat(rows.map(r=> cols.map(c=> cell(c.get ? c.get(r) : r[c.key])).join(","))).join("\r\n");
}
function download(name, text){
  try{ if(G.TapEv && G.TapEv.downloadFile){ G.TapEv.downloadFile(name, text, "text/csv;charset=utf-8"); return; } }catch(e){}
  try{ const b = new Blob([text], { type:"text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500); }catch(e){ say("Trình duyệt không cho tải tệp", "adm_x", "err"); }
}
function exportCSV(name, rows, cols, what){
  if(!R.require("data.export", ()=> say("Bạn không có quyền xuất dữ liệu", "adm_lock", "err"))) return;
  download(name, toCSV(rows, cols));
  CA.appendAudit({ action:"data.export", target:{ type:"csv", id:name }, details:{ what, rows: rows.length } }).catch(()=>{});
  say(`Đã xuất ${nf(rows.length)} dòng`, "adm_down");
}

/* ---------------------------------------------------------------------
   6. CÁC MỤC
   --------------------------------------------------------------------- */
const kpi = (label, val, sub, go, tone)=> `<button class="adm-kpi ${tone || ""}" ${go ? `data-adm="nav" data-id="${esc(go)}"` : "disabled"}><span>${esc(label)}</span><b>${val == null ? "—" : esc(val)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
const card = (title, inner, extra)=> `<section class="adm-card">${title ? `<div class="adm-ch"><h3>${title}</h3>${extra || ""}</div>` : ""}${inner}</section>`;
const empty = t=> `<p class="adm-empty">${esc(t)}</p>`;

/* 6.1 Tổng quan */
registerSection({ id:"overview", title:"Tổng quan", icon:"adm_dash", order:10, perms:["panel.access"], render: async el=>{
  const st = A.stats = await CA.stats();
  const k = [];
  if(st.users != null) k.push(kpi("Người dùng", nf(st.users), st.new7 != null ? `+${nf(st.new7)} trong 7 ngày` : "", can("users.view") ? "users" : ""));
  if(st.pts != null) k.push(kpi("PT", nf(st.pts), st.ptPending ? `${nf(st.ptPending)} chờ xác minh` : "", any(["pt.view","pt.verify"]) ? "pt" : "", st.ptPending ? "hot" : ""));
  if(st.reportsOpen != null) k.push(kpi("Cần kiểm duyệt", nf(st.reportsOpen), "báo cáo / nội dung bị gắn cờ", "moderation", st.reportsOpen ? "hot" : ""));
  if(st.ticketsOpen != null) k.push(kpi("Yêu cầu hỗ trợ mở", nf(st.ticketsOpen), "", "support", st.ticketsOpen ? "hot" : ""));
  if(st.ordersPending != null) k.push(kpi("Đơn chờ xử lý", nf(st.ordersPending), `${nf(st.orders)} đơn tất cả`, "shop", st.ordersPending ? "hot" : ""));
  if(st.revenueMonth != null) k.push(kpi("Doanh thu tháng", money(st.revenueMonth), "đơn đặt (trừ huỷ)", any(["shop.orders","orders.view"]) ? "shop" : ""));
  if(st.challengesActive != null) k.push(kpi("Thử thách đang chạy", nf(st.challengesActive), `${nf(st.eventsUpcoming)} sự kiện sắp tới`, "events"));
  if(st.staff != null) k.push(kpi("Đội ngũ quản trị", nf(st.staff), "", "team"));
  const todo = [];
  if(st.ptPending && any(["pt.verify"])) todo.push(["pt", "adm_pt", `${st.ptPending} hồ sơ PT chờ xác minh`]);
  if(st.reportsOpen && any(["reports.resolve","community.moderate","reviews.moderate"])) todo.push(["moderation", "adm_flag", `${st.reportsOpen} mục cần kiểm duyệt`]);
  if(st.ticketsOpen && can("support.tickets")) todo.push(["support", "adm_help", `${st.ticketsOpen} yêu cầu hỗ trợ chưa trả lời`]);
  if(st.ordersPending && can("shop.orders")) todo.push(["shop", "adm_shop", `${st.ordersPending} đơn hàng chờ xác nhận`]);
  let chart = "";
  if(arr(st.signups).length){
    const max = Math.max(1, ...st.signups.map(s=> s.n)), w = 100 / st.signups.length;
    chart = card(`${ic("adm_chart")}Đăng ký mới 14 ngày`, `<svg class="adm-bars" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Biểu đồ đăng ký mới 14 ngày">${st.signups.map((s, i)=>{ const h = Math.max(s.n ? 2 : .6, s.n / max * 36); return `<rect x="${(i * w + w * .18).toFixed(2)}" y="${(38 - h).toFixed(2)}" width="${(w * .64).toFixed(2)}" height="${h.toFixed(2)}" rx="1"><title>${esc(s.day)}: ${s.n}</title></rect>`; }).join("")}</svg>
      <div class="adm-bars-x"><span>${esc(fd(st.signups[0].day))}</span><span>${esc(fd(st.signups[st.signups.length-1].day))}</span></div>`);
  }
  let recent = "";
  if(can("audit.view")){ try{ const a = (await CA.listAudit({ limit:6 })).slice(0, 6); recent = card(`${ic("adm_log")}Hoạt động gần đây`, a.length ? `<ul class="adm-mini">${a.map(e=> `<li><b>${esc(actionVi(e.action))}</b><span>${esc(e.actor && e.actor.name || "Hệ thống")} · ${esc(ago(e.ts))}</span></li>`).join("")}</ul>` : empty("Chưa có hoạt động."), `<button class="adm-btn sm ghost" data-adm="nav" data-id="audit">Xem tất cả</button>`); }catch(e){} }
  const c = R.current() || {};
  el.innerHTML = `<div class="adm-hello"><div><h2>Chào ${esc(c.name || "bạn")}</h2><p>${roleBadge(c.role)} <span>${esc(core.ROLES[c.role] ? core.ROLES[c.role].desc : "")}</span></p></div></div>
    <div class="adm-kpis">${k.join("") || empty("Vai trò của bạn không có số liệu tổng quan.")}</div>
    <div class="adm-grid2">${todo.length ? card(`${ic("check")}Việc cần làm`, `<div class="adm-todo">${todo.map(([id, icn, t])=> `<button data-adm="nav" data-id="${esc(id)}">${ic(icn)}<span>${esc(t)}</span>${ic("chevron_right")}</button>`).join("")}</div>`) : card(`${ic("check")}Việc cần làm`, empty("Không có việc tồn đọng."))}${chart}</div>
    ${recent}
    ${card(`${ic("adm_shield")}Quyền của bạn`, `<div class="adm-chips">${R.myPerms().map(p=> `<span class="adm-chip" title="${esc(p)}">${esc(R.label(p))}</span>`).join("")}</div>`)}`;
} });

/* 6.2 Người dùng */
registerSection({ id:"users", title:"Người dùng", icon:"adm_users", order:20, perms:["users.view"], render: async el=>{
  el.innerHTML = `<div class="adm-toolbar"><div class="adm-search">${ic("search")}<input id="adm-u-q" type="search" placeholder="Tìm tên${can("users.pii") ? ", email" : ""}, mã tài khoản…" value="${esc(A.uq)}" aria-label="Tìm người dùng"></div>
    <div class="adm-seg" role="tablist">${[["all","Tất cả"],["pt","PT"],["staff","Đội ngũ"],["banned","Bị khoá"]].map(([k,l])=> `<button role="tab" class="${A.uf === k ? "on" : ""}" aria-selected="${A.uf === k}" data-adm="uf" data-id="${k}">${l}</button>`).join("")}</div>
    ${can("data.export") ? `<button class="adm-btn sm" data-adm="u-csv">${ic("adm_down")}CSV</button>` : ""}</div><div id="adm-u-list"><div class="adm-skel"></div></div>`;
  const inp = q("#adm-u-q", el); let t = 0;
  inp.addEventListener("input", ()=>{ clearTimeout(t); t = setTimeout(()=>{ A.uq = inp.value; drawUsers(); }, 220); });
  await drawUsers();
} });
async function drawUsers(){
  const box = q("#adm-u-list", A.root); if(!box) return;
  try{ A.users = await CA.listUsers({ q:A.uq, filter:A.uf }); }catch(e){ box.innerHTML = errBox(e); return; }
  const list = A.users;
  box.innerHTML = list.length ? `<p class="adm-count">${nf(list.length)} tài khoản</p><div class="adm-table" role="table" aria-label="Danh sách người dùng">
    <div class="adm-tr adm-th" role="row"><span>Người dùng</span><span>Vai trò</span><span>PT</span><span>Tham gia</span><span>Trạng thái</span></div>
    ${list.slice(0, 300).map(u=> `<button class="adm-tr" role="row" data-adm="user" data-id="${esc(u.uid)}">
      <span class="adm-td-u" data-l="Người dùng"><span class="adm-av">${esc(initial(u.name))}</span><span><b>${esc(u.name || "(chưa đặt tên)")}</b><small>${esc(u.email || u.uid)}</small></span></span>
      <span data-l="Vai trò">${roleBadge(u.role)}</span>
      <span data-l="PT">${u.isPT ? (u.ptStatus === "verified" ? `<span class="adm-pill ok">${ic("adm_pt")}Đã xác minh</span>` : u.ptStatus === "pending" ? `<span class="adm-pill warn">Chờ duyệt</span>` : `<span class="adm-pill">PT</span>`) : "—"}</span>
      <span data-l="Tham gia">${esc(fd(u.createdAt))}</span>
      <span data-l="Trạng thái">${u.banned ? `<span class="adm-pill bad">${ic("adm_lock")}Bị khoá</span>` : `<span class="adm-pill ok">Hoạt động</span>`}</span></button>`).join("")}</div>`
    : empty(A.uq ? "Không tìm thấy người dùng phù hợp." : "Chưa có người dùng.");
}
async function openUser(uid){
  let u; try{ u = await CA.getUser(uid); }catch(e){ say(e.message, "adm_x", "err"); return; }
  const me = R.current() || {};
  const tgt = { uid:u.uid, role: u.role === "?" ? null : u.role, px: arr(u.px), banned: !!u.banned };
  const assignables = core.assignable(me.role, me.px);
  const canEdit = can("roles.assign") && u.role !== "?" && core.checkAssign(me, tgt, null, []).ok;
  const why = can("roles.assign") && !canEdit ? core.checkAssign(me, tgt, null, []).msg : "";
  const banChk = core.checkBan(me, tgt);
  let notes = "";
  if(any(["users.note", "support.tickets"])){ try{ const ns = await CA.listNotes(uid); notes = `<div class="adm-notes">${ns.length ? ns.map(n=> `<div class="adm-note-i"><p>${esc(n.text)}</p><small>${esc(n.byName || n.by)} · ${esc(fdt(n.ts))}</small></div>`).join("") : `<p class="adm-empty">Chưa có ghi chú.</p>`}</div>
    ${can("users.note") ? `<div class="adm-f"><label for="adm-n-t">Thêm ghi chú nội bộ (người dùng không thấy)</label><textarea id="adm-n-t" rows="2" maxlength="1000"></textarea></div><button class="adm-btn sm" data-adm="note-add" data-id="${esc(uid)}">Lưu ghi chú</button>` : ""}`; }catch(e){ notes = errBox(e); } }
  const roleOpts = `<option value="">— Không có vai trò (người dùng thường) —</option>` + assignables.map(r=> `<option value="${r}" ${tgt.role === r ? "selected" : ""}>${esc(core.ROLES[r].label)} · cấp ${core.ROLES[r].level}</option>`).join("");
  const m = modal(`${mHead(`${esc(u.name || "(chưa đặt tên)")} ${roleBadge(u.role)}`, `Tham gia ${esc(fd(u.createdAt))}${u.banned ? " · ĐANG BỊ KHOÁ" : ""}`)}
    <div class="adm-kv">
      <div><span>Mã tài khoản</span><b class="adm-mono">${esc(u.uid)} <button class="adm-ib sm" data-adm="copy" data-v="${esc(u.uid)}" aria-label="Chép mã">${ic("adm_copy")}</button></b></div>
      <div><span>Email</span><b>${esc(u.email || "—")}${!can("users.pii") ? ` <small class="adm-dim">(ẩn — cần quyền dữ liệu cá nhân)</small>` : ""}</b></div>
      <div><span>Đăng nhập bằng</span><b>${esc({ password:"Email & mật khẩu", google:"Google", facebook:"Facebook", apple:"Apple" }[u.provider] || u.provider || "—")}</b></div>
      <div><span>PT</span><b>${u.isPT ? (u.ptStatus === "verified" ? "Đã xác minh" : u.ptStatus === "pending" ? "Chờ xác minh" : "Chưa xác minh") + (u.listingHidden ? " · niêm yết đang ẩn" : "") : "Không"}</b></div>
      ${u.banned && u.ban ? `<div><span>Khoá</span><b>${esc(u.ban.reason || "")} · ${u.ban.until ? "đến " + esc(fd(u.ban.until)) : "vĩnh viễn"}</b></div>` : ""}
    </div>
    ${can("roles.assign") ? `<section class="adm-sub-card"><h4>${ic("adm_shield")}Vai trò quản trị</h4>
      ${canEdit ? `<div class="adm-f"><label for="adm-r-sel">Vai trò</label><select id="adm-r-sel">${roleOpts}</select></div>
        <details class="adm-px"><summary>Tuỳ chỉnh quyền riêng cho người này (nâng cao)</summary><div id="adm-px-box"></div></details>
        <div class="adm-f"><label for="adm-r-why">Lý do (ghi vào nhật ký)</label><input id="adm-r-why" maxlength="300" placeholder="VD: Phụ trách đơn hàng tháng 12"></div>
        <p class="adm-check" id="adm-r-chk"></p>
        <button class="adm-btn pri" data-adm="role-save" data-id="${esc(uid)}">${ic("adm_shield")}Lưu vai trò</button>`
      : `<p class="adm-note">${ic("adm_lock")}${esc(why)}</p>`}</section>` : ""}
    ${can("users.ban") ? `<section class="adm-sub-card"><h4>${ic("adm_lock")}Khoá tài khoản</h4>
      ${!banChk.ok ? `<p class="adm-note">${ic("adm_lock")}${esc(banChk.msg)}</p>` : u.banned ? `<button class="adm-btn" data-adm="unban" data-id="${esc(uid)}">${ic("adm_unlock")}Mở khoá</button>` :
        `<div class="adm-row"><div class="adm-f"><label for="adm-b-days">Thời hạn</label><select id="adm-b-days"><option value="1">1 ngày</option><option value="7" selected>7 ngày</option><option value="30">30 ngày</option><option value="0">Vĩnh viễn</option></select></div></div>
        <button class="adm-btn danger" data-adm="ban" data-id="${esc(uid)}">${ic("adm_lock")}Khoá tài khoản…</button>`}</section>` : ""}
    ${notes ? `<section class="adm-sub-card"><h4>${ic("adm_log")}Ghi chú nội bộ</h4>${notes}</section>` : ""}`, { wide:true });
  if(!m || !canEdit) return;
  const sel = q("#adm-r-sel", m), box = q("#adm-px-box", m), chk = q("#adm-r-chk", m);
  const drawPx = ()=>{
    const role = sel.value || null;
    if(!role){ box.innerHTML = `<p class="adm-dim">Chọn vai trò trước.</p>`; return; }
    const base = core.ROLES[role].perms, mine = core.grantable(me.role, me.px), cur = role === tgt.role ? tgt.px : [];
    const extra = mine.filter(p=> !base.includes(p));
    box.innerHTML = `<p class="adm-dim">Bỏ tick để <b>bớt</b> quyền của vai trò; tick thêm để <b>cấp lẻ</b> (chỉ các quyền bạn có, trừ quyền nhạy cảm).</p>
      <div class="adm-pxg">${base.filter(p=> p !== "panel.access").map(p=> `<label><input type="checkbox" data-px="-${esc(p)}" ${cur.includes("-" + p) ? "" : "checked"}><span>${esc(R.label(p))}</span></label>`).join("")}</div>
      ${extra.length ? `<p class="adm-dim" style="margin-top:8px">Cấp thêm:</p><div class="adm-pxg">${extra.map(p=> `<label><input type="checkbox" data-px="+${esc(p)}" ${cur.includes("+" + p) ? "checked" : ""}><span>${esc(R.label(p))}</span></label>`).join("")}</div>` : ""}`;
  };
  const readPx = ()=> qa("[data-px]", box).filter(i=> i.dataset.px[0] === "-" ? !i.checked : i.checked).map(i=> i.dataset.px);
  const check = ()=>{ const role = sel.value || null, r = core.checkAssign(me, tgt, role, role ? readPx() : []);
    const eff = role ? core.permsOf(role, readPx()) : [];
    chk.className = "adm-check " + (r.ok ? "ok" : "bad"); chk.innerHTML = r.ok ? `${ic("check")}Hợp lệ · ${eff.length} quyền` : `${ic("adm_x")}${esc(r.msg)}`; };
  sel.addEventListener("change", ()=>{ drawPx(); check(); }); box.addEventListener("change", check);
  drawPx(); check();
  A._roleCtx = { sel, readPx, tgt };
}

/* 6.3 Đội ngũ & phân quyền */
registerSection({ id:"team", title:"Đội ngũ & phân quyền", icon:"adm_shield", order:30, perms:["roles.view"], render: async el=>{
  const staff = await CA.listStaff();
  const me = R.current() || {};
  el.innerHTML = `${card(`${ic("adm_users")}Đội ngũ (${staff.length})`, `<div class="adm-staff">${staff.map(s=> `<div class="adm-st">
      <span class="adm-av">${esc(initial(s.name))}</span><div class="adm-st-b"><b>${esc(s.name)}${s.uid === me.uid ? ` <small class="adm-dim">(bạn)</small>` : ""}</b>${roleBadge(s.role)}
      ${s.px.length ? `<div class="adm-chips sm">${s.px.map(x=> `<span class="adm-chip ${x[0] === "+" ? "add" : "rm"}">${x[0] === "+" ? "+" : "−"} ${esc(R.label(x.slice(1)))}</span>`).join("")}</div>` : ""}
      <small class="adm-dim">${s.at ? "Cấp " + esc(ago(s.at)) : ""}</small></div>
      ${can("users.view") ? `<button class="adm-btn sm" data-adm="user" data-id="${esc(s.uid)}">Chi tiết</button>` : ""}</div>`).join("") || empty("Chưa có ai.")}</div>`,
      can("roles.assign") ? `<button class="adm-btn sm pri" data-adm="add-staff">${ic("adm_users")}Thêm người</button>` : "")}
    ${can("owner.transfer") ? card(`${ic("adm_crown")}Chuyển nhượng quyền Chủ sở hữu`, `<p class="adm-sub">Trao toàn quyền cho tài khoản khác (VD bán / bàn giao công ty). Bạn sẽ trở thành <b>Quản trị cấp cao</b>. Cần nhập lại mật khẩu và gõ cụm từ xác nhận. Không hoàn tác được nếu người nhận không chuyển lại.</p>
      <button class="adm-btn danger" data-adm="transfer">${ic("adm_crown")}Chuyển nhượng…</button>`) : ""}
    ${card(`${ic("adm_shield")}Ma trận quyền (${core.PERM_IDS.length} quyền × ${core.ROLE_ORDER.length} vai trò)`, matrixHTML())}
    ${card(`${ic("adm_lock")}Nguyên tắc`, `<ul class="adm-ul"><li>Chỉ <b>Chủ sở hữu</b> và <b>Quản trị cấp cao</b> gán vai trò; chỉ gán được vai trò <b>thấp hơn</b> mình, quyền là tập con của mình.</li><li>Không ai thay đổi hay khoá được người <b>ngang cấp / cấp cao hơn</b>; Chủ sở hữu được bảo vệ tuyệt đối, chỉ tự chuyển nhượng.</li><li>Quyền nhạy cảm (gán vai trò, chuyển nhượng, tài khoản nhận tiền, xoá tài khoản) không cấp lẻ được và cần nhập lại mật khẩu.</li><li>Mọi thay đổi ghi vào nhật ký kiểm toán chỉ-thêm.</li></ul>`)}`;
} });
function matrixHTML(){
  const groups = {}; core.PERM_IDS.forEach(p=>{ const g = core.PERMS[p].groupLabel; (groups[g] = groups[g] || []).push(p); });
  return `<div class="adm-mx-wrap"><table class="adm-mx"><thead><tr><th scope="col">Quyền</th>${core.ROLE_ORDER.map(r=> `<th scope="col" title="${esc(core.ROLES[r].label)}"><span>${esc(core.ROLES[r].label)}</span></th>`).join("")}</tr></thead><tbody>
    ${Object.keys(groups).map(g=> `<tr class="g"><th colspan="${core.ROLE_ORDER.length + 1}">${esc(g)}</th></tr>` + groups[g].map(p=> `<tr><th scope="row"><b>${esc(R.label(p))}</b><code>${esc(p)}</code></th>${core.ROLE_ORDER.map(r=> `<td>${core.ROLES[r].perms.includes(p) ? `<span class="y" aria-label="có">●</span>` : `<span class="n" aria-label="không">·</span>`}</td>`).join("")}</tr>`).join("")).join("")}
  </tbody></table></div>`;
}

/* 6.4 PT & niêm yết */
registerSection({ id:"pt", title:"Duyệt PT & niêm yết", icon:"adm_pt", order:40, badge:true, perms:["pt.view","pt.verify","listings.moderate"], render: async el=>{
  const list = await CA.listPT();
  const tabs = [["pending","Chờ duyệt"],["verified","Đã xác minh"],["other","Chưa gửi / từ chối"]];
  const pick = p=> A.ptTab === "pending" ? p.status === "pending" : A.ptTab === "verified" ? p.status === "verified" : !["pending","verified"].includes(p.status);
  const rows = list.filter(pick);
  el.innerHTML = `<div class="adm-toolbar"><div class="adm-seg">${tabs.map(([k,l])=> `<button class="${A.ptTab === k ? "on" : ""}" data-adm="pt-tab" data-id="${k}">${l} (${list.filter(p=> k === "pending" ? p.status === "pending" : k === "verified" ? p.status === "verified" : !["pending","verified"].includes(p.status)).length})</button>`).join("")}</div></div>
    ${A.ptTab === "pending" ? `<details class="adm-card adm-guide"><summary>${ic("check")}Quy trình xác minh PT (bấm để xem)</summary><ol class="adm-ul"><li>Đối chiếu <b>tên trên chứng chỉ</b> với tên tài khoản / CCCD (gọi video nếu cần).</li><li>Tra số chứng chỉ trên trang của đơn vị cấp (NASM, ACE, ISSA, Yoga Alliance, Tổng cục TDTT…), còn hạn.</li><li>Có bảo hiểm trách nhiệm / nơi làm việc rõ ràng (khuyến nghị).</li><li>Từ chối thì ghi rõ cần bổ sung gì — PT thấy lý do trong app.</li></ol></details>` : ""}
    <div class="adm-cards">${rows.map(p=> `<article class="adm-card adm-pt">
      <div class="adm-ch"><h3><span class="adm-av">${esc(initial(p.name))}</span>${esc(p.name || p.uid)}${p.sample ? ` <span class="adm-pill">mẫu</span>` : ""}</h3>${p.status === "verified" ? `<span class="adm-pill ok">${ic("adm_pt")}Đã xác minh</span>` : p.status === "pending" ? `<span class="adm-pill warn">Chờ duyệt</span>` : p.status === "rejected" ? `<span class="adm-pill bad">Từ chối</span>` : `<span class="adm-pill">Chưa gửi</span>`}</div>
      ${p.brand ? `<p class="adm-dim">${esc(p.brand)}${p.specialty ? " · " + esc(p.specialty) : ""}</p>` : ""}
      ${p.certName ? `<div class="adm-kv sm"><div><span>Chứng chỉ</span><b>${esc(p.certName)}</b></div><div><span>Số</span><b class="adm-mono">${esc(p.certNo || "—")}</b></div><div><span>Đơn vị cấp</span><b>${esc(p.issuer || "—")}</b></div><div><span>Kinh nghiệm</span><b>${esc(p.years || 0)} năm</b></div></div>` : ""}
      ${p.note ? `<p class="adm-quote">${esc(p.note)}</p>` : ""}${p.reviewNote ? `<p class="adm-dim">Ghi chú duyệt: ${esc(p.reviewNote)}</p>` : ""}
      <div class="adm-acts">
        ${can("pt.verify") && p.status !== "verified" && p.certName ? `<button class="adm-btn pri sm" data-adm="pt-ok" data-id="${esc(p.uid)}">${ic("check")}Xác minh</button>` : ""}
        ${can("pt.verify") && p.status === "pending" ? `<button class="adm-btn sm" data-adm="pt-no" data-id="${esc(p.uid)}">Từ chối…</button>` : ""}
        ${can("pt.verify") && p.status === "verified" ? `<button class="adm-btn sm" data-adm="pt-no" data-id="${esc(p.uid)}">Thu hồi tích xanh…</button>` : ""}
        ${can("listings.moderate") ? `<button class="adm-btn sm ${p.listingHidden ? "" : "ghost"}" data-adm="listing" data-id="${esc(p.uid)}" data-v="${p.listingHidden ? 0 : 1}">${ic(p.listingHidden ? "visibility" : "adm_eye_off")}${p.listingHidden ? "Hiện lại trên Tìm PT" : "Ẩn khỏi Tìm PT…"}</button>` : ""}
      </div></article>`).join("") || empty("Không có hồ sơ trong mục này.")}</div>`;
} });

/* 6.5 Kiểm duyệt */
registerSection({ id:"moderation", title:"Kiểm duyệt", icon:"adm_flag", order:50, badge:true, perms:["reports.view","reviews.moderate","community.moderate"], render: async el=>{
  const list = await CA.modQueue();
  const permFor = it=> it.type === "routine" ? "community.moderate" : it.type === "review" ? "reviews.moderate" : "reports.resolve";
  const TYPE = { routine:"Routine cộng đồng", review:"Đánh giá sự kiện", report:"Báo cáo" };
  el.innerHTML = `<p class="adm-note">${ic("adm_flag")}Ẩn / xoá khi nội dung <b>vi phạm</b>: xúc phạm, quấy rối, spam quảng cáo, thông tin sức khoẻ sai lệch nguy hiểm, lộ thông tin cá nhân. <b>Không</b> ẩn đánh giá chỉ vì chê.</p>
    <div class="adm-cards">${list.map((it, i)=> `<article class="adm-card adm-mod">
      <div class="adm-ch"><h3><span class="adm-pill">${esc(TYPE[it.type] || it.type)}</span>${esc(cleanText(it.title))}${it.sample ? ` <span class="adm-pill">mẫu</span>` : ""}</h3>${it.count ? `<span class="adm-pill bad">${nf(it.count)} báo cáo</span>` : ""}</div>
      ${it.text ? `<p class="adm-quote">${esc(cleanText(String(it.text).slice(0, 400)))}</p>` : ""}
      <p class="adm-dim">${it.author ? "Tác giả: " + esc(it.author) + " · " : ""}${esc(ago(it.ts))}${it.hidden ? " · đang tạm ẩn" : ""}</p>
      ${arr(it.reasons).length ? `<div class="adm-chips sm">${arr(it.reasons).slice(0, 6).map(r=> `<span class="adm-chip">${esc(r)}</span>`).join("")}</div>` : ""}
      ${can(permFor(it)) ? `<div class="adm-acts"><button class="adm-btn sm" data-adm="mod" data-i="${i}" data-a="keep">${ic("check")}${it.type === "report" ? "Bỏ qua" : "Giữ / khôi phục"}</button>
        ${it.type !== "report" ? `<button class="adm-btn sm" data-adm="mod" data-i="${i}" data-a="hide">${ic("adm_eye_off")}Ẩn</button>` : `<button class="adm-btn sm" data-adm="mod" data-i="${i}" data-a="hide">${ic("check")}Đã xử lý</button>`}
        ${it.type !== "report" ? `<button class="adm-btn sm danger" data-adm="mod" data-i="${i}" data-a="delete">${ic("delete")}Xoá</button>` : ""}</div>` : `<p class="adm-dim">${ic("adm_lock")}Chỉ xem — cần quyền ${esc(R.label(permFor(it)))}.</p>`}
    </article>`).join("") || empty("Hàng đợi trống — cộng đồng đang ổn.")}</div>`;
  A._mod = list;
} });

/* 6.6 Nội dung */
function kbModule(){ return G.TE_KB || G.TEKB || G.TapKB || G.KB || null; }
registerSection({ id:"content", title:"Nội dung", icon:"adm_book", order:60, perms:["kb.edit","kb.publish","community.feature"], render: async el=>{
  const KB = kbModule();
  let kbHtml;
  if(KB){
    let items = []; try{ items = typeof KB.adminList === "function" ? await KB.adminList() : typeof KB.list === "function" ? await KB.list({ all:true }) : []; }catch(e){}
    kbHtml = `<p class="adm-sub">Kho kiến thức đã cài${items.length ? ` · ${nf(items.length)} bài` : ""}. ${can("kb.publish") ? "Bạn được xuất bản / gỡ bài." : "Bạn soạn được bài; xuất bản cần quyền " + esc(R.label("kb.publish")) + "."}</p>
      ${arr(items).length ? `<div class="adm-list">${items.slice(0, 50).map(a=> `<div class="adm-li"><div><b>${esc(a.title || a.id)}</b><small>${esc(a.status || (a.published ? "published" : "draft"))}${a.updatedAt ? " · " + esc(ago(a.updatedAt)) : ""}</small></div>
        ${can("kb.publish") && typeof KB.setPublished === "function" ? `<button class="adm-btn sm" data-adm="kb-pub" data-id="${esc(a.id)}" data-v="${(a.status === "published" || a.published) ? 0 : 1}">${(a.status === "published" || a.published) ? "Gỡ" : "Xuất bản"}</button>` : ""}</div>`).join("")}</div>` : ""}
      ${typeof KB.open === "function" ? `<button class="adm-btn" data-adm="kb-open">${ic("adm_book")}Mở kho kiến thức</button>` : ""}`;
  } else kbHtml = `<p class="adm-sub">Chưa cài module kho kiến thức (kb.js). Khi cài, module chỉ cần đọc <code>teCan('kb.edit')</code> / <code>teCan('kb.publish')</code> hoặc gọi <code>TE_ADMIN.registerSection()</code> — xem docs/INTEGRATION-admin.md §6.</p>`;
  let feat = "";
  if(can("community.feature") && cloud.social && cloud.social.listRoutines){
    let rs = []; try{ rs = (await cloud.social.listRoutines()).filter(r=> !cloud.social.moderation.isHidden(r)).sort((a,b)=> (b.likes||0) - (a.likes||0)).slice(0, 12); }catch(e){}
    const on = new Set(CA.featuredIds());
    feat = card(`${ic("adm_pin")}Ghim routine nổi bật (cộng đồng)`, rs.length ? `<div class="adm-list">${rs.map(r=> `<div class="adm-li"><div><b>${esc(cleanText(r.title))}</b><small>${esc(r.authorName || "")} · ${nf(r.likes)} thích · ${nf(r.copies)} sao chép</small></div>
      <button class="adm-btn sm ${on.has(r.id) || r.featured ? "pri" : ""}" data-adm="feat" data-id="${esc(r.id)}" data-v="${on.has(r.id) || r.featured ? 0 : 1}">${ic("adm_pin")}${on.has(r.id) || r.featured ? "Bỏ ghim" : "Ghim"}</button></div>`).join("")}</div>` : empty("Chưa có routine công khai."));
  }
  el.innerHTML = card(`${ic("adm_book")}Kho kiến thức`, kbHtml) + feat + extraHook("content");
} });

/* 6.7 Sự kiện & thử thách */
registerSection({ id:"events", title:"Sự kiện & thử thách", icon:"adm_cal", order:70, perms:["events.manage","challenges.manage","events.checkin"], render: async el=>{
  const CE = G.cloudEvents;
  if(!CE){ el.innerHTML = card("", empty("Chưa cài module Sự kiện (cloud-events.js / events.js).")); return; }
  const today = new Date().toISOString().slice(0, 10);
  const [chs, evs] = await Promise.all([CE.listChallenges(), CE.listEvents()]);
  const actCh = chs.filter(c=> c.start <= today && c.end >= today), upEv = evs.filter(e=> String(e.end || e.start).slice(0, 10) >= today).sort((a,b)=> String(a.start).localeCompare(String(b.start)));
  el.innerHTML = `<div class="adm-kpis">${kpi("Thử thách đang chạy", nf(actCh.length))}${kpi("Sự kiện sắp tới", nf(upEv.length))}${kpi("Lượt đăng ký", nf(evs.reduce((a,e)=> a + (Number(e.regCount)||0), 0)))}</div>
    ${G.TapEv && G.TapEv.open ? `<button class="adm-btn pri" data-adm="ev-open">${ic("adm_cal")}Mở công cụ Sự kiện đầy đủ (tạo / sửa / chốt quà)</button>` : ""}
    ${can("events.checkin") ? card(`${ic("check")}Check-in nhanh tại quầy`, `<div class="adm-row"><div class="adm-f"><label for="adm-ci-ev">Sự kiện</label><select id="adm-ci-ev">${upEv.map(e=> `<option value="${esc(e.id)}">${esc(e.title)} · ${esc(String(e.start).slice(0, 10))}</option>`).join("")}</select></div>
      <div class="adm-f"><label for="adm-ci-code">Mã vé 6 ký tự</label><input id="adm-ci-code" maxlength="6" autocapitalize="characters" autocomplete="off"></div></div><button class="adm-btn" data-adm="ev-ci">Check-in</button>`) : ""}
    ${card(`${ic("adm_chart")}Thử thách (${chs.length})`, `<div class="adm-list">${chs.slice().sort((a,b)=> String(b.start).localeCompare(String(a.start))).slice(0, 20).map(c=> `<div class="adm-li"><div><b>${esc(c.title)}</b><small>${esc(fd(c.start))} → ${esc(fd(c.end))} · mục tiêu ${esc(c.target)} ${esc(c.unit || "")}${c.hidden ? " · đang ẩn" : ""}</small></div><span class="adm-pill ${c.start <= today && c.end >= today ? "ok" : ""}">${c.start > today ? "Sắp tới" : c.end < today ? "Đã kết thúc" : "Đang chạy"}</span></div>`).join("") || empty("Chưa có thử thách.")}</div>`)}
    ${card(`${ic("adm_cal")}Sự kiện offline (${evs.length})`, `<div class="adm-list">${evs.slice().sort((a,b)=> String(b.start).localeCompare(String(a.start))).slice(0, 20).map(e=> `<div class="adm-li"><div><b>${esc(e.title)}</b><small>${esc(String(e.start).replace("T", " "))} · ${esc(e.city || "")} · ${nf(e.regCount)}/${nf(e.capacity)} chỗ${e.hidden ? " · đang ẩn" : ""}</small></div></div>`).join("") || empty("Chưa có sự kiện.")}</div>`)}`;
} });

/* 6.8 Cửa hàng & đơn hàng */
const OST = { awaiting_payment:"Chờ chuyển khoản", pending:"Chờ xác nhận", confirmed:"Đã xác nhận", shipping:"Đang giao", delivered:"Đã giao", cancelled:"Đã huỷ" };
registerSection({ id:"shop", title:"Cửa hàng & đơn hàng", icon:"adm_shop", order:80, badge:true, perms:["shop.orders","orders.view","shop.products","vouchers.manage","gifts.manage"], render: async el=>{
  const CE = G.cloudEvents; let html = "";
  if(CE && any(["shop.orders","orders.view"])){
    const orders = await CE.allOrders();
    const m = new Date().toISOString().slice(0, 7), live = orders.filter(o=> o.status !== "cancelled");
    const list = orders.filter(o=> !A.ordSt || o.status === A.ordSt).sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
    const showPhone = any(["shop.orders","users.pii"]);
    A._orders = list;
    html += `<div class="adm-kpis">${kpi("Đơn chờ xử lý", nf(orders.filter(o=> ["pending","awaiting_payment"].includes(o.status)).length), "", "", "hot")}${kpi("Doanh thu tháng", money(live.filter(o=> new Date(o.createdAt||0).toISOString().slice(0,7) === m).reduce((a,o)=> a + (Number(o.total)||0), 0)))}${kpi("Tổng đơn", nf(orders.length))}</div>`;
    html += card(`${ic("adm_shop")}Đơn hàng`, `<div class="adm-toolbar"><div class="adm-seg">${[["","Tất cả"]].concat(Object.entries(OST)).map(([k,l])=> `<button class="${A.ordSt === k ? "on" : ""}" data-adm="ord-st" data-id="${k}">${esc(l)}</button>`).join("")}</div>${can("data.export") ? `<button class="adm-btn sm" data-adm="ord-csv">${ic("adm_down")}CSV</button>` : ""}</div>
      <div class="adm-table ord" role="table"><div class="adm-tr adm-th" role="row"><span>Mã đơn</span><span>Khách</span><span>Tổng</span><span>Thanh toán</span><span>Trạng thái</span></div>
      ${list.slice(0, 150).map(o=> { const a = obj(o.address); return `<div class="adm-tr" role="row"><span data-l="Mã đơn"><b class="adm-mono">${esc(o.code || o.id)}</b><small>${esc(fdt(o.createdAt))}</small></span>
        <span data-l="Khách">${esc(a.name || "")}<small>${esc(showPhone ? (a.phone || "") : core.mask(a.phone || "", 3))}${a.province ? " · " + esc(a.province) : ""}</small></span>
        <span data-l="Tổng"><b>${esc(money(o.total))}</b><small>${arr(o.items).reduce((s,i)=> s + (i.qty||0), 0)} sp</small></span>
        <span data-l="Thanh toán">${o.payment === "bank" ? "Chuyển khoản" : "COD"}</span>
        <span data-l="Trạng thái">${can("shop.orders") ? `<select data-adm-ord="${esc(o.id)}" aria-label="Trạng thái đơn ${esc(o.code || "")}">${Object.entries(OST).map(([k,l])=> `<option value="${k}" ${o.status === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : `<span class="adm-pill">${esc(OST[o.status] || o.status)}</span>`}</span></div>`; }).join("") || `<p class="adm-empty">Không có đơn.</p>`}</div>
      ${can("shop.orders") && !can("shop.refund") ? `<p class="adm-dim">${ic("adm_lock")}Huỷ đơn đã xác nhận (hoàn tiền) cần quyền ${esc(R.label("shop.refund"))}.</p>` : ""}`);
  }
  if(can("vouchers.manage")){
    let vs = []; try{ vs = await CA.listVouchers(); }catch(e){}
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    html += card(`${ic("adm_voucher")}Mã giảm giá toàn hệ thống`, `<div class="adm-row wrap">
      <div class="adm-f"><label for="adm-v-code">Mã</label><input id="adm-v-code" maxlength="16" autocapitalize="characters" placeholder="VD: TAPEASY12"></div>
      <div class="adm-f"><label for="adm-v-kind">Loại</label><select id="adm-v-kind"><option value="amount">Giảm số tiền</option><option value="percent">Giảm %</option><option value="freeship">Miễn phí ship</option></select></div>
      <div class="adm-f"><label for="adm-v-val">Giá trị</label><input id="adm-v-val" type="number" min="0" step="1000" value="20000"></div>
      <div class="adm-f"><label for="adm-v-min">Đơn tối thiểu</label><input id="adm-v-min" type="number" min="0" step="1000" value="199000"></div>
      <div class="adm-f"><label for="adm-v-uses">Số lượt</label><input id="adm-v-uses" type="number" min="1" value="100"></div>
      <div class="adm-f"><label for="adm-v-exp">Hết hạn</label><input id="adm-v-exp" type="date" value="${d30}"></div></div>
      <button class="adm-btn pri" data-adm="v-save">${ic("adm_voucher")}Tạo mã</button>
      <div class="adm-list">${vs.map(v=> `<div class="adm-li"><div><b class="adm-mono">${esc(v.code)}</b><small>${v.kind === "percent" ? esc(v.value) + "%" : v.kind === "freeship" ? "Miễn ship" : esc(money(v.value))} · đơn từ ${esc(money(v.min))} · ${nf(v.used || 0)}/${nf(v.uses)} lượt · HSD ${esc(fd(v.exp))}${v.revoked ? " · ĐÃ THU HỒI" : ""}</small></div>${v.revoked ? "" : `<button class="adm-btn sm ghost" data-adm="v-revoke" data-id="${esc(v.code)}">Thu hồi</button>`}</div>`).join("")}</div>`);
  }
  if(G.TapEv && G.TapEv.open && any(["shop.products","gifts.manage"])) html += card(`${ic("adm_shop")}Sản phẩm & quà tặng`, `<p class="adm-sub">Sửa sản phẩm (giá, màu, size, tồn kho) và trạng thái giao quà trong công cụ Gian hàng.</p><button class="adm-btn" data-adm="ev-open">Mở công cụ sản phẩm / quà</button>`);
  el.innerHTML = html || empty("Không có dữ liệu cửa hàng.");
  qa("[data-adm-ord]", el).forEach(s=> s.addEventListener("change", async ()=>{ const prev = (A._orders.find(o=> o.id === s.dataset.admOrd) || {}).status;
    const ok = await act(()=> G.cloudEvents.updateOrder(s.dataset.admOrd, { status: s.value }), "Đã cập nhật đơn"); if(ok === null && prev) s.value = prev; }));
} });

/* 6.9 Hỗ trợ khách hàng */
const TOPIC = { order:"Đơn hàng", account:"Tài khoản", pt:"PT", event:"Sự kiện", bug:"Lỗi app", other:"Khác" };
registerSection({ id:"support", title:"Hỗ trợ khách hàng", icon:"adm_help", order:85, badge:true, perms:["support.tickets"], render: async el=>{
  if(A.supTab === "feedback") return renderFeedbackPanel(el);      // 13/11: thẻ "Góp ý & NPS" (feedback.js)
  const list = await CA.listTickets();
  const rows = list.filter(t=> !A.tkSt || t.status === A.tkSt);
  el.innerHTML = supTabs() + `<div class="adm-toolbar"><div class="adm-seg">${[["open","Mới"],["answered","Đã trả lời"],["closed","Đã đóng"],["","Tất cả"]].map(([k,l])=> `<button class="${A.tkSt === k ? "on" : ""}" data-adm="tk-st" data-id="${k}">${l} (${list.filter(t=> !k || t.status === k).length})</button>`).join("")}</div></div>
    <div class="adm-cards">${rows.map(t=> `<article class="adm-card"><div class="adm-ch"><h3><span class="adm-pill">${esc(TOPIC[t.topic] || t.topic)}</span>${esc(t.name || t.uid)}${t.sample ? ` <span class="adm-pill">mẫu</span>` : ""}</h3><span class="adm-pill ${t.status === "open" ? "warn" : t.status === "closed" ? "" : "ok"}">${t.status === "open" ? "Mới" : t.status === "answered" ? "Đã trả lời" : "Đã đóng"}</span></div>
      <p class="adm-quote">${esc(t.text)}</p>${arr(t.replies).map(r=> `<div class="adm-reply ${r.staff ? "staff" : ""}"><p>${esc(r.text)}</p><small>${esc(r.name || "")} · ${esc(fdt(r.ts))}</small></div>`).join("")}
      <p class="adm-dim">${esc(fdt(t.createdAt))}</p>
      ${t.status !== "closed" ? `<div class="adm-f"><label for="adm-tk-${esc(t.id)}">Trả lời</label><textarea id="adm-tk-${esc(t.id)}" rows="2" maxlength="2000"></textarea></div>
        <div class="adm-acts"><button class="adm-btn pri sm" data-adm="tk-reply" data-id="${esc(t.id)}">Gửi trả lời</button><button class="adm-btn sm ghost" data-adm="tk-close" data-id="${esc(t.id)}">Đóng yêu cầu</button>${can("users.view") && !t.sample ? `<button class="adm-btn sm ghost" data-adm="user" data-id="${esc(t.uid)}">Xem người dùng</button>` : ""}</div>` : ""}
    </article>`).join("") || empty("Không có yêu cầu nào.")}</div>`;
} });

/* 6.9b Góp ý & NPS (feedback.js · docs/FEEDBACK.md) — thẻ con của "Hỗ trợ khách hàng"; đọc collection `feedback` (rules: support.tickets).
   Liên hệ (email/SĐT người dùng TỰ cho phép) chỉ hiện khi có thêm quyền users.pii. Ảnh chụp màn hình chỉ nhận data:image/jpeg|webp. */
const FB_CAT = { bug:"Lỗi", idea:"Ý tưởng", content:"Nội dung", other:"Khác" };
const FB_ST = { new:"Mới", seen:"Đã xem", done:"Đã xử lý" };
function fbNps(list, since){
  if(G.FKFeedback && typeof G.FKFeedback.npsSummary === "function") return G.FKFeedback.npsSummary(list, since);
  const rows = arr(list).filter(x=> x && x.kind === "nps" && Number.isInteger(x.score) && (!since || (x.createdAt || 0) >= since));
  const dist = Array.from({ length: 11 }, ()=> 0); rows.forEach(x=> dist[x.score]++);
  const n = rows.length, pro = rows.filter(x=> x.score >= 9).length, det = rows.filter(x=> x.score <= 6).length;
  return { n, promoters: pro, passives: n - pro - det, detractors: det, nps: n ? Math.round((pro - det) / n * 100) : null, avg: null, dist };
}
const fbShot = s=> typeof s === "string" && /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : "";
/* Thẻ con trong mục "Hỗ trợ khách hàng" (không thêm mục mới vào thanh bên — cùng quyền support.tickets) */
const supTabs = ()=> `<div class="adm-toolbar"><div class="adm-seg" role="tablist" aria-label="Hỗ trợ khách hàng">${[["tickets","Yêu cầu hỗ trợ"],["feedback","Góp ý & NPS"]].map(([k, l])=> `<button role="tab" aria-selected="${(A.supTab || "tickets") === k ? "true" : "false"}" class="${(A.supTab || "tickets") === k ? "on" : ""}" data-adm="sup-tab" data-id="${k}">${esc(l)}</button>`).join("")}</div></div>`;
async function renderFeedbackPanel(el){
  if(!can("support.tickets")){ el.innerHTML = empty("Bạn không có quyền xem góp ý."); return; }
  const list = arr(await cloud.feedback.list(300));
  A._fb = list;
  const k = A.fbKind || "", c = A.fbCat || "", st = A.fbSt == null ? "new" : A.fbSt;
  const rows = list.filter(f=> (!k || f.kind === k) && (!c || f.category === c) && (!st || (f.status || "new") === st));
  const s90 = fbNps(list, Date.now() - 90 * 86400000), sAll = fbNps(list);
  const max = Math.max(1, ...s90.dist);
  const npsTone = s90.nps == null ? "" : s90.nps >= 30 ? "ok" : s90.nps < 0 ? "hot" : "";
  const seg = (key, cur, opts)=> `<div class="adm-seg">${opts.map(([v, l])=> `<button class="${cur === v ? "on" : ""}" data-adm="${key}" data-id="${esc(v)}">${esc(l)}</button>`).join("")}</div>`;
  const segKind = seg("fb-kind", k, [["","Tất cả"],["feedback","Góp ý"],["nps","NPS"]]);
  const segCat = seg("fb-cat", c, [["","Mọi loại"]].concat(Object.entries(FB_CAT)));
  const segSt = seg("fb-st", st, [["new","Mới"],["seen","Đã xem"],["done","Đã xử lý"],["","Tất cả"]]);
  el.innerHTML = supTabs() + `<div class="adm-kpis">
      ${kpi("NPS 90 ngày", s90.nps == null ? "—" : String(s90.nps), s90.n ? `${s90.n} lượt · TB ${s90.avg == null ? "—" : s90.avg}` : "chưa có lượt chấm", "", npsTone)}
      ${kpi("Ủng hộ (9–10)", String(s90.promoters), s90.n ? Math.round(s90.promoters / s90.n * 100) + "%" : "", "")}
      ${kpi("Trung lập (7–8)", String(s90.passives), s90.n ? Math.round(s90.passives / s90.n * 100) + "%" : "", "")}
      ${kpi("Phản đối (0–6)", String(s90.detractors), s90.n ? Math.round(s90.detractors / s90.n * 100) + "%" : "", "", s90.detractors ? "hot" : "")}
      ${kpi("Góp ý mới", String(list.filter(f=> f.kind === "feedback" && (f.status || "new") === "new").length), `NPS toàn thời gian: ${sAll.nps == null ? "—" : sAll.nps}`, "")}
    </div>
    ${card(`${ic("adm_chart")}Phân bố điểm NPS (90 ngày)`, `<div class="adm-nps-bars" role="img" aria-label="Phân bố điểm 0 đến 10">${s90.dist.map((n, i)=> `<div class="adm-nps-col ${i >= 9 ? "pro" : i >= 7 ? "pas" : "det"}"><i style="height:${Math.round(n / max * 100)}%"></i><b>${esc(String(n))}</b><small>${i}</small></div>`).join("")}</div>`)}
    <div class="adm-toolbar">${segKind}${segCat}${segSt}</div>
    <div class="adm-cards">${rows.map(f=>{
      const shot = fbShot(f.shot), d = obj(f.device);
      return `<article class="adm-card"><div class="adm-ch"><h3>${f.kind === "nps" ? `<span class="adm-pill ${f.score >= 9 ? "ok" : f.score <= 6 ? "warn" : ""}">NPS ${esc(String(f.score))}</span>` : `<span class="adm-pill">${esc(FB_CAT[f.category] || f.category || "Khác")}</span>`}
        <small class="adm-dim">${esc(fdt(f.createdAt))}</small></h3><span class="adm-pill ${(f.status || "new") === "new" ? "warn" : (f.status === "done" ? "ok" : "")}">${esc(FB_ST[f.status || "new"] || f.status)}</span></div>
        ${f.text ? `<p class="adm-quote">${esc(f.text)}</p>` : `<p class="adm-dim">(không ghi lý do)</p>`}
        ${shot ? `<a class="adm-fb-shot" href="${esc(shot)}" target="_blank" rel="noopener noreferrer"><img src="${esc(shot)}" alt="Ảnh chụp màn hình kèm góp ý" loading="lazy"></a>` : ""}
        <p class="adm-dim">${esc(["v" + (f.appVersion || "?"), d.platform, d.os, d.screen, d.theme, f.screen ? "màn " + f.screen : "", f.trigger ? "mở từ " + f.trigger : ""].filter(Boolean).join(" · "))}</p>
        ${f.contact ? (can("users.pii") ? `<p class="adm-dim">Liên hệ (người dùng cho phép): <b>${esc(f.contact)}</b></p>` : `<p class="adm-dim">Có thông tin liên hệ — cần quyền "users.pii" để xem.</p>`) : ""}
        <div class="adm-acts">${(f.status || "new") !== "seen" ? `<button class="adm-btn sm ghost" data-adm="fb-mark" data-id="${esc(f.id)}|seen">Đánh dấu đã xem</button>` : ""}${f.status !== "done" ? `<button class="adm-btn sm" data-adm="fb-mark" data-id="${esc(f.id)}|done">Đã xử lý</button>` : ""}</div>
      </article>`; }).join("") || empty("Không có góp ý nào khớp bộ lọc.")}</div>`;
}

/* 6.10 Thông báo toàn hệ thống */
const AUD = { all:"Tất cả người dùng", pt:"Chỉ PT", member:"Chỉ học viên / thành viên", staff:"Chỉ đội ngũ quản trị" };
const LINKS = { "":"Không có nút", events:"Mở Sự kiện & Thi đua", shop:"Mở Gian hàng", community:"Mở Cộng đồng", findpt:"Mở Tìm PT", kb:"Mở Kho kiến thức" };
registerSection({ id:"broadcast", title:"Thông báo hệ thống", icon:"adm_bcast", order:90, perms:["broadcast.send"], render: async el=>{
  const list = await CA.listBroadcasts();
  el.innerHTML = `<div class="adm-grid2">${card(`${ic("adm_bcast")}Soạn thông báo`, `
      <div class="adm-f"><label for="adm-bc-t">Tiêu đề (≤ 60 ký tự)</label><input id="adm-bc-t" maxlength="60" placeholder="VD: Giải chạy TapEasy Run tháng 12 mở đăng ký"></div>
      <div class="adm-f"><label for="adm-bc-b">Nội dung (≤ 300 ký tự)</label><textarea id="adm-bc-b" rows="4" maxlength="300"></textarea></div>
      <div class="adm-row"><div class="adm-f"><label for="adm-bc-a">Gửi tới</label><select id="adm-bc-a">${Object.entries(AUD).map(([k,l])=> `<option value="${k}">${esc(l)}</option>`).join("")}</select></div>
        <div class="adm-f"><label for="adm-bc-l">Nút hành động</label><select id="adm-bc-l">${Object.entries(LINKS).map(([k,l])=> `<option value="${k}">${esc(l)}</option>`).join("")}</select></div></div>
      <label class="adm-cb"><input type="checkbox" id="adm-bc-imp"><span>Quan trọng (viền cam, ghim đầu Trang chủ)</span></label>
      <p class="adm-dim">Tối đa 5 thông báo / 24 giờ. Hiện trên Trang chủ của người nhận trong 14 ngày; ${CA.mode === "firebase" ? "kèm thông báo đẩy (FCM topic) nếu đã cấu hình." : "bản demo chỉ hiện trong app."}</p>
      <button class="adm-btn pri" data-adm="bc-send">${ic("adm_bcast")}Xem trước & gửi…</button>`)}
    ${card(`${ic("adm_log")}Đã gửi`, list.length ? `<div class="adm-list">${list.map(b=> `<div class="adm-li"><div><b>${esc(b.title)}</b><small>${esc(AUD[b.audience] || b.audience)} · ${esc(b.byName || "")} · ${esc(ago(b.ts))}${b.retracted ? " · ĐÃ THU HỒI" : ""}</small></div>${!b.retracted ? `<button class="adm-btn sm ghost" data-adm="bc-retract" data-id="${esc(b.id)}">Thu hồi</button>` : ""}</div>`).join("")}</div>` : empty("Chưa gửi thông báo nào."))}</div>`;
} });

/* 6.11 Cài đặt app */
registerSection({ id:"settings", title:"Cài đặt app", icon:"adm_gear", order:95, perms:["settings.view","settings.edit"], render: async el=>{
  const s = await CA.getSettings(), b = obj(s.bank);
  const pay = can("settings.payment"), ed = can("settings.edit");
  const ro = v=> v ? "" : "readonly";
  el.innerHTML = `${card(`${ic("adm_lock")}Tài khoản nhận tiền (chuyển khoản / VietQR)`, `
      ${pay ? `<p class="adm-note warn">${ic("adm_lock")}Thông tin này quyết định tiền của khách chuyển vào đâu. Chỉ Chủ sở hữu sửa được; cần nhập lại mật khẩu; mọi thay đổi ghi nhật ký (số tài khoản được che).</p>` : `<p class="adm-note">${ic("adm_lock")}Chỉ Chủ sở hữu sửa được thông tin nhận tiền.</p>`}
      <div class="adm-row wrap"><div class="adm-f"><label for="adm-s-bn">Ngân hàng</label><input id="adm-s-bn" maxlength="60" value="${esc(b.bankName || "")}" ${ro(pay)} placeholder="VD: Vietcombank"></div>
        <div class="adm-f"><label for="adm-s-bin">Mã BIN (6 số)</label><input id="adm-s-bin" inputmode="numeric" maxlength="6" value="${esc(b.bankBin || "")}" ${ro(pay)} placeholder="970436"></div>
        <div class="adm-f"><label for="adm-s-acc">Số tài khoản</label><input id="adm-s-acc" inputmode="numeric" maxlength="19" value="${esc(pay ? (b.accountNo || "") : core.mask(b.accountNo || ""))}" ${ro(pay)}></div>
        <div class="adm-f"><label for="adm-s-name">Chủ tài khoản (IN HOA KHÔNG DẤU)</label><input id="adm-s-name" maxlength="60" value="${esc(b.accountName || "")}" ${ro(pay)} autocapitalize="characters"></div>
        <div class="adm-f"><label for="adm-s-br">Chi nhánh (tuỳ chọn)</label><input id="adm-s-br" maxlength="80" value="${esc(b.branch || "")}" ${ro(pay)}></div></div>
      ${pay ? `<button class="adm-btn pri" data-adm="set-pay">${ic("adm_lock")}Lưu tài khoản nhận tiền</button>` : ""}`)}
    ${card(`${ic("adm_gear")}Giao hàng & liên hệ`, `<div class="adm-row wrap">
      <div class="adm-f"><label for="adm-s-ship">Phí ship (đ)</label><input id="adm-s-ship" type="number" min="0" step="1000" value="${esc(s.shippingFee != null ? s.shippingFee : 30000)}" ${ro(ed)}></div>
      <div class="adm-f"><label for="adm-s-free">Miễn phí ship từ (đ)</label><input id="adm-s-free" type="number" min="0" step="1000" value="${esc(s.freeShipFrom != null ? s.freeShipFrom : 499000)}" ${ro(ed)}></div>
      <div class="adm-f"><label for="adm-s-fund">% doanh thu cho quỹ quà</label><input id="adm-s-fund" type="number" min="0" max="50" value="${esc(s.giftFundPct != null ? s.giftFundPct : 10)}" ${ro(ed)}></div>
      <div class="adm-f"><label for="adm-s-hot">Hotline / Zalo</label><input id="adm-s-hot" maxlength="40" value="${esc(s.hotline || "")}" ${ro(ed)}></div>
      <div class="adm-f"><label for="adm-s-mail">Email hỗ trợ</label><input id="adm-s-mail" type="email" maxlength="80" value="${esc(s.supportEmail || "")}" ${ro(ed)}></div></div>
      <div class="adm-f"><label for="adm-s-notice">Dòng thông báo cố định trong Gian hàng (tuỳ chọn)</label><input id="adm-s-notice" maxlength="200" value="${esc(s.notice || "")}" ${ro(ed)}></div>
      ${ed ? `<button class="adm-btn pri" data-adm="set-gen">Lưu cài đặt</button>` : `<p class="adm-dim">${ic("adm_lock")}Chỉ xem.</p>`}
      ${s.updatedAt ? `<p class="adm-dim">Cập nhật lần cuối ${esc(fdt(s.updatedAt))}</p>` : ""}`)}`;
} });

/* 6.12 Nhật ký kiểm toán */
const ACTION_VI = {
  "owner.bootstrap":"Khởi tạo Chủ sở hữu", "owner.bootstrap_failed":"Nhập sai mã khởi tạo", "owner.transfer":"Chuyển nhượng Chủ sở hữu",
  "role.assign":"Gán vai trò", "role.revoke":"Thu hồi vai trò", "role.denied":"Bị chặn gán vai trò", "access.denied":"Bị từ chối quyền",
  "admin.login":"Đăng nhập quản trị", "admin.logout":"Khoá phiên quản trị", "admin.login_failed":"Đăng nhập quản trị thất bại",
  "user.ban":"Khoá tài khoản", "user.unban":"Mở khoá tài khoản", "user.note":"Ghi chú người dùng", "user.pii_view":"Xem dữ liệu cá nhân",
  "pt.verify":"Xác minh PT", "pt.reject":"Từ chối / thu hồi xác minh PT", "listing.hide":"Ẩn niêm yết PT", "listing.show":"Hiện niêm yết PT",
  "community.feature":"Ghim routine", "community.unfeature":"Bỏ ghim routine", "ticket.reply":"Trả lời hỗ trợ", "ticket.close":"Đóng yêu cầu hỗ trợ",
  "broadcast.send":"Gửi thông báo hệ thống", "broadcast.retract":"Thu hồi thông báo", "settings.update":"Sửa cài đặt", "settings.payment":"Sửa tài khoản nhận tiền",
  "voucher.save":"Lưu mã giảm giá", "voucher.revoke":"Thu hồi mã giảm giá", "data.export":"Xuất CSV",
  "challenge.save":"Lưu thử thách", "challenge.delete":"Xoá thử thách", "event.save":"Lưu sự kiện", "event.delete":"Xoá sự kiện", "event.checkin":"Check-in hộ",
  "product.save":"Lưu sản phẩm", "product.delete":"Xoá sản phẩm", "order.update":"Cập nhật đơn hàng", "gift.create":"Trao quà", "gift.update":"Cập nhật quà",
};
function actionVi(a){ if(ACTION_VI[a]) return ACTION_VI[a]; const m = /^mod\.(\w+)\.(\w+)$/.exec(a || ""); if(m) return `Kiểm duyệt ${({ routine:"routine", review:"đánh giá", report:"báo cáo" })[m[1]] || m[1]}: ${({ keep:"giữ", hide:"ẩn", delete:"xoá" })[m[2]] || m[2]}`; return a || ""; }
function detailText(d){ if(d == null) return ""; try{ if(typeof d !== "object") return String(d);
  if(Array.isArray(d.changed)) return d.changed.map(c=> `${c.key}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`).join("; ");
  return Object.entries(d).filter(([,v])=> v != null && v !== "").map(([k,v])=> `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · "); }catch(e){ return ""; } }
registerSection({ id:"audit", title:"Nhật ký kiểm toán", icon:"adm_log", order:99, perms:["audit.view"], render: async el=>{
  const [list, ver] = await Promise.all([CA.listAudit({ q:A.aq, group:A.ag, limit:500 }), CA.verifyAudit()]);
  const groups = ["", "admin", "role", "owner", "user", "pt", "mod", "settings", "broadcast", "order", "product", "event", "challenge", "gift", "voucher", "data", "access", "ticket", "community", "listing"];
  A._audit = list;
  el.innerHTML = `<div class="adm-integrity ${ver.ok ? "ok" : "bad"}">${ic(ver.ok ? "adm_shield" : "adm_x")}<div><b>${ver.ok ? `Toàn vẹn: ${nf(ver.count)} bản ghi, chuỗi băm khớp` : `PHÁT HIỆN SỬA ĐỔI tại bản ghi #${ver.brokenAt + 1}`}</b><small>${esc(ver.ok ? (ver.note || "Mỗi bản ghi chứa băm SHA-256 của bản trước — sửa / xoá một bản ghi làm đứt chuỗi.") : ver.reason)}</small></div></div>
    <div class="adm-toolbar"><div class="adm-search">${ic("search")}<input id="adm-a-q" type="search" placeholder="Tìm người thực hiện, hành động, đối tượng…" value="${esc(A.aq)}" aria-label="Tìm trong nhật ký"></div>
      <select id="adm-a-g" aria-label="Nhóm hành động">${groups.map(g=> `<option value="${g}" ${A.ag === g ? "selected" : ""}>${g ? esc(g) : "Mọi nhóm"}</option>`).join("")}</select>
      ${can("data.export") ? `<button class="adm-btn sm" data-adm="a-csv">${ic("adm_down")}CSV</button>` : ""}</div>
    <div class="adm-log">${list.map(e=> `<div class="adm-log-i ${/denied|failed/.test(e.action) ? "warn" : ""}"><span class="adm-log-t">${esc(fdt(e.ts))}${e.seq ? `<small>#${esc(e.seq)}</small>` : ""}</span>
      <div><b>${esc(actionVi(e.action))}</b> <code>${esc(e.action)}</code><p>${esc(e.actor && e.actor.name || "—")} ${e.actor && e.actor.role ? roleBadge(e.actor.role) : ""}${e.target ? ` → <span>${esc(e.target.type || "")} ${esc(e.target.name || e.target.id || "")}</span>` : ""}</p>
      ${e.details ? `<small class="adm-dim">${esc(detailText(e.details)).slice(0, 400)}</small>` : ""}</div></div>`).join("") || empty("Không có bản ghi phù hợp.")}</div>`;
  const inp = q("#adm-a-q", el); let t = 0; inp.addEventListener("input", ()=>{ clearTimeout(t); t = setTimeout(()=>{ A.aq = inp.value; renderSection(); }, 350); });
  q("#adm-a-g", el).addEventListener("change", e=>{ A.ag = e.target.value; renderSection(); });
} });

const _hooks = {};
function extraHook(id){ return arr(_hooks[id]).map(fn=>{ try{ return fn() || ""; }catch(e){ return ""; } }).join(""); }

/* ---------------------------------------------------------------------
   7. HÀNH ĐỘNG (uỷ quyền click)
   --------------------------------------------------------------------- */
const ACT = {
  close: ()=> close(), side: ()=> { const s = q(".adm-shell", A.root); if(s) s.classList.toggle("side-open"); },
  nav: id=>{ A.sec = id; const s = q(".adm-shell", A.root); if(s) s.classList.remove("side-open"); renderShell(); },
  logout: ()=>{ R.logout(); renderLogin(); }, relogin: ()=> renderLogin(),
  login: (id, b)=> doLogin("session", b), "login-full": (id, b)=> doLogin("full", b), bootstrap: (id, b)=> doLogin("bootstrap", b),
  copy: (id, b)=>{ const v = b.dataset.v || ""; try{ navigator.clipboard.writeText(v).then(()=> say("Đã chép", "adm_copy"), ()=> say(v, "adm_copy")); }catch(e){ say(v, "adm_copy"); } },
  mclose: ()=> closeModal(),
  uf: id=>{ A.uf = id; qa('[data-adm="uf"]', A.root).forEach(b=>{ b.classList.toggle("on", b.dataset.id === id); b.setAttribute("aria-selected", String(b.dataset.id === id)); }); drawUsers(); },
  user: id=> openUser(id),
  "u-csv": ()=> exportCSV("nguoi-dung.csv", A.users, [{ label:"UID", key:"uid" }, { label:"Tên", key:"name" }, { label:"Email", get:u=> can("users.pii") ? u.email : "" }, { label:"PT", get:u=> u.isPT ? "Có" : "" },
    { label:"Xác minh PT", key:"ptStatus" }, { label:"Vai trò", get:u=> u.role ? R.roleLabel(u.role) : "" }, { label:"Bị khoá", get:u=> u.banned ? "Có" : "" }, { label:"Tham gia", get:u=> fd(u.createdAt) }], "users"),
  "role-save": async id=>{
    const c = A._roleCtx; if(!c) return; const role = c.sel.value || null, px = role ? c.readPx() : [];
    const why = (q("#adm-r-why", A.root) || {}).value || "";
    const r = await act(()=> CA.setRole(id, role, { px, reason: why }), role ? `Đã cấp vai trò ${R.roleLabel(role)}` : "Đã thu hồi vai trò", { rerender:false });
    if(r){ closeModal(); renderSection(); }
  },
  ban: async id=>{
    const days = Number((q("#adm-b-days", A.root) || {}).value || 7);
    const a = await ask({ title:"Khoá tài khoản?", msg:"Người dùng sẽ bị đăng xuất và không đăng nhập được " + (days ? `trong ${days} ngày` : "vĩnh viễn") + ". Dữ liệu không bị xoá.", label:"Khoá", danger:true, reason:{ label:"Lý do khoá", min:4, ph:"VD: Spam quảng cáo nhiều lần" } });
    if(a && await act(()=> CA.ban(id, { reason:a.reason, days }), "Đã khoá tài khoản", { rerender:false })){ renderSection(); }
  },
  unban: async id=>{ const a = await ask({ title:"Mở khoá tài khoản?", msg:"Người dùng đăng nhập lại được ngay.", label:"Mở khoá", reason:{ label:"Lý do", min:2 } }); if(a && await act(()=> CA.unban(id, { reason:a.reason }), "Đã mở khoá", { rerender:false })){ closeModal(); renderSection(); } },
  "note-add": async id=>{ const t = (q("#adm-n-t", A.root) || {}).value || ""; if(await act(()=> CA.addNote(id, t), "Đã lưu ghi chú", { rerender:false })) openUser(id); },
  "add-staff": async ()=>{
    const m = modal(`${mHead(ic("adm_users") + "Thêm người vào đội ngũ")}<p class="adm-sub">Người đó cần có tài khoản TapEasy. Nhập email${CA.mode === "firebase" ? " hoặc" : ","} mã tài khoản (UID) họ gửi cho bạn.</p>
      <div class="adm-f"><label for="adm-as-q">Email hoặc UID</label><input id="adm-as-q" maxlength="128" autocomplete="off"></div><div id="adm-as-r"></div>
      <div class="adm-mf"><button class="adm-btn ghost" data-adm="mclose">Huỷ</button><button class="adm-btn pri" id="adm-as-go">Tìm</button></div>`);
    if(!m) return;
    q("#adm-as-go", m).addEventListener("click", async ()=>{
      const v = (q("#adm-as-q", m).value || "").trim(); if(!v) return;
      let list = []; try{ list = await CA.listUsers({ q: v }); }catch(e){ say(e.message, "adm_x", "err"); return; }
      const exact = list.filter(u=> u.uid === v || String(u.email).toLowerCase() === v.toLowerCase());
      const res = exact.length ? exact : list.slice(0, 5);
      q("#adm-as-r", m).innerHTML = res.length ? `<div class="adm-list">${res.map(u=> `<button class="adm-li btn" data-adm="user" data-id="${esc(u.uid)}"><div><b>${esc(u.name)}</b><small>${esc(u.email || u.uid)}</small></div>${roleBadge(u.role)}</button>`).join("")}</div>` : empty("Không tìm thấy tài khoản.");
    });
  },
  transfer: async ()=>{
    let staff = []; try{ staff = (await CA.listStaff()).filter(s=> s.role !== "owner"); }catch(e){}
    const m = modal(`${mHead(ic("adm_crown") + "Chuyển nhượng Chủ sở hữu")}<p class="adm-note warn">${ic("adm_lock")}Sau khi chuyển, bạn mất quyền Chủ sở hữu (trở thành Quản trị cấp cao). Chỉ người nhận mới chuyển lại được.</p>
      <div class="adm-f"><label for="adm-tr-who">Người nhận</label><select id="adm-tr-who"><option value="">— Chọn trong đội ngũ —</option>${staff.map(s=> `<option value="${esc(s.uid)}">${esc(s.name)} · ${esc(R.roleLabel(s.role))}</option>`).join("")}</select></div>
      <div class="adm-f"><label for="adm-tr-uid">…hoặc mã tài khoản (UID)</label><input id="adm-tr-uid" maxlength="128" autocomplete="off"></div>
      <div class="adm-f"><label for="adm-tr-t">Gõ <b>CHUYỂN NHƯỢNG</b> để xác nhận</label><input id="adm-tr-t" autocomplete="off" spellcheck="false"></div>
      <div class="adm-f"><label for="adm-tr-r">Lý do</label><input id="adm-tr-r" maxlength="300"></div>
      <div class="adm-mf"><button class="adm-btn ghost" data-adm="mclose">Huỷ</button><button class="adm-btn pri danger" id="adm-tr-go">Chuyển nhượng</button></div>`);
    if(!m) return;
    q("#adm-tr-go", m).addEventListener("click", async ()=>{
      const uid = (q("#adm-tr-uid", m).value || "").trim() || q("#adm-tr-who", m).value;
      if(!uid){ say("Chọn người nhận", "adm_x", "err"); return; }
      const opts = { confirm: q("#adm-tr-t", m).value, reason: q("#adm-tr-r", m).value };
      const r = await act(()=> CA.transferOwnership(uid, opts), "Đã chuyển nhượng quyền Chủ sở hữu", { rerender:false });
      if(r){ closeModal(); renderShell(); }
    });
  },
  "pt-tab": id=>{ A.ptTab = id; renderSection(); },
  "pt-ok": async id=>{ const a = await ask({ title:"Xác minh PT này?", msg:"PT nhận tích xanh trên hồ sơ và Tìm PT. Hãy chắc chắn đã đối chiếu chứng chỉ gốc.", label:"Xác minh", reason:{ label:"Ghi chú đối chiếu", min:2, ph:"VD: Đã tra số chứng chỉ trên trang NASM" } }); if(a) act(()=> CA.verifyPT(id, true, a.reason), "Đã xác minh PT"); },
  "pt-no": async id=>{ const a = await ask({ title:"Từ chối / thu hồi xác minh", msg:"PT sẽ thấy lý do để bổ sung hồ sơ.", label:"Xác nhận", danger:true, reason:{ label:"Lý do (PT thấy)", min:4 } }); if(a) act(()=> CA.verifyPT(id, false, a.reason), "Đã cập nhật"); },
  listing: async (id, b)=>{ const hide = b.dataset.v === "1"; let reason = "";
    if(hide){ const a = await ask({ title:"Ẩn PT khỏi Tìm PT?", msg:"Hồ sơ vẫn còn, chỉ không xuất hiện trong kết quả tìm kiếm.", label:"Ẩn", danger:true, reason:{ label:"Lý do", min:4 } }); if(!a) return; reason = a.reason; }
    act(()=> CA.setListing(id, hide, reason), hide ? "Đã ẩn khỏi Tìm PT" : "Đã hiện lại"); },
  mod: async (id, b)=>{ const it = arr(A._mod)[Number(b.dataset.i)]; if(!it) return; const a = b.dataset.a;
    if(a === "delete"){ const r = await ask({ title:"Xoá vĩnh viễn?", msg:"Không khôi phục được. Cân nhắc dùng Ẩn nếu chưa chắc.", label:"Xoá", danger:true, reason:{ label:"Lý do", min:4 } }); if(r) act(()=> CA.moderate(it, "delete", r.reason), "Đã xoá"); return; }
    if(a === "hide"){ const r = await ask({ title: it.type === "report" ? "Đánh dấu đã xử lý" : "Ẩn nội dung?", msg:"Ghi chú lý do vào nhật ký.", label:"Xác nhận", reason:{ label:"Lý do", min:2 } }); if(r) act(()=> CA.moderate(it, "hide", r.reason), "Đã cập nhật"); return; }
    act(()=> CA.moderate(it, "keep", ""), it.type === "report" ? "Đã bỏ qua báo cáo" : "Đã giữ nội dung"); },
  feat: (id, b)=> act(()=> CA.setFeatured(id, b.dataset.v === "1"), b.dataset.v === "1" ? "Đã ghim" : "Đã bỏ ghim"),
  "kb-open": ()=>{ const KB = kbModule(); close(); try{ KB.open(); }catch(e){ warn(e); } },
  "kb-pub": (id, b)=>{ const KB = kbModule(); if(!R.require("kb.publish")) return;
    act(async ()=>{ const r = await KB.setPublished(id, b.dataset.v === "1"); if(r === false) throw new Error("Không đổi được trạng thái bài viết"); }, "Đã cập nhật"); },   // kb.js tự ghi audit kb.publish / kb.unpublish
  "ev-open": ()=>{ close(); try{ G.TapEv.open("admin"); }catch(e){ warn(e); } },
  "ev-ci": ()=>{ const ev = (q("#adm-ci-ev", A.root) || {}).value, code = String((q("#adm-ci-code", A.root) || {}).value || "").trim().toUpperCase();
    if(!ev || code.length !== 6){ say("Chọn sự kiện và nhập mã 6 ký tự", "adm_x", "err"); return; }
    act(()=> G.cloudEvents.adminCheckIn(ev, code), "Đã check-in", { rerender:false }).then(()=>{ const i = q("#adm-ci-code", A.root); if(i) i.value = ""; }); },
  "ord-st": id=>{ A.ordSt = id; renderSection(); },
  "ord-csv": ()=> exportCSV("don-hang.csv", arr(A._orders), [{ label:"Mã đơn", key:"code" }, { label:"Ngày", get:o=> fdt(o.createdAt) }, { label:"Người nhận", get:o=> obj(o.address).name },
    { label:"SĐT", get:o=> any(["shop.orders","users.pii"]) ? obj(o.address).phone : core.mask(obj(o.address).phone || "", 3) }, { label:"Tỉnh/thành", get:o=> obj(o.address).province }, { label:"Tổng", key:"total" },
    { label:"Thanh toán", get:o=> o.payment === "bank" ? "Chuyển khoản" : "COD" }, { label:"Trạng thái", get:o=> OST[o.status] || o.status }], "orders"),
  "v-save": ()=> act(()=> CA.saveVoucher({ code: q("#adm-v-code", A.root).value, kind: q("#adm-v-kind", A.root).value, value: q("#adm-v-val", A.root).value, min: q("#adm-v-min", A.root).value, uses: q("#adm-v-uses", A.root).value, exp: q("#adm-v-exp", A.root).value, title:"" }), "Đã tạo mã"),
  "v-revoke": async id=>{ const a = await ask({ title:`Thu hồi mã ${id}?`, msg:"Khách không dùng được mã này nữa.", label:"Thu hồi", danger:true }); if(a) act(()=> CA.revokeVoucher(id), "Đã thu hồi"); },
  "tk-st": id=>{ A.tkSt = id; renderSection(); },
  "sup-tab": id=>{ A.supTab = id === "feedback" ? "feedback" : "tickets"; renderSection(); },
  "fb-kind": id=>{ A.fbKind = id || ""; renderSection(); },
  "fb-cat": id=>{ A.fbCat = id || ""; renderSection(); },
  "fb-st": id=>{ A.fbSt = id || ""; renderSection(); },
  "fb-mark": v=>{ const [id, st] = String(v || "").split("|"); if(!can("support.tickets")) return; act(()=> cloud.feedback.setStatus(id, st), st === "done" ? "Đã đánh dấu xử lý" : "Đã đánh dấu đã xem"); },
  "tk-reply": id=>{ const t = (document.getElementById("adm-tk-" + id) || {}).value || ""; act(()=> CA.replyTicket(id, t, false), "Đã gửi trả lời"); },
  "tk-close": id=>{ const t = (document.getElementById("adm-tk-" + id) || {}).value || ""; act(()=> CA.replyTicket(id, t, true), "Đã đóng yêu cầu"); },
  "bc-send": async ()=>{
    const d = { title: q("#adm-bc-t", A.root).value, body: q("#adm-bc-b", A.root).value, audience: q("#adm-bc-a", A.root).value, link: q("#adm-bc-l", A.root).value, level: q("#adm-bc-imp", A.root).checked ? "important" : "info" };
    const a = await ask({ title:"Gửi thông báo này?", msg:"Xem lại nội dung người dùng sẽ thấy:", preview:d, label:"Gửi ngay" });
    if(a) act(async ()=>{ const r = await CA.broadcast(d); _bcAt = 0; return r; }, "Đã gửi thông báo");
  },
  "bc-retract": async id=>{ const a = await ask({ title:"Thu hồi thông báo?", msg:"Thông báo biến mất khỏi Trang chủ người dùng.", label:"Thu hồi", danger:true }); if(a) act(async ()=>{ const r = await CA.retractBroadcast(id); _bcAt = 0; return r; }, "Đã thu hồi"); },
  "set-pay": async ()=>{
    const v = id=> (q(id, A.root) || {}).value || "";
    const a = await ask({ title:"Đổi tài khoản nhận tiền?", msg:`Từ giờ mã VietQR và hướng dẫn chuyển khoản dùng: ${v("#adm-s-bn")} · ${v("#adm-s-acc")} · ${v("#adm-s-name").toUpperCase()}. Kiểm tra kỹ từng số.`, label:"Lưu", danger:true, typed:"ĐÚNG TÀI KHOẢN" });
    if(a) act(()=> CA.saveSettings({ bank:{ bankName:v("#adm-s-bn"), bankBin:v("#adm-s-bin"), accountNo:v("#adm-s-acc"), accountName:v("#adm-s-name"), branch:v("#adm-s-br") } }), "Đã lưu tài khoản nhận tiền");
  },
  "set-gen": ()=>{ const v = id=> (q(id, A.root) || {}).value; act(()=> CA.saveSettings({ shippingFee:v("#adm-s-ship"), freeShipFrom:v("#adm-s-free"), giftFundPct:v("#adm-s-fund"), hotline:v("#adm-s-hot"), supportEmail:v("#adm-s-mail"), notice:v("#adm-s-notice") }), "Đã lưu cài đặt"); },
  "a-csv": ()=> exportCSV("nhat-ky-kiem-toan.csv", arr(A._audit), [{ label:"#", key:"seq" }, { label:"Thời gian", get:e=> fdt(e.ts) }, { label:"Người thực hiện", get:e=> e.actor && e.actor.name }, { label:"UID", get:e=> e.actor && e.actor.uid },
    { label:"Vai trò", get:e=> e.actor && e.actor.role }, { label:"Hành động", key:"action" }, { label:"Mô tả", get:e=> actionVi(e.action) }, { label:"Đối tượng", get:e=> e.target ? `${e.target.type} ${e.target.name || e.target.id}` : "" },
    { label:"Chi tiết", get:e=> detailText(e.details) }, { label:"Băm", key:"hash" }], "audit"),
};
function onClick(e){
  const b = e.target.closest && e.target.closest("[data-adm]"); if(!b || !A.root.contains(b)) return;
  const k = b.dataset.adm; if(!ACT[k]) return;
  e.preventDefault(); touchSoon();
  try{ const r = ACT[k](b.dataset.id, b); if(r && r.catch) r.catch(warn); }catch(err){ warn(err); }
}

/* ---------------------------------------------------------------------
   8. PHÍA NGƯỜI DÙNG: thông báo hệ thống · liên hệ hỗ trợ · xác minh PT · lối vào quản trị
   --------------------------------------------------------------------- */
const seen = ()=>{ try{ state.teAdmin = Object.assign({ seenBc:{} }, state.teAdmin || {}); state.teAdmin.seenBc = state.teAdmin.seenBc || {}; return state.teAdmin.seenBc; }catch(e){ return {}; } };
const saveSt = ()=>{ try{ saveState(); }catch(e){} };
let _bc = [], _bcAt = 0;
async function loadBroadcasts(force){ if(!force && Date.now() - _bcAt < 60000) return _bc; _bcAt = Date.now(); try{ _bc = await CA.activeBroadcasts(); }catch(e){ _bc = []; } return _bc; }
function homeBroadcast(){
  const host = document.getElementById("home-content"); if(!host) return;
  qa(".adm-bc", host).forEach(n=> n.remove());
  const s = seen(), b = _bc.filter(x=> !s[x.id]).sort((a,c)=> (c.level === "important") - (a.level === "important") || c.ts - a.ts)[0];
  if(!b) return;
  const el = document.createElement("div");
  el.className = "card adm-bc" + (b.level === "important" ? " imp" : ""); el.setAttribute("data-home-zone", "alert"); el.setAttribute("role", "status");
  el.innerHTML = `<div class="adm-bc-h">${ic("adm_bcast")}<b>${esc(b.title)}</b><button class="icon-btn" data-adm-bc-x="${esc(b.id)}" aria-label="Ẩn thông báo">${ic("close")}</button></div><p>${esc(b.body)}</p>
    ${b.link ? `<button class="btn btn-sm btn-outline" data-adm-bc-go="${esc(b.link)}" data-id="${esc(b.id)}">${esc(LINKS[b.link] || "Xem")}</button>` : ""}<small>TapEasy · ${esc(ago(b.ts))}</small>`;
  host.insertBefore(el, host.firstChild);
  el.addEventListener("click", e=>{
    const x = e.target.closest("[data-adm-bc-x]"), g = e.target.closest("[data-adm-bc-go]");
    if(x){ seen()[x.dataset.admBcX] = Date.now(); saveSt(); el.remove(); }
    if(g){ seen()[g.dataset.id] = Date.now(); saveSt(); el.remove(); goLink(g.dataset.admBcGo); }
  });
}
function goLink(k){
  try{
    if(k === "events" && G.TapEv) return G.TapEv.open("challenges");
    if(k === "shop" && G.TapEv) return G.TapEv.open("shop");
    if(k === "community" && G.TECommunity && G.TECommunity.open) return G.TECommunity.open();
    if(k === "findpt"){ const F = G.TE_FINDPT || G.TEFindPT || G.FindPT; if(F && F.open) return F.open(); }
    if(k === "kb"){ const K = kbModule(); if(K && K.open) return K.open(); }
  }catch(e){ warn(e); }
}
/* QS-16: "Thiết lập quản trị lần đầu" hiện CÔNG KHAI chỉ khi máy chủ báo chưa có Chủ sở hữu (thay lối 7 chạm ẩn) */
let _noOwner = false, _ownerAt = 0;
function checkOwner(){
  if(Date.now() - _ownerAt < 5 * 60000 || !cloud.user || (CA.demoAdminBlocked && CA.demoAdminBlocked())) return;
  _ownerAt = Date.now();
  Promise.resolve(CA.hasOwner()).then(h=>{ const nv = h === false; if(nv !== _noOwner){ _noOwner = nv; try{ if(curScreen() === "profile") profileCard(); }catch(e){} } }).catch(()=>{});
}
function profileCard(){
  const scr = q("#screen-profile .content"); if(!scr) return;
  checkOwner();
  qa(".adm-prof", scr).forEach(n=> n.remove());
  const u = cloud.user, pr = cloud.profile || {}, role = R.role();
  const v = pr.isPT && u ? (CA.ptStatus(u.uid).verified ? "verified" : null) : null;
  const el = document.createElement("div"); el.className = "card adm-prof";
  el.innerHTML = `<div class="card-title">${ic("adm_help")}Hỗ trợ${role ? " &amp; quản trị" : ""}</div>
    ${!role && _noOwner && u ? `<button class="link-row" data-adm-p="panel"><div class="left">${ic("adm_crown")}<div><div class="name">Thiết lập quản trị lần đầu</div><div class="sub">Ứng dụng chưa có Chủ sở hữu — cần mã khởi tạo của người triển khai</div></div></div>${ic("chevron_right")}</button>` : ""}
    ${role ? `<button class="link-row" data-adm-p="panel"><div class="left">${ic("adm_shield")}<div><div class="name">Bảng quản trị</div><div class="sub">${esc(R.roleLabel(role))}${R.active() ? " · phiên đang mở" : " · cần nhập lại mật khẩu"}</div></div></div>${ic("chevron_right")}</button>` : ""}
    ${pr.isPT && u ? `<button class="link-row" data-adm-p="verify"><div class="left">${ic("adm_pt")}<div><div class="name">Xác minh PT (tích xanh)</div><div class="sub" id="adm-pv-sub">${v ? "Đã xác minh" : "Gửi chứng chỉ để được ưu tiên trên Tìm PT"}</div></div></div>${ic("chevron_right")}</button>` : ""}
    <button class="link-row" data-adm-p="support"><div class="left">${ic("adm_help")}<div><div class="name">Liên hệ hỗ trợ</div><div class="sub">Đơn hàng, tài khoản, lỗi app — đội ngũ TapEasy trả lời trong app</div></div></div>${ic("chevron_right")}</button>`;
  el.addEventListener("click", e=>{ const b = e.target.closest("[data-adm-p]"); if(!b) return; const k = b.dataset.admP; if(k === "panel") open(); if(k === "verify") verifySheet(); if(k === "support") supportSheet(); });
  const acc = q("#profile-account-card", scr); if(acc && acc.parentNode) acc.parentNode.insertBefore(el, acc); else scr.appendChild(el);
}
async function supportSheet(){
  if(!cloud.user){ try{ toast("Đăng nhập để gửi yêu cầu hỗ trợ", "adm_help"); if(typeof showAuth === "function") showAuth("login"); }catch(e){} return; }
  let mine = []; try{ mine = await CA.myTickets(); }catch(e){}
  openSheet(`<div class="sheet-header"><h3>Liên hệ hỗ trợ</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    <div class="field"><label for="adm-st-topic">Chủ đề</label><select id="adm-st-topic">${Object.entries(TOPIC).map(([k,l])=> `<option value="${k}">${esc(l)}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:10px;"><label for="adm-st-text">Mô tả vấn đề</label><textarea id="adm-st-text" rows="4" maxlength="2000" placeholder="VD: Mã đơn TE1211-AB12, chưa nhận được hàng…"></textarea></div>
    <p class="small-note">Không gửi mật khẩu hay số thẻ ngân hàng. Đội ngũ trả lời ngay trong mục này.</p>
    <button class="btn btn-primary btn-block" id="adm-st-go" style="margin-top:10px;">Gửi yêu cầu</button>
    ${mine.length ? `<div class="section-title" style="margin-top:16px;"><h3>Yêu cầu của bạn</h3></div>${mine.map(t=> `<div class="card adm-my-tk"><b>${esc(TOPIC[t.topic] || t.topic)} · ${t.status === "open" ? "Đang chờ" : t.status === "answered" ? "Đã trả lời" : "Đã đóng"}</b><p>${esc(t.text)}</p>${arr(t.replies).map(r=> `<div class="adm-reply ${r.staff ? "staff" : ""}"><p>${esc(r.text)}</p><small>${r.staff ? "TapEasy" : "Bạn"} · ${esc(fdt(r.ts))}</small></div>`).join("")}</div>`).join("")}` : ""}`);
  const go = document.getElementById("adm-st-go");
  if(go) go.addEventListener("click", async ()=>{ try{ await CA.openTicket({ topic: document.getElementById("adm-st-topic").value, text: document.getElementById("adm-st-text").value }); toast("Đã gửi — TapEasy sẽ trả lời sớm", "check"); supportSheet(); }catch(e){ toast(e.message, "error"); } });
}
async function verifySheet(){
  let v = null; try{ v = await CA.myVerify(); }catch(e){}
  const st = v ? v.status : "";
  openSheet(`<div class="sheet-header"><h3>Xác minh PT</h3><button class="icon-btn" onclick="closeSheet()" aria-label="Đóng">${ic("close")}</button></div>
    ${st === "verified" ? `<p class="small-note">${ic("adm_pt")} Hồ sơ của bạn <b>đã được xác minh</b>.</p>` :
      st === "pending" ? `<p class="small-note">Đã gửi ${esc(ago(v.at))} — đang chờ đội ngũ đối chiếu (thường 1–3 ngày làm việc).</p>` :
      st === "rejected" ? `<p class="small-note" style="color:var(--warn)">Chưa được duyệt: ${esc(v.reviewNote || "")}. Bổ sung rồi gửi lại.</p>` :
      `<p class="small-note">PT đã xác minh có tích xanh và được ưu tiên trong Tìm PT. TapEasy đối chiếu số chứng chỉ với đơn vị cấp.</p>`}
    ${st !== "verified" ? `<div class="field" style="margin-top:10px;"><label for="adm-pv-cn">Tên chứng chỉ</label><input id="adm-pv-cn" maxlength="120" value="${esc(v && v.certName || "")}" placeholder="VD: NASM-CPT, ACE, Huấn luyện viên TDTT"></div>
      <div class="field" style="margin-top:10px;"><label for="adm-pv-no">Số chứng chỉ</label><input id="adm-pv-no" maxlength="60" value="${esc(v && v.certNo || "")}"></div>
      <div class="field" style="margin-top:10px;"><label for="adm-pv-is">Đơn vị cấp</label><input id="adm-pv-is" maxlength="120" value="${esc(v && v.issuer || "")}"></div>
      <div class="field" style="margin-top:10px;"><label for="adm-pv-y">Số năm kinh nghiệm</label><input id="adm-pv-y" type="number" min="0" max="60" value="${esc(v && v.years || "")}"></div>
      <div class="field" style="margin-top:10px;"><label for="adm-pv-n">Ghi chú (tuỳ chọn)</label><textarea id="adm-pv-n" rows="2" maxlength="500">${esc(v && v.note || "")}</textarea></div>
      <button class="btn btn-primary btn-block" id="adm-pv-go" style="margin-top:12px;">${st === "pending" ? "Cập nhật hồ sơ" : "Gửi xác minh"}</button>` : ""}`);
  const go = document.getElementById("adm-pv-go");
  if(go) go.addEventListener("click", async ()=>{ const g = id=> (document.getElementById(id) || {}).value;
    try{ await CA.requestVerify({ certName:g("adm-pv-cn"), certNo:g("adm-pv-no"), issuer:g("adm-pv-is"), years:g("adm-pv-y"), note:g("adm-pv-n") }); toast("Đã gửi hồ sơ xác minh", "check"); closeSheet(); }catch(e){ toast(e.message, "error"); } });
}

/* ---------------------------------------------------------------------
   9. GẮN VÀO APP
   --------------------------------------------------------------------- */
function wrapFn(name, make){ try{ const old = G[name]; if(typeof old !== "function" || old.__adm) return false; const f = make(old); f.__adm = true; G[name] = f; return true; }catch(e){ warn(e); return false; } }
function curScreen(){ const a = q(".screen.active"); return a ? a.id.replace("screen-", "") : ""; }
function integrate(){
  addIcons();
  wrapFn("renderProfileScreen", old=> function(){ const r = old.apply(this, arguments); try{ profileCard(); }catch(e){ warn(e); } return r; });
  wrapFn("goto", old=> function(s){ const r = old.apply(this, arguments); try{ if(s === "profile") profileCard(); }catch(e){ warn(e); } return r; });
  wrapFn("renderHomeScreen", old=> function(){ const r = old.apply(this, arguments); try{ homeBroadcast(); loadBroadcasts().then(()=>{ if(curScreen() === "home") homeBroadcast(); }); }catch(e){ warn(e); } return r; });
  wrapFn("openSheet", old=> function(html){
    const r = old.apply(this, arguments);
    try{ if(typeof html === "string" && html.indexOf("goto('reminders');closeSheet();") >= 0 && R.role()){
      const first = q("#sheet-content .link-row"), list = first && first.parentNode;
      if(list && !q(".adm-menu", list)){ const d = document.createElement("div"); d.className = "link-row adm-menu"; d.setAttribute("role", "button"); d.tabIndex = 0;
        d.innerHTML = `<div class="left">${ic("adm_shield")}<div class="name">Bảng quản trị</div></div>${ic("chevron_right")}`;
        d.addEventListener("click", ()=>{ try{ closeSheet(); }catch(e){} open(); }); list.insertBefore(d, list.firstChild); } } }catch(e){ warn(e); }
    return r;
  });
  wrapFn("fkHandleBack", old=> function(){ if(A.open){ if(!closeModal()) close(); return true; } return old.apply(this, arguments); });
  R.onChange(kind=>{
    if(kind === "auth" || kind === "storage") _bcAt = 0;          // đổi tài khoản → tải lại thông báo đúng đối tượng
    try{ if(curScreen() === "profile") profileCard(); }catch(e){}
    if(kind === "session"){ try{ if(G.TapEv && G.TapEv.loadAll) G.TapEv.loadAll(true).then(()=>{ try{ G.TapEv.render && G.TapEv.render(); }catch(e){} }); }catch(e){} }
    if(A.open && kind === "session" && !R.active() && q(".adm-shell", A.root)) renderLogin();
  });
  try{ R.ensureAttached(); }catch(e){}
  try{ if(curScreen() === "profile") profileCard(); }catch(e){}
  loadBroadcasts(true).then(()=>{ try{ if(curScreen() === "home") homeBroadcast(); }catch(e){} });
  try{ if(typeof location !== "undefined" && location.hash === "#admin" && !(CA.demoAdminBlocked && CA.demoAdminBlocked())) setTimeout(()=> open(), 300); }catch(e){}
}

G.TE_ADMIN = { __v:1, open, close, render: ()=> A.open && (R.active() ? renderShell() : renderLogin()), registerSection, sections: SECTIONS, isOpen: ()=> A.open,
  addHook: (id, fn)=>{ (_hooks[id] = _hooks[id] || []).push(fn); }, _A: A, _ACT: ACT, renderFeedbackPanel, actionVi, toCSV, matrixHTML, visibleSections };
try{ integrate(); }catch(e){ warn(e); }
})(typeof window !== "undefined" ? window : globalThis);

/* =========================================================================
   TapEasy — LỚP DỮ LIỆU QUẢN TRỊ (cloud-admin.js)
   Cần: cloud.js, rbac.js (TE_RBAC). Nạp SAU events.js / shop.js / community.js (để bọc quyền),
   TRƯỚC admin.js. Hai động cơ, cùng API async (lỗi tiếng Việt, có .code):
     - demo     : localStorage "tapeasy_admin_demo_v1" (vai trò, khoá, audit, cài đặt, thông báo, PT, hỗ trợ…)
     - firebase : Firestore + Cloud Functions (functions/admin.js) khi cloud.mode === "firebase"

   MỌI thao tác ghi đều: (1) kiểm tra phiên quản trị + quyền (TE_RBAC) — ở firebase máy chủ kiểm lại bằng
   rules/claims; (2) ghi NHẬT KÝ KIỂM TOÁN chỉ-thêm (demo: chuỗi băm SHA-256; firebase: Function chainAudit).

   Firestore (xem docs/INTEGRATION-admin.md để có rules đầy đủ):
     roles/{uid}               { role, px[], by, at, name }          ← chỉ Cloud Functions ghi
     roles_meta/owner          { uid, at }                           ← Chủ sở hữu duy nhất
     admin_audit/{id}          { actorUid, actorName, actorRole, action, target, details, ts, seq, prev, hash }
     bans/{uid}                { by, at, reason, until, liftedAt }   ← Functions (Auth disabled + thu hồi token)
     settings/public           { bank{…}, shippingFee, freeShipFrom, giftFundPct, hotline, supportEmail, updatedAt }
     broadcasts/{id}           { title, body, audience, link, level, by, byName, ts, retracted }
     pt_verifications/{uid}    { uid, name, certName, certNo, issuer, years, note, status, reviewNote, reviewedBy, reviewedAt }
     users/{uid}               + ptVerified, listingHidden (chỉ người có pt.verify / listings.moderate ghi; danh sách qua callable adminListUsers)
     support_tickets/{id}      { uid, name, topic, text, status, replies[], createdAt, updatedAt }
     user_notes/{uid}/notes/{id} { by, byName, text, ts }            ← chỉ-thêm
     reports/{id}              { type, refId, parentId, reason, by, status, resolution, createdAt }
     vouchers/{code}           { code, kind, value, min, cap, uses, used, exp, title, revoked, by, at }
   ========================================================================= */
(function(G){
"use strict";
if(typeof cloud === "undefined" || !G.TE_RBAC){ console.warn("[cloud-admin] Cần nạp cloud.js và rbac.js trước."); return; }
if(G.cloudAdmin && G.cloudAdmin.__v) return;

const R = G.TE_RBAC, core = R.core;
const KEY = R.DEMO_KEY;
const SETTINGS_CACHE = "tapeasy_settings_cache_v1";
/* QS-16: KHÔNG còn mã khởi tạo mặc định công khai trong mã nguồn. Bản demo dùng mã NGẪU NHIÊN riêng từng máy
   (sinh lần đầu, chỉ người phát triển đọc bằng cloudAdmin.demoBootCode() trong Console) hoặc TAPEASY_ADMIN_CONFIG.bootstrapHash.
   Bản cài từ cửa hàng (Capacitor native) chạy demo → KHÔNG có quản trị (bắt buộc cấu hình Firebase). */
const BOOT_CODE_KEY = "tapeasy_admin_demo_boot_v1";
const bootHash = code=> core.sha256("tapeasy-owner:" + String(code || "").trim().toUpperCase());
function randomCode(n){
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let out = "";
  try{ const b = new Uint32Array(n); (G.crypto || globalThis.crypto).getRandomValues(b); for(let i = 0; i < n; i++) out += A[b[i] % A.length]; }
  catch(e){ for(let i = 0; i < n; i++) out += A[Math.floor(Math.random() * A.length)]; }
  return out;
}
function demoBootCode(){
  let c = null; try{ c = localStorage.getItem(BOOT_CODE_KEY); }catch(e){}
  if(!c || !/^TE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)){ c = "TE-" + randomCode(4) + "-" + randomCode(4) + "-" + randomCode(4); try{ localStorage.setItem(BOOT_CODE_KEY, c); }catch(e){} }
  return c;
}
const bootHashNow = ()=> (G.TAPEASY_ADMIN_CONFIG && G.TAPEASY_ADMIN_CONFIG.bootstrapHash) || bootHash(demoBootCode());
function isNativeApp(){ try{ return !!(G.Capacitor && G.Capacitor.isNativePlatform && G.Capacitor.isNativePlatform()); }catch(e){ return false; } }
/** Bản demo trên app native (store) không có quản trị — QS-16 / App Store 2.3.1 */
const demoAdminBlocked = ()=> isNativeApp() && !(G.TAPEASY_ADMIN_CONFIG && G.TAPEASY_ADMIN_CONFIG.allowDemoAdmin);
/* Hành động do chính Cloud Function ghi audit (máy chủ) — client KHÔNG gửi lại qua logAdminAction (QS-15) */
const SERVER_AUDITED = /^(role\.|owner\.|user\.(ban|unban|pii_)|settings\.payment$|broadcast\.send$|challenge\.settle$)/;
const FB_VERSION = "10.12.2", REGION = "asia-southeast1";
const DAY = 86400000;
const BROADCAST_PER_DAY = 5;
const now = ()=> Date.now();
const rid = (p="id")=> `${p}${now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
const clone = o=> JSON.parse(JSON.stringify(o == null ? null : o));
const arr = a=> Array.isArray(a) ? a : [];
const obj = o=> (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
const str = (s, n)=> String(s == null ? "" : s).trim().slice(0, n || 500);
function err(msg, code){ const e = new Error(msg); e.code = code || "admin/error"; return e; }
const ERR = { "permission-denied":"Máy chủ từ chối: tài khoản không có quyền này (kiểm tra vai trò / firestore.rules).", "unavailable":"Không kết nối được máy chủ, kiểm tra mạng.",
  "not-found":"Không tìm thấy dữ liệu.", "failed-precondition":"Thiếu điều kiện (chỉ mục Firestore hoặc cần xác thực lại).", "unauthenticated":"Bạn cần đăng nhập lại." };
function nice(e){ if(e && e.code && /^(admin|rbac)\//.test(e.code)) return e; const code = String(e && e.code || "").replace(/^functions\//, "");
  const vi = e && e.message && /[àáảãạâầấẩẫậăằắẳẵặđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(e.message);
  return err(vi ? e.message : (ERR[code] || (e && e.message) || "Đã có lỗi xảy ra."), code || "admin/error"); }
const wrap = fn=> async (...a)=>{ try{ return await fn(...a); }catch(e){ throw nice(e); } };
const isFb = ()=> R.mode() === "firebase" && typeof firebase !== "undefined" && !!firebase.firestore;
const fdb = ()=> firebase.firestore();
const qd = q=> q.docs.map(d=> Object.assign({ id:d.id }, d.data()));
const dd = d=> d && d.exists ? Object.assign({ id:d.id }, d.data()) : null;
const tsOf = v=> v && typeof v.toMillis === "function" ? v.toMillis() : (Number(v) || 0);
function me(){ return cloud.user || null; }
function needUser(){ const u = me(); if(!u) throw err("Bạn cần đăng nhập để dùng tính năng này.", "admin/auth"); return u; }

/* ---------------------------------------------------------------------
   0. KIỂM QUYỀN TRƯỚC KHI GHI
   --------------------------------------------------------------------- */
const _denied = {};
function actor(perms){
  const c = R.current();
  if(!c) throw err("Tài khoản chưa được cấp quyền quản trị.", "permission-denied");
  if(!R.active()) throw err("Phiên quản trị đã hết hạn — đăng nhập lại.", "rbac/session");
  const list = perms == null ? [] : (Array.isArray(perms) ? perms : [perms]);
  if(list.length && !list.some(p=> core.hasPerm(c.role, c.px, p))){
    const k = c.uid + list.join(",");
    if(!_denied[k] || now() - _denied[k] > 60000){ _denied[k] = now(); R.audit("access.denied", { type:"perm", id:list.join("|") }, { role:c.role }); }
    throw err(`Bạn không có quyền: ${R.label(list[0])}.`, "permission-denied");
  }
  R.touch(); return c;
}
function stepUp(perm){ if(R.needsStepUp(perm)) throw err("Thao tác nhạy cảm — nhập lại mật khẩu để xác nhận.", "rbac/step-up"); }
const can = p=> R.can(p);

/* ---------------------------------------------------------------------
   1. ĐỘNG CƠ DEMO
   --------------------------------------------------------------------- */
const EMPTY = ()=> ({ v:1, owner:null, roles:{}, bans:{}, audit:[], settings:{}, broadcasts:[], ptVerify:{}, listings:{}, notes:{}, vouchers:{}, tickets:[], reports:[], featured:{}, seeded:0 });
function load(){ try{ return Object.assign(EMPTY(), JSON.parse(localStorage.getItem(KEY) || "{}")); }catch(e){ return EMPTY(); } }
function save(d){ try{ localStorage.setItem(KEY, JSON.stringify(d)); }catch(e){ throw err("Bộ nhớ máy đầy — không lưu được dữ liệu quản trị.", "admin/quota"); } }
function cloudDemo(){ try{ return Object.assign({ users:{}, accounts:{} }, JSON.parse(localStorage.getItem("fitkit_cloud_demo_v1") || "{}")); }catch(e){ return { users:{}, accounts:{} }; } }
function eventsDemo(){ try{ return JSON.parse(localStorage.getItem("tapeasy_events_demo_v1") || "{}"); }catch(e){ return {}; } }
function seed(d){
  if(d.seeded) return false;
  const t = now(), S = (n, x)=> Object.assign({ sample:true }, x, { at: t - n * 3600000 });
  d.ptVerify.sample_pt_1 = S(5, { uid:"sample_pt_1", name:"Trần Minh Huy (mẫu)", brand:"Huy Strength", certName:"NASM-CPT", certNo:"NASM-1188-24", issuer:"National Academy of Sports Medicine", years:4, note:"Chuyên tăng cơ, sức mạnh.", status:"pending" });
  d.ptVerify.sample_pt_2 = S(30, { uid:"sample_pt_2", name:"Lê Thu Trang (mẫu)", brand:"Trang Yoga & Pilates", certName:"RYT-200 (Yoga Alliance)", certNo:"YA-200-55871", issuer:"Yoga Alliance", years:6, note:"Yoga, pilates cho người mới.", status:"pending" });
  d.ptVerify.sample_pt_3 = S(80, { uid:"sample_pt_3", name:"Phạm Quốc Bảo (mẫu)", brand:"Bảo Fitness", certName:"Huấn luyện viên thể hình – Tổng cục TDTT", certNo:"TDTT-2023-0412", issuer:"Tổng cục Thể dục thể thao", years:3, note:"", status:"verified", reviewNote:"Đã đối chiếu chứng chỉ gốc", reviewedBy:"system" });
  d.tickets.push(S(2, { id:"tk_sample_1", uid:"sample_u_1", name:"Ngọc Anh (mẫu)", topic:"order", text:"Mình đặt áo size M từ 3 ngày trước, đơn vẫn 'Chờ xác nhận'. Nhờ shop kiểm tra giúp.", status:"open", replies:[], createdAt: t - 7200000, updatedAt: t - 7200000 }));
  d.tickets.push(S(26, { id:"tk_sample_2", uid:"sample_u_2", name:"Hoàng Nam (mẫu)", topic:"account", text:"Mình đổi máy, đăng nhập lại thì mất lịch sử tập. Có khôi phục được không?", status:"open", replies:[], createdAt: t - 26*3600000, updatedAt: t - 26*3600000 }));
  d.reports.push(S(4, { id:"rp_sample_1", type:"user", refId:"sample_u_3", title:"Tài khoản 'Bán thuốc giảm cân cấp tốc' (mẫu)", reason:"Spam quảng cáo sản phẩm không rõ nguồn gốc", by:"sample_u_1", status:"open", createdAt: t - 4*3600000 }));
  d.seeded = t; return true;
}

/* ---- Nhật ký kiểm toán chỉ-thêm (chuỗi băm) ---- */
function sanitizeDetails(x){
  if(x == null) return null;
  let s; try{ s = JSON.stringify(x); }catch(e){ return { note:"(không ghi được chi tiết)" }; }
  if(s.length > 4000) return { note:"(chi tiết quá dài — đã cắt)", head: s.slice(0, 3000) };
  return JSON.parse(s);
}
function demoAppend(entry){
  const d = load();
  const list = d.audit = arr(d.audit);
  const prev = list.length ? list[list.length - 1].hash : core.GENESIS;
  const e = { seq: list.length + 1, id: rid("a"), ts: Number(entry.ts) || now(), actor: entry.actor || null, action: str(entry.action, 60),
    target: entry.target ? { type: str(entry.target.type, 30), id: str(entry.target.id, 120), name: str(entry.target.name, 120) } : null,
    details: sanitizeDetails(entry.details), prev };
  e.hash = core.auditHash(prev, e);
  list.push(e); save(d);
  return clone(e);
}

/* ---- Người dùng ---- */
function demoUsers(){
  const cd = cloudDemo(), d = load(), out = [];
  for(const uid in cd.users){
    const u = cd.users[uid] || {}, r = d.roles[uid], b = d.bans[uid], v = d.ptVerify[uid], l = d.listings[uid];
    out.push({ uid, name: u.name || "", email: u.email || "", provider: u.provider || "password", isPT: !!u.isPT, brandName: u.brandName || "", createdAt: u.createdAt || 0,
      role: r && core.ROLES[r.role] ? r.role : null, px: r ? core.normPx(r.px) : [], banned: !!(b && !b.liftedAt && (!b.until || b.until > now())), ban: b || null,
      ptStatus: v ? v.status : (u.isPT ? "none" : null), listingHidden: !!(l && l.hidden) });
  }
  return out;
}
const demoUser = uid=> demoUsers().find(u=> u.uid === uid) || null;

/* ---------------------------------------------------------------------
   2. ĐỘNG CƠ FIREBASE (Firestore + callable functions)
   --------------------------------------------------------------------- */
function loadScript(src){ return new Promise((res, rej)=>{ const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = ()=> rej(new Error("Không tải được " + src)); document.head.appendChild(s); }); }
async function callable(name, data){
  if(!firebase.functions) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-functions-compat.js`);
  const res = await firebase.app().functions(REGION).httpsCallable(name)(data || {});
  return res && res.data;
}
async function fbCount(q){ try{ if(typeof q.count === "function"){ const s = await q.count().get(); return s.data().count; } }catch(e){} try{ return (await q.limit(1000).get()).size; }catch(e){ return null; } }

/* ---------------------------------------------------------------------
   3. API CÔNG KHAI
   --------------------------------------------------------------------- */
let _settings = null, _users = null, _ptCache = {};
const api = {
  __v: 1,
  get mode(){ return isFb() ? "firebase" : "demo"; },
  bootHash, BOOT_DEFAULT_HINT: "Bản demo: mã khởi tạo riêng của máy này — người phát triển chạy cloudAdmin.demoBootCode() trong Console (docs/RBAC.md §5)",
  /** QS-16: mã khởi tạo demo ngẫu nhiên của máy này (chỉ dành cho người phát triển; không hiện trong giao diện) */
  demoBootCode(){ if(isFb() || demoAdminBlocked()) return null; const c = demoBootCode(); try{ console.info("[TapEasy] Mã khởi tạo Chủ sở hữu (bản demo, riêng máy này):", c); }catch(e){} return c; },
  demoAdminBlocked,
  me,

  async init(){
    if(!isFb()){ const d = load(); if(seed(d)) save(d); }
    R.drainAudit().forEach(e=> api.appendAudit(e).catch(()=>{}));
    try{ await api.getSettings(); }catch(e){}
    return api.mode;
  },

  /* ---------- Chủ sở hữu ---------- */
  hasOwner: wrap(async ()=>{
    if(isFb()){
      try{ const r = await callable("ownerStatus", {}); return !!(r && r.hasOwner); }catch(e){}                 // QS-16: hỏi máy chủ (người thường không đọc được roles_meta)
      try{ return (await fdb().collection("roles_meta").doc("owner").get()).exists; }catch(e){ return null; }     // không đọc được (chưa là staff) → không biết
    }
    if(demoAdminBlocked()) return true;                                                                          // app native chạy demo: không mở lối khởi tạo
    return !!load().owner;
  }),
  /** Khởi tạo Chủ sở hữu lần đầu bằng mã khởi tạo (demo: docs/RBAC.md · firebase: secret OWNER_BOOTSTRAP_CODE) */
  bootstrapOwner: wrap(async code=>{
    const u = needUser();
    if(isFb()){ const r = await callable("bootstrapOwner", { code: str(code, 80) }); await R.refresh(true); return r; }
    if(demoAdminBlocked()) throw err("Bản cài đặt này chưa kết nối máy chủ (Firebase) nên không có chế độ quản trị.", "admin/demo-native");
    const d = load();
    if(d.owner) throw err("Ứng dụng đã có Chủ sở hữu. Liên hệ Chủ sở hữu để được cấp vai trò.", "admin/owner-exists");
    if(bootHash(code) !== bootHashNow()){ demoAppend({ actor:{ uid:u.uid, name:u.name, role:null }, action:"owner.bootstrap_failed", target:{ type:"user", id:u.uid, name:u.name } }); throw err("Mã khởi tạo không đúng.", "admin/bad-code"); }
    if(d.bans[u.uid] && !d.bans[u.uid].liftedAt) throw err("Tài khoản đang bị khoá.", "admin/banned");
    d.owner = u.uid; d.roles[u.uid] = { role:"owner", px:[], by:u.uid, at: now(), name: u.name };
    save(d);
    demoAppend({ actor:{ uid:u.uid, name:u.name, role:"owner" }, action:"owner.bootstrap", target:{ type:"user", id:u.uid, name:u.name }, details:{ role:"owner" } });
    await R.refresh();
    return { uid:u.uid, role:"owner" };
  }),

  /* ---------- Người dùng ---------- */
  listUsers: wrap(async (opts)=>{
    actor("users.view"); opts = opts || {};
    const q = str(opts.q, 80).toLowerCase(), f = opts.filter || "all", pii = can("users.pii");
    let list;
    if(isFb()){
      /* rules cấm list users từ client (BUG-03) → callable adminListUsers (kiểm users.view, che email nếu thiếu users.pii) */
      list = arr(obj(await callable("adminListUsers", { q, filter: f, limit: opts.limit || 300 })).users);
    } else list = demoUsers();
    list = list.filter(u=>{
      if(f === "pt" && !u.isPT) return false; if(f === "staff" && !u.role) return false; if(f === "banned" && !u.banned) return false;
      if(q && !(u.name.toLowerCase().includes(q) || u.uid.toLowerCase() === q || (pii && String(u.email).toLowerCase().includes(q)) || String(u.brandName).toLowerCase().includes(q))) return false;
      return true;
    }).sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
    if(!can("roles.view")) list.forEach(u=>{ u.role = u.role ? "?" : null; u.px = []; });
    list.forEach(u=>{ if(!pii) u.email = u.email ? core.maskEmail(u.email) : ""; });
    _users = list;
    return clone(list);
  }),
  /** Chi tiết + dữ liệu cá nhân (chỉ khi users.pii; mỗi lần xem PII được ghi audit) */
  getUser: wrap(async uid=>{
    const c = actor("users.view"); uid = str(uid, 128);
    let u;
    if(isFb()){
      const r = await callable("adminGetUser", { uid });
      u = Object.assign({ uid }, obj(r));
    } else {
      u = demoUser(uid); if(!u) throw err("Không tìm thấy người dùng.", "not-found");
      if(can("users.pii")) api.appendAudit({ action:"user.pii_view", target:{ type:"user", id:uid, name:u.name } }).catch(()=>{});
      else u.email = core.maskEmail(u.email);
      if(!can("roles.view")){ u.role = u.role ? "?" : null; u.px = []; }
    }
    void c; return clone(u);
  }),

  /* ---------- Vai trò ---------- */
  listStaff: wrap(async ()=>{
    actor("roles.view");
    if(isFb()) return qd(await fdb().collection("roles").get()).filter(r=> core.ROLES[r.role]).map(r=> ({ uid:r.id, name:r.name||"", role:r.role, px:core.normPx(r.px), by:r.by||"", at:tsOf(r.at) }))
      .sort((a,b)=> core.level(b.role) - core.level(a.role));
    const d = load(), cd = cloudDemo();
    return Object.keys(d.roles).filter(uid=> core.ROLES[d.roles[uid].role]).map(uid=> ({ uid, name: (cd.users[uid] && cd.users[uid].name) || d.roles[uid].name || uid, role: d.roles[uid].role, px: core.normPx(d.roles[uid].px), by: d.roles[uid].by, at: d.roles[uid].at }))
      .sort((a,b)=> core.level(b.role) - core.level(a.role) || String(a.name).localeCompare(String(b.name), "vi"));
  }),
  /** Gán / thu hồi vai trò. role = null → thu hồi. Kiểm tra: không leo thang, Owner bảo vệ, không tự sửa mình. */
  setRole: wrap(async (uid, role, opts)=>{
    const c = actor("roles.assign"); stepUp("roles.assign");
    opts = opts || {}; uid = str(uid, 128); role = role || null;
    const px = role ? arr(opts.px) : [];
    const reason = str(opts.reason, 300);
    if(isFb()){ const r = await callable("setRole", { uid, role, px, reason }); return r; }
    const d = load(), target = demoUser(uid);
    if(!target) throw err("Không tìm thấy người dùng.", "not-found");
    const cur = d.roles[uid] || null;
    const chk = core.checkAssign(c, { uid, role: cur ? cur.role : null, px: cur ? cur.px : [], banned: target.banned }, role, px);
    if(!chk.ok){ demoAppend({ actor:{ uid:c.uid, name:c.name, role:c.role }, action:"role.denied", target:{ type:"user", id:uid, name:target.name }, details:{ want: role, code: chk.code } }); throw err(chk.msg, "admin/" + chk.code); }
    if(role) d.roles[uid] = { role, px: core.normPx(px), by: c.uid, at: now(), name: target.name };
    else delete d.roles[uid];
    save(d);
    await api.appendAudit({ action: role ? "role.assign" : "role.revoke", target:{ type:"user", id:uid, name:target.name },
      details:{ before: cur ? { role:cur.role, px:core.normPx(cur.px) } : null, after: role ? { role, px: core.normPx(px) } : null, reason } });
    await R.refresh();
    return { uid, role, px: core.normPx(px) };
  }),
  /** Chuyển nhượng Chủ sở hữu (chỉ Owner) — Owner cũ trở thành Quản trị cấp cao */
  transferOwnership: wrap(async (uid, opts)=>{
    const c = actor("owner.transfer"); stepUp("owner.transfer");
    opts = opts || {}; uid = str(uid, 128);
    if(str(opts.confirm, 40).toUpperCase() !== "CHUYỂN NHƯỢNG") throw err("Gõ đúng cụm từ CHUYỂN NHƯỢNG để xác nhận.", "admin/confirm");
    if(isFb()){ const r = await callable("transferOwnership", { uid, confirm:"CHUYỂN NHƯỢNG", reason: str(opts.reason, 300) }); await R.refresh(true); return r; }
    const d = load(), target = demoUser(uid);
    const chk = core.checkTransfer(c, target ? { uid, banned: target.banned } : {});
    if(!chk.ok) throw err(chk.msg, "admin/" + chk.code);
    const before = d.roles[uid] ? d.roles[uid].role : null;
    d.roles[uid] = { role:"owner", px:[], by:c.uid, at:now(), name: target.name };
    d.roles[c.uid] = { role:"super_admin", px:[], by:c.uid, at:now(), name: c.name };
    d.owner = uid; save(d);
    await api.appendAudit({ action:"owner.transfer", target:{ type:"user", id:uid, name:target.name }, details:{ from:c.uid, to:uid, targetBefore: before, fromAfter:"super_admin", reason: str(opts.reason, 300) } });
    await R.refresh();
    return { owner: uid };
  }),

  /* ---------- Khoá tài khoản ---------- */
  ban: wrap(async (uid, opts)=>{
    const c = actor("users.ban"); opts = opts || {}; uid = str(uid, 128);
    const reason = str(opts.reason, 300); if(reason.length < 4) throw err("Nhập lý do khoá (tối thiểu 4 ký tự).", "admin/reason");
    const days = Math.max(0, Math.min(3650, Math.round(Number(opts.days) || 0)));
    if(isFb()) return callable("banUser", { uid, reason, days });
    const d = load(), target = demoUser(uid); if(!target) throw err("Không tìm thấy người dùng.", "not-found");
    const chk = core.checkBan(c, { uid, role: d.roles[uid] ? d.roles[uid].role : null });
    if(!chk.ok) throw err(chk.msg, "admin/" + chk.code);
    d.bans[uid] = { by:c.uid, at:now(), reason, until: days ? now() + days * DAY : 0, liftedAt:0 }; save(d);
    await api.appendAudit({ action:"user.ban", target:{ type:"user", id:uid, name:target.name }, details:{ reason, days: days || "vĩnh viễn" } });
    return { uid, banned:true };
  }),
  unban: wrap(async (uid, opts)=>{
    const c = actor("users.ban"); opts = opts || {}; uid = str(uid, 128);
    if(isFb()) return callable("unbanUser", { uid, reason: str(opts.reason, 300) });
    const d = load(), target = demoUser(uid); if(!target) throw err("Không tìm thấy người dùng.", "not-found");
    const chk = core.checkBan(c, { uid, role: d.roles[uid] ? d.roles[uid].role : null }); if(!chk.ok) throw err(chk.msg, "admin/" + chk.code);
    if(!d.bans[uid]) return { uid, banned:false };
    d.bans[uid].liftedAt = now(); d.bans[uid].liftedBy = c.uid; save(d);
    await api.appendAudit({ action:"user.unban", target:{ type:"user", id:uid, name:target.name }, details:{ reason: str(opts.reason, 300) } });
    return { uid, banned:false };
  }),
  isBanned(uid){ if(isFb()) return false; const b = load().bans[uid]; return !!(b && !b.liftedAt && (!b.until || b.until > now())); },

  /* ---------- Ghi chú nội bộ (chỉ-thêm) ---------- */
  listNotes: wrap(async uid=>{
    actor(["users.note", "support.tickets"]);
    if(isFb()) return qd(await fdb().collection("user_notes").doc(uid).collection("notes").orderBy("ts", "desc").limit(50).get()).map(n=> Object.assign(n, { ts: tsOf(n.ts) }));
    return clone(arr(load().notes[uid]).slice().reverse());
  }),
  addNote: wrap(async (uid, text)=>{
    const c = actor("users.note"); text = str(text, 1000); if(text.length < 2) throw err("Ghi chú trống.", "admin/empty");
    const n = { by:c.uid, byName:c.name || "", text };
    if(isFb()) await fdb().collection("user_notes").doc(uid).collection("notes").add(Object.assign({}, n, { ts: firebase.firestore.FieldValue.serverTimestamp() }));
    else { const d = load(); (d.notes[uid] = arr(d.notes[uid])).push(Object.assign({ id: rid("n"), ts: now() }, n)); save(d); }
    await api.appendAudit({ action:"user.note", target:{ type:"user", id:uid }, details:{ length: text.length } });
    return true;
  }),

  /* ---------- PT: xác minh & niêm yết ---------- */
  requestVerify: wrap(async data=>{
    const u = needUser(); data = obj(data);
    const pr = cloud.profile || {}; if(!pr.isPT) throw err("Bật Chế độ PT trong Hồ sơ trước khi gửi xác minh.", "admin/not-pt");
    const doc = { uid:u.uid, name:u.name || "", brand: str(pr.brandName, 80), certName: str(data.certName, 120), certNo: str(data.certNo, 60), issuer: str(data.issuer, 120),
      years: Math.max(0, Math.min(60, Math.round(Number(data.years) || 0))), note: str(data.note, 500), status:"pending", at: now() };
    if(doc.certName.length < 3 || doc.issuer.length < 3) throw err("Nhập tên chứng chỉ và đơn vị cấp.", "admin/invalid");
    if(isFb()) await fdb().collection("pt_verifications").doc(u.uid).set(doc, { merge:true });
    else { const d = load(); if(d.ptVerify[u.uid] && d.ptVerify[u.uid].status === "verified") throw err("Hồ sơ đã được xác minh.", "admin/verified"); d.ptVerify[u.uid] = doc; save(d); }
    return doc;
  }),
  myVerify: wrap(async ()=>{ const u = me(); if(!u) return null; if(isFb()){ try{ return dd(await fdb().collection("pt_verifications").doc(u.uid).get()); }catch(e){ return null; } } return clone(load().ptVerify[u.uid] || null); }),
  listPT: wrap(async ()=>{
    actor(["pt.view", "pt.verify", "listings.moderate"]);
    if(isFb()){
      const ver = qd(await fdb().collection("pt_verifications").orderBy("at", "desc").limit(200).get());
      let pts = []; try{ if(can("users.view")) pts = arr(obj(await callable("adminListUsers", { filter:"pt", limit:300 })).users); }catch(e){}
      const m = {}; pts.forEach(p=> m[p.uid] = { uid:p.uid, name:p.name||"", brand:p.brandName||"", specialty:"", status: p.ptStatus === "verified" ? "verified" : "none", listingHidden: !!p.listingHidden });
      ver.forEach(v=>{ m[v.id] = Object.assign(m[v.id] || { uid:v.id, name:v.name, brand:v.brand }, v, { uid:v.id, at: tsOf(v.at), listingHidden: m[v.id] ? m[v.id].listingHidden : false }); });
      return Object.values(m);
    }
    const d = load(), cd = cloudDemo(), m = {};
    Object.values(cd.users).filter(u=> u && u.isPT).forEach(u=>{ m[u.uid] = { uid:u.uid, name:u.name||"", brand:u.brandName||"", specialty:u.specialty||"", status:"none" }; });
    Object.values(d.ptVerify).forEach(v=>{ m[v.uid] = Object.assign(m[v.uid] || {}, clone(v)); });
    Object.values(m).forEach(p=>{ p.listingHidden = !!(d.listings[p.uid] && d.listings[p.uid].hidden); });
    return Object.values(m).sort((a,b)=> (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || (b.at||0) - (a.at||0));
  }),
  verifyPT: wrap(async (uid, approve, note)=>{
    const c = actor("pt.verify"); note = str(note, 300);
    if(!approve && note.length < 4) throw err("Nhập lý do từ chối để PT biết cần bổ sung gì.", "admin/reason");
    const status = approve ? "verified" : "rejected";
    if(isFb()){
      const b = fdb().batch();
      b.set(fdb().collection("pt_verifications").doc(uid), { status, reviewNote: note, reviewedBy: c.uid, reviewedAt: now() }, { merge:true });
      b.set(fdb().collection("users").doc(uid), { ptVerified: !!approve, ptVerifiedAt: now(), ptVerifiedBy: c.uid }, { merge:true });
      await b.commit();
    } else { const d = load(); d.ptVerify[uid] = Object.assign(d.ptVerify[uid] || { uid }, { status, reviewNote: note, reviewedBy: c.uid, reviewedAt: now() }); save(d); }
    _ptCache[uid] = Object.assign(_ptCache[uid] || {}, { verified: !!approve });
    await api.appendAudit({ action: approve ? "pt.verify" : "pt.reject", target:{ type:"pt", id:uid }, details:{ note } });
    return { uid, status };
  }),
  setListing: wrap(async (uid, hidden, note)=>{
    const c = actor("listings.moderate"); note = str(note, 300);
    if(isFb()) await fdb().collection("users").doc(uid).set({ listingHidden: !!hidden, listingNote: note, listingBy: c.uid, listingAt: now() }, { merge:true });
    else { const d = load(); d.listings[uid] = { hidden: !!hidden, note, by: c.uid, at: now() }; save(d); }
    _ptCache[uid] = Object.assign(_ptCache[uid] || {}, { listingHidden: !!hidden });
    await api.appendAudit({ action: hidden ? "listing.hide" : "listing.show", target:{ type:"pt", id:uid }, details:{ note } });
    return { uid, hidden: !!hidden };
  }),
  /** Đồng bộ (cho findpt.js / community.js): { verified, listingHidden } — firebase đọc từ users/{uid} */
  ptStatus(uid){
    if(isFb()) return _ptCache[uid] || { verified:false, listingHidden:false };
    const d = load(); const v = d.ptVerify[uid], l = d.listings[uid];
    return { verified: !!(v && v.status === "verified"), listingHidden: !!(l && l.hidden) };
  },

  /* ---------- Kiểm duyệt ---------- */
  /** Gửi báo cáo vi phạm chung (module khác dùng: đánh giá PT, bình luận, bài kiến thức…) */
  report: wrap(async (type, refId, reason, extra)=>{
    const u = needUser(); const doc = { type: str(type, 20), refId: str(refId, 128), parentId: str(obj(extra).parentId, 128), title: str(obj(extra).title, 140), reason: str(reason, 300), by: u.uid, status:"open", createdAt: now() };
    if(!/^(routine|review|pt|listing|user|comment|kb|post)$/.test(doc.type)) throw err("Loại báo cáo không hợp lệ.", "admin/invalid");
    if(isFb()) await fdb().collection("reports").add(doc);
    else { const d = load(); if(d.reports.some(r=> r.by === u.uid && r.type === doc.type && r.refId === doc.refId && r.status === "open")) return { already:true }; d.reports.push(Object.assign({ id: rid("rp") }, doc)); save(d); }
    return { already:false };
  }),
  modQueue: wrap(async ()=>{
    actor(["reports.view", "reviews.moderate", "community.moderate"]);
    const out = [];
    const S = cloud.social, prof = t=> (S && S.moderation && S.moderation.findProfanity) ? S.moderation.findProfanity(t) : [];
    /* a) Routine cộng đồng bị báo cáo / bị ẩn */
    try{
      if(isFb()){
        const rs = qd(await fdb().collection("routines").where("reports", ">", 0).limit(100).get());
        rs.filter(r=> !r.approved || r.hidden).forEach(r=> out.push({ key:"routine:" + r.id, type:"routine", id:r.id, title:r.title || "", text:r.desc || "", author:r.authorName || "", authorUid:r.authorUid, count:r.reports || 0, reasons:[], hidden:!!r.hidden, ts: tsOf(r.updatedAt || r.createdAt) }));
      } else if(S && S._demo){
        const sd = S._demo.load();
        Object.values(sd.routines || {}).filter(r=> r && ((Number(r.reports)||0) > 0 || r.hidden) && !r.approved && !r.removed).forEach(r=> out.push({ key:"routine:" + r.id, type:"routine", id:r.id, title:r.title || "", text:r.desc || "",
          author:r.authorName || "", authorUid:r.authorUid, count:Number(r.reports)||0, reasons:Object.values(obj(sd.reports[r.id])).map(x=> x && x.reason).filter(Boolean), hidden:!!r.hidden, ts:r.updatedAt || r.createdAt || 0, bad: prof([r.title, r.desc].join(" ")) }));
      }
    }catch(e){ console.warn("[cloud-admin] routines", e); }
    /* b) Đánh giá sự kiện: từ ngữ thô tục, ≤ 2 sao, hoặc bị báo cáo */
    try{
      if(!isFb()){
        const ed = eventsDemo(), evs = obj(ed.events);
        Object.keys(obj(ed.reviews)).forEach(evId=> arr(ed.reviews[evId]).forEach(rv=>{
          const bad = prof(rv.text || ""); if(rv.modOk || rv.hidden) return;
          if(!(bad.length || rv.stars <= 2 || rv.reported)) return;
          out.push({ key:`review:${evId}:${rv.uid}`, type:"review", id:rv.uid, parentId:evId, title:`Đánh giá ${rv.stars}★ · ${(evs[evId] || {}).title || evId}`, text: rv.text || "", author: rv.name || "", authorUid: rv.uid, count: rv.reported ? 1 : 0, reasons: bad.length ? ["Từ ngữ không phù hợp: " + bad.join(", ")] : rv.stars <= 2 ? ["Đánh giá thấp — kiểm tra nội dung"] : [], hidden: !!rv.hidden, ts: rv.ts || 0, bad });
        }));
      }
    }catch(e){ console.warn("[cloud-admin] reviews", e); }
    /* c) Báo cáo chung */
    try{
      const reps = isFb() ? qd(await fdb().collection("reports").where("status", "==", "open").limit(100).get()) : load().reports.filter(r=> r.status === "open");
      reps.forEach(r=> out.push({ key:"report:" + r.id, type:"report", id:r.id, refType:r.type, refId:r.refId, parentId:r.parentId, title: r.title || `Báo cáo ${r.type}: ${r.refId}`, text: r.reason || "", author:"", count:1, reasons:[r.reason], ts: tsOf(r.createdAt), sample: !!r.sample }));
    }catch(e){ console.warn("[cloud-admin] reports", e); }
    return out.sort((a,b)=> (b.count - a.count) || (b.ts - a.ts));
  }),
  /** action: "keep" (giữ / bỏ qua) · "hide" · "delete" */
  moderate: wrap(async (item, action, note)=>{
    item = obj(item); note = str(note, 300);
    if(!["keep", "hide", "delete"].includes(action)) throw err("Hành động không hợp lệ.", "admin/invalid");
    const perm = item.type === "routine" ? "community.moderate" : item.type === "review" ? "reviews.moderate" : "reports.resolve";
    const c = actor(perm);
    if(item.type === "routine"){
      if(isFb()){
        const ref = fdb().collection("routines").doc(item.id);
        if(action === "delete") await ref.delete();
        else await ref.update({ hidden: action === "hide", approved: action === "keep", moderatedBy: c.uid, moderatedAt: now(), modNote: note });
      } else {
        const S = cloud.social; const sd = S._demo.load(), r = sd.routines[item.id]; if(!r) throw err("Routine không còn tồn tại.", "not-found");
        if(action === "delete"){ delete sd.routines[item.id]; ["likes","saves","copies","reports"].forEach(k=> sd[k] && delete sd[k][item.id]); }
        else Object.assign(r, { hidden: action === "hide", approved: action === "keep", moderatedBy: c.uid, moderatedAt: now(), modNote: note });
        S._demo.save(sd);
      }
    } else if(item.type === "review"){
      if(isFb()){
        const ref = fdb().collection("events").doc(item.parentId).collection("reviews").doc(item.id);
        if(action === "delete") await ref.delete(); else await ref.update({ hidden: action === "hide", modOk: action === "keep", moderatedBy: c.uid, moderatedAt: now() });
      } else {
        const ed = eventsDemo(); const list = arr(obj(ed.reviews)[item.parentId]);
        const i = list.findIndex(r=> r.uid === item.id); if(i < 0) throw err("Đánh giá không còn tồn tại.", "not-found");
        if(action === "delete") list.splice(i, 1); else Object.assign(list[i], { hidden: action === "hide", modOk: action === "keep" });
        localStorage.setItem("tapeasy_events_demo_v1", JSON.stringify(ed));
      }
    } else {
      const res = { status: action === "keep" ? "dismissed" : "resolved", resolution: action + (note ? ": " + note : ""), resolvedBy: c.uid, resolvedAt: now() };
      if(isFb()) await fdb().collection("reports").doc(item.id).update(res);
      else { const d = load(); const r = d.reports.find(x=> x.id === item.id); if(!r) throw err("Báo cáo không còn tồn tại.", "not-found"); Object.assign(r, res); save(d); }
    }
    if(!isFb() && item.type !== "report"){ const d = load(); let ch = false; d.reports.forEach(r=>{ if(r.status === "open" && r.refId === item.id && r.type === item.type){ Object.assign(r, { status:"resolved", resolution: action, resolvedBy: c.uid, resolvedAt: now() }); ch = true; } }); if(ch) save(d); }
    await api.appendAudit({ action: `mod.${item.type}.${action}`, target:{ type:item.type, id:item.id, name: str(item.title, 100) }, details:{ note, parentId: item.parentId || null } });
    return true;
  }),
  /** Ghim / bỏ ghim routine nổi bật (community.feature) */
  setFeatured: wrap(async (routineId, on)=>{
    const c = actor("community.feature");
    if(isFb()) await fdb().collection("routines").doc(routineId).update({ featured: !!on, featuredBy: c.uid, featuredAt: now() });
    else { const d = load(); if(on) d.featured[routineId] = { by:c.uid, at:now() }; else delete d.featured[routineId]; save(d); }
    await api.appendAudit({ action: on ? "community.feature" : "community.unfeature", target:{ type:"routine", id:routineId } });
    return !!on;
  }),
  featuredIds(){ return isFb() ? [] : Object.keys(load().featured || {}); },

  /* ---------- Hỗ trợ khách hàng ---------- */
  openTicket: wrap(async data=>{
    const u = needUser(); data = obj(data);
    const text = str(data.text, 2000); if(text.length < 10) throw err("Mô tả vấn đề tối thiểu 10 ký tự.", "admin/invalid");
    const doc = { uid:u.uid, name:u.name || "", topic: ["order","account","pt","event","bug","other"].includes(data.topic) ? data.topic : "other", text, status:"open", replies:[], createdAt: now(), updatedAt: now() };
    if(isFb()){ const ref = await fdb().collection("support_tickets").add(doc); return Object.assign({ id: ref.id }, doc); }
    const d = load(); const mine = d.tickets.filter(t=> t.uid === u.uid && t.createdAt > now() - DAY);
    if(mine.length >= 5) throw err("Bạn đã gửi 5 yêu cầu trong 24 giờ, đội hỗ trợ sẽ trả lời sớm.", "admin/rate");
    const t = Object.assign({ id: rid("tk") }, doc); d.tickets.push(t); save(d); return clone(t);
  }),
  myTickets: wrap(async ()=>{ const u = me(); if(!u) return [];
    if(isFb()) return qd(await fdb().collection("support_tickets").where("uid", "==", u.uid).limit(30).get()).sort((a,b)=> b.createdAt - a.createdAt);
    return clone(load().tickets.filter(t=> t.uid === u.uid).sort((a,b)=> b.createdAt - a.createdAt)); }),
  listTickets: wrap(async status=>{
    actor("support.tickets");
    let list = isFb() ? qd(await fdb().collection("support_tickets").orderBy("updatedAt", "desc").limit(100).get()) : clone(load().tickets);
    if(status) list = list.filter(t=> t.status === status);
    return list.sort((a,b)=> (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) || b.updatedAt - a.updatedAt);
  }),
  replyTicket: wrap(async (id, text, close)=>{
    const c = actor("support.tickets"); text = str(text, 2000); if(text.length < 2 && !close) throw err("Nội dung trả lời trống.", "admin/empty");
    const rep = text ? { by:c.uid, name:c.name || "", staff:true, text, ts: now() } : null;
    if(isFb()){
      const ref = fdb().collection("support_tickets").doc(id); const t = dd(await ref.get()); if(!t) throw err("Yêu cầu không còn tồn tại.", "not-found");
      await ref.update({ replies: arr(t.replies).concat(rep ? [rep] : []), status: close ? "closed" : "answered", updatedAt: now() });
    } else { const d = load(); const t = d.tickets.find(x=> x.id === id); if(!t) throw err("Yêu cầu không còn tồn tại.", "not-found");
      if(rep) t.replies.push(rep); t.status = close ? "closed" : "answered"; t.updatedAt = now(); save(d); }
    await api.appendAudit({ action: close ? "ticket.close" : "ticket.reply", target:{ type:"ticket", id }, details:{ length: text.length } });
    return true;
  }),

  /* ---------- Thông báo toàn hệ thống ---------- */
  broadcast: wrap(async data=>{
    const c = actor("broadcast.send"); data = obj(data);
    const b = { title: str(data.title, 60), body: str(data.body, 300), audience: ["all","pt","member","staff"].includes(data.audience) ? data.audience : "all",
      link: ["", "events", "shop", "community", "findpt", "kb"].includes(data.link || "") ? (data.link || "") : "", level: data.level === "important" ? "important" : "info" };
    if(b.title.length < 4 || b.body.length < 10) throw err("Tiêu đề ≥ 4 ký tự, nội dung ≥ 10 ký tự.", "admin/invalid");
    if(isFb()) return callable("sendBroadcast", b);
    const d = load(); const recent = d.broadcasts.filter(x=> x.ts > now() - DAY);
    if(recent.length >= BROADCAST_PER_DAY) throw err(`Tối đa ${BROADCAST_PER_DAY} thông báo / 24 giờ để tránh làm phiền người dùng.`, "admin/rate");
    const doc = Object.assign({ id: rid("bc"), by:c.uid, byName:c.name || "", ts: now(), retracted:false }, b);
    d.broadcasts.push(doc); save(d);
    await api.appendAudit({ action:"broadcast.send", target:{ type:"broadcast", id:doc.id, name:b.title }, details:{ audience:b.audience, level:b.level } });
    return clone(doc);
  }),
  listBroadcasts: wrap(async ()=>{
    actor(["broadcast.send", "panel.access"]);
    if(isFb()) return qd(await fdb().collection("broadcasts").orderBy("ts", "desc").limit(30).get()).map(b=> Object.assign(b, { ts: tsOf(b.ts) }));
    return clone(load().broadcasts.slice().reverse());
  }),
  retractBroadcast: wrap(async id=>{
    const c = actor("broadcast.send");
    if(isFb()) await fdb().collection("broadcasts").doc(id).update({ retracted:true, retractedBy:c.uid, retractedAt: now() });
    else { const d = load(); const b = d.broadcasts.find(x=> x.id === id); if(!b) throw err("Không tìm thấy thông báo.", "not-found"); b.retracted = true; b.retractedBy = c.uid; save(d); }
    await api.appendAudit({ action:"broadcast.retract", target:{ type:"broadcast", id } });
    return true;
  }),
  /** Cho MỌI người dùng: thông báo còn hiệu lực (14 ngày) đúng đối tượng */
  activeBroadcasts: wrap(async ()=>{
    let list = [];
    if(isFb()){ if(!me()) return []; try{ list = qd(await fdb().collection("broadcasts").orderBy("ts", "desc").limit(10).get()).map(b=> Object.assign(b, { ts: tsOf(b.ts) })); }catch(e){ return []; } }
    else list = load().broadcasts.slice().reverse();
    const pr = cloud.profile || {}, staff = !!R.role();
    return clone(list.filter(b=> !b.retracted && b.ts > now() - 14 * DAY && (b.audience === "all" || (b.audience === "pt" && pr.isPT) || (b.audience === "member" && me() && !pr.isPT) || (b.audience === "staff" && staff))));
  }),

  /* ---------- Cài đặt app ---------- */
  getSettings: wrap(async ()=>{
    let s = null;
    if(isFb()){ try{ s = dd(await fdb().collection("settings").doc("public").get()); }catch(e){} }
    else s = load().settings;
    if(!s){ try{ s = JSON.parse(localStorage.getItem(SETTINGS_CACHE) || "null"); }catch(e){} }
    _settings = s = Object.assign({ bank:{} }, obj(s)); s.bank = obj(s.bank);
    try{ localStorage.setItem(SETTINGS_CACHE, JSON.stringify(s)); }catch(e){}
    api.applySettings(s);
    return clone(s);
  }),
  saveSettings: wrap(async partial=>{
    const c = actor("settings.edit"); partial = obj(partial);
    const cur = Object.assign({ bank:{} }, clone(_settings || (isFb() ? {} : load().settings) || {}));
    const next = clone(cur); next.bank = obj(next.bank);
    const errs = [];
    if("bank" in partial){
      const b = obj(partial.bank), nb = { bankName: str(b.bankName, 60), bankBin: str(b.bankBin, 6).replace(/\D/g, ""), accountNo: str(b.accountNo, 19).replace(/\s/g, ""), accountName: str(b.accountName, 60).toUpperCase(), branch: str(b.branch, 80) };
      if(nb.bankBin && !/^\d{6}$/.test(nb.bankBin)) errs.push("Mã BIN ngân hàng gồm 6 chữ số (VD Vietcombank 970436).");
      if(nb.accountNo && !/^\d{6,19}$/.test(nb.accountNo)) errs.push("Số tài khoản chỉ gồm 6–19 chữ số.");
      if(nb.accountName && !/^[A-Z0-9 .\-]{3,60}$/.test(nb.accountName)) errs.push("Tên chủ tài khoản viết IN HOA KHÔNG DẤU (như trên thẻ).");
      if(core.canonical(nb) !== core.canonical(Object.assign({ bankName:"", bankBin:"", accountNo:"", accountName:"", branch:"" }, cur.bank))){
        if(!core.hasPerm(c.role, c.px, "settings.payment")) throw err("Chỉ Chủ sở hữu được sửa thông tin tài khoản nhận tiền.", "permission-denied");
        stepUp("settings.payment");
        next.bank = nb;
      }
    }
    const num = (k, min, max, label)=>{ if(k in partial){ const v = Math.round(Number(partial[k])); if(!(v >= min && v <= max)) errs.push(`${label}: từ ${min.toLocaleString("vi-VN")} đến ${max.toLocaleString("vi-VN")}.`); else next[k] = v; } };
    num("shippingFee", 0, 200000, "Phí ship"); num("freeShipFrom", 0, 10000000, "Miễn phí ship từ"); num("giftFundPct", 0, 50, "% quỹ quà");
    if("hotline" in partial) next.hotline = str(partial.hotline, 40);
    if("supportEmail" in partial){ const e = str(partial.supportEmail, 80); if(e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) errs.push("Email hỗ trợ không hợp lệ."); else next.supportEmail = e; }
    if("notice" in partial) next.notice = str(partial.notice, 200);
    if(errs.length) throw err(errs.join(" "), "admin/invalid");
    const changed = Object.keys(next).filter(k=> core.canonical(next[k]) !== core.canonical(cur[k]));
    if(!changed.length) return clone(cur);
    next.updatedAt = now(); next.updatedBy = c.uid;
    if(isFb()){
      // QS-05: tài khoản nhận tiền CHỈ đổi qua callable setPaymentInfo (Owner, xác thực lại ≤ 5 phút, audit + thư báo Owner — máy chủ kiểm);
      //   rules cấm client ghi trường bank
      if(changed.includes("bank")){ const r = await callable("setPaymentInfo", { bank: next.bank }); if(r && r.bank) next.bank = r.bank; }
      const rest = Object.assign({}, next); delete rest.bank;
      if(changed.some(k=> k !== "bank")) await fdb().collection("settings").doc("public").set(rest, { merge:true });
    }
    else { const d = load(); d.settings = next; save(d); }
    _settings = next; try{ localStorage.setItem(SETTINGS_CACHE, JSON.stringify(next)); }catch(e){}
    api.applySettings(next);
    const show = (k, v)=> k === "bank" ? { bankName: v.bankName, bankBin: v.bankBin, accountNo: core.mask(v.accountNo), accountName: v.accountName } : v;
    await api.appendAudit({ action: changed.includes("bank") ? "settings.payment" : "settings.update", target:{ type:"settings", id:"public" },
      details:{ changed: changed.filter(k=> !["updatedAt","updatedBy"].includes(k)).map(k=> ({ key:k, before: show(k, obj(cur)[k] || (k === "bank" ? {} : null)), after: show(k, next[k]) })) } });
    return clone(next);
  }),
  /** Áp cài đặt vào gian hàng đang chạy (TapShop.core.CFG — shop.js đọc mỗi lần vẽ) */
  applySettings(s){
    s = obj(s);
    try{
      const CFG = G.TapShop && G.TapShop.core && G.TapShop.core.CFG; if(!CFG) return false;
      ["shippingFee", "freeShipFrom", "giftFundPct"].forEach(k=>{ if(typeof s[k] === "number") CFG[k] = s[k]; });
      if(s.hotline) CFG.hotline = s.hotline;
      const b = obj(s.bank); if(b.accountNo || b.bankBin) CFG.bank = Object.assign({}, CFG.bank, Object.fromEntries(Object.entries(b).filter(([,v])=> v)));
      return true;
    }catch(e){ return false; }
  },

  /* ---------- Voucher toàn hệ thống ---------- */
  listVouchers: wrap(async ()=>{ actor("vouchers.manage"); if(isFb()) return qd(await fdb().collection("vouchers").limit(200).get()); return clone(Object.values(load().vouchers)).sort((a,b)=> b.at - a.at); }),
  saveVoucher: wrap(async v=>{
    const c = actor("vouchers.manage"); v = obj(v);
    const code = str(v.code, 16).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const doc = { code, kind: ["percent","amount","freeship"].includes(v.kind) ? v.kind : "amount", value: Math.max(0, Math.round(Number(v.value) || 0)), min: Math.max(0, Math.round(Number(v.min) || 0)),
      cap: Math.max(0, Math.round(Number(v.cap) || 0)), uses: Math.max(1, Math.min(100000, Math.round(Number(v.uses) || 100))), exp: str(v.exp, 10), title: str(v.title, 60), revoked:false, by:c.uid, at: now() };
    if(code.length < 4) throw err("Mã voucher 4–16 ký tự chữ/số.", "admin/invalid");
    if(doc.kind === "percent" && !(doc.value >= 1 && doc.value <= 50)) throw err("Giảm theo % chỉ từ 1–50%.", "admin/invalid");
    if(doc.kind === "amount" && !(doc.value >= 1000)) throw err("Giảm theo số tiền tối thiểu 1.000đ.", "admin/invalid");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(doc.exp)) throw err("Chọn ngày hết hạn.", "admin/invalid");
    if(isFb()) await fdb().collection("vouchers").doc(code).set(doc, { merge:true });
    else { const d = load(); doc.used = (d.vouchers[code] || {}).used || 0; d.vouchers[code] = doc; save(d); }
    await api.appendAudit({ action:"voucher.save", target:{ type:"voucher", id:code, name:doc.title }, details:{ kind:doc.kind, value:doc.value, uses:doc.uses, exp:doc.exp } });
    return clone(doc);
  }),
  revokeVoucher: wrap(async code=>{
    const c = actor("vouchers.manage");
    if(isFb()) await fdb().collection("vouchers").doc(code).update({ revoked:true, revokedBy:c.uid, revokedAt: now() });
    else { const d = load(); if(!d.vouchers[code]) throw err("Không tìm thấy mã.", "not-found"); d.vouchers[code].revoked = true; save(d); }
    await api.appendAudit({ action:"voucher.revoke", target:{ type:"voucher", id:code } });
    return true;
  }),
  /** Cho người mua (shop.js): tra 1 mã còn hiệu lực */
  lookupVoucher: wrap(async code=>{
    code = str(code, 16).toUpperCase().replace(/[^A-Z0-9]/g, ""); if(code.length < 4) return null;
    const v = isFb() ? dd(await fdb().collection("vouchers").doc(code).get()) : clone(load().vouchers[code] || null);
    const today = new Date().toISOString().slice(0, 10);
    if(!v || v.revoked || (v.exp && v.exp < today) || (v.used || 0) >= v.uses) return null;
    return v;
  }),

  /* ---------- Nhật ký kiểm toán ---------- */
  appendAudit: wrap(async entry=>{
    entry = obj(entry);
    const u = me(), c = R.current();
    const a = entry.actor || (u ? { uid:u.uid, name:u.name || "", role: c ? c.role : null } : null);
    if(isFb()){
      // QS-15: client KHÔNG ghi thẳng admin_audit (rules create:false). Gửi qua callable logAdminAction — máy chủ lấy người làm / vai trò
      //   từ roles/{uid} (bỏ qua entry.actor), chỉ nhận hành động thuộc quyền; hành động nhạy cảm do chính callable đó ghi.
      const action = str(entry.action, 60);
      if(!u || SERVER_AUDITED.test(action)) return null;
      try{ await callable("logAdminAction", { action, target: entry.target || null, details: sanitizeDetails(entry.details) }); }catch(e){ console.warn("[audit]", e && e.message); }
      return null;
    }
    return demoAppend(Object.assign({}, entry, { actor: a }));
  }),
  listAudit: wrap(async opts=>{
    actor("audit.view"); opts = obj(opts);
    let list;
    if(isFb()) list = qd(await fdb().collection("admin_audit").orderBy("ts", "desc").limit(Math.min(500, opts.limit || 200)).get()).map(e=> Object.assign(e, { ts: tsOf(e.ts), actor:{ uid:e.actorUid, name:e.actorName, role:e.actorRole } }));
    else list = clone(load().audit).reverse().slice(0, opts.limit || 500);
    const q = str(opts.q, 60).toLowerCase();
    if(q) list = list.filter(e=> [e.action, e.actor && e.actor.name, e.actor && e.actor.uid, e.target && e.target.name, e.target && e.target.id].join(" ").toLowerCase().includes(q));
    if(opts.group) list = list.filter(e=> String(e.action).split(".")[0] === opts.group);
    return list;
  }),
  /** Kiểm tra toàn vẹn chuỗi băm (demo cục bộ; firebase: so seq/hash do Function chainAudit gán) */
  verifyAudit: wrap(async ()=>{
    actor("audit.view");
    // QS-15: máy chủ tính lại SHA-256 từng bản ghi, so đầu chuỗi admin_audit_meta/head (phát hiện cắt đuôi), đọc hết theo trang
    if(isFb()) return callable("verifyAudit", {});
    const res = core.verifyChain(load().audit);
    return Object.assign({}, res, { note: "Bản demo: chuỗi băm lưu trên máy này — người sửa được localStorage có thể viết lại cả chuỗi. Bản thật: máy chủ giữ chuỗi." });
  }),

  /* ---------- Số liệu tổng quan ---------- */
  stats: wrap(async ()=>{
    const c = actor("panel.access"), P = p=> core.hasPerm(c.role, c.px, p);
    const out = { at: now() };
    const d14 = Array.from({ length:14 }, (_, i)=>{ const t = new Date(now() - (13 - i) * DAY); return t.toISOString().slice(0, 10); });
    if(isFb()){
      const db = fdb();
      if(P("users.view")){ try{ const r = obj(await callable("adminListUsers", { limit:0, counts:true })); out.users = r.total; out.pts = r.pts; out.banned = r.banned; if(P("roles.view")) out.staff = r.staff; }catch(e){} }
      if(P("pt.view") || P("pt.verify")) out.ptPending = await fbCount(db.collection("pt_verifications").where("status", "==", "pending"));
      if(P("reports.view")) out.reportsOpen = await fbCount(db.collection("reports").where("status", "==", "open"));
      if(P("support.tickets")) out.ticketsOpen = await fbCount(db.collection("support_tickets").where("status", "==", "open"));
    } else {
      const us = demoUsers(), d = load();
      if(P("users.view") || P("analytics.view")){
        out.users = us.length; out.pts = us.filter(u=> u.isPT).length; out.new7 = us.filter(u=> u.createdAt > now() - 7 * DAY).length;
        out.signups = d14.map(day=> ({ day, n: us.filter(u=> u.createdAt && new Date(u.createdAt).toISOString().slice(0, 10) === day).length }));
        out.banned = us.filter(u=> u.banned).length;
      }
      if(P("pt.view") || P("pt.verify")) out.ptPending = Object.values(d.ptVerify).filter(v=> v.status === "pending").length;
      if(P("reports.view") || P("community.moderate") || P("reviews.moderate")){ try{ out.reportsOpen = (await api.modQueue()).length; }catch(e){} }
      if(P("support.tickets")) out.ticketsOpen = d.tickets.filter(t=> t.status === "open").length;
      if(P("roles.view")) out.staff = Object.keys(d.roles).length;
      out.broadcasts7 = d.broadcasts.filter(b=> b.ts > now() - 7 * DAY).length;
    }
    /* Sự kiện & cửa hàng (dùng cloudEvents) */
    const CE = G.cloudEvents;
    if(CE){
      try{ if(P("events.manage") || P("challenges.manage") || P("events.checkin") || P("analytics.view")){
        const today = new Date().toISOString().slice(0, 10);
        const [chs, evs] = await Promise.all([CE.listChallenges(), CE.listEvents()]);
        out.challengesActive = chs.filter(x=> !x.hidden && x.start <= today && x.end >= today).length;
        out.eventsUpcoming = evs.filter(e=> !e.hidden && String(e.start).slice(0, 10) >= today).length;
        out.regs = evs.reduce((a, e)=> a + (Number(e.regCount) || 0), 0);
      } }catch(e){}
      try{ if(P("shop.orders") || P("orders.view") || P("analytics.view")){
        const orders = await (rawCE.allOrders || CE.allOrders)();
        const m = new Date().toISOString().slice(0, 7), live = orders.filter(o=> o.status !== "cancelled");
        out.ordersPending = orders.filter(o=> ["pending", "awaiting_payment"].includes(o.status)).length;
        out.revenueMonth = live.filter(o=> new Date(o.createdAt || 0).toISOString().slice(0, 7) === m).reduce((a, o)=> a + (Number(o.total) || 0), 0);
        out.orders = orders.length;
      } }catch(e){}
    }
    return out;
  }),

  _demo: { load, save, reset(){ try{ localStorage.removeItem(KEY); }catch(e){} }, users: demoUsers },
};

/* ---------------------------------------------------------------------
   4. BỌC QUYỀN cho cloudEvents (events.js / shop.js) — chặn ở lớp dữ liệu + ghi audit
   --------------------------------------------------------------------- */
const rawCE = {};
function guardEvents(){
  const CE = G.cloudEvents; if(!CE || CE.__rbac) return false;
  const methods = { saveChallenge:"challenges.manage", deleteChallenge:"challenges.manage", saveEvent:"events.manage", deleteEvent:"events.manage",
    getCheckinCode:["events.manage", "events.checkin"], listRegs:["events.checkin", "events.manage"], adminCheckIn:"events.checkin",
    saveProduct:"shop.products", deleteProduct:"shop.products", allOrders:["shop.orders", "orders.view"], updateOrder:"shop.orders",
    allGifts:"gifts.manage", createGift:"gifts.manage", updateGift:"gifts.manage" };
  const AUDIT = { saveChallenge:"challenge.save", deleteChallenge:"challenge.delete", saveEvent:"event.save", deleteEvent:"event.delete", adminCheckIn:"event.checkin",
    saveProduct:"product.save", deleteProduct:"product.delete", updateOrder:"order.update", createGift:"gift.create", updateGift:"gift.update" };
  Object.keys(methods).forEach(name=>{
    if(typeof CE[name] !== "function") return;
    const orig = rawCE[name] = CE[name];
    CE[name] = async function(...a){
      const meU = me();
      /* Ngoại lệ đúng nghiệp vụ cũ: người dùng tự xác nhận địa chỉ nhận quà của mình; bản demo tự "trao quà" cho chính mình khi hết tháng */
      if(name === "updateGift" && a[1] && obj(a[1]).status === "confirmed" && Object.keys(obj(a[1])).every(k=> ["status","address","size","confirmedAt","updatedAt"].includes(k))) return orig.apply(this, a);
      if(name === "createGift" && CE.mode === "demo" && meU && obj(a[0]).uid === meU.uid && !R.can("gifts.manage")) return orig.apply(this, a);
      let c;
      try{ c = actor(methods[name]); }catch(e){ throw nice(e); }
      if(name === "updateOrder"){
        const p = obj(a[1]);
        if(p.status === "cancelled" || p.refund){
          let o = null; try{ o = (rawCE.allOrders ? await rawCE.allOrders() : []).find(x=> x.id === a[0]); }catch(e){}
          if(o && ["confirmed", "shipping", "delivered"].includes(o.status) && !core.hasPerm(c.role, c.px, "shop.refund")) throw err("Huỷ đơn đã xác nhận = hoàn tiền: cần quyền " + R.label("shop.refund") + ".", "permission-denied");
        }
      }
      const res = await orig.apply(this, a);
      if(AUDIT[name]){
        const action = AUDIT[name], id = typeof a[0] === "string" ? a[0] : obj(a[0]).id || obj(res).id || "";
        const nm = obj(a[0]).title || obj(a[0]).name || obj(res).title || obj(res).name || "";
        const det = name === "updateOrder" || name === "updateGift" ? { patch: Object.keys(obj(a[1])), status: obj(a[1]).status || null } : name === "adminCheckIn" ? { code: "••" + String(a[1] || "").slice(-2) } : null;
        api.appendAudit({ action, target:{ type: action.split(".")[0], id, name: nm }, details: det }).catch(()=>{});
      }
      return res;
    };
  });
  CE.isAdminRemote = async ()=> R.legacyAdmin();
  CE.__rbac = true;
  return true;
}

/* ---------------------------------------------------------------------
   5. CHẶN ĐĂNG NHẬP TÀI KHOẢN BỊ KHOÁ (demo) + dịch lỗi auth/user-disabled (firebase)
   --------------------------------------------------------------------- */
function guardAuth(){
  if(cloud.__adminBan) return; cloud.__adminBan = true;
  ["signIn", "signInWithGoogle", "signInWithFacebook", "signInWithApple"].forEach(k=>{
    const orig = cloud[k]; if(typeof orig !== "function") return;
    cloud[k] = async function(...a){
      let u;
      try{ u = await orig.apply(this, a); }
      catch(e){ if(e && /user-disabled/.test(e.code || "")) throw err("Tài khoản đã bị khoá. Liên hệ hỗ trợ TapEasy nếu bạn cho rằng đây là nhầm lẫn.", "auth/user-disabled"); throw e; }
      if(!isFb() && cloud.user && api.isBanned(cloud.user.uid)){ try{ await cloud.signOut(); }catch(_){} throw err("Tài khoản đã bị khoá. Liên hệ hỗ trợ TapEasy nếu bạn cho rằng đây là nhầm lẫn.", "auth/user-disabled"); }
      return u;
    };
  });
}

try{ guardEvents(); }catch(e){ console.warn("[cloud-admin] guardEvents", e); }
try{ guardAuth(); }catch(e){ console.warn("[cloud-admin] guardAuth", e); }
G.cloudAdmin = api;
api._raw = rawCE; api._guardEvents = guardEvents;
/* Áp cài đặt đã lưu ngay (không chờ mạng) rồi khởi động */
try{ const s = JSON.parse(localStorage.getItem(SETTINGS_CACHE) || "null"); if(s) api.applySettings(s); }catch(e){}
Promise.resolve().then(()=> cloud.init ? cloud.init() : null).then(()=>{
  if(!isFb() && cloud.user && api.isBanned(cloud.user.uid)){ cloud.signOut().catch(()=>{}); try{ toast("Tài khoản đã bị khoá", "lock"); }catch(e){} }
  return api.init();
}).catch(e=> console.warn("[cloud-admin] init", e));
})(typeof window !== "undefined" ? window : globalThis);

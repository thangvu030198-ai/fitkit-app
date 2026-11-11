/* =========================================================================
   TapEasy — LÕI PHÂN QUYỀN QUẢN TRỊ (RBAC) · rbac.js
   Nạp SỚM: ngay sau cloud.js (trước data.js / app.js).

   window.TE_RBAC = {
     role()                 → khoá vai trò của tài khoản đang đăng nhập ("owner", "admin", …) hoặc null
     active()               → đang ở phiên quản trị (đã đăng nhập tài khoản quản trị, chưa hết hạn)
     can(perm) / canAny([…])→ true khi phiên quản trị đang mở VÀ vai trò có quyền đó
     require(perm, onDenied)→ true/false; từ chối → gọi onDenied(perm, lý do) hoặc hiện toast
     guard(perm, fn)        → bọc hàm: chỉ chạy khi có quyền
     roles, perms, groups, matrix, core (hàm thuần: kiểm tra leo thang, chuỗi băm audit…)
     login(pw) / logout() / stepUp(pw) / needsStepUp(perm) / openLogin()
     onChange(cb), refresh(force), audit(action, target, details)
   }
   window.teCan(perm) → TE_RBAC.can(perm)   (nếu module khác đã định nghĩa teCan → thay bằng bản gọi TE_RBAC)

   Bảo mật thật nằm ở MÁY CHỦ: Firebase custom claims `role`/`px` do Cloud Function setRole
   cấp (functions/admin.js) + firestore.rules hasPerm() (docs/INTEGRATION-admin.md).
   Chế độ demo chỉ mô phỏng trên máy này (ai sửa được localStorage thì sửa được quyền).

   Tương thích cũ: `state.isAdmin` (events.js / shop.js) giờ là thuộc tính TÍNH TỪ RBAC —
   gán tay không có tác dụng; "chạm 7 lần dòng phiên bản" mở màn ĐĂNG NHẬP QUẢN TRỊ thay vì bật quyền.
   ========================================================================= */
(function(G){
"use strict";
if(G.TE_RBAC && G.TE_RBAC.__v) return;

/* ---------------------------------------------------------------------
   1. DANH MỤC QUYỀN (nhóm.hành_động)
   --------------------------------------------------------------------- */
const GROUPS = {
  panel:"Bảng quản trị", analytics:"Phân tích", data:"Dữ liệu", users:"Người dùng", roles:"Phân quyền", owner:"Phân quyền",
  pt:"PT & niêm yết", listings:"PT & niêm yết", reports:"Kiểm duyệt", reviews:"Kiểm duyệt", community:"Kiểm duyệt",
  kb:"Kho kiến thức", events:"Sự kiện & thi đua", challenges:"Sự kiện & thi đua", gifts:"Sự kiện & thi đua",
  shop:"Cửa hàng", orders:"Cửa hàng", vouchers:"Cửa hàng", support:"Hỗ trợ khách hàng", broadcast:"Thông báo",
  settings:"Cài đặt", audit:"Kiểm toán",
};
const PERM_DEFS = [
  ["panel.access",       "Vào bảng quản trị"],
  ["analytics.view",     "Xem số liệu tổng quan & thống kê"],
  ["data.export",        "Xuất dữ liệu CSV"],
  ["users.view",         "Xem danh sách & hồ sơ người dùng"],
  ["users.pii",          "Xem email / SĐT / địa chỉ (dữ liệu cá nhân)"],
  ["users.note",         "Ghi chú nội bộ trên hồ sơ người dùng"],
  ["users.ban",          "Khoá / mở khoá tài khoản"],
  ["users.delete",       "Xoá tài khoản theo yêu cầu"],
  ["roles.view",         "Xem đội ngũ & vai trò"],
  ["roles.assign",       "Gán / thu hồi vai trò (thấp hơn mình)"],
  ["owner.transfer",     "Chuyển nhượng quyền Chủ sở hữu"],
  ["pt.view",            "Xem hồ sơ PT & yêu cầu xác minh"],
  ["pt.verify",          "Xác minh / thu hồi tích xanh PT"],
  ["listings.moderate",  "Ẩn / hiện niêm yết PT (Tìm PT)"],
  ["reports.view",       "Xem hàng đợi báo cáo vi phạm"],
  ["reports.resolve",    "Xử lý báo cáo vi phạm"],
  ["reviews.moderate",   "Ẩn / xoá đánh giá (PT, sự kiện)"],
  ["community.moderate", "Ẩn / khôi phục / xoá bài cộng đồng, bình luận"],
  ["community.feature",  "Ghim / nổi bật bài cộng đồng"],
  ["kb.edit",            "Soạn / sửa bài kho kiến thức"],
  ["kb.publish",         "Xuất bản / gỡ bài kho kiến thức"],
  ["events.manage",      "Tạo / sửa / ẩn sự kiện offline"],
  ["events.checkin",     "Check-in, quét vé, xem danh sách đăng ký"],
  ["challenges.manage",  "Tạo / sửa thử thách, chốt kết quả"],
  ["gifts.manage",       "Trao quà, cập nhật giao quà"],
  ["shop.products",      "Sản phẩm, giá, tồn kho"],
  ["orders.view",        "Xem đơn hàng (chỉ đọc)"],
  ["shop.orders",        "Cập nhật trạng thái đơn hàng"],
  ["shop.refund",        "Huỷ / hoàn tiền đơn đã xác nhận"],
  ["vouchers.manage",    "Tạo / thu hồi mã giảm giá"],
  ["support.tickets",    "Xem & trả lời yêu cầu hỗ trợ"],
  ["broadcast.send",     "Gửi thông báo toàn hệ thống"],
  ["settings.view",      "Xem cài đặt app"],
  ["settings.edit",      "Sửa cài đặt chung (phí ship, hotline…)"],
  ["settings.payment",   "Sửa thông tin chuyển khoản nhận tiền"],
  ["audit.view",         "Xem nhật ký kiểm toán"],
];
const PERM_IDS = PERM_DEFS.map(p=> p[0]);
const PERMS = {};
PERM_DEFS.forEach(([id, label])=>{ PERMS[id] = { id, label, group: id.split(".")[0], groupLabel: GROUPS[id.split(".")[0]] || id.split(".")[0] }; });
/** Chỉ đi kèm vai trò — KHÔNG cấp lẻ (px "+…") cho ai được */
const SENSITIVE = ["roles.assign", "owner.transfer", "settings.payment", "users.delete"];
/** Thao tác cần xác thực lại mật khẩu trong 5 phút gần nhất */
const STEP_UP = ["roles.assign", "owner.transfer", "settings.payment", "users.delete"];

/* ---------------------------------------------------------------------
   2. VAI TRÒ (cấp càng cao càng nhiều quyền; chỉ gán được vai trò THẤP HƠN mình)
   --------------------------------------------------------------------- */
const ALL = PERM_IDS.slice();
const minus = (list, rm)=> list.filter(p=> !rm.includes(p));
const ROLE_DEFS = [
  ["owner",           100, "Chủ sở hữu",        "Owner",       "Duy nhất · toàn quyền · chuyển nhượng được. Không ai hạ được vai trò này.", ALL],
  ["super_admin",      90, "Quản trị cấp cao",  "Super Admin", "Toàn quyền vận hành, gán vai trò thấp hơn. Không sửa tài khoản nhận tiền, không chuyển nhượng.", minus(ALL, ["owner.transfer", "settings.payment"])],
  ["admin",            70, "Quản trị viên",     "Admin",       "Vận hành hằng ngày mọi mảng. Không gán vai trò, không xoá tài khoản, không sửa tài khoản nhận tiền.", minus(ALL, ["owner.transfer", "settings.payment", "roles.assign", "users.delete"])],
  ["content_manager",  50, "Quản lý nội dung",  "Content",     "Kho kiến thức (soạn, xuất bản) và cộng đồng (kiểm duyệt, ghim bài).",
    ["panel.access", "analytics.view", "users.view", "kb.edit", "kb.publish", "community.moderate", "community.feature", "reports.view", "reports.resolve"]],
  ["event_manager",    50, "Quản lý sự kiện",   "Events",      "Thử thách, sự kiện offline, check-in, trao quà.",
    ["panel.access", "analytics.view", "data.export", "users.view", "events.manage", "events.checkin", "challenges.manage", "gifts.manage"]],
  ["shop_manager",     50, "Quản lý cửa hàng",  "Shop",        "Sản phẩm, đơn hàng, hoàn tiền, voucher, giao quà.",
    ["panel.access", "analytics.view", "data.export", "users.view", "shop.products", "orders.view", "shop.orders", "shop.refund", "vouchers.manage", "gifts.manage", "settings.view"]],
  ["pt_manager",       50, "Quản lý PT",        "PT",          "Xác minh PT, niêm yết Tìm PT, đánh giá PT.",
    ["panel.access", "users.view", "pt.view", "pt.verify", "listings.moderate", "reviews.moderate", "reports.view"]],
  ["moderator",        40, "Kiểm duyệt viên",   "Moderator",   "Hàng đợi báo cáo, đánh giá, bình luận / bài cộng đồng.",
    ["panel.access", "users.view", "reports.view", "reports.resolve", "reviews.moderate", "community.moderate"]],
  ["support",          40, "Hỗ trợ khách hàng", "Support",     "Tra cứu người dùng, đơn hàng; trả lời yêu cầu hỗ trợ; ghi chú.",
    ["panel.access", "users.view", "users.pii", "users.note", "orders.view", "support.tickets"]],
  ["analyst",          20, "Phân tích",         "Analyst",     "Chỉ xem số liệu, xuất CSV không chứa dữ liệu cá nhân.",
    ["panel.access", "analytics.view", "data.export", "users.view", "orders.view", "pt.view"]],
];
const ROLES = {};
ROLE_DEFS.forEach(([id, level, label, short, desc, perms])=>{
  ROLES[id] = { id, level, label, short, desc, perms: PERM_IDS.filter(p=> perms.includes(p)) };
});
const ROLE_ORDER = ROLE_DEFS.map(r=> r[0]);
/* QS-18: tra vai trò / quyền bằng thuộc tính RIÊNG — "__proto__", "constructor", "toString"… (thuộc tính nguyên mẫu Object) không phải vai trò */
const own = (o, k)=> typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
const isRole = r=> own(ROLES, r);
const MATRIX = {}; ROLE_ORDER.forEach(r=> MATRIX[r] = ROLES[r].perms.slice());

/* ---------------------------------------------------------------------
   3. HÀM THUẦN (dùng chung: client, kiểm thử Node, Cloud Functions có bản sao đồng bộ)
   --------------------------------------------------------------------- */
const MAX_PX = 12;
const level = r=> isRole(r) ? ROLES[r].level : 0;
function normPx(px){
  const out = [];
  (Array.isArray(px) ? px : []).forEach(x=>{ x = String(x||"").trim(); if(/^[+-][a-z]+\.[a-z_]+$/.test(x) && own(PERMS, x.slice(1)) && !out.includes(x)) out.push(x); });
  return out.sort();
}
/** Tập quyền hiệu lực của (vai trò, ngoại lệ). Owner luôn đủ quyền, không nhận ngoại lệ. */
function permsOf(role, px){
  if(!isRole(role)) return [];
  if(role === "owner") return ALL.slice();
  const set = new Set(ROLES[role].perms);
  normPx(px).forEach(x=>{ const p = x.slice(1); if(x[0] === "-") set.delete(p); else if(!SENSITIVE.includes(p)) set.add(p); });
  set.add("panel.access");
  return PERM_IDS.filter(p=> set.has(p));
}
const hasPerm = (role, px, perm)=> permsOf(role, px).includes(perm);
const subset = (a, b)=> a.every(x=> b.includes(x));
const R = (ok, code, msg)=> ok ? { ok:true } : { ok:false, code, msg };

/** Vai trò mà actor được phép gán (thấp hơn mình + quyền là tập con của mình) */
function assignable(actorRole, actorPx){
  const mine = permsOf(actorRole, actorPx);
  if(!mine.includes("roles.assign")) return [];
  return ROLE_ORDER.filter(r=> r !== "owner" && level(r) < level(actorRole) && subset(ROLES[r].perms, mine));
}
/** Quyền lẻ actor được cấp thêm cho người khác (+): là quyền của actor, không nhạy cảm */
function grantable(actorRole, actorPx){ return permsOf(actorRole, actorPx).filter(p=> !SENSITIVE.includes(p) && p !== "panel.access"); }

/**
 * Kiểm tra gán / thu hồi vai trò.
 * actor  {uid, role, px}  ·  target {uid, role, px, banned}  ·  newRole: khoá vai trò hoặc null (thu hồi)  ·  newPx: ngoại lệ
 */
function checkAssign(actor, target, newRole, newPx){
  actor = actor || {}; target = target || {};
  const mine = permsOf(actor.role, actor.px);
  if(!mine.includes("roles.assign")) return R(false, "no-perm", "Bạn không có quyền gán vai trò.");
  if(!target.uid) return R(false, "bad-target", "Không tìm thấy người dùng.");
  if(actor.uid && actor.uid === target.uid) return R(false, "self", "Không thể tự đổi vai trò của chính mình.");
  if(target.role === "owner") return R(false, "owner-protected", "Chủ sở hữu không thể bị thay đổi vai trò (chỉ chính Chủ sở hữu chuyển nhượng).");
  if(level(target.role) >= level(actor.role)) return R(false, "peer-or-higher", "Không thể thay đổi người ngang cấp hoặc cấp cao hơn bạn.");
  if(newRole === "owner") return R(false, "owner-transfer-only", "Quyền Chủ sở hữu chỉ trao bằng chức năng Chuyển nhượng.");
  if(newRole != null && !isRole(newRole)) return R(false, "bad-role", "Vai trò không hợp lệ.");
  if(newRole == null){ return (Array.isArray(newPx) && newPx.length) ? R(false, "bad-px", "Thu hồi vai trò thì không kèm quyền lẻ.") : R(true); }
  if(target.banned) return R(false, "banned", "Tài khoản đang bị khoá — mở khoá trước khi cấp vai trò.");
  if(level(newRole) >= level(actor.role)) return R(false, "escalation", "Không thể cấp vai trò ngang hoặc cao hơn vai trò của bạn.");
  const raw = Array.isArray(newPx) ? newPx : [];
  const px = normPx(raw);
  if(px.length !== raw.length) return R(false, "bad-px", "Quyền lẻ không hợp lệ.");
  if(px.length > MAX_PX) return R(false, "bad-px", `Tối đa ${MAX_PX} quyền lẻ.`);
  if(px.some(x=> x[0] === "+" && SENSITIVE.includes(x.slice(1)))) return R(false, "sensitive-extra", "Quyền nhạy cảm (gán vai trò, chuyển nhượng, tài khoản nhận tiền, xoá tài khoản) chỉ đi kèm vai trò.");
  if(px.some(x=> x === "-panel.access")) return R(false, "bad-px", "Không thể bỏ quyền vào bảng quản trị của một vai trò.");
  if(!subset(permsOf(newRole, px), mine)) return R(false, "escalation", "Không thể cấp quyền mà chính bạn không có.");
  return R(true);
}
/** Khoá / mở khoá tài khoản */
function checkBan(actor, target){
  actor = actor || {}; target = target || {};
  if(!hasPerm(actor.role, actor.px, "users.ban")) return R(false, "no-perm", "Bạn không có quyền khoá tài khoản.");
  if(!target.uid) return R(false, "bad-target", "Không tìm thấy người dùng.");
  if(actor.uid && actor.uid === target.uid) return R(false, "self", "Không thể tự khoá tài khoản của mình.");
  if(target.role === "owner") return R(false, "owner-protected", "Không thể khoá Chủ sở hữu.");
  if(target.role && level(target.role) >= level(actor.role)) return R(false, "peer-or-higher", "Không thể khoá người ngang cấp hoặc cấp cao hơn bạn.");
  return R(true);
}
/** Chuyển nhượng Chủ sở hữu: chỉ Owner hiện tại, cho tài khoản khác đang hoạt động */
function checkTransfer(actor, target){
  actor = actor || {}; target = target || {};
  if(actor.role !== "owner") return R(false, "no-perm", "Chỉ Chủ sở hữu mới chuyển nhượng được.");
  if(!target.uid) return R(false, "bad-target", "Không tìm thấy người nhận.");
  if(target.uid === actor.uid) return R(false, "self", "Bạn đã là Chủ sở hữu.");
  if(target.banned) return R(false, "banned", "Người nhận đang bị khoá.");
  return R(true);
}

/* ---- SHA-256 (thuần JS, đồng bộ — dùng cho mã khởi tạo & chuỗi băm audit) ---- */
const SHA_K = (()=>{ const k = []; for(let n = 2; k.length < 64; n++){ let p = true; for(let d = 2; d*d <= n; d++) if(n % d === 0){ p = false; break; } if(p) k.push(Math.floor((Math.cbrt(n) % 1) * 4294967296) >>> 0); } return k; })();
const SHA_H = (()=>{ const h = []; for(let n = 2; h.length < 8; n++){ let p = true; for(let d = 2; d*d <= n; d++) if(n % d === 0){ p = false; break; } if(p) h.push(Math.floor((Math.sqrt(n) % 1) * 4294967296) >>> 0); } return h; })();
function utf8(s){
  s = String(s == null ? "" : s);
  if(typeof TextEncoder !== "undefined") return new TextEncoder().encode(s);
  const b = unescape(encodeURIComponent(s)), out = new Uint8Array(b.length);
  for(let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out;
}
function sha256(str){
  const bytes = utf8(str), l = bytes.length, total = ((l + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total); m.set(bytes); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(total - 4, (l * 8) >>> 0); dv.setUint32(total - 8, Math.floor(l / 536870912));
  const H = SHA_H.slice(), W = new Uint32Array(64), ror = (x, n)=> (x >>> n) | (x << (32 - n));
  for(let i = 0; i < total; i += 64){
    for(let t = 0; t < 16; t++) W[t] = dv.getUint32(i + t * 4);
    for(let t = 16; t < 64; t++){ const a = W[t-15], b = W[t-2]; W[t] = (W[t-16] + (ror(a,7) ^ ror(a,18) ^ (a >>> 3)) + W[t-7] + (ror(b,17) ^ ror(b,19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for(let t = 0; t < 64; t++){
      const t1 = (h + (ror(e,6) ^ ror(e,11) ^ ror(e,25)) + ((e & f) ^ (~e & g)) + SHA_K[t] + W[t]) >>> 0;
      const t2 = ((ror(a,2) ^ ror(a,13) ^ ror(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x=> x.toString(16).padStart(8, "0")).join("");
}
/** JSON ổn định (khoá sắp xếp) — để băm */
function canonical(v){
  if(v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if(Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).filter(k=> v[k] !== undefined).sort().map(k=> JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}
const GENESIS = "GENESIS";
function auditBody(e){ const o = Object.assign({}, e); delete o.hash; return o; }
const auditHash = (prev, e)=> sha256(String(prev || GENESIS) + "|" + canonical(auditBody(e)));
/** Kiểm tra chuỗi băm: {ok, count, brokenAt, reason} */
function verifyChain(list){
  list = Array.isArray(list) ? list : [];
  let prev = GENESIS;
  for(let i = 0; i < list.length; i++){
    const e = list[i] || {};
    if(e.seq !== i + 1) return { ok:false, count:list.length, brokenAt:i, reason:"Số thứ tự bị đứt (bản ghi bị xoá hoặc chèn)" };
    if(e.prev !== prev) return { ok:false, count:list.length, brokenAt:i, reason:"Liên kết với bản ghi trước bị sai" };
    if(auditHash(prev, e) !== e.hash) return { ok:false, count:list.length, brokenAt:i, reason:"Nội dung bản ghi đã bị sửa" };
    prev = e.hash;
  }
  return { ok:true, count:list.length, brokenAt:-1, head: prev };
}
/** Che bớt số tài khoản / email khi ghi audit */
function mask(v, keep){ v = String(v == null ? "" : v); keep = keep == null ? 4 : keep; if(v.length <= keep) return v ? "•".repeat(v.length) : ""; return "•".repeat(Math.min(8, v.length - keep)) + v.slice(-keep); }
function maskEmail(e){ e = String(e || ""); const i = e.indexOf("@"); if(i < 1) return mask(e, 2); return e[0] + "•••" + e.slice(i); }

const core = { PERMS, PERM_IDS, GROUPS, ROLES, ROLE_ORDER, MATRIX, SENSITIVE, STEP_UP, MAX_PX, level, normPx, permsOf, hasPerm, assignable, grantable,
  checkAssign, checkBan, checkTransfer, isRole, sha256, canonical, auditHash, verifyChain, GENESIS, mask, maskEmail };

/* Node (kiểm thử / đồng bộ ma trận với Cloud Functions) — không có DOM thì dừng ở đây */
if(typeof module !== "undefined" && module.exports && typeof document === "undefined"){ module.exports = { core }; return; }

/* ---------------------------------------------------------------------
   4. NGUỒN VAI TRÒ: demo (localStorage) · firebase (custom claims)
   --------------------------------------------------------------------- */
const DEMO_KEY = "tapeasy_admin_demo_v1";
const SESSION_KEY = "tapeasy_admin_session_v1";
const LOCK_KEY = "tapeasy_admin_lock_v1";
const CFG = Object.assign({ idleMin: 30, maxHours: 12, stepUpMin: 5, maxFails: 5, lockMin: 5 }, G.TAPEASY_ADMIN_CONFIG || {});
const now = ()=> Date.now();
const listeners = [];
let _raw = null, _store = null, _claims = null, _claimsP = null, _queue = [];

function cloudOk(){ return typeof cloud !== "undefined" && cloud; }
function cloudUser(){ try{ return cloudOk() ? cloud.user : null; }catch(e){ return null; } }
function mode(){ try{ return cloudOk() && cloud.mode === "firebase" && typeof firebase !== "undefined" && firebase.auth ? "firebase" : "demo"; }catch(e){ return "demo"; } }
function ls(){ try{ return G.localStorage || null; }catch(e){ return null; } }
function ss(){ try{ return G.sessionStorage || null; }catch(e){ return null; } }
function demoStore(){
  const s = ls(); let raw = null; try{ raw = s ? s.getItem(DEMO_KEY) : null; }catch(e){}
  if(raw === _raw && _store) return _store;
  _raw = raw; try{ _store = Object.assign({ roles:{}, bans:{} }, JSON.parse(raw || "{}")); }catch(e){ _store = { roles:{}, bans:{} }; }
  return _store;
}
const banActive = b=> !!b && !b.liftedAt && (!b.until || b.until > now());

async function loadClaims(force){
  const u = cloudUser(); if(!u || mode() !== "firebase") return null;
  try{
    const fu = firebase.auth().currentUser; if(!fu) return null;
    const t = await fu.getIdTokenResult(!!force);
    const c = (t && t.claims) || {};
    _claims = { uid: fu.uid, role: isRole(c.role) ? c.role : null, px: normPx(c.px), authTime: Number(c.auth_time || 0) * 1000 };
  }catch(e){ _claims = _claims && _claims.uid === u.uid ? _claims : null; }
  emit("claims"); return _claims;
}
function current(){
  const u = cloudUser(); if(!u || !u.uid) return null;
  if(mode() === "firebase"){
    if(!_claims || _claims.uid !== u.uid){ if(!_claimsP) _claimsP = loadClaims(false).finally(()=>{ _claimsP = null; }); return null; }
    return _claims.role ? { uid:u.uid, role:_claims.role, px:_claims.px, name:u.name } : null;
  }
  const st = demoStore(), r = st.roles && st.roles[u.uid];
  if(!r || !isRole(r.role)) return null;
  if(banActive(st.bans && st.bans[u.uid])) return null;
  return { uid:u.uid, role:r.role, px:normPx(r.px), name:u.name };
}

/* ---------------------------------------------------------------------
   5. PHIÊN QUẢN TRỊ (sessionStorage: đóng tab là hết · hết hạn khi rảnh 30 phút)
   --------------------------------------------------------------------- */
function readSession(){ try{ const s = ss(); return s ? JSON.parse(s.getItem(SESSION_KEY) || "null") : null; }catch(e){ return null; } }
function writeSession(v){ try{ const s = ss(); if(!s) return; if(v) s.setItem(SESSION_KEY, JSON.stringify(v)); else s.removeItem(SESSION_KEY); }catch(e){} }
function active(){
  const s = readSession(); if(!s) return false;
  const c = current();
  if(!c){ if(mode() === "firebase" && _claimsP && cloudUser() && cloudUser().uid === s.uid) return false; return false; }
  if(s.uid !== c.uid){ endSession("account-changed"); return false; }
  const n = now();
  if(n - (s.last || 0) > CFG.idleMin * 60000 || n - (s.at || 0) > CFG.maxHours * 3600000){ endSession("timeout"); return false; }
  // QS-05: bản Firebase — phiên gắn với auth_time của ID token (máy chủ kiểm ≤ 12 giờ ở rules/Functions);
  //   sửa sessionStorage không "hồi sinh" được phiên khi lần xác thực thật đã quá hạn
  if(mode() === "firebase" && _claims && _claims.uid === c.uid && (!_claims.authTime || n - _claims.authTime > CFG.maxHours * 3600000)){ endSession("timeout"); return false; }
  return true;
}
function touch(){ const s = readSession(); if(s){ s.last = now(); writeSession(s); } }
function endSession(reason){
  const s = readSession(); if(!s) return;
  writeSession(null);
  audit("admin.logout", { type:"user", id:s.uid }, { reason: reason || "manual" });
  emit("session");
}
function lockInfo(){ try{ const v = JSON.parse((ls() && ls().getItem(LOCK_KEY)) || "{}"); return { fails: Number(v.fails)||0, until: Number(v.until)||0 }; }catch(e){ return { fails:0, until:0 }; } }
function setLock(v){ try{ ls() && ls().setItem(LOCK_KEY, JSON.stringify(v)); }catch(e){} }
function lockedFor(){ const l = lockInfo(); return l.until > now() ? Math.ceil((l.until - now()) / 1000) : 0; }
function err(msg, code){ const e = new Error(msg); e.code = code || "rbac/error"; return e; }

/** Xác thực lại mật khẩu của tài khoản đang đăng nhập (demo: đăng nhập lại; firebase: reauthenticate) */
async function reauth(pw){
  const u = cloudUser(); if(!u) throw err("Bạn cần đăng nhập tài khoản trước.", "rbac/auth");
  if(mode() === "firebase"){
    const fu = firebase.auth().currentUser; if(!fu) throw err("Bạn cần đăng nhập tài khoản trước.", "rbac/auth");
    const pid = (fu.providerData[0] && fu.providerData[0].providerId) || "password";
    if(pid === "password") await fu.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(fu.email, String(pw || "")));
    else {
      const prov = pid.startsWith("google") ? new firebase.auth.GoogleAuthProvider() : pid.startsWith("apple") ? new firebase.auth.OAuthProvider("apple.com") : new firebase.auth.FacebookAuthProvider();
      await fu.reauthenticateWithPopup(prov);
    }
    await loadClaims(true);
    return true;
  }
  const social = !!(cloud.profile && cloud.profile.provider && cloud.profile.provider !== "password");
  // QS-16: bản demo — tài khoản Google/Facebook/Apple giả lập KHÔNG có mật khẩu → không được vào phiên quản trị (trước đây bỏ qua xác thực)
  if(social) throw err("Bản demo: bảng quản trị chỉ dùng tài khoản email + mật khẩu (tài khoản Google/Facebook/Apple giả lập không xác thực lại được).", "rbac/password");
  if(!u.email || !pw) throw err("Nhập mật khẩu tài khoản.", "rbac/password");
  try{ await cloud.signIn(u.email, String(pw)); }catch(e){ throw err("Mật khẩu không đúng.", "rbac/password"); }
  return true;
}
async function login(pw){
  const wait = lockedFor();
  if(wait) throw err(`Sai quá nhiều lần. Thử lại sau ${Math.ceil(wait/60)} phút.`, "rbac/locked");
  const u = cloudUser(); if(!u) throw err("Bạn cần đăng nhập tài khoản trước.", "rbac/auth");
  try{ await reauth(pw); }
  catch(e){
    const l = lockInfo(); l.fails++;
    if(l.fails >= CFG.maxFails){ l.until = now() + CFG.lockMin * 60000; l.fails = 0; }
    setLock(l);
    audit("admin.login_failed", { type:"user", id:u.uid, name:u.name }, { reason: e.code || "password" });
    throw e;
  }
  if(mode() === "firebase") await loadClaims(true);
  const c = current();
  if(!c) throw err("Tài khoản này chưa được cấp quyền quản trị. Gửi mã tài khoản (UID) cho Chủ sở hữu để được cấp.", "rbac/no-role");
  setLock({ fails:0, until:0 });
  const t = now();
  writeSession({ uid:c.uid, role:c.role, at:t, last:t, step:t });
  audit("admin.login", { type:"user", id:c.uid, name:c.name }, { role:c.role });
  emit("session");
  return c;
}
async function stepUp(pw){
  if(!active()) throw err("Phiên quản trị đã hết hạn — đăng nhập lại.", "rbac/session");
  await reauth(pw);
  const s = readSession(); s.step = now(); s.last = now(); writeSession(s);
  return true;
}
function needsStepUp(perm){
  if(!STEP_UP.includes(perm)) return false;
  // QS-05: bản Firebase dùng auth_time THẬT của token (máy chủ — setPaymentInfo / transferOwnership — kiểm cùng mốc ≤ 5 phút)
  if(mode() === "firebase") return !_claims || !_claims.authTime || now() - _claims.authTime > CFG.stepUpMin * 60000;
  const s = readSession(); return !s || now() - (s.step || 0) > CFG.stepUpMin * 60000;
}
function logout(){ endSession("manual"); }

/* ---------------------------------------------------------------------
   6. API KIỂM TRA QUYỀN
   --------------------------------------------------------------------- */
function role(){ const c = current(); return c ? c.role : null; }
function can(perm){ ensureAttached(); if(!active()) return false; const c = current(); return !!c && hasPerm(c.role, c.px, perm); }
function canAny(list){ return (Array.isArray(list) ? list : [list]).some(can); }
function myPerms(){ const c = current(); return c && active() ? permsOf(c.role, c.px) : []; }
function label(perm){ return (own(PERMS, perm) && PERMS[perm].label) || perm; }
function say(msg, icon){ try{ if(typeof toast === "function") toast(msg, icon || "lock"); }catch(e){} }
function require_(perm, onDenied){
  if(can(perm)){ touch(); return true; }
  const c = current(), reason = !c ? "no-role" : !active() ? "no-session" : "no-perm";
  if(typeof onDenied === "function"){ try{ onDenied(perm, reason); }catch(e){} return false; }
  if(reason === "no-session" && c && hasPerm(c.role, c.px, perm)){ say("Phiên quản trị đã hết hạn — đăng nhập lại", "lock"); openLogin(); return false; }
  say(`Bạn không có quyền: ${label(perm)}`, "lock");
  return false;
}
function guard(perm, fn, onDenied){ return function(){ if(!require_(perm, onDenied)) return undefined; return fn.apply(this, arguments); }; }
function openLogin(section){
  try{ if(G.TE_ADMIN && typeof G.TE_ADMIN.open === "function"){ G.TE_ADMIN.open(section); return true; } }catch(e){}
  say("Bảng quản trị chưa được cài (thiếu admin.js)", "lock"); return false;
}
function onChange(cb){ if(typeof cb === "function") listeners.push(cb); }
function emit(kind){ syncLegacy(); listeners.slice().forEach(cb=>{ try{ cb(kind); }catch(e){ console.warn("[rbac]", e); } }); }
async function refresh(force){ _raw = null; if(mode() === "firebase") await loadClaims(!!force); emit("refresh"); return current(); }

/** Ghi nhật ký kiểm toán — cloud-admin.js xử lý; nạp sau thì xếp hàng chờ */
function audit(action, target, details){
  const u = cloudUser(), c = current();
  const entry = { action: String(action||""), target: target || null, details: details || null, actor: u ? { uid:u.uid, name:u.name || "", role: c ? c.role : null } : null, ts: now() };
  try{ if(G.cloudAdmin && typeof G.cloudAdmin.appendAudit === "function"){ G.cloudAdmin.appendAudit(entry).catch(()=>{}); return; } }catch(e){}
  _queue.push(entry); if(_queue.length > 50) _queue.shift();
}
function drainAudit(){ const q = _queue; _queue = []; return q; }

/* ---------------------------------------------------------------------
   7. TƯƠNG THÍCH CŨ: state.isAdmin · chạm 7 lần · teCan
   --------------------------------------------------------------------- */
const LEGACY_PERMS = ["events.manage", "challenges.manage", "events.checkin", "gifts.manage", "shop.products", "shop.orders", "orders.view"];
const legacyAdmin = ()=> { try{ return LEGACY_PERMS.some(p=> active() && (current() ? hasPerm(current().role, current().px, p) : false)); }catch(e){ return false; } };

/* (a) Xoá cờ isAdmin cũ trong dữ liệu đã lưu TRƯỚC khi app.js nạp state → không ai còn "admin" nhờ 7 lần chạm cũ */
(function sanitizeStored(){
  try{ const s = ls(); const raw = s && s.getItem("fitkit_state_v1"); if(!raw || raw.indexOf('"isAdmin":true') < 0) return;
    const st = JSON.parse(raw); if(st && st.isAdmin){ st.isAdmin = false; st.legacyAdminSeen = Date.now(); s.setItem("fitkit_state_v1", JSON.stringify(st)); } }catch(e){}
})();

/* (b) state.isAdmin = thuộc tính tính toán (đọc: theo RBAC; ghi true: mở đăng nhập; ghi false: thoát phiên) */
let _attachedTo = null;
function stateObj(){
  /* Chỉ chạm tới biến toàn cục `state` (let trong app.js) SAU khi app.js đã khai báo nó (saveState có mặt) —
     tra cứu sớm một tên chưa khai báo làm bộ đệm tra cứu toàn cục của V8 nhớ "không có" (thấy rõ khi nhiều ngữ cảnh vm). */
  if(typeof G.saveState !== "function") return null;
  try{ return (typeof state !== "undefined" && state && typeof state === "object") ? state : null; }catch(e){ return null; }
}
function ensureAttached(){
  const st = stateObj();
  if(st && _attachedTo !== st){
    try{
      Object.defineProperty(st, "isAdmin", { configurable:true, enumerable:false,   // không lưu vào localStorage
        get(){ return legacyAdmin(); },
        set(v){ if(v){ if(!legacyAdmin()) setTimeout(()=> openLogin(), 0); } else if(active()) endSession("legacy-off"); } });
      _attachedTo = st;
    }catch(e){}
  }
  if(G.teCan !== teCan){ try{ defineTeCan(); }catch(e){} }
  if(typeof G.saveState === "function" && !G.saveState.__rbac){
    const old = G.saveState;
    const wrapped = function(){ ensureAttached(); return old.apply(this, arguments); }; wrapped.__rbac = true;
    try{ G.saveState = wrapped; }catch(e){}
  }
}
function syncLegacy(){ ensureAttached(); }

/* (c) teCan toàn cục — luôn gọi TE_RBAC (đúng hợp đồng app.js: có window.TE_RBAC.can thì dùng nó;
       TE_RBAC bị xoá / lỗi → vẫn dùng lõi RBAC, KHÔNG quay về cờ state.isAdmin người dùng tự đặt) */
function teCan(perm){
  try{ const T = G.TE_RBAC; if(T && typeof T.can === "function" && T.can !== teCan) return !!T.can(perm); }catch(e){}
  return can(perm);
}
teCan.any = canAny; teCan._legacy = null;
function defineTeCan(){
  const prior = Object.getOwnPropertyDescriptor(G, "teCan");
  const priorFn = prior ? (prior.get ? null : prior.value) : null;
  if(typeof priorFn === "function" && priorFn !== teCan) teCan._legacy = priorFn;
  if(!prior || prior.configurable){
    Object.defineProperty(G, "teCan", { configurable:true, enumerable:true, get(){ return teCan; }, set(fn){ if(typeof fn === "function" && fn !== teCan) teCan._legacy = fn; } });
  } else { G.teCan = teCan; }   // khai báo `function teCan` toàn cục (không cấu hình lại được) → ghi đè giá trị
}
defineTeCan();

/* (d) QS-16 / App Store 2.3.1: BỎ lối vào ẨN "chạm 7 lần dòng phiên bản". Lối vào quản trị là mục HIỂN THỊ
       "Bảng quản trị" trong Hồ sơ / menu ☰ (chỉ tài khoản có vai trò — admin.js) và "Thiết lập quản trị lần đầu" khi app chưa có
       Chủ sở hữu. Bộ nghe dưới đây chỉ CHẶN bộ đếm 7 chạm cũ của events.js (không còn bật/mở gì). */
function isVersionLine(el){
  if(!el || !el.closest) return false;
  const p = el.closest("#screen-profile p, #screen-profile small, #screen-profile .small-note"); if(!p) return false;
  const t = (p.textContent || "").trim(); return t.length <= 48 && /\bv\d+\.\d+/i.test(t);
}
function onVersionTap(e){ if(isVersionLine(e.target)){ try{ e.stopImmediatePropagation(); }catch(_){} } }
try{ if(typeof document !== "undefined" && document.addEventListener) document.addEventListener("click", onVersionTap, true); }catch(e){}

/* (e) Gắn vào state + theo dõi đăng nhập/đăng xuất */
function boot(){
  ensureAttached();
  try{ if(cloudOk() && cloud.onAuth) cloud.onAuth(()=>{ _claims = null; _raw = null; if(mode() === "firebase") loadClaims(false); const s = readSession(), u = cloudUser(); if(s && (!u || u.uid !== s.uid)) endSession("signed-out"); emit("auth"); }); }catch(e){}
  try{ if(mode() === "firebase" && firebase.auth) firebase.auth().onIdTokenChanged(()=> loadClaims(false)); }catch(e){}
}
try{ boot(); }catch(e){}
try{ if(typeof document !== "undefined" && document.readyState === "loading") document.addEventListener("DOMContentLoaded", ()=>{ ensureAttached(); emit("ready"); }); }catch(e){}
setTimeout(()=>{ try{ ensureAttached(); }catch(e){} }, 0);
try{ G.addEventListener && G.addEventListener("storage", ev=>{ if(ev && (ev.key === DEMO_KEY)){ _raw = null; emit("storage"); } }); }catch(e){}

/* ---------------------------------------------------------------------
   8. XUẤT API
   --------------------------------------------------------------------- */
const api = G.TE_RBAC = {
  __v: 1, DEMO_KEY, SESSION_KEY, config: CFG,
  roles: ROLES, perms: PERMS, groups: GROUPS, matrix: MATRIX, order: ROLE_ORDER, sensitive: SENSITIVE, core,
  mode, role, current, active, can, canAny, myPerms, label, touch,
  require: require_, guard, needsStepUp, login, logout, stepUp, reauth, lockedFor,
  openLogin, onChange, refresh, audit, drainAudit, ensureAttached, legacyAdmin, LEGACY_PERMS,
  levelOf: level, isRole, roleLabel: r=> (isRole(r) && ROLES[r].label) || "Người dùng",
};
})(typeof window !== "undefined" ? window : globalThis);

/* =========================================================================
   TapEasy — Cloud Functions QUẢN TRỊ & PHÂN QUYỀN (functions/admin.js)
   Export từ functions/index.js (xem docs/INTEGRATION-admin.md §3):
       Object.assign(exports, require("./admin"));      // SAU admin.initializeApp()

   Callable (asia-southeast1):
     bootstrapOwner   { code }                     → tài khoản đầu tiên thành Chủ sở hữu (secret OWNER_BOOTSTRAP_CODE)
     setRole          { uid, role|null, px[], reason } → chỉ Owner / Super Admin (roles.assign), không leo thang
     transferOwnership{ uid, confirm:"CHUYỂN NHƯỢNG", reason } → chỉ Owner, xác thực ≤ 5 phút
     banUser / unbanUser { uid, reason, days }      → Auth disabled + thu hồi refresh token
     adminGetUser     { uid }                       → hồ sơ + email/SĐT (chỉ users.pii, có ghi audit)
     adminListUsers   { q, filter, limit, counts }  → danh sách tối thiểu cho bảng quản trị (rules vẫn cấm list users)
     sendBroadcast    { title, body, audience, link, level, push } → giới hạn 5 / 24 giờ
   Trigger:
     chainAudit       admin_audit/{id} onCreate     → gán seq + prev + hash (SHA-256) — nhật ký chỉ-thêm có chuỗi băm

   Nguồn sự thật về vai trò: Firestore roles/{uid} (chỉ Functions ghi) + custom claims { role, px } để rules đọc nhanh.
   firestore.rules hasPerm() còn so roles/{uid}.role == token.role → hạ quyền có hiệu lực NGAY, không chờ token hết hạn.
   ========================================================================= */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");

const REGION = "asia-southeast1";
const OWNER_BOOTSTRAP_CODE = defineSecret("OWNER_BOOTSTRAP_CODE");
const ROLE_AUTH_SEC = 30 * 60;       // gán vai trò: đăng nhập (xác thực) trong 30 phút gần nhất
const STEP_UP_SEC = 5 * 60;          // chuyển nhượng / tài khoản nhận tiền: xác thực lại trong 5 phút
const SESSION_SEC = 12 * 3600;       // QS-05: thao tác quản trị khác — lần xác thực gần nhất ≤ 12 giờ (= maxHours phiên client)
const BROADCAST_PER_DAY = 5;

/* ---------------------------------------------------------------------
   RBAC — BẢN SAO ĐỒNG BỘ với rbac.js (tests/suites/30-rbac.test.js kiểm tra khớp từng quyền)
   --------------------------------------------------------------------- */
const PERM_DEFS = [
  ["panel.access","Vào bảng quản trị"], ["analytics.view","Xem số liệu"], ["data.export","Xuất CSV"],
  ["users.view","Xem người dùng"], ["users.pii","Xem dữ liệu cá nhân"], ["users.note","Ghi chú người dùng"], ["users.ban","Khoá tài khoản"], ["users.delete","Xoá tài khoản"],
  ["roles.view","Xem đội ngũ"], ["roles.assign","Gán vai trò"], ["owner.transfer","Chuyển nhượng Chủ sở hữu"],
  ["pt.view","Xem hồ sơ PT"], ["pt.verify","Xác minh PT"], ["listings.moderate","Ẩn/hiện niêm yết PT"],
  ["reports.view","Xem báo cáo vi phạm"], ["reports.resolve","Xử lý báo cáo"], ["reviews.moderate","Kiểm duyệt đánh giá"], ["community.moderate","Kiểm duyệt cộng đồng"], ["community.feature","Ghim bài cộng đồng"],
  ["kb.edit","Soạn bài kiến thức"], ["kb.publish","Xuất bản bài kiến thức"],
  ["events.manage","Quản lý sự kiện"], ["events.checkin","Check-in sự kiện"], ["challenges.manage","Quản lý thử thách"], ["gifts.manage","Quản lý quà"],
  ["shop.products","Quản lý sản phẩm"], ["orders.view","Xem đơn hàng"], ["shop.orders","Cập nhật đơn hàng"], ["shop.refund","Hoàn tiền"], ["vouchers.manage","Quản lý voucher"],
  ["support.tickets","Hỗ trợ khách hàng"], ["broadcast.send","Gửi thông báo hệ thống"],
  ["settings.view","Xem cài đặt"], ["settings.edit","Sửa cài đặt"], ["settings.payment","Sửa tài khoản nhận tiền"], ["audit.view","Xem nhật ký kiểm toán"],
];
const PERM_IDS = PERM_DEFS.map(p=> p[0]);
const PERM_LABEL = Object.fromEntries(PERM_DEFS);
const SENSITIVE = ["roles.assign", "owner.transfer", "settings.payment", "users.delete"];
const ALL = PERM_IDS.slice();
const minus = (l, rm)=> l.filter(p=> !rm.includes(p));
const ROLE_DEFS = [
  ["owner", 100, ALL],
  ["super_admin", 90, minus(ALL, ["owner.transfer", "settings.payment"])],
  ["admin", 70, minus(ALL, ["owner.transfer", "settings.payment", "roles.assign", "users.delete"])],
  ["content_manager", 50, ["panel.access", "analytics.view", "users.view", "kb.edit", "kb.publish", "community.moderate", "community.feature", "reports.view", "reports.resolve"]],
  ["event_manager", 50, ["panel.access", "analytics.view", "data.export", "users.view", "events.manage", "events.checkin", "challenges.manage", "gifts.manage"]],
  ["shop_manager", 50, ["panel.access", "analytics.view", "data.export", "users.view", "shop.products", "orders.view", "shop.orders", "shop.refund", "vouchers.manage", "gifts.manage", "settings.view"]],
  ["pt_manager", 50, ["panel.access", "users.view", "pt.view", "pt.verify", "listings.moderate", "reviews.moderate", "reports.view"]],
  ["moderator", 40, ["panel.access", "users.view", "reports.view", "reports.resolve", "reviews.moderate", "community.moderate"]],
  ["support", 40, ["panel.access", "users.view", "users.pii", "users.note", "orders.view", "support.tickets"]],
  ["analyst", 20, ["panel.access", "analytics.view", "data.export", "users.view", "orders.view", "pt.view"]],
];
const ROLES = {};
ROLE_DEFS.forEach(([id, level, perms])=>{ ROLES[id] = { id, level, perms: PERM_IDS.filter(p=> perms.includes(p)) }; });
/** QS-18: tra vai trò bằng thuộc tính RIÊNG (không nhận "__proto__", "constructor", "toString"… từ nguyên mẫu Object) */
const own = (o, k)=> typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
const isRole = r=> own(ROLES, r);
const MATRIX = Object.fromEntries(ROLE_DEFS.map(([id])=> [id, ROLES[id].perms.slice()]));
const MAX_PX = 12;
const level = r=> isRole(r) ? ROLES[r].level : 0;
function normPx(px){ const out = []; (Array.isArray(px) ? px : []).forEach(x=>{ x = String(x || "").trim(); if(/^[+-][a-z]+\.[a-z_]+$/.test(x) && own(PERM_LABEL, x.slice(1)) && !out.includes(x)) out.push(x); }); return out.sort(); }
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
  if(px.some(x=> x[0] === "+" && SENSITIVE.includes(x.slice(1)))) return R(false, "sensitive-extra", "Quyền nhạy cảm chỉ đi kèm vai trò.");
  if(px.some(x=> x === "-panel.access")) return R(false, "bad-px", "Không thể bỏ quyền vào bảng quản trị của một vai trò.");
  if(!subset(permsOf(newRole, px), mine)) return R(false, "escalation", "Không thể cấp quyền mà chính bạn không có.");
  return R(true);
}
function checkBan(actor, target){
  actor = actor || {}; target = target || {};
  if(!hasPerm(actor.role, actor.px, "users.ban")) return R(false, "no-perm", "Bạn không có quyền khoá tài khoản.");
  if(!target.uid) return R(false, "bad-target", "Không tìm thấy người dùng.");
  if(actor.uid && actor.uid === target.uid) return R(false, "self", "Không thể tự khoá tài khoản của mình.");
  if(target.role === "owner") return R(false, "owner-protected", "Không thể khoá Chủ sở hữu.");
  if(target.role && level(target.role) >= level(actor.role)) return R(false, "peer-or-higher", "Không thể khoá người ngang cấp hoặc cấp cao hơn bạn.");
  return R(true);
}
function checkTransfer(actor, target){
  actor = actor || {}; target = target || {};
  if(actor.role !== "owner") return R(false, "no-perm", "Chỉ Chủ sở hữu mới chuyển nhượng được.");
  if(!target.uid) return R(false, "bad-target", "Không tìm thấy người nhận.");
  if(target.uid === actor.uid) return R(false, "self", "Bạn đã là Chủ sở hữu.");
  if(target.banned) return R(false, "banned", "Người nhận đang bị khoá.");
  return R(true);
}
function canonical(v){
  if(v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
  if(Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  return "{" + Object.keys(v).filter(k=> v[k] !== undefined).sort().map(k=> JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
}
const sha256 = s=> crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
const GENESIS = "GENESIS";

/* ---------------------------------------------------------------------
   TIỆN ÍCH MÁY CHỦ
   --------------------------------------------------------------------- */
const db = ()=> admin.firestore();
const serverTs = ()=> admin.firestore.FieldValue.serverTimestamp();
const nowMs = ()=> Date.now();
const str = (s, n)=> String(s == null ? "" : s).trim().slice(0, n || 300);
const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;
function cleanUid(uid){ uid = String(uid || "").trim(); if(!UID_RE.test(uid)) throw new HttpsError("invalid-argument", "Mã tài khoản không hợp lệ."); return uid; }
const tsMs = v=> v && typeof v.toMillis === "function" ? v.toMillis() : (Number(v) || 0);
const banActive = b=> !!b && !b.liftedAt && (!b.until || tsMs(b.until) > nowMs());

function safeEqual(a, b){
  const x = crypto.createHash("sha256").update(String(a)).digest(), y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
/** Người gọi: vai trò lấy từ roles/{uid} (nguồn sự thật), không tin claims cũ */
async function actorOf(request, opts){
  opts = opts || {};
  const a = request.auth;
  if(!a || !a.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const [rs, bs] = await Promise.all([db().collection("roles").doc(a.uid).get(), db().collection("bans").doc(a.uid).get()]);
  if(bs.exists && banActive(bs.data())) throw new HttpsError("permission-denied", "Tài khoản đang bị khoá.");
  const r = rs.exists ? rs.data() : null;
  const role = r && !r.suspended && isRole(r.role) ? r.role : null;      // QS-13: vai trò bị treo (banUser) = không có quyền
  if(opts.recentSec){
    const at = Number(a.token && a.token.auth_time) || 0;
    if(!at || nowMs() / 1000 - at > opts.recentSec) throw new HttpsError("failed-precondition", "Thao tác nhạy cảm — vui lòng nhập lại mật khẩu rồi thử lại.");
  }
  return { uid: a.uid, role, px: normPx(r && r.px), name: (r && r.name) || (a.token && a.token.name) || "" };
}
function need(actor, perm){ if(!actor.role || !hasPerm(actor.role, actor.px, perm)) throw new HttpsError("permission-denied", `Bạn không có quyền: ${PERM_LABEL[perm] || perm}.`); }
async function targetOf(uid){
  let user;
  try{ user = await admin.auth().getUser(uid); }
  catch(e){ throw new HttpsError("not-found", "Không tìm thấy tài khoản."); }
  const [rs, bs, us] = await Promise.all([db().collection("roles").doc(uid).get(), db().collection("bans").doc(uid).get(), db().collection("users").doc(uid).get()]);
  const r = rs.exists ? rs.data() : null;
  return { uid, user, role: r && isRole(r.role) ? r.role : null, px: normPx(r && r.px), suspended: !!(r && r.suspended), banned: !!(user.disabled || (bs.exists && banActive(bs.data()))), ban: bs.exists ? bs.data() : null,
    profile: us.exists ? us.data() : {}, name: (us.exists && us.data().name) || user.displayName || "" };
}
function auditDoc(actor, action, target, details){
  return { actorUid: actor ? actor.uid : null, actorName: actor ? (actor.name || "") : "", actorRole: actor ? (actor.role || null) : null,
    action: str(action, 60), target: target || null, details: details == null ? null : JSON.parse(JSON.stringify(details)), ts: serverTs(), client: "functions" };
}
async function writeAudit(actor, action, target, details){
  try{ await db().collection("admin_audit").add(auditDoc(actor, action, target, details)); }
  catch(e){ logger.error("Không ghi được audit", { action, message: e.message }); }
}
/** Giới hạn tần suất: tối đa max lần / windowSec cho (key) */
async function rateLimit(key, max, windowSec){
  const ref = db().collection("admin_rate").doc(String(key).replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 140));
  await db().runTransaction(async tx=>{
    const s = await tx.get(ref); const d = s.exists ? s.data() : { n:0, start:0 };
    const fresh = !d.start || nowMs() - Number(d.start) > windowSec * 1000;
    const n = fresh ? 1 : Number(d.n || 0) + 1;
    if(n > max) throw new HttpsError("resource-exhausted", "Thao tác quá nhiều lần, vui lòng thử lại sau.");
    tx.set(ref, { n, start: fresh ? nowMs() : d.start });
  });
}
/** Ghi custom claims, giữ các claim khác (≤ 1000 byte theo giới hạn Firebase) */
async function setClaims(uid, role, px){
  const u = await admin.auth().getUser(uid);
  const c = Object.assign({}, u.customClaims || {});
  delete c.role; delete c.px;
  if(role){ c.role = role; if(px && px.length) c.px = px; }
  if(JSON.stringify(c).length > 950) throw new HttpsError("failed-precondition", "Custom claims vượt giới hạn 1000 byte.");
  await admin.auth().setCustomUserClaims(uid, c);
}

/* ---------------------------------------------------------------------
   1. bootstrapOwner — tài khoản đầu tiên trở thành Chủ sở hữu (1 lần duy nhất)
   --------------------------------------------------------------------- */
exports.bootstrapOwner = onCall({ region: REGION, secrets: [OWNER_BOOTSTRAP_CODE], maxInstances: 2, timeoutSeconds: 30 }, async (request)=>{
  const a = request.auth;
  if(!a || !a.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const tok = a.token || {};
  if(tok.firebase && tok.firebase.sign_in_provider === "password" && tok.email_verified !== true)
    throw new HttpsError("failed-precondition", "Xác minh email của tài khoản trước khi nhận quyền Chủ sở hữu.");
  await rateLimit(`${a.uid}_bootstrap`, 5, 3600);
  const secret = String(OWNER_BOOTSTRAP_CODE.value() || "").trim().toUpperCase();
  if(secret.length < 12) throw new HttpsError("failed-precondition", "Máy chủ chưa đặt OWNER_BOOTSTRAP_CODE (tối thiểu 12 ký tự).");
  const code = String(request.data && request.data.code || "").trim().toUpperCase();
  const who = { uid: a.uid, name: tok.name || "", role: null };
  if(!safeEqual(code, secret)){ await writeAudit(who, "owner.bootstrap_failed", { type:"user", id:a.uid }, null); throw new HttpsError("permission-denied", "Mã khởi tạo không đúng."); }
  const metaRef = db().collection("roles_meta").doc("owner");
  await db().runTransaction(async tx=>{
    const m = await tx.get(metaRef);
    // QS-21: Owner cũ đã bị xoá tài khoản (cleanupDeletedUser đánh dấu orphaned) → cho khởi tạo lại bằng mã bí mật
    if(m.exists && !m.data().orphaned) throw new HttpsError("already-exists", "Ứng dụng đã có Chủ sở hữu.");
    tx.set(metaRef, { uid: a.uid, at: serverTs(), prev: m.exists ? (m.data().uid || null) : null, orphaned: false });
    tx.set(db().collection("roles").doc(a.uid), { role:"owner", px:[], by: a.uid, at: serverTs(), name: tok.name || "" });
    tx.create(db().collection("admin_audit").doc(), auditDoc(Object.assign({}, who, { role:"owner" }), "owner.bootstrap", { type:"user", id:a.uid, name: tok.name || "" }, { role:"owner" }));
  });
  await setClaims(a.uid, "owner", []);
  logger.info("Đã khởi tạo Chủ sở hữu", { uid: a.uid });
  return { ok:true, role:"owner" };
});

/* ---------------------------------------------------------------------
   2. setRole — gán / thu hồi vai trò (chỉ Owner / Super Admin)
   --------------------------------------------------------------------- */
exports.setRole = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 30 }, async (request)=>{
  const actor = await actorOf(request, { recentSec: ROLE_AUTH_SEC });
  need(actor, "roles.assign");
  const d = request.data || {};
  const uid = cleanUid(d.uid);
  const role = d.role == null || d.role === "" ? null : String(d.role);
  const px = Array.isArray(d.px) ? d.px.map(String) : [];
  const reason = str(d.reason, 300);
  await rateLimit(`${actor.uid}_setRole`, 30, 3600);
  const target = await targetOf(uid);
  const chk = checkAssign(actor, target, role, px);
  if(!chk.ok){
    await writeAudit(actor, "role.denied", { type:"user", id:uid, name: target.name }, { want: role, code: chk.code });
    throw new HttpsError("permission-denied", chk.msg, { code: chk.code });
  }
  const npx = role ? normPx(px) : [];
  const ref = db().collection("roles").doc(uid);
  await db().runTransaction(async tx=>{
    const cur = await tx.get(ref);
    const curRole = cur.exists && isRole(cur.data().role) ? cur.data().role : null;
    if(curRole !== target.role) throw new HttpsError("aborted", "Vai trò vừa bị người khác thay đổi — tải lại rồi thử lại.");
    if(role) tx.set(ref, { role, px: npx, by: actor.uid, at: serverTs(), name: target.name });
    else tx.delete(ref);
    tx.create(db().collection("admin_audit").doc(), auditDoc(actor, role ? "role.assign" : "role.revoke", { type:"user", id:uid, name: target.name },
      { before: target.role ? { role: target.role, px: target.px } : null, after: role ? { role, px: npx } : null, reason }));
  });
  await setClaims(uid, role, npx);
  return { ok:true, uid, role, px: npx };
});

/* ---------------------------------------------------------------------
   3. transferOwnership — chỉ Owner hiện tại; Owner cũ → Super Admin
   --------------------------------------------------------------------- */
exports.transferOwnership = onCall({ region: REGION, maxInstances: 2, timeoutSeconds: 30 }, async (request)=>{
  const actor = await actorOf(request, { recentSec: STEP_UP_SEC });
  const d = request.data || {};
  if(str(d.confirm, 40).toUpperCase() !== "CHUYỂN NHƯỢNG") throw new HttpsError("invalid-argument", "Gõ đúng cụm từ CHUYỂN NHƯỢNG để xác nhận.");
  const uid = cleanUid(d.uid);
  const target = await targetOf(uid);
  const chk = checkTransfer(actor, target);
  if(!chk.ok) throw new HttpsError("permission-denied", chk.msg, { code: chk.code });
  const prov = (target.user.providerData || []).map(p=> p.providerId);
  if(prov.includes("password") && prov.length === 1 && !target.user.emailVerified) throw new HttpsError("failed-precondition", "Người nhận cần xác minh email trước.");
  const metaRef = db().collection("roles_meta").doc("owner");
  await db().runTransaction(async tx=>{
    const m = await tx.get(metaRef);
    if(!m.exists || m.data().uid !== actor.uid) throw new HttpsError("permission-denied", "Bạn không phải Chủ sở hữu hiện tại.");
    tx.set(metaRef, { uid, at: serverTs(), prev: actor.uid });
    tx.set(db().collection("roles").doc(uid), { role:"owner", px:[], by: actor.uid, at: serverTs(), name: target.name });
    tx.set(db().collection("roles").doc(actor.uid), { role:"super_admin", px:[], by: actor.uid, at: serverTs(), name: actor.name });
    tx.create(db().collection("admin_audit").doc(), auditDoc(actor, "owner.transfer", { type:"user", id:uid, name: target.name },
      { from: actor.uid, to: uid, targetBefore: target.role, fromAfter: "super_admin", reason: str(d.reason, 300) }));
  });
  await setClaims(uid, "owner", []);
  await setClaims(actor.uid, "super_admin", []);
  logger.warn("Đã chuyển nhượng Chủ sở hữu", { from: actor.uid, to: uid });
  return { ok:true, owner: uid };
});

/* ---------------------------------------------------------------------
   4. banUser / unbanUser
   --------------------------------------------------------------------- */
exports.banUser = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 30 }, async (request)=>{
  const actor = await actorOf(request, { recentSec: SESSION_SEC });
  need(actor, "users.ban");
  const d = request.data || {};
  const uid = cleanUid(d.uid), reason = str(d.reason, 300);
  if(reason.length < 4) throw new HttpsError("invalid-argument", "Nhập lý do khoá (tối thiểu 4 ký tự).");
  const days = Math.max(0, Math.min(3650, Math.round(Number(d.days) || 0)));
  const target = await targetOf(uid);
  const chk = checkBan(actor, target);
  if(!chk.ok) throw new HttpsError("permission-denied", chk.msg, { code: chk.code });
  await rateLimit(`${actor.uid}_ban`, 60, 3600);
  await admin.auth().updateUser(uid, { disabled: true });
  await admin.auth().revokeRefreshTokens(uid);
  await db().collection("bans").doc(uid).set({ by: actor.uid, at: serverTs(), reason, until: days ? admin.firestore.Timestamp.fromMillis(nowMs() + days * 86400000) : 0, liftedAt: null });
  /* QS-13: nhân sự bị khoá → TREO vai trò ngay (rules staffFresh() đòi suspended == false) + gỡ claims;
     giữ role/px trong roles/{uid} để unbanUser khôi phục đúng như cũ. */
  if(target.role){
    await db().collection("roles").doc(uid).set({ suspended: true, suspendedAt: serverTs(), suspendedBy: actor.uid }, { merge: true });
    await setClaims(uid, null);
  }
  await writeAudit(actor, "user.ban", { type:"user", id:uid, name: target.name }, { reason, days: days || "vĩnh viễn", roleSuspended: target.role || null });
  return { ok:true, uid, banned:true, roleSuspended: !!target.role };
});
exports.unbanUser = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 30 }, async (request)=>{
  const actor = await actorOf(request, { recentSec: SESSION_SEC });
  need(actor, "users.ban");
  const d = request.data || {};
  const uid = cleanUid(d.uid);
  const target = await targetOf(uid);
  const chk = checkBan(actor, target);
  if(!chk.ok) throw new HttpsError("permission-denied", chk.msg, { code: chk.code });
  await admin.auth().updateUser(uid, { disabled: false });
  await db().collection("bans").doc(uid).set({ liftedAt: serverTs(), liftedBy: actor.uid }, { merge: true });
  if(target.role && target.suspended){                                     // khôi phục vai trò đã treo khi khoá
    await db().collection("roles").doc(uid).set({ suspended: false, restoredAt: serverTs(), restoredBy: actor.uid }, { merge: true });
    await setClaims(uid, target.role, target.px);
  }
  await writeAudit(actor, "user.unban", { type:"user", id:uid, name: target.name }, { reason: str(d.reason, 300) });
  return { ok:true, uid, banned:false };
});

/* ---------------------------------------------------------------------
   5. adminGetUser — email / SĐT chỉ khi có users.pii (mỗi lần xem đều ghi audit)
   --------------------------------------------------------------------- */
exports.adminGetUser = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 20 }, async (request)=>{
  const actor = await actorOf(request, { recentSec: SESSION_SEC });
  need(actor, "users.view");
  const uid = cleanUid((request.data || {}).uid);
  const t = await targetOf(uid);
  const pii = hasPerm(actor.role, actor.px, "users.pii"), seeRoles = hasPerm(actor.role, actor.px, "roles.view");
  const p = t.profile || {};
  const out = { uid, name: t.name, createdAt: tsMs(p.createdAt) || Date.parse(t.user.metadata && t.user.metadata.creationTime) || 0,
    lastSignIn: Date.parse(t.user.metadata && t.user.metadata.lastSignInTime) || 0, provider: ((t.user.providerData || [])[0] || {}).providerId || "password",
    isPT: !!p.isPT, ptStatus: p.ptVerified ? "verified" : (p.isPT ? "none" : null), listingHidden: !!p.listingHidden,
    role: seeRoles ? t.role : (t.role ? "?" : null), px: seeRoles ? t.px : [], banned: t.banned, ban: t.ban ? { reason: t.ban.reason || "", until: tsMs(t.ban.until) } : null };
  if(pii){
    Object.assign(out, { email: t.user.email || "", phone: t.user.phoneNumber || "", emailVerified: !!t.user.emailVerified });
    await writeAudit(actor, "user.pii_view", { type:"user", id:uid, name: t.name }, null);
  } else {
    const e = t.user.email || ""; const i = e.indexOf("@");
    out.email = e ? (i > 0 ? e[0] + "•••" + e.slice(i) : "•••") : "";
  }
  return out;
});

/* ---------------------------------------------------------------------
   5b. adminListUsers — danh sách / tìm người dùng cho bảng quản trị.
       firestore.rules vẫn CẤM list users từ client (BUG-03) → chỉ đi qua hàm này, trả trường tối thiểu.
   --------------------------------------------------------------------- */
exports.adminListUsers = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 30, memory: "256MiB" }, async (request)=>{
  const actor = await actorOf(request, { recentSec: SESSION_SEC });
  need(actor, "users.view");
  const d = request.data || {};
  const limit = Math.max(0, Math.min(500, Math.round(Number(d.limit == null ? 300 : d.limit) || 0)));
  const filter = ["all", "pt", "staff", "banned"].includes(d.filter) ? d.filter : "all";
  const qText = str(d.q, 80).toLowerCase();
  const pii = hasPerm(actor.role, actor.px, "users.pii"), seeRoles = hasPerm(actor.role, actor.px, "roles.view");
  const [rolesSnap, bansSnap] = await Promise.all([db().collection("roles").get(), db().collection("bans").get()]);
  const roleOf = {}, banOf = {};
  rolesSnap.docs.forEach(x=>{ const r = x.data(); if(isRole(r.role)) roleOf[x.id] = r; });
  bansSnap.docs.forEach(x=>{ if(banActive(x.data())) banOf[x.id] = x.data(); });
  let docs = [];
  if(filter === "staff" || filter === "banned"){
    const ids = Object.keys(filter === "staff" ? roleOf : banOf).slice(0, 300);
    docs = ids.length ? await db().getAll(...ids.map(id=> db().collection("users").doc(id))) : [];
    docs = docs.filter(x=> x.exists);
  } else if(limit){
    let q = db().collection("users");
    if(filter === "pt") q = q.where("isPT", "==", true);
    docs = (await q.orderBy("createdAt", "desc").limit(limit).get()).docs;
  }
  let users = docs.map(x=>{ const u = x.data() || {}, r = roleOf[x.id];
    return { uid: x.id, name: u.name || "", isPT: !!u.isPT, brandName: u.brandName || "", createdAt: tsMs(u.createdAt), provider: u.provider || "password",
      ptStatus: u.ptVerified ? "verified" : (u.isPT ? "none" : null), listingHidden: !!u.listingHidden,
      role: r ? (seeRoles ? r.role : "?") : null, px: r && seeRoles ? normPx(r.px) : [], banned: !!banOf[x.id], email: "" }; });
  if(users.length){
    const byUid = {};
    for(let i = 0; i < users.length; i += 100){
      const res = await admin.auth().getUsers(users.slice(i, i + 100).map(u=> ({ uid: u.uid })));
      (res.users || []).forEach(a=>{ byUid[a.uid] = a; });
    }
    users.forEach(u=>{ const a = byUid[u.uid]; const e = a && a.email || ""; const k = e.indexOf("@");
      u.email = pii ? e : (e ? (k > 0 ? e[0] + "•••" + e.slice(k) : "•••") : ""); if(a && a.disabled) u.banned = true; });
  }
  if(qText) users = users.filter(u=> u.name.toLowerCase().includes(qText) || u.uid.toLowerCase() === qText || u.brandName.toLowerCase().includes(qText) || (pii && u.email.toLowerCase().includes(qText)));
  const out = { users };
  if(d.counts){
    try{ out.total = (await db().collection("users").count().get()).data().count; out.pts = (await db().collection("users").where("isPT", "==", true).count().get()).data().count; }
    catch(e){ out.total = null; out.pts = null; }
    out.staff = Object.keys(roleOf).length; out.banned = Object.keys(banOf).length;
  }
  if(pii && users.length) await writeAudit(actor, "user.pii_list", { type:"users", id: filter }, { count: users.length, q: qText ? "(có tìm)" : "" });
  return out;
});

/* ---------------------------------------------------------------------
   6. sendBroadcast — thông báo toàn hệ thống (≤ 5 / 24 giờ) + FCM topic (tuỳ chọn)
   --------------------------------------------------------------------- */
exports.sendBroadcast = onCall({ region: REGION, maxInstances: 2, timeoutSeconds: 30 }, async (request)=>{
  const actor = await actorOf(request, { recentSec: SESSION_SEC });
  need(actor, "broadcast.send");
  const d = request.data || {};
  const b = { title: str(d.title, 60), body: str(d.body, 300), audience: ["all","pt","member","staff"].includes(d.audience) ? d.audience : "all",
    link: ["", "events", "shop", "community", "findpt", "kb"].includes(d.link || "") ? (d.link || "") : "", level: d.level === "important" ? "important" : "info" };
  if(b.title.length < 4 || b.body.length < 10) throw new HttpsError("invalid-argument", "Tiêu đề ≥ 4 ký tự, nội dung ≥ 10 ký tự.");
  await rateLimit("global_broadcast", BROADCAST_PER_DAY, 86400);
  const ref = db().collection("broadcasts").doc();
  await ref.set(Object.assign({}, b, { by: actor.uid, byName: actor.name, ts: serverTs(), retracted: false }));
  let pushed = false;
  if(d.push){
    try{ await admin.messaging().send({ topic: b.audience === "all" ? "all" : "aud_" + b.audience, notification: { title: b.title, body: b.body }, data: { kind:"broadcast", id: ref.id, link: b.link } }); pushed = true; }
    catch(e){ logger.warn("Gửi FCM thất bại (bỏ qua)", { message: e.message }); }
  }
  await writeAudit(actor, "broadcast.send", { type:"broadcast", id: ref.id, name: b.title }, { audience: b.audience, level: b.level, pushed });
  return { ok:true, id: ref.id, pushed };
});

/* ---------------------------------------------------------------------
   6b. setPaymentInfo — QS-05: tài khoản nhận tiền chỉ đổi ở MÁY CHỦ: Owner (settings.payment) + xác thực lại ≤ 5 phút,
       ghi audit trong cùng transaction, báo Owner qua email (collection "mail" — tiện ích Trigger Email nếu đã cài).
       firestore.rules cấm client ghi settings/public.bank.
   --------------------------------------------------------------------- */
function cleanBank(b){
  b = b && typeof b === "object" ? b : {};
  const nb = { bankName: str(b.bankName, 60), bankBin: str(b.bankBin, 6).replace(/\D/g, ""), accountNo: str(b.accountNo, 19).replace(/\s/g, ""),
    accountName: str(b.accountName, 60).toUpperCase(), branch: str(b.branch, 80) };
  const errs = [];
  if(nb.bankBin && !/^\d{6}$/.test(nb.bankBin)) errs.push("Mã BIN ngân hàng gồm 6 chữ số (VD Vietcombank 970436).");
  if(nb.accountNo && !/^\d{6,19}$/.test(nb.accountNo)) errs.push("Số tài khoản chỉ gồm 6–19 chữ số.");
  if(nb.accountName && !/^[A-Z0-9 .\-]{3,60}$/.test(nb.accountName)) errs.push("Tên chủ tài khoản viết IN HOA KHÔNG DẤU (như trên thẻ).");
  if(errs.length) throw new HttpsError("invalid-argument", errs.join(" "));
  return nb;
}
const maskNo = v=>{ v = String(v || ""); return v.length <= 4 ? v : "•".repeat(Math.min(8, v.length - 4)) + v.slice(-4); };
const maskBank = b=> b ? { bankName: b.bankName || "", bankBin: b.bankBin || "", accountNo: maskNo(b.accountNo), accountName: b.accountName || "" } : null;
async function notifyOwner(subject, text){
  try{
    const m = await db().collection("roles_meta").doc("owner").get(); if(!m.exists) return false;
    const u = await admin.auth().getUser(m.data().uid); if(!u || !u.email) return false;
    await db().collection("mail").add({ to: u.email, message: { subject: str(subject, 120), text: str(text, 2000) }, at: serverTs() });
    return true;
  }catch(e){ logger.warn("Không gửi được thư báo Owner", { message: e.message }); return false; }
}
exports.setPaymentInfo = onCall({ region: REGION, maxInstances: 2, timeoutSeconds: 30 }, async (request)=>{
  const actor = await actorOf(request, { recentSec: STEP_UP_SEC });
  need(actor, "settings.payment");
  const nb = cleanBank((request.data || {}).bank);
  await rateLimit(`${actor.uid}_payment`, 10, 86400);
  const ref = db().collection("settings").doc("public");
  let before = null;
  await db().runTransaction(async tx=>{
    const cur = await tx.get(ref); before = cur.exists ? (cur.data().bank || null) : null;
    tx.set(ref, { bank: nb, updatedAt: nowMs(), updatedBy: actor.uid, bankUpdatedAt: nowMs(), bankUpdatedBy: actor.uid }, { merge: true });
    tx.create(db().collection("admin_audit").doc(), auditDoc(actor, "settings.payment", { type:"settings", id:"public" }, { before: maskBank(before), after: maskBank(nb) }));
  });
  await notifyOwner("TapEasy: tài khoản nhận tiền vừa thay đổi",
    `${actor.name || actor.uid} vừa đổi tài khoản nhận tiền thành ${nb.bankName} · ${maskNo(nb.accountNo)} · ${nb.accountName}. Nếu không phải bạn, hãy khoá tài khoản này và đổi lại ngay.`);
  return { ok:true, bank: nb };
});

/* ---------------------------------------------------------------------
   6c. logAdminAction — QS-15: client KHÔNG ghi thẳng admin_audit (rules create: false). Nhân sự gửi hành động đã làm,
       máy chủ lấy người làm / vai trò từ roles/{uid} (không tin dữ liệu gửi lên), chỉ nhận hành động thuộc quyền của vai trò.
       Hành động nhạy cảm (role.*, owner.*, user.ban/unban, user.pii_*, settings.payment, broadcast.send) do chính callable ghi.
   --------------------------------------------------------------------- */
const CLIENT_AUDIT = [
  [/^admin\.(login|logout|login_failed)$/, []], [/^access\.denied$/, []],
  [/^data\.export(\.[a-z_]+)?$/, ["data.export"]], [/^user\.note$/, ["users.note"]],
  [/^pt\.(verify|reject)$/, ["pt.verify"]], [/^listing\.(hide|show)$/, ["listings.moderate"]],
  [/^mod\.[a-z_]+\.(keep|hide|delete|restore)$/, ["community.moderate", "reviews.moderate", "reports.resolve"]],
  [/^community\.(feature|unfeature)$/, ["community.feature"]], [/^ticket\.(reply|close)$/, ["support.tickets"]],
  [/^broadcast\.retract$/, ["broadcast.send"]], [/^settings\.update$/, ["settings.edit"]],
  [/^voucher\.(save|revoke)$/, ["vouchers.manage"]], [/^challenge\.(save|delete|settle|award)$/, ["challenges.manage"]],
  [/^event\.(save|delete)$/, ["events.manage"]], [/^event\.checkin$/, ["events.checkin", "events.manage"]],
  [/^product\.(save|delete)$/, ["shop.products"]], [/^order\.update$/, ["shop.orders"]], [/^gift\.(create|update)$/, ["gifts.manage"]],
  [/^kb\.[a-z_]+$/, ["kb.edit", "kb.publish"]],
];
/** null = hợp lệ; chuỗi = lý do từ chối */
function auditAllowed(actor, action){
  if(!actor || !actor.role) return "Không phải nhân sự.";
  action = String(action || "");
  if(action.length > 60) return "Tên hành động quá dài.";
  const hit = CLIENT_AUDIT.find(([re])=> re.test(action));
  if(!hit) return "Hành động này chỉ máy chủ được ghi.";
  if(hit[1].length && !hit[1].some(p=> hasPerm(actor.role, actor.px, p))) return "Vai trò không có quyền tương ứng.";
  return null;
}
function cleanTarget(t){ if(!t || typeof t !== "object") return null; return { type: str(t.type, 30), id: str(t.id, 128), name: str(t.name, 120) }; }
function cleanDetails(x){
  if(x == null) return null;
  let s; try{ s = JSON.stringify(x); }catch(e){ return { note:"(không ghi được chi tiết)" }; }
  if(s.length > 4000) return { note:"(chi tiết quá dài — đã cắt)", head: s.slice(0, 3000) };
  return JSON.parse(s);
}
exports.logAdminAction = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 20 }, async (request)=>{
  const actor = await actorOf(request);
  const d = request.data || {};
  const why = auditAllowed(actor, d.action);
  if(why) throw new HttpsError("permission-denied", why);
  await rateLimit(`${actor.uid}_audit`, 300, 3600);
  const ref = await db().collection("admin_audit").add(Object.assign(auditDoc(actor, d.action, cleanTarget(d.target), cleanDetails(d.details)), { client: "web", via: "logAdminAction" }));
  return { ok:true, id: ref.id };
});

/* ---------------------------------------------------------------------
   6d. verifyAudit — QS-15: kiểm toàn chuỗi ở máy chủ: tính lại SHA-256 từng bản ghi (đúng công thức chainOne),
       so seq/prev liên tục, so bản cuối với admin_audit_meta/head (phát hiện CẮT ĐUÔI), đọc theo trang (không giới hạn 2 000).
   --------------------------------------------------------------------- */
function auditBodyOf(d){ return { seq: d.seq, prev: d.prev, actorUid: d.actorUid || null, actorRole: d.actorRole || null, action: d.action || "", target: d.target || null, details: d.details || null, ts: tsMs(d.ts) }; }
function verifyChainDocs(list, head){
  list = Array.isArray(list) ? list : [];
  let prev = GENESIS;
  for(let i = 0; i < list.length; i++){
    const d = list[i] || {};
    if(d.seq !== i + 1) return { ok:false, count:list.length, brokenAt:i, reason:"Số thứ tự bị đứt (bản ghi bị xoá hoặc chèn)" };
    if(d.prev !== prev) return { ok:false, count:list.length, brokenAt:i, reason:"Liên kết với bản ghi trước bị sai" };
    if(sha256(prev + "|" + canonical(auditBodyOf(d))) !== d.hash) return { ok:false, count:list.length, brokenAt:i, reason:"Nội dung bản ghi đã bị sửa" };
    prev = d.hash;
  }
  if(head && (Number(head.seq || 0) !== list.length || (list.length && head.hash !== prev)))
    return { ok:false, count:list.length, brokenAt:list.length, reason:"Đầu chuỗi (admin_audit_meta/head) không khớp bản ghi cuối — có thể đã bị cắt đuôi" };
  return { ok:true, count:list.length, brokenAt:-1, head: prev };
}
exports.verifyAudit = onCall({ region: REGION, maxInstances: 2, timeoutSeconds: 120, memory: "512MiB" }, async (request)=>{
  const actor = await actorOf(request, { recentSec: SESSION_SEC });
  need(actor, "audit.view");
  const all = []; let last = 0;
  for(let page = 0; page < 500; page++){
    const snap = await db().collection("admin_audit").where("seq", ">", last).orderBy("seq", "asc").limit(1000).get();
    if(!snap.docs.length) break;
    snap.docs.forEach(x=> all.push(x.data())); last = all[all.length - 1].seq;
    if(snap.docs.length < 1000) break;
  }
  const h = await db().collection("admin_audit_meta").doc("head").get();
  const res = verifyChainDocs(all, h.exists ? h.data() : { seq: 0, hash: GENESIS });
  return Object.assign(res, { note: "Máy chủ tính lại SHA-256 từng bản ghi và so đầu chuỗi." });
});

/* ---------------------------------------------------------------------
   6e. ownerStatus — QS-16: lối vào "thiết lập quản trị lần đầu" chỉ hiện khi app CHƯA có Chủ sở hữu (không cần 7 lần chạm ẩn)
   --------------------------------------------------------------------- */
exports.ownerStatus = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 10 }, async (request)=>{
  if(!request.auth || !request.auth.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const m = await db().collection("roles_meta").doc("owner").get();
  return { hasOwner: m.exists && !m.data().orphaned };
});

/* ---------------------------------------------------------------------
   7. chainAudit — gán seq / prev / hash cho mỗi bản ghi mới (chỉ-thêm, phát hiện sửa/xoá)
   --------------------------------------------------------------------- */
async function chainOne(ref){
  const headRef = db().collection("admin_audit_meta").doc("head");
  return db().runTransaction(async tx=>{
    const [cur, h] = await Promise.all([tx.get(ref), tx.get(headRef)]);
    if(!cur.exists) return null;
    const d = cur.data();
    if(d.seq) return d.seq;                                   // đã xích (trigger chạy lại)
    const head = h.exists ? h.data() : { seq: 0, hash: GENESIS };
    const seq = Number(head.seq || 0) + 1, prev = head.hash || GENESIS;
    const body = { seq, prev, actorUid: d.actorUid || null, actorRole: d.actorRole || null, action: d.action || "", target: d.target || null, details: d.details || null, ts: tsMs(d.ts) };
    const hash = sha256(prev + "|" + canonical(body));
    let suspicious = false;
    if(d.client !== "functions" && d.actorUid){
      const rs = await tx.get(db().collection("roles").doc(d.actorUid));
      suspicious = !rs.exists || rs.data().role !== d.actorRole;           // bản ghi do client gửi nhưng vai trò không khớp
    }
    tx.update(ref, Object.assign({ seq, prev, hash, chainedAt: serverTs() }, suspicious ? { suspicious: true } : {}));
    tx.set(headRef, { seq, hash, at: serverTs() });
    return seq;
  });
}
exports.chainAudit = onDocumentCreated({ document: "admin_audit/{id}", region: REGION, maxInstances: 1 }, async (event)=>{
  const snap = event.data; if(!snap) return;
  try{ await chainOne(snap.ref); }catch(e){ logger.error("chainAudit lỗi", { id: snap.id, message: e.message }); throw e; }
});

exports._adminTest = { PERM_IDS, ROLES, MATRIX, SENSITIVE, permsOf, hasPerm, normPx, checkAssign, checkBan, checkTransfer, canonical, sha256, actorOf, targetOf, rateLimit, chainOne, GENESIS,
  isRole, need, writeAudit, auditDoc, setClaims, cleanBank, maskBank, auditAllowed, verifyChainDocs, auditBodyOf, notifyOwner, SESSION_SEC, STEP_UP_SEC, REGION };

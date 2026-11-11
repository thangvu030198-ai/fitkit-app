/* =========================================================================
   TapEasy — Cloud Functions PT ↔ HỌC VIÊN (functions/social.js) · vòng sửa bảo mật 11/2026
   Callable:
     joinByCode        { code } | { clientId }  → học viên TỰ nhập mã (6–10 ký tự) hoặc chấp nhận lời mời theo email ĐÃ XÁC MINH;
                                                  giới hạn 10 lần / giờ / tài khoản (chống dò mã — QS-14); PT không gắn hộ (QS-02)
     claimReviewRights { lid }                  → xét lại quyền viết đánh giá PT (dữ liệu cũ trước khi có trigger)
   Trigger:
     syncPtLinks       clients/{cid}            → ptLinks/{ptId}_{studentUid} (rules: học viên đọc SĐT riêng của PT — QS-17)
     sessionAgg        clients/{cid}/sessions/{sid} → quyền đánh giá (≥ 2 buổi PT xác nhận + ≥ 7 ngày từ khi tự kết nối — QS-07/QP-12)
                                                  + số liệu "đã dạy" có xác minh trên niêm yết (statsVerified — QP-08)
     trialRights       ptListings/{lid}/requests/{qid} → buổi thử "done" sau ≥ 24 giờ, tài khoản ≥ 7 ngày tuổi → quyền đánh giá
     phoneToPrivate    users/{uid}              → chuyển SĐT còn sót trong hồ sơ công khai sang users/{uid}/private/contact (QS-17)
   Callable quản trị: migrateLegacyPhones {} (Owner/Super Admin, chạy 1 lần sau deploy) — dọn SĐT cũ của MỌI hồ sơ
   ========================================================================= */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const A = require("./admin")._adminTest;

const REGION = "asia-southeast1";
const DAY = 864e5, RIGHTS_DAYS = 365, MIN_LINK_DAYS = 7, MIN_PT_SESSIONS = 2;
const db = ()=> admin.firestore();
const nowMs = ()=> Date.now();
const str = (s, n)=> String(s == null ? "" : s).trim().slice(0, n || 300);
const obj = o=> (o && typeof o === "object" && !Array.isArray(o)) ? o : {};
const tsMs = v=> v && typeof v.toMillis === "function" ? v.toMillis() : (Number(v) || 0);
const normCode = raw=> String(raw || "").trim().toUpperCase().replace(/^.*[?&#]join=/i, "").replace(/[^A-Z0-9]/g, "");

/* ---------------- joinByCode ---------------- */
/** Thuần: học viên có được liên kết vào form không? → null hoặc lỗi { code, msg } */
function linkProblem(client, uid){
  if(!client) return { code: "not-found", msg: "Mã không đúng hoặc đã bị xoá. Hỏi lại PT của bạn nhé." };
  if(client.ptId === uid) return { code: "failed-precondition", msg: "Đây là mã do chính bạn tạo cho học viên." };
  if(client.studentUid && client.studentUid !== uid) return { code: "already-exists", msg: "Mã này đã có học viên dùng. Nhờ PT tạo mã mới cho bạn nhé." };
  return null;
}
exports.joinByCode = onCall({ region: REGION, maxInstances: 10, timeoutSeconds: 20 }, async (request)=>{
  const a = request.auth; if(!a || !a.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  const uid = a.uid, tok = a.token || {};
  const bs = await db().collection("bans").doc(uid).get();
  if(bs.exists && !bs.data().liftedAt) throw new HttpsError("permission-denied", "Tài khoản đang bị khoá.");
  await A.rateLimit(`${uid}_join`, 10, 3600);
  const d = obj(request.data);
  let clientId = "", via = "code";
  if(d.code != null){
    const code = normCode(d.code);
    if(code.length < 6 || code.length > 10) throw new HttpsError("invalid-argument", "Mã gồm 6–10 ký tự chữ và số, ví dụ: K7M2QXAB.");
    const jc = await db().collection("joinCodes").doc(code).get();
    if(!jc.exists){ logger.info("joinByCode: mã sai", { uid }); throw new HttpsError("not-found", "Mã không đúng hoặc đã bị xoá. Hỏi lại PT của bạn nhé."); }
    clientId = String(jc.data().clientId || "");
  } else {
    // lời mời theo email: CHỈ email đã xác minh (QS-14 — chặn tài khoản chưa xác minh trùng email nạn nhân)
    clientId = str(d.clientId, 128); via = "invite";
    const email = tok.email_verified === true && tok.email ? String(tok.email).toLowerCase() : "";
    if(!email) throw new HttpsError("failed-precondition", "Xác minh email của tài khoản trước khi nhận lời mời.");
    const inv = await db().collection("invites").where("clientId", "==", clientId).where("email", "==", email).where("status", "==", "pending").limit(1).get();
    if(!inv.docs.length) throw new HttpsError("permission-denied", "Lời mời không còn hiệu lực hoặc gửi cho email khác.");
  }
  const uSnap = await db().collection("users").doc(uid).get();
  const name = str((uSnap.exists && uSnap.data().name) || tok.name || (tok.email ? String(tok.email).split("@")[0] : "Học viên"), 80);
  const ref = db().collection("clients").doc(clientId);
  const out = await db().runTransaction(async tx=>{
    const s = await tx.get(ref); const c = s.exists ? s.data() : null;
    const p = linkProblem(c, uid); if(p) throw new HttpsError(p.code, p.msg);
    if(c.studentUid === uid) return Object.assign({ id: clientId, already: true }, c);
    const patch = { studentUid: uid, studentName: name, studentEmail: tok.email ? String(tok.email).toLowerCase() : null, joinedAt: nowMs(), linkedVia: via, updatedAt: nowMs() };
    tx.update(ref, patch);
    tx.set(ref.collection("messages").doc(), { from: "system", role: "system", kind: "system", text: via === "code" ? `${name} đã kết nối bằng mã mời.` : `${name} đã chấp nhận lời mời tập cùng.`, ts: nowMs() });
    return Object.assign({ id: clientId }, c, patch);
  });
  return out;
});

/* ---------------- ptLinks (SĐT riêng của PT chỉ học viên đang kết nối đọc) ---------------- */
exports.syncPtLinks = onDocumentWritten({ document: "clients/{cid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const b = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : {};
  const af = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : {};
  const key = c=> c.ptId && c.studentUid ? `${c.ptId}_${c.studentUid}` : "";
  const kb = key(b), ka = key(af);
  if(kb === ka) return;
  if(kb){
    const still = await db().collection("clients").where("ptId", "==", b.ptId).where("studentUid", "==", b.studentUid).limit(2).get();
    if(!still.docs.some(x=> x.id !== event.params.cid)) await db().collection("ptLinks").doc(kb).delete();
  }
  if(ka) await db().collection("ptLinks").doc(ka).set({ ptId: af.ptId, studentUid: af.studentUid, cid: event.params.cid, at: nowMs() });
});

/* ---------------- Quyền viết đánh giá + số liệu có xác minh ---------------- */
const ptConfirmed = s=> s && s.status === "done" && (s.completedBy === "pt" || !!s.proxyLog || !!s.ptConfirmedAt);
/** Thuần: đủ điều kiện "đã tập cùng" theo form? */
function eligibleByForm(client, sessions, at){
  client = obj(client);
  if(!client.studentUid) return false;
  const since = tsMs(client.joinedAt) || 0;                 // chỉ form học viên TỰ kết nối (máy chủ ghi joinedAt)
  if(!since || at - since < MIN_LINK_DAYS * DAY) return false;
  return (Array.isArray(sessions) ? sessions : []).filter(ptConfirmed).length >= MIN_PT_SESSIONS;
}
/** Thuần: buổi thử đủ điều kiện? (tạo trước ≥ 24 giờ, tài khoản người đặt ≥ 7 ngày tuổi) */
function eligibleByTrial(req, userCreatedMs, at){
  req = obj(req);
  return req.kind === "trial" && req.status === "done" && tsMs(req.createdAt) > 0 && at - tsMs(req.createdAt) >= DAY
    && userCreatedMs > 0 && at - userCreatedMs >= MIN_LINK_DAYS * DAY;
}
async function grantRights(lid, uid, basis){
  const ref = db().collection("reviewRights").doc(`${lid}_${uid}`);
  await ref.set({ uid, lid, basis, at: nowMs(), until: admin.firestore.Timestamp.fromMillis(nowMs() + RIGHTS_DAYS * DAY) }, { merge: true });
  return true;
}
async function formSessions(cid){ return (await db().collection("clients").doc(cid).collection("sessions").where("status", "==", "done").get()).docs.map(x=> x.data()); }
async function ptStats(ptId){
  const forms = (await db().collection("clients").where("ptId", "==", ptId).get()).docs.filter(x=> (x.data() || {}).studentUid);
  let students = 0, sessions = 0;
  for(const f of forms){ const n = (await formSessions(f.id)).filter(ptConfirmed).length; if(n){ students++; sessions += n; } }
  return { students, sessions, at: nowMs() };
}
exports.sessionAgg = onDocumentWritten({ document: "clients/{cid}/sessions/{sid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const af = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const bf = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  if(!!(af && ptConfirmed(af)) === !!(bf && ptConfirmed(bf))) return;            // chỉ khi số buổi PT xác nhận đổi
  const cs = await db().collection("clients").doc(event.params.cid).get(); if(!cs.exists) return;
  const c = cs.data();
  if(c.studentUid && eligibleByForm(c, await formSessions(event.params.cid), nowMs())) await grantRights(c.ptId, c.studentUid, { type: "client", id: event.params.cid });
  const l = db().collection("ptListings").doc(c.ptId);
  if((await l.get()).exists) await l.set({ statsVerified: await ptStats(c.ptId) }, { merge: true });
});
exports.trialRights = onDocumentWritten({ document: "ptListings/{lid}/requests/{qid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const af = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const bf = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  if(!af || af.status !== "done" || (bf && bf.status === "done") || af.kind !== "trial" || !af.uid) return;
  let created = 0; try{ const u = await admin.auth().getUser(af.uid); created = Date.parse(u.metadata && u.metadata.creationTime) || 0; }catch(e){}
  if(eligibleByTrial(af, created, nowMs())) await grantRights(event.params.lid, af.uid, { type: "trial", id: event.params.qid });
});
exports.claimReviewRights = onCall({ region: REGION, maxInstances: 5, timeoutSeconds: 20 }, async (request)=>{
  const a = request.auth; if(!a || !a.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
  await A.rateLimit(`${a.uid}_rights`, 20, 3600);
  const lid = str(obj(request.data).lid, 128); if(!lid || lid === a.uid) throw new HttpsError("invalid-argument", "PT không hợp lệ.");
  const forms = await db().collection("clients").where("ptId", "==", lid).where("studentUid", "==", a.uid).get();
  for(const f of forms.docs) if(eligibleByForm(f.data(), await formSessions(f.id), nowMs())){ await grantRights(lid, a.uid, { type: "client", id: f.id }); return { ok: true, basis: "client" }; }
  let created = 0; try{ const u = await admin.auth().getUser(a.uid); created = Date.parse(u.metadata && u.metadata.creationTime) || 0; }catch(e){}
  const trials = await db().collection("ptListings").doc(lid).collection("requests").where("uid", "==", a.uid).get();
  for(const q of trials.docs) if(eligibleByTrial(q.data(), created, nowMs())){ await grantRights(lid, a.uid, { type: "trial", id: q.id }); return { ok: true, basis: "trial" }; }
  return { ok: false, reason: `Cần ≥ ${MIN_PT_SESSIONS} buổi PT xác nhận và ≥ ${MIN_LINK_DAYS} ngày kết nối, hoặc 1 buổi thử đã hoàn thành.` };
});

/* ---------------- SĐT còn sót trong hồ sơ công khai → private/contact ---------------- */
exports.phoneToPrivate = onDocumentWritten({ document: "users/{uid}", region: REGION, maxInstances: 5 }, async (event)=>{
  const af = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if(!af || !("phone" in af)) return;
  const uid = event.params.uid;
  if(af.phone) await db().collection("users").doc(uid).collection("private").doc("contact").set({ phone: str(af.phone, 20), updatedAt: nowMs() }, { merge: true });
  await db().collection("users").doc(uid).update({ phone: admin.firestore.FieldValue.delete() });
});

/* QS-17: chạy 1 LẦN sau khi deploy — chuyển SĐT còn sót trong hồ sơ công khai users/{uid} (dữ liệu trước 11/2026) sang private/contact.
   Rules không lọc được trường khi đọc → dữ liệu cũ phải dọn ở máy chủ. Chỉ Owner / Super Admin (roles.assign), xác thực ≤ 12 giờ. */
exports.migrateLegacyPhones = onCall({ region: REGION, maxInstances: 1, timeoutSeconds: 540, memory: "512MiB" }, async (request)=>{
  const actor = await A.actorOf(request, { recentSec: A.SESSION_SEC });
  A.need(actor, "roles.assign");
  let moved = 0, scanned = 0, last = null;
  for(let page = 0; page < 200; page++){
    let q = db().collection("users").orderBy(admin.firestore.FieldPath.documentId()).limit(300);
    if(last) q = q.startAfter(last);
    const snap = await q.get(); if(!snap.docs.length) break;
    for(const d of snap.docs){
      scanned++; const u = d.data() || {};
      if(!("phone" in u)) continue;
      if(u.phone) await d.ref.collection("private").doc("contact").set({ phone: str(u.phone, 20), updatedAt: nowMs() }, { merge: true });
      await d.ref.update({ phone: admin.firestore.FieldValue.delete() }); moved++;
    }
    last = snap.docs[snap.docs.length - 1];
    if(snap.docs.length < 300) break;
  }
  await A.writeAudit(actor, "data.migrate_phones", { type: "users", id: "*" }, { scanned, moved });
  return { ok: true, scanned, moved };
});

exports._socialTest = { linkProblem, eligibleByForm, eligibleByTrial, ptConfirmed, normCode, MIN_LINK_DAYS, MIN_PT_SESSIONS };

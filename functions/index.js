/* =========================================================================
   TapEasy — Cloud Functions
   (+ functions/admin.js: quản trị & phân quyền · functions/findpt.js: tổng hợp đánh giá / tỉ lệ phản hồi Tìm PT)
   1. revokeAppleToken   (callable, 2nd gen)  — App Store Guideline 5.1.1(v):
      khi người dùng "Đăng nhập với Apple" xoá tài khoản, app phải thu hồi token
      bằng Sign in with Apple REST API (/auth/revoke). Client gọi hàm này NGAY SAU
      khi xác thực lại bằng Apple và TRƯỚC khi gọi user.delete().
   2. cleanupDeletedUser (Auth onDelete, 1st gen — Firebase chưa có trigger xoá user
      ở 2nd gen) — dọn dữ liệu Firestore còn sót khi tài khoản Auth bị xoá theo BẤT KỲ
      đường nào (trong app, trang delete-account.html, Firebase Console, Admin SDK).
   3. deleteMyAccount (callable) — QS-10/QS-21: app và delete-account.html gọi hàm này thay vì tự xoá từng
      collection: xác thực ≤ 5 phút, CHẶN Chủ sở hữu chưa chuyển nhượng, thu hồi token Apple, dọn TOÀN BỘ dữ liệu
      gắn với tài khoản (routine, đánh giá + ảnh, tin nhắn, bình luận, đăng ký sự kiện + liên hệ khẩn cấp, đơn hàng
      → ẩn danh, quà, ticket, báo cáo, lời mời, điểm, chặn, ảnh Storage, sức khoẻ trong form PT) rồi xoá Auth.
   + functions/commerce.js (đơn hàng / điểm / thi đua / check-in) · functions/social.js (liên kết PT ↔ học viên, quyền đánh giá)

   Cấu hình (xem docs/INTEGRATION-health-safety.md):
     firebase functions:secrets:set APPLE_PRIVATE_KEY --data-file AuthKey_XXXXXXXXXX.p8
     functions/.env  →  APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_BUNDLE_ID, APPLE_SERVICES_ID
     firebase deploy --only functions
   ========================================================================= */
"use strict";
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const apple = require("./apple");

admin.initializeApp();

/* Quản trị & phân quyền (functions/admin.js): bootstrapOwner, setRole, transferOwnership, banUser, unbanUser,
   adminGetUser, adminListUsers, sendBroadcast, chainAudit — xem docs/INTEGRATION-admin.md §3 (secret OWNER_BOOTSTRAP_CODE) */
Object.assign(exports, require("./admin"));
/* Tìm PT (functions/findpt.js): ptReviewAgg, ptRespAgg — tính điểm đánh giá & tỉ lệ phản hồi (rules khoá các trường này) */
Object.assign(exports, require("./findpt"));
/* Vòng sửa bảo mật (docs/qa/FIX-security.md): máy chủ quyết giá đơn / tồn kho / voucher / điểm / tiến độ / check-in,
   liên kết PT ↔ học viên chỉ qua joinByCode, quyền đánh giá & số liệu PT có xác minh */
Object.assign(exports, require("./commerce"));
Object.assign(exports, require("./social"));
/* Vòng R3 (functions/account.js): OTP 6 số qua email để đặt lại mật khẩu (requestEmailOtp / verifyEmailOtp) + exportMyData (xuất dữ liệu của tôi) */
Object.assign(exports, require("./account"));

const REGION = "asia-southeast1";                 // cùng vùng Firestore (Singapore) — client gọi functions("asia-southeast1")
const RECENT_LOGIN_SEC = 15 * 60;                 // chỉ cho thu hồi ngay sau khi xác thực lại

const APPLE_PRIVATE_KEY = defineSecret("APPLE_PRIVATE_KEY");   // nội dung file .p8 (Secret Manager)
const APPLE_TEAM_ID     = defineString("APPLE_TEAM_ID",     { description: "Apple Developer Team ID (10 ký tự)" });
const APPLE_KEY_ID      = defineString("APPLE_KEY_ID",      { description: "Key ID của key Sign in with Apple (.p8)" });
const APPLE_BUNDLE_ID   = defineString("APPLE_BUNDLE_ID",   { default: "vn.thangvu.fitkit", description: "Bundle ID app iOS (client_id cho mã từ iOS)" });
const APPLE_SERVICES_ID = defineString("APPLE_SERVICES_ID", { default: "vn.thangvu.fitkit.web", description: "Services ID (client_id cho web / Android)" });

/* Bộ sưu tập Firestore có doc id = uid (thêm tên vào đây nếu module khác tạo thêm, VD "ptPublic")
   Vòng 3: + roles (vai trò quản trị), pt_verifications (hồ sơ xác minh PT), userSocial (thích/lưu cộng đồng),
   ptListings (niêm yết Tìm PT — xoá kèm đánh giá & yêu cầu con). Owner KHÔNG tự xoá được (pt.js chặn, phải chuyển nhượng trước). */
const USER_DOC_COLLECTIONS = ["users", "roles", "pt_verifications", "userSocial", "ptListings"];
/* QS-10: collection khác có doc id = uid (xoá cả sub-collection): sổ điểm, danh sách chặn, ghi chú nội bộ về người dùng, khoá */
const USER_DOC_EXTRA = ["points", "blocks", "user_notes", "bans"];

/* ---------------------------------------------------------------------
   1. revokeAppleToken
   data: { authorizationCode?, accessToken?, refreshToken?, platform: "ios"|"android"|"web" }
   --------------------------------------------------------------------- */
async function revokeAppleFor(auth, d){
    d = d || {};
    const pick = v => (typeof v === "string" && v.length > 0 && v.length < 4096) ? v : null;
    const code = pick(d.authorizationCode), accessToken = pick(d.accessToken), refreshToken = pick(d.refreshToken);
    if(!code && !accessToken && !refreshToken) throw new HttpsError("invalid-argument", "Thiếu authorizationCode / accessToken.");

    const user = await admin.auth().getUser(auth.uid);
    const appleInfo = (user.providerData || []).find(p => p.providerId === "apple.com");
    if(!appleInfo) return { revoked: false, reason: "not-apple-user" };

    // Mã từ iOS cấp cho Bundle ID; token từ web/Android (Firebase OAuth) cấp cho Services ID → thử đúng thứ tự, sai thì thử cái còn lại
    const ios = d.platform === "ios";
    const clientIds = ios ? [APPLE_BUNDLE_ID.value(), APPLE_SERVICES_ID.value()] : [APPLE_SERVICES_ID.value(), APPLE_BUNDLE_ID.value()];
    try{
      const r = await apple.revokeAppleCredential({
        teamId: APPLE_TEAM_ID.value(), keyId: APPLE_KEY_ID.value(), privateKey: APPLE_PRIVATE_KEY.value(),
        clientIds, authorizationCode: code, accessToken, refreshToken, expectedSub: appleInfo.uid,
      });
      logger.info("Đã thu hồi token Apple", { uid: auth.uid, via: r.via, clientId: r.clientId });
      return { revoked: true, via: r.via };
    }catch(e){
      logger.error("Thu hồi token Apple thất bại", { uid: auth.uid, step: e.step, status: e.status, appleError: e.appleError, message: e.message });
      throw new HttpsError("internal", "Không thu hồi được quyền Đăng nhập với Apple. Bạn vẫn có thể xoá tài khoản; hãy gỡ TapEasy trong Cài đặt → Apple ID → Đăng nhập bằng Apple.");
    }
}
exports.revokeAppleToken = onCall(
  { region: REGION, secrets: [APPLE_PRIVATE_KEY], maxInstances: 5, timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    const auth = request.auth;
    if(!auth || !auth.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
    const authTime = Number(auth.token && auth.token.auth_time) || 0;
    if(authTime && Date.now()/1000 - authTime > RECENT_LOGIN_SEC) throw new HttpsError("failed-precondition", "Vui lòng xác thực lại rồi thử lại.");
    return revokeAppleFor(auth, request.data);
  }
);

/* ---------------------------------------------------------------------
   2. cleanupDeletedUser — idempotent: chạy lại nhiều lần không sao
   --------------------------------------------------------------------- */
/* QS-10: DANH SÁCH dữ liệu gắn với tài khoản (nguồn sự thật cho privacy-policy.html §9–10, delete-account.html, test 65).
   action: "delete" xoá hẳn · "anonymize" giữ số tiền cho kế toán nhưng bỏ tên / SĐT / địa chỉ · "unlink" gỡ khỏi form của PT. */
const CLEANUP_PLAN = [
  { what: "Hồ sơ, liên hệ riêng, vai trò, xác minh PT, thích/lưu, niêm yết Tìm PT (+ đánh giá & yêu cầu con)", col: USER_DOC_COLLECTIONS.join(","), by: "doc id = uid", action: "delete" },
  { what: "Sổ điểm, danh sách chặn, ghi chú nội bộ, khoá", col: USER_DOC_EXTRA.join(","), by: "doc id = uid", action: "delete" },
  { what: "Form học viên do mình tạo (là PT) + buổi tập, ghi chú, tin nhắn, mã mời, lời mời", col: "clients,joinCodes,invites", by: "ptId", action: "delete" },
  { what: "Form PT của mình (là học viên): gỡ liên kết, xoá sức khoẻ / số đo / ảnh / nhật ký đồng bộ / \"BS đã cho phép\", phản hồi & nhật ký mình ghi trong buổi tập, nhận xét PT ↔ học viên, tin nhắn & ghi chú mình viết", col: "clients,sessions,feedback,messages,notes", by: "studentUid / from / authorUid", action: "unlink" },
  { what: "Lời mời gửi tới email của mình / lời mời mình đã nhận", col: "invites", by: "email / studentUid", action: "delete" },
  { what: "Routine cộng đồng mình đăng (+ thích/lưu/báo cáo con) và dấu thích/lưu/sao chép/báo cáo mình để lại (cả báo cáo đánh giá PT)", col: "routines,reports(collectionGroup)", by: "authorUid / userSocial / uid", action: "delete" },
  { what: "Đánh giá PT, review sự kiện (+ ảnh), bình luận, lượt thích, báo cáo Khoảnh khắc", col: "reviews,mcomments,mlikes,mreports", by: "uid", action: "delete" },
  { what: "Đăng ký sự kiện (SĐT, liên hệ khẩn cấp), điểm thi đua / bảng xếp hạng", col: "regs,entries", by: "uid", action: "delete" },
  { what: "Yêu cầu buổi thử / câu hỏi Tìm PT", col: "requests", by: "uid", action: "delete" },
  { what: "Ticket hỗ trợ, báo cáo vi phạm mình gửi", col: "support_tickets,reports", by: "uid / by", action: "delete" },
  { what: "Quyền đánh giá, liên kết SĐT PT ↔ học viên, voucher cá nhân (đổi điểm / hoàn thành thử thách), lượt dùng, giữ chỗ mã", col: "reviewRights,ptLinks,vouchers,voucherUses,voucherHolds,voucherGrants", by: "uid / lid / owner", action: "delete" },
  { what: "Người khác chặn mình (bản ghi trỏ tới uid đã xoá)", col: "blocks/*/list", by: "uid", action: "delete" },
  { what: "Đơn hàng & quà đã gửi: giữ mã đơn / số tiền / mặt hàng (nghĩa vụ kế toán – thuế, 10 năm) nhưng XOÁ tên, SĐT, địa chỉ, ghi chú", col: "orders,gifts", by: "uid", action: "anonymize" },
  { what: "Bản sao lưu dữ liệu tập luyện – dinh dưỡng (appState), nhật ký đồng ý (consents), mã OTP email đang chờ", col: "users/{uid}/appState,users/{uid}/consents,email_otps,otp_rate", by: "doc id = uid / băm email", action: "delete" },
  { what: "Ảnh / clip Khoảnh khắc trên Firebase Storage", col: "storage: media/moments/*/{uid}/", by: "đường dẫn", action: "delete" },
];
const ORDER_PII = ["address", "name", "phone", "note", "email"];
/** Thuần: có được tự xoá tài khoản không? (QS-21) → null hoặc thông báo lỗi */
function deletionBlocker(roleDoc, ownerMeta, uid){
  if((roleDoc && roleDoc.role === "owner") || (ownerMeta && ownerMeta.uid === uid && !ownerMeta.orphaned))
    return "Bạn đang là Chủ sở hữu ứng dụng. Hãy chuyển nhượng quyền Chủ sở hữu (Quản trị → Đội ngũ) trước khi xoá tài khoản.";
  return null;
}
/** Thuần: bản ghi đơn hàng / quà sau khi ẩn danh */
function anonymizeOrder(o){
  const out = {}; ORDER_PII.forEach(k=>{ if(o && k in o) out[k] = admin.firestore.FieldValue.delete(); });
  return Object.assign(out, { uid: null, anonymized: true, anonymizedAt: Date.now() });
}

async function cleanupUserData(db, uid, email){
  const out = { ownedClients: 0, joinCodes: 0, unlinked: 0, notes: 0, userDocs: 0, routines: 0, ugc: 0, anonymized: 0, files: 0 };
  const writer = db.bulkWriter();
  writer.onWriteError(err=>{ if(err.failedAttempts < 3) return true; logger.warn("Dọn dữ liệu: bỏ qua 1 bản ghi", { path: err.documentRef && err.documentRef.path, message: err.message }); return false; });
  const del = ref=>{ writer.delete(ref); out.ugc++; };
  const safeQ = async q=>{ try{ return (await q.get()).docs; }catch(e){ logger.warn("Dọn dữ liệu: truy vấn lỗi (thiếu index?)", { message: e.message }); return []; } };

  // a) Form học viên do người này tạo (là PT): xoá form + buổi tập + ghi chú + mã mời
  const owned = await db.collection("clients").where("ptId", "==", uid).get();
  for(const doc of owned.docs){
    const c = doc.data() || {};
    if(c.joinCode) writer.delete(db.collection("joinCodes").doc(String(c.joinCode)));
    await db.recursiveDelete(doc.ref);
    out.ownedClients++;
  }
  // b) Mã mời mồ côi
  const codes = await db.collection("joinCodes").where("ptId", "==", uid).get();
  codes.docs.forEach(doc => { writer.delete(doc.ref); out.joinCodes++; });

  // c) Là học viên: gỡ liên kết + xoá dữ liệu CỦA HỌC VIÊN trong form (sức khoẻ, số đo, ảnh, nhật ký đồng bộ — QP-11/QS-10)
  //    + tin nhắn / ghi chú do chính người này viết (lịch buổi tập & ghi chú của PT thuộc PT)
  const FV = admin.firestore.FieldValue;
  const linked = await db.collection("clients").where("studentUid", "==", uid).get();
  for(const doc of linked.docs){
    writer.update(doc.ref, { studentUid: null, studentName: null, studentEmail: null, joinedAt: null, linkedVia: null,
      health: FV.delete(), measurements: FV.delete(), photos: FV.delete(), trainingSync: FV.delete(), chat: FV.delete(),
      parqClearance: FV.delete(), updatedAt: Date.now() });                // vòng 2 (FIX-pt §3): + "BS đã cho phép" (thông tin sức khoẻ)
    out.unlinked++;
    for(const n of await safeQ(doc.ref.collection("notes").where("authorUid", "==", uid))){ writer.delete(n.ref); out.notes++; }
    for(const m of await safeQ(doc.ref.collection("messages").where("from", "==", uid))) del(m.ref);
    // vòng 2 (FIX-pt QP-03 = demoCleanupDeletedUser): phần HỌC VIÊN ghi trong buổi tập (phản hồi, nhật ký) + nhận xét PT ↔ học viên
    //   (feedback/pt có reply + cờ "cho phép chia sẻ" của học viên — không để lời nhận xét tiếp tục được chia sẻ sau khi xoá)
    for(const s of await safeQ(doc.ref.collection("sessions"))){
      const sd = s.data() || {}, patch = {};
      ["feedback", "feedbackAt", "studentLog"].forEach(k=>{ if(k in sd) patch[k] = FV.delete(); });
      if(Object.keys(patch).length) writer.update(s.ref, patch);
    }
    for(const f of await safeQ(doc.ref.collection("feedback"))) del(f.ref);
  }
  // d) Lời mời: PT đã gửi + gửi tới email của người này + lời mời đã nhận (studentUid)
  for(const d of await safeQ(db.collection("invites").where("ptId", "==", uid))) del(d.ref);
  if(email) for(const d of await safeQ(db.collection("invites").where("email", "==", String(email).toLowerCase()))) del(d.ref);
  for(const d of await safeQ(db.collection("invites").where("studentUid", "==", uid))) del(d.ref);

  // e) Cộng đồng: routine của mình (+ con) và dấu thích / lưu / sao chép mình để lại trên routine người khác
  for(const r of await safeQ(db.collection("routines").where("authorUid", "==", uid))){ await db.recursiveDelete(r.ref); out.routines++; }
  const soc = await db.collection("userSocial").doc(uid).get();
  if(soc.exists){
    const s = soc.data() || {};
    const marks = [["likes", s.liked], ["saves", s.saved], ["copies", s.copied], ["reports", s.reported]];
    for(const [kind, ids] of marks) for(const rid of (Array.isArray(ids) ? ids : []).slice(0, 2000)){
      const ref = db.collection("routines").doc(String(rid)).collection(kind).doc(uid);
      del(ref);
      if(kind === "likes" || kind === "saves") writer.update(db.collection("routines").doc(String(rid)), { [kind]: FV.increment(-1) }).catch(()=>{});
    }
  }
  // vòng 2: dấu báo cáo có trường uid ở mọi nơi khác (đánh giá PT ptListings/*/reviews/*/reports/{uid}, routine) — collectionGroup
  for(const d of await safeQ(db.collectionGroup("reports").where("uid", "==", uid))) del(d.ref);
  // f) Nội dung người dùng tạo theo trường uid (collectionGroup — firestore.indexes.json có fieldOverride tương ứng)
  for(const col of ["reviews", "mcomments", "mlikes", "mreports", "regs", "entries", "requests"]){
    for(const d of await safeQ(db.collectionGroup(col).where("uid", "==", uid))){
      if(col === "reviews") await db.recursiveDelete(d.ref); else del(d.ref);
    }
  }
  for(const d of await safeQ(db.collectionGroup("list").where("uid", "==", uid))) del(d.ref);           // blocks/*/list/{uid}
  for(const d of await safeQ(db.collection("support_tickets").where("uid", "==", uid))) del(d.ref);
  for(const d of await safeQ(db.collection("reports").where("by", "==", uid))) del(d.ref);
  for(const [col, f] of [["reviewRights", "uid"], ["reviewRights", "lid"], ["ptLinks", "ptId"], ["ptLinks", "studentUid"], ["vouchers", "owner"], ["voucherUses", "uid"],
                         ["voucherHolds", "uid"], ["voucherGrants", "uid"]])
    for(const d of await safeQ(db.collection(col).where(f, "==", uid))) del(d.ref);

  // g) Đơn hàng / quà: ẩn danh (giữ số tiền cho kế toán — privacy-policy §10), quà chưa xác nhận thì xoá
  for(const d of await safeQ(db.collection("orders").where("uid", "==", uid))){ writer.update(d.ref, anonymizeOrder(d.data())); out.anonymized++; }
  for(const d of await safeQ(db.collection("gifts").where("uid", "==", uid))){
    if((d.data() || {}).status === "new") del(d.ref); else { writer.update(d.ref, anonymizeOrder(d.data())); out.anonymized++; }
  }
  await writer.close();

  // h) Hồ sơ người dùng (+ sub-collection: private/contact…) và các collection có doc id = uid
  for(const col of USER_DOC_COLLECTIONS.concat(USER_DOC_EXTRA)){
    const ref = db.collection(col).doc(uid);
    const snap = await ref.get();
    if(snap.exists) out.userDocs++;
    await db.recursiveDelete(ref);
  }
  // h2) R3: mã OTP email đang chờ + bộ đếm xuất dữ liệu (bản sao lưu users/{uid}/appState và nhật ký users/{uid}/consents đã xoá ở bước h — recursiveDelete)
  try{
    if(email) await db.collection("email_otps").doc(require("crypto").createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex")).delete();
    await db.collection("otp_rate").doc("export_" + uid).delete();
  }catch(e){ logger.warn("Dọn OTP / bộ đếm thất bại (bỏ qua)", { message: e.message }); }
  // i) Storage: ảnh / clip Khoảnh khắc media/moments/{evId}/{uid}/…
  try{
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: "media/moments/" });
    for(const f of files) if(f.name.split("/")[3] === uid){ await f.delete().catch(()=>{}); out.files++; }
  }catch(e){ logger.warn("Dọn Storage thất bại (bỏ qua)", { message: e.message }); }
  return out;
}

/* QS-21: Chủ sở hữu bị xoá bằng đường khác (Console / Admin SDK) → KHÔNG để app "mất Owner" vĩnh viễn:
   đánh dấu roles_meta/owner.orphaned → bootstrapOwner (secret OWNER_BOOTSTRAP_CODE) cho khởi tạo lại; ghi audit cảnh báo. */
async function handleOwnerDeleted(db, uid){
  const ref = db.collection("roles_meta").doc("owner");
  const m = await ref.get();
  if(!m.exists || m.data().uid !== uid) return false;
  await ref.set({ orphaned: true, orphanedAt: Date.now() }, { merge: true });
  await db.collection("admin_audit").add({ actorUid: null, actorName: "Hệ thống", actorRole: null, action: "owner.deleted", target: { type: "user", id: uid, name: "" },
    details: { note: "Tài khoản Chủ sở hữu đã bị xoá — khởi tạo lại bằng bootstrapOwner (OWNER_BOOTSTRAP_CODE)." }, ts: admin.firestore.FieldValue.serverTimestamp(), client: "functions" });
  logger.error("Tài khoản Chủ sở hữu đã bị xoá — app cần khởi tạo Owner lại", { uid });
  return true;
}

/* ---------------------------------------------------------------------
   3. deleteMyAccount — QS-10 / QS-21 / App Store 5.1.1(v): app + delete-account.html gọi hàm này
   data: { apple?: { authorizationCode?, accessToken?, platform } }
   --------------------------------------------------------------------- */
const DELETE_RECENT_SEC = 10 * 60;
exports.deleteMyAccount = onCall(
  { region: REGION, secrets: [APPLE_PRIVATE_KEY], maxInstances: 5, timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    const auth = request.auth;
    if(!auth || !auth.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập.");
    const authTime = Number(auth.token && auth.token.auth_time) || 0;
    if(!authTime || Date.now()/1000 - authTime > DELETE_RECENT_SEC) throw new HttpsError("failed-precondition", "Vui lòng xác thực lại (nhập mật khẩu / đăng nhập lại) rồi xoá tài khoản.");
    const db = admin.firestore(), uid = auth.uid;
    const [rs, om] = await Promise.all([db.collection("roles").doc(uid).get(), db.collection("roles_meta").doc("owner").get()]);
    const why = deletionBlocker(rs.exists ? rs.data() : null, om.exists ? om.data() : null, uid);
    if(why) throw new HttpsError("failed-precondition", why);
    const user = await admin.auth().getUser(uid);
    let apple = { revoked: false };
    if((user.providerData || []).some(p=> p.providerId === "apple.com")){
      const g = request.data && request.data.apple;
      if(g && (g.authorizationCode || g.accessToken || g.refreshToken)){
        try{ apple = await revokeAppleFor(auth, g); }catch(e){ apple = { revoked: false, error: e.message }; }
      } else apple = { revoked: false, reason: "no-grant" };
    }
    const res = await cleanupUserData(db, uid, user.email);
    await admin.auth().deleteUser(uid);                        // cleanupDeletedUser chạy lại (idempotent)
    logger.info("Người dùng tự xoá tài khoản", Object.assign({ uid, apple: apple.revoked }, res));
    return Object.assign({ ok: true, appleRevoked: !!apple.revoked }, res);
  }
);

exports.cleanupDeletedUser = functionsV1
  .region(REGION)
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .auth.user()
  .onDelete(async (user) => {
    const db = admin.firestore();
    await handleOwnerDeleted(db, user.uid).catch(e=> logger.error("handleOwnerDeleted", { message: e.message }));
    const res = await cleanupUserData(db, user.uid, user.email);
    const isApple = (user.providerData || []).some(p => p.providerId === "apple.com");
    logger.info("Đã dọn dữ liệu tài khoản bị xoá", Object.assign({ uid: user.uid, apple: isApple }, res));
    if(isApple) logger.info("Tài khoản Apple: token phải được thu hồi bởi revokeAppleToken trước khi xoá (Admin SDK không giữ token Apple).", { uid: user.uid });
  });

exports._test = { cleanupUserData, USER_DOC_COLLECTIONS, USER_DOC_EXTRA, CLEANUP_PLAN, deletionBlocker, anonymizeOrder, handleOwnerDeleted, DELETE_RECENT_SEC };

/* =========================================================================
   TapEasy (FitKit) — Lớp dữ liệu online (tài khoản + PT ↔ Học viên)

   Một API chung, 2 "động cơ":
   - firebase : khi firebase-config.js có apiKey → dùng Firebase Auth + Firestore
   - demo     : khi chưa cấu hình → giả lập máy chủ bằng localStorage trên máy này
                (để thử toàn bộ luồng PT ↔ học viên bằng cách đăng xuất/đăng nhập
                 2 tài khoản trên cùng 1 máy)

   Cấu trúc dữ liệu (giống nhau ở cả 2 động cơ):
   users/{uid}                 { uid, name, isPT, mainRole, createdAt }   (Firebase: KHÔNG lưu email — email đọc từ Auth; BUG-03)
   clients/{cid}               { ptId, ptName, studentUid, studentName, studentEmail,
                                 name, goal, startDate, packageTotal, phone,
                                 joinCode, remindBefore, createdAt, updatedAt }
   clients/{cid}/sessions/{id} { date, time, mode, status, title, exercises[],
                                 ptNote, feedback, completedAt, createdAt, updatedAt }
   clients/{cid}/notes/{id}    { authorUid, authorRole, authorName, text, ts }
   joinCodes/{code}            { clientId, ptId }
   blocks/{uid}/list/{other}   { uid:other, by:uid, at, name, reason }   (chặn người dùng — App Store 1.2)
   users/{uid}/appState/meta   { v, updatedAt, device, n, chars, app }   (R3: sao lưu fitkit_state_v1 theo tài khoản — CHỈ chủ tài khoản đọc/ghi)
   users/{uid}/appState/c{i}   { i, g, s }                               (khúc JSON ≤ 250 000 ký tự; g = updatedAt của lần ghi)
   users/{uid}/consents/{id}   { type, granted, version, clientAt, at, src, platform }   (R3: nhật ký đồng ý — chỉ-thêm)

   VÒNG R3 (14/11/2026 · docs/qa/R3-cloud.md · docs/DATABASE-SETUP.md):
   - cloud.sync    : sao lưu & đồng bộ dữ liệu cá nhân (debounce, gộp theo updatedAt, cắt khúc < 1 MiB, hỏi trước khi ghi đè)
   - cloud.consent : nhật ký đồng ý (terms / health / age + phiên bản chính sách)      - cloud.linked : tài khoản liên kết
   - cloud.resetPassword (trung tính, chờ 60 s) · cloud.otp (OTP email — cờ emailOtp) · cloud.phone (OTP SMS — cờ phoneOtp)
   - cloud.exportMyData() : xuất dữ liệu của tôi (JSON)      - cloud.degraded / retryInit : có cấu hình nhưng chưa kết nối được

   VÒNG SỬA BẢO MẬT (11/2026 · docs/qa/FIX-security.md):
   - QS-02: docData/qData — id LUÔN là id thật của tài liệu (dữ liệu chứa trường "id" không ghi đè được)
   - QS-02/QS-14: PT không gắn học viên; học viên liên kết qua Cloud Function joinByCode (mã / lời mời email đã xác minh)
   - QS-10/QS-21: xoá tài khoản = Cloud Function deleteMyAccount (chặn Owner, thu hồi Apple, dọn toàn bộ dữ liệu)
   - App Store 1.2: blockUser / unblockUser / listBlocked / isBlocked
   - cloud.fn(name, data): gọi Cloud Function (asia-southeast1) dùng chung cho các module
   ========================================================================= */

const cloud = (() => {
  const FB_VERSION = "10.12.2";
  const hasConfig = typeof FIREBASE_CONFIG !== "undefined" && !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);
  let mode = hasConfig ? "firebase" : "demo";
  let user = null;            // { uid, email, name }
  let profile = null;         // users/{uid}
  const authListeners = [];
  let fb = null;              // { auth, db }
  /* R3: cờ tính năng (firebase-config.js → FK_FEATURES). Mặc định TẮT những gì cần gói trả phí / hạ tầng riêng:
     phoneOtp (SMS — gói Blaze), emailOtp (Cloud Function + dịch vụ gửi mail). cloudSync: sao lưu dữ liệu tập lên tài khoản (bật). */
  const FEATURES = (()=>{
    let f = null; try{ if(typeof FK_FEATURES === "object" && FK_FEATURES) f = FK_FEATURES; }catch(e){}
    if(!f){ f = {}; try{ window.FK_FEATURES = f; }catch(e){} }
    [["phoneOtp", false], ["emailOtp", false], ["cloudSync", true]].forEach(([k, d])=>{ if(typeof f[k] !== "boolean") f[k] = d; });
    return f;
  })();
  /* R3.1 (14/11): CÔNG TẮC ĐĂNG NHẬP do quản trị bật/tắt (Admin → Cài đặt → "Cách đăng nhập & xác minh") — không cần phát hành lại app.
     Lưu ở settings/auth (ai cũng đọc được vì màn đăng nhập hiện TRƯỚC khi có tài khoản; chỉ quyền settings.edit được ghi — firestore.rules).
     Chế độ demo: localStorage. Bản nhớ đệm localStorage "fk_auth_flags" giúp áp ngay khi mở app, sau đó làm mới từ máy chủ. */
  const AUTH_FLAG_KEYS = ["emailOtp", "phoneOtp", "facebook", "apple", "google"];
  const AUTH_FLAG_LS = "fk_auth_flags";
  const AUTH_FLAG_BASE = { emailOtp: !!FEATURES.emailOtp, phoneOtp: !!FEATURES.phoneOtp };
  ["facebook", "apple", "google"].forEach(k=>{ AUTH_FLAG_BASE[k] = Array.isArray(FEATURES.authProviders) ? FEATURES.authProviders.indexOf(k) >= 0 : true; });
  function cleanAuthFlags(o){ const out = {}; if(o && typeof o === "object") AUTH_FLAG_KEYS.forEach(k=>{ if(typeof o[k] === "boolean") out[k] = o[k]; }); return out; }
  function applyAuthFlags(o){
    const f = Object.assign({}, AUTH_FLAG_BASE, cleanAuthFlags(o));
    FEATURES.emailOtp = f.emailOtp; FEATURES.phoneOtp = f.phoneOtp;
    if(Array.isArray(FEATURES.authProviders) || hasConfig) FEATURES.authProviders = ["google", "facebook", "apple"].filter(k=> f[k]);
    return f;
  }
  function readAuthFlagCache(){ try{ return cleanAuthFlags(JSON.parse(localStorage.getItem(AUTH_FLAG_LS) || "{}")); }catch(e){ return {}; } }
  let authFlags = null;
  const POLICY_VERSION = "2026-11-14";   // phiên bản Điều khoản + Chính sách (đổi khi sửa nội dung → app hỏi đồng ý lại)

  const now = () => Date.now();
  const rid = (p="id") => `${p}${now().toString(36)}${Math.random().toString(36).slice(2,8)}`;
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  /* Mã mời: bộ sinh ngẫu nhiên mật mã (crypto.getRandomValues). Máy chủ (joinByCode), rules (joinCodes ^[A-Z2-9]{6,10}$) và
     cloud-social.js (CODE_RE 6–10) đều nhận 6–10 ký tự → mã MỚI dài 8 (32^8 ≈ 1,1·10^12 tổ hợp — QS-14 chống dò joinCodes);
     mã 6 ký tự đã phát vẫn dùng được (vòng 2 · 11/11/2026). */
  const JOIN_CODE_LEN = 8;
  function randIdx(n){
    try{ const a = new Uint32Array(1); (globalThis.crypto || window.crypto).getRandomValues(a); return a[0] % n; }
    catch(e){ return Math.floor(Math.random()*n); }
  }
  const genCode = (len) => Array.from({length: len || JOIN_CODE_LEN}, ()=> CODE_CHARS[randIdx(CODE_CHARS.length)]).join("");
  const normCode = raw => String(raw||"").trim().toUpperCase().replace(/^.*[?&#]join=/i, "").replace(/[^A-Z0-9]/g,"");
  /* QS-02: trường do PT/máy chủ quyết định liên kết — client tạo form KHÔNG được tự điền */
  const LINK_KEYS = ["id", "studentUid", "studentName", "studentEmail", "joinedAt", "linkedVia"];
  const withoutKeys = (o, keys) => { const x = Object.assign({}, o || {}); keys.forEach(k=> delete x[k]); return x; };

  function emit(){ authListeners.forEach(cb=>{ try{ cb(user, profile); }catch(e){ console.error(e); } }); }

  /* ---------------- Thông báo lỗi tiếng Việt ---------------- */
  const ERR = {
    "auth/invalid-email": "Email không hợp lệ.",
    /* R3-CLOUD-03: không phân biệt "không có tài khoản" / "sai mật khẩu" (chống dò email) */
    "auth/user-not-found": "Email hoặc mật khẩu không đúng.",
    "auth/wrong-password": "Sai mật khẩu.",                  // chỉ gặp khi XÁC THỰC LẠI (đã đăng nhập) — đăng nhập thường trả invalid-credential
    "auth/missing-password": "Vui lòng nhập mật khẩu.",
    "auth/missing-email": "Vui lòng nhập email.",
    "auth/user-disabled": "Tài khoản này đang bị khoá. Liên hệ hỗ trợ để biết thêm.",
    "auth/user-token-expired": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    "auth/quota-exceeded": "Hệ thống đã gửi quá nhiều mã hôm nay. Vui lòng thử lại sau hoặc dùng cách khác.",
    "auth/invalid-phone-number": "Số điện thoại không hợp lệ. Ví dụ: 0912345678.",
    "auth/missing-phone-number": "Vui lòng nhập số điện thoại.",
    "auth/invalid-verification-code": "Mã không đúng hoặc đã hết hạn.",
    "auth/invalid-verification-id": "Mã không đúng hoặc đã hết hạn.",
    "auth/missing-verification-code": "Vui lòng nhập mã 6 số.",
    "auth/code-expired": "Mã đã hết hạn. Hãy yêu cầu mã mới.",
    "auth/captcha-check-failed": "Không xác minh được bạn là người thật. Tải lại trang rồi thử lại.",
    "auth/credential-already-in-use": "Phương thức này đã gắn với một tài khoản TapEasy khác.",
    "auth/provider-already-linked": "Tài khoản của bạn đã liên kết phương thức này rồi.",
    "auth/no-such-provider": "Tài khoản chưa liên kết phương thức này.",
    "auth/internal-error": "Máy chủ đăng nhập gặp sự cố. Vui lòng thử lại sau.",
    "auth/timeout": "Hết thời gian chờ. Kiểm tra mạng rồi thử lại.",
    "auth/web-storage-unsupported": "Trình duyệt đang chặn lưu trữ (chế độ riêng tư?). Hãy mở bằng trình duyệt thường.",
    "link/last-method": "Đây là cách đăng nhập duy nhất của bạn. Hãy thêm một cách khác (mật khẩu, Google…) trước khi huỷ liên kết.",
    "link/need-email": "Tài khoản chưa có email. Hãy liên kết Google/Apple/Facebook có email trước khi đặt mật khẩu.",
    "phone/not-linked": "Số điện thoại này chưa liên kết với tài khoản nào. Hãy dùng email để đặt lại mật khẩu.",
    "phone/disabled": "Bản app này chưa bật xác minh qua số điện thoại.",
    "otp/disabled": "Bản app này chưa bật mã OTP qua email. Hãy dùng link đặt lại mật khẩu.",
    "otp/invalid": "Mã không đúng hoặc đã hết hạn.",
    "otp/too-many": "Bạn đã nhập sai quá 5 lần. Hãy yêu cầu mã mới.",
    "cloud/offline": "Chưa kết nối được máy chủ TapEasy. Kiểm tra mạng rồi thử lại — dữ liệu tập cá nhân trên máy vẫn dùng bình thường.",
    "resource-exhausted": "Hệ thống đang quá tải hoặc đã hết hạn mức trong ngày. Vui lòng thử lại sau ít phút.",
    "unauthenticated": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    "deadline-exceeded": "Máy chủ phản hồi quá chậm. Kiểm tra mạng rồi thử lại.",
    "cancelled": "Thao tác đã bị huỷ. Vui lòng thử lại.",
    "aborted": "Dữ liệu vừa được thay đổi ở nơi khác. Vui lòng thử lại.",
    "failed-precondition": "Chưa thực hiện được thao tác này. Vui lòng thử lại sau.",
    "not-found": "Không tìm thấy dữ liệu (có thể đã bị xoá).",
    "already-exists": "Dữ liệu này đã tồn tại.",
    "data-loss": "Dữ liệu trên máy chủ bị lỗi. Vui lòng thử lại sau.",
    "internal": "Máy chủ gặp sự cố. Vui lòng thử lại sau.",
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/invalid-login-credentials": "Email hoặc mật khẩu không đúng.",
    "auth/email-already-in-use": "Email này đã được đăng ký.",
    "auth/weak-password": "Mật khẩu cần ít nhất 6 ký tự.",
    "auth/too-many-requests": "Thử quá nhiều lần, vui lòng đợi một lát.",
    "auth/network-request-failed": "Không có kết nối mạng.",
    "auth/requires-recent-login": "Vui lòng đăng nhập lại rồi thử lại.",
    "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập.",
    "auth/cancelled-popup-request": "Bạn đã đóng cửa sổ đăng nhập.",
    "auth/popup-blocked": "Trình duyệt chặn cửa sổ đăng nhập, đang chuyển sang trang đăng nhập…",
    "auth/account-exists-with-different-credential": "Email này đã đăng ký bằng cách khác (email/mật khẩu, Google, Apple hoặc Facebook). Hãy đăng nhập bằng cách cũ — TapEasy sẽ tự liên kết cách mới vào tài khoản của bạn.",
    "auth/operation-not-allowed": "Chủ app chưa bật đăng nhập bằng hình thức này trong Firebase.",
    "auth/unauthorized-domain": "Tên miền này chưa được cho phép trong Firebase Authentication.",
    "social/not-configured": "Bản app này chưa cấu hình đăng nhập Google/Facebook. Tạm thời hãy dùng email.",
    "permission-denied": "Bạn không có quyền thực hiện thao tác này.",
    "join/code-taken": "Mã này đã có học viên dùng. Nhờ PT tạo mã mới cho bạn nhé.",
    "join/bad-code": "Mã gồm 6–10 ký tự chữ và số, ví dụ: K7M2QX.",
    "owner/must-transfer": "Bạn đang là Chủ sở hữu ứng dụng. Hãy chuyển nhượng quyền Chủ sở hữu (Quản trị → Đội ngũ) trước khi xoá tài khoản.",
    "functions/resource-exhausted": "Thao tác quá nhiều lần, vui lòng thử lại sau.",
    "unavailable": "Máy chủ tạm thời không truy cập được, kiểm tra mạng.",
  };
  function niceError(e){
    const code = e && (e.code || e.message);
    // Lỗi Cloud Function (HttpsError) đã có thông báo tiếng Việt từ máy chủ → giữ nguyên
    if(e && /^functions\//.test(String(e.code||"")) && e.message && !ERR[code]){ const err = new Error(e.message); err.code = String(e.code).replace(/^functions\//, ""); return err; }
    /* R3-CLOUD-04: mã Firestore/Functions có thể mang tiền tố ("firestore/permission-denied", "functions/unavailable") → tra cả mã trần;
       thông báo gốc tiếng Anh của Firebase ("Firebase: Error (auth/…)", "Missing or insufficient permissions.") KHÔNG đưa ra giao diện. */
    const bare = String(code || "").replace(/^(firestore|functions|storage)\//, "");
    let msg = ERR[code] || ERR[bare];
    if(!msg){
      const raw = String((e && e.message) || "");
      const foreign = !raw || /^\s*firebase|FirebaseError|\(auth\/|insufficient permissions|failed to fetch|network ?error|quota|client is offline|INTERNAL ASSERTION|^[a-z-]+\/[a-z-]+$/i.test(raw);
      if(/offline|failed to fetch|network/i.test(raw)) msg = ERR["unavailable"];
      else if(/quota/i.test(raw)) msg = ERR["resource-exhausted"];
      else if(/insufficient permissions/i.test(raw)) msg = ERR["permission-denied"];
      else msg = foreign ? ("Đã có lỗi xảy ra. Vui lòng thử lại." + (/^[a-z-]+\/[a-z-]+$/i.test(String(code||"")) ? " (mã: " + code + ")" : "")) : raw;
    }
    const err = new Error(msg); err.code = code;
    if(e && e.waitSec) err.waitSec = e.waitSec;
    return err;
  }
  const wrap = fn => async (...a) => { try{ return await fn(...a); }catch(e){ throw niceError(e); } };

  /* =====================================================================
     ĐỘNG CƠ DEMO (localStorage)
     ===================================================================== */
  const DEMO_KEY = "fitkit_cloud_demo_v1";
  const DEMO_AUTH = "fitkit_cloud_demo_auth";
  function dLoad(){
    try{ return Object.assign({ users:{}, accounts:{}, clients:{}, sessions:{}, notes:{}, joinCodes:{} }, JSON.parse(localStorage.getItem(DEMO_KEY)||"{}")); }
    catch(e){ return { users:{}, accounts:{}, clients:{}, sessions:{}, notes:{}, joinCodes:{} }; }
  }
  function dSave(db){ localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
  function dHash(s){ let h=5381; for(const c of String(s)) h=((h<<5)+h+c.charCodeAt(0))|0; return "h"+(h>>>0).toString(36); }
  function dErr(code){ const e=new Error(code); e.code=code; return e; }
  const delay = (ms=120) => new Promise(r=>setTimeout(r, ms));

  const demo = {
    async init(){
      const db = dLoad();
      const uid = localStorage.getItem(DEMO_AUTH);
      if(uid && db.users[uid]){ user = { uid, email: db.users[uid].email, name: db.users[uid].name }; profile = db.users[uid]; }
    },
    async signUp(email, pw, name){
      await delay(); email = String(email||"").trim().toLowerCase();
      if(!/^\S+@\S+\.\S+$/.test(email)) throw dErr("auth/invalid-email");
      if(String(pw||"").length < 6) throw dErr("auth/weak-password");
      const db = dLoad();
      if(db.accounts[email]) throw dErr("auth/email-already-in-use");
      const uid = rid("u");
      db.accounts[email] = { uid, pw: dHash(pw) };
      db.users[uid] = { uid, email, name: name || email.split("@")[0], isPT:false, mainRole:null, createdAt: now() };
      dSave(db); localStorage.setItem(DEMO_AUTH, uid);
      user = { uid, email, name: db.users[uid].name }; profile = db.users[uid];
    },
    async signIn(email, pw){
      await delay(); email = String(email||"").trim().toLowerCase();
      const db = dLoad(); const acc = db.accounts[email];
      if(!acc || acc.pw !== dHash(pw) || !demoProviders(acc).includes("password")) throw dErr("auth/invalid-credential");
      localStorage.setItem(DEMO_AUTH, acc.uid);
      user = { uid: acc.uid, email, name: db.users[acc.uid].name }; profile = db.users[acc.uid];
    },
    async signInSocial(kind){
      // Demo: giả lập tài khoản Google / Facebook trên máy này
      await delay(300);
      let email = `demo.${kind}@fitkit.local`; const db = dLoad();
      /* R3 (liên kết tài khoản): danh tính Google/Facebook/Apple giả lập đã LIÊN KẾT vào tài khoản nào → đăng nhập vào tài khoản đó */
      const linkedUid = (db.socialLinks || {})[kind];
      if(linkedUid && db.users[linkedUid] && db.accounts[db.users[linkedUid].email]) email = db.users[linkedUid].email;
      let acc = db.accounts[email];
      if(!acc){
        const uid = rid("u"); acc = db.accounts[email] = { uid, pw: dHash(rid("x")), provider: kind };
        db.users[uid] = { uid, email, name: kind==="google" ? "Bạn (Google)" : kind==="apple" ? "Bạn (Apple)" : "Bạn (Facebook)", provider: kind, isPT:false, mainRole:null, createdAt: now() };
        dSave(db);
      }
      localStorage.setItem(DEMO_AUTH, acc.uid);
      user = { uid: acc.uid, email, name: db.users[acc.uid].name }; profile = db.users[acc.uid];
    },
    async signOut(){ localStorage.removeItem(DEMO_AUTH); user = null; profile = null; },
    async resetPassword(){ await delay(); /* demo: không gửi email thật — giao diện ghi rõ "bản dùng thử" */ },
    async getUser(uid){ return dLoad().users[uid] || null; },
    async updateUser(uid, partial){ const db=dLoad(); db.users[uid] = Object.assign({}, db.users[uid], partial); dSave(db); return db.users[uid]; },
    // QS-02: id = khoá thật trong kho (không để dữ liệu ghi đè)
    async listClientsAsPT(uid){ return Object.entries(dLoad().clients).filter(([,c])=>c.ptId===uid).map(([k,c])=> Object.assign({}, c, { id:k })); },
    async listClientsAsStudent(uid){ return Object.entries(dLoad().clients).filter(([,c])=>c.studentUid===uid).map(([k,c])=> Object.assign({}, c, { id:k })); },
    async getClient(cid){ const c = dLoad().clients[cid]; return c ? Object.assign({}, c, { id: cid }) : null; },
    async createClient(data){
      const db=dLoad(); const id=rid("c"); let code; do{ code=genCode(); }while(db.joinCodes[code]);
      db.clients[id] = Object.assign({ joinCode: code, createdAt: now(), updatedAt: now() }, withoutKeys(data, LINK_KEYS), { id, studentUid:null });
      db.joinCodes[code] = { clientId:id, ptId:data.ptId }; dSave(db); return Object.assign({}, db.clients[id]);
    },
    async updateClient(cid, partial){ const db=dLoad(); if(!db.clients[cid]) throw dErr("not-found");
      const cur = db.clients[cid]; partial = withoutKeys(partial, ["id"]);
      // QS-02: không ai gắn NGƯỜI KHÁC làm học viên (kể cả PT); BUG-08: không chiếm form đã có học viên.
      // (Firebase: rules chặn hẳn client ghi studentUid ≠ null — liên kết qua Function joinByCode; demo giữ đường lời mời của cloud-social.js)
      if(partial && partial.studentUid && partial.studentUid !== cur.studentUid
         && (partial.studentUid !== (user && user.uid) || cur.studentUid)) throw dErr("permission-denied");
      db.clients[cid]=Object.assign({}, cur, partial, { id: cid, updatedAt: now() }); dSave(db); return Object.assign({}, db.clients[cid]); },
    /* = Cloud Function joinByCode (functions/social.js) trên máy này */
    async joinServer(code, clientId){
      const db=dLoad(); let cid = clientId;
      if(code != null){ const link = db.joinCodes[code]; if(!link) throw dErr("join/not-found"); cid = link.clientId; }
      const c = db.clients[cid]; if(!c) throw dErr("join/not-found");
      if(c.ptId===user.uid) throw dErr("join/self");
      if(c.studentUid && c.studentUid !== user.uid) throw dErr("join/code-taken");
      if(c.studentUid === user.uid) return Object.assign({}, c, { id: cid });
      Object.assign(c, { studentUid:user.uid, studentName:user.name, studentEmail:user.email||null, joinedAt: now(), linkedVia: code != null ? "code" : "invite", updatedAt: now() });
      dSave(db); return Object.assign({}, c, { id: cid });
    },
    async listBlocks(){ const b = (dLoad().blocks || {})[user.uid] || {}; return Object.keys(b).map(k=> Object.assign({}, b[k], { uid:k })); },
    async setBlock(other, on, info){ const db=dLoad(); db.blocks = db.blocks || {}; const b = db.blocks[user.uid] = db.blocks[user.uid] || {};
      if(on) b[other] = { uid: other, by: user.uid, at: now(), name: String((info&&info.name)||"").slice(0,80), reason: String((info&&info.reason)||"").slice(0,200) }; else delete b[other]; dSave(db); },
    async deleteClient(cid){ const db=dLoad(); const c=db.clients[cid]; if(c) delete db.joinCodes[c.joinCode]; delete db.clients[cid]; delete db.sessions[cid]; delete db.notes[cid]; dSave(db); },
    async lookupCode(code){ return dLoad().joinCodes[code] || null; },
    async listSessions(cid){ return Object.values(dLoad().sessions[cid]||{}); },
    async saveSession(cid, s){ const db=dLoad(); db.sessions[cid]=db.sessions[cid]||{}; const id=s.id||rid("s"); db.sessions[cid][id]=Object.assign({}, db.sessions[cid][id]||{createdAt:now()}, s, { id, updatedAt: now() }); dSave(db); return db.sessions[cid][id]; },
    async deleteSession(cid, sid){ const db=dLoad(); if(db.sessions[cid]) delete db.sessions[cid][sid]; dSave(db); },
    async listNotes(cid){ return Object.values(dLoad().notes[cid]||{}); },
    async addNote(cid, n){ const db=dLoad(); db.notes[cid]=db.notes[cid]||{}; const id=rid("n"); db.notes[cid][id]=Object.assign({ id, ts: now() }, n); dSave(db); return db.notes[cid][id]; },
    async deleteAccount(pw){
      if(!user) throw dErr("auth/requires-recent-login");   // BUG-16: chưa đăng nhập → lỗi tiếng Việt thay vì TypeError
      const db=dLoad(); const acc=db.accounts[user.email];
      if(!acc || (demoProviders(acc).includes("password") && acc.pw!==dHash(pw))) throw dErr("auth/wrong-password");
      Object.values(db.clients).forEach(c=>{
        if(c.ptId===user.uid){ delete db.joinCodes[c.joinCode]; delete db.clients[c.id]; delete db.sessions[c.id]; delete db.notes[c.id]; }
        else if(c.studentUid===user.uid){ Object.assign(c, { studentUid:null, studentName:null, studentEmail:null }); }
      });
      if(db.blocks) delete db.blocks[user.uid];
      /* R3: xoá cả số điện thoại / liên kết mạng xã hội giả lập, nhật ký đồng ý và bản sao lưu dữ liệu tập trên "máy chủ giả" */
      if(db.phones) Object.keys(db.phones).forEach(k=>{ if(db.phones[k] === user.uid) delete db.phones[k]; });
      if(db.socialLinks) Object.keys(db.socialLinks).forEach(k=>{ if(db.socialLinks[k] === user.uid) delete db.socialLinks[k]; });
      if(db.consents) delete db.consents[user.uid];
      try{ demoStateStore.purge(user.uid); }catch(e){}
      delete db.users[user.uid]; delete db.accounts[user.email]; dSave(db);
      localStorage.removeItem(DEMO_AUTH); user=null; profile=null;
    },
  };

  /* =====================================================================
     ĐỘNG CƠ FIREBASE (Auth + Firestore, SDK compat tải từ gstatic)
     ===================================================================== */
  function loadScript(src){
    return new Promise((res, rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=()=>rej(new Error("Không tải được "+src)); document.head.appendChild(s); });
  }
  /* QS-02: id ĐẶT SAU dữ liệu → trường "id" trong tài liệu (kẻ tấn công tự ghi) không ghi đè được doc.id thật */
  const docData = d => d.exists ? Object.assign({}, d.data(), { id: d.id }) : null;
  const qData = q => q.docs.map(d=> Object.assign({}, d.data(), { id: d.id }));

  /* Cloud Functions (callable, asia-southeast1) — dùng chung: cloud.fn(name, data) */
  async function callFn(name, data){
    if(!firebase.functions) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-functions-compat.js`);
    const res = await firebase.app().functions("asia-southeast1").httpsCallable(name)(data || {});
    return res ? res.data : null;
  }
  /* Function chưa triển khai (chủ app chưa deploy) → mã not-found / unimplemented / internal (CORS) */
  const fnMissing = e => /^(functions\/)?(not-found|unimplemented|internal)$/.test(String(e && e.code || ""));

  /* ---- Đăng nhập Google / Facebook ----
     · Web / PWA: cửa sổ popup của Firebase (tự chuyển sang redirect nếu bị chặn)
     · App iOS/Android (Capacitor): plugin @capacitor-firebase/authentication đăng nhập bằng SDK gốc,
       rồi đưa token cho Firebase JS (skipNativeAuth). Xem README-store.md mục "Đăng nhập Google/Facebook". */
  function isNative(){ return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); }
  function nativeAuthPlugin(){ return isNative() && window.Capacitor.Plugins ? Capacitor.Plugins.FirebaseAuthentication : null; }
  /* Thông tin Apple của lần xác thực gần nhất → thu hồi token khi xoá tài khoản (App Store 5.1.1(v)) */
  let lastAppleGrant = null;
  async function socialCredentialSignIn(kind, reauthUser, linkUser){
    if(isNative()){
      const P = nativeAuthPlugin();
      if(!P) throw dErr("social/not-configured");
      const res = kind==="google" ? await P.signInWithGoogle() : kind==="apple" ? await P.signInWithApple() : await P.signInWithFacebook();
      const c = res && res.credential || {};
      // iOS: plugin trả authorizationCode (dùng 1 lần, hết hạn 5 phút) — Firebase chỉ dùng idToken+nonce nên mã vẫn còn hiệu lực
      if(kind==="apple") lastAppleGrant = { authorizationCode: c.authorizationCode || null, accessToken: c.accessToken || null, platform: Capacitor.getPlatform ? Capacitor.getPlatform() : "ios" };
      const credential = kind==="google"
        ? firebase.auth.GoogleAuthProvider.credential(c.idToken || null, c.accessToken || null)
        : kind==="apple"
        ? new firebase.auth.OAuthProvider("apple.com").credential({ idToken: c.idToken, rawNonce: c.nonce })
        : firebase.auth.FacebookAuthProvider.credential(c.accessToken);
      /* R3 (liên kết): app native dùng skipNativeAuth → lấy credential từ SDK gốc rồi liên kết ở lớp JS (không dùng P.linkWith…) */
      if(linkUser) return linkUser.linkWithCredential(credential);
      return reauthUser ? reauthUser.reauthenticateWithCredential(credential) : fb.auth.signInWithCredential(credential);
    }
    const provider = kind==="google" ? new firebase.auth.GoogleAuthProvider() : kind==="apple" ? new firebase.auth.OAuthProvider("apple.com") : new firebase.auth.FacebookAuthProvider();
    provider.addScope("email"); if(kind==="apple") provider.addScope("name");
    if(kind==="google") provider.setCustomParameters({ prompt:"select_account" });
    if(linkUser){
      try{ return await linkUser.linkWithPopup(provider); }
      catch(e){ if(e && e.code==="auth/popup-blocked"){ await linkUser.linkWithRedirect(provider); return new Promise(()=>{}); } throw e; }
    }
    if(reauthUser){
      const r = await reauthUser.reauthenticateWithPopup(provider);
      if(kind==="apple") lastAppleGrant = { accessToken: (r && r.credential && r.credential.accessToken) || null, platform: "web" };
      return r;
    }
    try{ return await fb.auth.signInWithPopup(provider); }
    catch(e){
      if(e && e.code==="auth/popup-blocked"){ await fb.auth.signInWithRedirect(provider); return new Promise(()=>{}); }
      /* R3 (liên kết): email đã có tài khoản bằng cách khác → giữ credential, tự liên kết sau lần đăng nhập đúng cách cũ kế tiếp */
      if(e && e.code==="auth/account-exists-with-different-credential" && e.credential){
        pendingLink = { credential: e.credential, email: String(e.email || (e.customData && e.customData.email) || "").toLowerCase(), kind, at: now() };
      }
      throw e;
    }
  }
  let pendingLink = null;
  /** Sau khi đăng nhập thành công: nếu có credential đang chờ (≤ 10 phút, cùng email) → liên kết vào tài khoản hiện tại */
  async function applyPendingLink(){
    const p = pendingLink; pendingLink = null; lastAutoLinked = null;
    if(!p || !fb || !fb.auth.currentUser || now() - p.at > 10*60000) return;
    const u = fb.auth.currentUser;
    if(p.email && String(u.email||"").toLowerCase() !== p.email) return;
    try{ await u.linkWithCredential(p.credential); lastAutoLinked = p.kind; }catch(e){ console.warn("Không tự liên kết được:", e && e.code); }
  }
  let lastAutoLinked = null;

  /* Gọi Cloud Function thu hồi token Apple — lỗi KHÔNG chặn việc xoá tài khoản (functions/apple.js) */
  function takeAppleGrant(){ const g = lastAppleGrant; lastAppleGrant = null; return g && (g.authorizationCode || g.accessToken) ? g : null; }
  async function revokeAppleIfNeeded(){
    const g = takeAppleGrant();
    if(!g || !(g.authorizationCode || g.accessToken)){ console.warn("Không có mã Apple để thu hồi token"); return false; }
    try{
      if(!firebase.functions) await loadScript(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-functions-compat.js`);
      const res = await firebase.app().functions("asia-southeast1").httpsCallable("revokeAppleToken")(g);
      return !!(res && res.data && res.data.revoked);
    }catch(e){ console.warn("Thu hồi token Apple thất bại:", e); return false; }
  }
  /* Hồ sơ users/{uid} không chứa email (rule cho phép học viên đọc hồ sơ PT) — xoá email ở hồ sơ cũ */
  function stripEmail(uid, p){
    if(p && "email" in p){
      try{ fb.db.collection("users").doc(uid).update({ email: firebase.firestore.FieldValue.delete() }).catch(()=>{}); }catch(e){}
      p = Object.assign({}, p); delete p.email;
    }
    return p;
  }

  const firebaseEngine = {
    async init(){
      const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
      /* R3-CLOUD-01: init có thể chạy LẠI (retryInit khi có mạng) → không nạp trùng script, không initializeApp 2 lần */
      if(typeof firebase === "undefined" || !firebase.initializeApp) await loadScript(`${base}/firebase-app-compat.js`);
      await Promise.all([firebase.auth ? null : loadScript(`${base}/firebase-auth-compat.js`), firebase.firestore ? null : loadScript(`${base}/firebase-firestore-compat.js`)]);
      if(!(firebase.apps || []).some(a=> a.name === "[DEFAULT]")) firebase.initializeApp(FIREBASE_CONFIG);
      fb = { auth: firebase.auth(), db: firebase.firestore() };
      try{ await fb.db.enablePersistence({ synchronizeTabs:true }); }catch(e){ /* chạy tiếp không cache offline */ }
      // Hoàn tất đăng nhập Google/Facebook kiểu redirect (khi popup bị chặn): tạo hồ sơ nếu chưa có
      try{ const rr = await fb.auth.getRedirectResult(); if(rr && rr.user && !(await firebaseEngine.getUser(rr.user.uid))){ const pid=(rr.additionalUserInfo&&rr.additionalUserInfo.providerId)||"google.com"; await fb.db.collection("users").doc(rr.user.uid).set({ uid:rr.user.uid, name:rr.user.displayName||"Bạn", photo:rr.user.photoURL||null, provider: pid.startsWith("facebook")?"facebook":pid.startsWith("apple")?"apple":"google", isPT:false, mainRole:null, createdAt: now() }); } }catch(e){}
      await new Promise(resolve=>{
        let first = true;
        fb.auth.onAuthStateChanged(async u=>{
          if(u){
            user = { uid:u.uid, email:u.email, name:u.displayName || (u.email||"").split("@")[0] };
            // Lúc vừa đăng ký, doc users/{uid} có thể chưa ghi xong → không ghi đè profile bằng null
            let p = null; try{ p = stripEmail(u.uid, await firebaseEngine.getUser(u.uid)); }catch(e){}
            if(p || !profile || profile.uid!==u.uid) profile = p;
          } else { user = null; profile = null; }
          if(first){ first=false; resolve(); } else emit();
        });
      });
    },
    async signUp(email, pw, name){
      const cred = await fb.auth.createUserWithEmailAndPassword(String(email).trim(), pw);
      try{ await cred.user.updateProfile({ displayName: name }); }catch(e){}
      // QS-14: lời mời PT theo email chỉ nhận bằng email ĐÃ XÁC MINH → gửi thư xác minh ngay khi đăng ký
      try{ await cred.user.sendEmailVerification(); }catch(e){}
      const doc = { uid: cred.user.uid, name: name || cred.user.email.split("@")[0], isPT:false, mainRole:null, createdAt: now() };
      await fb.db.collection("users").doc(cred.user.uid).set(doc);
      user = { uid: doc.uid, email: cred.user.email, name: doc.name }; profile = doc;
    },
    async signIn(email, pw){
      const cred = await fb.auth.signInWithEmailAndPassword(String(email).trim(), pw);
      user = { uid: cred.user.uid, email: cred.user.email, name: cred.user.displayName || cred.user.email.split("@")[0] };
      profile = stripEmail(cred.user.uid, await firebaseEngine.getUser(cred.user.uid));
      if(!profile){ profile = { uid:user.uid, name:user.name, isPT:false, mainRole:null, createdAt: now() }; await fb.db.collection("users").doc(user.uid).set(profile); }
      await applyPendingLink();
    },
    async signInSocial(kind){
      const cred = await socialCredentialSignIn(kind);
      const u = cred.user;
      user = { uid: u.uid, email: u.email || "", name: u.displayName || (u.email||"").split("@")[0] || "Bạn" };
      profile = stripEmail(u.uid, await firebaseEngine.getUser(u.uid));
      if(!profile){
        profile = { uid:user.uid, name:user.name, photo:u.photoURL||null, provider:kind, isPT:false, mainRole:null, createdAt: now() };
        await fb.db.collection("users").doc(user.uid).set(profile);
      }
      await applyPendingLink();
    },
    async signOut(){
      await fb.auth.signOut(); user=null; profile=null;
      try{ const P = nativeAuthPlugin(); if(P) await P.signOut(); }catch(e){}
    },
    async resetPassword(email){ await fb.auth.sendPasswordResetEmail(String(email).trim()); },
    async getUser(uid){ return docData(await fb.db.collection("users").doc(uid).get()); },
    async updateUser(uid, partial){ await fb.db.collection("users").doc(uid).set(partial, { merge:true }); return firebaseEngine.getUser(uid); },
    async listClientsAsPT(uid){ return qData(await fb.db.collection("clients").where("ptId","==",uid).get()); },
    async listClientsAsStudent(uid){ return qData(await fb.db.collection("clients").where("studentUid","==",uid).get()); },
    async getClient(cid){ return docData(await fb.db.collection("clients").doc(cid).get()); },
    async createClient(data){
      let code, tries=0;
      do{ code=genCode(); tries++; }while(tries<6 && (await fb.db.collection("joinCodes").doc(code).get()).exists);
      const ref = fb.db.collection("clients").doc();
      // QS-02: rules từ chối form có sẵn học viên / trường "id" — bỏ trước khi ghi
      const doc = Object.assign({ joinCode: code, createdAt: now(), updatedAt: now() }, withoutKeys(data, LINK_KEYS), { studentUid:null });
      const batch = fb.db.batch();
      batch.set(ref, doc);
      batch.set(fb.db.collection("joinCodes").doc(code), { clientId: ref.id, ptId: data.ptId });
      await batch.commit();
      return Object.assign({}, doc, { id: ref.id });
    },
    async updateClient(cid, partial){ await fb.db.collection("clients").doc(cid).update(Object.assign(withoutKeys(partial, ["id"]), { updatedAt: now() })); return firebaseEngine.getClient(cid); },
    async joinServer(code, clientId){
      try{ const r = await callFn("joinByCode", code != null ? { code } : { clientId }); return r && r.id ? Object.assign({}, r, { id: String(r.id) }) : firebaseEngine.getClient(clientId); }
      catch(e){
        const c = String(e && e.code || "").replace(/^functions\//, "");
        if(c === "already-exists") throw dErr("join/code-taken");
        if(fnMissing(e)) throw dErr("Máy chủ chưa bật chức năng kết nối PT (Cloud Function joinByCode). Báo chủ app triển khai Functions.");
        throw e;
      }
    },
    async listBlocks(){ return qData(await fb.db.collection("blocks").doc(user.uid).collection("list").get()); },
    async setBlock(other, on, info){
      const ref = fb.db.collection("blocks").doc(user.uid).collection("list").doc(other);
      if(on) await ref.set({ uid: other, by: user.uid, at: now(), name: String((info&&info.name)||"").slice(0,80), reason: String((info&&info.reason)||"").slice(0,200) });
      else await ref.delete();
    },
    async deleteClient(cid){
      const ref = fb.db.collection("clients").doc(cid);
      const c = docData(await ref.get());
      for(const sub of ["sessions","notes"]){
        const snap = await ref.collection(sub).get();
        await Promise.all(snap.docs.map(d=>d.ref.delete()));
      }
      if(c && c.joinCode) await fb.db.collection("joinCodes").doc(c.joinCode).delete().catch(()=>{});
      await ref.delete();
    },
    async lookupCode(code){ return docData(await fb.db.collection("joinCodes").doc(code).get()); },
    async listSessions(cid){ return qData(await fb.db.collection("clients").doc(cid).collection("sessions").get()); },
    async saveSession(cid, s){
      const col = fb.db.collection("clients").doc(cid).collection("sessions");
      const ref = s.id ? col.doc(s.id) : col.doc();
      const data = Object.assign({}, s, { updatedAt: now() }); delete data.id;
      if(!s.id) data.createdAt = now();
      await ref.set(data, { merge:true });
      return Object.assign({ id: ref.id }, data);
    },
    async deleteSession(cid, sid){ await fb.db.collection("clients").doc(cid).collection("sessions").doc(sid).delete(); },
    async listNotes(cid){ return qData(await fb.db.collection("clients").doc(cid).collection("notes").get()); },
    async addNote(cid, n){ const ref = await fb.db.collection("clients").doc(cid).collection("notes").add(Object.assign({ ts: now() }, n)); return Object.assign({ id: ref.id, ts: now() }, n); },
    async deleteAccount(pw){
      const u = fb.auth.currentUser;
      if(!u) throw dErr("auth/requires-recent-login");   // BUG-16
      /* R3-CLOUD-07: tài khoản có NHIỀU cách đăng nhập (liên kết) — có mật khẩu thì xác thực bằng mật khẩu; không thì dùng cách mạng xã hội đầu tiên
         (trước đây chỉ nhìn providerData[0] → tài khoản Google + mật khẩu bị hỏi sai cách / tài khoản chỉ có SĐT gọi nhầm Google) */
      const pids = (u.providerData || []).map(p=> p.providerId);
      const social = pids.find(x=> /^(google|facebook|apple)\.com$/.test(x));
      const pid = (pids.includes("password") && (pw || !social)) ? "password" : (social || pids[0] || "password");
      if(pid === "password") await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw));
      else if(pid === "phone") throw dErr("auth/requires-recent-login");
      else await socialCredentialSignIn(pid.startsWith("facebook") ? "facebook" : pid.startsWith("apple") ? "apple" : "google", u);   // xác thực lại bằng Google/Facebook/Apple
      // QS-10/QS-21: máy chủ xoá TOÀN BỘ dữ liệu gắn với tài khoản + chặn Owner + thu hồi Apple, rồi xoá Auth
      const apple = pid.startsWith("apple") ? takeAppleGrant() : null;
      try{
        await callFn("deleteMyAccount", apple ? { apple } : {});
        try{ await fb.auth.signOut(); }catch(e){}
        try{ const P = nativeAuthPlugin(); if(P) await P.signOut(); }catch(e){}
        user=null; profile=null; blockCache = null;
        return;
      }catch(e){ if(!fnMissing(e)) throw e; console.warn("deleteMyAccount chưa triển khai — xoá phía máy khách (thiếu dữ liệu cộng đồng/sự kiện):", e); }
      // Dự phòng khi chưa deploy Functions: KHÔNG cho Owner tự xoá (app sẽ mất Chủ sở hữu — QS-21)
      try{ const r = await fb.db.collection("roles").doc(u.uid).get(); if(r.exists && (r.data()||{}).role === "owner") throw dErr("owner/must-transfer"); }
      catch(e){ if(e && e.code === "owner/must-transfer") throw e; }
      // Apple 5.1.1(v): thu hồi token Sign in with Apple TRƯỚC khi xoá user (callable cần user còn đăng nhập)
      if(apple){ lastAppleGrant = apple; await revokeAppleIfNeeded(); }
      for(const c of await firebaseEngine.listClientsAsPT(u.uid)) await firebaseEngine.deleteClient(c.id);
      for(const c of await firebaseEngine.listClientsAsStudent(u.uid)){
        await fb.db.collection("clients").doc(c.id).update({ studentUid:null, studentName:null, studentEmail:null, joinedAt:null, linkedVia:null }).catch(()=>{});
      }
      /* R3 (gói Spark không có Functions): tự xoá phần client được phép — sao lưu dữ liệu tập (appState), nhật ký đồng ý, liên hệ riêng, danh sách chặn */
      try{ await fbStateStore.purge(u.uid); }catch(e){ console.warn("Xoá sao lưu cloud:", e && e.code); }
      for(const sub of ["consents", "private"]){
        try{ const sn = await fb.db.collection("users").doc(u.uid).collection(sub).get(); await Promise.all(sn.docs.map(d=> d.ref.delete())); }catch(e){}
      }
      try{ const sn = await fb.db.collection("blocks").doc(u.uid).collection("list").get(); await Promise.all(sn.docs.map(d=> d.ref.delete())); }catch(e){}
      await fb.db.collection("users").doc(u.uid).delete();
      await u.delete();
      user=null; profile=null; blockCache = null;
    },
  };

  /* ---------------- Góp ý (feedback) — hạ tầng riêng ---------------- */
  function authTrack(ev, method){ try{ if(typeof fkTrack === "function") fkTrack(ev, { method }); }catch(e){} }
  const DEMO_FB = "fitkit_cloud_demo_feedback";
  const demoFeedback = {
    _read(){ try{ const a = JSON.parse(localStorage.getItem(DEMO_FB) || "[]"); return Array.isArray(a) ? a : []; }catch(e){ return []; } },
    _write(a){ localStorage.setItem(DEMO_FB, JSON.stringify(a.slice(-300))); },
    add(doc){ const a = demoFeedback._read(); const x = Object.assign({}, doc, { id: rid("fb"), createdAt: now() }); a.push(x); demoFeedback._write(a); return { id: x.id, server: false }; },
    list(){ return demoFeedback._read().slice().sort((a,b)=> (b.createdAt||0) - (a.createdAt||0)); },
    setStatus(id, status){ const a = demoFeedback._read(); const x = a.find(f=> f.id === id); if(x){ x.status = status; demoFeedback._write(a); } return !!x; },
  };
  let _fbAnonDb = null;
  /** Firestore để gửi góp ý: đã đăng nhập → db chính; chưa → app PHỤ đăng nhập ẩn danh (cần bật Anonymous trong Firebase Auth) */
  async function feedbackDb(){
    if(fb && fb.auth.currentUser) return fb.db;
    if(_fbAnonDb) return _fbAnonDb;
    const app2 = (firebase.apps || []).find(a=> a.name === "fk-feedback") || firebase.initializeApp(FIREBASE_CONFIG, "fk-feedback");
    const a2 = app2.auth();
    try{ await a2.setPersistence(firebase.auth.Auth.Persistence.NONE); }catch(e){}
    if(!a2.currentUser) await a2.signInAnonymously();
    _fbAnonDb = app2.firestore();
    return _fbAnonDb;
  }

  /* =====================================================================
     API CÔNG KHAI
     ===================================================================== */
  let engine = mode==="firebase" ? firebaseEngine : demo;
  let ready = null;
  let degraded = false;       // R3-CLOUD-01: có cấu hình Firebase nhưng chưa kết nối được
  let retryArmed = false;
  function armRetry(){
    if(retryArmed) return; retryArmed = true;
    try{ window.addEventListener("online", ()=>{ api.retryInit().catch(()=>{}); }); }catch(e){}
  }
  const needOnline = fn => async (...a) => { if(degraded){ try{ await api.retryInit(); }catch(e){} if(degraded) throw dErr("cloud/offline"); } return fn(...a); };
  let blockCache = null;      // Set uid đã chặn (tải lười)

  const api = {
    get mode(){ return mode; },
    get user(){ return user; },
    get profile(){ return profile; },
    isLoggedIn(){ return !!user; },
    onAuth(cb){ authListeners.push(cb); },

    /** R3.1: công tắc đăng nhập (OTP email / OTP SMS / Facebook / Apple / Google) — quản trị bật lại được bất cứ lúc nào */
    authFlags: {
      keys: AUTH_FLAG_KEYS.slice(),
      get(){ return Object.assign({}, authFlags || applyAuthFlags(readAuthFlagCache())); },
      async refresh(){
        let remote = null;
        if(mode === "firebase" && fb){ try{ const d = await fb.db.collection("settings").doc("auth").get(); remote = d.exists ? d.data() : {}; }catch(e){ remote = null; } }
        const next = remote ? cleanAuthFlags(remote) : readAuthFlagCache();
        if(remote){ try{ localStorage.setItem(AUTH_FLAG_LS, JSON.stringify(next)); }catch(e){} }
        authFlags = applyAuthFlags(next); return Object.assign({}, authFlags);
      },
      async save(partial){
        const next = Object.assign({}, cleanAuthFlags(authFlags || {}), cleanAuthFlags(partial));
        if(mode === "firebase" && fb){
          if(!user) throw niceError({ code: "auth/requires-login" });
          try{ await fb.db.collection("settings").doc("auth").set(Object.assign({}, next, { updatedAt: Date.now(), updatedBy: user.uid })); }catch(e){ throw niceError(e); }
        }
        try{ localStorage.setItem(AUTH_FLAG_LS, JSON.stringify(next)); }catch(e){}
        authFlags = applyAuthFlags(next); return Object.assign({}, authFlags);
      },
    },

    init(){
      if(ready) return ready;
      ready = (async ()=>{
        try{ applyAuthFlags(readAuthFlagCache()); }catch(e){}
        try{ await engine.init(); }
        catch(e){
          /* R3-CLOUD-01: ĐÃ cấu hình Firebase mà không khởi động được (mất mạng lúc mở app, gstatic bị chặn) → vẫn chạy bằng động cơ demo để
             các module không vỡ, nhưng đánh dấu "degraded": KHÔNG cho đăng ký/đăng nhập vào máy chủ giả (tránh tài khoản/dữ liệu "ma" chỉ nằm
             trên máy mà người dùng tưởng đã lên cloud); có mạng lại → cloud.retryInit() (tự gọi khi sự kiện online). */
          console.warn("Firebase không khởi động được, tạm chạy ngoại tuyến:", e);
          degraded = hasConfig;
          mode = "demo"; engine = demo;
          if(degraded){ user = null; profile = null; armRetry(); } else await demo.init();
        }
        try{ api.authFlags.refresh().then(()=>{ try{ if(typeof document !== "undefined") document.dispatchEvent(new CustomEvent("fk:authflags")); }catch(e){} }).catch(()=>{}); }catch(e){}
        return user;
      })();
      return ready;
    },

    // Thống kê ẩn danh (analytics.js): chỉ ghi PHƯƠNG THỨC đăng nhập — không email/uid; tắt đồng ý → fkTrack bỏ qua
    signUp: wrap(needOnline(async (email, pw, name)=>{ await engine.signUp(email, pw, name); emit(); authTrack("signup", "email"); return user; })),
    signIn: wrap(needOnline(async (email, pw)=>{ await engine.signIn(email, pw); emit(); authTrack("login", "email"); return user; })),
    signInWithGoogle: wrap(needOnline(async ()=>{ await engine.signInSocial("google"); emit(); authTrack("login", "google"); return user; })),
    signInWithFacebook: wrap(needOnline(async ()=>{ await engine.signInSocial("facebook"); emit(); authTrack("login", "facebook"); return user; })),
    signInWithApple: wrap(needOnline(async ()=>{ await engine.signInSocial("apple"); emit(); authTrack("login", "apple"); return user; })),
    /* R3: "tài khoản mạng xã hội" = KHÔNG có mật khẩu trong các cách đăng nhập hiện tại (trước đây đọc profile.provider — sai sau khi liên kết/đặt mật khẩu) */
    get isSocialUser(){ return !!user && !myProviders().includes("password"); },
    get hasPassword(){ return !!user && myProviders().includes("password"); },
    /** Đã xác thực số điện thoại? (NĐ 147/2024: chỉ tài khoản đã xác thực SĐT mới được đăng bài/bình luận — module Cộng đồng dùng khi bật cờ phoneOtp) */
    get phoneVerified(){ return !!user && myProviders().includes("phone"); },
    get degraded(){ return degraded; },
    /** Có cấu hình Firebase nhưng lúc mở app chưa kết nối được → thử lại (tự gọi khi có mạng). Trả true nếu đã vào chế độ firebase. */
    retryInit(){
      if(!degraded) return Promise.resolve(mode === "firebase");
      if(api._retrying) return api._retrying;
      api._retrying = (async ()=>{
        try{ await firebaseEngine.init(); mode = "firebase"; engine = firebaseEngine; degraded = false; emit(); return true; }
        catch(e){ return false; }
        finally{ api._retrying = null; }
      })();
      return api._retrying;
    },
    /* R3: đăng xuất → cố đẩy nốt thay đổi chưa sao lưu (tối đa 3 giây) rồi mới thoát; dữ liệu trên máy GIỮ NGUYÊN */
    signOut: wrap(async ()=>{ try{ await sync.flush(3000); }catch(e){} await engine.signOut(); blockCache = null; sync._reset(); emit(); }),
    deleteAccount: wrap(async pw=>{ if(!user) throw dErr("auth/requires-recent-login"); const uid = user.uid; await engine.deleteAccount(pw); try{ consent._forget(uid); sync._afterDelete(uid); }catch(e){} emit(); }),

    updateMyProfile: wrap(async partial=>{
      if(!user) throw new Error("Chưa đăng nhập.");
      profile = await engine.updateUser(user.uid, partial);
      if(partial.name) user.name = partial.name;
      return profile;
    }),

    getUser: wrap(uid=> engine.getUser(uid)),

    /* ---- PT ↔ Học viên ---- */
    myClientsAsPT: wrap(async ()=> user ? (await engine.listClientsAsPT(user.uid)).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)) : []),
    myCoaches: wrap(async ()=> user ? (await engine.listClientsAsStudent(user.uid)).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)) : []),
    getClient: wrap(cid=> engine.getClient(cid)),
    createClient: wrap(async data=>{
      if(!user) throw new Error("Chưa đăng nhập.");
      return engine.createClient(Object.assign({}, data, { ptId: user.uid, ptName: (profile && profile.brandName) || user.name, remindBefore: 60 }));
    }),
    updateClient: wrap((cid, partial)=> engine.updateClient(cid, partial)),
    deleteClient: wrap(cid=> engine.deleteClient(cid)),
    /* QS-02/QS-14: học viên TỰ nhập mã → máy chủ (Function joinByCode: giới hạn 10 lần/giờ, ghi joinedAt + dòng hệ thống) gắn vào form.
       Firestore rules không còn cho client tự ghi studentUid. */
    joinByCode: wrap(async raw=>{
      if(!user) throw new Error("Chưa đăng nhập.");
      const code = normCode(raw);
      if(code.length < 6 || code.length > 10) throw dErr("join/bad-code");
      const link = await engine.lookupCode(code);
      if(!link) throw new Error("Mã không đúng hoặc đã bị xoá. Hỏi lại PT của bạn nhé.");
      if(link.ptId===user.uid) throw new Error("Đây là mã do chính bạn tạo cho học viên.");
      try{ return await engine.joinServer(code); }
      catch(e){
        if(e && e.code === "join/self") throw new Error("Đây là mã do chính bạn tạo cho học viên.");
        if(e && e.code === "join/not-found") throw new Error("Mã không đúng hoặc đã bị xoá. Hỏi lại PT của bạn nhé.");
        if(e && (e.code === "permission-denied" || /permission/i.test(e.message||""))) throw dErr("join/code-taken");
        throw e;
      }
    }),
    /* Chấp nhận lời mời theo email (Function kiểm email ĐÃ XÁC MINH + lời mời đang chờ) */
    acceptInviteForm: wrap(async clientId=>{ if(!user) throw new Error("Chưa đăng nhập."); return engine.joinServer(null, String(clientId||"")); }),
    leaveCoach: wrap(cid=> engine.updateClient(cid, { studentUid:null, studentName:null, studentEmail:null, joinedAt:null, linkedVia:null })),

    /* ---- Chặn người dùng (App Store Guideline 1.2) — rules: người bị chặn không nhắn tin / gửi yêu cầu / bình luận cho mình ---- */
    blockUser: wrap(async (otherUid, info)=>{
      if(!user) throw new Error("Chưa đăng nhập.");
      otherUid = String(otherUid||""); if(!otherUid || otherUid === user.uid) throw new Error("Không thể chặn tài khoản này.");
      await engine.setBlock(otherUid, true, info); if(blockCache) blockCache.add(otherUid); return true;
    }),
    unblockUser: wrap(async otherUid=>{ if(!user) throw new Error("Chưa đăng nhập."); await engine.setBlock(String(otherUid||""), false); if(blockCache) blockCache.delete(String(otherUid||"")); return true; }),
    listBlocked: wrap(async ()=>{ if(!user) return []; const l = await engine.listBlocks(); blockCache = new Set(l.map(b=> b.uid)); return l.sort((a,b)=>(b.at||0)-(a.at||0)); }),
    isBlocked: async otherUid=>{ if(!user || !otherUid) return false; if(!blockCache){ try{ await api.listBlocked(); }catch(e){ return false; } } return !!(blockCache && blockCache.has(String(otherUid))); },
    /** isBlockedBy(a, b): a đã chặn b? Client chỉ đọc được danh sách CỦA MÌNH (rules) → a phải là mình; trường hợp khác máy chủ (rules) tự chặn → false */
    isBlockedBy: async (a, b)=>{ if(!user || String(a||"") !== user.uid) return false; return api.isBlocked(b); },
    /** Đồng bộ (sau khi đã tải listBlocked) — lọc nội dung khi vẽ */
    isBlockedSync: otherUid=> !!(blockCache && otherUid && blockCache.has(String(otherUid))),

    /** Gọi Cloud Function (callable). Chế độ demo → lỗi "functions/unavailable" để module dùng đường dự phòng */
    fn: async (name, data)=>{
      if(mode !== "firebase"){ const e = new Error("Chế độ demo không có máy chủ."); e.code = "functions/unavailable"; throw e; }
      try{ return await callFn(name, data); }catch(e){ throw niceError(e); }
    },
    /** Email đã xác minh? (lời mời PT theo email cần email đã xác minh — QS-14) */
    get emailVerified(){ try{ return mode !== "firebase" || !!(fb && fb.auth.currentUser && fb.auth.currentUser.emailVerified); }catch(e){ return false; } },
    sendVerifyEmail: wrap(async ()=>{ if(mode === "firebase" && fb && fb.auth.currentUser) await fb.auth.currentUser.sendEmailVerification(); return true; }),

    /* ---- Góp ý & NPS (feedback.js · docs/FEEDBACK.md) ----
       Firestore `feedback/{id}`: CHỈ TẠO (rules kiểm trường/kích thước), đọc chỉ quản trị (support.tickets).
       Không lưu uid: chưa đăng nhập → đăng nhập ẩn danh trên 1 app Firebase PHỤ ("fk-feedback") để không đổi phiên của app.
       Chế độ demo → lưu "máy chủ giả" trên máy này (bảng quản trị demo đọc được). Lỗi mạng → ném lỗi để feedback.js xếp hàng offline. */
    feedback: {
      submit: wrap(async doc=>{
        if(mode !== "firebase") return demoFeedback.add(doc);
        const db = await feedbackDb();
        const ref = await db.collection("feedback").add(Object.assign({}, doc, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
        return { id: ref.id, server: true };
      }),
      list: wrap(async (limit)=>{
        if(mode !== "firebase") return demoFeedback.list();
        const snap = await fb.db.collection("feedback").orderBy("createdAt", "desc").limit(Math.min(500, Number(limit) || 300)).get();
        return snap.docs.map(d=>{ const x = d.data() || {}; const c = x.createdAt; return Object.assign({}, x, { id: d.id, createdAt: c && c.toMillis ? c.toMillis() : Number(c) || 0 }); });
      }),
      setStatus: wrap(async (id, status)=>{
        if(!["new", "seen", "done"].includes(status)) throw new Error("Trạng thái không hợp lệ.");
        if(mode !== "firebase") return demoFeedback.setStatus(id, status);
        await fb.db.collection("feedback").doc(String(id)).update({ status });
        return true;
      }),
    },

    listSessions: wrap(async cid=> (await engine.listSessions(cid)).sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time))),
    saveSession: wrap((cid, s)=> engine.saveSession(cid, s)),
    deleteSession: wrap((cid, sid)=> engine.deleteSession(cid, sid)),
    listNotes: wrap(async cid=> (await engine.listNotes(cid)).sort((a,b)=>(a.ts||0)-(b.ts||0))),
    addNote: wrap((cid, text, role, kind="note")=> engine.addNote(cid, { authorUid:user.uid, authorRole:role, authorName:user.name, text, kind })),
  };
  /* =====================================================================
     R3 (14/11/2026 · docs/qa/R3-cloud.md) — TÀI KHOẢN "THỰC CHIẾN"
     A. Quên mật khẩu: link email (trung tính, chờ 60 s) · OTP email (cờ emailOtp) · OTP số điện thoại (cờ phoneOtp)
     B. Tài khoản liên kết: Google / Facebook / Apple / mật khẩu / số điện thoại — luôn giữ ≥ 1 cách đăng nhập
     C. Sao lưu dữ liệu tập luyện – dinh dưỡng (fitkit_state_v1) theo tài khoản: users/{uid}/appState/{meta,c0…}
     D. Nhật ký đồng ý (users/{uid}/consents) · Xuất dữ liệu của tôi (JSON)
     ===================================================================== */
  const PROVIDER_ID = { password:"password", google:"google.com", facebook:"facebook.com", apple:"apple.com", phone:"phone" };
  const PROVIDER_LABEL = { password:"Email & mật khẩu", google:"Google", facebook:"Facebook", apple:"Apple", phone:"Số điện thoại" };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const normEmail = e => String(e || "").trim().toLowerCase();
  const uniq = a => a.filter((x, i)=> a.indexOf(x) === i);
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const sixDigits = () => String(randIdx(1000000)).padStart(6, "0");
  function withTimeout(p, ms, code){
    return new Promise((res, rej)=>{
      const t = setTimeout(()=> rej(dErr(code || "deadline-exceeded")), ms);
      Promise.resolve(p).then(v=>{ clearTimeout(t); res(v); }, e=>{ clearTimeout(t); rej(e); });
    });
  }
  Object.assign(ERR, {
    "sync/too-big": "Dữ liệu quá lớn để sao lưu lên cloud. Hãy xoá bớt nhật ký cũ hoặc ảnh đại diện rồi thử lại.",
    "sync/torn": "Bản sao lưu trên cloud đang được ghi dở từ thiết bị khác. TapEasy sẽ tự thử lại sau.",
    "sync/no-backup": "Không có bản lưu tạm nào trên máy này.",
  });

  /** Các cách đăng nhập của tài khoản demo: providers (mới) hoặc provider (cũ) + số điện thoại đã liên kết */
  function demoProviders(acc){
    if(!acc) return [];
    const l = Array.isArray(acc.providers) && acc.providers.length ? acc.providers.slice() : [acc.provider || "password"];
    if(acc.phone && !l.includes("phone")) l.push("phone");
    return uniq(l);
  }
  const demoAcc = db => user ? db.accounts[user.email] : null;
  const demoBaseProviders = acc => demoProviders(acc).filter(x=> x !== "phone");
  function myProviders(){
    try{
      if(!user) return [];
      if(mode === "firebase"){
        const u = fb && fb.auth.currentUser;
        return u ? uniq((u.providerData || []).map(p=> Object.keys(PROVIDER_ID).find(k=> PROVIDER_ID[k] === p.providerId) || p.providerId)) : [];
      }
      return demoProviders(demoAcc(dLoad()));
    }catch(e){ return []; }
  }
  /* Demo: danh tính Google/Facebook/Apple giả lập bị HUỶ liên kết khỏi tài khoản gốc → đăng nhập lại bằng nó phải báo "đã đăng ký bằng cách khác" */
  const _demoSocial = demo.signInSocial;
  demo.signInSocial = async function(kind){
    const db = dLoad(); const linkedUid = (db.socialLinks || {})[kind];
    const acc = linkedUid && db.users[linkedUid] ? db.accounts[db.users[linkedUid].email] : db.accounts[`demo.${kind}@fitkit.local`];
    if(acc && !demoProviders(acc).includes(kind)) throw dErr("auth/account-exists-with-different-credential");
    return _demoSocial.call(demo, kind);
  };

  /* ---------------- Giới hạn bấm lại 60 giây (gửi link / gửi mã) — theo từng email / số điện thoại, lưu trên máy ---------------- */
  const CD_KEY = "fitkit_cooldown_v1", CD_SEC = 60;
  function cdRead(){ try{ const o = JSON.parse(localStorage.getItem(CD_KEY) || "{}"); return isObj(o) ? o : {}; }catch(e){ return {}; } }
  function cdLeft(key){ const t = Number(cdRead()[dHash(key)]) || 0; return Math.max(0, Math.ceil((t + CD_SEC*1000 - now()) / 1000)); }
  function cdMark(key){
    const o = cdRead(), n = now();
    Object.keys(o).forEach(k=>{ if(n - Number(o[k]) > 3600000) delete o[k]; });
    o[dHash(key)] = n;
    try{ localStorage.setItem(CD_KEY, JSON.stringify(o)); }catch(e){}
  }
  function cdGuard(key){
    const left = cdLeft(key);
    if(left > 0){ const e = new Error(`Vui lòng đợi ${left} giây rồi gửi lại.`); e.code = "cooldown"; e.waitSec = left; throw e; }
  }

  /* ---------------- A1. Quên mật khẩu qua email (link) ----------------
     · Thông báo TRUNG TÍNH: email có/không có tài khoản đều trả { sent:true } (chống dò email — R3-CLOUD-03)
     · Mỗi email 60 giây / lần · demo: không gửi thật → simulated:true (giao diện ghi rõ "bản dùng thử") */
  api.resetPassword = wrap(needOnline(async rawEmail=>{
    const email = normEmail(rawEmail);
    if(!EMAIL_RE.test(email)) throw dErr("auth/invalid-email");
    cdGuard("reset:" + email);
    try{ await engine.resetPassword(email); }
    catch(e){ if(!(e && (e.code === "auth/user-not-found" || e.code === "auth/user-disabled"))) throw e; }
    cdMark("reset:" + email);
    return { sent: true, simulated: mode !== "firebase", waitSec: CD_SEC };
  }));
  /** Còn bao nhiêu giây mới gửi lại được? kind: "reset" | "otp" | "sms" */
  api.resendWait = (kind, id)=> cdLeft(String(kind || "reset") + ":" + (kind === "sms" ? String(id || "") : normEmail(id)));

  /* ---------------- A3. OTP 6 số qua email (cờ FK_FEATURES.emailOtp) ----------------
     Firebase: Cloud Function requestEmailOtp / verifyEmailOtp (functions/account.js — băm mã, hạn 10 phút, ≤ 5 lần thử, rate-limit).
     Demo: mô phỏng trung thực trên máy — KHÔNG gửi email; mã trả về trong demoCode để giao diện hiện kèm chữ "bản dùng thử". */
  let demoOtp = null;
  const otp = {
    enabled(){ return !!FEATURES.emailOtp; },
    request: wrap(needOnline(async rawEmail=>{
      if(!FEATURES.emailOtp) throw dErr("otp/disabled");
      const email = normEmail(rawEmail);
      if(!EMAIL_RE.test(email)) throw dErr("auth/invalid-email");
      cdGuard("otp:" + email);
      if(mode === "firebase"){
        try{ await callFn("requestEmailOtp", { email }); }
        catch(e){ if(/^(functions\/)?(not-found|unimplemented)$/.test(String(e && e.code || ""))) throw dErr("otp/disabled"); throw e; }
        cdMark("otp:" + email);
        return { sent: true, simulated: false, waitSec: CD_SEC };
      }
      await delay();
      demoOtp = { email, code: sixDigits(), exp: now() + 10*60000, tries: 0 };
      cdMark("otp:" + email);
      return { sent: true, simulated: true, demoCode: demoOtp.code, waitSec: CD_SEC };
    })),
    verify: wrap(needOnline(async (rawEmail, rawCode, newPw)=>{
      if(!FEATURES.emailOtp) throw dErr("otp/disabled");
      const email = normEmail(rawEmail), code = String(rawCode || "").replace(/\D/g, "");
      if(code.length !== 6) throw dErr("auth/missing-verification-code");
      if(String(newPw || "").length < 6) throw dErr("auth/weak-password");
      if(mode === "firebase"){ await callFn("verifyEmailOtp", { email, code, newPassword: String(newPw) }); return { ok: true }; }
      await delay();
      const o = demoOtp;
      if(!o || o.email !== email || now() > o.exp){ throw dErr("otp/invalid"); }
      if(o.code !== code){ o.tries++; if(o.tries >= 5){ demoOtp = null; throw dErr("otp/too-many"); } throw dErr("otp/invalid"); }
      demoOtp = null;
      const db = dLoad(), acc = db.accounts[email];
      if(!acc) throw dErr("otp/invalid");                      // email không có tài khoản: cùng thông báo như mã sai
      acc.pw = dHash(newPw); acc.providers = uniq(demoBaseProviders(acc).concat("password")); dSave(db);
      return { ok: true };
    })),
  };

  /* ---------------- A2. OTP qua số điện thoại (cờ FK_FEATURES.phoneOtp — SMS cần gói Blaze) ----------------
     start(số, { link:true })  → liên kết số vào tài khoản đang đăng nhập
     start(số)                 → đăng nhập bằng OTP (quên mật khẩu) → sau đó cloud.setPassword(mật khẩu mới)
     Web: reCAPTCHA vô hình (RecaptchaVerifier) · Native: plugin @capacitor-firebase/authentication (sự kiện phoneCodeSent). */
  function normPhone(raw){
    let p = String(raw || "").replace(/[\s.\-()]/g, "");
    if(/^00/.test(p)) p = "+" + p.slice(2);
    if(/^0\d{9}$/.test(p)) p = "+84" + p.slice(1);
    else if(/^84\d{9}$/.test(p)) p = "+" + p;
    if(!/^\+[1-9]\d{7,14}$/.test(p) || (/^\+84/.test(p) && !/^\+84[35789]\d{8}$/.test(p))) throw dErr("auth/invalid-phone-number");
    return p;
  }
  let phonePending = null, recaptcha = null;
  function recaptchaVerifier(){
    if(recaptcha) return recaptcha;
    let el = document.getElementById("fk-recaptcha");
    if(!el){ el = document.createElement("div"); el.id = "fk-recaptcha"; document.body.appendChild(el); }
    recaptcha = new firebase.auth.RecaptchaVerifier(el, { size: "invisible" });
    return recaptcha;
  }
  function recaptchaReset(){ try{ recaptcha && recaptcha.clear(); }catch(e){} recaptcha = null; }
  /* TODO(native — việc của chủ dự án, xem docs/DATABASE-SETUP.md §10): thêm "phone" vào capacitor.config.json → plugins.FirebaseAuthentication.providers;
     Android: khai báo SHA-256 + bật Play Integrity; iOS: tải APNs Auth Key lên Firebase (hoặc URL scheme REVERSED_CLIENT_ID cho reCAPTCHA dự phòng).
     Mã dưới đây đã sẵn sàng: lấy verificationId từ SDK gốc rồi xác nhận ở lớp JS (skipNativeAuth). */
  function nativePhoneStart(P, num){
    return new Promise((resolve, reject)=>{
      const hs = []; let done = false;
      const fin = (fn, v)=>{ if(done) return; done = true; clearTimeout(t); hs.forEach(h=>{ try{ h && h.remove && h.remove(); }catch(e){} }); fn(v); };
      const t = setTimeout(()=> fin(reject, dErr("auth/timeout")), 60000);
      Promise.all([
        P.addListener("phoneCodeSent", ev=> fin(resolve, ev && ev.verificationId)),
        P.addListener("phoneVerificationFailed", ev=> fin(reject, dErr((ev && ev.code) || "auth/internal-error"))),
      ]).then(list=>{ hs.push(...list); return P.signInWithPhoneNumber({ phoneNumber: num }); }).catch(e=> fin(reject, e));
    });
  }
  const phone = {
    enabled(){ return !!FEATURES.phoneOtp; },
    normalize: normPhone,
    start: wrap(needOnline(async (raw, opts)=>{
      if(!FEATURES.phoneOtp) throw dErr("phone/disabled");
      const num = normPhone(raw), link = !!(opts && opts.link);
      if(link && !user) throw new Error("Chưa đăng nhập.");
      cdGuard("sms:" + num);
      if(mode !== "firebase"){
        await delay();
        phonePending = { demo: true, num, link, code: sixDigits(), exp: now() + 5*60000, tries: 0 };
        cdMark("sms:" + num);
        return { sent: true, simulated: true, demoCode: phonePending.code, phone: num, waitSec: CD_SEC };
      }
      let verificationId;
      if(isNative()){
        const P = nativeAuthPlugin(); if(!P) throw dErr("social/not-configured");
        verificationId = await nativePhoneStart(P, num);
      } else {
        try{ verificationId = await new firebase.auth.PhoneAuthProvider(fb.auth).verifyPhoneNumber(num, recaptchaVerifier()); }
        catch(e){ recaptchaReset(); throw e; }
      }
      phonePending = { verificationId, num, link };
      cdMark("sms:" + num);
      return { sent: true, simulated: false, phone: num, waitSec: CD_SEC };
    })),
    confirm: wrap(async rawCode=>{
      const code = String(rawCode || "").replace(/\D/g, ""), p = phonePending;
      if(!p) throw dErr("auth/code-expired");
      if(code.length !== 6) throw dErr("auth/missing-verification-code");
      if(p.link && !user) throw new Error("Chưa đăng nhập.");
      if(p.demo){
        if(now() > p.exp){ phonePending = null; throw dErr("auth/code-expired"); }
        if(p.code !== code){ p.tries++; if(p.tries >= 5){ phonePending = null; throw dErr("otp/too-many"); } throw dErr("auth/invalid-verification-code"); }
        phonePending = null;
        const db = dLoad(); db.phones = db.phones || {};
        if(p.link){
          const acc = demoAcc(db); if(!acc) throw dErr("auth/requires-recent-login");
          if(db.phones[p.num] && db.phones[p.num] !== user.uid) throw dErr("auth/credential-already-in-use");
          Object.keys(db.phones).forEach(k=>{ if(db.phones[k] === user.uid) delete db.phones[k]; });
          db.phones[p.num] = user.uid; acc.phone = p.num; dSave(db);
          return { linked: true, phone: p.num };
        }
        const uid = db.phones[p.num];
        if(!uid || !db.users[uid]) throw dErr("phone/not-linked");
        localStorage.setItem(DEMO_AUTH, uid);
        user = { uid, email: db.users[uid].email, name: db.users[uid].name }; profile = db.users[uid];
        emit(); authTrack("login", "phone");
        return { signedIn: true, user };
      }
      const cred = firebase.auth.PhoneAuthProvider.credential(p.verificationId, code);
      if(p.link){
        const u = fb.auth.currentUser;
        if((u.providerData || []).some(x=> x.providerId === "phone")) await u.updatePhoneNumber(cred);   // đổi số
        else await u.linkWithCredential(cred);
        phonePending = null;
        return { linked: true, phone: p.num };
      }
      const res = await fb.auth.signInWithCredential(cred);
      phonePending = null;
      /* Số chưa liên kết với tài khoản nào → Firebase tự tạo tài khoản MỚI chỉ có SĐT: xoá ngay, không để tài khoản rỗng */
      if(res && res.additionalUserInfo && res.additionalUserInfo.isNewUser){
        try{ await res.user.delete(); }catch(e){ try{ await fb.auth.signOut(); }catch(_){} }
        user = null; profile = null;
        throw dErr("phone/not-linked");
      }
      const u = res.user;
      user = { uid: u.uid, email: u.email || "", name: u.displayName || (u.email || "").split("@")[0] || "Bạn" };
      profile = stripEmail(u.uid, await firebaseEngine.getUser(u.uid));
      emit(); authTrack("login", "phone");
      return { signedIn: true, user };
    }),
    cancel(){ phonePending = null; },
  };

  /** Đặt mật khẩu mới cho tài khoản ĐANG đăng nhập (sau OTP số điện thoại, hoặc thêm mật khẩu cho tài khoản Google/Apple/Facebook) */
  api.setPassword = wrap(needOnline(async newPw=>{
    if(!user) throw new Error("Chưa đăng nhập.");
    if(String(newPw || "").length < 6) throw dErr("auth/weak-password");
    if(mode !== "firebase"){
      const db = dLoad(), acc = demoAcc(db); if(!acc) throw dErr("auth/requires-recent-login");
      acc.pw = dHash(newPw); acc.providers = uniq(demoBaseProviders(acc).concat("password")); dSave(db);
      return true;
    }
    const u = fb.auth.currentUser;
    if((u.providerData || []).some(p=> p.providerId === "password")) await u.updatePassword(String(newPw));
    else { if(!u.email) throw dErr("link/need-email"); await u.linkWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, String(newPw))); }
    return true;
  }));

  /* ---------------- B. Tài khoản liên kết ---------------- */
  const linked = {
    labels: PROVIDER_LABEL,
    providers: myProviders,
    has: k => myProviders().includes(k),
    /** → [{ id, label, linked, detail, canUnlink }] — số điện thoại chỉ hiện khi bật cờ phoneOtp (hoặc đã liên kết từ trước) */
    list(){
      const mine = myProviders(), detail = {};
      try{
        if(mode === "firebase" && fb && fb.auth.currentUser) (fb.auth.currentUser.providerData || []).forEach(p=>{
          const k = Object.keys(PROVIDER_ID).find(x=> PROVIDER_ID[x] === p.providerId); if(k) detail[k] = p.phoneNumber || p.email || "";
        });
        else if(user){ const acc = demoAcc(dLoad()) || {}; detail.password = user.email || ""; detail.phone = acc.phone || ""; }
      }catch(e){}
      const kinds = ["password", "google", "apple", "facebook"].concat(FEATURES.phoneOtp || mine.includes("phone") ? ["phone"] : []);
      return kinds.map(k=> ({ id: k, label: PROVIDER_LABEL[k], linked: mine.includes(k), detail: mine.includes(k) ? (detail[k] || "") : "", canUnlink: mine.includes(k) && mine.length > 1 }));
    },
    link: wrap(needOnline(async kind=>{
      if(!user) throw new Error("Chưa đăng nhập.");
      if(!["google", "facebook", "apple"].includes(kind)) throw new Error("Phương thức này chưa hỗ trợ liên kết.");
      if(myProviders().includes(kind)) throw dErr("auth/provider-already-linked");
      if(mode !== "firebase"){
        await delay(200);
        const db = dLoad(), acc = demoAcc(db); if(!acc) throw dErr("auth/requires-recent-login");
        db.socialLinks = db.socialLinks || {};
        const other = db.accounts[`demo.${kind}@fitkit.local`];
        if((db.socialLinks[kind] && db.socialLinks[kind] !== user.uid) || (other && other.uid !== user.uid)) throw dErr("auth/credential-already-in-use");
        db.socialLinks[kind] = user.uid; acc.providers = uniq(demoBaseProviders(acc).concat(kind)); dSave(db);
        return linked.list();
      }
      await socialCredentialSignIn(kind, null, fb.auth.currentUser);
      return linked.list();
    })),
    /** Huỷ liên kết — LUÔN giữ ít nhất 1 cách đăng nhập */
    unlink: wrap(needOnline(async kind=>{
      if(!user) throw new Error("Chưa đăng nhập.");
      const mine = myProviders();
      if(!mine.includes(kind)) throw dErr("auth/no-such-provider");
      if(mine.length <= 1) throw dErr("link/last-method");
      if(mode !== "firebase"){
        const db = dLoad(), acc = demoAcc(db); if(!acc) throw dErr("auth/requires-recent-login");
        if(kind === "phone"){ if(db.phones) Object.keys(db.phones).forEach(k=>{ if(db.phones[k] === user.uid) delete db.phones[k]; }); delete acc.phone; acc.providers = demoBaseProviders(acc); }
        else {
          acc.providers = demoBaseProviders(acc).filter(x=> x !== kind);
          if(kind === "password") acc.pw = dHash(rid("x"));
          else if(db.socialLinks && db.socialLinks[kind] === user.uid) delete db.socialLinks[kind];
        }
        delete acc.provider; dSave(db);
        return linked.list();
      }
      await fb.auth.currentUser.unlink(PROVIDER_ID[kind]);
      return linked.list();
    })),
    /** Vừa tự liên kết sau lỗi "email đã đăng ký bằng cách khác"? → "google" | "facebook" | "apple" | null (đọc 1 lần) */
    takeAutoLinked(){ const k = lastAutoLinked; lastAutoLinked = null; return k; },
  };

  /* ---------------- D. Nhật ký đồng ý (Luật BVDLCN 2025 / NĐ 13/2023: chứng minh được sự đồng ý) ----------------
     Loại: terms (Điều khoản + Chính sách) · health (xử lý dữ liệu sức khoẻ — dữ liệu NHẠY CẢM, điều kiện để sao lưu cloud)
           · age (đủ 16 tuổi hoặc có đồng ý của cha mẹ/người giám hộ).
     Mỗi lần đồng ý / rút đồng ý = 1 dòng CHỈ-THÊM: { type, granted, version, at }. Lưu trên máy (kể cả khách) + users/{uid}/consents. */
  const CONSENT_KEY = "fitkit_consent_log_v1", CONSENT_TYPES = ["terms", "health", "age"];
  function cRead(){ try{ const a = JSON.parse(localStorage.getItem(CONSENT_KEY) || "[]"); return Array.isArray(a) ? a.filter(isObj) : []; }catch(e){ return []; } }
  function cWrite(a){ try{ localStorage.setItem(CONSENT_KEY, JSON.stringify(a.slice(-200))); }catch(e){} }
  async function cPush(uid, rows){
    if(!rows.length) return;
    if(mode !== "firebase"){
      const db = dLoad(); db.consents = db.consents || {}; const l = db.consents[uid] = db.consents[uid] || [];
      rows.forEach(r=>{ if(!l.some(x=> x.id === r.id)) l.push({ id: r.id, type: r.type, granted: r.granted, version: r.version, at: r.at, src: r.src }); });
      dSave(db); return;
    }
    const col = fb.db.collection("users").doc(uid).collection("consents");
    for(const r of rows){
      const doc = { type: r.type, granted: !!r.granted, version: String(r.version), clientAt: Number(r.at), src: String(r.src || "app").slice(0, 24),
        platform: isNative() ? "native" : "web", at: firebase.firestore.FieldValue.serverTimestamp() };
      try{ await withTimeout(col.doc(r.id).set(doc), 8000); }
      catch(e){ const s = await col.doc(r.id).get().catch(()=> null); if(!(s && s.exists)) throw e; }     // đã ghi từ lần trước (rules: không sửa) → coi như xong
    }
  }
  const consent = {
    version: POLICY_VERSION, types: CONSENT_TYPES,
    log(uid){ uid = uid === undefined ? (user ? user.uid : null) : uid; return cRead().filter(r=> (r.uid || null) === (uid || null)); },
    /** → { terms, health, age, base, version, at } · base = đã đồng ý Điều khoản + tuổi theo ĐÚNG phiên bản chính sách hiện hành */
    status(uid){
      const rows = consent.log(uid), out = { version: POLICY_VERSION, at: 0 };
      CONSENT_TYPES.forEach(t=>{
        const last = rows.filter(r=> r.type === t).sort((a, b)=> (a.at || 0) - (b.at || 0)).pop();
        out[t] = !!(last && last.granted === true && (t === "health" || last.version === POLICY_VERSION));
        if(last && last.at > out.at) out.at = last.at;
      });
      out.base = out.terms && out.age;
      return out;
    },
    /** Ghi đồng ý / rút đồng ý: record({ terms:true, health:false, age:true }, "signup") */
    async record(grants, src){
      const at = now(), uid = user ? user.uid : null, rows = [];
      CONSENT_TYPES.forEach(t=>{ if(grants && typeof grants[t] === "boolean") rows.push({ id: rid("cs"), uid, type: t, granted: grants[t], version: POLICY_VERSION, at, src: String(src || "app").slice(0, 24), synced: !uid ? null : false }); });
      if(!rows.length) return consent.status();
      cWrite(cRead().concat(rows));
      if(uid){ try{ await cPush(uid, rows); consent._mark(rows.map(r=> r.id)); }catch(e){ console.warn("Chưa ghi được nhật ký đồng ý lên máy chủ (sẽ thử lại):", e && (e.code || e.message)); } }
      if(grants && "health" in grants){ try{ sync._consentChanged(grants.health); }catch(e){} }
      return consent.status();
    },
    _mark(ids){ const a = cRead(); a.forEach(r=>{ if(ids.includes(r.id)) r.synced = true; }); cWrite(a); },
    _forget(uid){ cWrite(cRead().filter(r=> r.uid !== uid)); },
    /** Sau đăng nhập: kéo nhật ký đồng ý của tài khoản về máy (máy mới không hỏi lại) + đẩy các dòng chưa gửi được */
    async load(){
      if(!user) return consent.status();
      const uid = user.uid;
      try{
        let remote = [];
        if(mode === "firebase"){
          const sn = await withTimeout(fb.db.collection("users").doc(uid).collection("consents").get(), 6000);
          remote = sn.docs.map(d=>{ const x = d.data() || {}; return { id: d.id, type: x.type, granted: x.granted, version: x.version, at: Number(x.clientAt) || 0, src: x.src || "" }; });
        } else remote = ((dLoad().consents || {})[uid] || []).slice();
        const a = cRead(), have = new Set(a.map(r=> r.id));
        remote.forEach(r=>{ if(r && r.id && !have.has(r.id) && CONSENT_TYPES.includes(r.type)) a.push({ id: r.id, uid, type: r.type, granted: r.granted === true, version: String(r.version || ""), at: r.at, src: r.src, synced: true }); });
        cWrite(a);
        const ids = new Set(remote.map(r=> r.id));
        const todo = a.filter(r=> r.uid === uid && r.synced === false && !ids.has(r.id));
        if(todo.length){ await cPush(uid, todo); consent._mark(todo.map(r=> r.id)); }
      }catch(e){ console.warn("Chưa tải được nhật ký đồng ý:", e && (e.code || e.message)); }
      return consent.status();
    },
  };

  /* ---------------- C. Sao lưu & đồng bộ dữ liệu cá nhân (fitkit_state_v1) theo tài khoản ----------------
     Firestore: users/{uid}/appState/meta { v, updatedAt, device, n, chars, app } + users/{uid}/appState/c{i} { i, g, s }
       · JSON của state cắt thành khúc ≤ 250 000 ký tự (≤ ~750 KB UTF-8 < giới hạn 1 MiB / tài liệu); tối đa 40 khúc (~10 triệu ký tự)
       · g = updatedAt của lần ghi → đọc thấy khúc lệch thế hệ (thiết bị khác đang ghi dở) = "sync/torn", bỏ qua vòng này
     Quy tắc:
       · Chỉ chạy khi: đã đăng nhập + người dùng ĐỒNG Ý xử lý dữ liệu sức khoẻ (consent.health) + cờ cloudSync ≠ false
       · KHÔNG lên cloud: khoá API cá nhân (aiSettings), cấu hình Drive, video/ảnh tiến độ (blob ở IndexedDB), cờ theo máy
       · Đẩy có debounce 8 s và cách nhau ≥ 30 s; ngoại tuyến → giữ cờ "chưa sao lưu", có mạng / mở lại app thì đẩy tiếp
       · Cloud thay đổi từ máy khác + máy này cũng có thay đổi → GỘP (hợp các ngày/bản ghi; trùng khoá → bên có updatedAt mới hơn thắng)
       · Dữ liệu trên máy thuộc khách / tài khoản khác mà cloud đã có dữ liệu → HỎI người dùng (gộp · dùng cloud · giữ máy này · để sau);
         trước khi ghi đè luôn lưu bản tạm fitkit_state_backup_v1 (khôi phục được); đăng xuất KHÔNG xoá dữ liệu trên máy. */
  const STATE_KEY = "fitkit_state_v1", SYNC_META = "fitkit_sync_meta_v1", SYNC_BAK = "fitkit_state_backup_v1", DEMO_STATE = "fitkit_cloud_demo_state_v1";
  const SYNC_LOCAL_ONLY = ["aiSettings", "driveSettings", "_firedKeys", "selectedDay", "authDone", "_pendingJoin", "videoLibrary", "progressPhotos", "coachUpcoming", "coachSeen"];
  const SYNC_SETTINGS = ["profile", "reminders", "coachPrefs"];     // gộp: bên mới hơn thắng nguyên khối
  const CHUNK = 250000, MAX_CHUNKS = 40, AVATAR_MAX = 60000;
  function syncPack(st){
    const c = clone(st || {}) || {};
    SYNC_LOCAL_ONLY.forEach(k=> delete c[k]);
    if(isObj(c.profile) && typeof c.profile.avatarData === "string" && c.profile.avatarData.length > AVATAR_MAX) c.profile.avatarData = null;
    return c;
  }
  function syncUnpack(local, data){
    const out = clone(data || {}) || {};
    SYNC_LOCAL_ONLY.forEach(k=>{ if(local && k in local) out[k] = local[k]; else delete out[k]; });
    if(local && isObj(local.profile) && local.profile.avatarData && isObj(out.profile) && !out.profile.avatarData) out.profile.avatarData = local.profile.avatarData;
    return out;
  }
  function mergeArr(key, a, b){
    const prim = x => typeof x === "string" || typeof x === "number";
    if(a.every(prim) && b.every(prim)){ const u = uniq(a.concat(b)); return key === "finishedDates" ? u.sort() : u; }
    const idOf = x => isObj(x) && x.id != null ? String(x.id) : null;
    if(a.every(idOf) && b.every(idOf)){ const seen = new Set(a.map(idOf)); return a.concat(b.filter(x=> !seen.has(idOf(x))).map(clone)); }
    return a;
  }
  /** Gộp 2 bản state: bên có mốc thời gian MỚI hơn làm gốc; bản đồ theo ngày/khoá và danh sách được HỢP (không mất ngày nào của bên cũ) */
  function syncMerge(local, remote, localAt, remoteAt){
    local = isObj(local) ? local : {}; remote = isObj(remote) ? remote : {};
    const remoteNewer = Number(remoteAt || 0) > Number(localAt || 0);
    const A = clone(remoteNewer ? remote : local), B = remoteNewer ? local : remote;
    Object.keys(B).forEach(k=>{
      const a = A[k], b = B[k];
      if(a === undefined){ A[k] = clone(b); return; }
      if(SYNC_SETTINGS.includes(k)) return;
      if(isObj(a) && isObj(b)){ Object.keys(b).forEach(kk=>{ if(!(kk in a)) a[kk] = clone(b[kk]); }); return; }
      if(Array.isArray(a) && Array.isArray(b)) A[k] = mergeArr(k, a, b);
    });
    if(local.onboarded || remote.onboarded) A.onboarded = true;
    return A;
  }
  const demoStateStore = {
    _all(){ try{ const o = JSON.parse(localStorage.getItem(DEMO_STATE) || "{}"); return isObj(o) ? o : {}; }catch(e){ return {}; } },
    async head(uid){ const r = demoStateStore._all()[uid]; return r ? { updatedAt: Number(r.updatedAt) || 0, device: r.device || "", n: 1 } : null; },
    async read(uid){ const r = demoStateStore._all()[uid]; if(!r) return null; let data; try{ data = JSON.parse(r.json); }catch(e){ throw dErr("sync/torn"); } return { updatedAt: Number(r.updatedAt) || 0, device: r.device || "", data }; },
    async write(uid, rec){ const all = demoStateStore._all(); all[uid] = { updatedAt: rec.updatedAt, device: rec.device, json: rec.json }; localStorage.setItem(DEMO_STATE, JSON.stringify(all)); },
    purge(uid){ const all = demoStateStore._all(); if(uid in all){ delete all[uid]; localStorage.setItem(DEMO_STATE, JSON.stringify(all)); } return Promise.resolve(); },
  };
  const fbStateStore = {
    _n: {},
    col: uid => fb.db.collection("users").doc(uid).collection("appState"),
    async head(uid){
      const m = await fbStateStore.col(uid).doc("meta").get();
      if(!m.exists) return null;
      const x = m.data() || {}; fbStateStore._n[uid] = Number(x.n) || 0;
      return { updatedAt: Number(x.updatedAt) || 0, device: x.device || "", n: Math.min(MAX_CHUNKS, Number(x.n) || 0) };
    },
    async read(uid, head){
      head = head || await fbStateStore.head(uid);
      if(!head) return null;
      const parts = await Promise.all(Array.from({ length: head.n }, (_, i)=> fbStateStore.col(uid).doc("c" + i).get()));
      if(!parts.length || parts.some(d=> !d.exists || Number((d.data() || {}).g) !== head.updatedAt)) throw dErr("sync/torn");
      let data; try{ data = JSON.parse(parts.map(d=> d.data().s).join("")); }catch(e){ throw dErr("sync/torn"); }
      if(!isObj(data)) throw dErr("sync/torn");
      return { updatedAt: head.updatedAt, device: head.device, data };
    },
    async write(uid, rec){
      const json = rec.json, n = Math.max(1, Math.ceil(json.length / CHUNK));
      if(n > MAX_CHUNKS) throw dErr("sync/too-big");
      const col = fbStateStore.col(uid), GROUP = 6, prevN = fbStateStore._n[uid] || 0;
      const ops = Array.from({ length: n }, (_, i)=> [col.doc("c" + i), { i, g: rec.updatedAt, s: json.slice(i * CHUNK, (i + 1) * CHUNK) }]);
      const last = fb.db.batch();
      if(n <= GROUP) ops.forEach(([r, d])=> last.set(r, d));                       // thường gặp: 1 lô nguyên tử (khúc + meta)
      else for(let i = 0; i < n; i += GROUP){ const b = fb.db.batch(); ops.slice(i, i + GROUP).forEach(([r, d])=> b.set(r, d)); await b.commit(); }
      last.set(col.doc("meta"), { v: 1, updatedAt: rec.updatedAt, device: String(rec.device || "").slice(0, 64), n, chars: json.length, app: "tapeasy" });
      for(let i = n; i < Math.min(prevN, MAX_CHUNKS); i++) last.delete(col.doc("c" + i));   // khúc thừa của bản cũ dài hơn
      await last.commit();
      fbStateStore._n[uid] = n;
    },
    async purge(uid){ const sn = await fbStateStore.col(uid).get(); await Promise.all(sn.docs.map(d=> d.ref.delete())); delete fbStateStore._n[uid]; },
  };
  const sync = (()=>{
    let host = null, timer = null, busy = null, paused = false, lastErr = null, lastPushAt = 0, wired = false;
    const listeners = [];
    const deviceId = ()=>{ try{ let d = localStorage.getItem("fitkit_device_id"); if(!d){ d = rid("d"); localStorage.setItem("fitkit_device_id", d); } return d; }catch(e){ return "d0"; } };
    const meta = ()=>{ try{ const m = JSON.parse(localStorage.getItem(SYNC_META) || "{}"); return isObj(m) ? m : {}; }catch(e){ return {}; } };
    const setMeta = patch=>{ const m = Object.assign(meta(), patch); try{ localStorage.setItem(SYNC_META, JSON.stringify(m)); }catch(e){} return m; };
    const store = ()=> mode === "firebase" ? fbStateStore : demoStateStore;
    const notify = ()=> listeners.forEach(cb=>{ try{ cb(S.status()); }catch(e){} });
    const localState = ()=> host.getState();
    /* "Máy này có dữ liệu thật chưa?" — app tự tạo sẵn khung rỗng cho hôm nay (foodLog[hôm nay] = { breakfast:[] … }) nên phải nhìn NỘI DUNG */
    const hasData = st=>{
      if(!isObj(st)) return false;
      if(st.onboarded) return true;
      const vals = o=> isObj(o) ? Object.values(o) : [];
      return vals(st.workoutLog).some(l=> isObj(l) && ((Array.isArray(l.completedExerciseIds) && l.completedExerciseIds.length) || l.finishedAt))
        || vals(st.foodLog).some(d=> vals(d).some(m=> Array.isArray(m) && m.length))
        || vals(st.waterLog).some(v=> Number(v) > 0) || vals(st.sleepLog).length > 0
        || (Array.isArray(st.inbodyLogs) && st.inbodyLogs.length > 0) || (Array.isArray(st.finishedDates) && st.finishedDates.length > 0);
    };
    /** Vì sao CHƯA đồng bộ? "" = đang bật */
    function why(){
      if(FEATURES.cloudSync === false) return "off";
      if(degraded) return "offline";
      if(!user) return "no-login";
      if(!host) return "no-host";
      if(!consent.status().health) return "no-consent";
      if(paused) return "paused";
      return "";
    }
    function backupLocal(){
      try{ localStorage.setItem(SYNC_BAK, JSON.stringify({ at: now(), owner: meta().owner || null, state: localState() })); return true; }
      catch(e){ try{ localStorage.removeItem(SYNC_BAK); }catch(_){} return false; }
    }
    async function push(uid){
      const startedDirty = meta().dirtyAt || 0;
      const json = JSON.stringify(syncPack(localState()));
      const at = Math.max(now(), (meta().remoteAt || 0) + 1);
      await withTimeout(store().write(uid, { updatedAt: at, device: deviceId(), json }), 12000);
      const m = meta();
      setMeta({ owner: uid, remoteAt: at, syncedAt: now(), dirtyAt: (m.dirtyAt || 0) > startedDirty ? m.dirtyAt : 0 });
      lastPushAt = now();
    }
    function adopt(uid, data, remoteAt){ host.applyState(syncUnpack(localState(), data)); setMeta({ owner: uid, remoteAt, syncedAt: now(), dirtyAt: 0 }); }
    /** Dữ liệu trên máy chưa thuộc tài khoản này → quyết định (có hỏi người dùng khi có nguy cơ ghi đè). Trả false = tạm dừng. */
    async function reconcile(uid){
      const m = meta(), st = localState(), localHas = hasData(st);
      const head = await withTimeout(store().head(uid), 12000);
      if(!user || user.uid !== uid) return false;
      const ask = info => (host.choose ? Promise.resolve(host.choose(info)).catch(()=> "later") : Promise.resolve("later"));
      if(!head){
        if(m.owner && m.owner !== uid && localHas){
          const c = await ask({ kind: "claim", localOwner: m.owner, remoteAt: 0 });
          if(c !== "local"){ paused = true; return false; }
        }
        setMeta({ owner: uid, remoteAt: 0, dirtyAt: now() });
        return true;
      }
      if(!localHas){ const r = await withTimeout(store().read(uid, head), 15000); adopt(uid, r.data, r.updatedAt); return true; }
      const c = await ask({ kind: m.owner ? "switch" : "guest", localOwner: m.owner || null, remoteAt: head.updatedAt });
      if(!user || user.uid !== uid) return false;
      if(c === "cloud" || c === "merge"){
        const r = await withTimeout(store().read(uid, head), 15000);
        backupLocal();
        if(c === "cloud"){ adopt(uid, r.data, r.updatedAt); return true; }
        const merged = syncMerge(syncPack(st), r.data, m.dirtyAt || now(), r.updatedAt);
        host.applyState(syncUnpack(st, merged));
        setMeta({ owner: uid, remoteAt: r.updatedAt, dirtyAt: now() });
        return true;
      }
      if(c === "local"){ setMeta({ owner: uid, remoteAt: head.updatedAt, dirtyAt: now() }); return true; }
      paused = true; return false;
    }
    async function run(){
      const uid = user.uid;
      if(meta().owner !== uid){ if(!(await reconcile(uid))) return "paused"; }
      if(!user || user.uid !== uid) return "changed";
      const m = meta();
      const head = await withTimeout(store().head(uid), 12000);
      if(!user || user.uid !== uid) return "changed";
      if(!head){ await push(uid); return "pushed"; }
      if(head.updatedAt > (m.remoteAt || 0)){
        if(head.device === deviceId()){ setMeta({ remoteAt: head.updatedAt }); }        // chính máy này ghi (lần trước hết giờ chờ nhưng lệnh ghi đã tới)
        else {
          const r = await withTimeout(store().read(uid, head), 15000);
          if(!user || user.uid !== uid) return "changed";
          if(m.dirtyAt){
            const cur = localState();
            host.applyState(syncUnpack(cur, syncMerge(syncPack(cur), r.data, m.dirtyAt, r.updatedAt)));
            setMeta({ remoteAt: r.updatedAt, dirtyAt: now() });
            await push(uid); return "merged";
          }
          adopt(uid, r.data, r.updatedAt); return "pulled";
        }
      }
      if(meta().dirtyAt){ await push(uid); return "pushed"; }
      setMeta({ syncedAt: now() }); return "ok";
    }
    function schedule(){
      clearTimeout(timer);
      timer = setTimeout(()=>{ timer = null; S.syncNow().catch(()=>{}); }, Math.max(8000, lastPushAt + 30000 - now()));
    }
    function wire(){
      if(wired) return; wired = true;
      try{ window.addEventListener("online", ()=>{ if(!why() && meta().dirtyAt) S.syncNow().catch(()=>{}); }); }catch(e){}
      try{ document.addEventListener("visibilitychange", ()=>{
        if(why()) return;
        if(document.visibilityState === "hidden"){ if(meta().dirtyAt){ clearTimeout(timer); timer = null; S.syncNow().catch(()=>{}); } }
        else if(now() - (meta().syncedAt || 0) > 5*60000) S.syncNow().catch(()=>{});      // quay lại app sau > 5 phút → kiểm tra cloud có bản mới
      }); }catch(e){}
    }
    const S = {
      /** host = { getState(), applyState(obj), choose(info) → "merge"|"cloud"|"local"|"later" } — pt.js gắn lúc khởi động */
      attach(h){ host = h; wire(); },
      pack: syncPack, unpack: syncUnpack, merge: syncMerge,
      /** Gọi sau MỖI lần saveState: ghi mốc thay đổi (kể cả khi chưa đăng nhập — để gộp đúng về sau) + hẹn giờ đẩy */
      markDirty(){ setMeta({ dirtyAt: now() }); if(!why()) schedule(); },
      syncNow(){
        const w = why(); if(w) return Promise.resolve(w);
        if(busy) return busy;
        busy = run().then(r=>{ lastErr = null; return r; }, e=>{ lastErr = niceError(e); throw lastErr; })
                    .finally(()=>{ busy = null; notify(); });
        return busy;
      },
      /** Đẩy ngay phần chưa sao lưu (trước khi đăng xuất / khi app xuống nền), chờ tối đa ms */
      flush(ms){ if(why() || !meta().dirtyAt) return Promise.resolve("idle"); clearTimeout(timer); timer = null; return withTimeout(S.syncNow(), ms || 5000).catch(()=> "timeout"); },
      status(){
        const m = meta(), w = why();
        return { state: w || "on", enabled: !w, owner: m.owner || null, lastSyncedAt: m.syncedAt || 0, pending: !!m.dirtyAt, busy: !!busy,
          error: lastErr ? lastErr.message : "", hasBackup: (()=>{ try{ return !!localStorage.getItem(SYNC_BAK); }catch(e){ return false; } })() };
      },
      onChange(cb){ if(typeof cb === "function") listeners.push(cb); },
      resume(){ paused = false; return S.syncNow(); },
      /** Khôi phục bản tạm đã lưu trước lần ghi đè gần nhất */
      restoreBackup(){
        let b = null; try{ b = JSON.parse(localStorage.getItem(SYNC_BAK) || "null"); }catch(e){}
        if(!b || !isObj(b.state) || !host) throw niceError(dErr("sync/no-backup"));
        host.applyState(b.state); setMeta({ dirtyAt: now() });
        try{ localStorage.removeItem(SYNC_BAK); }catch(e){}
        if(!why()) schedule();
        notify(); return true;
      },
      /** Xoá bản sao lưu trên cloud của tài khoản đang đăng nhập (rút đồng ý dữ liệu sức khoẻ) — dữ liệu trên máy giữ nguyên */
      purgeCloud: wrap(async ()=>{ if(!user) throw new Error("Chưa đăng nhập."); await withTimeout(store().purge(user.uid), 15000); setMeta({ remoteAt: 0, syncedAt: 0 }); notify(); return true; }),
      _reset(){ clearTimeout(timer); timer = null; paused = false; lastErr = null; busy = null; },
      _afterDelete(uid){ clearTimeout(timer); timer = null; if(meta().owner === uid) setMeta({ owner: null, remoteAt: 0, syncedAt: 0 }); },
      _consentChanged(on){ if(on && !why()) S.syncNow().catch(()=>{}); notify(); },
      _meta: meta, _stores: { demo: demoStateStore, firebase: fbStateStore }, _limits: { CHUNK, MAX_CHUNKS },
    };
    return S;
  })();

  /* ---------------- Xuất dữ liệu của tôi (quyền tiếp cận / di chuyển dữ liệu) ----------------
     Trả 1 đối tượng JSON: tài khoản, hồ sơ, nhật ký đồng ý, dữ liệu trên máy (state + khoá cài đặt của app), dữ liệu trên máy chủ.
     Khoá API cá nhân bị che ("***"); KHÔNG xuất kho demo dùng chung (chứa tài khoản khác trên máy). */
  api.exportMyData = wrap(async ()=>{
    const out = { app: "TapEasy", format: "tapeasy-export-v1", exportedAt: new Date(now()).toISOString(), policyVersion: POLICY_VERSION,
      mode: mode === "firebase" ? "firebase" : "demo",
      account: user ? { uid: user.uid, email: user.email || "", name: user.name || "", providers: myProviders() } : null,
      profile: profile ? clone(profile) : null,
      consents: cRead().filter(r=> !r.uid || (user && r.uid === user.uid)).map(r=> ({ type: r.type, granted: r.granted, version: r.version, at: r.at, src: r.src })),
      device: { state: null, other: {} }, cloud: {}, notes: [] };
    let st = null;
    try{ st = clone(typeof state !== "undefined" && isObj(state) ? state : JSON.parse(localStorage.getItem(STATE_KEY) || "null")); }
    catch(e){ try{ st = JSON.parse(localStorage.getItem(STATE_KEY) || "null"); }catch(_){} }
    if(isObj(st) && isObj(st.aiSettings)) Object.keys(st.aiSettings).forEach(k=>{ if(/key/i.test(k) && st.aiSettings[k]) st.aiSettings[k] = "***"; });
    out.device.state = st;
    try{
      for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(!k || !/^(fitkit|tapeasy|fk)[_-]/i.test(k) || k === STATE_KEY || /demo|backup|cooldown|token|secret|device_id/i.test(k) || k === CONSENT_KEY) continue;
        const raw = localStorage.getItem(k);
        if(raw == null || raw.length > 400000) continue;
        try{ out.device.other[k] = JSON.parse(raw); }catch(e){ out.device.other[k] = raw; }
      }
    }catch(e){}
    out.notes.push("Video và ảnh tiến độ lưu trong bộ nhớ trình duyệt/ứng dụng (IndexedDB) — xuất bằng Hồ sơ → Sao lưu (.zip).");
    if(!user) return out;
    const uid = user.uid;
    if(mode !== "firebase"){
      const db = dLoad();
      const mine = Object.entries(db.clients || {}).filter(([, c])=> c.ptId === uid || c.studentUid === uid);
      out.cloud.clients = mine.map(([id, c])=> Object.assign({}, c, { id, role: c.ptId === uid ? "pt" : "student",
        sessions: Object.values((db.sessions || {})[id] || {}), notes: Object.values((db.notes || {})[id] || {}) }));
      out.cloud.blocks = Object.values((db.blocks || {})[uid] || {});
      out.notes.push("Bản dùng thử: \"máy chủ\" là bộ nhớ của chính thiết bị này.");
      return out;
    }
    const safe = async (label, fn)=>{ try{ return await withTimeout(fn(), 15000); }catch(e){ out.notes.push(`Chưa lấy được "${label}": ${niceError(e).message}`); return null; } };
    out.cloud.contact = await safe("liên hệ riêng", async ()=> docData(await fb.db.collection("users").doc(uid).collection("private").doc("contact").get()));
    out.cloud.backup = await safe("thông tin bản sao lưu", ()=> fbStateStore.head(uid));
    out.cloud.blocks = await safe("danh sách chặn", ()=> firebaseEngine.listBlocks());
    out.cloud.clients = await safe("form PT ↔ học viên", async ()=>{
      const asPT = (await firebaseEngine.listClientsAsPT(uid)).map(c=> Object.assign(c, { role: "pt" }));
      const asSt = (await firebaseEngine.listClientsAsStudent(uid)).map(c=> Object.assign(c, { role: "student" }));
      const all = asPT.concat(asSt).slice(0, 60);
      for(const c of all){
        c.sessions = await firebaseEngine.listSessions(c.id).catch(()=> []);
        c.notes = await firebaseEngine.listNotes(c.id).catch(()=> []);
      }
      return all;
    });
    /* Phần còn lại (routine, đánh giá, đăng ký sự kiện, đơn hàng, điểm…) do máy chủ gom — Cloud Function exportMyData (functions/account.js) */
    try{ out.cloud.server = await withTimeout(callFn("exportMyData", {}), 30000); }
    catch(e){ out.cloud.server = null; out.notes.push("Dữ liệu cộng đồng / sự kiện / đơn hàng cần máy chủ (Cloud Function exportMyData) — chưa bật hoặc chưa truy cập được. Liên hệ hỗ trợ nếu bạn cần bản đầy đủ."); }
    return out;
  });

  Object.assign(api, { features: FEATURES, policyVersion: POLICY_VERSION, otp, phone, linked, consent, sync });
  return api;
})();

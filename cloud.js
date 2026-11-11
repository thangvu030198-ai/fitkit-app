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
    "auth/user-not-found": "Không tìm thấy tài khoản với email này.",
    "auth/wrong-password": "Sai mật khẩu.",
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
    "auth/account-exists-with-different-credential": "Email này đã đăng ký bằng cách khác (email/mật khẩu, Google hoặc Facebook). Hãy đăng nhập bằng cách cũ.",
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
    const msg = ERR[code] || (e && e.message) || "Đã có lỗi xảy ra.";
    const err = new Error(msg); err.code = code; return err;
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
      if(!acc || acc.pw !== dHash(pw)) throw dErr("auth/invalid-credential");
      localStorage.setItem(DEMO_AUTH, acc.uid);
      user = { uid: acc.uid, email, name: db.users[acc.uid].name }; profile = db.users[acc.uid];
    },
    async signInSocial(kind){
      // Demo: giả lập tài khoản Google / Facebook trên máy này
      await delay(300);
      const email = `demo.${kind}@fitkit.local`, db = dLoad();
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
    async resetPassword(){ await delay(); /* demo: không gửi email thật */ },
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
      if(!acc || (!acc.provider && acc.pw!==dHash(pw))) throw dErr("auth/wrong-password");
      Object.values(db.clients).forEach(c=>{
        if(c.ptId===user.uid){ delete db.joinCodes[c.joinCode]; delete db.clients[c.id]; delete db.sessions[c.id]; delete db.notes[c.id]; }
        else if(c.studentUid===user.uid){ Object.assign(c, { studentUid:null, studentName:null, studentEmail:null }); }
      });
      if(db.blocks) delete db.blocks[user.uid];
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
  async function socialCredentialSignIn(kind, reauthUser){
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
      return reauthUser ? reauthUser.reauthenticateWithCredential(credential) : fb.auth.signInWithCredential(credential);
    }
    const provider = kind==="google" ? new firebase.auth.GoogleAuthProvider() : kind==="apple" ? new firebase.auth.OAuthProvider("apple.com") : new firebase.auth.FacebookAuthProvider();
    provider.addScope("email"); if(kind==="apple") provider.addScope("name");
    if(kind==="google") provider.setCustomParameters({ prompt:"select_account" });
    if(reauthUser){
      const r = await reauthUser.reauthenticateWithPopup(provider);
      if(kind==="apple") lastAppleGrant = { accessToken: (r && r.credential && r.credential.accessToken) || null, platform: "web" };
      return r;
    }
    try{ return await fb.auth.signInWithPopup(provider); }
    catch(e){
      if(e && e.code==="auth/popup-blocked"){ await fb.auth.signInWithRedirect(provider); return new Promise(()=>{}); }
      throw e;
    }
  }

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
      await loadScript(`${base}/firebase-app-compat.js`);
      await Promise.all([loadScript(`${base}/firebase-auth-compat.js`), loadScript(`${base}/firebase-firestore-compat.js`)]);
      firebase.initializeApp(FIREBASE_CONFIG);
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
      const pid = (u.providerData[0] && u.providerData[0].providerId) || "password";
      if(pid === "password") await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, pw));
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
      await fb.db.collection("users").doc(u.uid).delete();
      await u.delete();
      user=null; profile=null; blockCache = null;
    },
  };

  /* =====================================================================
     API CÔNG KHAI
     ===================================================================== */
  let engine = mode==="firebase" ? firebaseEngine : demo;
  let ready = null;
  let blockCache = null;      // Set uid đã chặn (tải lười)

  const api = {
    get mode(){ return mode; },
    get user(){ return user; },
    get profile(){ return profile; },
    isLoggedIn(){ return !!user; },
    onAuth(cb){ authListeners.push(cb); },

    init(){
      if(ready) return ready;
      ready = (async ()=>{
        try{ await engine.init(); }
        catch(e){
          console.warn("Firebase không khởi động được, chuyển sang chế độ demo:", e);
          mode = "demo"; engine = demo; await demo.init();
        }
        return user;
      })();
      return ready;
    },

    signUp: wrap(async (email, pw, name)=>{ await engine.signUp(email, pw, name); emit(); return user; }),
    signIn: wrap(async (email, pw)=>{ await engine.signIn(email, pw); emit(); return user; }),
    signInWithGoogle: wrap(async ()=>{ await engine.signInSocial("google"); emit(); return user; }),
    signInWithFacebook: wrap(async ()=>{ await engine.signInSocial("facebook"); emit(); return user; }),
    signInWithApple: wrap(async ()=>{ await engine.signInSocial("apple"); emit(); return user; }),
    get isSocialUser(){ return !!(profile && profile.provider && profile.provider!=="password"); },
    signOut: wrap(async ()=>{ await engine.signOut(); blockCache = null; emit(); }),
    resetPassword: wrap(email=> engine.resetPassword(email)),
    deleteAccount: wrap(async pw=>{ if(!user) throw dErr("auth/requires-recent-login"); await engine.deleteAccount(pw); emit(); }),

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

    listSessions: wrap(async cid=> (await engine.listSessions(cid)).sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time))),
    saveSession: wrap((cid, s)=> engine.saveSession(cid, s)),
    deleteSession: wrap((cid, sid)=> engine.deleteSession(cid, sid)),
    listNotes: wrap(async cid=> (await engine.listNotes(cid)).sort((a,b)=>(a.ts||0)-(b.ts||0))),
    addNote: wrap((cid, text, role, kind="note")=> engine.addNote(cid, { authorUid:user.uid, authorRole:role, authorName:user.name, text, kind })),
  };
  return api;
})();
